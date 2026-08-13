/**
 * RainGuard AI V39
 * Phase 39A-15F6N2 — Recovered Identity -> Historical Backfill Integration Bridge
 * Version: 39A.15F6N2.0
 */
(function (global) {
  "use strict";

  const PHASE = "39A-15F6N2";
  const VERSION = "39A.15F6N2.0";
  const BUILD = "rainguard-v39-recovered-identity-historical-backfill-integration-bridge";

  if (global.__RainGuardRecoveredIdentityHistoricalBackfillIntegrationBridgeInstalled) return;
  global.__RainGuardRecoveredIdentityHistoricalBackfillIntegrationBridgeInstalled = true;

  const DEFAULTS = {
    maxRecoveredObservations: 20000,
    maxRecoveredIdentities: 5000,
    maxAliasesPerIdentity: 128,
    runN1IfNeeded: true,
    runHistoricalBackfillAfterIntegration: false,
    preserveExistingPersistentIdentities: true,
    maxSamples: 20
  };

  const now = () => Date.now();
  const isObject = v => !!v && typeof v === "object";
  const isPlain = v => isObject(v) && !Array.isArray(v) && !(v instanceof Map) && !(v instanceof Set);

  function safeString(v) {
    if (v === null || v === undefined) return "";
    if (typeof v === "string") return v.trim();
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
    return "";
  }

  function norm(v) {
    return safeString(v).replace(/[\u200e\u200f]/g, "").trim().replace(/\s+/g, " ").toLowerCase();
  }

  function clone(v) {
    if (v === null || v === undefined) return v;
    try {
      if (typeof structuredClone === "function") return structuredClone(v);
    } catch (_) {}
    try { return JSON.parse(JSON.stringify(v)); } catch (_) {}
    if (Array.isArray(v)) return v.slice();
    if (isPlain(v)) return Object.assign({}, v);
    return v;
  }

  function toArray(v) {
    if (Array.isArray(v)) return v.slice();
    if (v instanceof Map || v instanceof Set) return Array.from(v.values());
    if (isPlain(v)) {
      for (const k of ["identities","records","observations","items","values"]) {
        if (Array.isArray(v[k])) return v[k].slice();
      }
      return Object.values(v).filter(isObject);
    }
    return [];
  }

  function persistentIdOf(r) {
    if (!r) return "";
    const vals = [
      r.persistentId, r.recoveredPersistentId, r.canonicalTrackId, r.canonicalId,
      r.identityKey, r.trackId, r.cellId, r.stormId, r.entityId, r.identity, r.id
    ];
    for (const v of vals) {
      if (typeof v === "string" || typeof v === "number") {
        const s = safeString(v);
        if (s) return s;
      }
    }
    return "";
  }

  function getRecoveredObservations() {
    const roots = [
      global.RainGuardRecoveredHistoricalObservationsV39,
      global.RainGuardHistoricalObservationIdentityKeyRecoveryV39 &&
        global.RainGuardHistoricalObservationIdentityKeyRecoveryV39.recoveredObservations
    ];
    for (const root of roots) {
      const arr = toArray(root);
      if (arr.length) return arr;
    }
    return [];
  }

  function aliasesOf(r, id, limit) {
    const out = [];
    const seen = new Set();

    function add(v) {
      const s = safeString(v), k = norm(s);
      if (!k || seen.has(k)) return;
      seen.add(k); out.push(s);
    }

    add(id);
    for (const k of [
      "persistentId","recoveredPersistentId","canonicalTrackId","canonicalId",
      "trackId","cellId","stormId","entityId","identityKey","identity","id"
    ]) add(r && r[k]);

    for (const k of ["aliases","trackAliases","identityAliases","sourceAliases","historicalAliases"]) {
      const v = r && r[k];
      if (Array.isArray(v)) {
        for (const item of v) {
          if (typeof item === "string" || typeof item === "number") add(item);
          else if (isPlain(item)) {
            add(item.alias); add(item.id); add(item.trackId); add(item.cellId); add(item.persistentId);
          }
        }
      }
    }

    if (r && isPlain(r.identityRecovery) && Array.isArray(r.identityRecovery.evidence)) {
      for (const e of r.identityRecovery.evidence) {
        if (isPlain(e)) { add(e.alias); add(e.identityKey); }
      }
    }
    return out.slice(0, limit);
  }

  function latOf(r) {
    const vals = [r && r.latitude, r && r.lat, r && r.coordinate && r.coordinate.latitude, r && r.coordinate && r.coordinate.lat];
    for (const v of vals) {
      const n = Number(v);
      if (Number.isFinite(n) && n >= -90 && n <= 90) return n;
    }
    return null;
  }

  function lonOf(r) {
    const vals = [r && r.longitude, r && r.lon, r && r.lng, r && r.coordinate && r.coordinate.longitude, r && r.coordinate && r.coordinate.lon, r && r.coordinate && r.coordinate.lng];
    for (const v of vals) {
      const n = Number(v);
      if (Number.isFinite(n) && n >= -180 && n <= 180) return n;
    }
    return null;
  }

  function timeOf(r) {
    for (const k of ["observedAt","timestamp","time","ts","accumulatedAt","createdAt","updatedAt"]) {
      const v = r && r[k];
      if (v === null || v === undefined) continue;
      if (typeof v === "number" && Number.isFinite(v)) return v < 1e12 ? v * 1000 : v;
      const p = Date.parse(v);
      if (Number.isFinite(p)) return p;
    }
    return null;
  }

  function buildRecoveredIdentities(observations, cfg) {
    const map = new Map();

    for (const obs of observations.slice(0, cfg.maxRecoveredObservations)) {
      if (!isObject(obs)) continue;
      const id = persistentIdOf(obs);
      const key = norm(id);
      if (!key) continue;

      let identity = map.get(key);
      if (!identity) {
        identity = {
          persistentId: id,
          canonicalTrackId: id,
          id: id,
          aliases: [],
          observations: [],
          observationCount: 0,
          firstSeenAt: null,
          lastSeenAt: null,
          latitude: null,
          longitude: null,
          source: "39A-15F6N1",
          phase: PHASE,
          version: VERSION,
          recoveredFromHistoricalObservationKeys: true
        };
        map.set(key, identity);
      }

      const aliasSet = new Set(identity.aliases.map(norm));
      for (const a of aliasesOf(obs, id, cfg.maxAliasesPerIdentity)) {
        const ak = norm(a);
        if (!ak || aliasSet.has(ak)) continue;
        aliasSet.add(ak);
        identity.aliases.push(a);
      }

      identity.observations.push(clone(obs));
      identity.observationCount += 1;

      const t = timeOf(obs);
      if (t !== null) {
        identity.firstSeenAt = identity.firstSeenAt === null ? t : Math.min(identity.firstSeenAt, t);
        identity.lastSeenAt = identity.lastSeenAt === null ? t : Math.max(identity.lastSeenAt, t);
      }

      const lat = latOf(obs), lon = lonOf(obs);
      if (lat !== null && lon !== null && !(lat === 0 && lon === 0)) {
        identity.latitude = lat;
        identity.longitude = lon;
        identity.coordinate = { latitude: lat, longitude: lon };
      }
    }

    return Array.from(map.values()).slice(0, cfg.maxRecoveredIdentities);
  }

  function existingIdentities() {
    return toArray(global.RainGuardPersistentStormIdentitiesV39).filter(isObject);
  }

  function mergeIdentities(existing, recovered, cfg) {
    const map = new Map();
    let inserted = 0, enriched = 0, preserved = 0;

    if (cfg.preserveExistingPersistentIdentities) {
      for (const item of existing) {
        const id = persistentIdOf(item), key = norm(id);
        if (!key) continue;
        map.set(key, clone(item));
        preserved++;
      }
    }

    for (const rec of recovered) {
      const id = persistentIdOf(rec), key = norm(id);
      if (!key) continue;
      const cur = map.get(key);

      if (!cur) {
        map.set(key, clone(rec));
        inserted++;
        continue;
      }

      const merged = clone(cur);
      const aliases = Array.isArray(merged.aliases) ? merged.aliases.slice() : [];
      const seen = new Set(aliases.map(norm));
      for (const a of (rec.aliases || [])) {
        const ak = norm(a);
        if (ak && !seen.has(ak)) { seen.add(ak); aliases.push(a); }
      }
      merged.aliases = aliases.slice(0, cfg.maxAliasesPerIdentity);

      const curObs = Array.isArray(merged.observations) ? merged.observations.slice() : [];
      const recObs = Array.isArray(rec.observations) ? rec.observations : [];
      merged.observations = curObs.concat(recObs).slice(-5000);
      merged.observationCount = merged.observations.length;

      if ((merged.latitude === null || merged.latitude === undefined) && rec.latitude != null) merged.latitude = rec.latitude;
      if ((merged.longitude === null || merged.longitude === undefined) && rec.longitude != null) merged.longitude = rec.longitude;
      if (!merged.coordinate && rec.coordinate) merged.coordinate = clone(rec.coordinate);

      merged.recoveredHistoricalIntegration = { phase: PHASE, version: VERSION, integratedAt: now() };
      map.set(key, merged);
      enriched++;
    }

    return { identities: Array.from(map.values()), inserted, enriched, preserved };
  }

  function publish(identities, recoveredObservations, cfg) {
    const aliasMap = new Map();
    const byId = new Map();

    for (const identity of identities) {
      const id = persistentIdOf(identity);
      const key = norm(id);
      if (!key) continue;
      byId.set(key, identity);
      for (const alias of aliasesOf(identity, id, cfg.maxAliasesPerIdentity)) {
        const ak = norm(alias);
        if (ak && !aliasMap.has(ak)) aliasMap.set(ak, id);
      }
    }

    global.RainGuardPersistentStormIdentitiesV39 = identities;
    global.RainGuardRecoveredPersistentStormIdentitiesV39 = identities;
    global.RainGuardHistoricalBackfillPersistentIdentitiesV39 = identities;
    global.RainGuardRecoveredHistoricalObservationsV39 = recoveredObservations;
    global.RainGuardRecoveredHistoricalIdentityAliasMapV39 = aliasMap;
    global.RainGuardPersistentIdentityByIdV39 = byId;

    return { aliasMap, byId };
  }

  async function maybeRunN1(cfg) {
    let recovered = getRecoveredObservations();
    if (recovered.length || !cfg.runN1IfNeeded) return { invoked: false, recovered };

    if (typeof global.runRainGuardHistoricalObservationIdentityKeyRecoveryBridge !== "function") {
      return { invoked: false, recovered: [] };
    }

    await global.runRainGuardHistoricalObservationIdentityKeyRecoveryBridge();
    recovered = getRecoveredObservations();
    return { invoked: true, recovered };
  }

  async function maybeRunBackfill(cfg) {
    if (!cfg.runHistoricalBackfillAfterIntegration) return { invoked: false, result: null };

    if (typeof global.runRainGuardHistoricalObservationPersistentIdentityBackfillBridge === "function") {
      try {
        const result = await global.runRainGuardHistoricalObservationPersistentIdentityBackfillBridge();
        return { invoked: true, result };
      } catch (e) {
        return { invoked: true, result: null, error: e && e.message ? e.message : String(e) };
      }
    }
    return { invoked: false, result: null };
  }

  async function run(options) {
    const started = now();
    const cfg = Object.assign({}, DEFAULTS, isPlain(options) ? options : {});

    try {
      const n1 = await maybeRunN1(cfg);
      const recoveredObs = n1.recovered.filter(isObject).slice(0, cfg.maxRecoveredObservations);
      const recoveredIdentities = buildRecoveredIdentities(recoveredObs, cfg);
      const existing = existingIdentities();
      const merged = mergeIdentities(existing, recoveredIdentities, cfg);
      const compatibility = publish(merged.identities, recoveredObs, cfg);

      const multiPointIdentityCount = merged.identities.filter(i =>
        (Array.isArray(i.observations) && i.observations.length >= 2) ||
        Number(i.observationCount) >= 2
      ).length;

      const singlePointIdentityCount = merged.identities.length - multiPointIdentityCount;
      const backfill = await maybeRunBackfill(cfg);

      let status = "RECOVERED_IDENTITIES_INTEGRATED_FOR_HISTORICAL_BACKFILL";
      if (!recoveredObs.length) status = "NO_RECOVERED_HISTORICAL_OBSERVATIONS_FOUND";
      else if (!recoveredIdentities.length) status = "RECOVERED_OBSERVATIONS_FOUND_BUT_NO_IDENTITY_GROUPS";
      else if (merged.identities.length <= 1) status = "RECOVERED_IDENTITIES_INTEGRATED_SINGLE_IDENTITY";

      const result = {
        success: true,
        phase: PHASE,
        version: VERSION,
        build: BUILD,
        status,
        generatedAt: now(),
        durationMs: now() - started,
        n1Invoked: n1.invoked,
        recoveredObservationCount: recoveredObs.length,
        recoveredIdentityCount: recoveredIdentities.length,
        existingPersistentIdentityCount: existing.length,
        mergedPersistentIdentityCount: merged.identities.length,
        insertedRecoveredIdentityCount: merged.inserted,
        enrichedExistingIdentityCount: merged.enriched,
        preservedExistingIdentityCount: merged.preserved,
        multiPointIdentityCount,
        singlePointIdentityCount,
        compatibilityAliasCount: compatibility.aliasMap.size,
        compatibilityIdentityIndexCount: compatibility.byId.size,
        backfillInvoked: backfill.invoked,
        backfillStatus: backfill.result && backfill.result.status ? backfill.result.status : null,
        identitySample: merged.identities.slice(0, cfg.maxSamples),
        recoveredObservationSample: recoveredObs.slice(0, cfg.maxSamples)
      };

      global.RainGuardRecoveredIdentityHistoricalBackfillIntegrationV39 = {
        phase: PHASE,
        version: VERSION,
        build: BUILD,
        identities: merged.identities,
        recoveredObservations: recoveredObs,
        aliasMap: compatibility.aliasMap,
        identityIndex: compatibility.byId,
        lastResult: result
      };

      global.RainGuardRecoveredIdentityHistoricalBackfillIntegrationLastResult = result;

      console.log(`[RainGuard Phase ${PHASE}] Recovered Identity -> Historical Backfill Integration result:`);
      console.log(result);
      return result;

    } catch (error) {
      const result = {
        success: false,
        phase: PHASE,
        version: VERSION,
        build: BUILD,
        status: "RECOVERED_IDENTITY_HISTORICAL_BACKFILL_INTEGRATION_FAILED",
        generatedAt: now(),
        durationMs: now() - started,
        error: error && error.message ? error.message : String(error)
      };
      global.RainGuardRecoveredIdentityHistoricalBackfillIntegrationLastResult = result;
      console.error(`[RainGuard Phase ${PHASE}] failed:`, error);
      return result;
    }
  }

  function diagnose() {
    const state = global.RainGuardRecoveredIdentityHistoricalBackfillIntegrationV39;
    const diagnostic = {
      success: true,
      phase: PHASE,
      version: VERSION,
      build: BUILD,
      installed: true,
      hasRunner: typeof global.runRainGuardRecoveredIdentityHistoricalBackfillIntegrationBridge === "function",
      hasN1Runner: typeof global.runRainGuardHistoricalObservationIdentityKeyRecoveryBridge === "function",
      hasBackfillRunner: typeof global.runRainGuardHistoricalObservationPersistentIdentityBackfillBridge === "function",
      recoveredHistoricalObservationCount: getRecoveredObservations().length,
      persistentIdentityCount: existingIdentities().length,
      integrationStateReady: !!state,
      lastResult: state && state.lastResult ? state.lastResult : null
    };
    console.log(`[RainGuard Phase ${PHASE}] Diagnostic:`);
    console.log(diagnostic);
    return diagnostic;
  }

  global.runRainGuardRecoveredIdentityHistoricalBackfillIntegrationBridge = run;
  global.diagnoseRainGuardRecoveredIdentityHistoricalBackfillIntegrationBridge = diagnose;

  global.RainGuardRecoveredIdentityHistoricalBackfillIntegrationBridgeV39 = {
    phase: PHASE,
    version: VERSION,
    build: BUILD,
    installed: true,
    run,
    diagnose
  };

})(window);
