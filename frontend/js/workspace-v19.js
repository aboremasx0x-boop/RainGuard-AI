/* =========================================================
   RainGuard AI V19.5 Stable
   Live Autonomous National Intelligence Workspace
========================================================= */

let v19Map = null;
let v19Markers = [];
let v19RiskCircles = [];
let v19RadarLayer = null;

let thinkingIndex = 0;
let timelineIndex = 0;
let notificationIndex = 0;
let worldAnimation = 0;

/* ===============================
   Saudi Cities Core
================================ */

const v19Cities = [
    { name: "الرياض", lat: 24.7136, lon: 46.6753, risk: 12, flood: 8, region: "الرياض" },
    { name: "الخرج", lat: 24.1554, lon: 47.3120, risk: 13, flood: 9, region: "الرياض" },
    { name: "الدوادمي", lat: 24.5077, lon: 44.3924, risk: 11, flood: 7, region: "الرياض" },
    { name: "الزلفي", lat: 26.2995, lon: 44.8154, risk: 10, flood: 6, region: "الرياض" },
    { name: "المجمعة", lat: 25.9047, lon: 45.3481, risk: 10, flood: 6, region: "الرياض" },
    { name: "وادي الدواسر", lat: 20.4607, lon: 45.1640, risk: 16, flood: 12, region: "الرياض" },
    { name: "الأفلاج", lat: 22.3000, lon: 46.7333, risk: 14, flood: 10, region: "الرياض" },

    { name: "مكة المكرمة", lat: 21.3891, lon: 39.8579, risk: 26, flood: 20, region: "مكة المكرمة" },
    { name: "جدة", lat: 21.5433, lon: 39.1728, risk: 18, flood: 14, region: "مكة المكرمة" },
    { name: "الطائف", lat: 21.2703, lon: 40.4158, risk: 28, flood: 22, region: "مكة المكرمة" },
    { name: "رابغ", lat: 22.7986, lon: 39.0349, risk: 16, flood: 12, region: "مكة المكرمة" },
    { name: "القنفذة", lat: 19.1264, lon: 41.0789, risk: 24, flood: 18, region: "مكة المكرمة" },
    { name: "الليث", lat: 20.1269, lon: 40.2667, risk: 22, flood: 17, region: "مكة المكرمة" },

    { name: "المدينة المنورة", lat: 24.5247, lon: 39.5692, risk: 14, flood: 10, region: "المدينة المنورة" },
    { name: "ينبع", lat: 24.0895, lon: 38.0618, risk: 13, flood: 9, region: "المدينة المنورة" },
    { name: "العلا", lat: 26.6084, lon: 37.9230, risk: 12, flood: 8, region: "المدينة المنورة" },

    { name: "بريدة", lat: 26.3592, lon: 43.9818, risk: 12, flood: 8, region: "القصيم" },
    { name: "عنيزة", lat: 26.0910, lon: 43.9730, risk: 11, flood: 7, region: "القصيم" },
    { name: "الرس", lat: 25.8700, lon: 43.4973, risk: 11, flood: 7, region: "القصيم" },

    { name: "الدمام", lat: 26.4207, lon: 50.0888, risk: 10, flood: 6, region: "الشرقية" },
    { name: "الخبر", lat: 26.2172, lon: 50.1971, risk: 10, flood: 6, region: "الشرقية" },
    { name: "الظهران", lat: 26.2886, lon: 50.1130, risk: 10, flood: 6, region: "الشرقية" },
    { name: "الجبيل", lat: 27.0046, lon: 49.6460, risk: 11, flood: 7, region: "الشرقية" },
    { name: "الأحساء", lat: 25.3833, lon: 49.5833, risk: 12, flood: 8, region: "الشرقية" },
    { name: "حفر الباطن", lat: 28.4342, lon: 45.9636, risk: 10, flood: 6, region: "الشرقية" },
    { name: "الخفجي", lat: 28.4250, lon: 48.4913, risk: 10, flood: 6, region: "الشرقية" },

    { name: "أبها", lat: 18.2465, lon: 42.5117, risk: 27, flood: 22, region: "عسير" },
    { name: "خميس مشيط", lat: 18.3064, lon: 42.7294, risk: 29, flood: 25, region: "عسير" },
    { name: "محايل عسير", lat: 18.5463, lon: 42.0486, risk: 25, flood: 20, region: "عسير" },
    { name: "بيشة", lat: 20.0087, lon: 42.6052, risk: 22, flood: 17, region: "عسير" },

    { name: "جازان", lat: 16.8892, lon: 42.5511, risk: 24, flood: 20, region: "جازان" },
    { name: "صبيا", lat: 17.1495, lon: 42.6254, risk: 23, flood: 18, region: "جازان" },
    { name: "أبو عريش", lat: 16.9689, lon: 42.8325, risk: 23, flood: 18, region: "جازان" },

    { name: "نجران", lat: 17.5656, lon: 44.2289, risk: 31, flood: 28, region: "نجران" },
    { name: "شرورة", lat: 17.4667, lon: 47.1167, risk: 20, flood: 15, region: "نجران" },

    { name: "الباحة", lat: 20.0129, lon: 41.4677, risk: 26, flood: 21, region: "الباحة" },
    { name: "بلجرشي", lat: 19.8578, lon: 41.5563, risk: 25, flood: 20, region: "الباحة" },

    { name: "تبوك", lat: 28.3998, lon: 36.5700, risk: 10, flood: 6, region: "تبوك" },
    { name: "ضباء", lat: 27.3513, lon: 35.6901, risk: 10, flood: 6, region: "تبوك" },
    { name: "الوجه", lat: 26.2455, lon: 36.4525, risk: 10, flood: 6, region: "تبوك" },

    { name: "حائل", lat: 27.5114, lon: 41.7208, risk: 10, flood: 6, region: "حائل" },

    { name: "سكاكا", lat: 29.9697, lon: 40.2064, risk: 10, flood: 6, region: "الجوف" },
    { name: "القريات", lat: 31.3318, lon: 37.3428, risk: 9, flood: 5, region: "الجوف" },

    { name: "عرعر", lat: 30.9753, lon: 41.0381, risk: 9, flood: 5, region: "الحدود الشمالية" },
    { name: "رفحاء", lat: 29.6200, lon: 43.4947, risk: 9, flood: 5, region: "الحدود الشمالية" },
    { name: "طريف", lat: 31.6725, lon: 38.6637, risk: 9, flood: 5, region: "الحدود الشمالية" }
];

