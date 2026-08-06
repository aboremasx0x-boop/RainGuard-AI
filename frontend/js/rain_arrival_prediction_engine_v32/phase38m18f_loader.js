/*
===========================================================
 RainGuard AI V32
 Phase 38M-18F — Loader
 File: phase38m18f_loader.js
 Version: 32.38M.18F

 Load order:
 1. motion_vector_history.js
 2. motion_vector_repository.js
 3. motion_vector_statistics.js
 4. motion_vector_renderer.js
 5. motion_vector_bridge.js
 6. motion_vector_orchestrator.js
===========================================================
*/

(function (global) {
    "use strict";

    const VERSION =
        "32.38M.18F";

    const BUILD_ID =
        "rainguard-v32-phase38m18f-loader";

    const BASE_PATH =
        "./js/rain_arrival_prediction_engine_v32/";

    const CACHE_VERSION =
        "3238M18F";

    const MODULES = [
        {
            name:
                "motionVectorHistory",

            file:
                "motion_vector_history.js",

            requiredGlobal:
                "RainArrivalMotionVectorHistoryV32"
        },

        {
            name:
                "motionVectorRepository",

            file:
                "motion_vector_repository.js",

            requiredGlobal:
                "RainArrivalMotionVectorRepositoryV32"
        },

        {
            name:
                "motionVectorStatistics",

            file:
                "motion_vector_statistics.js",

            requiredGlobal:
                "RainArrivalMotionVectorStatisticsV32"
        },

        {
            name:
                "motionVectorRenderer",

            file:
                "motion_vector_renderer.js",

            requiredGlobal:
                "RainArrivalMotionVectorRendererV32"
        },

        {
            name:
                "motionVectorBridge",

            file:
                "motion_vector_bridge.js",

            requiredGlobal:
                "RainArrivalMotionVectorBridgeV32"
        },

        {
            name:
                "motionVectorOrchestrator",

            file:
                "motion_vector_orchestrator.js",

            requiredGlobal:
                "RainArrivalMotionVectorOrchestratorV32"
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

        loadedModules:
            [],

        skippedModules:
            [],

        failedModules:
            [],

        currentModule:
            null,

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
                JSON.stringify(value)
            );
        } catch (_) {
            return value;
        }
    }

    function buildScriptUrl(fileName) {
        return (
            BASE_PATH +
            fileName +
            "?v=" +
            CACHE_VERSION
        );
    }

    function findExistingScript(url) {
        return Array.from(
            document.scripts
        ).find(
            script =>
                script.src &&
                script.src.includes(
                    url.split("?")[0]
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

                const check = () => {
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
                };

                check();
            }
        );
    }

    async function loadScriptModule(
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

        if (
            global[
                requiredGlobal
            ]
        ) {
            state
                .skippedModules
                .push({
                    name,

                    file,

                    reason:
                        "ALREADY_AVAILABLE",

                    loadedAt:
                        Date.now()
                });

            return {
                success:
                    true,

                skipped:
                    true,

                name,

                file,

                global:
                    requiredGlobal
            };
        }

        const url =
            buildScriptUrl(
                file
            );

        const existingScript =
            findExistingScript(
                url
            );

        if (existingScript) {
            await waitForGlobal(
                requiredGlobal
            );

            state
                .skippedModules
                .push({
                    name,

                    file,

                    reason:
                        "SCRIPT_ALREADY_PRESENT",

                    loadedAt:
                        Date.now()
                });

            return {
                success:
                    true,

                skipped:
                    true,

                name,

                file,

                global:
                    requiredGlobal
            };
        }

        await new Promise(
            (
                resolve,
                reject
            ) => {
                const script =
                    document.createElement(
                        "script"
                    );

                script.src =
                    url;

                script.async =
                    false;

                script.dataset
                    .rainArrivalPhase =
                    "38M-18F";

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

        state
            .loadedModules
            .push({
                name,

                file,

                global:
                    requiredGlobal,

                loadedAt:
                    Date.now()
            });

        return {
            success:
                true,

            skipped:
                false,

            name,

            file,

            global:
                requiredGlobal
        };
    }

    function publishState() {
        const snapshot =
            cloneValue(
                state
            );

        global.RainArrivalPhase38M18FState =
            snapshot;

        global.RainGuardAI =
            global.RainGuardAI ||
            {};

        global.RainGuardAI.V32 =
            global.RainGuardAI.V32 ||
            {};

        global.RainGuardAI.V32
            .phase38M18F =
            snapshot;

        global.dispatchEvent?.(
            new CustomEvent(
                "rainarrival:phase38m18f-loader-state",
                {
                    detail:
                        snapshot
                }
            )
        );

        return snapshot;
    }

    async function loadAll() {
        if (
            state.status ===
            "LOADING"
        ) {
            return global
                .RainArrivalPhase38M18FLoader
                .readyPromise;
        }

        if (
            state.ready
        ) {
            return {
                success:
                    true,

                status:
                    "PHASE_38M_18F_ALREADY_READY",

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

        state.error =
            null;

        state.loadedModules =
            [];

        state.skippedModules =
            [];

        state.failedModules =
            [];

        publishState();

        try {
            const results =
                [];

            for (
                const moduleDefinition
                of MODULES
            ) {
                try {
                    const result =
                        await loadScriptModule(
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

                    state.status =
                        "FAILED";

                    state.error =
                        failure;

                    publishState();

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
                    .RainArrivalMotionVectorOrchestratorV32;

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
                    "PHASE_38M_18F_READY",

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
                "[RainGuard AI V32] Phase 38M-18F loaded.",
                result
            );

            global.dispatchEvent?.(
                new CustomEvent(
                    "rainarrival:phase38m18f-ready",
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
                    "PHASE_38M_18F_LOAD_FAILED",

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
                "[RainGuard AI V32] Phase 38M-18F load failed.",
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

        readyPromise:
            null
    };

    global.RainArrivalPhase38M18FLoader =
        loader;

    loader.readyPromise =
        loadAll();

})(
    typeof globalThis !==
        "undefined"
        ? globalThis
        : window
);
