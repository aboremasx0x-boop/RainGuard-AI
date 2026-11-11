const assert=require("node:assert/strict");
const fs=require("node:fs");
const api=require("../frontend/js/truck_live_data_v1.js");
const html=fs.readFileSync("frontend/truck-journey-command-view.html","utf8");
const main=fs.readFileSync("main.py","utf8");
const now=Date.parse("2026-11-11T11:00:00Z");
const payload={success:true,source:"weatherapi",retrievedAt:"2026-11-11T10:50:00Z",
  forecastHours:[
    {time_epoch:Math.floor(Date.parse("2026-11-11T11:00:00Z")/1000),chance_of_rain:71,precip_mm:1.2},
    {time_epoch:Math.floor(Date.parse("2026-11-11T12:00:00Z")/1000),chance_of_rain:24,precip_mm:0}
  ]};
assert.match(html,/id="liveWeatherCity"/);
assert.match(html,/id="liveWeatherStatus"/);
assert.match(html,/id="liveWeatherRows"/);
assert.match(html,/id="liveRouteCapabilities"/);
assert.match(html,/truck_live_data_v1.js/);
assert.match(main,/\/api\/truck-routes\/capabilities/);
assert.doesNotMatch(html,/HERE_ROUTING_API_KEY|WEATHERAPI_API_KEY|RAINGUARD_ROUTE_ACCESS_TOKEN/);
const valid=api.normalizeWeather(payload,now);
assert.equal(valid.status,"CITY_FORECAST_AVAILABLE");
assert.equal(valid.rows.length,2);
assert.equal(valid.rows[0].probabilityPct,71);
assert.equal(valid.rows[1].rainMm,0);
assert.equal(api.normalizeWeather({...payload,retrievedAt:"2026-11-11T09:00:00Z"},now).status,
             "STALE_OR_INVALID_SOURCE_TIMESTAMP");
assert.equal(api.normalizeWeather({...payload,forecastHours:[{time_epoch:payload.forecastHours[0].time_epoch,chance_of_rain:null,precip_mm:0}]},now).status,
             "NO_VALID_UPCOMING_HOURS");
assert.equal(api.normalizeWeather({...payload,forecastHours:[]},now).status,
             "NO_VALID_UPCOMING_HOURS");
assert.equal(api.normalizeWeather({...payload,success:false},now).status,"UNAVAILABLE");
assert.equal(api.city("invalid"),null);
assert.equal(api.normalizeCapabilities({status:"wrong"}),null);
const cap=api.normalizeCapabilities({status:"CAPABILITIES_ONLY_NOT_A_SAFETY_CHECK",
   weatherAPI:{configured:true},truckRouting:{hereServerConfigured:true,valhallaServerConfigured:false}});
assert.equal(cap.weatherConfigured,true);
assert.equal(cap.publicRoutingAvailable,false);
assert.equal(cap.safeToDrive,null);
(async()=>{
 let hit=null;
 const response=await api.fetchCityForecast("jeddah",async(url)=>{hit=url;return {ok:true,json:async()=>payload}},now);
 assert.equal(response.status,"CITY_FORECAST_AVAILABLE");
 assert.match(hit,/\/api\/weather\/weatherapi\?lat=21\.5433&lon=39\.1728/);
 assert.equal((await api.fetchCityForecast("invalid",async()=>{throw Error("should not call")},now)).status,"INVALID_CITY");
 assert.equal((await api.fetchCityForecast("jeddah",async()=>{throw Error("outage")},now)).status,
              "WEATHER_SERVICE_UNAVAILABLE");
 console.log("PASS: trusted city weather response, freshness, no missing-as-zero, no routes/safety claims");
})().catch(e=>{console.error(e);process.exitCode=1});
