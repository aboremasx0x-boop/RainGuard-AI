/**
 * RainGuard AI
 * Phase 39A-15F6K
 * Reconciled Identity -> Temporal Recovery Integration Bridge
 *
 * Purpose
 * -------
 * Bridge the multi-point persistent identities produced by Phase 39A-15F6J
 * into the temporal-coordinate recovery / motion-vector pipeline used by
 * Phase 39A-15F6I and Phase 39A-15F6H.
 *
 * Design goals
 * ------------
 * - Non-destructive: never mutates upstream identity objects in place.
 * - Defensive: supports several possible RainGuard global storage shapes.
 * - Compatible: publishes normalized multi-point identities and flattened
 *   temporal observations through stable globals + getter functions.
 * - Safe: rejects invalid coordinates/timestamps and deduplicates points.
 *
 * Public API
 * ----------
 * window.runRainGuardReconciledIdentityTemporalRecoveryIntegrationBridge()
 * window.getRainGuardReconciledIdentityTemporalRecoveryFeed()
 * window.getRainGuardReconciledIdentityTemporalRecoveryIdentities()
 * window.diagnoseRainGuardReconciledIdentityTemporalRecoveryIntegrationBridge()
 */

(function installRainGuardReconciledIdentityTemporalRecoveryIntegrationBridge(global) {
  "use strict";

  const PHASE = "39A-15F6K";
  const VERSION = "39A.15F6K.0";
  const BUILD = "rainguard-v39-reconciled-identity-temporal-recovery-integration-bridge";

  const CONFIG = Object.freeze({
    maxIdentities: 2500,
    maxPointsPerIdentity: 64,
    maxGlobalObservations: 12000,
    minPointsForTemporalIdentity: 2,
    minTimeDeltaMs: 1000,
    maxTimeGapMs: 1000 * 60 * 60 * 24 * 7,
    coordinatePrecision: 6,
    dedupeTimeToleranceMs: 1000,
    dedupeCoordinateTolerance: 1e-6
  });

  const STATE = {
    installed: true,
    running: false,
    lastRun: null,
    lastError: null,
    identities: [],
    feed: [],
    sourceNames: [],
    totals: {
      runs: 0,
      sourceRecords: 0,
      identities: 0,
      multiPointIdentities: 0,
      observations: 0,
      duplicates: 0,
      rejected: 0
    }
  };

  function now() {
    return Date.now();
  }

  function isObject(value) {
    return value !== null && typeof value === "object";
  }

  function asArray(value) {
    if (Array.isArray(value)) return value;
    if (value instanceof Map) return Array.from(value.values());
    if (value instanceof Set) return Array.from(value.values());
    if (isObject(value)) {
      if (Array.isArray(value.identities)) return value.identities;
      if (Array.isArray(value.records)) return value.records;
      if (Array.isArray(value.items)) return value.items;
      if (Array.isArray(value.data)) return value.data;
      if (value.byIdentity instanceof Map) return Array.from(value.byIdentity.values());
      if (isObject(value.byIdentity)) return Object.values(value.byIdentity);
    }
    return [];
  }

  function finiteNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function extractCoordinate(record) {
    if (!isObject(record)) return null;

    const c = isObject(record.coordinate) ? record.coordinate : null;
    const latitude = finiteNumber(
      record.latitude ?? record.lat ?? c?.latitude ?? c?.lat
    );
    const longitude = finiteNumber(
      record.longitude ?? record.lon ?? record.lng ??
      c?.longitude ?? c?.lon ?? c?.lng
    );

    if (latitude === null || longitude === null) return null;
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;

    return { latitude, longitude };
  }

  function extractTimestamp(record) {
    if (!isObject(record)) return null;

    const candidates = [
      record.timestamp,
      record.observedAt,
      record.observationTime,
      record.time,
      record.ts,
      record.accumulatedAt,
      record.updatedAt,
      record.createdAt
    ];

    for (const value of candidates) {
      if (value === null || value === undefined || value === "") continue;

      if (typeof value === "number" && Number.isFinite(value)) {
        // Accept seconds or milliseconds.
        return value < 10_000_000_000 ? Math.round(value * 1000) : Math.round(value);
      }

      const parsed = Date.parse(value);
      if (Number.isFinite(parsed)) return parsed;

      const numeric = Number(value);
      if (Number.isFinite(numeric)) {
        return numeric < 10_000_000_000 ? Math.round(numeric * 1000) : Math.round(numeric);
      }
    }

    return null;
  }

  function identityKey(record, fallbackIndex) {
    if (!isObject(record)) return `anonymous:${fallbackIndex}`;

    return String(
      record.persistentId ??
      record.persistentIdentity ??
      record.identity ??
      record.identityId ??
      record.canonicalTrackId ??
      record.trackId ??
      record.cellId ??
      record.id ??
      `anonymous:${fallbackIndex}`
    );
  }

  function collectObservationCandidates(identity) {
    if (!isObject(identity)) return [];

    const out = [];
    const pushMany = (v) => {
      if (Array.isArray(v)) out.push(...v);
      else if (v instanceof Map) out.push(...Array.from(v.values()));
      else if (v instanceof Set) out.push(...Array.from(v.values()));
    };

    pushMany(identity.observations);
    pushMany(identity.points);
    pushMany(identity.history);
    pushMany(identity.records);
    pushMany(identity.temporalHistory);
    pushMany(identity.motionHistory);
    pushMany(identity.coordinateHistory);
    pushMany(identity.samples);

    if (isObject(identity.firstObservation)) out.push(identity.firstObservation);
    if (isObject(identity.lastObservation)) out.push(identity.lastObservation);

    // Some RainGuard phases store a usable observation directly on the identity.
    if (extractCoordinate(identity) && extractTimestamp(identity)) out.push(identity);

    return out;
  }

  function observationDedupeKey(obs) {
    const lat = Number(obs.latitude).toFixed(CONFIG.coordinatePrecision);
    const lon = Number(obs.longitude).toFixed(CONFIG.coordinatePrecision);
    const bucket = Math.round(Number(obs.timestamp) / CONFIG.dedupeTimeToleranceMs);
    return `${lat}|${lon}|${bucket}`;
  }

  function normalizeObservation(raw, identity, index) {
    if (!isObject(raw)) return null;

    const coordinate = extractCoordinate(raw);
    const timestamp = extractTimestamp(raw);
    if (!coordinate || timestamp === null) return null;

    const id = identityKey(identity, index);

    return {
      identity: id,
      persistentId: String(identity.persistentId ?? id),
      canonicalTrackId: identity.canonicalTrackId ?? identity.trackId ?? raw.canonicalTrackId ?? raw.trackId ?? null,
      trackId: identity.trackId ?? raw.trackId ?? null,
      cellId: identity.cellId ?? raw.cellId ?? null,
      latitude: coordinate.latitude,
      longitude: coordinate.longitude,
      coordinate: {
        latitude: coordinate.latitude,
        longitude: coordinate.longitude
      },
      observedAt: timestamp,
      timestamp,
      confidence: finiteNumber(raw.confidence ?? identity.confidence) ?? 0,
      intensity: finiteNumber(raw.intensity ?? identity.intensity),
      source: raw.source ?? identity.source ?? "39A-15F6J",
      phase: PHASE,
      bridgeSourcePhase: identity.phase ?? null,
      original: raw
    };
  }

  function normalizeIdentity(rawIdentity, index) {
    if (!isObject(rawIdentity)) return null;

    const id = identityKey(rawIdentity, index);
    const rawPoints = collectObservationCandidates(rawIdentity);
    const points = [];
    const seen = new Set();
    let duplicateCount = 0;
    let rejectedCount = 0;

    for (const raw of rawPoints) {
      const obs = normalizeObservation(raw, rawIdentity, index);
      if (!obs) {
        rejectedCount += 1;
        continue;
      }

      const key = observationDedupeKey(obs);
      if (seen.has(key)) {
        duplicateCount += 1;
        continue;
      }

      seen.add(key);
      points.push(obs);

      if (points.length >= CONFIG.maxPointsPerIdentity) break;
    }

    points.sort((a, b) => a.timestamp - b.timestamp);

    // Enforce temporal progression and reject impossible giant gaps only when
    // there are other valid points available.
    const temporal = [];
    for (const point of points) {
      if (!temporal.length) {
        temporal.push(point);
        continue;
      }

      const prev = temporal[temporal.length - 1];
      const dt = point.timestamp - prev.timestamp;

      if (dt < CONFIG.minTimeDeltaMs) {
        // keep same-time point only if coordinate actually differs
        const coordChanged =
          Math.abs(point.latitude - prev.latitude) > CONFIG.dedupeCoordinateTolerance ||
          Math.abs(point.longitude - prev.longitude) > CONFIG.dedupeCoordinateTolerance;
        if (!coordChanged) {
          duplicateCount += 1;
          continue;
        }
      }

      if (dt > CONFIG.maxTimeGapMs && temporal.length > 1) {
        rejectedCount += 1;
        continue;
      }

      temporal.push(point);
    }

    const uniqueCoordinates = new Set(
      temporal.map(p =>
        `${p.latitude.toFixed(CONFIG.coordinatePrecision)},${p.longitude.toFixed(CONFIG.coordinatePrecision)}`
      )
    );

    const first = temporal[0] ?? null;
    const last = temporal[temporal.length - 1] ?? null;

    return {
      persistentId: String(rawIdentity.persistentId ?? id),
      identity: id,
      identityId: rawIdentity.identityId ?? id,
      canonicalTrackId: rawIdentity.canonicalTrackId ?? rawIdentity.trackId ?? null,
      trackId: rawIdentity.trackId ?? null,
      cellId: rawIdentity.cellId ?? null,
      aliases: Array.isArray(rawIdentity.aliases) ? [...rawIdentity.aliases] : [],
      observations: temporal,
      points: temporal,
      history: temporal,
      observationCount: temporal.length,
      uniqueCoordinateCount: uniqueCoordinates.size,
      firstObservedAt: first?.timestamp ?? null,
      lastObservedAt: last?.timestamp ?? null,
      firstObservation: first,
      lastObservation: last,
      multiPoint: temporal.length >= CONFIG.minPointsForTemporalIdentity,
      coordinateChanged: uniqueCoordinates.size >= 2,
      duplicateCount,
      rejectedCount,
      source: rawIdentity.source ?? "39A-15F6J",
      phase: PHASE,
      original: rawIdentity
    };
  }

  function discoverSources() {
    const candidates = [
      "RainGuardCrossSourcePersistentIdentitiesV39",
      "RainGuardCrossSourcePersistentIdentityReconciliationV39",
      "RainGuardCrossCyclePersistentIdentitiesV39",
      "RainGuardPersistentIdentityTemporalAccumulatorV39",
      "RainGuardPersistentObservationMemoryV39",
      "RainGuardReconciledStormIdentitiesV39",
      "RainGuardPersistentStormIdentitiesV39"
    ];

    const found = [];

    for (const name of candidates) {
      if (!(name in global)) continue;
      const arr = asArray(global[name]);
      if (arr.length) found.push({ name, records: arr });
    }

    // Also inspect latest result objects left by adjacent phases.
    const resultCandidates = [
      "RainGuardCrossSourcePersistentIdentityReconciliationLastResult",
      "RainGuardCrossCyclePersistentIdentityMatcherLastResult",
      "RainGuardPersistentIdentityTemporalAccumulatorLastResult",
      "RainGuardPersistentObservationMemoryGuardLastResult"
    ];

    for (const name of resultCandidates) {
      if (!(name in global)) continue;
      const value = global[name];
      const arr = asArray(
        value?.identities ??
        value?.persistentIdentities ??
        value?.output ??
        value?.records ??
        value
      );
      if (arr.length) found.push({ name, records: arr });
    }

    return found;
  }

  function mergeIdentityCandidates(sources) {
    const byIdentity = new Map();

    for (const source of sources) {
      source.records.forEach((record, index) => {
        const key = identityKey(record, index);

        if (!byIdentity.has(key)) {
          byIdentity.set(key, {
            base: record,
            mergedObservationSources: []
          });
        }

        const slot = byIdentity.get(key);
        slot.mergedObservationSources.push(record);
      });
    }

    const merged = [];

    for (const [key, slot] of byIdentity.entries()) {
      const base = slot.base;
      const observations = [];

      for (const record of slot.mergedObservationSources) {
        observations.push(...collectObservationCandidates(record));
      }

      merged.push({
        ...base,
        persistentId: base.persistentId ?? key,
        identity: base.identity ?? key,
        observations
      });

      if (merged.length >= CONFIG.maxIdentities) break;
    }

    return merged;
  }

  function publish(identities, feed, result) {
    // Canonical outputs of Phase 39A-15F6K
    global.RainGuardReconciledIdentityTemporalRecoveryIdentitiesV39 = identities;
    global.RainGuardReconciledIdentityTemporalRecoveryFeedV39 = feed;
    global.RainGuardReconciledIdentityTemporalRecoveryIntegrationResultV39 = result;

    // Compatibility aliases intentionally provided for downstream phases.
    global.RainGuardTemporalRecoveryIdentitiesV39 = identities;
    global.RainGuardTemporalCoordinateChangeRecoveryInputV39 = feed;
    global.RainGuardPersistentIdentityMotionRecoveryInputV39 = feed;

    // A compact by-identity map is useful for 15F6I / 15F6H adapters.
    const byIdentity = new Map();
    for (const identity of identities) {
      byIdentity.set(identity.persistentId || identity.identity, identity.observations);
    }
    global.RainGuardTemporalRecoveryByIdentityV39 = byIdentity;
  }

  async function run() {
    if (STATE.running) {
      return {
        success: false,
        phase: PHASE,
        version: VERSION,
        build: BUILD,
        status: "ALREADY_RUNNING"
      };
    }

    STATE.running = true;
    STATE.lastError = null;
    const startedAt = now();

    try {
      const sources = discoverSources();
      const mergedCandidates = mergeIdentityCandidates(sources);

      const identities = [];
      let duplicates = 0;
      let rejected = 0;

      for (let i = 0; i < mergedCandidates.length; i++) {
        const normalized = normalizeIdentity(mergedCandidates[i], i);
        if (!normalized) {
          rejected += 1;
          continue;
        }

        duplicates += normalized.duplicateCount;
        rejected += normalized.rejectedCount;
        identities.push(normalized);
      }

      const multiPoint = identities.filter(x => x.multiPoint);
      const coordinateChanged = identities.filter(x => x.coordinateChanged);

      let feed = [];
      for (const identity of multiPoint) {
        feed.push(...identity.observations);
        if (feed.length >= CONFIG.maxGlobalObservations) break;
      }
      feed = feed.slice(0, CONFIG.maxGlobalObservations);

      const result = {
        success: true,
        phase: PHASE,
        version: VERSION,
        build: BUILD,
        status:
          multiPoint.length > 0
            ? "RECONCILED_IDENTITIES_READY_FOR_TEMPORAL_RECOVERY"
            : identities.length > 0
              ? "IDENTITIES_FOUND_BUT_NO_MULTI_POINT_TEMPORAL_FEED"
              : "NO_RECONCILED_IDENTITY_SOURCE_FOUND",
        generatedAt: now(),
        durationMs: now() - startedAt,

        sourceCount: sources.length,
        sourceNames: sources.map(s => s.name),
        sourceRecordCount: sources.reduce((sum, s) => sum + s.records.length, 0),

        identityCount: identities.length,
        multiPointIdentityCount: multiPoint.length,
        identitiesWithCoordinateChanges: coordinateChanged.length,
        observationFeedCount: feed.length,
        duplicateObservationCount: duplicates,
        rejectedObservationCount: rejected,

        maxObservedPointsPerIdentity:
          identities.reduce((m, x) => Math.max(m, x.observationCount), 0),
        maxUniqueCoordinatesPerIdentity:
          identities.reduce((m, x) => Math.max(m, x.uniqueCoordinateCount), 0),

        identitySample: identities.slice(0, 10),
        multiPointSample: multiPoint.slice(0, 10),
        feedSample: feed.slice(0, 20)
      };

      STATE.identities = identities;
      STATE.feed = feed;
      STATE.sourceNames = result.sourceNames;
      STATE.lastRun = result;
      STATE.totals.runs += 1;
      STATE.totals.sourceRecords = result.sourceRecordCount;
      STATE.totals.identities = result.identityCount;
      STATE.totals.multiPointIdentities = result.multiPointIdentityCount;
      STATE.totals.observations = result.observationFeedCount;
      STATE.totals.duplicates = duplicates;
      STATE.totals.rejected = rejected;

      publish(identities, feed, result);

      console.log(`[RainGuard Phase ${PHASE}] Reconciled Identity -> Temporal Recovery Integration result:`);
      console.log(result);

      return result;
    } catch (error) {
      STATE.lastError = error;

      const result = {
        success: false,
        phase: PHASE,
        version: VERSION,
        build: BUILD,
        status: "INTEGRATION_BRIDGE_ERROR",
        generatedAt: now(),
        durationMs: now() - startedAt,
        error: String(error?.stack || error?.message || error)
      };

      STATE.lastRun = result;
      console.error(`[RainGuard Phase ${PHASE}]`, error);
      return result;
    } finally {
      STATE.running = false;
    }
  }

  function getFeed() {
    return STATE.feed.slice();
  }

  function getIdentities() {
    return STATE.identities.slice();
  }

  function diagnose() {
    return {
      success: true,
      phase: PHASE,
      version: VERSION,
      build: BUILD,
      installed: STATE.installed,
      running: STATE.running,
      lastRun: STATE.lastRun,
      lastError: STATE.lastError ? String(STATE.lastError) : null,
      sourceNames: STATE.sourceNames.slice(),
      identityCount: STATE.identities.length,
      multiPointIdentityCount: STATE.identities.filter(x => x.multiPoint).length,
      identitiesWithCoordinateChanges: STATE.identities.filter(x => x.coordinateChanged).length,
      observationFeedCount: STATE.feed.length,
      totals: { ...STATE.totals },
      config: { ...CONFIG },
      sampleIdentities: STATE.identities.slice(0, 10),
      sampleFeed: STATE.feed.slice(0, 20)
    };
  }

  global.runRainGuardReconciledIdentityTemporalRecoveryIntegrationBridge = run;
  global.getRainGuardReconciledIdentityTemporalRecoveryFeed = getFeed;
  global.getRainGuardReconciledIdentityTemporalRecoveryIdentities = getIdentities;
  global.diagnoseRainGuardReconciledIdentityTemporalRecoveryIntegrationBridge = diagnose;

  global.RainGuardPhase39A15F6K = {
    phase: PHASE,
    version: VERSION,
    build: BUILD,
    config: CONFIG,
    state: STATE,
    run,
    getFeed,
    getIdentities,
    diagnose
  };

  console.log(
    `[RainGuard Phase ${PHASE}] ${BUILD} installed.`
  );
})(window);
