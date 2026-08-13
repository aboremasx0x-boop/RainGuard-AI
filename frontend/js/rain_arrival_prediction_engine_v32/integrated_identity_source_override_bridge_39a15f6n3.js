/**
 * RainGuard AI V39
 * Phase 39A-15F6N3 — Integrated Identity Source Override Bridge
 * Version: 39A.15F6N3.0
 */
(function (global) {
  "use strict";

  const PHASE = "39A-15F6N3";
  const VERSION = "39A.15F6N3.0";
  const BUILD = "rainguard-v39-integrated-identity-source-override-bridge";

  if (global.__RainGuardIntegratedIdentitySourceOverrideBridgeInstalled) return;
  global.__RainGuardIntegratedIdentitySourceOverrideBridgeInstalled = true;

  const state = {
    installed: false,
    wrappedRunnerName: null,
    originalRunner: null,
    lastResult: null
  };

  function toArray(v) {
    if (Array.isArray(v)) return v.slice();
    if (v instanceof Map || v instanceof Set) return Array.from(v.values());
    if (v && typeof v === "object") {
      if (Array.isArray(v.identities)) return v.identities.slice();
      if (Array.isArray(v.records)) return v.records.slice();
      return Object.values(v).filter(x => x && typeof x === "object");
    }
    return [];
  }

  function str(v) {
    if (v === null || v === undefined) return "";
    return String(v).trim();
  }

  function norm(v) {
    return str(v).toLowerCase().replace(/\s+/g, " ").trim();
  }

  function identityId(x) {
    if (!x) return "";
    const vals = [
      x.persistentId, x.recoveredPersistentId, x.canonicalTrackId, x.canonicalId,
      x.identityKey, x.trackId, x.cellId, x.stormId, x.entityId, x.identity, x.id
    ];
    for (const v of vals) if (str(v)) return str(v);
    return "";
  }

  function getN2State() {
    return global.RainGuardRecoveredIdentityHistoricalBackfillIntegrationV39 || null;
  }

  function getAuthoritativeIdentities() {
    const n2 = getN2State();
    const candidates = [
      n2 && n2.identities,
      global.RainGuardRecoveredPersistentStormIdentitiesV39,
      global.RainGuardHistoricalBackfillPersistentIdentitiesV39
    ];

    for (const c of candidates) {
      const arr = toArray(c).filter(x => identityId(x));
      if (arr.length > 1) return arr;
    }
    return [];
  }

  function aliasesOf(identity) {
    const out = [];
    const seen = new Set();
    const add = v => {
      const raw = str(v), key = norm(raw);
      if (!key || seen.has(key)) return;
      seen.add(key);
      out.push(raw);
    };

    add(identityId(identity));

    [
      "persistentId","recoveredPersistentId","canonicalTrackId","canonicalId",
      "identityKey","trackId","cellId","stormId","entityId","identity","id"
    ].forEach(k => add(identity && identity[k]));

    [
      "aliases","trackAliases","identityAliases","sourceAliases","historicalAliases"
    ].forEach(k => {
      const arr = identity && identity[k];
      if (!Array.isArray(arr)) return;
      arr.forEach(v => {
        if (typeof v === "string" || typeof v === "number") add(v);
        else if (v && typeof v === "object") {
          add(v.alias); add(v.id); add(v.trackId); add(v.cellId); add(v.persistentId);
        }
      });
    });

    return out;
  }

  function publishAuthoritativeSource() {
    const identities = getAuthoritativeIdentities();

    if (identities.length <= 1) {
      return {
        success: false,
        status: "NO_MULTI_IDENTITY_AUTHORITATIVE_SOURCE_FOUND",
        identityCount: identities.length
      };
    }

    const aliasMap = new Map();
    const byId = new Map();

    identities.forEach(identity => {
      const id = identityId(identity);
      const key = norm(id);
      if (!key) return;

      byId.set(key, identity);

      aliasesOf(identity).forEach(alias => {
        const akey = norm(alias);
        if (akey && !aliasMap.has(akey)) aliasMap.set(akey, id);
      });
    });

    global.RainGuardPersistentStormIdentitiesV39 = identities;
    global.RainGuardRecoveredPersistentStormIdentitiesV39 = identities;
    global.RainGuardHistoricalBackfillPersistentIdentitiesV39 = identities;
    global.RainGuardIntegratedPersistentStormIdentitiesV39 = identities;
    global.RainGuardAuthoritativePersistentStormIdentitiesV39 = identities;

    global.RainGuardPersistentIdentityByIdV39 = byId;
    global.RainGuardRecoveredHistoricalIdentityAliasMapV39 = aliasMap;
    global.RainGuardAuthoritativePersistentIdentityAliasMapV39 = aliasMap;

    global.RainGuardIntegratedIdentitySourceOverrideV39 = {
      phase: PHASE,
      version: VERSION,
      build: BUILD,
      source: "RainGuardRecoveredIdentityHistoricalBackfillIntegrationV39",
      identities,
      identityIndex: byId,
      aliasMap,
      identityCount: identities.length,
      aliasCount: aliasMap.size,
      publishedAt: Date.now()
    };

    return {
      success: true,
      status: "AUTHORITATIVE_IDENTITY_SOURCE_PUBLISHED",
      identityCount: identities.length,
      aliasCount: aliasMap.size
    };
  }

  function findBackfillRunner() {
    const names = [
      "runRainGuardHistoricalObservationPersistentIdentityBackfillBridge",
      "runRainGuardHistoricalObservationPersistentIdentityBackfill",
      "runRainGuardHistoricalPersistentIdentityBackfillBridge"
    ];

    return names.find(name => typeof global[name] === "function") || null;
  }

  function installOverride() {
    const published = publishAuthoritativeSource();
    if (!published.success) return published;

    const runnerName = findBackfillRunner();

    if (!runnerName) {
      state.installed = true;
      return {
        success: true,
        status: "OVERRIDE_READY_BACKFILL_RUNNER_NOT_FOUND",
        authoritativeIdentityCount: published.identityCount,
        authoritativeAliasCount: published.aliasCount
      };
    }

    if (
      state.installed &&
      state.wrappedRunnerName === runnerName &&
      global[runnerName] &&
      global[runnerName].__RainGuard39A15F6N3Wrapped
    ) {
      return {
        success: true,
        status: "OVERRIDE_ALREADY_INSTALLED",
        runnerName,
        authoritativeIdentityCount: published.identityCount,
        authoritativeAliasCount: published.aliasCount
      };
    }

    const original = global[runnerName];

    async function wrappedRunner() {
      publishAuthoritativeSource();
      return await original.apply(this, arguments);
    }

    Object.defineProperty(wrappedRunner, "__RainGuard39A15F6N3Wrapped", {
      value: true
    });

    global[runnerName] = wrappedRunner;

    state.installed = true;
    state.wrappedRunnerName = runnerName;
    state.originalRunner = original;

    return {
      success: true,
      status: "OVERRIDE_INSTALLED",
      runnerName,
      authoritativeIdentityCount: published.identityCount,
      authoritativeAliasCount: published.aliasCount
    };
  }

  function restoreOverride() {
    if (state.wrappedRunnerName && state.originalRunner) {
      global[state.wrappedRunnerName] = state.originalRunner;
    }

    const restoredRunnerName = state.wrappedRunnerName;
    state.installed = false;
    state.wrappedRunnerName = null;
    state.originalRunner = null;

    return {
      success: true,
      phase: PHASE,
      version: VERSION,
      status: "OVERRIDE_RESTORED",
      restoredRunnerName
    };
  }

  async function run() {
    const started = Date.now();

    try {
      const installed = installOverride();
      const published = publishAuthoritativeSource();
      const n2 = getN2State();

      const result = {
        success: installed.success && published.success,
        phase: PHASE,
        version: VERSION,
        build: BUILD,
        status: installed.success && published.success
          ? "INTEGRATED_IDENTITY_SOURCE_OVERRIDE_READY"
          : (installed.status || published.status),

        durationMs: Date.now() - started,
        generatedAt: Date.now(),

        overrideInstalled: state.installed,
        wrappedRunnerName: state.wrappedRunnerName,

        authoritativeIdentityCount: published.identityCount || 0,
        authoritativeAliasCount: published.aliasCount || 0,

        primaryIdentitySource: "RainGuardPersistentStormIdentitiesV39",
        primaryIdentitySourceCount: toArray(global.RainGuardPersistentStormIdentitiesV39).length,

        n2IdentitySourceAvailable: !!n2,
        n2IdentityCount: n2 ? toArray(n2.identities).length : 0
      };

      state.lastResult = result;

      console.log(`[RainGuard Phase ${PHASE}] Integrated Identity Source Override result:`);
      console.log(result);

      return result;

    } catch (error) {
      const result = {
        success: false,
        phase: PHASE,
        version: VERSION,
        build: BUILD,
        status: "INTEGRATED_IDENTITY_SOURCE_OVERRIDE_FAILED",
        durationMs: Date.now() - started,
        error: error && error.message ? error.message : String(error)
      };

      state.lastResult = result;
      console.error(`[RainGuard Phase ${PHASE}] failed:`, error);
      return result;
    }
  }

  function diagnose() {
    const n2 = getN2State();
    const authoritative = getAuthoritativeIdentities();
    const currentPrimary = toArray(global.RainGuardPersistentStormIdentitiesV39);

    const result = {
      success: true,
      phase: PHASE,
      version: VERSION,
      build: BUILD,
      installed: state.installed,
      wrappedRunnerName: state.wrappedRunnerName,
      hasN2State: !!n2,
      n2IdentityCount: n2 ? toArray(n2.identities).length : 0,
      authoritativeIdentityCount: authoritative.length,
      currentPrimaryIdentityCount: currentPrimary.length,
      authoritativeReady: authoritative.length > 1,
      currentPrimaryIsMultiIdentity: currentPrimary.length > 1,
      hasBackfillRunner: !!findBackfillRunner(),
      lastResult: state.lastResult
    };

    console.log(`[RainGuard Phase ${PHASE}] Diagnostic:`);
    console.log(result);

    return result;
  }

  global.runRainGuardIntegratedIdentitySourceOverrideBridge = run;
  global.installRainGuardIntegratedIdentitySourceOverride = installOverride;
  global.restoreRainGuardIntegratedIdentitySourceOverride = restoreOverride;
  global.diagnoseRainGuardIntegratedIdentitySourceOverrideBridge = diagnose;

  global.RainGuardIntegratedIdentitySourceOverrideBridgeV39 = {
    phase: PHASE,
    version: VERSION,
    build: BUILD,
    run,
    install: installOverride,
    restore: restoreOverride,
    diagnose,
    state
  };

})(window);
