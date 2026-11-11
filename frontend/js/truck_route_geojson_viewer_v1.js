/* Local-file-only, no fetch, tiles, navigation, or route calculation. */
(function(root,factory){
"use strict";
const api=factory();
if(typeof module==="object"&&module.exports)module.exports=api;
if(root)root.RainGuardRouteFileViewer=api;
})(typeof window!=="undefined"?window:null,function(){
"use strict";
const NS="http://www.w3.org/2000/svg";
const MAX_BYTES=1000000,MAX_POINTS=60000;
function parse(input){
 let data=typeof input==="string"?JSON.parse(input):input;
 if(!data||data.type!=="FeatureCollection"||
    data.reportType!=="RESEARCH_ONLY_PUBLIC_DEMO_GEOMETRY"||
    data.safeToDrive!==null||data.alternativeRouteApproved!==false||
    data.operationalWarningApproved!==false||
    data.roadClosures!=="NOT_VERIFIED"||data.hydrology!=="NOT_VERIFIED"||
    !Array.isArray(data.features)||data.features.length!==1)throw Error("INVALID_REPORT");
 const feat=data.features[0],geo=feat?.geometry,props=feat?.properties;
 if(geo?.type!=="LineString"||!Array.isArray(geo.coordinates)||
    geo.coordinates.length<2||geo.coordinates.length>MAX_POINTS)throw Error("INVALID_GEOMETRY");
 if(!props||props.safety!=="UNKNOWN"||
    typeof props.distanceKm!=="number"||!Number.isFinite(props.distanceKm)||props.distanceKm<=0||
    typeof props.estimatedTravelMinutes!=="number"||!Number.isFinite(props.estimatedTravelMinutes)||props.estimatedTravelMinutes<=0)
    throw Error("INVALID_TOTALS");
 const coordinates=geo.coordinates.map(p=>{
   if(!Array.isArray(p)||p.length!==2||p.some(x=>typeof x!=="number"||!Number.isFinite(x)))throw Error("INVALID_POINT");
   const [lon,lat]=p;
   if(lon<34||lon>56||lat<16||lat>33)throw Error("OUTSIDE_SAUDI_TEST_BOUNDS");
   return [lon,lat];
 });
 let timingAnchors=null;
 if(props.maneuverTimingStatus==="PROVIDER_ESTIMATED_ANCHORS"){
   const a=props.maneuverTimeAnchors;
   if(!Array.isArray(a)||a.length!==3)throw Error("INVALID_TIME_ANCHORS");
   const expected=[0,null,coordinates.length-1];
   const values=a.map((x,i)=>{
     if(!x||x.sampleId!==i+1||x.source!=="VALHALLA_MANEUVER_BOUNDARY_ESTIMATE"||
       x.timeVerifiedAgainstObservations!==false||x.arrivalTimeUtc!==null||
       !Number.isInteger(x.pointIndex)||x.pointIndex<0||x.pointIndex>=coordinates.length||
       typeof x.elapsedSeconds!=="number"||!Number.isFinite(x.elapsedSeconds)||
       x.elapsedSeconds<0||x.elapsedSeconds>props.estimatedTravelMinutes*60+60||
       (x.alongRouteFraction!==undefined&&
        (typeof x.alongRouteFraction!=="number"||!Number.isFinite(x.alongRouteFraction)||
         x.alongRouteFraction<0||x.alongRouteFraction>1))||
       (x.checkpointKind!==undefined&&
         x.checkpointKind!==["START","TIMED_MANEUVER_BOUNDARY","END"][i]))
       throw Error("INVALID_TIME_ANCHORS");
     if(expected[i]!==null&&x.pointIndex!==expected[i])throw Error("INVALID_TIME_ANCHORS");
     return {sampleId:x.sampleId,pointIndex:x.pointIndex,elapsedSeconds:x.elapsedSeconds,
       source:x.source,timeVerifiedAgainstObservations:false,
       alongRouteFraction:typeof x.alongRouteFraction==="number"?x.alongRouteFraction:null,
       checkpointKind:x.checkpointKind||null};
   });
   if(values[0].elapsedSeconds!==0||!(values[0].pointIndex<values[1].pointIndex&&
       values[1].pointIndex<values[2].pointIndex&&
       values[0].elapsedSeconds<values[1].elapsedSeconds&&
       values[1].elapsedSeconds<values[2].elapsedSeconds)||
       Math.abs(values[2].elapsedSeconds-props.estimatedTravelMinutes*60)>Math.max(60,props.estimatedTravelMinutes*3))
       throw Error("INVALID_TIME_ANCHORS");
   timingAnchors=values;
 }
 return {coordinates,distanceKm:props.distanceKm,minutes:props.estimatedTravelMinutes,
         timingAnchors,
         status:"GEOMETRY_VIEW_ONLY_SAFETY_UNVERIFIED",safeToDrive:null};
}
function path(coords){
 const xs=coords.map(c=>c[0]),ys=coords.map(c=>c[1]);
 const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
 const dx=Math.max(maxX-minX,0.001),dy=Math.max(maxY-minY,0.001);
 // Equirectangular longitude correction; schematic, not surveyed map.
 const latMean=(minY+maxY)/2*Math.PI/180,scaledDx=dx*Math.cos(latMean);
 const scale=Math.min(880/Math.max(scaledDx,0.00001),330/dy);
 const centerX=(minX+maxX)/2,centerY=(minY+maxY)/2;
 const point=c=>[500+(c[0]-centerX)*Math.cos(latMean)*scale,
                 225-(c[1]-centerY)*scale].map(v=>Math.round(v*100)/100);
 return {points:coords.map(point),svgPath:coords.map((c,i)=>{
   const [x,y]=point(c);return (i?"L":"M")+x+" "+y;
 }).join(" ")};
}
function init(doc){
 const input=doc?.getElementById("routeFile"),status=doc?.getElementById("fileStatus"),
       map=doc?.getElementById("routeMap"),distance=doc?.getElementById("routeDistance"),
       duration=doc?.getElementById("routeDuration");
 if(!input||!status||!map||!distance||!duration)return false;
 const svg=(name,attributes={})=>{
   const el=doc.createElementNS(NS,name);
   Object.entries(attributes).forEach(([key,value])=>el.setAttribute(key,String(value)));
   return el;
 };
 function reset(reason){
   map.replaceChildren();map.setAttribute("aria-label","لا توجد بيانات مسار صالحة");
   distance.textContent="غير متاح";duration.textContent="غير متاح";
   status.textContent=reason;
   if(typeof window!=="undefined"&&window.RainGuardRouteWeatherSamplerUI)window.RainGuardRouteWeatherSamplerUI.setRoute(null);
   if(typeof window!=="undefined"&&window.RainGuardHydrology2UI)window.RainGuardHydrology2UI.setRoute(null);
 }
 function show(report){
   const route=path(report.coordinates);
   const p=svg("path",{d:route.svgPath,class:"route"});
   const points=[route.points[0],route.points[route.points.length-1]];
   const markers=points.map(([x,y],i)=>{
     const circle=svg("circle",{cx:x,cy:y,r:9});
     circle.append(svg("title"));circle.lastChild.textContent=i===0?"نقطة الانطلاق":"نقطة الوصول";
     return circle;
   });
   map.replaceChildren(p,...markers);
   map.setAttribute("aria-label","مسار تقريبي بإحداثيات من ملف Valhalla التجريبي، غير معتمد للقيادة");
   distance.textContent=report.distanceKm.toFixed(1)+" كم";
   duration.textContent=report.minutes.toFixed(1)+" دقيقة";
   status.textContent="تم تحميل ورسم هندسة المسار من ملفك المحلي. حالة سلامة الطريق غير معروفة.";
   if(typeof window!=="undefined"&&window.RainGuardRouteWeatherSamplerUI)window.RainGuardRouteWeatherSamplerUI.setRoute(report);
   if(typeof window!=="undefined"&&window.RainGuardHydrology2UI)window.RainGuardHydrology2UI.setRoute(report);
 }
 input.addEventListener("change",async()=>{
   reset("جار التحقق من الملف المحلي...");
   const file=input.files?.[0];
   if(!file){reset("لم يتم اختيار ملف");return;}
   if(file.size>MAX_BYTES){reset("الملف أكبر من الحد المسموح (1 ميجابايت)");return;}
   try{show(parse(await file.text()));}
   catch(_err){reset("ملف غير صالح أو لا يحتوي على هندسة مسار معتمدة للعرض. لم يُرسم أي خط.");}
 });
 reset("اختر ملف GeoJSON الذي تم تصديره محليًا لعرضه.");
 return true;
}
if(typeof document!=="undefined"){
 const start=()=>init(document);
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});
 else start();
}
return {parse,path,init};
});
