/* RainGuard AI V32 — FORECAST-1J6E */
(function(){
"use strict";
const VERSION="FORECAST-1J6E.0", H=[6,12,24,48,72];
const n=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
const clamp=v=>Math.max(0,Math.min(100,n(v)));
const rainScore=x=>{x=Math.max(0,n(x));return x>=50?100:x>=30?80:x>=15?60:x>=5?35:x>0?15:0};
const peakScore=x=>{x=Math.max(0,n(x));return x>=20?100:x>=15?85:x>=7.5?65:x>=2.5?40:x>0?15:0};
const wadiScore=d=>{d=n(d,Infinity);return d<=250?100:d<=500?85:d<=1000?70:d<=3000?45:d<=5000?25:10};
const wadiClass=d=>d<=500?"VERY_NEAR":d<=1000?"NEAR":d<=3000?"MODERATE":"FAR";
const riskClass=s=>s>=75?"VERY_HIGH":s>=50?"HIGH":s>=25?"MODERATE":"LOW";
async function evaluateCity(city={}){
 const fusionEngine=window.RainForecastFusionV32, loader=window.HydroRiversTileLoaderV32;
 if(!fusionEngine?.forecastCity) throw Error("RAIN_FORECAST_FUSION_NOT_LOADED");
 if(!loader?.evaluateCity) throw Error("HYDRORIVERS_TILE_LOADER_NOT_LOADED");
 const [fusion,hydro]=await Promise.all([fusionEngine.forecastCity(city),loader.evaluateCity(city)]);
 const p=hydro?.proximity, wp=p?.evidence?.wadi_proximity, distanceM=Number(p?.distanceM);
 const wadiOK=hydro?.status==="REAL_WADI_PROXIMITY_READY"&&p?.available===true&&Number.isFinite(distanceM)&&p?.dataPolicy?.syntheticData===false;
 const horizons={};
 H.forEach(hours=>{
   const h=fusion?.horizons?.[hours+"h"];
   if(!h){horizons[hours+"h"]={horizonHours:hours,status:"INSUFFICIENT_FORECAST_DATA",riskScore:null,riskLevel:"UNKNOWN"};return;}
   let support=clamp(h.sourceAgreement); if(h.radarRainDetected===true) support=Math.min(100,support+10);
   const ws=wadiOK?wadiScore(distanceM):0;
   const score=clamp(rainScore(h.totalRainMm)*.35+peakScore(h.peakRainMmH)*.30+clamp(h.rainProbability)*.15+support*.10+ws*.10);
   horizons[hours+"h"]={
     horizonHours:hours,status:h.status==="FUSION_READY"?"SPATIAL_FLOOD_RISK_READY":"INSUFFICIENT_FORECAST_DATA",
     riskScore:Math.round(score),riskLevel:riskClass(score),
     evidence:{totalRainMm:n(h.totalRainMm),peakRainMmH:n(h.peakRainMmH),rainProbability:clamp(h.rainProbability),sourceAgreement:clamp(h.sourceAgreement),
       radarRainDetected:h.radarRainDetected===true,
       wadiProximity:{available:wadiOK,distanceM:wadiOK?Math.round(distanceM):null,distanceKm:wadiOK?Number((distanceM/1000).toFixed(3)):null,
         proximityClass:wadiOK?wadiClass(distanceM):"UNKNOWN",proximityScore:wadiOK?ws:null,source:wp?.source||null,quality:wp?.quality||null,tile:hydro?.tile||null}},
     limitations:{preliminary:true,rainfallDrivenOnly:false,realWadiProximityIncluded:wadiOK,confirmedFloodPrediction:false,locallyCalibrated:false,
       missingHydrology:["terrain","drainage_capacity","soil_moisture","land_cover","local_hydrological_calibration"]}
   };
 });
 const ready=Object.values(horizons).filter(x=>x.status==="SPATIAL_FLOOD_RISK_READY");
 const highest=ready.length?ready.reduce((a,b)=>n(b.riskScore)>n(a.riskScore)?b:a):null;
 const result={engine:"FloodRiskWadiIntegrationV32",version:VERSION,status:ready.length?"SPATIAL_FLOOD_RISK_READY":"INSUFFICIENT_FORECAST_DATA",
   city:fusion?.city||city.name||city.nameAr||"Unknown",sourceFusionVersion:fusion?.version||null,hydroRiversLoaderVersion:loader.version||null,
   spatialContext:{wadiProximityAvailable:wadiOK,nearestWadiDistanceM:wadiOK?Math.round(distanceM):null,nearestWadiDistanceKm:wadiOK?Number((distanceM/1000).toFixed(3)):null,
     proximityClass:wadiOK?wadiClass(distanceM):"UNKNOWN",tile:hydro?.tile||null,featureCount:hydro?.featureCount??null,source:wp?.source||null,quality:wp?.quality||null,syntheticData:p?.dataPolicy?.syntheticData===true},
   methodology:{type:"rainfall_plus_real_wadi_proximity_screening",realWadiProximityIncluded:wadiOK,confirmedFloodPrediction:false,locallyCalibrated:false},
   highestRisk:highest?{horizonHours:highest.horizonHours,riskScore:highest.riskScore,riskLevel:highest.riskLevel}:null,horizons};
 window.RG32=window.RG32||{}; window.RG32.latestSpatialFloodRisk=result;
 window.dispatchEvent(new CustomEvent("rainguard:spatial-flood-risk-ready",{detail:result}));
 return result;
}
const api={version:VERSION,evaluateCity,wadiProximityScore:wadiScore,proximityClass:wadiClass,getStatus:()=>({version:VERSION,ready:true,realWadiProximityRequired:true,syntheticDataAllowed:false,confirmedFloodPrediction:false,locallyCalibrated:false})};
window.FloodRiskWadiIntegrationV32=api; window.RG32=window.RG32||{}; window.RG32.FloodRiskWadiIntegration=api;
console.log("FloodRiskWadiIntegrationV32",VERSION,"ready.");
})();
