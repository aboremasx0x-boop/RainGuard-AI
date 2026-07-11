/* =========================================================
   RainGuard AI V30
   National Multi-Source Verification Engine
   File: frontend/js/verification_engine_v30.js
   ========================================================= */

window.RG30 = window.RG30 || {};

RG30.VerificationEngine = {

    version: "30.0.0",

    isRunning: false,
    cycleNumber: 0,
    lastRunAt: null,

    latestCities: [],
    latestVerification: [],
    latestNationalSummary: null,

    config: {
        minimumSources: 2,

        agreementTolerance: {
            rainProbability: 18,
            rainAmount: 4,
            risk: 15
        },

        thresholds: {
            verified: 75,
            supported: 55,
            uncertain: 35
        },

        defaultReliability: {
            official: 1.00,
            radar: 0.92,
            satellite: 0.86,
            lightning: 0.84,
            openMeteo: 0.80,
            localModel: 0.76
        },

        sourceWeights: {
            official: 0.28,
            radar: 0.22,
            satellite: 0.16,
            lightning: 0.12,
            openMeteo: 0.14,
            localModel: 0.08
        }
    },

    /* =====================================================
       INITIALIZATION
       ===================================================== */

    init() {
        if (this.isRunning) return;

        this.isRunning = true;

        this.bindEvents();
        this.writeLog("National Multi-Source Verification Engine V30 ready.");

        window.dispatchEvent(new CustomEvent("rg30:verification-ready", {
            detail: {
                version: this.version,
                timestamp: new Date().toISOString()
            }
        }));
    },

    bindEvents() {
        window.addEventListener("rg23:analysis-completed", event => {
            const cities = event?.detail?.cities || [];
            if (cities.length) {
                this.run(cities);
            }
        });

        window.addEventListener("rg29:cognitive-cycle-completed", event => {
            const cities =
                event?.detail?.cities ||
                window.RG23?.Brain?.latestCities ||
                [];

            if (cities.length) {
                this.run(cities);
            }
        });

        window.addEventListener("rg30:run-verification", event => {
            const cities =
                event?.detail?.cities ||
                window.RG23?.Brain?.latestCities ||
                [];

            this.run(cities);
        });
    },

    /* =====================================================
       MAIN EXECUTION
       ===================================================== */

    async run(cities = []) {
        if (!Array.isArray(cities) || !cities.length) {
            this.renderEmptyState("No city data available for verification.");
            this.writeLog("Verification skipped: no city data available.");
            return [];
        }

        this.cycleNumber += 1;
        this.lastRunAt = new Date().toISOString();

        this.writeLog(
            `V30 verification cycle ${this.cycleNumber} started for ${cities.length} cities.`
        );

        const preparedCities = cities.map(city => this.prepareCity(city));

        const results = preparedCities.map(city => {
            return this.verifyCity(city);
        });

        this.latestCities = preparedCities;
        this.latestVerification = results;
        this.latestNationalSummary = this.buildNationalSummary(results);

        this.render(results, this.latestNationalSummary);
        this.publishResults(results, this.latestNationalSummary);

        this.writeLog(
            `V30 verification completed. National confidence: ` +
            `${this.latestNationalSummary.nationalConfidence}%.`
        );

        return results;
    },

    /* =====================================================
       CITY PREPARATION
       ===================================================== */

    prepareCity(city = {}) {
        const safeNumber = value => {
            const number = Number(value);
            return Number.isFinite(number) ? number : 0;
        };

        const officialData =
            city.officialData ||
            city.ncmData ||
            city.anwaaData ||
            {};

        const radarData =
            city.radarData ||
            city.radar ||
            {};

        const satelliteData =
            city.satelliteData ||
            city.satellite ||
            {};

        const lightningData =
            city.lightningData ||
            city.lightning ||
            {};

        const openMeteoData =
            city.openMeteoData ||
            city.weather ||
            {};

        return {
            ...city,

            name: city.name || city.city || "Unknown",
            lat: safeNumber(city.lat || city.latitude),
            lon: safeNumber(city.lon || city.longitude),

            officialData: {
                available:
                    officialData.available === true ||
                    officialData.status === "AVAILABLE" ||
                    officialData.status === "VERIFIED",

                status:
                    officialData.status ||
                    city.officialStatus ||
                    "PENDING_API",

                rainProbability: safeNumber(
                    officialData.rainProbability ??
                    officialData.probability ??
                    city.officialRainProbability
                ),

                rainAmount: safeNumber(
                    officialData.rainAmount ??
                    officialData.precipitation ??
                    city.officialRainAmount
                ),

                warningLevel:
                    officialData.warningLevel ||
                    officialData.level ||
                    city.officialWarningLevel ||
                    "UNKNOWN"
            },

            radarData: {
                available:
                    radarData.available === true ||
                    safeNumber(radarData.intensity) > 0 ||
                    safeNumber(city.radarIntensity) > 0,

                intensity: safeNumber(
                    radarData.intensity ??
                    radarData.rainIntensity ??
                    city.radarIntensity
                ),

                rainDetected:
                    radarData.rainDetected === true ||
                    safeNumber(radarData.intensity) > 0,

                movementConfidence: safeNumber(
                    radarData.movementConfidence ??
                    city.radarMovementConfidence
                )
            },

            satelliteData: {
                available:
                    satelliteData.available === true ||
                    safeNumber(satelliteData.cloudCover) > 0 ||
                    safeNumber(city.cloudCover) > 0,

                cloudCover: safeNumber(
                    satelliteData.cloudCover ??
                    city.cloudCover
                ),

                convectionScore: safeNumber(
                    satelliteData.convectionScore ??
                    city.convectionScore
                ),

                cloudTemperature: safeNumber(
                    satelliteData.cloudTemperature ??
                    city.cloudTemperature
                )
            },

            lightningData: {
                available:
                    lightningData.available === true ||
                    safeNumber(lightningData.strikes) > 0 ||
                    safeNumber(city.lightningStrikes) > 0,

                strikes: safeNumber(
                    lightningData.strikes ??
                    city.lightningStrikes
                ),

                distanceKm: safeNumber(
                    lightningData.distanceKm ??
                    city.lightningDistanceKm
                ),

                activityScore: safeNumber(
                    lightningData.activityScore ??
                    city.lightningActivityScore
                )
            },

            openMeteoData: {
                available: true,

                rainProbability: safeNumber(
                    openMeteoData.rainProbability ??
                    openMeteoData.precipitation_probability ??
                    city.rainProbability ??
                    city.probability
                ),

                rainAmount: safeNumber(
                    openMeteoData.rainAmount ??
                    openMeteoData.precipitation ??
                    city.rain ??
                    city.rainAmount
                ),

                humidity: safeNumber(
                    openMeteoData.humidity ??
                    city.humidity
                ),

                cloudCover: safeNumber(
                    openMeteoData.cloudCover ??
                    city.cloudCover
                ),

                windSpeed: safeNumber(
                    openMeteoData.windSpeed ??
                    city.windSpeed
                )
            },

            localModelData: {
                available: true,

                weatherScore: safeNumber(city.weatherScore),
                floodIndex: safeNumber(city.floodIndex),
                roadRisk: safeNumber(city.roadRisk),
                finalRisk: safeNumber(
                    city.finalRisk ??
                    city.baseRisk
                )
            }
        };
    },

    /* =====================================================
       CITY VERIFICATION
       ===================================================== */

    verifyCity(city) {
        const sourceEvidence = {
            official: this.evaluateOfficialSource(city),
            radar: this.evaluateRadarSource(city),
            satellite: this.evaluateSatelliteSource(city),
            lightning: this.evaluateLightningSource(city),
            openMeteo: this.evaluateOpenMeteoSource(city),
            localModel: this.evaluateLocalModel(city)
        };

        const availableSources = Object.values(sourceEvidence).filter(
            source => source.available
        );

        const activeSourceCount = availableSources.length;

        const agreement = this.calculateAgreement(sourceEvidence);

        const evidenceScore = this.calculateEvidenceScore(sourceEvidence);

        const weightedConfidence = this.calculateWeightedConfidence(
            sourceEvidence,
            agreement,
            evidenceScore
        );

        const rainConsensus = this.calculateRainConsensus(sourceEvidence);

        const conflict = this.detectConflict(sourceEvidence, agreement);

        const verificationStatus = this.getVerificationStatus(
            weightedConfidence,
            activeSourceCount,
            conflict
        );

        const finalRisk = this.calculateVerifiedRisk(
            city,
            sourceEvidence,
            rainConsensus,
            weightedConfidence
        );

        const decisionGate = this.buildDecisionGate({
            finalRisk,
            weightedConfidence,
            verificationStatus,
            activeSourceCount,
            conflict,
            rainConsensus
        });

        return {
            city: city.name,
            lat: city.lat,
            lon: city.lon,

            sources: sourceEvidence,
            activeSourceCount,

            agreement: Math.round(agreement),
            evidenceScore: Math.round(evidenceScore),
            finalConfidence: Math.round(weightedConfidence),

            rainConsensus: Math.round(rainConsensus),
            verifiedRisk: Math.round(finalRisk),

            conflict,
            status: verificationStatus,

            decisionGate,

            timestamp: new Date().toISOString()
        };
    },

    /* =====================================================
       SOURCE EVALUATION
       ===================================================== */

    evaluateOfficialSource(city) {
        const data = city.officialData;

        const available = data.available === true;

        let signalScore = 0;

        if (available) {
            signalScore += this.clamp(data.rainProbability, 0, 100) * 0.55;
            signalScore += this.rainAmountToScore(data.rainAmount) * 0.30;
            signalScore += this.warningLevelToScore(data.warningLevel) * 0.15;
        }

        return this.createSourceResult({
            key: "official",
            name: "Official National Source",
            available,
            reliability: this.config.defaultReliability.official,
            signalScore,
            rainProbability: data.rainProbability,
            rainAmount: data.rainAmount,
            status: data.status,
            details: {
                warningLevel: data.warningLevel
            }
        });
    },

    evaluateRadarSource(city) {
        const data = city.radarData;

        const available = data.available === true;

        let probability = 0;

        if (available) {
            probability = this.clamp(
                data.intensity * 1.8 +
                data.movementConfidence * 0.35 +
                (data.rainDetected ? 20 : 0),
                0,
                100
            );
        }

        return this.createSourceResult({
            key: "radar",
            name: "Weather Radar",
            available,
            reliability: this.config.defaultReliability.radar,
            signalScore: probability,
            rainProbability: probability,
            rainAmount: data.intensity,
            status: available ? "ACTIVE" : "UNAVAILABLE",
            details: {
                rainDetected: data.rainDetected,
                intensity: data.intensity,
                movementConfidence: data.movementConfidence
            }
        });
    },

    evaluateSatelliteSource(city) {
        const data = city.satelliteData;

        const available = data.available === true;

        let probability = 0;

        if (available) {
            probability = this.clamp(
                data.cloudCover * 0.45 +
                data.convectionScore * 0.45 +
                this.cloudTemperatureToScore(data.cloudTemperature) * 0.10,
                0,
                100
            );
        }

        return this.createSourceResult({
            key: "satellite",
            name: "Satellite",
            available,
            reliability: this.config.defaultReliability.satellite,
            signalScore: probability,
            rainProbability: probability,
            rainAmount: 0,
            status: available ? "ACTIVE" : "UNAVAILABLE",
            details: {
                cloudCover: data.cloudCover,
                convectionScore: data.convectionScore,
                cloudTemperature: data.cloudTemperature
            }
        });
    },

    evaluateLightningSource(city) {
        const data = city.lightningData;

        const available = data.available === true;

        let probability = 0;

        if (available) {
            const distanceFactor =
                data.distanceKm > 0
                    ? Math.max(0, 100 - data.distanceKm * 2)
                    : 0;

            probability = this.clamp(
                data.strikes * 4 +
                data.activityScore * 0.45 +
                distanceFactor * 0.25,
                0,
                100
            );
        }

        return this.createSourceResult({
            key: "lightning",
            name: "Lightning Detection",
            available,
            reliability: this.config.defaultReliability.lightning,
            signalScore: probability,
            rainProbability: probability,
            rainAmount: 0,
            status: available ? "ACTIVE" : "UNAVAILABLE",
            details: {
                strikes: data.strikes,
                distanceKm: data.distanceKm,
                activityScore: data.activityScore
            }
        });
    },

    evaluateOpenMeteoSource(city) {
        const data = city.openMeteoData;

        const humiditySignal = this.clamp(
            (data.humidity - 35) * 1.3,
            0,
            100
        );

        const cloudSignal = this.clamp(data.cloudCover, 0, 100);

        const amountSignal = this.rainAmountToScore(data.rainAmount);

        const signalScore = this.clamp(
            data.rainProbability * 0.55 +
            amountSignal * 0.20 +
            humiditySignal * 0.10 +
            cloudSignal * 0.15,
            0,
            100
        );

        return this.createSourceResult({
            key: "openMeteo",
            name: "Open-Meteo",
            available: true,
            reliability: this.config.defaultReliability.openMeteo,
            signalScore,
            rainProbability: data.rainProbability,
            rainAmount: data.rainAmount,
            status: "ACTIVE",
            details: {
                humidity: data.humidity,
                cloudCover: data.cloudCover,
                windSpeed: data.windSpeed
            }
        });
    },

    evaluateLocalModel(city) {
        const data = city.localModelData;

        const signalScore = this.clamp(
            data.weatherScore * 0.40 +
            data.floodIndex * 0.25 +
            data.roadRisk * 0.15 +
            data.finalRisk * 0.20,
            0,
            100
        );

        return this.createSourceResult({
            key: "localModel",
            name: "RainGuard Local AI Model",
            available: true,
            reliability: this.config.defaultReliability.localModel,
            signalScore,
            rainProbability: data.weatherScore,
            rainAmount: 0,
            status: "ACTIVE",
            details: {
                weatherScore: data.weatherScore,
                floodIndex: data.floodIndex,
                roadRisk: data.roadRisk,
                finalRisk: data.finalRisk
            }
        });
    },

    createSourceResult({
        key,
        name,
        available,
        reliability,
        signalScore,
        rainProbability,
        rainAmount,
        status,
        details
    }) {
        return {
            key,
            name,
            available: Boolean(available),
            reliability: this.clamp(reliability, 0, 1),
            signalScore: Math.round(
                this.clamp(signalScore, 0, 100)
            ),
            rainProbability: Math.round(
                this.clamp(rainProbability, 0, 100)
            ),
            rainAmount: Number(
                this.clamp(rainAmount, 0, 1000).toFixed(2)
            ),
            status: status || "UNKNOWN",
            details: details || {}
        };
    },

    /* =====================================================
       AGREEMENT AND EVIDENCE
       ===================================================== */

    calculateAgreement(sourceEvidence) {
        const sources = Object.values(sourceEvidence).filter(
            source => source.available
        );

        if (sources.length < 2) return 0;

        let comparisons = 0;
        let totalAgreement = 0;

        for (let i = 0; i < sources.length; i++) {
            for (let j = i + 1; j < sources.length; j++) {
                const difference = Math.abs(
                    sources[i].signalScore -
                    sources[j].signalScore
                );

                const agreement = this.clamp(
                    100 - difference,
                    0,
                    100
                );

                totalAgreement += agreement;
                comparisons += 1;
            }
        }

        return comparisons
            ? totalAgreement / comparisons
            : 0;
    },

    calculateEvidenceScore(sourceEvidence) {
        let weightedEvidence = 0;
        let totalWeight = 0;

        Object.entries(sourceEvidence).forEach(([key, source]) => {
            if (!source.available) return;

            const sourceWeight =
                this.config.sourceWeights[key] || 0;

            const reliability =
                source.reliability || 0;

            weightedEvidence +=
                source.signalScore *
                sourceWeight *
                reliability;

            totalWeight +=
                sourceWeight *
                reliability;
        });

        if (!totalWeight) return 0;

        return this.clamp(
            weightedEvidence / totalWeight,
            0,
            100
        );
    },

    calculateWeightedConfidence(
        sourceEvidence,
        agreement,
        evidenceScore
    ) {
        const availableSources = Object.values(sourceEvidence).filter(
            source => source.available
        );

        const sourceCoverage = this.clamp(
            availableSources.length / 6 * 100,
            0,
            100
        );

        const averageReliability =
            availableSources.length
                ? availableSources.reduce(
                    (sum, source) => sum + source.reliability,
                    0
                ) / availableSources.length * 100
                : 0;

        const officialBonus =
            sourceEvidence.official.available
                ? 8
                : 0;

        const confidence =
            agreement * 0.35 +
            evidenceScore * 0.30 +
            sourceCoverage * 0.15 +
            averageReliability * 0.20 +
            officialBonus;

        return this.clamp(confidence, 0, 100);
    },

    calculateRainConsensus(sourceEvidence) {
        let weightedProbability = 0;
        let totalWeight = 0;

        Object.entries(sourceEvidence).forEach(([key, source]) => {
            if (!source.available) return;

            const sourceWeight =
                this.config.sourceWeights[key] || 0;

            const weight =
                sourceWeight *
                source.reliability;

            weightedProbability +=
                source.rainProbability *
                weight;

            totalWeight += weight;
        });

        return totalWeight
            ? this.clamp(
                weightedProbability / totalWeight,
                0,
                100
            )
            : 0;
    },

    /* =====================================================
       CONFLICT DETECTION
       ===================================================== */

    detectConflict(sourceEvidence, agreement) {
        const official = sourceEvidence.official;
        const radar = sourceEvidence.radar;
        const openMeteo = sourceEvidence.openMeteo;

        const reasons = [];

        if (
            official.available &&
            Math.abs(
                official.rainProbability -
                openMeteo.rainProbability
            ) > 35
        ) {
            reasons.push(
                "Official source and Open-Meteo differ significantly."
            );
        }

        if (
            radar.available &&
            radar.rainDetected &&
            openMeteo.rainProbability < 15
        ) {
            reasons.push(
                "Radar detects rain while forecast probability is low."
            );
        }

        if (agreement < 45) {
            reasons.push(
                "Low agreement among available sources."
            );
        }

        return {
            detected: reasons.length > 0,
            level:
                reasons.length >= 2
                    ? "HIGH"
                    : reasons.length === 1
                        ? "MEDIUM"
                        : "NONE",
            reasons
        };
    },

    getVerificationStatus(
        confidence,
        sourceCount,
        conflict
    ) {
        if (sourceCount < this.config.minimumSources) {
            return "INSUFFICIENT_DATA";
        }

        if (
            conflict.detected &&
            conflict.level === "HIGH"
        ) {
            return "CONFLICTED";
        }

        if (confidence >= this.config.thresholds.verified) {
            return "VERIFIED";
        }

        if (confidence >= this.config.thresholds.supported) {
            return "SUPPORTED";
        }

        if (confidence >= this.config.thresholds.uncertain) {
            return "UNCERTAIN";
        }

        return "UNVERIFIED";
    },

    /* =====================================================
       VERIFIED RISK
       ===================================================== */

    calculateVerifiedRisk(
        city,
        sourceEvidence,
        rainConsensus,
        confidence
    ) {
        const localRisk =
            city.localModelData.finalRisk || 0;

        const floodRisk =
            city.localModelData.floodIndex || 0;

        const radarRisk =
            sourceEvidence.radar.signalScore || 0;

        const officialRisk =
            sourceEvidence.official.available
                ? sourceEvidence.official.signalScore
                : rainConsensus;

        const verifiedRisk =
            localRisk * 0.25 +
            floodRisk * 0.20 +
            rainConsensus * 0.25 +
            radarRisk * 0.15 +
            officialRisk * 0.15;

        const confidenceFactor =
            0.70 + confidence / 100 * 0.30;

        return this.clamp(
            verifiedRisk * confidenceFactor,
            0,
            100
        );
    },

    buildDecisionGate({
        finalRisk,
        weightedConfidence,
        verificationStatus,
        activeSourceCount,
        conflict,
        rainConsensus
    }) {
        let allowed = false;
        let action = "HOLD";
        let reason = "Evidence is not sufficient.";

        if (
            verificationStatus === "VERIFIED" &&
            weightedConfidence >= 75
        ) {
            allowed = true;

            if (finalRisk >= 75) {
                action = "EMERGENCY_ESCALATION";
                reason =
                    "High verified risk supported by multiple sources.";
            } else if (finalRisk >= 55) {
                action = "OPERATIONAL_WARNING";
                reason =
                    "Verified multi-source risk requires operational readiness.";
            } else if (finalRisk >= 35) {
                action = "ENHANCED_WATCH";
                reason =
                    "Moderate verified risk requires increased monitoring.";
            } else {
                action = "NORMAL_MONITORING";
                reason =
                    "Verified evidence indicates low current risk.";
            }
        } else if (
            verificationStatus === "SUPPORTED" &&
            weightedConfidence >= 55
        ) {
            allowed = true;

            action =
                finalRisk >= 45 ||
                rainConsensus >= 50
                    ? "ENHANCED_WATCH"
                    : "NORMAL_MONITORING";

            reason =
                "Evidence is supported but not fully verified.";
        } else if (conflict.detected) {
            action = "MANUAL_REVIEW";
            reason =
                "Sources conflict and require additional verification.";
        } else if (activeSourceCount < 2) {
            action = "WAIT_FOR_SOURCES";
            reason =
                "Not enough active sources are available.";
        }

        return {
            allowed,
            action,
            reason
        };
    },

    /* =====================================================
       NATIONAL SUMMARY
       ===================================================== */

    buildNationalSummary(results) {
        if (!results.length) {
            return {
                cities: 0,
                verifiedCities: 0,
                supportedCities: 0,
                conflictedCities: 0,
                averageAgreement: 0,
                averageEvidenceScore: 0,
                nationalConfidence: 0,
                topCity: "--",
                topRisk: 0,
                nationalStatus: "NO_DATA"
            };
        }

        const average = field => {
            return Math.round(
                results.reduce(
                    (sum, result) => sum + (result[field] || 0),
                    0
                ) / results.length
            );
        };

        const top = [...results].sort(
            (a, b) => b.verifiedRisk - a.verifiedRisk
        )[0];

        const verifiedCities = results.filter(
            result => result.status === "VERIFIED"
        ).length;

        const supportedCities = results.filter(
            result => result.status === "SUPPORTED"
        ).length;

        const conflictedCities = results.filter(
            result =>
                result.status === "CONFLICTED" ||
                result.conflict.detected
        ).length;

        const nationalConfidence =
            average("finalConfidence");

        const topRisk = top?.verifiedRisk || 0;

        let nationalStatus = "NORMAL";

        if (topRisk >= 75) {
            nationalStatus = "EMERGENCY";
        } else if (topRisk >= 55) {
            nationalStatus = "WARNING";
        } else if (topRisk >= 35) {
            nationalStatus = "WATCH";
        }

        if (conflictedCities > results.length / 2) {
            nationalStatus = "SOURCE_CONFLICT";
        }

        return {
            cities: results.length,
            verifiedCities,
            supportedCities,
            conflictedCities,

            averageAgreement: average("agreement"),
            averageEvidenceScore: average("evidenceScore"),
            nationalConfidence,

            topCity: top?.city || "--",
            topRisk,

            nationalStatus,
            cycleNumber: this.cycleNumber,
            timestamp: this.lastRunAt
        };
    },

    /* =====================================================
       RENDERING
       ===================================================== */

    render(results, summary) {
        this.renderNationalPanel(summary);
        this.renderCitiesPanel(results);
        this.renderSourceMatrix(results);
        this.renderVerificationKPIs(summary);
    },

    renderNationalPanel(summary) {
        const panel = document.getElementById(
            "nationalVerificationSummary"
        );

        if (!panel) return;

        const statusClass =
            summary.nationalStatus === "EMERGENCY"
                ? "danger"
                : summary.nationalStatus === "WARNING"
                    ? "warning"
                    : "success";

        panel.innerHTML = `
            <div class="item ${statusClass}">
                <h3>National Verification Summary V30</h3>

                <b>National Status:</b>
                ${summary.nationalStatus}<br>

                <b>Cities Analyzed:</b>
                ${summary.cities}<br>

                <b>Verified Cities:</b>
                ${summary.verifiedCities}<br>

                <b>Supported Cities:</b>
                ${summary.supportedCities}<br>

                <b>Conflicted Cities:</b>
                ${summary.conflictedCities}<br>

                <b>Average Agreement:</b>
                ${summary.averageAgreement}%<br>

                <b>Evidence Score:</b>
                ${summary.averageEvidenceScore}%<br>

                <b>National Confidence:</b>
                ${summary.nationalConfidence}%<br>

                <b>Highest Risk City:</b>
                ${summary.topCity}<br>

                <b>Verified Risk:</b>
                ${summary.topRisk}%
            </div>
        `;
    },

    renderCitiesPanel(results) {
        const panel = document.getElementById(
            "multiSourceVerificationPanel"
        );

        if (!panel) return;

        panel.innerHTML = results
            .sort((a, b) => b.verifiedRisk - a.verifiedRisk)
            .map(result => {
                const className =
                    result.status === "VERIFIED"
                        ? "success"
                        : result.status === "CONFLICTED"
                            ? "danger"
                            : result.status === "UNCERTAIN"
                                ? "warning"
                                : "info";

                return `
                    <div class="item ${className}">
                        <h3>${result.city}</h3>

                        <b>Status:</b>
                        ${result.status}<br>

                        <b>Active Sources:</b>
                        ${result.activeSourceCount}<br>

                        <b>Agreement:</b>
                        ${result.agreement}%<br>

                        <b>Evidence Score:</b>
                        ${result.evidenceScore}%<br>

                        <b>Final Confidence:</b>
                        ${result.finalConfidence}%<br>

                        <b>Rain Consensus:</b>
                        ${result.rainConsensus}%<br>

                        <b>Verified Risk:</b>
                        ${result.verifiedRisk}%<br>

                        <b>Decision Gate:</b>
                        ${result.decisionGate.action}<br>

                        <b>Decision:</b>
                        ${result.decisionGate.allowed
                            ? "ALLOWED"
                            : "HELD"}<br>

                        <b>Reason:</b>
                        ${result.decisionGate.reason}
                    </div>
                `;
            })
            .join("");
    },

    renderSourceMatrix(results) {
        const panel = document.getElementById(
            "verificationSourceMatrix"
        );

        if (!panel) return;

        const topResult = [...results].sort(
            (a, b) => b.verifiedRisk - a.verifiedRisk
        )[0];

        if (!topResult) return;

        panel.innerHTML = Object.values(topResult.sources)
            .map(source => {
                const className =
                    source.available
                        ? "success"
                        : "warning";

                return `
                    <div class="item ${className}">
                        <b>${source.name}</b><br>
                        Available:
                        ${source.available ? "YES" : "NO"}<br>
                        Status:
                        ${source.status}<br>
                        Reliability:
                        ${Math.round(source.reliability * 100)}%<br>
                        Signal Score:
                        ${source.signalScore}%<br>
                        Rain Probability:
                        ${source.rainProbability}%<br>
                        Rain Amount:
                        ${source.rainAmount} mm
                    </div>
                `;
            })
            .join("");
    },

    renderVerificationKPIs(summary) {
        const agreement = document.getElementById(
            "verificationAgreement"
        );

        const evidence = document.getElementById(
            "verificationEvidence"
        );

        const confidence = document.getElementById(
            "verificationConfidence"
        );

        const status = document.getElementById(
            "verificationStatus"
        );

        if (agreement) {
            agreement.innerText =
                `${summary.averageAgreement}%`;
        }

        if (evidence) {
            evidence.innerText =
                `${summary.averageEvidenceScore}%`;
        }

        if (confidence) {
            confidence.innerText =
                `${summary.nationalConfidence}%`;
        }

        if (status) {
            status.innerText =
                summary.nationalStatus;
        }
    },

    renderEmptyState(message) {
        const panel = document.getElementById(
            "multiSourceVerificationPanel"
        );

        if (panel) {
            panel.innerHTML = `
                <div class="item warning">
                    ${message}
                </div>
            `;
        }
    },

    /* =====================================================
       EVENTS AND DATA SHARING
       ===================================================== */

    publishResults(results, summary) {
        window.RG30.latestVerification = results;
        window.RG30.latestNationalSummary = summary;

        window.dispatchEvent(
            new CustomEvent(
                "rg30:verification-completed",
                {
                    detail: {
                        results,
                        summary,
                        timestamp: this.lastRunAt
                    }
                }
            )
        );

        if (window.RG29) {
            window.RG29.verificationResults = results;
            window.RG29.verificationSummary = summary;
        }

        if (window.RG23?.NationalDatabase) {
            try {
                RG23.NationalDatabase.addCycle({
                    type: "V30 Multi-Source Verification",
                    cities: results.length,
                    verifiedCities: summary.verifiedCities,
                    nationalConfidence: summary.nationalConfidence,
                    nationalStatus: summary.nationalStatus
                });
            } catch (error) {
                console.warn(
                    "V30 database cycle save skipped:",
                    error
                );
            }
        }
    },

    /* =====================================================
       HELPERS
       ===================================================== */

    rainAmountToScore(amount) {
        const value = Number(amount) || 0;

        if (value <= 0) return 0;
        if (value < 0.5) return 10;
        if (value < 2) return 25;
        if (value < 5) return 45;
        if (value < 10) return 65;
        if (value < 25) return 82;

        return 100;
    },

    warningLevelToScore(level) {
        const value = String(level || "")
            .trim()
            .toUpperCase();

        const map = {
            UNKNOWN: 0,
            NORMAL: 5,
            GREEN: 5,
            WATCH: 35,
            YELLOW: 40,
            WARNING: 65,
            ORANGE: 70,
            EMERGENCY: 95,
            RED: 100
        };

        return map[value] ?? 0;
    },

    cloudTemperatureToScore(temperature) {
        const value = Number(temperature);

        if (!Number.isFinite(value)) return 0;

        if (value <= -60) return 100;
        if (value <= -50) return 85;
        if (value <= -40) return 65;
        if (value <= -30) return 45;
        if (value <= -20) return 25;

        return 10;
    },

    clamp(value, min, max) {
        const number = Number(value);

        if (!Number.isFinite(number)) return min;

        return Math.min(
            max,
            Math.max(min, number)
        );
    },

    writeLog(message) {
        console.log(
            `[RainGuard V30 Verification] ${message}`
        );

        if (window.RG23?.Brain?.writeCommander) {
            try {
                RG23.Brain.writeCommander(message);
            } catch (error) {
                console.warn(
                    "V30 commander log skipped:",
                    error
                );
            }
        }
    }

};

/* =========================================================
   AUTO START
   ========================================================= */

window.addEventListener("load", () => {
    RG30.VerificationEngine.init();

    setTimeout(() => {
        const cities =
            window.RG23?.Brain?.latestCities || [];

        if (cities.length) {
            RG30.VerificationEngine.run(cities);
        }
    }, 3500);
});
