from pathlib import Path

code = r'''/**
 * RainGuard AI
 * Phase 39A-15F — Persistent Motion Vector Builder
 * File: persistent_motion_vector_builder_39a15f.js
 *
 * Purpose:
 *  - Build real storm motion vectors only from sequential observations
 *    belonging to the same persistent identity.
 *  - Reject zero-distance, invalid-coordinate, invalid-time, and jump vectors.
 *  - Publish vectors for Phase 39A-14 Arrival ETA Adapter.
 *
 * Safety principles:
 *  - Never invent motion.
 *  - Never calculate motion from two different identities.
 *  - Never treat repeated coordinates as movement.
 */

(function installRainGuardPersistentMotionVectorBuilder(global) {
  "use strict";

  const PHASE = "39A-15F";
  const VERSION = "39A.15F.0";
  const BUILD = "rainguard-v39-persistent-motion-vector-builder";

  const CONFIG = {
    minDeltaTimeMs: 5 * 1000,          // 5 seconds
    maxDeltaTimeMs: 6 * 60 * 60 * 1000, // 6 hours
    minDistanceKm: 0.05,               // 50 m
    maxDistanceKm: 500,
    minSpeedKmh: 0.2,
    maxSpeedKmh: 250,
    maxVectorsPerIdentity: 30,
    maxPublishedVectors: 5000
  };

  const state = {
    installed: true,
    running: false,
    runInProgress: false,
    lastError: null,
    lastResult: null,
    vectors: [],
    vectorsByIdentity: new Map(),
    statistics: {
      runs: 0,
      skippedRuns: 0,
      identitiesScanned: 0,
      observationsScanned: 0,
      candidatePairs: 0,
      vectorCount: 0,
      rejectedInvalidCoordinate: 0,
      rejectedInvalidTimestamp: 0,
      rejectedNonSequential: 0,
      rejectedZeroDistance: 0,
      rejectedDistanceJump: 0,
      rejectedSpeed: 0,
      rejectedIdentityMismatch: 0
    }
  };

  function finiteNumber(value) {
    if (value === null || value === undefined || value === "") return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function normalizeTimestamp(value) {
    if (value === null || value === undefined || value === "") return null;

    if (value instanceof Date) {
      const t = value.getTime();
      return Number.isFinite(t) ? t : null;
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      // seconds -> milliseconds
      if (value > 0 && value < 1e12) return Math.round(value * 1000);
      return Math.round(value);
    }

    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) return null;

      const numeric = Number(trimmed);
      if (Number.isFinite(numeric)) {
        if (numeric > 0 && numeric < 1e12) return Math.round(numeric * 1000);
        return Math.round(numeric);
      }

      const parsed = Date.parse(trimmed);
      return Number.isFinite(parsed) ? parsed : null;
    }

    return null;
  }

  function readCoordinate(record) {
    if (!record || typeof record !== "object") return null;

    const candidates = [
      record,
      record.currentCoordinate,
      record.coordinate,
      record.coordinates,
      record.location,
      record.position,
      record.point,
      record.centroid,
      record.center,
      record.geometry && record.geometry.coordinates
    ];

    for (const c of candidates) {
      if (!c) continue;

      if (Array.isArray(c) && c.length >= 2) {
        // GeoJSON commonly stores [lon, lat]
        const lon = finiteNumber(c[0]);
        const lat = finiteNumber(c[1]);
        if (isValidCoordinate(lat, lon)) return { lat, lon };
      }

      if (typeof c === "object") {
        const lat = finiteNumber(
          c.lat ?? c.latitude ?? c.y ?? c.Latitude ?? c.LAT
        );
        const lon = finiteNumber(
          c.lon ?? c.lng ?? c.longitude ?? c.x ?? c.Longitude ?? c.LON
        );

        if (isValidCoordinate(lat, lon)) return { lat, lon };
      }
    }

    return null;
  }

  function isValidCoordinate(lat, lon) {
    return Number.isFinite(lat) &&
           Number.isFinite(lon) &&
           lat >= -90 && lat <= 90 &&
           lon >= -180 && lon <= 180 &&
           !(lat === 0 && lon === 0);
  }

  function readTimestamp(record) {
    if (!record || typeof record !== "object") return null;

    const candidates = [
      record.observedAt,
      record.timestamp,
      record.time,
      record.updatedAt,
      record.createdAt,
      record.lastSeenAt,
      record.firstSeenAt,
      record.currentCoordinate && record.currentCoordinate.timestamp,
      record.coordinate && record.coordinate.timestamp,
      record.location && record.location.timestamp,
      record.point && record.point.timestamp
    ];

    for (const value of candidates) {
      const t = normalizeTimestamp(value);
      if (t !== null) return t;
    }

    return null;
  }

  function readIdentity(record, fallbackIdentity = null) {
    if (!record || typeof record !== "object") return fallbackIdentity;

    return (
      record.persistentId ??
      record.persistentID ??
      record.identityId ??
      record.identityID ??
      record.canonicalTrackId ??
      record.trackId ??
      record.trackID ??
      record.cellId ??
      record.cellID ??
      record.id ??
      fallbackIdentity ??
      null
    );
  }

  function collectObservationArray(identity) {
    if (!identity || typeof identity !== "object") return [];

    const arrays = [
      identity.observations,
      identity.history,
      identity.points,
      identity.records,
      identity.trackHistory,
      identity.motionHistory,
      identity.samples,
      identity.positions
    ];

    for (const arr of arrays) {
      if (Array.isArray(arr) && arr.length) return arr;
    }

    return [];
  }

  function normalizeObservation(record, identityId, sourceName, index) {
    if (!record || typeof record !== "object") return null;

    const coordinate = readCoordinate(record);
    if (!coordinate) {
      state.statistics.rejectedInvalidCoordinate++;
      return null;
    }

    const timestamp = readTimestamp(record);
    if (timestamp === null) {
      state.statistics.rejectedInvalidTimestamp++;
      return null;
    }

    const recordIdentity = readIdentity(record, identityId);
    const normalizedIdentity =
      recordIdentity !== null && recordIdentity !== undefined
        ? String(recordIdentity)
        : String(identityId ?? "");

    if (!normalizedIdentity) return null;

    return {
      identityId: normalizedIdentity,
      lat: coordinate.lat,
      lon: coordinate.lon,
      timestamp,
      observedAt: timestamp,
      intensity: finiteNumber(record.intensity),
      confidence: finiteNumber(record.confidence),
      source: record.source || sourceName || "unknown",
      sourceIndex: index,
      raw: record
    };
  }

  function normalizeIdentities(input, sourceName) {
    const out = [];

    if (!input) return out;

    if (input instanceof Map) {
      for (const [key, value] of input.entries()) {
        if (value && typeof value === "object") {
          out.push({ key, value, sourceName });
        }
      }
      return out;
    }

    if (Array.isArray(input)) {
      input.forEach((value, index) => {
        if (value && typeof value === "object") {
          out.push({
            key: readIdentity(value, `identity-${index}`),
            value,
            sourceName
          });
        }
      });
      return out;
    }

    if (typeof input === "object") {
      for (const [key, value] of Object.entries(input)) {
        if (value && typeof value === "object") {
          out.push({ key, value, sourceName });
        }
      }
    }

    return out;
  }

  function gatherIdentitySources() {
    const sources = [];

    const candidates = [
      ["RainGuardPersistentStormIdentitiesV39", global.RainGuardPersistentStormIdentitiesV39],
      ["RainGuardPersistentStormIdentities", global.RainGuardPersistentStormIdentities],
      ["RainGuardPersistentIdentityHistoryV39", global.RainGuardPersistentIdentityHistoryV39],
      ["RainGuardPersistentIdentityMotionHistoryV39", global.RainGuardPersistentIdentityMotionHistoryV39]
    ];

    for (const [name, value] of candidates) {
      if (value) sources.push({ name, value });
    }

    // Optional output from 39A-15E / 39A-15E1
    const bridgeCandidates = [
      global.RainGuardPersistentIdentityMotionHistoryBridge,
      global.RainGuardPersistentIdentityNestedCoordinateBridge
    ];

    bridgeCandidates.forEach((bridge, i) => {
      if (!bridge || typeof bridge !== "object") return;

      const possible =
        bridge.identities ||
        bridge.history ||
        bridge.records ||
        bridge.output ||
        bridge.data;

      if (possible) {
        sources.push({
          name: i === 0
            ? "PersistentIdentityMotionHistoryBridge"
            : "PersistentIdentityNestedCoordinateBridge",
          value: possible
        });
      }
    });

    return sources;
  }

  function extractIdentityGroups() {
    const sources = gatherIdentitySources();
    const groups = new Map();

    for (const source of sources) {
      const identities = normalizeIdentities(source.value, source.name);

      for (const entry of identities) {
        const identityId = String(
          readIdentity(entry.value, entry.key) || entry.key || ""
        );
        if (!identityId) continue;

        const observations = collectObservationArray(entry.value);

        if (!groups.has(identityId)) groups.set(identityId, []);

        observations.forEach((record, index) => {
          state.statistics.observationsScanned++;
          const normalized = normalizeObservation(
            record,
            identityId,
            source.name,
            index
          );
          if (normalized) groups.get(identityId).push(normalized);
        });
      }
    }

    return { groups, sources };
  }

  function toRadians(deg) {
    return deg * Math.PI / 180;
  }

  function toDegrees(rad) {
    return rad * 180 / Math.PI;
  }

  function haversineKm(a, b) {
    const R = 6371.0088;

    const lat1 = toRadians(a.lat);
    const lat2 = toRadians(b.lat);
    const dLat = toRadians(b.lat - a.lat);
    const dLon = toRadians(b.lon - a.lon);

    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) *
        Math.cos(lat2) *
        Math.sin(dLon / 2) ** 2;

    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  function bearingDegrees(a, b) {
    const lat1 = toRadians(a.lat);
    const lat2 = toRadians(b.lat);
    const dLon = toRadians(b.lon - a.lon);

    const y = Math.sin(dLon) * Math.cos(lat2);
    const x =
      Math.cos(lat1) * Math.sin(lat2) -
      Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

    return (toDegrees(Math.atan2(y, x)) + 360) % 360;
  }

  function bearingToCardinal(bearing) {
    const dirs = [
      "N", "NNE", "NE", "ENE",
      "E", "ESE", "SE", "SSE",
      "S", "SSW", "SW", "WSW",
      "W", "WNW", "NW", "NNW"
    ];

    return dirs[Math.round(bearing / 22.5) % 16];
  }

  function buildVector(previous, current) {
    if (previous.identityId !== current.identityId) {
      state.statistics.rejectedIdentityMismatch++;
      return null;
    }

    const dtMs = current.timestamp - previous.timestamp;

    if (dtMs <= 0) {
      state.statistics.rejectedNonSequential++;
      return null;
    }

    if (dtMs < CONFIG.minDeltaTimeMs || dtMs > CONFIG.maxDeltaTimeMs) {
      state.statistics.rejectedInvalidTimestamp++;
      return null;
    }

    const distanceKm = haversineKm(previous, current);

    if (!Number.isFinite(distanceKm) || distanceKm < CONFIG.minDistanceKm) {
      state.statistics.rejectedZeroDistance++;
      return null;
    }

    if (distanceKm > CONFIG.maxDistanceKm) {
      state.statistics.rejectedDistanceJump++;
      return null;
    }

    const deltaHours = dtMs / 3600000;
    const speedKmh = distanceKm / deltaHours;

    if (
      !Number.isFinite(speedKmh) ||
      speedKmh < CONFIG.minSpeedKmh ||
      speedKmh > CONFIG.maxSpeedKmh
    ) {
      state.statistics.rejectedSpeed++;
      return null;
    }

    const bearing = bearingDegrees(previous, current);

    return {
      id: `MV-${previous.identityId}-${previous.timestamp}-${current.timestamp}`,
      identityId: previous.identityId,
      persistentId: previous.identityId,
      trackId: previous.identityId,

      from: {
        lat: previous.lat,
        lon: previous.lon,
        timestamp: previous.timestamp
      },

      to: {
        lat: current.lat,
        lon: current.lon,
        timestamp: current.timestamp
      },

      deltaLat: current.lat - previous.lat,
      deltaLon: current.lon - previous.lon,
      deltaTimeMs: dtMs,
      deltaTimeSeconds: dtMs / 1000,
      deltaTimeMinutes: dtMs / 60000,

      distanceKm,
      speedKmh,
      speedMps: speedKmh / 3.6,
      bearing,
      direction: bearingToCardinal(bearing),

      confidence: Math.min(
        1,
        Math.max(
          0.05,
          Number.isFinite(current.confidence)
            ? current.confidence
            : Number.isFinite(previous.confidence)
              ? previous.confidence
              : 0.65
        )
      ),

      source: "PersistentMotionVectorBuilder39A15F",
      sourceObservations: [previous.source, current.source],
      generatedAt: Date.now(),
      phase: PHASE,
      version: VERSION
    };
  }

  function dedupeObservations(observations) {
    const seen = new Set();
    const out = [];

    for (const obs of observations) {
      const key = [
        obs.identityId,
        obs.timestamp,
        obs.lat.toFixed(6),
        obs.lon.toFixed(6)
      ].join("|");

      if (seen.has(key)) continue;
      seen.add(key);
      out.push(obs);
    }

    return out;
  }

  function publishVectors(vectors, vectorsByIdentity) {
    const published = vectors.slice(-CONFIG.maxPublishedVectors);

    global.RainGuardPersistentMotionVectorsV39 = published;
    global.RainGuardStormMotionVectorsV39 = published;
    global.RainGuardPersistentMotionVectorsByIdentityV39 = vectorsByIdentity;

    // Feed name intentionally compatible with later ETA stages.
    global.RainGuardArrivalEtaMotionVectorFeedV39 = published;

    try {
      global.dispatchEvent(
        new CustomEvent("rainguard:persistent-motion-vectors-ready", {
          detail: {
            phase: PHASE,
            version: VERSION,
            count: published.length,
            vectors: published
          }
        })
      );
    } catch (_) {}

    return published;
  }

  async function runPersistentMotionVectorBuilder(options = {}) {
    if (state.runInProgress && !options.force) {
      state.statistics.skippedRuns++;

      return {
        success: true,
        phase: PHASE,
        version: VERSION,
        status: "RUN_ALREADY_IN_PROGRESS",
        vectorCount: state.vectors.length
      };
    }

    state.runInProgress = true;
    state.running = true;
    state.lastError = null;
    state.statistics.runs++;

    try {
      // Reset per-run counters while keeping number of runs.
      const runs = state.statistics.runs;
      const skippedRuns = state.statistics.skippedRuns;

      state.statistics = {
        runs,
        skippedRuns,
        identitiesScanned: 0,
        observationsScanned: 0,
        candidatePairs: 0,
        vectorCount: 0,
        rejectedInvalidCoordinate: 0,
        rejectedInvalidTimestamp: 0,
        rejectedNonSequential: 0,
        rejectedZeroDistance: 0,
        rejectedDistanceJump: 0,
        rejectedSpeed: 0,
        rejectedIdentityMismatch: 0
      };

      const { groups, sources } = extractIdentityGroups();
      state.statistics.identitiesScanned = groups.size;

      const vectors = [];
      const vectorsByIdentity = new Map();

      for (const [identityId, rawObservations] of groups.entries()) {
        const observations = dedupeObservations(rawObservations)
          .sort((a, b) => a.timestamp - b.timestamp);

        if (observations.length < 2) continue;

        const identityVectors = [];

        for (let i = 1; i < observations.length; i++) {
          state.statistics.candidatePairs++;

          const vector = buildVector(
            observations[i - 1],
            observations[i]
          );

          if (!vector) continue;

          identityVectors.push(vector);
          vectors.push(vector);
        }

        if (identityVectors.length) {
          const limited = identityVectors.slice(
            -CONFIG.maxVectorsPerIdentity
          );
          vectorsByIdentity.set(identityId, limited);
        }
      }

      const published = publishVectors(vectors, vectorsByIdentity);

      state.vectors = published;
      state.vectorsByIdentity = vectorsByIdentity;
      state.statistics.vectorCount = published.length;

      const identitiesWithMotion = vectorsByIdentity.size;

      const result = {
        success: true,
        phase: PHASE,
        version: VERSION,
        build: BUILD,
        status:
          published.length > 0
            ? "PERSISTENT_MOTION_VECTORS_READY"
            : "WAITING_FOR_SEQUENTIAL_IDENTITY_MOTION",

        sourceReports: sources.map(s => ({
          name: s.name,
          available: !!s.value
        })),

        identityCount: groups.size,
        identitiesWithMotion,
        vectorCount: published.length,
        vectors: published,
        statistics: { ...state.statistics },
        generatedAt: Date.now()
      };

      state.lastResult = result;
      return result;
    } catch (error) {
      state.lastError = error;

      const result = {
        success: false,
        phase: PHASE,
        version: VERSION,
        build: BUILD,
        status: "PERSISTENT_MOTION_VECTOR_BUILD_FAILED",
        error: error && error.message ? error.message : String(error),
        generatedAt: Date.now()
      };

      state.lastResult = result;
      return result;
    } finally {
      state.runInProgress = false;
    }
  }

  function getPersistentMotionVectors() {
    return state.vectors.slice();
  }

  function getPersistentMotionVectorsByIdentity(identityId) {
    if (identityId === undefined || identityId === null) {
      return state.vectorsByIdentity;
    }

    return (
      state.vectorsByIdentity.get(String(identityId)) || []
    ).slice();
  }

  function diagnosePersistentMotionVectorBuilder() {
    return {
      phase: PHASE,
      version: VERSION,
      build: BUILD,
      installed: state.installed,
      running: state.running,
      runInProgress: state.runInProgress,
      lastError: state.lastError,
      lastResult: state.lastResult,
      vectorCount: state.vectors.length,
      identityVectorGroups: state.vectorsByIdentity.size,
      statistics: { ...state.statistics },
      config: { ...CONFIG }
    };
  }

  function stopPersistentMotionVectorBuilder() {
    state.running = false;
    return diagnosePersistentMotionVectorBuilder();
  }

  function startPersistentMotionVectorBuilder() {
    state.running = true;
    return runPersistentMotionVectorBuilder({ force: true });
  }

  global.RainGuardPersistentMotionVectorBuilderV39 = {
    phase: PHASE,
    version: VERSION,
    build: BUILD,
    config: CONFIG,
    state,
    run: runPersistentMotionVectorBuilder,
    start: startPersistentMotionVectorBuilder,
    stop: stopPersistentMotionVectorBuilder,
    getVectors: getPersistentMotionVectors,
    getVectorsByIdentity: getPersistentMotionVectorsByIdentity,
    diagnose: diagnosePersistentMotionVectorBuilder
  };

  global.runRainGuardPersistentMotionVectorBuilder =
    runPersistentMotionVectorBuilder;

  global.getRainGuardPersistentMotionVectors =
    getPersistentMotionVectors;

  global.getRainGuardPersistentMotionVectorsByIdentity =
    getPersistentMotionVectorsByIdentity;

  global.diagnoseRainGuardPersistentMotionVectorBuilder =
    diagnosePersistentMotionVectorBuilder;

  global.startRainGuardPersistentMotionVectorBuilder =
    startPersistentMotionVectorBuilder;

  global.stopRainGuardPersistentMotionVectorBuilder =
    stopPersistentMotionVectorBuilder;

  console.info(
    `[RainGuard Phase ${PHASE}] Persistent Motion Vector Builder installed`,
    {
      phase: PHASE,
      version: VERSION,
      build: BUILD,
      installed: true
    }
  );

  // Initial run after dependencies have had a chance to populate.
  setTimeout(() => {
    runPersistentMotionVectorBuilder().then(result => {
      console.info(
        `[RainGuard Phase ${PHASE}] Persistent Motion Vector Builder result:`,
        result
      );
    });
  }, 1500);

})(window);
'''

path = Path("/mnt/data/persistent_motion_vector_builder_39a15f.js")
path.write_text(code, encoding="utf-8")
print(path)
