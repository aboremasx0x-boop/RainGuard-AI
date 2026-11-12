const {test}=require("node:test");const assert=require("node:assert/strict");
const h18=require("../frontend/js/hydrology18_response_log.js");
const h19=require("../frontend/js/hydrology19_readiness_audit.js");
function fixture(){
 const site="RG-HYDRO-REVIEW-001";
 return {reportType:"RAINGUARD_HYDROLOGY17_EVIDENCE_REQUEST_PLAN",status:"OFFLINE_DRAFT_NOT_SENT",
 sourceReportType:"RAINGUARD_HYDROLOGY16_FOLLOWUP_REGISTER",
 summary:{sites:1,records:2,empty:1,incomplete:1,fieldsPresentUnverified:0,requestsSent:0,independentlyVerified:0},
 safeToDrive:null,routeApproved:false,floodRisk:"NOT_EVALUATED",
 requests:[{siteId:site,recordIds:[site+"-way-240251214",site+"-way-41426918"],
 missingFields:["observationDate","observedCrossing","observedStructureType","organization","photoReference"],
 noInput:1,incomplete:1,fieldsPresentUnverified:0,includesUnmatchedOSM:false,
 requestStatus:"DRAFT_NOT_SENT",independentReviewStatus:"NOT_PERFORMED",sourceAuthentication:"NOT_AUTHENTICATED",roadSafety:"NOT_EVALUATED"}]};
}
test("empty events leave all gates blocked",()=>{const p=fixture(),l=h18.init(p),r=h19.audit(p,l);
 assert.equal(r.summary.sitesBlocked,1);assert.equal(r.summary.responseClaimEvents,0);
 assert.equal(r.sites[0].readiness,"BLOCKED_PENDING_EXTERNAL_VERIFICATION");assert.equal(r.safeToDrive,null);});
test("administrative claim cannot unblock approvals",()=>{
 const p=fixture();let l=h18.init(p);l=h18.append(l,{siteId:p.requests[0].siteId,eventType:"SENT_LOGGED",recordedDate:"2026-11-12",reference:"out-1",notes:""});
 l=h18.append(l,{siteId:p.requests[0].siteId,eventType:"RESPONSE_LOGGED",recordedDate:"2026-11-12",reference:"in-1",notes:""});
 const r=h19.audit(p,l);assert.equal(r.summary.sitesBlocked,1);assert.equal(r.summary.independentlyVerifiedSites,0);
 assert.equal(r.sites[0].independentReview,"NOT_PERFORMED");});
test("reject mismatch between stage17 and stage18",()=>{
 const p=fixture(),l=h18.init(p);l.sourceRecordIds[0]="RG-HYDRO-REVIEW-001-way-999";assert.throws(()=>h19.audit(p,l));});
test("reject false approval status",()=>{
 const p=fixture(),l=h18.init(p);l.routeApproved=true;assert.throws(()=>h19.audit(p,l));});
test("reject invalid input plan",()=>{
 const p=fixture(),l=h18.init(p);p.summary.requestsSent=1;assert.throws(()=>h19.audit(p,l));});
