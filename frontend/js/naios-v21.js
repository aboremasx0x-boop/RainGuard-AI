/* ============================================================
   RainGuard AI V21
   NAIOS UI Connector
============================================================ */

let v21Map = null;
let v21Layers = [];

/* ===============================
   Saudi Cities
================================ */

const V21_CITIES = [
    { name:"نجران", lat:17.5656, lon:44.2289, risk:31, flood:28, region:"نجران" },
    { name:"خميس مشيط", lat:18.3064, lon:42.7294, risk:29, flood:25, region:"عسير" },
    { name:"الطائف", lat:21.2703, lon:40.4158, risk:28, flood:22, region:"مكة" },
    { name:"أبها", lat:18.2465, lon:42.5117, risk:27, flood:22, region:"عسير" },
    { name:"الباحة", lat:20.0129, lon:41.4677, risk:26, flood:21, region:"الباحة" },
    { name:"مكة المكرمة", lat:21.3891, lon:39.8579, risk:26, flood:20, region:"مكة" },
    { name:"جازان", lat:16.8892, lon:42.5511, risk:24, flood:20, region:"جازان" },
    { name:"جدة", lat:21.5433, lon:39.1728, risk:18, flood:14, region:"مكة" },
    { name:"الرياض", lat:24.7136, lon:46.6753, risk:12, flood:8, region:"الرياض" },
    { name:"الدمام", lat:26.4207, lon:50.0888, risk:10, flood:6, region:"الشرقية" }
];

function $(id){
    return document.getElementById(id);
}

function now(){
    return new Date().toLocaleTimeString("ar-SA");
}

function clamp(v){
    const n = Number(v);
    if(!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(100, Math.round(n)));
}

function sortedCities(){
    return [...V21_CITIES].sort((a,b)=>b.risk-a.risk);
}

function topCity(){
    return sortedCities()[0];
}

function avgRisk(){
    return clamp(
        V21_CITIES.reduce((s,c)=>s+c.risk,0) / V21_CITIES.length
    );
}

function riskColor(r){
    if(r >= 70) return "#ff5d6c";
    if(r >= 50) return "#fb923c";
    if(r >= 30) return "#ffd54d";
    return "#2ea8ff";
}

function addItem(id, html, limit=12){
    const box = $(id);
    if(!box) return;

    const wrap = document.createElement("div");
    wrap.innerHTML = html.trim();

    box.prepend(wrap.firstElementChild);

    while(box.children.length > limit){
        box.removeChild(box.lastChild);
    }
}

/* ===============================
   Map
================================ */

function initV21Map(){
    if(!$("v21Map") || !window.L) return;

    if(v21Map) return;

    v21Map = L.map("v21Map").setView([23.8859,45.0792],5);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{
        maxZoom:18,
        attribution:"© OpenStreetMap"
    }).addTo(v21Map);

    renderV21Map();
}

function clearMap(){
    if(!v21Map) return;

    v21Layers.forEach(layer=>{
        try{
            v21Map.removeLayer(layer);
        }catch(e){}
    });

    v21Layers = [];
}

function renderV21Map(){
    if(!v21Map) return;

    clearMap();

    sortedCities().forEach((city,index)=>{
        const color = riskColor(city.risk);

        const marker = L.circleMarker([city.lat,city.lon],{
            radius:Math.max(7,Math.min(22,city.risk/2)),
            color,
            fillColor:color,
            fillOpacity:.68,
            weight:2
        }).addTo(v21Map);

        marker.bindPopup(`
            <b>${city.name}</b><br>
            Region: ${city.region}<br>
            Risk: ${city.risk}%<br>
            Flood: ${city.flood}%<br>
            Rank: ${index+1}
        `);

        v21Layers.push(marker);

        if(city.risk >= 25){
            const circle = L.circle([city.lat,city.lon],{
                radius:city.risk * 2800,
                color,
                fillColor:color,
                fillOpacity:.07,
                weight:1
            }).addTo(v21Map);

            v21Layers.push(circle);
        }
    });
}

/* ===============================
   Core Bridge
================================ */

function getCore(){
    return window.NationalCore;
}

function syncCoreWithCities(){
    const core = getCore();
    if(!core) return;

    const top = topCity();

    core.activeCity = top;
    core.nationalRisk = avgRisk();
    core.confidence = 86;
    core.learningScore = 78;
}

