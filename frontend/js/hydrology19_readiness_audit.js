/* Hydrology-19: strictly read-only local evidence gap/readiness audit.
 * Never approves a route, bridge, culvert, alert or flood-risk status.
 */
(function(root,factory){"use strict";
 const h18=root&&root.RainGuardHydrology18 || (typeof module==="object"&&module.exports?require("./hydrology18_response_log.js"):null);
 const api=factory(h18);
 if(typeof module==="object"&&module.exports)module.exports=api;
 if(root&&root.document)root.RainGuardHydrology19=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(h18){"use strict";
function check(ok,msg){if(!ok)throw Error(msg);}
function audit(plan,log){
 check(h18&&typeof h18.validatePlan==="function"&&typeof h18.resume==="function","MISSING_VALIDATION_DEPENDENCY");
 h18.validatePlan(plan);
 // Resume revalidates the administrative log and all user-entered events without mutating the input.
 const validated=h18.resume(plan,log);
 const requests=plan.requests.map(req=>{
   const events=validated.events.filter(e=>e.siteId===req.siteId);
   const sent=events.filter(e=>e.eventType==="SENT_LOGGED").length;
   const replies=events.filter(e=>e.eventType==="RESPONSE_LOGGED").length;
   const gaps=[];
   if(req.noInput>0)gaps.push("RECORDS_WITH_NO_INPUT");
   if(req.incomplete>0)gaps.push("INCOMPLETE_RECORD_FIELDS");
   if(req.missingFields.length>0)gaps.push("MISSING_REQUIRED_FIELD_EVIDENCE");
   if(!sent)gaps.push("NO_SEND_CLAIM_LOGGED");
   else gaps.push("SEND_CLAIM_NOT_INDEPENDENTLY_AUTHENTICATED");
   if(!replies)gaps.push("NO_RESPONSE_CLAIM_LOGGED");
   else gaps.push("RESPONSE_CLAIM_NOT_INDEPENDENTLY_AUTHENTICATED");
   gaps.push("NO_AUTHENTICATED_FIELD_EVIDENCE");
   gaps.push("NO_INDEPENDENT_ENGINEERING_REVIEW");
   gaps.push("NO_AUTHORIZED_OPERATIONAL_DECISION");
   return {siteId:req.siteId,recordCount:req.recordIds.length,
     missingFields:req.missingFields.slice(),noInput:req.noInput,incomplete:req.incomplete,
     unmatchedOSMCandidate:req.includesUnmatchedOSM,
     administrativeClaims:{sent,received:replies,notes:events.filter(e=>e.eventType==="FOLLOWUP_NOTE").length},
     gaps,readiness:"BLOCKED_PENDING_EXTERNAL_VERIFICATION",
     roadSafety:null,floodRisk:"NOT_EVALUATED",independentReview:"NOT_PERFORMED"};
 });
 return {reportType:"RAINGUARD_HYDROLOGY19_READINESS_GAP_AUDIT",
   status:"RESEARCH_ONLY_ALL_OPERATIONAL_GATES_BLOCKED",
   sourcePlan:"RAINGUARD_HYDROLOGY17_EVIDENCE_REQUEST_PLAN",
   sourceLog:"RAINGUARD_HYDROLOGY18_LOCAL_RESPONSE_LOG",
   summary:{sites:requests.length,records:plan.summary.records,
     sitesBlocked:requests.length,
     sitesWithNoInput:requests.filter(r=>r.noInput>0).length,
     sitesWithIncompleteRows:requests.filter(r=>r.incomplete>0).length,
     sendClaimEvents:validated.events.filter(e=>e.eventType==="SENT_LOGGED").length,
     responseClaimEvents:validated.events.filter(e=>e.eventType==="RESPONSE_LOGGED").length,
     independentlyVerifiedSites:0,operationallyApprovedSites:0},
   safeToDrive:null,routeApproved:false,operationalAlertApproved:false,
   floodRisk:"NOT_EVALUATED",
   limitations:"Administrative event claims do not authenticate delivery or receipt. Completeness alone does not validate hydrology, engineering safety or route operations.",
   sites:requests};
}
return {audit};
});