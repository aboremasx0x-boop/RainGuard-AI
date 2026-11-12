"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const h12=require("../frontend/js/hydrology12_evidence_drafts.js");
const h14=require("../frontend/js/hydrology14_completeness.js");
function source(){
 return {siteCount:2,candidateCount:1,rows:[
 {id:"RG-HYDRO-REVIEW-001-way-123",siteId:"RG-HYDRO-REVIEW-001",osmElement:"way/123",osmUrl:"https://www.openstreetmap.org/way/123",
 lat:21.5,lon:39.4,type:"MAPPED_ROAD_BRIDGE",routeDistance:0,riverDistance:2},
 {id:"RG-HYDRO-REVIEW-002-NO_OSM_MATCH",siteId:"RG-HYDRO-REVIEW-002",osmElement:"",osmUrl:"",
 lat:21.6,lon:39.5,type:"NO_OSM_MATCH_IN_SNAPSHOT",routeDistance:null,riverDistance:null}
 ]};
}
test("21-style draft inventory is local and unauthenticated; blank rows distinguished",()=>{
 const d=h12.buildDraft(source(),{});
 const r=h14.review(d);
 assert.equal(r.worksheetCount,2);
 assert.equal(r.noInput,2);
 assert.equal(r.fieldsPresentUnverified,0);
 assert.equal(r.verifiedEvidenceCount,0);
 assert.equal(r.safeToDrive,null);
 assert.equal(r.rows[0].category,"NO_INPUT");
});
test("identifies typed missing fields; notes alone do not imply survey complete",()=>{
 const s=source();const d=h12.buildDraft(s,{[s.rows[0].id]:{notes:"تجربة اختبار حفظ المسودة — لم تتم معاينة ميدانية"}});
 const r=h14.review(d);
 assert.equal(r.enteredCount,1);
 assert.equal(r.missingFields,1);
 assert.equal(r.noInput,1);
 assert.equal(r.rows[0].notesPresent,true);
 assert.deepEqual(r.rows[0].missing,["observedStructureType","observedCrossing","observationDate","organization","photoReference"]);
});
test("bridge and culvert require conditional references or dimensions",()=>{
 const s=source(),id=s.rows[0].id;
 const common={observedCrossing:"yes_observed",observationDate:"2026-11-12",
 organization:"unverified sample",photoReference:"reference.jpg"};
 const bridge=h14.review(h12.buildDraft(s,{[id]:{...common,observedStructureType:"bridge"}}));
 assert.deepEqual(bridge.rows[0].missing,["bridgeSurveyReference"]);
 const culvert=h14.review(h12.buildDraft(s,{[id]:{...common,observedStructureType:"culvert",culvertWidthMeters:"2"}}));
 assert.deepEqual(culvert.rows[0].missing,["culvertHeightMeters","culvertOpeningCount"]);
 const filled=h14.review(h12.buildDraft(s,{[id]:{...common,observedStructureType:"bridge",bridgeSurveyReference:"survey1"}}));
 assert.equal(filled.rows[0].category,"FIELDS_PRESENT_UNVERIFIED");
 assert.equal(filled.verifiedEvidenceCount,0);
});
test("rejects forged approvals and tampered record entry statuses",()=>{
 const s=source();
 for(const mutate of [
 d=>d.safeToDrive=true,
 d=>d.independentlyVerifiedEvidenceCount=1,
 d=>d.records[0].fieldVerification="VERIFIED",
 d=>d.records[0].safeToDrive=true,
 d=>d.records[0].entryStatus="DRAFT_ENTERED_NOT_VERIFIED",
 d=>d.records[1].recordId=d.records[0].recordId,
 d=>d.records[1].evidence.untrustedFlag="yes",
 d=>d.records[0].evidence.observationDate="2026-02-30",
 ]){
  const d=h12.buildDraft(s,{});mutate(d);assert.throws(()=>h14.review(d));
 }
});
test("Arabic Excel TSV has 6 rows of columns and UTF16LE BOM, cannot execute formulas",()=>{
 const s=source();const d=h12.buildDraft(s,{[s.rows[0].id]:{notes:"=INJECT('a')",organization:"+SUM(A1)" }});
 const r=h14.review(d);
 const buf=h14.tsv(r);
 assert.equal(buf[0],255);assert.equal(buf[1],254);
 const str=Buffer.from(buf).subarray(2).toString("utf16le");
 assert.equal(str.split("\r\n").filter(Boolean).length,3);
 assert.equal(str.split("\r\n")[0].split("\t").length,10);
 assert.equal(str.split("\r\n")[1].split("\t").length,10);
 assert.match(str,/observedStructureType/);
});
