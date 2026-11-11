const assert=require("node:assert/strict");
const fs=require("node:fs");
const api=require("../frontend/js/national_truck_geography_v1.js");
const regions=api.regions();
assert.equal(regions.length,13);
const ids=regions.map(x=>x.id);
assert.equal(new Set(ids).size,13);
const cities=regions.flatMap(r=>r.cities);
assert.ok(cities.length>=26);
assert.equal(new Set(cities.map(c=>c.id)).size,cities.length);
for(const c of cities){
 assert.equal(api.regionCities(c.regionId).some(x=>x.id===c.id),true);
 assert.equal(typeof c.name,"string");
 assert.ok(Number.isFinite(c.lat)&&Math.abs(c.lat)<=90);
 assert.ok(Number.isFinite(c.lon)&&Math.abs(c.lon)<=180);
 assert.equal(c.locationAccuracy,"APPROXIMATE_CITY_CENTER_NOT_NAVIGATIONAL");
}
for(const origin of regions)for(const destination of regions){
 const x=origin.cities[0], y=destination.cities[0];
 if(x.id===y.id)continue;
 const plan=api.plan({originId:x.id,destinationId:y.id,departureTime:"2026-11-11T10:00:00Z"});
 assert.equal(plan.routeStatus,"ROUTING_PROVIDER_NOT_CONFIGURED");
 assert.equal(plan.safeToDrive,null);
 assert.equal(plan.alternativeRouteApproved,false);
 assert.equal(plan.routeGeometry,null);
 assert.equal(plan.distanceKm,null);
 assert.equal(plan.estimatedTravelMinutes,null);
 assert.equal(plan.origin.regionId,origin.id);
 assert.equal(plan.destination.regionId,destination.id);
}
const within=api.plan({originId:"jeddah",destinationId:"makkah",departureTime:"2026-11-11T10:00:00Z",vehicle:{weightTons:25,heightMeters:4}});
assert.equal(within.vehicle.weightTons,25);
assert.throws(()=>api.plan({originId:"jeddah",destinationId:"jeddah",departureTime:"2026-11-11T10:00:00Z"}),/INVALID_CITY_PAIR/);
assert.throws(()=>api.plan({originId:"jeddah",destinationId:"riyadh",departureTime:"2026-11-11T10:00:00Z",vehicle:{heightMeters:-2}}),/INVALID_heightMeters/);
const html=fs.readFileSync("frontend/truck-routes-prototype.html","utf8");
assert.match(html,/id="fromRegion"/);
assert.match(html,/id="toRegion"/);
assert.match(html,/id="nationalMap"/);
assert.match(html,/national_truck_geography_v1/);
assert.match(html,/لا تتوفر حاليًا هندسة طرق/);
assert.doesNotMatch(html,/L\.polyline\(/);
assert.doesNotMatch(html,/safeToDrive:\s*true/);
console.log("PASS: 13 administrative regions, nationwide cross-region pairs, conservative route/vehicle inputs and no invented paths");
