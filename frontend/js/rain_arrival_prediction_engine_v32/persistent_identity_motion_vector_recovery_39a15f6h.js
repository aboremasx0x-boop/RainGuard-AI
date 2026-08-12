/**
 * RainGuard AI V39
 * Phase 39A-15F6H — Persistent Identity Motion Vector Recovery
 *
 * Purpose
 * -------
 * Recover real motion vectors from persistent storm identities that have
 * multiple observations across cycles.
 *
 * Inputs (discovered automatically when available)
 * -------------------------------------------------
 * - RainGuardPersistentIdentityTemporalAccumulatorV39
 * - RainGuardPersistentObservationMemoryV39
 * - RainGuardCrossCyclePersistentIdentityMatchesV39
 * - RainGuardPersistentStormIdentitiesV39
 * - RainGuardReconciledStormIdentitiesV39
 *
 * Outputs
 * -------
 * - RainGuardPersistentIdentityMotionVectorsV39
 * - RainGuardPersistentIdentityMotionVectorRecoveryLastResult
 *
 * Public API
 * ----------
 * - runRainGuardPersistentIdentityMotionVectorRecovery(options?)
 * - getRainGuardPersistentIdentityMotionVectors()
 * - diagnoseRainGuardPersistentIdentityMotionVectorRecovery()
 */

