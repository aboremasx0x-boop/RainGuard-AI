/* ==========================================================================
   RainGuard AI
   Long Horizon Forecast Engine V32

   Recovery Closure Engine V32

   PART 1
   Foundation + State Closure + Cycle Finalization
   ========================================================================== */

(function initializeRainArrivalRecoveryClosureV32(global) {
    "use strict";

    /* ======================================================================
       SECTION 1
       DEPENDENCY RESOLUTION
       ====================================================================== */

    const CoreClass =
        global.RainArrivalRecoveryCoreV32;

    const CoreUtils =
        global.RainArrivalRecoveryCoreV32Utils;

    const CoreConstants =
        global.RainArrivalRecoveryCoreV32Constants;

    const CorePart10 =
        global.RainArrivalRecoveryCoreV32Part10;

    if (
        typeof CoreClass !== "function" ||
        !CoreUtils ||
        !CoreConstants
    ) {
        throw new Error(
            "RainArrivalRecoveryCoreV32 Parts 1 to 10 must be loaded before recovery_closure_v32.js."
        );
    }

    const {
        toFiniteNumber,
        clamp,
        normalizePercentage,
        normalizeTimestamp,
        safeArray,
        safeObject,
        deepClone
    } = CoreUtils;

    const {
        RAIN_STATUS,
        CELL_STATUS,
        CORE_EVENTS
    } = CoreConstants;

    /* ======================================================================
       SECTION 2
       CLOSURE CONSTANTS
       ====================================================================== */

    const RECOVERY_CLOSURE_VERSION =
        "32.1.0";

    const DEFAULT_CLOSURE_TIMEOUT_MS =
        30 * 1000;

    const DEFAULT_STALE_PREDICTION_AGE_MS =
        90 * 60 * 1000;

    const DEFAULT_STALE_CELL_AGE_MS =
        45 * 60 * 1000;

    const DEFAULT_STALE_OBSERVATION_AGE_MS =
        6 * 60 * 60 * 1000;

    const DEFAULT_STALE_FORECAST_AGE_MS =
        96 * 60 * 60 * 1000;

    const DEFAULT_MAX_CLOSURE_HISTORY =
        100;

    const DEFAULT_MAX_ARCHIVED_PREDICTIONS =
        1000;

    const DEFAULT_MAX_ARCHIVED_CELLS =
        500;

    const DEFAULT_MIN_FINAL_CONFIDENCE =
        0.15;

    const DEFAULT_MIN_FINAL_QUALITY =
        0.18;

    const DEFAULT_MAX_ETA_HOURS =
        72;

    const DEFAULT_FINAL_OUTPUT_LIMIT =
        1000;

    const CLOSURE_STATUS =
        Object.freeze({
            IDLE:
                "idle",

            PREPARING:
                "preparing",

            VALIDATING:
                "validating",

            CLEANING:
                "cleaning",

            CONSOLIDATING:
                "consolidating",

            ARCHIVING:
                "archiving",

            PUBLISHING:
                "publishing",

            COMPLETED:
                "completed",

            PARTIAL:
                "partial",

            FAILED:
                "failed",

            ABORTED:
                "aborted"
        });

    const CLOSURE_REASON =
        Object.freeze({
            NORMAL_CYCLE:
                "normal_cycle",

            MANUAL:
                "manual",

            ENGINE_STOP:
                "engine_stop",

            ENGINE_RESTART:
                "engine_restart",

            RECOVERY:
                "recovery",

            MAINTENANCE:
                "maintenance",

            SOURCE_FAILURE:
                "source_failure",

            TIMEOUT:
                "timeout",

            DESTROY:
                "destroy"
        });

    const PREDICTION_FINAL_STATE =
        Object.freeze({
            RAINING_NOW:
                "raining_now",

            ACTIVE:
                "active",

            POSSIBLE:
                "possible",

            EXPIRED:
                "expired",

            REJECTED:
                "rejected",

            CLOSED:
                "closed",

            UNKNOWN:
                "unknown"
        });

    const CELL_FINAL_STATE =
        Object.freeze({
            ACTIVE:
                "active",

            LOST:
                "lost",

            DISSIPATED:
                "dissipated",

            EXPIRED:
                "expired",

            ARCHIVED:
                "archived",

            UNKNOWN:
                "unknown"
        });

    /* ======================================================================
       SECTION 3
       BASIC CLOSURE HELPERS
       ====================================================================== */

    function createClosureId() {
        return (
            "recovery_closure_" +
            Date.now() +
            "_" +
            Math.random()
                .toString(36)
                .slice(2, 10)
        );
    }

    function createClosureError(
        message,
        code =
            "RECOVERY_CLOSURE_ERROR"
    ) {
        const error =
            new Error(message);

        error.code =
            code;

        error.timestamp =
            Date.now();

        return error;
    }

    function normalizeClosureError(error) {
        return {
            name:
                error?.name ||
                "Error",

            code:
                error?.code ||
                null,

            message:
                error?.message ||
                String(
                    error ||
                    "Unknown closure error"
                ),

            stack:
                error?.stack ||
                null,

            timestamp:
                Date.now()
        };
    }

    function isFiniteTimestamp(value) {
        return Number.isFinite(
            Number(value)
        );
    }

    function calculateAgeMs(
        timestamp,
        currentTimestamp =
            Date.now()
    ) {
        if (
            !isFiniteTimestamp(
                timestamp
            )
        ) {
            return Infinity;
        }

        return Math.max(
            0,
            currentTimestamp -
            normalizeTimestamp(
                timestamp
            )
        );
    }

    function normalizeClosureReason(
        reason
    ) {
        const values =
            Object.values(
                CLOSURE_REASON
            );

        return values.includes(
            reason
        )
            ? reason
            : CLOSURE_REASON
                .NORMAL_CYCLE;
    }

    function normalizeClosureStatus(
        status
    ) {
        const values =
            Object.values(
                CLOSURE_STATUS
            );

        return values.includes(
            status
        )
            ? status
            : CLOSURE_STATUS.IDLE;
    }

    function getPredictionEtaHours(
        prediction
    ) {
        if (
            Number.isFinite(
                Number(
                    prediction?.etaHours
                )
            )
        ) {
            return Number(
                prediction.etaHours
            );
        }

        if (
            Number.isFinite(
                Number(
                    prediction?.etaMinutes
                )
            )
        ) {
            return (
                Number(
                    prediction.etaMinutes
                ) /
                60
            );
        }

        if (
            Number.isFinite(
                Number(
                    prediction
                        ?.arrivalTimestamp
                )
            )
        ) {
            return (
                Number(
                    prediction
                        .arrivalTimestamp
                ) -
                Date.now()
            ) /
            (
                60 *
                60 *
                1000
            );
        }

        return null;
    }

    function getPredictionQualityScore(
        prediction
    ) {
        return clamp(
            toFiniteNumber(
                prediction
                    ?.quality
                    ?.score,
                prediction
                    ?.confidence ||
                0
            ),
            0,
            1
        );
    }

    function getPredictionConfidence(
        prediction
    ) {
        return normalizePercentage(
            prediction?.confidence
        );
    }

    function getCellTimestamp(
        cell
    ) {
        return normalizeTimestamp(
            cell?.updatedAt ||
            cell?.timestamp ||
            cell?.lastSeenAt ||
            cell?.createdAt ||
            0
        );
    }

    function getPredictionTimestamp(
        prediction
    ) {
        return normalizeTimestamp(
            prediction?.updatedAt ||
            prediction?.generatedAt ||
            prediction?.arrivalTimestamp ||
            0
        );
    }

    /* ======================================================================
       SECTION 4
       FINAL STATE CLASSIFIERS
       ====================================================================== */

    function classifyPredictionFinalState(
        prediction,
        options = {}
    ) {
        if (!prediction) {
            return PREDICTION_FINAL_STATE.UNKNOWN;
        }

        const maximumEtaHours =
            Math.max(
                1,
                toFiniteNumber(
                    options.maximumEtaHours,
                    DEFAULT_MAX_ETA_HOURS
                )
            );

        const staleAgeMs =
            Math.max(
                60 * 1000,
                toFiniteNumber(
                    options.stalePredictionAgeMs,
                    DEFAULT_STALE_PREDICTION_AGE_MS
                )
            );

        if (
            prediction.rainingNow ===
            true ||
            prediction.status ===
            RAIN_STATUS.RAINING_NOW
        ) {
            return PREDICTION_FINAL_STATE
                .RAINING_NOW;
        }

        if (
            prediction
                ?.quality
                ?.status ===
            "rejected"
        ) {
            return PREDICTION_FINAL_STATE
                .REJECTED;
        }

        const etaHours =
            getPredictionEtaHours(
                prediction
            );

        const predictionAgeMs =
            calculateAgeMs(
                getPredictionTimestamp(
                    prediction
                )
            );

        if (
            predictionAgeMs >
            staleAgeMs
        ) {
            return PREDICTION_FINAL_STATE
                .EXPIRED;
        }

        if (
            Number.isFinite(
                etaHours
            ) &&
            (
                etaHours < 0 ||
                etaHours >
                maximumEtaHours
            )
        ) {
            return PREDICTION_FINAL_STATE
                .EXPIRED;
        }

        if (
            prediction.status ===
            RAIN_STATUS.POSSIBLE
        ) {
            return PREDICTION_FINAL_STATE
                .POSSIBLE;
        }

        if (
            prediction.status ===
            RAIN_STATUS.ARRIVING ||
            Number.isFinite(
                etaHours
            )
        ) {
            return PREDICTION_FINAL_STATE
                .ACTIVE;
        }

        if (
            prediction.status ===
            RAIN_STATUS.NO_RAIN
        ) {
            return PREDICTION_FINAL_STATE
                .CLOSED;
        }

        return PREDICTION_FINAL_STATE
            .UNKNOWN;
    }

    function classifyCellFinalState(
        cell,
        options = {}
    ) {
        if (!cell) {
            return CELL_FINAL_STATE.UNKNOWN;
        }

        const staleAgeMs =
            Math.max(
                60 * 1000,
                toFiniteNumber(
                    options.staleCellAgeMs,
                    DEFAULT_STALE_CELL_AGE_MS
                )
            );

        if (
            cell.status ===
            CELL_STATUS.LOST
        ) {
            return CELL_FINAL_STATE.LOST;
        }

        if (
            cell.status ===
            CELL_STATUS.DISSIPATED
        ) {
            return CELL_FINAL_STATE
                .DISSIPATED;
        }

        if (
            cell.status ===
            "archived"
        ) {
            return CELL_FINAL_STATE
                .ARCHIVED;
        }

        const ageMs =
            calculateAgeMs(
                getCellTimestamp(
                    cell
                )
            );

        if (
            ageMs >
            staleAgeMs
        ) {
            return CELL_FINAL_STATE
                .EXPIRED;
        }

        if (
            cell.active === false
        ) {
            return CELL_FINAL_STATE
                .LOST;
        }

        return CELL_FINAL_STATE.ACTIVE;
    }

    /* ======================================================================
       SECTION 5
       CLOSURE RECORD CREATION
       ====================================================================== */

    function createClosureRecord(
        reason =
            CLOSURE_REASON.NORMAL_CYCLE,
        metadata = {}
    ) {
        const closureId =
            createClosureId();

        return {
            id:
                closureId,

            version:
                RECOVERY_CLOSURE_VERSION,

            reason:
                normalizeClosureReason(
                    reason
                ),

            status:
                CLOSURE_STATUS.PREPARING,

            createdAt:
                Date.now(),

            startedAt:
                null,

            completedAt:
                null,

            durationMs:
                0,

            currentStage:
                "preparing",

            stageHistory: [],

            errors: [],

            warnings: [],

            metadata:
                deepClone(
                    safeObject(metadata)
                ),

            input: {
                observationCount:
                    0,

                forecastCount:
                    0,

                rainCellCount:
                    0,

                trackedCellCount:
                    0,

                predictionCount:
                    0,

                regionCount:
                    0,

                governorateCount:
                    0
            },

            output: {
                activePredictionCount:
                    0,

                rainingNowCount:
                    0,

                possiblePredictionCount:
                    0,

                expiredPredictionCount:
                    0,

                rejectedPredictionCount:
                    0,

                closedPredictionCount:
                    0,

                activeCellCount:
                    0,

                lostCellCount:
                    0,

                dissipatedCellCount:
                    0,

                expiredCellCount:
                    0,

                archivedPredictionCount:
                    0,

                archivedCellCount:
                    0
            },

            data: {
                activePredictions: [],

                rainingNowPredictions: [],

                possiblePredictions: [],

                expiredPredictions: [],

                rejectedPredictions: [],

                closedPredictions: [],

                activeCells: [],

                lostCells: [],

                dissipatedCells: [],

                expiredCells: [],

                archivedPredictions: [],

                archivedCells: []
            },

            finalPayload:
                null
        };
    }

    /* ======================================================================
       SECTION 6
       CLOSURE ENGINE CLASS
       ====================================================================== */

    class RainArrivalRecoveryClosureV32 {
        constructor(
            core,
            options = {}
        ) {
            if (
                !(core instanceof CoreClass)
            ) {
                throw new TypeError(
                    "RainArrivalRecoveryClosureV32 requires a RainArrivalRecoveryCoreV32 instance."
                );
            }

            this.core =
                core;

            this.version =
                RECOVERY_CLOSURE_VERSION;

            this.options =
                this.normalizeOptions(
                    options
                );

            this.state = {
                status:
                    CLOSURE_STATUS.IDLE,

                activeClosure:
                    null,

                lastClosure:
                    null,

                closureHistory: [],

                archivedPredictions: [],

                archivedCells: [],

                totalClosures:
                    0,

                successfulClosures:
                    0,

                partialClosures:
                    0,

                failedClosures:
                    0,

                lastError:
                    null,

                lastClosureAt:
                    null
            };

            this.destroyed =
                false;

            this.abortController =
                null;

            this.attachToCore();
        }

        /* ==================================================================
           SECTION 7
           OPTION NORMALIZATION
           ================================================================== */

        normalizeOptions(
            options = {}
        ) {
            const safeOptions =
                safeObject(options);

            return {
                closureTimeoutMs:
                    Math.max(
                        5000,
                        toFiniteNumber(
                            safeOptions.closureTimeoutMs,
                            DEFAULT_CLOSURE_TIMEOUT_MS
                        )
                    ),

                stalePredictionAgeMs:
                    Math.max(
                        5 * 60 * 1000,
                        toFiniteNumber(
                            safeOptions.stalePredictionAgeMs,
                            DEFAULT_STALE_PREDICTION_AGE_MS
                        )
                    ),

                staleCellAgeMs:
                    Math.max(
                        5 * 60 * 1000,
                        toFiniteNumber(
                            safeOptions.staleCellAgeMs,
                            DEFAULT_STALE_CELL_AGE_MS
                        )
                    ),

                staleObservationAgeMs:
                    Math.max(
                        30 * 60 * 1000,
                        toFiniteNumber(
                            safeOptions.staleObservationAgeMs,
                            DEFAULT_STALE_OBSERVATION_AGE_MS
                        )
                    ),

                staleForecastAgeMs:
                    Math.max(
                        6 * 60 * 60 * 1000,
                        toFiniteNumber(
                            safeOptions.staleForecastAgeMs,
                            DEFAULT_STALE_FORECAST_AGE_MS
                        )
                    ),

                maximumClosureHistory:
                    clamp(
                        Math.round(
                            toFiniteNumber(
                                safeOptions.maximumClosureHistory,
                                DEFAULT_MAX_CLOSURE_HISTORY
                            )
                        ),
                        1,
                        1000
                    ),

                maximumArchivedPredictions:
                    clamp(
                        Math.round(
                            toFiniteNumber(
                                safeOptions.maximumArchivedPredictions,
                                DEFAULT_MAX_ARCHIVED_PREDICTIONS
                            )
                        ),
                        10,
                        10000
                    ),

                maximumArchivedCells:
                    clamp(
                        Math.round(
                            toFiniteNumber(
                                safeOptions.maximumArchivedCells,
                                DEFAULT_MAX_ARCHIVED_CELLS
                            )
                        ),
                        10,
                        5000
                    ),

                minimumFinalConfidence:
                    clamp(
                        toFiniteNumber(
                            safeOptions.minimumFinalConfidence,
                            DEFAULT_MIN_FINAL_CONFIDENCE
                        ),
                        0,
                        1
                    ),

                minimumFinalQuality:
                    clamp(
                        toFiniteNumber(
                            safeOptions.minimumFinalQuality,
                            DEFAULT_MIN_FINAL_QUALITY
                        ),
                        0,
                        1
                    ),

                maximumEtaHours:
                    clamp(
                        toFiniteNumber(
                            safeOptions.maximumEtaHours,
                            DEFAULT_MAX_ETA_HOURS
                        ),
                        1,
                        168
                    ),

                finalOutputLimit:
                    clamp(
                        Math.round(
                            toFiniteNumber(
                                safeOptions.finalOutputLimit,
                                DEFAULT_FINAL_OUTPUT_LIMIT
                            )
                        ),
                        1,
                        10000
                    ),

                preserveRejectedPredictions:
                    safeOptions
                        .preserveRejectedPredictions ===
                    true,

                preserveExpiredPredictions:
                    safeOptions
                        .preserveExpiredPredictions !==
                    false,

                preserveExpiredCells:
                    safeOptions
                        .preserveExpiredCells !==
                    false,

                rebuildFrontendPayload:
                    safeOptions
                        .rebuildFrontendPayload !==
                    false,

                publishFinalPayload:
                    safeOptions
                        .publishFinalPayload !==
                    false
            };
        }

        /* ==================================================================
           SECTION 8
           CORE ATTACHMENT
           ================================================================== */

        attachToCore() {
            this.core.recoveryClosure =
                this;

            this.core.recoveryClosureV32 =
                this;

            if (
                !this.core.state
                    .closure
            ) {
                this.core.state.closure = {
                    status:
                        CLOSURE_STATUS.IDLE,

                    lastClosureId:
                        null,

                    lastClosureAt:
                        null,

                    lastClosureSummary:
                        null
                };
            }

            return this;
        }

        /* ==================================================================
           SECTION 9
           STATUS MANAGEMENT
           ================================================================== */

        setStatus(
            status,
            metadata = {}
        ) {
            const normalizedStatus =
                normalizeClosureStatus(
                    status
                );

            const previousStatus =
                this.state.status;

            this.state.status =
                normalizedStatus;

            if (
                this.core.state.closure
            ) {
                this.core.state
                    .closure
                    .status =
                    normalizedStatus;

                this.core.state
                    .closure
                    .statusUpdatedAt =
                    Date.now();
            }

            if (
                typeof this.core.emit ===
                "function"
            ) {
                this.core.emit(
                    CORE_EVENTS
                        .CLOSURE_STATUS_CHANGED ||
                    "closure_status_changed",
                    {
                        previousStatus,

                        status:
                            normalizedStatus,

                        metadata:
                            deepClone(
                                safeObject(metadata)
                            ),

                        timestamp:
                            Date.now()
                    }
                );
            }

            return normalizedStatus;
        }

        /* ==================================================================
           SECTION 10
           CLOSURE STAGE MANAGEMENT
           ================================================================== */

        updateStage(
            stage,
            metadata = {}
        ) {
            const closure =
                this.state
                    .activeClosure;

            if (!closure) {
                return null;
            }

            closure.currentStage =
                stage;

            closure.stageHistory.push({
                stage,

                timestamp:
                    Date.now(),

                metadata:
                    deepClone(
                        safeObject(metadata)
                    )
            });

            if (
                typeof this.core.emit ===
                "function"
            ) {
                this.core.emit(
                    CORE_EVENTS
                        .CLOSURE_PROGRESS ||
                    "closure_progress",
                    {
                        closureId:
                            closure.id,

                        stage,

                        metadata:
                            deepClone(
                                safeObject(metadata)
                            ),

                        timestamp:
                            Date.now()
                    }
                );
            }

            return closure;
        }

        /* ==================================================================
           SECTION 11
           PREPARE CLOSURE
           ================================================================== */

        prepareClosure(
            reason =
                CLOSURE_REASON.NORMAL_CYCLE,
            metadata = {}
        ) {
            if (this.destroyed) {
                throw createClosureError(
                    "Recovery closure engine has been destroyed.",
                    "CLOSURE_ENGINE_DESTROYED"
                );
            }

            if (
                this.state.activeClosure
            ) {
                throw createClosureError(
                    "A recovery closure operation is already active.",
                    "CLOSURE_ALREADY_RUNNING"
                );
            }

            const closure =
                createClosureRecord(
                    reason,
                    metadata
                );

            closure.startedAt =
                Date.now();

            closure.status =
                CLOSURE_STATUS.PREPARING;

            this.state.activeClosure =
                closure;

            this.setStatus(
                CLOSURE_STATUS.PREPARING,
                {
                    closureId:
                        closure.id,

                    reason:
                        closure.reason
                }
            );

            this.updateStage(
                "preparing",
                {
                    reason:
                        closure.reason
                }
            );

            this.captureInputCounts(
                closure
            );

            return closure;
        }

        /* ==================================================================
           SECTION 12
           CAPTURE INPUT COUNTS
           ================================================================== */

        captureInputCounts(
            closure =
                this.state
                    .activeClosure
        ) {
            if (!closure) {
                return null;
            }

            closure.input = {
                observationCount:
                    safeArray(
                        this.core.state
                            .observations
                    ).length,

                forecastCount:
                    safeArray(
                        this.core.state
                            .forecasts
                    ).length,

                rainCellCount:
                    safeArray(
                        this.core.state
                            .rainCells
                    ).length,

                trackedCellCount:
                    this.core.cells
                        ?.size ||
                    0,

                predictionCount:
                    safeArray(
                        this.core.state
                            .arrivalPredictions
                    ).length,

                regionCount:
                    safeArray(
                        this.core.state
                            .regionSummaries
                    ).length,

                governorateCount:
                    safeArray(
                        this.core.state
                            .governorateSummaries
                    ).length
            };

            return closure.input;
        }

        /* ==================================================================
           SECTION 13
           CLASSIFY ALL PREDICTIONS
           ================================================================== */

        classifyPredictions(
            predictions =
                this.core.state
                    .arrivalPredictions
        ) {
            const classified = {
                active: [],

                rainingNow: [],

                possible: [],

                expired: [],

                rejected: [],

                closed: [],

                unknown: []
            };

            safeArray(
                predictions
            )
                .forEach(
                    (prediction) => {
                        const finalState =
                            classifyPredictionFinalState(
                                prediction,
                                this.options
                            );

                        const result = {
                            ...deepClone(
                                prediction
                            ),

                            finalState,

                            closureClassifiedAt:
                                Date.now()
                        };

                        switch (
                            finalState
                        ) {
                            case PREDICTION_FINAL_STATE
                                .RAINING_NOW:
                                classified
                                    .rainingNow
                                    .push(result);
                                break;

                            case PREDICTION_FINAL_STATE
                                .ACTIVE:
                                classified
                                    .active
                                    .push(result);
                                break;

                            case PREDICTION_FINAL_STATE
                                .POSSIBLE:
                                classified
                                    .possible
                                    .push(result);
                                break;

                            case PREDICTION_FINAL_STATE
                                .EXPIRED:
                                classified
                                    .expired
                                    .push(result);
                                break;

                            case PREDICTION_FINAL_STATE
                                .REJECTED:
                                classified
                                    .rejected
                                    .push(result);
                                break;

                            case PREDICTION_FINAL_STATE
                                .CLOSED:
                                classified
                                    .closed
                                    .push(result);
                                break;

                            default:
                                classified
                                    .unknown
                                    .push(result);
                        }
                    }
                );

            return classified;
        }

        /* ==================================================================
           SECTION 14
           CLASSIFY ALL CELLS
           ================================================================== */

        classifyCells(
            cells =
                Array.from(
                    this.core.cells
                        ?.values?.() ||
                    []
                )
        ) {
            const classified = {
                active: [],

                lost: [],

                dissipated: [],

                expired: [],

                archived: [],

                unknown: []
            };

            safeArray(cells)
                .forEach(
                    (cell) => {
                        const finalState =
                            classifyCellFinalState(
                                cell,
                                this.options
                            );

                        const result = {
                            ...deepClone(
                                cell
                            ),

                            finalState,

                            closureClassifiedAt:
                                Date.now()
                        };

                        switch (
                            finalState
                        ) {
                            case CELL_FINAL_STATE
                                .ACTIVE:
                                classified
                                    .active
                                    .push(result);
                                break;

                            case CELL_FINAL_STATE
                                .LOST:
                                classified
                                    .lost
                                    .push(result);
                                break;

                            case CELL_FINAL_STATE
                                .DISSIPATED:
                                classified
                                    .dissipated
                                    .push(result);
                                break;

                            case CELL_FINAL_STATE
                                .EXPIRED:
                                classified
                                    .expired
                                    .push(result);
                                break;

                            case CELL_FINAL_STATE
                                .ARCHIVED:
                                classified
                                    .archived
                                    .push(result);
                                break;

                            default:
                                classified
                                    .unknown
                                    .push(result);
                        }
                    }
                );

            return classified;
        }

        /* ==================================================================
           SECTION 15
           FILTER FINAL PREDICTIONS
           ================================================================== */

        filterFinalPredictions(
            predictions
        ) {
            return safeArray(
                predictions
            )
                .filter(
                    (prediction) => {
                        const confidence =
                            getPredictionConfidence(
                                prediction
                            );

                        const qualityScore =
                            getPredictionQualityScore(
                                prediction
                            );

                        if (
                            prediction.rainingNow ===
                            true
                        ) {
                            return true;
                        }

                        if (
                            confidence <
                            this.options
                                .minimumFinalConfidence
                        ) {
                            return false;
                        }

                        if (
                            qualityScore <
                            this.options
                                .minimumFinalQuality
                        ) {
                            return false;
                        }

                        const etaHours =
                            getPredictionEtaHours(
                                prediction
                            );

                        if (
                            Number.isFinite(
                                etaHours
                            ) &&
                            (
                                etaHours < 0 ||
                                etaHours >
                                this.options
                                    .maximumEtaHours
                            )
                        ) {
                            return false;
                        }

                        return true;
                    }
                )
                .sort(
                    (
                        predictionA,
                        predictionB
                    ) => {
                        if (
                            predictionA.rainingNow &&
                            !predictionB.rainingNow
                        ) {
                            return -1;
                        }

                        if (
                            predictionB.rainingNow &&
                            !predictionA.rainingNow
                        ) {
                            return 1;
                        }

                        const etaA =
                            getPredictionEtaHours(
                                predictionA
                            );

                        const etaB =
                            getPredictionEtaHours(
                                predictionB
                            );

                        if (
                            Number.isFinite(
                                etaA
                            ) &&
                            Number.isFinite(
                                etaB
                            ) &&
                            etaA !== etaB
                        ) {
                            return etaA - etaB;
                        }

                        return (
                            getPredictionQualityScore(
                                predictionB
                            ) -
                            getPredictionQualityScore(
                                predictionA
                            )
                        );
                    }
                )
                .slice(
                    0,
                    this.options
                        .finalOutputLimit
                );
        }

        /* ==================================================================
           SECTION 16
           INITIAL CLOSURE CONSOLIDATION
           ================================================================== */

        consolidateClosureData(
            closure =
                this.state
                    .activeClosure
        ) {
            if (!closure) {
                throw createClosureError(
                    "No active closure record was found.",
                    "NO_ACTIVE_CLOSURE"
                );
            }

            this.setStatus(
                CLOSURE_STATUS
                    .CONSOLIDATING,
                {
                    closureId:
                        closure.id
                }
            );

            this.updateStage(
                "classifying_data"
            );

            const predictions =
                this.classifyPredictions();

            const cells =
                this.classifyCells();

            const activePredictions =
                this.filterFinalPredictions([
                    ...predictions
                        .rainingNow,

                    ...predictions
                        .active,

                    ...predictions
                        .possible
                ]);

            closure.data
                .activePredictions =
                deepClone(
                    activePredictions.filter(
                        (prediction) => {
                            return (
                                prediction
                                    .finalState ===
                                PREDICTION_FINAL_STATE
                                    .ACTIVE
                            );
                        }
                    )
                );

            closure.data
                .rainingNowPredictions =
                deepClone(
                    activePredictions.filter(
                        (prediction) => {
                            return (
                                prediction
                                    .finalState ===
                                PREDICTION_FINAL_STATE
                                    .RAINING_NOW
                            );
                        }
                    )
                );

            closure.data
                .possiblePredictions =
                deepClone(
                    activePredictions.filter(
                        (prediction) => {
                            return (
                                prediction
                                    .finalState ===
                                PREDICTION_FINAL_STATE
                                    .POSSIBLE
                            );
                        }
                    )
                );

            closure.data
                .expiredPredictions =
                deepClone(
                    predictions.expired
                );

            closure.data
                .rejectedPredictions =
                deepClone(
                    predictions.rejected
                );

            closure.data
                .closedPredictions =
                deepClone([
                    ...predictions.closed,
                    ...predictions.unknown
                ]);

            closure.data
                .activeCells =
                deepClone(
                    cells.active
                );

            closure.data
                .lostCells =
                deepClone(
                    cells.lost
                );

            closure.data
                .dissipatedCells =
                deepClone(
                    cells.dissipated
                );

            closure.data
                .expiredCells =
                deepClone([
                    ...cells.expired,
                    ...cells.unknown
                ]);

            closure.output = {
                ...closure.output,

                activePredictionCount:
                    closure.data
                        .activePredictions
                        .length,

                rainingNowCount:
                    closure.data
                        .rainingNowPredictions
                        .length,

                possiblePredictionCount:
                    closure.data
                        .possiblePredictions
                        .length,

                expiredPredictionCount:
                    closure.data
                        .expiredPredictions
                        .length,

                rejectedPredictionCount:
                    closure.data
                        .rejectedPredictions
                        .length,

                closedPredictionCount:
                    closure.data
                        .closedPredictions
                        .length,

                activeCellCount:
                    closure.data
                        .activeCells
                        .length,

                lostCellCount:
                    closure.data
                        .lostCells
                        .length,

                dissipatedCellCount:
                    closure.data
                        .dissipatedCells
                        .length,

                expiredCellCount:
                    closure.data
                        .expiredCells
                        .length
            };

            this.updateStage(
                "data_consolidated",
                {
                    output:
                        deepClone(
                            closure.output
                        )
                }
            );

            return closure;
        }

        /* ==================================================================
           SECTION 17
           GET STATE
           ================================================================== */

        getState() {
            return deepClone(
                this.state
            );
        }

        getStatus() {
            return {
                version:
                    this.version,

                status:
                    this.state.status,

                destroyed:
                    this.destroyed,

                activeClosure:
                    this.state
                        .activeClosure
                        ? deepClone(
                            this.state
                                .activeClosure
                          )
                        : null,

                lastClosure:
                    this.state
                        .lastClosure
                        ? deepClone(
                            this.state
                                .lastClosure
                          )
                        : null,

                totalClosures:
                    this.state
                        .totalClosures,

                successfulClosures:
                    this.state
                        .successfulClosures,

                partialClosures:
                    this.state
                        .partialClosures,

                failedClosures:
                    this.state
                        .failedClosures,

                lastClosureAt:
                    this.state
                        .lastClosureAt,

                lastError:
                    this.state
                        .lastError
                        ? deepClone(
                            this.state
                                .lastError
                          )
                        : null
            };
        }
    }

    /* ======================================================================
       SECTION 18
       CREATE CLOSURE INSTANCE
       ====================================================================== */

    function createRecoveryClosureV32(
        core,
        options = {}
    ) {
        return new RainArrivalRecoveryClosureV32(
            core,
            options
        );
    }

    /* ======================================================================
       SECTION 19
       CORE FACTORY METHOD
       ====================================================================== */

    CoreClass.prototype.createRecoveryClosure =
        function createRecoveryClosure(
            options = {}
        ) {
            if (
                this.recoveryClosureV32 instanceof
                RainArrivalRecoveryClosureV32
            ) {
                return this
                    .recoveryClosureV32;
            }

            return createRecoveryClosureV32(
                this,
                options
            );
        };

    CoreClass.prototype.getRecoveryClosure =
        function getRecoveryClosure() {
            return (
                this.recoveryClosureV32 ||
                this.recoveryClosure ||
                null
            );
        };

    /* ======================================================================
       SECTION 20
       GLOBAL EXPORTS
       ====================================================================== */

    global.RainArrivalRecoveryClosureV32 =
        RainArrivalRecoveryClosureV32;

    global.createRainArrivalRecoveryClosureV32 =
        createRecoveryClosureV32;

    global.RainArrivalRecoveryClosureV32Constants = {
        RECOVERY_CLOSURE_VERSION,
        DEFAULT_CLOSURE_TIMEOUT_MS,
        DEFAULT_STALE_PREDICTION_AGE_MS,
        DEFAULT_STALE_CELL_AGE_MS,
        DEFAULT_STALE_OBSERVATION_AGE_MS,
        DEFAULT_STALE_FORECAST_AGE_MS,
        DEFAULT_MAX_CLOSURE_HISTORY,
        DEFAULT_MAX_ARCHIVED_PREDICTIONS,
        DEFAULT_MAX_ARCHIVED_CELLS,
        DEFAULT_MIN_FINAL_CONFIDENCE,
        DEFAULT_MIN_FINAL_QUALITY,
        DEFAULT_MAX_ETA_HOURS,
        DEFAULT_FINAL_OUTPUT_LIMIT,
        CLOSURE_STATUS,
        CLOSURE_REASON,
        PREDICTION_FINAL_STATE,
        CELL_FINAL_STATE
    };

    global.RainArrivalRecoveryClosureV32Utils = {
        createClosureId,
        createClosureError,
        normalizeClosureError,
        calculateAgeMs,
        normalizeClosureReason,
        normalizeClosureStatus,
        getPredictionEtaHours,
        getPredictionQualityScore,
        getPredictionConfidence,
        getCellTimestamp,
        getPredictionTimestamp,
        classifyPredictionFinalState,
        classifyCellFinalState,
        createClosureRecord
    };

    global.RainArrivalRecoveryClosureV32Part1 = {
        version:
            RECOVERY_CLOSURE_VERSION,

        RainArrivalRecoveryClosureV32,
        createRecoveryClosureV32
    };

})(window);

/* ==========================================================================
   RainGuard AI
   Long Horizon Forecast Engine V32

   Recovery Closure Engine V32

   PART 2
   Cleanup + Expiration + Archiving + Core State Synchronization
   ========================================================================== */

