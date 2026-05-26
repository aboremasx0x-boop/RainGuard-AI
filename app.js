const API_BASE_URL = "https://rainguard-ai.onrender.com";

let map;
let marker;
let rainLayer;
let radarEnabled = true;

let lastLat = 21.4858;
let lastLon = 39.1925;
let lastName = "جدة";

let autoRefreshInterval = null;
let autoRefreshEnabled = false;
let lastSmartAlertLevel = "";

// ===============================
// رسالة واضحة داخل الواجهة
// ===============================
function showActionMessage(message, type = "success") {
    const box = document.getElementById("actionMessage");

    if (!box) return;

    let background = "#064e3b";
    let color = "#d1fae5";

    if (type === "warning") {
        background = "#78350f";
        color = "#fde68a";
    }

    if (type === "danger") {
        background = "#7f1d1d";
        color = "#fecaca";
    }

    box.innerText = message;
    box.style.background = background;
    box.style.color = color;
    box.style.display = "block";

    setTimeout(() => {
        box.style.display = "none";
    }, 5000);
}

// ===============================
// شريط مؤشر الخطر
// ===============================
function updateRiskBar(score) {
    const riskBar = document.getElementById("riskBar");
    const riskValue = document.getElementById("riskValue");
    const riskLabel = document.getElementById("riskLabel");

    if (!riskBar || !riskValue || !riskLabel) {
        console.log("Risk elements not found");
        return;
    }

    score = Number(score) || 0;

    let color = "#22c55e";
    let label = "خطر منخفض";

    if (score >= 80) {
        color = "#ef4444";
        label = "خطر مرتفع";
    } else if (score >= 60) {
        color = "#f59e0b";
        label = "تنبيه متوسط";
    } else if (score >= 40) {
        color = "#38bdf8";
        label = "احتمال متوسط";
    }

    riskBar.style.width = score + "%";
    riskBar.style.background = color;

    riskValue.innerText = score + "%";
    riskValue.style.color = color;

    riskLabel.innerText = label;
}

// ===============================
// تنبيه ذكي
// ===============================
function checkSmartAlert(score, alertLevel, locationName) {
    let currentLevel = "LOW";

    if (score >= 80) {
        currentLevel = "HIGH";
    } else if (score >= 60) {
        currentLevel = "MEDIUM";
    }

    if (currentLevel === lastSmartAlertLevel) return;

    lastSmartAlertLevel = currentLevel;

    if (currentLevel === "HIGH") {
        showActionMessage(
            `تحذير قوي: مؤشر المطر في ${locationName} وصل إلى ${score}% - ${alertLevel}`,
            "danger"
        );
    } else if (currentLevel === "MEDIUM") {
        showActionMessage(
            `تنبيه متوسط: مؤشر المطر في ${locationName} وصل إلى ${score}% - تابع الحالة`,
            "warning"
        );
    } else {
        showActionMessage(
            `الحالة مستقرة: مؤشر المطر في ${locationName} منخفض (${score}%)`,
            "success"
        );
    }
}

// ===============================
// الخريطة
// ===============================
function initMap(lat = 21.4858, lon = 39.1925) {
    if (!map) {
        map = L.map("map", {
            minZoom: 4,
            maxZoom: 10
        }).setView([lat, lon], 6);

        L.tileLayer(
            "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
            {
                minZoom: 4,
                maxZoom: 19,
                attribution: "© OpenStreetMap"
            }
        ).addTo(map);

        loadRainRadar();
    } else {
        map.setView([lat, lon], 6);
    }

    if (marker) {
        map.removeLayer(marker);
    }

    marker = L.marker([lat, lon]).addTo(map);
}

// ===============================
// رادار المطر
// ===============================
async function loadRainRadar() {
    try {
        const response = await fetch(
            "https://api.rainviewer.com/public/weather-maps.json"
        );

        const data = await response.json();

        if (!data.radar || !data.radar.past || data.radar.past.length === 0) {
            console.log("لا توجد بيانات رادار");
            return;
        }

        const latestRadar = data.radar.past[data.radar.past.length - 1];

        const radarUrl =
            `${data.host}${latestRadar.path}/256/{z}/{x}/{y}/2/1_1.png`;

        rainLayer = L.tileLayer(radarUrl, {
            minZoom: 4,
            maxZoom: 10,
            opacity: 0.65,
            zIndex: 10,
            attribution: "Rain radar © RainViewer"
        });

        if (radarEnabled) {
            rainLayer.addTo(map);
        }

    } catch (error) {
        console.error("Radar Error:", error);
    }
}

function toggleRadar() {
    if (!rainLayer) {
        showActionMessage("الرادار لم يتم تحميله بعد", "warning");
        return;
    }

    if (radarEnabled) {
        map.removeLayer(rainLayer);
        radarEnabled = false;

        showActionMessage("تم إيقاف رادار المطر", "warning");
        updateRefreshStatus("تم إيقاف الرادار");
    } else {
        rainLayer.addTo(map);
        radarEnabled = true;

        showActionMessage("تم تشغيل رادار المطر", "success");
        updateRefreshStatus("تم تشغيل الرادار");
    }
}

