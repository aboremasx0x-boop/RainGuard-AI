window.RG23 = window.RG23 || {};

RG23.FloodEngine={

calculate(city){

let flood=0;

flood+=city.weatherScore*0.45;

flood+=city.rain*8;

flood+=city.precipProb*0.18;

flood+=city.wind*0.08;

if(city.humidity>85)

flood+=10;

if(city.sixHourRain>15)

flood+=15;

flood=Math.min(100,Math.round(flood));

return flood;

},

analyze(cities){

cities.forEach(city=>{

city.floodIndex=

this.calculate(city);

});

this.render(cities);

},

render(cities){

const panel=

document.getElementById(

"floodPanel"

);

if(!panel) return;

const sorted=

[...cities]

.sort(

(a,b)=>

b.floodIndex-

a.floodIndex

);

panel.innerHTML="";

sorted

.slice(0,10)

.forEach(city=>{

panel.innerHTML+=`

<div class="item ${city.floodIndex>60?"danger":city.floodIndex>35?"warning":"success"}">

<b>${city.name}</b>

<br>

Flood Index

${city.floodIndex}%

</div>

`;

});

}

};
