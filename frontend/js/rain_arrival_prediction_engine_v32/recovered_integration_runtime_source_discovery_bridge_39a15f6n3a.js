/**
 * RainGuard AI V39
 * Phase 39A-15F6N3A — Recovered Integration Runtime Source Discovery Bridge
 * Version: 39A.15F6N3A.0
 */
(function (global) {
  "use strict";

  const PHASE = "39A-15F6N3A";
  const VERSION = "39A.15F6N3A.0";
  const BUILD = "rainguard-v39-recovered-integration-runtime-source-discovery-bridge";

  if (global.__RainGuardRecoveredIntegrationRuntimeSourceDiscoveryBridgeInstalled) return;
  global.__RainGuardRecoveredIntegrationRuntimeSourceDiscoveryBridgeInstalled = true;

  const DEFAULTS = Object.freeze({
    maxRootKeys: 5000,
    maxDepth: 4,
    maxObjectsVisited: 20000,
    maxIdentities: 5000,
    minAuthoritativeIdentities: 2,
    scanFunctions: false,
    includeWindowNamesContaining: [
      "RainGuard", "rainGuard", "Recovered", "Identity", "Historical",
      "Backfill", "Persistent", "15F6N2", "39A15F6N2"
    ]
  });

  const state = {
    running: false,
    lastRun: null,
    lastError: null,
    discoveredSources: [],
    selectedSource: null,
    publishedIdentityCount: 0
  };

  const now = () => Date.now();
  const isObject = v => v !== null && typeof v === "object";
  const safeString = v => {
    if (v === null || v === undefined) return "";
    try { return String(v).trim(); } catch (_) { return ""; }
  };
  const normalize = v => safeString(v).toLowerCase().replace(/\s+/g, " ").trim();

  function identityIdOf(record) {
    if (!record || typeof record !== "object") return "";
    const candidates = [
      record.persistentId, record.recoveredPersistentId, record.canonicalPersistentId,
      record.canonicalTrackId, record.canonicalId, record.identityKey,
      record.recoveredIdentityKey, record.trackId, record.cellId,
      record.stormId, record.entityId, record.identity, record.id
    ];
    for (const value of candidates) {
      const s = safeString(value);
      if (s) return s;
    }
    return "";
  }

  function looksLikeIdentity(record) {
    if (!record || typeof record !== "object") return false;
    if (identityIdOf(record)) return true;
    return [
      "aliases", "observations", "observationCount", "persistentId",
      "canonicalTrackId", "identityKey", "recoveredIdentityKey",
      "trackId", "stormId", "cellId"
    ].some(k => Object.prototype.hasOwnProperty.call(record, k));
  }

  function toCandidateArray(value) {
    if (Array.isArray(value)) return value;
    if (value instanceof Map || value instanceof Set) return Array.from(value.values());
    if (!isObject(value)) return [];

    const preferredKeys = [
      "identities", "mergedIdentities", "recoveredIdentities", "persistentIdentities",
      "integratedIdentities", "identityRecords", "records", "items", "values"
    ];
    for (const key of preferredKeys) {
      const v = value[key];
      if (Array.isArray(v)) return v;
      if (v instanceof Map || v instanceof Set) return Array.from(v.values());
    }
    return [];
  }

  function scoreIdentityArray(arr, path) {
    if (!Array.isArray(arr) || !arr.length) return null;
    let valid = 0, withAliases = 0, withObservations = 0, multiPoint = 0;

    for (const item of arr.slice(0, 1000)) {
      if (!looksLikeIdentity(item)) continue;
      valid++;
      if (Array.isArray(item.aliases) && item.aliases.length) withAliases++;
      const obs = Array.isArray(item.observations)
        ? item.observations
        : Array.isArray(item.history) ? item.history : [];
      if (obs.length) withObservations++;
      if (obs.length > 1 || Number(item.observationCount) > 1) multiPoint++;
    }

    if (!valid) return null;

    const p = normalize(path);
    let score = valid * 10;
    if (p.includes("39a15f6n2")) score += 5000;
    if (p.includes("15f6n2")) score += 3000;
    if (p.includes("recovered")) score += 1000;
    if (p.includes("integrat")) score += 800;
    if (p.includes("identity")) score += 500;
    if (p.includes("histor")) score += 200;
    if (p.includes("backfill")) score += 200;
    if (p.includes("persistent")) score += 200;
    score += withAliases * 2 + withObservations * 3 + multiPoint * 5;

    return {
      path,
      array: arr,
      count: arr.length,
      validIdentityCount: valid,
      withAliases,
      withObservations,
      multiPointCount: multiPoint,
      score
    };
  }

  function shouldInspectRootKey(key, cfg) {
    const k = safeString(key);
    if (!k) return false;
    return cfg.includeWindowNamesContaining.some(token =>
      k.includes(token) || k.toLowerCase().includes(String(token).toLowerCase())
    );
  }

  function scanValue(value, path, cfg, visited, results, depth, counters) {
    if (depth > cfg.maxDepth || counters.visited >= cfg.maxObjectsVisited) return;
    if (value === null || value === undefined) return;
    if (typeof value === "function" && !cfg.scanFunctions) return;

    if (Array.isArray(value)) {
      const scored = scoreIdentityArray(value, path);
      if (scored) results.push(scored);
      for (let i = 0; i < Math.min(value.length, 25); i++) {
        if (isObject(value[i])) scanValue(value[i], `${path}[${i}]`, cfg, visited, results, depth + 1, counters);
      }
      return;
    }

    if (value instanceof Map || value instanceof Set) {
      const arr = Array.from(value.values());
      const scored = scoreIdentityArray(arr, path);
      if (scored) results.push(scored);
      for (let i = 0; i < Math.min(arr.length, 25); i++) {
        if (isObject(arr[i])) scanValue(arr[i], `${path}<${i}>`, cfg, visited, results, depth + 1, counters);
      }
      return;
    }

    if (!isObject(value) || visited.has(value)) return;
    visited.add(value);
    counters.visited++;

    const directArray = toCandidateArray(value);
    if (directArray.length) {
      const scored = scoreIdentityArray(directArray, `${path}::<candidateArray>`);
      if (scored) results.push(scored);
    }

    let keys = [];
    try { keys = Object.keys(value); } catch (_) { return; }

    for (const key of keys.slice(0, 100)) {
      let child;
      try { child = value[key]; } catch (_) { continue; }
      const childPath = `${path}.${key}`;

      if (Array.isArray(child) || child instanceof Map || child instanceof Set) {
        const arr = Array.isArray(child) ? child : Array.from(child.values());
        const scored = scoreIdentityArray(arr, childPath);
        if (scored) results.push(scored);
      }
      if (isObject(child) && depth < cfg.maxDepth) {
        scanValue(child, childPath, cfg, visited, results, depth + 1, counters);
      }
    }
  }

  function discoverRuntimeSources(cfg) {
    const results = [];
    const visited = new WeakSet();
    const counters = { visited: 0 };

    const priorityRoots = [
      "RainGuardRecoveredIdentityHistoricalBackfillIntegrationV39",
      "RainGuardRecoveredIdentityHistoricalBackfillIntegrationBridgeV39",
      "RainGuardRecoveredIdentityHistoricalBackfillIntegrationResultV39",
      "RainGuardHistoricalIdentityKeyRecoveryV39",
      "RainGuardRecoveredPersistentStormIdentitiesV39",
      "RainGuardHistoricalBackfillPersistentIdentitiesV39",
      "RainGuardIntegratedPersistentStormIdentitiesV39",
      "RainGuardPersistentStormIdentitiesV39"
    ];

    for (const key of priorityRoots) {
      try {
        if (global[key] !== undefined) {
          scanValue(global[key], `window.${key}`, cfg, visited, results, 0, counters);
        }
      } catch (_) {}
    }

    let rootKeys = [];
    try { rootKeys = Object.getOwnPropertyNames(global).slice(0, cfg.maxRootKeys); } catch (_) {}

    for (const key of rootKeys) {
      if (!shouldInspectRootKey(key, cfg)) continue;
      let value;
      try { value = global[key]; } catch (_) { continue; }
      scanValue(value, `window.${key}`, cfg, visited, results, 0, counters);
    }

    const unique = [];
    const seen = new Set();
    for (const item of results) {
      const firstId = item.array && item.array.length ? identityIdOf(item.array[0]) : "";
      const sig = [item.path, item.count, item.validIdentityCount, firstId].join("|");
      if (seen.has(sig)) continue;
      seen.add(sig);
      unique.push(item);
    }

    unique.sort((a, b) =>
      (b.score - a.score) ||
      (b.validIdentityCount - a.validIdentityCount) ||
      (b.count - a.count)
    );

    return { results: unique, visitedObjectCount: counters.visited };
  }

  function normalizeIdentitySet(arr, cfg) {
    const byId = new Map();
    for (const raw of arr.slice(0, cfg.maxIdentities)) {
      if (!raw || typeof raw !== "object") continue;
      const id = identityIdOf(raw);
      if (!id) continue;
      const key = normalize(id);
      if (!byId.has(key)) {
        byId.set(key, raw);
        continue;
      }
      const current = byId.get(key);
      const currentObs = Array.isArray(current.observations) ? current.observations.length : 0;
      const incomingObs = Array.isArray(raw.observations) ? raw.observations.length : 0;
      if (incomingObs > currentObs) byId.set(key, raw);
    }
    return Array.from(byId.values());
  }

  function buildAliasMap(identities) {
    const aliasMap = new Map();
    const add = (alias, persistentId) => {
      const key = normalize(alias);
      if (key && !aliasMap.has(key)) aliasMap.set(key, persistentId);
    };

    for (const identity of identities) {
      const pid = identityIdOf(identity);
      if (!pid) continue;
      add(pid, pid);

      [
        "persistentId", "recoveredPersistentId", "canonicalPersistentId",
        "canonicalTrackId", "canonicalId", "identityKey", "recoveredIdentityKey",
        "trackId", "cellId", "stormId", "entityId", "identity", "id"
      ].forEach(field => add(identity[field], pid));

      [
        "aliases", "trackAliases", "identityAliases", "sourceAliases",
        "historicalAliases", "candidateAliases"
      ].forEach(field => {
        const values = identity[field];
        if (!Array.isArray(values)) return;
        values.forEach(item => {
          if (typeof item === "string" || typeof item === "number") add(item, pid);
          else if (item && typeof item === "object") {
            add(item.alias, pid); add(item.id, pid); add(item.trackId, pid);
            add(item.cellId, pid); add(item.persistentId, pid);
          }
        });
      });
    }
    return aliasMap;
  }

  function publishDiscoveredSource(selected, identities) {
    const aliasMap = buildAliasMap(identities);
    const byId = new Map();
    for (const identity of identities) {
      const id = identityIdOf(identity);
      if (id) byId.set(normalize(id), identity);
    }

    const runtimeState = {
      phase: PHASE,
      version: VERSION,
      build: BUILD,
      status: "RECOVERED_INTEGRATION_RUNTIME_SOURCE_DISCOVERED",
      selectedPath: selected.path,
      selectedScore: selected.score,
      selectedRawCount: selected.count,
      identityCount: identities.length,
      aliasCount: aliasMap.size,
      identities,
      identityIndex: byId,
      aliasMap,
      generatedAt: now()
    };

    global.RainGuardRecoveredIdentityHistoricalBackfillIntegrationV39 = runtimeState;
    global.RainGuardRecoveredIdentityHistoricalBackfillIntegrationResultV39 = runtimeState;
    global.RainGuardRecoveredPersistentStormIdentitiesV39 = identities;
    global.RainGuardHistoricalBackfillPersistentIdentitiesV39 = identities;
    global.RainGuardIntegratedPersistentStormIdentitiesV39 = identities;
    global.RainGuardAuthoritativePersistentStormIdentitiesV39 = identities;
    global.RainGuardRecoveredHistoricalIdentityAliasMapV39 = aliasMap;
    global.RainGuardAuthoritativePersistentIdentityAliasMapV39 = aliasMap;
    global.RainGuardRecoveredIntegrationRuntimeSourceDiscoveryV39 = runtimeState;

    state.selectedSource = selected.path;
    state.publishedIdentityCount = identities.length;
    return runtimeState;
  }

  async function run(options) {
    const startedAt = now();
    if (state.running) {
      return { success: false, phase: PHASE, version: VERSION, build: BUILD, status: "RUNTIME_SOURCE_DISCOVERY_ALREADY_RUNNING" };
    }
    state.running = true;

    try {
      const cfg = Object.assign({}, DEFAULTS, options && typeof options === "object" ? options : {});
      const discovery = discoverRuntimeSources(cfg);

      state.discoveredSources = discovery.results.map(r => ({
        path: r.path,
        count: r.count,
        validIdentityCount: r.validIdentityCount,
        multiPointCount: r.multiPointCount,
        score: r.score
      }));

      const selected = discovery.results.find(r => r.validIdentityCount >= cfg.minAuthoritativeIdentities);

      if (!selected) {
        const result = {
          success: false,
          phase: PHASE,
          version: VERSION,
          build: BUILD,
          status: "NO_RECOVERED_MULTI_IDENTITY_RUNTIME_SOURCE_DISCOVERED",
          generatedAt: now(),
          durationMs: now() - startedAt,
          visitedObjectCount: discovery.visitedObjectCount,
          discoveredCandidateCount: discovery.results.length,
          discoveredSources: state.discoveredSources.slice(0, 30)
        };
        state.lastRun = result;
        console.warn(`[RainGuard Phase ${PHASE}] No authoritative recovered identity runtime source discovered.`);
        console.log(result);
        return result;
      }

      const identities = normalizeIdentitySet(selected.array, cfg);
      if (identities.length < cfg.minAuthoritativeIdentities) {
        const result = {
          success: false,
          phase: PHASE,
          version: VERSION,
          build: BUILD,
          status: "DISCOVERED_SOURCE_NORMALIZED_TO_INSUFFICIENT_IDENTITIES",
          selectedPath: selected.path,
          selectedRawCount: selected.count,
          normalizedIdentityCount: identities.length,
          generatedAt: now(),
          durationMs: now() - startedAt
        };
        state.lastRun = result;
        return result;
      }

      const published = publishDiscoveredSource(selected, identities);
      const result = {
        success: true,
        phase: PHASE,
        version: VERSION,
        build: BUILD,
        status: "RECOVERED_INTEGRATION_RUNTIME_SOURCE_DISCOVERED_AND_PUBLISHED",
        generatedAt: now(),
        durationMs: now() - startedAt,
        selectedPath: selected.path,
        selectedScore: selected.score,
        selectedRawCount: selected.count,
        selectedValidIdentityCount: selected.validIdentityCount,
        selectedMultiPointCount: selected.multiPointCount,
        publishedIdentityCount: published.identityCount,
        publishedAliasCount: published.aliasCount,
        visitedObjectCount: discovery.visitedObjectCount,
        discoveredCandidateCount: discovery.results.length,
        discoveredSources: state.discoveredSources.slice(0, 30),
        identitySample: identities.slice(0, 20)
      };

      state.lastRun = result;
      state.lastError = null;
      console.log(`[RainGuard Phase ${PHASE}] Recovered Integration Runtime Source Discovery result:`);
      console.log(result);
      return result;

    } catch (error) {
      const result = {
        success: false,
        phase: PHASE,
        version: VERSION,
        build: BUILD,
        status: "RECOVERED_INTEGRATION_RUNTIME_SOURCE_DISCOVERY_FAILED",
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
    const recoveredState = global.RainGuardRecoveredIdentityHistoricalBackfillIntegrationV39 || null;
    const recoveredIds = recoveredState && Array.isArray(recoveredState.identities) ? recoveredState.identities : [];

    const result = {
      success: true,
      phase: PHASE,
      version: VERSION,
      build: BUILD,
      installed: true,
      running: state.running,
      selectedSource: state.selectedSource,
      publishedIdentityCount: state.publishedIdentityCount,
      runtimeIntegrationStateAvailable: !!recoveredState,
      runtimeIntegrationIdentityCount: recoveredIds.length,
      recoveredPersistentIdentityCount: Array.isArray(global.RainGuardRecoveredPersistentStormIdentitiesV39)
        ? global.RainGuardRecoveredPersistentStormIdentitiesV39.length : 0,
      integratedPersistentIdentityCount: Array.isArray(global.RainGuardIntegratedPersistentStormIdentitiesV39)
        ? global.RainGuardIntegratedPersistentStormIdentitiesV39.length : 0,
      discoveredSources: state.discoveredSources.slice(0, 30),
      lastRun: state.lastRun,
      lastError: state.lastError
    };

    console.log(`[RainGuard Phase ${PHASE}] Diagnostic:`);
    console.log(result);
    return result;
  }

  global.runRainGuardRecoveredIntegrationRuntimeSourceDiscoveryBridge = run;
  global.diagnoseRainGuardRecoveredIntegrationRuntimeSourceDiscoveryBridge = diagnose;

  global.RainGuardRecoveredIntegrationRuntimeSourceDiscoveryBridgeV39 = {
    phase: PHASE,
    version: VERSION,
    build: BUILD,
    run,
    diagnose,
    state
  };

})(window);
