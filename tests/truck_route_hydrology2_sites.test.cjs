const assert=require("node:assert/strict");
const fs=require("node:fs");
const overlay=require("../frontend/js/truck_route_hydrology2_sites_v1.js");
const base=fs.readFileSync("frontend/js/truck_route_geojson_viewer_v1.js","utf8");
const html=fs.readFileSync("frontend/truck-route-file-viewer.html","utf8");
assert.match(html,/id="hydrologySitesFile"/);
assert.match(html,/truck_route_hydrology2_sites_v1.js/);
assert.match(base,/RainGuardHydrology2UI.setRoute\(report\)/);
assert.match(base,/RainGuardHydrology2UI.setRoute\(null\)/);
const route={coordinates:[[39.1728,21.5433],[39.4,21.5],[39.8579,21.3891]]};
const frac=0.5;
const point=[(route.coordinates[1][0]+route.coordinates[2][0])/2,
             (route.coordinates[1][1]+route.coordinates[2][1])/2];
const site={
 type:"Feature",properties:{siteId:"RG-HYDRO-REVIEW-001",routeSegmentIndex:1,
 routeSegmentFraction:frac,nearestRiverDistanceMeters:2.1,riverIds:[20889309,20889348],
 verification:"NOT_FIELD_VERIFIED",crossingStatus:"NOT_CONFIRMED",
 culvertStatus:"UNKNOWN",bridgeStatus:"UNKNOWN",floodRisk:"NOT_EVALUATED"},
 geometry:{type:"Point",coordinates:point}
};
const geo={
 type:"FeatureCollection",reportType:"RAINGUARD_HYDROLOGY2_REVIEW_SITES_ONLY",
 status:"RESEARCH_REVIEW_LOCATIONS_NOT_VERIFIED",
 safeToDrive:null,alternativeRouteApproved:false,operationalWarningApproved:false,
 officialRoadCrossingConfirmed:false,hydrologicFloodRisk:"NOT_EVALUATED",
 coverage:"ONE_RESEARCH_TILE_ONLY_NOT_COMPLETE",tile:"N20_E038.geojson",
 routePointCount:route.coordinates.length,routeStart:[39.1728,21.5433],
 routeEnd:[39.8579,21.3891],reviewSiteCount:1,features:[site]
};
const result=overlay.parseSites(JSON.stringify(geo),route);
assert.equal(result.length,1);
assert.equal(result[0].approximateMeters,2.1);
assert.equal(result[0].riverIds.length,2);
assert.throws(()=>overlay.parseSites(geo,{coordinates:[[39.2,21.5],[39.4,21.5],[39.8579,21.3891]]}),/MISMATCHED_ROUTE/);
assert.throws(()=>overlay.parseSites({...geo,safeToDrive:true},route),/INVALID_HYDROLOGY_REVIEW/);
assert.throws(()=>overlay.parseSites({...geo,officialRoadCrossingConfirmed:true},route),/INVALID_HYDROLOGY_REVIEW/);
const misplaced=JSON.parse(JSON.stringify(geo));
misplaced.features[0].geometry.coordinates=[39.6,21.7];
assert.throws(()=>overlay.parseSites(misplaced,route),/SITE_NOT_ON_LOADED_ROUTE/);
const fakeVerification=JSON.parse(JSON.stringify(geo));
fakeVerification.features[0].properties.verification="VERIFIED";
assert.throws(()=>overlay.parseSites(fakeVerification,route),/INVALID_SITE/);
assert.equal(overlay.parseSites({...geo,reviewSiteCount:0,features:[]},route).length,0);
console.log("PASS Hydrology-2 local review markers, route binding and fail-closed safety");
