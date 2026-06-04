const API_BASE_URL = "https://rainguard-ai.onrender.com";

const OFFLINE_CACHE_KEY = "rainguard_last_success_data";

const NOTIFICATION_ENABLED_KEY = "rainguard_notifications_enabled";
const NOTIFICATION_LAST_ALERT_KEY = "rainguard_last_notification_time";
const NOTIFICATION_COOLDOWN_MINUTES = 30;
const BACKGROUND_MONITOR_KEY = "rainguard_background_monitor_enabled";
const BACKGROUND_MONITOR_INTERVAL_MINUTES = 10;

let backgroundMonitorInterval = null;
let backgroundMonitorEnabled = false;
const SMART_MULTI_CITY_KEY = "rainguard_smart_multicity_enabled";
const SMART_MULTI_CITY_LAST_ALERT_KEY = "rainguard_smart_multicity_last_alert";
const SMART_MULTI_CITY_ALERT_COOLDOWN_MINUTES = 45;
const SMART_MULTI_CITY_MIN_ALERT_SCORE = 60;
const SMART_MULTI_CITY_HISTORY_KEY = "rainguard_smart_multicity_history";
const SMART_MULTI_CITY_TOP_LIMIT = 9;
const SMART_MULTI_CITY_FORECAST_HOURS = 72;
const SMART_MULTI_CITY_EARLY_ALERT_KEY = "rainguard_smart_multicity_early_alert";
const SMART_MULTI_CITY_EARLY_ALERT_MIN_SCORE = 60;
const FLOOD_PREDICTION_ALERT_KEY = "rainguard_flood_prediction_alert";
const FLOOD_RISK_MIN_ALERT_SCORE = 60;

const floodCityWeights = {
    "جدة": 25,
    "مكة": 30,
    "الطائف": 25,
    "المدينة": 15,
    "أبها": 25,
    "الباحة": 25,
    "جازان": 25,
    "نجران": 20,
    "تبوك": 20,
    "الدمام": 15,
    "الرياض": 10
};

const FLOOD_RISK_HIGH_SCORE = 80;
const FLOOD_RISK_MEDIUM_SCORE = 60;
const FLOOD_RISK_WATCH_SCORE = 40;

const FLOOD_ALERT_WATCH_SCORE = 40;
const FLOOD_ALERT_HIGH_SCORE = 60;
const FLOOD_ALERT_EXTREME_SCORE = 80;
const FLOOD_ALERT_COOLDOWN_MINUTES = 180;
const FLOOD_ALERT_LAST_KEY = "rainguard_v82_flood_alert";

const TERRAIN_ENGINE_VERSION = "V9";

const terrainRiskProfiles = {
    "مكة": {
        valley: 18,
        mountain: 12,
        lowArea: 8,
        coastal: 0,
        history: 12
    },
    "جدة": {
        valley: 8,
        mountain: 0,
        lowArea: 15,
        coastal: 10,
        history: 15
    },
    "الطائف": {
        valley: 15,
        mountain: 15,
        lowArea: 5,
        coastal: 0,
        history: 10
    },
    "أبها": {
        valley: 16,
        mountain: 18,
        lowArea: 5,
        coastal: 0,
        history: 10
    },
    "الباحة": {
        valley: 16,
        mountain: 18,
        lowArea: 5,
        coastal: 0,
        history: 10
    },
    "جازان": {
        valley: 14,
        mountain: 8,
        lowArea: 12,
        coastal: 12,
        history: 12
    },
    "نجران": {
        valley: 18,
        mountain: 8,
        lowArea: 10,
        coastal: 0,
        history: 8
    },
    "المدينة": {
        valley: 16,
        mountain: 6,
        lowArea: 8,
        coastal: 0,
        history: 10
    },
    "تبوك": {
        valley: 14,
        mountain: 6,
        lowArea: 8,
        coastal: 0,
        history: 8
    },
    "الدمام": {
        valley: 4,
        mountain: 0,
        lowArea: 14,
        coastal: 12,
        history: 6
    },
    "الرياض": {
        valley: 8,
        mountain: 0,
        lowArea: 8,
        coastal: 0,
        history: 5
    }
};

let floodMapLayer = [];
let floodMapEnabled = true;

const smartMultiCityMonitorList = [
    { name: "جدة", lat: 21.5433, lon: 39.1728 },
    { name: "مكة", lat: 21.3891, lon: 39.8579 },
    { name: "الطائف", lat: 21.2703, lon: 40.4158 },
    { name: "المدينة", lat: 24.5247, lon: 39.5692 },
    { name: "الدمام", lat: 26.4207, lon: 50.0888 },
    { name: "أبها", lat: 18.2164, lon: 42.5053 },
    { name: "الباحة", lat: 20.0129, lon: 41.4677 },
    { name: "جازان", lat: 16.8892, lon: 42.5511 },
    { name: "نجران", lat: 17.5656, lon: 44.2289 },
    { name: "تبوك", lat: 28.3998, lon: 36.5715 },
    { name: "خليص",lat: 22.1500, lon: 39.3400 },
    { name: "الرياض", lat: 24.7136, lon: 46.6753 }
];
    const subCityRainZones = {
    "الطائف": [
        { name: "الوهط", lat: 21.2910, lon: 40.4330 },
        { name: "الهدا", lat: 21.3670, lon: 40.2850 },
        { name: "الشفا", lat: 21.0760, lon: 40.3110 },
        { name: "الحوية", lat: 21.4410, lon: 40.5010 },
        { name: "السيل الكبير", lat: 21.6330, lon: 40.5000 },
        { name: "بني سعد", lat: 20.9330, lon: 40.7500 }
    ],

    "مكة": [
        { name: "الشرائع", lat: 21.4900, lon: 39.9500 },
        { name: "العوالي", lat: 21.3500, lon: 39.9100 },
        { name: "بحرة", lat: 21.4000, lon: 39.4800 },
        { name: "الجموم", lat: 21.6160, lon: 39.7000 }
    ],

    "جدة": [
        { name: "أبحر", lat: 21.7500, lon: 39.1000 },
        { name: "الحمدانية", lat: 21.7200, lon: 39.2500 },
        { name: "بريمان", lat: 21.6500, lon: 39.3000 },
        { name: "شرق جدة", lat: 21.5500, lon: 39.3000 }
    ],

    "المدينة المنورة": [
        { name: "العزيزية", lat: 24.4300, lon: 39.5400 },
        { name: "قباء", lat: 24.4360, lon: 39.6170 },
        { name: "العاقول", lat: 24.5600, lon: 39.7200 },
        { name: "المسيجيد", lat: 24.9500, lon: 39.1500 }
    ],

    "خليص": [
    { name: "حي العزيزية", lat: 22.1550, lon: 39.3450 },
    { name: "حي الدف", lat: 22.1480, lon: 39.3380 },
    { name: "حي السلام", lat: 22.1620, lon: 39.3500 },
    { name: "حي المغاربة", lat: 22.1450, lon: 39.3320 },
    { name: "الطلعة", lat: 22.1700, lon: 39.3600 },
    { name: "الصدر", lat: 22.1800, lon: 39.3700 }
],

    "جازان": [
        { name: "أحد المسارحة", lat: 16.7100, lon: 42.9550 },
        { name: "صامطة", lat: 16.5960, lon: 42.9440 },
        { name: "أبو عريش", lat: 16.9680, lon: 42.8320 },
        { name: "صبيا", lat: 17.1500, lon: 42.6250 }
    ]
};

async function analyzeSubCityRainZones(cityName) {
    const zones = subCityRainZones[cityName];

    if (!zones || zones.length === 0) {
        return null;
    }

    const results = [];

    for (const zone of zones) {
        try {
            const url =
                `${API_BASE_URL}/rain-alert?lat=${zone.lat}&lon=${zone.lon}&name=${encodeURIComponent(zone.name)}&hours=12`;

            const response = await fetch(url);
            if (!response.ok) continue;

            const data = await response.json();
            if (data.error) continue;

            const best = data.best_hour || data.current || {};
            const current = data.current || {};

            const score =
                Number(best.rain_score) ||
                Number(current.rain_score) ||
                Number(current.rain_probability) ||
                0;

            results.push({
                name: zone.name,
                lat: zone.lat,
                lon: zone.lon,
                score,
                rainProbability: Number(current.rain_probability || 0),
                floodRiskScore: calculateV9FloodRisk({
                    name: zone.name,
                    score,
                    forecast24Score: score,
                    forecast72Score: score
                })
            });

        } catch (error) {
            console.error("Sub-city zone error:", zone.name, error);
        }
    }

    results.sort((a, b) => b.score - a.score);

    return results;
}
let map;
let marker;
let rainLayer;
let heatmapLayer;

let radarEnabled = true;
let heatmapEnabled = true;

let lastLat = 21.4858;
let lastLon = 39.1925;
let lastName = "جدة";

let autoRefreshInterval = null;
let autoRefreshEnabled = false;
let lastSmartAlertLevel = "";

let adaptiveRefreshMinutes = 30;
let lastRainScore = 0;

let multiCityAutoRefresh = null;
let multiCityAutoRefreshEnabled = false;

// ===============================
// مدن الخريطة الحرارية
// ===============================
const heatmapCities = [
    { name: "جدة", lat: 21.5433, lon: 39.1728 },
    { name: "مكة", lat: 21.3891, lon: 39.8579 },
    { name: "الرياض", lat: 24.7136, lon: 46.6753 },
    { name: "المدينة", lat: 24.5247, lon: 39.5692 },
    { name: "الدمام", lat: 26.4207, lon: 50.0888 },
    { name: "أبها", lat: 18.2164, lon: 42.5053 },
    { name: "الطائف", lat: 21.2703, lon: 40.4158 },
    { name: "تبوك", lat: 28.3998, lon: 36.5715 },
    { name: "حائل", lat: 27.5114, lon: 41.7208 },
    { name: "جازان", lat: 16.8892, lon: 42.5511 }
];

// ===============================
// مدن المراقبة المتعددة
// ===============================
const monitoredCities = [
    { name: "جدة", lat: 21.5433, lon: 39.1728 },
    { name: "مكة", lat: 21.3891, lon: 39.8579 },
    { name: "الرياض", lat: 24.7136, lon: 46.6753 },
    { name: "المدينة", lat: 24.5247, lon: 39.5692 },
    { name: "الدمام", lat: 26.4207, lon: 50.0888 },
    { name: "أبها", lat: 18.2164, lon: 42.5053 },
    { name: "الطائف", lat: 21.2703, lon: 40.4158 },
    { name: "تبوك", lat: 28.3998, lon: 36.5715 },
    { name: "حائل", lat: 27.5114, lon: 41.7208 },
    { name: "جازان", lat: 16.8892, lon: 42.5511 },
    { name: "نجران", lat: 17.5656, lon: 44.2289 },
    { name: "الباحة", lat: 20.0129, lon: 41.4677 }
];

// ===============================
// مدن ذات قابلية أعلى للسيول
// ===============================
const floodSensitiveCities = [
    "مكة",
    "الطائف",
    "أبها",
    "الباحة",
    "جازان",
    "نجران",
    "تبوك",
    "المدينة"
];

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
// Lightning Storm Mode
// ===============================
function updateLightningStormMode(score) {
    score = Number(score) || 0;

    document.body.classList.remove(
        "weather-safe",
        "weather-watch",
        "weather-storm",
        "weather-danger"
    );

    if (score >= 85) {
        document.body.classList.add("weather-danger");
        showStormPulse("خطر مرتفع جدًا: وضع العاصفة مفعل", "danger");
    } else if (score >= 70) {
        document.body.classList.add("weather-storm");
        showStormPulse("تنبيه عاصفة: مؤشرات المطر قوية", "danger");
    } else if (score >= 45) {
        document.body.classList.add("weather-watch");
    } else {
        document.body.classList.add("weather-safe");
    }
}

function showStormPulse(message, type = "warning") {
    const now = Date.now();

    if (!window.lastStormPulseTime) {
        window.lastStormPulseTime = 0;
    }

    if (now - window.lastStormPulseTime < 90000) {
        return;
    }

    window.lastStormPulseTime = now;
    showActionMessage(message, type);

    if (navigator.vibrate) {
        navigator.vibrate([200, 120, 200]);
    }
}

function saveLastSuccessfulWeather(data, lat, lon, name) {
    if (!data || data.error) return;

    const item = {
        data,
        lat,
        lon,
        name,
        savedAt: new Date().toISOString()
    };

    localStorage.setItem(OFFLINE_CACHE_KEY, JSON.stringify(item));
}

function getLastSuccessfulWeather() {
    try {
        return JSON.parse(localStorage.getItem(OFFLINE_CACHE_KEY));
    } catch {
        return null;
    }
}

