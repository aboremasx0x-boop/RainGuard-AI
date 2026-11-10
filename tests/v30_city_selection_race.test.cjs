const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const callbacks = {};
const elements = new Map();
const body = {appendChild(el){elements.set(el.id,el);}};
const document = {
  head: {appendChild(el){elements.set(el.id,el);}},
  body,
  createElement(){return {id:"",innerHTML:"",textContent:""};},
  getElementById(id){return elements.get(id)||null;},
  querySelector(selector){return selector==="main"?body:null;}
};
const window = {
  RG32:{}, RG30:{},
  addEventListener(name,cb){(callbacks[name]??=[]).push(cb);},
  dispatchEvent(e){for(const cb of callbacks[e.type]||[])cb(e);}
};
const context=vm.createContext({window,document,console,Date,Number,String,setTimeout,
  CustomEvent:class {constructor(type,opts){this.type=type;this.detail=opts?.detail;}}});
function load(path){vm.runInContext(fs.readFileSync(path,"utf8"),context,{filename:path});}
load("frontend/js/rain_forecast_ui_v32.js");
load("frontend/js/rain_forecast_city_integration_v32.js");
const ui=window.RainForecastUIV32;
const bridge=window.RainForecastCityIntegrationV32;
const jeddah={name:"Jeddah",lat:21.5433,lon:39.1728};
const dammam={name:"Dammam",lat:26.4207,lon:50.0888};
const pending=[];
window.RainForecastFusionV32={
  forecastCity(city){
    return new Promise(resolve=>pending.push({city,resolve}));
  }
};
const result=city=>({city:city.name,lat:city.lat,lon:city.lon,status:"FUSION_READY",
  generatedAt:new Date().toISOString(),horizons:{},sources:{}});
const flush=()=>new Promise(resolve=>setTimeout(resolve,10));
(async()=>{
  const p1=bridge.setCity(dammam);
  await flush();
  assert.equal(pending.length,1);
  const queued=await bridge.setCity(jeddah);
  assert.equal(queued,null);
  assert.equal(ui.getSelectionStatus().requestedCityKey,"21.5433|39.1728");
  pending[0].resolve(result(dammam));
  await p1;
  await flush();
  assert.equal(pending.length,2,"queued Jeddah must start");
  const panel=document.getElementById("rainForecastNationalPanel");
  assert.ok(!panel || !panel.innerHTML.includes("توقع الأمطار — Dammam"),
    "stale Dammam must not be displayed");
  assert.equal(window.RG32.activeForecastCity.name,"Jeddah");
  pending[1].resolve(result(jeddah));
  await flush();
  assert.match(panel.innerHTML,/توقع الأمطار — Jeddah/);
  const stale=result(dammam);
  window.dispatchEvent(new context.CustomEvent("rainguard:forecast-fusion-ready",{detail:stale}));
  assert.match(panel.innerHTML,/توقع الأمطار — Jeddah/);
  assert.doesNotMatch(panel.innerHTML,/توقع الأمطار — Dammam/);
  assert.equal(ui.getSelectionStatus().displayedCityKey,"21.5433|39.1728");
  console.log("PASS: Dammam -> Jeddah rapid selection and stale fusion event rejected");
})().catch(e=>{console.error(e);process.exitCode=1;});
