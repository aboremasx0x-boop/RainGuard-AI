/*
=========================================================
RainGuard AI v11 - Storm Engine
File: frontend/js/storm-engine.js
=========================================================
*/

(function () {
    "use strict";

    function n(value) {
        return Number(value || 0);
    }

    function getRisk(city) {
        return Math.max(
            n(city.score || city.actualRiskScore),
            n(city.forecast24Score || city.forecast24),
            n(city.forecast72Score || city.forecast72),
            n(city.floodRiskScore || city.flood_score)
        );
    }

    function estimateStormSpeed(cities) {
        cities = Array.isArray(cities) ? cities : [];

        if (!cities.length) return 0;

        const avgRisk = cities.reduce((sum, city) => sum + getRisk(city), 0) / cities.length;

        return Math.round(18 + avgRisk * 0.28);
    }

    function estimateDirection(cities) {
        cities = Array.isArray(cities) ? cities : [];

        const top = [...cities].sort((a, b) => getRisk(b) - getRisk(a))[0];

        if (!top) return "غير محدد";

        const lon = n(top.lon || top.longitude);
        const lat = n(top.lat || top.latitude);

        if (lon > 43) return "شرق / جنوب شرق";
        if (lat > 20) return "شمال / شمال شرق";

        return "جنوب غرب";
    }

    function estimateETA(city, index = 0) {
        const risk = getRisk(city);
        const base = 20 + index * 18;
        const riskAdjustment = Math.max(0, Math.round((60 - risk) / 3));

        return Math.max(5, base + riskAdjustment);
    }

    function buildStormPath(cities) {
        cities = Array.isArray(cities) ? cities : [];

        return [...cities]
            .sort((a, b) => getRisk(b) - getRisk(a))
            .map((city, index) => ({
                name: city.name || city.city || "غير محدد",
                risk: getRisk(city),
                etaMinutes: estimateETA(city, index),
                score: n(city.score || city.actualRiskScore),
                floodRiskScore: n(city.floodRiskScore || city.flood_score),
                order: index + 1
            }));
    }

    function analyzeStorm(cities) {
        cities = Array.isArray(cities) ? cities : [];

        const path = buildStormPath(cities);
        const speed = estimateStormSpeed(cities);
        const direction = estimateDirection(cities);
        const avgRisk = cities.length
            ? Math.round(cities.reduce((sum, city) => sum + getRisk(city), 0) / cities.length)
            : 0;

        const top = path[0] || null;

        let level = "Stable";
        let label = "🟢 مستقر";
        let recommendation = "لا توجد عاصفة نشطة حالياً.";
        let color = "#22c55e";

        if (avgRisk >= 30) {
            level = "Monitoring";
            label = "🔵 تحت المتابعة";
            recommendation = "استمرار مراقبة حركة السحب وتحديث البيانات.";
            color = "#38bdf8";
        }

        if (avgRisk >= 55 || (top && top.risk >= 65)) {
            level = "Warning";
            label = "🟠 تحذير عاصفة";
            recommendation = "رفع مستوى المراقبة للمدن الواقعة في مسار السحابة.";
            color = "#f59e0b";
        }

        if (top && top.score >= 70) {
            level = "Emergency";
            label = "🔴 مطر حاضر";
            recommendation = "إصدار تنبيه فوري ومتابعة خطر السيول.";
            color = "#ef4444";
        }

        return {
            level,
            label,
            color,
            recommendation,
            avgRisk,
            speed,
            direction,
            topCity: top,
            path,
            generatedAt: Date.now()
        };
    }

    function publishStormAnalysis(cities) {
        const report = analyzeStorm(cities);

        if (window.RainGuardEventBus) {
            window.RainGuardEventBus.stormUpdate({
                level: report.level,
                label: report.label,
                risk: report.avgRisk,
                speed: report.speed,
                direction: report.direction,
                topCity: report.topCity?.name || "--",
                recommendation: report.recommendation
            });
        }

        return report;
    }

    function renderStormSummary(cities, targetId = "stormSummaryBox") {
        const box = document.getElementById(targetId);
        if (!box) return;

        const report = analyzeStorm(cities);

        box.innerHTML = `
            <div class="ai-decision-card" style="border-color:${report.color}">
                <h3>⛈️ Storm Engine</h3>

                <div class="ai-decision-main">
                    <strong>${report.label}</strong>
                    <span>${report.avgRisk}%</span>
                </div>

                <div class="ai-decision-score">
                    الاتجاه: <b>${report.direction}</b><br>
                    سرعة السحابة: <b>${report.speed} كم/س</b><br>
                    أعلى مدينة: <b>${report.topCity?.name || "--"}</b>
                </div>

                <div class="ai-decision-recommendation">
                    ${report.recommendation}
                </div>

                <div class="ai-factor-list">
                    ${report.path.map(item => `
                        <div class="ai-factor-row">
                            <div>
                                <strong>${item.order}. ${item.name}</strong><br>
                                <small>وصول متوقع بعد ${item.etaMinutes} دقيقة</small>
                            </div>
                            <div>
                                <b>${item.risk}%</b><br>
                                <span>Risk</span>
                            </div>
                        </div>
                    `).join("")}
                </div>
            </div>
        `;
    }

    window.RainGuardStormEngine = {
        getRisk,
        estimateStormSpeed,
        estimateDirection,
        estimateETA,
        buildStormPath,
        analyzeStorm,
        publishStormAnalysis,
        renderStormSummary
    };

})();
