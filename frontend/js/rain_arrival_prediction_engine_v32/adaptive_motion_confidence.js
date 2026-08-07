/*
===========================================================
 RainGuard AI V32
 Phase 38M-19C — Adaptive Motion Confidence Engine
 File: adaptive_motion_confidence.js
 Version: 32.38M.19C
===========================================================
*/
(function(global){
"use strict";

const MODULE_NAME="adaptiveMotionConfidence";
const VERSION="32.38M.19C";
const BUILD_ID="rainguard-v32-phase38m19c-adaptive-motion-confidence";

const CONFIG={
  autoStart:true,
  evaluationIntervalMs:22000,
  minimumAcceptedConfidence:55,
  highConfidenceThreshold:75,
  veryHighConfidenceThreshold:90,
  maximumEvaluations:3000,
  weights:{
    predictionConfidence:0.24,
    adaptiveLearningQuality:0.20,
    historicalTrackQuality:0.16,
    vectorStability:0.15,
    sourceAgreement:0.10,
    identityStability:0.08,
    approachEvidence:0.07
  },
  debug:true
};

const now=()=>Date.now();

const clone=v=>{
  if(v===null||v===undefined)return v;
  try{return structuredClone(v)}catch(_){}
  try{return JSON.parse(JSON.stringify(v))}catch(_){return v}
};

const num=(v,f=null)=>{
  const n=Number(v);
  return Number.isFinite(n)?n:f;
};

const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));

const percent=v=>{
  const n=num(v,null);
  if(n===null)return null;
  return n>=0&&n<=1?clamp(n*100,0,100):clamp(n,0,100);
};

const arr=v=>{
  if(!v)return [];
  if(Array.isArray(v))return v;
  if(v instanceof Map||v instanceof Set)return Array.from(v.values());
  if(typeof v.values==="function"){try{return Array.from(v.values())}catch(_){}}
  return typeof v==="object"?Object.values(v):[];
};

const mean=values=>{
  const n=values.map(Number).filter(Number.isFinite);
  return n.length?n.reduce((a,b)=>a+b,0)/n.length:null;
};

const round=(v,d=2)=>{
  if(!Number.isFinite(v))return null;
  const f=10**d;
  return Math.round(v*f)/f;
};

class AdaptiveMotionConfidenceEngine{
  constructor(config={}){
    this.version=VERSION;
    this.buildId=BUILD_ID;
    this.config={
      ...CONFIG,
      ...config,
      weights:{...CONFIG.weights,...(config.weights||{})}
    };
    this.running=false;
    this.evaluating=false;
    this.timer=null;
    this.results=new Map();
    this.latestResult=null;
    this.lastError=null;
    this.statistics={
      runs:0,
      successfulRuns:0,
      failedRuns:0,
      busySkips:0,
      evaluatedPredictions:0,
      acceptedPredictions:0,
      rejectedPredictions:0
    };
  }

  predictionRepo(){
    return global.RainArrivalMotionPredictionRepositoryV32||null;
  }

  predictionEngine(){
    return global.RainArrivalMotionPredictionAIV32||
           global.RainArrivalMotionPredictionAIEngineV32||
           null;
  }

  learningRepo(){
    return global.RainArrivalAdaptiveMotionLearningRepositoryV32||null;
  }

  learningStats(){
    return global.RainArrivalAdaptiveMotionLearningStatisticsV32||null;
  }

  historyEngine(){
    return global.RainArrivalPersistentTrackHistoryV32||null;
  }

  identityEngine(){
    return global.RainArrivalStableTrackIdentityV32||null;
  }

  resolvePredictions(){
    const repo=this.predictionRepo();
    const eng=this.predictionEngine();
    const sources=[
      repo?.getAllPredictions?.(),
      repo?.getAll?.(),
      eng?.getAllPredictions?.(),
      global.RainArrivalMotionPredictions
    ];
    for(const source of sources){
      const values=arr(source);
      if(values.length)return values;
    }
    return [];
  }

