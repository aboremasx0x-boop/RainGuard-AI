(function (global) {
  "use strict";

  const PHASE = "39A-15F6N4B1B3B-H3B2A";
  const VERSION = "39A.15F6N4B1B3B-H3B2A.0";
  const BUILD = "rainguard-v39-h3b1-canonical-temporal-source-publication-h3b2-runtime-binding-recovery-bridge";

  if (global.__RainGuardN4B1B3BH3B2AInstalled) return;
  global.__RainGuardN4B1B3BH3B2AInstalled = true;

  const CANONICAL_NAMES = [
    "RainGuardN4B1B3BH3B1NormalizedCanonicalTemporalSourceV39",
    "RainGuardN4B1B3BH3B1CanonicalTemporalSourceV39",
    "RainGuardN4B1B3BH3BRecoveredTemporalSourceV39",
    "RainGuardH2ACanonicalTemporalSourceForH3V39",
    "RainGuardCrossCycleTemporalAppendOverrideAccumulatorV39",
    "RainGuardH2RuntimeBoundTemporalSourceV39"
  ];

  const state = { installed:true, running:false, runs:0, lastRun:null, lastError:null };

  function isObj(v){ return !!v && typeof v === "object"; }
  function isFn(v){ return typeof v === "function"; }
  function str(v){ try { return v == null ? "" : String(v); } catch(_) { return ""; } }
  function norm(v){ return str(v).trim().toLowerCase().replace(/\s+/g," "); }

  function identityOf(r, fallback){
    if(!isObj(r)) return norm(fallback);
    const vals = [
      r.identity, r.authoritativeIdentity, r.persistentId, r.canonicalPersistentId,
      r.canonicalIdentity, r.identityKey, r.trackId, r.cellId, r.stormId, r.entityId, r.id
    ];
    for(const v of vals){
      const x = norm(v);
      if(x) return x;
    }
    return norm(fallback);
  }

  function observationsOf(rec){
    if(!isObj(rec)) return [];
    for(const k of ["observations","history","temporalSequence","points","records","samples","timeline"]){
      if(Array.isArray(rec[k])) return rec[k].slice();
    }
    return [];
  }

  function normalizeIdentitiesFromAny(value, sourceName){
    const out = {};

    function add(rec, fallback){
      if(!isObj(rec)) return;
      const id = identityOf(rec, fallback);
      if(!id) return;
      const obs = observationsOf(rec);

      if(!out[id]){
        out[id] = Object.assign({}, rec, {
          identity:id,
          observations:obs,
          history:obs,
          temporalSequence:obs,
          __publicationSource:sourceName
        });
      } else {
        const merged = observationsOf(out[id]).concat(obs);
        out[id] = Object.assign({}, out[id], rec, {
          identity:id,
          observations:merged,
          history:merged,
          temporalSequence:merged,
          __publicationSource:sourceName
        });
      }
    }

    function walk(v, fallback, depth){
      if(depth > 6 || v == null) return;

      if(v instanceof Map){
        let n = 0;
        for(const [k,rec] of v.entries()){
          if(++n > 20000) break;
          add(rec,k);
        }
        return;
      }

      if(Array.isArray(v)){
        for(let i=0;i<Math.min(v.length,20000);i++) add(v[i], `${fallback||"array"}:${i}`);
        return;
      }

      if(!isObj(v)) return;

      if(isObj(v.identities)){
        for(const [k,rec] of Object.entries(v.identities)) add(rec,k);
        return;
      }

      const entries = Object.entries(v);
      const plausible = entries.slice(0,50).filter(([,x]) => isObj(x) && (identityOf(x,"") || observationsOf(x).length)).length;
      if(plausible >= 2){
        for(const [k,rec] of entries) if(isObj(rec)) add(rec,k);
        return;
      }

      for(const k of ["result","lastRun","lastResult","state","data","registry","source","publishedSource","canonicalSource","normalizedSource","temporalSource","accumulator"]){
        if(v[k] != null) walk(v[k],k,depth+1);
      }
    }

    walk(value,sourceName,0);
    return out;
  }

  function countStats(identities){
    let observationCount = 0, multiPointIdentityCount = 0, maxObservedPointsPerIdentity = 0;
    for(const rec of Object.values(identities || {})){
      const n = observationsOf(rec).length;
      observationCount += n;
      if(n >= 2) multiPointIdentityCount++;
      maxObservedPointsPerIdentity = Math.max(maxObservedPointsPerIdentity,n);
    }
    return {observationCount,multiPointIdentityCount,maxObservedPointsPerIdentity};
  }

  function score(name, identities){
    let s = 0;
    const n = name.toLowerCase();
    if(/h3b1/.test(n)) s += 100;
    if(/canonical/.test(n)) s += 80;
    if(/temporal/.test(n)) s += 70;
    if(/recovered/.test(n)) s += 50;
    if(/crosscycle|cross_cycle/.test(n)) s += 40;
    if(/history/.test(n)) s += 30;
    if(/identity/.test(n)) s += 25;
    s += Math.min(100,Object.keys(identities).length);
    s += Math.min(100,countStats(identities).observationCount / 10);
    return s;
  }

  function discoverCandidates(){
    let keys = [];
    try { keys = Object.keys(global).slice(0,30000); } catch(_) {}

    const preferred = [
      "RainGuardN4B1B3BH3B1BridgeV39",
      "RainGuardN4B1B3BH3ABridgeV39",
      "RainGuardN4B1B3BH3BridgeV39",
      "RainGuardN4B1B3BH2ABridgeV39",
      "RainGuardCrossCycleTemporalAppendOverrideAccumulatorV39",
      "RainGuardLiveTrackHistoryByIdentityV39",
      "RainGuardRecoveredLiveTrackHistoryV39",
      "RainArrivalLiveTrackHistory",
      "RainArrivalStableStormEntities",
      "RainArrivalLiveStormEntities"
    ];

    const dynamic = keys.filter(k =>
      /rain|storm|track|identity|temporal|history|crosscycle|canonical|accumul/i.test(k) &&
      !/h3b2aresult|h3b2result/i.test(k)
    );

    const names = [...new Set([...preferred,...dynamic])];
    const out = [];

    for(const name of names){
      let value;
      try { value = global[name]; } catch(_) { continue; }
      if(value == null || isFn(value)) continue;

      const identities = normalizeIdentitiesFromAny(value,name);
      const identityCount = Object.keys(identities).length;
      if(!identityCount) continue;

      const stats = countStats(identities);
      out.push({
        name,value,identities,identityCount,
        observationCount:stats.observationCount,
        multiPointIdentityCount:stats.multiPointIdentityCount,
        maxObservedPointsPerIdentity:stats.maxObservedPointsPerIdentity,
        score:score(name,identities)
      });
    }

    out.sort((a,b)=>b.score-a.score);
    return out;
  }

  function mergeCandidates(candidates, maxCount){
    const merged = {};
    for(const c of candidates.slice(0,maxCount)){
      for(const [key,rec] of Object.entries(c.identities)){
        const id = identityOf(rec,key);
        if(!id) continue;
        const obs = observationsOf(rec);
        if(!merged[id]){
          merged[id] = Object.assign({},rec,{
            identity:id,
            observations:obs,
            history:obs,
            temporalSequence:obs,
            publicationSources:[c.name]
          });
        } else {
          const combined = observationsOf(merged[id]).concat(obs);
          merged[id] = Object.assign({},merged[id],rec,{
            identity:id,
            observations:combined,
            history:combined,
            temporalSequence:combined,
            publicationSources:[...new Set([...(merged[id].publicationSources||[]),c.name])]
          });
        }
      }
    }
    return merged;
  }

  function publish(canonical){
    for(const name of CANONICAL_NAMES) global[name] = canonical;
    global.RainGuardN4B1B3BH3B1PublishedCanonicalTemporalSourceV39 = canonical;
    global.RainGuardN4B1B3BH3B2ARuntimeBoundCanonicalTemporalSourceV39 = canonical;
  }

  async function run(options){
    if(state.running){
      return {success:false,phase:PHASE,version:VERSION,build:BUILD,status:"H3B2A_ALREADY_RUNNING"};
    }

    state.running = true;
    const startedAt = Date.now();

    try{
      const opts = Object.assign({
        maxMergedCandidates:8,
        invokeH3B2:true,
        h3b2Options:{}
      }, options || {});

      const candidates = discoverCandidates();

      if(!candidates.length){
        const result = {
          success:false, phase:PHASE, version:VERSION, build:BUILD,
          status:"NO_TEMPORAL_RUNTIME_CANDIDATES_FOUND",
          candidateCount:0, generatedAt:Date.now(), durationMs:Date.now()-startedAt
        };
        state.lastRun = result;
        state.lastError = result.status;
        return result;
      }

      const identities = mergeCandidates(candidates,Math.max(1,opts.maxMergedCandidates));
      const identityCount = Object.keys(identities).length;
      const stats = countStats(identities);

      if(!identityCount || !stats.observationCount){
        const result = {
          success:false, phase:PHASE, version:VERSION, build:BUILD,
          status:"TEMPORAL_CANDIDATES_FOUND_BUT_NO_CANONICAL_OBSERVATIONS",
          candidateCount:candidates.length, identityCount,
          observationCount:stats.observationCount,
          generatedAt:Date.now(), durationMs:Date.now()-startedAt
        };
        state.lastRun = result;
        state.lastError = result.status;
        return result;
      }

      const canonical = {
        success:true, phase:PHASE, version:VERSION, build:BUILD,
        status:"H3B1_CANONICAL_TEMPORAL_SOURCE_PUBLISHED",
        selectedSourceName:candidates[0].name,
        selectedSourceNames:candidates.slice(0,opts.maxMergedCandidates).map(c=>c.name),
        candidateCount:candidates.length,
        identityCount,
        observationCount:stats.observationCount,
        multiPointIdentityCount:stats.multiPointIdentityCount,
        maxObservedPointsPerIdentity:stats.maxObservedPointsPerIdentity,
        identities,
        generatedAt:Date.now()
      };

      publish(canonical);

      let h3b2 = {
        available:isFn(global.runRainGuardN4B1B3BH3B2CrossCycleCoordinateDiversityTemporalMovementReconstructionBridge),
        invoked:false, success:false
      };

      if(opts.invokeH3B2 && h3b2.available){
        try{
          const result = await global.runRainGuardN4B1B3BH3B2CrossCycleCoordinateDiversityTemporalMovementReconstructionBridge(opts.h3b2Options || {});
          h3b2 = {available:true,invoked:true,success:!!(result&&result.success),result};
        }catch(e){
          h3b2 = {available:true,invoked:true,success:false,error:e?.message||String(e)};
        }
      }

      const result = {
        success:true,
        phase:PHASE,
        version:VERSION,
        build:BUILD,
        status:h3b2.invoked && h3b2.success
          ? "H3B1_CANONICAL_TEMPORAL_SOURCE_PUBLISHED_H3B2_BOUND_AND_EXECUTED"
          : "H3B1_CANONICAL_TEMPORAL_SOURCE_PUBLISHED_H3B2_BINDING_READY",
        candidateCount:candidates.length,
        candidateSample:candidates.slice(0,20).map(c=>({
          name:c.name,
          identityCount:c.identityCount,
          observationCount:c.observationCount,
          multiPointIdentityCount:c.multiPointIdentityCount,
          maxObservedPointsPerIdentity:c.maxObservedPointsPerIdentity,
          score:Math.round(c.score)
        })),
        selectedSourceName:canonical.selectedSourceName,
        selectedSourceNames:canonical.selectedSourceNames,
        canonicalSourcePublished:true,
        canonicalPublicationNames:CANONICAL_NAMES.slice(),
        h3b2RuntimeSourceBound:true,
        identityCount,
        observationCount:stats.observationCount,
        multiPointIdentityCount:stats.multiPointIdentityCount,
        maxObservedPointsPerIdentity:stats.maxObservedPointsPerIdentity,
        h3b2,
        generatedAt:Date.now(),
        durationMs:Date.now()-startedAt
      };

      global.RainGuardN4B1B3BH3B2AResultV39 = result;
      state.runs++;
      state.lastRun = result;
      state.lastError = null;

      console.log(`[RainGuard Phase ${PHASE}] Canonical Publication & H3B2 Binding Recovery result:`);
      console.log(result);
      if(console.table) try { console.table(result.candidateSample); } catch(_) {}

      return result;

    }catch(e){
      const result = {
        success:false, phase:PHASE, version:VERSION, build:BUILD,
        status:"H3B2A_PUBLICATION_BINDING_RECOVERY_FAILED",
        error:e?.message||String(e),
        generatedAt:Date.now(),
        durationMs:Date.now()-startedAt
      };
      global.RainGuardN4B1B3BH3B2AResultV39 = result;
      state.lastRun = result;
      state.lastError = result.error;
      console.error(`[RainGuard Phase ${PHASE}] failed:`,e);
      return result;
    }finally{
      state.running = false;
    }
  }

  function diagnose(){
    const canonicalAvailability = {};
    for(const name of CANONICAL_NAMES){
      const v = global[name];
      canonicalAvailability[name] = {
        exists:v != null,
        type:typeof v,
        identityCount:isObj(v)&&isObj(v.identities)?Object.keys(v.identities).length:0
      };
    }

    const result = {
      success:true, phase:PHASE, version:VERSION, build:BUILD,
      installed:true, running:state.running, runs:state.runs,
      h3b2RunnerAvailable:isFn(global.runRainGuardN4B1B3BH3B2CrossCycleCoordinateDiversityTemporalMovementReconstructionBridge),
      canonicalAvailability,
      lastError:state.lastError,
      lastRun:state.lastRun
    };

    console.log(`[RainGuard Phase ${PHASE}] Diagnostic:`,result);
    return result;
  }

  global.runRainGuardN4B1B3BH3B2AH3B1CanonicalTemporalSourcePublicationH3B2RuntimeBindingRecoveryBridge = run;
  global.diagnoseRainGuardN4B1B3BH3B2AH3B1CanonicalTemporalSourcePublicationH3B2RuntimeBindingRecoveryBridge = diagnose;
  global.RainGuardN4B1B3BH3B2ABridgeV39 = {phase:PHASE,version:VERSION,build:BUILD,run,diagnose,state};

})(window);
