// ===== RainGuard AI frontend/app.js fixed - PART 1/9 =====

const API_BASE_URL = "https://rainguard-ai.onrender.com";

const APP_VERSION = "V12 Stable - MultiCity Working";
const TERRAIN_ENGINE_VERSION = "V12 Stable";
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
const SMART_MULTI_CITY_MIN_ALERT_SCORE = 30;

const SMART_MULTI_CITY_HISTORY_KEY = "rainguard_smart_multicity_history";
const SMART_MULTI_CITY_TOP_LIMIT = 20;
const SMART_MULTI_CITY_FORECAST_HOURS = 72;

const SMART_MULTI_CITY_EARLY_ALERT_KEY = "rainguard_smart_multicity_early_alert";
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

// ===== RainGuard AI frontend/app.js fixed - PART 2/9 =====

function calculateV9FloodRisk(city) {
    if (!city) return 0;

    const baseFloodRisk = calculateCityFloodRisk(city);
    const terrainRisk = calculateTerrainRisk(city.name);

    const forecastBoost =
        Math.max(
            Number(city.forecast24Score || 0),
            Number(city.forecast72Score || 0)
        ) >= 60 ? 8 : 0;

    const cloudBoost =
        Number(city.cloudScore || 0) >= 80 ? 8 :
        Number(city.cloudScore || 0) >= 60 ? 4 :
        0;

    const radarBoost =
        Number(city.radarRainIntensity || 0) >= 80 ? 20 :
        Number(city.radarRainIntensity || 0) >= 60 ? 15 :
        Number(city.radarRainIntensity || 0) >= 40 ? 10 :
        Number(city.radarRainIntensity || 0) >= 20 ? 5 :
        0;

    const finalRisk =
        (baseFloodRisk * 0.55) +
        (terrainRisk * 0.20) +
        forecastBoost +
        cloudBoost +
        radarBoost;

    return Math.min(Math.round(finalRisk), 100);
}

function getCloudMotionFallback(cityName) {
    const name = String(cityName || "");

    const westCoast = [
        "جدة", "مكة", "الطائف", "القنفذة", "الليث",
        "جازان", "صبيا", "أبو عريش", "الدرب"
    ];

    const southWest = [
        "أبها", "خميس مشيط", "الباحة", "النماص", "محايل عسير"
    ];

    const southEast = [
        "نجران", "شرورة"
    ];

    let direction = "غربية إلى شمالية غربية";
    let speed = 18;
    let etaMinutes = 360;

    if (westCoast.some(c => name.includes(c))) {
        direction = "غربية / جنوبية غربية";
        speed = 22;
        etaMinutes = 300;
    } else if (southWest.some(c => name.includes(c))) {
        direction = "جنوبية غربية";
        speed = 18;
        etaMinutes = 360;
    } else if (southEast.some(c => name.includes(c))) {
        direction = "جنوبية شرقية";
        speed = 16;
        etaMinutes = 420;
    }

    return {
        direction,
        speed,
        etaMinutes
    };
}