function buildOfflineEmergencyHTML(saved) {
    if (!saved || !saved.data) return "";

    const best = saved.data.best_hour || {};
    const current = saved.data.current || {};
    const savedTime = new Date(saved.savedAt).toLocaleString("ar-SA");

    return `
        <div class="forecast-section">
            <h3>Offline Emergency Weather Mode</h3>

            <div style="
                margin-top:12px;
                padding:16px;
                border-radius:16px;
                background:#451a03;
                border:1px solid #f59e0b;
                color:#fde68a;
                line-height:1.9;
            ">
                <div style="
                    font-size:24px;
                    font-weight:bold;
                    color:#f59e0b;
                    margin-bottom:10px;
                ">
                    ⚠️ وضع الطوارئ بدون اتصال
                </div>

                <div>
                    يتم عرض آخر حالة محفوظة بنجاح.
                </div>

                <div>
                    الموقع: ${saved.name || saved.data.location_name || "غير معروف"}
                </div>

                <div>
                    آخر مؤشر مطر محفوظ: ${best.rain_score ?? "--"}%
                </div>

                <div>
                    الحالة السابقة: ${best.alert_level || "غير متوفر"}
                </div>

                <div>
                    الحرارة السابقة: ${current.temperature ?? "--"}°C
                </div>

                <div>
                    الرطوبة السابقة: ${current.humidity ?? "--"}%
                </div>

                <div style="margin-top:8px;color:#fcd34d;">
                    وقت الحفظ: ${savedTime}
                </div>

                <div style="margin-top:10px;color:#fde68a;font-size:14px;">
                    هذه بيانات قديمة للاسترشاد فقط، ولا تغني عن التنبيهات الرسمية.
                </div>
            </div>
        </div>
    `;
}

function readOfflineEmergencyWeather() {
    const saved = getLastSuccessfulWeather();

    if (!saved) {
        showActionMessage("لا توجد بيانات محفوظة للطوارئ", "warning");
        return;
    }

    const data = saved.data;
    const current = data.current || {};
    const best = data.best_hour || current;

    const score = Number(best.rain_score) || 0;

    document.getElementById("cityName").innerText =
        saved.name || data.location_name || "آخر موقع محفوظ";

    document.getElementById("statusText").className =
        score >= 80 ? "rain-high" : score >= 60 ? "rain-medium" : "rain-low";

    document.getElementById("statusText").innerText =
        `بيانات محفوظة - ${best.alert_level || ""} - ${score}%`;

    updateRiskBar(score);
    updateLightningStormMode(score);
    updateWeatherEffectsByRisk(score);

    document.getElementById("adviceText").innerHTML = `
        ${buildOfflineEmergencyHTML(saved)}
        ${buildForecastHTML(data.next_hours)}
        ${buildDailyForecastHTML(data.daily_forecast)}
    `;

    showActionMessage("تم عرض آخر حالة محفوظة", "warning");
}
function isRainNotificationEnabled() {
    return localStorage.getItem(NOTIFICATION_ENABLED_KEY) === "true";
}

async function enableRainNotifications() {
    if (!("Notification" in window)) {
        showActionMessage("المتصفح لا يدعم الإشعارات", "warning");
        return;
    }

    if (Notification.permission === "granted") {
        localStorage.setItem(NOTIFICATION_ENABLED_KEY, "true");

        showActionMessage("تم تفعيل تنبيهات المطر", "success");

        new Notification("RainGuard AI", {
            body: "تنبيهات المطر مفعلة الآن بنجاح.",
            icon: "icon-192.png"
        });

        return;
    }

    if (Notification.permission === "denied") {
        showActionMessage("تم رفض الإشعارات من إعدادات المتصفح", "warning");
        return;
    }

    const permission = await Notification.requestPermission();

    if (permission === "granted") {
        localStorage.setItem(NOTIFICATION_ENABLED_KEY, "true");

        showActionMessage("تم تفعيل تنبيهات المطر", "success");

        new Notification("RainGuard AI", {
            body: "تم تفعيل تنبيهات المطر بنجاح.",
            icon: "icon-192.png"
        });
    } else {
        showActionMessage("لم يتم السماح بالإشعارات", "warning");
    }
}

function canSendRainNotification() {
    const lastTime = Number(localStorage.getItem(NOTIFICATION_LAST_ALERT_KEY)) || 0;
    const now = Date.now();
    const cooldown = NOTIFICATION_COOLDOWN_MINUTES * 60 * 1000;

    return now - lastTime > cooldown;
}

function markRainNotificationSent() {
    localStorage.setItem(
        NOTIFICATION_LAST_ALERT_KEY,
        String(Date.now())
    );
}

function sendRainNotification(title, message) {
    if (!isRainNotificationEnabled()) return;
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    if (!canSendRainNotification()) return;

    new Notification(title, {
        body: message,
        icon: "icon-192.png",
        badge: "icon-192.png",
        tag: "rainguard-rain-alert",
        renotify: true
    });

    markRainNotificationSent();

    if (navigator.vibrate) {
        navigator.vibrate([250, 120, 250]);
    }
}

function checkPushRainAlert(score, locationName, alertLevel) {
    score = Number(score) || 0;

    if (score >= 80) {
        sendRainNotification(
            "تحذير مطر مرتفع",
            `مؤشر المطر في ${locationName} وصل إلى ${score}% - ${alertLevel}`
        );
        return;
    }

    if (score >= 60) {
        sendRainNotification(
            "تنبيه مطر متوسط",
            `مؤشر المطر في ${locationName} وصل إلى ${score}% - تابع الحالة.`
        );
    }
}
function isBackgroundMonitorEnabled() {
    return localStorage.getItem(BACKGROUND_MONITOR_KEY) === "true";
}

function updateBackgroundMonitorStatus(message = "") {
    const box = document.getElementById("backgroundMonitorStatus");
    if (!box) return;

    const state = isBackgroundMonitorEnabled()
        ? "مفعلة"
        : "متوقفة";

    const now = new Date().toLocaleTimeString("ar-SA", {
        hour: "2-digit",
        minute: "2-digit"
    });

    box.innerText = `المراقبة الخلفية: ${state} | آخر فحص: ${now}${message ? " | " + message : ""}`;
}

async function runBackgroundRainCheck() {
    if (!isBackgroundMonitorEnabled()) return;

    try {
        const url =
            `${API_BASE_URL}/rain-alert?lat=${lastLat}&lon=${lastLon}&name=${encodeURIComponent(lastName)}&hours=12`;

        const response = await fetch(url);

        if (!response.ok) {
            updateBackgroundMonitorStatus("تعذر الاتصال");
            return;
        }

        const data = await response.json();

        if (data.error) {
            updateBackgroundMonitorStatus("تعذر قراءة البيانات");
            return;
        }

        const best = data.best_hour || data.current || {};
        const score = Number(best.rain_score) || 0;
        const alertLevel = best.alert_level || "تنبيه مطر";
        const locationName = data.location_name || lastName || "موقعك";

        checkPushRainAlert(
            score,
            locationName,
            alertLevel
        );

        saveLastSuccessfulWeather(
            data,
            lastLat,
            lastLon,
            locationName
        );

        updateBackgroundMonitorStatus(`مؤشر المطر ${score}%`);
        await runSmartMultiCityBackgroundCheck();

    } catch (error) {
        console.error(error);
        updateBackgroundMonitorStatus("خطأ أثناء الفحص");
    }
}

function startBackgroundRainMonitoring() {
    localStorage.setItem(BACKGROUND_MONITOR_KEY, "true");
    backgroundMonitorEnabled = true;

    if (backgroundMonitorInterval) {
        clearInterval(backgroundMonitorInterval);
    }

    runBackgroundRainCheck();

    backgroundMonitorInterval = setInterval(() => {
        runBackgroundRainCheck();
    }, BACKGROUND_MONITOR_INTERVAL_MINUTES * 60 * 1000);

    showActionMessage(
        `تم تشغيل المراقبة الخلفية كل ${BACKGROUND_MONITOR_INTERVAL_MINUTES} دقائق`,
        "success"
    );

    updateBackgroundMonitorStatus("تم التشغيل");
}

function stopBackgroundRainMonitoring() {
    localStorage.setItem(BACKGROUND_MONITOR_KEY, "false");
    backgroundMonitorEnabled = false;

    if (backgroundMonitorInterval) {
        clearInterval(backgroundMonitorInterval);
        backgroundMonitorInterval = null;
    }

    showActionMessage("تم إيقاف المراقبة الخلفية", "warning");
    updateBackgroundMonitorStatus("تم الإيقاف");
}

function toggleBackgroundRainMonitoring() {
    if (isBackgroundMonitorEnabled()) {
        stopBackgroundRainMonitoring();
    } else {
        startBackgroundRainMonitoring();
    }
}

function isSmartMultiCityEnabled() {
    return localStorage.getItem(SMART_MULTI_CITY_KEY) === "true";
}

function toggleSmartMultiCityMonitoring() {
    const enabled = !isSmartMultiCityEnabled();

    localStorage.setItem(
        SMART_MULTI_CITY_KEY,
        enabled ? "true" : "false"
    );

    showActionMessage(
        enabled
            ? "تم تشغيل مراقبة المدن الذكية"
            : "تم إيقاف مراقبة المدن الذكية",
        enabled ? "success" : "warning"
    );

    updateBackgroundMonitorStatus(
        enabled
            ? "مراقبة المدن الذكية مفعلة"
            : "مراقبة المدن الذكية متوقفة"
    );
}
function getLastSmartMultiCityAlert() {
    try {
        return JSON.parse(localStorage.getItem(SMART_MULTI_CITY_LAST_ALERT_KEY));
    } catch {
        return null;
    }
}

function saveLastSmartMultiCityAlert(cityName, score) {
    const item = {
        cityName,
        score,
        time: Date.now()
    };

    localStorage.setItem(
        SMART_MULTI_CITY_LAST_ALERT_KEY,
        JSON.stringify(item)
    );
}

function canSendSmartMultiCityAlert(cityName, score) {
    const lastAlert = getLastSmartMultiCityAlert();

    if (!lastAlert) return true;

    const cooldown =
        SMART_MULTI_CITY_ALERT_COOLDOWN_MINUTES * 60 * 1000;

    const elapsed =
        Date.now() - Number(lastAlert.time || 0);

    if (elapsed > cooldown) return true;

    if (
        lastAlert.cityName !== cityName &&
        score >= Number(lastAlert.score || 0) + 10
    ) {
        return true;
    }

    return false;
}

function sendSmartMultiCityAlert(city) {
    if (!city) return;

    const score = Number(city.score) || 0;

    if (score < SMART_MULTI_CITY_MIN_ALERT_SCORE) return;
    if (!canSendSmartMultiCityAlert(city.name, score)) return;

    let title = "تنبيه مطر في إحدى المدن";
    let body =
        `المدينة: ${city.name}\n` +
        `مؤشر المطر الحالي: ${score}%\n` +
        `${city.alertLevel || "تابع الحالة."}`;

    if (score >= 80) {
        title = "تحذير مطر مرتفع في " + city.name;
        body =
            `مؤشر المطر الحالي وصل إلى ${score}%\n` +
            `${city.alertLevel || "تحذير مطر مرتفع"}\n` +
            `ينصح بمتابعة الحالة والتنبيهات الرسمية.`;
    }

    sendRainNotification(title, body);
    saveLastSmartMultiCityAlert(city.name, score);
}

function sendEarlyMultiCityAlert(city) {
    if (!city) return;

    const nowScore = Number(city.score) || 0;
    const score24 = Number(city.forecast24Score) || 0;
    const score72 = Number(city.forecast72Score) || 0;

    const earlyScore = Math.max(score24, score72);

    if (earlyScore < 40) return;

    if (nowScore >= earlyScore) return;

    if (!canSendEarlyMultiCityAlert(city.name, earlyScore)) return;

    let title = "تنبيه مبكر لاحتمال المطر";
    let levelText = "تنبيه مبكر";

    if (earlyScore >= 80) {
        title = "تحذير مبكر مرتفع";
        levelText = "احتمال مرتفع لهطول الأمطار";
    } else if (earlyScore >= 60) {
        title = "تنبيه مبكر متوسط";
        levelText = "احتمال متوسط لهطول الأمطار";
    }

    const peakTime =
        city.peakHour?.time
            ? city.peakHour.time.replace("T", " ")
            : "غير متوفر";

    let advice =
        "تابع الحالة والتنبيهات الرسمية.";

    if (earlyScore >= 80) {
        advice =
            "احتمال مرتفع لفرصة المطر خلال 24-72 ساعة.";
    }

    sendRainNotification(
        title,
        `المدينة: ${city.name}\n` +
        `الآن: ${nowScore}%\n` +
        `خلال 24 ساعة: ${score24}%\n` +
        `خلال 72 ساعة: ${score72}%\n` +
        `التوقيت: ${peakTime}\n` +
        `${levelText}\n` +
        advice
    );

    saveEarlyMultiCityAlert(
        city.name,
        earlyScore
    );
}

function calculateCityFloodRisk(city) {
    if (!city) return 0;

    const rainScore = Number(city.score) || 0;
    const forecast24 = Number(city.forecast24Score) || 0;
    const forecast72 = Number(city.forecast72Score) || 0;
    const cityWeight = floodCityWeights[city.name] || 0;

    let floodRisk = 0;

    floodRisk += rainScore * 0.35;
    floodRisk += forecast24 * 0.25;
    floodRisk += forecast72 * 0.25;
    floodRisk += cityWeight;

    return Math.min(Math.round(floodRisk), 100);
}

function getTerrainRiskProfile(cityName) {
    return terrainRiskProfiles[cityName] || {
        valley: 5,
        mountain: 0,
        lowArea: 5,
        coastal: 0,
        history: 5
    };
}

function calculateTerrainRisk(cityName) {
    const profile = getTerrainRiskProfile(cityName);

    const terrainScore =
        Number(profile.valley || 0) +
        Number(profile.mountain || 0) +
        Number(profile.lowArea || 0) +
        Number(profile.coastal || 0) +
        Number(profile.history || 0);

    return Math.min(Math.round(terrainScore), 50);
}

