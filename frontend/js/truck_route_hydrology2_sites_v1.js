/* Hydrology-2: locally imported, unverified HydroRIVERS review sites overlay.
 * No network calls, route requests, flood safety clearance or alerts.
 */
(function(root,factory){
 "use strict";
 const api=factory();
 if(typeof module==="object"&&module.exports)module.exports=api;
 if(root)root.RainGuardHydrology2=api;
})(typeof window!=="undefined"?window:null,function(){
 "use strict";
 const NS="http://www.w3.org/2000/svg";
 function validCoordinate(p){
   return Array.isArray(p)&&p.length===2&&p.every(v=>typeof v==="number"&&Number.isFinite(v))&&
     p[0]>=38&&p[0]<=40.5&&p[1]>=20&&p[1]<=22.5;
 }
 function parseSites(data,route){
   if(typeof data==="string")data=JSON.parse(data);
   if(!route||!Array.isArray(route.coordinates)||route.coordinates.length<2)throw Error("ROUTE_REQUIRED");
   if(!data||data.type!=="FeatureCollection"||
      data.reportType!=="RAINGUARD_HYDROLOGY2_REVIEW_SITES_ONLY"||
      data.status!=="RESEARCH_REVIEW_LOCATIONS_NOT_VERIFIED"||
      data.safeToDrive!==null||data.alternativeRouteApproved!==false||
      data.operationalWarningApproved!==false||
      data.officialRoadCrossingConfirmed!==false||
      data.hydrologicFloodRisk!=="NOT_EVALUATED"||
      data.coverage!=="ONE_RESEARCH_TILE_ONLY_NOT_COMPLETE"||
      data.tile!=="N20_E038.geojson")throw Error("INVALID_HYDROLOGY_REVIEW");
   if(data.routePointCount!==route.coordinates.length||
      !validCoordinate(data.routeStart)||!validCoordinate(data.routeEnd))throw Error("MISMATCHED_ROUTE");
   for(const [expected,actual] of [[data.routeStart,route.coordinates[0]],
     [data.routeEnd,route.coordinates[route.coordinates.length-1]]]){
     if(Math.max(Math.abs(expected[0]-actual[0]),Math.abs(expected[1]-actual[1]))>0.000002)
       throw Error("MISMATCHED_ROUTE");
   }
   const features=data.features;
   if(!Array.isArray(features)||features.length>300||
      !Number.isInteger(data.reviewSiteCount)||features.length!==data.reviewSiteCount)
     throw Error("INVALID_SITE_COUNT");
   const ids=new Set();
   return features.map((f,i)=>{
     const p=f?.properties,point=f?.geometry?.coordinates;
     if(f?.type!=="Feature"||f?.geometry?.type!=="Point"||!validCoordinate(point)||
       !p||typeof p.siteId!=="string"||!/^(RG-HYDRO-REVIEW-)[0-9]{3}$/.test(p.siteId)||
       ids.has(p.siteId)||!Number.isInteger(p.routeSegmentIndex)||
       p.routeSegmentIndex<0||p.routeSegmentIndex>=route.coordinates.length-1||
       typeof p.routeSegmentFraction!=="number"||!Number.isFinite(p.routeSegmentFraction)||
       p.routeSegmentFraction<0||p.routeSegmentFraction>1||
       p.verification!=="NOT_FIELD_VERIFIED"||p.crossingStatus!=="NOT_CONFIRMED"||
       p.culvertStatus!=="UNKNOWN"||p.bridgeStatus!=="UNKNOWN"||
       p.floodRisk!=="NOT_EVALUATED"||
       !Array.isArray(p.riverIds)||p.riverIds.length<1||
       !p.riverIds.every(n=>Number.isSafeInteger(n)&&n>0)||
       typeof p.nearestRiverDistanceMeters!=="number"||!Number.isFinite(p.nearestRiverDistanceMeters)||
       p.nearestRiverDistanceMeters<0||p.nearestRiverDistanceMeters>500)
       throw Error("INVALID_SITE");
     const a=route.coordinates[p.routeSegmentIndex],
           b=route.coordinates[p.routeSegmentIndex+1],
           t=p.routeSegmentFraction;
     const expected=[a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])];
     if(Math.max(Math.abs(point[0]-expected[0]),Math.abs(point[1]-expected[1]))>0.000003)
       throw Error("SITE_NOT_ON_LOADED_ROUTE");
     ids.add(p.siteId);
     return {siteId:p.siteId,point,routeSegmentIndex:p.routeSegmentIndex,
       fraction:t,riverIds:p.riverIds,approximateMeters:p.nearestRiverDistanceMeters};
   });
 }
 function init(doc){
   const input=doc?.getElementById("hydrologySitesFile"),
         status=doc?.getElementById("hydrologySitesStatus"),
         items=doc?.getElementById("hydrologySitesList"),
         map=doc?.getElementById("routeMap");
   if(!input||!status||!items||!map)return false;
   let route=null,sites=[],generation=0;
   const svg=(name,attrs={})=>{
     const el=doc.createElementNS(NS,name);
     Object.entries(attrs).forEach(([k,v])=>el.setAttribute(k,String(v)));
     return el;
   };
   function clear(){
     map.querySelectorAll(".hydrology2-site").forEach(node=>node.remove());
     sites=[];items.replaceChildren();
   }
   function draw(){
     map.querySelectorAll(".hydrology2-site").forEach(node=>node.remove());
     if(!route||!sites.length)return;
     const plot=window.RainGuardRouteFileViewer.path(route.coordinates);
     sites.forEach((site,i)=>{
       const a=plot.points[site.routeSegmentIndex],
             b=plot.points[site.routeSegmentIndex+1];
       const x=a[0]+site.fraction*(b[0]-a[0]),
             y=a[1]+site.fraction*(b[1]-a[1]);
       const mark=svg("g",{"class":"hydrology2-site"});
       const circle=svg("circle",{cx:x,cy:y,r:7,fill:"#f7a8ec",stroke:"#401347","stroke-width":2});
       const title=svg("title");
       title.textContent=site.siteId+" — مرشح مراجعة غير محقق";
       mark.append(circle,title);map.append(mark);
       const li=doc.createElement("li");
       li.textContent=site.siteId+" — "+site.point[1].toFixed(5)+", "+site.point[0].toFixed(5)+
         " | قرب هندسي ~"+site.approximateMeters+" م | معرّفات الأودية "+
         site.riverIds.join("، ")+" | تقاطع غير مؤكد";
       items.append(li);
     });
   }
   function setRoute(next){
     generation++;
     route=next&&Array.isArray(next.coordinates)?next:null;
     clear();
     input.value="";
     input.disabled=!route;
     status.textContent=route?
       "اختر ملف hydrology2 GeoJSON الذي تم إنشاؤه لمسار الطريق الحالي.":
       "حمّل ملف مسار Valhalla أولًا. لا يوجد تقاطع مؤكد.";
   }
   input.addEventListener("change",async()=>{
     const id=++generation;
     clear();
     const file=input.files?.[0];
     if(!route||!file){status.textContent="لم يتم اختيار ملف صحيح.";return;}
     if(file.size>1000000){status.textContent="الملف أكبر من الحد المسموح.";return;}
     try{
       const parsed=parseSites(await file.text(),route);
       if(generation!==id)return;
       sites=parsed;draw();
       status.textContent="عُرض "+sites.length+
         " موقع مراجعة هندسية من ملف محلي؛ ليست تقاطعات أو مخاطر سيول مثبتة.";
     }catch(_err){
       if(generation!==id)return;
       clear();status.textContent="ملف مواقع غير صالح أو لا يطابق مسار الطريق الحالي؛ لم تُعرض أي نقاط.";
     }
   });
   setRoute(null);
   return {setRoute};
 }
 if(typeof document!=="undefined"){
   const start=()=>{
     const ui=init(document);
     if(ui)window.RainGuardHydrology2UI=ui;
   };
   if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});
   else start();
 }
 return {parseSites,init};
});
