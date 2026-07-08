window.RG25 = window.RG25 || {};

RG25.ExecutiveBanner = {

    lastState: null,

    update(state) {
        this.lastState = state || this.buildDefaultState();
        this.render();
    },

    buildDefaultState() {
        return {
            nationalStatus: "NORMAL",
            aiConfidence: 99,
            nationalRisk: 0,
            activeMissions: 0,
            emergencyCount: 0,
            warningCount: 0,
            resourcesStatus: "READY",
            currentCycle: "Observe",
            topCity: "--",
            updatedAt: new Date().toLocaleTimeString("ar-SA")
        };
    },

    getStatusClass(status) {
        if (status === "EMERGENCY") return "danger";
        if (status === "WARNING") return "warning";
        return "success";
    },

    render() {
        const panel = document.getElementById("executiveBannerV25");
        if (!panel || !this.lastState) return;

        const s = this.lastState;
        const statusClass = this.getStatusClass(s.nationalStatus);

        panel.innerHTML = `
            <div class="command-banner ${statusClass}">
                <div class="command-title">
                    <span class="command-badge">V25</span>
                    <div>
                        <h2>National Command Center</h2>
                        <p>Autonomous National Situation Awareness Layer</p>
                    </div>
                </div>

                <div class="command-metrics">
                    <div>
                        <span>National Status</span>
                        <strong>${s.nationalStatus}</strong>
                    </div>

                    <div>
                        <span>AI Confidence</span>
                        <strong>${s.aiConfidence}%</strong>
                    </div>

                    <div>
                        <span>National Risk</span>
                        <strong>${s.nationalRisk}%</strong>
                    </div>

                    <div>
                        <span>Top City</span>
                        <strong>${s.topCity}</strong>
                    </div>

                    <div>
                        <span>Active Missions</span>
                        <strong>${s.activeMissions}</strong>
                    </div>

                    <div>
                        <span>Emergency</span>
                        <strong>${s.emergencyCount}</strong>
                    </div>

                    <div>
                        <span>Warnings</span>
                        <strong>${s.warningCount}</strong>
                    </div>

                    <div>
                        <span>Resources</span>
                        <strong>${s.resourcesStatus}</strong>
                    </div>

                    <div>
                        <span>Cycle</span>
                        <strong>${s.currentCycle}</strong>
                    </div>
                </div>

                <div class="command-time">
                    Updated: ${s.updatedAt}
                </div>
            </div>
        `;
    }

};
