/**
 * RainGuard AI V39
 * Phase 39A-15F6N4B1B3A
 * Cross-Cycle Same-Coordinate Temporal Append Override Bridge
 * Version: 39A.15F6N4B1B3A.0
 *
 * Purpose
 * -------
 * Override the remaining single-point lock in N4B1B3.
 *
 * Required behavior:
 *   same identity + same coordinate + DIFFERENT cycle
 *   => append a new temporal observation
 *
 *   same identity + same coordinate + SAME cycle
 *   => duplicate
 *
 * This bridge intentionally prioritizes cross-cycle continuity over
 * timestamp similarity because upstream timestamps may be stale or reused.
 *
 * Public API
 * ----------
 * window.runRainGuardCrossCycleSameCoordinateTemporalAppendOverrideBridge(options?)
 * window.diagnoseRainGuardCrossCycleSameCoordinateTemporalAppendOverrideBridge()
 * window.resetRainGuardCrossCycleSameCoordinateTemporalAppendOverrideBridgeState()
 *
 * Published stores
 * ----------------
 * window.RainGuardCrossCycleTemporalAppendOverrideAccumulatorV39
 * window.RainGuardCrossCycleTemporalAppendOverrideHistoriesV39
 * window.RainGuardCrossCycleSameCoordinateTemporalAppendOverrideResultV39
 */

