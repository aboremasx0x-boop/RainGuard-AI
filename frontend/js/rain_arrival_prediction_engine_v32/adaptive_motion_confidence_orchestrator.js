/*
===========================================================
 RainGuard AI V32
 Phase 38M-19C — Adaptive Motion Confidence Orchestrator
 File: adaptive_motion_confidence_orchestrator.js
 Version: 32.38M.19C

 Pipeline:
 Adaptive Motion Confidence Engine
 → Confidence Repository
 → Confidence Statistics
 → Confidence Renderer
 → Candidate Scoring refresh
 → Final Arrival Decision refresh
===========================================================
*/

(function (global) {
    "use strict";

    const MODULE_NAME =
        "adaptiveMotionConfidenceOrchestrator";

    const VERSION =
        "32.38M.19C";

    const BUILD_ID =
        "rainguard-v32-phase38m19c-adaptive-motion-confidence-orchestrator";

    const DEFAULT_CONFIG =
        Object.freeze({
            autoStart: true,
            runIntervalMs: 25000,
            stopOnError: false,

            runConfidenceEngine: true,
            runRepository: true,
            runStatistics: true,
            runRenderer: true,

            rerunCandidateScoring: true,
            rerunFinalDecision: true,

            maximumHistoryEntries: 40,
            debug: true
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

    class AdaptiveMotionConfidenceOrchestrator {

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

            this.sequence =
                0;

            this.latestResult =
                null;

            this.lastError =
                null;

            this.history =
                [];

            this.statistics = {
                runs: 0,
                successfulRuns: 0,
                partialRuns: 0,
                failedRuns: 0,
                busySkips: 0,
                totalSteps: 0,
                successfulSteps: 0,
                failedSteps: 0,
                skippedSteps: 0
            };
        }

        getModules() {
            return {
                confidenceEngine:
                    global
                        .RainArrivalAdaptiveMotionConfidenceV32 ??
                    global
                        .RainArrivalAdaptiveMotionConfidenceEngineV32,

                repository:
                    global
                        .RainArrivalAdaptiveMotionConfidenceRepositoryV32,

                statistics:
                    global
                        .RainArrivalAdaptiveMotionConfidenceStatisticsV32,

                renderer:
                    global
                        .RainArrivalAdaptiveMotionConfidenceRendererV32,

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
                confidenceEngine:
                    Boolean(
                        modules
                            .confidenceEngine
                    ),

                repository:
                    Boolean(
                        modules
                            .repository
                    ),

                statistics:
                    Boolean(
                        modules
                            .statistics
                    ),

                renderer:
                    Boolean(
                        modules
                            .renderer
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
                this.config
                    .stopOnError &&
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
                const step = {
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
                    step
                );

                return step;
            }

            const step =
                invokeStep(
                    name,
                    target,
                    methodName
                );

            steps.push(
                step
            );

            return step;
        }

        buildSummary(steps) {
            const modules =
                this.getModules();

            const confidenceResult =
                modules
                    .confidenceEngine
                    ?.getLatestResult?.() ??
                null;

            const repositoryResult =
                modules
                    .repository
                    ?.getLatestResult?.() ??
                null;

            const statisticsResult =
                modules
                    .statistics
                    ?.getLatestResult?.() ??
                null;

            const rendererResult =
                modules
                    .renderer
                    ?.getLatestResult?.() ??
                null;

            const topConfidence =
                modules
                    .repository
                    ?.getTopConfidence?.() ??
                modules
                    .confidenceEngine
                    ?.getTopConfidence?.() ??
                null;

            const finalDecision =
                modules
                    .finalDecision
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

                confidenceStatus:
                    confidenceResult
                        ?.status ??
                    null,

                confidenceRecordCount:
                    modules
                        .repository
                        ?.getCount?.() ??
                    repositoryResult
                        ?.repositoryCount ??
                    0,

                averageConfidence:
                    statisticsResult
                        ?.confidence
                        ?.mean ??
                    confidenceResult
                        ?.averageConfidence ??
                    null,

                highestConfidence:
                    statisticsResult
                        ?.confidence
                        ?.max ??
                    confidenceResult
                        ?.highestConfidence ??
                    null,

                acceptedRatio:
                    statisticsResult
                        ?.acceptedRatio ??
                    null,

                strongRatio:
                    statisticsResult
                        ?.strongRatio ??
                    null,

                veryStrongRatio:
                    statisticsResult
                        ?.veryStrongRatio ??
                    null,

                averageEvidenceCoverage:
                    statisticsResult
                        ?.evidenceCoverage
                        ?.mean ??
                    null,

                nationalQuality:
                    statisticsResult
                        ?.nationalQuality ??
                    null,

                cityCount:
                    statisticsResult
                        ?.cityCount ??
                    0,

                rendererStatus:
                    rendererResult
                        ?.status ??
                    null,

                topConfidence:
                    cloneValue(
                        topConfidence
                    ),

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
            global
                .RainArrivalAdaptiveMotionConfidencePipelineResult =
                cloneValue(
                    result
                );

            global
                .RainArrivalAdaptiveMotionConfidenceOrchestratorState =
                {
                    version:
                        this.version,

                    build:
                        this.buildId,

                    running:
                        this.running,

                    executing:
                        this.executing,

                    sequence:
                        this.sequence,

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
                .adaptiveMotionConfidencePipelineResult =
                cloneValue(
                    result
                );

            global.RainGuardAI.V32
                .adaptiveMotionConfidenceOrchestratorState =
                cloneValue(
                    global
                        .RainArrivalAdaptiveMotionConfidenceOrchestratorState
                );

            global.dispatchEvent?.(
                new CustomEvent(
                    "rainarrival:adaptive-motion-confidence-pipeline-completed",
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
                        "ADAPTIVE_MOTION_CONFIDENCE_ORCHESTRATOR_BUSY",

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
                ++this.sequence;

            const steps =
                [];

            this.executing =
                true;

            this.statistics
                .runs +=
                1;

            try {
                const modules =
                    this.getModules();

                let step =
                    this.addStep(
                        steps,
                        this.config
                            .runConfidenceEngine,
                        "adaptiveMotionConfidence",
                        modules
                            .confidenceEngine,
                        "evaluateAll"
                    );

                if (
                    this.shouldStop(
                        step
                    )
                ) {
                    throw new Error(
                        "Adaptive Motion Confidence Engine step failed."
                    );
                }

                step =
                    this.addStep(
                        steps,
                        this.config
                            .runRepository,
                        "adaptiveMotionConfidenceRepository",
                        modules
                            .repository,
                        "syncFromConfidenceEngine"
                    );

                if (
                    this.shouldStop(
                        step
                    )
                ) {
                    throw new Error(
                        "Adaptive Motion Confidence Repository step failed."
                    );
                }

                step =
                    this.addStep(
                        steps,
                        this.config
                            .runStatistics,
                        "adaptiveMotionConfidenceStatistics",
                        modules
                            .statistics,
                        "analyze"
                    );

                if (
                    this.shouldStop(
                        step
                    )
                ) {
                    throw new Error(
                        "Adaptive Motion Confidence Statistics step failed."
                    );
                }

                step =
                    this.addStep(
                        steps,
                        this.config
                            .runRenderer,
                        "adaptiveMotionConfidenceRenderer",
                        modules
                            .renderer,
                        "render"
                    );

                if (
                    this.shouldStop(
                        step
                    )
                ) {
                    throw new Error(
                        "Adaptive Motion Confidence Renderer step failed."
                    );
                }

                step =
                    this.addStep(
                        steps,
                        this.config
                            .rerunCandidateScoring,
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
                        "Candidate Scoring refresh failed."
                    );
                }

                step =
                    this.addStep(
                        steps,
                        this.config
                            .rerunFinalDecision,
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
                        "Final Arrival Decision refresh failed."
                    );
                }

                this.statistics
                    .totalSteps +=
                    steps.length;

                this.statistics
                    .successfulSteps +=
                    steps.filter(
                        item =>
                            item.success ===
                                true &&
                            item.skipped !==
                                true
                    ).length;

                this.statistics
                    .failedSteps +=
                    steps.filter(
                        item =>
                            item.success ===
                                false &&
                            item.skipped !==
                                true
                    ).length;

                this.statistics
                    .skippedSteps +=
                    steps.filter(
                        item =>
                            item.skipped ===
                            true
                    ).length;

                const summary =
                    this.buildSummary(
                        steps
                    );

                let status =
                    "ADAPTIVE_MOTION_CONFIDENCE_ORCHESTRATION_COMPLETED";

                if (
                    summary
                        .failedStepCount >
                    0
                ) {
                    status =
                        "ADAPTIVE_MOTION_CONFIDENCE_ORCHESTRATION_PARTIAL";

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

                this.history.unshift(
                    cloneValue(
                        result
                    )
                );

                if (
                    this.history.length >
                    this.config
                        .maximumHistoryEntries
                ) {
                    this.history.length =
                        this.config
                            .maximumHistoryEntries;
                }

                this.publish(
                    result
                );

                if (
                    this.config
                        .debug
                ) {
                    console.log(
                        "[RainArrival AdaptiveMotionConfidenceOrchestrator] Run result:",
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
                        "ADAPTIVE_MOTION_CONFIDENCE_ORCHESTRATION_FAILED",

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

        getHistory(
            limit =
                this.config
                    .maximumHistoryEntries
        ) {
            return cloneValue(
                this.history.slice(
                    0,
                    Math.max(
                        0,
                        Number(
                            limit
                        ) ||
                        0
                    )
                )
            );
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
                console.table(
                    []
                );

                return [];
            }

            const rows =
                latest.steps
                    .map(
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

            console.table(
                rows
            );

            return rows;
        }

        printSummary() {
            const summary =
                this.latestResult
                    ?.summary ??
                null;

            if (!summary) {
                console.table(
                    []
                );

                return null;
            }

            console.table([
                {
                    confidenceRecordCount:
                        summary
                            .confidenceRecordCount,

                    averageConfidence:
                        summary
                            .averageConfidence,

                    highestConfidence:
                        summary
                            .highestConfidence,

                    acceptedRatio:
                        summary
                            .acceptedRatio,

                    strongRatio:
                        summary
                            .strongRatio,

                    veryStrongRatio:
                        summary
                            .veryStrongRatio,

                    averageEvidenceCoverage:
                        summary
                            .averageEvidenceCoverage,

                    nationalQuality:
                        summary
                            .nationalQuality,

                    cityCount:
                        summary
                            .cityCount,

                    finalDecisionStatus:
                        summary
                            .finalDecisionStatus
                }
            ]);

            return cloneValue(
                summary
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
                    this.sequence,

                availability:
                    this
                        .getAvailability(),

                latestResult:
                    this
                        .getLatestResult(),

                historyCount:
                    this.history
                        .length,

                lastError:
                    cloneValue(
                        this.lastError
                    ),

                statistics:
                    cloneValue(
                        this.statistics
                    ),

                config:
                    cloneValue(
                        this.config
                    )
            };
        }

        diagnose() {
            const diagnostics =
                this
                    .getDiagnostics();

            console.log(
                "[RainArrival AdaptiveMotionConfidenceOrchestrator]",
                diagnostics
            );

            return diagnostics;
        }

        clearHistory() {
            const removedCount =
                this.history
                    .length;

            this.history =
                [];

            return {
                success:
                    true,

                removedCount
            };
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
                global
                    .setInterval(
                        () =>
                            this
                                .run(),

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
        new AdaptiveMotionConfidenceOrchestrator();

    global
        .RainArrivalAdaptiveMotionConfidenceOrchestratorV32 =
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
        .adaptiveMotionConfidenceOrchestrator =
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

    global
        .runRainArrivalAdaptiveMotionConfidencePipeline =
        () =>
            orchestrator
                .run();

    if (
        orchestrator.config
            .autoStart
    ) {
        orchestrator.start();
    }

    console.log(
        "[RainGuard AI V32] Adaptive Motion Confidence Orchestrator loaded.",
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
