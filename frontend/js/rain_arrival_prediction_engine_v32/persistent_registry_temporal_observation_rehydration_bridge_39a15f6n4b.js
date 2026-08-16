/**
 * RainGuard AI V39
 * Phase 39A-15F6N4B — Persistent Registry Temporal Observation Rehydration Bridge
 * Version: 39A.15F6N4B.0
 */
(function (global) {
  "use strict";

  const PHASE = "39A-15F6N4B";
  const VERSION = "39A.15F6N4B.0";
  const BUILD = "rainguard-v39-persistent-registry-temporal-observation-rehydration-bridge";
  if (global.__RainGuardPersistentRegistryTemporalObservationRehydrationBridgeInstalled) return;
  global.__RainGuardPersistentRegistryTemporalObservationRehydrationBridgeInstalled = true;

  const state = {installed:true,running:false,lastRun:null,lastError:null};
  const isObj = v => !!v && typeof v === "object";
  const text = v => v == null ? "" : String(v).trim();
  const norm = v => text(v).toLowerCase().replace(/\s+/g," ").trim();
  const finite = v => { const n=Number(v); return Number.isFinite(n)?n:null; };

  function timeOf(r){
    if(!isObj(r)) return null;
    for(const k of ["observedAt","timestamp","time","ts","capturedAt","generatedAt","accumulatedAt","updatedAt","createdAt"]){
      const v=r[k]; if(v==null) continue;
      if(typeof v==="number" && Number.isFinite(v)) return v<1e12?v*1000:v;
      const t=Date.parse(v); if(Number.isFinite(t)) return t;
    }
    return null;
  }

  function coordsOf(r){
    if(!isObj(r)) return null;
    let lat=finite(r.latitude ?? r.lat), lon=finite(r.longitude ?? r.lon ?? r.lng);
    if((lat==null||lon==null) && isObj(r.coordinate)){
      lat=lat ?? finite(r.coordinate.latitude ?? r.coordinate.lat);
      lon=lon ?? finite(r.coordinate.longitude ?? r.coordinate.lon ?? r.coordinate.lng);
    }
    if((lat==null||lon==null) && isObj(r.coordinates)){
      lat=lat ?? finite(r.coordinates.latitude ?? r.coordinates.lat);
      lon=lon ?? finite(r.coordinates.longitude ?? r.coordinates.lon ?? r.coordinates.lng);
    }
    if(lat==null||lon==null||lat<-90||lat>90||lon<-180||lon>180||(lat===0&&lon===0)) return null;
    return {latitude:lat,longitude:lon};
  }

  function identityKeyOf(r){
    if(!isObj(r)) return "";
    for(const k of ["persistentId","canonicalPersistentId","recoveredPersistentId","canonicalTrackId","canonicalId","identityKey","recoveredIdentityKey","identity","trackId","cellId","stormId","entityId","id"]){
      const v=text(r[k]); if(v) return v;
    }
    return "";
  }

  function aliasesOf(r){
    const out=new Set();
    const add=v=>{const x=norm(v); if(x) out.add(x);};
    if(!isObj(r)) return out;
    for(const k of ["persistentId","canonicalPersistentId","recoveredPersistentId","canonicalTrackId","canonicalId","identityKey","recoveredIdentityKey","identity","trackId","cellId","stormId","entityId","id","name"]) add(r[k]);
    for(const k of ["aliases","identityAliases","trackAliases","historicalAliases","sourceAliases","candidateAliases"]){
      const arr=r[k]; if(!Array.isArray(arr)) continue;
      for(const a of arr){
        if(typeof a==="string"||typeof a==="number") add(a);
        else if(isObj(a)) for(const q of ["alias","id","trackId","cellId","persistentId","identity","stormId","entityId"]) add(a[q]);
      }
    }
    return out;
  }

  function toArray(v){
    if(!v) return [];
    if(Array.isArray(v)) return v;
    if(v instanceof Map || v instanceof Set) return Array.from(v.values());
    if(isObj(v)){
      for(const k of ["identities","persistentIdentities","authoritativeIdentities","integratedIdentities","records","items","data","history","observations","entities","tracks"]){
        const x=v[k]; if(Array.isArray(x)) return x; if(x instanceof Map||x instanceof Set) return Array.from(x.values());
      }
    }
    return [];
  }

  function registrySource(){
    for(const name of ["RainGuardIntegratedIdentityPersistentRegistryV39","RainGuardIntegratedPersistentIdentityRegistryV39","RainGuardPersistentIdentityRegistryV39","RainGuardAuthoritativePersistentStormIdentitiesV39","RainGuardIntegratedPersistentStormIdentitiesV39","RainGuardPersistentStormIdentitiesV39"]){
      try{ const value=global[name], ids=toArray(value); if(ids.length) return {name,value,identities:ids}; }catch(_){ }
    }
    return {name:null,value:null,identities:[]};
  }

  function flattenHistory(value,sourceName,limit){
    const out=[];
    function push(rec,inherited){
      if(!isObj(rec)||out.length>=limit) return;
      const c=coordsOf(rec), t=timeOf(rec), id=identityKeyOf(rec)||inherited||"";
      if(c&&t!=null) out.push({...rec,identity:id||rec.identity||null,latitude:c.latitude,longitude:c.longitude,observedAt:t,timestamp:t,source:rec.source||sourceName,__rehydrationSource:sourceName});
      for(const k of ["observations","history","points","records","samples"]){
        const arr=rec[k]; if(!Array.isArray(arr)) continue;
        for(const child of arr){ if(out.length>=limit) break; push(child,id); }
      }
    }
    if(value instanceof Map){
      for(const [key,val] of value.entries()){
        if(out.length>=limit) break;
        const arr=Array.isArray(val)?val:toArray(val);
        if(arr.length) for(const rec of arr){ if(out.length>=limit) break; push(rec,text(key)); }
        else push(val,text(key));
      }
      return out;
    }
    const arr=toArray(value); for(const rec of arr){ if(out.length>=limit) break; push(rec,""); }
    return out;
  }

  function historySources(limit){
    const names=["RainArrivalLiveTrackHistory","RainGuardLiveTrackHistory","RainGuardRecoveredLiveTrackHistoryV39","RainGuardPersistentObservationMemoryV39","RainGuardPersistentIdentityTemporalAccumulatorV39","RainGuardPersistentIdentityMotionRecordsV39","RainGuardHistoricalObservationIdentityKeyRecoveryV39","RainGuardRecoveredIdentityHistoricalBackfillIntegrationV39","RainGuardHistoricalBackfillPersistentIdentitiesV39","RainGuardStormTrackStoreV32"];
    const out=[],seen=new Set();
    const add=(name,val)=>{if(!val||seen.has(name)) return; seen.add(name); const rows=flattenHistory(val,name,limit); if(rows.length) out.push({name,rows});};
    for(const name of names){try{add(name,global[name]);}catch(_){}}
    try{
      for(const key of Object.keys(global).slice(0,3000)){
        const n=key.toLowerCase();
        if(!(n.includes("history")||n.includes("observation")||n.includes("temporal")||n.includes("trackstore"))) continue;
        try{add(key,global[key]);}catch(_){ }
      }
    }catch(_){ }
    return out;
  }

  function dedupeSort(rows,cfg){
    const sorted=rows.filter(r=>coordsOf(r)&&timeOf(r)!=null).sort((a,b)=>timeOf(a)-timeOf(b));
    const out=[];
    for(const r of sorted){
      const c=coordsOf(r), t=timeOf(r);
      if(!out.length){out.push({...r,latitude:c.latitude,longitude:c.longitude,observedAt:t,timestamp:t});continue;}
      const p=out[out.length-1], pc=coordsOf(p), pt=timeOf(p);
      const sameTime=Math.abs(t-pt)<cfg.minTimeDeltaMs;
      const sameCoord=Math.abs(c.latitude-pc.latitude)<=cfg.coordinateEpsilon&&Math.abs(c.longitude-pc.longitude)<=cfg.coordinateEpsilon;
      if(sameTime&&sameCoord) continue;
      out.push({...r,latitude:c.latitude,longitude:c.longitude,observedAt:t,timestamp:t});
    }
    return out.slice(-cfg.maxObservationsPerIdentity);
  }

  function mergeIdentity(identity,newRows,cfg){
    const existing=[];
    if(Array.isArray(identity.observations)) existing.push(...identity.observations);
    else if(Array.isArray(identity.history)) existing.push(...identity.history);
    const merged=dedupeSort([...existing,...newRows],cfg);
    const unique=new Set(merged.map(r=>{const c=coordsOf(r);return c?`${c.latitude.toFixed(5)},${c.longitude.toFixed(5)}`:"";}).filter(Boolean));
    return {...identity,observations:merged,history:merged,observationCount:merged.length,uniqueCoordinateCount:unique.size,firstObservedAt:merged.length?timeOf(merged[0]):identity.firstObservedAt??null,lastObservedAt:merged.length?timeOf(merged[merged.length-1]):identity.lastObservedAt??null,rehydratedAt:Date.now(),rehydratedBy:PHASE};
  }

  function publish(original,ids){
    global.RainGuardIntegratedIdentityPersistentRegistryV39=ids;
    global.RainGuardIntegratedPersistentIdentityRegistryV39=ids;
    global.RainGuardPersistentIdentityRegistryV39=ids;
    global.RainGuardAuthoritativePersistentStormIdentitiesV39=ids;
    global.RainGuardIntegratedPersistentStormIdentitiesV39=ids;
    global.RainGuardPersistentStormIdentitiesV39=ids;
    if(isObj(original)&&!Array.isArray(original)){
      try{original.identities=ids;original.records=ids;original.identityCount=ids.length;original.observationCount=ids.reduce((n,r)=>n+Number(r.observationCount||0),0);original.updatedAt=Date.now();}catch(_){ }
    }
  }

  async function run(options){
    const started=Date.now();
    if(state.running) return {success:false,phase:PHASE,version:VERSION,build:BUILD,status:"TEMPORAL_REHYDRATION_ALREADY_RUNNING"};
    state.running=true;
    try{
      const cfg=Object.assign({maxRegistryIdentities:5000,maxHistoryRecords:20000,maxObservationsPerIdentity:24,minTimeDeltaMs:1000,coordinateEpsilon:0.00001,persistToLocalStorage:true},isObj(options)?options:{});
      const reg=registrySource();
      if(!reg.identities.length){const r={success:false,phase:PHASE,version:VERSION,build:BUILD,status:"NO_PERSISTENT_REGISTRY_IDENTITIES_FOUND"};state.lastRun=r;return r;}
      const identities=reg.identities.slice(0,cfg.maxRegistryIdentities);
      const sources=historySources(cfg.maxHistoryRecords);
      const historyRows=sources.flatMap(s=>s.rows).slice(0,cfg.maxHistoryRecords);

      const aliasIndex=new Map();
      identities.forEach((id,idx)=>{for(const a of aliasesOf(id)){if(!aliasIndex.has(a)) aliasIndex.set(a,new Set());aliasIndex.get(a).add(idx);}});
      const matched=new Map(); let aliasMatchCount=0,unmatched=0;
      for(const row of historyRows){
        const hits=new Set();
        for(const a of aliasesOf(row)){const set=aliasIndex.get(a);if(set) for(const idx of set) hits.add(idx);}
        if(hits.size){for(const idx of hits){if(!matched.has(idx)) matched.set(idx,[]);matched.get(idx).push(row);aliasMatchCount++;}}
        else unmatched++;
      }

      let multiBefore=0,multiAfter=0,changed=0,addedTotal=0,idsWithNew=0,maxUnique=0;
      const updated=identities.map((id,idx)=>{
        const before=Array.isArray(id.observations)?id.observations:(Array.isArray(id.history)?id.history:[]);
        if(before.length>1) multiBefore++;
        const merged=mergeIdentity(id,matched.get(idx)||[],cfg);
        const added=Math.max(0,merged.observationCount-before.length); if(added){idsWithNew++;addedTotal+=added;}
        if(merged.observationCount>1) multiAfter++;
        if(merged.uniqueCoordinateCount>1) changed++;
        maxUnique=Math.max(maxUnique,merged.uniqueCoordinateCount||0);
        return merged;
      });

      publish(reg.value,updated);
      if(cfg.persistToLocalStorage){try{localStorage.setItem("RainGuardIntegratedIdentityPersistentRegistryV39",JSON.stringify({phase:PHASE,version:VERSION,generatedAt:Date.now(),identities:updated}));}catch(_){}}
      const observationCount=updated.reduce((n,r)=>n+Number(r.observationCount||0),0);
      const result={success:true,phase:PHASE,version:VERSION,build:BUILD,status:changed>0?"PERSISTENT_REGISTRY_TEMPORAL_OBSERVATIONS_REHYDRATED":"PERSISTENT_REGISTRY_REHYDRATED_BUT_NO_COORDINATE_CHANGE_YET",registrySourceName:reg.name,identityCount:updated.length,sourceCount:sources.length,sourceNames:sources.map(s=>s.name),historyRecordCount:historyRows.length,identitiesWithNewObservations:idsWithNew,observationsAddedCount:addedTotal,observationCount,multiPointIdentityCountBefore:multiBefore,multiPointIdentityCount:multiAfter,coordinateChangingIdentityCount:changed,maxUniqueCoordinatesPerIdentity:maxUnique,aliasMatchCount,unmatchedHistoryRecordCount:unmatched,persistedToLocalStorage:!!cfg.persistToLocalStorage,generatedAt:Date.now(),durationMs:Date.now()-started,identitySample:updated.slice(0,20)};
      global.RainGuardPersistentRegistryTemporalObservationRehydrationV39=result;state.lastRun=result;state.lastError=null;
      console.log(`[RainGuard Phase ${PHASE}] Persistent Registry Temporal Observation Rehydration result:`,result);
      return result;
    }catch(e){const r={success:false,phase:PHASE,version:VERSION,build:BUILD,status:"PERSISTENT_REGISTRY_TEMPORAL_REHYDRATION_FAILED",error:e&&e.message?e.message:String(e)};state.lastRun=r;state.lastError=r.error;console.error(r);return r;}finally{state.running=false;}
  }

  function diagnose(){
    const reg=registrySource(), sources=historySources(20000);
    const r={success:true,phase:PHASE,version:VERSION,build:BUILD,installed:true,running:state.running,registrySourceName:reg.name,registryIdentityCount:reg.identities.length,historySources:sources.map(s=>({name:s.name,count:s.rows.length})),lastRun:state.lastRun,lastError:state.lastError};
    console.log(`[RainGuard Phase ${PHASE}] Diagnostic:`,r);return r;
  }

  global.runRainGuardPersistentRegistryTemporalObservationRehydrationBridge=run;
  global.diagnoseRainGuardPersistentRegistryTemporalObservationRehydrationBridge=diagnose;
  global.RainGuardPersistentRegistryTemporalObservationRehydrationBridgeV39={phase:PHASE,version:VERSION,build:BUILD,run,diagnose,state};
})(window);
