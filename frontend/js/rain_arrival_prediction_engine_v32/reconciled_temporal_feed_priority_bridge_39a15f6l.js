/**
 * RainGuard AI
 * Phase 39A-15F6L
 * Reconciled Temporal Feed Priority Bridge
 *
 * Purpose:
 * - Prefer the reconciled multi-observation temporal feed produced by Phase 39A-15F6K.
 * - Prevent downstream recovery phases from falling back prematurely to legacy
 *   single-point identities.
 * - Publish one canonical temporal feed for 15F6I / 15F6H and later ETA logic.
 *
 * Safety:
 * - Never fabricates coordinates.
 * - Never fabricates timestamps.
 * - Never converts zero/invalid coordinates into valid observations.
 * - Keeps legacy sources available as fallback only.
 */

(function installRainGuardReconciledTemporalFeedPriorityBridge(global) {
  "use strict";

  const PHASE = "39A-15F6L";
  const VERSION = "39A.15F6L.0";
  const BUILD = "rainguard-v39-reconciled-temporal-feed-priority-bridge";

  const CONFIG = Object.freeze({
    minPointsPerIdentity: 2,
    maxPointsPerIdentity: 24,
    maxIdentities: 2500,
    allowSinglePointFallback: false,
    preferCoordinateChanges: true,
    requireFiniteTimestamp: true,
    rejectZeroZeroCoordinate: true
  });

  const SOURCE_PRIORITY = Object.freeze([
    "RainGuardReconciledIdentityTemporalRecoveryV39",
    "RainGuardReconciledIdentityTemporalBridgeV39",
    "RainGuardCrossSourcePersistentIdentityReconciliationV39",
    "RainGuardCrossCyclePersistentIdentityMatcherV39",
    "RainGuardPersistentIdentityTemporalAccumulatorV39",
    "RainGuardPersistentObservationMemoryV39",
    "RainGuardPersistentStormIdentitiesV39",
    "RainGuardPersistentIdentityMotionRecordsV39",
    "RainGuardLiveTrackHistory"
  ]);

  const state = {
    installed: true,
    running: false,
    lastRun: null,
    lastError: null,
    canonicalFeed: [],
    identities: new Map(),
    sourceUsed: null,
    sourcePriority: [...SOURCE_PRIORITY],
    totals: {
      runs: 0,
      inputRecords: 0,
      acceptedRecords: 0,
      rejectedRecords: 0,
      identityCount: 0,
      multiPointIdentityCount: 0,
      coordinateChangeIdentityCount: 0
    }
  };

  function isObject(v) {
    return v !== null && typeof v === "object";
  }

  function finiteNumber(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function firstDefined(...values) {
    for (const v of values) {
      if (v !== undefined && v !== null && v !== "") return v;
    }
    return null;
  }

  function normalizeTimestamp(record) {
    const raw = firstDefined(
      record?.timestamp,
      record?.observedAt,
      record?.observationTime,
      record?.time,
      record?.updatedAt,
      record?.accumulatedAt,
      record?.createdAt
    );
    const n = finiteNumber(raw);
    if (n !== null) return n;
    if (typeof raw === "string") {
      const parsed = Date.parse(raw);
      if (Number.isFinite(parsed)) return parsed;
    }
    return null;
  }

  function normalizeCoordinate(record) {
    const coord = isObject(record?.coordinate) ? record.coordinate : {};
    const lat = finiteNumber(firstDefined(
      record?.latitude, record?.lat, coord?.latitude, coord?.lat
    ));
    const lon = finiteNumber(firstDefined(
      record?.longitude, record?.lon, record?.lng,
      coord?.longitude, coord?.lon, coord?.lng
    ));

    if (lat === null || lon === null) return null;
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
    if (CONFIG.rejectZeroZeroCoordinate && lat === 0 && lon === 0) return null;

    return { latitude: lat, longitude: lon };
  }

  function identityKey(record) {
    const id = firstDefined(
      record?.persistentId,
      record?.identity,
      record?.identityId,
      record?.canonicalTrackId,
      record?.trackId,
      record?.cellId,
      record?.stormId,
      record?.id
    );
    if (id === null) return null;
    return String(id).trim() || null;
  }

  function getNestedArrays(value, out = [], seen = new WeakSet(), depth = 0) {
    if (depth > 5 || value == null) return out;

    if (Array.isArray(value)) {
      if (value.length) out.push(value);
      for (const item of value.slice(0, 30)) {
        if (isObject(item)) getNestedArrays(item, out, seen, depth + 1);
      }
      return out;
    }

    if (!isObject(value)) return out;
    if (seen.has(value)) return out;
    seen.add(value);

    for (const key of Object.keys(value).slice(0, 80)) {
      const child = value[key];
      if (Array.isArray(child)) {
        if (child.length) out.push(child);
      } else if (isObject(child)) {
        getNestedArrays(child, out, seen, depth + 1);
      }
    }
    return out;
  }

  function readSource(name) {
    const value = global[name];
    if (value == null) return null;

    if (Array.isArray(value)) return value;
    if (value instanceof Map) return Array.from(value.values()).flatMap(v => Array.isArray(v) ? v : [v]);

    if (isObject(value)) {
      const preferredKeys = [
        "canonicalFeed", "feed", "observations", "records", "items",
        "identities", "entities", "history", "data", "output"
      ];

      for (const key of preferredKeys) {
        const v = value[key];
        if (Array.isArray(v) && v.length) return v;
        if (v instanceof Map && v.size) {
          return Array.from(v.values()).flatMap(x => Array.isArray(x) ? x : [x]);
        }
      }

      const arrays = getNestedArrays(value);
      if (arrays.length) {
        arrays.sort((a, b) => b.length - a.length);
        return arrays[0];
      }
    }

    return null;
  }

  function flattenCandidateRecords(items) {
    const out = [];
    const stack = Array.isArray(items) ? [...items] : [items];
    const seen = new WeakSet();

    while (stack.length && out.length < 50000) {
      const item = stack.shift();
      if (item == null) continue;

      if (Array.isArray(item)) {
        stack.unshift(...item);
        continue;
      }

      if (!isObject(item)) continue;
      if (seen.has(item)) continue;
      seen.add(item);

      const nested = firstDefined(
        item.observations,
        item.points,
        item.history,
        item.records,
        item.temporalFeed,
        item.feed
      );

      if (Array.isArray(nested) && nested.length) {
        const parentIdentity = identityKey(item);
        for (const child of nested) {
          if (isObject(child)) {
            out.push({
              ...child,
              persistentId: firstDefined(child.persistentId, parentIdentity),
              identity: firstDefined(child.identity, parentIdentity),
              identityId: firstDefined(child.identityId, parentIdentity)
            });
          }
        }
      } else {
        out.push(item);
      }
    }

    return out;
  }

  function normalizeRecord(record, sourceName, index) {
    if (!isObject(record)) return { ok: false, reason: "INVALID_RECORD" };

    const id = identityKey(record);
    if (!id) return { ok: false, reason: "NO_IDENTITY" };

    const coordinate = normalizeCoordinate(record);
    if (!coordinate) return { ok: false, reason: "INVALID_COORDINATE" };

    const timestamp = normalizeTimestamp(record);
    if (CONFIG.requireFiniteTimestamp && timestamp === null) {
      return { ok: false, reason: "INVALID_TIME" };
    }

    return {
      ok: true,
      value: {
        persistentId: id,
        identity: id,
        identityId: id,
        trackId: firstDefined(record.trackId, record.canonicalTrackId, record.cellId),
        cellId: firstDefined(record.cellId, record.trackId),
        latitude: coordinate.latitude,
        longitude: coordinate.longitude,
        lat: coordinate.latitude,
        lon: coordinate.longitude,
        lng: coordinate.longitude,
        coordinate: { ...coordinate },
        timestamp,
        observedAt: timestamp,
        confidence: finiteNumber(record.confidence),
        intensity: finiteNumber(record.intensity),
        source: firstDefined(record.source, sourceName),
        prioritySource: sourceName,
        phase: firstDefined(record.phase, PHASE),
        originalIndex: index,
        original: record
      }
    };
  }

  function uniqueObservationKey(obs) {
    return [
      obs.persistentId,
      Number(obs.latitude).toFixed(6),
      Number(obs.longitude).toFixed(6),
      obs.timestamp
    ].join("|");
  }

  function coordinateKey(obs) {
    return `${Number(obs.latitude).toFixed(6)},${Number(obs.longitude).toFixed(6)}`;
  }

  function groupObservations(records) {
    const groups = new Map();

    for (const obs of records) {
      if (!groups.has(obs.persistentId)) groups.set(obs.persistentId, []);
      groups.get(obs.persistentId).push(obs);
    }

    const identities = [];
    for (const [persistentId, pointsRaw] of groups) {
      const dedupe = new Map();
      for (const p of pointsRaw) dedupe.set(uniqueObservationKey(p), p);

      let points = Array.from(dedupe.values())
        .sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));

      if (points.length > CONFIG.maxPointsPerIdentity) {
        points = points.slice(-CONFIG.maxPointsPerIdentity);
      }

      const uniqueCoordinates = new Set(points.map(coordinateKey));
      const uniqueTimes = new Set(points.map(p => p.timestamp).filter(Number.isFinite));

      identities.push({
        persistentId,
        identity: persistentId,
        observations: points,
        observationCount: points.length,
        uniqueCoordinateCount: uniqueCoordinates.size,
        uniqueTimeCount: uniqueTimes.size,
        firstObservedAt: points.length ? points[0].timestamp : null,
        lastObservedAt: points.length ? points[points.length - 1].timestamp : null,
        hasCoordinateChange: uniqueCoordinates.size >= 2,
        isMultiPoint: points.length >= CONFIG.minPointsPerIdentity,
        sourceNames: Array.from(new Set(points.map(p => p.source).filter(Boolean)))
      });
    }

    identities.sort((a, b) => {
      if (CONFIG.preferCoordinateChanges) {
        if (a.hasCoordinateChange !== b.hasCoordinateChange) return a.hasCoordinateChange ? -1 : 1;
      }
      if (a.isMultiPoint !== b.isMultiPoint) return a.isMultiPoint ? -1 : 1;
      return b.observationCount - a.observationCount;
    });

    return identities.slice(0, CONFIG.maxIdentities);
  }

  function resolvePreferredSource() {
    const diagnostics = [];

    for (const sourceName of SOURCE_PRIORITY) {
      const raw = readSource(sourceName);
      if (!raw || !raw.length) {
        diagnostics.push({ sourceName, available: false, count: 0 });
        continue;
      }

      const flat = flattenCandidateRecords(raw);
      const normalized = [];
      const rejectionCounts = {};

      flat.forEach((record, index) => {
        const result = normalizeRecord(record, sourceName, index);
        if (result.ok) {
          normalized.push(result.value);
        } else {
          rejectionCounts[result.reason] = (rejectionCounts[result.reason] || 0) + 1;
        }
      });

      const identities = groupObservations(normalized);
      const multiPoint = identities.filter(x => x.isMultiPoint);
      const changed = identities.filter(x => x.hasCoordinateChange);

      diagnostics.push({
        sourceName,
        available: true,
        rawCount: flat.length,
        acceptedCount: normalized.length,
        identityCount: identities.length,
        multiPointIdentityCount: multiPoint.length,
        coordinateChangeIdentityCount: changed.length,
        rejectionCounts
      });

      // Priority rule:
      // 1) first source containing multi-point identity
      // 2) otherwise continue looking for better reconciled temporal source
      if (multiPoint.length > 0) {
        return { sourceName, flat, normalized, identities, diagnostics };
      }
    }

    // Controlled fallback: choose the richest source but do not claim multi-point history.
    let best = null;
    for (const sourceName of SOURCE_PRIORITY) {
      const raw = readSource(sourceName);
      if (!raw || !raw.length) continue;
      const flat = flattenCandidateRecords(raw);
      const normalized = flat
        .map((record, index) => normalizeRecord(record, sourceName, index))
        .filter(x => x.ok)
        .map(x => x.value);
      const identities = groupObservations(normalized);

      const candidate = { sourceName, flat, normalized, identities };
      if (!best || normalized.length > best.normalized.length) best = candidate;
    }

    return best ? { ...best, diagnostics } : { sourceName: null, flat: [], normalized: [], identities: [], diagnostics };
  }

  function publish(result) {
    const multiPointIdentities = result.identities.filter(x => x.isMultiPoint);
    const changedIdentities = result.identities.filter(x => x.hasCoordinateChange);

    const canonicalIdentities =
      multiPointIdentities.length > 0
        ? multiPointIdentities
        : (CONFIG.allowSinglePointFallback ? result.identities : []);

    const canonicalFeed = canonicalIdentities.flatMap(identity =>
      identity.observations.map(obs => ({
        ...obs,
        canonicalPersistentId: identity.persistentId,
        temporalSequenceLength: identity.observationCount,
        uniqueCoordinateCount: identity.uniqueCoordinateCount,
        hasCoordinateChange: identity.hasCoordinateChange,
        feedPriorityPhase: PHASE
      }))
    );

    state.canonicalFeed = canonicalFeed;
    state.identities = new Map(canonicalIdentities.map(x => [x.persistentId, x]));
    state.sourceUsed = result.sourceName;

    // Canonical globals for downstream phases.
    global.RainGuardReconciledTemporalPriorityFeedV39 = canonicalFeed;
    global.RainGuardCanonicalTemporalFeedV39 = canonicalFeed;
    global.RainGuardCanonicalTemporalIdentitiesV39 = canonicalIdentities;

    // Compatibility aliases likely consumed by downstream bridges.
    global.RainGuardTemporalRecoveryFeedV39 = canonicalFeed;
    global.RainGuardPersistentTemporalFeedV39 = canonicalFeed;

    return {
      canonicalFeed,
      canonicalIdentities,
      multiPointIdentities,
      changedIdentities
    };
  }

  async function run(options = {}) {
    if (state.running) {
      return {
        success: false,
        phase: PHASE,
        version: VERSION,
        build: BUILD,
        status: "RUN_ALREADY_IN_PROGRESS"
      };
    }

    const startedAt = Date.now();
    state.running = true;
    state.lastError = null;

    try {
      const selected = resolvePreferredSource();
      const published = publish(selected);

      const status =
        published.changedIdentities.length > 0
          ? "RECONCILED_TEMPORAL_FEED_READY_WITH_COORDINATE_CHANGES"
          : published.multiPointIdentities.length > 0
            ? "RECONCILED_TEMPORAL_FEED_READY_MULTI_POINT_SAME_COORDINATE"
            : selected.normalized.length > 0
              ? "OBSERVATIONS_FOUND_BUT_NO_MULTI_POINT_IDENTITY"
              : "NO_VALID_TEMPORAL_OBSERVATIONS";

      const result = {
        success: true,
        phase: PHASE,
        version: VERSION,
        build: BUILD,
        status,
        generatedAt: Date.now(),
        durationMs: Date.now() - startedAt,

        sourceUsed: selected.sourceName,
        sourcePriority: [...SOURCE_PRIORITY],
        sourceDiagnostics: selected.diagnostics || [],

        sourceRecordCount: selected.flat.length,
        acceptedObservationCount: selected.normalized.length,
        rejectedObservationCount: Math.max(0, selected.flat.length - selected.normalized.length),

        identityCount: selected.identities.length,
        multiPointIdentityCount: published.multiPointIdentities.length,
        identitiesWithCoordinateChanges: published.changedIdentities.length,
        canonicalIdentityCount: published.canonicalIdentities.length,
        canonicalFeedCount: published.canonicalFeed.length,

        maxObservedPointsPerIdentity: selected.identities.reduce(
          (m, x) => Math.max(m, x.observationCount || 0), 0
        ),
        maxUniqueCoordinatesPerIdentity: selected.identities.reduce(
          (m, x) => Math.max(m, x.uniqueCoordinateCount || 0), 0
        ),

        identitySample: published.canonicalIdentities.slice(0, 10),
        feedSample: published.canonicalFeed.slice(0, 20)
      };

      state.lastRun = result;
      state.totals.runs += 1;
      state.totals.inputRecords += selected.flat.length;
      state.totals.acceptedRecords += selected.normalized.length;
      state.totals.rejectedRecords += Math.max(0, selected.flat.length - selected.normalized.length);
      state.totals.identityCount = selected.identities.length;
      state.totals.multiPointIdentityCount = published.multiPointIdentities.length;
      state.totals.coordinateChangeIdentityCount = published.changedIdentities.length;

      global.RainGuardReconciledTemporalFeedPriorityLastResultV39 = result;

      console.log(`[RainGuard Phase ${PHASE}] Reconciled Temporal Feed Priority Bridge result:`);
      console.log(result);
      return result;
    } catch (error) {
      state.lastError = error;
      const result = {
        success: false,
        phase: PHASE,
        version: VERSION,
        build: BUILD,
        status: "RECONCILED_TEMPORAL_FEED_PRIORITY_FAILED",
        generatedAt: Date.now(),
        durationMs: Date.now() - startedAt,
        error: String(error?.message || error)
      };
      state.lastRun = result;
      console.error(`[RainGuard Phase ${PHASE}]`, error);
      return result;
    } finally {
      state.running = false;
    }
  }

  function diagnose() {
    const result = {
      success: true,
      phase: PHASE,
      version: VERSION,
      build: BUILD,
      installed: state.installed,
      running: state.running,
      sourceUsed: state.sourceUsed,
      canonicalFeedCount: state.canonicalFeed.length,
      canonicalIdentityCount: state.identities.size,
      config: { ...CONFIG },
      sourcePriority: [...SOURCE_PRIORITY],
      totals: { ...state.totals },
      lastResult: state.lastRun,
      lastError: state.lastError ? String(state.lastError?.message || state.lastError) : null
    };
    console.log(`[RainGuard Phase ${PHASE}] Diagnostic:`);
    console.log(result);
    return result;
  }

  function getCanonicalFeed() {
    return state.canonicalFeed.slice();
  }

  function getCanonicalIdentities() {
    return Array.from(state.identities.values());
  }

  global.runRainGuardReconciledTemporalFeedPriorityBridge = run;
  global.diagnoseRainGuardReconciledTemporalFeedPriorityBridge = diagnose;
  global.getRainGuardReconciledTemporalPriorityFeed = getCanonicalFeed;
  global.getRainGuardCanonicalTemporalIdentities = getCanonicalIdentities;

  global.RainGuardReconciledTemporalFeedPriorityBridgeV39 = {
    phase: PHASE,
    version: VERSION,
    build: BUILD,
    config: CONFIG,
    sourcePriority: SOURCE_PRIORITY,
    state,
    run,
    diagnose,
    getCanonicalFeed,
    getCanonicalIdentities
  };

})(window);
