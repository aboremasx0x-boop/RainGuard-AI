window.RG25 = window.RG25 || {};

RG25.NationalStatus = {

    lastStatus: null,

    calculate(cities) {
        if (!cities || !cities.length) {
            return this.defaultStatus();
        }

        const risks = cities.map(city =>
            city.finalRisk ||
            city.floodIndex ||
            city.weatherScore ||
            city.baseRisk ||
            0
        );

        const nationalRisk = Math.round(
            risks.reduce((sum, r) => sum + r, 0) / risks.length
        );

        const emergencyCount = risks.filter(r => r >= 70).length;
        const warningCount = risks.filter(r => r >= 40 && r < 70).length;
        const normalCount = risks.filter(r => r < 40).length;

        const topCity = [...cities].sort((a, b) => {
            const ar = a.finalRisk || a.floodIndex || a.weatherScore || a.baseRisk || 0;
            const br = b.finalRisk || b.floodIndex || b.weatherScore || b.baseRisk || 0;
            return br - ar;
        })[0];

        let nationalStatus = "NORMAL";
        if (emergencyCount > 0) nationalStatus = "EMERGENCY";
        else if (warningCount > 0 || nationalRisk >= 40) nationalStatus = "WARNING";

        const aiConfidence = this.calculateConfidence(cities);

        this.lastStatus = {
            nationalStatus,
            aiConfidence,
            nationalRisk,
            activeMissions: this.getActiveMissions(),
            emergencyCount,
            warningCount,
            normalCount,
            cities: cities.length,
            resourcesStatus: this.getResourcesStatus(nationalStatus),
            currentCycle: document.getElementById("currentPhase")?.innerText || "Observe",
            topCity: topCity?.name || "--",
            updatedAt: new Date().toLocaleTimeString("ar-SA")
        };

        this.render();

        if (window.RG25?.ExecutiveBanner) {
            RG25.ExecutiveBanner.update(this.lastStatus);
        }

        return this.lastStatus;
    },

    calculateConfidence(cities) {
        let score = 75;

        const hasWeather = cities.some(c => c.weatherScore !== undefined);
        const hasFlood = cities.some(c => c.floodIndex !== undefined);
        const hasRoad = cities.some(c => c.roadRisk !== undefined);
        const hasInfra = cities.some(c => c.infrastructureCriticality !== undefined);

        if (hasWeather) score += 6;
        if (hasFlood) score += 6;
        if (hasRoad) score += 5;
        if (hasInfra) score += 5;

        return Math.min(99, score);
    },

    getActiveMissions() {
        if (window.RG24?.MissionCenter?.missions) {
            return RG24.MissionCenter.missions.length;
        }
        return 0;
    },

    getResourcesStatus(status) {
        if (status === "EMERGENCY") return "MOBILIZED";
        if (status === "WARNING") return "STANDBY";
        return "READY";
    },

    defaultStatus() {
        return {
            nationalStatus: "NORMAL",
            aiConfidence: 0,
            nationalRisk: 0,
            activeMissions: 0,
            emergencyCount: 0,
            warningCount: 0,
            normalCount: 0,
            cities: 0,
            resourcesStatus: "READY",
            currentCycle: "Observe",
            topCity: "--",
            updatedAt: new Date().toLocaleTimeString("ar-SA")
        };
    },

    render() {
        const panel = document.getElementById("nationalStatusPanel");
        if (!panel || !this.lastStatus) return;

        const s = this.lastStatus;

        panel.innerHTML = `
            <div class="item ${s.nationalStatus === "EMERGENCY" ? "danger" : s.nationalStatus === "WARNING" ? "warning" : "success"}">
                <b>National Status: ${s.nationalStatus}</b><br>
                National Risk: ${s.nationalRisk}%<br>
                AI Confidence: ${s.aiConfidence}%<br>
                Cities: ${s.cities}<br>
                Normal: ${s.normalCount}<br>
                Warnings: ${s.warningCount}<br>
                Emergency: ${s.emergencyCount}<br>
                Resources: ${s.resourcesStatus}
            </div>
        `;
    }

};
