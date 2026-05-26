let lastReport = "";

function getApiBase(){
  return localStorage.getItem("RAINGUARD_API") || API_BASE_URL || "";
}

function saveApi(){
  const value = document.getElementById("apiInput").value.trim().replace(/\/$/, "");
  if(!value){
    alert("ضع رابط API");
    return;
  }
  localStorage.setItem("RAINGUARD_API", value);
  document.getElementById("apiStatus").textContent = "تم حفظ الرابط: " + value;
}

function showPage(id, btn){
  document.querySelectorAll(".page").forEach(p=>p.classList.add("hidden"));
  document.getElementById(id).classList.remove("hidden");
  document.querySelectorAll(".nav button").forEach(b=>b.classList.remove("active"));
  btn.classList.add("active");
}

function color(score){
  if(score >= 80) return "#ef4444";
  if(score >= 60) return "#f59e0b";
  if(score >= 40) return "#38bdf8";
  return "#22c55e";
}

function fmt(t){
  return new Date(t).toLocaleTimeString("ar-SA",{hour:"2-digit",minute:"2-digit"});
}

async function loadRain(lat, lon, name){
  const api = getApiBase();
  if(!api){
    document.getElementById("status").innerHTML = "<div class='error'>لم يتم وضع رابط Backend. افتح تبويب API وضع رابط منصة Render بعد رفع backend.</div>";
    return;
  }

  document.getElementById("status").textContent = "جاري الاتصال بالـ API...";
  const url = `${api}/rain-alert?lat=${lat}&lon=${lon}&name=${encodeURIComponent(name)}&hours=12`;

  try{
    const res = await fetch(url);
    if(!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    render(data);
  }catch(e){
    document.getElementById("status").innerHTML = "<div class='error'>تعذر الاتصال بالـ API. تأكد أن رابط Backend صحيح وأن الخدمة تعمل.</div>";
  }
}

function render(data){
  const best = data.best_hour;
  const current = data.current;
  const c = color(best.rain_score);

  document.getElementById("ring").style.background = `conic-gradient(${c} ${best.rain_score*3.6}deg, rgba(255,255,255,.08) 0deg)`;
  document.getElementById("score").innerHTML = `${best.rain_score}<small>مؤشر المطر</small>`;
  document.getElementById("alertTitle").textContent = best.alert_level;
  document.getElementById("alertMsg").textContent = best.advice;
  document.getElementById("status").textContent = `تم التحديث: ${new Date().toLocaleString("ar-SA")} | المصدر: ${data.source}`;

  document.getElementById("metrics").innerHTML = `
    <div class="row"><span>الموقع</span><b>${data.location_name}</b></div>
    <div class="row"><span>الحرارة</span><b>${current.temperature}°C</b></div>
    <div class="row"><span>الرطوبة</span><b>${current.humidity}%</b></div>
    <div class="row"><span>السحب</span><b>${current.cloud_cover}%</b></div>
    <div class="row"><span>احتمال المطر</span><b>${current.rain_probability}%</b></div>
    <div class="row"><span>نقطة الندى</span><b>${current.dew_point}°C</b></div>
    <div class="row"><span>الضغط</span><b>${current.pressure_hpa} hPa</b></div>
    <div class="row"><span>الرياح</span><b>${current.wind_speed} كم/س</b></div>
  `;

  document.getElementById("decision").innerHTML = `
    <div class="row"><span>المستوى</span><b>${best.alert_level}</b></div>
    <div class="row"><span>أعلى ساعة خطورة</span><b>${fmt(best.time)}</b></div>
    <div class="row"><span>أعلى مؤشر</span><b>${best.rain_score}%</b></div>
    <div class="row"><span>هطول متوقع</span><b>${best.precipitation_mm} mm</b></div>
    <div class="row"><span>التوصية</span><b>${best.rain_score >= 60 ? "متابعة قريبة" : "متابعة عادية"}</b></div>
  `;

  document.getElementById("hours").innerHTML = data.next_hours.map(h=>`
    <div class="hour">
      <small>${fmt(h.time)}</small>
      <strong style="color:${color(h.rain_score)}">${h.rain_score}%</strong>
      <small>مطر: ${h.rain_probability}%</small>
      <small>سحب: ${h.cloud_cover}%</small>
      <small>رطوبة: ${h.humidity}%</small>
    </div>
  `).join("");

  lastReport = `RainGuard AI Report
الموقع: ${data.location_name}
الإحداثيات: ${data.latitude}, ${data.longitude}
وقت التقرير: ${new Date().toLocaleString("ar-SA")}

مستوى الإنذار: ${best.alert_level}
أعلى مؤشر مطر خلال 12 ساعة: ${best.rain_score}%
أعلى ساعة خطورة: ${fmt(best.time)}

البيانات الحالية:
الحرارة: ${current.temperature}°C
الرطوبة: ${current.humidity}%
السحب: ${current.cloud_cover}%
احتمال المطر: ${current.rain_probability}%
نقطة الندى: ${current.dew_point}°C
الضغط: ${current.pressure_hpa} hPa
الرياح: ${current.wind_speed} كم/س

المصدر: ${data.source}
ملاحظة: ${data.disclaimer}`;

  document.getElementById("report").textContent = lastReport;
}

function checkCity(){
  const [lat, lon, name] = document.getElementById("citySelect").value.split(",");
  loadRain(lat, lon, name);
}

function manualCheck(){
  const lat = document.getElementById("lat").value.trim();
  const lon = document.getElementById("lon").value.trim();
  const name = document.getElementById("placeName").value.trim() || "موقع يدوي";
  if(!lat || !lon){
    alert("أدخل خط العرض وخط الطول");
    return;
  }
  loadRain(lat, lon, name);
}

function useGPS(){
  if(!navigator.geolocation){
    alert("المتصفح لا يدعم تحديد الموقع");
    return;
  }
  document.getElementById("status").textContent = "جاري تحديد الموقع...";
  navigator.geolocation.getCurrentPosition(
    pos => loadRain(pos.coords.latitude, pos.coords.longitude, "موقعي الحالي"),
    err => document.getElementById("status").innerHTML = "<div class='error'>لم يتم السماح بالموقع. اختر مدينة أو أدخل الإحداثيات يدويًا.</div>",
    {enableHighAccuracy:true, timeout:12000, maximumAge:300000}
  );
}

async function copyReport(){
  if(!lastReport){
    alert("لا يوجد تقرير بعد");
    return;
  }
  try{
    await navigator.clipboard.writeText(lastReport);
    alert("تم نسخ التقرير");
  }catch(e){
    alert(lastReport);
  }
}

document.addEventListener("DOMContentLoaded", ()=>{
  const api = getApiBase();
  if(api){
    checkCity();
  }else{
    document.getElementById("status").innerHTML = "<div class='error'>الواجهة جاهزة، لكن تحتاج رفع Backend ثم وضع رابطه في تبويب API.</div>";
  }
});