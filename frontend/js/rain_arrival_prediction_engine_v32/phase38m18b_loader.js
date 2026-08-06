/*
 RainGuard AI V32 — Phase 38M-18B Loader
 Add after Phase 38M-20 loader.
*/

(function (global) {
    "use strict";

    const VERSION = "32.38M.18B";
    const SCRIPT_PATH =
        "./js/rain_arrival_prediction_engine_v32/storm_motion_recovery.js?v=3238M18B";

    function loadScript() {
        if (
            global.RainArrivalStormMotionRecoveryV32
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
                    document.createElement("script");

                script.src = SCRIPT_PATH;
                script.async = false;

                script.onload = () =>
                    resolve({
                        success: true,
                        loaded: true,
                        version: VERSION
                    });

                script.onerror = () =>
                    reject(
                        new Error(
                            "Failed to load Phase 38M-18B Storm Motion Recovery Engine."
                        )
                    );

                document.head
                    .appendChild(script);
            }
        );
    }

    global.RainArrivalPhase38M18BLoader = {
        version: VERSION,
        load: loadScript,
        readyPromise: loadScript()
    };

})(
    typeof globalThis !== "undefined"
        ? globalThis
        : window
);
