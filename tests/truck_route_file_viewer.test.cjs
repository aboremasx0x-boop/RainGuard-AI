const assert=require("node:assert/strict");
const fs=require("node:fs");
const api=require("../frontend/js/truck_route_geojson_viewer_v1.js");
const html=fs.readFileSync("frontend/truck-route-file-viewer.html","utf8");
const dashboard=fs.readFileSync("frontend/truck-journey-command-view.html","utf8");
const file={type:"FeatureCollection",reportType:"RESEARCH_ONLY_PUBLIC_DEMO_GEOMETRY",
 safeToDrive:null,alternativeRouteApproved:false,operationalWarningApproved:false,
 roadClosures:"NOT_VERIFIED",hydrology:"NOT_VERIFIED",
 features:[{type:"Feature",properties:{distanceKm:91.8,estimatedTravelMinutes:68.6,safety:"UNKNOWN"},
 geometry:{type:"LineString",coordinates:[[39.1728,21.5433],[39.4,21.48],[39.8579,21.3891]]}}]};
assert.match(html,/type="file"/);
assert.match(html,/id="routeMap"/);
assert.match(html,/truck_route_geojson_viewer_v1.js/);
assert.match(dashboard,/truck-route-file-viewer.html/);
assert.doesNotMatch(html,/HERE_ROUTING_API_KEY|RAINGUARD_ROUTE_ACCESS_TOKEN/);
const parsed=api.parse(JSON.stringify(file));
assert.equal(parsed.status,"GEOMETRY_VIEW_ONLY_SAFETY_UNVERIFIED");
assert.equal(parsed.safeToDrive,null);
const geom=api.path(parsed.coordinates);
assert.equal(geom.points.length,3);
assert.match(geom.svgPath,/^M/);
assert.throws(()=>api.parse({...file,safeToDrive:true}),/INVALID_REPORT/);
assert.throws(()=>api.parse({...file,roadClosures:"CLEAR"}),/INVALID_REPORT/);
assert.throws(()=>api.parse({...file,features:[{...file.features[0],geometry:{type:"LineString",coordinates:[[0,0],[1,1]]}}]}),/OUTSIDE_SAUDI_TEST_BOUNDS/);
assert.throws(()=>api.parse({...file,features:[{...file.features[0],geometry:{type:"LineString",coordinates:[[39.2,21.4]]}}]}),/INVALID_GEOMETRY/);
console.log("PASS offline route-file viewer: real geometry only, no safety claim");
