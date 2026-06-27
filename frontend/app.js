<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>App.js Additions - Rain Alert Lifecycle</title>
<style>
body{background:#0f172a;color:#e5e7eb;font-family:Tahoma,Arial,sans-serif;padding:24px;line-height:1.8}
h1{color:#38bdf8}
pre{direction:ltr;text-align:left;white-space:pre-wrap;background:#020617;border:1px solid #334155;border-radius:16px;padding:18px;overflow:auto;color:#e2e8f0}
.note{background:#111827;border:1px solid #334155;border-radius:14px;padding:14px;margin-bottom:16px}
</style>
</head>
<body>
<h1>App.js Additions - Rain Alert Lifecycle</h1>
<div class="note">انسخ الكود التالي إلى الملف المناسب في GitHub.</div>
<pre><code>/* =========================================================
RainGuard AI - Rain Alert Lifecycle + Alert Command Center Additions
انسخ هذا الكود داخل frontend/app.js

المكان المقترح:
1) الثوابت في أعلى الملف بعد FLOOD_ALERT_LAST_KEY
2) الدوال قبل window.onload
3) استدعاءات window.onload داخل window.onload الحالي
4) saveRainAlertLifecycle داخل runSmartMultiCityBackgroundCheck
========================================================= */


/* ===============================
   1) Constants
   ضعها أعلى app.js بعد ثوابت Flood
================================ */

const RAIN_ALERT_LIFECYCLE_KEY = "rainguard_rain_alert_lifecycle";
const RAIN_ALERT_LIFECYCLE_INTERVAL_MINUTES = 10;

let rainAlertLifecycleInterval = null;


/* ===============================
   2) Rain Alert Lifecycle Core
   ضع هذه الدوال قبل window.onload
================================ */

function getRainAlertStage(city) {
    const score = Number(city.score || city.actualRiskScore || 0);
    const forecast24 = Number(city.forecast24Score || city.forecast24 || 0);
    const forecast72 = Number(city.forecast72Score || city.forecast72 || 0);
    const flood = Number(city.floodRiskScore || city.flood_score || 0);
    const cloud = Number(city.cloudScore || city.cloud_cover || 0);
    const humidity = Number(city.humidity || 0);

    const maxScore = Math.max(score, forecast24, forecast72);

    if (score &gt;= 70) {
        return {
            stage: "raining",
            label: "🔴 Raining | المطر حاضر الآن",
            color: "#ef4444"
        };
    }

    if (maxScore &gt;= 70 || (cloud &gt;= 80 &amp;&amp; humidity &gt;= 70)) {
        return {
            stage: "high_risk",
            label: "🟠 High Risk | خطر مرتفع",
            color: "#f59e0b"
        };
    }

    if (maxScore &gt;= 50 || (cloud &gt;= 65 &amp;&amp; humidity &gt;= 60)) {
        return {
            stage: "developing",
            label: "🟡 Developing | الحالة تتطور",
            color: "#facc15"
        };
    }

    if (maxScore &gt;= 30 || flood &gt;= 25) {
        return {
            stage: "monitoring",
            label: "🔵 Monitoring | تحت المتابعة",
            color: "#38bdf8"
        };
    }

    return {
        stage: "cleared",
        label: "⚪ Cleared | انتهى التنبيه",
        color: "#94a3b8"
    };
}

function saveRainAlertLifecycle(results) {
    if (!Array.isArray(results)) return;

    const activeAlerts = results
        .filter(city =&gt; {
            const maxScore = Math.max(
                Number(city.score || city.actualRiskScore || 0),
                Number(city.forecast24Score || city.forecast24 || 0),
                Number(city.forecast72Score || city.forecast72 || 0),
                Number(city.floodRiskScore || city.flood_score || 0)
            );

            return maxScore &gt;= 30;
        })
        .map(city =&gt; {
            const lifecycle = getRainAlertStage(city);

            return {
                name: city.name || city.city || "غير محدد",
                lat: city.lat || city.latitude || null,
                lon: city.lon || city.longitude || null,
                score: Number(city.score || city.actualRiskScore || 0),
                forecast24Score: Number(city.forecast24Score || city.forecast24 || city.score || 0),
                forecast72Score: Number(city.forecast72Score || city.forecast72 || city.score || 0),
                floodRiskScore: Number(city.floodRiskScore || city.flood_score || 0),
                stage: lifecycle.stage,
                label: lifecycle.label,
                color: lifecycle.color,
                updatedAt: Date.now()
            };
        });

    localStorage.setItem(
        RAIN_ALERT_LIFECYCLE_KEY,
        JSON.stringify(activeAlerts)
    );

    renderRainAlertLifecycle(activeAlerts);
}

function loadRainAlertLifecycle() {
    try {
        return JSON.parse(
            localStorage.getItem(RAIN_ALERT_LIFECYCLE_KEY) || "[]"
        );
    } catch {
        return [];
    }
}

function getAlertTimelineSteps(alertItem) {
    const score = Number(alertItem.score || 0);
    const forecast24 = Number(alertItem.forecast24Score || 0);
    const forecast72 = Number(alertItem.forecast72Score || 0);
    const flood = Number(alertItem.floodRiskScore || 0);
    const maxScore = Math.max(score, forecast24, forecast72);

    return [
        { label: "بدأ الرصد", active: maxScore &gt;= 30 },
        { label: "ازدياد المؤشرات", active: maxScore &gt;= 40 },
        { label: "احتمال مطر واضح", active: maxScore &gt;= 50 },
        { label: "تنبيه مطر", active: maxScore &gt;= 60 },
        { label: "المطر حاضر", active: score &gt;= 70 },
        { label: "مراقبة السيول", active: flood &gt;= 30 },
        { label: "انتهاء الحالة", active: maxScore &lt; 30 }
    ];
}

function renderAlertTimeline(alertItem) {
    const steps = getAlertTimelineSteps(alertItem);

    return `
        &lt;div class="alert-timeline"&gt;
            ${steps.map(step =&gt; `
                &lt;div class="alert-timeline-step ${step.active ? "active" : ""}"&gt;
                    &lt;span&gt;${step.active ? "✓" : "○"}&lt;/span&gt;
                    ${step.label}
                &lt;/div&gt;
            `).join("")}
        &lt;/div&gt;
    `;
}

function renderRainAlertLifecycle(alerts = loadRainAlertLifecycle()) {
    const box = document.getElementById("rainAlertLifecycleBox");
    if (!box) return;

    alerts = Array.isArray(alerts) ? alerts : [];

    if (alerts.length === 0) {
        box.innerHTML = `
            &lt;div style="color:#94a3b8;line-height:1.8;"&gt;
                لا توجد تنبيهات مطر نشطة حالياً.
            &lt;/div&gt;
        `;
        return;
    }

    box.innerHTML = alerts.map(alertItem =&gt; `
        &lt;div class="lifecycle-alert-card" style="border:1px solid ${alertItem.color || "#38bdf8"};"&gt;
            &lt;strong style="color:${alertItem.color || "#38bdf8"};"&gt;
                ${alertItem.name || "--"}
            &lt;/strong&gt;&lt;br&gt;

            الحالة: &lt;strong&gt;${alertItem.label || alertItem.stage || "Monitoring"}&lt;/strong&gt;&lt;br&gt;
            المطر الآن: ${alertItem.score ?? 0}%&lt;br&gt;
            توقع 24 ساعة: ${alertItem.forecast24Score ?? 0}%&lt;br&gt;
            توقع 72 ساعة: ${alertItem.forecast72Score ?? 0}%&lt;br&gt;
            خطر السيول: ${alertItem.floodRiskScore ?? 0}%&lt;br&gt;

            ${renderAlertTimeline(alertItem)}

            &lt;button type="button" onclick="showRainAlertReason('${String(alertItem.name || "").replace(/'/g, "\\'")}')"&gt;
                سبب التنبيه
            &lt;/button&gt;&lt;br&gt;

            &lt;small&gt;
                آخر تحديث: ${
                    alertItem.updatedAt
                        ? new Date(alertItem.updatedAt).toLocaleTimeString("ar-SA")
                        : "--"
                }
            &lt;/small&gt;
        &lt;/div&gt;
    `).join("");
}

function showRainAlertReason(cityName) {
    const alerts = loadRainAlertLifecycle();
    const item = alerts.find(a =&gt; a.name === cityName);

    if (!item) {
        window.alert("لا توجد بيانات لهذا التنبيه");
        return;
    }

    const maxScore = Math.max(
        Number(item.score || 0),
        Number(item.forecast24Score || 0),
        Number(item.forecast72Score || 0)
    );

    window.alert(
        "سبب التنبيه:\n\n" +
        "المدينة: " + item.name + "\n" +
        "الحالة: " + (item.label || item.stage || "Monitoring") + "\n" +
        "أعلى مؤشر مطر: " + maxScore + "%\n" +
        "المطر الآن: " + (item.score ?? 0) + "%\n" +
        "توقع 24 ساعة: " + (item.forecast24Score ?? 0) + "%\n" +
        "توقع 72 ساعة: " + (item.forecast72Score ?? 0) + "%\n" +
        "خطر السيول: " + (item.floodRiskScore ?? 0) + "%\n\n" +
        "القرار: تم إبقاء المدينة ضمن المراقبة المستمرة."
    );
}

function startRainAlertLifecycleMonitor() {
    if (rainAlertLifecycleInterval) {
        clearInterval(rainAlertLifecycleInterval);
        rainAlertLifecycleInterval = null;
    }

    rainAlertLifecycleInterval = setInterval(async () =&gt; {
        try {
            if (typeof runSmartMultiCityBackgroundCheck === "function") {
                await runSmartMultiCityBackgroundCheck(true);
            }
        } catch (e) {
            console.warn("Rain Alert Lifecycle monitor skipped:", e);
        }
    }, RAIN_ALERT_LIFECYCLE_INTERVAL_MINUTES * 60 * 1000);
}


/* ===============================
   3) App.js integration points
================================ */

/*
داخل runSmartMultiCityBackgroundCheck ابحث عن:

window.lastMultiCityResults = sortedResults;

وأضف بعدها مباشرة:
*/

saveRainAlertLifecycle?.(sortedResults);
renderRainAlertLifecycle?.();


/*
داخل window.onload أضف هذا قبل نهاية الدالة:
*/

try {
    renderRainAlertLifecycle?.();
    startRainAlertLifecycleMonitor?.();
} catch (e) {
    console.warn("Rain Alert Lifecycle skipped:", e);
}

setTimeout(() =&gt; {
    try {
        renderRainAlertLifecycle(loadRainAlertLifecycle());
    } catch (e) {
        console.warn("Rain Alert Lifecycle delayed render skipped:", e);
    }
}, 3500);
</code></pre>
</body>
</html>
