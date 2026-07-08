window.RG24 = window.RG24 || {};

RG24.ExplainableAI = {

    lastExplanation: null,

    explain(reasoning, decision, mission) {

        if (!reasoning || !decision) return null;

        const top = reasoning.analyses.find(
            item => item.city === decision.city
        );

        if (!top) return null;

        const evidence = top.evidence || {};

        this.lastExplanation = {
            time: new Date().toLocaleTimeString("ar-SA"),
            city: decision.city,
            decision: decision.decision,
            action: decision.action,
            priority: decision.priority,
            risk: decision.risk,
            confidence: top.confidence,
            level: decision.level,
            evidence,
            reasons: top.reasons,
            missionId: mission ? mission.id : null
        };

        this.render();

        return this.lastExplanation;
    },

    render() {

        const panel =
            document.getElementById("explainabilityPanel") ||
            document.getElementById("reportPanel");

        if (!panel || !this.lastExplanation) return;

        const x = this.lastExplanation;

        panel.innerHTML = `
            <div class="item ${x.priority === "CRITICAL" ? "danger" : x.priority === "HIGH" ? "warning" : "success"}">

                <h2>Explainable AI Decision</h2>

                <br>

                <b>City:</b> ${x.city}<br>
                <b>Decision:</b> ${x.decision}<br>
                <b>Priority:</b> ${x.priority}<br>
                <b>Risk:</b> ${x.risk}%<br>
                <b>Confidence:</b> ${x.confidence}%<br>
                <b>Mission ID:</b> ${x.missionId || "Not generated"}<br>

                <br>

                <b>Why this decision?</b><br>
                ${x.reasons.map(r => `• ${r}`).join("<br>")}

                <br><br>

                <b>Evidence used:</b><br>
                Weather Score: ${x.evidence.weather ?? 0}%<br>
                Flood Index: ${x.evidence.flood ?? 0}%<br>
                Road Risk: ${x.evidence.road ?? 0}%<br>
                Infrastructure Criticality: ${x.evidence.infrastructure ?? 0}%<br>
                Base Risk: ${x.evidence.base ?? 0}%<br>

                <br>

                <b>Recommended Action:</b><br>
                ${x.action}

                <br><br>

                <span class="small">
                    Generated at ${x.time}
                </span>

            </div>
        `;
    }

};
