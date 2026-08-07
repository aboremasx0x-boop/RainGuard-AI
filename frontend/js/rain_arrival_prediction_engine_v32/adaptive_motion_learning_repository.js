/*
RainGuard AI V32
Phase 38M-19B — Adaptive Motion Learning Repository
File: adaptive_motion_learning_repository.js
Version: 32.38M.19B
*/
(function(global){
"use strict";

const MODULE_NAME="adaptiveMotionLearningRepository";
const VERSION="32.38M.19B";
const BUILD_ID="rainguard-v32-phase38m19b-adaptive-motion-learning-repository";
const CONFIG={
  autoStart:true,
  syncIntervalMs:20000,
  maximumSamples:5000,
  maximumProfiles:500,
  debug:true
};

const clone=v=>{
  if(v===null||v===undefined)return v;
  try{return structuredClone(v)}catch(_){}
  try{return JSON.parse(JSON.stringify(v))}catch(_){return v}
};

const toArray=v=>{
  if(!v)return [];
  if(Array.isArray(v))return v;
  if(v instanceof Map||v instanceof Set)return Array.from(v.values());
  if(typeof v.values==="function"){try{return Array.from(v.values())}catch(_){}}
  return typeof v==="object"?Object.values(v):[];
};

class AdaptiveMotionLearningRepository{
  constructor(config={}){
    this.version=VERSION;
    this.buildId=BUILD_ID;
    this.config={...CONFIG,...config};
    this.samples=new Map();
    this.profiles=new Map();
    this.trackIndex=new Map();
    this.cityIndex=new Map();
    this.running=false;
    this.syncing=false;
    this.timer=null;
    this.latestResult=null;
    this.lastError=null;
    this.statistics={
      syncRuns:0,
      successfulSyncRuns:0,
      failedSyncRuns:0,
      busySkips:0,
      samplesStored:0,
      samplesUpdated:0,
      profilesStored:0,
      profilesUpdated:0
    };
  }

  resolveEngine(){
    return global.RainArrivalAdaptiveMotionLearningV32||
           global.RainArrivalAdaptiveMotionLearningEngineV32||
           null;
  }

  normalizeSample(sample,index=0){
    if(!sample||typeof sample!=="object")return null;
    return {
      ...clone(sample),
      sampleId:String(
        sample.sampleId||
        `AML-SAMPLE-${index}-${sample.observedAt||sample.generatedAt||Date.now()}`
      )
    };
  }

  normalizeProfile(profile,index=0){
    if(!profile||typeof profile!=="object")return null;
    return {
      ...clone(profile),
      profileKey:String(
        profile.profileKey||
        `${profile.city||"GLOBAL"}|${profile.confidenceBand||"UNKNOWN"}|${index}`
      )
    };
  }

  rebuildIndexes(){
    this.trackIndex.clear();
    this.cityIndex.clear();

    for(const sample of this.samples.values()){
      const trackKey=String(sample.stableId||sample.trackId||"UNKNOWN");
      if(!this.trackIndex.has(trackKey))this.trackIndex.set(trackKey,[]);
      this.trackIndex.get(trackKey).push(sample.sampleId);

      const cityKey=String(sample.city||"GLOBAL").toLowerCase();
      if(!this.cityIndex.has(cityKey))this.cityIndex.set(cityKey,[]);
      this.cityIndex.get(cityKey).push(sample.sampleId);
    }
  }

  storeSamples(samples){
    let stored=0,updated=0;
    for(const [index,raw] of toArray(samples).entries()){
      const sample=this.normalizeSample(raw,index);
      if(!sample)continue;
      if(this.samples.has(sample.sampleId))updated++; else stored++;
      this.samples.set(sample.sampleId,sample);
    }

    if(this.samples.size>this.config.maximumSamples){
      const ordered=Array.from(this.samples.values()).sort(
        (a,b)=>Number(b.observedAt||b.generatedAt||0)-Number(a.observedAt||a.generatedAt||0)
      );
      this.samples.clear();
      ordered.slice(0,this.config.maximumSamples).forEach(
        s=>this.samples.set(s.sampleId,s)
      );
    }

    this.statistics.samplesStored+=stored;
    this.statistics.samplesUpdated+=updated;
    return {stored,updated};
  }

  storeProfiles(profiles){
    let stored=0,updated=0;
    for(const [index,raw] of toArray(profiles).entries()){
      const profile=this.normalizeProfile(raw,index);
      if(!profile)continue;
      if(this.profiles.has(profile.profileKey))updated++; else stored++;
      this.profiles.set(profile.profileKey,profile);
    }

    if(this.profiles.size>this.config.maximumProfiles){
      const ordered=Array.from(this.profiles.values()).sort(
        (a,b)=>Number(b.updatedAt||0)-Number(a.updatedAt||0)
      );
      this.profiles.clear();
      ordered.slice(0,this.config.maximumProfiles).forEach(
        p=>this.profiles.set(p.profileKey,p)
      );
    }

    this.statistics.profilesStored+=stored;
    this.statistics.profilesUpdated+=updated;
    return {stored,updated};
  }

  syncFromLearningEngine(){
    if(this.syncing){
      this.statistics.busySkips++;
      return {
        success:false,
        status:"ADAPTIVE_MOTION_LEARNING_REPOSITORY_BUSY",
        version:this.version,
        build:this.buildId
      };
    }

    const startedAt=Date.now();
    this.syncing=true;
    this.statistics.syncRuns++;

    try{
      const engine=this.resolveEngine();
      if(!engine)throw new Error("Adaptive Motion Learning Engine is unavailable.");

      const engineResult=engine.getLatestResult?.()||engine.learn?.()||null;
      const samples=engine.getSamples?.(this.config.maximumSamples)||
                    global.RainArrivalAdaptiveMotionSamples||[];
      const profiles=engine.getAllProfiles?.()||
                     global.RainArrivalAdaptiveMotionProfiles||[];

      const sr=this.storeSamples(samples);
      const pr=this.storeProfiles(profiles);
      this.rebuildIndexes();

      const result={
        success:true,
        status:"ADAPTIVE_MOTION_LEARNING_REPOSITORY_SYNCED",
        version:this.version,
        build:this.buildId,
        engineStatus:engineResult?.status||null,
        inputSampleCount:toArray(samples).length,
        inputProfileCount:toArray(profiles).length,
        storedSampleCount:sr.stored,
        updatedSampleCount:sr.updated,
        storedProfileCount:pr.stored,
        updatedProfileCount:pr.updated,
        repositorySampleCount:this.samples.size,
        repositoryProfileCount:this.profiles.size,
        trackIndexCount:this.trackIndex.size,
        cityIndexCount:this.cityIndex.size,
        startedAt,
        completedAt:Date.now(),
        durationMs:Date.now()-startedAt
      };

      this.latestResult=clone(result);
      this.statistics.successfulSyncRuns++;
      this.publish(result);

      if(this.config.debug){
        console.log("[RainArrival AdaptiveMotionLearningRepository] Sync result:",result);
      }

      return result;
    }catch(error){
      this.statistics.failedSyncRuns++;
      this.lastError={
        name:error?.name||"Error",
        message:error?.message||String(error),
        stack:error?.stack||null,
        timestamp:Date.now()
      };
      const result={
        success:false,
        status:"ADAPTIVE_MOTION_LEARNING_REPOSITORY_SYNC_FAILED",
        version:this.version,
        build:this.buildId,
        error:clone(this.lastError),
        startedAt,
        completedAt:Date.now(),
        durationMs:Date.now()-startedAt
      };
      this.latestResult=clone(result);
      return result;
    }finally{
      this.syncing=false;
    }
  }

  publish(result){
    global.RainArrivalAdaptiveMotionLearningRepositoryResult=clone(result);
    global.RainArrivalAdaptiveMotionLearningRepositorySamples=this.getAllSamples();
    global.RainArrivalAdaptiveMotionLearningRepositoryProfiles=this.getAllProfiles();

    global.RainGuardAI=global.RainGuardAI||{};
    global.RainGuardAI.V32=global.RainGuardAI.V32||{};
    global.RainGuardAI.V32.adaptiveMotionLearningRepository={
      result:clone(result),
      samples:this.getAllSamples(),
      profiles:this.getAllProfiles()
    };

    global.dispatchEvent?.(
      new CustomEvent(
        "rainarrival:adaptive-motion-learning-repository-updated",
        {detail:clone(result)}
      )
    );
    return result;
  }

  getSample(sampleId){
    return clone(this.samples.get(String(sampleId))||null);
  }

  getAllSamples(){
    return clone(Array.from(this.samples.values()).sort(
      (a,b)=>Number(b.observedAt||b.generatedAt||0)-Number(a.observedAt||a.generatedAt||0)
    ));
  }

  getSamplesByTrack(trackId){
    const ids=this.trackIndex.get(String(trackId))||[];
    return clone(ids.map(id=>this.samples.get(id)).filter(Boolean));
  }

  getSamplesByCity(city){
    const ids=this.cityIndex.get(String(city||"GLOBAL").toLowerCase())||[];
    return clone(ids.map(id=>this.samples.get(id)).filter(Boolean));
  }

  getProfile(profileKey){
    return clone(this.profiles.get(String(profileKey))||null);
  }

  getAllProfiles(){
    return clone(Array.from(this.profiles.values()).sort(
      (a,b)=>Number(b.updatedAt||0)-Number(a.updatedAt||0)
    ));
  }

  getCorrectionProfile(city="GLOBAL",confidenceBand=null){
    const cityKey=String(city).toLowerCase();
    const profiles=Array.from(this.profiles.values());

    const exact=profiles.find(p=>
      String(p.city||"GLOBAL").toLowerCase()===cityKey &&
      (!confidenceBand||p.confidenceBand===confidenceBand)
    );
    if(exact)return clone(exact);

    const fallback=profiles.find(p=>
      String(p.city||"GLOBAL").toLowerCase()==="global" &&
      (!confidenceBand||p.confidenceBand===confidenceBand)
    )||null;

    return clone(fallback);
  }

  getLatestResult(){return clone(this.latestResult)}
  getCount(){return this.samples.size}
  getProfileCount(){return this.profiles.size}

  printProfiles(){
    const profiles=this.getAllProfiles();
    console.table(profiles.map(p=>({
      profileKey:p.profileKey,
      city:p.city,
      confidenceBand:p.confidenceBand,
      sampleCount:p.sampleCount,
      speedMultiplier:p.speedMultiplier,
      bearingOffsetDegrees:p.bearingOffsetDegrees,
      etaMultiplier:p.etaMultiplier,
      meanPositionErrorKm:p.meanPositionErrorKm
    })));
    return profiles;
  }

  printSamples(limit=20){
    const samples=this.getAllSamples().slice(0,Math.max(0,Number(limit)||0));
    console.table(samples.map(s=>({
      sampleId:s.sampleId,
      trackId:s.trackId,
      city:s.city,
      confidence:s.confidence,
      positionErrorKm:s.positionErrorKm,
      speedErrorKmh:s.speedErrorKmh,
      bearingErrorDegrees:s.bearingErrorDegrees
    })));
    return samples;
  }

  getDiagnostics(){
    return {
      module:MODULE_NAME,
      version:this.version,
      build:this.buildId,
      installed:true,
      running:this.running,
      syncing:this.syncing,
      sampleCount:this.samples.size,
      profileCount:this.profiles.size,
      trackIndexCount:this.trackIndex.size,
      cityIndexCount:this.cityIndex.size,
      latestResult:this.getLatestResult(),
      lastError:clone(this.lastError),
      statistics:clone(this.statistics),
      config:clone(this.config)
    };
  }

  diagnose(){
    const d=this.getDiagnostics();
    console.log("[RainArrival AdaptiveMotionLearningRepository]",d);
    return d;
  }

  clear(){
    const removedSamples=this.samples.size;
    const removedProfiles=this.profiles.size;
    this.samples.clear();
    this.profiles.clear();
    this.trackIndex.clear();
    this.cityIndex.clear();
    this.latestResult=null;
    this.lastError=null;
    return {
      success:true,
      status:"ADAPTIVE_MOTION_LEARNING_REPOSITORY_CLEARED",
      removedSamples,
      removedProfiles
    };
  }

  start(){
    if(this.running)return {success:true,alreadyRunning:true};
    this.running=true;
    this.syncFromLearningEngine();
    this.timer=global.setInterval(
      ()=>this.syncFromLearningEngine(),
      this.config.syncIntervalMs
    );
    return {
      success:true,
      running:true,
      intervalMs:this.config.syncIntervalMs
    };
  }

  stop(){
    if(this.timer)global.clearInterval(this.timer);
    this.timer=null;
    this.running=false;
    return {success:true,running:false};
  }
}

const repository=new AdaptiveMotionLearningRepository();

global.RainArrivalAdaptiveMotionLearningRepositoryV32=repository;

global.RainGuardAI=global.RainGuardAI||{};
global.RainGuardAI.V32=global.RainGuardAI.V32||{};
global.RainGuardAI.V32.rainArrivalModules=
  global.RainGuardAI.V32.rainArrivalModules||{};

global.RainGuardAI.V32.rainArrivalModules.adaptiveMotionLearningRepository=
  repository;

global.RainArrivalEngineV32?.register?.(MODULE_NAME,repository);
global.RainArrivalOrchestratorV32?.register?.(MODULE_NAME,repository);

global.syncRainArrivalAdaptiveMotionLearningRepository=
  ()=>repository.syncFromLearningEngine();

if(repository.config.autoStart)repository.start();

console.log(
  "[RainGuard AI V32] Adaptive Motion Learning Repository loaded.",
  {version:VERSION,build:BUILD_ID}
);

})(typeof globalThis!=="undefined"?globalThis:window);
