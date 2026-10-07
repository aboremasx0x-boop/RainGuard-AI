/* RainGuard AI V32 — FORECAST-1J6F */
(function(){
"use strict";
const NAME="FloodRiskTerrainIntegrationV32", VERSION="FORECAST-1J6F.0", H=[6,12,24,48,72];
const n=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
const clamp=v=>Math.max(0,Math.min(100,n(v)));
const riskClass=s=>s>=75?"VERY_HIGH":s>=50?"HIGH":s>=25?"MODERATE":"LOW";
const slopeScore=d=>{d=Math.max(0,n(d));return d>=20?100:d>=12?80:d>=6?60:d>=2?35:15};
async function terrainCall(p,c){if(typeof p?.collect==="function")return await p.collect(c);if(typeof p?.evaluateCity==="function")return await p.evaluateCity(c);throw Error("FORECAST_1J3_API_NOT_AVAILABLE")}
function terrainOf(r){
 const t=r?.evidence?.terrain||r?.terrain||r?.data?.terrain||{}, s=r?.evidence?.slope||r?.slope||r?.data?.slope||{};
 const e=t?.value??t?.elevationM??r?.elevationM??r?.elevation, d=s?.value??s?.degrees??s?.slopeDegrees??r?.slopeDegrees??r?.slopeDeg;
 const p=s?.metadata?.slopePercent??s?.slopePercent??r?.slopePercent??null;
 const syn=r?.provider?.syntheticData??r?.dataPolicy?.syntheticData??t?.syntheticData??false;
 const ok=Number.isFinite(Number(e))&&Number.isFinite(Number(d))&&syn===false;
 return {available:ok,elevationM:ok?Number(e):null,slopeDegrees:ok?Number(d):null,slopePercent:ok&&Number.isFinite(Number(p))?Number(p):null,source:t?.source||r?.provider?.source||r?.source||null,dataset:r?.provider?.dataset||t?.dataset||null,quality:t?.quality||r?.quality||null,syntheticData:syn===true};
}
async function evaluateCity(city={}){
 const w=window.FloodRiskWadiIntegrationV32, p=window.HydrologicalDataProviderBridgeV32;
 if(!w?.evaluateCity)throw Error("FORECAST_1J6E_NOT_LOADED"); if(!p)throw Error("FORECAST_1J3_NOT_LOADED");
 const [base,traw]=await Promise.all([w.evaluateCity(city),terrainCall(p,city)]), t=terrainOf(traw);
 if(t.syntheticData)throw Error("SYNTHETIC_TERRAIN_DATA_REJECTED");
 const ts=t.available?slopeScore(t.slopeDegrees):0, horizons={};
 H.forEach(hours=>{const k=hours+"h", b=base?.horizons?.[k]; if(!b||b.status!=="SPATIAL_FLOOD_RISK_READY"){horizons[k]={horizonHours:hours,status:"INSUFFICIENT_FORECAST_DATA",riskScore:null,riskLevel:"UNKNOWN"};return}
  const score=t.available?clamp(clamp(b.riskScore)*.90+ts*.10):clamp(b.riskScore);
  horizons[k]={...b,status:"TERRAIN_SPATIAL_FLOOD_RISK_READY",riskScore:Math.round(score),riskLevel:riskClass(score),evidence:{...(b.evidence||{}),terrain:{available:t.available,elevationM:t.elevationM,slopeDegrees:t.slopeDegrees,slopePercent:t.slopePercent,terrainScore:t.available?ts:null,source:t.source,dataset:t.dataset,quality:t.quality,syntheticData:false}},limitations:{...(b.limitations||{}),realTerrainIncluded:t.available,confirmedFloodPrediction:false,locallyCalibrated:false,missingHydrology:["drainage_capacity","soil_moisture","land_cover","local_hydrological_calibration"]}};
 });
 const ready=Object.values(horizons).filter(x=>x.status==="TERRAIN_SPATIAL_FLOOD_RISK_READY"), hi=ready.length?ready.reduce((a,b)=>n(b.riskScore)>n(a.riskScore)?b:a):null;
 const result={engine:NAME,version:VERSION,status:ready.length?"TERRAIN_SPATIAL_FLOOD_RISK_READY":"INSUFFICIENT_FORECAST_DATA",city:base?.city||city.name||city.nameAr||"Unknown",sourceWadiRiskVersion:base?.version||null,hydrologicalProviderVersion:p?.version||traw?.version||null,spatialContext:{...(base?.spatialContext||{}),terrainAvailable:t.available,elevationM:t.elevationM,slopeDegrees:t.slopeDegrees,slopePercent:t.slopePercent,terrainSource:t.source,terrainDataset:t.dataset,syntheticData:false},methodology:{type:"rainfall_plus_real_wadi_plus_real_dem_terrain_screening",realWadiProximityIncluded:base?.methodology?.realWadiProximityIncluded===true,realTerrainIncluded:t.available,confirmedFloodPrediction:false,locallyCalibrated:false},highestRisk:hi?{horizonHours:hi.horizonHours,riskScore:hi.riskScore,riskLevel:hi.riskLevel}:null,horizons};
 window.RG32=window.RG32||{};window.RG32.latestTerrainSpatialFloodRisk=result;window.dispatchEvent(new CustomEvent("rainguard:terrain-spatial-flood-risk-ready",{detail:result}));return result;
}
const api={name:NAME,version:VERSION,horizons:[...H],evaluateCity,slopeScore,getStatus:()=>({version:VERSION,ready:true,requires1J6E:true,requires1J3:true,realTerrainRequired:true,syntheticDataAllowed:false,confirmedFloodPrediction:false,locallyCalibrated:false})};
window.FloodRiskTerrainIntegrationV32=api;window.RG32=window.RG32||{};window.RG32.FloodRiskTerrainIntegration=api;console.log(NAME,VERSION,"ready.");
})();