function calculateV9FloodRisk(city) {
    if (!city) return 0;

    const baseFloodRisk = calculateCityFloodRisk(city);
    const terrainRisk = calculateTerrainRisk(city.name);

    const forecastBoost =
        Math.max(
            Number(city.forecast24Score) || 0,
            Number(city.forecast72Score) || 0
        ) >= 60
            ? 8
            : 0;

    const finalRisk =
        baseFloodRisk + terrainRisk * 0.45 + forecastBoost;

    return Math.min(Math.round(finalRisk), 100);
}

function getTerrainRiskSummary(cityName) {
    const profile = getTerrainRiskProfile(cityName);

    const items = [];

    if (profile.valley >= 12) items.push("أودية");
    if (profile.mountain >= 12) items.push("تضاريس جبلية");
    if (profile.lowArea >= 12) items.push("مناطق منخفضة");
    if (profile.coastal >= 10) items.push("قرب ساحلي");
    if (profile.history >= 10) items.push("تاريخ سيول");

    if (items.length === 0) return "حساسية تضاريسية منخفضة";

    return items.join(" + ");
}

function getFloodRiskLabel(score) {
    score = Number(score) || 0;

    if (score >= 80) return "خطر سيول مرتفع";
    if (score >= 60) return "خطر سيول متوسط";
    if (score >= 40) return "قابلية تجمع مياه";
    return "خطر منخفض";
}

function getFloodRiskIcon(score) {
    score = Number(score) || 0;

    if (score >= 80) return "🔴";
    if (score >= 60) return "🟠";
    if (score >= 40) return "🔵";
    return "🟢";
}

function canSendFloodPredictionAlert(cityName, score) {
    const saved = JSON.parse(
        localStorage.getItem(FLOOD_PREDICTION_ALERT_KEY) || "null"
    );

    if (!saved) return true;

    const cooldown = 6 * 60 * 60 * 1000;
    const elapsed = Date.now() - Number(saved.time || 0);

    if (elapsed > cooldown) return true;

    if (
        saved.cityName !== cityName &&
        score >= Number(saved.score || 0) + 10
    ) {
        return true;
    }

    return false;
}

function saveFloodPredictionAlert(cityName, score) {
    localStorage.setItem(
        FLOOD_PREDICTION_ALERT_KEY,
        JSON.stringify({
            cityName,
            score,
            time: Date.now()
        })
    );
}

function sendFloodPredictionAlert(city) {
    if (!city) return;

    const floodScore = Number(city.floodRiskScore) || 0;

    if (floodScore < FLOOD_RISK_MEDIUM_SCORE) return;
    if (!canSendFloodPredictionAlert(city.name, floodScore)) return;

    let title = "تنبيه سيول متوسط";
    let advice = "راقب الحالة وتجنب مجاري السيول عند هطول المطر.";

    if (floodScore >= FLOOD_RISK_HIGH_SCORE) {
        title = "تحذير سيول مرتفع";
        advice = "تجنب الأودية والأنفاق والمناطق المنخفضة فوراً، وتابع التنبيهات الرسمية.";
    }

    sendRainNotification(
        title,
        `المدينة: ${city.name}\n` +
        `مؤشر السيول: ${floodScore}%\n` +
        `مؤشر المطر الآن: ${city.score}%\n` +
        `خلال 24 ساعة: ${city.forecast24Score}%\n` +
        `خلال 72 ساعة: ${city.forecast72Score}%\n` +
        `${getFloodRiskLabel(floodScore)}\n` +
        advice
    );

    saveFloodPredictionAlert(city.name, floodScore);
}

function renderFloodPredictionPanel(results) {
    const box = document.getElementById("floodPredictionBox");
    if (!box) return;

    if (!results || results.length === 0) {
        box.innerHTML = "لا توجد بيانات سيول حالياً.";
        return;
    }

    const ranked = [...results]
        .filter(city => city.floodRiskScore !== undefined)
        .sort((a, b) => {
            if (b.floodRiskScore !== a.floodRiskScore) {
                return b.floodRiskScore - a.floodRiskScore;
            }

            if (b.forecast72Score !== a.forecast72Score) {
                return b.forecast72Score - a.forecast72Score;
            }

            if (b.forecast24Score !== a.forecast24Score) {
                return b.forecast24Score - a.forecast24Score;
            }

            return b.score - a.score;
        })
        .slice(0, 5);

    box.innerHTML = ranked.map((city, index) => {
        const floodScore = Number(city.floodRiskScore) || 0;
        const icon = getFloodRiskIcon(floodScore);
        const label = getFloodRiskLabel(floodScore);

        let color = "#22c55e";
        let action = "المتابعة الدورية كافية.";

        if (floodScore >= FLOOD_RISK_HIGH_SCORE) {
            color = "#ef4444";
            action = "تجنب الأودية والأنفاق والمناطق المنخفضة فوراً.";
        } else if (floodScore >= FLOOD_RISK_MEDIUM_SCORE) {
            color = "#f59e0b";
            action = "راقب الحالة وتجنب مجاري السيول عند هطول المطر.";
        } else if (floodScore >= FLOOD_RISK_WATCH_SCORE) {
            color = "#38bdf8";
            action = "احتمال تجمعات مياه محدود، تابع التحديثات.";
        }

        return `
            <div style="
                padding:14px;
                margin-bottom:12px;
                border-radius:16px;
                background:#0f172a;
                border:1px solid #334155;
            ">
                <div style="
                    display:flex;
                    justify-content:space-between;
                    align-items:center;
                    gap:10px;
                ">
                    <strong
    onclick="openCityForecastPopup('${city.name}')"
    style="font-size:18px; cursor:pointer;"
>
    ${index + 1}. ${icon} ${city.name}
</strong>

                    <strong style="
                        color:${color};
                        font-size:22px;
                    ">
                        ${floodScore}%
                    </strong>
                </div>

                <div style="
                    margin-top:8px;
                    color:#cbd5e1;
                    font-size:14px;
                    line-height:1.8;
                ">
                    التصنيف: ${label}<br>
                    مؤشر المطر الآن: ${city.score}%<br>
                    توقع 24 ساعة: ${city.forecast24Score}%<br>
                    توقع 72 ساعة: ${city.forecast72Score}%<br>
                    وزن حساسية المدينة: ${floodCityWeights[city.name] || 0}<br>
                    عامل التضاريس V9: ${city.terrainRiskScore || 0}<br>
سبب الخطورة: ${city.terrainSummary || "غير محدد"}<br>
                    الإجراء المقترح: ${action}
                </div>
            </div>
        `;
    }).join("");
}

function getFloodMapColor(score) {
    score = Number(score) || 0;

    if (score >= 80) return "#ef4444";
    if (score >= 60) return "#f59e0b";
    if (score >= 40) return "#38bdf8";
    return "#22c55e";
}

function getFloodMapRadius(score) {
    score = Number(score) || 0;

    if (score >= 80) return 42000;
    if (score >= 60) return 34000;
    if (score >= 40) return 26000;
    return 16000;
}

function clearFloodMapLayer() {
    if (!map || !floodMapLayer) return;

    floodMapLayer.forEach(layer => {
        map.removeLayer(layer);
    });

    floodMapLayer = [];
}

function updateFloodRiskMap(results) {
    if (!map) return;
    if (!results || results.length === 0) return;

    clearFloodMapLayer();

    results.forEach(city => {
        const floodScore = Number(city.floodRiskScore) || 0;
        const color = getFloodMapColor(floodScore);
        const radius = getFloodMapRadius(floodScore);
        const label = getFloodRiskLabel(floodScore);

        const circle = L.circle(
            [city.lat, city.lon],
            {
                color,
                fillColor: color,
                fillOpacity: 0.28,
                radius
            }
        );

        circle.bindPopup(`
    <b>${city.name}</b><br>
    مؤشر السيول: ${floodScore}%<br>
    التصنيف: ${label}<br>
    عامل التضاريس V9: ${city.terrainRiskScore || 0}<br>
    سبب الخطورة: ${city.terrainSummary || "غير محدد"}<br>
    المطر الآن: ${city.score}%<br>
    24 ساعة: ${city.forecast24Score}%<br>
    72 ساعة: ${city.forecast72Score}%
`);

        if (floodMapEnabled) {
            circle.addTo(map);
        }

        floodMapLayer.push(circle);
    });
}

function toggleFloodRiskMap() {
    floodMapEnabled = !floodMapEnabled;

    if (!map || floodMapLayer.length === 0) {
        showActionMessage(
            floodMapEnabled
                ? "تم تفعيل خريطة السيول، سيتم عرضها بعد التحديث القادم"
                : "تم إيقاف خريطة السيول",
            floodMapEnabled ? "success" : "warning"
        );
        return;
    }

    floodMapLayer.forEach(layer => {
        if (floodMapEnabled) {
            layer.addTo(map);
        } else {
            map.removeLayer(layer);
        }
    });

    showActionMessage(
        floodMapEnabled
            ? "تم تشغيل خريطة السيول"
            : "تم إيقاف خريطة السيول",
        floodMapEnabled ? "success" : "warning"
    );
}

function getLastV82FloodAlert() {
    try {
        return JSON.parse(localStorage.getItem(FLOOD_ALERT_LAST_KEY));
    } catch {
        return null;
    }
}

function canSendV82FloodAlert(cityName, floodScore) {
    const last = getLastV82FloodAlert();

    if (!last) return true;

    const cooldown = FLOOD_ALERT_COOLDOWN_MINUTES * 60 * 1000;
    const elapsed = Date.now() - Number(last.time || 0);

    if (elapsed > cooldown) return true;

    if (
        last.cityName !== cityName &&
        floodScore >= Number(last.floodScore || 0) + 10
    ) {
        return true;
    }

    return false;
}

function saveV82FloodAlert(cityName, floodScore, level) {
    localStorage.setItem(
        FLOOD_ALERT_LAST_KEY,
        JSON.stringify({
            cityName,
            floodScore,
            level,
            time: Date.now()
        })
    );
}

function sendV82FloodAlert(city) {
    if (!city) return;

    const floodScore = Number(city.floodRiskScore) || 0;

    if (floodScore < FLOOD_ALERT_WATCH_SCORE) return;
    if (!canSendV82FloodAlert(city.name, floodScore)) return;

    let title = "تنبيه مراقبة سيول";
    let level = "مراقبة";
    let advice = "يوجد احتمال محدود لتجمعات مياه. تابع التحديثات.";

    if (floodScore >= FLOOD_ALERT_EXTREME_SCORE) {
        title = "تحذير سيول شديد";
        level = "شديد";
        advice = "تجنب الأودية والأنفاق والمناطق المنخفضة فوراً، وتابع التنبيهات الرسمية.";
    } else if (floodScore >= FLOOD_ALERT_HIGH_SCORE) {
        title = "تنبيه سيول مرتفع";
        level = "مرتفع";
        advice = "تجنب مجاري السيول والمناطق المنخفضة عند هطول المطر.";
    }

    sendRainNotification(
        title,
        `المدينة: ${city.name}\n` +
        `مؤشر السيول: ${floodScore}%\n` +
        `التصنيف: ${level}\n` +
        `المطر الآن: ${city.score}%\n` +
        `خلال 24 ساعة: ${city.forecast24Score}%\n` +
        `خلال 72 ساعة: ${city.forecast72Score}%\n` +
        advice
    );

    saveV82FloodAlert(city.name, floodScore, level);
}
async function runSmartMultiCityBackgroundCheck(force = false) {
    if (!force) {
        if (!isSmartMultiCityEnabled()) return;
        if (!isBackgroundMonitorEnabled()) return;
    }

    const results = [];

    for (const city of smartMultiCityMonitorList) {
        try {
            const url =
                `${API_BASE_URL}/rain-alert?lat=${city.lat}&lon=${city.lon}&name=${encodeURIComponent(city.name)}&hours=${SMART_MULTI_CITY_FORECAST_HOURS}`;

            const response = await fetch(url);

            if (!response.ok) continue;

            const data = await response.json();

            if (data.error) continue;

            const best = data.best_hour || data.current || {};
            const current = data.current || {};
            const nextHours = Array.isArray(data.next_hours)
                ? data.next_hours
                : [];

            const score =
                Number(best.rain_score) ||
                Number(current.rain_score) ||
                0;

            const forecast24Score = getMaxScoreByRange(nextHours, 24);
            const forecast72Score = getMaxScoreByRange(nextHours, 72);
            const peakHour = getPeakHourByRange(nextHours, 72);

            const alertLevel =
                best.alert_level ||
                current.alert_level ||
                "تنبيه مطر";

            const forecastTiming =
                classifyForecastTiming(score, forecast24Score, forecast72Score);

            results.push({
    name: city.name,
    lat: city.lat,
    lon: city.lon,
    score,
    forecast24Score,
    forecast72Score,

    terrainRiskScore: calculateTerrainRisk(city.name),
    terrainSummary: getTerrainRiskSummary(city.name),

    floodRiskScore: calculateV9FloodRisk({
        name: city.name,
        score,
        forecast24Score,
        forecast72Score
    }),
                actualRiskScore: Math.round(
    (Number(score) || 0) * 0.5 +
    (Number(calculateV9FloodRisk({
        name: city.name,
        score,
        forecast24Score,
        forecast72Score
    })) || 0) * 0.3 +
    (Number(calculateTerrainRisk(city.name)) || 0) * 0.2
),
                
    peakHour,
    forecastTiming,
    alertLevel,
   source: data.source || "Unknown",
subZones: await analyzeSubCityRainZones(city.name)
});

        } catch (error) {
            console.error(error);
        }
    }

    if (results.length === 0) {
        updateBackgroundMonitorStatus("تعذر فحص المدن الذكية");
        renderSmartMultiCityTopPanel([]);
        renderSmartMultiCityForecastPanel([]);
        return;
    }

results.sort((a, b) => {
    const aActualRisk =
        (Number(a.score) || 0) * 0.5 +
        (Number(a.floodRiskScore) || 0) * 0.3 +
        (Number(a.terrainRiskScore) || 0) * 0.2;

    const bActualRisk =
        (Number(b.score) || 0) * 0.5 +
        (Number(b.floodRiskScore) || 0) * 0.3 +
        (Number(b.terrainRiskScore) || 0) * 0.2;

    return bActualRisk - aActualRisk;
});
    const highestFloodCity = results[0];

console.log(
    "أعلى خطر سيول:",
    highestFloodCity.name,
    calculateCityFloodRisk(highestFloodCity) + "%"
);

    const topCities = results.slice(0, SMART_MULTI_CITY_TOP_LIMIT);
const topCityNow = topCities[0];

const setTopRiskText = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.innerText = value;
};

