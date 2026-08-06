/*
===========================================================
 RainGuard AI V32
 Phase 38M-18F — Motion Vector Bridge
 File: motion_vector_bridge.js
 Version: 32.38M.18F

 Responsibilities:
 - Coordinate Persistent Track History, Motion Vector History,
   Motion Vector Repository, Motion Recovery and Final Decision.
 - Execute the motion-vector pipeline in the correct order.
 - Publish a unified bridge state.
 - Expose manual sync, diagnostics and table helpers.
===========================================================
*/

(function (global) {
    "use strict";

    const MODULE_NAME =
        "motionVectorBridge";

    const VERSION =
        "32.38M.18F";

    const BUILD_ID =
        "rainguard-v32-phase38m18f-motion-vector-bridge";

    const DEFAULT_CONFIG =
        Object.freeze({
            autoStart:
                true,

            syncIntervalMs:
                6000,

            refreshPersistentHistory:
                true,

            rebuildMotionVectors:
                true,

            syncRepository:
                true,

            runMotionRecovery:
                true,

            rerunCandidateScoring:
                true,

            rerunFinalDecision:
                true,

            stopOnError:
                false,

            debug:
                true
        });

    const now =
        () => Date.now();

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
                return structuredClone(value);
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

    function safeInvoke(
        target,
        methodName,
        args = []
    ) {
        if (
            !target ||
            typeof target[
                methodName
            ] !==
                "function"
        ) {
            return {
                success:
                    false,

                skipped:
                    true,

                reason:
                    "METHOD_UNAVAILABLE",

                method:
                    methodName
            };
        }

        try {
            const result =
                target[
                    methodName
                ](...args);

            return {
                success:
                    result?.success !==
                        false,

                skipped:
                    false,

                method:
                    methodName,

                result:
                    cloneValue(
                        result
                    )
            };
        } catch (error) {
            return {
                success:
                    false,

                skipped:
                    false,

                method:
                    methodName,

                error: {
                    name:
                        error?.name ??
                        "Error",

                    message:
                        error?.message ??
                        String(error),

                    stack:
                        error?.stack ??
                        null
                }
            };
        }
    }

    class MotionVectorBridge {

        constructor(config = {}) {
            this.version =
                VERSION;

            this.buildId =
                BUILD_ID;

            this.config = {
                ...DEFAULT_CONFIG,
                ...(config || {})
            };

            this.running =
                false;

            this.timer =
                null;

            this.syncing =
                false;

            this.latestResult =
                null;

            this.lastError =
                null;

            this.statistics = {
                syncs:
                    0,

                successfulSyncs:
                    0,

                partialSyncs:
                    0,

                failedSyncs:
                    0,

                historyRefreshes:
                    0,

                vectorBuilds:
                    0,

                repositorySyncs:
                    0,

                recoveryRuns:
                    0,

                scoringRuns:
                    0,

                decisionRuns:
                    0
            };
        }

        getModules() {
            return {
                persistentHistory:
                    global
                        .RainArrivalPersistentTrackHistoryV32,

                motionVectorHistory:
                    global
                        .RainArrivalMotionVectorHistoryV32,

                motionVectorRepository:
                    global
                        .RainArrivalMotionVectorRepositoryV32,

                motionRecovery:
                    global
                        .RainArrivalStormMotionRecoveryV32,

                candidateScoring:
                    global
                        .RainArrivalCandidateScoringV32,

                finalDecision:
                    global
                        .RainArrivalDecisionEngineV32
            };
        }

        getModuleAvailability() {
            const modules =
                this.getModules();

            return {
                persistentHistory:
                    Boolean(
                        modules
                            .persistentHistory
                    ),

                motionVectorHistory:
                    Boolean(
                        modules
                            .motionVectorHistory
                    ),

                motionVectorRepository:
                    Boolean(
                        modules
                            .motionVectorRepository
                    ),

                motionRecovery:
                    Boolean(
                        modules
                            .motionRecovery
                    ),

                candidateScoring:
                    Boolean(
                        modules
                            .candidateScoring
                    ),

                finalDecision:
                    Boolean(
                        modules
                            .finalDecision
                    )
            };
        }

        shouldStop(stepResult) {
            return (
                this.config.stopOnError &&
                stepResult &&
                stepResult.success ===
                    false &&
                stepResult.skipped !==
                    true
            );
        }

        buildSummary(steps) {
            const repository =
                global
                    .RainArrivalMotionVectorRepositoryV32;

            const history =
                global
                    .RainArrivalMotionVectorHistoryV32;

            const persistent =
                global
                    .RainArrivalPersistentTrackHistoryV32;

            const decision =
                global
                    .RainArrivalDecisionEngineV32;

            return {
                persistentTrackCount:
                    persistent
                        ?.getAllTracks?.()
                        ?.length ??
                    0,

                persistentMultiPointCount:
                    persistent
                        ?.getAllTracks?.()
                        ?.filter(
                            track =>
                                track
                                    .pointCount >=
                                2
                        )
                        .length ??
                    0,

                vectorTrackCount:
                    history
                        ?.getAllTracks?.()
                        ?.length ??
                    0,

                repositoryTrackCount:
                    repository
                        ?.getTrackCount?.() ??
                    repository
                        ?.getAllTracks?.()
                        ?.length ??
                    0,

                repositoryVectorCount:
                    repository
                        ?.getCount?.() ??
                    0,

                latestDecisionStatus:
                    decision
                        ?.getDecision?.()
                        ?.status ??
                    null,

                stepCount:
                    steps.length,

                successfulStepCount:
                    steps.filter(
                        step =>
                            step.success ===
                            true
                    ).length,

                failedStepCount:
                    steps.filter(
                        step =>
                            step.success ===
                            false &&
                            step.skipped !==
                                true
                    ).length,

                skippedStepCount:
                    steps.filter(
                        step =>
                            step.skipped ===
                            true
                    ).length
            };
        }

        publish(result) {
            global.RainArrivalMotionVectorBridgeState =
                cloneValue(
                    result
                );

            global.RainGuardAI =
                global.RainGuardAI ||
                {};

            global.RainGuardAI.V32 =
                global.RainGuardAI.V32 ||
                {};

            global.RainGuardAI.V32
                .motionVectorBridgeState =
                cloneValue(
                    result
                );

            global.dispatchEvent?.(
                new CustomEvent(
                    "rainarrival:motion-vector-bridge-synced",
                    {
                        detail:
                            cloneValue(
                                result
                            )
                    }
                )
            );

            return result;
        }

        sync() {
            if (this.syncing) {
                return {
                    success:
                        false,

                    status:
                        "MOTION_VECTOR_BRIDGE_BUSY",

                    version:
                        this.version,

                    build:
                        this.buildId,

                    generatedAt:
                        now()
                };
            }

            const startedAt =
                now();

            this.syncing =
                true;

            this.statistics
                .syncs += 1;

            const steps =
                [];

            try {
                const modules =
                    this.getModules();

                if (
                    this.config
                        .refreshPersistentHistory
                ) {
                    const step =
                        safeInvoke(
                            modules
                                .persistentHistory,
                            "persist"
                        );

                    step.name =
                        "persistentHistory";

                    steps.push(step);

                    if (
                        step.success &&
                        !step.skipped
                    ) {
                        this.statistics
                            .historyRefreshes +=
                            1;
                    }

                    if (
                        this.shouldStop(
                            step
                        )
                    ) {
                        throw new Error(
                            "Persistent history refresh failed."
                        );
                    }
                }

                if (
                    this.config
                        .rebuildMotionVectors
                ) {
                    const step =
                        safeInvoke(
                            modules
                                .motionVectorHistory,
                            "buildAll"
                        );

                    step.name =
                        "motionVectorHistory";

                    steps.push(step);

                    if (
                        step.success &&
                        !step.skipped
                    ) {
                        this.statistics
                            .vectorBuilds +=
                            1;
                    }

                    if (
                        this.shouldStop(
                            step
                        )
                    ) {
                        throw new Error(
                            "Motion vector build failed."
                        );
                    }
                }

                if (
                    this.config
                        .syncRepository
                ) {
                    const step =
                        safeInvoke(
                            modules
                                .motionVectorRepository,
                            "syncFromHistory"
                        );

                    step.name =
                        "motionVectorRepository";

                    steps.push(step);

                    if (
                        step.success &&
                        !step.skipped
                    ) {
                        this.statistics
                            .repositorySyncs +=
                            1;
                    }

                    if (
                        this.shouldStop(
                            step
                        )
                    ) {
                        throw new Error(
                            "Motion vector repository sync failed."
                        );
                    }
                }

                if (
                    this.config
                        .runMotionRecovery
                ) {
                    const step =
                        safeInvoke(
                            modules
                                .motionRecovery,
                            "recoverAll"
                        );

                    step.name =
                        "motionRecovery";

                    steps.push(step);

                    if (
                        step.success &&
                        !step.skipped
                    ) {
                        this.statistics
                            .recoveryRuns +=
                            1;
                    }

                    if (
                        this.shouldStop(
                            step
                        )
                    ) {
                        throw new Error(
                            "Motion recovery failed."
                        );
                    }
                }

                if (
                    this.config
                        .rerunCandidateScoring
                ) {
                    const step =
                        safeInvoke(
                            modules
                                .candidateScoring,
                            "scoreAll"
                        );

                    step.name =
                        "candidateScoring";

                    steps.push(step);

                    if (
                        step.success &&
                        !step.skipped
                    ) {
                        this.statistics
                            .scoringRuns +=
                            1;
                    }

                    if (
                        this.shouldStop(
                            step
                        )
                    ) {
                        throw new Error(
                            "Candidate scoring failed."
                        );
                    }
                }

                if (
                    this.config
                        .rerunFinalDecision
                ) {
                    const step =
                        safeInvoke(
                            modules
                                .finalDecision,
                            "evaluate"
                        );

                    step.name =
                        "finalDecision";

                    steps.push(step);

                    if (
                        step.success &&
                        !step.skipped
                    ) {
                        this.statistics
                            .decisionRuns +=
                            1;
                    }

                    if (
                        this.shouldStop(
                            step
                        )
                    ) {
                        throw new Error(
                            "Final decision evaluation failed."
                        );
                    }
                }

                const summary =
                    this.buildSummary(
                        steps
                    );

                let status =
                    "MOTION_VECTOR_BRIDGE_SYNC_COMPLETED";

                let success =
                    true;

                if (
                    summary
                        .failedStepCount >
                    0
                ) {
                    status =
                        "MOTION_VECTOR_BRIDGE_SYNC_PARTIAL";

                    this.statistics
                        .partialSyncs +=
                        1;
                } else {
                    this.statistics
                        .successfulSyncs +=
                        1;
                }

                const result = {
                    success,

                    status,

                    version:
                        this.version,

                    build:
                        this.buildId,

                    availability:
                        this
                            .getModuleAvailability(),

                    steps:
                        cloneValue(
                            steps
                        ),

                    summary,

                    startedAt,

                    completedAt:
                        now(),

                    durationMs:
                        now() -
                        startedAt
                };

                this.latestResult =
                    cloneValue(
                        result
                    );

                this.publish(
                    result
                );

                if (
                    this.config.debug
                ) {
                    console.log(
                        "[RainArrival MotionVectorBridge] Sync result:",
                        result
                    );
                }

                return result;

            } catch (error) {
                this.statistics
                    .failedSyncs +=
                    1;

                this.lastError = {
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
                        now()
                };

                const result = {
                    success:
                        false,

                    status:
                        "MOTION_VECTOR_BRIDGE_SYNC_FAILED",

                    version:
                        this.version,

                    build:
                        this.buildId,

                    availability:
                        this
                            .getModuleAvailability(),

                    steps:
                        cloneValue(
                            steps
                        ),

                    error:
                        cloneValue(
                            this.lastError
                        ),

                    startedAt,

                    completedAt:
                        now(),

                    durationMs:
                        now() -
                        startedAt
                };

                this.latestResult =
                    cloneValue(
                        result
                    );

                this.publish(
                    result
                );

                return result;

            } finally {
                this.syncing =
                    false;
            }
        }

        getLatestResult() {
            return cloneValue(
                this.latestResult
            );
        }

        getDiagnostics() {
            const modules =
                this.getModules();

            return {
                module:
                    MODULE_NAME,

                version:
                    this.version,

                build:
                    this.buildId,

                installed:
                    true,

                running:
                    this.running,

                syncing:
                    this.syncing,

                availability:
                    this
                        .getModuleAvailability(),

                persistentHistory:
                    modules
                        .persistentHistory
                        ?.getDiagnostics?.() ??
                    null,

                motionVectorHistory:
                    modules
                        .motionVectorHistory
                        ?.getDiagnostics?.() ??
                    null,

                motionVectorRepository:
                    modules
                        .motionVectorRepository
                        ?.getDiagnostics?.() ??
                    null,

                motionRecovery:
                    modules
                        .motionRecovery
                        ?.getDiagnostics?.() ??
                    null,

                latestResult:
                    this
                        .getLatestResult(),

                lastError:
                    cloneValue(
                        this.lastError
                    ),

                statistics:
                    cloneValue(
                        this.statistics
                    )
            };
        }

        diagnose() {
            const diagnostics =
                this.getDiagnostics();

            console.log(
                "[RainArrival MotionVectorBridge]",
                diagnostics
            );

            return diagnostics;
        }

        printTable() {
            const repository =
                global
                    .RainArrivalMotionVectorRepositoryV32;

            if (
                repository &&
                typeof repository
                    .printTable ===
                    "function"
            ) {
                return repository
                    .printTable();
            }

            const history =
                global
                    .RainArrivalMotionVectorHistoryV32;

            if (
                history &&
                typeof history
                    .printTable ===
                    "function"
            ) {
                return history
                    .printTable();
            }

            console.table([
                {
                    status:
                        "NO_MOTION_VECTOR_TABLE_AVAILABLE"
                }
            ]);

            return [];
        }

        start() {
            if (
                this.running
            ) {
                return {
                    success:
                        true,

                    alreadyRunning:
                        true
                };
            }

            this.running =
                true;

            this.sync();

            this.timer =
                global.setInterval(
                    () =>
                        this.sync(),
                    this.config
                        .syncIntervalMs
                );

            return {
                success:
                    true,

                running:
                    true,

                intervalMs:
                    this.config
                        .syncIntervalMs
            };
        }

        stop() {
            if (
                this.timer
            ) {
                global.clearInterval(
                    this.timer
                );
            }

            this.timer =
                null;

            this.running =
                false;

            return {
                success:
                    true,

                running:
                    false
            };
        }
    }

    const bridge =
        new MotionVectorBridge();

    global.RainArrivalMotionVectorBridgeV32 =
        bridge;

    global.RainGuardAI =
        global.RainGuardAI ||
        {};

    global.RainGuardAI.V32 =
        global.RainGuardAI.V32 ||
        {};

    global.RainGuardAI.V32
        .rainArrivalModules =
        global.RainGuardAI.V32
            .rainArrivalModules ||
        {};

    global.RainGuardAI.V32
        .rainArrivalModules
        .motionVectorBridge =
        bridge;

    global.RainArrivalEngineV32
        ?.register?.(
            MODULE_NAME,
            bridge
        );

    global.RainArrivalOrchestratorV32
        ?.register?.(
            MODULE_NAME,
            bridge
        );

    global.syncRainArrivalMotionVectorPipeline =
        () =>
            bridge.sync();

    if (
        bridge.config
            .autoStart
    ) {
        bridge.start();
    }

    console.log(
        "[RainGuard AI V32] Motion Vector Bridge loaded.",
        {
            version:
                VERSION,

            build:
                BUILD_ID
        }
    );

})(
    typeof globalThis !==
        "undefined"
        ? globalThis
        : window
);
