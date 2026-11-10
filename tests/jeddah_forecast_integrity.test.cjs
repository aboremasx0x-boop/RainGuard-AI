const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const script = fs.readFileSync("frontend/js/rain_forecast_engine_v32.js", "utf8");
const listeners = [];
const window = { RG30: {}, dispatchEvent: e => listeners.push(e.type) };
const ctx = vm.createContext({window, console, Date, CustomEvent: class {constructor(type,opts){this.type=type;this.detail=opts?.detail;}}});
vm.runInContext(script,ctx);
const engine = window.RainForecastEngineV32 || window.RG32?.RainForecastEngine || window.RG30?.RainForecastEngineV32;
assert.ok(engine?.analyzePayload,"forecast engine registration missing");
const t0 = Math.ceil(Date.now()/3600000)*3600000;
function payload(precip, probs, rain) {
  return {latitude:21.5433,longitude:39.1728,timezone:"UTC",
    hourly:{time:Array.from({length:72},(_,i)=>new Date(t0+i*3600000).toISOString()),
      precipitation:precip,precipitation_probability:probs,rain:rain||[]}};
}
const city={name:"Jeddah",lat:21.5433,lon:39.1728};
function get(p){return engine.analyzePayload(p,city);}
let dry=get(payload(Array(72).fill(0),Array(72).fill(0)));
for(const h of ["6h","12h","24h"]){
 assert.equal(dry.horizons[h].status,"FORECAST_READY",h);
 assert.equal(dry.horizons[h].totalRainMm,0,h);
 assert.equal(dry.horizons[h].rainProbability,0,h);
}
let wet=Array(72).fill(0);wet[1]=4;wet[3]=7;
let rainy=get(payload(wet,Array(72).fill(60)));
assert.equal(rainy.horizons["6h"].totalRainMm,11);
assert.equal(rainy.horizons["12h"].totalRainMm,11);
assert.equal(rainy.horizons["24h"].totalRainMm,11);
let missing=Array(72).fill(null);let unknown=get(payload(missing,Array(72).fill(null)));
for(const h of ["6h","12h","24h"]){
 assert.equal(unknown.horizons[h].status,"INSUFFICIENT_FORECAST_DATA",h);
 assert.equal(unknown.horizons[h].totalRainMm,null,h);
 assert.equal(unknown.horizons[h].rainProbability,null,h);
}
assert.equal(unknown.summary.next24Hours.totalRainMm,null);
assert.equal(unknown.summary.next24Hours.rainProbability,null);
let partly=Array(72).fill(0);partly[4]=null;
let partial=get(payload(partly,Array(72).fill(0)));
assert.equal(partial.horizons["6h"].status,"INSUFFICIENT_FORECAST_DATA");
assert.equal(partial.horizons["6h"].totalRainMm,null);
assert.equal(partial.horizons["12h"].totalRainMm,null);
assert.equal(partial.horizons["24h"].totalRainMm,null);
let onlyRain=get(payload(Array(72).fill(null),Array(72).fill(10),Array(72).fill(1)));
assert.equal(onlyRain.horizons["6h"].totalRainMm,6);
assert.equal(onlyRain.horizons["12h"].totalRainMm,12);
assert.equal(onlyRain.horizons["24h"].totalRainMm,24);
let missingProb=get(payload(Array(72).fill(0),Array(72).fill(null)));
assert.equal(missingProb.horizons["6h"].rainProbability,null);
assert.equal(missingProb.horizons["6h"].status,"INSUFFICIENT_FORECAST_DATA");
console.log("PASS: Jeddah dry, wet, missing, partial and rain fallback (6/12/24h)");
