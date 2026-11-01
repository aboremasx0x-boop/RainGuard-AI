/* RainGuard AI — FORECAST-1J6G35.0: separate spatial susceptibility from forecast-triggered screening. */
(function(global){
'use strict';
const VERSION='FORECAST-1J6G35.0', HOURS=[6,12,24,48,72];
const finite=x=>x!==null&&x!==undefined&&Number.isFinite(Number(x));
const clamp=x=>Math.max(0,Math.min(100,Number(x)));
const level=x=>x>=75?'VERY_HIGH':x>=50?'HIGH':x>=25?'MODERATE':'LOW';
async function evaluateCity(city,options={}){
 const upstream=global.FloodRiskHydroSHEDSIntegrationV32;
 if(!upstream?.evaluateCity)throw Error('FORECAST_1J6G12_NOT_LOADED');
 const source=await upstream.evaluateCity(city,options);
 const horizons={};
 for(const hours of HOURS){
  const key=hours+'h', h=source?.horizons?.[key], e=h?.evidence||{};
  const spatialReady=h?.status==='HYDROSHEDS_SPATIAL_SCREENING_READY'&&finite(h?.riskScore);
  const susceptibility=spatialReady?clamp(h.riskScore):null;
  const rain=finite(e.totalRainMm)?Math.max(0,Number(e.totalRainMm)):null;
  const peak=finite(e.peakRainMmH)?Math.max(0,Number(e.peakRainMmH)):null;
  const probability=finite(e.rainProbability)?clamp(e.rainProbability):null;
  // Trigger is derived from the supplied numerical forecast, not an observed upstream catchment forecast.
  const triggerReady=rain!==null&&peak!==null&&probability!==null;
  const trigger=triggerReady?clamp(0.5*Math.min(100,rain/50*100)+0.35*Math.min(100,peak/20*100)+0.15*probability):null;
  // This is a provisional screening heuristic; it is not a validated flood probability.
  const risk=spatialReady&&triggerReady?Math.round(clamp(trigger*(0.5+susceptibility/200))):null;
  horizons[key]={horizonHours:hours,status:!spatialReady?'INSUFFICIENT_SPATIAL_DATA':!triggerReady?'INSUFFICIENT_FORECAST_DATA':'DUAL_INDICATOR_SCREENING_READY',spatialSusceptibilityScore:susceptibility,spatialSusceptibilityLevel:susceptibility===null?'UNKNOWN':level(susceptibility),forecastRainTriggerScore:trigger===null?null:Math.round(trigger),forecastFloodRiskScore:risk,forecastFloodRiskLevel:risk===null?'UNKNOWN':level(risk),evidence:{totalRainMm:rain,peakRainMmH:peak,rainProbability:probability,sourceSpatialStatus:h?.status||null,upstreamCatchmentRainfallAvailable:false},limitations:{preliminary:true,locallyCalibrated:false,confirmedFloodPrediction:false,upstreamCatchmentRainfallAvailable:false,municipalDrainageCapacityAvailable:false,note:'Zero forecast rainfall at city coordinates does not rule out runoff arriving from upstream catchments.'}};
 }
 const ready=Object.values(horizons).every(h=>h.status==='DUAL_INDICATOR_SCREENING_READY');
 const result={engine:'FloodRiskDualIndicatorV32',version:VERSION,status:ready?'DUAL_INDICATOR_SCREENING_READY':'PARTIAL_OR_INSUFFICIENT_DATA',city:source?.city||city?.name||null,sourceVersion:source?.version||null,methodology:{type:'spatial_susceptibility_separate_from_forecast_rain_trigger',spatialSusceptibilitySource:'existing_hydrosheds_screening_score',forecastTriggerWeights:{rainfallTotal:0.5,peakRainfall:0.35,rainProbability:0.15},forecastRiskFormula:'rainTriggerScore * (0.5 + spatialSusceptibilityScore / 200)',weightsLocallyValidated:false,confirmedFloodPrediction:false,locallyCalibrated:false,upstreamCatchmentRainfallAvailable:false},horizons};
 global.RG32=global.RG32||{};global.RG32.latestDualIndicatorFloodRisk=result;
 global.dispatchEvent(new CustomEvent('rainguard:dual-indicator-flood-risk-ready',{detail:result}));
 return result;
}
const api={version:VERSION,horizons:HOURS,evaluateCity,getStatus:()=>({version:VERSION,requires1J6G12:true,confirmedFloodPrediction:false,locallyCalibrated:false})};
global.FloodRiskDualIndicatorV32=api;global.RG32=global.RG32||{};global.RG32.FloodRiskDualIndicator=api;
})(window);
