/* V33 DOM smoke checks without external packages or network. */
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const script=fs.readFileSync("frontend/js/rainguard-v33-interface.js","utf8");
const html=fs.readFileSync("frontend/national-ai-os-v30.html","utf8");
const css=fs.readFileSync("frontend/css/rainguard-v33-interface.css","utf8");
function run({fetchImpl,hub=true}){
  const created=[];
  const anchor={parentNode:{insertBefore(el,before){assert.equal(before,anchor);created.push(el)}}};
  const status={textContent:"",style:{}};
  const body={classList:{entries:[],add(x){this.entries.push(x)}}};
  const nodes={operationsHub:hub?anchor:null,rgV33ApiStatus:status};
  const document={readyState:"complete",body,createElement(tag){return {tagName:tag,setAttribute(){},innerHTML:"",className:"",id:""}},getElementById(id){return nodes[id]||null;}};
  const timers=[];
  const ctx={document,fetch:fetchImpl,setTimeout(fn){timers.push(fn);return 1},clearTimeout(){},AbortController};
  vm.runInNewContext(script,ctx);
  return {created,status,body};
}
(async()=>{
 assert.ok(html.includes("rainguard-v33-interface.css?v=33-1"));
 assert.ok(html.includes("rainguard-v33-interface.js?v=33-1"));
 assert.ok(css.includes("@media(max-width:600px)"));
 const normal=run({fetchImpl:()=>Promise.resolve({ok:true,headers:{get:()=>"application/json"},json:async()=>({status:"ok",service:"RainGuard API"})})});
 assert.equal(normal.created.length,1);assert.match(normal.created[0].innerHTML,/الخريطة الوطنية/);
 for(const match of normal.created[0].innerHTML.matchAll(/href="#([^"]+)"/g)) assert.ok(html.includes('id="'+match[1]+'"'),"missing anchor: "+match[1]);
 await new Promise(resolve=>setImmediate(resolve));
 assert.match(normal.status.textContent,/يستجيب/);
 const unavailable=run({fetchImpl:()=>Promise.reject(new Error("offline"))});
 await new Promise(resolve=>setImmediate(resolve));
 assert.match(unavailable.status.textContent,/غير متصل/);
 const htmlFallback=run({fetchImpl:()=>Promise.resolve({ok:true,headers:{get:()=>"text/html"},json:async()=>({status:"ok"})})});
 await new Promise(resolve=>setImmediate(resolve));
 assert.match(htmlFallback.status.textContent,/غير متصل/);
 const absent=run({fetchImpl:()=>{throw Error("Should not fetch")},hub:false}); assert.equal(absent.created.length,0);
 console.log("V33 smoke tests PASS: insert once, internal links, responsive CSS, API JSON/offline/html fallback");
})().catch(err=>{console.error(err);process.exitCode=1});
