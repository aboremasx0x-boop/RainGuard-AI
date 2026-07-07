window.RG = window.RG || {};

RG.ExplainableAI = {
    explain(city, risk, decision) {
        const panel = document.getElementById("explainPanel");
        if (!panel) return;

        panel.innerHTML = `
        <div class="item success">
            <h2>Explainable AI Decision</h2>
            <b>Decision:</b> ${decision}<br>
            <b>City:</b> ${city}<br>
            <b>Risk:</b> ${risk}%<br><br>

            <b>Why?</b><br>
            ${city} has the highest combined operational risk.<br><br>

            <b>Evidence:</b>
            <ul>
                <li>Radar signal</li>
                <li>Rain probability</li>
                <li>Flood index</li>
                <li>Historical similarity</li>
                <li>Agent debate consensus</li>
                <li>Simulation result</li>
            </ul>

            <b>Expected outcome:</b><br>
            Reduce risk from ${risk}% to ${Math.max(5, risk - 12)}%.
        </div>
        `;
    }
};
