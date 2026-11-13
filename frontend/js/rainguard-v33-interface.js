/* V33 landing/navigation enhancement. Existing V30/32 engines remain unchanged. */
(function(){
"use strict";
function init(){
 const anchor=document.getElementById("operationsHub");
 if(!anchor || document.getElementById("rgV33Shell"))return;
 const shell=document.createElement("section"); shell.id="rgV33Shell";shell.className="rg-v33-shell";shell.setAttribute("aria-label","لوحة RainGuard AI الرئيسية");shell.dir="rtl";
 shell.innerHTML=`
 <div class="rg-v33-hero">
 <div class="rg-v33-tag">RAIN GUARD AI · V33 INTERFACE PREVIEW</div>
 <h2>ذكاء الأمطار والسيول في واجهة واحدة</h2>
 <p>استكشف الرصد الجوي، مقارنة مصادر البيانات، مؤشرات السيول البحثية، ومسارات الشاحنات التجريبية. المعلومات المعروضة ليست تحذيرات رسمية ولا تصريحًا بسلامة الطرق.</p>
 <div class="rg-v33-chip-row">
 <span class="rg-v33-chip">🇸🇦 نطاق المملكة العربية السعودية</span>
 <span class="rg-v33-chip warning">مؤشرات تجريبية غير معتمدة ميدانيًا</span>
 <span class="rg-v33-chip">V33 · تحديث الواجهة</span>
 </div>
 <div class="rg-v33-cta">
 <a href="#v30Map">استعرض الخريطة الوطنية ←</a>
 <a class="secondary" href="truck-routes-prototype.html">محاكاة مسارات الشاحنات</a>
 <a class="secondary" href="#reportPanel">التقارير والأدلة</a>
 </div></div>
 <nav class="rg-v33-nav" aria-label="أقسام المنصة">
 <a href="#v30Map"><b aria-hidden="true">🗺️</b>الخريطة الوطنية</a>
 <a href="#sourceAdapterStatusPanel"><b aria-hidden="true">🌧️</b>مصادر الأمطار</a>
 <a href="#multiSourceVerificationPanel"><b aria-hidden="true">🌊</b>التحقق من المخاطر</a>
 <a href="truck-routes-prototype.html"><b aria-hidden="true">🚚</b>المسارات التجريبية</a>
 <a href="#decisionPanel"><b aria-hidden="true">🔔</b>مؤشرات القرار</a>
 <a href="#v30SystemHealth"><b aria-hidden="true">🛠️</b>تشخيص النظام</a>
 </nav>
 <div class="rg-v33-strip" aria-label="شفافية حالة النظام">
 <div class="rg-v33-panel"><strong>حالة الخادم السحابي</strong><span id="rgV33ApiStatus" class="rg-v33-status">لم يُتحقق من الاتصال بعد</span><small>تُفحص واجهة API على نفس النطاق فقط؛ تشغيل الواجهة لا يعني تشغيل Backend.</small></div>
 <div class="rg-v33-panel"><strong>التحقق من مخاطر السيول</strong><span class="rg-v33-status">غير معتمد ميدانيًا</span><small>لا تعرض هذه الصفحة مسارات آمنة أو قرارات إغلاق طرق معتمدة.</small></div>
 <div class="rg-v33-panel"><strong>مصادر ونتائج التحليل</strong><span>شاهد حالة كل مصدر وأدلته في لوحة التحقق.</span><small><a href="#verificationSourceMatrix">فتح مصفوفة المصادر ←</a></small></div>
 </div>`;
 anchor.parentNode.insertBefore(shell,anchor);
 document.body.classList.add("rg-v33-ready");
 const api=document.getElementById("rgV33ApiStatus");
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),5000);
 fetch("/api/health",{headers:{"Accept":"application/json"},cache:"no-store",signal:controller.signal})
 .then(async res=>{const typ=res.headers.get("content-type")||"";if(!res.ok||!typ.includes("application/json"))throw Error("API unavailable");const data=await res.json();if(data && (data.status==="ok"||data.status==="healthy") && (data.service||data.mode)){api.textContent="خادم API يستجيب — تحقق من صلاحية البيانات أدناه";api.style.color="#98eee1";}else{api.textContent="API غير مؤكد — واجهة مستقلة";}})
 .catch(()=>{api.textContent="خادم API غير متصل على هذا النطاق";})
 .finally(()=>clearTimeout(timer));
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();
