"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const h12=require("../frontend/js/hydrology12_evidence_drafts.js");
function sampleSource(){
 return {siteCount:2,candidateCount:1,rows:[
 {id:"RG-HYDRO-REVIEW-001-way-123",siteId:"RG-HYDRO-REVIEW-001",osmElement:"way/123",
 osmUrl:"https://www.openstreetmap.org/way/123",lat:21.5,lon:39.4,type:"MAPPED_ROAD_BRIDGE",
 routeDistance:0,riverDistance:2},
 {id:"RG-HYDRO-REVIEW-002-NO_OSM_MATCH",siteId:"RG-HYDRO-REVIEW-002",osmElement:"",
 osmUrl:"",lat:21.6,lon:39.5,type:"NO_OSM_MATCH_IN_SNAPSHOT",
 routeDistance:null,riverDistance:null}
 ]};
}
test("builds empty unverified draft across candidate and unmatched sites",()=>{
 const x=h12.buildDraft(sampleSource(),{});
 assert.equal(x.reportType,"RAINGUARD_HYDROLOGY12_LOCAL_EVIDENCE_DRAFT");
 assert.equal(x.worksheetCount,2);assert.equal(x.enteredDraftCount,0);
 assert.equal(x.independentlyVerifiedEvidenceCount,0);
 assert.equal(x.records[0].fieldVerification,"NOT_AUTHENTICATED");
 assert.equal(x.records[1].entryStatus,"NOT_ENTERED");
 assert.equal(x.records[1].osmElement,"");
 assert.equal(x.safeToDrive,null);assert.equal(x.alternativeRouteApproved,false);
});
test("persists notes only as unauthenticated draft and accepts bounded real measurements",()=>{
 const source=sampleSource();
 const id=source.rows[0].id;
 const x=h12.buildDraft(source,{[id]:{
 observedStructureType:"culvert",observedCrossing:"yes_observed",
 observationDate:"2026-11-12",organization:"test agency",
 photoReference:"inspection/photo-123.jpg",culvertWidthMeters:"2.5",
 culvertOpeningCount:"2",notes:"Potential crossing; not verified."
 }});
 assert.equal(x.enteredDraftCount,1);
 assert.equal(x.records[0].evidence.culvertWidthMeters,"2.5");
 assert.equal(x.records[0].bridgeCulvertApproved,false);
 assert.equal(x.records[0].roadWadiCrossingVerified,false);
 assert.equal(x.records[0].floodRisk,"NOT_EVALUATED");
 assert.equal(x.safeToDrive,null);
});
test("rejects forged record IDs, unknown fields do not change decisions",()=>{
 assert.throws(()=>h12.buildDraft(sampleSource(),{"RG-HYDRO-REVIEW-1000-way-1":{notes:"x"}}));
 const x=h12.buildDraft(sampleSource(),{[sampleSource().rows[0].id]:{safeToDrive:true,notes:"pending"}});
 assert.equal(x.safeToDrive,null);
 assert.equal(x.records[0].safeToDrive,null);
 assert.equal(x.records[0].evidence.safeToDrive,undefined);
});
test("rejects invalid dates, dimensions, infinite inputs, invalid types",()=>{
 for(const e of [
 {observationDate:"2026-02-30"},{observationDate:"2026-11-99"},
 {culvertOpeningCount:"1.5"},{culvertWidthMeters:"-1"},
 {culvertHeightMeters:"1e900"},{culvertHeightMeters:"Infinity"},
 {observedCrossing:"approved"},{observedStructureType:"certified"},
 {notes:"x".repeat(1001)}
 ])assert.throws(()=>h12.normalize(e));
});
test("CSV escapes spreadsheet formula injection and preserves cells",()=>{
 const source=sampleSource(),id=source.rows[0].id;
 const x=h12.buildDraft(source,{[id]:{notes:'=HYPERLINK("evil", "click")',organization:"\t@SUM(A1:A2)"}});
 const csv=h12.toCSV(x);
 assert.match(csv,/'=HYPERLINK/);
 assert.match(csv,/'\t@SUM/);
 assert.doesNotMatch(csv,/"=HYPERLINK/);
 assert.equal(csv.split("\r\n").filter(Boolean).length,3);
});
