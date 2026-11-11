/* RainGuard AI: research-only truck route risk prototype.
 * No live road closures, flood depths or validated hydraulic forecast.
 * Values are explicitly simulated; NO SAFE/GO recommendation is emitted.
 */
(function(root,factory) {
  "use strict";
  const api=factory();
  if(typeof module==="object" && module.exports)module.exports=api;
  if(root)root.RainGuardTruckRoutePrototype=api;
})(typeof window!=="undefined"?window:null,function(){
  "use strict";
  const MAX_AGE_MINUTES=90;
  const HORIZONS=[0,30,60,120,180];
  const TEST_SECTIONS=Object.freeze([
    Object.freeze({id:"demo-1",label:"المقطع التجريبي 1",etaMinutes:20}),
    Object.freeze({id:"demo-2",label:"المقطع التجريبي 2",etaMinutes:45}),
    Object.freeze({id:"demo-3",label:"المقطع التجريبي 3",etaMinutes:70})
  ]);
  const OBSERVATION_REASON="لا تتوفر أدلة مستقلة عن حالة الطريق أو إغلاقاته أو أخطار جريان الأودية";
  function finite(value){return typeof value==="number"&&Number.isFinite(value);}
  function parseTime(value){const n=Date.parse(value);return Number.isFinite(n)?n:null;}
  function readForecastPoint(forecasts,atMs){
    if(!Array.isArray(forecasts)||!forecasts.length)return null;
    // Never extrapolate a forecast past its valid time window.
    return forecasts.find(f=>{
      const start=parseTime(f.validFrom),end=parseTime(f.validTo);
      return start!==null&&end!==null&&start<=atMs&&atMs<end;
    })||null;
  }
  function evaluateSection(section,departureMs,forecasts,options={}){
    const eta=section.etaMinutes;
    if(!finite(eta)||eta<0||eta>1440)return {id:section.id,status:"INSUFFICIENT_DATA",reasons:["وقت الوصول إلى المقطع غير موثق"]};
    const arrivalMs=departureMs+eta*60000;
    const forecast=readForecastPoint(forecasts,arrivalMs);
    const reasons=[];
    if(!forecast)reasons.push("لا توجد توقعات تغطي وقت المرور");
    else {
      const p=forecast.precipitationProbability;
      const mm=forecast.precipitationMmPerHour;
      if(!finite(p)||p<0||p>100||!finite(mm)||mm<0)reasons.push("بيانات توقع المطر ناقصة أو غير صالحة");
      const fetched=parseTime(forecast.fetchedAt);
      if(fetched===null||fetched>departureMs+5*60000||departureMs-fetched>MAX_AGE_MINUTES*60000)
        reasons.push("تاريخ جلب بيانات المطر غير معروف أو البيانات قديمة");
    }
    if(options.roadClosureVerified!==true)reasons.push("حالة إغلاق الطريق غير متحققة رسميًا");
    if(options.terrainValidated!==true)reasons.push("تقييم جريان الأودية والتضاريس غير معتمد");
    if(options.routeGeometryVerified!==true)reasons.push("موقع مقطع الطريق غير مثبت ببيانات مسار موثوقة");
    if(reasons.length)return {
      id:section.id,label:section.label,etaMinutes:eta,
      arrivalTime:new Date(arrivalMs).toISOString(),status:"INSUFFICIENT_DATA",
      reasons,advice:"لا يمكن تحديد سلامة المقطع؛ راجع التنبيهات والإغلاقات الرسمية قبل الرحلة"
    };
    // Even fully populated inputs are NOT an authorization to travel.
    // A caution-only signal, never a "safe" outcome.
    const high=forecast.precipitationProbability>=65||forecast.precipitationMmPerHour>=10;
    return {id:section.id,label:section.label,etaMinutes:eta,
      arrivalTime:new Date(arrivalMs).toISOString(),
      status:high?"POTENTIAL_WEATHER_EXPOSURE":"REQUIRES_OFFICIAL_CONFIRMATION",
      reasons:[OBSERVATION_REASON],
      rainProbability:forecast.precipitationProbability,
      rainMmPerHour:forecast.precipitationMmPerHour,
      advice:"تقييم تجريبي فقط؛ لا يؤكد فتح الطريق أو سلامته"};
  }
  function assessRoute({departureTime,sections=TEST_SECTIONS,forecastBySection={},roadEvidence={}}={}){
    const departureMs=parseTime(departureTime);
    if(departureMs===null)throw new Error("INVALID_DEPARTURE_TIME");
    if(!Array.isArray(sections)||sections.length===0||sections.length>30)throw new Error("INVALID_SECTIONS");
    const results=sections.map(s=>evaluateSection(s,departureMs,forecastBySection[s.id],roadEvidence[s.id]||{}));
    const incomplete=results.some(s=>s.status==="INSUFFICIENT_DATA");
    return {scenario:"JEDDAH_MAKKAH_SIMULATION_ONLY",evaluationType:"NOT_A_ROAD_SAFETY_DECISION",
      departureTime:new Date(departureMs).toISOString(),
      segmentResults:results,status:incomplete?"INSUFFICIENT_DATA":"REQUIRES_OFFICIAL_CONFIRMATION",
      safeToDrive:null,alternativeRouteApproved:false,
      warning:"لا يُستخدم لاتخاذ قرار القيادة أو توجيه الشاحنات. راجع الجهات الرسمية وحالة الطريق."};
  }
  // Synthetic inputs are deliberately stale/missing official verification.
  function syntheticDemo(departureTime){
    const d=parseTime(departureTime);
    if(d===null)throw new Error("INVALID_DEPARTURE_TIME");
    const forecastBySection={};
    for(const s of TEST_SECTIONS){
      const arrive=d+s.etaMinutes*60000;
      forecastBySection[s.id]=[{
        validFrom:new Date(arrive-30*60000).toISOString(),
        validTo:new Date(arrive+30*60000).toISOString(),
        fetchedAt:new Date(d-10*60000).toISOString(),
        precipitationProbability:s.id==="demo-2"?75:20,
        precipitationMmPerHour:s.id==="demo-2"?12:1,
        isSynthetic:true
      }];
    }
    return assessRoute({departureTime,forecastBySection});
  }
  return {assessRoute,evaluateSection,syntheticDemo,TEST_SECTIONS,HORIZONS,MAX_AGE_MINUTES};
});
