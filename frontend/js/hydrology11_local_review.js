/* Hydrology-11. Browser-only offline renderer. Never transmits user file contents. */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root && root.document) {
    root.RainGuardHydrology11 = api;
    root.document.addEventListener("DOMContentLoaded", () => api.bind(root.document));
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const STATUS = "FIELD_REVIEW_PACKAGE_ONLY_NOT_INSPECTED";
  const TYPES = new Set(["MAPPED_ROAD_BRIDGE", "MAPPED_WATERWAY_CULVERT",
    "MAPPED_BRIDGE_OUTLINE_OR_POINT", "MAPPED_WATERWAY_CULVERT_TAG",
    "NO_OSM_MATCH_IN_SNAPSHOT"]);
  const MAX_FILE_BYTES = 3 * 1024 * 1024;
  const REF = /^(way|node)\/([1-9][0-9]*)$/;
  const SITE = /^RG-HYDRO-REVIEW-[0-9]{3}$/;
  const REQUIRED_BLANK = ["actualStructureTypeObserved", "actualRoadWadiCrossingObserved",
    "fieldVisitDateUtc", "inspectorOrganization", "inspectorName", "photoReference",
    "photoTakenAtUtc", "locationSurveyReference", "culvertOpeningWidthMeters",
    "culvertOpeningHeightMeters", "culvertCount", "bridgeDeckSurveyReference",
    "roadAuthorityInventoryReference", "officialClosureRecordReference",
    "independentReviewReference", "reviewNotes"];
  function assert(condition, message) { if (!condition) throw Error(message); }
  function finiteBounded(v, low, high) {
    return typeof v === "number" && Number.isFinite(v) && v >= low && v <= high;
  }
  function validate(input) {
    assert(input && typeof input === "object" && !Array.isArray(input), "ملف JSON غير صالح");
    assert(input.reportType === "RAINGUARD_HYDROLOGY10_FIELD_REVIEW_PACKAGE"
      && input.status === STATUS, "هذا الملف ليس تقرير Hydrology-10 الأصلي");
    assert(input.safeToDrive === null && input.alternativeRouteApproved === false
      && input.operationalWarningApproved === false
      && input.hydrologicFloodRisk === "NOT_EVALUATED"
      && input.completedFieldVisitCount === 0 && input.independentReviewCount === 0
      && input.verifiedPhysicalCrossingCount === 0 && input.verifiedBridgeCulvertCount === 0,
      "يحتوي التقرير على حالة اعتماد غير مدعومة");
    assert(Number.isInteger(input.siteCount) && input.siteCount >= 1 && input.siteCount <= 300
      && Number.isInteger(input.inspectionWorksheetCount)
      && Number.isInteger(input.sourceCandidateMatchCount)
      && Array.isArray(input.worksheets) && input.worksheets.length === input.inspectionWorksheetCount
      && input.worksheets.length <= 2000, "عدد السجلات غير صحيح");
    const ids = new Set(), sites = new Map();
    let candidates = 0;
    const rows = input.worksheets.map(w => {
      assert(w && typeof w === "object" && SITE.test(w.siteId)
        && typeof w.recordId === "string" && w.recordId.length < 150
        && !ids.has(w.recordId), "معرّف سجل مكرر أو غير صحيح");
      ids.add(w.recordId);
      assert(finiteBounded(w.latitude,20,22.5) && finiteBounded(w.longitude,38,40.5),
        "إحداثيات الموقع غير صالحة");
      if (sites.has(w.siteId)) {
        const other = sites.get(w.siteId);
        assert(Math.abs(other[0]-w.latitude)<0.000001 && Math.abs(other[1]-w.longitude)<0.000001,
          "إحداثيات متضاربة لنفس الموقع");
      } else sites.set(w.siteId, [w.latitude, w.longitude]);
      const element = w.osmElement || "";
      const match = REF.exec(element);
      const expectedRecordId = w.siteId + "-" + (element ? element.replace("/", "-") : "NO_OSM_MATCH");
      assert(w.recordId === expectedRecordId, "معرّف سجل غير متوافق مع بيانات الموقع");
      assert((!element && w.osmUrl === "" && w.mappedFeatureType === "NO_OSM_MATCH_IN_SNAPSHOT")
        || (match && w.osmUrl === "https://www.openstreetmap.org/" + element
          && TYPES.has(w.mappedFeatureType) && w.mappedFeatureType !== "NO_OSM_MATCH_IN_SNAPSHOT"),
        "رابط OSM أو نوع المرشح غير صالح");
      assert(w.siteInspectionStatus === "NOT_PERFORMED"
        && w.independentEvidenceAuthentication === "NOT_PERFORMED"
        && w.safeToDrive === null && w.floodRisk === "NOT_EVALUATED",
        "سجل يتضمن اعتمادًا أو معاينة غير موثقة");
      REQUIRED_BLANK.forEach(k => assert(w[k] === "", "حقل مراجعة غير فارغ: " + k));
      if (element) {
        candidates++;
        assert(finiteBounded(w.distanceToResearchRouteMeters,0,100000)
          && finiteBounded(w.distanceToCandidateHydroRiverMeters,0,100000),
          "مسافة هندسية غير صالحة");
      } else {
        assert(w.distanceToResearchRouteMeters === null
          && w.distanceToCandidateHydroRiverMeters === null, "بيانات مرشح مفقود غير متسقة");
      }
      return {
        id:w.recordId, siteId:w.siteId, lat:w.latitude, lon:w.longitude,
        type:w.mappedFeatureType, osmElement:element, osmUrl:w.osmUrl,
        routeDistance:w.distanceToResearchRouteMeters, riverDistance:w.distanceToCandidateHydroRiverMeters,
        geometryContext:w.geometryContext
      };
    });
    assert(sites.size === input.siteCount && candidates === input.sourceCandidateMatchCount,
      "عدد المواقع أو المرشحات لا يطابق التقرير");
    const unmatched = rows.filter(w=>!w.osmElement).map(w=>w.siteId);
    assert(new Set(unmatched).size===unmatched.length
      && unmatched.every(s=>rows.filter(w=>w.siteId===s).length===1),
      "يوجد سجل فارغ إلى جانب مرشحات لنفس الموقع");
    return {
      status:STATUS, siteCount:sites.size, candidateCount:candidates,
      worksheetCount:rows.length, unmatchedSiteCount:unmatched.length,
      rows:rows.sort((a,b)=>a.siteId.localeCompare(b.siteId)||a.id.localeCompare(b.id))
    };
  }

  function textElement(doc, tag, content, className) {
    const el = doc.createElement(tag);
    if (className) el.className=className;
    el.textContent = String(content);
    return el;
  }
  function render(doc, report, siteFilter, kindFilter) {
    const stats = doc.getElementById("stats");
    const root = doc.getElementById("reviewRows");
    const status = doc.getElementById("tableStatus");
    stats.replaceChildren();
    [
      ["مواقع الدراسة",report.siteCount],
      ["مطابقات الخرائط",report.candidateCount],
      ["نماذج المراجعة",report.worksheetCount],
      ["المعاينات المعتمدة","0"],
    ].forEach(([label,value])=>{
      const tile=textElement(doc,"div","","metric");
      tile.append(textElement(doc,"small",label),textElement(doc,"strong",value));
      stats.append(tile);
    });
    const rows=report.rows.filter(x=>(!siteFilter||x.siteId===siteFilter)
      && (kindFilter==="all"||(kindFilter==="mapped"&&x.osmElement)
        ||(kindFilter==="unmapped"&&!x.osmElement)));
    for (const row of rows) {
      const tr=doc.createElement("tr");
      tr.append(textElement(doc,"td",row.siteId));
      const linkCell=doc.createElement("td");
      if (row.osmElement) {
        const a=textElement(doc,"a",row.osmElement);
        a.href=row.osmUrl;
        a.target="_blank";
        a.rel="noopener noreferrer";
        linkCell.append(a);
      } else linkCell.append(textElement(doc,"span","لا يوجد مرشح في لقطة OSM"));
      tr.append(linkCell);
      tr.append(textElement(doc,"td",row.type));
      tr.append(textElement(doc,"td",row.routeDistance===null?"—":row.routeDistance+" م"));
      tr.append(textElement(doc,"td",row.riverDistance===null?"—":row.riverDistance+" م"));
      tr.append(textElement(doc,"td","لم تتم المعاينة"));
      root.append(tr);
    }
    status.textContent="عدد السجلات الظاهرة: "+rows.length+" — لا توجد منشآت أو طرق معتمدة";
  }

  function bind(doc) {
    const fileInput=doc.getElementById("reviewFile");
    const status=doc.getElementById("fileStatus");
    const site=doc.getElementById("siteFilter");
    const kind=doc.getElementById("kindFilter");
    const tbody=doc.getElementById("reviewRows");
    let report=null;
    const redraw=()=>{
      tbody.replaceChildren();
      if (report)render(doc,report,site.value,kind.value);
    };
    site.addEventListener("change",redraw);
    kind.addEventListener("change",redraw);
    fileInput.addEventListener("change",async()=>{
      report=null;tbody.replaceChildren();doc.getElementById("stats").replaceChildren();
      site.replaceChildren(textElement(doc,"option","كل المواقع"));
      site.options[0].value="";
      site.disabled=true;
      kind.value="all";
      const f=fileInput.files && fileInput.files[0];
      if (!f) {status.textContent="لم يُحدد ملف.";return;}
      if (f.size<1||f.size>MAX_FILE_BYTES){status.textContent="حجم الملف خارج الحد المسموح (3 ميجابايت).";return;}
      try {
        const parsed=validate(JSON.parse(await f.text()));
        report=parsed;
        [...new Set(report.rows.map(x=>x.siteId))].forEach(s=>{
          const opt=textElement(doc,"option",s);opt.value=s;site.append(opt);
        });
        site.disabled=false;
        status.textContent="تم تحميل التقرير محليًا: "+report.siteCount+" مواقع، "
          +report.candidateCount+" مطابقة، "+report.worksheetCount+" سجلًا. لم تُرفع البيانات إلى الخادم.";
        redraw();
      } catch (e) {
        status.textContent="تعذّر قبول التقرير: "+String(e.message||e).slice(0,160);
        doc.getElementById("tableStatus").textContent="لم تُحمّل بيانات صالحة";
      }
    });
  }
  return {validate,bind,render,STATUS};
});