(function extendRainArrivalRecoveryClosureV32Part2(global) {
    "use strict";

    /* ======================================================================
       SECTION 21
       DEPENDENCY RESOLUTION
       ====================================================================== */

    const ClosureClass =
        global.RainArrivalRecoveryClosureV32;

    const ClosureConstants =
        global.RainArrivalRecoveryClosureV32Constants;

    const ClosureUtils =
        global.RainArrivalRecoveryClosureV32Utils;

    const CoreUtils =
        global.RainArrivalRecoveryCoreV32Utils;

    const CoreConstants =
        global.RainArrivalRecoveryCoreV32Constants;

    if (
        typeof ClosureClass !== "function" ||
        !ClosureConstants ||
        !ClosureUtils ||
        !CoreUtils ||
        !CoreConstants
    ) {
        throw new Error(
            "RainArrivalRecoveryClosureV32 Part 1 must be loaded before Part 2."
        );
    }

    const {
        CLOSURE_STATUS,
        PREDICTION_FINAL_STATE,
        CELL_FINAL_STATE
    } = ClosureConstants;

    const {
        createClosureError,
        calculateAgeMs,
        getPredictionTimestamp,
        getCellTimestamp,
        getPredictionEtaHours
    } = ClosureUtils;

    const {
        toFiniteNumber,
        normalizeTimestamp,
        safeArray,
        safeObject,
        deepClone
    } = CoreUtils;

    const {
        RAIN_STATUS,
        CELL_STATUS,
        CORE_EVENTS
    } = CoreConstants;

    /* ======================================================================
       SECTION 22
       CLEANUP CONSTANTS
       ====================================================================== */

    const CLEANUP_REASON =
        Object.freeze({
            STALE:
                "stale",

            EXPIRED:
                "expired",

            REJECTED:
                "rejected",

            LOST:
                "lost",

            DISSIPATED:
                "dissipated",

            INVALID:
                "invalid",

            DUPLICATE:
                "duplicate",

            MANUAL:
                "manual",

            CLOSURE:
                "closure"
        });

    const ARCHIVE_TYPE =
        Object.freeze({
            PREDICTION:
                "prediction",

            CELL:
                "cell",

            OBSERVATION:
                "observation",

            FORECAST:
                "forecast"
        });

    const DEFAULT_PREDICTION_REMOVAL_DELAY_MS =
        5 * 60 * 1000;

    const DEFAULT_CELL_REMOVAL_DELAY_MS =
        10 * 60 * 1000;

    const DEFAULT_ARCHIVE_RETENTION_MS =
        7 * 24 * 60 * 60 * 1000;

    const DEFAULT_MAX_OBSERVATION_ARCHIVE =
        2000;

    const DEFAULT_MAX_FORECAST_ARCHIVE =
        5000;

    /* ======================================================================
       SECTION 23
       ARCHIVE HELPERS
       ====================================================================== */

    function createArchiveRecord(
        type,
        item,
        reason,
        closureId
    ) {
        return {
            archiveId:
                [
                    "archive",
                    type,
                    Date.now(),
                    Math.random()
                        .toString(36)
                        .slice(2, 8)
                ].join("_"),

            type,

            reason:
                reason ||
                CLEANUP_REASON.CLOSURE,

            closureId:
                closureId ||
                null,

            archivedAt:
                Date.now(),

            originalTimestamp:
                normalizeTimestamp(
                    item?.updatedAt ||
                    item?.generatedAt ||
                    item?.timestamp ||
                    item?.createdAt ||
                    0
                ),

            data:
                deepClone(item)
        };
    }

    function isArchiveRecordExpired(
        archiveRecord,
        retentionMs =
            DEFAULT_ARCHIVE_RETENTION_MS
    ) {
        if (!archiveRecord) {
            return true;
        }

        const archivedAt =
            normalizeTimestamp(
                archiveRecord.archivedAt
            );

        return (
            Date.now() -
            archivedAt >
            retentionMs
        );
    }

    function getPredictionArchiveReason(
        prediction
    ) {
        switch (
            prediction?.finalState
        ) {
            case PREDICTION_FINAL_STATE.EXPIRED:
                return CLEANUP_REASON.EXPIRED;

            case PREDICTION_FINAL_STATE.REJECTED:
                return CLEANUP_REASON.REJECTED;

            case PREDICTION_FINAL_STATE.CLOSED:
                return CLEANUP_REASON.CLOSURE;

            default:
                return CLEANUP_REASON.STALE;
        }
    }

    function getCellArchiveReason(
        cell
    ) {
        switch (
            cell?.finalState
        ) {
            case CELL_FINAL_STATE.LOST:
                return CLEANUP_REASON.LOST;

            case CELL_FINAL_STATE.DISSIPATED:
                return CLEANUP_REASON.DISSIPATED;

            case CELL_FINAL_STATE.EXPIRED:
                return CLEANUP_REASON.EXPIRED;

            default:
                return CLEANUP_REASON.CLOSURE;
        }
    }

    function buildPredictionIdentity(
        prediction
    ) {
        return [
            prediction?.id ||
            "",

            prediction?.locationId ||
            "",

            prediction?.trackingId ||
            "",

            Math.round(
                toFiniteNumber(
                    getPredictionEtaHours(
                        prediction
                    ),
                    -1
                ) *
                60
            )
        ].join("|");
    }

    function buildCellIdentity(
        cell
    ) {
        return (
            cell?.trackingId ||
            cell?.id ||
            [
                cell?.latitude,
                cell?.longitude,
                getCellTimestamp(cell)
            ].join("|")
        );
    }

    /* ======================================================================
       SECTION 24
       ENSURE ARCHIVE STATE
       ====================================================================== */

    ClosureClass.prototype.ensureArchiveState =
        function ensureArchiveState() {
            if (
                !Array.isArray(
                    this.state
                        .archivedPredictions
                )
            ) {
                this.state
                    .archivedPredictions = [];
            }

            if (
                !Array.isArray(
                    this.state
                        .archivedCells
                )
            ) {
                this.state
                    .archivedCells = [];
            }

            if (
                !Array.isArray(
                    this.state
                        .archivedObservations
                )
            ) {
                this.state
                    .archivedObservations = [];
            }

            if (
                !Array.isArray(
                    this.state
                        .archivedForecasts
                )
            ) {
                this.state
                    .archivedForecasts = [];
            }

            return {
                archivedPredictions:
                    this.state
                        .archivedPredictions,

                archivedCells:
                    this.state
                        .archivedCells,

                archivedObservations:
                    this.state
                        .archivedObservations,

                archivedForecasts:
                    this.state
                        .archivedForecasts
            };
        };

    /* ======================================================================
       SECTION 25
       DEDUPLICATE ARCHIVE RECORDS
       ====================================================================== */

    ClosureClass.prototype.deduplicateArchiveRecords =
        function deduplicateArchiveRecords(
            records,
            identityResolver
        ) {
            const result = [];

            const seen =
                new Set();

            safeArray(records)
                .slice()
                .reverse()
                .forEach(
                    (record) => {
                        const source =
                            record?.data ||
                            record;

                        const identity =
                            identityResolver(
                                source
                            );

                        if (
                            !identity ||
                            seen.has(identity)
                        ) {
                            return;
                        }

                        seen.add(identity);

                        result.push(record);
                    }
                );

            return result.reverse();
        };

    /* ======================================================================
       SECTION 26
       ARCHIVE PREDICTIONS
       ====================================================================== */

    ClosureClass.prototype.archivePredictions =
        function archivePredictions(
            predictions,
            closure =
                this.state
                    .activeClosure
        ) {
            this.ensureArchiveState();

            if (!closure) {
                throw createClosureError(
                    "No active closure exists for prediction archiving.",
                    "NO_ACTIVE_CLOSURE"
                );
            }

            const records =
                safeArray(predictions)
                    .map(
                        (prediction) => {
                            return createArchiveRecord(
                                ARCHIVE_TYPE.PREDICTION,
                                prediction,
                                getPredictionArchiveReason(
                                    prediction
                                ),
                                closure.id
                            );
                        }
                    );

            this.state
                .archivedPredictions
                .push(...records);

            this.state
                .archivedPredictions =
                this.deduplicateArchiveRecords(
                    this.state
                        .archivedPredictions,
                    buildPredictionIdentity
                )
                    .slice(
                        -this.options
                            .maximumArchivedPredictions
                    );

            closure.data
                .archivedPredictions =
                deepClone(records);

            closure.output
                .archivedPredictionCount =
                records.length;

            return records;
        };

    /* ======================================================================
       SECTION 27
       ARCHIVE CELLS
       ====================================================================== */

    ClosureClass.prototype.archiveCells =
        function archiveCells(
            cells,
            closure =
                this.state
                    .activeClosure
        ) {
            this.ensureArchiveState();

            if (!closure) {
                throw createClosureError(
                    "No active closure exists for cell archiving.",
                    "NO_ACTIVE_CLOSURE"
                );
            }

            const records =
                safeArray(cells)
                    .map(
                        (cell) => {
                            return createArchiveRecord(
                                ARCHIVE_TYPE.CELL,
                                cell,
                                getCellArchiveReason(
                                    cell
                                ),
                                closure.id
                            );
                        }
                    );

            this.state
                .archivedCells
                .push(...records);

            this.state
                .archivedCells =
                this.deduplicateArchiveRecords(
                    this.state
                        .archivedCells,
                    buildCellIdentity
                )
                    .slice(
                        -this.options
                            .maximumArchivedCells
                    );

            closure.data
                .archivedCells =
                deepClone(records);

            closure.output
                .archivedCellCount =
                records.length;

            return records;
        };

    /* ======================================================================
       SECTION 28
       ARCHIVE STALE OBSERVATIONS
       ====================================================================== */

    ClosureClass.prototype.archiveStaleObservations =
        function archiveStaleObservations(
            closure =
                this.state
                    .activeClosure
        ) {
            this.ensureArchiveState();

            const currentObservations =
                safeArray(
                    this.core.state
                        .observations
                );

            const active = [];
            const stale = [];

            currentObservations.forEach(
                (observation) => {
                    const timestamp =
                        normalizeTimestamp(
                            observation.timestamp ||
                            observation.observedAt ||
                            observation.createdAt ||
                            0
                        );

                    const ageMs =
                        calculateAgeMs(
                            timestamp
                        );

                    if (
                        ageMs >
                        this.options
                            .staleObservationAgeMs
                    ) {
                        stale.push(
                            observation
                        );
                    } else {
                        active.push(
                            observation
                        );
                    }
                }
            );

            const archiveRecords =
                stale.map(
                    (observation) => {
                        return createArchiveRecord(
                            ARCHIVE_TYPE.OBSERVATION,
                            observation,
                            CLEANUP_REASON.STALE,
                            closure?.id
                        );
                    }
                );

            this.state
                .archivedObservations
                .push(
                    ...archiveRecords
                );

            this.state
                .archivedObservations =
                this.state
                    .archivedObservations
                    .slice(
                        -DEFAULT_MAX_OBSERVATION_ARCHIVE
                    );

            this.core.state
                .observations =
                deepClone(active);

            return {
                activeCount:
                    active.length,

                archivedCount:
                    archiveRecords.length,

                archived:
                    archiveRecords
            };
        };

    /* ======================================================================
       SECTION 29
       ARCHIVE STALE FORECASTS
       ====================================================================== */

    ClosureClass.prototype.archiveStaleForecasts =
        function archiveStaleForecasts(
            closure =
                this.state
                    .activeClosure
        ) {
            this.ensureArchiveState();

            const currentForecasts =
                safeArray(
                    this.core.state
                        .forecasts
                );

            const active = [];
            const stale = [];

            currentForecasts.forEach(
                (forecast) => {
                    const timestamp =
                        normalizeTimestamp(
                            forecast.forecastTimestamp ||
                            forecast.timestamp ||
                            forecast.generatedAt ||
                            forecast.createdAt ||
                            0
                        );

                    const ageMs =
                        calculateAgeMs(
                            timestamp
                        );

                    if (
                        ageMs >
                        this.options
                            .staleForecastAgeMs
                    ) {
                        stale.push(
                            forecast
                        );
                    } else {
                        active.push(
                            forecast
                        );
                    }
                }
            );

            const archiveRecords =
                stale.map(
                    (forecast) => {
                        return createArchiveRecord(
                            ARCHIVE_TYPE.FORECAST,
                            forecast,
                            CLEANUP_REASON.STALE,
                            closure?.id
                        );
                    }
                );

            this.state
                .archivedForecasts
                .push(
                    ...archiveRecords
                );

            this.state
                .archivedForecasts =
                this.state
                    .archivedForecasts
                    .slice(
                        -DEFAULT_MAX_FORECAST_ARCHIVE
                    );

            this.core.state
                .forecasts =
                deepClone(active);

            return {
                activeCount:
                    active.length,

                archivedCount:
                    archiveRecords.length,

                archived:
                    archiveRecords
            };
        };

    /* ======================================================================
       SECTION 30
       CLEAN ARCHIVE RETENTION
       ====================================================================== */

    ClosureClass.prototype.cleanupArchiveRetention =
        function cleanupArchiveRetention(
            options = {}
        ) {
            this.ensureArchiveState();

            const retentionMs =
                Math.max(
                    60 * 60 * 1000,
                    toFiniteNumber(
                        options.retentionMs,
                        DEFAULT_ARCHIVE_RETENTION_MS
                    )
                );

            const before = {
                predictions:
                    this.state
                        .archivedPredictions
                        .length,

                cells:
                    this.state
                        .archivedCells
                        .length,

                observations:
                    this.state
                        .archivedObservations
                        .length,

                forecasts:
                    this.state
                        .archivedForecasts
                        .length
            };

            this.state
                .archivedPredictions =
                this.state
                    .archivedPredictions
                    .filter(
                        (record) => {
                            return !isArchiveRecordExpired(
                                record,
                                retentionMs
                            );
                        }
                    );

            this.state
                .archivedCells =
                this.state
                    .archivedCells
                    .filter(
                        (record) => {
                            return !isArchiveRecordExpired(
                                record,
                                retentionMs
                            );
                        }
                    );

            this.state
                .archivedObservations =
                this.state
                    .archivedObservations
                    .filter(
                        (record) => {
                            return !isArchiveRecordExpired(
                                record,
                                retentionMs
                            );
                        }
                    );

            this.state
                .archivedForecasts =
                this.state
                    .archivedForecasts
                    .filter(
                        (record) => {
                            return !isArchiveRecordExpired(
                                record,
                                retentionMs
                            );
                        }
                    );

            const after = {
                predictions:
                    this.state
                        .archivedPredictions
                        .length,

                cells:
                    this.state
                        .archivedCells
                        .length,

                observations:
                    this.state
                        .archivedObservations
                        .length,

                forecasts:
                    this.state
                        .archivedForecasts
                        .length
            };

            return {
                retentionMs,

                removed: {
                    predictions:
                        before.predictions -
                        after.predictions,

                    cells:
                        before.cells -
                        after.cells,

                    observations:
                        before.observations -
                        after.observations,

                    forecasts:
                        before.forecasts -
                        after.forecasts
                },

                remaining:
                    after,

                cleanedAt:
                    Date.now()
            };
        };

    /* ======================================================================
       SECTION 31
       REMOVE CLOSED PREDICTIONS FROM CORE
       ====================================================================== */

    ClosureClass.prototype.removeClosedPredictionsFromCore =
        function removeClosedPredictionsFromCore(
            closure =
                this.state
                    .activeClosure
        ) {
            if (!closure) {
                throw createClosureError(
                    "No active closure exists for prediction cleanup.",
                    "NO_ACTIVE_CLOSURE"
                );
            }

            const keepPredictions = [
                ...safeArray(
                    closure.data
                        .rainingNowPredictions
                ),

                ...safeArray(
                    closure.data
                        .activePredictions
                ),

                ...safeArray(
                    closure.data
                        .possiblePredictions
                )
            ];

            const unique = [];

            const seen =
                new Set();

            keepPredictions.forEach(
                (prediction) => {
                    const identity =
                        buildPredictionIdentity(
                            prediction
                        );

                    if (
                        seen.has(identity)
                    ) {
                        return;
                    }

                    seen.add(identity);
                    unique.push(prediction);
                }
            );

            this.core.state
                .arrivalPredictions =
                deepClone(unique);

            this.core.state
                .cityForecasts =
                deepClone(
                    unique.filter(
                        (prediction) => {
                            return [
                                "city",
                                "district",
                                "village",
                                "station",
                                "airport",
                                "custom"
                            ].includes(
                                prediction
                                    .locationType
                            );
                        }
                    )
                );

            return {
                retainedPredictionCount:
                    unique.length,

                removedPredictionCount:
                    Math.max(
                        0,
                        closure.input
                            .predictionCount -
                        unique.length
                    )
            };
        };

    /* ======================================================================
       SECTION 32
       REMOVE CLOSED CELLS FROM CORE
       ====================================================================== */

    ClosureClass.prototype.removeClosedCellsFromCore =
        function removeClosedCellsFromCore(
            closure =
                this.state
                    .activeClosure
        ) {
            if (!closure) {
                throw createClosureError(
                    "No active closure exists for cell cleanup.",
                    "NO_ACTIVE_CLOSURE"
                );
            }

            const activeCells =
                safeArray(
                    closure.data
                        .activeCells
                );

            const activeIds =
                new Set(
                    activeCells.map(
                        buildCellIdentity
                    )
                );

            const originalSize =
                this.core.cells
                    ?.size ||
                0;

            if (
                this.core.cells &&
                typeof this.core.cells
                    .forEach ===
                "function"
            ) {
                const keysToDelete = [];

                this.core.cells.forEach(
                    (
                        cell,
                        key
                    ) => {
                        const identity =
                            buildCellIdentity(
                                cell
                            );

                        if (
                            !activeIds.has(
                                identity
                            )
                        ) {
                            keysToDelete.push(
                                key
                            );
                        }
                    }
                );

                keysToDelete.forEach(
                    (key) => {
                        this.core.cells.delete(
                            key
                        );
                    }
                );
            }

            this.core.state
                .rainCells =
                deepClone(
                    activeCells
                );

            return {
                retainedCellCount:
                    activeCells.length,

                removedCellCount:
                    Math.max(
                        0,
                        originalSize -
                        activeCells.length
                    )
            };
        };

    /* ======================================================================
       SECTION 33
       CLOSE LOST CELLS
       ====================================================================== */

    ClosureClass.prototype.closeLostCells =
        function closeLostCells(
            closure =
                this.state
                    .activeClosure
        ) {
            if (!closure) {
                throw createClosureError(
                    "No active closure exists for lost-cell closure.",
                    "NO_ACTIVE_CLOSURE"
                );
            }

            const cellsToClose = [
                ...safeArray(
                    closure.data
                        .lostCells
                ),

                ...safeArray(
                    closure.data
                        .dissipatedCells
                ),

                ...safeArray(
                    closure.data
                        .expiredCells
                )
            ];

            return cellsToClose.map(
                (cell) => {
                    const finalStatus =
                        cell.finalState ===
                        CELL_FINAL_STATE
                            .DISSIPATED
                            ? CELL_STATUS
                                .DISSIPATED
                            : CELL_STATUS
                                .LOST;

                    return {
                        ...deepClone(cell),

                        status:
                            finalStatus,

                        active:
                            false,

                        closedAt:
                            Date.now(),

                        closureId:
                            closure.id,

                        closureReason:
                            getCellArchiveReason(
                                cell
                            )
                    };
                }
            );
        };

    /* ======================================================================
       SECTION 34
       CLOSE EXPIRED PREDICTIONS
       ====================================================================== */

    ClosureClass.prototype.closeExpiredPredictions =
        function closeExpiredPredictions(
            closure =
                this.state
                    .activeClosure
        ) {
            if (!closure) {
                throw createClosureError(
                    "No active closure exists for expired-prediction closure.",
                    "NO_ACTIVE_CLOSURE"
                );
            }

            const predictionsToClose = [
                ...safeArray(
                    closure.data
                        .expiredPredictions
                ),

                ...safeArray(
                    closure.data
                        .closedPredictions
                ),

                ...safeArray(
                    closure.data
                        .rejectedPredictions
                )
            ];

            return predictionsToClose.map(
                (prediction) => {
                    return {
                        ...deepClone(
                            prediction
                        ),

                        status:
                            RAIN_STATUS.NO_RAIN,

                        rainingNow:
                            false,

                        etaHours:
                            null,

                        etaMinutes:
                            null,

                        arrivalTimestamp:
                            null,

                        arrivalIso:
                            null,

                        active:
                            false,

                        closedAt:
                            Date.now(),

                        closureId:
                            closure.id,

                        closureReason:
                            getPredictionArchiveReason(
                                prediction
                            )
                    };
                }
            );
        };

    /* ======================================================================
       SECTION 35
       EXECUTE DATA CLEANUP
       ====================================================================== */

    ClosureClass.prototype.executeDataCleanup =
        function executeDataCleanup(
            closure =
                this.state
                    .activeClosure
        ) {
            if (!closure) {
                throw createClosureError(
                    "No active closure record exists.",
                    "NO_ACTIVE_CLOSURE"
                );
            }

            this.setStatus(
                CLOSURE_STATUS.CLEANING,
                {
                    closureId:
                        closure.id
                }
            );

            this.updateStage(
                "cleanup_started"
            );

            const closedPredictions =
                this.closeExpiredPredictions(
                    closure
                );

            const closedCells =
                this.closeLostCells(
                    closure
                );

            this.updateStage(
                "archiving_closed_records",
                {
                    predictionCount:
                        closedPredictions.length,

                    cellCount:
                        closedCells.length
                }
            );

            const predictionArchive =
                this.archivePredictions(
                    closedPredictions,
                    closure
                );

            const cellArchive =
                this.archiveCells(
                    closedCells,
                    closure
                );

            const observationCleanup =
                this.archiveStaleObservations(
                    closure
                );

            const forecastCleanup =
                this.archiveStaleForecasts(
                    closure
                );

            this.updateStage(
                "removing_closed_core_data"
            );

            const predictionCleanup =
                this.removeClosedPredictionsFromCore(
                    closure
                );

            const cellCleanup =
                this.removeClosedCellsFromCore(
                    closure
                );

            const retentionCleanup =
                this.cleanupArchiveRetention();

            const result = {
                completedAt:
                    Date.now(),

                predictionArchiveCount:
                    predictionArchive.length,

                cellArchiveCount:
                    cellArchive.length,

                staleObservationArchiveCount:
                    observationCleanup
                        .archivedCount,

                staleForecastArchiveCount:
                    forecastCleanup
                        .archivedCount,

                retainedPredictionCount:
                    predictionCleanup
                        .retainedPredictionCount,

                retainedCellCount:
                    cellCleanup
                        .retainedCellCount,

                removedPredictionCount:
                    predictionCleanup
                        .removedPredictionCount,

                removedCellCount:
                    cellCleanup
                        .removedCellCount,

                retentionCleanup
            };

            closure.cleanupResult =
                deepClone(result);

            this.updateStage(
                "cleanup_completed",
                result
            );

            return result;
        };

    /* ======================================================================
       SECTION 36
       REBUILD CORE DERIVED STATE
       ====================================================================== */

    ClosureClass.prototype.rebuildCoreDerivedState =
        function rebuildCoreDerivedState(
            options = {}
        ) {
            const result = {
                dashboardRebuilt:
                    false,

                frontendPayloadRebuilt:
                    false,

                regionCount:
                    0,

                governorateCount:
                    0,

                predictionCount:
                    safeArray(
                        this.core.state
                            .arrivalPredictions
                    ).length,

                errors: []
            };

            try {
                if (
                    typeof this.core
                        .executeHorizonAggregation ===
                    "function"
                ) {
                    const dashboard =
                        this.core
                            .executeHorizonAggregation(
                                options.horizons ||
                                {}
                            );

                    result.dashboardRebuilt =
                        true;

                    result.regionCount =
                        safeArray(
                            dashboard.regions
                        ).length;

                    result.governorateCount =
                        safeArray(
                            dashboard
                                .governorates
                        ).length;
                }
            } catch (error) {
                result.errors.push({
                    stage:
                        "horizon_aggregation",

                    message:
                        error?.message ||
                        String(error)
                });
            }

            try {
                if (
                    this.options
                        .rebuildFrontendPayload &&
                    typeof this.core
                        .buildFrontendPayload ===
                    "function"
                ) {
                    this.core
                        .buildFrontendPayload(
                            options.frontend ||
                            {}
                        );

                    result.frontendPayloadRebuilt =
                        true;
                }
            } catch (error) {
                result.errors.push({
                    stage:
                        "frontend_payload",

                    message:
                        error?.message ||
                        String(error)
                });
            }

            result.completedAt =
                Date.now();

            return result;
        };

    /* ======================================================================
       SECTION 37
       SYNCHRONIZE CORE CLOSURE STATE
       ====================================================================== */

    ClosureClass.prototype.synchronizeCoreClosureState =
        function synchronizeCoreClosureState(
            closure =
                this.state
                    .activeClosure
        ) {
            if (!closure) {
                return null;
            }

            if (
                !this.core.state.closure
            ) {
                this.core.state.closure = {};
            }

            this.core.state.closure = {
                ...safeObject(
                    this.core.state.closure
                ),

                status:
                    closure.status,

                lastClosureId:
                    closure.id,

                lastClosureAt:
                    closure.completedAt ||
                    Date.now(),

                lastClosureReason:
                    closure.reason,

                lastClosureSummary: {
                    input:
                        deepClone(
                            closure.input
                        ),

                    output:
                        deepClone(
                            closure.output
                        ),

                    durationMs:
                        closure.durationMs,

                    errorCount:
                        safeArray(
                            closure.errors
                        ).length,

                    warningCount:
                        safeArray(
                            closure.warnings
                        ).length
                },

                activePredictionCount:
                    safeArray(
                        this.core.state
                            .arrivalPredictions
                    ).length,

                activeCellCount:
                    this.core.cells
                        ?.size ||
                    0,

                updatedAt:
                    Date.now()
            };

            this.core.state
                .archivedPredictions =
                deepClone(
                    this.state
                        .archivedPredictions
                );

            this.core.state
                .archivedCells =
                deepClone(
                    this.state
                        .archivedCells
                );

            this.core.state
                .archivedObservations =
                deepClone(
                    this.state
                        .archivedObservations
                );

            this.core.state
                .archivedForecasts =
                deepClone(
                    this.state
                        .archivedForecasts
                );

            return deepClone(
                this.core.state.closure
            );
        };

    /* ======================================================================
       SECTION 38
       GET ARCHIVED PREDICTIONS
       ====================================================================== */

    ClosureClass.prototype.getArchivedPredictions =
        function getArchivedPredictions(
            limit = 100
        ) {
            this.ensureArchiveState();

            const safeLimit =
                Math.max(
                    1,
                    Math.min(
                        1000,
                        Math.round(
                            toFiniteNumber(
                                limit,
                                100
                            )
                        )
                    )
                );

            return deepClone(
                this.state
                    .archivedPredictions
                    .slice(
                        -safeLimit
                    )
                    .reverse()
            );
        };

    /* ======================================================================
       SECTION 39
       GET ARCHIVED CELLS
       ====================================================================== */

    ClosureClass.prototype.getArchivedCells =
        function getArchivedCells(
            limit = 100
        ) {
            this.ensureArchiveState();

            const safeLimit =
                Math.max(
                    1,
                    Math.min(
                        1000,
                        Math.round(
                            toFiniteNumber(
                                limit,
                                100
                            )
                        )
                    )
                );

            return deepClone(
                this.state
                    .archivedCells
                    .slice(
                        -safeLimit
                    )
                    .reverse()
            );
        };

    /* ======================================================================
       SECTION 40
       GET ARCHIVE SUMMARY
       ====================================================================== */

    ClosureClass.prototype.getArchiveSummary =
        function getArchiveSummary() {
            this.ensureArchiveState();

            return {
                predictionArchiveCount:
                    this.state
                        .archivedPredictions
                        .length,

                cellArchiveCount:
                    this.state
                        .archivedCells
                        .length,

                observationArchiveCount:
                    this.state
                        .archivedObservations
                        .length,

                forecastArchiveCount:
                    this.state
                        .archivedForecasts
                        .length,

                latestPredictionArchive:
                    this.state
                        .archivedPredictions
                        .slice(-1)[0] ||
                    null,

                latestCellArchive:
                    this.state
                        .archivedCells
                        .slice(-1)[0] ||
                    null,

                generatedAt:
                    Date.now()
            };
        };

    /* ======================================================================
       SECTION 41
       EXECUTE CLEANUP AND SYNCHRONIZATION
       ====================================================================== */

    ClosureClass.prototype.executeCleanupAndSynchronization =
        function executeCleanupAndSynchronization(
            closure =
                this.state
                    .activeClosure,
            options = {}
        ) {
            if (!closure) {
                throw createClosureError(
                    "No active closure record exists.",
                    "NO_ACTIVE_CLOSURE"
                );
            }

            const cleanup =
                this.executeDataCleanup(
                    closure
                );

            this.updateStage(
                "rebuilding_derived_state"
            );

            const rebuild =
                this.rebuildCoreDerivedState(
                    options
                );

            this.updateStage(
                "synchronizing_core_state"
            );

            const synchronizedState =
                this.synchronizeCoreClosureState(
                    closure
                );

            const result = {
                cleanup,
                rebuild,
                synchronizedState,

                completedAt:
                    Date.now()
            };

            closure.synchronizationResult =
                deepClone(result);

            this.updateStage(
                "cleanup_and_synchronization_completed",
                {
                    activePredictionCount:
                        safeArray(
                            this.core.state
                                .arrivalPredictions
                        ).length,

                    activeCellCount:
                        this.core.cells
                            ?.size ||
                        0
                }
            );

            if (
                typeof this.core.emit ===
                "function"
            ) {
                this.core.emit(
                    CORE_EVENTS
                        .CLOSURE_CLEANUP_COMPLETED ||
                    "closure_cleanup_completed",
                    {
                        closureId:
                            closure.id,

                        result:
                            deepClone(result),

                        timestamp:
                            Date.now()
                    }
                );
            }

            return result;
        };

    /* ======================================================================
       SECTION 42
       CLEAR ARCHIVES
       ====================================================================== */

    ClosureClass.prototype.clearArchives =
        function clearArchives(
            options = {}
        ) {
            this.ensureArchiveState();

            const safeOptions =
                safeObject(options);

            const before =
                this.getArchiveSummary();

            if (
                safeOptions.predictions !==
                false
            ) {
                this.state
                    .archivedPredictions = [];
            }

            if (
                safeOptions.cells !==
                false
            ) {
                this.state
                    .archivedCells = [];
            }

            if (
                safeOptions.observations !==
                false
            ) {
                this.state
                    .archivedObservations = [];
            }

            if (
                safeOptions.forecasts !==
                false
            ) {
                this.state
                    .archivedForecasts = [];
            }

            this.synchronizeCoreClosureState(
                this.state.activeClosure ||
                this.state.lastClosure
            );

            return {
                clearedAt:
                    Date.now(),

                before,

                after:
                    this.getArchiveSummary()
            };
        };

    /* ======================================================================
       SECTION 43
       COMPATIBILITY ALIASES
       ====================================================================== */

    ClosureClass.prototype.cleanupClosureData =
        ClosureClass.prototype
            .executeDataCleanup;

    ClosureClass.prototype.archiveExpiredPredictions =
        ClosureClass.prototype
            .archivePredictions;

    ClosureClass.prototype.archiveExpiredCells =
        ClosureClass.prototype
            .archiveCells;

    ClosureClass.prototype.syncCoreState =
        ClosureClass.prototype
            .synchronizeCoreClosureState;

    ClosureClass.prototype.getArchiveStatus =
        ClosureClass.prototype
            .getArchiveSummary;

    /* ======================================================================
       SECTION 44
       PART 2 EXPORT
       ====================================================================== */

    global.RainArrivalRecoveryClosureV32Part2 = {
    CLEANUP_REASON,
    ARCHIVE_TYPE,
    DEFAULT_PREDICTION_REMOVAL_DELAY_MS,
    DEFAULT_CELL_REMOVAL_DELAY_MS,
    DEFAULT_ARCHIVE_RETENTION_MS,
    DEFAULT_MAX_OBSERVATION_ARCHIVE,
    DEFAULT_MAX_FORECAST_ARCHIVE,
    createArchiveRecord
};

})(window);

    ========================================================================== */
   RainGuard AI
   Long Horizon Forecast Engine V32

   Recovery Closure Engine V32

   PART 3
   Final Summary + Publication + Completion + Error Handling + Full Closure Run
   ========================================================================== */

