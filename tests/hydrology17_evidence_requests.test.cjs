const {test}=require("node:test");const assert=require("node:assert/strict");const api=require("../frontend/js/hydrology17_evidence_requests.js");
function sample(){
 const site="RG-HYDRO-REVIEW-001";
 const missing=["observedStructureType","observedCrossing","observationDate","organization","photoReference"];
 return {reportType:"RAINGUARD_HYDROLOGY16_FOLLOWUP_REGISTER",status:"OFFLINE_RESEARCH_NOT_VERIFIED",
 counts:{total:2,empty:1,incomplete:1,fieldsPresentUnverified:0},verifiedCount:0,safeToDrive:null,routeApproved:false,floodRisk:"NOT_EVALUATED",
 records:[
 {recordId:site+"-way-123",siteId:site,category:"NO_INPUT",entryStatus:"NOT_ENTERED",present:0,total:5,missingFields:missing,followUpStatus:"AWAITING_INDEPENDENT_EVIDENCE",verified:false},
 {recordId:site+"-way-456",siteId:site,category:"MISSING_FIELDS",entryStatus:"DRAFT_ENTERED_NOT_VERIFIED",present:0,total:5,missingFields:missing,followUpStatus:"AWAITING_INDEPENDENT_EVIDENCE",verified:false}
 ]};}
test("group records by site and keep unverified",()=>{const p=api.plan(sample());assert.equal(p.summary.sites,1);assert.equal(p.summary.records,2);assert.equal(p.requests[0].recordIds.length,2);assert.equal(p.requests[0].requestStatus,"DRAFT_NOT_SENT");assert.equal(p.safeToDrive,null);assert.equal(p.summary.independentlyVerified,0);});
test("reject ungrounded approval or risk state",()=>{let s=sample();s.safeToDrive=true;assert.throws(()=>api.plan(s));});
test("reject duplicate records",()=>{const s=sample();s.records[1].recordId=s.records[0].recordId;assert.throws(()=>api.plan(s));});
test("reject fake validated review",()=>{const s=sample();s.records[0].verified=true;assert.throws(()=>api.plan(s));});
test("reject inconsistent count",()=>{const s=sample();s.counts.empty=2;assert.throws(()=>api.plan(s));});
test("produce draft text without safety claim",()=>{const p=api.plan(sample()),t=api.requestText(p.requests[0]);assert.match(t,/طلب استكمال أدلة/);assert.match(t,/غير مرسل/);});
