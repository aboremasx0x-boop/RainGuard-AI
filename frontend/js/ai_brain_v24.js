window.RG24 = window.RG24 || {};

RG24.BrainBridge = {

    run(cities) {
        if (!cities || !cities.length) return;

        const reasoning = RG24.ReasoningEngine.analyzeNational(cities);
        const decision = RG24.DecisionEngine.decide(reasoning);
        const mission = RG24.MissionCenter.generate(decision);

        RG24.ExplainableAI.explain(reasoning, decision, mission);
    }

};

(function attachV24ToV23() {
    const wait = setInterval(() => {
        if (!window.RG23 || !RG23.Brain) return;

        clearInterval(wait);

        const oldRunFullAnalysis = RG23.Brain.runFullAnalysis.bind(RG23.Brain);

        RG23.Brain.runFullAnalysis = async function () {
            await oldRunFullAnalysis();

            if (this.latestCities && this.latestCities.length) {
                RG24.BrainBridge.run(this.latestCities);
            }
        };

        const oldRunPhase = RG23.Brain.runPhase.bind(RG23.Brain);

        RG23.Brain.runPhase = async function (phase) {
            await oldRunPhase(phase);

            if (
                phase === "Reason" ||
                phase === "Decide" ||
                phase === "Mission" ||
                phase === "Learn"
            ) {
                if (this.latestCities && this.latestCities.length) {
                    RG24.BrainBridge.run(this.latestCities);
                }
            }
        };

        RG23.Brain.writeCommander("V24 Reasoning + Decision Engine connected.");
    }, 300);
})();
