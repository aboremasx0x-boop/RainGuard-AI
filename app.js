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

let adaptiveRefreshMinutes = 30;
let lastRainScore = 0;

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
    const bestScore = Number(best.rain_score) || 0;

    let nextHigherIndex = -1;
    let peakIndex = -1;
    let peakScore = 0;

    nextHours.forEach((hour, index) => {
        const score = Number(hour.rain_score) || 0;

        if (score > peakScore) {
            peakScore = score;
            peakIndex = index;
        }

        if (nextHigherIndex === -1 && score >= Math.max(40, currentScore + 10)) {
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
        const hoursAway = nextHigherIndex;
        arrivalText = `المؤشرات قد ترتفع خلال ${hoursAway} ساعة تقريبًا`;
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
// سجل آخر التوقعات
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

                <span style="color:${color}; font-weight:bold; font-size:22px;">
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
                    style="
                        width:100%;
                        background:#2563eb;
                        color:white;
                        border:none;
                        padding:12px;
                        border-radius:12px;
                        font-size:16px;
                        font-weight:bold;
                        cursor:pointer;
                    ">
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
// مشاركة النتيجة في واتساب
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
// تقييم دقة التوقع
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

    const accuracy = Math.round((saved.correct / saved.total) * 100);

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
// تحليل المطر مع Retry
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

        if (data.error) {
            if (retryCount < 1) {
                showActionMessage(
                    "جاري إعادة المحاولة للحصول على البيانات",
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

            throw new Error(data.message || "فشل جلب البيانات");
        }

        const current = data.current;
        const best = data.best_hour;

        const score = Number(best.rain_score) || 0;

        const forecastHTML = buildForecastHTML(data.next_hours);
        const dailyForecastHTML = buildDailyForecastHTML(data.daily_forecast);
        const confidenceHTML = buildConfidenceHTML(data);
        const radarFusionHTML = buildRadarFusionHTML(data);
        const arrivalTrackerHTML = buildRainArrivalTrackerHTML(data);

        let className = "rain-low";

        if (score >= 80) {
            className = "rain-high";
        } else if (score >= 60) {
            className = "rain-medium";
        }

        applyAlertCardColor(score);
        updateRiskBar(score);
        applyAdaptiveRefresh(score);

        statusText.className = className;
        statusText.innerText = `${best.alert_level} - ${score}%`;

        checkSmartAlert(score, best.alert_level, name);

        savePredictionHistory(
            name,
            score,
            best.alert_level,
            lat,
            lon
        );

        adviceText.innerHTML = `
            <p>${best.advice}</p>

            ${confidenceHTML}
            ${radarFusionHTML}
            ${arrivalTrackerHTML}

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
                تعذر جلب البيانات مؤقتًا.<br>
                قد يكون مصدر الطقس مشغولًا أو الخادم يستيقظ الآن.<br><br>
                حاول مرة أخرى بعد دقيقة.
            </div>
        `;

        showActionMessage(
            "فشل جلب البيانات بعد إعادة المحاولة",
            "danger"
        );

        updateRefreshStatus("فشل التحديث");
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

    updateAccuracyBox();
    renderPredictionHistory();

    setTimeout(() => {
        startAutoRefresh();
    }, 3000);
};