(function extendRainArrivalRecoveryClosureV32Part3(global) {
    "use strict";

    /* ======================================================================
       SECTION 45
       DEPENDENCY RESOLUTION
       ====================================================================== */

    const ClosureClass =
        global.RainArrivalRecoveryClosureV32;

    const ClosureConstants =
        global.RainArrivalRecoveryClosureV32Constants;

    const ClosureUtils =
        global.RainArrivalRecoveryClosureV32Utils;

    const CoreUtils =
        global.RainArrivalRecoveryCoreV32Utils;

    const CoreConstants =
        global.RainArrivalRecoveryCoreV32Constants;

    if (
        typeof ClosureClass !== "function" ||
        !ClosureConstants ||
        !ClosureUtils ||
        !CoreUtils ||
        !CoreConstants
    ) {
        throw new Error(
            "RainArrivalRecoveryClosureV32 Parts 1 and 2 must be loaded before Part 3."
        );
    }

    const {
        CLOSURE_STATUS,
        CLOSURE_REASON
    } = ClosureConstants;

    const {
        createClosureError,
        normalizeClosureError
    } = ClosureUtils;

    const {
        toFiniteNumber,
        clamp,
        safeArray,
        safeObject,
        deepClone
    } = CoreUtils;

    const {
        CORE_EVENTS
    } = CoreConstants;

    /* ======================================================================
       SECTION 46
       FINALIZATION CONSTANTS
       ====================================================================== */

    const DEFAULT_FINAL_PUBLICATION_TIMEOUT_MS =
        15 * 1000;

    const DEFAULT_MAX_FINAL_WARNINGS =
        100;

    const DEFAULT_MAX_FINAL_ERRORS =
        100;

    const FINALIZATION_RESULT =
        Object.freeze({
            SUCCESS:
                "success",

            PARTIAL:
                "partial",

            FAILED:
                "failed",

            ABORTED:
                "aborted"
        });

    const FINAL_PAYLOAD_SCHEMA =
        "RainArrivalRecoveryClosurePayload";

    const FINAL_PAYLOAD_VERSION =
        "32.3.0";

    /* ======================================================================
       SECTION 47
       FINALIZATION HELPERS
       ====================================================================== */

    function calculateClosureDuration(
        closure
    ) {
        if (!closure) {
            return 0;
        }

        const startedAt =
            toFiniteNumber(
                closure.startedAt,
                0
            );

        const completedAt =
            toFiniteNumber(
                closure.completedAt,
                Date.now()
            );

        if (
            !startedAt ||
            completedAt <
            startedAt
        ) {
            return 0;
        }

        return (
            completedAt -
            startedAt
        );
    }

    function calculateClosureSuccessRatio(
        closure
    ) {
        if (!closure) {
            return 0;
        }

        const inputCount =
            Math.max(
                1,
                toFiniteNumber(
                    closure
                        ?.input
                        ?.predictionCount,
                    0
                ) +
                toFiniteNumber(
                    closure
                        ?.input
                        ?.trackedCellCount,
                    0
                )
            );

        const validOutputCount =
            toFiniteNumber(
                closure
                    ?.output
                    ?.activePredictionCount,
                0
            ) +
            toFiniteNumber(
                closure
                    ?.output
                    ?.rainingNowCount,
                0
            ) +
            toFiniteNumber(
                closure
                    ?.output
                    ?.possiblePredictionCount,
                0
            ) +
            toFiniteNumber(
                closure
                    ?.output
                    ?.activeCellCount,
                0
            );

        return clamp(
            validOutputCount /
            inputCount,
            0,
            1
        );
    }

    function determineClosureResult(
        closure
    ) {
        if (!closure) {
            return FINALIZATION_RESULT.FAILED;
        }

        if (
            closure.status ===
            CLOSURE_STATUS.ABORTED
        ) {
            return FINALIZATION_RESULT.ABORTED;
        }

        if (
            closure.status ===
            CLOSURE_STATUS.FAILED
        ) {
            return FINALIZATION_RESULT.FAILED;
        }

        const errorCount =
            safeArray(
                closure.errors
            ).length;

        const warningCount =
            safeArray(
                closure.warnings
            ).length;

        if (
            errorCount > 0 ||
            warningCount > 0
        ) {
            return FINALIZATION_RESULT.PARTIAL;
        }

        return FINALIZATION_RESULT.SUCCESS;
    }

    function createPublicationError(
        message,
        stage,
        originalError = null
    ) {
        return {
            stage:
                stage ||
                "publication",

            message:
                message ||
                "Closure publication failed.",

            originalError:
                originalError
                    ? normalizeClosureError(
                        originalError
                    )
                    : null,

            timestamp:
                Date.now()
        };
    }

    /* ======================================================================
       SECTION 48
       EXECUTE WITH TIMEOUT
       ====================================================================== */

    ClosureClass.prototype.executeWithTimeout =
        async function executeWithTimeout(
            operation,
            timeoutMs,
            errorCode =
                "CLOSURE_TIMEOUT"
        ) {
            let timeoutId =
                null;

            const timeoutPromise =
                new Promise(
                    (
                        resolve,
                        reject
                    ) => {
                        timeoutId =
                            global.setTimeout(
                                () => {
                                    reject(
                                        createClosureError(
                                            `Closure operation exceeded ${timeoutMs} ms.`,
                                            errorCode
                                        )
                                    );
                                },
                                timeoutMs
                            );
                    }
                );

            try {
                return await Promise.race([
                    Promise.resolve(
                        typeof operation ===
                        "function"
                            ? operation()
                            : operation
                    ),
                    timeoutPromise
                ]);
            } finally {
                if (timeoutId) {
                    global.clearTimeout(
                        timeoutId
                    );
                }
            }
        };

    /* ======================================================================
       SECTION 49
       ADD CLOSURE WARNING
       ====================================================================== */

    ClosureClass.prototype.addWarning =
        function addWarning(
            message,
            code =
                "CLOSURE_WARNING",
            metadata = {}
        ) {
            const closure =
                this.state
                    .activeClosure;

            if (!closure) {
                return null;
            }

            const warning = {
                code,

                message:
                    message ||
                    "Closure warning.",

                metadata:
                    deepClone(
                        safeObject(metadata)
                    ),

                timestamp:
                    Date.now()
            };

            closure.warnings.push(
                warning
            );

            if (
                closure.warnings.length >
                DEFAULT_MAX_FINAL_WARNINGS
            ) {
                closure.warnings =
                    closure.warnings
                        .slice(
                            -DEFAULT_MAX_FINAL_WARNINGS
                        );
            }

            return warning;
        };

    /* ======================================================================
       SECTION 50
       ADD CLOSURE ERROR
       ====================================================================== */

    ClosureClass.prototype.addError =
        function addError(
            error,
            stage =
                "unknown"
        ) {
            const closure =
                this.state
                    .activeClosure;

            if (!closure) {
                return null;
            }

            const normalized =
                normalizeClosureError(
                    error
                );

            normalized.stage =
                stage;

            closure.errors.push(
                normalized
            );

            if (
                closure.errors.length >
                DEFAULT_MAX_FINAL_ERRORS
            ) {
                closure.errors =
                    closure.errors
                        .slice(
                            -DEFAULT_MAX_FINAL_ERRORS
                        );
            }

            this.state.lastError =
                deepClone(
                    normalized
                );

            return normalized;
        };

    /* ======================================================================
       SECTION 51
       BUILD CLOSURE QUALITY SUMMARY
       ====================================================================== */

    ClosureClass.prototype.buildClosureQualitySummary =
        function buildClosureQualitySummary(
            closure =
                this.state
                    .activeClosure
        ) {
            if (!closure) {
                return null;
            }

            const activePredictions = [
                ...safeArray(
                    closure.data
                        .rainingNowPredictions
                ),

                ...safeArray(
                    closure.data
                        .activePredictions
                ),

                ...safeArray(
                    closure.data
                        .possiblePredictions
                )
            ];

            const qualityScores =
                activePredictions
                    .map(
                        (prediction) => {
                            return toFiniteNumber(
                                prediction
                                    ?.quality
                                    ?.score,
                                prediction
                                    ?.confidence ||
                                NaN
                            );
                        }
                    )
                    .filter(
                        Number.isFinite
                    );

            const confidenceScores =
                activePredictions
                    .map(
                        (prediction) => {
                            return toFiniteNumber(
                                prediction
                                    ?.confidence,
                                NaN
                            );
                        }
                    )
                    .filter(
                        Number.isFinite
                    );

            const averageQuality =
                qualityScores.length
                    ? qualityScores.reduce(
                        (
                            total,
                            value
                        ) => {
                            return (
                                total +
                                value
                            );
                        },
                        0
                    ) /
                    qualityScores.length
                    : 0;

            const averageConfidence =
                confidenceScores.length
                    ? confidenceScores.reduce(
                        (
                            total,
                            value
                        ) => {
                            return (
                                total +
                                value
                            );
                        },
                        0
                    ) /
                    confidenceScores.length
                    : 0;

            const qualityGrades = {
                A: 0,
                B: 0,
                C: 0,
                D: 0,
                F: 0,
                unknown: 0
            };

            activePredictions.forEach(
                (prediction) => {
                    const grade =
                        prediction
                            ?.quality
                            ?.grade;

                    if (
                        Object.prototype
                            .hasOwnProperty
                            .call(
                                qualityGrades,
                                grade
                            )
                    ) {
                        qualityGrades[
                            grade
                        ] += 1;
                    } else {
                        qualityGrades
                            .unknown += 1;
                    }
                }
            );

            return {
                predictionCount:
                    activePredictions.length,

                averageQuality:
                    clamp(
                        averageQuality,
                        0,
                        1
                    ),

                averageConfidence:
                    clamp(
                        averageConfidence,
                        0,
                        1
                    ),

                minimumQuality:
                    qualityScores.length
                        ? Math.min(
                            ...qualityScores
                        )
                        : 0,

                maximumQuality:
                    qualityScores.length
                        ? Math.max(
                            ...qualityScores
                        )
                        : 0,

                minimumConfidence:
                    confidenceScores.length
                        ? Math.min(
                            ...confidenceScores
                        )
                        : 0,

                maximumConfidence:
                    confidenceScores.length
                        ? Math.max(
                            ...confidenceScores
                        )
                        : 0,

                qualityGrades,

                correctedPredictionCount:
                    activePredictions.filter(
                        (prediction) => {
                            return (
                                prediction
                                    .corrected ===
                                true
                            );
                        }
                    ).length,

                generatedAt:
                    Date.now()
            };
        };

    /* ======================================================================
       SECTION 52
       BUILD CLOSURE RISK SUMMARY
       ====================================================================== */

    ClosureClass.prototype.buildClosureRiskSummary =
        function buildClosureRiskSummary() {
            const core =
                this.core;

            const dashboard =
                safeObject(
                    core.state
                        .nationalArrivalDashboard
                );

            const dashboardSummary =
                safeObject(
                    dashboard.summary
                );

            const regions =
                safeArray(
                    core.state
                        .regionSummaries
                );

            const governorates =
                safeArray(
                    core.state
                        .governorateSummaries
                );

            const highestRiskRegion =
                regions
                    .slice()
                    .sort(
                        (
                            first,
                            second
                        ) => {
                            return (
                                toFiniteNumber(
                                    second.riskScore,
                                    0
                                ) -
                                toFiniteNumber(
                                    first.riskScore,
                                    0
                                )
                            );
                        }
                    )[0] ||
                null;

            const highestRiskGovernorate =
                governorates
                    .slice()
                    .sort(
                        (
                            first,
                            second
                        ) => {
                            return (
                                toFiniteNumber(
                                    second.riskScore,
                                    0
                                ) -
                                toFiniteNumber(
                                    first.riskScore,
                                    0
                                )
                            );
                        }
                    )[0] ||
                null;

            return {
                nationalRiskLevel:
                    dashboardSummary
                        .nationalRiskLevel ||
                    highestRiskRegion
                        ?.riskLevel ||
                    "none",

                nationalRiskScore:
                    clamp(
                        toFiniteNumber(
                            dashboardSummary
                                .nationalRiskScore,
                            highestRiskRegion
                                ?.riskScore ||
                            0
                        ),
                        0,
                        1
                    ),

                nationalMaximumIntensity:
                    Math.max(
                        0,
                        toFiniteNumber(
                            dashboardSummary
                                .nationalMaximumIntensity,
                            0
                        )
                    ),

                affectedRegionCount:
                    toFiniteNumber(
                        dashboardSummary
                            .affectedRegionCount,
                        regions.length
                    ),

                affectedGovernorateCount:
                    toFiniteNumber(
                        dashboardSummary
                            .affectedGovernorateCount,
                        governorates.length
                    ),

                highestRiskRegion:
                    highestRiskRegion
                        ? deepClone(
                            highestRiskRegion
                        )
                        : null,

                highestRiskGovernorate:
                    highestRiskGovernorate
                        ? deepClone(
                            highestRiskGovernorate
                        )
                        : null,

                generatedAt:
                    Date.now()
            };
        };

    /* ======================================================================
       SECTION 53
       BUILD CLOSURE ENGINE SUMMARY
       ====================================================================== */

    ClosureClass.prototype.buildClosureEngineSummary =
        function buildClosureEngineSummary() {
            const lifecycleStatus =
                typeof this.core
                    .getLifecycleStatus ===
                "function"
                    ? this.core
                        .getLifecycleStatus()
                    : null;

            const engineHealth =
                typeof this.core
                    .getEngineHealth ===
                "function"
                    ? this.core
                        .getEngineHealth()
                    : null;

            const sourceHealth =
                typeof this.core
                    .getSourcesHealth ===
                "function"
                    ? this.core
                        .getSourcesHealth()
                    : [];

            return {
                lifecycleStatus:
                    lifecycleStatus
                        ?.status ||
                    "unknown",

                engineRunning:
                    lifecycleStatus
                        ?.isRunning ===
                    true,

                cycleRunning:
                    lifecycleStatus
                        ?.isCycleRunning ===
                    true,

                engineHealth:
                    engineHealth
                        ?.status ||
                    "unknown",

                activeSourceCount:
                    sourceHealth.filter(
                        (source) => {
                            return (
                                source.status ===
                                "healthy"
                            );
                        }
                    ).length,

                degradedSourceCount:
                    sourceHealth.filter(
                        (source) => {
                            return (
                                source.status ===
                                "degraded"
                            );
                        }
                    ).length,

                unhealthySourceCount:
                    sourceHealth.filter(
                        (source) => {
                            return (
                                source.status ===
                                "unhealthy"
                            );
                        }
                    ).length,

                registeredLocationCount:
                    this.core.locations
                        ?.size ||
                    0,

                activeCellCount:
                    this.core.cells
                        ?.size ||
                    0,

                activePredictionCount:
                    safeArray(
                        this.core.state
                            .arrivalPredictions
                    ).length,

                generatedAt:
                    Date.now()
            };
        };

    /* ======================================================================
       SECTION 54
       BUILD FINAL CLOSURE SUMMARY
       ====================================================================== */

    ClosureClass.prototype.buildFinalClosureSummary =
        function buildFinalClosureSummary(
            closure =
                this.state
                    .activeClosure
        ) {
            if (!closure) {
                throw createClosureError(
                    "No active closure exists for summary generation.",
                    "NO_ACTIVE_CLOSURE"
                );
            }

            const quality =
                this.buildClosureQualitySummary(
                    closure
                );

            const risk =
                this.buildClosureRiskSummary();

            const engine =
                this.buildClosureEngineSummary();

            const successRatio =
                calculateClosureSuccessRatio(
                    closure
                );

            const finalResult =
                determineClosureResult(
                    closure
                );

            const summary = {
                closureId:
                    closure.id,

                reason:
                    closure.reason,

                status:
                    closure.status,

                result:
                    finalResult,

                startedAt:
                    closure.startedAt,

                completedAt:
                    closure.completedAt ||
                    Date.now(),

                durationMs:
                    closure.durationMs ||
                    calculateClosureDuration(
                        closure
                    ),

                successRatio,

                input:
                    deepClone(
                        closure.input
                    ),

                output:
                    deepClone(
                        closure.output
                    ),

                quality,

                risk,

                engine,

                cleanup:
                    closure.cleanupResult
                        ? deepClone(
                            closure.cleanupResult
                        )
                        : null,

                synchronization:
                    closure
                        .synchronizationResult
                        ? deepClone(
                            closure
                                .synchronizationResult
                        )
                        : null,

                errorCount:
                    safeArray(
                        closure.errors
                    ).length,

                warningCount:
                    safeArray(
                        closure.warnings
                    ).length,

                generatedAt:
                    Date.now()
            };

            closure.finalSummary =
                deepClone(
                    summary
                );

            return summary;
        };

    /* ======================================================================
       SECTION 55
       BUILD FINAL CLOSURE PAYLOAD
       ====================================================================== */

    ClosureClass.prototype.buildFinalClosurePayload =
        function buildFinalClosurePayload(
            closure =
                this.state
                    .activeClosure,
            options = {}
        ) {
            if (!closure) {
                throw createClosureError(
                    "No active closure exists for final payload generation.",
                    "NO_ACTIVE_CLOSURE"
                );
            }

            const safeOptions =
                safeObject(options);

            const frontendPayload =
                typeof this.core
                    .buildFrontendPayload ===
                "function"
                    ? this.core
                        .buildFrontendPayload(
                            safeOptions.frontend ||
                            {}
                        )
                    : null;

            const legacyPayload =
                typeof this.core
                    .buildLegacyRainArrivalResponse ===
                "function"
                    ? this.core
                        .buildLegacyRainArrivalResponse(
                            safeOptions.frontend ||
                            {}
                        )
                    : null;

            const finalSummary =
                this.buildFinalClosureSummary(
                    closure
                );

            const payload = {
                success:
                    closure.status !==
                    CLOSURE_STATUS.FAILED,

                schema:
                    FINAL_PAYLOAD_SCHEMA,

                schemaVersion:
                    FINAL_PAYLOAD_VERSION,

                closureVersion:
                    this.version,

                generatedAt:
                    Date.now(),

                generatedIso:
                    new Date()
                        .toISOString(),

                closure: {
                    id:
                        closure.id,

                    reason:
                        closure.reason,

                    status:
                        closure.status,

                    result:
                        determineClosureResult(
                            closure
                        ),

                    startedAt:
                        closure.startedAt,

                    completedAt:
                        closure.completedAt,

                    durationMs:
                        closure.durationMs
                },

                summary:
                    deepClone(
                        finalSummary
                    ),

                predictions: {
                    rainingNow:
                        deepClone(
                            closure.data
                                .rainingNowPredictions
                        ),

                    active:
                        deepClone(
                            closure.data
                                .activePredictions
                        ),

                    possible:
                        deepClone(
                            closure.data
                                .possiblePredictions
                        ),

                    expiredCount:
                        closure.data
                            .expiredPredictions
                            .length,

                    rejectedCount:
                        closure.data
                            .rejectedPredictions
                            .length,

                    closedCount:
                        closure.data
                            .closedPredictions
                            .length
                },

                cells: {
                    active:
                        deepClone(
                            closure.data
                                .activeCells
                        ),

                    lostCount:
                        closure.data
                            .lostCells
                            .length,

                    dissipatedCount:
                        closure.data
                            .dissipatedCells
                            .length,

                    expiredCount:
                        closure.data
                            .expiredCells
                            .length
                },

                archive:
                    typeof this
                        .getArchiveSummary ===
                    "function"
                        ? this
                            .getArchiveSummary()
                        : null,

                frontend:
                    frontendPayload
                        ? deepClone(
                            frontendPayload
                        )
                        : null,

                legacy:
                    legacyPayload
                        ? deepClone(
                            legacyPayload
                        )
                        : null,

                errors:
                    deepClone(
                        safeArray(
                            closure.errors
                        )
                    ),

                warnings:
                    deepClone(
                        safeArray(
                            closure.warnings
                        )
                    )
            };

            closure.finalPayload =
                deepClone(
                    payload
                );

            return payload;
        };

    /* ======================================================================
       SECTION 56
       PUBLISH FINAL PAYLOAD
       ====================================================================== */

    ClosureClass.prototype.publishFinalPayload =
        async function publishFinalPayload(
            closure =
                this.state
                    .activeClosure,
            options = {}
        ) {
            if (!closure) {
                throw createClosureError(
                    "No active closure exists for publication.",
                    "NO_ACTIVE_CLOSURE"
                );
            }

            this.setStatus(
                CLOSURE_STATUS.PUBLISHING,
                {
                    closureId:
                        closure.id
                }
            );

            this.updateStage(
                "building_final_payload"
            );

            const payload =
                this.buildFinalClosurePayload(
                    closure,
                    options
                );

            this.updateStage(
                "publishing_final_payload"
            );

            try {
                global
                    .RainArrivalRecoveryClosureDataV32 =
                    deepClone(
                        payload
                    );

                global
                    .RainGuardRecoveryClosureData =
                    global
                        .RainArrivalRecoveryClosureDataV32;

                global
                    .latestRainArrivalClosureV32 =
                    global
                        .RainArrivalRecoveryClosureDataV32;

                if (
                    payload.frontend
                ) {
                    global
                        .RainGuardArrivalDataV32 =
                        deepClone(
                            payload.frontend
                        );
                }

                if (
                    payload.legacy
                ) {
                    global
                        .RainGuardLegacyRainArrivalData =
                        deepClone(
                            payload.legacy
                        );
                }

                if (
                    typeof global
                        .dispatchEvent ===
                    "function" &&
                    typeof global
                        .CustomEvent ===
                    "function"
                ) {
                    global.dispatchEvent(
                        new CustomEvent(
                            "rainguard:recovery-closure-completed",
                            {
                                detail:
                                    deepClone(
                                        payload
                                    )
                            }
                        )
                    );
                }

                if (
                    typeof this.core.emit ===
                    "function"
                ) {
                    this.core.emit(
                        CORE_EVENTS
                            .CLOSURE_PUBLISHED ||
                        "closure_published",
                        {
                            closureId:
                                closure.id,

                            payload:
                                deepClone(
                                    payload
                                ),

                            timestamp:
                                Date.now()
                        }
                    );
                }

                this.updateStage(
                    "final_payload_published",
                    {
                        generatedAt:
                            payload.generatedAt
                    }
                );

                return {
                    published:
                        true,

                    payload
                };
            } catch (error) {
                const publicationError =
                    createPublicationError(
                        "Unable to publish the recovery closure payload.",
                        "publish_final_payload",
                        error
                    );

                closure.errors.push(
                    publicationError
                );

                return {
                    published:
                        false,

                    payload,

                    error:
                        publicationError
                };
            }
        };

    /* ======================================================================
       SECTION 57
       COMPLETE CLOSURE
       ====================================================================== */

    ClosureClass.prototype.completeClosure =
        function completeClosure(
            closure =
                this.state
                    .activeClosure,
            options = {}
        ) {
            if (!closure) {
                throw createClosureError(
                    "No active closure exists for completion.",
                    "NO_ACTIVE_CLOSURE"
                );
            }

            closure.completedAt =
                Date.now();

            closure.durationMs =
                calculateClosureDuration(
                    closure
                );

            const hasErrors =
                safeArray(
                    closure.errors
                ).length >
                0;

            const hasWarnings =
                safeArray(
                    closure.warnings
                ).length >
                0;

            if (hasErrors) {
                closure.status =
                    CLOSURE_STATUS.PARTIAL;

                this.state
                    .partialClosures += 1;
            } else if (
                hasWarnings
            ) {
                closure.status =
                    CLOSURE_STATUS.PARTIAL;

                this.state
                    .partialClosures += 1;
            } else {
                closure.status =
                    CLOSURE_STATUS.COMPLETED;

                this.state
                    .successfulClosures += 1;
            }

            this.state
                .totalClosures += 1;

            this.state
                .lastClosureAt =
                closure.completedAt;

            this.state
                .lastClosure =
                deepClone(
                    closure
                );

            this.state
                .closureHistory
                .push(
                    deepClone(
                        closure
                    )
                );

            if (
                this.state
                    .closureHistory
                    .length >
                this.options
                    .maximumClosureHistory
            ) {
                this.state
                    .closureHistory =
                    this.state
                        .closureHistory
                        .slice(
                            -this.options
                                .maximumClosureHistory
                        );
            }

            this.state
                .activeClosure =
                null;

            this.setStatus(
                closure.status,
                {
                    closureId:
                        closure.id,

                    durationMs:
                        closure.durationMs
                }
            );

            if (
                this.core.state
                    .closure
            ) {
                this.core.state
                    .closure
                    .status =
                    closure.status;

                this.core.state
                    .closure
                    .lastClosureId =
                    closure.id;

                this.core.state
                    .closure
                    .lastClosureAt =
                    closure.completedAt;

                this.core.state
                    .closure
                    .lastClosureSummary =
                    deepClone(
                        closure.finalSummary ||
                        {
                            input:
                                closure.input,

                            output:
                                closure.output,

                            durationMs:
                                closure.durationMs
                        }
                    );
            }

            if (
                typeof this.core.emit ===
                "function"
            ) {
                this.core.emit(
                    CORE_EVENTS
                        .CLOSURE_COMPLETED ||
                    "closure_completed",
                    {
                        closure:
                            deepClone(
                                closure
                            ),

                        timestamp:
                            Date.now()
                    }
                );
            }

            return deepClone(
                closure
            );
        };

    /* ======================================================================
       SECTION 58
       FAIL CLOSURE
       ====================================================================== */

    ClosureClass.prototype.failClosure =
        function failClosure(
            error,
            stage =
                "unknown"
        ) {
            const closure =
                this.state
                    .activeClosure;

            if (!closure) {
                throw createClosureError(
                    "No active closure exists for failure handling.",
                    "NO_ACTIVE_CLOSURE"
                );
            }

            const normalizedError =
                this.addError(
                    error,
                    stage
                );

            closure.status =
                CLOSURE_STATUS.FAILED;

            closure.completedAt =
                Date.now();

            closure.durationMs =
                calculateClosureDuration(
                    closure
                );

            closure.currentStage =
                "failed";

            this.state
                .totalClosures += 1;

            this.state
                .failedClosures += 1;

            this.state
                .lastClosureAt =
                closure.completedAt;

            this.state
                .lastClosure =
                deepClone(
                    closure
                );

            this.state
                .lastError =
                deepClone(
                    normalizedError
                );

            this.state
                .closureHistory
                .push(
                    deepClone(
                        closure
                    )
                );

            if (
                this.state
                    .closureHistory
                    .length >
                this.options
                    .maximumClosureHistory
            ) {
                this.state
                    .closureHistory =
                    this.state
                        .closureHistory
                        .slice(
                            -this.options
                                .maximumClosureHistory
                        );
            }

            this.state
                .activeClosure =
                null;

            this.setStatus(
                CLOSURE_STATUS.FAILED,
                {
                    closureId:
                        closure.id,

                    error:
                        normalizedError
                }
            );

            if (
                typeof this.core.emit ===
                "function"
            ) {
                this.core.emit(
                    CORE_EVENTS
                        .CLOSURE_FAILED ||
                    "closure_failed",
                    {
                        closure:
                            deepClone(
                                closure
                            ),

                        error:
                            deepClone(
                                normalizedError
                            ),

                        timestamp:
                            Date.now()
                    }
                );
            }

            return {
                success:
                    false,

                status:
                    CLOSURE_STATUS.FAILED,

                closure:
                    deepClone(
                        closure
                    ),

                error:
                    deepClone(
                        normalizedError
                    )
            };
        };

    /* ======================================================================
       SECTION 59
       ABORT CLOSURE
       ====================================================================== */

    ClosureClass.prototype.abortClosure =
        function abortClosure(
            reason =
                "Closure operation aborted."
        ) {
            const closure =
                this.state
                    .activeClosure;

            if (!closure) {
                return {
                    aborted:
                        false,

                    reason:
                        "no_active_closure"
                };
            }

            if (
                this.abortController &&
                typeof this
                    .abortController
                    .abort ===
                "function"
            ) {
                this.abortController
                    .abort();
            }

            closure.status =
                CLOSURE_STATUS.ABORTED;

            closure.completedAt =
                Date.now();

            closure.durationMs =
                calculateClosureDuration(
                    closure
                );

            closure.currentStage =
                "aborted";

            closure.warnings.push({
                code:
                    "CLOSURE_ABORTED",

                message:
                    reason,

                timestamp:
                    Date.now()
            });

            this.state
                .totalClosures += 1;

            this.state
                .partialClosures += 1;

            this.state
                .lastClosure =
                deepClone(
                    closure
                );

            this.state
                .lastClosureAt =
                closure.completedAt;

            this.state
                .closureHistory
                .push(
                    deepClone(
                        closure
                    )
                );

            this.state
                .activeClosure =
                null;

            this.abortController =
                null;

            this.setStatus(
                CLOSURE_STATUS.ABORTED,
                {
                    closureId:
                        closure.id,

                    reason
                }
            );

            if (
                typeof this.core.emit ===
                "function"
            ) {
                this.core.emit(
                    CORE_EVENTS
                        .CLOSURE_ABORTED ||
                    "closure_aborted",
                    {
                        closureId:
                            closure.id,

                        reason,

                        timestamp:
                            Date.now()
                    }
                );
            }

            return {
                aborted:
                    true,

                closure:
                    deepClone(
                        closure
                    )
            };
        };

    /* ======================================================================
       SECTION 60
       EXECUTE FULL CLOSURE PIPELINE
       ====================================================================== */

    ClosureClass.prototype.executeClosure =
        async function executeClosure(
            options = {}
        ) {
            const safeOptions =
                safeObject(options);

            const reason =
                safeOptions.reason ||
                CLOSURE_REASON.NORMAL_CYCLE;

            let closure =
                null;

            try {
                closure =
                    this.prepareClosure(
                        reason,
                        safeOptions.metadata ||
                        {}
                    );

                if (
                    typeof AbortController ===
                    "function"
                ) {
                    this.abortController =
                        new AbortController();
                }

                const closureOperation =
                    async () => {
                        this.setStatus(
                            CLOSURE_STATUS.VALIDATING,
                            {
                                closureId:
                                    closure.id
                            }
                        );

                        this.updateStage(
                            "validating_current_state"
                        );

                        if (
                            safeOptions
                                .runQualityControl !==
                            false &&
                            typeof this.core
                                .executePredictionQualityControl ===
                            "function"
                        ) {
                            try {
                                const qualityResult =
                                    this.core
                                        .executePredictionQualityControl(
                                            safeOptions.quality ||
                                            {}
                                        );

                                closure.qualityControlResult =
                                    deepClone(
                                        qualityResult
                                    );
                            } catch (error) {
                                this.addWarning(
                                    error?.message ||
                                    "Prediction quality control failed during closure.",
                                    "QUALITY_CONTROL_FAILED"
                                );
                            }
                        }

                        this.updateStage(
                            "consolidating_closure_data"
                        );

                        this.consolidateClosureData(
                            closure
                        );

                        this.updateStage(
                            "executing_cleanup_and_synchronization"
                        );

                        this.executeCleanupAndSynchronization(
                            closure,
                            safeOptions
                        );

                        this.updateStage(
                            "preparing_publication"
                        );

                        let publication = {
                            published:
                                false,

                            payload:
                                null
                        };

                        if (
                            this.options
                                .publishFinalPayload &&
                            safeOptions
                                .publishFinalPayload !==
                            false
                        ) {
                            publication =
                                await this
                                    .executeWithTimeout(
                                        () => {
                                            return this
                                                .publishFinalPayload(
                                                    closure,
                                                    safeOptions
                                                );
                                        },
                                        Math.max(
                                            1000,
                                            toFiniteNumber(
                                                safeOptions
                                                    .publicationTimeoutMs,
                                                DEFAULT_FINAL_PUBLICATION_TIMEOUT_MS
                                            )
                                        ),
                                        "CLOSURE_PUBLICATION_TIMEOUT"
                                    );

                            if (
                                !publication.published
                            ) {
                                this.addWarning(
                                    publication
                                        ?.error
                                        ?.message ||
                                    "The closure completed but the final payload was not published.",
                                    "FINAL_PAYLOAD_NOT_PUBLISHED"
                                );
                            }
                        }

                        closure.publicationResult =
                            deepClone(
                                publication
                            );

                        this.updateStage(
                            "closure_ready_for_completion"
                        );

                        const completedClosure =
                            this.completeClosure(
                                closure,
                                safeOptions
                            );

                        return {
                            success:
                                completedClosure.status ===
                                CLOSURE_STATUS.COMPLETED,

                            status:
                                completedClosure.status,

                            closure:
                                completedClosure,

                            payload:
                                publication.payload
                                    ? deepClone(
                                        publication.payload
                                    )
                                    : deepClone(
                                        completedClosure
                                            .finalPayload
                                    )
                        };
                    };

                const result =
                    await this.executeWithTimeout(
                        closureOperation,
                        Math.max(
                            5000,
                            toFiniteNumber(
                                safeOptions
                                    .closureTimeoutMs,
                                this.options
                                    .closureTimeoutMs
                            )
                        ),
                        "FULL_CLOSURE_TIMEOUT"
                    );

                this.abortController =
                    null;

                return result;
            } catch (error) {
                this.abortController =
                    null;

                if (
                    this.state.activeClosure
                ) {
                    return this.failClosure(
                        error,
                        this.state
                            .activeClosure
                            .currentStage ||
                        "execute_closure"
                    );
                }

                return {
                    success:
                        false,

                    status:
                        CLOSURE_STATUS.FAILED,

                    closure:
                        closure
                            ? deepClone(
                                closure
                            )
                            : null,

                    error:
                        normalizeClosureError(
                            error
                        )
                };
            }
        };

    /* ======================================================================
       SECTION 61
       MANUAL CLOSURE
       ====================================================================== */

    ClosureClass.prototype.runManualClosure =
        async function runManualClosure(
            options = {}
        ) {
            return this.executeClosure({
                ...safeObject(options),

                reason:
                    CLOSURE_REASON.MANUAL
            });
        };

    /* ======================================================================
       SECTION 62
       NORMAL CYCLE CLOSURE
       ====================================================================== */

    ClosureClass.prototype.runCycleClosure =
        async function runCycleClosure(
            options = {}
        ) {
            return this.executeClosure({
                ...safeObject(options),

                reason:
                    CLOSURE_REASON.NORMAL_CYCLE
            });
        };

    /* ======================================================================
       SECTION 63
       RECOVERY CLOSURE
       ====================================================================== */

    ClosureClass.prototype.runRecoveryClosure =
        async function runRecoveryClosure(
            options = {}
        ) {
            return this.executeClosure({
                ...safeObject(options),

                reason:
                    CLOSURE_REASON.RECOVERY
            });
        };

    /* ======================================================================
       SECTION 64
       STOP CLOSURE
       ====================================================================== */

    ClosureClass.prototype.runStopClosure =
        async function runStopClosure(
            options = {}
        ) {
            return this.executeClosure({
                ...safeObject(options),

                reason:
                    CLOSURE_REASON.ENGINE_STOP
            });
        };

    /* ======================================================================
       SECTION 65
       RESTART CLOSURE
       ====================================================================== */

    ClosureClass.prototype.runRestartClosure =
        async function runRestartClosure(
            options = {}
        ) {
            return this.executeClosure({
                ...safeObject(options),

                reason:
                    CLOSURE_REASON.ENGINE_RESTART
            });
        };

    /* ======================================================================
       SECTION 66
       GET CLOSURE HISTORY
       ====================================================================== */

    ClosureClass.prototype.getClosureHistory =
        function getClosureHistory(
            limit = 20
        ) {
            const safeLimit =
                clamp(
                    Math.round(
                        toFiniteNumber(
                            limit,
                            20
                        )
                    ),
                    1,
                    this.options
                        .maximumClosureHistory
                );

            return deepClone(
                safeArray(
                    this.state
                        .closureHistory
                )
                    .slice(
                        -safeLimit
                    )
                    .reverse()
            );
        };

    /* ======================================================================
       SECTION 67
       GET LAST CLOSURE
       ====================================================================== */

    ClosureClass.prototype.getLastClosure =
        function getLastClosure() {
            return this.state
                .lastClosure
                ? deepClone(
                    this.state
                        .lastClosure
                )
                : null;
        };

    /* ======================================================================
       SECTION 68
       GET FINAL PAYLOAD
       ====================================================================== */

    ClosureClass.prototype.getFinalPayload =
        function getFinalPayload() {
            const source =
                this.state
                    .activeClosure ||
                this.state
                    .lastClosure;

            return source
                ?.finalPayload
                ? deepClone(
                    source.finalPayload
                )
                : null;
        };

    /* ======================================================================
       SECTION 69
       RESET CLOSURE ENGINE
       ====================================================================== */

    ClosureClass.prototype.reset =
        function reset(
            options = {}
        ) {
            const safeOptions =
                safeObject(options);

            if (
                this.state.activeClosure
            ) {
                this.abortClosure(
                    "Closure engine reset."
                );
            }

            this.state.status =
                CLOSURE_STATUS.IDLE;

            this.state.activeClosure =
                null;

            this.state.lastError =
                null;

            if (
                safeOptions
                    .clearHistory ===
                true
            ) {
                this.state
                    .closureHistory = [];

                this.state
                    .lastClosure =
                    null;

                this.state
                    .totalClosures =
                    0;

                this.state
                    .successfulClosures =
                    0;

                this.state
                    .partialClosures =
                    0;

                this.state
                    .failedClosures =
                    0;
            }

            if (
                safeOptions
                    .clearArchives ===
                true &&
                typeof this
                    .clearArchives ===
                "function"
            ) {
                this.clearArchives();
            }

            if (
                this.core.state
                    .closure
            ) {
                this.core.state
                    .closure
                    .status =
                    CLOSURE_STATUS.IDLE;

                this.core.state
                    .closure
                    .updatedAt =
                    Date.now();
            }

            return this.getStatus();
        };

    /* ======================================================================
       SECTION 70
       DESTROY CLOSURE ENGINE
       ====================================================================== */

    ClosureClass.prototype.destroy =
        function destroy() {
            if (this.destroyed) {
                return false;
            }

            if (
                this.state.activeClosure
            ) {
                this.abortClosure(
                    "Closure engine destroyed."
                );
            }

            if (
                this.core.recoveryClosure ===
                this
            ) {
                this.core.recoveryClosure =
                    null;
            }

            if (
                this.core.recoveryClosureV32 ===
                this
            ) {
                this.core
                    .recoveryClosureV32 =
                    null;
            }

            this.abortController =
                null;

            this.destroyed =
                true;

            this.state.status =
                CLOSURE_STATUS.IDLE;

            return true;
        };

    /* ======================================================================
       SECTION 71
       GLOBAL CLOSURE API
       ====================================================================== */

    const ClosureApi = {
        getInstance() {
            const core =
                global
                    .rainArrivalRecoveryCoreV32 ||
                global
                    .RainArrivalRecoveryCoreV32Instance ||
                global
                    .rainGuardArrivalCore ||
                null;

            if (!core) {
                return null;
            }

            return (
                core.recoveryClosureV32 ||
                core.recoveryClosure ||
                null
            );
        },

        requireInstance() {
            const instance =
                this.getInstance();

            if (!instance) {
                throw new Error(
                    "No active RainArrivalRecoveryClosureV32 instance was found."
                );
            }

            return instance;
        },

        async run(options = {}) {
            return this
                .requireInstance()
                .executeClosure(
                    options
                );
        },

        async runManual(
            options = {}
        ) {
            return this
                .requireInstance()
                .runManualClosure(
                    options
                );
        },

        async runRecovery(
            options = {}
        ) {
            return this
                .requireInstance()
                .runRecoveryClosure(
                    options
                );
        },

        abort(reason) {
            return this
                .requireInstance()
                .abortClosure(
                    reason
                );
        },

        getStatus() {
            return this
                .requireInstance()
                .getStatus();
        },

        getHistory(
            limit = 20
        ) {
            return this
                .requireInstance()
                .getClosureHistory(
                    limit
                );
        },

        getLastClosure() {
            return this
                .requireInstance()
                .getLastClosure();
        },

        getPayload() {
            return this
                .requireInstance()
                .getFinalPayload();
        },

        getArchiveSummary() {
            return this
                .requireInstance()
                .getArchiveSummary();
        }
    };

    global.RainArrivalRecoveryClosureAPI =
        ClosureApi;

    global.RainGuardRecoveryClosureAPI =
        ClosureApi;

    /* ======================================================================
       SECTION 72
       COMPATIBILITY ALIASES
       ====================================================================== */

    ClosureClass.prototype.run =
        ClosureClass.prototype
            .executeClosure;

    ClosureClass.prototype.close =
        ClosureClass.prototype
            .executeClosure;

    ClosureClass.prototype.finalize =
        ClosureClass.prototype
            .executeClosure;

    ClosureClass.prototype.finish =
        ClosureClass.prototype
            .completeClosure;

    ClosureClass.prototype.publish =
        ClosureClass.prototype
            .publishFinalPayload;

    ClosureClass.prototype.getHistory =
        ClosureClass.prototype
            .getClosureHistory;

    /* ======================================================================
       SECTION 73
       PART 3 EXPORT
       ====================================================================== */

    global.RainArrivalRecoveryClosureV32Part3 = {
        DEFAULT_FINAL_PUBLICATION_TIMEOUT_MS,
        DEFAULT_MAX_FINAL_WARNINGS,
        DEFAULT_MAX_FINAL_ERRORS,
        FINALIZATION_RESULT,
        FINAL_PAYLOAD_SCHEMA,
        FINAL_PAYLOAD_VERSION,
        calculateClosureDuration,
        calculateClosureSuccessRatio,
        determineClosureResult,
        createPublicationError,
        ClosureApi
    };

})(window);

  /* ==========================================================================
   RainGuard AI
   Long Horizon Forecast Engine V32

   Recovery Closure Engine V32

   PART 4
   Automatic Integration + Cycle Hooks + Stop/Restart Hooks +
   Concurrency Protection + Recovery Hooks
   ========================================================================== */

