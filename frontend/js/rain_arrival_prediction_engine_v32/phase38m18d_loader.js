
(function (global) {
"use strict";

const VERSION = "32.38M.18D";
const PATH =
  "./js/rain_arrival_prediction_engine_v32/stable_track_identity.js?v=3238M18D";

function load() {
  if (global.RainArrivalStableTrackIdentityV32) {
    return Promise.resolve({
      success: true,
      alreadyLoaded: true,
      version: VERSION
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = PATH;
    script.async = false;
    script.onload = () => resolve({
      success: true,
      loaded: true,
      version: VERSION
    });
    script.onerror = () => reject(
      new Error("Failed to load Phase 38M-18D Stable Track Identity Engine.")
    );
    document.head.appendChild(script);
  });
}

global.RainArrivalPhase38M18DLoader = {
  version: VERSION,
  load,
  readyPromise: load()
};

})(typeof globalThis !== "undefined" ? globalThis : window);
