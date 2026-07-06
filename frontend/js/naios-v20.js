/* =========================================================
   RainGuard AI V20
   National AI Operating System
========================================================= */

let naiosMap = null;
let mapLayers = [];
let cycleIndex = 0;
let timelineIndex = 0;
let agentIndex = 0;

const cities = [
    { name:"نجران", lat:17.5656, lon:44.2289, risk:31, flood:28, region:"نجران" },
    { name:"خميس مشيط", lat:18.3064, lon:42.7294, risk:29, flood:25, region:"عسير" },
    { name:"الطائف", lat:21.2703, lon:40.4158, risk:28, flood:22, region:"مكة المكرمة" },
    { name:"أبها", lat:18.2465, lon:42.5117, risk:27, flood:22, region:"عسير" },
    { name:"الباحة", lat:20.0129, lon:41.4677, risk:26, flood:21, region:"الباحة" },
    { name:"مكة المكرمة", lat:21.3891, lon:39.8579, risk:26, flood:20, region:"مكة المكرمة" },
    { name:"جازان", lat:16.8892, lon:42.5511, risk:24, flood:20, region:"جازان" },
    { name:"جدة", lat:21.5433, lon:39.1728, risk:18, flood:14, region:"مكة المكرمة" },
    { name:"الرياض", lat:24.7136, lon:46.6753, risk:12, flood:8, region:"الرياض" },
    { name:"الدمام", lat:26.4207, lon:50.0888, risk:10, flood:6, region:"الشرقية" }
];

const agents = [
    ["Weather AI", "Rain trend supports active monitoring."],
    ["Hydrology AI", "Flood index requires continued observation."],
    ["Radar AI", "Radar cells remain active in the southern sector."],
    ["Traffic AI", "No road closure detected yet."],
    ["Emergency AI", "No full escalation required now."],
    ["Decision AI", "Monitoring strategy approved."],
    ["Learning AI", "Pattern saved to national memory."]
];

const timelineEvents = [
    "Observe: radar layer updated",
    "Understand: national risk recalculated",
    "Reason: alternatives compared",
    "Simulate: future scenarios tested",
    "Decide: monitoring selected",
    "Plan: mission generated",
    "Execute: resources assigned",
    "Verify: confidence checked",
    "Learn: memory updated"
];

function clamp(v){
    const n = Number(v);
    if(!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(100, Math.round(n)));
}

function sortedCities(){
    return [...cities].sort((a,b)=>b.risk-a.risk);
}

function topCity(){
    return sortedCities()[0];
}

function avgRisk(){
    const total = cities.reduce((s,c)=>s+c.risk,0);
    return clamp(total / cities.length);
}

function colorRisk(risk){
    if(risk >= 70) return "#ff6767";
    if(risk >= 50) return "#ff9f43";
    if(risk >= 30) return "#ffd54d";
    return "#39b8ff";
}

function now(){
    return new Date().toLocaleTimeString("ar-SA");
}

/* ================= MAP ================= */

function initMap(){
    const box = document.getElementById("naiosMap");
    if(!box || !window.L) return;

    if(naiosMap) return;

    naiosMap = L.map("naiosMap").setView([23.8859,45.0792],5);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{
        maxZoom:18,
        attribution:"© OpenStreetMap"
    }).addTo(naiosMap);

    renderMap();
}

function clearMap(){
    if(!naiosMap) return;

    mapLayers.forEach(layer=>{
        try{ naiosMap.removeLayer(layer); }catch(e){}
    });

    mapLayers = [];
}

