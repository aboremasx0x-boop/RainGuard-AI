/* =========================================================
   RainGuard AI V19.5
   National Autonomous Intelligence Workspace
   Saudi Cities Core + Risk Utilities
========================================================= */

let v19Map = null;
let v19Markers = [];
let v19RiskCircles = [];
let thinkingIndex = 0;

/* ===============================
   جميع مدن المملكة الرئيسية
   ملاحظة: القيم risk/flood مؤقتة إلى أن تربطها بالـ API
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
        region: city.region || "غير محدد"
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
/* ===============================
   Live Thinking Stream
================================ */

const thinkingMessages = [
    {
        agent: "Radar Agent",
        text: "Detected rainfall activity across monitored Saudi cities."
    },
    {
        agent: "Flood Agent",
        text: "Flood index recalculated for western and southern regions."
    },
    {
        agent: "Memory Agent",
        text: "Historical similarity checked against previous national cases."
    },
    {
        agent: "Traffic Agent",
        text: "No critical national road impact detected yet."
    },
    {
        agent: "Decision Agent",
        text: "Monitoring remains better than full national escalation."
    },
    {
        agent: "Mission Agent",
        text: "Mission priorities updated according to highest-risk cities."
    },
    {
        agent: "Learning Agent",
        text: "Operational memory updated with latest city-risk pattern."
    }
];

function addThinkingItem() {
    const box = document.getElementById("thinkingStream");
    if (!box) return;

    const topCity = getTopCity();
    const item = thinkingMessages[thinkingIndex % thinkingMessages.length];

    const div = document.createElement("div");
    div.className = "think-item";
    div.innerHTML = `
        <strong>${item.agent}</strong><br>
        <span>${item.text}</span><br>
        <small>
            ${nowTime()} | Top City: ${topCity ? topCity.name : "--"}
        </small>
    `;

    box.prepend(div);

    if (box.children.length > 12) {
        box.removeChild(box.lastChild);
    }

    thinkingIndex++;
}

/* ===============================
   Executive Copilot
================================

function setupCopilot() {

    const input = document.getElementById("copilotInput");
    const sendBtn = document.getElementById("sendBtn");

    if (!input || !sendBtn) return;

    sendBtn.addEventListener("click", sendCopilotMessage);

    input.addEventListener("keydown", function (e) {

        if (e.key === "Enter") {
            sendCopilotMessage();
        }

    });

}

function sendCopilotMessage() {

    const input = document.getElementById("copilotInput");
    const log = document.getElementById("chatLog");

    if (!input || !log) return;

    const text = input.value.trim();

    if (!text) return;

    const user = document.createElement("div");

    user.className = "user-msg";

    user.innerHTML = `
        <strong>Commander</strong><br>
        ${text}
    `;

    log.appendChild(user);

    const ai = document.createElement("div");

    ai.className = "ai-msg";

    ai.innerHTML = `
        <strong>ANI</strong><br>
        ${generateCopilotReply(text)}
    `;

    setTimeout(() => {

        log.appendChild(ai);

        log.scrollTop = log.scrollHeight;

    }, 350);

    input.value = "";

}
function generateCopilotReply(text) {

    const q = text.toLowerCase();

    const topCity = getTopCity();

    if (
        q.includes("top") ||
        q.includes("highest") ||
        q.includes("مدينة") ||
        q.includes("الأعلى")
    ) {

        return `
        أعلى مدينة حالياً هي

        <b>${topCity.name}</b>

        بمؤشر خطر

        <b>${topCity.risk}%</b>

        والخطر الوطني المتوسط

        <b>${getAverageRisk()}%</b>.
        `;

    }

    if (
        q.includes("report") ||
        q.includes("تقرير")
    ) {

        return `
        التقرير التنفيذي:

        • المدن المراقبة: ${v19Cities.length}

        • أعلى مدينة: ${topCity.name}

        • متوسط الخطر: ${getAverageRisk()}%

        • التوصية:

        استمرار المراقبة الوطنية مع تشغيل الرادار.
        `;

    }

    if (
        q.includes("mission") ||
        q.includes("مهمة")
    ) {

        return `
        تم إنشاء مهمة مراقبة لـ

        <b>${topCity.name}</b>

        مع إبقاء بقية المدن تحت المتابعة.
        `;

    }

    if (
        q.includes("simulate") ||
        q.includes("محاكاة")
    ) {

        return `
        نتيجة المحاكاة:

        في حال زيادة الأمطار 50%

        سيرتفع مؤشر

        ${topCity.name}

        إلى

        <b>${Math.min(topCity.risk + 18,100)}%</b>.
        `;

    }

    return `
    تم تحليل طلبك.

    النظام الوطني يعمل حالياً على

    مراقبة

    ${v19Cities.length}

    مدينة،

    وأعلى مدينة هي

    ${topCity.name}.

    `;
}

/* ===============================
   National Map
================================ */

