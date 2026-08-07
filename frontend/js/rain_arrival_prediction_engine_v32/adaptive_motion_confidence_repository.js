/*
===========================================================
 RainGuard AI V32
 Phase 38M-19C — Adaptive Motion Confidence Repository
 File: adaptive_motion_confidence_repository.js
 Version: 32.38M.19C

 Purpose:
 - Persist confidence evaluations produced by Phase 38M-19C.
 - Keep latest confidence by prediction, track and city.
 - Maintain bounded history for trend/statistics layers.
 - Expose clean repository APIs to renderer/orchestrator/decision engines.
===========================================================
*/

(function (global) {
    "use strict";

    const MODULE_NAME =
        "adaptiveMotionConfidenceRepository";

    const VERSION =
        "32.38M.19C";

    const BUILD_ID =
        "rainguard-v32-phase38m19c-adaptive-motion-confidence-repository";

    const DEFAULT_CONFIG =
        Object.freeze({
            autoStart: true,
            syncIntervalMs: 22000,
            maximumRecords: 5000,
            maximumHistoryPerTrack: 50,
            maximumHistoryPerCity: 100,
            keepRejected: true,
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

    function toArray(value) {
        if (!value) return [];

        if (Array.isArray(value)) {
            return value;
        }

        if (
            value instanceof Map ||
            value instanceof Set
        ) {
            return Array.from(
                value.values()
            );
        }

        if (
            typeof value.values ===
            "function"
        ) {
            try {
                return Array.from(
                    value.values()
                );
            } catch (_) {}
        }

        return (
            typeof value ===
            "object"
                ? Object.values(
                    value
                )
                : []
        );
    }

    function toNumber(
        value,
        fallback = null
    ) {
        const number =
            Number(value);

        return Number.isFinite(
            number
        )
            ? number
            : fallback;
    }

    function normalizeText(
        value,
        fallback = ""
    ) {
        const text =
            String(
                value ??
                fallback
            ).trim();

        return text ||
            String(fallback);
    }

    class AdaptiveMotionConfidenceRepository {

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

            this.syncing =
                false;

            this.timer =
                null;

            /*
             * records:
             * confidenceId -> evaluation
             */
            this.records =
                new Map();

            /*
             * latest indexes:
             * predictionId -> confidenceId
             * trackId      -> confidenceId
             * city         -> confidenceId
             */
            this.predictionIndex =
                new Map();

            this.trackIndex =
                new Map();

            this.cityIndex =
                new Map();

            /*
             * bounded historical index:
             * trackId -> confidenceId[]
             * city    -> confidenceId[]
             */
            this.trackHistoryIndex =
                new Map();

            this.cityHistoryIndex =
                new Map();

            this.latestResult =
                null;

            this.lastError =
                null;

            this.statistics = {
                syncRuns: 0,
                successfulSyncRuns: 0,
                failedSyncRuns: 0,
                busySkips: 0,
                insertedRecords: 0,
                updatedRecords: 0,
                rejectedSkipped: 0,
                prunedRecords: 0
            };
        }

        resolveConfidenceEngine() {
            return (
                global
                    .RainArrivalAdaptiveMotionConfidenceV32 ??
                global
                    .RainArrivalAdaptiveMotionConfidenceEngineV32 ??
                null
            );
        }

        normalizeEvaluation(
            input,
            index = 0
        ) {
            if (
                !input ||
                typeof input !==
                    "object"
            ) {
                return null;
            }

            const predictionId =
                normalizeText(
                    input.predictionId ??
                    input.sourcePrediction
                        ?.predictionId ??
                    input.sourcePrediction
                        ?.id,
                    `prediction-${index}`
                );

            const trackId =
                normalizeText(
                    input.trackId ??
                    input.stableId ??
                    input.sourcePrediction
                        ?.stableId ??
                    input.sourcePrediction
                        ?.trackId,
                    "UNKNOWN"
                );

            const city =
                normalizeText(
                    input.city ??
                    input.targetCity ??
                    input.sourcePrediction
                        ?.city ??
                    input.sourcePrediction
                        ?.targetCity,
                    "GLOBAL"
                );

            const generatedAt =
                toNumber(
                    input.generatedAt,
                    now()
                );

            const confidence =
                toNumber(
                    input.confidence,
                    0
                );

            const confidenceId =
                normalizeText(
                    input.confidenceId,
                    `AMC-${predictionId}-${generatedAt}`
                );

            return {
                ...cloneValue(
                    input
                ),

                confidenceId,

                predictionId,

                trackId,

                city,

                confidence,

                accepted:
                    input.accepted ===
                    true,

                grade:
                    normalizeText(
                        input.grade,
                        "F"
                    ),

                quality:
                    normalizeText(
                        input.quality,
                        "INSUFFICIENT_CONFIDENCE"
                    ),

                evidenceCoverage:
                    toNumber(
                        input.evidenceCoverage,
                        0
                    ),

                generatedAt,

                repositoryUpdatedAt:
                    now()
            };
        }

        addToBoundedIndex(
            indexMap,
            key,
            confidenceId,
            maximumLength
        ) {
            if (!key) {
                return;
            }

            if (
                !indexMap.has(
                    key
                )
            ) {
                indexMap.set(
                    key,
                    []
                );
            }

            const values =
                indexMap.get(
                    key
                );

            const existingIndex =
                values.indexOf(
                    confidenceId
                );

            if (
                existingIndex >= 0
            ) {
                values.splice(
                    existingIndex,
                    1
                );
            }

            values.unshift(
                confidenceId
            );

            if (
                values.length >
                maximumLength
            ) {
                values.length =
                    maximumLength;
            }
        }

        storeEvaluation(
            evaluation,
            index = 0
        ) {
            const normalized =
                this.normalizeEvaluation(
                    evaluation,
                    index
                );

            if (!normalized) {
                return {
                    stored: false,
                    reason:
                        "INVALID_EVALUATION"
                };
            }

            if (
                !this.config
                    .keepRejected &&
                normalized.accepted !==
                    true
            ) {
                this.statistics
                    .rejectedSkipped +=
                    1;

                return {
                    stored: false,
                    reason:
                        "REJECTED_SKIPPED",
                    evaluation:
                        normalized
                };
            }

            const exists =
                this.records.has(
                    normalized
                        .confidenceId
                );

            this.records.set(
                normalized
                    .confidenceId,
                normalized
            );

            this.predictionIndex.set(
                normalized
                    .predictionId,
                normalized
                    .confidenceId
            );

            this.trackIndex.set(
                normalized
                    .trackId,
                normalized
                    .confidenceId
            );

            this.cityIndex.set(
                normalized
                    .city
                    .toLowerCase(),
                normalized
                    .confidenceId
            );

            this.addToBoundedIndex(
                this.trackHistoryIndex,
                normalized.trackId,
                normalized.confidenceId,
                this.config
                    .maximumHistoryPerTrack
            );

            this.addToBoundedIndex(
                this.cityHistoryIndex,
                normalized.city
                    .toLowerCase(),
                normalized.confidenceId,
                this.config
                    .maximumHistoryPerCity
            );

            if (exists) {
                this.statistics
                    .updatedRecords +=
                    1;
            } else {
                this.statistics
                    .insertedRecords +=
                    1;
            }

            return {
                stored: true,
                updated: exists,
                evaluation:
                    cloneValue(
                        normalized
                    )
            };
        }

        prune() {
            if (
                this.records.size <=
                this.config
                    .maximumRecords
            ) {
                return 0;
            }

            const sorted =
                Array.from(
                    this.records.values()
                )
                .sort(
                    (a, b) =>
                        Number(
                            b.generatedAt ??
                            0
                        ) -
                        Number(
                            a.generatedAt ??
                            0
                        )
                );

            const keep =
                sorted.slice(
                    0,
                    this.config
                        .maximumRecords
                );

            const removed =
                this.records.size -
                keep.length;

            this.records.clear();

            for (
                const item of keep
            ) {
                this.records.set(
                    item.confidenceId,
                    item
                );
            }

            this.rebuildIndexes();

            this.statistics
                .prunedRecords +=
                removed;

            return removed;
        }

        rebuildIndexes() {
            this.predictionIndex
                .clear();

            this.trackIndex
                .clear();

            this.cityIndex
                .clear();

            this.trackHistoryIndex
                .clear();

            this.cityHistoryIndex
                .clear();

            const ordered =
                Array.from(
                    this.records.values()
                )
                .sort(
                    (a, b) =>
                        Number(
                            a.generatedAt ??
                            0
                        ) -
                        Number(
                            b.generatedAt ??
                            0
                        )
                );

            for (
                const item of ordered
            ) {
                this.predictionIndex.set(
                    item.predictionId,
                    item.confidenceId
                );

                this.trackIndex.set(
                    item.trackId,
                    item.confidenceId
                );

                this.cityIndex.set(
                    item.city
                        .toLowerCase(),
                    item.confidenceId
                );

                this.addToBoundedIndex(
                    this.trackHistoryIndex,
                    item.trackId,
                    item.confidenceId,
                    this.config
                        .maximumHistoryPerTrack
                );

                this.addToBoundedIndex(
                    this.cityHistoryIndex,
                    item.city
                        .toLowerCase(),
                    item.confidenceId,
                    this.config
                        .maximumHistoryPerCity
                );
            }
        }

        syncFromConfidenceEngine() {
            if (
                this.syncing
            ) {
                this.statistics
                    .busySkips +=
                    1;

                return {
                    success: false,

                    status:
                        "ADAPTIVE_MOTION_CONFIDENCE_REPOSITORY_BUSY",

                    version:
                        this.version,

                    build:
                        this.buildId
                };
            }

            const startedAt =
                now();

            this.syncing =
                true;

            this.statistics
                .syncRuns +=
                1;

            try {
                const engine =
                    this.resolveConfidenceEngine();

                if (!engine) {
                    throw new Error(
                        "Adaptive Motion Confidence Engine is unavailable."
                    );
                }

                let engineResult =
                    engine
                        .getLatestResult?.() ??
                    null;

                if (
                    !engineResult
                ) {
                    engineResult =
                        engine
                            .evaluateAll?.() ??
                        null;
                }

                let evaluations =
                    toArray(
                        engine
                            .getAll?.()
                    );

                if (
                    !evaluations.length
                ) {
                    evaluations =
                        toArray(
                            engineResult
                                ?.ranking
                        );
                }

                let storedCount =
                    0;

                let updatedCount =
                    0;

                let skippedCount =
                    0;

                evaluations.forEach(
                    (
                        evaluation,
                        index
                    ) => {
                        const stored =
                            this
                                .storeEvaluation(
                                    evaluation,
                                    index
                                );

                        if (
                            stored.stored
                        ) {
                            if (
                                stored.updated
                            ) {
                                updatedCount +=
                                    1;
                            } else {
                                storedCount +=
                                    1;
                            }
                        } else {
                            skippedCount +=
                                1;
                        }
                    }
                );

                const prunedCount =
                    this.prune();

                const result = {
                    success:
                        true,

                    status:
                        "ADAPTIVE_MOTION_CONFIDENCE_REPOSITORY_SYNCED",

                    version:
                        this.version,

                    build:
                        this.buildId,

                    engineStatus:
                        engineResult
                            ?.status ??
                        null,

                    inputCount:
                        evaluations
                            .length,

                    storedCount,

                    updatedCount,

                    skippedCount,

                    prunedCount,

                    repositoryCount:
                        this.records
                            .size,

                    predictionIndexCount:
                        this.predictionIndex
                            .size,

                    trackIndexCount:
                        this.trackIndex
                            .size,

                    cityIndexCount:
                        this.cityIndex
                            .size,

                    acceptedCount:
                        this
                            .getAccepted()
                            .length,

                    rejectedCount:
                        this
                            .getRejected()
                            .length,

                    topConfidence:
                        this
                            .getTopConfidence(),

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

                this.statistics
                    .successfulSyncRuns +=
                    1;

                this.publish(
                    result
                );

                if (
                    this.config.debug
                ) {
                    console.log(
                        "[RainArrival AdaptiveMotionConfidenceRepository] Sync result:",
                        result
                    );
                }

                return result;

            } catch (error) {
                this.statistics
                    .failedSyncRuns +=
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
                        "ADAPTIVE_MOTION_CONFIDENCE_REPOSITORY_SYNC_FAILED",

                    version:
                        this.version,

                    build:
                        this.buildId,

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

                return result;

            } finally {
                this.syncing =
                    false;
            }
        }

        publish(result) {
            global
                .RainArrivalAdaptiveMotionConfidenceRepositoryResult =
                cloneValue(
                    result
                );

            global
                .RainArrivalAdaptiveMotionConfidenceRepositoryRecords =
                this.getAll();

            global.RainGuardAI =
                global.RainGuardAI ||
                {};

            global.RainGuardAI.V32 =
                global.RainGuardAI.V32 ||
                {};

            global.RainGuardAI.V32
                .adaptiveMotionConfidenceRepository = {
                    result:
                        cloneValue(
                            result
                        ),

                    records:
                        this.getAll()
                };

            global.dispatchEvent?.(
                new CustomEvent(
                    "rainarrival:adaptive-motion-confidence-repository-updated",
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

        getByConfidenceId(
            confidenceId
        ) {
            return cloneValue(
                this.records.get(
                    String(
                        confidenceId
                    )
                ) ??
                null
            );
        }

        getByPredictionId(
            predictionId
        ) {
            const confidenceId =
                this.predictionIndex.get(
                    String(
                        predictionId
                    )
                );

            return (
                confidenceId
                    ? this
                        .getByConfidenceId(
                            confidenceId
                        )
                    : null
            );
        }

        getByTrackId(
            trackId
        ) {
            const confidenceId =
                this.trackIndex.get(
                    String(
                        trackId
                    )
                );

            return (
                confidenceId
                    ? this
                        .getByConfidenceId(
                            confidenceId
                        )
                    : null
            );
        }

        getByCity(
            city
        ) {
            const confidenceId =
                this.cityIndex.get(
                    String(
                        city ??
                        "GLOBAL"
                    )
                    .toLowerCase()
                );

            return (
                confidenceId
                    ? this
                        .getByConfidenceId(
                            confidenceId
                        )
                    : null
            );
        }

        getTrackHistory(
            trackId,
            limit =
                this.config
                    .maximumHistoryPerTrack
        ) {
            const ids =
                this.trackHistoryIndex.get(
                    String(
                        trackId
                    )
                ) ||
                [];

            return cloneValue(
                ids.slice(
                    0,
                    Math.max(
                        0,
                        Number(
                            limit
                        ) ||
                        0
                    )
                )
                .map(
                    id =>
                        this.records.get(
                            id
                        )
                )
                .filter(Boolean)
            );
        }

        getCityHistory(
            city,
            limit =
                this.config
                    .maximumHistoryPerCity
        ) {
            const key =
                String(
                    city ??
                    "GLOBAL"
                )
                .toLowerCase();

            const ids =
                this.cityHistoryIndex.get(
                    key
                ) ||
                [];

            return cloneValue(
                ids.slice(
                    0,
                    Math.max(
                        0,
                        Number(
                            limit
                        ) ||
                        0
                    )
                )
                .map(
                    id =>
                        this.records.get(
                            id
                        )
                )
                .filter(Boolean)
            );
        }

        getAll() {
            return cloneValue(
                Array.from(
                    this.records.values()
                )
                .sort(
                    (a, b) =>
                        Number(
                            b.generatedAt ??
                            0
                        ) -
                        Number(
                            a.generatedAt ??
                            0
                        )
                )
            );
        }

        getAccepted() {
            return this
                .getAll()
                .filter(
                    item =>
                        item.accepted ===
                        true
                );
        }

        getRejected() {
            return this
                .getAll()
                .filter(
                    item =>
                        item.accepted !==
                        true
                );
        }

        getTopConfidence() {
            return cloneValue(
                this
                    .getAll()
                    .sort(
                        (a, b) =>
                            Number(
                                b.confidence ??
                                0
                            ) -
                            Number(
                                a.confidence ??
                                0
                            )
                    )[0] ??
                null
            );
        }

        getLatestResult() {
            return cloneValue(
                this.latestResult
            );
        }

        getCount() {
            return this.records
                .size;
        }

        printTable(
            limit = 20
        ) {
            const rows =
                this.getAll()
                    .slice(
                        0,
                        Math.max(
                            0,
                            Number(
                                limit
                            ) ||
                            0
                        )
                    );

            console.table(
                rows.map(
                    item => ({
                        confidenceId:
                            item.confidenceId,

                        predictionId:
                            item.predictionId,

                        trackId:
                            item.trackId,

                        city:
                            item.city,

                        confidence:
                            item.confidence,

                        grade:
                            item.grade,

                        quality:
                            item.quality,

                        accepted:
                            item.accepted,

                        evidenceCoverage:
                            item.evidenceCoverage
                    })
                )
            );

            return rows;
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

                syncing:
                    this.syncing,

                recordCount:
                    this.records
                        .size,

                predictionIndexCount:
                    this.predictionIndex
                        .size,

                trackIndexCount:
                    this.trackIndex
                        .size,

                cityIndexCount:
                    this.cityIndex
                        .size,

                trackHistoryCount:
                    this.trackHistoryIndex
                        .size,

                cityHistoryCount:
                    this.cityHistoryIndex
                        .size,

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
                    ),

                config:
                    cloneValue(
                        this.config
                    )
            };
        }

        diagnose() {
            const diagnostics =
                this.getDiagnostics();

            console.log(
                "[RainArrival AdaptiveMotionConfidenceRepository]",
                diagnostics
            );

            return diagnostics;
        }

        clear() {
            const removedCount =
                this.records
                    .size;

            this.records
                .clear();

            this.predictionIndex
                .clear();

            this.trackIndex
                .clear();

            this.cityIndex
                .clear();

            this.trackHistoryIndex
                .clear();

            this.cityHistoryIndex
                .clear();

            this.latestResult =
                null;

            this.lastError =
                null;

            return {
                success:
                    true,

                status:
                    "ADAPTIVE_MOTION_CONFIDENCE_REPOSITORY_CLEARED",

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

            this.syncFromConfidenceEngine();

            this.timer =
                global.setInterval(
                    () =>
                        this
                            .syncFromConfidenceEngine(),

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

    const repository =
        new AdaptiveMotionConfidenceRepository();

    global
        .RainArrivalAdaptiveMotionConfidenceRepositoryV32 =
        repository;

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
        .adaptiveMotionConfidenceRepository =
        repository;

    global.RainArrivalEngineV32
        ?.register?.(
            MODULE_NAME,
            repository
        );

    global.RainArrivalOrchestratorV32
        ?.register?.(
            MODULE_NAME,
            repository
        );

    global
        .syncRainArrivalAdaptiveMotionConfidenceRepository =
        () =>
            repository
                .syncFromConfidenceEngine();

    if (
        repository.config
            .autoStart
    ) {
        repository.start();
    }

    console.log(
        "[RainGuard AI V32] Adaptive Motion Confidence Repository loaded.",
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
