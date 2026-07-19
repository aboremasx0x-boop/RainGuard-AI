/* ==========================================================================
 * RainGuard AI V32
 * Rain Arrival Prediction Engine
 * Core Engine Foundation — Stage 1 / Part 1A
 * ==========================================================================
 *
 * File:
 * frontend/js/rain_arrival_prediction_engine_v32.js
 *
 * Responsibilities:
 * - Core engine configuration
 * - Runtime initialization
 * - Internal state stores
 * - Lifecycle foundations
 * - Statistics and metrics initialization
 * - Compatibility with RainGuard V30 / V31 / V32
 *
 * Version:
 * 32.0.0
 *
 * ========================================================================== */

(function initializeRainArrivalPredictionEngineV32(globalScope) {
    "use strict";

    /* ======================================================================
     * SECTION 1
     * Global constants
     * ====================================================================== */

    const ENGINE_NAME =
        "RainArrivalPredictionEngineV32";

    const ENGINE_VERSION =
        "32.0.0";

    const ENGINE_NAMESPACE =
        "RG32";

    const ENGINE_BUILD =
        "rainguard-v32-rain-arrival-core";

    const EARTH_RADIUS_KM =
        6371.0088;

    const MILLISECONDS_PER_SECOND =
        1000;

    const MILLISECONDS_PER_MINUTE =
        60 * MILLISECONDS_PER_SECOND;

    const MILLISECONDS_PER_HOUR =
        60 * MILLISECONDS_PER_MINUTE;

    const MILLISECONDS_PER_DAY =
        24 * MILLISECONDS_PER_HOUR;

    const DEGREES_TO_RADIANS =
        Math.PI / 180;

    const RADIANS_TO_DEGREES =
        180 / Math.PI;

    const DEFAULT_DIRECTION_DEGREES =
        0;

    const DEFAULT_SPEED_KMH =
        0;

    const DEFAULT_CONFIDENCE =
        50;

    const DEFAULT_QUALITY =
        50;

    const DEFAULT_INTENSITY =
        0;

    const MAXIMUM_DIRECTION_DEGREES =
        360;

    const MINIMUM_LATITUDE =
        -90;

    const MAXIMUM_LATITUDE =
        90;

    const MINIMUM_LONGITUDE =
        -180;

    const MAXIMUM_LONGITUDE =
        180;

    const MINIMUM_SPEED_KMH =
        0;

    const MAXIMUM_SPEED_KMH =
        220;

    const MINIMUM_CONFIDENCE =
        0;

    const MAXIMUM_CONFIDENCE =
        100;

    const MINIMUM_QUALITY =
        0;

    const MAXIMUM_QUALITY =
        100;

    const MAXIMUM_SAFE_ARRAY_LENGTH =
        5000;

    const MAXIMUM_SAFE_OBJECT_DEPTH =
        20;

    const DEFAULT_MAXIMUM_HISTORY =
        120;

    const DEFAULT_MAXIMUM_MOTION_HISTORY =
        30;

    const DEFAULT_MAXIMUM_WEIGHT_HISTORY =
        30;

    const DEFAULT_MAXIMUM_PREDICTION_HISTORY =
        30;

    const DEFAULT_MAXIMUM_EVENT_HISTORY =
        300;

    const DEFAULT_MAXIMUM_ERROR_HISTORY =
        100;

    const DEFAULT_MAXIMUM_LOG_HISTORY =
        500;

    const DEFAULT_STALE_CELL_MINUTES =
        30;

    const DEFAULT_CLEANUP_INTERVAL_MS =
        5 * MILLISECONDS_PER_MINUTE;

    const DEFAULT_UPDATE_INTERVAL_MS =
        60 * MILLISECONDS_PER_SECOND;

    const DEFAULT_MAXIMUM_PREDICTION_MINUTES =
        120;

    const DEFAULT_MINIMUM_TRACKING_POINTS =
        3;

    const DEFAULT_MAXIMUM_TRACKING_POINTS =
        120;

    const DEFAULT_MISSING_UPDATE_LIMIT =
        8;

    const DEFAULT_CACHE_TTL_MS =
        5 * MILLISECONDS_PER_MINUTE;

    const DEFAULT_EVENT_PREFIX =
        "rainguard:v32";

    const DEFAULT_LOCALE =
        "ar";

    const SUPPORTED_LOCALES =
        Object.freeze([
            "ar",
            "en"
        ]);

    const DEFAULT_PREDICTION_HORIZONS_MINUTES =
        Object.freeze([
            10,
            20,
            30,
            45,
            60,
            90,
            120
        ]);

    const ENGINE_RUNTIME_STATES =
        Object.freeze({
            CREATED: "created",
            INITIALIZING: "initializing",
            READY: "ready",
            RUNNING: "running",
            PAUSED: "paused",
            STOPPED: "stopped",
            DESTROYING: "destroying",
            DESTROYED: "destroyed",
            ERROR: "error"
        });

    const ENGINE_EVENT_NAMES =
        Object.freeze({
            CREATED:
                `${DEFAULT_EVENT_PREFIX}:created`,

            INITIALIZED:
                `${DEFAULT_EVENT_PREFIX}:initialized`,

            STARTED:
                `${DEFAULT_EVENT_PREFIX}:started`,

            STOPPED:
                `${DEFAULT_EVENT_PREFIX}:stopped`,

            PAUSED:
                `${DEFAULT_EVENT_PREFIX}:paused`,

            RESUMED:
                `${DEFAULT_EVENT_PREFIX}:resumed`,

            RESTARTED:
                `${DEFAULT_EVENT_PREFIX}:restarted`,

            CLEARED:
                `${DEFAULT_EVENT_PREFIX}:cleared`,

            DESTROYED:
                `${DEFAULT_EVENT_PREFIX}:destroyed`,

            ERROR:
                `${DEFAULT_EVENT_PREFIX}:error`,

            WARNING:
                `${DEFAULT_EVENT_PREFIX}:warning`,

            STATUS_CHANGED:
                `${DEFAULT_EVENT_PREFIX}:status-changed`,

            CONFIG_UPDATED:
                `${DEFAULT_EVENT_PREFIX}:config-updated`,

            CELLS_UPDATED:
                `${DEFAULT_EVENT_PREFIX}:cells-updated`,

            CITIES_UPDATED:
                `${DEFAULT_EVENT_PREFIX}:cities-updated`,

            REGIONS_UPDATED:
                `${DEFAULT_EVENT_PREFIX}:regions-updated`,

            PREDICTION_UPDATED:
                `${DEFAULT_EVENT_PREFIX}:prediction-updated`
        });

    const ENGINE_LOG_LEVELS =
        Object.freeze({
            TRACE: "trace",
            DEBUG: "debug",
            INFO: "info",
            WARN: "warn",
            ERROR: "error",
            SILENT: "silent"
        });

    const ENGINE_LOG_LEVEL_PRIORITY =
        Object.freeze({
            trace: 10,
            debug: 20,
            info: 30,
            warn: 40,
            error: 50,
            silent: 100
        });

    const LIFECYCLE_STATES =
        Object.freeze({
            UNKNOWN: "unknown",
            NEW: "new",
            DEVELOPING: "developing",
            MATURE: "mature",
            WEAKENING: "weakening",
            DISSIPATING: "dissipating",
            EXPIRED: "expired"
        });

    const MOTION_SOURCE_NAMES =
        Object.freeze({
            RADAR: "radar",
            MOTION_ANALYSIS: "motionAnalysis",
            KALMAN: "kalman",
            ALPHA_BETA: "alphaBeta",
            HISTORY: "history"
        });

    /* ======================================================================
     * SECTION 2
     * Default configuration
     * ====================================================================== */

    const DEFAULT_CONFIG =
        Object.freeze({

            engineName:
                ENGINE_NAME,

            version:
                ENGINE_VERSION,

            namespace:
                ENGINE_NAMESPACE,

            build:
                ENGINE_BUILD,

            locale:
                DEFAULT_LOCALE,

            debug:
                false,

            logLevel:
                ENGINE_LOG_LEVELS.INFO,

            autoStart:
                false,

            autoCleanup:
                true,

            emitWindowEvents:
                true,

            useExternalEventBus:
                true,

            enableInternalEventHistory:
                true,

            enableMetrics:
                true,

            enableStatistics:
                true,

            enableCache:
                true,

            enableValidation:
                true,

            enablePersistence:
                false,

            persistenceKey:
                "rainguard_ai_v32_rain_arrival",

            predictionHorizonsMinutes:
                [...DEFAULT_PREDICTION_HORIZONS_MINUTES],

            maximumPredictionMinutes:
                DEFAULT_MAXIMUM_PREDICTION_MINUTES,

            minimumTrackingPoints:
                DEFAULT_MINIMUM_TRACKING_POINTS,

            maximumTrackingPoints:
                DEFAULT_MAXIMUM_TRACKING_POINTS,

            maximumCellSpeedKmh:
                MAXIMUM_SPEED_KMH,

            minimumCellSpeedKmh:
                MINIMUM_SPEED_KMH,

            staleCellMinutes:
                DEFAULT_STALE_CELL_MINUTES,

            missingUpdateLimit:
                DEFAULT_MISSING_UPDATE_LIMIT,

            updateIntervalMs:
                DEFAULT_UPDATE_INTERVAL_MS,

            cleanupIntervalMs:
                DEFAULT_CLEANUP_INTERVAL_MS,

            cacheTtlMs:
                DEFAULT_CACHE_TTL_MS,

            maximumHistory:
                DEFAULT_MAXIMUM_HISTORY,

            maximumMotionHistory:
                DEFAULT_MAXIMUM_MOTION_HISTORY,

            maximumWeightHistory:
                DEFAULT_MAXIMUM_WEIGHT_HISTORY,

            maximumPredictionHistory:
                DEFAULT_MAXIMUM_PREDICTION_HISTORY,

            maximumEventHistory:
                DEFAULT_MAXIMUM_EVENT_HISTORY,

            maximumErrorHistory:
                DEFAULT_MAXIMUM_ERROR_HISTORY,

            maximumLogHistory:
                DEFAULT_MAXIMUM_LOG_HISTORY,

            defaultConfidence:
                DEFAULT_CONFIDENCE,

            minimumConfidence:
                10,

            maximumConfidence:
                MAXIMUM_CONFIDENCE,

            defaultQuality:
                DEFAULT_QUALITY,

            minimumQuality:
                MINIMUM_QUALITY,

            maximumQuality:
                MAXIMUM_QUALITY,

            defaultIntensity:
                DEFAULT_INTENSITY,

            earthRadiusKm:
                EARTH_RADIUS_KM,

            preserveStateOnStop:
                true,

            clearStateOnDestroy:
                true,

            freezePublicResults:
                false,

            strictMode:
                false,

            compatibility:
                {
                    v30: true,
                    v31: true,
                    v32: true
                },

            featureFlags:
                {
                    stormTracking: true,
                    motionAnalysis: true,
                    kalmanFiltering: true,
                    alphaBetaTracking: true,
                    motionFusion: true,
                    motionPrediction: true,
                    rainCorridor: true,
                    cityImpact: true,
                    rainArrivalEta: true,
                    nationalTimeline: true
                }
        });

    /* ======================================================================
     * SECTION 3
     * RainArrivalPredictionEngineV32
     * ====================================================================== */

    class RainArrivalPredictionEngineV32 {

        /* ==================================================================
         * Constructor
         * ================================================================== */

        constructor(options = {}) {

            const safeOptions =
                options &&
                typeof options === "object" &&
                !Array.isArray(options)
                    ? options
                    : {};

            this.name =
                ENGINE_NAME;

            this.version =
                ENGINE_VERSION;

            this.namespace =
                ENGINE_NAMESPACE;

            this.build =
                ENGINE_BUILD;

            this.createdAt =
                Date.now();

            this.instanceId =
                this.generateInstanceId();

            this.config =
                this.mergeConfig(
                    DEFAULT_CONFIG,
                    safeOptions
                );

            this.debugEnabled =
                Boolean(
                    this.config.debug
                );

            this.logLevel =
                this.normalizeLogLevel(
                    this.config.logLevel
                );

            this.locale =
                this.normalizeLocale(
                    this.config.locale
                );

            this.runtimeState =
                ENGINE_RUNTIME_STATES.CREATED;

            this.running =
                false;

            this.paused =
                false;

            this.destroyed =
                false;

            this.initialized =
                false;

            this.initializing =
                false;

            this.stopping =
                false;

            this.destroying =
                false;

            this.restartInProgress =
                false;

            this.lastError =
                null;

            this.lastWarning =
                null;

            this.lastUpdateAt =
                null;

            this.startedAt =
                null;

            this.stoppedAt =
                null;

            this.pausedAt =
                null;

            this.resumedAt =
                null;

            this.destroyedAt =
                null;

            this.lastCleanupAt =
                null;

            this.lastPredictionAt =
                null;

            this.lastIngestionAt =
                null;

            this.lastTrackingAt =
                null;

            this.lastMotionFusionAt =
                null;

            this.lastCityImpactAt =
                null;

            this.lastRainArrivalAt =
                null;

            this.updateTimer =
                null;

            this.cleanupTimer =
                null;

            this.heartbeatTimer =
                null;

            this.pendingStartPromise =
                null;

            this.pendingStopPromise =
                null;

            this.pendingDestroyPromise =
                null;

            this.abortController =
                typeof AbortController !== "undefined"
                    ? new AbortController()
                    : null;

            this.externalEventBus =
                this.resolveExternalEventBus(
                    safeOptions.eventBus
                );

            this.externalLogger =
                this.resolveExternalLogger(
                    safeOptions.logger
                );

            this.clock =
                this.resolveClock(
                    safeOptions.clock
                );

            /* ==============================================================
             * Primary data stores
             * ============================================================== */

            this.cells =
                new Map();

            this.cities =
                new Map();

            this.regions =
                new Map();

            this.cellHistory =
                new Map();

            this.cityImpactHistory =
                new Map();

            this.arrivalHistory =
                new Map();

            /* ==============================================================
             * Tracking state stores
             * ============================================================== */

            this.kalmanStates =
                new Map();

            this.alphaBetaStates =
                new Map();

            this.motionHistory =
                new Map();

            this.weightHistory =
                new Map();

            this.predictionHistory =
                new Map();

            this.trackingHistory =
                new Map();

            this.sourceQualityHistory =
                new Map();

            this.finalMotionHistory =
                new Map();

            this.corridorHistory =
                new Map();

            /* ==============================================================
             * Runtime stores
             * ============================================================== */

            this.cache =
                new Map();

            this.listeners =
                new Map();

            this.onceListeners =
                new Map();

            this.internalEventHistory =
                [];

            this.logHistory =
                [];

            this.errorHistory =
                [];

            this.warningHistory =
                [];

            this.operationHistory =
                [];

            this.pendingOperations =
                new Map();

            this.locks =
                new Map();

            this.metadata =
                new Map();

            /* ==============================================================
             * Runtime status
             * ============================================================== */

            this.status = {

                state:
                    ENGINE_RUNTIME_STATES.CREATED,

                running:
                    false,

                paused:
                    false,

                initialized:
                    false,

                destroyed:
                    false,

                healthy:
                    true,

                createdAt:
                    this.createdAt,

                startedAt:
                    null,

                stoppedAt:
                    null,

                pausedAt:
                    null,

                resumedAt:
                    null,

                lastUpdateAt:
                    null,

                lastCleanupAt:
                    null,

                uptimeMs:
                    0,

                cellsTracked:
                    0,

                citiesRegistered:
                    0,

                regionsRegistered:
                    0,

                activePredictions:
                    0,

                activeCorridors:
                    0,

                affectedCities:
                    0,

                pendingOperations:
                    0,

                errors:
                    0,

                warnings:
                    0
            };

            /* ==============================================================
             * Statistics
             * ============================================================== */

            this.statistics = {

                createdAt:
                    this.createdAt,

                totalStarts:
                    0,

                totalStops:
                    0,

                totalPauses:
                    0,

                totalResumes:
                    0,

                totalRestarts:
                    0,

                totalClears:
                    0,

                totalCellsIngested:
                    0,

                totalCellsRejected:
                    0,

                totalCellsTracked:
                    0,

                totalCellsExpired:
                    0,

                totalCitiesRegistered:
                    0,

                totalRegionsRegistered:
                    0,

                totalPredictionsGenerated:
                    0,

                totalPredictionPoints:
                    0,

                totalCorridorsGenerated:
                    0,

                totalCityImpactsCalculated:
                    0,

                totalArrivalsCalculated:
                    0,

                totalEventsEmitted:
                    0,

                totalCacheHits:
                    0,

                totalCacheMisses:
                    0,

                totalCleanupRuns:
                    0,

                totalErrors:
                    0,

                totalWarnings:
                    0,

                totalOperations:
                    0,

                successfulOperations:
                    0,

                failedOperations:
                    0
            };

            /* ==============================================================
             * Metrics
             * ============================================================== */

            this.metrics = {

                engineUptimeMs:
                    0,

                lastCycleDurationMs:
                    0,

                averageCycleDurationMs:
                    0,

                maximumCycleDurationMs:
                    0,

                minimumCycleDurationMs:
                    null,

                totalCycleDurationMs:
                    0,

                completedCycles:
                    0,

                lastIngestionDurationMs:
                    0,

                lastTrackingDurationMs:
                    0,

                lastFusionDurationMs:
                    0,

                lastPredictionDurationMs:
                    0,

                lastCorridorDurationMs:
                    0,

                lastCityImpactDurationMs:
                    0,

                lastArrivalDurationMs:
                    0,

                memory: {

                    cells:
                        0,

                    cities:
                        0,

                    regions:
                        0,

                    cache:
                        0,

                    histories:
                        0,

                    listeners:
                        0,

                    pendingOperations:
                        0
                },

                quality: {

                    averageTrackingQuality:
                        0,

                    averageMotionQuality:
                        0,

                    averagePredictionConfidence:
                        0,

                    averageArrivalConfidence:
                        0
                },

                performance: {

                    predictionsPerSecond:
                        0,

                    trackedCellsPerSecond:
                        0,

                    cityImpactsPerSecond:
                        0
                }
            };

            /* ==============================================================
             * Sequence counters
             * ============================================================== */

            this.sequence = {

                event:
                    0,

                operation:
                    0,

                ingestion:
                    0,

                tracking:
                    0,

                prediction:
                    0,

                error:
                    0,

                warning:
                    0
            };

            /* ==============================================================
             * Internal runtime references
             * ============================================================== */

            this.currentCycle =
                null;

            this.currentIngestion =
                null;

            this.currentTrackingRun =
                null;

            this.currentPredictionRun =
                null;

            this.currentCleanupRun =
                null;

            this.lastResults = {

                trackedCells:
                    [],

                motionSources:
                    [],

                finalMotions:
                    [],

                predictionTimelines:
                    [],

                rainCorridors:
                    [],

                cityImpacts:
                    [],

                rainArrivals:
                    [],

                nationalTimeline:
                    null
            };

            /* ==============================================================
             * Bind public methods
             * ============================================================== */

            this.start =
                this.start.bind(this);

            this.stop =
                this.stop.bind(this);

            this.pause =
                this.pause.bind(this);

            this.resume =
                this.resume.bind(this);

            this.restart =
                this.restart.bind(this);

            this.clear =
                this.clear.bind(this);

            this.destroy =
                this.destroy.bind(this);

            this.emit =
                this.emit.bind(this);

            this.on =
                this.on.bind(this);

            this.off =
                this.off.bind(this);

            this.once =
                this.once.bind(this);

            /* ==============================================================
             * Constructor completion
             * ============================================================== */

            this.updateRuntimeState(
                ENGINE_RUNTIME_STATES.CREATED,
                {
                    reason:
                        "constructor-completed"
                }
            );

            this.recordOperation(
                "engine-created",
                {
                    instanceId:
                        this.instanceId,

                    version:
                        this.version,

                    build:
                        this.build
                }
            );

            this.emit(
                ENGINE_EVENT_NAMES.CREATED,
                this.buildEngineIdentity()
            );

            if (
                this.config.autoStart === true
            ) {
                Promise.resolve()
                    .then(() => this.start())
                    .catch((error) => {
                        this.captureError(
                            error,
                            "auto-start"
                        );
                    });
            }
        }

        /* ==================================================================
         * Temporary foundation helpers
         *
         * These methods are required by the constructor.
         * They will be expanded in parts 1B and 1C.
         * ================================================================== */

        generateInstanceId() {

            const timestamp =
                Date.now()
                    .toString(36);

            const random =
                Math.random()
                    .toString(36)
                    .slice(2, 10);

            return [
                "rg32",
                timestamp,
                random
            ].join("-");
        }

        mergeConfig(
            baseConfig,
            overrideConfig
        ) {

            const base =
                this.clonePlainValue(
                    baseConfig
                );

            const override =
                overrideConfig &&
                typeof overrideConfig === "object" &&
                !Array.isArray(overrideConfig)
                    ? overrideConfig
                    : {};

            return this.deepMergeObjects(
                base,
                override
            );
        }

        clonePlainValue(value) {

            if (
                value === null ||
                value === undefined
            ) {
                return value;
            }

            if (
                value instanceof Date
            ) {
                return new Date(
                    value.getTime()
                );
            }

            if (
                Array.isArray(value)
            ) {
                return value.map(
                    (item) =>
                        this.clonePlainValue(item)
                );
            }

            if (
                typeof value === "object"
            ) {

                const result = {};

                for (
                    const [key, item]
                    of Object.entries(value)
                ) {
                    result[key] =
                        this.clonePlainValue(item);
                }

                return result;
            }

            return value;
        }

        deepMergeObjects(
            target,
            source
        ) {

            const result =
                target &&
                typeof target === "object" &&
                !Array.isArray(target)
                    ? target
                    : {};

            if (
                !source ||
                typeof source !== "object" ||
                Array.isArray(source)
            ) {
                return result;
            }

            for (
                const [key, sourceValue]
                of Object.entries(source)
            ) {

                if (
                    sourceValue &&
                    typeof sourceValue === "object" &&
                    !Array.isArray(sourceValue) &&
                    !(sourceValue instanceof Date)
                ) {

                    const targetValue =
                        result[key] &&
                        typeof result[key] === "object" &&
                        !Array.isArray(result[key])
                            ? result[key]
                            : {};

                    result[key] =
                        this.deepMergeObjects(
                            targetValue,
                            sourceValue
                        );

                    continue;
                }

                result[key] =
                    this.clonePlainValue(
                        sourceValue
                    );
            }

            return result;
        }

        normalizeLocale(locale) {

            const normalized =
                String(
                    locale || DEFAULT_LOCALE
                )
                    .trim()
                    .toLowerCase();

            return SUPPORTED_LOCALES.includes(
                normalized
            )
                ? normalized
                : DEFAULT_LOCALE;
        }

        normalizeLogLevel(level) {

            const normalized =
                String(
                    level ||
                    ENGINE_LOG_LEVELS.INFO
                )
                    .trim()
                    .toLowerCase();

            return Object.prototype.hasOwnProperty.call(
                ENGINE_LOG_LEVEL_PRIORITY,
                normalized
            )
                ? normalized
                : ENGINE_LOG_LEVELS.INFO;
        }

        resolveExternalEventBus(
            eventBus
        ) {

            if (
                eventBus &&
                typeof eventBus === "object"
            ) {
                return eventBus;
            }

            if (
                globalScope?.RGEventBus &&
                typeof globalScope.RGEventBus === "object"
            ) {
                return globalScope.RGEventBus;
            }

            if (
                globalScope?.RainGuardEventBus &&
                typeof globalScope.RainGuardEventBus === "object"
            ) {
                return globalScope.RainGuardEventBus;
            }

            return null;
        }

        resolveExternalLogger(
            logger
        ) {

            if (
                logger &&
                typeof logger === "object"
            ) {
                return logger;
            }

            if (
                globalScope?.RGLogger &&
                typeof globalScope.RGLogger === "object"
            ) {
                return globalScope.RGLogger;
            }

            return null;
        }

        resolveClock(
            clock
        ) {

            if (
                clock &&
                typeof clock.now === "function"
            ) {
                return clock;
            }

            return {
                now() {
                    return Date.now();
                }
            };
        }

        buildEngineIdentity() {

            return {

                name:
                    this.name,

                version:
                    this.version,

                namespace:
                    this.namespace,

                build:
                    this.build,

                instanceId:
                    this.instanceId,

                state:
                    this.runtimeState,

                createdAt:
                    this.createdAt
            };
        }

        updateRuntimeState(
            nextState,
            metadata = {}
        ) {

            this.runtimeState =
                nextState;

            this.status.state =
                nextState;

            this.status.running =
                nextState ===
                ENGINE_RUNTIME_STATES.RUNNING;

            this.status.paused =
                nextState ===
                ENGINE_RUNTIME_STATES.PAUSED;

            this.status.destroyed =
                nextState ===
                ENGINE_RUNTIME_STATES.DESTROYED;

            this.status.lastUpdateAt =
                this.clock.now();

            this.lastUpdateAt =
                this.status.lastUpdateAt;

            return {
                state:
                    nextState,

                metadata
            };
        }

        recordOperation(
            type,
            payload = {}
        ) {

            this.sequence.operation += 1;

            this.statistics.totalOperations += 1;

            const operation = {

                id:
                    this.sequence.operation,

                type:
                    String(type || "unknown"),

                timestamp:
                    this.clock.now(),

                payload:
                    this.clonePlainValue(
                        payload
                    )
            };

            this.operationHistory.push(
                operation
            );

            const maximum =
                Number.isFinite(
                    this.config.maximumHistory
                )
                    ? this.config.maximumHistory
                    : DEFAULT_MAXIMUM_HISTORY;

            if (
                this.operationHistory.length >
                maximum
            ) {
                this.operationHistory.splice(
                    0,
                    this.operationHistory.length -
                    maximum
                );
            }

            return operation;
        }

        captureError(
            error,
            context = "unknown"
        ) {

            this.sequence.error += 1;

            this.statistics.totalErrors += 1;

            const normalizedError = {

                id:
                    this.sequence.error,

                context,

                message:
                    error?.message ||
                    String(error),

                name:
                    error?.name ||
                    "Error",

                stack:
                    error?.stack ||
                    null,

                timestamp:
                    this.clock.now()
            };

            this.lastError =
                normalizedError;

            this.errorHistory.push(
                normalizedError
            );

            this.status.errors =
                this.statistics.totalErrors;

            return normalizedError;
        }

                /* ==================================================================
         * Event system
         * ================================================================== */

        emit(
            eventName,
            payload = {},
            options = {}
        ) {

            const normalizedName =
                String(eventName || "")
                    .trim();

            if (!normalizedName) {
                return null;
            }

            this.sequence.event += 1;
            this.statistics.totalEventsEmitted += 1;

            const event = {

                id:
                    this.sequence.event,

                name:
                    normalizedName,

                timestamp:
                    this.clock.now(),

                source:
                    this.name,

                version:
                    this.version,

                instanceId:
                    this.instanceId,

                payload:
                    this.clonePlainValue(payload),

                metadata:
                    this.clonePlainValue(
                        options.metadata || {}
                    )
            };

            if (
                this.config.enableInternalEventHistory === true
            ) {

                this.internalEventHistory.push(event);

                const maximum =
                    Number.isFinite(
                        this.config.maximumEventHistory
                    )
                        ? Math.max(
                            1,
                            this.config.maximumEventHistory
                        )
                        : DEFAULT_MAXIMUM_EVENT_HISTORY;

                if (
                    this.internalEventHistory.length >
                    maximum
                ) {
                    this.internalEventHistory.splice(
                        0,
                        this.internalEventHistory.length -
                        maximum
                    );
                }
            }

            this.dispatchInternalEvent(
                normalizedName,
                event
            );

            if (
                this.config.useExternalEventBus === true &&
                options.external !== false
            ) {
                this.dispatchExternalEvent(
                    normalizedName,
                    event
                );
            }

            if (
                this.config.emitWindowEvents === true &&
                options.window !== false
            ) {
                this.dispatchWindowEvent(
                    normalizedName,
                    event
                );
            }

            return event;
        }

        dispatchInternalEvent(
            eventName,
            event
        ) {

            const persistentListeners =
                this.listeners.get(eventName);

            if (
                persistentListeners instanceof Set
            ) {

                for (
                    const listener
                    of [...persistentListeners]
                ) {

                    try {
                        listener(
                            event.payload,
                            event
                        );
                    } catch (error) {
                        this.captureError(
                            error,
                            `event-listener:${eventName}`
                        );
                    }
                }
            }

            const singleUseListeners =
                this.onceListeners.get(eventName);

            if (
                singleUseListeners instanceof Set
            ) {

                this.onceListeners.delete(eventName);

                for (
                    const listener
                    of [...singleUseListeners]
                ) {

                    try {
                        listener(
                            event.payload,
                            event
                        );
                    } catch (error) {
                        this.captureError(
                            error,
                            `once-listener:${eventName}`
                        );
                    }
                }
            }

            const wildcardListeners =
                this.listeners.get("*");

            if (
                wildcardListeners instanceof Set
            ) {

                for (
                    const listener
                    of [...wildcardListeners]
                ) {

                    try {
                        listener(
                            event.payload,
                            event
                        );
                    } catch (error) {
                        this.captureError(
                            error,
                            "event-listener:wildcard"
                        );
                    }
                }
            }
        }

        dispatchExternalEvent(
            eventName,
            event
        ) {

            const bus =
                this.externalEventBus;

            if (!bus) {
                return false;
            }

            try {

                if (
                    typeof bus.emit === "function"
                ) {
                    bus.emit(
                        eventName,
                        event.payload,
                        event
                    );

                    return true;
                }

                if (
                    typeof bus.publish === "function"
                ) {
                    bus.publish(
                        eventName,
                        event
                    );

                    return true;
                }

                if (
                    typeof bus.dispatch === "function"
                ) {
                    bus.dispatch(
                        eventName,
                        event
                    );

                    return true;
                }

                if (
                    typeof bus.dispatchEvent === "function" &&
                    typeof CustomEvent !== "undefined"
                ) {

                    bus.dispatchEvent(
                        new CustomEvent(
                            eventName,
                            {
                                detail: event
                            }
                        )
                    );

                    return true;
                }

            } catch (error) {
                this.captureError(
                    error,
                    `external-event:${eventName}`
                );
            }

            return false;
        }

        dispatchWindowEvent(
            eventName,
            event
        ) {

            if (
                typeof globalScope?.dispatchEvent !==
                    "function" ||
                typeof CustomEvent === "undefined"
            ) {
                return false;
            }

            try {

                globalScope.dispatchEvent(
                    new CustomEvent(
                        eventName,
                        {
                            detail: event
                        }
                    )
                );

                return true;

            } catch (error) {

                this.captureError(
                    error,
                    `window-event:${eventName}`
                );

                return false;
            }
        }

        on(
            eventName,
            listener
        ) {

            const normalizedName =
                String(eventName || "")
                    .trim();

            if (
                !normalizedName ||
                typeof listener !== "function"
            ) {
                return () => {};
            }

            if (
                !this.listeners.has(normalizedName)
            ) {
                this.listeners.set(
                    normalizedName,
                    new Set()
                );
            }

            this.listeners
                .get(normalizedName)
                .add(listener);

            this.refreshMemoryMetrics();

            return () => {
                this.off(
                    normalizedName,
                    listener
                );
            };
        }

        once(
            eventName,
            listener
        ) {

            const normalizedName =
                String(eventName || "")
                    .trim();

            if (
                !normalizedName ||
                typeof listener !== "function"
            ) {
                return () => {};
            }

            if (
                !this.onceListeners.has(normalizedName)
            ) {
                this.onceListeners.set(
                    normalizedName,
                    new Set()
                );
            }

            this.onceListeners
                .get(normalizedName)
                .add(listener);

            this.refreshMemoryMetrics();

            return () => {

                const listeners =
                    this.onceListeners.get(
                        normalizedName
                    );

                if (
                    !(listeners instanceof Set)
                ) {
                    return false;
                }

                const deleted =
                    listeners.delete(listener);

                if (
                    listeners.size === 0
                ) {
                    this.onceListeners.delete(
                        normalizedName
                    );
                }

                this.refreshMemoryMetrics();

                return deleted;
            };
        }

        off(
            eventName,
            listener
        ) {

            const normalizedName =
                String(eventName || "")
                    .trim();

            if (!normalizedName) {
                return false;
            }

            let deleted =
                false;

            const persistentListeners =
                this.listeners.get(normalizedName);

            if (
                persistentListeners instanceof Set
            ) {

                if (
                    typeof listener === "function"
                ) {
                    deleted =
                        persistentListeners.delete(
                            listener
                        ) || deleted;
                } else {
                    deleted =
                        persistentListeners.size > 0 ||
                        deleted;

                    persistentListeners.clear();
                }

                if (
                    persistentListeners.size === 0
                ) {
                    this.listeners.delete(
                        normalizedName
                    );
                }
            }

            const singleUseListeners =
                this.onceListeners.get(
                    normalizedName
                );

            if (
                singleUseListeners instanceof Set
            ) {

                if (
                    typeof listener === "function"
                ) {
                    deleted =
                        singleUseListeners.delete(
                            listener
                        ) || deleted;
                } else {
                    deleted =
                        singleUseListeners.size > 0 ||
                        deleted;

                    singleUseListeners.clear();
                }

                if (
                    singleUseListeners.size === 0
                ) {
                    this.onceListeners.delete(
                        normalizedName
                    );
                }
            }

            this.refreshMemoryMetrics();

            return deleted;
        }

        removeAllListeners(
            eventName = null
        ) {

            if (
                eventName !== null &&
                eventName !== undefined
            ) {

                const normalizedName =
                    String(eventName)
                        .trim();

                this.listeners.delete(
                    normalizedName
                );

                this.onceListeners.delete(
                    normalizedName
                );

                this.refreshMemoryMetrics();

                return true;
            }

            this.listeners.clear();
            this.onceListeners.clear();

            this.refreshMemoryMetrics();

            return true;
        }

        /* ==================================================================
         * Logger
         * ================================================================== */

        shouldLog(level) {

            const normalizedLevel =
                this.normalizeLogLevel(level);

            const currentPriority =
                ENGINE_LOG_LEVEL_PRIORITY[
                    this.logLevel
                ] ??
                ENGINE_LOG_LEVEL_PRIORITY.info;

            const requestedPriority =
                ENGINE_LOG_LEVEL_PRIORITY[
                    normalizedLevel
                ] ??
                ENGINE_LOG_LEVEL_PRIORITY.info;

            return (
                requestedPriority >=
                    currentPriority &&
                this.logLevel !==
                    ENGINE_LOG_LEVELS.SILENT
            );
        }

        writeLog(
            level,
            message,
            context = {}
        ) {

            const normalizedLevel =
                this.normalizeLogLevel(level);

            const entry = {

                timestamp:
                    this.clock.now(),

                level:
                    normalizedLevel,

                engine:
                    this.name,

                version:
                    this.version,

                instanceId:
                    this.instanceId,

                message:
                    String(message || ""),

                context:
                    this.clonePlainValue(
                        context
                    )
            };

            this.logHistory.push(entry);

            const maximum =
                Number.isFinite(
                    this.config.maximumLogHistory
                )
                    ? Math.max(
                        1,
                        this.config.maximumLogHistory
                    )
                    : DEFAULT_MAXIMUM_LOG_HISTORY;

            if (
                this.logHistory.length >
                maximum
            ) {
                this.logHistory.splice(
                    0,
                    this.logHistory.length -
                    maximum
                );
            }

            if (
                this.externalLogger &&
                typeof this.externalLogger[
                    normalizedLevel
                ] === "function"
            ) {

                try {
                    this.externalLogger[
                        normalizedLevel
                    ](
                        entry.message,
                        entry.context,
                        entry
                    );

                    return entry;
                } catch (error) {
                    this.captureError(
                        error,
                        "external-logger"
                    );
                }
            }

            if (
                !this.shouldLog(
                    normalizedLevel
                )
            ) {
                return entry;
            }

            const prefix =
                `[RainGuard V32 Rain Arrival]`;

            const consoleMethod =
                normalizedLevel ===
                    ENGINE_LOG_LEVELS.TRACE
                    ? "debug"
                    : normalizedLevel;

            const outputMethod =
                typeof console?.[
                    consoleMethod
                ] === "function"
                    ? consoleMethod
                    : "log";

            console[outputMethod](
                prefix,
                entry.message,
                entry.context
            );

            return entry;
        }

        log(
            message,
            context = {}
        ) {
            return this.writeLog(
                ENGINE_LOG_LEVELS.INFO,
                message,
                context
            );
        }

        info(
            message,
            context = {}
        ) {
            return this.writeLog(
                ENGINE_LOG_LEVELS.INFO,
                message,
                context
            );
        }

        warn(
            message,
            context = {}
        ) {

            this.sequence.warning += 1;
            this.statistics.totalWarnings += 1;

            const warning = {

                id:
                    this.sequence.warning,

                timestamp:
                    this.clock.now(),

                message:
                    String(message || ""),

                context:
                    this.clonePlainValue(
                        context
                    )
            };

            this.lastWarning =
                warning;

            this.warningHistory.push(
                warning
            );

            const maximum =
                Number.isFinite(
                    this.config.maximumErrorHistory
                )
                    ? Math.max(
                        1,
                        this.config.maximumErrorHistory
                    )
                    : DEFAULT_MAXIMUM_ERROR_HISTORY;

            if (
                this.warningHistory.length >
                maximum
            ) {
                this.warningHistory.splice(
                    0,
                    this.warningHistory.length -
                    maximum
                );
            }

            this.status.warnings =
                this.statistics.totalWarnings;

            this.emit(
                ENGINE_EVENT_NAMES.WARNING,
                warning
            );

            return this.writeLog(
                ENGINE_LOG_LEVELS.WARN,
                message,
                context
            );
        }

        error(
            message,
            context = {}
        ) {

            const normalizedError =
                message instanceof Error
                    ? message
                    : new Error(
                        String(message || "Unknown error")
                    );

            const captured =
                this.captureError(
                    normalizedError,
                    context?.operation ||
                    context?.context ||
                    "engine"
                );

            this.status.healthy =
                false;

            this.emit(
                ENGINE_EVENT_NAMES.ERROR,
                captured
            );

            this.writeLog(
                ENGINE_LOG_LEVELS.ERROR,
                captured.message,
                {
                    ...context,
                    error:
                        captured
                }
            );

            return captured;
        }

        debug(
            message,
            context = {}
        ) {

            if (
                this.debugEnabled !== true
            ) {
                return null;
            }

            return this.writeLog(
                ENGINE_LOG_LEVELS.DEBUG,
                message,
                context
            );
        }

        trace(
            message,
            context = {}
        ) {

            if (
                this.debugEnabled !== true
            ) {
                return null;
            }

            return this.writeLog(
                ENGINE_LOG_LEVELS.TRACE,
                message,
                context
            );
        }

        setLogLevel(level) {

            this.logLevel =
                this.normalizeLogLevel(level);

            this.config.logLevel =
                this.logLevel;

            return this.logLevel;
        }

        setDebug(enabled) {

            this.debugEnabled =
                Boolean(enabled);

            this.config.debug =
                this.debugEnabled;

            return this.debugEnabled;
        }

        getLogs(
            limit = 100,
            level = null
        ) {

            const safeLimit =
                Number.isFinite(Number(limit))
                    ? Math.max(
                        1,
                        Math.floor(Number(limit))
                    )
                    : 100;

            let records =
                [...this.logHistory];

            if (level) {

                const normalizedLevel =
                    this.normalizeLogLevel(level);

                records =
                    records.filter(
                        (entry) =>
                            entry.level ===
                            normalizedLevel
                    );
            }

            return this.clonePlainValue(
                records.slice(-safeLimit)
            );
        }

        /* ==================================================================
         * Initialization
         * ================================================================== */

        async initialize() {

            if (this.destroyed) {
                throw new Error(
                    "Cannot initialize a destroyed engine."
                );
            }

            if (this.initialized) {
                return this.getStatus();
            }

            if (
                this.initializing &&
                this.pendingStartPromise
            ) {
                return this.pendingStartPromise;
            }

            this.initializing =
                true;

            this.updateRuntimeState(
                ENGINE_RUNTIME_STATES.INITIALIZING,
                {
                    reason:
                        "initialize"
                }
            );

            try {

                this.validateConfiguration();

                this.status.healthy =
                    true;

                this.initialized =
                    true;

                this.status.initialized =
                    true;

                this.initializing =
                    false;

                this.updateRuntimeState(
                    ENGINE_RUNTIME_STATES.READY,
                    {
                        reason:
                            "initialization-completed"
                    }
                );

                this.recordOperation(
                    "engine-initialized",
                    {
                        instanceId:
                            this.instanceId
                    }
                );

                this.emit(
                    ENGINE_EVENT_NAMES.INITIALIZED,
                    this.getStatus()
                );

                this.debug(
                    "Engine initialized successfully.",
                    {
                        instanceId:
                            this.instanceId
                    }
                );

                return this.getStatus();

            } catch (error) {

                this.initializing =
                    false;

                this.initialized =
                    false;

                this.status.initialized =
                    false;

                this.updateRuntimeState(
                    ENGINE_RUNTIME_STATES.ERROR,
                    {
                        reason:
                            "initialization-failed"
                    }
                );

                this.error(
                    error,
                    {
                        operation:
                            "initialize"
                    }
                );

                throw error;
            }
        }

        validateConfiguration() {

            const horizons =
                Array.isArray(
                    this.config.predictionHorizonsMinutes
                )
                    ? this.config
                        .predictionHorizonsMinutes
                    : [];

            const normalizedHorizons =
                [...new Set(
                    horizons
                        .map(Number)
                        .filter(
                            (value) =>
                                Number.isFinite(value) &&
                                value > 0 &&
                                value <=
                                    this.config
                                        .maximumPredictionMinutes
                        )
                        .map(
                            (value) =>
                                Math.round(value)
                        )
                )]
                    .sort(
                        (a, b) => a - b
                    );

            if (
                normalizedHorizons.length === 0
            ) {
                throw new Error(
                    "predictionHorizonsMinutes must contain at least one valid horizon."
                );
            }

            this.config.predictionHorizonsMinutes =
                normalizedHorizons;

            this.config.updateIntervalMs =
                Math.max(
                    1000,
                    Number(
                        this.config.updateIntervalMs
                    ) ||
                    DEFAULT_UPDATE_INTERVAL_MS
                );

            this.config.cleanupIntervalMs =
                Math.max(
                    1000,
                    Number(
                        this.config.cleanupIntervalMs
                    ) ||
                    DEFAULT_CLEANUP_INTERVAL_MS
                );

            this.config.staleCellMinutes =
                Math.max(
                    1,
                    Number(
                        this.config.staleCellMinutes
                    ) ||
                    DEFAULT_STALE_CELL_MINUTES
                );

            this.config.minimumTrackingPoints =
                Math.max(
                    1,
                    Math.floor(
                        Number(
                            this.config
                                .minimumTrackingPoints
                        ) ||
                        DEFAULT_MINIMUM_TRACKING_POINTS
                    )
                );

            this.config.maximumTrackingPoints =
                Math.max(
                    this.config.minimumTrackingPoints,
                    Math.floor(
                        Number(
                            this.config
                                .maximumTrackingPoints
                        ) ||
                        DEFAULT_MAXIMUM_TRACKING_POINTS
                    )
                );

            this.config.minimumConfidence =
                Math.max(
                    MINIMUM_CONFIDENCE,
                    Math.min(
                        MAXIMUM_CONFIDENCE,
                        Number(
                            this.config
                                .minimumConfidence
                        ) || 0
                    )
                );

            this.config.maximumConfidence =
                Math.max(
                    this.config.minimumConfidence,
                    Math.min(
                        MAXIMUM_CONFIDENCE,
                        Number(
                            this.config
                                .maximumConfidence
                        ) ||
                        MAXIMUM_CONFIDENCE
                    )
                );

            return true;
        }

        /* ==================================================================
         * Lifecycle
         * ================================================================== */

        async start() {

            if (this.destroyed) {
                throw new Error(
                    "Cannot start a destroyed engine."
                );
            }

            if (
                this.running &&
                !this.paused
            ) {
                return this.getStatus();
            }

            if (this.pendingStartPromise) {
                return this.pendingStartPromise;
            }

            this.pendingStartPromise =
                (async () => {

                    try {

                        if (!this.initialized) {
                            await this.initialize();
                        }

                        this.running =
                            true;

                        this.paused =
                            false;

                        this.stopping =
                            false;

                        this.startedAt =
                            this.startedAt ||
                            this.clock.now();

                        this.stoppedAt =
                            null;

                        this.pausedAt =
                            null;

                        this.resumedAt =
                            null;

                        this.status.startedAt =
                            this.startedAt;

                        this.status.stoppedAt =
                            null;

                        this.status.pausedAt =
                            null;

                        this.statistics.totalStarts += 1;

                        this.updateRuntimeState(
                            ENGINE_RUNTIME_STATES.RUNNING,
                            {
                                reason:
                                    "start"
                            }
                        );

                        this.startRuntimeTimers();

                        this.recordOperation(
                            "engine-started",
                            {
                                startedAt:
                                    this.startedAt
                            }
                        );

                        this.emit(
                            ENGINE_EVENT_NAMES.STARTED,
                            this.getStatus()
                        );

                        this.log(
                            "Rain Arrival Prediction Engine started.",
                            {
                                version:
                                    this.version,

                                instanceId:
                                    this.instanceId
                            }
                        );

                        return this.getStatus();

                    } catch (error) {

                        this.running =
                            false;

                        this.paused =
                            false;

                        this.updateRuntimeState(
                            ENGINE_RUNTIME_STATES.ERROR,
                            {
                                reason:
                                    "start-failed"
                            }
                        );

                        this.error(
                            error,
                            {
                                operation:
                                    "start"
                            }
                        );

                        throw error;

                    } finally {

                        this.pendingStartPromise =
                            null;
                    }
                })();

            return this.pendingStartPromise;
        }

        async stop(
            options = {}
        ) {

            if (this.destroyed) {
                return this.getStatus();
            }

            if (
                !this.running &&
                this.runtimeState ===
                    ENGINE_RUNTIME_STATES.STOPPED
            ) {
                return this.getStatus();
            }

            if (this.pendingStopPromise) {
                return this.pendingStopPromise;
            }

            this.pendingStopPromise =
                (async () => {

                    try {

                        this.stopping =
                            true;

                        this.stopRuntimeTimers();

                        this.running =
                            false;

                        this.paused =
                            false;

                        this.stoppedAt =
                            this.clock.now();

                        this.status.stoppedAt =
                            this.stoppedAt;

                        this.statistics.totalStops += 1;

                        this.updateRuntimeState(
                            ENGINE_RUNTIME_STATES.STOPPED,
                            {
                                reason:
                                    options.reason ||
                                    "stop"
                            }
                        );

                        if (
                            options.clear === true ||
                            (
                                options.clear ===
                                    undefined &&
                                this.config
                                    .preserveStateOnStop ===
                                    false
                            )
                        ) {
                            this.clear({
                                preserveCities:
                                    true,

                                preserveRegions:
                                    true,

                                preserveListeners:
                                    true
                            });
                        }

                        this.recordOperation(
                            "engine-stopped",
                            {
                                stoppedAt:
                                    this.stoppedAt,

                                reason:
                                    options.reason ||
                                    "stop"
                            }
                        );

                        this.emit(
                            ENGINE_EVENT_NAMES.STOPPED,
                            this.getStatus()
                        );

                        this.log(
                            "Rain Arrival Prediction Engine stopped.",
                            {
                                stoppedAt:
                                    this.stoppedAt
                            }
                        );

                        return this.getStatus();

                    } catch (error) {

                        this.error(
                            error,
                            {
                                operation:
                                    "stop"
                            }
                        );

                        throw error;

                    } finally {

                        this.stopping =
                            false;

                        this.pendingStopPromise =
                            null;
                    }
                })();

            return this.pendingStopPromise;
        }

        async pause() {

            if (this.destroyed) {
                throw new Error(
                    "Cannot pause a destroyed engine."
                );
            }

            if (!this.running) {
                throw new Error(
                    "Engine must be running before it can be paused."
                );
            }

            if (this.paused) {
                return this.getStatus();
            }

            this.stopRuntimeTimers();

            this.paused =
                true;

            this.running =
                false;

            this.pausedAt =
                this.clock.now();

            this.status.pausedAt =
                this.pausedAt;

            this.statistics.totalPauses += 1;

            this.updateRuntimeState(
                ENGINE_RUNTIME_STATES.PAUSED,
                {
                    reason:
                        "pause"
                }
            );

            this.recordOperation(
                "engine-paused",
                {
                    pausedAt:
                        this.pausedAt
                }
            );

            this.emit(
                ENGINE_EVENT_NAMES.PAUSED,
                this.getStatus()
            );

            this.log(
                "Rain Arrival Prediction Engine paused.",
                {
                    pausedAt:
                        this.pausedAt
                }
            );

            return this.getStatus();
        }

        async resume() {

            if (this.destroyed) {
                throw new Error(
                    "Cannot resume a destroyed engine."
                );
            }

            if (!this.paused) {

                if (this.running) {
                    return this.getStatus();
                }

                return this.start();
            }

            this.paused =
                false;

            this.running =
                true;

            this.resumedAt =
                this.clock.now();

            this.status.resumedAt =
                this.resumedAt;

            this.statistics.totalResumes += 1;

            this.updateRuntimeState(
                ENGINE_RUNTIME_STATES.RUNNING,
                {
                    reason:
                        "resume"
                }
            );

            this.startRuntimeTimers();

            this.recordOperation(
                "engine-resumed",
                {
                    resumedAt:
                        this.resumedAt
                }
            );

            this.emit(
                ENGINE_EVENT_NAMES.RESUMED,
                this.getStatus()
            );

            this.log(
                "Rain Arrival Prediction Engine resumed.",
                {
                    resumedAt:
                        this.resumedAt
                }
            );

            return this.getStatus();
        }

        async restart(
            options = {}
        ) {

            if (this.destroyed) {
                throw new Error(
                    "Cannot restart a destroyed engine."
                );
            }

            if (this.restartInProgress) {
                return this.getStatus();
            }

            this.restartInProgress =
                true;

            try {

                await this.stop({
                    reason:
                        "restart",

                    clear:
                        options.clear === true
                });

                if (
                    Number.isFinite(
                        Number(options.delayMs)
                    ) &&
                    Number(options.delayMs) > 0
                ) {
                    await this.delay(
                        Number(options.delayMs)
                    );
                }

                const result =
                    await this.start();

                this.statistics.totalRestarts += 1;

                this.recordOperation(
                    "engine-restarted",
                    {
                        timestamp:
                            this.clock.now()
                    }
                );

                this.emit(
                    ENGINE_EVENT_NAMES.RESTARTED,
                    result
                );

                return result;

            } finally {

                this.restartInProgress =
                    false;
            }
        }

        /* ==================================================================
         * Runtime timers
         * ================================================================== */

        startRuntimeTimers() {

            this.stopRuntimeTimers();

            const updateInterval =
                Math.max(
                    1000,
                    Number(
                        this.config.updateIntervalMs
                    ) ||
                    DEFAULT_UPDATE_INTERVAL_MS
                );

            this.heartbeatTimer =
                globalScope.setInterval(
                    () => {

                        try {
                            this.runHeartbeat();
                        } catch (error) {
                            this.error(
                                error,
                                {
                                    operation:
                                        "heartbeat"
                                }
                            );
                        }
                    },
                    updateInterval
                );

            if (
                this.config.autoCleanup === true
            ) {

                const cleanupInterval =
                    Math.max(
                        1000,
                        Number(
                            this.config.cleanupIntervalMs
                        ) ||
                        DEFAULT_CLEANUP_INTERVAL_MS
                    );

                this.cleanupTimer =
                    globalScope.setInterval(
                        () => {

                            try {

                                if (
                                    typeof this
                                        .cleanupStaleRuntimeData ===
                                    "function"
                                ) {
                                    this.cleanupStaleRuntimeData();
                                }

                            } catch (error) {
                                this.error(
                                    error,
                                    {
                                        operation:
                                            "automatic-cleanup"
                                    }
                                );
                            }
                        },
                        cleanupInterval
                    );
            }

            return true;
        }

        stopRuntimeTimers() {

            if (this.updateTimer) {
                globalScope.clearInterval(
                    this.updateTimer
                );

                globalScope.clearTimeout(
                    this.updateTimer
                );

                this.updateTimer =
                    null;
            }

            if (this.cleanupTimer) {
                globalScope.clearInterval(
                    this.cleanupTimer
                );

                globalScope.clearTimeout(
                    this.cleanupTimer
                );

                this.cleanupTimer =
                    null;
            }

            if (this.heartbeatTimer) {
                globalScope.clearInterval(
                    this.heartbeatTimer
                );

                globalScope.clearTimeout(
                    this.heartbeatTimer
                );

                this.heartbeatTimer =
                    null;
            }

            return true;
        }

        runHeartbeat() {

            if (
                !this.running ||
                this.paused ||
                this.destroyed
            ) {
                return false;
            }

            const now =
                this.clock.now();

            this.lastUpdateAt =
                now;

            this.status.lastUpdateAt =
                now;

            this.updateUptime();
            this.refreshStatusCounters();
            this.refreshMemoryMetrics();

            this.emit(
                ENGINE_EVENT_NAMES.STATUS_CHANGED,
                this.getStatus(),
                {
                    window:
                        false
                }
            );

            return true;
        }

        updateUptime() {

            const now =
                this.clock.now();

            const uptime =
                this.startedAt
                    ? Math.max(
                        0,
                        now -
                        this.startedAt
                    )
                    : 0;

            this.status.uptimeMs =
                uptime;

            this.metrics.engineUptimeMs =
                uptime;

            return uptime;
        }

        /* ==================================================================
         * Status and metrics
         * ================================================================== */

        isRunning() {
            return (
                this.running === true &&
                this.paused === false &&
                this.destroyed === false
            );
        }

        isPaused() {
            return (
                this.paused === true &&
                this.destroyed === false
            );
        }

        isDestroyed() {
            return this.destroyed === true;
        }

        isReady() {
            return (
                this.initialized === true &&
                this.destroyed === false &&
                this.runtimeState !==
                    ENGINE_RUNTIME_STATES.ERROR
            );
        }

        getVersion() {

            return {

                name:
                    this.name,

                version:
                    this.version,

                build:
                    this.build,

                namespace:
                    this.namespace,

                instanceId:
                    this.instanceId
            };
        }

        getStatus() {

            this.updateUptime();
            this.refreshStatusCounters();
            this.refreshMemoryMetrics();

            const result = {

                ...this.status,

                state:
                    this.runtimeState,

                running:
                    this.isRunning(),

                paused:
                    this.isPaused(),

                initialized:
                    this.initialized,

                destroyed:
                    this.destroyed,

                version:
                    this.version,

                build:
                    this.build,

                instanceId:
                    this.instanceId,

                lastError:
                    this.clonePlainValue(
                        this.lastError
                    ),

                lastWarning:
                    this.clonePlainValue(
                        this.lastWarning
                    )
            };

            return this.clonePublicResult(
                result
            );
        }

        getStatistics() {

            return this.clonePublicResult({

                ...this.statistics,

                activeCells:
                    this.cells.size,

                registeredCities:
                    this.cities.size,

                registeredRegions:
                    this.regions.size,

                eventHistorySize:
                    this.internalEventHistory
                        .length,

                errorHistorySize:
                    this.errorHistory.length,

                warningHistorySize:
                    this.warningHistory.length,

                logHistorySize:
                    this.logHistory.length
            });
        }

        getMetrics() {

            this.updateUptime();
            this.refreshMemoryMetrics();

            return this.clonePublicResult(
                this.metrics
            );
        }

        getHealth() {

            const healthy =
                this.destroyed === false &&
                this.runtimeState !==
                    ENGINE_RUNTIME_STATES.ERROR &&
                this.status.healthy !== false;

            return this.clonePublicResult({

                healthy,

                state:
                    this.runtimeState,

                running:
                    this.isRunning(),

                initialized:
                    this.initialized,

                destroyed:
                    this.destroyed,

                errors:
                    this.statistics.totalErrors,

                warnings:
                    this.statistics.totalWarnings,

                lastError:
                    this.lastError,

                lastUpdateAt:
                    this.lastUpdateAt,

                uptimeMs:
                    this.updateUptime()
            });
        }

        refreshStatusCounters() {

            this.status.cellsTracked =
                this.cells.size;

            this.status.citiesRegistered =
                this.cities.size;

            this.status.regionsRegistered =
                this.regions.size;

            this.status.activePredictions =
                this.predictionHistory.size;

            this.status.pendingOperations =
                this.pendingOperations.size;

            this.status.errors =
                this.statistics.totalErrors;

            this.status.warnings =
                this.statistics.totalWarnings;

            return this.status;
        }

        refreshMemoryMetrics() {

            const historyStores = [

                this.cellHistory,
                this.cityImpactHistory,
                this.arrivalHistory,
                this.motionHistory,
                this.weightHistory,
                this.predictionHistory,
                this.trackingHistory,
                this.sourceQualityHistory,
                this.finalMotionHistory,
                this.corridorHistory
            ];

            const totalHistoryRecords =
                historyStores.reduce(
                    (
                        total,
                        store
                    ) => {

                        if (
                            !(store instanceof Map)
                        ) {
                            return total;
                        }

                        let count =
                            store.size;

                        for (
                            const value
                            of store.values()
                        ) {

                            if (
                                Array.isArray(value)
                            ) {
                                count +=
                                    value.length;
                            }
                        }

                        return total + count;
                    },
                    0
                );

            const listenerCount =
                this.countListeners(
                    this.listeners
                ) +
                this.countListeners(
                    this.onceListeners
                );

            this.metrics.memory = {

                cells:
                    this.cells.size,

                cities:
                    this.cities.size,

                regions:
                    this.regions.size,

                cache:
                    this.cache.size,

                histories:
                    totalHistoryRecords,

                listeners:
                    listenerCount,

                pendingOperations:
                    this.pendingOperations.size
            };

            return this.metrics.memory;
        }

        countListeners(store) {

            if (
                !(store instanceof Map)
            ) {
                return 0;
            }

            let count =
                0;

            for (
                const value
                of store.values()
            ) {

                if (
                    value instanceof Set
                ) {
                    count +=
                        value.size;
                }
            }

            return count;
        }

        clonePublicResult(value) {

            const result =
                this.clonePlainValue(value);

            if (
                this.config.freezePublicResults ===
                true
            ) {
                return this.deepFreezeValue(
                    result
                );
            }

            return result;
        }

        deepFreezeValue(value) {

            if (
                !value ||
                typeof value !== "object" ||
                Object.isFrozen(value)
            ) {
                return value;
            }

            Object.freeze(value);

            for (
                const child
                of Object.values(value)
            ) {
                this.deepFreezeValue(child);
            }

            return value;
        }

        delay(milliseconds = 0) {

            const safeDelay =
                Math.max(
                    0,
                    Number(milliseconds) || 0
                );

            return new Promise(
                (resolve) => {
                    globalScope.setTimeout(
                        resolve,
                        safeDelay
                    );
                }
            );
        }

    /* ======================================================================
     * Temporary export
     *
     * The final singleton export will be completed in Part 1C.
     * ====================================================================== */

    globalScope.RainArrivalPredictionEngineV32 =
        RainArrivalPredictionEngineV32;

    globalScope.RG32 =
        globalScope.RG32 || {};

    globalScope.RG32.RainArrivalPredictionEngine =
        RainArrivalPredictionEngineV32;

    globalScope.RG32.constants = {
        ENGINE_NAME,
        ENGINE_VERSION,
        ENGINE_NAMESPACE,
        ENGINE_BUILD,
        EARTH_RADIUS_KM,
        DEFAULT_CONFIG,
        ENGINE_RUNTIME_STATES,
        ENGINE_EVENT_NAMES,
        ENGINE_LOG_LEVELS,
        LIFECYCLE_STATES,
        MOTION_SOURCE_NAMES
    };

})(
    typeof window !== "undefined"
        ? window
        : globalThis
);
