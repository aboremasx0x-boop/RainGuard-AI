/*
===========================================================
 RainGuard AI V32
 Phase 38M-8
 Diagnostics Engine

 Responsibilities:
 - Module health checks
 - Track diagnostics
 - Replay diagnostics
 - Motion diagnostics
 - Cache diagnostics
 - Runtime diagnostics
 - Export reports
===========================================================
*/

(function (global) {
    "use strict";

    const MODULE_NAME = "diagnostics";
    const VERSION = "32.38M.8";
    const BUILD = "rainguard-v32-phase38m-diagnostics";

    class RainArrivalDiagnostics {

        constructor() {

            this.version = VERSION;
            this.build = BUILD;

            this.createdAt = Date.now();

        }

        getTrackStore() {
            return (
                global.RainArrivalTrackStoreV32 ||
                global.RainGuardAI?.V32?.rainArrivalModules?.trackStore ||
                null
            );
        }

        getCache() {
            return (
                global.RainArrivalCacheV32 ||
                global.RainGuardAI?.V32?.rainArrivalModules?.cache ||
                null
            );
        }

        getReplayEngine() {
            return (
                global.RainArrivalReplayEngineV32 ||
                global.RainGuardAI?.V32?.rainArrivalModules?.replayEngine ||
                null
            );
        }

        getMotionEngine() {
            return (
                global.RainArrivalMotionEngineV32 ||
                global.RainGuardAI?.V32?.rainArrivalModules?.motionEngine ||
                null
            );
        }

        getOrchestrator() {
            return (
                global.RainArrivalOrchestratorV32 ||
                null
            );
        }

        run() {

            return {

                generatedAt: Date.now(),

                modules: {

                    trackStore:
                        !!this.getTrackStore(),

                    cache:
                        !!this.getCache(),

                    replayEngine:
                        !!this.getReplayEngine(),

                    motionEngine:
                        !!this.getMotionEngine(),

                    orchestrator:
                        !!this.getOrchestrator()

                }

            };

        }

        diagnoseTrack(trackId) {

            const store =
                this.getTrackStore();

            if (
                !store ||
                typeof store.get !== "function"
            ) {

                return {
                    success: false,
                    reason: "TRACK_STORE_UNAVAILABLE"
                };

            }

            const track =
                store.get(trackId);

            if (!track) {

                return {
                    success: false,
                    reason: "TRACK_NOT_FOUND",
                    trackId
                };

            }

            return {

                success: true,

                trackId,

                canonicalTrackId:
                    track.canonicalTrackId ||
                    track.trackId,

                pointCount:
                    Array.isArray(track.points)
                        ? track.points.length
                        : 0,

                city:
                    track.city || null,

                region:
                    track.region || null

            };

        }

        diagnoseReplay(trackId) {

            const replay =
                this.getReplayEngine();

            if (
                !replay ||
                typeof replay.getReplay !== "function"
            ) {

                return {
                    success: false,
                    reason: "REPLAY_ENGINE_UNAVAILABLE"
                };

            }

            return (
                replay.getReplay(trackId) ||
                {
                    success: false,
                    reason: "REPLAY_NOT_FOUND"
                }
            );

        }

        diagnoseMotion(trackId) {

            const motion =
                this.getMotionEngine();

            if (
                !motion ||
                typeof motion.getMotionState !== "function"
            ) {

                return {
                    success: false,
                    reason: "MOTION_ENGINE_UNAVAILABLE"
                };

            }

            return (
                motion.getMotionState(trackId) ||
                {
                    success: false,
                    reason: "MOTION_NOT_FOUND"
                }
            );

        }

        diagnoseCache() {

            const cache =
                this.getCache();

            if (
                !cache ||
                typeof cache.getDiagnostics !== "function"
            ) {

                return {
                    success: false,
                    reason: "CACHE_UNAVAILABLE"
                };

            }

            return cache.getDiagnostics();

        }

        diagnoseRuntime() {

            const report =
                this.run();

            const healthy =
                Object.values(report.modules)
                    .every(Boolean);

            return {

                success: true,

                status:
                    healthy
                        ? "Healthy"
                        : "Warning",

                modules:
                    report.modules

            };

        }

        exportReport() {

            return {

                version:
                    this.version,

                build:
                    this.build,

                generatedAt:
                    Date.now(),

                runtime:
                    this.diagnoseRuntime(),

                cache:
                    this.diagnoseCache()

            };

        }

        printReport() {

            const report =
                this.exportReport();

            console.log(
                "========== Rain Arrival Diagnostics =========="
            );

            console.table(
                report.runtime.modules
            );

            return report;

        }

    }

    const api =
        new RainArrivalDiagnostics();

    global.RainArrivalDiagnosticsV32 =
        api;

    global.RainGuardAI =
        global.RainGuardAI || {};

    global.RainGuardAI.V32 =
        global.RainGuardAI.V32 || {};

    global.RainGuardAI.V32.rainArrivalModules =
        global.RainGuardAI.V32.rainArrivalModules || {};

    global.RainGuardAI.V32
        .rainArrivalModules
        .diagnostics =
        api;

    if (
        global.RainArrivalEngineV32 &&
        typeof global.RainArrivalEngineV32.register === "function"
    ) {

        global.RainArrivalEngineV32.register(
            MODULE_NAME,
            api
        );

    }

    if (
        global.RainArrivalOrchestratorV32 &&
        typeof global.RainArrivalOrchestratorV32.register === "function"
    ) {

        global.RainArrivalOrchestratorV32.register(
            MODULE_NAME,
            api
        );

    }

    console.log(
        "[RainGuard AI V32] Diagnostics Engine loaded.",
        {
            version: VERSION,
            build: BUILD
        }
    );

})(typeof globalThis !== "undefined" ? globalThis : window);
