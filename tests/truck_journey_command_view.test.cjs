const assert=require("node:assert/strict");
const fs=require("node:fs");
const preview=require("../frontend/js/truck_journey_command_view_v1.js");
const html=fs.readFileSync("frontend/truck-journey-command-view.html","utf8");
const dashboard=fs.readFileSync("frontend/national-ai-os-v30.html","utf8");
const trucks=fs.readFileSync("frontend/truck-routes-prototype.html","utf8");
assert.match(html,/lang="ar" dir="rtl"/);
assert.match(html,/role="alert"/);
assert.match(html,/id="scenario"/);
assert.match(html,/id="segmentList"/);
assert.match(html,/truck_journey_command_view_v1.js/);
assert.match(dashboard,/id="openTruckJourneyReport"/);
assert.match(trucks,/id="openTruckJourneyCommandView"/);
assert.doesNotMatch(html,/RAINGUARD_ROUTE_ACCESS_TOKEN|HERE_ROUTING_API_KEY|WEATHERAPI_API_KEY/);
for(const option of ["missing","rain"]){
 const result=preview.build(option);
 assert.equal(result.type,"SYNTHETIC_RESEARCH_PREVIEW");
 assert.equal(result.safeToDrive,null);
 assert.equal(result.alternativeRouteApproved,false);
 assert.equal(result.officialFeedsConnected,false);
 assert.equal(result.operationalWarningApproved,false);
 assert.equal(result.segments.length,3);
 for(const segment of result.segments){
  assert.equal(segment.synthetic,true);
  assert.equal(segment.safeToDrive,null);
  assert.equal(segment.alternativeRouteApproved,false);
  assert.equal(segment.roadClosureStatus,"UNKNOWN");
  assert.ok(segment.missingRequirements.length>=4);
 }
}
assert.equal(preview.build("missing").segments.filter(x=>x.rainProbabilityPct!==null).length,0);
assert.equal(preview.build("rain").segments.filter(x=>x.weatherExposureStatus==="POTENTIAL_RAIN_EXPOSURE").length,1);
assert.equal(preview.build("rain").segments[1].rainProbabilityPct,76);
assert.equal(preview.build("unspecified").scenario,"missing");
console.log("PASS: synthetic research view and all public safety invariants");
