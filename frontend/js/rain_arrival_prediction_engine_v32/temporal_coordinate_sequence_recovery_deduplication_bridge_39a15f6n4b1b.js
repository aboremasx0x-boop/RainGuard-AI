/**
 * RainGuard AI V39
 * Phase 39A-15F6N4B1B — Temporal Coordinate Sequence Recovery & De-duplication Bridge
 * Version: 39A.15F6N4B1B.0
 */
(function (global) {
  'use strict';

  const PHASE = '39A-15F6N4B1B';
  const VERSION = '39A.15F6N4B1B.0';
  const BUILD = 'rainguard-v39-temporal-coordinate-sequence-recovery-deduplication-bridge';
  const FLAG = '__RainGuardTemporalCoordinateSequenceRecoveryDeduplicationBridgeInstalled';
  if (global[FLAG]) return;
  global[FLAG] = true;

  const DEFAULTS = Object.freeze({
    maxSourceRecords: 25000,
    maxObservationsPerIdentity: 64,
    minDistinctTemporalPoints: 2,
    coordinatePrecision: 5,
    minTimeDeltaMs: 1000,
    dedupeTimeToleranceMs: 1000,
    minCoordinateDeltaDegrees: 0.00001,
    publishDiagnosticsTable: true
  });

  const state = { installed: true, running: false, lastRun: null, lastError: null };
  const now = () => Date.now();
  const isObject = v => !!v && typeof v === 'object';
  const str = v => { try { return v == null ? '' : String(v); } catch (_) { return ''; } };
  const num = v => { const n = Number(v); return Number.isFinite(n) ? n : null; };

  function normId(v) {
    return str(v).trim().toLowerCase().replace(/\s+/g, ' ')
      .replace(/^track:/, '').replace(/^storm:/, '').replace(/^cell:/, '').replace(/^identity:/, '');
  }

  function toTs(v) {
    if (v == null || v === '') return null;
    if (typeof v === 'number' && Number.isFinite(v)) return v > 1e12 ? Math.trunc(v) : (v > 1e9 ? Math.trunc(v * 1000) : null);
    const n = Number(v);
    if (Number.isFinite(n)) return n > 1e12 ? Math.trunc(n) : (n > 1e9 ? Math.trunc(n * 1000) : null);
    const p = Date.parse(v);
    return Number.isFinite(p) ? p : null;
  }

  function timestampOf(r) {
    if (!isObject(r)) return null;
    const values = [r.observedAt, r.timestamp, r.time, r.generatedAt, r.accumulatedAt, r.createdAt, r.updatedAt, r.detectedAt, r.firstSeenAt, r.lastSeenAt];
    for (const v of values) { const t = toTs(v); if (t != null) return t; }
    return null;
  }

  function coordsOf(r) {
    if (!isObject(r)) return null;
    const candidates = [
      [r.latitude, r.longitude], [r.lat, r.lon], [r.lat, r.lng],
      [r.coordinate && (r.coordinate.latitude ?? r.coordinate.lat), r.coordinate && (r.coordinate.longitude ?? r.coordinate.lon ?? r.coordinate.lng)],
      [r.coordinates && (r.coordinates.latitude ?? r.coordinates.lat), r.coordinates && (r.coordinates.longitude ?? r.coordinates.lon ?? r.coordinates.lng)],
      [r.position && (r.position.latitude ?? r.position.lat), r.position && (r.position.longitude ?? r.position.lon ?? r.position.lng)]
    ];
    for (const [a, b] of candidates) {
      const lat = num(a), lon = num(b);
      if (lat != null && lon != null && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180 && !(lat === 0 && lon === 0)) {
        return { latitude: lat, longitude: lon };
      }
    }
    return null;
  }

  function idKeys(r) {
    if (!isObject(r)) return [];
    const vals = [r.persistentId, r.canonicalPersistentId, r.authoritativeIdentity, r.canonicalIdentity, r.canonicalTrackId,
      r.canonicalId, r.identityKey, r.recoveredIdentityKey, r.identity, r.trackId, r.cellId, r.stormId, r.entityId, r.id, r.name];
    const out = [];
    for (const v of vals) { const k = normId(v); if (k) out.push(k); }
    const aliasFields = [r.aliases, r.identityAliases, r.trackAliases, r.historicalAliases, r.sourceAliases, r.candidateAliases];
    for (const a of aliasFields) {
      if (Array.isArray(a)) {
        for (const x of a) {
          const k = normId(isObject(x) ? (x.identity ?? x.trackId ?? x.cellId ?? x.alias ?? x.id ?? x.name) : x);
          if (k) out.push(k);
        }
      } else if (a instanceof Set) {
        for (const x of a.values()) { const k = normId(x); if (k) out.push(k); }
      } else if (a instanceof Map) {
        for (const [k0, v0] of a.entries()) { const k = normId(k0), v = normId(v0); if (k) out.push(k); if (v) out.push(v); }
      }
    }
    return Array.from(new Set(out));
  }

  function unwrap(v) {
    if (!v) return [];
    if (Array.isArray(v)) return v;
    if (v instanceof Map || v instanceof Set) { try { return Array.from(v.values()); } catch (_) { return []; } }
    if (!isObject(v)) return [];
    for (const k of ['identities','registry','records','items','data','entities','tracks','observations','history','values']) {
      const n = v[k];
      if (Array.isArray(n)) return n;
      if (n instanceof Map || n instanceof Set) { try { return Array.from(n.values()); } catch (_) {} }
      if (isObject(n)) { try { const vals = Object.values(n); if (vals.length) return vals; } catch (_) {} }
    }
    try { return Object.values(v); } catch (_) { return []; }
  }

  function authoritativeSource() {
    const names = [
      'RainGuardAuthoritativePersistentStormIdentitiesV39',
      'RainGuardPublishedAuthoritativePersistentStormIdentitiesV39',
      'RainGuardIntegratedPersistentStormIdentitiesV39',
      'RainGuardIntegratedIdentityPersistentRegistryV39',
      'RainGuardIntegratedPersistentIdentityRegistryV39',
      'RainGuardRuntimeAuthoritativeRegistryBindingV39'
    ];
    let best = { source: null, records: [] };
    for (const name of names) {
      let v; try { v = global[name]; } catch (_) { continue; }
      let records = unwrap(v);
      if (name === 'RainGuardRuntimeAuthoritativeRegistryBindingV39' && isObject(v) && Array.isArray(v.identities)) records = v.identities;
      if (records.length > best.records.length) best = { source: name, records };
    }
    return best;
  }

  function historySources() {
    const names = [
      'RainArrivalLiveTrackHistory',
      'RainGuardRecoveredLiveTrackHistoryV39',
      'RainGuardPersistentObservationMemoryV39',
      'RainGuardPersistentIdentityMotionRecordsV39',
      'RainGuardPersistentIdentityTemporalAccumulatorV39',
      'RainGuardCrossCycleObservationPersistenceV39',
      'RainGuardIntegratedPersistentStormIdentitiesV39',
      'RainGuardAuthoritativePersistentStormIdentitiesV39'
    ];
    const out = [];
    for (const name of names) {
      let v; try { v = global[name]; } catch (_) { continue; }
      const records = unwrap(v);
      if (records.length) out.push({ sourceName: name, records });
    }
    return out;
  }

  function buildIndex(records) {
    const m = new Map();
    records.forEach((r, i) => {
      for (const k of idKeys(r)) {
        if (!m.has(k)) m.set(k, []);
        m.get(k).push(i);
      }
    });
    return m;
  }

  function coordKey(lat, lon, precision) { return `${lat.toFixed(precision)}|${lon.toFixed(precision)}`; }

  async function run(options) {
    const started = now();
    if (state.running) return { success:false, phase:PHASE, version:VERSION, build:BUILD, status:'TEMPORAL_COORDINATE_SEQUENCE_RECOVERY_ALREADY_RUNNING' };
    state.running = true;
    try {
      const cfg = Object.assign({}, DEFAULTS, isObject(options) ? options : {});
      const auth = authoritativeSource();
      if (!auth.records.length) {
        return state.lastRun = { success:false, phase:PHASE, version:VERSION, build:BUILD, status:'NO_AUTHORITATIVE_IDENTITIES_FOUND', generatedAt:now(), durationMs:now()-started };
      }
      const sources = historySources();
      if (!sources.length) {
        return state.lastRun = { success:false, phase:PHASE, version:VERSION, build:BUILD, status:'NO_TEMPORAL_HISTORY_SOURCE_FOUND', authoritativeSource:auth.source, authoritativeIdentityCount:auth.records.length, generatedAt:now(), durationMs:now()-started };
      }

      const index = buildIndex(auth.records);
      const buckets = auth.records.map((r, i) => ({
        identityIndex:i,
        persistentIdentity:str(r.persistentId ?? r.canonicalPersistentId ?? r.authoritativeIdentity ?? r.canonicalIdentity ?? r.identity ?? r.trackId ?? r.cellId ?? r.id ?? `identity-${i}`),
        identityKeys:idKeys(r), observations:[], fps:new Set(), duplicateObservationCount:0, sources:new Set()
      }));

      const c = { inspected:0, validCoord:0, invalidCoord:0, invalidTs:0, unmatched:0, ambiguous:0, matched:0, accepted:0, duplicates:0 };

      for (const src of sources) {
        for (const raw of src.records.slice(0, cfg.maxSourceRecords)) {
          if (!isObject(raw)) continue;
          c.inspected++;
          const xy = coordsOf(raw); if (!xy) { c.invalidCoord++; continue; } c.validCoord++;
          const ts = timestampOf(raw); if (ts == null) { c.invalidTs++; continue; }
          const matchSet = new Set();
          for (const k of idKeys(raw)) for (const idx of (index.get(k) || [])) matchSet.add(idx);
          const matches = Array.from(matchSet);
          if (!matches.length) { c.unmatched++; continue; }
          if (matches.length > 1) c.ambiguous++;
          c.matched++;
          const idx = matches[0], b = buckets[idx];
          const rounded = Math.round(ts / Math.max(1,cfg.dedupeTimeToleranceMs))*Math.max(1,cfg.dedupeTimeToleranceMs);
          const fp = `${idx}|${coordKey(xy.latitude,xy.longitude,cfg.coordinatePrecision)}|${rounded}`;
          if (b.fps.has(fp)) { b.duplicateObservationCount++; c.duplicates++; continue; }
          b.fps.add(fp); b.sources.add(src.sourceName);
          b.observations.push({ identityIndex:idx, persistentIdentity:b.persistentIdentity, latitude:xy.latitude, longitude:xy.longitude, timestamp:ts, observedAt:new Date(ts).toISOString(), source:src.sourceName, originalIdentityKeys:idKeys(raw), original:raw });
          c.accepted++;
        }
      }

      const sequences = [], changing = [];
      for (const b of buckets) {
        b.observations.sort((a,b)=>a.timestamp-b.timestamp);
        if (b.observations.length > cfg.maxObservationsPerIdentity) b.observations = b.observations.slice(-cfg.maxObservationsPerIdentity);
        const uniq = new Set(b.observations.map(o=>coordKey(o.latitude,o.longitude,cfg.coordinatePrecision)));
        let changes = 0, dLat=0, dLon=0, distanceProxy=0;
        for (let i=1;i<b.observations.length;i++) {
          const p=b.observations[i-1], q=b.observations[i];
          const dl=q.latitude-p.latitude, dn=q.longitude-p.longitude;
          if (Math.abs(dl)>=cfg.minCoordinateDeltaDegrees || Math.abs(dn)>=cfg.minCoordinateDeltaDegrees) {
            changes++; dLat+=dl; dLon+=dn; distanceProxy+=Math.sqrt(dl*dl+dn*dn);
          }
        }
        const seq = {
          identityIndex:b.identityIndex,
          persistentIdentity:b.persistentIdentity,
          identityKeys:b.identityKeys,
          observationCount:b.observations.length,
          uniqueCoordinateCount:uniq.size,
          multiPointTemporal:b.observations.length>=cfg.minDistinctTemporalPoints,
          coordinateChanging:changes>0,
          coordinateChangeCount:changes,
          duplicateObservationCount:b.duplicateObservationCount,
          matchedSourceNames:Array.from(b.sources),
          totalDeltaLat:dLat,
          totalDeltaLon:dLon,
          totalDistanceProxyDegrees:distanceProxy,
          observations:b.observations
        };
        sequences.push(seq); if (seq.coordinateChanging) changing.push(seq);
      }

      const withObs = sequences.filter(s=>s.observationCount>0);
      const multi = sequences.filter(s=>s.multiPointTemporal);
      const maxPts = sequences.reduce((m,s)=>Math.max(m,s.observationCount),0);
      const maxUnique = sequences.reduce((m,s)=>Math.max(m,s.uniqueCoordinateCount),0);
      const functionalPass = multi.length>0 && changing.length>0 && maxUnique>1;
      const status = functionalPass ? 'TEMPORAL_COORDINATE_SEQUENCES_RECOVERED_WITH_REAL_CHANGE' :
        multi.length ? 'MULTI_POINT_TEMPORAL_SEQUENCES_FOUND_BUT_NO_COORDINATE_CHANGE' :
        withObs.length ? 'OBSERVATIONS_MATCHED_BUT_NO_MULTI_POINT_TEMPORAL_SEQUENCE' :
        'HISTORY_FOUND_BUT_NO_IDENTITY_MATCHED_TEMPORAL_SEQUENCE';

      global.RainGuardPersistentIdentityTemporalSequencesV39 = sequences;
      global.RainGuardTemporalCoordinateSequencesV39 = sequences;
      global.RainGuardTemporalCoordinateChangeCandidatesV39 = changing;

      const result = {
        success:true, functionalPass, phase:PHASE, version:VERSION, build:BUILD, status,
        authoritativeSource:auth.source, authoritativeIdentityCount:auth.records.length,
        historySourceCount:sources.length,
        historySources:sources.map(s=>({sourceName:s.sourceName,recordCount:s.records.length})),
        identitySequenceCount:sequences.length,
        identitiesWithObservationsCount:withObs.length,
        multiPointIdentityCount:multi.length,
        coordinateChangingIdentityCount:changing.length,
        maxObservedPointsPerIdentity:maxPts,
        maxUniqueCoordinatesPerIdentity:maxUnique,
        inspectedRecordCount:c.inspected,
        validCoordinateRecordCount:c.validCoord,
        invalidCoordinateRecordCount:c.invalidCoord,
        invalidTimestampRecordCount:c.invalidTs,
        unmatchedHistoryRecordCount:c.unmatched,
        ambiguousHistoryRecordCount:c.ambiguous,
        matchedHistoryRecordCount:c.matched,
        acceptedObservationCount:c.accepted,
        duplicateObservationCount:c.duplicates,
        multiPointSample:multi.slice(0,20),
        coordinateChangingSample:changing.slice(0,20),
        sequenceSample:sequences.slice(0,20),
        generatedAt:now(), durationMs:now()-started
      };
      global.RainGuardTemporalCoordinateSequenceRecoveryResultV39 = result;
      state.lastRun = result; state.lastError = null;
      console.log(`[RainGuard Phase ${PHASE}] Temporal Coordinate Sequence Recovery & De-duplication result:`); console.log(result);
      if (cfg.publishDiagnosticsTable && typeof console.table === 'function') {
        try { console.table(withObs.slice(0,40).map(s=>({identity:s.persistentIdentity,points:s.observationCount,uniqueCoordinates:s.uniqueCoordinateCount,changes:s.coordinateChangeCount,multiPoint:s.multiPointTemporal,changing:s.coordinateChanging,duplicates:s.duplicateObservationCount,sources:s.matchedSourceNames.join(', ')}))); } catch(_) {}
      }
      return result;
    } catch (e) {
      const result = { success:false, phase:PHASE, version:VERSION, build:BUILD, status:'TEMPORAL_COORDINATE_SEQUENCE_RECOVERY_FAILED', error:e && e.message ? e.message : str(e), generatedAt:now(), durationMs:now()-started };
      state.lastRun=result; state.lastError=result.error; console.error(`[RainGuard Phase ${PHASE}] failed:`,e); return result;
    } finally { state.running=false; }
  }

  function diagnose() {
    const result = { success:true, phase:PHASE, version:VERSION, build:BUILD, installed:true, running:state.running, lastError:state.lastError, lastRun:state.lastRun,
      temporalSequenceCount:unwrap(global.RainGuardPersistentIdentityTemporalSequencesV39).length,
      changingSequenceCount:unwrap(global.RainGuardTemporalCoordinateChangeCandidatesV39).length };
    console.log(`[RainGuard Phase ${PHASE}] Diagnostic:`,result); return result;
  }

  global.runRainGuardTemporalCoordinateSequenceRecoveryDeduplicationBridge = run;
  global.diagnoseRainGuardTemporalCoordinateSequenceRecoveryDeduplicationBridge = diagnose;
  global.RainGuardTemporalCoordinateSequenceRecoveryDeduplicationBridgeV39 = { phase:PHASE, version:VERSION, build:BUILD, run, diagnose, state };
})(window);
