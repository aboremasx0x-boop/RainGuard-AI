const assert=require("node:assert/strict");
const fs=require("node:fs");
const ui=require("../frontend/js/truck_route_geojson_viewer_v1.js");
const weather=require("../frontend/js/truck_route_spatial_weather_v1.js");
const html=fs.readFileSync("frontend/truck-route-file-viewer.html","utf8");
assert.match(html,/id="departureTimeLocal"/);
const coords=[[39.1728,21.5433],[39.4,21.5],[39.8579,21.3891]];
const anchors=[0,1800,4116].map((elapsedSeconds,i)=>({
 sampleId:i+1,pointIndex:i,elapsedSeconds,
 source:"VALHALLA_MANEUVER_BOUNDARY_ESTIMATE",arrivalTimeUtc:null,
 timeVerifiedAgainstObservations:false}));
const base={
 type:"FeatureCollection",reportType:"RESEARCH_ONLY_PUBLIC_DEMO_GEOMETRY",
 safeToDrive:null,alternativeRouteApproved:false,operationalWarningApproved:false,
 roadClosures:"NOT_VERIFIED",hydrology:"NOT_VERIFIED",
 features:[{type:"Feature",properties:{
  distanceKm:91.8,estimatedTravelMinutes:68.6,safety:"UNKNOWN",
  maneuverTimingStatus:"PROVIDER_ESTIMATED_ANCHORS",maneuverTimeAnchors:anchors},
  geometry:{type:"LineString",coordinates:coords}}]
};
const parsed=ui.parse(base);
assert.equal(parsed.timingAnchors.length,3);
assert.equal(weather.verifiedManeuverPoints(parsed)[1].elapsedProviderSeconds,1800);
const sparse=JSON.parse(JSON.stringify(base));
sparse.features[0].properties.maneuverTimeAnchors[1].alongRouteFraction=0.1271;
sparse.features[0].properties.maneuverTimeAnchors[1].checkpointKind="TIMED_MANEUVER_BOUNDARY";
const sparseParsed=ui.parse(sparse);
const sparsePoint=weather.verifiedManeuverPoints(sparseParsed)[1];
assert.match(sparsePoint.kind,/12\.7%/);
assert.match(sparsePoint.kind,/ليست بالضرورة منتصف الطريق/);
assert.equal(sparsePoint.elapsedProviderSeconds,1800);
const fakeFractions=JSON.parse(JSON.stringify(sparse));
fakeFractions.features[0].properties.maneuverTimeAnchors[1].alongRouteFraction=1.8;
assert.throws(()=>ui.parse(fakeFractions),/INVALID_TIME_ANCHORS/);

const invalid=JSON.parse(JSON.stringify(base));
invalid.features[0].properties.maneuverTimeAnchors[1].pointIndex=20;
assert.throws(()=>ui.parse(invalid),/INVALID_TIME_ANCHORS/);
const noTiming=JSON.parse(JSON.stringify(base));
delete noTiming.features[0].properties.maneuverTimeAnchors;
noTiming.features[0].properties.maneuverTimingStatus="NOT_AVAILABLE";
assert.equal(ui.parse(noTiming).timingAnchors,null);
const now=Date.parse("2026-11-11T12:00:00Z");
const hours=[3600,7200,10800].map((s,i)=>({
 time_epoch:Math.floor((now+s*1000)/1000),chance_of_rain:10+i,precip_mm:i}));
const payload={success:true,source:"weatherapi",retrievedAt:"2026-11-11T11:55:00Z",forecastHours:hours};
const result=weather.evaluate(payload,now);
assert.equal(result.rows.length,3);
assert.equal(weather.selectForecastHour(result.rows,now+5400*1000).probabilityPct,10);
(async()=>{
 let calls=0;
 const fetcher=async()=>{calls++;return {ok:true,json:async()=>payload};};
 const trip=await weather.inspectRoute(parsed,fetcher,now,new Date(now+3600000).toISOString());
 assert.equal(calls,3);
 assert.equal(trip.perSegmentEtaAvailable,true);
 assert.equal(trip.etaMatchedAgainstObservedTravel,false);
 assert.equal(trip.safeToDrive,null);
 assert.equal(trip.samples[0].forecastAtEstimatedArrival.probabilityPct,10);
 assert.equal(trip.samples[1].forecastAtEstimatedArrival.probabilityPct,10);
 assert.equal(trip.samples[2].forecastAtEstimatedArrival.probabilityPct,11);
 const missing=await weather.inspectRoute(ui.parse(noTiming),fetcher,now,new Date(now+3600000).toISOString());
 assert.equal(missing.perSegmentEtaAvailable,false);
 assert.equal(missing.samples[1].arrivalTimeUtc,null);
 const old=await weather.inspectRoute(parsed,fetcher,now);
 assert.equal(old.samples[1].forecastAtEstimatedArrival,null);
 console.log("PASS: provider time anchors, selected forecast hours, no invented timing, no safety approval");
})().catch(e=>{console.error(e);process.exitCode=1});
