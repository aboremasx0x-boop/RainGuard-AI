window.RG = window.RG || {};

RG.LearningEngine = {

    score: 70,

    learn(result) {

        if (result.success)

            this.score += 2;
        else
            this.score -= 1;

        this.score = Math.max(50, Math.min(99, this.score));

        const panel = document.getElementById("learningPanel");

        if(panel){

            panel.innerHTML = `

            <div class="item success">

                Learning Score

                <h2>${this.score}%</h2>

            </div>

            `;

        }

        RG.Memory.add("Learning","Knowledge updated");

    }

};
