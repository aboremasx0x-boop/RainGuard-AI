const {test}=require("node:test");const assert=require("node:assert/strict");const api=require("../frontend/js/hydrology18_response_log.js");
function fixture(){
 const site="RG-HYDRO-REVIEW-001";return {
 reportType:"RAINGUARD_HYDROLOGY17_EVIDENCE_REQUEST_PLAN",status:"OFFLINE_DRAFT_NOT_SENT",
 sourceReportType:"RAINGUARD_HYDROLOGY16_FOLLOWUP_REGISTER",
 summary:{sites:1,records:2,empty:1,incomplete:1,fieldsPresentUnverified:0,requestsSent:0,independentlyVerified:0},
 safeToDrive:null,routeApproved:false,floodRisk:"NOT_EVALUATED",
 requests:[{siteId:site,recordIds:[site+"-way-240251214",site+"-way-41426918"],
 missingFields:["observationDate","observedCrossing","observedStructureType","organization","photoReference"],
 noInput:1,incomplete:1,fieldsPresentUnverified:0,includesUnmatchedOSM:false,
 requestStatus:"DRAFT_NOT_SENT",independentReviewStatus:"NOT_PERFORMED",
 sourceAuthentication:"NOT_AUTHENTICATED",roadSafety:"NOT_EVALUATED"}]};}
test("valid unverified baseline",()=>{const p=fixture(),log=api.init(p);assert.equal(log.events.length,0);assert.equal(log.safeToDrive,null);assert.equal(log.independentVerifiedCount,0);assert.equal(api.summary(log)[0].administrativeState,"DRAFT_OR_NOT_SENT");});
test("recorded send is an unverified claim, not proof",()=>{const log=api.init(fixture());
 const updated=api.append(log,{siteId:"RG-HYDRO-REVIEW-001",eventType:"SENT_LOGGED",recordedDate:"2026-11-12",reference:"outgoing-123",notes:"unverified claim"});
 assert.equal(api.summary(updated)[0].administrativeState,"SENT_CLAIM_LOGGED_UNVERIFIED");assert.equal(updated.safeToDrive,null);
 assert.equal(log.events.length,0);});
test("reply is not independently authenticated",()=>{const log=api.append(api.init(fixture()),{siteId:"RG-HYDRO-REVIEW-001",eventType:"RESPONSE_LOGGED",recordedDate:"2026-11-12",reference:"inbound-1",notes:""});assert.equal(api.summary(log)[0].independentReview,"NOT_PERFORMED");});
test("reject logged send without reference",()=>{assert.throws(()=>api.append(api.init(fixture()),{siteId:"RG-HYDRO-REVIEW-001",eventType:"SENT_LOGGED",recordedDate:"2026-11-12",reference:"",notes:""}));});
test("reject unauthorized site",()=>{assert.throws(()=>api.append(api.init(fixture()),{siteId:"RG-HYDRO-REVIEW-999",eventType:"FOLLOWUP_NOTE",recordedDate:"2026-11-12",reference:"",notes:""}));});
test("reject unsafe source plan",()=>{const p=fixture();p.routeApproved=true;assert.throws(()=>api.init(p));});
test("reject inaccurate aggregate count",()=>{const p=fixture();p.summary.records=3;assert.throws(()=>api.init(p));});
test("resume remains bound to original plan",()=>{const p=fixture(),saved=api.append(api.init(p),{siteId:"RG-HYDRO-REVIEW-001",eventType:"FOLLOWUP_NOTE",recordedDate:"2026-11-12",reference:"",notes:"متابعة"});assert.equal(api.resume(p,saved).events.length,1);const altered=structuredClone(saved);altered.sourceRecordIds[0]="RG-HYDRO-REVIEW-001-way-999";assert.throws(()=>api.resume(p,altered));});
test("reject invented evidence approval in resumed log",()=>{const p=fixture(),log=api.init(p);log.independentVerifiedCount=1;assert.throws(()=>api.resume(p,log));});