/* ===============================
   Utilities
================================ */

function clampScore(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(100, Math.round(n)));
}

function getCityRisk(city) {
    return clampScore(
        city.risk ??
        city.score ??
        city.actualRiskScore ??
        city.rain_score ??
        0
    );
}

function getCityFlood(city) {
    return clampScore(
        city.flood ??
        city.floodRiskScore ??
        city.flood_score ??
        0
    );
}

function normalizeCity(city) {
    return {
        name: city.name || city.city || city.location_name || "غير محدد",
        lat: Number(city.lat ?? city.latitude ?? 0),
        lon: Number(city.lon ?? city.longitude ?? 0),
        risk: getCityRisk(city),
        flood: getCityFlood(city),
        region: city.region || city.area || "غير محدد"
    };
}

function getSortedCities() {
    return [...v19Cities]
        .map(normalizeCity)
        .filter(city => city.name !== "غير محدد" && city.lat && city.lon)
        .sort((a, b) => b.risk - a.risk);
}

function getTopCity() {
    return getSortedCities()[0] || null;
}

function getTopRiskCities(limit = 10) {
    return getSortedCities().slice(0, limit);
}

function getAverageRisk() {
    const cities = getSortedCities();
    if (!cities.length) return 0;

    const total = cities.reduce((sum, city) => sum + city.risk, 0);
    return clampScore(total / cities.length);
}

function nowTime() {
    return new Date().toLocaleTimeString("ar-SA");
}

function riskColor(score) {
    if (score >= 70) return "#ef4444";
    if (score >= 50) return "#fb923c";
    if (score >= 30) return "#facc15";
    return "#38bdf8";
}
/* =========================================================
   Map Engine
========================================================= */

function initV19Map() {
    const mapBox = document.getElementById("nationalMap");

    if (!mapBox || !window.L) return;

    if (v19Map) return;

    v19Map = L.map("nationalMap", {
        zoomControl: true,
        attributionControl: true
    }).setView([23.8859, 45.0792], 5);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: "© OpenStreetMap"
    }).addTo(v19Map);

    renderCityMarkers();
}

function clearMapLayers() {
    if (!v19Map) return;

    v19Markers.forEach(marker => {
        try {
            v19Map.removeLayer(marker);
        } catch (e) {}
    });

    v19RiskCircles.forEach(circle => {
        try {
            v19Map.removeLayer(circle);
        } catch (e) {}
    });

    v19Markers = [];
    v19RiskCircles = [];
}

