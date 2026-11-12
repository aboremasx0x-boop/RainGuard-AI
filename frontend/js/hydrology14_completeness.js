/* Hydrology-14: local evidence completeness inventory, not evidence verification. */
(function(root,factory){
 "use strict";
 const dependency=(root&&root.RainGuardHydrology12)||
  (typeof module==="object"&&module.exports?require("./hydrology12_evidence_drafts.js"):null);
 const api=factory(dependency);
 if(typeof module==="object"&&module.exports)module.exports=api;
 if(root&&root.document){root.RainGuardHydrology14=api;root.document.addEventListener("DOMContentLoaded",()=>api.bind(root.document));}
})(typeof globalThis!=="undefined"?globalThis:this,function(h12){
 "use strict";
 const MAX_FILE=3*1024*1024;
 const FIELDS=["observedStructureType","observedCrossing","observationDate","organization","photoReference",
  "surveyReference","culvertWidthMeters","culvertHeightMeters","culvertOpeningCount",
  "bridgeSurveyReference","authorityInventoryReference","officialClosureReference","notes"];
 const LABELS={observedStructureType:"نوع المنشأة المرصود",observedCrossing:"حالة التقاطع المرصودة",
  observationDate:"تاريخ المعاينة",organization:"الجهة/الشخص الذي سجل الملاحظة",
  photoReference:"مرجع الصورة",surveyReference:"مرجع المسح الموقعي",
  culvertWidthMeters:"عرض فتحة العبارة",culvertHeightMeters:"ارتفاع فتحة العبارة",
  culvertOpeningCount:"عدد فتحات العبارة",bridgeSurveyReference:"مرجع المسح الهندسي للجسر",
  authorityInventoryReference:"مرجع سجل الجهة المختصة",
  officialClosureReference:"مرجع قرار الإغلاق الرسمي",notes:"الملاحظات"};
 function assert(ok,message){if(!ok)throw new Error(message);}
 function review(draft){
  assert(draft&&typeof draft==="object"&&!Array.isArray(draft),"ملف غير صالح");
  assert(draft.reportType==="RAINGUARD_HYDROLOGY12_LOCAL_EVIDENCE_DRAFT"
   &&draft.status==="LOCAL_EVIDENCE_DRAFT_NOT_AUTHENTICATED","نوع أو حالة المسودة غير صحيح");
  assert(Array.isArray(draft.records)&&draft.records.length===draft.worksheetCount
   &&draft.records.length<=1000,"عدد سجلات غير مطابق");
  assert(draft.safeToDrive===null&&draft.alternativeRouteApproved===false
   &&draft.operationalWarningApproved===false&&draft.hydrologicFloodRisk==="NOT_EVALUATED"
   &&draft.independentlyVerifiedEvidenceCount===0,"الملف يحتوي ادعاء اعتماد غير مسموح");
  const ids=new Set(),sites=new Set();
  const rows=draft.records.map(r=>{
   assert(r&&typeof r.recordId==="string"&&r.recordId.length<200&&!ids.has(r.recordId)
    &&typeof r.siteId==="string"&&r.siteId.length<100,"معرف غير صالح أو مكرر");
   ids.add(r.recordId);sites.add(r.siteId);
   assert(r.evidence&&typeof r.evidence==="object"&&!Array.isArray(r.evidence),"دليل غير صالح");
   assert(Object.keys(r.evidence).length===FIELDS.length
    &&Object.keys(r.evidence).every(k=>FIELDS.includes(k)),"حقول الأدلة غير متطابقة");
   assert(r.fieldVerification==="NOT_AUTHENTICATED"&&r.independentReview==="NOT_PERFORMED"
    &&r.bridgeCulvertApproved===false&&r.roadWadiCrossingVerified===false
    &&r.floodRisk==="NOT_EVALUATED"&&r.safeToDrive===null,"حالة اعتماد غير مسموحة");
   // Validate the same types, dates, measurements, and field bounds as the editor.
   assert(h12&&typeof h12.normalize==="function","مكتبة التحقق غير متاحة");
   const e=h12.normalize(r.evidence);
   const entered=FIELDS.some(f=>e[f]!=="");
   assert(r.entryStatus===(entered?"DRAFT_ENTERED_NOT_VERIFIED":"NOT_ENTERED"),
    "حالة الإدخال لا تطابق البيانات");
   const missing=[];
   const required=["observedStructureType","observedCrossing","observationDate","organization","photoReference"];
   if(e.observedStructureType==="culvert")required.push("culvertWidthMeters","culvertHeightMeters","culvertOpeningCount");
   if(e.observedStructureType==="bridge")required.push("bridgeSurveyReference");
   for(const field of required)if(!e[field])missing.push(field);
   // A report with no observed structure is not a completed engineered survey.
   // Completeness refers ONLY to the presence of chosen fields, not truth or sufficiency.
   return {recordId:r.recordId,siteId:r.siteId,entryStatus:r.entryStatus,
    category:!entered?"NO_INPUT":missing.length?"MISSING_FIELDS":"FIELDS_PRESENT_UNVERIFIED",
    present:required.length-missing.length,total:required.length,missing,notesPresent:Boolean(e.notes),
    referencePresent:Boolean(e.authorityInventoryReference),
    officialClosurePresent:Boolean(e.officialClosureReference)};
  });
  assert(draft.enteredDraftCount===rows.filter(r=>r.entryStatus!=="NOT_ENTERED").length,
   "عدد الإدخالات غير متطابق");
  assert(draft.siteCount===sites.size,"عدد المواقع غير متطابق");
  const tally=(category)=>rows.filter(r=>r.category===category).length;
  return {reportType:"RAINGUARD_HYDROLOGY14_LOCAL_COMPLETENESS_CHECK",
   status:"RESEARCH_COMPLETENESS_ONLY_NOT_VERIFIED",
   siteCount:sites.size,worksheetCount:rows.length,enteredCount:rows.length-tally("NO_INPUT"),
   noInput:tally("NO_INPUT"),missingFields:tally("MISSING_FIELDS"),
   fieldsPresentUnverified:tally("FIELDS_PRESENT_UNVERIFIED"),
   verifiedEvidenceCount:0,safeToDrive:null,roadWarningApproved:false,
   limitations:"Field presence is not engineering verification, independent review, capacity or flood risk assessment.",
   rows};
 }
 function tsv(report){
  const header=["recordId","siteId","category","present","total","missingFields",
   "entryStatus","notesPresent","referencePresent","officialClosurePresent"];
  const lines=[header.join("\t")];
  for(const r of report.rows){
   const values=[r.recordId,r.siteId,r.category,r.present,r.total,r.missing.join("; "),
    r.entryStatus,r.notesPresent,r.referencePresent,r.officialClosurePresent];
   lines.push(values.map(v=>{let x=String(v??"").replace(/[\t\r\n]/g," ");
    return /^\s*[=+@-]/.test(x)?"'"+x:x;}).join("\t"));
  }
  const content=lines.join("\r\n")+"\r\n";
  const out=new Uint8Array(2+2*content.length);out[0]=255;out[1]=254;
  for(let i=0;i<content.length;i++){const c=content.charCodeAt(i);out[2+i*2]=c&255;out[3+i*2]=c>>8;}
  return out;
 }
 function bind(doc){
  const input=doc.getElementById("draftFile"),status=doc.getElementById("status");
  const body=doc.getElementById("resultsBody"),summary=doc.getElementById("summary");
  const dl=doc.getElementById("download"),filter=doc.getElementById("filter");
  let report=null;
  function display(){
   body.replaceChildren();
   if(!report)return;
   const matched=report.rows.filter(r=>filter.value==="ALL"||r.category===filter.value);
   for(const r of matched){
    const tr=doc.createElement("tr");
    const values=[r.recordId,r.siteId,r.category,r.present+"/"+r.total,
     r.missing.map(k=>LABELS[k]).join("، ")||"—",r.notesPresent?"نعم":"لا"];
    for(const value of values){const td=doc.createElement("td");td.textContent=value;tr.append(td);}
    body.append(tr);
   }
   summary.textContent="السجلات: "+report.worksheetCount+" | بلا إدخال: "+report.noInput+
    " | تحتاج حقولًا: "+report.missingFields+" | حقول موجودة ولكن غير معتمدة: "+
    report.fieldsPresentUnverified+" | نتائج ظاهرة: "+matched.length;
  }
  input.addEventListener("change",async()=>{
   report=null;dl.disabled=true;body.replaceChildren();summary.textContent="";
   const file=input.files?.[0];
   if(!file){status.textContent="لم يتم اختيار ملف";return;}
   if(file.size<1||file.size>MAX_FILE){status.textContent="حجم الملف غير مسموح";return;}
   try{
    const obj=JSON.parse(await file.text());const checked=review(obj);
    report=checked;dl.disabled=false;display();
    status.textContent="تم فحص ملف JSON محليًا؛ النتائج تفحص وجود الحقول فقط ولا تعتمد أي دليل.";
   }catch(e){status.textContent="تعذر فحص الملف: "+String(e.message||e).slice(0,160);}
  });
  filter.addEventListener("change",display);
  dl.addEventListener("click",()=>{
   if(!report)return;
   const b=new Blob([tsv(report)],{type:"text/tab-separated-values;charset=utf-16le"});
   const u=URL.createObjectURL(b);const a=doc.createElement("a");a.href=u;
   a.download="rainguard_hydrology14_completeness.tsv";doc.body.append(a);a.click();a.remove();
   setTimeout(()=>URL.revokeObjectURL(u),1000);
  });
 }
 return {review,tsv,bind,FIELDS,LABELS};
});
