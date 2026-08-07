/*
RainGuard AI V32
Phase 38M-19D Loader
File: frontend/js/rain_arrival_prediction_engine_v32/phase38m19d_loader.js
*/
(function (global) {
    "use strict";

    const PHASE = "38M-19D";

    function basePath() {
        const current = document.currentScript;
        if (current?.src) {
            const url = new URL(current.src, document.baseURI);
            url.search = "";
            url.hash = "";
            url.pathname = url.pathname.substring(0, url.pathname.lastIndexOf("/") + 1);
            return url.href;
        }
        return new URL("./js/rain_arrival_prediction_engine_v32/", document.baseURI).href;
    }

    function load(src) {
        return new Promise((resolve, reject) => {
            const normalized = src.split("?")[0];
            const existing = Array.from(document.scripts || []).find(
                s => String(s.src || "").split("?")[0] === normalized
            );

            if (existing) {
                resolve({ reused: true, src });
                return;
            }

            const script = document.createElement("script");
            script.src = src;
            script.async = false;
            script.onload = () => resolve({ reused: false, src });
            script.onerror = () => reject(new Error(`PHASE_${PHASE}_LOAD_FAILED`));
            document.head.appendChild(script);
        });
    }

    async function initialize() {
        if (global.RainGuardPhase38M19DDebug) {
            return {
                success: true,
                status: "ALREADY_READY",
                phase: PHASE
            };
        }

        const src = new URL(
            "phase38m19d_debug_bootstrap.js?v=3238M19D",
            basePath()
        ).href;

        await load(src);

        if (!global.RainGuardPhase38M19DDebug) {
            throw new Error("PHASE_38M19D_GLOBAL_NOT_AVAILABLE");
        }

        const test = global.testRainGuardPhase38M19D();

        const result = {
            success: true,
            status: "PHASE_38M19D_READY",
            phase: PHASE,
            test
        };

        console.log("[RainGuard AI] Phase 38M-19D Loader ready.", result);
        return result;
    }

    global.initializeRainGuardPhase38M19D = initialize;

    initialize().catch(error => {
        console.error("[RainGuard AI] Phase 38M-19D Loader failed.", error);
    });

})(typeof globalThis !== "undefined" ? globalThis : window);
