window.RG = window.RG || {};

RG.ConfidenceEngine = {

    score: 82,

    update(data) {

        let score = 55;

        score += data.risk * 0.40;

        score += data.rain * 0.30;

        score += data.history * 0.20;

        score += Math.random() * 5;

        score = Math.min(99, Math.round(score));

        this.score = score;

        document.getElementById("confidence").innerHTML = score + "%";

        const panel = document.getElementById("confidencePanel");

        panel.innerHTML = `

        <div class="item success">

            National Confidence

            <h2>${score}%</h2>

        </div>

        `;

    }

};