  trackId(p){
    return String(p?.stableId??p?.trackId??p?.candidateId??p?.id??"");
  }

  city(p){
    return String(p?.city??p?.targetCity??p?.candidate?.city??"GLOBAL");
  }

  predictionConfidence(p){
    for(const value of [
      p?.confidence,
      p?.finalConfidence,
      p?.motionConfidence,
      p?.predictionConfidence,
      p?.score
    ]){
      const n=percent(value);
      if(n!==null)return n;
    }

    const avg=mean(
      arr(p?.predictions)
        .map(x=>percent(x?.confidence))
        .filter(Number.isFinite)
    );

    return Number.isFinite(avg)?clamp(avg,0,100):null;
  }

  adaptiveLearningQuality(p){
    const repo=this.learningRepo();
    const stats=this.learningStats();
    const city=this.city(p);
    const pc=this.predictionConfidence(p)??50;

    let band=null;
    try{
      band=global.RainArrivalAdaptiveMotionLearningV32?.getConfidenceBand?.(pc)??null;
    }catch(_){}

    const profile=repo?.getCorrectionProfile?.(city,band)??null;

    if(profile){
      const sampleCount=num(profile.sampleCount,0);
      const positionError=num(profile.meanPositionErrorKm,null);
      const speedError=num(profile.meanAbsoluteSpeedErrorKmh,null);
      const bearingError=num(profile.meanAbsoluteBearingErrorDegrees,null);

      let score=50;

      if(sampleCount>=10)score+=15;
      else if(sampleCount>=5)score+=10;
      else if(sampleCount>=3)score+=5;

      if(positionError!==null)score+=clamp(25-positionError,-25,25);
      if(speedError!==null)score+=clamp(12-speedError*0.8,-12,12);
      if(bearingError!==null)score+=clamp(12-bearingError*0.3,-12,12);

      return clamp(score,0,100);
    }

    const citySummary=stats?.getCitySummary?.(city)??null;

    if(citySummary){
      const map={
        EXCELLENT:95,
        GOOD:80,
        NEEDS_ADAPTATION:55,
        INSUFFICIENT_DATA:40,
        UNSTABLE:25,
        NO_DATA:20
      };
      return map[citySummary.quality]??50;
    }

    return null;
  }

  historicalTrackQuality(p){
    const history=this.historyEngine();
    if(!history)return null;

    const key=this.trackId(p);
    let track=
      history.getTrack?.(key)||
      history.getByTrackId?.(key)||
      history.getTrackById?.(key)||
      null;

    if(!track&&history.getAllTracks){
      track=arr(history.getAllTracks()).find(x=>
        String(x?.stableId??x?.trackId??x?.id??"")===key
      )||null;
    }

    if(!track)return null;

    const points=arr(track.points??track.history??track.samples);
    if(!points.length)return null;

    let score=35;

    if(points.length>=10)score+=40;
    else if(points.length>=6)score+=30;
    else if(points.length>=3)score+=20;
    else if(points.length>=2)score+=10;

    const ts=points.map(x=>num(
      x?.timestamp??x?.observedAt??x?.generatedAt,null
    )).filter(Number.isFinite).sort((a,b)=>a-b);

    if(ts.length>=2){
      const ageMinutes=(now()-ts[ts.length-1])/60000;
      if(ageMinutes<=10)score+=20;
      else if(ageMinutes<=30)score+=10;
      else if(ageMinutes>120)score-=15;
    }

    return clamp(score,0,100);
  }

