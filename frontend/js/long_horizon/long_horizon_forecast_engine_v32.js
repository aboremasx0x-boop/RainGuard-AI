/* ======================================================================
   RAIN GUARD AI V32
   LONG HORIZON FORECAST ENGINE
   PART 1
   FOUNDATION, CONSTANTS, STATE, AND CORE CLASS
   ====================================================================== */

(function initializeLongHorizonForecastEngineV32(
    global
) {

    "use strict";

    /* ==================================================================
       SECTION 1
       VERSION
       ================================================================== */

    const LONG_HORIZON_FORECAST_VERSION =
        "32.3.0";

    const LONG_HORIZON_FORECAST_BUILD =
        "3231";

    const LONG_HORIZON_FORECAST_ENGINE_NAME =
        "LongHorizonForecastEngineV32";

    /* ==================================================================
       SECTION 2
       REQUIRED HORIZONS
       ================================================================== */

    const LONG_HORIZON_FORECAST_HORIZONS =
        Object.freeze([
            6,
            12,
            24,
            48,
            72
        ]);

    const LONG_HORIZON_FORECAST_HORIZON_LABELS =
        Object.freeze({

            6:
                "6h",

            12:
                "12h",

            24:
                "24h",

            48:
                "48h",

            72:
                "72h"

        });

    /* ==================================================================
       SECTION 3
       ENGINE STATUS
       ================================================================== */

    const LONG_HORIZON_FORECAST_STATUS =
        Object.freeze({

            IDLE:
                "idle",

            INITIALIZING:
                "initializing",

            READY:
                "ready",

            RUNNING:
                "running",

            COMPLETED:
                "completed",

            PARTIAL:
                "partial",

            FAILED:
                "failed",

            PAUSED:
                "paused",

            DESTROYED:
                "destroyed"

        });

    /* ==================================================================
       SECTION 4
       FORECAST STATUS
       ================================================================== */

    const LONG_HORIZON_FORECAST_RESULT_STATUS =
        Object.freeze({

            AVAILABLE:
                "available",

            PARTIAL:
                "partial",

            UNAVAILABLE:
                "unavailable",

            STALE:
                "stale",

            FAILED:
                "failed"

        });

    /* ==================================================================
       SECTION 5
       EVENT NAMES
       ================================================================== */

    const LONG_HORIZON_FORECAST_EVENT =
        Object.freeze({

            INITIALIZED:
                "long_horizon_forecast_initialized",

            STARTED:
                "long_horizon_forecast_started",

            HORIZON_STARTED:
                "long_horizon_forecast_horizon_started",

            HORIZON_COMPLETED:
                "long_horizon_forecast_horizon_completed",

            HORIZON_FAILED:
                "long_horizon_forecast_horizon_failed",

            COMPLETED:
                "long_horizon_forecast_completed",

            FAILED:
                "long_horizon_forecast_failed",

            STATE_UPDATED:
                "long_horizon_forecast_state_updated",

            DESTROYED:
                "long_horizon_forecast_destroyed"

        });

    /* ==================================================================
       SECTION 6
       DEFAULT CONFIGURATION
       ================================================================== */

    const DEFAULT_LONG_HORIZON_FORECAST_CONFIGURATION =
        Object.freeze({

            horizons:
                LONG_HORIZON_FORECAST_HORIZONS,

            autoInitialize:
                true,

            autoAttachToCore:
                true,

            allowPartialResults:
                true,

            preservePreviousForecasts:
                true,

            maximumForecastAgeMs:
                6 *
                60 *
                60 *
                1000,

            minimumConfidence:
                0.25,

            minimumSourceCount:
                1,

            defaultCity:
                null,

            defaultRegion:
                null,

            runtimeMode:
                "automatic",

            nationalConcurrency:
                4,

            nationalBatchDelayMs:
                0,

            maximumStoredArrivalPredictions:
                1500,

            maximumStoredForecastHistory:
                3,

            retainRawResults:
                false,

            cacheTtlMs:
                10 *
                60 *
                1000,

            enableNationalCache:
                true,

            metadata:
                {}

        });

    /* ==================================================================
       SECTION 7
       BASIC HELPERS
       ================================================================== */

    function now() {

        return Date.now();

    }

    /* ================================================================= */

    function safeObject(
        value
    ) {

        return (
            value &&
            typeof value ===
                "object" &&
            !Array.isArray(
                value
            )
        )
            ? value
            : {};

    }

    /* ================================================================= */

    function safeArray(
        value
    ) {

        return Array.isArray(
            value
        )
            ? value
            : [];

    }

    /* ================================================================= */

    function safeNumber(
        value,
        fallback = 0
    ) {

        if (
            value === null ||
            value === undefined ||
            value === ""
        ) {
            return fallback;
        }

        const numeric =
            Number(
                value
            );

        return Number.isFinite(
            numeric
        )
            ? numeric
            : fallback;

    }

    /* ================================================================= */

    function clamp(
        value,
        minimum = 0,
        maximum = 1
    ) {

        return Math.min(
            maximum,
            Math.max(
                minimum,
                safeNumber(
                    value,
                    minimum
                )
            )
        );

    }

    /* ================================================================= */

    function createId(
        prefix =
            "long_horizon_forecast"
    ) {

        return [
            prefix,
            now(),
            Math
                .random()
                .toString(
                    36
                )
                .slice(
                    2,
                    10
                )
        ].join(
            "_"
        );

    }

    /* ================================================================= */

    function normalizeError(
        error
    ) {

        if (
            error instanceof
            Error
        ) {
            return {

                name:
                    error.name,

                message:
                    error.message,

                stack:
                    error.stack ||
                    null

            };
        }

        if (
            typeof error ===
            "string"
        ) {
            return {

                name:
                    "Error",

                message:
                    error,

                stack:
                    null

            };
        }

        return {

            name:
                "Error",

            message:
                "Unknown long horizon forecast error.",

            stack:
                null

        };

    }

    /* ================================================================= */

    function deepClone(
        value
    ) {

        if (
            value ===
            undefined
        ) {
            return undefined;
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
                // Fallback below.
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

    /* ================================================================= */

    function normalizeHorizons(
        horizons
    ) {

        const normalized =
            safeArray(
                horizons
            )
                .map(
                    (horizon) => {
                        return safeNumber(
                            horizon,
                            0
                        );
                    }
                )
                .filter(
                    (horizon) => {
                        return (
                            horizon >
                            0
                        );
                    }
                );

        const unique =
            [
                ...new Set(
                    normalized
                )
            ];

        return unique.length
            ? unique.sort(
                (
                    first,
                    second
                ) => {
                    return (
                        first -
                        second
                    );
                }
            )
            : [
                ...LONG_HORIZON_FORECAST_HORIZONS
            ];

    }

    /* ================================================================= */

    function normalizeTextKey(
        value
    ) {

        return String(
            value ??
            ""
        )
            .trim()
            .toLowerCase()
            .replace(
                /[\s_\-]+/g,
                "-"
            )
            .replace(
                /[^\p{L}\p{N}.-]+/gu,
                ""
            );

    }

    /* ================================================================= */

    function createLocationKey(
        location = {}
    ) {

        const source =
            safeObject(
                location
            );

        const id =
            source.locationId ??
            source.id ??
            source.code ??
            null;

        if (
            id !== null &&
            id !== undefined &&
            String(id).trim()
        ) {
            return `id:${normalizeTextKey(id)}`;
        }

        const city =
            source.city ??
            source.nameAr ??
            source.nameEn ??
            source.name ??
            "unknown";

        const region =
            source.region ??
            source.regionNameAr ??
            source.regionNameEn ??
            source.regionName ??
            "unknown";

        const latitude =
            safeNumber(
                source.latitude ??
                source.lat,
                null
            );

        const longitude =
            safeNumber(
                source.longitude ??
                source.lon ??
                source.lng,
                null
            );

        return [
            normalizeTextKey(region),
            normalizeTextKey(city),
            latitude === null
                ? "na"
                : latitude.toFixed(4),
            longitude === null
                ? "na"
                : longitude.toFixed(4)
        ].join(
            ":"
        );

    }

    /* ================================================================= */

    function createArrivalPredictionKey(
        prediction = {}
    ) {

        const source =
            safeObject(
                prediction
            );

        const locationKey =
            source.locationKey ||
            createLocationKey(
                source
            );

        const timestamp =
            safeNumber(
                source.arrivalTimestamp,
                null
            );

        const arrivalBucket =
            timestamp === null
                ? Math.round(
                    safeNumber(
                        source.arrivalMinutes,
                        -1
                    ) / 5
                )
                : Math.round(
                    timestamp /
                    (5 * 60 * 1000)
                );

        return [
            locationKey,
            normalizeTextKey(
                source.source ||
                "arrival"
            ),
            arrivalBucket
        ].join(
            "|"
        );

    }

    /* ================================================================= */

    function delay(
        milliseconds
    ) {

        const duration =
            Math.max(
                0,
                safeNumber(
                    milliseconds,
                    0
                )
            );

        return duration
            ? new Promise(
                (resolve) => {
                    global.setTimeout(
                        resolve,
                        duration
                    );
                }
            )
            : Promise.resolve();

    }

    /* ==================================================================
       SECTION 8
       EVENT EMITTER
       ================================================================== */

    class LongHorizonForecastEmitter {

        constructor() {

            this.listeners =
                new Map();

        }

        on(
            event,
            callback
        ) {

            if (
                typeof callback !==
                "function"
            ) {
                return function noop() {};
            }

            if (
                !this.listeners.has(
                    event
                )
            ) {
                this.listeners.set(
                    event,
                    new Set()
                );
            }

            const listeners =
                this.listeners.get(
                    event
                );

            listeners.add(
                callback
            );

            return () => {

                listeners.delete(
                    callback
                );

            };

        }

        emit(
            event,
            payload
        ) {

            const listeners =
                this.listeners.get(
                    event
                );

            if (
                !listeners
            ) {
                return;
            }

            for (
                const callback of
                listeners
            ) {
                try {

                    callback(
                        payload
                    );

                } catch (error) {

                    console.error(
                        "[LongHorizonForecastV32] Event listener failed.",
                        error
                    );

                }
            }

        }

        clear() {

            this.listeners.clear();

        }

    }

    /* ==================================================================
       SECTION 9
       MAIN CLASS
       ================================================================== */

    class LongHorizonForecastEngineV32 {

        constructor(
            options = {}
        ) {

            this.id =
                createId(
                    "long_horizon_engine"
                );

            this.destroyed =
                false;

            this.events =
                new LongHorizonForecastEmitter();

            this.configuration = {

                ...DEFAULT_LONG_HORIZON_FORECAST_CONFIGURATION,

                ...safeObject(
                    options
                )

            };

            this.configuration.horizons =
                normalizeHorizons(
                    this.configuration.horizons
                );

            this.core =
                options.core ||
                null;

            this.arrivalEngine =
                options.arrivalEngine ||
                options.rainArrivalPredictionEngine ||
                null;

            this.sourceEngine =
                options.sourceEngine ||
                null;

            this.state =
                this.createInitialState();

            if (
                this.configuration
                    .autoInitialize
            ) {
                this.initialize(
                    options
                );
            }

        }

        /* ============================================================= */

        createInitialState() {

            return {

                id:
                    this.id,

                engine:
                    LONG_HORIZON_FORECAST_ENGINE_NAME,

                version:
                    LONG_HORIZON_FORECAST_VERSION,

                build:
                    LONG_HORIZON_FORECAST_BUILD,

                status:
                    LONG_HORIZON_FORECAST_STATUS.IDLE,

                initialized:
                    false,

                running:
                    false,

                destroyed:
                    false,

                startedAt:
                    null,

                completedAt:
                    null,

                durationMs:
                    0,

                lastRunAt:
                    null,

                lastSuccessfulRunAt:
                    null,

                currentHorizon:
                    null,

                horizons:
                    [
                        ...this.configuration.horizons
                    ],

                forecasts:
                    {},

                forecastList:
                    [],

                arrivalPredictions:
                    [],

                latestForecast:
                    null,

                latestPrediction:
                    null,

                latestNationalForecast:
                    null,

                nationalForecastHistory:
                    [],

                cityForecasts:
                    [],

                regionForecasts:
                    [],

                nationalRunning:
                    false,

                nationalProgress:
                    null,

                sourceSummary:
                    {},

                generatedAt:
                    null,

                freshnessTimestamp:
                    null,

                errors:
                    [],

                warnings:
                    [],

                metadata:
                    {}

            };

        }

        /* ============================================================= */

        initialize(
            options = {}
        ) {

            if (
                this.destroyed
            ) {
                throw new Error(
                    "Long horizon forecast engine is destroyed."
                );
            }

            this.state.status =
                LONG_HORIZON_FORECAST_STATUS.INITIALIZING;

            if (
                options.core
            ) {
                this.core =
                    options.core;
            }

            if (
                options.arrivalEngine ||
                options.rainArrivalPredictionEngine
            ) {
                this.arrivalEngine =
                    options.arrivalEngine ||
                    options.rainArrivalPredictionEngine;
            }

            if (
                options.sourceEngine
            ) {
                this.sourceEngine =
                    options.sourceEngine;
            }

            this.state.initialized =
                true;

            this.state.status =
                LONG_HORIZON_FORECAST_STATUS.READY;

            this.emit(
                LONG_HORIZON_FORECAST_EVENT
                    .INITIALIZED,
                {
                    state:
                        this.getState()
                }
            );

            if (
                this.configuration
                    .autoAttachToCore
            ) {
                this.attachToCore(
                    this.core
                );
            }

            return this;

        }

        /* ============================================================= */

        configure(
            options = {}
        ) {

            Object.assign(
                this.configuration,
                safeObject(
                    options
                )
            );

            this.configuration.horizons =
                normalizeHorizons(
                    this.configuration.horizons
                );

            this.state.horizons =
                [
                    ...this.configuration.horizons
                ];

            return this;

        }

        /* ============================================================= */

        attachToCore(
            core
        ) {

            if (
                !core ||
                typeof core !==
                    "object"
            ) {
                return false;
            }

            this.core =
                core;

            core.forecastEngine =
                this;

            core.longHorizonForecastEngine =
                this;

            core.longHorizonForecastEngineV32 =
                this;

            if (
                !core.state ||
                typeof core.state !==
                    "object"
            ) {
                core.state =
                    {};
            }

            if (
                !core.state.forecasts ||
                typeof core.state.forecasts !==
                    "object"
            ) {
                core.state.forecasts =
                    {};
            }

            if (
                !Array.isArray(
                    core.state.horizonForecastList
                )
            ) {
                core.state.horizonForecastList =
                    [];
            }

            if (
                !core.state.horizonForecasts ||
                typeof core.state.horizonForecasts !==
                    "object"
            ) {
                core.state.horizonForecasts =
                    {};
            }

            if (
                !Array.isArray(
                    core.state.arrivalPredictions
                )
            ) {
                core.state.arrivalPredictions =
                    [];
            }

            return true;

        }

        /* ============================================================= */

        setArrivalEngine(
            engine
        ) {

            this.arrivalEngine =
                engine ||
                null;

            return this;

        }

        /* ============================================================= */

        setSourceEngine(
            engine
        ) {

            this.sourceEngine =
                engine ||
                null;

            return this;

        }

        /* ============================================================= */

        on(
            event,
            callback
        ) {

            return this.events.on(
                event,
                callback
            );

        }

        /* ============================================================= */

        emit(
            event,
            payload = {}
        ) {

            this.events.emit(
                event,
                {

                    engineId:
                        this.id,

                    timestamp:
                        now(),

                    ...payload

                }
            );

        }

        /* ============================================================= */

        getState() {

            return deepClone(
                this.state
            );

        }

        /* ============================================================= */

        getStatus() {

            return {

                id:
                    this.id,

                status:
                    this.state.status,

                initialized:
                    this.state.initialized,

                running:
                    this.state.running,

                destroyed:
                    this.destroyed,

                horizons:
                    [
                        ...this.state.horizons
                    ],

                forecastCount:
                    Object.keys(
                        this.state.forecasts
                    ).length,

                generatedAt:
                    this.state.generatedAt,

                errors:
                    this.state.errors.length,

                warnings:
                    this.state.warnings.length

            };

        }

        /* ============================================================= */

        isReady() {

            return (
                !this.destroyed &&
                this.state.initialized &&
                this.state.status !==
                    LONG_HORIZON_FORECAST_STATUS.FAILED
            );

        }

    }

    /* ==================================================================
       SECTION 10
       TEMPORARY GLOBAL EXPORTS
       ================================================================== */

    global.LongHorizonForecastEngineV32 =
        LongHorizonForecastEngineV32;

    global.LongHorizonForecastEngineV32Part1 = {

        LONG_HORIZON_FORECAST_VERSION,

        LONG_HORIZON_FORECAST_BUILD,

        LONG_HORIZON_FORECAST_ENGINE_NAME,

        LONG_HORIZON_FORECAST_HORIZONS,

        LONG_HORIZON_FORECAST_HORIZON_LABELS,

        LONG_HORIZON_FORECAST_STATUS,

        LONG_HORIZON_FORECAST_RESULT_STATUS,

        LONG_HORIZON_FORECAST_EVENT,

        DEFAULT_LONG_HORIZON_FORECAST_CONFIGURATION,

        normalizeHorizons,

        LongHorizonForecastEmitter

    };

    global.LongHorizonForecastEngineV32Part1Loaded =
        true;

    console.log(
        "[RainGuard AI V32] Long Horizon Forecast Engine Part 1 loaded."
    );
  /* ======================================================================
   PART 2
   DEPENDENCY DISCOVERY
   CORE CONNECTION
   ====================================================================== */

Object.assign(
    LongHorizonForecastEngineV32.prototype,
    {

        /* ============================================================= */

        resolveDependencies() {

            const core =
                this.core ||
                global.RainArrivalRecoveryCoreV32Instance ||
                global.LongHorizonRecoveryCoreV32Instance ||
                global.RecoveryCoreV32Instance ||
                global.recoveryCoreV32 ||
                null;

            const candidates = [
                this.arrivalEngine,
                core?.rainArrivalPredictionEngine,
                core?.arrivalPredictionEngine,
                core?.rainArrivalEngine,
                global.RainArrivalPredictionEngineV32Instance,
                global.rainArrivalPredictionEngineV32Instance
            ];

            const arrivalEngine =
                candidates.find(
                    (candidate) => {
                        return (
                            candidate &&
                            candidate !== this &&
                            typeof candidate !== "function"
                        );
                    }
                ) ||
                candidates.find(
                    (candidate) => {
                        return (
                            candidate &&
                            candidate !== this
                        );
                    }
                ) ||
                (
                    typeof global.RainArrivalPredictionEngineV32 ===
                    "function"
                        ? global.RainArrivalPredictionEngineV32
                        : null
                );

            const dependencies = {

                arrivalEngine,

                recoveryCore:
                    core,

                monitoring:
                    global.PostRecoveryMonitoringV32Instance ||
                    global.RecoveryMonitoringV32Instance ||
                    global.LongHorizonMonitoringV32Instance ||
                    global.monitoringEngineV32 ||
                    null,

                verification:
                    global.VerificationEngineV30 ||
                    global.VerificationEngineV31 ||
                    global.verificationEngine ||
                    null,

                visualization:
                    global.StormVisualizationEngineV31 ||
                    global.StormVisualizationV31 ||
                    null,

                tracking:
                    global.StormTrackingEngineV31 ||
                    global.StormCellTrackingEngineV31 ||
                    null

            };

            this.dependencies =
                dependencies;

            if (
                dependencies.arrivalEngine &&
                dependencies.arrivalEngine !== this
            ) {
                this.arrivalEngine =
                    dependencies.arrivalEngine;
            }

            if (
                dependencies.recoveryCore &&
                !this.core
            ) {
                this.core =
                    dependencies.recoveryCore;
            }

            return dependencies;

        },

        /* ============================================================= */

        refreshDependencies() {

            return this.resolveDependencies();

        },

        /* ============================================================= */

        getDependency(
            name
        ) {

            if (
                !this.dependencies
            ) {

                this.resolveDependencies();

            }

            return this.dependencies?.[
                name
            ] || null;

        },

        /* ============================================================= */

        hasDependency(
            name
        ) {

            return !!this.getDependency(
                name
            );

        },

        /* ============================================================= */

        getArrivalEngine() {

            if (
                this.arrivalEngine
            ) {

                return this.arrivalEngine;

            }

            this.resolveDependencies();

            return this.arrivalEngine;

        },

        /* ============================================================= */

        getCore() {

            return (
                this.core ||

                this.getDependency(
                    "recoveryCore"
                )
            );

        },

        /* ============================================================= */

        getMonitoring() {

            return this.getDependency(
                "monitoring"
            );

        },

        /* ============================================================= */

        ensureDependencies() {

            const deps =
                this.resolveDependencies();

            const report = {

                ready: true,

                missing: []

            };

            if (
                !deps.arrivalEngine
            ) {

                report.ready = false;

                report.missing.push(
                    "arrivalEngine"
                );

            }

            if (
                !deps.recoveryCore
            ) {

                report.ready = false;

                report.missing.push(
                    "recoveryCore"
                );

            }

            return report;

        },

        /* ============================================================= */

        getCapabilities() {

            return {

                version:
                    LONG_HORIZON_FORECAST_VERSION,

                horizons:
                    [
                        ...this.configuration
                            .horizons
                    ],

                initialized:
                    this.state
                        .initialized,

                ready:
                    this.isReady(),

                dependencies:
                    this.ensureDependencies(),

                supportsBatch:
                    true,

                supportsStreaming:
                    true,

                supportsPersistence:
                    true,

                supportsStatistics:
                    true,

                supportsForecastFusion:
                    true

            };

        }

    }
);

  /* ======================================================================
   PART 3
   INPUT NORMALIZATION AND HORIZON FORECAST BUILDING
   ====================================================================== */

Object.assign(
    LongHorizonForecastEngineV32.prototype,
    {

        /* ============================================================= */

        normalizeForecastInput(
            input = {}
        ) {

            const source =
                safeObject(
                    input
                );

            const city =
                source.city ||
                source.location ||
                source.targetCity ||
                this.configuration.defaultCity ||
                null;

            const region =
                source.region ||
                source.area ||
                this.configuration.defaultRegion ||
                null;

            const generatedAt =
                safeNumber(
                    source.generatedAt ||
                    source.timestamp ||
                    source.createdAt,
                    now()
                );

            const horizons =
                normalizeHorizons(
                    source.horizons ||
                    this.configuration.horizons
                );

            return {

                id:
                    source.id ||
                    createId(
                        "long_horizon_input"
                    ),

                city,

                region,

                latitude:
                    safeNumber(
                        source.latitude ??
                        source.lat ??
                        source.location?.latitude ??
                        source.location?.lat,
                        null
                    ),

                longitude:
                    safeNumber(
                        source.longitude ??
                        source.lon ??
                        source.lng ??
                        source.location?.longitude ??
                        source.location?.lon ??
                        source.location?.lng,
                        null
                    ),

                locationKey:
                    createLocationKey(
                        source.location ||
                        source
                    ),

                generatedAt,

                horizons,

                weather:
                    safeObject(
                        source.weather
                    ),

                radar:
                    safeObject(
                        source.radar
                    ),

                satellite:
                    safeObject(
                        source.satellite
                    ),

                lightning:
                    safeObject(
                        source.lightning
                    ),

                storm:
                    safeObject(
                        source.storm
                    ),

                stormTrack:
                    safeObject(
                        source.stormTrack
                    ),

                sources:
                    safeObject(
                        source.sources
                    ),

                sourceList:
                    safeArray(
                        source.sourceList
                    ),

                arrivalPrediction:
                    safeObject(
                        source.arrivalPrediction
                    ),

                metadata: {

                    ...safeObject(
                        source.metadata
                    )

                },

                raw:
                    this.configuration.retainRawResults
                        ? source
                        : null

            };

        },

        /* ============================================================= */

        extractArrivalPrediction(
            predictionResult
        ) {

            const result =
                safeObject(
                    predictionResult
                );

            const prediction =
                safeObject(
                    result.prediction ||
                    result.result ||
                    result.data ||
                    result
                );

            const arrivalMinutes =
                safeNumber(
                    prediction.arrivalMinutes ??
                    prediction.estimatedArrivalMinutes ??
                    prediction.minutesToArrival,
                    null
                );

            const arrivalHours =
                safeNumber(
                    prediction.arrivalHours,
                    arrivalMinutes !== null
                        ? arrivalMinutes / 60
                        : null
                );

            const arrivalTimestamp =
                safeNumber(
                    prediction.arrivalTimestamp ||
                    prediction.estimatedArrivalTimestamp,
                    arrivalMinutes !== null
                        ? now() +
                            (
                                arrivalMinutes *
                                60 *
                                1000
                            )
                        : null
                );

            const confidence =
                clamp(
                    prediction.confidence ??
                    prediction.score ??
                    result.confidence ??
                    0
                );

            const uncertaintyMinutes =
                Math.max(
                    0,
                    safeNumber(
                        prediction.uncertaintyMinutes ??
                        prediction.uncertainty ??
                        result.uncertaintyMinutes,
                        0
                    )
                );

            return {

                available:
                    prediction.available !==
                        false &&
                    arrivalMinutes !==
                        null,

                arrivalMinutes,

                arrivalHours,

                arrivalTimestamp,

                arrivalIso:
                    arrivalTimestamp
                        ? new Date(
                            arrivalTimestamp
                        ).toISOString()
                        : null,

                confidence,

                uncertaintyMinutes,

                quality:
                    prediction.quality ||
                    result.quality ||
                    null,

                status:
                    prediction.status ||
                    result.status ||
                    null,

                raw:
                    this.configuration.retainRawResults
                        ? prediction
                        : null

            };

        },

        /* ============================================================= */

        calculateHorizonProbability(
            arrival,
            horizonHours
        ) {

            if (
                !arrival ||
                arrival.available !==
                    true
            ) {
                return 0;
            }

            const arrivalHours =
                safeNumber(
                    arrival.arrivalHours,
                    null
                );

            if (
                arrivalHours ===
                null
            ) {
                return 0;
            }

            const uncertaintyHours =
                Math.max(
                    0.25,
                    safeNumber(
                        arrival.uncertaintyMinutes,
                        0
                    ) / 60
                );

            const distance =
                horizonHours -
                arrivalHours;

            let probability;

            if (
                distance >=
                uncertaintyHours
            ) {

                probability =
                    1;

            } else if (
                distance <=
                -uncertaintyHours
            ) {

                probability =
                    0;

            } else {

                probability =
                    (
                        distance +
                        uncertaintyHours
                    ) /
                    (
                        uncertaintyHours *
                        2
                    );

            }

            probability *=
                clamp(
                    arrival.confidence,
                    0,
                    1
                );

            return clamp(
                probability,
                0,
                1
            );

        },

        /* ============================================================= */

        classifyHorizonForecast(
            probability
        ) {

            const normalized =
                clamp(
                    probability,
                    0,
                    1
                );

            if (
                normalized >=
                0.8
            ) {
                return "very_likely";
            }

            if (
                normalized >=
                0.6
            ) {
                return "likely";
            }

            if (
                normalized >=
                0.4
            ) {
                return "possible";
            }

            if (
                normalized >=
                0.2
            ) {
                return "low_probability";
            }

            return "unlikely";

        },

        /* ============================================================= */

        calculateHorizonConfidence(
            arrival,
            probability,
            horizonHours = 6
        ) {

            const arrivalConfidence =
                clamp(
                    arrival?.confidence,
                    0,
                    1
                );

            const decisiveness =
                Math.abs(
                    clamp(
                        probability,
                        0,
                        1
                    ) -
                    0.5
                ) *
                2;

            const uncertaintyHours =
                Math.max(
                    0,
                    safeNumber(
                        arrival?.uncertaintyMinutes,
                        0
                    ) / 60
                );

            const uncertaintyPenalty =
                clamp(
                    uncertaintyHours /
                    Math.max(
                        1,
                        safeNumber(
                            horizonHours,
                            6
                        )
                    ),
                    0,
                    0.45
                );

            const horizonPenalty =
                clamp(
                    Math.max(
                        0,
                        safeNumber(
                            horizonHours,
                            6
                        ) - 6
                    ) / 132,
                    0,
                    0.5
                );

            return clamp(
                (
                    arrivalConfidence *
                    0.78
                ) +
                (
                    decisiveness *
                    0.22
                ) -
                uncertaintyPenalty -
                horizonPenalty,
                0,
                1
            );

        },

        /* ============================================================= */

        buildHorizonForecast(
            normalizedInput,
            arrival,
            horizonHours
        ) {

            const probability =
                this.calculateHorizonProbability(
                    arrival,
                    horizonHours
                );

            const confidence =
                this.calculateHorizonConfidence(
                    arrival,
                    probability,
                    horizonHours
                );

            const generatedAt =
                now();

            const validUntil =
                generatedAt +
                (
                    horizonHours *
                    60 *
                    60 *
                    1000
                );

            return {

                id:
                    createId(
                        `horizon_${horizonHours}h`
                    ),

                city:
                    normalizedInput.city,

                region:
                    normalizedInput.region,

                horizonHours,

                horizonLabel:
                    LONG_HORIZON_FORECAST_HORIZON_LABELS[
                        horizonHours
                    ] ||
                    `${horizonHours}h`,

                status:
                    arrival.available
                        ? LONG_HORIZON_FORECAST_RESULT_STATUS.AVAILABLE
                        : LONG_HORIZON_FORECAST_RESULT_STATUS.UNAVAILABLE,

                classification:
                    this.classifyHorizonForecast(
                        probability
                    ),

                rainExpected:
                    probability >=
                    0.5,

                probability,

                probabilityPercent:
                    Math.round(
                        probability *
                        100
                    ),

                confidence,

                confidencePercent:
                    Math.round(
                        confidence *
                        100
                    ),

                arrivalMinutes:
                    arrival.arrivalMinutes,

                arrivalHours:
                    arrival.arrivalHours,

                arrivalTimestamp:
                    arrival.arrivalTimestamp,

                arrivalIso:
                    arrival.arrivalIso,

                uncertaintyMinutes:
                    arrival.uncertaintyMinutes,

                generatedAt,

                validUntil,

                source:
                    "RainArrivalPredictionEngineV32",

                metadata: {

                    inputId:
                        normalizedInput.id,

                    arrivalStatus:
                        arrival.status,

                    arrivalQuality:
                        arrival.quality

                }

            };

        },

        /* ============================================================= */

        buildAllHorizonForecasts(
            normalizedInput,
            arrival
        ) {

            const forecasts =
                {};

            const forecastList =
                [];

            for (
                const horizon of
                normalizedInput.horizons
            ) {

                const forecast =
                    this.buildHorizonForecast(
                        normalizedInput,
                        arrival,
                        horizon
                    );

                forecasts[
                    horizon
                ] =
                    forecast;

                forecastList.push(
                    forecast
                );

            }

            return {

                forecasts,

                forecastList

            };

        },

        /* ============================================================= */

        calculateForecastCompleteness(
            forecasts
        ) {

            const requiredHorizons =
                this.configuration.horizons;

            const availableHorizons =
                requiredHorizons.filter(
                    (horizon) => {

                        return (
                            forecasts?.[
                                horizon
                            ]?.status ===
                            LONG_HORIZON_FORECAST_RESULT_STATUS.AVAILABLE
                        );

                    }
                );

            const ratio =
                requiredHorizons.length
                    ? availableHorizons.length /
                        requiredHorizons.length
                    : 0;

            return {

                required:
                    [
                        ...requiredHorizons
                    ],

                available:
                    availableHorizons,

                missing:
                    requiredHorizons.filter(
                        (horizon) => {
                            return !availableHorizons.includes(
                                horizon
                            );
                        }
                    ),

                ratio,

                percentage:
                    Math.round(
                        ratio *
                        100
                    )

            };

        },

        /* ============================================================= */

        buildForecastSummary(
            normalizedInput,
            arrival,
            horizonResult
        ) {

            const completeness =
                this.calculateForecastCompleteness(
                    horizonResult.forecasts
                );

            const rainExpectedHorizons =
                horizonResult.forecastList
                    .filter(
                        (forecast) => {
                            return (
                                forecast.rainExpected ===
                                true
                            );
                        }
                    )
                    .map(
                        (forecast) => {
                            return forecast.horizonHours;
                        }
                    );

            return {

                id:
                    createId(
                        "long_horizon_summary"
                    ),

                city:
                    normalizedInput.city,

                region:
                    normalizedInput.region,

                status:
                    completeness.ratio ===
                        1
                        ? LONG_HORIZON_FORECAST_RESULT_STATUS.AVAILABLE
                        : (
                            completeness.ratio >
                            0
                                ? LONG_HORIZON_FORECAST_RESULT_STATUS.PARTIAL
                                : LONG_HORIZON_FORECAST_RESULT_STATUS.UNAVAILABLE
                        ),

                horizons:
                    [
                        ...normalizedInput.horizons
                    ],

                rainExpectedHorizons,

                earliestRainHorizon:
                    rainExpectedHorizons.length
                        ? Math.min(
                            ...rainExpectedHorizons
                        )
                        : null,

                latestRainHorizon:
                    rainExpectedHorizons.length
                        ? Math.max(
                            ...rainExpectedHorizons
                        )
                        : null,

                arrival,

                completeness,

                generatedAt:
                    now(),

                metadata: {

                    runtimeMode:
                        this.configuration.runtimeMode,

                    engineVersion:
                        LONG_HORIZON_FORECAST_VERSION

                }

            };

        }

    }
);

  /* ======================================================================
   PART 4
   ARRIVAL ENGINE EXECUTION
   RESULT NORMALIZATION
   CORE SYNCHRONIZATION
   ====================================================================== */

Object.assign(
    LongHorizonForecastEngineV32.prototype,
    {

        /* ============================================================= */

       async executeArrivalPrediction(
    input = {}
) {

    let engine =
        this.getArrivalEngine();

    /*
       بعض الإصدارات تحفظ الكلاس نفسه بدل Instance.
       إذا كانت القيمة function نحاول إنشاء نسخة منه.
    */
    if (
        typeof engine ===
        "function"
    ) {

        try {

            engine =
                new engine({

                    core:
                        this.getCore(),

                    autoInitialize:
                        true

                });

            this.arrivalEngine =
                engine;

            if (
                this.dependencies
            ) {

                this.dependencies.arrivalEngine =
                    engine;

            }

        } catch (error) {

            console.error(
                "[LongHorizonForecastV32] Failed to create arrival engine instance.",
                error
            );

            throw new Error(
                "Failed to create RainArrivalPredictionEngineV32 instance."
            );

        }

    }

    if (
        !engine
    ) {
        throw new Error(
            "Rain arrival prediction engine is unavailable."
        );
    }

    const normalizedInput =
        this.normalizeForecastInput(
            input
        );

    let result =
        null;

    if (
        typeof engine
            .runCompleteRainArrivalPrediction ===
        "function"
    ) {

        result =
            await engine
                .runCompleteRainArrivalPrediction(
                    normalizedInput.raw ||
                    input
                );

    } else if (
        typeof engine
            .predictRainArrival ===
        "function"
    ) {

        result =
            await engine
                .predictRainArrival(
                    normalizedInput.raw ||
                    input
                );

    } else if (
        typeof engine.run ===
        "function"
    ) {

        result =
            await engine.run(
                normalizedInput.raw ||
                normalizedInput
            );

    } else if (
        typeof engine.execute ===
        "function"
    ) {

        result =
            await engine.execute(
                normalizedInput.raw ||
                normalizedInput
            );

    } else if (
        typeof engine.predict ===
        "function"
    ) {

        result =
            await engine.predict(
                normalizedInput.raw ||
                normalizedInput
            );

    } else {

        console.error(
            "[LongHorizonForecastV32] Unsupported arrival engine.",
            {
                engine,
                className:
                    engine?.constructor?.name,
                methods:
                    Object.getOwnPropertyNames(
                        Object.getPrototypeOf(
                            engine
                        ) || {}
                    )
            }
        );

        throw new Error(
            "Rain arrival prediction engine has no supported execution method."
        );

    }

    return {

        normalizedInput,

        rawResult:
            result,

        arrival:
            this.extractArrivalPrediction(
                result
            )

    };

},
        /* ============================================================= */

        normalizeArrivalPredictionRecord(
            normalizedInput,
            arrival,
            rawResult
        ) {

            const generatedAt =
                safeNumber(
                    rawResult?.generatedAt ||
                    rawResult?.timestamp ||
                    rawResult?.createdAt,
                    now()
                );

            return {

                id:
                    rawResult?.id ||
                    createId(
                        "arrival_prediction"
                    ),

                city:
                    normalizedInput.city,

                region:
                    normalizedInput.region,

                status:
                    arrival.available
                        ? LONG_HORIZON_FORECAST_RESULT_STATUS.AVAILABLE
                        : LONG_HORIZON_FORECAST_RESULT_STATUS.UNAVAILABLE,

                available:
                    arrival.available,

                arrivalMinutes:
                    arrival.arrivalMinutes,

                arrivalHours:
                    arrival.arrivalHours,

                arrivalTimestamp:
                    arrival.arrivalTimestamp,

                arrivalIso:
                    arrival.arrivalIso,

                confidence:
                    arrival.confidence,

                confidencePercent:
                    Math.round(
                        clamp(
                            arrival.confidence,
                            0,
                            1
                        ) *
                        100
                    ),

                uncertaintyMinutes:
                    arrival.uncertaintyMinutes,

                quality:
                    arrival.quality,

                generatedAt,

                timestamp:
                    generatedAt,

                source:
                    "RainArrivalPredictionEngineV32",

                metadata: {

                    inputId:
                        normalizedInput.id,

                    engineVersion:
                        LONG_HORIZON_FORECAST_VERSION

                },

                key:
                    createArrivalPredictionKey({
                        locationKey:
                            normalizedInput.locationKey,
                        city:
                            normalizedInput.city,
                        region:
                            normalizedInput.region,
                        arrivalTimestamp:
                            arrival.arrivalTimestamp,
                        arrivalMinutes:
                            arrival.arrivalMinutes,
                        source:
                            "RainArrivalPredictionEngineV32"
                    }),

                locationKey:
                    normalizedInput.locationKey,

                raw:
                    this.configuration.retainRawResults
                        ? rawResult
                        : null

            };

        },

        /* ============================================================= */

        ensureCoreForecastState() {

            const core =
                this.getCore();

            if (
                !core ||
                typeof core !==
                    "object"
            ) {
                return null;
            }

            if (
                !core.state ||
                typeof core.state !==
                    "object"
            ) {
                core.state =
                    {};
            }

            if (
                !core.state.forecasts ||
                typeof core.state.forecasts !==
                    "object"
            ) {
                core.state.forecasts =
                    {};
            }

            if (
                !core.state.horizonForecasts ||
                typeof core.state.horizonForecasts !==
                    "object"
            ) {
                core.state.horizonForecasts =
                    {};
            }

            if (
                !Array.isArray(
                    core.state.horizonForecastList
                )
            ) {
                core.state.horizonForecastList =
                    [];
            }

            if (
                !Array.isArray(
                    core.state.arrivalPredictions
                )
            ) {
                core.state.arrivalPredictions =
                    [];
            }

            return core.state;

        },

        /* ============================================================= */

        synchronizeForecastsToCore(
            forecastResult
        ) {

            const core =
                this.getCore();

            const coreState =
                this.ensureCoreForecastState();

            if (
                !core ||
                !coreState
            ) {
                return false;
            }

            const cityKey =
                forecastResult.locationKey ||
                forecastResult.summary?.locationKey ||
                createLocationKey(
                    forecastResult
                );

            const forecasts =
                safeObject(
                    forecastResult.forecasts
                );

            const forecastList =
                safeArray(
                    forecastResult.forecastList
                );

            const arrivalPrediction =
                forecastResult.arrivalPrediction ||
                null;

            coreState.forecastsByCity =
                safeObject(
                    coreState.forecastsByCity
                );

            coreState.horizonForecastsByCity =
                safeObject(
                    coreState.horizonForecastsByCity
                );

            coreState.forecastListsByCity =
                safeObject(
                    coreState.forecastListsByCity
                );

            coreState.forecastsByCity[
                cityKey
            ] = forecasts;

            coreState.horizonForecastsByCity[
                cityKey
            ] = forecasts;

            coreState.forecastListsByCity[
                cityKey
            ] = forecastList;

            coreState.forecasts =
                forecasts;

            coreState.horizonForecasts =
                forecasts;

            coreState.horizonForecastList =
                forecastList;

            if (
                arrivalPrediction
            ) {

                const predictionKey =
                    arrivalPrediction.key ||
                    createArrivalPredictionKey(
                        arrivalPrediction
                    );

                arrivalPrediction.key =
                    predictionKey;

                const existingIndex =
                    coreState.arrivalPredictions
                        .findIndex(
                            (item) => {
                                return (
                                    item?.key === predictionKey ||
                                    (
                                        item?.id &&
                                        item.id === arrivalPrediction.id
                                    )
                                );
                            }
                        );

                if (
                    existingIndex >= 0
                ) {
                    coreState.arrivalPredictions[
                        existingIndex
                    ] = arrivalPrediction;
                } else {
                    coreState.arrivalPredictions.push(
                        arrivalPrediction
                    );
                }

                const maximum =
                    Math.max(
                        100,
                        safeNumber(
                            this.configuration.maximumStoredArrivalPredictions,
                            1500
                        )
                    );

                if (
                    coreState.arrivalPredictions.length >
                    maximum
                ) {
                    coreState.arrivalPredictions.splice(
                        0,
                        coreState.arrivalPredictions.length -
                        maximum
                    );
                }
            }

            coreState.latestForecast =
                forecastResult.summary ||
                null;

            coreState.latestArrivalPrediction =
                arrivalPrediction;

            coreState.forecastGeneratedAt =
                forecastResult.generatedAt ||
                now();

            core.latestForecast =
                forecastResult.summary ||
                null;

            core.forecastData =
                forecasts;

            core.arrivalPredictions =
                coreState.arrivalPredictions;

            core.latestArrivalPredictions =
                coreState.arrivalPredictions;

            core.horizonForecasts =
                coreState.horizonForecastsByCity;

            core.horizonForecastList =
                coreState.horizonForecastList;

            core.forecastEngine =
                this;

            core.longHorizonForecastEngine =
                this;

            core.longHorizonForecastEngineV32 =
                this;

            return true;

        },

        /* ============================================================= */

        synchronizeStateFromForecastResult(
            forecastResult
        ) {

            this.state.forecasts =
                deepClone(
                    forecastResult.forecasts
                );

            this.state.forecastList =
                deepClone(
                    forecastResult.forecastList
                );

            this.state.arrivalPredictions =
                forecastResult.arrivalPrediction
                    ? [
                        deepClone(
                            forecastResult
                                .arrivalPrediction
                        )
                    ]
                    : [];

            this.state.latestForecast =
                deepClone(
                    forecastResult.summary
                );

            this.state.latestPrediction =
                deepClone(
                    forecastResult
                        .arrivalPrediction
                );

            this.state.generatedAt =
                forecastResult.generatedAt;

            this.state.freshnessTimestamp =
                forecastResult.generatedAt;

            return this;

        },

        /* ============================================================= */

        buildCompleteForecastResult(
            normalizedInput,
            arrivalExecution
        ) {

            const arrival =
                arrivalExecution.arrival;

            const horizonResult =
                this.buildAllHorizonForecasts(
                    normalizedInput,
                    arrival
                );

            const summary =
                this.buildForecastSummary(
                    normalizedInput,
                    arrival,
                    horizonResult
                );

            const arrivalPrediction =
                this.normalizeArrivalPredictionRecord(
                    normalizedInput,
                    arrival,
                    arrivalExecution.rawResult
                );

            const generatedAt =
                now();

            return {

                id:
                    createId(
                        "long_horizon_result"
                    ),

                success:
                    arrival.available,

                partial:
                    !arrival.available,

                status:
                    summary.status,

                city:
                    normalizedInput.city,

                region:
                    normalizedInput.region,

                locationKey:
                    normalizedInput.locationKey,

                horizons:
                    [
                        ...normalizedInput.horizons
                    ],

                forecasts:
                    horizonResult.forecasts,

                forecastList:
                    horizonResult.forecastList,

                horizonForecasts:
                    horizonResult.forecasts,

                horizonForecastList:
                    horizonResult.forecastList,

                arrivalPrediction,

                arrivalPredictions:
                    [
                        arrivalPrediction
                    ],

                summary,

                generatedAt,

                timestamp:
                    generatedAt,

                metadata: {

                    inputId:
                        normalizedInput.id,

                    engineId:
                        this.id,

                    engineVersion:
                        LONG_HORIZON_FORECAST_VERSION

                },

                rawArrivalResult:
                    this.configuration.retainRawResults
                        ? arrivalExecution.rawResult
                        : null

            };

        },

        /* ============================================================= */

        async runForecast(
            input = {},
            runtime = {}
        ) {

            if (
                this.destroyed
            ) {
                throw new Error(
                    "Long horizon forecast engine is destroyed."
                );
            }

            if (
                !this.state.initialized
            ) {
                this.initialize();
            }

            const internal =
                runtime.internal ===
                true;

            if (
                !internal &&
                this.state.running
            ) {
                return {
                    success: false,
                    status: LONG_HORIZON_FORECAST_STATUS.RUNNING,
                    message: "Long horizon forecast is already running.",
                    state: this.getState()
                };
            }

            const startedAt =
                now();

            if (
                !internal
            ) {
                this.state.running = true;
                this.state.status = LONG_HORIZON_FORECAST_STATUS.RUNNING;
                this.state.startedAt = startedAt;
                this.state.completedAt = null;
                this.state.durationMs = 0;
                this.state.lastRunAt = startedAt;
                this.state.errors = [];
                this.state.warnings = [];

                this.emit(
                    LONG_HORIZON_FORECAST_EVENT.STARTED,
                    {
                        input:
                            this.configuration.retainRawResults
                                ? deepClone(input)
                                : {
                                    city: input?.city || null,
                                    region: input?.region || null
                                }
                    }
                );
            }

            try {

                const normalizedInput =
                    this.normalizeForecastInput(
                        input
                    );

                const arrivalExecution =
                    await this.executeArrivalPrediction(
                        {
                            ...input,
                            ...normalizedInput,
                            raw:
                                this.configuration.retainRawResults
                                    ? input
                                    : null
                        }
                    );

                const result =
                    this.buildCompleteForecastResult(
                        normalizedInput,
                        arrivalExecution
                    );

                if (
                    runtime.synchronizeCore !==
                    false
                ) {
                    this.synchronizeForecastsToCore(
                        result
                    );
                }

                if (
                    !internal
                ) {
                    this.synchronizeStateFromForecastResult(
                        result
                    );

                    this.state.status =
                        result.success
                            ? LONG_HORIZON_FORECAST_STATUS.COMPLETED
                            : LONG_HORIZON_FORECAST_STATUS.PARTIAL;

                    this.state.lastSuccessfulRunAt =
                        result.success
                            ? now()
                            : this.state.lastSuccessfulRunAt;

                    this.emit(
                        LONG_HORIZON_FORECAST_EVENT.COMPLETED,
                        {
                            result:
                                this.configuration.retainRawResults
                                    ? deepClone(result)
                                    : result
                        }
                    );
                }

                return result;

            } catch (error) {

                const normalizedError =
                    normalizeError(
                        error
                    );

                if (
                    !internal
                ) {
                    this.state.status =
                        LONG_HORIZON_FORECAST_STATUS.FAILED;

                    this.state.errors.push({
                        id: createId("long_horizon_error"),
                        timestamp: now(),
                        error: normalizedError
                    });

                    this.emit(
                        LONG_HORIZON_FORECAST_EVENT.FAILED,
                        {
                            error: normalizedError
                        }
                    );
                }

                return {
                    success: false,
                    partial: false,
                    status: LONG_HORIZON_FORECAST_STATUS.FAILED,
                    error: normalizedError,
                    generatedAt: now()
                };

            } finally {

                if (
                    !internal
                ) {
                    this.state.running = false;
                    this.state.completedAt = now();
                    this.state.durationMs =
                        this.state.completedAt -
                        startedAt;
                }
            }

        },

       async runNationalForecast(
            options = {}
        ) {

            if (
                this.destroyed
            ) {
                throw new Error(
                    "Long horizon forecast engine is destroyed."
                );
            }

            if (
                !this.state.initialized
            ) {
                this.initialize();
            }

            if (
                this.state.nationalRunning
            ) {
                return {
                    success: false,
                    status: LONG_HORIZON_FORECAST_STATUS.RUNNING,
                    message: "National long horizon forecast is already running.",
                    progress: deepClone(this.state.nationalProgress)
                };
            }

            const core =
                this.getCore();

            if (
                !core
            ) {
                throw new Error(
                    "Recovery Core is unavailable."
                );
            }

            const safeOptions =
                safeObject(
                    options
                );

            const allLocations =
                typeof core.getActiveLocations ===
                "function"
                    ? safeArray(
                        core.getActiveLocations()
                    )
                    : core.locations instanceof Map
                        ? [...core.locations.values()]
                        : safeArray(
                            core.locations
                        );

            const locations =
                allLocations.filter(
                    (location) => {
                        return (
                            location &&
                            location.active !== false
                        );
                    }
                );

            if (
                locations.length === 0
            ) {
                return {
                    success: false,
                    status: LONG_HORIZON_FORECAST_STATUS.FAILED,
                    message: "No active locations are available.",
                    generatedAt: now()
                };
            }

            const concurrency =
                Math.max(
                    1,
                    Math.min(
                        12,
                        Math.floor(
                            safeNumber(
                                safeOptions.concurrency ??
                                this.configuration.nationalConcurrency,
                                4
                            )
                        )
                    )
                );

            const batchDelayMs =
                Math.max(
                    0,
                    safeNumber(
                        safeOptions.batchDelayMs ??
                        this.configuration.nationalBatchDelayMs,
                        0
                    )
                );

            const cityForecasts = [];
            const failedCities = [];
            const arrivalMap = new Map();
            const startedAt = now();
            let nextIndex = 0;
            let completedCount = 0;

            this.state.nationalRunning = true;
            this.state.status = LONG_HORIZON_FORECAST_STATUS.RUNNING;
            this.state.startedAt = startedAt;
            this.state.lastRunAt = startedAt;
            this.state.nationalProgress = {
                total: locations.length,
                completed: 0,
                failed: 0,
                percentage: 0,
                currentCities: []
            };

            this.emit(
                LONG_HORIZON_FORECAST_EVENT.STARTED,
                {
                    national: true,
                    locationCount: locations.length,
                    concurrency
                }
            );

            const executeLocation =
                async (location, index) => {

                    const cityName =
                        location.nameAr ||
                        location.nameEn ||
                        location.name ||
                        location.city ||
                        location.code ||
                        location.id ||
                        `location-${index + 1}`;

                    const regionName =
                        location.regionNameAr ||
                        location.regionNameEn ||
                        location.region ||
                        location.regionName ||
                        "غير محدد";

                    const locationKey =
                        createLocationKey(
                            location
                        );

                    try {

                        const result =
                            await this.runForecast(
                                {
                                    ...safeObject(
                                        safeOptions.forecast
                                    ),
                                    id: location.id,
                                    city: cityName,
                                    region: regionName,
                                    latitude:
                                        location.latitude ??
                                        location.lat,
                                    longitude:
                                        location.longitude ??
                                        location.lon ??
                                        location.lng,
                                    locationKey,
                                    location,
                                    national: true,
                                    locationIndex: index,
                                    locationCount: locations.length
                                },
                                {
                                    internal: true,
                                    synchronizeCore: false
                                }
                            );

                        if (
                            result?.success !== true &&
                            safeOptions.includeUnavailable !== true
                        ) {
                            throw new Error(
                                result?.error?.message ||
                                result?.message ||
                                "City forecast failed or was unavailable."
                            );
                        }

                        const cityForecast = {
                            locationId: location.id ?? null,
                            locationCode: location.code || null,
                            locationKey,
                            city: result.city || cityName,
                            region: result.region || regionName,
                            latitude:
                                safeNumber(
                                    location.latitude ??
                                    location.lat,
                                    null
                                ),
                            longitude:
                                safeNumber(
                                    location.longitude ??
                                    location.lon ??
                                    location.lng,
                                    null
                                ),
                            success: result?.success === true,
                            status: result?.status || LONG_HORIZON_FORECAST_RESULT_STATUS.UNAVAILABLE,
                            forecasts: result?.forecasts || {},
                            forecastList: safeArray(result?.forecastList),
                            horizonForecasts:
                                result?.horizonForecasts ||
                                result?.forecasts ||
                                {},
                            horizons: safeArray(result?.horizons),
                            arrivalPrediction: result?.arrivalPrediction || null,
                            summary: result?.summary || null,
                            generatedAt: result?.generatedAt || now()
                        };

                        cityForecasts.push(
                            cityForecast
                        );

                        const predictions = [
                            cityForecast.arrivalPrediction,
                            ...safeArray(
                                result?.arrivalPredictions
                            )
                        ].filter(Boolean);

                        predictions.forEach(
                            (prediction) => {
                                const record = {
                                    ...safeObject(prediction),
                                    locationId: location.id ?? null,
                                    locationKey,
                                    city: cityForecast.city,
                                    region: cityForecast.region
                                };

                                record.key =
                                    record.key ||
                                    createArrivalPredictionKey(
                                        record
                                    );

                                arrivalMap.set(
                                    record.key,
                                    record
                                );
                            }
                        );

                    } catch (error) {

                        failedCities.push({
                            locationId: location.id ?? null,
                            locationKey,
                            city: cityName,
                            region: regionName,
                            error: normalizeError(error)
                        });

                        if (
                            safeOptions.stopOnError === true
                        ) {
                            throw error;
                        }
                    } finally {

                        completedCount += 1;

                        this.state.nationalProgress = {
                            total: locations.length,
                            completed: completedCount,
                            failed: failedCities.length,
                            percentage:
                                Math.round(
                                    completedCount /
                                    locations.length *
                                    100
                                ),
                            currentCity: cityName
                        };

                        if (
                            safeOptions.logProgress !== false
                        ) {
                            console.log(
                                "[LongHorizonForecastV32] National progress:",
                                completedCount,
                                "/",
                                locations.length,
                                cityName
                            );
                        }
                    }
                };

            const worker =
                async () => {
                    while (
                        nextIndex < locations.length
                    ) {
                        const index = nextIndex;
                        nextIndex += 1;

                        await executeLocation(
                            locations[index],
                            index
                        );

                        if (
                            batchDelayMs > 0
                        ) {
                            await delay(
                                batchDelayMs
                            );
                        }
                    }
                };

            try {

                await Promise.all(
                    Array.from(
                        {
                            length:
                                Math.min(
                                    concurrency,
                                    locations.length
                                )
                        },
                        () => worker()
                    )
                );

                cityForecasts.sort(
                    (first, second) => {
                        return String(first.region).localeCompare(
                            String(second.region),
                            "ar"
                        ) ||
                        String(first.city).localeCompare(
                            String(second.city),
                            "ar"
                        );
                    }
                );

                const regionMap = new Map();

                cityForecasts.forEach(
                    (cityForecast) => {
                        const regionName =
                            cityForecast.region ||
                            "غير محدد";

                        if (
                            !regionMap.has(regionName)
                        ) {
                            regionMap.set(
                                regionName,
                                []
                            );
                        }

                        regionMap.get(regionName).push(
                            cityForecast
                        );
                    }
                );

                const horizons =
                    normalizeHorizons(
                        safeOptions.horizons ||
                        this.configuration.horizons
                    );

                const regionForecasts =
                    [...regionMap.entries()].map(
                        ([region, cities]) => {
                            const horizonForecasts = {};

                            horizons.forEach(
                                (horizon) => {
                                    const forecasts =
                                        cities.map(
                                            (city) => {
                                                return city.horizonForecasts?.[horizon] ||
                                                    city.horizonForecasts?.[String(horizon)] ||
                                                    null;
                                            }
                                        ).filter(Boolean);

                                    const rainExpectedCount =
                                        forecasts.filter(
                                            (forecast) => forecast.rainExpected === true
                                        ).length;

                                    const averageProbability =
                                        forecasts.length
                                            ? forecasts.reduce(
                                                (sum, forecast) => {
                                                    return sum + safeNumber(forecast.probability, 0);
                                                },
                                                0
                                            ) / forecasts.length
                                            : 0;

                                    const averageConfidence =
                                        forecasts.length
                                            ? forecasts.reduce(
                                                (sum, forecast) => {
                                                    return sum + safeNumber(forecast.confidence, 0);
                                                },
                                                0
                                            ) / forecasts.length
                                            : 0;

                                    horizonForecasts[horizon] = {
                                        horizonHours: horizon,
                                        cityCount: forecasts.length,
                                        rainExpectedCount,
                                        rainExpectedRatio:
                                            forecasts.length
                                                ? rainExpectedCount / forecasts.length
                                                : 0,
                                        averageProbability,
                                        averageConfidence,
                                        forecasts
                                    };
                                }
                            );

                            return {
                                region,
                                cityCount: cities.length,
                                cities,
                                horizonForecasts,
                                generatedAt: now()
                            };
                        }
                    );

                const horizonForecasts = {};

                horizons.forEach(
                    (horizon) => {
                        const entries =
                            cityForecasts.map(
                                (city) => {
                                    const forecast =
                                        city.horizonForecasts?.[horizon] ||
                                        city.horizonForecasts?.[String(horizon)] ||
                                        null;

                                    return forecast
                                        ? {
                                            locationId: city.locationId,
                                            locationKey: city.locationKey,
                                            city: city.city,
                                            region: city.region,
                                            latitude: city.latitude,
                                            longitude: city.longitude,
                                            forecast
                                        }
                                        : null;
                                }
                            ).filter(Boolean);

                        horizonForecasts[`h${horizon}`] = {
                            horizonHours: horizon,
                            locations: entries,
                            locationCount: entries.length,
                            rainExpectedCount:
                                entries.filter(
                                    (entry) => entry.forecast.rainExpected === true
                                ).length,
                            generatedAt: now()
                        };
                    }
                );

                const arrivalPredictions =
                    [...arrivalMap.values()]
                        .sort(
                            (first, second) => {
                                return safeNumber(
                                    first.arrivalTimestamp,
                                    Number.MAX_SAFE_INTEGER
                                ) -
                                safeNumber(
                                    second.arrivalTimestamp,
                                    Number.MAX_SAFE_INTEGER
                                );
                            }
                        );

                const completedAt = now();

                const nationalResult = {
                    id: createId("national_long_horizon_forecast"),
                    success: cityForecasts.length > 0,
                    partial: failedCities.length > 0,
                    status:
                        cityForecasts.length === 0
                            ? LONG_HORIZON_FORECAST_STATUS.FAILED
                            : failedCities.length === 0
                                ? LONG_HORIZON_FORECAST_STATUS.COMPLETED
                                : LONG_HORIZON_FORECAST_STATUS.PARTIAL,
                    generatedAt: completedAt,
                    startedAt,
                    completedAt,
                    durationMs: completedAt - startedAt,
                    totalLocations: locations.length,
                    completedCities: cityForecasts.length,
                    failedCount: failedCities.length,
                    regionCount: regionForecasts.length,
                    arrivalCount: arrivalPredictions.length,
                    concurrency,
                    horizons,
                    cityForecasts,
                    regionForecasts,
                    arrivalPredictions,
                    horizonForecasts,
                    failedCities
                };

                core.cityForecasts = cityForecasts;
                core.regionForecasts = regionForecasts;
                core.arrivalPredictions = arrivalPredictions;
                core.horizonForecasts = horizonForecasts;
                core.longHorizonForecast = nationalResult;
                core.latestNationalForecast = nationalResult;
                core.latestForecast = nationalResult;
                core.forecastData = cityForecasts;

                if (
                    core.state &&
                    typeof core.state === "object"
                ) {
                    core.state.cityForecasts = cityForecasts;
                    core.state.regionForecasts = regionForecasts;
                    core.state.arrivalPredictions = arrivalPredictions;
                    core.state.horizonForecasts = horizonForecasts;
                    core.state.longHorizonForecast = nationalResult;
                    core.state.latestNationalForecast = nationalResult;
                }

                this.state.latestNationalForecast = nationalResult;
                this.state.latestForecast = nationalResult;
                this.state.cityForecasts = cityForecasts;
                this.state.regionForecasts = regionForecasts;
                this.state.arrivalPredictions = arrivalPredictions;
                this.state.generatedAt = completedAt;
                this.state.freshnessTimestamp = completedAt;
                this.state.status = nationalResult.status;
                this.state.lastSuccessfulRunAt =
                    nationalResult.success
                        ? completedAt
                        : this.state.lastSuccessfulRunAt;

                this.state.nationalForecastHistory.push({
                    id: nationalResult.id,
                    generatedAt: nationalResult.generatedAt,
                    status: nationalResult.status,
                    completedCities: nationalResult.completedCities,
                    failedCount: nationalResult.failedCount,
                    regionCount: nationalResult.regionCount,
                    durationMs: nationalResult.durationMs
                });

                const maximumHistory =
                    Math.max(
                        1,
                        safeNumber(
                            this.configuration.maximumStoredForecastHistory,
                            3
                        )
                    );

                if (
                    this.state.nationalForecastHistory.length >
                    maximumHistory
                ) {
                    this.state.nationalForecastHistory.splice(
                        0,
                        this.state.nationalForecastHistory.length -
                        maximumHistory
                    );
                }

                this.emit(
                    LONG_HORIZON_FORECAST_EVENT.COMPLETED,
                    {
                        national: true,
                        result: nationalResult
                    }
                );

                return nationalResult;

            } catch (error) {

                const normalizedError =
                    normalizeError(
                        error
                    );

                this.state.status =
                    LONG_HORIZON_FORECAST_STATUS.FAILED;

                this.emit(
                    LONG_HORIZON_FORECAST_EVENT.FAILED,
                    {
                        national: true,
                        error: normalizedError
                    }
                );

                return {
                    success: false,
                    partial: cityForecasts.length > 0,
                    status: LONG_HORIZON_FORECAST_STATUS.FAILED,
                    error: normalizedError,
                    cityForecasts,
                    failedCities,
                    generatedAt: now()
                };

            } finally {

                this.state.nationalRunning = false;
                this.state.running = false;
                this.state.completedAt = now();
                this.state.durationMs =
                    this.state.completedAt -
                    startedAt;
            }

        },

       getLatestNationalForecast() {

            return deepClone(
                this.state.latestNationalForecast ||
                this.core?.latestNationalForecast ||
                this.core?.longHorizonForecast ||
                null
            );

        },

        /* ============================================================= */

        async run(
            input = {}
        ) {

            return this.runForecast(
                input
            );

        },

        /* ============================================================= */

        async generateForecast(
            input = {}
        ) {

            return this.runForecast(
                input
            );

        },

        /* ============================================================= */

        async forecast(
            input = {}
        ) {

            return this.runForecast(
                input
            );

        },

        /* ============================================================= */

        getForecasts() {

            return deepClone(
                this.state.forecasts
            );

        },

        /* ============================================================= */

        getForecastList() {

            return deepClone(
                this.state.forecastList
            );

        },

        /* ============================================================= */

        getLatestForecast() {

            return deepClone(
                this.state.latestForecast
            );

        },

        /* ============================================================= */

        getArrivalPredictions() {

            return deepClone(
                this.state.arrivalPredictions
            );

        }

    }
);

  /* ======================================================================
   PART 5
   GLOBAL INSTANCE
   PUBLIC API
   FINAL EXPORTS
   ====================================================================== */

Object.assign(
    LongHorizonForecastEngineV32.prototype,
    {

        /* ============================================================= */

        destroy() {

            if (
                this.destroyed
            ) {
                return;
            }

            this.destroyed = true;
            this.state.destroyed = true;
            this.state.running = false;
            this.state.nationalRunning = false;
            this.state.status =
                LONG_HORIZON_FORECAST_STATUS.DESTROYED;

            this.emit(
                LONG_HORIZON_FORECAST_EVENT.DESTROYED,
                {
                    id: this.id
                }
            );

            this.events.clear();
            this.dependencies = null;
            this.arrivalEngine = null;
            this.sourceEngine = null;
            this.core = null;

        }

    }
);

/* ======================================================================
   GLOBAL FACTORY
   ====================================================================== */

global.createLongHorizonForecastEngineV32 =
    function createLongHorizonForecastEngineV32(
        options = {}
    ) {

        return new LongHorizonForecastEngineV32(
            options
        );

    };

/* ======================================================================
   DEFAULT INSTANCE
   ====================================================================== */

const defaultLongHorizonForecastEngineInstance =
    new LongHorizonForecastEngineV32({

        core:

            global.RainArrivalRecoveryCoreV32Instance ||

            global.LongHorizonRecoveryCoreV32Instance ||

            global.recoveryCoreV32 ||

            null,

        arrivalEngine:

            global.RainArrivalPredictionEngineV32Instance ||
            global.rainArrivalPredictionEngineV32Instance ||
            null

    });

/* ======================================================================
   AUTO ATTACH
   ====================================================================== */

if (
    defaultLongHorizonForecastEngineInstance
) {

    defaultLongHorizonForecastEngineInstance
        .resolveDependencies();

    const core =
        defaultLongHorizonForecastEngineInstance
            .getCore();

    if (
        core
    ) {

        defaultLongHorizonForecastEngineInstance
            .attachToCore(
                core
            );

    }

}

/* ======================================================================
   GLOBAL EXPORTS
   ====================================================================== */

global.LongHorizonForecastEngineV32Instance =
    defaultLongHorizonForecastEngineInstance;

global.LongHorizonForecastEngineV32Version =
    LONG_HORIZON_FORECAST_VERSION;

global.LongHorizonForecastEngineV32Build =
    LONG_HORIZON_FORECAST_BUILD;

global.LongHorizonForecastEngineV32Ready =
    true;

/* ======================================================================
   PUBLIC API
   ====================================================================== */

global.getLongHorizonForecastEngine =
    function getLongHorizonForecastEngine() {

        return global
            .LongHorizonForecastEngineV32Instance;

    };

global.runLongHorizonForecast =
    async function runLongHorizonForecast(
        input = {}
    ) {

        return global
            .LongHorizonForecastEngineV32Instance
            .runForecast(
                input
            );

    };

global.runNationalLongHorizonForecast =
    async function runNationalLongHorizonForecast(
        options = {}
    ) {

        return global
            .LongHorizonForecastEngineV32Instance
            .runNationalForecast(
                options
            );

    };

global.getLatestNationalLongHorizonForecast =
    function getLatestNationalLongHorizonForecast() {

        return global
            .LongHorizonForecastEngineV32Instance
            .getLatestNationalForecast();

    };

console.log(
    "[RainGuard AI V32] Long Horizon Forecast Engine initialized.",
    {

        version:
            LONG_HORIZON_FORECAST_VERSION,

        build:
            LONG_HORIZON_FORECAST_BUILD,

        horizons:
            LONG_HORIZON_FORECAST_HORIZONS

    }
);

/* ======================================================================
   END
   ====================================================================== */

})(window);
