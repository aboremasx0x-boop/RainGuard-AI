/**
 * RainGuard AI V39
 * Phase 39A-15F6N4 — Integrated Identity Persistent Registry Bridge
 * Version: 39A.15F6N4.0
 *
 * الهدف:
 * - إنشاء Registry موحد للهويات المدمجة بعد N3/N3A/N.
 * - حفظ الهوية + aliases + observations + temporal metadata عبر الدورات.
 * - دمج المصادر المتعددة دون تضخيم السجلات.
 * - توفير مصدر authoritative ثابت للمراحل اللاحقة.
 *
 * Public API:
 *   window.runRainGuardIntegratedIdentityPersistentRegistryBridge(options?)
 *   window.diagnoseRainGuardIntegratedIdentityPersistentRegistryBridge()
 *   window.getRainGuardIntegratedIdentityPersistentRegistrySnapshot()
 */

(function installRainGuardIntegratedIdentityPersistentRegistryBridge(global) {
  "use strict";

  const PHASE = "39A-15F6N4";
  const VERSION = "39A.15F6N4.0";
  const BUILD = "rainguard-v39-integrated-identity-persistent-registry-bridge";

  if (global.__RainGuardIntegratedIdentityPersistentRegistryBridgeInstalled) return;
  global.__RainGuardIntegratedIdentityPersistentRegistryBridgeInstalled = true;

  const STORAGE_KEY = "RainGuardIntegratedIdentityPersistentRegistryV39";
  const STORAGE_VERSION = 1;

  const DEFAULTS = Object.freeze({
    maxIdentities: 5000,
    maxObservationsPerIdentity: 48,
    maxAliasesPerIdentity: 64,
    maxGlobalObservations: 30000,
    persistToLocalStorage: true,
    restoreFromLocalStorage: true,
    minimumIdentityCountForReady: 2
  });

  const state = {
    running: false,
    installedAt: Date.now(),
    lastRun: null,
    lastError: null,
    loadedFromStorage: false
  };

  const registry = {
    version: STORAGE_VERSION,
    identities: new Map(),
    aliasToPersistentId: new Map(),
    stats: {
      runs: 0,
      totalInputIdentities: 0,
      totalAcceptedIdentities: 0,
      totalMergedIdentities: 0,
      totalObservationsAccepted: 0,
      totalDuplicateObservations: 0,
      totalAliasesAccepted: 0,
      totalEvictedIdentities: 0,
      totalEvictedObservations: 0
    },
    createdAt: Date.now(),
    updatedAt: Date.now()
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

  function finite(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function ts(v) {
    if (v === null || v === undefined || v === "") return null;
    if (typeof v === "number" && Number.isFinite(v)) return v;
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) return n;
    const parsed = Date.parse(v);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function clone(v) {
    if (v === null || v === undefined) return v;
    try {
      if (typeof structuredClone === "function") return structuredClone(v);
    } catch (_) {}
    try { return JSON.parse(JSON.stringify(v)); } catch (_) { return v; }
  }

  function identityIdOf(record) {
    if (!isObj(record)) return "";
    const candidates = [
      record.persistentId,
      record.recoveredPersistentId,
      record.canonicalPersistentId,
      record.canonicalTrackId,
      record.identityKey,
      record.recoveredIdentityKey,
      record.identity,
      record.trackId,
      record.cellId,
      record.stormId,
      record.entityId,
      record.id
    ];
    for (const v of candidates) {
      const x = s(v);
      if (x) return x;
    }
    return "";
  }

  function observationTimeOf(obs) {
    if (!isObj(obs)) return null;
    const candidates = [
      obs.observedAt,
      obs.timestamp,
      obs.time,
      obs.ts,
      obs.createdAt,
      obs.accumulatedAt,
      obs.updatedAt
    ];
    for (const v of candidates) {
      const t = ts(v);
      if (t !== null) return t;
    }
    return null;
  }

  function coordinateOf(obs) {
    if (!isObj(obs)) return null;

    let lat = finite(obs.latitude);
    let lon = finite(obs.longitude);

    if (lat === null && isObj(obs.coordinate)) lat = finite(obs.coordinate.latitude ?? obs.coordinate.lat);
    if (lon === null && isObj(obs.coordinate)) lon = finite(obs.coordinate.longitude ?? obs.coordinate.lon ?? obs.coordinate.lng);

    if (lat === null) lat = finite(obs.lat);
    if (lon === null) lon = finite(obs.lon ?? obs.lng);

    if (lat === null || lon === null) return null;
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;

    return { latitude: lat, longitude: lon };
  }

  function observationKey(obs) {
    if (!isObj(obs)) return "";
    const t = observationTimeOf(obs);
    const c = coordinateOf(obs);
    const src = norm(obs.source || obs.provider || obs.phase || "");
    const track = norm(obs.trackId || obs.cellId || obs.identity || obs.persistentId || "");
    if (!c && t === null && !src && !track) {
      try { return JSON.stringify(obs); } catch (_) { return ""; }
    }
    return [
      t === null ? "" : t,
      c ? c.latitude.toFixed(5) : "",
      c ? c.longitude.toFixed(5) : "",
      src,
      track
    ].join("|");
  }

  function collectAliases(identity, canonicalId) {
    const out = new Set();
    const add = (v) => {
      const x = s(v);
      if (x) out.add(x);
    };

    add(canonicalId);

    const scalar = [
      "persistentId","recoveredPersistentId","canonicalPersistentId","canonicalTrackId",
      "identityKey","recoveredIdentityKey","identity","trackId","cellId","stormId","entityId","id"
    ];

    for (const k of scalar) add(identity[k]);

    const arrays = [
      "aliases","identityAliases","trackAliases","sourceAliases",
      "historicalAliases","candidateAliases"
    ];

    for (const k of arrays) {
      const arr = identity[k];
      if (!Array.isArray(arr)) continue;
      for (const item of arr) {
        if (typeof item === "string" || typeof item === "number") add(item);
        else if (isObj(item)) {
          add(item.alias);
          add(item.id);
          add(item.trackId);
          add(item.cellId);
          add(item.persistentId);
          add(item.identity);
        }
      }
    }

    return Array.from(out);
  }

  function collectObservations(identity) {
    if (!isObj(identity)) return [];

    const arrays = [
      identity.observations,
      identity.history,
      identity.temporalObservations,
      identity.historicalObservations,
      identity.points,
      identity.samples
    ];

    const out = [];
    for (const arr of arrays) {
      if (Array.isArray(arr)) out.push(...arr);
    }

    // بعض المصادر تمثل أحدث نقطة على مستوى الهوية نفسها
    if (!out.length && (coordinateOf(identity) || observationTimeOf(identity) !== null)) {
      out.push(identity);
    }

    return out.filter(isObj);
  }

  function sourceCandidateArrays() {
    const candidates = [];
    const add = (name, value, priority) => {
      if (!value) return;

      let arr = null;

      if (Array.isArray(value)) arr = value;
      else if (value instanceof Map || value instanceof Set) arr = Array.from(value.values());
      else if (isObj(value)) {
        const keys = [
          "identities","persistentIdentities","integratedIdentities","recoveredIdentities",
          "mergedIdentities","identityRecords","records","items"
        ];
        for (const k of keys) {
          const v = value[k];
          if (Array.isArray(v)) { arr = v; break; }
          if (v instanceof Map || v instanceof Set) { arr = Array.from(v.values()); break; }
        }
      }

      if (arr && arr.length) candidates.push({ name, priority, arr });
    };

    add("RainGuardAuthoritativePersistentStormIdentitiesV39", global.RainGuardAuthoritativePersistentStormIdentitiesV39, 100);
    add("RainGuardIntegratedPersistentStormIdentitiesV39", global.RainGuardIntegratedPersistentStormIdentitiesV39, 95);
    add("RainGuardRecoveredPersistentStormIdentitiesV39", global.RainGuardRecoveredPersistentStormIdentitiesV39, 90);
    add("RainGuardHistoricalBackfillPersistentIdentitiesV39", global.RainGuardHistoricalBackfillPersistentIdentitiesV39, 85);
    add("RainGuardRecoveredIdentityHistoricalBackfillIntegrationV39", global.RainGuardRecoveredIdentityHistoricalBackfillIntegrationV39, 80);
    add("RainGuardRecoveredIntegrationRuntimeSourceDiscoveryV39", global.RainGuardRecoveredIntegrationRuntimeSourceDiscoveryV39, 78);
    add("RainGuardPersistentStormIdentitiesV39", global.RainGuardPersistentStormIdentitiesV39, 75);

    return candidates.sort((a,b) => b.priority - a.priority);
  }

  function mergeObservationList(existing, incoming, maxCount) {
    const map = new Map();

    for (const obs of existing || []) {
      const key = observationKey(obs);
      if (key) map.set(key, obs);
    }

    let added = 0;
    let dup = 0;

    for (const raw of incoming || []) {
      const obs = clone(raw);
      const key = observationKey(obs);
      if (!key) continue;

      if (map.has(key)) {
        dup++;
        continue;
      }

      map.set(key, obs);
      added++;
    }

    let values = Array.from(map.values());

    values.sort((a,b) => {
      const ta = observationTimeOf(a) ?? 0;
      const tb = observationTimeOf(b) ?? 0;
      return ta - tb;
    });

    let evicted = 0;
    if (values.length > maxCount) {
      evicted = values.length - maxCount;
      values = values.slice(values.length - maxCount);
    }

    return { values, added, dup, evicted };
  }

  function resolveCanonicalId(identity, aliases) {
    const direct = identityIdOf(identity);
    if (direct) {
      const mapped = registry.aliasToPersistentId.get(norm(direct));
      if (mapped) return mapped;
    }

    for (const alias of aliases) {
      const mapped = registry.aliasToPersistentId.get(norm(alias));
      if (mapped) return mapped;
    }

    return direct;
  }

  function upsertIdentity(rawIdentity, cfg, sourceName) {
    if (!isObj(rawIdentity)) return { accepted: false, reason: "INVALID_IDENTITY" };

    const initialId = identityIdOf(rawIdentity);
    if (!initialId) return { accepted: false, reason: "NO_IDENTITY" };

    const aliases = collectAliases(rawIdentity, initialId);
    const canonicalId = resolveCanonicalId(rawIdentity, aliases) || initialId;
    const key = norm(canonicalId);

    let target = registry.identities.get(key);
    const isNew = !target;

    if (!target) {
      target = {
        persistentId: canonicalId,
        aliases: [],
        observations: [],
        sources: [],
        firstSeenAt: now(),
        lastSeenAt: now(),
        createdAt: now(),
        updatedAt: now(),
        observationCount: 0,
        uniqueCoordinateCount: 0,
        multiPoint: false,
        lastCoordinate: null,
        metadata: {}
      };
    }

    const aliasSet = new Set(target.aliases || []);
    let aliasesAdded = 0;

    for (const alias of aliases) {
      if (!aliasSet.has(alias) && aliasSet.size < cfg.maxAliasesPerIdentity) {
        aliasSet.add(alias);
        aliasesAdded++;
      }
      registry.aliasToPersistentId.set(norm(alias), target.persistentId);
    }

    target.aliases = Array.from(aliasSet);

    const sourceSet = new Set(target.sources || []);
    sourceSet.add(sourceName);
    target.sources = Array.from(sourceSet);

    const obsIncoming = collectObservations(rawIdentity);
    const obsMerge = mergeObservationList(target.observations, obsIncoming, cfg.maxObservationsPerIdentity);
    target.observations = obsMerge.values;

    const coordinateSet = new Set();
    for (const obs of target.observations) {
      const c = coordinateOf(obs);
      if (!c) continue;
      coordinateSet.add(`${c.latitude.toFixed(5)},${c.longitude.toFixed(5)}`);
    }

    target.observationCount = target.observations.length;
    target.uniqueCoordinateCount = coordinateSet.size;
    target.multiPoint = target.observationCount > 1;

    const lastObs = target.observations.length
      ? target.observations[target.observations.length - 1]
      : null;

    const lastCoord = coordinateOf(lastObs || rawIdentity);
    if (lastCoord) target.lastCoordinate = lastCoord;

    const firstTs = target.observations.length ? observationTimeOf(target.observations[0]) : null;
    const lastTs = target.observations.length ? observationTimeOf(target.observations[target.observations.length - 1]) : null;

    if (firstTs !== null) target.firstObservedAt = firstTs;
    if (lastTs !== null) target.lastObservedAt = lastTs;

    target.lastSeenAt = now();
    target.updatedAt = now();

    target.metadata = Object.assign(
      {},
      target.metadata || {},
      {
        lastSource: sourceName,
        identityType: rawIdentity.identityType || target.metadata?.identityType || null,
        trackId: rawIdentity.trackId || target.metadata?.trackId || null,
        cellId: rawIdentity.cellId || target.metadata?.cellId || null
      }
    );

    registry.identities.set(key, target);

    return {
      accepted: true,
      isNew,
      persistentId: target.persistentId,
      aliasesAdded,
      observationsAdded: obsMerge.added,
      duplicateObservations: obsMerge.dup,
      evictedObservations: obsMerge.evicted
    };
  }

  function evictIfNeeded(cfg) {
    if (registry.identities.size <= cfg.maxIdentities) return 0;

    const all = Array.from(registry.identities.entries());
    all.sort((a,b) => (a[1].updatedAt || 0) - (b[1].updatedAt || 0));

    const removeCount = registry.identities.size - cfg.maxIdentities;
    let removed = 0;

    for (let i = 0; i < removeCount; i++) {
      const [key, identity] = all[i];
      registry.identities.delete(key);

      for (const alias of identity.aliases || []) {
        const nk = norm(alias);
        if (registry.aliasToPersistentId.get(nk) === identity.persistentId) {
          registry.aliasToPersistentId.delete(nk);
        }
      }
      removed++;
    }

    registry.stats.totalEvictedIdentities += removed;
    return removed;
  }

  function enforceGlobalObservationLimit(cfg) {
    let total = 0;
    const rows = [];

    for (const [key, identity] of registry.identities.entries()) {
      const n = Array.isArray(identity.observations) ? identity.observations.length : 0;
      total += n;
      rows.push([key, identity]);
    }

    if (total <= cfg.maxGlobalObservations) return 0;

    rows.sort((a,b) => (a[1].updatedAt || 0) - (b[1].updatedAt || 0));

    let toRemove = total - cfg.maxGlobalObservations;
    let removed = 0;

    for (const [, identity] of rows) {
      if (toRemove <= 0) break;

      const obs = identity.observations || [];
      if (obs.length <= 1) continue;

      const canDrop = Math.min(toRemove, obs.length - 1);
      identity.observations = obs.slice(canDrop);
      identity.observationCount = identity.observations.length;

      removed += canDrop;
      toRemove -= canDrop;
    }

    registry.stats.totalEvictedObservations += removed;
    return removed;
  }

  function storageSafeSnapshot() {
    return {
      version: STORAGE_VERSION,
      createdAt: registry.createdAt,
      updatedAt: registry.updatedAt,
      stats: clone(registry.stats),
      identities: Array.from(registry.identities.values()).map(clone)
    };
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(storageSafeSnapshot()));
      return true;
    } catch (e) {
      state.lastError = `PERSIST_FAILED: ${e && e.message ? e.message : e}`;
      return false;
    }
  }

  function restore(cfg) {
    if (!cfg.restoreFromLocalStorage || state.loadedFromStorage) return { restored: 0 };

    state.loadedFromStorage = true;

    let parsed = null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { restored: 0 };
      parsed = JSON.parse(raw);
    } catch (e) {
      state.lastError = `RESTORE_FAILED: ${e && e.message ? e.message : e}`;
      return { restored: 0 };
    }

    const arr = parsed && Array.isArray(parsed.identities) ? parsed.identities : [];
    let restored = 0;

    for (const identity of arr.slice(0, cfg.maxIdentities)) {
      if (!identityIdOf(identity)) continue;

      const id = identityIdOf(identity);
      registry.identities.set(norm(id), identity);

      for (const alias of collectAliases(identity, id)) {
        registry.aliasToPersistentId.set(norm(alias), id);
      }

      restored++;
    }

    if (parsed && isObj(parsed.stats)) {
      registry.stats = Object.assign(registry.stats, parsed.stats);
    }

    if (parsed && parsed.createdAt) registry.createdAt = parsed.createdAt;
    registry.updatedAt = now();

    return { restored };
  }

  function publishGlobals() {
    const identities = Array.from(registry.identities.values());

    global.RainGuardIntegratedIdentityPersistentRegistryV39 = {
      phase: PHASE,
      version: VERSION,
      build: BUILD,
      identities,
      identityMap: registry.identities,
      aliasMap: registry.aliasToPersistentId,
      stats: registry.stats,
      createdAt: registry.createdAt,
      updatedAt: registry.updatedAt
    };

    global.RainGuardPersistentStormIdentityRegistryV39 = registry.identities;
    global.RainGuardPersistentStormIdentityAliasRegistryV39 = registry.aliasToPersistentId;
    global.RainGuardRegistryAuthoritativePersistentStormIdentitiesV39 = identities;

    // مصدر ثابت للمراحل اللاحقة
    global.RainGuardAuthoritativePersistentStormIdentitiesV39 = identities;
    global.RainGuardAuthoritativePersistentIdentityAliasMapV39 = registry.aliasToPersistentId;
  }

  function buildMetrics() {
    const identities = Array.from(registry.identities.values());

    let obsCount = 0;
    let multiPointIdentityCount = 0;
    let coordinateChangingIdentityCount = 0;
    let maxObservedPointsPerIdentity = 0;
    let maxUniqueCoordinatesPerIdentity = 0;

    for (const identity of identities) {
      const obs = Array.isArray(identity.observations) ? identity.observations : [];
      const n = obs.length;
      obsCount += n;

      if (n > 1) multiPointIdentityCount++;
      if ((identity.uniqueCoordinateCount || 0) > 1) coordinateChangingIdentityCount++;

      maxObservedPointsPerIdentity = Math.max(maxObservedPointsPerIdentity, n);
      maxUniqueCoordinatesPerIdentity = Math.max(
        maxUniqueCoordinatesPerIdentity,
        Number(identity.uniqueCoordinateCount || 0)
      );
    }

    return {
      identityCount: identities.length,
      aliasCount: registry.aliasToPersistentId.size,
      observationCount: obsCount,
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
        status: "PERSISTENT_REGISTRY_ALREADY_RUNNING"
      };
    }

    state.running = true;

    try {
      const cfg = Object.assign({}, DEFAULTS, isObj(options) ? options : {});
      const restored = restore(cfg);

      const sources = sourceCandidateArrays();

      if (!sources.length) {
        const result = {
          success: false,
          phase: PHASE,
          version: VERSION,
          build: BUILD,
          status: "NO_INTEGRATED_IDENTITY_SOURCE_AVAILABLE",
          generatedAt: now(),
          durationMs: now() - startedAt,
          restoredIdentityCount: restored.restored
        };

        state.lastRun = result;
        return result;
      }

      let inputCount = 0;
      let accepted = 0;
      let inserted = 0;
      let merged = 0;
      let aliasesAdded = 0;
      let observationsAdded = 0;
      let duplicateObservations = 0;
      let evictedObservations = 0;

      const seenThisRun = new Set();
      const usedSources = [];

      for (const source of sources) {
        usedSources.push(source.name);

        for (const identity of source.arr) {
          inputCount++;

          const rawId = identityIdOf(identity);
          if (!rawId) continue;

          // السماح بمرور نفس الهوية من أكثر من مصدر إذا كان لديها بيانات إضافية،
          // لكن نحمي من التكرار الحرفي للمصدر نفسه.
          const runKey = `${source.name}|${norm(rawId)}`;
          if (seenThisRun.has(runKey)) continue;
          seenThisRun.add(runKey);

          const r = upsertIdentity(identity, cfg, source.name);
          if (!r.accepted) continue;

          accepted++;
          if (r.isNew) inserted++;
          else merged++;

          aliasesAdded += r.aliasesAdded || 0;
          observationsAdded += r.observationsAdded || 0;
          duplicateObservations += r.duplicateObservations || 0;
          evictedObservations += r.evictedObservations || 0;
        }
      }

      const evictedIdentities = evictIfNeeded(cfg);
      evictedObservations += enforceGlobalObservationLimit(cfg);

      registry.updatedAt = now();
      registry.stats.runs++;
      registry.stats.totalInputIdentities += inputCount;
      registry.stats.totalAcceptedIdentities += accepted;
      registry.stats.totalMergedIdentities += merged;
      registry.stats.totalObservationsAccepted += observationsAdded;
      registry.stats.totalDuplicateObservations += duplicateObservations;
      registry.stats.totalAliasesAccepted += aliasesAdded;
      registry.stats.totalEvictedObservations += evictedObservations;

      publishGlobals();

      const persisted = cfg.persistToLocalStorage ? persist() : false;
      const metrics = buildMetrics();

      const status = metrics.identityCount >= cfg.minimumIdentityCountForReady
        ? "INTEGRATED_IDENTITY_PERSISTENT_REGISTRY_READY"
        : "REGISTRY_BUILT_BUT_INSUFFICIENT_IDENTITIES";

      const result = {
        success: metrics.identityCount >= cfg.minimumIdentityCountForReady,
        phase: PHASE,
        version: VERSION,
        build: BUILD,
        status,

        generatedAt: now(),
        durationMs: now() - startedAt,

        sourceCount: sources.length,
        sourceNames: usedSources,
        sourceInputCount: inputCount,

        acceptedIdentityCount: accepted,
        insertedIdentityCount: inserted,
        mergedIdentityCount: merged,
        restoredIdentityCount: restored.restored,

        aliasesAddedCount: aliasesAdded,
        observationsAddedCount: observationsAdded,
        duplicateObservationCount: duplicateObservations,

        evictedIdentityCount: evictedIdentities,
        evictedObservationCount: evictedObservations,

        persistedToLocalStorage: persisted,

        ...metrics,

        identitySample: Array.from(registry.identities.values()).slice(0, 20)
      };

      state.lastRun = result;
      state.lastError = null;

      console.log(`[RainGuard Phase ${PHASE}] Integrated Identity Persistent Registry result:`);
      console.log(result);

      return result;

    } catch (error) {
      const result = {
        success: false,
        phase: PHASE,
        version: VERSION,
        build: BUILD,
        status: "INTEGRATED_IDENTITY_PERSISTENT_REGISTRY_FAILED",
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
    const metrics = buildMetrics();

    const result = {
      success: true,
      phase: PHASE,
      version: VERSION,
      build: BUILD,
      installed: true,
      running: state.running,
      loadedFromStorage: state.loadedFromStorage,
      storageKey: STORAGE_KEY,
      lastError: state.lastError,
      lastRun: state.lastRun,
      stats: clone(registry.stats),
      ...metrics
    };

    console.log(`[RainGuard Phase ${PHASE}] Diagnostic:`);
    console.log(result);

    return result;
  }

  function snapshot() {
    return storageSafeSnapshot();
  }

  global.runRainGuardIntegratedIdentityPersistentRegistryBridge = run;
  global.diagnoseRainGuardIntegratedIdentityPersistentRegistryBridge = diagnose;
  global.getRainGuardIntegratedIdentityPersistentRegistrySnapshot = snapshot;

  global.RainGuardIntegratedIdentityPersistentRegistryBridgeV39 = {
    phase: PHASE,
    version: VERSION,
    build: BUILD,
    run,
    diagnose,
    snapshot,
    state,
    registry
  };

})(window);
