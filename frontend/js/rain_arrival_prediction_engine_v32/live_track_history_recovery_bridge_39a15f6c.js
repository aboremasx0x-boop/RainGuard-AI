/**
 * RainGuard AI
 * Phase 39A-15F6C — Live Track History Recovery Bridge
 *
 * File:
 *   live_track_history_recovery_bridge_39a15f6c.js
 *
 * Purpose:
 *   - Recover valid historical storm observations from RainArrivalLiveTrackHistory.
 *   - Preserve real identity, coordinates, and observation timestamps.
 *   - Reject zero / invalid coordinates and invalid timestamps.
 *   - Publish normalized multi-point histories for downstream temporal sequence
 *     and motion-vector builders.
 *
 * Confirmed source schema:
 *   identity
 *   identityType
 *   trackId
 *   cellId
 *   latitude
 *   longitude
 *   coordinate: { latitude, longitude }
 *   observedAt
 *   timestamp
 *   accumulatedAt
 *   confidence
 *   intensity
 *   source
 *   phase
 */

(function installRainGuardLiveTrackHistoryRecoveryBridge(global) {
  "use strict";

  const PHASE = "39A-15F6C";
  const VERSION = "39A.15F6C.0";
  const BUILD = "rainguard-v39-live-track-history-recovery-bridge";

  const CONFIG = {
    minLatitude: 15.0,
    maxLatitude: 33.5,
    minLongitude: 34.0,
    maxLongitude: 56.5,

    // Reject implausibly old / future timestamps.
    maxAgeMs: 7 * 24 * 60 * 60 * 1000,
    maxFutureSkewMs: 10 * 60 * 1000,

    // Keep enough history for motion estimation without unbounded growth.
    maxRecordsPerIdentity: 120,
    minRecordsForTemporalSequence: 2,

    publishAliases: true,
    autoRun: true,
    autoRunDelayMs: 1200
  };

  const STATE = {
    installed: true,
    running: false,
    runs: 0,
    lastRun: null,
    lastError: null,
    sourceIdentityCount: 0,
    sourceRecordCount: 0,
    acceptedRecordCount: 0,
    rejectedRecordCount: 0,
    recoveredIdentityCount: 0,
    multiPointIdentityCount: 0,
    singlePointIdentityCount: 0,
    duplicateCount: 0,
    normalized: [],
    byIdentity: new Map(),
    result: null
  };

  function finiteNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function nonEmptyString(value) {
    if (typeof value !== "string") return null;
    const s = value.trim();
    return s ? s : null;
  }

  function firstString(...values) {
    for (const value of values) {
      const s = nonEmptyString(value);
      if (s) return s;
    }
    return null;
  }

  function firstNumber(...values) {
    for (const value of values) {
      const n = finiteNumber(value);
      if (n !== null) return n;
    }
    return null;
  }

  function isValidCoordinate(lat, lon) {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
    if (lat === 0 && lon === 0) return false;
    if (lat < CONFIG.minLatitude || lat > CONFIG.maxLatitude) return false;
    if (lon < CONFIG.minLongitude || lon > CONFIG.maxLongitude) return false;
    return true;
  }

  function normalizeTimestamp(raw) {
    let t = finiteNumber(raw);
    if (t === null || t <= 0) return null;

    // Convert seconds to milliseconds when needed.
    if (t < 10_000_000_000) t *= 1000;

    const now = Date.now();

    // The project may replay synthetic/future captures, so only reject clearly
    // impossible values, not every timestamp outside wall-clock time.
    if (t < 946684800000) return null; // before 2000-01-01
    if (t > now + (365 * 24 * 60 * 60 * 1000)) {
      // Keep project-generated epochs if they are internally consistent.
      // Do not reject solely because the host clock differs.
    }

    return Math.round(t);
  }

  function sourceEntries(source) {
    if (!source) return [];

    if (source instanceof Map) {
      return Array.from(source.entries());
    }

    if (Array.isArray(source)) {
      return source.map((value, index) => [String(index), value]);
    }

    if (typeof source === "object") {
      return Object.entries(source);
    }

    return [];
  }

  function extractRecords(value) {
    if (!value) return [];

    if (Array.isArray(value)) return value;

    if (value instanceof Map) return Array.from(value.values());

    if (typeof value === "object") {
      const candidates = [
        value.records,
        value.history,
        value.observations,
        value.points,
        value.items,
        value.samples,
        value.entries
      ];

      for (const candidate of candidates) {
        if (Array.isArray(candidate)) return candidate;
      }

      // A single observation object.
      return [value];
    }

    return [];
  }

  function normalizeIdentity(key, record) {
    const identity = firstString(
      record && record.identity,
      key,
      record && record.persistentId,
      record && record.canonicalTrackId,
      record && record.trackId,
      record && record.cellId
    );

    const trackId = firstString(
      record && record.trackId,
      record && record.canonicalTrackId,
      record && record.cellId,
      identity && identity.replace(/^track:/i, "")
    );

    const cellId = firstString(
      record && record.cellId,
      trackId
    );

    return {
      identity: identity || (trackId ? `track:${trackId}` : null),
      trackId,
      cellId,
      identityType: firstString(
        record && record.identityType,
        trackId ? "trackId" : null
      )
    };
  }

  function normalizeObservation(key, record, sourceIndex) {
    if (!record || typeof record !== "object") {
      return { ok: false, reason: "INVALID_RECORD" };
    }

    const id = normalizeIdentity(key, record);

    const lat = firstNumber(
      record.latitude,
      record.lat,
      record.coordinate && record.coordinate.latitude,
      record.coordinate && record.coordinate.lat,
      record.position && record.position.latitude,
      record.position && record.position.lat,
      record.centroid && record.centroid.latitude,
      record.centroid && record.centroid.lat
    );

    const lon = firstNumber(
      record.longitude,
      record.lon,
      record.lng,
      record.coordinate && record.coordinate.longitude,
      record.coordinate && record.coordinate.lon,
      record.coordinate && record.coordinate.lng,
      record.position && record.position.longitude,
      record.position && record.position.lon,
      record.position && record.position.lng,
      record.centroid && record.centroid.longitude,
      record.centroid && record.centroid.lon,
      record.centroid && record.centroid.lng
    );

    if (!id.identity) {
      return { ok: false, reason: "NO_IDENTITY" };
    }

    if (!isValidCoordinate(lat, lon)) {
      return { ok: false, reason: "INVALID_COORDINATE" };
    }

    const timestamp = normalizeTimestamp(
      firstNumber(
        record.observedAt,
        record.timestamp,
        record.accumulatedAt,
        record.time,
        record.createdAt,
        record.updatedAt
      )
    );

    if (!timestamp) {
      return { ok: false, reason: "INVALID_TIMESTAMP" };
    }

    const confidence = firstNumber(record.confidence, 0);
    const intensity = firstNumber(record.intensity, 0);

    const normalized = {
      persistentId: id.identity,
      identity: id.identity,
      identityType: id.identityType || "trackId",
      trackId: id.trackId,
      canonicalTrackId: id.trackId,
      cellId: id.cellId,

      latitude: lat,
      longitude: lon,
      lat,
      lon,
      lng: lon,
      coordinate: {
        latitude: lat,
        longitude: lon,
        lat,
        lon,
        lng: lon
      },

      observedAt: timestamp,
      timestamp,
      accumulatedAt: normalizeTimestamp(record.accumulatedAt) || timestamp,

      confidence: confidence === null ? 0 : confidence,
      intensity: intensity === null ? 0 : intensity,

      source: firstString(record.source, "RainArrivalLiveTrackHistory"),
      sourceIndex,
      sourceHistoryKey: key,

      sourcePhase: record.phase || null,
      recoveryPhase: PHASE,
      recoveryVersion: VERSION,

      original: record
    };

    return { ok: true, value: normalized };
  }

  function dedupeKey(record) {
    return [
      record.identity,
      record.timestamp,
      Number(record.latitude).toFixed(6),
      Number(record.longitude).toFixed(6)
    ].join("|");
  }

  function sortHistory(records) {
    return records.slice().sort((a, b) => {
      if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp;
      if (a.latitude !== b.latitude) return a.latitude - b.latitude;
      return a.longitude - b.longitude;
    });
  }

  function recover() {
    const startedAt = Date.now();

    if (STATE.running) {
      return STATE.result || {
        success: false,
        phase: PHASE,
        version: VERSION,
        status: "RUN_ALREADY_IN_PROGRESS"
      };
    }

    STATE.running = true;
    STATE.lastError = null;

    try {
      const source = global.RainArrivalLiveTrackHistory;

      if (!source || (typeof source !== "object" && !(source instanceof Map))) {
        const result = {
          success: false,
          phase: PHASE,
          version: VERSION,
          build: BUILD,
          status: "LIVE_TRACK_HISTORY_NOT_AVAILABLE",
          generatedAt: Date.now()
        };
        STATE.result = result;
        STATE.lastRun = Date.now();
        return result;
      }

      const entries = sourceEntries(source);
      const seen = new Set();
      const normalized = [];
      const byIdentity = new Map();
      const rejectionCounts = {
        INVALID_RECORD: 0,
        NO_IDENTITY: 0,
        INVALID_COORDINATE: 0,
        INVALID_TIMESTAMP: 0
      };

      let sourceRecordCount = 0;
      let duplicateCount = 0;

      for (const [key, rawValue] of entries) {
        const records = extractRecords(rawValue);

        for (let i = 0; i < records.length; i++) {
          sourceRecordCount++;

          const n = normalizeObservation(key, records[i], i);

          if (!n.ok) {
            rejectionCounts[n.reason] = (rejectionCounts[n.reason] || 0) + 1;
            continue;
          }

          const record = n.value;
          const dKey = dedupeKey(record);

          if (seen.has(dKey)) {
            duplicateCount++;
            continue;
          }

          seen.add(dKey);
          normalized.push(record);

          if (!byIdentity.has(record.identity)) {
            byIdentity.set(record.identity, []);
          }
          byIdentity.get(record.identity).push(record);
        }
      }

      // Sort and cap each identity history.
      const stableByIdentity = new Map();
      let multiPointIdentityCount = 0;
      let singlePointIdentityCount = 0;

      for (const [identity, records] of byIdentity.entries()) {
        let sorted = sortHistory(records);

        if (sorted.length > CONFIG.maxRecordsPerIdentity) {
          sorted = sorted.slice(-CONFIG.maxRecordsPerIdentity);
        }

        stableByIdentity.set(identity, sorted);

        if (sorted.length >= CONFIG.minRecordsForTemporalSequence) {
          multiPointIdentityCount++;
        } else {
          singlePointIdentityCount++;
        }
      }

      const flattened = [];
      for (const records of stableByIdentity.values()) {
        flattened.push(...records);
      }

      flattened.sort((a, b) => a.timestamp - b.timestamp);

      const multiPointHistories = [];
      for (const [identity, records] of stableByIdentity.entries()) {
        if (records.length < CONFIG.minRecordsForTemporalSequence) continue;

        multiPointHistories.push({
          identity,
          persistentId: identity,
          trackId: records[records.length - 1].trackId,
          cellId: records[records.length - 1].cellId,
          observationCount: records.length,
          firstObservedAt: records[0].timestamp,
          lastObservedAt: records[records.length - 1].timestamp,
          observations: records,
          source: "RainArrivalLiveTrackHistory",
          phase: PHASE,
          version: VERSION
        });
      }

      const acceptedRecordCount = flattened.length;
      const rejectedRecordCount = sourceRecordCount - acceptedRecordCount - duplicateCount;

      STATE.runs += 1;
      STATE.lastRun = Date.now();
      STATE.sourceIdentityCount = entries.length;
      STATE.sourceRecordCount = sourceRecordCount;
      STATE.acceptedRecordCount = acceptedRecordCount;
      STATE.rejectedRecordCount = Math.max(0, rejectedRecordCount);
      STATE.recoveredIdentityCount = stableByIdentity.size;
      STATE.multiPointIdentityCount = multiPointIdentityCount;
      STATE.singlePointIdentityCount = singlePointIdentityCount;
      STATE.duplicateCount = duplicateCount;
      STATE.normalized = flattened;
      STATE.byIdentity = stableByIdentity;

      // Canonical outputs.
      global.RainGuardRecoveredLiveTrackHistoryV39 = flattened;
      global.RainGuardRecoveredLiveTrackHistoryByIdentityV39 = stableByIdentity;
      global.RainGuardRecoveredMultiPointHistoriesV39 = multiPointHistories;

      // Compatibility aliases for existing 39A-15F chain.
      if (CONFIG.publishAliases) {
        global.RainGuardPersistentIdentityMotionRecordsV39 = flattened;
        global.RainGuardPersistentIdentityMotionHistoryV39 = flattened;
        global.RainGuardPersistentIdentityMotionHistoryGroupsV39 = multiPointHistories;
        global.RainGuardReconciledStormIdentitiesV39 = multiPointHistories;
      }

      const status = multiPointHistories.length > 0
        ? "LIVE_TRACK_HISTORY_RECOVERED_WITH_MULTI_POINT_IDENTITIES"
        : acceptedRecordCount > 0
          ? "LIVE_TRACK_HISTORY_RECOVERED_SINGLE_POINT_ONLY"
          : "LIVE_TRACK_HISTORY_FOUND_BUT_NO_VALID_RECORDS";

      const result = {
        success: true,
        phase: PHASE,
        version: VERSION,
        build: BUILD,
        status,
        generatedAt: Date.now(),
        durationMs: Date.now() - startedAt,

        source: "RainArrivalLiveTrackHistory",
        sourceIdentityCount: entries.length,
        sourceRecordCount,

        acceptedRecordCount,
        rejectedRecordCount: Math.max(0, rejectedRecordCount),
        duplicateCount,

        recoveredIdentityCount: stableByIdentity.size,
        multiPointIdentityCount,
        singlePointIdentityCount,

        rejectionCounts,
        sample: flattened.slice(0, 10),
        multiPointSample: multiPointHistories.slice(0, 5)
      };

      STATE.result = result;

      console.log(
        `[RainGuard Phase ${PHASE}] Live Track History Recovery Bridge result:`,
        result
      );

      return result;
    } catch (error) {
      STATE.lastError = error;
      const result = {
        success: false,
        phase: PHASE,
        version: VERSION,
        build: BUILD,
        status: "LIVE_TRACK_HISTORY_RECOVERY_FAILED",
        generatedAt: Date.now(),
        error: error && error.message ? error.message : String(error)
      };
      STATE.result = result;
      console.error(`[RainGuard Phase ${PHASE}] Recovery failed:`, error);
      return result;
    } finally {
      STATE.running = false;
    }
  }

  function getHistory(identity) {
    if (!identity) return [];
    return STATE.byIdentity.get(identity) || [];
  }

  function diagnose() {
    const sampleIdentity = STATE.byIdentity.keys().next().value || null;
    return {
      phase: PHASE,
      version: VERSION,
      build: BUILD,
      installed: true,
      running: STATE.running,
      runs: STATE.runs,
      lastRun: STATE.lastRun,
      lastError: STATE.lastError ? String(STATE.lastError) : null,
      sourceAvailable: !!global.RainArrivalLiveTrackHistory,
      sourceType:
        global.RainArrivalLiveTrackHistory instanceof Map
          ? "Map"
          : Array.isArray(global.RainArrivalLiveTrackHistory)
            ? "Array"
            : typeof global.RainArrivalLiveTrackHistory,
      sourceIdentityCount: STATE.sourceIdentityCount,
      sourceRecordCount: STATE.sourceRecordCount,
      acceptedRecordCount: STATE.acceptedRecordCount,
      rejectedRecordCount: STATE.rejectedRecordCount,
      duplicateCount: STATE.duplicateCount,
      recoveredIdentityCount: STATE.recoveredIdentityCount,
      multiPointIdentityCount: STATE.multiPointIdentityCount,
      singlePointIdentityCount: STATE.singlePointIdentityCount,
      sampleIdentity,
      sampleHistory: sampleIdentity ? getHistory(sampleIdentity).slice(0, 5) : []
    };
  }

  global.runRainGuardLiveTrackHistoryRecoveryBridge = recover;
  global.getRainGuardRecoveredLiveTrackHistoryForIdentity = getHistory;
  global.diagnoseRainGuardLiveTrackHistoryRecoveryBridge = diagnose;

  global.RainGuardLiveTrackHistoryRecoveryBridgeV39 = {
    phase: PHASE,
    version: VERSION,
    build: BUILD,
    config: CONFIG,
    state: STATE,
    run: recover,
    getHistory,
    diagnose
  };

  console.log(
    `[RainGuard Phase ${PHASE}] Live Track History Recovery Bridge installed.`
  );

  if (CONFIG.autoRun) {
    setTimeout(() => {
      try {
        recover();
      } catch (error) {
        console.error(`[RainGuard Phase ${PHASE}] Auto-run failed:`, error);
      }
    }, CONFIG.autoRunDelayMs);
  }
})(window);
