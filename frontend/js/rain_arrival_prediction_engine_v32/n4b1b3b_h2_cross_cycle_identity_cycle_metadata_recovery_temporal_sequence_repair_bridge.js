(function (global) {
  "use strict";

  const PHASE = "39A-15F6N4B1B3B-H2";
  const VERSION = "39A.15F6N4B1B3B-H2.0";
  const BUILD = "rainguard-v39-cross-cycle-identity-cycle-metadata-recovery-temporal-sequence-repair-bridge";

  if (global.__RainGuardN4B1B3BH2Installed) return;
  global.__RainGuardN4B1B3BH2Installed = true;

  const state = { installed:true, running:false, runs:0, lastRun:null, lastError:null };

  function isObj(v){ return !!v && typeof v === "object"; }
  function str(v){ try { return v == null ? "" : String(v); } catch(_) { return ""; } }
  function norm(v){ return str(v).trim().toLowerCase().replace(/\s+/g," "); }
  function finite(v){ const n=Number(v); return Number.isFinite(n) ? n : null; }

  function identity(r, fallback){
    if(!isObj(r)) return norm(fallback);
    const vals = [
      r.identity, r.authoritativeIdentity, r.persistentId, r.canonicalPersistentId,
      r.canonicalIdentity, r.identityKey, r.trackId, r.cellId, r.stormId,
      r.entityId, r.id
    ];
    for(const v of vals){ const x=norm(v); if(x) return x; }
    return norm(fallback);
  }

  function coord(r){
    if(!isObj(r)) return null;
    const lat = finite(
      r.latitude ?? r.lat ??
      (r.coordinate && (r.coordinate.latitude ?? r.coordinate.lat)) ??
      (r.coordinates && (r.coordinates.latitude ?? r.coordinates.lat)) ??
      (Array.isArray(r.coordinate) ? r.coordinate[0] : undefined) ??
      (Array.isArray(r.coordinates) ? r.coordinates[0] : undefined)
    );
    const lon = finite(
      r.longitude ?? r.lon ?? r.lng ??
      (r.coordinate && (r.coordinate.longitude ?? r.coordinate.lon ?? r.coordinate.lng)) ??
      (r.coordinates && (r.coordinates.longitude ?? r.coordinates.lon ?? r.coordinates.lng)) ??
      (Array.isArray(r.coordinate) ? r.coordinate[1] : undefined) ??
      (Array.isArray(r.coordinates) ? r.coordinates[1] : undefined)
    );
    if(lat === null || lon === null || lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
    return {latitude:lat, longitude:lon};
  }

  function parseTimestamp(v){
    if(v == null || v === "") return null;
    if(typeof v === "number" && Number.isFinite(v)){
      if(v > 1e12) return Math.round(v);
      if(v > 1e9) return Math.round(v * 1000);
      return null;
    }
    if(typeof v === "string"){
      const s=v.trim();
      if(!s) return null;
      if(/^\d{13,}$/.test(s)) return Number(s.slice(0,13));
      if(/^\d{10}$/.test(s)) return Number(s)*1000;
      const p=Date.parse(s);
      return Number.isFinite(p) ? p : null;
    }
    if(v instanceof Date){
      const t=v.getTime();
      return Number.isFinite(t) ? t : null;
    }
    return null;
  }

  function timestampOf(r){
    if(!isObj(r)) return null;
    const vals = [
      r.timestamp, r.timestampMs, r.observedAt, r.observationTime, r.observationTimestamp,
      r.capturedAt, r.captureTime, r.generatedAt, r.updatedAt, r.createdAt, r.time,
      r.datetime, r.dateTime, r.scanTimestamp, r.cycleTimestamp, r.lastSeenAt,
      r.firstSeenAt, r.radarTimestamp, r.sourceTimestamp
    ];
    for(const v of vals){
      const t=parseTimestamp(v);
      if(t !== null) return t;
    }
    if(isObj(r.metadata)){
      for(const k of ["timestamp","observedAt","capturedAt","generatedAt","updatedAt","cycleTimestamp"]){
        const t=parseTimestamp(r.metadata[k]);
        if(t !== null) return t;
      }
    }
    return null;
  }

  function explicitCycleOf(r){
    if(!isObj(r)) return "";
    const vals = [
      r.cycleId, r.cycleID, r.cycle, r.cycleKey, r.scanCycleId,
      r.forecastCycleId, r.trackingCycleId, r.runtimeCycleId,
      r.sequenceId, r.cycleSequence
    ];
    if(isObj(r.metadata)){
      vals.push(r.metadata.cycleId, r.metadata.cycleID, r.metadata.cycle,
                r.metadata.sequenceId, r.metadata.cycleSequence);
    }
    for(const v of vals){
      const x=str(v).trim();
      if(x) return x;
    }
    return "";
  }

  function sourceObservations(record){
    if(!isObj(record)) return [];
    if(Array.isArray(record.observations)) return record.observations.slice();
    if(Array.isArray(record.history)) return record.history.slice();
    if(Array.isArray(record.points)) return record.points.slice();
    if(coord(record)) return [record];
    return [];
  }

  function canonicalSource(){
    const preferred = [
      ["RainGuardCrossCycleTemporalAppendOverrideAccumulatorV39", global.RainGuardCrossCycleTemporalAppendOverrideAccumulatorV39],
      ["RainGuardN4B1B3ABoundTemporalSourceV39.accumulator",
        global.RainGuardN4B1B3ABoundTemporalSourceV39 && global.RainGuardN4B1B3ABoundTemporalSourceV39.accumulator],
      ["RainGuardCrossCycleTemporalAppendOverrideHistoriesV39", global.RainGuardCrossCycleTemporalAppendOverrideHistoriesV39]
    ];

    for(const [name,value] of preferred){
      if(!value) continue;
      if(isObj(value.identities)) return {name, identities:value.identities, root:value};
      if(isObj(value) && !Array.isArray(value)) return {name, identities:value, root:value};
    }
    return null;
  }

  function discoverCycleEvidence(){
    const names = [];
    let keys=[];
    try { keys=Object.keys(global).slice(0,15000); } catch(_) {}
    for(const k of keys){
      if(/cycle|track.?history|live.?track|temporal|observation|storm/i.test(k) &&
         !/h2|result|diagnostic/i.test(k) &&
         typeof global[k] !== "function"){
        names.push(k);
      }
    }
    return names.slice(0,1500);
  }

  function collectExternalEvidence(){
    const byIdentity = new Map();
    const sources = discoverCycleEvidence();

    function add(id, rec, sourceName){
      const iid=identity(rec,id);
      if(!iid) return;
      const t=timestampOf(rec);
      const c=explicitCycleOf(rec);
      const xy=coord(rec);
      if(t===null && !c) return;
      if(!byIdentity.has(iid)) byIdentity.set(iid,[]);
      byIdentity.get(iid).push({timestamp:t, cycleId:c, coordinate:xy, sourceName});
    }

    function walk(value, sourceName, depth){
      if(depth>3 || !value) return;
      if(Array.isArray(value)){
        for(const r of value.slice(0,5000)){
          if(!isObj(r)) continue;
          const id=identity(r,"");
          if(id) add(id,r,sourceName);
          for(const arrName of ["observations","history","points"]){
            if(Array.isArray(r[arrName])){
              for(const o of r[arrName].slice(0,1000)) add(id,o,sourceName);
            }
          }
        }
        return;
      }
      if(!isObj(value)) return;
      if(isObj(value.identities)){ walk(value.identities,sourceName,depth+1); return; }
      let n=0;
      for(const [k,r] of Object.entries(value)){
        if(++n>5000) break;
        if(!isObj(r)) continue;
        const id=identity(r,k);
        if(id) add(id,r,sourceName);
        for(const arrName of ["observations","history","points"]){
          if(Array.isArray(r[arrName])){
            for(const o of r[arrName].slice(0,1000)) add(id,o,sourceName);
          }
        }
      }
    }

    for(const name of sources){
      try { walk(global[name],name,0); } catch(_) {}
    }
    return {byIdentity, sourceCount:sources.length};
  }

  function nearestExternalCycle(id, obs, evidence){
    const list=evidence.byIdentity.get(id) || [];
    if(!list.length) return null;
    const t=timestampOf(obs);
    const xy=coord(obs);

    let best=null, bestScore=Infinity;
    for(const e of list){
      let score=0;
      if(t!==null && e.timestamp!==null) score += Math.abs(t-e.timestamp);
      else score += 1e12;

      if(xy && e.coordinate){
        score += (Math.abs(xy.latitude-e.coordinate.latitude)+Math.abs(xy.longitude-e.coordinate.longitude))*1e8;
      } else score += 1e9;

      if(score<bestScore){ best=e; bestScore=score; }
    }

    if(!best) return null;
    // Do not bind remote evidence: <= 10 min if timestamp exists, or exact coordinate + explicit cycle.
    if(t!==null && best.timestamp!==null && Math.abs(t-best.timestamp)<=600000) return best;
    if(xy && best.coordinate &&
       Math.abs(xy.latitude-best.coordinate.latitude)<1e-7 &&
       Math.abs(xy.longitude-best.coordinate.longitude)<1e-7 &&
       best.cycleId) return best;
    return null;
  }

  function repairObservation(id, obs, index, evidence){
    const out=Object.assign({},obs);
    const originalCycle=explicitCycleOf(obs);
    const ts=timestampOf(obs);
    const external=nearestExternalCycle(id,obs,evidence);

    let cycleId=originalCycle;
    let cycleRecovery="EXPLICIT";

    if(!cycleId && external && external.cycleId){
      cycleId=external.cycleId;
      cycleRecovery="EXTERNAL_MATCH";
    }

    // A timestamp is genuine temporal evidence. We may derive a deterministic
    // cycle key from it, but never fabricate a second cycle without a distinct timestamp.
    if(!cycleId && ts!==null){
      cycleId="ts:"+ts;
      cycleRecovery="TIMESTAMP_DERIVED";
    }

    if(cycleId) out.cycleId=cycleId;
    if(ts!==null){
      out.timestamp=ts;
      out.timestampMs=ts;
    }
    out.__n4b1b3bH2 = {
      repaired:true,
      identity:id,
      observationIndex:index,
      cycleRecovery,
      timestampRecovered:ts!==null,
      externalSource:external ? external.sourceName : null
    };
    return out;
  }

  function temporalDedup(obs){
    const seen=new Set(), out=[];
    for(const o of obs){
      const xy=coord(o);
      const t=timestampOf(o);
      const c=explicitCycleOf(o);
      // Timestamp-aware de-duplication: same identity stream + same time + same coordinate = same observation.
      const key=[
        t===null ? "no-ts" : t,
        c || "no-cycle",
        xy ? xy.latitude.toFixed(7) : "no-lat",
        xy ? xy.longitude.toFixed(7) : "no-lon"
      ].join("|");
      if(seen.has(key)) continue;
      seen.add(key);
      out.push(o);
    }
    out.sort((a,b)=>{
      const ta=timestampOf(a), tb=timestampOf(b);
      if(ta===null && tb===null) return 0;
      if(ta===null) return 1;
      if(tb===null) return -1;
      return ta-tb;
    });
    return out;
  }

  async function run(options){
    const started=Date.now();
    if(state.running){
      return {success:false,phase:PHASE,version:VERSION,build:BUILD,status:"H2_ALREADY_RUNNING"};
    }
    state.running=true;

    try{
      const opts=Object.assign({invokeDownstream:true,logTable:true},options||{});
      const source=canonicalSource();
      if(!source){
        const r={success:false,phase:PHASE,version:VERSION,build:BUILD,
          status:"NO_H1_CANONICAL_TEMPORAL_SOURCE_FOUND",generatedAt:Date.now(),durationMs:Date.now()-started};
        state.lastRun=r; return r;
      }

      const evidence=collectExternalEvidence();
      const repaired={
        phase:PHASE, version:VERSION, build:BUILD,
        sourceName:source.name, repairedAt:Date.now(), identities:{}
      };

      let identityCount=0, observationCountBefore=0, observationCountAfter=0;
      let timestampedObservationCount=0, explicitCycleObservationCount=0;
      let recoveredCycleObservationCount=0, timestampDerivedCycleCount=0;
      let externalCycleRecoveryCount=0, duplicateObservationCount=0;
      let multiPointIdentityCount=0, crossCycleIdentityCount=0, maxCyclesPerIdentity=0;
      let coordinateChangingIdentityCount=0, timestampOrderedIdentityCount=0;
      const sample=[];

      for(const [k,record] of Object.entries(source.identities||{})){
        if(!isObj(record)) continue;
        const id=identity(record,k);
        if(!id) continue;
        identityCount++;

        const original=sourceObservations(record);
        observationCountBefore += original.length;

        const repairedObs=original.map((o,i)=>repairObservation(id,o,i,evidence));
        for(const o of repairedObs){
          if(timestampOf(o)!==null) timestampedObservationCount++;
          const meta=o.__n4b1b3bH2 || {};
          if(meta.cycleRecovery==="EXPLICIT") explicitCycleObservationCount++;
          if(meta.cycleRecovery==="EXTERNAL_MATCH"){
            recoveredCycleObservationCount++; externalCycleRecoveryCount++;
          }
          if(meta.cycleRecovery==="TIMESTAMP_DERIVED"){
            recoveredCycleObservationCount++; timestampDerivedCycleCount++;
          }
        }

        const clean=temporalDedup(repairedObs);
        duplicateObservationCount += Math.max(0,repairedObs.length-clean.length);
        observationCountAfter += clean.length;

        const cycles=new Set(clean.map(explicitCycleOf).filter(Boolean));
        const timestamps=[...new Set(clean.map(timestampOf).filter(t=>t!==null))].sort((a,b)=>a-b);
        const coords=[...new Set(clean.map(coord).filter(Boolean).map(x=>x.latitude.toFixed(7)+","+x.longitude.toFixed(7)))];

        if(clean.length>=2) multiPointIdentityCount++;
        if(timestamps.length>=2) timestampOrderedIdentityCount++;
        if(cycles.size>=2 && timestamps.length>=2) crossCycleIdentityCount++;
        if(coords.length>=2 && timestamps.length>=2) coordinateChangingIdentityCount++;
        maxCyclesPerIdentity=Math.max(maxCyclesPerIdentity,cycles.size);

        repaired.identities[id]=Object.assign({},record,{
          identity:id,
          observations:clean,
          history:clean,
          temporalSequence:clean,
          cycleCount:cycles.size,
          timestampCount:timestamps.length,
          firstTimestamp:timestamps.length ? timestamps[0] : null,
          lastTimestamp:timestamps.length ? timestamps[timestamps.length-1] : null,
          coordinateCount:coords.length,
          crossCycleReady:cycles.size>=2 && timestamps.length>=2,
          coordinateChangeReady:coords.length>=2 && timestamps.length>=2
        });

        if(sample.length<25 && (clean.length>=2 || cycles.size>=2 || coords.length>=2)){
          sample.push({
            identity:id, observations:clean.length, cycles:cycles.size,
            timestamps:timestamps.length, coordinates:coords.length,
            crossCycle:cycles.size>=2 && timestamps.length>=2,
            coordinateChange:coords.length>=2 && timestamps.length>=2
          });
        }
      }

      const temporalSequenceGatePassed =
        crossCycleIdentityCount>0 && maxCyclesPerIdentity>=2 && timestampOrderedIdentityCount>0;

      // Publish repaired canonical source under H1's canonical names so B1B3B consumes it.
      global.RainGuardCrossCycleTemporalAppendOverrideAccumulatorV39 = repaired;
      global.RainGuardCrossCycleTemporalAppendOverrideHistoriesV39 = repaired.identities;
      global.RainGuardN4B1B3BH2TemporalSequenceRepairV39 = repaired;

      let downstream={
        invoked:false,
        available:typeof global.runRainGuardCrossCycleCoordinateChangeDetectionTemporalMotionActivationBridge==="function"
      };

      if(opts.invokeDownstream && downstream.available){
        try{
          const rr=await global.runRainGuardCrossCycleCoordinateChangeDetectionTemporalMotionActivationBridge();
          downstream={invoked:true,available:true,success:!(rr&&rr.success===false),result:rr};
        }catch(e){
          downstream={invoked:true,available:true,success:false,error:e&&e.message?e.message:str(e)};
        }
      }

      let status;
      if(temporalSequenceGatePassed && coordinateChangingIdentityCount>0)
        status="H2_TEMPORAL_SEQUENCE_REPAIRED_COORDINATE_CHANGE_READY";
      else if(temporalSequenceGatePassed)
        status="H2_CROSS_CYCLE_TEMPORAL_SEQUENCE_REPAIRED_WAITING_FOR_COORDINATE_CHANGE";
      else if(timestampedObservationCount>0)
        status="H2_TIMESTAMP_METADATA_RECOVERED_BUT_NO_CONFIRMED_CROSS_CYCLE_SEQUENCE";
      else
        status="H2_NO_GENUINE_TEMPORAL_METADATA_AVAILABLE";

      const result={
        success:identityCount>0,
        phase:PHASE,version:VERSION,build:BUILD,status,
        selectedSourceName:source.name,
        externalEvidenceSourceCount:evidence.sourceCount,
        identityCount,
        observationCountBefore,
        observationCount:observationCountAfter,
        timestampedObservationCount,
        explicitCycleObservationCount,
        recoveredCycleObservationCount,
        timestampDerivedCycleCount,
        externalCycleRecoveryCount,
        duplicateObservationCount,
        multiPointIdentityCount,
        crossCycleIdentityCount,
        maxCyclesPerIdentity,
        timestampOrderedIdentityCount,
        coordinateChangingIdentityCount,
        temporalSequenceGatePassed,
        canonicalAccumulatorPublished:true,
        canonicalHistoriesPublished:true,
        persistedToLocalStorage:false,
        sample,
        downstream,
        generatedAt:Date.now(),
        durationMs:Date.now()-started
      };

      try{
        localStorage.setItem("RainGuard:39A15F6N4B1B3B-H2:temporalSequenceRepairSummary",
          JSON.stringify({
            phase:PHASE,version:VERSION,generatedAt:result.generatedAt,
            identityCount,observationCount:observationCountAfter,
            crossCycleIdentityCount,maxCyclesPerIdentity,
            coordinateChangingIdentityCount,temporalSequenceGatePassed
          }));
        result.persistedToLocalStorage=true;
      }catch(_){}

      global.RainGuardN4B1B3BH2ResultV39=result;
      state.runs++; state.lastRun=result; state.lastError=null;

      console.log(`[RainGuard Phase ${PHASE}] Cross-Cycle Identity Cycle-Metadata Recovery & Temporal Sequence Repair result:`);
      console.log(result);
      if(opts.logTable && console.table){ try{ console.table(sample); }catch(_){} }
      return result;

    }catch(e){
      const r={success:false,phase:PHASE,version:VERSION,build:BUILD,
        status:"H2_TEMPORAL_SEQUENCE_REPAIR_FAILED",
        error:e&&e.message?e.message:str(e),generatedAt:Date.now(),durationMs:Date.now()-started};
      state.lastRun=r; state.lastError=r.error;
      console.error(`[RainGuard Phase ${PHASE}] failed:`,e);
      return r;
    }finally{ state.running=false; }
  }

  function diagnose(){
    const r={
      success:true,phase:PHASE,version:VERSION,build:BUILD,
      installed:true,running:state.running,runs:state.runs,
      h1CanonicalAccumulatorAvailable:!!global.RainGuardCrossCycleTemporalAppendOverrideAccumulatorV39,
      h1BoundSourceAvailable:!!global.RainGuardN4B1B3ABoundTemporalSourceV39,
      downstreamAvailable:typeof global.runRainGuardCrossCycleCoordinateChangeDetectionTemporalMotionActivationBridge==="function",
      lastError:state.lastError,lastRun:state.lastRun
    };
    console.log(`[RainGuard Phase ${PHASE}] Diagnostic:`,r);
    return r;
  }

  global.runRainGuardN4B1B3BH2CrossCycleIdentityCycleMetadataRecoveryTemporalSequenceRepairBridge=run;
  global.diagnoseRainGuardN4B1B3BH2CrossCycleIdentityCycleMetadataRecoveryTemporalSequenceRepairBridge=diagnose;
  global.RainGuardN4B1B3BH2BridgeV39={phase:PHASE,version:VERSION,build:BUILD,run,diagnose,state};

})(window);
