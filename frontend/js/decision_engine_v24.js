window.RG24 = window.RG24 || {};

RG24.DecisionEngine = {

    lastDecision: null,

    decide(reasoning) {
        if (!reasoning) return null;

        const risk = reasoning.topRisk;
        const level = reasoning.topLevel;
        const city = reasoning.topCity;

        let decision = "NORMAL_MONITORING";
        let action = "Normal monitoring with radar watch";
        let priority = "LOW";
        let color = "success";

        if (risk >= 70 || level === "CRITICAL") {
            decision = "EMERGENCY_ESCALATION";
            action = "Activate emergency response and field coordination";
            priority = "CRITICAL";
            color = "danger";
        } else if (risk >= 50 || level === "HIGH") {
            decision = "ACTIVE_FIELD_READINESS";
            action = "Prepare field teams and notify critical infrastructure";
            priority = "HIGH";
            color = "warning";
        } else if (risk >= 30 || level === "MEDIUM") {
            decision = "ACTIVE_MONITORING";
            action = "Continue active monitoring and radar tracking";
            priority = "MEDIUM";
            color = "success";
        }

        this.lastDecision = {
            time: new Date().toLocaleTimeString("ar-SA"),
            city,
            risk,
            level,
            decision,
            action,
            priority,
            color
        };

        this.render();

        return this.lastDecision;
    },

    render() {
        const panel = document.getElementById("decisionPanel");
        if (!panel || !this.lastDecision) return;

        const d = this.lastDecision;

        panel.innerHTML = `
            <div class="item ${d.color}">
                <h3>${d.decision}</h3>
                <b>City:</b> ${d.city}<br>
                <b>Risk:</b> ${d.risk}%<br>
                <b>Level:</b> ${d.level}<br>
                <b>Priority:</b> ${d.priority}<br><br>
                <b>Recommended Action:</b><br>
                ${d.action}
            </div>
        `;
    }

};
