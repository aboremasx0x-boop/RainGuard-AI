window.RG28 = window.RG28 || {};

RG28.AutonomousBrain = {

    running: false,
    timer: null,
    intervalMs: 300000,

    async start() {
        if (this.running) return;

        this.running = true;
        this.setStatus("Autonomous Cognitive V28 Running");

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
    },

    async runCycle() {
        try {
            const cities =
                window.RG23?.CityEngine?.cities || [];

            if (!cities.length) {
                console.warn("V28: no cities available");
                return;
            }

            const dataHubResults =
                await RG26.NationalDataHub.collectForCities(cities);

            const verifications = [];
            const warnings = [];

            dataHubResults.forEach(cityData => {
                const verification =
                    RG26.ForecastVerification.verify(cityData);

                if (verification) {
                    verifications.push(verification);
                }

                const warning =
                    RG26.EarlyWarningAI.analyze(
                        cityData,
                        verification
                    );

                if (warning) {
                    warnings.push(warning);
                }
            });

            if (window.RG23?.Brain?.runFullAnalysis) {
                await RG23.Brain.runFullAnalysis();
            }

            const latestCities =
                window.RG23?.Brain?.latestCities || cities;

            if (window.RG24?.BrainBridge) {
                RG24.BrainBridge.run(latestCities);
            }

            if (window.RG25?.NationalStatus) {
                RG25.NationalStatus.calculate(latestCities);
            }

            const result =
                RG28.AutonomousCognitiveEngine.run({
                    cities: latestCities,
                    warnings,
                    verifications
                });

            this.updateCommander(
                `V28 decision: ${result.decision.code}`
            );

            this.updateCommander(
                `V28 selected scenario: ${result.selectedScenario?.title || "--"}`
            );

            this.updateCommander(
                `V28 cognitive confidence: ${result.confidence}%`
            );

        } catch (error) {
            console.error(
                "Autonomous Brain V28 error:",
                error
            );

            this.updateCommander(
                "V28 cognitive cycle failed. Check console."
            );
        }
    },

    updateCommander(message) {
        if (window.RG23?.Brain?.writeCommander) {
            RG23.Brain.writeCommander(message);
        } else {
            console.log(message);
        }
    },

    setStatus(text) {
        const element =
            document.getElementById("systemStatus");

        if (element) {
            element.innerText = text;
        }
    }
};

window.addEventListener("load", () => {

    setTimeout(() => {
        RG28.AutonomousBrain.start();
    }, 5000);

    const start =
        document.getElementById("startSystem");

    const stop =
        document.getElementById("stopSystem");

    const refresh =
        document.getElementById("refreshNow");

    if (start) {
        start.onclick = () =>
            RG28.AutonomousBrain.start();
    }

    if (stop) {
        stop.onclick = () =>
            RG28.AutonomousBrain.stop();
    }

    if (refresh) {
        refresh.onclick = () =>
            RG28.AutonomousBrain.runCycle();
    }
});
