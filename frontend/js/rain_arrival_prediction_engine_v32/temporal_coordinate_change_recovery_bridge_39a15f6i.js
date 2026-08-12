/**
 * RainGuard AI
 * Phase 39A-15F6I — Temporal Coordinate Change Recovery Bridge
 *
 * Purpose
 * -------
 * Recover genuine coordinate changes for persistent storm identities across cycles
 * without fabricating motion. The bridge:
 *   1) scans compatible RainGuard identity / history / accumulator stores,
 *   2) normalizes observations and timestamps,
 *   3) groups observations by persistent identity,
 *   4) preserves only real coordinate changes,
 *   5) exposes a recovered temporal-coordinate feed for downstream motion recovery,
 *   6) optionally triggers Phase 39A-15F6H after a successful recovery.
 *
 * Safety principles
 * -----------------
 * - Never invent latitude/longitude.
 * - Never invent timestamps.
 * - Never infer motion from one point.
 * - Never treat duplicate coordinates as movement.
 * - Reject impossible coordinates and non-positive time deltas.
 * - Keep source references for auditability.
 */

(function installRainGuardTemporalCoordinateChangeRecoveryBridge(global) {
  "use strict";

  const PHASE = "39A-15F6I";
  const VERSION = "39A.15F6I.0";
  const BUILD = "rainguard-v39-temporal-coordinate-change-recovery-bridge";

  if (!global) return;

  const CONFIG = Object.freeze({
    maxSources: 80,
    maxRecordsPerSource: 5000,
    maxIdentities: 2000,
    maxPointsPerIdentity: 32,
    minDeltaMs: 1000,
    maxDeltaMs: 24 * 60 * 60 * 1000,
    coordinatePrecision: 6,
    movementEpsilonDegrees: 0.000001,
    autoRunF6H: false
  });

  const STORE_KEY = "RainGuardRecoveredTemporalCoordinateChangesV39";
  const LAST_RESULT_KEY = "RainGuardTemporalCoordinateChangeRecoveryLastResultV39";

  const now = () => Date.now();

  function isObject(value) {
    return value !== null && typeof value === "object";
  }

  function finite(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function validLatLon(lat, lon) {
    return Number.isFinite(lat) &&
      Number.isFinite(lon) &&
      lat >= -90 && lat <= 90 &&
      lon >= -180 && lon <= 180 &&
      !(lat === 0 && lon === 0);
  }

  function safeString(value) {
    if (value === null || value === undefined) return null;
    const s = String(value).trim();
    return s ? s : null;
  }

  function readCoordinate(record) {
    if (!isObject(record)) return null;

    const coordinate = isObject(record.coordinate) ? record.coordinate : null;
    const coords = isObject(record.coordinates) ? record.coordinates : null;
    const position = isObject(record.position) ? record.position : null;
    const center = isObject(record.center) ? record.center : null;
    const centroid = isObject(record.centroid) ? record.centroid : null;
    const location = isObject(record.location) ? record.location : null;

    const latCandidates = [
      record.latitude, record.lat,
      coordinate && (coordinate.latitude ?? coordinate.lat),
      coords && (coords.latitude ?? coords.lat),
      position && (position.latitude ?? position.lat),
      center && (center.latitude ?? center.lat),
      centroid && (centroid.latitude ?? centroid.lat),
      location && (location.latitude ?? location.lat)
    ];

    const lonCandidates = [
      record.longitude, record.lon, record.lng,
      coordinate && (coordinate.longitude ?? coordinate.lon ?? coordinate.lng),
      coords && (coords.longitude ?? coords.lon ?? coords.lng),
      position && (position.longitude ?? position.lon ?? position.lng),
      center && (center.longitude ?? center.lon ?? center.lng),
      centroid && (centroid.longitude ?? centroid.lon ?? centroid.lng),
      location && (location.longitude ?? location.lon ?? location.lng)
    ];

    let lat = null;
    let lon = null;

    for (const value of latCandidates) {
      const n = finite(value);
      if (n !== null) { lat = n; break; }
    }
    for (const value of lonCandidates) {
      const n = finite(value);
      if (n !== null) { lon = n; break; }
    }

    if (!validLatLon(lat, lon)) return null;

    return { latitude: lat, longitude: lon };
  }

  function normalizeTimestamp(value) {
    if (value === null || value === undefined || value === "") return null;

    if (value instanceof Date) {
      const t = value.getTime();
      return Number.isFinite(t) ? t : null;
    }

    if (typeof value === "string") {
      const numeric = Number(value);
      if (Number.isFinite(numeric)) value = numeric;
      else {
        const parsed = Date.parse(value);
        return Number.isFinite(parsed) ? parsed : null;
      }
    }

    const n = Number(value);
    if (!Number.isFinite(n)) return null;

    // Seconds -> ms
    if (n > 1e9 && n < 1e12) return Math.round(n * 1000);

    // Milliseconds
    if (n >= 1e12 && n < 1e15) return Math.round(n);

    // Microseconds -> ms
    if (n >= 1e15 && n < 1e18) return Math.round(n / 1000);

    return null;
  }

  function readTimestamp(record) {
    if (!isObject(record)) return null;

    const candidates = [
      record.observedAt,
      record.timestamp,
      record.time,
      record.ts,
      record.eventTime,
      record.detectedAt,
      record.updatedAt,
      record.createdAt,
      record.accumulatedAt,
      record.generatedAt
    ];

    for (const value of candidates) {
      const t = normalizeTimestamp(value);
      if (t !== null) return t;
    }
    return null;
  }

  function readIdentity(record) {
    if (!isObject(record)) return null;

    const candidates = [
      record.persistentId,
      record.persistentID,
      record.canonicalTrackId,
      record.canonicalId,
      record.identity,
      record.identityId,
      record.identityID,
      record.trackId,
      record.trackID,
      record.cellId,
      record.cellID,
      record.stormId,
      record.stormID,
      record.entityId,
      record.entityID,
      record.id
    ];

    for (const value of candidates) {
      if (isObject(value)) {
        const nested = safeString(
          value.persistentId ??
          value.identity ??
          value.identityId ??
          value.trackId ??
          value.cellId ??
          value.id
        );
        if (nested) return nested;
      } else {
        const s = safeString(value);
        if (s) return s;
      }
    }

    return null;
  }

  function readSource(record, fallback) {
    return safeString(
      record && (
        record.source ??
        record.sourceName ??
        record.provider ??
        record.origin ??
        record.phase ??
        record.build
      )
    ) || fallback || "unknown";
  }

  function normalizeObservation(record, sourceName, sourceIndex, recordIndex) {
    if (!isObject(record)) return { ok: false, reason: "INVALID_RECORD" };

    const identity = readIdentity(record);
    if (!identity) return { ok: false, reason: "NO_IDENTITY" };

    const coordinate = readCoordinate(record);
    if (!coordinate) return { ok: false, reason: "INVALID_COORDINATE" };

    const observedAt = readTimestamp(record);
    if (observedAt === null) return { ok: false, reason: "INVALID_TIME" };

    return {
      ok: true,
      value: {
        identity,
        latitude: coordinate.latitude,
        longitude: coordinate.longitude,
        observedAt,
        timestamp: observedAt,
        source: readSource(record, sourceName),
        sourceStore: sourceName,
        sourceIndex,
        recordIndex,
        phase: record.phase || null,
        version: record.version || null,
        confidence: finite(record.confidence),
        intensity: finite(record.intensity),
        original: record
      }
    };
  }

  function arrayFromUnknown(value) {
    if (!value) return [];

    if (Array.isArray(value)) return value;

    if (value instanceof Map) {
      const out = [];
      for (const [key, item] of value.entries()) {
        if (Array.isArray(item)) {
          for (const v of item) {
            if (isObject(v) && !v.identity && !v.trackId && !v.persistentId) {
              out.push(Object.assign({ identity: key }, v));
            } else out.push(v);
          }
        } else if (isObject(item)) {
          out.push(
            (!item.identity && !item.trackId && !item.persistentId)
              ? Object.assign({ identity: key }, item)
              : item
          );
        }
      }
      return out;
    }

    if (value instanceof Set) return Array.from(value);

    if (isObject(value)) {
      // Known container fields
      const preferred = [
        "observations", "records", "items", "entities", "history",
        "points", "samples", "data", "feed", "tracks", "identities",
        "temporalHistory", "motionRecords", "motionHistory"
      ];

      for (const key of preferred) {
        if (Array.isArray(value[key])) return value[key];
        if (value[key] instanceof Map) return arrayFromUnknown(value[key]);
      }

      // Object keyed by identity where each value is an array
      const keys = Object.keys(value);
      const flattened = [];
      for (const key of keys) {
        const item = value[key];
        if (Array.isArray(item)) {
          for (const v of item) {
            if (isObject(v) && !v.identity && !v.trackId && !v.persistentId) {
              flattened.push(Object.assign({ identity: key }, v));
            } else flattened.push(v);
          }
        }
      }
      if (flattened.length) return flattened;
    }

    return [];
  }

  function discoverSources() {
    const preferredNames = [
      "RainGuardPersistentIdentityTemporalAccumulatorV39",
      "RainGuardPersistentIdentityMotionRecordsV39",
      "RainGuardPersistentObservationMemoryV39",
      "RainGuardCrossCycleObservationPersistenceV39",
      "RainGuardRecoveredLiveTrackHistoryV39",
      "RainGuardLiveTrackHistory",
      "RainGuardPersistentStormIdentitiesV39",
      "RainGuardReconciledStormIdentitiesV39",
      "RainGuardPersistentIdentityMotionHistoryV39",
      "RainGuardPersistentTemporalMotionFeedV39",
      "RainArrivalLiveTrackHistory",
      "RainArrivalTrackStoreV32"
    ];

    const sources = [];
    const seenValues = new Set();

    function add(name, value) {
      if (!value || seenValues.has(value)) return;
      const records = arrayFromUnknown(value);
      if (!records.length) return;
      seenValues.add(value);
      sources.push({ name, value, records });
    }

    for (const name of preferredNames) {
      try { add(name, global[name]); } catch (_) {}
    }

    // Conservative fallback discovery: only RainGuard/RainArrival globals.
    let scanned = 0;
    for (const key of Object.keys(global)) {
      if (sources.length >= CONFIG.maxSources) break;
      if (scanned++ > 4000) break;
      if (!/^(RainGuard|RainArrival|_rainGuard|_rainArrival)/.test(key)) continue;
      try { add(key, global[key]); } catch (_) {}
    }

    return sources;
  }

  function coordinateKey(point) {
    return [
      Number(point.latitude).toFixed(CONFIG.coordinatePrecision),
      Number(point.longitude).toFixed(CONFIG.coordinatePrecision)
    ].join(",");
  }

  function sameCoordinate(a, b) {
    return Math.abs(a.latitude - b.latitude) <= CONFIG.movementEpsilonDegrees &&
      Math.abs(a.longitude - b.longitude) <= CONFIG.movementEpsilonDegrees;
  }

  function dedupeAndSort(points) {
    const sorted = points.slice().sort((a, b) => a.observedAt - b.observedAt);
    const out = [];
    const seen = new Set();

    for (const point of sorted) {
      const key = [
        point.identity,
        point.observedAt,
        coordinateKey(point)
      ].join("|");

      if (seen.has(key)) continue;
      seen.add(key);
      out.push(point);
    }

    return out;
  }

  function recoverChangesForIdentity(identity, observations) {
    const points = dedupeAndSort(observations);
    const changes = [];
    let stationaryPairs = 0;
    let invalidDeltaPairs = 0;

    for (let i = 1; i < points.length; i++) {
      const previous = points[i - 1];
      const current = points[i];
      const deltaMs = current.observedAt - previous.observedAt;

      if (!(deltaMs >= CONFIG.minDeltaMs && deltaMs <= CONFIG.maxDeltaMs)) {
        invalidDeltaPairs++;
        continue;
      }

      if (sameCoordinate(previous, current)) {
        stationaryPairs++;
        continue;
      }

      changes.push({
        identity,
        from: {
          latitude: previous.latitude,
          longitude: previous.longitude,
          observedAt: previous.observedAt,
          source: previous.source,
          sourceStore: previous.sourceStore
        },
        to: {
          latitude: current.latitude,
          longitude: current.longitude,
          observedAt: current.observedAt,
          source: current.source,
          sourceStore: current.sourceStore
        },
        deltaMs,
        deltaSeconds: deltaMs / 1000,
        latitudeDelta: current.latitude - previous.latitude,
        longitudeDelta: current.longitude - previous.longitude,
        coordinateChanged: true
      });
    }

    return {
      identity,
      pointCount: points.length,
      uniqueCoordinateCount: new Set(points.map(coordinateKey)).size,
      firstObservedAt: points.length ? points[0].observedAt : null,
      lastObservedAt: points.length ? points[points.length - 1].observedAt : null,
      stationaryPairs,
      invalidDeltaPairs,
      changeCount: changes.length,
      observations: points.slice(-CONFIG.maxPointsPerIdentity),
      changes
    };
  }

  async function run(options) {
    const startedAt = now();
    const opts = Object.assign({}, CONFIG, isObject(options) ? options : {});

    const sources = discoverSources();
    const groups = new Map();
    const rejectionCounts = {
      INVALID_RECORD: 0,
      NO_IDENTITY: 0,
      INVALID_COORDINATE: 0,
      INVALID_TIME: 0
    };

    let sourceRecordCount = 0;
    let normalizedRecordCount = 0;
    let duplicateRecordCount = 0;
    const globalRecordKeys = new Set();

    for (let sourceIndex = 0; sourceIndex < sources.length; sourceIndex++) {
      const source = sources[sourceIndex];
      const records = source.records.slice(0, opts.maxRecordsPerSource);
      sourceRecordCount += records.length;

      for (let recordIndex = 0; recordIndex < records.length; recordIndex++) {
        const normalized = normalizeObservation(
          records[recordIndex],
          source.name,
          sourceIndex,
          recordIndex
        );

        if (!normalized.ok) {
          rejectionCounts[normalized.reason] =
            (rejectionCounts[normalized.reason] || 0) + 1;
          continue;
        }

        const obs = normalized.value;
        const dedupeKey = [
          obs.identity,
          obs.observedAt,
          coordinateKey(obs)
        ].join("|");

        if (globalRecordKeys.has(dedupeKey)) {
          duplicateRecordCount++;
          continue;
        }
        globalRecordKeys.add(dedupeKey);
        normalizedRecordCount++;

        if (!groups.has(obs.identity)) groups.set(obs.identity, []);
        groups.get(obs.identity).push(obs);
      }
    }

    const identities = [];
    const recoveredChanges = [];
    let identitiesWithMultiplePoints = 0;
    let identitiesWithCoordinateChanges = 0;
    let stationaryPairCount = 0;
    let invalidDeltaPairCount = 0;

    for (const [identity, observations] of groups.entries()) {
      if (identities.length >= opts.maxIdentities) break;

      const item = recoverChangesForIdentity(identity, observations);
      identities.push(item);

      if (item.pointCount >= 2) identitiesWithMultiplePoints++;
      if (item.changeCount > 0) {
        identitiesWithCoordinateChanges++;
        recoveredChanges.push(...item.changes);
      }

      stationaryPairCount += item.stationaryPairs;
      invalidDeltaPairCount += item.invalidDeltaPairs;
    }

    identities.sort((a, b) =>
      b.changeCount - a.changeCount ||
      b.pointCount - a.pointCount ||
      String(a.identity).localeCompare(String(b.identity))
    );

    const store = {
      phase: PHASE,
      version: VERSION,
      build: BUILD,
      generatedAt: now(),
      identities,
      changes: recoveredChanges,
      byIdentity: new Map(identities.map(item => [item.identity, item])),
      sourceNames: sources.map(s => s.name)
    };

    global[STORE_KEY] = store;

    // Compatibility aliases for downstream phases.
    global.RainGuardTemporalCoordinateChangesV39 = recoveredChanges;
    global.RainGuardRecoveredCoordinateChangeHistoryV39 = identities;
    global.RainGuardPersistentIdentityCoordinateChangesV39 = recoveredChanges;

    const result = {
      success: true,
      phase: PHASE,
      version: VERSION,
      build: BUILD,
      status: recoveredChanges.length
        ? "TEMPORAL_COORDINATE_CHANGES_RECOVERED"
        : identitiesWithMultiplePoints
          ? "MULTI_POINT_IDENTITIES_FOUND_BUT_NO_COORDINATE_CHANGE"
          : normalizedRecordCount
            ? "OBSERVATIONS_FOUND_BUT_NO_MULTI_POINT_IDENTITY"
            : "NO_VALID_TEMPORAL_OBSERVATIONS",
      durationMs: now() - startedAt,
      sourceCount: sources.length,
      sourceNames: sources.map(s => s.name),
      sourceRecordCount,
      normalizedRecordCount,
      duplicateRecordCount,
      identityCount: identities.length,
      identitiesWithMultiplePoints,
      identitiesWithCoordinateChanges,
      recoveredChangeCount: recoveredChanges.length,
      stationaryPairCount,
      invalidDeltaPairCount,
      rejectedRecordCount: Object.values(rejectionCounts).reduce((a, b) => a + b, 0),
      rejectionCounts,
      maxObservedPointsPerIdentity: identities.reduce(
        (m, x) => Math.max(m, x.pointCount), 0
      ),
      maxUniqueCoordinatesPerIdentity: identities.reduce(
        (m, x) => Math.max(m, x.uniqueCoordinateCount), 0
      ),
      sample: identities.slice(0, 10).map(x => ({
        identity: x.identity,
        pointCount: x.pointCount,
        uniqueCoordinateCount: x.uniqueCoordinateCount,
        changeCount: x.changeCount,
        firstObservedAt: x.firstObservedAt,
        lastObservedAt: x.lastObservedAt
      })),
      changeSample: recoveredChanges.slice(0, 10)
    };

    global[LAST_RESULT_KEY] = result;

    console.log(`[RainGuard Phase ${PHASE}] Temporal Coordinate Change Recovery result:`);
    console.log(result);

    if (
      (opts.autoRunF6H || CONFIG.autoRunF6H) &&
      recoveredChanges.length > 0 &&
      typeof global.runRainGuardPersistentIdentityMotionVectorRecovery === "function"
    ) {
      try {
        result.downstreamF6H = await global.runRainGuardPersistentIdentityMotionVectorRecovery({
          source: STORE_KEY
        });
      } catch (error) {
        result.downstreamF6HError = String(error && error.message || error);
      }
    }

    return result;
  }

  function diagnose() {
    const store = global[STORE_KEY];
    const lastResult = global[LAST_RESULT_KEY] || null;

    const diagnostic = {
      phase: PHASE,
      version: VERSION,
      build: BUILD,
      installed: true,
      runnerAvailable:
        typeof global.runRainGuardTemporalCoordinateChangeRecoveryBridge === "function",
      downstreamF6HAvailable:
        typeof global.runRainGuardPersistentIdentityMotionVectorRecovery === "function",
      storeAvailable: !!store,
      identityCount: store && Array.isArray(store.identities)
        ? store.identities.length : 0,
      recoveredChangeCount: store && Array.isArray(store.changes)
        ? store.changes.length : 0,
      lastResult
    };

    console.log(`[RainGuard Phase ${PHASE}] Diagnostic:`);
    console.log(diagnostic);
    return diagnostic;
  }

  function getStore() {
    return global[STORE_KEY] || null;
  }

  function getIdentity(identity) {
    const store = global[STORE_KEY];
    if (!store || !(store.byIdentity instanceof Map)) return null;
    return store.byIdentity.get(String(identity)) || null;
  }

  global.runRainGuardTemporalCoordinateChangeRecoveryBridge = run;
  global.diagnoseRainGuardTemporalCoordinateChangeRecoveryBridge = diagnose;
  global.getRainGuardRecoveredTemporalCoordinateChanges = getStore;
  global.getRainGuardRecoveredTemporalCoordinateIdentity = getIdentity;

  global.RainGuardTemporalCoordinateChangeRecoveryBridgeV39 = {
    phase: PHASE,
    version: VERSION,
    build: BUILD,
    config: CONFIG,
    run,
    diagnose,
    getStore,
    getIdentity
  };

})(typeof window !== "undefined" ? window : globalThis);
