"use strict";
const assert=require("node:assert/strict");
const test=require("node:test");
const {validate}=require("../frontend/js/hydrology11_local_review.js");

function baseline() {
  const site="RG-HYDRO-REVIEW-001";
  const match="way/12345";
  const row={recordId:site+"-way-12345",siteId:site,osmElement:match,
    osmUrl:"https://www.openstreetmap.org/"+match,latitude:21.5,longitude:39.4,
    mappedFeatureType:"MAPPED_ROAD_BRIDGE",distanceToResearchRouteMeters:0,
    distanceToCandidateHydroRiverMeters:7.2,geometryContext:"MAP_LINES_NEARBY",
    actualStructureTypeObserved:"",actualRoadWadiCrossingObserved:"",
    fieldVisitDateUtc:"",inspectorOrganization:"",inspectorName:"",
    photoReference:"",photoTakenAtUtc:"",locationSurveyReference:"",
    culvertOpeningWidthMeters:"",culvertOpeningHeightMeters:"",culvertCount:"",
    bridgeDeckSurveyReference:"",roadAuthorityInventoryReference:"",
    officialClosureRecordReference:"",independentReviewReference:"",reviewNotes:"",
    siteInspectionStatus:"NOT_PERFORMED",independentEvidenceAuthentication:"NOT_PERFORMED",
    safeToDrive:null,floodRisk:"NOT_EVALUATED"};
  const unmatched={...row,recordId:"RG-HYDRO-REVIEW-002-NO_OSM_MATCH",
    siteId:"RG-HYDRO-REVIEW-002",osmElement:"",osmUrl:"",
    latitude:21.45,longitude:39.48,mappedFeatureType:"NO_OSM_MATCH_IN_SNAPSHOT",
    distanceToResearchRouteMeters:null,distanceToCandidateHydroRiverMeters:null};
  return {reportType:"RAINGUARD_HYDROLOGY10_FIELD_REVIEW_PACKAGE",
    status:"FIELD_REVIEW_PACKAGE_ONLY_NOT_INSPECTED",
    siteCount:2,sourceCandidateMatchCount:1,inspectionWorksheetCount:2,
    completedFieldVisitCount:0,independentReviewCount:0,verifiedPhysicalCrossingCount:0,
    verifiedBridgeCulvertCount:0,safeToDrive:null,alternativeRouteApproved:false,
    operationalWarningApproved:false,hydrologicFloodRisk:"NOT_EVALUATED",
    worksheets:[row,unmatched]};
}
test("reads expected mixed candidate and unmatched sample without approval",()=>{
  const v=validate(baseline());
  assert.equal(v.siteCount,2);assert.equal(v.candidateCount,1);
  assert.equal(v.worksheetCount,2);assert.equal(v.unmatchedSiteCount,1);
});
test("rejects self-approval, fabricated inspection and content in blank evidence",()=>{
  for (const [field,val] of [["safeToDrive",true],["completedFieldVisitCount",1],
     ["alternativeRouteApproved",true],["hydrologicFloodRisk","LOW"]]) {
    const x=baseline();x[field]=val;
    assert.throws(()=>validate(x));
  }
  const filled=baseline();filled.worksheets[0].photoReference="fake.jpg";
  assert.throws(()=>validate(filled));
});
test("rejects duplicate id, URL injection and unexpected site counts",()=>{
  const x=baseline();x.worksheets.push({...x.worksheets[0]});
  x.inspectionWorksheetCount=3;x.sourceCandidateMatchCount=2;
  assert.throws(()=>validate(x));
  const y=baseline();y.worksheets[0].osmUrl="javascript:alert(1)";
  assert.throws(()=>validate(y));
  const z=baseline();z.siteCount=5;
  assert.throws(()=>validate(z));
});
test("rejects inconsistent same-site coordinates or malformed values",()=>{
  const x=baseline();x.worksheets[1]={...x.worksheets[1],
    recordId:"RG-HYDRO-REVIEW-001-NO_OSM_MATCH",
    siteId:"RG-HYDRO-REVIEW-001",latitude:22.1};
  assert.throws(()=>validate(x));
  const y=baseline();y.worksheets[0].distanceToResearchRouteMeters=Infinity;
  assert.throws(()=>validate(y));
});
