/*
===========================================================
 RainGuard AI V32
 Phase 38M-10
 Modular Orchestrator Pipeline

 Responsibilities:
 - Resolve all modular engines
 - Execute modules in the correct order
 - Preserve shared runtime context
 - Run Replay, Motion and Candidate pipelines
 - Collect diagnostics
 - Publish the final result
===========================================================
*/

(function (global) {
    "use strict";

    const MODULE_NAME =
        "orchestrator";

    const VERSION =
        "32.38M.10";

    const BUILD =
        "rainguard-v32-phase38m-modular-orchestrator";

    const DEFAULT_CONFIG =
        Object.freeze({
            runReplay:
                true,

            runMotion:
                true,

            runCandidates:
                true,

            runDiagnostics:
                true,

            continueOnError:
                true,

            forceReplay:
                false,

            includeReplaySegments:
                false,

            publishToRuntime:
                true,

            keepHistory:
                true,

            maximumHistory:
                200
        });

    function now() {
        return Date.now();
    }

    function isObject(value) {
        return (
            value !== null &&
            typeof value === "object" &&
            !Array.isArray(value)
        );
    }

    function cloneValue(value) {
        if (
            value === null ||
            value === undefined
        ) {
            return value;
        }

        if (
            typeof structuredClone ===
            "function"
        ) {
            try {
                return structuredClone(
                    value
                );
            } catch (error) {
                // Continue with JSON fallback.
            }
        }

        try {
            return JSON.parse(
                JSON.stringify(value)
            );
        } catch (error) {
            return value;
        }
    }

    class RainArrivalOrchestrator {

        constructor(config = {}) {
            this.version =
                VERSION;

            this.build =
                BUILD;

            this.config = {
                ...DEFAULT_CONFIG,

                ...(isObject(config)
                    ? config
                    : {})
            };

            this.modules = {};

            this.executionCount =
                0;

            this.running =
                false;

            this.lastResult =
                null;

            this.lastError =
                null;

            this.history =
                [];

            this.statistics = {
                runs:
                    0,

                successful:
                    0,

                failed:
                    0,

                replayRuns:
                    0,

                motionRuns:
                    0,

                candidateRuns:
                    0,

                diagnosticRuns:
                    0,

                moduleErrors:
                    0
            };

            this.createdAt =
                now();

            this.updatedAt =
                this.createdAt;
        }

        register(
            name,
            module
        ) {
            if (
                !name ||
                !module
            ) {
                return false;
            }

            this.modules[name] =
                module;

            console.log(
                "[RainArrival Orchestrator] Registered:",
                name
            );

            return true;
        }

        unregister(name) {
            if (
                !Object.prototype
                    .hasOwnProperty
                    .call(
                        this.modules,
                        name
                    )
            ) {
                return false;
            }

            delete this.modules[name];

            return true;
        }

        get(name) {
            return (
                this.modules[name] ||
                null
            );
        }

        resolveModule(
            name
        ) {
            if (
                this.modules[name]
            ) {
                return this.modules[name];
            }

            const moduleRegistry =
                global.RainGuardAI
                    ?.V32
                    ?.rainArrivalModules;

            const globalMap = {
                trackStore:
                    global
                        .RainArrivalTrackStoreV32,

                utils:
                    global
                        .RainArrivalUtilsV32,

                cache:
                    global
                        .RainArrivalCacheV32,

                replayEngine:
                    global
                        .RainArrivalReplayEngineV32,

                motionEngine:
                    global
                        .RainArrivalMotionEngineV32,

                candidateEngine:
                    global
                        .RainArrivalCandidateEngineV32,

                diagnostics:
                    global
                        .RainArrivalDiagnosticsV32
            };

            const resolved =
                globalMap[name] ||
                moduleRegistry?.[name] ||
                null;

            if (resolved) {
                this.modules[name] =
                    resolved;
            }

            return resolved;
        }

        getTrackStore() {
            return this.resolveModule(
                "trackStore"
            );
        }

        getCache() {
            return this.resolveModule(
                "cache"
            );
        }

        getReplayEngine() {
            return this.resolveModule(
                "replayEngine"
            );
        }

        getMotionEngine() {
            return this.resolveModule(
                "motionEngine"
            );
        }

        getCandidateEngine() {
            return this.resolveModule(
                "candidateEngine"
            );
        }

        getDiagnostics() {
            return this.resolveModule(
                "diagnostics"
            );
        }

        buildContext(
            context = {}
        ) {
            const runtimeEngine =
                global.RainGuardAI
                    ?.V32
                    ?.rainArrivalPrediction;

            return {
                ...cloneValue(
                    context
                ),

                targetCoordinate:
                    context.targetCoordinate ??
                    context.coordinate ??
                    runtimeEngine
                        ?.targetCoordinate ??
                    null,

                targetCity:
                    context.targetCity ??
                    context.city ??
                    runtimeEngine
                        ?.targetCity ??
                    runtimeEngine
                        ?.selectedCity ??
                    null,

                targetRegion:
                    context.targetRegion ??
                    context.region ??
                    runtimeEngine
                        ?.currentRegion ??
                    null,

                generatedAt:
                    now()
            };
        }

        async run(
            context = {},
            options = {}
        ) {
            if (this.running) {
                return {
                    success: false,

                    reason:
                        "ORCHESTRATOR_ALREADY_RUNNING",

                    generatedAt:
                        now()
                };
            }

            this.running =
                true;

            this.executionCount += 1;

            this.statistics.runs += 1;

            const startedAt =
                now();

            const runConfig = {
                ...this.config,

                ...(isObject(options)
                    ? options
                    : {})
            };

            const runtimeContext =
                this.buildContext(
                    context
                );

            const steps = [];

            let replayResult =
                null;

            let motionResult =
                null;

            let candidateResult =
                null;

            let diagnosticsResult =
                null;

            try {
                const trackStore =
                    this.getTrackStore();

                if (
                    !trackStore ||
                    typeof trackStore
                        .getAll !==
                        "function"
                ) {
                    throw new Error(
                        "TRACK_STORE_UNAVAILABLE"
                    );
                }

                const tracks =
                    trackStore.getAll();

                steps.push({
                    step:
                        "trackStore",

                    success:
                        true,

                    trackCount:
                        tracks.length
                });

                if (
                    runConfig.runReplay
                ) {
                    replayResult =
                        await this.runReplayStep(
                            tracks,
                            runConfig
                        );

                    steps.push({
                        step:
                            "replay",

                        success:
                            Boolean(
                                replayResult
                                    ?.success
                            ),

                        result:
                            cloneValue(
                                replayResult
                            )
                    });
                }

                if (
                    runConfig.runMotion
                ) {
                    motionResult =
                        await this.runMotionStep(
                            tracks,
                            runConfig
                        );

                    steps.push({
                        step:
                            "motion",

                        success:
                            Boolean(
                                motionResult
                                    ?.success
                            ),

                        result:
                            cloneValue(
                                motionResult
                            )
                    });
                }

                if (
                    runConfig
                        .runCandidates
                ) {
                    candidateResult =
                        await this
                            .runCandidateStep(
                                runtimeContext
                            );

                    steps.push({
                        step:
                            "candidate",

                        success:
                            Boolean(
                                candidateResult
                                    ?.success
                            ),

                        result:
                            cloneValue(
                                candidateResult
                            )
                    });
                }

                if (
                    runConfig
                        .runDiagnostics
                ) {
                    diagnosticsResult =
                        await this
                            .runDiagnosticsStep();

                    steps.push({
                        step:
                            "diagnostics",

                        success:
                            Boolean(
                                diagnosticsResult
                            ),

                        result:
                            cloneValue(
                                diagnosticsResult
                            )
                    });
                }

                const success =
                    Boolean(
                        candidateResult
                            ?.success ||
                        motionResult
                            ?.success ||
                        replayResult
                            ?.success
                    );

                const result = {
                    success,

                    status:
                        candidateResult
                            ?.status ??
                        (
                            success
                                ? "PIPELINE_COMPLETED"
                                : "PIPELINE_COMPLETED_WITHOUT_ARRIVAL"
                        ),

                    reason:
                        candidateResult
                            ?.reason ??
                        (
                            success
                                ? "MODULAR_PIPELINE_COMPLETED"
                                : "NO_VALID_PIPELINE_RESULT"
                        ),

                    version:
                        this.version,

                    build:
                        this.build,

                    executionCount:
                        this.executionCount,

                    context:
                        cloneValue(
                            runtimeContext
                        ),

                    trackCount:
                        tracks.length,

                    replayResult:
                        cloneValue(
                            replayResult
                        ),

                    motionResult:
                        cloneValue(
                            motionResult
                        ),

                    candidateResult:
                        cloneValue(
                            candidateResult
                        ),

                    diagnostics:
                        cloneValue(
                            diagnosticsResult
                        ),

                    selectedCandidate:
                        cloneValue(
                            candidateResult
                                ?.selectedCandidate ??
                            null
                        ),

                    steps,

                    startedAt,

                    completedAt:
                        now(),

                    durationMs:
                        now() -
                        startedAt
                };

                this.lastResult =
                    cloneValue(result);

                this.updatedAt =
                    now();

                if (result.success) {
                    this.statistics
                        .successful += 1;
                } else {
                    this.statistics
                        .failed += 1;
                }

                this.recordHistory(
                    result
                );

                if (
                    runConfig
                        .publishToRuntime
                ) {
                    this.publishToRuntime(
                        result
                    );
                }

                return result;

            } catch (error) {
                this.statistics.failed += 1;

                this.statistics
                    .moduleErrors += 1;

                const failure = {
                    success: false,

                    status:
                        "PIPELINE_FAILED",

                    reason:
                        error?.message ||
                        "ORCHESTRATOR_EXECUTION_FAILED",

                    version:
                        this.version,

                    build:
                        this.build,

                    context:
                        cloneValue(
                            runtimeContext
                        ),

                    steps,

                    startedAt,

                    completedAt:
                        now(),

                    durationMs:
                        now() -
                        startedAt,

                    error:
                        this.setLastError(
                            error,
                            "ORCHESTRATOR_EXECUTION_FAILED"
                        )
                };

                this.lastResult =
                    cloneValue(failure);

                this.recordHistory(
                    failure
                );

                if (
                    runConfig
                        .publishToRuntime
                ) {
                    this.publishToRuntime(
                        failure
                    );
                }

                return failure;

            } finally {
                this.running =
                    false;
            }
        }

        async runReplayStep(
            tracks,
            config
        ) {
            const replayEngine =
                this.getReplayEngine();

            if (
                !replayEngine ||
                typeof replayEngine
                    .replayAll !==
                    "function"
            ) {
                if (
                    config
                        .continueOnError
                ) {
                    return {
                        success: false,

                        reason:
                            "REPLAY_ENGINE_UNAVAILABLE",

                        results: []
                    };
                }

                throw new Error(
                    "REPLAY_ENGINE_UNAVAILABLE"
                );
            }

            this.statistics
                .replayRuns += 1;

            return replayEngine
                .replayAll({
                    force:
                        config.forceReplay,

                    includeSegments:
                        config
                            .includeReplaySegments,

                    runMotionEngine:
                        false
                });
        }

        async runMotionStep(
            tracks,
            config
        ) {
            const motionEngine =
                this.getMotionEngine();

            if (
                !motionEngine ||
                typeof motionEngine
                    .analyzeAll !==
                    "function"
            ) {
                if (
                    config
                        .continueOnError
                ) {
                    return {
                        success: false,

                        reason:
                            "MOTION_ENGINE_UNAVAILABLE",

                        results: []
                    };
                }

                throw new Error(
                    "MOTION_ENGINE_UNAVAILABLE"
                );
            }

            this.statistics
                .motionRuns += 1;

            return motionEngine
                .analyzeAll({
                    includeSegments:
                        false
                });
        }

        async runCandidateStep(
            context
        ) {
            const candidateEngine =
                this.getCandidateEngine();

            if (
                !candidateEngine ||
                typeof candidateEngine
                    .run !==
                    "function"
            ) {
                return {
                    success: false,

                    status:
                        "RAIN_ARRIVAL_UNAVAILABLE",

                    reason:
                        "CANDIDATE_ENGINE_UNAVAILABLE",

                    selectedCandidate:
                        null
                };
            }

            this.statistics
                .candidateRuns += 1;

            return candidateEngine.run(
                context
            );
        }

        async runDiagnosticsStep() {
            const diagnostics =
                this.getDiagnostics();

            if (
                !diagnostics
            ) {
                return {
                    success: false,

                    reason:
                        "DIAGNOSTICS_UNAVAILABLE"
                };
            }

            this.statistics
                .diagnosticRuns += 1;

            if (
                typeof diagnostics
                    .exportReport ===
                    "function"
            ) {
                return diagnostics
                    .exportReport();
            }

            if (
                typeof diagnostics.run ===
                    "function"
            ) {
                return diagnostics.run();
            }

            return null;
        }

        publishToRuntime(result) {
            global.RainGuardAI =
                global.RainGuardAI || {};

            global.RainGuardAI.V32 =
                global.RainGuardAI.V32 || {};

            const runtimeEngine =
                global.RainGuardAI
                    .V32
                    .rainArrivalPrediction ||
                {};

            runtimeEngine.version =
                "32.38M";

            runtimeEngine.build =
                BUILD;

            runtimeEngine
                .latestModularPipelineResult =
                cloneValue(result);

            runtimeEngine.lastResult =
                cloneValue(result);

            runtimeEngine
                .lastPredictionResult =
                cloneValue(result);

            if (
                result.selectedCandidate
            ) {
                runtimeEngine
                    .selectedArrivalEvidence =
                    cloneValue(
                        result
                            .selectedCandidate
                    );

                runtimeEngine
                    .lastArrivalResult = {
                        status:
                            result.status,

                        trackId:
                            result
                                .selectedCandidate
                                .trackId,

                        arrivalMinutes:
                            result
                                .selectedCandidate
                                .arrivalMinutes,

                        eta:
                            result
                                .selectedCandidate
                                .eta,

                        confidence:
                            result
                                .selectedCandidate
                                .confidence,

                        generatedAt:
                            result.completedAt
                    };
            }

            global.RainGuardAI
                .V32
                .rainArrivalPrediction =
                runtimeEngine;

            return true;
        }

        recordHistory(result) {
            if (
                !this.config
                    .keepHistory
            ) {
                return;
            }

            this.history.push(
                cloneValue(result)
            );

            const maximumHistory =
                Math.max(
                    1,
                    Number(
                        this.config
                            .maximumHistory
                    ) || 200
                );

            if (
                this.history.length >
                maximumHistory
            ) {
                this.history.splice(
                    0,
                    this.history.length -
                    maximumHistory
                );
            }
        }

        setLastError(
            error,
            code
        ) {
            this.lastError = {
                code:
                    code ||
                    "ORCHESTRATOR_ERROR",

                name:
                    error?.name ||
                    "Error",

                message:
                    error?.message ||
                    String(error),

                stack:
                    error?.stack ||
                    null,

                timestamp:
                    now()
            };

            return cloneValue(
                this.lastError
            );
        }

        clear() {
            this.lastResult =
                null;

            this.lastError =
                null;

            this.history = [];

            this.updatedAt =
                now();

            return true;
        }

        getDiagnostics() {
            const moduleNames = [
                "trackStore",
                "utils",
                "cache",
                "replayEngine",
                "motionEngine",
                "candidateEngine",
                "diagnostics"
            ];

            const moduleStatus = {};

            moduleNames.forEach(
                name => {
                    moduleStatus[name] =
                        Boolean(
                            this.resolveModule(
                                name
                            )
                        );
                }
            );

            return {
                module:
                    MODULE_NAME,

                version:
                    this.version,

                build:
                    this.build,

                installed:
                    true,

                running:
                    this.running,

                executionCount:
                    this.executionCount,

                moduleCount:
                    Object.keys(
                        this.modules
                    ).length,

                modules:
                    moduleStatus,

                allRequiredModulesAvailable:
                    [
                        "trackStore",
                        "replayEngine",
                        "motionEngine",
                        "candidateEngine"
                    ].every(
                        name =>
                            moduleStatus[name]
                    ),

                lastResult:
                    cloneValue(
                        this.lastResult
                    ),

                lastError:
                    cloneValue(
                        this.lastError
                    ),

                historyCount:
                    this.history.length,

                statistics:
                    cloneValue(
                        this.statistics
                    ),

                createdAt:
                    this.createdAt,

                updatedAt:
                    this.updatedAt
            };
        }

        diagnose() {
            const diagnostics =
                this.getDiagnostics();

            console.log(
                "[RainArrival Orchestrator]",
                diagnostics
            );

            return diagnostics;
        }

        printModules() {
            const diagnostics =
                this.getDiagnostics();

            const rows =
                Object.entries(
                    diagnostics.modules
                ).map(
                    (
                        [
                            name,
                            available
                        ]
                    ) => ({
                        module:
                            name,

                        available
                    })
                );

            console.table(rows);

            return rows;
        }
    }

    const api =
        new RainArrivalOrchestrator();

    global.RainArrivalOrchestratorV32 =
        api;

    global.RainGuardAI =
        global.RainGuardAI || {};

    global.RainGuardAI.V32 =
        global.RainGuardAI.V32 || {};

    global.RainGuardAI.V32
        .rainArrivalModules =
        global.RainGuardAI.V32
            .rainArrivalModules || {};

    global.RainGuardAI.V32
        .rainArrivalModules
        .orchestrator =
        api;

    global.runRainArrivalModularPipeline =
        async function (
            context = {},
            options = {}
        ) {
            return api.run(
                context,
                options
            );
        };

    console.log(
        "[RainGuard AI V32] Modular Orchestrator loaded.",
        {
            version:
                VERSION,

            build:
                BUILD
        }
    );

})(
    typeof globalThis !==
        "undefined"
        ? globalThis
        : window
);