// ===============================
// حالة التحديث
// ===============================
function updateRefreshStatus(extraMessage = "") {
    const refreshStatus = document.getElementById("refreshStatus");

    if (!refreshStatus) return;

    const now = new Date().toLocaleTimeString("ar-SA", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
    });

    let text = `آخر تحديث: ${now}`;

    if (autoRefreshEnabled) {
        text += " | التحديث التلقائي: مفعل كل 10 دقائق";
    } else {
        text += " | التحديث التلقائي: غير مفعل";
    }

    if (extraMessage) {
        text += ` | ${extraMessage}`;
    }

    refreshStatus.innerText = text;
}

function refreshNow() {
    showActionMessage("جاري تحديث البيانات الآن", "success");

    checkRain(lastLat, lastLon, lastName, false);

    updateRefreshStatus("تم طلب تحديث يدوي");
}

function startAutoRefresh() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
    }

    autoRefreshEnabled = true;

    autoRefreshInterval = setInterval(() => {
        checkRain(lastLat, lastLon, lastName, true);
    }, 10 * 60 * 1000);

    showActionMessage("تم تفعيل التحديث التلقائي كل 10 دقائق", "success");
    updateRefreshStatus("تم تفعيل التحديث التلقائي");
}

function stopAutoRefresh() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
    }

    autoRefreshInterval = null;
    autoRefreshEnabled = false;

    showActionMessage("تم إيقاف التحديث التلقائي", "warning");
    updateRefreshStatus("تم إيقاف التحديث التلقائي");
}

// ===============================
// ألوان التنبيه
// ===============================
function applyAlertCardColor(score) {
    const cards = document.querySelectorAll(".card");

    cards.forEach(card => {
        card.classList.remove("alert-green", "alert-yellow", "alert-red");
    });

    let alertBoxClass = "alert-green";

    if (score >= 80) {
        alertBoxClass = "alert-red";
    } else if (score >= 60) {
        alertBoxClass = "alert-yellow";
    }

    if (cards.length > 0) {
        cards[0].classList.add(alertBoxClass);
    }
}

// ===============================
// توقعات 12 ساعة
// ===============================
function buildForecastHTML(nextHours) {
    if (!nextHours || nextHours.length === 0) return "";

    let forecastHTML = `
        <div class="forecast-section">
            <h3>توقعات 12 ساعة القادمة</h3>
            <div class="info-grid">
    `;

    nextHours.slice(0, 12).forEach(hour => {
        let hourClass = "rain-low";

        if (hour.rain_score >= 80) {
            hourClass = "rain-high";
        } else if (hour.rain_score >= 60) {
            hourClass = "rain-medium";
        }

        forecastHTML += `
            <div class="info-box">
                <span>${hour.time.substring(11, 16)}</span>
                <strong class="${hourClass}">${hour.rain_score}%</strong>
                <div style="margin-top:8px;">🌧 ${hour.rain_probability}%</div>
                <div style="margin-top:5px;">☁ ${hour.cloud_cover}%</div>
                <div style="margin-top:5px;">💧 ${hour.humidity}%</div>
            </div>
        `;
    });

    forecastHTML += `
            </div>
        </div>
    `;

    return forecastHTML;
}

// ===============================
// التوقعات اليومية
// ===============================
function buildDailyForecastHTML(dailyForecast) {
    if (!dailyForecast || dailyForecast.length === 0) return "";

    let dailyHTML = `
        <div class="forecast-section">
            <h3>توقعات الأيام القادمة</h3>
            <div class="info-grid">
    `;

    dailyForecast.slice(0, 7).forEach(day => {
        let dayClass = "rain-low";

        if (day.daily_rain_score >= 80) {
            dayClass = "rain-high";
        } else if (day.daily_rain_score >= 60) {
            dayClass = "rain-medium";
        }

        const dateObj = new Date(day.date);

        const dayName = dateObj.toLocaleDateString("ar-SA", {
            weekday: "long"
        });

        const dateText = dateObj.toLocaleDateString("ar-SA", {
            month: "short",
            day: "numeric"
        });

        dailyHTML += `
            <div class="info-box">
                <span>${dayName}</span>
                <strong class="${dayClass}">${day.daily_rain_score}%</strong>
                <div style="margin-top:8px;">📅 ${dateText}</div>
                <div style="margin-top:5px;">🌧 احتمال المطر: ${day.rain_probability_max}%</div>
                <div style="margin-top:5px;">💦 كمية المطر: ${day.precipitation_sum} mm</div>
                <div style="margin-top:5px;">🌡 ${day.temperature_min}° / ${day.temperature_max}°</div>
                <div style="margin-top:5px;">💨 الرياح: ${day.wind_speed_max} كم/س</div>
            </div>
        `;
    });

    dailyHTML += `
            </div>
        </div>
    `;

    return dailyHTML;
}