function initV19Map() {

    const mapBox = document.getElementById("nationalMap");

    if (!mapBox || !window.L) return;

    if (v19Map) return;

    v19Map = L.map("nationalMap").setView([23.8859, 45.0792], 5);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: "© OpenStreetMap"
    }).addTo(v19Map);

    renderCityMarkers();

}

function renderCityMarkers() {

    if (!v19Map) return;

    v19Markers.forEach(m => v19Map.removeLayer(m));
    v19RiskCircles.forEach(c => v19Map.removeLayer(c));

    v19Markers = [];
    v19RiskCircles = [];

    const cities = getSortedCities();

    cities.forEach((city, index) => {

        const color = riskColor(city.risk);

        const marker = L.circleMarker([city.lat, city.lon], {
            radius: Math.max(6, Math.min(18, city.risk / 2)),
            color: color,
            fillColor: color,
            fillOpacity: 0.65,
            weight: 2
        }).addTo(v19Map);

        marker.bindPopup(`
            <b>${city.name}</b><br>
            المنطقة: ${city.region}<br>
            Risk: ${city.risk}%<br>
            Flood: ${city.flood}%<br>
            Rank: ${index + 1}
        `);

        v19Markers.push(marker);

        if (city.risk >= 25) {

            const circle = L.circle([city.lat, city.lon], {
                radius: city.risk * 2500,
                color: color,
                fillColor: color,
                fillOpacity: 0.06,
                weight: 1
            }).addTo(v19Map);

            v19RiskCircles.push(circle);

        }

    });

}

/* ===============================
   Top Risk Cities
================================ */

function getTopRiskCities(limit = 10) {

    return getSortedCities().slice(0, limit);

}

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

/* ===============================
   Mission Workspace
================================ */

function renderMissions() {

    const box = document.getElementById("missionWorkspace");

    if (!box) return;

    const topCities = getTopRiskCities(6);

    const missions = topCities.map((city, index) => {

        let status = "Monitoring";
        let priority = "Low";

        if (city.risk >= 70) {
            status = "Emergency";
            priority = "Critical";
        } else if (city.risk >= 50) {
            status = "High Watch";
            priority = "High";
        } else if (city.risk >= 30) {
            status = "Active Watch";
            priority = "Medium";
        }

        return {
            title: `Monitor ${city.name}`,
            city: city.name,
            region: city.region,
            status,
            priority,
            eta: `${15 + index * 6} min`,
            confidence: `${Math.min(96, 80 + city.risk / 3).toFixed(0)}%`
        };

    });

    box.innerHTML = missions.map(m => `
        <div class="mission-card">
            <h3>${m.title}</h3>
            <p>Region: <strong>${m.region}</strong></p>
            <p>Priority: ${m.priority}</p>
            <p>ETA: ${m.eta}</p>
            <p>Confidence: ${m.confidence}</p>
            <div class="mission-status">${m.status}</div>
        </div>
    `).join("");

}   
/* ==========================================================
   World Model
========================================================== */

let worldAnimation = 0;

