/**
 * RainGuard AI
 * Phase 39A-15F2
 * Persistent Temporal Identity Reconciliation Bridge
 *
 * Purpose:
 * - Reconcile storm observations across time.
 * - Group spatially-close, temporally-sequential observations.
 * - Build stable persistent identities with multiple points.
 * - Feed Phase 39A-15F Persistent Motion Vector Builder.
 *
 * Safety:
 * - Never fabricate coordinates.
 * - Never invent timestamps.
 * - Never merge distant observations aggressively.
 * - Preserve original source references.
 */

(function installRainGuardPersistentTemporalIdentityReconciliationBridge(global) {
  "use strict";

  const PHASE = "39A-15F2";
  const VERSION = "39A.15F2.0";
  const BUILD = "rainguard-v39-persistent-temporal-identity-reconciliation-bridge";

  const CONFIG = {
    maxDistanceKm: 80,
    maxDeltaMinutes: 90,
    minDeltaSeconds: 3,

    // Avoid accidental linking of nearly simultaneous unrelated entities.
    sameTimeDistanceKm: 15,

    // A track needs at least this many observations before it becomes
    // useful to the downstream motion-vector builder.
    minPointsForMotion: 2,

    // Maximum records to process in one reconciliation cycle.
    maxRecords: 8000
  };

  const state = {
    installed: true,
    running: false,
    runInProgress: false,
    createdAt: Date.now(),
    updatedAt: null,
    lastError: null,
    lastResult: null,
    statistics: {
      runs: 0,
      skippedRuns: 0,
      sourceRecords: 0,
      normalizedRecords: 0,
      rejectedRecords: 0,
      reconciledRecords: 0,
      identityCount: 0,
      identitiesWithMultiplePoints: 0,
      temporalLinksCreated: 0
    }
  };

  function finiteNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function getCoordinate(record) {
    if (!record || typeof record !== "object") {
      return null;
    }

    const candidates = [
      record.currentCoordinate,
      record.coordinate,
      record.coordinates,
      record.location,
      record.position,
      record.point,
      record.lastCoordinate,
      record.latestCoordinate,
      record
    ];

    for (const candidate of candidates) {
      if (!candidate || typeof candidate !== "object") {
        continue;
      }

      const lat =
        finiteNumber(candidate.lat) ??
        finiteNumber(candidate.latitude);

      const lon =
        finiteNumber(candidate.lon) ??
        finiteNumber(candidate.lng) ??
        finiteNumber(candidate.longitude);

      if (
        lat !== null &&
        lon !== null &&
        lat >= -90 &&
        lat <= 90 &&
        lon >= -180 &&
        lon <= 180 &&
        !(lat === 0 && lon === 0)
      ) {
        return { lat, lon };
      }
    }

    return null;
  }

  function getTimestamp(record) {
    if (!record || typeof record !== "object") {
      return null;
    }

    const values = [
      record.observedAt,
      record.timestamp,
      record.time,
      record.updatedAt,
      record.createdAt,
      record.lastObservedAt,
      record.firstSeenAt,
      record.lastSeenAt,
      record.currentCoordinate?.timestamp,
      record.coordinate?.timestamp,
      record.location?.timestamp
    ];

    for (const value of values) {
      if (value === null || value === undefined) {
        continue;
      }

      if (typeof value === "number" && Number.isFinite(value)) {
        if (value > 1e12) {
          return value;
        }

        if (value > 1e9) {
          return value * 1000;
        }
      }

      const parsed = Date.parse(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }

    return null;
  }

  function getRawIdentity(record) {
    if (!record || typeof record !== "object") {
      return null;
    }

    const values = [
      record.persistentId,
      record.canonicalTrackId,
      record.trackId,
      record.stableTrackId,
      record.cellId,
      record.entityId,
      record.id
    ];

    for (const value of values) {
      if (
        typeof value === "string" &&
        value.trim() &&
        value.trim().length <= 250
      ) {
        return value.trim();
      }
    }

    return null;
  }

  function getSource(record) {
    if (!record || typeof record !== "object") {
      return "unknown";
    }

    return (
      record.source ||
      record.sourceName ||
      record.origin ||
      record.provider ||
      record.currentCoordinate?.source ||
      "unknown"
    );
  }

  function haversineKm(a, b) {
    const R = 6371;

    const toRad = deg => deg * Math.PI / 180;

    const dLat = toRad(b.lat - a.lat);
    const dLon = toRad(b.lon - a.lon);

    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);

    const sinLat = Math.sin(dLat / 2);
    const sinLon = Math.sin(dLon / 2);

    const h =
      sinLat * sinLat +
      Math.cos(lat1) *
        Math.cos(lat2) *
        sinLon *
        sinLon;

    return 2 * R * Math.asin(Math.sqrt(h));
  }

  function normalizeRecord(record, sourceName, index) {
    const coordinate = getCoordinate(record);
    const timestamp = getTimestamp(record);

    if (!coordinate || timestamp === null) {
      return null;
    }

    return {
      id: getRawIdentity(record),
      rawIdentity: getRawIdentity(record),
      lat: coordinate.lat,
      lon: coordinate.lon,
      timestamp,
      source: sourceName || getSource(record),
      confidence:
        finiteNumber(record.confidence) ??
        finiteNumber(record.currentCoordinate?.confidence),
      intensity:
        finiteNumber(record.intensity) ??
        finiteNumber(record.currentCoordinate?.intensity),
      originalIndex: index,
      original: record
    };
  }

  function pushArrayFrom(value, output, sourceName) {
    if (!value) {
      return;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        output.push({
          record: item,
          sourceName
        });
      }
      return;
    }

    if (value instanceof Map) {
      for (const [key, item] of value.entries()) {
        if (Array.isArray(item)) {
          for (const child of item) {
            output.push({
              record: child,
              sourceName: `${sourceName}.map:${key}`
            });
          }
        } else if (item && typeof item === "object") {
          output.push({
            record: item,
            sourceName: `${sourceName}.map:${key}`
          });
        }
      }
      return;
    }

    if (typeof value === "object") {
      for (const [key, item] of Object.entries(value)) {
        if (Array.isArray(item)) {
          for (const child of item) {
            output.push({
              record: child,
              sourceName: `${sourceName}.${key}`
            });
          }
        }
      }
    }
  }

  function collectSourceRecords() {
    const output = [];

    const sources = [
      ["RainGuardPersistentIdentityNestedCoordinatesV39", global.RainGuardPersistentIdentityNestedCoordinatesV39],
      ["RainGuardPersistentStormIdentitiesV39", global.RainGuardPersistentStormIdentitiesV39],
      ["RainArrivalLiveStormEntities", global.RainArrivalLiveStormEntities],
      ["RainArrivalStableStormEntities", global.RainArrivalStableStormEntities],
      ["RainArrivalTrackStoreV32.tracks", global.RainArrivalTrackStoreV32?.tracks],
      ["RainArrivalLiveTrackHistory", global.RainArrivalLiveTrackHistory],
      ["RainArrivalLiveTrackHistoryV32", global.RainArrivalLiveTrackHistoryV32]
    ];

    for (const [name, value] of sources) {
      pushArrayFrom(value, output, name);
    }

    return output.slice(-CONFIG.maxRecords);
  }

  function sameRawIdentity(a, b) {
    return Boolean(
      a.rawIdentity &&
      b.rawIdentity &&
      a.rawIdentity === b.rawIdentity
    );
  }

  function canLink(a, b) {
    if (!a || !b) {
      return false;
    }

    const deltaMs = b.timestamp - a.timestamp;

    if (deltaMs <= 0) {
      return false;
    }

    const deltaSeconds = deltaMs / 1000;
    const deltaMinutes = deltaSeconds / 60;

    if (deltaSeconds < CONFIG.minDeltaSeconds) {
      return false;
    }

    if (deltaMinutes > CONFIG.maxDeltaMinutes) {
      return false;
    }

    const distanceKm = haversineKm(a, b);

    if (!Number.isFinite(distanceKm)) {
      return false;
    }

    if (sameRawIdentity(a, b)) {
      return distanceKm <= CONFIG.maxDistanceKm * 1.5;
    }

    if (deltaMinutes <= 2) {
      return distanceKm <= CONFIG.sameTimeDistanceKm;
    }

    return distanceKm <= CONFIG.maxDistanceKm;
  }

  function calculateCandidateScore(previous, current) {
    const distanceKm = haversineKm(previous, current);
    const deltaMinutes =
      (current.timestamp - previous.timestamp) / 60000;

    if (
      !Number.isFinite(distanceKm) ||
      !Number.isFinite(deltaMinutes) ||
      deltaMinutes <= 0
    ) {
      return Infinity;
    }

    let score = distanceKm;

    score += deltaMinutes * 0.18;

    if (sameRawIdentity(previous, current)) {
      score -= 25;
    }

    if (
      previous.source &&
      current.source &&
      previous.source === current.source
    ) {
      score -= 2;
    }

    return score;
  }

  function createIdentity(index, observation) {
    return {
      persistentId: `RG-TEMP-${observation.timestamp}-${index}`,
      canonicalTrackId: observation.rawIdentity || null,
      aliases: observation.rawIdentity
        ? [observation.rawIdentity]
        : [],
      status: "ACTIVE",
      source: PHASE,
      createdAt: observation.timestamp,
      updatedAt: observation.timestamp,
      firstObservedAt: observation.timestamp,
      lastObservedAt: observation.timestamp,
      observationCount: 1,
      confidence: observation.confidence,
      observations: [observation],
      currentCoordinate: {
        lat: observation.lat,
        lon: observation.lon,
        latitude: observation.lat,
        longitude: observation.lon,
        timestamp: observation.timestamp,
        source: observation.source,
        confidence: observation.confidence,
        intensity: observation.intensity
      }
    };
  }

  function appendObservation(identity, observation) {
    identity.observations.push(observation);

    identity.observationCount = identity.observations.length;
    identity.updatedAt = observation.timestamp;
    identity.lastObservedAt = observation.timestamp;

    identity.currentCoordinate = {
      lat: observation.lat,
      lon: observation.lon,
      latitude: observation.lat,
      longitude: observation.lon,
      timestamp: observation.timestamp,
      source: observation.source,
      confidence: observation.confidence,
      intensity: observation.intensity
    };

    if (
      observation.rawIdentity &&
      !identity.aliases.includes(observation.rawIdentity)
    ) {
      identity.aliases.push(observation.rawIdentity);
    }

    if (
      !identity.canonicalTrackId &&
      observation.rawIdentity
    ) {
      identity.canonicalTrackId = observation.rawIdentity;
    }
  }

  function reconcile(records) {
    const identities = [];
    let temporalLinksCreated = 0;

    for (const current of records) {
      let bestIdentity = null;
      let bestScore = Infinity;

      for (const identity of identities) {
        const previous =
          identity.observations[
            identity.observations.length - 1
          ];

        if (!canLink(previous, current)) {
          continue;
        }

        const score =
          calculateCandidateScore(previous, current);

        if (score < bestScore) {
          bestScore = score;
          bestIdentity = identity;
        }
      }

      if (bestIdentity) {
        appendObservation(bestIdentity, current);
        temporalLinksCreated += 1;
      } else {
        identities.push(
          createIdentity(identities.length + 1, current)
        );
      }
    }

    return {
      identities,
      temporalLinksCreated
    };
  }

  function publishIdentities(identities) {
    global.RainGuardTemporalReconciledIdentitiesV39 =
      identities;

    global.RainGuardPersistentStormIdentitiesV39 =
      identities;

    global.RainGuardPersistentTemporalIdentityHistoryV39 =
      identities;

    const motionReady = identities.filter(
      identity =>
        Array.isArray(identity.observations) &&
        identity.observations.length >=
          CONFIG.minPointsForMotion
    );

    global.RainGuardPersistentMotionReadyIdentitiesV39 =
      motionReady;

    return motionReady;
  }

  async function run(options = {}) {
    if (state.runInProgress) {
      state.statistics.skippedRuns += 1;

      return {
        success: true,
        phase: PHASE,
        version: VERSION,
        status: "RUN_ALREADY_IN_PROGRESS"
      };
    }

    state.runInProgress = true;
    state.running = true;
    state.lastError = null;
    state.statistics.runs += 1;

    try {
      const raw = collectSourceRecords();

      state.statistics.sourceRecords = raw.length;

      const normalized = [];
      let rejectedRecords = 0;

      for (let i = 0; i < raw.length; i += 1) {
        const item = raw[i];

        const record = normalizeRecord(
          item.record,
          item.sourceName,
          i
        );

        if (record) {
          normalized.push(record);
        } else {
          rejectedRecords += 1;
        }
      }

      normalized.sort(
        (a, b) => a.timestamp - b.timestamp
      );

      state.statistics.normalizedRecords =
        normalized.length;

      state.statistics.rejectedRecords =
        rejectedRecords;

      const reconciliation = reconcile(normalized);

      const identities = reconciliation.identities;

      const motionReady =
        publishIdentities(identities);

      state.statistics.reconciledRecords =
        normalized.length;

      state.statistics.identityCount =
        identities.length;

      state.statistics.identitiesWithMultiplePoints =
        motionReady.length;

      state.statistics.temporalLinksCreated =
        reconciliation.temporalLinksCreated;

      state.updatedAt = Date.now();

      const result = {
        success: true,
        phase: PHASE,
        version: VERSION,
        build: BUILD,

        status:
          motionReady.length > 0
            ? "TEMPORAL_IDENTITIES_RECONCILED"
            : "NO_MULTI_POINT_IDENTITIES_AFTER_RECONCILIATION",

        sourceRecordCount: raw.length,
        normalizedRecordCount: normalized.length,
        rejectedRecordCount: rejectedRecords,

        identityCount: identities.length,
        identitiesWithMultiplePoints:
          motionReady.length,

        temporalLinksCreated:
          reconciliation.temporalLinksCreated,

        motionReadyCount:
          motionReady.length,

        identities:
          identities.slice(0, 100),

        motionReadySample:
          motionReady.slice(0, 20),

        generatedAt: state.updatedAt
      };

      state.lastResult = result;

      console.log(
        `[RainGuard Phase ${PHASE}] Temporal Identity Reconciliation result:`,
        result
      );

      if (
        options.runMotionBuilder !== false &&
        typeof global.runRainGuardPersistentMotionVectorBuilder ===
          "function"
      ) {
        try {
          result.motionBuilderResult =
            await global.runRainGuardPersistentMotionVectorBuilder();
        } catch (error) {
          result.motionBuilderError =
            error?.message || String(error);
        }
      }

      return result;
    } catch (error) {
      state.lastError =
        error?.stack ||
        error?.message ||
        String(error);

      const result = {
        success: false,
        phase: PHASE,
        version: VERSION,
        build: BUILD,
        status: "TEMPORAL_IDENTITY_RECONCILIATION_FAILED",
        error: state.lastError
      };

      state.lastResult = result;

      console.error(
        `[RainGuard Phase ${PHASE}] Failed:`,
        error
      );

      return result;
    } finally {
      state.runInProgress = false;
      state.running = false;
    }
  }

  function diagnose() {
    const report = {
      phase: PHASE,
      version: VERSION,
      build: BUILD,
      installed: true,
      running: state.running,
      runInProgress: state.runInProgress,
      createdAt: state.createdAt,
      updatedAt: state.updatedAt,
      lastError: state.lastError,
      statistics: {
        ...state.statistics
      },
      temporalIdentities:
        global.RainGuardTemporalReconciledIdentitiesV39
          ?.length || 0,
      motionReadyIdentities:
        global.RainGuardPersistentMotionReadyIdentitiesV39
          ?.length || 0,
      lastResult: state.lastResult
    };

    console.log(
      `[RainGuard Phase ${PHASE}] Diagnostics:`,
      report
    );

    return report;
  }

  global.RainGuardPersistentTemporalIdentityReconciliationBridge =
    {
      phase: PHASE,
      version: VERSION,
      build: BUILD,
      config: CONFIG,
      state,
      run,
      diagnose
    };

  global.runRainGuardPersistentTemporalIdentityReconciliation =
    run;

  global.diagnoseRainGuardPersistentTemporalIdentityReconciliation =
    diagnose;

  console.log(
    `[RainGuard Phase ${PHASE}] Persistent Temporal Identity Reconciliation Bridge installed.`
  );

})(window);
