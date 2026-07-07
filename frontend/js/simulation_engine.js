window.RG = window.RG || {};

RG.SimulationEngine={

simulate(city,risk){

const scenarios=[

{

title:"Deploy monitoring teams",

risk:Math.max(5,risk-12)

},

{

title:"Public Advisory",

risk:Math.max(8,risk-8)

},

{

title:"Emergency Escalation",

risk:Math.max(4,risk-18)

},

{

title:"No Action",

risk:risk+15

}

];

const panel=document.getElementById("simulationPanel");

panel.innerHTML="";

scenarios.forEach(s=>{

panel.innerHTML+=`

<div class="item">

<b>${s.title}</b>

<br>

Expected Risk ${s.risk}%

</div>

`;

});

RG.Memory.add("Simulation","Simulated "+city);

return scenarios;

}

};
