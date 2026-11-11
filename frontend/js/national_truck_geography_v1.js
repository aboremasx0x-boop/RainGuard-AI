/* Nationwide geographical selection for RainGuard truck route prototype.
 * Coordinates are approximate city-center locators ONLY, not road entrances,
 * official city boundaries, verified truck routes, or road waypoints.
 * Administrative region names follow Saudi government region coding.
 */
(function(root,factory){
  "use strict";
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  if(root)root.RainGuardNationalRoutes=api;
})(typeof window!=="undefined"?window:null,function(){
  "use strict";
  const REGIONS=Object.freeze([
    {id:"riyadh",name:"منطقة الرياض",cities:[["riyadh","الرياض",24.7136,46.6753],["kharj","الخرج",24.1556,47.3346],["dawadmi","الدوادمي",24.5077,44.3924]]},
    {id:"makkah",name:"منطقة مكة المكرمة",cities:[["makkah","مكة المكرمة",21.3891,39.8579],["jeddah","جدة",21.5433,39.1728],["taif","الطائف",21.4373,40.5127]]},
    {id:"madinah",name:"منطقة المدينة المنورة",cities:[["madinah","المدينة المنورة",24.5247,39.5692],["yanbu","ينبع",24.0895,38.0637]]},
    {id:"qassim",name:"منطقة القصيم",cities:[["buraydah","بريدة",26.3592,43.9818],["unayzah","عنيزة",26.0879,43.9935]]},
    {id:"eastern",name:"المنطقة الشرقية",cities:[["dammam","الدمام",26.4207,50.0888],["khobar","الخبر",26.2172,50.1971],["jubail","الجبيل",27.0046,49.6460],["alahsa","الأحساء",25.3830,49.5860]]},
    {id:"asir",name:"منطقة عسير",cities:[["abha","أبها",18.2465,42.5117],["khamis","خميس مشيط",18.3064,42.7292],["bisha","بيشة",20.0129,42.6052]]},
    {id:"tabuk",name:"منطقة تبوك",cities:[["tabuk","تبوك",28.3838,36.5550],["duba","ضباء",27.3513,35.6901]]},
    {id:"hail",name:"منطقة حائل",cities:[["hail","حائل",27.5114,41.7208],["baqaa","بقعاء",27.8854,42.4062]]},
    {id:"northern",name:"منطقة الحدود الشمالية",cities:[["arar","عرعر",30.9753,41.0381],["rafha","رفحاء",29.6343,43.5194]]},
    {id:"jazan",name:"منطقة جازان",cities:[["jazan","جازان",16.8892,42.5611],["sabya","صبيا",17.1495,42.6250]]},
    {id:"najran",name:"منطقة نجران",cities:[["najran","نجران",17.5650,44.2289],["sharurah","شرورة",17.4729,47.1214]]},
    {id:"baha",name:"منطقة الباحة",cities:[["baha","الباحة",20.0129,41.4677],["baljurashi","بلجرشي",19.8596,41.5570]]},
    {id:"jawf",name:"منطقة الجوف",cities:[["sakaka","سكاكا",29.9697,40.2064],["qurayyat","القريات",31.3318,37.3428]]}
  ].map(r=>Object.freeze({id:r.id,name:r.name,cities:Object.freeze(r.cities.map(c=>Object.freeze({
    id:c[0],name:c[1],lat:c[2],lon:c[3],regionId:r.id,
    locationAccuracy:"APPROXIMATE_CITY_CENTER_NOT_NAVIGATIONAL"
  })))})));
  const byId=new Map(REGIONS.flatMap(r=>r.cities.map(c=>[c.id,c])));
  function getCity(cityId){return byId.get(String(cityId))||null;}
  function regions(){return REGIONS;}
  function regionCities(regionId){return REGIONS.find(r=>r.id===regionId)?.cities||[];}
  function plan({originId,destinationId,departureTime,vehicle={}}={}){
    const origin=getCity(originId),destination=getCity(destinationId);
    if(!origin||!destination||origin.id===destination.id)throw new Error("INVALID_CITY_PAIR");
    const when=new Date(departureTime);
    if(!Number.isFinite(when.getTime()))throw new Error("INVALID_DEPARTURE_TIME");
    const {weightTons,heightMeters,lengthMeters}=vehicle;
    for(const [key,value] of [["weightTons",weightTons],["heightMeters",heightMeters],["lengthMeters",lengthMeters]]){
      if(value!==undefined && (typeof value!=="number"||!Number.isFinite(value)||value<=0))throw new Error("INVALID_"+key);
    }
    return {
      scope:"SAUDI_ARABIA_13_REGIONS",routeStatus:"ROUTING_PROVIDER_NOT_CONFIGURED",
      riskStatus:"NOT_ASSESSED",safeToDrive:null,alternativeRouteApproved:false,
      origin,destination,departureTime:when.toISOString(),vehicle:structuredCloneVehicle(vehicle),
      routeGeometry:null,distanceKm:null,estimatedTravelMinutes:null,
      warning:"الموقعان تقريبيان. لا توجد بيانات شبكة طرق الشاحنات أو إغلاقاتها أو تقييم سيول معتمد؛ لا توصية بالقيادة أو طريق بديل."
    };
  }
  function structuredCloneVehicle(v){return {weightTons:v.weightTons??null,heightMeters:v.heightMeters??null,lengthMeters:v.lengthMeters??null};}
  return {regions,getCity,regionCities,plan};
});