(function extendRainArrivalRecoveryClosureV32Part4(global) {
    "use strict";

    /* ======================================================================
       SECTION 74
       DEPENDENCY RESOLUTION
       ====================================================================== */

    const CoreClass =
        global.RainArrivalRecoveryCoreV32;

    const ClosureClass =
        global.RainArrivalRecoveryClosureV32;

    const ClosureConstants =
        global.RainArrivalRecoveryClosureV32Constants;

    const ClosureUtils =
        global.RainArrivalRecoveryClosureV32Utils;

    const CoreUtils =
        global.RainArrivalRecoveryCoreV32Utils;

    const CoreConstants =
        global.RainArrivalRecoveryCoreV32Constants;

    if (
        typeof CoreClass !== "function" ||
        typeof ClosureClass !== "function" ||
        !ClosureConstants ||
        !ClosureUtils ||
        !CoreUtils ||
        !CoreConstants
    ) {
        throw new Error(
            "RainArrivalRecoveryClosureV32 Parts 1 to 3 must be loaded before Part 4."
        );
    }

    const {
        CLOSURE_STATUS,
        CLOSURE_REASON
    } = ClosureConstants;

    const {
        normalizeClosureError
    } = ClosureUtils;

    const {
        toFiniteNumber,
        safeObject,
        deepClone
    } = CoreUtils;

    const {
        CORE_EVENTS
    } = CoreConstants;

    /* ======================================================================
       SECTION 75
       AUTOMATIC INTEGRATION CONSTANTS
       ====================================================================== */

    const AUTO_CLOSURE_TRIGGER =
        Object.freeze({
            CYCLE_COMPLETE:
                "cycle_complete",

            CYCLE_PARTIAL:
                "cycle_partial",

            CYCLE_FAILED:
                "cycle_failed",

            ENGINE_STOP:
                "engine_stop",

            ENGINE_RESTART:
                "engine_restart",

            RECOVERY_STARTED:
                "recovery_started",

            RECOVERY_COMPLETED:
                "recovery_completed",

            MAINTENANCE:
                "maintenance",

            MANUAL:
                "manual",

            DESTROY:
                "destroy"
        });

    const AUTO_CLOSURE_POLICY =
        Object.freeze({
            ALWAYS:
                "always",

            SUCCESS_ONLY:
                "success_only",

            SUCCESS_AND_PARTIAL:
                "success_and_partial",

            FAILURE_ONLY:
                "failure_only",

            MANUAL_ONLY:
                "manual_only",

            DISABLED:
                "disabled"
        });

    const DEFAULT_AUTO_CLOSURE_DELAY_MS =
        250;

    const DEFAULT_AUTO_CLOSURE_TIMEOUT_MS =
        45 * 1000;

    const DEFAULT_AUTO_CLOSURE_COOLDOWN_MS =
        5 * 1000;

    const DEFAULT_MAX_PENDING_CLOSURES =
        10;

    const DEFAULT_MAX_AUTO_CLOSURE_HISTORY =
        100;

    /* ======================================================================
       SECTION 76
       INTEGRATION HELPERS
       ====================================================================== */

    function createAutoClosureRequestId() {
        return (
            "auto_closure_request_" +
            Date.now() +
            "_" +
            Math.random()
                .toString(36)
                .slice(2, 9)
        );
    }

    function normalizeAutoClosurePolicy(
        policy
    ) {
        const policies =
            Object.values(
                AUTO_CLOSURE_POLICY
            );

        return policies.includes(
            policy
        )
            ? policy
            : AUTO_CLOSURE_POLICY
                .SUCCESS_AND_PARTIAL;
    }

    function normalizeAutoClosureTrigger(
        trigger
    ) {
        const triggers =
            Object.values(
                AUTO_CLOSURE_TRIGGER
            );

        return triggers.includes(
            trigger
        )
            ? trigger
            : AUTO_CLOSURE_TRIGGER
                .MANUAL;
    }

    function normalizeCycleResultStatus(
        result
    ) {
        const status =
            result?.status ||
            result?.cycle?.status ||
            result?.result?.status ||
            "unknown";

        return String(status)
            .trim()
            .toLowerCase();
    }

    function isSuccessfulCycleResult(
        result
    ) {
        const status =
            normalizeCycleResultStatus(
                result
            );

        return [
            "success",
            "completed",
            "complete",
            "ok"
        ].includes(status);
    }

    function isPartialCycleResult(
        result
    ) {
        const status =
            normalizeCycleResultStatus(
                result
            );

        return [
            "partial",
            "degraded",
            "warning",
            "completed_with_warnings"
        ].includes(status);
    }

    function isFailedCycleResult(
        result
    ) {
        const status =
            normalizeCycleResultStatus(
                result
            );

        return [
            "failed",
            "failure",
            "error",
            "timeout",
            "aborted"
        ].includes(status);
    }

    function shouldRunClosureForPolicy(
        policy,
        result
    ) {
        const normalizedPolicy =
            normalizeAutoClosurePolicy(
                policy
            );

        if (
            normalizedPolicy ===
            AUTO_CLOSURE_POLICY.DISABLED ||
            normalizedPolicy ===
            AUTO_CLOSURE_POLICY.MANUAL_ONLY
        ) {
            return false;
        }

        if (
            normalizedPolicy ===
            AUTO_CLOSURE_POLICY.ALWAYS
        ) {
            return true;
        }

        if (
            normalizedPolicy ===
            AUTO_CLOSURE_POLICY.SUCCESS_ONLY
        ) {
            return isSuccessfulCycleResult(
                result
            );
        }

        if (
            normalizedPolicy ===
            AUTO_CLOSURE_POLICY
                .SUCCESS_AND_PARTIAL
        ) {
            return (
                isSuccessfulCycleResult(
                    result
                ) ||
                isPartialCycleResult(
                    result
                )
            );
        }

        if (
            normalizedPolicy ===
            AUTO_CLOSURE_POLICY.FAILURE_ONLY
        ) {
            return isFailedCycleResult(
                result
            );
        }

        return false;
    }

    function mapTriggerToClosureReason(
        trigger
    ) {
        switch (
            normalizeAutoClosureTrigger(
                trigger
            )
        ) {
            case AUTO_CLOSURE_TRIGGER
                .ENGINE_STOP:
                return CLOSURE_REASON
                    .ENGINE_STOP;

            case AUTO_CLOSURE_TRIGGER
                .ENGINE_RESTART:
                return CLOSURE_REASON
                    .ENGINE_RESTART;

            case AUTO_CLOSURE_TRIGGER
                .RECOVERY_STARTED:

            case AUTO_CLOSURE_TRIGGER
                .RECOVERY_COMPLETED:
                return CLOSURE_REASON
                    .RECOVERY;

            case AUTO_CLOSURE_TRIGGER
                .MAINTENANCE:
                return CLOSURE_REASON
                    .MAINTENANCE;

            case AUTO_CLOSURE_TRIGGER
                .CYCLE_FAILED:
                return CLOSURE_REASON
                    .SOURCE_FAILURE;

            case AUTO_CLOSURE_TRIGGER
                .DESTROY:
                return CLOSURE_REASON
                    .DESTROY;

            case AUTO_CLOSURE_TRIGGER
                .MANUAL:
                return CLOSURE_REASON
                    .MANUAL;

            default:
                return CLOSURE_REASON
                    .NORMAL_CYCLE;
        }
    }

    function createAutoClosureRequest(
        trigger,
        options = {}
    ) {
        const safeOptions =
            safeObject(options);

        return {
            id:
                createAutoClosureRequestId(),

            trigger:
                normalizeAutoClosureTrigger(
                    trigger
                ),

            reason:
                safeOptions.reason ||
                mapTriggerToClosureReason(
                    trigger
                ),

            createdAt:
                Date.now(),

            startedAt:
                null,

            completedAt:
                null,

            status:
                "pending",

            priority:
                Math.max(
                    0,
                    Math.round(
                        toFiniteNumber(
                            safeOptions.priority,
                            0
                        )
                    )
                ),

            cycleId:
                safeOptions.cycleId ||
                null,

            source:
                safeOptions.source ||
                "automatic_integration",

            metadata:
                deepClone(
                    safeObject(
                        safeOptions.metadata
                    )
                ),

            options:
                deepClone(
                    safeObject(
                        safeOptions.closureOptions ||
                        safeOptions.options
                    )
                ),

            result:
                null,

            error:
                null
        };
    }

    /* ======================================================================
       SECTION 77
       ENSURE INTEGRATION STATE
       ====================================================================== */

    ClosureClass.prototype.ensureIntegrationState =
        function ensureIntegrationState() {
            if (
                !this.state.integration
            ) {
                this.state.integration = {
                    installed:
                        false,

                    enabled:
                        true,

                    policy:
                        AUTO_CLOSURE_POLICY
                            .SUCCESS_AND_PARTIAL,

                    autoClosureDelayMs:
                        DEFAULT_AUTO_CLOSURE_DELAY_MS,

                    autoClosureTimeoutMs:
                        DEFAULT_AUTO_CLOSURE_TIMEOUT_MS,

                    autoClosureCooldownMs:
                        DEFAULT_AUTO_CLOSURE_COOLDOWN_MS,

                    pendingRequests: [],

                    activeRequest:
                        null,

                    requestHistory: [],

                    processing:
                        false,

                    lastAutomaticClosureAt:
                        null,

                    lastAutomaticClosureTrigger:
                        null,

                    lastAutomaticClosureResult:
                        null,

                    totalAutomaticClosures:
                        0,

                    skippedAutomaticClosures:
                        0,

                    failedAutomaticClosures:
                        0,

                    hookStatus: {
                        runCycle:
                            false,

                        stop:
                            false,

                        restart:
                            false,

                        scheduleRecovery:
                            false,

                        runMaintenance:
                            false,

                        destroy:
                            false
                    }
                };
            }

            return this.state
                .integration;
        };

    /* ======================================================================
       SECTION 78
       CONFIGURE AUTOMATIC CLOSURE
       ====================================================================== */

    ClosureClass.prototype.configureAutomaticClosure =
        function configureAutomaticClosure(
            options = {}
        ) {
            const integration =
                this.ensureIntegrationState();

            const safeOptions =
                safeObject(options);

            if (
                typeof safeOptions.enabled ===
                "boolean"
            ) {
                integration.enabled =
                    safeOptions.enabled;
            }

            if (
                safeOptions.policy
            ) {
                integration.policy =
                    normalizeAutoClosurePolicy(
                        safeOptions.policy
                    );
            }

            if (
                Number.isFinite(
                    Number(
                        safeOptions
                            .autoClosureDelayMs
                    )
                )
            ) {
                integration
                    .autoClosureDelayMs =
                    Math.max(
                        0,
                        toFiniteNumber(
                            safeOptions
                                .autoClosureDelayMs,
                            DEFAULT_AUTO_CLOSURE_DELAY_MS
                        )
                    );
            }

            if (
                Number.isFinite(
                    Number(
                        safeOptions
                            .autoClosureTimeoutMs
                    )
                )
            ) {
                integration
                    .autoClosureTimeoutMs =
                    Math.max(
                        5000,
                        toFiniteNumber(
                            safeOptions
                                .autoClosureTimeoutMs,
                            DEFAULT_AUTO_CLOSURE_TIMEOUT_MS
                        )
                    );
            }

            if (
                Number.isFinite(
                    Number(
                        safeOptions
                            .autoClosureCooldownMs
                    )
                )
            ) {
                integration
                    .autoClosureCooldownMs =
                    Math.max(
                        0,
                        toFiniteNumber(
                            safeOptions
                                .autoClosureCooldownMs,
                            DEFAULT_AUTO_CLOSURE_COOLDOWN_MS
                        )
                    );
            }

            return deepClone(
                integration
            );
        };

    /* ======================================================================
       SECTION 79
       DETECT ACTIVE CLOSURE
       ====================================================================== */

    ClosureClass.prototype.isClosureRunning =
        function isClosureRunning() {
            return Boolean(
                this.state.activeClosure ||
                this.ensureIntegrationState()
                    .processing
            );
        };

    /* ======================================================================
       SECTION 80
       CHECK CLOSURE COOLDOWN
       ====================================================================== */

    ClosureClass.prototype.isAutomaticClosureCooldownActive =
        function isAutomaticClosureCooldownActive() {
            const integration =
                this.ensureIntegrationState();

            if (
                !integration
                    .lastAutomaticClosureAt
            ) {
                return false;
            }

            return (
                Date.now() -
                integration
                    .lastAutomaticClosureAt <
                integration
                    .autoClosureCooldownMs
            );
        };

    /* ======================================================================
       SECTION 81
       ENQUEUE AUTOMATIC CLOSURE
       ====================================================================== */

    ClosureClass.prototype.enqueueAutomaticClosure =
        function enqueueAutomaticClosure(
            trigger,
            options = {}
        ) {
            const integration =
                this.ensureIntegrationState();

            if (
                !integration.enabled ||
                integration.policy ===
                AUTO_CLOSURE_POLICY.DISABLED
            ) {
                integration
                    .skippedAutomaticClosures +=
                    1;

                return {
                    queued:
                        false,

                    reason:
                        "automatic_closure_disabled"
                };
            }

            const request =
                createAutoClosureRequest(
                    trigger,
                    options
                );

            const duplicate =
                integration
                    .pendingRequests
                    .find(
                        (pending) => {
                            return (
                                pending.trigger ===
                                request.trigger &&
                                pending.cycleId ===
                                request.cycleId &&
                                pending.status ===
                                "pending"
                            );
                        }
                    );

            if (duplicate) {
                integration
                    .skippedAutomaticClosures +=
                    1;

                return {
                    queued:
                        false,

                    reason:
                        "duplicate_request",

                    request:
                        deepClone(
                            duplicate
                        )
                };
            }

            integration
                .pendingRequests
                .push(request);

            integration
                .pendingRequests
                .sort(
                    (
                        first,
                        second
                    ) => {
                        if (
                            first.priority !==
                            second.priority
                        ) {
                            return (
                                second.priority -
                                first.priority
                            );
                        }

                        return (
                            first.createdAt -
                            second.createdAt
                        );
                    }
                );

            if (
                integration
                    .pendingRequests
                    .length >
                DEFAULT_MAX_PENDING_CLOSURES
            ) {
                integration
                    .pendingRequests =
                    integration
                        .pendingRequests
                        .slice(
                            0,
                            DEFAULT_MAX_PENDING_CLOSURES
                        );
            }

            this.processAutomaticClosureQueue();

            return {
                queued:
                    true,

                request:
                    deepClone(request)
            };
        };

    /* ======================================================================
       SECTION 82
       WAIT BEFORE AUTOMATIC CLOSURE
       ====================================================================== */

    ClosureClass.prototype.waitForAutomaticClosureDelay =
        function waitForAutomaticClosureDelay(
            delayMs
        ) {
            const safeDelay =
                Math.max(
                    0,
                    toFiniteNumber(
                        delayMs,
                        DEFAULT_AUTO_CLOSURE_DELAY_MS
                    )
                );

            if (safeDelay === 0) {
                return Promise.resolve();
            }

            return new Promise(
                (resolve) => {
                    global.setTimeout(
                        resolve,
                        safeDelay
                    );
                }
            );
        };

    /* ======================================================================
       SECTION 83
       EXECUTE AUTOMATIC CLOSURE REQUEST
       ====================================================================== */

    ClosureClass.prototype.executeAutomaticClosureRequest =
        async function executeAutomaticClosureRequest(
            request
        ) {
            const integration =
                this.ensureIntegrationState();

            request.status =
                "running";

            request.startedAt =
                Date.now();

            integration.activeRequest =
                request;

            try {
                await this
                    .waitForAutomaticClosureDelay(
                        integration
                            .autoClosureDelayMs
                    );

                if (
                    this.isAutomaticClosureCooldownActive() &&
                    request.priority < 10
                ) {
                    request.status =
                        "skipped";

                    request.completedAt =
                        Date.now();

                    request.result = {
                        success:
                            false,

                        skipped:
                            true,

                        reason:
                            "cooldown_active"
                    };

                    integration
                        .skippedAutomaticClosures +=
                        1;

                    return request.result;
                }

                if (
                    this.state.activeClosure
                ) {
                    request.status =
                        "skipped";

                    request.completedAt =
                        Date.now();

                    request.result = {
                        success:
                            false,

                        skipped:
                            true,

                        reason:
                            "closure_already_active"
                    };

                    integration
                        .skippedAutomaticClosures +=
                        1;

                    return request.result;
                }

                const closureOptions = {
                    ...safeObject(
                        request.options
                    ),

                    reason:
                        request.reason,

                    metadata: {
                        ...safeObject(
                            request.options
                                ?.metadata
                        ),

                        ...safeObject(
                            request.metadata
                        ),

                        automatic:
                            true,

                        trigger:
                            request.trigger,

                        requestId:
                            request.id,

                        cycleId:
                            request.cycleId
                    },

                    closureTimeoutMs:
                        toFiniteNumber(
                            request.options
                                ?.closureTimeoutMs,
                            integration
                                .autoClosureTimeoutMs
                        )
                };

                const result =
                    await this.executeClosure(
                        closureOptions
                    );

                request.completedAt =
                    Date.now();

                request.result =
                    deepClone(result);

                request.status =
                    result?.status ===
                    CLOSURE_STATUS.FAILED
                        ? "failed"
                        : "completed";

                integration
                    .lastAutomaticClosureAt =
                    request.completedAt;

                integration
                    .lastAutomaticClosureTrigger =
                    request.trigger;

                integration
                    .lastAutomaticClosureResult =
                    deepClone(result);

                integration
                    .totalAutomaticClosures +=
                    1;

                if (
                    request.status ===
                    "failed"
                ) {
                    integration
                        .failedAutomaticClosures +=
                        1;
                }

                if (
                    typeof this.core.emit ===
                    "function"
                ) {
                    this.core.emit(
                        CORE_EVENTS
                            .AUTO_CLOSURE_COMPLETED ||
                        "auto_closure_completed",
                        {
                            request:
                                deepClone(
                                    request
                                ),

                            result:
                                deepClone(
                                    result
                                ),

                            timestamp:
                                Date.now()
                        }
                    );
                }

                return result;
            } catch (error) {
                request.status =
                    "failed";

                request.completedAt =
                    Date.now();

                request.error =
                    normalizeClosureError(
                        error
                    );

                integration
                    .failedAutomaticClosures +=
                    1;

                integration
                    .lastAutomaticClosureAt =
                    request.completedAt;

                integration
                    .lastAutomaticClosureTrigger =
                    request.trigger;

                integration
                    .lastAutomaticClosureResult = {
                        success:
                            false,

                        error:
                            deepClone(
                                request.error
                            )
                    };

                return {
                    success:
                        false,

                    status:
                        CLOSURE_STATUS.FAILED,

                    error:
                        deepClone(
                            request.error
                        )
                };
            } finally {
                integration.activeRequest =
                    null;

                integration
                    .requestHistory
                    .push(
                        deepClone(
                            request
                        )
                    );

                if (
                    integration
                        .requestHistory
                        .length >
                    DEFAULT_MAX_AUTO_CLOSURE_HISTORY
                ) {
                    integration
                        .requestHistory =
                        integration
                            .requestHistory
                            .slice(
                                -DEFAULT_MAX_AUTO_CLOSURE_HISTORY
                            );
                }
            }
        };

    /* ======================================================================
       SECTION 84
       PROCESS AUTOMATIC CLOSURE QUEUE
       ====================================================================== */

    ClosureClass.prototype.processAutomaticClosureQueue =
        async function processAutomaticClosureQueue() {
            const integration =
                this.ensureIntegrationState();

            if (
                integration.processing
            ) {
                return {
                    processing:
                        true,

                    pendingCount:
                        integration
                            .pendingRequests
                            .length
                };
            }

            integration.processing =
                true;

            try {
                while (
                    integration.enabled &&
                    integration
                        .pendingRequests
                        .length
                ) {
                    const request =
                        integration
                            .pendingRequests
                            .shift();

                    await this
                        .executeAutomaticClosureRequest(
                            request
                        );
                }
            } finally {
                integration.processing =
                    false;
            }

            return {
                processing:
                    false,

                pendingCount:
                    integration
                        .pendingRequests
                        .length,

                historyCount:
                    integration
                        .requestHistory
                        .length
            };
        };

    /* ======================================================================
       SECTION 85
       REQUEST CYCLE CLOSURE
       ====================================================================== */

    ClosureClass.prototype.requestCycleClosure =
        function requestCycleClosure(
            cycleResult,
            options = {}
        ) {
            const integration =
                this.ensureIntegrationState();

            if (
                !shouldRunClosureForPolicy(
                    integration.policy,
                    cycleResult
                )
            ) {
                integration
                    .skippedAutomaticClosures +=
                    1;

                return {
                    queued:
                        false,

                    reason:
                        "policy_rejected_cycle_result"
                };
            }

            let trigger =
                AUTO_CLOSURE_TRIGGER
                    .CYCLE_COMPLETE;

            if (
                isPartialCycleResult(
                    cycleResult
                )
            ) {
                trigger =
                    AUTO_CLOSURE_TRIGGER
                        .CYCLE_PARTIAL;
            }

            if (
                isFailedCycleResult(
                    cycleResult
                )
            ) {
                trigger =
                    AUTO_CLOSURE_TRIGGER
                        .CYCLE_FAILED;
            }

            return this.enqueueAutomaticClosure(
                trigger,
                {
                    ...safeObject(options),

                    cycleId:
                        cycleResult
                            ?.cycleId ||
                        cycleResult
                            ?.id ||
                        cycleResult
                            ?.cycle
                            ?.id ||
                        null,

                    metadata: {
                        ...safeObject(
                            options.metadata
                        ),

                        cycleStatus:
                            normalizeCycleResultStatus(
                                cycleResult
                            ),

                        cycleResult:
                            deepClone(
                                cycleResult
                            )
                    }
                }
            );
        };

    /* ======================================================================
       SECTION 86
       INSTALL RUN-CYCLE HOOK
       ====================================================================== */

    ClosureClass.prototype.installRunCycleHook =
        function installRunCycleHook() {
            const integration =
                this.ensureIntegrationState();

            if (
                integration
                    .hookStatus
                    .runCycle
            ) {
                return false;
            }

            const core =
                this.core;

            if (
                typeof core.runCycle !==
                "function"
            ) {
                return false;
            }

            const closureEngine =
                this;

            const originalRunCycle =
                core.runCycle.bind(core);

            core.__recoveryClosureOriginalRunCycleV32 =
                originalRunCycle;

            core.runCycle =
                async function runCycleWithAutomaticClosure(
                    options = {}
                ) {
                    let result;

                    try {
                        result =
                            await originalRunCycle(
                                options
                            );
                    } catch (error) {
                        closureEngine
                            .enqueueAutomaticClosure(
                                AUTO_CLOSURE_TRIGGER
                                    .CYCLE_FAILED,
                                {
                                    priority:
                                        8,

                                    metadata: {
                                        error:
                                            normalizeClosureError(
                                                error
                                            )
                                    },

                                    closureOptions:
                                        options.closure ||
                                        {}
                                }
                            );

                        throw error;
                    }

                    closureEngine
                        .requestCycleClosure(
                            result,
                            {
                                closureOptions:
                                    options.closure ||
                                    {},

                                metadata: {
                                    source:
                                        "run_cycle_hook"
                                }
                            }
                        );

                    return result;
                };

            integration
                .hookStatus
                .runCycle =
                true;

            return true;
        };

    /* ======================================================================
       SECTION 87
       INSTALL STOP HOOK
       ====================================================================== */

    ClosureClass.prototype.installStopHook =
        function installStopHook() {
            const integration =
                this.ensureIntegrationState();

            if (
                integration
                    .hookStatus
                    .stop
            ) {
                return false;
            }

            const core =
                this.core;

            if (
                typeof core.stop !==
                "function"
            ) {
                return false;
            }

            const closureEngine =
                this;

            const originalStop =
                core.stop.bind(core);

            core.__recoveryClosureOriginalStopV32 =
                originalStop;

            core.stop =
                async function stopWithRecoveryClosure(
                    options = {}
                ) {
                    if (
                        options.runClosure !==
                        false
                    ) {
                        try {
                            await closureEngine
                                .runStopClosure(
                                    options.closure ||
                                    {}
                                );
                        } catch (error) {
                            if (
                                typeof core.logError ===
                                "function"
                            ) {
                                core.logError(
                                    "Recovery closure failed before engine stop.",
                                    error
                                );
                            }
                        }
                    }

                    return originalStop(
                        options
                    );
                };

            integration
                .hookStatus
                .stop =
                true;

            return true;
        };

    /* ======================================================================
       SECTION 88
       INSTALL RESTART HOOK
       ====================================================================== */

    ClosureClass.prototype.installRestartHook =
        function installRestartHook() {
            const integration =
                this.ensureIntegrationState();

            if (
                integration
                    .hookStatus
                    .restart
            ) {
                return false;
            }

            const core =
                this.core;

            if (
                typeof core.restart !==
                "function"
            ) {
                return false;
            }

            const closureEngine =
                this;

            const originalRestart =
                core.restart.bind(core);

            core.__recoveryClosureOriginalRestartV32 =
                originalRestart;

            core.restart =
                async function restartWithRecoveryClosure(
                    options = {}
                ) {
                    if (
                        options.runClosure !==
                        false
                    ) {
                        try {
                            await closureEngine
                                .runRestartClosure(
                                    options.closure ||
                                    {}
                                );
                        } catch (error) {
                            if (
                                typeof core.logError ===
                                "function"
                            ) {
                                core.logError(
                                    "Recovery closure failed before engine restart.",
                                    error
                                );
                            }
                        }
                    }

                    return originalRestart(
                        options
                    );
                };

            integration
                .hookStatus
                .restart =
                true;

            return true;
        };

    /* ======================================================================
       SECTION 89
       INSTALL RECOVERY HOOK
       ====================================================================== */

    ClosureClass.prototype.installRecoveryHook =
        function installRecoveryHook() {
            const integration =
                this.ensureIntegrationState();

            if (
                integration
                    .hookStatus
                    .scheduleRecovery
            ) {
                return false;
            }

            const core =
                this.core;

            if (
                typeof core.scheduleRecovery !==
                "function"
            ) {
                return false;
            }

            const closureEngine =
                this;

            const originalScheduleRecovery =
                core.scheduleRecovery
                    .bind(core);

            core.__recoveryClosureOriginalScheduleRecoveryV32 =
                originalScheduleRecovery;

            core.scheduleRecovery =
                function scheduleRecoveryWithClosure(
                    options = {}
                ) {
                    closureEngine
                        .enqueueAutomaticClosure(
                            AUTO_CLOSURE_TRIGGER
                                .RECOVERY_STARTED,
                            {
                                priority:
                                    9,

                                metadata: {
                                    source:
                                        "schedule_recovery_hook"
                                },

                                closureOptions:
                                    options.closure ||
                                    {}
                            }
                        );

                    return originalScheduleRecovery(
                        options
                    );
                };

            integration
                .hookStatus
                .scheduleRecovery =
                true;

            return true;
        };

    /* ======================================================================
       SECTION 90
       INSTALL MAINTENANCE HOOK
       ====================================================================== */

    ClosureClass.prototype.installMaintenanceHook =
        function installMaintenanceHook() {
            const integration =
                this.ensureIntegrationState();

            if (
                integration
                    .hookStatus
                    .runMaintenance
            ) {
                return false;
            }

            const core =
                this.core;

            if (
                typeof core.runMaintenance !==
                "function"
            ) {
                return false;
            }

            const closureEngine =
                this;

            const originalRunMaintenance =
                core.runMaintenance
                    .bind(core);

            core.__recoveryClosureOriginalRunMaintenanceV32 =
                originalRunMaintenance;

            core.runMaintenance =
                async function runMaintenanceWithClosure(
                    options = {}
                ) {
                    const result =
                        await originalRunMaintenance(
                            options
                        );

                    if (
                        options.runClosure ===
                        true
                    ) {
                        closureEngine
                            .enqueueAutomaticClosure(
                                AUTO_CLOSURE_TRIGGER
                                    .MAINTENANCE,
                                {
                                    priority:
                                        2,

                                    closureOptions:
                                        options.closure ||
                                        {},

                                    metadata: {
                                        source:
                                            "maintenance_hook"
                                    }
                                }
                            );
                    }

                    return result;
                };

            integration
                .hookStatus
                .runMaintenance =
                true;

            return true;
        };

    /* ======================================================================
       SECTION 91
       INSTALL DESTROY HOOK
       ====================================================================== */

    ClosureClass.prototype.installDestroyHook =
        function installDestroyHook() {
            const integration =
                this.ensureIntegrationState();

            if (
                integration
                    .hookStatus
                    .destroy
            ) {
                return false;
            }

            const core =
                this.core;

            if (
                typeof core.destroy !==
                "function"
            ) {
                return false;
            }

            const closureEngine =
                this;

            const originalDestroy =
                core.destroy.bind(core);

            core.__recoveryClosureOriginalDestroyV32 =
                originalDestroy;

            core.destroy =
                async function destroyWithRecoveryClosure(
                    options = {}
                ) {
                    if (
                        options.runClosure !==
                        false &&
                        !closureEngine.destroyed
                    ) {
                        try {
                            await closureEngine
                                .executeClosure({
                                    ...safeObject(
                                        options.closure
                                    ),

                                    reason:
                                        CLOSURE_REASON
                                            .DESTROY
                                });
                        } catch (error) {
                            if (
                                typeof core.logError ===
                                "function"
                            ) {
                                core.logError(
                                    "Recovery closure failed before engine destroy.",
                                    error
                                );
                            }
                        }
                    }

                    closureEngine
                        .uninstallAutomaticIntegration();

                    return originalDestroy(
                        options
                    );
                };

            integration
                .hookStatus
                .destroy =
                true;

            return true;
        };

    /* ======================================================================
       SECTION 92
       INSTALL ALL AUTOMATIC HOOKS
       ====================================================================== */

    ClosureClass.prototype.installAutomaticIntegration =
        function installAutomaticIntegration(
            options = {}
        ) {
            const integration =
                this.ensureIntegrationState();

            this.configureAutomaticClosure(
                options
            );

            const installed = {
                runCycle:
                    this.installRunCycleHook(),

                stop:
                    this.installStopHook(),

                restart:
                    this.installRestartHook(),

                scheduleRecovery:
                    this.installRecoveryHook(),

                runMaintenance:
                    this.installMaintenanceHook(),

                destroy:
                    this.installDestroyHook()
            };

            integration.installed =
                Object.values(
                    integration.hookStatus
                )
                    .some(Boolean);

            if (
                typeof this.core.emit ===
                "function"
            ) {
                this.core.emit(
                    CORE_EVENTS
                        .CLOSURE_INTEGRATION_INSTALLED ||
                    "closure_integration_installed",
                    {
                        installed:
                            deepClone(
                                installed
                            ),

                        configuration:
                            deepClone(
                                integration
                            ),

                        timestamp:
                            Date.now()
                    }
                );
            }

            return {
                installed:
                    integration.installed,

                hooks:
                    deepClone(
                        integration.hookStatus
                    ),

                configuration:
                    deepClone(
                        integration
                    )
            };
        };

    /* ======================================================================
       SECTION 93
       UNINSTALL AUTOMATIC HOOKS
       ====================================================================== */

    ClosureClass.prototype.uninstallAutomaticIntegration =
        function uninstallAutomaticIntegration() {
            const integration =
                this.ensureIntegrationState();

            const core =
                this.core;

            if (
                core
                    .__recoveryClosureOriginalRunCycleV32
            ) {
                core.runCycle =
                    core
                        .__recoveryClosureOriginalRunCycleV32;

                delete core
                    .__recoveryClosureOriginalRunCycleV32;
            }

            if (
                core
                    .__recoveryClosureOriginalStopV32
            ) {
                core.stop =
                    core
                        .__recoveryClosureOriginalStopV32;

                delete core
                    .__recoveryClosureOriginalStopV32;
            }

            if (
                core
                    .__recoveryClosureOriginalRestartV32
            ) {
                core.restart =
                    core
                        .__recoveryClosureOriginalRestartV32;

                delete core
                    .__recoveryClosureOriginalRestartV32;
            }

            if (
                core
                    .__recoveryClosureOriginalScheduleRecoveryV32
            ) {
                core.scheduleRecovery =
                    core
                        .__recoveryClosureOriginalScheduleRecoveryV32;

                delete core
                    .__recoveryClosureOriginalScheduleRecoveryV32;
            }

            if (
                core
                    .__recoveryClosureOriginalRunMaintenanceV32
            ) {
                core.runMaintenance =
                    core
                        .__recoveryClosureOriginalRunMaintenanceV32;

                delete core
                    .__recoveryClosureOriginalRunMaintenanceV32;
            }

            if (
                core
                    .__recoveryClosureOriginalDestroyV32
            ) {
                core.destroy =
                    core
                        .__recoveryClosureOriginalDestroyV32;

                delete core
                    .__recoveryClosureOriginalDestroyV32;
            }

            integration.installed =
                false;

            integration.processing =
                false;

            integration.activeRequest =
                null;

            integration.pendingRequests = [];

            Object.keys(
                integration.hookStatus
            )
                .forEach(
                    (key) => {
                        integration
                            .hookStatus[
                                key
                            ] =
                            false;
                    }
                );

            return {
                uninstalled:
                    true,

                hooks:
                    deepClone(
                        integration
                            .hookStatus
                    )
            };
        };

    /* ======================================================================
       SECTION 94
       ENABLE AUTOMATIC CLOSURE
       ====================================================================== */

    ClosureClass.prototype.enableAutomaticClosure =
        function enableAutomaticClosure(
            options = {}
        ) {
            const integration =
                this.ensureIntegrationState();

            integration.enabled =
                true;

            if (
                options.policy
            ) {
                integration.policy =
                    normalizeAutoClosurePolicy(
                        options.policy
                    );
            }

            return deepClone(
                integration
            );
        };

    /* ======================================================================
       SECTION 95
       DISABLE AUTOMATIC CLOSURE
       ====================================================================== */

    ClosureClass.prototype.disableAutomaticClosure =
        function disableAutomaticClosure(
            options = {}
        ) {
            const integration =
                this.ensureIntegrationState();

            integration.enabled =
                false;

            if (
                options.clearPending !==
                false
            ) {
                integration
                    .pendingRequests = [];
            }

            return deepClone(
                integration
            );
        };

    /* ======================================================================
       SECTION 96
       GET AUTOMATIC INTEGRATION STATUS
       ====================================================================== */

    ClosureClass.prototype.getAutomaticIntegrationStatus =
        function getAutomaticIntegrationStatus() {
            const integration =
                this.ensureIntegrationState();

            return {
                installed:
                    integration.installed,

                enabled:
                    integration.enabled,

                policy:
                    integration.policy,

                processing:
                    integration.processing,

                pendingRequestCount:
                    integration
                        .pendingRequests
                        .length,

                activeRequest:
                    integration
                        .activeRequest
                        ? deepClone(
                            integration
                                .activeRequest
                        )
                        : null,

                lastAutomaticClosureAt:
                    integration
                        .lastAutomaticClosureAt,

                lastAutomaticClosureTrigger:
                    integration
                        .lastAutomaticClosureTrigger,

                totalAutomaticClosures:
                    integration
                        .totalAutomaticClosures,

                skippedAutomaticClosures:
                    integration
                        .skippedAutomaticClosures,

                failedAutomaticClosures:
                    integration
                        .failedAutomaticClosures,

                hooks:
                    deepClone(
                        integration
                            .hookStatus
                    )
            };
        };

    /* ======================================================================
       SECTION 97
       GET AUTOMATIC REQUEST HISTORY
       ====================================================================== */

    ClosureClass.prototype.getAutomaticClosureHistory =
        function getAutomaticClosureHistory(
            limit = 20
        ) {
            const integration =
                this.ensureIntegrationState();

            const safeLimit =
                Math.max(
                    1,
                    Math.min(
                        DEFAULT_MAX_AUTO_CLOSURE_HISTORY,
                        Math.round(
                            toFiniteNumber(
                                limit,
                                20
                            )
                        )
                    )
                );

            return deepClone(
                integration
                    .requestHistory
                    .slice(
                        -safeLimit
                    )
                    .reverse()
            );
        };

    /* ======================================================================
       SECTION 98
       CLEAR AUTOMATIC CLOSURE QUEUE
       ====================================================================== */

    ClosureClass.prototype.clearAutomaticClosureQueue =
        function clearAutomaticClosureQueue() {
            const integration =
                this.ensureIntegrationState();

            const removedCount =
                integration
                    .pendingRequests
                    .length;

            integration
                .pendingRequests = [];

            return {
                cleared:
                    true,

                removedCount,

                clearedAt:
                    Date.now()
            };
        };

    /* ======================================================================
       SECTION 99
       CORE INTEGRATION FACTORY
       ====================================================================== */

    CoreClass.prototype.installRecoveryClosureIntegration =
        function installRecoveryClosureIntegration(
            options = {}
        ) {
            const closure =
                this.createRecoveryClosure(
                    options.closure ||
                    options
                );

            closure
                .installAutomaticIntegration(
                    options.automatic ||
                    options
                );

            return closure;
        };

    CoreClass.prototype.getRecoveryClosureIntegrationStatus =
        function getRecoveryClosureIntegrationStatus() {
            const closure =
                this.getRecoveryClosure();

            if (!closure) {
                return {
                    installed:
                        false,

                    enabled:
                        false
                };
            }

            return closure
                .getAutomaticIntegrationStatus();
        };

    /* ======================================================================
       SECTION 100
       CLOSURE API EXTENSIONS
       ====================================================================== */

    const ClosureApi =
        global
            .RainArrivalRecoveryClosureAPI ||
        global
            .RainGuardRecoveryClosureAPI;

    if (ClosureApi) {
        ClosureApi.install =
            function install(
                options = {}
            ) {
                return this
                    .requireInstance()
                    .installAutomaticIntegration(
                        options
                    );
            };

        ClosureApi.uninstall =
            function uninstall() {
                return this
                    .requireInstance()
                    .uninstallAutomaticIntegration();
            };

        ClosureApi.enable =
            function enable(
                options = {}
            ) {
                return this
                    .requireInstance()
                    .enableAutomaticClosure(
                        options
                    );
            };

        ClosureApi.disable =
            function disable(
                options = {}
            ) {
                return this
                    .requireInstance()
                    .disableAutomaticClosure(
                        options
                    );
            };

        ClosureApi.getIntegrationStatus =
            function getIntegrationStatus() {
                return this
                    .requireInstance()
                    .getAutomaticIntegrationStatus();
            };

        ClosureApi.getAutomaticHistory =
            function getAutomaticHistory(
                limit = 20
            ) {
                return this
                    .requireInstance()
                    .getAutomaticClosureHistory(
                        limit
                    );
            };

        ClosureApi.clearQueue =
            function clearQueue() {
                return this
                    .requireInstance()
                    .clearAutomaticClosureQueue();
            };

        ClosureApi.enqueue =
            function enqueue(
                trigger,
                options = {}
            ) {
                return this
                    .requireInstance()
                    .enqueueAutomaticClosure(
                        trigger,
                        options
                    );
            };
    }

    /* ======================================================================
       SECTION 101
       AUTOMATIC INSTALLATION HELPER
       ====================================================================== */

    function installRainArrivalRecoveryClosureV32(
        core,
        options = {}
    ) {
        if (
            !(core instanceof CoreClass)
        ) {
            throw new TypeError(
                "A RainArrivalRecoveryCoreV32 instance is required."
            );
        }

        const closure =
            core.createRecoveryClosure(
                options.closure ||
                options
            );

        closure.installAutomaticIntegration(
            options.automatic ||
            options
        );

        return closure;
    }

    /* ======================================================================
       SECTION 102
       COMPATIBILITY ALIASES
       ====================================================================== */

    ClosureClass.prototype.installHooks =
        ClosureClass.prototype
            .installAutomaticIntegration;

    ClosureClass.prototype.uninstallHooks =
        ClosureClass.prototype
            .uninstallAutomaticIntegration;

    ClosureClass.prototype.enableAutoClosure =
        ClosureClass.prototype
            .enableAutomaticClosure;

    ClosureClass.prototype.disableAutoClosure =
        ClosureClass.prototype
            .disableAutomaticClosure;

    ClosureClass.prototype.getAutoClosureStatus =
        ClosureClass.prototype
            .getAutomaticIntegrationStatus;

    ClosureClass.prototype.queueClosure =
        ClosureClass.prototype
            .enqueueAutomaticClosure;

    CoreClass.prototype.enableRecoveryClosure =
        CoreClass.prototype
            .installRecoveryClosureIntegration;

    /* ======================================================================
       SECTION 103
       PART 4 EXPORT
       ====================================================================== */

    global.RainArrivalRecoveryClosureV32Part4 = {
        AUTO_CLOSURE_TRIGGER,
        AUTO_CLOSURE_POLICY,
        DEFAULT_AUTO_CLOSURE_DELAY_MS,
        DEFAULT_AUTO_CLOSURE_TIMEOUT_MS,
        DEFAULT_AUTO_CLOSURE_COOLDOWN_MS,
        DEFAULT_MAX_PENDING_CLOSURES,
        DEFAULT_MAX_AUTO_CLOSURE_HISTORY,
        createAutoClosureRequestId,
        normalizeAutoClosurePolicy,
        normalizeAutoClosureTrigger,
        normalizeCycleResultStatus,
        isSuccessfulCycleResult,
        isPartialCycleResult,
        isFailedCycleResult,
        shouldRunClosureForPolicy,
        mapTriggerToClosureReason,
        createAutoClosureRequest,
        installRainArrivalRecoveryClosureV32
    };

})(window);

  /* ==========================================================================
   RainGuard AI
   Long Horizon Forecast Engine V32

   Recovery Closure Engine V32

   PART 5
   Resource Locking + State Snapshot + Safe Rollback +
   Duplicate Prevention + Transaction Protection
   ========================================================================== */

