/* City-level weather visibility ONLY; not an ETA-aligned road-segment hazard. */
(function(root,factory){
  "use strict";
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  if(root)root.RainGuardTruckLiveData=api;
})(typeof window!=="undefined"?window:null,function(){
  "use strict";
  const API_BASE="https://rainguard-ai.onrender.com";
  const CITY_LIST=Object.freeze([
    Object.freeze({id:"jeddah",name:"جدة",lat:21.5433,lon:39.1728}),
    Object.freeze({id:"makkah",name:"مكة المكرمة",lat:21.3891,lon:39.8579}),
    Object.freeze({id:"riyadh",name:"الرياض",lat:24.7136,lon:46.6753}),
    Object.freeze({id:"dammam",name:"الدمام",lat:26.4207,lon:50.0888})
  ]);
  function city(id){return CITY_LIST.find(x=>x.id===id)||null;}
  function validNumber(value,min,max){
    if(value===null||value===undefined||value===""||typeof value==="boolean")return null;
    const n=Number(value);
    return Number.isFinite(n)&&n>=min&&n<=max?n:null;
  }
  function normalizeWeather(payload,nowMs=Date.now()){
    const base={status:"UNAVAILABLE",retrievedAt:null,rows:[],source:"WeatherAPI.com",warning:"التوقعات غير متاحة؛ لا يعني ذلك عدم هطول الأمطار."};
    if(!payload||payload.success!==true||payload.source!=="weatherapi"||
       !Array.isArray(payload.forecastHours))return base;
    const retrieved=Date.parse(payload.retrievedAt);
    if(!Number.isFinite(retrieved)||retrieved>nowMs+60000||nowMs-retrieved>30*60000){
      return {...base,status:"STALE_OR_INVALID_SOURCE_TIMESTAMP"};
    }
    const raw=payload.forecastHours.map(x=>{
      if(!x||typeof x!=="object")return null;
      const stamp=validNumber(x.time_epoch,0,4102444800);
      const prob=validNumber(x.chance_of_rain,0,100);
      const mm=validNumber(x.precip_mm,0,1000);
      if(stamp===null||prob===null||mm===null)return null;
      return {timeUtc:new Date(stamp*1000).toISOString(),epoch:stamp,
              probabilityPct:prob,rainMm:mm};
    }).filter(Boolean).filter(x=>x.epoch*1000>=nowMs-30*60000)
      .sort((a,b)=>a.epoch-b.epoch);
    const unique=raw.filter((x,i)=>i===0||x.epoch!==raw[i-1].epoch).slice(0,6);
    if(!unique.length)return {...base,status:"NO_VALID_UPCOMING_HOURS"};
    return {status:"CITY_FORECAST_AVAILABLE",retrievedAt:new Date(retrieved).toISOString(),
            source:"WeatherAPI.com",rows:unique,
            warning:"توقعات على مستوى المدينة فقط؛ ليست توقعات لمقاطع طريق أو دليلًا على سلامة المرور."};
  }
  function normalizeCapabilities(data){
    if(!data||data.status!=="CAPABILITIES_ONLY_NOT_A_SAFETY_CHECK")return null;
    return {
      weatherConfigured:data.weatherAPI?.configured===true,
      hereServerConfigured:data.truckRouting?.hereServerConfigured===true,
      valhallaServerConfigured:data.truckRouting?.valhallaServerConfigured===true,
      publicRoutingAvailable:false,
      ncmOfficialConnected:false,
      officialClosuresConnected:false,
      safeToDrive:null
    };
  }
  async function fetchCityForecast(cityId,fetcher,nowMs=Date.now()){
    const c=city(cityId);
    if(!c)return {status:"INVALID_CITY",rows:[],retrievedAt:null};
    if(typeof fetcher!=="function")return {status:"FETCH_NOT_AVAILABLE",rows:[],retrievedAt:null};
    const url=API_BASE+"/api/weather/weatherapi?lat="+encodeURIComponent(c.lat)+"&lon="+encodeURIComponent(c.lon);
    try{
      const response=await fetcher(url,{method:"GET",headers:{"Accept":"application/json"}});
      if(!response||!response.ok)return {status:"WEATHER_SERVICE_UNAVAILABLE",rows:[],retrievedAt:null};
      return normalizeWeather(await response.json(),nowMs);
    }catch(_err){return {status:"WEATHER_SERVICE_UNAVAILABLE",rows:[],retrievedAt:null};}
  }
  async function fetchCapabilities(fetcher){
    try{
      const r=await fetcher(API_BASE+"/api/truck-routes/capabilities",
                            {method:"GET",headers:{"Accept":"application/json"}});
      if(!r||!r.ok)return null;
      return normalizeCapabilities(await r.json());
    }catch(_err){return null;}
  }
  function init(doc,fetcher){
    if(!doc)return false;
    const picker=doc.getElementById("liveWeatherCity");
    const status=doc.getElementById("liveWeatherStatus");
    const rows=doc.getElementById("liveWeatherRows");
    const capabilities=doc.getElementById("liveRouteCapabilities");
    if(!picker||!status||!rows||!capabilities)return false;
    const make=(tag,value)=>{
      const e=doc.createElement(tag);
      e.textContent=value;
      return e;
    };
    CITY_LIST.forEach(c=>{
      const item=make("option",c.name);
      item.value=c.id;
      picker.append(item);
    });
    let requestCount=0;
    async function refresh(){
      const serial=++requestCount;
      status.textContent="جار فحص المصدر الجوي لمدينة "+(city(picker.value)?.name||"غير معروفة")+"…";
      rows.replaceChildren();
      const forecast=await fetchCityForecast(picker.value,fetcher);
      if(serial!==requestCount)return;
      if(forecast.status!=="CITY_FORECAST_AVAILABLE"){
        status.textContent="لم تتوفر توقعات ساعية حالية موثقة التوقيت من المصدر. لا يمكن استنتاج أن الجو جاف.";
        return;
      }
      status.textContent="WeatherAPI.com — توقعات مدينة "+city(picker.value).name+
        "؛ جُلبت البيانات: "+forecast.retrievedAt+" (UTC). ليست مخاطر طريق.";
      forecast.rows.forEach(item=>{
        const row=make("li","");
        row.append(
          make("strong",new Date(item.timeUtc).toLocaleString("ar-SA",{timeZone:"Asia/Riyadh",hour:"2-digit",minute:"2-digit",day:"numeric",month:"short"})),
          make("span"," — فرصة المطر "+item.probabilityPct+"%؛ الكمية "+item.rainMm+" ملم")
        );
        rows.append(row);
      });
    }
    picker.value="jeddah";
    picker.addEventListener("change",refresh);
    capabilities.textContent="حالة الربط قيد الفحص؛ لا توجد خدمة توجيه عامة للشاحنات.";
    fetchCapabilities(fetcher).then(x=>{
      if(!x){
        capabilities.textContent="تعذر التحقق من إعدادات الخادم. المسارات الحقيقية والتنبيهات الرسمية غير مؤكدة وغير متاحة في هذه الصفحة.";
      }else{
        capabilities.textContent="WeatherAPI: "+(x.weatherConfigured?"مهيأ على الخادم":"غير مهيأ")+
          " | HERE: "+(x.hereServerConfigured?"مهيأ للخادم المحمي":"غير مهيأ")+
          " | Valhalla: "+(x.valhallaServerConfigured?"مهيأ للخادم المحمي":"غير مهيأ")+
          " | حساب الطريق من المتصفح: غير متاح | الإغلاقات والأرصاد الرسمية: غير متصلة";
      }
    });
    refresh();
    return true;
  }
  if(typeof document!=="undefined"){
    const start=()=>init(document,typeof fetch==="function"?fetch.bind(globalThis):null);
    if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});
    else start();
  }
  return {CITY_LIST,city,normalizeWeather,normalizeCapabilities,fetchCityForecast,fetchCapabilities,init};
});
