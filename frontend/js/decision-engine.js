<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>decision-engine.js - RainGuard AI</title>
<style>
body{
    margin:0;
    background:#0f172a;
    color:#e5e7eb;
    font-family:Tahoma,Arial,sans-serif;
    padding:24px;
    line-height:1.8;
}
.container{
    max-width:1100px;
    margin:auto;
}
h1{
    color:#38bdf8;
}
.note{
    background:#111827;
    border:1px solid #334155;
    border-radius:14px;
    padding:14px;
    margin:18px 0;
}
pre{
    direction:ltr;
    text-align:left;
    white-space:pre-wrap;
    background:#020617;
    border:1px solid #334155;
    border-radius:16px;
    padding:18px;
    color:#e2e8f0;
    font-size:14px;
    overflow:auto;
}
code{
    font-family:Consolas,monospace;
}
</style>
</head>
<body>
<div class="container">
<h1>RainGuard AI - decision-engine.js</h1>
<div class="note">
انسخ الكود التالي داخل الملف:
<b>frontend/js/decision-engine.js</b>
<br>
ثم أضف في index.html قبل app.js:
<br>
<code>&lt;script defer src="/js/decision-engine.js?v=1"&gt;&lt;/script&gt;</code>
</div>
<pre><code>/*
=========================================================
RainGuard AI - Explainable AI Decision Engine
File name:
frontend/js/decision-engine.js

Purpose:
- Calculate Decision Factors
- Calculate Decision Score
- Generate Explainable AI Decision Report
- Render report inside RainGuard AI UI

Usage:
1) Create folder: frontend/js
2) Create file: decision-engine.js
3) Paste this code inside it
4) Add this before app.js in index.html:
   &lt;script defer src="/js/decision-engine.js?v=1"&gt;&lt;/script&gt;
=========================================================
*/

