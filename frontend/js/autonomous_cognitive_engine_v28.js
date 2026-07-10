window.RG28 = window.RG28 || {};

RG28.AutonomousCognitiveEngine = {

    version: "28.0",
    lastResult: null,

    memory: [],
    learnedWeights: {
        currentRisk: 0.22,
        weather: 0.18,
        flood: 0.20,
        forecast6h: 0.16,
        forecast24h: 0.12,
        infrastructure: 0.07,
        traffic: 0.05
    },

    clamp(value, min = 0, max = 100) {
        const number = Number(value);

        if (!Number.isFinite(number)) return min;

        return Math.min(max, Math.max(min, number));
    },

    average(values = []) {
        const valid = values
            .map(Number)
            .filter(Number.isFinite);

        if (!valid.length) return 0;

        return valid.reduce((sum, value) => sum + value, 0) / valid.length;
    },

    getCityRisk(city = {}) {
        return this.clamp(
            city.finalRisk ??
            city.floodIndex ??
            city.weatherScore ??
            city.baseRisk ??
            0
        );
    },

    getTopCity(cities = []) {
        return [...cities].sort(
            (a, b) => this.getCityRisk(b) - this.getCityRisk(a)
        )[0] || null;
    },

    getVerificationByCity(cityName, verifications = []) {
        return verifications.find(
            item => String(item?.city || "").toLowerCase() ===
                    String(cityName || "").toLowerCase()
        ) || null;
    },

    getWarningByCity(cityName, warnings = []) {
        return warnings.find(
            item => String(item?.city || "").toLowerCase() ===
                    String(cityName || "").toLowerCase()
        ) || null;
    },

    run({
        cities = [],
        warnings = [],
        verifications = [],
        infrastructure = [],
        traffic = [],
        radar = null,
        officialForecast = null
    } = {}) {

        const startedAt = Date.now();

        const situation = this.understandSituation({
            cities,
            warnings,
            verifications,
            infrastructure,
            traffic,
            radar,
            officialForecast
        });

        const prediction = this.predictFuture({
            situation,
            cities,
            warnings,
            verifications
        });

        const counterfactuals = this.simulateCounterfactuals({
            situation,
            prediction
        });

        const selectedScenario = this.selectBestScenario(counterfactuals);

        const decision = this.makeDecision({
            situation,
            prediction,
            selectedScenario
        });

        const plan = this.buildNationalPlan({
            situation,
            prediction,
            decision,
            selectedScenario
        });

        const explanation = this.explain({
            situation,
            prediction,
            counterfactuals,
            selectedScenario,
            decision,
            plan
        });

        const confidence = this.calculateConfidence({
            situation,
            prediction,
            verifications,
            warnings
        });

        this.lastResult = {
            engine: "Autonomous Cognitive Engine V28",
            version: this.version,
            status: "COMPLETED",
            generatedAt: new Date().toLocaleString("ar-SA"),
            processingMs: Date.now() - startedAt,

            situation,
            prediction,
            counterfactuals,
            selectedScenario,
            decision,
            plan,
            explanation,
            confidence
        };

        this.remember(this.lastResult);
        this.renderAll();

        return this.lastResult;
    },

    understandSituation({
        cities,
        warnings,
        verifications,
        infrastructure,
        traffic,
        radar,
        officialForecast
    }) {

        const cityRisks = cities.map(city => this.getCityRisk(city));
        const nationalRisk = Math.round(this.average(cityRisks));
        const maximumRisk = cityRisks.length
            ? Math.round(Math.max(...cityRisks))
            : 0;

        const topCity = this.getTopCity(cities);
        const topCityName = topCity?.name || "--";

        const activeWarnings = warnings.filter(item =>
            ["WATCH", "WARNING", "EMERGENCY"].includes(item?.overallLevel)
        );

        const emergencyWarnings = warnings.filter(
            item => item?.overallLevel === "EMERGENCY"
        );

        const warningCount = warnings.filter(
            item => item?.overallLevel === "WARNING"
        ).length;

        const watchCount = warnings.filter(
            item => item?.overallLevel === "WATCH"
        ).length;

        const verificationConfidence = verifications.length
            ? Math.round(
                this.average(
                    verifications.map(item =>
                        Number(item?.finalConfidence || 0)
                    )
                )
            )
            : 0;

        const infrastructurePressure = infrastructure.length
            ? Math.round(
                this.average(
                    infrastructure.map(item =>
                        Number(
                            item?.infrastructureCriticality ??
                            item?.criticality ??
                            item?.risk ??
                            0
                        )
                    )
                )
            )
            : Math.round(
                this.average(
                    cities.map(city =>
                        Number(city?.infrastructureCriticality || 0)
                    )
                )
            );

        const trafficPressure = traffic.length
            ? Math.round(
                this.average(
                    traffic.map(item =>
                        Number(item?.roadRisk ?? item?.risk ?? 0)
                    )
                )
            )
            : Math.round(
                this.average(
                    cities.map(city => Number(city?.roadRisk || 0))
                )
            );

        let level = "NORMAL";

        if (
            emergencyWarnings.length > 0 ||
            maximumRisk >= 75
        ) {
            level = "EMERGENCY";
        } else if (
            warningCount > 0 ||
            maximumRisk >= 55
        ) {
            level = "WARNING";
        } else if (
            watchCount > 0 ||
            maximumRisk >= 30
        ) {
            level = "WATCH";
        }

        const signals = [];

        if (activeWarnings.length) {
            signals.push(`${activeWarnings.length} active early-warning signals`);
        }

        if (maximumRisk >= 55) {
            signals.push(`High localized risk detected near ${topCityName}`);
        }

        if (infrastructurePressure >= 60) {
            signals.push("Infrastructure pressure is elevated");
        }

        if (trafficPressure >= 50) {
            signals.push("Road network exposure is elevated");
        }

        if (verificationConfidence < 50) {
            signals.push("Forecast source agreement is weak");
        }

        if (radar) {
            signals.push("Radar layer available");
        }

        if (officialForecast) {
            signals.push("Official forecast layer available");
        }

        if (!signals.length) {
            signals.push("No major escalation signal detected");
        }

        return {
            level,
            nationalRisk,
            maximumRisk,
            topCity: topCityName,
            topCityRisk: topCity ? this.getCityRisk(topCity) : 0,

            totalCities: cities.length,
            activeWarnings: activeWarnings.length,
            emergencyWarnings: emergencyWarnings.length,
            warningCount,
            watchCount,

            verificationConfidence,
            infrastructurePressure,
            trafficPressure,

            radarAvailable: Boolean(radar),
            officialForecastAvailable: Boolean(officialForecast),

            signals,
            summary: this.buildSituationSummary({
                level,
                topCityName,
                nationalRisk,
                maximumRisk,
                activeWarnings: activeWarnings.length
            })
        };
    },

    buildSituationSummary({
        level,
        topCityName,
        nationalRisk,
        maximumRisk,
        activeWarnings
    }) {

        if (level === "EMERGENCY") {
            return `Critical national weather condition detected. Highest exposure is near ${topCityName}, with maximum risk ${maximumRisk}%.`;
        }

        if (level === "WARNING") {
            return `Weather risk is increasing near ${topCityName}. National risk is ${nationalRisk}% with ${activeWarnings} active warning signals.`;
        }

        if (level === "WATCH") {
            return `A developing weather pattern is being monitored near ${topCityName}. Enhanced monitoring is recommended.`;
        }

        return `National situation is stable. Average risk is ${nationalRisk}% and no immediate escalation is required.`;
    },

    predictFuture({
        situation,
        cities,
        warnings,
        verifications
    }) {

        const topWarning = this.getWarningByCity(
            situation.topCity,
            warnings
        );

        const topVerification = this.getVerificationByCity(
            situation.topCity,
            verifications
        );

        const probability6h = this.clamp(
            topWarning?.windows?.h6?.probability ??
            topVerification?.recommendedProbability ??
            situation.topCityRisk
        );

        const probability24h = this.clamp(
            topWarning?.windows?.h24?.probability ??
            topVerification?.openMeteo24h ??
            probability6h + 8
        );

        const probability72h = this.clamp(
            topWarning?.windows?.h72?.probability ??
            topVerification?.openMeteo72h ??
            probability24h + 10
        );

        const current = this.clamp(situation.nationalRisk);

        const h6 = this.clamp(
            current * 0.55 +
            probability6h * 0.30 +
            situation.infrastructurePressure * 0.10 +
            situation.trafficPressure * 0.05
        );

        const h24 = this.clamp(
            h6 * 0.65 +
            probability24h * 0.25 +
            situation.maximumRisk * 0.10
        );

        const h72 = this.clamp(
            h24 * 0.65 +
            probability72h * 0.25 +
            situation.maximumRisk * 0.10
        );

        let trend = "STABLE";

        if (h72 >= current + 15) {
            trend = "RISING";
        } else if (h72 <= current - 10) {
            trend = "FALLING";
        }

        const expectedPeakWindow =
            h6 >= h24 && h6 >= h72
                ? "0–6 HOURS"
                : h24 >= h72
                    ? "6–24 HOURS"
                    : "24–72 HOURS";

        return {
            current: Math.round(current),
            h6: Math.round(h6),
            h24: Math.round(h24),
            h72: Math.round(h72),

            rainProbability6h: Math.round(probability6h),
            rainProbability24h: Math.round(probability24h),
            rainProbability72h: Math.round(probability72h),

            trend,
            expectedPeakWindow,
            topCity: situation.topCity
        };
    },

    simulateCounterfactuals({
        situation,
        prediction
    }) {

        const scenarios = [
            {
                id: "CF-STABLE",
                title: "Stable Weather Scenario",
                hypothesis: "Rain probability decreases and no new radar signal appears.",
                probability: this.clamp(
                    100 - prediction.rainProbability24h
                ),
                projectedRisk: this.clamp(
                    prediction.current - 8
                ),
                impact: "LOW",
                requiredAction: "Normal monitoring"
            },

            {
                id: "CF-RAIN",
                title: "Developing Rain Scenario",
                hypothesis: "Humidity and cloud activity continue increasing.",
                probability: this.clamp(
                    prediction.rainProbability6h
                ),
                projectedRisk: this.clamp(
                    prediction.h6
                ),
                impact:
                    prediction.h6 >= 55
                        ? "HIGH"
                        : "MODERATE",
                requiredAction:
                    "Increase monitoring and readiness"
            },

            {
                id: "CF-STORM",
                title: "Severe Storm Scenario",
                hypothesis: "Rain intensity increases and weather sources converge.",
                probability: this.clamp(
                    prediction.rainProbability24h * 0.65 +
                    situation.maximumRisk * 0.35
                ),
                projectedRisk: this.clamp(
                    prediction.h24 + 12
                ),
                impact:
                    prediction.h24 >= 65
                        ? "CRITICAL"
                        : "HIGH",
                requiredAction:
                    "Activate operational warning"
            },

            {
                id: "CF-FLOOD",
                title: "Flood Escalation Scenario",
                hypothesis: "Heavy rainfall overlaps with high terrain and infrastructure exposure.",
                probability: this.clamp(
                    prediction.rainProbability72h * 0.45 +
                    situation.infrastructurePressure * 0.25 +
                    situation.trafficPressure * 0.15 +
                    situation.maximumRisk * 0.15
                ),
                projectedRisk: this.clamp(
                    prediction.h72 + 15
                ),
                impact:
                    prediction.h72 >= 70
                        ? "CRITICAL"
                        : "HIGH",
                requiredAction:
                    "Prepare civil defense and road response"
            }
        ];

        return scenarios
            .map(scenario => ({
                ...scenario,
                probability: Math.round(scenario.probability),
                projectedRisk: Math.round(scenario.projectedRisk)
            }))
            .sort((a, b) => b.probability - a.probability);
    },

    selectBestScenario(counterfactuals = []) {
        if (!counterfactuals.length) return null;

        return counterfactuals.reduce((best, scenario) => {
            const bestScore =
                best.probability * 0.55 +
                best.projectedRisk * 0.45;

            const scenarioScore =
                scenario.probability * 0.55 +
                scenario.projectedRisk * 0.45;

            return scenarioScore > bestScore
                ? scenario
                : best;
        });
    },

    makeDecision({
        situation,
        prediction,
        selectedScenario
    }) {

        const projectedRisk =
            selectedScenario?.projectedRisk ||
            prediction.h24;

        if (
            situation.level === "EMERGENCY" ||
            projectedRisk >= 80
        ) {
            return {
                code: "EMERGENCY_RESPONSE",
                level: "EMERGENCY",
                priority: "CRITICAL",
                action:
                    "Activate national emergency coordination and deploy response units.",
                humanApprovalRequired: true
            };
        }

        if (
            situation.level === "WARNING" ||
            projectedRisk >= 60
        ) {
            return {
                code: "OPERATIONAL_WARNING",
                level: "WARNING",
                priority: "HIGH",
                action:
                    "Raise operational readiness and monitor valleys, roads and critical infrastructure.",
                humanApprovalRequired: true
            };
        }

        if (
            situation.level === "WATCH" ||
            projectedRisk >= 35
        ) {
            return {
                code: "ENHANCED_WATCH",
                level: "WATCH",
                priority: "MEDIUM",
                action:
                    "Increase data refresh frequency and maintain enhanced monitoring.",
                humanApprovalRequired: false
            };
        }

        return {
            code: "NORMAL_MONITORING",
            level: "NORMAL",
            priority: "LOW",
            action:
                "Continue normal autonomous monitoring.",
            humanApprovalRequired: false
        };
    },

    buildNationalPlan({
        situation,
        prediction,
        decision,
        selectedScenario
    }) {

        const phases = [];

        phases.push({
            phase: 1,
            name: "Continuous Observation",
            status: "ACTIVE",
            owner: "AI Monitoring",
            action:
                "Refresh weather, radar and warning sources continuously."
        });

        if (decision.priority === "MEDIUM") {
            phases.push({
                phase: 2,
                name: "Enhanced Monitoring",
                status: "PLANNED",
                owner: "National Operations",
                action:
                    `Increase monitoring near ${situation.topCity}.`
            });
        }

        if (
            decision.priority === "HIGH" ||
            decision.priority === "CRITICAL"
        ) {
            phases.push({
                phase: 2,
                name: "Operational Readiness",
                status: "PLANNED",
                owner: "Municipality and Roads",
                action:
                    `Raise readiness around ${situation.topCity}.`
            });

            phases.push({
                phase: 3,
                name: "Critical Infrastructure Watch",
                status: "PLANNED",
                owner: "Infrastructure Operations",
                action:
                    "Monitor roads, hospitals, valleys and drainage systems."
            });
        }

        if (decision.priority === "CRITICAL") {
            phases.push({
                phase: 4,
                name: "Emergency Coordination",
                status: "PENDING_APPROVAL",
                owner: "Civil Defense",
                action:
                    "Prepare field units and emergency communication channels."
            });
        }

        return {
            id: `V28-PLAN-${Date.now()}`,
            city: situation.topCity,
            scenario: selectedScenario?.title || "--",
            priority: decision.priority,
            status:
                decision.humanApprovalRequired
                    ? "AWAITING_APPROVAL"
                    : "AUTONOMOUSLY_ACTIVE",
            eta:
                decision.priority === "CRITICAL"
                    ? "Immediate"
                    : decision.priority === "HIGH"
                        ? "30 minutes"
                        : decision.priority === "MEDIUM"
                            ? "60 minutes"
                            : "Continuous",
            phases
        };
    },

    calculateConfidence({
        situation,
        prediction,
        verifications,
        warnings
    }) {

        const sourceConfidence = verifications.length
            ? this.average(
                verifications.map(item =>
                    Number(item?.finalConfidence || 0)
                )
            )
            : 35;

        const warningConfidence = warnings.length
            ? this.average(
                warnings.map(item =>
                    Number(item?.confidence || 0)
                )
            )
            : 40;

        const dataCoverage = this.clamp(
            situation.totalCities * 8 +
            verifications.length * 6 +
            warnings.length * 4
        );

        const predictionConsistency = this.clamp(
            100 -
            Math.abs(
                prediction.h72 -
                prediction.h24
            ) * 0.8
        );

        return Math.round(
            sourceConfidence * 0.35 +
            warningConfidence * 0.25 +
            dataCoverage * 0.20 +
            predictionConsistency * 0.20
        );
    },

    explain({
        situation,
        prediction,
        counterfactuals,
        selectedScenario,
        decision,
        plan
    }) {

        const lines = [
            `Situation level: ${situation.level}`,
            `National average risk: ${situation.nationalRisk}%`,
            `Maximum localized risk: ${situation.maximumRisk}%`,
            `Highest exposure city: ${situation.topCity}`,
            `Active warning signals: ${situation.activeWarnings}`,
            `Forecast verification confidence: ${situation.verificationConfidence}%`,
            `Predicted risk after 6 hours: ${prediction.h6}%`,
            `Predicted risk after 24 hours: ${prediction.h24}%`,
            `Predicted risk after 72 hours: ${prediction.h72}%`,
            `Expected trend: ${prediction.trend}`,
            `Selected scenario: ${selectedScenario?.title || "--"}`,
            `Scenario probability: ${selectedScenario?.probability || 0}%`,
            `Projected scenario risk: ${selectedScenario?.projectedRisk || 0}%`,
            `Decision: ${decision.code}`,
            `Priority: ${decision.priority}`,
            `Plan ID: ${plan.id}`,
            `Plan status: ${plan.status}`
        ];

        situation.signals.forEach(signal => {
            lines.push(`Signal: ${signal}`);
        });

        counterfactuals.slice(0, 3).forEach(scenario => {
            lines.push(
                `Alternative: ${scenario.title} — ${scenario.probability}%`
            );
        });

        return lines;
    },

    remember(result) {
        this.memory.unshift({
            generatedAt: result.generatedAt,
            situation: result.situation,
            prediction: result.prediction,
            selectedScenario: result.selectedScenario,
            decision: result.decision,
            confidence: result.confidence
        });

        if (this.memory.length > 100) {
            this.memory.pop();
        }
    },

    learnFromOutcome({
        predictedRisk,
        actualRisk,
        predictionCorrect
    } = {}) {

        if (
            predictedRisk == null ||
            actualRisk == null
        ) {
            return null;
        }

        const error =
            Number(actualRisk) -
            Number(predictedRisk);

        const learningRate = 0.01;

        this.learnedWeights.forecast6h = this.clamp(
            this.learnedWeights.forecast6h +
            error * learningRate / 100,
            0.05,
            0.40
        );

        this.learnedWeights.flood = this.clamp(
            this.learnedWeights.flood +
            error * learningRate / 120,
            0.05,
            0.40
        );

        return {
            error: Math.round(error),
            predictionCorrect: Boolean(predictionCorrect),
            updatedWeights: {
                ...this.learnedWeights
            }
        };
    },

    renderAll() {
        this.renderCore();
        this.renderSituation();
        this.renderPrediction();
        this.renderCounterfactuals();
        this.renderPlan();
        this.renderThinking();
    },

    renderCore() {
        const panel =
            document.getElementById("autonomousCognitivePanel") ||
            document.getElementById("autonomousBrainPanel");

        if (!panel || !this.lastResult) return;

        const result = this.lastResult;

        panel.innerHTML = `
            <div class="item success">
                <h3>Autonomous Cognitive Engine V28</h3>

                Status: ${result.status}<br>
                Situation: ${result.situation.level}<br>
                Top City: ${result.situation.topCity}<br>
                Selected Scenario: ${result.selectedScenario?.title || "--"}<br>
                Decision: ${result.decision.code}<br>
                Priority: ${result.decision.priority}<br>
                Cognitive Confidence: ${result.confidence}%<br>
                Plan: ${result.plan.id}<br>
                Processing: ${result.processingMs} ms<br>
                Updated: ${result.generatedAt}
            </div>
        `;
    },

    renderSituation() {
        const panel =
            document.getElementById("situationAwarenessPanel");

        if (!panel || !this.lastResult) return;

        const situation = this.lastResult.situation;

        panel.innerHTML = `
            <div class="item ${
                situation.level === "EMERGENCY"
                    ? "danger"
                    : situation.level === "WARNING"
                        ? "warning"
                        : "success"
            }">
                <h3>Situation Awareness</h3>

                Level: ${situation.level}<br>
                National Risk: ${situation.nationalRisk}%<br>
                Maximum Risk: ${situation.maximumRisk}%<br>
                Top City: ${situation.topCity}<br>
                Active Warnings: ${situation.activeWarnings}<br>
                Infrastructure Pressure: ${situation.infrastructurePressure}%<br>
                Traffic Pressure: ${situation.trafficPressure}%<br><br>

                ${situation.summary}
            </div>
        `;
    },

    renderPrediction() {
        const panel =
            document.getElementById("riskPredictionV28Panel") ||
            document.getElementById("riskPredictionPanel");

        if (!panel || !this.lastResult) return;

        const prediction = this.lastResult.prediction;

        panel.innerHTML = `
            <div class="item success">
                <h3>Predictive Reasoning V28</h3>

                Current Risk: ${prediction.current}%<br>
                6 Hours: ${prediction.h6}%<br>
                24 Hours: ${prediction.h24}%<br>
                72 Hours: ${prediction.h72}%<br>
                Trend: ${prediction.trend}<br>
                Peak Window: ${prediction.expectedPeakWindow}<br><br>

                Rain Probability 6h: ${prediction.rainProbability6h}%<br>
                Rain Probability 24h: ${prediction.rainProbability24h}%<br>
                Rain Probability 72h: ${prediction.rainProbability72h}%
            </div>
        `;
    },

    renderCounterfactuals() {
        const panel =
            document.getElementById("counterfactualPanel");

        if (!panel || !this.lastResult) return;

        panel.innerHTML =
            this.lastResult.counterfactuals.map(scenario => `
                <div class="item ${
                    scenario.impact === "CRITICAL"
                        ? "danger"
                        : scenario.impact === "HIGH"
                            ? "warning"
                            : "success"
                }">
                    <b>${scenario.title}</b><br>
                    Probability: ${scenario.probability}%<br>
                    Projected Risk: ${scenario.projectedRisk}%<br>
                    Impact: ${scenario.impact}<br>
                    Hypothesis: ${scenario.hypothesis}<br>
                    Action: ${scenario.requiredAction}
                </div>
            `).join("");
    },

    renderPlan() {
        const panel =
            document.getElementById("nationalPlannerPanel");

        if (!panel || !this.lastResult) return;

        const plan = this.lastResult.plan;

        panel.innerHTML = `
            <div class="item success">
                <h3>${plan.id}</h3>

                City: ${plan.city}<br>
                Scenario: ${plan.scenario}<br>
                Priority: ${plan.priority}<br>
                Status: ${plan.status}<br>
                ETA: ${plan.eta}
            </div>

            ${plan.phases.map(phase => `
                <div class="item">
                    <b>Phase ${phase.phase}: ${phase.name}</b><br>
                    Status: ${phase.status}<br>
                    Owner: ${phase.owner}<br>
                    Action: ${phase.action}
                </div>
            `).join("")}
        `;
    },

    renderThinking() {
        const panel =
            document.getElementById("aiThinkingPanel");

        if (!panel || !this.lastResult) return;

        panel.innerHTML =
            this.lastResult.explanation.map(line => `
                <div class="item success">
                    ${line}
                </div>
            `).join("");
    }
};
