window.RG23 = window.RG23 || {};

RG23.TrafficEngine = {

    analyze(cities) {
        const results = cities.map(city => {
            const roadRisk = this.calculateRoadRisk(city);
            const responseTime = this.estimateResponseTime(city, roadRisk);

            return {
                ...city,
                roadRisk,
                responseTime
            };
        });

        this.render(results);

        return results;
    },

    calculateRoadRisk(city) {
        let risk = 0;

        risk += (city.floodIndex || 0) * 0.45;
        risk += (city.weatherScore || 0) * 0.25;

        if (city.terrain === "Mountain") risk += 18;
        if (city.terrain === "Coastal") risk += 10;
        if (city.population > 1000000) risk += 8;

        return Math.min(100, Math.round(risk));
    },

    estimateResponseTime(city, roadRisk) {
        let eta = 12;

        eta += Math.round(roadRisk * 0.35);

        if (city.terrain === "Mountain") eta += 8;
        if (city.population > 1000000) eta += 6;

        return Math.min(90, eta);
    },

    render(cities) {
        const panel = document.getElementById("trafficPanel");
        if (!panel) return;

        const sorted = [...cities].sort((a, b) => b.roadRisk - a.roadRisk);

        panel.innerHTML = sorted.slice(0, 10).map(city => `
            <div class="item ${city.roadRisk > 60 ? "danger" : city.roadRisk > 35 ? "warning" : "success"}">
                <b>${city.name}</b><br>
                Road Risk: ${city.roadRisk}%<br>
                Response Time: ${city.responseTime} min<br>
                Terrain: ${city.terrain}
            </div>
        `).join("");
    }

};