function calculateDecisionFactors(city) {
    city = city || {};

    const rainScore = Number(city.score || city.actualRiskScore || 0);
    const forecast24 = Number(city.forecast24Score || city.forecast24 || 0);
    const forecast72 = Number(city.forecast72Score || city.forecast72 || 0);
    const floodRisk = Number(city.floodRiskScore || city.flood_score || 0);
    const humidity = Number(city.humidity || city.relative_humidity || 0);
    const cloudCover = Number(city.cloudScore || city.cloud_cover || 0);
    const windSpeed = Number(city.windSpeed || city.wind_speed || city.wind || 0);
    const pressure = Number(city.pressure || city.pressure_msl || 0);

    const maxRain = Math.max(rainScore, forecast24, forecast72);

    const pressureWeight =
        pressure &gt; 0 &amp;&amp; pressure &lt;= 1008 ? 6 :
        pressure &gt; 1008 &amp;&amp; pressure &lt;= 1012 ? 3 :
        0;

    return [
        {
            name: "Rain Score",
            value: `${rainScore}%`,
            rawValue: rainScore,
            weight: Math.round(maxRain * 0.35),
            reason: rainScore &gt;= 60
                ? "مؤشر المطر الحالي مرتفع ويدعم إصدار التنبيه."
                : rainScore &gt;= 30
                    ? "مؤشر المطر الحالي تحت المتابعة."
                    : "مؤشر المطر الحالي منخفض."
        },
        {
            name: "Forecast 24h",
            value: `${forecast24}%`,
            rawValue: forecast24,
            weight: Math.round(forecast24 * 0.20),
            reason: forecast24 &gt;= 60
                ? "توقع 24 ساعة يدعم استمرار الحالة."
                : forecast24 &gt;= 30
                    ? "توقع 24 ساعة يستدعي المتابعة."
                    : "توقع 24 ساعة منخفض."
        },
        {
            name: "Forecast 72h",
            value: `${forecast72}%`,
            rawValue: forecast72,
            weight: Math.round(forecast72 * 0.15),
            reason: forecast72 &gt;= 60
                ? "توقع 72 ساعة يشير إلى استمرار الحالة."
                : forecast72 &gt;= 30
                    ? "توقع 72 ساعة تحت المتابعة."
                    : "توقع 72 ساعة منخفض."
        },
        {
            name: "Flood Risk",
            value: `${floodRisk}%`,
            rawValue: floodRisk,
            weight: Math.round(floodRisk * 0.15),
            reason: floodRisk &gt;= 60
                ? "يوجد خطر سيول أو تجمع مياه مرتفع."
                : floodRisk &gt;= 30
                    ? "يوجد قابلية لتجمع مياه أو سيول."
                    : "خطر السيول منخفض."
        },
        {
            name: "Humidity",
            value: `${humidity}%`,
            rawValue: humidity,
            weight: Math.round(humidity * 0.08),
            reason: humidity &gt;= 75
                ? "الرطوبة مرتفعة وتدعم فرصة الهطول."
                : humidity &gt;= 55
                    ? "الرطوبة متوسطة وتدعم المتابعة."
                    : "الرطوبة ليست مرتفعة كفاية."
        },
        {
            name: "Cloud Cover",
            value: `${cloudCover}%`,
            rawValue: cloudCover,
            weight: Math.round(cloudCover * 0.05),
            reason: cloudCover &gt;= 75
                ? "الغطاء السحابي مرتفع."
                : cloudCover &gt;= 45
                    ? "الغطاء السحابي متوسط."
                    : "الغطاء السحابي محدود."
        },
        {
            name: "Wind",
            value: `${windSpeed} km/h`,
            rawValue: windSpeed,
            weight: windSpeed &gt;= 20 ? 7 : windSpeed &gt;= 10 ? 5 : 2,
            reason: windSpeed &gt;= 20
                ? "الرياح نشطة وقد تساعد على تحرك السحب بسرعة."
                : windSpeed &gt;= 10
                    ? "الرياح تساعد على حركة السحب."
                    : "حركة الرياح ضعيفة."
        },
        {
            name: "Pressure",
            value: pressure &gt; 0 ? `${pressure} hPa` : "غير متوفر",
            rawValue: pressure,
            weight: pressureWeight,
            reason: pressure &gt; 0 &amp;&amp; pressure &lt;= 1008
                ? "الضغط الجوي منخفض نسبياً ويدعم عدم الاستقرار."
                : pressure &gt; 1008 &amp;&amp; pressure &lt;= 1012
                    ? "الضغط الجوي متوسط ويستدعي المتابعة."
                    : "لا يوجد تأثير واضح للضغط الجوي."
        }
    ];
}

function calculateDecisionScore(city) {
    const factors = calculateDecisionFactors(city);
    const total = factors.reduce((sum, item) =&gt; sum + Number(item.weight || 0), 0);

    return Math.max(0, Math.min(100, Math.round(total)));
}

function calculateAIConfidence(city) {
    city = city || {};

    const score = Number(city.score || city.actualRiskScore || 0);
    const forecast24 = Number(city.forecast24Score || city.forecast24 || 0);
    const forecast72 = Number(city.forecast72Score || city.forecast72 || 0);
    const flood = Number(city.floodRiskScore || city.flood_score || 0);
    const humidity = Number(city.humidity || city.relative_humidity || 0);
    const cloud = Number(city.cloudScore || city.cloud_cover || 0);

    const spread = Math.abs(forecast24 - forecast72);

    let confidence =
        score * 0.30 +
        forecast24 * 0.25 +
        forecast72 * 0.20 +
        flood * 0.10 +
        humidity * 0.10 +
        cloud * 0.05;

    if (spread &lt;= 10) confidence += 8;
    if (spread &lt;= 5) confidence += 5;

    confidence = Math.max(0, Math.min(100, confidence));

    return Number(confidence.toFixed(1));
}