if (topCityNow) {
    setTopRiskText("topRiskCity", topCityNow.name || "غير محدد");

    setTopRiskText(
        "topRiskScore",
        `${topCityNow.actualRiskScore ?? topCityNow.score ?? "--"}%`
    );

    setTopRiskText(
        "topRiskDetails",
        topCityNow.alertLevel || "تم تحديث البيانات"
    );
}

    const forecastRanked = [...results].sort((a, b) =>
        b.forecast72Score - a.forecast72Score
    );

    const topForecastCity = forecastRanked[0];
    
    window.lastMultiCityResults = results;
    window.openCityForecastPopup = openCityForecastPopup;
    renderSmartMultiCityTopPanel(results);
    renderFloodWatchCitiesPanel(results);
    renderSmartMultiCityForecastPanel(results);
    renderFloodPredictionPanel(results);
    updateFloodRiskMap(results);
    saveSmartMultiCityHistory(topCities);

    updateBackgroundMonitorStatus(
        `الآن: ${topCityNow.name} ${topCityNow.score}% | 72 ساعة: ${topForecastCity.name} ${topForecastCity.forecast72Score}%`
    );

    sendSmartMultiCityAlert(topCityNow);
    sendEarlyMultiCityAlert(topForecastCity);
    const floodRanked = [...results]
    .filter(city => city.floodRiskScore !== undefined)
    .sort((a, b) => {
        if (b.floodRiskScore !== a.floodRiskScore) {
            return b.floodRiskScore - a.floodRiskScore;
        }

        if (b.forecast72Score !== a.forecast72Score) {
            return b.forecast72Score - a.forecast72Score;
        }

        if (b.forecast24Score !== a.forecast24Score) {
            return b.forecast24Score - a.forecast24Score;
        }

        return b.score - a.score;
    });

sendFloodPredictionAlert(floodRanked[0]);
sendV82FloodAlert(floodRanked[0]);    
}

function saveSmartMultiCityHistory(topCities) {
    const saved =
        JSON.parse(localStorage.getItem(SMART_MULTI_CITY_HISTORY_KEY)) || [];

    const now = new Date().toLocaleString("ar-SA", {
        hour: "2-digit",
        minute: "2-digit",
        day: "numeric",
        month: "short"
    });

    const item = {
        time: now,
        cities: topCities.map(city => ({
            name: city.name,
            score: city.score,
            alertLevel: city.alertLevel,
            source: city.source || "Unknown"
        }))
    };

    saved.unshift(item);

    localStorage.setItem(
        SMART_MULTI_CITY_HISTORY_KEY,
        JSON.stringify(saved.slice(0, 20))
    );

    renderSmartMultiCityHistory();
}

function renderSmartMultiCityHistory() {
    const box = document.getElementById("smartMultiCityHistoryBox");
    if (!box) return;

    const saved =
        JSON.parse(localStorage.getItem(SMART_MULTI_CITY_HISTORY_KEY)) || [];

    if (saved.length === 0) {
        box.innerHTML = "لا يوجد سجل مراقبة مدن حتى الآن.";
        return;
    }

    box.innerHTML = saved.slice(0, 5).map(item => {
        const rows = item.cities.map(city => {
            let color = "#22c55e";
            let icon = "🟢";

            if (city.score >= 80) {
                color = "#ef4444";
                icon = "🔴";
            } else if (city.score >= 60) {
                color = "#f59e0b";
                icon = "🟠";
            } else if (city.score >= 40) {
                color = "#38bdf8";
                icon = "🔵";
            }

            return `
                <div style="
                    display:flex;
                    justify-content:space-between;
                    align-items:center;
                    padding:8px 0;
                    border-bottom:1px solid #1e293b;
                ">
                    <span>${icon} ${city.name}</span>
                    <strong style="color:${color};">${city.score}%</strong>
                </div>
            `;
        }).join("");

        return `
            <div style="
                margin-bottom:14px;
                padding:14px;
                border-radius:16px;
                background:#020617;
                border:1px solid #334155;
            ">
                <div style="
                    color:#94a3b8;
                    margin-bottom:8px;
                    font-size:14px;
                ">
                    ${item.time}
                </div>

                ${rows}
            </div>
        `;
    }).join("");
}
function buildCityHourlyMiniForecast(city) {

    const forecast = [
        { time: "الآن", rain: city.score || 0 },
        { time: "+3 ساعات", rain: Math.max((city.score || 0) - 3, 0) },
        { time: "+6 ساعات", rain: Math.max((city.score || 0) - 5, 0) },
        { time: "+9 ساعات", rain: Math.max((city.score || 0) - 8, 0) },
        { time: "+12 ساعة", rain: Math.max((city.score || 0) - 10, 0) }
    ];

    return `
        <div style="
            margin-top:15px;
            padding-top:10px;
            border-top:1px solid #334155;
        ">
            <h3 style="color:#38bdf8;">
                ⏰ توقع 12 ساعة القادمة
            </h3>

            ${forecast.map(item => `
                <div style="
                    display:flex;
                    justify-content:space-between;
                    margin:6px 0;
                ">
                    <span>${item.time}</span>
                    <strong>${item.rain}%</strong>
                </div>
            `).join("")}
        </div>
    `;
}

function buildCityDailyMiniForecast(city) {
    const score = Number(city.forecast72Score || city.score || 0);

    const days = [
        { day: "اليوم", rain: Number(city.score || 0) },
        { day: "غداً", rain: Math.max(score - 2, 0) },
        { day: "بعد غد", rain: Math.max(score - 5, 0) }
    ];

    return `
        <div style="
            margin-top:15px;
            padding-top:10px;
            border-top:1px solid #334155;
        ">
            <h3 style="color:#38bdf8;">
                📅 توقع الأيام القادمة
            </h3>

            ${days.map(item => `
                <div style="
                    display:flex;
                    justify-content:space-between;
                    margin:6px 0;
                ">
                    <span>${item.day}</span>
                    <strong>${item.rain}%</strong>
                </div>
            `).join("")}
        </div>
    `;
}
function clearSmartMultiCityHistory() {
    localStorage.removeItem(SMART_MULTI_CITY_HISTORY_KEY);
    renderSmartMultiCityHistory();
    showActionMessage("تم مسح سجل مراقبة المدن الذكية", "warning");
}

window.lastMultiCityResults = [];