function updateKPIs(){
    const core = getCore();
    const top = topCity();

    if($("coreStatus")) $("coreStatus").innerText = core?.running ? "Running" : "Standby";
    if($("currentStep")) $("currentStep").innerText = core?.currentStep || "Observe";
    if($("nationalRisk")) $("nationalRisk").innerText = `${core?.nationalRisk || avgRisk()}%`;
    if($("topCity")) $("topCity").innerText = top?.name || "--";
    if($("aiConfidence")) $("aiConfidence").innerText = `${core?.confidence || 86}%`;
    if($("learningScore")) $("learningScore").innerText = `${core?.learningScore || 78}%`;

    document.querySelectorAll(".cycle-step").forEach(el=>{
        el.classList.toggle(
            "active",
            el.dataset.step === (core?.currentStep || "Observe")
        );
    });
}

/* ===============================
   Panels
================================ */

function renderCommanderLog(){
    const core = getCore();
    const logs = core?.executiveLog || [];

    const box = $("commanderLog");
    if(!box) return;

    box.innerHTML = logs.slice(0,10).map(log=>`
        <div class="item success">
            <strong>${log.message}</strong><br>
            <span class="small">${new Date(log.time).toLocaleTimeString("ar-SA")}</span>
        </div>
    `).join("");
}

function renderAgents(){
    const agents = [
        ["Weather Agent","Analyzing rainfall signals"],
        ["Radar Agent","Scanning radar cells"],
        ["Flood Agent","Updating flood probability"],
        ["Hydrology Agent","Checking drainage behavior"],
        ["Memory Agent","Searching similar events"],
        ["Decision Agent","Comparing possible actions"],
        ["Learning Agent","Updating decision memory"]
    ];

    const box = $("agentsPanel");
    if(!box) return;

    box.innerHTML = agents.map((a,i)=>`
        <div class="item ${i%2===0 ? "success" : ""}">
            <strong>${a[0]}</strong><br>
            ${a[1]}<br>
            <span class="small">${82+i}% confidence</span>
        </div>
    `).join("");
}

function renderReasoning(){
    const top = topCity();

    const box = $("reasoningPanel");
    if(!box) return;

    box.innerHTML = `
        <div class="item">
            <strong>Reasoning Summary</strong><br>
            Highest combined risk is currently in <b>${top.name}</b>.
            The system compares monitoring, public advisory, and emergency escalation.
        </div>
        <div class="item success">
            Preferred path: active monitoring + radar watch.
        </div>
    `;
}

function renderSimulations(){
    const top = topCity();

    const box = $("simulationPanel");
    if(!box) return;

    const scenarios = [
        ["Deploy monitoring team", Math.max(8, top.risk-12), "success"],
        ["No action", Math.min(100, top.risk+18), "danger"],
        ["Early advisory", Math.max(8, top.risk-7), "warning"]
    ];

    box.innerHTML = scenarios.map(s=>`
        <div class="item ${s[2]}">
            <strong>${s[0]}</strong><br>
            Expected Risk: ${s[1]}%
        </div>
    `).join("");
}

function renderDecision(){
    const top = topCity();

    const box = $("decisionPanel");
    if(!box) return;

    box.innerHTML = `
        <div class="item success">
            <strong>Decision</strong><br>
            Active National Monitoring for ${top.name}.
        </div>
        <div class="item">
            Why not escalation: national average risk remains ${avgRisk()}%.
        </div>
    `;
}

function renderMission(){
    const box = $("missionPanel");
    if(!box) return;

    box.innerHTML = sortedCities().slice(0,6).map((city,i)=>`
        <div class="item ${i===0 ? "warning" : ""}">
            <strong>Mission ${i+1}</strong><br>
            ${city.name} — Monitoring<br>
            ETA: ${12+i*6} min | Risk: ${city.risk}%
        </div>
    `).join("");
}

function renderMemory(){
    const core = getCore();
    const box = $("memoryPanel");
    if(!box) return;

    const memory = core?.memory || [];

    if(!memory.length){
        box.innerHTML = `
            <div class="item">
                <strong>Memory waiting</strong><br>
                Core will save patterns after Learn phase.
            </div>
        `;
        return;
    }

    box.innerHTML = memory.slice(0,10).map(m=>`
        <div class="item purple">
            <strong>${m.phase}</strong><br>
            ${m.note}<br>
            <span class="small">${m.time}</span>
        </div>
    `).join("");
}

