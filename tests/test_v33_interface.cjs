/* V33 DOM smoke checks without external packages or network. */
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const script=fs.readFileSync("frontend/js/rainguard-v33-interface.js","utf8");
const html=fs.readFileSync("frontend/national-ai-os-v30.html","utf8");
const css=fs.readFileSync("frontend/css/rainguard-v33-interface.css","utf8");
const root=fs.readFileSync("index.html","utf8");
const report=fs.readFileSync("frontend/js/long_horizon/national_rain_report_v32.js","utf8");
new vm.Script(report,{filename:"national_rain_report_v32.js"});
assert.ok(report.includes("hasRegionForecast"),"Report must identify coverage gaps");
assert.ok(report.includes("لا تتوفر بيانات إقليمية كافية"),"Report must disclose absent regional measurements");
assert.ok(report.includes("displayRegion(row, Math.round(row.rain6)"),"Missing region must not show zero horizon percentage");
assert.ok(report.includes("displaySummary(Math.round(report.summary.nationalConfidence)"),"National confidence unavailable without regions");
const forecast=fs.readFileSync("frontend/js/rain_forecast_ui_v32.js","utf8");
assert.ok(forecast.includes(".rgf-cards{grid-template-columns:1fr}"),"Mobile forecast cards must stack vertically");
assert.ok(forecast.includes(".rgf-card{min-width:0;overflow-wrap:anywhere"),"Forecast cards must not force width overflow");
assert.ok(!forecast.includes("repeat(5,205px)"),"Legacy horizontal 5-card scroller must not remain");
assert.match(root,/<html lang="ar" dir="rtl">/);
assert.ok(root.includes("ذكاء الأمطار والسيول في واجهة واحدة"));
assert.ok(root.includes("frontend/national-ai-os-v30.html"));
assert.ok(root.includes('id="loadPanel"'));
assert.ok(root.includes("frontend/css/rainguard-v33-interface.css?v=33-2"));
assert.ok(!root.includes("منصة إنذار المطر الذكية V10"));

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
