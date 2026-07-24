/* ==========================================================================
   RainGuard AI
   Long Horizon Forecast Engine V32

   Post Recovery Monitoring Engine V32

   PART 1
   Core Foundation + Constants + Utilities + State Management
   ========================================================================== */

(function initializePostRecoveryMonitoringV32(global) {
    "use strict";

    /* ======================================================================
       SECTION 1
       ENGINE CONSTANTS
       ====================================================================== */

    const MONITORING_STATUS =
        Object.freeze({
            IDLE:
                "idle",

            STARTING:
                "starting",

            RUNNING:
                "running",

            PAUSED:
                "paused",

            STOPPING:
                "stopping",

            STOPPED:
                "stopped",

            DEGRADED:
                "degraded",

            FAILED:
                "failed",

            DESTROYED:
                "destroyed"
        });

    const RECOVERY_HEALTH_STATUS =
        Object.freeze({
            HEALTHY:
                "healthy",

            STABLE:
                "stable",

            WATCH:
                "watch",

            DEGRADED:
                "degraded",

            UNSTABLE:
                "unstable",

            CRITICAL:
                "critical",

            UNKNOWN:
                "unknown"
        });

    const MONITORING_EVENT =
        Object.freeze({
            MONITORING_STARTED:
                "post_recovery_monitoring_started",

            MONITORING_STOPPED:
                "post_recovery_monitoring_stopped",

            MONITORING_PAUSED:
                "post_recovery_monitoring_paused",

            MONITORING_RESUMED:
                "post_recovery_monitoring_resumed",

            MONITORING_FAILED:
                "post_recovery_monitoring_failed",

            CHECK_STARTED:
                "post_recovery_check_started",

            CHECK_COMPLETED:
                "post_recovery_check_completed",

            CHECK_FAILED:
                "post_recovery_check_failed",

            HEALTH_CHANGED:
                "post_recovery_health_changed",

            HEALTHY:
                "post_recovery_healthy",

            DEGRADED:
                "post_recovery_degraded",

            CRITICAL:
                "post_recovery_critical",

            ANOMALY_DETECTED:
                "post_recovery_anomaly_detected",

            STABILITY_CONFIRMED:
                "post_recovery_stability_confirmed",

            RECOVERY_REQUIRED:
                "post_recovery_recovery_required",

            REOPENING_RECOMMENDED:
                "post_recovery_reopening_recommended",

            SNAPSHOT_CREATED:
                "post_recovery_snapshot_created",

            HISTORY_CLEARED:
                "post_recovery_history_cleared",

            DESTROYED:
                "post_recovery_monitoring_destroyed"
        });

    const MONITORING_CHECK_TYPE =
        Object.freeze({
            CORE:
                "core",

            FORECAST:
                "forecast",

            ARRIVAL:
                "arrival",

            RAIN_CELLS:
                "rain_cells",

            SOURCES:
                "sources",

            DASHBOARD:
                "dashboard",

            FRONTEND:
                "frontend",

            RECOVERY:
                "recovery",

            CLOSURE:
                "closure",

            REOPENING:
                "reopening",

            MEMORY:
                "memory",

            PERFORMANCE:
                "performance",

            INTEGRITY:
                "integrity",

            COMPLETE:
                "complete"
        });

    const ANOMALY_SEVERITY =
        Object.freeze({
            INFO:
                "info",

            LOW:
                "low",

            MEDIUM:
                "medium",

            HIGH:
                "high",

            CRITICAL:
                "critical"
        });

    const DEFAULT_MONITORING_INTERVAL_MS =
        30 * 1000;

    const DEFAULT_INITIAL_DELAY_MS =
        1000;

    const DEFAULT_CHECK_TIMEOUT_MS =
        20 * 1000;

    const DEFAULT_STABILITY_WINDOW_MS =
        5 * 60 * 1000;

    const DEFAULT_MIN_STABLE_CHECKS =
        3;

    const DEFAULT_MAX_CONSECUTIVE_FAILURES =
        3;

    const DEFAULT_MAX_HISTORY =
        300;

    const DEFAULT_MAX_ANOMALIES =
        200;

    const DEFAULT_MAX_SNAPSHOTS =
        50;

    const DEFAULT_HEALTHY_SCORE =
        0.85;

    const DEFAULT_STABLE_SCORE =
        0.70;

    const DEFAULT_WATCH_SCORE =
        0.55;

    const DEFAULT_DEGRADED_SCORE =
        0.40;

    const DEFAULT_CRITICAL_SCORE =
        0.20;

    const DEFAULT_REOPENING_SCORE =
        0.80;

    /* ======================================================================
       SECTION 2
       UTILITY FUNCTIONS
       ====================================================================== */

    function toFiniteNumber(
        value,
        fallback = 0
    ) {
        const number =
            Number(value);

        return Number.isFinite(number)
            ? number
            : fallback;
    }

    function clamp(
        value,
        minimum = 0,
        maximum = 1
    ) {
        return Math.min(
            maximum,
            Math.max(
                minimum,
                toFiniteNumber(
                    value,
                    minimum
                )
            )
        );
    }

    function safeObject(
        value
    ) {
        return (
            value &&
            typeof value === "object" &&
            !Array.isArray(value)
        )
            ? value
            : {};
    }

    function safeArray(
        value
    ) {
        return Array.isArray(value)
            ? value
            : [];
    }

    function deepClone(
        value
    ) {
        if (
            value === null ||
            value === undefined
        ) {
            return value;
        }

        if (
            typeof global.structuredClone ===
            "function"
        ) {
            try {
                return global
                    .structuredClone(
                        value
                    );
            } catch (error) {
                /* Continue to JSON fallback. */
            }
        }

        try {
            return JSON.parse(
                JSON.stringify(
                    value
                )
            );
        } catch (error) {
            return value;
        }
    }

    function createMonitoringId() {
        return (
            "post_recovery_monitoring_" +
            Date.now() +
            "_" +
            Math.random()
                .toString(36)
                .slice(2, 9)
        );
    }

    function createCheckId() {
        return (
            "post_recovery_check_" +
            Date.now() +
            "_" +
            Math.random()
                .toString(36)
                .slice(2, 9)
        );
    }

    function createAnomalyId() {
        return (
            "post_recovery_anomaly_" +
            Date.now() +
            "_" +
            Math.random()
                .toString(36)
                .slice(2, 9)
        );
    }

    function createSnapshotId() {
        return (
            "post_recovery_snapshot_" +
            Date.now() +
            "_" +
            Math.random()
                .toString(36)
                .slice(2, 9)
        );
    }

    function createMonitoringError(
        message,
        code =
            "POST_RECOVERY_MONITORING_ERROR",
        metadata = {}
    ) {
        const error =
            new Error(
                message ||
                "Post recovery monitoring error."
            );

        error.name =
            "PostRecoveryMonitoringError";

        error.code =
            code;

        error.metadata =
            deepClone(
                safeObject(
                    metadata
                )
            );

        error.timestamp =
            Date.now();

        return error;
    }

    function normalizeMonitoringError(
        error
    ) {
        if (!error) {
            return {
                name:
                    "PostRecoveryMonitoringError",

                code:
                    "UNKNOWN_MONITORING_ERROR",

                message:
                    "Unknown post recovery monitoring error.",

                stack:
                    null,

                metadata: {},

                timestamp:
                    Date.now()
            };
        }

        return {
            name:
                error.name ||
                "PostRecoveryMonitoringError",

            code:
                error.code ||
                "POST_RECOVERY_MONITORING_ERROR",

            message:
                error.message ||
                String(error),

            stack:
                error.stack ||
                null,

            metadata:
                deepClone(
                    safeObject(
                        error.metadata
                    )
                ),

            timestamp:
                error.timestamp ||
                Date.now()
        };
    }

    function calculateAverage(
        values
    ) {
        const validValues =
            safeArray(values)
                .map(
                    (value) => {
                        return Number(value);
                    }
                )
                .filter(
                    Number.isFinite
                );

        if (!validValues.length) {
            return 0;
        }

        return (
            validValues.reduce(
                (
                    total,
                    value
                ) => {
                    return total + value;
                },
                0
            ) /
            validValues.length
        );
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

    function classifyRecoveryHealth(
        score
    ) {
        const normalizedScore =
            clamp(
                score,
                0,
                1
            );

        if (
            normalizedScore >=
            DEFAULT_HEALTHY_SCORE
        ) {
            return RECOVERY_HEALTH_STATUS
                .HEALTHY;
        }

        if (
            normalizedScore >=
            DEFAULT_STABLE_SCORE
        ) {
            return RECOVERY_HEALTH_STATUS
                .STABLE;
        }

        if (
            normalizedScore >=
            DEFAULT_WATCH_SCORE
        ) {
            return RECOVERY_HEALTH_STATUS
                .WATCH;
        }

        if (
            normalizedScore >=
            DEFAULT_DEGRADED_SCORE
        ) {
            return RECOVERY_HEALTH_STATUS
                .DEGRADED;
        }

        if (
            normalizedScore >=
            DEFAULT_CRITICAL_SCORE
        ) {
            return RECOVERY_HEALTH_STATUS
                .UNSTABLE;
        }

        return RECOVERY_HEALTH_STATUS
            .CRITICAL;
    }

    function normalizeSeverity(
        severity
    ) {
        const severities =
            Object.values(
                ANOMALY_SEVERITY
            );

        return severities.includes(
            severity
        )
            ? severity
            : ANOMALY_SEVERITY
                .MEDIUM;
    }

    function sleep(
        durationMs
    ) {
        return new Promise(
            (resolve) => {
                global.setTimeout(
                    resolve,
                    Math.max(
                        0,
                        toFiniteNumber(
                            durationMs,
                            0
                        )
                    )
                );
            }
        );
    }

    function withTimeout(
        promise,
        timeoutMs,
        errorMessage =
            "Post recovery monitoring check timed out."
    ) {
        const safeTimeout =
            Math.max(
                1000,
                toFiniteNumber(
                    timeoutMs,
                    DEFAULT_CHECK_TIMEOUT_MS
                )
            );

        return Promise.race([
            Promise.resolve(
                promise
            ),

            new Promise(
                (
                    resolve,
                    reject
                ) => {
                    global.setTimeout(
                        () => {
                            reject(
                                createMonitoringError(
                                    errorMessage,
                                    "MONITORING_CHECK_TIMEOUT"
                                )
                            );
                        },
                        safeTimeout
                    );
                }
            )
        ]);
    }

    /* ======================================================================
       SECTION 3
       EVENT EMITTER
       ====================================================================== */

    class PostRecoveryEventEmitterV32 {
        constructor() {
            this.listeners =
                new Map();
        }

        on(
            eventName,
            listener
        ) {
            if (
                typeof listener !==
                "function"
            ) {
                return () => {};
            }

            if (
                !this.listeners.has(
                    eventName
                )
            ) {
                this.listeners.set(
                    eventName,
                    new Set()
                );
            }

            this.listeners
                .get(eventName)
                .add(listener);

            return () => {
                this.off(
                    eventName,
                    listener
                );
            };
        }

        once(
            eventName,
            listener
        ) {
            if (
                typeof listener !==
                "function"
            ) {
                return () => {};
            }

            const unsubscribe =
                this.on(
                    eventName,
                    (payload) => {
                        unsubscribe();

                        listener(
                            payload
                        );
                    }
                );

            return unsubscribe;
        }

        off(
            eventName,
            listener
        ) {
            const eventListeners =
                this.listeners.get(
                    eventName
                );

            if (!eventListeners) {
                return false;
            }

            const deleted =
                eventListeners.delete(
                    listener
                );

            if (
                eventListeners.size ===
                0
            ) {
                this.listeners.delete(
                    eventName
                );
            }

            return deleted;
        }

        emit(
            eventName,
            payload = {}
        ) {
            const eventListeners =
                this.listeners.get(
                    eventName
                );

            if (!eventListeners) {
                return 0;
            }

            let executedCount =
                0;

            eventListeners.forEach(
                (listener) => {
                    try {
                        listener(
                            payload
                        );

                        executedCount +=
                            1;
                    } catch (error) {
                        global.console?.error?.(
                            "[PostRecoveryMonitoringV32] Event listener failed:",
                            error
                        );
                    }
                }
            );

            return executedCount;
        }

        removeAllListeners(
            eventName = null
        ) {
            if (eventName) {
                this.listeners.delete(
                    eventName
                );

                return;
            }

            this.listeners.clear();
        }

        listenerCount(
            eventName
        ) {
            return (
                this.listeners
                    .get(eventName)
                    ?.size ||
                0
            );
        }
    }

    /* ======================================================================
       SECTION 4
       MONITORING CONFIGURATION
       ====================================================================== */

    function createDefaultMonitoringConfiguration() {
        return {
            enabled:
                true,

            automaticStart:
                false,

            monitoringIntervalMs:
                DEFAULT_MONITORING_INTERVAL_MS,

            initialDelayMs:
                DEFAULT_INITIAL_DELAY_MS,

            checkTimeoutMs:
                DEFAULT_CHECK_TIMEOUT_MS,

            stabilityWindowMs:
                DEFAULT_STABILITY_WINDOW_MS,

            minimumStableChecks:
                DEFAULT_MIN_STABLE_CHECKS,

            maximumConsecutiveFailures:
                DEFAULT_MAX_CONSECUTIVE_FAILURES,

            maximumHistory:
                DEFAULT_MAX_HISTORY,

            maximumAnomalies:
                DEFAULT_MAX_ANOMALIES,

            maximumSnapshots:
                DEFAULT_MAX_SNAPSHOTS,

            reopeningRequiredScore:
                DEFAULT_REOPENING_SCORE,

            stopOnCritical:
                false,

            autoRecommendReopening:
                true,

            autoSnapshot:
                true,

            emitCoreEvents:
                true,

            checks: {
                core:
                    true,

                forecast:
                    true,

                arrival:
                    true,

                rainCells:
                    true,

                sources:
                    true,

                dashboard:
                    true,

                frontend:
                    true,

                recovery:
                    true,

                closure:
                    true,

                reopening:
                    true,

                memory:
                    true,

                performance:
                    true,

                integrity:
                    true
            }
        };
    }

    function normalizeMonitoringConfiguration(
        input = {}
    ) {
        const defaults =
            createDefaultMonitoringConfiguration();

        const options =
            safeObject(input);

        const checks = {
            ...defaults.checks,
            ...safeObject(
                options.checks
            )
        };

        return {
            ...defaults,
            ...options,

            enabled:
                options.enabled !==
                false,

            automaticStart:
                options.automaticStart ===
                true,

            monitoringIntervalMs:
                Math.max(
                    5000,
                    toFiniteNumber(
                        options
                            .monitoringIntervalMs,
                        defaults
                            .monitoringIntervalMs
                    )
                ),

            initialDelayMs:
                Math.max(
                    0,
                    toFiniteNumber(
                        options.initialDelayMs,
                        defaults.initialDelayMs
                    )
                ),

            checkTimeoutMs:
                Math.max(
                    1000,
                    toFiniteNumber(
                        options.checkTimeoutMs,
                        defaults.checkTimeoutMs
                    )
                ),

            stabilityWindowMs:
                Math.max(
                    30 * 1000,
                    toFiniteNumber(
                        options
                            .stabilityWindowMs,
                        defaults
                            .stabilityWindowMs
                    )
                ),

            minimumStableChecks:
                Math.max(
                    1,
                    Math.round(
                        toFiniteNumber(
                            options
                                .minimumStableChecks,
                            defaults
                                .minimumStableChecks
                        )
                    )
                ),

            maximumConsecutiveFailures:
                Math.max(
                    1,
                    Math.round(
                        toFiniteNumber(
                            options
                                .maximumConsecutiveFailures,
                            defaults
                                .maximumConsecutiveFailures
                        )
                    )
                ),

            maximumHistory:
                Math.max(
                    20,
                    Math.round(
                        toFiniteNumber(
                            options.maximumHistory,
                            defaults.maximumHistory
                        )
                    )
                ),

            maximumAnomalies:
                Math.max(
                    20,
                    Math.round(
                        toFiniteNumber(
                            options.maximumAnomalies,
                            defaults.maximumAnomalies
                        )
                    )
                ),

            maximumSnapshots:
                Math.max(
                    5,
                    Math.round(
                        toFiniteNumber(
                            options.maximumSnapshots,
                            defaults.maximumSnapshots
                        )
                    )
                ),

            reopeningRequiredScore:
                clamp(
                    toFiniteNumber(
                        options
                            .reopeningRequiredScore,
                        defaults
                            .reopeningRequiredScore
                    ),
                    0,
                    1
                ),

            stopOnCritical:
                options.stopOnCritical ===
                true,

            autoRecommendReopening:
                options
                    .autoRecommendReopening !==
                false,

            autoSnapshot:
                options.autoSnapshot !==
                false,

            emitCoreEvents:
                options.emitCoreEvents !==
                false,

            checks
        };
    }

    /* ======================================================================
       SECTION 5
       INITIAL STATE FACTORY
       ====================================================================== */

    function createInitialMonitoringState() {
        return {
            id:
                createMonitoringId(),

            status:
                MONITORING_STATUS.IDLE,

            healthStatus:
                RECOVERY_HEALTH_STATUS
                    .UNKNOWN,

            healthScore:
                0,

            previousHealthStatus:
                null,

            previousHealthScore:
                null,

            startedAt:
                null,

            stoppedAt:
                null,

            pausedAt:
                null,

            resumedAt:
                null,

            lastCheckAt:
                null,

            nextCheckAt:
                null,

            lastSuccessfulCheckAt:
                null,

            lastFailedCheckAt:
                null,

            stableSince:
                null,

            monitoringDurationMs:
                0,

            checkInProgress:
                false,

            currentCheck:
                null,

            lastCheck:
                null,

            checkHistory: [],

            anomalies: [],

            snapshots: [],

            stabilityHistory: [],

            consecutiveSuccessfulChecks:
                0,

            consecutiveFailedChecks:
                0,

            totalChecks:
                0,

            successfulChecks:
                0,

            failedChecks:
                0,

            skippedChecks:
                0,

            totalAnomalies:
                0,

            criticalAnomalies:
                0,

            stabilityConfirmed:
                false,

            reopeningRecommended:
                false,

            recoveryRequired:
                false,

            timer:
                null,

            initialTimer:
                null,

            lastError:
                null,

            destroyed:
                false,

            metadata: {}
        };
    }

    /* ======================================================================
       SECTION 6
       MONITORING CLASS
       ====================================================================== */

    class PostRecoveryMonitoringV32 {
        constructor(
            core,
            options = {}
        ) {
            if (
                !core ||
                typeof core !==
                "object"
            ) {
                throw createMonitoringError(
                    "A valid recovery core instance is required.",
                    "RECOVERY_CORE_REQUIRED"
                );
            }

            this.core =
                core;

            this.configuration =
                normalizeMonitoringConfiguration(
                    options
                );

            this.state =
                createInitialMonitoringState();

            this.events =
                new PostRecoveryEventEmitterV32();

            this.boundHandlers =
                new Map();

            this.lifecycleHooks =
                new Map();

            this.destroyed =
                false;

            this.state.metadata = {
                createdAt:
                    Date.now(),

                version:
                    "32.1.0",

                source:
                    "post_recovery_monitoring_v32"
            };

            this.attachToCore();

            if (
                this.configuration
                    .automaticStart
            ) {
                this.start();
            }
        }

        /* ==================================================================
           SECTION 7
           CORE ATTACHMENT
           ================================================================== */

        attachToCore() {
            this.core
                .postRecoveryMonitoring =
                this;

            this.core.state =
                safeObject(
                    this.core.state
                );

            this.core.state
                .postRecoveryMonitoring =
                this.getPublicState();

            return this;
        }

        synchronizeCoreState() {
            if (
                !this.core ||
                !this.core.state
            ) {
                return false;
            }

            this.core.state
                .postRecoveryMonitoring =
                this.getPublicState();

            return true;
        }

        /* ==================================================================
           SECTION 8
           EVENT METHODS
           ================================================================== */

        on(
            eventName,
            listener
        ) {
            return this.events.on(
                eventName,
                listener
            );
        }

        once(
            eventName,
            listener
        ) {
            return this.events.once(
                eventName,
                listener
            );
        }

        off(
            eventName,
            listener
        ) {
            return this.events.off(
                eventName,
                listener
            );
        }

        emit(
            eventName,
            payload = {}
        ) {
            const eventPayload = {
                monitoringId:
                    this.state.id,

                status:
                    this.state.status,

                healthStatus:
                    this.state
                        .healthStatus,

                healthScore:
                    this.state
                        .healthScore,

                timestamp:
                    Date.now(),

                ...safeObject(
                    payload
                )
            };

            const localCount =
                this.events.emit(
                    eventName,
                    eventPayload
                );

            if (
                this.configuration
                    .emitCoreEvents &&
                typeof this.core.emit ===
                "function"
            ) {
                try {
                    this.core.emit(
                        eventName,
                        deepClone(
                            eventPayload
                        )
                    );
                } catch (error) {
                    global.console?.error?.(
                        "[PostRecoveryMonitoringV32] Core event emission failed:",
                        error
                    );
                }
            }

            return localCount;
        }

        /* ==================================================================
           SECTION 9
           CONFIGURATION METHODS
           ================================================================== */

        configure(
            options = {}
        ) {
            this.configuration =
                normalizeMonitoringConfiguration({
                    ...this.configuration,
                    ...safeObject(options),

                    checks: {
                        ...this.configuration
                            .checks,

                        ...safeObject(
                            options.checks
                        )
                    }
                });

            this.synchronizeCoreState();

            return this
                .getConfiguration();
        }

        getConfiguration() {
            return deepClone(
                this.configuration
            );
        }

        /* ==================================================================
           SECTION 10
           STATE METHODS
           ================================================================== */

        getPublicState() {
            const {
                timer,
                initialTimer,
                ...publicState
            } = this.state;

            return deepClone(
                publicState
            );
        }

        getStatus() {
            return {
                id:
                    this.state.id,

                status:
                    this.state.status,

                healthStatus:
                    this.state
                        .healthStatus,

                healthScore:
                    this.state
                        .healthScore,

                running:
                    this.state.status ===
                    MONITORING_STATUS.RUNNING,

                paused:
                    this.state.status ===
                    MONITORING_STATUS.PAUSED,

                checkInProgress:
                    this.state
                        .checkInProgress,

                totalChecks:
                    this.state.totalChecks,

                successfulChecks:
                    this.state
                        .successfulChecks,

                failedChecks:
                    this.state.failedChecks,

                consecutiveSuccessfulChecks:
                    this.state
                        .consecutiveSuccessfulChecks,

                consecutiveFailedChecks:
                    this.state
                        .consecutiveFailedChecks,

                stabilityConfirmed:
                    this.state
                        .stabilityConfirmed,

                reopeningRecommended:
                    this.state
                        .reopeningRecommended,

                recoveryRequired:
                    this.state
                        .recoveryRequired,

                lastCheckAt:
                    this.state.lastCheckAt,

                nextCheckAt:
                    this.state.nextCheckAt,

                lastError:
                    this.state.lastError
                        ? deepClone(
                            this.state.lastError
                        )
                        : null,

                destroyed:
                    this.destroyed
            };
        }

        updateMonitoringDuration() {
            if (
                !this.state.startedAt
            ) {
                this.state
                    .monitoringDurationMs =
                    0;

                return 0;
            }

            const endTime =
                this.state.stoppedAt ||
                Date.now();

            this.state
                .monitoringDurationMs =
                Math.max(
                    0,
                    endTime -
                    this.state.startedAt
                );

            return this.state
                .monitoringDurationMs;
        }

        /* ==================================================================
           SECTION 11
           HEALTH STATE UPDATE
           ================================================================== */

        updateHealthState(
            score,
            metadata = {}
        ) {
            const normalizedScore =
                clamp(
                    score,
                    0,
                    1
                );

            const newStatus =
                classifyRecoveryHealth(
                    normalizedScore
                );

            const previousStatus =
                this.state
                    .healthStatus;

            const previousScore =
                this.state
                    .healthScore;

            this.state
                .previousHealthStatus =
                previousStatus;

            this.state
                .previousHealthScore =
                previousScore;

            this.state.healthScore =
                normalizedScore;

            this.state.healthStatus =
                newStatus;

            if (
                previousStatus !==
                newStatus
            ) {
                this.emit(
                    MONITORING_EVENT
                        .HEALTH_CHANGED,
                    {
                        previousStatus,

                        currentStatus:
                            newStatus,

                        previousScore,

                        currentScore:
                            normalizedScore,

                        metadata:
                            deepClone(
                                safeObject(
                                    metadata
                                )
                            )
                    }
                );
            }

            if (
                newStatus ===
                RECOVERY_HEALTH_STATUS
                    .HEALTHY
            ) {
                this.emit(
                    MONITORING_EVENT.HEALTHY,
                    {
                        score:
                            normalizedScore
                    }
                );
            }

            if (
                [
                    RECOVERY_HEALTH_STATUS
                        .DEGRADED,

                    RECOVERY_HEALTH_STATUS
                        .UNSTABLE
                ].includes(
                    newStatus
                )
            ) {
                this.emit(
                    MONITORING_EVENT.DEGRADED,
                    {
                        score:
                            normalizedScore,

                        status:
                            newStatus
                    }
                );
            }

            if (
                newStatus ===
                RECOVERY_HEALTH_STATUS
                    .CRITICAL
            ) {
                this.emit(
                    MONITORING_EVENT.CRITICAL,
                    {
                        score:
                            normalizedScore
                    }
                );
            }

            this.synchronizeCoreState();

            return {
                previousStatus,

                previousScore,

                currentStatus:
                    newStatus,

                currentScore:
                    normalizedScore
            };
        }

        /* ==================================================================
           SECTION 12
           ANOMALY MANAGEMENT
           ================================================================== */

        createAnomaly(
            type,
            severity,
            message,
            metadata = {}
        ) {
            const anomaly = {
                id:
                    createAnomalyId(),

                type:
                    type ||
                    "unknown",

                severity:
                    normalizeSeverity(
                        severity
                    ),

                message:
                    message ||
                    "Post recovery anomaly detected.",

                monitoringId:
                    this.state.id,

                checkId:
                    this.state
                        .currentCheck
                        ?.id ||
                    null,

                metadata:
                    deepClone(
                        safeObject(
                            metadata
                        )
                    ),

                acknowledged:
                    false,

                resolved:
                    false,

                createdAt:
                    Date.now(),

                resolvedAt:
                    null
            };

            this.state
                .anomalies
                .push(anomaly);

            this.state.totalAnomalies +=
                1;

            if (
                anomaly.severity ===
                ANOMALY_SEVERITY.CRITICAL
            ) {
                this.state
                    .criticalAnomalies +=
                    1;
            }

            this.state.anomalies =
                this.state
                    .anomalies
                    .slice(
                        -this.configuration
                            .maximumAnomalies
                    );

            this.emit(
                MONITORING_EVENT
                    .ANOMALY_DETECTED,
                {
                    anomaly:
                        deepClone(
                            anomaly
                        )
                }
            );

            this.synchronizeCoreState();

            return deepClone(
                anomaly
            );
        }

        getAnomalies(
            options = {}
        ) {
            const safeOptions =
                safeObject(options);

            let anomalies =
                this.state
                    .anomalies
                    .slice();

            if (
                safeOptions.severity
            ) {
                anomalies =
                    anomalies.filter(
                        (anomaly) => {
                            return (
                                anomaly.severity ===
                                safeOptions.severity
                            );
                        }
                    );
            }

            if (
                safeOptions.type
            ) {
                anomalies =
                    anomalies.filter(
                        (anomaly) => {
                            return (
                                anomaly.type ===
                                safeOptions.type
                            );
                        }
                    );
            }

            if (
                safeOptions.unresolvedOnly ===
                true
            ) {
                anomalies =
                    anomalies.filter(
                        (anomaly) => {
                            return (
                                anomaly.resolved !==
                                true
                            );
                        }
                    );
            }

            const limit =
                Math.max(
                    1,
                    Math.round(
                        toFiniteNumber(
                            safeOptions.limit,
                            50
                        )
                    )
                );

            return deepClone(
                anomalies
                    .slice(
                        -limit
                    )
                    .reverse()
            );
        }

        acknowledgeAnomaly(
            anomalyId
        ) {
            const anomaly =
                this.state
                    .anomalies
                    .find(
                        (item) => {
                            return (
                                item.id ===
                                anomalyId
                            );
                        }
                    );

            if (!anomaly) {
                return false;
            }

            anomaly.acknowledged =
                true;

            anomaly.acknowledgedAt =
                Date.now();

            this.synchronizeCoreState();

            return true;
        }

        resolveAnomaly(
            anomalyId,
            metadata = {}
        ) {
            const anomaly =
                this.state
                    .anomalies
                    .find(
                        (item) => {
                            return (
                                item.id ===
                                anomalyId
                            );
                        }
                    );

            if (!anomaly) {
                return false;
            }

            anomaly.resolved =
                true;

            anomaly.resolvedAt =
                Date.now();

            anomaly.resolution =
                deepClone(
                    safeObject(
                        metadata
                    )
                );

            this.synchronizeCoreState();

            return true;
        }

        /* ==================================================================
           SECTION 13
           SNAPSHOT MANAGEMENT
           ================================================================== */

        createSnapshot(
            label =
                "post_recovery_snapshot",
            metadata = {}
        ) {
            const snapshot = {
                id:
                    createSnapshotId(),

                label,

                monitoringId:
                    this.state.id,

                status:
                    this.state.status,

                healthStatus:
                    this.state
                        .healthStatus,

                healthScore:
                    this.state
                        .healthScore,

                totalChecks:
                    this.state.totalChecks,

                successfulChecks:
                    this.state
                        .successfulChecks,

                failedChecks:
                    this.state.failedChecks,

                consecutiveSuccessfulChecks:
                    this.state
                        .consecutiveSuccessfulChecks,

                consecutiveFailedChecks:
                    this.state
                        .consecutiveFailedChecks,

                stabilityConfirmed:
                    this.state
                        .stabilityConfirmed,

                reopeningRecommended:
                    this.state
                        .reopeningRecommended,

                recoveryRequired:
                    this.state
                        .recoveryRequired,

                anomalyCount:
                    this.state
                        .anomalies
                        .length,

                coreState:
                    deepClone({
                        arrivalPredictions:
                            safeArray(
                                this.core.state
                                    ?.arrivalPredictions
                            ),

                        rainCells:
                            safeArray(
                                this.core.state
                                    ?.rainCells
                            ),

                        horizonForecasts:
                            this.core.state
                                ?.horizonForecasts ||
                            {},

                        regionSummaries:
                            safeArray(
                                this.core.state
                                    ?.regionSummaries
                            ),

                        governorateSummaries:
                            safeArray(
                                this.core.state
                                    ?.governorateSummaries
                            ),

                        nationalArrivalDashboard:
                            this.core.state
                                ?.nationalArrivalDashboard ||
                            null
                    }),

                metadata:
                    deepClone(
                        safeObject(
                            metadata
                        )
                    ),

                createdAt:
                    Date.now()
            };

            this.state
                .snapshots
                .push(snapshot);

            this.state.snapshots =
                this.state
                    .snapshots
                    .slice(
                        -this.configuration
                            .maximumSnapshots
                    );

            this.emit(
                MONITORING_EVENT
                    .SNAPSHOT_CREATED,
                {
                    snapshot:
                        deepClone(
                            snapshot
                        )
                }
            );

            this.synchronizeCoreState();

            return deepClone(
                snapshot
            );
        }

        getSnapshots(
            limit = 10
        ) {
            const safeLimit =
                Math.max(
                    1,
                    Math.min(
                        this.configuration
                            .maximumSnapshots,
                        Math.round(
                            toFiniteNumber(
                                limit,
                                10
                            )
                        )
                    )
                );

            return deepClone(
                this.state
                    .snapshots
                    .slice(
                        -safeLimit
                    )
                    .reverse()
            );
        }

        /* ==================================================================
           SECTION 14
           RESET
           ================================================================== */

        reset(
            options = {}
        ) {
            const safeOptions =
                safeObject(options);

            this.clearTimers();

            const oldId =
                this.state.id;

            const oldHistory =
                this.state
                    .checkHistory;

            const oldAnomalies =
                this.state
                    .anomalies;

            const oldSnapshots =
                this.state
                    .snapshots;

            this.state =
                createInitialMonitoringState();

            if (
                safeOptions.preserveId ===
                true
            ) {
                this.state.id =
                    oldId;
            }

            if (
                safeOptions.clearHistory ===
                false
            ) {
                this.state
                    .checkHistory =
                    oldHistory;
            }

            if (
                safeOptions.clearAnomalies ===
                false
            ) {
                this.state
                    .anomalies =
                    oldAnomalies;
            }

            if (
                safeOptions.clearSnapshots ===
                false
            ) {
                this.state
                    .snapshots =
                    oldSnapshots;
            }

            this.state.metadata = {
                resetAt:
                    Date.now(),

                version:
                    "32.1.0",

                source:
                    "post_recovery_monitoring_v32"
            };

            this.synchronizeCoreState();

            return this
                .getPublicState();
        }

        /* ==================================================================
           SECTION 15
           TIMER CLEANUP
           ================================================================== */

        clearTimers() {
            if (
                this.state.timer
            ) {
                global.clearInterval(
                    this.state.timer
                );
            }

            if (
                this.state.initialTimer
            ) {
                global.clearTimeout(
                    this.state.initialTimer
                );
            }

            this.state.timer =
                null;

            this.state.initialTimer =
                null;

            this.state.nextCheckAt =
                null;

            return true;
        }
    }

    /* ======================================================================
       SECTION 16
       CORE PROTOTYPE INTEGRATION
       ====================================================================== */

    function installCorePrototypeIntegration() {
        const CoreClass =
            global.RainArrivalRecoveryCoreV32;

        if (
            typeof CoreClass !==
            "function"
        ) {
            return false;
        }

        if (
            typeof CoreClass.prototype
                .createPostRecoveryMonitoring !==
            "function"
        ) {
            CoreClass.prototype
                .createPostRecoveryMonitoring =
                function createPostRecoveryMonitoring(
                    options = {}
                ) {
                    if (
                        this.postRecoveryMonitoring instanceof
                        PostRecoveryMonitoringV32
                    ) {
                        this.postRecoveryMonitoring
                            .configure(
                                options
                            );

                        return this
                            .postRecoveryMonitoring;
                    }

                    return new PostRecoveryMonitoringV32(
                        this,
                        options
                    );
                };
        }

        if (
            typeof CoreClass.prototype
                .getPostRecoveryMonitoring !==
            "function"
        ) {
            CoreClass.prototype
                .getPostRecoveryMonitoring =
                function getPostRecoveryMonitoring() {
                    return (
                        this.postRecoveryMonitoring ||
                        null
                    );
                };
        }

        if (
            typeof CoreClass.prototype
                .getPostRecoveryMonitoringStatus !==
            "function"
        ) {
            CoreClass.prototype
                .getPostRecoveryMonitoringStatus =
                function getPostRecoveryMonitoringStatus() {
                    return this
                        .postRecoveryMonitoring
                        ?.getStatus?.() ||
                        null;
                };
        }

        return true;
    }

    installCorePrototypeIntegration();

    /* ======================================================================
       SECTION 17
       GLOBAL API
       ====================================================================== */

    const PostRecoveryMonitoringAPI = {
        instance:
            null,

        create(
            core,
            options = {}
        ) {
            this.instance =
                new PostRecoveryMonitoringV32(
                    core,
                    options
                );

            return this.instance;
        },

        attach(
            instance
        ) {
            if (
                !(
                    instance instanceof
                    PostRecoveryMonitoringV32
                )
            ) {
                throw createMonitoringError(
                    "Invalid post recovery monitoring instance.",
                    "INVALID_MONITORING_INSTANCE"
                );
            }

            this.instance =
                instance;

            return instance;
        },

        getInstance() {
            return this.instance;
        },

        requireInstance() {
            if (
                !(
                    this.instance instanceof
                    PostRecoveryMonitoringV32
                )
            ) {
                throw createMonitoringError(
                    "Post recovery monitoring instance has not been created.",
                    "MONITORING_INSTANCE_REQUIRED"
                );
            }

            return this.instance;
        },

        getStatus() {
            return this
                .requireInstance()
                .getStatus();
        },

        getState() {
            return this
                .requireInstance()
                .getPublicState();
        },

        configure(
            options = {}
        ) {
            return this
                .requireInstance()
                .configure(
                    options
                );
        },

        getAnomalies(
            options = {}
        ) {
            return this
                .requireInstance()
                .getAnomalies(
                    options
                );
        },

        getSnapshots(
            limit = 10
        ) {
            return this
                .requireInstance()
                .getSnapshots(
                    limit
                );
        },

        reset(
            options = {}
        ) {
            return this
                .requireInstance()
                .reset(
                    options
                );
        }
    };

    /* ======================================================================
       SECTION 18
       GLOBAL EXPORTS
       ====================================================================== */

    global.PostRecoveryMonitoringV32 =
        PostRecoveryMonitoringV32;

    global.RainArrivalPostRecoveryMonitoringV32 =
        PostRecoveryMonitoringV32;

    global.RainGuardPostRecoveryMonitoringV32 =
        PostRecoveryMonitoringV32;

    global.PostRecoveryMonitoringV32Constants = {
        MONITORING_STATUS,
        RECOVERY_HEALTH_STATUS,
        MONITORING_EVENT,
        MONITORING_CHECK_TYPE,
        ANOMALY_SEVERITY,
        DEFAULT_MONITORING_INTERVAL_MS,
        DEFAULT_INITIAL_DELAY_MS,
        DEFAULT_CHECK_TIMEOUT_MS,
        DEFAULT_STABILITY_WINDOW_MS,
        DEFAULT_MIN_STABLE_CHECKS,
        DEFAULT_MAX_CONSECUTIVE_FAILURES,
        DEFAULT_MAX_HISTORY,
        DEFAULT_MAX_ANOMALIES,
        DEFAULT_MAX_SNAPSHOTS,
        DEFAULT_HEALTHY_SCORE,
        DEFAULT_STABLE_SCORE,
        DEFAULT_WATCH_SCORE,
        DEFAULT_DEGRADED_SCORE,
        DEFAULT_CRITICAL_SCORE,
        DEFAULT_REOPENING_SCORE
    };

    global.PostRecoveryMonitoringV32Utils = {
        toFiniteNumber,
        clamp,
        safeObject,
        safeArray,
        deepClone,
        createMonitoringId,
        createCheckId,
        createAnomalyId,
        createSnapshotId,
        createMonitoringError,
        normalizeMonitoringError,
        calculateAverage,
        calculateRatio,
        classifyRecoveryHealth,
        normalizeSeverity,
        sleep,
        withTimeout,
        createDefaultMonitoringConfiguration,
        normalizeMonitoringConfiguration,
        createInitialMonitoringState
    };

    global.PostRecoveryMonitoringV32EventEmitter =
        PostRecoveryEventEmitterV32;

    global.PostRecoveryMonitoringV32API =
        PostRecoveryMonitoringAPI;

    global.RainArrivalPostRecoveryMonitoringV32API =
        PostRecoveryMonitoringAPI;

    global.RainGuardPostRecoveryMonitoringV32API =
        PostRecoveryMonitoringAPI;

})(window);

/* ==========================================================================
   RainGuard AI
   Long Horizon Forecast Engine V32

   Post Recovery Monitoring Engine V32

   PART 2
   Monitoring Checks + Health Scoring + Check Execution
   ========================================================================== */

(function extendPostRecoveryMonitoringV32Part2(global) {
    "use strict";

    /* ======================================================================
       SECTION 19
       DEPENDENCY RESOLUTION
       ====================================================================== */

    const MonitoringClass =
        global.PostRecoveryMonitoringV32;

    const MonitoringConstants =
        global.PostRecoveryMonitoringV32Constants;

    const MonitoringUtils =
        global.PostRecoveryMonitoringV32Utils;

    if (
        typeof MonitoringClass !==
        "function" ||
        !MonitoringConstants ||
        !MonitoringUtils
    ) {
        throw new Error(
            "PostRecoveryMonitoringV32 Part 1 must be loaded before Part 2."
        );
    }

    const {
        MONITORING_STATUS,
        RECOVERY_HEALTH_STATUS,
        MONITORING_EVENT,
        MONITORING_CHECK_TYPE,
        ANOMALY_SEVERITY,
        DEFAULT_CHECK_TIMEOUT_MS,
        DEFAULT_MAX_HISTORY
    } = MonitoringConstants;

    const {
        toFiniteNumber,
        clamp,
        safeObject,
        safeArray,
        deepClone,
        createCheckId,
        createMonitoringError,
        normalizeMonitoringError,
        calculateAverage,
        calculateRatio,
        classifyRecoveryHealth,
        withTimeout
    } = MonitoringUtils;

    /* ======================================================================
       SECTION 20
       CHECK RESULT CONSTANTS
       ====================================================================== */

    const CHECK_RESULT_STATUS =
        Object.freeze({
            PASSED:
                "passed",

            WARNING:
                "warning",

            FAILED:
                "failed",

            SKIPPED:
                "skipped",

            TIMEOUT:
                "timeout",

            UNKNOWN:
                "unknown"
        });

    const CHECK_WEIGHT =
        Object.freeze({
            CORE:
                0.15,

            FORECAST:
                0.12,

            ARRIVAL:
                0.13,

            RAIN_CELLS:
                0.08,

            SOURCES:
                0.10,

            DASHBOARD:
                0.08,

            FRONTEND:
                0.07,

            RECOVERY:
                0.08,

            CLOSURE:
                0.06,

            REOPENING:
                0.03,

            MEMORY:
                0.04,

            PERFORMANCE:
                0.03,

            INTEGRITY:
                0.03
        });

    const DEFAULT_SOURCE_FRESHNESS_MS =
        15 * 60 * 1000;

    const DEFAULT_FORECAST_FRESHNESS_MS =
        30 * 60 * 1000;

    const DEFAULT_MAX_MEMORY_RATIO =
        0.85;

    const DEFAULT_MAX_CHECK_DURATION_MS =
        10 * 1000;

    const DEFAULT_MIN_SOURCE_COUNT =
        1;

    const DEFAULT_REQUIRED_HORIZONS = [
        6,
        12,
        24,
        48,
        72
    ];

    /* ======================================================================
       SECTION 21
       CHECK HELPERS
       ====================================================================== */

    function createCheckResult(
        type,
        options = {}
    ) {
        const safeOptions =
            safeObject(options);

        const score =
            clamp(
                toFiniteNumber(
                    safeOptions.score,
                    0
                ),
                0,
                1
            );

        return {
            type,

            status:
                safeOptions.status ||
                classifyCheckStatus(
                    score
                ),

            score,

            weight:
                clamp(
                    toFiniteNumber(
                        safeOptions.weight,
                        0
                    ),
                    0,
                    1
                ),

            passed:
                safeOptions.passed ===
                true ||
                score >=
                0.70,

            message:
                safeOptions.message ||
                null,

            details:
                deepClone(
                    safeObject(
                        safeOptions.details
                    )
                ),

            anomalies:
                deepClone(
                    safeArray(
                        safeOptions.anomalies
                    )
                ),

            durationMs:
                Math.max(
                    0,
                    toFiniteNumber(
                        safeOptions.durationMs,
                        0
                    )
                ),

            checkedAt:
                safeOptions.checkedAt ||
                Date.now()
        };
    }

    function classifyCheckStatus(
        score
    ) {
        const normalized =
            clamp(
                score,
                0,
                1
            );

        if (
            normalized >=
            0.75
        ) {
            return CHECK_RESULT_STATUS
                .PASSED;
        }

        if (
            normalized >=
            0.45
        ) {
            return CHECK_RESULT_STATUS
                .WARNING;
        }

        return CHECK_RESULT_STATUS
            .FAILED;
    }

    function getCheckWeight(
        type
    ) {
        switch (type) {
            case MONITORING_CHECK_TYPE.CORE:
                return CHECK_WEIGHT.CORE;

            case MONITORING_CHECK_TYPE.FORECAST:
                return CHECK_WEIGHT.FORECAST;

            case MONITORING_CHECK_TYPE.ARRIVAL:
                return CHECK_WEIGHT.ARRIVAL;

            case MONITORING_CHECK_TYPE.RAIN_CELLS:
                return CHECK_WEIGHT.RAIN_CELLS;

            case MONITORING_CHECK_TYPE.SOURCES:
                return CHECK_WEIGHT.SOURCES;

            case MONITORING_CHECK_TYPE.DASHBOARD:
                return CHECK_WEIGHT.DASHBOARD;

            case MONITORING_CHECK_TYPE.FRONTEND:
                return CHECK_WEIGHT.FRONTEND;

            case MONITORING_CHECK_TYPE.RECOVERY:
                return CHECK_WEIGHT.RECOVERY;

            case MONITORING_CHECK_TYPE.CLOSURE:
                return CHECK_WEIGHT.CLOSURE;

            case MONITORING_CHECK_TYPE.REOPENING:
                return CHECK_WEIGHT.REOPENING;

            case MONITORING_CHECK_TYPE.MEMORY:
                return CHECK_WEIGHT.MEMORY;

            case MONITORING_CHECK_TYPE.PERFORMANCE:
                return CHECK_WEIGHT.PERFORMANCE;

            case MONITORING_CHECK_TYPE.INTEGRITY:
                return CHECK_WEIGHT.INTEGRITY;

            default:
                return 0;
        }
    }

    function normalizeTimestamp(
        value
    ) {
        if (
            value instanceof Date
        ) {
            return value.getTime();
        }

        if (
            typeof value ===
            "string"
        ) {
            const parsed =
                Date.parse(
                    value
                );

            return Number.isFinite(
                parsed
            )
                ? parsed
                : 0;
        }

        return toFiniteNumber(
            value,
            0
        );
    }

    function calculateFreshnessScore(
        timestamp,
        maximumAgeMs
    ) {
        const normalizedTimestamp =
            normalizeTimestamp(
                timestamp
            );

        if (
            normalizedTimestamp <=
            0
        ) {
            return 0;
        }

        const age =
            Math.max(
                0,
                Date.now() -
                normalizedTimestamp
            );

        if (
            age <=
            maximumAgeMs
        ) {
            return 1;
        }

        return clamp(
            1 -
            (
                age -
                maximumAgeMs
            ) /
            (
                maximumAgeMs *
                3
            ),
            0,
            1
        );
    }

    function findLatestTimestamp(
        records
    ) {
        return safeArray(records)
            .reduce(
                (
                    latest,
                    record
                ) => {
                    const timestamp =
                        normalizeTimestamp(
                            record?.updatedAt ||
                            record?.generatedAt ||
                            record?.timestamp ||
                            record?.createdAt ||
                            record?.observedAt
                        );

                    return Math.max(
                        latest,
                        timestamp
                    );
                },
                0
            );
    }

    function countAvailableHorizons(
        horizonForecasts,
        requiredHorizons =
            DEFAULT_REQUIRED_HORIZONS
    ) {
        const forecasts =
            safeObject(
                horizonForecasts
            );

        return safeArray(
            requiredHorizons
        )
            .filter(
                (hours) => {
                    return (
                        forecasts[hours] !=
                        null ||
                        forecasts[
                            `${hours}h`
                        ] !=
                        null ||
                        forecasts[
                            `hours${hours}`
                        ] !=
                        null
                    );
                }
            )
            .length;
    }

    function getMemoryUsageRatio() {
        const memory =
            global.performance
                ?.memory;

        if (
            !memory ||
            !Number.isFinite(
                Number(
                    memory
                        .jsHeapSizeLimit
                )
            ) ||
            Number(
                memory
                    .jsHeapSizeLimit
            ) <=
            0
        ) {
            return null;
        }

        return clamp(
            toFiniteNumber(
                memory.usedJSHeapSize,
                0
            ) /
            toFiniteNumber(
                memory.jsHeapSizeLimit,
                1
            ),
            0,
            1
        );
    }

    /* ======================================================================
       SECTION 22
       CORE HEALTH CHECK
       ====================================================================== */

    MonitoringClass.prototype.checkCoreHealth =
        function checkCoreHealth() {
            const startedAt =
                Date.now();

            const anomalies = [];

            const coreExists =
                Boolean(
                    this.core
                );

            const stateExists =
                Boolean(
                    this.core?.state &&
                    typeof this.core.state ===
                    "object"
                );

            const destroyed =
                this.core?.destroyed ===
                true ||
                this.core?.state
                    ?.destroyed ===
                true;

            const running =
                this.core?.running ===
                true ||
                this.core?.state
                    ?.running ===
                true ||
                this.core?.state
                    ?.status ===
                "running";

            let score = 1;

            if (!coreExists) {
                score = 0;

                anomalies.push({
                    type:
                        "core_missing",

                    severity:
                        ANOMALY_SEVERITY
                            .CRITICAL,

                    message:
                        "Recovery core instance is unavailable."
                });
            }

            if (
                coreExists &&
                !stateExists
            ) {
                score -= 0.45;

                anomalies.push({
                    type:
                        "core_state_missing",

                    severity:
                        ANOMALY_SEVERITY
                            .HIGH,

                    message:
                        "Recovery core state is unavailable."
                });
            }

            if (destroyed) {
                score = 0;

                anomalies.push({
                    type:
                        "core_destroyed",

                    severity:
                        ANOMALY_SEVERITY
                            .CRITICAL,

                    message:
                        "Recovery core has been destroyed."
                });
            }

            if (
                stateExists &&
                !running
            ) {
                score -= 0.20;

                anomalies.push({
                    type:
                        "core_not_running",

                    severity:
                        ANOMALY_SEVERITY
                            .MEDIUM,

                    message:
                        "Recovery core is not currently running."
                });
            }

            return createCheckResult(
                MONITORING_CHECK_TYPE.CORE,
                {
                    score,

                    weight:
                        getCheckWeight(
                            MONITORING_CHECK_TYPE
                                .CORE
                        ),

                    details: {
                        coreExists,
                        stateExists,
                        destroyed,
                        running,
                        coreStatus:
                            this.core?.state
                                ?.status ||
                            null
                    },

                    anomalies,

                    durationMs:
                        Date.now() -
                        startedAt
                }
            );
        };

    /* ======================================================================
       SECTION 23
       FORECAST HEALTH CHECK
       ====================================================================== */

    MonitoringClass.prototype.checkForecastHealth =
        function checkForecastHealth() {
            const startedAt =
                Date.now();

            const anomalies = [];

            const forecasts =
                safeArray(
                    this.core.state
                        ?.forecasts
                );

            const horizonForecasts =
                safeObject(
                    this.core.state
                        ?.horizonForecasts
                );

            const horizonCount =
                countAvailableHorizons(
                    horizonForecasts
                );

            const latestTimestamp =
                Math.max(
                    findLatestTimestamp(
                        forecasts
                    ),
                    normalizeTimestamp(
                        this.core.state
                            ?.lastForecastAt
                    ),
                    normalizeTimestamp(
                        this.core.state
                            ?.forecastGeneratedAt
                    )
                );

            const freshnessScore =
                calculateFreshnessScore(
                    latestTimestamp,
                    DEFAULT_FORECAST_FRESHNESS_MS
                );

            const horizonScore =
                calculateRatio(
                    horizonCount,
                    DEFAULT_REQUIRED_HORIZONS
                        .length
                );

            const dataScore =
                forecasts.length >
                0 ||
                horizonCount >
                0
                    ? 1
                    : 0;

            const score =
                clamp(
                    (
                        dataScore *
                        0.35
                    ) +
                    (
                        horizonScore *
                        0.40
                    ) +
                    (
                        freshnessScore *
                        0.25
                    ),
                    0,
                    1
                );

            if (
                dataScore ===
                0
            ) {
                anomalies.push({
                    type:
                        "forecast_data_missing",

                    severity:
                        ANOMALY_SEVERITY
                            .HIGH,

                    message:
                        "No forecast data is available after recovery."
                });
            }

            if (
                horizonCount <
                DEFAULT_REQUIRED_HORIZONS
                    .length
            ) {
                anomalies.push({
                    type:
                        "forecast_horizons_incomplete",

                    severity:
                        horizonCount ===
                        0
                            ? ANOMALY_SEVERITY
                                .HIGH
                            : ANOMALY_SEVERITY
                                .MEDIUM,

                    message:
                        "One or more forecast horizons are unavailable.",

                    metadata: {
                        available:
                            horizonCount,

                        required:
                            DEFAULT_REQUIRED_HORIZONS
                    }
                });
            }

            if (
                freshnessScore <
                0.50
            ) {
                anomalies.push({
                    type:
                        "forecast_data_stale",

                    severity:
                        ANOMALY_SEVERITY
                            .MEDIUM,

                    message:
                        "Forecast data appears stale."
                });
            }

            return createCheckResult(
                MONITORING_CHECK_TYPE
                    .FORECAST,
                {
                    score,

                    weight:
                        getCheckWeight(
                            MONITORING_CHECK_TYPE
                                .FORECAST
                        ),

                    details: {
                        forecastCount:
                            forecasts.length,

                        horizonCount,

                        requiredHorizons:
                            DEFAULT_REQUIRED_HORIZONS,

                        latestTimestamp,

                        freshnessScore
                    },

                    anomalies,

                    durationMs:
                        Date.now() -
                        startedAt
                }
            );
        };

    /* ======================================================================
       SECTION 24
       ARRIVAL PREDICTION HEALTH CHECK
       ====================================================================== */

    MonitoringClass.prototype.checkArrivalHealth =
        function checkArrivalHealth() {
            const startedAt =
                Date.now();

            const anomalies = [];

            const predictions =
                safeArray(
                    this.core.state
                        ?.arrivalPredictions
                );

            const validPredictions =
                predictions.filter(
                    (prediction) => {
                        const hasLocation =
                            Boolean(
                                prediction
                                    ?.locationId ||
                                prediction
                                    ?.locationName ||
                                prediction
                                    ?.city ||
                                prediction
                                    ?.name
                            );

                        const confidence =
                            prediction
                                ?.confidence;

                        const validConfidence =
                            confidence ==
                            null ||
                            Number.isFinite(
                                Number(
                                    confidence
                                )
                            );

                        const eta =
                            prediction
                                ?.etaMinutes ??
                            prediction
                                ?.etaHours;

                        const validEta =
                            eta ==
                            null ||
                            Number.isFinite(
                                Number(
                                    eta
                                )
                            );

                        return (
                            hasLocation &&
                            validConfidence &&
                            validEta
                        );
                    }
                );

            const validRatio =
                predictions.length >
                0
                    ? calculateRatio(
                        validPredictions.length,
                        predictions.length
                    )
                    : 0;

            const latestTimestamp =
                findLatestTimestamp(
                    predictions
                );

            const freshnessScore =
                predictions.length
                    ? calculateFreshnessScore(
                        latestTimestamp,
                        DEFAULT_FORECAST_FRESHNESS_MS
                    )
                    : 0;

            const score =
                predictions.length
                    ? clamp(
                        (
                            validRatio *
                            0.70
                        ) +
                        (
                            freshnessScore *
                            0.30
                        ),
                        0,
                        1
                    )
                    : 0;

            if (
                predictions.length ===
                0
            ) {
                anomalies.push({
                    type:
                        "arrival_predictions_missing",

                    severity:
                        ANOMALY_SEVERITY
                            .HIGH,

                    message:
                        "No rain arrival predictions are available."
                });
            }

            if (
                validRatio <
                0.80 &&
                predictions.length >
                0
            ) {
                anomalies.push({
                    type:
                        "invalid_arrival_predictions",

                    severity:
                        ANOMALY_SEVERITY
                            .HIGH,

                    message:
                        "A significant number of arrival predictions are invalid.",

                    metadata: {
                        total:
                            predictions.length,

                        valid:
                            validPredictions
                                .length
                    }
                });
            }

            return createCheckResult(
                MONITORING_CHECK_TYPE
                    .ARRIVAL,
                {
                    score,

                    weight:
                        getCheckWeight(
                            MONITORING_CHECK_TYPE
                                .ARRIVAL
                        ),

                    details: {
                        totalPredictions:
                            predictions.length,

                        validPredictions:
                            validPredictions
                                .length,

                        validRatio,

                        freshnessScore,

                        latestTimestamp
                    },

                    anomalies,

                    durationMs:
                        Date.now() -
                        startedAt
                }
            );
        };

    /* ======================================================================
       SECTION 25
       RAIN CELL HEALTH CHECK
       ====================================================================== */

    MonitoringClass.prototype.checkRainCellHealth =
        function checkRainCellHealth() {
            const startedAt =
                Date.now();

            const anomalies = [];

            const mapCells =
                Array.from(
                    this.core.cells
                        ?.values?.() ||
                    []
                );

            const stateCells =
                safeArray(
                    this.core.state
                        ?.rainCells
                );

            const cells =
                mapCells.length
                    ? mapCells
                    : stateCells;

            const validCells =
                cells.filter(
                    (cell) => {
                        const latitude =
                            Number(
                                cell
                                    ?.latitude ??
                                cell?.lat
                            );

                        const longitude =
                            Number(
                                cell
                                    ?.longitude ??
                                cell?.lon ??
                                cell?.lng
                            );

                        return (
                            Boolean(
                                cell?.id ||
                                cell?.trackingId
                            ) &&
                            Number.isFinite(
                                latitude
                            ) &&
                            Number.isFinite(
                                longitude
                            ) &&
                            latitude >= -90 &&
                            latitude <= 90 &&
                            longitude >= -180 &&
                            longitude <= 180
                        );
                    }
                );

            const validRatio =
                cells.length
                    ? calculateRatio(
                        validCells.length,
                        cells.length
                    )
                    : 1;

            const score =
                clamp(
                    validRatio,
                    0,
                    1
                );

            if (
                cells.length &&
                validRatio <
                0.85
            ) {
                anomalies.push({
                    type:
                        "invalid_rain_cells",

                    severity:
                        ANOMALY_SEVERITY
                            .HIGH,

                    message:
                        "Invalid rain cells were detected after recovery.",

                    metadata: {
                        total:
                            cells.length,

                        valid:
                            validCells.length
                    }
                });
            }

            return createCheckResult(
                MONITORING_CHECK_TYPE
                    .RAIN_CELLS,
                {
                    score,

                    weight:
                        getCheckWeight(
                            MONITORING_CHECK_TYPE
                                .RAIN_CELLS
                        ),

                    details: {
                        totalCells:
                            cells.length,

                        validCells:
                            validCells.length,

                        validRatio,

                        source:
                            mapCells.length
                                ? "core_cells_map"
                                : "core_state"
                    },

                    anomalies,

                    durationMs:
                        Date.now() -
                        startedAt
                }
            );
        };

    /* ======================================================================
       SECTION 26
       SOURCE HEALTH CHECK
       ====================================================================== */

    MonitoringClass.prototype.checkSourceHealth =
        function checkSourceHealth() {
            const startedAt =
                Date.now();

            const anomalies = [];

            const sources =
                safeArray(
                    this.core.state
                        ?.sources ||
                    this.core.state
                        ?.sourceStatus ||
                    this.core.sources
                );

            const normalizedSources =
                sources.length
                    ? sources
                    : Object.values(
                        safeObject(
                            this.core.state
                                ?.sourceHealth
                        )
                    );

            const healthySources =
                normalizedSources
                    .filter(
                        (source) => {
                            const status =
                                String(
                                    source?.status ||
                                    source?.health ||
                                    ""
                                )
                                    .toLowerCase();

                            return (
                                source?.healthy ===
                                true ||
                                [
                                    "healthy",
                                    "active",
                                    "available",
                                    "online",
                                    "ok"
                                ].includes(
                                    status
                                )
                            );
                        }
                    );

            const freshnessScores =
                normalizedSources
                    .map(
                        (source) => {
                            return calculateFreshnessScore(
                                source?.updatedAt ||
                                source?.lastSuccessAt ||
                                source?.timestamp,
                                DEFAULT_SOURCE_FRESHNESS_MS
                            );
                        }
                    );

            const availabilityScore =
                normalizedSources.length
                    ? calculateRatio(
                        healthySources.length,
                        normalizedSources.length
                    )
                    : 0;

            const freshnessScore =
                normalizedSources.length
                    ? calculateAverage(
                        freshnessScores
                    )
                    : 0;

            const countScore =
                normalizedSources.length >=
                DEFAULT_MIN_SOURCE_COUNT
                    ? 1
                    : 0;

            const score =
                clamp(
                    (
                        availabilityScore *
                        0.55
                    ) +
                    (
                        freshnessScore *
                        0.30
                    ) +
                    (
                        countScore *
                        0.15
                    ),
                    0,
                    1
                );

            if (
                normalizedSources.length ===
                0
            ) {
                anomalies.push({
                    type:
                        "sources_missing",

                    severity:
                        ANOMALY_SEVERITY
                            .HIGH,

                    message:
                        "No active data sources were found."
                });
            }

            if (
                normalizedSources.length &&
                healthySources.length ===
                0
            ) {
                anomalies.push({
                    type:
                        "all_sources_unhealthy",

                    severity:
                        ANOMALY_SEVERITY
                            .CRITICAL,

                    message:
                        "All forecast data sources are unhealthy."
                });
            }

            return createCheckResult(
                MONITORING_CHECK_TYPE
                    .SOURCES,
                {
                    score,

                    weight:
                        getCheckWeight(
                            MONITORING_CHECK_TYPE
                                .SOURCES
                        ),

                    details: {
                        sourceCount:
                            normalizedSources
                                .length,

                        healthySourceCount:
                            healthySources
                                .length,

                        availabilityScore,

                        freshnessScore
                    },

                    anomalies,

                    durationMs:
                        Date.now() -
                        startedAt
                }
            );
        };

    /* ======================================================================
       SECTION 27
       DASHBOARD HEALTH CHECK
       ====================================================================== */

    MonitoringClass.prototype.checkDashboardHealth =
        function checkDashboardHealth() {
            const startedAt =
                Date.now();

            const anomalies = [];

            const dashboard =
                this.core.state
                    ?.nationalArrivalDashboard;

            const regions =
                safeArray(
                    this.core.state
                        ?.regionSummaries
                );

            const governorates =
                safeArray(
                    this.core.state
                        ?.governorateSummaries
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

            const geographicDataExists =
                regions.length >
                0 ||
                governorates.length >
                0;

            const score =
                clamp(
                    (
                        (
                            dashboardExists
                                ? 0.50
                                : 0
                        )
                    ) +
                    (
                        summaryExists
                            ? 0.25
                            : 0
                    ) +
                    (
                        geographicDataExists
                            ? 0.25
                            : 0
                    ),
                    0,
                    1
                );

            if (
                !dashboardExists
            ) {
                anomalies.push({
                    type:
                        "dashboard_missing",

                    severity:
                        ANOMALY_SEVERITY
                            .HIGH,

                    message:
                        "National arrival dashboard is unavailable."
                });
            }

            if (
                dashboardExists &&
                !summaryExists
            ) {
                anomalies.push({
                    type:
                        "dashboard_summary_missing",

                    severity:
                        ANOMALY_SEVERITY
                            .MEDIUM,

                    message:
                        "National dashboard summary is missing."
                });
            }

            return createCheckResult(
                MONITORING_CHECK_TYPE
                    .DASHBOARD,
                {
                    score,

                    weight:
                        getCheckWeight(
                            MONITORING_CHECK_TYPE
                                .DASHBOARD
                        ),

                    details: {
                        dashboardExists,
                        summaryExists,
                        regionCount:
                            regions.length,
                        governorateCount:
                            governorates.length
                    },

                    anomalies,

                    durationMs:
                        Date.now() -
                        startedAt
                }
            );
        };

    /* ======================================================================
       SECTION 28
       FRONTEND HEALTH CHECK
       ====================================================================== */

    MonitoringClass.prototype.checkFrontendHealth =
        function checkFrontendHealth() {
            const startedAt =
                Date.now();

            const anomalies = [];

            const payload =
                this.core.state
                    ?.frontendPayload;

            const payloadExists =
                Boolean(
                    payload &&
                    typeof payload ===
                    "object"
                );

            const hasPredictions =
                safeArray(
                    payload?.arrivalPredictions ||
                    payload?.predictions
                ).length >
                0;

            const hasDashboard =
                Boolean(
                    payload
                        ?.nationalArrivalDashboard ||
                    payload?.dashboard
                );

            const score =
                clamp(
                    (
                        payloadExists
                            ? 0.50
                            : 0
                    ) +
                    (
                        hasPredictions
                            ? 0.30
                            : 0
                    ) +
                    (
                        hasDashboard
                            ? 0.20
                            : 0
                    ),
                    0,
                    1
                );

            if (
                !payloadExists
            ) {
                anomalies.push({
                    type:
                        "frontend_payload_missing",

                    severity:
                        ANOMALY_SEVERITY
                            .HIGH,

                    message:
                        "Frontend payload is unavailable after recovery."
                });
            }

            return createCheckResult(
                MONITORING_CHECK_TYPE
                    .FRONTEND,
                {
                    score,

                    weight:
                        getCheckWeight(
                            MONITORING_CHECK_TYPE
                                .FRONTEND
                        ),

                    details: {
                        payloadExists,
                        hasPredictions,
                        hasDashboard
                    },

                    anomalies,

                    durationMs:
                        Date.now() -
                        startedAt
                }
            );
        };

    /* ======================================================================
       SECTION 29
       RECOVERY HEALTH CHECK
       ====================================================================== */

    MonitoringClass.prototype.checkRecoveryHealth =
        function checkRecoveryHealth() {
            const startedAt =
                Date.now();

            const anomalies = [];

            const recoveryState =
                safeObject(
                    this.core.state
                        ?.recovery
                );

            const status =
                String(
                    recoveryState.status ||
                    this.core.recoveryStatus ||
                    ""
                )
                    .toLowerCase();

            const active =
                recoveryState.active ===
                true ||
                [
                    "recovering",
                    "active",
                    "running"
                ].includes(status);

            const failed =
                recoveryState.failed ===
                true ||
                [
                    "failed",
                    "error",
                    "critical"
                ].includes(status);

            const completed =
                recoveryState.completed ===
                true ||
                [
                    "completed",
                    "recovered",
                    "stable",
                    "success"
                ].includes(status);

            let score = 0.75;

            if (completed) {
                score = 1;
            } else if (active) {
                score = 0.55;
            } else if (failed) {
                score = 0;
            }

            if (failed) {
                anomalies.push({
                    type:
                        "recovery_failed",

                    severity:
                        ANOMALY_SEVERITY
                            .CRITICAL,

                    message:
                        "Recovery engine reports a failed state."
                });
            }

            if (active) {
                anomalies.push({
                    type:
                        "recovery_still_active",

                    severity:
                        ANOMALY_SEVERITY
                            .LOW,

                    message:
                        "Recovery process is still active."
                });
            }

            return createCheckResult(
                MONITORING_CHECK_TYPE
                    .RECOVERY,
                {
                    score,

                    weight:
                        getCheckWeight(
                            MONITORING_CHECK_TYPE
                                .RECOVERY
                        ),

                    details: {
                        status:
                            status ||
                            null,

                        active,
                        completed,
                        failed
                    },

                    anomalies,

                    durationMs:
                        Date.now() -
                        startedAt
                }
            );
        };

    /* ======================================================================
       SECTION 30
       CLOSURE HEALTH CHECK
       ====================================================================== */

    MonitoringClass.prototype.checkClosureHealth =
        function checkClosureHealth() {
            const startedAt =
                Date.now();

            const anomalies = [];

            const closure =
                this.core
                    .getRecoveryClosure?.() ||
                this.core
                    .recoveryClosure ||
                null;

            if (!closure) {
                return createCheckResult(
                    MONITORING_CHECK_TYPE
                        .CLOSURE,
                    {
                        score:
                            0.70,

                        weight:
                            getCheckWeight(
                                MONITORING_CHECK_TYPE
                                    .CLOSURE
                            ),

                        message:
                            "Recovery closure engine is not attached.",

                        details: {
                            attached:
                                false
                        },

                        durationMs:
                            Date.now() -
                            startedAt
                    }
                );
            }

            const status =
                closure
                    .getStatus?.() ||
                {};

            const active =
                Boolean(
                    status.activeClosure ||
                    closure.state
                        ?.activeClosure
                );

            const failedClosures =
                toFiniteNumber(
                    status.failedClosures,
                    0
                );

            const totalClosures =
                toFiniteNumber(
                    status.totalClosures,
                    0
                );

            const failureRatio =
                totalClosures >
                0
                    ? calculateRatio(
                        failedClosures,
                        totalClosures
                    )
                    : 0;

            const score =
                clamp(
                    (
                        active
                            ? 0.60
                            : 1
                    ) -
                    (
                        failureRatio *
                        0.60
                    ),
                    0,
                    1
                );

            if (
                active
            ) {
                anomalies.push({
                    type:
                        "closure_still_active",

                    severity:
                        ANOMALY_SEVERITY
                            .LOW,

                    message:
                        "Recovery closure is still active."
                });
            }

            if (
                failureRatio >=
                0.50 &&
                totalClosures >=
                2
            ) {
                anomalies.push({
                    type:
                        "closure_failure_rate_high",

                    severity:
                        ANOMALY_SEVERITY
                            .HIGH,

                    message:
                        "Recovery closure failure rate is high."
                });
            }

            return createCheckResult(
                MONITORING_CHECK_TYPE
                    .CLOSURE,
                {
                    score,

                    weight:
                        getCheckWeight(
                            MONITORING_CHECK_TYPE
                                .CLOSURE
                        ),

                    details: {
                        attached:
                            true,

                        active,

                        totalClosures,

                        failedClosures,

                        failureRatio
                    },

                    anomalies,

                    durationMs:
                        Date.now() -
                        startedAt
                }
            );
        };

    /* ======================================================================
       SECTION 31
       REOPENING HEALTH CHECK
       ====================================================================== */

    MonitoringClass.prototype.checkReopeningHealth =
        function checkReopeningHealth() {
            const startedAt =
                Date.now();

            const reopening =
                this.core
                    .getRecoveryReopening?.() ||
                this.core
                    .recoveryReopening ||
                null;

            if (!reopening) {
                return createCheckResult(
                    MONITORING_CHECK_TYPE
                        .REOPENING,
                    {
                        score:
                            0.75,

                        weight:
                            getCheckWeight(
                                MONITORING_CHECK_TYPE
                                    .REOPENING
                            ),

                        message:
                            "Recovery reopening engine is not attached.",

                        details: {
                            attached:
                                false
                        },

                        durationMs:
                            Date.now() -
                            startedAt
                    }
                );
            }

            const status =
                reopening
                    .getStatus?.() ||
                {};

            const failed =
                status.status ===
                "failed" ||
                status.failed ===
                true;

            const active =
                status.status ===
                "running" ||
                status.active ===
                true;

            const score =
                failed
                    ? 0
                    : active
                        ? 0.80
                        : 1;

            return createCheckResult(
                MONITORING_CHECK_TYPE
                    .REOPENING,
                {
                    score,

                    weight:
                        getCheckWeight(
                            MONITORING_CHECK_TYPE
                                .REOPENING
                        ),

                    details: {
                        attached:
                            true,

                        active,

                        failed,

                        status:
                            status.status ||
                            null
                    },

                    anomalies:
                        failed
                            ? [
                                {
                                    type:
                                        "reopening_failed",

                                    severity:
                                        ANOMALY_SEVERITY
                                            .HIGH,

                                    message:
                                        "Recovery reopening engine reports failure."
                                }
                            ]
                            : [],

                    durationMs:
                        Date.now() -
                        startedAt
                }
            );
        };

    /* ======================================================================
       SECTION 32
       MEMORY HEALTH CHECK
       ====================================================================== */

    MonitoringClass.prototype.checkMemoryHealth =
        function checkMemoryHealth() {
            const startedAt =
                Date.now();

            const memoryRatio =
                getMemoryUsageRatio();

            if (
                memoryRatio ===
                null
            ) {
                return createCheckResult(
                    MONITORING_CHECK_TYPE
                        .MEMORY,
                    {
                        score:
                            0.85,

                        weight:
                            getCheckWeight(
                                MONITORING_CHECK_TYPE
                                    .MEMORY
                            ),

                        status:
                            CHECK_RESULT_STATUS
                                .SKIPPED,

                        passed:
                            true,

                        message:
                            "Browser memory metrics are unavailable.",

                        details: {
                            supported:
                                false
                        },

                        durationMs:
                            Date.now() -
                            startedAt
                    }
                );
            }

            const score =
                clamp(
                    1 -
                    memoryRatio,
                    0,
                    1
                );

            const anomalies = [];

            if (
                memoryRatio >=
                DEFAULT_MAX_MEMORY_RATIO
            ) {
                anomalies.push({
                    type:
                        "memory_usage_high",

                    severity:
                        memoryRatio >=
                        0.95
                            ? ANOMALY_SEVERITY
                                .CRITICAL
                            : ANOMALY_SEVERITY
                                .HIGH,

                    message:
                        "JavaScript memory usage is high.",

                    metadata: {
                        ratio:
                            memoryRatio
                    }
                });
            }

            return createCheckResult(
                MONITORING_CHECK_TYPE
                    .MEMORY,
                {
                    score,

                    weight:
                        getCheckWeight(
                            MONITORING_CHECK_TYPE
                                .MEMORY
                        ),

                    details: {
                        supported:
                            true,

                        memoryRatio,

                        usedJSHeapSize:
                            global.performance
                                ?.memory
                                ?.usedJSHeapSize ||
                            null,

                        jsHeapSizeLimit:
                            global.performance
                                ?.memory
                                ?.jsHeapSizeLimit ||
                            null
                    },

                    anomalies,

                    durationMs:
                        Date.now() -
                        startedAt
                }
            );
        };

    /* ======================================================================
       SECTION 33
       PERFORMANCE HEALTH CHECK
       ====================================================================== */

    MonitoringClass.prototype.checkPerformanceHealth =
        function checkPerformanceHealth() {
            const startedAt =
                Date.now();

            const history =
                safeArray(
                    this.state
                        .checkHistory
                )
                    .slice(-10);

            const durations =
                history
                    .map(
                        (check) => {
                            return toFiniteNumber(
                                check.durationMs,
                                0
                            );
                        }
                    )
                    .filter(
                        (duration) => {
                            return duration >
                                0;
                        }
                    );

            const averageDurationMs =
                calculateAverage(
                    durations
                );

            const score =
                durations.length ===
                0
                    ? 1
                    : clamp(
                        1 -
                        (
                            averageDurationMs /
                            DEFAULT_MAX_CHECK_DURATION_MS
                        ),
                        0,
                        1
                    );

            const anomalies = [];

            if (
                averageDurationMs >
                DEFAULT_MAX_CHECK_DURATION_MS
            ) {
                anomalies.push({
                    type:
                        "monitoring_checks_slow",

                    severity:
                        ANOMALY_SEVERITY
                            .MEDIUM,

                    message:
                        "Post recovery monitoring checks are running slowly.",

                    metadata: {
                        averageDurationMs
                    }
                });
            }

            return createCheckResult(
                MONITORING_CHECK_TYPE
                    .PERFORMANCE,
                {
                    score,

                    weight:
                        getCheckWeight(
                            MONITORING_CHECK_TYPE
                                .PERFORMANCE
                        ),

                    details: {
                        sampleCount:
                            durations.length,

                        averageDurationMs
                    },

                    anomalies,

                    durationMs:
                        Date.now() -
                        startedAt
                }
            );
        };

    /* ======================================================================
       SECTION 34
       INTEGRITY HEALTH CHECK
       ====================================================================== */

    MonitoringClass.prototype.checkIntegrityHealth =
        function checkIntegrityHealth() {
            const startedAt =
                Date.now();

            const closure =
                this.core
                    .getRecoveryClosure?.() ||
                this.core
                    .recoveryClosure ||
                null;

            if (
                !closure ||
                typeof closure
                    .runIntegrityValidation !==
                "function"
            ) {
                return createCheckResult(
                    MONITORING_CHECK_TYPE
                        .INTEGRITY,
                    {
                        score:
                            0.80,

                        weight:
                            getCheckWeight(
                                MONITORING_CHECK_TYPE
                                    .INTEGRITY
                            ),

                        status:
                            CHECK_RESULT_STATUS
                                .SKIPPED,

                        passed:
                            true,

                        message:
                            "Closure integrity validation is unavailable.",

                        details: {
                            supported:
                                false
                        },

                        durationMs:
                            Date.now() -
                            startedAt
                    }
                );
            }

            const report =
                closure
                    .runIntegrityValidation();

            const score =
                clamp(
                    toFiniteNumber(
                        report
                            ?.healthScore,
                        0
                    ),
                    0,
                    1
                );

            const anomalies =
                safeArray(
                    report?.failures
                )
                    .map(
                        (failure) => {
                            return {
                                type:
                                    failure,

                                severity:
                                    score <
                                    0.30
                                        ? ANOMALY_SEVERITY
                                            .CRITICAL
                                        : ANOMALY_SEVERITY
                                            .HIGH,

                                message:
                                    `Integrity validation failure: ${failure}`
                            };
                        }
                    );

            return createCheckResult(
                MONITORING_CHECK_TYPE
                    .INTEGRITY,
                {
                    score,

                    weight:
                        getCheckWeight(
                            MONITORING_CHECK_TYPE
                                .INTEGRITY
                        ),

                    details: {
                        supported:
                            true,

                        report:
                            deepClone(
                                report
                            )
                    },

                    anomalies,

                    durationMs:
                        Date.now() -
                        startedAt
                }
            );
        };

    /* ======================================================================
       SECTION 35
       CHECK RESOLVER
       ====================================================================== */

    MonitoringClass.prototype.resolveCheckHandler =
        function resolveCheckHandler(
            checkType
        ) {
            switch (checkType) {
                case MONITORING_CHECK_TYPE.CORE:
                    return this
                        .checkCoreHealth
                        .bind(this);

                case MONITORING_CHECK_TYPE.FORECAST:
                    return this
                        .checkForecastHealth
                        .bind(this);

                case MONITORING_CHECK_TYPE.ARRIVAL:
                    return this
                        .checkArrivalHealth
                        .bind(this);

                case MONITORING_CHECK_TYPE.RAIN_CELLS:
                    return this
                        .checkRainCellHealth
                        .bind(this);

                case MONITORING_CHECK_TYPE.SOURCES:
                    return this
                        .checkSourceHealth
                        .bind(this);

                case MONITORING_CHECK_TYPE.DASHBOARD:
                    return this
                        .checkDashboardHealth
                        .bind(this);

                case MONITORING_CHECK_TYPE.FRONTEND:
                    return this
                        .checkFrontendHealth
                        .bind(this);

                case MONITORING_CHECK_TYPE.RECOVERY:
                    return this
                        .checkRecoveryHealth
                        .bind(this);

                case MONITORING_CHECK_TYPE.CLOSURE:
                    return this
                        .checkClosureHealth
                        .bind(this);

                case MONITORING_CHECK_TYPE.REOPENING:
                    return this
                        .checkReopeningHealth
                        .bind(this);

                case MONITORING_CHECK_TYPE.MEMORY:
                    return this
                        .checkMemoryHealth
                        .bind(this);

                case MONITORING_CHECK_TYPE.PERFORMANCE:
                    return this
                        .checkPerformanceHealth
                        .bind(this);

                case MONITORING_CHECK_TYPE.INTEGRITY:
                    return this
                        .checkIntegrityHealth
                        .bind(this);

                default:
                    return null;
            }
        };

    /* ======================================================================
       SECTION 36
       ENABLED CHECK LIST
       ====================================================================== */

    MonitoringClass.prototype.getEnabledCheckTypes =
        function getEnabledCheckTypes() {
            const checks =
                safeObject(
                    this.configuration
                        .checks
                );

            const mapping = [
                [
                    "core",
                    MONITORING_CHECK_TYPE.CORE
                ],
                [
                    "forecast",
                    MONITORING_CHECK_TYPE.FORECAST
                ],
                [
                    "arrival",
                    MONITORING_CHECK_TYPE.ARRIVAL
                ],
                [
                    "rainCells",
                    MONITORING_CHECK_TYPE.RAIN_CELLS
                ],
                [
                    "sources",
                    MONITORING_CHECK_TYPE.SOURCES
                ],
                [
                    "dashboard",
                    MONITORING_CHECK_TYPE.DASHBOARD
                ],
                [
                    "frontend",
                    MONITORING_CHECK_TYPE.FRONTEND
                ],
                [
                    "recovery",
                    MONITORING_CHECK_TYPE.RECOVERY
                ],
                [
                    "closure",
                    MONITORING_CHECK_TYPE.CLOSURE
                ],
                [
                    "reopening",
                    MONITORING_CHECK_TYPE.REOPENING
                ],
                [
                    "memory",
                    MONITORING_CHECK_TYPE.MEMORY
                ],
                [
                    "performance",
                    MONITORING_CHECK_TYPE.PERFORMANCE
                ],
                [
                    "integrity",
                    MONITORING_CHECK_TYPE.INTEGRITY
                ]
            ];

            return mapping
                .filter(
                    ([key]) => {
                        return checks[key] !==
                            false;
                    }
                )
                .map(
                    (
                        [
                            key,
                            type
                        ]
                    ) => {
                        return type;
                    }
                );
        };

    /* ======================================================================
       SECTION 37
       EXECUTE SINGLE CHECK
       ====================================================================== */

    MonitoringClass.prototype.executeSingleCheck =
        async function executeSingleCheck(
            checkType,
            options = {}
        ) {
            const handler =
                this.resolveCheckHandler(
                    checkType
                );

            if (!handler) {
                return createCheckResult(
                    checkType,
                    {
                        score:
                            0,

                        status:
                            CHECK_RESULT_STATUS
                                .SKIPPED,

                        passed:
                            false,

                        message:
                            "Monitoring check handler is unavailable.",

                        details: {
                            checkType
                        }
                    }
                );
            }

            const startedAt =
                Date.now();

            try {
                const result =
                    await withTimeout(
                        Promise.resolve(
                            handler(
                                options
                            )
                        ),
                        toFiniteNumber(
                            options.timeoutMs,
                            this.configuration
                                .checkTimeoutMs ||
                            DEFAULT_CHECK_TIMEOUT_MS
                        ),
                        `Monitoring check timed out: ${checkType}`
                    );

                return {
                    ...createCheckResult(
                        checkType,
                        result
                    ),

                    durationMs:
                        Math.max(
                            toFiniteNumber(
                                result?.durationMs,
                                0
                            ),
                            Date.now() -
                            startedAt
                        )
                };
            } catch (error) {
                const normalized =
                    normalizeMonitoringError(
                        error
                    );

                return createCheckResult(
                    checkType,
                    {
                        score:
                            0,

                        status:
                            normalized.code ===
                            "MONITORING_CHECK_TIMEOUT"
                                ? CHECK_RESULT_STATUS
                                    .TIMEOUT
                                : CHECK_RESULT_STATUS
                                    .FAILED,

                        passed:
                            false,

                        message:
                            normalized.message,

                        details: {
                            error:
                                normalized
                        },

                        anomalies: [
                            {
                                type:
                                    "monitoring_check_failed",

                                severity:
                                    ANOMALY_SEVERITY
                                        .HIGH,

                                message:
                                    normalized.message,

                                metadata: {
                                    checkType,
                                    error:
                                        normalized
                                }
                            }
                        ],

                        durationMs:
                            Date.now() -
                            startedAt
                    }
                );
            }
        };

    /* ======================================================================
       SECTION 38
       CALCULATE COMBINED HEALTH SCORE
       ====================================================================== */

    MonitoringClass.prototype.calculateCombinedHealthScore =
        function calculateCombinedHealthScore(
            results
        ) {
            const validResults =
                safeArray(results)
                    .filter(
                        (result) => {
                            return (
                                result &&
                                result.status !==
                                CHECK_RESULT_STATUS
                                    .SKIPPED
                            );
                        }
                    );

            if (
                validResults.length ===
                0
            ) {
                return 0;
            }

            const totalWeight =
                validResults.reduce(
                    (
                        total,
                        result
                    ) => {
                        return (
                            total +
                            toFiniteNumber(
                                result.weight,
                                0
                            )
                        );
                    },
                    0
                );

            if (
                totalWeight <=
                0
            ) {
                return calculateAverage(
                    validResults.map(
                        (result) => {
                            return result.score;
                        }
                    )
                );
            }

            const weightedScore =
                validResults.reduce(
                    (
                        total,
                        result
                    ) => {
                        return (
                            total +
                            (
                                clamp(
                                    result.score,
                                    0,
                                    1
                                ) *
                                toFiniteNumber(
                                    result.weight,
                                    0
                                )
                            )
                        );
                    },
                    0
                );

            return clamp(
                weightedScore /
                totalWeight,
                0,
                1
            );
        };

    /* ======================================================================
       SECTION 39
       REGISTER RESULT ANOMALIES
       ====================================================================== */

    MonitoringClass.prototype.registerResultAnomalies =
        function registerResultAnomalies(
            results
        ) {
            const created = [];

            safeArray(results)
                .forEach(
                    (result) => {
                        safeArray(
                            result.anomalies
                        )
                            .forEach(
                                (anomaly) => {
                                    created.push(
                                        this.createAnomaly(
                                            anomaly.type ||
                                            result.type,
                                            anomaly.severity ||
                                            ANOMALY_SEVERITY
                                                .MEDIUM,
                                            anomaly.message ||
                                            "Monitoring anomaly detected.",
                                            {
                                                checkType:
                                                    result.type,

                                                checkScore:
                                                    result.score,

                                                ...safeObject(
                                                    anomaly.metadata
                                                )
                                            }
                                        )
                                    );
                                }
                            );
                    }
                );

            return created;
        };

    /* ======================================================================
       SECTION 40
       EXECUTE COMPLETE MONITORING CHECK
       ====================================================================== */

    MonitoringClass.prototype.runMonitoringCheck =
        async function runMonitoringCheck(
            options = {}
        ) {
            if (this.destroyed) {
                throw createMonitoringError(
                    "Post recovery monitoring has been destroyed.",
                    "MONITORING_DESTROYED"
                );
            }

            if (
                this.state
                    .checkInProgress
            ) {
                this.state
                    .skippedChecks +=
                    1;

                return {
                    executed:
                        false,

                    skipped:
                        true,

                    reason:
                        "check_already_in_progress"
                };
            }

            const safeOptions =
                safeObject(options);

            const check = {
                id:
                    createCheckId(),

                type:
                    MONITORING_CHECK_TYPE
                        .COMPLETE,

                status:
                    "running",

                startedAt:
                    Date.now(),

                completedAt:
                    null,

                durationMs:
                    0,

                healthScore:
                    0,

                healthStatus:
                    RECOVERY_HEALTH_STATUS
                        .UNKNOWN,

                results: [],

                anomalies: [],

                error:
                    null,

                metadata:
                    deepClone(
                        safeObject(
                            safeOptions.metadata
                        )
                    )
            };

            this.state
                .checkInProgress =
                true;

            this.state.currentCheck =
                check;

            this.emit(
                MONITORING_EVENT
                    .CHECK_STARTED,
                {
                    check:
                        deepClone(
                            check
                        )
                }
            );

            try {
                const checkTypes =
                    safeOptions.checkTypes
                        ? safeArray(
                            safeOptions.checkTypes
                        )
                        : this
                            .getEnabledCheckTypes();

                const results = [];

                for (
                    const checkType of
                    checkTypes
                ) {
                    const result =
                        await this
                            .executeSingleCheck(
                                checkType,
                                safeOptions
                            );

                    results.push(
                        result
                    );
                }

                const healthScore =
                    this.calculateCombinedHealthScore(
                        results
                    );

                const healthStatus =
                    classifyRecoveryHealth(
                        healthScore
                    );

                const anomalies =
                    this.registerResultAnomalies(
                        results
                    );

                const failedResults =
                    results.filter(
                        (result) => {
                            return [
                                CHECK_RESULT_STATUS
                                    .FAILED,

                                CHECK_RESULT_STATUS
                                    .TIMEOUT
                            ].includes(
                                result.status
                            );
                        }
                    );

                check.status =
                    failedResults.length >
                    0
                        ? CHECK_RESULT_STATUS
                            .WARNING
                        : CHECK_RESULT_STATUS
                            .PASSED;

                check.results =
                    deepClone(
                        results
                    );

                check.healthScore =
                    healthScore;

                check.healthStatus =
                    healthStatus;

                check.anomalies =
                    deepClone(
                        anomalies
                    );

                check.completedAt =
                    Date.now();

                check.durationMs =
                    check.completedAt -
                    check.startedAt;

                this.state.lastCheckAt =
                    check.completedAt;

                this.state.lastCheck =
                    deepClone(
                        check
                    );

                this.state.totalChecks +=
                    1;

                if (
                    failedResults.length ===
                    0
                ) {
                    this.state
                        .successfulChecks +=
                        1;

                    this.state
                        .consecutiveSuccessfulChecks +=
                        1;

                    this.state
                        .consecutiveFailedChecks =
                        0;

                    this.state
                        .lastSuccessfulCheckAt =
                        check.completedAt;
                } else {
                    this.state.failedChecks +=
                        1;

                    this.state
                        .consecutiveFailedChecks +=
                        1;

                    this.state
                        .consecutiveSuccessfulChecks =
                        0;

                    this.state
                        .lastFailedCheckAt =
                        check.completedAt;
                }

                this.state
                    .checkHistory
                    .push(
                        deepClone(
                            check
                        )
                    );

                this.state.checkHistory =
                    this.state
                        .checkHistory
                        .slice(
                            -Math.max(
                                20,
                                toFiniteNumber(
                                    this.configuration
                                        .maximumHistory,
                                    DEFAULT_MAX_HISTORY
                                )
                            )
                        );

                this.updateHealthState(
                    healthScore,
                    {
                        checkId:
                            check.id,

                        failedCheckCount:
                            failedResults.length
                    }
                );

                this.emit(
                    MONITORING_EVENT
                        .CHECK_COMPLETED,
                    {
                        check:
                            deepClone(
                                check
                            )
                    }
                );

                return {
                    executed:
                        true,

                    check:
                        deepClone(
                            check
                        )
                };
            } catch (error) {
                const normalized =
                    normalizeMonitoringError(
                        error
                    );

                check.status =
                    CHECK_RESULT_STATUS
                        .FAILED;

                check.error =
                    normalized;

                check.completedAt =
                    Date.now();

                check.durationMs =
                    check.completedAt -
                    check.startedAt;

                this.state.totalChecks +=
                    1;

                this.state.failedChecks +=
                    1;

                this.state
                    .consecutiveFailedChecks +=
                    1;

                this.state
                    .consecutiveSuccessfulChecks =
                    0;

                this.state.lastCheckAt =
                    check.completedAt;

                this.state
                    .lastFailedCheckAt =
                    check.completedAt;

                this.state.lastCheck =
                    deepClone(
                        check
                    );

                this.state.lastError =
                    normalized;

                this.state
                    .checkHistory
                    .push(
                        deepClone(
                            check
                        )
                    );

                this.emit(
                    MONITORING_EVENT
                        .CHECK_FAILED,
                    {
                        check:
                            deepClone(
                                check
                            ),

                        error:
                            normalized
                    }
                );

                return {
                    executed:
                        false,

                    check:
                        deepClone(
                            check
                        ),

                    error:
                        normalized
                };
            } finally {
                this.state
                    .checkInProgress =
                    false;

                this.state.currentCheck =
                    null;

                this.synchronizeCoreState();
            }
        };

    /* ======================================================================
       SECTION 41
       CHECK HISTORY
       ====================================================================== */

    MonitoringClass.prototype.getCheckHistory =
        function getCheckHistory(
            limit = 20
        ) {
            const safeLimit =
                Math.max(
                    1,
                    Math.min(
                        this.configuration
                            .maximumHistory,
                        Math.round(
                            toFiniteNumber(
                                limit,
                                20
                            )
                        )
                    )
                );

            return deepClone(
                this.state
                    .checkHistory
                    .slice(
                        -safeLimit
                    )
                    .reverse()
            );
        };

    /* ======================================================================
       SECTION 42
       LATEST CHECK RESULT
       ====================================================================== */

    MonitoringClass.prototype.getLatestCheck =
        function getLatestCheck() {
            return this.state
                .lastCheck
                ? deepClone(
                    this.state.lastCheck
                )
                : null;
        };

    /* ======================================================================
       SECTION 43
       API EXTENSIONS
       ====================================================================== */

    const MonitoringApi =
        global
            .PostRecoveryMonitoringV32API ||
        global
            .RainArrivalPostRecoveryMonitoringV32API ||
        global
            .RainGuardPostRecoveryMonitoringV32API;

    if (MonitoringApi) {
        MonitoringApi.runCheck =
            function runCheck(
                options = {}
            ) {
                return this
                    .requireInstance()
                    .runMonitoringCheck(
                        options
                    );
            };

        MonitoringApi.runSingleCheck =
            function runSingleCheck(
                checkType,
                options = {}
            ) {
                return this
                    .requireInstance()
                    .executeSingleCheck(
                        checkType,
                        options
                    );
            };

        MonitoringApi.getCheckHistory =
            function getCheckHistory(
                limit = 20
            ) {
                return this
                    .requireInstance()
                    .getCheckHistory(
                        limit
                    );
            };

        MonitoringApi.getLatestCheck =
            function getLatestCheck() {
                return this
                    .requireInstance()
                    .getLatestCheck();
            };
    }

    /* ======================================================================
       SECTION 44
       COMPATIBILITY ALIASES
       ====================================================================== */

    MonitoringClass.prototype.runCheck =
        MonitoringClass.prototype
            .runMonitoringCheck;

    MonitoringClass.prototype.checkNow =
        MonitoringClass.prototype
            .runMonitoringCheck;

    MonitoringClass.prototype.runFullCheck =
        MonitoringClass.prototype
            .runMonitoringCheck;

    MonitoringClass.prototype.getHistory =
        MonitoringClass.prototype
            .getCheckHistory;

    /* ======================================================================
       SECTION 45
       PART 2 EXPORT
       ====================================================================== */

    global.PostRecoveryMonitoringV32Part2 = {
        CHECK_RESULT_STATUS,
        CHECK_WEIGHT,
        DEFAULT_SOURCE_FRESHNESS_MS,
        DEFAULT_FORECAST_FRESHNESS_MS,
        DEFAULT_MAX_MEMORY_RATIO,
        DEFAULT_MAX_CHECK_DURATION_MS,
        DEFAULT_MIN_SOURCE_COUNT,
        DEFAULT_REQUIRED_HORIZONS,
        createCheckResult,
        classifyCheckStatus,
        getCheckWeight,
        normalizeTimestamp,
        calculateFreshnessScore,
        findLatestTimestamp,
        countAvailableHorizons,
        getMemoryUsageRatio
    };

})(window);

/* ==========================================================================
   RainGuard AI
   Long Horizon Forecast Engine V32

   Post Recovery Monitoring Engine V32

   PART 3
   Lifecycle Control + Automatic Scheduling + Stability Evaluation +
   Recovery Escalation + Reopening Recommendation
   ========================================================================== */

(function extendPostRecoveryMonitoringV32Part3(global) {
    "use strict";

    /* ======================================================================
       SECTION 46
       DEPENDENCY RESOLUTION
       ====================================================================== */

    const MonitoringClass =
        global.PostRecoveryMonitoringV32;

    const MonitoringConstants =
        global.PostRecoveryMonitoringV32Constants;

    const MonitoringUtils =
        global.PostRecoveryMonitoringV32Utils;

    const MonitoringPart2 =
        global.PostRecoveryMonitoringV32Part2;

    if (
        typeof MonitoringClass !==
        "function" ||
        !MonitoringConstants ||
        !MonitoringUtils ||
        !MonitoringPart2
    ) {
        throw new Error(
            "PostRecoveryMonitoringV32 Parts 1 and 2 must be loaded before Part 3."
        );
    }

    const {
        MONITORING_STATUS,
        RECOVERY_HEALTH_STATUS,
        MONITORING_EVENT,
        ANOMALY_SEVERITY,
        DEFAULT_MONITORING_INTERVAL_MS,
        DEFAULT_INITIAL_DELAY_MS,
        DEFAULT_STABILITY_WINDOW_MS,
        DEFAULT_MIN_STABLE_CHECKS,
        DEFAULT_MAX_CONSECUTIVE_FAILURES,
        DEFAULT_REOPENING_SCORE
    } = MonitoringConstants;

    const {
        toFiniteNumber,
        clamp,
        safeObject,
        safeArray,
        deepClone,
        createMonitoringError,
        normalizeMonitoringError,
        calculateAverage,
        sleep
    } = MonitoringUtils;

    const {
        CHECK_RESULT_STATUS
    } = MonitoringPart2;

    /* ======================================================================
       SECTION 47
       LIFECYCLE CONSTANTS
       ====================================================================== */

    const STABILITY_STATUS =
        Object.freeze({
            UNKNOWN:
                "unknown",

            OBSERVING:
                "observing",

            STABILIZING:
                "stabilizing",

            STABLE:
                "stable",

            UNSTABLE:
                "unstable",

            CRITICAL:
                "critical"
        });

    const REOPENING_RECOMMENDATION =
        Object.freeze({
            NOT_READY:
                "not_ready",

            WAIT:
                "wait",

            READY:
                "ready",

            RECOMMENDED:
                "recommended",

            REQUIRED:
                "required",

            BLOCKED:
                "blocked"
        });

    const ESCALATION_LEVEL =
        Object.freeze({
            NONE:
                "none",

            WATCH:
                "watch",

            RECOVERY:
                "recovery",

            URGENT_RECOVERY:
                "urgent_recovery",

            CRITICAL_RECOVERY:
                "critical_recovery"
        });

    const DEFAULT_REOPENING_MINIMUM_CHECKS =
        3;

    const DEFAULT_CRITICAL_FAILURE_THRESHOLD =
        5;

    const DEFAULT_RECOVERY_COOLDOWN_MS =
        2 * 60 * 1000;

    const DEFAULT_REOPENING_COOLDOWN_MS =
        60 * 1000;

    const DEFAULT_STABILITY_SAMPLE_LIMIT =
        20;

    const DEFAULT_HEALTH_VARIANCE_LIMIT =
        0.08;

    const DEFAULT_HEALTH_DROP_THRESHOLD =
        0.20;

    /* ======================================================================
       SECTION 48
       LIFECYCLE HELPERS
       ====================================================================== */

    function calculateVariance(
        values
    ) {
        const normalized =
            safeArray(values)
                .map(
                    (value) => {
                        return Number(value);
                    }
                )
                .filter(
                    Number.isFinite
                );

        if (
            normalized.length <=
            1
        ) {
            return 0;
        }

        const average =
            calculateAverage(
                normalized
            );

        const squaredDifferences =
            normalized.map(
                (value) => {
                    return Math.pow(
                        value -
                        average,
                        2
                    );
                }
            );

        return (
            calculateAverage(
                squaredDifferences
            )
        );
    }

    function calculateStandardDeviation(
        values
    ) {
        return Math.sqrt(
            calculateVariance(
                values
            )
        );
    }

    function calculateTrend(
        values
    ) {
        const normalized =
            safeArray(values)
                .map(
                    (value) => {
                        return Number(value);
                    }
                )
                .filter(
                    Number.isFinite
                );

        if (
            normalized.length <
            2
        ) {
            return {
                direction:
                    "flat",

                change:
                    0,

                slope:
                    0
            };
        }

        const first =
            normalized[0];

        const last =
            normalized[
                normalized.length -
                1
            ];

        const change =
            last -
            first;

        const slope =
            change /
            Math.max(
                1,
                normalized.length -
                1
            );

        let direction =
            "flat";

        if (
            slope >
            0.01
        ) {
            direction =
                "improving";
        } else if (
            slope <
            -0.01
        ) {
            direction =
                "declining";
        }

        return {
            direction,
            change,
            slope
        };
    }

    function isHealthyMonitoringStatus(
        status
    ) {
        return [
            RECOVERY_HEALTH_STATUS
                .HEALTHY,

            RECOVERY_HEALTH_STATUS
                .STABLE
        ].includes(
            status
        );
    }

    function isCriticalMonitoringStatus(
        status
    ) {
        return [
            RECOVERY_HEALTH_STATUS
                .UNSTABLE,

            RECOVERY_HEALTH_STATUS
                .CRITICAL
        ].includes(
            status
        );
    }

    function resolveEscalationLevel(
        healthStatus,
        consecutiveFailures
    ) {
        if (
            healthStatus ===
            RECOVERY_HEALTH_STATUS
                .CRITICAL ||
            consecutiveFailures >=
            DEFAULT_CRITICAL_FAILURE_THRESHOLD
        ) {
            return ESCALATION_LEVEL
                .CRITICAL_RECOVERY;
        }

        if (
            healthStatus ===
            RECOVERY_HEALTH_STATUS
                .UNSTABLE ||
            consecutiveFailures >=
            DEFAULT_MAX_CONSECUTIVE_FAILURES
        ) {
            return ESCALATION_LEVEL
                .URGENT_RECOVERY;
        }

        if (
            healthStatus ===
            RECOVERY_HEALTH_STATUS
                .DEGRADED
        ) {
            return ESCALATION_LEVEL
                .RECOVERY;
        }

        if (
            healthStatus ===
            RECOVERY_HEALTH_STATUS
                .WATCH
        ) {
            return ESCALATION_LEVEL
                .WATCH;
        }

        return ESCALATION_LEVEL.NONE;
    }

    /* ======================================================================
       SECTION 49
       ENSURE LIFECYCLE STATE
       ====================================================================== */

    MonitoringClass.prototype.ensureLifecycleState =
        function ensureLifecycleState() {
            if (
                !this.state.lifecycle
            ) {
                this.state.lifecycle = {
                    stabilityStatus:
                        STABILITY_STATUS.UNKNOWN,

                    reopeningRecommendation:
                        REOPENING_RECOMMENDATION
                            .NOT_READY,

                    escalationLevel:
                        ESCALATION_LEVEL.NONE,

                    lastRecoveryRequestAt:
                        null,

                    lastReopeningRecommendationAt:
                        null,

                    lastStabilityEvaluationAt:
                        null,

                    lastHealthDropAt:
                        null,

                    recoveryRequestCount:
                        0,

                    reopeningRecommendationCount:
                        0,

                    stabilityConfirmationCount:
                        0,

                    healthDropCount:
                        0,

                    automaticChecksStarted:
                        false,

                    automaticCheckCount:
                        0,

                    automaticCheckFailures:
                        0
                };
            }

            return this.state
                .lifecycle;
        };

    /* ======================================================================
       SECTION 50
       START MONITORING
       ====================================================================== */

    MonitoringClass.prototype.start =
        async function start(
            options = {}
        ) {
            if (
                this.destroyed
            ) {
                throw createMonitoringError(
                    "Post recovery monitoring has been destroyed.",
                    "MONITORING_DESTROYED"
                );
            }

            if (
                this.state.status ===
                MONITORING_STATUS.RUNNING
            ) {
                return {
                    started:
                        false,

                    reason:
                        "already_running",

                    status:
                        this.getStatus()
                };
            }

            const safeOptions =
                safeObject(options);

            this.configure(
                safeOptions.configuration ||
                safeOptions
            );

            if (
                !this.configuration.enabled &&
                safeOptions.force !==
                true
            ) {
                return {
                    started:
                        false,

                    reason:
                        "monitoring_disabled"
                };
            }

            this.clearTimers();

            this.state.status =
                MONITORING_STATUS.STARTING;

            this.state.startedAt =
                this.state.startedAt ||
                Date.now();

            this.state.stoppedAt =
                null;

            this.state.pausedAt =
                null;

            this.state.lastError =
                null;

            this.ensureLifecycleState()
                .automaticChecksStarted =
                true;

            this.synchronizeCoreState();

            const initialDelayMs =
                Math.max(
                    0,
                    toFiniteNumber(
                        safeOptions.initialDelayMs,
                        this.configuration
                            .initialDelayMs ||
                        DEFAULT_INITIAL_DELAY_MS
                    )
                );

            if (
                initialDelayMs >
                0
            ) {
                await sleep(
                    initialDelayMs
                );
            }

            if (
                this.destroyed ||
                this.state.status ===
                MONITORING_STATUS.STOPPING ||
                this.state.status ===
                MONITORING_STATUS.STOPPED
            ) {
                return {
                    started:
                        false,

                    reason:
                        "start_cancelled"
                };
            }

            this.state.status =
                MONITORING_STATUS.RUNNING;

            this.emit(
                MONITORING_EVENT
                    .MONITORING_STARTED,
                {
                    startedAt:
                        this.state.startedAt,

                    intervalMs:
                        this.configuration
                            .monitoringIntervalMs
                }
            );

            if (
                safeOptions.runImmediately !==
                false
            ) {
                await this
                    .runScheduledMonitoringCheck({
                        source:
                            "monitoring_start"
                    });
            }

            this.scheduleMonitoringLoop();

            this.synchronizeCoreState();

            return {
                started:
                    true,

                status:
                    this.getStatus()
            };
        };

    /* ======================================================================
       SECTION 51
       SCHEDULE MONITORING LOOP
       ====================================================================== */

    MonitoringClass.prototype.scheduleMonitoringLoop =
        function scheduleMonitoringLoop() {
            if (
                this.destroyed ||
                this.state.status !==
                MONITORING_STATUS.RUNNING
            ) {
                return false;
            }

            if (
                this.state.timer
            ) {
                global.clearInterval(
                    this.state.timer
                );
            }

            const intervalMs =
                Math.max(
                    5000,
                    toFiniteNumber(
                        this.configuration
                            .monitoringIntervalMs,
                        DEFAULT_MONITORING_INTERVAL_MS
                    )
                );

            this.state.nextCheckAt =
                Date.now() +
                intervalMs;

            this.state.timer =
                global.setInterval(
                    async () => {
                        if (
                            this.destroyed ||
                            this.state.status !==
                            MONITORING_STATUS.RUNNING
                        ) {
                            return;
                        }

                        this.state.nextCheckAt =
                            Date.now() +
                            intervalMs;

                        await this
                            .runScheduledMonitoringCheck({
                                source:
                                    "automatic_interval"
                            });
                    },
                    intervalMs
                );

            this.synchronizeCoreState();

            return true;
        };

    /* ======================================================================
       SECTION 52
       RUN SCHEDULED MONITORING CHECK
       ====================================================================== */

    MonitoringClass.prototype.runScheduledMonitoringCheck =
        async function runScheduledMonitoringCheck(
            options = {}
        ) {
            const lifecycle =
                this.ensureLifecycleState();

            lifecycle
                .automaticCheckCount +=
                1;

            try {
                const result =
                    await this
                        .runMonitoringCheck({
                            ...safeObject(
                                options
                            ),

                            metadata: {
                                ...safeObject(
                                    options.metadata
                                ),

                                automatic:
                                    true,

                                source:
                                    options.source ||
                                    "automatic_monitoring"
                            }
                        });

                if (
                    result.executed ===
                    true &&
                    result.check
                ) {
                    await this
                        .processMonitoringOutcome(
                            result.check,
                            options
                        );
                }

                return result;
            } catch (error) {
                lifecycle
                    .automaticCheckFailures +=
                    1;

                const normalized =
                    normalizeMonitoringError(
                        error
                    );

                this.state.lastError =
                    normalized;

                await this
                    .processMonitoringFailure(
                        normalized,
                        options
                    );

                return {
                    executed:
                        false,

                    error:
                        normalized
                };
            }
        };

    /* ======================================================================
       SECTION 53
       PAUSE MONITORING
       ====================================================================== */

    MonitoringClass.prototype.pause =
        function pause(
            options = {}
        ) {
            if (
                this.state.status !==
                MONITORING_STATUS.RUNNING
            ) {
                return {
                    paused:
                        false,

                    reason:
                        "monitoring_not_running"
                };
            }

            this.clearTimers();

            this.state.status =
                MONITORING_STATUS.PAUSED;

            this.state.pausedAt =
                Date.now();

            this.emit(
                MONITORING_EVENT
                    .MONITORING_PAUSED,
                {
                    reason:
                        options.reason ||
                        "manual_pause",

                    pausedAt:
                        this.state.pausedAt
                }
            );

            this.synchronizeCoreState();

            return {
                paused:
                    true,

                status:
                    this.getStatus()
            };
        };

    /* ======================================================================
       SECTION 54
       RESUME MONITORING
       ====================================================================== */

    MonitoringClass.prototype.resume =
        async function resume(
            options = {}
        ) {
            if (
                this.state.status !==
                MONITORING_STATUS.PAUSED
            ) {
                return {
                    resumed:
                        false,

                    reason:
                        "monitoring_not_paused"
                };
            }

            this.state.status =
                MONITORING_STATUS.RUNNING;

            this.state.resumedAt =
                Date.now();

            this.state.pausedAt =
                null;

            this.emit(
                MONITORING_EVENT
                    .MONITORING_RESUMED,
                {
                    resumedAt:
                        this.state.resumedAt
                }
            );

            if (
                options.runImmediately ===
                true
            ) {
                await this
                    .runScheduledMonitoringCheck({
                        source:
                            "monitoring_resume"
                    });
            }

            this.scheduleMonitoringLoop();

            this.synchronizeCoreState();

            return {
                resumed:
                    true,

                status:
                    this.getStatus()
            };
        };

    /* ======================================================================
       SECTION 55
       STOP MONITORING
       ====================================================================== */

    MonitoringClass.prototype.stop =
        async function stop(
            options = {}
        ) {
            if (
                [
                    MONITORING_STATUS.STOPPED,
                    MONITORING_STATUS.IDLE
                ].includes(
                    this.state.status
                )
            ) {
                return {
                    stopped:
                        false,

                    reason:
                        "monitoring_not_active"
                };
            }

            this.state.status =
                MONITORING_STATUS.STOPPING;

            this.clearTimers();

            if (
                options.waitForActiveCheck !==
                false &&
                this.state.checkInProgress
            ) {
                const timeoutMs =
                    Math.max(
                        1000,
                        toFiniteNumber(
                            options.waitTimeoutMs,
                            this.configuration
                                .checkTimeoutMs
                        )
                    );

                const startedWaitingAt =
                    Date.now();

                while (
                    this.state.checkInProgress &&
                    Date.now() -
                    startedWaitingAt <
                    timeoutMs
                ) {
                    await sleep(
                        100
                    );
                }
            }

            this.state.status =
                MONITORING_STATUS.STOPPED;

            this.state.stoppedAt =
                Date.now();

            this.updateMonitoringDuration();

            this.emit(
                MONITORING_EVENT
                    .MONITORING_STOPPED,
                {
                    reason:
                        options.reason ||
                        "manual_stop",

                    stoppedAt:
                        this.state.stoppedAt,

                    monitoringDurationMs:
                        this.state
                            .monitoringDurationMs
                }
            );

            if (
                options.createSnapshot ===
                true
            ) {
                this.createSnapshot(
                    "monitoring_stopped",
                    {
                        reason:
                            options.reason ||
                            "manual_stop"
                    }
                );
            }

            this.synchronizeCoreState();

            return {
                stopped:
                    true,

                status:
                    this.getStatus()
            };
        };

    /* ======================================================================
       SECTION 56
       RESTART MONITORING
       ====================================================================== */

    MonitoringClass.prototype.restart =
        async function restart(
            options = {}
        ) {
            await this.stop({
                reason:
                    "monitoring_restart",

                waitForActiveCheck:
                    true
            });

            if (
                options.reset ===
                true
            ) {
                this.reset({
                    preserveId:
                        options.preserveId ===
                        true,

                    clearHistory:
                        options.clearHistory !==
                        false,

                    clearAnomalies:
                        options.clearAnomalies !==
                        false,

                    clearSnapshots:
                        options.clearSnapshots !==
                        false
                });
            }

            return this.start({
                ...safeObject(options),

                force:
                    true,

                initialDelayMs:
                    options.initialDelayMs ??
                    0
            });
        };

    /* ======================================================================
       SECTION 57
       BUILD STABILITY SAMPLE
       ====================================================================== */

    MonitoringClass.prototype.buildStabilitySample =
        function buildStabilitySample(
            limit =
                DEFAULT_STABILITY_SAMPLE_LIMIT
        ) {
            const safeLimit =
                Math.max(
                    1,
                    Math.round(
                        toFiniteNumber(
                            limit,
                            DEFAULT_STABILITY_SAMPLE_LIMIT
                        )
                    )
                );

            const history =
                safeArray(
                    this.state
                        .checkHistory
                )
                    .filter(
                        (check) => {
                            return Number.isFinite(
                                Number(
                                    check.healthScore
                                )
                            );
                        }
                    )
                    .slice(
                        -safeLimit
                    );

            const scores =
                history.map(
                    (check) => {
                        return clamp(
                            check.healthScore,
                            0,
                            1
                        );
                    }
                );

            return {
                history:
                    deepClone(
                        history
                    ),

                scores,

                count:
                    scores.length,

                averageScore:
                    calculateAverage(
                        scores
                    ),

                minimumScore:
                    scores.length
                        ? Math.min(
                            ...scores
                        )
                        : 0,

                maximumScore:
                    scores.length
                        ? Math.max(
                            ...scores
                        )
                        : 0,

                standardDeviation:
                    calculateStandardDeviation(
                        scores
                    ),

                trend:
                    calculateTrend(
                        scores
                    )
            };
        };

    /* ======================================================================
       SECTION 58
       EVALUATE STABILITY
       ====================================================================== */

    MonitoringClass.prototype.evaluateStability =
        function evaluateStability(
            options = {}
        ) {
            const lifecycle =
                this.ensureLifecycleState();

            const safeOptions =
                safeObject(options);

            const minimumChecks =
                Math.max(
                    1,
                    Math.round(
                        toFiniteNumber(
                            safeOptions.minimumChecks,
                            this.configuration
                                .minimumStableChecks ||
                            DEFAULT_MIN_STABLE_CHECKS
                        )
                    )
                );

            const sample =
                this.buildStabilitySample(
                    safeOptions.sampleLimit ||
                    DEFAULT_STABILITY_SAMPLE_LIMIT
                );

            const minimumStableScore =
                clamp(
                    toFiniteNumber(
                        safeOptions.minimumStableScore,
                        0.70
                    ),
                    0,
                    1
                );

            const maximumVariance =
                clamp(
                    toFiniteNumber(
                        safeOptions.maximumVariance,
                        DEFAULT_HEALTH_VARIANCE_LIMIT
                    ),
                    0,
                    1
                );

            let status =
                STABILITY_STATUS.OBSERVING;

            let stable =
                false;

            if (
                sample.count >=
                minimumChecks
            ) {
                if (
                    this.state
                        .healthStatus ===
                    RECOVERY_HEALTH_STATUS
                        .CRITICAL
                ) {
                    status =
                        STABILITY_STATUS.CRITICAL;
                } else if (
                    sample.averageScore >=
                    minimumStableScore &&
                    sample.standardDeviation <=
                    maximumVariance &&
                    sample.trend.direction !==
                    "declining"
                ) {
                    status =
                        STABILITY_STATUS.STABLE;

                    stable =
                        true;
                } else if (
                    sample.averageScore >=
                    0.55
                ) {
                    status =
                        STABILITY_STATUS.STABILIZING;
                } else {
                    status =
                        STABILITY_STATUS.UNSTABLE;
                }
            }

            const previousStatus =
                lifecycle
                    .stabilityStatus;

            lifecycle
                .stabilityStatus =
                status;

            lifecycle
                .lastStabilityEvaluationAt =
                Date.now();

            this.state
                .stabilityConfirmed =
                stable;

            if (
                stable &&
                !this.state.stableSince
            ) {
                this.state.stableSince =
                    Date.now();
            }

            if (!stable) {
                this.state.stableSince =
                    null;
            }

            const evaluation = {
                status,

                previousStatus,

                stable,

                minimumChecks,

                minimumStableScore,

                maximumVariance,

                sample,

                evaluatedAt:
                    lifecycle
                        .lastStabilityEvaluationAt
            };

            this.state
                .stabilityHistory
                .push(
                    deepClone(
                        evaluation
                    )
                );

            this.state
                .stabilityHistory =
                this.state
                    .stabilityHistory
                    .slice(-100);

            if (
                stable &&
                previousStatus !==
                STABILITY_STATUS.STABLE
            ) {
                lifecycle
                    .stabilityConfirmationCount +=
                    1;

                this.emit(
                    MONITORING_EVENT
                        .STABILITY_CONFIRMED,
                    {
                        evaluation:
                            deepClone(
                                evaluation
                            )
                    }
                );

                if (
                    this.configuration
                        .autoSnapshot
                ) {
                    this.createSnapshot(
                        "stability_confirmed",
                        {
                            evaluation:
                                deepClone(
                                    evaluation
                                )
                        }
                    );
                }
            }

            this.synchronizeCoreState();

            return evaluation;
        };

    /* ======================================================================
       SECTION 59
       DETECT HEALTH DROP
       ====================================================================== */

    MonitoringClass.prototype.detectHealthDrop =
        function detectHealthDrop(
            check
        ) {
            const lifecycle =
                this.ensureLifecycleState();

            const previousScore =
                toFiniteNumber(
                    this.state
                        .previousHealthScore,
                    check?.healthScore ||
                    0
                );

            const currentScore =
                toFiniteNumber(
                    check?.healthScore,
                    this.state.healthScore
                );

            const drop =
                previousScore -
                currentScore;

            const detected =
                drop >=
                DEFAULT_HEALTH_DROP_THRESHOLD;

            if (detected) {
                lifecycle
                    .lastHealthDropAt =
                    Date.now();

                lifecycle
                    .healthDropCount +=
                    1;

                this.createAnomaly(
                    "sudden_health_drop",
                    currentScore <
                    0.30
                        ? ANOMALY_SEVERITY
                            .CRITICAL
                        : ANOMALY_SEVERITY
                            .HIGH,
                    "A sudden post recovery health decline was detected.",
                    {
                        previousScore,
                        currentScore,
                        drop,
                        checkId:
                            check?.id ||
                            null
                    }
                );
            }

            return {
                detected,
                previousScore,
                currentScore,
                drop
            };
        };

    /* ======================================================================
       SECTION 60
       EVALUATE REOPENING READINESS
       ====================================================================== */

    MonitoringClass.prototype.evaluateReopeningReadiness =
        function evaluateReopeningReadiness(
            options = {}
        ) {
            const lifecycle =
                this.ensureLifecycleState();

            const safeOptions =
                safeObject(options);

            const requiredScore =
                clamp(
                    toFiniteNumber(
                        safeOptions.requiredScore,
                        this.configuration
                            .reopeningRequiredScore ||
                        DEFAULT_REOPENING_SCORE
                    ),
                    0,
                    1
                );

            const minimumChecks =
                Math.max(
                    1,
                    Math.round(
                        toFiniteNumber(
                            safeOptions.minimumChecks,
                            DEFAULT_REOPENING_MINIMUM_CHECKS
                        )
                    )
                );

            const unresolvedCriticalAnomalies =
                this.state
                    .anomalies
                    .filter(
                        (anomaly) => {
                            return (
                                anomaly.resolved !==
                                true &&
                                anomaly.severity ===
                                ANOMALY_SEVERITY
                                    .CRITICAL
                            );
                        }
                    );

            const readyByScore =
                this.state.healthScore >=
                requiredScore;

            const readyByChecks =
                this.state
                    .consecutiveSuccessfulChecks >=
                minimumChecks;

            const readyByStability =
                this.state
                    .stabilityConfirmed ===
                true;

            const blocked =
                unresolvedCriticalAnomalies
                    .length >
                0 ||
                this.state
                    .recoveryRequired ===
                true;

            let recommendation =
                REOPENING_RECOMMENDATION
                    .NOT_READY;

            if (blocked) {
                recommendation =
                    REOPENING_RECOMMENDATION
                        .BLOCKED;
            } else if (
                readyByScore &&
                readyByChecks &&
                readyByStability
            ) {
                recommendation =
                    REOPENING_RECOMMENDATION
                        .RECOMMENDED;
            } else if (
                readyByScore &&
                readyByChecks
            ) {
                recommendation =
                    REOPENING_RECOMMENDATION
                        .READY;
            } else if (
                this.state.healthScore >=
                requiredScore -
                0.10
            ) {
                recommendation =
                    REOPENING_RECOMMENDATION
                        .WAIT;
            }

            const previousRecommendation =
                lifecycle
                    .reopeningRecommendation;

            lifecycle
                .reopeningRecommendation =
                recommendation;

            const reopeningRecommended =
                [
                    REOPENING_RECOMMENDATION
                        .READY,

                    REOPENING_RECOMMENDATION
                        .RECOMMENDED
                ].includes(
                    recommendation
                );

            this.state
                .reopeningRecommended =
                reopeningRecommended;

            const evaluation = {
                recommendation,

                previousRecommendation,

                reopeningRecommended,

                requiredScore,

                minimumChecks,

                checks: {
                    readyByScore,
                    readyByChecks,
                    readyByStability,
                    blocked
                },

                healthScore:
                    this.state.healthScore,

                consecutiveSuccessfulChecks:
                    this.state
                        .consecutiveSuccessfulChecks,

                stabilityConfirmed:
                    this.state
                        .stabilityConfirmed,

                unresolvedCriticalAnomalyCount:
                    unresolvedCriticalAnomalies
                        .length,

                evaluatedAt:
                    Date.now()
            };

            if (
                reopeningRecommended &&
                previousRecommendation !==
                recommendation
            ) {
                lifecycle
                    .reopeningRecommendationCount +=
                    1;

                lifecycle
                    .lastReopeningRecommendationAt =
                    evaluation.evaluatedAt;

                this.emit(
                    MONITORING_EVENT
                        .REOPENING_RECOMMENDED,
                    {
                        evaluation:
                            deepClone(
                                evaluation
                            )
                    }
                );
            }

            this.synchronizeCoreState();

            return evaluation;
        };

    /* ======================================================================
       SECTION 61
       REQUEST RECOVERY
       ====================================================================== */

    MonitoringClass.prototype.requestRecovery =
        async function requestRecovery(
            options = {}
        ) {
            const lifecycle =
                this.ensureLifecycleState();

            const safeOptions =
                safeObject(options);

            const cooldownMs =
                Math.max(
                    0,
                    toFiniteNumber(
                        safeOptions.cooldownMs,
                        DEFAULT_RECOVERY_COOLDOWN_MS
                    )
                );

            if (
                lifecycle
                    .lastRecoveryRequestAt &&
                Date.now() -
                lifecycle
                    .lastRecoveryRequestAt <
                cooldownMs &&
                safeOptions.force !==
                true
            ) {
                return {
                    requested:
                        false,

                    reason:
                        "recovery_cooldown_active"
                };
            }

            this.state
                .recoveryRequired =
                true;

            lifecycle
                .lastRecoveryRequestAt =
                Date.now();

            lifecycle
                .recoveryRequestCount +=
                1;

            const payload = {
                reason:
                    safeOptions.reason ||
                    "post_recovery_monitoring_failure",

                escalationLevel:
                    safeOptions
                        .escalationLevel ||
                    lifecycle
                        .escalationLevel,

                healthStatus:
                    this.state
                        .healthStatus,

                healthScore:
                    this.state
                        .healthScore,

                consecutiveFailures:
                    this.state
                        .consecutiveFailedChecks,

                source:
                    "post_recovery_monitoring_v32",

                metadata:
                    deepClone(
                        safeObject(
                            safeOptions.metadata
                        )
                    )
            };

            this.emit(
                MONITORING_EVENT
                    .RECOVERY_REQUIRED,
                {
                    request:
                        deepClone(
                            payload
                        )
                }
            );

            let result =
                null;

            try {
                if (
                    typeof this.core
                        .scheduleRecovery ===
                    "function"
                ) {
                    result =
                        await this.core
                            .scheduleRecovery(
                                payload
                            );
                } else if (
                    typeof this.core
                        .startRecovery ===
                    "function"
                ) {
                    result =
                        await this.core
                            .startRecovery(
                                payload
                            );
                } else if (
                    typeof this.core
                        .recover ===
                    "function"
                ) {
                    result =
                        await this.core
                            .recover(
                                payload
                            );
                }
            } catch (error) {
                const normalized =
                    normalizeMonitoringError(
                        error
                    );

                this.state.lastError =
                    normalized;

                return {
                    requested:
                        false,

                    error:
                        normalized
                };
            }

            this.synchronizeCoreState();

            return {
                requested:
                    true,

                request:
                    payload,

                result:
                    deepClone(
                        result
                    )
            };
        };

    /* ======================================================================
       SECTION 62
       CLEAR RECOVERY REQUIREMENT
       ====================================================================== */

    MonitoringClass.prototype.clearRecoveryRequirement =
        function clearRecoveryRequirement(
            options = {}
        ) {
            this.state
                .recoveryRequired =
                false;

            const lifecycle =
                this.ensureLifecycleState();

            lifecycle.escalationLevel =
                ESCALATION_LEVEL.NONE;

            this.synchronizeCoreState();

            return {
                cleared:
                    true,

                reason:
                    options.reason ||
                    "recovery_requirement_cleared",

                clearedAt:
                    Date.now()
            };
        };

    /* ======================================================================
       SECTION 63
       PROCESS MONITORING OUTCOME
       ====================================================================== */

    MonitoringClass.prototype.processMonitoringOutcome =
        async function processMonitoringOutcome(
            check,
            options = {}
        ) {
            const lifecycle =
                this.ensureLifecycleState();

            const healthDrop =
                this.detectHealthDrop(
                    check
                );

            const stability =
                this.evaluateStability(
                    options.stability ||
                    {}
                );

            const reopening =
                this.evaluateReopeningReadiness(
                    options.reopening ||
                    {}
                );

            const escalationLevel =
                resolveEscalationLevel(
                    this.state
                        .healthStatus,
                    this.state
                        .consecutiveFailedChecks
                );

            lifecycle.escalationLevel =
                escalationLevel;

            if (
                isHealthyMonitoringStatus(
                    this.state
                        .healthStatus
                ) &&
                stability.stable
            ) {
                this.state
                    .recoveryRequired =
                    false;
            }

            let recovery =
                null;

            const recoveryRequired =
                [
                    ESCALATION_LEVEL.RECOVERY,
                    ESCALATION_LEVEL
                        .URGENT_RECOVERY,
                    ESCALATION_LEVEL
                        .CRITICAL_RECOVERY
                ].includes(
                    escalationLevel
                );

            if (recoveryRequired) {
                this.state
                    .recoveryRequired =
                    true;

                recovery =
                    await this
                        .requestRecovery({
                            escalationLevel,

                            reason:
                                healthDrop.detected
                                    ? "sudden_health_drop"
                                    : "post_recovery_instability",

                            metadata: {
                                checkId:
                                    check.id,

                                healthScore:
                                    check.healthScore,

                                healthStatus:
                                    check.healthStatus,

                                stability:
                                    deepClone(
                                        stability
                                    )
                            }
                        });
            }

            if (
                this.configuration
                    .stopOnCritical &&
                this.state
                    .healthStatus ===
                RECOVERY_HEALTH_STATUS
                    .CRITICAL
            ) {
                await this.stop({
                    reason:
                        "critical_health_status",

                    createSnapshot:
                        true
                });
            }

            return {
                checkId:
                    check.id,

                healthDrop,

                stability,

                reopening,

                escalationLevel,

                recoveryRequired,

                recovery
            };
        };

    /* ======================================================================
       SECTION 64
       PROCESS MONITORING FAILURE
       ====================================================================== */

    MonitoringClass.prototype.processMonitoringFailure =
        async function processMonitoringFailure(
            error,
            options = {}
        ) {
            const lifecycle =
                this.ensureLifecycleState();

            this.state.status =
                MONITORING_STATUS.DEGRADED;

            const escalationLevel =
                resolveEscalationLevel(
                    RECOVERY_HEALTH_STATUS
                        .UNSTABLE,
                    this.state
                        .consecutiveFailedChecks
                );

            lifecycle.escalationLevel =
                escalationLevel;

            this.emit(
                MONITORING_EVENT
                    .MONITORING_FAILED,
                {
                    error:
                        deepClone(
                            error
                        ),

                    escalationLevel
                }
            );

            if (
                this.state
                    .consecutiveFailedChecks >=
                this.configuration
                    .maximumConsecutiveFailures
            ) {
                return this
                    .requestRecovery({
                        escalationLevel,

                        reason:
                            "monitoring_execution_failure",

                        metadata: {
                            error:
                                deepClone(
                                    error
                                ),

                            source:
                                options.source ||
                                "monitoring_failure"
                        }
                    });
            }

            this.synchronizeCoreState();

            return {
                recoveryRequested:
                    false,

                escalationLevel
            };
        };

    /* ======================================================================
       SECTION 65
       FORCE REOPENING RECOMMENDATION
       ====================================================================== */

    MonitoringClass.prototype.recommendReopening =
        function recommendReopening(
            options = {}
        ) {
            const lifecycle =
                this.ensureLifecycleState();

            const cooldownMs =
                Math.max(
                    0,
                    toFiniteNumber(
                        options.cooldownMs,
                        DEFAULT_REOPENING_COOLDOWN_MS
                    )
                );

            if (
                lifecycle
                    .lastReopeningRecommendationAt &&
                Date.now() -
                lifecycle
                    .lastReopeningRecommendationAt <
                cooldownMs &&
                options.force !==
                true
            ) {
                return {
                    recommended:
                        false,

                    reason:
                        "reopening_recommendation_cooldown"
                };
            }

            lifecycle
                .reopeningRecommendation =
                REOPENING_RECOMMENDATION
                    .RECOMMENDED;

            lifecycle
                .lastReopeningRecommendationAt =
                Date.now();

            lifecycle
                .reopeningRecommendationCount +=
                1;

            this.state
                .reopeningRecommended =
                true;

            const recommendation = {
                recommended:
                    true,

                reason:
                    options.reason ||
                    "post_recovery_stability_confirmed",

                healthStatus:
                    this.state
                        .healthStatus,

                healthScore:
                    this.state
                        .healthScore,

                stabilityConfirmed:
                    this.state
                        .stabilityConfirmed,

                recommendedAt:
                    lifecycle
                        .lastReopeningRecommendationAt,

                metadata:
                    deepClone(
                        safeObject(
                            options.metadata
                        )
                    )
            };

            this.emit(
                MONITORING_EVENT
                    .REOPENING_RECOMMENDED,
                {
                    evaluation:
                        deepClone(
                            recommendation
                        )
                }
            );

            this.synchronizeCoreState();

            return recommendation;
        };

    /* ======================================================================
       SECTION 66
       GET STABILITY STATUS
       ====================================================================== */

    MonitoringClass.prototype.getStabilityStatus =
        function getStabilityStatus() {
            const lifecycle =
                this.ensureLifecycleState();

            const latestEvaluation =
                safeArray(
                    this.state
                        .stabilityHistory
                )
                    .slice(-1)[0] ||
                null;

            return {
                status:
                    lifecycle
                        .stabilityStatus,

                stabilityConfirmed:
                    this.state
                        .stabilityConfirmed,

                stableSince:
                    this.state
                        .stableSince,

                confirmationCount:
                    lifecycle
                        .stabilityConfirmationCount,

                lastEvaluationAt:
                    lifecycle
                        .lastStabilityEvaluationAt,

                latestEvaluation:
                    latestEvaluation
                        ? deepClone(
                            latestEvaluation
                        )
                        : null
            };
        };

    /* ======================================================================
       SECTION 67
       GET LIFECYCLE STATUS
       ====================================================================== */

    MonitoringClass.prototype.getLifecycleStatus =
        function getLifecycleStatus() {
            const lifecycle =
                this.ensureLifecycleState();

            return {
                monitoringStatus:
                    this.state.status,

                healthStatus:
                    this.state
                        .healthStatus,

                healthScore:
                    this.state
                        .healthScore,

                stabilityStatus:
                    lifecycle
                        .stabilityStatus,

                reopeningRecommendation:
                    lifecycle
                        .reopeningRecommendation,

                escalationLevel:
                    lifecycle
                        .escalationLevel,

                recoveryRequired:
                    this.state
                        .recoveryRequired,

                reopeningRecommended:
                    this.state
                        .reopeningRecommended,

                lastRecoveryRequestAt:
                    lifecycle
                        .lastRecoveryRequestAt,

                lastReopeningRecommendationAt:
                    lifecycle
                        .lastReopeningRecommendationAt,

                recoveryRequestCount:
                    lifecycle
                        .recoveryRequestCount,

                reopeningRecommendationCount:
                    lifecycle
                        .reopeningRecommendationCount,

                automaticCheckCount:
                    lifecycle
                        .automaticCheckCount,

                automaticCheckFailures:
                    lifecycle
                        .automaticCheckFailures
            };
        };

    /* ======================================================================
       SECTION 68
       DESTROY MONITORING
       ====================================================================== */

    MonitoringClass.prototype.destroy =
        async function destroy(
            options = {}
        ) {
            if (
                this.destroyed
            ) {
                return {
                    destroyed:
                        false,

                    reason:
                        "already_destroyed"
                };
            }

            await this.stop({
                reason:
                    "monitoring_destroy",

                waitForActiveCheck:
                    options
                        .waitForActiveCheck !==
                    false
            });

            this.clearTimers();

            this.lifecycleHooks
                ?.clear?.();

            this.boundHandlers
                ?.clear?.();

            this.events
                ?.removeAllListeners?.();

            if (
                this.core
                    ?.postRecoveryMonitoring ===
                this
            ) {
                this.core
                    .postRecoveryMonitoring =
                    null;
            }

            if (
                this.core
                    ?.state
                    ?.postRecoveryMonitoring
            ) {
                this.core.state
                    .postRecoveryMonitoring = {
                        status:
                            MONITORING_STATUS
                                .DESTROYED,

                        destroyedAt:
                            Date.now()
                    };
            }

            this.destroyed =
                true;

            this.state.destroyed =
                true;

            this.state.status =
                MONITORING_STATUS.DESTROYED;

            this.emit(
                MONITORING_EVENT.DESTROYED,
                {
                    destroyedAt:
                        Date.now()
                }
            );

            return {
                destroyed:
                    true,

                destroyedAt:
                    Date.now()
            };
        };

    /* ======================================================================
       SECTION 69
       API EXTENSIONS
       ====================================================================== */

    const MonitoringApi =
        global
            .PostRecoveryMonitoringV32API ||
        global
            .RainArrivalPostRecoveryMonitoringV32API ||
        global
            .RainGuardPostRecoveryMonitoringV32API;

    if (MonitoringApi) {
        MonitoringApi.start =
            function start(
                options = {}
            ) {
                return this
                    .requireInstance()
                    .start(
                        options
                    );
            };

        MonitoringApi.pause =
            function pause(
                options = {}
            ) {
                return this
                    .requireInstance()
                    .pause(
                        options
                    );
            };

        MonitoringApi.resume =
            function resume(
                options = {}
            ) {
                return this
                    .requireInstance()
                    .resume(
                        options
                    );
            };

        MonitoringApi.stop =
            function stop(
                options = {}
            ) {
                return this
                    .requireInstance()
                    .stop(
                        options
                    );
            };

        MonitoringApi.restart =
            function restart(
                options = {}
            ) {
                return this
                    .requireInstance()
                    .restart(
                        options
                    );
            };

        MonitoringApi.evaluateStability =
            function evaluateStability(
                options = {}
            ) {
                return this
                    .requireInstance()
                    .evaluateStability(
                        options
                    );
            };

        MonitoringApi.evaluateReopening =
            function evaluateReopening(
                options = {}
            ) {
                return this
                    .requireInstance()
                    .evaluateReopeningReadiness(
                        options
                    );
            };

        MonitoringApi.requestRecovery =
            function requestRecovery(
                options = {}
            ) {
                return this
                    .requireInstance()
                    .requestRecovery(
                        options
                    );
            };

        MonitoringApi.recommendReopening =
            function recommendReopening(
                options = {}
            ) {
                return this
                    .requireInstance()
                    .recommendReopening(
                        options
                    );
            };

        MonitoringApi.getLifecycleStatus =
            function getLifecycleStatus() {
                return this
                    .requireInstance()
                    .getLifecycleStatus();
            };

        MonitoringApi.getStabilityStatus =
            function getStabilityStatus() {
                return this
                    .requireInstance()
                    .getStabilityStatus();
            };

        MonitoringApi.destroy =
            function destroy(
                options = {}
            ) {
                return this
                    .requireInstance()
                    .destroy(
                        options
                    );
            };
    }

    /* ======================================================================
       SECTION 70
       COMPATIBILITY ALIASES
       ====================================================================== */

    MonitoringClass.prototype.startMonitoring =
        MonitoringClass.prototype
            .start;

    MonitoringClass.prototype.pauseMonitoring =
        MonitoringClass.prototype
            .pause;

    MonitoringClass.prototype.resumeMonitoring =
        MonitoringClass.prototype
            .resume;

    MonitoringClass.prototype.stopMonitoring =
        MonitoringClass.prototype
            .stop;

    MonitoringClass.prototype.restartMonitoring =
        MonitoringClass.prototype
            .restart;

    MonitoringClass.prototype.checkStability =
        MonitoringClass.prototype
            .evaluateStability;

    MonitoringClass.prototype.checkReopeningReadiness =
        MonitoringClass.prototype
            .evaluateReopeningReadiness;

    MonitoringClass.prototype.getLifecycle =
        MonitoringClass.prototype
            .getLifecycleStatus;

    /* ======================================================================
       SECTION 71
       PART 3 EXPORT
       ====================================================================== */

    global.PostRecoveryMonitoringV32Part3 = {
        STABILITY_STATUS,
        REOPENING_RECOMMENDATION,
        ESCALATION_LEVEL,
        DEFAULT_REOPENING_MINIMUM_CHECKS,
        DEFAULT_CRITICAL_FAILURE_THRESHOLD,
        DEFAULT_RECOVERY_COOLDOWN_MS,
        DEFAULT_REOPENING_COOLDOWN_MS,
        DEFAULT_STABILITY_SAMPLE_LIMIT,
        DEFAULT_HEALTH_VARIANCE_LIMIT,
        DEFAULT_HEALTH_DROP_THRESHOLD,
        calculateVariance,
        calculateStandardDeviation,
        calculateTrend,
        isHealthyMonitoringStatus,
        isCriticalMonitoringStatus,
        resolveEscalationLevel
    };

})(window);

/* ==========================================================================
   RainGuard AI
   Long Horizon Forecast Engine V32

   Post Recovery Monitoring Engine V32

   PART 4
   Automatic Integration + Recovery Hooks + Closure Hooks +
   Reopening Hooks + Event Subscriptions
   ========================================================================== */

(function extendPostRecoveryMonitoringV32Part4(global) {
    "use strict";

    /* ======================================================================
       SECTION 72
       DEPENDENCY RESOLUTION
       ====================================================================== */

    const MonitoringClass =
        global.PostRecoveryMonitoringV32;

    const MonitoringConstants =
        global.PostRecoveryMonitoringV32Constants;

    const MonitoringUtils =
        global.PostRecoveryMonitoringV32Utils;

    const MonitoringPart3 =
        global.PostRecoveryMonitoringV32Part3;

    if (
        typeof MonitoringClass !==
        "function" ||
        !MonitoringConstants ||
        !MonitoringUtils ||
        !MonitoringPart3
    ) {
        throw new Error(
            "PostRecoveryMonitoringV32 Parts 1 to 3 must be loaded before Part 4."
        );
    }

    const {
        MONITORING_STATUS,
        MONITORING_EVENT
    } = MonitoringConstants;

    const {
        toFiniteNumber,
        safeObject,
        safeArray,
        deepClone,
        normalizeMonitoringError
    } = MonitoringUtils;

    /* ======================================================================
       SECTION 73
       INTEGRATION CONSTANTS
       ====================================================================== */

    const INTEGRATION_STATUS =
        Object.freeze({
            IDLE:
                "idle",

            INSTALLING:
                "installing",

            INSTALLED:
                "installed",

            UNINSTALLING:
                "uninstalling",

            UNINSTALLED:
                "uninstalled",

            FAILED:
                "failed"
        });

    const INTEGRATION_TRIGGER =
        Object.freeze({
            RECOVERY_STARTED:
                "recovery_started",

            RECOVERY_COMPLETED:
                "recovery_completed",

            RECOVERY_FAILED:
                "recovery_failed",

            CLOSURE_STARTED:
                "closure_started",

            CLOSURE_COMPLETED:
                "closure_completed",

            CLOSURE_FAILED:
                "closure_failed",

            REOPENING_STARTED:
                "reopening_started",

            REOPENING_COMPLETED:
                "reopening_completed",

            REOPENING_FAILED:
                "reopening_failed",

            CORE_STARTED:
                "core_started",

            CORE_STOPPED:
                "core_stopped",

            CORE_RESTARTED:
                "core_restarted",

            CYCLE_COMPLETED:
                "cycle_completed",

            FATAL_ERROR:
                "fatal_error",

            MANUAL:
                "manual"
        });

    const DEFAULT_POST_RECOVERY_START_DELAY_MS =
        1000;

    const DEFAULT_CLOSURE_CHECK_DELAY_MS =
        500;

    const DEFAULT_REOPENING_CHECK_DELAY_MS =
        500;

    const DEFAULT_FATAL_ERROR_CHECK_DELAY_MS =
        0;

    /* ======================================================================
       SECTION 74
       INTEGRATION HELPERS
       ====================================================================== */

    function createIntegrationHookId() {
        return (
            "post_recovery_hook_" +
            Date.now() +
            "_" +
            Math.random()
                .toString(36)
                .slice(2, 9)
        );
    }

    function normalizeTrigger(
        trigger
    ) {
        const triggers =
            Object.values(
                INTEGRATION_TRIGGER
            );

        return triggers.includes(
            trigger
        )
            ? trigger
            : INTEGRATION_TRIGGER.MANUAL;
    }

    function resolveEventNames(
        source
    ) {
        const eventNames = [];

        if (
            source &&
            typeof source ===
            "object"
        ) {
            [
                source.events,
                source.EVENTS,
                source.constructor
                    ?.EVENTS,
                source.constants
                    ?.EVENTS
            ]
                .forEach(
                    (container) => {
                        if (
                            !container ||
                            typeof container !==
                            "object"
                        ) {
                            return;
                        }

                        Object.values(
                            container
                        )
                            .forEach(
                                (eventName) => {
                                    if (
                                        typeof eventName ===
                                        "string"
                                    ) {
                                        eventNames.push(
                                            eventName
                                        );
                                    }
                                }
                            );
                    }
                );
        }

        return Array.from(
            new Set(
                eventNames
            )
        );
    }

    function createHookRecord(
        name,
        source,
        eventName,
        handler,
        unsubscribe = null
    ) {
        return {
            id:
                createIntegrationHookId(),

            name,

            source,

            eventName,

            handler,

            unsubscribe,

            installedAt:
                Date.now()
        };
    }

    /* ======================================================================
       SECTION 75
       ENSURE INTEGRATION STATE
       ====================================================================== */

    MonitoringClass.prototype.ensureIntegrationState =
        function ensureIntegrationState() {
            if (
                !this.state.integration
            ) {
                this.state.integration = {
                    status:
                        INTEGRATION_STATUS.IDLE,

                    installed:
                        false,

                    enabled:
                        true,

                    hooks: [],

                    patchedMethods: [],

                    eventSubscriptions: [],

                    lastTrigger:
                        null,

                    lastTriggeredAt:
                        null,

                    triggerCount:
                        0,

                    failedTriggerCount:
                        0,

                    installationCount:
                        0,

                    uninstallationCount:
                        0,

                    lastError:
                        null,

                    configuration: {
                        startAfterRecovery:
                            true,

                        checkAfterClosure:
                            true,

                        checkAfterReopening:
                            true,

                        stopOnCoreStop:
                            true,

                        restartOnCoreRestart:
                            true,

                        checkAfterCycle:
                            false,

                        checkOnFatalError:
                            true,

                        postRecoveryStartDelayMs:
                            DEFAULT_POST_RECOVERY_START_DELAY_MS,

                        closureCheckDelayMs:
                            DEFAULT_CLOSURE_CHECK_DELAY_MS,

                        reopeningCheckDelayMs:
                            DEFAULT_REOPENING_CHECK_DELAY_MS,

                        fatalErrorCheckDelayMs:
                            DEFAULT_FATAL_ERROR_CHECK_DELAY_MS
                    }
                };
            }

            if (
                !Array.isArray(
                    this.state
                        .integration
                        .hooks
                )
            ) {
                this.state
                    .integration
                    .hooks = [];
            }

            if (
                !Array.isArray(
                    this.state
                        .integration
                        .patchedMethods
                )
            ) {
                this.state
                    .integration
                    .patchedMethods = [];
            }

            if (
                !Array.isArray(
                    this.state
                        .integration
                        .eventSubscriptions
                )
            ) {
                this.state
                    .integration
                    .eventSubscriptions = [];
            }

            return this.state
                .integration;
        };

    /* ======================================================================
       SECTION 76
       CONFIGURE INTEGRATION
       ====================================================================== */

    MonitoringClass.prototype.configureIntegration =
        function configureIntegration(
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

            integration.configuration = {
                ...integration.configuration,
                ...safeOptions,

                postRecoveryStartDelayMs:
                    Math.max(
                        0,
                        toFiniteNumber(
                            safeOptions
                                .postRecoveryStartDelayMs,
                            integration
                                .configuration
                                .postRecoveryStartDelayMs
                        )
                    ),

                closureCheckDelayMs:
                    Math.max(
                        0,
                        toFiniteNumber(
                            safeOptions
                                .closureCheckDelayMs,
                            integration
                                .configuration
                                .closureCheckDelayMs
                        )
                    ),

                reopeningCheckDelayMs:
                    Math.max(
                        0,
                        toFiniteNumber(
                            safeOptions
                                .reopeningCheckDelayMs,
                            integration
                                .configuration
                                .reopeningCheckDelayMs
                        )
                    ),

                fatalErrorCheckDelayMs:
                    Math.max(
                        0,
                        toFiniteNumber(
                            safeOptions
                                .fatalErrorCheckDelayMs,
                            integration
                                .configuration
                                .fatalErrorCheckDelayMs
                        )
                    )
            };

            return deepClone(
                integration.configuration
            );
        };

    /* ======================================================================
       SECTION 77
       DELAYED ACTION
       ====================================================================== */

    MonitoringClass.prototype.runDelayedIntegrationAction =
        function runDelayedIntegrationAction(
            delayMs,
            action
        ) {
            const safeDelay =
                Math.max(
                    0,
                    toFiniteNumber(
                        delayMs,
                        0
                    )
                );

            return new Promise(
                (
                    resolve,
                    reject
                ) => {
                    global.setTimeout(
                        async () => {
                            try {
                                resolve(
                                    await action()
                                );
                            } catch (error) {
                                reject(
                                    error
                                );
                            }
                        },
                        safeDelay
                    );
                }
            );
        };

    /* ======================================================================
       SECTION 78
       PROCESS INTEGRATION TRIGGER
       ====================================================================== */

    MonitoringClass.prototype.processIntegrationTrigger =
        async function processIntegrationTrigger(
            trigger,
            payload = {},
            options = {}
        ) {
            const integration =
                this.ensureIntegrationState();

            if (
                !integration.enabled
            ) {
                return {
                    processed:
                        false,

                    reason:
                        "integration_disabled"
                };
            }

            const normalizedTrigger =
                normalizeTrigger(
                    trigger
                );

            integration.lastTrigger =
                normalizedTrigger;

            integration.lastTriggeredAt =
                Date.now();

            integration.triggerCount +=
                1;

            try {
                let result =
                    null;

                switch (
                    normalizedTrigger
                ) {
                    case INTEGRATION_TRIGGER
                        .RECOVERY_STARTED:
                        result =
                            await this
                                .handleRecoveryStarted(
                                    payload,
                                    options
                                );
                        break;

                    case INTEGRATION_TRIGGER
                        .RECOVERY_COMPLETED:
                        result =
                            await this
                                .handleRecoveryCompleted(
                                    payload,
                                    options
                                );
                        break;

                    case INTEGRATION_TRIGGER
                        .RECOVERY_FAILED:
                        result =
                            await this
                                .handleRecoveryFailed(
                                    payload,
                                    options
                                );
                        break;

                    case INTEGRATION_TRIGGER
                        .CLOSURE_STARTED:
                        result =
                            await this
                                .handleClosureStarted(
                                    payload,
                                    options
                                );
                        break;

                    case INTEGRATION_TRIGGER
                        .CLOSURE_COMPLETED:
                        result =
                            await this
                                .handleClosureCompleted(
                                    payload,
                                    options
                                );
                        break;

                    case INTEGRATION_TRIGGER
                        .CLOSURE_FAILED:
                        result =
                            await this
                                .handleClosureFailed(
                                    payload,
                                    options
                                );
                        break;

                    case INTEGRATION_TRIGGER
                        .REOPENING_STARTED:
                        result =
                            await this
                                .handleReopeningStarted(
                                    payload,
                                    options
                                );
                        break;

                    case INTEGRATION_TRIGGER
                        .REOPENING_COMPLETED:
                        result =
                            await this
                                .handleReopeningCompleted(
                                    payload,
                                    options
                                );
                        break;

                    case INTEGRATION_TRIGGER
                        .REOPENING_FAILED:
                        result =
                            await this
                                .handleReopeningFailed(
                                    payload,
                                    options
                                );
                        break;

                    case INTEGRATION_TRIGGER
                        .CORE_STOPPED:
                        result =
                            await this
                                .handleCoreStopped(
                                    payload,
                                    options
                                );
                        break;

                    case INTEGRATION_TRIGGER
                        .CORE_RESTARTED:
                        result =
                            await this
                                .handleCoreRestarted(
                                    payload,
                                    options
                                );
                        break;

                    case INTEGRATION_TRIGGER
                        .CYCLE_COMPLETED:
                        result =
                            await this
                                .handleCycleCompleted(
                                    payload,
                                    options
                                );
                        break;

                    case INTEGRATION_TRIGGER
                        .FATAL_ERROR:
                        result =
                            await this
                                .handleFatalError(
                                    payload,
                                    options
                                );
                        break;

                    default:
                        result = {
                            processed:
                                true,

                            trigger:
                                normalizedTrigger
                        };
                }

                return {
                    processed:
                        true,

                    trigger:
                        normalizedTrigger,

                    result:
                        deepClone(
                            result
                        )
                };
            } catch (error) {
                const normalized =
                    normalizeMonitoringError(
                        error
                    );

                integration
                    .failedTriggerCount +=
                    1;

                integration.lastError =
                    normalized;

                this.state.lastError =
                    normalized;

                return {
                    processed:
                        false,

                    trigger:
                        normalizedTrigger,

                    error:
                        normalized
                };
            } finally {
                this.synchronizeCoreState();
            }
        };

    /* ======================================================================
       SECTION 79
       RECOVERY STARTED HANDLER
       ====================================================================== */

    MonitoringClass.prototype.handleRecoveryStarted =
        async function handleRecoveryStarted(
            payload = {},
            options = {}
        ) {
            if (
                this.state.status ===
                MONITORING_STATUS.RUNNING
            ) {
                return this.pause({
                    reason:
                        "recovery_started"
                });
            }

            return {
                paused:
                    false,

                reason:
                    "monitoring_not_running",

                payload:
                    deepClone(
                        payload
                    )
            };
        };

    /* ======================================================================
       SECTION 80
       RECOVERY COMPLETED HANDLER
       ====================================================================== */

    MonitoringClass.prototype.handleRecoveryCompleted =
        async function handleRecoveryCompleted(
            payload = {},
            options = {}
        ) {
            const integration =
                this.ensureIntegrationState();

            if (
                integration
                    .configuration
                    .startAfterRecovery !==
                true
            ) {
                return {
                    started:
                        false,

                    reason:
                        "start_after_recovery_disabled"
                };
            }

            this.clearRecoveryRequirement({
                reason:
                    "recovery_completed"
            });

            if (
                this.state.status ===
                MONITORING_STATUS.PAUSED
            ) {
                return this
                    .runDelayedIntegrationAction(
                        integration
                            .configuration
                            .postRecoveryStartDelayMs,
                        () => {
                            return this.resume({
                                runImmediately:
                                    true
                            });
                        }
                    );
            }

            return this
                .runDelayedIntegrationAction(
                    integration
                        .configuration
                        .postRecoveryStartDelayMs,
                    () => {
                        return this.start({
                            force:
                                true,

                            runImmediately:
                                true,

                            initialDelayMs:
                                0,

                            metadata: {
                                source:
                                    "recovery_completed",

                                recoveryPayload:
                                    deepClone(
                                        payload
                                    )
                            }
                        });
                    }
                );
        };

    /* ======================================================================
       SECTION 81
       RECOVERY FAILED HANDLER
       ====================================================================== */

    MonitoringClass.prototype.handleRecoveryFailed =
        async function handleRecoveryFailed(
            payload = {},
            options = {}
        ) {
            this.state.recoveryRequired =
                true;

            this.createAnomaly(
                "recovery_failed",
                "critical",
                "Recovery failed before post recovery stability was confirmed.",
                {
                    payload:
                        deepClone(
                            payload
                        )
                }
            );

            if (
                this.state.status !==
                MONITORING_STATUS.RUNNING
            ) {
                await this.start({
                    force:
                        true,

                    runImmediately:
                        false,

                    initialDelayMs:
                        0
                });
            }

            return this.runMonitoringCheck({
                metadata: {
                    source:
                        "recovery_failed",

                    recoveryPayload:
                        deepClone(
                            payload
                        )
                }
            });
        };

    /* ======================================================================
       SECTION 82
       CLOSURE STARTED HANDLER
       ====================================================================== */

    MonitoringClass.prototype.handleClosureStarted =
        async function handleClosureStarted(
            payload = {},
            options = {}
        ) {
            if (
                this.state.status ===
                MONITORING_STATUS.RUNNING
            ) {
                return this.pause({
                    reason:
                        "closure_started"
                });
            }

            return {
                paused:
                    false,

                reason:
                    "monitoring_not_running"
            };
        };

    /* ======================================================================
       SECTION 83
       CLOSURE COMPLETED HANDLER
       ====================================================================== */

    MonitoringClass.prototype.handleClosureCompleted =
        async function handleClosureCompleted(
            payload = {},
            options = {}
        ) {
            const integration =
                this.ensureIntegrationState();

            if (
                integration
                    .configuration
                    .checkAfterClosure !==
                true
            ) {
                return {
                    checked:
                        false,

                    reason:
                        "closure_check_disabled"
                };
            }

            if (
                this.state.status ===
                MONITORING_STATUS.PAUSED
            ) {
                await this.resume({
                    runImmediately:
                        false
                });
            }

            return this
                .runDelayedIntegrationAction(
                    integration
                        .configuration
                        .closureCheckDelayMs,
                    () => {
                        return this
                            .runScheduledMonitoringCheck({
                                source:
                                    "closure_completed",

                                metadata: {
                                    closurePayload:
                                        deepClone(
                                            payload
                                        )
                                }
                            });
                    }
                );
        };

    /* ======================================================================
       SECTION 84
       CLOSURE FAILED HANDLER
       ====================================================================== */

    MonitoringClass.prototype.handleClosureFailed =
        async function handleClosureFailed(
            payload = {},
            options = {}
        ) {
            this.createAnomaly(
                "closure_failed",
                "high",
                "Recovery closure failed during post recovery processing.",
                {
                    payload:
                        deepClone(
                            payload
                        )
                }
            );

            return this.runMonitoringCheck({
                metadata: {
                    source:
                        "closure_failed"
                }
            });
        };

    /* ======================================================================
       SECTION 85
       REOPENING STARTED HANDLER
       ====================================================================== */

    MonitoringClass.prototype.handleReopeningStarted =
        async function handleReopeningStarted(
            payload = {},
            options = {}
        ) {
            if (
                this.state.status ===
                MONITORING_STATUS.RUNNING
            ) {
                return this.pause({
                    reason:
                        "reopening_started"
                });
            }

            return {
                paused:
                    false,

                reason:
                    "monitoring_not_running"
            };
        };

    /* ======================================================================
       SECTION 86
       REOPENING COMPLETED HANDLER
       ====================================================================== */

    MonitoringClass.prototype.handleReopeningCompleted =
        async function handleReopeningCompleted(
            payload = {},
            options = {}
        ) {
            const integration =
                this.ensureIntegrationState();

            if (
                this.state.status ===
                MONITORING_STATUS.PAUSED
            ) {
                await this.resume({
                    runImmediately:
                        false
                });
            }

            if (
                integration
                    .configuration
                    .checkAfterReopening !==
                true
            ) {
                return {
                    checked:
                        false,

                    reason:
                        "reopening_check_disabled"
                };
            }

            return this
                .runDelayedIntegrationAction(
                    integration
                        .configuration
                        .reopeningCheckDelayMs,
                    () => {
                        return this
                            .runScheduledMonitoringCheck({
                                source:
                                    "reopening_completed",

                                metadata: {
                                    reopeningPayload:
                                        deepClone(
                                            payload
                                        )
                                }
                            });
                    }
                );
        };

    /* ======================================================================
       SECTION 87
       REOPENING FAILED HANDLER
       ====================================================================== */

    MonitoringClass.prototype.handleReopeningFailed =
        async function handleReopeningFailed(
            payload = {},
            options = {}
        ) {
            this.state
                .reopeningRecommended =
                false;

            this.createAnomaly(
                "reopening_failed",
                "critical",
                "Recovery reopening failed.",
                {
                    payload:
                        deepClone(
                            payload
                        )
                }
            );

            return this.requestRecovery({
                force:
                    true,

                reason:
                    "reopening_failed",

                metadata: {
                    reopeningPayload:
                        deepClone(
                            payload
                        )
                }
            });
        };

    /* ======================================================================
       SECTION 88
       CORE STOPPED HANDLER
       ====================================================================== */

    MonitoringClass.prototype.handleCoreStopped =
        async function handleCoreStopped(
            payload = {},
            options = {}
        ) {
            const integration =
                this.ensureIntegrationState();

            if (
                integration
                    .configuration
                    .stopOnCoreStop !==
                true
            ) {
                return {
                    stopped:
                        false,

                    reason:
                        "stop_on_core_stop_disabled"
                };
            }

            return this.stop({
                reason:
                    "core_stopped",

                createSnapshot:
                    true
            });
        };

    /* ======================================================================
       SECTION 89
       CORE RESTARTED HANDLER
       ====================================================================== */

    MonitoringClass.prototype.handleCoreRestarted =
        async function handleCoreRestarted(
            payload = {},
            options = {}
        ) {
            const integration =
                this.ensureIntegrationState();

            if (
                integration
                    .configuration
                    .restartOnCoreRestart !==
                true
            ) {
                return {
                    restarted:
                        false,

                    reason:
                        "restart_on_core_restart_disabled"
                };
            }

            return this.restart({
                force:
                    true,

                runImmediately:
                    true,

                initialDelayMs:
                    integration
                        .configuration
                        .postRecoveryStartDelayMs,

                reset:
                    false
            });
        };

    /* ======================================================================
       SECTION 90
       CYCLE COMPLETED HANDLER
       ====================================================================== */

    MonitoringClass.prototype.handleCycleCompleted =
        async function handleCycleCompleted(
            payload = {},
            options = {}
        ) {
            const integration =
                this.ensureIntegrationState();

            if (
                integration
                    .configuration
                    .checkAfterCycle !==
                true
            ) {
                return {
                    checked:
                        false,

                    reason:
                        "cycle_check_disabled"
                };
            }

            return this.runScheduledMonitoringCheck({
                source:
                    "cycle_completed",

                metadata: {
                    cyclePayload:
                        deepClone(
                            payload
                        )
                }
            });
        };

    /* ======================================================================
       SECTION 91
       FATAL ERROR HANDLER
       ====================================================================== */

    MonitoringClass.prototype.handleFatalError =
        async function handleFatalError(
            payload = {},
            options = {}
        ) {
            const integration =
                this.ensureIntegrationState();

            this.createAnomaly(
                "fatal_core_error",
                "critical",
                "A fatal core error was detected.",
                {
                    payload:
                        deepClone(
                            payload
                        )
                }
            );

            this.state.recoveryRequired =
                true;

            if (
                integration
                    .configuration
                    .checkOnFatalError !==
                true
            ) {
                return {
                    checked:
                        false,

                    reason:
                        "fatal_error_check_disabled"
                };
            }

            return this
                .runDelayedIntegrationAction(
                    integration
                        .configuration
                        .fatalErrorCheckDelayMs,
                    async () => {
                        const check =
                            await this
                                .runMonitoringCheck({
                                    metadata: {
                                        source:
                                            "fatal_error",

                                        fatalPayload:
                                            deepClone(
                                                payload
                                            )
                                    }
                                });

                        const recovery =
                            await this
                                .requestRecovery({
                                    force:
                                        true,

                                    reason:
                                        "fatal_core_error",

                                    metadata: {
                                        fatalPayload:
                                            deepClone(
                                                payload
                                            )
                                    }
                                });

                        return {
                            check,
                            recovery
                        };
                    }
                );
        };

    /* ======================================================================
       SECTION 92
       SUBSCRIBE TO SOURCE EVENT
       ====================================================================== */

    MonitoringClass.prototype.subscribeToSourceEvent =
        function subscribeToSourceEvent(
            sourceName,
            source,
            eventName,
            trigger
        ) {
            if (
                !source ||
                typeof source.on !==
                "function"
            ) {
                return null;
            }

            const handler =
                (payload) => {
                    this.processIntegrationTrigger(
                        trigger,
                        payload,
                        {
                            source:
                                sourceName,

                            eventName
                        }
                    );
                };

            const unsubscribeResult =
                source.on(
                    eventName,
                    handler
                );

            const unsubscribe =
                typeof unsubscribeResult ===
                "function"
                    ? unsubscribeResult
                    : () => {
                        source.off?.(
                            eventName,
                            handler
                        );
                    };

            const hook =
                createHookRecord(
                    `${sourceName}:${eventName}`,
                    sourceName,
                    eventName,
                    handler,
                    unsubscribe
                );

            this.ensureIntegrationState()
                .eventSubscriptions
                .push(hook);

            return hook;
        };

    /* ======================================================================
       SECTION 93
       REGISTER EVENT SUBSCRIPTIONS
       ====================================================================== */

    MonitoringClass.prototype.registerEventSubscriptions =
        function registerEventSubscriptions() {
            const integration =
                this.ensureIntegrationState();

            const sources = {
                core:
                    this.core,

                closure:
                    this.core
                        ?.getRecoveryClosure?.() ||
                    this.core
                        ?.recoveryClosure ||
                    null,

                reopening:
                    this.core
                        ?.getRecoveryReopening?.() ||
                    this.core
                        ?.recoveryReopening ||
                    null
            };

            const subscriptions = [
                [
                    "core",
                    sources.core,
                    "recovery_started",
                    INTEGRATION_TRIGGER
                        .RECOVERY_STARTED
                ],
                [
                    "core",
                    sources.core,
                    "recovery_completed",
                    INTEGRATION_TRIGGER
                        .RECOVERY_COMPLETED
                ],
                [
                    "core",
                    sources.core,
                    "recovery_failed",
                    INTEGRATION_TRIGGER
                        .RECOVERY_FAILED
                ],
                [
                    "core",
                    sources.core,
                    "core_stopped",
                    INTEGRATION_TRIGGER
                        .CORE_STOPPED
                ],
                [
                    "core",
                    sources.core,
                    "core_restarted",
                    INTEGRATION_TRIGGER
                        .CORE_RESTARTED
                ],
                [
                    "core",
                    sources.core,
                    "cycle_completed",
                    INTEGRATION_TRIGGER
                        .CYCLE_COMPLETED
                ],
                [
                    "core",
                    sources.core,
                    "fatal_error",
                    INTEGRATION_TRIGGER
                        .FATAL_ERROR
                ],
                [
                    "closure",
                    sources.closure,
                    "closure_started",
                    INTEGRATION_TRIGGER
                        .CLOSURE_STARTED
                ],
                [
                    "closure",
                    sources.closure,
                    "closure_completed",
                    INTEGRATION_TRIGGER
                        .CLOSURE_COMPLETED
                ],
                [
                    "closure",
                    sources.closure,
                    "closure_failed",
                    INTEGRATION_TRIGGER
                        .CLOSURE_FAILED
                ],
                [
                    "reopening",
                    sources.reopening,
                    "reopening_started",
                    INTEGRATION_TRIGGER
                        .REOPENING_STARTED
                ],
                [
                    "reopening",
                    sources.reopening,
                    "reopening_completed",
                    INTEGRATION_TRIGGER
                        .REOPENING_COMPLETED
                ],
                [
                    "reopening",
                    sources.reopening,
                    "reopening_failed",
                    INTEGRATION_TRIGGER
                        .REOPENING_FAILED
                ]
            ];

            subscriptions.forEach(
                (
                    [
                        sourceName,
                        source,
                        eventName,
                        trigger
                    ]
                ) => {
                    this.subscribeToSourceEvent(
                        sourceName,
                        source,
                        eventName,
                        trigger
                    );
                }
            );

            integration.hooks =
                deepClone(
                    integration
                        .eventSubscriptions
                        .map(
                            (hook) => {
                                return {
                                    id:
                                        hook.id,

                                    name:
                                        hook.name,

                                    source:
                                        hook.source,

                                    eventName:
                                        hook.eventName,

                                    installedAt:
                                        hook.installedAt
                                };
                            }
                        )
                );

            return {
                registered:
                    true,

                count:
                    integration
                        .eventSubscriptions
                        .length
            };
        };

    /* ======================================================================
       SECTION 94
       PATCH CORE METHOD
       ====================================================================== */

    MonitoringClass.prototype.patchIntegrationMethod =
        function patchIntegrationMethod(
            target,
            methodName,
            beforeTrigger = null,
            afterTrigger = null,
            failureTrigger = null
        ) {
            if (
                !target ||
                typeof target[
                    methodName
                ] !==
                "function"
            ) {
                return false;
            }

            const integration =
                this.ensureIntegrationState();

            const existing =
                integration
                    .patchedMethods
                    .find(
                        (record) => {
                            return (
                                record.target ===
                                target &&
                                record.methodName ===
                                methodName
                            );
                        }
                    );

            if (existing) {
                return false;
            }

            const monitoring =
                this;

            const original =
                target[
                    methodName
                ];

            target[
                methodName
            ] =
                async function patchedIntegrationMethod(
                    ...args
                ) {
                    if (beforeTrigger) {
                        await monitoring
                            .processIntegrationTrigger(
                                beforeTrigger,
                                {
                                    methodName,
                                    arguments:
                                        deepClone(
                                            args
                                        )
                                }
                            );
                    }

                    try {
                        const result =
                            await original
                                .apply(
                                    this,
                                    args
                                );

                        if (afterTrigger) {
                            await monitoring
                                .processIntegrationTrigger(
                                    afterTrigger,
                                    {
                                        methodName,
                                        result:
                                            deepClone(
                                                result
                                            )
                                    }
                                );
                        }

                        return result;
                    } catch (error) {
                        if (failureTrigger) {
                            await monitoring
                                .processIntegrationTrigger(
                                    failureTrigger,
                                    {
                                        methodName,
                                        error:
                                            normalizeMonitoringError(
                                                error
                                            )
                                    }
                                );
                        }

                        throw error;
                    }
                };

            integration
                .patchedMethods
                .push({
                    target,

                    methodName,

                    original,

                    installedAt:
                        Date.now()
                });

            return true;
        };

    /* ======================================================================
       SECTION 95
       REGISTER METHOD HOOKS
       ====================================================================== */

    MonitoringClass.prototype.registerMethodHooks =
        function registerMethodHooks() {
            const closure =
                this.core
                    ?.getRecoveryClosure?.() ||
                this.core
                    ?.recoveryClosure ||
                null;

            const reopening =
                this.core
                    ?.getRecoveryReopening?.() ||
                this.core
                    ?.recoveryReopening ||
                null;

            const results = {
                recovery:
                    false,

                closure:
                    false,

                reopening:
                    false,

                stop:
                    false,

                restart:
                    false,

                cycle:
                    false
            };

            if (
                typeof this.core
                    ?.scheduleRecovery ===
                "function"
            ) {
                results.recovery =
                    this.patchIntegrationMethod(
                        this.core,
                        "scheduleRecovery",
                        INTEGRATION_TRIGGER
                            .RECOVERY_STARTED,
                        INTEGRATION_TRIGGER
                            .RECOVERY_COMPLETED,
                        INTEGRATION_TRIGGER
                            .RECOVERY_FAILED
                    );
            }

            if (
                closure &&
                typeof closure
                    .executeClosure ===
                "function"
            ) {
                results.closure =
                    this.patchIntegrationMethod(
                        closure,
                        "executeClosure",
                        INTEGRATION_TRIGGER
                            .CLOSURE_STARTED,
                        INTEGRATION_TRIGGER
                            .CLOSURE_COMPLETED,
                        INTEGRATION_TRIGGER
                            .CLOSURE_FAILED
                    );
            }

            if (
                reopening &&
                typeof reopening
                    .executeReopening ===
                "function"
            ) {
                results.reopening =
                    this.patchIntegrationMethod(
                        reopening,
                        "executeReopening",
                        INTEGRATION_TRIGGER
                            .REOPENING_STARTED,
                        INTEGRATION_TRIGGER
                            .REOPENING_COMPLETED,
                        INTEGRATION_TRIGGER
                            .REOPENING_FAILED
                    );
            }

            if (
                typeof this.core
                    ?.stop ===
                "function"
            ) {
                results.stop =
                    this.patchIntegrationMethod(
                        this.core,
                        "stop",
                        null,
                        INTEGRATION_TRIGGER
                            .CORE_STOPPED,
                        null
                    );
            }

            if (
                typeof this.core
                    ?.restart ===
                "function"
            ) {
                results.restart =
                    this.patchIntegrationMethod(
                        this.core,
                        "restart",
                        null,
                        INTEGRATION_TRIGGER
                            .CORE_RESTARTED,
                        INTEGRATION_TRIGGER
                            .FATAL_ERROR
                    );
            }

            if (
                typeof this.core
                    ?.runCycle ===
                "function"
            ) {
                results.cycle =
                    this.patchIntegrationMethod(
                        this.core,
                        "runCycle",
                        null,
                        INTEGRATION_TRIGGER
                            .CYCLE_COMPLETED,
                        INTEGRATION_TRIGGER
                            .FATAL_ERROR
                    );
            }

            return results;
        };

    /* ======================================================================
       SECTION 96
       UNREGISTER EVENT SUBSCRIPTIONS
       ====================================================================== */

    MonitoringClass.prototype.unregisterEventSubscriptions =
        function unregisterEventSubscriptions() {
            const integration =
                this.ensureIntegrationState();

            const subscriptions =
                integration
                    .eventSubscriptions
                    .slice();

            subscriptions.forEach(
                (subscription) => {
                    try {
                        subscription
                            .unsubscribe?.();
                    } catch (error) {
                        global.console?.error?.(
                            "[PostRecoveryMonitoringV32] Event unsubscription failed:",
                            error
                        );
                    }
                }
            );

            integration
                .eventSubscriptions =
                [];

            integration.hooks =
                [];

            return {
                unregistered:
                    true,

                count:
                    subscriptions.length
            };
        };

    /* ======================================================================
       SECTION 97
       UNREGISTER METHOD HOOKS
       ====================================================================== */

    MonitoringClass.prototype.unregisterMethodHooks =
        function unregisterMethodHooks() {
            const integration =
                this.ensureIntegrationState();

            const patched =
                integration
                    .patchedMethods
                    .slice()
                    .reverse();

            let restoredCount =
                0;

            patched.forEach(
                (record) => {
                    if (
                        record.target &&
                        record.methodName &&
                        typeof record.original ===
                        "function"
                    ) {
                        record.target[
                            record.methodName
                        ] =
                            record.original;

                        restoredCount +=
                            1;
                    }
                }
            );

            integration
                .patchedMethods =
                [];

            return {
                restored:
                    true,

                count:
                    restoredCount
            };
        };

    /* ======================================================================
       SECTION 98
       INSTALL AUTOMATIC INTEGRATION
       ====================================================================== */

    MonitoringClass.prototype.installAutomaticIntegration =
        function installAutomaticIntegration(
            options = {}
        ) {
            const integration =
                this.ensureIntegrationState();

            if (
                integration.installed
            ) {
                this.configureIntegration(
                    options
                );

                return {
                    installed:
                        false,

                    reason:
                        "already_installed",

                    status:
                        this
                            .getIntegrationStatus()
                };
            }

            integration.status =
                INTEGRATION_STATUS
                    .INSTALLING;

            try {
                this.configureIntegration(
                    options
                );

                const events =
                    this
                        .registerEventSubscriptions();

                const methods =
                    this
                        .registerMethodHooks();

                integration.installed =
                    true;

                integration.status =
                    INTEGRATION_STATUS
                        .INSTALLED;

                integration
                    .installationCount +=
                    1;

                integration.lastError =
                    null;

                this.synchronizeCoreState();

                return {
                    installed:
                        true,

                    events,

                    methods,

                    status:
                        this
                            .getIntegrationStatus()
                };
            } catch (error) {
                const normalized =
                    normalizeMonitoringError(
                        error
                    );

                integration.status =
                    INTEGRATION_STATUS
                        .FAILED;

                integration.lastError =
                    normalized;

                return {
                    installed:
                        false,

                    error:
                        normalized
                };
            }
        };

    /* ======================================================================
       SECTION 99
       UNINSTALL AUTOMATIC INTEGRATION
       ====================================================================== */

    MonitoringClass.prototype.uninstallAutomaticIntegration =
        function uninstallAutomaticIntegration() {
            const integration =
                this.ensureIntegrationState();

            integration.status =
                INTEGRATION_STATUS
                    .UNINSTALLING;

            const events =
                this
                    .unregisterEventSubscriptions();

            const methods =
                this
                    .unregisterMethodHooks();

            integration.installed =
                false;

            integration.status =
                INTEGRATION_STATUS
                    .UNINSTALLED;

            integration
                .uninstallationCount +=
                1;

            this.synchronizeCoreState();

            return {
                uninstalled:
                    true,

                events,

                methods,

                status:
                    this
                        .getIntegrationStatus()
            };
        };

    /* ======================================================================
       SECTION 100
       GET INTEGRATION STATUS
       ====================================================================== */

    MonitoringClass.prototype.getIntegrationStatus =
        function getIntegrationStatus() {
            const integration =
                this.ensureIntegrationState();

            return {
                status:
                    integration.status,

                installed:
                    integration.installed,

                enabled:
                    integration.enabled,

                eventSubscriptionCount:
                    integration
                        .eventSubscriptions
                        .length,

                patchedMethodCount:
                    integration
                        .patchedMethods
                        .length,

                lastTrigger:
                    integration.lastTrigger,

                lastTriggeredAt:
                    integration
                        .lastTriggeredAt,

                triggerCount:
                    integration.triggerCount,

                failedTriggerCount:
                    integration
                        .failedTriggerCount,

                installationCount:
                    integration
                        .installationCount,

                uninstallationCount:
                    integration
                        .uninstallationCount,

                configuration:
                    deepClone(
                        integration
                            .configuration
                    ),

                lastError:
                    integration.lastError
                        ? deepClone(
                            integration
                                .lastError
                        )
                        : null
            };
        };

    /* ======================================================================
       SECTION 101
       ENABLE INTEGRATION
       ====================================================================== */

    MonitoringClass.prototype.enableIntegration =
        function enableIntegration() {
            const integration =
                this.ensureIntegrationState();

            integration.enabled =
                true;

            this.synchronizeCoreState();

            return this
                .getIntegrationStatus();
        };

    /* ======================================================================
       SECTION 102
       DISABLE INTEGRATION
       ====================================================================== */

    MonitoringClass.prototype.disableIntegration =
        function disableIntegration() {
            const integration =
                this.ensureIntegrationState();

            integration.enabled =
                false;

            this.synchronizeCoreState();

            return this
                .getIntegrationStatus();
        };

    /* ======================================================================
       SECTION 103
       WRAP DESTROY WITH INTEGRATION CLEANUP
       ====================================================================== */

    const originalDestroy =
        MonitoringClass.prototype.destroy;

    MonitoringClass.prototype.destroy =
        async function destroyWithIntegrationCleanup(
            options = {}
        ) {
            if (
                typeof this
                    .uninstallAutomaticIntegration ===
                "function"
            ) {
                this
                    .uninstallAutomaticIntegration();
            }

            return originalDestroy
                .call(
                    this,
                    options
                );
        };

    /* ======================================================================
       SECTION 104
       API EXTENSIONS
       ====================================================================== */

    const MonitoringApi =
        global
            .PostRecoveryMonitoringV32API ||
        global
            .RainArrivalPostRecoveryMonitoringV32API ||
        global
            .RainGuardPostRecoveryMonitoringV32API;

    if (MonitoringApi) {
        MonitoringApi.installIntegration =
            function installIntegration(
                options = {}
            ) {
                return this
                    .requireInstance()
                    .installAutomaticIntegration(
                        options
                    );
            };

        MonitoringApi.uninstallIntegration =
            function uninstallIntegration() {
                return this
                    .requireInstance()
                    .uninstallAutomaticIntegration();
            };

        MonitoringApi.enableIntegration =
            function enableIntegration() {
                return this
                    .requireInstance()
                    .enableIntegration();
            };

        MonitoringApi.disableIntegration =
            function disableIntegration() {
                return this
                    .requireInstance()
                    .disableIntegration();
            };

        MonitoringApi.getIntegrationStatus =
            function getIntegrationStatus() {
                return this
                    .requireInstance()
                    .getIntegrationStatus();
            };

        MonitoringApi.trigger =
            function trigger(
                trigger,
                payload = {},
                options = {}
            ) {
                return this
                    .requireInstance()
                    .processIntegrationTrigger(
                        trigger,
                        payload,
                        options
                    );
            };
    }

    /* ======================================================================
       SECTION 105
       COMPATIBILITY ALIASES
       ====================================================================== */

    MonitoringClass.prototype.installHooks =
        MonitoringClass.prototype
            .installAutomaticIntegration;

    MonitoringClass.prototype.uninstallHooks =
        MonitoringClass.prototype
            .uninstallAutomaticIntegration;

    MonitoringClass.prototype.registerLifecycleHooks =
        MonitoringClass.prototype
            .installAutomaticIntegration;

    MonitoringClass.prototype.unregisterLifecycleHooks =
        MonitoringClass.prototype
            .uninstallAutomaticIntegration;

    MonitoringClass.prototype.getHooksStatus =
        MonitoringClass.prototype
            .getIntegrationStatus;

    /* ======================================================================
       SECTION 106
       PART 4 EXPORT
       ====================================================================== */

    global.PostRecoveryMonitoringV32Part4 = {
        INTEGRATION_STATUS,
        INTEGRATION_TRIGGER,
        DEFAULT_POST_RECOVERY_START_DELAY_MS,
        DEFAULT_CLOSURE_CHECK_DELAY_MS,
        DEFAULT_REOPENING_CHECK_DELAY_MS,
        DEFAULT_FATAL_ERROR_CHECK_DELAY_MS,
        createIntegrationHookId,
        normalizeTrigger,
        resolveEventNames,
        createHookRecord
    };

})(window);

/* ==========================================================================
   RainGuard AI
   Long Horizon Forecast Engine V32

   Post Recovery Monitoring Engine V32

   PART 5
   Monitoring Reports + Analytics + Statistics +
   Historical Trends + Export Utilities
   ========================================================================== */

(function extendPostRecoveryMonitoringV32Part5(global) {
    "use strict";

    /* ======================================================================
       SECTION 107
       DEPENDENCY RESOLUTION
       ====================================================================== */

    const MonitoringClass =
        global.PostRecoveryMonitoringV32;

    const MonitoringConstants =
        global.PostRecoveryMonitoringV32Constants;

    const MonitoringUtils =
        global.PostRecoveryMonitoringV32Utils;

    const MonitoringPart2 =
        global.PostRecoveryMonitoringV32Part2;

    const MonitoringPart3 =
        global.PostRecoveryMonitoringV32Part3;

    const MonitoringPart4 =
        global.PostRecoveryMonitoringV32Part4;

    if (
        typeof MonitoringClass !==
        "function" ||
        !MonitoringConstants ||
        !MonitoringUtils ||
        !MonitoringPart2 ||
        !MonitoringPart3 ||
        !MonitoringPart4
    ) {
        throw new Error(
            "PostRecoveryMonitoringV32 Parts 1 to 4 must be loaded before Part 5."
        );
    }

    const {
        MONITORING_STATUS,
        RECOVERY_HEALTH_STATUS,
        ANOMALY_SEVERITY
    } = MonitoringConstants;

    const {
        toFiniteNumber,
        clamp,
        safeObject,
        safeArray,
        deepClone,
        calculateAverage,
        calculateRatio
    } = MonitoringUtils;

    const {
        CHECK_RESULT_STATUS
    } = MonitoringPart2;

    /* ======================================================================
       SECTION 108
       REPORT CONSTANTS
       ====================================================================== */

    const REPORT_TYPE =
        Object.freeze({
            SUMMARY:
                "summary",

            HEALTH_TIMELINE:
                "health_timeline",

            STATISTICS:
                "statistics",

            CHECK_ANALYTICS:
                "check_analytics",

            ANOMALY_ANALYTICS:
                "anomaly_analytics",

            RECOVERY_ANALYTICS:
                "recovery_analytics",

            REOPENING_ANALYTICS:
                "reopening_analytics",

            SNAPSHOT:
                "snapshot",

            COMPLETE:
                "complete",

            DASHBOARD:
                "dashboard",

            HISTORICAL_TREND:
                "historical_trend"
        });

    const TREND_DIRECTION =
        Object.freeze({
            STRONGLY_IMPROVING:
                "strongly_improving",

            IMPROVING:
                "improving",

            STABLE:
                "stable",

            DECLINING:
                "declining",

            STRONGLY_DECLINING:
                "strongly_declining",

            UNKNOWN:
                "unknown"
        });

    const REPORT_FORMAT =
        Object.freeze({
            OBJECT:
                "object",

            JSON:
                "json",

            PRETTY_JSON:
                "pretty_json"
        });

    const DEFAULT_REPORT_HISTORY_LIMIT =
        100;

    const DEFAULT_TIMELINE_LIMIT =
        100;

    const DEFAULT_TREND_WINDOW =
        10;

    const DEFAULT_EXPORT_SPACE =
        2;

    /* ======================================================================
       SECTION 109
       REPORT HELPERS
       ====================================================================== */

    function roundNumber(
        value,
        precision = 4
    ) {
        const number =
            toFiniteNumber(
                value,
                0
            );

        const factor =
            Math.pow(
                10,
                Math.max(
                    0,
                    Math.round(
                        precision
                    )
                )
            );

        return (
            Math.round(
                number *
                factor
            ) /
            factor
        );
    }

    function calculatePercentage(
        numerator,
        denominator,
        precision = 2
    ) {
        return roundNumber(
            calculateRatio(
                numerator,
                denominator
            ) *
            100,
            precision
        );
    }

    function getDurationLabel(
        durationMs
    ) {
        const milliseconds =
            Math.max(
                0,
                toFiniteNumber(
                    durationMs,
                    0
                )
            );

        const totalSeconds =
            Math.floor(
                milliseconds /
                1000
            );

        const days =
            Math.floor(
                totalSeconds /
                86400
            );

        const hours =
            Math.floor(
                (
                    totalSeconds %
                    86400
                ) /
                3600
            );

        const minutes =
            Math.floor(
                (
                    totalSeconds %
                    3600
                ) /
                60
            );

        const seconds =
            totalSeconds %
            60;

        return {
            milliseconds,

            days,

            hours,

            minutes,

            seconds,

            text:
                [
                    days
                        ? `${days}d`
                        : null,

                    hours
                        ? `${hours}h`
                        : null,

                    minutes
                        ? `${minutes}m`
                        : null,

                    `${seconds}s`
                ]
                    .filter(Boolean)
                    .join(" ")
        };
    }

    function groupBy(
        items,
        resolver
    ) {
        const result = {};

        safeArray(items)
            .forEach(
                (item) => {
                    const key =
                        String(
                            resolver(
                                item
                            ) ??
                            "unknown"
                        );

                    if (
                        !result[key]
                    ) {
                        result[key] = [];
                    }

                    result[key]
                        .push(
                            item
                        );
                }
            );

        return result;
    }

    function countBy(
        items,
        resolver
    ) {
        const groups =
            groupBy(
                items,
                resolver
            );

        return Object.fromEntries(
            Object.entries(
                groups
            )
                .map(
                    (
                        [
                            key,
                            values
                        ]
                    ) => {
                        return [
                            key,
                            values.length
                        ];
                    }
                )
        );
    }

    function calculateLinearSlope(
        values
    ) {
        const numbers =
            safeArray(values)
                .map(
                    Number
                )
                .filter(
                    Number.isFinite
                );

        const count =
            numbers.length;

        if (
            count <
            2
        ) {
            return 0;
        }

        let sumX = 0;
        let sumY = 0;
        let sumXY = 0;
        let sumXX = 0;

        numbers.forEach(
            (
                value,
                index
            ) => {
                sumX +=
                    index;

                sumY +=
                    value;

                sumXY +=
                    index *
                    value;

                sumXX +=
                    index *
                    index;
            }
        );

        const denominator =
            (
                count *
                sumXX
            ) -
            (
                sumX *
                sumX
            );

        if (
            denominator ===
            0
        ) {
            return 0;
        }

        return (
            (
                count *
                sumXY
            ) -
            (
                sumX *
                sumY
            )
        ) /
        denominator;
    }

    function classifyTrendDirection(
        slope
    ) {
        const normalizedSlope =
            toFiniteNumber(
                slope,
                0
            );

        if (
            normalizedSlope >=
            0.04
        ) {
            return TREND_DIRECTION
                .STRONGLY_IMPROVING;
        }

        if (
            normalizedSlope >=
            0.01
        ) {
            return TREND_DIRECTION
                .IMPROVING;
        }

        if (
            normalizedSlope <=
            -0.04
        ) {
            return TREND_DIRECTION
                .STRONGLY_DECLINING;
        }

        if (
            normalizedSlope <=
            -0.01
        ) {
            return TREND_DIRECTION
                .DECLINING;
        }

        return TREND_DIRECTION
            .STABLE;
    }

    function sanitizeForExport(
        value,
        seen =
            new WeakSet()
    ) {
        if (
            value === null ||
            value === undefined
        ) {
            return value;
        }

        if (
            typeof value ===
            "function"
        ) {
            return undefined;
        }

        if (
            typeof value !==
            "object"
        ) {
            return value;
        }

        if (
            seen.has(
                value
            )
        ) {
            return "[Circular]";
        }

        seen.add(
            value
        );

        if (
            Array.isArray(
                value
            )
        ) {
            return value
                .map(
                    (item) => {
                        return sanitizeForExport(
                            item,
                            seen
                        );
                    }
                )
                .filter(
                    (item) => {
                        return item !==
                            undefined;
                    }
                );
        }

        const output = {};

        Object.entries(
            value
        )
            .forEach(
                (
                    [
                        key,
                        item
                    ]
                ) => {
                    if (
                        [
                            "timer",
                            "initialTimer",
                            "handler",
                            "unsubscribe",
                            "target",
                            "original"
                        ].includes(
                            key
                        )
                    ) {
                        return;
                    }

                    const sanitized =
                        sanitizeForExport(
                            item,
                            seen
                        );

                    if (
                        sanitized !==
                        undefined
                    ) {
                        output[key] =
                            sanitized;
                    }
                }
            );

        return output;
    }

    /* ======================================================================
       SECTION 110
       MONITORING SUMMARY BUILDER
       ====================================================================== */

    MonitoringClass.prototype.buildMonitoringSummary =
        function buildMonitoringSummary(
            options = {}
        ) {
            const safeOptions =
                safeObject(options);

            this.updateMonitoringDuration();

            const lifecycle =
                typeof this
                    .getLifecycleStatus ===
                "function"
                    ? this
                        .getLifecycleStatus()
                    : null;

            const stability =
                typeof this
                    .getStabilityStatus ===
                "function"
                    ? this
                        .getStabilityStatus()
                    : null;

            const unresolvedAnomalies =
                safeArray(
                    this.state
                        .anomalies
                )
                    .filter(
                        (anomaly) => {
                            return (
                                anomaly.resolved !==
                                true
                            );
                        }
                    );

            const unresolvedCritical =
                unresolvedAnomalies
                    .filter(
                        (anomaly) => {
                            return (
                                anomaly.severity ===
                                ANOMALY_SEVERITY
                                    .CRITICAL
                            );
                        }
                    );

            const summary = {
                reportType:
                    REPORT_TYPE.SUMMARY,

                monitoringId:
                    this.state.id,

                version:
                    this.state
                        .metadata
                        ?.version ||
                    "32.1.0",

                generatedAt:
                    Date.now(),

                status:
                    this.state.status,

                active:
                    this.state.status ===
                    MONITORING_STATUS.RUNNING,

                health: {
                    status:
                        this.state
                            .healthStatus,

                    score:
                        roundNumber(
                            this.state
                                .healthScore,
                            4
                        ),

                    percentage:
                        roundNumber(
                            this.state
                                .healthScore *
                            100,
                            2
                        ),

                    previousStatus:
                        this.state
                            .previousHealthStatus,

                    previousScore:
                        this.state
                            .previousHealthScore
                            == null
                            ? null
                            : roundNumber(
                                this.state
                                    .previousHealthScore,
                                4
                            )
                },

                duration:
                    getDurationLabel(
                        this.state
                            .monitoringDurationMs
                    ),

                checks: {
                    total:
                        this.state
                            .totalChecks,

                    successful:
                        this.state
                            .successfulChecks,

                    failed:
                        this.state
                            .failedChecks,

                    skipped:
                        this.state
                            .skippedChecks,

                    successRate:
                        calculatePercentage(
                            this.state
                                .successfulChecks,
                            this.state
                                .totalChecks
                        ),

                    failureRate:
                        calculatePercentage(
                            this.state
                                .failedChecks,
                            this.state
                                .totalChecks
                        ),

                    consecutiveSuccessful:
                        this.state
                            .consecutiveSuccessfulChecks,

                    consecutiveFailed:
                        this.state
                            .consecutiveFailedChecks,

                    lastCheckAt:
                        this.state
                            .lastCheckAt,

                    nextCheckAt:
                        this.state
                            .nextCheckAt
                },

                stability: {
                    confirmed:
                        this.state
                            .stabilityConfirmed,

                    stableSince:
                        this.state
                            .stableSince,

                    status:
                        stability
                            ?.status ||
                        null,

                    confirmationCount:
                        stability
                            ?.confirmationCount ||
                        0
                },

                recovery: {
                    required:
                        this.state
                            .recoveryRequired,

                    requestCount:
                        lifecycle
                            ?.recoveryRequestCount ||
                        0,

                    escalationLevel:
                        lifecycle
                            ?.escalationLevel ||
                        null,

                    lastRequestAt:
                        lifecycle
                            ?.lastRecoveryRequestAt ||
                        null
                },

                reopening: {
                    recommended:
                        this.state
                            .reopeningRecommended,

                    recommendation:
                        lifecycle
                            ?.reopeningRecommendation ||
                        null,

                    recommendationCount:
                        lifecycle
                            ?.reopeningRecommendationCount ||
                        0,

                    lastRecommendationAt:
                        lifecycle
                            ?.lastReopeningRecommendationAt ||
                        null
                },

                anomalies: {
                    total:
                        this.state
                            .totalAnomalies,

                    stored:
                        this.state
                            .anomalies
                            .length,

                    unresolved:
                        unresolvedAnomalies
                            .length,

                    critical:
                        this.state
                            .criticalAnomalies,

                    unresolvedCritical:
                        unresolvedCritical
                            .length
                },

                snapshots: {
                    count:
                        this.state
                            .snapshots
                            .length
                },

                error:
                    this.state.lastError
                        ? deepClone(
                            this.state
                                .lastError
                        )
                        : null
            };

            if (
                safeOptions.includeConfiguration ===
                true
            ) {
                summary.configuration =
                    this.getConfiguration();
            }

            return summary;
        };

    /* ======================================================================
       SECTION 111
       HEALTH TIMELINE BUILDER
       ====================================================================== */

    MonitoringClass.prototype.buildHealthTimeline =
        function buildHealthTimeline(
            options = {}
        ) {
            const safeOptions =
                safeObject(options);

            const limit =
                Math.max(
                    1,
                    Math.round(
                        toFiniteNumber(
                            safeOptions.limit,
                            DEFAULT_TIMELINE_LIMIT
                        )
                    )
                );

            const history =
                safeArray(
                    this.state
                        .checkHistory
                )
                    .slice(
                        -limit
                    );

            const timeline =
                history.map(
                    (
                        check,
                        index
                    ) => {
                        const previous =
                            history[
                                index -
                                1
                            ];

                        const change =
                            previous
                                ? toFiniteNumber(
                                    check.healthScore,
                                    0
                                ) -
                                toFiniteNumber(
                                    previous
                                        .healthScore,
                                    0
                                )
                                : 0;

                        return {
                            checkId:
                                check.id,

                            timestamp:
                                check.completedAt ||
                                check.startedAt ||
                                null,

                            status:
                                check.status,

                            healthStatus:
                                check.healthStatus,

                            healthScore:
                                roundNumber(
                                    check.healthScore,
                                    4
                                ),

                            healthPercentage:
                                roundNumber(
                                    toFiniteNumber(
                                        check.healthScore,
                                        0
                                    ) *
                                    100,
                                    2
                                ),

                            change:
                                roundNumber(
                                    change,
                                    4
                                ),

                            durationMs:
                                toFiniteNumber(
                                    check.durationMs,
                                    0
                                ),

                            anomalyCount:
                                safeArray(
                                    check.anomalies
                                ).length,

                            resultCount:
                                safeArray(
                                    check.results
                                ).length
                        };
                    }
                );

            const scores =
                timeline.map(
                    (item) => {
                        return item
                            .healthScore;
                    }
                );

            const slope =
                calculateLinearSlope(
                    scores
                );

            return {
                reportType:
                    REPORT_TYPE
                        .HEALTH_TIMELINE,

                monitoringId:
                    this.state.id,

                generatedAt:
                    Date.now(),

                count:
                    timeline.length,

                trend: {
                    slope:
                        roundNumber(
                            slope,
                            6
                        ),

                    direction:
                        timeline.length >
                        1
                            ? classifyTrendDirection(
                                slope
                            )
                            : TREND_DIRECTION
                                .UNKNOWN,

                    averageScore:
                        roundNumber(
                            calculateAverage(
                                scores
                            ),
                            4
                        ),

                    minimumScore:
                        scores.length
                            ? roundNumber(
                                Math.min(
                                    ...scores
                                ),
                                4
                            )
                            : 0,

                    maximumScore:
                        scores.length
                            ? roundNumber(
                                Math.max(
                                    ...scores
                                ),
                                4
                            )
                            : 0
                },

                timeline
            };
        };

    /* ======================================================================
       SECTION 112
       MONITORING STATISTICS
       ====================================================================== */

    MonitoringClass.prototype.buildMonitoringStatistics =
        function buildMonitoringStatistics(
            options = {}
        ) {
            const safeOptions =
                safeObject(options);

            const limit =
                Math.max(
                    1,
                    Math.round(
                        toFiniteNumber(
                            safeOptions.limit,
                            DEFAULT_REPORT_HISTORY_LIMIT
                        )
                    )
                );

            const history =
                safeArray(
                    this.state
                        .checkHistory
                )
                    .slice(
                        -limit
                    );

            const durations =
                history
                    .map(
                        (check) => {
                            return toFiniteNumber(
                                check.durationMs,
                                0
                            );
                        }
                    );

            const healthScores =
                history
                    .map(
                        (check) => {
                            return toFiniteNumber(
                                check.healthScore,
                                0
                            );
                        }
                    );

            const resultCounts =
                history
                    .map(
                        (check) => {
                            return safeArray(
                                check.results
                            ).length;
                        }
                    );

            const anomaliesPerCheck =
                history
                    .map(
                        (check) => {
                            return safeArray(
                                check.anomalies
                            ).length;
                        }
                    );

            return {
                reportType:
                    REPORT_TYPE.STATISTICS,

                monitoringId:
                    this.state.id,

                generatedAt:
                    Date.now(),

                sampleSize:
                    history.length,

                checks: {
                    total:
                        this.state
                            .totalChecks,

                    successful:
                        this.state
                            .successfulChecks,

                    failed:
                        this.state
                            .failedChecks,

                    skipped:
                        this.state
                            .skippedChecks,

                    successRate:
                        calculatePercentage(
                            this.state
                                .successfulChecks,
                            this.state
                                .totalChecks
                        ),

                    failureRate:
                        calculatePercentage(
                            this.state
                                .failedChecks,
                            this.state
                                .totalChecks
                        )
                },

                health: {
                    current:
                        roundNumber(
                            this.state
                                .healthScore,
                            4
                        ),

                    average:
                        roundNumber(
                            calculateAverage(
                                healthScores
                            ),
                            4
                        ),

                    minimum:
                        healthScores.length
                            ? roundNumber(
                                Math.min(
                                    ...healthScores
                                ),
                                4
                            )
                            : 0,

                    maximum:
                        healthScores.length
                            ? roundNumber(
                                Math.max(
                                    ...healthScores
                                ),
                                4
                            )
                            : 0
                },

                performance: {
                    averageCheckDurationMs:
                        roundNumber(
                            calculateAverage(
                                durations
                            ),
                            2
                        ),

                    minimumCheckDurationMs:
                        durations.length
                            ? Math.min(
                                ...durations
                            )
                            : 0,

                    maximumCheckDurationMs:
                        durations.length
                            ? Math.max(
                                ...durations
                            )
                            : 0,

                    averageResultsPerCheck:
                        roundNumber(
                            calculateAverage(
                                resultCounts
                            ),
                            2
                        ),

                    averageAnomaliesPerCheck:
                        roundNumber(
                            calculateAverage(
                                anomaliesPerCheck
                            ),
                            2
                        )
                },

                historyStatusCounts:
                    countBy(
                        history,
                        (check) => {
                            return check.status;
                        }
                    ),

                healthStatusCounts:
                    countBy(
                        history,
                        (check) => {
                            return check
                                .healthStatus;
                        }
                    )
            };
        };

    /* ======================================================================
       SECTION 113
       CHECK SUCCESS AND FAILURE ANALYTICS
       ====================================================================== */

    MonitoringClass.prototype.buildCheckAnalytics =
        function buildCheckAnalytics(
            options = {}
        ) {
            const safeOptions =
                safeObject(options);

            const limit =
                Math.max(
                    1,
                    Math.round(
                        toFiniteNumber(
                            safeOptions.limit,
                            DEFAULT_REPORT_HISTORY_LIMIT
                        )
                    )
                );

            const history =
                safeArray(
                    this.state
                        .checkHistory
                )
                    .slice(
                        -limit
                    );

            const resultEntries =
                history.flatMap(
                    (check) => {
                        return safeArray(
                            check.results
                        )
                            .map(
                                (result) => {
                                    return {
                                        checkId:
                                            check.id,

                                        checkCompletedAt:
                                            check.completedAt,

                                        ...deepClone(
                                            result
                                        )
                                    };
                                }
                            );
                    }
                );

            const byType =
                groupBy(
                    resultEntries,
                    (result) => {
                        return result.type;
                    }
                );

            const checkTypes = {};

            Object.entries(
                byType
            )
                .forEach(
                    (
                        [
                            type,
                            results
                        ]
                    ) => {
                        const passed =
                            results.filter(
                                (result) => {
                                    return (
                                        result.status ===
                                        CHECK_RESULT_STATUS
                                            .PASSED
                                    );
                                }
                            ).length;

                        const warnings =
                            results.filter(
                                (result) => {
                                    return (
                                        result.status ===
                                        CHECK_RESULT_STATUS
                                            .WARNING
                                    );
                                }
                            ).length;

                        const failed =
                            results.filter(
                                (result) => {
                                    return [
                                        CHECK_RESULT_STATUS
                                            .FAILED,

                                        CHECK_RESULT_STATUS
                                            .TIMEOUT
                                    ].includes(
                                        result.status
                                    );
                                }
                            ).length;

                        const skipped =
                            results.filter(
                                (result) => {
                                    return (
                                        result.status ===
                                        CHECK_RESULT_STATUS
                                            .SKIPPED
                                    );
                                }
                            ).length;

                        const scores =
                            results.map(
                                (result) => {
                                    return toFiniteNumber(
                                        result.score,
                                        0
                                    );
                                }
                            );

                        const durations =
                            results.map(
                                (result) => {
                                    return toFiniteNumber(
                                        result.durationMs,
                                        0
                                    );
                                }
                            );

                        checkTypes[type] = {
                            executions:
                                results.length,

                            passed,

                            warnings,

                            failed,

                            skipped,

                            passRate:
                                calculatePercentage(
                                    passed,
                                    results.length
                                ),

                            failureRate:
                                calculatePercentage(
                                    failed,
                                    results.length
                                ),

                            averageScore:
                                roundNumber(
                                    calculateAverage(
                                        scores
                                    ),
                                    4
                                ),

                            averageDurationMs:
                                roundNumber(
                                    calculateAverage(
                                        durations
                                    ),
                                    2
                                ),

                            lastStatus:
                                results[
                                    results.length -
                                    1
                                ]?.status ||
                                null,

                            lastScore:
                                results[
                                    results.length -
                                    1
                                ]?.score ??
                                null
                        };
                    }
                );

            return {
                reportType:
                    REPORT_TYPE
                        .CHECK_ANALYTICS,

                monitoringId:
                    this.state.id,

                generatedAt:
                    Date.now(),

                historySampleSize:
                    history.length,

                resultCount:
                    resultEntries.length,

                statusCounts:
                    countBy(
                        resultEntries,
                        (result) => {
                            return result.status;
                        }
                    ),

                checkTypes
            };
        };

    /* ======================================================================
       SECTION 114
       ANOMALY ANALYTICS
       ====================================================================== */

    MonitoringClass.prototype.buildAnomalyAnalytics =
        function buildAnomalyAnalytics(
            options = {}
        ) {
            const safeOptions =
                safeObject(options);

            const anomalies =
                safeArray(
                    this.state
                        .anomalies
                )
                    .filter(
                        (anomaly) => {
                            if (
                                safeOptions
                                    .unresolvedOnly ===
                                true
                            ) {
                                return (
                                    anomaly.resolved !==
                                    true
                                );
                            }

                            return true;
                        }
                    );

            const resolved =
                anomalies.filter(
                    (anomaly) => {
                        return (
                            anomaly.resolved ===
                            true
                        );
                    }
                );

            const unresolved =
                anomalies.filter(
                    (anomaly) => {
                        return (
                            anomaly.resolved !==
                            true
                        );
                    }
                );

            const acknowledged =
                anomalies.filter(
                    (anomaly) => {
                        return (
                            anomaly.acknowledged ===
                            true
                        );
                    }
                );

            const resolutionDurations =
                resolved
                    .map(
                        (anomaly) => {
                            return Math.max(
                                0,
                                toFiniteNumber(
                                    anomaly
                                        .resolvedAt,
                                    0
                                ) -
                                toFiniteNumber(
                                    anomaly
                                        .createdAt,
                                    0
                                )
                            );
                        }
                    );

            const latest =
                anomalies
                    .slice()
                    .sort(
                        (
                            first,
                            second
                        ) => {
                            return (
                                toFiniteNumber(
                                    second.createdAt,
                                    0
                                ) -
                                toFiniteNumber(
                                    first.createdAt,
                                    0
                                )
                            );
                        }
                    )
                    .slice(
                        0,
                        Math.max(
                            1,
                            Math.round(
                                toFiniteNumber(
                                    safeOptions
                                        .latestLimit,
                                    10
                                )
                            )
                        )
                    );

            return {
                reportType:
                    REPORT_TYPE
                        .ANOMALY_ANALYTICS,

                monitoringId:
                    this.state.id,

                generatedAt:
                    Date.now(),

                total:
                    anomalies.length,

                resolved:
                    resolved.length,

                unresolved:
                    unresolved.length,

                acknowledged:
                    acknowledged.length,

                resolutionRate:
                    calculatePercentage(
                        resolved.length,
                        anomalies.length
                    ),

                acknowledgementRate:
                    calculatePercentage(
                        acknowledged.length,
                        anomalies.length
                    ),

                averageResolutionDurationMs:
                    roundNumber(
                        calculateAverage(
                            resolutionDurations
                        ),
                        2
                    ),

                severityCounts:
                    countBy(
                        anomalies,
                        (anomaly) => {
                            return anomaly
                                .severity;
                        }
                    ),

                typeCounts:
                    countBy(
                        anomalies,
                        (anomaly) => {
                            return anomaly.type;
                        }
                    ),

                unresolvedSeverityCounts:
                    countBy(
                        unresolved,
                        (anomaly) => {
                            return anomaly
                                .severity;
                        }
                    ),

                latest:
                    deepClone(
                        latest
                    )
            };
        };

    /* ======================================================================
       SECTION 115
       RECOVERY ANALYTICS
       ====================================================================== */

    MonitoringClass.prototype.buildRecoveryAnalytics =
        function buildRecoveryAnalytics() {
            const lifecycle =
                typeof this
                    .getLifecycleStatus ===
                "function"
                    ? this
                        .getLifecycleStatus()
                    : {};

            const recoveryAnomalies =
                safeArray(
                    this.state
                        .anomalies
                )
                    .filter(
                        (anomaly) => {
                            return (
                                String(
                                    anomaly.type
                                )
                                    .toLowerCase()
                                    .includes(
                                        "recovery"
                                    )
                            );
                        }
                    );

            const recoveryChecks =
                safeArray(
                    this.state
                        .checkHistory
                )
                    .flatMap(
                        (check) => {
                            return safeArray(
                                check.results
                            );
                        }
                    )
                    .filter(
                        (result) => {
                            return (
                                result.type ===
                                "recovery"
                            );
                        }
                    );

            const scores =
                recoveryChecks
                    .map(
                        (result) => {
                            return toFiniteNumber(
                                result.score,
                                0
                            );
                        }
                    );

            return {
                reportType:
                    REPORT_TYPE
                        .RECOVERY_ANALYTICS,

                monitoringId:
                    this.state.id,

                generatedAt:
                    Date.now(),

                recoveryRequired:
                    this.state
                        .recoveryRequired,

                escalationLevel:
                    lifecycle
                        .escalationLevel ||
                    null,

                requestCount:
                    lifecycle
                        .recoveryRequestCount ||
                    0,

                lastRequestAt:
                    lifecycle
                        .lastRecoveryRequestAt ||
                    null,

                relatedAnomalyCount:
                    recoveryAnomalies.length,

                unresolvedRecoveryAnomalies:
                    recoveryAnomalies
                        .filter(
                            (anomaly) => {
                                return (
                                    anomaly.resolved !==
                                    true
                                );
                            }
                        )
                        .length,

                recoveryCheckCount:
                    recoveryChecks.length,

                averageRecoveryScore:
                    roundNumber(
                        calculateAverage(
                            scores
                        ),
                        4
                    ),

                lastRecoveryCheck:
                    recoveryChecks.length
                        ? deepClone(
                            recoveryChecks[
                                recoveryChecks.length -
                                1
                            ]
                        )
                        : null
            };
        };

    /* ======================================================================
       SECTION 116
       REOPENING ANALYTICS
       ====================================================================== */

    MonitoringClass.prototype.buildReopeningAnalytics =
        function buildReopeningAnalytics() {
            const lifecycle =
                typeof this
                    .getLifecycleStatus ===
                "function"
                    ? this
                        .getLifecycleStatus()
                    : {};

            const reopeningAnomalies =
                safeArray(
                    this.state
                        .anomalies
                )
                    .filter(
                        (anomaly) => {
                            return (
                                String(
                                    anomaly.type
                                )
                                    .toLowerCase()
                                    .includes(
                                        "reopening"
                                    )
                            );
                        }
                    );

            const reopeningChecks =
                safeArray(
                    this.state
                        .checkHistory
                )
                    .flatMap(
                        (check) => {
                            return safeArray(
                                check.results
                            );
                        }
                    )
                    .filter(
                        (result) => {
                            return (
                                result.type ===
                                "reopening"
                            );
                        }
                    );

            return {
                reportType:
                    REPORT_TYPE
                        .REOPENING_ANALYTICS,

                monitoringId:
                    this.state.id,

                generatedAt:
                    Date.now(),

                recommended:
                    this.state
                        .reopeningRecommended,

                recommendation:
                    lifecycle
                        .reopeningRecommendation ||
                    null,

                recommendationCount:
                    lifecycle
                        .reopeningRecommendationCount ||
                    0,

                lastRecommendationAt:
                    lifecycle
                        .lastReopeningRecommendationAt ||
                    null,

                stabilityConfirmed:
                    this.state
                        .stabilityConfirmed,

                stableSince:
                    this.state
                        .stableSince,

                healthScore:
                    roundNumber(
                        this.state
                            .healthScore,
                        4
                    ),

                relatedAnomalyCount:
                    reopeningAnomalies
                        .length,

                unresolvedReopeningAnomalies:
                    reopeningAnomalies
                        .filter(
                            (anomaly) => {
                                return (
                                    anomaly.resolved !==
                                    true
                                );
                            }
                        )
                        .length,

                reopeningCheckCount:
                    reopeningChecks.length,

                lastReopeningCheck:
                    reopeningChecks.length
                        ? deepClone(
                            reopeningChecks[
                                reopeningChecks.length -
                                1
                            ]
                        )
                        : null
            };
        };

    /* ======================================================================
       SECTION 117
       SNAPSHOT REPORT BUILDER
       ====================================================================== */

    MonitoringClass.prototype.buildSnapshotReport =
        function buildSnapshotReport(
            options = {}
        ) {
            const safeOptions =
                safeObject(options);

            let snapshot =
                null;

            if (
                safeOptions.snapshotId
            ) {
                snapshot =
                    safeArray(
                        this.state
                            .snapshots
                    )
                        .find(
                            (item) => {
                                return (
                                    item.id ===
                                    safeOptions
                                        .snapshotId
                                );
                            }
                        ) ||
                    null;
            }

            if (
                !snapshot
            ) {
                snapshot =
                    safeArray(
                        this.state
                            .snapshots
                    )
                        .slice(-1)[0] ||
                    null;
            }

            if (
                !snapshot &&
                safeOptions
                    .createIfMissing !==
                false
            ) {
                snapshot =
                    this.createSnapshot(
                        safeOptions.label ||
                        "monitoring_report_snapshot",
                        {
                            source:
                                "build_snapshot_report"
                        }
                    );
            }

            return {
                reportType:
                    REPORT_TYPE.SNAPSHOT,

                monitoringId:
                    this.state.id,

                generatedAt:
                    Date.now(),

                found:
                    Boolean(
                        snapshot
                    ),

                snapshot:
                    snapshot
                        ? deepClone(
                            snapshot
                        )
                        : null
            };
        };

    /* ======================================================================
       SECTION 118
       HISTORICAL TREND REPORT
       ====================================================================== */

    MonitoringClass.prototype.buildHistoricalTrendReport =
        function buildHistoricalTrendReport(
            options = {}
        ) {
            const safeOptions =
                safeObject(options);

            const windowSize =
                Math.max(
                    2,
                    Math.round(
                        toFiniteNumber(
                            safeOptions.windowSize,
                            DEFAULT_TREND_WINDOW
                        )
                    )
                );

            const history =
                safeArray(
                    this.state
                        .checkHistory
                );

            const windows = [];

            for (
                let index = 0;
                index <
                history.length;
                index +=
                    windowSize
            ) {
                const sample =
                    history.slice(
                        index,
                        index +
                        windowSize
                    );

                if (
                    sample.length ===
                    0
                ) {
                    continue;
                }

                const scores =
                    sample.map(
                        (check) => {
                            return toFiniteNumber(
                                check.healthScore,
                                0
                            );
                        }
                    );

                const slope =
                    calculateLinearSlope(
                        scores
                    );

                windows.push({
                    startAt:
                        sample[0]
                            ?.startedAt ||
                        null,

                    endAt:
                        sample[
                            sample.length -
                            1
                        ]?.completedAt ||
                        null,

                    count:
                        sample.length,

                    averageScore:
                        roundNumber(
                            calculateAverage(
                                scores
                            ),
                            4
                        ),

                    minimumScore:
                        roundNumber(
                            Math.min(
                                ...scores
                            ),
                            4
                        ),

                    maximumScore:
                        roundNumber(
                            Math.max(
                                ...scores
                            ),
                            4
                        ),

                    slope:
                        roundNumber(
                            slope,
                            6
                        ),

                    direction:
                        classifyTrendDirection(
                            slope
                        ),

                    successfulChecks:
                        sample.filter(
                            (check) => {
                                return (
                                    check.status ===
                                    CHECK_RESULT_STATUS
                                        .PASSED
                                );
                            }
                        ).length,

                    failedChecks:
                        sample.filter(
                            (check) => {
                                return (
                                    check.status ===
                                    CHECK_RESULT_STATUS
                                        .FAILED
                                );
                            }
                        ).length,

                    anomalyCount:
                        sample.reduce(
                            (
                                total,
                                check
                            ) => {
                                return (
                                    total +
                                    safeArray(
                                        check.anomalies
                                    ).length
                                );
                            },
                            0
                        )
                });
            }

            const windowScores =
                windows.map(
                    (window) => {
                        return window
                            .averageScore;
                    }
                );

            const overallSlope =
                calculateLinearSlope(
                    windowScores
                );

            return {
                reportType:
                    REPORT_TYPE
                        .HISTORICAL_TREND,

                monitoringId:
                    this.state.id,

                generatedAt:
                    Date.now(),

                windowSize,

                historyCount:
                    history.length,

                windowCount:
                    windows.length,

                overallTrend: {
                    slope:
                        roundNumber(
                            overallSlope,
                            6
                        ),

                    direction:
                        windows.length >
                        1
                            ? classifyTrendDirection(
                                overallSlope
                            )
                            : TREND_DIRECTION
                                .UNKNOWN,

                    averageScore:
                        roundNumber(
                            calculateAverage(
                                windowScores
                            ),
                            4
                        )
                },

                windows
            };
        };

    /* ======================================================================
       SECTION 119
       DASHBOARD REPORT
       ====================================================================== */

    MonitoringClass.prototype.buildDashboardReport =
        function buildDashboardReport(
            options = {}
        ) {
            const summary =
                this.buildMonitoringSummary(
                    options
                );

            const timeline =
                this.buildHealthTimeline({
                    limit:
                        options.timelineLimit ||
                        30
                });

            const checkAnalytics =
                this.buildCheckAnalytics({
                    limit:
                        options.historyLimit ||
                        50
                });

            const anomalyAnalytics =
                this.buildAnomalyAnalytics({
                    latestLimit:
                        options.anomalyLimit ||
                        10
                });

            return {
                reportType:
                    REPORT_TYPE.DASHBOARD,

                monitoringId:
                    this.state.id,

                generatedAt:
                    Date.now(),

                cards: {
                    health: {
                        status:
                            summary.health
                                .status,

                        score:
                            summary.health
                                .score,

                        percentage:
                            summary.health
                                .percentage
                    },

                    checks: {
                        total:
                            summary.checks
                                .total,

                        successRate:
                            summary.checks
                                .successRate,

                        consecutiveFailures:
                            summary.checks
                                .consecutiveFailed
                    },

                    stability: {
                        confirmed:
                            summary.stability
                                .confirmed,

                        status:
                            summary.stability
                                .status,

                        stableSince:
                            summary.stability
                                .stableSince
                    },

                    recovery: {
                        required:
                            summary.recovery
                                .required,

                        escalationLevel:
                            summary.recovery
                                .escalationLevel
                    },

                    reopening: {
                        recommended:
                            summary.reopening
                                .recommended,

                        recommendation:
                            summary.reopening
                                .recommendation
                    },

                    anomalies: {
                        unresolved:
                            summary.anomalies
                                .unresolved,

                        unresolvedCritical:
                            summary.anomalies
                                .unresolvedCritical
                    }
                },

                healthTimeline:
                    timeline.timeline,

                healthTrend:
                    timeline.trend,

                checkTypes:
                    checkAnalytics
                        .checkTypes,

                latestAnomalies:
                    anomalyAnalytics
                        .latest
            };
        };

    /* ======================================================================
       SECTION 120
       COMPLETE MONITORING REPORT
       ====================================================================== */

    MonitoringClass.prototype.buildCompleteMonitoringReport =
        function buildCompleteMonitoringReport(
            options = {}
        ) {
            const safeOptions =
                safeObject(options);

            const report = {
                reportType:
                    REPORT_TYPE.COMPLETE,

                monitoringId:
                    this.state.id,

                generatedAt:
                    Date.now(),

                summary:
                    this.buildMonitoringSummary({
                        includeConfiguration:
                            safeOptions
                                .includeConfiguration ===
                            true
                    }),

                statistics:
                    this.buildMonitoringStatistics({
                        limit:
                            safeOptions
                                .historyLimit ||
                            DEFAULT_REPORT_HISTORY_LIMIT
                    }),

                healthTimeline:
                    this.buildHealthTimeline({
                        limit:
                            safeOptions
                                .timelineLimit ||
                            DEFAULT_TIMELINE_LIMIT
                    }),

                checkAnalytics:
                    this.buildCheckAnalytics({
                        limit:
                            safeOptions
                                .historyLimit ||
                            DEFAULT_REPORT_HISTORY_LIMIT
                    }),

                anomalyAnalytics:
                    this.buildAnomalyAnalytics({
                        latestLimit:
                            safeOptions
                                .anomalyLimit ||
                            20
                    }),

                recoveryAnalytics:
                    this.buildRecoveryAnalytics(),

                reopeningAnalytics:
                    this.buildReopeningAnalytics(),

                historicalTrend:
                    this.buildHistoricalTrendReport({
                        windowSize:
                            safeOptions
                                .trendWindow ||
                            DEFAULT_TREND_WINDOW
                    }),

                integration:
                    typeof this
                        .getIntegrationStatus ===
                    "function"
                        ? this
                            .getIntegrationStatus()
                        : null
            };

            if (
                safeOptions.includeSnapshots ===
                true
            ) {
                report.snapshots =
                    this.getSnapshots(
                        safeOptions
                            .snapshotLimit ||
                        10
                    );
            }

            if (
                safeOptions.includeRawState ===
                true
            ) {
                report.rawState =
                    this.getPublicState();
            }

            if (
                safeOptions.includeLatestCheck !==
                false
            ) {
                report.latestCheck =
                    this.getLatestCheck();
            }

            return report;
        };

    /* ======================================================================
       SECTION 121
       JSON EXPORT
       ====================================================================== */

    MonitoringClass.prototype.exportMonitoringReport =
        function exportMonitoringReport(
            options = {}
        ) {
            const safeOptions =
                safeObject(options);

            const format =
                safeOptions.format ||
                REPORT_FORMAT
                    .PRETTY_JSON;

            let report;

            switch (
                safeOptions.reportType
            ) {
                case REPORT_TYPE.SUMMARY:
                    report =
                        this
                            .buildMonitoringSummary(
                                safeOptions
                            );
                    break;

                case REPORT_TYPE
                    .HEALTH_TIMELINE:
                    report =
                        this
                            .buildHealthTimeline(
                                safeOptions
                            );
                    break;

                case REPORT_TYPE.STATISTICS:
                    report =
                        this
                            .buildMonitoringStatistics(
                                safeOptions
                            );
                    break;

                case REPORT_TYPE
                    .CHECK_ANALYTICS:
                    report =
                        this
                            .buildCheckAnalytics(
                                safeOptions
                            );
                    break;

                case REPORT_TYPE
                    .ANOMALY_ANALYTICS:
                    report =
                        this
                            .buildAnomalyAnalytics(
                                safeOptions
                            );
                    break;

                case REPORT_TYPE
                    .RECOVERY_ANALYTICS:
                    report =
                        this
                            .buildRecoveryAnalytics(
                                safeOptions
                            );
                    break;

                case REPORT_TYPE
                    .REOPENING_ANALYTICS:
                    report =
                        this
                            .buildReopeningAnalytics(
                                safeOptions
                            );
                    break;

                case REPORT_TYPE.SNAPSHOT:
                    report =
                        this
                            .buildSnapshotReport(
                                safeOptions
                            );
                    break;

                case REPORT_TYPE.DASHBOARD:
                    report =
                        this
                            .buildDashboardReport(
                                safeOptions
                            );
                    break;

                case REPORT_TYPE
                    .HISTORICAL_TREND:
                    report =
                        this
                            .buildHistoricalTrendReport(
                                safeOptions
                            );
                    break;

                default:
                    report =
                        this
                            .buildCompleteMonitoringReport(
                                safeOptions
                            );
            }

            const sanitized =
                sanitizeForExport(
                    report
                );

            if (
                format ===
                REPORT_FORMAT.OBJECT
            ) {
                return sanitized;
            }

            if (
                format ===
                REPORT_FORMAT.JSON
            ) {
                return JSON.stringify(
                    sanitized
                );
            }

            return JSON.stringify(
                sanitized,
                null,
                Math.max(
                    0,
                    Math.round(
                        toFiniteNumber(
                            safeOptions.space,
                            DEFAULT_EXPORT_SPACE
                        )
                    )
                )
            );
        };

    /* ======================================================================
       SECTION 122
       DOWNLOAD JSON REPORT
       ====================================================================== */

    MonitoringClass.prototype.downloadMonitoringReport =
        function downloadMonitoringReport(
            options = {}
        ) {
            const safeOptions =
                safeObject(options);

            const json =
                this.exportMonitoringReport({
                    ...safeOptions,

                    format:
                        REPORT_FORMAT
                            .PRETTY_JSON
                });

            if (
                typeof Blob !==
                "function" ||
                !global.document ||
                !global.URL
            ) {
                return {
                    downloaded:
                        false,

                    reason:
                        "browser_download_unavailable",

                    content:
                        json
                };
            }

            const filename =
                safeOptions.filename ||
                (
                    "post_recovery_monitoring_" +
                    this.state.id +
                    "_" +
                    Date.now() +
                    ".json"
                );

            const blob =
                new Blob(
                    [
                        json
                    ],
                    {
                        type:
                            "application/json;charset=utf-8"
                    }
                );

            const url =
                global.URL
                    .createObjectURL(
                        blob
                    );

            const anchor =
                global.document
                    .createElement(
                        "a"
                    );

            anchor.href =
                url;

            anchor.download =
                filename;

            anchor.style.display =
                "none";

            global.document
                .body
                .appendChild(
                    anchor
                );

            anchor.click();

            anchor.remove();

            global.setTimeout(
                () => {
                    global.URL
                        .revokeObjectURL(
                            url
                        );
                },
                1000
            );

            return {
                downloaded:
                    true,

                filename,

                size:
                    json.length
            };
        };

    /* ======================================================================
       SECTION 123
       CLEAR REPORTING HISTORY
       ====================================================================== */

    MonitoringClass.prototype.clearMonitoringHistory =
        function clearMonitoringHistory(
            options = {}
        ) {
            const safeOptions =
                safeObject(options);

            const cleared = {
                checks:
                    0,

                anomalies:
                    0,

                snapshots:
                    0,

                stability:
                    0
            };

            if (
                safeOptions.checks !==
                false
            ) {
                cleared.checks =
                    this.state
                        .checkHistory
                        .length;

                this.state
                    .checkHistory =
                    [];

                this.state.lastCheck =
                    null;

                this.state.lastCheckAt =
                    null;
            }

            if (
                safeOptions.anomalies ===
                true
            ) {
                cleared.anomalies =
                    this.state
                        .anomalies
                        .length;

                this.state.anomalies =
                    [];

                this.state
                    .totalAnomalies =
                    0;

                this.state
                    .criticalAnomalies =
                    0;
            }

            if (
                safeOptions.snapshots ===
                true
            ) {
                cleared.snapshots =
                    this.state
                        .snapshots
                        .length;

                this.state.snapshots =
                    [];
            }

            if (
                safeOptions.stability !==
                false
            ) {
                cleared.stability =
                    this.state
                        .stabilityHistory
                        .length;

                this.state
                    .stabilityHistory =
                    [];

                this.state
                    .stabilityConfirmed =
                    false;

                this.state.stableSince =
                    null;
            }

            this.emit(
                "post_recovery_history_cleared",
                {
                    cleared:
                        deepClone(
                            cleared
                        )
                }
            );

            this.synchronizeCoreState();

            return {
                cleared:
                    true,

                counts:
                    cleared,

                clearedAt:
                    Date.now()
            };
        };

    /* ======================================================================
       SECTION 124
       REPORT API EXTENSIONS
       ====================================================================== */

    const MonitoringApi =
        global
            .PostRecoveryMonitoringV32API ||
        global
            .RainArrivalPostRecoveryMonitoringV32API ||
        global
            .RainGuardPostRecoveryMonitoringV32API;

    if (MonitoringApi) {
        MonitoringApi.getSummary =
            function getSummary(
                options = {}
            ) {
                return this
                    .requireInstance()
                    .buildMonitoringSummary(
                        options
                    );
            };

        MonitoringApi.getTimeline =
            function getTimeline(
                options = {}
            ) {
                return this
                    .requireInstance()
                    .buildHealthTimeline(
                        options
                    );
            };

        MonitoringApi.getStatistics =
            function getStatistics(
                options = {}
            ) {
                return this
                    .requireInstance()
                    .buildMonitoringStatistics(
                        options
                    );
            };

        MonitoringApi.getCheckAnalytics =
            function getCheckAnalytics(
                options = {}
            ) {
                return this
                    .requireInstance()
                    .buildCheckAnalytics(
                        options
                    );
            };

        MonitoringApi.getAnomalyAnalytics =
            function getAnomalyAnalytics(
                options = {}
            ) {
                return this
                    .requireInstance()
                    .buildAnomalyAnalytics(
                        options
                    );
            };

        MonitoringApi.getRecoveryAnalytics =
            function getRecoveryAnalytics() {
                return this
                    .requireInstance()
                    .buildRecoveryAnalytics();
            };

        MonitoringApi.getReopeningAnalytics =
            function getReopeningAnalytics() {
                return this
                    .requireInstance()
                    .buildReopeningAnalytics();
            };

        MonitoringApi.getHistoricalTrend =
            function getHistoricalTrend(
                options = {}
            ) {
                return this
                    .requireInstance()
                    .buildHistoricalTrendReport(
                        options
                    );
            };

        MonitoringApi.getDashboardReport =
            function getDashboardReport(
                options = {}
            ) {
                return this
                    .requireInstance()
                    .buildDashboardReport(
                        options
                    );
            };

        MonitoringApi.getCompleteReport =
            function getCompleteReport(
                options = {}
            ) {
                return this
                    .requireInstance()
                    .buildCompleteMonitoringReport(
                        options
                    );
            };

        MonitoringApi.exportReport =
            function exportReport(
                options = {}
            ) {
                return this
                    .requireInstance()
                    .exportMonitoringReport(
                        options
                    );
            };

        MonitoringApi.downloadReport =
            function downloadReport(
                options = {}
            ) {
                return this
                    .requireInstance()
                    .downloadMonitoringReport(
                        options
                    );
            };

        MonitoringApi.clearHistory =
            function clearHistory(
                options = {}
            ) {
                return this
                    .requireInstance()
                    .clearMonitoringHistory(
                        options
                    );
            };
    }

    /* ======================================================================
       SECTION 125
       CORE PROTOTYPE REPORT INTEGRATION
       ====================================================================== */

    const CoreClass =
        global.RainArrivalRecoveryCoreV32;

    if (
        typeof CoreClass ===
        "function"
    ) {
        if (
            typeof CoreClass
                .prototype
                .getPostRecoveryMonitoringReport !==
            "function"
        ) {
            CoreClass.prototype
                .getPostRecoveryMonitoringReport =
                function getPostRecoveryMonitoringReport(
                    options = {}
                ) {
                    return (
                        this
                            .postRecoveryMonitoring
                            ?.buildCompleteMonitoringReport?.(
                                options
                            ) ||
                        null
                    );
                };
        }

        if (
            typeof CoreClass
                .prototype
                .exportPostRecoveryMonitoringReport !==
            "function"
        ) {
            CoreClass.prototype
                .exportPostRecoveryMonitoringReport =
                function exportPostRecoveryMonitoringReport(
                    options = {}
                ) {
                    return (
                        this
                            .postRecoveryMonitoring
                            ?.exportMonitoringReport?.(
                                options
                            ) ||
                        null
                    );
                };
        }
    }

    /* ======================================================================
       SECTION 126
       COMPATIBILITY ALIASES
       ====================================================================== */

    MonitoringClass.prototype.getSummary =
        MonitoringClass.prototype
            .buildMonitoringSummary;

    MonitoringClass.prototype.getStatistics =
        MonitoringClass.prototype
            .buildMonitoringStatistics;

    MonitoringClass.prototype.getHealthTimeline =
        MonitoringClass.prototype
            .buildHealthTimeline;

    MonitoringClass.prototype.getAnalytics =
        MonitoringClass.prototype
            .buildCheckAnalytics;

    MonitoringClass.prototype.getCompleteReport =
        MonitoringClass.prototype
            .buildCompleteMonitoringReport;

    MonitoringClass.prototype.generateReport =
        MonitoringClass.prototype
            .buildCompleteMonitoringReport;

    MonitoringClass.prototype.exportReport =
        MonitoringClass.prototype
            .exportMonitoringReport;

    MonitoringClass.prototype.downloadReport =
        MonitoringClass.prototype
            .downloadMonitoringReport;

    MonitoringClass.prototype.clearHistory =
        MonitoringClass.prototype
            .clearMonitoringHistory;

    /* ======================================================================
       SECTION 127
       PART 5 EXPORT
       ====================================================================== */

    global.PostRecoveryMonitoringV32Part5 = {
        REPORT_TYPE,
        TREND_DIRECTION,
        REPORT_FORMAT,
        DEFAULT_REPORT_HISTORY_LIMIT,
        DEFAULT_TIMELINE_LIMIT,
        DEFAULT_TREND_WINDOW,
        DEFAULT_EXPORT_SPACE,
        roundNumber,
        calculatePercentage,
        getDurationLabel,
        groupBy,
        countBy,
        calculateLinearSlope,
        classifyTrendDirection,
        sanitizeForExport
    };

    /* ======================================================================
       SECTION 128
       FILE COMPLETION FLAG
       ====================================================================== */

    global.PostRecoveryMonitoringV32Completed =
        true;

    global.PostRecoveryMonitoringV32Version =
        "32.1.0";

})(window);