function drawWorldModel() {

    const canvas =
        document.getElementById("worldModelCanvas");

    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    const w = canvas.clientWidth;
    const h = canvas.clientHeight;

    canvas.width = w;
    canvas.height = h;

    ctx.clearRect(0,0,w,h);

    const nodes = [

        {name:"Radar",x:0.10,y:0.20},

        {name:"Satellite",x:0.28,y:0.14},

        {name:"Rain",x:0.45,y:0.20},

        {name:"Flood",x:0.63,y:0.30},

        {name:"Road",x:0.83,y:0.42},

        {name:"Hospital",x:0.70,y:0.68},

        {name:"Population",x:0.45,y:0.82},

        {name:"Decision",x:0.18,y:0.72}

    ];

    ctx.lineWidth=2;

    for(let i=0;i<nodes.length-1;i++){

        ctx.beginPath();

        ctx.strokeStyle="#38bdf8";

        ctx.moveTo(nodes[i].x*w,nodes[i].y*h);

        ctx.lineTo(nodes[i+1].x*w,nodes[i+1].y*h);

        ctx.stroke();

    }

    worldAnimation++;

    nodes.forEach((node,index)=>{

        const active=(worldAnimation%nodes.length)==index;

        ctx.beginPath();

        ctx.fillStyle=
            active?
            "#22c55e":
            "#0ea5e9";

        ctx.arc(
            node.x*w,
            node.y*h,
            active?18:14,
            0,
            Math.PI*2
        );

        ctx.fill();

        ctx.fillStyle="white";

        ctx.font="13px Cairo";

        ctx.textAlign="center";

        ctx.fillText(
            node.name,
            node.x*w,
            node.y*h+30
        );

    });

}

/* ==========================================================
   Executive Story
========================================================== */

function renderExecutiveStory(){

    const box=
        document.getElementById("executiveStory");

    if(!box)return;

    const top=getTopCity();

    box.innerHTML=`

    <div class="streamItem">

    <strong>National Executive Summary</strong>

    <br><br>

    Highest Risk City

    <b>${top.name}</b>

    <br>

    Risk Score

    <b>${top.risk}%</b>

    <br>

    Average National Risk

    <b>${getAverageRisk()}%</b>

    <br>

    Recommendation

    Continue National Monitoring.

    </div>

    `;

}

/* ==========================================================
   Timeline
========================================================== */

const timelineEvents=[

"Radar Updated",

"Memory Search",

"Reasoning",

"Simulation",

"Debate",

"Mission Created",

"Resources Assigned",

"Monitoring",

"Learning",

"Knowledge Updated"

];

let timelineIndex=0;

function updateTimeline(){

    const box=
        document.getElementById("timeline");

    if(!box)return;

    const div=document.createElement("div");

    div.className="streamItem";

    div.innerHTML=`

    <strong>

    ${nowTime()}

    </strong>

    <br>

    ${timelineEvents[
        timelineIndex%
        timelineEvents.length
    ]}

    `;

    box.prepend(div);

    while(box.children.length>12){

        box.removeChild(box.lastChild);

    }

    timelineIndex++;

}

/* ==========================================================
   Notifications
========================================================== */

const notificationEvents=[

"Radar refreshed",

"Flood score updated",

"Mission generated",

"Memory expanded",

"Scenario completed",

"Confidence improved",

"New intelligence received",

"Decision approved"

];

let notificationIndex=0;

function updateNotifications(){

    const box=
        document.getElementById("notifications");

    if(!box)return;

    const div=document.createElement("div");

    div.className="streamItem";

    div.innerHTML=`

    ✓

    ${notificationEvents[
        notificationIndex%
        notificationEvents.length
    ]}

    <br>

    <small>

    ${nowTime()}

    </small>

    `;

    box.prepend(div);

    while(box.children.length>10){

        box.removeChild(box.lastChild);

    }

    notificationIndex++;

}


/* ===============================
   Live Thinking Stream
================================ */

const thinkingMessages = [
    {
        agent: "Radar Agent",
        text: "Detected active rainfall cells near southern sector."
    },
    {
        agent: "Flood Agent",
        text: "Flood probability increased around Najran."
    },
    {
        agent: "Memory Agent",
        text: "Similar event found in historical memory."
    },
    {
        agent: "Traffic Agent",
        text: "No critical road impact detected yet."
    },
    {
        agent: "Decision Agent",
        text: "Monitoring is better than full escalation."
    },
    {
        agent: "Mission Agent",
        text: "Generated monitoring mission for highest-risk city."
    },
    {
        agent: "Learning Agent",
        text: "Updated operational confidence and memory pattern."
    }
];

