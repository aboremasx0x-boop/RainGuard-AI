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
        "32.1.0";

    const LONG_HORIZON_FORECAST_BUILD =
        "3201";

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

            const dependencies = {

                arrivalEngine:
                    this.arrivalEngine ||

                    this.core?.rainArrivalPredictionEngine ||

                    this.core?.forecastEngine ||

                    global.RainArrivalPredictionEngineV32Instance ||

                    global.RainArrivalPredictionEngineV32 ||

                    null,

                recoveryCore:
                    this.core ||

                    global.RecoveryCoreV32Instance ||

                    global.RainArrivalRecoveryCoreV32Instance ||

                    null,

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
                !this.arrivalEngine
            ) {

                this.arrivalEngine =
                    dependencies.arrivalEngine;

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
                    source

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
                    prediction

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
            probability
        ) {

            const arrivalConfidence =
                clamp(
                    arrival?.confidence,
                    0,
                    1
                );

            const probabilityConfidence =
                1 -
                Math.abs(
                    0.5 -
                    clamp(
                        probability,
                        0,
                        1
                    )
                ) *
                2;

            return clamp(
                (
                    arrivalConfidence *
                    0.75
                ) +
                (
                    probabilityConfidence *
                    0.25
                ),
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
                    probability
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
                    normalizedInput
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
                    normalizedInput
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

                raw:
                    rawResult

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

            coreState.forecasts =
                {

                    ...coreState.forecasts,

                    ...forecasts

                };

            coreState.horizonForecasts =
                {

                    ...coreState.horizonForecasts,

                    ...forecasts

                };

            coreState.horizonForecastList =
                forecastList;

            if (
                arrivalPrediction
            ) {

                const existingIndex =
                    coreState.arrivalPredictions
                        .findIndex(
                            (item) => {

                                return (
                                    item?.id ===
                                    arrivalPrediction.id
                                );

                            }
                        );

                if (
                    existingIndex >=
                    0
                ) {

                    coreState.arrivalPredictions[
                        existingIndex
                    ] =
                        arrivalPrediction;

                } else {

                    coreState.arrivalPredictions
                        .push(
                            arrivalPrediction
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
                coreState.horizonForecasts;

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
                    arrivalExecution.rawResult

            };

        },

        /* ============================================================= */

        async runForecast(
            input = {}
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
                this.state.running
            ) {
                return {

                    success:
                        false,

                    status:
                        LONG_HORIZON_FORECAST_STATUS.RUNNING,

                    message:
                        "Long horizon forecast is already running.",

                    state:
                        this.getState()

                };
            }

            this.state.running =
                true;

            this.state.status =
                LONG_HORIZON_FORECAST_STATUS.RUNNING;

            this.state.startedAt =
                now();

            this.state.completedAt =
                null;

            this.state.durationMs =
                0;

            this.state.lastRunAt =
                this.state.startedAt;

            this.state.errors =
                [];

            this.state.warnings =
                [];

            this.emit(
                LONG_HORIZON_FORECAST_EVENT.STARTED,
                {
                    input:
                        deepClone(
                            input
                        )
                }
            );

            try {

                const normalizedInput =
                    this.normalizeForecastInput(
                        input
                    );

                const arrivalExecution =
                    await this.executeArrivalPrediction(
                        normalizedInput
                    );

                const result =
                    this.buildCompleteForecastResult(
                        normalizedInput,
                        arrivalExecution
                    );

                this.synchronizeStateFromForecastResult(
                    result
                );

                this.synchronizeForecastsToCore(
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
                            deepClone(
                                result
                            )
                    }
                );

                return result;

            } catch (error) {

                const normalizedError =
                    normalizeError(
                        error
                    );

                this.state.status =
                    LONG_HORIZON_FORECAST_STATUS.FAILED;

                this.state.errors.push(
                    {

                        id:
                            createId(
                                "long_horizon_error"
                            ),

                        timestamp:
                            now(),

                        error:
                            normalizedError

                    }
                );

                this.emit(
                    LONG_HORIZON_FORECAST_EVENT.FAILED,
                    {
                        error:
                            normalizedError
                    }
                );

                return {

                    success:
                        false,

                    partial:
                        false,

                    status:
                        LONG_HORIZON_FORECAST_STATUS.FAILED,

                    error:
                        normalizedError,

                    generatedAt:
                        now()

                };

            } finally {

                this.state.running =
                    false;

                this.state.completedAt =
                    now();

                this.state.durationMs =
                    this.state.completedAt -
                    this.state.startedAt;

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

    const core =
        this.core ||
        global.RainArrivalRecoveryCoreV32Instance ||
        global.LongHorizonRecoveryCoreV32Instance ||
        null;

    if (
        !core
    ) {
        throw new Error(
            "Recovery Core is unavailable."
        );
    }

    const locations =
        typeof core.getActiveLocations ===
        "function"
            ? core.getActiveLocations()
            : core.locations instanceof Map
                ? [
                    ...core.locations.values()
                ].filter(
                    location =>
                        location?.active !==
                        false
                )
                : [];

    if (
        locations.length ===
        0
    ) {
        return {
            success:
                false,

            status:
                LONG_HORIZON_FORECAST_STATUS.FAILED,

            message:
                "No active locations are available.",

            generatedAt:
                now()
        };
    }

    const safeOptions =
        safeObject(
            options
        );

    const cityForecasts =
        [];

    const failedCities =
        [];

    const arrivalPredictions =
        [];

    const startedAt =
        now();

    this.emit(
        LONG_HORIZON_FORECAST_EVENT.STARTED,
        {
            national:
                true,

            locationCount:
                locations.length
        }
    );

    for (
        let index = 0;
        index < locations.length;
        index += 1
    ) {
        const location =
            locations[index];

        const cityName =
            location.nameAr ||
            location.nameEn ||
            location.name ||
            location.city ||
            location.code ||
            location.id;

        const regionName =
            location.regionNameAr ||
            location.regionNameEn ||
            location.region ||
            location.regionName ||
            "غير محدد";

        try {

            const result =
                await this.runForecast({
                    id:
                        location.id,

                    city:
                        cityName,

                    region:
                        regionName,

                    latitude:
                        location.latitude ??
                        location.lat,

                    longitude:
                        location.longitude ??
                        location.lon ??
                        location.lng,

                    location,

                    national:
                        true,

                    locationIndex:
                        index,

                    locationCount:
                        locations.length,

                    ...safeOptions.forecast
                });

            if (
                result?.success !==
                true
            ) {
                throw new Error(
                    result?.error?.message ||
                    result?.message ||
                    "City forecast failed."
                );
            }

            const cityForecast = {
                locationId:
                    location.id,

                locationCode:
                    location.code ||
                    null,

                city:
                    result.city ||
                    cityName,

                region:
                    result.region ||
                    regionName,

                latitude:
                    location.latitude ??
                    location.lat ??
                    null,

                longitude:
                    location.longitude ??
                    location.lon ??
                    location.lng ??
                    null,

                success:
                    true,

                status:
                    result.status,

                forecasts:
                    result.forecasts ||
                    null,

                forecastList:
                    safeArray(
                        result.forecastList
                    ),

                horizonForecasts:
                    result.horizonForecasts ||
                    result.forecasts ||
                    {},

                horizons:
                    safeArray(
                        result.horizons
                    ),

                arrivalPrediction:
                    result.arrivalPrediction ||
                    null,

                arrivalPredictions:
                    safeArray(
                        result.arrivalPredictions
                    ),

                summary:
                    result.summary ||
                    null,

                generatedAt:
                    result.generatedAt ||
                    now(),

                rawResult:
                    result
            };

            cityForecasts.push(
                cityForecast
            );

            if (
                cityForecast.arrivalPrediction
            ) {
                arrivalPredictions.push({
                    locationId:
                        location.id,

                    city:
                        cityForecast.city,

                    region:
                        cityForecast.region,

                    ...safeObject(
                        cityForecast.arrivalPrediction
                    )
                });
            }

            safeArray(
                cityForecast.arrivalPredictions
            ).forEach(
                prediction => {
                    arrivalPredictions.push({
                        locationId:
                            location.id,

                        city:
                            cityForecast.city,

                        region:
                            cityForecast.region,

                        ...safeObject(
                            prediction
                        )
                    });
                }
            );

            if (
                safeOptions.logProgress !==
                false
            ) {
                console.log(
                    "Completed:",
                    index + 1,
                    "/",
                    locations.length,
                    cityName
                );
            }

        } catch (error) {

            const normalizedError =
                normalizeError(
                    error
                );

            failedCities.push({
                locationId:
                    location.id,

                city:
                    cityName,

                region:
                    regionName,

                error:
                    normalizedError
            });

            if (
                safeOptions.stopOnError ===
                true
            ) {
                break;
            }
        }
    }

    const regionMap =
        new Map();

    cityForecasts.forEach(
        cityForecast => {

            const regionName =
                cityForecast.region ||
                "غير محدد";

            if (
                !regionMap.has(
                    regionName
                )
            ) {
                regionMap.set(
                    regionName,
                    []
                );
            }

            regionMap
                .get(
                    regionName
                )
                .push(
                    cityForecast
                );
        }
    );

    const regionForecasts =
        [
            ...regionMap.entries()
        ].map(
            (
                [
                    region,
                    cities
                ]
            ) => {

                const horizonSummary =
                    {};

                [
                    6,
                    12,
                    24,
                    48,
                    72
                ].forEach(
                    horizon => {

                        const forecasts =
                            cities
                                .map(
                                    city =>
                                        city
                                            .horizonForecasts
                                            ?.[horizon] ||
                                        city
                                            .horizonForecasts
                                            ?.[
                                                String(
                                                    horizon
                                                )
                                            ] ||
                                        null
                                )
                                .filter(
                                    Boolean
                                );

                        horizonSummary[horizon] = {
                            horizonHours:
                                horizon,

                            cityCount:
                                forecasts.length,

                            forecasts
                        };
                    }
                );

                return {
                    region,

                    cityCount:
                        cities.length,

                    cities,

                    horizonForecasts:
                        horizonSummary,

                    generatedAt:
                        now()
                };
            }
        );

    const horizonForecasts =
        {};

    [
        6,
        12,
        24,
        48,
        72
    ].forEach(
        horizon => {

            const locationsForHorizon =
                cityForecasts
                    .map(
                        city => {

                            const forecast =
                                city
                                    .horizonForecasts
                                    ?.[horizon] ||
                                city
                                    .horizonForecasts
                                    ?.[
                                        String(
                                            horizon
                                        )
                                    ] ||
                                null;

                            if (
                                !forecast
                            ) {
                                return null;
                            }

                            return {
                                locationId:
                                    city.locationId,

                                city:
                                    city.city,

                                region:
                                    city.region,

                                latitude:
                                    city.latitude,

                                longitude:
                                    city.longitude,

                                forecast
                            };
                        }
                    )
                    .filter(
                        Boolean
                    );

            horizonForecasts[
                "h" +
                horizon
            ] = {
                horizonHours:
                    horizon,

                locations:
                    locationsForHorizon,

                locationCount:
                    locationsForHorizon.length,

                generatedAt:
                    now()
            };
        }
    );

    const completedAt =
        now();

    const nationalResult = {
        id:
            createId(
                "national_long_horizon_forecast"
            ),

        success:
            cityForecasts.length >
            0,

        partial:
            failedCities.length >
            0,

        status:
            failedCities.length ===
            0
                ? LONG_HORIZON_FORECAST_STATUS.COMPLETED
                : LONG_HORIZON_FORECAST_STATUS.PARTIAL,

        generatedAt:
            completedAt,

        startedAt,

        completedAt,

        durationMs:
            completedAt -
            startedAt,

        totalLocations:
            locations.length,

        completedCities:
            cityForecasts.length,

        failedCount:
            failedCities.length,

        regionCount:
            regionForecasts.length,

        arrivalCount:
            arrivalPredictions.length,

        horizons: [
            6,
            12,
            24,
            48,
            72
        ],

        cityForecasts,

        regionForecasts,

        arrivalPredictions,

        horizonForecasts,

        failedCities
    };

    core.cityForecasts =
        cityForecasts;

    core.regionForecasts =
        regionForecasts;

    core.arrivalPredictions =
        arrivalPredictions;

    core.horizonForecasts =
        horizonForecasts;

    core.longHorizonForecast =
        nationalResult;

    core.latestForecast =
        nationalResult;

    core.forecastData =
        cityForecasts;

    this.state.latestNationalForecast =
        deepClone(
            nationalResult
        );

    this.state.latestForecast =
        deepClone(
            nationalResult
        );

    this.state.lastSuccessfulRunAt =
        nationalResult.success
            ? completedAt
            : this.state.lastSuccessfulRunAt;

    this.emit(
        LONG_HORIZON_FORECAST_EVENT.COMPLETED,
        {
            national:
                true,

            result:
                deepClone(
                    nationalResult
                )
        }
    );

    return nationalResult;
},

       getLatestNationalForecast() {

    return (
        this.state
            .latestNationalForecast ||
        this.core
            ?.longHorizonForecast ||
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

            this.destroyed =
                true;

            this.state.destroyed =
                true;

            this.state.running =
                false;

            this.state.status =
                LONG_HORIZON_FORECAST_STATUS.DESTROYED;

            this.events.clear();

            this.emit(
                LONG_HORIZON_FORECAST_EVENT.DESTROYED,
                {
                    id:
                        this.id
                }
            );

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

    (
        typeof global.RainArrivalPredictionEngineV32 ===
        "function"
            ? new global.RainArrivalPredictionEngineV32()
            : null
    )

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


    /* لا تغلق الدالة الآن؛ بقية الأجزاء ستكمل داخل نفس الملف. */
