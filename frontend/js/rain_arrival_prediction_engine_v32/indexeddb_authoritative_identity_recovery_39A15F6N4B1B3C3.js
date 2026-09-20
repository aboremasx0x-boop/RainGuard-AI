/*
 RainGuard AI V39 — C3-FIX6
 Memory-Safe Bounded Authoritative Identity Recovery
*/
(function(global){
"use strict";
const PHASE="39A-15F6N4B1B3C3-FIX6";
const VERSION="39A.15F6N4B1B3C3.FIX6";
const BUILD="rainguard-v39-authoritative-identity-recovery-memory-safe-fix6";
const DB_NAME="RainGuardIdentityRecoveryV39", DB_VERSION=1, STORE="identities";
const MAX_RUNTIME=1500, MAX_SCAN=12000, BATCH=250;
const state={initialized:false,running:false,lastPersistResult:null,lastRecoveryResult:null};

const yieldUI=()=>new Promise(r=>setTimeout(r,0));
const str=v=>(typeof v==="string"&&v.trim())?v.trim():
    (typeof v==="number"&&Number.isFinite(v)?String(v):null);
function pick(o,keys){for(const k of keys){const v=str(o?.[k]);if(v)return v;}return null;}
function descriptor(o){
 if(!o||typeof o!=="object")return null;
 const sourceTrackId=pick(o,["sourceTrackId","canonicalTrackId","trackId","stableId","stormId","entityId","id"]);
 const canonicalTrackId=pick(o,["canonicalTrackId","stableId","trackId","sourceTrackId","id"]);
 if(!sourceTrackId&&!canonicalTrackId)return null;
 return {sourceTrackId:sourceTrackId||canonicalTrackId,
   canonicalTrackId:canonicalTrackId||sourceTrackId,
   trackId:pick(o,["trackId"])||canonicalTrackId||sourceTrackId};
}
function arr(v,limit=MAX_RUNTIME){
 if(!v)return[];
 let a=[];
 if(Array.isArray(v))a=v;
 else if(v instanceof Map||v instanceof Set)a=Array.from(v.values());
 return a.slice(0,limit).filter(x=>x&&typeof x==="object");
}
function discoverRuntimeTracks(){
 const a=[],add=v=>{if(a.length<MAX_RUNTIME)a.push(...arr(v,MAX_RUNTIME-a.length));};
 add(global.RainArrivalLiveStormEntities);
 const s=global.RainArrivalStormEntitySourceAdapterV32;
 add(s?.capturedEntities);add(s?.entities);add(s?.store);
 const b=global.RainArrivalStormTrackStoreBridgeV32;
 add(b?.tracks);add(b?.entities);add(b?.store);
 const t=global.RainArrivalTrackStoreV32;
 add(t?.tracks);add(t?.entities);add(t?.store);
 const seen=new Set(),out=[];
 for(const x of a){const d=descriptor(x),k=d?.sourceTrackId||d?.canonicalTrackId;
   if(k&&seen.has(k))continue;if(k)seen.add(k);out.push(x);if(out.length>=MAX_RUNTIME)break;}
 return out;
}
function openDB(){
 return new Promise((res,rej)=>{
  if(!global.indexedDB)return rej(new Error("INDEXEDDB_UNAVAILABLE"));
  const q=global.indexedDB.open(DB_NAME,DB_VERSION);
  q.onupgradeneeded=e=>{const db=e.target.result;if(!db.objectStoreNames.contains(STORE)){
    const s=db.createObjectStore(STORE,{keyPath:"sourceTrackId"});
    s.createIndex("canonicalTrackId","canonicalTrackId",{unique:false});
  }};
  q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error||new Error("DB_OPEN_FAILED"));
 });
}
function writeBatch(db,records){
 return new Promise((res,rej)=>{
  const tx=db.transaction(STORE,"readwrite"),s=tx.objectStore(STORE);let n=0;
  for(const x of records){const q=s.put(x);q.onsuccess=()=>n++;}
  tx.oncomplete=()=>res(n);tx.onerror=()=>rej(tx.error||new Error("DB_WRITE_FAILED"));
 });
}
async function persistTracks(){
 if(state.running)return{success:false,status:"C3_BUSY",persistedCount:0};
 state.running=true;let db;
 try{
  const runtime=discoverRuntimeTracks(),records=[];let skipped=0;
  for(let i=0;i<runtime.length;i++){const d=descriptor(runtime[i]);d?records.push(d):skipped++;
    if(i&&i%250===0)await yieldUI();}
  db=await openDB();let persisted=0;
  for(let i=0;i<records.length;i+=BATCH){persisted+=await writeBatch(db,records.slice(i,i+BATCH));await yieldUI();}
  return state.lastPersistResult={success:true,status:"AUTHORITATIVE_IDENTITIES_PERSISTED_MEMORY_SAFE",
   phase:PHASE,version:VERSION,build:BUILD,scannedCount:runtime.length,persistedCount:persisted,
   skippedCount:skipped,bounded:runtime.length>=MAX_RUNTIME};
 }catch(e){return state.lastPersistResult={success:false,status:"PERSIST_FAILED",
   error:String(e?.message||e),persistedCount:0};}
 finally{try{db?.close();}catch(_){}state.running=false;}
}
async function recoverTracks(){
 if(state.running)return{success:false,status:"C3_BUSY",recoveredCount:0};
 state.running=true;let db;
 try{
  const runtime=discoverRuntimeTracks(),wanted=new Map();
  for(const x of runtime){const d=descriptor(x);if(d)wanted.set(d.sourceTrackId,{raw:x,d});}
  db=await openDB();let scanned=0,recovered=0,limited=false;
  await new Promise((res,rej)=>{
   const tx=db.transaction(STORE,"readonly"),q=tx.objectStore(STORE).openCursor();
   q.onerror=()=>rej(q.error||new Error("CURSOR_FAILED"));
   q.onsuccess=e=>{
    const c=e.target.result;if(!c)return res();
    if(scanned>=MAX_SCAN){limited=true;return res();}
    scanned++;const p=descriptor(c.value);
    const hit=p&&(wanted.get(p.sourceTrackId)||wanted.get(p.canonicalTrackId));
    if(hit){
      try{
       const canonical=p.canonicalTrackId||p.sourceTrackId;
       if(!hit.raw.canonicalTrackId)hit.raw.canonicalTrackId=canonical;
       if(!hit.raw.stableId)hit.raw.stableId=canonical;
       hit.raw.authoritativeIdentityRecovered=true;recovered++;
       wanted.delete(hit.d.sourceTrackId);
      }catch(_){}
    }
    c.continue();
   };
  });
  return state.lastRecoveryResult={success:true,status:"AUTHORITATIVE_IDENTITIES_RECOVERED_MEMORY_SAFE",
   phase:PHASE,version:VERSION,build:BUILD,runtimeCount:runtime.length,
   scannedPersistedCount:scanned,recoveredCount:recovered,
   missingCount:Math.max(0,runtime.length-recovered),scanLimited:limited};
 }catch(e){return state.lastRecoveryResult={success:false,status:"RECOVERY_FAILED",
   error:String(e?.message||e),recoveredCount:0};}
 finally{try{db?.close();}catch(_){}state.running=false;}
}
async function persistedCount(){
 let db;try{db=await openDB();return await new Promise((res,rej)=>{
  const q=db.transaction(STORE,"readonly").objectStore(STORE).count();
  q.onsuccess=()=>res(q.result||0);q.onerror=()=>rej(q.error);
 });}catch(_){return null;}finally{try{db?.close();}catch(_){}}
}
async function diagnose(verbose=true){
 const r={success:true,phase:PHASE,version:VERSION,build:BUILD,memorySafe:true,
  runtimeCount:discoverRuntimeTracks().length,persistedCount:await persistedCount(),
  maxRuntimeTracks:MAX_RUNTIME,maxScanRecords:MAX_SCAN,batchSize:BATCH,running:state.running,
  lastPersistResult:state.lastPersistResult,lastRecoveryResult:state.lastRecoveryResult};
 if(verbose)console.log("[RainGuard][C3-FIX6] Diagnostic:",r);return r;
}
async function crossReloadTest(){
 const persist=await persistTracks(),snapshot={version:VERSION,build:BUILD,time:Date.now(),persist};
 try{sessionStorage.setItem("RG_C3_FIX6_PRE_RELOAD",JSON.stringify(snapshot));}catch(_){}
 return{success:!!persist.success,status:"C3_FIX6_PRE_RELOAD_READY",...snapshot};
}
async function initialize(){
 if(state.initialized)return{success:true,status:"ALREADY_INITIALIZED",version:VERSION};
 state.initialized=true;
 setTimeout(()=>recoverTracks().catch(e=>console.warn("[RainGuard][C3-FIX6]",e)),0);
 return{success:true,status:"INITIALIZED",phase:PHASE,version:VERSION,build:BUILD};
}
const api=Object.freeze({phase:PHASE,version:VERSION,build:BUILD,initialize,persistTracks,
 recoverTracks,crossReloadTest,diagnose,discoverRuntimeTracks,buildIdentityDescriptor:descriptor,
 config:Object.freeze({maxRuntimeTracks:MAX_RUNTIME,maxScanRecords:MAX_SCAN,batchSize:BATCH})});
global.RainGuardAuthoritativeIdentityRecoveryC3=api;
global.RainGuardAI=global.RainGuardAI||{};global.RainGuardAI.V39=global.RainGuardAI.V39||{};
global.RainGuardAI.V39.authoritativeIdentityRecoveryC3=api;
global.RainArrivalAuthoritativeIdentityRecoveryV39=api;
initialize();
console.log("[RainGuard AI V39] C3-FIX6 Memory-Safe loaded.",{phase:PHASE,version:VERSION,build:BUILD});
})(typeof globalThis!=="undefined"?globalThis:window);
