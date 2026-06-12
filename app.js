const API_BASE_URL = "https://rainguard-ai.onrender.com";

const APP_VERSION = "RainGuard AI V12";

const TERRAIN_ENGINE_VERSION = "V12";

const CLOUD_TRACKER_VERSION = "V10";

const RAIN_ARRIVAL_ENGINE_VERSION = "V12";

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

// مهم: التنبيه يبقى من 30%
const SMART_MULTI_CITY_MIN_ALERT_SCORE = 30;

const SMART_MULTI_CITY_HISTORY_KEY = "rainguard_smart_multicity_history";
const SMART_MULTI_CITY_TOP_LIMIT = 20;
const SMART_MULTI_CITY_FORECAST_HOURS = 72;
const SMART_MULTI_CITY_EARLY_ALERT_KEY = "rainguard_smart_multicity_early_alert";

// مهم: التنبيه المبكر يبقى من 30%
const SMART_MULTI_CITY_EARLY_ALERT_MIN_SCORE = 30;

const FLOOD_PREDICTION_ALERT_KEY = "rainguard_flood_prediction_alert";
const FLOOD_RISK_MIN_ALERT_SCORE = 30;

const FLOOD_RISK_HIGH_SCORE = 80;
const FLOOD_RISK_MEDIUM_SCORE = 60;
const FLOOD_RISK_WATCH_SCORE = 30;

const FLOOD_ALERT_WATCH_SCORE = 30;
const FLOOD_ALERT_HIGH_SCORE = 60;
const FLOOD_ALERT_EXTREME_SCORE = 80;
const FLOOD_ALERT_COOLDOWN_MINUTES = 180;
const FLOOD_ALERT_LAST_KEY = "rainguard_v10_flood_alert";



let cloudMovementHistory = {};

let map;
let marker;
let rainLayer;
let heatmapLayer;

let floodMapLayer = [];
let floodMapEnabled = true;

let cloudRainMapLayer = [];
let cloudRainMapEnabled = true;

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

window.lastMultiCityResults = [];

const floodCityWeights = {
    "مكة": 15,
    "جدة": 20,
    "خليص": 14,
    "الطائف": 18,
    "الوهط - جنوب الطائف": 18,
    "الوهط": 18,
    "الهدا": 15,
    "الشفا": 15,
    "الحوية": 12,
    "بني سعد": 15,
    "ميسان": 15,
    "المحاني": 12,
    "المدينة": 12,
    "الرياض": 10,
    "الدمام": 8,
    "الخبر": 8,
    "الأحساء": 10,
    "أبها": 20,
    "خميس مشيط": 18,
    "الباحة": 18,
    "جازان": 22,
    "نجران": 16,
    "تبوك": 10,
    "حائل": 8,
    "بريدة": 8,
    "عنيزة": 8,
    "ينبع": 8,
    "العلا": 8,
    "القنفذة": 16,
    "الليث": 14,
    "رابغ": 10,
    "الجبيل": 8
};

const terrainRiskProfiles = {
    "مكة": { valley: 18, mountain: 12, lowArea: 8, coastal: 0, history: 12 },
    "جدة": { valley: 8, mountain: 0, lowArea: 15, coastal: 10, history: 15 },
    "خليص": { valley: 12, mountain: 4, lowArea: 10, coastal: 0, history: 8 },
    "الطائف": { valley: 15, mountain: 15, lowArea: 5, coastal: 0, history: 10 },
    "الوهط - جنوب الطائف": { valley: 15, mountain: 12, lowArea: 6, coastal: 0, history: 8 },
    "الوهط": { valley: 15, mountain: 12, lowArea: 6, coastal: 0, history: 8 },
    "الهدا": { valley: 12, mountain: 18, lowArea: 4, coastal: 0, history: 8 },
    "الشفا": { valley: 12, mountain: 18, lowArea: 4, coastal: 0, history: 8 },
    "الحوية": { valley: 8, mountain: 8, lowArea: 5, coastal: 0, history: 5 },
    "بني سعد": { valley: 14, mountain: 12, lowArea: 5, coastal: 0, history: 8 },
    "ميسان": { valley: 14, mountain: 12, lowArea: 5, coastal: 0, history: 8 },
    "المحاني": { valley: 10, mountain: 8, lowArea: 5, coastal: 0, history: 6 },
    "أبها": { valley: 16, mountain: 18, lowArea: 5, coastal: 0, history: 10 },
    "خميس مشيط": { valley: 14, mountain: 12, lowArea: 6, coastal: 0, history: 8 },
    "الباحة": { valley: 16, mountain: 18, lowArea: 5, coastal: 0, history: 10 },
    "جازان": { valley: 14, mountain: 8, lowArea: 12, coastal: 12, history: 12 },
    "نجران": { valley: 18, mountain: 8, lowArea: 10, coastal: 0, history: 8 },
    "المدينة": { valley: 16, mountain: 6, lowArea: 8, coastal: 0, history: 10 },
    "تبوك": { valley: 14, mountain: 6, lowArea: 8, coastal: 0, history: 8 },
    "الدمام": { valley: 4, mountain: 0, lowArea: 14, coastal: 12, history: 6 },
    "الخبر": { valley: 4, mountain: 0, lowArea: 14, coastal: 12, history: 6 },
    "الأحساء": { valley: 6, mountain: 0, lowArea: 10, coastal: 0, history: 6 },
    "الرياض": { valley: 8, mountain: 0, lowArea: 8, coastal: 0, history: 5 }
};

const smartMultiCityMonitorList = [
    { name: "الرياض", lat: 24.7136, lon: 46.6753 },
    { name: "جدة", lat: 21.5433, lon: 39.1728 },
    { name: "خليص", lat: 22.1500, lon: 39.3333 },
    { name: "مكة", lat: 21.3891, lon: 39.8579 },
    { name: "المدينة", lat: 24.5247, lon: 39.5692 },
    { name: "الطائف", lat: 21.2703, lon: 40.4158 },
    { name: "الوهط - جنوب الطائف", lat: 21.1667, lon: 40.4167 },
    { name: "الهدا", lat: 21.3650, lon: 40.2850 },
    { name: "الشفا", lat: 21.0720, lon: 40.3120 },
    { name: "بني سعد", lat: 20.9000, lon: 40.6500 },
    { name: "ميسان", lat: 20.9000, lon: 40.8000 },
    { name: "المحاني", lat: 22.4830, lon: 40.5330 },
    { name: "الباحة", lat: 20.0129, lon: 41.4677 },
    { name: "أبها", lat: 18.2164, lon: 42.5053 },
    { name: "خميس مشيط", lat: 18.3000, lon: 42.7333 },
    { name: "جازان", lat: 16.8892, lon: 42.5511 },
    { name: "نجران", lat: 17.5656, lon: 44.2289 },
    { name: "الدمام", lat: 26.4207, lon: 50.0888 },
    { name: "الخبر", lat: 26.2172, lon: 50.1971 },
    { name: "الأحساء", lat: 25.3833, lon: 49.5866 },
    { name: "الجبيل", lat: 27.0046, lon: 49.6460 },
    { name: "تبوك", lat: 28.3998, lon: 36.5715 },
    { name: "حائل", lat: 27.5114, lon: 41.7208 },
    { name: "بريدة", lat: 26.3592, lon: 43.9818 },
    { name: "عنيزة", lat: 26.0900, lon: 43.9930 },
    { name: "ينبع", lat: 24.0895, lon: 38.0618 },
    { name: "العلا", lat: 26.6085, lon: 37.9232 },
    { name: "القنفذة", lat: 19.1264, lon: 41.0789 },
    { name: "الليث", lat: 20.1500, lon: 40.2667 },
    { name: "رابغ", lat: 22.7986, lon: 39.0349 }
];

