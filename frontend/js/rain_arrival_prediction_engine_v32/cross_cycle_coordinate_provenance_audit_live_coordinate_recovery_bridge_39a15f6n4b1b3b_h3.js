(function (global) {
  "use strict";

  const PHASE = "39A-15F6N4B1B3B-H3";
  const VERSION = "39A.15F6N4B1B3B-H3.0";
  const BUILD = "rainguard-v39-cross-cycle-coordinate-provenance-audit-live-coordinate-recovery-bridge";

  if (global.__RainGuardN4B1B3BH3Installed) return;
  global.__RainGuardN4B1B3BH3Installed = true;

  const state = {installed:true,running:false,runs:0,lastRun:null,lastError:null};

  function isObj(v){ return !!v && typeof v === "object"; }
  function s(v){ try { return v == null ? "" : String(v); } catch(_) { return ""; } }
  function n(v){ const x=Number(v); return Number.isFinite(x) ? x : null; }
  function norm(v){ return s(v).trim().toLowerCase().replace(/\s+/g," "); }

  function idOf(r,fallback){
    if(!isObj(r)) return norm(fallback);
    const vals=[r.identity,r.authoritativeIdentity,r.persistentId,r.canonicalPersistentId,
      r.canonicalIdentity,r.identityKey,r.trackId,r.cellId,r.stormId,r.entityId,r.id];
    for(const v of vals){ const x=norm(v); if(x) return x; }
    return norm(fallback);
  }

  function tsOf(r){
    if(!isObj(r)) return null;
    const vals=[r.timestamp,r.timestampMs,r.observedAt,r.observationTime,r.observationTimestamp,
      r.capturedAt,r.captureTime,r.generatedAt,r.updatedAt,r.createdAt,r.time,r.datetime,
      r.dateTime,r.scanTimestamp,r.cycleTimestamp,r.lastSeenAt];
    for(const v of vals){
      if(v == null || v === "") continue;
      if(typeof v === "number" && Number.isFinite(v)){
        if(v > 1e12) return Math.round(v);
        if(v > 1e9) return Math.round(v*1000);
      }
      if(typeof v === "string"){
        const z=v.trim();
        if(/^\d{13,}$/.test(z)) return Number(z.slice(0,13));
        if(/^\d{10}$/.test(z)) return Number(z)*1000;
        const p=Date.parse(z);
        if(Number.isFinite(p)) return p;
      }
    }
    return null;
  }

  function cycleOf(r){
    if(!isObj(r)) return "";
    const vals=[r.cycleId,r.cycleID,r.cycle,r.cycleKey,r.scanCycleId,r.forecastCycleId,
      r.trackingCycleId,r.runtimeCycleId,r.sequenceId,r.cycleSequence];
    for(const v of vals){ const x=s(v).trim(); if(x) return x; }
    return "";
  }

  function coordOf(r){
    if(!isObj(r)) return null;
    const lat=n(r.latitude ?? r.lat ??
      (r.coordinate && (r.coordinate.latitude ?? r.coordinate.lat)) ??
      (r.coordinates && (r.coordinates.latitude ?? r.coordinates.lat)) ??
      (Array.isArray(r.coordinate) ? r.coordinate[0] : undefined) ??
      (Array.isArray(r.coordinates) ? r.coordinates[0] : undefined));
    const lon=n(r.longitude ?? r.lon ?? r.lng ??
      (r.coordinate && (r.coordinate.longitude ?? r.coordinate.lon ?? r.coordinate.lng)) ??
      (r.coordinates && (r.coordinates.longitude ?? r.coordinates.lon ?? r.coordinates.lng)) ??
      (Array.isArray(r.coordinate) ? r.coordinate[1] : undefined) ??
      (Array.isArray(r.coordinates) ? r.coordinates[1] : undefined));
    if(lat===null || lon===null || lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
    return {lat,lon};
  }

  function observationsOf(rec){
    if(!isObj(rec)) return [];
    if(Array.isArray(rec.observations)) return rec.observations.slice();
    if(Array.isArray(rec.history)) return rec.history.slice();
    if(Array.isArray(rec.temporalSequence)) return rec.temporalSequence.slice();
    if(Array.isArray(rec.points)) return rec.points.slice();
    return [];
  }

  function haversineMeters(a,b){
    if(!a || !b) return null;
    const R=6371000;
    const p1=a.lat*Math.PI/180, p2=b.lat*Math.PI/180;
    const dp=(b.lat-a.lat)*Math.PI/180, dl=(b.lon-a.lon)*Math.PI/180;
    const h=Math.sin(dp/2)**2 + Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;
    return 2*R*Math.asin(Math.min(1,Math.sqrt(h)));
  }

  function canonicalSource(){
    const c=[
      ["RainGuardN4B1B3BH2TemporalSequenceRepairV39",global.RainGuardN4B1B3BH2TemporalSequenceRepairV39],
      ["RainGuardCrossCycleTemporalAppendOverrideAccumulatorV39",global.RainGuardCrossCycleTemporalAppendOverrideAccumulatorV39],
      ["RainGuardH1CanonicalTemporalSourceV39",global.RainGuardH1CanonicalTemporalSourceV39],
      ["RainGuardH2RuntimeBoundTemporalSourceV39",global.RainGuardH2RuntimeBoundTemporalSourceV39]
    ];
    for(const [name,v] of c){
      if(isObj(v) && isObj(v.identities)) return {name,identities:v.identities,root:v};
    }
    return null;
  }

  function discoverLiveSources(){
    let keys=[];
    try { keys=Object.keys(global).slice(0,15000); } catch(_) {}
    const names=[];
    for(const k of keys){
      if(/live|storm|track|entity|radar|rain|cell|history/i.test(k) &&
         !/h3|result|diagnostic|canonical|temporalappendoverride/i.test(k) &&
         typeof global[k] !== "function"){
        names.push(k);
      }
    }
    const preferred=["RainArrivalStableStormEntities","RainGuardStableStormEntities",
      "RainArrivalLiveTrackHistory","RainGuardLiveTrackHistory",
      "RainArrivalLiveStormEntities","RainGuardLiveStormEntities"];
    return [...new Set([...preferred,...names])].filter(name=>global[name]!=null);
  }

  function collectLiveEvidence(){
    const byIdentity=new Map();
    const sources=discoverLiveSources();

    function push(id,rec,sourceName){
      const iid=idOf(rec,id);
      if(!iid) return;
      const c=coordOf(rec);
      if(!c) return;
      if(!byIdentity.has(iid)) byIdentity.set(iid,[]);
      byIdentity.get(iid).push({
        identity:iid,timestamp:tsOf(rec),cycleId:cycleOf(rec),
        lat:c.lat,lon:c.lon,sourceName
      });
    }

    function walk(value,sourceName,depth){
      if(depth>3 || !value) return;
      if(Array.isArray(value)){
        for(const rec of value.slice(0,6000)){
          if(!isObj(rec)) continue;
          const id=idOf(rec,"");
          if(id) push(id,rec,sourceName);
          for(const key of ["observations","history","points","temporalSequence"]){
            if(Array.isArray(rec[key])){
              for(const o of rec[key].slice(0,1500)) push(id,o,sourceName);
            }
          }
        }
        return;
      }
      if(!isObj(value)) return;
      if(isObj(value.identities)){ walk(value.identities,sourceName,depth+1); return; }
      let count=0;
      for(const [k,rec] of Object.entries(value)){
        if(++count>6000) break;
        if(!isObj(rec)) continue;
        const id=idOf(rec,k);
        if(id) push(id,rec,sourceName);
        for(const key of ["observations","history","points","temporalSequence"]){
          if(Array.isArray(rec[key])){
            for(const o of rec[key].slice(0,1500)) push(id,o,sourceName);
          }
        }
      }
    }

    for(const sourceName of sources){
      try { walk(global[sourceName],sourceName,0); } catch(_) {}
    }
    return {byIdentity,sourceNames:sources};
  }

  function bestLiveMatch(identity,obs,evidence){
    const pool=evidence.byIdentity.get(identity)||[];
    if(!pool.length) return null;
    const t=tsOf(obs), cyc=cycleOf(obs), stored=coordOf(obs);
    let best=null,bestScore=Infinity;

    for(const item of pool){
      let score=0;
      if(t!==null && item.timestamp!==null) score+=Math.abs(t-item.timestamp);
      else score+=1e12;
      if(cyc && item.cycleId) score += cyc===item.cycleId ? -5e10 : 5e10;
      if(stored){
        const d=haversineMeters(stored,{lat:item.lat,lon:item.lon});
        if(d!==null) score+=d*5000;
      } else score+=1e9;
      if(score<bestScore){ best=item; bestScore=score; }
    }

    if(!best) return null;
    const timeDelta=t!==null && best.timestamp!==null ? Math.abs(t-best.timestamp) : null;
    const cycleMatch=!!(cyc && best.cycleId && cyc===best.cycleId);
    const timeMatch=timeDelta!==null && timeDelta<=15*60*1000;
    if(!cycleMatch && !timeMatch) return null;
    return Object.assign({},best,{timeDeltaMs:timeDelta,cycleMatch});
  }

  async function run(options){
    const started=Date.now();
    if(state.running) return {success:false,phase:PHASE,version:VERSION,build:BUILD,status:"H3_ALREADY_RUNNING"};
    state.running=true;

    try{
      const opts=Object.assign({
        applyRecoveredCoordinates:true,
        minMovementMeters:250,
        invokeB1B3B:true,
        logTable:true,
        tableLimit:50
      },options||{});

      const source=canonicalSource();
      if(!source){
        const r={success:false,phase:PHASE,version:VERSION,build:BUILD,
          status:"NO_H2_CANONICAL_TEMPORAL_SOURCE_FOUND",
          generatedAt:Date.now(),durationMs:Date.now()-started};
        state.lastRun=r;
        return r;
      }

      const evidence=collectLiveEvidence();

      let identityCount=0,observationCount=0,auditedObservationCount=0,liveMatchCount=0;
      let recoveredCoordinateCount=0,changedLiveCoordinateCount=0,frozenStoredCoordinateCount=0;
      let coordinateChangingIdentityCountBefore=0,coordinateChangingIdentityCountAfter=0;
      let identitiesRecovered=0,maxRecoveredMovementMeters=0;

      const auditRows=[],repairedIdentities={};

      for(const [k,record] of Object.entries(source.identities||{})){
        if(!isObj(record)) continue;
        const id=idOf(record,k);
        if(!id) continue;
        identityCount++;

        const original=observationsOf(record);
        observationCount+=original.length;

        const originalUnique=new Set(
          original.map(coordOf).filter(Boolean).map(c=>c.lat.toFixed(7)+","+c.lon.toFixed(7))
        );
        if(originalUnique.size>=2) coordinateChangingIdentityCountBefore++;

        let identityRecovered=false;
        const repaired=[];

        for(const obs of original){
          const out=Object.assign({},obs);
          const stored=coordOf(obs);
          const live=bestLiveMatch(id,obs,evidence);

          let movement=null,liveCoordinateChanged=false,recovered=false;

          if(live){
            liveMatchCount++;
            if(stored){
              movement=haversineMeters(stored,{lat:live.lat,lon:live.lon});
              liveCoordinateChanged=movement!==null && movement>=opts.minMovementMeters;
              if(liveCoordinateChanged) changedLiveCoordinateCount++;
            }

            if(opts.applyRecoveredCoordinates && liveCoordinateChanged){
              out.latitude=live.lat;
              out.longitude=live.lon;
              out.lat=live.lat;
              out.lon=live.lon;
              out.lng=live.lon;
              out.coordinate={latitude:live.lat,longitude:live.lon};
              out.__n4b1b3bH3={
                coordinateRecovered:true,sourceName:live.sourceName,
                originalCoordinate:stored,recoveredCoordinate:{lat:live.lat,lon:live.lon},
                movementMeters:movement,liveTimestamp:live.timestamp,liveCycleId:live.cycleId
              };
              recovered=true;
              identityRecovered=true;
              recoveredCoordinateCount++;
              maxRecoveredMovementMeters=Math.max(maxRecoveredMovementMeters,movement||0);
            }
          }

          repaired.push(out);
          auditedObservationCount++;

          if(auditRows.length<opts.tableLimit){
            auditRows.push({
              identity:id,cycleId:cycleOf(obs),timestamp:tsOf(obs),
              storedLat:stored?stored.lat:null,storedLon:stored?stored.lon:null,
              liveLat:live?live.lat:null,liveLon:live?live.lon:null,
              movementMeters:movement===null?null:Math.round(movement),
              coordinateSource:live?live.sourceName:null,
              coordinateFrozen:!!(stored && live && movement!==null && movement<opts.minMovementMeters),
              liveCoordinateChanged,recovered
            });
          }
        }

        const afterUnique=new Set(
          repaired.map(coordOf).filter(Boolean).map(c=>c.lat.toFixed(7)+","+c.lon.toFixed(7))
        );
        if(afterUnique.size>=2) coordinateChangingIdentityCountAfter++;
        if(identityRecovered) identitiesRecovered++;

        repairedIdentities[id]=Object.assign({},record,{
          identity:id,observations:repaired,history:repaired,temporalSequence:repaired,
          coordinateCountBefore:originalUnique.size,
          coordinateCountAfter:afterUnique.size,
          coordinateRecoveryApplied:identityRecovered
        });
      }

      const recoveredSource={
        phase:PHASE,version:VERSION,build:BUILD,sourceName:source.name,
        recoveredAt:Date.now(),identities:repairedIdentities
      };

      global.RainGuardN4B1B3BH3RecoveredTemporalSourceV39=recoveredSource;
      global.RainGuardCrossCycleTemporalAppendOverrideAccumulatorV39=recoveredSource;
      global.RainGuardCrossCycleTemporalAppendOverrideHistoriesV39=recoveredSource.identities;

      let downstream={
        available:typeof global.runRainGuardCrossCycleCoordinateChangeDetectionTemporalMotionActivationBridge==="function",
        invoked:false,success:false
      };

      if(opts.invokeB1B3B && downstream.available){
        try{
          const rr=await global.runRainGuardCrossCycleCoordinateChangeDetectionTemporalMotionActivationBridge();
          downstream={available:true,invoked:true,success:!(rr&&rr.success===false),result:rr};
        }catch(e){
          downstream={available:true,invoked:true,success:false,error:e&&e.message?e.message:s(e)};
        }
      }

      let status;
      if(coordinateChangingIdentityCountAfter>0)
        status="LIVE_COORDINATE_RECOVERY_APPLIED_COORDINATE_CHANGE_READY";
      else if(liveMatchCount>0)
        status="COORDINATE_PROVENANCE_AUDITED_NO_TRUE_LIVE_COORDINATE_CHANGE_FOUND";
      else
        status="NO_MATCHING_LIVE_COORDINATE_EVIDENCE_FOUND";

      const result={
        success:true,phase:PHASE,version:VERSION,build:BUILD,status,
        selectedCanonicalSource:source.name,
        liveEvidenceSourceCount:evidence.sourceNames.length,
        liveEvidenceSourceNames:evidence.sourceNames.slice(0,50),
        identityCount,observationCount,auditedObservationCount,liveMatchCount,
        recoveredCoordinateCount,identitiesRecovered,changedLiveCoordinateCount,
        frozenStoredCoordinateCount,
        coordinateChangingIdentityCountBefore,
        coordinateChangingIdentityCountAfter,
        coordinateChangeRecoveryGatePassed:coordinateChangingIdentityCountAfter>0,
        maxRecoveredMovementMeters:Math.round(maxRecoveredMovementMeters),
        canonicalAccumulatorRepublished:true,
        canonicalHistoriesRepublished:true,
        auditSample:auditRows,
        downstream,
        generatedAt:Date.now(),
        durationMs:Date.now()-started
      };

      global.RainGuardN4B1B3BH3ResultV39=result;
      state.runs++;
      state.lastRun=result;
      state.lastError=null;

      console.log(`[RainGuard Phase ${PHASE}] Cross-Cycle Coordinate Provenance Audit & Live Coordinate Recovery result:`);
      console.log(result);
      if(opts.logTable && console.table){ try { console.table(auditRows); } catch(_) {} }
      return result;

    }catch(e){
      const r={success:false,phase:PHASE,version:VERSION,build:BUILD,
        status:"H3_COORDINATE_PROVENANCE_AUDIT_FAILED",
        error:e&&e.message?e.message:s(e),
        generatedAt:Date.now(),durationMs:Date.now()-started};
      state.lastRun=r;
      state.lastError=r.error;
      console.error(`[RainGuard Phase ${PHASE}] failed:`,e);
      return r;
    }finally{
      state.running=false;
    }
  }

  function diagnose(){
    const result={
      success:true,phase:PHASE,version:VERSION,build:BUILD,
      installed:true,running:state.running,runs:state.runs,
      h2SourceAvailable:!!global.RainGuardN4B1B3BH2TemporalSequenceRepairV39 ||
                        !!global.RainGuardCrossCycleTemporalAppendOverrideAccumulatorV39,
      b1b3bRunnerAvailable:
        typeof global.runRainGuardCrossCycleCoordinateChangeDetectionTemporalMotionActivationBridge==="function",
      lastError:state.lastError,lastRun:state.lastRun
    };
    console.log(`[RainGuard Phase ${PHASE}] Diagnostic:`,result);
    return result;
  }

  global.runRainGuardN4B1B3BH3CrossCycleCoordinateProvenanceAuditLiveCoordinateRecoveryBridge=run;
  global.diagnoseRainGuardN4B1B3BH3CrossCycleCoordinateProvenanceAuditLiveCoordinateRecoveryBridge=diagnose;
  global.RainGuardN4B1B3BH3BridgeV39={phase:PHASE,version:VERSION,build:BUILD,run,diagnose,state};

})(window);
