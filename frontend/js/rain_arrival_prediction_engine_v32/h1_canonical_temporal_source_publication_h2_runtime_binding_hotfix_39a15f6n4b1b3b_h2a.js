(function (global) {
  "use strict";

  const PHASE = "39A-15F6N4B1B3B-H2A";
  const VERSION = "39A.15F6N4B1B3B-H2A.0";
  const BUILD = "rainguard-v39-h1-canonical-temporal-source-publication-h2-runtime-binding-hotfix";

  if (global.__RainGuardN4B1B3BH2AInstalled) return;
  global.__RainGuardN4B1B3BH2AInstalled = true;

  const state = {installed:true,running:false,runs:0,lastRun:null,lastError:null,selectedSourceName:null};

  function isObj(v){ return !!v && typeof v === "object"; }
  function str(v){ try{return v==null?"":String(v);}catch(_){return "";} }
  function norm(v){ return str(v).trim().toLowerCase().replace(/\s+/g," "); }

  function identityOf(r,fallback){
    if(!isObj(r)) return norm(fallback);
    const vals=[r.identity,r.authoritativeIdentity,r.persistentId,r.canonicalPersistentId,
      r.canonicalIdentity,r.identityKey,r.trackId,r.cellId,r.stormId,r.entityId,r.id,r.name,r.key];
    for(const v of vals){ const x=norm(v); if(x) return x; }
    return norm(fallback);
  }

  function observationsOf(r){
    if(!isObj(r)) return [];
    if(Array.isArray(r.observations)) return r.observations.slice();
    if(Array.isArray(r.history)) return r.history.slice();
    if(Array.isArray(r.points)) return r.points.slice();
    if(Array.isArray(r.temporalSequence)) return r.temporalSequence.slice();
    return [];
  }

  function normalizeIdentityMap(value){
    if(!value) return null;

    if(isObj(value.identities)) return normalizeIdentityMap(value.identities);

    if(Array.isArray(value)){
      const out={};
      for(const rec of value){
        if(!isObj(rec)) continue;
        const id=identityOf(rec,"");
        if(!id) continue;
        if(!out[id]) out[id]={identity:id,observations:[]};
        const obs=observationsOf(rec);
        if(obs.length) out[id].observations.push(...obs);
        else out[id].observations.push(rec);
      }
      return Object.keys(out).length?out:null;
    }

    if(isObj(value)){
      const out={};
      let accepted=0;
      for(const [k,rec] of Object.entries(value)){
        if(!isObj(rec)) continue;
        const id=identityOf(rec,k);
        if(!id) continue;
        const obs=observationsOf(rec);
        out[id]=Object.assign({},rec,{identity:id,observations:obs});
        accepted++;
      }
      return accepted?out:null;
    }

    return null;
  }

  function inspect(name,value){
    const identities=normalizeIdentityMap(value);
    if(!identities) return null;

    let identityCount=0,observationCount=0,multiPointIdentityCount=0;
    for(const rec of Object.values(identities)){
      identityCount++;
      const obs=observationsOf(rec);
      observationCount+=obs.length;
      if(obs.length>=2) multiPointIdentityCount++;
    }

    const lname=str(name).toLowerCase();
    let score=0;
    if(lname.includes("n4b1b3a")) score+=120;
    if(lname.includes("canonical")) score+=80;
    if(lname.includes("boundtemporalsource")) score+=80;
    if(lname.includes("crosscycle")) score+=60;
    if(lname.includes("temporal")) score+=50;
    if(lname.includes("append")) score+=30;
    if(lname.includes("override")) score+=30;
    if(lname.includes("stable")) score+=15;
    if(lname.includes("stormentities")) score+=15;
    if(lname.includes("history")) score+=20;
    if(lname.includes("diagnostic")) score-=50;
    if(identityCount>=100) score+=25;
    if(observationCount>identityCount) score+=35;
    if(multiPointIdentityCount>0) score+=35;

    return {sourceName:name,value,identities,score,identityCount,observationCount,multiPointIdentityCount};
  }

  function discoverCandidates(){
    const preferred=[
      "RainGuardCrossCycleTemporalAppendOverrideAccumulatorV39",
      "RainGuardCrossCycleTemporalAppendOverrideHistoriesV39",
      "RainGuardN4B1B3ABoundTemporalSourceV39",
      "RainGuardN4B1B3ARuntimeSourceDiscoveryBindingHotfixResultV39",
      "RainArrivalStableStormEntities",
      "RainGuardStableStormEntities",
      "RainGuardRuntimeAuthoritativePersistentIdentityRegistryV39",
      "RainGuardAuthoritativePersistentStormIdentitiesV39",
      "RainArrivalLiveTrackHistory"
    ];

    const found=[],seen=new Set();

    function add(name,value){
      if(!name||seen.has(name)) return;
      seen.add(name);
      if(!value||typeof value==="function") return;

      if(isObj(value) && value.selectedSourceName && global[value.selectedSourceName]){
        const nested=inspect(value.selectedSourceName,global[value.selectedSourceName]);
        if(nested) found.push(nested);
      }
      if(isObj(value) && value.accumulator){
        const nested=inspect(name+".accumulator",value.accumulator);
        if(nested) found.push(nested);
      }
      const c=inspect(name,value);
      if(c) found.push(c);
    }

    for(const name of preferred){ try{add(name,global[name]);}catch(_){} }

    let keys=[];
    try{keys=Object.keys(global).slice(0,15000);}catch(_){}
    for(const name of keys){
      if(!/rain|storm|identity|temporal|append|history|cycle|registry|stable/i.test(name)) continue;
      try{add(name,global[name]);}catch(_){}
    }

    found.sort((a,b)=>b.score-a.score ||
      b.multiPointIdentityCount-a.multiPointIdentityCount ||
      b.observationCount-a.observationCount ||
      b.identityCount-a.identityCount);

    return found;
  }

  function buildCanonical(selected){
    const identities={};
    for(const [k,rec] of Object.entries(selected.identities||{})){
      if(!isObj(rec)) continue;
      const id=identityOf(rec,k);
      if(!id) continue;
      identities[id]=Object.assign({},rec,{identity:id,observations:observationsOf(rec)});
    }
    return {
      phase:"39A-15F6N4B1B3A",
      version:"39A.15F6N4B1B3A.h2a-canonical",
      sourceName:selected.sourceName,
      publishedByPhase:PHASE,
      publishedAt:Date.now(),
      identities
    };
  }

  async function run(options){
    const startedAt=Date.now();
    if(state.running) return {success:false,phase:PHASE,version:VERSION,build:BUILD,status:"H2A_ALREADY_RUNNING"};
    state.running=true;

    try{
      const opts=Object.assign({invokeH2:true,logCandidates:true,tableLimit:25},options||{});

      let h1Refresh={
        available:typeof global.runRainGuardN4B1B3ARuntimeSourceDiscoveryBindingHotfix==="function",
        invoked:false,success:false
      };

      if(h1Refresh.available){
        try{
          const r=await global.runRainGuardN4B1B3ARuntimeSourceDiscoveryBindingHotfix({
            invokeDownstream:false,
            logCandidates:false
          });
          h1Refresh={available:true,invoked:true,success:!(r&&r.success===false),result:r};
        }catch(e){
          h1Refresh={available:true,invoked:true,success:false,error:e&&e.message?e.message:str(e)};
        }
      }

      const candidates=discoverCandidates();
      const selected=candidates[0]||null;

      if(!selected){
        const result={success:false,phase:PHASE,version:VERSION,build:BUILD,
          status:"NO_H1_RUNTIME_TEMPORAL_SOURCE_DISCOVERED",
          h1Refresh,candidateCount:0,generatedAt:Date.now(),durationMs:Date.now()-startedAt};
        state.lastRun=result;
        return result;
      }

      const canonical=buildCanonical(selected);

      let identityCount=0,observationCount=0,multiPointIdentityCount=0;
      for(const rec of Object.values(canonical.identities)){
        identityCount++;
        const obs=observationsOf(rec);
        observationCount+=obs.length;
        if(obs.length>=2) multiPointIdentityCount++;
      }

      global.RainGuardCrossCycleTemporalAppendOverrideAccumulatorV39=canonical;
      global.RainGuardCrossCycleTemporalAppendOverrideHistoriesV39=canonical.identities;
      global.RainGuardH1CanonicalTemporalSourceV39=canonical;
      global.RainGuardN4B1B3ABoundTemporalSourceV39={
        phase:PHASE,version:VERSION,sourceName:selected.sourceName,
        boundAt:Date.now(),accumulator:canonical,identities:canonical.identities
      };
      global.RainGuardN4B1B3ACanonicalTemporalAccumulatorV39=canonical;
      global.RainGuardN4B1B3ACanonicalTemporalHistoriesV39=canonical.identities;
      global.RainGuardH2RuntimeBoundTemporalSourceV39=canonical;

      state.selectedSourceName=selected.sourceName;

      let h2={
        available:typeof global.runRainGuardN4B1B3BH2CrossCycleIdentityCycleMetadataRecoveryTemporalSequenceRepairBridge==="function",
        invoked:false,success:false
      };

      if(opts.invokeH2 && h2.available){
        try{
          const r=await global.runRainGuardN4B1B3BH2CrossCycleIdentityCycleMetadataRecoveryTemporalSequenceRepairBridge();
          h2={available:true,invoked:true,success:!(r&&r.success===false),result:r};
        }catch(e){
          h2={available:true,invoked:true,success:false,error:e&&e.message?e.message:str(e)};
        }
      }

      const status=h2.invoked&&h2.success
        ?"H1_CANONICAL_TEMPORAL_SOURCE_PUBLISHED_H2_EXECUTED"
        :"H1_CANONICAL_TEMPORAL_SOURCE_PUBLISHED_AND_H2_BOUND";

      const result={
        success:identityCount>0,
        phase:PHASE,version:VERSION,build:BUILD,status,
        h1Refresh,
        selectedSourceName:selected.sourceName,
        selectedSourceScore:selected.score,
        identityCount,observationCount,multiPointIdentityCount,
        canonicalAccumulatorPublished:!!global.RainGuardCrossCycleTemporalAppendOverrideAccumulatorV39,
        canonicalHistoriesPublished:!!global.RainGuardCrossCycleTemporalAppendOverrideHistoriesV39,
        h1CanonicalTemporalSourcePublished:!!global.RainGuardH1CanonicalTemporalSourceV39,
        h2RuntimeBindingPublished:!!global.RainGuardH2RuntimeBoundTemporalSourceV39,
        candidateCount:candidates.length,
        candidateSample:candidates.slice(0,opts.tableLimit).map(c=>({
          source:c.sourceName,score:c.score,identities:c.identityCount,
          observations:c.observationCount,multiPoint:c.multiPointIdentityCount
        })),
        h2,
        generatedAt:Date.now(),
        durationMs:Date.now()-startedAt
      };

      global.RainGuardN4B1B3BH2AResultV39=result;
      state.runs++;
      state.lastRun=result;
      state.lastError=null;

      console.log(`[RainGuard Phase ${PHASE}] H1 Canonical Temporal Source Publication & H2 Runtime Binding result:`);
      console.log(result);
      if(opts.logCandidates && console.table){try{console.table(result.candidateSample);}catch(_){}}
      return result;

    }catch(e){
      const result={success:false,phase:PHASE,version:VERSION,build:BUILD,
        status:"H2A_PUBLICATION_BINDING_FAILED",
        error:e&&e.message?e.message:str(e),
        generatedAt:Date.now(),durationMs:Date.now()-startedAt};
      state.lastRun=result;
      state.lastError=result.error;
      console.error(`[RainGuard Phase ${PHASE}] failed:`,e);
      return result;
    }finally{
      state.running=false;
    }
  }

  function diagnose(){
    const result={
      success:true,phase:PHASE,version:VERSION,build:BUILD,
      installed:true,running:state.running,runs:state.runs,
      selectedSourceName:state.selectedSourceName,
      h1RunnerAvailable:typeof global.runRainGuardN4B1B3ARuntimeSourceDiscoveryBindingHotfix==="function",
      h2RunnerAvailable:typeof global.runRainGuardN4B1B3BH2CrossCycleIdentityCycleMetadataRecoveryTemporalSequenceRepairBridge==="function",
      canonicalAccumulatorAvailable:!!global.RainGuardCrossCycleTemporalAppendOverrideAccumulatorV39,
      canonicalHistoriesAvailable:!!global.RainGuardCrossCycleTemporalAppendOverrideHistoriesV39,
      h1CanonicalTemporalSourceAvailable:!!global.RainGuardH1CanonicalTemporalSourceV39,
      h2RuntimeBoundTemporalSourceAvailable:!!global.RainGuardH2RuntimeBoundTemporalSourceV39,
      lastError:state.lastError,lastRun:state.lastRun
    };
    console.log(`[RainGuard Phase ${PHASE}] Diagnostic:`,result);
    return result;
  }

  global.runRainGuardN4B1B3BH2AH1CanonicalTemporalSourcePublicationH2RuntimeBindingHotfix=run;
  global.diagnoseRainGuardN4B1B3BH2AH1CanonicalTemporalSourcePublicationH2RuntimeBindingHotfix=diagnose;
  global.RainGuardN4B1B3BH2ABridgeV39={phase:PHASE,version:VERSION,build:BUILD,run,diagnose,state};

})(window);