function getDecisionLevel(score) {
    score = Number(score || 0);

    if (score &gt;= 75) {
        return {
            level: "High Risk",
            label: "🟠 خطر مرتفع",
            color: "#f59e0b",
            recommendation: "رفع مستوى المراقبة وإصدار تنبيه واضح للمستخدم."
        };
    }

    if (score &gt;= 55) {
        return {
            level: "Developing",
            label: "🟡 الحالة تتطور",
            color: "#facc15",
            recommendation: "استمرار المراقبة وتحديث الحالة كل 10 دقائق."
        };
    }

    if (score &gt;= 30) {
        return {
            level: "Monitoring",
            label: "🔵 تحت المتابعة",
            color: "#38bdf8",
            recommendation: "متابعة الحالة دون إصدار تحذير مرتفع."
        };
    }

    return {
        level: "Stable",
        label: "🟢 مستقر",
        color: "#22c55e",
        recommendation: "لا توجد مؤشرات تستدعي التنبيه حالياً."
    };
}

function buildAIDecisionReport(city) {
    city = city || {};

    const factors = calculateDecisionFactors(city);
    const score = calculateDecisionScore(city);
    const confidence = calculateAIConfidence(city);
    const decision = getDecisionLevel(score);

    return {
        city: city.name || city.city || "غير محدد",
        score,
        confidence,
        decision,
        factors,
        generatedAt: Date.now()
    };
}

function renderAIDecisionReport(city, targetId = "aiDecisionReportBox") {
    const box = document.getElementById(targetId);
    if (!box || !city) return;

    const report = buildAIDecisionReport(city);

    box.innerHTML = `
        &lt;div class="ai-decision-card" style="border-color:${report.decision.color}"&gt;
            &lt;h3&gt;🧠 AI Decision Report&lt;/h3&gt;

            &lt;div class="ai-decision-main"&gt;
                &lt;strong&gt;${report.city}&lt;/strong&gt;
                &lt;span style="color:${report.decision.color}"&gt;
                    ${report.decision.label}
                &lt;/span&gt;
            &lt;/div&gt;

            &lt;div class="ai-decision-score"&gt;
                Decision Score:
                &lt;b&gt;${report.score}%&lt;/b&gt;
                &lt;br&gt;
                AI Confidence:
                &lt;b&gt;${report.confidence}%&lt;/b&gt;
            &lt;/div&gt;

            &lt;div class="ai-decision-recommendation"&gt;
                ${report.decision.recommendation}
            &lt;/div&gt;

            &lt;div class="ai-factor-list"&gt;
                ${report.factors.map(item =&gt; `
                    &lt;div class="ai-factor-row"&gt;
                        &lt;div&gt;
                            &lt;strong&gt;${item.name}&lt;/strong&gt;&lt;br&gt;
                            &lt;small&gt;${item.reason}&lt;/small&gt;
                        &lt;/div&gt;
                        &lt;div&gt;
                            &lt;b&gt;${item.value}&lt;/b&gt;&lt;br&gt;
                            &lt;span&gt;+${item.weight}&lt;/span&gt;
                        &lt;/div&gt;
                    &lt;/div&gt;
                `).join("")}
            &lt;/div&gt;

            &lt;small&gt;
                آخر تحليل: ${new Date(report.generatedAt).toLocaleTimeString("ar-SA")}
            &lt;/small&gt;
        &lt;/div&gt;
    `;
}

function showAIDecisionPopup(city) {
    const report = buildAIDecisionReport(city);

    const factorText = report.factors
        .map(item =&gt; `${item.name}: ${item.value} | تأثير +${item.weight} | ${item.reason}`)
        .join("\\n");

    window.alert(
        "AI Decision Report\\n\\n" +
        "المدينة: " + report.city + "\\n" +
        "القرار: " + report.decision.label + "\\n" +
        "Decision Score: " + report.score + "%\\n" +
        "AI Confidence: " + report.confidence + "%\\n\\n" +
        "العوامل:\\n" +
        factorText + "\\n\\n" +
        "التوصية: " + report.decision.recommendation
    );
}

window.RainGuardDecisionEngine = {
    calculateDecisionFactors,
    calculateDecisionScore,
    calculateAIConfidence,
    getDecisionLevel,
    buildAIDecisionReport,
    renderAIDecisionReport,
    showAIDecisionPopup
};
</code></pre>
</div>
</body>
</html>
