/* =========================================================
   RainGuard AI
   Base National Intelligence Brain V23
   Safe compatibility layer for V26–V29
   File: frontend/js/ai_brain_v23.js
   ========================================================= */

window.RG23 = window.RG23 || {};

(function (RG23) {
    "use strict";

    const Brain = {

        version: "23.1-safe",

        map: null,
        mapLayers: [],

        latestCities: [],
        latestDecision: null,
        latestAnalysis: null,

        initialized: false,
        analysisRunning: false,

        /* =====================================================
           INITIALIZATION
           ===================================================== */

        init() {
            if (this.initialized) {
                return;
            }

            this.initialized = true;

            try {
                this.initMap();
            } catch (error) {
                console.warn("RG23 Brain: map initialization skipped.", error);
            }

            try {
                this.bindButtons();
            } catch (error) {
                console.warn("RG23 Brain: button binding skipped.", error);
            }

            this.writeCommander(
                "V23 real-time intelligence brain ready."
            );

            console.log(
                `RG23 Brain ${this.version} initialized.`
            );
        },

        /* =====================================================
           GENERAL HELPERS
           ===================================================== */

        isObject(value) {
            return (
                value !== null &&
                typeof value === "object"
            );
        },

        isFunction(value) {
            return typeof value === "function";
        },

        safeNumber(value, fallback = 0) {
            const number = Number(value);

            return Number.isFinite(number)
                ? number
                : fallback;
        },

        clamp(value, min = 0, max = 100) {
            const number = this.safeNumber(value, min);

            return Math.min(
                max,
                Math.max(min, number)
            );
        },

        escapeHTML(value) {
            return String(value ?? "")
                .replaceAll("&", "&amp;")
                .replaceAll("<", "&lt;")
                .replaceAll(">", "&gt;")
                .replaceAll('"', "&quot;")
                .replaceAll("'", "&#039;");
        },

        async safeExecute({
            label,
            target,
            method,
            args = [],
            fallback = null
        }) {
            try {
                if (
                    !target ||
                    !this.isFunction(target[method])
                ) {
                    console.warn(
                        `RG23 Brain: ${label} unavailable.`
                    );

                    return fallback;
                }

                return await Promise.resolve(
                    target[method](...args)
                );
            } catch (error) {
                console.warn(
                    `RG23 Brain: ${label} failed.`,
                    error
                );

                return fallback;
            }
        },

        resolveEngine(...names) {
            for (const name of names) {
                if (RG23[name]) {
                    return RG23[name];
                }

                if (window[name]) {
                    return window[name];
                }
            }

            return null;
        },

        normalizeCity(city, index = 0) {
            const source = this.isObject(city)
                ? city
                : {};

            const lat = this.safeNumber(
                source.lat ??
                source.latitude,
                24
            );

            const lon = this.safeNumber(
                source.lon ??
                source.lng ??
                source.longitude,
                45
            );

            return {
                ...source,

                id:
                    source.id ??
                    source.code ??
                    `city-${index + 1}`,

                name:
                    source.name ??
                    source.city ??
                    source.cityName ??
                    `City ${index + 1}`,

                lat,
                lon,

                weatherScore: this.clamp(
                    source.weatherScore ??
                    source.weather_score ??
                    source.rainScore ??
                    0
                ),

                floodIndex: this.clamp(
                    source.floodIndex ??
                    source.flood_index ??
                    source.floodRisk ??
                    0
                ),

                roadRisk: this.clamp(
                    source.roadRisk ??
                    source.road_risk ??
                    source.trafficRisk ??
                    0
                ),

                infrastructureCriticality: this.clamp(
                    source.infrastructureCriticality ??
                    source.infrastructure_criticality ??
                    source.infrastructureRisk ??
                    0
                ),

                finalRisk: this.clamp(
                    source.finalRisk ??
                    source.final_risk ??
                    0
                )
            };
        },

        normalizeCities(cities) {
            if (!Array.isArray(cities)) {
                return [];
            }

            return cities
                .filter(Boolean)
                .map((city, index) =>
                    this.normalizeCity(city, index)
                );
        },

        /* =====================================================
           MAP
           ===================================================== */

        initMap() {
            const box = document.getElementById("v23Map");

            if (!box) {
                console.warn(
                    "RG23 Brain: #v23Map was not found."
                );
                return;
            }

            if (!window.L) {
                console.warn(
                    "RG23 Brain: Leaflet is unavailable."
                );
                return;
            }

            if (this.map) {
                return;
            }

            this.map = L.map("v23Map", {
                zoomControl: true,
                attributionControl: true
            }).setView(
                [23.8859, 45.0792],
                5
            );

            L.tileLayer(
                "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
                {
                    maxZoom: 18,
                    attribution: "© OpenStreetMap"
                }
            ).addTo(this.map);

            setTimeout(() => {
                try {
                    this.map?.invalidateSize();
                } catch (error) {
                    console.warn(
                        "RG23 Brain: map resize skipped.",
                        error
                    );
                }
            }, 300);
        },

        clearMap() {
            if (!this.map) {
                return;
            }

            this.mapLayers.forEach(layer => {
                try {
                    this.map.removeLayer(layer);
                } catch (error) {
                    console.warn(
                        "RG23 Brain: map layer removal skipped.",
                        error
                    );
                }
            });

            this.mapLayers = [];
        },

        getRiskColor(risk) {
            const safeRisk = this.clamp(risk);

            if (safeRisk >= 70) {
                return "#ff5d6c";
            }

            if (safeRisk >= 45) {
                return "#ffd54d";
            }

            if (safeRisk >= 25) {
                return "#22e58b";
            }

            return "#2ea8ff";
        },

        renderMap(cities) {
            if (!this.map) {
                this.initMap();
            }

            if (!this.map) {
                return;
            }

            const normalizedCities =
                this.normalizeCities(cities);

            this.clearMap();

            normalizedCities.forEach(city => {
                if (
                    !Number.isFinite(city.lat) ||
                    !Number.isFinite(city.lon)
                ) {
                    return;
                }

                const risk = this.clamp(
                    city.finalRisk ||
                    city.floodIndex ||
                    city.weatherScore ||
                    city.baseRisk ||
                    0
                );

                const color =
                    this.getRiskColor(risk);

                const marker = L.circleMarker(
                    [city.lat, city.lon],
                    {
                        radius: Math.max(
                            7,
                            Math.min(24, risk / 2)
                        ),
                        color,
                        fillColor: color,
                        fillOpacity: 0.68,
                        weight: 2
                    }
                ).addTo(this.map);

                marker.bindPopup(`
                    <b>${this.escapeHTML(city.name)}</b><br>
                    Weather: ${city.weatherScore}%<br>
                    Flood: ${city.floodIndex}%<br>
                    Road: ${city.roadRisk}%<br>
                    Infrastructure:
                    ${city.infrastructureCriticality}%<br>
                    Final Risk: ${risk}%
                `);

                this.mapLayers.push(marker);

                if (risk >= 25) {
                    const circle = L.circle(
                        [city.lat, city.lon],
                        {
                            radius: risk * 2600,
                            color,
                            fillColor: color,
                            fillOpacity: 0.07,
                            weight: 1
                        }
                    ).addTo(this.map);

                    this.mapLayers.push(circle);
                }
            });

            setTimeout(() => {
                try {
                    this.map?.invalidateSize();
                } catch (error) {
                    console.warn(
                        "RG23 Brain: map refresh skipped.",
                        error
                    );
                }
            }, 100);
        },

        /* =====================================================
           RISK AND KPI
           ===================================================== */

        getTopCity(cities) {
            const normalizedCities =
                this.normalizeCities(cities);

            if (!normalizedCities.length) {
                return null;
            }

            return [...normalizedCities].sort(
                (a, b) => {
                    const firstRisk = this.clamp(
                        a.finalRisk ||
                        a.floodIndex ||
                        a.weatherScore ||
                        0
                    );

                    const secondRisk = this.clamp(
                        b.finalRisk ||
                        b.floodIndex ||
                        b.weatherScore ||
                        0
                    );

                    return secondRisk - firstRisk;
                }
            )[0];
        },

        calculateFinalRisk(city) {
            const normalized =
                this.normalizeCity(city);

            let risk = 0;

            risk += normalized.weatherScore * 0.35;
            risk += normalized.floodIndex * 0.30;
            risk += normalized.roadRisk * 0.20;
            risk +=
                normalized.infrastructureCriticality *
                0.15;

            return this.clamp(
                Math.round(risk)
            );
        },

        updateKPIs(cities) {
            const normalizedCities =
                this.normalizeCities(cities);

            const top =
                this.getTopCity(normalizedCities);

            if (!top || !normalizedCities.length) {
                return;
            }

            const averageRisk = Math.round(
                normalizedCities.reduce(
                    (total, city) =>
                        total +
                        this.clamp(city.finalRisk),
                    0
                ) / normalizedCities.length
            );

            const nationalRisk =
                document.getElementById(
                    "nationalRisk"
                );

            const topCity =
                document.getElementById(
                    "topCity"
                );

            const weatherScore =
                document.getElementById(
                    "weatherScore"
                );

            const floodIndex =
                document.getElementById(
                    "floodIndex"
                );

            if (nationalRisk) {
                nationalRisk.textContent =
                    `${averageRisk}%`;
            }

            if (topCity) {
                topCity.textContent =
                    top.name || "--";
            }

            if (weatherScore) {
                weatherScore.textContent =
                    `${top.weatherScore}%`;
            }

            if (floodIndex) {
                floodIndex.textContent =
                    `${top.floodIndex}%`;
            }
        },

        getRecommendation(risk) {
            const safeRisk = this.clamp(risk);

            if (safeRisk >= 70) {
                return (
                    "Emergency escalation recommended."
                );
            }

            if (safeRisk >= 45) {
                return (
                    "Active monitoring and field readiness recommended."
                );
            }

            if (safeRisk >= 25) {
                return (
                    "Enhanced monitoring with radar watch recommended."
                );
            }

            return (
                "Normal monitoring with radar watch."
            );
        },

        renderReport(cities) {
            const top =
                this.getTopCity(cities);

            const panel =
                document.getElementById(
                    "reportPanel"
                );

            if (!top || !panel) {
                return;
            }

            panel.innerHTML = `
                <div class="item success">
                    <h2>
                        Real-Time National Intelligence Report
                    </h2>

                    <br>

                    <b>Top City:</b>
                    ${this.escapeHTML(top.name)}
                    <br>

                    <b>Weather Score:</b>
                    ${top.weatherScore}%
                    <br>

                    <b>Flood Index:</b>
                    ${top.floodIndex}%
                    <br>

                    <b>Road Risk:</b>
                    ${top.roadRisk}%
                    <br>

                    <b>Infrastructure Criticality:</b>
                    ${top.infrastructureCriticality}%
                    <br>

                    <b>Final Risk:</b>
                    ${top.finalRisk}%
                    <br><br>

                    <b>Recommendation:</b>
                    ${this.getRecommendation(
                        top.finalRisk
                    )}
                </div>
            `;
        },

        /* =====================================================
           DATA-ENGINE PIPELINE
           ===================================================== */

        async analyzeCities() {
            const cityEngine = this.resolveEngine(
                "CityEngine",
                "CityIntelligenceEngine"
            );

            if (!cityEngine) {
                console.warn(
                    "RG23 Brain: CityEngine is unavailable."
                );

                return this.normalizeCities(
                    this.latestCities
                );
            }

            let cities = null;

            if (
                this.isFunction(cityEngine.analyze)
            ) {
                cities = await this.safeExecute({
                    label: "CityEngine.analyze",
                    target: cityEngine,
                    method: "analyze",
                    fallback: null
                });
            } else if (
                this.isFunction(
                    cityEngine.analyzeCities
                )
            ) {
                cities = await this.safeExecute({
                    label:
                        "CityEngine.analyzeCities",
                    target: cityEngine,
                    method: "analyzeCities",
                    fallback: null
                });
            } else if (
                Array.isArray(cityEngine.cities)
            ) {
                cities = cityEngine.cities;
            }

            return this.normalizeCities(
                cities ||
                this.latestCities ||
                []
            );
        },

        async applyTrafficAnalysis(cities) {
            const trafficEngine =
                this.resolveEngine(
                    "TrafficEngine",
                    "TrafficIntelligenceEngine"
                );

            if (!trafficEngine) {
                return cities;
            }

            let result = cities;

            if (
                this.isFunction(trafficEngine.analyze)
            ) {
                result = await this.safeExecute({
                    label: "TrafficEngine.analyze",
                    target: trafficEngine,
                    method: "analyze",
                    args: [cities],
                    fallback: cities
                });
            } else if (
                this.isFunction(
                    trafficEngine.analyzeCities
                )
            ) {
                result = await this.safeExecute({
                    label:
                        "TrafficEngine.analyzeCities",
                    target: trafficEngine,
                    method: "analyzeCities",
                    args: [cities],
                    fallback: cities
                });
            }

            return this.normalizeCities(
                result || cities
            );
        },

        async applyInfrastructureAnalysis(cities) {
            const infrastructureEngine =
                this.resolveEngine(
                    "InfrastructureEngine",
                    "InfrastructureIntelligenceEngine"
                );

            if (!infrastructureEngine) {
                return cities;
            }

            let result = cities;

            if (
                this.isFunction(
                    infrastructureEngine.analyze
                )
            ) {
                result = await this.safeExecute({
                    label:
                        "InfrastructureEngine.analyze",
                    target: infrastructureEngine,
                    method: "analyze",
                    args: [cities],
                    fallback: cities
                });
            } else if (
                this.isFunction(
                    infrastructureEngine.analyzeCities
                )
            ) {
                result = await this.safeExecute({
                    label:
                        "InfrastructureEngine.analyzeCities",
                    target: infrastructureEngine,
                    method: "analyzeCities",
                    args: [cities],
                    fallback: cities
                });
            }

            return this.normalizeCities(
                result || cities
            );
        },

        async applyFloodAnalysis(cities) {
            const floodEngine =
                this.resolveEngine(
                    "FloodEngine",
                    "FloodIntelligenceEngine"
                );

            if (!floodEngine) {
                return cities;
            }

            let result = cities;

            if (
                this.isFunction(floodEngine.analyze)
            ) {
                result = await this.safeExecute({
                    label: "FloodEngine.analyze",
                    target: floodEngine,
                    method: "analyze",
                    args: [cities],
                    fallback: cities
                });
            } else if (
                this.isFunction(
                    floodEngine.analyzeCities
                )
            ) {
                result = await this.safeExecute({
                    label:
                        "FloodEngine.analyzeCities",
                    target: floodEngine,
                    method: "analyzeCities",
                    args: [cities],
                    fallback: cities
                });
            }

            return this.normalizeCities(
                result || cities
            );
        },

        async renderCityPanel(cities) {
            const cityEngine =
                this.resolveEngine(
                    "CityEngine",
                    "CityIntelligenceEngine"
                );

            if (!cityEngine) {
                return;
            }

            if (
                this.isFunction(cityEngine.render)
            ) {
                await this.safeExecute({
                    label: "CityEngine.render",
                    target: cityEngine,
                    method: "render",
                    args: [cities]
                });

                return;
            }

            if (
                this.isFunction(
                    cityEngine.renderCities
                )
            ) {
                await this.safeExecute({
                    label:
                        "CityEngine.renderCities",
                    target: cityEngine,
                    method: "renderCities",
                    args: [cities]
                });

                return;
            }

            if (
                this.isFunction(
                    cityEngine.updateCities
                )
            ) {
                await this.safeExecute({
                    label:
                        "CityEngine.updateCities",
                    target: cityEngine,
                    method: "updateCities",
                    args: [cities]
                });
            }
        },

        /* =====================================================
           SAFE DATABASE COMPATIBILITY
           ===================================================== */

        getNationalDatabase() {
            return this.resolveEngine(
                "NationalDatabase",
                "NationalDataHub",
                "DatabaseEngine"
            );
        },

        async updateNationalDatabase(cities) {
            const database =
                this.getNationalDatabase();

            if (!database) {
                console.warn(
                    "RG23 Brain: NationalDatabase unavailable. Database update skipped."
                );

                return {
                    ok: false,
                    skipped: true,
                    reason:
                        "NATIONAL_DATABASE_UNAVAILABLE"
                };
            }

            let updated = false;

            if (
                this.isFunction(database.updateCities)
            ) {
                await this.safeExecute({
                    label:
                        "NationalDatabase.updateCities",
                    target: database,
                    method: "updateCities",
                    args: [cities]
                });

                updated = true;
            } else if (
                this.isFunction(database.setCities)
            ) {
                await this.safeExecute({
                    label:
                        "NationalDatabase.setCities",
                    target: database,
                    method: "setCities",
                    args: [cities]
                });

                updated = true;
            } else {
                database.cities = cities;
                updated = true;

                console.warn(
                    "RG23 Brain: database has no updateCities method; cities stored directly."
                );
            }

            const topCity =
                this.getTopCity(cities);

            const cycleData = {
                type: "Full Analysis",
                timestamp:
                    new Date().toISOString(),
                cities: cities.length,
                topCity:
                    topCity?.name || "--",
                nationalRisk:
                    this.calculateNationalRisk(
                        cities
                    )
            };

            if (
                this.isFunction(database.addCycle)
            ) {
                await this.safeExecute({
                    label:
                        "NationalDatabase.addCycle",
                    target: database,
                    method: "addCycle",
                    args: [cycleData]
                });
            } else if (
                this.isFunction(database.saveCycle)
            ) {
                await this.safeExecute({
                    label:
                        "NationalDatabase.saveCycle",
                    target: database,
                    method: "saveCycle",
                    args: [cycleData]
                });
            }

            return {
                ok: true,
                updated
            };
        },

        async addMemory(type, text) {
            const database =
                this.getNationalDatabase();

            if (!database) {
                return false;
            }

            if (
                this.isFunction(database.addMemory)
            ) {
                await this.safeExecute({
                    label:
                        "NationalDatabase.addMemory",
                    target: database,
                    method: "addMemory",
                    args: [type, text]
                });

                return true;
            }

            if (
                this.isFunction(database.saveMemory)
            ) {
                await this.safeExecute({
                    label:
                        "NationalDatabase.saveMemory",
                    target: database,
                    method: "saveMemory",
                    args: [{
                        type,
                        text,
                        timestamp:
                            new Date().toISOString()
                    }]
                });

                return true;
            }

            if (!Array.isArray(database.memory)) {
                database.memory = [];
            }

            database.memory.push({
                type,
                text,
                timestamp:
                    new Date().toISOString()
            });

            return true;
        },

        calculateNationalRisk(cities) {
            const normalizedCities =
                this.normalizeCities(cities);

            if (!normalizedCities.length) {
                return 0;
            }

            return Math.round(
                normalizedCities.reduce(
                    (total, city) =>
                        total +
                        this.clamp(city.finalRisk),
                    0
                ) / normalizedCities.length
            );
        },

        /* =====================================================
           FULL ANALYSIS
           ===================================================== */

        async runFullAnalysis(options = {}) {
            if (this.analysisRunning) {
                console.warn(
                    "RG23 Brain: analysis already running."
                );

                return (
                    this.latestAnalysis || {
                        ok: false,
                        skipped: true,
                        reason:
                            "ANALYSIS_ALREADY_RUNNING",
                        cities:
                            this.latestCities
                    }
                );
            }

            this.analysisRunning = true;

            const startedAt = Date.now();

            this.writeCommander(
                "Starting real-time national analysis..."
            );

            try {
                let cities =
                    await this.analyzeCities();

                cities =
                    await this.applyTrafficAnalysis(
                        cities
                    );

                cities =
                    await this.applyInfrastructureAnalysis(
                        cities
                    );

                cities =
                    await this.applyFloodAnalysis(
                        cities
                    );

                cities = this.normalizeCities(
                    cities
                ).map(city => ({
                    ...city,
                    finalRisk:
                        this.calculateFinalRisk(city)
                }));

                this.latestCities = cities;

                try {
                    this.renderMap(cities);
                } catch (error) {
                    console.warn(
                        "RG23 Brain: renderMap failed.",
                        error
                    );
                }

                try {
                    this.updateKPIs(cities);
                } catch (error) {
                    console.warn(
                        "RG23 Brain: KPI update failed.",
                        error
                    );
                }

                try {
                    this.renderReport(cities);
                } catch (error) {
                    console.warn(
                        "RG23 Brain: report rendering failed.",
                        error
                    );
                }

                try {
                    await this.renderCityPanel(cities);
                } catch (error) {
                    console.warn(
                        "RG23 Brain: city-panel rendering failed.",
                        error
                    );
                }

                const databaseResult =
                    await this.updateNationalDatabase(
                        cities
                    );

                const topCity =
                    this.getTopCity(cities);

                const nationalRisk =
                    this.calculateNationalRisk(
                        cities
                    );

                const result = {
                    ok: true,
                    version: this.version,

                    timestamp:
                        new Date().toISOString(),

                    durationMs:
                        Date.now() - startedAt,

                    cities,
                    cityCount: cities.length,

                    topCity,
                    nationalRisk,

                    database: databaseResult,

                    source:
                        options.source ||
                        "RG23_BASE_ANALYSIS"
                };

                this.latestAnalysis = result;

                this.writeCommander(
                    "Real-time analysis completed."
                );

                window.dispatchEvent(
                    new CustomEvent(
                        "rainguard:base-analysis-completed",
                        {
                            detail: result
                        }
                    )
                );

                return result;
            } catch (error) {
                console.error(
                    "RG23 Brain runFullAnalysis error:",
                    error
                );

                const failure = {
                    ok: false,
                    version: this.version,

                    timestamp:
                        new Date().toISOString(),

                    durationMs:
                        Date.now() - startedAt,

                    error:
                        error?.message ||
                        String(error),

                    cities:
                        this.latestCities || [],

                    topCity:
                        this.getTopCity(
                            this.latestCities
                        ),

                    nationalRisk:
                        this.calculateNationalRisk(
                            this.latestCities
                        )
                };

                this.latestAnalysis = failure;

                this.writeCommander(
                    "Base analysis encountered an error. Cognitive engines may continue using the latest available data."
                );

                window.dispatchEvent(
                    new CustomEvent(
                        "rainguard:base-analysis-failed",
                        {
                            detail: failure
                        }
                    )
                );

                return failure;
            } finally {
                this.analysisRunning = false;
            }
        },

        /* =====================================================
           INTELLIGENCE PHASES
           ===================================================== */

        async runPhase(phase) {
            const normalizedPhase =
                String(phase || "").trim();

            try {
                if (normalizedPhase === "Observe") {
                    this.writeCommander(
                        "Observe: collecting city, radar and weather signals."
                    );

                    await this.addMemory(
                        "Observe",
                        "National observation started."
                    );
                }

                if (normalizedPhase === "Weather") {
                    this.writeCommander(
                        "Weather: analyzing forecast and observation data."
                    );

                    await this.runFullAnalysis({
                        source:
                            "INTELLIGENCE_CYCLE_WEATHER"
                    });
                }

                if (normalizedPhase === "Radar") {
                    this.writeCommander(
                        "Radar: loading radar intelligence layer."
                    );

                    const radarEngine =
                        this.resolveEngine(
                            "RadarEngine",
                            "RadarIntelligenceEngine"
                        );

                    if (
                        this.map &&
                        radarEngine &&
                        this.isFunction(
                            radarEngine.loadRadar
                        )
                    ) {
                        await this.safeExecute({
                            label:
                                "RadarEngine.loadRadar",
                            target: radarEngine,
                            method: "loadRadar",
                            args: [this.map]
                        });
                    }
                }

                if (normalizedPhase === "Flood") {
                    this.writeCommander(
                        "Flood: recalculating flood risk."
                    );

                    if (this.latestCities.length) {
                        this.latestCities =
                            await this.applyFloodAnalysis(
                                this.latestCities
                            );

                        this.latestCities =
                            this.latestCities.map(
                                city => ({
                                    ...city,
                                    finalRisk:
                                        this.calculateFinalRisk(
                                            city
                                        )
                                })
                            );

                        this.updateKPIs(
                            this.latestCities
                        );

                        this.renderMap(
                            this.latestCities
                        );
                    }
                }

                if (normalizedPhase === "City") {
                    this.writeCommander(
                        "City: refreshing city intelligence model."
                    );

                    if (this.latestCities.length) {
                        await this.renderCityPanel(
                            this.latestCities
                        );
                    }
                }

                if (normalizedPhase === "Reason") {
                    this.writeCommander(
                        "Reason: comparing national risk factors."
                    );

                    await this.addMemory(
                        "Reason",
                        "National risk factors compared."
                    );
                }

                if (normalizedPhase === "Decide") {
                    const top =
                        this.getTopCity(
                            this.latestCities
                        );

                    const risk =
                        this.clamp(
                            top?.finalRisk || 0
                        );

                    this.latestDecision =
                        risk >= 70
                            ? "Emergency escalation"
                            : risk >= 45
                                ? "Active monitoring"
                                : risk >= 25
                                    ? "Enhanced watch"
                                    : "Normal monitoring";

                    this.writeCommander(
                        `Decision: ${this.latestDecision}`
                    );
                }

                if (normalizedPhase === "Mission") {
                    const top =
                        this.getTopCity(
                            this.latestCities
                        );

                    if (top) {
                        await this.addMemory(
                            "Mission",
                            `Mission prepared for ${top.name}`
                        );

                        this.writeCommander(
                            `Mission prepared for ${top.name}`
                        );
                    }
                }

                if (normalizedPhase === "Learn") {
                    await this.addMemory(
                        "Learn",
                        "Cycle learned from latest analysis."
                    );

                    this.writeCommander(
                        "Learning completed."
                    );
                }

                return {
                    ok: true,
                    phase: normalizedPhase
                };
            } catch (error) {
                console.warn(
                    `RG23 Brain: phase ${normalizedPhase} failed.`,
                    error
                );

                return {
                    ok: false,
                    phase: normalizedPhase,
                    error:
                        error?.message ||
                        String(error)
                };
            }
        },

        /* =====================================================
           COMMANDER
           ===================================================== */

        writeCommander(text, type = "success") {
            const panel =
                document.getElementById(
                    "commanderLog"
                );

            if (!panel) {
                return;
            }

            const safeText =
                this.escapeHTML(text);

            panel.innerHTML = `
                <div class="item ${type}">
                    <b>
                        ${new Date().toLocaleTimeString(
                            "ar-SA"
                        )}
                    </b>
                    <br>
                    ${safeText}
                </div>
            ` + panel.innerHTML;
        },

        /* =====================================================
           BUTTONS
           ===================================================== */

        bindButtons() {
            const start =
                document.getElementById(
                    "startSystem"
                );

            const stop =
                document.getElementById(
                    "stopSystem"
                );

            const refresh =
                document.getElementById(
                    "refreshNow"
                );

            const report =
                document.getElementById(
                    "generateReport"
                );

            const send =
                document.getElementById(
                    "sendCommander"
                );

            const input =
                document.getElementById(
                    "commanderInput"
                );

            if (start) {
                start.onclick = async () => {
                    const cycle =
                        this.resolveEngine(
                            "IntelligenceCycle"
                        );

                    if (
                        cycle &&
                        this.isFunction(cycle.start)
                    ) {
                        await this.safeExecute({
                            label:
                                "IntelligenceCycle.start",
                            target: cycle,
                            method: "start"
                        });
                    } else {
                        await this.runFullAnalysis({
                            source:
                                "MANUAL_START"
                        });
                    }
                };
            }

            if (stop) {
                stop.onclick = async () => {
                    const cycle =
                        this.resolveEngine(
                            "IntelligenceCycle"
                        );

                    if (
                        cycle &&
                        this.isFunction(cycle.stop)
                    ) {
                        await this.safeExecute({
                            label:
                                "IntelligenceCycle.stop",
                            target: cycle,
                            method: "stop"
                        });
                    }

                    this.writeCommander(
                        "System cycle stopped.",
                        "warning"
                    );
                };
            }

            if (refresh) {
                refresh.onclick = () =>
                    this.runFullAnalysis({
                        source:
                            "MANUAL_REFRESH"
                    });
            }

            if (report) {
                report.onclick = () => {
                    if (
                        this.latestCities.length
                    ) {
                        this.renderReport(
                            this.latestCities
                        );
                    } else {
                        this.runFullAnalysis({
                            source:
                                "REPORT_REQUEST"
                        });
                    }
                };
            }

            if (send && input) {
                send.onclick = async () => {
                    const text =
                        input.value.trim();

                    if (!text) {
                        return;
                    }

                    this.writeCommander(
                        `Commander: ${text}`
                    );

                    this.writeCommander(
                        "ANI: Request received. Running refresh analysis."
                    );

                    input.value = "";

                    await this.runFullAnalysis({
                        source:
                            "COMMANDER_REQUEST",
                        query: text
                    });
                };

                input.addEventListener(
                    "keydown",
                    event => {
                        if (
                            event.key === "Enter"
                        ) {
                            event.preventDefault();
                            send.click();
                        }
                    }
                );
            }
        },

        /* =====================================================
           PUBLIC DATA ACCESS
           ===================================================== */

        getLatestCities() {
            return this.normalizeCities(
                this.latestCities
            );
        },

        getLatestAnalysis() {
            return this.latestAnalysis;
        },

        getState() {
            return {
                version: this.version,
                initialized:
                    this.initialized,
                analysisRunning:
                    this.analysisRunning,
                cityCount:
                    this.latestCities.length,
                latestDecision:
                    this.latestDecision,
                latestAnalysis:
                    this.latestAnalysis
            };
        }
    };

    /*
     * دعم الاسم القديم المستخدم في المشروع
     */
    RG23.Brain = Brain;

    /*
     * دعم الاسم الذي قد تستخدمه محركات V29
     */
    RG23.AIBrain = Brain;

    /*
     * دعم إضافي لبعض الملفات القديمة
     */
    RG23.AIBrainV23 = Brain;

})(window.RG23);


/* =========================================================
   SAFE AUTO INITIALIZATION
   ========================================================= */

function initializeRG23Brain() {
    try {
        window.RG23?.Brain?.init();
    } catch (error) {
        console.error(
            "RG23 Brain initialization failed:",
            error
        );
    }
}

if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        initializeRG23Brain,
        {
            once: true
        }
    );
} else {
    initializeRG23Brain();
}
