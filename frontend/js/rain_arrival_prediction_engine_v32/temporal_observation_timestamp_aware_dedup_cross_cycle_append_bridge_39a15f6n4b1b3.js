/**
 * RainGuard AI V39
 * Phase 39A-15F6N4B1B3
 * Temporal Observation Timestamp-Aware De-duplication & Cross-Cycle Append Bridge
 * Version: 39A.15F6N4B1B3.0
 *
 * Goal
 * ----
 * Fix the single-point lock observed in N4B1B2 by making duplicate detection
 * timestamp/cycle aware.
 *
 * Critical rule:
 *   same identity + same coordinate + DIFFERENT observation time/cycle
 *   => append as a NEW temporal observation
 *
 *   same identity + same coordinate + SAME observation time/cycle
 *   => true duplicate
 *
 * Public API
 * ----------
 * window.runRainGuardTemporalObservationTimestampAwareDedupCrossCycleAppendBridge(options?)
 * window.diagnoseRainGuardTemporalObservationTimestampAwareDedupCrossCycleAppendBridge()
 * window.resetRainGuardTemporalObservationTimestampAwareDedupCrossCycleAppendBridgeState()
 *
 * Canonical published objects
 * ---------------------------
 * window.RainGuardTimestampAwareAuthoritativeTemporalHistoriesV39
 * window.RainGuardTimestampAwareTemporalObservationAccumulatorV39
 * window.RainGuardTimestampAwareTemporalObservationAppendStateV39
 */

