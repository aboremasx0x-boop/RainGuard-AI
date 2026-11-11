/* RainGuard AI: user-triggered SPATIAL sampling, never time-of-arrival road forecast.
 * Coordinates come from a locally chosen route file; 3 samples maximum.
 * Provider is existing RainGuard backend WeatherAPI city/coordinate proxy.
 */
(function(root,factory){
 "use strict";
 const api=factory();
 if(typeof module==="object"&&module.exports)module.exports=api;
 if(root)root.RainGuardSpatialWeather=api;
})(typeof window!=="undefined"?window:null,function(){
 "use strict";
 const ENDPOINT="https://rainguard-ai.onrender.com/api/weather/weatherapi";
 const MAX_SAMPLES=3;
 const MAX_RESPONSE_HOURS=120;
 function km(a,b){
   const r=Math.PI/180,dy=(b[1]-a[1])*r,dx=(b[0]-a[0])*r;
   const t=Math.sin(dy/2)**2+Math.cos(a[1]*r)*Math.cos(b[1]*r)*Math.sin(dx/2)**2;
   return 6371*2*Math.atan2(Math.sqrt(t),Math.sqrt(Math.max(0,1-t)));
 }
 function samples(coordinates){
   if(!Array.isArray(coordinates)||coordinates.length<2||coordinates.length>60000)throw Error("INVALID_ROUTE_GEOMETRY");
   for(const p of coordinates){
     if(!Array.isArray(p)||p.length!==2||p.some(x=>typeof x!=="number"||!Number.isFinite(x))||
       p[0]<34||p[0]>56||p[1]<16||p[1]>33)throw Error("INVALID_ROUTE_POINT");
   }
   let cumulative=[0];
   for(let i=1;i<coordinates.length;i++)cumulative.push(cumulative[i-1]+km(coordinates[i-1],coordinates[i]));
   const total=cumulative[cumulative.length-1];
   if(total<=0.1)throw Error("ROUTE_TOO_SHORT");
   const targets=[0,total/2,total];
   return targets.map((d,index)=>{
     let idx=1;
     while(idx<cumulative.length-1&&cumulative[idx]<d)idx++;
     const before=cumulative[idx-1],after=cumulative[idx];
     const fraction=after>before?Math.max(0,Math.min(1,(d-before)/(after-before))):0;
     const point=[0,1].map(j=>coordinates[idx-1][j]+(coordinates[idx][j]-coordinates[idx-1][j])*fraction);
     return {sampleId:index+1,kind:["الانطلاق","منتصف هندسة المسار","الوصول"][index],
       lat:Number(point[1].toFixed(5)),lon:Number(point[0].toFixed(5)),
       cumulativeGeometryKm:Number(d.toFixed(2)),
       roadGeometryIsProviderEstimate:true,arrivalTimeUtc:null,forecastValidityAtPassage:"NOT_EVALUATED"};
   });
 }
 function numeric(value,min,max){
   if(value===null||value===undefined||value===""||typeof value==="boolean")return null;
   const n=Number(value);return Number.isFinite(n)&&n>=min&&n<=max?n:null;
 }
 function evaluate(payload,nowMs=Date.now()){
   const unavailable={status:"UNAVAILABLE_OR_STALE",issuedAtUtc:null,rows:[],
     roadFloodRisk:"NOT_EVALUATED",safeToDrive:null,weatherTimeMatchedToArrival:false};
   if(!payload||payload.success!==true||payload.source!=="weatherapi"||
     !Array.isArray(payload.forecastHours)||payload.forecastHours.length>MAX_RESPONSE_HOURS)return unavailable;
   const fetched=Date.parse(payload.retrievedAt);
   if(!Number.isFinite(fetched)||fetched>nowMs+60000||nowMs-fetched>30*60000)return unavailable;
   const rows=payload.forecastHours.map(x=>{
     if(!x||typeof x!=="object")return null;
     const epoch=numeric(x.time_epoch,0,4102444800),prob=numeric(x.chance_of_rain,0,100),
           mm=numeric(x.precip_mm,0,1000);
     if(epoch===null||prob===null||mm===null)return null;
     if(epoch*1000<nowMs-30*60000||epoch*1000>nowMs+72*3600*1000)return null;
     return {timeUtc:new Date(epoch*1000).toISOString(),probabilityPct:prob,rainMm:mm};
   }).filter(Boolean).sort((a,b)=>a.timeUtc.localeCompare(b.timeUtc)).slice(0,4);
   if(!rows.length)return unavailable;
   return {status:"FORECAST_AT_ROUTE_SAMPLE_AVAILABLE",issuedAtUtc:null,
     retrievedAtUtc:new Date(fetched).toISOString(),rows,
     roadFloodRisk:"NOT_EVALUATED",safeToDrive:null,weatherTimeMatchedToArrival:false};
 }
 async function query(sample,fetcher,nowMs=Date.now()){
   if(!sample||typeof fetcher!=="function")return evaluate(null,nowMs);
   const url=ENDPOINT+"?lat="+encodeURIComponent(sample.lat)+"&lon="+encodeURIComponent(sample.lon);
   try{
     const res=await fetcher(url,{method:"GET",headers:{"Accept":"application/json"}});
     if(!res||!res.ok)return evaluate(null,nowMs);
     return evaluate(await res.json(),nowMs);
   }catch(_err){return evaluate(null,nowMs);}
 }
 async function inspectRoute(route,fetcher,nowMs=Date.now()){
   const points=samples(route.coordinates);
   // Exactly three sequential calls initiated by explicit UI action, not periodic polling.
   const output=[];
   for(const point of points){
     output.push({point,forecast:await query(point,fetcher,nowMs)});
   }
   return {type:"SPATIAL_WEATHER_SNAPSHOT_NOT_ETA_MATCHED",
     provider:"WeatherAPI.com via RainGuard API",sampleCount:MAX_SAMPLES,
     estimatedTravelMinutes:route.minutes,perSegmentEtaAvailable:false,
     officialRoadClosures:"NOT_VERIFIED",floodRisk:"NOT_EVALUATED",
     safeToDrive:null,alternativeRouteApproved:false,operationalWarningApproved:false,
     samples:output};
 }
 function init(doc,fetcher){
   const action=doc?.getElementById("sampleRouteWeather"),
         state=doc?.getElementById("sampleWeatherStatus"),
         list=doc?.getElementById("sampleWeatherResults");
   if(!action||!state||!list)return false;
   let currentRoute=null,busy=false;
   const text=(tag,value)=>{const el=doc.createElement(tag);el.textContent=value;return el;};
   function setRoute(route){
     currentRoute=route&&Array.isArray(route.coordinates)?route:null;
     action.disabled=!currentRoute;
     list.replaceChildren();
     state.textContent=currentRoute?
       "تم تحميل هندسة الطريق؛ يمكنك طلب 3 لقطات جوية مكانية (بدون مطابقة زمن المرور).":
       "اختر ملف مسار صحيحًا قبل طلب بيانات الطقس.";
   }
   action.addEventListener("click",async()=>{
     if(busy||!currentRoute||!fetcher)return;
     busy=true;action.disabled=true;list.replaceChildren();
     state.textContent="جار طلب 3 مواقع فقط من خادم توقعات RainGuard…";
     try{
       const r=await inspectRoute(currentRoute,fetcher);
       r.samples.forEach(({point,forecast})=>{
         const li=text("li",point.kind+" — "+point.lat+", "+point.lon+": ");
         const strong=text("strong",forecast.status==="FORECAST_AT_ROUTE_SAMPLE_AVAILABLE"?
           "توقعات مكانية متاحة، دون وقت مرور موثق":"المصدر غير متاح أو بياناته غير صالحة");
         li.append(strong);
         if(forecast.rows.length){
           const items=text("ul","");
           forecast.rows.forEach(w=>{
             items.append(text("li",new Date(w.timeUtc).toLocaleString("ar-SA",{timeZone:"Asia/Riyadh",
               day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})+
               " | احتمال المطر "+w.probabilityPct+"% | كمية "+w.rainMm+" ملم"));
           });
           li.append(items);
         }
         list.append(li);
       });
       state.textContent="اكتمل فحص 3 نقاط على هندسة الطريق. هذه توقعات مكانية، وليست تقييمًا للمطر وقت مرور الشاحنة أو تحذير سيول.";
     }catch(_err){
       state.textContent="لم يكتمل الفحص؛ لا يجوز افتراض عدم وجود أمطار أو سلامة الطريق.";
     }finally{busy=false;action.disabled=!currentRoute;}
   });
   setRoute(null);
   return {setRoute};
 }
 if(typeof document!=="undefined"){
   const start=()=>{
     const state=init(document,typeof fetch==="function"?fetch.bind(window):null);
     if(state)window.RainGuardRouteWeatherSamplerUI=state;
   };
   if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});
   else start();
 }
 return {samples,evaluate,query,inspectRoute,init};
});
