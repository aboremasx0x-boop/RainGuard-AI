window.RG26 = window.RG26 || {};

RG26.Brain = {

    running: false,
    timer: null,
    intervalMs: 300000, // كل 5 دقائق

    async run() {
        if (!window.RG23 || !RG23.CityEngine) return;

        try {
            const cities = RG23.CityEngine.cities || [];

            if (!cities.length) return;

            const dataHubResults =
                await RG26.NationalDataHub.collectForCities(cities);

            dataHubResults.forEach(cityData => {
                const verification =
                    RG26.ForecastVerification.verify(cityData);

                RG26.EarlyWarningAI.analyze(
                    cityData,
                    verification
                );
            });

            if (window.RG23?.Brain?.writeCommander) {
                RG23.Brain.writeCommander(
                    "V26 Early Warning AI updated 6h / 24h / 72h forecasts."
                );
            }

        } catch (error) {
            console.error("V26 Brain error:", error);
        }
    },

    start() {
        if (this.running) return;

        this.running = true;

        this.run();

        this.timer = setInterval(() => {
            this.run();
        }, this.intervalMs);
    },

    stop() {
        this.running = false;

        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

};

window.addEventListener("load", () => {
    setTimeout(() => {
        RG26.Brain.start();
    }, 3000);
});