(function extendRainArrivalRecoveryClosureV32Part5(global) {
    "use strict";

    /* ======================================================================
       SECTION 104
       DEPENDENCY RESOLUTION
       ====================================================================== */

    const CoreClass =
        global.RainArrivalRecoveryCoreV32;

    const ClosureClass =
        global.RainArrivalRecoveryClosureV32;

    const ClosureConstants =
        global.RainArrivalRecoveryClosureV32Constants;

    const ClosureUtils =
        global.RainArrivalRecoveryClosureV32Utils;

    const CoreUtils =
        global.RainArrivalRecoveryCoreV32Utils;

    const CoreConstants =
        global.RainArrivalRecoveryCoreV32Constants;

    if (
        typeof CoreClass !== "function" ||
        typeof ClosureClass !== "function" ||
        !ClosureConstants ||
        !ClosureUtils ||
        !CoreUtils ||
        !CoreConstants
    ) {
        throw new Error(
            "RainArrivalRecoveryClosureV32 Parts 1 to 4 must be loaded before Part 5."
        );
    }

    const {
        CLOSURE_STATUS
    } = ClosureConstants;

    const {
        createClosureError,
        normalizeClosureError
    } = ClosureUtils;

    const {
        toFiniteNumber,
        safeArray,
        safeObject,
        deepClone
    } = CoreUtils;

    const {
        CORE_EVENTS
    } = CoreConstants;

    /* ======================================================================
       SECTION 105
       TRANSACTION CONSTANTS
       ====================================================================== */

    const LOCK_STATUS =
        Object.freeze({
            FREE:
                "free",

            WAITING:
                "waiting",

            ACQUIRED:
                "acquired",

            RELEASING:
                "releasing",

            EXPIRED:
                "expired",

            FAILED:
                "failed"
        });

    const TRANSACTION_STATUS =
        Object.freeze({
            IDLE:
                "idle",

            PREPARING:
                "preparing",

            ACTIVE:
                "active",

            COMMITTING:
                "committing",

            COMMITTED:
                "committed",

            ROLLING_BACK:
                "rolling_back",

            ROLLED_BACK:
                "rolled_back",

            FAILED:
                "failed"
        });

    const SNAPSHOT_STATUS =
        Object.freeze({
            CREATED:
                "created",

            RESTORED:
                "restored",

            DISCARDED:
                "discarded",

            EXPIRED:
                "expired"
        });

    const DEFAULT_RESOURCE_LOCK_TIMEOUT_MS =
        20 * 1000;

    const DEFAULT_RESOURCE_LOCK_TTL_MS =
        60 * 1000;

    const DEFAULT_LOCK_RETRY_INTERVAL_MS =
        100;

    const DEFAULT_TRANSACTION_TIMEOUT_MS =
        90 * 1000;

    const DEFAULT_SNAPSHOT_RETENTION_MS =
        30 * 60 * 1000;

    const DEFAULT_MAX_SNAPSHOTS =
        20;

    const DEFAULT_DUPLICATE_WINDOW_MS =
        30 * 1000;

    const DEFAULT_MAX_TRANSACTION_HISTORY =
        100;

    const TRANSACTION_RESOURCE =
        Object.freeze({
            CORE_STATE:
                "core_state",

            PREDICTIONS:
                "predictions",

            CELLS:
                "cells",

            OBSERVATIONS:
                "observations",

            FORECASTS:
                "forecasts",

            ARCHIVES:
                "archives",

            DASHBOARD:
                "dashboard",

            FRONTEND_OUTPUT:
                "frontend_output",

            CLOSURE_STATE:
                "closure_state"
        });

    /* ======================================================================
       SECTION 106
       TRANSACTION HELPERS
       ====================================================================== */

    function createTransactionId() {
        return (
            "recovery_transaction_" +
            Date.now() +
            "_" +
            Math.random()
                .toString(36)
                .slice(2, 10)
        );
    }

    function createLockId() {
        return (
            "recovery_lock_" +
            Date.now() +
            "_" +
            Math.random()
                .toString(36)
                .slice(2, 9)
        );
    }

    function createSnapshotId() {
        return (
            "recovery_snapshot_" +
            Date.now() +
            "_" +
            Math.random()
                .toString(36)
                .slice(2, 9)
        );
    }

    function sleep(
        durationMs
    ) {
        const delay =
            Math.max(
                0,
                toFiniteNumber(
                    durationMs,
                    0
                )
            );

        return new Promise(
            (resolve) => {
                global.setTimeout(
                    resolve,
                    delay
                );
            }
        );
    }

    function normalizeResourceList(
        resources
    ) {
        const allowedResources =
            Object.values(
                TRANSACTION_RESOURCE
            );

        const normalized =
            safeArray(resources)
                .map(
                    (resource) => {
                        return String(
                            resource ||
                            ""
                        )
                            .trim()
                            .toLowerCase();
                    }
                )
                .filter(
                    (resource) => {
                        return allowedResources
                            .includes(
                                resource
                            );
                    }
                );

        return Array.from(
            new Set(
                normalized
            )
        );
    }

    function createLockRecord(
        ownerId,
        resources,
        options = {}
    ) {
        const safeOptions =
            safeObject(options);

        const createdAt =
            Date.now();

        const ttlMs =
            Math.max(
                5000,
                toFiniteNumber(
                    safeOptions.ttlMs,
                    DEFAULT_RESOURCE_LOCK_TTL_MS
                )
            );

        return {
            id:
                createLockId(),

            ownerId,

            resources:
                normalizeResourceList(
                    resources
                ),

            status:
                LOCK_STATUS.WAITING,

            createdAt,

            acquiredAt:
                null,

            releasedAt:
                null,

            expiresAt:
                createdAt +
                ttlMs,

            ttlMs,

            metadata:
                deepClone(
                    safeObject(
                        safeOptions.metadata
                    )
                )
        };
    }

    function createTransactionRecord(
        closureId,
        options = {}
    ) {
        const safeOptions =
            safeObject(options);

        return {
            id:
                createTransactionId(),

            closureId:
                closureId ||
                null,

            status:
                TRANSACTION_STATUS
                    .PREPARING,

            createdAt:
                Date.now(),

            startedAt:
                null,

            committedAt:
                null,

            rolledBackAt:
                null,

            completedAt:
                null,

            durationMs:
                0,

            snapshotId:
                null,

            lockId:
                null,

            resources:
                normalizeResourceList(
                    safeOptions.resources ||
                    Object.values(
                        TRANSACTION_RESOURCE
                    )
                ),

            operations: [],

            errors: [],

            warnings: [],

            metadata:
                deepClone(
                    safeObject(
                        safeOptions.metadata
                    )
                )
        };
    }

    function buildClosureFingerprint(
        closure,
        options = {}
    ) {
        if (!closure) {
            return "";
        }

        const safeOptions =
            safeObject(options);

        const predictionCount =
            toFiniteNumber(
                closure
                    ?.input
                    ?.predictionCount,
                0
            );

        const cellCount =
            toFiniteNumber(
                closure
                    ?.input
                    ?.trackedCellCount,
                0
            );

        const observationCount =
            toFiniteNumber(
                closure
                    ?.input
                    ?.observationCount,
                0
            );

        const forecastCount =
            toFiniteNumber(
                closure
                    ?.input
                    ?.forecastCount,
                0
            );

        const cycleId =
            closure
                ?.metadata
                ?.cycleId ||
            closure
                ?.metadata
                ?.requestId ||
            safeOptions.cycleId ||
            "";

        return [
            closure.reason ||
            "",

            cycleId,

            predictionCount,

            cellCount,

            observationCount,

            forecastCount
        ].join("|");
    }

    function isLockExpired(
        lock
    ) {
        if (!lock) {
            return true;
        }

        return (
            Number(
                lock.expiresAt
            ) <=
            Date.now()
        );
    }

    /* ======================================================================
       SECTION 107
       ENSURE TRANSACTION STATE
       ====================================================================== */

    ClosureClass.prototype.ensureTransactionState =
        function ensureTransactionState() {
            if (
                !this.state.transaction
            ) {
                this.state.transaction = {
                    status:
                        TRANSACTION_STATUS.IDLE,

                    activeTransaction:
                        null,

                    transactionHistory: [],

                    locks:
                        new Map(),

                    snapshots: [],

                    recentFingerprints: [],

                    lastTransaction:
                        null,

                    lastSnapshot:
                        null,

                    totalTransactions:
                        0,

                    committedTransactions:
                        0,

                    rolledBackTransactions:
                        0,

                    failedTransactions:
                        0
                };
            }

            if (
                !(this.state
                    .transaction
                    .locks instanceof Map)
            ) {
                this.state
                    .transaction
                    .locks =
                    new Map();
            }

            if (
                !Array.isArray(
                    this.state
                        .transaction
                        .snapshots
                )
            ) {
                this.state
                    .transaction
                    .snapshots = [];
            }

            if (
                !Array.isArray(
                    this.state
                        .transaction
                        .transactionHistory
                )
            ) {
                this.state
                    .transaction
                    .transactionHistory = [];
            }

            if (
                !Array.isArray(
                    this.state
                        .transaction
                        .recentFingerprints
                )
            ) {
                this.state
                    .transaction
                    .recentFingerprints = [];
            }

            return this.state
                .transaction;
        };

    /* ======================================================================
       SECTION 108
       CLEAN EXPIRED LOCKS
       ====================================================================== */

    ClosureClass.prototype.cleanupExpiredLocks =
        function cleanupExpiredLocks() {
            const transactionState =
                this.ensureTransactionState();

            const expiredLocks = [];

            transactionState
                .locks
                .forEach(
                    (
                        lock,
                        lockId
                    ) => {
                        if (
                            isLockExpired(
                                lock
                            )
                        ) {
                            lock.status =
                                LOCK_STATUS.EXPIRED;

                            expiredLocks.push(
                                deepClone(
                                    lock
                                )
                            );

                            transactionState
                                .locks
                                .delete(
                                    lockId
                                );
                        }
                    }
                );

            return {
                expiredCount:
                    expiredLocks.length,

                expiredLocks,

                cleanedAt:
                    Date.now()
            };
        };

    /* ======================================================================
       SECTION 109
       CHECK RESOURCE CONFLICT
       ====================================================================== */

    ClosureClass.prototype.hasResourceConflict =
        function hasResourceConflict(
            resources,
            ownerId = null
        ) {
            const transactionState =
                this.ensureTransactionState();

            this.cleanupExpiredLocks();

            const requested =
                new Set(
                    normalizeResourceList(
                        resources
                    )
                );

            let conflict =
                null;

            transactionState
                .locks
                .forEach(
                    (lock) => {
                        if (
                            conflict ||
                            lock.status !==
                            LOCK_STATUS.ACQUIRED
                        ) {
                            return;
                        }

                        if (
                            ownerId &&
                            lock.ownerId ===
                            ownerId
                        ) {
                            return;
                        }

                        const overlapping =
                            safeArray(
                                lock.resources
                            )
                                .filter(
                                    (resource) => {
                                        return requested
                                            .has(
                                                resource
                                            );
                                    }
                                );

                        if (
                            overlapping.length
                        ) {
                            conflict = {
                                lock:
                                    deepClone(
                                        lock
                                    ),

                                overlappingResources:
                                    overlapping
                            };
                        }
                    }
                );

            return conflict;
        };

    /* ======================================================================
       SECTION 110
       ACQUIRE RESOURCE LOCK
       ====================================================================== */

    ClosureClass.prototype.acquireResourceLock =
        async function acquireResourceLock(
            ownerId,
            resources,
            options = {}
        ) {
            const transactionState =
                this.ensureTransactionState();

            const safeOptions =
                safeObject(options);

            const normalizedResources =
                normalizeResourceList(
                    resources
                );

            if (
                !normalizedResources.length
            ) {
                throw createClosureError(
                    "At least one transaction resource is required.",
                    "NO_TRANSACTION_RESOURCES"
                );
            }

            const timeoutMs =
                Math.max(
                    1000,
                    toFiniteNumber(
                        safeOptions.timeoutMs,
                        DEFAULT_RESOURCE_LOCK_TIMEOUT_MS
                    )
                );

            const retryIntervalMs =
                Math.max(
                    25,
                    toFiniteNumber(
                        safeOptions.retryIntervalMs,
                        DEFAULT_LOCK_RETRY_INTERVAL_MS
                    )
                );

            const lock =
                createLockRecord(
                    ownerId,
                    normalizedResources,
                    safeOptions
                );

            const deadline =
                Date.now() +
                timeoutMs;

            while (
                Date.now() <=
                deadline
            ) {
                const conflict =
                    this.hasResourceConflict(
                        normalizedResources,
                        ownerId
                    );

                if (!conflict) {
                    lock.status =
                        LOCK_STATUS.ACQUIRED;

                    lock.acquiredAt =
                        Date.now();

                    lock.expiresAt =
                        lock.acquiredAt +
                        lock.ttlMs;

                    transactionState
                        .locks
                        .set(
                            lock.id,
                            lock
                        );

                    if (
                        typeof this.core.emit ===
                        "function"
                    ) {
                        this.core.emit(
                            CORE_EVENTS
                                .CLOSURE_LOCK_ACQUIRED ||
                            "closure_lock_acquired",
                            {
                                lock:
                                    deepClone(
                                        lock
                                    ),

                                timestamp:
                                    Date.now()
                            }
                        );
                    }

                    return deepClone(
                        lock
                    );
                }

                await sleep(
                    retryIntervalMs
                );
            }

            lock.status =
                LOCK_STATUS.FAILED;

            throw createClosureError(
                "Unable to acquire recovery closure resource lock.",
                "RESOURCE_LOCK_TIMEOUT"
            );
        };

    /* ======================================================================
       SECTION 111
       REFRESH RESOURCE LOCK
       ====================================================================== */

    ClosureClass.prototype.refreshResourceLock =
        function refreshResourceLock(
            lockId,
            ttlMs =
                DEFAULT_RESOURCE_LOCK_TTL_MS
        ) {
            const transactionState =
                this.ensureTransactionState();

            const lock =
                transactionState
                    .locks
                    .get(
                        lockId
                    );

            if (
                !lock ||
                lock.status !==
                LOCK_STATUS.ACQUIRED
            ) {
                return false;
            }

            lock.ttlMs =
                Math.max(
                    5000,
                    toFiniteNumber(
                        ttlMs,
                        DEFAULT_RESOURCE_LOCK_TTL_MS
                    )
                );

            lock.expiresAt =
                Date.now() +
                lock.ttlMs;

            return true;
        };

    /* ======================================================================
       SECTION 112
       RELEASE RESOURCE LOCK
       ====================================================================== */

    ClosureClass.prototype.releaseResourceLock =
        function releaseResourceLock(
            lockId
        ) {
            const transactionState =
                this.ensureTransactionState();

            const lock =
                transactionState
                    .locks
                    .get(
                        lockId
                    );

            if (!lock) {
                return false;
            }

            lock.status =
                LOCK_STATUS.RELEASING;

            lock.releasedAt =
                Date.now();

            transactionState
                .locks
                .delete(
                    lockId
                );

            if (
                typeof this.core.emit ===
                "function"
            ) {
                this.core.emit(
                    CORE_EVENTS
                        .CLOSURE_LOCK_RELEASED ||
                    "closure_lock_released",
                    {
                        lock:
                            deepClone(
                                lock
                            ),

                        timestamp:
                            Date.now()
                    }
                );
            }

            return true;
        };

    /* ======================================================================
       SECTION 113
       CAPTURE CORE SNAPSHOT
       ====================================================================== */

    ClosureClass.prototype.captureCoreSnapshot =
        function captureCoreSnapshot(
            transaction,
            options = {}
        ) {
            const transactionState =
                this.ensureTransactionState();

            const safeOptions =
                safeObject(options);

            const snapshot = {
                id:
                    createSnapshotId(),

                transactionId:
                    transaction?.id ||
                    null,

                closureId:
                    transaction
                        ?.closureId ||
                    this.state
                        .activeClosure
                        ?.id ||
                    null,

                status:
                    SNAPSHOT_STATUS.CREATED,

                createdAt:
                    Date.now(),

                restoredAt:
                    null,

                discardedAt:
                    null,

                metadata:
                    deepClone(
                        safeObject(
                            safeOptions.metadata
                        )
                    ),

                core: {
                    observations:
                        deepClone(
                            safeArray(
                                this.core.state
                                    .observations
                            )
                        ),

                    forecasts:
                        deepClone(
                            safeArray(
                                this.core.state
                                    .forecasts
                            )
                        ),

                    radarFrames:
                        deepClone(
                            safeArray(
                                this.core.state
                                    .radarFrames
                            )
                        ),

                    rainCells:
                        deepClone(
                            safeArray(
                                this.core.state
                                    .rainCells
                            )
                        ),

                    arrivalPredictions:
                        deepClone(
                            safeArray(
                                this.core.state
                                    .arrivalPredictions
                            )
                        ),

                    cityForecasts:
                        deepClone(
                            safeArray(
                                this.core.state
                                    .cityForecasts
                            )
                        ),

                    horizonForecasts:
                        deepClone(
                            this.core.state
                                .horizonForecasts ||
                            {}
                        ),

                    horizonForecastList:
                        deepClone(
                            safeArray(
                                this.core.state
                                    .horizonForecastList
                            )
                        ),

                    regionSummaries:
                        deepClone(
                            safeArray(
                                this.core.state
                                    .regionSummaries
                            )
                        ),

                    governorateSummaries:
                        deepClone(
                            safeArray(
                                this.core.state
                                    .governorateSummaries
                            )
                        ),

                    regionHorizonSummaries:
                        deepClone(
                            this.core.state
                                .regionHorizonSummaries ||
                            {}
                        ),

                    governorateHorizonSummaries:
                        deepClone(
                            this.core.state
                                .governorateHorizonSummaries ||
                            {}
                        ),

                    nationalArrivalDashboard:
                        deepClone(
                            this.core.state
                                .nationalArrivalDashboard ||
                            null
                        ),

                    frontendPayload:
                        deepClone(
                            this.core.state
                                .frontendPayload ||
                            null
                        ),

                    closure:
                        deepClone(
                            this.core.state
                                .closure ||
                            null
                        ),

                    diagnostics:
                        deepClone(
                            this.core.state
                                .diagnostics ||
                            {}
                        ),

                    cells:
                        deepClone(
                            Array.from(
                                this.core.cells
                                    ?.entries?.() ||
                                []
                            )
                        )
                },

                closure: {
                    archivedPredictions:
                        deepClone(
                            safeArray(
                                this.state
                                    .archivedPredictions
                            )
                        ),

                    archivedCells:
                        deepClone(
                            safeArray(
                                this.state
                                    .archivedCells
                            )
                        ),

                    archivedObservations:
                        deepClone(
                            safeArray(
                                this.state
                                    .archivedObservations
                            )
                        ),

                    archivedForecasts:
                        deepClone(
                            safeArray(
                                this.state
                                    .archivedForecasts
                            )
                        )
                }
            };

            transactionState
                .snapshots
                .push(snapshot);

            if (
                transactionState
                    .snapshots
                    .length >
                DEFAULT_MAX_SNAPSHOTS
            ) {
                transactionState
                    .snapshots =
                    transactionState
                        .snapshots
                        .slice(
                            -DEFAULT_MAX_SNAPSHOTS
                        );
            }

            transactionState.lastSnapshot =
                deepClone(
                    snapshot
                );

            if (transaction) {
                transaction.snapshotId =
                    snapshot.id;
            }

            return deepClone(
                snapshot
            );
        };

    /* ======================================================================
       SECTION 114
       FIND SNAPSHOT
       ====================================================================== */

    ClosureClass.prototype.findSnapshot =
        function findSnapshot(
            snapshotId
        ) {
            const transactionState =
                this.ensureTransactionState();

            return (
                transactionState
                    .snapshots
                    .find(
                        (snapshot) => {
                            return (
                                snapshot.id ===
                                snapshotId
                            );
                        }
                    ) ||
                null
            );
        };

    /* ======================================================================
       SECTION 115
       RESTORE CORE SNAPSHOT
       ====================================================================== */

    ClosureClass.prototype.restoreCoreSnapshot =
        function restoreCoreSnapshot(
            snapshotId,
            options = {}
        ) {
            const snapshot =
                this.findSnapshot(
                    snapshotId
                );

            if (!snapshot) {
                throw createClosureError(
                    "Recovery closure snapshot was not found.",
                    "SNAPSHOT_NOT_FOUND"
                );
            }

            const coreData =
                safeObject(
                    snapshot.core
                );

            const closureData =
                safeObject(
                    snapshot.closure
                );

            this.core.state
                .observations =
                deepClone(
                    safeArray(
                        coreData.observations
                    )
                );

            this.core.state
                .forecasts =
                deepClone(
                    safeArray(
                        coreData.forecasts
                    )
                );

            this.core.state
                .radarFrames =
                deepClone(
                    safeArray(
                        coreData.radarFrames
                    )
                );

            this.core.state
                .rainCells =
                deepClone(
                    safeArray(
                        coreData.rainCells
                    )
                );

            this.core.state
                .arrivalPredictions =
                deepClone(
                    safeArray(
                        coreData
                            .arrivalPredictions
                    )
                );

            this.core.state
                .cityForecasts =
                deepClone(
                    safeArray(
                        coreData.cityForecasts
                    )
                );

            this.core.state
                .horizonForecasts =
                deepClone(
                    coreData
                        .horizonForecasts ||
                    {}
                );

            this.core.state
                .horizonForecastList =
                deepClone(
                    safeArray(
                        coreData
                            .horizonForecastList
                    )
                );

            this.core.state
                .regionSummaries =
                deepClone(
                    safeArray(
                        coreData
                            .regionSummaries
                    )
                );

            this.core.state
                .governorateSummaries =
                deepClone(
                    safeArray(
                        coreData
                            .governorateSummaries
                    )
                );

            this.core.state
                .regionHorizonSummaries =
                deepClone(
                    coreData
                        .regionHorizonSummaries ||
                    {}
                );

            this.core.state
                .governorateHorizonSummaries =
                deepClone(
                    coreData
                        .governorateHorizonSummaries ||
                    {}
                );

            this.core.state
                .nationalArrivalDashboard =
                deepClone(
                    coreData
                        .nationalArrivalDashboard ||
                    null
                );

            this.core.state
                .frontendPayload =
                deepClone(
                    coreData
                        .frontendPayload ||
                    null
                );

            this.core.state
                .closure =
                deepClone(
                    coreData.closure ||
                    null
                );

            this.core.state
                .diagnostics =
                deepClone(
                    coreData.diagnostics ||
                    {}
                );

            this.core.cells =
                new Map(
                    deepClone(
                        safeArray(
                            coreData.cells
                        )
                    )
                );

            this.state
                .archivedPredictions =
                deepClone(
                    safeArray(
                        closureData
                            .archivedPredictions
                    )
                );

            this.state
                .archivedCells =
                deepClone(
                    safeArray(
                        closureData
                            .archivedCells
                    )
                );

            this.state
                .archivedObservations =
                deepClone(
                    safeArray(
                        closureData
                            .archivedObservations
                    )
                );

            this.state
                .archivedForecasts =
                deepClone(
                    safeArray(
                        closureData
                            .archivedForecasts
                    )
                );

            snapshot.status =
                SNAPSHOT_STATUS.RESTORED;

            snapshot.restoredAt =
                Date.now();

            snapshot.restoreMetadata =
                deepClone(
                    safeObject(
                        options.metadata
                    )
                );

            if (
                typeof this.core.emit ===
                "function"
            ) {
                this.core.emit(
                    CORE_EVENTS
                        .CLOSURE_SNAPSHOT_RESTORED ||
                    "closure_snapshot_restored",
                    {
                        snapshotId:
                            snapshot.id,

                        closureId:
                            snapshot.closureId,

                        transactionId:
                            snapshot.transactionId,

                        timestamp:
                            Date.now()
                    }
                );
            }

            return deepClone(
                snapshot
            );
        };

    /* ======================================================================
       SECTION 116
       DISCARD SNAPSHOT
       ====================================================================== */

    ClosureClass.prototype.discardSnapshot =
        function discardSnapshot(
            snapshotId
        ) {
            const transactionState =
                this.ensureTransactionState();

            const snapshot =
                this.findSnapshot(
                    snapshotId
                );

            if (!snapshot) {
                return false;
            }

            snapshot.status =
                SNAPSHOT_STATUS.DISCARDED;

            snapshot.discardedAt =
                Date.now();

            transactionState.snapshots =
                transactionState
                    .snapshots
                    .filter(
                        (item) => {
                            return (
                                item.id !==
                                snapshotId
                            );
                        }
                    );

            return true;
        };

    /* ======================================================================
       SECTION 117
       CLEAN EXPIRED SNAPSHOTS
       ====================================================================== */

    ClosureClass.prototype.cleanupExpiredSnapshots =
        function cleanupExpiredSnapshots(
            options = {}
        ) {
            const transactionState =
                this.ensureTransactionState();

            const retentionMs =
                Math.max(
                    60 * 1000,
                    toFiniteNumber(
                        options.retentionMs,
                        DEFAULT_SNAPSHOT_RETENTION_MS
                    )
                );

            const removed = [];

            transactionState.snapshots =
                transactionState
                    .snapshots
                    .filter(
                        (snapshot) => {
                            const expired =
                                Date.now() -
                                toFiniteNumber(
                                    snapshot.createdAt,
                                    0
                                ) >
                                retentionMs;

                            if (expired) {
                                snapshot.status =
                                    SNAPSHOT_STATUS.EXPIRED;

                                removed.push(
                                    deepClone(
                                        snapshot
                                    )
                                );

                                return false;
                            }

                            return true;
                        }
                    );

            return {
                removedCount:
                    removed.length,

                remainingCount:
                    transactionState
                        .snapshots
                        .length,

                removed,

                cleanedAt:
                    Date.now()
            };
        };

    /* ======================================================================
       SECTION 118
       DUPLICATE CLOSURE DETECTION
       ====================================================================== */

    ClosureClass.prototype.isDuplicateClosure =
        function isDuplicateClosure(
            closure,
            options = {}
        ) {
            const transactionState =
                this.ensureTransactionState();

            const duplicateWindowMs =
                Math.max(
                    1000,
                    toFiniteNumber(
                        options.duplicateWindowMs,
                        DEFAULT_DUPLICATE_WINDOW_MS
                    )
                );

            const fingerprint =
                buildClosureFingerprint(
                    closure,
                    options
                );

            const now =
                Date.now();

            transactionState
                .recentFingerprints =
                transactionState
                    .recentFingerprints
                    .filter(
                        (record) => {
                            return (
                                now -
                                record.timestamp <=
                                duplicateWindowMs
                            );
                        }
                    );

            const duplicate =
                transactionState
                    .recentFingerprints
                    .find(
                        (record) => {
                            return (
                                record.fingerprint ===
                                fingerprint
                            );
                        }
                    );

            return {
                duplicate:
                    Boolean(
                        duplicate
                    ),

                fingerprint,

                previous:
                    duplicate
                        ? deepClone(
                            duplicate
                        )
                        : null
            };
        };

    /* ======================================================================
       SECTION 119
       REGISTER CLOSURE FINGERPRINT
       ====================================================================== */

    ClosureClass.prototype.registerClosureFingerprint =
        function registerClosureFingerprint(
            closure,
            transaction = null
        ) {
            const transactionState =
                this.ensureTransactionState();

            const fingerprint =
                buildClosureFingerprint(
                    closure
                );

            const record = {
                fingerprint,

                closureId:
                    closure?.id ||
                    null,

                transactionId:
                    transaction?.id ||
                    null,

                timestamp:
                    Date.now()
            };

            transactionState
                .recentFingerprints
                .push(record);

            transactionState
                .recentFingerprints =
                transactionState
                    .recentFingerprints
                    .slice(-100);

            return record;
        };

    /* ======================================================================
       SECTION 120
       BEGIN TRANSACTION
       ====================================================================== */

    ClosureClass.prototype.beginClosureTransaction =
        async function beginClosureTransaction(
            closure =
                this.state
                    .activeClosure,
            options = {}
        ) {
            if (!closure) {
                throw createClosureError(
                    "No active closure exists for transaction creation.",
                    "NO_ACTIVE_CLOSURE"
                );
            }

            const transactionState =
                this.ensureTransactionState();

            if (
                transactionState
                    .activeTransaction
            ) {
                throw createClosureError(
                    "A recovery closure transaction is already active.",
                    "TRANSACTION_ALREADY_ACTIVE"
                );
            }

            const duplicateCheck =
                this.isDuplicateClosure(
                    closure,
                    options
                );

            if (
                duplicateCheck.duplicate &&
                options.allowDuplicate !==
                true
            ) {
                throw createClosureError(
                    "A duplicate recovery closure was detected.",
                    "DUPLICATE_CLOSURE"
                );
            }

            const transaction =
                createTransactionRecord(
                    closure.id,
                    options
                );

            transaction.startedAt =
                Date.now();

            transaction.status =
                TRANSACTION_STATUS.ACTIVE;

            transactionState
                .activeTransaction =
                transaction;

            transactionState.status =
                TRANSACTION_STATUS.ACTIVE;

            const lock =
                await this
                    .acquireResourceLock(
                        transaction.id,
                        transaction.resources,
                        {
                            timeoutMs:
                                options.lockTimeoutMs ||
                                DEFAULT_RESOURCE_LOCK_TIMEOUT_MS,

                            ttlMs:
                                options.lockTtlMs ||
                                DEFAULT_RESOURCE_LOCK_TTL_MS,

                            retryIntervalMs:
                                options.lockRetryIntervalMs ||
                                DEFAULT_LOCK_RETRY_INTERVAL_MS,

                            metadata: {
                                closureId:
                                    closure.id,

                                transactionId:
                                    transaction.id
                            }
                        }
                    );

            transaction.lockId =
                lock.id;

            const snapshot =
                this.captureCoreSnapshot(
                    transaction,
                    {
                        metadata: {
                            closureId:
                                closure.id,

                            reason:
                                closure.reason
                        }
                    }
                );

            transaction.snapshotId =
                snapshot.id;

            this.registerClosureFingerprint(
                closure,
                transaction
            );

            closure.transactionId =
                transaction.id;

            closure.snapshotId =
                snapshot.id;

            closure.lockId =
                lock.id;

            if (
                typeof this.core.emit ===
                "function"
            ) {
                this.core.emit(
                    CORE_EVENTS
                        .CLOSURE_TRANSACTION_STARTED ||
                    "closure_transaction_started",
                    {
                        transaction:
                            deepClone(
                                transaction
                            ),

                        timestamp:
                            Date.now()
                    }
                );
            }

            return deepClone(
                transaction
            );
        };

    /* ======================================================================
       SECTION 121
       RECORD TRANSACTION OPERATION
       ====================================================================== */

    ClosureClass.prototype.recordTransactionOperation =
        function recordTransactionOperation(
            operation,
            metadata = {}
        ) {
            const transactionState =
                this.ensureTransactionState();

            const transaction =
                transactionState
                    .activeTransaction;

            if (!transaction) {
                return null;
            }

            const record = {
                operation:
                    operation ||
                    "unknown",

                timestamp:
                    Date.now(),

                metadata:
                    deepClone(
                        safeObject(metadata)
                    )
            };

            transaction.operations.push(
                record
            );

            return record;
        };

    /* ======================================================================
       SECTION 122
       COMMIT TRANSACTION
       ====================================================================== */

    ClosureClass.prototype.commitClosureTransaction =
        function commitClosureTransaction(
            transactionId = null
        ) {
            const transactionState =
                this.ensureTransactionState();

            const transaction =
                transactionState
                    .activeTransaction;

            if (
                !transaction ||
                (
                    transactionId &&
                    transaction.id !==
                    transactionId
                )
            ) {
                throw createClosureError(
                    "Active recovery closure transaction was not found.",
                    "TRANSACTION_NOT_FOUND"
                );
            }

            transaction.status =
                TRANSACTION_STATUS.COMMITTING;

            transactionState.status =
                TRANSACTION_STATUS.COMMITTING;

            this.recordTransactionOperation(
                "commit_started"
            );

            if (
                transaction.lockId
            ) {
                this.releaseResourceLock(
                    transaction.lockId
                );
            }

            if (
                transaction.snapshotId
            ) {
                this.discardSnapshot(
                    transaction.snapshotId
                );
            }

            transaction.status =
                TRANSACTION_STATUS.COMMITTED;

            transaction.committedAt =
                Date.now();

            transaction.completedAt =
                transaction.committedAt;

            transaction.durationMs =
                Math.max(
                    0,
                    transaction.completedAt -
                    transaction.startedAt
                );

            transactionState
                .totalTransactions +=
                1;

            transactionState
                .committedTransactions +=
                1;

            transactionState
                .lastTransaction =
                deepClone(
                    transaction
                );

            transactionState
                .transactionHistory
                .push(
                    deepClone(
                        transaction
                    )
                );

            transactionState
                .transactionHistory =
                transactionState
                    .transactionHistory
                    .slice(
                        -DEFAULT_MAX_TRANSACTION_HISTORY
                    );

            transactionState
                .activeTransaction =
                null;

            transactionState.status =
                TRANSACTION_STATUS.COMMITTED;

            if (
                typeof this.core.emit ===
                "function"
            ) {
                this.core.emit(
                    CORE_EVENTS
                        .CLOSURE_TRANSACTION_COMMITTED ||
                    "closure_transaction_committed",
                    {
                        transaction:
                            deepClone(
                                transaction
                            ),

                        timestamp:
                            Date.now()
                    }
                );
            }

            return deepClone(
                transaction
            );
        };

    /* ======================================================================
       SECTION 123
       ROLLBACK TRANSACTION
       ====================================================================== */

    ClosureClass.prototype.rollbackClosureTransaction =
        function rollbackClosureTransaction(
            error = null,
            transactionId = null
        ) {
            const transactionState =
                this.ensureTransactionState();

            const transaction =
                transactionState
                    .activeTransaction;

            if (
                !transaction ||
                (
                    transactionId &&
                    transaction.id !==
                    transactionId
                )
            ) {
                throw createClosureError(
                    "Active recovery closure transaction was not found.",
                    "TRANSACTION_NOT_FOUND"
                );
            }

            transaction.status =
                TRANSACTION_STATUS
                    .ROLLING_BACK;

            transactionState.status =
                TRANSACTION_STATUS
                    .ROLLING_BACK;

            this.recordTransactionOperation(
                "rollback_started",
                {
                    error:
                        error
                            ? normalizeClosureError(
                                error
                            )
                            : null
                }
            );

            let restoredSnapshot =
                null;

            if (
                transaction.snapshotId
            ) {
                restoredSnapshot =
                    this.restoreCoreSnapshot(
                        transaction.snapshotId,
                        {
                            metadata: {
                                transactionId:
                                    transaction.id,

                                rollbackReason:
                                    error
                                        ?.message ||
                                    "transaction_failure"
                            }
                        }
                    );
            }

            if (
                transaction.lockId
            ) {
                this.releaseResourceLock(
                    transaction.lockId
                );
            }

            if (error) {
                transaction.errors.push(
                    normalizeClosureError(
                        error
                    )
                );
            }

            transaction.status =
                TRANSACTION_STATUS
                    .ROLLED_BACK;

            transaction.rolledBackAt =
                Date.now();

            transaction.completedAt =
                transaction.rolledBackAt;

            transaction.durationMs =
                Math.max(
                    0,
                    transaction.completedAt -
                    transaction.startedAt
                );

            transactionState
                .totalTransactions +=
                1;

            transactionState
                .rolledBackTransactions +=
                1;

            transactionState
                .lastTransaction =
                deepClone(
                    transaction
                );

            transactionState
                .transactionHistory
                .push(
                    deepClone(
                        transaction
                    )
                );

            transactionState
                .transactionHistory =
                transactionState
                    .transactionHistory
                    .slice(
                        -DEFAULT_MAX_TRANSACTION_HISTORY
                    );

            transactionState
                .activeTransaction =
                null;

            transactionState.status =
                TRANSACTION_STATUS
                    .ROLLED_BACK;

            if (
                typeof this.core.emit ===
                "function"
            ) {
                this.core.emit(
                    CORE_EVENTS
                        .CLOSURE_TRANSACTION_ROLLED_BACK ||
                    "closure_transaction_rolled_back",
                    {
                        transaction:
                            deepClone(
                                transaction
                            ),

                        snapshot:
                            restoredSnapshot,

                        timestamp:
                            Date.now()
                    }
                );
            }

            return {
                transaction:
                    deepClone(
                        transaction
                    ),

                restoredSnapshot:
                    deepClone(
                        restoredSnapshot
                    )
            };
        };

    /* ======================================================================
       SECTION 124
       EXECUTE TRANSACTIONAL CLOSURE
       ====================================================================== */

    ClosureClass.prototype.executeTransactionalClosure =
        async function executeTransactionalClosure(
            options = {}
        ) {
            const safeOptions =
                safeObject(options);

            let closure =
                null;

            let transaction =
                null;

            try {
                closure =
                    this.prepareClosure(
                        safeOptions.reason,
                        safeOptions.metadata ||
                        {}
                    );

                transaction =
                    await this
                        .beginClosureTransaction(
                            closure,
                            {
                                ...safeOptions.transaction,

                                allowDuplicate:
                                    safeOptions
                                        .allowDuplicate ===
                                    true
                            }
                        );

                this.recordTransactionOperation(
                    "quality_control_started"
                );

                if (
                    safeOptions
                        .runQualityControl !==
                    false &&
                    typeof this.core
                        .executePredictionQualityControl ===
                    "function"
                ) {
                    this.core
                        .executePredictionQualityControl(
                            safeOptions.quality ||
                            {}
                        );
                }

                this.recordTransactionOperation(
                    "consolidation_started"
                );

                this.consolidateClosureData(
                    closure
                );

                this.recordTransactionOperation(
                    "cleanup_started"
                );

                this.executeCleanupAndSynchronization(
                    closure,
                    safeOptions
                );

                this.recordTransactionOperation(
                    "publication_started"
                );

                let publication = {
                    published:
                        false,

                    payload:
                        null
                };

                if (
                    safeOptions
                        .publishFinalPayload !==
                    false
                ) {
                    publication =
                        await this
                            .publishFinalPayload(
                                closure,
                                safeOptions
                            );
                }

                closure.publicationResult =
                    deepClone(
                        publication
                    );

                this.recordTransactionOperation(
                    "transaction_ready_to_commit"
                );

                this.commitClosureTransaction(
                    transaction.id
                );

                const completedClosure =
                    this.completeClosure(
                        closure,
                        safeOptions
                    );

                return {
                    success:
                        completedClosure.status ===
                        CLOSURE_STATUS.COMPLETED,

                    status:
                        completedClosure.status,

                    transactional:
                        true,

                    transactionId:
                        transaction.id,

                    closure:
                        completedClosure,

                    payload:
                        publication.payload
                            ? deepClone(
                                publication.payload
                            )
                            : null
                };
            } catch (error) {
                let rollbackResult =
                    null;

                if (
                    transaction &&
                    this.ensureTransactionState()
                        .activeTransaction
                ) {
                    try {
                        rollbackResult =
                            this
                                .rollbackClosureTransaction(
                                    error,
                                    transaction.id
                                );
                    } catch (
                        rollbackError
                    ) {
                        if (closure) {
                            closure.errors.push(
                                normalizeClosureError(
                                    rollbackError
                                )
                            );
                        }
                    }
                }

                if (
                    this.state.activeClosure
                ) {
                    const failed =
                        this.failClosure(
                            error,
                            "transactional_closure"
                        );

                    failed.transactional =
                        true;

                    failed.rollback =
                        rollbackResult;

                    return failed;
                }

                return {
                    success:
                        false,

                    status:
                        CLOSURE_STATUS.FAILED,

                    transactional:
                        true,

                    rollback:
                        rollbackResult,

                    error:
                        normalizeClosureError(
                            error
                        )
                };
            }
        };

    /* ======================================================================
       SECTION 125
       TRANSACTION STATUS
       ====================================================================== */

    ClosureClass.prototype.getTransactionStatus =
        function getTransactionStatus() {
            const transactionState =
                this.ensureTransactionState();

            return {
                status:
                    transactionState.status,

                activeTransaction:
                    transactionState
                        .activeTransaction
                        ? deepClone(
                            transactionState
                                .activeTransaction
                        )
                        : null,

                activeLockCount:
                    transactionState
                        .locks
                        .size,

                snapshotCount:
                    transactionState
                        .snapshots
                        .length,

                totalTransactions:
                    transactionState
                        .totalTransactions,

                committedTransactions:
                    transactionState
                        .committedTransactions,

                rolledBackTransactions:
                    transactionState
                        .rolledBackTransactions,

                failedTransactions:
                    transactionState
                        .failedTransactions,

                lastTransaction:
                    transactionState
                        .lastTransaction
                        ? deepClone(
                            transactionState
                                .lastTransaction
                        )
                        : null
            };
        };

    /* ======================================================================
       SECTION 126
       TRANSACTION HISTORY
       ====================================================================== */

    ClosureClass.prototype.getTransactionHistory =
        function getTransactionHistory(
            limit = 20
        ) {
            const transactionState =
                this.ensureTransactionState();

            const safeLimit =
                Math.max(
                    1,
                    Math.min(
                        DEFAULT_MAX_TRANSACTION_HISTORY,
                        Math.round(
                            toFiniteNumber(
                                limit,
                                20
                            )
                        )
                    )
                );

            return deepClone(
                transactionState
                    .transactionHistory
                    .slice(
                        -safeLimit
                    )
                    .reverse()
            );
        };

    /* ======================================================================
       SECTION 127
       SNAPSHOT LIST
       ====================================================================== */

    ClosureClass.prototype.getSnapshots =
        function getSnapshots(
            limit = 10
        ) {
            const transactionState =
                this.ensureTransactionState();

            const safeLimit =
                Math.max(
                    1,
                    Math.min(
                        DEFAULT_MAX_SNAPSHOTS,
                        Math.round(
                            toFiniteNumber(
                                limit,
                                10
                            )
                        )
                    )
                );

            return deepClone(
                transactionState
                    .snapshots
                    .slice(
                        -safeLimit
                    )
                    .reverse()
            );
        };

    /* ======================================================================
       SECTION 128
       ACTIVE LOCK LIST
       ====================================================================== */

    ClosureClass.prototype.getActiveLocks =
        function getActiveLocks() {
            const transactionState =
                this.ensureTransactionState();

            this.cleanupExpiredLocks();

            return deepClone(
                Array.from(
                    transactionState
                        .locks
                        .values()
                )
            );
        };

    /* ======================================================================
       SECTION 129
       FORCE RELEASE ALL LOCKS
       ====================================================================== */

    ClosureClass.prototype.forceReleaseAllLocks =
        function forceReleaseAllLocks() {
            const transactionState =
                this.ensureTransactionState();

            const locks =
                Array.from(
                    transactionState
                        .locks
                        .values()
                );

            locks.forEach(
                (lock) => {
                    this.releaseResourceLock(
                        lock.id
                    );
                }
            );

            return {
                releasedCount:
                    locks.length,

                releasedAt:
                    Date.now()
            };
        };

    /* ======================================================================
       SECTION 130
       API EXTENSIONS
       ====================================================================== */

    const ClosureApi =
        global
            .RainArrivalRecoveryClosureAPI ||
        global
            .RainGuardRecoveryClosureAPI;

    if (ClosureApi) {
        ClosureApi.runTransactional =
            function runTransactional(
                options = {}
            ) {
                return this
                    .requireInstance()
                    .executeTransactionalClosure(
                        options
                    );
            };

        ClosureApi.getTransactionStatus =
            function getTransactionStatus() {
                return this
                    .requireInstance()
                    .getTransactionStatus();
            };

        ClosureApi.getTransactionHistory =
            function getTransactionHistory(
                limit = 20
            ) {
                return this
                    .requireInstance()
                    .getTransactionHistory(
                        limit
                    );
            };

        ClosureApi.getSnapshots =
            function getSnapshots(
                limit = 10
            ) {
                return this
                    .requireInstance()
                    .getSnapshots(
                        limit
                    );
            };

        ClosureApi.getLocks =
            function getLocks() {
                return this
                    .requireInstance()
                    .getActiveLocks();
            };

        ClosureApi.releaseLocks =
            function releaseLocks() {
                return this
                    .requireInstance()
                    .forceReleaseAllLocks();
            };
    }

    /* ======================================================================
       SECTION 131
       COMPATIBILITY ALIASES
       ====================================================================== */

    ClosureClass.prototype.runSafeClosure =
        ClosureClass.prototype
            .executeTransactionalClosure;

    ClosureClass.prototype.runProtectedClosure =
        ClosureClass.prototype
            .executeTransactionalClosure;

    ClosureClass.prototype.createSnapshot =
        ClosureClass.prototype
            .captureCoreSnapshot;

    ClosureClass.prototype.restoreSnapshot =
        ClosureClass.prototype
            .restoreCoreSnapshot;

    ClosureClass.prototype.getLocks =
        ClosureClass.prototype
            .getActiveLocks;

    ClosureClass.prototype.releaseLocks =
        ClosureClass.prototype
            .forceReleaseAllLocks;

    /* ======================================================================
       SECTION 132
       PART 5 EXPORT
       ====================================================================== */

    global.RainArrivalRecoveryClosureV32Part5 = {
        LOCK_STATUS,
        TRANSACTION_STATUS,
        SNAPSHOT_STATUS,
        DEFAULT_RESOURCE_LOCK_TIMEOUT_MS,
        DEFAULT_RESOURCE_LOCK_TTL_MS,
        DEFAULT_LOCK_RETRY_INTERVAL_MS,
        DEFAULT_TRANSACTION_TIMEOUT_MS,
        DEFAULT_SNAPSHOT_RETENTION_MS,
        DEFAULT_MAX_SNAPSHOTS,
        DEFAULT_DUPLICATE_WINDOW_MS,
        DEFAULT_MAX_TRANSACTION_HISTORY,
        TRANSACTION_RESOURCE,
        createTransactionId,
        createLockId,
        createSnapshotId,
        sleep,
        normalizeResourceList,
        createLockRecord,
        createTransactionRecord,
        buildClosureFingerprint,
        isLockExpired
    };

})(window);
        isArchiveRecordExpired,
        getPredictionArchiveReason,
        getCellArchiveReason,
        buildPredictionIdentity,
        buildCellIdentity
    };

})(window);

