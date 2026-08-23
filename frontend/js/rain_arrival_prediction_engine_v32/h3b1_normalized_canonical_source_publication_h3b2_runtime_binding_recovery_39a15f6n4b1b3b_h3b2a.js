(function(global){
"use strict";

const PHASE="39A-15F6N4B1B3B-H3B2A";
const VERSION="39A.15F6N4B1B3B-H3B2A.0";
const BUILD="rainguard-v39-h3b1-normalized-canonical-source-publication-h3b2-runtime-binding-recovery";

if(global.__RainGuardN4B1B3BH3B2AInstalled)return;
global.__RainGuardN4B1B3BH3B2AInstalled=true;

const state={installed:true,runs:0,lastRun:null,lastError:null};

function isObj(v){return !!v&&typeof v==="object";}
function countIdentities(src){
  if(!src)return 0;
  if(src instanceof Map)return src.size;
  if(Array.isArray(src))return src.length;
  if(isObj(src.identities)){
    if(src.identities instanceof Map)return src.identities.size;
    if(Array.isArray(src.identities))return src.identities.length;
    return Object.keys(src.identities).length;
  }
  return isObj(src)?Object.keys(src).length:0;
}
function countObservations(src){
  if(!src)return 0;
  let total=0;
  const scan=(r)=>{
    if(!isObj(r))return;
    for(const k of ["observations","history","temporalSequence","points","records","samples","timeline"]){
      if(Array.isArray(r[k])){total+=r[k].length;return;}
    }
  };
  const ids=src.identities||src;
  if(ids instanceof Map){for(const r of ids.values())scan(r);}
  else if(Array.isArray(ids)){for(const r of ids)scan(r);}
  else if(isObj(ids)){for(const r of Object.values(ids))scan(r);}
  return total;
}
function usable(src){return countIdentities(src)>0;}
function normalize(name,raw){
  if(!raw)return null;
  let identities=null;
  if(isObj(raw.identities))identities=raw.identities;
  else if(raw instanceof Map){
    identities={};
    for(const [k,v] of raw.entries())identities[String(k)]=v;
  }else if(Array.isArray(raw)){
    identities={};
    raw.forEach((r,i)=>{
      const k=r&&(r.identity||r.authoritativeIdentity||r.persistentId||r.id||r.trackId||r.cellId);
      identities[String(k||("identity_"+i))]=r;
    });
  }else if(isObj(raw.records)){
    if(Array.isArray(raw.records)){
      identities={};
      raw.records.forEach((r,i)=>{
        const k=r&&(r.identity||r.authoritativeIdentity||r.persistentId||r.id||r.trackId||r.cellId);
        identities[String(k||("identity_"+i))]=r;
      });
    }else identities=raw.records;
  }else if(isObj(raw))identities=raw;
  if(!identities)return null;
  return {phase:PHASE,version:VERSION,build:BUILD,generatedAt:Date.now(),sourceName:name,recoveredFromSourceName:name,identities};
}
function discover(){
  const explicit=[
    "RainGuardN4B1B3BH3B1NormalizedCanonicalTemporalSourceV39",
    "RainGuardN4B1B3BH3B1CanonicalTemporalSourceV39",
    "RainGuardN4B1B3BH3B1RecoveredTemporalSourceV39",
    "RainGuardN4B1B3BH3BCanonicalTemporalSourceV39",
    "RainGuardN4B1B3BH3RecoveredTemporalSourceV39",
    "RainGuardH2ACanonicalTemporalSourceForH3V39",
    "RainGuardN4B1B3BH2ACanonicalTemporalSourceV39",
    "RainGuardN4B1B3BH2RuntimeBoundTemporalSourceV39",
    "RainGuardH2RuntimeBoundTemporalSourceV39",
    "RainGuardCrossCycleTemporalAppendOverrideAccumulatorV39",
    "RainGuardCrossCycleTemporalAppendOverrideHistoriesV39",
    "RainGuardCrossCycleAuthoritativeIdentityTemporalObservationAccumulatorV39"
  ];
  let dyn=[];
  try{
    dyn=Object.keys(global).filter(k=>
      /RainGuard/i.test(k)&&
      /Canonical|Temporal|CrossCycle|H3B1|H3B|H2A/i.test(k)&&
      !/H3B2A|Result|BridgeV39|runRainGuard|diagnoseRainGuard/i.test(k)
    );
  }catch(_){}
  const names=[...new Set([...explicit,...dyn])];
  const candidates=[];
  for(const name of names){
    const raw=global[name];
    if(!usable(raw))continue;
    const n=normalize(name,raw);
    if(!n||!usable(n))continue;
    const identityCount=countIdentities(n);
    const observationCount=countObservations(n);
    let score=0;
    if(/H3B1/i.test(name))score+=5000;
    if(/NormalizedCanonical/i.test(name))score+=4000;
    if(/H3B/i.test(name))score+=2500;
    if(/H2A/i.test(name))score+=2000;
    if(/CanonicalTemporal/i.test(name))score+=1500;
    if(/CrossCycleTemporalAppendOverrideAccumulator/i.test(name))score+=1000;
    score+=Math.min(identityCount,5000)*2+Math.min(observationCount,20000);
    candidates.push({name,normalized:n,identityCount,observationCount,score});
  }
  candidates.sort((a,b)=>b.score-a.score);
  return {best:candidates[0]||null,candidates};
}
function publish(n){
  global.RainGuardN4B1B3BH3B1NormalizedCanonicalTemporalSourceV39=n;
  global.RainGuardN4B1B3BH3B1CanonicalTemporalSourceV39=n;
  global.RainGuardN4B1B3BH3B1RecoveredTemporalSourceV39=n;
  global.RainGuardN4B1B3BH3BCanonicalTemporalSourceV39=n;
  global.RainGuardN4B1B3BH3RecoveredTemporalSourceV39=n;
  global.RainGuardH2ACanonicalTemporalSourceForH3V39=n;
  global.RainGuardN4B1B3BH2ACanonicalTemporalSourceV39=n;
  global.RainGuardN4B1B3BH2RuntimeBoundTemporalSourceV39=n;
  global.RainGuardH2RuntimeBoundTemporalSourceV39=n;
  global.RainGuardCrossCycleTemporalAppendOverrideAccumulatorV39=n;
  global.RainGuardCrossCycleTemporalAppendOverrideHistoriesV39=n.identities;
}
async function run(options){
  const startedAt=Date.now();
  const opts=Object.assign({invokeH3B2:true,h3b2Options:null,logTable:true},options||{});
  try{
    const d=discover();
    if(!d.best){
      const r={success:false,phase:PHASE,version:VERSION,build:BUILD,status:"NO_USABLE_H3B1_OR_CANONICAL_TEMPORAL_SOURCE_DISCOVERED",candidateCount:d.candidates.length,generatedAt:Date.now(),durationMs:Date.now()-startedAt};
      state.lastRun=r;state.lastError=r.status;console.error(r);return r;
    }
    publish(d.best.normalized);
    let h3b2={available:typeof global.runRainGuardN4B1B3BH3B2CrossCycleCoordinateDiversityTemporalMovementReconstructionBridge==="function",invoked:false,success:false,result:null};
    if(opts.invokeH3B2&&h3b2.available){
      h3b2.invoked=true;
      try{
        h3b2.result=await global.runRainGuardN4B1B3BH3B2CrossCycleCoordinateDiversityTemporalMovementReconstructionBridge(opts.h3b2Options||undefined);
        h3b2.success=!!(h3b2.result&&h3b2.result.success);
      }catch(e){h3b2.result={success:false,error:e&&e.message?e.message:String(e)};}
    }
    const r={
      success:true,phase:PHASE,version:VERSION,build:BUILD,
      status:h3b2.invoked?(h3b2.success?"H3B1_CANONICAL_SOURCE_PUBLISHED_H3B2_BOUND_AND_EXECUTED":"H3B1_CANONICAL_SOURCE_PUBLISHED_H3B2_BOUND_BUT_EXECUTION_INCOMPLETE"):"H3B1_CANONICAL_SOURCE_PUBLISHED_H3B2_RUNTIME_BOUND",
      selectedSourceName:d.best.name,selectedSourceScore:d.best.score,
      selectedIdentityCount:d.best.identityCount,selectedObservationCount:d.best.observationCount,
      candidateCount:d.candidates.length,
      candidateSample:d.candidates.slice(0,20).map(c=>({name:c.name,identityCount:c.identityCount,observationCount:c.observationCount,score:c.score})),
      h3b1NormalizedCanonicalSourcePublished:true,h3b1CanonicalSourcePublished:true,
      h3bCanonicalSourceRepublished:true,h2ACanonicalSourceRepublished:true,h2RuntimeSourceRepublished:true,
      crossCycleAccumulatorRepublished:true,h3b2RuntimeBindingAvailable:h3b2.available,h3b2,
      generatedAt:Date.now(),durationMs:Date.now()-startedAt
    };
    global.RainGuardN4B1B3BH3B2AResultV39=r;
    global.RainGuardN4B1B3BH3B2ABoundCanonicalTemporalSourceV39=d.best.normalized;
    state.runs++;state.lastRun=r;state.lastError=null;
    console.log("[RainGuard Phase "+PHASE+"] result:",r);
    if(opts.logTable&&console.table)try{console.table(r.candidateSample);}catch(_){}
    return r;
  }catch(e){
    const r={success:false,phase:PHASE,version:VERSION,build:BUILD,status:"H3B2A_BINDING_RECOVERY_FAILED",error:e&&e.message?e.message:String(e),generatedAt:Date.now(),durationMs:Date.now()-startedAt};
    state.lastRun=r;state.lastError=r.error;console.error(r);return r;
  }
}
function diagnose(){
  const d=discover();
  const r={success:true,phase:PHASE,version:VERSION,build:BUILD,installed:true,runs:state.runs,bestSourceName:d.best?d.best.name:null,bestIdentityCount:d.best?d.best.identityCount:0,bestObservationCount:d.best?d.best.observationCount:0,h3b2Available:typeof global.runRainGuardN4B1B3BH3B2CrossCycleCoordinateDiversityTemporalMovementReconstructionBridge==="function",canonicalAliasAvailable:!!global.RainGuardN4B1B3BH3B1NormalizedCanonicalTemporalSourceV39,lastError:state.lastError,lastRun:state.lastRun};
  console.log("[RainGuard Phase "+PHASE+"] diagnostic:",r);return r;
}
global.runRainGuardN4B1B3BH3B2AH3B1NormalizedCanonicalSourcePublicationH3B2RuntimeBindingRecovery=run;
global.diagnoseRainGuardN4B1B3BH3B2AH3B1NormalizedCanonicalSourcePublicationH3B2RuntimeBindingRecovery=diagnose;
global.RainGuardN4B1B3BH3B2ABridgeV39={phase:PHASE,version:VERSION,build:BUILD,run,diagnose,state};

})(window);
