const assert=require("node:assert/strict");
const fs=require("node:fs");
const api=require("../frontend/js/truck_route_risk_prototype_v1.js");
const html=fs.readFileSync("frontend/truck-routes-prototype.html","utf8");
const depart="2026-11-11T07:00:00Z";
const ms=Date.parse(depart);
assert.match(html,/محاكاة فقط وليست بيانات حية/);
assert.match(html,/truck_route_risk_prototype_v1\.js/);
assert.doesNotMatch(html,/fetch\s*\(/);
const demo=api.syntheticDemo(depart);
assert.equal(demo.status,"INSUFFICIENT_DATA");
assert.equal(demo.safeToDrive,null);
assert.equal(demo.alternativeRouteApproved,false);
assert.equal(demo.segmentResults.length,3);
assert.ok(demo.segmentResults.every(x=>x.status==="INSUFFICIENT_DATA"));
assert.ok(demo.segmentResults.every(x=>x.reasons.some(r=>r.includes("إغلاق"))));
const offset=ms+60*60000;
const f=[{
 validFrom:new Date(offset-60000).toISOString(),
 validTo:new Date(offset+60000).toISOString(),
 fetchedAt:new Date(ms-10*60000).toISOString(),
 precipitationProbability:85,precipitationMmPerHour:15
}];
const section={id:"segmentA",label:"Test segment",etaMinutes:60};
const verified={roadClosureVerified:true,terrainValidated:true,routeGeometryVerified:true};
const caution=api.assessRoute({departureTime:depart,sections:[section],forecastBySection:{segmentA:f},roadEvidence:{segmentA:verified}});
assert.equal(caution.segmentResults[0].status,"POTENTIAL_WEATHER_EXPOSURE");
assert.equal(caution.safeToDrive,null);
assert.equal(caution.alternativeRouteApproved,false);
const insufficient=api.assessRoute({departureTime:depart,sections:[section],forecastBySection:{segmentA:f},roadEvidence:{}});
assert.equal(insufficient.segmentResults[0].status,"INSUFFICIENT_DATA");
const stale=api.assessRoute({departureTime:depart,sections:[section],forecastBySection:{segmentA:[{...f,fetchedAt:new Date(ms-3*3600000).toISOString()}]},roadEvidence:{segmentA:verified}});
assert.equal(stale.segmentResults[0].status,"INSUFFICIENT_DATA");
const missing=api.assessRoute({departureTime:depart,sections:[section],forecastBySection:{},roadEvidence:{segmentA:verified}});
assert.equal(missing.segmentResults[0].status,"INSUFFICIENT_DATA");
const nullRain=api.assessRoute({departureTime:depart,sections:[section],forecastBySection:{segmentA:[{...f,precipitationMmPerHour:null}]},roadEvidence:{segmentA:verified}});
assert.equal(nullRain.segmentResults[0].status,"INSUFFICIENT_DATA");
assert.throws(()=>api.assessRoute({departureTime:"nonsense"}),/INVALID_DEPARTURE_TIME/);
console.log("PASS: simulated route ETA alignment, no safe claim, upstream/road evidence gates, missing and stale input checks");
