(function(global){"use strict";
const VERSION="32.38M.18E";
const PATH="./js/rain_arrival_prediction_engine_v32/persistent_track_history.js?v=3238M18E";
function load(){if(global.RainArrivalPersistentTrackHistoryV32)return Promise.resolve({success:true,alreadyLoaded:true,version:VERSION});return new Promise((resolve,reject)=>{const s=document.createElement("script");s.src=PATH;s.async=false;s.onload=()=>resolve({success:true,loaded:true,version:VERSION});s.onerror=()=>reject(new Error("Failed to load Phase 38M-18E Persistent Track History Engine."));document.head.appendChild(s)})}
global.RainArrivalPhase38M18ELoader={version:VERSION,load,readyPromise:load()};
})(typeof globalThis!=="undefined"?globalThis:window);