function renderMap(){
    if(!naiosMap) return;

    clearMap();

    sortedCities().forEach((city,index)=>{
        const color = colorRisk(city.risk);

        const marker = L.circleMarker([city.lat,city.lon],{
            radius:Math.max(7, Math.min(22, city.risk/2)),
            color,
            fillColor:color,
            fillOpacity:.68,
            weight:2
        }).addTo(naiosMap);

        marker.bindPopup(`
            <b>${city.name}</b><br>
            Region: ${city.region}<br>
            Risk: ${city.risk}%<br>
            Flood: ${city.flood}%<br>
            Rank: ${index+1}
        `);

        mapLayers.push(marker);

        if(city.risk >= 25){
            const circle = L.circle([city.lat,city.lon],{
                radius:city.risk * 2800,
                color,
                fillColor:color,
                fillOpacity:.07,
                weight:1
            }).addTo(naiosMap);

            mapLayers.push(circle);
        }
    });
}

/* ================= UI ================= */

function addItem(id, html, limit=12){
    const box = document.getElementById(id);
    if(!box) return;

    const wrapper = document.createElement("div");
    wrapper.innerHTML = html.trim();

    box.prepend(wrapper.firstElementChild);

    while(box.children.length > limit){
        box.removeChild(box.lastChild);
    }
}

function updateStatus(){
    const top = topCity();

    const risk = document.getElementById("nationalRisk");
    const city = document.getElementById("topCity");
    const conf = document.getElementById("aiConfidence");
    const agentsEl = document.getElementById("activeAgents");
    const missions = document.getElementById("missionCount");

    if(risk) risk.innerText = `${avgRisk()}%`;
    if(city) city.innerText = top.name;
    if(conf) conf.innerText = `${86 + Math.floor(Math.random()*6)}%`;
    if(agentsEl) agentsEl.innerText = `${18 + Math.floor(Math.random()*5)}`;
    if(missions) missions.innerText = `${9 + Math.floor(Math.random()*4)}`;
}

function animateCycle(){
    const nodes = document.querySelectorAll(".cycle-node");
    if(!nodes.length) return;

    nodes.forEach(n=>n.classList.remove("active"));
    nodes[cycleIndex % nodes.length].classList.add("active");
    cycleIndex++;
}

/* ================= PANELS ================= */

function renderBrainActivity(){
    const metrics = [
        ["Reasoning", 90],
        ["Simulation", 78],
        ["Memory", 84],
        ["Planning", 72],
        ["Learning", 81],
        ["Agent Debate", 76]
    ];

    const box = document.getElementById("brainActivity");
    if(!box) return;

    box.innerHTML = metrics.map(m=>`
        <div class="item">
            <strong>${m[0]}</strong><br>
            ${m[1] + Math.floor(Math.random()*6)}%
        </div>
    `).join("");
}

function renderMissionControl(){
    const box = document.getElementById("missionControl");
    if(!box) return;

    box.innerHTML = sortedCities().slice(0,6).map((c,i)=>`
        <div class="item ${i===0 ? "warning" : ""}">
            <strong>Mission ${i+1}</strong><br>
            ${c.name} — Active monitoring<br>
            ETA: ${12 + i*6} min | Risk: ${c.risk}%
        </div>
    `).join("");
}

function renderDecisionSimulator(){
    const top = topCity();
    const box = document.getElementById("decisionSimulator");
    if(!box) return;

    const scenarios = [
        ["Best Plan", Math.max(8, top.risk-13), "success"],
        ["No Action", Math.min(100, top.risk+18), "danger"],
        ["Early Advisory", Math.max(8, top.risk-7), "warning"],
        ["Radar Watch", Math.max(8, top.risk-10), "success"]
    ];

    box.innerHTML = scenarios.map(s=>`
        <div class="item ${s[2]}">
            <strong>${s[0]}</strong><br>
            Expected Risk: ${s[1]}%
        </div>
    `).join("");
}

function renderAgentCouncil(){
    const agent = agents[agentIndex % agents.length];

    addItem("agentCouncil", `
        <div class="item">
            <strong>${agent[0]}</strong><br>
            ${agent[1]}<br>
            <small>${now()}</small>
        </div>
    `, 10);

    agentIndex++;
}

