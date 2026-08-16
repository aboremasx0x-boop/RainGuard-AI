/**
 * RainGuard AI V39
 * Phase 39A-15F6N4B1A — Runtime Authoritative Registry Source Discovery & Binding Bridge
 * Version: 39A.15F6N4B1A.0
 *
 * Purpose
 * -------
 * Discover the real runtime object/array that currently holds the authoritative /
 * integrated persistent identity registry, score candidate sources, bind the best
 * one to a stable canonical runtime name, and publish diagnostics for N4B1.
 *
 * Public API
 * ----------
 * window.runRainGuardRuntimeAuthoritativeRegistrySourceDiscoveryBindingBridge(options?)
 * window.diagnoseRainGuardRuntimeAuthoritativeRegistrySourceDiscoveryBindingBridge()
 *
 * Canonical bindings published on success
 * ----------------------------------------
 * window.RainGuardAuthoritativePersistentStormIdentitiesV39
 * window.RainGuardPublishedAuthoritativePersistentStormIdentitiesV39
 * window.RainGuardIntegratedPersistentStormIdentitiesV39
 * window.RainGuardIntegratedIdentityPersistentRegistryV39
 * window.RainGuardIntegratedPersistentIdentityRegistryV39
 */

(function installRainGuardRuntimeAuthoritativeRegistrySourceDiscoveryBindingBridge(global) {
  "use strict";

  const PHASE = "39A-15F6N4B1A";
  const VERSION = "39A.15F6N4B1A.0";
  const BUILD = "rainguard-v39-runtime-authoritative-registry-source-discovery-binding-bridge";

  const INSTALL_FLAG =
    "__RainGuardRuntimeAuthoritativeRegistrySourceDiscoveryBindingBridgeInstalled";

  if (global[INSTALL_FLAG]) return;
  global[INSTALL_FLAG] = true;

  const DEFAULTS = Object.freeze({
    maxWindowKeys: 9000,
    maxCandidateCount: 500,
    maxSamplePerCandidate: 40,
    minLikelyIdentityCount: 2,
    minAcceptScore: 18,
    preferLargeRegistry: true,
    bindLegacyCompatibilityName: false,
    publishCandidateTable: true
  });

  const state = {
    installed: true,
    running: false,
    lastRun: null,
    lastError: null,
    lastCandidates: []
  };

  const now = () => Date.now();

  function isObject(v) {
    return !!v && typeof v === "object";
  }

  function isPlainObject(v) {
    return Object.prototype.toString.call(v) === "[object Object]";
  }

  function safeString(v) {
    try {
      return v == null ? "" : String(v);
    } catch (_) {
      return "";
    }
  }

  function normalizeName(v) {
    return safeString(v).toLowerCase().replace(/[^a-z0-9]+/g, "");
  }

  function safeGet(obj, key) {
    try {
      return obj[key];
    } catch (_) {
      return undefined;
    }
  }

  function safeKeys(obj) {
    try {
      return Object.keys(obj || {});
    } catch (_) {
      return [];
    }
  }

  function safeValues(obj) {
    try {
      return Object.values(obj || {});
    } catch (_) {
      return [];
    }
  }

  function finiteNumber(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function looksLikeCoordinate(record) {
    if (!isObject(record)) return false;

    const lat =
      finiteNumber(record.latitude) ??
      finiteNumber(record.lat) ??
      finiteNumber(record.coordinate && (record.coordinate.latitude ?? record.coordinate.lat)) ??
      finiteNumber(record.coordinates && (record.coordinates.latitude ?? record.coordinates.lat));

    const lon =
      finiteNumber(record.longitude) ??
      finiteNumber(record.lon) ??
      finiteNumber(record.lng) ??
      finiteNumber(record.coordinate && (record.coordinate.longitude ?? record.coordinate.lon ?? record.coordinate.lng)) ??
      finiteNumber(record.coordinates && (record.coordinates.longitude ?? record.coordinates.lon ?? record.coordinates.lng));

    return (
      lat != null &&
      lon != null &&
      lat >= -90 &&
      lat <= 90 &&
      lon >= -180 &&
      lon <= 180 &&
      !(lat === 0 && lon === 0)
    );
  }

  function identityKey(record) {
    if (!isObject(record)) return "";

    const keys = [
      "persistentId",
      "canonicalPersistentId",
      "authoritativeIdentity",
      "canonicalIdentity",
      "canonicalTrackId",
      "canonicalId",
      "identityKey",
      "recoveredIdentityKey",
      "identity",
      "trackId",
      "cellId",
      "stormId",
      "entityId",
      "id"
    ];

    for (const key of keys) {
      const value = safeGet(record, key);
      const s = safeString(value).trim();
      if (s) return s;
    }

    return "";
  }

  function aliasCount(record) {
    if (!isObject(record)) return 0;

    let total = 0;

    for (const key of [
      "aliases",
      "identityAliases",
      "trackAliases",
      "historicalAliases",
      "sourceAliases",
      "candidateAliases"
    ]) {
      const value = safeGet(record, key);
      if (Array.isArray(value)) total += value.length;
      else if (value instanceof Set || value instanceof Map) total += value.size;
    }

    return total;
  }

  function observationCount(record) {
    if (!isObject(record)) return 0;

    const direct = [
      safeGet(record, "observations"),
      safeGet(record, "history"),
      safeGet(record, "points"),
      safeGet(record, "samples"),
      safeGet(record, "records")
    ];

    let max = 0;

    for (const value of direct) {
      if (Array.isArray(value)) max = Math.max(max, value.length);
      else if (value instanceof Map || value instanceof Set) max = Math.max(max, value.size);
    }

    const declared = finiteNumber(safeGet(record, "observationCount"));
    if (declared != null) max = Math.max(max, declared);

    return max;
  }

  function unwrapArray(value) {
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

    const preferredKeys = [
      "authoritativeIdentities",
      "integratedIdentities",
      "persistentIdentities",
      "identities",
      "registry",
      "records",
      "items",
      "data",
      "entities",
      "tracks",
      "values"
    ];

    for (const key of preferredKeys) {
      const nested = safeGet(value, key);

      if (Array.isArray(nested)) return nested;

      if (nested instanceof Map || nested instanceof Set) {
        try {
          return Array.from(nested.values());
        } catch (_) {}
      }

      if (
        isObject(nested) &&
        !Array.isArray(nested) &&
        !(nested instanceof Map) &&
        !(nested instanceof Set)
      ) {
        const vals = safeValues(nested).filter(isObject);
        if (vals.length > 1) return vals;
      }
    }

    const vals = safeValues(value).filter(isObject);

    if (vals.length > 1) {
      const identityLike = vals.filter(v => !!identityKey(v));
      if (identityLike.length >= Math.max(2, Math.floor(vals.length * 0.25))) {
        return vals;
      }
    }

    return [];
  }

  function keywordScore(name) {
    const n = normalizeName(name);
    let score = 0;

    const positive = [
      ["authoritative", 12],
      ["persistent", 8],
      ["identity", 8],
      ["identities", 8],
      ["registry", 8],
      ["integrated", 7],
      ["published", 5],
      ["recovered", 3],
      ["storm", 3],
      ["v39", 2]
    ];

    for (const [token, pts] of positive) {
      if (n.includes(token)) score += pts;
    }

    const negative = [
      ["history", -10],
      ["livetrack", -9],
      ["motionrecord", -8],
      ["vector", -5],
      ["observationmemory", -6],
      ["candidate", -4],
      ["temporary", -4],
      ["diagnostic", -3],
      ["result", -2]
    ];

    for (const [token, pts] of negative) {
      if (n.includes(token)) score += pts;
    }

    return score;
  }

  function analyzeCandidate(name, value, cfg) {
    const identities = unwrapArray(value);

    if (!identities.length) return null;

    const sample = identities.slice(0, cfg.maxSamplePerCandidate);

    let identityLike = 0;
    let aliasRich = 0;
    let observationRich = 0;
    let coordinateRich = 0;

    for (const record of sample) {
      if (!isObject(record)) continue;
      if (identityKey(record)) identityLike++;
      if (aliasCount(record) > 0) aliasRich++;
      if (observationCount(record) > 0) observationRich++;
      if (looksLikeCoordinate(record)) coordinateRich++;
    }

    const sampleCount = Math.max(sample.length, 1);

    const identityRatio = identityLike / sampleCount;
    const aliasRatio = aliasRich / sampleCount;
    const observationRatio = observationRich / sampleCount;
    const coordinateRatio = coordinateRich / sampleCount;

    let score = keywordScore(name);

    score += identityRatio * 28;
    score += aliasRatio * 8;
    score += observationRatio * 8;
    score += coordinateRatio * 5;

    if (identities.length >= 500) score += 18;
    else if (identities.length >= 100) score += 12;
    else if (identities.length >= 20) score += 6;
    else if (identities.length >= 2) score += 2;

    // Strong boost for runtime sizes seen in authoritative integration phases.
    if (identities.length >= 500 && identities.length <= 5000) score += 5;

    return {
      sourceName: name,
      rawType:
        Array.isArray(value) ? "array" :
        value instanceof Map ? "map" :
        value instanceof Set ? "set" :
        typeof value,
      rawCount:
        Array.isArray(value) ? value.length :
        value instanceof Map || value instanceof Set ? value.size :
        safeKeys(value).length,
      identityCount: identities.length,
      sampleCount,
      identityLikeSampleCount: identityLike,
      aliasRichSampleCount: aliasRich,
      observationRichSampleCount: observationRich,
      coordinateRichSampleCount: coordinateRich,
      identityRatio,
      aliasRatio,
      observationRatio,
      coordinateRatio,
      score,
      value,
      identities
    };
  }

  function discoverCandidates(cfg) {
    const preferredNames = [
      "RainGuardAuthoritativePersistentStormIdentitiesV39",
      "RainGuardPublishedAuthoritativePersistentStormIdentitiesV39",
      "RainGuardIntegratedPersistentStormIdentitiesV39",
      "RainGuardIntegratedIdentityPersistentRegistryV39",
      "RainGuardIntegratedPersistentIdentityRegistryV39",
      "RainGuardAuthoritativePersistentIdentityRegistryV39",
      "RainGuardRecoveredIntegratedIdentitiesV39",
      "RainGuardRecoveredIdentityIntegrationV39"
    ];

    const seen = new Set();
    const candidates = [];

    function inspect(name) {
      if (!name || seen.has(name) || candidates.length >= cfg.maxCandidateCount) return;
      seen.add(name);

      let value;
      try {
        value = global[name];
      } catch (_) {
        return;
      }

      const candidate = analyzeCandidate(name, value, cfg);
      if (!candidate) return;

      if (
        candidate.identityCount >= cfg.minLikelyIdentityCount ||
        keywordScore(name) >= 10
      ) {
        candidates.push(candidate);
      }
    }

    for (const name of preferredNames) inspect(name);

    let keys = [];
    try {
      keys = Object.getOwnPropertyNames(global).slice(0, cfg.maxWindowKeys);
    } catch (_) {
      keys = safeKeys(global).slice(0, cfg.maxWindowKeys);
    }

    const likelyNames = keys.filter(name => {
      const n = normalizeName(name);

      return (
        n.includes("authoritative") ||
        n.includes("persistentidentity") ||
        n.includes("persistentstorm") ||
        n.includes("integratedidentity") ||
        n.includes("identityregistry") ||
        (n.includes("persistent") && n.includes("identit")) ||
        (n.includes("integrated") && n.includes("storm"))
      );
    });

    for (const name of likelyNames) inspect(name);

    candidates.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (cfg.preferLargeRegistry && b.identityCount !== a.identityCount) {
        return b.identityCount - a.identityCount;
      }
      return a.sourceName.localeCompare(b.sourceName);
    });

    return candidates;
  }

  function cloneIdentityArray(identities) {
    // Keep object identity when possible. Only clone the array shell.
    try {
      return Array.from(identities || []);
    } catch (_) {
      return [];
    }
  }

  function publishCanonicalBindings(best) {
    const identities = cloneIdentityArray(best.identities);

    const canonicalNames = [
      "RainGuardAuthoritativePersistentStormIdentitiesV39",
      "RainGuardPublishedAuthoritativePersistentStormIdentitiesV39",
      "RainGuardIntegratedPersistentStormIdentitiesV39",
      "RainGuardIntegratedIdentityPersistentRegistryV39",
      "RainGuardIntegratedPersistentIdentityRegistryV39"
    ];

    for (const name of canonicalNames) {
      try {
        global[name] = identities;
      } catch (_) {}
    }

    global.RainGuardRuntimeAuthoritativeRegistryBindingV39 = {
      phase: PHASE,
      version: VERSION,
      generatedAt: now(),
      selectedSourceName: best.sourceName,
      selectedIdentityCount: identities.length,
      selectedSourceScore: best.score,
      identities
    };

    return { identities, canonicalNames };
  }

  async function run(options) {
    const started = now();

    if (state.running) {
      return {
        success: false,
        phase: PHASE,
        version: VERSION,
        build: BUILD,
        status: "RUNTIME_AUTHORITATIVE_SOURCE_DISCOVERY_ALREADY_RUNNING"
      };
    }

    state.running = true;

    try {
      const cfg = Object.assign({}, DEFAULTS, isObject(options) ? options : {});
      const candidates = discoverCandidates(cfg);

      state.lastCandidates = candidates.map(c => ({
        sourceName: c.sourceName,
        rawType: c.rawType,
        rawCount: c.rawCount,
        identityCount: c.identityCount,
        sampleCount: c.sampleCount,
        identityLikeSampleCount: c.identityLikeSampleCount,
        aliasRichSampleCount: c.aliasRichSampleCount,
        observationRichSampleCount: c.observationRichSampleCount,
        coordinateRichSampleCount: c.coordinateRichSampleCount,
        identityRatio: c.identityRatio,
        aliasRatio: c.aliasRatio,
        observationRatio: c.observationRatio,
        coordinateRatio: c.coordinateRatio,
        score: Number(c.score.toFixed(2))
      }));

      if (!candidates.length) {
        const result = {
          success: false,
          phase: PHASE,
          version: VERSION,
          build: BUILD,
          status: "NO_RUNTIME_AUTHORITATIVE_REGISTRY_CANDIDATES_FOUND",
          candidateCount: 0,
          generatedAt: now(),
          durationMs: now() - started
        };

        state.lastRun = result;
        state.lastError = null;
        return result;
      }

      const best = candidates[0];

      if (best.score < cfg.minAcceptScore) {
        const result = {
          success: false,
          phase: PHASE,
          version: VERSION,
          build: BUILD,
          status: "RUNTIME_REGISTRY_CANDIDATES_FOUND_BUT_NONE_AUTHORITATIVE_ENOUGH",
          candidateCount: candidates.length,
          bestCandidate: state.lastCandidates[0],
          candidateSample: state.lastCandidates.slice(0, 20),
          generatedAt: now(),
          durationMs: now() - started
        };

        state.lastRun = result;
        state.lastError = null;
        return result;
      }

      const published = publishCanonicalBindings(best);

      if (cfg.bindLegacyCompatibilityName) {
        try {
          global.RainGuardPersistentStormIdentitiesV39 = published.identities;
        } catch (_) {}
      }

      const result = {
        success: true,
        phase: PHASE,
        version: VERSION,
        build: BUILD,
        status: "RUNTIME_AUTHORITATIVE_REGISTRY_DISCOVERED_AND_BOUND",

        candidateCount: candidates.length,

        selectedSourceName: best.sourceName,
        selectedSourceType: best.rawType,
        selectedRawCount: best.rawCount,
        selectedIdentityCount: best.identityCount,
        selectedSourceScore: Number(best.score.toFixed(2)),

        selectedIdentityLikeSampleCount: best.identityLikeSampleCount,
        selectedAliasRichSampleCount: best.aliasRichSampleCount,
        selectedObservationRichSampleCount: best.observationRichSampleCount,
        selectedCoordinateRichSampleCount: best.coordinateRichSampleCount,

        canonicalBindings: published.canonicalNames,
        legacyCompatibilityBound: !!cfg.bindLegacyCompatibilityName,

        identitySample: published.identities.slice(0, 20),

        candidateSample: state.lastCandidates.slice(0, 30),

        generatedAt: now(),
        durationMs: now() - started
      };

      global.RainGuardRuntimeAuthoritativeRegistrySourceDiscoveryBindingV39 = result;

      state.lastRun = result;
      state.lastError = null;

      console.log(
        `[RainGuard Phase ${PHASE}] Runtime Authoritative Registry Source Discovery & Binding result:`
      );
      console.log(result);

      if (cfg.publishCandidateTable && typeof console.table === "function") {
        try {
          console.table(
            state.lastCandidates.slice(0, 30).map(c => ({
              source: c.sourceName,
              identities: c.identityCount,
              raw: c.rawCount,
              aliases: c.aliasRichSampleCount,
              observations: c.observationRichSampleCount,
              coordinates: c.coordinateRichSampleCount,
              score: c.score
            }))
          );
        } catch (_) {}
      }

      return result;

    } catch (error) {
      const result = {
        success: false,
        phase: PHASE,
        version: VERSION,
        build: BUILD,
        status: "RUNTIME_AUTHORITATIVE_REGISTRY_SOURCE_DISCOVERY_FAILED",
        error: error && error.message ? error.message : safeString(error),
        generatedAt: now(),
        durationMs: now() - started
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
    const result = {
      success: true,
      phase: PHASE,
      version: VERSION,
      build: BUILD,
      installed: true,
      running: state.running,
      lastError: state.lastError,
      lastRun: state.lastRun,
      candidateCount: state.lastCandidates.length,
      candidateSample: state.lastCandidates.slice(0, 30),

      canonicalRuntimeState: {
        authoritative:
          unwrapArray(global.RainGuardAuthoritativePersistentStormIdentitiesV39).length,
        published:
          unwrapArray(global.RainGuardPublishedAuthoritativePersistentStormIdentitiesV39).length,
        integratedStorm:
          unwrapArray(global.RainGuardIntegratedPersistentStormIdentitiesV39).length,
        integratedRegistry:
          unwrapArray(global.RainGuardIntegratedIdentityPersistentRegistryV39).length,
        integratedPersistentRegistry:
          unwrapArray(global.RainGuardIntegratedPersistentIdentityRegistryV39).length
      }
    };

    console.log(`[RainGuard Phase ${PHASE}] Diagnostic:`, result);
    return result;
  }

  global.runRainGuardRuntimeAuthoritativeRegistrySourceDiscoveryBindingBridge = run;
  global.diagnoseRainGuardRuntimeAuthoritativeRegistrySourceDiscoveryBindingBridge = diagnose;

  global.RainGuardRuntimeAuthoritativeRegistrySourceDiscoveryBindingBridgeV39 = {
    phase: PHASE,
    version: VERSION,
    build: BUILD,
    run,
    diagnose,
    state
  };

})(window);