(function installRainGuardPersistentIdentityMotionVectorRecovery(global) {
  "use strict";

  const PHASE = "39A-15F6H";
  const VERSION = "39A.15F6H.0";
  const BUILD = "rainguard-v39-persistent-identity-motion-vector-recovery";

  const DEFAULT_CONFIG = Object.freeze({
    maxIdentities: 5000,
    maxObservationsPerIdentity: 32,
    minObservations: 2,

    // Temporal guards
    minDeltaSeconds: 1,
    maxDeltaMinutes: 180,

    // Spatial / physical guards
    minDistanceKm: 0.02,
    maxDistanceKm: 500,
    maxSpeedKmh: 300,

    // Recovery policy
    preferLatestPair: true,
    allowNonAdjacentFallback: true,
    keepStationaryVectors: false,

    // Coordinate tolerance
    zeroCoordinateEpsilon: 1e-9,

    // Diagnostics
    sampleLimit: 20
  });

  const STATE = {
    installed: true,
    running: false,
    runs: 0,
    lastRun: 0,
    lastError: null,
    lastResult: null,
    vectors: [],
    vectorsByIdentity: new Map(),
    config: { ...DEFAULT_CONFIG },
    statistics: {
      runs: 0,
      sourceIdentityCount: 0,
      normalizedIdentityCount: 0,
      multiPointIdentityCount: 0,
      singlePointIdentityCount: 0,
      inspectedPairCount: 0,
      acceptedPairCount: 0,
      rejectedPairCount: 0,
      motionVectorCount: 0,
      stationaryVectorCount: 0,
      validSpeedCount: 0,
      validBearingCount: 0,
      rejectedNoIdentity: 0,
      rejectedInvalidCoordinate: 0,
      rejectedInvalidTimestamp: 0,
      rejectedDeltaTime: 0,
      rejectedDistance: 0,
      rejectedSpeed: 0
    }
  };

  const ROOT_SOURCE_NAMES = Object.freeze([
    "RainGuardPersistentIdentityTemporalAccumulatorV39",
    "RainGuardPersistentIdentityTemporalAccumulator",
    "RainGuardPersistentObservationMemoryV39",
    "RainGuardCrossCyclePersistentIdentityMatchesV39",
    "RainGuardCrossCyclePersistentIdentityMatcherV39",
    "RainGuardPersistentStormIdentitiesV39",
    "RainGuardReconciledStormIdentitiesV39"
  ]);

  function now() {
    return Date.now();
  }

  function isObject(value) {
    return value !== null && typeof value === "object";
  }

  function toFiniteNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function firstDefined(obj, keys) {
    if (!isObject(obj)) return undefined;
    for (const key of keys) {
      if (obj[key] !== undefined && obj[key] !== null) return obj[key];
    }
    return undefined;
  }

  function normalizeTimestamp(value) {
    if (value === null || value === undefined) return null;

    let n = Number(value);
    if (Number.isFinite(n)) {
      // seconds -> ms
      if (n > 0 && n < 1e12) n *= 1000;
      return Number.isFinite(n) && n > 0 ? n : null;
    }

    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function normalizeCoordinate(record) {
    if (!isObject(record)) return null;

    const coordinate = isObject(record.coordinate) ? record.coordinate : null;

    let lat = toFiniteNumber(firstDefined(record, [
      "latitude", "lat", "y"
    ]));
    let lon = toFiniteNumber(firstDefined(record, [
      "longitude", "lon", "lng", "x"
    ]));

    if (lat === null && coordinate) {
      lat = toFiniteNumber(firstDefined(coordinate, ["latitude", "lat", "y"]));
    }
    if (lon === null && coordinate) {
      lon = toFiniteNumber(firstDefined(coordinate, ["longitude", "lon", "lng", "x"]));
    }

    if (lat === null || lon === null) return null;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;

    return { lat, lon };
  }

  function normalizeIdentity(record, fallbackKey) {
    if (!isObject(record)) return fallbackKey ? String(fallbackKey) : null;

    const value = firstDefined(record, [
      "persistentId",
      "persistentIdentity",
      "identity",
      "identityId",
      "canonicalTrackId",
      "trackId",
      "cellId",
      "id",
      "stormId"
    ]);

    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim();
    }

    if (fallbackKey !== undefined && fallbackKey !== null && String(fallbackKey).trim()) {
      return String(fallbackKey).trim();
    }

    return null;
  }

  function normalizeObservation(record, fallbackIdentity, sourceName) {
    if (!isObject(record)) return null;

    const identity = normalizeIdentity(record, fallbackIdentity);
    const coordinate = normalizeCoordinate(record);
    const timestamp = normalizeTimestamp(firstDefined(record, [
      "observedAt",
      "timestamp",
      "time",
      "generatedAt",
      "updatedAt",
      "accumulatedAt",
      "createdAt",
      "lastSeenAt",
      "firstSeenAt"
    ]));

    return {
      identity,
      latitude: coordinate ? coordinate.lat : null,
      longitude: coordinate ? coordinate.lon : null,
      observedAt: timestamp,
      timestamp,
      confidence: toFiniteNumber(firstDefined(record, [
        "confidence", "score", "quality", "probability"
      ])),
      intensity: toFiniteNumber(firstDefined(record, [
        "intensity", "dbz", "rainRate", "severity"
      ])),
      source: String(firstDefined(record, ["source", "provider", "origin"]) || sourceName || "unknown"),
      phase: firstDefined(record, ["phase"]),
      original: record
    };
  }

  function looksLikeObservation(value) {
    if (!isObject(value)) return false;
    return (
      firstDefined(value, ["latitude", "lat", "coordinate"]) !== undefined ||
      firstDefined(value, ["observedAt", "timestamp", "time", "accumulatedAt"]) !== undefined
    );
  }

  function collectFromContainer(container, sourceName, out, fallbackIdentity, depth, seen) {
    if (container === null || container === undefined) return;
    if (depth > 8) return;

    if (isObject(container)) {
      if (seen.has(container)) return;
      seen.add(container);
    }

    if (Array.isArray(container)) {
      for (const item of container) {
        collectFromContainer(item, sourceName, out, fallbackIdentity, depth + 1, seen);
      }
      return;
    }

    if (container instanceof Map) {
      for (const [key, value] of container.entries()) {
        collectFromContainer(value, sourceName, out, key, depth + 1, seen);
      }
      return;
    }

    if (!isObject(container)) return;

    // Identity object containing nested history/observations.
    const containerIdentity = normalizeIdentity(container, fallbackIdentity);

    const nestedKeys = [
      "observations",
      "history",
      "records",
      "points",
      "samples",
      "temporalHistory",
      "motionHistory",
      "observationHistory",
      "items",
      "values",
      "identities",
      "groups",
      "feed",
      "data"
    ];

    let nestedFound = false;
    for (const key of nestedKeys) {
      if (container[key] !== undefined && container[key] !== null) {
        nestedFound = true;
        collectFromContainer(
          container[key],
          sourceName,
          out,
          containerIdentity,
          depth + 1,
          seen
        );
      }
    }

    if (looksLikeObservation(container)) {
      const obs = normalizeObservation(container, containerIdentity, sourceName);
      if (obs) out.push(obs);
      return;
    }

    // Generic object keyed by identity IDs.
    if (!nestedFound) {
      for (const [key, value] of Object.entries(container)) {
        if (isObject(value)) {
          collectFromContainer(value, sourceName, out, key, depth + 1, seen);
        }
      }
    }
  }

  function discoverSources() {
    const sources = [];

    for (const name of ROOT_SOURCE_NAMES) {
      if (global[name] !== undefined && global[name] !== null) {
        sources.push({ name, value: global[name] });
      }
    }

    // Known getters from previous RainGuard phases.
    const getterNames = [
      "getRainGuardPersistentIdentityTemporalHistory",
      "getRainGuardPersistentObservationMemory",
      "getRainGuardCrossCyclePersistentIdentities",
      "getRainGuardPersistentStormIdentities",
      "getRainGuardReconciledStormIdentities",
      "getRainGuardPersistentIdentityMotionRecords"
    ];

    for (const getterName of getterNames) {
      if (typeof global[getterName] === "function") {
        try {
          const value = global[getterName]();
          if (value !== undefined && value !== null) {
            sources.push({ name: getterName + "()", value });
          }
        } catch (_) {
          // Discovery must never break the pipeline.
        }
      }
    }

    return sources;
  }

  function dedupeObservations(observations) {
    const seen = new Set();
    const result = [];

    for (const obs of observations) {
      const key = [
        obs.identity || "",
        obs.observedAt || "",
        Number.isFinite(obs.latitude) ? obs.latitude.toFixed(6) : "",
        Number.isFinite(obs.longitude) ? obs.longitude.toFixed(6) : "",
        obs.source || ""
      ].join("|");

      if (seen.has(key)) continue;
      seen.add(key);
      result.push(obs);
    }

    return result;
  }

  function groupByIdentity(observations, config, stats) {
    const groups = new Map();

    for (const obs of observations) {
      if (!obs.identity) {
        stats.rejectedNoIdentity += 1;
        continue;
      }

      if (
        !Number.isFinite(obs.latitude) ||
        !Number.isFinite(obs.longitude)
      ) {
        stats.rejectedInvalidCoordinate += 1;
        continue;
      }

      if (!Number.isFinite(obs.observedAt)) {
        stats.rejectedInvalidTimestamp += 1;
        continue;
      }

      if (!groups.has(obs.identity)) groups.set(obs.identity, []);
      groups.get(obs.identity).push(obs);
    }

    const bounded = new Map();

    for (const [identity, items] of groups.entries()) {
      items.sort((a, b) => a.observedAt - b.observedAt);

      // Deduplicate exact temporal-coordinate repeats.
      const unique = [];
      const seen = new Set();

      for (const item of items) {
        const key = [
          item.observedAt,
          item.latitude.toFixed(6),
          item.longitude.toFixed(6)
        ].join("|");

        if (seen.has(key)) continue;
        seen.add(key);
        unique.push(item);
      }

      bounded.set(
        identity,
        unique.slice(-Math.max(2, config.maxObservationsPerIdentity))
      );
    }

    return bounded;
  }

  function degToRad(deg) {
    return deg * Math.PI / 180;
  }

  function radToDeg(rad) {
    return rad * 180 / Math.PI;
  }

  function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371.0088;
    const p1 = degToRad(lat1);
    const p2 = degToRad(lat2);
    const dp = degToRad(lat2 - lat1);
    const dl = degToRad(lon2 - lon1);

    const a =
      Math.sin(dp / 2) * Math.sin(dp / 2) +
      Math.cos(p1) * Math.cos(p2) *
      Math.sin(dl / 2) * Math.sin(dl / 2);

    return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
  }

  function bearingDegrees(lat1, lon1, lat2, lon2) {
    const p1 = degToRad(lat1);
    const p2 = degToRad(lat2);
    const dl = degToRad(lon2 - lon1);

    const y = Math.sin(dl) * Math.cos(p2);
    const x =
      Math.cos(p1) * Math.sin(p2) -
      Math.sin(p1) * Math.cos(p2) * Math.cos(dl);

    const b = radToDeg(Math.atan2(y, x));
    return (b + 360) % 360;
  }

  function vectorComponents(speedKmh, bearingDeg) {
    // Bearing: 0=N, 90=E.
    const r = degToRad(bearingDeg);
    return {
      eastKmh: speedKmh * Math.sin(r),
      northKmh: speedKmh * Math.cos(r)
    };
  }

  function cardinalDirection(bearing) {
    if (!Number.isFinite(bearing)) return null;

    const dirs = [
      "N", "NNE", "NE", "ENE",
      "E", "ESE", "SE", "SSE",
      "S", "SSW", "SW", "WSW",
      "W", "WNW", "NW", "NNW"
    ];

    const index = Math.round(((bearing % 360) / 22.5)) % 16;
    return dirs[index];
  }

  function evaluatePair(identity, a, b, config, stats) {
    stats.inspectedPairCount += 1;

    if (!a || !b) {
      stats.rejectedPairCount += 1;
      return null;
    }

    const dtMs = b.observedAt - a.observedAt;
    const dtSeconds = dtMs / 1000;

    if (
      !Number.isFinite(dtSeconds) ||
      dtSeconds < config.minDeltaSeconds ||
      dtSeconds > config.maxDeltaMinutes * 60
    ) {
      stats.rejectedDeltaTime += 1;
      stats.rejectedPairCount += 1;
      return null;
    }

    const distanceKm = haversineKm(
      a.latitude, a.longitude,
      b.latitude, b.longitude
    );

    if (!Number.isFinite(distanceKm) || distanceKm > config.maxDistanceKm) {
      stats.rejectedDistance += 1;
      stats.rejectedPairCount += 1;
      return null;
    }

    const stationary = distanceKm < config.minDistanceKm;

    if (stationary && !config.keepStationaryVectors) {
      stats.stationaryVectorCount += 1;
      stats.rejectedPairCount += 1;
      return null;
    }

    const hours = dtSeconds / 3600;
    const speedKmh = hours > 0 ? distanceKm / hours : null;

    if (!Number.isFinite(speedKmh) || speedKmh > config.maxSpeedKmh) {
      stats.rejectedSpeed += 1;
      stats.rejectedPairCount += 1;
      return null;
    }

    const bearing = stationary
      ? null
      : bearingDegrees(
          a.latitude, a.longitude,
          b.latitude, b.longitude
        );

    const components = Number.isFinite(bearing)
      ? vectorComponents(speedKmh, bearing)
      : { eastKmh: 0, northKmh: 0 };

    stats.acceptedPairCount += 1;
    stats.validSpeedCount += Number.isFinite(speedKmh) ? 1 : 0;
    stats.validBearingCount += Number.isFinite(bearing) ? 1 : 0;

    return {
      identity,
      persistentId: identity,
      from: {
        latitude: a.latitude,
        longitude: a.longitude,
        observedAt: a.observedAt,
        source: a.source
      },
      to: {
        latitude: b.latitude,
        longitude: b.longitude,
        observedAt: b.observedAt,
        source: b.source
      },
      deltaSeconds: dtSeconds,
      deltaMinutes: dtSeconds / 60,
      distanceKm,
      speedKmh,
      speedMs: speedKmh / 3.6,
      bearingDegrees: bearing,
      direction: cardinalDirection(bearing),
      eastKmh: components.eastKmh,
      northKmh: components.northKmh,
      stationary,
      confidence: (() => {
        const values = [a.confidence, b.confidence].filter(Number.isFinite);
        if (!values.length) return null;
        return values.reduce((sum, v) => sum + v, 0) / values.length;
      })(),
      sourcePair: [a.source, b.source],
      generatedAt: now(),
      phase: PHASE,
      version: VERSION
    };
  }

  function recoverVectorForIdentity(identity, points, config, stats) {
    if (!Array.isArray(points) || points.length < config.minObservations) {
      stats.singlePointIdentityCount += 1;
      return null;
    }

    stats.multiPointIdentityCount += 1;

    const sorted = points
      .filter(Boolean)
      .slice()
      .sort((a, b) => a.observedAt - b.observedAt);

    if (sorted.length < 2) {
      stats.singlePointIdentityCount += 1;
      return null;
    }

    // 1) Prefer newest valid adjacent pair.
    if (config.preferLatestPair) {
      for (let i = sorted.length - 1; i > 0; i -= 1) {
        const vector = evaluatePair(
          identity,
          sorted[i - 1],
          sorted[i],
          config,
          stats
        );
        if (vector) return vector;
      }
    }

    // 2) Optional recovery using wider non-adjacent pairs.
    if (config.allowNonAdjacentFallback) {
      for (let end = sorted.length - 1; end > 0; end -= 1) {
        for (let start = end - 2; start >= 0; start -= 1) {
          const vector = evaluatePair(
            identity,
            sorted[start],
            sorted[end],
            config,
            stats
          );
          if (vector) return vector;
        }
      }
    }

    return null;
  }

  function publish(vectors, result) {
    STATE.vectors = vectors.slice();
    STATE.vectorsByIdentity = new Map(
      vectors.map(v => [v.identity, v])
    );
    STATE.lastResult = result;

    global.RainGuardPersistentIdentityMotionVectorsV39 = STATE.vectors;
    global.RainGuardPersistentIdentityMotionVectorsByIdentityV39 =
      STATE.vectorsByIdentity;
    global.RainGuardPersistentIdentityMotionVectorRecoveryLastResult = result;
    global.RainGuardPersistentIdentityMotionVectorRecoveryState = STATE;

    try {
      global.dispatchEvent(new CustomEvent(
        "rainguard:persistent-identity-motion-vectors-recovered",
        { detail: result }
      ));
    } catch (_) {
      // CustomEvent may be unavailable in some test environments.
    }
  }

  async function run(options) {
    if (STATE.running) {
      return {
        success: false,
        phase: PHASE,
        version: VERSION,
        build: BUILD,
        status: "MOTION_VECTOR_RECOVERY_ALREADY_RUNNING"
      };
    }

    const startedAt = now();
    STATE.running = true;
    STATE.lastError = null;
    STATE.runs += 1;
    STATE.statistics.runs += 1;

    const config = {
      ...STATE.config,
      ...(isObject(options) ? options : {})
    };

    try {
      const sources = discoverSources();
      const raw = [];

      for (const source of sources) {
        collectFromContainer(
          source.value,
          source.name,
          raw,
          null,
          0,
          new WeakSet()
        );
      }

      const deduped = dedupeObservations(raw);

      const stats = {
        ...STATE.statistics,
        sourceIdentityCount: 0,
        normalizedIdentityCount: 0,
        multiPointIdentityCount: 0,
        singlePointIdentityCount: 0,
        inspectedPairCount: 0,
        acceptedPairCount: 0,
        rejectedPairCount: 0,
        motionVectorCount: 0,
        stationaryVectorCount: 0,
        validSpeedCount: 0,
        validBearingCount: 0,
        rejectedNoIdentity: 0,
        rejectedInvalidCoordinate: 0,
        rejectedInvalidTimestamp: 0,
        rejectedDeltaTime: 0,
        rejectedDistance: 0,
        rejectedSpeed: 0
      };

      const groups = groupByIdentity(deduped, config, stats);
      stats.sourceIdentityCount = groups.size;
      stats.normalizedIdentityCount = groups.size;

      const vectors = [];
      let processed = 0;

      for (const [identity, observations] of groups.entries()) {
        if (processed >= config.maxIdentities) break;
        processed += 1;

        const vector = recoverVectorForIdentity(
          identity,
          observations,
          config,
          stats
        );

        if (vector) vectors.push(vector);
      }

      vectors.sort((a, b) => b.to.observedAt - a.to.observedAt);

      stats.motionVectorCount = vectors.length;
      STATE.statistics = stats;
      STATE.lastRun = now();

      let status = "NO_PERSISTENT_IDENTITIES_FOUND";

      if (groups.size > 0 && stats.multiPointIdentityCount === 0) {
        status = "PERSISTENT_IDENTITIES_FOUND_BUT_SINGLE_POINT_ONLY";
      } else if (
        stats.multiPointIdentityCount > 0 &&
        vectors.length === 0
      ) {
        status = "MULTI_POINT_IDENTITIES_FOUND_BUT_NO_VALID_MOTION_VECTOR";
      } else if (vectors.length > 0) {
        status = "PERSISTENT_IDENTITY_MOTION_VECTORS_RECOVERED";
      }

      const result = {
        success: true,
        phase: PHASE,
        version: VERSION,
        build: BUILD,
        status,

        sourceCount: sources.length,
        sourceNames: sources.map(s => s.name),

        sourceRecordCount: raw.length,
        deduplicatedRecordCount: deduped.length,

        identityCount: groups.size,
        multiPointIdentityCount: stats.multiPointIdentityCount,
        singlePointIdentityCount: stats.singlePointIdentityCount,

        motionVectorCount: vectors.length,
        validSpeedCount: stats.validSpeedCount,
        validBearingCount: stats.validBearingCount,
        stationaryVectorCount: stats.stationaryVectorCount,

        inspectedPairCount: stats.inspectedPairCount,
        acceptedPairCount: stats.acceptedPairCount,
        rejectedPairCount: stats.rejectedPairCount,

        rejectionCounts: {
          NO_IDENTITY: stats.rejectedNoIdentity,
          INVALID_COORDINATE: stats.rejectedInvalidCoordinate,
          INVALID_TIMESTAMP: stats.rejectedInvalidTimestamp,
          INVALID_DELTA_TIME: stats.rejectedDeltaTime,
          INVALID_DISTANCE: stats.rejectedDistance,
          INVALID_SPEED: stats.rejectedSpeed
        },

        maxObservedPointsPerIdentity: groups.size
          ? Math.max(...Array.from(groups.values()).map(v => v.length))
          : 0,

        sample: vectors.slice(0, config.sampleLimit),
        vectors,
        generatedAt: now(),
        durationMs: now() - startedAt
      };

      publish(vectors, result);

      console.groupCollapsed(
        `[RainGuard Phase ${PHASE}] Persistent Identity Motion Vector Recovery result:`
      );
      console.log(result);
      if (vectors.length) console.table(vectors.slice(0, 20));
      console.groupEnd();

      return result;
    } catch (error) {
      STATE.lastError = error;
      STATE.lastRun = now();

      const result = {
        success: false,
        phase: PHASE,
        version: VERSION,
        build: BUILD,
        status: "PERSISTENT_IDENTITY_MOTION_VECTOR_RECOVERY_FAILED",
        error: error && error.message ? error.message : String(error),
        generatedAt: now(),
        durationMs: now() - startedAt
      };

      STATE.lastResult = result;
      global.RainGuardPersistentIdentityMotionVectorRecoveryLastResult = result;

      console.error(
        `[RainGuard Phase ${PHASE}] Motion Vector Recovery failed:`,
        error
      );

      return result;
    } finally {
      STATE.running = false;
    }
  }

  function getVectors() {
    return STATE.vectors.slice();
  }

  function diagnose() {
    const vectors = STATE.vectors;

    return {
      success: true,
      phase: PHASE,
      version: VERSION,
      build: BUILD,
      installed: STATE.installed,
      running: STATE.running,
      runs: STATE.runs,
      lastRun: STATE.lastRun,
      lastError: STATE.lastError,
      vectorCount: vectors.length,
      validSpeedCount: vectors.filter(v => Number.isFinite(v.speedKmh)).length,
      validBearingCount: vectors.filter(v => Number.isFinite(v.bearingDegrees)).length,
      identities: vectors.map(v => v.identity),
      sample: vectors.slice(0, 10),
      lastResult: STATE.lastResult,
      config: { ...STATE.config }
    };
  }

  function configure(patch) {
    if (!isObject(patch)) return { ...STATE.config };
    STATE.config = { ...STATE.config, ...patch };
    return { ...STATE.config };
  }

  global.runRainGuardPersistentIdentityMotionVectorRecovery = run;
  global.getRainGuardPersistentIdentityMotionVectors = getVectors;
  global.diagnoseRainGuardPersistentIdentityMotionVectorRecovery = diagnose;
  global.configureRainGuardPersistentIdentityMotionVectorRecovery = configure;

  // Compatibility aliases for later phases.
  global.runRainGuardPersistentMotionVectorRecovery = run;
  global.getRainGuardRecoveredPersistentMotionVectors = getVectors;

  global.RainGuardPersistentIdentityMotionVectorRecoveryV39 = {
    phase: PHASE,
    version: VERSION,
    build: BUILD,
    state: STATE,
    run,
    getVectors,
    diagnose,
    configure
  };

  console.info(
    `[RainGuard Phase ${PHASE}] Persistent Identity Motion Vector Recovery installed.`,
    {
      success: true,
      phase: PHASE,
      version: VERSION,
      build: BUILD
    }
  );

})(typeof window !== "undefined" ? window : globalThis);
