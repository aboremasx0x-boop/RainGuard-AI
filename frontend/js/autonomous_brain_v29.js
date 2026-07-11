window.RG29 = window.RG29 || {};

RG29.AutonomousBrain = {

    running: false,
    timer: null,
    intervalMs: 300000,

    async start() {
        if (this.running) {
            return;
        }

        this.running = true;
        this.setStatus(
            "Autonomous Cognitive V29 Running"
        );

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
                console.warn(
                    "V29: no cities available"
                );
                return;
            }

            const dataHubResults =
                await RG26.NationalDataHub
                    .collectForCities(cities);

            const verifications = [];
            const warnings = [];

            dataHubResults.forEach(cityData => {

                const verification =
                    RG26.ForecastVerification
                        .verify(cityData);

                if (verification) {
                    verifications.push(
                        verification
                    );
                }

                const warning =
                    RG26.EarlyWarningAI
                        .analyze(
                            cityData,
                            verification
                        );

                if (warning) {
                    warnings.push(warning);
                }
            });

            if (
                window.RG23?.Brain
                    ?.runFullAnalysis
            ) {
                // تشغيل محرك البيانات الأساسي دون إسقاط دورة V29
try {
    const baseBrain =
        window.RG23?.AIBrain ||
        window.RG23?.AIBrainV23 ||
        window.RG24?.AIBrain ||
        null;

    if (baseBrain && typeof baseBrain.runFullAnalysis === "function") {
        await baseBrain.runFullAnalysis();
    } else {
        console.warn(
            "V29: Base AI brain runFullAnalysis is unavailable. Continuing with available data."
        );
    }
} catch (baseError) {
    console.warn(
        "V29: Base analysis failed, continuing cognitive cycle with available data:",
        baseError
    );
}
            }

            const latestCities =
                window.RG23?.Brain
                    ?.latestCities ||
                cities;

            const result =
                RG29.AutonomousCognitiveEngine
                    .run({
                        cities: latestCities,
                        warnings,
                        verifications
                    });

            this.commander(
                `V29 situation: ${result.situation.level}`
            );

            this.commander(
                `V29 strongest belief: ${result.beliefs[0]?.title || "--"}`
            );

            this.commander(
                `V29 debate winner: ${result.debate.winner}`
            );

            this.commander(
                `V29 decision: ${result.decision.code}`
            );

            this.commander(
                `V29 confidence: ${result.confidence}%`
            );

        } catch (error) {
            console.error(
                "Autonomous Brain V29 error:",
                error
            );

            this.commander(
                "V29 cognitive cycle failed. Check console."
            );
        }
    },

    commander(message) {
        if (
            window.RG23?.Brain
                ?.writeCommander
        ) {
            RG23.Brain
                .writeCommander(message);
        } else {
            console.log(message);
        }
    },

    setStatus(text) {
        const element =
            document.getElementById(
                "systemStatus"
            );

        if (element) {
            element.innerText = text;
        }
    }
};

window.addEventListener("load", () => {

    setTimeout(() => {
        RG29.AutonomousBrain.start();
    }, 5000);

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

    if (start) {
        start.onclick = () =>
            RG29.AutonomousBrain.start();
    }

    if (stop) {
        stop.onclick = () =>
            RG29.AutonomousBrain.stop();
    }

    if (refresh) {
        refresh.onclick = () =>
            RG29.AutonomousBrain.runCycle();
    }
});
