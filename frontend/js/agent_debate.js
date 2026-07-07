window.RG = window.RG || {};

RG.AgentDebate={

run(city,risk){

const opinions=[

["Weather Agent","Radar strongly supports monitoring."],

["Hydrology Agent","Flood index increasing."],

["Infrastructure Agent","Road exposure medium."],

["Population Agent","Population density moderate."],

["Learning Agent","Historical pattern matches previous storms."]

];

const panel=document.getElementById("debatePanel");

panel.innerHTML="";

opinions.forEach(a=>{

panel.innerHTML+=`

<div class="item">

<b>${a[0]}</b>

<br>

${a[1]}

</div>

`;

});

RG.Memory.add("Debate","Agents finished debate");

}

};
