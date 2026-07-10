window.RG29 = window.RG29 || {};

RG29.AutonomousCognitiveEngine = {

    version: "29.0",

    lastResult: null,
    memory: [],
    beliefs: [],
    hypotheses: [],
    reflections: [],

    settings: {
        maxMemory: 100,
        maxHypotheses: 8,
        minEvidenceConfidence: 20,
        humanApprovalThreshold: 60
    },

    clamp(value, min = 0, max = 100) {
        const number = Number(value);

        if (!Number.isFinite(number)) {
            return min;
        }

        return Math.min(max, Math.max(min, number));
    },

    average(values = []) {
        const valid = values
            .map(Number)
            .filter(Number.isFinite);

        if (!valid.length) {
            return 0;
        }

        return valid.reduce((sum, value) => sum + value, 0) / valid.length;
    },

    normalizeCityName(value = "") {
        return String(value).trim().toLowerCase();
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
        return [...cities]
            .sort(
                (a, b) =>
                    this.getCityRisk(b) -
                    this.getCityRisk(a)
            )[0] || null;
    },

    getWarningByCity(cityName, warnings = []) {
        const target = this.normalizeCityName(cityName);

        return warnings.find(item =>
            this.normalizeCityName(
                item?.city ||
                item?.cityName ||
                item?.name
            ) === target
        ) || null;
    },

    getVerificationByCity(cityName, verifications = []) {
        const target = this.normalizeCityName(cityName);

        return verifications.find(item =>
            this.normalizeCityName(
                item?.city ||
                item?.cityName ||
                item?.name
            ) === target
        ) || null;
    },

    run({
        cities = [],
        warnings = [],
        verifications = [],
        infrastructure = [],
        traffic = [],
        radar = null,
        officialForecast = null,
        historicalCases = [],
        previousOutcome = null
    } = {}) {

        const startedAt = performance.now();

        const observation = this.observe({
            cities,
            warnings,
            verifications,
            infrastructure,
            traffic,
            radar,
            officialForecast
        });

        const situation = this.understandSituation(observation);

        const hypotheses = this.generateHypotheses({
            observation,
            situation
        });

        const beliefs = this.evaluateBeliefs({
            hypotheses,
            observation,
            situation
        });

        const debate = this.runDecisionDebate({
            observation,
            situation,
            beliefs
        });

        const simulation = this.simulateFuture({
            observation,
            situation,
            beliefs,
            debate
        });

        const decision = this.chooseDecision({
            situation,
            beliefs,
            debate,
            simulation
        });

        const plan = this.buildNationalPlan({
            situation,
            decision,
            simulation
        });

        const memoryMatch = this.searchMemory({
            situation,
            beliefs,
            historicalCases
        });

        const reflection = this.selfReflect({
            situation,
            beliefs,
            debate,
            simulation,
            decision,
            previousOutcome
        });

        const confidence = this.calculateConfidence({
            observation,
            beliefs,
            debate,
            simulation
        });

        const knowledgeGraph = this.buildKnowledgeGraph({
            observation,
            situation,
            beliefs,
            simulation,
            decision,
            plan
        });

        this.lastResult = {
            engine: "Autonomous Cognitive Engine V29",
            version: this.version,
            status: "COMPLETED",

            generatedAt: new Date().toLocaleString("ar-SA"),
            processingMs: Math.round(
                performance.now() - startedAt
            ),

            observation,
            situation,
            hypotheses,
            beliefs,
            debate,
            simulation,
            decision,
            plan,
            memoryMatch,
            reflection,
            confidence,
            knowledgeGraph
        };

        this.hypotheses = hypotheses;
        this.beliefs = beliefs;
        this.reflections.unshift(reflection);

        if (this.reflections.length > 50) {
            this.reflections.pop();
        }

        this.remember(this.lastResult);
        this.renderAll();

        return this.lastResult;
    },

    observe({
        cities,
        warnings,
        verifications,
        infrastructure,
        traffic,
        radar,
        officialForecast
    }) {

        const topCity = this.getTopCity(cities);
        const cityRisks = cities.map(city =>
            this.getCityRisk(city)
        );

        const averageRisk = Math.round(
            this.average(cityRisks)
        );

        const maximumRisk = cityRisks.length
            ? Math.round(Math.max(...cityRisks))
            : 0;

        const infrastructurePressure =
            infrastructure.length
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
                            Number(
                                city?.infrastructureCriticality || 0
                            )
                        )
                    )
                );

        const trafficPressure =
            traffic.length
                ? Math.round(
                    this.average(
                        traffic.map(item =>
                            Number(
                                item?.roadRisk ??
                                item?.risk ??
                                0
                            )
                        )
                    )
                )
                : Math.round(
                    this.average(
                        cities.map(city =>
                            Number(city?.roadRisk || 0)
                        )
                    )
                );

        const activeWarnings = warnings.filter(item =>
            ["WATCH", "WARNING", "EMERGENCY"]
                .includes(item?.overallLevel)
        );

        return {
            cities,
            warnings,
            verifications,
            infrastructure,
            traffic,
            radar,
            officialForecast,

            cityCount: cities.length,
            topCity: topCity?.name || "--",
            topCityRisk: topCity
                ? this.getCityRisk(topCity)
                : 0,

            averageRisk,
            maximumRisk,
            infrastructurePressure,
            trafficPressure,

            activeWarnings: activeWarnings.length,
            radarAvailable: Boolean(radar),
            officialForecastAvailable:
                Boolean(officialForecast),

            timestamp:
                new Date().toLocaleTimeString("ar-SA")
        };
    },

    understandSituation(observation) {

        let level = "NORMAL";

        if (
            observation.maximumRisk >= 75 ||
            observation.warnings.some(
                item =>
                    item?.overallLevel === "EMERGENCY"
            )
        ) {
            level = "EMERGENCY";

        } else if (
            observation.maximumRisk >= 55 ||
            observation.warnings.some(
                item =>
                    item?.overallLevel === "WARNING"
            )
        ) {
            level = "WARNING";

        } else if (
            observation.maximumRisk >= 30 ||
            observation.warnings.some(
                item =>
                    item?.overallLevel === "WATCH"
            )
        ) {
            level = "WATCH";
        }

        const signals = [];

        if (observation.activeWarnings > 0) {
            signals.push(
                `${observation.activeWarnings} active warning signals`
            );
        }

        if (observation.maximumRisk >= 50) {
            signals.push(
                `Localized elevated risk near ${observation.topCity}`
            );
        }

        if (observation.infrastructurePressure >= 60) {
            signals.push(
                "Infrastructure pressure is elevated"
            );
        }

        if (observation.trafficPressure >= 50) {
            signals.push(
                "Road network exposure is elevated"
            );
        }

        if (observation.radarAvailable) {
            signals.push("Radar evidence available");
        }

        if (
            observation.officialForecastAvailable
        ) {
            signals.push(
                "Official forecast evidence available"
            );
        }

        if (!signals.length) {
            signals.push(
                "No major escalation evidence detected"
            );
        }

        return {
            level,
            topCity: observation.topCity,
            nationalRisk: observation.averageRisk,
            maximumRisk: observation.maximumRisk,
            infrastructurePressure:
                observation.infrastructurePressure,
            trafficPressure:
                observation.trafficPressure,
            activeWarnings:
                observation.activeWarnings,
            signals,

            summary:
                this.buildSituationSummary(
                    level,
                    observation
                )
        };
    },

    buildSituationSummary(level, observation) {

        if (level === "EMERGENCY") {
            return `Critical weather condition detected near ${observation.topCity}. Immediate coordination may be required.`;
        }

        if (level === "WARNING") {
            return `Weather risk is increasing near ${observation.topCity}. Operational readiness should be raised.`;
        }

        if (level === "WATCH") {
            return `Developing weather conditions are being monitored near ${observation.topCity}.`;
        }

        return `National situation is stable. Average risk is ${observation.averageRisk}%.`;
    },

    generateHypotheses({
        observation,
        situation
    }) {

        const cityWarning = this.getWarningByCity(
            situation.topCity,
            observation.warnings
        );

        const cityVerification =
            this.getVerificationByCity(
                situation.topCity,
                observation.verifications
            );

        const rain6h = this.clamp(
            cityWarning?.windows?.h6?.probability ??
            cityVerification?.openMeteo6h ??
            cityVerification?.recommendedProbability ??
            0
        );

        const rain24h = this.clamp(
            cityWarning?.windows?.h24?.probability ??
            cityVerification?.openMeteo24h ??
            rain6h
        );

        const hypotheses = [
            {
                id: "H-STABLE",
                title: "Stable Weather Pattern",
                statement:
                    "Current conditions will remain stable without operational escalation.",
                priorConfidence:
                    this.clamp(100 - rain24h),
                supportingEvidence: [
                    rain6h < 20
                        ? "Low short-term rain probability"
                        : null,
                    situation.maximumRisk < 35
                        ? "Maximum risk remains limited"
                        : null
                ].filter(Boolean),
                contradictingEvidence: [
                    situation.activeWarnings > 0
                        ? "Active warning signals exist"
                        : null
                ].filter(Boolean)
            },

            {
                id: "H-RAIN",
                title: "Rain Development",
                statement:
                    "Rainfall may develop within the next six hours.",
                priorConfidence:
                    this.clamp(rain6h),
                supportingEvidence: [
                    rain6h >= 20
                        ? "Short-term rain probability detected"
                        : null,
                    observation.radarAvailable
                        ? "Radar source is available"
                        : null
                ].filter(Boolean),
                contradictingEvidence: [
                    rain6h < 10
                        ? "Rain probability remains weak"
                        : null
                ].filter(Boolean)
            },

            {
                id: "H-STORM",
                title: "Convective Storm Development",
                statement:
                    "Atmospheric instability may produce localized severe weather.",
                priorConfidence:
                    this.clamp(
                        rain24h * 0.55 +
                        situation.maximumRisk * 0.45
                    ),
                supportingEvidence: [
                    situation.maximumRisk >= 40
                        ? "Localized risk is elevated"
                        : null,
                    situation.infrastructurePressure >= 50
                        ? "Infrastructure exposure is significant"
                        : null
                ].filter(Boolean),
                contradictingEvidence: [
                    rain24h < 20
                        ? "Forecast probability remains low"
                        : null
                ].filter(Boolean)
            },

            {
                id: "H-FLOOD",
                title: "Flood Escalation",
                statement:
                    "Rainfall and terrain exposure may produce flash-flood risk.",
                priorConfidence:
                    this.clamp(
                        situation.maximumRisk * 0.40 +
                        situation.infrastructurePressure * 0.25 +
                        situation.trafficPressure * 0.15 +
                        rain24h * 0.20
                    ),
                supportingEvidence: [
                    situation.infrastructurePressure >= 55
                        ? "Infrastructure exposure is elevated"
                        : null,
                    situation.trafficPressure >= 45
                        ? "Road exposure is elevated"
                        : null
                ].filter(Boolean),
                contradictingEvidence: [
                    rain24h < 15
                        ? "Rainfall probability is currently low"
                        : null
                ].filter(Boolean)
            },

            {
                id: "H-DATA-GAP",
                title: "Insufficient Evidence",
                statement:
                    "Additional verified observations are required before escalation.",
                priorConfidence:
                    this.clamp(
                        observation.verifications.length === 0
                            ? 75
                            : 20
                    ),
                supportingEvidence: [
                    observation.verifications.length === 0
                        ? "No verification records available"
                        : null,
                    !observation.officialForecastAvailable
                        ? "Official forecast API is unavailable"
                        : null
                ].filter(Boolean),
                contradictingEvidence: [
                    observation.verifications.length > 3
                        ? "Multiple verification records available"
                        : null
                ].filter(Boolean)
            }
        ];

        return hypotheses
            .map(item => ({
                ...item,
                priorConfidence:
                    Math.round(item.priorConfidence)
            }))
            .sort(
                (a, b) =>
                    b.priorConfidence -
                    a.priorConfidence
            )
            .slice(
                0,
                this.settings.maxHypotheses
            );
    },

    evaluateBeliefs({
        hypotheses,
        observation,
        situation
    }) {

        return hypotheses
            .map(hypothesis => {

                const supportScore =
                    hypothesis.supportingEvidence.length * 8;

                const contradictionPenalty =
                    hypothesis.contradictingEvidence.length * 10;

                const sourceCoverage =
                    this.clamp(
                        observation.verifications.length * 8 +
                        observation.activeWarnings * 6 +
                        (
                            observation.radarAvailable
                                ? 10
                                : 0
                        ) +
                        (
                            observation.officialForecastAvailable
                                ? 12
                                : 0
                        )
                    );

                const confidence = this.clamp(
                    hypothesis.priorConfidence * 0.60 +
                    supportScore +
                    sourceCoverage * 0.20 -
                    contradictionPenalty
                );

                let status = "UNCERTAIN";

                if (confidence >= 70) {
                    status = "SUPPORTED";
                } else if (confidence < 35) {
                    status = "REJECTED";
                }

                return {
                    hypothesisId: hypothesis.id,
                    title: hypothesis.title,
                    statement: hypothesis.statement,

                    confidence:
                        Math.round(confidence),

                    status,

                    supportingEvidence:
                        hypothesis.supportingEvidence,

                    contradictingEvidence:
                        hypothesis.contradictingEvidence,

                    relevance:
                        hypothesis.title.includes("Flood")
                            ? situation.infrastructurePressure
                            : situation.maximumRisk
                };
            })
            .sort(
                (a, b) =>
                    b.confidence -
                    a.confidence
            );
    },

    runDecisionDebate({
        situation,
        beliefs
    }) {

        const strongestBelief =
            beliefs[0] || null;

        const agents = [
            {
                name: "Safety Brain",
                recommendation:
                    situation.level === "EMERGENCY" ||
                    situation.level === "WARNING"
                        ? "ESCALATE"
                        : "MONITOR",
                score:
                    this.clamp(
                        situation.maximumRisk + 15
                    ),
                reason:
                    "Prioritizes public safety and worst-case exposure."
            },

            {
                name: "Evidence Brain",
                recommendation:
                    strongestBelief?.confidence >= 65
                        ? (
                            strongestBelief.title.includes("Stable")
                                ? "MONITOR"
                                : "ESCALATE"
                        )
                        : "COLLECT_MORE_DATA",
                score:
                    strongestBelief?.confidence || 40,
                reason:
                    "Prioritizes verified evidence and belief confidence."
            },

            {
                name: "Operations Brain",
                recommendation:
                    situation.infrastructurePressure >= 60
                        ? "RAISE_READINESS"
                        : "MONITOR",
                score:
                    this.clamp(
                        situation.infrastructurePressure
                    ),
                reason:
                    "Prioritizes infrastructure and road readiness."
            },

            {
                name: "Conservative Brain",
                recommendation:
                    situation.activeWarnings > 0
                        ? "RAISE_READINESS"
                        : "MONITOR",
                score:
                    this.clamp(
                        50 +
                        situation.activeWarnings * 10
                    ),
                reason:
                    "Avoids unnecessary escalation unless warnings exist."
            }
        ];

        const votes = {};

        agents.forEach(agent => {
            votes[agent.recommendation] =
                (votes[agent.recommendation] || 0) +
                agent.score;
        });

        const winner = Object.entries(votes)
            .sort((a, b) => b[1] - a[1])[0];

        return {
            agents,
            votes,
            winner:
                winner?.[0] ||
                "COLLECT_MORE_DATA",
            winningScore:
                Math.round(winner?.[1] || 0),
            strongestBelief:
                strongestBelief?.title || "--"
        };
    },

    simulateFuture({
        observation,
        situation,
        beliefs,
        debate
    }) {

        const floodBelief =
            beliefs.find(item =>
                item.title.includes("Flood")
            );

        const rainBelief =
            beliefs.find(item =>
                item.title.includes("Rain")
            );

        const stormBelief =
            beliefs.find(item =>
                item.title.includes("Storm")
            );

        const current =
            this.clamp(situation.nationalRisk);

        const h6 = this.clamp(
            current * 0.55 +
            (rainBelief?.confidence || 0) * 0.25 +
            situation.maximumRisk * 0.20
        );

        const h24 = this.clamp(
            h6 * 0.55 +
            (stormBelief?.confidence || 0) * 0.25 +
            situation.infrastructurePressure * 0.20
        );

        const h72 = this.clamp(
            h24 * 0.55 +
            (floodBelief?.confidence || 0) * 0.25 +
            situation.trafficPressure * 0.20
        );

        let trend = "STABLE";

        if (h72 >= current + 15) {
            trend = "RISING";
        } else if (h72 <= current - 10) {
            trend = "FALLING";
        }

        const scenarios = [
            {
                name: "Baseline",
                probability:
                    this.clamp(
                        100 -
                        Math.max(h6, h24)
                    ),
                projectedRisk:
                    this.clamp(current - 5)
            },

            {
                name: "Rain Development",
                probability:
                    rainBelief?.confidence || 0,
                projectedRisk:
                    Math.round(h6)
            },

            {
                name: "Operational Warning",
                probability:
                    stormBelief?.confidence || 0,
                projectedRisk:
                    Math.round(h24)
            },

            {
                name: "Flood Escalation",
                probability:
                    floodBelief?.confidence || 0,
                projectedRisk:
                    Math.round(h72)
            }
        ];

        const selectedScenario = scenarios
            .map(item => ({
                ...item,
                score:
                    item.probability * 0.55 +
                    item.projectedRisk * 0.45
            }))
            .sort(
                (a, b) =>
                    b.score -
                    a.score
            )[0];

        return {
            current: Math.round(current),
            h6: Math.round(h6),
            h24: Math.round(h24),
            h72: Math.round(h72),
            trend,
            debateRecommendation:
                debate.winner,
            scenarios,
            selectedScenario
        };
    },

    chooseDecision({
        situation,
        beliefs,
        debate,
        simulation
    }) {

        const projectedRisk =
            simulation.selectedScenario
                ?.projectedRisk || 0;

        const topBelief =
            beliefs[0] || null;

        if (
            situation.level === "EMERGENCY" ||
            projectedRisk >= 80
        ) {
            return {
                code: "EMERGENCY_RESPONSE",
                priority: "CRITICAL",
                action:
                    "Activate national emergency coordination.",
                reason:
                    "Projected risk exceeds emergency threshold.",
                humanApprovalRequired: true
            };
        }

        if (
            situation.level === "WARNING" ||
            projectedRisk >= 60 ||
            debate.winner === "ESCALATE"
        ) {
            return {
                code: "OPERATIONAL_WARNING",
                priority: "HIGH",
                action:
                    "Raise operational readiness and monitor critical locations.",
                reason:
                    "Warning conditions or escalation vote detected.",
                humanApprovalRequired: true
            };
        }

        if (
            situation.level === "WATCH" ||
            projectedRisk >= 35 ||
            debate.winner === "RAISE_READINESS"
        ) {
            return {
                code: "ENHANCED_WATCH",
                priority: "MEDIUM",
                action:
                    "Increase observation frequency and readiness.",
                reason:
                    "Developing situation requires enhanced monitoring.",
                humanApprovalRequired: false
            };
        }

        if (
            debate.winner === "COLLECT_MORE_DATA" ||
            topBelief?.status === "UNCERTAIN"
        ) {
            return {
                code: "COLLECT_MORE_DATA",
                priority: "LOW",
                action:
                    "Acquire additional verified observations before escalation.",
                reason:
                    "Evidence confidence is insufficient.",
                humanApprovalRequired: false
            };
        }

        return {
            code: "NORMAL_MONITORING",
            priority: "LOW",
            action:
                "Continue normal autonomous monitoring.",
            reason:
                "No significant escalation evidence detected.",
            humanApprovalRequired: false
        };
    },

    buildNationalPlan({
        situation,
        decision,
        simulation
    }) {

        const phases = [
            {
                phase: 1,
                name: "Observe",
                status: "ACTIVE",
                owner: "AI Monitoring",
                action:
                    "Refresh weather, warning and verification data."
            },

            {
                phase: 2,
                name: "Validate",
                status: "ACTIVE",
                owner: "Forecast Verification",
                action:
                    "Compare official and global data sources."
            }
        ];

        if (
            decision.priority === "MEDIUM" ||
            decision.priority === "HIGH" ||
            decision.priority === "CRITICAL"
        ) {
            phases.push({
                phase: 3,
                name: "Raise Readiness",
                status: "PLANNED",
                owner: "National Operations",
                action:
                    `Increase readiness near ${situation.topCity}.`
            });
        }

        if (
            decision.priority === "HIGH" ||
            decision.priority === "CRITICAL"
        ) {
            phases.push({
                phase: 4,
                name: "Infrastructure Watch",
                status: "PLANNED",
                owner: "Roads and Municipality",
                action:
                    "Monitor valleys, roads, hospitals and drainage."
            });
        }

        if (decision.priority === "CRITICAL") {
            phases.push({
                phase: 5,
                name: "Emergency Coordination",
                status: "PENDING_APPROVAL",
                owner: "Civil Defense",
                action:
                    "Prepare emergency response units."
            });
        }

        return {
            id: `V29-PLAN-${Date.now()}`,
            city: situation.topCity,
            decision: decision.code,
            priority: decision.priority,
            selectedScenario:
                simulation.selectedScenario?.name || "--",

            status:
                decision.humanApprovalRequired
                    ? "AWAITING_HUMAN_APPROVAL"
                    : "AUTONOMOUSLY_ACTIVE",

            phases
        };
    },

    searchMemory({
        situation,
        beliefs,
        historicalCases
    }) {

        const combinedMemory = [
            ...this.memory,
            ...historicalCases
        ];

        if (!combinedMemory.length) {
            return {
                found: false,
                similarity: 0,
                message:
                    "No similar historical case available."
            };
        }

        const matches = combinedMemory.map(item => {

            const previousSituation =
                item?.situation || {};

            const riskDifference =
                Math.abs(
                    Number(
                        previousSituation.nationalRisk || 0
                    ) -
                    Number(situation.nationalRisk || 0)
                );

            const levelMatch =
                previousSituation.level ===
                situation.level
                    ? 30
                    : 0;

            const cityMatch =
                previousSituation.topCity ===
                situation.topCity
                    ? 30
                    : 0;

            const riskSimilarity =
                this.clamp(
                    40 - riskDifference
                );

            return {
                item,
                similarity:
                    levelMatch +
                    cityMatch +
                    riskSimilarity
            };
        });

        const best = matches.sort(
            (a, b) =>
                b.similarity -
                a.similarity
        )[0];

        return {
            found: best.similarity >= 45,
            similarity:
                Math.round(
                    best.similarity
                ),
            previousSituation:
                best.item?.situation || null,
            previousDecision:
                best.item?.decision || null,
            message:
                best.similarity >= 45
                    ? "A similar historical situation was found."
                    : "No sufficiently similar historical situation found."
        };
    },

    selfReflect({
        situation,
        beliefs,
        debate,
        simulation,
        decision,
        previousOutcome
    }) {

        const questions = [];
        const lessons = [];

        if (
            beliefs[0]?.confidence < 60
        ) {
            questions.push(
                "Is current evidence sufficient?"
            );

            lessons.push(
                "Increase verified source coverage."
            );
        }

        if (
            debate.winner === "COLLECT_MORE_DATA"
        ) {
            questions.push(
                "Which source is missing?"
            );

            lessons.push(
                "Prioritize official forecast and radar verification."
            );
        }

        if (
            simulation.trend === "RISING" &&
            decision.priority === "LOW"
        ) {
            questions.push(
                "Is the decision too conservative?"
            );

            lessons.push(
                "Review decision thresholds for rising-risk patterns."
            );
        }

        if (previousOutcome) {
            const predicted =
                Number(
                    previousOutcome.predictedRisk || 0
                );

            const actual =
                Number(
                    previousOutcome.actualRisk || 0
                );

            const error =
                Math.abs(actual - predicted);

            questions.push(
                `Previous prediction error was ${error}%.`
            );

            if (error > 20) {
                lessons.push(
                    "Reduce confidence and recalibrate predictive weights."
                );
            } else {
                lessons.push(
                    "Prediction performance was acceptable."
                );
            }
        }

        if (!questions.length) {
            questions.push(
                "No major reasoning weakness detected."
            );
        }

        if (!lessons.length) {
            lessons.push(
                "Maintain current cognitive strategy."
            );
        }

        return {
            time:
                new Date().toLocaleTimeString("ar-SA"),
            questions,
            lessons,
            confidenceAdjustment:
                beliefs[0]?.confidence < 50
                    ? -5
                    : 0
        };
    },

    calculateConfidence({
        observation,
        beliefs,
        debate,
        simulation
    }) {

        const sourceCoverage = this.clamp(
            observation.verifications.length * 8 +
            observation.activeWarnings * 6 +
            (
                observation.radarAvailable
                    ? 12
                    : 0
            ) +
            (
                observation.officialForecastAvailable
                    ? 14
                    : 0
            )
        );

        const beliefConfidence =
            beliefs.length
                ? this.average(
                    beliefs.slice(0, 3)
                        .map(item =>
                            item.confidence
                        )
                )
                : 0;

        const debateAgreement = this.clamp(
            debate.winningScore / 3
        );

        const simulationConsistency = this.clamp(
            100 -
            Math.abs(
                simulation.h72 -
                simulation.h24
            )
        );

        return Math.round(
            sourceCoverage * 0.25 +
            beliefConfidence * 0.35 +
            debateAgreement * 0.20 +
            simulationConsistency * 0.20
        );
    },

    buildKnowledgeGraph({
        observation,
        situation,
        beliefs,
        simulation,
        decision,
        plan
    }) {

        const nodes = [
            {
                id: "weather",
                label: "Weather Data",
                type: "source"
            },
            {
                id: "warnings",
                label: "Early Warnings",
                type: "source"
            },
            {
                id: "infrastructure",
                label: "Infrastructure",
                type: "risk"
            },
            {
                id: "traffic",
                label: "Traffic",
                type: "risk"
            },
            {
                id: "situation",
                label: situation.level,
                type: "situation"
            },
            {
                id: "belief",
                label:
                    beliefs[0]?.title || "Unknown",
                type: "belief"
            },
            {
                id: "prediction",
                label:
                    `${simulation.h24}% Risk`,
                type: "prediction"
            },
            {
                id: "decision",
                label: decision.code,
                type: "decision"
            },
            {
                id: "plan",
                label: plan.id,
                type: "plan"
            }
        ];

        const edges = [
            {
                from: "weather",
                to: "situation",
                relation: "supports"
            },
            {
                from: "warnings",
                to: "situation",
                relation: "influences"
            },
            {
                from: "infrastructure",
                to: "situation",
                relation: "increases-risk"
            },
            {
                from: "traffic",
                to: "situation",
                relation: "increases-exposure"
            },
            {
                from: "situation",
                to: "belief",
                relation: "generates"
            },
            {
                from: "belief",
                to: "prediction",
                relation: "supports"
            },
            {
                from: "prediction",
                to: "decision",
                relation: "drives"
            },
            {
                from: "decision",
                to: "plan",
                relation: "creates"
            }
        ];

        return {
            nodes,
            edges
        };
    },

    remember(result) {

        this.memory.unshift({
            generatedAt:
                result.generatedAt,

            situation:
                result.situation,

            decision:
                result.decision,

            confidence:
                result.confidence,

            selectedBelief:
                result.beliefs[0] || null,

            simulation:
                result.simulation
        });

        if (
            this.memory.length >
            this.settings.maxMemory
        ) {
            this.memory.pop();
        }
    },

    renderAll() {
        this.renderCore();
        this.renderHypotheses();
        this.renderBeliefs();
        this.renderDebate();
        this.renderSimulation();
        this.renderMemory();
        this.renderReflection();
        this.renderKnowledgeGraph();
        this.renderThinking();
    },

    renderCore() {
        const panel =
            document.getElementById(
                "autonomousCognitiveV29Panel"
            ) ||
            document.getElementById(
                "autonomousCognitivePanel"
            );

        if (!panel || !this.lastResult) {
            return;
        }

        const result = this.lastResult;

        panel.innerHTML = `
            <div class="item success">
                <h3>Autonomous Cognitive Engine V29</h3>

                Status: ${result.status}<br>
                Situation: ${result.situation.level}<br>
                Top City: ${result.situation.topCity}<br>
                Strongest Belief: ${result.beliefs[0]?.title || "--"}<br>
                Belief Confidence: ${result.beliefs[0]?.confidence || 0}%<br>
                Debate Winner: ${result.debate.winner}<br>
                Decision: ${result.decision.code}<br>
                Priority: ${result.decision.priority}<br>
                Cognitive Confidence: ${result.confidence}%<br>
                Plan: ${result.plan.id}<br>
                Processing: ${result.processingMs} ms
            </div>
        `;
    },

    renderHypotheses() {
        const panel =
            document.getElementById(
                "hypothesisPanel"
            );

        if (!panel || !this.lastResult) {
            return;
        }

        panel.innerHTML =
            this.lastResult.hypotheses
                .map(item => `
                    <div class="item">
                        <b>${item.title}</b><br>
                        Confidence: ${item.priorConfidence}%<br>
                        ${item.statement}<br><br>

                        Supporting:
                        ${
                            item.supportingEvidence.length
                                ? item.supportingEvidence.join(", ")
                                : "None"
                        }<br>

                        Contradicting:
                        ${
                            item.contradictingEvidence.length
                                ? item.contradictingEvidence.join(", ")
                                : "None"
                        }
                    </div>
                `).join("");
    },

    renderBeliefs() {
        const panel =
            document.getElementById(
                "beliefPanel"
            );

        if (!panel || !this.lastResult) {
            return;
        }

        panel.innerHTML =
            this.lastResult.beliefs
                .map(item => `
                    <div class="item ${
                        item.status === "SUPPORTED"
                            ? "success"
                            : item.status === "REJECTED"
                                ? "danger"
                                : "warning"
                    }">
                        <b>${item.title}</b><br>
                        Status: ${item.status}<br>
                        Confidence: ${item.confidence}%<br>
                        Relevance: ${item.relevance}%<br>
                        ${item.statement}
                    </div>
                `).join("");
    },

    renderDebate() {
        const panel =
            document.getElementById(
                "decisionDebatePanel"
            );

        if (!panel || !this.lastResult) {
            return;
        }

        const debate =
            this.lastResult.debate;

        panel.innerHTML = `
            ${debate.agents.map(agent => `
                <div class="item">
                    <b>${agent.name}</b><br>
                    Recommendation: ${agent.recommendation}<br>
                    Score: ${Math.round(agent.score)}<br>
                    Reason: ${agent.reason}
                </div>
            `).join("")}

            <div class="item success">
                <b>Debate Winner</b><br>
                ${debate.winner}<br>
                Winning Score: ${debate.winningScore}
            </div>
        `;
    },

    renderSimulation() {
        const panel =
            document.getElementById(
                "futureSimulationPanel"
            );

        if (!panel || !this.lastResult) {
            return;
        }

        const simulation =
            this.lastResult.simulation;

        panel.innerHTML = `
            <div class="item success">
                <b>Future Simulation</b><br>
                Current Risk: ${simulation.current}%<br>
                6 Hours: ${simulation.h6}%<br>
                24 Hours: ${simulation.h24}%<br>
                72 Hours: ${simulation.h72}%<br>
                Trend: ${simulation.trend}<br>
                Selected Scenario: ${simulation.selectedScenario?.name || "--"}
            </div>

            ${simulation.scenarios.map(item => `
                <div class="item">
                    <b>${item.name}</b><br>
                    Probability: ${Math.round(item.probability)}%<br>
                    Projected Risk: ${Math.round(item.projectedRisk)}%
                </div>
            `).join("")}
        `;
    },

    renderMemory() {
        const panel =
            document.getElementById(
                "cognitiveMemoryPanel"
            );

        if (!panel || !this.lastResult) {
            return;
        }

        const memory =
            this.lastResult.memoryMatch;

        panel.innerHTML = `
            <div class="item ${
                memory.found
                    ? "success"
                    : "warning"
            }">
                <b>Cognitive Memory Search</b><br>
                Match Found: ${memory.found ? "YES" : "NO"}<br>
                Similarity: ${memory.similarity}%<br>
                ${memory.message}
            </div>
        `;
    },

    renderReflection() {
        const panel =
            document.getElementById(
                "selfReflectionPanel"
            );

        if (!panel || !this.lastResult) {
            return;
        }

        const reflection =
            this.lastResult.reflection;

        panel.innerHTML = `
            <div class="item">
                <b>Self Reflection</b><br><br>

                Questions:<br>
                ${reflection.questions.map(item =>
                    `• ${item}<br>`
                ).join("")}

                <br>Lessons:<br>
                ${reflection.lessons.map(item =>
                    `• ${item}<br>`
                ).join("")}

                <br>
                Confidence Adjustment:
                ${reflection.confidenceAdjustment}
            </div>
        `;
    },

    renderKnowledgeGraph() {
        const panel =
            document.getElementById(
                "knowledgeGraphPanel"
            );

        if (!panel || !this.lastResult) {
            return;
        }

        const graph =
            this.lastResult.knowledgeGraph;

        panel.innerHTML = `
            <div class="item success">
                <b>National Knowledge Graph</b><br>
                Nodes: ${graph.nodes.length}<br>
                Relations: ${graph.edges.length}
            </div>

            ${graph.edges.map(edge => `
                <div class="item">
                    ${edge.from}
                    →
                    ${edge.relation}
                    →
                    ${edge.to}
                </div>
            `).join("")}
        `;
    },

    renderThinking() {
        const panel =
            document.getElementById(
                "aiThinkingPanel"
            );

        if (!panel || !this.lastResult) {
            return;
        }

        const result =
            this.lastResult;

        const lines = [
            `Observed ${result.observation.cityCount} cities.`,
            `Situation interpreted as ${result.situation.level}.`,
            `Generated ${result.hypotheses.length} hypotheses.`,
            `Strongest belief: ${result.beliefs[0]?.title || "--"}.`,
            `Belief confidence: ${result.beliefs[0]?.confidence || 0}%.`,
            `Decision debate winner: ${result.debate.winner}.`,
            `Future trend: ${result.simulation.trend}.`,
            `Selected scenario: ${result.simulation.selectedScenario?.name || "--"}.`,
            `Final decision: ${result.decision.code}.`,
            `National plan created: ${result.plan.id}.`,
            `Cognitive confidence: ${result.confidence}%.`
        ];

        panel.innerHTML =
            lines.map(line => `
                <div class="item success">
                    ${line}
                </div>
            `).join("");
    }
};
