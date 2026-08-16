/**
 * RainGuard AI V39
 * Phase 39A-15F6N4B1B2
 * Cross-Cycle Authoritative Identity Temporal Observation Accumulation Bridge
 * Version: 39A.15F6N4B1B2.0
 *
 * Purpose
 * -------
 * Build true multi-point temporal histories for authoritative persistent storm identities
 * across repeated runtime cycles.
 *
 * This bridge:
 * 1) reads authoritative identities already bound by N4B1B1,
 * 2) captures current coordinates + timestamps,
 * 3) persists observations across cycles,
 * 4) de-duplicates same coordinate/time observations,
 * 5) tracks unique coordinate changes per identity,
 * 6) publishes a canonical temporal-history registry,
 * 7) optionally triggers N4B1B after enough temporal points exist.
 *
 * Public API
 * ----------
 * window.runRainGuardCrossCycleAuthoritativeIdentityTemporalObservationAccumulationBridge(options?)
 * window.diagnoseRainGuardCrossCycleAuthoritativeIdentityTemporalObservationAccumulationBridge()
 * window.resetRainGuardCrossCycleAuthoritativeIdentityTemporalObservationAccumulator()
 *
 * Published canonical runtime objects
 * -----------------------------------
 * window.RainGuardAuthoritativeIdentityTemporalObservationAccumulatorV39
 * window.RainGuardAuthoritativeIdentityTemporalHistoriesV39
 * window.RainGuardAuthoritativeIdentityTemporalObservationAccumulatorStateV39
 */

