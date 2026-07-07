window.RG23 = window.RG23 || {};

RG23.InfrastructureEngine = {

    analyze(cities) {
        const results = cities.map(city => {
            const hospitalLoad = this.calculateHospitalLoad(city);
            const criticality = this.calculateCriticality(city, hospitalLoad);

            return {
                ...city,
                hospitalLoad,
                infrastructureCriticality: criticality
            };
        });

        this.render(results);

        return results;
    },

    calculateHospitalLoad(city) {
        let load = 20;

        load += (city.population || 0) / 120000;
        load += (city.floodIndex || 0) * 0.25;
        load += (city.roadRisk || 0) * 0.15;

        return Math.min(100, Math.round(load));
    },

    calculateCriticality(city, hospitalLoad) {
        let score = hospitalLoad;

        if (city.population > 1000000) score += 15;
        if (city.terrain === "Mountain") score += 8;
        if (city.terrain === "Coastal") score += 6;

        return Math.min(100, Math.round(score));
    },

    render(cities) {
        const panel = document.getElementById("infrastructurePanel");
        if (!panel) return;

        const sorted = [...cities].sort((a, b) =>
            b.infrastructureCriticality - a.infrastructureCriticality
        );

        panel.innerHTML = sorted.slice(0, 10).map(city => `
            <div class="item ${city.infrastructureCriticality > 65 ? "danger" : city.infrastructureCriticality > 40 ? "warning" : "success"}">
                <b>${city.name}</b><br>
                Hospital Load: ${city.hospitalLoad}%<br>
                Infrastructure Criticality: ${city.infrastructureCriticality}%<br>
                Population: ${city.population.toLocaleString()}
            </div>
        `).join("");
    }

};