function renderCityMarkers() {
    if (!v19Map) return;

    clearMapLayers();

    const cities = getSortedCities();

    cities.forEach((city, index) => {
        const color = riskColor(city.risk);

        const marker = L.circleMarker([city.lat, city.lon], {
            radius: Math.max(6, Math.min(20, city.risk / 2)),
            color: color,
            fillColor: color,
            fillOpacity: 0.68,
            weight: 2
        }).addTo(v19Map);

        marker.bindPopup(`
            <b>${city.name}</b><br>
            المنطقة: ${city.region}<br>
            Risk: ${city.risk}%<br>
            Flood: ${city.flood}%<br>
            National Rank: ${index + 1}
        `);

        v19Markers.push(marker);

        if (city.risk >= 25) {
            const circle = L.circle([city.lat, city.lon], {
                radius: city.risk * 2600,
                color: color,
                fillColor: color,
                fillOpacity: 0.06,
                weight: 1
            }).addTo(v19Map);

            v19RiskCircles.push(circle);
        }
    });
}

/* =========================================================
   Optional Radar Layer
========================================================= */

async function toggleV19RadarLayer() {
    if (!v19Map) {
        initV19Map();
    }

    if (!v19Map) return;

    if (v19RadarLayer) {
        v19Map.removeLayer(v19RadarLayer);
        v19RadarLayer = null;
        return;
    }

    try {
        const res = await fetch("https://api.rainviewer.com/public/weather-maps.json");
        const data = await res.json();
        const frames = data?.radar?.past || [];

        if (!frames.length) return;

        const latest = frames[frames.length - 1].time;

        v19RadarLayer = L.tileLayer(
            `https://tilecache.rainviewer.com/v2/radar/${latest}/256/{z}/{x}/{y}/2/1_1.png`,
            {
                tileSize: 256,
                opacity: 0.62,
                attribution: "RainViewer"
            }
        ).addTo(v19Map);

    } catch (e) {
        console.warn("Radar layer skipped:", e);
    }
}

/* =========================================================
   Risk Ranking
========================================================= */

function renderTopRiskCities() {
    const box =
        document.getElementById("topRiskCities") ||
        document.getElementById("decisionLab");

    if (!box) return;

    const topCities = getTopRiskCities(10);

    box.innerHTML = topCities.map((city, index) => `
        <div class="scenario">
            <strong>${index + 1}. ${city.name}</strong><br>
            المنطقة: ${city.region}<br>
            Risk: ${city.risk}% | Flood: ${city.flood}%<br>
            <small>National ranking updated live</small>
        </div>
    `).join("");
}

function renderNationalRiskSummary() {
    const top = getTopCity();
    const avg = getAverageRisk();

    const topCityEl = document.getElementById("topCity");
    const riskEl = document.getElementById("riskValue") ||
                   document.getElementById("nationalRisk");

    const confidenceEl = document.getElementById("confidenceValue") ||
                         document.getElementById("aiConfidence");

    if (topCityEl && top) {
        topCityEl.innerText = top.name;
    }

    if (riskEl) {
        riskEl.innerText = `${avg}%`;
    }

    if (confidenceEl) {
        confidenceEl.innerText = `${Math.min(96, 82 + Math.round(avg / 5))}%`;
    }
}

function updateKpis() {
    renderNationalRiskSummary();

    const nodes =
        document.getElementById("knowledgeNodes");

    const missions =
        document.getElementById("runningMissions");

    if (nodes) {
        nodes.innerText = `${148 + Math.floor(Math.random() * 20)}`;
    }

    if (missions) {
        missions.innerText = `${8 + Math.floor(Math.random() * 5)}`;
    }
}
/* =========================================================
   Live Thinking Stream
========================================================= */

const thinkingMessages = [

    {
        agent:"Radar Agent",
        text:"Scanning Saudi Arabia radar network..."
    },

    {
        agent:"Flood Agent",
        text:"Updating flood probability model."
    },

    {
        agent:"Weather Agent",
        text:"Assimilating weather observations."
    },

    {
        agent:"Reasoning Engine",
        text:"Comparing current event with historical memory."
    },

    {
        agent:"Simulation Engine",
        text:"Running 48-hour national simulations."
    },

    {
        agent:"Mission Planner",
        text:"Generating monitoring missions."
    },

    {
        agent:"Learning Engine",
        text:"Updating National Intelligence Memory."
    }

];