(function installRainGuardCrossCycleSameCoordinateTemporalAppendOverrideBridge(global) {
  "use strict";

  const PHASE = "39A-15F6N4B1B3A";
  const VERSION = "39A.15F6N4B1B3A.0";
  const BUILD = "rainguard-v39-cross-cycle-same-coordinate-temporal-append-override-bridge";
  const INSTALL_FLAG = "__RainGuardCrossCycleSameCoordinateTemporalAppendOverrideBridgeInstalled";
  const STORAGE_KEY = "RainGuard:39A15F6N4B1B3A:crossCycleTemporalAppendOverride:v1";

  if (global[INSTALL_FLAG]) return;
  global[INSTALL_FLAG] = true;

  const DEFAULTS = Object.freeze({
    coordinatePrecision: 5,
    maxIdentities: 5000,
    maxObservationsPerIdentity: 64,
    maxGlobalObservations: 100000,
    cycleIdPrefix: "rg39a15f6n4b1b3a",
    persistLocalStorage: true,
    invokePrerequisites: true,
    logSummary: true,
    maxCandidateScanKeys: 8000
  });

  const runtimeState = {
    installed: true,
    running: false,
    runs: 0,
    lastRun: null,
    lastError: null,
    lastCycleId: null
  };

  const now = () => Date.now();

  function isObject(v) {
    return !!v && typeof v === "object";
  }

  function safeString(v) {
    try { return v == null ? "" : String(v); }
    catch (_) { return ""; }
  }

  function finiteNumber(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function normalizeIdentity(v) {
    return safeString(v)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/^(track|storm|cell|identity|persistent):/i, "");
  }

  function extractIdentityKey(record) {
    if (!isObject(record)) return "";

    const candidates = [
      record.persistentId,
      record.canonicalPersistentId,
      record.authoritativeIdentity,
      record.canonicalIdentity,
      record.canonicalTrackId,
      record.canonicalId,
      record.identityKey,
      record.recoveredIdentityKey,
      record.identity,
      record.trackId,
      record.cellId,
      record.stormId,
      record.entityId,
      record.id,
      record.name
    ];

    for (const v of candidates) {
      const id = normalizeIdentity(v);
      if (id) return id;
    }
    return "";
  }

  function extractCoordinate(record) {
    if (!isObject(record)) return null;

    const latCandidates = [
      record.latitude,
      record.lat,
      record.coordinate && record.coordinate.latitude,
      record.coordinate && record.coordinate.lat,
      record.coordinates && record.coordinates.latitude,
      record.coordinates && record.coordinates.lat,
      Array.isArray(record.coordinate) ? record.coordinate[0] : null,
      Array.isArray(record.coordinates) ? record.coordinates[0] : null
    ];

    const lonCandidates = [
      record.longitude,
      record.lon,
      record.lng,
      record.coordinate && record.coordinate.longitude,
      record.coordinate && record.coordinate.lon,
      record.coordinate && record.coordinate.lng,
      record.coordinates && record.coordinates.longitude,
      record.coordinates && record.coordinates.lon,
      record.coordinates && record.coordinates.lng,
      Array.isArray(record.coordinate) ? record.coordinate[1] : null,
      Array.isArray(record.coordinates) ? record.coordinates[1] : null
    ];

    let latitude = null;
    let longitude = null;

    for (const v of latCandidates) {
      const n = finiteNumber(v);
      if (n !== null) { latitude = n; break; }
    }

    for (const v of lonCandidates) {
      const n = finiteNumber(v);
      if (n !== null) { longitude = n; break; }
    }

    if (latitude === null || longitude === null) return null;
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;

    return { latitude, longitude };
  }

  function parseTimestamp(value) {
    if (value == null) return null;
    if (typeof value === "number" && Number.isFinite(value)) {
      return value < 1e12 ? value * 1000 : value;
    }
    const t = Date.parse(value);
    return Number.isFinite(t) ? t : null;
  }

  function extractTimestamp(record, fallback) {
    if (!isObject(record)) return fallback;

    const candidates = [
      record.observedAt,
      record.timestamp,
      record.time,
      record.eventTime,
      record.captureTime,
      record.lastSeenAt,
      record.updatedAt,
      record.generatedAt,
      record.accumulatedAt,
      record.createdAt
    ];

    for (const v of candidates) {
      const t = parseTimestamp(v);
      if (t !== null) return t;
    }

    return fallback;
  }

  function extractSource(record) {
    const candidates = [
      record.source,
      record.sourceName,
      record.provider,
      record.origin,
      record.phase
    ];

    for (const v of candidates) {
      const s = safeString(v).trim();
      if (s) return s;
    }

    return "authoritative-runtime";
  }

  function unwrapCollection(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value;

    if (value instanceof Map || value instanceof Set) {
      try { return Array.from(value.values()); }
      catch (_) { return []; }
    }

    if (!isObject(value)) return [];

    const preferred = [
      "identities",
      "authoritativeIdentities",
      "persistentIdentities",
      "registry",
      "records",
      "items",
      "data",
      "entities",
      "tracks",
      "observations",
      "history",
      "values"
    ];

    for (const key of preferred) {
      try {
        const nested = value[key];
        if (Array.isArray(nested)) return nested;
        if (nested instanceof Map || nested instanceof Set) return Array.from(nested.values());
        if (isObject(nested)) {
          const vals = Object.values(nested);
          if (vals.length) return vals;
        }
      } catch (_) {}
    }

    try { return Object.values(value); }
    catch (_) { return []; }
  }

  function scoreSource(name, records) {
    const lname = safeString(name).toLowerCase();
    let score = 0;

    if (/authoritative/.test(lname)) score += 50;
    if (/persistent/.test(lname)) score += 30;
    if (/identity|identit/.test(lname)) score += 25;
    if (/registry/.test(lname)) score += 20;
    if (/runtime/.test(lname)) score += 12;
    if (/motionrecord|motionrecords/.test(lname)) score += 10;
    if (/sample|diagnostic|result|config/.test(lname)) score -= 25;

    const sample = records.slice(0, 100);
    let ids = 0;
    let coords = 0;

    for (const r of sample) {
      if (extractIdentityKey(r)) ids++;
      if (extractCoordinate(r)) coords++;
    }

    score += Math.round((ids / Math.max(sample.length, 1)) * 30);
    score += Math.round((coords / Math.max(sample.length, 1)) * 25);

    if (records.length >= 500) score += 20;
    else if (records.length >= 100) score += 15;
    else if (records.length >= 20) score += 8;

    return { score, ids, coords };
  }

  function discoverSource(cfg) {
    const preferred = [
      "RainGuardRuntimeAuthoritativePersistentIdentityRegistryV39",
      "RainGuardAuthoritativePersistentStormIdentitiesV39",
      "RainGuardPublishedAuthoritativePersistentStormIdentitiesV39",
      "RainGuardAuthoritativeIdentityPersistentRegistryV39",
      "RainGuardIntegratedPersistentStormIdentitiesV39",
      "RainGuardPersistentIdentityMotionRecordsV39"
    ];

    const candidates = [];
    const seen = new Set();

    function add(name, value) {
      if (seen.has(name)) return;
      seen.add(name);

      const records = unwrapCollection(value);
      if (!records.length) return;

      const s = scoreSource(name, records);
      candidates.push({
        sourceName: name,
        value,
        records,
        score: s.score,
        sampleIdentityCount: s.ids,
        sampleCoordinateCount: s.coords
      });
    }

    for (const name of preferred) {
      try {
        if (global[name]) add(name, global[name]);
      } catch (_) {}
    }

    let keys = [];
    try { keys = Object.keys(global).slice(0, cfg.maxCandidateScanKeys); }
    catch (_) {}

    for (const name of keys) {
      if (!/rain|storm|identity|registry|track/i.test(name)) continue;
      try {
        const value = global[name];
        if (!value || typeof value === "function") continue;
        add(name, value);
      } catch (_) {}
    }

    candidates.sort((a, b) =>
      b.score !== a.score ? b.score - a.score : b.records.length - a.records.length
    );

    return { selected: candidates[0] || null, candidates };
  }

  function emptyAccumulator() {
    return {
      phase: PHASE,
      version: VERSION,
      createdAt: now(),
      updatedAt: now(),
      identities: {}
    };
  }

  function cloneJson(value) {
    try { return JSON.parse(JSON.stringify(value)); }
    catch (_) { return null; }
  }

  function loadAccumulator() {
    // Prefer already accumulated state from this phase.
    if (isObject(global.RainGuardCrossCycleTemporalAppendOverrideAccumulatorV39) &&
        isObject(global.RainGuardCrossCycleTemporalAppendOverrideAccumulatorV39.identities)) {
      return global.RainGuardCrossCycleTemporalAppendOverrideAccumulatorV39;
    }

    // Import N4B1B3 history if present.
    if (isObject(global.RainGuardTimestampAwareTemporalObservationAccumulatorV39) &&
        isObject(global.RainGuardTimestampAwareTemporalObservationAccumulatorV39.identities)) {
      const cloned = cloneJson(global.RainGuardTimestampAwareTemporalObservationAccumulatorV39);
      if (cloned) return cloned;
    }

    try {
      const raw = global.localStorage && global.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (isObject(parsed) && isObject(parsed.identities)) return parsed;
      }
    } catch (_) {}

    return emptyAccumulator();
  }

  function saveAccumulator(accumulator, cfg) {
    accumulator.updatedAt = now();

    global.RainGuardCrossCycleTemporalAppendOverrideAccumulatorV39 = accumulator;
    global.RainGuardCrossCycleTemporalAppendOverrideHistoriesV39 = accumulator.identities;

    if (cfg.persistLocalStorage) {
      try {
        global.localStorage.setItem(STORAGE_KEY, JSON.stringify(accumulator));
      } catch (_) {}
    }
  }

  function coordinateKey(obs, precision) {
    return `${Number(obs.latitude).toFixed(precision)}|${Number(obs.longitude).toFixed(precision)}`;
  }

  function sameCoordinate(a, b, precision) {
    return coordinateKey(a, precision) === coordinateKey(b, precision);
  }

  function ensureIdentity(accumulator, identityKey, sourceName) {
    let identity = accumulator.identities[identityKey];

    if (!identity) {
      identity = accumulator.identities[identityKey] = {
        identity: identityKey,
        authoritativeIdentity: identityKey,
        aliases: [],
        observations: [],
        registrySource: sourceName,
        createdAt: now(),
        updatedAt: now()
      };
    }

    if (!Array.isArray(identity.observations)) identity.observations = [];

    return identity;
  }

  function normalizeLegacyObservation(obs, identityKey, sourceName, syntheticCycleId) {
    if (!isObject(obs)) return null;

    const coord = extractCoordinate(obs);
    if (!coord) return null;

    const observedAt = extractTimestamp(obs, now());

    return {
      identity: identityKey,
      latitude: coord.latitude,
      longitude: coord.longitude,
      coordinate: {
        latitude: coord.latitude,
        longitude: coord.longitude
      },
      observedAt,
      timestamp: observedAt,
      cycleId: safeString(obs.cycleId || syntheticCycleId),
      cycleObservedAt: parseTimestamp(obs.cycleObservedAt) || observedAt,
      source: extractSource(obs),
      registrySource: sourceName,
      importedLegacy: true,
      appendedAt: parseTimestamp(obs.appendedAt) || now(),
      phase: safeString(obs.phase || PHASE)
    };
  }

  function buildIncomingObservation(record, identityKey, sourceName, cycleId, cycleTimestamp) {
    const coord = extractCoordinate(record);
    if (!coord) return null;

    return {
      identity: identityKey,
      latitude: coord.latitude,
      longitude: coord.longitude,
      coordinate: {
        latitude: coord.latitude,
        longitude: coord.longitude
      },
      observedAt: extractTimestamp(record, cycleTimestamp),
      timestamp: extractTimestamp(record, cycleTimestamp),
      cycleId,
      cycleObservedAt: cycleTimestamp,
      source: extractSource(record),
      registrySource: sourceName,
      appendedAt: now(),
      phase: PHASE,
      appendOverride: true
    };
  }

  function sameCycleDuplicate(identity, incoming, cfg) {
    const observations = identity.observations || [];

    for (const obs of observations) {
      if (!sameCoordinate(obs, incoming, cfg.coordinatePrecision)) continue;
      if (safeString(obs.cycleId) === safeString(incoming.cycleId)) return true;
    }

    return false;
  }

  function alreadyAppendedThisRun(identity, incoming, cfg) {
    const observations = identity.observations || [];
    return observations.some(obs =>
      sameCoordinate(obs, incoming, cfg.coordinatePrecision) &&
      safeString(obs.cycleId) === safeString(incoming.cycleId)
    );
  }

  function recomputeIdentity(identity, cfg) {
    const observations = Array.isArray(identity.observations)
      ? identity.observations
      : [];

    observations.sort((a, b) =>
      Number(a.cycleObservedAt || a.observedAt || 0) -
      Number(b.cycleObservedAt || b.observedAt || 0)
    );

    const uniqueCoordinates = new Set();
    const cycles = new Set();

    for (const obs of observations) {
      uniqueCoordinates.add(coordinateKey(obs, cfg.coordinatePrecision));
      if (obs.cycleId) cycles.add(safeString(obs.cycleId));
    }

    let coordinateChanging = false;

    for (let i = 1; i < observations.length; i++) {
      if (!sameCoordinate(observations[i - 1], observations[i], cfg.coordinatePrecision)) {
        coordinateChanging = true;
        break;
      }
    }

    identity.observationCount = observations.length;
    identity.uniqueCoordinateCount = uniqueCoordinates.size;
    identity.cycleCount = cycles.size;
    identity.multiPoint = observations.length >= 2;
    identity.crossCycle = cycles.size >= 2;
    identity.coordinateChanging = coordinateChanging;
    identity.firstObservedAt = observations.length
      ? observations[0].cycleObservedAt || observations[0].observedAt
      : null;
    identity.lastObservedAt = observations.length
      ? observations[observations.length - 1].cycleObservedAt || observations[observations.length - 1].observedAt
      : null;
    identity.updatedAt = now();
  }

  function normalizeImportedAccumulator(accumulator, sourceName) {
    for (const [identityKey, identity] of Object.entries(accumulator.identities || {})) {
      if (!identity || !Array.isArray(identity.observations)) continue;

      const normalized = [];
      let legacyIndex = 0;

      for (const obs of identity.observations) {
        const syntheticCycleId =
          `legacy-${normalizeIdentity(identityKey)}-${legacyIndex++}`;

        const normalizedObs =
          normalizeLegacyObservation(obs, normalizeIdentity(identityKey), sourceName, syntheticCycleId);

        if (normalizedObs) normalized.push(normalizedObs);
      }

      identity.observations = normalized;
    }
  }

  function summarize(accumulator) {
    const identities = Object.values(accumulator.identities || {});

    let observationCount = 0;
    let multiPointIdentityCount = 0;
    let crossCycleIdentityCount = 0;
    let coordinateChangingIdentityCount = 0;
    let maxObservedPointsPerIdentity = 0;
    let maxUniqueCoordinatesPerIdentity = 0;
    let maxCyclesPerIdentity = 0;

    for (const identity of identities) {
      observationCount += Number(identity.observationCount || 0);

      if (identity.multiPoint) multiPointIdentityCount++;
      if (identity.crossCycle) crossCycleIdentityCount++;
      if (identity.coordinateChanging) coordinateChangingIdentityCount++;

      maxObservedPointsPerIdentity = Math.max(
        maxObservedPointsPerIdentity,
        Number(identity.observationCount || 0)
      );

      maxUniqueCoordinatesPerIdentity = Math.max(
        maxUniqueCoordinatesPerIdentity,
        Number(identity.uniqueCoordinateCount || 0)
      );

      maxCyclesPerIdentity = Math.max(
        maxCyclesPerIdentity,
        Number(identity.cycleCount || 0)
      );
    }

    return {
      identityCount: identities.length,
      observationCount,
      multiPointIdentityCount,
      crossCycleIdentityCount,
      coordinateChangingIdentityCount,
      maxObservedPointsPerIdentity,
      maxUniqueCoordinatesPerIdentity,
      maxCyclesPerIdentity
    };
  }

  function prune(accumulator, cfg) {
    let entries = Object.entries(accumulator.identities || {});

    if (entries.length > cfg.maxIdentities) {
      entries.sort((a, b) =>
        Number(b[1].lastObservedAt || 0) - Number(a[1].lastObservedAt || 0)
      );
      accumulator.identities = Object.fromEntries(entries.slice(0, cfg.maxIdentities));
    }

    for (const identity of Object.values(accumulator.identities || {})) {
      if (!identity || !Array.isArray(identity.observations)) continue;

      if (identity.observations.length > cfg.maxObservationsPerIdentity) {
        identity.observations =
          identity.observations.slice(-cfg.maxObservationsPerIdentity);
      }
    }

    let total = 0;
    const all = [];

    for (const [identityKey, identity] of Object.entries(accumulator.identities || {})) {
      for (let i = 0; i < (identity.observations || []).length; i++) {
        const obs = identity.observations[i];
        total++;
        all.push({
          identityKey,
          index: i,
          time: Number(obs.cycleObservedAt || obs.observedAt || 0)
        });
      }
    }

    if (total <= cfg.maxGlobalObservations) return;

    all.sort((a, b) => b.time - a.time);
    const keep = new Set(
      all.slice(0, cfg.maxGlobalObservations)
        .map(x => `${x.identityKey}|${x.index}`)
    );

    for (const [identityKey, identity] of Object.entries(accumulator.identities || {})) {
      identity.observations = (identity.observations || []).filter((_, i) =>
        keep.has(`${identityKey}|${i}`)
      );
    }
  }

  async function invokePrerequisites() {
    const chain = [
      "runRainGuardAuthoritativeRegistryRuntimeBindingDeferredExecutionBridge",
      "runRainGuardRuntimeAuthoritativeRegistrySourceDiscoveryBindingBridge",
      "runRainGuardAuthoritativeLiveTrackHistoryForcedRehydrationBridge"
    ];

    const out = [];

    for (const name of chain) {
      const fn = global[name];
      if (typeof fn !== "function") continue;

      try {
        const result = await fn({
          invokeN4B1B: false,
          logCandidates: false
        });

        out.push({
          name,
          invoked: true,
          success: !(result && result.success === false)
        });
      } catch (error) {
        out.push({
          name,
          invoked: true,
          success: false,
          error: error && error.message ? error.message : safeString(error)
        });
      }
    }

    return out;
  }

  async function run(options) {
    const startedAt = now();

    if (runtimeState.running) {
      return {
        success: false,
        phase: PHASE,
        version: VERSION,
        build: BUILD,
        status: "CROSS_CYCLE_TEMPORAL_APPEND_OVERRIDE_ALREADY_RUNNING"
      };
    }

    runtimeState.running = true;

    try {
      const cfg = Object.assign({}, DEFAULTS, isObject(options) ? options : {});
      const cycleTimestamp = now();
      const cycleId =
        `${cfg.cycleIdPrefix}-${cycleTimestamp}-${Math.random().toString(36).slice(2, 8)}`;

      runtimeState.lastCycleId = cycleId;

      const prerequisiteResults = cfg.invokePrerequisites
        ? await invokePrerequisites()
        : [];

      const discovery = discoverSource(cfg);
      const selected = discovery.selected;

      if (!selected || !selected.records.length) {
        const result = {
          success: false,
          phase: PHASE,
          version: VERSION,
          build: BUILD,
          status: "NO_AUTHORITATIVE_SOURCE_FOUND",
          candidateCount: discovery.candidates.length,
          cycleId,
          generatedAt: now(),
          durationMs: now() - startedAt
        };

        runtimeState.lastRun = result;
        return result;
      }

      const accumulator = loadAccumulator();
      normalizeImportedAccumulator(accumulator, selected.sourceName);

      let acceptedObservationCount = 0;
      let sameCoordinateCrossCycleAppendCount = 0;
      let changedCoordinateCrossCycleAppendCount = 0;
      let trueSameCycleDuplicateCount = 0;
      let rejectedNoIdentityCount = 0;
      let rejectedNoCoordinateCount = 0;
      let newIdentityCount = 0;

      const touched = new Set();

      for (const record of selected.records) {
        const identityKey = extractIdentityKey(record);

        if (!identityKey) {
          rejectedNoIdentityCount++;
          continue;
        }

        const existed = !!accumulator.identities[identityKey];
        const identity = ensureIdentity(accumulator, identityKey, selected.sourceName);

        if (!existed) newIdentityCount++;

        const incoming = buildIncomingObservation(
          record,
          identityKey,
          selected.sourceName,
          cycleId,
          cycleTimestamp
        );

        if (!incoming) {
          rejectedNoCoordinateCount++;
          continue;
        }

        touched.add(identityKey);

        // Only same-cycle duplicate is rejected.
        if (alreadyAppendedThisRun(identity, incoming, cfg)) {
          trueSameCycleDuplicateCount++;
          continue;
        }

        const prior = identity.observations || [];
        const previous = prior.length ? prior[prior.length - 1] : null;

        if (previous) {
          if (sameCoordinate(previous, incoming, cfg.coordinatePrecision)) {
            sameCoordinateCrossCycleAppendCount++;
          } else {
            changedCoordinateCrossCycleAppendCount++;
          }
        }

        identity.observations.push(incoming);
        acceptedObservationCount++;
      }

      for (const identity of Object.values(accumulator.identities || {})) {
        recomputeIdentity(identity, cfg);
      }

      prune(accumulator, cfg);

      for (const identity of Object.values(accumulator.identities || {})) {
        recomputeIdentity(identity, cfg);
      }

      saveAccumulator(accumulator, cfg);

      const summary = summarize(accumulator);

      const multiPointGatePassed = summary.multiPointIdentityCount > 0;
      const crossCycleGatePassed = summary.crossCycleIdentityCount > 0;
      const sameCoordinateCrossCycleGatePassed =
        sameCoordinateCrossCycleAppendCount > 0 &&
        crossCycleGatePassed &&
        summary.maxObservedPointsPerIdentity >= 2;

      const coordinateChangeGatePassed =
        summary.coordinateChangingIdentityCount > 0 &&
        summary.maxUniqueCoordinatesPerIdentity >= 2;

      let status = "CROSS_CYCLE_APPEND_OVERRIDE_READY_SINGLE_POINT_ONLY";

      if (sameCoordinateCrossCycleGatePassed && !coordinateChangeGatePassed) {
        status = "SAME_COORDINATE_CROSS_CYCLE_TEMPORAL_APPEND_CONFIRMED";
      }

      if (coordinateChangeGatePassed) {
        status = "CROSS_CYCLE_TEMPORAL_SEQUENCE_WITH_COORDINATE_CHANGE_RECOVERED";
      }

      const result = {
        success: true,
        phase: PHASE,
        version: VERSION,
        build: BUILD,
        status,

        cycleId,
        cycleTimestamp,

        selectedSourceName: selected.sourceName,
        selectedSourceScore: selected.score,
        selectedIdentityRecordCount: selected.records.length,

        candidateCount: discovery.candidates.length,
        candidateSample: discovery.candidates.slice(0, 15).map(c => ({
          source: c.sourceName,
          records: c.records.length,
          score: c.score,
          sampleIdentityCount: c.sampleIdentityCount,
          sampleCoordinateCount: c.sampleCoordinateCount
        })),

        acceptedObservationCount,
        sameCoordinateCrossCycleAppendCount,
        changedCoordinateCrossCycleAppendCount,
        trueSameCycleDuplicateCount,
        rejectedNoIdentityCount,
        rejectedNoCoordinateCount,
        newIdentityCount,
        identitiesTouchedCount: touched.size,

        identityCount: summary.identityCount,
        observationCount: summary.observationCount,
        multiPointIdentityCount: summary.multiPointIdentityCount,
        crossCycleIdentityCount: summary.crossCycleIdentityCount,
        coordinateChangingIdentityCount: summary.coordinateChangingIdentityCount,
        maxObservedPointsPerIdentity: summary.maxObservedPointsPerIdentity,
        maxUniqueCoordinatesPerIdentity: summary.maxUniqueCoordinatesPerIdentity,
        maxCyclesPerIdentity: summary.maxCyclesPerIdentity,

        multiPointGatePassed,
        crossCycleGatePassed,
        sameCoordinateCrossCycleGatePassed,
        coordinateChangeGatePassed,

        temporalAppendOverridePassed:
          multiPointGatePassed &&
          crossCycleGatePassed &&
          sameCoordinateCrossCycleGatePassed,

        persistedToLocalStorage: !!cfg.persistLocalStorage,
        storageKey: STORAGE_KEY,
        prerequisiteResults,

        sample: Object.values(accumulator.identities || {})
          .filter(x => x && x.observationCount > 0)
          .sort((a, b) => Number(b.observationCount || 0) - Number(a.observationCount || 0))
          .slice(0, 20),

        generatedAt: now(),
        durationMs: now() - startedAt
      };

      global.RainGuardCrossCycleSameCoordinateTemporalAppendOverrideResultV39 = result;
      runtimeState.runs++;
      runtimeState.lastRun = result;
      runtimeState.lastError = null;

      if (cfg.logSummary) {
        console.log(
          `[RainGuard Phase ${PHASE}] Cross-Cycle Same-Coordinate Temporal Append Override result:`
        );
        console.log(result);

        if (typeof console.table === "function") {
          try {
            console.table(
              result.sample.slice(0, 15).map(x => ({
                identity: x.identity,
                observations: x.observationCount,
                cycles: x.cycleCount,
                uniqueCoordinates: x.uniqueCoordinateCount,
                multiPoint: x.multiPoint,
                crossCycle: x.crossCycle,
                coordinateChanging: x.coordinateChanging
              }))
            );
          } catch (_) {}
        }
      }

      return result;

    } catch (error) {
      const result = {
        success: false,
        phase: PHASE,
        version: VERSION,
        build: BUILD,
        status: "CROSS_CYCLE_TEMPORAL_APPEND_OVERRIDE_FAILED",
        error: error && error.message ? error.message : safeString(error),
        generatedAt: now(),
        durationMs: now() - startedAt
      };

      runtimeState.lastRun = result;
      runtimeState.lastError = result.error;

      console.error(`[RainGuard Phase ${PHASE}] failed:`, error);
      return result;

    } finally {
      runtimeState.running = false;
    }
  }

  function diagnose() {
    const accumulator = loadAccumulator();
    const cfg = Object.assign({}, DEFAULTS);

    for (const identity of Object.values(accumulator.identities || {})) {
      recomputeIdentity(identity, cfg);
    }

    const summary = summarize(accumulator);

    const result = {
      success: true,
      phase: PHASE,
      version: VERSION,
      build: BUILD,
      installed: true,
      running: runtimeState.running,
      runs: runtimeState.runs,
      lastCycleId: runtimeState.lastCycleId,
      lastError: runtimeState.lastError,
      ...summary,
      storageKey: STORAGE_KEY,
      lastRun: runtimeState.lastRun
    };

    console.log(`[RainGuard Phase ${PHASE}] Diagnostic:`, result);
    return result;
  }

  function reset() {
    try {
      if (global.localStorage) global.localStorage.removeItem(STORAGE_KEY);
    } catch (_) {}

    global.RainGuardCrossCycleTemporalAppendOverrideAccumulatorV39 = emptyAccumulator();
    global.RainGuardCrossCycleTemporalAppendOverrideHistoriesV39 =
      global.RainGuardCrossCycleTemporalAppendOverrideAccumulatorV39.identities;

    const result = {
      success: true,
      phase: PHASE,
      version: VERSION,
      build: BUILD,
      status: "CROSS_CYCLE_TEMPORAL_APPEND_OVERRIDE_RESET",
      generatedAt: now()
    };

    console.log(`[RainGuard Phase ${PHASE}] reset.`);
    return result;
  }

  global.runRainGuardCrossCycleSameCoordinateTemporalAppendOverrideBridge = run;
  global.diagnoseRainGuardCrossCycleSameCoordinateTemporalAppendOverrideBridge = diagnose;
  global.resetRainGuardCrossCycleSameCoordinateTemporalAppendOverrideBridgeState = reset;

  global.RainGuardCrossCycleSameCoordinateTemporalAppendOverrideBridgeV39 = {
    phase: PHASE,
    version: VERSION,
    build: BUILD,
    run,
    diagnose,
    reset,
    state: runtimeState
  };

})(window);
