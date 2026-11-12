/* RainGuard Hydrology-16: offline evidence follow-up planner, no safety evaluation. */
(function(root,factory){"use strict";const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;if(root&&root.document)root.RainGuardHydrology16=api;})(typeof globalThis!=="undefined"?globalThis:this,function(){"use strict";
const HEADERS=["recordId","siteId","category","present","total","missingFields","entryStatus","notesPresent","referencePresent","officialClosurePresent"];
const ALLOWED=new Set(["NO_INPUT","MISSING_FIELDS","FIELDS_PRESENT_UNVERIFIED"]);
const FIELD_NAMES=new Set(["observedStructureType","observedCrossing","observationDate","organization","photoReference","surveyReference","culvertWidthMeters","culvertHeightMeters","culvertOpeningCount","bridgeSurveyReference","authorityInventoryReference","officialClosureReference","notes"]);
function check(v,msg){if(!v)throw Error(msg);}
function decode(arrayBuffer){const bytes=new Uint8Array(arrayBuffer);check(bytes.length>2&&bytes.length<=3*1024*1024,"حجم الملف غير مسموح");check(bytes[0]===255&&bytes[1]===254,"يجب اختيار TSV أصلي بترميز UTF-16LE");return new TextDecoder("utf-16le",{fatal:true}).decode(bytes.subarray(2));}
function parse(text){
 const lines=text.replace(/\r\n/g,"\n").replace(/\n$/,"").split("\n");check(lines.length>=2&&lines.length<=1001,"عدد الأسطر غير مقبول");
 const header=lines.shift().split("\t");check(header.length===HEADERS.length&&header.every((x,i)=>x===HEADERS[i]),"أعمدة الملف غير متطابقة مع Hydrology-14");
 const seen=new Set();
 const records=lines.map((line,i)=>{
  const c=line.split("\t");check(c.length===HEADERS.length,"عدد الأعمدة غير صحيح في السطر "+(i+2));
  const [recordId,siteId,category,present,total,missingFields,entryStatus,notesPresent,referencePresent,officialClosurePresent]=c;
  check(/^RG-HYDRO-REVIEW-[0-9]{3}-(?:way-[0-9]+|node-[0-9]+|NO_OSM_MATCH)$/.test(recordId)&&!seen.has(recordId),"معرف مكرر أو غير صالح");seen.add(recordId);
  check(siteId===recordId.slice(0,19)&&ALLOWED.has(category),"الموقع أو الحالة غير صالح");
  const p=Number(present),t=Number(total);
  check(/^\d+$/.test(present)&&/^\d+$/.test(total)&&t>=1&&t<=13&&p<=t,"مقاييس الاكتمال غير صالحة");
  const missing=missingFields?missingFields.split("; ").map(s=>s.trim()):[];
  check(missing.length===t-p&&new Set(missing).size===missing.length&&missing.every(f=>FIELD_NAMES.has(f)),"حقول النقص غير متطابقة");
  check(["true","false"].includes(notesPresent)&&["true","false"].includes(referencePresent)&&["true","false"].includes(officialClosurePresent),"قيم منطقية غير صحيحة");
  check(category===(entryStatus==="NOT_ENTERED"?"NO_INPUT":missing.length?"MISSING_FIELDS":"FIELDS_PRESENT_UNVERIFIED")&&
    ["NOT_ENTERED","DRAFT_ENTERED_NOT_VERIFIED"].includes(entryStatus),"حالة الإدخال غير متسقة");
  const evidenceGroup=missing.some(f=>["authorityInventoryReference","officialClosureReference"].includes(f))?"الجهة المختصة بالسجلات الرسمية":
    missing.some(f=>["bridgeSurveyReference","culvertWidthMeters","culvertHeightMeters","culvertOpeningCount"].includes(f))?"فريق هندسي مختص":
    "فريق المعاينة الميدانية المختص";
  return {recordId,siteId,category,present:p,total:t,missingFields:missing,
    referencePresent:referencePresent==="true",officialClosurePresent:officialClosurePresent==="true",
    followUp:evidenceGroup,followUpStatus:"AWAITING_INDEPENDENT_EVIDENCE",
    prioritization:"استكمال المستندات فقط — ليست أولوية خطر",verified:false};
 });
 check(records.length>0,"لا توجد سجلات");
 return {reportType:"RAINGUARD_HYDROLOGY16_FOLLOWUP_REGISTER",status:"OFFLINE_RESEARCH_NOT_VERIFIED",
   counts:{total:records.length,empty:records.filter(r=>r.category==="NO_INPUT").length,
   incomplete:records.filter(r=>r.category==="MISSING_FIELDS").length,
   fieldsPresentUnverified:records.filter(r=>r.category==="FIELDS_PRESENT_UNVERIFIED").length},
   verifiedCount:0,safeToDrive:null,routeApproved:false,floodRisk:"NOT_EVALUATED",
   limitations:"No engineering verification, road safety judgment, flood risk estimate, or operational alert.",records};
}
return {decode,parse,HEADERS};
});