function openCityForecastPopup(cityName) {
    closeCityForecastPopup();

    const city = window.lastMultiCityResults.find(c => c.name === cityName);

    if (!city) {
        showActionMessage("لا توجد بيانات تفصيلية لهذه المدينة حالياً", "warning");
        return;
    }

    const subZonesHTML = renderSubZonesHTML(city.subZones);
    const hourlyHTML = buildCityHourlyMiniForecast(city);
    const dailyHTML = buildCityDailyMiniForecast(city);

    const html = `
        <div id="cityForecastModal" class="rg-modal">
            <div class="rg-modal-content">
                <button class="rg-modal-close" onclick="closeCityForecastPopup()">×</button>

                <h2>تفاصيل ${city.name}</h2>

                <div class="rg-modal-score">
                    مؤشر الخطر الفعلي: ${city.actualRiskScore ?? city.score}%
                </div>

                <button id="refreshCityBtn" onclick="refreshCityForecastPopup('${city.name}')" style="
                    width:100%;
                    margin-top:12px;
                    padding:12px;
                    border-radius:14px;
                    border:1px solid #38bdf8;
                    background:#082f49;
                    color:#e0f2fe;
                    font-weight:bold;
                    cursor:pointer;
                ">
                    🔄 تحديث بيانات المدينة
                </button>

                <div class="rg-modal-grid">
                    <div>المطر الآن: <strong>${city.score}%</strong></div>
                    <div>السيول: <strong>${city.floodRiskScore ?? "--"}%</strong></div>
                    <div>التضاريس: <strong>${city.terrainRiskScore ?? "--"}%</strong></div>
                    <div>24 ساعة: <strong>${city.forecast24Score ?? "--"}%</strong></div>
                    <div>72 ساعة: <strong>${city.forecast72Score ?? "--"}%</strong></div>
                </div>

                <div style="
                    margin-top:16px;
                    margin-bottom:8px;
                    color:#38bdf8;
                    font-weight:bold;
                ">
                    🗺️ خريطة المدينة والمناطق الداخلية
                </div>

                <div id="cityMiniMap" style="
                    height:220px;
                    margin-top:15px;
                    border-radius:16px;
                    overflow:hidden;
                    border:1px solid #334155;
                "></div>

                <div class="rg-modal-section">
                    ${subZonesHTML || "لا توجد مناطق فرعية لهذه المدينة."}
                </div>

                <div class="rg-modal-section">
                    ${hourlyHTML}
                </div>

                <div class="rg-modal-section">
                    ${dailyHTML}
                </div>

                <div class="rg-modal-note">
                    المصدر: ${city.source || "Unknown"}<br>
                    الحالة: ${city.alertLevel || "غير متوفر"}
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML("beforeend", html);

    const cityModal = document.getElementById("cityForecastModal");

    if (cityModal) {
        cityModal.addEventListener("click", closeCityForecastPopupOnOutsideClick);
    }

    setTimeout(() => {
        if (!city.lat || !city.lon || !window.L) return;

        const miniMap = L.map("cityMiniMap", {
            zoomControl: false,
            attributionControl: false
        }).setView([city.lat, city.lon], 10);

        L.tileLayer(
            "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
            { maxZoom: 18 }
        ).addTo(miniMap);

        L.marker([city.lat, city.lon]).addTo(miniMap);

        if (city.subZones && city.subZones.length > 0) {
            city.subZones.forEach(zone => {
                if (!zone.lat || !zone.lon) return;

                const zoneColor =
                    zone.score >= 60 ? "red" :
                    zone.score >= 30 ? "orange" :
                    zone.score >= 15 ? "yellow" :
                    "green";

                L.circleMarker([zone.lat, zone.lon], {
                    radius: 8,
                    color: zoneColor,
                    fillColor: zoneColor,
                    fillOpacity: 0.75
                })
                .bindPopup(`
                    <strong>${zone.name}</strong><br>
                    احتمال المطر: ${zone.score}%<br>
                    مؤشر السيول: ${zone.floodRiskScore ?? "--"}%<br>
                    <span style="color:#38bdf8;">
                        ${
                            zone.score >= 60 ? "تنبيه مرتفع" :
                            zone.score >= 30 ? "تنبيه متوسط" :
                            zone.score >= 15 ? "احتمال محدود" :
                            "منخفض"
                        }
                    </span>
                `)
                .addTo(miniMap);
            });
        }

        setTimeout(() => {
            miniMap.invalidateSize();
        }, 300);

    }, 300);
}

function closeCityForecastPopup() {
    const modal = document.getElementById("cityForecastModal");
    if (modal) modal.remove();
}

async function refreshCityForecastPopup(cityName) {
    const btn = document.getElementById("refreshCityBtn");

    if (btn) {
        btn.disabled = true;
        btn.style.opacity = "0.6";
        btn.style.cursor = "not-allowed";
        btn.innerText = "⏳ جاري تحديث بيانات المدينة...";
    }

    showActionMessage("جاري تحديث بيانات المدينة...", "warning");

    await runSmartMultiCityBackgroundCheck(true);

    closeCityForecastPopup();

    setTimeout(() => {
        openCityForecastPopup(cityName);
    }, 500);
}

function closeCityForecastPopupOnOutsideClick(event) {
    const modal = document.getElementById("cityForecastModal");
    const content = document.querySelector("#cityForecastModal .rg-modal-content");

    if (!modal || !content) return;

    if (event.target === modal) {
        closeCityForecastPopup();
    }
}

function renderSubZonesHTML(subZones) {
    if (!subZones || subZones.length === 0) return "";

    const getZoneStyle = (score) => {
        score = Number(score) || 0;

        if (score >= 60) {
            return { color: "#ef4444", icon: "🔴", label: "مرتفع" };
        }

        if (score >= 30) {
            return { color: "#f59e0b", icon: "🟠", label: "متوسط" };
        }

        if (score >= 15) {
            return { color: "#facc15", icon: "🟡", label: "محدود" };
        }

        return { color: "#22c55e", icon: "🟢", label: "منخفض" };
    };

    const topZones = [...subZones]
        .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
        .slice(0, 5);

    const highestZone = topZones[0];

    const highestStyle = highestZone
        ? getZoneStyle(highestZone.score)
        : null;

    return `
        <div style="
            margin-top:10px;
            padding-top:10px;
            border-top:1px solid #334155;
            color:#cbd5e1;
        ">
            <strong style="color:#38bdf8;">
                📍 متابعة المناطق الداخلية
            </strong>

            ${
                highestZone
                    ? `
                        <div style="
                            margin-top:12px;
                            padding:12px;
                            border-radius:14px;
                            background:#020617;
                            border:1px solid ${highestStyle.color};
                            color:#e5e7eb;
                        ">
                            <div style="color:${highestStyle.color};font-weight:bold;">
                                🔥 أخطر حي حالياً
                            </div>

                            <div style="
                                display:flex;
                                justify-content:space-between;
                                margin-top:8px;
                                align-items:center;
                            ">
                                <span>${highestStyle.icon} ${highestZone.name}</span>

                                <strong style="
                                    color:${highestStyle.color};
                                    font-size:20px;
                                ">
                                    ${highestZone.score}%
                                </strong>
                            </div>

                            <div style="
                                margin-top:6px;
                                color:#94a3b8;
                                font-size:13px;
                            ">
                                التصنيف: ${highestStyle.label}
                            </div>
                        </div>
                    `
                    : ""
            }

            ${topZones.map(zone => {
                const z = getZoneStyle(zone.score);

                return `
                    <div style="
                        display:flex;
                        justify-content:space-between;
                        align-items:center;
                        margin-top:8px;
                        font-size:14px;
                        padding:6px 0;
                        border-bottom:1px solid rgba(51,65,85,0.55);
                    ">
                        <span style="
                            display:flex;
                            align-items:center;
                            gap:8px;
                        ">
                            <span style="
                                width:8px;
                                height:28px;
                                border-radius:8px;
                                background:${z.color};
                                display:inline-block;
                            "></span>

                            ${z.icon} ${zone.name}
                        </span>

                        <strong style="color:${z.color};">
                            ${zone.score}% - ${z.label}
                        </strong>
                    </div>
                `;
            }).join("")}
        </div>
    `;
}

function renderSmartMultiCityTopPanel(results) {

    const box = document.getElementById("smartMultiCityTopBox");
    if (!box) return;

    if (!results || results.length === 0) {
        box.innerHTML = "لا توجد بيانات أمطار حالياً.";
        return;
    }

    const rainCities = [...results]
        .sort((a, b) =>
            Number(b.score || 0) - Number(a.score || 0)
        );

    const topRainCity = rainCities[0];

    const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.innerText = value;
    };

    if (topRainCity) {

        setText(
            "topRiskCity",
            topRainCity.name || "غير محدد"
        );

        setText(
            "topRiskScore",
            `${topRainCity.score || 0}%`
        );

        setText(
            "topRiskDetails",
            topRainCity.score >= 70
                ? "مطر مؤكد"
                : topRainCity.score >= 40
                ? "احتمال مطر"
                : "لا يوجد تنبيه مطر"
        );
    }

    const topCities = rainCities
    .filter(city => Number(city.score || 0) >= 50)
    .slice(0, 5);

if (topCities.length === 0) {
    box.innerHTML = `
        <div style="
            padding:18px;
            text-align:center;
            color:#94a3b8;
            line-height:2;
        ">
            🌤️ لا توجد مدن عليها أمطار تستدعي التنبيه حالياً
            <br>
            يتم عرض المدن فقط إذا كان مؤشر المطر 50% أو أعلى.
        </div>
    `;

    return;
}

    box.innerHTML = topCities.map((city, index) => {

        const rainScore = Number(city.score || 0);

        let color = "#22c55e";
        let icon = "🟢";
        let label = "ضعيف";

        if (rainScore >= 80) {
            color = "#ef4444";
            icon = "🔴";
            label = "مطر مؤكد";
        }
        else if (rainScore >= 60) {
            color = "#f59e0b";
            icon = "🟠";
            label = "مرتفع";
        }
        else if (rainScore >= 40) {
            color = "#38bdf8";
            icon = "🔵";
            label = "متوسط";
        }

        return `
            <div
                onclick="openCityForecastPopup('${city.name}')"
                style="
                    padding:14px;
                    margin-bottom:12px;
                    border-radius:16px;
                    background:#0f172a;
                    border:1px solid ${color};
                    cursor:pointer;
                "
            >
                <div style="
                    display:flex;
                    justify-content:space-between;
                    align-items:center;
                ">
                    <strong>
                        ${index + 1}. ${icon} ${city.name}
                    </strong>

                    <strong style="
                        color:${color};
                        font-size:22px;
                    ">
                        ${rainScore}%
                    </strong>
                </div>

                <div style="
                    margin-top:8px;
                    color:#cbd5e1;
                    line-height:1.8;
                    font-size:14px;
                ">
                    مستوى المطر: ${label}<br>
                    المطر الآن: ${rainScore}%<br>
                    خلال 24 ساعة: ${city.forecast24Score || 0}%<br>
                    الحالة:
                    ${
                        rainScore >= 70
                        ? "🌧️ مطر مؤكد"
                        : rainScore >= 40
                        ? "⛅ احتمال مطر"
                        : "☀️ لا يوجد تنبيه مطر"
                    }
                </div>
            </div>
        `;
    }).join("");
}

function getMaxScoreByRange(hours, maxHours) {
    if (!hours || hours.length === 0) return 0;

    return Math.max(
        ...hours.slice(0, maxHours).map(hour =>
            Number(hour.rain_score) || 0
        )
    );
}

function getPeakHourByRange(hours, maxHours) {
    if (!hours || hours.length === 0) return null;

    const sliced = hours.slice(0, maxHours);

    let peak = sliced[0];

    sliced.forEach(hour => {
        if ((Number(hour.rain_score) || 0) > (Number(peak.rain_score) || 0)) {
            peak = hour;
        }
    });

    return peak;
}

function classifyForecastTiming(scoreNow, score24, score72) {
    if (scoreNow >= 60) return "الآن";
    if (score24 >= 60) return "قريب خلال 24 ساعة";
    if (score72 >= 60) return "لاحق خلال 72 ساعة";
    return "منخفض";
}

function canSendEarlyMultiCityAlert(cityName, score) {
    const saved = JSON.parse(
        localStorage.getItem(SMART_MULTI_CITY_EARLY_ALERT_KEY) || "null"
    );

    if (!saved) return true;

    const cooldown = 6 * 60 * 60 * 1000;
    const elapsed = Date.now() - Number(saved.time || 0);

    if (elapsed > cooldown) return true;

    if (saved.cityName !== cityName && score >= Number(saved.score || 0) + 10) {
        return true;
    }

    return false;
}

function saveEarlyMultiCityAlert(cityName, score) {
    localStorage.setItem(
        SMART_MULTI_CITY_EARLY_ALERT_KEY,
        JSON.stringify({
            cityName,
            score,
            time: Date.now()
        })
    );
}

function renderFloodWatchCitiesPanel(results) {
    const box = document.getElementById("floodWatchCitiesBox");
    if (!box) return;

    if (!results || results.length === 0) {
        box.innerHTML = "لا توجد بيانات سيول حالياً.";
        return;
    }

    const floodCities = [...results]
        .filter(city => Number(city.floodRiskScore || 0) >= 60)
        .sort((a, b) =>
            Number(b.floodRiskScore || 0) - Number(a.floodRiskScore || 0)
        );

    if (floodCities.length === 0) {
        box.innerHTML = `
            <div style="
                color:#94a3b8;
                line-height:1.8;
            ">
                لا توجد مدن معرضة للسيول حالياً.
            </div>
        `;
        return;
    }

    box.innerHTML = floodCities.slice(0, 6).map(city => {
        const floodScore = Number(city.floodRiskScore || 0);
        const rainScore = Number(city.score || 0);
        const forecast24 = Number(city.forecast24Score || 0);

        let color = "#f59e0b";
        let icon = "🟠";
        let label = "خطر سيول متوسط";

        if (floodScore >= 80) {
            color = "#ef4444";
            icon = "🔴";
            label = "خطر سيول مرتفع";
        }

        return `
            <div
                onclick="openCityForecastPopup('${city.name}')"
                style="
                    padding:12px;
                    margin-bottom:10px;
                    border-radius:14px;
                    background:#0f172a;
                    border:1px solid ${color};
                    cursor:pointer;
                "
            >
                <div style="
                    display:flex;
                    justify-content:space-between;
                    align-items:center;
                    gap:10px;
                ">
                    <strong style="color:#e5e7eb;">
                        ${icon} ${city.name}
                    </strong>

                    <strong style="color:${color};font-size:20px;">
                        ${floodScore}%
                    </strong>
                </div>

                <div style="
                    margin-top:8px;
                    color:#cbd5e1;
                    font-size:13px;
                    line-height:1.7;
                ">
                    ${label}<br>
                    مؤشر المطر الآن: ${rainScore}%<br>
                    توقع المطر 24 ساعة: ${forecast24}%<br>
                    سبب الخطورة: ${city.terrainSummary || "حساسية تضاريسية / سيول"}
                </div>
            </div>
        `;
    }).join("");
}

function renderSmartMultiCityForecastPanel(results) {
    const box = document.getElementById("smartMultiCityForecastBox");
    if (!box) return;

    if (!results || results.length === 0) {
        box.innerHTML = "لا توجد بيانات توقع مبكر حالياً.";
        return;
    }

    const ranked = [...results].sort((a, b) =>
        b.forecast72Score - a.forecast72Score
    );

    const top = ranked.slice(0, 5);

    box.innerHTML = top.map((city, index) => {
        let color = "#22c55e";
        let icon = "🟢";

        if (city.forecast72Score >= 80) {
            color = "#ef4444";
            icon = "🔴";
        } else if (city.forecast72Score >= 60) {
            color = "#f59e0b";
            icon = "🟠";
        } else if (city.forecast72Score >= 40) {
            color = "#38bdf8";
            icon = "🔵";
        }

        const peakTime =
            city.peakHour?.time
                ? city.peakHour.time.replace("T", " ")
                : "غير متوفر";

        return `
            <div style="
                padding:14px;
                margin-bottom:12px;
                border-radius:16px;
                background:#0f172a;
                border:1px solid #334155;
            ">
                <div style="
                    display:flex;
                    justify-content:space-between;
                    align-items:center;
                    gap:10px;
                ">
                    <strong style="font-size:18px;">
                        ${index + 1}. ${icon} ${city.name}
                    </strong>

                    <strong style="
                        color:${color};
                        font-size:22px;
                    ">
                        ${city.forecast72Score}%
                    </strong>
                </div>

                <div style="
                    margin-top:8px;
                    color:#cbd5e1;
                    font-size:14px;
                    line-height:1.8;
                ">
                    الآن: ${city.score}%<br>
                    خلال 24 ساعة: ${city.forecast24Score}%<br>
                    خلال 72 ساعة: ${city.forecast72Score}%<br>
                    التصنيف: ${city.forecastTiming}<br>
                    وقت الذروة المتوقع: ${peakTime}<br>
                    المصدر: ${city.source || "Unknown"}
                </div>
            </div>
        `;
    }).join("");
}

// ===============================
// Adaptive Smart Refresh AI
// ===============================
function getAdaptiveRefreshMinutes(score) {
    score = Number(score) || 0;

    if (score >= 80) return 5;
    if (score >= 60) return 10;

    return 30;
}

function applyAdaptiveRefresh(score) {
    lastRainScore = Number(score) || 0;

    const newMinutes = getAdaptiveRefreshMinutes(lastRainScore);

    if (newMinutes === adaptiveRefreshMinutes && autoRefreshEnabled) {
        return;
    }

    adaptiveRefreshMinutes = newMinutes;

    if (autoRefreshEnabled) {
        clearInterval(autoRefreshInterval);

        autoRefreshInterval = setInterval(() => {
            checkRain(lastLat, lastLon, lastName, true);
        }, adaptiveRefreshMinutes * 60 * 1000);

        updateRefreshStatus(
            `تم ضبط التحديث الذكي كل ${adaptiveRefreshMinutes} دقائق`
        );
    }
}

// ===============================
// شريط مؤشر الخطر
// ===============================
function updateRiskBar(score) {
    const riskBar = document.getElementById("riskBar");
    const riskValue = document.getElementById("riskValue");
    const riskLabel = document.getElementById("riskLabel");

    if (!riskBar || !riskValue || !riskLabel) return;

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
// Source Status Card
// ===============================
function buildSourceStatusHTML(data) {
    const source = data.source || "غير معروف";
    const cacheStatus = data.cache_status || "غير معروف";
    const recoveryReason = data.recovery_reason || "";
    const generatedAt = data.generated_at || "";
    const loadBalancer = data.load_balancer || {};
    const openweather = data.openweather || {};
    const verification = data.verification || {};

    const isHybrid = source.includes("Hybrid");
    const isOpenMeteo = source.includes("Open-Meteo");
    const isCached = cacheStatus === "cached";

    let color = "#38bdf8";
    let icon = "🔎";
    let title = "حالة المصادر";

    if (isOpenMeteo) {
        color = "#22c55e";
        icon = "✅";
        title = "المصدر الأساسي يعمل";
    }

    if (isHybrid) {
        color = "#f59e0b";
        icon = "🛟";
        title = "تم تفعيل الوضع الاحتياطي الذكي";
    }

    if (isCached) {
        color = "#38bdf8";
        icon = "💾";
        title = "تم استخدام بيانات محفوظة";
    }

    const openMeteoAvailable =
        loadBalancer.open_meteo_available === true ? "متاح" : "غير متاح / تهدئة";

    const cooldownSeconds =
        Number(loadBalancer.open_meteo_cooldown_seconds) || 0;

    const openweatherEnabled =
        loadBalancer.openweather_enabled === true ? "مفعل" : "غير مفعل";

    const strategy =
        loadBalancer.strategy || "غير متوفر";

    const confidence =
        verification.confidence || "غير متوفر";

    const confidenceScore =
        verification.confidence_score ?? "--";

    const owStatus =
        openweather.available === true ? "متاح" : "غير مستخدم أو غير متاح";

    return `
        <div class="forecast-section">
            <h3>Source Status Card</h3>

            <div style="
                margin-top:12px;
                padding:16px;
                border-radius:16px;
                background:#020617;
                border:1px solid #334155;
                color:#cbd5e1;
                line-height:1.9;
            ">
                <div style="
                    font-size:24px;
                    font-weight:bold;
                    color:${color};
                    margin-bottom:10px;
                ">
                    ${icon} ${title}
                </div>

                <div>
                    المصدر المستخدم: <strong style="color:${color};">${source}</strong>
                </div>

                <div>
                    حالة الكاش: ${cacheStatus}
                </div>

                <div>
                    Open-Meteo: ${openMeteoAvailable}
                </div>

                <div>
                    OpenWeatherMap: ${openweatherEnabled} / ${owStatus}
                </div>

                <div>
                    ثقة النظام: ${confidence} - ${confidenceScore}%
                </div>

                ${
                    cooldownSeconds > 0
                        ? `<div style="color:#f59e0b;">مدة تهدئة Open-Meteo المتبقية: ${Math.ceil(cooldownSeconds / 60)} دقيقة</div>`
                        : ""
                }

                ${
                    recoveryReason
                        ? `<div style="margin-top:8px;color:#f59e0b;">سبب التحويل: ${recoveryReason}</div>`
                        : ""
                }

                <div style="
                    margin-top:10px;
                    color:#94a3b8;
                    font-size:14px;
                ">
                    استراتيجية التشغيل: ${strategy}
                </div>

                <div style="
                    margin-top:6px;
                    color:#64748b;
                    font-size:13px;
                ">
                    وقت إنشاء البيانات: ${generatedAt}
                </div>
            </div>
        </div>
    `;
}

// ===============================
// Smart AI Confidence Engine
// ===============================
function buildConfidenceHTML(data) {
    const verification = data.verification;
    if (!verification) return "";

    const confidenceScore = Number(verification.confidence_score) || 0;
    const verified = verification.verified === true;
    const confidence = verification.confidence || "غير متوفر";
    const note = verification.note || "";

    let color = "#ef4444";
    let title = "غير مؤكد";
    let icon = "❌";

    if (confidenceScore >= 80) {
        color = "#22c55e";
        title = "ثقة عالية";
        icon = "✅";
    } else if (confidenceScore >= 60) {
        color = "#f59e0b";
        title = "ثقة متوسطة";
        icon = "⚠️";
    } else if (confidenceScore >= 40) {
        color = "#38bdf8";
        title = "ثقة محدودة";
        icon = "🔎";
    }

    const sourceText = verified
        ? "تم التحقق من مصدرين"
        : "المصدر الثاني لم يؤكد المطر";

    return `
        <div class="forecast-section">
            <h3>Smart AI Confidence Engine</h3>

            <div id="confidenceText" style="
                margin-top:12px;
                padding:16px;
                border-radius:16px;
                background:#020617;
                border:1px solid #334155;
                color:#cbd5e1;
                line-height:1.9;
            ">
                <div style="
                    font-size:24px;
                    font-weight:bold;
                    color:${color};
                    margin-bottom:10px;
                ">
                    ${icon} ${title} - ${confidenceScore}%
                </div>

                <div style="font-size:18px;">
                    ${sourceText}
                </div>

                <div style="margin-top:8px; color:#94a3b8; font-size:15px;">
                    ${confidence}
                </div>

                <div style="margin-top:8px; color:#94a3b8; font-size:14px;">
                    ${note}
                </div>
            </div>
        </div>
    `;
}

// ===============================
// Smart Radar Fusion AI
// ===============================
function buildRadarFusionHTML(data) {
    const current = data.current || {};
    const best = data.best_hour || {};
    const verification = data.verification || {};

    const rainScore = Number(best.rain_score) || 0;
    const cloudCover = Number(current.cloud_cover) || 0;
    const humidity = Number(current.humidity) || 0;
    const pressure = Number(current.pressure_hpa) || 1013;
    const windSpeed = Number(current.wind_speed) || 0;
    const rainProbability = Number(current.rain_probability) || 0;
    const confidenceScore = Number(verification.confidence_score) || rainScore;

    let fusionScore = 0;

    fusionScore += rainScore * 0.35;
    fusionScore += confidenceScore * 0.25;
    fusionScore += cloudCover * 0.15;
    fusionScore += humidity * 0.10;
    fusionScore += rainProbability * 0.10;

    if (pressure <= 1008) fusionScore += 5;
    if (windSpeed >= 15) fusionScore += 5;

    fusionScore = Math.min(Math.round(fusionScore), 100);

    let color = "#22c55e";
    let title = "حالة مستقرة";
    let icon = "🟢";
    let movement = "لا توجد مؤشرات قوية على اقتراب المطر";
    let eta = "غير متوقع حاليًا";

    if (fusionScore >= 80) {
        color = "#ef4444";
        title = "مطر محتمل بقوة";
        icon = "🔴";
        movement = "الخلايا المطرية تبدو نشطة وقد تؤثر على الموقع";
        eta = "خلال 1–3 ساعات تقريبًا";
    } else if (fusionScore >= 60) {
        color = "#f59e0b";
        title = "مطر محتمل";
        icon = "🟡";
        movement = "توجد مؤشرات اقتراب أو تشكل سحب ممطرة";
        eta = "خلال 3–6 ساعات تقريبًا";
    } else if (fusionScore >= 40) {
        color = "#38bdf8";
        title = "احتمال ضعيف إلى متوسط";
        icon = "🔵";
        movement = "المؤشرات موجودة لكنها غير قوية";
        eta = "يحتاج متابعة خلال الساعات القادمة";
    }

    return `
        <div class="forecast-section">
            <h3>Smart Radar Fusion AI</h3>

            <div style="
                margin-top:12px;
                padding:16px;
                border-radius:16px;
                background:#020617;
                border:1px solid #334155;
                color:#cbd5e1;
                line-height:1.9;
            ">
                <div style="
                    font-size:24px;
                    font-weight:bold;
                    color:${color};
                    margin-bottom:10px;
                ">
                    ${icon} ${title} - ${fusionScore}%
                </div>

                <div>
                    اتجاه الحالة: ${movement}
                </div>

                <div>
                    وقت التأثير المتوقع: ${eta}
                </div>

                <div style="margin-top:10px; color:#94a3b8; font-size:14px;">
                    يعتمد هذا المؤشر على دمج: مؤشر المطر، السحب، الرطوبة، الضغط، الرياح، وثقة المصدر الثاني.
                </div>
            </div>
        </div>
    `;
}

// ===============================
// Smart Rain Arrival Tracker AI
// ===============================
function buildRainArrivalTrackerHTML(data) {
    const current = data.current || {};
    const nextHours = data.next_hours || [];
    const best = data.best_hour || {};

    const currentScore = Number(current.rain_score) || 0;

    let nextHigherIndex = -1;
    let peakIndex = -1;
    let peakScore = 0;

    nextHours.forEach((hour, index) => {
        const score = Number(hour.rain_score) || 0;

        if (score > peakScore) {
            peakScore = score;
            peakIndex = index;
        }

        if (
            nextHigherIndex === -1 &&
            score >= Math.max(40, currentScore + 10)
        ) {
            nextHigherIndex = index;
        }
    });

    let direction = "مستقرة";
    let icon = "🟢";
    let color = "#22c55e";
    let arrivalText = "لا يوجد اقتراب واضح للمطر حاليًا";
    let recommendation = "تابع التحديثات الدورية فقط.";

    if (peakScore >= 80) {
        direction = "اقتراب قوي";
        icon = "🔴";
        color = "#ef4444";
        recommendation = "يفضل تجنب الخروج ومتابعة التنبيهات الرسمية.";
    } else if (peakScore >= 60) {
        direction = "اقتراب محتمل";
        icon = "🟡";
        color = "#f59e0b";
        recommendation = "راقب الحالة خلال الساعات القادمة.";
    } else if (peakScore >= 40) {
        direction = "مؤشرات مبكرة";
        icon = "🔵";
        color = "#38bdf8";
        recommendation = "احتمال ضعيف إلى متوسط، يحتاج متابعة.";
    }

    if (nextHigherIndex > 0) {
        arrivalText = `المؤشرات قد ترتفع خلال ${nextHigherIndex} ساعة تقريبًا`;
    } else if (peakIndex > 0) {
        arrivalText = `أعلى فرصة مطر متوقعة بعد ${peakIndex} ساعة تقريبًا`;
    } else if (peakScore >= 40) {
        arrivalText = "الفرصة الحالية قائمة وقد تتغير سريعًا";
    }

    const peakTime = best.time
        ? best.time.substring(11, 16)
        : "غير متوفر";

    return `
        <div class="forecast-section">
            <h3>Smart Rain Arrival Tracker AI</h3>

            <div style="
                margin-top:12px;
                padding:16px;
                border-radius:16px;
                background:#020617;
                border:1px solid #334155;
                color:#cbd5e1;
                line-height:1.9;
            ">
                <div style="
                    font-size:24px;
                    font-weight:bold;
                    color:${color};
                    margin-bottom:10px;
                ">
                    ${icon} ${direction}
                </div>

                <div>
                    ${arrivalText}
                </div>

                <div>
                    أعلى مؤشر متوقع: ${peakScore}% عند الساعة ${peakTime}
                </div>

                <div style="
                    margin-top:10px;
                    color:#94a3b8;
                    font-size:14px;
                ">
                    التوصية: ${recommendation}
                </div>
            </div>
        </div>
    `;
}

// ===============================
// AI Flood Risk Index
// ===============================
function buildFloodRiskHTML(data, locationName) {
    const current = data.current || {};
    const best = data.best_hour || {};
    const daily = Array.isArray(data.daily_forecast)
        ? data.daily_forecast[0] || {}
        : {};

    const rainScore = Number(best.rain_score) || 0;
    const rainProbability = Number(current.rain_probability) || 0;
    const humidity = Number(current.humidity) || 0;
    const cloudCover = Number(current.cloud_cover) || 0;
    const windSpeed = Number(current.wind_speed) || 0;
    const precipitationNow = Number(current.precipitation_mm) || 0;
    const dailyRain = Number(daily.precipitation_sum) || 0;

    const cityName = locationName || data.location_name || lastName || "";

    let floodScore = 0;

    floodScore += rainScore * 0.30;
    floodScore += rainProbability * 0.18;
    floodScore += humidity * 0.12;
    floodScore += cloudCover * 0.10;
    floodScore += Math.min(dailyRain * 4, 18);
    floodScore += Math.min(precipitationNow * 15, 12);

    if (windSpeed >= 25) floodScore += 5;
    if (windSpeed >= 40) floodScore += 8;

    const isSensitiveCity = floodSensitiveCities.some(city =>
        cityName.includes(city)
    );

    if (isSensitiveCity) {
        floodScore += 10;
    }

    floodScore = Math.min(Math.round(floodScore), 100);

    let color = "#22c55e";
    let icon = "🟢";
    let title = "خطر سيول منخفض";
    let recommendation = "لا توجد مؤشرات قوية على تجمعات مياه أو سيول.";
    let action = "المتابعة الدورية كافية.";

    if (floodScore >= 80) {
        color = "#ef4444";
        icon = "🔴";
        title = "خطر سيول مرتفع";
        recommendation = "مؤشرات قوية لاحتمال تجمعات مياه أو جريان سيول.";
        action = "تجنب الأودية والأنفاق والمناطق المنخفضة، وتابع التنبيهات الرسمية.";
    } else if (floodScore >= 60) {
        color = "#f59e0b";
        icon = "🟠";
        title = "خطر سيول متوسط";
        recommendation = "توجد مؤشرات متوسطة لاحتمال تجمعات مياه.";
        action = "راقب الحالة وتجنب مجاري السيول عند هطول المطر.";
    } else if (floodScore >= 40) {
        color = "#38bdf8";
        icon = "🔵";
        title = "احتمال تجمعات مياه محدود";
        recommendation = "المؤشرات موجودة لكنها ليست قوية.";
        action = "تابع التحديثات خاصة في المناطق المنخفضة.";
    }

    return `
        <div class="forecast-section">
            <h3>AI Flood Risk Index</h3>

            <div style="
                margin-top:12px;
                padding:16px;
                border-radius:16px;
                background:#020617;
                border:1px solid #334155;
                color:#cbd5e1;
                line-height:1.9;
            ">
                <div style="
                    font-size:24px;
                    font-weight:bold;
                    color:${color};
                    margin-bottom:10px;
                ">
                    ${icon} ${title} - ${floodScore}%
                </div>

                <div>
                    ${recommendation}
                </div>

                <div style="margin-top:8px;">
                    الإجراء المقترح: ${action}
                </div>

                <div style="
                    margin-top:10px;
                    color:#94a3b8;
                    font-size:14px;
                ">
                    يعتمد المؤشر على: شدة المطر، احتمال المطر، الرطوبة، السحب، الرياح، كمية المطر اليومية، وحساسية المدينة للسيول.
                </div>
            </div>
        </div>
    `;
}

// ===============================
// AI Multi-City Rain Monitor
// ===============================
async function updateMultiCityMonitor() {
    const box = document.getElementById("multiCityMonitorBox");
    const status = document.getElementById("multiCityStatus");

    if (!box || !status) return;

    status.innerText = "جاري تحليل المدن...";

    try {
        const results = [];

        for (const city of monitoredCities) {
            try {
                const url =
                    `${API_BASE_URL}/rain-alert?lat=${city.lat}&lon=${city.lon}&name=${encodeURIComponent(city.name)}&hours=12`;

                const response = await fetch(url);

                if (!response.ok) continue;

                const data = await response.json();

                const score =
                    Number(data?.best_hour?.rain_score) || 0;

                const source =
                    data?.source || "Unknown";

                results.push({
                    name: city.name,
                    score,
                    source
                });

            } catch (error) {
                console.error(error);
            }
        }

        results.sort((a, b) => b.score - a.score);

        if (results.length === 0) {
            box.innerHTML = "تعذر تحليل المدن حالياً.";
            status.innerText = "فشل التحديث";
            return;
        }

        box.innerHTML = results.map(city => {

            let color = "#22c55e";
            let icon = "🟢";

            if (city.score >= 80) {
                color = "#ef4444";
                icon = "🔴";
            } else if (city.score >= 60) {
                color = "#f59e0b";
                icon = "🟠";
            } else if (city.score >= 40) {
                color = "#38bdf8";
                icon = "🔵";
            }

            return `
                <div style="
                    padding:12px;
                    margin-bottom:10px;
                    border-radius:14px;
                    background:#0f172a;
                    border:1px solid #334155;
                ">
                    <div style="
                        display:flex;
                        justify-content:space-between;
                        align-items:center;
                    ">
                        <strong>
                            ${icon} ${city.name}
                        </strong>

                        <strong style="
                            color:${color};
                            font-size:20px;
                        ">
                            ${city.score}%
                        </strong>
                    </div>

                    <div style="
                        margin-top:8px;
                        color:#94a3b8;
                        font-size:13px;
                    ">
                        ${city.source}
                    </div>
                </div>
            `;
        }).join("");

        status.innerText =
            `تم تحديث ${results.length} مدينة`;

    } catch (error) {
        console.error(error);

        box.innerHTML =
            "حدث خطأ أثناء تحليل المدن.";

        status.innerText =
            "فشل التحديث";
    }
}

function toggleMultiCityAutoRefresh() {

    if (multiCityAutoRefreshEnabled) {

        clearInterval(multiCityAutoRefresh);

        multiCityAutoRefreshEnabled = false;

        showActionMessage(
            "تم إيقاف التحديث التلقائي للمدن",
            "warning"
        );

        return;
    }

    multiCityAutoRefresh = setInterval(
        updateMultiCityMonitor,
        30 * 60 * 1000
    );

    multiCityAutoRefreshEnabled = true;

    showActionMessage(
        "تم تشغيل التحديث التلقائي للمدن",
        "success"
    );
}

// ===============================
// AI Rain Heatmap System
// ===============================
async function updateRainHeatmap() {

    if (!map) return;

    if (heatmapLayer) {
        heatmapLayer.forEach(layer => {
            map.removeLayer(layer);
        });
    }

    heatmapLayer = [];

    for (const city of heatmapCities) {

        try {

            const url =
                `${API_BASE_URL}/rain-alert?lat=${city.lat}&lon=${city.lon}&name=${encodeURIComponent(city.name)}&hours=12`;

            const response = await fetch(url);

            if (!response.ok) continue;

            const data = await response.json();

            const score =
                Number(data?.best_hour?.rain_score) || 0;

            let color = "#22c55e";
            let radius = 12000;

            if (score >= 80) {
                color = "#ef4444";
                radius = 35000;
            } else if (score >= 60) {
                color = "#f59e0b";
                radius = 28000;
            } else if (score >= 40) {
                color = "#38bdf8";
                radius = 22000;
            }

            const circle = L.circle(
                [city.lat, city.lon],
                {
                    color,
                    fillColor: color,
                    fillOpacity: 0.25,
                    radius
                }
            ).addTo(map);

            circle.bindPopup(`
                <b>${city.name}</b><br>
                مؤشر المطر: ${score}%
            `);

            heatmapLayer.push(circle);

        } catch (error) {
            console.error(error);
        }
    }
}

function toggleHeatmap() {

    if (!heatmapLayer) return;

    heatmapEnabled = !heatmapEnabled;

    heatmapLayer.forEach(layer => {

        if (heatmapEnabled) {
            layer.addTo(map);
        } else {
            map.removeLayer(layer);
        }

    });

    showActionMessage(
        heatmapEnabled
            ? "تم تشغيل الخريطة الحرارية"
            : "تم إيقاف الخريطة الحرارية",
        heatmapEnabled ? "success" : "warning"
    );
}

// ===============================
// Smart Alert Engine
// ===============================
function checkSmartAlert(
    score,
    alertLevel,
    locationName
) {

    let currentLevel = "LOW";

    if (score >= 80) {
        currentLevel = "HIGH";
    } else if (score >= 60) {
        currentLevel = "MEDIUM";
    }

    if (currentLevel === lastSmartAlertLevel) {
        return;
    }

    lastSmartAlertLevel = currentLevel;

    if (currentLevel === "HIGH") {

        showActionMessage(
            `تحذير قوي: مؤشر المطر في ${locationName} وصل إلى ${score}% - ${alertLevel}`,
            "danger"
        );

    } else if (currentLevel === "MEDIUM") {

        showActionMessage(
            `تنبيه متوسط: مؤشر المطر في ${locationName} وصل إلى ${score}%`,
            "warning"
        );

    } else {

        showActionMessage(
            `الحالة مستقرة في ${locationName}`,
            "success"
        );
    }
}

// ===============================
// Map
// ===============================
function initMap(
    lat = 21.4858,
    lon = 39.1925
) {

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
                attribution:
                    "© OpenStreetMap"
            }
        ).addTo(map);

        loadRainRadar();
        console.log("Radar Loaded");
        console.log(rainLayer);

        setTimeout(() => {
            updateRainHeatmap();
        }, 2500);
        setTimeout(() => {
    if (map) map.invalidateSize();
}, 300);

setTimeout(() => {
    if (map) map.invalidateSize();
}, 1000);

setTimeout(() => {
    if (map) map.invalidateSize();
}, 2500);

    } else {

        map.setView(
            [lat, lon],
            6
        );
    }

    if (marker) {
        map.removeLayer(marker);
    }

    marker = L.marker(
        [lat, lon]
    ).addTo(map);
}

// ===============================
// Rain Radar
// ===============================
async function loadRainRadar() {

    try {

        const response = await fetch(
            "https://api.rainviewer.com/public/weather-maps.json"
        );

        const data =
            await response.json();

        if (
            !data.radar ||
            !data.radar.past ||
            data.radar.past.length === 0
        ) {
            return;
        }

        const latestRadar =
            data.radar.past[
                data.radar.past.length - 1
            ];

        const radarUrl =
            `${data.host}${latestRadar.path}/256/{z}/{x}/{y}/2/1_1.png`;

        rainLayer = L.tileLayer(
            radarUrl,
            {
                minZoom: 4,
                maxZoom: 10,
                opacity: 0.65,
                attribution:
                    "RainViewer"
            }
        );

        if (radarEnabled) {
            rainLayer.addTo(map);
        }

    } catch (error) {
        console.error(error);
    }
}

function toggleRadar() {

    if (!rainLayer) {
        return;
    }

    if (radarEnabled) {

        map.removeLayer(rainLayer);

        radarEnabled = false;

        showActionMessage(
            "تم إيقاف الرادار",
            "warning"
        );

    } else {

        rainLayer.addTo(map);

        radarEnabled = true;

        showActionMessage(
            "تم تشغيل الرادار",
            "success"
        );
    }
}

// ===============================
// Refresh Status
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
        text += ` | التحديث الذكي: مفعل كل ${adaptiveRefreshMinutes} دقائق`;
    } else {
        text += " | التحديث الذكي: غير مفعل";
    }

    if (extraMessage) {
        text += ` | ${extraMessage}`;
    }

    refreshStatus.innerText = text;
}

function refreshNow() {
    showActionMessage("جاري تحديث البيانات الآن", "success");

    checkRain(lastLat, lastLon, lastName, false);
    updateRainHeatmap();
    updateMultiCityMonitor();

    updateRefreshStatus("تم طلب تحديث يدوي");
}

function startAutoRefresh() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
    }

    adaptiveRefreshMinutes = getAdaptiveRefreshMinutes(lastRainScore);
    autoRefreshEnabled = true;

    autoRefreshInterval = setInterval(() => {
        checkRain(lastLat, lastLon, lastName, true);
        updateRainHeatmap();
    }, adaptiveRefreshMinutes * 60 * 1000);

    showActionMessage(
        `تم تفعيل التحديث الذكي كل ${adaptiveRefreshMinutes} دقائق`,
        "success"
    );

    updateRefreshStatus("تم تفعيل التحديث الذكي");
}

function stopAutoRefresh() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
    }

    autoRefreshInterval = null;
    autoRefreshEnabled = false;

    showActionMessage("تم إيقاف التحديث الذكي", "warning");
    updateRefreshStatus("تم إيقاف التحديث الذكي");
}

// ===============================
// Card Color
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
// Forecast 12 Hours
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

        const timeText =
            hour.time && hour.time.length >= 16
                ? hour.time.substring(11, 16)
                : "--:--";

        forecastHTML += `
            <div class="info-box">
                <span>${timeText}</span>
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
// Daily Forecast
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
                <strong class="${dayClass}">
                    ${day.daily_rain_score}%
                </strong>
                <div style="margin-top:8px;">
                    📅 ${dateText}
                </div>
                <div style="margin-top:5px;">
                    🌧 احتمال المطر: ${day.rain_probability_max}%
                </div>
                <div style="margin-top:5px;">
                    💦 كمية المطر: ${day.precipitation_sum} mm
                </div>
                <div style="margin-top:5px;">
                    🌡 ${day.temperature_min}° / ${day.temperature_max}°
                </div>
                <div style="margin-top:5px;">
                    💨 الرياح: ${day.wind_speed_max} كم/س
                </div>
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
// History
// ===============================
function savePredictionHistory(locationName, score, alertLevel, lat, lon) {
    const key = "rainguard_history";
    const saved = JSON.parse(localStorage.getItem(key)) || [];

    const now = new Date().toLocaleString("ar-SA", {
        hour: "2-digit",
        minute: "2-digit",
        day: "numeric",
        month: "short"
    });

    const item = {
        locationName,
        score,
        alertLevel,
        lat,
        lon,
        time: now
    };

    const filtered = saved.filter(
        oldItem => oldItem.locationName !== locationName
    );

    filtered.unshift(item);

    const limited = filtered.slice(0, 8);

    localStorage.setItem(key, JSON.stringify(limited));
    renderPredictionHistory();
}

function renderPredictionHistory() {
    const box = document.getElementById("historyBox");

    if (!box) return;

    const key = "rainguard_history";
    const saved = JSON.parse(localStorage.getItem(key)) || [];

    if (saved.length === 0) {
        box.innerHTML = "لا يوجد سجل حتى الآن.";
        return;
    }

    box.innerHTML = saved.map((item, index) => {
        let color = "#22c55e";

        if (item.score >= 80) {
            color = "#ef4444";
        } else if (item.score >= 60) {
            color = "#f59e0b";
        } else if (item.score >= 40) {
            color = "#38bdf8";
        }

        return `
            <div style="
                padding:14px;
                margin-bottom:12px;
                border-radius:16px;
                background:#0f172a;
                border:1px solid #334155;
            ">
                <strong style="font-size:22px; color:white;">
                    ${item.locationName}
                </strong>

                <br><br>

                <span style="
                    color:${color};
                    font-weight:bold;
                    font-size:22px;
                ">
                    مؤشر الخطر: ${item.score}%
                </span>

                <br>

                <span style="color:#cbd5e1; font-size:18px;">
                    ${item.alertLevel}
                </span>

                <br><br>

                <small style="color:#94a3b8;">
                    ${item.time}
                </small>

                <br><br>

                <button
                    onclick="recheckHistoryItem(${index})"
                    style="width:100%;">
                    إعادة الفحص
                </button>
            </div>
        `;
    }).join("");
}

function clearPredictionHistory() {
    localStorage.removeItem("rainguard_history");
    renderPredictionHistory();
    showActionMessage("تم مسح سجل التوقعات", "warning");
}

function recheckHistoryItem(index) {
    const key = "rainguard_history";
    const saved = JSON.parse(localStorage.getItem(key)) || [];

    const item = saved[index];

    if (!item) {
        showActionMessage("لم يتم العثور على هذا السجل", "warning");
        return;
    }

    showActionMessage(`جاري إعادة فحص ${item.locationName}`, "success");

    document.getElementById("cityInput").value = item.locationName;

    if (item.lat && item.lon) {
        checkRain(item.lat, item.lon, item.locationName);
    } else {
        detectRain();
    }

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}

// ===============================
// WhatsApp Share
// ===============================
function shareWeatherWhatsApp() {
    const riskValue = document.getElementById("riskValue")?.innerText || "--%";
    const statusText = document.getElementById("statusText")?.innerText || "غير متوفر";
    const refreshStatus = document.getElementById("refreshStatus")?.innerText || "";
    const confidenceText = document.getElementById("confidenceText")?.innerText || "";

    const message =
        `🌧 RainGuard AI\n` +
        `الموقع: ${lastName}\n` +
        `مؤشر المطر: ${riskValue}\n` +
        `الحالة: ${statusText}\n` +
        `${confidenceText}\n` +
        `${refreshStatus}\n\n` +
        `رابط التطبيق:\nhttps://rain-guard-ai.vercel.app`;

    const url = "https://wa.me/?text=" + encodeURIComponent(message);

    window.open(url, "_blank");
}

// ===============================
// Accuracy
// ===============================
function ratePrediction(isCorrect) {
    const key = "rainguard_accuracy";

    const saved = JSON.parse(localStorage.getItem(key)) || {
        total: 0,
        correct: 0
    };

    saved.total += 1;

    if (isCorrect) {
        saved.correct += 1;
        showActionMessage("تم تسجيل التقييم: التوقع صحيح", "success");
    } else {
        showActionMessage("تم تسجيل التقييم: التوقع غير صحيح", "warning");
    }

    localStorage.setItem(key, JSON.stringify(saved));
    updateAccuracyBox();
}

function updateAccuracyBox() {
    const box = document.getElementById("accuracyBox");

    if (!box) return;

    const key = "rainguard_accuracy";

    const saved = JSON.parse(localStorage.getItem(key)) || {
        total: 0,
        correct: 0
    };

    if (saved.total === 0) {
        box.innerHTML = "لم يتم تسجيل تقييمات بعد.";
        return;
    }

    const accuracy = Math.round(
        (saved.correct / saved.total) * 100
    );

    box.innerHTML = `
        عدد التقييمات: ${saved.total}<br>
        التوقعات الصحيحة: ${saved.correct}<br>
        دقة التوقع حسب تقييمك: ${accuracy}%
        <br><br>
        <button onclick="resetAccuracy()">
            مسح التقييمات
        </button>
    `;
}

function resetAccuracy() {
    localStorage.removeItem("rainguard_accuracy");
    updateAccuracyBox();
    showActionMessage("تم مسح تقييمات الدقة", "warning");
}

function updateProDashboardWidgets(data, name, score, best) {
    const current = data.current || {};

    const temperature =
        current.temperature ?? "--";

    const humidity =
        current.humidity ?? "--";

    const windSpeed =
        current.wind_speed ?? "--";

    const rainProbability =
        current.rain_probability ?? score ?? "--";

    const cloudCover =
        current.cloud_cover ?? "--";

    const pressure =
        current.pressure_hpa ?? "--";

    const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.innerText = value;
    };

    setText("topRiskCity", name || "غير محدد");
    setText("cityName", name || "غير محدد");

    setText("topRiskScore", `${score}%`);
    setText("topRiskDetails", best?.alert_level || "جاري تحليل المخاطر");

    setText("tempKpi", `${temperature}°`);
    setText("humidityKpi", `${humidity}%`);
    setText("windKpi", `${windSpeed} كم/س`);
    setText("rainProbKpi", `${rainProbability}%`);

    setText("temperatureValue", `${temperature}°C`);
    setText("humidityValue", `${humidity}%`);
    setText("cloudValue", `${cloudCover}%`);
    setText("rainChanceValue", `${rainProbability}%`);
    setText("pressureValue", `${pressure}`);
    setText("windValue", `${windSpeed}`);

    setText("aiFloodValue", `${score}%`);
    setText("radarFusionValue", `${score}%`);
}