(function installRainGuardTemporalObservationTimestampAwareDedupCrossCycleAppendBridge(global) {
  "use strict";

  const PHASE = "39A-15F6N4B1B3";
  const VERSION = "39A.15F6N4B1B3.0";
  const BUILD = "rainguard-v39-temporal-observation-timestamp-aware-dedup-cross-cycle-append-bridge";
  const INSTALL_FLAG = "__RainGuardTemporalObservationTimestampAwareDedupCrossCycleAppendBridgeInstalled";
  const STORAGE_KEY = "RainGuard:39A15F6N4B1B3:timestampAwareTemporalAccumulator:v1";

  if (global[INSTALL_FLAG]) return;
  global[INSTALL_FLAG] = true;

  const DEFAULTS = Object.freeze({
    coordinatePrecision: 5,
    maxIdentities: 5000,
    maxObservationsPerIdentity: 48,
    maxGlobalObservations: 75000,

    // Same coordinate is allowed across cycles if time differs by at least this amount.
    minTimestampDeltaMsForAppend: 1000,

    // A duplicate must be extremely close in time AND same coordinate.
    duplicateTimestampToleranceMs: 500,

    // Used only for coordinate-change determination, not duplicate rejection.
    minCoordinateDeltaDegrees: 0.00001,

    // If upstream records do not provide changing observedAt values, synthesize a cycle timestamp.
    synthesizeCycleTimestamp: true,

    // Force each execution to have a unique cycle id.
    cycleIdPrefix: "rg39a15f6n4b1b3",

    persistLocalStorage: true,
    invokePrerequisites: true,
    invokeDownstreamN4B1B2: false,
    logSummary: true,
    maxCandidateScanKeys: 8000
  });

  const state = {
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
      if (n !== null) {
        latitude = n;
        break;
      }
    }

    for (const v of lonCandidates) {
      const n = finiteNumber(v);
      if (n !== null) {
        longitude = n;
        break;
      }
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

    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function extractBestTimestamp(record, cycleTimestamp, cfg) {
    if (!isObject(record)) return cycleTimestamp;

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
      const ts = parseTimestamp(v);
      if (ts !== null) return ts;
    }

    return cfg.synthesizeCycleTimestamp ? cycleTimestamp : now();
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

  function extractConfidence(record) {
    const candidates = [
      record.confidence,
      record.score,
      record.trust,
      record.quality,
      record.probability
    ];

    for (const v of candidates) {
      const n = finiteNumber(v);
      if (n !== null) return n;
    }
    return null;
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

    if (/authoritative/.test(lname)) score += 45;
    if (/persistent/.test(lname)) score += 25;
    if (/identity|identit/.test(lname)) score += 25;
    if (/registry/.test(lname)) score += 20;
    if (/runtime/.test(lname)) score += 10;
    if (/motionrecord|motion_record|motionrecords/.test(lname)) score += 12;
    if (/published|integrated/.test(lname)) score += 8;
    if (/sample|diagnostic|result|config/.test(lname)) score -= 20;

    const sample = records.slice(0, 100);
    let idCount = 0;
    let coordCount = 0;

    for (const record of sample) {
      if (extractIdentityKey(record)) idCount++;
      if (extractCoordinate(record)) coordCount++;
    }

    score += Math.round((idCount / Math.max(sample.length, 1)) * 25);
    score += Math.round((coordCount / Math.max(sample.length, 1)) * 20);

    if (records.length >= 500) score += 20;
    else if (records.length >= 100) score += 15;
    else if (records.length >= 20) score += 8;

    return { score, idCount, coordCount };
  }

  function discoverSource(cfg) {
    const preferredNames = [
      "RainGuardRuntimeAuthoritativePersistentIdentityRegistryV39",
      "RainGuardAuthoritativePersistentStormIdentitiesV39",
      "RainGuardPublishedAuthoritativePersistentStormIdentitiesV39",
      "RainGuardAuthoritativeIdentityPersistentRegistryV39",
      "RainGuardAuthoritativeIdentityTemporalObservationAccumulatorV39",
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

      const scored = scoreSource(name, records);

      candidates.push({
        sourceName: name,
        value,
        records,
        score: scored.score,
        sampleIdentityCount: scored.idCount,
        sampleCoordinateCount: scored.coordCount
      });
    }

    for (const name of preferredNames) {
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
      phase: PHASE,
      version: VERSION,
      createdAt: now(),
      updatedAt: now(),
      identities: {}
    };
  }

  function loadAccumulator() {
    if (isObject(global.RainGuardTimestampAwareTemporalObservationAccumulatorV39)) {
      const existing = global.RainGuardTimestampAwareTemporalObservationAccumulatorV39;
      if (isObject(existing.identities)) return existing;
    }

    // Import from N4B1B2 if available.
    if (isObject(global.RainGuardAuthoritativeIdentityTemporalObservationAccumulatorV39)) {
      const upstream = global.RainGuardAuthoritativeIdentityTemporalObservationAccumulatorV39;
      if (isObject(upstream.identities)) {
        try {
          return JSON.parse(JSON.stringify(upstream));
        } catch (_) {}
      }
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

    global.RainGuardTimestampAwareTemporalObservationAccumulatorV39 = accumulator;
    global.RainGuardTimestampAwareAuthoritativeTemporalHistoriesV39 = accumulator.identities;

    if (cfg.persistLocalStorage) {
      try {
        global.localStorage.setItem(STORAGE_KEY, JSON.stringify(accumulator));
      } catch (_) {}
    }
  }

  function coordinateKey(obs, precision) {
    return [
      Number(obs.latitude).toFixed(precision),
      Number(obs.longitude).toFixed(precision)
    ].join("|");
  }

  function exactTemporalFingerprint(obs, precision) {
    return [
      obs.identity,
      coordinateKey(obs, precision),
      Number(obs.observedAt)
    ].join("|");
  }

  function sameCoordinate(a, b, precision) {
    return coordinateKey(a, precision) === coordinateKey(b, precision);
  }

  function isTrueDuplicate(existingObs, incomingObs, cfg) {
    if (!existingObs || !incomingObs) return false;

    if (!sameCoordinate(existingObs, incomingObs, cfg.coordinatePrecision)) {
      return false;
    }

    const dt = Math.abs(
      Number(existingObs.observedAt || 0) -
      Number(incomingObs.observedAt || 0)
    );

    return dt <= cfg.duplicateTimestampToleranceMs;
  }

  function hasCoordinateChanged(observations, cfg) {
    if (!Array.isArray(observations) || observations.length < 2) return false;

    for (let i = 1; i < observations.length; i++) {
      const a = observations[i - 1];
      const b = observations[i];

      const dLat = Math.abs(Number(a.latitude) - Number(b.latitude));
      const dLon = Math.abs(Number(a.longitude) - Number(b.longitude));

      if (
        dLat >= cfg.minCoordinateDeltaDegrees ||
        dLon >= cfg.minCoordinateDeltaDegrees
      ) return true;
    }

    return false;
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

    if (!Array.isArray(identity.observations)) {
      identity.observations = [];
    }

    return identity;
  }

  function buildObservation(record, identityKey, sourceName, cycleId, cycleTimestamp, cfg) {
    const coord = extractCoordinate(record);
    if (!coord) return null;

    const observedAt = extractBestTimestamp(record, cycleTimestamp, cfg);

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
      cycleId,
      cycleObservedAt: cycleTimestamp,
      confidence: extractConfidence(record),
      source: extractSource(record),
      registrySource: sourceName,
      appendedAt: now(),
      phase: PHASE
    };
  }

  function recomputeIdentity(identity, cfg) {
    const observations = Array.isArray(identity.observations)
      ? identity.observations.slice()
      : [];

    observations.sort((a, b) => Number(a.observedAt) - Number(b.observedAt));

    // Exact de-dup pass.
    const deduped = [];
    const seen = new Set();

    for (const obs of observations) {
      const fp = exactTemporalFingerprint(obs, cfg.coordinatePrecision);
      if (seen.has(fp)) continue;
      seen.add(fp);
      deduped.push(obs);
    }

    identity.observations = deduped;

    const uniqueCoordinateMap = new Map();
    for (const obs of deduped) {
      const key = coordinateKey(obs, cfg.coordinatePrecision);
      if (!uniqueCoordinateMap.has(key)) {
        uniqueCoordinateMap.set(key, {
          latitude: obs.latitude,
          longitude: obs.longitude,
          firstObservedAt: obs.observedAt,
          lastObservedAt: obs.observedAt
        });
      } else {
        uniqueCoordinateMap.get(key).lastObservedAt = obs.observedAt;
      }
    }

    const cycles = new Set(
      deduped.map(x => x.cycleId).filter(Boolean)
    );

    identity.observationCount = deduped.length;
    identity.uniqueCoordinateCount = uniqueCoordinateMap.size;
    identity.cycleCount = cycles.size;
    identity.multiPoint = deduped.length >= 2;
    identity.crossCycle = cycles.size >= 2;
    identity.coordinateChanging = hasCoordinateChanged(deduped, cfg);
    identity.firstObservedAt = deduped.length ? deduped[0].observedAt : null;
    identity.lastObservedAt = deduped.length ? deduped[deduped.length - 1].observedAt : null;
    identity.uniqueCoordinates = Array.from(uniqueCoordinateMap.values());
    identity.updatedAt = now();
  }

  function prune(accumulator, cfg) {
    let entries = Object.entries(accumulator.identities || {});

    if (entries.length > cfg.maxIdentities) {
      entries.sort((a, b) =>
        Number(b[1].lastObservedAt || 0) - Number(a[1].lastObservedAt || 0)
      );
      accumulator.identities = Object.fromEntries(entries.slice(0, cfg.maxIdentities));
    }

    for (const identity of Object.values(accumulator.identities)) {
      if (!identity || !Array.isArray(identity.observations)) continue;

      identity.observations.sort((a, b) => Number(a.observedAt) - Number(b.observedAt));

      if (identity.observations.length > cfg.maxObservationsPerIdentity) {
        identity.observations =
          identity.observations.slice(-cfg.maxObservationsPerIdentity);
      }
    }

    let all = [];
    for (const [identityKey, identity] of Object.entries(accumulator.identities)) {
      for (const obs of identity.observations || []) {
        all.push({ identityKey, obs });
      }
    }

    if (all.length > cfg.maxGlobalObservations) {
      all.sort((a, b) =>
        Number(b.obs.observedAt || 0) - Number(a.obs.observedAt || 0)
      );

      const allowed = new Set(
        all.slice(0, cfg.maxGlobalObservations).map(item =>
          `${item.identityKey}|${exactTemporalFingerprint(item.obs, cfg.coordinatePrecision)}`
        )
      );

      for (const [identityKey, identity] of Object.entries(accumulator.identities)) {
        identity.observations = (identity.observations || []).filter(obs =>
          allowed.has(
            `${identityKey}|${exactTemporalFingerprint(obs, cfg.coordinatePrecision)}`
          )
        );
      }
    }
  }

  async function invokePrerequisites() {
    const chain = [
      "runRainGuardAuthoritativeRegistryRuntimeBindingDeferredExecutionBridge",
      "runRainGuardRuntimeAuthoritativeRegistrySourceDiscoveryBindingBridge",
      "runRainGuardAuthoritativeLiveTrackHistoryForcedRehydrationBridge"
    ];

    const results = [];

    for (const name of chain) {
      const fn = global[name];
      if (typeof fn !== "function") continue;

      try {
        const result = await fn({
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

  async function maybeInvokeDownstream(summary, cfg) {
    if (!cfg.invokeDownstreamN4B1B2) {
      return { invoked: false, reason: "DOWNSTREAM_DISABLED" };
    }

    if (summary.multiPointIdentityCount <= 0) {
      return { invoked: false, reason: "NO_MULTI_POINT_IDENTITIES_YET" };
    }

    const fn = global.runRainGuardCrossCycleAuthoritativeIdentityTemporalObservationAccumulationBridge;

    if (typeof fn !== "function") {
      return { invoked: false, reason: "N4B1B2_NOT_AVAILABLE" };
    }

    try {
      const result = await fn({
        invokePrerequisites: false,
        invokeDownstreamN4B1B: false
      });

      return {
        invoked: true,
        success: !(result && result.success === false),
        result
      };
    } catch (error) {
      return {
        invoked: true,
        success: false,
        error: error && error.message ? error.message : safeString(error)
      };
    }
  }

  async function run(options) {
    const startedAt = now();

    if (state.running) {
      return {
        success: false,
        phase: PHASE,
        version: VERSION,
        build: BUILD,
        status: "TIMESTAMP_AWARE_APPEND_ALREADY_RUNNING"
      };
    }

    state.running = true;

    try {
      const cfg = Object.assign({}, DEFAULTS, isObject(options) ? options : {});
      const cycleTimestamp = now();
      const cycleId =
        `${cfg.cycleIdPrefix}-${cycleTimestamp}-${Math.random().toString(36).slice(2, 8)}`;

      state.lastCycleId = cycleId;

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

        state.lastRun = result;
        return result;
      }

      const accumulator = loadAccumulator();

      let acceptedObservationCount = 0;
      let trueDuplicateObservationCount = 0;
      let sameCoordinateNewTimeAppendCount = 0;
      let changedCoordinateAppendCount = 0;
      let rejectedNoIdentityCount = 0;
      let rejectedNoCoordinateCount = 0;
      let touchedIdentityCount = 0;
      let newIdentityCount = 0;

      const touched = new Set();

      for (const record of selected.records) {
        const identityKey = extractIdentityKey(record);

        if (!identityKey) {
          rejectedNoIdentityCount++;
          continue;
        }

        const existed = !!accumulator.identities[identityKey];
        const identity = ensureIdentity(
          accumulator,
          identityKey,
          selected.sourceName
        );

        if (!existed) newIdentityCount++;

        const incoming = buildObservation(
          record,
          identityKey,
          selected.sourceName,
          cycleId,
          cycleTimestamp,
          cfg
        );

        if (!incoming) {
          rejectedNoCoordinateCount++;
          continue;
        }

        touched.add(identityKey);

        const prior = identity.observations || [];
        let duplicate = false;

        for (const obs of prior) {
          if (isTrueDuplicate(obs, incoming, cfg)) {
            duplicate = true;
            break;
          }
        }

        if (duplicate) {
          trueDuplicateObservationCount++;
          continue;
        }

        const last = prior.length ? prior[prior.length - 1] : null;

        if (last) {
          if (sameCoordinate(last, incoming, cfg.coordinatePrecision)) {
            const dt = Math.abs(
              Number(incoming.observedAt) - Number(last.observedAt)
            );

            // If upstream time is stale, guarantee a cycle-distinct timestamp.
            if (dt < cfg.minTimestampDeltaMsForAppend && cfg.synthesizeCycleTimestamp) {
              incoming.observedAt = cycleTimestamp;
              incoming.timestamp = cycleTimestamp;
              incoming.timestampSynthesizedForCycleAppend = true;
            }

            sameCoordinateNewTimeAppendCount++;
          } else {
            changedCoordinateAppendCount++;
          }
        }

        identity.observations.push(incoming);
        identity.updatedAt = now();

        acceptedObservationCount++;
      }

      touchedIdentityCount = touched.size;

      for (const identity of Object.values(accumulator.identities)) {
        recomputeIdentity(identity, cfg);
      }

      prune(accumulator, cfg);

      // Recompute after prune.
      for (const identity of Object.values(accumulator.identities)) {
        recomputeIdentity(identity, cfg);
      }

      saveAccumulator(accumulator, cfg);

      const summary = summarize(accumulator);
      const downstream = await maybeInvokeDownstream(summary, cfg);

      const multiPointGatePassed = summary.multiPointIdentityCount > 0;
      const crossCycleGatePassed = summary.crossCycleIdentityCount > 0;
      const coordinateChangeGatePassed =
        summary.coordinateChangingIdentityCount > 0 &&
        summary.maxUniqueCoordinatesPerIdentity >= 2;

      let status = "TIMESTAMP_AWARE_APPEND_READY_BUT_SINGLE_POINT_ONLY";

      if (multiPointGatePassed && !coordinateChangeGatePassed) {
        status = "MULTI_POINT_TEMPORAL_HISTORY_RECOVERED_AWAITING_COORDINATE_CHANGE";
      }

      if (crossCycleGatePassed && !coordinateChangeGatePassed) {
        status = "CROSS_CYCLE_TEMPORAL_APPEND_CONFIRMED_AWAITING_COORDINATE_CHANGE";
      }

      if (coordinateChangeGatePassed) {
        status = "TEMPORAL_COORDINATE_SEQUENCE_RECOVERED";
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
        trueDuplicateObservationCount,
        sameCoordinateNewTimeAppendCount,
        changedCoordinateAppendCount,
        rejectedNoIdentityCount,
        rejectedNoCoordinateCount,
        newIdentityCount,
        identitiesTouchedCount: touchedIdentityCount,

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
        coordinateChangeGatePassed,
        temporalGatePassed:
          multiPointGatePassed &&
          crossCycleGatePassed &&
          coordinateChangeGatePassed,

        persistedToLocalStorage: !!cfg.persistLocalStorage,
        storageKey: STORAGE_KEY,

        downstream,
        prerequisiteResults,

        sample: Object.values(accumulator.identities)
          .filter(x => x && x.observationCount > 0)
          .sort((a, b) =>
            Number(b.observationCount || 0) - Number(a.observationCount || 0)
          )
          .slice(0, 20),

        generatedAt: now(),
        durationMs: now() - startedAt
      };

      global.RainGuardTimestampAwareTemporalObservationAppendStateV39 = result;
      global.RainGuardTemporalObservationTimestampAwareDedupCrossCycleAppendResultV39 = result;

      state.runs++;
      state.lastRun = result;
      state.lastError = null;

      if (cfg.logSummary) {
        console.log(
          `[RainGuard Phase ${PHASE}] Temporal Observation Timestamp-Aware De-duplication & Cross-Cycle Append result:`
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
        status: "TIMESTAMP_AWARE_CROSS_CYCLE_APPEND_FAILED",
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
    const summary = summarize(accumulator);

    const result = {
      success: true,
      phase: PHASE,
      version: VERSION,
      build: BUILD,
      installed: true,
      running: state.running,
      runs: state.runs,
      lastCycleId: state.lastCycleId,
      lastError: state.lastError,

      ...summary,

      multiPointGatePassed: summary.multiPointIdentityCount > 0,
      crossCycleGatePassed: summary.crossCycleIdentityCount > 0,
      coordinateChangeGatePassed:
        summary.coordinateChangingIdentityCount > 0 &&
        summary.maxUniqueCoordinatesPerIdentity >= 2,

      temporalGatePassed:
        summary.multiPointIdentityCount > 0 &&
        summary.crossCycleIdentityCount > 0 &&
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

    global.RainGuardTimestampAwareTemporalObservationAccumulatorV39 = emptyAccumulator();
    global.RainGuardTimestampAwareAuthoritativeTemporalHistoriesV39 =
      global.RainGuardTimestampAwareTemporalObservationAccumulatorV39.identities;

    const result = {
      success: true,
      phase: PHASE,
      version: VERSION,
      build: BUILD,
      status: "TIMESTAMP_AWARE_TEMPORAL_ACCUMULATOR_RESET",
      generatedAt: now()
    };

    console.log(`[RainGuard Phase ${PHASE}] reset.`);
    return result;
  }

  global.runRainGuardTemporalObservationTimestampAwareDedupCrossCycleAppendBridge = run;
  global.diagnoseRainGuardTemporalObservationTimestampAwareDedupCrossCycleAppendBridge = diagnose;
  global.resetRainGuardTemporalObservationTimestampAwareDedupCrossCycleAppendBridgeState = reset;

  global.RainGuardTemporalObservationTimestampAwareDedupCrossCycleAppendBridgeV39 = {
    phase: PHASE,
    version: VERSION,
    build: BUILD,
    run,
    diagnose,
    reset,
    state
  };

})(window);
