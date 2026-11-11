/* Optional WeatherAPI.com forecast adapter.
 * All requests go through the RainGuard backend: the browser never receives
 * the provider API key. Missing values are not converted to dry forecasts.
 */
(function(global) {
"use strict";
global.RG30 = global.RG30 || {};
const HORIZONS = [6,12,24,48,72];
const number = value => value === null || value === undefined || value === "" ? null : (Number.isFinite(Number(value)) ? Number(value) : null);
const clamp = (v, max) => Math.min(max, Math.max(0,v));
function coordinates(city) {
  const lat = number(city?.lat ?? city?.latitude);
  const lon = number(city?.lon ?? city?.lng ?? city?.longitude);
  return lat !== null && lon !== null && Math.abs(lat)<=90 && Math.abs(lon)<=180 ? {lat,lon} : null;
}
function unavailable(code, city) {
  return {ok:false,available:false,status:"UNAVAILABLE",source:"weatherapi",error:code,city:city?.name??city?.city??null};
}
function aggregate(rows, hours) {
  const subset=rows.slice(0,hours);
  // No fabricated zero when precipitation or probability is missing.
  const complete=subset.length===hours && subset.every(r=>number(r.precip_mm)!==null && number(r.chance_of_rain)!==null);
  if(!complete)return {available:false,status:"INCOMPLETE_HOURLY_DATA",expectedHours:hours,receivedHours:subset.length,
    rainProbability:null,totalRainMm:null,peakRainMmH:null,peakTime:null};
  const amounts=subset.map(r=>Math.max(0,number(r.precip_mm)));
  const probabilities=subset.map(r=>clamp(number(r.chance_of_rain),100));
  const total=amounts.reduce((sum,n)=>sum+n,0);
  const peak=Math.max(...amounts);
  const idx=amounts.indexOf(peak);
  return {available:true,status:"FORECAST_READY",expectedHours:hours,receivedHours:hours,
    rainProbability:Math.round(Math.max(...probabilities)),totalRainMm:Math.round(total*10)/10,
    peakRainMmH:Math.round(peak*10)/10,peakTime:peak>0?new Date(subset[idx].time_epoch*1000).toISOString():null,
    rainStart:(()=>{const r=subset.find(x=>number(x.precip_mm)>0);return r?new Date(r.time_epoch*1000).toISOString():null})(),
    rainEnd:(()=>{const r=[...subset].reverse().find(x=>number(x.precip_mm)>0);return r?new Date(r.time_epoch*1000).toISOString():null})(),
  };
}
const adapter={
  name:"WeatherAPIAdapter",
  version:"1.0.0",
  apiBase:global.RG_BACKEND_URL || global.RAINGUARD_API_BASE || "https://rainguard-ai.onrender.com",
  isConfigured(){return !!this.apiBase;},
  async collect(city={}) {
    const coord=coordinates(city);
    if(!coord)return unavailable("INVALID_CITY_COORDINATES",city);
    const url=this.apiBase.replace(/\/$/,"")+"/api/weather/weatherapi?lat="+encodeURIComponent(coord.lat)+"&lon="+encodeURIComponent(coord.lon);
    try{
      const response=await fetch(url,{headers:{Accept:"application/json"}});
      if(!response.ok)return unavailable(response.status===503?"WEATHERAPI_API_KEY_NOT_CONFIGURED":"WEATHERAPI_BACKEND_UNAVAILABLE",city);
      const payload=await response.json();
      if(!payload.success||!Array.isArray(payload.forecastHours))return unavailable("WEATHERAPI_INVALID_PAYLOAD",city);
      const now=Math.floor(Date.now()/1000);
      // Do not use elapsed hours, and require contiguous 1-hour samples.
      const rows=payload.forecastHours
        .filter(r=>number(r?.time_epoch)!==null && number(r.time_epoch)>=now-1800)
        .sort((a,b)=>a.time_epoch-b.time_epoch);
      const unique=rows.filter((r,i)=>i===0 || number(r.time_epoch)!==number(rows[i-1].time_epoch));
      const contiguous=unique.every((r,i)=>i===0 || number(r.time_epoch)-number(unique[i-1].time_epoch)===3600);
      if(!contiguous)return unavailable("WEATHERAPI_NONCONTIGUOUS_HOURLY",city);
      const horizons={};
      HORIZONS.forEach(h=>{horizons[h+"h"]=aggregate(unique,h);});
      const available=HORIZONS.some(h=>horizons[h+"h"].available);
      if(!available)return unavailable("WEATHERAPI_INSUFFICIENT_HOURLY",city);
      return {ok:true,available:true,status:"FORECAST_READY",provider:"WeatherAPI.com",source:"weatherapi",
        city:city.name??city.city??null,lat:coord.lat,lon:coord.lon,
        fetchedAt:new Date().toISOString(),horizons,
        rainProbability:horizons["6h"].rainProbability,rainAmount:horizons["6h"].totalRainMm};
    }catch(_error){return unavailable("WEATHERAPI_FETCH_FAILED",city);}
  }
};
global.RG30.WeatherAPIAdapter=adapter;
global.WeatherAPIForecastAdapterV32=adapter;
})(window);
