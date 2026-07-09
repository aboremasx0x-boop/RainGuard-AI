window.RG26 = window.RG26 || {};

RG26.NationalAICore = {

    running: false,
    timer: null,
    intervalMs: 300000, // 5 دقائق

    lastCycle: null,

    async runCycle() {

        if (!window.RG23 || !RG23.CityEngine) {
            console.warn("RG23 CityEngine not ready");
            return;
        }

        const cities = RG23.CityEngine.cities || [];

        if (!cities.length) {
            console.warn("No cities available");
            return;
        }

        try {

            this.log("National AI Core V26 cycle started.");

            const dataHubResults =
                await RG26.NationalDataHub.collectForCities(cities);

            const warnings = [];

            dataHubResults.forEach(cityData => {

                const verification =
                    RG26.ForecastVerification.verify(cityData);

                const warning =
                    RG26.EarlyWarningAI.analyze(cityData, verification);

                if (warning) warnings.push(warning);

            });

            let latestCities = [];

            if (window.RG23?.Brain?.runFullAnalysis) {
                await RG23.Brain.runFullAnalysis();
                latestCities = RG23.Brain.latestCities || [];
            }

            if (window.RG24?.BrainBridge && latestCities.length) {
                RG24.BrainBridge.run(latestCities);
            }

            if (window.RG25?.NationalStatus && latestCities.length) {
                RG25.NationalStatus.calculate(latestCities);
            }

            this.lastCycle = {
                time: new Date().toLocaleTimeString("ar-SA"),
                cities: cities.length,
                warnings: warnings.length,
                status: "COMPLETED"
            };

            this.updateCorePanel();
            this.log("National AI Core V26 cycle completed.");

        } catch (error) {

            console.error("National AI Core V26 failed:", error);

            this.lastCycle = {
                time: new Date().toLocaleTimeString("ar-SA"),
                cities: 0,
                warnings: 0,
                status: "FAILED"
            };

            this.updateCorePanel();
            this.log("National AI Core V26 cycle failed. Check console.");
        }
    },

    start() {

        if (this.running) return;

        this.running = true;

        const status = document.getElementById("systemStatus");
        if (status) status.innerText = "AI Core Running";

        this.runCycle();

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

        const status = document.getElementById("systemStatus");
        if (status) status.innerText = "Stopped";
    },

    updateCorePanel() {

        const panel = document.getElementById("nationalAICorePanel");

        if (!panel || !this.lastCycle) return;

        panel.innerHTML = `
            <div class="item ${this.lastCycle.status === "COMPLETED" ? "success" : "danger"}">
                <h3>National AI Core V26</h3>
                Status: ${this.lastCycle.status}<br>
                Cities analyzed: ${this.lastCycle.cities}<br>
                Warnings generated: ${this.lastCycle.warnings}<br>
                Last cycle: ${this.lastCycle.time}<br>
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
    }

};

window.addEventListener("load", () => {

    setTimeout(() => {

        RG26.NationalAICore.start();

        const start = document.getElementById("startSystem");
        if (start) {
            start.onclick = () => RG26.NationalAICore.start();
        }

        const stop = document.getElementById("stopSystem");
        if (stop) {
            stop.onclick = () => RG26.NationalAICore.stop();
        }

        const refresh = document.getElementById("refreshNow");
        if (refresh) {
            refresh.onclick = () => RG26.NationalAICore.runCycle();
        }

    }, 4000);

});