/* ==========================================================================
   RainGuard AI
   Long Horizon Forecast Engine V32

   Recovery Closure Engine V32

   PART 6
   Integrity Validation + Audit Trail + Health Monitoring +
   Self-Healing + Final Diagnostics
   ========================================================================== */

(function extendRainArrivalRecoveryClosureV32Part6(global) {
    "use strict";

    /* ======================================================================
       SECTION 133
       DEPENDENCY RESOLUTION
       ====================================================================== */

    const CoreClass =
        global.RainArrivalRecoveryCoreV32;

    const ClosureClass =
        global.RainArrivalRecoveryClosureV32;

    const ClosureConstants =
        global.RainArrivalRecoveryClosureV32Constants;

    const ClosureUtils =
        global.RainArrivalRecoveryClosureV32Utils;

    const CoreUtils =
        global.RainArrivalRecoveryCoreV32Utils;

    const CoreConstants =
        global.RainArrivalRecoveryCoreV32Constants;

    if (
        typeof CoreClass !== "function" ||
        typeof ClosureClass !== "function" ||
        !ClosureConstants ||
        !ClosureUtils ||
        !CoreUtils ||
        !CoreConstants
    ) {
        throw new Error(
            "RainArrivalRecoveryClosureV32 Parts 1 to 5 must be loaded before Part 6."
        );
    }

    const {
        CLOSURE_STATUS
    } = ClosureConstants;

    const {
        normalizeClosureError
    } = ClosureUtils;

    const {
        toFiniteNumber,
        clamp,
        safeArray,
        safeObject,
        deepClone
    } = CoreUtils;

    const {
        CORE_EVENTS
    } = CoreConstants;

    /* ======================================================================
       SECTION 134
       INTEGRITY CONSTANTS
       ====================================================================== */

    const INTEGRITY_STATUS =
        Object.freeze({
            HEALTHY:
                "healthy",

            DEGRADED:
                "degraded",

            UNHEALTHY:
                "unhealthy",

            CRITICAL:
                "critical",

            UNKNOWN:
                "unknown"
        });

    const AUDIT_LEVEL =
        Object.freeze({
            DEBUG:
                "debug",

            INFO:
                "info",

            WARNING:
                "warning",

            ERROR:
                "error",

            CRITICAL:
                "critical"
        });

    const SELF_HEAL_ACTION =
        Object.freeze({
            NONE:
                "none",

            REBUILD_DASHBOARD:
                "rebuild_dashboard",

            REBUILD_FRONTEND:
                "rebuild_frontend",

            CLEAN_DUPLICATES:
                "clean_duplicates",

            CLEAN_INVALID_PREDICTIONS:
                "clean_invalid_predictions",

            CLEAN_INVALID_CELLS:
                "clean_invalid_cells",

            RELEASE_EXPIRED_LOCKS:
                "release_expired_locks",

            CLEAN_EXPIRED_SNAPSHOTS:
                "clean_expired_snapshots",

            RESET_CLOSURE_STATE:
                "reset_closure_state",

            RESTORE_LAST_SNAPSHOT:
                "restore_last_snapshot"
        });

    const DEFAULT_MAX_AUDIT_RECORDS =
        1000;

    const DEFAULT_MAX_DIAGNOSTIC_RECORDS =
        200;

    const DEFAULT_MIN_HEALTH_SCORE =
        0.70;

    const DEFAULT_CRITICAL_HEALTH_SCORE =
        0.30;

    const DEFAULT_MAX_INVALID_RATIO =
        0.20;

    const DEFAULT_MAX_DUPLICATE_RATIO =
        0.15;

    const DEFAULT_SELF_HEAL_COOLDOWN_MS =
        60 * 1000;

    const DEFAULT_HEALTH_HISTORY_LIMIT =
        200;

    /* ======================================================================
       SECTION 135
       INTEGRITY HELPERS
       ====================================================================== */

    function createAuditId() {
        return (
            "closure_audit_" +
            Date.now() +
            "_" +
            Math.random()
                .toString(36)
                .slice(2, 9)
        );
    }

    function createDiagnosticId() {
        return (
            "closure_diagnostic_" +
            Date.now() +
            "_" +
            Math.random()
                .toString(36)
                .slice(2, 9)
        );
    }

    function normalizeAuditLevel(
        level
    ) {
        const levels =
            Object.values(
                AUDIT_LEVEL
            );

        return levels.includes(
            level
        )
            ? level
            : AUDIT_LEVEL.INFO;
    }

    function calculateRatio(
        numerator,
        denominator
    ) {
        const safeDenominator =
            toFiniteNumber(
                denominator,
                0
            );

        if (
            safeDenominator <=
            0
        ) {
            return 0;
        }

        return clamp(
            toFiniteNumber(
                numerator,
                0
            ) /
            safeDenominator,
            0,
            1
        );
    }

    function classifyHealthScore(
        score
    ) {
        const normalized =
            clamp(
                toFiniteNumber(
                    score,
                    0
                ),
                0,
                1
            );

        if (
            normalized >=
            0.85
        ) {
            return INTEGRITY_STATUS.HEALTHY;
        }

        if (
            normalized >=
            0.60
        ) {
            return INTEGRITY_STATUS.DEGRADED;
        }

        if (
            normalized >=
            0.30
        ) {
            return INTEGRITY_STATUS.UNHEALTHY;
        }

        return INTEGRITY_STATUS.CRITICAL;
    }

    function isValidPredictionRecord(
        prediction
    ) {
        if (
            !prediction ||
            typeof prediction !==
            "object"
        ) {
            return false;
        }

        const hasLocation =
            Boolean(
                prediction.locationId ||
                prediction.locationName ||
                prediction.city ||
                prediction.name
            );

        const hasStatus =
            Boolean(
                prediction.status ||
                prediction.rainingNow ===
                true
            );

        const etaValid =
            prediction.etaHours ==
            null ||
            Number.isFinite(
                Number(
                    prediction.etaHours
                )
            );

        const confidenceValid =
            prediction.confidence ==
            null ||
            (
                Number.isFinite(
                    Number(
                        prediction.confidence
                    )
                ) &&
                Number(
                    prediction.confidence
                ) >= 0
            );

        return (
            hasLocation &&
            hasStatus &&
            etaValid &&
            confidenceValid
        );
    }

    function isValidCellRecord(
        cell
    ) {
        if (
            !cell ||
            typeof cell !==
            "object"
        ) {
            return false;
        }

        const hasIdentity =
            Boolean(
                cell.id ||
                cell.trackingId
            );

        const latitude =
            Number(
                cell.latitude
            );

        const longitude =
            Number(
                cell.longitude
            );

        const validCoordinates =
            Number.isFinite(
                latitude
            ) &&
            Number.isFinite(
                longitude
            ) &&
            latitude >= -90 &&
            latitude <= 90 &&
            longitude >= -180 &&
            longitude <= 180;

        return (
            hasIdentity &&
            validCoordinates
        );
    }

    function buildSimplePredictionKey(
        prediction
    ) {
        return [
            prediction?.locationId ||
            prediction?.locationName ||
            prediction?.city ||
            "",

            prediction?.trackingId ||
            prediction?.cellId ||
            "",

            prediction?.status ||
            "",

            Math.round(
                toFiniteNumber(
                    prediction?.etaMinutes,
                    toFiniteNumber(
                        prediction?.etaHours,
                        0
                    ) *
                    60
                )
            )
        ].join("|");
    }

    function buildSimpleCellKey(
        cell
    ) {
        return (
            cell?.trackingId ||
            cell?.id ||
            [
                Number(
                    cell?.latitude
                ).toFixed(3),

                Number(
                    cell?.longitude
                ).toFixed(3)
            ].join("|")
        );
    }

    function detectDuplicateCount(
        records,
        keyResolver
    ) {
        const seen =
            new Set();

        let duplicateCount =
            0;

        safeArray(records)
            .forEach(
                (record) => {
                    const key =
                        keyResolver(
                            record
                        );

                    if (
                        !key
                    ) {
                        return;
                    }

                    if (
                        seen.has(key)
                    ) {
                        duplicateCount +=
                            1;

                        return;
                    }

                    seen.add(key);
                }
            );

        return duplicateCount;
    }

    /* ======================================================================
       SECTION 136
       ENSURE DIAGNOSTIC STATE
       ====================================================================== */

    ClosureClass.prototype.ensureDiagnosticState =
        function ensureDiagnosticState() {
            if (
                !this.state.diagnostics
            ) {
                this.state.diagnostics = {
                    auditLog: [],

                    healthHistory: [],

                    diagnosticHistory: [],

                    lastHealthReport:
                        null,

                    lastIntegrityReport:
                        null,

                    lastSelfHealReport:
                        null,

                    lastSelfHealAt:
                        null,

                    totalSelfHealRuns:
                        0,

                    successfulSelfHealRuns:
                        0,

                    failedSelfHealRuns:
                        0
                };
            }

            if (
                !Array.isArray(
                    this.state
                        .diagnostics
                        .auditLog
                )
            ) {
                this.state
                    .diagnostics
                    .auditLog = [];
            }

            if (
                !Array.isArray(
                    this.state
                        .diagnostics
                        .healthHistory
                )
            ) {
                this.state
                    .diagnostics
                    .healthHistory = [];
            }

            if (
                !Array.isArray(
                    this.state
                        .diagnostics
                        .diagnosticHistory
                )
            ) {
                this.state
                    .diagnostics
                    .diagnosticHistory = [];
            }

            return this.state
                .diagnostics;
        };

    /* ======================================================================
       SECTION 137
       WRITE AUDIT RECORD
       ====================================================================== */

    ClosureClass.prototype.writeAuditRecord =
        function writeAuditRecord(
            action,
            level =
                AUDIT_LEVEL.INFO,
            metadata = {}
        ) {
            const diagnosticState =
                this.ensureDiagnosticState();

            const record = {
                id:
                    createAuditId(),

                action:
                    action ||
                    "unknown",

                level:
                    normalizeAuditLevel(
                        level
                    ),

                closureId:
                    this.state
                        .activeClosure
                        ?.id ||
                    this.state
                        .lastClosure
                        ?.id ||
                    null,

                transactionId:
                    this.state
                        .transaction
                        ?.activeTransaction
                        ?.id ||
                    null,

                metadata:
                    deepClone(
                        safeObject(
                            metadata
                        )
                    ),

                timestamp:
                    Date.now(),

                timestampIso:
                    new Date()
                        .toISOString()
            };

            diagnosticState
                .auditLog
                .push(record);

            diagnosticState
                .auditLog =
                diagnosticState
                    .auditLog
                    .slice(
                        -DEFAULT_MAX_AUDIT_RECORDS
                    );

            return deepClone(
                record
            );
        };

    /* ======================================================================
       SECTION 138
       GET AUDIT LOG
       ====================================================================== */

    ClosureClass.prototype.getAuditLog =
        function getAuditLog(
            options = {}
        ) {
            const diagnosticState =
                this.ensureDiagnosticState();

            const safeOptions =
                safeObject(options);

            const limit =
                Math.max(
                    1,
                    Math.min(
                        DEFAULT_MAX_AUDIT_RECORDS,
                        Math.round(
                            toFiniteNumber(
                                safeOptions.limit,
                                100
                            )
                        )
                    )
                );

            let records =
                diagnosticState
                    .auditLog
                    .slice();

            if (
                safeOptions.level
            ) {
                records =
                    records.filter(
                        (record) => {
                            return (
                                record.level ===
                                safeOptions.level
                            );
                        }
                    );
            }

            if (
                safeOptions.action
            ) {
                records =
                    records.filter(
                        (record) => {
                            return String(
                                record.action
                            ).includes(
                                String(
                                    safeOptions.action
                                )
                            );
                        }
                    );
            }

            return deepClone(
                records
                    .slice(
                        -limit
                    )
                    .reverse()
            );
        };

    /* ======================================================================
       SECTION 139
       VALIDATE PREDICTION INTEGRITY
       ====================================================================== */

    ClosureClass.prototype.validatePredictionIntegrity =
        function validatePredictionIntegrity() {
            const predictions =
                safeArray(
                    this.core.state
                        .arrivalPredictions
                );

            const invalid =
                predictions.filter(
                    (prediction) => {
                        return !isValidPredictionRecord(
                            prediction
                        );
                    }
                );

            const duplicateCount =
                detectDuplicateCount(
                    predictions,
                    buildSimplePredictionKey
                );

            const invalidRatio =
                calculateRatio(
                    invalid.length,
                    predictions.length
                );

            const duplicateRatio =
                calculateRatio(
                    duplicateCount,
                    predictions.length
                );

            return {
                total:
                    predictions.length,

                validCount:
                    predictions.length -
                    invalid.length,

                invalidCount:
                    invalid.length,

                invalidRatio,

                duplicateCount,

                duplicateRatio,

                invalidRecords:
                    deepClone(
                        invalid.slice(
                            0,
                            50
                        )
                    ),

                healthy:
                    invalidRatio <=
                    DEFAULT_MAX_INVALID_RATIO &&
                    duplicateRatio <=
                    DEFAULT_MAX_DUPLICATE_RATIO,

                checkedAt:
                    Date.now()
            };
        };

    /* ======================================================================
       SECTION 140
       VALIDATE CELL INTEGRITY
       ====================================================================== */

    ClosureClass.prototype.validateCellIntegrity =
        function validateCellIntegrity() {
            const cells =
                Array.from(
                    this.core.cells
                        ?.values?.() ||
                    []
                );

            const invalid =
                cells.filter(
                    (cell) => {
                        return !isValidCellRecord(
                            cell
                        );
                    }
                );

            const duplicateCount =
                detectDuplicateCount(
                    cells,
                    buildSimpleCellKey
                );

            const invalidRatio =
                calculateRatio(
                    invalid.length,
                    cells.length
                );

            const duplicateRatio =
                calculateRatio(
                    duplicateCount,
                    cells.length
                );

            return {
                total:
                    cells.length,

                validCount:
                    cells.length -
                    invalid.length,

                invalidCount:
                    invalid.length,

                invalidRatio,

                duplicateCount,

                duplicateRatio,

                invalidRecords:
                    deepClone(
                        invalid.slice(
                            0,
                            50
                        )
                    ),

                healthy:
                    invalidRatio <=
                    DEFAULT_MAX_INVALID_RATIO &&
                    duplicateRatio <=
                    DEFAULT_MAX_DUPLICATE_RATIO,

                checkedAt:
                    Date.now()
            };
        };

    /* ======================================================================
       SECTION 141
       VALIDATE HORIZON INTEGRITY
       ====================================================================== */

    ClosureClass.prototype.validateHorizonIntegrity =
        function validateHorizonIntegrity() {
            const horizons =
                this.core.state
                    .horizonForecasts ||
                {};

            const requiredHorizons = [
                6,
                12,
                24,
                48,
                72
            ];

            const missingHorizons = [];

            requiredHorizons.forEach(
                (hours) => {
                    const direct =
                        horizons[hours];

                    const hourKey =
                        horizons[
                            `${hours}h`
                        ];

                    const namedKey =
                        horizons[
                            `hours${hours}`
                        ];

                    if (
                        direct ==
                        null &&
                        hourKey ==
                        null &&
                        namedKey ==
                        null
                    ) {
                        missingHorizons.push(
                            hours
                        );
                    }
                }
            );

            return {
                requiredHorizons,

                missingHorizons,

                availableHorizonCount:
                    requiredHorizons.length -
                    missingHorizons.length,

                complete:
                    missingHorizons.length ===
                    0,

                checkedAt:
                    Date.now()
            };
        };

    /* ======================================================================
       SECTION 142
       VALIDATE DASHBOARD INTEGRITY
       ====================================================================== */

    ClosureClass.prototype.validateDashboardIntegrity =
        function validateDashboardIntegrity() {
            const dashboard =
                this.core.state
                    .nationalArrivalDashboard;

            const regions =
                safeArray(
                    this.core.state
                        .regionSummaries
                );

            const governorates =
                safeArray(
                    this.core.state
                        .governorateSummaries
                );

            const dashboardExists =
                Boolean(
                    dashboard &&
                    typeof dashboard ===
                    "object"
                );

            const summaryExists =
                Boolean(
                    dashboard?.summary
                );

            return {
                dashboardExists,

                summaryExists,

                regionSummaryCount:
                    regions.length,

                governorateSummaryCount:
                    governorates.length,

                healthy:
                    dashboardExists &&
                    summaryExists,

                checkedAt:
                    Date.now()
            };
        };

    /* ======================================================================
       SECTION 143
       VALIDATE LOCK INTEGRITY
       ====================================================================== */

    ClosureClass.prototype.validateLockIntegrity =
        function validateLockIntegrity() {
            const transactionState =
                typeof this
                    .ensureTransactionState ===
                "function"
                    ? this
                        .ensureTransactionState()
                    : null;

            if (!transactionState) {
                return {
                    supported:
                        false,

                    healthy:
                        true,

                    checkedAt:
                        Date.now()
                };
            }

            const expiredCleanup =
                this.cleanupExpiredLocks();

            const activeLocks =
                this.getActiveLocks();

            return {
                supported:
                    true,

                activeLockCount:
                    activeLocks.length,

                expiredLockCount:
                    expiredCleanup
                        .expiredCount,

                activeLocks,

                healthy:
                    activeLocks.length <=
                    1,

                checkedAt:
                    Date.now()
            };
        };

    /* ======================================================================
       SECTION 144
       RUN FULL INTEGRITY VALIDATION
       ====================================================================== */

    ClosureClass.prototype.runIntegrityValidation =
        function runIntegrityValidation(
            options = {}
        ) {
            const diagnosticState =
                this.ensureDiagnosticState();

            const predictions =
                this.validatePredictionIntegrity();

            const cells =
                this.validateCellIntegrity();

            const horizons =
                this.validateHorizonIntegrity();

            const dashboard =
                this.validateDashboardIntegrity();

            const locks =
                this.validateLockIntegrity();

            const failures = [];

            if (!predictions.healthy) {
                failures.push(
                    "prediction_integrity"
                );
            }

            if (!cells.healthy) {
                failures.push(
                    "cell_integrity"
                );
            }

            if (!horizons.complete) {
                failures.push(
                    "horizon_integrity"
                );
            }

            if (!dashboard.healthy) {
                failures.push(
                    "dashboard_integrity"
                );
            }

            if (!locks.healthy) {
                failures.push(
                    "lock_integrity"
                );
            }

            const passedChecks =
                5 -
                failures.length;

            const healthScore =
                clamp(
                    passedChecks /
                    5,
                    0,
                    1
                );

            const report = {
                id:
                    createDiagnosticId(),

                status:
                    classifyHealthScore(
                        healthScore
                    ),

                healthScore,

                passedChecks,

                failedChecks:
                    failures.length,

                failures,

                predictions,

                cells,

                horizons,

                dashboard,

                locks,

                generatedAt:
                    Date.now(),

                generatedIso:
                    new Date()
                        .toISOString()
            };

            diagnosticState
                .lastIntegrityReport =
                deepClone(
                    report
                );

            diagnosticState
                .diagnosticHistory
                .push(
                    deepClone(
                        report
                    )
                );

            diagnosticState
                .diagnosticHistory =
                diagnosticState
                    .diagnosticHistory
                    .slice(
                        -DEFAULT_MAX_DIAGNOSTIC_RECORDS
                    );

            this.writeAuditRecord(
                "integrity_validation_completed",
                failures.length
                    ? AUDIT_LEVEL.WARNING
                    : AUDIT_LEVEL.INFO,
                {
                    status:
                        report.status,

                    healthScore,

                    failures
                }
            );

            return report;
        };

    /* ======================================================================
       SECTION 145
       BUILD CLOSURE HEALTH REPORT
       ====================================================================== */

    ClosureClass.prototype.buildClosureHealthReport =
        function buildClosureHealthReport() {
            const diagnosticState =
                this.ensureDiagnosticState();

            const integrity =
                this.runIntegrityValidation();

            const closureStatus =
                this.getStatus();

            const transactionStatus =
                typeof this
                    .getTransactionStatus ===
                "function"
                    ? this
                        .getTransactionStatus()
                    : null;

            const automaticStatus =
                typeof this
                    .getAutomaticIntegrationStatus ===
                "function"
                    ? this
                        .getAutomaticIntegrationStatus()
                    : null;

            const failurePenalty =
                clamp(
                    toFiniteNumber(
                        closureStatus
                            .failedClosures,
                        0
                    ) *
                    0.03,
                    0,
                    0.30
                );

            const rollbackPenalty =
                clamp(
                    toFiniteNumber(
                        transactionStatus
                            ?.rolledBackTransactions,
                        0
                    ) *
                    0.02,
                    0,
                    0.20
                );

            const automaticFailurePenalty =
                clamp(
                    toFiniteNumber(
                        automaticStatus
                            ?.failedAutomaticClosures,
                        0
                    ) *
                    0.02,
                    0,
                    0.20
                );

            const finalScore =
                clamp(
                    integrity.healthScore -
                    failurePenalty -
                    rollbackPenalty -
                    automaticFailurePenalty,
                    0,
                    1
                );

            const report = {
                status:
                    classifyHealthScore(
                        finalScore
                    ),

                score:
                    finalScore,

                integrityScore:
                    integrity
                        .healthScore,

                penalties: {
                    failurePenalty,

                    rollbackPenalty,

                    automaticFailurePenalty
                },

                closure: {
                    status:
                        closureStatus.status,

                    totalClosures:
                        closureStatus
                            .totalClosures,

                    successfulClosures:
                        closureStatus
                            .successfulClosures,

                    partialClosures:
                        closureStatus
                            .partialClosures,

                    failedClosures:
                        closureStatus
                            .failedClosures
                },

                transaction:
                    transactionStatus
                        ? deepClone(
                            transactionStatus
                        )
                        : null,

                automatic:
                    automaticStatus
                        ? deepClone(
                            automaticStatus
                        )
                        : null,

                integrity:
                    deepClone(
                        integrity
                    ),

                generatedAt:
                    Date.now()
            };

            diagnosticState
                .lastHealthReport =
                deepClone(
                    report
                );

            diagnosticState
                .healthHistory
                .push(
                    deepClone(
                        report
                    )
                );

            diagnosticState
                .healthHistory =
                diagnosticState
                    .healthHistory
                    .slice(
                        -DEFAULT_HEALTH_HISTORY_LIMIT
                    );

            return report;
        };

    /* ======================================================================
       SECTION 146
       CLEAN DUPLICATE PREDICTIONS
       ====================================================================== */

    ClosureClass.prototype.cleanDuplicatePredictions =
        function cleanDuplicatePredictions() {
            const predictions =
                safeArray(
                    this.core.state
                        .arrivalPredictions
                );

            const seen =
                new Set();

            const unique = [];

            predictions.forEach(
                (prediction) => {
                    const key =
                        buildSimplePredictionKey(
                            prediction
                        );

                    if (
                        seen.has(key)
                    ) {
                        return;
                    }

                    seen.add(key);

                    unique.push(
                        prediction
                    );
                }
            );

            this.core.state
                .arrivalPredictions =
                deepClone(
                    unique
                );

            return {
                beforeCount:
                    predictions.length,

                afterCount:
                    unique.length,

                removedCount:
                    predictions.length -
                    unique.length
            };
        };

    /* ======================================================================
       SECTION 147
       CLEAN INVALID PREDICTIONS
       ====================================================================== */

    ClosureClass.prototype.cleanInvalidPredictions =
        function cleanInvalidPredictions() {
            const predictions =
                safeArray(
                    this.core.state
                        .arrivalPredictions
                );

            const valid =
                predictions.filter(
                    isValidPredictionRecord
                );

            this.core.state
                .arrivalPredictions =
                deepClone(
                    valid
                );

            return {
                beforeCount:
                    predictions.length,

                afterCount:
                    valid.length,

                removedCount:
                    predictions.length -
                    valid.length
            };
        };

    /* ======================================================================
       SECTION 148
       CLEAN DUPLICATE CELLS
       ====================================================================== */

    ClosureClass.prototype.cleanDuplicateCells =
        function cleanDuplicateCells() {
            const entries =
                Array.from(
                    this.core.cells
                        ?.entries?.() ||
                    []
                );

            const seen =
                new Set();

            const uniqueEntries = [];

            entries.forEach(
                (entry) => {
                    const cell =
                        entry[1];

                    const key =
                        buildSimpleCellKey(
                            cell
                        );

                    if (
                        seen.has(key)
                    ) {
                        return;
                    }

                    seen.add(key);

                    uniqueEntries.push(
                        entry
                    );
                }
            );

            this.core.cells =
                new Map(
                    uniqueEntries
                );

            this.core.state
                .rainCells =
                deepClone(
                    uniqueEntries.map(
                        (entry) => {
                            return entry[1];
                        }
                    )
                );

            return {
                beforeCount:
                    entries.length,

                afterCount:
                    uniqueEntries.length,

                removedCount:
                    entries.length -
                    uniqueEntries.length
            };
        };

    /* ======================================================================
       SECTION 149
       CLEAN INVALID CELLS
       ====================================================================== */

    ClosureClass.prototype.cleanInvalidCells =
        function cleanInvalidCells() {
            const entries =
                Array.from(
                    this.core.cells
                        ?.entries?.() ||
                    []
                );

            const validEntries =
                entries.filter(
                    (entry) => {
                        return isValidCellRecord(
                            entry[1]
                        );
                    }
                );

            this.core.cells =
                new Map(
                    validEntries
                );

            this.core.state
                .rainCells =
                deepClone(
                    validEntries.map(
                        (entry) => {
                            return entry[1];
                        }
                    )
                );

            return {
                beforeCount:
                    entries.length,

                afterCount:
                    validEntries.length,

                removedCount:
                    entries.length -
                    validEntries.length
            };
        };

    /* ======================================================================
       SECTION 150
       RESOLVE SELF-HEAL ACTIONS
       ====================================================================== */

    ClosureClass.prototype.resolveSelfHealActions =
        function resolveSelfHealActions(
            integrityReport
        ) {
            const actions = [];

            const report =
                integrityReport ||
                this.runIntegrityValidation();

            if (
                report.predictions
                    .duplicateRatio >
                DEFAULT_MAX_DUPLICATE_RATIO
            ) {
                actions.push(
                    SELF_HEAL_ACTION
                        .CLEAN_DUPLICATES
                );
            }

            if (
                report.predictions
                    .invalidCount >
                0
            ) {
                actions.push(
                    SELF_HEAL_ACTION
                        .CLEAN_INVALID_PREDICTIONS
                );
            }

            if (
                report.cells
                    .duplicateRatio >
                DEFAULT_MAX_DUPLICATE_RATIO
            ) {
                actions.push(
                    SELF_HEAL_ACTION
                        .CLEAN_DUPLICATES
                );
            }

            if (
                report.cells
                    .invalidCount >
                0
            ) {
                actions.push(
                    SELF_HEAL_ACTION
                        .CLEAN_INVALID_CELLS
                );
            }

            if (
                !report.horizons.complete
            ) {
                actions.push(
                    SELF_HEAL_ACTION
                        .REBUILD_DASHBOARD
                );
            }

            if (
                !report.dashboard.healthy
            ) {
                actions.push(
                    SELF_HEAL_ACTION
                        .REBUILD_DASHBOARD
                );

                actions.push(
                    SELF_HEAL_ACTION
                        .REBUILD_FRONTEND
                );
            }

            if (
                report.locks
                    .expiredLockCount >
                0
            ) {
                actions.push(
                    SELF_HEAL_ACTION
                        .RELEASE_EXPIRED_LOCKS
                );
            }

            return Array.from(
                new Set(
                    actions
                )
            );
        };

    /* ======================================================================
       SECTION 151
       EXECUTE SELF-HEAL ACTION
       ====================================================================== */

    ClosureClass.prototype.executeSelfHealAction =
        function executeSelfHealAction(
            action,
            options = {}
        ) {
            switch (action) {
                case SELF_HEAL_ACTION
                    .CLEAN_DUPLICATES:
                    return {
                        action,

                        predictions:
                            this
                                .cleanDuplicatePredictions(),

                        cells:
                            this
                                .cleanDuplicateCells()
                    };

                case SELF_HEAL_ACTION
                    .CLEAN_INVALID_PREDICTIONS:
                    return {
                        action,

                        result:
                            this
                                .cleanInvalidPredictions()
                    };

                case SELF_HEAL_ACTION
                    .CLEAN_INVALID_CELLS:
                    return {
                        action,

                        result:
                            this
                                .cleanInvalidCells()
                    };

                case SELF_HEAL_ACTION
                    .REBUILD_DASHBOARD:
                    return {
                        action,

                        result:
                            this
                                .rebuildCoreDerivedState(
                                    options
                                )
                    };

                case SELF_HEAL_ACTION
                    .REBUILD_FRONTEND:
                    return {
                        action,

                        result:
                            typeof this.core
                                .buildFrontendPayload ===
                            "function"
                                ? this.core
                                    .buildFrontendPayload(
                                        options.frontend ||
                                        {}
                                    )
                                : null
                    };

                case SELF_HEAL_ACTION
                    .RELEASE_EXPIRED_LOCKS:
                    return {
                        action,

                        result:
                            this
                                .cleanupExpiredLocks()
                    };

                case SELF_HEAL_ACTION
                    .CLEAN_EXPIRED_SNAPSHOTS:
                    return {
                        action,

                        result:
                            this
                                .cleanupExpiredSnapshots()
                    };

                case SELF_HEAL_ACTION
                    .RESET_CLOSURE_STATE:
                    return {
                        action,

                        result:
                            this.reset({
                                clearHistory:
                                    false,

                                clearArchives:
                                    false
                            })
                    };

                case SELF_HEAL_ACTION
                    .RESTORE_LAST_SNAPSHOT: {
                    const snapshots =
                        typeof this
                            .getSnapshots ===
                        "function"
                            ? this
                                .getSnapshots(
                                    1
                                )
                            : [];

                    if (
                        !snapshots.length
                    ) {
                        return {
                            action,

                            restored:
                                false,

                            reason:
                                "no_snapshot_available"
                        };
                    }

                    return {
                        action,

                        restored:
                            true,

                        result:
                            this
                                .restoreCoreSnapshot(
                                    snapshots[0]
                                        .id
                                )
                    };
                }

                default:
                    return {
                        action:
                            SELF_HEAL_ACTION.NONE,

                        skipped:
                            true
                    };
            }
        };

    /* ======================================================================
       SECTION 152
       RUN SELF-HEALING
       ====================================================================== */

    ClosureClass.prototype.runSelfHealing =
        function runSelfHealing(
            options = {}
        ) {
            const diagnosticState =
                this.ensureDiagnosticState();

            const safeOptions =
                safeObject(options);

            const cooldownMs =
                Math.max(
                    0,
                    toFiniteNumber(
                        safeOptions.cooldownMs,
                        DEFAULT_SELF_HEAL_COOLDOWN_MS
                    )
                );

            if (
                diagnosticState
                    .lastSelfHealAt &&
                Date.now() -
                diagnosticState
                    .lastSelfHealAt <
                cooldownMs &&
                safeOptions.force !==
                true
            ) {
                return {
                    executed:
                        false,

                    reason:
                        "self_heal_cooldown_active",

                    lastSelfHealAt:
                        diagnosticState
                            .lastSelfHealAt
                };
            }

            const before =
                this.runIntegrityValidation();

            const actions =
                safeOptions.actions
                    ? safeArray(
                        safeOptions.actions
                    )
                    : this
                        .resolveSelfHealActions(
                            before
                        );

            const results = [];
            const errors = [];

            diagnosticState
                .totalSelfHealRuns +=
                1;

            actions.forEach(
                (action) => {
                    try {
                        const result =
                            this
                                .executeSelfHealAction(
                                    action,
                                    safeOptions
                                );

                        results.push(
                            deepClone(
                                result
                            )
                        );

                        this.writeAuditRecord(
                            "self_heal_action_completed",
                            AUDIT_LEVEL.INFO,
                            {
                                action,

                                result
                            }
                        );
                    } catch (error) {
                        const normalized =
                            normalizeClosureError(
                                error
                            );

                        normalized.action =
                            action;

                        errors.push(
                            normalized
                        );

                        this.writeAuditRecord(
                            "self_heal_action_failed",
                            AUDIT_LEVEL.ERROR,
                            {
                                action,

                                error:
                                    normalized
                            }
                        );
                    }
                }
            );

            const after =
                this.runIntegrityValidation();

            const successful =
                errors.length ===
                0 &&
                after.healthScore >=
                before.healthScore;

            if (successful) {
                diagnosticState
                    .successfulSelfHealRuns +=
                    1;
            } else {
                diagnosticState
                    .failedSelfHealRuns +=
                    1;
            }

            diagnosticState
                .lastSelfHealAt =
                Date.now();

            const report = {
                executed:
                    true,

                successful,

                actions,

                results,

                errors,

                before,

                after,

                improvement:
                    after.healthScore -
                    before.healthScore,

                completedAt:
                    Date.now()
            };

            diagnosticState
                .lastSelfHealReport =
                deepClone(
                    report
                );

            if (
                typeof this.core.emit ===
                "function"
            ) {
                this.core.emit(
                    CORE_EVENTS
                        .CLOSURE_SELF_HEAL_COMPLETED ||
                    "closure_self_heal_completed",
                    {
                        report:
                            deepClone(
                                report
                            ),

                        timestamp:
                            Date.now()
                    }
                );
            }

            return report;
        };

    /* ======================================================================
       SECTION 153
       RUN FINAL DIAGNOSTICS
       ====================================================================== */

    ClosureClass.prototype.runFinalDiagnostics =
        function runFinalDiagnostics(
            options = {}
        ) {
            const health =
                this.buildClosureHealthReport();

            let selfHealing =
                null;

            if (
                options.selfHeal ===
                true &&
                health.score <
                toFiniteNumber(
                    options.minimumHealthScore,
                    DEFAULT_MIN_HEALTH_SCORE
                )
            ) {
                selfHealing =
                    this.runSelfHealing(
                        options.selfHealing ||
                        {}
                    );
            }

            const finalHealth =
                selfHealing
                    ?.after
                    ? this
                        .buildClosureHealthReport()
                    : health;

            const report = {
                health:
                    finalHealth,

                selfHealing,

                requiresAttention:
                    finalHealth.score <
                    DEFAULT_MIN_HEALTH_SCORE,

                critical:
                    finalHealth.score <
                    DEFAULT_CRITICAL_HEALTH_SCORE,

                generatedAt:
                    Date.now()
            };

            this.writeAuditRecord(
                "final_diagnostics_completed",
                report.critical
                    ? AUDIT_LEVEL.CRITICAL
                    : report.requiresAttention
                        ? AUDIT_LEVEL.WARNING
                        : AUDIT_LEVEL.INFO,
                {
                    healthScore:
                        finalHealth.score,

                    status:
                        finalHealth.status,

                    requiresAttention:
                        report
                            .requiresAttention
                }
            );

            return report;
        };

    /* ======================================================================
       SECTION 154
       WRAP COMPLETE CLOSURE WITH DIAGNOSTICS
       ====================================================================== */

    const originalCompleteClosure =
        ClosureClass.prototype
            .completeClosure;

    ClosureClass.prototype.completeClosure =
        function completeClosureWithDiagnostics(
            closure =
                this.state
                    .activeClosure,
            options = {}
        ) {
            if (closure) {
                try {
                    closure.finalDiagnostics =
                        this
                            .runFinalDiagnostics({
                                selfHeal:
                                    options
                                        .selfHealAfterClosure ===
                                    true,

                                minimumHealthScore:
                                    options
                                        .minimumHealthScore,

                                selfHealing:
                                    options
                                        .selfHealing ||
                                    {}
                            });
                } catch (error) {
                    closure.warnings =
                        safeArray(
                            closure.warnings
                        );

                    closure.warnings.push({
                        code:
                            "FINAL_DIAGNOSTICS_FAILED",

                        message:
                            error?.message ||
                            "Final closure diagnostics failed.",

                        timestamp:
                            Date.now()
                    });
                }
            }

            const result =
                originalCompleteClosure
                    .call(
                        this,
                        closure,
                        options
                    );

            this.writeAuditRecord(
                "closure_completed",
                result.status ===
                CLOSURE_STATUS.COMPLETED
                    ? AUDIT_LEVEL.INFO
                    : AUDIT_LEVEL.WARNING,
                {
                    closureId:
                        result.id,

                    status:
                        result.status,

                    durationMs:
                        result.durationMs
                }
            );

            return result;
        };

    /* ======================================================================
       SECTION 155
       GET DIAGNOSTIC STATUS
       ====================================================================== */

    ClosureClass.prototype.getDiagnosticStatus =
        function getDiagnosticStatus() {
            const diagnosticState =
                this.ensureDiagnosticState();

            return {
                lastHealthReport:
                    diagnosticState
                        .lastHealthReport
                        ? deepClone(
                            diagnosticState
                                .lastHealthReport
                        )
                        : null,

                lastIntegrityReport:
                    diagnosticState
                        .lastIntegrityReport
                        ? deepClone(
                            diagnosticState
                                .lastIntegrityReport
                        )
                        : null,

                lastSelfHealReport:
                    diagnosticState
                        .lastSelfHealReport
                        ? deepClone(
                            diagnosticState
                                .lastSelfHealReport
                        )
                        : null,

                lastSelfHealAt:
                    diagnosticState
                        .lastSelfHealAt,

                totalSelfHealRuns:
                    diagnosticState
                        .totalSelfHealRuns,

                successfulSelfHealRuns:
                    diagnosticState
                        .successfulSelfHealRuns,

                failedSelfHealRuns:
                    diagnosticState
                        .failedSelfHealRuns,

                auditRecordCount:
                    diagnosticState
                        .auditLog
                        .length,

                healthHistoryCount:
                    diagnosticState
                        .healthHistory
                        .length,

                diagnosticHistoryCount:
                    diagnosticState
                        .diagnosticHistory
                        .length
            };
        };

    /* ======================================================================
       SECTION 156
       GET HEALTH HISTORY
       ====================================================================== */

    ClosureClass.prototype.getHealthHistory =
        function getHealthHistory(
            limit = 20
        ) {
            const diagnosticState =
                this.ensureDiagnosticState();

            const safeLimit =
                Math.max(
                    1,
                    Math.min(
                        DEFAULT_HEALTH_HISTORY_LIMIT,
                        Math.round(
                            toFiniteNumber(
                                limit,
                                20
                            )
                        )
                    )
                );

            return deepClone(
                diagnosticState
                    .healthHistory
                    .slice(
                        -safeLimit
                    )
                    .reverse()
            );
        };

    /* ======================================================================
       SECTION 157
       CLEAR DIAGNOSTICS
       ====================================================================== */

    ClosureClass.prototype.clearDiagnostics =
        function clearDiagnostics(
            options = {}
        ) {
            const diagnosticState =
                this.ensureDiagnosticState();

            const safeOptions =
                safeObject(options);

            const before = {
                auditRecordCount:
                    diagnosticState
                        .auditLog
                        .length,

                healthHistoryCount:
                    diagnosticState
                        .healthHistory
                        .length,

                diagnosticHistoryCount:
                    diagnosticState
                        .diagnosticHistory
                        .length
            };

            if (
                safeOptions.audit !==
                false
            ) {
                diagnosticState
                    .auditLog = [];
            }

            if (
                safeOptions.health !==
                false
            ) {
                diagnosticState
                    .healthHistory = [];

                diagnosticState
                    .lastHealthReport =
                    null;
            }

            if (
                safeOptions.integrity !==
                false
            ) {
                diagnosticState
                    .diagnosticHistory = [];

                diagnosticState
                    .lastIntegrityReport =
                    null;
            }

            if (
                safeOptions.selfHealing ===
                true
            ) {
                diagnosticState
                    .lastSelfHealReport =
                    null;

                diagnosticState
                    .lastSelfHealAt =
                    null;

                diagnosticState
                    .totalSelfHealRuns =
                    0;

                diagnosticState
                    .successfulSelfHealRuns =
                    0;

                diagnosticState
                    .failedSelfHealRuns =
                    0;
            }

            return {
                cleared:
                    true,

                before,

                after:
                    this
                        .getDiagnosticStatus(),

                clearedAt:
                    Date.now()
            };
        };

    /* ======================================================================
       SECTION 158
       API EXTENSIONS
       ====================================================================== */

    const ClosureApi =
        global
            .RainArrivalRecoveryClosureAPI ||
        global
            .RainGuardRecoveryClosureAPI;

    if (ClosureApi) {
        ClosureApi.validateIntegrity =
            function validateIntegrity(
                options = {}
            ) {
                return this
                    .requireInstance()
                    .runIntegrityValidation(
                        options
                    );
            };

        ClosureApi.getHealth =
            function getHealth() {
                return this
                    .requireInstance()
                    .buildClosureHealthReport();
            };

        ClosureApi.runDiagnostics =
            function runDiagnostics(
                options = {}
            ) {
                return this
                    .requireInstance()
                    .runFinalDiagnostics(
                        options
                    );
            };

        ClosureApi.selfHeal =
            function selfHeal(
                options = {}
            ) {
                return this
                    .requireInstance()
                    .runSelfHealing(
                        options
                    );
            };

        ClosureApi.getAuditLog =
            function getAuditLog(
                options = {}
            ) {
                return this
                    .requireInstance()
                    .getAuditLog(
                        options
                    );
            };

        ClosureApi.getDiagnosticStatus =
            function getDiagnosticStatus() {
                return this
                    .requireInstance()
                    .getDiagnosticStatus();
            };

        ClosureApi.getHealthHistory =
            function getHealthHistory(
                limit = 20
            ) {
                return this
                    .requireInstance()
                    .getHealthHistory(
                        limit
                    );
            };

        ClosureApi.clearDiagnostics =
            function clearDiagnostics(
                options = {}
            ) {
                return this
                    .requireInstance()
                    .clearDiagnostics(
                        options
                    );
            };
    }

    /* ======================================================================
       SECTION 159
       COMPATIBILITY ALIASES
       ====================================================================== */

    ClosureClass.prototype.validateIntegrity =
        ClosureClass.prototype
            .runIntegrityValidation;

    ClosureClass.prototype.getHealth =
        ClosureClass.prototype
            .buildClosureHealthReport;

    ClosureClass.prototype.runDiagnostics =
        ClosureClass.prototype
            .runFinalDiagnostics;

    ClosureClass.prototype.selfHeal =
        ClosureClass.prototype
            .runSelfHealing;

    ClosureClass.prototype.getDiagnostics =
        ClosureClass.prototype
            .getDiagnosticStatus;

    /* ======================================================================
       SECTION 160
       PART 6 EXPORT
       ====================================================================== */

    global.RainArrivalRecoveryClosureV32Part6 = {
        INTEGRITY_STATUS,
        AUDIT_LEVEL,
        SELF_HEAL_ACTION,
        DEFAULT_MAX_AUDIT_RECORDS,
        DEFAULT_MAX_DIAGNOSTIC_RECORDS,
        DEFAULT_MIN_HEALTH_SCORE,
        DEFAULT_CRITICAL_HEALTH_SCORE,
        DEFAULT_MAX_INVALID_RATIO,
        DEFAULT_MAX_DUPLICATE_RATIO,
        DEFAULT_SELF_HEAL_COOLDOWN_MS,
        DEFAULT_HEALTH_HISTORY_LIMIT,
        createAuditId,
        createDiagnosticId,
        normalizeAuditLevel,
        calculateRatio,
        classifyHealthScore,
        isValidPredictionRecord,
        isValidCellRecord,
        buildSimplePredictionKey,
        buildSimpleCellKey,
        detectDuplicateCount
    };

})(window);

