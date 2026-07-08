window.RG25 = window.RG25 || {};

RG25.NationalCommand = {

    intervalId: null,
    running: false,
    cycleSeconds: 60,

    connect() {
        const wait = setInterval(() => {
            if (!window.RG23 || !RG23.Brain) return;

            clearInterval(wait);

            const oldRunFullAnalysis =
                RG23.Brain.runFullAnalysis.bind(RG23.Brain);

            RG23.Brain.runFullAnalysis = async function () {
                await oldRunFullAnalysis();

                if (this.latestCities && this.latestCities.length) {
                    RG25.NationalStatus.calculate(this.latestCities);
                }
            };

            RG23.Brain.writeCommander(
                "V25 National Command Center connected. Autonomous mode enabled."
            );

            RG25.NationalCommand.startAuto();
        }, 300);
    },

    startAuto() {
        if (this.running) return;

        this.running = true;

        const status = document.getElementById("systemStatus");
        if (status) status.innerText = "Auto Running";

        this.runOnce();

        this.intervalId = setInterval(() => {
            this.runOnce();
        }, this.cycleSeconds * 1000);
    },

    stopAuto() {
        this.running = false;

        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }

        const status = document.getElementById("systemStatus");
        if (status) status.innerText = "Stopped";
    },

    async runOnce() {
        if (!window.RG23 || !RG23.Brain) return;

        try {
            RG23.Brain.writeCommander("V25 autonomous cycle started.");

            await RG23.Brain.runFullAnalysis();

            if (RG23.Brain.latestCities && RG23.Brain.latestCities.length) {
                RG25.NationalStatus.calculate(RG23.Brain.latestCities);
            }

            RG23.Brain.writeCommander("V25 autonomous cycle completed.");

        } catch (e) {
            console.error("V25 autonomous cycle failed:", e);
            RG23.Brain.writeCommander("V25 autonomous cycle failed. Check console.");
        }
    }

};

window.addEventListener("load", () => {
    RG25.NationalCommand.connect();

    setTimeout(() => {
        const stop = document.getElementById("stopSystem");
        if (stop) {
            stop.onclick = () => {
                RG25.NationalCommand.stopAuto();
            };
        }

        const start = document.getElementById("startSystem");
        if (start) {
            start.onclick = () => {
                RG25.NationalCommand.startAuto();
            };
        }
    }, 1000);
});
