/**
 * RainGuard AI
 * Phase 39A-15F6D — Cross-Cycle Observation Persistence Bridge
 * File: cross_cycle_observation_persistence_bridge_39a15f6d.js
 *
 * Purpose:
 *  - Persist valid storm observations across refresh/update cycles.
 *  - Group observations by stable identity / track id.
 *  - Deduplicate repeated observations without inventing coordinates/timestamps.
 *  - Preserve enough temporal history for downstream sequence + motion-vector phases.
 *
 * Safety principles:
 *  - Never fabricate coordinates.
 *  - Never fabricate timestamps.
 *  - Never merge unrelated identities.
 *  - Reject (0,0) and invalid coordinates.
 *  - Keep bounded history to prevent unbounded memory growth.
 */

(function installRainGuardCrossCycleObservationPersistenceBridge(global) {
  "use strict";

  const PHASE = "39A-15F6D";
  const VERSION = "39A.15F6D.0";
  const BUILD = "rainguard-v39-cross-cycle-observation-persistence-bridge";

  const STORAGE_KEY = "RainGuard:39A15F6D:ObservationPersistence:v1";

  const CONFIG = Object.freeze({
    maxObservationsPerIdentity: 24,
    maxIdentityCount: 2500,
    maxAgeMs: 24 * 60 * 60 * 1000,
    dedupeTimeToleranceMs: 1000,
    dedupeCoordinatePrecision: 5,
    minTimestamp: 946684800000, // 2000-01-01
    autoUseRecoveryResult: true
  });

  const STATE = {
    installed: true,
    running: false,
    lastRunAt: null,
    lastError: null,
    lastResult: null,
    runCount: 0,
    restoredFromStorage: false,
    identities: new Map()
  };

  function finiteNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function normalizeTimestamp(value) {
    if (value == null) return null;

    if (typeof value === "number") {
      if (!Number.isFinite(value)) return null;
      if (value < 1e11) value *= 1000; // seconds -> ms
      return value >= CONFIG.minTimestamp ? Math.round(value) : null;
    }

    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) return null;

      const numeric = Number(trimmed);
      if (Number.isFinite(numeric)) {
        return normalizeTimestamp(numeric);
      }

      const parsed = Date.parse(trimmed);
      return Number.isFinite(parsed) && parsed >= CONFIG.minTimestamp ? parsed : null;
    }

    return null;
  }

  function getCoordinate(record) {
    if (!record || typeof record !== "object") return null;

    const coordinate =
      record.coordinate && typeof record.coordinate === "object"
        ? record.coordinate
        : record.currentCoordinate && typeof record.currentCoordinate === "object"
          ? record.currentCoordinate
          : null;

    const lat = finiteNumber(
      record.latitude ??
      record.lat ??
      coordinate?.latitude ??
      coordinate?.lat
    );

    const lon = finiteNumber(
      record.longitude ??
      record.lon ??
      record.lng ??
      coordinate?.longitude ??
      coordinate?.lon ??
      coordinate?.lng
    );

    if (lat == null || lon == null) return null;
    if (lat === 0 && lon === 0) return null;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;

    return { latitude: lat, longitude: lon };
  }

  function normalizeIdentity(record) {
    if (!record || typeof record !== "object") return null;

    const candidates = [
      record.persistentId,
      record.identity,
      record.canonicalTrackId,
      record.trackId,
      record.cellId,
      record.id
    ];

    for (const candidate of candidates) {
      if (candidate == null) continue;
      const value = String(candidate).trim();
      if (!value) continue;

      if (/^(null|undefined)$/i.test(value)) continue;

      // Avoid using pure coordinate-derived synthetic keys as durable identities.
      if (/^SOURCE[-_:]/i.test(value)) continue;

      return value.startsWith("track:") || value.startsWith("RG-")
        ? value
        : `track:${value}`;
    }

    return null;
  }

  function normalizeObservation(record, sourceName) {
    if (!record || typeof record !== "object") return null;

    const coordinate = getCoordinate(record);
    if (!coordinate) return null;

    const identity = normalizeIdentity(record);
    if (!identity) return null;

    const observedAt = normalizeTimestamp(
      record.observedAt ??
      record.timestamp ??
      record.time ??
      record.createdAt ??
      record.updatedAt ??
      record.accumulatedAt
    );

    if (observedAt == null) return null;

    const confidence = finiteNumber(record.confidence);
    const intensity = finiteNumber(record.intensity);

    return {
      identity,
      identityType: record.identityType || "trackId",
      persistentId: record.persistentId || null,
      canonicalTrackId: record.canonicalTrackId || null,
      trackId: record.trackId || null,
      cellId: record.cellId || null,
      latitude: coordinate.latitude,
      longitude: coordinate.longitude,
      lat: coordinate.latitude,
      lon: coordinate.longitude,
      coordinate: {
        latitude: coordinate.latitude,
        longitude: coordinate.longitude
      },
      observedAt,
      timestamp: observedAt,
      confidence: confidence == null ? null : confidence,
      intensity: intensity == null ? null : intensity,
      source: sourceName || record.source || "unknown",
      phase: PHASE,
      version: VERSION
    };
  }

  function makeObservationKey(obs) {
    const p = CONFIG.dedupeCoordinatePrecision;
    const lat = Number(obs.latitude).toFixed(p);
    const lon = Number(obs.longitude).toFixed(p);
    const bucket = Math.round(obs.timestamp / CONFIG.dedupeTimeToleranceMs);
    return `${lat}|${lon}|${bucket}`;
  }

  function serializeState() {
    const identities = [];

    for (const [identity, observations] of STATE.identities.entries()) {
      identities.push({
        identity,
        observations: observations.slice(-CONFIG.maxObservationsPerIdentity)
      });
    }

    return {
      phase: PHASE,
      version: VERSION,
      savedAt: Date.now(),
      identities
    };
  }

  function saveState() {
    try {
      const payload = serializeState();
      global.localStorage?.setItem(STORAGE_KEY, JSON.stringify(payload));
      return true;
    } catch (error) {
      console.warn("[RainGuard 39A-15F6D] localStorage save failed:", error);
      return false;
    }
  }

  function restoreState() {
    if (STATE.restoredFromStorage) return;

    STATE.restoredFromStorage = true;

    try {
      const raw = global.localStorage?.getItem(STORAGE_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.identities)) return;

      const now = Date.now();

      for (const entry of parsed.identities.slice(0, CONFIG.maxIdentityCount)) {
        if (!entry || !entry.identity || !Array.isArray(entry.observations)) continue;

        const valid = entry.observations
          .filter(obs => obs && typeof obs === "object")
          .filter(obs => {
            const ts = normalizeTimestamp(obs.timestamp ?? obs.observedAt);
            return ts != null && now - ts <= CONFIG.maxAgeMs;
          })
          .slice(-CONFIG.maxObservationsPerIdentity);

        if (valid.length) {
          STATE.identities.set(String(entry.identity), valid);
        }
      }
    } catch (error) {
      console.warn("[RainGuard 39A-15F6D] localStorage restore failed:", error);
    }
  }

  function pruneState() {
    const now = Date.now();

    for (const [identity, observations] of STATE.identities.entries()) {
      const kept = observations
        .filter(obs => {
          const ts = normalizeTimestamp(obs.timestamp ?? obs.observedAt);
          return ts != null && now - ts <= CONFIG.maxAgeMs;
        })
        .sort((a, b) => a.timestamp - b.timestamp)
        .slice(-CONFIG.maxObservationsPerIdentity);

      if (kept.length) {
        STATE.identities.set(identity, kept);
      } else {
        STATE.identities.delete(identity);
      }
    }

    if (STATE.identities.size > CONFIG.maxIdentityCount) {
      const ranked = [...STATE.identities.entries()]
        .map(([identity, observations]) => ({
          identity,
          observations,
          lastTime: observations.length
            ? Number(observations[observations.length - 1].timestamp) || 0
            : 0
        }))
        .sort((a, b) => b.lastTime - a.lastTime)
        .slice(0, CONFIG.maxIdentityCount);

      STATE.identities.clear();
      for (const row of ranked) {
        STATE.identities.set(row.identity, row.observations);
      }
    }
  }

  function extractCandidateRecords(options = {}) {
    const candidates = [];

    function pushArray(name, value) {
      if (Array.isArray(value) && value.length) {
        candidates.push({ name, records: value });
      }
    }

    pushArray("options.records", options.records);

    const lastRecovery = global.RainGuardLiveTrackHistoryRecoveryLastResult;
    if (lastRecovery && typeof lastRecovery === "object") {
      pushArray("RainGuardLiveTrackHistoryRecoveryLastResult.records", lastRecovery.records);
      pushArray("RainGuardLiveTrackHistoryRecoveryLastResult.recoveredRecords", lastRecovery.recoveredRecords);
      pushArray("RainGuardLiveTrackHistoryRecoveryLastResult.observations", lastRecovery.observations);
      pushArray("RainGuardLiveTrackHistoryRecoveryLastResult.output", lastRecovery.output);
    }

    pushArray("RainGuardLiveTrackHistoryRecoveredRecordsV39", global.RainGuardLiveTrackHistoryRecoveredRecordsV39);
    pushArray("RainGuardRecoveredLiveTrackHistoryV39", global.RainGuardRecoveredLiveTrackHistoryV39);
    pushArray("RainGuardPersistentIdentityMotionRecordsV39", global.RainGuardPersistentIdentityMotionRecordsV39);

    // RainArrivalLiveTrackHistory is commonly an object whose properties are arrays.
    const history = global.RainArrivalLiveTrackHistory;
    if (history && typeof history === "object") {
      if (Array.isArray(history)) {
        pushArray("RainArrivalLiveTrackHistory", history);
      } else {
        const flattened = [];
        for (const [key, value] of Object.entries(history)) {
          if (!Array.isArray(value)) continue;
          for (const item of value) {
            if (item && typeof item === "object") {
              flattened.push({
                ...item,
                trackId: item.trackId ?? key,
                identity: item.identity ?? `track:${key}`
              });
            }
          }
        }
        pushArray("RainArrivalLiveTrackHistory[*]", flattened);
      }
    }

    // Use the first non-empty explicit/recovery source.
    return candidates.length
      ? candidates[0]
      : { name: "none", records: [] };
  }

  function addObservation(obs, stats) {
    let list = STATE.identities.get(obs.identity);

    if (!list) {
      list = [];
      STATE.identities.set(obs.identity, list);
      stats.newIdentityCount += 1;
    }

    const key = makeObservationKey(obs);
    const existingKeys = new Set(list.map(makeObservationKey));

    if (existingKeys.has(key)) {
      stats.duplicateObservationCount += 1;
      return false;
    }

    list.push(obs);
    list.sort((a, b) => a.timestamp - b.timestamp);

    if (list.length > CONFIG.maxObservationsPerIdentity) {
      list.splice(0, list.length - CONFIG.maxObservationsPerIdentity);
    }

    STATE.identities.set(obs.identity, list);
    stats.acceptedObservationCount += 1;

    return true;
  }

  function buildOutput() {
    const identities = [];
    const multiPointIdentities = [];
    const singlePointIdentities = [];
    let totalObservationCount = 0;

    for (const [identity, observations] of STATE.identities.entries()) {
      if (!observations.length) continue;

      const sorted = observations.slice().sort((a, b) => a.timestamp - b.timestamp);
      totalObservationCount += sorted.length;

      const row = {
        identity,
        observationCount: sorted.length,
        firstObservedAt: sorted[0].timestamp,
        lastObservedAt: sorted[sorted.length - 1].timestamp,
        observations: sorted
      };

      identities.push(row);

      if (sorted.length >= 2) {
        multiPointIdentities.push(row);
      } else {
        singlePointIdentities.push(row);
      }
    }

    identities.sort((a, b) => b.lastObservedAt - a.lastObservedAt);
    multiPointIdentities.sort((a, b) => b.lastObservedAt - a.lastObservedAt);
    singlePointIdentities.sort((a, b) => b.lastObservedAt - a.lastObservedAt);

    return {
      identities,
      multiPointIdentities,
      singlePointIdentities,
      totalObservationCount
    };
  }

  async function runRainGuardCrossCycleObservationPersistenceBridge(options = {}) {
    if (STATE.running) {
      return {
        success: true,
        phase: PHASE,
        version: VERSION,
        build: BUILD,
        status: "RUN_ALREADY_IN_PROGRESS",
        lastResult: STATE.lastResult
      };
    }

    STATE.running = true;
    STATE.lastError = null;
    const startedAt = Date.now();

    try {
      restoreState();
      pruneState();

      const source = extractCandidateRecords(options);

      const stats = {
        inputRecordCount: source.records.length,
        acceptedObservationCount: 0,
        rejectedObservationCount: 0,
        duplicateObservationCount: 0,
        newIdentityCount: 0
      };

      for (const record of source.records) {
        const normalized = normalizeObservation(record, source.name);
        if (!normalized) {
          stats.rejectedObservationCount += 1;
          continue;
        }

        addObservation(normalized, stats);
      }

      pruneState();
      const output = buildOutput();
      const saved = saveState();

      const status =
        output.multiPointIdentities.length > 0
          ? "CROSS_CYCLE_OBSERVATIONS_PERSISTED_WITH_MULTI_POINT_IDENTITIES"
          : output.identities.length > 0
            ? "CROSS_CYCLE_OBSERVATIONS_PERSISTED_SINGLE_POINT_ONLY"
            : "NO_VALID_OBSERVATIONS_TO_PERSIST";

      const result = {
        success: true,
        phase: PHASE,
        version: VERSION,
        build: BUILD,
        status,
        generatedAt: Date.now(),
        durationMs: Date.now() - startedAt,
        source: source.name,
        storageKey: STORAGE_KEY,
        storageSaved: saved,

        inputRecordCount: stats.inputRecordCount,
        acceptedObservationCount: stats.acceptedObservationCount,
        rejectedObservationCount: stats.rejectedObservationCount,
        duplicateObservationCount: stats.duplicateObservationCount,
        newIdentityCount: stats.newIdentityCount,

        persistedIdentityCount: output.identities.length,
        persistedObservationCount: output.totalObservationCount,
        multiPointIdentityCount: output.multiPointIdentities.length,
        singlePointIdentityCount: output.singlePointIdentities.length,

        multiPointSample: output.multiPointIdentities.slice(0, 10),
        identitySample: output.identities.slice(0, 10)
      };

      // Publish canonical globals for downstream phases.
      global.RainGuardCrossCycleObservationPersistenceV39 = output.identities;
      global.RainGuardCrossCycleObservationPersistenceByIdentityV39 =
        new Map(output.identities.map(item => [item.identity, item.observations]));
      global.RainGuardCrossCycleMultiPointIdentitiesV39 = output.multiPointIdentities;
      global.RainGuardCrossCycleObservationPersistenceLastResult = result;

      // Helpful compatibility aliases for the temporal sequence builder.
      global.RainGuardPersistentTemporalObservationGroupsV39 = output.identities;
      global.RainGuardPersistentMultiPointObservationGroupsV39 = output.multiPointIdentities;

      STATE.runCount += 1;
      STATE.lastRunAt = result.generatedAt;
      STATE.lastResult = result;

      console.log("[RainGuard Phase 39A-15F6D] Cross-Cycle Observation Persistence result:");
      console.log(result);

      return result;
    } catch (error) {
      STATE.lastError = error;

      const result = {
        success: false,
        phase: PHASE,
        version: VERSION,
        build: BUILD,
        status: "CROSS_CYCLE_OBSERVATION_PERSISTENCE_FAILED",
        generatedAt: Date.now(),
        durationMs: Date.now() - startedAt,
        error: String(error && error.message ? error.message : error)
      };

      STATE.lastResult = result;
      global.RainGuardCrossCycleObservationPersistenceLastResult = result;

      console.error("[RainGuard Phase 39A-15F6D] Failed:", error);
      return result;
    } finally {
      STATE.running = false;
    }
  }

  function getRainGuardCrossCycleObservationPersistenceState() {
    const output = buildOutput();

    return {
      phase: PHASE,
      version: VERSION,
      build: BUILD,
      installed: STATE.installed,
      running: STATE.running,
      runCount: STATE.runCount,
      lastRunAt: STATE.lastRunAt,
      lastError: STATE.lastError,
      lastResult: STATE.lastResult,
      persistedIdentityCount: output.identities.length,
      persistedObservationCount: output.totalObservationCount,
      multiPointIdentityCount: output.multiPointIdentities.length,
      singlePointIdentityCount: output.singlePointIdentities.length
    };
  }

  function clearRainGuardCrossCycleObservationPersistence(options = {}) {
    STATE.identities.clear();
    STATE.lastResult = null;

    if (options.clearStorage !== false) {
      try {
        global.localStorage?.removeItem(STORAGE_KEY);
      } catch (_) {}
    }

    global.RainGuardCrossCycleObservationPersistenceV39 = [];
    global.RainGuardCrossCycleMultiPointIdentitiesV39 = [];
    global.RainGuardPersistentTemporalObservationGroupsV39 = [];
    global.RainGuardPersistentMultiPointObservationGroupsV39 = [];

    return {
      success: true,
      phase: PHASE,
      status: "CROSS_CYCLE_OBSERVATION_PERSISTENCE_CLEARED"
    };
  }

  function diagnoseRainGuardCrossCycleObservationPersistence() {
    const output = buildOutput();

    const result = {
      phase: PHASE,
      version: VERSION,
      build: BUILD,
      installed: true,
      storageKey: STORAGE_KEY,
      storageAvailable: Boolean(global.localStorage),
      runFunctionAvailable:
        typeof global.runRainGuardCrossCycleObservationPersistenceBridge === "function",
      sourceRecoveryResultAvailable:
        Boolean(global.RainGuardLiveTrackHistoryRecoveryLastResult),
      liveTrackHistoryAvailable:
        Boolean(global.RainArrivalLiveTrackHistory),
      identityCount: output.identities.length,
      observationCount: output.totalObservationCount,
      multiPointIdentityCount: output.multiPointIdentities.length,
      singlePointIdentityCount: output.singlePointIdentities.length,
      sample: output.identities.slice(0, 5)
    };

    console.log("[RainGuard Phase 39A-15F6D] Diagnostic:");
    console.log(result);

    return result;
  }

  // Expose API
  global.runRainGuardCrossCycleObservationPersistenceBridge =
    runRainGuardCrossCycleObservationPersistenceBridge;

  global.getRainGuardCrossCycleObservationPersistenceState =
    getRainGuardCrossCycleObservationPersistenceState;

  global.clearRainGuardCrossCycleObservationPersistence =
    clearRainGuardCrossCycleObservationPersistence;

  global.diagnoseRainGuardCrossCycleObservationPersistence =
    diagnoseRainGuardCrossCycleObservationPersistence;

  global.RainGuardCrossCycleObservationPersistenceBridge = {
    phase: PHASE,
    version: VERSION,
    build: BUILD,
    config: CONFIG,
    state: STATE,
    run: runRainGuardCrossCycleObservationPersistenceBridge,
    getState: getRainGuardCrossCycleObservationPersistenceState,
    clear: clearRainGuardCrossCycleObservationPersistence,
    diagnose: diagnoseRainGuardCrossCycleObservationPersistence
  };

  restoreState();

  console.log(
    `[RainGuard ${PHASE}] Cross-Cycle Observation Persistence Bridge installed.`,
    {
      version: VERSION,
      restoredIdentityCount: STATE.identities.size,
      storageKey: STORAGE_KEY
    }
  );
})(window);
