const API_BASE_URL = "https://rainguard-ai.onrender.com";

const OFFLINE_CACHE_KEY = "rainguard_last_success_data";

const NOTIFICATION_ENABLED_KEY = "rainguard_notifications_enabled";
const NOTIFICATION_LAST_ALERT_KEY = "rainguard_last_notification_time";
const NOTIFICATION_COOLDOWN_MINUTES = 30;
const BACKGROUND_MONITOR_KEY = "rainguard_background_monitor_enabled";
const BACKGROUND_MONITOR_INTERVAL_MINUTES = 10;

let backgroundMonitorInterval = null;
let backgroundMonitorEnabled = false;

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

        setTimeout(() => {
            updateRainHeatmap();
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

        const sourceStatusHTML = buildSourceStatusHTML(data);
        const forecastHTML = buildForecastHTML(data.next_hours);
        const dailyForecastHTML = buildDailyForecastHTML(data.daily_forecast);
        const confidenceHTML = buildConfidenceHTML(data);
        const radarFusionHTML = buildRadarFusionHTML(data);
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

    updateAccuracyBox();
    renderPredictionHistory();

    setTimeout(() => {
        startAutoRefresh();
        updateMultiCityMonitor();
    }, 3000);
};
