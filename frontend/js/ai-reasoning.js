/*
=========================================================
RainGuard AI v11 - AI Reasoning Engine
File: frontend/js/ai-reasoning.js
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

    function getReasoningStage(city) {
        const risk = getRisk(city);
        const rain = n(city.score || city.actualRiskScore);
        const flood = n(city.floodRiskScore || city.flood_score);

        if (rain >= 70) return "RAINING";
        if (risk >= 70 || flood >= 50) return "HIGH_RISK";
        if (risk >= 50 || flood >= 35) return "DEVELOPING";
        if (risk >= 30 || flood >= 25) return "MONITORING";
        return "STABLE";
    }

    function explainCity(city) {
        const risk = getRisk(city);
        const stage = getReasoningStage(city);

        const reasons = [];

        if (n(city.score) >= 30) reasons.push("مؤشر المطر الحالي يستدعي المتابعة.");
        if (n(city.forecast24Score) >= 30) reasons.push("توقع 24 ساعة يدعم استمرار الحالة.");
        if (n(city.forecast72Score) >= 30) reasons.push("توقع 72 ساعة يشير إلى احتمال امتداد الحالة.");
        if (n(city.floodRiskScore) >= 25) reasons.push("مؤشر السيول يحتاج مراقبة ميدانية.");
        if (n(city.humidity) >= 65) reasons.push("الرطوبة تدعم احتمالية الهطول.");
        if (n(city.cloudScore) >= 60) reasons.push("الغطاء السحابي مرتفع نسبياً.");

        if (!reasons.length) {
            reasons.push("لا توجد مؤشرات خطورة واضحة حالياً.");
        }

        return {
            city: city.name || city.city || "غير محدد",
            risk,
            stage,
            reasons,
            recommendation: getRecommendation(stage),
            generatedAt: Date.now()
        };
    }

    function getRecommendation(stage) {
        if (stage === "RAINING") return "إصدار تنبيه فوري ومتابعة خطر السيول.";
        if (stage === "HIGH_RISK") return "رفع مستوى التحذير ومراقبة المدينة بشكل مستمر.";
        if (stage === "DEVELOPING") return "تحديث الحالة كل 10 دقائق ومراقبة السحب.";
        if (stage === "MONITORING") return "إبقاء المدينة تحت المتابعة.";
        return "لا يوجد إجراء مطلوب حالياً.";
    }

    function explainNational(cities) {
        cities = Array.isArray(cities) ? cities : [];

        if (!cities.length) {
            return {
                status: "NO_DATA",
                label: "لا توجد بيانات",
                avgRisk: 0,
                recommendation: "تشغيل فحص المدن أولاً.",
                cities: []
            };
        }

        const explained = cities.map(explainCity);
        const avgRisk = Math.round(
            explained.reduce((sum, item) => sum + item.risk, 0) / explained.length
        );

        const high = explained.filter(x => x.stage === "HIGH_RISK" || x.stage === "RAINING").length;
        const developing = explained.filter(x => x.stage === "DEVELOPING").length;

        let status = "STABLE";
        let label = "🟢 مستقر";
        let recommendation = "الوضع الوطني مستقر.";

        if (high >= 1 || avgRisk >= 70) {
            status = "HIGH_RISK";
            label = "🟠 خطر وطني مرتفع";
            recommendation = "رفع المراقبة الوطنية وتفعيل تنبيهات المدن الأعلى خطورة.";
        } else if (developing >= 1 || avgRisk >= 50) {
            status = "DEVELOPING";
            label = "🟡 حالة وطنية تتطور";
            recommendation = "متابعة التحديثات كل 10 دقائق.";
        } else if (avgRisk >= 30) {
            status = "MONITORING";
            label = "🔵 متابعة وطنية";
            recommendation = "استمرار المراقبة دون تصعيد.";
        }

        return {
            status,
            label,
            avgRisk,
            high,
            developing,
            recommendation,
            cities: explained,
            generatedAt: Date.now()
        };
    }

    function renderReasoning(city, targetId = "aiReasoningBox") {
        const box = document.getElementById(targetId);
        if (!box || !city) return;

        const report = explainCity(city);

        box.innerHTML = `
            <div class="ai-decision-card">
                <h3>🧠 AI Reasoning</h3>
                <strong>${report.city}</strong><br>
                Risk: <b>${report.risk}%</b><br>
                Stage: <b>${report.stage}</b>

                <div style="margin-top:12px;line-height:2;">
                    ${report.reasons.map(r => `✔ ${r}<br>`).join("")}
                </div>

                <div class="ai-decision-recommendation">
                    ${report.recommendation}
                </div>

                <small>
                    آخر تحليل: ${new Date(report.generatedAt).toLocaleTimeString("ar-SA")}
                </small>
            </div>
        `;
    }

    function publishReasoning(city) {
        const report = explainCity(city);

        if (window.RainGuardEventBus) {
            window.RainGuardEventBus.aiDecision({
                city: report.city,
                decisionScore: report.risk,
                stage: report.stage,
                recommendation: report.recommendation
            });
        }

        return report;
    }

    window.RainGuardAIReasoning = {
        getRisk,
        getReasoningStage,
        explainCity,
        explainNational,
        renderReasoning,
        publishReasoning
    };

})();
