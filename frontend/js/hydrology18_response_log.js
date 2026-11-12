/* Hydrology-18: offline administrative event log; no road-safety validation. */
(function(root,factory){"use strict";const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;if(root&&root.document)root.RainGuardHydrology18=api;})(typeof globalThis!=="undefined"?globalThis:this,function(){"use strict";
const SITE=/^RG-HYDRO-REVIEW-[0-9]{3}$/;
const RECORD=/^RG-HYDRO-REVIEW-[0-9]{3}-(?:way-[0-9]+|node-[0-9]+|NO_OSM_MATCH)$/;
const FIELD_SET=new Set(["observedStructureType","observedCrossing","observationDate","organization","photoReference","surveyReference","culvertWidthMeters","culvertHeightMeters","culvertOpeningCount","bridgeSurveyReference","authorityInventoryReference","officialClosureReference","notes"]);
const TYPES=new Set(["SENT_LOGGED","RESPONSE_LOGGED","FOLLOWUP_NOTE"]);
function check(ok,msg){if(!ok)throw Error(msg);}
function text(v,key,max=400){check(typeof v==="string"&&v.length<=max&&!/[\u0000-\u001f]/.test(v),"INVALID_"+key);return v.trim();}
function validatePlan(plan){
 check(plan&&typeof plan==="object"&&!Array.isArray(plan)&&
 plan.reportType==="RAINGUARD_HYDROLOGY17_EVIDENCE_REQUEST_PLAN"&&
 plan.status==="OFFLINE_DRAFT_NOT_SENT"&&
 plan.sourceReportType==="RAINGUARD_HYDROLOGY16_FOLLOWUP_REGISTER","WRONG_INPUT_PLAN");
 check(plan.safeToDrive===null&&plan.routeApproved===false&&plan.floodRisk==="NOT_EVALUATED","UNSAFE_INPUT");
 check(plan.summary&&Number.isInteger(plan.summary.sites)&&
 Number.isInteger(plan.summary.records)&&plan.summary.requestsSent===0&&plan.summary.independentlyVerified===0,"INVALID_SUMMARY");
 check(Array.isArray(plan.requests)&&plan.requests.length>=1&&plan.requests.length<=300&&plan.requests.length===plan.summary.sites,"INVALID_SITE_COUNT");
 const sites=new Set(),ids=new Set();let count=0,empty=0,incomplete=0,present=0;
 for(const r of plan.requests){
  check(r&&SITE.test(r.siteId)&&!sites.has(r.siteId),"DUPLICATE_OR_INVALID_SITE");sites.add(r.siteId);
  check(r.requestStatus==="DRAFT_NOT_SENT"&&r.independentReviewStatus==="NOT_PERFORMED"&&
    r.sourceAuthentication==="NOT_AUTHENTICATED"&&r.roadSafety==="NOT_EVALUATED","UNSAFE_REQUEST");
  check(Array.isArray(r.recordIds)&&r.recordIds.length>0&&r.recordIds.length<=100,"INVALID_RECORD_LIST");
  for(const id of r.recordIds){check(typeof id==="string"&&RECORD.test(id)&&id.startsWith(r.siteId+"-")&&!ids.has(id),"INVALID_OR_DUPLICATE_RECORD");ids.add(id);count++;}
  check(Array.isArray(r.missingFields)&&r.missingFields.length<=13&&r.missingFields.every(f=>FIELD_SET.has(f))&&new Set(r.missingFields).size===r.missingFields.length,"INVALID_MISSING_FIELDS");
  check(["noInput","incomplete","fieldsPresentUnverified"].every(k=>Number.isInteger(r[k])&&r[k]>=0)&&r.noInput+r.incomplete+r.fieldsPresentUnverified===r.recordIds.length,"INVALID_SITE_COUNTS");
  check(r.includesUnmatchedOSM===r.recordIds.some(x=>x.endsWith("-NO_OSM_MATCH")),"UNMATCHED_OSM_MISMATCH");
  empty+=r.noInput;incomplete+=r.incomplete;present+=r.fieldsPresentUnverified;
 }
 check(count===plan.summary.records&&empty===plan.summary.empty&&incomplete===plan.summary.incomplete&&present===plan.summary.fieldsPresentUnverified,"INVALID_AGGREGATE_COUNTS");
 return plan;
}
function init(plan){
 validatePlan(plan);
 return {reportType:"RAINGUARD_HYDROLOGY18_LOCAL_RESPONSE_LOG",
 status:"LOCAL_ADMINISTRATIVE_LOG_UNVERIFIED",
 sourceReportType:plan.reportType,
 sourceSiteIds:plan.requests.map(x=>x.siteId),
 sourceRecordIds:plan.requests.flatMap(x=>x.recordIds),
 safeToDrive:null,routeApproved:false,floodRisk:"NOT_EVALUATED",
 independentVerifiedCount:0,operationalAlertApproved:false,
 events:[],limitations:"Administrative records are user-entered assertions, not proof of transmission, receipt, engineering verification, road safety or authority approval."};
}
function validateEvent(event,sites){
 check(event&&typeof event==="object"&&!Array.isArray(event),"INVALID_EVENT");
 check(Object.keys(event).sort().join("|")==="eventType|reference|siteId|recordedDate|notes".split("|").sort().join("|"),"INVALID_EVENT_FIELDS");
 check(SITE.test(event.siteId)&&sites.includes(event.siteId),"UNKNOWN_SITE");
 check(TYPES.has(event.eventType),"UNSUPPORTED_EVENT_TYPE");
 const ref=text(event.reference,"REFERENCE",250),notes=text(event.notes,"NOTES",600);
 const date=text(event.recordedDate,"DATE",10);
 check(/^\d{4}-\d{2}-\d{2}$/.test(date)&&new Date(date+"T00:00:00Z").toISOString().slice(0,10)===date,"INVALID_DATE");
 if(event.eventType!=="FOLLOWUP_NOTE")check(ref.length>=3,"REFERENCE_REQUIRED");
 return {siteId:event.siteId,eventType:event.eventType,recordedDate:date,reference:ref,notes};
}
function append(log,event){
 check(log&&log.reportType==="RAINGUARD_HYDROLOGY18_LOCAL_RESPONSE_LOG"&&log.status==="LOCAL_ADMINISTRATIVE_LOG_UNVERIFIED"&&
  log.safeToDrive===null&&log.routeApproved===false&&log.floodRisk==="NOT_EVALUATED"&&
  log.independentVerifiedCount===0&&log.operationalAlertApproved===false,"INVALID_LOG");
 check(Array.isArray(log.sourceSiteIds)&&Array.isArray(log.events)&&log.events.length<3000,"INVALID_LOG_SIZE");
 const e=validateEvent(event,log.sourceSiteIds);
 return {...log,events:[...log.events,e]};
}
function resume(plan,saved){
 const clean=init(plan);
 check(saved&&saved.reportType===clean.reportType&&saved.status===clean.status&&saved.safeToDrive===null&&saved.routeApproved===false&&
  saved.floodRisk==="NOT_EVALUATED"&&saved.independentVerifiedCount===0&&saved.operationalAlertApproved===false,"UNSAFE_RESUME_FILE");
 check(Array.isArray(saved.sourceSiteIds)&&JSON.stringify(saved.sourceSiteIds)===JSON.stringify(clean.sourceSiteIds)&&
  Array.isArray(saved.sourceRecordIds)&&JSON.stringify(saved.sourceRecordIds)===JSON.stringify(clean.sourceRecordIds),"SOURCE_MISMATCH");
 check(Array.isArray(saved.events)&&saved.events.length<=3000,"INVALID_EVENTS");
 let out=clean;for(const event of saved.events)out=append(out,event);
 return out;
}
function summary(log){
 check(log&&Array.isArray(log.sourceSiteIds)&&Array.isArray(log.events),"INVALID_LOG");
 return log.sourceSiteIds.map(siteId=>{const events=log.events.filter(e=>e.siteId===siteId);
 const sent=events.some(e=>e.eventType==="SENT_LOGGED");
 const response=events.some(e=>e.eventType==="RESPONSE_LOGGED");
 return {siteId,events:events.length,administrativeState:response?"RESPONSE_CLAIM_LOGGED_UNVERIFIED":sent?"SENT_CLAIM_LOGGED_UNVERIFIED":"DRAFT_OR_NOT_SENT",independentReview:"NOT_PERFORMED",safeToDrive:null};
 });
}
return {validatePlan,init,append,resume,summary};
});