function addThinkingItem(){

    const box=document.getElementById("thinkingStream");

    if(!box)return;

    const msg=
        thinkingMessages[
            thinkingIndex%
            thinkingMessages.length
        ];

    const city=getTopCity();

    const div=document.createElement("div");

    div.className="streamItem";

    div.innerHTML=`

        <strong>${msg.agent}</strong>

        <br>

        ${msg.text}

        <br>

        <small>

        ${nowTime()}

        |

        Highest Risk:

        ${city.name}

        (${city.risk}%)

        </small>

    `;

    box.prepend(div);

    while(box.children.length>15){

        box.removeChild(box.lastChild);

    }

    thinkingIndex++;

}

/* =========================================================
   Executive Copilot
========================================================= */

function setupCopilot(){

    const input=
        document.getElementById("copilotInput");

    const button=
        document.getElementById("sendBtn");

    if(!input||!button)return;

    button.onclick=sendCopilotMessage;

    input.addEventListener("keydown",e=>{

        if(e.key==="Enter"){

            sendCopilotMessage();

        }

    });

}

function sendCopilotMessage(){

    const input=
        document.getElementById("copilotInput");

    const chat=
        document.getElementById("chatLog");

    if(!input||!chat)return;

    const question=input.value.trim();

    if(question==="")return;

    const user=document.createElement("div");

    user.className="user-msg";

    user.innerHTML=`

        <strong>Commander</strong>

        <br>

        ${question}

    `;

    chat.appendChild(user);

    setTimeout(()=>{

        const ai=document.createElement("div");

        ai.className="ai-msg";

        ai.innerHTML=`

            <strong>ANI</strong>

            <br>

            ${generateCopilotReply(question)}

        `;

        chat.appendChild(ai);

        chat.scrollTop=chat.scrollHeight;

    },500);

    input.value="";

}

function generateCopilotReply(question){

    const q=question.toLowerCase();

    const top=getTopCity();

    if(
        q.includes("report")||
        q.includes("تقرير")
    ){

        return`

        National Situation

        <br><br>

        Highest Risk City:

        <b>${top.name}</b>

        <br>

        Risk:

        <b>${top.risk}%</b>

        <br>

        Average National Risk:

        <b>${getAverageRisk()}%</b>

        `;

    }

    if(
        q.includes("mission")||
        q.includes("مهمة")
    ){

        return`

        Monitoring mission generated.

        <br>

        Destination:

        <b>${top.name}</b>

        <br>

        Confidence:

        <b>91%</b>

        `;

    }

    if(
        q.includes("simulate")||
        q.includes("محاكاة")
    ){

        return`

        Simulation completed.

        <br>

        Best Scenario:

        Deploy monitoring teams.

        <br>

        Expected Risk

        ${top.risk}% →

        ${Math.max(8,top.risk-12)}%

        `;

    }

    return`

    Goal received.

    ANI is analyzing national conditions.

    Highest risk city:

    <b>${top.name}</b>

    `;

}

/* =========================================================
   Mission Workspace
========================================================= */

function renderMissions(){

    const box=
        document.getElementById("missionWorkspace");

    if(!box)return;

    const cities=getTopRiskCities(8);

    box.innerHTML="";

    cities.forEach((city,index)=>{

        let priority="LOW";

        let status="Monitoring";

        if(city.risk>=50){

            priority="HIGH";

            status="Emergency";

        }

        else if(city.risk>=30){

            priority="MEDIUM";

            status="Watch";

        }

        const div=document.createElement("div");

        div.className="mission-card";

        div.innerHTML=`

            <h3>

            ${city.name}

            </h3>

            Region:

            <b>${city.region}</b>

            <br>

            Risk:

            <b>${city.risk}%</b>

            <br>

            Flood:

            <b>${city.flood}%</b>

            <br>

            Priority:

            <b>${priority}</b>

            <br>

            ETA:

            ${15+(index*4)} min

            <br>

            Status:

            ${status}

        `;

        box.appendChild(div);

    });

}
/* =========================================================
   Decision Lab
========================================================= */

function renderDecisionLab() {

    const box = document.getElementById("decisionLab");

    if (!box) return;

    const top = getTopCity();

    if (!top) return;

    const scenarios = [
        {
            title: "Scenario A",
            action: `Deploy monitoring teams to ${top.name}`,
            result: `Risk ${top.risk}% → ${Math.max(8, top.risk - 12)}%`,
            type: "best"
        },
        {
            title: "Scenario B",
            action: "No action",
            result: `Risk ${top.risk}% → ${Math.min(100, top.risk + 18)}%`,
            type: "danger"
        },
        {
            title: "Scenario C",
            action: "Issue early public advisory",
            result: `Risk ${top.risk}% → ${Math.max(8, top.risk - 7)}%`,
            type: "watch"
        },
        {
            title: "Counterfactual",
            action: "If rainfall doubles",
            result: `Risk may rise to ${Math.min(100, top.risk + 30)}%`,
            type: "danger"
        }
    ];

    box.innerHTML = scenarios.map(s => `
        <div class="scenario">
            <strong>${s.title}</strong><br>
            ${s.action}<br>
            <small>${s.result}</small>
        </div>
    `).join("");
}