function estimateCloudMovement(cityName, currentScore, forecast24Score) {
    const previous = cloudMovementHistory[cityName];

    cloudMovementHistory[cityName] = {
        score: Number(currentScore) || 0,
        forecast24Score: Number(forecast24Score) || 0,
        time: Date.now()
    };

    if (!previous) {
        const fallback = getCloudMotionFallback(cityName);

        return {
            direction: fallback.direction,
            speed: fallback.speed,
            etaMinutes: fallback.etaMinutes,
            confidence: 45
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

    if (score >= 80) return "حرج";
    if (score >= 60) return "مرتفع";
    if (score >= 30) return "متابعة";
    return "منخفض";
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

// ===== RainGuard AI frontend/app.js fixed - PART 3/9 =====

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

function updateTopCityCard(results) {
    const nameEl = document.getElementById("topRiskCity");
    const scoreEl = document.getElementById("topRiskScore");
    const detailsEl = document.getElementById("topRiskDetails");

    if (!nameEl && !scoreEl && !detailsEl) return;

    if (!Array.isArray(results) || results.length === 0) {
        if (nameEl) nameEl.innerText = "غير محدد";
        if (scoreEl) scoreEl.innerText = "--%";
        if (detailsEl) detailsEl.innerText = "لم يتم تشغيل مراقبة المدن بعد";
        return;
    }

    const filtered = results.filter(city =>
        Number(city.score || 0) >= 20 ||
        Number(city.actualRiskScore || 0) >= 20 ||
        Number(city.floodRiskScore || 0) >= 20 ||
        Number(city.forecast24Score || 0) >= 20 ||
        Number(city.forecast72Score || 0) >= 20
    );

    if (!filtered.length) {
        if (nameEl) nameEl.innerText = "لا توجد مدينة";
        if (scoreEl) scoreEl.innerText = "--%";
        if (detailsEl) detailsEl.innerText = "لا توجد مؤشرات مطر حالياً";
        return;
    }

    const top = [...filtered].sort((a, b) => {
        const aScore = Number(a.actualRiskScore ?? a.floodRiskScore ?? a.score ?? 0);
        const bScore = Number(b.actualRiskScore ?? b.floodRiskScore ?? b.score ?? 0);
        return bScore - aScore;
    })[0];

    const peak = top.peakHour || {};

    const topScore = Math.round(
        Number(top.actualRiskScore ?? top.floodRiskScore ?? top.score ?? 0)
    );

    const humidity = Math.round(Number(peak.humidity ?? top.humidity ?? 0));
    const cloudCover = Math.round(Number(peak.cloud_cover ?? top.cloudScore ?? 0));
    const rainProbability = Math.round(Number(peak.rain_probability ?? top.rain_probability ?? 0));

    if (nameEl) nameEl.innerText = top.name || "غير محدد";
    if (scoreEl) scoreEl.innerText = `${topScore}%`;

    if (detailsEl) {
        detailsEl.innerHTML = `
            ${top.alertLevel || top.forecastTiming || "متابعة جوية"}
            <br>
            💧 الرطوبة: ${humidity}%
            <br>
            ☁️ السحب: ${cloudCover}%
            <br>
            🌧️ احتمال المطر: ${rainProbability}%
        `;
    }
}
function updateNationalProStatus(results) {
    if (!results || !results.length) return;

    const topRain = [...results].sort(
        (a, b) =>
            Number(b.forecast24Score || 0) -
            Number(a.forecast24Score || 0)
    )[0];

    const topFlood = [...results].sort(
        (a, b) =>
            Number(b.floodRiskScore || 0) -
            Number(a.floodRiskScore || 0)
    )[0];

    const rainCities = results.filter(city =>
        Number(city.score || 0) >= 20 ||
        Number(city.forecast24Score || 0) >= 20 ||
        Number(city.forecast72Score || 0) >= 20
    );

    const now = new Date().toLocaleTimeString("ar-SA", {
        hour: "2-digit",
        minute: "2-digit"
    });

    const rainEl = document.getElementById("nationalTopRainCity");
    const floodEl = document.getElementById("nationalTopFloodCity");
    const countEl = document.getElementById("nationalRainCount");
    const updateEl = document.getElementById("nationalLastUpdate");

    if (rainEl) {
        rainEl.innerText =
            `${topRain?.name || "--"} (${topRain?.forecast24Score || 0}%)`;
    }

    if (floodEl) {
        floodEl.innerText =
            `${topFlood?.name || "--"} (${topFlood?.floodRiskScore || 0}%)`;
    }

    if (countEl) countEl.innerText = rainCities.length;
    if (updateEl) updateEl.innerText = now;
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
    } else if (score >= 70) {
        document.body.classList.add("weather-storm");
    } else if (score >= 45) {
        document.body.classList.add("weather-watch");
    } else {
        document.body.classList.add("weather-safe");
    }
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

async function analyzeSubCityRainZones(cityName) {
    try {
        const zones = subCityRainZones?.[cityName];

        if (!zones || !zones.length) {
            return [];
        }

        const results = [];

        for (const zone of zones) {
            try {
                const url =
                    `${API_BASE_URL}/rain-alert?lat=${zone.lat}&lon=${zone.lon}&name=${encodeURIComponent(zone.name)}&hours=72`;

                const response = await fetch(url);
                if (!response.ok) continue;

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

                results.push({
                    name: zone.name,
                    lat: zone.lat,
                    lon: zone.lon,
                    score,
                    rainNow: score,
                    forecast24Score: getMaxScoreByRange(nextHours, 24),
                    forecast72Score: getMaxScoreByRange(nextHours, 72),
                    floodRiskScore: Number(data.floodRiskScore || 0),
                    terrainRiskScore: Number(data.terrainRiskScore || 0)
                });

            } catch (err) {
                console.warn("Sub zone skipped:", zone.name, err?.message || err);
            }
        }

        return results;

    } catch (err) {
        console.warn("analyzeSubCityRainZones error:", err?.message || err);
        return [];
    }
}

function calculateRainArrivalV12(city) {
    if (!city) {
        return {
            etaMinutes: null,
            label: "غير متوفر",
            confidence: 0,
            direction: "غير معروف"
        };
    }

    const now = Number(city.score || 0);
    const score24 = Number(city.forecast24Score || 0);
    const score72 = Number(city.forecast72Score || 0);
    const movement = city.cloudMovement || {};

    let etaMinutes = Number(movement.etaMinutes || 0) || null;
    let confidence = Number(movement.confidence || 40);
    let label = "لا يوجد وصول مطر واضح حالياً";

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
    } else if (score24 >= 25 || score72 >= 30 || now >= 25) {
        etaMinutes = 720;
        label = "احتمال خلال 12 ساعة";
        confidence = Math.max(confidence, 45);
    }

    return {
        etaMinutes,
        label,
        confidence,
        direction: movement.direction || "غير معروف"
    };
}

async function fetchAPI(path, retries = 2) {
    const separator = path.includes("?") ? "&" : "?";
    const url = path.startsWith("http")
        ? `${path}${separator}t=${Date.now()}`
        : `${API_BASE_URL}${path}${separator}t=${Date.now()}`;

    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const response = await fetch(url, {
                method: "GET",
                mode: "cors",
                cache: "no-store",
                headers: {
                    "Accept": "application/json"
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            return await response.json();

        } catch (error) {
            if (attempt === retries) {
                throw error;
            }

            await sleep(800);
        }
    }
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

    if (score >= 20) {
        return {
            color: "#facc15",
            icon: "🟡",
            label: "مؤشرات خفيفة"
        };
    }

    return {
        color: "#22c55e",
        icon: "🟢",
        label: "مستقر"
    };
}

function safeCityName(name) {
    return String(name || "")
        .replace(/\\/g, "\\\\")
        .replace(/'/g, "\\'")
        .replace(/"/g, "&quot;")
        .trim();
}

function formatEtaText(value) {
    if (!value) return "غير متوفر";

    const text = String(value);

    if (text.includes("الآن") || text.includes("حاضر")) {
        return text;
    }

    const match = text.match(/(\d+)/);

    if (!match) return text;

    const minutes = Number(match[1]);

    if (text.includes("ساعة") || text.includes("ساعات")) {
        return text;
    }

    if (minutes >= 60) {
        const hours = Math.round(minutes / 60);
        return `خلال ${hours} ساعات تقريباً`;
    }

    return `خلال ${minutes} دقيقة تقريباً`;
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

            return rainNow >= 30 || rain24 >= 30 || rain72 >= 30;
        })
        .sort((a, b) => {
            const aMax = Math.max(
                Number(a.score || 0),
                Number(a.forecast24Score || 0),
                Number(a.forecast72Score || 0)
            );

            const bMax = Math.max(
                Number(b.score || 0),
                Number(b.forecast24Score || 0),
                Number(b.forecast72Score || 0)
            );

            return bMax - aMax;
        })
        .slice(0, 10);

    if (rainCities.length === 0) {
        box.innerHTML = `
            <div style="
                padding:18px;
                text-align:center;
                color:#94a3b8;
                line-height:2;
            ">
                🌤️ لا توجد مدن عليها مؤشرات مطر حالياً
                <br>
                يتم عرض المدن إذا كان مؤشر المطر 30% أو أعلى.
            </div>
        `;
        return;
    }

    box.innerHTML = rainCities.map((city, index) => {
        const rainNow = Number(city.score || 0);
        const forecast24 = Number(city.forecast24Score || 0);
        const forecast72 = Number(city.forecast72Score || 0);
        const displayScore = Math.max(rainNow, forecast24, forecast72);
        const style = getRainPanelStyle(displayScore);
        const arrival = calculateRainArrivalV12(city);

        return `
            <div onclick="openRainCityByName('${safeCityName(city.name)}')" style="
                padding:14px;
                margin-bottom:12px;
                border-radius:16px;
                background:#0f172a;
                border:1px solid ${style.color};
                cursor:pointer;
            ">
                <div style="
                    display:flex;
                    justify-content:space-between;
                    align-items:center;
                    gap:10px;
                ">
                    <strong>${index + 1}. ${style.icon} ${city.name}</strong>
                    <strong style="color:${style.color};font-size:22px;">${displayScore}%</strong>
                </div>

                <div style="
                    margin-top:8px;
                    color:#cbd5e1;
                    line-height:1.8;
                    font-size:14px;
                ">
                    التصنيف: ${style.label}<br>
                    المطر الحالي: ${rainNow}%<br>
                    توقع المطر خلال 24 ساعة: ${forecast24}%<br>
                    توقع المطر خلال 72 ساعة: ${forecast72}%<br>
                    وقت وصول المطر: ${formatEtaText(arrival.label)}<br>
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
                    rainNow >= 25 ||
                    rain24 >= 25 ||
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
            <div onclick="openRainCityByName('${safeCityName(city.name)}')" style="
                padding:12px;
                margin-bottom:10px;
                border-radius:14px;
                background:#0f172a;
                border:1px solid ${color};
                cursor:pointer;
            ">
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

// ===== RainGuard AI frontend/app.js fixed - PART 5/9 =====

function renderFloodPredictionPanel(results) {
    const box = document.getElementById("floodPredictionBox");
    if (!box) return;

    if (!results || results.length === 0) {
        box.innerHTML = "لا توجد بيانات سيول حالياً.";
        return;
    }

    const ranked = [...results]
        .filter(city =>
            Number(city.floodRiskScore || 0) >= 30 &&
            (
                Number(city.score || 0) >= 25 ||
                Number(city.forecast24Score || 0) >= 25 ||
                Number(city.forecast72Score || 0) >= 30
            )
        )
        .sort((a, b) =>
            Number(b.floodRiskScore || 0) - Number(a.floodRiskScore || 0)
        );

    if (!ranked.length) {
        box.innerHTML = "لا توجد مدن معرضة للسيول حالياً.";
        return;
    }

    box.innerHTML = ranked.slice(0, 10).map((city, index) => {
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
                        onclick="openRainCityByName('${safeCityName(city.name)}')"
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

function calculateCloudMotionForCity(city) {
    const windSpeed = Number(city.windSpeed || city.wind_speed || city.wind || 0);
    const windDirection = Number(city.windDirection || city.wind_direction || city.windDeg || 0);

    let directionText = "غير معروف";

    if (windDirection >= 337.5 || windDirection < 22.5) directionText = "شمالية";
    else if (windDirection >= 22.5 && windDirection < 67.5) directionText = "شمالية شرقية";
    else if (windDirection >= 67.5 && windDirection < 112.5) directionText = "شرقية";
    else if (windDirection >= 112.5 && windDirection < 157.5) directionText = "جنوبية شرقية";
    else if (windDirection >= 157.5 && windDirection < 202.5) directionText = "جنوبية";
    else if (windDirection >= 202.5 && windDirection < 247.5) directionText = "جنوبية غربية";
    else if (windDirection >= 247.5 && windDirection < 292.5) directionText = "غربية";
    else if (windDirection >= 292.5 && windDirection < 337.5) directionText = "شمالية غربية";

    return {
        direction: directionText,
        speed: Math.round(windSpeed)
    };
}

function updateNationalWeatherSummary(results) {
    const rainEl = document.getElementById("rainCitiesCount");
    const floodEl = document.getElementById("floodCitiesCount");
    const cloudEl = document.getElementById("cloudCitiesCount");
    const rainCitiesListEl = document.getElementById("nationalRainCitiesList");
    const nationalRainCountEl = document.getElementById("nationalRainCount");

    if (!results || !results.length) {
        if (rainEl) rainEl.innerText = "0";
        if (nationalRainCountEl) nationalRainCountEl.innerText = "0";
        if (rainCitiesListEl) rainCitiesListEl.innerHTML = "--";
        if (floodEl) floodEl.innerText = "متابعة 0 | مرتفع 0 | حرج 0";
        if (cloudEl) cloudEl.innerText = "0";
        return;
    }

    const rainCities = results.filter(city =>
        Number(city.score || 0) >= 30 ||
        Number(city.forecast24Score || 0) >= 30 ||
        Number(city.forecast72Score || 0) >= 30
    );

    const watchFloodCities = results.filter(city =>
        Number(city.floodRiskScore || 0) >= 30 &&
        (
            Number(city.score || 0) >= 25 ||
            Number(city.forecast24Score || 0) >= 25 ||
            Number(city.forecast72Score || 0) >= 30
        )
    );

    const highFloodCities = watchFloodCities.filter(city =>
        Number(city.floodRiskScore || 0) >= 60
    );

    const extremeFloodCities = watchFloodCities.filter(city =>
        Number(city.floodRiskScore || 0) >= 80
    );

    const cloudCities = results.filter(city =>
        Number(city.score || 0) >= 10 &&
        Number(city.score || 0) < 30 &&
        Number(city.forecast24Score || 0) < 30
    );

    if (rainEl) rainEl.innerText = rainCities.length;
    if (nationalRainCountEl) nationalRainCountEl.innerText = rainCities.length;

    if (rainCitiesListEl) {
        rainCitiesListEl.innerHTML = rainCities.length
            ? rainCities.slice(0, 5).map(city => `
                <span style="cursor:pointer;color:#38bdf8;font-weight:bold;"
                      onclick="openRainCityByName('${safeCityName(city.name)}')">
                    ${city.name}
                </span>
            `).join("، ")
            : "--";
    }

    if (floodEl) {
        floodEl.innerText =
            `متابعة ${watchFloodCities.length} | مرتفع ${highFloodCities.length} | حرج ${extremeFloodCities.length}`;
    }

    if (cloudEl) cloudEl.innerText = cloudCities.length;

    const proTopRainCity = [...results]
        .map(city => ({
            ...city,
            maxRain: Math.max(
                Number(city.score || 0),
                Number(city.forecast24Score || 0),
                Number(city.forecast72Score || 0)
            )
        }))
        .sort((a, b) => b.maxRain - a.maxRain)[0];

    const proTopFloodCity = [...results].sort((a, b) =>
        Number(b.floodRiskScore || 0) - Number(a.floodRiskScore || 0)
    )[0];

    window.topRainCityName = proTopRainCity?.name || null;
    window.topFloodCityName = proTopFloodCity?.name || null;

    const nationalTopRainEl = document.getElementById("nationalTopRainCity");
    if (nationalTopRainEl) {
        nationalTopRainEl.innerText = proTopRainCity
            ? `${proTopRainCity.name} (${proTopRainCity.maxRain}%)`
            : "--";
        nationalTopRainEl.style.cursor = "pointer";
        nationalTopRainEl.onclick = openTopRainCity;
    }

    const nationalTopFloodEl = document.getElementById("nationalTopFloodCity");
    if (nationalTopFloodEl) {
        nationalTopFloodEl.innerText = proTopFloodCity
            ? `${proTopFloodCity.name} (${proTopFloodCity.floodRiskScore || 0}%)`
            : "--";
        nationalTopFloodEl.style.cursor = "pointer";
        nationalTopFloodEl.onclick = openTopFloodCity;
    }

    const nationalUpdateEl = document.getElementById("nationalLastUpdate");
    if (nationalUpdateEl) {
        nationalUpdateEl.innerText = new Date().toLocaleTimeString("ar-SA");
    }
}

function openTopRainCity() {
    if (window.topRainCityName) {
        rgOpenCityDetails(window.topRainCityName);
    }
}

function openTopFloodCity() {
    if (window.topFloodCityName) {
        rgOpenCityDetails(window.topFloodCityName);
    }
}

function updateNationalStatus(results) {
    const box = document.getElementById("nationalProStatus");
    if (!box) return;

    if (!results || !results.length) {
        box.innerHTML = "⚪ الحالة الوطنية: لا توجد بيانات";
        box.style.borderColor = "#64748b";
        updateNationalWeatherSummary([]);
        return;
    }

    updateNationalWeatherSummary(results);

    const maxRain = Math.max(
        ...results.map(city =>
            Math.max(
                Number(city.score || 0),
                Number(city.forecast24Score || 0),
                Number(city.forecast72Score || 0)
            )
        ),
        0
    );

    const maxFlood = Math.max(
        ...results
            .filter(city =>
                Number(city.score || 0) >= 25 ||
                Number(city.forecast24Score || 0) >= 25 ||
                Number(city.forecast72Score || 0) >= 30
            )
            .map(city => Number(city.floodRiskScore || 0)),
        0
    );

    if (maxFlood >= 80) {
        box.innerHTML = `🚨 الحالة الوطنية: خطر سيول مرتفع`;
        box.style.borderColor = "#ef4444";
        return;
    }

    if (maxFlood >= 60) {
        box.innerHTML = `🟠 الحالة الوطنية: متابعة سيول`;
        box.style.borderColor = "#f59e0b";
        return;
    }

    if (maxRain >= 30) {
        box.innerHTML = `🔵 الحالة الوطنية: متابعة أمطار`;
        box.style.borderColor = "#38bdf8";
        return;
    }

    box.innerHTML = "🟢 الحالة الوطنية: مستقرة";
    box.style.borderColor = "#22c55e";
}

// ===== RainGuard AI frontend/app.js fixed - PART 6/9 =====

function renderNationalTrendPanel(results) {
    const panel = document.getElementById("nationalTrendPanel");
    if (!panel) return;

    if (!results || !results.length) {
        panel.innerHTML = "لا توجد بيانات توقع حالياً";
        return;
    }

    const topCities = [...results]
        .filter(city => Number(city.forecast72Score || 0) >= 30)
        .sort((a, b) =>
            Number(b.forecast72Score || 0) - Number(a.forecast72Score || 0)
        )
        .slice(0, 10);

    if (!topCities.length) {
        panel.innerHTML = `
            <div style="text-align:center;padding:30px;color:#94a3b8;line-height:2;">
                🌤️ لا توجد توقعات مطر مهمة خلال 72 ساعة<br>
                يتم العرض إذا كان توقع 72 ساعة 30% أو أعلى.
            </div>
        `;
        return;
    }

    panel.innerHTML = `
        <div style="line-height:2;">
            <div style="font-weight:800;margin-bottom:10px;color:#38bdf8;">
                🌦️ أعلى توقعات المطر خلال 72 ساعة
            </div>

            ${topCities.map((city, index) => {
                const score = Number(city.forecast72Score || 0);
                const style = getRainPanelStyle(score);

                return `
                    <div onclick="openRainCityByName('${safeCityName(city.name)}')" style="
                        cursor:pointer;
                        padding:8px 0;
                        border-bottom:1px solid rgba(51,65,85,.6);
                    ">
                        <div style="display:flex;justify-content:space-between;align-items:center;">
                            <span>${index + 1}. ${style.icon} ${city.name}</span>
                            <strong style="color:${style.color};">${score}%</strong>
                        </div>

                        <div style="margin-top:5px;height:7px;background:#1e293b;border-radius:999px;overflow:hidden;">
                            <div style="width:${score}%;height:100%;background:${style.color};"></div>
                        </div>

                        <div style="color:#94a3b8;font-size:12px;margin-top:4px;">
                            توقع 72 ساعة: ${style.label}
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
        box.innerHTML = "لا توجد بيانات وصول مطر حالياً.";
        return;
    }

    const cities = [...results]
        .map(city => {
            const arrival = calculateRainArrivalV12(city);
            const eta =
                Number(arrival?.etaMinutes) ||
                Number(city.cloudMovement?.etaMinutes) ||
                99999;

            return {
                ...city,
                arrival,
                eta
            };
        })
        .filter(city => {
            const rainNow = Number(city.score || 0);
            const rain24 = Number(city.forecast24Score || 0);
            const rain72 = Number(city.forecast72Score || 0);

            return (
                rainNow >= 20 ||
                rain24 >= 20 ||
                rain72 >= 20
            );
        })
        .sort((a, b) => a.eta - b.eta)
        .slice(0, 8);

    if (!cities.length) {
        box.innerHTML = "لا توجد مدن قريبة لوصول المطر حالياً.";
        return;
    }

    box.innerHTML = cities.map((city, index) => {
        const rainNow = Number(city.score || 0);
        const rain24 = Number(city.forecast24Score || 0);
        const rain72 = Number(city.forecast72Score || 0);
        const strength = Math.max(rainNow, rain24, rain72);

        const arrivalText = formatEtaText(
            city.arrival?.label ||
            city.rainArrival?.label ||
            (
                city.cloudMovement?.etaMinutes
                    ? city.cloudMovement.etaMinutes + " دقيقة"
                    : "غير متوفر"
            )
        );

        return `
            <div onclick="openRainCityByName('${safeCityName(city.name)}')" style="
                padding:14px;
                margin-bottom:12px;
                border-radius:14px;
                background:#0f172a;
                border:1px solid #38bdf8;
                cursor:pointer;
                line-height:1.9;
            ">
                <strong style="font-size:18px;color:#e0f2fe;">
                    ${index + 1}. ${city.name}
                </strong><br>

                وقت المتابعة: <strong>${arrivalText}</strong><br>

                قوة المتابعة: <strong>${strength}%</strong> |
                المطر: <strong>${rainNow}%</strong> |
                24 ساعة: <strong>${rain24}%</strong> |
                72 ساعة: <strong>${rain72}%</strong>
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
            <div onclick="openRainCityByName('${safeCityName(city.name)}')" style="
                padding:14px;
                margin-bottom:12px;
                border-radius:16px;
                background:#0f172a;
                border:1px solid #334155;
                cursor:pointer;
            ">
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

    if (score >= 80) return 11000;
    if (score >= 60) return 8500;
    if (score >= 30) return 6000;

    return 3500;
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
    if (!map || !results || results.length === 0) return;

    clearFloodMapLayer();

    const unique = [];
    const used = new Set();

    results.forEach(city => {
        if (!city.lat || !city.lon) return;

        const key =
            `${String(city.name || "").trim()}_${Math.round(Number(city.lat) * 100)}_${Math.round(Number(city.lon) * 100)}`;

        if (used.has(key)) return;

        used.add(key);
        unique.push(city);
    });

    unique.forEach(city => {
        const floodScore = Number(city.floodRiskScore || 0);
        if (floodScore < 30) return;

        const color = getFloodMapColor(floodScore);
        const radius = getFloodMapRadius(floodScore);
        const label = getFloodRiskLabel(floodScore);

        const circle = L.circle([city.lat, city.lon], {
            color,
            fillColor: color,
            fillOpacity: 0.14,
            opacity: 0.75,
            radius
        });

        const popupDiv = document.createElement("div");
        popupDiv.innerHTML = `
            <b>${city.name}</b><br>
            التصنيف: ${label}<br>
            المطر الآن: ${city.score ?? 0}%<br>
            24 ساعة: ${city.forecast24Score ?? 0}%<br>
            72 ساعة: ${city.forecast72Score ?? 0}%<br>
            السيول: ${floodScore}%<br><br>
        `;

        const detailsBtn = document.createElement("button");
        detailsBtn.type = "button";
        detailsBtn.innerText = "عرض التفاصيل";
        detailsBtn.style.cssText = `
            padding:8px 14px;
            border-radius:8px;
            border:1px solid #38bdf8;
            background:#082f49;
            color:white;
            cursor:pointer;
            font-weight:bold;
        `;

        const openDetailsFromPopup = function (e) {
            if (e) {
                e.preventDefault();
                e.stopPropagation();
            }
            openCityDetailsDirect(city);
        };

        detailsBtn.onclick = openDetailsFromPopup;
        detailsBtn.onmousedown = openDetailsFromPopup;
        detailsBtn.ontouchstart = openDetailsFromPopup;

        popupDiv.appendChild(detailsBtn);

        if (window.L?.DomEvent) {
            L.DomEvent.disableClickPropagation(popupDiv);
            L.DomEvent.disableScrollPropagation(popupDiv);
        }

        circle.bindPopup(popupDiv);
        circle.on("dblclick", () => openCityDetailsDirect(city));

        if (floodMapEnabled) circle.addTo(map);
        floodMapLayer.push(circle);
    });
}

// ===== RainGuard AI frontend/app.js fixed - PART 7/9 =====

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
    if (!map || !results || results.length === 0) return;

    clearCloudRainMapLayer();

    const unique = [];
    const used = new Set();

    results.forEach(city => {
        if (!city.lat || !city.lon) return;

        const key =
            `${String(city.name || "").trim()}_${Math.round(Number(city.lat) * 100)}_${Math.round(Number(city.lon) * 100)}`;

        if (used.has(key)) return;

        used.add(key);
        unique.push(city);
    });

    unique.forEach(city => {
        const rainScore = Number(city.score || 0);
        const forecast24 = Number(city.forecast24Score || 0);
        const forecast72 = Number(city.forecast72Score || 0);
        const cloudScore = Math.max(rainScore, forecast24, forecast72);

        if (cloudScore < 20) return;

        let color = "#38bdf8";
        let label = "متابعة مطر";

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

        const radius = Math.min(12000, 2500 + cloudScore * 70);

        const rainCircle = L.circle([city.lat, city.lon], {
            color,
            fillColor: color,
            fillOpacity: 0.18,
            opacity: 0.65,
            radius
        });

        const popupDiv = document.createElement("div");
        popupDiv.innerHTML = `
            <b>${city.name}</b><br>
            ${label}<br>
            المطر الآن: ${rainScore}%<br>
            خلال 24 ساعة: ${forecast24}%<br>
            خلال 72 ساعة: ${forecast72}%<br>
            السحب/المؤشر العام: ${cloudScore}%<br>
            السيول: ${city.floodRiskScore ?? "--"}%<br><br>
        `;

        const detailsBtn = document.createElement("button");
        detailsBtn.type = "button";
        detailsBtn.innerText = "عرض التفاصيل";
        detailsBtn.style.cssText = `
            padding:8px 14px;
            border-radius:8px;
            border:1px solid #38bdf8;
            background:#082f49;
            color:white;
            cursor:pointer;
            font-weight:bold;
        `;

        const openDetailsFromPopup = function (e) {
            if (e) {
                e.preventDefault();
                e.stopPropagation();
            }
            openCityDetailsDirect(city);
        };

        detailsBtn.onclick = openDetailsFromPopup;
        detailsBtn.onmousedown = openDetailsFromPopup;
        detailsBtn.ontouchstart = openDetailsFromPopup;

        popupDiv.appendChild(detailsBtn);

        if (window.L?.DomEvent) {
            L.DomEvent.disableClickPropagation(popupDiv);
            L.DomEvent.disableScrollPropagation(popupDiv);
        }

        rainCircle.bindPopup(popupDiv);
        rainCircle.on("dblclick", () => openCityDetailsDirect(city));

        if (cloudRainMapEnabled) rainCircle.addTo(map);
        cloudRainMapLayer.push(rainCircle);
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

function normalizeCityNameForSearch(name) {
    return String(name || "")
        .trim()
        .replace(/\s+/g, "")
        .replace(/[أإآ]/g, "ا")
        .replace(/ة/g, "ه");
}

function getCityByNameFlexible(cityName) {
    const target = normalizeCityNameForSearch(cityName);

    return (window.lastMultiCityResults || []).find(city => {
        const current = normalizeCityNameForSearch(city.name);
        return current === target || current.includes(target) || target.includes(current);
    });
}

// ===== RainGuard AI frontend/app.js fixed - PART 8/9 =====

function openCityForecastPopup(cityName) {
    closeCityForecastPopup();

    const city = getCityByNameFlexible(cityName);

    if (!city) {
        showActionMessage("لا توجد بيانات تفصيلية لهذه المدينة حالياً", "warning");
        return;
    }

    const peakTime =
        city.peakHour?.time
            ? city.peakHour.time.replace("T", " ")
            : "غير متوفر";

    const etaText = formatEtaText(
        city.rainArrival?.label ||
        (
            city.cloudMovement?.etaMinutes
                ? city.cloudMovement.etaMinutes + " دقيقة"
                : peakTime
        )
    );

    const html = `
        <div id="cityForecastModal" class="rg-modal" style="display:flex !important;">
            <div class="rg-modal-content">
                <button class="rg-modal-close" onclick="closeCityForecastPopup()">×</button>

                <h2>تفاصيل ${city.name}</h2>

                <div class="rg-modal-score">
                    ${APP_VERSION}<br>
                    مؤشر الخطر الفعلي: ${city.actualRiskScore ?? city.floodRiskScore ?? city.score ?? "--"}%
                </div>

                <button id="refreshCityBtn" onclick="refreshCityForecastPopup('${safeCityName(city.name)}')" style="
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
                    <div>المطر الآن: <strong>${city.score ?? "--"}%</strong></div>
                    <div>24 ساعة: <strong>${city.forecast24Score ?? "--"}%</strong></div>
                    <div>72 ساعة: <strong>${city.forecast72Score ?? "--"}%</strong></div>
                    <div>السيول: <strong>${city.floodRiskScore ?? "--"}%</strong></div>
                    <div>التضاريس: <strong>${city.terrainRiskScore ?? "--"}%</strong></div>
                    <div>وقت وصول المطر: <strong>${etaText}</strong></div>
                </div>

                <div style="
                    margin-top:16px;
                    padding:14px;
                    border-radius:16px;
                    background:#020617;
                    border:1px solid #334155;
                    color:#cbd5e1;
                    line-height:1.8;
                ">
                    <div style="color:#38bdf8;font-weight:bold;margin-bottom:10px;">
                        ☁️ Cloud Motion Engine ${CLOUD_TRACKER_VERSION}
                    </div>

                    اتجاه السحب:
                    <strong>${city.cloudMovement?.direction || "غير معروف"}</strong><br>

                    سرعة السحب:
                    <strong>${city.cloudMovement?.speed || 0}</strong> كم/س<br>

                    زمن الوصول المتوقع:
                    <strong>${etaText}</strong><br>

                    الثقة:
                    <strong>${city.cloudMovement?.confidence || city.rainArrival?.confidence || 0}%</strong>
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
                    وقت الذروة المتوقع: ${peakTime}<br>
                    سبب الخطورة: ${city.terrainSummary || "غير محدد"}<br>
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

        if (window.activeCityMiniMap && typeof window.activeCityMiniMap.remove === "function") {
            try {
                window.activeCityMiniMap.remove();
            } catch {}
            window.activeCityMiniMap = null;
        }

        const miniMap = L.map(miniMapEl, {
            zoomControl: false,
            attributionControl: false
        }).setView([city.lat, city.lon], 10);

        window.activeCityMiniMap = miniMap;

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

function openCityDetailsDirect(city) {
    if (!city) {
        showActionMessage("لا توجد بيانات لهذه المدينة", "warning");
        return;
    }

    openCityForecastPopup(city.name);
}

window.openCityForecastPopup = openCityForecastPopup;
window.openCityDetailsDirect = openCityDetailsDirect;

function closeCityForecastPopup() {
    const modal = document.getElementById("cityForecastModal");

    if (window.activeCityMiniMap && typeof window.activeCityMiniMap.remove === "function") {
        try {
            window.activeCityMiniMap.remove();
        } catch (error) {
            console.warn("Mini map cleanup skipped:", error.message);
        }
        window.activeCityMiniMap = null;
    }

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
                onclick="showCloudCityDetails('${safeCityName(c.name)}')"
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

    modal.style.display = "flex";
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

    const city = getCityByNameFlexible(cityName);
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
                <button onclick="focusCloudCityOnMap('${safeCityName(city.name)}')" style="
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
    const city = getCityByNameFlexible(cityName);

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
        openCityForecastPopup(city.name);
    }, 500);
}

// ===== RainGuard AI frontend/app.js fixed - PART 9/9 =====

function getAdaptiveRefreshMinutes(score) {
    score = Number(score) || 0;
    if (score >= 80) return 5;
    if (score >= 60) return 10;
    return 30;
}

function applyAdaptiveRefresh(score) {
    lastRainScore = Number(score) || 0;
    const newMinutes = getAdaptiveRefreshMinutes(lastRainScore);

    if (newMinutes === adaptiveRefreshMinutes && autoRefreshEnabled) return;

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

        if (Number(hour.rain_score) >= 80) {
            hourClass = "rain-high";
        } else if (Number(hour.rain_score) >= 60) {
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

        if (Number(day.daily_rain_score) >= 80) {
            dayClass = "rain-high";
        } else if (Number(day.daily_rain_score) >= 60) {
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
            <div style="margin-top:12px;padding:16px;border-radius:16px;background:#020617;border:1px solid #334155;color:#cbd5e1;line-height:1.9;">
                <div style="font-size:22px;font-weight:bold;color:#38bdf8;">🔎 حالة المصادر</div>
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
            <div id="confidenceText" style="margin-top:12px;padding:16px;border-radius:16px;background:#020617;border:1px solid #334155;color:#cbd5e1;line-height:1.9;">
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

    const style = getRainPanelStyle(fusionScore);

    return `
        <div class="forecast-section">
            <h3>Smart Radar Fusion AI</h3>
            <div style="margin-top:12px;padding:16px;border-radius:16px;background:#020617;border:1px solid #334155;color:#cbd5e1;line-height:1.9;">
                <div style="font-size:24px;font-weight:bold;color:${style.color};">
                    ${style.icon} ${style.label} - ${fusionScore}%
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
            <div style="margin-top:12px;padding:16px;border-radius:16px;background:#020617;border:1px solid #334155;color:#cbd5e1;line-height:1.9;">
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
            <div style="margin-top:12px;padding:16px;border-radius:16px;background:#020617;border:1px solid #334155;color:#cbd5e1;line-height:1.9;">
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
                    <div style="padding:12px;margin-bottom:10px;border-radius:14px;background:#0f172a;border:1px solid #334155;">
                        <div style="display:flex;justify-content:space-between;align-items:center;">
                            <strong>${style.icon} ${city.name}</strong>
                            <strong style="color:${style.color};font-size:20px;">${city.score}%</strong>
                        </div>
                        <div style="margin-top:8px;color:#94a3b8;font-size:13px;">
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

        const response = await fetch("https://api.rainviewer.com/public/weather-maps.json");

        if (!response.ok) return;

        const data = await response.json();

        if (!data.radar || !data.radar.past || data.radar.past.length === 0) return;

        const latestRadar = data.radar.past[data.radar.past.length - 1];

        const radarUrl =
            `${data.host}${latestRadar.path}/256/{z}/{x}/{y}/2/1_1.png`;

        if (rainLayer && map.hasLayer(rainLayer)) {
            map.removeLayer(rainLayer);
        }

        rainLayer = L.tileLayer(radarUrl, {
            minZoom: 4,
            maxZoom: 8,
            opacity: 0.65,
            zIndex: 500,
            attribution: "RainViewer"
        });

        if (radarEnabled && map) {
            rainLayer.addTo(map);
        }

        if (map.getZoom() > 8) {
            map.setZoom(8);
        }

    } catch (error) {
        console.error("loadRainRadar error:", error);
    }
}

async function getLiveRadarIntensity(lat, lon) {
    return 0;
}

function latToTileY(lat, zoom) {
    return Math.floor(
        (
            (1 -
                Math.log(
                    Math.tan(lat * Math.PI / 180) +
                    1 / Math.cos(lat * Math.PI / 180)
                ) / Math.PI
            ) / 2
        ) * Math.pow(2, zoom)
    );
}

function lonToTileX(lon, zoom) {
    return Math.floor(
        ((Number(lon) + 180) / 360) * Math.pow(2, zoom)
    );
}

function getRadarPixelIntensity(r, g, b, a) {
    if (!a || a < 20) return 0;

    const max = Math.max(r, g, b);

    if (max < 25) return 0;
    if (r >= 180 && g <= 120) return 90;
    if (r >= 150 && g <= 170) return 75;
    if (g >= 150 && r >= 120) return 60;
    if (g >= 120 || b >= 160) return 40;
    if (max >= 60) return 20;

    return 0;
}

async function getRainViewerRadarFusionV1(lat, lon) {
    try {
        const response = await fetch("https://api.rainviewer.com/public/weather-maps.json");
        const data = await response.json();

        if (!data.radar || !data.radar.past || data.radar.past.length === 0) {
            return {
                radarAvailable: false,
                radarIntensity: 0,
                radarSource: "RainViewer",
                note: "لا توجد بيانات رادار متاحة"
            };
        }

        const latestRadar = data.radar.past[data.radar.past.length - 1];

        const z = 6;
        const x = lonToTileX(lon, z);
        const y = latToTileY(lat, z);

        const tileUrl =
            `https://tilecache.rainviewer.com${latestRadar.path}/256/${z}/${x}/${y}/1/1_1.png`;

        return {
            radarAvailable: true,
            radarIntensity: 0,
            radarSource: "RainViewer",
            radarTime: latestRadar.time,
            radarPath: latestRadar.path,
            tileUrl,
            note: "الرادار متاح"
        };

    } catch (error) {
        console.error("Radar Fusion V1 Error:", error);

        return {
            radarAvailable: false,
            radarIntensity: 0,
            radarSource: "RainViewer",
            note: "فشل الاتصال بالرادار"
        };
    }
}

async function toggleRadar() {
    if (!map) {
        showActionMessage("الخريطة غير جاهزة", "warning");
        return;
    }

    if (rainLayer && map.hasLayer(rainLayer)) {
        map.removeLayer(rainLayer);
        radarEnabled = false;
        showActionMessage("تم إيقاف الرادار", "warning");
        return;
    }

    if (!rainLayer) {
        await loadRainRadar();
    }

    if (rainLayer) {
        rainLayer.addTo(map);
        radarEnabled = true;
        showActionMessage("تم تشغيل الرادار", "success");
    } else {
        showActionMessage("تعذر تحميل رادار المطر", "danger");
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

    if (extraMessage) text += ` | ${extraMessage}`;

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

function showActionMessage(message, type = "success") {
    const box = document.getElementById("actionMessage");

    if (!box) {
        console.log(message);
        return;
    }

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

function saveLastSuccessfulWeather(data, lat, lon, name) {
    if (!data || data.error) return;

    localStorage.setItem("rainguard_last_success_data", JSON.stringify({
        data,
        lat,
        lon,
        name,
        savedAt: new Date().toISOString()
    }));
}

function getLastSuccessfulWeather() {
    try {
        return JSON.parse(localStorage.getItem("rainguard_last_success_data"));
    } catch {
        return null;
    }
}

function isBackgroundMonitorEnabled() {
    return localStorage.getItem(BACKGROUND_MONITOR_KEY) === "true";
}

function updateBackgroundMonitorStatus(message = "") {
    const box = document.getElementById("backgroundMonitorStatus");
    if (!box) return;

    const state = isBackgroundMonitorEnabled() ? "مفعلة" : "متوقفة";

    const now = new Date().toLocaleTimeString("ar-SA", {
        hour: "2-digit",
        minute: "2-digit"
    });

    box.innerText =
        `المراقبة الخلفية: ${state} | آخر فحص: ${now}${message ? " | " + message : ""}`;
}

function startAutoRefresh() {
    if (autoRefreshInterval) clearInterval(autoRefreshInterval);

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
    if (autoRefreshInterval) clearInterval(autoRefreshInterval);

    autoRefreshInterval = null;
    autoRefreshEnabled = false;

    showActionMessage("تم إيقاف التحديث الذكي", "warning");
    updateRefreshStatus("تم إيقاف التحديث الذكي");
}

function checkSmartAlert(score, alertLevel, locationName) {
    let currentLevel = "LOW";

    if (score >= 80) currentLevel = "HIGH";
    else if (score >= 60) currentLevel = "MEDIUM";
    else if (score >= 30) currentLevel = "WATCH";

    if (currentLevel === lastSmartAlertLevel) return;

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
        const style = getRainPanelStyle(item.score);

        return `
            <div style="padding:14px;margin-bottom:12px;border-radius:16px;background:#0f172a;border:1px solid #334155;">
                <strong style="font-size:22px;color:white;">${item.locationName}</strong>
                <br><br>
                <span style="color:${style.color};font-weight:bold;font-size:22px;">
                    مؤشر الخطر: ${item.score}%
                </span>
                <br>
                <span style="color:#cbd5e1;font-size:18px;">
                    ${item.alertLevel || style.label}
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
    if (cityInput) cityInput.value = item.locationName;

    if (item.lat && item.lon) {
        checkRain(item.lat, item.lon, item.locationName);
    } else {
        detectRain();
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
}

function updateAccuracyBox() {
    const box = document.getElementById("accuracyBox");
    if (!box) return;

    let saved = { total: 0, correct: 0 };

    try {
        saved = JSON.parse(localStorage.getItem("rainguard_accuracy")) || saved;
    } catch {}

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
    let saved = { total: 0, correct: 0 };

    try {
        saved = JSON.parse(localStorage.getItem(key)) || saved;
    } catch {}

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
        `رابط التطبيق:\nhttps://rain-guard-ai.vercel.app/`;

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

    const style = getRainPanelStyle(score);

    box.innerHTML = `
        <div style="padding:14px;border-radius:16px;background:#020617;border:1px solid #334155;line-height:1.8;color:#cbd5e1;">
            🤖 تحليل ${APP_VERSION}<br>
            المدينة: ${name || "--"}<br>
            مؤشر المطر: <strong style="color:${style.color};">${score || 0}%</strong><br>
            التصنيف: ${style.label}<br>
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

// ===== RainGuard AI frontend/app.js fixed - PART 10 FINAL =====

function checkPushRainAlert(score, locationName, alertLevel) {
    score = Number(score) || 0;
    if (score >= 30) {
        console.log(`تنبيه: ${locationName} - ${score}% - ${alertLevel}`);
    }
}

function buildOfflineEmergencyHTML(saved) {
    if (!saved || !saved.data) return "";

    const current = saved.data.current || {};
    const best = saved.data.best_hour || current;

    return `
        <div class="forecast-section">
            <h3>⚠️ وضع الطوارئ</h3>
            <div style="padding:16px;border-radius:16px;background:#451a03;color:#fde68a;line-height:1.8;">
                يتم عرض آخر بيانات محفوظة.<br>
                الموقع: ${saved.name || saved.data.location_name || "--"}<br>
                مؤشر المطر: ${best.rain_score ?? "--"}%<br>
                الرطوبة: ${current.humidity ?? "--"}%<br>
                السحب: ${current.cloud_cover ?? "--"}%<br>
                احتمال المطر: ${current.rain_probability ?? "--"}%
            </div>
        </div>
    `;
}

function calculateCityFloodRisk(city) {
    if (!city) return 0;

    const rainScore = Number(city.score || 0);
    const forecast24 = Number(city.forecast24Score || 0);
    const forecast72 = Number(city.forecast72Score || 0);
    const cloudScore = Number(city.cloudScore || 0);
    const cityWeight = floodCityWeights?.[city.name] || 0;

    const risk =
        rainScore * 0.30 +
        forecast24 * 0.22 +
        forecast72 * 0.20 +
        cloudScore * 0.13 +
        cityWeight;

    return Math.min(Math.round(risk), 100);
}

async function checkRain(lat, lon, name = "موقع محدد", silent = false, retryCount = 0) {
    const cityName = document.getElementById("cityName");
    const statusText = document.getElementById("statusText");
    const adviceText = document.getElementById("adviceText");

    if (cityName) cityName.innerText = name;

    if (!silent) {
        if (statusText) {
            statusText.innerText = "جاري تحليل المطر...";
            statusText.className = "";
        }
        if (adviceText) adviceText.innerHTML = "";
    }

    if (typeof initMap === "function") {
        initMap(lat, lon);
    }

    lastLat = lat;
    lastLon = lon;
    lastName = name;

    try {
        const url =
            `${API_BASE_URL}/rain-alert?lat=${lat}&lon=${lon}&name=${encodeURIComponent(name)}&hours=12&t=${Date.now()}`;

        const response = await fetch(url, {
            method: "GET",
            mode: "cors",
            cache: "no-store",
            headers: {
                "Accept": "application/json"
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        if (data.error) {
            throw new Error(data.message || "فشل جلب البيانات");
        }

        if (typeof saveLastSuccessfulWeather === "function") {
            saveLastSuccessfulWeather(data, lat, lon, name);
        }

        const current = data.current || {};
        const best = data.best_hour || current;
        const score = Math.round(Number(best.rain_score || 0));

        if (typeof updateMainWeatherValues === "function") {
            updateMainWeatherValues(current);
        }

        if (typeof updateProDashboardWidgets === "function") {
            updateProDashboardWidgets(data, name, score, best);
        }

        if (typeof updateAIWidgets === "function") {
            updateAIWidgets(data, score, name);
        }

        if (typeof updateRiskBar === "function") {
            updateRiskBar(score);
        }

        if (typeof updateLightningStormMode === "function") {
            updateLightningStormMode(score);
        }

        if (typeof applyAdaptiveRefresh === "function") {
            applyAdaptiveRefresh(score);
        }

        if (typeof updateWeatherEffectsByRisk === "function") {
            updateWeatherEffectsByRisk(score);
        }

        if (statusText) {
            statusText.className =
                score >= 80 ? "rain-high" :
                score >= 60 ? "rain-medium" :
                "rain-low";

            statusText.innerText =
                `${best.alert_level || "تحليل المطر"} - ${score}%`;
        }

        const forecastHTML =
            typeof buildForecastHTML === "function"
                ? buildForecastHTML(data.next_hours || [])
                : "";

        const dailyForecastHTML =
            typeof buildDailyForecastHTML === "function"
                ? buildDailyForecastHTML(data.daily_forecast || [])
                : "";

        const sourceStatusHTML =
            typeof buildSourceStatusHTML === "function"
                ? buildSourceStatusHTML(data)
                : "";

        const confidenceHTML =
            typeof buildConfidenceHTML === "function"
                ? buildConfidenceHTML(data)
                : "";

        const radarFusionHTML =
            typeof buildRadarFusionHTML === "function"
                ? buildRadarFusionHTML(data)
                : "";

        const arrivalTrackerHTML =
            typeof buildRainArrivalTrackerHTML === "function"
                ? buildRainArrivalTrackerHTML(data)
                : "";

        const floodRiskHTML =
            typeof buildFloodRiskHTML === "function"
                ? buildFloodRiskHTML(data, name)
                : "";

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

        if (adviceText) {
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
                        <strong>${current.wind_speed ?? "--"} كم/س</strong>
                    </div>
                </div>
                ${forecastHTML}
                ${dailyForecastHTML}
            `;
        }

        if (marker) {
            marker.bindPopup(`
                <b>${name}</b><br>
                مؤشر المطر: ${score}%<br>
                ${best.alert_level || ""}
            `);
        }

        if (typeof checkSmartAlert === "function") {
            checkSmartAlert(score, best.alert_level || "تحليل المطر", name);
        }

        if (typeof checkPushRainAlert === "function") {
            checkPushRainAlert(score, name, best.alert_level || "تحليل المطر");
        }

        if (typeof savePredictionHistory === "function") {
            savePredictionHistory(
                name,
                score,
                best.alert_level || "تحليل المطر",
                lat,
                lon
            );
        }

        if (typeof updateRefreshStatus === "function") {
            updateRefreshStatus("تم تحديث البيانات");
        }

        return data;

    } catch (error) {
        console.error("checkRain error:", error);

        if (retryCount < 1) {
            await new Promise(resolve => setTimeout(resolve, 2500));
            return checkRain(lat, lon, name, silent, retryCount + 1);
        }

        const saved =
            typeof getLastSuccessfulWeather === "function"
                ? getLastSuccessfulWeather()
                : null;

        if (saved && saved.data && adviceText) {
            if (typeof buildOfflineEmergencyHTML === "function") {
                adviceText.innerHTML = buildOfflineEmergencyHTML(saved);
            }
        }

        if (statusText) {
            statusText.className = "rain-high";
            statusText.innerText = "تعذر الاتصال";
        }

        if (typeof updateRefreshStatus === "function") {
            updateRefreshStatus("فشل التحديث");
        }
    }
}

function sortMultiCityResults(results) {
    return [...(results || [])].sort((a, b) => {
        const aScore = Math.max(
            Number(a.actualRiskScore || 0),
            Number(a.score || 0),
            Number(a.forecast24Score || 0),
            Number(a.forecast72Score || 0),
            Number(a.floodRiskScore || 0)
        );

        const bScore = Math.max(
            Number(b.actualRiskScore || 0),
            Number(b.score || 0),
            Number(b.forecast24Score || 0),
            Number(b.forecast72Score || 0),
            Number(b.floodRiskScore || 0)
        );

        return bScore - aScore;
    });
}

async function runSmartMultiCityBackgroundCheck(force = false) {
    if (window.isMultiCityRunning) {
        console.log("Smart MultiCity already running...");
        return window.lastMultiCityResults || [];
    }

    window.isMultiCityRunning = true;

    const results = [];

    try {
        for (const city of smartMultiCityMonitorList) {
            try {
                await sleep(120);

                const data = await fetchAPI(
                    `/rain-alert?lat=${city.lat}&lon=${city.lon}&name=${encodeURIComponent(city.name)}&hours=12`
                );

                if (!data || data.error === true) {
                    console.warn("Skipped city:", city.name);
                    continue;
                }

                const current = data.current || {};
                const best = data.best_hour || current;
                const nextHours = Array.isArray(data.next_hours) ? data.next_hours : [];

                const score = Number(best.rain_score || current.rain_score || 0);
                const forecast24Score = getMaxScoreByRange(nextHours, 24);
                const forecast72Score = getMaxScoreByRange(nextHours, 72);
                const peakHour = getPeakHourByRange(nextHours, 72) || current;

                const cityResult = {
                    name: city.name,
                    lat: city.lat,
                    lon: city.lon,
                    score,
                    forecast24Score,
                    forecast72Score,
                    cloudScore: Number(current.cloud_cover || peakHour?.cloud_cover || 0),
                    humidity: Number(current.humidity || peakHour?.humidity || 0),
                    rain_probability: Number(current.rain_probability || peakHour?.rain_probability || 0),
                    floodRiskScore: Math.round(Math.max(score, forecast24Score, forecast72Score) * 0.6),
                    actualRiskScore: Math.round(Math.max(score, forecast24Score, forecast72Score)),
                    peakHour,
                    alertLevel: best.alert_level || current.alert_level || "متابعة جوية",
                    source: data.source || "Unknown",
                    current
                };

                results.push(cityResult);

                const sortedResults = sortMultiCityResults(results);
                window.lastMultiCityResults = sortedResults;

                updateTopCityCard?.(sortedResults);

                console.log("PUSHED CITY:", city.name, sortedResults.length);

            } catch (err) {
                console.warn("Smart city skipped:", city.name, err?.message || err);
                continue;
            }
        }

        const sortedResults = sortMultiCityResults(results);
        window.lastMultiCityResults = sortedResults;

        updateTopCityCard?.(sortedResults);
        renderSmartMultiCityTopPanel?.(sortedResults);
        renderFloodWatchCitiesPanel?.(sortedResults);
        updateNationalWeatherSummary?.(sortedResults);
        updateNationalStatus?.(sortedResults);
        renderNationalTrendPanel?.(sortedResults);
        renderRainArrivalCitiesPanel?.(sortedResults);
        updateFloodRiskMap?.(sortedResults);
        updateCloudRainMapLayer?.(sortedResults);
        saveLastMultiCityResults?.(sortedResults);

        console.log("Smart MultiCity Results:", sortedResults);

        return sortedResults;

    } catch (err) {
        console.error("runSmartMultiCityBackgroundCheck error:", err);
        return results;

    } finally {
        window.isMultiCityRunning = false;
    }
}

function startWeatherEffects() {
    if (!weatherEffectsEnabled) return;
    if (document.getElementById("weatherFx")) return;

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

window.rgOpenCityDetails = function (cityName) {
    const city = getCityByNameFlexible(cityName);
    if (!city) {
        showActionMessage("لا توجد بيانات لهذه المدينة حالياً", "warning");
        return;
    }
    openCityForecastPopup(city.name);
};

window.openRainCityByName = function (cityName) {
    const city = getCityByNameFlexible(cityName);
    if (!city) {
        showActionMessage("لا توجد بيانات لهذه المدينة حالياً", "warning");
        return;
    }

    const lat = Number(city.lat);
    const lon = Number(city.lon);

    if (window.map && Number.isFinite(lat) && Number.isFinite(lon)) {
        window.map.setView([lat, lon], 9);
        L.popup()
            .setLatLng([lat, lon])
            .setContent(`
                <b>${city.name}</b><br>
                مؤشر تجمع المياه: ${city.floodRiskScore || 0}%<br>
                المطر الآن: ${city.score || 0}%<br>
                24 ساعة: ${city.forecast24Score || 0}%
            `)
            .openOn(window.map);
    }

    openCityForecastPopup(city.name);
};

window.openFirstRainCity = function () {
    const results = window.lastMultiCityResults || [];
    const city = results
        .map(c => ({
            ...c,
            maxRain: Math.max(
                Number(c.score || 0),
                Number(c.forecast24Score || 0),
                Number(c.forecast72Score || 0)
            )
        }))
        .filter(c => c.maxRain >= 10)
        .sort((a, b) => b.maxRain - a.maxRain)[0];

    if (!city) {
        showActionMessage("لا توجد مدن مطر حالياً", "warning");
        return;
    }

    openCityForecastPopup(city.name);
};

window.openFirstFloodCity = function () {
    const results = window.lastMultiCityResults || [];
    const city = results
        .map(c => ({
            ...c,
            floodPower:
                Number(c.floodRiskScore || 0) * 0.6 +
                Math.max(
                    Number(c.score || 0),
                    Number(c.forecast24Score || 0),
                    Number(c.forecast72Score || 0)
                ) * 0.4
        }))
        .filter(c => c.floodPower >= 10)
        .sort((a, b) => b.floodPower - a.floodPower)[0];

    if (!city) {
        showActionMessage("لا توجد مدن تحت المتابعة حالياً", "warning");
        return;
    }

    openCityForecastPopup(city.name);
};

async function loadPredictionAnalytics() {
    try {
        const response = await fetch(`${API_BASE_URL}/prediction-analytics?v=${Date.now()}`);

        if (!response.ok) throw new Error("فشل جلب دقة الذكاء الاصطناعي");

        const data = await response.json();
        const container = document.getElementById("aiAccuracyCard");
        if (!container) return;

        const accuracyText =
            Number(data.verified_predictions || 0) > 0
                ? `${data.accuracy_percent}%`
                : "لم يتم التحقق بعد";

        container.innerHTML = `
            <div class="analytics-card">
                <h3>🧠 دقة الذكاء الاصطناعي</h3>
                <div>إجمالي التنبؤات: ${data.total_predictions ?? 0}</div>
                <div>تم التحقق: ${data.verified_predictions ?? 0}</div>
                <div>نجاح: ${data.successful_predictions ?? 0}</div>
                <div>فشل: ${data.failed_predictions ?? 0}</div>
                <hr>
                <div>الدقة الحالية: <strong>${accuracyText}</strong></div>
                <div>متوسط Rain Score: ${data.average_rain_score ?? 0}</div>
                <div>متوسط المطر الفعلي: ${data.average_actual_rain ?? 0}</div>
            </div>
        `;
    } catch (err) {
        console.error("Prediction analytics error:", err);

        const container = document.getElementById("aiAccuracyCard");
        if (container) {
            container.innerHTML = `
                <div class="analytics-card">
                    <h3>🧠 دقة الذكاء الاصطناعي</h3>
                    <div style="color:#fca5a5;">تعذر تحميل بيانات الدقة حالياً</div>
                </div>
            `;
        }
    }
}

const LAST_MULTI_CITY_CACHE_KEY = "rainguard_last_multicity_results";

function saveLastMultiCityResults(results) {
    try {
        if (!Array.isArray(results) || results.length === 0) return;
        localStorage.setItem(
            LAST_MULTI_CITY_CACHE_KEY,
            JSON.stringify({
                time: Date.now(),
                results
            })
        );
    } catch (e) {
        console.warn("Save MultiCity cache failed:", e);
    }
}

function loadLastMultiCityResults() {
    try {
        const raw = localStorage.getItem(LAST_MULTI_CITY_CACHE_KEY);
        if (!raw) return [];

        const parsed = JSON.parse(raw);
        return Array.isArray(parsed.results) ? parsed.results : [];
    } catch (e) {
        console.warn("Load MultiCity cache failed:", e);
        return [];
    }
}

window.onload = function () {
    console.log("APP LOADED");

    const cachedResults = sortMultiCityResults(loadLastMultiCityResults?.() || []);

    if (cachedResults.length > 0) {
        window.lastMultiCityResults = cachedResults;
        updateTopCityCard?.(cachedResults);
        renderSmartMultiCityTopPanel?.(cachedResults);
        updateNationalWeatherSummary?.(cachedResults);
        updateNationalStatus?.(cachedResults);
        console.log("Loaded cached MultiCity:", cachedResults.length);
    }

    try {
        initMap?.();
    } catch (e) {
        console.warn("initMap skipped:", e);
    }

    try {
        renderSmartMultiCityHistory?.();
    } catch (e) {
        console.warn("renderSmartMultiCityHistory skipped:", e);
    }

    try {
        updateBackgroundMonitorStatus?.(
            isBackgroundMonitorEnabled?.()
                ? "مراقبة مفعلة"
                : "جاهزة للتشغيل"
        );
    } catch (e) {
        console.warn("Background monitor status skipped:", e);
    }

    setTimeout(() => {
        try {
            const rainCard = document.querySelector(".summary-card.rain");
            const floodCard = document.querySelector(".summary-card.flood");
            const cloudCard = document.querySelector(".summary-card.cloud");

            if (rainCard) {
                rainCard.onclick = () => window.openFirstRainCity?.();
                rainCard.style.cursor = "pointer";
            }

            if (floodCard) {
                floodCard.onclick = () => window.openFirstFloodCity?.();
                floodCard.style.cursor = "pointer";
            }

            if (cloudCard) {
                cloudCard.onclick = () => showCloudCities?.();
                cloudCard.style.cursor = "pointer";
            }
        } catch (e) {
            console.warn("Summary card click handlers skipped:", e);
        }
    }, 1000);

    setTimeout(() => {
        runSmartMultiCityBackgroundCheck(true);
    }, 1500);

    setTimeout(() => {
        try {
            loadPredictionAnalytics?.();
        } catch (e) {
            console.warn("Prediction analytics skipped:", e);
        }
    }, 4000);
};
window.toggleSmartMultiCityMonitoring = function () {
    const current =
        localStorage.getItem(SMART_MULTI_CITY_KEY) === "true";

    const next = !current;

    localStorage.setItem(
        SMART_MULTI_CITY_KEY,
        next ? "true" : "false"
    );

    if (next) {
        showActionMessage?.("تم تشغيل مراقبة المدن الذكية", "success");
        runSmartMultiCityBackgroundCheck?.(true);
    } else {
        showActionMessage?.("تم إيقاف مراقبة المدن الذكية", "warning");
    }

    console.log("Smart MultiCity Monitoring:", next);
};

window.toggleBackgroundRainMonitoring = function () {
    const current =
        localStorage.getItem(BACKGROUND_MONITOR_KEY) === "true";

    const next = !current;

    localStorage.setItem(
        BACKGROUND_MONITOR_KEY,
        next ? "true" : "false"
    );

    if (next) {
        showActionMessage?.("تم تشغيل المراقبة المباشرة", "success");
        runSmartMultiCityBackgroundCheck?.(true);
    } else {
        showActionMessage?.("تم إيقاف المراقبة المباشرة", "warning");
    }

    console.log("Background Monitoring:", next);
};

window.startBackgroundRainMonitoring = async function () {
    localStorage.setItem(BACKGROUND_MONITOR_KEY, "true");

    console.log("Background Monitoring: true");

    if (typeof updateBackgroundMonitorStatus === "function") {
        updateBackgroundMonitorStatus("تم تشغيل المراقبة المباشرة");
    }

    if (typeof runSmartMultiCityBackgroundCheck === "function") {
        await runSmartMultiCityBackgroundCheck(true);
    }
};

window.stopBackgroundRainMonitoring = function () {
    localStorage.setItem(BACKGROUND_MONITOR_KEY, "false");

    console.log("Background Monitoring: false");

    if (typeof updateBackgroundMonitorStatus === "function") {
        updateBackgroundMonitorStatus("تم إيقاف المراقبة المباشرة");
    }
};



