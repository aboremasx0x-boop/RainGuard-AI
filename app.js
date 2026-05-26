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

// ===============================
// رسالة واضحة داخل الواجهة
// ===============================
function showActionMessage(message) {
    const box = document.getElementById("actionMessage");

    if (!box) return;

    box.innerText = message;
    box.style.display = "block";

    setTimeout(() => {
        box.style.display = "none";
    }, 3000);
}

// ===============================
// تشغيل الخريطة
// ===============================
function initMap(lat = 21.4858, lon = 39.1925) {
    if (!map) {
        map = L.map("map").setView([lat, lon], 8);

        L.tileLayer(
            "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
            {
                maxZoom: 19,
                attribution: "© OpenStreetMap"
            }
        ).addTo(map);

        loadRainRadar();
    } else {
        map.setView([lat, lon], 8);
    }

    if (marker) {
        map.removeLayer(marker);
    }

    marker = L.marker([lat, lon]).addTo(map);
}

// ===============================
// إضافة رادار المطر
// ===============================
async function loadRainRadar() {
    try {
        const response = await fetch(
            "https://api.rainviewer.com/public/weather-maps.json"
        );

        const data = await response.json();

        if (
            !data.radar ||
            !data.radar.past ||
            data.radar.past.length === 0
        ) {
            console.log("لا توجد بيانات رادار");
            return;
        }

        const latestRadar =
            data.radar.past[data.radar.past.length - 1];

        const radarUrl =
            `${data.host}${latestRadar.path}/256/{z}/{x}/{y}/2/1_1.png`;

        rainLayer = L.tileLayer(radarUrl, {
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

// ===============================
// تشغيل / إيقاف الرادار
// ===============================
function toggleRadar() {
    if (!rainLayer) {
        showActionMessage("الرادار لم يتم تحميله بعد");
        return;
    }

    if (radarEnabled) {
        map.removeLayer(rainLayer);
        radarEnabled = false;

        showActionMessage("تم إيقاف رادار المطر");
        updateRefreshStatus("تم إيقاف الرادار");
    } else {
        rainLayer.addTo(map);
        radarEnabled = true;

        showActionMessage("تم تشغيل رادار المطر");
        updateRefreshStatus("تم تشغيل الرادار");
    }
}

// ===============================
// حالة التحديث داخل الواجهة
// ===============================
function updateRefreshStatus(extraMessage = "") {
    const refreshStatus = document.getElementById("refreshStatus");

    if (!refreshStatus) {
        return;
    }

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

// ===============================
// تحديث يدوي الآن
// ===============================
function refreshNow() {
    showActionMessage("جاري تحديث البيانات الآن");

    checkRain(
        lastLat,
        lastLon,
        lastName,
        false
    );

    updateRefreshStatus("تم طلب تحديث يدوي");
}

// ===============================
// تفعيل التحديث التلقائي
// ===============================
function startAutoRefresh() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
    }

    autoRefreshEnabled = true;

    autoRefreshInterval = setInterval(() => {
        checkRain(
            lastLat,
            lastLon,
            lastName,
            true
        );
    }, 10 * 60 * 1000);

    showActionMessage("تم تفعيل التحديث التلقائي كل 10 دقائق");
    updateRefreshStatus("تم تفعيل التحديث التلقائي");
}

// ===============================
// إيقاف التحديث التلقائي
// ===============================
function stopAutoRefresh() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
    }

    autoRefreshInterval = null;
    autoRefreshEnabled = false;

    showActionMessage("تم إيقاف التحديث التلقائي");
    updateRefreshStatus("تم إيقاف التحديث التلقائي");
}

// ===============================
// ألوان التنبيه
// ===============================
function applyAlertCardColor(score) {
    const cards = document.querySelectorAll(".card");

    cards.forEach(card => {
        card.classList.remove(
            "alert-green",
            "alert-yellow",
            "alert-red"
        );
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
    if (!nextHours || nextHours.length === 0) {
        return "";
    }

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

                <strong class="${hourClass}">
                    ${hour.rain_score}%
                </strong>

                <div style="margin-top:8px;">
                    🌧 ${hour.rain_probability}%
                </div>

                <div style="margin-top:5px;">
                    ☁ ${hour.cloud_cover}%
                </div>

                <div style="margin-top:5px;">
                    💧 ${hour.humidity}%
                </div>
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
// تحليل المطر
// ===============================
async function checkRain(
    lat,
    lon,
    name = "موقع محدد",
    silent = false
) {
    const cityName =
        document.getElementById("cityName");

    const statusText =
        document.getElementById("statusText");

    const adviceText =
        document.getElementById("adviceText");

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

        const forecastHTML =
            buildForecastHTML(data.next_hours);

        let className = "rain-low";

        if (best.rain_score >= 80) {
            className = "rain-high";
        } else if (best.rain_score >= 60) {
            className = "rain-medium";
        }

        applyAlertCardColor(best.rain_score);

        statusText.className = className;

        statusText.innerText =
            `${best.alert_level} - ${best.rain_score}%`;

        adviceText.innerHTML = `
            <p>
                ${best.advice}
            </p>

            <button
                onclick="toggleRadar()"
                style="margin-top:10px;">
                تشغيل / إيقاف الرادار
            </button>

            <button
                onclick="refreshNow()"
                style="margin-top:10px;">
                تحديث الآن
            </button>

            <button
                onclick="startAutoRefresh()"
                style="margin-top:10px;">
                تفعيل التحديث التلقائي
            </button>

            <button
                onclick="stopAutoRefresh()"
                style="margin-top:10px;">
                إيقاف التحديث التلقائي
            </button>

            <div class="info-grid">
                <div class="info-box">
                    <span>درجة الحرارة</span>
                    <strong>${current.temperature}°C</strong>
                </div>

                <div class="info-box">
                    <span>الرطوبة</span>
                    <strong>${current.humidity}%</strong>
                </div>

                <div class="info-box">
                    <span>السحب</span>
                    <strong>${current.cloud_cover}%</strong>
                </div>

                <div class="info-box">
                    <span>احتمال المطر</span>
                    <strong>${current.rain_probability}%</strong>
                </div>

                <div class="info-box">
                    <span>الضغط</span>
                    <strong>${current.pressure_hpa}</strong>
                </div>

                <div class="info-box">
                    <span>الرياح</span>
                    <strong>${current.wind_speed}</strong>
                </div>
            </div>

            ${forecastHTML}
        `;

        marker.bindPopup(`
            <b>${name}</b><br>
            مؤشر المطر: ${best.rain_score}%<br>
            ${best.alert_level}
        `).openPopup();

        updateRefreshStatus("تم تحديث البيانات");

    } catch (error) {
        statusText.className = "rain-high";
        statusText.innerText = "حدث خطأ";

        adviceText.innerHTML = `
            تعذر جلب البيانات
        `;

        showActionMessage("فشل تحديث البيانات");
        updateRefreshStatus("فشل التحديث");

        console.error(error);
    }
}

// ===============================
// موقعي الحالي
// ===============================
function getMyLocation() {
    if (!navigator.geolocation) {
        showActionMessage("المتصفح لا يدعم تحديد الموقع");
        return;
    }

    showActionMessage("جاري تحديد موقعك");

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const lat =
                position.coords.latitude;

            const lon =
                position.coords.longitude;

            checkRain(
                lat,
                lon,
                "موقعي الحالي"
            );
        },

        () => {
            showActionMessage("لم يتم السماح بتحديد الموقع");
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
    const cityInput =
        document.getElementById("cityInput")
        .value
        .trim();

    if (!cityInput) {
        showActionMessage("اكتب اسم المدينة أولًا");
        return;
    }

    const cityName =
        document.getElementById("cityName");

    const statusText =
        document.getElementById("statusText");

    const adviceText =
        document.getElementById("adviceText");

    cityName.innerText = cityInput;
    statusText.innerText = "جاري البحث...";
    adviceText.innerHTML = "";

    showActionMessage("جاري البحث عن المدينة");

    try {
        const geoUrl =
            `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityInput)}&count=1&language=ar&format=json`;

        const geoResponse =
            await fetch(geoUrl);

        const geoData =
            await geoResponse.json();

        if (
            !geoData.results ||
            geoData.results.length === 0
        ) {
            throw new Error("مدينة غير موجودة");
        }

        const place =
            geoData.results[0];

        checkRain(
            place.latitude,
            place.longitude,
            place.name || cityInput
        );

    } catch (error) {
        statusText.className =
            "rain-high";

        statusText.innerText =
            "المدينة غير موجودة";

        adviceText.innerHTML =
            "جرّب اسمًا آخر";

        showActionMessage("لم يتم العثور على المدينة");
        updateRefreshStatus("فشل البحث");

        console.error(error);
    }
}

// ===============================
// التشغيل الافتراضي
// ===============================
window.onload = function () {
    initMap();

    checkRain(
        21.4858,
        39.1925,
        "جدة"
    );

    setTimeout(() => {
        startAutoRefresh();
    }, 3000);
};
