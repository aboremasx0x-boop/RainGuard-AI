/* RainGuard AI V32 — FORECAST-1J6B spatial tile loader */
(function(){
"use strict";
const VERSION="FORECAST-1J6B.0";
const BASE="data/hydrology/";
function key(lat,lon){
 const y=Math.floor(Number(lat)/2)*2, x=Math.floor(Number(lon)/2)*2;
 return `N${String(y).padStart(2,"0")}_E${String(x).padStart(3,"0")}`;
}
async function loadForCity(city){
 const lat=Number(city.lat??city.latitude), lon=Number(city.lon??city.lng??city.longitude);
 if(!Number.isFinite(lat)||!Number.isFinite(lon)) throw new Error("INVALID_CITY_COORDINATES");
 const m=await fetch(BASE+"saudi_hydrorivers_manifest.json",{cache:"no-store"}).then(r=>{
   if(!r.ok) throw new Error("HYDRORIVERS_MANIFEST_HTTP_"+r.status); return r.json();
 });
 const k=key(lat,lon), meta=m.tiles?.[k];
 if(!meta) return {version:VERSION,status:"NO_TILE_FOR_LOCATION",available:false,tile:k};
 const r=await fetch(BASE+meta.file,{cache:"no-store"});
 if(!r.ok) throw new Error("HYDRORIVERS_TILE_HTTP_"+r.status);
 const geojson=await r.json();
 return {version:VERSION,status:"REAL_WADI_TILE_READY",available:true,tile:k,featureCount:geojson.features?.length||0,geojson};
}
async function evaluateCity(city){
 const loaded=await loadForCity(city);
 if(!loaded.available) return loaded;
 const a=window.WadiProximityAdapterV32;
 if(!a?.collect) throw new Error("WADI_PROXIMITY_ADAPTER_NOT_LOADED");
 const proximity=await a.collect(city,{geojson:loaded.geojson});
 return {...loaded,geojson:undefined,proximity,status:proximity?.available?"REAL_WADI_PROXIMITY_READY":"REAL_WADI_PROXIMITY_UNAVAILABLE"};
}
const api={version:VERSION,key,loadForCity,evaluateCity};
window.HydroRiversTileLoaderV32=api;
window.RG32=window.RG32||{};
window.RG32.HydroRiversTileLoader=api;
console.log("HydroRiversTileLoaderV32",VERSION,"ready.");
})();