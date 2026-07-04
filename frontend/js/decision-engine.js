/*
=========================================================
RainGuard AI - Explainable AI Decision Engine
File: frontend/js/decision-engine.js
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
        pressure > 0 && pressure <= 1008 ? 6 :
        pressure > 1008 && pressure <= 1012 ? 3 :
        0;

    return [
        { name:"Rain Score", value:`${rainScore}%`, weight:Math.round(maxRain * 0.35), reason:"مؤشر المطر الحالي يؤثر في قرار التنبيه." },
        { name:"Forecast 24h", value:`${forecast24}%`, weight:Math.round(forecast24 * 0.20), reason:"توقع 24 ساعة يوضح استمرار الحالة." },
        { name:"Forecast 72h", value:`${forecast72}%`, weight:Math.round(forecast72 * 0.15), reason:"توقع 72 ساعة يوضح امتداد الحالة." },
        { name:"Flood Risk", value:`${floodRisk}%`, weight:Math.round(floodRisk * 0.15), reason:"مؤشر السيول يحدد مستوى الخطر الأرضي." },
        { name:"Humidity", value:`${humidity}%`, weight:Math.round(humidity * 0.08), reason:"الرطوبة تدعم احتمالية الهطول." },
        { name:"Cloud Cover", value:`${cloudCover}%`, weight:Math.round(cloudCover * 0.05), reason:"الغطاء السحابي يعزز فرصة المطر." },
        { name:"Wind", value:`${windSpeed} km/h`, weight:windSpeed >= 20 ? 7 : windSpeed >= 10 ? 5 : 2, reason:"الرياح تؤثر في حركة السحب." },
        { name:"Pressure", value:pressure ? `${pressure} hPa` : "غير متوفر", weight:pressureWeight, reason:"الضغط الجوي يدعم تحليل عدم الاستقرار." }
    ];
}

function calculateDecisionScore(city) {
    const total = calculateDecisionFactors(city)
        .reduce((sum, item) => sum + Number(item.weight || 0), 0);

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

    if (spread <= 10) confidence += 8;
    if (spread <= 5) confidence += 5;

    return Math.max(0, Math.min(100, Number(confidence.toFixed(1))));
}

function getDecisionLevel(score) {
    score = Number(score || 0);

    if (score >= 75) {
        return {
            level:"High Risk",
            label:"🟠 خطر مرتفع",
            color:"#f59e0b",
            recommendation:"رفع مستوى المراقبة وإصدار تنبيه واضح للمستخدم."
        };
    }

    if (score >= 55) {
        return {
            level:"Developing",
            label:"🟡 الحالة تتطور",
            color:"#facc15",
            recommendation:"استمرار المراقبة وتحديث الحالة كل 10 دقائق."
        };
    }

    if (score >= 30) {
        return {
            level:"Monitoring",
            label:"🔵 تحت المتابعة",
            color:"#38bdf8",
            recommendation:"متابعة الحالة دون إصدار تحذير مرتفع."
        };
    }

    return {
        level:"Stable",
        label:"🟢 مستقر",
        color:"#22c55e",
        recommendation:"لا توجد مؤشرات تستدعي التنبيه حالياً."
    };
}

function buildAIDecisionReport(city) {
    const factors = calculateDecisionFactors(city);
    const score = calculateDecisionScore(city);
    const confidence = calculateAIConfidence(city);
    const decision = getDecisionLevel(score);

    return {
        city: city?.name || city?.city || "غير محدد",
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
        <div class="ai-decision-card" style="border-color:${report.decision.color}">
            <h3>🧠 AI Decision Report</h3>

            <div class="ai-decision-main">
                <strong>${report.city}</strong>
                <span style="color:${report.decision.color}">
                    ${report.decision.label}
                </span>
            </div>

            <div class="ai-decision-score">
                Decision Score: <b>${report.score}%</b><br>
                AI Confidence: <b>${report.confidence}%</b>
            </div>

            <div class="ai-decision-recommendation">
                ${report.decision.recommendation}
            </div>

            <div class="ai-factor-list">
                ${report.factors.map(item => `
                    <div class="ai-factor-row">
                        <div>
                            <strong>${item.name}</strong><br>
                            <small>${item.reason}</small>
                        </div>
                        <div>
                            <b>${item.value}</b><br>
                            <span>+${item.weight}</span>
                        </div>
                    </div>
                `).join("")}
            </div>

            <small>
                آخر تحليل: ${new Date(report.generatedAt).toLocaleTimeString("ar-SA")}
            </small>
        </div>
    `;
}

function showAIDecisionPopup(city) {
    const report = buildAIDecisionReport(city);

    const factorText = report.factors
        .map(item => `${item.name}: ${item.value} | +${item.weight} | ${item.reason}`)
        .join("\n");

    window.alert(
        "AI Decision Report\n\n" +
        "المدينة: " + report.city + "\n" +
        "القرار: " + report.decision.label + "\n" +
        "Decision Score: " + report.score + "%\n" +
        "AI Confidence: " + report.confidence + "%\n\n" +
        "العوامل:\n" + factorText + "\n\n" +
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
