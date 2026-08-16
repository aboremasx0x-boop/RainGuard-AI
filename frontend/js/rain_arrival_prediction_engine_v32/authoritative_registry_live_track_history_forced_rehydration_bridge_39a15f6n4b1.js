/**
 * RainGuard AI V39
 * Phase 39A-15F6N4B1 — Authoritative Registry + Live Track History Forced Rehydration Bridge
 * Version: 39A.15F6N4B1.0
 *
 * Goal:
 *  1) FORCE the authoritative/integrated registry as the identity source.
 *  2) FORCE RainArrivalLiveTrackHistory (or compatible live history stores) as the temporal source.
 *  3) Match history records back to authoritative identities using exact aliases first,
 *     then safe track/cell identity keys.
 *  4) Rebuild chronological observations[] per identity.
 *  5) Publish the rehydrated authoritative registry back to the runtime.
 *
 * Public API:
 *   window.runRainGuardAuthoritativeLiveTrackHistoryForcedRehydrationBridge(options?)
 *   window.diagnoseRainGuardAuthoritativeLiveTrackHistoryForcedRehydrationBridge()
 */

(function installBridge(global) {
  "use strict";

  const PHASE = "39A-15F6N4B1";
  const VERSION = "39A.15F6N4B1.0";
  const BUILD = "rainguard-v39-authoritative-live-track-history-forced-rehydration-bridge";

  if (global.__RainGuardAuthoritativeLiveTrackHistoryForcedRehydrationBridgeInstalled) return;
  global.__RainGuardAuthoritativeLiveTrackHistoryForcedRehydrationBridgeInstalled = true;

  const CFG = Object.freeze({
    maxIdentities: 6000,
    maxHistoryRecords: 30000,
    maxObservationsPerIdentity: 48,
    minTimeDeltaMs: 1000,
    coordinatePrecision: 5,
    persistToLocalStorage: true
  });

  const state = {
    installed: true,
    running: false,
    lastRun: null,
    lastError: null
  };

  const now = () => Date.now();
  const isObj = v => !!v && typeof v === "object";
  const str = v => v == null ? "" : String(v).trim();
  const norm = v => str(v).toLowerCase().replace(/\s+/g, " ").trim();

  function finite(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function parseTime(v) {
    if (v == null) return null;
    if (typeof v === "number" && Number.isFinite(v)) {
      return v < 1e12 ? v * 1000 : v;
    }
    const t = Date.parse(v);
    return Number.isFinite(t) ? t : null;
  }

  function timeOf(r) {
    if (!isObj(r)) return null;
    for (const k of [
      "observedAt","timestamp","time","ts","capturedAt",
      "accumulatedAt","generatedAt","updatedAt","createdAt"
    ]) {
      const t = parseTime(r[k]);
      if (t != null) return t;
    }
    return null;
  }

  function coordOf(r) {
    if (!isObj(r)) return null;

    let lat = null, lon = null;

    for (const k of ["latitude","lat"]) {
      const n = finite(r[k]);
      if (n != null) { lat = n; break; }
    }
    for (const k of ["longitude","lon","lng"]) {
      const n = finite(r[k]);
      if (n != null) { lon = n; break; }
    }

    for (const boxName of ["coordinate","coordinates","position","center","centroid"]) {
      const box = r[boxName];
      if (!isObj(box)) continue;
      lat = lat ?? finite(box.latitude ?? box.lat);
      lon = lon ?? finite(box.longitude ?? box.lon ?? box.lng);
    }

    if (lat == null || lon == null) return null;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
    if (lat === 0 && lon === 0) return null;

    return { latitude: lat, longitude: lon };
  }

  function keyOf(r) {
    if (!isObj(r)) return "";
    for (const k of [
      "persistentId","canonicalPersistentId","recoveredPersistentId",
      "canonicalTrackId","canonicalId","identityKey","recoveredIdentityKey",
      "identity","trackId","cellId","stormId","entityId","id"
    ]) {
      const v = str(r[k]);
      if (v) return v;
    }
    return "";
  }

  function aliasesOf(r) {
    const out = new Set();
    const add = v => { const n = norm(v); if (n) out.add(n); };

    if (!isObj(r)) return out;

    add(keyOf(r));

    for (const k of [
      "persistentId","canonicalPersistentId","recoveredPersistentId",
      "canonicalTrackId","canonicalId","identityKey","recoveredIdentityKey",
      "identity","trackId","cellId","stormId","entityId","id","name"
    ]) add(r[k]);

    for (const k of [
      "aliases","identityAliases","trackAliases","historicalAliases",
      "sourceAliases","candidateAliases"
    ]) {
      const arr = r[k];
      if (!Array.isArray(arr)) continue;
      for (const a of arr) {
        if (typeof a === "string" || typeof a === "number") {
          add(a);
        } else if (isObj(a)) {
          for (const q of [
            "alias","id","trackId","cellId","persistentId","identity",
            "stormId","entityId","canonicalId","identityKey"
          ]) add(a[q]);
        }
      }
    }

    return out;
  }

  function arrayFrom(v) {
    if (!v) return [];
    if (Array.isArray(v)) return v;
    if (v instanceof Map || v instanceof Set) return Array.from(v.values());

    if (isObj(v)) {
      for (const k of [
        "identities","authoritativeIdentities","integratedIdentities",
        "persistentIdentities","records","items","data","entities","tracks"
      ]) {
        const x = v[k];
        if (Array.isArray(x)) return x;
        if (x instanceof Map || x instanceof Set) return Array.from(x.values());
      }
    }
    return [];
  }

  function resolveAuthoritativeRegistry() {
    // Intentionally strict priority. Do NOT let the legacy 87-record registry win.
    const names = [
      "RainGuardAuthoritativePersistentStormIdentitiesV39",
      "RainGuardPublishedAuthoritativePersistentStormIdentitiesV39",
      "RainGuardIntegratedPersistentStormIdentitiesV39",
      "RainGuardIntegratedIdentityPersistentRegistryV39",
      "RainGuardIntegratedPersistentIdentityRegistryV39"
    ];

    const candidates = [];

    for (const name of names) {
      try {
        const value = global[name];
        const ids = arrayFrom(value);
        if (ids.length) candidates.push({ name, value, identities: ids });
      } catch (_) {}
    }

    // Pick the largest authoritative-compatible source.
    candidates.sort((a,b) => b.identities.length - a.identities.length);

    return candidates[0] || { name:null, value:null, identities:[] };
  }

  function flattenHistoryContainer(value, sourceName, limit) {
    const rows = [];

    function pushRecord(rec, inheritedId) {
      if (!isObj(rec) || rows.length >= limit) return;

      const id = keyOf(rec) || inheritedId || "";
      const c = coordOf(rec);
      const t = timeOf(rec);

      if (c && t != null) {
        rows.push({
          ...rec,
          identity: rec.identity ?? id ?? null,
          trackId: rec.trackId ?? null,
          latitude: c.latitude,
          longitude: c.longitude,
          observedAt: t,
          timestamp: t,
          __rehydrationSource: sourceName
        });
      }

      for (const k of ["observations","history","points","records","samples","frames"]) {
        const arr = rec[k];
        if (!Array.isArray(arr)) continue;
        for (const child of arr) {
          if (rows.length >= limit) break;
          pushRecord(child, id);
        }
      }
    }

    if (value instanceof Map) {
      for (const [k,v] of value.entries()) {
        if (rows.length >= limit) break;
        if (Array.isArray(v)) {
          for (const rec of v) {
            if (rows.length >= limit) break;
            pushRecord(rec, str(k));
          }
        } else {
          pushRecord(v, str(k));
        }
      }
      return rows;
    }

    if (Array.isArray(value)) {
      for (const rec of value) {
        if (rows.length >= limit) break;
        pushRecord(rec, "");
      }
      return rows;
    }

    if (isObj(value)) {
      // Important: RainArrivalLiveTrackHistory may store each identity under object properties.
      let handled = false;

      for (const k of ["records","items","data","history","observations","tracks","entities"]) {
        const x = value[k];
        if (Array.isArray(x)) {
          handled = true;
          for (const rec of x) {
            if (rows.length >= limit) break;
            pushRecord(rec, "");
          }
        } else if (x instanceof Map) {
          handled = true;
          for (const [id, arr] of x.entries()) {
            if (rows.length >= limit) break;
            if (Array.isArray(arr)) {
              for (const rec of arr) {
                if (rows.length >= limit) break;
                pushRecord(rec, str(id));
              }
            } else {
              pushRecord(arr, str(id));
            }
          }
        }
      }

      // Scan enumerable identity-keyed properties.
      if (!handled || rows.length < limit) {
        for (const [k,v] of Object.entries(value)) {
          if (rows.length >= limit) break;
          if (Array.isArray(v)) {
            for (const rec of v) {
              if (rows.length >= limit) break;
              pushRecord(rec, str(k));
            }
          }
        }
      }
    }

    return rows;
  }

  function resolveLiveHistory() {
    // Force the actual live history first.
    const preferred = [
      "RainArrivalLiveTrackHistory",
      "RainGuardLiveTrackHistory",
      "RainGuardRecoveredLiveTrackHistoryV39"
    ];

    const candidates = [];

    for (const name of preferred) {
      try {
        const value = global[name];
        if (!value) continue;
        const rows = flattenHistoryContainer(value, name, CFG.maxHistoryRecords);
        if (rows.length) candidates.push({ name, value, rows });
      } catch (_) {}
    }

    // Only if preferred sources yield nothing, scan compatible runtime names.
    if (!candidates.length) {
      try {
        for (const name of Object.keys(global).slice(0, 3500)) {
          const n = name.toLowerCase();
          if (!(n.includes("livetrackhistory") || (n.includes("live") && n.includes("track") && n.includes("history")))) continue;
          const value = global[name];
          const rows = flattenHistoryContainer(value, name, CFG.maxHistoryRecords);
          if (rows.length) candidates.push({ name, value, rows });
        }
      } catch (_) {}
    }

    candidates.sort((a,b) => b.rows.length - a.rows.length);
    return candidates[0] || { name:null, value:null, rows:[] };
  }

  function observationKey(r, precision) {
    const c = coordOf(r);
    const t = timeOf(r);
    if (!c || t == null) return "";
    return [
      Math.round(t / 1000),
      c.latitude.toFixed(precision),
      c.longitude.toFixed(precision)
    ].join("|");
  }

  function chronologicalUnique(rows, maxPerIdentity) {
    const seen = new Set();
    const out = [];

    rows
      .filter(r => coordOf(r) && timeOf(r) != null)
      .sort((a,b) => timeOf(a) - timeOf(b))
      .forEach(r => {
        const k = observationKey(r, CFG.coordinatePrecision);
        if (!k || seen.has(k)) return;
        seen.add(k);

        const c = coordOf(r);
        const t = timeOf(r);

        out.push({
          ...r,
          latitude: c.latitude,
          longitude: c.longitude,
          observedAt: t,
          timestamp: t
        });
      });

    return out.slice(-maxPerIdentity);
  }

  function uniqueCoordCount(rows) {
    const set = new Set();
    for (const r of rows) {
      const c = coordOf(r);
      if (!c) continue;
      set.add(`${c.latitude.toFixed(CFG.coordinatePrecision)},${c.longitude.toFixed(CFG.coordinatePrecision)}`);
    }
    return set.size;
  }

  function buildAliasIndex(identities) {
    const index = new Map();

    identities.forEach((identity, i) => {
      for (const alias of aliasesOf(identity)) {
        if (!index.has(alias)) index.set(alias, new Set());
        index.get(alias).add(i);
      }
    });

    return index;
  }

  function matchHistory(identities, historyRows) {
    const aliasIndex = buildAliasIndex(identities);
    const buckets = new Map();

    let exactAliasMatchCount = 0;
    let ambiguousAliasCount = 0;
    let unmatchedHistoryRecordCount = 0;

    for (const row of historyRows) {
      const hits = new Set();

      for (const alias of aliasesOf(row)) {
        const indexes = aliasIndex.get(alias);
        if (!indexes) continue;
        for (const idx of indexes) hits.add(idx);
      }

      if (hits.size === 1) {
        const idx = Array.from(hits)[0];
        if (!buckets.has(idx)) buckets.set(idx, []);
        buckets.get(idx).push(row);
        exactAliasMatchCount++;
      } else if (hits.size > 1) {
        ambiguousAliasCount++;
      } else {
        unmatchedHistoryRecordCount++;
      }
    }

    return {
      buckets,
      exactAliasMatchCount,
      ambiguousAliasCount,
      unmatchedHistoryRecordCount
    };
  }

  function publish(originalRegistry, identities) {
    global.RainGuardAuthoritativePersistentStormIdentitiesV39 = identities;
    global.RainGuardPublishedAuthoritativePersistentStormIdentitiesV39 = identities;
    global.RainGuardIntegratedPersistentStormIdentitiesV39 = identities;
    global.RainGuardIntegratedIdentityPersistentRegistryV39 = identities;
    global.RainGuardIntegratedPersistentIdentityRegistryV39 = identities;
    global.RainGuardPersistentIdentityRegistryV39 = identities;

    // Keep legacy name synchronized only after authoritative rehydration.
    global.RainGuardPersistentStormIdentitiesV39 = identities;

    if (isObj(originalRegistry) && !Array.isArray(originalRegistry)) {
      try {
        originalRegistry.identities = identities;
        originalRegistry.records = identities;
        originalRegistry.identityCount = identities.length;
        originalRegistry.observationCount = identities.reduce((n,r)=>n+Number(r.observationCount||0),0);
        originalRegistry.updatedAt = now();
      } catch (_) {}
    }
  }

  async function run(options) {
    const started = now();

    if (state.running) {
      return {
        success:false,
        phase:PHASE,
        version:VERSION,
        build:BUILD,
        status:"FORCED_REHYDRATION_ALREADY_RUNNING"
      };
    }

    state.running = true;

    try {
      const cfg = Object.assign({}, CFG, isObj(options) ? options : {});

      const registry = resolveAuthoritativeRegistry();
      if (!registry.identities.length) {
        const result = {
          success:false,
          phase:PHASE,
          version:VERSION,
          build:BUILD,
          status:"NO_AUTHORITATIVE_REGISTRY_FOUND",
          generatedAt:now(),
          durationMs:now()-started
        };
        state.lastRun = result;
        return result;
      }

      const history = resolveLiveHistory();
      if (!history.rows.length) {
        const result = {
          success:false,
          phase:PHASE,
          version:VERSION,
          build:BUILD,
          status:"NO_LIVE_TRACK_HISTORY_FOUND",
          authoritativeRegistrySource:registry.name,
          authoritativeIdentityCount:registry.identities.length,
          generatedAt:now(),
          durationMs:now()-started
        };
        state.lastRun = result;
        return result;
      }

      const identities = registry.identities.slice(0, cfg.maxIdentities);
      const historyRows = history.rows.slice(0, cfg.maxHistoryRecords);

      const matched = matchHistory(identities, historyRows);

      let observationsAddedCount = 0;
      let identitiesWithNewObservations = 0;
      let multiPointBefore = 0;
      let multiPointAfter = 0;
      let coordinateChangingIdentityCount = 0;
      let maxUniqueCoordinatesPerIdentity = 0;

      const updated = identities.map((identity, idx) => {
        const oldRows = [];

        if (Array.isArray(identity.observations)) oldRows.push(...identity.observations);
        if (Array.isArray(identity.history)) oldRows.push(...identity.history);

        const oldUnique = chronologicalUnique(oldRows, cfg.maxObservationsPerIdentity);
        if (oldUnique.length > 1) multiPointBefore++;

        const incoming = matched.buckets.get(idx) || [];
        const merged = chronologicalUnique(
          [...oldUnique, ...incoming],
          cfg.maxObservationsPerIdentity
        );

        const oldKeys = new Set(oldUnique.map(r => observationKey(r, CFG.coordinatePrecision)));
        const added = merged.filter(r => !oldKeys.has(observationKey(r, CFG.coordinatePrecision))).length;

        if (added > 0) {
          observationsAddedCount += added;
          identitiesWithNewObservations++;
        }

        const ucc = uniqueCoordCount(merged);

        if (merged.length > 1) multiPointAfter++;
        if (ucc > 1) coordinateChangingIdentityCount++;
        maxUniqueCoordinatesPerIdentity = Math.max(maxUniqueCoordinatesPerIdentity, ucc);

        return {
          ...identity,
          observations: merged,
          history: merged,
          observationCount: merged.length,
          uniqueCoordinateCount: ucc,
          firstObservedAt: merged.length ? timeOf(merged[0]) : identity.firstObservedAt ?? null,
          lastObservedAt: merged.length ? timeOf(merged[merged.length - 1]) : identity.lastObservedAt ?? null,
          rehydratedFrom: history.name,
          rehydratedAt: now(),
          rehydratedBy: PHASE
        };
      });

      publish(registry.value, updated);

      let persistedToLocalStorage = false;
      if (cfg.persistToLocalStorage) {
        try {
          localStorage.setItem(
            "RainGuardAuthoritativePersistentRegistryRehydratedV39",
            JSON.stringify({
              phase:PHASE,
              version:VERSION,
              generatedAt:now(),
              authoritativeRegistrySource:registry.name,
              liveTrackHistorySource:history.name,
              identities:updated
            })
          );
          persistedToLocalStorage = true;
        } catch (_) {}
      }

      const totalObservationCount = updated.reduce(
        (n,r)=>n+Number(r.observationCount||0), 0
      );

      const functionalPass =
        updated.length > 1 &&
        historyRows.length > 0 &&
        observationsAddedCount > 0 &&
        multiPointAfter > 1 &&
        coordinateChangingIdentityCount > 0 &&
        maxUniqueCoordinatesPerIdentity > 1;

      const result = {
        success:true,
        functionalPass,
        phase:PHASE,
        version:VERSION,
        build:BUILD,
        status:functionalPass
          ? "AUTHORITATIVE_REGISTRY_LIVE_HISTORY_REHYDRATED"
          : "AUTHORITATIVE_REGISTRY_REHYDRATED_BUT_TEMPORAL_CHANGE_STILL_INSUFFICIENT",

        authoritativeRegistrySource:registry.name,
        authoritativeIdentityCount:updated.length,

        liveTrackHistorySource:history.name,
        liveTrackHistoryCount:historyRows.length,

        exactAliasMatchCount:matched.exactAliasMatchCount,
        ambiguousAliasCount:matched.ambiguousAliasCount,
        unmatchedHistoryRecordCount:matched.unmatchedHistoryRecordCount,

        identitiesWithNewObservations,
        observationsAddedCount,
        totalObservationCount,

        multiPointIdentityCountBefore:multiPointBefore,
        multiPointIdentityCount:multiPointAfter,
        coordinateChangingIdentityCount,
        maxUniqueCoordinatesPerIdentity,

        persistedToLocalStorage,
        generatedAt:now(),
        durationMs:now()-started,

        identitySample:updated.slice(0,20)
      };

      global.RainGuardAuthoritativeLiveTrackHistoryForcedRehydrationV39 = result;

      state.lastRun = result;
      state.lastError = null;

      console.log(`[RainGuard Phase ${PHASE}] Authoritative Registry + Live Track History Forced Rehydration result:`);
      console.log(result);

      return result;

    } catch (e) {
      const result = {
        success:false,
        phase:PHASE,
        version:VERSION,
        build:BUILD,
        status:"AUTHORITATIVE_LIVE_HISTORY_FORCED_REHYDRATION_FAILED",
        error:e && e.message ? e.message : String(e),
        generatedAt:now(),
        durationMs:now()-started
      };

      state.lastRun = result;
      state.lastError = result.error;

      console.error(`[RainGuard Phase ${PHASE}] failed:`, e);
      return result;

    } finally {
      state.running = false;
    }
  }

  function diagnose() {
    const registry = resolveAuthoritativeRegistry();
    const history = resolveLiveHistory();

    const result = {
      success:true,
      phase:PHASE,
      version:VERSION,
      build:BUILD,
      installed:true,
      running:state.running,

      authoritativeRegistrySource:registry.name,
      authoritativeIdentityCount:registry.identities.length,

      liveTrackHistorySource:history.name,
      liveTrackHistoryCount:history.rows.length,

      lastRun:state.lastRun,
      lastError:state.lastError
    };

    console.log(`[RainGuard Phase ${PHASE}] Diagnostic:`, result);
    return result;
  }

  global.runRainGuardAuthoritativeLiveTrackHistoryForcedRehydrationBridge = run;
  global.diagnoseRainGuardAuthoritativeLiveTrackHistoryForcedRehydrationBridge = diagnose;

  global.RainGuardAuthoritativeLiveTrackHistoryForcedRehydrationBridgeV39 = {
    phase:PHASE,
    version:VERSION,
    build:BUILD,
    run,
    diagnose,
    state
  };

})(window);
