window.RG24 = window.RG24 || {};

RG24.MissionCenter = {

    missions: [],

    generate(decision) {

        if (!decision) return null;

        const mission = {
            id: "RG-" + Date.now(),
            city: decision.city,
            priority: decision.priority,
            decision: decision.decision,
            status: "READY",
            progress: 0,
            eta: this.calculateETA(decision.priority),
            created: new Date().toLocaleTimeString("ar-SA"),
            units: this.assignUnits(decision.priority)
        };

        this.missions.unshift(mission);

        if (this.missions.length > 20)
            this.missions.pop();

        this.render();

        return mission;
    },

    calculateETA(priority) {

        switch(priority){

            case "CRITICAL":
                return "5 min";

            case "HIGH":
                return "15 min";

            case "MEDIUM":
                return "30 min";

            default:
                return "60 min";

        }

    },

    assignUnits(priority){

        switch(priority){

            case "CRITICAL":
                return [
                    "Civil Defense",
                    "Police",
                    "Emergency Medical Services",
                    "Municipality"
                ];

            case "HIGH":
                return [
                    "Civil Defense",
                    "Municipality"
                ];

            case "MEDIUM":
                return [
                    "Monitoring Team"
                ];

            default:
                return [
                    "AI Monitoring"
                ];

        }

    },

    updateMission(id, progress){

        const mission =
            this.missions.find(
                m=>m.id===id
            );

        if(!mission) return;

        mission.progress=progress;

        if(progress>=100){

            mission.status="COMPLETED";

        }else{

            mission.status="IN PROGRESS";

        }

        this.render();

    },

    render(){

        const panel=
            document.getElementById(
                "missionPanel"
            );

        if(!panel) return;

        if(this.missions.length===0){

            panel.innerHTML=`
            <div class="item">
                No active missions.
            </div>
            `;

            return;

        }

        panel.innerHTML="";

        this.missions.forEach(m=>{

            panel.innerHTML+=`

            <div class="item ${m.priority==="CRITICAL"?"danger":m.priority==="HIGH"?"warning":"success"}">

                <b>${m.id}</b>

                <br>

                City:
                ${m.city}

                <br>

                Priority:
                ${m.priority}

                <br>

                Status:
                ${m.status}

                <br>

                ETA:
                ${m.eta}

                <br>

                Progress:
                ${m.progress}%

                <br><br>

                Units

                <br>

                ${m.units.join("<br>")}

            </div>

            `;

        });

    }

};
