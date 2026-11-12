/* Hydrology-12: editable local research evidence DRAFTS; no server requests or localStorage. */
(function(root,factory){
  "use strict";
  const api=factory(root && root.RainGuardHydrology11);
  if(typeof module==="object"&&module.exports)module.exports=api;
  if(root&&root.document){
    root.RainGuardHydrology12=api;
    root.document.addEventListener("DOMContentLoaded",()=>api.bind(root.document));
  }
})(typeof globalThis!=="undefined"?globalThis:this,function(h11){
  "use strict";
  const MAX_FILE=3*1024*1024;
  const MAX_TEXT=500;
  const DRAFT_STATUS="LOCAL_EVIDENCE_DRAFT_NOT_AUTHENTICATED";
  const FIELDS=["observedStructureType","observedCrossing","observationDate",
    "organization","photoReference","surveyReference","culvertWidthMeters",
    "culvertHeightMeters","culvertOpeningCount","bridgeSurveyReference",
    "authorityInventoryReference","officialClosureReference","notes"];
  const TYPES=new Set(["","bridge","culvert","other","not_observed","unknown"]);
  const CROSSINGS=new Set(["","yes_observed","no_observed","unknown"]);
  const MAX_DIM=1000;
  function assert(ok,msg){if(!ok)throw Error(msg);}
  function cleanString(v,k,max=MAX_TEXT){
    assert(typeof v==="string"&&v.length<=max,"حقل غير صالح: "+k);
    assert(!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v),"رموز غير مسموحة: "+k);
    return v.trim();
  }
  function blank(){
    return Object.fromEntries(FIELDS.map(f=>[f,""]));
  }
  function normalize(values){
    assert(values&&typeof values==="object"&&!Array.isArray(values),"سجل أدلة غير صالح");
    const row={};
    for(const f of FIELDS){
      row[f]=cleanString(values[f]??"",f,f==="notes"?1000:MAX_TEXT);
    }
    assert(TYPES.has(row.observedStructureType),"نوع المنشأة غير صحيح");
    assert(CROSSINGS.has(row.observedCrossing),"حالة التقاطع غير صحيحة");
    if(row.observationDate){
      assert(/^\d{4}-\d{2}-\d{2}$/.test(row.observationDate)&&
        !Number.isNaN(Date.parse(row.observationDate+"T00:00:00Z")) &&
        new Date(row.observationDate+"T00:00:00Z").toISOString().slice(0,10)===row.observationDate,
        "تاريخ غير صالح");
    }
    for(const f of ["culvertWidthMeters","culvertHeightMeters","culvertOpeningCount"]){
      if(!row[f])continue;
      const n=Number(row[f]);
      assert(/^\d+(?:\.\d{1,3})?$/.test(row[f])&&Number.isFinite(n)&&n>0&&n<=MAX_DIM,
        "قياس غير صالح: "+f);
      if(f==="culvertOpeningCount")assert(Number.isInteger(n),"عدد الفتحات يجب أن يكون صحيحًا");
    }
    return row;
  }
  function buildDraft(validatedSource,changes){
    assert(validatedSource&&Array.isArray(validatedSource.rows),"تقرير مصدر غير محمّل");
    assert(changes&&typeof changes==="object"&&!Array.isArray(changes),"مسودة غير صالحة");
    const known=new Set(validatedSource.rows.map(x=>x.id));
    assert(Object.keys(changes).every(id=>known.has(id)),"معرّف سجل غير موجود في المصدر");
    const rows=validatedSource.rows.map(source=>{
      const entered=normalize(changes[source.id]||blank());
      return {recordId:source.id,siteId:source.siteId,
        osmElement:source.osmElement,osmUrl:source.osmUrl,
        latitude:source.lat,longitude:source.lon,
        mappedFeatureType:source.type,
        approximateRouteDistanceMeters:source.routeDistance,
        approximateRiverDistanceMeters:source.riverDistance,
        evidence:entered,
        entryStatus:Object.values(entered).some(Boolean)?"DRAFT_ENTERED_NOT_VERIFIED":"NOT_ENTERED",
        fieldVerification:"NOT_AUTHENTICATED",independentReview:"NOT_PERFORMED",
        bridgeCulvertApproved:false,roadWadiCrossingVerified:false,
        floodRisk:"NOT_EVALUATED",safeToDrive:null
      };
    });
    return {reportType:"RAINGUARD_HYDROLOGY12_LOCAL_EVIDENCE_DRAFT",
      status:DRAFT_STATUS,sourceReportType:"RAINGUARD_HYDROLOGY10_FIELD_REVIEW_PACKAGE",
      siteCount:validatedSource.siteCount,sourceCandidateCount:validatedSource.candidateCount,
      worksheetCount:rows.length,enteredDraftCount:rows.filter(x=>x.entryStatus==="DRAFT_ENTERED_NOT_VERIFIED").length,
      independentlyVerifiedEvidenceCount:0,
      safeToDrive:null,alternativeRouteApproved:false,operationalWarningApproved:false,
      hydrologicFloodRisk:"NOT_EVALUATED",records:rows,
      limitations:"Local input is an unverified claim, not authenticated official or engineering evidence. No road/flood safety decision."};
  }
  function csvSafe(value){
    const v=String(value??"");
    // Guard Excel formula injection, even after whitespace.
    const sanitized=/^[\s\u0000-\u0020]*[=+\-@]/.test(v)?"'"+v:v;
    return '"'+sanitized.replace(/"/g,'""')+'"';
  }
  function toCSV(draft){
    const headers=["recordId","siteId","osmElement","entryStatus",...FIELDS,
      "fieldVerification","independentReview","floodRisk"];
    const lines=[headers.map(csvSafe).join(",")];
    for(const r of draft.records){
      lines.push(headers.map(k=>csvSafe(Object.prototype.hasOwnProperty.call(r,k)?
        r[k]:(r.evidence[k]??""))).join(","));
    }
    return "\ufeff"+lines.join("\r\n")+"\r\n";
  }
  function text(doc,tag,value){
    const el=doc.createElement(tag);el.textContent=String(value);return el;
  }
  function bind(doc){
    const loader=doc.getElementById("baselineFile");
    const recordSelect=doc.getElementById("recordSelect");
    const loadStatus=doc.getElementById("loadStatus");
    const editStatus=doc.getElementById("editStatus");
    const exportJSON=doc.getElementById("exportJSON");
    const exportCSV=doc.getElementById("exportCSV");
    const resumeFile=doc.getElementById("resumeFile");
    const exportExcel=doc.getElementById("exportExcel");
    const resumeStatus=doc.getElementById("resumeStatus");
    const form=doc.getElementById("evidenceForm");
    let source=null;
    let changes=Object.create(null);
    let activeId="";
    function saveCurrent(){
      if(!source||!activeId)return;
      const entry={};
      for(const name of FIELDS)entry[name]=form.elements.namedItem(name).value;
      changes[activeId]=normalize(entry);
    }
    function showSelected(){
      const target=recordSelect.value;
      activeId=target;
      const row=source?.rows.find(x=>x.id===target);
      for(const name of FIELDS)form.elements.namedItem(name).value=
        (changes[target]||blank())[name];
      form.hidden=!row;
      const info=doc.getElementById("selectedInfo");
      info.textContent=row?row.siteId+" | "+(row.osmElement||"لا يوجد مرشح OSM")+" | لم تتم المصادقة":"";
    }
    function update(){
      if(!source)return;
      const report=buildDraft(source,changes);
      editStatus.textContent="مسودات بها إدخالات: "+report.enteredDraftCount+
        " من "+report.worksheetCount+" — لم تتم المصادقة على أي دليل.";
    }
    function download(content,type,filename){
      const blob=new Blob([content],{type});
      const url=URL.createObjectURL(blob);
      try{
        const a=doc.createElement("a");a.href=url;a.download=filename;
        doc.body.append(a);a.click();a.remove();
      }finally{
        // Revocation after download trigger, without any network access.
        setTimeout(()=>URL.revokeObjectURL(url),1000);
      }
    }
    loader.addEventListener("change",async()=>{
      source=null;changes=Object.create(null);activeId="";form.hidden=true;
      recordSelect.replaceChildren();recordSelect.disabled=true;
      exportJSON.disabled=true;exportCSV.disabled=true;
      if(resumeFile){resumeFile.disabled=true;resumeFile.value="";}
      if(exportExcel)exportExcel.disabled=true;
      if(resumeStatus)resumeStatus.textContent="حمّل التقرير الأصلي أولًا.";
      const f=loader.files?.[0];
      if(!f){loadStatus.textContent="لم يتم اختيار ملف";return;}
      if(f.size<1||f.size>MAX_FILE){loadStatus.textContent="حجم الملف غير مسموح";return;}
      try{
        assert(h11&&typeof h11.validate==="function","مكتبة التحقق غير متاحة");
        source=h11.validate(JSON.parse(await f.text()));
        for(const row of source.rows){
          const option=text(doc,"option",row.siteId+" — "+(row.osmElement||"بدون مطابقة"));
          option.value=row.id;recordSelect.append(option);
        }
        recordSelect.disabled=false;exportJSON.disabled=false;exportCSV.disabled=false;
        if(resumeFile)resumeFile.disabled=false;
        if(exportExcel)exportExcel.disabled=false;
        loadStatus.textContent="تم تحميل "+source.worksheetCount+" سجلًا من جهازك. لم تُرفع البيانات.";
        showSelected();update();
      }catch(error){
        source=null;
        loadStatus.textContent="الملف مرفوض: "+String(error.message||error).slice(0,160);
      }
    });
    if(resumeFile)resumeFile.addEventListener("change",async()=>{
      const f=resumeFile.files?.[0];
      if(!source||!f){if(resumeStatus)resumeStatus.textContent="اختر التقرير الأصلي ومسودة JSON.";return;}
      if(f.size<1||f.size>MAX_FILE){resumeStatus.textContent="حجم المسودة غير مسموح (3 ميجابايت).";return;}
      try{
        const h13=globalThis.RainGuardHydrology13;
        assert(h13&&typeof h13.restore==="function","مكتبة الاستعادة غير متاحة");
        // Save currently typed data first; a failed import must preserve it.
        saveCurrent();
        const parsed=JSON.parse(await f.text());
        const restored=h13.restore(source,parsed);
        changes=restored;
        showSelected();update();
        resumeStatus.textContent="تمت استعادة "+parsed.enteredDraftCount+
          " مسودة غير معتمدة من الملف المحلي. احفظ التغييرات بتصدير جديد.";
      }catch(e){resumeStatus.textContent="رُفضت المسودة دون استبدال البيانات الحالية: "+
        String(e.message||e).slice(0,180);}
    });
    if(exportExcel)exportExcel.addEventListener("click",()=>{
      try{
        assert(source,"يجب تحميل الملف الأصلي");
        saveCurrent();
        const h13=globalThis.RainGuardHydrology13;
        assert(h13&&typeof h13.excelTSV==="function","مكتبة Excel غير متاحة");
        const draft=buildDraft(source,changes);
        const stamp=new Date().toISOString().replace(/[:.]/g,"-");
        download(h13.excelTSV(draft),"text/tab-separated-values;charset=utf-16le",
          "rainguard_hydrology13_excel_"+stamp+".tsv");
        update();
        editStatus.textContent+=" تم تنزيل جدول Excel مفصول بعلامات تبويب، مع الاحتفاظ بنسخة JSON منفصلة للاستكمال.";
      }catch(e){editStatus.textContent="تعذر تصدير Excel: "+String(e.message||e).slice(0,160);}
    });
    recordSelect.addEventListener("change",()=>{
      try{saveCurrent();}catch(e){editStatus.textContent=e.message;return;}
      showSelected();update();
    });
    form.addEventListener("submit",event=>{
      event.preventDefault();
      try{saveCurrent();update();editStatus.textContent+=" تم تحديث المسودة داخل الذاكرة فقط. صدّر الملف للحفظ.";}
      catch(e){editStatus.textContent="تعذر حفظ الإدخال: "+e.message;}
    });
    function exported(kind){
      try{
        saveCurrent();
        const draft=buildDraft(source,changes);
        const stamp=new Date().toISOString().replace(/[:.]/g,"-");
        if(kind==="json")download(JSON.stringify(draft,null,2),"application/json;charset=utf-8",
          "rainguard_hydrology12_evidence_draft_"+stamp+".json");
        else download(toCSV(draft),"text/csv;charset=utf-8",
          "rainguard_hydrology12_evidence_draft_"+stamp+".csv");
        update();
        editStatus.textContent+=" تم بدء تنزيل المسودة محليًا؛ احتفظ بالملف في مجلد خاص.";
      }catch(e){editStatus.textContent="تعذر التصدير: "+e.message;}
    }
    exportJSON.addEventListener("click",()=>exported("json"));
    exportCSV.addEventListener("click",()=>exported("csv"));
  }
  return {blank,normalize,buildDraft,toCSV,bind,DRAFT_STATUS,FIELDS};
});