function addThinkingItem() {
    const box = document.getElementById("thinkingStream");
    if (!box) return;

    const item = thinkingMessages[thinkingIndex % thinkingMessages.length];

    const div = document.createElement("div");
    div.className = "think-item";
    div.innerHTML = `
        <strong>${item.agent}</strong><br>
        <span>${item.text}</span>
        <br>
        <small>${new Date().toLocaleTimeString("ar-SA")}</small>
    `;

    box.prepend(div);

    if (box.children.length > 12) {
        box.removeChild(box.lastChild);
    }

    thinkingIndex++;
}

/* ===============================
   Executive Copilot
================================ */

function setupCopilot() {
    const input = document.getElementById("copilotInput");
    const sendBtn = document.getElementById("sendBtn");

    if (!input || !sendBtn) return;

    sendBtn.addEventListener("click", sendCopilotMessage);

    input.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
            sendCopilotMessage();
        }
    });
}

function sendCopilotMessage() {
    const input = document.getElementById("copilotInput");
    const log = document.getElementById("chatLog");

    if (!input || !log) return;

    const text = input.value.trim();

    if (!text) return;

    const user = document.createElement("div");
    user.className = "user-msg";
    user.innerHTML = `<strong>Commander:</strong><br>${text}`;

    log.appendChild(user);

    const ai = document.createElement("div");
    ai.className = "ai-msg";

    ai.innerHTML = `
        <strong>ANI:</strong><br>
        ${generateCopilotReply(text)}
    `;

    setTimeout(() => {
        log.appendChild(ai);
        log.scrollTop = log.scrollHeight;
    }, 400);

    input.value = "";
}

function generateCopilotReply(text) {
    const lower = text.toLowerCase();

    if (
        lower.includes("najran") ||
        lower.includes("نجران") ||
        lower.includes("why")
    ) {
        return `
            نجران هي أعلى مدينة حالياً لأن مؤشر الخطر المركب فيها أعلى من بقية المدن،
            ويجمع بين المطر المتوقع، مخاطر السيول، وذاكرة أحداث مشابهة.
        `;
    }

    if (
        lower.includes("report") ||
        lower.includes("تقرير")
    ) {
        return `
            تم تجهيز ملخص تنفيذي:
            الوضع الوطني تحت المراقبة، لا يوجد تصعيد كامل حالياً،
            والتوصية هي تشغيل متابعة رادارية وإرسال فريق مراقبة.
        `;
    }

    if (
        lower.includes("simulate") ||
        lower.includes("محاكاة")
    ) {
        return `
            نتيجة المحاكاة:
            إرسال فريقين إلى نجران قد يخفض الخطر المتوقع من 31% إلى 18%.
            عدم التدخل قد يرفع الخطر إلى 49% خلال ساعتين.
        `;
    }

    return `
        قمت بتحليل الطلب. التوصية الحالية:
        استمرار المراقبة الوطنية، تحديث الرادار، وتفعيل Mission Workspace للمدن الأعلى خطورة.
    `;
}

/* ===============================
   National Map
================================ */

function initV19Map() {
    const mapBox = document.getElementById("nationalMap");

    if (!mapBox || !window.L) return;

    if (v19Map) return;

    v19Map = L.map("nationalMap").setView([23.8859, 45.0792], 5);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: "© OpenStreetMap"
    }).addTo(v19Map);

    renderCityMarkers();
}

function riskColor(score) {
    if (score >= 70) return "#ef4444";
    if (score >= 50) return "#fb923c";
    if (score >= 30) return "#facc15";
    return "#38bdf8";
}

function renderCityMarkers() {
    if (!v19Map) return;

    v19Markers.forEach(m => v19Map.removeLayer(m));
    v19Markers = [];

    v19Cities.forEach(city => {
        const color = riskColor(city.risk);

        const marker = L.circleMarker([city.lat, city.lon], {
            radius: Math.max(8, city.risk / 2),
            color: color,
            fillColor: color,
            fillOpacity: 0.6,
            weight: 2
        }).addTo(v19Map);

        marker.bindPopup(`
            <b>${city.name}</b><br>
            Risk: ${city.risk}%<br>
            Flood: ${city.flood}%
        `);

        v19Markers.push(marker);

        if (city.risk >= 25) {
            const circle = L.circle([city.lat, city.lon], {
                radius: city.risk * 3000,
                color: color,
                fillColor: color,
                fillOpacity: 0.08,
                weight: 1
            }).addTo(v19Map);

            v19Markers.push(circle);
        }
    });
}