const heatmapCities = [
    { name: "جدة", lat: 21.5433, lon: 39.1728 },
    { name: "خليص", lat: 22.1500, lon: 39.3333 },
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

const monitoredCities = [
    { name: "جدة", lat: 21.5433, lon: 39.1728 },
    { name: "خليص", lat: 22.1500, lon: 39.3333 },
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

const floodSensitiveCities = [
    "مكة",
    "الطائف",
    "أبها",
    "الباحة",
    "جازان",
    "نجران",
    "تبوك",
    "المدينة",
    "جدة",
    "خليص",
    "الوهط"
];

const subCityRainZones = {
    "الطائف": [
        { name: "الوهط", lat: 21.1667, lon: 40.4167 },
        { name: "الهدا", lat: 21.3650, lon: 40.2850 },
        { name: "الشفا", lat: 21.0720, lon: 40.3120 },
        { name: "الحوية", lat: 21.4400, lon: 40.5000 },
        { name: "بني سعد", lat: 20.9000, lon: 40.6500 },
        { name: "ميسان", lat: 20.9000, lon: 40.8000 }
    ],
    "الوهط - جنوب الطائف": [
        { name: "الوهط", lat: 21.1667, lon: 40.4167 }
    ],
    "خليص": [
        { name: "خليص", lat: 22.1500, lon: 39.3333 }
    ]
};
async function analyzeSubCityRainZones(cityName) {
    try {
        const zones = subCityRainZones[cityName];

        if (!zones || zones.length === 0) {
            return [];
        }

        const results = await Promise.all(
            zones.map(async (zone) => {
                try {
                    const url =
                        `${API_BASE_URL}/rain-alert?lat=${zone.lat}&lon=${zone.lon}&hours=72`;

                    const response = await fetch(url);

                    if (!response.ok) {
                        return null;
                    }

                    const data = await response.json();
                    const best = data.best_hour || data.current || {};
                    const current = data.current || {};
                    const nextHours = Array.isArray(data.next_hours)
                        ? data.next_hours
                        : [];

                    const score =
                        Number(best.rain_score) ||
                        Number(current.rain_score) ||
                        0;

                    return {
                        name: zone.name,
                        lat: zone.lat,
                        lon: zone.lon,
                        score,
                        rainNow: score,
                        forecast24Score: getMaxScoreByRange(nextHours, 24),
                        forecast72Score: getMaxScoreByRange(nextHours, 72),
                        floodRiskScore: Number(data.floodRiskScore || 0),
                        terrainRiskScore: Number(data.terrainRiskScore || 0)
                    };
                } catch (err) {
                    console.error("SubCity Error:", zone.name, err);
                    return null;
                }
            })
        );

        return results.filter(Boolean);
    } catch (err) {
        console.error("analyzeSubCityRainZones Error:", err);
        return [];
    }
}

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
                <div>يتم عرض آخر حالة محفوظة بنجاح.</div>
                <div>الموقع: ${saved.name || saved.data.location_name || "غير معروف"}</div>
                <div>آخر مؤشر مطر محفوظ: ${best.rain_score ?? "--"}%</div>
                <div>الحالة السابقة: ${best.alert_level || "غير متوفر"}</div>
                <div>الحرارة السابقة: ${current.temperature ?? "--"}°C</div>
                <div>الرطوبة السابقة: ${current.humidity ?? "--"}%</div>
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
    updateMainWeatherValues(current);

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

        new Notification(APP_VERSION, {
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

        new Notification(APP_VERSION, {
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
        tag: "rainguard-v10-rain-alert",
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
        return;
    }

    if (score >= 30) {
        sendRainNotification(
            "تنبيه مطر",
            `مؤشر المطر في ${locationName} وصل إلى ${score}% - احتمال مطر يحتاج متابعة.`
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

    box.innerText =
        `المراقبة الخلفية: ${state} | آخر فحص: ${now}${message ? " | " + message : ""}`;
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

        checkPushRainAlert(score, locationName, alertLevel);
        saveLastSuccessfulWeather(data, lastLat, lastLon, locationName);

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
            ? "تم تشغيل مراقبة المدن الذكية V10"
            : "تم إيقاف مراقبة المدن الذكية V10",
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
    localStorage.setItem(
        SMART_MULTI_CITY_LAST_ALERT_KEY,
        JSON.stringify({
            cityName,
            score,
            time: Date.now()
        })
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
    const forecast24Score = Number(city.forecast24Score) || 0;
    const alertScore = Math.max(score, forecast24Score);

    if (alertScore < SMART_MULTI_CITY_MIN_ALERT_SCORE) return;
    if (!canSendSmartMultiCityAlert(city.name, alertScore)) return;

    let title = "تنبيه مطر في إحدى المدن";
    let message =
        `المدينة: ${city.name}\n` +
        `مؤشر المطر الحالي: ${score}%\n` +
        `توقع المطر خلال 24 ساعة: ${forecast24Score}%\n` +
        `${city.alertLevel || "تابع الحالة."}`;

    if (alertScore >= 80) {
        title = `تحذير مطر مرتفع في ${city.name}`;
    } else if (alertScore >= 60) {
        title = `تنبيه مطر متوسط في ${city.name}`;
    } else if (alertScore >= 30) {
        title = `تنبيه مطر في ${city.name}`;
    }

    sendRainNotification(title, message);
    saveLastSmartMultiCityAlert(city.name, alertScore);
}

function canSendEarlyMultiCityAlert(cityName, score) {
    let saved = null;

    try {
        saved = JSON.parse(
            localStorage.getItem(SMART_MULTI_CITY_EARLY_ALERT_KEY) || "null"
        );
    } catch {
        saved = null;
    }

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

function sendEarlyMultiCityAlert(city) {
    if (!city) return;

    const nowScore = Number(city.score) || 0;
    const score24 = Number(city.forecast24Score) || 0;
    const score72 = Number(city.forecast72Score) || 0;
    const earlyScore = Math.max(score24, score72);

    if (earlyScore < SMART_MULTI_CITY_EARLY_ALERT_MIN_SCORE) return;
    if (nowScore >= earlyScore) return;
    if (!canSendEarlyMultiCityAlert(city.name, earlyScore)) return;

    const peakTime =
        city.peakHour?.time
            ? city.peakHour.time.replace("T", " ")
            : "غير متوفر";

    let title = "تنبيه مبكر لاحتمال المطر";

    if (earlyScore >= 80) {
        title = "تحذير مبكر مرتفع";
    } else if (earlyScore >= 60) {
        title = "تنبيه مبكر متوسط";
    } else if (earlyScore >= 30) {
        title = "تنبيه مبكر";
    }

    sendRainNotification(
        title,
        `المدينة: ${city.name}\nالآن: ${nowScore}%\nخلال 24 ساعة: ${score24}%\nخلال 72 ساعة: ${score72}%\nالتوقيت: ${peakTime}`
    );

    saveEarlyMultiCityAlert(city.name, earlyScore);
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

function calculateRainArrivalV12(city) {
    const now = Number(city.score || 0);
    const score24 = Number(city.forecast24Score || 0);
    const movement = city.cloudMovement || {};

    let etaMinutes = movement.etaMinutes || null;
    let confidence = Number(movement.confidence || 40);
    let label = "غير متوفر";

    if (now >= 60) {
        etaMinutes = 0;
        label = "المطر حاضر الآن";
        confidence = Math.max(confidence, 85);
    } else if (etaMinutes) {
        label = `خلال ${etaMinutes} دقيقة تقريباً`;
    } else if (score24 >= 60) {
    etaMinutes = 180;
    label = "خلال 3 ساعات القادمة";
    confidence = Math.max(confidence, 65);

} else if (score24 >= 50) {
    etaMinutes = 240;
    label = "خلال 4 ساعات";
    confidence = Math.max(confidence, 60);

} else if (score24 >= 40) {
    etaMinutes = 360;
    label = "خلال 6 ساعات";
    confidence = Math.max(confidence, 55);

} else if (score24 >= 30) {
    etaMinutes = 480;
    label = "خلال 8 ساعات";
    confidence = Math.max(confidence, 50);
} else if (score24 >= 30 || now >= 20) {
    etaMinutes = 720;
    label = "احتمال خلال 12 ساعة";
    confidence = Math.max(confidence, 45);
} else {
    etaMinutes = null;
    label = "لا يوجد وصول مطر واضح حالياً";
    confidence = Math.min(confidence, 40);
}

    return {
        etaMinutes,
        label,
        confidence,
        direction: movement.direction || "غير معروف"
    };
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

function estimateCloudMovement(cityName, currentScore, forecast24Score) {
    const previous = cloudMovementHistory[cityName];

    cloudMovementHistory[cityName] = {
        score: Number(currentScore) || 0,
        forecast24Score: Number(forecast24Score) || 0,
        time: Date.now()
    };

    if (!previous) {
        return {
            direction: "جاري التعلم",
            speed: 0,
            etaMinutes: null,
            confidence: 30
        };
    }

    const delta =
        Number(currentScore || 0) - Number(previous.score || 0);

    let direction = "ثابتة";
    let speed = 0;
    let confidence = 50;

    if (delta >= 15) {
        direction = "تقترب بقوة";
        speed = 35;
        confidence = 80;
    } else if (delta >= 5) {
        direction = "تقترب ببطء";
        speed = 20;
        confidence = 65;
    } else if (delta <= -10) {
        direction = "تبتعد";
        speed = 30;
        confidence = 70;
    }

    const etaMinutes =
        speed > 0 && direction.includes("تقترب")
            ? Math.round((25 / speed) * 60)
            : null;

    return {
        direction,
        speed,
        etaMinutes,
        confidence
    };
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
    if (score >= 30) return "قابلية تجمع مياه";
    return "خطر منخفض";
}

function getFloodRiskIcon(score) {
    score = Number(score) || 0;

    if (score >= 80) return "🔴";
    if (score >= 60) return "🟠";
    if (score >= 30) return "🔵";
    return "🟢";
}

function canSendFloodPredictionAlert(cityName, score) {
    let saved = null;

    try {
        saved = JSON.parse(
            localStorage.getItem(FLOOD_PREDICTION_ALERT_KEY) || "null"
        );
    } catch {
        saved = null;
    }

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

    if (floodScore < FLOOD_RISK_MIN_ALERT_SCORE) return;
    if (!canSendFloodPredictionAlert(city.name, floodScore)) return;

    let title = "تنبيه قابلية تجمع مياه";

    if (floodScore >= FLOOD_RISK_HIGH_SCORE) {
        title = "تحذير سيول مرتفع";
    } else if (floodScore >= FLOOD_RISK_MEDIUM_SCORE) {
        title = "تنبيه سيول متوسط";
    } else if (floodScore >= FLOOD_RISK_WATCH_SCORE) {
        title = "تنبيه متابعة سيول";
    }

    sendRainNotification(
        title,
        `المدينة: ${city.name}\nمؤشر السيول: ${floodScore}%\nمؤشر المطر الآن: ${city.score}%\nخلال 24 ساعة: ${city.forecast24Score}%\nخلال 72 ساعة: ${city.forecast72Score}%`
    );

    saveFloodPredictionAlert(city.name, floodScore);
}

function getLastV10FloodAlert() {
    try {
        return JSON.parse(localStorage.getItem(FLOOD_ALERT_LAST_KEY));
    } catch {
        return null;
    }
}

function canSendV10FloodAlert(cityName, floodScore) {
    const last = getLastV10FloodAlert();

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

function saveV10FloodAlert(cityName, floodScore, level) {
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

function sendV10FloodAlert(city) {
    if (!city) return;

    const floodScore = Number(city.floodRiskScore) || 0;

    if (floodScore < FLOOD_ALERT_WATCH_SCORE) return;
    if (!canSendV10FloodAlert(city.name, floodScore)) return;

    let title = "تنبيه مراقبة سيول";
    let level = "مراقبة";
    let advice = "يوجد احتمال محدود لتجمعات مياه. تابع التحديثات.";

    if (floodScore >= FLOOD_ALERT_EXTREME_SCORE) {
        title = "تحذير سيول شديد";
        level = "شديد";
        advice = "تجنب الأودية والأنفاق والمناطق المنخفضة فوراً.";
    } else if (floodScore >= FLOOD_ALERT_HIGH_SCORE) {
        title = "تنبيه سيول مرتفع";
        level = "مرتفع";
        advice = "تجنب مجاري السيول والمناطق المنخفضة عند هطول المطر.";
    } else if (floodScore >= FLOOD_ALERT_WATCH_SCORE) {
        title = "تنبيه سيول";
        level = "مراقبة";
        advice = "قابلية تجمع مياه موجودة، تابع الحالة خصوصاً في الطرق المنخفضة.";
    }

    sendRainNotification(
        title,
        `المدينة: ${city.name}\nمؤشر السيول: ${floodScore}%\nالتصنيف: ${level}\nالمطر الآن: ${city.score}%\n${advice}`
    );

    saveV10FloodAlert(city.name, floodScore, level);
}

// توافق احتياطي إذا كان أي زر أو كود قديم يستدعي أسماء V82
function getLastV82FloodAlert() {
    return getLastV10FloodAlert();
}

function canSendV82FloodAlert(cityName, floodScore) {
    return canSendV10FloodAlert(cityName, floodScore);
}

function saveV82FloodAlert(cityName, floodScore, level) {
    saveV10FloodAlert(cityName, floodScore, level);
}

function sendV82FloodAlert(city) {
    sendV10FloodAlert(city);
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
    if (scoreNow >= 30 || score24 >= 30 || score72 >= 30) return "تنبيه متابعة";
    return "منخفض";
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

            const terrainRiskScore = calculateTerrainRisk(city.name);

            const floodRiskScore = calculateV9FloodRisk({
                name: city.name,
                score,
                forecast24Score,
                forecast72Score
            });

            const actualRiskScore = Math.round(
                score * 0.5 +
                forecast24Score * 0.15 +
                floodRiskScore * 0.25 +
                terrainRiskScore * 0.10
            );

            const subZones = await analyzeSubCityRainZones(city.name);

            const cloudMovement = estimateCloudMovement(
    city.name,
    score,
    forecast24Score
);

const rainArrival = calculateRainArrivalV12({
    name: city.name,
    score,
    forecast24Score,
    forecast72Score,
    cloudMovement,
    peakHour
});

            results.push({
                name: city.name,
                lat: city.lat,
                lon: city.lon,
                score,
                forecast24Score,
                forecast72Score,
                terrainRiskScore,
                terrainSummary: getTerrainRiskSummary(city.name),
                floodRiskScore,
                actualRiskScore,
                peakHour,
                forecastTiming: classifyForecastTiming(
    score,
    forecast24Score,
    forecast72Score
),
cloudMovement,
rainArrival,
alertLevel:
    best.alert_level ||
    current.alert_level ||
    "تنبيه مطر",
                source: data.source || "Unknown",
                subZones
            });

        } catch (error) {
            console.error("Smart city error:", city.name, error);
        }
    }

    if (results.length === 0) {
        updateBackgroundMonitorStatus("تعذر فحص المدن الذكية");
        renderSmartMultiCityTopPanel([]);
        renderSmartMultiCityForecastPanel([]);
        renderFloodPredictionPanel([]);
        updateNationalStatus([]);
        renderNationalTrendPanel([]);
        return;
    }

    results.sort((a, b) =>
        Number(b.actualRiskScore || 0) - Number(a.actualRiskScore || 0)
    );

    const topCities = results.slice(0, SMART_MULTI_CITY_TOP_LIMIT);
    const topCityNow = topCities[0];

    const forecastRanked = [...results].sort((a, b) =>
        Number(b.forecast72Score || 0) - Number(a.forecast72Score || 0)
    );

    const topForecastCity = forecastRanked[0];

    window.lastMultiCityResults = results;
    document.body.insertAdjacentHTML(
    "afterbegin",
    `<pre style="
        position:fixed;
        top:0;
        left:0;
        right:0;
        max-height:300px;
        overflow:auto;
        background:black;
        color:lime;
        z-index:999999;
        font-size:10px;
        padding:10px;
    ">${JSON.stringify(results[0], null, 2)}</pre>`
);
    console.log(results[0]);
alert(JSON.stringify(results[0], null, 2));
    window.openCityForecastPopup = openCityForecastPopup;

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

    renderSmartMultiCityTopPanel(results);
    renderFloodWatchCitiesPanel(results);
    renderSmartMultiCityForecastPanel(results);
    renderFloodPredictionPanel(results);
    updateNationalStatus(results);
    updateNationalWeatherSummary(results);
    renderNationalTrendPanel(results);
    renderRainArrivalCitiesPanel(results);
    updateFloodRiskMap(results);
    updateCloudRainMapLayer(results);

    const mapUpdateEl = document.getElementById("mapLastUpdateStatus");
    if (mapUpdateEl) {
        mapUpdateEl.innerText =
            "آخر تحديث للخريطة: " + new Date().toLocaleTimeString("ar-SA");
    }

    saveSmartMultiCityHistory(topCities);

    if (topCityNow && topForecastCity) {
        updateBackgroundMonitorStatus(
            `الآن: ${topCityNow.name} ${topCityNow.score}% | 72 ساعة: ${topForecastCity.name} ${topForecastCity.forecast72Score}%`
        );

        sendSmartMultiCityAlert(topCityNow);
        sendEarlyMultiCityAlert(topForecastCity);
    }

    const floodRanked = [...results]
        .filter(city => city.floodRiskScore !== undefined)
        .sort((a, b) =>
            Number(b.floodRiskScore || 0) - Number(a.floodRiskScore || 0)
        );

    if (floodRanked[0]) {
        sendFloodPredictionAlert(floodRanked[0]);
        sendV10FloodAlert(floodRanked[0]);
    }
}
function saveSmartMultiCityHistory(topCities) {
    let saved = [];

    try {
        saved = JSON.parse(localStorage.getItem(SMART_MULTI_CITY_HISTORY_KEY)) || [];
    } catch {
        saved = [];
    }

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
            forecast24Score: city.forecast24Score,
            forecast72Score: city.forecast72Score,
            floodRiskScore: city.floodRiskScore,
            actualRiskScore: city.actualRiskScore,
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

    let saved = [];

    try {
        saved = JSON.parse(localStorage.getItem(SMART_MULTI_CITY_HISTORY_KEY)) || [];
    } catch {
        saved = [];
    }

    if (saved.length === 0) {
        box.innerHTML = "لا يوجد سجل مراقبة مدن حتى الآن.";
        return;
    }

    box.innerHTML = saved.slice(0, 5).map(item => {
        const rows = item.cities.map(city => {
            const score = Number(city.forecast24Score ?? city.score ?? 0);

            let color = "#22c55e";
            let icon = "🟢";

            if (score >= 80) {
                color = "#ef4444";
                icon = "🔴";
            } else if (score >= 60) {
                color = "#f59e0b";
                icon = "🟠";
            } else if (score >= 30) {
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
                    <strong style="color:${color};">${score}%</strong>
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

function clearSmartMultiCityHistory() {
    localStorage.removeItem(SMART_MULTI_CITY_HISTORY_KEY);
    renderSmartMultiCityHistory();
    showActionMessage("تم مسح سجل مراقبة المدن الذكية", "warning");
}

function getRainPanelStyle(score) {
    score = Number(score) || 0;

    if (score >= 80) {
        return {
            color: "#ef4444",
            icon: "🔴",
            label: "تنبيه مطر مرتفع"
        };
    }

    if (score >= 60) {
        return {
            color: "#f59e0b",
            icon: "🟠",
            label: "احتمال مطر مرتفع"
        };
    }

    if (score >= 30) {
        return {
            color: "#38bdf8",
            icon: "🔵",
            label: "تنبيه مطر"
        };
    }

    return {
        color: "#22c55e",
        icon: "🟢",
        label: "مستقر"
    };
}

function renderSmartMultiCityTopPanel(results) {
    const box = document.getElementById("smartMultiCityTopBox");
    if (!box) return;

    if (!results || results.length === 0) {
        box.innerHTML = "لا توجد بيانات توقع مطر حالياً.";
        return;
    }

    const rainCities = [...results]
    .filter(city => {
        const rainNow = Number(city.score || 0);
        const rain24 = Number(city.forecast24Score || 0);
        const rain72 = Number(city.forecast72Score || 0);

        return (
            rainNow >= 30 ||
            rain24 >= 30 ||
            rain72 >= 30
        );
    })
        .sort((a, b) =>
            Number(b.forecast24Score || 0) - Number(a.forecast24Score || 0)
        )
        .slice(0, 10);

    if (rainCities.length === 0) {
        box.innerHTML = `
            <div style="
                padding:18px;
                text-align:center;
                color:#94a3b8;
                line-height:2;
            ">
                🌤️ لا توجد مدن عليها أمطار تستدعي التنبيه حالياً
                <br>
                يتم عرض المدن فقط إذا كان مؤشر المطر خلال 24 ساعة 30% أو أعلى.
            </div>
        `;
        return;
    }

    box.innerHTML = rainCities.map((city, index) => {
        const rainNow = Number(city.score || 0);
        const forecast24 = Number(city.forecast24Score || 0);
        const forecast72 = Number(city.forecast72Score || 0);
        const style = getRainPanelStyle(forecast24);

        return `
            <div
                onclick="openRainCityByName('${city.name}')"
                style="
                    padding:14px;
                    margin-bottom:12px;
                    border-radius:16px;
                    background:#0f172a;
                    border:1px solid ${style.color};
                    cursor:pointer;
                "
            >
                <div style="
                    display:flex;
                    justify-content:space-between;
                    align-items:center;
                    gap:10px;
                ">
                    <strong>${index + 1}. ${style.icon} ${city.name}</strong>
                    <strong style="color:${style.color};font-size:22px;">${forecast24}%</strong>
                </div>

                <div style="
                    margin-top:8px;
                    color:#cbd5e1;
                    line-height:1.8;
                    font-size:14px;
                ">
                    التصنيف: ${style.label}<br>
                    توقع المطر خلال 24 ساعة: ${forecast24}%<br>
                    توقع المطر خلال 72 ساعة: ${forecast72}%<br>
                    المطر الحالي: ${rainNow}%<br>
                    وقت وصول المطر: ${calculateRainArrivalV12(city).label}<br>
                    خطر السيول: ${city.floodRiskScore ?? "--"}%
                </div>
            </div>
        `;
    }).join("");
}

function renderFloodWatchCitiesPanel(results) {
    const box = document.getElementById("floodWatchCitiesBox");
    if (!box) return;

    if (!results || results.length === 0) {
        box.innerHTML = "لا توجد بيانات سيول حالياً.";
        return;
    }

    const floodCities = [...results]
        .filter(city => {
            const flood = Number(city.floodRiskScore || 0);
            const rainNow = Number(city.score || 0);
            const rain24 = Number(city.forecast24Score || 0);
            const rain72 = Number(city.forecast72Score || 0);

            return (
                flood >= 30 &&
                (
                    rainNow >= 30 ||
                    rain24 >= 30 ||
                    rain72 >= 30
                )
            );
        })
        .sort((a, b) =>
            Number(b.floodRiskScore || 0) - Number(a.floodRiskScore || 0)
        );

    if (floodCities.length === 0) {
        box.innerHTML = `
            <div style="color:#94a3b8;line-height:1.8;">
                لا توجد مدن معرضة للسيول حالياً مع وجود مؤشرات مطر كافية.
            </div>
        `;
        return;
    }

    box.innerHTML = floodCities.slice(0, 8).map(city => {
        const floodScore = Number(city.floodRiskScore || 0);
        const rainScore = Number(city.score || 0);
        const forecast24 = Number(city.forecast24Score || 0);

        let color = "#38bdf8";
        let icon = "🔵";
        let label = "قابلية تجمع مياه";

        if (floodScore >= 80) {
            color = "#ef4444";
            icon = "🔴";
            label = "خطر سيول مرتفع";
        } else if (floodScore >= 60) {
            color = "#f59e0b";
            icon = "🟠";
            label = "خطر سيول متوسط";
        }

        return `
            <div
                onclick="openRainCityByName('${city.name}')"
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
                    <strong style="color:#e5e7eb;">${icon} ${city.name}</strong>
                    <strong style="color:${color};font-size:20px;">${floodScore}%</strong>
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
function renderFloodPredictionPanel(results) {
    const box = document.getElementById("floodPredictionBox");
    if (!box) return;

    if (!results || results.length === 0) {
        box.innerHTML = "لا توجد بيانات سيول حالياً.";
        return;
    }

    const ranked = [...results]
        .filter(city => city.floodRiskScore !== undefined)
        .sort((a, b) =>
            Number(b.floodRiskScore || 0) - Number(a.floodRiskScore || 0)
        )
        .slice(0, 8);

    box.innerHTML = ranked.map((city, index) => {
        const floodScore = Number(city.floodRiskScore) || 0;
        const icon = getFloodRiskIcon(floodScore);
        const label = getFloodRiskLabel(floodScore);
        const cityWeight = floodCityWeights[city.name] || 0;

        let color = "#22c55e";
        let action = "المتابعة الدورية كافية.";

        if (floodScore >= 80) {
            color = "#ef4444";
            action = "تجنب الأودية والأنفاق والمناطق المنخفضة فوراً.";
        } else if (floodScore >= 60) {
            color = "#f59e0b";
            action = "راقب الحالة وتجنب مجاري السيول عند هطول المطر.";
        } else if (floodScore >= 30) {
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
                        onclick="openRainCityByName('${city.name}')"
                        style="font-size:18px; cursor:pointer;"
                    >
                        ${index + 1}. ${icon} ${city.name}
                    </strong>

                    <strong style="color:${color};font-size:22px;">
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
                    وزن حساسية المدينة: ${cityWeight}<br>
                    عامل التضاريس ${TERRAIN_ENGINE_VERSION}: ${city.terrainRiskScore || 0}<br>
                    سبب الخطورة: ${city.terrainSummary || "غير محدد"}<br>
                    الإجراء المقترح: ${action}
                </div>
            </div>
        `;
    }).join("");
}

function updateNationalWeatherSummary(results) {
    const rainEl = document.getElementById("rainCitiesCount");
    const floodEl = document.getElementById("floodCitiesCount");
    const cloudEl = document.getElementById("cloudCitiesCount");

    if (!results || !results.length) {
        if (rainEl) rainEl.innerText = "0";
        if (floodEl) floodEl.innerText = "0";
        if (cloudEl) cloudEl.innerText = "0";
        return;
    }

    const rainCities = results.filter(city => {
    const rainNow = Number(city.score || 0);
    const rain24 = Number(city.forecast24Score || 0);
    const rain72 = Number(city.forecast72Score || 0);

    return (
        rainNow >= 30 ||
        rain24 >= 30 ||
        rain72 >= 30
    );
});

    const floodCities = results.filter(city => {
        const flood = Number(city.floodRiskScore || 0);
        const rainNow = Number(city.score || 0);
        const rain24 = Number(city.forecast24Score || 0);
        const rain72 = Number(city.forecast72Score || 0);

        return flood >= 30 && (
            rainNow >= 30 ||
            rain24 >= 30 ||
            rain72 >= 30
        );
    });

    const cloudCities = results.filter(city => {
        const rainNow = Number(city.score || 0);
        const rain24 = Number(city.forecast24Score || 0);

        return (
            rainNow >= 10 &&
            rainNow < 30 &&
            rain24 < 30
        );
    });

    if (rainEl) rainEl.innerText = rainCities.length;
    if (floodEl) floodEl.innerText = floodCities.length;
    if (cloudEl) cloudEl.innerText = cloudCities.length;
}

function updateNationalStatus(results) {
    const box = document.getElementById("nationalWeatherStatus");
    if (!box) return;

    if (!results || !results.length) {
        box.innerHTML = "⚪ الحالة الوطنية: لا توجد بيانات";
        box.style.borderColor = "#64748b";
        updateNationalWeatherSummary([]);
        return;
    }

    const rainCities = results.filter(city => {
    const rainNow = Number(city.score || 0);
    const rain24 = Number(city.forecast24Score || 0);
    const rain72 = Number(city.forecast72Score || 0);

    return (
        rainNow >= 30 ||
        rain24 >= 30 ||
        rain72 >= 30
    );
});

    const floodCities = results.filter(c => {
        const flood = Number(c.floodRiskScore || 0);
        const rainNow = Number(c.score || 0);
        const rain24 = Number(c.forecast24Score || 0);
        const rain72 = Number(c.forecast72Score || 0);

        return flood >= 30 && (
            rainNow >= 30 ||
            rain24 >= 30 ||
            rain72 >= 30
        );
    });

    updateNationalWeatherSummary(results);

    if (rainCities.length === 0 && floodCities.length === 0) {
        box.innerHTML = "🟢 الحالة الوطنية: مستقرة";
        box.style.borderColor = "#22c55e";
        return;
    }

    const maxRain24 = Math.max(
        ...results.map(city => Number(city.forecast24Score || 0))
    );

    const maxFlood = Math.max(
        ...results.map(city => Number(city.floodRiskScore || 0))
    );

    if (maxFlood >= 80 || maxRain24 >= 80) {
        box.innerHTML = `
            🔴 الحالة الوطنية: تنبيه مرتفع
            <div style="font-size:13px;color:#fecaca;margin-top:6px;">
                توجد مؤشرات مطر أو سيول مرتفعة في بعض المدن.
            </div>
        `;
        box.style.borderColor = "#ef4444";
        return;
    }

    if (floodCities.length > 0) {
        box.innerHTML = `
            🔴 الحالة الوطنية: تنبيه
            <div style="font-size:13px;color:#fecaca;margin-top:6px;">
                توجد مدن لديها قابلية تجمع مياه أو سيول من 30% فأعلى.
            </div>
        `;
        box.style.borderColor = "#ef4444";
        return;
    }

    if (rainCities.length > 0) {
        box.innerHTML = `
            🟠 الحالة الوطنية: مراقبة
            <div style="font-size:13px;color:#fde68a;margin-top:6px;">
                توجد مدن عليها تنبيه مطر من 30% فأعلى.
            </div>
        `;
        box.style.borderColor = "#f59e0b";
    }
}

function renderNationalTrendPanel(results) {
    const panel = document.getElementById("nationalTrendPanel");
    if (!panel) return;

    if (!results || !results.length) {
        panel.innerHTML = "لا توجد بيانات توقع حالياً";
        return;
    }

    const topCities = [...results]
        .filter(city => Number(city.forecast72Score || city.forecast24Score || city.score || 0) >= 10)
        .sort((a, b) =>
            Number(b.forecast72Score || 0) - Number(a.forecast72Score || 0)
        )
        .slice(0, 20);

    if (topCities.length === 0) {
        panel.innerHTML = `
            <div style="
                text-align:center;
                padding:30px;
                color:#94a3b8;
                line-height:2;
            ">
                🌤️ لا توجد مدن بتوقعات مطر مهمة خلال 72 ساعة
                <br>
                يتم عرض المدن فقط إذا كان المؤشر 30% أو أعلى.
            </div>
        `;
        return;
    }

    panel.innerHTML = `
        <div style="line-height:2;">
            <div style="
                font-weight:800;
                margin-bottom:10px;
                color:#38bdf8;
            ">
                🌦️ أعلى المدن مطراً / غيوماً خلال 72 ساعة
            </div>

            ${topCities.map((city, index) => {
                const score = Number(city.forecast72Score || 0);
                const style = getRainPanelStyle(score);

                return `
                    <div
                        onclick="openRainCityByName('${city.name}')"
                        style="
                            cursor:pointer;
                            padding:8px 0;
                            border-bottom:1px solid rgba(51,65,85,.6);
                        "
                    >
                        <div style="
                            display:flex;
                            justify-content:space-between;
                            align-items:center;
                        ">
                            <span>${index + 1}. ${style.icon} ${city.name}</span>
                            <strong style="color:${style.color};">${score}%</strong>
                        </div>

                        <div style="
                            margin-top:5px;
                            height:7px;
                            background:#1e293b;
                            border-radius:999px;
                            overflow:hidden;
                        ">
                            <div style="
                                width:${score}%;
                                height:100%;
                                background:${style.color};
                            "></div>
                        </div>

                        <div style="
                            color:#94a3b8;
                            font-size:12px;
                            margin-top:4px;
                        ">
                            ${style.label}
                        </div>
                    </div>
                `;
            }).join("")}
        </div>
    `;
}

function renderRainArrivalCitiesPanel(results) {
    const box = document.getElementById("rainArrivalCitiesBox");
    if (!box) return;

    if (!results || !results.length) {
        box.innerHTML = "لا توجد بيانات وقت وصول المطر حالياً.";
        return;
    }

    const cities = results
    .filter(city =>
        Number(city.score || 0) >= 20 ||
        Number(city.forecast24Score || 0) >= 20 ||
        Number(city.forecast72Score || 0) >= 20
    )
    .sort((a, b) => {
    const aPower =
        Number(a.score || 0) +
        Number(a.forecast24Score || 0) +
        Number(a.forecast72Score || 0) * 0.5 +
        Number(a.floodRiskScore || 0) * 0.25 +
        Number(a.terrainRiskScore || 0) * 0.2;

    const bPower =
        Number(b.score || 0) +
        Number(b.forecast24Score || 0) +
        Number(b.forecast72Score || 0) * 0.5 +
        Number(b.floodRiskScore || 0) * 0.25 +
        Number(b.terrainRiskScore || 0) * 0.2;

    return bPower - aPower;
})
    .slice(0, 10);

    if (!cities.length) {
        box.innerHTML = "لا توجد مدن لديها وقت وصول مطر واضح حالياً.";
        return;
    }

    box.innerHTML = cities.map((city, index) => `
        <div
            onclick="openRainCityByName('${city.name}')"
            style="
                padding:12px;
                margin-bottom:10px;
                border-radius:14px;
                background:#0f172a;
                border:1px solid #334155;
                cursor:pointer;
                line-height:1.8;
            "
        >
            <strong>${index + 1}. ${city.name}</strong><br>
           وقت الوصول: <strong>${
    Number(city.score || 0) >= 20 || Number(city.forecast24Score || 0) >= 20
        ? "احتمال خلال اليوم"
        : (city.rainArrival?.label || "غير متوفر")
}</strong><br>
           قوة الوصول: ${Math.round(
    Number(city.score || 0) +
    Number(city.forecast24Score || 0) +
    Number(city.forecast72Score || 0) * 0.5 +
    Number(city.floodRiskScore || 0) * 0.25 +
    Number(city.terrainRiskScore || 0) * 0.2
)}% | المطر: ${city.score}% | 24 ساعة: ${city.forecast24Score}%
        </div>
    `).join("");
}

function renderSmartMultiCityForecastPanel(results) {
    const box = document.getElementById("smartMultiCityForecastBox");
    if (!box) return;

    if (!results || results.length === 0) {
        box.innerHTML = "لا توجد بيانات توقع مبكر حالياً.";
        return;
    }

    const ranked = [...results]
        .filter(city => Number(city.forecast72Score || 0) >= 30)
        .sort((a, b) =>
            Number(b.forecast72Score || 0) - Number(a.forecast72Score || 0)
        );

    const top = ranked.slice(0, 10);

    if (top.length === 0) {
        box.innerHTML = `
            <div style="color:#94a3b8;line-height:1.8;">
                لا توجد توقعات مبكرة تستدعي التنبيه حالياً.
            </div>
        `;
        return;
    }

    box.innerHTML = top.map((city, index) => {
        const score72 = Number(city.forecast72Score || 0);
        const style = getRainPanelStyle(score72);

        const peakTime =
            city.peakHour?.time
                ? city.peakHour.time.replace("T", " ")
                : "غير متوفر";

        return `
            <div
                onclick="openRainCityByName('${city.name}')"
                style="
                    padding:14px;
                    margin-bottom:12px;
                    border-radius:16px;
                    background:#0f172a;
                    border:1px solid #334155;
                    cursor:pointer;
                "
            >
                <div style="
                    display:flex;
                    justify-content:space-between;
                    align-items:center;
                    gap:10px;
                ">
                    <strong style="font-size:18px;">
                        ${index + 1}. ${style.icon} ${city.name}
                    </strong>

                    <strong style="color:${style.color};font-size:22px;">
                        ${score72}%
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
function getFloodMapColor(score) {
    score = Number(score) || 0;

    if (score >= 80) return "#ef4444";
    if (score >= 60) return "#f59e0b";
    if (score >= 30) return "#38bdf8";
    return "#22c55e";
}

function getFloodMapRadius(score) {
    score = Number(score) || 0;

    if (score >= 80) return 18000;
    if (score >= 60) return 14000;
    if (score >= 30) return 9000;

    return 5000;
}

function clearFloodMapLayer() {
    if (!map || !floodMapLayer) return;

    floodMapLayer.forEach(layer => {
        if (map.hasLayer(layer)) {
            map.removeLayer(layer);
        }
    });

    floodMapLayer = [];
}

function updateFloodRiskMap(results) {
    if (!map) return;
    if (!results || results.length === 0) return;

    clearFloodMapLayer();

    results.forEach(city => {
        const floodScore = Number(city.floodRiskScore) || 0;

        if (floodScore < 30) return;

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
            عامل التضاريس ${TERRAIN_ENGINE_VERSION}: ${city.terrainRiskScore || 0}<br>
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

function clearCloudRainMapLayer() {
    if (!map || !cloudRainMapLayer) return;

    cloudRainMapLayer.forEach(layer => {
        if (map.hasLayer(layer)) {
            map.removeLayer(layer);
        }
    });

    cloudRainMapLayer = [];
}

function updateCloudRainMapLayer(results) {
    if (!map) return;
    if (!results || results.length === 0) return;

    clearCloudRainMapLayer();

    results.forEach(city => {
        const rainScore = Number(city.score || 0);
        const forecast24 = Number(city.forecast24Score || 0);
        const cloudScore = Math.max(rainScore, forecast24);

        if (cloudScore < 30) return;

        let color = "#38bdf8";
        let label = "تنبيه مطر";

        if (cloudScore >= 85) {
            color = "#ef4444";
            label = "تنبيه مطر مرتفع";
        } else if (cloudScore >= 60) {
            color = "#f97316";
            label = "احتمال مطر مرتفع";
        } else if (cloudScore >= 30) {
            color = "#38bdf8";
            label = "تنبيه مطر";
        }

        const cloudCircle = L.circle([city.lat, city.lon], {
            color: "#94a3b8",
            fillColor: "#94a3b8",
            fillOpacity: 0.12,
            opacity: 0.35,
            radius: 6000 + cloudScore * 120
        });

        const rainCircle = L.circle([city.lat, city.lon], {
            color,
            fillColor: color,
            fillOpacity: 0.35,
            opacity: 0.85,
            radius: 3500 + cloudScore * 80
        });

        const popupHTML = `
            <b>${city.name}</b><br>
            ${label}<br>
            المطر الآن: ${rainScore}%<br>
            خلال 24 ساعة: ${forecast24}%<br>
            السحب/المؤشر العام: ${cloudScore}%<br>
            السيول: ${city.floodRiskScore ?? "--"}%
        `;

        cloudCircle.bindPopup(popupHTML);
        rainCircle.bindPopup(popupHTML);

        if (cloudRainMapEnabled) {
            cloudCircle.addTo(map);
            rainCircle.addTo(map);
        }

        cloudRainMapLayer.push(cloudCircle, rainCircle);
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
            if (map.hasLayer(layer)) {
                map.removeLayer(layer);
            }
        }
    });

    showActionMessage(
        floodMapEnabled
            ? "تم تشغيل خريطة السيول"
            : "تم إيقاف خريطة السيول",
        floodMapEnabled ? "success" : "warning"
    );
}

function toggleCloudRainMap() {
    cloudRainMapEnabled = !cloudRainMapEnabled;

    if (!map || cloudRainMapLayer.length === 0) {
        showActionMessage(
            cloudRainMapEnabled
                ? "تم تفعيل طبقة السحب والمطر، ستظهر بعد التحديث القادم"
                : "تم إيقاف طبقة السحب والمطر",
            cloudRainMapEnabled ? "success" : "warning"
        );
        return;
    }

    cloudRainMapLayer.forEach(layer => {
        if (cloudRainMapEnabled) {
            layer.addTo(map);
        } else {
            if (map.hasLayer(layer)) {
                map.removeLayer(layer);
            }
        }
    });

    showActionMessage(
        cloudRainMapEnabled
            ? "تم تشغيل طبقة السحب والمطر"
            : "تم إيقاف طبقة السحب والمطر",
        cloudRainMapEnabled ? "success" : "warning"
    );
}

function buildCityHourlyMiniForecast(city) {
    const current = Number(city.score || 0);
    const forecast24 = Number(city.forecast24Score || current || 0);

    const forecast = [
        { time: "الآن", rain: current },
        { time: "+3 ساعات", rain: Math.round((current * 0.7) + (forecast24 * 0.3)) },
        { time: "+6 ساعات", rain: Math.round((current * 0.5) + (forecast24 * 0.5)) },
        { time: "+9 ساعات", rain: Math.round((current * 0.35) + (forecast24 * 0.65)) },
        { time: "+12 ساعة", rain: Math.round((current * 0.25) + (forecast24 * 0.75)) }
    ];

    return `
        <div style="margin-top:15px;padding-top:10px;border-top:1px solid #334155;">
            <h3 style="color:#38bdf8;">⏰ توقع 12 ساعة القادمة</h3>
            ${forecast.map(item => {
                const style = getRainPanelStyle(item.rain);

                return `
                    <div style="
                        display:flex;
                        justify-content:space-between;
                        margin:6px 0;
                        color:#cbd5e1;
                    ">
                        <span>${item.time}</span>
                        <strong style="color:${style.color};">${item.rain}%</strong>
                    </div>
                `;
            }).join("")}
        </div>
    `;
}

function buildCityDailyMiniForecast(city) {
    const today = Number(city.score || 0);
    const score24 = Number(city.forecast24Score || today || 0);
    const score72 = Number(city.forecast72Score || score24 || 0);

    const days = [
        { day: "اليوم", rain: today },
        { day: "غداً", rain: score24 },
        { day: "بعد غد", rain: score72 }
    ];

    return `
        <div style="margin-top:15px;padding-top:10px;border-top:1px solid #334155;">
            <h3 style="color:#38bdf8;">📅 توقع الأيام القادمة</h3>
            ${days.map(item => {
                const style = getRainPanelStyle(item.rain);

                return `
                    <div style="
                        display:flex;
                        justify-content:space-between;
                        margin:6px 0;
                        color:#cbd5e1;
                    ">
                        <span>${item.day}</span>
                        <strong style="color:${style.color};">${item.rain}%</strong>
                    </div>
                `;
            }).join("")}
        </div>
    `;
}

function renderSubZonesHTML(subZones) {
    if (!subZones || subZones.length === 0) return "";

    const getZoneStyle = (score) => {
        score = Number(score) || 0;

        if (score >= 60) return { color: "#ef4444", icon: "🔴", label: "مرتفع" };
        if (score >= 30) return { color: "#f59e0b", icon: "🟠", label: "متوسط" };
        if (score >= 15) return { color: "#facc15", icon: "🟡", label: "محدود" };

        return { color: "#22c55e", icon: "🟢", label: "منخفض" };
    };

    const topZones = [...subZones]
        .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
        .slice(0, 5);

    return `
        <div style="
            margin-top:10px;
            padding-top:10px;
            border-top:1px solid #334155;
            color:#cbd5e1;
        ">
            <strong style="color:#38bdf8;">📍 متابعة المناطق الداخلية</strong>

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
                        <span>${z.icon} ${zone.name}</span>
                        <strong style="color:${z.color};">
                            ${zone.score}% - ${z.label}
                        </strong>
                    </div>
                `;
            }).join("")}
        </div>
    `;
}
function openCityForecastPopup(cityName) {
    closeCityForecastPopup();

    const city = window.lastMultiCityResults.find(c => c.name === cityName);

    if (!city) {
        showActionMessage("لا توجد بيانات تفصيلية لهذه المدينة حالياً", "warning");
        return;
    }

    const html = `
        <div id="cityForecastModal" class="rg-modal">
            <div class="rg-modal-content">
                <button class="rg-modal-close" onclick="closeCityForecastPopup()">×</button>

                <h2>تفاصيل ${city.name}</h2>

                <div class="rg-modal-score">
                    ${APP_VERSION}
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
                    padding:14px;
                    border-radius:16px;
                    background:#020617;
                    border:1px solid #334155;
                ">
                    <div style="
                        color:#38bdf8;
                        font-weight:bold;
                        margin-bottom:10px;
                    ">
                        ☁️ Cloud Motion Engine ${CLOUD_TRACKER_VERSION}
                    </div>

                    <div>
                        اتجاه السحب:
                        <strong>${city.cloudMovement?.direction || "غير معروف"}</strong>
                    </div>

                    <div style="margin-top:6px;">
                        سرعة الحركة:
                        <strong>${city.cloudMovement?.speed || 0}</strong>
                        كم/س
                    </div>

                    <div style="margin-top:6px;">
                        زمن الوصول المتوقع:
                        <strong>
                            ${
                                city.cloudMovement?.etaMinutes
                                    ? city.cloudMovement.etaMinutes + " دقيقة"
                                    : "غير متوفر"
                            }
                        </strong>
                    </div>

                    <div style="margin-top:6px;">
                        الثقة:
                        <strong>${city.cloudMovement?.confidence || 0}%</strong>
                    </div>
                </div>

                <div id="cityMiniMap" style="
                    height:220px;
                    margin-top:15px;
                    border-radius:16px;
                    overflow:hidden;
                    border:1px solid #334155;
                "></div>

                <div class="rg-modal-section">
                    ${renderSubZonesHTML(city.subZones) || "لا توجد مناطق فرعية لهذه المدينة."}
                </div>

                <div class="rg-modal-section">
                    ${buildCityHourlyMiniForecast(city)}
                </div>

                <div class="rg-modal-section">
                    ${buildCityDailyMiniForecast(city)}
                </div>

                <div class="rg-modal-note">
                    المصدر: ${city.source || "Unknown"}<br>
                    الحالة: ${city.alertLevel || "غير متوفر"}
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML("beforeend", html);

    const modal = document.getElementById("cityForecastModal");
    if (modal) {
        modal.addEventListener("click", closeCityForecastPopupOnOutsideClick);
    }

    setTimeout(() => {
    if (!city.lat || !city.lon || !window.L) return;

    const miniMapEl = document.getElementById("cityMiniMap");

    if (!miniMapEl) return;

    if (miniMapEl._leaflet_id) {
        miniMapEl._leaflet_id = null;
    }

    const miniMap = L.map(miniMapEl, {
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
                    مؤشر السيول: ${zone.floodRiskScore ?? "--"}%
                `)
                .addTo(miniMap);
            });
        }

        setTimeout(() => miniMap.invalidateSize(), 300);
    }, 300);
}

window.openCityForecastPopup = openCityForecastPopup;

function closeCityForecastPopup() {
    const modal = document.getElementById("cityForecastModal");
    if (modal) modal.remove();
}

function closeCityForecastPopupOnOutsideClick(event) {
    const modal = document.getElementById("cityForecastModal");
    const content = document.querySelector("#cityForecastModal .rg-modal-content");

    if (!modal || !content) return;

    if (event.target === modal) {
        closeCityForecastPopup();
    }
}

async function refreshCityForecastPopup(cityName) {
    const btn = document.getElementById("refreshCityBtn");

    if (btn) {
        btn.disabled = true;
        btn.style.opacity = "0.6";
        btn.innerText = "⏳ جاري تحديث بيانات المدينة...";
    }

    showActionMessage("جاري تحديث بيانات المدينة...", "warning");

    await runSmartMultiCityBackgroundCheck(true);

    closeCityForecastPopup();

    setTimeout(() => {
        openCityForecastPopup(cityName);
    }, 500);
}

function showCloudCities() {
    const modal = document.getElementById("cloudCitiesModal");
    const list = document.getElementById("cloudCitiesList");

    if (!modal || !list || !window.lastMultiCityResults) return;

    const cloudyCities = window.lastMultiCityResults.filter(c =>
        Number(c.score || 0) >= 10 &&
        Number(c.score || 0) < 30 &&
        Number(c.forecast24Score || 0) < 30
    );

    list.innerHTML = cloudyCities.length
        ? cloudyCities.map(c => `
            <div
                onclick="showCloudCityDetails('${c.name}')"
                style="
                    padding:12px;
                    border-bottom:1px solid #334155;
                    cursor:pointer;
                    border-radius:10px;
                "
            >
                ☁️ ${c.name} - مؤشر: ${c.score || 0}%
                <div style="font-size:12px;color:#94a3b8;margin-top:4px;">
                    اضغط لعرض التفاصيل
                </div>
            </div>
        `).join("")
        : "لا توجد مدن غائمة حالياً";

   modal.classList.add("show");
}

function closeCloudCities() {
    const modal = document.getElementById("cloudCitiesModal");
    if (!modal) return;

    modal.classList.remove("show");
    modal.style.display = "none";
}

function showCloudCityDetails(cityName) {
    const list = document.getElementById("cloudCitiesList");
    if (!list || !window.lastMultiCityResults) return;

    const city = window.lastMultiCityResults.find(c => c.name === cityName);
    if (!city) return;

    list.innerHTML = `
        <div style="line-height:2;">
            <h3>☁️ ${city.name}</h3>

            <p>🌧️ المطر الآن: <strong>${city.score || 0}%</strong></p>
            <p>📅 24 ساعة: <strong>${city.forecast24Score || 0}%</strong></p>
            <p>📈 72 ساعة: <strong>${city.forecast72Score || 0}%</strong></p>
            <p>🌊 السيول: <strong>${city.floodRiskScore || 0}%</strong></p>
            <p>⛰️ التضاريس: <strong>${city.terrainRiskScore || 0}%</strong></p>

            <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:20px;">
                <button onclick="focusCloudCityOnMap('${city.name}')" style="
                    padding:10px 15px;
                    border:none;
                    border-radius:10px;
                    background:#2563eb;
                    color:white;
                    cursor:pointer;
                ">
                    📍 عرض المدينة على الخريطة
                </button>

                <button onclick="showCloudCities()" style="
                    padding:10px 15px;
                    border:none;
                    border-radius:10px;
                    background:#475569;
                    color:white;
                    cursor:pointer;
                ">
                    ↩️ رجوع
                </button>
            </div>
        </div>
    `;
}

function focusCloudCityOnMap(cityName) {
    const city = window.lastMultiCityResults.find(c => c.name === cityName);
    if (!city || !city.lat || !city.lon || !map) return;

    closeCloudCities();

    map.setView([city.lat, city.lon], 9);

    L.popup()
        .setLatLng([city.lat, city.lon])
        .setContent(`
            <b>${city.name}</b><br>
            المطر الآن: ${city.score || 0}%<br>
            24 ساعة: ${city.forecast24Score || 0}%<br>
            72 ساعة: ${city.forecast72Score || 0}%<br>
            السيول: ${city.floodRiskScore || 0}%
        `)
        .openOn(map);

    setTimeout(function () {
        if (typeof window.openCityForecastPopup === "function") {
            window.openCityForecastPopup(cityName);
        }
    }, 500);
}
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

        updateRefreshStatus(`تم ضبط التحديث الذكي كل ${adaptiveRefreshMinutes} دقائق`);
    }
}

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
    } else if (score >= 30) {
        color = "#38bdf8";
        label = "تنبيه مطر";
    }

    riskBar.style.width = score + "%";
    riskBar.style.background = color;

    riskValue.innerText = score + "%";
    riskValue.style.color = color;

    riskLabel.innerText = label;
}

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

function buildSourceStatusHTML(data) {
    const source = data.source || "غير معروف";
    const verification = data.verification || {};
    const confidenceScore = verification.confidence_score ?? "--";

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
                <div style="font-size:22px;font-weight:bold;color:#38bdf8;">
                    🔎 حالة المصادر
                </div>
                <div>المصدر المستخدم: <strong>${source}</strong></div>
                <div>ثقة النظام: ${confidenceScore}%</div>
                <div>الإصدار: ${APP_VERSION}</div>
            </div>
        </div>
    `;
}

function buildConfidenceHTML(data) {
    const verification = data.verification;
    if (!verification) return "";

    const confidenceScore = Number(verification.confidence_score) || 0;

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
    } else if (confidenceScore >= 30) {
        color = "#38bdf8";
        title = "ثقة محدودة";
        icon = "🔎";
    }

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
                <div style="font-size:24px;font-weight:bold;color:${color};">
                    ${icon} ${title} - ${confidenceScore}%
                </div>
                <div style="margin-top:8px;color:#94a3b8;">
                    ${verification.note || ""}
                </div>
            </div>
        </div>
    `;
}

function buildRadarFusionHTML(data) {
    const current = data.current || {};
    const best = data.best_hour || {};

    const rainScore = Number(best.rain_score) || 0;
    const cloudCover = Number(current.cloud_cover) || 0;
    const humidity = Number(current.humidity) || 0;
    const rainProbability = Number(current.rain_probability) || 0;

    let fusionScore = Math.round(
        rainScore * 0.4 +
        cloudCover * 0.2 +
        humidity * 0.15 +
        rainProbability * 0.25
    );

    fusionScore = Math.min(fusionScore, 100);

    let color = "#22c55e";
    let title = "حالة مستقرة";
    let icon = "🟢";

    if (fusionScore >= 80) {
        color = "#ef4444";
        title = "مطر محتمل بقوة";
        icon = "🔴";
    } else if (fusionScore >= 60) {
        color = "#f59e0b";
        title = "مطر محتمل";
        icon = "🟡";
    } else if (fusionScore >= 30) {
        color = "#38bdf8";
        title = "تنبيه مطر";
        icon = "🔵";
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
                <div style="font-size:24px;font-weight:bold;color:${color};">
                    ${icon} ${title} - ${fusionScore}%
                </div>
            </div>
        </div>
    `;
}

function buildRainArrivalTrackerHTML(data) {
    const nextHours = data.next_hours || [];
    let peakScore = 0;
    let peakIndex = 0;

    nextHours.forEach((hour, index) => {
        const score = Number(hour.rain_score) || 0;
        if (score > peakScore) {
            peakScore = score;
            peakIndex = index;
        }
    });

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
                أعلى مؤشر متوقع: ${peakScore}% بعد ${peakIndex} ساعة تقريباً
            </div>
        </div>
    `;
}
function buildFloodRiskHTML(data, locationName) {
    const best = data.best_hour || {};
    const current = data.current || {};

    const rainScore = Number(best.rain_score) || 0;
    const rainProbability = Number(current.rain_probability) || 0;
    const humidity = Number(current.humidity) || 0;
    const cityName = locationName || data.location_name || lastName || "";

    let floodScore = Math.round(
        rainScore * 0.4 +
        rainProbability * 0.3 +
        humidity * 0.15
    );

    if (floodSensitiveCities.some(city => cityName.includes(city))) {
        floodScore += 10;
    }

    floodScore = Math.min(floodScore, 100);

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
                ${getFloodRiskIcon(floodScore)} ${getFloodRiskLabel(floodScore)} - ${floodScore}%
                <br>
                الإصدار: ${TERRAIN_ENGINE_VERSION}
            </div>
        </div>
    `;
}

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
                    Number(data?.best_hour?.rain_score) ||
                    Number(data?.current?.rain_score) ||
                    0;

                results.push({
                    name: city.name,
                    score,
                    source: data?.source || "Unknown"
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

        box.innerHTML = results
            .filter(city => Number(city.score || 0) >= 30)
            .map(city => {
                const style = getRainPanelStyle(city.score);

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
                            <strong>${style.icon} ${city.name}</strong>
                            <strong style="color:${style.color};font-size:20px;">
                                ${city.score}%
                            </strong>
                        </div>

                        <div style="
                            margin-top:8px;
                            color:#94a3b8;
                            font-size:13px;
                        ">
                            ${style.label} | ${city.source}
                        </div>
                    </div>
                `;
            }).join("") || "لا توجد مدن بمؤشر مطر 30% أو أعلى حالياً.";

        status.innerText = `تم تحديث ${results.length} مدينة`;

    } catch (error) {
        console.error(error);
        box.innerHTML = "حدث خطأ أثناء تحليل المدن.";
        status.innerText = "فشل التحديث";
    }
}

function toggleMultiCityAutoRefresh() {
    if (multiCityAutoRefreshEnabled) {
        clearInterval(multiCityAutoRefresh);
        multiCityAutoRefreshEnabled = false;
        showActionMessage("تم إيقاف التحديث التلقائي للمدن", "warning");
        return;
    }

    multiCityAutoRefresh = setInterval(
        updateMultiCityMonitor,
        30 * 60 * 1000
    );

    multiCityAutoRefreshEnabled = true;
    showActionMessage("تم تشغيل التحديث التلقائي للمدن", "success");
}

function initMap(lat = 21.4858, lon = 39.1925) {
    const mapEl = document.getElementById("map");
    if (!mapEl || !window.L) return;

    if (!map) {
        map = L.map("map", {
            minZoom: 4,
            maxZoom: 10
        }).setView([lat, lon], 6);

        window.map = map;

        L.tileLayer(
            "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
            {
                minZoom: 4,
                maxZoom: 19,
                attribution: "© OpenStreetMap"
            }
        ).addTo(map);

        loadRainRadar();

        setTimeout(() => updateRainHeatmap(), 2500);
        setTimeout(() => map.invalidateSize(), 500);
        setTimeout(() => map.invalidateSize(), 1500);

    } else {
        map.setView([lat, lon], 6);
    }

    if (marker && map.hasLayer(marker)) {
        map.removeLayer(marker);
    }

    marker = L.marker([lat, lon]).addTo(map);
}

async function loadRainRadar() {
    try {
        if (!window.L || !map) return;

        const response = await fetch(
            "https://api.rainviewer.com/public/weather-maps.json"
        );

        const data = await response.json();

        if (!data.radar || !data.radar.past || data.radar.past.length === 0) {
            return;
        }

        const latestRadar = data.radar.past[data.radar.past.length - 1];

        const radarUrl =
            `${data.host}${latestRadar.path}/256/{z}/{x}/{y}/2/1_1.png`;

        rainLayer = L.tileLayer(
            radarUrl,
            {
                minZoom: 4,
                maxZoom: 10,
                opacity: 0.65,
                attribution: "RainViewer"
            }
        );

        if (radarEnabled && map) {
            rainLayer.addTo(map);
        }

    } catch (error) {
        console.error(error);
    }
}

function toggleRadar() {
    if (!rainLayer || !map) return;

    if (radarEnabled) {
        if (map.hasLayer(rainLayer)) {
            map.removeLayer(rainLayer);
        }

        radarEnabled = false;
        showActionMessage("تم إيقاف الرادار", "warning");
    } else {
        rainLayer.addTo(map);
        radarEnabled = true;
        showActionMessage("تم تشغيل الرادار", "success");
    }
}

async function updateRainHeatmap() {
    if (!map) return;

    if (heatmapLayer) {
        heatmapLayer.forEach(layer => {
            if (map.hasLayer(layer)) {
                map.removeLayer(layer);
            }
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
                Number(data?.best_hour?.rain_score) ||
                Number(data?.current?.rain_score) ||
                0;

            if (score < 30) continue;

            let color = "#38bdf8";
            let radius = 22000;

            if (score >= 80) {
                color = "#ef4444";
                radius = 35000;
            } else if (score >= 60) {
                color = "#f59e0b";
                radius = 28000;
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
                مؤشر المطر: ${score}%<br>
                التصنيف: ${getRainPanelStyle(score).label}
            `);

            heatmapLayer.push(circle);

        } catch (error) {
            console.error(error);
        }
    }
}

function toggleHeatmap() {
    if (!heatmapLayer || !map) return;

    heatmapEnabled = !heatmapEnabled;

    heatmapLayer.forEach(layer => {
        if (heatmapEnabled) {
            layer.addTo(map);
        } else {
            if (map.hasLayer(layer)) {
                map.removeLayer(layer);
            }
        }
    });

    showActionMessage(
        heatmapEnabled ? "تم تشغيل الخريطة الحرارية" : "تم إيقاف الخريطة الحرارية",
        heatmapEnabled ? "success" : "warning"
    );
}
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
    runSmartMultiCityBackgroundCheck(true);

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

function checkSmartAlert(score, alertLevel, locationName) {
    let currentLevel = "LOW";

    if (score >= 80) {
        currentLevel = "HIGH";
    } else if (score >= 60) {
        currentLevel = "MEDIUM";
    } else if (score >= 30) {
        currentLevel = "WATCH";
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
    } else if (currentLevel === "WATCH") {
        showActionMessage(
            `تنبيه مطر: مؤشر المطر في ${locationName} وصل إلى ${score}%`,
            "warning"
        );
    } else {
        showActionMessage(`الحالة مستقرة في ${locationName}`, "success");
    }
}

function savePredictionHistory(locationName, score, alertLevel, lat, lon) {
    const key = "rainguard_history";

    let saved = [];

    try {
        saved = JSON.parse(localStorage.getItem(key)) || [];
    } catch {
        saved = [];
    }

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

    const filtered = saved.filter(oldItem => oldItem.locationName !== locationName);
    filtered.unshift(item);

    localStorage.setItem(key, JSON.stringify(filtered.slice(0, 8)));
    renderPredictionHistory();
}

function renderPredictionHistory() {
    const box = document.getElementById("historyBox");
    if (!box) return;

    let saved = [];

    try {
        saved = JSON.parse(localStorage.getItem("rainguard_history")) || [];
    } catch {
        saved = [];
    }

    if (saved.length === 0) {
        box.innerHTML = "لا يوجد سجل حتى الآن.";
        return;
    }

    box.innerHTML = saved.map((item, index) => {
        let color = "#22c55e";
        let label = "خطر منخفض";

        if (item.score >= 80) {
            color = "#ef4444";
            label = "خطر مرتفع";
        } else if (item.score >= 60) {
            color = "#f59e0b";
            label = "تنبيه متوسط";
        } else if (item.score >= 30) {
            color = "#38bdf8";
            label = "تنبيه مطر";
        }

        return `
            <div style="
                padding:14px;
                margin-bottom:12px;
                border-radius:16px;
                background:#0f172a;
                border:1px solid #334155;
            ">
                <strong style="font-size:22px;color:white;">
                    ${item.locationName}
                </strong>

                <br><br>

                <span style="color:${color};font-weight:bold;font-size:22px;">
                    مؤشر الخطر: ${item.score}%
                </span>

                <br>

                <span style="color:#cbd5e1;font-size:18px;">
                    ${item.alertLevel || label}
                </span>

                <br><br>

                <small style="color:#94a3b8;">${item.time}</small>

                <br><br>

                <button onclick="recheckHistoryItem(${index})" style="width:100%;">
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
    let saved = [];

    try {
        saved = JSON.parse(localStorage.getItem("rainguard_history")) || [];
    } catch {
        saved = [];
    }

    const item = saved[index];

    if (!item) {
        showActionMessage("لم يتم العثور على هذا السجل", "warning");
        return;
    }

    const cityInput = document.getElementById("cityInput");
    if (cityInput) {
        cityInput.value = item.locationName;
    }

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

function updateAccuracyBox() {
    const box = document.getElementById("accuracyBox");
    if (!box) return;

    let saved = {
        total: 0,
        correct: 0
    };

    try {
        saved = JSON.parse(localStorage.getItem("rainguard_accuracy")) || {
            total: 0,
            correct: 0
        };
    } catch {
        saved = {
            total: 0,
            correct: 0
        };
    }

    if (saved.total === 0) {
        box.innerHTML = "لم يتم تسجيل تقييمات بعد.";
        return;
    }

    const accuracy = Math.round((saved.correct / saved.total) * 100);

    box.innerHTML = `
        عدد التقييمات: ${saved.total}<br>
        التوقعات الصحيحة: ${saved.correct}<br>
        دقة التوقع حسب تقييمك: ${accuracy}%
        <br><br>
        <button onclick="resetAccuracy()">مسح التقييمات</button>
    `;
}

function ratePrediction(isCorrect) {
    const key = "rainguard_accuracy";

    let saved = {
        total: 0,
        correct: 0
    };

    try {
        saved = JSON.parse(localStorage.getItem(key)) || {
            total: 0,
            correct: 0
        };
    } catch {
        saved = {
            total: 0,
            correct: 0
        };
    }

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

function resetAccuracy() {
    localStorage.removeItem("rainguard_accuracy");
    updateAccuracyBox();
    showActionMessage("تم مسح تقييمات الدقة", "warning");
}

function shareWeatherWhatsApp() {
    const riskValue = document.getElementById("riskValue")?.innerText || "--%";
    const statusText = document.getElementById("statusText")?.innerText || "غير متوفر";
    const refreshStatus = document.getElementById("refreshStatus")?.innerText || "";
    const confidenceText = document.getElementById("confidenceText")?.innerText || "";

    const message =
    `🌧 ${APP_VERSION}\n` +
        `الموقع: ${lastName}\n` +
        `مؤشر المطر: ${riskValue}\n` +
        `الحالة: ${statusText}\n` +
        `${confidenceText}\n` +
        `${refreshStatus}\n\n` +
`رابط التطبيق:\nhttps://rain-guard-ai.vercel.app/?v=165`;

    window.open("https://wa.me/?text=" + encodeURIComponent(message), "_blank");
}

function updateProDashboardWidgets(data, name, score, best) {
    const proCity = document.getElementById("proCityName");
    const proRisk = document.getElementById("proRiskScore");
    const proStatus = document.getElementById("proStatusText");
    const proSource = document.getElementById("proSourceText");

    if (proCity) proCity.innerText = name || "--";
    if (proRisk) proRisk.innerText = `${score || 0}%`;
    if (proStatus) proStatus.innerText = best?.alert_level || "تحليل المطر";
    if (proSource) proSource.innerText = data?.source || "Unknown";
}

function updateAIWidgets(data, score, name) {
    const box = document.getElementById("aiWidgetsBox");
    if (!box) return;

    let color = "#22c55e";
    let label = "مستقر";

    if (score >= 80) {
        color = "#ef4444";
        label = "تنبيه مرتفع";
    } else if (score >= 60) {
        color = "#f59e0b";
        label = "تنبيه متوسط";
    } else if (score >= 30) {
        color = "#38bdf8";
        label = "تنبيه مطر";
    }

    box.innerHTML = `
        <div style="
            padding:14px;
            border-radius:16px;
            background:#020617;
            border:1px solid #334155;
            line-height:1.8;
            color:#cbd5e1;
        ">
🤖 تحليل ${APP_VERSION}<br>
            المدينة: ${name || "--"}<br>
            مؤشر المطر: <strong style="color:${color};">${score || 0}%</strong><br>
            التصنيف: ${label}<br>
            المصدر: ${data?.source || "Unknown"}
        </div>
    `;
}
function updateMainWeatherValues(current) {
    if (!current) return;

    const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.innerText = value;
    };

    setText("temperatureValue", `${current.temperature ?? "--"}°C`);
    setText("humidityValue", `${current.humidity ?? "--"}%`);
    setText("cloudValue", `${current.cloud_cover ?? "--"}%`);
    setText("rainChanceValue", `${current.rain_probability ?? "--"}%`);
    setText("pressureValue", current.pressure_hpa ?? "--");
    setText("windValue", `${current.wind_speed ?? "--"} كم/س`);

    setText("tempKpi", `${current.temperature ?? "--"}°`);
    setText("humidityKpi", `${current.humidity ?? "--"}%`);
    setText("rainProbKpi", `${current.rain_probability ?? "--"}%`);
    setText("windKpi", `${current.wind_speed ?? "--"} كم/س`);
}
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

    if (!cityName || !statusText || !adviceText) return;

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
                showActionMessage("الخادم يستجيب ببطء... جاري إعادة المحاولة", "warning");
                await new Promise(resolve => setTimeout(resolve, 2500));
                return checkRain(lat, lon, name, silent, retryCount + 1);
            }

            throw new Error("فشل الاتصال بالخادم");
        }

        const data = await response.json();

        if (data.error) {
            throw new Error(data.message || "فشل جلب البيانات");
        }

        saveLastSuccessfulWeather(data, lat, lon, name);

        const current = data.current || {};
const best = data.best_hour || current;
const score = Number(best.rain_score) || 0;

let rainArrivalText = "غير متوفر";

if (data.next_hours && data.next_hours.length > 0) {
    const nextRain = data.next_hours.find(
        h => Number(h.rain_score || 0) >= 30
    );

    if (nextRain) {
        rainArrivalText = nextRain.time
            ? nextRain.time.replace("T", " ")
            : "قريباً";
    }
}

updateMainWeatherValues(current);

updateProDashboardWidgets(data, name, score, best);
updateAIWidgets(data, score, name);

        const sourceStatusHTML = buildSourceStatusHTML(data);
        const forecastHTML = buildForecastHTML(data.next_hours);
        const dailyForecastHTML = buildDailyForecastHTML(data.daily_forecast);
        const confidenceHTML = buildConfidenceHTML(data);
        const radarFusionHTML = buildRadarFusionHTML(data);
        const arrivalTrackerHTML = buildRainArrivalTrackerHTML(data);
        const floodRiskHTML = buildFloodRiskHTML(data, name);

        const forecast12Box = document.getElementById("forecast12InlineBox");
        if (forecast12Box) forecast12Box.innerHTML = forecastHTML;

        const forecastDaysBox = document.getElementById("forecastDaysInlineBox");
        if (forecastDaysBox) forecastDaysBox.innerHTML = dailyForecastHTML;

        const sourceStatusBox = document.getElementById("sourceStatusBox");
        if (sourceStatusBox) sourceStatusBox.innerHTML = sourceStatusHTML;

        const confidenceBox = document.getElementById("confidenceBox");
        if (confidenceBox) confidenceBox.innerHTML = confidenceHTML;

        const radarFusionBox = document.getElementById("radarFusionBox");
        if (radarFusionBox) radarFusionBox.innerHTML = radarFusionHTML;

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
        updateWeatherEffectsByRisk(score);

        statusText.className = className;
        statusText.innerText =
            `${best.alert_level || "تحليل المطر"} - ${score}%`;

        checkSmartAlert(score, best.alert_level || "تحليل المطر", name);
        checkPushRainAlert(score, name, best.alert_level || "تحليل المطر");

        savePredictionHistory(
            name,
            score,
            best.alert_level || "تحليل المطر",
            lat,
            lon
        );

        adviceText.innerHTML = `
            <p>${best.advice || ""}</p>
            <div class="forecast-section">
    <h3>⏰ موعد وصول المطر المتوقع</h3>
    <div style="
        padding:16px;
        border-radius:16px;
        background:#020617;
        border:1px solid #334155;
        color:#38bdf8;
        font-size:20px;
        font-weight:bold;
        text-align:center;
    ">
        ${rainArrivalText}
    </div>
</div>

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

        if (marker) {
            marker.bindPopup(`
                <b>${name}</b><br>
                مؤشر المطر: ${score}%<br>
                ${best.alert_level || ""}
            `);
        }

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
                score >= 80 ? "rain-high" :
                score >= 60 ? "rain-medium" :
                "rain-low";

            statusText.innerText =
                `وضع الطوارئ - آخر بيانات محفوظة - ${score}%`;

            updateRiskBar(score);
            updateLightningStormMode(score);
            updateWeatherEffectsByRisk(score);

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

async function detectRain() {
    const input = document.getElementById("cityInput");
    if (!input) return;

    const cityInput = input.value.trim();

    if (!cityInput) {
        showActionMessage("اكتب اسم المدينة أولًا", "warning");
        return;
    }

    const cityName = document.getElementById("cityName");
    const statusText = document.getElementById("statusText");
    const adviceText = document.getElementById("adviceText");

    if (cityName) cityName.innerText = cityInput;
    if (statusText) statusText.innerText = "جاري البحث...";
    if (adviceText) adviceText.innerHTML = "";

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
        if (statusText) {
            statusText.className = "rain-high";
            statusText.innerText = "المدينة غير موجودة";
        }

        if (adviceText) {
            adviceText.innerHTML = "جرّب اسمًا آخر";
        }

        showActionMessage("لم يتم العثور على المدينة", "warning");
        updateRefreshStatus("فشل البحث");

        console.error(error);
    }
}

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
    } else if (score >= 30) {
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

function openMapAndRun(action) {
    const mapButton = document.querySelector('[onclick*="mapPanel"]');

    if (typeof showProPanel === "function") {
        showProPanel("homePanel", mapButton || null);
    }

    setTimeout(() => {
        if (action === "radar") toggleRadar();
        if (action === "flood") toggleFloodRiskMap();
        if (action === "cloud" || action === "clouds") toggleCloudRainMap();
        if (action === "heatmap") toggleHeatmap();
        if (action === "cities") runSmartMultiCityBackgroundCheck(true);

        if (action === "refresh") {
            refreshNow();
            runSmartMultiCityBackgroundCheck(true);
        }

        if (map && typeof map.invalidateSize === "function") {
            map.invalidateSize();
        }
    }, 400);
}

function openFirstRainCity() {
    if (!window.lastMultiCityResults || window.lastMultiCityResults.length === 0) {
        showActionMessage("لا توجد بيانات مدن حالياً", "warning");
        return;
    }

    const city = window.lastMultiCityResults.find(c => {
        const rainNow = Number(c.score || 0);
        const rain24 = Number(c.forecast24Score || 0);
        const rain72 = Number(c.forecast72Score || 0);

        return rainNow >= 30 || rain24 >= 30 || rain72 >= 30;
    });

    if (!city) {
        showActionMessage("لا توجد مدن عليها تنبيه مطر حالياً", "warning");
        return;
    }

    openCityForecastPopup(city.name);
}

function openFirstFloodCity() {
    if (!window.lastMultiCityResults || window.lastMultiCityResults.length === 0) {
        showActionMessage("لا توجد بيانات مدن حالياً", "warning");
        return;
    }

    const city = window.lastMultiCityResults.find(c => {
        const flood = Number(c.floodRiskScore || 0);
        const rainNow = Number(c.score || 0);
        const rain24 = Number(c.forecast24Score || 0);
        const rain72 = Number(c.forecast72Score || 0);

        return flood >= 30 && (rainNow >= 30 || rain24 >= 30 || rain72 >= 30);
    });

    if (!city) {
        showActionMessage("لا توجد مدن معرضة للسيول حالياً", "warning");
        return;
    }

    openCityForecastPopup(city.name);
}

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
        runSmartMultiCityBackgroundCheck(true);
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

window.openFirstRainCity = function () {
    if (!window.lastMultiCityResults || window.lastMultiCityResults.length === 0) {
        showActionMessage("لا توجد بيانات مدن حالياً", "warning");
        return;
    }

    const city =
        window.lastMultiCityResults.find(c =>
            Number(c.score || 0) >= 30 ||
            Number(c.forecast24Score || 0) >= 30 ||
            Number(c.forecast72Score || 0) >= 30
        )
        ||
        window.lastMultiCityResults
            .slice()
            .sort((a, b) =>
                Math.max(Number(b.score || 0), Number(b.forecast24Score || 0), Number(b.forecast72Score || 0)) -
                Math.max(Number(a.score || 0), Number(a.forecast24Score || 0), Number(a.forecast72Score || 0))
            )[0];

    openCityForecastPopup(city.name);
};

window.openFirstFloodCity = function () {
    if (!window.lastMultiCityResults || window.lastMultiCityResults.length === 0) {
        showActionMessage("لا توجد بيانات مدن حالياً", "warning");
        return;
    }

    const city =
        window.lastMultiCityResults.find(c =>
            Number(c.floodRiskScore || 0) >= 30
        )
        ||
        window.lastMultiCityResults
            .slice()
            .sort((a, b) =>
                Number(b.floodRiskScore || 0) - Number(a.floodRiskScore || 0)
            )[0];

    openCityForecastPopup(city.name);
};
console.log("APP LOADED");

window.openFirstRainCity = function () {
    const results = window.lastMultiCityResults || [];

    const city = results.find(c => {
        const rainNow = Number(c.score || 0);
        const rain24 = Number(c.forecast24Score || 0);
        const rain72 = Number(c.forecast72Score || 0);

        return rainNow >= 30 || rain24 >= 30 || rain72 >= 30;
    });

    if (!city) {
        showActionMessage("لا توجد مدن عليها تنبيه مطر حالياً", "warning");
        return;
    }

    openCityForecastPopup(city.name);
};

window.openFirstRainCity = function () {
    const results = window.lastMultiCityResults || [];

    const cities = results
        .map(c => ({
            ...c,
            maxRain: Math.max(
                Number(c.score || 0),
                Number(c.forecast24Score || 0),
                Number(c.forecast72Score || 0)
            )
        }))
        .filter(c => c.maxRain >= 30)
        .sort((a, b) => b.maxRain - a.maxRain);

    if (!cities.length) {
        showActionMessage("لا توجد مدن عليها تنبيه مطر حالياً", "warning");
        return;
    }

    openCityForecastPopup(cities[0].name);
};

window.openFirstFloodCity = function () {
    const results = window.lastMultiCityResults || [];

    const cities = results
        .map(c => ({
            ...c,
            flood: Number(c.floodRiskScore || 0),
            maxRain: Math.max(
                Number(c.score || 0),
                Number(c.forecast24Score || 0),
                Number(c.forecast72Score || 0)
            )
        }))
        .filter(c => c.flood >= 30 || c.maxRain >= 30)
        .sort((a, b) => b.flood - a.flood);

    if (!cities.length) {
        showActionMessage("لا توجد مدن معرضة للسيول حالياً", "warning");
        return;
    }

    openCityForecastPopup(cities[0].name);
};

window.closeCityForecastPopup = function () {
    const modal = document.getElementById("cityForecastModal");
    if (modal) modal.remove();
};

window.openCityDetailsDirect = function (city) {
    if (!city) {
        showActionMessage("لا توجد بيانات لهذه المدينة", "warning");
        return;
    }

    closeCityForecastPopup();

    const peakTime =
        city.peakHour?.time
            ? city.peakHour.time.replace("T", " ")
            : "غير متوفر";

   const etaText =
    city.rainArrival?.label
    || city.rainArrival?.etaText
    || (
        city.cloudMovement?.etaMinutes
            ? city.cloudMovement.etaMinutes + " دقيقة"
            : peakTime
    );

    document.body.insertAdjacentHTML("beforeend", `
        <div id="cityForecastModal" class="rg-modal" style="display:flex !important;">
            <div class="rg-modal-content">
                <button class="rg-modal-close" onclick="closeCityForecastPopup()">×</button>

                <h2>تفاصيل ${city.name}</h2>

                <div class="rg-modal-score">
                    مؤشر الخطر الفعلي: ${city.actualRiskScore ?? city.score ?? 0}%
                </div>

                <div class="rg-modal-grid">
                    <div>المطر الآن: <strong>${city.score ?? 0}%</strong></div>
                    <div>24 ساعة: <strong>${city.forecast24Score ?? 0}%</strong></div>
                    <div>72 ساعة: <strong>${city.forecast72Score ?? 0}%</strong></div>
                    <div>السيول: <strong>${city.floodRiskScore ?? 0}%</strong></div>
                    <div>التضاريس: <strong>${city.terrainRiskScore ?? 0}%</strong></div>
                    <div>وقت وصول المطر: <strong>${etaText}</strong></div>
                </div>

                <div class="rg-modal-note">
                    اتجاه السحب: ${city.cloudMovement?.direction || "غير معروف"}<br>
                    سرعة السحب: ${city.cloudMovement?.speed || 0} كم/س<br>
                    وقت الذروة المتوقع: ${peakTime}<br>
                    المصدر: ${city.source || "Unknown"}<br>
                    الحالة: ${city.alertLevel || "غير متوفر"}
                </div>
            </div>
        </div>
    `);
};

window.openFirstRainCity = function () {
    const results = window.lastMultiCityResults || [];

    const city = results
        .filter(c => {
            const rain = Math.max(
                Number(c.score || 0),
                Number(c.forecast24Score || 0),
                Number(c.forecast72Score || 0)
            );
            return rain >= 10;
        })
        .sort((a, b) => {
            const rainA = Math.max(+a.score || 0, +a.forecast24Score || 0, +a.forecast72Score || 0);
            const rainB = Math.max(+b.score || 0, +b.forecast24Score || 0, +b.forecast72Score || 0);
            return rainB - rainA;
        })[0];

    if (!city) {
        showActionMessage("لا توجد مدن مطر حالياً", "warning");
        return;
    }

    openCityDetailsDirect(city);
};

window.openFirstFloodCity = function () {
    const results = window.lastMultiCityResults || [];

    const city = results
        .filter(c => Number(c.floodRiskScore || 0) >= 30)
        .sort((a, b) => Number(b.floodRiskScore || 0) - Number(a.floodRiskScore || 0))[0];

    openCityDetailsDirect(city);
};

window.openRainCityByName = function (cityName) {
    const city = (window.lastMultiCityResults || [])
        .find(c => c.name === cityName);

    if (!city) {
        showActionMessage("لا توجد بيانات لهذه المدينة حالياً", "warning");
        return;
    }

    openCityDetailsDirect(city);
};

setTimeout(() => {
    const rainCard = document.querySelector(".summary-card.rain");
    const floodCard = document.querySelector(".summary-card.flood");
    const cloudCard = document.querySelector(".summary-card.cloud");

    if (rainCard) {
        rainCard.onclick = function () {
            openFirstRainCity();
        };
        rainCard.style.cursor = "pointer";
    }

    if (floodCard) {
        floodCard.onclick = function () {
            openFirstFloodCity();
        };
        floodCard.style.cursor = "pointer";
    }

    if (cloudCard) {
        cloudCard.onclick = function () {
            showCloudCities();
        };
        cloudCard.style.cursor = "pointer";
    }
}, 2000);

function renderRainArrivalCitiesPanel(results) {
    const box = document.getElementById("rainArrivalCitiesBox");
    if (!box) return;

    if (!results || !results.length) {
        box.innerHTML = "لا توجد بيانات وقت وصول المطر حالياً.";
        return;
    }

    const cities = results
        .filter(city =>
            Number(city.score || 0) >= 20 ||
            Number(city.forecast24Score || 0) >= 20 ||
            Number(city.forecast72Score || 0) >= 20
        )
        .sort((a, b) => {
            const aPower =
                Number(a.score || 0) +
                Number(a.forecast24Score || 0) +
                Number(a.forecast72Score || 0) * 0.5 +
                Number(a.floodRiskScore || 0) * 0.25 +
                Number(a.terrainRiskScore || 0) * 0.2;

            const bPower =
                Number(b.score || 0) +
                Number(b.forecast24Score || 0) +
                Number(b.forecast72Score || 0) * 0.5 +
                Number(b.floodRiskScore || 0) * 0.25 +
                Number(b.terrainRiskScore || 0) * 0.2;

            return bPower - aPower;
        })
        .slice(0, 10);

    box.innerHTML = cities.map((city, index) => {
        const power = Math.round(
            Number(city.score || 0) +
            Number(city.forecast24Score || 0) +
            Number(city.forecast72Score || 0) * 0.5 +
            Number(city.floodRiskScore || 0) * 0.25 +
            Number(city.terrainRiskScore || 0) * 0.2
        );

        return `
            <div onclick="openRainCityByName('${city.name}')" style="
                padding:12px;
                margin-bottom:10px;
                border-radius:14px;
                background:#0f172a;
                border:1px solid #334155;
                cursor:pointer;
                line-height:1.8;
            ">
                <strong>${index + 1}. ${city.name}</strong><br>
                وقت الوصول: <strong>${city.rainArrival?.label || "احتمال خلال اليوم"}</strong><br>
                قوة الوصول: ${power}% | المطر: ${city.score}% | 24 ساعة: ${city.forecast24Score}%
            </div>
        `;
    }).join("");
}

window.renderRainArrivalCitiesPanel = renderRainArrivalCitiesPanel;