// ===============================
// Main Rain Analysis
// ===============================
async function checkRain(
    lat,
    lon,
    name = "موقع محدد",
    silent = false,
    retryCount = 0
) {
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
            if (retryCount < 1) {
                showActionMessage(
                    "الخادم يستجيب ببطء... جاري إعادة المحاولة",
                    "warning"
                );

                await new Promise(resolve => setTimeout(resolve, 2500));

                return checkRain(
                    lat,
                    lon,
                    name,
                    silent,
                    retryCount + 1
                );
            }

            throw new Error("فشل الاتصال بالخادم");
        }

        const data = await response.json();
        saveLastSuccessfulWeather(data, lat, lon, name);

        if (data.error) {
            throw new Error(data.message || "فشل جلب البيانات");
        }

        const current = data.current || {};
        const best = data.best_hour || current;

        const score = Number(best.rain_score) || 0;

        updateProDashboardWidgets(data, name, score, best);
        updateAIWidgets(data, score, name);

        const sourceStatusHTML = buildSourceStatusHTML(data);
        const forecastHTML = buildForecastHTML(data.next_hours);
        const dailyForecastHTML = buildDailyForecastHTML(data.daily_forecast);
        const forecast12Box = document.getElementById("forecast12InlineBox");
if (forecast12Box) {
    forecast12Box.innerHTML = buildForecastHTML(data.next_hours);
}