(function installRainGuardCrossCycleAuthoritativeIdentityTemporalObservationAccumulationBridge(global) {
  "use strict";

  const PHASE = "39A-15F6N4B1B2";
  const VERSION = "39A.15F6N4B1B2.0";
  const BUILD = "rainguard-v39-cross-cycle-authoritative-identity-temporal-observation-accumulation-bridge";

  const INSTALL_FLAG = "__RainGuardCrossCycleAuthoritativeIdentityTemporalObservationAccumulationBridgeInstalled";
  const STORAGE_KEY = "RainGuard:39A15F6N4B1B2:authoritativeTemporalAccumulator:v1";

  if (global[INSTALL_FLAG]) return;
  global[INSTALL_FLAG] = true;

  const DEFAULTS = Object.freeze({
    maxIdentities: 5000,
    maxObservationsPerIdentity: 24,
    maxGlobalObservations: 50000,
    minTimeDeltaMs: 1000,
    coordinatePrecision: 5,
    minCoordinateDeltaDegrees: 0.00001,
    persistLocalStorage: true,
    invokePrerequisites: true,
    invokeDownstreamN4B1B: true,
    downstreamMinMultiPointIdentityCount: 1,
    downstreamMinCoordinateChangingIdentityCount: 1,
    maxCandidateScanKeys: 7000,
    logSummary: true
  });

  const state = {
    installed: true,
    running: false,
    runs: 0,
    lastRun: null,
    lastError: null,
    lastPersistedAt: null
  };

  const now = () => Date.now();

  function isObject(v) {
    return !!v && typeof v === "object";
  }

  function safeString(v) {
    try {
      return v == null ? "" : String(v);
    } catch (_) {
      return "";
    }
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

    for (const value of candidates) {
      const id = normalizeIdentity(value);
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

    let lat = null;
    let lon = null;

    for (const v of latCandidates) {
      const n = finiteNumber(v);
      if (n !== null) {
        lat = n;
        break;
      }
    }

    for (const v of lonCandidates) {
      const n = finiteNumber(v);
      if (n !== null) {
        lon = n;
        break;
      }
    }

    if (lat === null || lon === null) return null;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;

    return { latitude: lat, longitude: lon };
  }

  function extractTimestamp(record) {
    if (!isObject(record)) return now();

    const candidates = [
      record.observedAt,
      record.timestamp,
      record.time,
      record.generatedAt,
      record.updatedAt,
      record.accumulatedAt,
      record.createdAt,
      record.lastSeenAt
    ];

    for (const value of candidates) {
      if (value == null) continue;

      if (typeof value === "number" && Number.isFinite(value)) {
        return value < 1e12 ? value * 1000 : value;
      }

      const parsed = Date.parse(value);
      if (Number.isFinite(parsed)) return parsed;
    }

    return now();
  }

  function extractConfidence(record) {
    const candidates = [
      record.confidence,
      record.score,
      record.trust,
      record.quality,
      record.probability
    ];

    for (const value of candidates) {
      const n = finiteNumber(value);
      if (n !== null) return n;
    }
    return null;
  }

  function extractSource(record) {
    const candidates = [
      record.source,
      record.sourceName,
      record.provider,
      record.origin,
      record.phase
    ];
    for (const value of candidates) {
      const s = safeString(value).trim();
      if (s) return s;
    }
    return "authoritative-runtime";
  }

  function unwrapCollection(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value;

    if (value instanceof Map || value instanceof Set) {
      try {
        return Array.from(value.values());
      } catch (_) {
        return [];
      }
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

    try {
      return Object.values(value);
    } catch (_) {
      return [];
    }
  }

  function scoreSource(name, records) {
    const lname = safeString(name).toLowerCase();
    let score = 0;

    if (/authoritative/.test(lname)) score += 40;
    if (/persistent/.test(lname)) score += 25;
    if (/identity|identit/.test(lname)) score += 25;
    if (/registry/.test(lname)) score += 18;
    if (/runtime/.test(lname)) score += 10;
    if (/motionrecord|motion_record|motionrecords/.test(lname)) score += 10;
    if (/published/.test(lname)) score += 8;
    if (/integrated/.test(lname)) score += 8;
    if (/history/.test(lname) && !/identity/.test(lname)) score -= 12;
    if (/sample|diagnostic|result|config/.test(lname)) score -= 18;

    const sample = records.slice(0, 100);
    let idCount = 0;
    let coordinateCount = 0;

    for (const r of sample) {
      if (extractIdentityKey(r)) idCount++;
      if (extractCoordinate(r)) coordinateCount++;
    }

    score += Math.round((idCount / Math.max(sample.length, 1)) * 25);
    score += Math.round((coordinateCount / Math.max(sample.length, 1)) * 20);

    if (records.length >= 500) score += 20;
    else if (records.length >= 100) score += 15;
    else if (records.length >= 20) score += 8;

    return { score, idCount, coordinateCount };
  }

  function discoverAuthoritativeSource(cfg) {
    const explicitNames = [
      "RainGuardAuthoritativePersistentStormIdentitiesV39",
      "RainGuardPublishedAuthoritativePersistentStormIdentitiesV39",
      "RainGuardRuntimeAuthoritativePersistentIdentityRegistryV39",
      "RainGuardRuntimeAuthoritativeRegistryBindingV39",
      "RainGuardIntegratedPersistentStormIdentitiesV39",
      "RainGuardIntegratedIdentityPersistentRegistryV39",
      "RainGuardIntegratedPersistentIdentityRegistryV39",
      "RainGuardPersistentIdentityMotionRecordsV39"
    ];

    const candidates = [];
    const seen = new Set();

    function add(name, value) {
      if (seen.has(name)) return;
      seen.add(name);

      const records = unwrapCollection(value);
      if (!records.length) return;

      const scored = scoreSource(name, records);

      candidates.push({
        sourceName: name,
        value,
        records,
        score: scored.score,
        sampleIdentityCount: scored.idCount,
        sampleCoordinateCount: scored.coordinateCount
      });
    }

    for (const name of explicitNames) {
      try {
        if (global[name]) add(name, global[name]);
      } catch (_) {}
    }

    let keys = [];
    try {
      keys = Object.keys(global).slice(0, cfg.maxCandidateScanKeys);
    } catch (_) {}

    for (const name of keys) {
      if (!/rain|storm|identity|registry|track/i.test(name)) continue;
      try {
        const value = global[name];
        if (!value || typeof value === "function") continue;
        add(name, value);
      } catch (_) {}
    }

    candidates.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.records.length - a.records.length;
    });

    return {
      selected: candidates[0] || null,
      candidates
    };
  }

  function emptyAccumulator() {
    return {
      version: VERSION,
      phase: PHASE,
      updatedAt: now(),
      identities: {}
    };
  }

  function loadAccumulator() {
    if (isObject(global.RainGuardAuthoritativeIdentityTemporalObservationAccumulatorV39)) {
      const existing = global.RainGuardAuthoritativeIdentityTemporalObservationAccumulatorV39;
      if (isObject(existing.identities)) return existing;
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

    global.RainGuardAuthoritativeIdentityTemporalObservationAccumulatorV39 = accumulator;
    global.RainGuardAuthoritativeIdentityTemporalHistoriesV39 = accumulator.identities;

    if (cfg.persistLocalStorage) {
      try {
        global.localStorage.setItem(STORAGE_KEY, JSON.stringify(accumulator));
        state.lastPersistedAt = now();
      } catch (_) {}
    }
  }

  function observationFingerprint(obs, precision) {
    const lat = Number(obs.latitude).toFixed(precision);
    const lon = Number(obs.longitude).toFixed(precision);
    const sec = Math.floor(Number(obs.observedAt) / 1000);
    return `${lat}|${lon}|${sec}`;
  }

  function coordinateFingerprint(obs, precision) {
    return `${Number(obs.latitude).toFixed(precision)}|${Number(obs.longitude).toFixed(precision)}`;
  }

  function isCoordinateChange(a, b, minDelta) {
    if (!a || !b) return false;
    const dLat = Math.abs(Number(a.latitude) - Number(b.latitude));
    const dLon = Math.abs(Number(a.longitude) - Number(b.longitude));
    return dLat >= minDelta || dLon >= minDelta;
  }

  function pruneAccumulator(accumulator, cfg) {
    const entries = Object.entries(accumulator.identities || {});

    if (entries.length > cfg.maxIdentities) {
      entries.sort((a, b) => {
        const aLast = a[1] && a[1].lastObservedAt ? a[1].lastObservedAt : 0;
        const bLast = b[1] && b[1].lastObservedAt ? b[1].lastObservedAt : 0;
        return bLast - aLast;
      });

      accumulator.identities = Object.fromEntries(entries.slice(0, cfg.maxIdentities));
    }

    let globalCount = 0;
    for (const identity of Object.values(accumulator.identities)) {
      if (!identity || !Array.isArray(identity.observations)) continue;

      identity.observations.sort((a, b) => a.observedAt - b.observedAt);

      if (identity.observations.length > cfg.maxObservationsPerIdentity) {
        identity.observations = identity.observations.slice(-cfg.maxObservationsPerIdentity);
      }

      globalCount += identity.observations.length;
    }

    if (globalCount > cfg.maxGlobalObservations) {
      const all = [];

      for (const [identityKey, identity] of Object.entries(accumulator.identities)) {
        for (const obs of identity.observations || []) {
          all.push({ identityKey, obs });
        }
      }

      all.sort((a, b) => b.obs.observedAt - a.obs.observedAt);
      const keep = new Set(
        all.slice(0, cfg.maxGlobalObservations).map(x => `${x.identityKey}|${observationFingerprint(x.obs, cfg.coordinatePrecision)}`)
      );

      for (const [identityKey, identity] of Object.entries(accumulator.identities)) {
        identity.observations = (identity.observations || []).filter(obs =>
          keep.has(`${identityKey}|${observationFingerprint(obs, cfg.coordinatePrecision)}`)
        );
      }
    }
  }

  function buildObservation(record, identityKey, sourceName) {
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
      observedAt: extractTimestamp(record),
      timestamp: extractTimestamp(record),
      confidence: extractConfidence(record),
      source: extractSource(record),
      registrySource: sourceName,
      accumulatedAt: now(),
      phase: PHASE
    };
  }

  function recomputeIdentityStats(identity, cfg) {
    const observations = Array.isArray(identity.observations)
      ? identity.observations.slice().sort((a, b) => a.observedAt - b.observedAt)
      : [];

    identity.observations = observations;
    identity.observationCount = observations.length;

    const uniqueCoords = [];
    const seenCoords = new Set();

    for (const obs of observations) {
      const key = coordinateFingerprint(obs, cfg.coordinatePrecision);
      if (!seenCoords.has(key)) {
        seenCoords.add(key);
        uniqueCoords.push(obs);
      }
    }

    identity.uniqueCoordinateCount = uniqueCoords.length;
    identity.multiPoint = observations.length >= 2;
    identity.coordinateChanging = false;
    identity.firstObservedAt = observations.length ? observations[0].observedAt : null;
    identity.lastObservedAt = observations.length ? observations[observations.length - 1].observedAt : null;

    for (let i = 1; i < uniqueCoords.length; i++) {
      if (isCoordinateChange(uniqueCoords[i - 1], uniqueCoords[i], cfg.minCoordinateDeltaDegrees)) {
        identity.coordinateChanging = true;
        break;
      }
    }

    identity.uniqueCoordinates = uniqueCoords.map(obs => ({
      latitude: obs.latitude,
      longitude: obs.longitude,
      observedAt: obs.observedAt
    }));
  }

  async function invokePrerequisites() {
    const chain = [
      "runRainGuardAuthoritativeRegistryRuntimeBindingDeferredExecutionBridge",
      "runRainGuardRuntimeAuthoritativeRegistrySourceDiscoveryBindingBridge",
      "runRainGuardAuthoritativeLiveTrackHistoryForcedRehydrationBridge"
    ];

    const results = [];

    for (const name of chain) {
      if (typeof global[name] !== "function") continue;

      try {
        const result = await global[name]({
          invokeN4B1B: false,
          logCandidates: false
        });

        results.push({
          name,
          invoked: true,
          success: !(result && result.success === false),
          result
        });
      } catch (error) {
        results.push({
          name,
          invoked: true,
          success: false,
          error: error && error.message ? error.message : safeString(error)
        });
      }
    }

    return results;
  }

  async function invokeDownstreamIfReady(summary, cfg) {
    const ready =
      summary.multiPointIdentityCount >= cfg.downstreamMinMultiPointIdentityCount &&
      summary.coordinateChangingIdentityCount >= cfg.downstreamMinCoordinateChangingIdentityCount;

    if (!ready) {
      return {
        invoked: false,
        ready: false,
        reason: "TEMPORAL_ACCUMULATION_NOT_READY"
      };
    }

    if (!cfg.invokeDownstreamN4B1B) {
      return {
        invoked: false,
        ready: true,
        reason: "DOWNSTREAM_DISABLED"
      };
    }

    const fn = global.runRainGuardTemporalCoordinateSequenceRecoveryDeduplicationBridge;

    if (typeof fn !== "function") {
      return {
        invoked: false,
        ready: true,
        reason: "N4B1B_NOT_AVAILABLE"
      };
    }

    try {
      const result = await fn();
      return {
        invoked: true,
        ready: true,
        success: !(result && result.success === false),
        result
      };
    } catch (error) {
      return {
        invoked: true,
        ready: true,
        success: false,
        error: error && error.message ? error.message : safeString(error)
      };
    }
  }

  function summarizeAccumulator(accumulator) {
    const identities = Object.values(accumulator.identities || {});
    let observationCount = 0;
    let multiPointIdentityCount = 0;
    let coordinateChangingIdentityCount = 0;
    let maxObservedPointsPerIdentity = 0;
    let maxUniqueCoordinatesPerIdentity = 0;

    for (const identity of identities) {
      const obsCount = Number(identity.observationCount || 0);
      const uniqueCount = Number(identity.uniqueCoordinateCount || 0);

      observationCount += obsCount;
      if (identity.multiPoint) multiPointIdentityCount++;
      if (identity.coordinateChanging) coordinateChangingIdentityCount++;

      if (obsCount > maxObservedPointsPerIdentity) maxObservedPointsPerIdentity = obsCount;
      if (uniqueCount > maxUniqueCoordinatesPerIdentity) maxUniqueCoordinatesPerIdentity = uniqueCount;
    }

    return {
      identityCount: identities.length,
      observationCount,
      multiPointIdentityCount,
      coordinateChangingIdentityCount,
      maxObservedPointsPerIdentity,
      maxUniqueCoordinatesPerIdentity
    };
  }

  async function run(options) {
    const startedAt = now();

    if (state.running) {
      return {
        success: false,
        phase: PHASE,
        version: VERSION,
        build: BUILD,
        status: "TEMPORAL_OBSERVATION_ACCUMULATOR_ALREADY_RUNNING"
      };
    }

    state.running = true;

    try {
      const cfg = Object.assign({}, DEFAULTS, isObject(options) ? options : {});

      const prerequisiteResults = cfg.invokePrerequisites
        ? await invokePrerequisites()
        : [];

      const discovery = discoverAuthoritativeSource(cfg);
      const selected = discovery.selected;

      if (!selected || !selected.records.length) {
        const result = {
          success: false,
          phase: PHASE,
          version: VERSION,
          build: BUILD,
          status: "NO_AUTHORITATIVE_IDENTITIES_AVAILABLE_FOR_TEMPORAL_ACCUMULATION",
          candidateCount: discovery.candidates.length,
          prerequisiteResults,
          generatedAt: now(),
          durationMs: now() - startedAt
        };

        state.lastRun = result;
        state.lastError = null;
        return result;
      }

      const accumulator = loadAccumulator();

      let acceptedObservationCount = 0;
      let duplicateObservationCount = 0;
      let rejectedNoIdentityCount = 0;
      let rejectedNoCoordinateCount = 0;
      let newIdentityCount = 0;
      let identitiesTouched = new Set();

      for (const record of selected.records) {
        const identityKey = extractIdentityKey(record);

        if (!identityKey) {
          rejectedNoIdentityCount++;
          continue;
        }

        const obs = buildObservation(record, identityKey, selected.sourceName);

        if (!obs) {
          rejectedNoCoordinateCount++;
          continue;
        }

        let identity = accumulator.identities[identityKey];

        if (!identity) {
          identity = accumulator.identities[identityKey] = {
            identity: identityKey,
            authoritativeIdentity: identityKey,
            aliases: [],
            observations: [],
            createdAt: now(),
            updatedAt: now(),
            registrySource: selected.sourceName
          };
          newIdentityCount++;
        }

        identitiesTouched.add(identityKey);

        const incomingFp = observationFingerprint(obs, cfg.coordinatePrecision);
        const existing = identity.observations || [];

        let duplicate = false;

        for (const prior of existing) {
          const priorFp = observationFingerprint(prior, cfg.coordinatePrecision);

          if (priorFp === incomingFp) {
            duplicate = true;
            break;
          }

          const sameCoordinate =
            coordinateFingerprint(prior, cfg.coordinatePrecision) ===
            coordinateFingerprint(obs, cfg.coordinatePrecision);

          const timeDelta = Math.abs(Number(prior.observedAt) - Number(obs.observedAt));

          if (sameCoordinate && timeDelta < cfg.minTimeDeltaMs) {
            duplicate = true;
            break;
          }
        }

        if (duplicate) {
          duplicateObservationCount++;
          continue;
        }

        identity.observations.push(obs);
        identity.updatedAt = now();
        identity.registrySource = selected.sourceName;

        acceptedObservationCount++;
      }

      for (const identity of Object.values(accumulator.identities)) {
        recomputeIdentityStats(identity, cfg);
      }

      pruneAccumulator(accumulator, cfg);
      saveAccumulator(accumulator, cfg);

      const summary = summarizeAccumulator(accumulator);
      const downstream = await invokeDownstreamIfReady(summary, cfg);

      let status = "AUTHORITATIVE_TEMPORAL_OBSERVATIONS_ACCUMULATED_SINGLE_POINT_ONLY";

      if (summary.coordinateChangingIdentityCount > 0) {
        status = "AUTHORITATIVE_TEMPORAL_COORDINATE_CHANGE_RECOVERED";
      } else if (summary.multiPointIdentityCount > 0) {
        status = "AUTHORITATIVE_MULTI_POINT_TEMPORAL_HISTORY_ACCUMULATED_NO_COORDINATE_CHANGE_YET";
      }

      if (
        downstream.invoked &&
        downstream.success &&
        downstream.result &&
        downstream.result.functionalPass === true
      ) {
        status = "AUTHORITATIVE_TEMPORAL_SEQUENCE_READY_FOR_MOTION_RECONSTRUCTION";
      }

      const result = {
        success: true,
        phase: PHASE,
        version: VERSION,
        build: BUILD,
        status,

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
        duplicateObservationCount,
        rejectedNoIdentityCount,
        rejectedNoCoordinateCount,
        newIdentityCount,
        identitiesTouchedCount: identitiesTouched.size,

        identityCount: summary.identityCount,
        observationCount: summary.observationCount,
        multiPointIdentityCount: summary.multiPointIdentityCount,
        coordinateChangingIdentityCount: summary.coordinateChangingIdentityCount,
        maxObservedPointsPerIdentity: summary.maxObservedPointsPerIdentity,
        maxUniqueCoordinatesPerIdentity: summary.maxUniqueCoordinatesPerIdentity,

        temporalGatePassed:
          summary.multiPointIdentityCount > 0 &&
          summary.coordinateChangingIdentityCount > 0 &&
          summary.maxUniqueCoordinatesPerIdentity >= 2,

        persistedToLocalStorage: !!cfg.persistLocalStorage,
        storageKey: STORAGE_KEY,

        downstream,
        downstreamStatus:
          downstream && downstream.result
            ? downstream.result.status || null
            : null,
        downstreamFunctionalPass:
          !!(
            downstream &&
            downstream.result &&
            downstream.result.functionalPass === true
          ),

        prerequisiteResults,

        sample: Object.values(accumulator.identities)
          .filter(x => x && x.observationCount > 0)
          .sort((a, b) => (b.observationCount || 0) - (a.observationCount || 0))
          .slice(0, 20),

        generatedAt: now(),
        durationMs: now() - startedAt
      };

      global.RainGuardAuthoritativeIdentityTemporalObservationAccumulatorStateV39 = result;
      global.RainGuardCrossCycleAuthoritativeIdentityTemporalObservationAccumulationResultV39 = result;

      state.runs++;
      state.lastRun = result;
      state.lastError = null;

      if (cfg.logSummary) {
        console.log(`[RainGuard Phase ${PHASE}] Cross-Cycle Authoritative Identity Temporal Observation Accumulation result:`);
        console.log(result);

        if (typeof console.table === "function") {
          try {
            console.table(
              result.sample.slice(0, 15).map(x => ({
                identity: x.identity,
                observations: x.observationCount,
                uniqueCoordinates: x.uniqueCoordinateCount,
                coordinateChanging: x.coordinateChanging,
                firstObservedAt: x.firstObservedAt,
                lastObservedAt: x.lastObservedAt
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
        status: "AUTHORITATIVE_TEMPORAL_OBSERVATION_ACCUMULATION_FAILED",
        error: error && error.message ? error.message : safeString(error),
        generatedAt: now(),
        durationMs: now() - startedAt
      };

      state.lastRun = result;
      state.lastError = result.error;

      console.error(`[RainGuard Phase ${PHASE}] failed:`, error);
      return result;

    } finally {
      state.running = false;
    }
  }

  function diagnose() {
    const accumulator = loadAccumulator();
    const summary = summarizeAccumulator(accumulator);

    const result = {
      success: true,
      phase: PHASE,
      version: VERSION,
      build: BUILD,
      installed: true,
      running: state.running,
      runs: state.runs,
      lastError: state.lastError,
      lastPersistedAt: state.lastPersistedAt,
      ...summary,
      temporalGatePassed:
        summary.multiPointIdentityCount > 0 &&
        summary.coordinateChangingIdentityCount > 0 &&
        summary.maxUniqueCoordinatesPerIdentity >= 2,
      storageKey: STORAGE_KEY,
      lastRun: state.lastRun
    };

    console.log(`[RainGuard Phase ${PHASE}] Diagnostic:`, result);
    return result;
  }

  function reset() {
    try {
      if (global.localStorage) global.localStorage.removeItem(STORAGE_KEY);
    } catch (_) {}

    global.RainGuardAuthoritativeIdentityTemporalObservationAccumulatorV39 = emptyAccumulator();
    global.RainGuardAuthoritativeIdentityTemporalHistoriesV39 =
      global.RainGuardAuthoritativeIdentityTemporalObservationAccumulatorV39.identities;

    const result = {
      success: true,
      phase: PHASE,
      version: VERSION,
      build: BUILD,
      status: "AUTHORITATIVE_TEMPORAL_ACCUMULATOR_RESET",
      generatedAt: now()
    };

    console.log(`[RainGuard Phase ${PHASE}] accumulator reset.`);
    return result;
  }

  global.runRainGuardCrossCycleAuthoritativeIdentityTemporalObservationAccumulationBridge = run;
  global.diagnoseRainGuardCrossCycleAuthoritativeIdentityTemporalObservationAccumulationBridge = diagnose;
  global.resetRainGuardCrossCycleAuthoritativeIdentityTemporalObservationAccumulator = reset;

  global.RainGuardCrossCycleAuthoritativeIdentityTemporalObservationAccumulationBridgeV39 = {
    phase: PHASE,
    version: VERSION,
    build: BUILD,
    run,
    diagnose,
    reset,
    state
  };

})(window);
