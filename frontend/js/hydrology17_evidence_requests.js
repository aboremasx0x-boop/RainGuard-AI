/* RainGuard Hydrology-17 — local request planner. No operational authorization. */
(function(root,factory){"use strict";const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;if(root&&root.document)root.RainGuardHydrology17=api;})(typeof globalThis!=="undefined"?globalThis:this,function(){"use strict";
const EXPECTED="RAINGUARD_HYDROLOGY16_FOLLOWUP_REGISTER";
const SITE=/^RG-HYDRO-REVIEW-[0-9]{3}$/;
const RECORD=/^RG-HYDRO-REVIEW-[0-9]{3}-(?:way-[0-9]+|node-[0-9]+|NO_OSM_MATCH)$/;
const FIELDS=new Set(["observedStructureType","observedCrossing","observationDate","organization","photoReference","surveyReference","culvertWidthMeters","culvertHeightMeters","culvertOpeningCount","bridgeSurveyReference","authorityInventoryReference","officialClosureReference","notes"]);
const STATES=new Set(["NO_INPUT","MISSING_FIELDS","FIELDS_PRESENT_UNVERIFIED"]);
const ENTRIES=new Set(["NOT_ENTERED","DRAFT_ENTERED_NOT_VERIFIED"]);
function requireOk(ok,code){if(!ok)throw Error(code);}
function plan(source){
 requireOk(source&&typeof source==="object"&&!Array.isArray(source),"INVALID_SOURCE");
 requireOk(source.reportType===EXPECTED&&source.status==="OFFLINE_RESEARCH_NOT_VERIFIED","WRONG_REPORT");
 requireOk(source.verifiedCount===0&&source.safeToDrive===null&&source.routeApproved===false&&source.floodRisk==="NOT_EVALUATED","UNSAFE_SOURCE");
 requireOk(Array.isArray(source.records)&&source.records.length>=1&&source.records.length<=1000,"INVALID_RECORD_COUNT");
 const ids=new Set(),groups=new Map();
 let empty=0,incomplete=0,present=0;
 for(const r of source.records){
  requireOk(r&&typeof r==="object"&&RECORD.test(r.recordId)&&SITE.test(r.siteId)&&r.recordId.startsWith(r.siteId+"-")&&!ids.has(r.recordId),"INVALID_RECORD_ID");
  ids.add(r.recordId);
  requireOk(STATES.has(r.category)&&(!Object.prototype.hasOwnProperty.call(r,"entryStatus")||ENTRIES.has(r.entryStatus))&&r.followUpStatus==="AWAITING_INDEPENDENT_EVIDENCE"&&r.verified===false,"INVALID_REVIEW_STATE");
  requireOk(Array.isArray(r.missingFields)&&r.missingFields.length<=13&&r.missingFields.every(f=>FIELDS.has(f))&&new Set(r.missingFields).size===r.missingFields.length,"INVALID_MISSING_FIELDS");
  requireOk(Number.isInteger(r.total)&&Number.isInteger(r.present)&&r.total>0&&r.total<=13&&r.present>=0&&r.present<=r.total&&r.total-r.present===r.missingFields.length,"INCONSISTENT_COUNTS");
  requireOk(r.category==="NO_INPUT" ? (r.present===0&&r.missingFields.length===r.total&&(r.entryStatus===undefined||r.entryStatus==="NOT_ENTERED")) : r.category==="MISSING_FIELDS" ? (r.missingFields.length>0&&(r.entryStatus===undefined||r.entryStatus==="DRAFT_ENTERED_NOT_VERIFIED")) : (r.missingFields.length===0&&(r.entryStatus===undefined||r.entryStatus==="DRAFT_ENTERED_NOT_VERIFIED")),"INCONSISTENT_CATEGORY");
  if(r.category==="NO_INPUT")empty++;
  else if(r.category==="MISSING_FIELDS")incomplete++;
  else present++;
  if(!groups.has(r.siteId))groups.set(r.siteId,{siteId:r.siteId,recordIds:[],missingFields:new Set(),noInput:0,incomplete:0,fieldsPresentUnverified:0,includesUnmatchedOSM:false});
  const g=groups.get(r.siteId);
  g.recordIds.push(r.recordId);r.missingFields.forEach(f=>g.missingFields.add(f));
  if(r.category==="NO_INPUT")g.noInput++;
  else if(r.category==="MISSING_FIELDS")g.incomplete++;
  else g.fieldsPresentUnverified++;
  if(r.recordId.endsWith("-NO_OSM_MATCH"))g.includesUnmatchedOSM=true;
 }
 requireOk(source.counts&&source.counts.total===source.records.length&&source.counts.empty===empty&&source.counts.incomplete===incomplete&&source.counts.fieldsPresentUnverified===present,"INVALID_SUMMARY");
 const requests=[...groups.values()].sort((a,b)=>a.siteId.localeCompare(b.siteId)).map(g=>({
  siteId:g.siteId,recordIds:g.recordIds.slice(),missingFields:[...g.missingFields].sort(),
  noInput:g.noInput,incomplete:g.incomplete,fieldsPresentUnverified:g.fieldsPresentUnverified,
  includesUnmatchedOSM:g.includesUnmatchedOSM,
  suggestedRecipientRole:"الجهة المختصة بالمنشآت وتصريف السيول / فريق المعاينة المرخّص",
  requestStatus:"DRAFT_NOT_SENT",independentReviewStatus:"NOT_PERFORMED",
  sourceAuthentication:"NOT_AUTHENTICATED",roadSafety:"NOT_EVALUATED",
  nextAction:"طلب معاينة موثقة ومراجع الصور والمسح والمخزون الرسمي عند توفرها"
 }));
 return {reportType:"RAINGUARD_HYDROLOGY17_EVIDENCE_REQUEST_PLAN",
 status:"OFFLINE_DRAFT_NOT_SENT",sourceReportType:EXPECTED,
 summary:{sites:requests.length,records:source.records.length,empty,incomplete,fieldsPresentUnverified:present,requestsSent:0,independentlyVerified:0},
 safeToDrive:null,routeApproved:false,floodRisk:"NOT_EVALUATED",
 limitations:"This is only a locally generated draft request queue. No message sent, no independent validation, no risk ranking or traffic guidance.",requests};
}
function requestText(item){
 requireOk(item&&SITE.test(item.siteId)&&Array.isArray(item.recordIds),"INVALID_REQUEST");
 return "الموضوع: طلب استكمال أدلة معاينة بحثية — "+item.siteId+"\n\n"+
 "نرجو توجيه طلب مراجعة فنية مستقلة للسجلات التالية: "+item.recordIds.join("، ")+"\n"+
 "الحقول المطلوب استكمال مراجعها: "+(item.missingFields.join("، ")||"لا توجد حقول ناقصة في التقرير؛ يلزم التحقق من صحة المراجع القائمة")+"\n"+
 (item.includesUnmatchedOSM?"تنبيه: عدم ظهور مطابقة OSM لا يثبت غياب المنشأة.\n":"")+
 "يرجى تزويدنا بمعاينة معتمدة ومراجع مصادرها وتاريخها، مع مراجعة هندسية مستقلة بواسطة الجهات المختصة.\n"+
 "هذا طلب إعداد بحثي غير مرسل، وليس قرارًا بسلامة الطرق أو مستوى مخاطر السيول.";
}
return {plan,requestText};
});