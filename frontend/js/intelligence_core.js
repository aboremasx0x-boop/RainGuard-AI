window.RG = window.RG || {};

RG.IntelligenceCore = {
    running: false,
    phase: "Observe",
    tick: 0,

    phases: [
        "Observe",
        "Understand",
        "Reason",
        "Simulate",
        "Debate",
        "Decide",
        "Plan",
        "Execute",
        "Verify",
        "Learn"
    ],

    cities: [
        { name:"نجران", risk:31 },
        { name:"خميس مشيط", risk:29 },
        { name:"الطائف", risk:28 },
        { name:"أبها", risk:27 },
        { name:"الباحة", risk:26 },
        { name:"مكة المكرمة", risk:26 },
        { name:"جازان", risk:24 },
        { name:"جدة", risk:18 },
        { name:"الرياض", risk:12 },
        { name:"الدمام", risk:10 }
    ],

    getTopCity() {
        return [...this.cities].sort((a,b)=>b.risk-a.risk)[0];
    },

    getAverageRisk() {
        const total = this.cities.reduce((s,c)=>s+c.risk,0);
        return Math.round(total / this.cities.length);
    },

    nextPhase() {
        const i = this.phases.indexOf(this.phase);
        this.phase = this.phases[(i + 1) % this.phases.length];
        this.tick++;
        return this.phase;
    },

    start() {
        this.running = true;
    },

    stop() {
        this.running = false;
    }
};