/* ===============================
   Mission Workspace
================================ */

function renderMissions() {
    const box = document.getElementById("missionWorkspace");
    if (!box) return;

    const missions = [
        {
            title: "Deploy Monitoring Team",
            city: "نجران",
            status: "Running",
            eta: "18 min",
            confidence: "91%"
        },
        {
            title: "Activate Radar Watch",
            city: "نجران",
            status: "Running",
            eta: "Live",
            confidence: "93%"
        },
        {
            title: "Prepare Advisory",
            city: "خميس مشيط",
            status: "Pending",
            eta: "25 min",
            confidence: "84%"
        },
        {
            title: "Update Memory Pattern",
            city: "National AI",
            status: "Completed",
            eta: "Done",
            confidence: "96%"
        }
    ];

    box.innerHTML = missions.map(m => `
        <div class="mission-card">
            <h3>${m.title}</h3>
            <p>Target: <strong>${m.city}</strong></p>
            <p>ETA: ${m.eta}</p>
            <p>Confidence: ${m.confidence}</p>
            <div class="mission-status">${m.status}</div>
        </div>
    `).join("");
}

/* ===============================
   Decision Lab
================================ */

function renderDecisionLab() {
    const box = document.getElementById("decisionLab");
    if (!box) return;

    const scenarios = [
        {
            title: "Scenario A",
            text: "Deploy 2 monitoring teams",
            result: "Risk 31% → 18%"
        },
        {
            title: "Scenario B",
            text: "No action",
            result: "Risk 31% → 49%"
        },
        {
            title: "Scenario C",
            text: "Early public advisory",
            result: "Risk 31% → 24%"
        },
        {
            title: "Counterfactual",
            text: "If rainfall doubles",
            result: "Risk may rise to 62%"
        }
    ];

    box.innerHTML = scenarios.map(s => `
        <div class="scenario">
            <strong>${s.title}</strong><br>
            ${s.text}<br>
            <small>${s.result}</small>
        </div>
    `).join("");
}

/* ===============================
   Executive Story
================================ */

function renderExecutiveStory() {
    const box = document.getElementById("executiveStory");
    if (!box) return;

    box.innerHTML = `
        At 08:20, RainGuard AI detected increased rainfall activity near Najran.
        The system merged radar signals, flood probability, national memory,
        and traffic conditions. After multi-agent debate and scenario simulation,
        ANI recommended deploying a monitoring team while maintaining national watch level.
        Expected outcome: reducing operational risk from 31% to 18%.
    `;
}

/* ===============================
   World Model Canvas
================================ */