/* ==========================================================================
   RainGuard AI
   Long Horizon Forecast Engine V32

   Recovery Closure Engine V32

   PART 7
   Persistent Storage + Export/Import + Recovery Checkpoints +
   Session Restore + Safe Serialization
   ========================================================================== */

(function extendRainArrivalRecoveryClosureV32Part7(global) {
    "use strict";

    /* ======================================================================
       SECTION 161
       DEPENDENCY RESOLUTION
       ====================================================================== */

    const ClosureClass =
        global.RainArrivalRecoveryClosureV32;

    const ClosureConstants =
        global.RainArrivalRecoveryClosureV32Constants;

    const ClosureUtils =
        global.RainArrivalRecoveryClosureV32Utils;

    const CoreUtils =
        global.RainArrivalRecoveryCoreV32Utils;

    const CoreConstants =
        global.RainArrivalRecoveryCoreV32Constants;

    if (
        typeof ClosureClass !== "function" ||
        !ClosureConstants ||
        !ClosureUtils ||
        !CoreUtils ||
        !CoreConstants
    ) {
        throw new Error(
            "RainArrivalRecoveryClosureV32 Parts 1 to 6 must be loaded before Part 7."
        );
    }

    const {
        CLOSURE_STATUS
    } = ClosureConstants;

    const {
        createClosureError,
        normalizeClosureError
    } = ClosureUtils;

    const {
        toFiniteNumber,
        safeArray,
        safeObject,
        deepClone
    } = CoreUtils;

    const {
        CORE_EVENTS
    } = CoreConstants;

    /* ======================================================================
       SECTION 162
       PERSISTENCE CONSTANTS
       ====================================================================== */

    const PERSISTENCE_STATUS =
        Object.freeze({
            IDLE:
                "idle",

            SAVING:
                "saving",

            SAVED:
                "saved",

            LOADING:
                "loading",

            LOADED:
                "loaded",

            FAILED:
                "failed",

            CLEARED:
                "cleared",

            UNSUPPORTED:
                "unsupported"
        });

    const CHECKPOINT_STATUS =
        Object.freeze({
            CREATED:
                "created",

            RESTORED:
                "restored",

            EXPIRED:
                "expired",

            DELETED:
                "deleted",

            INVALID:
                "invalid"
        });

    const STORAGE_TYPE =
        Object.freeze({
            LOCAL_STORAGE:
                "local_storage",

            SESSION_STORAGE:
                "session_storage",

            MEMORY:
                "memory"
        });

    const DEFAULT_STORAGE_KEY =
        "rainguard_recovery_closure_v32";

    const DEFAULT_CHECKPOINT_STORAGE_KEY =
        "rainguard_recovery_closure_checkpoints_v32";

    const DEFAULT_MAX_PERSISTED_HISTORY =
        50;

    const DEFAULT_MAX_PERSISTED_ARCHIVES =
        500;

    const DEFAULT_MAX_CHECKPOINTS =
        10;

    const DEFAULT_CHECKPOINT_RETENTION_MS =
        24 * 60 * 60 * 1000;

    const DEFAULT_AUTOSAVE_INTERVAL_MS =
        60 * 1000;

    const DEFAULT_MAX_SERIALIZED_LENGTH =
        5 * 1024 * 1024;

    const PERSISTENCE_SCHEMA =
        "RainArrivalRecoveryClosurePersistence";

    const PERSISTENCE_VERSION =
        "32.7.0";

    /* ======================================================================
       SECTION 163
       PERSISTENCE HELPERS
       ====================================================================== */

    function createCheckpointId() {
        return (
            "recovery_checkpoint_" +
            Date.now() +
            "_" +
            Math.random()
                .toString(36)
                .slice(2, 9)
        );
    }

    function createExportId() {
        return (
            "recovery_export_" +
            Date.now() +
            "_" +
            Math.random()
                .toString(36)
                .slice(2, 9)
        );
    }

    function normalizeStorageType(
        type
    ) {
        const supported =
            Object.values(
                STORAGE_TYPE
            );

        return supported.includes(
            type
        )
            ? type
            : STORAGE_TYPE
                .LOCAL_STORAGE;
    }

    function getStorageProvider(
        type
    ) {
        const normalizedType =
            normalizeStorageType(
                type
            );

        try {
            if (
                normalizedType ===
                STORAGE_TYPE.LOCAL_STORAGE &&
                global.localStorage
            ) {
                return global.localStorage;
            }

            if (
                normalizedType ===
                STORAGE_TYPE.SESSION_STORAGE &&
                global.sessionStorage
            ) {
                return global.sessionStorage;
            }
        } catch (error) {
            return null;
        }

        return null;
    }

    function createSafeJsonReplacer() {
        const seen =
            new WeakSet();

        return function safeJsonReplacer(
            key,
            value
        ) {
            if (
                typeof value ===
                "function"
            ) {
                return undefined;
            }

            if (
                typeof value ===
                "bigint"
            ) {
                return Number(value);
            }

            if (
                value instanceof Map
            ) {
                return {
                    __type:
                        "Map",

                    entries:
                        Array.from(
                            value.entries()
                        )
                };
            }

            if (
                value instanceof Set
            ) {
                return {
                    __type:
                        "Set",

                    values:
                        Array.from(
                            value.values()
                        )
                };
            }

            if (
                value instanceof Date
            ) {
                return {
                    __type:
                        "Date",

                    value:
                        value.toISOString()
                };
            }

            if (
                value &&
                typeof value ===
                "object"
            ) {
                if (
                    seen.has(value)
                ) {
                    return undefined;
                }

                seen.add(value);
            }

            return value;
        };
    }

    function safeJsonReviver(
        key,
        value
    ) {
        if (
            value &&
            value.__type ===
            "Map" &&
            Array.isArray(
                value.entries
            )
        ) {
            return new Map(
                value.entries
            );
        }

        if (
            value &&
            value.__type ===
            "Set" &&
            Array.isArray(
                value.values
            )
        ) {
            return new Set(
                value.values
            );
        }

        if (
            value &&
            value.__type ===
            "Date" &&
            value.value
        ) {
            return new Date(
                value.value
            );
        }

        return value;
    }

    function safeSerialize(
        value,
        options = {}
    ) {
        const maxLength =
            Math.max(
                1024,
                toFiniteNumber(
                    options.maxLength,
                    DEFAULT_MAX_SERIALIZED_LENGTH
                )
            );

        const serialized =
            JSON.stringify(
                value,
                createSafeJsonReplacer()
            );

        if (
            serialized.length >
            maxLength
        ) {
            throw createClosureError(
                "Serialized recovery closure state exceeds the allowed size.",
                "PERSISTENCE_PAYLOAD_TOO_LARGE"
            );
        }

        return serialized;
    }

    function safeDeserialize(
        serialized
    ) {
        if (
            typeof serialized !==
            "string" ||
            !serialized.trim()
        ) {
            return null;
        }

        return JSON.parse(
            serialized,
            safeJsonReviver
        );
    }

    function isCheckpointExpired(
        checkpoint,
        retentionMs =
            DEFAULT_CHECKPOINT_RETENTION_MS
    ) {
        if (!checkpoint) {
            return true;
        }

        return (
            Date.now() -
            toFiniteNumber(
                checkpoint.createdAt,
                0
            ) >
            retentionMs
        );
    }

    function validatePersistencePayload(
        payload
    ) {
        if (
            !payload ||
            typeof payload !==
            "object"
        ) {
            return {
                valid:
                    false,

                reason:
                    "invalid_payload"
            };
        }

        if (
            payload.schema !==
            PERSISTENCE_SCHEMA
        ) {
            return {
                valid:
                    false,

                reason:
                    "invalid_schema"
            };
        }

        if (
            !payload.data ||
            typeof payload.data !==
            "object"
        ) {
            return {
                valid:
                    false,

                reason:
                    "missing_data"
            };
        }

        return {
            valid:
                true,

            reason:
                null
        };
    }

    /* ======================================================================
       SECTION 164
       ENSURE PERSISTENCE STATE
       ====================================================================== */

    ClosureClass.prototype.ensurePersistenceState =
        function ensurePersistenceState() {
            if (
                !this.state.persistence
            ) {
                this.state.persistence = {
                    status:
                        PERSISTENCE_STATUS.IDLE,

                    enabled:
                        true,

                    storageType:
                        STORAGE_TYPE.LOCAL_STORAGE,

                    storageKey:
                        DEFAULT_STORAGE_KEY,

                    checkpointStorageKey:
                        DEFAULT_CHECKPOINT_STORAGE_KEY,

                    autosaveEnabled:
                        false,

                    autosaveIntervalMs:
                        DEFAULT_AUTOSAVE_INTERVAL_MS,

                    autosaveTimer:
                        null,

                    memoryStorage:
                        new Map(),

                    checkpoints: [],

                    lastSavedAt:
                        null,

                    lastLoadedAt:
                        null,

                    lastClearedAt:
                        null,

                    lastError:
                        null,

                    saveCount:
                        0,

                    loadCount:
                        0,

                    failureCount:
                        0
                };
            }

            if (
                !(
                    this.state
                        .persistence
                        .memoryStorage instanceof
                    Map
                )
            ) {
                this.state
                    .persistence
                    .memoryStorage =
                    new Map();
            }

            if (
                !Array.isArray(
                    this.state
                        .persistence
                        .checkpoints
                )
            ) {
                this.state
                    .persistence
                    .checkpoints = [];
            }

            return this.state
                .persistence;
        };

    /* ======================================================================
       SECTION 165
       CONFIGURE PERSISTENCE
       ====================================================================== */

    ClosureClass.prototype.configurePersistence =
        function configurePersistence(
            options = {}
        ) {
            const persistence =
                this.ensurePersistenceState();

            const safeOptions =
                safeObject(options);

            if (
                typeof safeOptions.enabled ===
                "boolean"
            ) {
                persistence.enabled =
                    safeOptions.enabled;
            }

            if (
                safeOptions.storageType
            ) {
                persistence.storageType =
                    normalizeStorageType(
                        safeOptions.storageType
                    );
            }

            if (
                typeof safeOptions.storageKey ===
                "string" &&
                safeOptions.storageKey.trim()
            ) {
                persistence.storageKey =
                    safeOptions.storageKey
                        .trim();
            }

            if (
                typeof safeOptions
                    .checkpointStorageKey ===
                "string" &&
                safeOptions
                    .checkpointStorageKey
                    .trim()
            ) {
                persistence
                    .checkpointStorageKey =
                    safeOptions
                        .checkpointStorageKey
                        .trim();
            }

            if (
                Number.isFinite(
                    Number(
                        safeOptions
                            .autosaveIntervalMs
                    )
                )
            ) {
                persistence
                    .autosaveIntervalMs =
                    Math.max(
                        10000,
                        toFiniteNumber(
                            safeOptions
                                .autosaveIntervalMs,
                            DEFAULT_AUTOSAVE_INTERVAL_MS
                        )
                    );
            }

            return this
                .getPersistenceStatus();
        };

    /* ======================================================================
       SECTION 166
       READ STORAGE VALUE
       ====================================================================== */

    ClosureClass.prototype.readStorageValue =
        function readStorageValue(
            key,
            storageType = null
        ) {
            const persistence =
                this.ensurePersistenceState();

            const type =
                normalizeStorageType(
                    storageType ||
                    persistence.storageType
                );

            if (
                type ===
                STORAGE_TYPE.MEMORY
            ) {
                return persistence
                    .memoryStorage
                    .get(key) ||
                    null;
            }

            const provider =
                getStorageProvider(
                    type
                );

            if (!provider) {
                return null;
            }

            return provider.getItem(
                key
            );
        };

    /* ======================================================================
       SECTION 167
       WRITE STORAGE VALUE
       ====================================================================== */

    ClosureClass.prototype.writeStorageValue =
        function writeStorageValue(
            key,
            value,
            storageType = null
        ) {
            const persistence =
                this.ensurePersistenceState();

            const type =
                normalizeStorageType(
                    storageType ||
                    persistence.storageType
                );

            if (
                type ===
                STORAGE_TYPE.MEMORY
            ) {
                persistence
                    .memoryStorage
                    .set(
                        key,
                        value
                    );

                return true;
            }

            const provider =
                getStorageProvider(
                    type
                );

            if (!provider) {
                return false;
            }

            provider.setItem(
                key,
                value
            );

            return true;
        };

    /* ======================================================================
       SECTION 168
       REMOVE STORAGE VALUE
       ====================================================================== */

    ClosureClass.prototype.removeStorageValue =
        function removeStorageValue(
            key,
            storageType = null
        ) {
            const persistence =
                this.ensurePersistenceState();

            const type =
                normalizeStorageType(
                    storageType ||
                    persistence.storageType
                );

            if (
                type ===
                STORAGE_TYPE.MEMORY
            ) {
                return persistence
                    .memoryStorage
                    .delete(key);
            }

            const provider =
                getStorageProvider(
                    type
                );

            if (!provider) {
                return false;
            }

            provider.removeItem(
                key
            );

            return true;
        };

    /* ======================================================================
       SECTION 169
       BUILD PERSISTENCE PAYLOAD
       ====================================================================== */

    ClosureClass.prototype.buildPersistencePayload =
        function buildPersistencePayload(
            options = {}
        ) {
            const safeOptions =
                safeObject(options);

            const closureHistory =
                safeArray(
                    this.state
                        .closureHistory
                )
                    .slice(
                        -Math.max(
                            1,
                            toFiniteNumber(
                                safeOptions
                                    .historyLimit,
                                DEFAULT_MAX_PERSISTED_HISTORY
                            )
                        )
                    );

            const archiveLimit =
                Math.max(
                    1,
                    toFiniteNumber(
                        safeOptions
                            .archiveLimit,
                        DEFAULT_MAX_PERSISTED_ARCHIVES
                    )
                );

            const transactionHistory =
                safeArray(
                    this.state
                        .transaction
                        ?.transactionHistory
                )
                    .slice(
                        -DEFAULT_MAX_PERSISTED_HISTORY
                    );

            const auditLog =
                safeArray(
                    this.state
                        .diagnostics
                        ?.auditLog
                )
                    .slice(
                        -DEFAULT_MAX_PERSISTED_HISTORY
                    );

            return {
                schema:
                    PERSISTENCE_SCHEMA,

                version:
                    PERSISTENCE_VERSION,

                exportId:
                    createExportId(),

                generatedAt:
                    Date.now(),

                generatedIso:
                    new Date()
                        .toISOString(),

                data: {
                    closureState: {
                        status:
                            this.state.status,

                        lastClosure:
                            deepClone(
                                this.state
                                    .lastClosure
                            ),

                        lastClosureAt:
                            this.state
                                .lastClosureAt,

                        totalClosures:
                            this.state
                                .totalClosures,

                        successfulClosures:
                            this.state
                                .successfulClosures,

                        partialClosures:
                            this.state
                                .partialClosures,

                        failedClosures:
                            this.state
                                .failedClosures,

                        closureHistory:
                            deepClone(
                                closureHistory
                            )
                    },

                    archives: {
                        predictions:
                            deepClone(
                                safeArray(
                                    this.state
                                        .archivedPredictions
                                )
                                    .slice(
                                        -archiveLimit
                                    )
                            ),

                        cells:
                            deepClone(
                                safeArray(
                                    this.state
                                        .archivedCells
                                )
                                    .slice(
                                        -archiveLimit
                                    )
                            ),

                        observations:
                            deepClone(
                                safeArray(
                                    this.state
                                        .archivedObservations
                                )
                                    .slice(
                                        -archiveLimit
                                    )
                            ),

                        forecasts:
                            deepClone(
                                safeArray(
                                    this.state
                                        .archivedForecasts
                                )
                                    .slice(
                                        -archiveLimit
                                    )
                            )
                    },

                    transaction: {
                        lastTransaction:
                            deepClone(
                                this.state
                                    .transaction
                                    ?.lastTransaction ||
                                null
                            ),

                        history:
                            deepClone(
                                transactionHistory
                            )
                    },

                    diagnostics: {
                        lastHealthReport:
                            deepClone(
                                this.state
                                    .diagnostics
                                    ?.lastHealthReport ||
                                null
                            ),

                        lastIntegrityReport:
                            deepClone(
                                this.state
                                    .diagnostics
                                    ?.lastIntegrityReport ||
                                null
                            ),

                        auditLog:
                            deepClone(
                                auditLog
                            )
                    },

                    core: {
                        arrivalPredictions:
                            deepClone(
                                safeArray(
                                    this.core.state
                                        .arrivalPredictions
                                )
                            ),

                        rainCells:
                            deepClone(
                                safeArray(
                                    this.core.state
                                        .rainCells
                                )
                            ),

                        horizonForecasts:
                            deepClone(
                                this.core.state
                                    .horizonForecasts ||
                                {}
                            ),

                        regionSummaries:
                            deepClone(
                                safeArray(
                                    this.core.state
                                        .regionSummaries
                                )
                            ),

                        governorateSummaries:
                            deepClone(
                                safeArray(
                                    this.core.state
                                        .governorateSummaries
                                )
                            ),

                        nationalArrivalDashboard:
                            deepClone(
                                this.core.state
                                    .nationalArrivalDashboard ||
                                null
                            ),

                        frontendPayload:
                            safeOptions
                                .includeFrontendPayload ===
                            false
                                ? null
                                : deepClone(
                                    this.core.state
                                        .frontendPayload ||
                                    null
                                )
                    }
                }
            };
        };

    /* ======================================================================
       SECTION 170
       SAVE PERSISTENT STATE
       ====================================================================== */

    ClosureClass.prototype.savePersistentState =
        function savePersistentState(
            options = {}
        ) {
            const persistence =
                this.ensurePersistenceState();

            const safeOptions =
                safeObject(options);

            if (
                !persistence.enabled &&
                safeOptions.force !==
                true
            ) {
                return {
                    saved:
                        false,

                    reason:
                        "persistence_disabled"
                };
            }

            persistence.status =
                PERSISTENCE_STATUS.SAVING;

            try {
                const payload =
                    this.buildPersistencePayload(
                        safeOptions
                    );

                const serialized =
                    safeSerialize(
                        payload,
                        safeOptions
                    );

                const written =
                    this.writeStorageValue(
                        safeOptions.storageKey ||
                        persistence.storageKey,
                        serialized,
                        safeOptions.storageType ||
                        persistence.storageType
                    );

                if (!written) {
                    throw createClosureError(
                        "Persistent storage provider is unavailable.",
                        "PERSISTENCE_PROVIDER_UNAVAILABLE"
                    );
                }

                persistence.status =
                    PERSISTENCE_STATUS.SAVED;

                persistence.lastSavedAt =
                    Date.now();

                persistence.saveCount +=
                    1;

                persistence.lastError =
                    null;

                this.writeAuditRecord?.(
                    "persistent_state_saved",
                    "info",
                    {
                        storageType:
                            safeOptions
                                .storageType ||
                            persistence
                                .storageType,

                        size:
                            serialized.length
                    }
                );

                return {
                    saved:
                        true,

                    storageType:
                        safeOptions
                            .storageType ||
                        persistence
                            .storageType,

                    storageKey:
                        safeOptions
                            .storageKey ||
                        persistence
                            .storageKey,

                    size:
                        serialized.length,

                    savedAt:
                        persistence
                            .lastSavedAt
                };
            } catch (error) {
                const normalized =
                    normalizeClosureError(
                        error
                    );

                persistence.status =
                    PERSISTENCE_STATUS.FAILED;

                persistence.failureCount +=
                    1;

                persistence.lastError =
                    deepClone(
                        normalized
                    );

                return {
                    saved:
                        false,

                    error:
                        normalized
                };
            }
        };

    /* ======================================================================
       SECTION 171
       APPLY PERSISTENCE PAYLOAD
       ====================================================================== */

    ClosureClass.prototype.applyPersistencePayload =
        function applyPersistencePayload(
            payload,
            options = {}
        ) {
            const validation =
                validatePersistencePayload(
                    payload
                );

            if (!validation.valid) {
                throw createClosureError(
                    `Invalid persistence payload: ${validation.reason}`,
                    "INVALID_PERSISTENCE_PAYLOAD"
                );
            }

            const data =
                safeObject(
                    payload.data
                );

            const closureState =
                safeObject(
                    data.closureState
                );

            const archives =
                safeObject(
                    data.archives
                );

            const transaction =
                safeObject(
                    data.transaction
                );

            const diagnostics =
                safeObject(
                    data.diagnostics
                );

            const core =
                safeObject(
                    data.core
                );

            this.state.status =
                closureState.status ||
                CLOSURE_STATUS.IDLE;

            this.state.lastClosure =
                deepClone(
                    closureState
                        .lastClosure ||
                    null
                );

            this.state.lastClosureAt =
                closureState
                    .lastClosureAt ||
                null;

            this.state.totalClosures =
                toFiniteNumber(
                    closureState
                        .totalClosures,
                    0
                );

            this.state.successfulClosures =
                toFiniteNumber(
                    closureState
                        .successfulClosures,
                    0
                );

            this.state.partialClosures =
                toFiniteNumber(
                    closureState
                        .partialClosures,
                    0
                );

            this.state.failedClosures =
                toFiniteNumber(
                    closureState
                        .failedClosures,
                    0
                );

            this.state.closureHistory =
                deepClone(
                    safeArray(
                        closureState
                            .closureHistory
                    )
                );

            this.state
                .archivedPredictions =
                deepClone(
                    safeArray(
                        archives.predictions
                    )
                );

            this.state
                .archivedCells =
                deepClone(
                    safeArray(
                        archives.cells
                    )
                );

            this.state
                .archivedObservations =
                deepClone(
                    safeArray(
                        archives.observations
                    )
                );

            this.state
                .archivedForecasts =
                deepClone(
                    safeArray(
                        archives.forecasts
                    )
                );

            const transactionState =
                typeof this
                    .ensureTransactionState ===
                "function"
                    ? this
                        .ensureTransactionState()
                    : null;

            if (transactionState) {
                transactionState
                    .lastTransaction =
                    deepClone(
                        transaction
                            .lastTransaction ||
                        null
                    );

                transactionState
                    .transactionHistory =
                    deepClone(
                        safeArray(
                            transaction.history
                        )
                    );
            }

            const diagnosticState =
                typeof this
                    .ensureDiagnosticState ===
                "function"
                    ? this
                        .ensureDiagnosticState()
                    : null;

            if (diagnosticState) {
                diagnosticState
                    .lastHealthReport =
                    deepClone(
                        diagnostics
                            .lastHealthReport ||
                        null
                    );

                diagnosticState
                    .lastIntegrityReport =
                    deepClone(
                        diagnostics
                            .lastIntegrityReport ||
                        null
                    );

                diagnosticState
                    .auditLog =
                    deepClone(
                        safeArray(
                            diagnostics
                                .auditLog
                        )
                    );
            }

            if (
                options.restoreCore !==
                false
            ) {
                this.core.state
                    .arrivalPredictions =
                    deepClone(
                        safeArray(
                            core
                                .arrivalPredictions
                        )
                    );

                this.core.state
                    .rainCells =
                    deepClone(
                        safeArray(
                            core.rainCells
                        )
                    );

                this.core.cells =
                    new Map(
                        safeArray(
                            core.rainCells
                        )
                            .map(
                                (
                                    cell,
                                    index
                                ) => {
                                    return [
                                        cell.id ||
                                        cell.trackingId ||
                                        `restored_cell_${index}`,
                                        deepClone(
                                            cell
                                        )
                                    ];
                                }
                            )
                    );

                this.core.state
                    .horizonForecasts =
                    deepClone(
                        core
                            .horizonForecasts ||
                        {}
                    );

                this.core.state
                    .regionSummaries =
                    deepClone(
                        safeArray(
                            core
                                .regionSummaries
                        )
                    );

                this.core.state
                    .governorateSummaries =
                    deepClone(
                        safeArray(
                            core
                                .governorateSummaries
                        )
                    );

                this.core.state
                    .nationalArrivalDashboard =
                    deepClone(
                        core
                            .nationalArrivalDashboard ||
                        null
                    );

                this.core.state
                    .frontendPayload =
                    deepClone(
                        core
                            .frontendPayload ||
                        null
                    );
            }

            return {
                restored:
                    true,

                version:
                    payload.version,

                generatedAt:
                    payload.generatedAt,

                appliedAt:
                    Date.now()
            };
        };

    /* ======================================================================
       SECTION 172
       LOAD PERSISTENT STATE
       ====================================================================== */

    ClosureClass.prototype.loadPersistentState =
        function loadPersistentState(
            options = {}
        ) {
            const persistence =
                this.ensurePersistenceState();

            const safeOptions =
                safeObject(options);

            persistence.status =
                PERSISTENCE_STATUS.LOADING;

            try {
                const serialized =
                    this.readStorageValue(
                        safeOptions.storageKey ||
                        persistence.storageKey,
                        safeOptions.storageType ||
                        persistence.storageType
                    );

                if (!serialized) {
                    persistence.status =
                        PERSISTENCE_STATUS.IDLE;

                    return {
                        loaded:
                            false,

                        reason:
                            "no_persisted_state"
                    };
                }

                const payload =
                    safeDeserialize(
                        serialized
                    );

                const result =
                    this.applyPersistencePayload(
                        payload,
                        safeOptions
                    );

                persistence.status =
                    PERSISTENCE_STATUS.LOADED;

                persistence.lastLoadedAt =
                    Date.now();

                persistence.loadCount +=
                    1;

                persistence.lastError =
                    null;

                this.writeAuditRecord?.(
                    "persistent_state_loaded",
                    "info",
                    {
                        storageType:
                            safeOptions
                                .storageType ||
                            persistence
                                .storageType
                    }
                );

                if (
                    typeof this.core.emit ===
                    "function"
                ) {
                    this.core.emit(
                        CORE_EVENTS
                            .CLOSURE_STATE_RESTORED ||
                        "closure_state_restored",
                        {
                            result:
                                deepClone(
                                    result
                                ),

                            timestamp:
                                Date.now()
                        }
                    );
                }

                return {
                    loaded:
                        true,

                    ...result
                };
            } catch (error) {
                const normalized =
                    normalizeClosureError(
                        error
                    );

                persistence.status =
                    PERSISTENCE_STATUS.FAILED;

                persistence.failureCount +=
                    1;

                persistence.lastError =
                    deepClone(
                        normalized
                    );

                return {
                    loaded:
                        false,

                    error:
                        normalized
                };
            }
        };

    /* ======================================================================
       SECTION 173
       CLEAR PERSISTENT STATE
       ====================================================================== */

    ClosureClass.prototype.clearPersistentState =
        function clearPersistentState(
            options = {}
        ) {
            const persistence =
                this.ensurePersistenceState();

            const safeOptions =
                safeObject(options);

            const removedState =
                this.removeStorageValue(
                    safeOptions.storageKey ||
                    persistence.storageKey,
                    safeOptions.storageType ||
                    persistence.storageType
                );

            const removedCheckpoints =
                safeOptions.clearCheckpoints ===
                false
                    ? false
                    : this.removeStorageValue(
                        safeOptions
                            .checkpointStorageKey ||
                        persistence
                            .checkpointStorageKey,
                        safeOptions.storageType ||
                        persistence.storageType
                    );

            if (
                safeOptions.clearMemory !==
                false
            ) {
                persistence
                    .memoryStorage
                    .clear();

                persistence.checkpoints =
                    [];
            }

            persistence.status =
                PERSISTENCE_STATUS.CLEARED;

            persistence.lastClearedAt =
                Date.now();

            return {
                cleared:
                    true,

                removedState,

                removedCheckpoints,

                clearedAt:
                    persistence
                        .lastClearedAt
            };
        };

    /* ======================================================================
       SECTION 174
       CREATE RECOVERY CHECKPOINT
       ====================================================================== */

    ClosureClass.prototype.createRecoveryCheckpoint =
        function createRecoveryCheckpoint(
            options = {}
        ) {
            const persistence =
                this.ensurePersistenceState();

            const safeOptions =
                safeObject(options);

            const checkpoint = {
                id:
                    createCheckpointId(),

                status:
                    CHECKPOINT_STATUS.CREATED,

                label:
                    safeOptions.label ||
                    "recovery_checkpoint",

                reason:
                    safeOptions.reason ||
                    "manual",

                createdAt:
                    Date.now(),

                restoredAt:
                    null,

                metadata:
                    deepClone(
                        safeObject(
                            safeOptions.metadata
                        )
                    ),

                payload:
                    this.buildPersistencePayload({
                        ...safeOptions,

                        historyLimit:
                            Math.min(
                                20,
                                toFiniteNumber(
                                    safeOptions
                                        .historyLimit,
                                    20
                                )
                            ),

                        archiveLimit:
                            Math.min(
                                200,
                                toFiniteNumber(
                                    safeOptions
                                        .archiveLimit,
                                    200
                                )
                            )
                    })
            };

            persistence
                .checkpoints
                .push(checkpoint);

            persistence.checkpoints =
                persistence
                    .checkpoints
                    .slice(
                        -DEFAULT_MAX_CHECKPOINTS
                    );

            this.saveRecoveryCheckpoints(
                safeOptions
            );

            return deepClone(
                checkpoint
            );
        };

    /* ======================================================================
       SECTION 175
       SAVE RECOVERY CHECKPOINTS
       ====================================================================== */

    ClosureClass.prototype.saveRecoveryCheckpoints =
        function saveRecoveryCheckpoints(
            options = {}
        ) {
            const persistence =
                this.ensurePersistenceState();

            const serialized =
                safeSerialize(
                    {
                        schema:
                            PERSISTENCE_SCHEMA,

                        version:
                            PERSISTENCE_VERSION,

                        checkpoints:
                            persistence
                                .checkpoints,

                        generatedAt:
                            Date.now()
                    },
                    options
                );

            const saved =
                this.writeStorageValue(
                    options
                        .checkpointStorageKey ||
                    persistence
                        .checkpointStorageKey,
                    serialized,
                    options.storageType ||
                    persistence.storageType
                );

            return {
                saved,

                checkpointCount:
                    persistence
                        .checkpoints
                        .length
            };
        };

    /* ======================================================================
       SECTION 176
       LOAD RECOVERY CHECKPOINTS
       ====================================================================== */

    ClosureClass.prototype.loadRecoveryCheckpoints =
        function loadRecoveryCheckpoints(
            options = {}
        ) {
            const persistence =
                this.ensurePersistenceState();

            try {
                const serialized =
                    this.readStorageValue(
                        options
                            .checkpointStorageKey ||
                        persistence
                            .checkpointStorageKey,
                        options.storageType ||
                        persistence.storageType
                    );

                if (!serialized) {
                    return {
                        loaded:
                            false,

                        checkpointCount:
                            0
                    };
                }

                const payload =
                    safeDeserialize(
                        serialized
                    );

                persistence.checkpoints =
                    safeArray(
                        payload?.checkpoints
                    );

                this.cleanupExpiredCheckpoints(
                    options
                );

                return {
                    loaded:
                        true,

                    checkpointCount:
                        persistence
                            .checkpoints
                            .length
                };
            } catch (error) {
                return {
                    loaded:
                        false,

                    error:
                        normalizeClosureError(
                            error
                        )
                };
            }
        };

    /* ======================================================================
       SECTION 177
       RESTORE RECOVERY CHECKPOINT
       ====================================================================== */

    ClosureClass.prototype.restoreRecoveryCheckpoint =
        function restoreRecoveryCheckpoint(
            checkpointId,
            options = {}
        ) {
            const persistence =
                this.ensurePersistenceState();

            const checkpoint =
                persistence
                    .checkpoints
                    .find(
                        (item) => {
                            return (
                                item.id ===
                                checkpointId
                            );
                        }
                    );

            if (!checkpoint) {
                throw createClosureError(
                    "Recovery checkpoint was not found.",
                    "CHECKPOINT_NOT_FOUND"
                );
            }

            if (
                isCheckpointExpired(
                    checkpoint,
                    toFiniteNumber(
                        options.retentionMs,
                        DEFAULT_CHECKPOINT_RETENTION_MS
                    )
                )
            ) {
                checkpoint.status =
                    CHECKPOINT_STATUS.EXPIRED;

                throw createClosureError(
                    "Recovery checkpoint has expired.",
                    "CHECKPOINT_EXPIRED"
                );
            }

            const result =
                this.applyPersistencePayload(
                    checkpoint.payload,
                    options
                );

            checkpoint.status =
                CHECKPOINT_STATUS.RESTORED;

            checkpoint.restoredAt =
                Date.now();

            this.saveRecoveryCheckpoints(
                options
            );

            this.writeAuditRecord?.(
                "recovery_checkpoint_restored",
                "warning",
                {
                    checkpointId:
                        checkpoint.id,

                    label:
                        checkpoint.label
                }
            );

            return {
                restored:
                    true,

                checkpoint:
                    deepClone(
                        checkpoint
                    ),

                result
            };
        };

    /* ======================================================================
       SECTION 178
       DELETE RECOVERY CHECKPOINT
       ====================================================================== */

    ClosureClass.prototype.deleteRecoveryCheckpoint =
        function deleteRecoveryCheckpoint(
            checkpointId,
            options = {}
        ) {
            const persistence =
                this.ensurePersistenceState();

            const checkpoint =
                persistence
                    .checkpoints
                    .find(
                        (item) => {
                            return (
                                item.id ===
                                checkpointId
                            );
                        }
                    );

            if (!checkpoint) {
                return false;
            }

            checkpoint.status =
                CHECKPOINT_STATUS.DELETED;

            persistence.checkpoints =
                persistence
                    .checkpoints
                    .filter(
                        (item) => {
                            return (
                                item.id !==
                                checkpointId
                            );
                        }
                    );

            this.saveRecoveryCheckpoints(
                options
            );

            return true;
        };

    /* ======================================================================
       SECTION 179
       CLEAN EXPIRED CHECKPOINTS
       ====================================================================== */

    ClosureClass.prototype.cleanupExpiredCheckpoints =
        function cleanupExpiredCheckpoints(
            options = {}
        ) {
            const persistence =
                this.ensurePersistenceState();

            const retentionMs =
                Math.max(
                    60 * 1000,
                    toFiniteNumber(
                        options.retentionMs,
                        DEFAULT_CHECKPOINT_RETENTION_MS
                    )
                );

            const removed = [];

            persistence.checkpoints =
                persistence
                    .checkpoints
                    .filter(
                        (checkpoint) => {
                            if (
                                isCheckpointExpired(
                                    checkpoint,
                                    retentionMs
                                )
                            ) {
                                checkpoint.status =
                                    CHECKPOINT_STATUS.EXPIRED;

                                removed.push(
                                    deepClone(
                                        checkpoint
                                    )
                                );

                                return false;
                            }

                            return true;
                        }
                    );

            this.saveRecoveryCheckpoints(
                options
            );

            return {
                removedCount:
                    removed.length,

                remainingCount:
                    persistence
                        .checkpoints
                        .length,

                removed,

                cleanedAt:
                    Date.now()
            };
        };

    /* ======================================================================
       SECTION 180
       GET RECOVERY CHECKPOINTS
       ====================================================================== */

    ClosureClass.prototype.getRecoveryCheckpoints =
        function getRecoveryCheckpoints(
            limit = 10
        ) {
            const persistence =
                this.ensurePersistenceState();

            const safeLimit =
                Math.max(
                    1,
                    Math.min(
                        DEFAULT_MAX_CHECKPOINTS,
                        Math.round(
                            toFiniteNumber(
                                limit,
                                10
                            )
                        )
                    )
                );

            return deepClone(
                persistence
                    .checkpoints
                    .slice(
                        -safeLimit
                    )
                    .reverse()
            );
        };

    /* ======================================================================
       SECTION 181
       EXPORT CLOSURE STATE
       ====================================================================== */

    ClosureClass.prototype.exportClosureState =
        function exportClosureState(
            options = {}
        ) {
            const payload =
                this.buildPersistencePayload(
                    options
                );

            const serialized =
                safeSerialize(
                    payload,
                    options
                );

            return {
                exportId:
                    payload.exportId,

                filename:
                    options.filename ||
                    (
                        "rainguard-recovery-closure-v32-" +
                        new Date()
                            .toISOString()
                            .replace(
                                /[:.]/g,
                                "-"
                            ) +
                        ".json"
                    ),

                mimeType:
                    "application/json",

                size:
                    serialized.length,

                serialized,

                payload:
                    options.includePayload ===
                    false
                        ? null
                        : deepClone(
                            payload
                        )
            };
        };

    /* ======================================================================
       SECTION 182
       IMPORT CLOSURE STATE
       ====================================================================== */

    ClosureClass.prototype.importClosureState =
        function importClosureState(
            input,
            options = {}
        ) {
            let payload =
                input;

            if (
                typeof input ===
                "string"
            ) {
                payload =
                    safeDeserialize(
                        input
                    );
            }

            const validation =
                validatePersistencePayload(
                    payload
                );

            if (!validation.valid) {
                return {
                    imported:
                        false,

                    reason:
                        validation.reason
                };
            }

            if (
                options.createCheckpointBeforeImport !==
                false
            ) {
                this.createRecoveryCheckpoint({
                    label:
                        "before_import",

                    reason:
                        "import_backup"
                });
            }

            const result =
                this.applyPersistencePayload(
                    payload,
                    options
                );

            if (
                options.saveAfterImport !==
                false
            ) {
                this.savePersistentState({
                    force:
                        true
                });
            }

            return {
                imported:
                    true,

                result,

                importedAt:
                    Date.now()
            };
        };

    /* ======================================================================
       SECTION 183
       START AUTOSAVE
       ====================================================================== */

    ClosureClass.prototype.startPersistenceAutosave =
        function startPersistenceAutosave(
            options = {}
        ) {
            const persistence =
                this.ensurePersistenceState();

            this.configurePersistence(
                options
            );

            if (
                persistence.autosaveTimer
            ) {
                global.clearInterval(
                    persistence
                        .autosaveTimer
                );
            }

            persistence
                .autosaveEnabled =
                true;

            persistence.autosaveTimer =
                global.setInterval(
                    () => {
                        if (
                            this.state
                                .activeClosure
                        ) {
                            return;
                        }

                        this.savePersistentState();
                    },
                    persistence
                        .autosaveIntervalMs
                );

            return {
                started:
                    true,

                intervalMs:
                    persistence
                        .autosaveIntervalMs
            };
        };

    /* ======================================================================
       SECTION 184
       STOP AUTOSAVE
       ====================================================================== */

    ClosureClass.prototype.stopPersistenceAutosave =
        function stopPersistenceAutosave() {
            const persistence =
                this.ensurePersistenceState();

            if (
                persistence.autosaveTimer
            ) {
                global.clearInterval(
                    persistence
                        .autosaveTimer
                );
            }

            persistence.autosaveTimer =
                null;

            persistence.autosaveEnabled =
                false;

            return {
                stopped:
                    true,

                stoppedAt:
                    Date.now()
            };
        };

    /* ======================================================================
       SECTION 185
       AUTO-RESTORE SESSION
       ====================================================================== */

    ClosureClass.prototype.restorePreviousSession =
        function restorePreviousSession(
            options = {}
        ) {
            const checkpoints =
                this.loadRecoveryCheckpoints(
                    options
                );

            const persistentState =
                this.loadPersistentState(
                    options
                );

            let diagnostics =
                null;

            if (
                persistentState.loaded &&
                typeof this
                    .runFinalDiagnostics ===
                "function"
            ) {
                diagnostics =
                    this.runFinalDiagnostics({
                        selfHeal:
                            options.selfHeal ===
                            true
                    });
            }

            return {
                restored:
                    persistentState.loaded,

                persistentState,

                checkpoints,

                diagnostics,

                restoredAt:
                    Date.now()
            };
        };

    /* ======================================================================
       SECTION 186
       GET PERSISTENCE STATUS
       ====================================================================== */

    ClosureClass.prototype.getPersistenceStatus =
        function getPersistenceStatus() {
            const persistence =
                this.ensurePersistenceState();

            return {
                status:
                    persistence.status,

                enabled:
                    persistence.enabled,

                storageType:
                    persistence.storageType,

                storageKey:
                    persistence.storageKey,

                checkpointStorageKey:
                    persistence
                        .checkpointStorageKey,

                autosaveEnabled:
                    persistence
                        .autosaveEnabled,

                autosaveIntervalMs:
                    persistence
                        .autosaveIntervalMs,

                checkpointCount:
                    persistence
                        .checkpoints
                        .length,

                lastSavedAt:
                    persistence
                        .lastSavedAt,

                lastLoadedAt:
                    persistence
                        .lastLoadedAt,

                lastClearedAt:
                    persistence
                        .lastClearedAt,

                saveCount:
                    persistence.saveCount,

                loadCount:
                    persistence.loadCount,

                failureCount:
                    persistence.failureCount,

                lastError:
                    persistence.lastError
                        ? deepClone(
                            persistence
                                .lastError
                        )
                        : null
            };
        };

    /* ======================================================================
       SECTION 187
       WRAP COMPLETE CLOSURE WITH AUTOSAVE
       ====================================================================== */

    const originalCompleteClosure =
        ClosureClass.prototype
            .completeClosure;

    ClosureClass.prototype.completeClosure =
        function completeClosureWithPersistence(
            closure =
                this.state
                    .activeClosure,
            options = {}
        ) {
            const result =
                originalCompleteClosure
                    .call(
                        this,
                        closure,
                        options
                    );

            if (
                options.persistAfterClosure !==
                false
            ) {
                try {
                    this.savePersistentState({
                        force:
                            true,

                        includeFrontendPayload:
                            options
                                .persistFrontendPayload !==
                            false
                    });
                } catch (error) {
                    this.ensurePersistenceState()
                        .lastError =
                        normalizeClosureError(
                            error
                        );
                }
            }

            return result;
        };

    /* ======================================================================
       SECTION 188
       API EXTENSIONS
       ====================================================================== */

    const ClosureApi =
        global
            .RainArrivalRecoveryClosureAPI ||
        global
            .RainGuardRecoveryClosureAPI;

    if (ClosureApi) {
        ClosureApi.saveState =
            function saveState(
                options = {}
            ) {
                return this
                    .requireInstance()
                    .savePersistentState(
                        options
                    );
            };

        ClosureApi.loadState =
            function loadState(
                options = {}
            ) {
                return this
                    .requireInstance()
                    .loadPersistentState(
                        options
                    );
            };

        ClosureApi.clearState =
            function clearState(
                options = {}
            ) {
                return this
                    .requireInstance()
                    .clearPersistentState(
                        options
                    );
            };

        ClosureApi.createCheckpoint =
            function createCheckpoint(
                options = {}
            ) {
                return this
                    .requireInstance()
                    .createRecoveryCheckpoint(
                        options
                    );
            };

        ClosureApi.restoreCheckpoint =
            function restoreCheckpoint(
                checkpointId,
                options = {}
            ) {
                return this
                    .requireInstance()
                    .restoreRecoveryCheckpoint(
                        checkpointId,
                        options
                    );
            };

        ClosureApi.getCheckpoints =
            function getCheckpoints(
                limit = 10
            ) {
                return this
                    .requireInstance()
                    .getRecoveryCheckpoints(
                        limit
                    );
            };

        ClosureApi.exportState =
            function exportState(
                options = {}
            ) {
                return this
                    .requireInstance()
                    .exportClosureState(
                        options
                    );
            };

        ClosureApi.importState =
            function importState(
                input,
                options = {}
            ) {
                return this
                    .requireInstance()
                    .importClosureState(
                        input,
                        options
                    );
            };

        ClosureApi.startAutosave =
            function startAutosave(
                options = {}
            ) {
                return this
                    .requireInstance()
                    .startPersistenceAutosave(
                        options
                    );
            };

        ClosureApi.stopAutosave =
            function stopAutosave() {
                return this
                    .requireInstance()
                    .stopPersistenceAutosave();
            };

        ClosureApi.restoreSession =
            function restoreSession(
                options = {}
            ) {
                return this
                    .requireInstance()
                    .restorePreviousSession(
                        options
                    );
            };

        ClosureApi.getPersistenceStatus =
            function getPersistenceStatus() {
                return this
                    .requireInstance()
                    .getPersistenceStatus();
            };
    }

    /* ======================================================================
       SECTION 189
       COMPATIBILITY ALIASES
       ====================================================================== */

    ClosureClass.prototype.saveState =
        ClosureClass.prototype
            .savePersistentState;

    ClosureClass.prototype.loadState =
        ClosureClass.prototype
            .loadPersistentState;

    ClosureClass.prototype.exportState =
        ClosureClass.prototype
            .exportClosureState;

    ClosureClass.prototype.importState =
        ClosureClass.prototype
            .importClosureState;

    ClosureClass.prototype.createCheckpoint =
        ClosureClass.prototype
            .createRecoveryCheckpoint;

    ClosureClass.prototype.restoreCheckpoint =
        ClosureClass.prototype
            .restoreRecoveryCheckpoint;

    ClosureClass.prototype.getCheckpoints =
        ClosureClass.prototype
            .getRecoveryCheckpoints;

    ClosureClass.prototype.restoreSession =
        ClosureClass.prototype
            .restorePreviousSession;

    /* ======================================================================
       SECTION 190
       PART 7 EXPORT
       ====================================================================== */

    global.RainArrivalRecoveryClosureV32Part7 = {
        PERSISTENCE_STATUS,
        CHECKPOINT_STATUS,
        STORAGE_TYPE,
        DEFAULT_STORAGE_KEY,
        DEFAULT_CHECKPOINT_STORAGE_KEY,
        DEFAULT_MAX_PERSISTED_HISTORY,
        DEFAULT_MAX_PERSISTED_ARCHIVES,
        DEFAULT_MAX_CHECKPOINTS,
        DEFAULT_CHECKPOINT_RETENTION_MS,
        DEFAULT_AUTOSAVE_INTERVAL_MS,
        DEFAULT_MAX_SERIALIZED_LENGTH,
        PERSISTENCE_SCHEMA,
        PERSISTENCE_VERSION,
        createCheckpointId,
        createExportId,
        normalizeStorageType,
        getStorageProvider,
        createSafeJsonReplacer,
        safeJsonReviver,
        safeSerialize,
        safeDeserialize,
        isCheckpointExpired,
        validatePersistencePayload
    };

})(window);



