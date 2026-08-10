/**
 * RainGuard AI
 * Phase 39A-15F4 — Storm Observation Gate
 * File: storm_observation_gate_v39.js
 *
 * Purpose:
 * - Prevent city/static/reference entities from entering the storm-motion pipeline.
 * - Admit only records that contain a real, finite, non-zero coordinate.
 * - Require a meaningful timestamp when available.
 * - Deduplicate repeated observations before they reach persistent identity/motion stages.
 * - Protect the browser from runaway collector loops and repeated self-feeding records.
 *
 * Safety principles:
 * - Never fabricate coordinates.
 * - Never fabricate timestamps.
 * - Never infer movement from one point.
 * - Never mutate upstream source objects.
 * - Never recursively call the StormEntityCollector.
 */

(function installRainGuardStormObservationGateV39(global) {
  "use strict";

  const PHASE = "39A-15F4";
  const VERSION = "39A.15F4.0";
  const BUILD = "rainguard-v39-storm-observation-gate";

  const CONFIG = {
    maxInputRecords: 5000,
    maxOutputRecords: 1500,
    dedupeWindowMs: 15 * 60 * 1000,       // 15 minutes
    coordinatePrecision: 5,
    timestampBucketMs: 30 * 1000,         // 30 seconds
    maxObservationAgeMs: 24 * 60 * 60 * 1000,
    rejectZeroCoordinate: true,
    rejectInvalidCoordinate: true,
    rejectCityReferenceOnly: true,
    requireTimestamp: true,
    allowCurrentCoordinate: true,
    allowNestedCoordinate: true,
    allowDirectCoordinate: true,
    logToConsole: true
  };

  const state = {
    installed: true,
    running: false,
    runInProgress: false,
    lastError: null,
    lastRunAt: null,
    lastResult: null,
    totalRuns: 0,
    totalInput: 0,
    totalAccepted: 0,
    totalRejected: 0,
    totalDuplicates: 0,
    recentKeys: new Map()
  };

  function isFiniteNumber(value) {
    return Number.isFinite(Number(value));
  }

  function normalizeNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function normalizeTimestamp(value) {
    if (value == null) return null;

    if (typeof value === "number" && Number.isFinite(value)) {
      if (value < 1e12) return Math.round(value * 1000);
      return Math.round(value);
    }

    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) return null;

      const numeric = Number(trimmed);
      if (Number.isFinite(numeric)) {
        if (numeric < 1e12) return Math.round(numeric * 1000);
        return Math.round(numeric);
      }

      const parsed = Date.parse(trimmed);
      return Number.isFinite(parsed) ? parsed : null;
    }

    if (value instanceof Date) {
      const t = value.getTime();
      return Number.isFinite(t) ? t : null;
    }

    return null;
  }

  function coordinateIsValid(lat, lon) {
    if (!isFiniteNumber(lat) || !isFiniteNumber(lon)) return false;

    const latitude = Number(lat);
    const longitude = Number(lon);

    if (latitude < -90 || latitude > 90) return false;
    if (longitude < -180 || longitude > 180) return false;

    if (
      CONFIG.rejectZeroCoordinate &&
      Math.abs(latitude) < 1e-12 &&
      Math.abs(longitude) < 1e-12
    ) {
      return false;
    }

    return true;
  }

  function extractCoordinate(record) {
    if (!record || typeof record !== "object") return null;

    const candidates = [];

    if (CONFIG.allowDirectCoordinate) {
      candidates.push(
        { lat: record.latitude, lon: record.longitude, path: "direct.latitude_longitude" },
        { lat: record.lat, lon: record.lon, path: "direct.lat_lon" },
        { lat: record.lat, lon: record.lng, path: "direct.lat_lng" }
      );
    }

    if (CONFIG.allowCurrentCoordinate && record.currentCoordinate) {
      const c = record.currentCoordinate;
      candidates.push(
        { lat: c.latitude, lon: c.longitude, path: "currentCoordinate.latitude_longitude" },
        { lat: c.lat, lon: c.lon, path: "currentCoordinate.lat_lon" },
        { lat: c.lat, lon: c.lng, path: "currentCoordinate.lat_lng" }
      );
    }

    if (CONFIG.allowNestedCoordinate) {
      const nestedKeys = [
        "coordinate",
        "coordinates",
        "location",
        "position",
        "center",
        "centroid",
        "point",
        "geo"
      ];

      for (const key of nestedKeys) {
        const c = record[key];
        if (!c || typeof c !== "object") continue;

        candidates.push(
          { lat: c.latitude, lon: c.longitude, path: `${key}.latitude_longitude` },
          { lat: c.lat, lon: c.lon, path: `${key}.lat_lon` },
          { lat: c.lat, lon: c.lng, path: `${key}.lat_lng` }
        );
      }
    }

    for (const c of candidates) {
      const lat = normalizeNumber(c.lat);
      const lon = normalizeNumber(c.lon);
      if (coordinateIsValid(lat, lon)) {
        return {
          lat,
          lon,
          latitude: lat,
          longitude: lon,
          path: c.path
        };
      }
    }

    return null;
  }

  function extractTimestamp(record) {
    if (!record || typeof record !== "object") return null;

    const candidates = [
      record.observedAt,
      record.timestamp,
      record.time,
      record.updatedAt,
      record.createdAt,
      record.lastObservedAt,
      record.detectedAt,
      record.currentCoordinate && record.currentCoordinate.timestamp,
      record.coordinate && record.coordinate.timestamp,
      record.location && record.location.timestamp,
      record.position && record.position.timestamp
    ];

    for (const value of candidates) {
      const ts = normalizeTimestamp(value);
      if (ts != null) return ts;
    }

    return null;
  }

  function extractIdentity(record) {
    if (!record || typeof record !== "object") return null;

    const candidates = [
      record.persistentId,
      record.canonicalTrackId,
      record.trackId,
      record.stormId,
      record.cellId,
      record.entityId,
      record.id
    ];

    for (const value of candidates) {
      if (typeof value === "string" && value.trim()) return value.trim();
      if (typeof value === "number" && Number.isFinite(value)) return String(value);
    }

    return null;
  }

  function looksLikeCityReference(record) {
    if (!record || typeof record !== "object") return false;

    const identity = extractIdentity(record);
    const city = record.city || record.cityName || record.name || record.label;
    const source = String(record.source || "").toLowerCase();

    const hasStormSignals =
      record.intensity != null ||
      record.reflectivity != null ||
      record.dbz != null ||
      record.rainRate != null ||
      record.velocity != null ||
      record.motion != null ||
      record.direction != null ||
      record.bearing != null ||
      record.speed != null ||
      record.cellId != null ||
      record.stormId != null;

    const citySource =
      source.includes("city") ||
      source.includes("registry") ||
      source.includes("reference");

    const identityLooksCity =
      typeof identity === "string" &&
      !identity.startsWith("RST-") &&
      !identity.startsWith("SOURCE-") &&
      !identity.startsWith("STORM-") &&
      !identity.startsWith("CELL-");

    return Boolean(
      !hasStormSignals &&
      (citySource || (city && identityLooksCity))
    );
  }

  function buildDedupeKey(record, coord, ts) {
    const identity = extractIdentity(record) || "NO_ID";

    const lat = Number(coord.lat).toFixed(CONFIG.coordinatePrecision);
    const lon = Number(coord.lon).toFixed(CONFIG.coordinatePrecision);

    const bucket =
      ts != null
        ? Math.floor(ts / CONFIG.timestampBucketMs)
        : "NO_TIME";

    return `${identity}|${lat}|${lon}|${bucket}`;
  }

  function purgeExpiredRecentKeys(now) {
    const expireBefore = now - CONFIG.dedupeWindowMs;
    for (const [key, seenAt] of state.recentKeys.entries()) {
      if (seenAt < expireBefore) {
        state.recentKeys.delete(key);
      }
    }
  }

  function classifyRecord(record, now) {
    if (!record || typeof record !== "object") {
      return { accepted: false, reason: "INVALID_RECORD" };
    }

    if (CONFIG.rejectCityReferenceOnly && looksLikeCityReference(record)) {
      return { accepted: false, reason: "CITY_REFERENCE_ONLY" };
    }

    const coord = extractCoordinate(record);

    if (!coord) {
      return {
        accepted: false,
        reason: "NO_VALID_COORDINATE"
      };
    }

    const ts = extractTimestamp(record);

    if (CONFIG.requireTimestamp && ts == null) {
      return {
        accepted: false,
        reason: "NO_VALID_TIMESTAMP",
        coordinate: coord
      };
    }

    if (
      ts != null &&
      CONFIG.maxObservationAgeMs > 0 &&
      now - ts > CONFIG.maxObservationAgeMs
    ) {
      return {
        accepted: false,
        reason: "STALE_OBSERVATION",
        coordinate: coord,
        timestamp: ts
      };
    }

    const key = buildDedupeKey(record, coord, ts);

    if (state.recentKeys.has(key)) {
      return {
        accepted: false,
        reason: "DUPLICATE_OBSERVATION",
        coordinate: coord,
        timestamp: ts,
        dedupeKey: key
      };
    }

    return {
      accepted: true,
      reason: "STORM_OBSERVATION_ACCEPTED",
      coordinate: coord,
      timestamp: ts,
      dedupeKey: key
    };
  }

  function normalizeAcceptedRecord(record, classified, sourceIndex) {
    const coord = classified.coordinate;
    const ts = classified.timestamp;

    return {
      ...record,

      persistentId: record.persistentId ?? extractIdentity(record),
      canonicalTrackId: record.canonicalTrackId ?? record.trackId ?? extractIdentity(record),
      trackId: record.trackId ?? extractIdentity(record),

      latitude: coord.latitude,
      longitude: coord.longitude,
      lat: coord.lat,
      lon: coord.lon,
      lng: coord.lon,

      timestamp: ts,
      observedAt: ts,

      currentCoordinate: {
        ...(record.currentCoordinate || {}),
        lat: coord.lat,
        lon: coord.lon,
        lng: coord.lon,
        latitude: coord.latitude,
        longitude: coord.longitude,
        timestamp: ts,
        source: record.currentCoordinate?.source || record.source || BUILD
      },

      _stormObservationGate: {
        phase: PHASE,
        version: VERSION,
        accepted: true,
        reason: classified.reason,
        coordinatePath: coord.path,
        sourceIndex
      }
    };
  }

  function discoverInputRecords(explicitInput) {
    if (Array.isArray(explicitInput)) {
      return {
        records: explicitInput,
        source: "explicitInput"
      };
    }

    const candidates = [
      ["RainGuardPersistentIdentityMotionRecordsV39", global.RainGuardPersistentIdentityMotionRecordsV39],
      ["RainGuardPersistentStormIdentitiesV39", global.RainGuardPersistentStormIdentitiesV39],
      ["RainArrivalLiveStormEntities", global.RainArrivalLiveStormEntities],
      ["RainArrivalStableStormEntities", global.RainArrivalStableStormEntities],
      ["RainArrivalLiveStormEntitiesV39", global.RainArrivalLiveStormEntitiesV39],
      ["RainGuardMatchedStormArrivalCandidatesV39", global.RainGuardMatchedStormArrivalCandidatesV39]
    ];

    for (const [name, value] of candidates) {
      if (Array.isArray(value) && value.length) {
        return { records: value, source: name };
      }
    }

    return {
      records: [],
      source: null
    };
  }

  async function runRainGuardStormObservationGateV39(options = {}) {
    if (state.runInProgress) {
      return {
        success: true,
        phase: PHASE,
        version: VERSION,
        build: BUILD,
        status: "STORM_OBSERVATION_GATE_SKIPPED_ALREADY_RUNNING",
        skipped: true,
        lastResult: state.lastResult
      };
    }

    state.runInProgress = true;
    state.running = true;
    state.lastError = null;

    const startedAt = Date.now();

    try {
      purgeExpiredRecentKeys(startedAt);

      const discovered = discoverInputRecords(options.records);
      const sourceRecords = discovered.records || [];
      const boundedInput = sourceRecords.slice(0, CONFIG.maxInputRecords);

      const accepted = [];
      const rejected = [];

      const rejectionCounts = {
        INVALID_RECORD: 0,
        CITY_REFERENCE_ONLY: 0,
        NO_VALID_COORDINATE: 0,
        NO_VALID_TIMESTAMP: 0,
        STALE_OBSERVATION: 0,
        DUPLICATE_OBSERVATION: 0,
        OUTPUT_LIMIT_REACHED: 0
      };

      for (let i = 0; i < boundedInput.length; i++) {
        const record = boundedInput[i];
        const result = classifyRecord(record, startedAt);

        if (!result.accepted) {
          rejectionCounts[result.reason] =
            (rejectionCounts[result.reason] || 0) + 1;

          rejected.push({
            index: i,
            reason: result.reason,
            id: extractIdentity(record),
            source: record && record.source ? record.source : null
          });

          if (result.reason === "DUPLICATE_OBSERVATION") {
            state.totalDuplicates++;
          }

          continue;
        }

        if (accepted.length >= CONFIG.maxOutputRecords) {
          rejectionCounts.OUTPUT_LIMIT_REACHED++;
          continue;
        }

        state.recentKeys.set(result.dedupeKey, startedAt);

        accepted.push(
          normalizeAcceptedRecord(record, result, i)
        );
      }

      global.RainGuardStormObservationGateV39 = accepted;
      global.RainGuardStormObservationRejectedV39 = rejected;
      global.RainGuardMotionEligibleObservationsV39 = accepted;

      const result = {
        success: true,
        phase: PHASE,
        version: VERSION,
        build: BUILD,
        status:
          accepted.length > 0
            ? "STORM_OBSERVATIONS_READY"
            : "NO_MOTION_ELIGIBLE_STORM_OBSERVATIONS",
        source: discovered.source,
        inputCount: sourceRecords.length,
        scannedCount: boundedInput.length,
        acceptedCount: accepted.length,
        rejectedCount: rejected.length,
        duplicateCount: rejectionCounts.DUPLICATE_OBSERVATION,
        rejectionCounts,
        output: accepted,
        rejectedSample: rejected.slice(0, 20),
        durationMs: Date.now() - startedAt,
        generatedAt: Date.now()
      };

      state.totalRuns++;
      state.totalInput += boundedInput.length;
      state.totalAccepted += accepted.length;
      state.totalRejected += rejected.length;
      state.lastRunAt = Date.now();
      state.lastResult = result;

      if (CONFIG.logToConsole && global.console) {
        console.log(
          "[RainGuard Phase 39A-15F4] Storm Observation Gate result:",
          result
        );
      }

      return result;
    } catch (error) {
      state.lastError = error;

      const result = {
        success: false,
        phase: PHASE,
        version: VERSION,
        build: BUILD,
        status: "STORM_OBSERVATION_GATE_ERROR",
        error: error && error.message ? error.message : String(error),
        generatedAt: Date.now()
      };

      state.lastResult = result;

      if (global.console) {
        console.error(
          "[RainGuard Phase 39A-15F4] Storm Observation Gate error:",
          error
        );
      }

      return result;
    } finally {
      state.runInProgress = false;
      state.running = false;
    }
  }

  function diagnoseRainGuardStormObservationGateV39() {
    return {
      phase: PHASE,
      version: VERSION,
      build: BUILD,
      installed: state.installed,
      running: state.running,
      runInProgress: state.runInProgress,
      lastError: state.lastError,
      lastRunAt: state.lastRunAt,
      lastResult: state.lastResult,
      totals: {
        runs: state.totalRuns,
        input: state.totalInput,
        accepted: state.totalAccepted,
        rejected: state.totalRejected,
        duplicates: state.totalDuplicates
      },
      currentOutputCount: Array.isArray(global.RainGuardStormObservationGateV39)
        ? global.RainGuardStormObservationGateV39.length
        : 0,
      currentRejectedCount: Array.isArray(global.RainGuardStormObservationRejectedV39)
        ? global.RainGuardStormObservationRejectedV39.length
        : 0,
      recentDedupeKeys: state.recentKeys.size,
      config: { ...CONFIG }
    };
  }

  function getRainGuardStormObservationGateRecordsV39() {
    return Array.isArray(global.RainGuardStormObservationGateV39)
      ? global.RainGuardStormObservationGateV39
      : [];
  }

  function getRainGuardMotionEligibleObservationsV39() {
    return Array.isArray(global.RainGuardMotionEligibleObservationsV39)
      ? global.RainGuardMotionEligibleObservationsV39
      : [];
  }

  function resetRainGuardStormObservationGateV39() {
    state.recentKeys.clear();
    state.lastError = null;
    state.lastRunAt = null;
    state.lastResult = null;

    global.RainGuardStormObservationGateV39 = [];
    global.RainGuardStormObservationRejectedV39 = [];
    global.RainGuardMotionEligibleObservationsV39 = [];

    return {
      success: true,
      phase: PHASE,
      version: VERSION,
      build: BUILD,
      status: "STORM_OBSERVATION_GATE_RESET"
    };
  }

  global.runRainGuardStormObservationGateV39 =
    runRainGuardStormObservationGateV39;

  global.diagnoseRainGuardStormObservationGateV39 =
    diagnoseRainGuardStormObservationGateV39;

  global.getRainGuardStormObservationGateRecordsV39 =
    getRainGuardStormObservationGateRecordsV39;

  global.getRainGuardMotionEligibleObservationsV39 =
    getRainGuardMotionEligibleObservationsV39;

  global.resetRainGuardStormObservationGateV39 =
    resetRainGuardStormObservationGateV39;

  global.__rainGuardStormObservationGateV39 = {
    phase: PHASE,
    version: VERSION,
    build: BUILD,
    config: CONFIG,
    state
  };

  if (!Array.isArray(global.RainGuardStormObservationGateV39)) {
    global.RainGuardStormObservationGateV39 = [];
  }

  if (!Array.isArray(global.RainGuardStormObservationRejectedV39)) {
    global.RainGuardStormObservationRejectedV39 = [];
  }

  if (!Array.isArray(global.RainGuardMotionEligibleObservationsV39)) {
    global.RainGuardMotionEligibleObservationsV39 = [];
  }

  if (CONFIG.logToConsole && global.console) {
    console.log(
      `[RainGuard Phase ${PHASE}] Storm Observation Gate installed`,
      {
        phase: PHASE,
        version: VERSION,
        build: BUILD
      }
    );
  }
})(window);