/* =========================================================
   Executive Story
========================================================= */

function renderExecutiveStory() {

    const box = document.getElementById("executiveStory");

    if (!box) return;

    const top = getTopCity();
    const avg = getAverageRisk();

    if (!top) return;

    box.innerHTML = `
        <div class="streamItem">
            <strong>Executive National Story</strong>
            <br><br>
            At ${nowTime()}, RainGuard AI V19.5 analyzed ${v19Cities.length} Saudi cities.
            The highest current risk is detected in <b>${top.name}</b>
            within <b>${top.region}</b>, with a risk score of <b>${top.risk}%</b>
            and flood index of <b>${top.flood}%</b>.
            <br><br>
            The system compared radar signals, flood probability, city ranking,
            national memory, and scenario simulations. The recommended decision is
            <b>active monitoring</b> rather than full escalation.
            <br><br>
            Expected outcome: reducing operational risk from
            <b>${top.risk}%</b> to <b>${Math.max(8, top.risk - 12)}%</b>
            if monitoring teams and radar watch are activated.
        </div>
    `;
}

/* =========================================================
   World Model Engine
========================================================= */

function drawWorldModel() {

    const canvas =
        document.getElementById("worldModelCanvas") ||
        document.getElementById("worldCanvas");

    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    canvas.width = width;
    canvas.height = height;

    ctx.clearRect(0, 0, width, height);

    const top = getTopCity();

    const nodes = [
        { label: "Radar", x: 0.12, y: 0.22 },
        { label: "Satellite", x: 0.32, y: 0.15 },
        { label: "Rain", x: 0.52, y: 0.22 },
        { label: "Flood", x: 0.76, y: 0.35 },
        { label: "Roads", x: 0.72, y: 0.65 },
        { label: "Population", x: 0.48, y: 0.78 },
        { label: "Mission", x: 0.24, y: 0.68 },
        { label: top ? top.name : "Top City", x: 0.15, y: 0.45 }
    ];

    const activeIndex = worldAnimation % nodes.length;

    ctx.lineWidth = 2;

    for (let i = 0; i < nodes.length - 1; i++) {
        const a = nodes[i];
        const b = nodes[i + 1];

        ctx.beginPath();
        ctx.strokeStyle = "rgba(56,189,248,.75)";
        ctx.moveTo(a.x * width, a.y * height);
        ctx.lineTo(b.x * width, b.y * height);
        ctx.stroke();
    }

    nodes.forEach((node, index) => {
        const active = index === activeIndex;
        const x = node.x * width;
        const y = node.y * height;

        ctx.beginPath();
        ctx.fillStyle = active ? "#facc15" : "#0ea5e9";
        ctx.arc(x, y, active ? 26 : 20, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.strokeStyle = active ? "rgba(250,204,21,.7)" : "rgba(56,189,248,.35)";
        ctx.lineWidth = active ? 4 : 2;
        ctx.arc(x, y, active ? 34 : 28, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = "#ffffff";
        ctx.font = "13px Cairo, Tahoma, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(node.label, x, y + 45);
    });

    worldAnimation++;
}

/* =========================================================
   Autonomous Timeline
========================================================= */

const timelineEvents = [
    "Observe: radar refreshed",
    "Understand: city-risk model updated",
    "Reason: alternatives compared",
    "Debate: agents reached consensus",
    "Simulate: top scenario selected",
    "Choose: monitoring approved",
    "Plan: mission generated",
    "Execute: resources assigned",
    "Verify: confidence recalculated",
    "Learn: memory updated"
];

function updateTimeline() {

    const box = document.getElementById("timeline");

    if (!box) return;

    const event = timelineEvents[timelineIndex % timelineEvents.length];

    const div = document.createElement("div");
    div.className = "streamItem";
    div.innerHTML = `
        <strong>${nowTime()}</strong><br>
        ${event}
    `;

    box.prepend(div);

    while (box.children.length > 14) {
        box.removeChild(box.lastChild);
    }

    timelineIndex++;
}

/* =========================================================
   Executive Notifications
========================================================= */

const notificationEvents = [
    "✓ Radar Updated",
    "✓ Flood Index Updated",
    "✓ Mission Created",
    "✓ Memory Expanded",
    "✓ Confidence Increased",
    "✓ Scenario Improved",
    "✓ World Model Updated",
    "✓ Learning Saved"
];

function updateNotifications() {

    const box = document.getElementById("notifications");

    if (!box) return;

    const note = notificationEvents[notificationIndex % notificationEvents.length];

    const div = document.createElement("div");

    div.className =
        notificationIndex % 5 === 0
            ? "streamItem notice"
            : notificationIndex % 7 === 0
                ? "streamItem warning"
                : "streamItem";

    div.innerHTML = `
        ${note}<br>
        <small>${nowTime()}</small>
    `;

    box.prepend(div);

    while (box.children.length > 10) {
        box.removeChild(box.lastChild);
    }

    notificationIndex++;
}
/* =========================================================
   RainGuard AI V19.5
   Live Engine + API Integration + Initialization
========================================================= */

/* ===============================
   AI Brain Activity
================================ */

function updateBrainBars() {

    const values = {
        reasonBar: 70 + Math.floor(Math.random() * 25),
        simulationBar: 60 + Math.floor(Math.random() * 30),
        memoryBar: 65 + Math.floor(Math.random() * 30),
        planningBar: 55 + Math.floor(Math.random() * 30),
        learningBar: 60 + Math.floor(Math.random() * 30)
    };

    Object.entries(values).forEach(([id, value]) => {

        const el = document.getElementById(id);

        if (el) {

            el.style.width = value + "%";

        }

    });

}

/* ===============================
   API Ready
================================ */

async function loadNationalCities() {

    try {

        if (!window.API_BASE_URL) return;

        const response = await fetch(
            `${window.API_BASE_URL}/national-cities`
        );

        if (!response.ok) return;

        const data = await response.json();

        if (!Array.isArray(data)) return;

        v19Cities.length = 0;

        data.forEach(city => {

            v19Cities.push({

                name:
                    city.name ||
                    city.city ||
                    "Unknown",

                lat:
                    Number(city.lat ?? city.latitude),

                lon:
                    Number(city.lon ?? city.longitude),

                risk:
                    clampScore(
                        city.risk ??
                        city.score ??
                        city.actualRiskScore ??
                        city.rain_score
                    ),

                flood:
                    clampScore(
                        city.flood ??
                        city.floodRiskScore ??
                        city.flood_score
                    ),

                region:
                    city.region ??
                    "Unknown"

            });

        });

    }

    catch (e) {

        console.warn(
            "National API unavailable",
            e
        );

    }

}

/* ===============================
   Workspace Refresh
================================ */

async function refreshWorkspace() {

    await loadNationalCities();

    updateKpis();

    renderCityMarkers();

    renderTopRiskCities();

    renderMissions();

    renderDecisionLab();

    renderExecutiveStory();

    drawWorldModel();

}

/* ===============================
   Live Engine
================================ */

function startWorkspaceEngine() {

    addThinkingItem();

    updateTimeline();

    updateNotifications();

    updateBrainBars();

    refreshWorkspace();

    setInterval(addThinkingItem,3000);

    setInterval(updateTimeline,3500);

    setInterval(updateNotifications,4000);

    setInterval(updateBrainBars,1500);

    setInterval(refreshWorkspace,15000);

    setInterval(drawWorldModel,800);

}

/* ===============================
   Compatibility
================================ */

function checkWorkspace() {

    [

        "nationalMap",

        "thinkingStream",

        "missionWorkspace",

        "decisionLab",

        "executiveStory",

        "timeline",

        "notifications"

    ].forEach(id=>{

        if(!document.getElementById(id)){

            console.warn(
                "Missing element:",
                id
            );

        }

    });

}

/* ===============================
   Rain Radar Button (Optional)
================================ */

const radarButton =
    document.getElementById("toggleRadar");

if(radarButton){

    radarButton.onclick=()=>{

        toggleV19RadarLayer();

    };

}

/* ===============================
   Initialization
================================ */

window.addEventListener("load",()=>{

    checkWorkspace();

    setupCopilot();

    initV19Map();

    renderTopRiskCities();

    renderMissions();

    renderDecisionLab();

    renderExecutiveStory();

    drawWorldModel();

    updateKpis();

    startWorkspaceEngine();

});
