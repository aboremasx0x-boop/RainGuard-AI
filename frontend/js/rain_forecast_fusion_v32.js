/* =========================================================
   RainGuard AI V32
   VISUALCROSSING-1D — Multi-Source Rain Forecast Fusion
   Version: FORECAST-1D.2
   ========================================================= */
(function () {
"use strict";
const ENGINE_NAME="RainForecastFusionV32", VERSION="FORECAST-1D.2";
const HORIZONS=[6,12,24,48,72];
const num=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const clamp=(v,min=0,max=100)=>Math.min(max,Math.max(min,num(v)));
const round=(v,d=1)=>Math.round(num(v)*10**d)/10**d;
const realAnwaa=r=>!!(r&&r.official===true&&r.available===true&&r.ok!==false&&r.status!=="SIMULATION"&&r.status!=="PENDING_API"&&r.provider==="National Center for Meteorology");
const liveRadar=r=>!!(r&&r.available===true&&r.status==="AVAILABLE");
const omReady=r=>!!(r&&r.status==="FORECAST_READY");
const vcReady=r=>!!(r&&r.ok===true&&r.status==="FORECAST_READY"&&(r.source==="visual_crossing"||r.provider==="Visual Crossing"));
function aw(r,h){const w=r?.forecastWindows?.[`h${h}`];return w?{probability:clamp(w.probability),rainAmount:Math.max(0,num(w.rainAmount)),peakRainMmH:0,peakTime:null,rainStart:null,rainEnd:null,severity:null}:null}
function nw(r,h){const w=r?.horizons?.[`${h}h`];return w?{probability:clamp(w.rainProbability),rainAmount:Math.max(0,num(w.totalRainMm)),peakRainMmH:Math.max(0,num(w.peakRainMmH)),peakTime:num(w.peakRainMmH)>0?w.peakTime:null,rainStart:w.rainStart??null,rainEnd:w.rainEnd??null,severity:w.severity??null}:null}
function radar(r){if(!liveRadar(r))return{available:false,rainDetected:false,signalScore:0,rainAmount:0};const s=clamp(r.signalScore),a=Math.max(0,num(r.rainAmount));return{available:true,rainDetected:s>0||a>0||num(r.rainProbability)>0,signalScore:s,rainAmount:a,timestamp:r.timestamp??null}}
function compare(o,v){if(!o||!v)return{available:false,probabilityDifference:null,rainAmountDifferenceMm:null,rainSignalAgreement:null,level:"NOT_COMPARABLE"};const pd=Math.abs(num(o.probability)-num(v.probability)),ad=Math.abs(num(o.rainAmount)-num(v.rainAmount)),or=num(o.probability)>=30||num(o.rainAmount)>0,vr=num(v.probability)>=30||num(v.rainAmount)>0,same=or===vr;let level="LOW";if(same&&pd<=15&&ad<=2)level="HIGH";else if(same&&pd<=30&&ad<=5)level="MEDIUM";return{available:true,probabilityDifference:round(pd,0),rainAmountDifferenceMm:round(ad,2),rainSignalAgreement:same,level}}
function agreement({official,om,vc,cmp,ra,rd,p,a}){let s=0;if(official)s+=35;if(om)s+=20;if(vc)s+=20;if(ra)s+=10;if(cmp?.available){if(cmp.level==="HIGH")s+=10;else if(cmp.level==="MEDIUM")s+=5}if(rd&&(p>0||a>0))s+=5;return clamp(s)}
async function safe(adapter,city){try{return adapter?.collect?await adapter.collect(city):null}catch(e){console.warn("[RainForecastFusionV32] source failed:",e);return null}}
async function forecastCity(city={}){
 const aa=window.RG30?.AnwaaAdapter, rr=window.RG30?.RainViewerAdapter, oe=window.RainForecastEngineV32, va=window.VisualCrossingForecastAdapterV32||window.RG32?.VisualCrossingAdapter;
 const [anwaa,rview,open,visual]=await Promise.all([safe(aa,city),safe(rr,city),oe?.forecastCity?oe.forecastCity(city):Promise.resolve(null),safe(va,city)]);
 const official=realAnwaa(anwaa), r=radar(rview), om=omReady(open), vc=vcReady(visual), horizons={};
 for(const h of HORIZONS){
  const a=official?aw(anwaa,h):null,o=om?nw(open,h):null,v=vc?nw(visual,h):null,base=a||o||v,cmp=compare(o,v),p=base?.probability??0,amt=base?.rainAmount??0;
  horizons[`${h}h`]={horizonHours:h,forecastSource:a?"ANWAA_NCM":o?"OPEN_METEO":v?"VISUAL_CROSSING":"NO_FORECAST_SOURCE",official:!!a,rainProbability:round(p,0),totalRainMm:round(amt,1),peakRainMmH:round(base?.peakRainMmH??0,1),peakTime:base?.peakTime??null,rainStart:base?.rainStart??null,rainEnd:base?.rainEnd??null,severity:base?.severity??null,
   openMeteo:o?{available:true,rainProbability:round(o.probability,0),totalRainMm:round(o.rainAmount,1)}:{available:false},
   visualCrossing:v?{available:true,rainProbability:round(v.probability,0),totalRainMm:round(v.rainAmount,1)}:{available:false},
   numericalComparison:cmp,radarAvailable:r.available,radarRainDetected:r.rainDetected,radarSignalScore:r.signalScore,
   sourceAgreement:agreement({official:!!a,om,vc,cmp,ra:r.available,rd:r.rainDetected,p,a:amt}),status:base?"FUSION_READY":"NO_FORECAST_DATA"};
 }
 const result={engine:ENGINE_NAME,version:VERSION,status:(om||vc||official)?"FUSION_READY":"NO_FORECAST_DATA",city:city.name??city.nameAr??city.city??"Unknown",lat:city.lat??city.latitude??null,lon:city.lon??city.lng??city.longitude??null,
 sources:{anwaa:{configured:window.RG30?.AnwaaAdapter?.isConfigured?.()??false,available:official,status:anwaa?.status??"NOT_AVAILABLE",official:anwaa?.official===true,simulationRejected:anwaa?.status==="SIMULATION"},
 rainViewer:{available:r.available,status:rview?.status??"NOT_AVAILABLE",rainDetected:r.rainDetected,signalScore:r.signalScore,timestamp:r.timestamp??null},
 openMeteo:{available:om,status:open?.status??"NOT_AVAILABLE"},
 visualCrossing:{available:vc,status:visual?.status??"NOT_AVAILABLE",provider:visual?.provider??"Visual Crossing",version:visual?.version??null}},horizons,generatedAt:new Date().toISOString()};
 window.RG32=window.RG32||{};window.RG32.latestRainForecastFusion=result;window.dispatchEvent(new CustomEvent("rainguard:forecast-fusion-ready",{detail:result}));return result;
}
function getStatus(){return{engine:ENGINE_NAME,version:VERSION,ready:true,horizons:[...HORIZONS],priority:["ANWAA_NCM","OPEN_METEO","VISUAL_CROSSING","RAINVIEWER_RADAR"],note:"sourceAgreement measures source/data agreement, not forecast accuracy."}}
const api={name:ENGINE_NAME,version:VERSION,horizons:[...HORIZONS],forecastCity,getStatus};
window.RainForecastFusionV32=api;window.RG32=window.RG32||{};window.RG32.RainForecastFusion=api;
console.log(`${ENGINE_NAME} ${VERSION} ready.`);
window.dispatchEvent(new CustomEvent("rainguard:forecast-fusion-engine-ready",{detail:getStatus()}));
})();
