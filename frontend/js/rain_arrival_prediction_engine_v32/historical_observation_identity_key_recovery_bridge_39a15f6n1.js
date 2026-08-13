/**
 * RainGuard AI V39
 * Phase 39A-15F6N1 — Historical Observation Identity Key Recovery Bridge
 * Version: 39A.15F6N1.0
 */
(function (global) {
  'use strict';

  const PHASE = '39A-15F6N1';
  const VERSION = '39A.15F6N1.0';
  const BUILD = 'rainguard-v39-historical-observation-identity-key-recovery-bridge';

  if (global.__RainGuardHistoricalObservationIdentityKeyRecoveryBridgeInstalled) return;
  global.__RainGuardHistoricalObservationIdentityKeyRecoveryBridgeInstalled = true;

  const CONFIG = Object.freeze({
    maxInputRecords: 20000,
    maxPersistentIdentities: 5000,
    maxAliasesPerIdentity: 128,
    maxSamples: 20,
    coordinatePrecision: 4,
    allowCoordinateFallback: true,
    allowCityCellFallback: true
  });

  const HISTORY_ROOTS = Object.freeze([
    'RainArrivalLiveTrackHistory',
    'RainGuardLiveTrackHistory',
    'RainGuardRecoveredLiveTrackHistoryV39',
    'RainGuardPersistentIdentityMotionRecordsV39',
    'RainGuardPersistentIdentityTemporalAccumulatorV39',
    'RainGuardPersistentObservationMemoryV39',
    'RainGuardCrossCycleObservationPersistenceV39',
    'RainGuardHistoricalObservationMemoryV39'
  ]);

  const IDENTITY_ROOTS = Object.freeze([
    'RainGuardPersistentStormIdentitiesV39',
    'RainGuardCrossCyclePersistentIdentitiesV39',
    'RainGuardReconciledStormIdentitiesV39',
    'RainGuardPersistentIdentityAliasConsolidationV39'
  ]);

  const ID_FIELDS = Object.freeze([
    'persistentId','persistentID','canonicalTrackId','canonicalId','trackId','trackID',
    'stormId','stormID','cellId','cellID','entityId','entityID','identity','id'
  ]);

  const ALIAS_FIELDS = Object.freeze([
    'aliases','alias','trackAliases','identityAliases','sourceAliases','historicalAliases'
  ]);

  const TIME_FIELDS = Object.freeze([
    'observedAt','timestamp','time','ts','createdAt','updatedAt','accumulatedAt'
  ]);

  const now = () => Date.now();
  const isObject = v => !!v && typeof v === 'object';
  const isPlainObject = v => isObject(v) && !Array.isArray(v) && !(v instanceof Map) && !(v instanceof Set);

  function safeString(v) {
    if (v === null || v === undefined) return '';
    if (typeof v === 'string') return v.trim();
    if (typeof v === 'number' && Number.isFinite(v)) return String(v);
    return '';
  }

  function normalizeKey(v) {
    return safeString(v)
      .replace(/[\u200e\u200f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function finiteNumber(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function getLat(r) {
    const values = [
      r && r.latitude, r && r.lat,
      r && r.coordinate && r.coordinate.latitude,
      r && r.coordinate && r.coordinate.lat,
      r && r.coordinates && r.coordinates.latitude,
      r && r.coordinates && r.coordinates.lat,
      r && Array.isArray(r.coordinate) ? r.coordinate[1] : null,
      r && Array.isArray(r.coordinates) ? r.coordinates[1] : null
    ];
    for (const v of values) {
      const n = finiteNumber(v);
      if (n !== null && n >= -90 && n <= 90) return n;
    }
    return null;
  }

  function getLon(r) {
    const values = [
      r && r.longitude, r && r.lon, r && r.lng,
      r && r.coordinate && r.coordinate.longitude,
      r && r.coordinate && r.coordinate.lon,
      r && r.coordinate && r.coordinate.lng,
      r && r.coordinates && r.coordinates.longitude,
      r && r.coordinates && r.coordinates.lon,
      r && r.coordinates && r.coordinates.lng,
      r && Array.isArray(r.coordinate) ? r.coordinate[0] : null,
      r && Array.isArray(r.coordinates) ? r.coordinates[0] : null
    ];
    for (const v of values) {
      const n = finiteNumber(v);
      if (n !== null && n >= -180 && n <= 180) return n;
    }
    return null;
  }

  function getTimestamp(r) {
    if (!r) return null;
    for (const k of TIME_FIELDS) {
      const v = r[k];
      if (v === undefined || v === null) continue;
      if (typeof v === 'number' && Number.isFinite(v)) return v < 1e12 ? v * 1000 : v;
      const t = Date.parse(v);
      if (Number.isFinite(t)) return t;
    }
    return null;
  }

  function looksLikeRecord(v) {
    if (!isPlainObject(v)) return false;
    return ID_FIELDS.some(k => v[k] !== undefined) ||
      getLat(v) !== null || getLon(v) !== null || getTimestamp(v) !== null ||
      v.source !== undefined || v.phase !== undefined;
  }

  function flatten(value, out, seen, depth) {
    if (value === null || value === undefined || depth > 6) return;
    if (isObject(value)) {
      if (seen.has(value)) return;
      seen.add(value);
    }

    if (Array.isArray(value)) {
      value.forEach(x => flatten(x, out, seen, depth + 1));
      return;
    }
    if (value instanceof Map) {
      for (const x of value.values()) flatten(x, out, seen, depth + 1);
      return;
    }
    if (value instanceof Set) {
      for (const x of value.values()) flatten(x, out, seen, depth + 1);
      return;
    }
    if (!isPlainObject(value)) return;

    if (looksLikeRecord(value)) out.push(value);

    const containers = ['records','observations','history','items','entities','identities','tracks','data','values','feed','output','results','groups','memory','store'];
    for (const key of containers) {
      if (value[key] !== undefined) flatten(value[key], out, seen, depth + 1);
    }

    if (!looksLikeRecord(value) && depth <= 2) {
      const keys = Object.keys(value);
      if (keys.length <= 5000) {
        for (const key of keys) {
          const child = value[key];
          if (Array.isArray(child) || child instanceof Map || child instanceof Set) {
            flatten(child, out, seen, depth + 1);
          }
        }
      }
    }
  }

  function collectRoots(names, max) {
    const records = [];
    const sources = [];
    const seen = new WeakSet();
    for (const name of names) {
      let value;
      try { value = global[name]; } catch (_) { continue; }
      if (value === undefined || value === null) continue;
      const before = records.length;
      flatten(value, records, seen, 0);
      const added = records.length - before;
      if (added > 0) sources.push({name, records: added});
      if (records.length >= max) break;
    }
    return {records: records.slice(0, max), sources};
  }

  function collectDynamic(regex, max, excluded) {
    const records = [];
    const sources = [];
    const seen = new WeakSet();
    let keys = [];
    try { keys = Object.keys(global); } catch (_) {}
    for (const name of keys.filter(k => regex.test(k)).slice(0, 250)) {
      if (excluded.includes(name)) continue;
      let value;
      try { value = global[name]; } catch (_) { continue; }
      if (!isObject(value)) continue;
      const before = records.length;
      flatten(value, records, seen, 0);
      const added = records.length - before;
      if (added > 0) sources.push({name, records: added, dynamic: true});
      if (records.length >= max) break;
    }
    return {records: records.slice(0, max), sources};
  }

  function extractAliases(record, maxAliases) {
    const out = [];
    const seen = new Set();
    function add(v, type) {
      const raw = safeString(v);
      const key = normalizeKey(raw);
      if (!key || seen.has(key)) return;
      seen.add(key);
      out.push({key, raw, type});
    }

    for (const field of ID_FIELDS) {
      const v = record && record[field];
      if (v !== undefined && v !== null && typeof v !== 'object') add(v, field);
    }

    for (const field of ALIAS_FIELDS) {
      const v = record && record[field];
      if (Array.isArray(v)) {
        v.forEach(item => {
          if (typeof item === 'string' || typeof item === 'number') add(item, field);
          else if (isPlainObject(item)) {
            add(item.alias, field); add(item.id, field); add(item.trackId, field);
            add(item.cellId, field); add(item.persistentId, field);
          }
        });
      } else if (v instanceof Set) {
        for (const item of v.values()) add(item, field);
      } else if (typeof v === 'string' || typeof v === 'number') add(v, field);
    }

    if (isPlainObject(record && record.identity)) {
      for (const field of ID_FIELDS) add(record.identity[field], 'identity.' + field);
    }

    return out.slice(0, maxAliases);
  }

  function coordinateKey(r, precision) {
    const lat = getLat(r), lon = getLon(r);
    if (lat === null || lon === null || (lat === 0 && lon === 0)) return '';
    return lat.toFixed(precision) + ',' + lon.toFixed(precision);
  }

  function cityCellKey(r) {
    const cell = normalizeKey(r && (r.cellId || r.cellID || r.gridCellId));
    if (cell) return 'cell:' + cell;
    const city = normalizeKey(r && (r.city || r.cityName || r.locationName || r.regionCity));
    if (city) return 'city:' + city;
    return '';
  }

  function choosePersistentId(record, aliases) {
    const preferred = [
      record && record.persistentId,
      record && record.persistentID,
      record && record.canonicalTrackId,
      record && record.canonicalId
    ];
    for (const v of preferred) {
      const s = safeString(v);
      if (s) return s;
    }
    return aliases.length ? aliases[0].raw : '';
  }

  function buildIdentityIndex(records, cfg) {
    const identities = [];
    const byId = new Map();
    const aliasOwners = new Map();

    for (const record of records.slice(0, cfg.maxPersistentIdentities)) {
      if (!isObject(record)) continue;
      const aliases = extractAliases(record, cfg.maxAliasesPerIdentity);
      const persistentId = choosePersistentId(record, aliases);
      if (!persistentId) continue;
      const pid = normalizeKey(persistentId);
      if (!pid) continue;

      let item = byId.get(pid);
      if (!item) {
        item = {persistentId, pid, aliases: [], aliasSet: new Set(), coordinateKeys: new Set(), cityCellKeys: new Set()};
        byId.set(pid, item);
        identities.push(item);
      }

      aliases.forEach(a => {
        if (!item.aliasSet.has(a.key)) {
          item.aliasSet.add(a.key);
          item.aliases.push(a);
        }
        let owners = aliasOwners.get(a.key);
        if (!owners) aliasOwners.set(a.key, owners = new Set());
        owners.add(pid);
      });

      const ck = coordinateKey(record, cfg.coordinatePrecision);
      if (ck) item.coordinateKeys.add(ck);
      const cc = cityCellKey(record);
      if (cc) item.cityCellKeys.add(cc);
    }

    return {identities, byId, aliasOwners};
  }

  function matchHistorical(record, index, cfg) {
    const aliases = extractAliases(record, cfg.maxAliasesPerIdentity);
    const candidates = new Map();

    function add(pid, method, evidence) {
      if (!pid) return;
      let c = candidates.get(pid);
      if (!c) candidates.set(pid, c = {pid, methods: new Set(), evidence: []});
      c.methods.add(method);
      c.evidence.push(evidence);
    }

    for (const alias of aliases) {
      const owners = index.aliasOwners.get(alias.key);
      if (!owners) continue;
      for (const pid of owners) add(pid, 'EXACT_ALIAS', {alias: alias.raw, type: alias.type});
    }

    const ck = coordinateKey(record, cfg.coordinatePrecision);
    const cc = cityCellKey(record);

    if (candidates.size === 0 && cfg.allowCoordinateFallback && ck) {
      for (const identity of index.identities) {
        if (identity.coordinateKeys.has(ck)) add(identity.pid, 'EXACT_COORDINATE', {coordinateKey: ck});
      }
    }

    if (candidates.size === 0 && cfg.allowCityCellFallback && cc) {
      for (const identity of index.identities) {
        if (identity.cityCellKeys.has(cc)) add(identity.pid, 'CITY_CELL', {cityCellKey: cc});
      }
    }

    if (candidates.size === 1) {
      const c = [...candidates.values()][0];
      const identity = index.byId.get(c.pid);
      return {
        accepted: true,
        persistentId: identity ? identity.persistentId : c.pid,
        pid: c.pid,
        methods: [...c.methods],
        evidence: c.evidence,
        aliases
      };
    }

    if (candidates.size > 1) {
      return {accepted:false, reason:'AMBIGUOUS_PERSISTENT_IDENTITY_MATCH', candidateCount:candidates.size, candidates:[...candidates.keys()].slice(0,10), aliases};
    }

    return {accepted:false, reason:aliases.length ? 'NO_PERSISTENT_ALIAS_MATCH' : 'NO_RECOVERABLE_IDENTITY_KEY', aliases};
  }

  function cloneRecord(record) {
    try {
      if (typeof structuredClone === 'function') return structuredClone(record);
    } catch (_) {}
    try { return JSON.parse(JSON.stringify(record)); }
    catch (_) { return Object.assign({}, record); }
  }

  async function run(options) {
    const started = now();
    const cfg = Object.assign({}, CONFIG, isPlainObject(options) ? options : {});

    try {
      const primaryHistory = collectRoots(HISTORY_ROOTS, cfg.maxInputRecords);
      const dynamicHistory = collectDynamic(/rain.*(history|observation|motion|track).*v?39/i, Math.max(0, cfg.maxInputRecords - primaryHistory.records.length), HISTORY_ROOTS);
      const history = primaryHistory.records.concat(dynamicHistory.records).slice(0, cfg.maxInputRecords);

      const primaryIdentity = collectRoots(IDENTITY_ROOTS, cfg.maxPersistentIdentities);
      const dynamicIdentity = collectDynamic(/rain.*persistent.*identit|reconciled.*identit/i, Math.max(0, cfg.maxPersistentIdentities - primaryIdentity.records.length), IDENTITY_ROOTS);
      const identities = primaryIdentity.records.concat(dynamicIdentity.records).slice(0, cfg.maxPersistentIdentities);

      const index = buildIdentityIndex(identities, cfg);
      const recovered = [];
      const unmatched = [];
      const ambiguous = [];
      const aliasMap = global.RainGuardHistoricalIdentityAliasMapV39 instanceof Map ? global.RainGuardHistoricalIdentityAliasMapV39 : new Map();
      const keyIndex = new Map();
      const recoveredIds = new Set();

      let exactAliasMatchedCount = 0;
      let exactCoordinateMatchedCount = 0;
      let cityCellMatchedCount = 0;
      let noPersistentAliasMatchCount = 0;
      let noRecoverableIdentityKeyCount = 0;
      let ambiguousRejectedCount = 0;
      let recoveredAliasKeyCount = 0;

      history.forEach((record, i) => {
        if (!isObject(record)) return;
        const match = matchHistorical(record, index, cfg);
        if (!match.accepted) {
          const item = {index:i, reason:match.reason, aliases:(match.aliases || []).slice(0,8), candidates:match.candidates || []};
          if (match.reason === 'AMBIGUOUS_PERSISTENT_IDENTITY_MATCH') {
            ambiguousRejectedCount++;
            ambiguous.push(item);
          } else if (match.reason === 'NO_PERSISTENT_ALIAS_MATCH') {
            noPersistentAliasMatchCount++;
            unmatched.push(item);
          } else {
            noRecoverableIdentityKeyCount++;
            unmatched.push(item);
          }
          return;
        }

        recoveredIds.add(match.pid);
        if (match.methods.includes('EXACT_ALIAS')) exactAliasMatchedCount++;
        if (match.methods.includes('EXACT_COORDINATE')) exactCoordinateMatchedCount++;
        if (match.methods.includes('CITY_CELL')) cityCellMatchedCount++;

        const copy = cloneRecord(record);
        copy.persistentId = match.persistentId;
        copy.recoveredPersistentId = match.persistentId;
        copy.identityRecovery = {phase:PHASE, version:VERSION, methods:match.methods, evidence:match.evidence, recoveredAt:now()};
        recovered.push(copy);

        for (const alias of match.aliases) {
          if (!aliasMap.has(alias.key)) {
            aliasMap.set(alias.key, match.persistentId);
            recoveredAliasKeyCount++;
          }
          keyIndex.set(alias.key, {persistentId:match.persistentId, identityKey:alias.raw, identityKeyType:alias.type, recoveredAt:now()});
        }
      });

      let status = 'HISTORICAL_IDENTITY_KEYS_RECOVERED';
      if (!history.length) status = 'NO_HISTORICAL_OBSERVATIONS_FOUND';
      else if (!index.identities.length) status = 'NO_PERSISTENT_IDENTITIES_FOUND';
      else if (!recovered.length) status = 'HISTORY_KEYS_FOUND_BUT_NO_SAFE_IDENTITY_LINK';
      else if (recoveredIds.size === 1) status = 'HISTORICAL_IDENTITY_KEYS_RECOVERED_SINGLE_IDENTITY';

      const result = {
        success: true,
        phase: PHASE,
        version: VERSION,
        build: BUILD,
        status,
        generatedAt: now(),
        durationMs: now() - started,
        sourceHistoryRecordCount: history.length,
        sourcePersistentIdentityRecordCount: identities.length,
        normalizedPersistentIdentityCount: index.identities.length,
        persistentAliasKeyCount: index.aliasOwners.size,
        recoveredObservationCount: recovered.length,
        uniqueRecoveredIdentityCount: recoveredIds.size,
        exactAliasMatchedCount,
        exactCoordinateMatchedCount,
        cityCellMatchedCount,
        recoveredAliasKeyCount,
        ambiguousRejectedCount,
        noPersistentAliasMatchCount,
        noRecoverableIdentityKeyCount,
        historySources: primaryHistory.sources.concat(dynamicHistory.sources),
        identitySources: primaryIdentity.sources.concat(dynamicIdentity.sources),
        recoveredSample: recovered.slice(0, cfg.maxSamples),
        unmatchedSample: unmatched.slice(0, cfg.maxSamples),
        ambiguousSample: ambiguous.slice(0, cfg.maxSamples)
      };

      global.RainGuardHistoricalIdentityAliasMapV39 = aliasMap;
      global.RainGuardHistoricalIdentityKeyIndexV39 = keyIndex;
      global.RainGuardRecoveredHistoricalObservationsV39 = recovered;
      global.RainGuardHistoricalObservationIdentityKeyRecoveryV39 = {
        phase: PHASE,
        version: VERSION,
        build: BUILD,
        generatedAt: result.generatedAt,
        status,
        recoveredObservations: recovered,
        aliasMap,
        keyIndex,
        lastResult: result
      };
      global.RainGuardHistoricalObservationIdentityKeyRecoveryLastResult = result;

      console.log(`[RainGuard Phase ${PHASE}] Historical Observation Identity Key Recovery result:`);
      console.log(result);
      return result;
    } catch (error) {
      const result = {
        success:false,
        phase:PHASE,
        version:VERSION,
        build:BUILD,
        status:'HISTORICAL_IDENTITY_KEY_RECOVERY_FAILED',
        generatedAt:now(),
        durationMs:now()-started,
        error:error && error.message ? error.message : String(error)
      };
      global.RainGuardHistoricalObservationIdentityKeyRecoveryLastResult = result;
      console.error(`[RainGuard Phase ${PHASE}] failed:`, error);
      return result;
    }
  }

  function diagnose() {
    const state = global.RainGuardHistoricalObservationIdentityKeyRecoveryV39;
    const d = {
      success:true,
      phase:PHASE,
      version:VERSION,
      build:BUILD,
      installed:true,
      hasRunner:typeof global.runRainGuardHistoricalObservationIdentityKeyRecoveryBridge === 'function',
      hasState:!!state,
      recoveredObservationCount:state && Array.isArray(state.recoveredObservations) ? state.recoveredObservations.length : 0,
      aliasMapSize:global.RainGuardHistoricalIdentityAliasMapV39 instanceof Map ? global.RainGuardHistoricalIdentityAliasMapV39.size : 0,
      lastResult:state ? state.lastResult : global.RainGuardHistoricalObservationIdentityKeyRecoveryLastResult || null
    };
    console.log(`[RainGuard Phase ${PHASE}] Diagnostic:`);
    console.log(d);
    return d;
  }

  global.runRainGuardHistoricalObservationIdentityKeyRecoveryBridge = run;
  global.diagnoseRainGuardHistoricalObservationIdentityKeyRecoveryBridge = diagnose;
  global.RainGuardHistoricalObservationIdentityKeyRecoveryBridgeV39 = {
    phase:PHASE, version:VERSION, build:BUILD, installed:true, config:Object.assign({}, CONFIG), run, diagnose
  };
})(window);
