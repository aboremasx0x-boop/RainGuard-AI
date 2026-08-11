/**
 * RainGuard AI
 * Phase 39A-15F6F — Persistent Identity Temporal Accumulator
 */
(function installRainGuardPersistentIdentityTemporalAccumulator(global) {
  "use strict";

  const PHASE = "39A-15F6F";
  const VERSION = "39A.15F6F.0";
  const BUILD = "rainguard-v39-persistent-identity-temporal-accumulator";

  const CONFIG = Object.freeze({
    maxPointsPerIdentity: 8,
    maxIdentities: 1500,
    maxGlobalObservations: 6000,
    maxAgeMs: 6 * 60 * 60 * 1000,
    dedupeWindowMs: 1500,
    coordinatePrecision: 5
  });

  const now = () => Date.now();
  const finite = v => { const n = Number(v); return Number.isFinite(n) ? n : null; };

  function cloneValue(value) {
    if (value == null || typeof value !== "object") return value;
    if (typeof structuredClone === "function") {
      try { return structuredClone(value); } catch (_) {}
    }
    try { return JSON.parse(JSON.stringify(value)); } catch (_) { return value; }
  }

  function normalizeIdentity(record) {
    if (!record || typeof record !== "object") return null;
    const candidates = [
      record.persistentId,
      record.identity,
      record.canonicalTrackId,
      record.trackId,
      record.cellId,
      record.stormId,
      record.entityId,
      record.id
    ];
    for (const value of candidates) {
      if (typeof value === "string" && value.trim()) return value.trim();
      if (typeof value === "number" && Number.isFinite(value)) return String(value);
    }
    return null;
  }

  function normalizeCoordinates(record) {
    if (!record || typeof record !== "object") return null;
    let lat = finite(record.latitude ?? record.lat);
    let lon = finite(record.longitude ?? record.lon ?? record.lng);
    if ((lat == null || lon == null) && record.coordinate && typeof record.coordinate === "object") {
      lat = finite(record.coordinate.latitude ?? record.coordinate.lat);
      lon = finite(record.coordinate.longitude ?? record.coordinate.lon ?? record.coordinate.lng);
    }
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
    if (lat === 0 && lon === 0) return null;
    return { latitude: lat, longitude: lon, lat, lon };
  }

  function normalizeTimestamp(record) {
    const candidates = [
      record?.observedAt,
      record?.timestamp,
      record?.time,
      record?.accumulatedAt,
      record?.generatedAt,
      record?.createdAt,
      record?.updatedAt
    ];
    for (const value of candidates) {
      if (value == null) continue;
      if (typeof value === "number" && Number.isFinite(value)) return value < 1e12 ? value * 1000 : value;
      if (typeof value === "string") {
        const n = Number(value);
        if (Number.isFinite(n)) return n < 1e12 ? n * 1000 : n;
        const p = Date.parse(value);
        if (Number.isFinite(p)) return p;
      }
      if (value instanceof Date) {
        const t = value.getTime();
        if (Number.isFinite(t)) return t;
      }
    }
    return null;
  }

  function sourceName(record, fallback) {
    const value = record?.source ?? record?.sourceName ?? record?.provider ?? record?.originSource;
    return typeof value === "string" && value.trim() ? value.trim() : fallback;
  }

  function ensureState() {
    let state = global.RainGuardPersistentIdentityTemporalAccumulatorV39;
    if (!state || typeof state !== "object") {
      state = {
        phase: PHASE,
        version: VERSION,
        build: BUILD,
        installed: true,
        running: false,
        createdAt: now(),
        updatedAt: now(),
        lastRun: null,
        lastResult: null,
        lastError: null,
        config: { ...CONFIG },
        histories: new Map(),
        totals: { runs: 0, input: 0, accepted: 0, duplicates: 0, rejected: 0, evictedPoints: 0, evictedIdentities: 0 }
      };
      global.RainGuardPersistentIdentityTemporalAccumulatorV39 = state;
    }
    if (!(state.histories instanceof Map)) state.histories = new Map();
    return state;
  }

  function addCandidateSource(out, label, value) {
    if (!value) return;
    if (Array.isArray(value)) {
      out.push({ source: label, records: value });
      return;
    }
    if (value instanceof Map) {
      for (const [key, item] of value.entries()) {
        if (Array.isArray(item)) out.push({ source: `${label}.${String(key)}`, records: item });
        else if (item && Array.isArray(item.points)) out.push({ source: `${label}.${String(key)}.points`, records: item.points });
        else if (item && Array.isArray(item.observations)) out.push({ source: `${label}.${String(key)}.observations`, records: item.observations });
      }
      return;
    }
    if (typeof value === "object") {
      for (const key of Object.keys(value)) {
        const item = value[key];
        if (Array.isArray(item)) out.push({ source: `${label}.${key}`, records: item });
      }
    }
  }

  function collectSources(explicitInput) {
    const out = [];
    if (Array.isArray(explicitInput)) out.push({ source: "options.input", records: explicitInput });

    const names = [
      "RainGuardPersistentObservationMemoryV39",
      "RainGuardPersistentIdentityMotionRecordsV39",
      "RainGuardCrossCycleObservationPersistenceV39",
      "RainGuardRecoveredLiveTrackHistoryV39",
      "RainGuardPersistentStormIdentitiesV39",
      "RainGuardReconciledStormIdentitiesV39",
      "RainGuardPersistentTemporalMotionFeedV39",
      "RainGuardArrivalLiveTrackHistory",
      "RainArrivalLiveTrackHistory"
    ];

    for (const name of names) addCandidateSource(out, name, global[name]);

    for (const key of Object.keys(global)) {
      if (!/RainGuard|RainArrival/i.test(key)) continue;
      if (!/history|observation|identity|temporal|track/i.test(key)) continue;
      if (names.includes(key)) continue;
      try { addCandidateSource(out, key, global[key]); } catch (_) {}
    }
    return out;
  }

  function normalizeRecord(record, source, index) {
    const identity = normalizeIdentity(record);
    if (!identity) return { ok: false, reason: "NO_IDENTITY" };
    const coordinates = normalizeCoordinates(record);
    if (!coordinates) return { ok: false, reason: "INVALID_COORDINATES" };
    const timestamp = normalizeTimestamp(record);
    if (!Number.isFinite(timestamp)) return { ok: false, reason: "INVALID_TIMESTAMP" };

    return {
      ok: true,
      point: {
        identity,
        persistentId: identity,
        trackId: record.trackId ?? null,
        canonicalTrackId: record.canonicalTrackId ?? null,
        cellId: record.cellId ?? null,
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        lat: coordinates.latitude,
        lon: coordinates.longitude,
        timestamp,
        observedAt: timestamp,
        confidence: finite(record.confidence),
        intensity: finite(record.intensity),
        source: sourceName(record, source),
        sourceIndex: index,
        phase: PHASE,
        accumulatedAt: now(),
        original: cloneValue(record)
      }
    };
  }

  function equivalent(a, b, cfg) {
    if (!a || !b) return false;
    const dt = Math.abs(Number(a.timestamp) - Number(b.timestamp));
    const eps = Math.pow(10, -cfg.coordinatePrecision);
    return dt <= cfg.dedupeWindowMs &&
      Math.abs(Number(a.latitude) - Number(b.latitude)) < eps &&
      Math.abs(Number(a.longitude) - Number(b.longitude)) < eps;
  }

  function sortHistory(history) {
    history.sort((a, b) => Number(a.timestamp) - Number(b.timestamp));
    return history;
  }

  function trimState(state, cfg) {
    let evictedPoints = 0;
    let evictedIdentities = 0;
    const cutoff = now() - cfg.maxAgeMs;

    for (const [identity, history] of state.histories.entries()) {
      const fresh = history.filter(p => Number(p.timestamp) >= cutoff);
      sortHistory(fresh);
      if (fresh.length > cfg.maxPointsPerIdentity) {
        evictedPoints += fresh.length - cfg.maxPointsPerIdentity;
        fresh.splice(0, fresh.length - cfg.maxPointsPerIdentity);
      }
      if (!fresh.length) {
        state.histories.delete(identity);
        evictedIdentities++;
      } else state.histories.set(identity, fresh);
    }

    if (state.histories.size > cfg.maxIdentities) {
      const ranked = [...state.histories.entries()]
        .map(([identity, history]) => ({ identity, last: history.at(-1)?.timestamp || 0 }))
        .sort((a, b) => a.last - b.last);
      const excess = state.histories.size - cfg.maxIdentities;
      for (let i = 0; i < excess; i++) {
        if (state.histories.delete(ranked[i].identity)) evictedIdentities++;
      }
    }

    return { evictedPoints, evictedIdentities };
  }

  function publish(state) {
    const groups = [];
    const historyObject = Object.create(null);

    for (const [identity, history] of state.histories.entries()) {
      const points = sortHistory([...history]);
      historyObject[identity] = points.map(cloneValue);
      groups.push({
        identity,
        pointCount: points.length,
        firstTimestamp: points[0]?.timestamp ?? null,
        lastTimestamp: points.at(-1)?.timestamp ?? null,
        durationMs: points.length > 1 ? points.at(-1).timestamp - points[0].timestamp : 0,
        latest: points.length ? cloneValue(points.at(-1)) : null,
        points: points.map(cloneValue)
      });
    }

    groups.sort((a, b) => (b.pointCount - a.pointCount) || ((b.lastTimestamp || 0) - (a.lastTimestamp || 0)));
    global.RainGuardPersistentTemporalIdentityHistoryV39 = historyObject;
    global.RainGuardPersistentTemporalIdentityGroupsV39 = groups;
    return groups;
  }

  async function run(options = {}) {
    const state = ensureState();
    if (state.running) return { success: false, phase: PHASE, status: "ALREADY_RUNNING" };
    state.running = true;
    state.lastError = null;
    const startedAt = now();

    try {
      const cfg = { ...CONFIG, ...(state.config || {}), ...(options.config || {}) };
      state.config = { ...cfg };
      const sources = collectSources(options.input);
      const seenRefs = new Set();
      const normalized = [];
      const rejectionCounts = Object.create(null);
      let duplicateInputReferences = 0;

      for (const sourceEntry of sources) {
        for (let i = 0; i < sourceEntry.records.length; i++) {
          const record = sourceEntry.records[i];
          if (!record || typeof record !== "object") continue;
          if (seenRefs.has(record)) { duplicateInputReferences++; continue; }
          seenRefs.add(record);
          const n = normalizeRecord(record, sourceEntry.source, i);
          if (!n.ok) {
            rejectionCounts[n.reason] = (rejectionCounts[n.reason] || 0) + 1;
            continue;
          }
          normalized.push(n.point);
        }
      }

      normalized.sort((a, b) => a.timestamp - b.timestamp);
      let accepted = 0;
      let duplicates = 0;
      let rejected = Object.values(rejectionCounts).reduce((a, b) => a + b, 0);

      for (const point of normalized) {
        const history = state.histories.get(point.identity) || [];
        if (history.some(existing => equivalent(existing, point, cfg))) {
          duplicates++;
          continue;
        }

        const sameTimeConflict = history.some(existing =>
          Number(existing.timestamp) === Number(point.timestamp) &&
          (Number(existing.latitude) !== Number(point.latitude) || Number(existing.longitude) !== Number(point.longitude))
        );
        if (sameTimeConflict) {
          rejectionCounts.SAME_TIMESTAMP_CONFLICT = (rejectionCounts.SAME_TIMESTAMP_CONFLICT || 0) + 1;
          rejected++;
          continue;
        }

        history.push(point);
        sortHistory(history);
        if (history.length > cfg.maxPointsPerIdentity) history.splice(0, history.length - cfg.maxPointsPerIdentity);
        state.histories.set(point.identity, history);
        accepted++;
      }

      const trimmed = trimState(state, cfg);
      const groups = publish(state);
      const singlePointIdentityCount = groups.filter(g => g.pointCount === 1).length;
      const multiPointIdentityCount = groups.filter(g => g.pointCount >= 2).length;
      const maxObservedPointsPerIdentity = groups.reduce((m, g) => Math.max(m, g.pointCount), 0);
      const persistedObservationCount = groups.reduce((s, g) => s + g.pointCount, 0);

      const status = multiPointIdentityCount > 0
        ? "PERSISTENT_TEMPORAL_HISTORY_READY_MULTI_POINT"
        : singlePointIdentityCount > 0
          ? "PERSISTENT_TEMPORAL_HISTORY_READY_SINGLE_POINT_ONLY"
          : "PERSISTENT_TEMPORAL_ACCUMULATOR_EMPTY";

      state.totals.runs++;
      state.totals.input += normalized.length;
      state.totals.accepted += accepted;
      state.totals.duplicates += duplicates;
      state.totals.rejected += rejected;
      state.totals.evictedPoints += trimmed.evictedPoints;
      state.totals.evictedIdentities += trimmed.evictedIdentities;

      const result = {
        success: true,
        phase: PHASE,
        version: VERSION,
        build: BUILD,
        status,
        durationMs: now() - startedAt,
        generatedAt: now(),
        sourceCount: sources.length,
        sourceRecordCount: seenRefs.size,
        duplicateInputReferences,
        normalizedRecordCount: normalized.length,
        acceptedObservationCount: accepted,
        duplicateObservationCount: duplicates,
        rejectedObservationCount: rejected,
        rejectionCounts,
        persistedIdentityCount: groups.length,
        persistedObservationCount,
        singlePointIdentityCount,
        multiPointIdentityCount,
        maxObservedPointsPerIdentity,
        evictedPointCount: trimmed.evictedPoints,
        evictedIdentityCount: trimmed.evictedIdentities,
        sample: groups.slice(0, 10),
        multiPointSample: groups.filter(g => g.pointCount >= 2).slice(0, 10),
        sourceNames: [...new Set(sources.map(s => s.source))].slice(0, 50)
      };

      state.lastRun = result.generatedAt;
      state.updatedAt = result.generatedAt;
      state.lastResult = result;
      global.RainGuardPersistentIdentityTemporalAccumulatorLastResultV39 = result;

      console.groupCollapsed(`[RainGuard Phase ${PHASE}] Persistent Identity Temporal Accumulator result:`);
      console.log(result);
      if (result.multiPointSample.length) {
        console.table(result.multiPointSample.map(g => ({
          identity: g.identity,
          points: g.pointCount,
          durationMs: g.durationMs,
          first: g.firstTimestamp,
          last: g.lastTimestamp
        })));
      }
      console.groupEnd();

      try {
        global.dispatchEvent(new CustomEvent("rainguard:persistent-temporal-history-ready", { detail: result }));
      } catch (_) {}

      return result;
    } catch (error) {
      state.lastError = { message: String(error?.message || error), stack: error?.stack || null, at: now() };
      const result = { success: false, phase: PHASE, version: VERSION, build: BUILD, status: "PERSISTENT_TEMPORAL_ACCUMULATOR_ERROR", error: state.lastError };
      state.lastResult = result;
      console.error(`[RainGuard Phase ${PHASE}]`, error);
      return result;
    } finally {
      state.running = false;
    }
  }

  function diagnose() {
    const state = ensureState();
    const groups = Array.isArray(global.RainGuardPersistentTemporalIdentityGroupsV39)
      ? global.RainGuardPersistentTemporalIdentityGroupsV39
      : publish(state);

    const diagnosis = {
      success: true,
      phase: PHASE,
      version: VERSION,
      build: BUILD,
      installed: true,
      running: !!state.running,
      identityCount: groups.length,
      observationCount: groups.reduce((s, g) => s + g.pointCount, 0),
      singlePointIdentityCount: groups.filter(g => g.pointCount === 1).length,
      multiPointIdentityCount: groups.filter(g => g.pointCount >= 2).length,
      maxObservedPointsPerIdentity: groups.reduce((m, g) => Math.max(m, g.pointCount), 0),
      config: { ...state.config },
      lastRun: state.lastRun,
      lastError: state.lastError,
      lastResult: state.lastResult,
      totals: { ...state.totals },
      sampleGroups: groups.slice(0, 20)
    };

    console.groupCollapsed(`[RainGuard Phase ${PHASE}] Diagnostic:`);
    console.log(diagnosis);
    console.groupEnd();
    return diagnosis;
  }

  function getState() { return ensureState(); }
  function getHistory(identity) {
    return (ensureState().histories.get(String(identity)) || []).map(cloneValue);
  }
  function clear() {
    const state = ensureState();
    state.histories.clear();
    state.lastRun = null;
    state.lastResult = null;
    state.lastError = null;
    publish(state);
    return true;
  }

  global.runRainGuardPersistentIdentityTemporalAccumulator = run;
  global.diagnoseRainGuardPersistentIdentityTemporalAccumulator = diagnose;
  global.getRainGuardPersistentIdentityTemporalAccumulatorState = getState;
  global.getRainGuardPersistentIdentityTemporalHistory = getHistory;
  global.clearRainGuardPersistentIdentityTemporalAccumulator = clear;
  global.runRainGuardPersistentTemporalAccumulator = run;
  global.diagnoseRainGuardPersistentTemporalAccumulator = diagnose;

  ensureState();
  console.info(`[RainGuard Phase ${PHASE}] Installed — Persistent Identity Temporal Accumulator`);
})(window);