function renderTimeline(){
    const event = timelineEvents[timelineIndex % timelineEvents.length];

    addItem("nationalTimeline", `
        <div class="item">
            <strong>${now()}</strong><br>
            ${event}
        </div>
    `, 14);

    timelineIndex++;
}

function renderExplainableDecision(){
    const top = topCity();
    const box = document.getElementById("explainableDecision");
    if(!box) return;

    box.innerHTML = `
        <div class="item success">
            <strong>Decision: Active National Monitoring</strong><br><br>
            Why: ${top.name} has the highest current combined risk (${top.risk}%).<br>
            Evidence: Rain score + flood index + city ranking + radar monitoring.<br>
            Why not emergency: National average risk is ${avgRisk()}%, below full escalation threshold.<br>
            Alternative: Radar watch + monitoring team deployment.<br>
            Expected outcome: reduce ${top.name} risk from ${top.risk}% to ${Math.max(8,top.risk-13)}%.
        </div>
    `;
}

/* ================= COMMANDER ================= */

function setupCommander(){
    const input = document.getElementById("commanderInput");
    const btn = document.getElementById("sendCommand");

    if(!input || !btn) return;

    btn.onclick = sendCommand;

    input.addEventListener("keydown", e=>{
        if(e.key === "Enter") sendCommand();
    });

    addCommander("ANI", "National AI Operating System is online. أدخل هدفًا تشغيليًا.");
}

function addCommander(sender,text){
    addItem("commanderOutput",`
        <div class="item ${sender === "ANI" ? "success" : ""}">
            <strong>${sender}</strong><br>
            ${text}
        </div>
    `,20);
}

function sendCommand(){
    const input = document.getElementById("commanderInput");
    if(!input) return;

    const text = input.value.trim();
    if(!text) return;

    addCommander("Commander", text);

    const top = topCity();

    setTimeout(()=>{
        addCommander("ANI", `
            Goal received. Running Observe → Reason → Simulate → Plan → Execute.
            <br><br>
            Target: ${top.name}<br>
            Current Risk: ${top.risk}%<br>
            Recommended Action: Deploy monitoring team + radar watch.
        `);
        renderTimeline();
        renderAgentCouncil();
        renderMissionControl();
    },500);

    input.value = "";
}

/* ================= BUTTONS ================= */

function setupButtons(){
    const run = document.getElementById("btnRunOS");
    const radar = document.getElementById("btnRadar");
    const simulate = document.getElementById("btnSimulate");
    const report = document.getElementById("btnReport");

    if(run){
        run.onclick = ()=>{
            addCommander("ANI", "National OS cycle started. All agents are active.");
            renderTimeline();
            renderAgentCouncil();
        };
    }

    if(radar){
        radar.onclick = ()=>{
            addCommander("Radar AI", "Radar layer requested. RainViewer integration can be connected here.");
        };
    }

    if(simulate){
        simulate.onclick = ()=>{
            renderDecisionSimulator();
            addCommander("Simulation AI", "Decision simulation completed.");
        };
    }

    if(report){
        report.onclick = ()=>{
            const top = topCity();
            addCommander("Executive Report", `
                National Risk: ${avgRisk()}%<br>
                Top City: ${top.name}<br>
                Decision: Active monitoring.<br>
                Expected Reduction: ${top.risk}% → ${Math.max(8,top.risk-13)}%.
            `);
        };
    }
}

/* ================= INIT ================= */

function refreshAll(){
    updateStatus();
    renderMap();
    renderBrainActivity();
    renderMissionControl();
    renderDecisionSimulator();
    renderExplainableDecision();
}

window.addEventListener("load",()=>{
    initMap();
    setupCommander();
    setupButtons();

    refreshAll();
    renderAgentCouncil();
    renderTimeline();

    setInterval(animateCycle,900);
    setInterval(updateStatus,2500);
    setInterval(renderAgentCouncil,3500);
    setInterval(renderTimeline,4200);
    setInterval(renderBrainActivity,5000);
});
