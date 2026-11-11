/* RainGuard AI: static research preview; NEVER live navigation/alert data. */
(function(root,factory){
  "use strict";
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  if(root)root.RainGuardTruckJourneyPreview=api;
})(typeof window!=="undefined"?window:null,function(){
  "use strict";
  const definitions=Object.freeze([
    {id:"sample-1",name:"المقطع التجريبي الأول",start:"09:00",end:"09:20",km:14},
    {id:"sample-2",name:"المقطع التجريبي الثاني",start:"09:20",end:"09:50",km:24},
    {id:"sample-3",name:"المقطع التجريبي الثالث",start:"09:50",end:"10:15",km:21},
  ]);
  const required=Object.freeze([
    "هندسة المقطع وموقعه من مزود طرق موثق",
    "تغطية توقعات المطر الساعية عند وقت المرور",
    "توثيق الأودية والعبارات ونموذج الجريان",
    "التحقق من تنبيهات وإغلاقات الطرق الرسمية",
  ]);
  function build(scenario){
    const choice=scenario==="rain"?"rain":"missing";
    return {
      type:"SYNTHETIC_RESEARCH_PREVIEW",
      operationalWarningApproved:false,
      safeToDrive:null,
      alternativeRouteApproved:false,
      officialFeedsConnected:false,
      scenario:choice,
      segments:definitions.map((p,index)=>{
        const illustrativeRain=choice==="rain"&&index===1;
        return {
          ...p, synthetic:true,
          weatherExposureStatus:illustrativeRain?"POTENTIAL_RAIN_EXPOSURE":"INSUFFICIENT_FORECAST_EVIDENCE",
          rainProbabilityPct:illustrativeRain?76:null,
          rainMmPerHour:illustrativeRain?3:null,
          hydrologyReviewStatus:"UNVERIFIED",
          roadClosureStatus:"UNKNOWN",
          missingRequirements:[...required],
          safeToDrive:null,
          alternativeRouteApproved:false,
        };
      }),
    };
  }
  function init(doc){
    if(!doc||!doc.getElementById("scenario"))return false;
    const scenario=doc.getElementById("scenario"),
          list=doc.getElementById("segmentList"),
          details=doc.getElementById("details"),
          missing=doc.getElementById("missingList"),
          warning=doc.getElementById("detailWarning"),
          count=doc.getElementById("exposureCount"),
          total=doc.getElementById("segmentCount"),
          title=doc.getElementById("detailTitle");
    if(!list||!details||!missing||!warning||!count||!total||!title)return false;
    let selected=0;
    const el=(tag,text,cls)=>{
      const node=doc.createElement(tag);
      node.textContent=text;
      if(cls)node.className=cls;
      return node;
    };
    function field(label,value){
      const node=el("div","","field");
      node.append(el("small",label),el("strong",value));
      return node;
    }
    function render(){
      const report=build(scenario.value);
      if(selected>=report.segments.length)selected=0;
      total.textContent=String(report.segments.length);
      count.textContent=report.segments.some(s=>s.weatherExposureStatus==="POTENTIAL_RAIN_EXPOSURE")
        ?String(report.segments.filter(s=>s.weatherExposureStatus==="POTENTIAL_RAIN_EXPOSURE").length)+" (اصطناعي)"
        :"غير مقيم";
      list.replaceChildren();
      report.segments.forEach((segment,index)=>{
        const button=el("button","","segment");
        button.type="button";
        button.setAttribute("aria-pressed",String(index===selected));
        button.setAttribute("aria-label",segment.name+" — تفاصيل");
        const row=el("span","","segment-top");
        row.append(el("strong",segment.name),
          el("span",segment.weatherExposureStatus==="POTENTIAL_RAIN_EXPOSURE"?"مطر محتمل (محاكاة)":"البيانات غير مكتملة","segment-status"));
        button.append(row,
          el("small","وقت مرور افتراضي: "+segment.start+"–"+segment.end),
          el("small","مسافة مصطنعة: "+segment.km+" كم"));
        button.addEventListener("click",()=>{selected=index;render();});
        list.append(button);
      });
      const segment=report.segments[selected];
      title.textContent="تفاصيل "+segment.name;
      details.replaceChildren(
        field("وقت المرور",""+segment.start+"–"+segment.end+" (محاكاة)"),
        field("المسافة",segment.km+" كم (مصطنعة)"),
        field("التعرض للمطر",segment.weatherExposureStatus==="POTENTIAL_RAIN_EXPOSURE"?"محتمل (اصطناعي)":"لا تتوفر بيانات كافية"),
        field("احتمال المطر",segment.rainProbabilityPct===null?"غير متاح":segment.rainProbabilityPct+"% (اصطناعي)"),
        field("الأودية والسيول","لم تُتحقق"),
        field("إغلاقات الطريق","غير معروفة")
      );
      missing.replaceChildren(...segment.missingRequirements.map(v=>el("li",v)));
      warning.textContent="لا يمكن الجزم بسلامة الطريق أو اقتراح طريق بديل من هذا السيناريو التجريبي.";
    }
    scenario.addEventListener("change",()=>{selected=0;render();});
    render();
    return true;
  }
  if(typeof document!=="undefined"){
    if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>init(document),{once:true});
    else init(document);
  }
  return {build,init};
});
