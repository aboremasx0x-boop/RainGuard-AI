const API_BASE_URL = "https://rainguard-ai.onrender.com";

let map;
let marker;
let rainLayer;
let radarEnabled = true;

let lastLat = 21.4858;
let lastLon = 39.1925;
let lastName = "جدة";

let autoRefreshInterval;

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
        alert("الرادار لم يتم تحميله بعد");
        return;
    }

    if (radarEnabled) {

        map.removeLayer(rainLayer);

        radarEnabled = false;

        alert("تم إيقاف الرادار");

    } else {

        rainLayer.addTo(map);

        radarEnabled = true;

        alert("تم تشغيل الرادار");
    }
}

// ===============================
// تحديث تلقائي
// ===============================
function startAutoRefresh() {

    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
    }

    autoRefreshInterval = setInterval(() => {

        checkRain(
            lastLat,
            lastLon,
            lastName
        );

    }, 10 * 60 * 1000);

    alert("تم تفعيل التحديث التلقائي كل 10 دقائق");
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

            <h3>
                توقعات 12 ساعة القادمة
            </h3>

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

                <span>
                    ${hour.time.substring(11, 16)}
                </span>

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
    name = "موقع محدد"
) {

    const cityName =
        document.getElementById("cityName");

    const statusText =
        document.getElementById("statusText");

    const adviceText =
        document.getElementById("adviceText");

    cityName.innerText = name;

    statusText.innerText =
        "جاري تحليل المطر...";

    statusText.className = "";

    adviceText.innerHTML = "";

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
                onclick="startAutoRefresh()"
                style="margin-top:10px;">
                تفعيل التحديث التلقائي
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

    } catch (error) {

        statusText.className = "rain-high";

        statusText.innerText = "حدث خطأ";

        adviceText.innerHTML = `
            تعذر جلب البيانات
        `;

        console.error(error);
    }
}

// ===============================
// موقعي الحالي
// ===============================
function getMyLocation() {

    if (!navigator.geolocation) {

        alert("المتصفح لا يدعم الموقع");

        return;
    }

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

            alert("لم يتم السماح بالموقع");
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

        alert("اكتب اسم المدينة");

        return;
    }

    const cityName =
        document.getElementById("cityName");

    const statusText =
        document.getElementById("statusText");

    const adviceText =
        document.getElementById("adviceText");

    cityName.innerText = cityInput;

    statusText.innerText =
        "جاري البحث...";

    adviceText.innerHTML = "";

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
};