  vectorStability(p){
    const points=arr(p?.predictions);

    const speeds=points.map(x=>num(x?.speedKmh,null)).filter(Number.isFinite);
    const bearings=points.map(x=>num(x?.bearing,null)).filter(Number.isFinite);

    const baseSpeed=num(p?.baseMotion?.speedKmh,null);
    const baseBearing=num(p?.baseMotion?.bearing,null);

    if(baseSpeed!==null)speeds.unshift(baseSpeed);
    if(baseBearing!==null)bearings.unshift(baseBearing);

    if(!speeds.length&&!bearings.length)return null;

    let speedScore=60;
    let bearingScore=60;

    if(speeds.length>=2){
      const avg=mean(speeds);
      const dev=mean(speeds.map(v=>Math.abs(v-avg)));
      speedScore=clamp(100-dev*5,0,100);
    }

    if(bearings.length>=2){
      const anchor=bearings[0];
      const diffs=bearings.slice(1).map(v=>{
        let d=Math.abs(v-anchor)%360;
        if(d>180)d=360-d;
        return d;
      });
      bearingScore=clamp(100-(mean(diffs)??0)*1.5,0,100);
    }

    return round(mean([speedScore,bearingScore]),2);
  }

  sourceAgreement(p){
    for(const value of [
      p?.sourceAgreement,
      p?.evidenceAgreement,
      p?.sourceConfidence,
      p?.fusionConfidence
    ]){
      const n=percent(value);
      if(n!==null)return n;
    }

    const sources=arr(p?.sources??p?.evidence??p?.sourceEvidence);
    if(!sources.length)return null;

    const confidenceValues=sources.map(s=>percent(
      s?.confidence??s?.score??s?.quality
    )).filter(Number.isFinite);

    if(confidenceValues.length)return round(mean(confidenceValues),2);

    return clamp(35+sources.length*10,0,100);
  }

  identityStability(p){
    const identity=this.identityEngine();
    if(!identity)return null;

    const key=this.trackId(p);

    let track=
      identity.getTrack?.(key)||
      identity.getByTrackId?.(key)||
      identity.getStableTrack?.(key)||
      null;

    if(!track){
      track=arr(identity.getAllTracks?.()).find(x=>
        String(x?.stableId??x?.trackId??"")===key
      )||null;
    }

    if(!track)return null;

    const updateCount=num(track.updateCount,0);
    const pointCount=num(track.pointCount,0);

    return clamp(45+Math.min(updateCount*7,35)+Math.min(pointCount*3,20),0,100);
  }

  approachEvidence(p){
    for(const value of [
      p?.approachConfidence,
      p?.approachingConfidence,
      p?.targetApproachConfidence
    ]){
      const n=percent(value);
      if(n!==null)return n;
    }

    const approaching=
      p?.approaching??p?.isApproaching??p?.targetApproaching;

    if(approaching===true)return 90;
    if(approaching===false)return 20;

    const distance=num(p?.distanceKm??p?.targetDistanceKm,null);
    const eta=num(p?.etaMinutes??p?.arrivalMinutes,null);

    if(distance!==null&&eta!==null&&eta>0){
      return clamp(85-distance*0.35,20,95);
    }

    return null;
  }

  grade(score){
    if(score>=95)return "A+";
    if(score>=90)return "A";
    if(score>=85)return "A-";
    if(score>=80)return "B+";
    if(score>=75)return "B";
    if(score>=70)return "B-";
    if(score>=65)return "C+";
    if(score>=60)return "C";
    if(score>=55)return "C-";
    if(score>=45)return "D";
    return "F";
  }

  quality(score){
    if(score>=this.config.veryHighConfidenceThreshold)return "VERY_HIGH_CONFIDENCE";
    if(score>=this.config.highConfidenceThreshold)return "HIGH_CONFIDENCE";
    if(score>=this.config.minimumAcceptedConfidence)return "MODERATE_CONFIDENCE";
    if(score>=35)return "LOW_CONFIDENCE";
    return "INSUFFICIENT_CONFIDENCE";
  }

  weightedScore(components){
    let weighted=0,totalWeight=0;

    for(const [key,value] of Object.entries(components)){
      if(!Number.isFinite(value))continue;
      const w=num(this.config.weights[key],0);
      if(w<=0)continue;
      weighted+=value*w;
      totalWeight+=w;
    }

    return totalWeight>0?clamp(weighted/totalWeight,0,100):null;
  }

