/* ==========================================================================
 * RainGuard AI V32
 * Rain Arrival Prediction Engine
 * ==========================================================================
 *
 * File:
 * frontend/js/rain_arrival_prediction_engine_v32.js
 *
 * Engine:
 * RainArrivalPredictionEngineV32
 *
 * Version:
 * 32.0.0
 *
 * Part:
 * 1.1A — Header and Engine Identity
 *
 * Important:
 * - هذا هو أول جزء في الملف.
 * - لا تضف أي قوس إغلاق بعده.
 * - ألصق الجزء 1.1B مباشرة بعد آخر سطر.
 *
 * ========================================================================== */

(function initializeRainArrivalPredictionEngineV32(globalScope) {
    "use strict";

    /* ======================================================================
     * SECTION 1
     * Engine identity
     * ====================================================================== */

    const ENGINE_NAME =
        "RainArrivalPredictionEngineV32";

    const ENGINE_DISPLAY_NAME =
        "RainGuard AI V32 Rain Arrival Prediction Engine";

    const ENGINE_VERSION =
        "32.0.0";

    const ENGINE_MAJOR_VERSION =
        32;

    const ENGINE_MINOR_VERSION =
        0;

    const ENGINE_PATCH_VERSION =
        0;

    const ENGINE_NAMESPACE =
        "RG32";

    const ENGINE_BUILD =
        "rainguard-v32-rain-arrival-production";

    const ENGINE_STAGE =
        "production";

    const ENGINE_RELEASE_CHANNEL =
        "stable";

    const ENGINE_AUTHOR =
        "RainGuard AI";

    const ENGINE_DESCRIPTION =
        "National storm motion, city impact and rain arrival prediction engine.";

    const ENGINE_FILE_NAME =
        "rain_arrival_prediction_engine_v32.js";

    const ENGINE_GLOBAL_CLASS_NAME =
        "RainArrivalPredictionEngineV32";

    const ENGINE_GLOBAL_INSTANCE_NAME =
        "rainArrivalPredictionEngineV32";

    const ENGINE_COMPATIBILITY_KEY =
        "rainArrivalPrediction";

    /* ======================================================================
     * SECTION 2
     * Compatibility versions
     * ====================================================================== */

    const COMPATIBILITY_VERSIONS =
        Object.freeze({

            V30:
                "30",

            V31:
                "31",

            V32:
                "32"
        });

    const COMPATIBILITY_GLOBALS =
        Object.freeze({

            V30_NAMESPACE:
                "RG30",

            V31_NAMESPACE:
                "RG31",

            V32_NAMESPACE:
                "RG32",

            V30_ORCHESTRATOR:
                "RainGuardV30Orchestrator",

            V31_STORM_TRACKER:
                "StormCellTrackingEngineV31",

            V31_STORM_PATH:
                "StormPathPredictionEngineV31",

            V31_STORM_VISUALIZATION:
                "StormVisualizationEngineV31",

            V32_RAIN_ARRIVAL:
                "RainArrivalPredictionEngineV32"
        });

    /* ======================================================================
     * SECTION 3
     * Immutable engine metadata
     * ====================================================================== */

    const ENGINE_METADATA =
        Object.freeze({

            name:
                ENGINE_NAME,

            displayName:
                ENGINE_DISPLAY_NAME,

            version:
                ENGINE_VERSION,

            major:
                ENGINE_MAJOR_VERSION,

            minor:
                ENGINE_MINOR_VERSION,

            patch:
                ENGINE_PATCH_VERSION,

            namespace:
                ENGINE_NAMESPACE,

            build:
                ENGINE_BUILD,

            stage:
                ENGINE_STAGE,

            releaseChannel:
                ENGINE_RELEASE_CHANNEL,

            author:
                ENGINE_AUTHOR,

            description:
                ENGINE_DESCRIPTION,

            fileName:
                ENGINE_FILE_NAME,

            globalClassName:
                ENGINE_GLOBAL_CLASS_NAME,

            globalInstanceName:
                ENGINE_GLOBAL_INSTANCE_NAME,

            compatibilityKey:
                ENGINE_COMPATIBILITY_KEY
        });

    /* ======================================================================
     * SECTION 4
     * Basic system limits
     * ====================================================================== */

    const MAXIMUM_SAFE_ARRAY_LENGTH =
        10000;

    const MAXIMUM_SAFE_OBJECT_DEPTH =
        25;

    const MAXIMUM_SAFE_STRING_LENGTH =
        100000;

    const MAXIMUM_SAFE_MAP_SIZE =
        10000;

    const MAXIMUM_SAFE_SET_SIZE =
        10000;

    const MAXIMUM_SAFE_RECURSION_DEPTH =
        50;

    /* ======================================================================
     * SECTION 5
     * Internal symbols
     * ====================================================================== */

    const INTERNAL_SYMBOLS =
        Object.freeze({

            ENGINE_INSTANCE:
                Symbol(
                    "RG32_ENGINE_INSTANCE"
                ),

            INITIALIZED:
                Symbol(
                    "RG32_INITIALIZED"
                ),

            DESTROYED:
                Symbol(
                    "RG32_DESTROYED"
                ),

            CONFIG_LOCK:
                Symbol(
                    "RG32_CONFIG_LOCK"
                ),

            OPERATION_LOCK:
                Symbol(
                    "RG32_OPERATION_LOCK"
                ),

            EVENT_DISPATCH:
                Symbol(
                    "RG32_EVENT_DISPATCH"
                ),

            INTERNAL_STATE:
                Symbol(
                    "RG32_INTERNAL_STATE"
                )
        });

    /* ======================================================================
     * END OF PART 1.1A
     *
     * ألصق الجزء 1.1B بعد هذا السطر مباشرة.
     * لا تغلق IIFE هنا.
     * ====================================================================== */
     /* ======================================================================
     * SECTION 6
     * Time constants
     * ====================================================================== */

    const MILLISECONDS_PER_SECOND =
        1000;

    const SECONDS_PER_MINUTE =
        60;

    const MINUTES_PER_HOUR =
        60;

    const HOURS_PER_DAY =
        24;

    const DAYS_PER_WEEK =
        7;

    const MILLISECONDS_PER_MINUTE =
        SECONDS_PER_MINUTE *
        MILLISECONDS_PER_SECOND;

    const MILLISECONDS_PER_HOUR =
        MINUTES_PER_HOUR *
        MILLISECONDS_PER_MINUTE;

    const MILLISECONDS_PER_DAY =
        HOURS_PER_DAY *
        MILLISECONDS_PER_HOUR;

    const MILLISECONDS_PER_WEEK =
        DAYS_PER_WEEK *
        MILLISECONDS_PER_DAY;

    /* ======================================================================
     * SECTION 7
     * Runtime intervals
     * ====================================================================== */

    const DEFAULT_ENGINE_TICK_MS =
        1000;

    const DEFAULT_UPDATE_INTERVAL_MS =
        60000;

    const DEFAULT_BACKGROUND_UPDATE_MS =
        120000;

    const DEFAULT_MOTION_UPDATE_MS =
        60000;

    const DEFAULT_TRACKING_UPDATE_MS =
        60000;

    const DEFAULT_PREDICTION_UPDATE_MS =
        60000;

    const DEFAULT_CITY_UPDATE_MS =
        60000;

    const DEFAULT_TIMELINE_UPDATE_MS =
        60000;

    const DEFAULT_EVENT_FLUSH_MS =
        5000;

    const DEFAULT_STATISTICS_UPDATE_MS =
        30000;

    const DEFAULT_METRICS_UPDATE_MS =
        30000;

    const DEFAULT_HEALTH_CHECK_MS =
        30000;

    const DEFAULT_HEARTBEAT_MS =
        15000;

    const DEFAULT_SOURCE_REFRESH_MS =
        300000;

    /* ======================================================================
     * SECTION 8
     * Cleanup intervals
     * ====================================================================== */

    const DEFAULT_CLEANUP_INTERVAL_MS =
        300000;

    const DEFAULT_CACHE_CLEANUP_MS =
        300000;

    const DEFAULT_HISTORY_CLEANUP_MS =
        600000;

    const DEFAULT_LOG_CLEANUP_MS =
        900000;

    const DEFAULT_MEMORY_CHECK_MS =
        600000;

    const DEFAULT_STALE_SCAN_MS =
        300000;

    /* ======================================================================
     * SECTION 9
     * Cache lifetime
     * ====================================================================== */

    const DEFAULT_CACHE_TTL_MS =
        300000;

    const DEFAULT_CELL_CACHE_TTL_MS =
        600000;

    const DEFAULT_CITY_CACHE_TTL_MS =
        600000;

    const DEFAULT_REGION_CACHE_TTL_MS =
        900000;

    const DEFAULT_TRACKING_CACHE_TTL_MS =
        300000;

    const DEFAULT_PREDICTION_CACHE_TTL_MS =
        300000;

    const DEFAULT_TIMELINE_CACHE_TTL_MS =
        300000;

    /* ======================================================================
     * SECTION 10
     * Timeout values
     * ====================================================================== */

    const DEFAULT_OPERATION_TIMEOUT_MS =
        30000;

    const DEFAULT_SOURCE_TIMEOUT_MS =
        15000;

    const DEFAULT_FETCH_TIMEOUT_MS =
        15000;

    const DEFAULT_LOCK_TIMEOUT_MS =
        10000;

    const DEFAULT_QUEUE_TIMEOUT_MS =
        60000;

    const DEFAULT_INITIALIZATION_TIMEOUT_MS =
        60000;

    const DEFAULT_SHUTDOWN_TIMEOUT_MS =
        30000;

    /* ======================================================================
     * SECTION 11
     * History retention
     * ====================================================================== */

    const DEFAULT_HISTORY_RETENTION_HOURS =
        24;

    const DEFAULT_EVENT_RETENTION_HOURS =
        24;

    const DEFAULT_LOG_RETENTION_HOURS =
        24;

    const DEFAULT_METRIC_RETENTION_HOURS =
        24;

    const DEFAULT_STATISTICS_RETENTION_HOURS =
        72;

    /* ======================================================================
     * SECTION 12
     * Stale data limits
     * ====================================================================== */

    const DEFAULT_STALE_CELL_MINUTES =
        30;

    const DEFAULT_STALE_CITY_MINUTES =
        60;

    const DEFAULT_STALE_REGION_MINUTES =
        60;

    const DEFAULT_STALE_TRACKING_MINUTES =
        30;

    const DEFAULT_STALE_PREDICTION_MINUTES =
        30;

    const DEFAULT_STALE_TIMELINE_MINUTES =
        30;

    const DEFAULT_STALE_SOURCE_MINUTES =
        20;

    /* ======================================================================
     * END OF PART 1.1B
     *
     * Next:
     * Part 1.1C
     * Geographic constants
     * ====================================================================== */
     /* ======================================================================
     * SECTION 13
     * Geographic constants
     * ====================================================================== */

    const EARTH_RADIUS_KM =
        6371.0088;

    const EARTH_DIAMETER_KM =
        EARTH_RADIUS_KM * 2;

    const EARTH_CIRCUMFERENCE_KM =
        2 * Math.PI * EARTH_RADIUS_KM;

    const DEG_TO_RAD =
        Math.PI / 180;

    const RAD_TO_DEG =
        180 / Math.PI;

    const MIN_LATITUDE =
        -90;

    const MAX_LATITUDE =
        90;

    const MIN_LONGITUDE =
        -180;

    const MAX_LONGITUDE =
        180;

    const MIN_ALTITUDE_METERS =
        -500;

    const MAX_ALTITUDE_METERS =
        9000;

    /* ======================================================================
     * SECTION 14
     * Distance constants
     * ====================================================================== */

    const METERS_PER_KILOMETER =
        1000;

    const KILOMETERS_PER_METER =
        0.001;

    const FEET_PER_METER =
        3.28084;

    const METERS_PER_NAUTICAL_MILE =
        1852;

    const KILOMETERS_PER_NAUTICAL_MILE =
        1.852;

    const MILES_PER_KILOMETER =
        0.621371;

    const KILOMETERS_PER_MILE =
        1.609344;

    /* ======================================================================
     * SECTION 15
     * Geographic limits
     * ====================================================================== */

    const DEFAULT_SEARCH_RADIUS_KM =
        100;

    const DEFAULT_CITY_RADIUS_KM =
        30;

    const DEFAULT_STORM_ASSOCIATION_RADIUS_KM =
        25;

    const DEFAULT_CELL_MATCH_RADIUS_KM =
        20;

    const DEFAULT_REGION_RADIUS_KM =
        75;

    const DEFAULT_CORRIDOR_WIDTH_KM =
        20;

    const DEFAULT_CORRIDOR_BUFFER_KM =
        10;

    const DEFAULT_MAX_CORRIDOR_WIDTH_KM =
        300;

    const DEFAULT_MIN_CORRIDOR_WIDTH_KM =
        2;

    /* ======================================================================
     * SECTION 16
     * Bearing constants
     * ====================================================================== */

    const NORTH_BEARING =
        0;

    const EAST_BEARING =
        90;

    const SOUTH_BEARING =
        180;

    const WEST_BEARING =
        270;

    const FULL_CIRCLE =
        360;

    const HALF_CIRCLE =
        180;

    const QUARTER_CIRCLE =
        90;

    /* ======================================================================
     * SECTION 17
     * Coordinate precision
     * ====================================================================== */

    const LAT_LON_PRECISION =
        6;

    const DISTANCE_PRECISION =
        2;

    const SPEED_PRECISION =
        2;

    const DIRECTION_PRECISION =
        1;

    const ETA_PRECISION =
        1;

    /* ======================================================================
     * SECTION 18
     * Saudi Arabia Bounding Box
     * ====================================================================== */

    const SAUDI_BOUNDING_BOX =
        Object.freeze({

            north: 32.5,

            south: 16.0,

            west: 34.0,

            east: 56.5

        });

    /* ======================================================================
     * SECTION 19
     * Geographic validation
     * ====================================================================== */

    const GEO_VALIDATION =
        Object.freeze({

            MIN_LAT:
                MIN_LATITUDE,

            MAX_LAT:
                MAX_LATITUDE,

            MIN_LON:
                MIN_LONGITUDE,

            MAX_LON:
                MAX_LONGITUDE

        });

    /* ======================================================================
     * END OF PART 1.1C
     *
     * Next:
     * Part 1.1D
     * Motion constants
     * ====================================================================== */
     /* ======================================================================
     * SECTION 20
     * Motion constants
     * ====================================================================== */

    const DEFAULT_SPEED_KMH =
        0;

    const MINIMUM_SPEED_KMH =
        0;

    const MAXIMUM_SPEED_KMH =
        250;

    const DEFAULT_ACCELERATION_KMH_PER_HOUR =
        0;

    const MINIMUM_ACCELERATION_KMH_PER_HOUR =
        -100;

    const MAXIMUM_ACCELERATION_KMH_PER_HOUR =
        100;

    const DEFAULT_DIRECTION_DEGREES =
        0;

    const MINIMUM_DIRECTION_DEGREES =
        0;

    const MAXIMUM_DIRECTION_DEGREES =
        360;

    const DEFAULT_TURN_RATE_DEGREES =
        0;

    const MAXIMUM_TURN_RATE_DEGREES =
        180;

    /* ======================================================================
     * SECTION 21
     * Motion tracking limits
     * ====================================================================== */

    const DEFAULT_TRACK_HISTORY_SIZE =
        120;

    const DEFAULT_MIN_TRACK_POINTS =
        3;

    const DEFAULT_MAX_TRACK_POINTS =
        120;

    const DEFAULT_MAX_MISSING_UPDATES =
        8;

    const DEFAULT_MAX_TRACK_AGE_MINUTES =
        120;

    const DEFAULT_MAX_POSITION_JUMP_KM =
        150;

    const DEFAULT_MAX_DIRECTION_CHANGE =
        120;

    const DEFAULT_MAX_SPEED_CHANGE =
        80;

    const DEFAULT_MIN_MOVEMENT_DISTANCE_KM =
        0.10;

    /* ======================================================================
     * SECTION 22
     * Motion smoothing
     * ====================================================================== */

    const DEFAULT_POSITION_SMOOTHING =
        0.35;

    const DEFAULT_DIRECTION_SMOOTHING =
        0.25;

    const DEFAULT_SPEED_SMOOTHING =
        0.35;

    const DEFAULT_ACCELERATION_SMOOTHING =
        0.25;

    const DEFAULT_INTENSITY_SMOOTHING =
        0.30;

    /* ======================================================================
     * SECTION 23
     * Kalman filter defaults
     * ====================================================================== */

    const DEFAULT_KALMAN_PROCESS_NOISE =
        0.01;

    const DEFAULT_KALMAN_MEASUREMENT_NOISE =
        0.10;

    const DEFAULT_KALMAN_ESTIMATION_ERROR =
        1.0;

    const DEFAULT_KALMAN_GAIN =
        0.5;

    const DEFAULT_KALMAN_INITIAL_STATE =
        0;

    /* ======================================================================
     * SECTION 24
     * Alpha-Beta filter
     * ====================================================================== */

    const DEFAULT_ALPHA =
        0.85;

    const DEFAULT_BETA =
        0.005;

    const DEFAULT_DELTA_TIME_SECONDS =
        60;

    const DEFAULT_ALPHA_BETA_CONFIDENCE =
        75;

    /* ======================================================================
     * SECTION 25
     * Motion fusion
     * ====================================================================== */

    const DEFAULT_FUSION_WEIGHT_KALMAN =
        0.40;

    const DEFAULT_FUSION_WEIGHT_ALPHA_BETA =
        0.25;

    const DEFAULT_FUSION_WEIGHT_HISTORY =
        0.20;

    const DEFAULT_FUSION_WEIGHT_SOURCE =
        0.15;

    const DEFAULT_MIN_FUSION_CONFIDENCE =
        20;

    /* ======================================================================
     * SECTION 26
     * Motion confidence
     * ====================================================================== */

    const DEFAULT_MOTION_CONFIDENCE =
        50;

    const MINIMUM_MOTION_CONFIDENCE =
        0;

    const MAXIMUM_MOTION_CONFIDENCE =
        100;

    const DEFAULT_TRACK_QUALITY =
        50;

    const DEFAULT_MOTION_QUALITY =
        50;

    /* ======================================================================
     * SECTION 27
     * Direction sectors
     * ====================================================================== */

    const DIRECTION_SECTORS =
        Object.freeze({

            N: 0,

            NNE: 22.5,

            NE: 45,

            ENE: 67.5,

            E: 90,

            ESE: 112.5,

            SE: 135,

            SSE: 157.5,

            S: 180,

            SSW: 202.5,

            SW: 225,

            WSW: 247.5,

            W: 270,

            WNW: 292.5,

            NW: 315,

            NNW: 337.5

        });

    /* ======================================================================
     * SECTION 28
     * Motion state
     * ====================================================================== */

    const MOTION_STATE =
        Object.freeze({

            UNKNOWN:
                "unknown",

            STATIONARY:
                "stationary",

            MOVING:
                "moving",

            ACCELERATING:
                "accelerating",

            DECELERATING:
                "decelerating",

            TURNING:
                "turning",

            SPLITTING:
                "splitting",

            MERGING:
                "merging"

        });

    /* ======================================================================
     * END OF PART 1.1D
     *
     * Next:
     * Part 1.1E
     * Prediction constants
     * ====================================================================== */

     /* ======================================================================
     * SECTION 29
     * Prediction horizons
     * ====================================================================== */

    const DEFAULT_PREDICTION_STEP_MINUTES =
        10;

    const DEFAULT_MIN_PREDICTION_MINUTES =
        5;

    const DEFAULT_MAX_PREDICTION_MINUTES =
        120;

    const DEFAULT_PREDICTION_HORIZONS =
        Object.freeze([
            10,
            20,
            30,
            45,
            60,
            90,
            120
        ]);

    const REQUIRED_V31_HORIZONS =
        Object.freeze([
            30,
            60,
            90,
            120
        ]);

    /* ======================================================================
     * SECTION 30
     * ETA constants
     * ====================================================================== */

    const MINIMUM_ETA_MINUTES =
        0;

    const MAXIMUM_ETA_MINUTES =
        360;

    const DEFAULT_ETA_TOLERANCE_MINUTES =
        10;

    const DEFAULT_ARRIVAL_WINDOW_MINUTES =
        20;

    const DEFAULT_LATE_WINDOW_MINUTES =
        30;

    const DEFAULT_EARLY_WINDOW_MINUTES =
        10;

    /* ======================================================================
     * SECTION 31
     * Prediction confidence
     * ====================================================================== */

    const DEFAULT_PREDICTION_CONFIDENCE =
        50;

    const DEFAULT_MIN_PREDICTION_CONFIDENCE =
        10;

    const DEFAULT_MAX_PREDICTION_CONFIDENCE =
        100;

    const DEFAULT_CONFIDENCE_DECAY_PER_HOUR =
        12;

    const DEFAULT_CONFIDENCE_DECAY_PER_STEP =
        2;

    /* ======================================================================
     * SECTION 32
     * Position uncertainty
     * ====================================================================== */

    const DEFAULT_POSITION_UNCERTAINTY_KM =
        2;

    const DEFAULT_DIRECTION_UNCERTAINTY_DEGREES =
        8;

    const DEFAULT_SPEED_UNCERTAINTY_KMH =
        5;

    const DEFAULT_UNCERTAINTY_GROWTH_KM_PER_HOUR =
        8;

    const DEFAULT_MAX_UNCERTAINTY_KM =
        100;

    /* ======================================================================
     * SECTION 33
     * Rain corridor
     * ====================================================================== */

    const DEFAULT_CORRIDOR_WIDTH =
        20;

    const DEFAULT_CORRIDOR_BUFFER =
        10;

    const DEFAULT_MAX_CORRIDOR_WIDTH =
        300;

    const DEFAULT_MIN_CORRIDOR_WIDTH =
        2;

    const DEFAULT_CORRIDOR_POINT_SPACING_KM =
        5;

    /* ======================================================================
     * SECTION 34
     * City impact
     * ====================================================================== */

    const DEFAULT_CITY_IMPACT_RADIUS_KM =
        30;

    const DEFAULT_CITY_WARNING_RADIUS_KM =
        50;

    const DEFAULT_CITY_SAFE_RADIUS_KM =
        100;

    const DEFAULT_CITY_MATCH_RADIUS_KM =
        15;

    /* ======================================================================
     * SECTION 35
     * Timeline
     * ====================================================================== */

    const DEFAULT_TIMELINE_INTERVAL_MINUTES =
        10;

    const DEFAULT_TIMELINE_DURATION_MINUTES =
        120;

    const DEFAULT_TIMELINE_MAX_POINTS =
        24;

    /* ======================================================================
     * SECTION 36
     * Prediction quality
     * ====================================================================== */

    const DEFAULT_PREDICTION_QUALITY =
        50;

    const DEFAULT_TRACK_QUALITY_WEIGHT =
        0.35;

    const DEFAULT_SOURCE_QUALITY_WEIGHT =
        0.35;

    const DEFAULT_HISTORY_QUALITY_WEIGHT =
        0.30;

    /* ======================================================================
     * END OF PART 1.1E
     *
     * Next:
     * Part 1.1F
     * Confidence, Quality & Risk constants
     * ====================================================================== */

     /* ======================================================================
     * SECTION 37
     * Confidence constants
     * ====================================================================== */

    const MIN_CONFIDENCE =
        0;

    const MAX_CONFIDENCE =
        100;

    const DEFAULT_CONFIDENCE =
        50;

    const VERY_LOW_CONFIDENCE =
        20;

    const LOW_CONFIDENCE =
        40;

    const MEDIUM_CONFIDENCE =
        60;

    const HIGH_CONFIDENCE =
        80;

    const VERY_HIGH_CONFIDENCE =
        95;

    const CONFIDENCE_LEVELS =
        Object.freeze({

            VERY_LOW:
                "very-low",

            LOW:
                "low",

            MEDIUM:
                "medium",

            HIGH:
                "high",

            VERY_HIGH:
                "very-high"

        });

    /* ======================================================================
     * SECTION 38
     * Quality constants
     * ====================================================================== */

    const MIN_QUALITY =
        0;

    const MAX_QUALITY =
        100;

    const DEFAULT_QUALITY =
        50;

    const EXCELLENT_QUALITY =
        95;

    const GOOD_QUALITY =
        80;

    const FAIR_QUALITY =
        60;

    const POOR_QUALITY =
        30;

    const QUALITY_LEVELS =
        Object.freeze({

            EXCELLENT:
                "excellent",

            GOOD:
                "good",

            FAIR:
                "fair",

            POOR:
                "poor",

            UNKNOWN:
                "unknown"

        });

    /* ======================================================================
     * SECTION 39
     * Risk constants
     * ====================================================================== */

    const MIN_RISK =
        0;

    const MAX_RISK =
        100;

    const DEFAULT_RISK =
        0;

    const LOW_RISK =
        20;

    const MODERATE_RISK =
        40;

    const HIGH_RISK =
        60;

    const SEVERE_RISK =
        80;

    const EXTREME_RISK =
        95;

    const RISK_LEVELS =
        Object.freeze({

            NONE:
                "none",

            LOW:
                "low",

            MODERATE:
                "moderate",

            HIGH:
                "high",

            SEVERE:
                "severe",

            EXTREME:
                "extreme"

        });

    /* ======================================================================
     * SECTION 40
     * Rain intensity
     * ====================================================================== */

    const LIGHT_RAIN_MM =
        0.1;

    const MODERATE_RAIN_MM =
        2.5;

    const HEAVY_RAIN_MM =
        7.5;

    const VERY_HEAVY_RAIN_MM =
        15;

    const EXTREME_RAIN_MM =
        30;

    const RAIN_INTENSITY =
        Object.freeze({

            NONE:
                "none",

            LIGHT:
                "light",

            MODERATE:
                "moderate",

            HEAVY:
                "heavy",

            VERY_HEAVY:
                "very-heavy",

            EXTREME:
                "extreme"

        });

    /* ======================================================================
     * SECTION 41
     * Source reliability
     * ====================================================================== */

    const DEFAULT_SOURCE_RELIABILITY =
        50;

    const MIN_SOURCE_RELIABILITY =
        0;

    const MAX_SOURCE_RELIABILITY =
        100;

    const DEFAULT_SOURCE_WEIGHT =
        1.0;

    const MIN_SOURCE_WEIGHT =
        0.0;

    const MAX_SOURCE_WEIGHT =
        5.0;

    /* ======================================================================
     * SECTION 42
     * Feature flags
     * ====================================================================== */

    const ENGINE_FEATURE_FLAGS =
        Object.freeze({

            kalman:
                true,

            alphaBeta:
                true,

            motionFusion:
                true,

            rainCorridor:
                true,

            etaPrediction:
                true,

            cityImpact:
                true,

            nationalTimeline:
                true,

            cache:
                true,

            statistics:
                true,

            metrics:
                true,

            eventBus:
                true,

            localization:
                true,

            compatibilityV30:
                true,

            compatibilityV31:
                true,

            compatibilityV32:
                true

        });

    /* ======================================================================
     * SECTION 43
     * Default locale
     * ====================================================================== */

    const DEFAULT_LANGUAGE =
        "ar";

    const FALLBACK_LANGUAGE =
        "en";

    const SUPPORTED_LANGUAGES =
        Object.freeze([
            "ar",
            "en"
        ]);

    /* ======================================================================
     * END OF PART 1.1F
     *
     * Foundation Constants Completed
     *
     * Next:
     * Part 1.2A
     * Configuration Engine
     * ====================================================================== */

     /* ======================================================================
     * SECTION 44
     * Default Engine Configuration
     * ====================================================================== */

    const DEFAULT_ENGINE_CONFIG = Object.freeze({

        enabled: true,

        autoStart: false,

        debug: false,

        verbose: false,

        locale: DEFAULT_LANGUAGE,

        timezone: "Asia/Riyadh",

        heartbeatInterval: DEFAULT_HEARTBEAT_MS,

        updateInterval: DEFAULT_UPDATE_INTERVAL_MS,

        cleanupInterval: DEFAULT_CLEANUP_INTERVAL_MS,

        statisticsInterval: DEFAULT_STATISTICS_UPDATE_MS,

        metricsInterval: DEFAULT_METRICS_UPDATE_MS,

        healthCheckInterval: DEFAULT_HEALTH_CHECK_MS,

        maxHistorySize: DEFAULT_TRACK_HISTORY_SIZE,

        maxCacheEntries: 1000,

        cacheTTL: DEFAULT_CACHE_TTL_MS

    });

    /* ======================================================================
     * SECTION 45
     * Motion Configuration
     * ====================================================================== */

    const DEFAULT_MOTION_CONFIG = Object.freeze({

        enabled: true,

        smoothing: DEFAULT_POSITION_SMOOTHING,

        directionSmoothing: DEFAULT_DIRECTION_SMOOTHING,

        speedSmoothing: DEFAULT_SPEED_SMOOTHING,

        accelerationSmoothing: DEFAULT_ACCELERATION_SMOOTHING,

        minimumTrackPoints: DEFAULT_MIN_TRACK_POINTS,

        maximumTrackPoints: DEFAULT_MAX_TRACK_POINTS,

        maximumMissingUpdates: DEFAULT_MAX_MISSING_UPDATES,

        maximumPositionJumpKm: DEFAULT_MAX_POSITION_JUMP_KM,

        maximumDirectionChange: DEFAULT_MAX_DIRECTION_CHANGE,

        maximumSpeedChange: DEFAULT_MAX_SPEED_CHANGE

    });

    /* ======================================================================
     * SECTION 46
     * Prediction Configuration
     * ====================================================================== */

    const DEFAULT_PREDICTION_CONFIG = Object.freeze({

        enabled: true,

        horizons: DEFAULT_PREDICTION_HORIZONS,

        stepMinutes: DEFAULT_PREDICTION_STEP_MINUTES,

        maximumMinutes: DEFAULT_MAX_PREDICTION_MINUTES,

        confidenceDecay: DEFAULT_CONFIDENCE_DECAY_PER_HOUR,

        uncertaintyGrowth: DEFAULT_UNCERTAINTY_GROWTH_KM_PER_HOUR,

        etaTolerance: DEFAULT_ETA_TOLERANCE_MINUTES,

        arrivalWindow: DEFAULT_ARRIVAL_WINDOW_MINUTES

    });

    /* ======================================================================
     * SECTION 47
     * Corridor Configuration
     * ====================================================================== */

    const DEFAULT_CORRIDOR_CONFIG = Object.freeze({

        enabled: true,

        widthKm: DEFAULT_CORRIDOR_WIDTH,

        bufferKm: DEFAULT_CORRIDOR_BUFFER,

        pointSpacingKm: DEFAULT_CORRIDOR_POINT_SPACING_KM

    });

    /* ======================================================================
     * SECTION 48
     * City Impact Configuration
     * ====================================================================== */

    const DEFAULT_CITY_IMPACT_CONFIG = Object.freeze({

        enabled: true,

        impactRadiusKm: DEFAULT_CITY_IMPACT_RADIUS_KM,

        warningRadiusKm: DEFAULT_CITY_WARNING_RADIUS_KM,

        safeRadiusKm: DEFAULT_CITY_SAFE_RADIUS_KM,

        cityMatchRadiusKm: DEFAULT_CITY_MATCH_RADIUS_KM

    });

    /* ======================================================================
     * END OF PART 1.2A
     *
     * Next:
     * Part 1.2B
     * Runtime Configuration
     * ====================================================================== */
     /* ======================================================================
     * SECTION 49
     * Runtime Configuration
     * ====================================================================== */

    const DEFAULT_RUNTIME_CONFIG = Object.freeze({

        autoInitialize: true,

        autoCleanup: true,

        autoRecovery: true,

        autoStatistics: true,

        autoMetrics: true,

        autoHealthCheck: true,

        autoHeartbeat: true,

        allowHotReload: false,

        keepHistoryOnRestart: true,

        emitEvents: true

    });

    /* ======================================================================
     * SECTION 50
     * Cache Configuration
     * ====================================================================== */

    const DEFAULT_CACHE_CONFIG = Object.freeze({

        enabled: true,

        ttl: DEFAULT_CACHE_TTL_MS,

        cleanupInterval: DEFAULT_CACHE_CLEANUP_MS,

        maximumEntries: 1000,

        cachePredictions: true,

        cacheTracking: true,

        cacheMotion: true,

        cacheCities: true,

        cacheCorridors: true,

        cacheTimeline: true

    });

    /* ======================================================================
     * SECTION 51
     * Statistics Configuration
     * ====================================================================== */

    const DEFAULT_STATISTICS_CONFIG = Object.freeze({

        enabled: true,

        collectRuntime: true,

        collectPredictionMetrics: true,

        collectTrackingMetrics: true,

        collectMotionMetrics: true,

        collectMemoryMetrics: true,

        collectPerformanceMetrics: true,

        updateInterval: DEFAULT_STATISTICS_UPDATE_MS,

        retentionHours: DEFAULT_STATISTICS_RETENTION_HOURS

    });

    /* ======================================================================
     * SECTION 52
     * Metrics Configuration
     * ====================================================================== */

    const DEFAULT_METRICS_CONFIG = Object.freeze({

        enabled: true,

        updateInterval: DEFAULT_METRICS_UPDATE_MS,

        keepHistory: true,

        historySize: 500,

        measureLatency: true,

        measureMemory: true,

        measureCPU: true,

        measurePredictionTime: true,

        measureTrackingTime: true

    });

    /* ======================================================================
     * SECTION 53
     * Event Configuration
     * ====================================================================== */

    const DEFAULT_EVENT_CONFIG = Object.freeze({

        enabled: true,

        emitLifecycle: true,

        emitTracking: true,

        emitPrediction: true,

        emitMotion: true,

        emitArrival: true,

        emitCityImpact: true,

        emitStatistics: true,

        emitErrors: true,

        emitWarnings: true

    });

    /* ======================================================================
     * SECTION 54
     * Compatibility Configuration
     * ====================================================================== */

    const DEFAULT_COMPATIBILITY_CONFIG = Object.freeze({

        enableV30: true,

        enableV31: true,

        enableFutureVersions: true,

        strictMode: false,

        autoDetectModules: true,

        exposeGlobalAPI: true,

        exposeSingleton: true

    });

    /* ======================================================================
     * SECTION 55
     * Master Configuration
     * ====================================================================== */

    const DEFAULT_CONFIGURATION = Object.freeze({

        engine: DEFAULT_ENGINE_CONFIG,

        runtime: DEFAULT_RUNTIME_CONFIG,

        cache: DEFAULT_CACHE_CONFIG,

        motion: DEFAULT_MOTION_CONFIG,

        prediction: DEFAULT_PREDICTION_CONFIG,

        corridor: DEFAULT_CORRIDOR_CONFIG,

        cityImpact: DEFAULT_CITY_IMPACT_CONFIG,

        statistics: DEFAULT_STATISTICS_CONFIG,

        metrics: DEFAULT_METRICS_CONFIG,

        events: DEFAULT_EVENT_CONFIG,

        compatibility: DEFAULT_COMPATIBILITY_CONFIG

    });

    /* ======================================================================
     * END OF PART 1.2B
     *
     * Configuration Engine Completed
     *
     * Next:
     * Part 1.3A
     * Class Declaration
     * Constructor
     * Runtime Containers
     * ====================================================================== */

     /* ======================================================================
     * SECTION 56
     * Main Engine Class
     * ====================================================================== */

    class RainArrivalPredictionEngineV32 {

        constructor(options = {}) {

            /* ==============================================================
             * Engine Identity
             * ============================================================== */

            this.name =
                ENGINE_NAME;

            this.displayName =
                ENGINE_DISPLAY_NAME;

            this.version =
                ENGINE_VERSION;

            this.namespace =
                ENGINE_NAMESPACE;

            this.build =
                ENGINE_BUILD;

            this.metadata =
                ENGINE_METADATA;

            /* ==============================================================
             * Configuration
             * ============================================================== */

            this.config =
                this.createInitialConfiguration(options);

            this.locale =
                this.config.engine.locale;

            this.timezone =
                this.config.engine.timezone;

            this.debug =
                Boolean(this.config.engine.debug);

            this.verbose =
                Boolean(this.config.engine.verbose);

            /* ==============================================================
             * Runtime State
             * ============================================================== */

            this.runtimeState = {

                status:
                    "created",

                health:
                    "unknown",

                initialized:
                    false,

                running:
                    false,

                paused:
                    false,

                stopping:
                    false,

                restarting:
                    false,

                clearing:
                    false,

                destroyed:
                    false,

                startedAt:
                    null,

                stoppedAt:
                    null,

                pausedAt:
                    null,

                resumedAt:
                    null,

                initializedAt:
                    null,

                destroyedAt:
                    null,

                lastUpdateAt:
                    null,

                lastHeartbeatAt:
                    null,

                lastCleanupAt:
                    null,

                lastHealthCheckAt:
                    null,

                lastErrorAt:
                    null,

                cycle:
                    0,

                uptimeMs:
                    0

            };

            /* ==============================================================
             * Core Data Containers
             * ============================================================== */

            this.cells =
                new Map();

            this.cities =
                new Map();

            this.regions =
                new Map();

            this.sources =
                new Map();

            this.trackingStates =
                new Map();

            this.motionStates =
                new Map();

            this.kalmanStates =
                new Map();

            this.alphaBetaStates =
                new Map();

            this.fusedMotionStates =
                new Map();

            this.predictions =
                new Map();

            this.rainCorridors =
                new Map();

            this.cityImpacts =
                new Map();

            this.arrivalPredictions =
                new Map();

            this.nationalTimeline =
                new Map();

            /* ==============================================================
             * History Containers
             * ============================================================== */

            this.cellHistory =
                new Map();

            this.motionHistory =
                new Map();

            this.trackingHistory =
                new Map();

            this.predictionHistory =
                new Map();

            this.corridorHistory =
                new Map();

            this.cityImpactHistory =
                new Map();

            this.arrivalHistory =
                new Map();

            this.sourceQualityHistory =
                new Map();

            this.weightHistory =
                new Map();

            this.statisticsHistory =
                [];

            this.metricsHistory =
                [];

            this.eventHistory =
                [];

            this.operationHistory =
                [];

            this.errorHistory =
                [];

            this.warningHistory =
                [];

            this.logHistory =
                [];

            /* ==============================================================
             * Cache Containers
             * ============================================================== */

            this.cache =
                new Map();

            this.cacheMetadata =
                new Map();

            this.cacheNamespaces =
                new Map();

            /* ==============================================================
             * Event Containers
             * ============================================================== */

            this.eventListeners =
                new Map();

            this.eventQueue =
                [];

            this.pendingEvents =
                [];

            this.eventSequence =
                0;

            /* ==============================================================
             * Operation Containers
             * ============================================================== */

            this.pendingOperations =
                new Map();

            this.activeOperations =
                new Map();

            this.operationLocks =
                new Map();

            this.cancelledOperations =
                new Set();

            this.operationSequence =
                0;

            /* ==============================================================
             * Timer References
             * ============================================================== */

            this.timers = {

                heartbeat:
                    null,

                update:
                    null,

                cleanup:
                    null,

                healthCheck:
                    null,

                statistics:
                    null,

                metrics:
                    null,

                sourceRefresh:
                    null,

                eventFlush:
                    null,

                memoryCheck:
                    null

            };

            /* ==============================================================
             * External Module References
             * ============================================================== */

            this.modules = {

                v30:
                    null,

                v31StormTracker:
                    null,

                v31StormPath:
                    null,

                v31StormVisualization:
                    null,

                map:
                    null,

                eventBus:
                    null,

                storage:
                    null,

                logger:
                    null

            };

            /* ==============================================================
             * Current Runtime References
             * ============================================================== */

            this.currentCell =
                null;

            this.currentCity =
                null;

            this.currentRegion =
                null;

            this.currentPrediction =
                null;

            this.currentOperation =
                null;

            this.lastResult =
                null;

            this.lastPredictionResult =
                null;

            this.lastTrackingResult =
                null;

            this.lastMotionResult =
                null;

            this.lastArrivalResult =
                null;

            this.lastCityImpactResult =
                null;

            this.lastTimelineResult =
                null;

            /* ==============================================================
             * Statistics
             * ============================================================== */

            this.statistics = {

                createdAt:
                    Date.now(),

                totalCycles:
                    0,

                totalCellsReceived:
                    0,

                totalCellsAccepted:
                    0,

                totalCellsRejected:
                    0,

                totalCellsExpired:
                    0,

                totalTrackingOperations:
                    0,

                successfulTrackingOperations:
                    0,

                failedTrackingOperations:
                    0,

                totalMotionCalculations:
                    0,

                totalKalmanUpdates:
                    0,

                totalAlphaBetaUpdates:
                    0,

                totalFusionOperations:
                    0,

                totalPredictions:
                    0,

                successfulPredictions:
                    0,

                failedPredictions:
                    0,

                totalCorridors:
                    0,

                totalCityImpacts:
                    0,

                totalArrivalPredictions:
                    0,

                totalTimelineUpdates:
                    0,

                totalEventsEmitted:
                    0,

                totalErrors:
                    0,

                totalWarnings:
                    0,

                totalCacheHits:
                    0,

                totalCacheMisses:
                    0,

                totalCacheWrites:
                    0,

                totalCacheDeletes:
                    0,

                totalCleanupOperations:
                    0

            };

            /* ==============================================================
             * Metrics
             * ============================================================== */

            this.metrics = {

                averageCycleTimeMs:
                    0,

                lastCycleTimeMs:
                    0,

                maximumCycleTimeMs:
                    0,

                minimumCycleTimeMs:
                    null,

                averageTrackingTimeMs:
                    0,

                averagePredictionTimeMs:
                    0,

                averageMotionTimeMs:
                    0,

                averageArrivalTimeMs:
                    0,

                cacheHitRate:
                    0,

                trackingSuccessRate:
                    0,

                predictionSuccessRate:
                    0,

                averageConfidence:
                    0,

                averageQuality:
                    0,

                memoryUsage:
                    null,

                lastUpdatedAt:
                    null

            };

            /* ==============================================================
             * Internal Flags
             * ============================================================== */

            this.flags = {

                initializing:
                    false,

                processing:
                    false,

                updating:
                    false,

                predicting:
                    false,

                tracking:
                    false,

                cleaning:
                    false,

                healthChecking:
                    false,

                emitting:
                    false,

                configLocked:
                    false,

                operationLocked:
                    false

            };

            /* ==============================================================
             * Bind Public Runtime Methods
             * ============================================================== */

            this.initialize =
                this.initialize.bind(this);

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

            this.destroy =
                this.destroy.bind(this);

            this.clear =
                this.clear.bind(this);

            /* ==============================================================
             * Constructor Completion
             * ============================================================== */

            this.runtimeState.status =
                "created";

            this.runtimeState.health =
                "unknown";

            this.instanceId =
                this.createInstanceId();

            this.createdAt =
                new Date().toISOString();

        }

    /* ======================================================================
     * END OF PART 1.3A
     *
     * لا تغلق class هنا.
     *
     * Next:
     * Part 1.3B
     * Constructor Helper Methods
     * Configuration Merge
     * Instance ID
     * ====================================================================== */
            /* ==================================================================
         * SECTION 57
         * Initial Configuration Builder
         * ================================================================== */

        createInitialConfiguration(options = {}) {

            const safeOptions =
                this.isPlainObject(options)
                    ? options
                    : {};

            const baseConfiguration =
                this.deepClone(DEFAULT_CONFIGURATION);

            const mergedConfiguration =
                this.deepMerge(
                    baseConfiguration,
                    safeOptions
                );

            return this.normalizeConfiguration(
                mergedConfiguration
            );
        }

        /* ==================================================================
         * SECTION 58
         * Configuration Normalization
         * ================================================================== */

        normalizeConfiguration(configuration = {}) {

            const config =
                this.isPlainObject(configuration)
                    ? configuration
                    : {};

            if (!this.isPlainObject(config.engine)) {
                config.engine =
                    this.deepClone(DEFAULT_ENGINE_CONFIG);
            }

            if (!this.isPlainObject(config.runtime)) {
                config.runtime =
                    this.deepClone(DEFAULT_RUNTIME_CONFIG);
            }

            if (!this.isPlainObject(config.cache)) {
                config.cache =
                    this.deepClone(DEFAULT_CACHE_CONFIG);
            }

            if (!this.isPlainObject(config.motion)) {
                config.motion =
                    this.deepClone(DEFAULT_MOTION_CONFIG);
            }

            if (!this.isPlainObject(config.prediction)) {
                config.prediction =
                    this.deepClone(DEFAULT_PREDICTION_CONFIG);
            }

            if (!this.isPlainObject(config.corridor)) {
                config.corridor =
                    this.deepClone(DEFAULT_CORRIDOR_CONFIG);
            }

            if (!this.isPlainObject(config.cityImpact)) {
                config.cityImpact =
                    this.deepClone(DEFAULT_CITY_IMPACT_CONFIG);
            }

            if (!this.isPlainObject(config.statistics)) {
                config.statistics =
                    this.deepClone(DEFAULT_STATISTICS_CONFIG);
            }

            if (!this.isPlainObject(config.metrics)) {
                config.metrics =
                    this.deepClone(DEFAULT_METRICS_CONFIG);
            }

            if (!this.isPlainObject(config.events)) {
                config.events =
                    this.deepClone(DEFAULT_EVENT_CONFIG);
            }

            if (!this.isPlainObject(config.compatibility)) {
                config.compatibility =
                    this.deepClone(DEFAULT_COMPATIBILITY_CONFIG);
            }

            config.engine.enabled =
                this.toBoolean(
                    config.engine.enabled,
                    true
                );

            config.engine.autoStart =
                this.toBoolean(
                    config.engine.autoStart,
                    false
                );

            config.engine.debug =
                this.toBoolean(
                    config.engine.debug,
                    false
                );

            config.engine.verbose =
                this.toBoolean(
                    config.engine.verbose,
                    false
                );

            config.engine.locale =
                this.normalizeLocale(
                    config.engine.locale
                );

            config.engine.timezone =
                this.normalizeString(
                    config.engine.timezone,
                    "Asia/Riyadh"
                );

            config.engine.heartbeatInterval =
                this.normalizePositiveInteger(
                    config.engine.heartbeatInterval,
                    DEFAULT_HEARTBEAT_MS
                );

            config.engine.updateInterval =
                this.normalizePositiveInteger(
                    config.engine.updateInterval,
                    DEFAULT_UPDATE_INTERVAL_MS
                );

            config.engine.cleanupInterval =
                this.normalizePositiveInteger(
                    config.engine.cleanupInterval,
                    DEFAULT_CLEANUP_INTERVAL_MS
                );

            config.engine.statisticsInterval =
                this.normalizePositiveInteger(
                    config.engine.statisticsInterval,
                    DEFAULT_STATISTICS_UPDATE_MS
                );

            config.engine.metricsInterval =
                this.normalizePositiveInteger(
                    config.engine.metricsInterval,
                    DEFAULT_METRICS_UPDATE_MS
                );

            config.engine.healthCheckInterval =
                this.normalizePositiveInteger(
                    config.engine.healthCheckInterval,
                    DEFAULT_HEALTH_CHECK_MS
                );

            config.engine.maxHistorySize =
                this.clampInteger(
                    config.engine.maxHistorySize,
                    1,
                    MAXIMUM_SAFE_ARRAY_LENGTH,
                    DEFAULT_TRACK_HISTORY_SIZE
                );

            config.engine.maxCacheEntries =
                this.clampInteger(
                    config.engine.maxCacheEntries,
                    1,
                    MAXIMUM_SAFE_MAP_SIZE,
                    1000
                );

            config.engine.cacheTTL =
                this.normalizePositiveInteger(
                    config.engine.cacheTTL,
                    DEFAULT_CACHE_TTL_MS
                );

            config.motion.minimumTrackPoints =
                this.clampInteger(
                    config.motion.minimumTrackPoints,
                    2,
                    DEFAULT_MAX_TRACK_POINTS,
                    DEFAULT_MIN_TRACK_POINTS
                );

            config.motion.maximumTrackPoints =
                this.clampInteger(
                    config.motion.maximumTrackPoints,
                    config.motion.minimumTrackPoints,
                    MAXIMUM_SAFE_ARRAY_LENGTH,
                    DEFAULT_MAX_TRACK_POINTS
                );

            config.motion.maximumMissingUpdates =
                this.clampInteger(
                    config.motion.maximumMissingUpdates,
                    0,
                    1000,
                    DEFAULT_MAX_MISSING_UPDATES
                );

            config.motion.smoothing =
                this.clampNumber(
                    config.motion.smoothing,
                    0,
                    1,
                    DEFAULT_POSITION_SMOOTHING
                );

            config.motion.directionSmoothing =
                this.clampNumber(
                    config.motion.directionSmoothing,
                    0,
                    1,
                    DEFAULT_DIRECTION_SMOOTHING
                );

            config.motion.speedSmoothing =
                this.clampNumber(
                    config.motion.speedSmoothing,
                    0,
                    1,
                    DEFAULT_SPEED_SMOOTHING
                );

            config.motion.accelerationSmoothing =
                this.clampNumber(
                    config.motion.accelerationSmoothing,
                    0,
                    1,
                    DEFAULT_ACCELERATION_SMOOTHING
                );

            config.prediction.horizons =
                this.normalizePredictionHorizons(
                    config.prediction.horizons
                );

            config.prediction.stepMinutes =
                this.clampInteger(
                    config.prediction.stepMinutes,
                    1,
                    DEFAULT_MAX_PREDICTION_MINUTES,
                    DEFAULT_PREDICTION_STEP_MINUTES
                );

            config.prediction.maximumMinutes =
                this.clampInteger(
                    config.prediction.maximumMinutes,
                    DEFAULT_MIN_PREDICTION_MINUTES,
                    MAXIMUM_ETA_MINUTES,
                    DEFAULT_MAX_PREDICTION_MINUTES
                );

            config.prediction.confidenceDecay =
                this.clampNumber(
                    config.prediction.confidenceDecay,
                    0,
                    100,
                    DEFAULT_CONFIDENCE_DECAY_PER_HOUR
                );

            config.prediction.uncertaintyGrowth =
                this.clampNumber(
                    config.prediction.uncertaintyGrowth,
                    0,
                    DEFAULT_MAX_UNCERTAINTY_KM,
                    DEFAULT_UNCERTAINTY_GROWTH_KM_PER_HOUR
                );

            config.prediction.etaTolerance =
                this.clampInteger(
                    config.prediction.etaTolerance,
                    0,
                    MAXIMUM_ETA_MINUTES,
                    DEFAULT_ETA_TOLERANCE_MINUTES
                );

            config.prediction.arrivalWindow =
                this.clampInteger(
                    config.prediction.arrivalWindow,
                    1,
                    MAXIMUM_ETA_MINUTES,
                    DEFAULT_ARRIVAL_WINDOW_MINUTES
                );

            config.corridor.widthKm =
                this.clampNumber(
                    config.corridor.widthKm,
                    DEFAULT_MIN_CORRIDOR_WIDTH,
                    DEFAULT_MAX_CORRIDOR_WIDTH,
                    DEFAULT_CORRIDOR_WIDTH
                );

            config.corridor.bufferKm =
                this.clampNumber(
                    config.corridor.bufferKm,
                    0,
                    DEFAULT_MAX_CORRIDOR_WIDTH,
                    DEFAULT_CORRIDOR_BUFFER
                );

            config.corridor.pointSpacingKm =
                this.clampNumber(
                    config.corridor.pointSpacingKm,
                    0.1,
                    100,
                    DEFAULT_CORRIDOR_POINT_SPACING_KM
                );

            config.cityImpact.impactRadiusKm =
                this.clampNumber(
                    config.cityImpact.impactRadiusKm,
                    0.1,
                    1000,
                    DEFAULT_CITY_IMPACT_RADIUS_KM
                );

            config.cityImpact.warningRadiusKm =
                this.clampNumber(
                    config.cityImpact.warningRadiusKm,
                    config.cityImpact.impactRadiusKm,
                    2000,
                    DEFAULT_CITY_WARNING_RADIUS_KM
                );

            config.cityImpact.safeRadiusKm =
                this.clampNumber(
                    config.cityImpact.safeRadiusKm,
                    config.cityImpact.warningRadiusKm,
                    5000,
                    DEFAULT_CITY_SAFE_RADIUS_KM
                );

            config.cache.maximumEntries =
                this.clampInteger(
                    config.cache.maximumEntries,
                    1,
                    MAXIMUM_SAFE_MAP_SIZE,
                    1000
                );

            config.cache.ttl =
                this.normalizePositiveInteger(
                    config.cache.ttl,
                    DEFAULT_CACHE_TTL_MS
                );

            config.cache.cleanupInterval =
                this.normalizePositiveInteger(
                    config.cache.cleanupInterval,
                    DEFAULT_CACHE_CLEANUP_MS
                );

            return config;
        }

        /* ==================================================================
         * SECTION 59
         * Prediction Horizon Normalization
         * ================================================================== */

        normalizePredictionHorizons(horizons) {

            const source =
                Array.isArray(horizons)
                    ? horizons
                    : DEFAULT_PREDICTION_HORIZONS;

            const normalized =
                source
                    .map((value) =>
                        this.toFiniteNumber(value, null)
                    )
                    .filter((value) =>
                        value !== null &&
                        value >= DEFAULT_MIN_PREDICTION_MINUTES &&
                        value <= MAXIMUM_ETA_MINUTES
                    )
                    .map((value) =>
                        Math.round(value)
                    );

            const unique =
                Array.from(
                    new Set(normalized)
                ).sort((a, b) => a - b);

            if (unique.length === 0) {
                return [
                    ...DEFAULT_PREDICTION_HORIZONS
                ];
            }

            return unique;
        }

        /* ==================================================================
         * SECTION 60
         * Deep Merge
         * ================================================================== */

        deepMerge(target = {}, source = {}, depth = 0) {

            if (depth > MAXIMUM_SAFE_OBJECT_DEPTH) {
                return target;
            }

            if (!this.isPlainObject(target)) {
                target = {};
            }

            if (!this.isPlainObject(source)) {
                return target;
            }

            for (const key of Object.keys(source)) {

                const sourceValue =
                    source[key];

                const targetValue =
                    target[key];

                if (Array.isArray(sourceValue)) {

                    target[key] =
                        sourceValue.map((item) =>
                            this.deepClone(
                                item,
                                depth + 1
                            )
                        );

                    continue;
                }

                if (this.isPlainObject(sourceValue)) {

                    target[key] =
                        this.deepMerge(
                            this.isPlainObject(targetValue)
                                ? targetValue
                                : {},
                            sourceValue,
                            depth + 1
                        );

                    continue;
                }

                target[key] =
                    sourceValue;
            }

            return target;
        }

        /* ==================================================================
         * SECTION 61
         * Deep Clone
         * ================================================================== */

        deepClone(value, depth = 0) {

            if (depth > MAXIMUM_SAFE_OBJECT_DEPTH) {
                return null;
            }

            if (
                value === null ||
                value === undefined
            ) {
                return value;
            }

            if (
                typeof structuredClone === "function"
            ) {
                try {
                    return structuredClone(value);
                } catch (error) {
                    // Fallback to manual cloning.
                }
            }

            if (value instanceof Date) {
                return new Date(
                    value.getTime()
                );
            }

            if (value instanceof Map) {

                const clonedMap =
                    new Map();

                for (const [key, item] of value.entries()) {
                    clonedMap.set(
                        this.deepClone(key, depth + 1),
                        this.deepClone(item, depth + 1)
                    );
                }

                return clonedMap;
            }

            if (value instanceof Set) {

                const clonedSet =
                    new Set();

                for (const item of value.values()) {
                    clonedSet.add(
                        this.deepClone(item, depth + 1)
                    );
                }

                return clonedSet;
            }

            if (Array.isArray(value)) {

                return value.map((item) =>
                    this.deepClone(
                        item,
                        depth + 1
                    )
                );
            }

            if (this.isPlainObject(value)) {

                const clonedObject = {};

                for (const key of Object.keys(value)) {
                    clonedObject[key] =
                        this.deepClone(
                            value[key],
                            depth + 1
                        );
                }

                return clonedObject;
            }

            return value;
        }

        /* ==================================================================
         * SECTION 62
         * Configuration Snapshot
         * ================================================================== */

        cloneConfiguration() {

            return this.deepClone(
                this.config
            );
        }

        getConfiguration() {

            return this.cloneConfiguration();
        }

        /* ==================================================================
         * SECTION 63
         * Instance ID Generator
         * ================================================================== */

        createInstanceId() {

            const timestamp =
                Date.now()
                    .toString(36);

            const randomPart =
                Math.random()
                    .toString(36)
                    .slice(2, 10);

            return [
                "rg32",
                "rain-arrival",
                timestamp,
                randomPart
            ].join("-");
        }

        createRecordId(prefix = "record") {

            const safePrefix =
                this.normalizeString(
                    prefix,
                    "record"
                )
                    .toLowerCase()
                    .replace(
                        /[^a-z0-9_-]/g,
                        "-"
                    );

            const timestamp =
                Date.now()
                    .toString(36);

            const sequence =
                (
                    this.operationSequence += 1
                ).toString(36);

            const randomPart =
                Math.random()
                    .toString(36)
                    .slice(2, 8);

            return [
                safePrefix,
                timestamp,
                sequence,
                randomPart
            ].join("-");
        }

        /* ==================================================================
         * SECTION 64
         * Time Helpers
         * ================================================================== */

        now() {

            return Date.now();
        }

        nowISO() {

            return new Date().toISOString();
        }

        toISOString(value = Date.now()) {

            const date =
                value instanceof Date
                    ? value
                    : new Date(value);

            if (
                Number.isNaN(
                    date.getTime()
                )
            ) {
                return null;
            }

            return date.toISOString();
        }

        /* ==================================================================
         * SECTION 65
         * Type Validation Helpers
         * ================================================================== */

        isPlainObject(value) {

            if (
                value === null ||
                typeof value !== "object"
            ) {
                return false;
            }

            const prototype =
                Object.getPrototypeOf(value);

            return (
                prototype === Object.prototype ||
                prototype === null
            );
        }

        isFiniteNumber(value) {

            return (
                typeof value === "number" &&
                Number.isFinite(value)
            );
        }

        isNonEmptyString(value) {

            return (
                typeof value === "string" &&
                value.trim().length > 0
            );
        }

        isValidArray(value) {

            return (
                Array.isArray(value) &&
                value.length <= MAXIMUM_SAFE_ARRAY_LENGTH
            );
        }

        /* ==================================================================
         * SECTION 66
         * Value Conversion Helpers
         * ================================================================== */

        toFiniteNumber(value, fallback = 0) {

            if (this.isFiniteNumber(value)) {
                return value;
            }

            if (
                typeof value === "string" &&
                value.trim() !== ""
            ) {

                const parsed =
                    Number(value);

                if (Number.isFinite(parsed)) {
                    return parsed;
                }
            }

            return fallback;
        }

        toBoolean(value, fallback = false) {

            if (typeof value === "boolean") {
                return value;
            }

            if (typeof value === "number") {
                return value !== 0;
            }

            if (typeof value === "string") {

                const normalized =
                    value
                        .trim()
                        .toLowerCase();

                if (
                    normalized === "true" ||
                    normalized === "1" ||
                    normalized === "yes" ||
                    normalized === "on"
                ) {
                    return true;
                }

                if (
                    normalized === "false" ||
                    normalized === "0" ||
                    normalized === "no" ||
                    normalized === "off"
                ) {
                    return false;
                }
            }

            return Boolean(fallback);
        }

        normalizeString(value, fallback = "") {

            if (
                typeof value !== "string"
            ) {
                return fallback;
            }

            const normalized =
                value.trim();

            if (!normalized) {
                return fallback;
            }

            return normalized.slice(
                0,
                MAXIMUM_SAFE_STRING_LENGTH
            );
        }

        normalizePositiveInteger(value, fallback = 1) {

            const number =
                this.toFiniteNumber(
                    value,
                    fallback
                );

            if (number <= 0) {
                return Math.max(
                    1,
                    Math.round(fallback)
                );
            }

            return Math.round(number);
        }

        clampNumber(
            value,
            minimum,
            maximum,
            fallback = minimum
        ) {

            const number =
                this.toFiniteNumber(
                    value,
                    fallback
                );

            return Math.min(
                maximum,
                Math.max(
                    minimum,
                    number
                )
            );
        }

        clampInteger(
            value,
            minimum,
            maximum,
            fallback = minimum
        ) {

            return Math.round(
                this.clampNumber(
                    value,
                    minimum,
                    maximum,
                    fallback
                )
            );
        }

        /* ==================================================================
         * SECTION 67
         * Locale Normalization
         * ================================================================== */

        normalizeLocale(locale) {

            const normalized =
                this.normalizeString(
                    locale,
                    DEFAULT_LANGUAGE
                )
                    .toLowerCase()
                    .split("-")[0];

            if (
                SUPPORTED_LANGUAGES.includes(
                    normalized
                )
            ) {
                return normalized;
            }

            return DEFAULT_LANGUAGE;
        }

        /* ==================================================================
         * SECTION 68
         * Percentage Normalization
         * ================================================================== */

        normalizePercentage(
            value,
            fallback = DEFAULT_CONFIDENCE
        ) {

            return this.clampNumber(
                value,
                0,
                100,
                fallback
            );
        }

        normalizeConfidence(
            value,
            fallback = DEFAULT_CONFIDENCE
        ) {

            return this.normalizePercentage(
                value,
                fallback
            );
        }

        normalizeQuality(
            value,
            fallback = DEFAULT_QUALITY
        ) {

            return this.normalizePercentage(
                value,
                fallback
            );
        }

        normalizeRisk(
            value,
            fallback = DEFAULT_RISK
        ) {

            return this.normalizePercentage(
                value,
                fallback
            );
        }

        /* ==================================================================
         * END OF PART 1.3B
         *
         * لا تغلق class هنا.
         *
         * Next:
         * Part 1.3C
         * Coordinate Validation
         * Geographic Helpers
         * Safe Object Utilities
         * ================================================================== */

            /* ==================================================================
         * SECTION 69
         * Latitude Normalization
         * ================================================================== */

        normalizeLatitude(
            value,
            fallback = null
        ) {

            const latitude =
                this.toFiniteNumber(
                    value,
                    fallback
                );

            if (
                latitude === null ||
                latitude < MIN_LATITUDE ||
                latitude > MAX_LATITUDE
            ) {
                return fallback;
            }

            return Number(
                latitude.toFixed(
                    LAT_LON_PRECISION
                )
            );
        }

        /* ==================================================================
         * SECTION 70
         * Longitude Normalization
         * ================================================================== */

        normalizeLongitude(
            value,
            fallback = null
        ) {

            const longitude =
                this.toFiniteNumber(
                    value,
                    fallback
                );

            if (longitude === null) {
                return fallback;
            }

            let normalized =
                longitude;

            while (
                normalized > MAX_LONGITUDE
            ) {
                normalized -= FULL_CIRCLE;
            }

            while (
                normalized < MIN_LONGITUDE
            ) {
                normalized += FULL_CIRCLE;
            }

            if (
                normalized < MIN_LONGITUDE ||
                normalized > MAX_LONGITUDE
            ) {
                return fallback;
            }

            return Number(
                normalized.toFixed(
                    LAT_LON_PRECISION
                )
            );
        }

        /* ==================================================================
         * SECTION 71
         * Altitude Normalization
         * ================================================================== */

        normalizeAltitude(
            value,
            fallback = 0
        ) {

            return Number(
                this.clampNumber(
                    value,
                    MIN_ALTITUDE_METERS,
                    MAX_ALTITUDE_METERS,
                    fallback
                ).toFixed(2)
            );
        }

        /* ==================================================================
         * SECTION 72
         * Coordinate Validation
         * ================================================================== */

        isValidLatitude(value) {

            return (
                this.isFiniteNumber(value) &&
                value >= MIN_LATITUDE &&
                value <= MAX_LATITUDE
            );
        }

        isValidLongitude(value) {

            return (
                this.isFiniteNumber(value) &&
                value >= MIN_LONGITUDE &&
                value <= MAX_LONGITUDE
            );
        }

        isValidCoordinate(
            latitude,
            longitude
        ) {

            return (
                this.isValidLatitude(latitude) &&
                this.isValidLongitude(longitude)
            );
        }

        isValidCoordinateObject(
            coordinate
        ) {

            if (!this.isPlainObject(coordinate)) {
                return false;
            }

            const latitude =
                coordinate.latitude ??
                coordinate.lat;

            const longitude =
                coordinate.longitude ??
                coordinate.lon ??
                coordinate.lng;

            return this.isValidCoordinate(
                this.toFiniteNumber(
                    latitude,
                    NaN
                ),
                this.toFiniteNumber(
                    longitude,
                    NaN
                )
            );
        }

        /* ==================================================================
         * SECTION 73
         * Coordinate Object Builder
         * ================================================================== */

        normalizeCoordinate(
            coordinate,
            fallback = null
        ) {

            if (!this.isPlainObject(coordinate)) {
                return fallback;
            }

            const latitude =
                this.normalizeLatitude(
                    coordinate.latitude ??
                    coordinate.lat,
                    null
                );

            const longitude =
                this.normalizeLongitude(
                    coordinate.longitude ??
                    coordinate.lon ??
                    coordinate.lng,
                    null
                );

            if (
                latitude === null ||
                longitude === null
            ) {
                return fallback;
            }

            return {

                latitude,

                longitude,

                altitude:
                    this.normalizeAltitude(
                        coordinate.altitude ??
                        coordinate.alt ??
                        0,
                        0
                    )

            };
        }

        createCoordinate(
            latitude,
            longitude,
            altitude = 0
        ) {

            return this.normalizeCoordinate({

                latitude,

                longitude,

                altitude

            });
        }

        cloneCoordinate(
            coordinate
        ) {

            const normalized =
                this.normalizeCoordinate(
                    coordinate
                );

            if (!normalized) {
                return null;
            }

            return {

                latitude:
                    normalized.latitude,

                longitude:
                    normalized.longitude,

                altitude:
                    normalized.altitude

            };
        }

        /* ==================================================================
         * SECTION 74
         * Degree and Radian Conversion
         * ================================================================== */

        degreesToRadians(
            degrees
        ) {

            const value =
                this.toFiniteNumber(
                    degrees,
                    0
                );

            return value * DEG_TO_RAD;
        }

        radiansToDegrees(
            radians
        ) {

            const value =
                this.toFiniteNumber(
                    radians,
                    0
                );

            return value * RAD_TO_DEG;
        }

        normalizeBearing(
            bearing,
            fallback = 0
        ) {

            const value =
                this.toFiniteNumber(
                    bearing,
                    fallback
                );

            return Number(
                (
                    (
                        value % FULL_CIRCLE
                    ) +
                    FULL_CIRCLE
                ) %
                FULL_CIRCLE
            );
        }

        /* ==================================================================
         * SECTION 75
         * Haversine Distance
         * ================================================================== */

        calculateDistanceKm(
            firstCoordinate,
            secondCoordinate
        ) {

            const first =
                this.normalizeCoordinate(
                    firstCoordinate
                );

            const second =
                this.normalizeCoordinate(
                    secondCoordinate
                );

            if (
                !first ||
                !second
            ) {
                return null;
            }

            const latitude1 =
                this.degreesToRadians(
                    first.latitude
                );

            const latitude2 =
                this.degreesToRadians(
                    second.latitude
                );

            const latitudeDifference =
                this.degreesToRadians(
                    second.latitude -
                    first.latitude
                );

            const longitudeDifference =
                this.degreesToRadians(
                    second.longitude -
                    first.longitude
                );

            const haversineValue =
                Math.sin(
                    latitudeDifference / 2
                ) ** 2 +
                Math.cos(latitude1) *
                Math.cos(latitude2) *
                Math.sin(
                    longitudeDifference / 2
                ) ** 2;

            const angularDistance =
                2 *
                Math.atan2(
                    Math.sqrt(haversineValue),
                    Math.sqrt(
                        1 - haversineValue
                    )
                );

            const distance =
                EARTH_RADIUS_KM *
                angularDistance;

            return Number(
                distance.toFixed(
                    DISTANCE_PRECISION
                )
            );
        }

        calculateDistanceMeters(
            firstCoordinate,
            secondCoordinate
        ) {

            const distanceKm =
                this.calculateDistanceKm(
                    firstCoordinate,
                    secondCoordinate
                );

            if (distanceKm === null) {
                return null;
            }

            return Number(
                (
                    distanceKm *
                    METERS_PER_KILOMETER
                ).toFixed(2)
            );
        }

        /* ==================================================================
         * SECTION 76
         * Initial Bearing
         * ================================================================== */

        calculateBearing(
            firstCoordinate,
            secondCoordinate
        ) {

            const first =
                this.normalizeCoordinate(
                    firstCoordinate
                );

            const second =
                this.normalizeCoordinate(
                    secondCoordinate
                );

            if (
                !first ||
                !second
            ) {
                return null;
            }

            const latitude1 =
                this.degreesToRadians(
                    first.latitude
                );

            const latitude2 =
                this.degreesToRadians(
                    second.latitude
                );

            const longitudeDifference =
                this.degreesToRadians(
                    second.longitude -
                    first.longitude
                );

            const y =
                Math.sin(
                    longitudeDifference
                ) *
                Math.cos(
                    latitude2
                );

            const x =
                Math.cos(latitude1) *
                Math.sin(latitude2) -
                Math.sin(latitude1) *
                Math.cos(latitude2) *
                Math.cos(
                    longitudeDifference
                );

            const bearing =
                this.radiansToDegrees(
                    Math.atan2(
                        y,
                        x
                    )
                );

            return Number(
                this.normalizeBearing(
                    bearing
                ).toFixed(
                    DIRECTION_PRECISION
                )
            );
        }

        /* ==================================================================
         * SECTION 77
         * Destination Coordinate
         * ================================================================== */

        projectCoordinate(
            coordinate,
            distanceKm,
            bearingDegrees
        ) {

            const origin =
                this.normalizeCoordinate(
                    coordinate
                );

            if (!origin) {
                return null;
            }

            const distance =
                this.clampNumber(
                    distanceKm,
                    0,
                    EARTH_CIRCUMFERENCE_KM,
                    0
                );

            const bearing =
                this.degreesToRadians(
                    this.normalizeBearing(
                        bearingDegrees
                    )
                );

            const angularDistance =
                distance /
                EARTH_RADIUS_KM;

            const latitude1 =
                this.degreesToRadians(
                    origin.latitude
                );

            const longitude1 =
                this.degreesToRadians(
                    origin.longitude
                );

            const latitude2 =
                Math.asin(
                    Math.sin(latitude1) *
                    Math.cos(angularDistance) +
                    Math.cos(latitude1) *
                    Math.sin(angularDistance) *
                    Math.cos(bearing)
                );

            const longitude2 =
                longitude1 +
                Math.atan2(
                    Math.sin(bearing) *
                    Math.sin(angularDistance) *
                    Math.cos(latitude1),
                    Math.cos(angularDistance) -
                    Math.sin(latitude1) *
                    Math.sin(latitude2)
                );

            return this.createCoordinate(
                this.radiansToDegrees(
                    latitude2
                ),
                this.radiansToDegrees(
                    longitude2
                ),
                origin.altitude
            );
        }

        /* ==================================================================
         * SECTION 78
         * Midpoint Calculation
         * ================================================================== */

        calculateMidpoint(
            firstCoordinate,
            secondCoordinate
        ) {

            const first =
                this.normalizeCoordinate(
                    firstCoordinate
                );

            const second =
                this.normalizeCoordinate(
                    secondCoordinate
                );

            if (
                !first ||
                !second
            ) {
                return null;
            }

            const latitude1 =
                this.degreesToRadians(
                    first.latitude
                );

            const latitude2 =
                this.degreesToRadians(
                    second.latitude
                );

            const longitude1 =
                this.degreesToRadians(
                    first.longitude
                );

            const longitudeDifference =
                this.degreesToRadians(
                    second.longitude -
                    first.longitude
                );

            const bx =
                Math.cos(latitude2) *
                Math.cos(
                    longitudeDifference
                );

            const by =
                Math.cos(latitude2) *
                Math.sin(
                    longitudeDifference
                );

            const latitude3 =
                Math.atan2(
                    Math.sin(latitude1) +
                    Math.sin(latitude2),
                    Math.sqrt(
                        (
                            Math.cos(latitude1) +
                            bx
                        ) ** 2 +
                        by ** 2
                    )
                );

            const longitude3 =
                longitude1 +
                Math.atan2(
                    by,
                    Math.cos(latitude1) +
                    bx
                );

            return this.createCoordinate(
                this.radiansToDegrees(
                    latitude3
                ),
                this.radiansToDegrees(
                    longitude3
                ),
                (
                    first.altitude +
                    second.altitude
                ) / 2
            );
        }

        /* ==================================================================
         * SECTION 79
         * Bounding Box Helpers
         * ================================================================== */

        createBoundingBox(
            coordinates = []
        ) {

            if (
                !Array.isArray(coordinates) ||
                coordinates.length === 0
            ) {
                return null;
            }

            const normalizedCoordinates =
                coordinates
                    .map((coordinate) =>
                        this.normalizeCoordinate(
                            coordinate
                        )
                    )
                    .filter(Boolean);

            if (
                normalizedCoordinates.length === 0
            ) {
                return null;
            }

            const latitudes =
                normalizedCoordinates.map(
                    (coordinate) =>
                        coordinate.latitude
                );

            const longitudes =
                normalizedCoordinates.map(
                    (coordinate) =>
                        coordinate.longitude
                );

            return {

                north:
                    Math.max(
                        ...latitudes
                    ),

                south:
                    Math.min(
                        ...latitudes
                    ),

                east:
                    Math.max(
                        ...longitudes
                    ),

                west:
                    Math.min(
                        ...longitudes
                    )

            };
        }

        isCoordinateInsideBoundingBox(
            coordinate,
            boundingBox
        ) {

            const point =
                this.normalizeCoordinate(
                    coordinate
                );

            if (
                !point ||
                !this.isPlainObject(
                    boundingBox
                )
            ) {
                return false;
            }

            const north =
                this.normalizeLatitude(
                    boundingBox.north,
                    null
                );

            const south =
                this.normalizeLatitude(
                    boundingBox.south,
                    null
                );

            const east =
                this.normalizeLongitude(
                    boundingBox.east,
                    null
                );

            const west =
                this.normalizeLongitude(
                    boundingBox.west,
                    null
                );

            if (
                north === null ||
                south === null ||
                east === null ||
                west === null
            ) {
                return false;
            }

            const latitudeInside =
                point.latitude <= north &&
                point.latitude >= south;

            let longitudeInside;

            if (west <= east) {

                longitudeInside =
                    point.longitude >= west &&
                    point.longitude <= east;

            } else {

                longitudeInside =
                    point.longitude >= west ||
                    point.longitude <= east;
            }

            return (
                latitudeInside &&
                longitudeInside
            );
        }

        isInsideSaudiBoundingBox(
            coordinate
        ) {

            return this.isCoordinateInsideBoundingBox(
                coordinate,
                SAUDI_BOUNDING_BOX
            );
        }

        /* ==================================================================
         * SECTION 80
         * Distance Comparison Helpers
         * ================================================================== */

        isWithinDistance(
            firstCoordinate,
            secondCoordinate,
            maximumDistanceKm
        ) {

            const distance =
                this.calculateDistanceKm(
                    firstCoordinate,
                    secondCoordinate
                );

            if (distance === null) {
                return false;
            }

            const maximumDistance =
                this.clampNumber(
                    maximumDistanceKm,
                    0,
                    EARTH_CIRCUMFERENCE_KM,
                    0
                );

            return (
                distance <=
                maximumDistance
            );
        }

        findNearestCoordinate(
            originCoordinate,
            candidates = []
        ) {

            const origin =
                this.normalizeCoordinate(
                    originCoordinate
                );

            if (
                !origin ||
                !Array.isArray(candidates)
            ) {
                return null;
            }

            let nearest =
                null;

            for (
                let index = 0;
                index < candidates.length;
                index += 1
            ) {

                const candidate =
                    candidates[index];

                const coordinate =
                    this.normalizeCoordinate(
                        candidate
                    );

                if (!coordinate) {
                    continue;
                }

                const distanceKm =
                    this.calculateDistanceKm(
                        origin,
                        coordinate
                    );

                if (distanceKm === null) {
                    continue;
                }

                if (
                    !nearest ||
                    distanceKm <
                    nearest.distanceKm
                ) {

                    nearest = {

                        index,

                        coordinate,

                        distanceKm,

                        source:
                            candidate

                    };
                }
            }

            return nearest;
        }

        /* ==================================================================
         * SECTION 81
         * Safe Object Access
         * ================================================================== */

        getNestedValue(
            object,
            path,
            fallback = undefined
        ) {

            if (
                object === null ||
                object === undefined
            ) {
                return fallback;
            }

            const keys =
                Array.isArray(path)
                    ? path
                    : String(path)
                        .split(".")
                        .filter(Boolean);

            let current =
                object;

            for (const key of keys) {

                if (
                    current === null ||
                    current === undefined ||
                    !Object.prototype.hasOwnProperty.call(
                        Object(current),
                        key
                    )
                ) {
                    return fallback;
                }

                current =
                    current[key];
            }

            return (
                current === undefined
                    ? fallback
                    : current
            );
        }

        setNestedValue(
            object,
            path,
            value
        ) {

            if (
                !this.isPlainObject(object)
            ) {
                return false;
            }

            const keys =
                Array.isArray(path)
                    ? path
                    : String(path)
                        .split(".")
                        .filter(Boolean);

            if (
                keys.length === 0 ||
                keys.length >
                MAXIMUM_SAFE_OBJECT_DEPTH
            ) {
                return false;
            }

            let current =
                object;

            for (
                let index = 0;
                index <
                keys.length - 1;
                index += 1
            ) {

                const key =
                    keys[index];

                if (
                    !this.isPlainObject(
                        current[key]
                    )
                ) {
                    current[key] = {};
                }

                current =
                    current[key];
            }

            current[
                keys[
                    keys.length - 1
                ]
            ] = value;

            return true;
        }

        hasOwn(
            object,
            property
        ) {

            return (
                object !== null &&
                object !== undefined &&
                Object.prototype.hasOwnProperty.call(
                    Object(object),
                    property
                )
            );
        }

        /* ==================================================================
         * END OF PART 1.3C
         *
         * لا تغلق class هنا.
         *
         * Next:
         * Part 1.3D
         * Direction Classification
         * Speed Conversion
         * Motion Utility Methods
         * ================================================================== */
    
