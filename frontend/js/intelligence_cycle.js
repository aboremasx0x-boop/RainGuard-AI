window.RG23 = window.RG23 || {};

RG23.IntelligenceCycle = {

    phases: [
        "Observe",
        "Weather",
        "Radar",
        "Flood",
        "City",
        "Reason",
        "Decide",
        "Mission",
        "Learn"
    ],

    phaseIndex: 0,

    running: false,

    timer: null,

    intervalMs: 60000,

    setPhase(phase) {
        const currentPhase = document.getElementById("currentPhase");
        if (currentPhase) currentPhase.innerText = phase;

        document.querySelectorAll(".cycle div").forEach(el => {
            el.classList.toggle("active", el.dataset.phase === phase);
        });

        const panel = document.getElementById("cyclePanel");
        if (panel) {
            panel.innerHTML = `
                <div class="item success">
                    <b>${phase}</b><br>
                    ${new Date().toLocaleTimeString("ar-SA")}
                </div>
            ` + panel.innerHTML;
        }
    },

    async runOneCycle() {
        const phase = this.phases[this.phaseIndex];

        this.setPhase(phase);

        await RG23.Brain.runPhase(phase);

        this.phaseIndex = (this.phaseIndex + 1) % this.phases.length;
    },

    start() {
        if (this.running) return;

        this.running = true;

        const status = document.getElementById("systemStatus");
        if (status) status.innerText = "Running";

        this.runOneCycle();

        this.timer = setInterval(() => {
            this.runOneCycle();
        }, this.intervalMs);
    },

    stop() {
        this.running = false;

        if (this.timer) clearInterval(this.timer);
        this.timer = null;

        const status = document.getElementById("systemStatus");
        if (status) status.innerText = "Stopped";
    }

};