  evaluatePrediction(p){
    const predictionId=String(
      p?.predictionId??p?.id??this.trackId(p)??`PRED-${now()}`
    );

    const components={
      predictionConfidence:this.predictionConfidence(p),
      adaptiveLearningQuality:this.adaptiveLearningQuality(p),
      historicalTrackQuality:this.historicalTrackQuality(p),
      vectorStability:this.vectorStability(p),
      sourceAgreement:this.sourceAgreement(p),
      identityStability:this.identityStability(p),
      approachEvidence:this.approachEvidence(p)
    };

    const score=this.weightedScore(components);
    const missingComponents=Object.entries(components)
      .filter(([,value])=>!Number.isFinite(value))
      .map(([key])=>key);

    const availableComponentCount=
      Object.keys(components).length-missingComponents.length;

    const evidenceCoverage=round(
      availableComponentCount/Object.keys(components).length*100,
      2
    );

    const confidence=Number.isFinite(score)?round(score,2):0;
    const accepted=
      confidence>=this.config.minimumAcceptedConfidence &&
      evidenceCoverage>=40;

    return {
      confidenceId:`AMC-${predictionId}-${now()}`,
      predictionId,
      trackId:this.trackId(p),
      city:this.city(p),
      confidence,
      grade:this.grade(confidence),
      quality:this.quality(confidence),
      accepted,
      evidenceCoverage,
      availableComponentCount,
      missingComponents,
      components:Object.fromEntries(
        Object.entries(components).map(([key,value])=>[
          key,
          Number.isFinite(value)?round(value,2):null
        ])
      ),
      sourcePrediction:clone(p),
      generatedAt:now()
    };
  }

  evaluateAll(){
    if(this.evaluating){
      this.statistics.busySkips++;
      return {
        success:false,
        status:"ADAPTIVE_MOTION_CONFIDENCE_BUSY",
        version:this.version,
        build:this.buildId
      };
    }

    const startedAt=now();
    this.evaluating=true;
    this.statistics.runs++;

    try{
      const predictions=this.resolvePredictions();
      const evaluations=predictions.map(p=>this.evaluatePrediction(p));

      const ranked=evaluations
        .slice()
        .sort((a,b)=>b.confidence-a.confidence)
        .map((item,index)=>({...item,rank:index+1}));

      this.results.clear();
      ranked.slice(0,this.config.maximumEvaluations).forEach(item=>{
        this.results.set(item.predictionId||item.trackId||item.confidenceId,item);
      });

      const accepted=ranked.filter(x=>x.accepted);
      const rejected=ranked.filter(x=>!x.accepted);

      const result={
        success:true,
        status:"ADAPTIVE_MOTION_CONFIDENCE_COMPLETED",
        version:this.version,
        build:this.buildId,
        inputCount:predictions.length,
        evaluatedCount:ranked.length,
        acceptedCount:accepted.length,
        rejectedCount:rejected.length,
        averageConfidence:round(mean(ranked.map(x=>x.confidence)),2),
        highestConfidence:ranked[0]?.confidence??null,
        lowestConfidence:ranked.length?ranked[ranked.length-1].confidence:null,
        topConfidence:clone(ranked[0]??null),
        ranking:clone(ranked),
        startedAt,
        completedAt:now(),
        durationMs:now()-startedAt
      };

      this.latestResult=clone(result);
      this.statistics.successfulRuns++;
      this.statistics.evaluatedPredictions+=ranked.length;
      this.statistics.acceptedPredictions+=accepted.length;
      this.statistics.rejectedPredictions+=rejected.length;

      this.publish(result);

      if(this.config.debug){
        console.log("[RainArrival AdaptiveMotionConfidence] Evaluation result:",result);
      }

      return result;
    }catch(error){
      this.statistics.failedRuns++;
      this.lastError={
        name:error?.name??"Error",
        message:error?.message??String(error),
        stack:error?.stack??null,
        timestamp:now()
      };

      const result={
        success:false,
        status:"ADAPTIVE_MOTION_CONFIDENCE_FAILED",
        version:this.version,
        build:this.buildId,
        error:clone(this.lastError),
        startedAt,
        completedAt:now(),
        durationMs:now()-startedAt
      };

      this.latestResult=clone(result);
      return result;
    }finally{
      this.evaluating=false;
    }
  }

