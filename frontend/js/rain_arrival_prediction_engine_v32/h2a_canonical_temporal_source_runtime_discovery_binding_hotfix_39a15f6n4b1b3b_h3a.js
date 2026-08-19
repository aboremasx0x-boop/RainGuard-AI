(function (global) {
  "use strict";

  const PHASE = "39A-15F6N4B1B3B-H3A";
  const VERSION = "39A.15F6N4B1B3B-H3A.0";
  const BUILD = "rainguard-v39-h2a-canonical-temporal-source-runtime-discovery-binding-hotfix";

  if (global.__RainGuardN4B1B3BH3AInstalled) return;
  global.__RainGuardN4B1B3BH3AInstalled = true;

  const state = {
    installed: true,
    running: false,
    runs: 0,
    lastRun: null,
    lastError: null,
    selectedSourceName: null
  };

  function isObj(v){ return !!v && typeof v === "object"; }
  function str(v){ try { return v == null ? "" : String(v); } catch(_) { return ""; } }
  function norm(v){ return str(v).trim().toLowerCase().replace(/\s+/g, " "); }

  function idOf(r, fallback){
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
    if(Array.isArray(rec.observations)) return rec.observations.slice();
    if(Array.isArray(rec.history)) return rec.history.slice();
    if(Array.isArray(rec.temporalSequence)) return rec.temporalSequence.slice();
    if(Array.isArray(rec.points)) return rec.points.slice();
    return [];
  }

  function normalizeIdentityMap(value){
    if(!value) return null;

    if(isObj(value.identities)) return normalizeIdentityMap(value.identities);

    if(Array.isArray(value)){
      const out = {};
      for(const rec of value){
        if(!isObj(rec)) continue;
        const id = idOf(rec, "");
        if(!id) continue;
        if(!out[id]) out[id] = { identity:id, observations:[] };
        const obs = observationsOf(rec);
        if(obs.length) out[id].observations.push(...obs);
        else out[id].observations.push(rec);
      }
      return Object.keys(out).length ? out : null;
    }

    if(isObj(value)){
      const out = {};
      let accepted = 0;

      for(const [k, rec] of Object.entries(value)){
        if(!isObj(rec)) continue;
        const id = idOf(rec, k);
        if(!id) continue;

        out[id] = Object.assign({}, rec, {
          identity: id,
          observations: observationsOf(rec)
        });
        accepted++;
      }

      return accepted ? out : null;
    }

    return null;
  }

  function inspect(name, value){
    if(!value || typeof value === "function") return null;

    let candidateValue = value;

    // Common wrappers published by H2A/H2.
    if(isObj(candidateValue) && isObj(candidateValue.result)) {
      const inner = candidateValue.result;
      if(isObj(inner.identities) || Array.isArray(inner)) candidateValue = inner;
    }

    if(isObj(candidateValue) && isObj(candidateValue.accumulator)) {
      const inner = candidateValue.accumulator;
      if(isObj(inner.identities) || Array.isArray(inner) || isObj(inner)) candidateValue = inner;
    }

    const identities = normalizeIdentityMap(candidateValue);
    if(!identities) return null;

    let identityCount = 0;
    let observationCount = 0;
    let multiPointIdentityCount = 0;
    let maxObservedPointsPerIdentity = 0;

    for(const rec of Object.values(identities)){
      identityCount++;
      const obs = observationsOf(rec);
      observationCount += obs.length;
      if(obs.length >= 2) multiPointIdentityCount++;
      maxObservedPointsPerIdentity = Math.max(maxObservedPointsPerIdentity, obs.length);
    }

    const lname = String(name).toLowerCase();
    let score = 0;

    if(lname.includes("h2a")) score += 180;
    if(lname.includes("h2")) score += 120;
    if(lname.includes("canonical")) score += 100;
    if(lname.includes("temporal")) score += 80;
    if(lname.includes("crosscycle")) score += 70;
    if(lname.includes("appendoverride")) score += 60;
    if(lname.includes("accumulator")) score += 50;
    if(lname.includes("histories")) score += 35;
    if(lname.includes("runtimebound")) score += 45;
    if(lname.includes("result")) score -= 15;
    if(lname.includes("diagnostic")) score -= 50;

    if(identityCount > 0) score += 10;
    if(identityCount >= 100) score += 30;
    if(multiPointIdentityCount > 0) score += 80;
    if(maxObservedPointsPerIdentity >= 3) score += 30;
    if(observationCount > identityCount) score += 25;

    return {
      sourceName: name,
      value: candidateValue,
      identities,
      identityCount,
      observationCount,
      multiPointIdentityCount,
      maxObservedPointsPerIdentity,
      score
    };
  }

  function discoverCandidates(){
    const preferred = [
      "RainGuardN4B1B3BH2AResultV39",
      "RainGuardH2RuntimeBoundTemporalSourceV39",
      "RainGuardCrossCycleTemporalAppendOverrideAccumulatorV39",
      "RainGuardCrossCycleTemporalAppendOverrideHistoriesV39",
      "RainGuardH1CanonicalTemporalSourceV39",
      "RainGuardN4B1B3ACanonicalTemporalAccumulatorV39",
      "RainGuardN4B1B3ACanonicalTemporalHistoriesV39",
      "RainGuardN4B1B3ABoundTemporalSourceV39",
      "RainGuardN4B1B3BH2TemporalSequenceRepairV39"
    ];

    const found = [];
    const seen = new Set();

    function add(name, value){
      if(!name || seen.has(name)) return;
      seen.add(name);

      try {
        const c = inspect(name, value);
        if(c) found.push(c);
      } catch(_) {}
    }

    for(const name of preferred){
      try { add(name, global[name]); } catch(_) {}
    }

    let keys = [];
    try { keys = Object.keys(global).slice(0, 20000); } catch(_) {}

    for(const name of keys){
      if(!/rain|storm|identity|temporal|cycle|append|history|canonical|registry|h2/i.test(name)) continue;
      try { add(name, global[name]); } catch(_) {}
    }

    found.sort((a,b) =>
      b.score - a.score ||
      b.multiPointIdentityCount - a.multiPointIdentityCount ||
      b.maxObservedPointsPerIdentity - a.maxObservedPointsPerIdentity ||
      b.observationCount - a.observationCount ||
      b.identityCount - a.identityCount
    );

    return found;
  }

  function publishForH3(selected){
    const canonical = {
      phase: PHASE,
      version: VERSION,
      build: BUILD,
      sourceName: selected.sourceName,
      boundAt: Date.now(),
      identities: selected.identities
    };

    // Primary names already used by H3.
    global.RainGuardN4B1B3BH2TemporalSequenceRepairV39 = canonical;
    global.RainGuardCrossCycleTemporalAppendOverrideAccumulatorV39 = canonical;
    global.RainGuardCrossCycleTemporalAppendOverrideHistoriesV39 = canonical.identities;
    global.RainGuardH1CanonicalTemporalSourceV39 = canonical;
    global.RainGuardH2RuntimeBoundTemporalSourceV39 = canonical;

    // Additional explicit H3 binding aliases.
    global.RainGuardH2ACanonicalTemporalSourceForH3V39 = canonical;
    global.RainGuardN4B1B3BH3BoundCanonicalTemporalSourceV39 = canonical;

    return canonical;
  }

  async function run(options){
    const startedAt = Date.now();

    if(state.running){
      return {
        success: false,
        phase: PHASE,
        version: VERSION,
        build: BUILD,
        status: "H3A_ALREADY_RUNNING"
      };
    }

    state.running = true;

    try{
      const opts = Object.assign({
        refreshH2A: true,
        invokeH3: true,
        logCandidates: true,
        tableLimit: 30
      }, options || {});

      let h2aRefresh = {
        available:
          typeof global.runRainGuardN4B1B3BH2AH1CanonicalTemporalSourcePublicationH2RuntimeBindingHotfix === "function",
        invoked: false,
        success: false
      };

      if(opts.refreshH2A && h2aRefresh.available){
        try{
          const r = await global.runRainGuardN4B1B3BH2AH1CanonicalTemporalSourcePublicationH2RuntimeBindingHotfix({
            invokeH2: true,
            logCandidates: false
          });

          h2aRefresh = {
            available: true,
            invoked: true,
            success: !(r && r.success === false),
            result: r
          };
        }catch(e){
          h2aRefresh = {
            available: true,
            invoked: true,
            success: false,
            error: e && e.message ? e.message : str(e)
          };
        }
      }

      const candidates = discoverCandidates();
      const selected = candidates[0] || null;

      if(!selected){
        const result = {
          success: false,
          phase: PHASE,
          version: VERSION,
          build: BUILD,
          status: "NO_H2A_RUNTIME_CANONICAL_TEMPORAL_SOURCE_DISCOVERED",
          h2aRefresh,
          candidateCount: 0,
          generatedAt: Date.now(),
          durationMs: Date.now() - startedAt
        };
        state.lastRun = result;
        return result;
      }

      const canonical = publishForH3(selected);
      state.selectedSourceName = selected.sourceName;

      let h3 = {
        available:
          typeof global.runRainGuardN4B1B3BH3CrossCycleCoordinateProvenanceAuditLiveCoordinateRecoveryBridge === "function",
        invoked: false,
        success: false
      };

      if(opts.invokeH3 && h3.available){
        try{
          const r = await global.runRainGuardN4B1B3BH3CrossCycleCoordinateProvenanceAuditLiveCoordinateRecoveryBridge();
          h3 = {
            available: true,
            invoked: true,
            success: !(r && r.success === false),
            result: r
          };
        }catch(e){
          h3 = {
            available: true,
            invoked: true,
            success: false,
            error: e && e.message ? e.message : str(e)
          };
        }
      }

      let status = "H2A_CANONICAL_TEMPORAL_SOURCE_DISCOVERED_AND_BOUND_TO_H3";
      if(h3.invoked && h3.success){
        status = "H2A_CANONICAL_TEMPORAL_SOURCE_BOUND_H3_EXECUTED";
      }

      const result = {
        success: true,
        phase: PHASE,
        version: VERSION,
        build: BUILD,
        status,

        h2aRefresh,

        selectedSourceName: selected.sourceName,
        selectedSourceScore: selected.score,
        identityCount: selected.identityCount,
        observationCount: selected.observationCount,
        multiPointIdentityCount: selected.multiPointIdentityCount,
        maxObservedPointsPerIdentity: selected.maxObservedPointsPerIdentity,

        h3PrimarySourcePublished:
          !!global.RainGuardN4B1B3BH2TemporalSequenceRepairV39,
        crossCycleAccumulatorPublished:
          !!global.RainGuardCrossCycleTemporalAppendOverrideAccumulatorV39,
        h2RuntimeBoundSourcePublished:
          !!global.RainGuardH2RuntimeBoundTemporalSourceV39,
        explicitH3BindingPublished:
          !!global.RainGuardN4B1B3BH3BoundCanonicalTemporalSourceV39,

        candidateCount: candidates.length,
        candidateSample: candidates.slice(0, opts.tableLimit).map(c => ({
          source: c.sourceName,
          score: c.score,
          identities: c.identityCount,
          observations: c.observationCount,
          multiPoint: c.multiPointIdentityCount,
          maxPoints: c.maxObservedPointsPerIdentity
        })),

        h3,

        generatedAt: Date.now(),
        durationMs: Date.now() - startedAt
      };

      global.RainGuardN4B1B3BH3AResultV39 = result;
      state.runs++;
      state.lastRun = result;
      state.lastError = null;

      console.log(`[RainGuard Phase ${PHASE}] H2A Canonical Temporal Source Runtime Discovery & Binding result:`);
      console.log(result);

      if(opts.logCandidates && console.table){
        try { console.table(result.candidateSample); } catch(_) {}
      }

      return result;

    }catch(e){
      const result = {
        success: false,
        phase: PHASE,
        version: VERSION,
        build: BUILD,
        status: "H3A_RUNTIME_DISCOVERY_BINDING_FAILED",
        error: e && e.message ? e.message : str(e),
        generatedAt: Date.now(),
        durationMs: Date.now() - startedAt
      };

      state.lastRun = result;
      state.lastError = result.error;

      console.error(`[RainGuard Phase ${PHASE}] failed:`, e);
      return result;

    }finally{
      state.running = false;
    }
  }

  function diagnose(){
    const result = {
      success: true,
      phase: PHASE,
      version: VERSION,
      build: BUILD,
      installed: true,
      running: state.running,
      runs: state.runs,
      selectedSourceName: state.selectedSourceName,

      h2aRunnerAvailable:
        typeof global.runRainGuardN4B1B3BH2AH1CanonicalTemporalSourcePublicationH2RuntimeBindingHotfix === "function",

      h3RunnerAvailable:
        typeof global.runRainGuardN4B1B3BH3CrossCycleCoordinateProvenanceAuditLiveCoordinateRecoveryBridge === "function",

      h3PrimarySourceAvailable:
        !!global.RainGuardN4B1B3BH2TemporalSequenceRepairV39,

      explicitH3BindingAvailable:
        !!global.RainGuardN4B1B3BH3BoundCanonicalTemporalSourceV39,

      lastError: state.lastError,
      lastRun: state.lastRun
    };

    console.log(`[RainGuard Phase ${PHASE}] Diagnostic:`, result);
    return result;
  }

  global.runRainGuardN4B1B3BH3AH2ACanonicalTemporalSourceRuntimeDiscoveryBindingHotfix = run;
  global.diagnoseRainGuardN4B1B3BH3AH2ACanonicalTemporalSourceRuntimeDiscoveryBindingHotfix = diagnose;

  global.RainGuardN4B1B3BH3ABridgeV39 = {
    phase: PHASE,
    version: VERSION,
    build: BUILD,
    run,
    diagnose,
    state
  };

})(window);
