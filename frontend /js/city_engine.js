window.RG23 = window.RG23 || {};

RG23.CityEngine={

cities:[

{

name:"Najran",

lat:17.5656,

lon:44.2289,

population:620000,

elevation:1293,

terrain:"Mountain",

baseRisk:28

},

{

name:"Abha",

lat:18.2465,

lon:42.5117,

population:420000,

elevation:2270,

terrain:"Mountain",

baseRisk:24

},

{

name:"Taif",

lat:21.2703,

lon:40.4158,

population:780000,

elevation:1879,

terrain:"Plateau",

baseRisk:22

},

{

name:"Jeddah",

lat:21.5433,

lon:39.1728,

population:4700000,

elevation:12,

terrain:"Coastal",

baseRisk:15

},

{

name:"Riyadh",

lat:24.7136,

lon:46.6753,

population:7900000,

elevation:612,

terrain:"Desert",

baseRisk:12

},

{

name:"Dammam",

lat:26.4207,

lon:50.0888,

population:1250000,

elevation:8,

terrain:"Coastal",

baseRisk:11

}

],

async analyze(){

const weather=

await RG23.WeatherEngine

.analyzeCities(

this.cities

);

RG23.FloodEngine

.analyze(weather);

this.render(weather);

return weather;

},

render(cities){

const panel=

document.getElementById(

"cityPanel"

);

if(!panel) return;

panel.innerHTML="";

cities

.sort(

(a,b)=>

b.weatherScore-

a.weatherScore

)

.forEach(city=>{

panel.innerHTML+=`

<div class="item">

<b>${city.name}</b>

<br>

Population

${city.population.toLocaleString()}

<br>

Terrain

${city.terrain}

<br>

Weather

${city.weatherScore}%

<br>

Flood

${city.floodIndex}%

</div>

`;

});

}

};
