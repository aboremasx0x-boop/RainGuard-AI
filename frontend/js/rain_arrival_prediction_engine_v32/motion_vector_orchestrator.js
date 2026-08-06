/*
===========================================================
 RainGuard AI V32
 Phase 38M-18F — Motion Vector Orchestrator
 File: motion_vector_orchestrator.js
 Version: 32.38M.18F

 Pipeline:
 Persistent Track History
 → Motion Vector History
 → Motion Vector Repository
 → Motion Vector Statistics
 → Motion Vector Renderer
 → Motion Recovery
 → Candidate Scoring
 → Final Arrival Decision
===========================================================
*/

(function (global) {
    "use strict";

    const MODULE_NAME =
        "motionVectorOrchestrator";

    const VERSION =
        "32.38M.18F";

    const BUILD_ID =
        "rainguard-v32-phase38m18f-motion-vector-orchestrator";

    const DEFAULT_CONFIG =
        Object.freeze({
            autoStart:
                true,

            runIntervalMs:
                7000,

            stopOnError:
                false,

            runPersistentHistory:
                true,

            runVectorHistory:
                true,

            runRepository:
                true,

            runStatistics:
                true,

            runRenderer:
                true,

            runMotionRecovery:
                true,

            runCandidateScoring:
                true,

            runFinalDecision:
                true,

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

    function invokeStep(
        name,
        target,
        methodName,
        args = []
    ) {
        const startedAt =
            now();

        if (
            !target ||
            typeof target[
                methodName
            ] !==
                "function"
        ) {
            return {
                name,

                method:
                    methodName,

                success:
                    false,

                skipped:
                    true,

                status:
                    "MODULE_OR_METHOD_UNAVAILABLE",

                startedAt,

                completedAt:
                    now(),

                durationMs:
                    now() -
                    startedAt
            };
        }

        try {
            const result =
                target[
                    methodName
                ](...args);

            return {
                name,

                method:
                    methodName,

                success:
                    result?.success !==
                        false,

                skipped:
                    false,

                status:
                    result?.status ??
                    "STEP_COMPLETED",

                result:
                    cloneValue(
                        result
                    ),

                startedAt,

                completedAt:
                    now(),

                durationMs:
                    now() -
                    startedAt
            };

        } catch (error) {
            return {
                name,

                method:
                    methodName,

                success:
                    false,

                skipped:
                    false,

                status:
                    "STEP_FAILED",

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
                },

                startedAt,

                completedAt:
                    now(),

                durationMs:
                    now() -
                    startedAt
            };
        }
    }

    class MotionVectorOrchestrator {

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

            this.executing =
                false;

            this.timer =
                null;

            this.runSequence =
                0;

            this.latestResult =
                null;

            this.lastError =
                null;

            this.history =
                [];

            this.statistics = {
                runs:
                    0,

                successfulRuns:
                    0,

                partialRuns:
                    0,

                failedRuns:
                    0,

                busySkips:
                    0,

                totalSteps:
                    0,

                successfulSteps:
                    0,

                failedSteps:
                    0,

                skippedSteps:
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

                motionVectorStatistics:
                    global
                        .RainArrivalMotionVectorStatisticsV32,

                motionVectorRenderer:
                    global
                        .RainArrivalMotionVectorRendererV32,

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

        getAvailability() {
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

                motionVectorStatistics:
                    Boolean(
                        modules
                            .motionVectorStatistics
                    ),

                motionVectorRenderer:
                    Boolean(
                        modules
                            .motionVectorRenderer
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

        shouldStop(step) {
            return (
                this.config.stopOnError &&
                step.success ===
                    false &&
                step.skipped !==
                    true
            );
        }

        addStep(
            steps,
            enabled,
            name,
            target,
            methodName
        ) {
            if (!enabled) {
                const skippedStep = {
                    name,

                    method:
                        methodName,

                    success:
                        true,

                    skipped:
                        true,

                    status:
                        "STEP_DISABLED",

                    startedAt:
                        now(),

                    completedAt:
                        now(),

                    durationMs:
                        0
                };

                steps.push(
                    skippedStep
                );

                return skippedStep;
            }

            const step =
                invokeStep(
                    name,
                    target,
                    methodName
                );

            steps.push(step);

            return step;
        }

        buildSummary(steps) {
            const persistent =
                global
                    .RainArrivalPersistentTrackHistoryV32;

            const vectorHistory =
                global
                    .RainArrivalMotionVectorHistoryV32;

            const repository =
                global
                    .RainArrivalMotionVectorRepositoryV32;

            const statistics =
                global
                    .RainArrivalMotionVectorStatisticsV32;

            const renderer =
                global
                    .RainArrivalMotionVectorRendererV32;

            const recovery =
                global
                    .RainArrivalStormMotionRecoveryV32;

            const decision =
                global
                    .RainArrivalDecisionEngineV32;

            const persistentTracks =
                persistent
                    ?.getAllTracks?.() ??
                [];

            const vectorTracks =
                vectorHistory
                    ?.getAllTracks?.() ??
                [];

            const repositoryTracks =
                repository
                    ?.getAllTracks?.() ??
                [];

            const nationalStatistics =
                statistics
                    ?.getNationalStatistics?.() ??
                null;

            const rendererDiagnostics =
                renderer
                    ?.getDiagnostics?.() ??
                null;

            const recoveryResult =
                recovery
                    ?.getLatestResult?.() ??
                null;

            const finalDecision =
                decision
                    ?.getDecision?.() ??
                null;

            return {
                stepCount:
                    steps.length,

                successfulStepCount:
                    steps.filter(
                        step =>
                            step.success ===
                                true &&
                            step.skipped !==
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
                    ).length,

                persistentTrackCount:
                    persistentTracks.length,

                tracksWithMultiplePoints:
                    persistentTracks.filter(
                        track =>
                            Number(
                                track.pointCount
                            ) >=
                            2
                    ).length,

                motionVectorTrackCount:
                    vectorTracks.length,

                motionVectorCount:
                    vectorTracks.reduce(
                        (
                            sum,
                            track
                        ) =>
                            sum +
                            Number(
                                track.vectorCount ??
                                track.vectors
                                    ?.length ??
                                0
                            ),
                        0
                    ),

                repositoryTrackCount:
                    repository
                        ?.getTrackCount?.() ??
                    repositoryTracks.length,

                repositoryVectorCount:
                    repository
                        ?.getCount?.() ??
                    repositoryTracks.reduce(
                        (
                            sum,
                            track
                        ) =>
                            sum +
                            Number(
                                track.vectorCount ??
                                track.vectors
                                    ?.length ??
                                0
                            ),
                        0
                    ),

                nationalStatistics:
                    cloneValue(
                        nationalStatistics
                    ),

                renderedLayerCount:
                    rendererDiagnostics
                        ?.layers ??
                    rendererDiagnostics
                        ?.layerCount ??
                    0,

                recoveredCount:
                    recoveryResult
                        ?.recoveredCount ??
                    0,

                approachingCount:
                    recoveryResult
                        ?.approachingCount ??
                    0,

                finalDecisionStatus:
                    finalDecision
                        ?.status ??
                    null,

                finalDecision:
                    cloneValue(
                        finalDecision
                    )
            };
        }

        publish(result) {
            global.RainArrivalMotionVectorPipelineResult =
                cloneValue(
                    result
                );

            global.RainArrivalMotionVectorOrchestratorState =
                {
                    version:
                        this.version,

                    build:
                        this.buildId,

                    running:
                        this.running,

                    executing:
                        this.executing,

                    latestResult:
                        cloneValue(
                            result
                        ),

                    updatedAt:
                        now()
                };

            global.RainGuardAI =
                global.RainGuardAI ||
                {};

            global.RainGuardAI.V32 =
                global.RainGuardAI.V32 ||
                {};

            global.RainGuardAI.V32
                .motionVectorPipelineResult =
                cloneValue(
                    result
                );

            global.RainGuardAI.V32
                .motionVectorOrchestratorState =
                cloneValue(
                    global
                        .RainArrivalMotionVectorOrchestratorState
                );

            global.dispatchEvent?.(
                new CustomEvent(
                    "rainarrival:motion-vector-pipeline-completed",
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

        run() {
            if (
                this.executing
            ) {
                this.statistics
                    .busySkips +=
                    1;

                return {
                    success:
                        false,

                    status:
                        "MOTION_VECTOR_ORCHESTRATOR_BUSY",

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

            const sequence =
                ++
                this.runSequence;

            this.executing =
                true;

            this.statistics
                .runs +=
                1;

            const steps =
                [];

            try {
                const modules =
                    this.getModules();

                let step =
                    this.addStep(
                        steps,
                        this.config
                            .runPersistentHistory,
                        "persistentHistory",
                        modules
                            .persistentHistory,
                        "persist"
                    );

                if (
                    this.shouldStop(
                        step
                    )
                ) {
                    throw new Error(
                        "Persistent history step failed."
                    );
                }

                step =
                    this.addStep(
                        steps,
                        this.config
                            .runVectorHistory,
                        "motionVectorHistory",
                        modules
                            .motionVectorHistory,
                        "buildAll"
                    );

                if (
                    this.shouldStop(
                        step
                    )
                ) {
                    throw new Error(
                        "Motion vector history step failed."
                    );
                }

                step =
                    this.addStep(
                        steps,
                        this.config
                            .runRepository,
                        "motionVectorRepository",
                        modules
                            .motionVectorRepository,
                        "syncFromHistory"
                    );

                if (
                    this.shouldStop(
                        step
                    )
                ) {
                    throw new Error(
                        "Motion vector repository step failed."
                    );
                }

                step =
                    this.addStep(
                        steps,
                        this.config
                            .runStatistics,
                        "motionVectorStatistics",
                        modules
                            .motionVectorStatistics,
                        "analyzeAll"
                    );

                if (
                    this.shouldStop(
                        step
                    )
                ) {
                    throw new Error(
                        "Motion vector statistics step failed."
                    );
                }

                step =
                    this.addStep(
                        steps,
                        this.config
                            .runRenderer,
                        "motionVectorRenderer",
                        modules
                            .motionVectorRenderer,
                        "renderAll"
                    );

                if (
                    this.shouldStop(
                        step
                    )
                ) {
                    throw new Error(
                        "Motion vector renderer step failed."
                    );
                }

                step =
                    this.addStep(
                        steps,
                        this.config
                            .runMotionRecovery,
                        "motionRecovery",
                        modules
                            .motionRecovery,
                        "recoverAll"
                    );

                if (
                    this.shouldStop(
                        step
                    )
                ) {
                    throw new Error(
                        "Motion recovery step failed."
                    );
                }

                step =
                    this.addStep(
                        steps,
                        this.config
                            .runCandidateScoring,
                        "candidateScoring",
                        modules
                            .candidateScoring,
                        "scoreAll"
                    );

                if (
                    this.shouldStop(
                        step
                    )
                ) {
                    throw new Error(
                        "Candidate scoring step failed."
                    );
                }

                step =
                    this.addStep(
                        steps,
                        this.config
                            .runFinalDecision,
                        "finalDecision",
                        modules
                            .finalDecision,
                        "evaluate"
                    );

                if (
                    this.shouldStop(
                        step
                    )
                ) {
                    throw new Error(
                        "Final decision step failed."
                    );
                }

                this.statistics
                    .totalSteps +=
                    steps.length;

                this.statistics
                    .successfulSteps +=
                    steps.filter(
                        currentStep =>
                            currentStep
                                .success ===
                                true &&
                            currentStep
                                .skipped !==
                                true
                    ).length;

                this.statistics
                    .failedSteps +=
                    steps.filter(
                        currentStep =>
                            currentStep
                                .success ===
                                false &&
                            currentStep
                                .skipped !==
                                true
                    ).length;

                this.statistics
                    .skippedSteps +=
                    steps.filter(
                        currentStep =>
                            currentStep
                                .skipped ===
                                true
                    ).length;

                const summary =
                    this.buildSummary(
                        steps
                    );

                let status =
                    "MOTION_VECTOR_ORCHESTRATION_COMPLETED";

                if (
                    summary
                        .failedStepCount >
                    0
                ) {
                    status =
                        "MOTION_VECTOR_ORCHESTRATION_PARTIAL";

                    this.statistics
                        .partialRuns +=
                        1;
                } else {
                    this.statistics
                        .successfulRuns +=
                        1;
                }

                const result = {
                    success:
                        true,

                    status,

                    version:
                        this.version,

                    build:
                        this.buildId,

                    sequence,

                    availability:
                        this
                            .getAvailability(),

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

                this.history.push(
                    cloneValue(
                        result
                    )
                );

                if (
                    this.history.length >
                    25
                ) {
                    this.history.splice(
                        0,
                        this.history.length -
                        25
                    );
                }

                this.publish(
                    result
                );

                if (
                    this.config.debug
                ) {
                    console.log(
                        "[RainArrival MotionVectorOrchestrator] Run result:",
                        result
                    );
                }

                return result;

            } catch (error) {
                this.statistics
                    .failedRuns +=
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
                        "MOTION_VECTOR_ORCHESTRATION_FAILED",

                    version:
                        this.version,

                    build:
                        this.buildId,

                    sequence,

                    availability:
                        this
                            .getAvailability(),

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
                this.executing =
                    false;
            }
        }

        getLatestResult() {
            return cloneValue(
                this.latestResult
            );
        }

        getHistory() {
            return cloneValue(
                this.history
            );
        }

        getDiagnostics() {
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

                executing:
                    this.executing,

                sequence:
                    this.runSequence,

                availability:
                    this
                        .getAvailability(),

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
                "[RainArrival MotionVectorOrchestrator]",
                diagnostics
            );

            return diagnostics;
        }

        printPipeline() {
            const latest =
                this.latestResult;

            if (
                !latest ||
                !Array.isArray(
                    latest.steps
                )
            ) {
                console.table([
                    {
                        status:
                            "NO_PIPELINE_RESULT"
                    }
                ]);

                return [];
            }

            const rows =
                latest.steps.map(
                    (
                        step,
                        index
                    ) => ({
                        order:
                            index +
                            1,

                        step:
                            step.name,

                        method:
                            step.method,

                        status:
                            step.status,

                        success:
                            step.success,

                        skipped:
                            step.skipped,

                        durationMs:
                            step.durationMs
                    })
                );

            console.table(rows);

            return rows;
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

            this.run();

            this.timer =
                global.setInterval(
                    () =>
                        this.run(),
                    this.config
                        .runIntervalMs
                );

            return {
                success:
                    true,

                running:
                    true,

                intervalMs:
                    this.config
                        .runIntervalMs
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

    const orchestrator =
        new MotionVectorOrchestrator();

    global.RainArrivalMotionVectorOrchestratorV32 =
        orchestrator;

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
        .motionVectorOrchestrator =
        orchestrator;

    global.RainArrivalEngineV32
        ?.register?.(
            MODULE_NAME,
            orchestrator
        );

    global.RainArrivalOrchestratorV32
        ?.register?.(
            MODULE_NAME,
            orchestrator
        );

    global.runRainArrivalMotionVectorPipeline =
        () =>
            orchestrator.run();

    if (
        orchestrator.config
            .autoStart
    ) {
        orchestrator.start();
    }

    console.log(
        "[RainGuard AI V32] Motion Vector Orchestrator loaded.",
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
