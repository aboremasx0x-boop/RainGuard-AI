<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>App.js Additions - Rain Alert Lifecycle + Event Bus</title>
<style>
body{background:#0f172a;color:#e5e7eb;font-family:Tahoma,Arial,sans-serif;padding:24px;line-height:1.8}
h1{color:#38bdf8}
pre{direction:ltr;text-align:left;white-space:pre-wrap;background:#020617;border:1px solid #334155;border-radius:16px;padding:18px;overflow:auto;color:#e2e8f0}
.note{background:#111827;border:1px solid #334155;border-radius:14px;padding:14px;margin-bottom:16px}
</style>
</head>
<body>
<h1>App.js Additions - Rain Alert Lifecycle + Live Event Bus</h1>
<div class="note">انسخ الكود التالي إلى <b>frontend/app.js</b> في الأماكن الموضحة داخل التعليقات.</div>
<pre><code>/* =========================================================
RainGuard AI - Rain Alert Lifecycle + Live Event Bus Integration
انسخ هذا الكود داخل frontend/app.js

المكان المقترح:
1) الثوابت في أعلى app.js بعد ثوابت Flood
2) الدوال قبل window.onload
3) استدعاءات window.onload داخل window.onload الحالي
4) saveRainAlertLifecycle + publishMultiCityResultsToEventBus داخل runSmartMultiCityBackgroundCheck
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
    const humidity = Number(city.humidity || city.relative_humidity || 0);

    const maxScore = Math.max(score, forecast24, forecast72);

    if (score &gt;= 70) {
        return {
            stage: "raining",
            label: "🔴 Raining | المطر حاضر الآن",
            color: "#ef4444"
        };
    }

    if (maxScore &gt;= 70 || flood &gt;= 50 || (cloud &gt;= 80 &amp;&amp; humidity &gt;= 70)) {
        return {
            stage: "high_risk",
            label: "🟠 High Risk | خطر مرتفع",
            color: "#f59e0b"
        };
    }

    if (maxScore &gt;= 50 || flood &gt;= 35 || (cloud &gt;= 65 &amp;&amp; humidity &gt;= 60)) {
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

function normalizeRainAlertCity(city) {
    const lifecycle = getRainAlertStage(city);

    return {
        name: city.name || city.city || "غير محدد",
        lat: city.lat || city.latitude || null,
        lon: city.lon || city.longitude || null,
        score: Number(city.score || city.actualRiskScore || 0),
        forecast24Score: Number(city.forecast24Score || city.forecast24 || city.score || 0),
        forecast72Score: Number(city.forecast72Score || city.forecast72 || city.score || 0),
        floodRiskScore: Number(city.floodRiskScore || city.flood_score || 0),
        cloudScore: Number(city.cloudScore || city.cloud_cover || 0),
        humidity: Number(city.humidity || city.relative_humidity || 0),
        stage: lifecycle.stage,
        label: lifecycle.label,
        color: lifecycle.color,
        updatedAt: Date.now()
    };
}

function saveRainAlertLifecycle(results) {
    if (!Array.isArray(results)) return [];

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
        .map(normalizeRainAlertCity);

    localStorage.setItem(
        RAIN_ALERT_LIFECYCLE_KEY,
        JSON.stringify(activeAlerts)
    );

    renderRainAlertLifecycle(activeAlerts);

    return activeAlerts;
}

function loadRainAlertLifecycle() {
    try {
        const data = JSON.parse(
            localStorage.getItem(RAIN_ALERT_LIFECYCLE_KEY) || "[]"
        );

        return Array.isArray(data) ? data : [];
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

    if (
        window.RainGuardDecisionEngine &amp;&amp;
        typeof window.RainGuardDecisionEngine.renderAIDecisionReport === "function"
    ) {
        window.RainGuardDecisionEngine.renderAIDecisionReport(
            item,
            "aiDecisionReportBoxAlerts"
        );
    }

    if (
        window.RainGuardEventBus &amp;&amp;
        typeof window.RainGuardEventBus.aiDecision === "function"
    ) {
        window.RainGuardEventBus.aiDecision({
            city: item.name,
            stage: item.stage,
            label: item.label,
            decisionScore: maxScore,
            floodRiskScore: item.floodRiskScore,
            reason: "تم عرض سبب التنبيه من Rain Alert Lifecycle"
        });
    }

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
   3) Live Event Bus Integration
   ضع هذه الدالة قبل window.onload
================================ */

function publishMultiCityResultsToEventBus(results) {
    if (!window.RainGuardEventBus || !Array.isArray(results)) return;

    results.forEach(city =&gt; {
        const score = Number(city.score || city.actualRiskScore || 0);
        const flood = Number(city.floodRiskScore || city.flood_score || 0);
        const forecast24 = Number(city.forecast24Score || city.forecast24 || 0);
        const forecast72 = Number(city.forecast72Score || city.forecast72 || 0);
        const maxScore = Math.max(score, forecast24, forecast72, flood);

        window.RainGuardEventBus.updateCity({
            name: city.name || city.city || "غير محدد",
            score,
            forecast24Score: forecast24,
            forecast72Score: forecast72,
            floodRiskScore: flood,
            risk: maxScore,
            updatedAt: Date.now()
        });

        if (score &gt;= 30 || forecast24 &gt;= 30 || forecast72 &gt;= 30) {
            window.RainGuardEventBus.rainAlert({
                name: city.name || city.city || "غير محدد",
                score,
                forecast24Score: forecast24,
                forecast72Score: forecast72,
                floodRiskScore: flood,
                risk: maxScore
            });
        }

        if (flood &gt;= 30) {
            window.RainGuardEventBus.floodAlert({
                name: city.name || city.city || "غير محدد",
                score,
                forecast24Score: forecast24,
                forecast72Score: forecast72,
                floodRiskScore: flood,
                risk: maxScore
            });
        }

        if (window.RainGuardDecisionEngine) {
            const report = window.RainGuardDecisionEngine.buildAIDecisionReport?.(city);

            if (report) {
                window.RainGuardEventBus.aiDecision({
                    city: report.city,
                    decisionScore: report.score,
                    confidence: report.confidence,
                    decision: report.decision?.level,
                    label: report.decision?.label
                });
            }
        }
    });
}


/* ===============================
   4) App.js integration points
================================ */

/*
داخل runSmartMultiCityBackgroundCheck ابحث عن:

window.lastMultiCityResults = sortedResults;

وأضف بعدها مباشرة:
*/

saveRainAlertLifecycle?.(sortedResults);
renderRainAlertLifecycle?.();
publishMultiCityResultsToEventBus?.(sortedResults);


/*
إذا كانت الدالة عندك تستخدم results وليس sortedResults، أضف هذا بدلاً منه:
*/

saveRainAlertLifecycle?.(results);
renderRainAlertLifecycle?.();
publishMultiCityResultsToEventBus?.(results);


/*
داخل window.onload أضف هذا قبل نهاية الدالة:
*/

try {
    renderRainAlertLifecycle?.();
    startRainAlertLifecycleMonitor?.();

    if (window.RainGuardEventBus) {
        window.RainGuardEventBus.autoRender?.("liveEventBusBox", 20);
        window.RainGuardEventBus.systemStatus?.({
            name: "RainGuard AI",
            status: "Application loaded",
            score: 100
        });
    }
} catch (e) {
    console.warn("Rain Alert Lifecycle / Event Bus skipped:", e);
}

setTimeout(() =&gt; {
    try {
        renderRainAlertLifecycle(loadRainAlertLifecycle());

        if (window.lastMultiCityResults &amp;&amp; Array.isArray(window.lastMultiCityResults)) {
            publishMultiCityResultsToEventBus(window.lastMultiCityResults);
        }
    } catch (e) {
        console.warn("Rain Alert Lifecycle delayed render skipped:", e);
    }
}, 3500);
</code></pre>
</body>
</html>
