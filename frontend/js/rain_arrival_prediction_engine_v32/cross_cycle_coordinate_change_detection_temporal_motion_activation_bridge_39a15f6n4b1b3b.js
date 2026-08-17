/**
 * RainGuard AI V39
 * Phase 39A-15F6N4B1B3B
 * Cross-Cycle Coordinate Change Detection & Temporal Motion Activation Bridge
 * Version: 39A.15F6N4B1B3B.0
 */
(function (global) {
  'use strict';

  const PHASE = '39A-15F6N4B1B3B';
  const VERSION = '39A.15F6N4B1B3B.0';
  const BUILD = 'rainguard-v39-cross-cycle-coordinate-change-detection-temporal-motion-activation-bridge';
  const FLAG = '__RainGuardCrossCycleCoordinateChangeDetectionTemporalMotionActivationBridgeInstalled';
  const STORAGE_KEY = 'RainGuard:39A15F6N4B1B3B:motionReadyTemporalSequences:v1';

  if (global[FLAG]) return;
  global[FLAG] = true;

  const DEFAULTS = Object.freeze({
    coordinatePrecision: 5,
    minimumTimeDeltaMs: 1000,
    minimumMovementMeters: 5,
    maxReasonableSpeedKmh: 300,
    maxIdentities: 5000,
    maxSequencePoints: 128,
    persistLocalStorage: true,
    logSummary: true
  });

  const state = { installed: true, running: false, runs: 0, lastRun: null, lastError: null };
  const now = () => Date.now();
  const isObject = v => !!v && typeof v === 'object';
  const safeString = v => { try { return v == null ? '' : String(v); } catch (_) { return ''; } };
  const finiteNumber = v => { const n = Number(v); return Number.isFinite(n) ? n : null; };
  const normalizeIdentity = v => safeString(v).trim().toLowerCase().replace(/\s+/g, ' ');

  function parseTime(v) {
    if (v == null) return null;
    if (typeof v === 'number' && Number.isFinite(v)) return v < 1e12 ? v * 1000 : v;
    const t = Date.parse(v);
    return Number.isFinite(t) ? t : null;
  }

  function extractTime(record) {
    if (!isObject(record)) return null;
    for (const v of [record.cycleObservedAt, record.observedAt, record.timestamp, record.time,
      record.eventTime, record.captureTime, record.lastSeenAt, record.updatedAt,
      record.generatedAt, record.appendedAt]) {
      const t = parseTime(v);
      if (t !== null) return t;
    }
    return null;
  }

  function extractCoordinate(record) {
    if (!isObject(record)) return null;
    const latVals = [record.latitude, record.lat,
      record.coordinate && record.coordinate.latitude,
      record.coordinate && record.coordinate.lat,
      record.coordinates && record.coordinates.latitude,
      record.coordinates && record.coordinates.lat,
      Array.isArray(record.coordinate) ? record.coordinate[0] : null,
      Array.isArray(record.coordinates) ? record.coordinates[0] : null];
    const lonVals = [record.longitude, record.lon, record.lng,
      record.coordinate && record.coordinate.longitude,
      record.coordinate && record.coordinate.lon,
      record.coordinate && record.coordinate.lng,
      record.coordinates && record.coordinates.longitude,
      record.coordinates && record.coordinates.lon,
      record.coordinates && record.coordinates.lng,
      Array.isArray(record.coordinate) ? record.coordinate[1] : null,
      Array.isArray(record.coordinates) ? record.coordinates[1] : null];

    let latitude = null, longitude = null;
    for (const v of latVals) { const n = finiteNumber(v); if (n !== null) { latitude = n; break; } }
    for (const v of lonVals) { const n = finiteNumber(v); if (n !== null) { longitude = n; break; } }
    if (latitude === null || longitude === null) return null;
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
    return { latitude, longitude };
  }

  function coordKey(p, precision) {
    return `${Number(p.latitude).toFixed(precision)}|${Number(p.longitude).toFixed(precision)}`;
  }

  function haversineMeters(a, b) {
    const R = 6371000;
    const rad = d => d * Math.PI / 180;
    const lat1 = rad(a.latitude), lat2 = rad(b.latitude);
    const dLat = rad(b.latitude - a.latitude), dLon = rad(b.longitude - a.longitude);
    const h = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  function bearingDegrees(a, b) {
    const rad = d => d * Math.PI / 180, deg = r => r * 180 / Math.PI;
    const lat1 = rad(a.latitude), lat2 = rad(b.latitude), dLon = rad(b.longitude - a.longitude);
    const y = Math.sin(dLon) * Math.cos(lat2);
    const x = Math.cos(lat1)*Math.sin(lat2) - Math.sin(lat1)*Math.cos(lat2)*Math.cos(dLon);
    return (deg(Math.atan2(y, x)) + 360) % 360;
  }

  function directionLabel(d) {
    const labels = ['N','NE','E','SE','S','SW','W','NW'];
    return labels[Math.round(d / 45) % 8];
  }

  function normalizeObservation(obs, fallbackIdentity) {
    const coordinate = extractCoordinate(obs);
    const timestamp = extractTime(obs);
    if (!coordinate || timestamp === null) return null;
    return {
      identity: normalizeIdentity(obs.identity || obs.authoritativeIdentity || obs.persistentId || fallbackIdentity),
      latitude: coordinate.latitude,
      longitude: coordinate.longitude,
      timestamp,
      cycleId: safeString(obs.cycleId || ''),
      source: safeString(obs.source || obs.registrySource || ''),
      raw: obs
    };
  }

  function getSource() {
    const acc = global.RainGuardCrossCycleTemporalAppendOverrideAccumulatorV39;
    if (isObject(acc) && isObject(acc.identities)) {
      return { sourceName: 'RainGuardCrossCycleTemporalAppendOverrideAccumulatorV39', identities: acc.identities };
    }
    const h = global.RainGuardCrossCycleTemporalAppendOverrideHistoriesV39;
    if (isObject(h)) return { sourceName: 'RainGuardCrossCycleTemporalAppendOverrideHistoriesV39', identities: h };
    return null;
  }

  function buildSequence(identityKey, identityRecord, cfg) {
    const raw = Array.isArray(identityRecord && identityRecord.observations) ? identityRecord.observations : [];
    const points = raw.map(o => normalizeObservation(o, identityKey)).filter(Boolean).sort((a,b)=>a.timestamp-b.timestamp);
    const seen = new Set(), dedup = [];
    for (const p of points) {
      const key = `${p.cycleId}|${p.timestamp}|${coordKey(p,cfg.coordinatePrecision)}`;
      if (seen.has(key)) continue;
      seen.add(key); dedup.push(p);
    }
    const limited = dedup.slice(-cfg.maxSequencePoints);
    const segments = [];
    for (let i=1;i<limited.length;i++) {
      const from = limited[i-1], to = limited[i];
      const dtMs = to.timestamp - from.timestamp;
      if (dtMs < cfg.minimumTimeDeltaMs) continue;
      const distanceMeters = haversineMeters(from,to);
      const changed = coordKey(from,cfg.coordinatePrecision) !== coordKey(to,cfg.coordinatePrecision);
      const speedKmh = dtMs > 0 ? (distanceMeters/(dtMs/1000))*3.6 : null;
      const bearing = changed ? bearingDegrees(from,to) : null;
      segments.push({
        from,to,dtMs,distanceMeters,changed,speedKmh,
        bearingDegrees:bearing,
        direction:bearing===null?null:directionLabel(bearing),
        plausible: changed && distanceMeters >= cfg.minimumMovementMeters && Number.isFinite(speedKmh) && speedKmh <= cfg.maxReasonableSpeedKmh
      });
    }
    const changedSegments = segments.filter(s=>s.changed);
    const plausible = changedSegments.filter(s=>s.plausible);
    const uniqueCoordinates = new Set(limited.map(p=>coordKey(p,cfg.coordinatePrecision)));
    const cycles = new Set(limited.map(p=>p.cycleId).filter(Boolean));
    return {
      identity: normalizeIdentity(identityKey),
      observationCount: limited.length,
      cycleCount: cycles.size,
      uniqueCoordinateCount: uniqueCoordinates.size,
      multiPoint: limited.length >= 2,
      crossCycle: cycles.size >= 2,
      coordinateChanging: uniqueCoordinates.size >= 2,
      changedSegmentCount: changedSegments.length,
      plausibleMotionSegmentCount: plausible.length,
      motionReady: plausible.length > 0,
      latestMotion: plausible.length ? plausible[plausible.length-1] : null,
      observations: limited,
      segments
    };
  }

  async function run(options) {
    const startedAt = now();
    if (state.running) return {success:false,phase:PHASE,version:VERSION,build:BUILD,status:'TEMPORAL_MOTION_ACTIVATION_ALREADY_RUNNING'};
    state.running = true;
    try {
      const cfg = Object.assign({}, DEFAULTS, isObject(options)?options:{});
      const source = getSource();
      if (!source) {
        const result = {success:false,phase:PHASE,version:VERSION,build:BUILD,status:'NO_N4B1B3A_TEMPORAL_SOURCE_FOUND',generatedAt:now(),durationMs:now()-startedAt};
        state.lastRun=result; return result;
      }

      const sequences = {};
      const sample = [];
      let identityCount=0, observationCount=0, multiPointIdentityCount=0, crossCycleIdentityCount=0;
      let coordinateChangingIdentityCount=0, motionReadyIdentityCount=0, changedSegmentCount=0, plausibleMotionSegmentCount=0;
      let maxObservedPointsPerIdentity=0, maxCyclesPerIdentity=0, maxUniqueCoordinatesPerIdentity=0, maxMovementMeters=0, maxPlausibleSpeedKmh=0;

      for (const [identityKey, identityRecord] of Object.entries(source.identities).slice(0,cfg.maxIdentities)) {
        const seq = buildSequence(identityKey, identityRecord, cfg);
        if (!seq.identity || seq.observationCount===0) continue;
        identityCount++; observationCount += seq.observationCount;
        if (seq.multiPoint) multiPointIdentityCount++;
        if (seq.crossCycle) crossCycleIdentityCount++;
        if (seq.coordinateChanging) coordinateChangingIdentityCount++;
        if (seq.motionReady) motionReadyIdentityCount++;
        changedSegmentCount += seq.changedSegmentCount;
        plausibleMotionSegmentCount += seq.plausibleMotionSegmentCount;
        maxObservedPointsPerIdentity=Math.max(maxObservedPointsPerIdentity,seq.observationCount);
        maxCyclesPerIdentity=Math.max(maxCyclesPerIdentity,seq.cycleCount);
        maxUniqueCoordinatesPerIdentity=Math.max(maxUniqueCoordinatesPerIdentity,seq.uniqueCoordinateCount);
        for (const s of seq.segments) {
          maxMovementMeters=Math.max(maxMovementMeters,Number(s.distanceMeters||0));
          if (s.plausible) maxPlausibleSpeedKmh=Math.max(maxPlausibleSpeedKmh,Number(s.speedKmh||0));
        }
        sequences[seq.identity]=seq;
        if (seq.coordinateChanging || seq.motionReady || sample.length<20) {
          sample.push({
            identity:seq.identity, observations:seq.observationCount, cycles:seq.cycleCount,
            uniqueCoordinates:seq.uniqueCoordinateCount, changedSegments:seq.changedSegmentCount,
            plausibleMotionSegments:seq.plausibleMotionSegmentCount, motionReady:seq.motionReady,
            latestDistanceMeters:seq.latestMotion?Math.round(seq.latestMotion.distanceMeters*100)/100:null,
            latestSpeedKmh:seq.latestMotion?Math.round(seq.latestMotion.speedKmh*100)/100:null,
            latestBearingDegrees:seq.latestMotion?Math.round(seq.latestMotion.bearingDegrees*100)/100:null,
            latestDirection:seq.latestMotion?seq.latestMotion.direction:null
          });
        }
      }

      const multiPointGatePassed = multiPointIdentityCount>0 && maxObservedPointsPerIdentity>=2;
      const crossCycleGatePassed = crossCycleIdentityCount>0 && maxCyclesPerIdentity>=2;
      const coordinateChangeGatePassed = coordinateChangingIdentityCount>0 && maxUniqueCoordinatesPerIdentity>=2;
      const motionActivationGatePassed = motionReadyIdentityCount>0 && plausibleMotionSegmentCount>0;

      let status='TEMPORAL_SEQUENCE_READY_WAITING_FOR_COORDINATE_CHANGE';
      if (coordinateChangeGatePassed && !motionActivationGatePassed) status='COORDINATE_CHANGE_DETECTED_MOTION_FILTER_PENDING';
      if (motionActivationGatePassed) status='TEMPORAL_MOTION_ACTIVATED';

      const store={phase:PHASE,version:VERSION,build:BUILD,sourceName:source.sourceName,generatedAt:now(),sequences};
      global.RainGuardTemporalMotionActivationSequencesV39=store;
      if (cfg.persistLocalStorage) {
        try { global.localStorage.setItem(STORAGE_KEY,JSON.stringify(store)); } catch(_) {}
      }

      const result={success:true,phase:PHASE,version:VERSION,build:BUILD,status,
        selectedSourceName:source.sourceName,identityCount,observationCount,multiPointIdentityCount,crossCycleIdentityCount,
        coordinateChangingIdentityCount,motionReadyIdentityCount,changedSegmentCount,plausibleMotionSegmentCount,
        maxObservedPointsPerIdentity,maxCyclesPerIdentity,maxUniqueCoordinatesPerIdentity,maxMovementMeters,maxPlausibleSpeedKmh,
        multiPointGatePassed,crossCycleGatePassed,coordinateChangeGatePassed,motionActivationGatePassed,
        persistedToLocalStorage:!!cfg.persistLocalStorage,storageKey:STORAGE_KEY,sample:sample.slice(0,25),generatedAt:now(),durationMs:now()-startedAt};

      global.RainGuardCrossCycleCoordinateChangeDetectionTemporalMotionActivationResultV39=result;
      state.runs++; state.lastRun=result; state.lastError=null;
      if (cfg.logSummary) {
        console.log(`[RainGuard Phase ${PHASE}] Cross-Cycle Coordinate Change Detection & Temporal Motion Activation result:`);
        console.log(result);
        try { if (console.table) console.table(result.sample); } catch(_) {}
      }
      return result;
    } catch(error) {
      const result={success:false,phase:PHASE,version:VERSION,build:BUILD,status:'TEMPORAL_MOTION_ACTIVATION_FAILED',error:error&&error.message?error.message:safeString(error),generatedAt:now(),durationMs:now()-startedAt};
      state.lastRun=result; state.lastError=result.error; console.error(`[RainGuard Phase ${PHASE}] failed:`,error); return result;
    } finally { state.running=false; }
  }

  function diagnose() {
    const result={success:true,phase:PHASE,version:VERSION,build:BUILD,installed:true,running:state.running,runs:state.runs,lastError:state.lastError,lastRun:state.lastRun,sourceAvailable:!!getSource(),publishedStoreAvailable:!!global.RainGuardTemporalMotionActivationSequencesV39};
    console.log(`[RainGuard Phase ${PHASE}] Diagnostic:`,result); return result;
  }

  global.runRainGuardCrossCycleCoordinateChangeDetectionTemporalMotionActivationBridge=run;
  global.diagnoseRainGuardCrossCycleCoordinateChangeDetectionTemporalMotionActivationBridge=diagnose;
  global.RainGuardCrossCycleCoordinateChangeDetectionTemporalMotionActivationBridgeV39={phase:PHASE,version:VERSION,build:BUILD,run,diagnose,state};
})(window);
