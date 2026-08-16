/**
 * RainGuard AI V39
 * Phase 39A-15F6N4A — Authoritative Identity → Persistent Registry Source Integration Bridge
 * Version: 39A.15F6N4A.0
 *
 * الهدف:
 * - أخذ الهويات authoritative الناتجة من N3/N3A.
 * - نشرها في Runtime بأسماء المصادر التي يستطيع N4 استهلاكها.
 * - عدم فقدان بيانات N3A/N3.
 * - إبقاء N4 كما هي، مع توفير مصدر Multi-Identity صحيح لها.
 *
 * Public API:
 *   window.runRainGuardAuthoritativeIdentityPersistentRegistrySourceIntegrationBridge(options?)
 *   window.diagnoseRainGuardAuthoritativeIdentityPersistentRegistrySourceIntegrationBridge()
 */

(function installRainGuardAuthoritativeIdentityPersistentRegistrySourceIntegrationBridge(global) {
  "use strict";

  const PHASE = "39A-15F6N4A";
  const VERSION = "39A.15F6N4A.0";
  const BUILD = "rainguard-v39-authoritative-identity-persistent-registry-source-integration-bridge";

  if (global.__RainGuardAuthoritativeIdentityPersistentRegistrySourceIntegrationBridgeInstalled) return;
  global.__RainGuardAuthoritativeIdentityPersistentRegistrySourceIntegrationBridgeInstalled = true;

  const DEFAULTS = Object.freeze({
    minIdentities: 2,
    maxIdentities: 5000,
    publishToLegacyPersistentName: true,
    publishToIntegratedName: true,
    publishToAuthoritativeName: true,
    preserveExistingIfLarger: false
  });

  const state = {
    running: false,
    lastRun: null,
    lastError: null,
    selectedSourceName: null,
    publishedIdentityCount: 0
  };

  function now() {
    return Date.now();
  }

  function isObj(v) {
    return !!v && typeof v === "object";
  }

  function s(v) {
    if (v === null || v === undefined) return "";
    try { return String(v).trim(); } catch (_) { return ""; }
  }

  function norm(v) {
    return s(v).toLowerCase().replace(/\s+/g, " ").trim();
  }

  function identityIdOf(record) {
    if (!isObj(record)) return "";
    const fields = [
      "persistentId",
      "recoveredPersistentId",
      "canonicalPersistentId",
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
    for (const k of fields) {
      const v = s(record[k]);
      if (v) return v;
    }
    return "";
  }

  function toArray(value) {
    if (!value) return [];

    if (Array.isArray(value)) return value;
    if (value instanceof Map || value instanceof Set) return Array.from(value.values());

    if (isObj(value)) {
      const keys = [
        "identities",
        "authoritativeIdentities",
        "integratedIdentities",
        "persistentIdentities",
        "recoveredIdentities",
        "mergedIdentities",
        "identityRecords",
        "records",
        "items"
      ];

      for (const key of keys) {
        const v = value[key];
        if (Array.isArray(v)) return v;
        if (v instanceof Map || v instanceof Set) return Array.from(v.values());
      }
    }

    return [];
  }

  function normalizeIdentityArray(arr, maxIdentities) {
    const byId = new Map();
    const anonymous = [];

    for (const item of arr.slice(0, maxIdentities)) {
      if (!isObj(item)) continue;

      const id = identityIdOf(item);

      if (!id) {
        anonymous.push(item);
        continue;
      }

      const key = norm(id);

      if (!byId.has(key)) {
        byId.set(key, item);
        continue;
      }

      const current = byId.get(key);

      const currentObs = Array.isArray(current.observations)
        ? current.observations.length
        : Array.isArray(current.history)
          ? current.history.length
          : Number(current.observationCount || 0);

      const incomingObs = Array.isArray(item.observations)
        ? item.observations.length
        : Array.isArray(item.history)
          ? item.history.length
          : Number(item.observationCount || 0);

      if (incomingObs > currentObs) {
        byId.set(key, item);
      }
    }

    return Array.from(byId.values());
  }

  function scoreSource(name, arr) {
    if (!Array.isArray(arr) || arr.length === 0) return -1;

    let valid = 0;
    let multiPoint = 0;
    let obsTotal = 0;

    for (const item of arr.slice(0, 1500)) {
      if (!isObj(item)) continue;
      if (identityIdOf(item)) valid++;

      const obs = Array.isArray(item.observations)
        ? item.observations
        : Array.isArray(item.history)
          ? item.history
          : [];

      obsTotal += obs.length;
      if (obs.length > 1 || Number(item.observationCount || 0) > 1) multiPoint++;
    }

    if (!valid) return -1;

    const lower = name.toLowerCase();

    let score = valid * 10;
    score += multiPoint * 5;
    score += Math.min(obsTotal, 10000);

    if (lower.includes("authoritative")) score += 10000;
    if (lower.includes("integrated")) score += 7000;
    if (lower.includes("recovered")) score += 5000;
    if (lower.includes("historical")) score += 1000;
    if (lower.includes("n3a")) score += 8000;
    if (lower.includes("n3")) score += 6000;

    return score;
  }

  function collectCandidateSources() {
    const raw = [
      ["RainGuardAuthoritativePersistentStormIdentitiesV39", global.RainGuardAuthoritativePersistentStormIdentitiesV39],
      ["RainGuardIntegratedPersistentStormIdentitiesV39", global.RainGuardIntegratedPersistentStormIdentitiesV39],
      ["RainGuardRecoveredPersistentStormIdentitiesV39", global.RainGuardRecoveredPersistentStormIdentitiesV39],
      ["RainGuardHistoricalBackfillPersistentIdentitiesV39", global.RainGuardHistoricalBackfillPersistentIdentitiesV39],
      ["RainGuardRecoveredIdentityHistoricalBackfillIntegrationV39", global.RainGuardRecoveredIdentityHistoricalBackfillIntegrationV39],
      ["RainGuardRecoveredIdentityHistoricalBackfillIntegrationResultV39", global.RainGuardRecoveredIdentityHistoricalBackfillIntegrationResultV39],
      ["RainGuardRecoveredIntegrationRuntimeSourceDiscoveryV39", global.RainGuardRecoveredIntegrationRuntimeSourceDiscoveryV39],
      ["RainGuardPersistentStormIdentitiesV39", global.RainGuardPersistentStormIdentitiesV39]
    ];

    const out = [];

    for (const [name, value] of raw) {
      const arr = toArray(value);
      if (!arr.length) continue;

      out.push({
        name,
        arr,
        count: arr.length,
        score: scoreSource(name, arr)
      });
    }

    return out.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.count - a.count;
    });
  }

  function buildAliasMap(identities) {
    const aliasMap = new Map();

    function add(alias, canonical) {
      const k = norm(alias);
      if (!k || aliasMap.has(k)) return;
      aliasMap.set(k, canonical);
    }

    for (const identity of identities) {
      const canonical = identityIdOf(identity);
      if (!canonical) continue;

      add(canonical, canonical);

      const scalar = [
        "persistentId",
        "recoveredPersistentId",
        "canonicalPersistentId",
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

      for (const k of scalar) add(identity[k], canonical);

      const arrays = [
        "aliases",
        "identityAliases",
        "trackAliases",
        "sourceAliases",
        "historicalAliases",
        "candidateAliases"
      ];

      for (const k of arrays) {
        const arr = identity[k];
        if (!Array.isArray(arr)) continue;

        for (const item of arr) {
          if (typeof item === "string" || typeof item === "number") {
            add(item, canonical);
          } else if (isObj(item)) {
            add(item.alias, canonical);
            add(item.id, canonical);
            add(item.trackId, canonical);
            add(item.cellId, canonical);
            add(item.persistentId, canonical);
            add(item.identity, canonical);
          }
        }
      }
    }

    return aliasMap;
  }

  async function run(options) {
    const startedAt = now();

    if (state.running) {
      return {
        success: false,
        phase: PHASE,
        version: VERSION,
        build: BUILD,
        status: "SOURCE_INTEGRATION_ALREADY_RUNNING"
      };
    }

    state.running = true;

    try {
      const cfg = Object.assign({}, DEFAULTS, isObj(options) ? options : {});

      const candidates = collectCandidateSources();

      if (!candidates.length) {
        const result = {
          success: false,
          phase: PHASE,
          version: VERSION,
          build: BUILD,
          status: "NO_AUTHORITATIVE_IDENTITY_SOURCE_AVAILABLE",
          generatedAt: now(),
          durationMs: now() - startedAt
        };

        state.lastRun = result;
        return result;
      }

      const selected = candidates.find(c => c.count >= cfg.minIdentities) || candidates[0];
      const normalized = normalizeIdentityArray(selected.arr, cfg.maxIdentities);

      if (normalized.length < cfg.minIdentities) {
        const result = {
          success: false,
          phase: PHASE,
          version: VERSION,
          build: BUILD,
          status: "AUTHORITATIVE_SOURCE_FOUND_BUT_INSUFFICIENT_IDENTITIES",
          selectedSourceName: selected.name,
          selectedSourceCount: selected.count,
          normalizedIdentityCount: normalized.length,
          generatedAt: now(),
          durationMs: now() - startedAt
        };

        state.lastRun = result;
        return result;
      }

      const aliasMap = buildAliasMap(normalized);

      const existingLegacy = Array.isArray(global.RainGuardPersistentStormIdentitiesV39)
        ? global.RainGuardPersistentStormIdentitiesV39
        : [];

      const shouldReplaceLegacy =
        !cfg.preserveExistingIfLarger ||
        normalized.length >= existingLegacy.length;

      if (cfg.publishToLegacyPersistentName && shouldReplaceLegacy) {
        global.RainGuardPersistentStormIdentitiesV39 = normalized;
      }

      if (cfg.publishToIntegratedName) {
        global.RainGuardIntegratedPersistentStormIdentitiesV39 = normalized;
      }

      if (cfg.publishToAuthoritativeName) {
        global.RainGuardAuthoritativePersistentStormIdentitiesV39 = normalized;
      }

      global.RainGuardPersistentStormIdentityAliasRegistryV39 = aliasMap;
      global.RainGuardAuthoritativePersistentIdentityAliasMapV39 = aliasMap;

      const runtimeState = {
        phase: PHASE,
        version: VERSION,
        build: BUILD,
        status: "AUTHORITATIVE_IDENTITIES_PUBLISHED_FOR_PERSISTENT_REGISTRY",
        selectedSourceName: selected.name,
        selectedSourceCount: selected.count,
        selectedSourceScore: selected.score,
        publishedIdentityCount: normalized.length,
        publishedAliasCount: aliasMap.size,
        legacyPersistentNameUpdated:
          cfg.publishToLegacyPersistentName && shouldReplaceLegacy,
        generatedAt: now(),
        identities: normalized,
        aliasMap
      };

      global.RainGuardAuthoritativeIdentityPersistentRegistrySourceIntegrationV39 = runtimeState;

      state.selectedSourceName = selected.name;
      state.publishedIdentityCount = normalized.length;

      const result = {
        success: true,
        phase: PHASE,
        version: VERSION,
        build: BUILD,
        status: "AUTHORITATIVE_IDENTITIES_READY_FOR_PERSISTENT_REGISTRY",

        generatedAt: now(),
        durationMs: now() - startedAt,

        selectedSourceName: selected.name,
        selectedSourceCount: selected.count,
        selectedSourceScore: selected.score,

        candidateSourceCount: candidates.length,
        candidateSources: candidates.map(c => ({
          name: c.name,
          count: c.count,
          score: c.score
        })),

        previousLegacyPersistentIdentityCount: existingLegacy.length,
        publishedIdentityCount: normalized.length,
        publishedAliasCount: aliasMap.size,

        legacyPersistentNameUpdated:
          cfg.publishToLegacyPersistentName && shouldReplaceLegacy,

        authoritativeSourceCount:
          Array.isArray(global.RainGuardAuthoritativePersistentStormIdentitiesV39)
            ? global.RainGuardAuthoritativePersistentStormIdentitiesV39.length
            : 0,

        integratedSourceCount:
          Array.isArray(global.RainGuardIntegratedPersistentStormIdentitiesV39)
            ? global.RainGuardIntegratedPersistentStormIdentitiesV39.length
            : 0,

        legacyPersistentSourceCount:
          Array.isArray(global.RainGuardPersistentStormIdentitiesV39)
            ? global.RainGuardPersistentStormIdentitiesV39.length
            : 0,

        identitySample: normalized.slice(0, 20)
      };

      state.lastRun = result;
      state.lastError = null;

      console.log(`[RainGuard Phase ${PHASE}] Authoritative Identity -> Persistent Registry Source Integration result:`);
      console.log(result);

      return result;

    } catch (error) {
      const result = {
        success: false,
        phase: PHASE,
        version: VERSION,
        build: BUILD,
        status: "AUTHORITATIVE_IDENTITY_REGISTRY_SOURCE_INTEGRATION_FAILED",
        generatedAt: now(),
        durationMs: now() - startedAt,
        error: error && error.message ? error.message : String(error)
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
      selectedSourceName: state.selectedSourceName,
      publishedIdentityCount: state.publishedIdentityCount,
      legacyPersistentSourceCount:
        Array.isArray(global.RainGuardPersistentStormIdentitiesV39)
          ? global.RainGuardPersistentStormIdentitiesV39.length
          : 0,
      authoritativeSourceCount:
        Array.isArray(global.RainGuardAuthoritativePersistentStormIdentitiesV39)
          ? global.RainGuardAuthoritativePersistentStormIdentitiesV39.length
          : 0,
      integratedSourceCount:
        Array.isArray(global.RainGuardIntegratedPersistentStormIdentitiesV39)
          ? global.RainGuardIntegratedPersistentStormIdentitiesV39.length
          : 0,
      lastRun: state.lastRun,
      lastError: state.lastError
    };

    console.log(`[RainGuard Phase ${PHASE}] Diagnostic:`);
    console.log(result);

    return result;
  }

  global.runRainGuardAuthoritativeIdentityPersistentRegistrySourceIntegrationBridge = run;
  global.diagnoseRainGuardAuthoritativeIdentityPersistentRegistrySourceIntegrationBridge = diagnose;

  global.RainGuardAuthoritativeIdentityPersistentRegistrySourceIntegrationBridgeV39 = {
    phase: PHASE,
    version: VERSION,
    build: BUILD,
    run,
    diagnose,
    state
  };

})(window);