const forecastDaysBox = document.getElementById("forecastDaysInlineBox");
if (forecastDaysBox) {
    forecastDaysBox.innerHTML = buildDailyForecastHTML(data.daily_forecast);
}
        const confidenceHTML = buildConfidenceHTML(data);
        const radarFusionHTML = buildRadarFusionHTML(data);
        const sourceStatusBox = document.getElementById("sourceStatusBox");
if (sourceStatusBox) sourceStatusBox.innerHTML = sourceStatusHTML;

const confidenceBox = document.getElementById("confidenceBox");
if (confidenceBox) confidenceBox.innerHTML = confidenceHTML;

const radarFusionBox = document.getElementById("radarFusionBox");
if (radarFusionBox) radarFusionBox.innerHTML = radarFusionHTML;
        const arrivalTrackerHTML = buildRainArrivalTrackerHTML(data);
        const floodRiskHTML = buildFloodRiskHTML(data, name);

        let className = "rain-low";

        if (score >= 80) {
            className = "rain-high";
        } else if (score >= 60) {
            className = "rain-medium";
        }

        applyAlertCardColor(score);
        updateRiskBar(score);
        updateLightningStormMode(score);
        applyAdaptiveRefresh(score);

        statusText.className = className;
        statusText.innerText = `${best.alert_level} - ${score}%`;

        checkSmartAlert(score, best.alert_level, name);
        checkPushRainAlert(score, name, best.alert_level);

        savePredictionHistory(
            name,
            score,
            best.alert_level,
            lat,
            lon
        );

        adviceText.innerHTML = `
            <p>${best.advice || ""}</p>

            ${sourceStatusHTML}
            ${confidenceHTML}
            ${radarFusionHTML}
            ${arrivalTrackerHTML}
            ${floodRiskHTML}

            <div class="info-grid">
                <div class="info-box">
                    <span>درجة الحرارة</span>
                    <strong>${current.temperature ?? "--"}°C</strong>
                </div>

                <div class="info-box">
                    <span>الرطوبة</span>
                    <strong>${current.humidity ?? "--"}%</strong>
                </div>

                <div class="info-box">
                    <span>السحب</span>
                    <strong>${current.cloud_cover ?? "--"}%</strong>
                </div>

                <div class="info-box">
                    <span>احتمال المطر</span>
                    <strong>${current.rain_probability ?? "--"}%</strong>
                </div>

                <div class="info-box">
                    <span>الضغط</span>
                    <strong>${current.pressure_hpa ?? "--"}</strong>
                </div>

                <div class="info-box">
                    <span>الرياح</span>
                    <strong>${current.wind_speed ?? "--"}</strong>
                </div>
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
        console.error(error);

        const saved = getLastSuccessfulWeather();

        if (saved && saved.data) {
            const data = saved.data;
            const current = data.current || {};
            const best = data.best_hour || current;
            const score = Number(best.rain_score) || 0;

            statusText.className =
                score >= 80 ? "rain-high" : score >= 60 ? "rain-medium" : "rain-low";

            statusText.innerText =
                `وضع الطوارئ - آخر بيانات محفوظة - ${score}%`;

            updateRiskBar(score);
            updateLightningStormMode(score);

            adviceText.innerHTML = `
                ${buildOfflineEmergencyHTML(saved)}
                ${buildForecastHTML(data.next_hours)}
                ${buildDailyForecastHTML(data.daily_forecast)}
            `;

            showActionMessage(
                "تعذر الاتصال، تم تشغيل وضع الطوارئ وعرض آخر بيانات محفوظة",
                "warning"
            );

            updateRefreshStatus("Offline Emergency Mode");
            return;
        }

        statusText.className = "rain-high";
        statusText.innerText = "تعذر الاتصال";

        adviceText.innerHTML = `
            <div style="
                color:#fecaca;
                background:#7f1d1d;
                padding:16px;
                border-radius:16px;
                margin-top:15px;
                line-height:1.8;
            ">
                تعذر جلب البيانات ولا توجد بيانات محفوظة للطوارئ.<br>
                حاول مرة أخرى بعد دقيقة.
            </div>
        `;

        showActionMessage("فشل جلب البيانات", "danger");
        updateRefreshStatus("فشل التحديث");
    }
}
// ===============================
// Location
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
// Search City
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
// Startup
// ===============================
window.onload = function () {
    document.body.classList.add("weather-safe");

    initMap();

    checkRain(21.4858, 39.1925, "جدة");
    setTimeout(() => {
    if (map) map.invalidateSize();
}, 1500);

setTimeout(() => {
    if (map) map.invalidateSize();
}, 3000);

    updateAccuracyBox();
    renderPredictionHistory();

    setTimeout(() => {
        startAutoRefresh();
        updateMultiCityMonitor();
    }, 3000);

setTimeout(() => {
    if (isBackgroundMonitorEnabled()) {
        startBackgroundRainMonitoring();
    } else {
        updateBackgroundMonitorStatus("جاهزة للتشغيل");
    }
}, 5000);
    renderSmartMultiCityHistory();
};     

function openMapAndRun(action) {
    const mapButton = document.querySelector('[onclick*="mapPanel"]');
    showProPanel("homePanel", mapButton || null);

    setTimeout(() => {
        if (action === "radar") toggleRadar();
        if (action === "flood") toggleFloodRiskMap();
        if (action === "heatmap") toggleHeatmap();
        if (action === "cities") runSmartMultiCityBackgroundCheck(true);
        if (action === "refresh") {
            refreshNow();
           runSmartMultiCityBackgroundCheck(true);
        }

        if (window.map && typeof map.invalidateSize === "function") {
            map.invalidateSize();
        }
    }, 400);
}

function updateAIWidgets(data, score, name) {
    const verification = data.verification || {};
    const confidenceScore =
        Number(verification.confidence_score) || Number(score) || 0;

    const terrainScore = calculateTerrainRisk(name);
    const floodScore = Math.min(
    100,
    Math.round(
        (Number(score) * 0.7) +
        (Number(terrainScore) * 0.3)
    )
);

    const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.innerText = value;
    };

    setText("aiConfidenceValue", confidenceScore + "%");
    setText("aiFloodValue", floodScore + "%");
    setText("radarFusionValue", score + "%");
    setText("terrainAiValue", terrainScore + "%");
}
// =====================================
// Weather Effects Engine V10
// =====================================

let weatherEffectsEnabled = true;
let lightningInterval = null;

function startWeatherEffects() {
    if (!weatherEffectsEnabled) return;

    const oldLayer = document.getElementById("weatherFx");
    if (oldLayer) oldLayer.remove();

    const layer = document.createElement("div");
    layer.id = "weatherFx";

    layer.innerHTML = `
        <div class="cloud-layer"></div>
        <div class="rain-layer"></div>
    `;

    document.body.appendChild(layer);
}

function stopWeatherEffects() {
    const oldLayer = document.getElementById("weatherFx");
    if (oldLayer) oldLayer.remove();

    stopLightningOnly();

    document.body.classList.remove(
        "fx-low",
        "fx-medium",
        "fx-high",
        "fx-danger"
    );
}

function toggleWeatherEffects() {
    weatherEffectsEnabled = !weatherEffectsEnabled;

    if (weatherEffectsEnabled) {
        startWeatherEffects();
        updateWeatherEffectsByRisk(lastRainScore);
        showActionMessage("تم تشغيل المؤثرات الجوية", "success");
    } else {
        stopWeatherEffects();
        showActionMessage("تم إيقاف المؤثرات الجوية", "warning");
    }
}

function updateWeatherEffectsByRisk(score) {
    score = Number(score) || 0;
    lastRainScore = score;

    if (!weatherEffectsEnabled) return;

    startWeatherEffects();

    document.body.classList.remove(
        "fx-low",
        "fx-medium",
        "fx-high",
        "fx-danger"
    );

    if (score >= 80) {
        document.body.classList.add("fx-danger");
        startLightning();
    } else if (score >= 60) {
        document.body.classList.add("fx-high");
        startLightning();
    } else if (score >= 40) {
        document.body.classList.add("fx-medium");
        stopLightningOnly();
    } else {
        document.body.classList.add("fx-low");
        stopLightningOnly();
    }
}

function startLightning() {
    if (lightningInterval) return;

    lightningInterval = setInterval(() => {
        const flash = document.createElement("div");
        flash.className = "lightning-flash";
        document.body.appendChild(flash);

        setTimeout(() => {
            flash.remove();
        }, 260);
    }, 9000);
}

function stopLightningOnly() {
    if (lightningInterval) {
        clearInterval(lightningInterval);
        lightningInterval = null;
    }
}
