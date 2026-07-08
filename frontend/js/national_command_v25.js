window.RG25 = window.RG25 || {};

RG25.NationalCommand = {

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
                "V25 National Command Center connected."
            );
        }, 300);
    }

};

window.addEventListener("load", () => {
    RG25.NationalCommand.connect();
});
