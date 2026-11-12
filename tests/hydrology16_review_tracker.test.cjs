const {test}=require("node:test");const assert=require("node:assert/strict");
const mod=require("../frontend/js/hydrology16_review_tracker.js");
const ID="RG-HYDRO-REVIEW-001-way-240251214",SITE="RG-HYDRO-REVIEW-001";
const row=[ID,SITE,"NO_INPUT","0","5","observedStructureType; observedCrossing; observationDate; organization; photoReference","NOT_ENTERED","false","false","false"];
function body(...rows){return [mod.HEADERS.join("\t"),...rows.map(x=>x.join("\t"))].join("\r\n")+"\r\n";}
test("empty research row remains unverified and never safe",()=>{const out=mod.parse(body(row));assert.equal(out.counts.empty,1);assert.equal(out.verifiedCount,0);assert.equal(out.safeToDrive,null);assert.equal(out.records[0].followUpStatus,"AWAITING_INDEPENDENT_EVIDENCE");});
test("reject invalid statuses",()=>{const bad=[...row];bad[2]="APPROVED";assert.throws(()=>mod.parse(body(bad)));});
test("reject duplicate identifiers",()=>assert.throws(()=>mod.parse(body(row,row))));
test("reject mismatched missing fields",()=>{const bad=[...row];bad[5]="photoReference";assert.throws(()=>mod.parse(body(bad)));});
test("reject TSV with wrong header",()=>assert.throws(()=>mod.parse("bad\\tfile\\n")));
test("reject unsafe non-UTF16LE",()=>assert.throws(()=>mod.decode(new Uint8Array([123,125,10]).buffer)));
test("UTF16LE BOM is accepted",()=>{const text=body(row);const bytes=Buffer.from("\\ufeff"+text,"utf16le");assert.match(mod.decode(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)),/recordId/);});
