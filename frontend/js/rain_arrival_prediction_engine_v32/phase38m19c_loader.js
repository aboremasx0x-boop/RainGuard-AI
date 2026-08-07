/*
===========================================================
 RainGuard AI V32
 Phase 38M-19C — Loader
 File: phase38m19c_loader.js
 Version: 32.38M.19C

 Load order:
 1. adaptive_motion_confidence.js
 2. adaptive_motion_confidence_repository.js
 3. adaptive_motion_confidence_statistics.js
 4. adaptive_motion_confidence_renderer.js
 5. adaptive_motion_confidence_orchestrator.js
===========================================================
*/

(function (global) {
    "use strict";

    const VERSION =
        "32.38M.19C";

    const BUILD_ID =
        "rainguard-v32-phase38m19c-loader";

    const BASE_PATH =
        "./js/rain_arrival_prediction_engine_v32/";

    const CACHE_VERSION =
        "3238M19C";

    const MODULES = [
        {
            name:
                "adaptiveMotionConfidence",

            file:
                "adaptive_motion_confidence.js",

            requiredGlobal:
                "RainArrivalAdaptiveMotionConfidenceV32"
        },

        {
            name:
                "adaptiveMotionConfidenceRepository",

            file:
                "adaptive_motion_confidence_repository.js",

            requiredGlobal:
                "RainArrivalAdaptiveMotionConfidenceRepositoryV32"
        },

        {
            name:
                "adaptiveMotionConfidenceStatistics",

            file:
                "adaptive_motion_confidence_statistics.js",

            requiredGlobal:
                "RainArrivalAdaptiveMotionConfidenceStatisticsV32"
        },

        {
            name:
                "adaptiveMotionConfidenceRenderer",

            file:
                "adaptive_motion_confidence_renderer.js",

            requiredGlobal:
                "RainArrivalAdaptiveMotionConfidenceRendererV32"
        },

        {
            name:
                "adaptiveMotionConfidenceOrchestrator",

            file:
                "adaptive_motion_confidence_orchestrator.js",

            requiredGlobal:
                "RainArrivalAdaptiveMotionConfidenceOrchestratorV32"
        }
    ];

    const state = {
        version:
            VERSION,

        build:
            BUILD_ID,

        status:
            "IDLE",

        startedAt:
            null,

        completedAt:
            null,

        currentModule:
            null,

        loadedModules:
            [],

        skippedModules:
            [],

        failedModules:
            [],

        ready:
            false,

        error:
            null
    };

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
            } catch (_) {}
        }

        try {
            return JSON.parse(
                JSON.stringify(
                    value
                )
            );
        } catch (_) {
            return value;
        }
    }

    function buildScriptUrl(
        fileName
    ) {
        return (
            BASE_PATH +
            fileName +
            "?v=" +
            CACHE_VERSION
        );
    }

    function findExistingScript(
        fileName
    ) {
        return Array.from(
            document.scripts
        ).find(
            script =>
                script.src &&
                script.src.includes(
                    BASE_PATH +
                    fileName
                )
        ) || null;
    }

    function waitForGlobal(
        globalName,
        timeoutMs = 10000
    ) {
        return new Promise(
            (
                resolve,
                reject
            ) => {
                const startedAt =
                    Date.now();

                function check() {
                    if (
                        global[
                            globalName
                        ]
                    ) {
                        resolve(
                            global[
                                globalName
                            ]
                        );

                        return;
                    }

                    if (
                        Date.now() -
                        startedAt >=
                        timeoutMs
                    ) {
                        reject(
                            new Error(
                                "Timed out waiting for global: " +
                                globalName
                            )
                        );

                        return;
                    }

                    global.setTimeout(
                        check,
                        50
                    );
                }

                check();
            }
        );
    }

    function publishState() {
        const snapshot =
            cloneValue(
                state
            );

        global
            .RainArrivalPhase38M19CState =
            snapshot;

        global.RainGuardAI =
            global.RainGuardAI ||
            {};

        global.RainGuardAI.V32 =
            global.RainGuardAI.V32 ||
            {};

        global.RainGuardAI.V32
            .phase38M19C =
            snapshot;

        global.dispatchEvent?.(
            new CustomEvent(
                "rainarrival:phase38m19c-loader-state",
                {
                    detail:
                        snapshot
                }
            )
        );

        return snapshot;
    }

    async function loadModule(
        moduleDefinition
    ) {
        const {
            name,
            file,
            requiredGlobal
        } =
            moduleDefinition;

        state.currentModule =
            name;

        publishState();

        if (
            global[
                requiredGlobal
            ]
        ) {
            const entry = {
                name,

                file,

                global:
                    requiredGlobal,

                reason:
                    "ALREADY_AVAILABLE",

                loadedAt:
                    Date.now()
            };

            state
                .skippedModules
                .push(
                    entry
                );

            return {
                success:
                    true,

                skipped:
                    true,

                ...entry
            };
        }

        const existingScript =
            findExistingScript(
                file
            );

        if (
            existingScript
        ) {
            await waitForGlobal(
                requiredGlobal
            );

            const entry = {
                name,

                file,

                global:
                    requiredGlobal,

                reason:
                    "SCRIPT_ALREADY_PRESENT",

                loadedAt:
                    Date.now()
            };

            state
                .skippedModules
                .push(
                    entry
                );

            return {
                success:
                    true,

                skipped:
                    true,

                ...entry
            };
        }

        await new Promise(
            (
                resolve,
                reject
            ) => {
                const script =
                    document
                        .createElement(
                            "script"
                        );

                script.src =
                    buildScriptUrl(
                        file
                    );

                script.async =
                    false;

                script.dataset
                    .rainArrivalPhase =
                    "38M-19C";

                script.dataset
                    .rainArrivalModule =
                    name;

                script.onload =
                    () =>
                        resolve();

                script.onerror =
                    () =>
                        reject(
                            new Error(
                                "Failed to load " +
                                file
                            )
                        );

                document.head
                    .appendChild(
                        script
                    );
            }
        );

        await waitForGlobal(
            requiredGlobal
        );

        const entry = {
            name,

            file,

            global:
                requiredGlobal,

            loadedAt:
                Date.now()
        };

        state
            .loadedModules
            .push(
                entry
            );

        return {
            success:
                true,

            skipped:
                false,

            ...entry
        };
    }

    async function loadAll() {
        if (
            state.status ===
            "LOADING"
        ) {
            return global
                .RainArrivalPhase38M19CLoader
                .readyPromise;
        }

        if (
            state.ready
        ) {
            return {
                success:
                    true,

                status:
                    "PHASE_38M_19C_ALREADY_READY",

                state:
                    publishState()
            };
        }

        state.status =
            "LOADING";

        state.startedAt =
            Date.now();

        state.completedAt =
            null;

        state.currentModule =
            null;

        state.loadedModules =
            [];

        state.skippedModules =
            [];

        state.failedModules =
            [];

        state.ready =
            false;

        state.error =
            null;

        publishState();

        const results =
            [];

        try {
            for (
                const moduleDefinition
                of MODULES
            ) {
                try {
                    const result =
                        await loadModule(
                            moduleDefinition
                        );

                    results.push(
                        result
                    );

                    publishState();

                } catch (error) {
                    const failure = {
                        name:
                            moduleDefinition
                                .name,

                        file:
                            moduleDefinition
                                .file,

                        global:
                            moduleDefinition
                                .requiredGlobal,

                        message:
                            error?.message ??
                            String(error),

                        timestamp:
                            Date.now()
                    };

                    state
                        .failedModules
                        .push(
                            failure
                        );

                    state.error =
                        failure;

                    throw error;
                }
            }

            state.status =
                "READY";

            state.ready =
                true;

            state.currentModule =
                null;

            state.completedAt =
                Date.now();

            const finalState =
                publishState();

            const orchestrator =
                global
                    .RainArrivalAdaptiveMotionConfidenceOrchestratorV32;

            const pipelineResult =
                orchestrator &&
                typeof orchestrator
                    .run ===
                    "function"
                    ? orchestrator
                        .run()
                    : null;

            const result = {
                success:
                    true,

                status:
                    "PHASE_38M_19C_READY",

                version:
                    VERSION,

                build:
                    BUILD_ID,

                moduleCount:
                    MODULES.length,

                loadedCount:
                    state
                        .loadedModules
                        .length,

                skippedCount:
                    state
                        .skippedModules
                        .length,

                failedCount:
                    state
                        .failedModules
                        .length,

                results:
                    cloneValue(
                        results
                    ),

                pipelineResult:
                    cloneValue(
                        pipelineResult
                    ),

                state:
                    finalState
            };

            console.log(
                "[RainGuard AI V32] Phase 38M-19C loaded.",
                result
            );

            global.dispatchEvent?.(
                new CustomEvent(
                    "rainarrival:phase38m19c-ready",
                    {
                        detail:
                            cloneValue(
                                result
                            )
                    }
                )
            );

            return result;

        } catch (error) {
            state.status =
                "FAILED";

            state.ready =
                false;

            state.currentModule =
                null;

            state.completedAt =
                Date.now();

            state.error = {
                name:
                    error?.name ??
                    "Error",

                message:
                    error?.message ??
                    String(error),

                stack:
                    error?.stack ??
                    null,

                timestamp:
                    Date.now()
            };

            publishState();

            const result = {
                success:
                    false,

                status:
                    "PHASE_38M_19C_LOAD_FAILED",

                version:
                    VERSION,

                build:
                    BUILD_ID,

                error:
                    cloneValue(
                        state.error
                    ),

                state:
                    cloneValue(
                        state
                    )
            };

            console.error(
                "[RainGuard AI V32] Phase 38M-19C load failed.",
                result
            );

            return result;
        }
    }

    function getState() {
        return cloneValue(
            state
        );
    }

    function getModules() {
        return MODULES.map(
            moduleDefinition => ({
                ...moduleDefinition,

                available:
                    Boolean(
                        global[
                            moduleDefinition
                                .requiredGlobal
                        ]
                    )
            })
        );
    }

    function printModules() {
        const modules =
            getModules();

        console.table(
            modules.map(
                moduleDefinition => ({
                    name:
                        moduleDefinition
                            .name,

                    file:
                        moduleDefinition
                            .file,

                    global:
                        moduleDefinition
                            .requiredGlobal,

                    available:
                        moduleDefinition
                            .available
                })
            )
        );

        return modules;
    }

    function diagnose() {
        const result = {
            version:
                VERSION,

            build:
                BUILD_ID,

            state:
                getState(),

            modules:
                getModules(),

            confidenceEngine:
                global
                    .RainArrivalAdaptiveMotionConfidenceV32
                    ?.getDiagnostics?.() ??
                null,

            repository:
                global
                    .RainArrivalAdaptiveMotionConfidenceRepositoryV32
                    ?.getDiagnostics?.() ??
                null,

            statistics:
                global
                    .RainArrivalAdaptiveMotionConfidenceStatisticsV32
                    ?.getDiagnostics?.() ??
                null,

            renderer:
                global
                    .RainArrivalAdaptiveMotionConfidenceRendererV32
                    ?.getDiagnostics?.() ??
                null,

            orchestrator:
                global
                    .RainArrivalAdaptiveMotionConfidenceOrchestratorV32
                    ?.getDiagnostics?.() ??
                null
        };

        console.log(
            "[RainGuard AI V32] Phase 38M-19C diagnostics:",
            result
        );

        return result;
    }

    const loader = {
        version:
            VERSION,

        build:
            BUILD_ID,

        modules:
            cloneValue(
                MODULES
            ),

        load:
            loadAll,

        getState,

        getModules,

        printModules,

        diagnose,

        readyPromise:
            null
    };

    global
        .RainArrivalPhase38M19CLoader =
        loader;

    loader.readyPromise =
        loadAll();

})(
    typeof globalThis !==
        "undefined"
        ? globalThis
        : window
);
