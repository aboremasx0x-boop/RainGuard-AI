window.RG = window.RG || {};

RG.MissionGenerator = {

    missions: [],

    generate(city, risk) {

        this.missions = [];

        const count = Math.max(3, Math.min(8, Math.round(risk / 10)));

        for (let i = 0; i < count; i++) {

            this.missions.push({
                id: i + 1,
                city: city,
                eta: (10 + i * 5) + " min",
                risk: Math.max(5, risk - i),
                status: i === 0 ? "Running" : "Pending"
            });

        }

        this.render();

        RG.Memory.add("Mission", count + " missions generated");

    },

    render() {

        const panel = document.getElementById("missionPanel");

        if (!panel) return;

        panel.innerHTML = "";

        this.missions.forEach(m => {

            panel.innerHTML += `

            <div class="item">

                <b>Mission ${m.id}</b><br>

                ${m.city}<br>

                ETA : ${m.eta}<br>

                Risk : ${m.risk}%<br>

                <span class="${m.status==="Running"?"green":"yellow"}">${m.status}</span>

            </div>

            `;

        });

    }

};
