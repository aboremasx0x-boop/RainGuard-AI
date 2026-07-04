/*
=========================================================
RainGuard AI v11 - Analytics Engine
File: frontend/js/analytics-engine.js
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

    function summarizeCities(cities) {
        cities = Array.isArray(cities) ? cities : [];

        const summary = {
            total: cities.length,
            safe: 0,
            monitoring: 0,
            developing: 0,
            highRisk: 0,
            raining: 0,
            floodWatch: 0,
            avgRisk: 0,
            topCity: null
        };

        if (!cities.length) return summary;

        let totalRisk = 0;

        cities.forEach(city => {
            const risk = getRisk(city);
            const rain = n(city.score || city.actualRiskScore);
            const flood = n(city.floodRiskScore || city.flood_score);

            totalRisk += risk;

            if (rain >= 70) summary.raining++;
            else if (risk >= 70) summary.highRisk++;
            else if (risk >= 50) summary.developing++;
            else if (risk >= 30 || flood >= 25) summary.monitoring++;
            else summary.safe++;

            if (flood >= 30) summary.floodWatch++;

            if (!summary.topCity || risk > summary.topCity.risk) {
                summary.topCity = {
                    name: city.name || city.city || "غير محدد",
                    risk,
                    score: rain,
                    floodRiskScore: flood
                };
            }
        });

        summary.avgRisk = Math.round(totalRisk / cities.length);

        return summary;
    }

    function buildQualityDistribution(cities) {
        const summary = summarizeCities(cities);

        return {
            labels: [
                "Safe",
                "Monitoring",
                "Developing",
                "High Risk",
                "Raining"
            ],
            values: [
                summary.safe,
                summary.monitoring,
                summary.developing,
                summary.highRisk,
                summary.raining
            ]
        };
    }

    function topCities(cities, limit = 10) {
        cities = Array.isArray(cities) ? cities : [];

        return [...cities]
            .map(city => ({
                name: city.name || city.city || "غير محدد",
                risk: getRisk(city),
                score: n(city.score || city.actualRiskScore),
                forecast24Score: n(city.forecast24Score || city.forecast24),
                forecast72Score: n(city.forecast72Score || city.forecast72),
                floodRiskScore: n(city.floodRiskScore || city.flood_score)
            }))
            .sort((a, b) => b.risk - a.risk)
            .slice(0, Number(limit || 10));
    }

    function buildDashboardStats(cities) {
        const summary = summarizeCities(cities);

        return {
            totalCities: summary.total,
            avgRisk: summary.avgRisk,
            safe: summary.safe,
            monitoring: summary.monitoring,
            developing: summary.developing,
            highRisk: summary.highRisk,
            raining: summary.raining,
            floodWatch: summary.floodWatch,
            topCity: summary.topCity
        };
    }

    function publishAnalytics(cities) {
        const stats = buildDashboardStats(cities);

        if (window.RainGuardEventBus) {
            window.RainGuardEventBus.systemStatus({
                name: "Analytics Engine",
                status: "Analytics updated",
                score: stats.avgRisk,
                totalCities: stats.totalCities,
                topCity: stats.topCity?.name || "--"
            });
        }

        return stats;
    }

    function renderDashboardStats(cities, targetId = "dashboardStats") {
        const box = document.getElementById(targetId);
        if (!box) return;

        const stats = buildDashboardStats(cities);

        box.innerHTML = `
            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;">
                <div class="metric-card">
                    <span>إجمالي المدن</span>
                    <strong>${stats.totalCities}</strong>
                </div>

                <div class="metric-card">
                    <span>متوسط الخطر</span>
                    <strong>${stats.avgRisk}%</strong>
                </div>

                <div class="metric-card">
                    <span>مراقبة السيول</span>
                    <strong>${stats.floodWatch}</strong>
                </div>

                <div class="metric-card">
                    <span>أعلى مدينة</span>
                    <strong>${stats.topCity?.name || "--"}</strong>
                </div>
            </div>
        `;
    }

    function renderTopCitiesTable(cities, targetId = "topCitiesTable") {
        const box = document.getElementById(targetId);
        if (!box) return;

        const rows = topCities(cities, 10);

        if (!rows.length) {
            box.innerHTML = "لا توجد بيانات مدن.";
            return;
        }

        box.innerHTML = `
            <table style="width:100%;border-collapse:collapse;text-align:center;">
                <thead>
                    <tr style="background:#0f172a;color:#93c5fd;">
                        <th style="padding:10px;">#</th>
                        <th style="padding:10px;">المدينة</th>
                        <th style="padding:10px;">Risk</th>
                        <th style="padding:10px;">Rain</th>
                        <th style="padding:10px;">24h</th>
                        <th style="padding:10px;">72h</th>
                        <th style="padding:10px;">Flood</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows.map((city, index) => `
                        <tr style="background:rgba(2,6,23,.45);border-bottom:1px solid rgba(148,163,184,.15);">
                            <td style="padding:10px;">${index + 1}</td>
                            <td style="padding:10px;font-weight:800;">${city.name}</td>
                            <td style="padding:10px;color:#38bdf8;font-weight:800;">${city.risk}%</td>
                            <td style="padding:10px;">${city.score}%</td>
                            <td style="padding:10px;">${city.forecast24Score}%</td>
                            <td style="padding:10px;">${city.forecast72Score}%</td>
                            <td style="padding:10px;">${city.floodRiskScore}%</td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        `;
    }

    function renderQualityChart(cities, canvasId = "qualityChart") {
        const canvas = document.getElementById(canvasId);
        if (!canvas || typeof Chart === "undefined") return;

        const distribution = buildQualityDistribution(cities);

        if (window.qualityChartInstance) {
            window.qualityChartInstance.destroy();
        }

        window.qualityChartInstance = new Chart(canvas, {
            type: "doughnut",
            data: {
                labels: distribution.labels,
                datasets: [{
                    data: distribution.values
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        });
    }

    function renderAnalytics(cities) {
        renderDashboardStats(cities);
        renderTopCitiesTable(cities);
        renderQualityChart(cities);
        publishAnalytics(cities);
    }

    window.RainGuardAnalyticsEngine = {
        getRisk,
        summarizeCities,
        buildQualityDistribution,
        topCities,
        buildDashboardStats,
        publishAnalytics,
        renderDashboardStats,
        renderTopCitiesTable,
        renderQualityChart,
        renderAnalytics
    };

})();
