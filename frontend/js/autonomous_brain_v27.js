window.RG27 = window.RG27 || {};

RG27.AutonomousBrain = {

    running: false,
    timer: null,
    intervalMs: 300000,
    lastRun: null,

    async start() {
        if (this.running) return;

        this.running = true;
        this.setStatus("Autonomous V27 Running");
        this.log("Autonomous Brain V27 started.");

        await this.runCycle();

        this.timer = setInterval(() => {
            this.runCycle();
        }, this.intervalMs);
    },

    stop() {
        this.running = false;

        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }

        this.setStatus("Stopped");
        this.log("Autonomous Brain V27 stopped.");
    },

    async runCycle() {
        try {
            this.log("V27 cycle started: Observe → Verify → Predict → Decide.");

            const cities = RG23?.CityEngine?.cities || [];

            if (!cities.length) {
                this.log("No cities found. Cycle skipped.");
                return;
            }

            const dataHubResults =
                await RG26.NationalDataHub.collectForCities(cities);

            const verifications = [];
            const warnings = [];

            dataHubResults.forEach(cityData => {
                const verification =
                    RG26.ForecastVerification.verify(cityData);

                if (verification) verifications.push(verification);

                const warning =
                    RG26.EarlyWarningAI.analyze(cityData, verification);

                if (warning) warnings.push(warning);
            });

            if (window.RG23?.Brain?.runFullAnalysis) {
                await RG23.Brain.runFullAnalysis();
            }

            const latestCities = RG23?.Brain?.latestCities || [];

            if (window.RG27?.AutonomousCognitiveEngine) {
                RG27.AutonomousCognitiveEngine.run({
                    cities: latestCities,
                    warnings,
                    verifications
                });
            }

            if (window.RG24?.BrainBridge && latestCities.length) {
                RG24.BrainBridge.run(latestCities);
            }

            if (window.RG25?.NationalStatus && latestCities.length) {
                RG25.NationalStatus.calculate(latestCities);
            }

            if (window.RG26?.NationalSituation) {
                RG26.NationalSituation.update({
                    cities: latestCities,
                    warnings,
                    core: {
                        status: "COMPLETED"
                    }
                });
            }

            const finalDecision =
                this.makeFinalDecision(latestCities, warnings, verifications);

            this.lastRun = {
                time: new Date().toLocaleTimeString("ar-SA"),
                status: "COMPLETED",
                cities: cities.length,
                warnings: warnings.length,
                verifications: verifications.length,
                decision: finalDecision.decision,
                mission: finalDecision.mission,
                confidence: finalDecision.confidence
            };

            this.render();
            this.log("V27 cycle completed successfully.");

        } catch (error) {
            console.error("Autonomous Brain V27 error:", error);

            this.lastRun = {
                time: new Date().toLocaleTimeString("ar-SA"),
                status: "FAILED",
                cities: 0,
                warnings: 0,
                verifications: 0,
                decision: "ERROR",
                mission: "CHECK_CONSOLE",
                confidence: 0
            };

            this.render();
            this.log("V27 cycle failed. Check console.");
        }
    },

    makeFinalDecision(cities, warnings, verifications) {
        const risks = (cities || []).map(c =>
            c.finalRisk ||
            c.floodIndex ||
            c.weatherScore ||
            c.baseRisk ||
            0
        );

        const maxRisk = risks.length ? Math.max(...risks) : 0;

        const hasEmergency =
            warnings.some(w => w.overallLevel === "EMERGENCY");

        const hasWarning =
            warnings.some(w => w.overallLevel === "WARNING");

        const hasWatch =
            warnings.some(w => w.overallLevel === "WATCH");

        const confidence = verifications.length
            ? Math.round(
                verifications.reduce(
                    (s, v) => s + (v?.finalConfidence || 80),
                    0
                ) / verifications.length
            )
            : 80;

        if (hasEmergency || maxRisk >= 70) {
            return {
                decision: "EMERGENCY_ESCALATION",
                mission: "Mobilize civil defense, municipality and roads.",
                confidence
            };
        }

        if (hasWarning || maxRisk >= 45) {
            return {
                decision: "ACTIVE_WARNING",
                mission: "Raise readiness and monitor valleys and road networks.",
                confidence
            };
        }

        if (hasWatch || maxRisk >= 25) {
            return {
                decision: "WATCH",
                mission: "Increase monitoring frequency and update forecasts.",
                confidence
            };
        }

        return {
            decision: "NORMAL_MONITORING",
            mission: "Normal monitoring with no field escalation.",
            confidence
        };
    },

    render() {
        const panel =
            document.getElementById("autonomousBrainPanel");

        if (!panel || !this.lastRun) return;

        const r = this.lastRun;

        panel.innerHTML = `
            <div class="item ${r.status === "COMPLETED" ? "success" : "danger"}">
                <h3>Autonomous Brain V27</h3>
                Status: ${r.status}<br>
                Cities: ${r.cities}<br>
                Warnings: ${r.warnings}<br>
                Verifications: ${r.verifications}<br>
                Final Decision: ${r.decision}<br>
                Mission: ${r.mission}<br>
                Confidence: ${r.confidence}%<br>
                Last Run: ${r.time}<br>
                Mode: ${this.running ? "Autonomous" : "Stopped"}
            </div>
        `;
    },

    log(message) {
        if (window.RG23?.Brain?.writeCommander) {
            RG23.Brain.writeCommander(message);
        } else {
            console.log(message);
        }
    },

    setStatus(text) {
        const el = document.getElementById("systemStatus");
        if (el) el.innerText = text;
    }

};

window.addEventListener("load", () => {
    setTimeout(() => {
        RG27.AutonomousBrain.start();

        const start = document.getElementById("startSystem");
        if (start) start.onclick = () => RG27.AutonomousBrain.start();

        const stop = document.getElementById("stopSystem");
        if (stop) stop.onclick = () => RG27.AutonomousBrain.stop();

        const refresh = document.getElementById("refreshNow");
        if (refresh) refresh.onclick = () => RG27.AutonomousBrain.runCycle();

    }, 5000);
});
