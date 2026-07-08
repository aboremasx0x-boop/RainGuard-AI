window.RG24 = window.RG24 || {};

RG24.ReasoningEngine = {

    lastReasoning: null,

    analyzeCity(city) {
        const weather = city.weatherScore || 0;
        const flood = city.floodIndex || 0;
        const road = city.roadRisk || 0;
        const infrastructure = city.infrastructureCriticality || 0;
        const base = city.baseRisk || 0;

        const finalRisk = Math.min(
            100,
            Math.round(
                weather * 0.25 +
                flood * 0.30 +
                road * 0.20 +
                infrastructure * 0.15 +
                base * 0.10
            )
        );

        let level = "LOW";
        if (finalRisk >= 70) level = "CRITICAL";
        else if (finalRisk >= 50) level = "HIGH";
        else if (finalRisk >= 30) level = "MEDIUM";

        const reasons = [];

        if (weather >= 40) reasons.push("Weather signal is elevated");
        if (flood >= 35) reasons.push("Flood index requires attention");
        if (road >= 35) reasons.push("Road exposure may affect response");
        if (infrastructure >= 50) reasons.push("Infrastructure pressure is high");
        if (reasons.length === 0) reasons.push("No major escalation factor detected");

        return {
            city: city.name,
            region: city.region || city.name,
            finalRisk,
            level,
            confidence: this.calculateConfidence(city),
            reasons,
            evidence: {
                weather,
                flood,
                road,
                infrastructure,
                base
            }
        };
    },

    calculateConfidence(city) {
        let confidence = 60;

        if (city.weatherScore !== undefined) confidence += 10;
        if (city.floodIndex !== undefined) confidence += 10;
        if (city.roadRisk !== undefined) confidence += 8;
        if (city.infrastructureCriticality !== undefined) confidence += 8;
        if (city.population !== undefined) confidence += 4;

        return Math.min(99, confidence);
    },

    analyzeNational(cities) {
        if (!cities || !cities.length) return null;

        const analyses = cities.map(city => this.analyzeCity(city));

        const top = [...analyses].sort((a, b) => b.finalRisk - a.finalRisk)[0];

        const nationalRisk = Math.round(
            analyses.reduce((sum, c) => sum + c.finalRisk, 0) / analyses.length
        );

        const highRiskCities = analyses.filter(c => c.finalRisk >= 50);

        this.lastReasoning = {
            time: new Date().toLocaleTimeString("ar-SA"),
            nationalRisk,
            topCity: top.city,
            topRisk: top.finalRisk,
            topLevel: top.level,
            highRiskCount: highRiskCities.length,
            analyses
        };

        this.render();

        return this.lastReasoning;
    },

    render() {
        const panel = document.getElementById("reasoningPanel");
        if (!panel || !this.lastReasoning) return;

        const top = this.lastReasoning.analyses
            .sort((a, b) => b.finalRisk - a.finalRisk)
            .slice(0, 5);

        panel.innerHTML = top.map(item => `
            <div class="item ${item.level === "CRITICAL" ? "danger" : item.level === "HIGH" ? "warning" : "success"}">
                <b>${item.city}</b><br>
                Final Risk: ${item.finalRisk}%<br>
                Level: ${item.level}<br>
                Confidence: ${item.confidence}%<br>
                Reason: ${item.reasons[0]}
            </div>
        `).join("");
    }

};