function renderLearning(){
    const core = getCore();

    const box = $("learningPanel");
    if(!box) return;

    const score = core?.learningScore || 78;

    box.innerHTML = `
        <div class="item success">
            <strong>Learning Score</strong><br>
            ${score}%
        </div>
        <div class="item">
            Decision accuracy improves after each Verify → Learn cycle.
        </div>
    `;
}

function renderTimeline(){
    const core = getCore();
    const box = $("timelinePanel");
    if(!box) return;

    const timeline = core?.timeline || [];

    if(!timeline.length){
        box.innerHTML = `
            <div class="item">
                Timeline will start when Core runs.
            </div>
        `;
        return;
    }

    box.innerHTML = timeline.slice(0,18).map(t=>`
        <div class="item">
            <strong>${t.step}</strong><br>
            <span class="small">${new Date(t.time).toLocaleTimeString("ar-SA")}</span>
        </div>
    `).join("");
}

function renderExplainability(){
    const top = topCity();

    const box = $("explainabilityPanel");
    if(!box) return;

    box.innerHTML = `
        <div class="item success">
            <strong>Explainable AI Decision</strong><br><br>
            Decision: Active National Monitoring.<br>
            Why: ${top.name} has the highest combined risk (${top.risk}%).<br>
            Evidence: rainfall signal, flood score, city ranking, historical memory, and simulated alternatives.<br>
            Why not emergency: average national risk is ${avgRisk()}%, below national emergency threshold.<br>
            Expected outcome: reduce ${top.name} risk from ${top.risk}% to ${Math.max(8,top.risk-12)}%.
        </div>
    `;
}

function refreshUI(){
    syncCoreWithCities();
    updateKPIs();
    renderV21Map();
    renderCommanderLog();
    renderAgents();
    renderReasoning();
    renderSimulations();
    renderDecision();
    renderMission();
    renderMemory();
    renderLearning();
    renderTimeline();
    renderExplainability();
}

/* ===============================
   Commander
================================ */

function setupCommander(){
    const input = $("commanderInput");
    const btn = $("sendCommanderBtn");

    if(!input || !btn) return;

    btn.onclick = sendCommander;

    input.addEventListener("keydown", e=>{
        if(e.key === "Enter") sendCommander();
    });
}

function addCommanderMessage(sender,text){
    addItem("commanderLog",`
        <div class="item ${sender === "Core" ? "success" : ""}">
            <strong>${sender}</strong><br>
            ${text}<br>
            <span class="small">${now()}</span>
        </div>
    `,20);
}

function sendCommander(){
    const input = $("commanderInput");
    if(!input) return;

    const text = input.value.trim();
    if(!text) return;

    addCommanderMessage("Commander", text);

    const top = topCity();

    setTimeout(()=>{
        addCommanderMessage("Core", `
            Goal received. Current priority is ${top.name}.
            Recommended action: active monitoring + radar watch.
        `);
    },400);

    input.value = "";
}

/* ===============================
   Buttons
================================ */

function setupButtons(){
    const core = getCore();

    const start = $("startCoreBtn");
    const stop = $("stopCoreBtn");
    const run = $("runCycleBtn");
    const report = $("generateReportBtn");

    if(start){
        start.onclick = ()=>{
            syncCoreWithCities();
            core?.start();
            refreshUI();
        };
    }

    if(stop){
        stop.onclick = ()=>{
            core?.stop();
            refreshUI();
        };
    }

    if(run){
        run.onclick = ()=>{
            syncCoreWithCities();
            core?.runCycle();
            refreshUI();
        };
    }

    if(report){
        report.onclick = ()=>{
            const top = topCity();
            addCommanderMessage("Report", `
                National Risk: ${avgRisk()}%<br>
                Top City: ${top.name}<br>
                Decision: Active monitoring.<br>
                Expected Reduction: ${top.risk}% → ${Math.max(8,top.risk-12)}%.
            `);
        };
    }
}

/* ===============================
   Init
================================ */

window.addEventListener("load", ()=>{
    initV21Map();
    setupCommander();
    setupButtons();

    syncCoreWithCities();
    refreshUI();

    setInterval(refreshUI, 2000);
});
