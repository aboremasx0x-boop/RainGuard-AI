/**
 * RainGuard AI
 * Phase 39A-15F6 — Cross-Cycle Storm Identity Reconciliation
 * File: cross_cycle_storm_identity_reconciliation_39a15f6.js
 *
 * Purpose:
 * - Reconcile storm observations across different runtime cycles.
 * - Preserve the same persistent identity when observations are spatially
 *   and temporally compatible.
 * - Never fabricate coordinates, timestamps, or motion.
 * - Feed Phase 39A-15F5 with identities that can contain 2+ observations.
 *
 * Safety:
 * - No synthetic coordinates.
 * - No synthetic timestamps.
 * - No forced merge when evidence is insufficient.
 * - Conservative spatial/temporal thresholds.
 */

(function installRainGuardCrossCycleStormIdentityReconciliation(global) {
  "use strict";

  const PHASE = "39A-15F6";
  const VERSION = "39A.15F6.0";
  const BUILD = "rainguard-v39-cross-cycle-storm-identity-reconciliation";

  const CONFIG = Object.freeze({
    maxDistanceKm: 45,
    maxTimeGapMs: 45 * 60 * 1000,
    minTimeGapMs: 1000,
    staleIdentityMs: 6 * 60 * 60 * 1000,
    maxMemoryIdentities: 5000,
    coordinatePrecision: 5,
    maxCandidateChecks: 3000
  });

  const state = global.__rainGuardCrossCycleIdentityState || {
    installedAt: Date.now(),
    running: false,
    runs: 0,
    memory: new Map(),
    lastResult: null,
    totals: {
      input: 0,
      accepted: 0,
      rejected: 0,
      matched: 0,
      created: 0,
      multiObservation: 0
    }
  };

  global.__rainGuardCrossCycleIdentityState = state;

  function asFiniteNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function normalizeTimestamp(value) {
    const n = asFiniteNumber(value);
    if (n !== null) {
      if (n > 0 && n < 1e12) return Math.round(n * 1000);
      if (n >= 1e12) return Math.round(n);
    }
    if (typeof value === "string") {
      const t = Date.parse(value);
      return Number.isFinite(t) ? t : null;
    }
    return null;
  }

  function pickFirst(obj, keys) {
    if (!obj || typeof obj !== "object") return undefined;
    for (const key of keys) {
      if (obj[key] !== undefined && obj[key] !== null) return obj[key];
    }
    return undefined;
  }

  function extractCoordinates(record) {
    if (!record || typeof record !== "object") return null;

    const nestedCandidates = [
      record.currentCoordinate,
      record.coordinate,
      record.coordinates,
      record.position,
      record.location,
      record.centroid,
      record.center
    ].filter(Boolean);

    const candidates = [record, ...nestedCandidates];

    for (const obj of candidates) {
      const lat = asFiniteNumber(pickFirst(obj, ["latitude", "lat", "y"]));
      const lon = asFiniteNumber(pickFirst(obj, ["longitude", "lon", "lng", "x"]));

      if (
        lat !== null &&
        lon !== null &&
        lat >= -90 && lat <= 90 &&
        lon >= -180 && lon <= 180 &&
        !(lat === 0 && lon === 0)
      ) {
        return { lat, lon };
      }
    }

    return null;
  }

  function extractTimestamp(record) {
    return normalizeTimestamp(
      pickFirst(record, [
        "observedAt",
        "timestamp",
        "time",
        "createdAt",
        "updatedAt",
        "detectedAt",
        "lastSeenAt"
      ])
    );
  }

  function extractIdentity(record) {
    const raw = pickFirst(record, [
      "persistentId",
      "canonicalTrackId",
      "trackId",
      "cellId",
      "stormId",
      "id"
    ]);
    if (raw === undefined || raw === null) return null;
    const s = String(raw).trim();
    return s || null;
  }

  function haversineKm(a, b) {
    const R = 6371.0088;
    const dLat = (b.lat - a.lat) * Math.PI / 180;
    const dLon = (b.lon - a.lon) * Math.PI / 180;
    const lat1 = a.lat * Math.PI / 180;
    const lat2 = b.lat * Math.PI / 180;

    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  function sourceArrays() {
    const candidates = [
      ["RainGuardStormObservationGateV39", global.RainGuardStormObservationGateV39],
      ["RainGuardPersistentIdentityMotionRecordsV39", global.RainGuardPersistentIdentityMotionRecordsV39],
      ["RainGuardPersistentStormIdentitiesV39", global.RainGuardPersistentStormIdentitiesV39],
      ["RainGuardPersistentTemporalMotionFeedV39", global.RainGuardPersistentTemporalMotionFeedV39],
      ["RainArrivalLiveStormEntities", global.RainArrivalLiveStormEntities],
      ["RainArrivalStableStormEntities", global.RainArrivalStableStormEntities]
    ];

    const arrays = [];
    for (const [name, value] of candidates) {
      if (Array.isArray(value) && value.length) arrays.push({ name, value });
    }

    if (
      global.RainArrivalTrackStoreV32 &&
      global.RainArrivalTrackStoreV32.tracks &&
      typeof global.RainArrivalTrackStoreV32.tracks.values === "function"
    ) {
      const arr = [...global.RainArrivalTrackStoreV32.tracks.values()];
      if (arr.length) arrays.push({ name: "RainArrivalTrackStoreV32.tracks", value: arr });
    }

    return arrays;
  }

  function flattenRecord(record, sourceName, sourceIndex) {
    if (!record || typeof record !== "object") return [];

    // Preserve existing observation arrays where present.
    const possibleObs = [
      record.observations,
      record.history,
      record.points,
      record.records
    ];

    for (const obs of possibleObs) {
      if (Array.isArray(obs) && obs.length) {
        return obs.map((item, i) => ({
          ...(item && typeof item === "object" ? item : {}),
          _parent: record,
          _sourceName: sourceName,
          _sourceIndex: sourceIndex,
          _observationIndex: i
        }));
      }
    }

    return [{
      ...record,
      _sourceName: sourceName,
      _sourceIndex: sourceIndex,
      _observationIndex: 0
    }];
  }

  function normalizeRecord(record) {
    const coordinate = extractCoordinates(record);
    const timestamp = extractTimestamp(record);

    if (!coordinate) return { ok: false, reason: "NO_VALID_COORDINATE" };
    if (!timestamp) return { ok: false, reason: "NO_VALID_TIMESTAMP" };

    const sourceIdentity = extractIdentity(record);

    return {
      ok: true,
      value: {
        original: record,
        sourceIdentity,
        lat: coordinate.lat,
        lon: coordinate.lon,
        latitude: coordinate.lat,
        longitude: coordinate.lon,
        timestamp,
        observedAt: timestamp,
        source: record._sourceName || record.source || null,
        sourceIndex: record._sourceIndex ?? null,
        observationIndex: record._observationIndex ?? null
      }
    };
  }

  function createPersistentId(obs) {
    const lat = obs.lat.toFixed(3).replace("-", "m").replace(".", "");
    const lon = obs.lon.toFixed(3).replace("-", "m").replace(".", "");
    const timeBucket = Math.floor(obs.timestamp / (15 * 60 * 1000));
    return `RGX-${lat}-${lon}-${timeBucket.toString(36).toUpperCase()}`;
  }

  function identityScore(identity, obs) {
    if (!identity || !identity.lastObservation) return null;

    const dt = obs.timestamp - identity.lastObservation.timestamp;
    if (dt < CONFIG.minTimeGapMs || dt > CONFIG.maxTimeGapMs) return null;

    const distanceKm = haversineKm(identity.lastObservation, obs);
    if (!Number.isFinite(distanceKm) || distanceKm > CONFIG.maxDistanceKm) return null;

    // Prefer identity continuity first, then spatial and temporal proximity.
    let sourceIdentityBonus = 0;
    if (
      obs.sourceIdentity &&
      identity.aliases &&
      identity.aliases.has(obs.sourceIdentity)
    ) {
      sourceIdentityBonus = 0.35;
    }

    const distanceScore = 1 - (distanceKm / CONFIG.maxDistanceKm);
    const timeScore = 1 - (dt / CONFIG.maxTimeGapMs);
    const score = sourceIdentityBonus + (distanceScore * 0.45) + (timeScore * 0.20);

    return { score, dt, distanceKm };
  }

  function pruneMemory(now) {
    for (const [id, identity] of state.memory.entries()) {
      if (!identity || !identity.lastObservation) {
        state.memory.delete(id);
        continue;
      }
      if ((now - identity.lastObservation.timestamp) > CONFIG.staleIdentityMs) {
        state.memory.delete(id);
      }
    }

    if (state.memory.size > CONFIG.maxMemoryIdentities) {
      const ordered = [...state.memory.entries()].sort(
        (a, b) =>
          (a[1]?.lastObservation?.timestamp || 0) -
          (b[1]?.lastObservation?.timestamp || 0)
      );
      const removeCount = state.memory.size - CONFIG.maxMemoryIdentities;
      for (let i = 0; i < removeCount; i++) state.memory.delete(ordered[i][0]);
    }
  }

  function chooseIdentity(obs) {
    let best = null;
    let checked = 0;

    for (const identity of state.memory.values()) {
      if (++checked > CONFIG.maxCandidateChecks) break;
      const scored = identityScore(identity, obs);
      if (!scored) continue;

      if (!best || scored.score > best.score) {
        best = { identity, ...scored };
      }
    }

    return best;
  }

  function ensureIdentity(id, obs) {
    let identity = state.memory.get(id);

    if (!identity) {
      identity = {
        persistentId: id,
        canonicalTrackId: id,
        aliases: new Set(),
        observations: [],
        firstObservation: null,
        lastObservation: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        state: "ACTIVE"
      };
      state.memory.set(id, identity);
    }

    if (obs.sourceIdentity) identity.aliases.add(obs.sourceIdentity);
    return identity;
  }

  function appendObservation(identity, obs) {
    const duplicate = identity.observations.some(
      p =>
        p.timestamp === obs.timestamp &&
        Math.abs(p.lat - obs.lat) < 1e-7 &&
        Math.abs(p.lon - obs.lon) < 1e-7
    );

    if (duplicate) return false;

    const point = {
      persistentId: identity.persistentId,
      canonicalTrackId: identity.canonicalTrackId,
      trackId: obs.sourceIdentity || identity.canonicalTrackId,
      latitude: obs.lat,
      longitude: obs.lon,
      lat: obs.lat,
      lon: obs.lon,
      lng: obs.lon,
      timestamp: obs.timestamp,
      observedAt: obs.timestamp,
      source: obs.source,
      sourceIndex: obs.sourceIndex,
      observationIndex: obs.observationIndex,
      phase: PHASE,
      version: VERSION
    };

    identity.observations.push(point);
    identity.observations.sort((a, b) => a.timestamp - b.timestamp);

    if (identity.observations.length > 200) {
      identity.observations = identity.observations.slice(-200);
    }

    identity.firstObservation = identity.observations[0] || point;
    identity.lastObservation = identity.observations[identity.observations.length - 1] || point;
    identity.updatedAt = Date.now();

    return true;
  }

  function serializeIdentity(identity) {
    return {
      persistentId: identity.persistentId,
      canonicalTrackId: identity.canonicalTrackId,
      aliases: [...identity.aliases],
      observationCount: identity.observations.length,
      observations: identity.observations.map(p => ({ ...p })),
      firstObservation: identity.firstObservation ? { ...identity.firstObservation } : null,
      lastObservation: identity.lastObservation ? { ...identity.lastObservation } : null,
      createdAt: identity.createdAt,
      updatedAt: identity.updatedAt,
      state: identity.state
    };
  }

  async function runRainGuardCrossCycleStormIdentityReconciliation(options = {}) {
    if (state.running) {
      return {
        success: false,
        phase: PHASE,
        version: VERSION,
        status: "RUN_ALREADY_IN_PROGRESS"
      };
    }

    state.running = true;
    const startedAt = Date.now();

    try {
      const sources = sourceArrays();
      const raw = [];

      for (const source of sources) {
        source.value.forEach((record, index) => {
          raw.push(...flattenRecord(record, source.name, index));
        });
      }

      const rejected = [];
      const normalized = [];

      for (const record of raw) {
        const r = normalizeRecord(record);
        if (r.ok) normalized.push(r.value);
        else rejected.push({
          reason: r.reason,
          source: record?._sourceName || null,
          sourceIndex: record?._sourceIndex ?? null
        });
      }

      normalized.sort((a, b) => a.timestamp - b.timestamp);

      let matchedObservationCount = 0;
      let newIdentityCount = 0;
      let duplicateObservationCount = 0;

      for (const obs of normalized) {
        pruneMemory(obs.timestamp);

        const match = chooseIdentity(obs);
        let identity;

        if (match && match.identity) {
          identity = match.identity;
          matchedObservationCount++;
        } else {
          const id = createPersistentId(obs);
          identity = ensureIdentity(id, obs);
          newIdentityCount++;
        }

        if (obs.sourceIdentity) identity.aliases.add(obs.sourceIdentity);

        if (!appendObservation(identity, obs)) {
          duplicateObservationCount++;
        }
      }

      const identities = [...state.memory.values()]
        .map(serializeIdentity)
        .sort((a, b) => b.observationCount - a.observationCount);

      const multi = identities.filter(x => x.observationCount >= 2);
      const reconciledRecords = identities.flatMap(x => x.observations);

      global.RainGuardCrossCycleStormIdentitiesV39 = identities;
      global.RainGuardPersistentStormIdentitiesV39 = identities;
      global.RainGuardPersistentIdentityMotionRecordsV39 = reconciledRecords;
      global.RainGuardCrossCycleMultiObservationIdentitiesV39 = multi;

      const result = {
        success: true,
        phase: PHASE,
        version: VERSION,
        build: BUILD,
        status: multi.length
          ? "CROSS_CYCLE_IDENTITIES_RECONCILED"
          : "OBSERVATIONS_RECONCILED_BUT_NO_MULTI_OBSERVATION_IDENTITY",
        generatedAt: Date.now(),
        durationMs: Date.now() - startedAt,
        sourceCount: sources.length,
        sourceNames: sources.map(s => s.name),
        inputRecordCount: raw.length,
        normalizedRecordCount: normalized.length,
        rejectedRecordCount: rejected.length,
        duplicateObservationCount,
        matchedObservationCount,
        newIdentityCount,
        reconciledIdentityCount: identities.length,
        multiObservationIdentityCount: multi.length,
        outputRecordCount: reconciledRecords.length,
        sample: identities.slice(0, 10),
        multiObservationSample: multi.slice(0, 10),
        rejectionSample: rejected.slice(0, 20)
      };

      state.runs++;
      state.lastResult = result;
      state.totals.input += raw.length;
      state.totals.accepted += normalized.length;
      state.totals.rejected += rejected.length;
      state.totals.matched += matchedObservationCount;
      state.totals.created += newIdentityCount;
      state.totals.multiObservation = multi.length;

      global.RainGuardCrossCycleStormIdentityLastResultV39 = result;

      console.log(`[RainGuard Phase ${PHASE}] Cross-Cycle Storm Identity Reconciliation result:`);
      console.log(result);

      if (options.runTemporalSequenceBuilder !== false) {
        const fn =
          global.runRainGuardTemporalObservationSequenceBuilder ||
          global.runRainGuardPersistentTemporalIdentityReconciliation;

        if (typeof fn === "function") {
          try {
            result.downstreamTriggered = true;
            result.downstreamResult = await fn();
          } catch (err) {
            result.downstreamTriggered = true;
            result.downstreamError = String(err?.message || err);
          }
        } else {
          result.downstreamTriggered = false;
        }
      }

      return result;
    } catch (error) {
      const result = {
        success: false,
        phase: PHASE,
        version: VERSION,
        build: BUILD,
        status: "CROSS_CYCLE_RECONCILIATION_ERROR",
        error: String(error?.message || error),
        generatedAt: Date.now()
      };
      state.lastResult = result;
      console.error(`[RainGuard Phase ${PHASE}]`, error);
      return result;
    } finally {
      state.running = false;
    }
  }

  function getRainGuardCrossCycleStormIdentities() {
    return Array.isArray(global.RainGuardCrossCycleStormIdentitiesV39)
      ? global.RainGuardCrossCycleStormIdentitiesV39
      : [];
  }

  function diagnoseRainGuardCrossCycleStormIdentityReconciliation() {
    const identities = getRainGuardCrossCycleStormIdentities();
    const multi = identities.filter(x => Number(x?.observationCount || 0) >= 2);

    const report = {
      phase: PHASE,
      version: VERSION,
      build: BUILD,
      installed: true,
      running: state.running,
      runs: state.runs,
      memoryIdentityCount: state.memory.size,
      outputIdentityCount: identities.length,
      multiObservationIdentityCount: multi.length,
      outputRecordCount: identities.reduce(
        (n, x) => n + (Array.isArray(x?.observations) ? x.observations.length : 0),
        0
      ),
      lastResult: state.lastResult,
      totals: { ...state.totals }
    };

    console.log(`[RainGuard Phase ${PHASE}] Diagnostic:`);
    console.log(report);
    return report;
  }

  function resetRainGuardCrossCycleStormIdentityMemory() {
    state.memory.clear();
    global.RainGuardCrossCycleStormIdentitiesV39 = [];
    global.RainGuardCrossCycleMultiObservationIdentitiesV39 = [];
    global.RainGuardPersistentIdentityMotionRecordsV39 = [];
    return true;
  }

  global.runRainGuardCrossCycleStormIdentityReconciliation =
    runRainGuardCrossCycleStormIdentityReconciliation;

  global.getRainGuardCrossCycleStormIdentities =
    getRainGuardCrossCycleStormIdentities;

  global.diagnoseRainGuardCrossCycleStormIdentityReconciliation =
    diagnoseRainGuardCrossCycleStormIdentityReconciliation;

  global.resetRainGuardCrossCycleStormIdentityMemory =
    resetRainGuardCrossCycleStormIdentityMemory;

  global.RainGuardCrossCycleStormIdentityReconciliationV39 = {
    phase: PHASE,
    version: VERSION,
    build: BUILD,
    config: CONFIG,
    state,
    run: runRainGuardCrossCycleStormIdentityReconciliation,
    diagnose: diagnoseRainGuardCrossCycleStormIdentityReconciliation,
    getIdentities: getRainGuardCrossCycleStormIdentities,
    reset: resetRainGuardCrossCycleStormIdentityMemory
  };

  console.log(
    `[RainGuard Phase ${PHASE}] Cross-Cycle Storm Identity Reconciliation READY`
  );

})(window);
