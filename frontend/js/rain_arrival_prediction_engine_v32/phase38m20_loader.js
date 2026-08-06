/*
 RainGuard AI V32 — Phase 38M-20 Loader
 Load this file after rain_arrival_prediction_engine_v32/index.js
*/

(function (global) {
    "use strict";

    const VERSION = "32.38M.20";
    const SCRIPT_PATH =
        "./js/rain_arrival_prediction_engine_v32/final_arrival_decision.js?v=3238M20";

    function loadScript() {
        if (
            global.RainArrivalDecisionEngineV32
        ) {
            return Promise.resolve({
                success: true,
                alreadyLoaded: true,
                version: VERSION
            });
        }

        return new Promise(
            (resolve, reject) => {
                const script =
                    document.createElement(
                        "script"
                    );

                script.src =
                    SCRIPT_PATH;

                script.async =
                    false;

                script.onload =
                    () => resolve({
                        success: true,
                        loaded: true,
                        version: VERSION
                    });

                script.onerror =
                    () => reject(
                        new Error(
                            "Failed to load Phase 38M-20 Final Arrival Decision Engine."
                        )
                    );

                document.head
                    .appendChild(script);
            }
        );
    }

    global.RainArrivalPhase38M20Loader = {
        version: VERSION,
        load: loadScript,
        readyPromise: loadScript()
    };

})(
    typeof globalThis !== "undefined"
        ? globalThis
        : window
);
