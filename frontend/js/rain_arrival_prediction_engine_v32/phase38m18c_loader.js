/*
 RainGuard AI V32 — Phase 38M-18C Loader
 Add after phase38m18b_loader.js
*/

(function (global) {
    "use strict";

    const VERSION = "32.38M.18C";
    const PATH =
        "./js/rain_arrival_prediction_engine_v32/live_track_history_capture.js?v=3238M18C";

    function load() {
        if (
            global.RainArrivalLiveTrackHistoryCaptureV32
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

                script.src = PATH;
                script.async = false;

                script.onload =
                    () => resolve({
                        success: true,
                        loaded: true,
                        version: VERSION
                    });

                script.onerror =
                    () => reject(
                        new Error(
                            "Failed to load Phase 38M-18C."
                        )
                    );

                document.head
                    .appendChild(script);
            }
        );
    }

    global.RainArrivalPhase38M18CLoader = {
        version: VERSION,
        load,
        readyPromise: load()
    };

})(
    typeof globalThis !== "undefined"
        ? globalThis
        : window
);
