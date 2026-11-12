"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const h12=require("../frontend/js/hydrology12_evidence_drafts.js");
const h13=require("../frontend/js/hydrology13_resume_drafts.js");
function source(){
  return {siteCount:2,candidateCount:1,rows:[
    {id:"RG-HYDRO-REVIEW-001-way-123",siteId:"RG-HYDRO-REVIEW-001",
     osmElement:"way/123",osmUrl:"https://www.openstreetmap.org/way/123",
     lat:21.5,lon:39.4,type:"MAPPED_ROAD_BRIDGE",routeDistance:0,riverDistance:2},
    {id:"RG-HYDRO-REVIEW-002-NO_OSM_MATCH",siteId:"RG-HYDRO-REVIEW-002",
     osmElement:"",osmUrl:"",lat:21.45,lon:39.48,
     type:"NO_OSM_MATCH_IN_SNAPSHOT",routeDistance:null,riverDistance:null}
  ]};
}
function draft(){
 const s=source();return h12.buildDraft(s,{[s.rows[0].id]:{
  notes:"تجربة اختبار حفظ المسودة — لم تتم معاينة ميدانية",
  photoReference:"photo001.jpg",organization:"Research - unverified"
 }});
}
test("imports exported JSON and roundtrips evidence without operational approval",()=>{
 const s=source(),d=draft();
 const restored=h13.restore(s,JSON.parse(JSON.stringify(d)));
 const again=h12.buildDraft(s,restored);
 assert.deepEqual(again.records,d.records);
 assert.equal(again.enteredDraftCount,1);
 assert.equal(again.safeToDrive,null);
 assert.equal(again.independentlyVerifiedEvidenceCount,0);
 assert.equal(again.records[0].fieldVerification,"NOT_AUTHENTICATED");
});
test("rejects altered mapped way, site, coordinates, or missing/duplicate records",()=>{
 for (const mutate of [
   d=>d.records[0].osmElement="way/456",
   d=>d.records[0].latitude=21.7,
   d=>d.records[0].siteId="RG-HYDRO-REVIEW-099",
   d=>d.records.pop(),
   d=>d.records[1].recordId=d.records[0].recordId,
   d=>d.sourceCandidateCount=10,
   d=>d.enteredDraftCount=2,
 ]){
   const d=draft();mutate(d);assert.throws(()=>h13.restore(source(),d));
 }
});
test("rejects attempts to certify fieldwork or inject extra approval fields",()=>{
 for(const mutate of [
   d=>d.safeToDrive=true,
   d=>d.hydrologicFloodRisk="LOW",
   d=>d.operationalWarningApproved=true,
   d=>d.records[0].fieldVerification="VERIFIED",
   d=>d.records[0].independentReview="APPROVED",
   d=>d.records[0].entryStatus="VERIFIED",
   d=>d.records[0].evidence.safeToDrive=true,
   d=>d.records[0].evidence.observationDate="2026-02-30",
 ]){
  const d=draft();mutate(d);assert.throws(()=>h13.restore(source(),d));
 }
});
test("Excel TSV emits UTF16LE BOM, 21-column-style headers, and Arabic evidence",()=>{
 const d=draft();const b=h13.excelTSV(d);
 assert.equal(b[0],255);assert.equal(b[1],254);
 const text=Buffer.from(b).subarray(2).toString("utf16le");
 const lines=text.trimEnd().split("\r\n");
 assert.equal(lines.length,3);
 assert.equal(lines[0].split("\t").length,20);
 assert.equal(lines[1].split("\t").length,20);
 assert.match(text,/تجربة اختبار حفظ المسودة/);
});
test("Excel TSV neutralizes formulas and newlines within cells",()=>{
 const s=source(),id=s.rows[0].id;
 const d=h12.buildDraft(s,{[id]:{notes:"=HYPERLINK(\"evil\")\nsecond line",
   organization:"  +SUM(A1:A2)"}});
 const b=h13.excelTSV(d);
 const content=Buffer.from(b).subarray(2).toString("utf16le");
 assert.match(content,/'=HYPERLINK/);
 assert.match(content,/'\\+SUM/);
 assert.equal(content.split("\r\n").filter(Boolean).length,3);
 assert.equal(content.split("\r\n")[1].split("\t").length,20);
});
