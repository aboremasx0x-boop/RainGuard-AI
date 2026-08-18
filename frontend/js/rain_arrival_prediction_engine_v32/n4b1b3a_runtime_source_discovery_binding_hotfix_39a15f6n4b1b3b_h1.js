
(function (global) {
  "use strict";

  const PHASE = "39A-15F6N4B1B3B-H1";
  const VERSION = "39A.15F6N4B1B3B-H1.0";
  const BUILD = "rainguard-v39-n4b1b3a-runtime-source-discovery-binding-hotfix";

  if (global.__RainGuardN4B1B3ARuntimeSourceDiscoveryBindingHotfixInstalled) return;
  global.__RainGuardN4B1B3ARuntimeSourceDiscoveryBindingHotfixInstalled = true;

  const state = { installed: true, running: false, runs: 0, lastRun: null, lastError: null };

  function isObj(v){ return !!v && typeof v === "object"; }
  function str(v){ try { return v == null ? "" : String(v); } catch(_) { return ""; } }
  function norm(v){ return str(v).trim().toLowerCase().replace(/\s+/g," "); }

  function coord(r){
    if(!isObj(r)) return null;
    const lat = Number(
      r.latitude ?? r.lat ??
      (r.coordinate && (r.coordinate.latitude ?? r.coordinate.lat)) ??
      (r.coordinates && (r.coordinates.latitude ?? r.coordinates.lat)) ??
      (Array.isArray(r.coordinate) ? r.coordinate[0] : undefined) ??
      (Array.isArray(r.coordinates) ? r.coordinates[0] : undefined)
    );
    const lon = Number(
      r.longitude ?? r.lon ?? r.lng ??
      (r.coordinate && (r.coordinate.longitude ?? r.coordinate.lon ?? r.coordinate.lng)) ??
      (r.coordinates && (r.coordinates.longitude ?? r.coordinates.lon ?? r.coordinates.lng)) ??
      (Array.isArray(r.coordinate) ? r.coordinate[1] : undefined) ??
      (Array.isArray(r.coordinates) ? r.coordinates[1] : undefined)
    );
    if(!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    if(lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
    return { latitude: lat, longitude: lon };
  }

  function identity(r, fallback){
    if(!isObj(r)) return norm(fallback);
    const vals = [
      r.identity, r.authoritativeIdentity, r.persistentId,
      r.canonicalPersistentId, r.canonicalIdentity, r.identityKey,
      r.trackId, r.cellId, r.stormId, r.entityId, r.id
    ];
    for(const v of vals){ const x = norm(v); if(x) return x; }
    return norm(fallback);
  }

  function unwrap(value){
    if(!value) return null;

    if(isObj(value) && isObj(value.identities)){
      return { type:"accumulator", identities:value.identities };
    }

    if(isObj(value) && !Array.isArray(value)){
      const vals = Object.values(value);
      const likely = vals.filter(v => isObj(v) && (
        Array.isArray(v.observations) || Array.isArray(v.history) || Array.isArray(v.points)
      ));
      if(likely.length){
        return { type:"identity-map", identities:value };
      }
    }

    if(Array.isArray(value)){
      const mapped = {};
      for(const r of value){
        const id = identity(r, "");
        if(!id) continue;
        if(!mapped[id]) mapped[id] = { identity:id, observations:[] };

        if(Array.isArray(r.observations)) mapped[id].observations.push(...r.observations);
        else if(Array.isArray(r.history)) mapped[id].observations.push(...r.history);
        else if(Array.isArray(r.points)) mapped[id].observations.push(...r.points);
        else if(coord(r)) mapped[id].observations.push(r);
      }
      if(Object.keys(mapped).length) return { type:"array", identities:mapped };
    }
    return null;
  }

  function inspect(name, value){
    const u = unwrap(value);
    if(!u) return null;

    const lname = name.toLowerCase();
    let score = 0;

    if(lname.includes("n4b1b3a")) score += 100;
    if(lname.includes("crosscycle") || lname.includes("cross_cycle")) score += 35;
    if(lname.includes("temporal")) score += 30;
    if(lname.includes("append")) score += 25;
    if(lname.includes("override")) score += 25;
    if(lname.includes("accumulator")) score += 20;
    if(lname.includes("history")) score += 15;
    if(lname.includes("identity")) score += 12;
    if(/result|diagnostic|config|bridgev39/.test(lname)) score -= 40;

    let identityCount = 0, observationCount = 0, multiPoint = 0, crossCycle = 0, coordinateRich = 0;

    for(const [k,r] of Object.entries(u.identities).slice(0,1500)){
      if(!isObj(r)) continue;
      identityCount++;

      const obs = Array.isArray(r.observations) ? r.observations :
                  Array.isArray(r.history) ? r.history :
                  Array.isArray(r.points) ? r.points : [];

      observationCount += obs.length;
      if(obs.length >= 2) multiPoint++;

      const cycles = new Set(obs.map(o => str(o && o.cycleId)).filter(Boolean));
      if(cycles.size >= 2) crossCycle++;
      if(obs.some(o => !!coord(o))) coordinateRich++;
    }

    if(identityCount >= 100) score += 30;
    else if(identityCount >= 20) score += 18;
    else if(identityCount > 0) score += 8;

    if(observationCount > identityCount) score += 40;
    if(multiPoint > 0) score += 50;
    if(crossCycle > 0) score += 50;
    if(identityCount) score += Math.round((coordinateRich / identityCount) * 20);

    return {
      sourceName:name, sourceType:u.type, identities:u.identities, score,
      identityCount, observationCount,
      multiPointIdentityCount:multiPoint,
      crossCycleIdentityCount:crossCycle,
      coordinateRichIdentityCount:coordinateRich
    };
  }

  function discover(){
    const preferred = [
      "RainGuardCrossCycleTemporalAppendOverrideAccumulatorV39",
      "RainGuardCrossCycleTemporalAppendOverrideHistoriesV39",
      "RainGuardCrossCycleSameCoordinateTemporalAppendOverrideAccumulatorV39",
      "RainGuardTimestampAwareTemporalObservationAccumulatorV39",
      "RainGuardCrossCycleAuthoritativeIdentityTemporalObservationAccumulatorV39",
      "RainGuardRuntimeAuthoritativePersistentIdentityRegistryV39",
      "RainGuardAuthoritativePersistentStormIdentitiesV39"
    ];

    const seen = new Set(), candidates = [];

    function add(name){
      if(!name || seen.has(name)) return;
      seen.add(name);
      let value;
      try { value = global[name]; } catch(_) { return; }
      if(!value || typeof value === "function") return;
      const c = inspect(name,value);
      if(c) candidates.push(c);
    }

    preferred.forEach(add);

    let keys = [];
    try { keys = Object.keys(global).slice(0,12000); } catch(_) {}
    keys.filter(k => /rain|storm|identity|temporal|append|cycle|registry|history/i.test(k)).forEach(add);

    candidates.sort((a,b) =>
      b.score - a.score ||
      b.multiPointIdentityCount - a.multiPointIdentityCount ||
      b.observationCount - a.observationCount ||
      b.identityCount - a.identityCount
    );

    return { selected:candidates[0] || null, candidates };
  }

  function normalizeSelected(selected){
    const out = {
      phase:"39A-15F6N4B1B3A",
      version:"39A.15F6N4B1B3A.runtime-bound",
      sourceName:selected.sourceName,
      boundByPhase:PHASE,
      boundAt:Date.now(),
      identities:{}
    };

    for(const [k,r] of Object.entries(selected.identities || {})){
      if(!isObj(r)) continue;
      const id = identity(r,k);
      if(!id) continue;

      let obs = [];
      if(Array.isArray(r.observations)) obs = r.observations.slice();
      else if(Array.isArray(r.history)) obs = r.history.slice();
      else if(Array.isArray(r.points)) obs = r.points.slice();
      else if(coord(r)) obs = [r];

      out.identities[id] = Object.assign({},r,{identity:id,observations:obs});
    }
    return out;
  }

  async function run(options){
    const started = Date.now();
    if(state.running){
      return {success:false,phase:PHASE,version:VERSION,build:BUILD,status:"N4B1B3A_SOURCE_DISCOVERY_ALREADY_RUNNING"};
    }

    state.running = true;
    try{
      const opts = Object.assign({invokeDownstream:true,logCandidates:true}, options || {});
      const d = discover();
      const s = d.selected;

      if(!s){
        const result = {
          success:false, phase:PHASE, version:VERSION, build:BUILD,
          status:"NO_N4B1B3A_RUNTIME_SOURCE_DISCOVERED",
          candidateCount:d.candidates.length,
          generatedAt:Date.now(), durationMs:Date.now()-started
        };
        state.lastRun = result;
        return result;
      }

      const normalized = normalizeSelected(s);

      let identityCount = 0, observationCount = 0, multiPointIdentityCount = 0, crossCycleIdentityCount = 0;

      for(const r of Object.values(normalized.identities)){
        identityCount++;
        const obs = Array.isArray(r.observations) ? r.observations : [];
        observationCount += obs.length;
        if(obs.length >= 2) multiPointIdentityCount++;
        const cycles = new Set(obs.map(o => str(o && o.cycleId)).filter(Boolean));
        if(cycles.size >= 2) crossCycleIdentityCount++;
      }

      global.RainGuardCrossCycleTemporalAppendOverrideAccumulatorV39 = normalized;
      global.RainGuardCrossCycleTemporalAppendOverrideHistoriesV39 = normalized.identities;
      global.RainGuardN4B1B3ABoundTemporalSourceV39 = {
        phase:PHASE, version:VERSION,
        selectedSourceName:s.sourceName,
        selectedSourceType:s.sourceType,
        selectedScore:s.score,
        boundAt:Date.now(),
        accumulator:normalized
      };

      let downstream = {
        invoked:false,
        available:typeof global.runRainGuardCrossCycleCoordinateChangeDetectionTemporalMotionActivationBridge === "function"
      };

      if(opts.invokeDownstream && downstream.available){
        try{
          const r = await global.runRainGuardCrossCycleCoordinateChangeDetectionTemporalMotionActivationBridge();
          downstream = {
            invoked:true, available:true,
            success:!(r && r.success === false),
            result:r
          };
        }catch(e){
          downstream = {invoked:true,available:true,success:false,error:e && e.message ? e.message : str(e)};
        }
      }

      const status =
        downstream.invoked && downstream.success
          ? "N4B1B3A_BOUND_AND_N4B1B3B_EXECUTED"
          : multiPointIdentityCount > 0 && crossCycleIdentityCount > 0
            ? "N4B1B3A_RUNTIME_SOURCE_DISCOVERED_AND_BOUND"
            : "N4B1B3A_SOURCE_BOUND_BUT_NOT_TEMPORALLY_RICH";

      const result = {
        success:identityCount > 0,
        phase:PHASE, version:VERSION, build:BUILD, status,
        selectedSourceName:s.sourceName,
        selectedSourceType:s.sourceType,
        selectedSourceScore:s.score,
        identityCount, observationCount,
        multiPointIdentityCount, crossCycleIdentityCount,
        canonicalAccumulatorPublished:true,
        canonicalHistoriesPublished:true,
        candidateCount:d.candidates.length,
        candidateSample:d.candidates.slice(0,25).map(c => ({
          source:c.sourceName,type:c.sourceType,score:c.score,
          identities:c.identityCount,observations:c.observationCount,
          multiPoint:c.multiPointIdentityCount,crossCycle:c.crossCycleIdentityCount,
          coordinateRich:c.coordinateRichIdentityCount
        })),
        downstream,
        generatedAt:Date.now(),
        durationMs:Date.now()-started
      };

      global.RainGuardN4B1B3ARuntimeSourceDiscoveryBindingHotfixResultV39 = result;

      state.runs++;
      state.lastRun = result;
      state.lastError = null;

      console.log(`[RainGuard Phase ${PHASE}] N4B1B3A Runtime Source Discovery & Binding result:`);
      console.log(result);
      if(opts.logCandidates && console.table) {
        try { console.table(result.candidateSample); } catch(_) {}
      }
      return result;

    }catch(e){
      const result = {
        success:false, phase:PHASE, version:VERSION, build:BUILD,
        status:"N4B1B3A_RUNTIME_SOURCE_DISCOVERY_BINDING_FAILED",
        error:e && e.message ? e.message : str(e),
        generatedAt:Date.now(), durationMs:Date.now()-started
      };
      state.lastRun = result;
      state.lastError = result.error;
      console.error(`[RainGuard Phase ${PHASE}] failed:`,e);
      return result;
    }finally{
      state.running = false;
    }
  }

  function diagnose(){
    const result = {
      success:true, phase:PHASE, version:VERSION, build:BUILD,
      installed:true, running:state.running, runs:state.runs,
      canonicalAccumulatorAvailable:!!global.RainGuardCrossCycleTemporalAppendOverrideAccumulatorV39,
      canonicalHistoriesAvailable:!!global.RainGuardCrossCycleTemporalAppendOverrideHistoriesV39,
      downstreamAvailable:typeof global.runRainGuardCrossCycleCoordinateChangeDetectionTemporalMotionActivationBridge === "function",
      lastError:state.lastError,lastRun:state.lastRun
    };
    console.log(`[RainGuard Phase ${PHASE}] Diagnostic:`,result);
    return result;
  }

  global.runRainGuardN4B1B3ARuntimeSourceDiscoveryBindingHotfix = run;
  global.diagnoseRainGuardN4B1B3ARuntimeSourceDiscoveryBindingHotfix = diagnose;

  global.RainGuardN4B1B3ARuntimeSourceDiscoveryBindingHotfixV39 = {
    phase:PHASE,version:VERSION,build:BUILD,run,diagnose,state
  };

})(window);
