/*
===========================================================
 RainGuard AI V32
 Rain Arrival Engine Modularization
 Phase 38M-1
 Bootstrap & Module Loader
===========================================================
*/

(function () {
    "use strict";

    const VERSION = "32.38M.1";
    const BUILD = "3238M-1";

    class RainArrivalEngineV32 {

        constructor() {

            this.version = VERSION;
            this.build = BUILD;

            this.modules = {};

            this.initialized = false;

        }

        register(name, module) {

            this.modules[name] = module;

            console.log("[RainArrival] Module Registered:", name);

        }

        get(name) {

            return this.modules[name] || null;

        }

        initialize() {

            if (this.initialized)
                return;

            this.initialized = true;

            console.log(
                "%cRain Arrival Engine V32 Modular Initialized",
                "color:#00d4ff;font-weight:bold;"
            );

            console.log({
                version: this.version,
                build: this.build,
                modules: Object.keys(this.modules)
            });

        }

    }

    window.RainArrivalEngineV32 =
        new RainArrivalEngineV32();

})();