  publish(result){
    global.RainArrivalAdaptiveMotionConfidenceResult=clone(result);
    global.RainArrivalAdaptiveMotionConfidenceEvaluations=this.getAll();

    global.RainGuardAI=global.RainGuardAI||{};
    global.RainGuardAI.V32=global.RainGuardAI.V32||{};
    global.RainGuardAI.V32.adaptiveMotionConfidence=clone(result);
    global.RainGuardAI.V32.adaptiveMotionConfidenceEvaluations=this.getAll();

    global.dispatchEvent?.(
      new CustomEvent(
        "rainarrival:adaptive-motion-confidence-completed",
        {detail:clone(result)}
      )
    );

    return result;
  }

  getAll(){
    return clone(
      Array.from(this.results.values())
        .sort((a,b)=>b.confidence-a.confidence)
    );
  }

  getAccepted(){return this.getAll().filter(x=>x.accepted)}
  getRejected(){return this.getAll().filter(x=>!x.accepted)}
  getTopConfidence(){return this.getAll()[0]??null}

  getByPredictionId(id){
    return clone(this.results.get(String(id))??null);
  }

  getByTrackId(trackId){
    const key=String(trackId);
    return clone(
      this.getAll().find(x=>String(x.trackId)===key)??null
    );
  }

  getLatestResult(){return clone(this.latestResult)}

  printTable(limit=20){
    const rows=this.getAll().slice(0,Math.max(0,Number(limit)||0));
    console.table(rows.map(item=>({
      rank:item.rank,
      city:item.city,
      trackId:item.trackId,
      confidence:item.confidence,
      grade:item.grade,
      quality:item.quality,
      accepted:item.accepted,
      evidenceCoverage:item.evidenceCoverage
    })));
    return rows;
  }

  getDiagnostics(){
    return {
      module:MODULE_NAME,
      version:this.version,
      build:this.buildId,
      installed:true,
      running:this.running,
      evaluating:this.evaluating,
      resultCount:this.results.size,
      latestResult:this.getLatestResult(),
      lastError:clone(this.lastError),
      statistics:clone(this.statistics),
      config:clone(this.config)
    };
  }

  diagnose(){
    const d=this.getDiagnostics();
    console.log("[RainArrival AdaptiveMotionConfidence]",d);
    return d;
  }

  start(){
    if(this.running)return {success:true,alreadyRunning:true};
    this.running=true;
    this.evaluateAll();
    this.timer=global.setInterval(
      ()=>this.evaluateAll(),
      this.config.evaluationIntervalMs
    );
    return {
      success:true,
      running:true,
      intervalMs:this.config.evaluationIntervalMs
    };
  }

  stop(){
    if(this.timer)global.clearInterval(this.timer);
    this.timer=null;
    this.running=false;
    return {success:true,running:false};
  }
}

const engine=new AdaptiveMotionConfidenceEngine();

global.RainArrivalAdaptiveMotionConfidenceV32=engine;
global.RainArrivalAdaptiveMotionConfidenceEngineV32=engine;

global.RainGuardAI=global.RainGuardAI||{};
global.RainGuardAI.V32=global.RainGuardAI.V32||{};
global.RainGuardAI.V32.rainArrivalModules=
  global.RainGuardAI.V32.rainArrivalModules||{};

global.RainGuardAI.V32.rainArrivalModules.adaptiveMotionConfidence=engine;

global.RainArrivalEngineV32?.register?.(MODULE_NAME,engine);
global.RainArrivalOrchestratorV32?.register?.(MODULE_NAME,engine);

global.runRainArrivalAdaptiveMotionConfidence=()=>engine.evaluateAll();

if(engine.config.autoStart)engine.start();

console.log(
  "[RainGuard AI V32] Adaptive Motion Confidence Engine loaded.",
  {version:VERSION,build:BUILD_ID}
);

})(typeof globalThis!=="undefined"?globalThis:window);
