/* =========================================================
   RainGuard AI V20.1
   National OS Engine
   Central Intelligence Event Bus
========================================================= */

(function () {
    "use strict";

    const OS = {
        running: false,
        tick: 0,
        phaseIndex: 0,
        risk: 31,
        confidence: 86,
        topCity: "نجران",
        mode: "WATCH",
        listeners: {},
        memory: [],
        missions: []
    };

    const phases = [
        "Observe",
        "Understand",
        "Reason",
        "Imagine",
        "Simulate",
        "Debate",
        "Choose",
        "Plan",
        "Execute",
        "Verify",
        "Learn"
    ];

    const agents = [
        "Weather AI",
        "Radar AI",
        "Hydrology AI",
        "Flood AI",
        "Traffic AI",
        "Emergency AI",
        "Decision AI",
        "Learning AI"
    ];

    function now() {
        return new Date().toLocaleTimeString("ar-SA");
    }

    function clamp(v) {
        const n = Number(v);
        if (!Number.isFinite(n)) return 0;
        return Math.max(0, Math.min(100, Math.round(n)));
    }

    function emit(type, payload = {}) {
        const event = {
            type,
            time: now(),
            tick: OS.tick,
            phase: phases[OS.phaseIndex],
            state: getState(),
            payload
        };

        window.dispatchEvent(
            new CustomEvent("national-os-event", {
                detail: event
            })
        );

        (OS.listeners[type] || []).forEach(fn => {
            try {
                fn(event);
            } catch (e) {
                console.warn("OS listener error:", e);
            }
        });

        (OS.listeners["*"] || []).forEach(fn => {
            try {
                fn(event);
            } catch (e) {
                console.warn("OS listener error:", e);
            }
        });
    }

    function on(type, handler) {
        if (!OS.listeners[type]) OS.listeners[type] = [];
        OS.listeners[type].push(handler);
    }

    function getState() {
        return {
            running: OS.running,
            tick: OS.tick,
            phase: phases[OS.phaseIndex],
            risk: OS.risk,
            confidence: OS.confidence,
            topCity: OS.topCity,
            mode: OS.mode,
            memory: OS.memory.slice(-10),
            missions: OS.missions.slice(-10)
        };
    }

    function updateMode() {
        if (OS.risk >= 75) OS.mode = "EMERGENCY";
        else if (OS.risk >= 55) OS.mode = "WARNING";
        else if (OS.risk >= 35) OS.mode = "ALERT";
        else if (OS.risk >= 20) OS.mode = "WATCH";
        else OS.mode = "NORMAL";
    }

    function createMission() {
        const mission = {
            id: "MIS-" + String(OS.tick).padStart(4, "0"),
            city: OS.topCity,
            action: "Deploy monitoring team + radar watch",
            status: OS.risk >= 35 ? "Active" : "Monitoring",
            eta: 12 + (OS.tick % 5) * 6,
            confidence: OS.confidence
        };

        OS.missions.unshift(mission);

        emit("mission-created", mission);
    }

    function saveMemory(note) {
        OS.memory.unshift({
            time: now(),
            phase: phases[OS.phaseIndex],
            note
        });

        emit("memory-updated", {
            note
        });
    }

    function runPhase() {
        const phase = phases[OS.phaseIndex];
        const agent = agents[OS.tick % agents.length];

        if (phase === "Observe") {
            emit("observe", {
                agent,
                message: "Radar and weather signals updated."
            });
        }

        if (phase === "Understand") {
            OS.risk = clamp(OS.risk + (Math.random() > 0.55 ? 1 : -1));
            emit("understand", {
                agent,
                message: "National risk model recalculated.",
                risk: OS.risk
            });
        }

        if (phase === "Reason") {
            emit("reason", {
                agent,
                message: "Comparing monitoring, advisory, and escalation paths."
            });
        }

        if (phase === "Imagine") {
            emit("imagine", {
                agent,
                message: "Generating possible future weather-risk paths."
            });
        }

        if (phase === "Simulate") {
            emit("simulate", {
                agent,
                scenarios: [
                    {
                        name: "Deploy monitoring team",
                        expectedRisk: clamp(OS.risk - 12)
                    },
                    {
                        name: "No action",
                        expectedRisk: clamp(OS.risk + 18)
                    },
                    {
                        name: "Early advisory",
                        expectedRisk: clamp(OS.risk - 7)
                    }
                ]
            });
        }

        if (phase === "Debate") {
            emit("debate", {
                agent,
                message: "Agent council agrees: monitoring is preferred."
            });
        }

        if (phase === "Choose") {
            emit("decision", {
                decision: "Active National Monitoring",
                reason: `${OS.topCity} has the highest current combined risk.`,
                expectedReduction: `${OS.risk}% → ${clamp(OS.risk - 12)}%`
            });
        }

        if (phase === "Plan") {
            createMission();
        }

        if (phase === "Execute") {
            emit("execute", {
                message: "Mission route and monitoring task activated.",
                city: OS.topCity
            });
        }

        if (phase === "Verify") {
            OS.confidence = clamp(84 + Math.random() * 10);
            emit("verify", {
                confidence: OS.confidence,
                message: "Confidence recalibrated."
            });
        }

        if (phase === "Learn") {
            saveMemory(
                `Pattern saved: ${OS.topCity}, risk ${OS.risk}%, mode ${OS.mode}.`
            );
        }

        updateMode();

        emit("state", getState());

        OS.phaseIndex = (OS.phaseIndex + 1) % phases.length;
        OS.tick++;
    }

    function start(interval = 1200) {
        if (OS.running) return;

        OS.running = true;

        emit("os-started", {
            message: "National AI Operating System started."
        });

        OS.timer = setInterval(runPhase, interval);
    }

    function stop() {
        if (!OS.running) return;

        OS.running = false;

        clearInterval(OS.timer);

        emit("os-stopped", {
            message: "National AI Operating System stopped."
        });
    }

    function reset() {
        stop();

        OS.tick = 0;
        OS.phaseIndex = 0;
        OS.risk = 31;
        OS.confidence = 86;
        OS.mode = "WATCH";
        OS.memory = [];
        OS.missions = [];

        emit("os-reset", getState());
    }

    function setState(partial = {}) {
        if (typeof partial.risk !== "undefined") {
            OS.risk = clamp(partial.risk);
        }

        if (typeof partial.confidence !== "undefined") {
            OS.confidence = clamp(partial.confidence);
        }

        if (typeof partial.topCity !== "undefined") {
            OS.topCity = partial.topCity;
        }

        updateMode();

        emit("state", getState());
    }

    window.RainGuardNationalOS = {
        start,
        stop,
        reset,
        on,
        emit,
        setState,
        getState,
        phases
    };

})();
