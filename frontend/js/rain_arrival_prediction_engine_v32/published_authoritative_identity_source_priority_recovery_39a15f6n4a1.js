/**
 * RainGuard AI V39
 * Phase 39A-15F6N4A1 — Published Authoritative Identity Source Priority Recovery
 * Version: 39A.15F6N4A1.0
 */
(function (global) {
  "use strict";

  const PHASE = "39A-15F6N4A1";
  const VERSION = "39A.15F6N4A1.0";
  const BUILD = "rainguard-v39-published-authoritative-identity-source-priority-recovery";

  if (global.__RainGuardPublishedAuthoritativeIdentitySourcePriorityRecoveryInstalled) return;
  global.__RainGuardPublishedAuthoritativeIdentitySourcePriorityRecoveryInstalled = true;

  const state = { running:false, lastRun:null, lastError:null, selectedSourceName:null, selectedIdentityCount:0 };

  const isObj = v => !!v && typeof v === "object";
  const s = v => v == null ? "" : String(v).trim();
  const norm = v => s(v).toLowerCase().replace(/\s+/g," ").trim();

  function identityKeyOf(r){
    if(!isObj(r)) return "";
    for(const k of ["persistentId","canonicalPersistentId","recoveredPersistentId","canonicalTrackId","canonicalId","identityKey","recoveredIdentityKey","identity","trackId","cellId","stormId","entityId","id"]){
      const v=s(r[k]); if(v) return v;
    }
    return "";
  }

  function toArray(v){
    if(!v) return [];
    if(Array.isArray(v)) return v;
    if(v instanceof Map || v instanceof Set) return Array.from(v.values());
    if(isObj(v)){
      for(const k of ["identities","authoritativeIdentities","publishedIdentities","integratedIdentities","persistentIdentities","recoveredIdentities","mergedIdentities","identityRecords","records","items","data"]){
        const x=v[k];
        if(Array.isArray(x)) return x;
        if(x instanceof Map || x instanceof Set) return Array.from(x.values());
      }
    }
    return [];
  }

  function normalize(arr,max=5000){
    const map=new Map();
    for(const item of arr.slice(0,max)){
      if(!isObj(item)) continue;
      const id=identityKeyOf(item); if(!id) continue;
      const key=norm(id);
      if(!map.has(key)){ map.set(key,item); continue; }
      const a=map.get(key);
      const ac=Array.isArray(a.observations)?a.observations.length:Array.isArray(a.history)?a.history.length:Number(a.observationCount||0);
      const bc=Array.isArray(item.observations)?item.observations.length:Array.isArray(item.history)?item.history.length:Number(item.observationCount||0);
      if(bc>ac) map.set(key,item);
    }
    return Array.from(map.values());
  }

  function priority(name){
    const n=name.toLowerCase(); let p=0;
    if(n.includes("recoveredintegrationruntimesourcediscovery")) p+=12000;
    if(n.includes("authoritative")) p+=11000;
    if(n.includes("integrated")) p+=9000;
    if(n.includes("recoveredidentityhistoricalbackfillintegration")) p+=8500;
    if(n.includes("recovered")) p+=7000;
    if(n.includes("historical")) p+=4000;
    if(n.includes("persistentstormidentities")) p+=1000;
    if(n.includes("n3a")) p+=5000;
    if(n.includes("n3")) p+=3000;
    return p;
  }

  function score(name,ids){ return ids.length ? priority(name)+(ids.length*20) : -1; }

  function collectCandidates(){
    const names=[
      "RainGuardRecoveredIntegrationRuntimeSourceDiscoveryV39",
      "RainGuardRecoveredIntegrationRuntimeSourceDiscoveryResultV39",
      "RainGuardAuthoritativePersistentStormIdentitiesV39",
      "RainGuardIntegratedPersistentStormIdentitiesV39",
      "RainGuardRecoveredIdentityHistoricalBackfillIntegrationV39",
      "RainGuardRecoveredIdentityHistoricalBackfillIntegrationResultV39",
      "RainGuardRecoveredPersistentStormIdentitiesV39",
      "RainGuardHistoricalBackfillPersistentIdentitiesV39",
      "RainGuardPersistentStormIdentitiesV39"
    ];

    const seen=new Set(), out=[];
    function add(name,value,origin){
      if(seen.has(name)) return; seen.add(name);
      const arr=toArray(value); if(!arr.length) return;
      const ids=normalize(arr); if(!ids.length) return;
      out.push({name,origin,rawCount:arr.length,normalizedCount:ids.length,identities:ids,score:score(name,ids)});
    }

    for(const n of names){ try{ add(n,global[n],"explicit"); }catch(_){} }
    try{
      for(const k of Object.keys(global).slice(0,2500)){
        const l=k.toLowerCase();
        if(!(l.includes("identity")||l.includes("identities")||l.includes("persistent")||l.includes("recovered")||l.includes("authoritative"))) continue;
        try{ add(k,global[k],"runtime-scan"); }catch(_){}
      }
    }catch(_){}

    return out.sort((a,b)=>b.score-a.score || b.normalizedCount-a.normalizedCount);
  }

  function buildAliasMap(ids){
    const m=new Map();
    const add=(a,c)=>{ const k=norm(a); if(k&&!m.has(k)) m.set(k,c); };
    for(const r of ids){
      const c=identityKeyOf(r); if(!c) continue;
      add(c,c);
      for(const k of ["persistentId","canonicalPersistentId","recoveredPersistentId","canonicalTrackId","canonicalId","identityKey","recoveredIdentityKey","identity","trackId","cellId","stormId","entityId","id"]) add(r[k],c);
      for(const k of ["aliases","identityAliases","trackAliases","historicalAliases","sourceAliases","candidateAliases"]){
        const arr=r[k]; if(!Array.isArray(arr)) continue;
        for(const a of arr){
          if(typeof a==="string"||typeof a==="number") add(a,c);
          else if(isObj(a)){ add(a.alias,c); add(a.id,c); add(a.trackId,c); add(a.cellId,c); add(a.persistentId,c); add(a.identity,c); }
        }
      }
    }
    return m;
  }

  async function run(){
    const started=Date.now();
    if(state.running) return {success:false,phase:PHASE,version:VERSION,build:BUILD,status:"PRIORITY_RECOVERY_ALREADY_RUNNING"};
    state.running=true;
    try{
      const candidates=collectCandidates();
      if(!candidates.length){
        const r={success:false,phase:PHASE,version:VERSION,build:BUILD,status:"NO_PUBLISHED_AUTHORITATIVE_IDENTITY_SOURCE_FOUND"};
        state.lastRun=r; return r;
      }

      const selected=candidates.find(c=>c.normalizedCount>=2) || candidates[0];
      if(selected.normalizedCount<2){
        const r={
          success:false,phase:PHASE,version:VERSION,build:BUILD,
          status:"PUBLISHED_IDENTITY_SOURCES_FOUND_BUT_NONE_ARE_MULTI_IDENTITY",
          selectedSourceName:selected.name,
          selectedIdentityCount:selected.normalizedCount,
          candidateSources:candidates.map(c=>({name:c.name,origin:c.origin,normalizedCount:c.normalizedCount,score:c.score}))
        };
        state.lastRun=r; return r;
      }

      const ids=selected.identities;
      const aliases=buildAliasMap(ids);

      global.RainGuardPublishedAuthoritativePersistentStormIdentitiesV39=ids;
      global.RainGuardAuthoritativePersistentStormIdentitiesV39=ids;
      global.RainGuardIntegratedPersistentStormIdentitiesV39=ids;
      global.RainGuardPersistentStormIdentitiesV39=ids;
      global.RainGuardPublishedAuthoritativeIdentityAliasMapV39=aliases;
      global.RainGuardAuthoritativePersistentIdentityAliasMapV39=aliases;

      const result={
        success:true, phase:PHASE, version:VERSION, build:BUILD,
        status:"AUTHORITATIVE_IDENTITY_SOURCE_INTEGRATED",
        selectedSourceName:selected.name,
        selectedSourceOrigin:selected.origin,
        selectedRawCount:selected.rawCount,
        selectedIdentityCount:ids.length,
        authoritativeIdentityCount:global.RainGuardAuthoritativePersistentStormIdentitiesV39.length,
        integratedIdentityCount:global.RainGuardIntegratedPersistentStormIdentitiesV39.length,
        legacyPersistentIdentityCount:global.RainGuardPersistentStormIdentitiesV39.length,
        publishedAliasCount:aliases.size,
        overrideInstalled:true,
        registryIntegrated:true,
        candidateSourceCount:candidates.length,
        candidateSources:candidates.slice(0,30).map(c=>({name:c.name,origin:c.origin,rawCount:c.rawCount,normalizedCount:c.normalizedCount,score:c.score})),
        generatedAt:Date.now(),
        durationMs:Date.now()-started,
        identitySample:ids.slice(0,20)
      };

      global.RainGuardPublishedAuthoritativeIdentitySourcePriorityRecoveryV39=result;
      state.selectedSourceName=selected.name;
      state.selectedIdentityCount=ids.length;
      state.lastRun=result;
      state.lastError=null;

      console.log(`[RainGuard Phase ${PHASE}] Published Authoritative Identity Source Priority Recovery result:`,result);
      return result;
    }catch(e){
      const r={success:false,phase:PHASE,version:VERSION,build:BUILD,status:"PUBLISHED_AUTHORITATIVE_IDENTITY_SOURCE_PRIORITY_RECOVERY_FAILED",error:e?.message||String(e)};
      state.lastRun=r; state.lastError=r.error; console.error(r); return r;
    }finally{
      state.running=false;
    }
  }

  function diagnose(){
    const r={
      success:true,phase:PHASE,version:VERSION,build:BUILD,installed:true,running:state.running,
      selectedSourceName:state.selectedSourceName,selectedIdentityCount:state.selectedIdentityCount,
      authoritativeIdentityCount:Array.isArray(global.RainGuardAuthoritativePersistentStormIdentitiesV39)?global.RainGuardAuthoritativePersistentStormIdentitiesV39.length:0,
      integratedIdentityCount:Array.isArray(global.RainGuardIntegratedPersistentStormIdentitiesV39)?global.RainGuardIntegratedPersistentStormIdentitiesV39.length:0,
      legacyPersistentIdentityCount:Array.isArray(global.RainGuardPersistentStormIdentitiesV39)?global.RainGuardPersistentStormIdentitiesV39.length:0,
      lastRun:state.lastRun,lastError:state.lastError
    };
    console.log(`[RainGuard Phase ${PHASE}] Diagnostic:`,r);
    return r;
  }

  global.runRainGuardPublishedAuthoritativeIdentitySourcePriorityRecovery=run;
  global.diagnoseRainGuardPublishedAuthoritativeIdentitySourcePriorityRecovery=diagnose;
  global.RainGuardPublishedAuthoritativeIdentitySourcePriorityRecoveryBridgeV39={phase:PHASE,version:VERSION,build:BUILD,run,diagnose,state};

})(window);
