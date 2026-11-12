/* Hydrology-13: fail-closed local draft re-import and Excel-friendly TSV. */
(function(root,factory){
  "use strict";
  const dependency=(root&&root.RainGuardHydrology12)||
    (typeof module==="object"&&module.exports ? require("./hydrology12_evidence_drafts.js") : null);
  const api=factory(dependency);
  if(typeof module==="object"&&module.exports)module.exports=api;
  if(root&&root.document)root.RainGuardHydrology13=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(h12){
  "use strict";
  const STATUS="LOCAL_EVIDENCE_DRAFT_NOT_AUTHENTICATED";
  const FIELDS=["observedStructureType","observedCrossing","observationDate",
    "organization","photoReference","surveyReference","culvertWidthMeters",
    "culvertHeightMeters","culvertOpeningCount","bridgeSurveyReference",
    "authorityInventoryReference","officialClosureReference","notes"];
  function check(ok,msg){if(!ok)throw new Error(msg);}
  function equal(a,b){return a===b;}
  function restore(source,draft){
    check(source&&Array.isArray(source.rows)&&h12&&typeof h12.buildDraft==="function","الملف الأصلي غير محمّل");
    check(draft&&typeof draft==="object"&&!Array.isArray(draft),"مسودة JSON غير صحيحة");
    check(draft.reportType==="RAINGUARD_HYDROLOGY12_LOCAL_EVIDENCE_DRAFT"&&draft.status===STATUS
      &&draft.sourceReportType==="RAINGUARD_HYDROLOGY10_FIELD_REVIEW_PACKAGE","نوع المسودة غير مدعوم");
    const required={siteCount:source.siteCount,sourceCandidateCount:source.candidateCount,
      worksheetCount:source.rows.length,independentlyVerifiedEvidenceCount:0,
      safeToDrive:null,alternativeRouteApproved:false,operationalWarningApproved:false,
      hydrologicFloodRisk:"NOT_EVALUATED"};
    for(const [k,v] of Object.entries(required))
      check(Object.prototype.hasOwnProperty.call(draft,k)&&equal(draft[k],v),"عدم تطابق أو اعتماد غير موثق: "+k);
    check(Array.isArray(draft.records)&&draft.records.length===source.rows.length,"عدد سجلات المسودة مختلف");
    check(Number.isInteger(draft.enteredDraftCount)&&draft.enteredDraftCount>=0
      &&draft.enteredDraftCount<=source.rows.length,"عدد المسودات المدخلة غير صالح");
    const records=new Map();
    for(const r of draft.records){
      check(r&&typeof r==="object"&&typeof r.recordId==="string"&&!records.has(r.recordId),
        "سجل مكرر أو مفقود");
      records.set(r.recordId,r);
    }
    check(records.size===source.rows.length,"سجلات المسودة غير مكتملة");
    const changes=Object.create(null);
    for(const original of source.rows){
      const r=records.get(original.id);
      check(r&&r.recordId===original.id&&r.siteId===original.siteId
        &&r.osmElement===original.osmElement&&r.osmUrl===original.osmUrl
        &&r.latitude===original.lat&&r.longitude===original.lon
        &&r.mappedFeatureType===original.type
        &&r.approximateRouteDistanceMeters===original.routeDistance
        &&r.approximateRiverDistanceMeters===original.riverDistance,
        "مسودة لا تطابق سجل المصدر: "+original.id);
      check(r.fieldVerification==="NOT_AUTHENTICATED"
        &&r.independentReview==="NOT_PERFORMED"
        &&r.bridgeCulvertApproved===false&&r.roadWadiCrossingVerified===false
        &&r.safeToDrive===null&&r.floodRisk==="NOT_EVALUATED",
        "المسودة تحتوي ادعاء تحقق غير معتمد");
      check(r.evidence&&typeof r.evidence==="object"&&!Array.isArray(r.evidence)
        &&Object.keys(r.evidence).length===FIELDS.length
        &&Object.keys(r.evidence).every(k=>FIELDS.includes(k)),
        "حقول الأدلة غير متطابقة");
      const evidence=h12.normalize(r.evidence);
      const entered=FIELDS.some(k=>Boolean(evidence[k]));
      check(r.entryStatus===(entered?"DRAFT_ENTERED_NOT_VERIFIED":"NOT_ENTERED"),
        "حالة الإدخال غير مطابقة للبيانات");
      changes[original.id]=evidence;
    }
    const canonical=h12.buildDraft(source,changes);
    check(canonical.enteredDraftCount===draft.enteredDraftCount,
      "عدد الإدخالات لا يتطابق مع المحتوى");
    return changes;
  }
  function tsvCell(value){
    let v=String(value??"").replace(/[\t\r\n]+/g," ");
    // Treat the spreadsheet as potentially hostile input.
    if(/^[\s]*[=+\-@]/.test(v))v="'"+v;
    return v;
  }
  function excelTSV(draft){
    check(draft&&Array.isArray(draft.records),"مسودة غير صالحة");
    const headers=["recordId","siteId","osmElement","entryStatus",...FIELDS,
      "fieldVerification","independentReview","floodRisk"];
    const rows=[headers.join("\t")];
    for(const r of draft.records){
      rows.push(headers.map(k=>tsvCell(Object.prototype.hasOwnProperty.call(r,k)
        ?r[k]:(r.evidence[k]??""))).join("\t"));
    }
    const content=rows.join("\r\n")+"\r\n";
    // Excel on Windows recognizes UTF-16LE with BOM, tab separator, and Arabic text.
    const out=new Uint8Array(2+content.length*2);
    out[0]=255;out[1]=254;
    for(let i=0;i<content.length;i++){
      const u=content.charCodeAt(i);
      out[2+i*2]=u&255;out[3+i*2]=u>>8;
    }
    return out;
  }
  return {restore,excelTSV,STATUS};
});
