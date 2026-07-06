/* =========================================================
   RainGuard AI V19
   National Autonomous Intelligence Workspace
========================================================= */

let v19Map = null;
let v19Markers = [];
let thinkingIndex = 0;

/* ===============================
   بيانات المدن الافتراضية
================================ */

const v19Cities = [
    {
        name: "نجران",
        lat: 17.5656,
        lon: 44.2289,
        risk: 31,
        flood: 28
    },
    {
        name: "خميس مشيط",
        lat: 18.3064,
        lon: 42.7294,
        risk: 29,
        flood: 25
    },
    {
        name: "أبها",
        lat: 18.2465,
        lon: 42.5117,
        risk: 27,
        flood: 22
    },
    {
        name: "جازان",
        lat: 16.8892,
        lon: 42.5511,
        risk: 24,
        flood: 20
    },
    {
        name: "جدة",
        lat: 21.5433,
        lon: 39.1728,
        risk: 18,
        flood: 14
    },
    {
        name: "الرياض",
        lat: 24.7136,
        lon: 46.6753,
        risk: 12,
        flood: 8
    }
];

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
    const confidence = document.getElementById("confidenceValue");
    const risk = document.getElementById("riskValue");

    if (confidence) {
        confidence.innerText = `${82 + Math.floor(Math.random() * 6)}%`;
    }

    if (risk) {
        risk.innerText = `${29 + Math.floor(Math.random() * 5)}%`;
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
