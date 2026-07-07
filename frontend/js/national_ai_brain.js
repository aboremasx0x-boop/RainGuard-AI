window.RG = window.RG || {};

RG.NationalAIBrain = {

    timer: null,

    runCycle() {
        const core = RG.IntelligenceCore;
        const top = core.getTopCity();
        const city = top.name;
        const risk = top.risk;

        const phase = core.phase;

        document.getElementById("status").innerText =
            core.running ? "Running" : "Standby";

        document.getElementById("phase").innerText = phase;
        document.getElementById("risk").innerText = core.getAverageRisk() + "%";
        document.getElementById("topCity").innerText = city;

        document.querySelectorAll(".cycle div").forEach(el => {
            el.classList.toggle("active", el.dataset.phase === phase);
        });

        if (phase === "Observe") {
            RG.TimelineEngine.add("Observe: national signals collected");
            RG.Memory.add("Observe", "Radar and weather data observed");
        }

        if (phase === "Understand") {
            RG.ConfidenceEngine.update({
                risk,
                rain: 70,
                history: 80
            });
            RG.TimelineEngine.add("Understand: risk calculated");
        }

        if (phase === "Reason") {
            RG.ReasoningEngine.think(city);
            RG.TimelineEngine.add("Reasoning completed");
        }

        if (phase === "Simulate") {
            RG.SimulationEngine.simulate(city, risk);
            RG.TimelineEngine.add("Simulation completed");
        }

        if (phase === "Debate") {
            RG.AgentDebate.run(city, risk);
            RG.TimelineEngine.add("Agent debate completed");
        }

        if (phase === "Decide") {
            const decision = RG.DecisionEngine.decide(city, risk);
            RG.ExplainableAI.explain(city, risk, decision);
            RG.TimelineEngine.add("Decision selected");
        }

        if (phase === "Plan") {
            RG.MissionGenerator.generate(city, risk);
            RG.TimelineEngine.add("Mission plan generated");
        }

        if (phase === "Execute") {
            RG.Memory.add("Execute", "Mission execution started for " + city);
            RG.TimelineEngine.add("Execution started");
        }

        if (phase === "Verify") {
            RG.Memory.add("Verify", "Outcome verification completed");
            RG.TimelineEngine.add("Verification completed");
        }

        if (phase === "Learn") {
            RG.LearningEngine.learn({ success:true });
            RG.Memory.add("Learn", "Decision experience stored");
            RG.TimelineEngine.add("Learning completed");

            const decision = RG.DecisionEngine.decide(city, risk);
            RG.ExecutiveReport.generate(city, risk, decision);
        }

        core.nextPhase();
    },

    start() {
        RG.IntelligenceCore.start();

        if (this.timer) return;

        this.timer = setInterval(() => {
            this.runCycle();
        }, 2500);

        this.runCycle();
    },

    stop() {
        RG.IntelligenceCore.stop();

        clearInterval(this.timer);
        this.timer = null;
    }
};
