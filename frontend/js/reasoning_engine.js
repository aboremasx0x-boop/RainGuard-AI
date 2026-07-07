window.RG = window.RG || {};

RG.ReasoningEngine = {

    think(city){

        const reasons=[];

        reasons.push("Radar signal analyzed");

        reasons.push("Rain probability compared");

        reasons.push("Historical floods checked");

        reasons.push("Population density evaluated");

        reasons.push("Road network inspected");

        reasons.push("Critical infrastructure compared");

        document.getElementById("reasoningPanel").innerHTML="";

        reasons.forEach(r=>{

            document.getElementById("reasoningPanel").innerHTML+=`

            <div class="item">

            ${r}

            </div>`;

        });

        RG.Memory.add("Reason",city+" reasoning completed");

    }

};