function drawWorldModel() {
    const canvas = document.getElementById("worldModelCanvas");

    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    canvas.width = width;
    canvas.height = height;

    ctx.clearRect(0, 0, width, height);

    const nodes = [
        { label: "Radar", x: width * 0.15, y: height * 0.25 },
        { label: "Rain", x: width * 0.35, y: height * 0.18 },
        { label: "Flood", x: width * 0.58, y: height * 0.30 },
        { label: "Road", x: width * 0.78, y: height * 0.42 },
        { label: "Hospital", x: width * 0.62, y: height * 0.70 },
        { label: "Population", x: width * 0.34, y: height * 0.76 },
        { label: "National Risk", x: width * 0.15, y: height * 0.60 }
    ];

    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 2;

    for (let i = 0; i < nodes.length - 1; i++) {
        ctx.beginPath();
        ctx.moveTo(nodes[i].x, nodes[i].y);
        ctx.lineTo(nodes[i + 1].x, nodes[i + 1].y);
        ctx.stroke();
    }

    nodes.forEach(node => {
        ctx.beginPath();
        ctx.fillStyle = "#0ea5e9";
        ctx.arc(node.x, node.y, 26, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "white";
        ctx.font = "13px Cairo";
        ctx.textAlign = "center";
        ctx.fillText(node.label, node.x, node.y + 45);
    });
}

/* ===============================
   KPI Dynamic Update
================================ */

function updateKpis() {

    const top = getTopCity();

    const avg = getAverageRisk();

    const confidence =
        document.getElementById("confidenceValue");

    const risk =
        document.getElementById("riskValue");

    const topCityLabel =
        document.getElementById("topCity");

    if (confidence) {

        confidence.innerText =
            `${88 + Math.floor(Math.random()*6)}%`;

    }

    if (risk) {

        risk.innerText =
            `${avg}%`;

    }

    if (topCityLabel && top) {

        topCityLabel.innerText =
            top.name;

    }

}

/* ===============================
   Init
================================ */

window.addEventListener("load", () => {
    setupCopilot();
    initV19Map();
    renderMissions();
    renderDecisionLab();
    renderExecutiveStory();
    drawWorldModel();

    addThinkingItem();

    setInterval(addThinkingItem, 3000);
    setInterval(updateKpis, 5000);
    setInterval(drawWorldModel, 6000);
});
/* ==========================================================
   AI Brain Monitor
========================================================== */

function updateBrainBars() {

    const bars = {
        reasonBar: 70 + Math.floor(Math.random() * 25),
        simulationBar: 55 + Math.floor(Math.random() * 35),
        memoryBar: 65 + Math.floor(Math.random() * 30),
        planningBar: 50 + Math.floor(Math.random() * 35),
        learningBar: 60 + Math.floor(Math.random() * 30)
    };

    Object.entries(bars).forEach(([id, value]) => {

        const el = document.getElementById(id);

        if (el) {
            el.style.width = `${value}%`;
        }

    });

}

/* ==========================================================
   API Ready Layer
   لاحقاً إذا جهزت Endpoint للمدن، سيتصل به مباشرة
========================================================== */

async function fetchNationalCitiesFromAPI() {

    try {

        const apiBase =
            window.RAINGUARD_CONFIG?.API_BASE_URL ||
            window.API_BASE_URL ||
            "";

        if (!apiBase) return null;

        const response = await fetch(`${apiBase}/national-cities`);

        if (!response.ok) return null;

        const data = await response.json();

        if (!Array.isArray(data)) return null;

        return data;

    } catch (e) {

        console.warn("National cities API skipped:", e);

        return null;

    }

}

async function refreshCitiesFromAPI() {

    const apiCities = await fetchNationalCitiesFromAPI();

    if (!apiCities || !apiCities.length) return;

    v19Cities.length = 0;

    apiCities.forEach(city => {

        v19Cities.push({
            name: city.name || city.city || "غير محدد",
            lat: Number(city.lat || city.latitude || 0),
            lon: Number(city.lon || city.longitude || 0),
            risk: clampScore(
                city.risk ||
                city.score ||
                city.actualRiskScore ||
                city.rain_score ||
                0
            ),
            flood: clampScore(
                city.flood ||
                city.floodRiskScore ||
                city.flood_score ||
                0
            ),
            region: city.region || city.area || "غير محدد"
        });

    });

}

/* ==========================================================
   National Workspace Refresh
========================================================== */

async function refreshWorkspace() {

    await refreshCitiesFromAPI();

    updateKpis();

    renderCityMarkers();

    renderTopRiskCities();

    renderMissions();

    renderExecutiveStory();

    drawWorldModel();

}

/* ==========================================================
   Live Workspace Engine
========================================================== */

function startLiveWorkspaceEngine() {

    addThinkingItem();

    updateTimeline();

    updateNotifications();

    updateBrainBars();

    refreshWorkspace();

    setInterval(addThinkingItem, 3000);

    setInterval(updateTimeline, 3500);

    setInterval(updateNotifications, 4200);

    setInterval(updateBrainBars, 1500);

    setInterval(refreshWorkspace, 15000);

    setInterval(drawWorldModel, 900);

}

/* ==========================================================
   Compatibility Check
========================================================== */

function checkV195Compatibility() {

    const required = [
        "nationalMap",
        "thinkingStream",
        "missionWorkspace",
        "decisionLab",
        "executiveStory",
        "timeline",
        "notifications"
    ];

    required.forEach(id => {

        if (!document.getElementById(id)) {

            console.warn(
                `RainGuard V19.5 warning: missing element #${id}`
            );

        }

    });

}

/* ==========================================================
   Init
========================================================== */

window.addEventListener("load", () => {

    checkV195Compatibility();

    setupCopilot();

    initV19Map();

    renderTopRiskCities();

    renderMissions();

    renderExecutiveStory();

    drawWorldModel();

    startLiveWorkspaceEngine();

});
