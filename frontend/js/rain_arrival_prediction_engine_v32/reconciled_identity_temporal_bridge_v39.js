/**
 * RainGuard AI
 * Phase 39A-15F6B — Reconciled Identity → Temporal Sequence Bridge
 * File: reconciled_identity_temporal_bridge_v39.js
 */
(function installRainGuardReconciledIdentityTemporalBridge(global) {
  "use strict";

  const PHASE = "39A-15F6B";
  const VERSION = "39A.15F6B.0";
  const BUILD = "rainguard-v39-reconciled-identity-temporal-bridge";

  const state = global.__rainGuardReconciledIdentityTemporalBridgeState || {
    installedAt: Date.now(), running: false, runs: 0,
    lastResult: null, lastFeed: [], lastGroups: []
  };
  global.__rainGuardReconciledIdentityTemporalBridgeState = state;

  const num = v => Number.isFinite(Number(v)) ? Number(v) : null;

  function normalizeTimestamp(v) {
    const n = num(v);
    if (n !== null) {
      if (n > 0 && n < 1e12) return Math.round(n * 1000);
      if (n >= 1e12) return Math.round(n);
    }
    if (typeof v === "string") {
      const t = Date.parse(v);
      return Number.isFinite(t) ? t : null;
    }
    return null;
  }

  function pick(obj, keys) {
    if (!obj || typeof obj !== "object") return undefined;
    for (const k of keys) if (obj[k] !== undefined && obj[k] !== null) return obj[k];
    return undefined;
  }

  function extractCoordinates(record) {
    if (!record || typeof record !== "object") return null;
    const candidates = [record, record.currentCoordinate, record.coordinate,
      record.coordinates, record.position, record.location,
      record.centroid, record.center].filter(Boolean);

    for (const c of candidates) {
      const lat = num(pick(c, ["latitude", "lat", "y"]));
      const lon = num(pick(c, ["longitude", "lon", "lng", "x"]));
      if (lat !== null && lon !== null && lat >= -90 && lat <= 90 &&
          lon >= -180 && lon <= 180 && !(lat === 0 && lon === 0)) {
        return { lat, lon };
      }
    }
    return null;
  }

  function getSource() {
    const candidates = [
      ["RainGuardCrossCycleStormIdentitiesV39", global.RainGuardCrossCycleStormIdentitiesV39],
      ["RainGuardCrossCycleMultiObservationIdentitiesV39", global.RainGuardCrossCycleMultiObservationIdentitiesV39],
      ["RainGuardPersistentStormIdentitiesV39", global.RainGuardPersistentStormIdentitiesV39]
    ];
    for (const [name, value] of candidates) {
      if (Array.isArray(value) && value.length) return { name, value };
    }
    if (typeof global.getRainGuardCrossCycleStormIdentities === "function") {
      try {
        const value = global.getRainGuardCrossCycleStormIdentities();
        if (Array.isArray(value) && value.length) return { name: "getRainGuardCrossCycleStormIdentities()", value };
      } catch (_) {}
    }
    return { name: null, value: [] };
  }

  function getPersistentId(identity, index) {
    const raw = pick(identity, ["persistentId", "canonicalTrackId", "trackId", "stormId", "cellId", "id"]);
    if (raw !== undefined && raw !== null && String(raw).trim()) return String(raw).trim();
    return `UNKEYED-IDENTITY-${index}`;
  }

  function getObservations(identity) {
    for (const arr of [identity?.observations, identity?.history, identity?.points, identity?.records]) {
      if (Array.isArray(arr) && arr.length) return arr;
    }
    if (identity?.firstObservation && identity?.lastObservation && identity.firstObservation !== identity.lastObservation) {
      return [identity.firstObservation, identity.lastObservation];
    }
    if (identity?.firstObservation) return [identity.firstObservation];
    if (identity?.lastObservation) return [identity.lastObservation];
    return [];
  }

  function normalizeObservation(obs, persistentId, identity, observationIndex) {
    if (!obs || typeof obs !== "object") return { ok: false, reason: "INVALID_RECORD" };
    const c = extractCoordinates(obs);
    if (!c) return { ok: false, reason: "NO_VALID_COORDINATE" };
    const timestamp = normalizeTimestamp(pick(obs, ["observedAt", "timestamp", "time", "createdAt", "updatedAt", "detectedAt", "lastSeenAt"]));
    if (!timestamp) return { ok: false, reason: "NO_VALID_TIMESTAMP" };

    return { ok: true, value: {
      persistentId,
      canonicalTrackId: persistentId,
      trackId: pick(obs, ["trackId", "canonicalTrackId", "persistentId", "id"]) || persistentId,
      cellId: pick(obs, ["cellId", "stormId"]) || persistentId,
      latitude: c.lat, longitude: c.lon, lat: c.lat, lon: c.lon, lng: c.lon,
      timestamp, observedAt: timestamp,
      source: obs.source || identity?.source || "CrossCycleIdentityReconciliation",
      sourceIndex: obs.sourceIndex ?? null,
      observationIndex,
      intensity: obs.intensity ?? null,
      confidence: obs.confidence ?? null,
      bridgePhase: PHASE,
      bridgeVersion: VERSION
    }};
  }

  function dedupeSort(points) {
    const seen = new Set(), out = [];
    for (const p of points) {
      const key = `${p.persistentId}|${p.timestamp}|${Number(p.lat).toFixed(6)}|${Number(p.lon).toFixed(6)}`;
      if (seen.has(key)) continue;
      seen.add(key); out.push(p);
    }
    return out.sort((a, b) => a.timestamp - b.timestamp);
  }

  async function runRainGuardReconciledIdentityTemporalBridge(options = {}) {
    if (state.running) return { success: false, phase: PHASE, version: VERSION, status: "RUN_ALREADY_IN_PROGRESS" };
    state.running = true;
    const startedAt = Date.now();

    try {
      const source = getSource();
      const feed = [], groups = [];
      const rejects = { INVALID_RECORD: 0, NO_VALID_COORDINATE: 0, NO_VALID_TIMESTAMP: 0 };
      let totalObservationCandidates = 0;
      let identityWithMultiplePointsCount = 0;
      let singlePointIdentityCount = 0;

      source.value.forEach((identity, identityIndex) => {
        const persistentId = getPersistentId(identity, identityIndex);
        const observations = getObservations(identity);
        totalObservationCandidates += observations.length;

        const normalized = [];
        observations.forEach((obs, observationIndex) => {
          const r = normalizeObservation(obs, persistentId, identity, observationIndex);
          if (r.ok) normalized.push(r.value);
          else if (rejects[r.reason] !== undefined) rejects[r.reason]++;
        });

        const clean = dedupeSort(normalized);
        if (clean.length >= 2) identityWithMultiplePointsCount++;
        else if (clean.length === 1) singlePointIdentityCount++;

        if (clean.length) {
          feed.push(...clean);
          groups.push({
            persistentId,
            observationCount: clean.length,
            firstTimestamp: clean[0].timestamp,
            lastTimestamp: clean[clean.length - 1].timestamp,
            durationMs: clean[clean.length - 1].timestamp - clean[0].timestamp,
            observations: clean
          });
        }
      });

      groups.sort((a, b) => b.observationCount - a.observationCount);
      global.RainGuardReconciledTemporalObservationFeedV39 = feed;
      global.RainGuardReconciledTemporalIdentityGroupsV39 = groups;

      if (options.mirrorTo15F5Source !== false) {
        global.RainGuardPersistentIdentityMotionRecordsV39 = feed;
      }

      state.lastFeed = feed;
      state.lastGroups = groups;
      state.runs++;

      const result = {
        success: true, phase: PHASE, version: VERSION, build: BUILD,
        status: identityWithMultiplePointsCount > 0 ? "RECONCILED_TEMPORAL_FEED_READY" : "RECONCILED_IDENTITIES_FOUND_BUT_NO_MULTI_POINT_FEED",
        generatedAt: Date.now(), durationMs: Date.now() - startedAt,
        source: source.name,
        sourceIdentityCount: source.value.length,
        totalObservationCandidates,
        acceptedObservationCount: feed.length,
        identityGroupCount: groups.length,
        identityWithMultiplePointsCount,
        singlePointIdentityCount,
        invalidRecordCount: rejects.INVALID_RECORD,
        rejectedNoCoordinateCount: rejects.NO_VALID_COORDINATE,
        rejectedNoTimestampCount: rejects.NO_VALID_TIMESTAMP,
        mirroredTo15F5Source: options.mirrorTo15F5Source !== false,
        outputFeedCount: feed.length,
        outputGroupCount: groups.length,
        groupSample: groups.slice(0, 10),
        feedSample: feed.slice(0, 20)
      };

      state.lastResult = result;
      global.RainGuardReconciledIdentityTemporalBridgeLastResultV39 = result;
      console.log(`[RainGuard Phase ${PHASE}] Reconciled Identity Temporal Bridge result:`);
      console.log(result);

      if (options.run15F5 === true) {
        const fn = global.runRainGuardTemporalObservationSequenceBuilder;
        if (typeof fn === "function") {
          try {
            result.downstreamTriggered = true;
            result.downstream15F5Result = await fn();
          } catch (err) {
            result.downstreamTriggered = true;
            result.downstreamError = String(err?.message || err);
          }
        } else {
          result.downstreamTriggered = false;
          result.downstreamError = "runRainGuardTemporalObservationSequenceBuilder not found";
        }
      }
      return result;
    } catch (error) {
      const result = { success: false, phase: PHASE, version: VERSION, build: BUILD,
        status: "RECONCILED_TEMPORAL_BRIDGE_ERROR", error: String(error?.message || error), generatedAt: Date.now() };
      state.lastResult = result;
      console.error(`[RainGuard Phase ${PHASE}]`, error);
      return result;
    } finally {
      state.running = false;
    }
  }

  function diagnoseRainGuardReconciledIdentityTemporalBridge() {
    const feed = Array.isArray(global.RainGuardReconciledTemporalObservationFeedV39) ? global.RainGuardReconciledTemporalObservationFeedV39 : [];
    const groups = Array.isArray(global.RainGuardReconciledTemporalIdentityGroupsV39) ? global.RainGuardReconciledTemporalIdentityGroupsV39 : [];
    const report = {
      phase: PHASE, version: VERSION, build: BUILD, installed: true,
      running: state.running, runs: state.runs,
      feedCount: feed.length, groupCount: groups.length,
      multiPointGroupCount: groups.filter(g => g.observationCount >= 2).length,
      maxObservationCount: groups.reduce((m, g) => Math.max(m, Number(g.observationCount || 0)), 0),
      lastResult: state.lastResult
    };
    console.log(`[RainGuard Phase ${PHASE}] Diagnostic:`);
    console.log(report);
    return report;
  }

  global.runRainGuardReconciledIdentityTemporalBridge = runRainGuardReconciledIdentityTemporalBridge;
  global.diagnoseRainGuardReconciledIdentityTemporalBridge = diagnoseRainGuardReconciledIdentityTemporalBridge;
  global.RainGuardReconciledIdentityTemporalBridgeV39 = {
    phase: PHASE, version: VERSION, build: BUILD,
    run: runRainGuardReconciledIdentityTemporalBridge,
    diagnose: diagnoseRainGuardReconciledIdentityTemporalBridge,
    state
  };

  console.log(`[RainGuard Phase ${PHASE}] Reconciled Identity → Temporal Sequence Bridge READY`);
})(window);
