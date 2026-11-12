/* Hydrology-14 — offline, conservative evidence-completeness audit.
 * Accepts Hydrology-12/13 JSON draft exports, NEVER TSV/Excel.
 * An entered reference is NOT authenticated, and completeness is NOT safety.
 */
(function(root,factory){
  "use strict";
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  if(root&&root.document)root.RainGuardHydrology14=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";
  const MAX_RECORDS=3000;
  const EVIDENCE_FIELDS=[
    "observedStructureType","observedCrossing","observationDate",
    "organization","photoReference","surveyReference",
    "culvertWidthMeters","culvertHeightMeters","culvertOpeningCount",
    "bridgeSurveyReference","authorityInventoryReference",
    "officialClosureReference","notes"
  ];
  const REQUIREMENTS={
    observation:["observedStructureType","observedCrossing","observationDate","organization"],
    siteEvidence:["photoReference","surveyReference"],
    authorityReferences:["authorityInventoryReference","officialClosureReference"]
  };
  function assert(ok,message){if(!ok)throw new Error(message);}
  function cleanValue(v){return typeof v==="string"?v.trim():"";}
  function audit(draft){
    assert(draft&&typeof draft==="object"&&!Array.isArray(draft),"INVALID_DOCUMENT");
    assert(draft.reportType==="RAINGUARD_HYDROLOGY12_LOCAL_EVIDENCE_DRAFT" &&
      draft.status==="LOCAL_EVIDENCE_DRAFT_NOT_AUTHENTICATED","UNSUPPORTED_OR_APPROVED_SOURCE");
    assert(Array.isArray(draft.records)&&draft.records.length>0 &&
      draft.records.length<=MAX_RECORDS,"INVALID_RECORD_COUNT");
    assert(draft.worksheetCount===draft.records.length &&
      draft.independentlyVerifiedEvidenceCount===0 &&
      draft.safeToDrive===null &&
      draft.alternativeRouteApproved===false &&
      draft.operationalWarningApproved===false &&
      draft.hydrologicFloodRisk==="NOT_EVALUATED","UNSAFE_OR_INCONSISTENT_SUMMARY");
    const ids=new Set();
    const rows=draft.records.map(r=>{
      assert(r&&typeof r==="object"&&typeof r.recordId==="string" &&
        r.recordId.length>0&&!ids.has(r.recordId),"INVALID_OR_DUPLICATE_RECORD");
      ids.add(r.recordId);
      assert(typeof r.siteId==="string" &&
        /^RG-HYDRO-REVIEW-[0-9]{3}$/.test(r.siteId),"INVALID_SITE");
      assert(r.fieldVerification==="NOT_AUTHENTICATED" &&
        r.independentReview==="NOT_PERFORMED" &&
        r.bridgeCulvertApproved===false &&
        r.roadWadiCrossingVerified===false &&
        r.floodRisk==="NOT_EVALUATED" && r.safeToDrive===null,
        "UNSAFE_RECORD_STATUS");
      assert(r.evidence&&typeof r.evidence==="object"&&!Array.isArray(r.evidence) &&
        Object.keys(r.evidence).length===EVIDENCE_FIELDS.length &&
        EVIDENCE_FIELDS.every(f=>typeof r.evidence[f]==="string"),
        "INVALID_EVIDENCE_SHAPE");
      const e=r.evidence, missing=[], present=[];
      Object.entries(REQUIREMENTS).forEach(([group,fields])=>{
        fields.forEach(f=>(cleanValue(e[f])?present:missing).push(group+":"+f));
      });
      if(e.observedStructureType==="culvert"){
        ["culvertWidthMeters","culvertHeightMeters","culvertOpeningCount"]
          .forEach(f=>(cleanValue(e[f])?present:missing).push("culvertDimensions:"+f));
      }
      if(e.observedStructureType==="bridge"){
        (cleanValue(e.bridgeSurveyReference)?present:missing).push("bridgeSurvey:bridgeSurveyReference");
      }
      const entered=EVIDENCE_FIELDS.some(f=>Boolean(cleanValue(e[f])));
      assert(r.entryStatus===(entered?"DRAFT_ENTERED_NOT_VERIFIED":"NOT_ENTERED"),
        "INCONSISTENT_ENTRY_STATUS");
      return {recordId:r.recordId,siteId:r.siteId,osmElement:r.osmElement||"",
        entryStatus:r.entryStatus,
        completeness:missing.length===0?"FIELDS_PRESENT_UNVERIFIED":"MISSING_FIELDS",
        presentFields:present,missingFields:missing,
        fieldVerification:"NOT_AUTHENTICATED",
        independentReview:"NOT_PERFORMED",floodRisk:"NOT_EVALUATED",safeToDrive:null};
    });
    assert(draft.enteredDraftCount===rows.filter(x=>x.entryStatus==="DRAFT_ENTERED_NOT_VERIFIED").length,
      "INCONSISTENT_ENTERED_COUNT");
    return {
      reportType:"RAINGUARD_HYDROLOGY14_COMPLETENESS_AUDIT",
      status:"RESEARCH_ONLY_NOT_AUTHENTICATED",
      recordsAudited:rows.length,
      recordsWithAllRequiredFields:rows.filter(x=>x.missingFields.length===0).length,
      recordsMissingFields:rows.filter(x=>x.missingFields.length>0).length,
      independentlyVerifiedEvidenceCount:0,
      safeToDrive:null,alternativeRouteApproved:false,
      operationalWarningApproved:false,hydrologicFloodRisk:"NOT_EVALUATED",
      limitations:"Field presence alone never authenticates evidence, engineering capacity, flood risk or route safety.",
      records:rows
    };
  }
  return {audit,REQUIREMENTS};
});
