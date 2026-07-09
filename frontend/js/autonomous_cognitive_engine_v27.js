window.RG27 = window.RG27 || {};

RG27.AutonomousCognitiveEngine = {

    memory: [],
    scenarios: [],
    lastCognition: null,

    run({ cities = [], warnings = [], verifications = [] } = {}) {

        const situation = this.understandSituation(cities, warnings, verifications);
        const scenarios = this.generateScenarios(cities, warnings, verifications, situation);
        const prediction = this.predictRisk(cities, scenarios);
        const decision = this.makeDecision(situation, prediction, warnings);
        const mission = this.planMission(decision, situation);
        const explanation = this.explain(situation, scenarios, prediction, decision, mission);

        this.lastCognition = {
            time: new Date().toLocaleTimeString("ar-SA"),
            situation,
            scenarios,
            prediction,
            decision,
            mission,
            explanation
        };

        this.memory.unshift(this.lastCognition);
        if (this.memory.length > 30) this.memory.pop();

        this.renderAll();

        return this.lastCognition;
    },

    understandSituation(cities, warnings, verifications) {

        const risks = cities.map(c =>
            Number(c.finalRisk || c.floodIndex || c.weatherScore || c.baseRisk || 0)
        );

        const maxRisk = risks.length ? Math.max(...risks) : 0;
        const avgRisk = risks.length
            ? Math.round(risks.reduce((s, r) => s + r, 0) / risks.length)
            : 0;

        const topCity = [...cities].sort((a, b) => {
            const ar = Number(a.finalRisk || a.floodIndex || a.weatherScore || a.baseRisk || 0);
            const br = Number(b.finalRisk || b.floodIndex || b.weatherScore || b.baseRisk || 0);
            return br - ar;
        })[0];

        const activeWarnings = warnings.filter(w =>
            ["WATCH", "WARNING", "EMERGENCY"].includes(w.overallLevel)
        );

        const avgConfidence = verifications.length
            ? Math.round(
                verifications.reduce((s, v) => s + Number(v?.finalConfidence || 80), 0)
                / verifications.length
            )
            : 80;

        let situationLevel = "NORMAL";
        if (maxRisk >= 70 || activeWarnings.some(w => w.overallLevel === "EMERGENCY")) {
            situationLevel = "EMERGENCY";
        } else if (maxRisk >= 45 || activeWarnings.some(w => w.overallLevel === "WARNING")) {
            situationLevel = "WARNING";
        } else if (maxRisk >= 25 || activeWarnings.some(w => w.overallLevel === "WATCH")) {
            situationLevel = "WATCH";
        }

        return {
            level: situationLevel,
            avgRisk,
            maxRisk,
            topCity: topCity?.name || "--",
            activeWarnings: activeWarnings.length,
            confidence: avgConfidence,
            summary: this.situationSummary(situationLevel, topCity?.name || "--", avgRisk)
        };
    },

    situationSummary(level, city, risk) {
        if (level === "EMERGENCY") {
            return `Critical weather situation detected near ${city}. Immediate escalation recommended.`;
        }

        if (level === "WARNING") {
            return `Weather risk is increasing near ${city}. Operational readiness should be raised.`;
        }

        if (level === "WATCH") {
            return `Developing weather pattern detected near ${city}. Enhanced monitoring recommended.`;
        }

        return `National situation is stable. Current average risk is ${risk}%.`;
    },

    generateScenarios(cities, warnings, verifications, situation) {

        const topWarning = warnings[0];
        const baseProb = Math.min(95, Math.max(5, situation.maxRisk + 20));

        const rain6h = topWarning?.windows?.h6?.probability ?? baseProb;
        const rain24h = topWarning?.windows?.h24?.probability ?? Math.min(95, baseProb + 10);
        const rain72h = topWarning?.windows?.h72?.probability ?? Math.min(95, baseProb + 20);

        const scenarios = [
            {
                name: "Scenario A — Normal Monitoring",
                probability: Math.max(5, 100 - rain24h),
                impact: "Low",
                description: "Weather remains stable with no field escalation."
            },
            {
                name: "Scenario B — Rain Watch",
                probability: rain6h,
                impact: "Moderate",
                description: "Rain may develop within the next 6 hours."
            },
            {
                name: "Scenario C — Operational Warning",
                probability: rain24h,
                impact: "High",
                description: "Rain risk may increase within 24 hours and require readiness."
            },
            {
                name: "Scenario D — Flood Escalation",
                probability: rain72h,
                impact: "Critical",
                description: "Flood-prone areas may require proactive monitoring within 72 hours."
            }
        ];

        this.scenarios = scenarios.sort((a, b) => b.probability - a.probability);

        return this.scenarios;
    },

    predictRisk(cities, scenarios) {

        const current = cities.length
            ? Math.round(
                cities.reduce((s, c) =>
                    s + Number(c.finalRisk || c.floodIndex || c.weatherScore || c.baseRisk || 0), 0
                ) / cities.length
            )
            : 0;

        const scenarioBoost = scenarios[0]?.probability || 0;

        const risk6h = Math.min(100, Math.round(current * 0.7 + scenarioBoost * 0.3));
        const risk24h = Math.min(100, Math.round(risk6h + 8));
        const risk72h = Math.min(100, Math.round(risk24h + 12));

        return {
            current,
            h6: risk6h,
            h24: risk24h,
            h72: risk72h,
            trend: risk72h > current ? "RISING" : "STABLE"
        };
    },

    makeDecision(situation, prediction, warnings) {

        if (prediction.h72 >= 75 || situation.level === "EMERGENCY") {
            return {
                level: "EMERGENCY_ESCALATION",
                priority: "CRITICAL",
                action: "Activate emergency coordination and prepare field response units."
            };
        }

        if (prediction.h24 >= 55 || situation.level === "WARNING") {
            return {
                level: "ACTIVE_WARNING",
                priority: "HIGH",
                action: "Raise readiness and monitor radar, valleys and road networks."
            };
        }

        if (prediction.h6 >= 35 || situation.level === "WATCH") {
            return {
                level: "WATCH",
                priority: "MEDIUM",
                action: "Increase monitoring frequency and update forecasts continuously."
            };
        }

        return {
            level: "NORMAL_MONITORING",
            priority: "LOW",
            action: "Continue normal monitoring."
        };
    },

    planMission(decision, situation) {

        const city = situation.topCity || "--";

        return {
            id: "AC-" + Date.now(),
            city,
            priority: decision.priority,
            status: "PLANNED",
            units: decision.priority === "CRITICAL"
                ? "Civil Defense, Municipality, Roads, AI Monitoring"
                : decision.priority === "HIGH"
                    ? "Municipality, Roads, AI Monitoring"
                    : "AI Monitoring",
            eta: decision.priority === "CRITICAL"
                ? "Immediate"
                : decision.priority === "HIGH"
                    ? "30 min"
                    : "60 min",
            task: decision.action
        };
    },

    explain(situation, scenarios, prediction, decision, mission) {

        return [
            `Situation level: ${situation.level}`,
            `Top city: ${situation.topCity}`,
            `Average national risk: ${situation.avgRisk}%`,
            `Maximum risk: ${situation.maxRisk}%`,
            `Most likely scenario: ${scenarios[0]?.name || "--"} (${scenarios[0]?.probability || 0}%)`,
            `Risk trend: ${prediction.trend}`,
            `Predicted risk: 6h ${prediction.h6}%, 24h ${prediction.h24}%, 72h ${prediction.h72}%`,
            `Decision: ${decision.level}`,
            `Mission: ${mission.id} for ${mission.city}`
        ];
    },

    renderAll() {
        this.renderBrain();
        this.renderThinking();
        this.renderScenarioPanel();
        this.renderPredictionPanel();
    },

    renderBrain() {
        const panel = document.getElementById("autonomousBrainPanel");
        if (!panel || !this.lastCognition) return;

        const c = this.lastCognition;

        panel.innerHTML = `
            <div class="item success">
                <h3>Autonomous Cognitive Engine V27</h3>
                Situation: ${c.situation.level}<br>
                Top City: ${c.situation.topCity}<br>
                Confidence: ${c.situation.confidence}%<br>
                Decision: ${c.decision.level}<br>
                Priority: ${c.decision.priority}<br>
                Mission: ${c.mission.id}<br>
                Updated: ${c.time}
            </div>
        `;
    },

    renderThinking() {
        const panel = document.getElementById("aiThinkingPanel");
        if (!panel || !this.lastCognition) return;

        panel.innerHTML = this.lastCognition.explanation.map(line => `
            <div class="item success">
                ${line}
            </div>
        `).join("");
    },

    renderScenarioPanel() {
        const panel = document.getElementById("scenarioPanel");
        if (!panel || !this.lastCognition) return;

        panel.innerHTML = this.lastCognition.scenarios.map(s => `
            <div class="item ${s.impact === "Critical" ? "danger" : s.impact === "High" ? "warning" : "success"}">
                <b>${s.name}</b><br>
                Probability: ${s.probability}%<br>
                Impact: ${s.impact}<br>
                ${s.description}
            </div>
        `).join("");
    },

    renderPredictionPanel() {
        const panel = document.getElementById("riskPredictionPanel");
        if (!panel || !this.lastCognition) return;

        const p = this.lastCognition.prediction;

        panel.innerHTML = `
            <div class="item success">
                <h3>Risk Prediction</h3>
                Current Risk: ${p.current}%<br>
                6 Hours: ${p.h6}%<br>
                24 Hours: ${p.h24}%<br>
                72 Hours: ${p.h72}%<br>
                Trend: ${p.trend}
            </div>
        `;
    }

};
