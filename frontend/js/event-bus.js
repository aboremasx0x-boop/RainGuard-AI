/*
=========================================================
RainGuard AI v11 - Live Event Bus
File: frontend/js/event-bus.js
=========================================================
*/

(function () {
    "use strict";

    const BUS_KEY = "rainguard_live_event_bus";
    const BUS_LAST_KEY = "rainguard_live_event_last";
    const MAX_EVENTS = 300;

    const EVENT_TYPES = {
        RAIN_ALERT: "RAIN_ALERT",
        FLOOD_ALERT: "FLOOD_ALERT",
        AI_DECISION: "AI_DECISION",
        STORM_UPDATE: "STORM_UPDATE",
        MISSION_UPDATE: "MISSION_UPDATE",
        CRISIS_UPDATE: "CRISIS_UPDATE",
        CITY_UPDATE: "CITY_UPDATE",
        SYSTEM_STATUS: "SYSTEM_STATUS"
    };

    function nowISO() {
        return new Date().toISOString();
    }

    function createId() {
        return "rg_evt_" + Date.now() + "_" + Math.random().toString(36).slice(2, 9);
    }

    function safeParse(value, fallback) {
        try {
            return JSON.parse(value || "");
        } catch (e) {
            return fallback;
        }
    }

    function getEvents() {
        const events = safeParse(localStorage.getItem(BUS_KEY), []);
        return Array.isArray(events) ? events : [];
    }

    function saveEvents(events) {
        localStorage.setItem(BUS_KEY, JSON.stringify((events || []).slice(-MAX_EVENTS)));
    }

    function normalizeEvent(type, payload, source) {
        return {
            id: createId(),
            type: type || EVENT_TYPES.SYSTEM_STATUS,
            source: source || document.title || "RainGuard AI",
            payload: payload || {},
            createdAt: nowISO(),
            timestamp: Date.now()
        };
    }

    function publish(type, payload, source) {
        const event = normalizeEvent(type, payload, source);
        const events = getEvents();

        events.push(event);
        saveEvents(events);

        localStorage.setItem(BUS_LAST_KEY, JSON.stringify(event));

        window.dispatchEvent(
            new CustomEvent("rainguard:event", {
                detail: event
            })
        );

        return event;
    }

    function subscribe(callback) {
        if (typeof callback !== "function") return function () {};

        function localHandler(e) {
            callback(e.detail);
        }

        function storageHandler(e) {
            if (e.key !== BUS_LAST_KEY || !e.newValue) return;

            const event = safeParse(e.newValue, null);
            if (event) callback(event);
        }

        window.addEventListener("rainguard:event", localHandler);
        window.addEventListener("storage", storageHandler);

        return function unsubscribe() {
            window.removeEventListener("rainguard:event", localHandler);
            window.removeEventListener("storage", storageHandler);
        };
    }

    function clearEvents() {
        localStorage.removeItem(BUS_KEY);
        localStorage.removeItem(BUS_LAST_KEY);

        window.dispatchEvent(
            new CustomEvent("rainguard:event-cleared", {
                detail: { clearedAt: nowISO() }
            })
        );
    }

    function latest(limit = 50) {
        return getEvents().slice(-Number(limit || 50)).reverse();
    }

    function byType(type, limit = 50) {
        return getEvents()
            .filter(event => event.type === type)
            .slice(-Number(limit || 50))
            .reverse();
    }

    function updateCity(city) {
        return publish(EVENT_TYPES.CITY_UPDATE, city, "City Monitor");
    }

    function rainAlert(city) {
        return publish(EVENT_TYPES.RAIN_ALERT, city, "Rain Alert Engine");
    }

    function floodAlert(city) {
        return publish(EVENT_TYPES.FLOOD_ALERT, city, "Flood Engine");
    }

    function aiDecision(report) {
        return publish(EVENT_TYPES.AI_DECISION, report, "AI Decision Engine");
    }

    function stormUpdate(data) {
        return publish(EVENT_TYPES.STORM_UPDATE, data, "Storm Tracking Engine");
    }

    function missionUpdate(data) {
        return publish(EVENT_TYPES.MISSION_UPDATE, data, "AI Mission Center");
    }

    function crisisUpdate(data) {
        return publish(EVENT_TYPES.CRISIS_UPDATE, data, "AI Crisis Room");
    }

    function systemStatus(data) {
        return publish(EVENT_TYPES.SYSTEM_STATUS, data, "RainGuard System");
    }

    function renderEvents(targetId = "liveEventBusBox", limit = 30) {
        const box = document.getElementById(targetId);
        if (!box) return;

        const events = latest(limit);

        if (!events.length) {
            box.innerHTML = `
                <div style="color:#94a3b8;line-height:1.8;">
                    لا توجد أحداث مباشرة حالياً.
                </div>
            `;
            return;
        }

        box.innerHTML = events.map(event => {
            const time = new Date(event.timestamp).toLocaleTimeString("ar-SA");
            const city = event.payload?.name || event.payload?.city || "عام";
            const score =
                event.payload?.score ??
                event.payload?.risk ??
                event.payload?.decisionScore ??
                "";

            return `
                <div class="rg-event-item" style="
                    background:rgba(2,6,23,.58);
                    border:1px solid rgba(56,189,248,.22);
                    border-radius:14px;
                    padding:12px;
                    margin-bottom:10px;
                    line-height:1.8;
                    color:#e2e8f0;
                ">
                    <strong>${time} - ${event.type}</strong><br>
                    <span>${city}</span>
                    ${score !== "" ? `<br><small>Score: ${score}%</small>` : ""}
                    <br>
                    <small style="color:#94a3b8;">Source: ${event.source}</small>
                </div>
            `;
        }).join("");
    }

    function autoRender(targetId = "liveEventBusBox", limit = 30) {
        renderEvents(targetId, limit);

        return subscribe(function () {
            renderEvents(targetId, limit);
        });
    }

    window.RainGuardEventBus = {
        EVENT_TYPES,
        publish,
        subscribe,
        getEvents,
        latest,
        byType,
        clearEvents,
        renderEvents,
        autoRender,
        updateCity,
        rainAlert,
        floodAlert,
        aiDecision,
        stormUpdate,
        missionUpdate,
        crisisUpdate,
        systemStatus
    };

    window.dispatchEvent(
        new CustomEvent("rainguard:event-bus-ready", {
            detail: { ready: true, at: nowISO() }
        })
    );
})();
