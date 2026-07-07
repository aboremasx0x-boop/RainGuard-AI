window.RG23 = window.RG23 || {};

RG23.Brain = {

    map: null,
    mapLayers: [],
    latestCities: [],
    latestDecision: null,

    init() {
        this.initMap();
        this.bindButtons();
        this.writeCommander("V23 real-time intelligence brain ready.");
    },

    initMap() {
        const box = document.getElementById("v23Map");

        if (!box || !window.L) return;

        if (this.map) return;

        this.map = L.map("v23Map").setView([23.8859, 45.0792], 5);

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 18,
            attribution: "© OpenStreetMap"
        }).addTo(this.map);
    },

    clearMap() {
        if (!this.map) return;

        this.mapLayers.forEach(layer => {
            try {
                this.map.removeLayer(layer);
            } catch (e) {}
        });

        this.mapLayers = [];
    },

    renderMap(cities) {
        if (!this.map) return;

        this.clearMap();

        cities.forEach(city => {
            const risk = city.finalRisk || city.floodIndex || city.weatherScore || city.baseRisk || 0;

            let color = "#2ea8ff";
            if (risk >= 70) color = "#ff5d6c";
            else if (risk >= 45) color = "#ffd54d";
            else if (risk >= 25) color = "#22e58b";

            const marker = L.circleMarker([city.lat, city.lon], {
                radius: Math.max(7, Math.min(24, risk / 2)),
                color,
                fillColor: color,
                fillOpacity: 0.68,
                weight: 2
            }).addTo(this.map);

            marker.bindPopup(`
                <b>${city.name}</b><br>
                Weather: ${city.weatherScore || 0}%<br>
                Flood: ${city.floodIndex || 0}%<br>
                Road: ${city.roadRisk || 0}%<br>
                Infrastructure: ${city.infrastructureCriticality || 0}%<br>
                Final Risk: ${risk}%
            `);

            this.mapLayers.push(marker);

            if (risk >= 25) {
                const circle = L.circle([city.lat, city.lon], {
                    radius: risk * 2600,
                    color,
                    fillColor: color,
                    fillOpacity: 0.07,
                    weight: 1
                }).addTo(this.map);

                this.mapLayers.push(circle);
            }
        });
    },

    getTopCity(cities) {
        if (!cities || !cities.length) return null;

        return [...cities].sort((a, b) => {
            const ar = a.finalRisk || a.floodIndex || a.weatherScore || 0;
            const br = b.finalRisk || b.floodIndex || b.weatherScore || 0;
            return br - ar;
        })[0];
    },

    calculateFinalRisk(city) {
        let risk = 0;

        risk += (city.weatherScore || 0) * 0.35;
        risk += (city.floodIndex || 0) * 0.30;
        risk += (city.roadRisk || 0) * 0.20;
        risk += (city.infrastructureCriticality || 0) * 0.15;

        return Math.min(100, Math.round(risk));
    },

    updateKPIs(cities) {
        const top = this.getTopCity(cities);

        if (!top) return;

        const avg =
            Math.round(
                cities.reduce((s, c) => s + (c.finalRisk || 0), 0) / cities.length
            );

        const nationalRisk = document.getElementById("nationalRisk");
        const topCity = document.getElementById("topCity");
        const weatherScore = document.getElementById("weatherScore");
        const floodIndex = document.getElementById("floodIndex");

        if (nationalRisk) nationalRisk.innerText = avg + "%";
        if (topCity) topCity.innerText = top.name;
        if (weatherScore) weatherScore.innerText = (top.weatherScore || 0) + "%";
        if (floodIndex) floodIndex.innerText = (top.floodIndex || 0) + "%";
    },

    renderReport(cities) {
        const top = this.getTopCity(cities);
        const panel = document.getElementById("reportPanel");

        if (!top || !panel) return;

        panel.innerHTML = `
            <div class="item success">
                <h2>Real-Time National Intelligence Report</h2>
                <br>
                <b>Top City:</b> ${top.name}<br>
                <b>Weather Score:</b> ${top.weatherScore || 0}%<br>
                <b>Flood Index:</b> ${top.floodIndex || 0}%<br>
                <b>Road Risk:</b> ${top.roadRisk || 0}%<br>
                <b>Infrastructure Criticality:</b> ${top.infrastructureCriticality || 0}%<br>
                <b>Final Risk:</b> ${top.finalRisk || 0}%<br><br>
                <b>Recommendation:</b>
                ${top.finalRisk >= 70
                    ? "Emergency escalation recommended."
                    : top.finalRisk >= 45
                        ? "Active monitoring and field readiness recommended."
                        : "Normal monitoring with radar watch."}
            </div>
        `;
    },

    async runFullAnalysis() {
        this.writeCommander("Starting real-time national analysis...");

        let cities = await RG23.CityEngine.analyze();

        cities = RG23.TrafficEngine.analyze(cities);

        cities = RG23.InfrastructureEngine.analyze(cities);

        cities.forEach(city => {
            city.finalRisk = this.calculateFinalRisk(city);
        });

        this.latestCities = cities;

        this.renderMap(cities);
        this.updateKPIs(cities);
        this.renderReport(cities);

        RG23.NationalDatabase.updateCities(cities);
        RG23.NationalDatabase.addCycle({
            type: "Full Analysis",
            cities: cities.length,
            topCity: this.getTopCity(cities)?.name || "--"
        });

        this.writeCommander("Real-time analysis completed.");
    },

    async runPhase(phase) {
        if (phase === "Observe") {
            this.writeCommander("Observe: collecting city, radar and weather signals.");
            RG23.NationalDatabase.addMemory("Observe", "National observation started.");
        }

        if (phase === "Weather") {
            this.writeCommander("Weather: analyzing Open-Meteo data.");
            await this.runFullAnalysis();
        }

        if (phase === "Radar") {
            this.writeCommander("Radar: loading RainViewer layer.");
            if (this.map) await RG23.RadarEngine.loadRadar(this.map);
        }

        if (phase === "Flood") {
            this.writeCommander("Flood: recalculating flood risk.");
            if (this.latestCities.length) {
                RG23.FloodEngine.analyze(this.latestCities);
            }
        }

        if (phase === "City") {
            this.writeCommander("City: refreshing city intelligence model.");
            if (this.latestCities.length) {
                RG23.CityEngine.render(this.latestCities);
            }
        }

        if (phase === "Reason") {
            this.writeCommander("Reason: comparing risk factors.");
            RG23.NationalDatabase.addMemory("Reason", "Risk factors compared.");
        }

        if (phase === "Decide") {
            const top = this.getTopCity(this.latestCities);
            this.latestDecision = top?.finalRisk >= 70
                ? "Emergency escalation"
                : top?.finalRisk >= 45
                    ? "Active monitoring"
                    : "Normal monitoring";

            this.writeCommander("Decision: " + this.latestDecision);
        }

        if (phase === "Mission") {
            const top = this.getTopCity(this.latestCities);
            if (top) {
                RG23.NationalDatabase.addMemory("Mission", "Mission prepared for " + top.name);
                this.writeCommander("Mission prepared for " + top.name);
            }
        }

        if (phase === "Learn") {
            RG23.NationalDatabase.addMemory("Learn", "Cycle learned from latest analysis.");
            this.writeCommander("Learning completed.");
        }
    },

    writeCommander(text) {
        const panel = document.getElementById("commanderLog");
        if (!panel) return;

        panel.innerHTML =
            `<div class="item success">
                <b>${new Date().toLocaleTimeString("ar-SA")}</b><br>
                ${text}
            </div>` + panel.innerHTML;
    },

    bindButtons() {
        const start = document.getElementById("startSystem");
        const stop = document.getElementById("stopSystem");
        const refresh = document.getElementById("refreshNow");
        const report = document.getElementById("generateReport");
        const send = document.getElementById("sendCommander");
        const input = document.getElementById("commanderInput");

        if (start) start.onclick = () => RG23.IntelligenceCycle.start();
        if (stop) stop.onclick = () => RG23.IntelligenceCycle.stop();
        if (refresh) refresh.onclick = () => this.runFullAnalysis();
        if (report) report.onclick = () => this.renderReport(this.latestCities);

        if (send && input) {
            send.onclick = () => {
                const text = input.value.trim();
                if (!text) return;

                this.writeCommander("Commander: " + text);
                this.writeCommander("ANI: Request received. Running refresh analysis.");
                this.runFullAnalysis();

                input.value = "";
            };

            input.addEventListener("keydown", e => {
                if (e.key === "Enter") send.click();
            });
        }
    }

};

window.addEventListener("load", () => {
    RG23.Brain.init();
});
