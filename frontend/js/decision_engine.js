window.RG = window.RG || {};

RG.DecisionEngine={

decide(city,risk){

let decision="";

if(risk>=75)

decision="Emergency";

else if(risk>=55)

decision="Public Warning";

else if(risk>=30)

decision="Active Monitoring";

else

decision="Normal Monitoring";

document.getElementById("decisionPanel").innerHTML=`

<div class="item success">

<h2>${decision}</h2>

${city}

</div>

`;

RG.Memory.add("Decision",decision);

return decision;

}

};