// ===============================
// تحليل المطر
// ===============================
async function checkRain(lat, lon, name = "موقع محدد", silent = false) {
    const cityName = document.getElementById("cityName");
    const statusText = document.getElementById("statusText");
    const adviceText = document.getElementById("adviceText");

    cityName.innerText = name;

    if (!silent) {
        statusText.innerText = "جاري تحليل المطر...";
        statusText.className = "";
        adviceText.innerHTML = "";
    }

    initMap(lat, lon);

    lastLat = lat;
    lastLon = lon;
    lastName = name;

    try {
        const url =
            `${API_BASE_URL}/rain-alert?lat=${lat}&lon=${lon}&name=${encodeURIComponent(name)}&hours=12`;

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error("فشل الاتصال بالخادم");
        }

        const data = await response.json();

        const current = data.current;
        const best = data.best_hour;

        const score = Number(best.rain_score) || 0;

        const forecastHTML = buildForecastHTML(data.next_hours);
        const dailyForecastHTML = buildDailyForecastHTML(data.daily_forecast);

        let className = "rain-low";

        if (score >= 80) {
            className = "rain-high";
        } else if (score >= 60) {
            className = "rain-medium";
        }

        applyAlertCardColor(score);
        updateRiskBar(score);

        statusText.className = className;
        statusText.innerText = `${best.alert_level} - ${score}%`;

        checkSmartAlert(score, best.alert_level, name);

        adviceText.innerHTML = `
            <p>${best.advice}</p>

            <button onclick="toggleRadar()" style="margin-top:10px;">تشغيل / إيقاف الرادار</button>
            <button onclick="refreshNow()" style="margin-top:10px;">تحديث الآن</button>
            <button onclick="startAutoRefresh()" style="margin-top:10px;">تفعيل التحديث التلقائي</button>
            <button onclick="stopAutoRefresh()" style="margin-top:10px;">إيقاف التحديث التلقائي</button>

            <div class="info-grid">
                <div class="info-box"><span>درجة الحرارة</span><strong>${current.temperature}°C</strong></div>
                <div class="info-box"><span>الرطوبة</span><strong>${current.humidity}%</strong></div>
                <div class="info-box"><span>السحب</span><strong>${current.cloud_cover}%</strong></div>
                <div class="info-box"><span>احتمال المطر</span><strong>${current.rain_probability}%</strong></div>
                <div class="info-box"><span>الضغط</span><strong>${current.pressure_hpa}</strong></div>
                <div class="info-box"><span>الرياح</span><strong>${current.wind_speed}</strong></div>
            </div>

            ${forecastHTML}
            ${dailyForecastHTML}
        `;

        marker.bindPopup(`
            <b>${name}</b><br>
            مؤشر المطر: ${score}%<br>
            ${best.alert_level}
        `).openPopup();

        updateRefreshStatus("تم تحديث البيانات");

    } catch (error) {
        statusText.className = "rain-high";
        statusText.innerText = "حدث خطأ";

        adviceText.innerHTML = `تعذر جلب البيانات`;

        showActionMessage("فشل تحديث البيانات", "danger");
        updateRefreshStatus("فشل التحديث");

        console.error(error);
    }
}

// ===============================
// موقعي الحالي
// ===============================
function getMyLocation() {
    if (!navigator.geolocation) {
        showActionMessage("المتصفح لا يدعم تحديد الموقع", "warning");
        return;
    }

    showActionMessage("جاري تحديد موقعك", "success");

    navigator.geolocation.getCurrentPosition(
        (position) => {
            checkRain(
                position.coords.latitude,
                position.coords.longitude,
                "موقعي الحالي"
            );
        },
        () => {
            showActionMessage("لم يتم السماح بتحديد الموقع", "warning");
        },
        {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 300000
        }
    );
}

// ===============================
// البحث باسم مدينة
// ===============================
async function detectRain() {
    const cityInput = document.getElementById("cityInput").value.trim();

    if (!cityInput) {
        showActionMessage("اكتب اسم المدينة أولًا", "warning");
        return;
    }

    const cityName = document.getElementById("cityName");
    const statusText = document.getElementById("statusText");
    const adviceText = document.getElementById("adviceText");

    cityName.innerText = cityInput;
    statusText.innerText = "جاري البحث...";
    adviceText.innerHTML = "";

    showActionMessage("جاري البحث عن المدينة", "success");

    try {
        const geoUrl =
            `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityInput)}&count=1&language=ar&format=json`;

        const geoResponse = await fetch(geoUrl);
        const geoData = await geoResponse.json();

        if (!geoData.results || geoData.results.length === 0) {
            throw new Error("مدينة غير موجودة");
        }

        const place = geoData.results[0];

        checkRain(
            place.latitude,
            place.longitude,
            place.name || cityInput
        );

    } catch (error) {
        statusText.className = "rain-high";
        statusText.innerText = "المدينة غير موجودة";
        adviceText.innerHTML = "جرّب اسمًا آخر";

        showActionMessage("لم يتم العثور على المدينة", "warning");
        updateRefreshStatus("فشل البحث");

        console.error(error);
    }
}

// ===============================
// التشغيل الافتراضي
// ===============================
window.onload = function () {
    initMap();

    checkRain(21.4858, 39.1925, "جدة");

    setTimeout(() => {
        startAutoRefresh();
    }, 3000);
};
