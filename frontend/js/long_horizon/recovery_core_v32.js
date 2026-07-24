/* ==========================================================================
   RainGuard AI
   Rain Arrival Recovery Core V32

   File:
   frontend/js/long_horizon/recovery_core_v32.js

   Responsibilities:
   - Collect weather data from all available sources.
   - Normalize source data.
   - Merge forecasts and observations.
   - Track rain cells.
   - Calculate rain-cell speed and direction.
   - Calculate rain arrival ETA.
   - Produce 6 / 12 / 24 / 48 / 72-hour forecasts.
   - Continuously update all Saudi regions, cities, and governorates.

   Version: 32.0.0
   ========================================================================== */

(function initializeRainArrivalRecoveryCoreV32(global) {
    "use strict";

    /* ======================================================================
       SECTION 1
       GENERAL CONSTANTS
       ====================================================================== */

    const RECOVERY_CORE_VERSION = "32.0.0";

    const DEFAULT_UPDATE_INTERVAL_MS = 5 * 60 * 1000;

    const DEFAULT_SOURCE_TIMEOUT_MS = 20 * 1000;

    const DEFAULT_MAX_CELL_AGE_MS = 3 * 60 * 60 * 1000;

    const DEFAULT_MIN_CONFIDENCE = 0.25;

    const DEFAULT_HIGH_CONFIDENCE = 0.75;

    const DEFAULT_MIN_RAIN_INTENSITY = 0.1;

    const DEFAULT_CELL_MATCH_DISTANCE_KM = 120;

    const DEFAULT_MAX_ETA_HOURS = 72;

    const DEFAULT_MIN_CELL_SPEED_KMH = 1;

    const DEFAULT_MAX_CELL_SPEED_KMH = 180;

    const FORECAST_HORIZONS_HOURS = Object.freeze([
        6,
        12,
        24,
        48,
        72
    ]);

    const SOURCE_NAMES = Object.freeze({
        OPEN_METEO: "openmeteo",
        ANWAA: "anwaa",
        RAIN_VIEWER: "rainviewer",
        LIGHTNING: "lightning",
        LOCAL_AI: "local_ai",
        SATELLITE: "satellite",
        RADAR: "radar",
        OBSERVATION: "observation",
        UNKNOWN: "unknown"
    });

    const SOURCE_TYPES = Object.freeze({
        FORECAST: "forecast",
        RADAR: "radar",
        SATELLITE: "satellite",
        LIGHTNING: "lightning",
        OBSERVATION: "observation",
        AI: "ai",
        UNKNOWN: "unknown"
    });

    const RAIN_STATUS = Object.freeze({
        RAINING_NOW: "raining_now",
        ARRIVING: "arriving",
        POSSIBLE: "possible",
        CLOUDY: "cloudy",
        NO_RAIN: "no_rain",
        UNKNOWN: "unknown"
    });

    const CELL_STATUS = Object.freeze({
        ACTIVE: "active",
        WEAKENING: "weakening",
        STRENGTHENING: "strengthening",
        DISSIPATED: "dissipated",
        LOST: "lost",
        UNKNOWN: "unknown"
    });

    const MOVEMENT_STATUS = Object.freeze({
        MOVING: "moving",
        STATIONARY: "stationary",
        ACCELERATING: "accelerating",
        DECELERATING: "decelerating",
        CHANGING_DIRECTION: "changing_direction",
        UNKNOWN: "unknown"
    });

    const CORE_EVENTS = Object.freeze({
        STARTED: "rainarrival:core:started",
        STOPPED: "rainarrival:core:stopped",
        UPDATE_STARTED: "rainarrival:core:update-started",
        UPDATE_COMPLETED: "rainarrival:core:update-completed",
        UPDATE_FAILED: "rainarrival:core:update-failed",

        SOURCE_UPDATED: "rainarrival:source:updated",
        SOURCE_FAILED: "rainarrival:source:failed",

        CELLS_UPDATED: "rainarrival:cells:updated",
        CELL_CREATED: "rainarrival:cell:created",
        CELL_UPDATED: "rainarrival:cell:updated",
        CELL_DISSIPATED: "rainarrival:cell:dissipated",

        ETA_UPDATED: "rainarrival:eta:updated",
        FORECAST_UPDATED: "rainarrival:forecast:updated",

        CONFIDENCE_CHANGED: "rainarrival:confidence:changed",
        STATE_CHANGED: "rainarrival:state:changed"
    });

    /* ======================================================================
       SECTION 2
       DEFAULT SOURCE WEIGHTS
       ====================================================================== */

    const DEFAULT_SOURCE_WEIGHTS = Object.freeze({
        [SOURCE_NAMES.OPEN_METEO]: 0.72,
        [SOURCE_NAMES.ANWAA]: 0.82,
        [SOURCE_NAMES.RAIN_VIEWER]: 0.92,
        [SOURCE_NAMES.LIGHTNING]: 0.74,
        [SOURCE_NAMES.LOCAL_AI]: 0.80,
        [SOURCE_NAMES.SATELLITE]: 0.78,
        [SOURCE_NAMES.RADAR]: 0.94,
        [SOURCE_NAMES.OBSERVATION]: 1.00,
        [SOURCE_NAMES.UNKNOWN]: 0.40
    });

    /* ======================================================================
       SECTION 3
       BASIC UTILITY FUNCTIONS
       ====================================================================== */

    function isFiniteNumber(value) {
        return (
            typeof value === "number" &&
            Number.isFinite(value)
        );
    }

    function toFiniteNumber(value, fallback = 0) {
        const numericValue = Number(value);

        return Number.isFinite(numericValue)
            ? numericValue
            : fallback;
    }

    function clamp(value, min, max) {
        return Math.min(
            Math.max(value, min),
            max
        );
    }

    function normalizePercentage(value) {
        const numericValue = toFiniteNumber(value, 0);

        if (numericValue > 1) {
            return clamp(
                numericValue / 100,
                0,
                1
            );
        }

        return clamp(
            numericValue,
            0,
            1
        );
    }

    function normalizeLongitude(value) {
        let longitude = toFiniteNumber(value, 0);

        while (longitude > 180) {
            longitude -= 360;
        }

        while (longitude < -180) {
            longitude += 360;
        }

        return longitude;
    }

    function normalizeBearing(value) {
        const bearing = toFiniteNumber(value, 0);

        return (
            (bearing % 360) + 360
        ) % 360;
    }

    function normalizeTimestamp(value) {
        if (value instanceof Date) {
            return value.getTime();
        }

        if (typeof value === "number" && Number.isFinite(value)) {
            if (value < 100000000000) {
                return value * 1000;
            }

            return value;
        }

        if (typeof value === "string") {
            const parsedTimestamp = Date.parse(value);

            if (Number.isFinite(parsedTimestamp)) {
                return parsedTimestamp;
            }
        }

        return Date.now();
    }

    function createId(prefix = "item") {
        const randomPart = Math.random()
            .toString(36)
            .slice(2, 10);

        return [
            prefix,
            Date.now(),
            randomPart
        ].join("_");
    }

    function safeArray(value) {
        return Array.isArray(value)
            ? value
            : [];
    }

    function safeObject(value) {
        return (
            value &&
            typeof value === "object" &&
            !Array.isArray(value)
        )
            ? value
            : {};
    }

    function deepClone(value) {
        if (typeof structuredClone === "function") {
            try {
                return structuredClone(value);
            } catch (error) {
                // Continue to JSON fallback.
            }
        }

        try {
            return JSON.parse(
                JSON.stringify(value)
            );
        } catch (error) {
            return value;
        }
    }

    function average(values) {
        const validValues = safeArray(values)
            .filter(isFiniteNumber);

        if (!validValues.length) {
            return 0;
        }

        const total = validValues.reduce(
            (sum, value) => sum + value,
            0
        );

        return total / validValues.length;
    }

    function weightedAverage(items, valueKey, weightKey) {
        const validItems = safeArray(items)
            .filter((item) => {
                return (
                    item &&
                    isFiniteNumber(item[valueKey]) &&
                    isFiniteNumber(item[weightKey]) &&
                    item[weightKey] > 0
                );
            });

        if (!validItems.length) {
            return 0;
        }

        let weightedTotal = 0;
        let weightTotal = 0;

        validItems.forEach((item) => {
            weightedTotal += (
                item[valueKey] *
                item[weightKey]
            );

            weightTotal += item[weightKey];
        });

        if (weightTotal <= 0) {
            return 0;
        }

        return weightedTotal / weightTotal;
    }

    function calculateStandardDeviation(values) {
        const validValues = safeArray(values)
            .filter(isFiniteNumber);

        if (validValues.length < 2) {
            return 0;
        }

        const mean = average(validValues);

        const variance = average(
            validValues.map((value) => {
                return Math.pow(
                    value - mean,
                    2
                );
            })
        );

        return Math.sqrt(variance);
    }

    function sleep(milliseconds) {
        return new Promise((resolve) => {
            setTimeout(
                resolve,
                Math.max(0, milliseconds)
            );
        });
    }

    function withTimeout(promise, timeoutMs, timeoutMessage) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(
                    new Error(
                        timeoutMessage ||
                        "Operation timed out."
                    )
                );
            }, timeoutMs);

            Promise.resolve(promise)
                .then((result) => {
                    clearTimeout(timer);
                    resolve(result);
                })
                .catch((error) => {
                    clearTimeout(timer);
                    reject(error);
                });
        });
    }

    /* ======================================================================
       SECTION 4
       GEOGRAPHIC FUNCTIONS
       ====================================================================== */

    function degreesToRadians(degrees) {
        return (
            toFiniteNumber(degrees, 0) *
            Math.PI
        ) / 180;
    }

    function radiansToDegrees(radians) {
        return (
            toFiniteNumber(radians, 0) *
            180
        ) / Math.PI;
    }

    function calculateDistanceKm(
        latitude1,
        longitude1,
        latitude2,
        longitude2
    ) {
        const earthRadiusKm = 6371;

        const lat1 = degreesToRadians(latitude1);
        const lat2 = degreesToRadians(latitude2);

        const deltaLatitude = degreesToRadians(
            latitude2 - latitude1
        );

        const deltaLongitude = degreesToRadians(
            longitude2 - longitude1
        );

        const haversineValue =
            Math.sin(deltaLatitude / 2) *
            Math.sin(deltaLatitude / 2) +
            Math.cos(lat1) *
            Math.cos(lat2) *
            Math.sin(deltaLongitude / 2) *
            Math.sin(deltaLongitude / 2);

        const angularDistance =
            2 *
            Math.atan2(
                Math.sqrt(haversineValue),
                Math.sqrt(1 - haversineValue)
            );

        return earthRadiusKm * angularDistance;
    }

    function calculateBearingDegrees(
        latitude1,
        longitude1,
        latitude2,
        longitude2
    ) {
        const lat1 = degreesToRadians(latitude1);
        const lat2 = degreesToRadians(latitude2);

        const deltaLongitude = degreesToRadians(
            longitude2 - longitude1
        );

        const y =
            Math.sin(deltaLongitude) *
            Math.cos(lat2);

        const x =
            Math.cos(lat1) *
            Math.sin(lat2) -
            Math.sin(lat1) *
            Math.cos(lat2) *
            Math.cos(deltaLongitude);

        return normalizeBearing(
            radiansToDegrees(
                Math.atan2(y, x)
            )
        );
    }

    function calculateDestinationPoint(
        latitude,
        longitude,
        bearingDegrees,
        distanceKm
    ) {
        const earthRadiusKm = 6371;

        const angularDistance =
            toFiniteNumber(distanceKm, 0) /
            earthRadiusKm;

        const bearing =
            degreesToRadians(
                normalizeBearing(bearingDegrees)
            );

        const startLatitude =
            degreesToRadians(latitude);

        const startLongitude =
            degreesToRadians(longitude);

        const destinationLatitude =
            Math.asin(
                Math.sin(startLatitude) *
                Math.cos(angularDistance) +
                Math.cos(startLatitude) *
                Math.sin(angularDistance) *
                Math.cos(bearing)
            );

        const destinationLongitude =
            startLongitude +
            Math.atan2(
                Math.sin(bearing) *
                Math.sin(angularDistance) *
                Math.cos(startLatitude),
                Math.cos(angularDistance) -
                Math.sin(startLatitude) *
                Math.sin(destinationLatitude)
            );

        return {
            latitude: radiansToDegrees(
                destinationLatitude
            ),

            longitude: normalizeLongitude(
                radiansToDegrees(
                    destinationLongitude
                )
            )
        };
    }

    function calculateAngularDifference(
        angle1,
        angle2
    ) {
        const firstAngle = normalizeBearing(angle1);
        const secondAngle = normalizeBearing(angle2);

        let difference = Math.abs(
            firstAngle - secondAngle
        );

        if (difference > 180) {
            difference = 360 - difference;
        }

        return difference;
    }

    function calculateDirectionalAlignment(
        movementBearing,
        targetBearing
    ) {
        const difference =
            calculateAngularDifference(
                movementBearing,
                targetBearing
            );

        return clamp(
            1 - difference / 180,
            0,
            1
        );
    }

    /* ======================================================================
       SECTION 5
       EVENT DISPATCHER
       ====================================================================== */

    class RecoveryCoreEventBus {
        constructor() {
            this.listeners = new Map();
        }

        on(eventName, callback) {
            if (
                typeof eventName !== "string" ||
                typeof callback !== "function"
            ) {
                return () => {};
            }

            if (!this.listeners.has(eventName)) {
                this.listeners.set(
                    eventName,
                    new Set()
                );
            }

            const eventListeners =
                this.listeners.get(eventName);

            eventListeners.add(callback);

            return () => {
                this.off(
                    eventName,
                    callback
                );
            };
        }

        once(eventName, callback) {
            if (typeof callback !== "function") {
                return () => {};
            }

            const unsubscribe = this.on(
                eventName,
                (payload) => {
                    unsubscribe();
                    callback(payload);
                }
            );

            return unsubscribe;
        }

        off(eventName, callback) {
            const eventListeners =
                this.listeners.get(eventName);

            if (!eventListeners) {
                return false;
            }

            const deleted =
                eventListeners.delete(callback);

            if (!eventListeners.size) {
                this.listeners.delete(eventName);
            }

            return deleted;
        }

        emit(eventName, payload = {}) {
            const eventListeners =
                this.listeners.get(eventName);

            if (!eventListeners) {
                return;
            }

            eventListeners.forEach((callback) => {
                try {
                    callback(payload);
                } catch (error) {
                    console.error(
                        "[Rain Arrival Recovery Core V32] Event listener error:",
                        eventName,
                        error
                    );
                }
            });
        }

        clear(eventName) {
            if (typeof eventName === "string") {
                this.listeners.delete(eventName);
                return;
            }

            this.listeners.clear();
        }
    }

    /* ======================================================================
       SECTION 6
       INTERNAL STATE FACTORY
       ====================================================================== */

    function createInitialCoreState() {
        return {
            version: RECOVERY_CORE_VERSION,

            running: false,

            updateInProgress: false,

            startedAt: null,

            stoppedAt: null,

            lastUpdateStartedAt: null,

            lastUpdateCompletedAt: null,

            lastSuccessfulUpdateAt: null,

            lastFailedUpdateAt: null,

            updateCount: 0,

            successfulUpdateCount: 0,

            failedUpdateCount: 0,

            consecutiveFailureCount: 0,

            cycleId: null,

            cycleSequence: 0,

            sources: {},

            sourceResults: [],

            sourceErrors: [],

            observations: [],

            forecasts: [],

            rainCells: [],

            cityForecasts: [],

            regionForecasts: [],

            arrivalPredictions: [],

            horizonForecasts: {
                6: [],
                12: [],
                24: [],
                48: [],
                72: []
            },

            nationalSummary: {
                generatedAt: null,

                rainingNowCount: 0,

                arrivingCount: 0,

                possibleRainCount: 0,

                noRainCount: 0,

                unknownCount: 0,

                activeCellCount: 0,

                averageConfidence: 0,

                highestRiskLocation: null,

                earliestArrivalLocation: null
            },

            diagnostics: {
                lastDurationMs: 0,

                averageDurationMs: 0,

                sourceSuccessCount: 0,

                sourceFailureCount: 0,

                trackedCellCount: 0,

                generatedPredictionCount: 0,

                warnings: [],

                errors: []
            }
        };
    }

    /* ======================================================================
       SECTION 7
       RECOVERY CORE CLASS - CONSTRUCTOR
       ====================================================================== */

    class RainArrivalRecoveryCoreV32 {
        constructor(options = {}) {
            const safeOptions =
                safeObject(options);

            this.version =
                RECOVERY_CORE_VERSION;

            this.options = {
                updateIntervalMs: Math.max(
                    30 * 1000,
                    toFiniteNumber(
                        safeOptions.updateIntervalMs,
                        DEFAULT_UPDATE_INTERVAL_MS
                    )
                ),

                sourceTimeoutMs: Math.max(
                    1000,
                    toFiniteNumber(
                        safeOptions.sourceTimeoutMs,
                        DEFAULT_SOURCE_TIMEOUT_MS
                    )
                ),

                maxCellAgeMs: Math.max(
                    60 * 1000,
                    toFiniteNumber(
                        safeOptions.maxCellAgeMs,
                        DEFAULT_MAX_CELL_AGE_MS
                    )
                ),

                minConfidence: normalizePercentage(
                    safeOptions.minConfidence ??
                    DEFAULT_MIN_CONFIDENCE
                ),

                highConfidence: normalizePercentage(
                    safeOptions.highConfidence ??
                    DEFAULT_HIGH_CONFIDENCE
                ),

                minRainIntensity: Math.max(
                    0,
                    toFiniteNumber(
                        safeOptions.minRainIntensity,
                        DEFAULT_MIN_RAIN_INTENSITY
                    )
                ),

                cellMatchDistanceKm: Math.max(
                    1,
                    toFiniteNumber(
                        safeOptions.cellMatchDistanceKm,
                        DEFAULT_CELL_MATCH_DISTANCE_KM
                    )
                ),

                maxEtaHours: clamp(
                    toFiniteNumber(
                        safeOptions.maxEtaHours,
                        DEFAULT_MAX_ETA_HOURS
                    ),
                    1,
                    168
                ),

                minCellSpeedKmh: Math.max(
                    0,
                    toFiniteNumber(
                        safeOptions.minCellSpeedKmh,
                        DEFAULT_MIN_CELL_SPEED_KMH
                    )
                ),

                maxCellSpeedKmh: Math.max(
                    1,
                    toFiniteNumber(
                        safeOptions.maxCellSpeedKmh,
                        DEFAULT_MAX_CELL_SPEED_KMH
                    )
                ),

                debug:
                    safeOptions.debug === true,

                autoStart:
                    safeOptions.autoStart === true
            };

            this.sourceWeights = {
                ...DEFAULT_SOURCE_WEIGHTS,
                ...safeObject(
                    safeOptions.sourceWeights
                )
            };

            this.sourceAdapters = new Map();

            this.locations = new Map();

            this.cells = new Map();

            this.eventBus =
                new RecoveryCoreEventBus();

            this.state =
                createInitialCoreState();

            this.updateTimer = null;

            this.abortController = null;

            this.lastUpdatePromise = null;

            this.destroyed = false;

            if (this.options.autoStart) {
                Promise.resolve()
                    .then(() => this.start())
                    .catch((error) => {
                        this.logError(
                            "Automatic start failed.",
                            error
                        );
                    });
            }
        }

        /* ==================================================================
           SECTION 8
           BASIC LOGGING
           ================================================================== */

        log(...messages) {
            if (!this.options.debug) {
                return;
            }

            console.log(
                "[Rain Arrival Recovery Core V32]",
                ...messages
            );
        }

        logWarning(...messages) {
            if (!this.options.debug) {
                return;
            }

            console.warn(
                "[Rain Arrival Recovery Core V32]",
                ...messages
            );
        }

        logError(...messages) {
            console.error(
                "[Rain Arrival Recovery Core V32]",
                ...messages
            );
        }

        /* ==================================================================
           SECTION 9
           BASIC EVENT METHODS
           ================================================================== */

        on(eventName, callback) {
            return this.eventBus.on(
                eventName,
                callback
            );
        }

        once(eventName, callback) {
            return this.eventBus.once(
                eventName,
                callback
            );
        }

        off(eventName, callback) {
            return this.eventBus.off(
                eventName,
                callback
            );
        }

        emit(eventName, payload = {}) {
            this.eventBus.emit(
                eventName,
                {
                    timestamp: Date.now(),

                    version: this.version,

                    cycleId:
                        this.state.cycleId,

                    ...safeObject(payload)
                }
            );
        }

        /* ==================================================================
           SECTION 10
           BASIC STATE METHODS
           ================================================================== */

        getState() {
            return deepClone(
                this.state
            );
        }

        getStatus() {
            return {
                version: this.version,

                running:
                    this.state.running,

                updateInProgress:
                    this.state.updateInProgress,

                destroyed:
                    this.destroyed,

                cycleId:
                    this.state.cycleId,

                updateCount:
                    this.state.updateCount,

                successfulUpdateCount:
                    this.state.successfulUpdateCount,

                failedUpdateCount:
                    this.state.failedUpdateCount,

                lastSuccessfulUpdateAt:
                    this.state.lastSuccessfulUpdateAt,

                activeSourceCount:
                    this.sourceAdapters.size,

                registeredLocationCount:
                    this.locations.size,

                trackedCellCount:
                    this.cells.size
            };
        }

        resetState() {
            const wasRunning =
                this.state.running;

            const startedAt =
                this.state.startedAt;

            this.state =
                createInitialCoreState();

            this.state.running =
                wasRunning;

            this.state.startedAt =
                startedAt;

            this.cells.clear();

            return this.getState();
        }

        /* ==================================================================
           SECTION 11
           CONFIGURATION METHODS
           ================================================================== */

        setDebug(enabled) {
            this.options.debug =
                enabled === true;

            return this.options.debug;
        }

        setUpdateInterval(milliseconds) {
            const normalizedInterval =
                Math.max(
                    30 * 1000,
                    toFiniteNumber(
                        milliseconds,
                        DEFAULT_UPDATE_INTERVAL_MS
                    )
                );

            this.options.updateIntervalMs =
                normalizedInterval;

            if (this.state.running) {
                this.scheduleNextUpdate();
            }

            return normalizedInterval;
        }

        setSourceWeight(
            sourceName,
            weight
        ) {
            if (
                typeof sourceName !== "string" ||
                !sourceName.trim()
            ) {
                return false;
            }

            this.sourceWeights[sourceName] =
                clamp(
                    toFiniteNumber(weight, 0.5),
                    0,
                    1
                );

            return true;
        }

        getSourceWeight(sourceName) {
            return clamp(
                toFiniteNumber(
                    this.sourceWeights[sourceName],
                    this.sourceWeights[
                        SOURCE_NAMES.UNKNOWN
                    ]
                ),
                0,
                1
            );
        }

        getAllSourceWeights() {
            return {
                ...this.sourceWeights
            };
        }
    }

    /* ======================================================================
       SECTION 12
       STATIC REFERENCES
       ====================================================================== */

    RainArrivalRecoveryCoreV32.VERSION =
        RECOVERY_CORE_VERSION;

    RainArrivalRecoveryCoreV32.SOURCE_NAMES =
        SOURCE_NAMES;

    RainArrivalRecoveryCoreV32.SOURCE_TYPES =
        SOURCE_TYPES;

    RainArrivalRecoveryCoreV32.RAIN_STATUS =
        RAIN_STATUS;

    RainArrivalRecoveryCoreV32.CELL_STATUS =
        CELL_STATUS;

    RainArrivalRecoveryCoreV32.MOVEMENT_STATUS =
        MOVEMENT_STATUS;

    RainArrivalRecoveryCoreV32.CORE_EVENTS =
        CORE_EVENTS;

    RainArrivalRecoveryCoreV32.FORECAST_HORIZONS_HOURS =
        FORECAST_HORIZONS_HOURS;

    RainArrivalRecoveryCoreV32.DEFAULT_SOURCE_WEIGHTS =
        DEFAULT_SOURCE_WEIGHTS;

    /* ======================================================================
       SECTION 13
       TEMPORARY GLOBAL EXPORT

       The class will be completed in the following parts.
       Do not instantiate it yet until the remaining sections are added.
       ====================================================================== */

    global.RainArrivalRecoveryCoreV32 =
        RainArrivalRecoveryCoreV32;

    global.RainArrivalRecoveryCoreV32Utils = {
        isFiniteNumber,
        toFiniteNumber,
        clamp,
        normalizePercentage,
        normalizeLongitude,
        normalizeBearing,
        normalizeTimestamp,
        createId,
        safeArray,
        safeObject,
        deepClone,
        average,
        weightedAverage,
        calculateStandardDeviation,
        sleep,
        withTimeout,
        degreesToRadians,
        radiansToDegrees,
        calculateDistanceKm,
        calculateBearingDegrees,
        calculateDestinationPoint,
        calculateAngularDifference,
        calculateDirectionalAlignment
    };

    global.RainArrivalRecoveryCoreV32Constants = {
        RECOVERY_CORE_VERSION,
        FORECAST_HORIZONS_HOURS,
        SOURCE_NAMES,
        SOURCE_TYPES,
        RAIN_STATUS,
        CELL_STATUS,
        MOVEMENT_STATUS,
        CORE_EVENTS,
        DEFAULT_SOURCE_WEIGHTS
    };

})(window);

/* ==========================================================================
   RainGuard AI
   Rain Arrival Recovery Core V32

   PART 2
   Location Registry + Source Adapter Management + Data Normalization
   ========================================================================== */

(function extendRainArrivalRecoveryCoreV32Part2(global) {
    "use strict";

    const CoreClass =
        global.RainArrivalRecoveryCoreV32;

    const Utils =
        global.RainArrivalRecoveryCoreV32Utils;

    const Constants =
        global.RainArrivalRecoveryCoreV32Constants;

    if (
        typeof CoreClass !== "function" ||
        !Utils ||
        !Constants
    ) {
        throw new Error(
            "RainArrivalRecoveryCoreV32 Part 1 must be loaded before Part 2."
        );
    }

    const {
        toFiniteNumber,
        clamp,
        normalizePercentage,
        normalizeTimestamp,
        createId,
        safeArray,
        safeObject,
        deepClone
    } = Utils;

    const {
        SOURCE_NAMES,
        SOURCE_TYPES,
        RAIN_STATUS,
        CELL_STATUS
    } = Constants;

    /* ======================================================================
       SECTION 14
       LOCATION NORMALIZATION
       ====================================================================== */

    function normalizeLocationId(value) {
        if (
            typeof value === "string" &&
            value.trim()
        ) {
            return value
                .trim()
                .toLowerCase()
                .replace(/\s+/g, "_");
        }

        return createId("location");
    }

    function normalizeLocationName(value, fallback = "") {
        if (
            typeof value === "string" &&
            value.trim()
        ) {
            return value.trim();
        }

        return fallback;
    }

    function normalizeLocationType(value) {
        const normalizedValue =
            String(value || "")
                .trim()
                .toLowerCase();

        const allowedTypes = new Set([
            "region",
            "city",
            "governorate",
            "district",
            "village",
            "station",
            "airport",
            "custom"
        ]);

        return allowedTypes.has(normalizedValue)
            ? normalizedValue
            : "city";
    }

    function normalizeLocationRecord(
        location,
        fallbackIndex = 0
    ) {
        const safeLocation =
            safeObject(location);

        const latitude =
            toFiniteNumber(
                safeLocation.latitude ??
                safeLocation.lat,
                NaN
            );

        const longitude =
            toFiniteNumber(
                safeLocation.longitude ??
                safeLocation.lon ??
                safeLocation.lng,
                NaN
            );

        if (
            !Number.isFinite(latitude) ||
            !Number.isFinite(longitude)
        ) {
            return null;
        }

        const arabicName =
            normalizeLocationName(
                safeLocation.nameAr ??
                safeLocation.arabicName ??
                safeLocation.name_ar
            );

        const englishName =
            normalizeLocationName(
                safeLocation.nameEn ??
                safeLocation.englishName ??
                safeLocation.name_en
            );

        const fallbackName =
            normalizeLocationName(
                safeLocation.name,
                `Location ${fallbackIndex + 1}`
            );

        const locationId =
            normalizeLocationId(
                safeLocation.id ??
                safeLocation.locationId ??
                safeLocation.code ??
                englishName ??
                arabicName ??
                fallbackName
            );

        return {
            id: locationId,

            code:
                safeLocation.code ||
                locationId,

            name:
                fallbackName ||
                arabicName ||
                englishName ||
                locationId,

            nameAr:
                arabicName ||
                fallbackName ||
                locationId,

            nameEn:
                englishName ||
                fallbackName ||
                locationId,

            type:
                normalizeLocationType(
                    safeLocation.type ??
                    safeLocation.locationType
                ),

            region:
                normalizeLocationName(
                    safeLocation.region ??
                    safeLocation.regionName
                ),

            regionId:
                normalizeLocationId(
                    safeLocation.regionId ??
                    safeLocation.regionCode ??
                    safeLocation.region ??
                    "unknown_region"
                ),

            governorate:
                normalizeLocationName(
                    safeLocation.governorate ??
                    safeLocation.governorateName
                ),

            governorateId:
                normalizeLocationId(
                    safeLocation.governorateId ??
                    safeLocation.governorateCode ??
                    safeLocation.governorate ??
                    "unknown_governorate"
                ),

            latitude:
                clamp(
                    latitude,
                    -90,
                    90
                ),

            longitude:
                clamp(
                    longitude,
                    -180,
                    180
                ),

            elevationMeters:
                toFiniteNumber(
                    safeLocation.elevationMeters ??
                    safeLocation.elevation,
                    0
                ),

            timezone:
                normalizeLocationName(
                    safeLocation.timezone,
                    "Asia/Riyadh"
                ),

            population:
                Math.max(
                    0,
                    toFiniteNumber(
                        safeLocation.population,
                        0
                    )
                ),

            priority:
                clamp(
                    toFiniteNumber(
                        safeLocation.priority,
                        0.5
                    ),
                    0,
                    1
                ),

            active:
                safeLocation.active !== false,

            metadata:
                deepClone(
                    safeObject(
                        safeLocation.metadata
                    )
                ),

            registeredAt:
                normalizeTimestamp(
                    safeLocation.registeredAt ??
                    Date.now()
                ),

            updatedAt:
                Date.now()
        };
    }

    /* ======================================================================
       SECTION 15
       LOCATION REGISTRY METHODS
       ====================================================================== */

    CoreClass.prototype.registerLocation =
        function registerLocation(location) {
            const normalizedLocation =
                normalizeLocationRecord(
                    location,
                    this.locations.size
                );

            if (!normalizedLocation) {
                this.logWarning(
                    "Location registration failed due to invalid coordinates.",
                    location
                );

                return null;
            }

            const existingLocation =
                this.locations.get(
                    normalizedLocation.id
                );

            const finalLocation = {
                ...existingLocation,
                ...normalizedLocation,

                registeredAt:
                    existingLocation?.registeredAt ??
                    normalizedLocation.registeredAt,

                updatedAt:
                    Date.now()
            };

            this.locations.set(
                finalLocation.id,
                finalLocation
            );

            return deepClone(
                finalLocation
            );
        };

    CoreClass.prototype.registerLocations =
        function registerLocations(locations) {
            const registeredLocations = [];

            safeArray(locations).forEach(
                (location) => {
                    const registered =
                        this.registerLocation(location);

                    if (registered) {
                        registeredLocations.push(
                            registered
                        );
                    }
                }
            );

            return registeredLocations;
        };

    CoreClass.prototype.updateLocation =
        function updateLocation(
            locationId,
            updates
        ) {
            const normalizedId =
                normalizeLocationId(locationId);

            const existingLocation =
                this.locations.get(normalizedId);

            if (!existingLocation) {
                return null;
            }

            const mergedLocation =
                normalizeLocationRecord(
                    {
                        ...existingLocation,
                        ...safeObject(updates),
                        id: normalizedId,

                        registeredAt:
                            existingLocation.registeredAt
                    }
                );

            if (!mergedLocation) {
                return null;
            }

            this.locations.set(
                normalizedId,
                mergedLocation
            );

            return deepClone(
                mergedLocation
            );
        };

    CoreClass.prototype.removeLocation =
        function removeLocation(locationId) {
            const normalizedId =
                normalizeLocationId(locationId);

            return this.locations.delete(
                normalizedId
            );
        };

    CoreClass.prototype.getLocation =
        function getLocation(locationId) {
            const normalizedId =
                normalizeLocationId(locationId);

            const location =
                this.locations.get(normalizedId);

            return location
                ? deepClone(location)
                : null;
        };

    CoreClass.prototype.getLocations =
        function getLocations(filters = {}) {
            const safeFilters =
                safeObject(filters);

            let locations =
                Array.from(
                    this.locations.values()
                );

            if (
                typeof safeFilters.type === "string" &&
                safeFilters.type
            ) {
                locations = locations.filter(
                    (location) => {
                        return (
                            location.type ===
                            safeFilters.type
                        );
                    }
                );
            }

            if (
                typeof safeFilters.regionId === "string" &&
                safeFilters.regionId
            ) {
                const normalizedRegionId =
                    normalizeLocationId(
                        safeFilters.regionId
                    );

                locations = locations.filter(
                    (location) => {
                        return (
                            location.regionId ===
                            normalizedRegionId
                        );
                    }
                );
            }

            if (
                typeof safeFilters.governorateId === "string" &&
                safeFilters.governorateId
            ) {
                const normalizedGovernorateId =
                    normalizeLocationId(
                        safeFilters.governorateId
                    );

                locations = locations.filter(
                    (location) => {
                        return (
                            location.governorateId ===
                            normalizedGovernorateId
                        );
                    }
                );
            }

            if (
                typeof safeFilters.active === "boolean"
            ) {
                locations = locations.filter(
                    (location) => {
                        return (
                            location.active ===
                            safeFilters.active
                        );
                    }
                );
            }

            return deepClone(locations);
        };

    CoreClass.prototype.clearLocations =
        function clearLocations() {
            const locationCount =
                this.locations.size;

            this.locations.clear();

            return locationCount;
        };

    CoreClass.prototype.getLocationCount =
        function getLocationCount() {
            return this.locations.size;
        };

    /* ======================================================================
       SECTION 16
       SOURCE ADAPTER NORMALIZATION
       ====================================================================== */

    function normalizeSourceName(value) {
        if (
            typeof value !== "string" ||
            !value.trim()
        ) {
            return SOURCE_NAMES.UNKNOWN;
        }

        return value
            .trim()
            .toLowerCase()
            .replace(/\s+/g, "_");
    }

    function normalizeSourceType(value) {
        const normalizedValue =
            String(value || "")
                .trim()
                .toLowerCase();

        const supportedTypes =
            Object.values(SOURCE_TYPES);

        return supportedTypes.includes(
            normalizedValue
        )
            ? normalizedValue
            : SOURCE_TYPES.UNKNOWN;
    }

    function resolveAdapterFetchMethod(adapter) {
        if (
            typeof adapter.fetch === "function"
        ) {
            return adapter.fetch.bind(adapter);
        }

        if (
            typeof adapter.collect === "function"
        ) {
            return adapter.collect.bind(adapter);
        }

        if (
            typeof adapter.getData === "function"
        ) {
            return adapter.getData.bind(adapter);
        }

        if (
            typeof adapter.update === "function"
        ) {
            return adapter.update.bind(adapter);
        }

        return null;
    }

    function normalizeSourceAdapter(
        adapterConfig
    ) {
        const safeConfig =
            safeObject(adapterConfig);

        const adapterObject =
            safeObject(
                safeConfig.adapter ??
                safeConfig.instance ??
                safeConfig
            );

        const sourceName =
            normalizeSourceName(
                safeConfig.name ??
                safeConfig.sourceName ??
                adapterObject.name ??
                adapterObject.sourceName
            );

        const fetchMethod =
            resolveAdapterFetchMethod(
                adapterObject
            );

        if (!fetchMethod) {
            return null;
        }

        return {
            id:
                safeConfig.id ||
                sourceName,

            name:
                sourceName,

            type:
                normalizeSourceType(
                    safeConfig.type ??
                    safeConfig.sourceType ??
                    adapterObject.type ??
                    adapterObject.sourceType
                ),

            enabled:
                safeConfig.enabled !== false,

            priority:
                clamp(
                    toFiniteNumber(
                        safeConfig.priority,
                        0.5
                    ),
                    0,
                    1
                ),

            timeoutMs:
                Math.max(
                    1000,
                    toFiniteNumber(
                        safeConfig.timeoutMs,
                        0
                    )
                ),

            weight:
                safeConfig.weight !== undefined
                    ? clamp(
                        toFiniteNumber(
                            safeConfig.weight,
                            0.5
                        ),
                        0,
                        1
                    )
                    : null,

            adapter:
                adapterObject,

            fetch:
                fetchMethod,

            metadata:
                deepClone(
                    safeObject(
                        safeConfig.metadata
                    )
                ),

            registeredAt:
                Date.now(),

            lastAttemptAt:
                null,

            lastSuccessAt:
                null,

            lastFailureAt:
                null,

            successCount:
                0,

            failureCount:
                0,

            consecutiveFailureCount:
                0,

            averageResponseTimeMs:
                0,

            lastResponseTimeMs:
                0,

            lastError:
                null
        };
    }

    /* ======================================================================
       SECTION 17
       SOURCE ADAPTER METHODS
       ====================================================================== */

    CoreClass.prototype.registerSourceAdapter =
        function registerSourceAdapter(
            adapterConfig
        ) {
            const normalizedAdapter =
                normalizeSourceAdapter(
                    adapterConfig
                );

            if (!normalizedAdapter) {
                this.logWarning(
                    "Source adapter registration failed.",
                    adapterConfig
                );

                return null;
            }

            const existingAdapter =
                this.sourceAdapters.get(
                    normalizedAdapter.name
                );

            const finalAdapter = {
                ...existingAdapter,
                ...normalizedAdapter,

                registeredAt:
                    existingAdapter?.registeredAt ??
                    normalizedAdapter.registeredAt,

                successCount:
                    existingAdapter?.successCount ??
                    0,

                failureCount:
                    existingAdapter?.failureCount ??
                    0,

                consecutiveFailureCount:
                    existingAdapter
                        ?.consecutiveFailureCount ??
                    0,

                averageResponseTimeMs:
                    existingAdapter
                        ?.averageResponseTimeMs ??
                    0
            };

            this.sourceAdapters.set(
                finalAdapter.name,
                finalAdapter
            );

            if (
                finalAdapter.weight !== null
            ) {
                this.setSourceWeight(
                    finalAdapter.name,
                    finalAdapter.weight
                );
            }

            return this.getSourceAdapter(
                finalAdapter.name
            );
        };

    CoreClass.prototype.registerSourceAdapters =
        function registerSourceAdapters(
            adapters
        ) {
            const registeredAdapters = [];

            safeArray(adapters).forEach(
                (adapter) => {
                    const registered =
                        this.registerSourceAdapter(
                            adapter
                        );

                    if (registered) {
                        registeredAdapters.push(
                            registered
                        );
                    }
                }
            );

            return registeredAdapters;
        };

    CoreClass.prototype.unregisterSourceAdapter =
        function unregisterSourceAdapter(
            sourceName
        ) {
            const normalizedName =
                normalizeSourceName(sourceName);

            return this.sourceAdapters.delete(
                normalizedName
            );
        };

    CoreClass.prototype.enableSourceAdapter =
        function enableSourceAdapter(
            sourceName
        ) {
            const normalizedName =
                normalizeSourceName(sourceName);

            const adapter =
                this.sourceAdapters.get(
                    normalizedName
                );

            if (!adapter) {
                return false;
            }

            adapter.enabled = true;

            return true;
        };

    CoreClass.prototype.disableSourceAdapter =
        function disableSourceAdapter(
            sourceName
        ) {
            const normalizedName =
                normalizeSourceName(sourceName);

            const adapter =
                this.sourceAdapters.get(
                    normalizedName
                );

            if (!adapter) {
                return false;
            }

            adapter.enabled = false;

            return true;
        };

    CoreClass.prototype.getSourceAdapter =
        function getSourceAdapter(
            sourceName
        ) {
            const normalizedName =
                normalizeSourceName(sourceName);

            const adapter =
                this.sourceAdapters.get(
                    normalizedName
                );

            if (!adapter) {
                return null;
            }

            return {
                id:
                    adapter.id,

                name:
                    adapter.name,

                type:
                    adapter.type,

                enabled:
                    adapter.enabled,

                priority:
                    adapter.priority,

                timeoutMs:
                    adapter.timeoutMs,

                weight:
                    this.getSourceWeight(
                        adapter.name
                    ),

                metadata:
                    deepClone(
                        adapter.metadata
                    ),

                registeredAt:
                    adapter.registeredAt,

                lastAttemptAt:
                    adapter.lastAttemptAt,

                lastSuccessAt:
                    adapter.lastSuccessAt,

                lastFailureAt:
                    adapter.lastFailureAt,

                successCount:
                    adapter.successCount,

                failureCount:
                    adapter.failureCount,

                consecutiveFailureCount:
                    adapter
                        .consecutiveFailureCount,

                averageResponseTimeMs:
                    adapter
                        .averageResponseTimeMs,

                lastResponseTimeMs:
                    adapter
                        .lastResponseTimeMs,

                lastError:
                    adapter.lastError
            };
        };

    CoreClass.prototype.getSourceAdapters =
        function getSourceAdapters(
            filters = {}
        ) {
            const safeFilters =
                safeObject(filters);

            let adapters =
                Array.from(
                    this.sourceAdapters.values()
                );

            if (
                typeof safeFilters.enabled ===
                "boolean"
            ) {
                adapters = adapters.filter(
                    (adapter) => {
                        return (
                            adapter.enabled ===
                            safeFilters.enabled
                        );
                    }
                );
            }

            if (
                typeof safeFilters.type ===
                "string" &&
                safeFilters.type
            ) {
                adapters = adapters.filter(
                    (adapter) => {
                        return (
                            adapter.type ===
                            safeFilters.type
                        );
                    }
                );
            }

            return adapters.map(
                (adapter) => {
                    return this.getSourceAdapter(
                        adapter.name
                    );
                }
            );
        };

    CoreClass.prototype.clearSourceAdapters =
        function clearSourceAdapters() {
            const adapterCount =
                this.sourceAdapters.size;

            this.sourceAdapters.clear();

            return adapterCount;
        };

    /* ======================================================================
       SECTION 18
       SOURCE RESULT NORMALIZATION
       ====================================================================== */

    function normalizeRainIntensity(value) {
        return Math.max(
            0,
            toFiniteNumber(value, 0)
        );
    }

    function normalizeProbability(value) {
        return normalizePercentage(value);
    }

    function normalizeCoordinatePoint(
        point,
        fallback = {}
    ) {
        const safePoint =
            safeObject(point);

        const latitude =
            toFiniteNumber(
                safePoint.latitude ??
                safePoint.lat ??
                fallback.latitude,
                NaN
            );

        const longitude =
            toFiniteNumber(
                safePoint.longitude ??
                safePoint.lon ??
                safePoint.lng ??
                fallback.longitude,
                NaN
            );

        if (
            !Number.isFinite(latitude) ||
            !Number.isFinite(longitude)
        ) {
            return null;
        }

        return {
            latitude:
                clamp(latitude, -90, 90),

            longitude:
                clamp(longitude, -180, 180)
        };
    }

    function normalizeObservation(
        observation,
        context = {}
    ) {
        const safeObservation =
            safeObject(observation);

        const coordinates =
            normalizeCoordinatePoint(
                safeObservation,
                context
            );

        if (!coordinates) {
            return null;
        }

        const rainIntensity =
            normalizeRainIntensity(
                safeObservation.rainIntensity ??
                safeObservation.rainRate ??
                safeObservation.precipitation ??
                safeObservation.rainMm ??
                safeObservation.rain
            );

        const rainProbability =
            normalizeProbability(
                safeObservation.rainProbability ??
                safeObservation.probability ??
                safeObservation.pop
            );

        const rainingNow =
            safeObservation.rainingNow === true ||
            safeObservation.isRaining === true ||
            rainIntensity > 0;

        return {
            id:
                safeObservation.id ||
                createId("observation"),

            source:
                normalizeSourceName(
                    safeObservation.source ??
                    context.source
                ),

            sourceType:
                normalizeSourceType(
                    safeObservation.sourceType ??
                    context.sourceType
                ),

            timestamp:
                normalizeTimestamp(
                    safeObservation.timestamp ??
                    safeObservation.time ??
                    context.timestamp
                ),

            latitude:
                coordinates.latitude,

            longitude:
                coordinates.longitude,

            locationId:
                safeObservation.locationId ??
                safeObservation.cityId ??
                safeObservation.stationId ??
                null,

            rainIntensity,

            rainProbability,

            rainingNow,

            temperatureC:
                toFiniteNumber(
                    safeObservation.temperatureC ??
                    safeObservation.temperature,
                    null
                ),

            humidity:
                normalizePercentage(
                    safeObservation.humidity
                ),

            pressureHpa:
                toFiniteNumber(
                    safeObservation.pressureHpa ??
                    safeObservation.pressure,
                    null
                ),

            windSpeedKmh:
                Math.max(
                    0,
                    toFiniteNumber(
                        safeObservation.windSpeedKmh ??
                        safeObservation.windSpeed,
                        0
                    )
                ),

            windDirectionDegrees:
                clamp(
                    toFiniteNumber(
                        safeObservation.windDirectionDegrees ??
                        safeObservation.windDirection,
                        0
                    ),
                    0,
                    360
                ),

            cloudCover:
                normalizePercentage(
                    safeObservation.cloudCover
                ),

            lightningCount:
                Math.max(
                    0,
                    toFiniteNumber(
                        safeObservation.lightningCount,
                        0
                    )
                ),

            confidence:
                normalizePercentage(
                    safeObservation.confidence ??
                    context.confidence ??
                    0.5
                ),

            metadata:
                deepClone(
                    safeObject(
                        safeObservation.metadata
                    )
                )
        };
    }

    function normalizeForecastPoint(
        forecast,
        context = {}
    ) {
        const safeForecast =
            safeObject(forecast);

        const coordinates =
            normalizeCoordinatePoint(
                safeForecast,
                context
            );

        if (!coordinates) {
            return null;
        }

        const forecastTimestamp =
            normalizeTimestamp(
                safeForecast.forecastTimestamp ??
                safeForecast.validTime ??
                safeForecast.timestamp ??
                safeForecast.time
            );

        return {
            id:
                safeForecast.id ||
                createId("forecast"),

            source:
                normalizeSourceName(
                    safeForecast.source ??
                    context.source
                ),

            sourceType:
                normalizeSourceType(
                    safeForecast.sourceType ??
                    context.sourceType
                ),

            generatedAt:
                normalizeTimestamp(
                    safeForecast.generatedAt ??
                    context.generatedAt ??
                    Date.now()
                ),

            forecastTimestamp,

            latitude:
                coordinates.latitude,

            longitude:
                coordinates.longitude,

            locationId:
                safeForecast.locationId ??
                safeForecast.cityId ??
                null,

            rainIntensity:
                normalizeRainIntensity(
                    safeForecast.rainIntensity ??
                    safeForecast.rainRate ??
                    safeForecast.precipitation ??
                    safeForecast.rainMm
                ),

            rainProbability:
                normalizeProbability(
                    safeForecast.rainProbability ??
                    safeForecast.probability ??
                    safeForecast.pop
                ),

            cloudCover:
                normalizePercentage(
                    safeForecast.cloudCover
                ),

            temperatureC:
                toFiniteNumber(
                    safeForecast.temperatureC ??
                    safeForecast.temperature,
                    null
                ),

            humidity:
                normalizePercentage(
                    safeForecast.humidity
                ),

            windSpeedKmh:
                Math.max(
                    0,
                    toFiniteNumber(
                        safeForecast.windSpeedKmh ??
                        safeForecast.windSpeed,
                        0
                    )
                ),

            windDirectionDegrees:
                clamp(
                    toFiniteNumber(
                        safeForecast.windDirectionDegrees ??
                        safeForecast.windDirection,
                        0
                    ),
                    0,
                    360
                ),

            confidence:
                normalizePercentage(
                    safeForecast.confidence ??
                    context.confidence ??
                    0.5
                ),

            metadata:
                deepClone(
                    safeObject(
                        safeForecast.metadata
                    )
                )
        };
    }

    function normalizeRainCell(
        cell,
        context = {}
    ) {
        const safeCell =
            safeObject(cell);

        const coordinates =
            normalizeCoordinatePoint(
                safeCell.center ??
                safeCell,
                context
            );

        if (!coordinates) {
            return null;
        }

        return {
            id:
                safeCell.id ??
                safeCell.cellId ??
                createId("rain_cell"),

            source:
                normalizeSourceName(
                    safeCell.source ??
                    context.source
                ),

            sourceType:
                normalizeSourceType(
                    safeCell.sourceType ??
                    context.sourceType
                ),

            timestamp:
                normalizeTimestamp(
                    safeCell.timestamp ??
                    safeCell.detectedAt ??
                    context.timestamp
                ),

            latitude:
                coordinates.latitude,

            longitude:
                coordinates.longitude,

            radiusKm:
                Math.max(
                    1,
                    toFiniteNumber(
                        safeCell.radiusKm ??
                        safeCell.radius,
                        15
                    )
                ),

            areaKm2:
                Math.max(
                    0,
                    toFiniteNumber(
                        safeCell.areaKm2 ??
                        safeCell.area,
                        0
                    )
                ),

            intensity:
                normalizeRainIntensity(
                    safeCell.intensity ??
                    safeCell.rainIntensity ??
                    safeCell.rainRate
                ),

            maxIntensity:
                normalizeRainIntensity(
                    safeCell.maxIntensity ??
                    safeCell.intensity
                ),

            probability:
                normalizeProbability(
                    safeCell.probability ??
                    safeCell.rainProbability
                ),

            speedKmh:
                Math.max(
                    0,
                    toFiniteNumber(
                        safeCell.speedKmh ??
                        safeCell.speed,
                        0
                    )
                ),

            directionDegrees:
                clamp(
                    toFiniteNumber(
                        safeCell.directionDegrees ??
                        safeCell.direction ??
                        safeCell.bearing,
                        0
                    ),
                    0,
                    360
                ),

            status:
                Object.values(
                    CELL_STATUS
                ).includes(safeCell.status)
                    ? safeCell.status
                    : CELL_STATUS.ACTIVE,

            confidence:
                normalizePercentage(
                    safeCell.confidence ??
                    context.confidence ??
                    0.5
                ),

            polygon:
                safeArray(
                    safeCell.polygon
                )
                    .map((point) => {
                        return normalizeCoordinatePoint(
                            point
                        );
                    })
                    .filter(Boolean),

            metadata:
                deepClone(
                    safeObject(
                        safeCell.metadata
                    )
                )
        };
    }

    /* ======================================================================
       SECTION 19
       COMPLETE SOURCE RESPONSE NORMALIZATION
       ====================================================================== */

    CoreClass.prototype.normalizeSourceResult =
        function normalizeSourceResult(
            rawResult,
            adapter
        ) {
            const safeResult =
                safeObject(rawResult);

            const sourceName =
                normalizeSourceName(
                    safeResult.source ??
                    adapter?.name
                );

            const sourceType =
                normalizeSourceType(
                    safeResult.sourceType ??
                    adapter?.type
                );

            const generatedAt =
                normalizeTimestamp(
                    safeResult.generatedAt ??
                    safeResult.timestamp ??
                    Date.now()
                );

            const defaultConfidence =
                normalizePercentage(
                    safeResult.confidence ??
                    this.getSourceWeight(
                        sourceName
                    )
                );

            const context = {
                source:
                    sourceName,

                sourceType,

                generatedAt,

                timestamp:
                    generatedAt,

                confidence:
                    defaultConfidence
            };

            const rawObservations =
                safeArray(
                    safeResult.observations ??
                    safeResult.current ??
                    safeResult.currentConditions
                );

            const rawForecasts =
                safeArray(
                    safeResult.forecasts ??
                    safeResult.hourly ??
                    safeResult.predictions
                );

            const rawCells =
                safeArray(
                    safeResult.rainCells ??
                    safeResult.cells ??
                    safeResult.stormCells
                );

            const observations =
                rawObservations
                    .map((observation) => {
                        return normalizeObservation(
                            observation,
                            context
                        );
                    })
                    .filter(Boolean);

            const forecasts =
                rawForecasts
                    .map((forecast) => {
                        return normalizeForecastPoint(
                            forecast,
                            context
                        );
                    })
                    .filter(Boolean);

            const rainCells =
                rawCells
                    .map((cell) => {
                        return normalizeRainCell(
                            cell,
                            context
                        );
                    })
                    .filter(Boolean);

            return {
                id:
                    safeResult.id ||
                    createId("source_result"),

                source:
                    sourceName,

                sourceType,

                generatedAt,

                receivedAt:
                    Date.now(),

                confidence:
                    defaultConfidence,

                weight:
                    this.getSourceWeight(
                        sourceName
                    ),

                observations,

                forecasts,

                rainCells,

                status:
                    safeResult.status ||
                    "success",

                metadata:
                    deepClone(
                        safeObject(
                            safeResult.metadata
                        )
                    ),

                rawSummary: {
                    observationCount:
                        observations.length,

                    forecastCount:
                        forecasts.length,

                    rainCellCount:
                        rainCells.length
                }
            };
        };

    /* ======================================================================
       SECTION 20
       DIRECT DATA INGESTION METHODS
       ====================================================================== */

    CoreClass.prototype.ingestSourceData =
        function ingestSourceData(
            sourceName,
            rawData,
            sourceType = SOURCE_TYPES.UNKNOWN
        ) {
            const normalizedName =
                normalizeSourceName(
                    sourceName
                );

            const normalizedResult =
                this.normalizeSourceResult(
                    {
                        ...safeObject(rawData),

                        source:
                            normalizedName,

                        sourceType
                    },
                    {
                        name:
                            normalizedName,

                        type:
                            sourceType
                    }
                );

            this.state.sourceResults.push(
                normalizedResult
            );

            this.state.observations.push(
                ...normalizedResult.observations
            );

            this.state.forecasts.push(
                ...normalizedResult.forecasts
            );

            return deepClone(
                normalizedResult
            );
        };

    CoreClass.prototype.ingestObservation =
        function ingestObservation(
            observation
        ) {
            const normalizedObservation =
                normalizeObservation(
                    observation
                );

            if (!normalizedObservation) {
                return null;
            }

            this.state.observations.push(
                normalizedObservation
            );

            return deepClone(
                normalizedObservation
            );
        };

    CoreClass.prototype.ingestForecast =
        function ingestForecast(
            forecast
        ) {
            const normalizedForecast =
                normalizeForecastPoint(
                    forecast
                );

            if (!normalizedForecast) {
                return null;
            }

            this.state.forecasts.push(
                normalizedForecast
            );

            return deepClone(
                normalizedForecast
            );
        };

    CoreClass.prototype.ingestRainCell =
        function ingestRainCell(
            cell
        ) {
            const normalizedCell =
                normalizeRainCell(
                    cell
                );

            if (!normalizedCell) {
                return null;
            }

            this.cells.set(
                normalizedCell.id,
                normalizedCell
            );

            this.state.rainCells =
                Array.from(
                    this.cells.values()
                );

            return deepClone(
                normalizedCell
            );
        };

    /* ======================================================================
       SECTION 21
       BASIC SOURCE AND LOCATION LOOKUPS
       ====================================================================== */

    CoreClass.prototype.findLocationByCoordinates =
        function findLocationByCoordinates(
            latitude,
            longitude,
            maxDistanceKm = 25
        ) {
            if (
                !Number.isFinite(
                    Number(latitude)
                ) ||
                !Number.isFinite(
                    Number(longitude)
                )
            ) {
                return null;
            }

            let nearestLocation = null;
            let nearestDistance = Infinity;

            this.locations.forEach(
                (location) => {
                    const distance =
                        Utils.calculateDistanceKm(
                            Number(latitude),
                            Number(longitude),
                            location.latitude,
                            location.longitude
                        );

                    if (
                        distance < nearestDistance &&
                        distance <= maxDistanceKm
                    ) {
                        nearestDistance =
                            distance;

                        nearestLocation =
                            location;
                    }
                }
            );

            if (!nearestLocation) {
                return null;
            }

            return {
                location:
                    deepClone(
                        nearestLocation
                    ),

                distanceKm:
                    nearestDistance
            };
        };

    CoreClass.prototype.getActiveLocations =
        function getActiveLocations() {
            return this.getLocations({
                active: true
            });
        };

    CoreClass.prototype.getEnabledSourceAdapters =
        function getEnabledSourceAdapters() {
            return this.getSourceAdapters({
                enabled: true
            });
        };

    /* ======================================================================
       SECTION 22
       EXPORT PART 2 HELPERS
       ====================================================================== */

    global.RainArrivalRecoveryCoreV32Part2 = {
        normalizeLocationId,
        normalizeLocationName,
        normalizeLocationType,
        normalizeLocationRecord,
        normalizeSourceName,
        normalizeSourceType,
        normalizeSourceAdapter,
        normalizeObservation,
        normalizeForecastPoint,
        normalizeRainCell
    };

})(window);

/* ==========================================================================
   RainGuard AI
   Rain Arrival Recovery Core V32

   PART 3
   Source Execution + Parallel Collection + Timeout + Retry Management
   ========================================================================== */

(function extendRainArrivalRecoveryCoreV32Part3(global) {
    "use strict";

    const CoreClass =
        global.RainArrivalRecoveryCoreV32;

    const Utils =
        global.RainArrivalRecoveryCoreV32Utils;

    const Constants =
        global.RainArrivalRecoveryCoreV32Constants;

    if (
        typeof CoreClass !== "function" ||
        !Utils ||
        !Constants
    ) {
        throw new Error(
            "RainArrivalRecoveryCoreV32 Parts 1 and 2 must be loaded before Part 3."
        );
    }

    const {
        toFiniteNumber,
        clamp,
        normalizeTimestamp,
        safeArray,
        safeObject,
        deepClone,
        sleep,
        withTimeout
    } = Utils;

    const {
        CORE_EVENTS
    } = Constants;

    /* ======================================================================
       SECTION 23
       COLLECTION CONSTANTS
       ====================================================================== */

    const DEFAULT_RETRY_COUNT = 1;

    const DEFAULT_RETRY_DELAY_MS = 1200;

    const DEFAULT_MAX_CONCURRENT_SOURCES = 8;

    const SOURCE_EXECUTION_STATUS = Object.freeze({
        PENDING: "pending",
        RUNNING: "running",
        SUCCESS: "success",
        FAILED: "failed",
        TIMEOUT: "timeout",
        ABORTED: "aborted",
        DISABLED: "disabled",
        SKIPPED: "skipped"
    });

    /* ======================================================================
       SECTION 24
       COLLECTION HELPERS
       ====================================================================== */

    function createAbortError(
        message = "Operation aborted."
    ) {
        const error =
            new Error(message);

        error.name =
            "AbortError";

        return error;
    }

    function isAbortError(error) {
        return (
            error?.name === "AbortError" ||
            error?.code === "ABORT_ERR" ||
            String(error?.message || "")
                .toLowerCase()
                .includes("abort")
        );
    }

    function isTimeoutError(error) {
        return String(
            error?.message || ""
        )
            .toLowerCase()
            .includes("timed out");
    }

    function normalizeError(error) {
        if (!error) {
            return {
                name: "Error",
                message: "Unknown error.",
                stack: null
            };
        }

        return {
            name:
                error.name ||
                "Error",

            message:
                error.message ||
                String(error),

            stack:
                error.stack ||
                null
        };
    }

    function calculateRollingAverage(
        previousAverage,
        previousCount,
        newValue
    ) {
        const safePreviousAverage =
            Math.max(
                0,
                toFiniteNumber(
                    previousAverage,
                    0
                )
            );

        const safePreviousCount =
            Math.max(
                0,
                toFiniteNumber(
                    previousCount,
                    0
                )
            );

        const safeNewValue =
            Math.max(
                0,
                toFiniteNumber(
                    newValue,
                    0
                )
            );

        if (safePreviousCount <= 0) {
            return safeNewValue;
        }

        return (
            safePreviousAverage *
            safePreviousCount +
            safeNewValue
        ) / (
            safePreviousCount + 1
        );
    }

    function createSourceExecutionRecord(
        adapter,
        cycleId
    ) {
        return {
            id:
                `${cycleId}_${adapter.name}`,

            cycleId,

            source:
                adapter.name,

            sourceType:
                adapter.type,

            status:
                SOURCE_EXECUTION_STATUS.PENDING,

            attemptCount:
                0,

            startedAt:
                null,

            completedAt:
                null,

            durationMs:
                0,

            timeoutMs:
                0,

            observationCount:
                0,

            forecastCount:
                0,

            rainCellCount:
                0,

            error:
                null
        };
    }

    /* ======================================================================
       SECTION 25
       COLLECTION OPTION NORMALIZATION
       ====================================================================== */

    CoreClass.prototype.normalizeCollectionOptions =
        function normalizeCollectionOptions(
            options = {}
        ) {
            const safeOptions =
                safeObject(options);

            return {
                retryCount:
                    clamp(
                        toFiniteNumber(
                            safeOptions.retryCount,
                            DEFAULT_RETRY_COUNT
                        ),
                        0,
                        5
                    ),

                retryDelayMs:
                    Math.max(
                        0,
                        toFiniteNumber(
                            safeOptions.retryDelayMs,
                            DEFAULT_RETRY_DELAY_MS
                        )
                    ),

                sourceTimeoutMs:
                    Math.max(
                        1000,
                        toFiniteNumber(
                            safeOptions.sourceTimeoutMs,
                            this.options.sourceTimeoutMs
                        )
                    ),

                maxConcurrentSources:
                    clamp(
                        toFiniteNumber(
                            safeOptions.maxConcurrentSources,
                            DEFAULT_MAX_CONCURRENT_SOURCES
                        ),
                        1,
                        32
                    ),

                includeDisabled:
                    safeOptions.includeDisabled === true,

                preservePreviousData:
                    safeOptions.preservePreviousData === true,

                locations:
                    safeArray(
                        safeOptions.locations
                    ).length
                        ? safeArray(
                            safeOptions.locations
                        )
                        : this.getActiveLocations(),

                context:
                    deepClone(
                        safeObject(
                            safeOptions.context
                        )
                    ),

                signal:
                    safeOptions.signal ||
                    null
            };
        };

    /* ======================================================================
       SECTION 26
       ADAPTER EXECUTION CONTEXT
       ====================================================================== */

    CoreClass.prototype.createAdapterExecutionContext =
        function createAdapterExecutionContext(
            adapter,
            collectionOptions
        ) {
            return {
                version:
                    this.version,

                cycleId:
                    this.state.cycleId,

                source:
                    adapter.name,

                sourceType:
                    adapter.type,

                startedAt:
                    Date.now(),

                locations:
                    deepClone(
                        collectionOptions.locations
                    ),

                sourceWeight:
                    this.getSourceWeight(
                        adapter.name
                    ),

                options: {
                    maxEtaHours:
                        this.options.maxEtaHours,

                    minRainIntensity:
                        this.options.minRainIntensity,

                    minConfidence:
                        this.options.minConfidence
                },

                signal:
                    collectionOptions.signal ||
                    this.abortController?.signal ||
                    null,

                context:
                    deepClone(
                        collectionOptions.context
                    ),

                core:
                    this
            };
        };

    /* ======================================================================
       SECTION 27
       SINGLE SOURCE EXECUTION
       ====================================================================== */

    CoreClass.prototype.executeSourceAdapter =
        async function executeSourceAdapter(
            adapter,
            options = {}
        ) {
            if (!adapter) {
                throw new Error(
                    "Source adapter is required."
                );
            }

            const collectionOptions =
                this.normalizeCollectionOptions(
                    options
                );

            const executionRecord =
                createSourceExecutionRecord(
                    adapter,
                    this.state.cycleId
                );

            if (
                adapter.enabled !== true &&
                !collectionOptions.includeDisabled
            ) {
                executionRecord.status =
                    SOURCE_EXECUTION_STATUS.DISABLED;

                executionRecord.completedAt =
                    Date.now();

                return {
                    execution:
                        executionRecord,

                    result:
                        null
                };
            }

            const signal =
                collectionOptions.signal ||
                this.abortController?.signal ||
                null;

            if (signal?.aborted) {
                executionRecord.status =
                    SOURCE_EXECUTION_STATUS.ABORTED;

                executionRecord.error =
                    normalizeError(
                        createAbortError()
                    );

                return {
                    execution:
                        executionRecord,

                    result:
                        null
                };
            }

            const timeoutMs =
                adapter.timeoutMs > 1000
                    ? adapter.timeoutMs
                    : collectionOptions.sourceTimeoutMs;

            executionRecord.timeoutMs =
                timeoutMs;

            executionRecord.status =
                SOURCE_EXECUTION_STATUS.RUNNING;

            executionRecord.startedAt =
                Date.now();

            adapter.lastAttemptAt =
                executionRecord.startedAt;

            const maximumAttempts =
                collectionOptions.retryCount + 1;

            let lastError = null;

            for (
                let attempt = 1;
                attempt <= maximumAttempts;
                attempt += 1
            ) {
                executionRecord.attemptCount =
                    attempt;

                if (signal?.aborted) {
                    lastError =
                        createAbortError();

                    break;
                }

                try {
                    const adapterContext =
                        this.createAdapterExecutionContext(
                            adapter,
                            collectionOptions
                        );

                    const rawResult =
                        await withTimeout(
                            Promise.resolve(
                                adapter.fetch(
                                    adapterContext
                                )
                            ),
                            timeoutMs,
                            `Source ${adapter.name} timed out after ${timeoutMs} ms.`
                        );

                    if (signal?.aborted) {
                        throw createAbortError();
                    }

                    const normalizedResult =
                        this.normalizeSourceResult(
                            rawResult,
                            adapter
                        );

                    const completedAt =
                        Date.now();

                    const durationMs =
                        completedAt -
                        executionRecord.startedAt;

                    executionRecord.status =
                        SOURCE_EXECUTION_STATUS.SUCCESS;

                    executionRecord.completedAt =
                        completedAt;

                    executionRecord.durationMs =
                        durationMs;

                    executionRecord.observationCount =
                        normalizedResult
                            .observations
                            .length;

                    executionRecord.forecastCount =
                        normalizedResult
                            .forecasts
                            .length;

                    executionRecord.rainCellCount =
                        normalizedResult
                            .rainCells
                            .length;

                    adapter.lastSuccessAt =
                        completedAt;

                    adapter.successCount += 1;

                    adapter.consecutiveFailureCount =
                        0;

                    adapter.lastResponseTimeMs =
                        durationMs;

                    adapter.averageResponseTimeMs =
                        calculateRollingAverage(
                            adapter.averageResponseTimeMs,
                            adapter.successCount - 1,
                            durationMs
                        );

                    adapter.lastError =
                        null;

                    this.emit(
                        CORE_EVENTS.SOURCE_UPDATED,
                        {
                            source:
                                adapter.name,

                            sourceType:
                                adapter.type,

                            execution:
                                deepClone(
                                    executionRecord
                                ),

                            summary:
                                deepClone(
                                    normalizedResult
                                        .rawSummary
                                )
                        }
                    );

                    return {
                        execution:
                            executionRecord,

                        result:
                            normalizedResult
                    };

                } catch (error) {
                    lastError =
                        error;

                    if (
                        isAbortError(error) ||
                        signal?.aborted
                    ) {
                        break;
                    }

                    const hasMoreAttempts =
                        attempt < maximumAttempts;

                    if (hasMoreAttempts) {
                        const retryDelay =
                            collectionOptions
                                .retryDelayMs *
                            attempt;

                        this.logWarning(
                            `Source ${adapter.name} failed on attempt ${attempt}. Retrying.`,
                            error
                        );

                        await sleep(
                            retryDelay
                        );
                    }
                }
            }

            const completedAt =
                Date.now();

            const durationMs =
                completedAt -
                executionRecord.startedAt;

            executionRecord.completedAt =
                completedAt;

            executionRecord.durationMs =
                durationMs;

            executionRecord.error =
                normalizeError(
                    lastError
                );

            if (
                isAbortError(lastError) ||
                signal?.aborted
            ) {
                executionRecord.status =
                    SOURCE_EXECUTION_STATUS.ABORTED;
            } else if (
                isTimeoutError(lastError)
            ) {
                executionRecord.status =
                    SOURCE_EXECUTION_STATUS.TIMEOUT;
            } else {
                executionRecord.status =
                    SOURCE_EXECUTION_STATUS.FAILED;
            }

            adapter.lastFailureAt =
                completedAt;

            adapter.failureCount += 1;

            adapter.consecutiveFailureCount += 1;

            adapter.lastResponseTimeMs =
                durationMs;

            adapter.lastError =
                executionRecord.error;

            this.emit(
                CORE_EVENTS.SOURCE_FAILED,
                {
                    source:
                        adapter.name,

                    sourceType:
                        adapter.type,

                    execution:
                        deepClone(
                            executionRecord
                        ),

                    error:
                        deepClone(
                            executionRecord.error
                        )
                }
            );

            return {
                execution:
                    executionRecord,

                result:
                    null
            };
        };

    /* ======================================================================
       SECTION 28
       CONCURRENT TASK WORKER
       ====================================================================== */

    CoreClass.prototype.runConcurrentTasks =
        async function runConcurrentTasks(
            taskFactories,
            concurrencyLimit
        ) {
            const tasks =
                safeArray(
                    taskFactories
                );

            const safeConcurrency =
                clamp(
                    toFiniteNumber(
                        concurrencyLimit,
                        DEFAULT_MAX_CONCURRENT_SOURCES
                    ),
                    1,
                    Math.max(
                        1,
                        tasks.length
                    )
                );

            const results =
                new Array(
                    tasks.length
                );

            let nextIndex = 0;

            const worker =
                async () => {
                    while (true) {
                        const currentIndex =
                            nextIndex;

                        nextIndex += 1;

                        if (
                            currentIndex >=
                            tasks.length
                        ) {
                            return;
                        }

                        const task =
                            tasks[currentIndex];

                        try {
                            results[currentIndex] =
                                await task();
                        } catch (error) {
                            results[currentIndex] = {
                                execution: {
                                    status:
                                        SOURCE_EXECUTION_STATUS.FAILED,

                                    error:
                                        normalizeError(
                                            error
                                        )
                                },

                                result:
                                    null
                            };
                        }
                    }
                };

            const workerCount =
                Math.min(
                    safeConcurrency,
                    tasks.length
                );

            const workers =
                Array.from(
                    {
                        length:
                            workerCount
                    },
                    () => worker()
                );

            await Promise.all(
                workers
            );

            return results;
        };

    /* ======================================================================
       SECTION 29
       PARALLEL SOURCE COLLECTION
       ====================================================================== */

    CoreClass.prototype.collectAllSources =
        async function collectAllSources(
            options = {}
        ) {
            const collectionOptions =
                this.normalizeCollectionOptions(
                    options
                );

            const adapters =
                Array.from(
                    this.sourceAdapters.values()
                )
                    .filter((adapter) => {
                        return (
                            adapter.enabled === true ||
                            collectionOptions
                                .includeDisabled
                        );
                    })
                    .sort((adapterA, adapterB) => {
                        return (
                            adapterB.priority -
                            adapterA.priority
                        );
                    });

            if (!adapters.length) {
                this.logWarning(
                    "No source adapters are registered or enabled."
                );

                return {
                    generatedAt:
                        Date.now(),

                    sourceResults:
                        [],

                    executions:
                        [],

                    observations:
                        [],

                    forecasts:
                        [],

                    rainCells:
                        [],

                    errors:
                        []
                };
            }

            const taskFactories =
                adapters.map((adapter) => {
                    return async () => {
                        return this.executeSourceAdapter(
                            adapter,
                            collectionOptions
                        );
                    };
                });

            const executionResults =
                await this.runConcurrentTasks(
                    taskFactories,
                    collectionOptions
                        .maxConcurrentSources
                );

            const successfulResults = [];
            const executions = [];
            const observations = [];
            const forecasts = [];
            const rainCells = [];
            const errors = [];

            executionResults.forEach(
                (executionResult) => {
                    if (!executionResult) {
                        return;
                    }

                    if (
                        executionResult.execution
                    ) {
                        executions.push(
                            executionResult.execution
                        );
                    }

                    if (
                        executionResult.result
                    ) {
                        successfulResults.push(
                            executionResult.result
                        );

                        observations.push(
                            ...executionResult
                                .result
                                .observations
                        );

                        forecasts.push(
                            ...executionResult
                                .result
                                .forecasts
                        );

                        rainCells.push(
                            ...executionResult
                                .result
                                .rainCells
                        );
                    }

                    if (
                        executionResult.execution
                            ?.error
                    ) {
                        errors.push({
                            source:
                                executionResult
                                    .execution
                                    .source,

                            status:
                                executionResult
                                    .execution
                                    .status,

                            error:
                                executionResult
                                    .execution
                                    .error
                        });
                    }
                }
            );

            if (
                !collectionOptions
                    .preservePreviousData
            ) {
                this.state.sourceResults =
                    successfulResults;

                this.state.observations =
                    observations;

                this.state.forecasts =
                    forecasts;

                this.state.sourceErrors =
                    errors;
            } else {
                this.state.sourceResults.push(
                    ...successfulResults
                );

                this.state.observations.push(
                    ...observations
                );

                this.state.forecasts.push(
                    ...forecasts
                );

                this.state.sourceErrors.push(
                    ...errors
                );
            }

            this.state.sources =
                executions.reduce(
                    (
                        sourceState,
                        execution
                    ) => {
                        sourceState[
                            execution.source
                        ] = execution;

                        return sourceState;
                    },
                    {}
                );

            this.state.diagnostics
                .sourceSuccessCount =
                executions.filter(
                    (execution) => {
                        return (
                            execution.status ===
                            SOURCE_EXECUTION_STATUS.SUCCESS
                        );
                    }
                ).length;

            this.state.diagnostics
                .sourceFailureCount =
                executions.filter(
                    (execution) => {
                        return [
                            SOURCE_EXECUTION_STATUS.FAILED,
                            SOURCE_EXECUTION_STATUS.TIMEOUT,
                            SOURCE_EXECUTION_STATUS.ABORTED
                        ].includes(
                            execution.status
                        );
                    }
                ).length;

            return {
                generatedAt:
                    Date.now(),

                sourceResults:
                    deepClone(
                        successfulResults
                    ),

                executions:
                    deepClone(
                        executions
                    ),

                observations:
                    deepClone(
                        observations
                    ),

                forecasts:
                    deepClone(
                        forecasts
                    ),

                rainCells:
                    deepClone(
                        rainCells
                    ),

                errors:
                    deepClone(
                        errors
                    )
            };
        };

    /* ======================================================================
       SECTION 30
       COLLECTION BY SOURCE NAME
       ====================================================================== */

    CoreClass.prototype.collectSource =
        async function collectSource(
            sourceName,
            options = {}
        ) {
            const normalizedName =
                String(sourceName || "")
                    .trim()
                    .toLowerCase()
                    .replace(/\s+/g, "_");

            const adapter =
                this.sourceAdapters.get(
                    normalizedName
                );

            if (!adapter) {
                throw new Error(
                    `Source adapter not found: ${normalizedName}`
                );
            }

            const executionResult =
                await this.executeSourceAdapter(
                    adapter,
                    options
                );

            if (
                executionResult.result
            ) {
                this.state.sourceResults.push(
                    executionResult.result
                );

                this.state.observations.push(
                    ...executionResult
                        .result
                        .observations
                );

                this.state.forecasts.push(
                    ...executionResult
                        .result
                        .forecasts
                );
            }

            return deepClone(
                executionResult
            );
        };

    /* ======================================================================
       SECTION 31
       SOURCE HEALTH SCORE
       ====================================================================== */

    CoreClass.prototype.calculateSourceHealth =
        function calculateSourceHealth(
            sourceName
        ) {
            const normalizedName =
                String(sourceName || "")
                    .trim()
                    .toLowerCase()
                    .replace(/\s+/g, "_");

            const adapter =
                this.sourceAdapters.get(
                    normalizedName
                );

            if (!adapter) {
                return null;
            }

            const totalAttempts =
                adapter.successCount +
                adapter.failureCount;

            const successRate =
                totalAttempts > 0
                    ? adapter.successCount /
                      totalAttempts
                    : 0.5;

            const failurePenalty =
                clamp(
                    adapter
                        .consecutiveFailureCount /
                    5,
                    0,
                    1
                );

            const timeoutReference =
                Math.max(
                    1000,
                    adapter.timeoutMs ||
                    this.options.sourceTimeoutMs
                );

            const responseScore =
                adapter.averageResponseTimeMs > 0
                    ? clamp(
                        1 -
                        adapter
                            .averageResponseTimeMs /
                        timeoutReference,
                        0,
                        1
                    )
                    : 0.5;

            const weightScore =
                this.getSourceWeight(
                    normalizedName
                );

            const healthScore =
                clamp(
                    successRate * 0.45 +
                    responseScore * 0.20 +
                    weightScore * 0.35 -
                    failurePenalty * 0.25,
                    0,
                    1
                );

            return {
                source:
                    normalizedName,

                score:
                    healthScore,

                successRate,

                responseScore,

                weightScore,

                consecutiveFailureCount:
                    adapter
                        .consecutiveFailureCount,

                status:
                    healthScore >= 0.75
                        ? "healthy"
                        : healthScore >= 0.45
                            ? "degraded"
                            : "unhealthy",

                calculatedAt:
                    Date.now()
            };
        };

    CoreClass.prototype.getSourcesHealth =
        function getSourcesHealth() {
            return Array.from(
                this.sourceAdapters.keys()
            )
                .map((sourceName) => {
                    return this.calculateSourceHealth(
                        sourceName
                    );
                })
                .filter(Boolean)
                .sort((sourceA, sourceB) => {
                    return (
                        sourceB.score -
                        sourceA.score
                    );
                });
        };

    /* ======================================================================
       SECTION 32
       ABORT CURRENT COLLECTION
       ====================================================================== */

    CoreClass.prototype.abortCurrentCollection =
        function abortCurrentCollection(
            reason = "Collection aborted."
        ) {
            if (
                !this.abortController
            ) {
                return false;
            }

            try {
                this.abortController.abort(
                    reason
                );

                return true;
            } catch (error) {
                this.logError(
                    "Failed to abort current collection.",
                    error
                );

                return false;
            }
        };

    /* ======================================================================
       SECTION 33
       SOURCE DATA CLEANUP
       ====================================================================== */

    CoreClass.prototype.cleanupSourceData =
        function cleanupSourceData(
            options = {}
        ) {
            const safeOptions =
                safeObject(options);

            const now =
                Date.now();

            const maximumObservationAgeMs =
                Math.max(
                    60 * 1000,
                    toFiniteNumber(
                        safeOptions
                            .maximumObservationAgeMs,
                        6 * 60 * 60 * 1000
                    )
                );

            const maximumForecastAgeMs =
                Math.max(
                    60 * 1000,
                    toFiniteNumber(
                        safeOptions
                            .maximumForecastAgeMs,
                        96 * 60 * 60 * 1000
                    )
                );

            const previousObservationCount =
                this.state.observations.length;

            const previousForecastCount =
                this.state.forecasts.length;

            this.state.observations =
                this.state.observations.filter(
                    (observation) => {
                        const timestamp =
                            normalizeTimestamp(
                                observation.timestamp
                            );

                        return (
                            now - timestamp <=
                            maximumObservationAgeMs
                        );
                    }
                );

            this.state.forecasts =
                this.state.forecasts.filter(
                    (forecast) => {
                        const timestamp =
                            normalizeTimestamp(
                                forecast
                                    .forecastTimestamp
                            );

                        return (
                            timestamp >=
                            now -
                            maximumForecastAgeMs
                        );
                    }
                );

            return {
                removedObservations:
                    previousObservationCount -
                    this.state.observations
                        .length,

                removedForecasts:
                    previousForecastCount -
                    this.state.forecasts
                        .length,

                remainingObservations:
                    this.state.observations
                        .length,

                remainingForecasts:
                    this.state.forecasts
                        .length,

                cleanedAt:
                    now
            };
        };

    /* ======================================================================
       SECTION 34
       PART 3 EXPORT
       ====================================================================== */

    global.RainArrivalRecoveryCoreV32Part3 = {
        SOURCE_EXECUTION_STATUS,
        createAbortError,
        isAbortError,
        isTimeoutError,
        normalizeError,
        calculateRollingAverage
    };

})(window);

/* ==========================================================================
   RainGuard AI
   Rain Arrival Recovery Core V32

   PART 4
   Multi-Source Fusion + Deduplication + Rain Cell Clustering
   ========================================================================== */

(function extendRainArrivalRecoveryCoreV32Part4(global) {
    "use strict";

    const CoreClass =
        global.RainArrivalRecoveryCoreV32;

    const Utils =
        global.RainArrivalRecoveryCoreV32Utils;

    const Constants =
        global.RainArrivalRecoveryCoreV32Constants;

    if (
        typeof CoreClass !== "function" ||
        !Utils ||
        !Constants
    ) {
        throw new Error(
            "RainArrivalRecoveryCoreV32 Parts 1 to 3 must be loaded before Part 4."
        );
    }

    const {
        toFiniteNumber,
        clamp,
        normalizePercentage,
        normalizeTimestamp,
        normalizeBearing,
        createId,
        safeArray,
        safeObject,
        deepClone,
        average,
        weightedAverage,
        calculateDistanceKm
    } = Utils;

    const {
        SOURCE_NAMES,
        SOURCE_TYPES,
        CELL_STATUS,
        CORE_EVENTS
    } = Constants;

    /* ======================================================================
       SECTION 35
       FUSION CONSTANTS
       ====================================================================== */

    const DEFAULT_OBSERVATION_DUPLICATE_DISTANCE_KM =
        7;

    const DEFAULT_OBSERVATION_DUPLICATE_TIME_MS =
        15 * 60 * 1000;

    const DEFAULT_FORECAST_DUPLICATE_DISTANCE_KM =
        10;

    const DEFAULT_FORECAST_DUPLICATE_TIME_MS =
        30 * 60 * 1000;

    const DEFAULT_CLUSTER_DISTANCE_KM =
        45;

    const DEFAULT_CLUSTER_TIME_MS =
        45 * 60 * 1000;

    const DEFAULT_MIN_CLUSTER_POINTS =
        1;

    const DEFAULT_MAX_CLUSTER_RADIUS_KM =
        150;

    const FUSION_STATUS = Object.freeze({
        CREATED: "created",
        UPDATED: "updated",
        MERGED: "merged",
        REJECTED: "rejected",
        DUPLICATE: "duplicate"
    });

    /* ======================================================================
       SECTION 36
       GENERAL FUSION HELPERS
       ====================================================================== */

    function getRecordLatitude(record) {
        return toFiniteNumber(
            record?.latitude ??
            record?.lat,
            NaN
        );
    }

    function getRecordLongitude(record) {
        return toFiniteNumber(
            record?.longitude ??
            record?.lon ??
            record?.lng,
            NaN
        );
    }

    function hasValidCoordinates(record) {
        return (
            Number.isFinite(
                getRecordLatitude(record)
            ) &&
            Number.isFinite(
                getRecordLongitude(record)
            )
        );
    }

    function calculateRecordDistanceKm(
        recordA,
        recordB
    ) {
        if (
            !hasValidCoordinates(recordA) ||
            !hasValidCoordinates(recordB)
        ) {
            return Infinity;
        }

        return calculateDistanceKm(
            getRecordLatitude(recordA),
            getRecordLongitude(recordA),
            getRecordLatitude(recordB),
            getRecordLongitude(recordB)
        );
    }

    function getObservationTimestamp(record) {
        return normalizeTimestamp(
            record?.timestamp ??
            record?.observedAt ??
            record?.time
        );
    }

    function getForecastTimestamp(record) {
        return normalizeTimestamp(
            record?.forecastTimestamp ??
            record?.validTime ??
            record?.timestamp ??
            record?.time
        );
    }

    function calculateTimeDifferenceMs(
        timestampA,
        timestampB
    ) {
        return Math.abs(
            normalizeTimestamp(timestampA) -
            normalizeTimestamp(timestampB)
        );
    }

    function calculateSourceReliability(
        core,
        record
    ) {
        const sourceName =
            record?.source ||
            SOURCE_NAMES.UNKNOWN;

        const sourceWeight =
            core.getSourceWeight(
                sourceName
            );

        const recordConfidence =
            normalizePercentage(
                record?.confidence ??
                sourceWeight
            );

        return clamp(
            sourceWeight * 0.60 +
            recordConfidence * 0.40,
            0,
            1
        );
    }

    function createFusionWeight(
        core,
        record
    ) {
        const reliability =
            calculateSourceReliability(
                core,
                record
            );

        const intensity =
            Math.max(
                0,
                toFiniteNumber(
                    record?.rainIntensity ??
                    record?.intensity,
                    0
                )
            );

        const intensityFactor =
            clamp(
                intensity / 25,
                0.25,
                1
            );

        return Math.max(
            0.01,
            reliability *
            intensityFactor
        );
    }

    function calculateCircularAverageDegrees(
        items,
        angleKey,
        weightKey
    ) {
        const validItems =
            safeArray(items)
                .filter((item) => {
                    return (
                        Number.isFinite(
                            Number(
                                item?.[angleKey]
                            )
                        ) &&
                        Number.isFinite(
                            Number(
                                item?.[weightKey]
                            )
                        ) &&
                        Number(
                            item?.[weightKey]
                        ) > 0
                    );
                });

        if (!validItems.length) {
            return 0;
        }

        let x = 0;
        let y = 0;

        validItems.forEach((item) => {
            const angleRadians =
                normalizeBearing(
                    item[angleKey]
                ) *
                Math.PI /
                180;

            const weight =
                Number(
                    item[weightKey]
                );

            x +=
                Math.cos(
                    angleRadians
                ) *
                weight;

            y +=
                Math.sin(
                    angleRadians
                ) *
                weight;
        });

        if (
            Math.abs(x) < 0.000001 &&
            Math.abs(y) < 0.000001
        ) {
            return 0;
        }

        return normalizeBearing(
            Math.atan2(y, x) *
            180 /
            Math.PI
        );
    }

    function selectStrongestRecord(
        core,
        records
    ) {
        const validRecords =
            safeArray(records);

        if (!validRecords.length) {
            return null;
        }

        return validRecords
            .slice()
            .sort((recordA, recordB) => {
                const reliabilityA =
                    calculateSourceReliability(
                        core,
                        recordA
                    );

                const reliabilityB =
                    calculateSourceReliability(
                        core,
                        recordB
                    );

                const intensityA =
                    toFiniteNumber(
                        recordA.rainIntensity ??
                        recordA.intensity,
                        0
                    );

                const intensityB =
                    toFiniteNumber(
                        recordB.rainIntensity ??
                        recordB.intensity,
                        0
                    );

                return (
                    reliabilityB * 0.7 +
                    intensityB * 0.3
                ) - (
                    reliabilityA * 0.7 +
                    intensityA * 0.3
                );
            })[0];
    }

    /* ======================================================================
       SECTION 37
       OBSERVATION DUPLICATE DETECTION
       ====================================================================== */

    CoreClass.prototype.areObservationsDuplicate =
        function areObservationsDuplicate(
            observationA,
            observationB,
            options = {}
        ) {
            if (
                !observationA ||
                !observationB
            ) {
                return false;
            }

            const safeOptions =
                safeObject(options);

            const maximumDistanceKm =
                Math.max(
                    0.1,
                    toFiniteNumber(
                        safeOptions.maximumDistanceKm,
                        DEFAULT_OBSERVATION_DUPLICATE_DISTANCE_KM
                    )
                );

            const maximumTimeDifferenceMs =
                Math.max(
                    1000,
                    toFiniteNumber(
                        safeOptions.maximumTimeDifferenceMs,
                        DEFAULT_OBSERVATION_DUPLICATE_TIME_MS
                    )
                );

            if (
                observationA.id &&
                observationB.id &&
                observationA.id ===
                observationB.id
            ) {
                return true;
            }

            if (
                observationA.locationId &&
                observationB.locationId &&
                observationA.locationId ===
                observationB.locationId
            ) {
                const timeDifference =
                    calculateTimeDifferenceMs(
                        getObservationTimestamp(
                            observationA
                        ),
                        getObservationTimestamp(
                            observationB
                        )
                    );

                return (
                    timeDifference <=
                    maximumTimeDifferenceMs
                );
            }

            const distanceKm =
                calculateRecordDistanceKm(
                    observationA,
                    observationB
                );

            const timeDifferenceMs =
                calculateTimeDifferenceMs(
                    getObservationTimestamp(
                        observationA
                    ),
                    getObservationTimestamp(
                        observationB
                    )
                );

            return (
                distanceKm <=
                maximumDistanceKm &&
                timeDifferenceMs <=
                maximumTimeDifferenceMs
            );
        };

    /* ======================================================================
       SECTION 38
       FORECAST DUPLICATE DETECTION
       ====================================================================== */

    CoreClass.prototype.areForecastsDuplicate =
        function areForecastsDuplicate(
            forecastA,
            forecastB,
            options = {}
        ) {
            if (
                !forecastA ||
                !forecastB
            ) {
                return false;
            }

            const safeOptions =
                safeObject(options);

            const maximumDistanceKm =
                Math.max(
                    0.1,
                    toFiniteNumber(
                        safeOptions.maximumDistanceKm,
                        DEFAULT_FORECAST_DUPLICATE_DISTANCE_KM
                    )
                );

            const maximumTimeDifferenceMs =
                Math.max(
                    1000,
                    toFiniteNumber(
                        safeOptions.maximumTimeDifferenceMs,
                        DEFAULT_FORECAST_DUPLICATE_TIME_MS
                    )
                );

            if (
                forecastA.id &&
                forecastB.id &&
                forecastA.id ===
                forecastB.id
            ) {
                return true;
            }

            if (
                forecastA.locationId &&
                forecastB.locationId &&
                forecastA.locationId ===
                forecastB.locationId
            ) {
                const timeDifference =
                    calculateTimeDifferenceMs(
                        getForecastTimestamp(
                            forecastA
                        ),
                        getForecastTimestamp(
                            forecastB
                        )
                    );

                return (
                    timeDifference <=
                    maximumTimeDifferenceMs
                );
            }

            const distanceKm =
                calculateRecordDistanceKm(
                    forecastA,
                    forecastB
                );

            const timeDifferenceMs =
                calculateTimeDifferenceMs(
                    getForecastTimestamp(
                        forecastA
                    ),
                    getForecastTimestamp(
                        forecastB
                    )
                );

            return (
                distanceKm <=
                maximumDistanceKm &&
                timeDifferenceMs <=
                maximumTimeDifferenceMs
            );
        };

    /* ======================================================================
       SECTION 39
       MERGE DUPLICATE OBSERVATIONS
       ====================================================================== */

    CoreClass.prototype.mergeObservationGroup =
        function mergeObservationGroup(
            observations
        ) {
            const validObservations =
                safeArray(observations)
                    .filter(
                        hasValidCoordinates
                    );

            if (!validObservations.length) {
                return null;
            }

            const weightedItems =
                validObservations.map(
                    (observation) => {
                        return {
                            ...observation,

                            fusionWeight:
                                createFusionWeight(
                                    this,
                                    observation
                                )
                        };
                    }
                );

            const strongestRecord =
                selectStrongestRecord(
                    this,
                    weightedItems
                );

            const sources =
                Array.from(
                    new Set(
                        weightedItems.map(
                            (item) => {
                                return (
                                    item.source ||
                                    SOURCE_NAMES.UNKNOWN
                                );
                            }
                        )
                    )
                );

            const sourceTypes =
                Array.from(
                    new Set(
                        weightedItems.map(
                            (item) => {
                                return (
                                    item.sourceType ||
                                    SOURCE_TYPES.UNKNOWN
                                );
                            }
                        )
                    )
                );

            const mergedTimestamp =
                Math.max(
                    ...weightedItems.map(
                        (item) => {
                            return getObservationTimestamp(
                                item
                            );
                        }
                    )
                );

            const mergedConfidence =
                clamp(
                    weightedAverage(
                        weightedItems.map(
                            (item) => {
                                return {
                                    value:
                                        normalizePercentage(
                                            item.confidence
                                        ),

                                    weight:
                                        item.fusionWeight
                                };
                            }
                        ),
                        "value",
                        "weight"
                    ) +
                    Math.min(
                        0.15,
                        Math.max(
                            0,
                            sources.length - 1
                        ) *
                        0.03
                    ),
                    0,
                    1
                );

            const mergedIntensity =
                weightedAverage(
                    weightedItems.map(
                        (item) => {
                            return {
                                value:
                                    Math.max(
                                        0,
                                        toFiniteNumber(
                                            item.rainIntensity,
                                            0
                                        )
                                    ),

                                weight:
                                    item.fusionWeight
                            };
                        }
                    ),
                    "value",
                    "weight"
                );

            const mergedProbability =
                clamp(
                    weightedAverage(
                        weightedItems.map(
                            (item) => {
                                return {
                                    value:
                                        normalizePercentage(
                                            item.rainProbability
                                        ),

                                    weight:
                                        item.fusionWeight
                                };
                            }
                        ),
                        "value",
                        "weight"
                    ),
                    0,
                    1
                );

            return {
                ...deepClone(
                    strongestRecord
                ),

                id:
                    createId(
                        "merged_observation"
                    ),

                source:
                    sources.length === 1
                        ? sources[0]
                        : "multi_source",

                sourceType:
                    sourceTypes.length === 1
                        ? sourceTypes[0]
                        : "multi_source",

                timestamp:
                    mergedTimestamp,

                latitude:
                    weightedAverage(
                        weightedItems,
                        "latitude",
                        "fusionWeight"
                    ),

                longitude:
                    weightedAverage(
                        weightedItems,
                        "longitude",
                        "fusionWeight"
                    ),

                rainIntensity:
                    mergedIntensity,

                rainProbability:
                    mergedProbability,

                rainingNow:
                    weightedItems.some(
                        (item) => {
                            return (
                                item.rainingNow ===
                                true ||
                                toFiniteNumber(
                                    item.rainIntensity,
                                    0
                                ) >
                                this.options
                                    .minRainIntensity
                            );
                        }
                    ),

                temperatureC:
                    weightedAverage(
                        weightedItems.filter(
                            (item) => {
                                return Number.isFinite(
                                    Number(
                                        item.temperatureC
                                    )
                                );
                            }
                        ),
                        "temperatureC",
                        "fusionWeight"
                    ),

                humidity:
                    clamp(
                        weightedAverage(
                            weightedItems,
                            "humidity",
                            "fusionWeight"
                        ),
                        0,
                        1
                    ),

                pressureHpa:
                    weightedAverage(
                        weightedItems.filter(
                            (item) => {
                                return Number.isFinite(
                                    Number(
                                        item.pressureHpa
                                    )
                                );
                            }
                        ),
                        "pressureHpa",
                        "fusionWeight"
                    ),

                windSpeedKmh:
                    weightedAverage(
                        weightedItems,
                        "windSpeedKmh",
                        "fusionWeight"
                    ),

                windDirectionDegrees:
                    calculateCircularAverageDegrees(
                        weightedItems,
                        "windDirectionDegrees",
                        "fusionWeight"
                    ),

                cloudCover:
                    clamp(
                        weightedAverage(
                            weightedItems,
                            "cloudCover",
                            "fusionWeight"
                        ),
                        0,
                        1
                    ),

                lightningCount:
                    Math.max(
                        ...weightedItems.map(
                            (item) => {
                                return Math.max(
                                    0,
                                    toFiniteNumber(
                                        item.lightningCount,
                                        0
                                    )
                                );
                            }
                        )
                    ),

                confidence:
                    mergedConfidence,

                fusion: {
                    status:
                        FUSION_STATUS.MERGED,

                    sourceCount:
                        sources.length,

                    sources,

                    recordCount:
                        weightedItems.length,

                    mergedAt:
                        Date.now()
                },

                metadata: {
                    ...safeObject(
                        strongestRecord?.metadata
                    ),

                    mergedObservationIds:
                        weightedItems.map(
                            (item) => item.id
                        )
                }
            };
        };

    /* ======================================================================
       SECTION 40
       DEDUPLICATE OBSERVATIONS
       ====================================================================== */

    CoreClass.prototype.deduplicateObservations =
        function deduplicateObservations(
            observations,
            options = {}
        ) {
            const remaining =
                safeArray(observations)
                    .filter(
                        hasValidCoordinates
                    )
                    .slice()
                    .sort((recordA, recordB) => {
                        return (
                            getObservationTimestamp(
                                recordB
                            ) -
                            getObservationTimestamp(
                                recordA
                            )
                        );
                    });

            const mergedObservations = [];

            while (remaining.length) {
                const seed =
                    remaining.shift();

                const duplicateGroup = [
                    seed
                ];

                for (
                    let index =
                        remaining.length - 1;
                    index >= 0;
                    index -= 1
                ) {
                    const candidate =
                        remaining[index];

                    const isDuplicate =
                        duplicateGroup.some(
                            (groupRecord) => {
                                return this
                                    .areObservationsDuplicate(
                                        groupRecord,
                                        candidate,
                                        options
                                    );
                            }
                        );

                    if (isDuplicate) {
                        duplicateGroup.push(
                            candidate
                        );

                        remaining.splice(
                            index,
                            1
                        );
                    }
                }

                const merged =
                    this.mergeObservationGroup(
                        duplicateGroup
                    );

                if (merged) {
                    mergedObservations.push(
                        merged
                    );
                }
            }

            return mergedObservations;
        };

    /* ======================================================================
       SECTION 41
       MERGE FORECAST GROUP
       ====================================================================== */

    CoreClass.prototype.mergeForecastGroup =
        function mergeForecastGroup(
            forecasts
        ) {
            const validForecasts =
                safeArray(forecasts)
                    .filter(
                        hasValidCoordinates
                    );

            if (!validForecasts.length) {
                return null;
            }

            const weightedItems =
                validForecasts.map(
                    (forecast) => {
                        return {
                            ...forecast,

                            fusionWeight:
                                createFusionWeight(
                                    this,
                                    forecast
                                )
                        };
                    }
                );

            const strongestRecord =
                selectStrongestRecord(
                    this,
                    weightedItems
                );

            const sources =
                Array.from(
                    new Set(
                        weightedItems.map(
                            (item) => {
                                return (
                                    item.source ||
                                    SOURCE_NAMES.UNKNOWN
                                );
                            }
                        )
                    )
                );

            const forecastTimestamp =
                Math.round(
                    weightedAverage(
                        weightedItems.map(
                            (item) => {
                                return {
                                    forecastTimestamp:
                                        getForecastTimestamp(
                                            item
                                        ),

                                    fusionWeight:
                                        item.fusionWeight
                                };
                            }
                        ),
                        "forecastTimestamp",
                        "fusionWeight"
                    )
                );

            const mergedConfidence =
                clamp(
                    weightedAverage(
                        weightedItems.map(
                            (item) => {
                                return {
                                    value:
                                        normalizePercentage(
                                            item.confidence
                                        ),

                                    weight:
                                        item.fusionWeight
                                };
                            }
                        ),
                        "value",
                        "weight"
                    ) +
                    Math.min(
                        0.15,
                        Math.max(
                            0,
                            sources.length - 1
                        ) *
                        0.025
                    ),
                    0,
                    1
                );

            return {
                ...deepClone(
                    strongestRecord
                ),

                id:
                    createId(
                        "merged_forecast"
                    ),

                source:
                    sources.length === 1
                        ? sources[0]
                        : "multi_source",

                sourceType:
                    "multi_source",

                generatedAt:
                    Math.max(
                        ...weightedItems.map(
                            (item) => {
                                return normalizeTimestamp(
                                    item.generatedAt
                                );
                            }
                        )
                    ),

                forecastTimestamp,

                latitude:
                    weightedAverage(
                        weightedItems,
                        "latitude",
                        "fusionWeight"
                    ),

                longitude:
                    weightedAverage(
                        weightedItems,
                        "longitude",
                        "fusionWeight"
                    ),

                rainIntensity:
                    weightedAverage(
                        weightedItems,
                        "rainIntensity",
                        "fusionWeight"
                    ),

                rainProbability:
                    clamp(
                        weightedAverage(
                            weightedItems,
                            "rainProbability",
                            "fusionWeight"
                        ),
                        0,
                        1
                    ),

                cloudCover:
                    clamp(
                        weightedAverage(
                            weightedItems,
                            "cloudCover",
                            "fusionWeight"
                        ),
                        0,
                        1
                    ),

                temperatureC:
                    weightedAverage(
                        weightedItems.filter(
                            (item) => {
                                return Number.isFinite(
                                    Number(
                                        item.temperatureC
                                    )
                                );
                            }
                        ),
                        "temperatureC",
                        "fusionWeight"
                    ),

                humidity:
                    clamp(
                        weightedAverage(
                            weightedItems,
                            "humidity",
                            "fusionWeight"
                        ),
                        0,
                        1
                    ),

                windSpeedKmh:
                    weightedAverage(
                        weightedItems,
                        "windSpeedKmh",
                        "fusionWeight"
                    ),

                windDirectionDegrees:
                    calculateCircularAverageDegrees(
                        weightedItems,
                        "windDirectionDegrees",
                        "fusionWeight"
                    ),

                confidence:
                    mergedConfidence,

                fusion: {
                    status:
                        FUSION_STATUS.MERGED,

                    sourceCount:
                        sources.length,

                    sources,

                    recordCount:
                        weightedItems.length,

                    mergedAt:
                        Date.now()
                },

                metadata: {
                    ...safeObject(
                        strongestRecord?.metadata
                    ),

                    mergedForecastIds:
                        weightedItems.map(
                            (item) => item.id
                        )
                }
            };
        };

    /* ======================================================================
       SECTION 42
       DEDUPLICATE FORECASTS
       ====================================================================== */

    CoreClass.prototype.deduplicateForecasts =
        function deduplicateForecasts(
            forecasts,
            options = {}
        ) {
            const remaining =
                safeArray(forecasts)
                    .filter(
                        hasValidCoordinates
                    )
                    .slice()
                    .sort((recordA, recordB) => {
                        return (
                            getForecastTimestamp(
                                recordA
                            ) -
                            getForecastTimestamp(
                                recordB
                            )
                        );
                    });

            const mergedForecasts = [];

            while (remaining.length) {
                const seed =
                    remaining.shift();

                const duplicateGroup = [
                    seed
                ];

                for (
                    let index =
                        remaining.length - 1;
                    index >= 0;
                    index -= 1
                ) {
                    const candidate =
                        remaining[index];

                    const isDuplicate =
                        duplicateGroup.some(
                            (groupRecord) => {
                                return this
                                    .areForecastsDuplicate(
                                        groupRecord,
                                        candidate,
                                        options
                                    );
                            }
                        );

                    if (isDuplicate) {
                        duplicateGroup.push(
                            candidate
                        );

                        remaining.splice(
                            index,
                            1
                        );
                    }
                }

                const merged =
                    this.mergeForecastGroup(
                        duplicateGroup
                    );

                if (merged) {
                    mergedForecasts.push(
                        merged
                    );
                }
            }

            return mergedForecasts;
        };

    /* ======================================================================
       SECTION 43
       RAIN POINT EXTRACTION
       ====================================================================== */

    CoreClass.prototype.extractRainPoints =
        function extractRainPoints(
            observations,
            forecasts,
            sourceCells
        ) {
            const points = [];

            safeArray(observations)
                .forEach((observation) => {
                    const intensity =
                        Math.max(
                            0,
                            toFiniteNumber(
                                observation
                                    .rainIntensity,
                                0
                            )
                        );

                    const probability =
                        normalizePercentage(
                            observation
                                .rainProbability
                        );

                    const isRainPoint =
                        observation
                            .rainingNow === true ||
                        intensity >=
                        this.options
                            .minRainIntensity ||
                        probability >= 0.6;

                    if (
                        isRainPoint &&
                        hasValidCoordinates(
                            observation
                        )
                    ) {
                        points.push({
                            id:
                                observation.id,

                            pointType:
                                "observation",

                            source:
                                observation.source,

                            sourceType:
                                observation.sourceType,

                            timestamp:
                                getObservationTimestamp(
                                    observation
                                ),

                            latitude:
                                observation.latitude,

                            longitude:
                                observation.longitude,

                            intensity,

                            probability,

                            radiusKm:
                                Math.max(
                                    4,
                                    toFiniteNumber(
                                        observation
                                            .metadata
                                            ?.radiusKm,
                                        8
                                    )
                                ),

                            confidence:
                                normalizePercentage(
                                    observation
                                        .confidence
                                ),

                            windSpeedKmh:
                                Math.max(
                                    0,
                                    toFiniteNumber(
                                        observation
                                            .windSpeedKmh,
                                        0
                                    )
                                ),

                            windDirectionDegrees:
                                normalizeBearing(
                                    observation
                                        .windDirectionDegrees
                                ),

                            original:
                                observation
                        });
                    }
                });

            safeArray(forecasts)
                .forEach((forecast) => {
                    const forecastTimestamp =
                        getForecastTimestamp(
                            forecast
                        );

                    const horizonHours =
                        (
                            forecastTimestamp -
                            Date.now()
                        ) /
                        (
                            60 *
                            60 *
                            1000
                        );

                    if (
                        horizonHours < -1 ||
                        horizonHours >
                        this.options.maxEtaHours
                    ) {
                        return;
                    }

                    const intensity =
                        Math.max(
                            0,
                            toFiniteNumber(
                                forecast
                                    .rainIntensity,
                                0
                            )
                        );

                    const probability =
                        normalizePercentage(
                            forecast
                                .rainProbability
                        );

                    if (
                        (
                            intensity >=
                            this.options
                                .minRainIntensity ||
                            probability >= 0.55
                        ) &&
                        hasValidCoordinates(
                            forecast
                        )
                    ) {
                        points.push({
                            id:
                                forecast.id,

                            pointType:
                                "forecast",

                            source:
                                forecast.source,

                            sourceType:
                                forecast.sourceType,

                            timestamp:
                                forecastTimestamp,

                            latitude:
                                forecast.latitude,

                            longitude:
                                forecast.longitude,

                            intensity,

                            probability,

                            radiusKm:
                                Math.max(
                                    6,
                                    toFiniteNumber(
                                        forecast
                                            .metadata
                                            ?.radiusKm,
                                        12
                                    )
                                ),

                            confidence:
                                normalizePercentage(
                                    forecast
                                        .confidence
                                ),

                            windSpeedKmh:
                                Math.max(
                                    0,
                                    toFiniteNumber(
                                        forecast
                                            .windSpeedKmh,
                                        0
                                    )
                                ),

                            windDirectionDegrees:
                                normalizeBearing(
                                    forecast
                                        .windDirectionDegrees
                                ),

                            original:
                                forecast
                        });
                    }
                });

            safeArray(sourceCells)
                .forEach((cell) => {
                    if (
                        !hasValidCoordinates(cell)
                    ) {
                        return;
                    }

                    points.push({
                        id:
                            cell.id,

                        pointType:
                            "source_cell",

                        source:
                            cell.source,

                        sourceType:
                            cell.sourceType,

                        timestamp:
                            normalizeTimestamp(
                                cell.timestamp
                            ),

                        latitude:
                            cell.latitude,

                        longitude:
                            cell.longitude,

                        intensity:
                            Math.max(
                                0,
                                toFiniteNumber(
                                    cell.intensity,
                                    0
                                )
                            ),

                        probability:
                            normalizePercentage(
                                cell.probability
                            ),

                        radiusKm:
                            Math.max(
                                1,
                                toFiniteNumber(
                                    cell.radiusKm,
                                    15
                                )
                            ),

                        confidence:
                            normalizePercentage(
                                cell.confidence
                            ),

                        windSpeedKmh:
                            Math.max(
                                0,
                                toFiniteNumber(
                                    cell.speedKmh,
                                    0
                                )
                            ),

                        windDirectionDegrees:
                            normalizeBearing(
                                cell.directionDegrees
                            ),

                        original:
                            cell
                    });
                });

            return points;
        };

    /* ======================================================================
       SECTION 44
       RAIN POINT CLUSTER MATCHING
       ====================================================================== */

    CoreClass.prototype.canRainPointJoinCluster =
        function canRainPointJoinCluster(
            point,
            cluster,
            options = {}
        ) {
            if (
                !point ||
                !cluster ||
                !safeArray(
                    cluster.points
                ).length
            ) {
                return false;
            }

            const safeOptions =
                safeObject(options);

            const maximumDistanceKm =
                Math.max(
                    1,
                    toFiniteNumber(
                        safeOptions
                            .maximumDistanceKm,
                        DEFAULT_CLUSTER_DISTANCE_KM
                    )
                );

            const maximumTimeDifferenceMs =
                Math.max(
                    60 * 1000,
                    toFiniteNumber(
                        safeOptions
                            .maximumTimeDifferenceMs,
                        DEFAULT_CLUSTER_TIME_MS
                    )
                );

            const distanceKm =
                calculateDistanceKm(
                    point.latitude,
                    point.longitude,
                    cluster.latitude,
                    cluster.longitude
                );

            const timeDifferenceMs =
                Math.abs(
                    normalizeTimestamp(
                        point.timestamp
                    ) -
                    normalizeTimestamp(
                        cluster.timestamp
                    )
                );

            const adaptiveDistanceKm =
                maximumDistanceKm +
                Math.max(
                    0,
                    toFiniteNumber(
                        point.radiusKm,
                        0
                    )
                ) +
                Math.max(
                    0,
                    toFiniteNumber(
                        cluster.radiusKm,
                        0
                    )
                ) *
                0.25;

            return (
                distanceKm <=
                adaptiveDistanceKm &&
                timeDifferenceMs <=
                maximumTimeDifferenceMs
            );
        };

    /* ======================================================================
       SECTION 45
       RECALCULATE CLUSTER
       ====================================================================== */

    CoreClass.prototype.recalculateRainCluster =
        function recalculateRainCluster(
            cluster
        ) {
            const points =
                safeArray(
                    cluster?.points
                );

            if (!points.length) {
                return null;
            }

            const weightedPoints =
                points.map((point) => {
                    return {
                        ...point,

                        fusionWeight:
                            createFusionWeight(
                                this,
                                {
                                    source:
                                        point.source,

                                    confidence:
                                        point.confidence,

                                    intensity:
                                        point.intensity,

                                    rainIntensity:
                                        point.intensity
                                }
                            )
                    };
                });

            const latitude =
                weightedAverage(
                    weightedPoints,
                    "latitude",
                    "fusionWeight"
                );

            const longitude =
                weightedAverage(
                    weightedPoints,
                    "longitude",
                    "fusionWeight"
                );

            const timestamp =
                Math.max(
                    ...weightedPoints.map(
                        (point) => {
                            return normalizeTimestamp(
                                point.timestamp
                            );
                        }
                    )
                );

            const radiusValues =
                weightedPoints.map(
                    (point) => {
                        const centerDistance =
                            calculateDistanceKm(
                                latitude,
                                longitude,
                                point.latitude,
                                point.longitude
                            );

                        return (
                            centerDistance +
                            Math.max(
                                1,
                                toFiniteNumber(
                                    point.radiusKm,
                                    1
                                )
                            )
                        );
                    }
                );

            const radiusKm =
                clamp(
                    Math.max(
                        ...radiusValues,
                        5
                    ),
                    5,
                    DEFAULT_MAX_CLUSTER_RADIUS_KM
                );

            const sources =
                Array.from(
                    new Set(
                        weightedPoints.map(
                            (point) => {
                                return (
                                    point.source ||
                                    SOURCE_NAMES.UNKNOWN
                                );
                            }
                        )
                    )
                );

            const pointTypes =
                Array.from(
                    new Set(
                        weightedPoints.map(
                            (point) => {
                                return point.pointType;
                            }
                        )
                    )
                );

            const confidence =
                clamp(
                    weightedAverage(
                        weightedPoints.map(
                            (point) => {
                                return {
                                    confidence:
                                        normalizePercentage(
                                            point.confidence
                                        ),

                                    fusionWeight:
                                        point.fusionWeight
                                };
                            }
                        ),
                        "confidence",
                        "fusionWeight"
                    ) +
                    Math.min(
                        0.18,
                        Math.max(
                            0,
                            sources.length - 1
                        ) *
                        0.035
                    ),
                    0,
                    1
                );

            return {
                ...cluster,

                latitude,

                longitude,

                timestamp,

                radiusKm,

                intensity:
                    weightedAverage(
                        weightedPoints,
                        "intensity",
                        "fusionWeight"
                    ),

                maxIntensity:
                    Math.max(
                        ...weightedPoints.map(
                            (point) => {
                                return Math.max(
                                    0,
                                    toFiniteNumber(
                                        point.intensity,
                                        0
                                    )
                                );
                            }
                        )
                    ),

                probability:
                    clamp(
                        weightedAverage(
                            weightedPoints,
                            "probability",
                            "fusionWeight"
                        ),
                        0,
                        1
                    ),

                speedKmh:
                    weightedAverage(
                        weightedPoints,
                        "windSpeedKmh",
                        "fusionWeight"
                    ),

                directionDegrees:
                    calculateCircularAverageDegrees(
                        weightedPoints,
                        "windDirectionDegrees",
                        "fusionWeight"
                    ),

                confidence,

                sources,

                pointTypes,

                sourceCount:
                    sources.length,

                pointCount:
                    weightedPoints.length,

                updatedAt:
                    Date.now()
            };
        };

    /* ======================================================================
       SECTION 46
       BUILD RAIN CLUSTERS
       ====================================================================== */

    CoreClass.prototype.clusterRainPoints =
        function clusterRainPoints(
            rainPoints,
            options = {}
        ) {
            const safeOptions =
                safeObject(options);

            const minimumClusterPoints =
                Math.max(
                    1,
                    Math.round(
                        toFiniteNumber(
                            safeOptions
                                .minimumClusterPoints,
                            DEFAULT_MIN_CLUSTER_POINTS
                        )
                    )
                );

            const sortedPoints =
                safeArray(rainPoints)
                    .filter(
                        hasValidCoordinates
                    )
                    .slice()
                    .sort((pointA, pointB) => {
                        return (
                            normalizeTimestamp(
                                pointB.timestamp
                            ) -
                            normalizeTimestamp(
                                pointA.timestamp
                            )
                        );
                    });

            const clusters = [];

            sortedPoints.forEach(
                (point) => {
                    let selectedCluster =
                        null;

                    let selectedDistance =
                        Infinity;

                    clusters.forEach(
                        (cluster) => {
                            const canJoin =
                                this.canRainPointJoinCluster(
                                    point,
                                    cluster,
                                    safeOptions
                                );

                            if (!canJoin) {
                                return;
                            }

                            const distance =
                                calculateDistanceKm(
                                    point.latitude,
                                    point.longitude,
                                    cluster.latitude,
                                    cluster.longitude
                                );

                            if (
                                distance <
                                selectedDistance
                            ) {
                                selectedDistance =
                                    distance;

                                selectedCluster =
                                    cluster;
                            }
                        }
                    );

                    if (!selectedCluster) {
                        const newCluster = {
                            id:
                                createId(
                                    "rain_cluster"
                                ),

                            latitude:
                                point.latitude,

                            longitude:
                                point.longitude,

                            timestamp:
                                normalizeTimestamp(
                                    point.timestamp
                                ),

                            radiusKm:
                                Math.max(
                                    5,
                                    toFiniteNumber(
                                        point.radiusKm,
                                        5
                                    )
                                ),

                            points: [
                                point
                            ],

                            createdAt:
                                Date.now(),

                            updatedAt:
                                Date.now()
                        };

                        clusters.push(
                            this.recalculateRainCluster(
                                newCluster
                            )
                        );

                        return;
                    }

                    selectedCluster.points.push(
                        point
                    );

                    const recalculated =
                        this.recalculateRainCluster(
                            selectedCluster
                        );

                    Object.assign(
                        selectedCluster,
                        recalculated
                    );
                }
            );

            return clusters.filter(
                (cluster) => {
                    return (
                        cluster.pointCount >=
                        minimumClusterPoints
                    );
                }
            );
        };

    /* ======================================================================
       SECTION 47
       CONVERT CLUSTER TO UNIFIED RAIN CELL
       ====================================================================== */

    CoreClass.prototype.convertClusterToRainCell =
        function convertClusterToRainCell(
            cluster
        ) {
            if (
                !cluster ||
                !safeArray(
                    cluster.points
                ).length
            ) {
                return null;
            }

            const now =
                Date.now();

            const hasObservation =
                cluster.pointTypes
                    ?.includes(
                        "observation"
                    );

            const hasSourceCell =
                cluster.pointTypes
                    ?.includes(
                        "source_cell"
                    );

            const status =
                cluster.intensity >= 10
                    ? CELL_STATUS.STRENGTHENING
                    : cluster.intensity > 0
                        ? CELL_STATUS.ACTIVE
                        : CELL_STATUS.WEAKENING;

            return {
                id:
                    createId(
                        "unified_cell"
                    ),

                trackingId:
                    null,

                source:
                    cluster.sourceCount > 1
                        ? "multi_source"
                        : (
                            cluster.sources?.[0] ||
                            SOURCE_NAMES.UNKNOWN
                        ),

                sourceType:
                    hasSourceCell
                        ? SOURCE_TYPES.RADAR
                        : hasObservation
                            ? SOURCE_TYPES.OBSERVATION
                            : SOURCE_TYPES.FORECAST,

                sources:
                    deepClone(
                        cluster.sources ||
                        []
                    ),

                timestamp:
                    cluster.timestamp,

                detectedAt:
                    now,

                updatedAt:
                    now,

                latitude:
                    cluster.latitude,

                longitude:
                    cluster.longitude,

                radiusKm:
                    cluster.radiusKm,

                areaKm2:
                    Math.PI *
                    Math.pow(
                        cluster.radiusKm,
                        2
                    ),

                intensity:
                    Math.max(
                        0,
                        cluster.intensity
                    ),

                maxIntensity:
                    Math.max(
                        0,
                        cluster.maxIntensity
                    ),

                probability:
                    clamp(
                        cluster.probability,
                        0,
                        1
                    ),

                speedKmh:
                    clamp(
                        cluster.speedKmh,
                        0,
                        this.options
                            .maxCellSpeedKmh
                    ),

                directionDegrees:
                    normalizeBearing(
                        cluster.directionDegrees
                    ),

                status,

                confidence:
                    clamp(
                        cluster.confidence,
                        0,
                        1
                    ),

                pointCount:
                    cluster.pointCount,

                sourceCount:
                    cluster.sourceCount,

                pointTypes:
                    deepClone(
                        cluster.pointTypes ||
                        []
                    ),

                history: [],

                polygon: [],

                metadata: {
                    clusterId:
                        cluster.id,

                    sourcePointIds:
                        cluster.points.map(
                            (point) => {
                                return point.id;
                            }
                        ),

                    generatedBy:
                        "recovery_core_v32",

                    generatedAt:
                        now
                }
            };
        };

    /* ======================================================================
       SECTION 48
       BUILD UNIFIED RAIN CELLS
       ====================================================================== */

    CoreClass.prototype.buildUnifiedRainCells =
        function buildUnifiedRainCells(
            options = {}
        ) {
            const safeOptions =
                safeObject(options);

            const observations =
                safeArray(
                    safeOptions.observations
                ).length
                    ? safeOptions.observations
                    : this.state.observations;

            const forecasts =
                safeArray(
                    safeOptions.forecasts
                ).length
                    ? safeOptions.forecasts
                    : this.state.forecasts;

            const sourceCells =
                safeArray(
                    safeOptions.sourceCells
                ).length
                    ? safeOptions.sourceCells
                    : this.state.sourceResults
                        .flatMap((result) => {
                            return safeArray(
                                result.rainCells
                            );
                        });

            const mergedObservations =
                this.deduplicateObservations(
                    observations,
                    safeOptions
                        .observationDeduplication
                );

            const mergedForecasts =
                this.deduplicateForecasts(
                    forecasts,
                    safeOptions
                        .forecastDeduplication
                );

            const rainPoints =
                this.extractRainPoints(
                    mergedObservations,
                    mergedForecasts,
                    sourceCells
                );

            const clusters =
                this.clusterRainPoints(
                    rainPoints,
                    safeOptions.clustering
                );

            const unifiedCells =
                clusters
                    .map((cluster) => {
                        return this
                            .convertClusterToRainCell(
                                cluster
                            );
                    })
                    .filter(Boolean);

            return {
                generatedAt:
                    Date.now(),

                observations:
                    mergedObservations,

                forecasts:
                    mergedForecasts,

                rainPoints,

                clusters,

                rainCells:
                    unifiedCells,

                summary: {
                    originalObservationCount:
                        observations.length,

                    mergedObservationCount:
                        mergedObservations.length,

                    originalForecastCount:
                        forecasts.length,

                    mergedForecastCount:
                        mergedForecasts.length,

                    sourceCellCount:
                        sourceCells.length,

                    rainPointCount:
                        rainPoints.length,

                    clusterCount:
                        clusters.length,

                    unifiedCellCount:
                        unifiedCells.length
                }
            };
        };

    /* ======================================================================
       SECTION 49
       APPLY FUSION RESULTS TO CORE STATE
       ====================================================================== */

    CoreClass.prototype.applyFusionResults =
        function applyFusionResults(
            fusionResults
        ) {
            const safeResults =
                safeObject(
                    fusionResults
                );

            this.state.observations =
                deepClone(
                    safeArray(
                        safeResults.observations
                    )
                );

            this.state.forecasts =
                deepClone(
                    safeArray(
                        safeResults.forecasts
                    )
                );

            const rainCells =
                safeArray(
                    safeResults.rainCells
                );

            this.state.rainCells =
                deepClone(
                    rainCells
                );

            this.state.diagnostics
                .trackedCellCount =
                rainCells.length;

            this.state.diagnostics
                .fusionSummary =
                deepClone(
                    safeObject(
                        safeResults.summary
                    )
                );

            this.emit(
                CORE_EVENTS.CELLS_UPDATED,
                {
                    cellCount:
                        rainCells.length,

                    summary:
                        deepClone(
                            safeResults.summary
                        ),

                    rainCells:
                        deepClone(
                            rainCells
                        )
                }
            );

            return {
                observationCount:
                    this.state
                        .observations
                        .length,

                forecastCount:
                    this.state
                        .forecasts
                        .length,

                rainCellCount:
                    this.state
                        .rainCells
                        .length
            };
        };

    /* ======================================================================
       SECTION 50
       EXECUTE COMPLETE FUSION
       ====================================================================== */

    CoreClass.prototype.executeSourceFusion =
        function executeSourceFusion(
            options = {}
        ) {
            const fusionResults =
                this.buildUnifiedRainCells(
                    options
                );

            this.applyFusionResults(
                fusionResults
            );

            return deepClone(
                fusionResults
            );
        };

    /* ======================================================================
       SECTION 51
       GET FUSION SUMMARY
       ====================================================================== */

    CoreClass.prototype.getFusionSummary =
        function getFusionSummary() {
            return {
                generatedAt:
                    Date.now(),

                observationCount:
                    this.state
                        .observations
                        .length,

                forecastCount:
                    this.state
                        .forecasts
                        .length,

                rainCellCount:
                    this.state
                        .rainCells
                        .length,

                sourceCount:
                    Object.keys(
                        this.state.sources ||
                        {}
                    ).length,

                diagnostics:
                    deepClone(
                        this.state
                            .diagnostics
                            .fusionSummary ||
                        {}
                    )
            };
        };

    /* ======================================================================
       SECTION 52
       PART 4 EXPORT
       ====================================================================== */

    global.RainArrivalRecoveryCoreV32Part4 = {
        DEFAULT_OBSERVATION_DUPLICATE_DISTANCE_KM,
        DEFAULT_OBSERVATION_DUPLICATE_TIME_MS,
        DEFAULT_FORECAST_DUPLICATE_DISTANCE_KM,
        DEFAULT_FORECAST_DUPLICATE_TIME_MS,
        DEFAULT_CLUSTER_DISTANCE_KM,
        DEFAULT_CLUSTER_TIME_MS,
        DEFAULT_MIN_CLUSTER_POINTS,
        DEFAULT_MAX_CLUSTER_RADIUS_KM,
        FUSION_STATUS,
        hasValidCoordinates,
        calculateRecordDistanceKm,
        calculateTimeDifferenceMs,
        calculateCircularAverageDegrees
    };

})(window);

/* ==========================================================================
   RainGuard AI
   Rain Arrival Recovery Core V32

   PART 5
   Rain Cell Tracking + Stable Tracking IDs + Speed + Direction Calculation
   ========================================================================== */

(function extendRainArrivalRecoveryCoreV32Part5(global) {
    "use strict";

    const CoreClass =
        global.RainArrivalRecoveryCoreV32;

    const Utils =
        global.RainArrivalRecoveryCoreV32Utils;

    const Constants =
        global.RainArrivalRecoveryCoreV32Constants;

    if (
        typeof CoreClass !== "function" ||
        !Utils ||
        !Constants
    ) {
        throw new Error(
            "RainArrivalRecoveryCoreV32 Parts 1 to 4 must be loaded before Part 5."
        );
    }

    const {
        toFiniteNumber,
        clamp,
        normalizePercentage,
        normalizeTimestamp,
        normalizeBearing,
        createId,
        safeArray,
        safeObject,
        deepClone,
        average,
        calculateDistanceKm,
        calculateBearingDegrees,
        calculateAngularDifference
    } = Utils;

    const {
        CELL_STATUS,
        MOVEMENT_STATUS,
        CORE_EVENTS
    } = Constants;

    /* ======================================================================
       SECTION 53
       TRACKING CONSTANTS
       ====================================================================== */

    const DEFAULT_TRACKING_DISTANCE_KM =
        120;

    const DEFAULT_TRACKING_TIME_MS =
        90 * 60 * 1000;

    const DEFAULT_DIRECTION_TOLERANCE_DEGREES =
        70;

    const DEFAULT_RADIUS_CHANGE_TOLERANCE =
        0.75;

    const DEFAULT_INTENSITY_CHANGE_TOLERANCE =
        1.50;

    const DEFAULT_MIN_TRACKING_SCORE =
        0.30;

    const DEFAULT_STRONG_TRACKING_SCORE =
        0.68;

    const DEFAULT_STATIONARY_SPEED_KMH =
        3;

    const DEFAULT_ACCELERATION_THRESHOLD_KMH =
        8;

    const DEFAULT_DIRECTION_CHANGE_THRESHOLD =
        30;

    const DEFAULT_HISTORY_LIMIT =
        30;

    const TRACKING_MATCH_STATUS = Object.freeze({
        STRONG: "strong",
        ACCEPTABLE: "acceptable",
        WEAK: "weak",
        REJECTED: "rejected"
    });

    /* ======================================================================
       SECTION 54
       TRACKING HELPERS
       ====================================================================== */

    function hasCoordinates(cell) {
        return (
            Number.isFinite(
                Number(cell?.latitude)
            ) &&
            Number.isFinite(
                Number(cell?.longitude)
            )
        );
    }

    function getCellTimestamp(cell) {
        return normalizeTimestamp(
            cell?.timestamp ??
            cell?.updatedAt ??
            cell?.detectedAt ??
            Date.now()
        );
    }

    function getCellIntensity(cell) {
        return Math.max(
            0,
            toFiniteNumber(
                cell?.intensity ??
                cell?.rainIntensity,
                0
            )
        );
    }

    function getCellRadiusKm(cell) {
        return Math.max(
            1,
            toFiniteNumber(
                cell?.radiusKm ??
                cell?.radius,
                10
            )
        );
    }

    function calculateRelativeDifference(
        valueA,
        valueB,
        minimumReference = 1
    ) {
        const first =
            Math.abs(
                toFiniteNumber(
                    valueA,
                    0
                )
            );

        const second =
            Math.abs(
                toFiniteNumber(
                    valueB,
                    0
                )
            );

        const reference =
            Math.max(
                first,
                second,
                minimumReference
            );

        return Math.abs(
            first - second
        ) / reference;
    }

    function normalizeTrackingHistoryPoint(cell) {
        if (!cell || !hasCoordinates(cell)) {
            return null;
        }

        return {
            timestamp:
                getCellTimestamp(cell),

            latitude:
                Number(cell.latitude),

            longitude:
                Number(cell.longitude),

            intensity:
                getCellIntensity(cell),

            radiusKm:
                getCellRadiusKm(cell),

            speedKmh:
                Math.max(
                    0,
                    toFiniteNumber(
                        cell.speedKmh,
                        0
                    )
                ),

            directionDegrees:
                normalizeBearing(
                    cell.directionDegrees
                ),

            confidence:
                normalizePercentage(
                    cell.confidence
                ),

            sourceCount:
                Math.max(
                    0,
                    toFiniteNumber(
                        cell.sourceCount,
                        safeArray(
                            cell.sources
                        ).length
                    )
                )
        };
    }

    function calculateSpeedKmh(
        previousCell,
        currentCell
    ) {
        if (
            !hasCoordinates(previousCell) ||
            !hasCoordinates(currentCell)
        ) {
            return 0;
        }

        const previousTimestamp =
            getCellTimestamp(
                previousCell
            );

        const currentTimestamp =
            getCellTimestamp(
                currentCell
            );

        const elapsedHours =
            (
                currentTimestamp -
                previousTimestamp
            ) /
            (
                60 *
                60 *
                1000
            );

        if (elapsedHours <= 0) {
            return 0;
        }

        const distanceKm =
            calculateDistanceKm(
                previousCell.latitude,
                previousCell.longitude,
                currentCell.latitude,
                currentCell.longitude
            );

        return distanceKm / elapsedHours;
    }

    function calculateMovementDirection(
        previousCell,
        currentCell
    ) {
        if (
            !hasCoordinates(previousCell) ||
            !hasCoordinates(currentCell)
        ) {
            return 0;
        }

        return calculateBearingDegrees(
            previousCell.latitude,
            previousCell.longitude,
            currentCell.latitude,
            currentCell.longitude
        );
    }

    function calculateIntensityTrend(
        previousIntensity,
        currentIntensity
    ) {
        const previous =
            Math.max(
                0,
                toFiniteNumber(
                    previousIntensity,
                    0
                )
            );

        const current =
            Math.max(
                0,
                toFiniteNumber(
                    currentIntensity,
                    0
                )
            );

        const difference =
            current - previous;

        const relativeDifference =
            difference /
            Math.max(
                previous,
                0.1
            );

        if (
            difference >= 1 &&
            relativeDifference >= 0.15
        ) {
            return "strengthening";
        }

        if (
            difference <= -1 &&
            relativeDifference <= -0.15
        ) {
            return "weakening";
        }

        return "stable";
    }

    function calculateRadiusTrend(
        previousRadius,
        currentRadius
    ) {
        const previous =
            Math.max(
                1,
                toFiniteNumber(
                    previousRadius,
                    1
                )
            );

        const current =
            Math.max(
                1,
                toFiniteNumber(
                    currentRadius,
                    1
                )
            );

        const ratio =
            (
                current -
                previous
            ) /
            previous;

        if (ratio >= 0.15) {
            return "expanding";
        }

        if (ratio <= -0.15) {
            return "contracting";
        }

        return "stable";
    }

    /* ======================================================================
       SECTION 55
       TRACKING OPTION NORMALIZATION
       ====================================================================== */

    CoreClass.prototype.normalizeTrackingOptions =
        function normalizeTrackingOptions(
            options = {}
        ) {
            const safeOptions =
                safeObject(options);

            return {
                maximumDistanceKm:
                    Math.max(
                        5,
                        toFiniteNumber(
                            safeOptions.maximumDistanceKm,
                            this.options
                                .cellMatchDistanceKm ||
                            DEFAULT_TRACKING_DISTANCE_KM
                        )
                    ),

                maximumTimeDifferenceMs:
                    Math.max(
                        60 * 1000,
                        toFiniteNumber(
                            safeOptions.maximumTimeDifferenceMs,
                            DEFAULT_TRACKING_TIME_MS
                        )
                    ),

                directionToleranceDegrees:
                    clamp(
                        toFiniteNumber(
                            safeOptions.directionToleranceDegrees,
                            DEFAULT_DIRECTION_TOLERANCE_DEGREES
                        ),
                        1,
                        180
                    ),

                radiusChangeTolerance:
                    Math.max(
                        0.05,
                        toFiniteNumber(
                            safeOptions.radiusChangeTolerance,
                            DEFAULT_RADIUS_CHANGE_TOLERANCE
                        )
                    ),

                intensityChangeTolerance:
                    Math.max(
                        0.05,
                        toFiniteNumber(
                            safeOptions.intensityChangeTolerance,
                            DEFAULT_INTENSITY_CHANGE_TOLERANCE
                        )
                    ),

                minimumTrackingScore:
                    clamp(
                        toFiniteNumber(
                            safeOptions.minimumTrackingScore,
                            DEFAULT_MIN_TRACKING_SCORE
                        ),
                        0,
                        1
                    ),

                strongTrackingScore:
                    clamp(
                        toFiniteNumber(
                            safeOptions.strongTrackingScore,
                            DEFAULT_STRONG_TRACKING_SCORE
                        ),
                        0,
                        1
                    ),

                historyLimit:
                    clamp(
                        Math.round(
                            toFiniteNumber(
                                safeOptions.historyLimit,
                                DEFAULT_HISTORY_LIMIT
                            )
                        ),
                        3,
                        200
                    )
            };
        };

    /* ======================================================================
       SECTION 56
       PREDICT PREVIOUS CELL POSITION
       ====================================================================== */

    CoreClass.prototype.predictPreviousCellPosition =
        function predictPreviousCellPosition(
            previousCell,
            targetTimestamp
        ) {
            if (
                !previousCell ||
                !hasCoordinates(
                    previousCell
                )
            ) {
                return null;
            }

            const previousTimestamp =
                getCellTimestamp(
                    previousCell
                );

            const targetTime =
                normalizeTimestamp(
                    targetTimestamp
                );

            const elapsedHours =
                Math.max(
                    0,
                    (
                        targetTime -
                        previousTimestamp
                    ) /
                    (
                        60 *
                        60 *
                        1000
                    )
                );

            const speedKmh =
                Math.max(
                    0,
                    toFiniteNumber(
                        previousCell.speedKmh,
                        0
                    )
                );

            const directionDegrees =
                normalizeBearing(
                    previousCell.directionDegrees
                );

            if (
                speedKmh <
                this.options
                    .minCellSpeedKmh ||
                elapsedHours <= 0
            ) {
                return {
                    latitude:
                        previousCell.latitude,

                    longitude:
                        previousCell.longitude,

                    elapsedHours,

                    projectedDistanceKm:
                        0
                };
            }

            const projectedDistanceKm =
                speedKmh *
                elapsedHours;

            const destination =
                Utils.calculateDestinationPoint(
                    previousCell.latitude,
                    previousCell.longitude,
                    directionDegrees,
                    projectedDistanceKm
                );

            return {
                ...destination,

                elapsedHours,

                projectedDistanceKm
            };
        };

    /* ======================================================================
       SECTION 57
       CALCULATE CELL MATCH SCORE
       ====================================================================== */

    CoreClass.prototype.calculateCellMatchScore =
        function calculateCellMatchScore(
            previousCell,
            currentCell,
            options = {}
        ) {
            if (
                !previousCell ||
                !currentCell ||
                !hasCoordinates(
                    previousCell
                ) ||
                !hasCoordinates(
                    currentCell
                )
            ) {
                return {
                    score: 0,
                    accepted: false,
                    status:
                        TRACKING_MATCH_STATUS.REJECTED
                };
            }

            const trackingOptions =
                this.normalizeTrackingOptions(
                    options
                );

            const previousTimestamp =
                getCellTimestamp(
                    previousCell
                );

            const currentTimestamp =
                getCellTimestamp(
                    currentCell
                );

            const timeDifferenceMs =
                Math.abs(
                    currentTimestamp -
                    previousTimestamp
                );

            if (
                timeDifferenceMs >
                trackingOptions
                    .maximumTimeDifferenceMs
            ) {
                return {
                    score: 0,
                    accepted: false,
                    status:
                        TRACKING_MATCH_STATUS.REJECTED,

                    reason:
                        "time_difference_exceeded",

                    timeDifferenceMs
                };
            }

            const predictedPosition =
                this.predictPreviousCellPosition(
                    previousCell,
                    currentTimestamp
                );

            const directDistanceKm =
                calculateDistanceKm(
                    previousCell.latitude,
                    previousCell.longitude,
                    currentCell.latitude,
                    currentCell.longitude
                );

            const projectedDistanceKm =
                predictedPosition
                    ? calculateDistanceKm(
                        predictedPosition.latitude,
                        predictedPosition.longitude,
                        currentCell.latitude,
                        currentCell.longitude
                    )
                    : directDistanceKm;

            const effectiveDistanceKm =
                Math.min(
                    directDistanceKm,
                    projectedDistanceKm
                );

            const adaptiveMaximumDistanceKm =
                trackingOptions
                    .maximumDistanceKm +
                getCellRadiusKm(
                    previousCell
                ) *
                0.5 +
                getCellRadiusKm(
                    currentCell
                ) *
                0.5;

            if (
                effectiveDistanceKm >
                adaptiveMaximumDistanceKm
            ) {
                return {
                    score: 0,
                    accepted: false,
                    status:
                        TRACKING_MATCH_STATUS.REJECTED,

                    reason:
                        "distance_exceeded",

                    directDistanceKm,

                    projectedDistanceKm,

                    effectiveDistanceKm,

                    adaptiveMaximumDistanceKm
                };
            }

            const distanceScore =
                clamp(
                    1 -
                    effectiveDistanceKm /
                    adaptiveMaximumDistanceKm,
                    0,
                    1
                );

            const movementBearing =
                directDistanceKm > 0.5
                    ? calculateMovementDirection(
                        previousCell,
                        currentCell
                    )
                    : normalizeBearing(
                        previousCell
                            .directionDegrees
                    );

            const previousDirection =
                normalizeBearing(
                    previousCell
                        .directionDegrees
                );

            const directionDifference =
                calculateAngularDifference(
                    previousDirection,
                    movementBearing
                );

            const directionScore =
                previousCell.speedKmh >=
                this.options.minCellSpeedKmh
                    ? clamp(
                        1 -
                        directionDifference /
                        trackingOptions
                            .directionToleranceDegrees,
                        0,
                        1
                    )
                    : 0.65;

            const radiusDifference =
                calculateRelativeDifference(
                    getCellRadiusKm(
                        previousCell
                    ),
                    getCellRadiusKm(
                        currentCell
                    )
                );

            const radiusScore =
                clamp(
                    1 -
                    radiusDifference /
                    trackingOptions
                        .radiusChangeTolerance,
                    0,
                    1
                );

            const intensityDifference =
                calculateRelativeDifference(
                    getCellIntensity(
                        previousCell
                    ),
                    getCellIntensity(
                        currentCell
                    ),
                    0.5
                );

            const intensityScore =
                clamp(
                    1 -
                    intensityDifference /
                    trackingOptions
                        .intensityChangeTolerance,
                    0,
                    1
                );

            const previousSources =
                new Set(
                    safeArray(
                        previousCell.sources
                    )
                );

            const currentSources =
                safeArray(
                    currentCell.sources
                );

            const sharedSourceCount =
                currentSources.filter(
                    (source) => {
                        return previousSources.has(
                            source
                        );
                    }
                ).length;

            const sourceScore =
                sharedSourceCount > 0
                    ? clamp(
                        0.55 +
                        sharedSourceCount *
                        0.15,
                        0,
                        1
                    )
                    : 0.35;

            const confidenceScore =
                average([
                    normalizePercentage(
                        previousCell.confidence
                    ),
                    normalizePercentage(
                        currentCell.confidence
                    )
                ]);

            const score =
                clamp(
                    distanceScore * 0.40 +
                    directionScore * 0.18 +
                    radiusScore * 0.12 +
                    intensityScore * 0.12 +
                    sourceScore * 0.08 +
                    confidenceScore * 0.10,
                    0,
                    1
                );

            const accepted =
                score >=
                trackingOptions
                    .minimumTrackingScore;

            let status =
                TRACKING_MATCH_STATUS.REJECTED;

            if (accepted) {
                status =
                    score >=
                    trackingOptions
                        .strongTrackingScore
                        ? TRACKING_MATCH_STATUS.STRONG
                        : score >= 0.48
                            ? TRACKING_MATCH_STATUS.ACCEPTABLE
                            : TRACKING_MATCH_STATUS.WEAK;
            }

            return {
                score,

                accepted,

                status,

                directDistanceKm,

                projectedDistanceKm,

                effectiveDistanceKm,

                adaptiveMaximumDistanceKm,

                timeDifferenceMs,

                distanceScore,

                directionScore,

                radiusScore,

                intensityScore,

                sourceScore,

                confidenceScore,

                movementBearing,

                directionDifference
            };
        };

    /* ======================================================================
       SECTION 58
       FIND BEST PREVIOUS CELL MATCH
       ====================================================================== */

    CoreClass.prototype.findBestPreviousCellMatch =
        function findBestPreviousCellMatch(
            currentCell,
            previousCells,
            usedTrackingIds = new Set(),
            options = {}
        ) {
            let bestMatch = null;

            safeArray(previousCells)
                .forEach((previousCell) => {
                    const trackingId =
                        previousCell.trackingId ||
                        previousCell.id;

                    if (
                        usedTrackingIds.has(
                            trackingId
                        )
                    ) {
                        return;
                    }

                    const match =
                        this.calculateCellMatchScore(
                            previousCell,
                            currentCell,
                            options
                        );

                    if (!match.accepted) {
                        return;
                    }

                    if (
                        !bestMatch ||
                        match.score >
                        bestMatch.match.score
                    ) {
                        bestMatch = {
                            previousCell,
                            match
                        };
                    }
                });

            return bestMatch;
        };

    /* ======================================================================
       SECTION 59
       CREATE NEW TRACKED CELL
       ====================================================================== */

    CoreClass.prototype.createTrackedCell =
        function createTrackedCell(
            currentCell,
            options = {}
        ) {
            const trackingOptions =
                this.normalizeTrackingOptions(
                    options
                );

            const trackingId =
                currentCell.trackingId ||
                createId(
                    "tracked_rain_cell"
                );

            const historyPoint =
                normalizeTrackingHistoryPoint(
                    currentCell
                );

            const history =
                historyPoint
                    ? [historyPoint]
                    : [];

            return {
                ...deepClone(
                    currentCell
                ),

                trackingId,

                firstDetectedAt:
                    getCellTimestamp(
                        currentCell
                    ),

                detectedAt:
                    currentCell.detectedAt ||
                    Date.now(),

                updatedAt:
                    Date.now(),

                lastMatchedAt:
                    Date.now(),

                previousLatitude:
                    null,

                previousLongitude:
                    null,

                previousTimestamp:
                    null,

                speedKmh:
                    clamp(
                        toFiniteNumber(
                            currentCell.speedKmh,
                            0
                        ),
                        0,
                        this.options
                            .maxCellSpeedKmh
                    ),

                directionDegrees:
                    normalizeBearing(
                        currentCell
                            .directionDegrees
                    ),

                movementStatus:
                    toFiniteNumber(
                        currentCell.speedKmh,
                        0
                    ) <=
                    DEFAULT_STATIONARY_SPEED_KMH
                        ? MOVEMENT_STATUS.STATIONARY
                        : MOVEMENT_STATUS.MOVING,

                accelerationKmh:
                    0,

                directionChangeDegrees:
                    0,

                intensityTrend:
                    "stable",

                radiusTrend:
                    "stable",

                ageMs:
                    0,

                missedCycles:
                    0,

                matchScore:
                    1,

                matchStatus:
                    TRACKING_MATCH_STATUS.STRONG,

                history:
                    history.slice(
                        -trackingOptions
                            .historyLimit
                    )
            };
        };

    /* ======================================================================
       SECTION 60
       UPDATE MATCHED TRACKED CELL
       ====================================================================== */

    CoreClass.prototype.updateTrackedCell =
        function updateTrackedCell(
            previousCell,
            currentCell,
            match,
            options = {}
        ) {
            const trackingOptions =
                this.normalizeTrackingOptions(
                    options
                );

            const previousTimestamp =
                getCellTimestamp(
                    previousCell
                );

            const currentTimestamp =
                getCellTimestamp(
                    currentCell
                );

            const calculatedSpeedKmh =
                calculateSpeedKmh(
                    previousCell,
                    currentCell
                );

            const calculatedDirection =
                calculateMovementDirection(
                    previousCell,
                    currentCell
                );

            const previousSpeed =
                Math.max(
                    0,
                    toFiniteNumber(
                        previousCell.speedKmh,
                        0
                    )
                );

            const sourceSpeed =
                Math.max(
                    0,
                    toFiniteNumber(
                        currentCell.speedKmh,
                        0
                    )
                );

            let fusedSpeedKmh =
                calculatedSpeedKmh;

            if (
                calculatedSpeedKmh <= 0 &&
                sourceSpeed > 0
            ) {
                fusedSpeedKmh =
                    sourceSpeed;
            } else if (
                calculatedSpeedKmh > 0 &&
                sourceSpeed > 0
            ) {
                fusedSpeedKmh =
                    calculatedSpeedKmh *
                    0.72 +
                    sourceSpeed *
                    0.28;
            }

            fusedSpeedKmh =
                clamp(
                    fusedSpeedKmh,
                    0,
                    this.options
                        .maxCellSpeedKmh
                );

            let fusedDirection =
                calculatedDirection;

            const sourceDirection =
                normalizeBearing(
                    currentCell
                        .directionDegrees
                );

            if (
                calculatedSpeedKmh <=
                DEFAULT_STATIONARY_SPEED_KMH &&
                sourceSpeed >
                DEFAULT_STATIONARY_SPEED_KMH
            ) {
                fusedDirection =
                    sourceDirection;
            }

            fusedDirection =
                normalizeBearing(
                    fusedDirection
                );

            const directionChangeDegrees =
                calculateAngularDifference(
                    previousCell
                        .directionDegrees,
                    fusedDirection
                );

            const accelerationKmh =
                fusedSpeedKmh -
                previousSpeed;

            let movementStatus =
                MOVEMENT_STATUS.MOVING;

            if (
                fusedSpeedKmh <=
                DEFAULT_STATIONARY_SPEED_KMH
            ) {
                movementStatus =
                    MOVEMENT_STATUS.STATIONARY;
            } else if (
                directionChangeDegrees >=
                DEFAULT_DIRECTION_CHANGE_THRESHOLD
            ) {
                movementStatus =
                    MOVEMENT_STATUS.CHANGING_DIRECTION;
            } else if (
                accelerationKmh >=
                DEFAULT_ACCELERATION_THRESHOLD_KMH
            ) {
                movementStatus =
                    MOVEMENT_STATUS.ACCELERATING;
            } else if (
                accelerationKmh <=
                -DEFAULT_ACCELERATION_THRESHOLD_KMH
            ) {
                movementStatus =
                    MOVEMENT_STATUS.DECELERATING;
            }

            const intensityTrend =
                calculateIntensityTrend(
                    previousCell.intensity,
                    currentCell.intensity
                );

            const radiusTrend =
                calculateRadiusTrend(
                    previousCell.radiusKm,
                    currentCell.radiusKm
                );

            let status =
                currentCell.status ||
                CELL_STATUS.ACTIVE;

            if (
                intensityTrend ===
                "strengthening"
            ) {
                status =
                    CELL_STATUS.STRENGTHENING;
            } else if (
                intensityTrend ===
                "weakening"
            ) {
                status =
                    CELL_STATUS.WEAKENING;
            }

            const previousHistory =
                safeArray(
                    previousCell.history
                );

            const previousHistoryPoint =
                normalizeTrackingHistoryPoint(
                    previousCell
                );

            const currentHistoryPoint =
                normalizeTrackingHistoryPoint({
                    ...currentCell,

                    speedKmh:
                        fusedSpeedKmh,

                    directionDegrees:
                        fusedDirection
                });

            const history = [
                ...previousHistory
            ];

            if (
                previousHistoryPoint &&
                (
                    !history.length ||
                    history[
                        history.length - 1
                    ].timestamp !==
                    previousHistoryPoint
                        .timestamp
                )
            ) {
                history.push(
                    previousHistoryPoint
                );
            }

            if (currentHistoryPoint) {
                history.push(
                    currentHistoryPoint
                );
            }

            const firstDetectedAt =
                normalizeTimestamp(
                    previousCell
                        .firstDetectedAt ??
                    previousTimestamp
                );

            return {
                ...deepClone(
                    previousCell
                ),

                ...deepClone(
                    currentCell
                ),

                trackingId:
                    previousCell.trackingId ||
                    previousCell.id,

                firstDetectedAt,

                detectedAt:
                    previousCell.detectedAt ||
                    firstDetectedAt,

                updatedAt:
                    Date.now(),

                lastMatchedAt:
                    Date.now(),

                previousLatitude:
                    previousCell.latitude,

                previousLongitude:
                    previousCell.longitude,

                previousTimestamp,

                timestamp:
                    currentTimestamp,

                speedKmh:
                    fusedSpeedKmh,

                directionDegrees:
                    fusedDirection,

                movementStatus,

                accelerationKmh,

                directionChangeDegrees,

                intensityTrend,

                radiusTrend,

                status,

                ageMs:
                    Math.max(
                        0,
                        currentTimestamp -
                        firstDetectedAt
                    ),

                missedCycles:
                    0,

                matchScore:
                    clamp(
                        match?.score,
                        0,
                        1
                    ),

                matchStatus:
                    match?.status ||
                    TRACKING_MATCH_STATUS.ACCEPTABLE,

                matchDiagnostics:
                    deepClone(
                        safeObject(
                            match
                        )
                    ),

                confidence:
                    clamp(
                        normalizePercentage(
                            currentCell.confidence
                        ) *
                        0.75 +
                        normalizePercentage(
                            previousCell.confidence
                        ) *
                        0.15 +
                        clamp(
                            match?.score,
                            0,
                            1
                        ) *
                        0.10,
                        0,
                        1
                    ),

                history:
                    history.slice(
                        -trackingOptions
                            .historyLimit
                    )
            };
        };

    /* ======================================================================
       SECTION 61
       HANDLE UNMATCHED PREVIOUS CELLS
       ====================================================================== */

    CoreClass.prototype.processUnmatchedPreviousCell =
        function processUnmatchedPreviousCell(
            previousCell,
            currentTimestamp = Date.now()
        ) {
            const lastTimestamp =
                getCellTimestamp(
                    previousCell
                );

            const elapsedMs =
                Math.max(
                    0,
                    currentTimestamp -
                    lastTimestamp
                );

            const missedCycles =
                Math.max(
                    0,
                    toFiniteNumber(
                        previousCell.missedCycles,
                        0
                    )
                ) + 1;

            const isExpired =
                elapsedMs >
                this.options.maxCellAgeMs;

            if (isExpired) {
                return {
                    ...deepClone(
                        previousCell
                    ),

                    status:
                        CELL_STATUS.LOST,

                    movementStatus:
                        previousCell
                            .movementStatus ||
                        MOVEMENT_STATUS.UNKNOWN,

                    missedCycles,

                    updatedAt:
                        Date.now(),

                    expiredAt:
                        Date.now(),

                    active:
                        false
                };
            }

            const confidencePenalty =
                Math.min(
                    0.65,
                    missedCycles *
                    0.12
                );

            const weakenedConfidence =
                clamp(
                    normalizePercentage(
                        previousCell.confidence
                    ) -
                    confidencePenalty,
                    0,
                    1
                );

            return {
                ...deepClone(
                    previousCell
                ),

                status:
                    weakenedConfidence <
                    this.options.minConfidence
                        ? CELL_STATUS.LOST
                        : CELL_STATUS.WEAKENING,

                missedCycles,

                confidence:
                    weakenedConfidence,

                updatedAt:
                    Date.now(),

                active:
                    weakenedConfidence >=
                    this.options.minConfidence
            };
        };

    /* ======================================================================
       SECTION 62
       TRACK UNIFIED RAIN CELLS
       ====================================================================== */

    CoreClass.prototype.trackRainCells =
        function trackRainCells(
            currentCells,
            options = {}
        ) {
            const trackingOptions =
                this.normalizeTrackingOptions(
                    options
                );

            const previousCells =
                Array.from(
                    this.cells.values()
                );

            const validCurrentCells =
                safeArray(currentCells)
                    .filter(
                        hasCoordinates
                    )
                    .slice()
                    .sort((cellA, cellB) => {
                        return (
                            normalizePercentage(
                                cellB.confidence
                            ) -
                            normalizePercentage(
                                cellA.confidence
                            )
                        );
                    });

            const trackedCells = [];

            const lostCells = [];

            const createdCells = [];

            const updatedCells = [];

            const usedTrackingIds =
                new Set();

            validCurrentCells.forEach(
                (currentCell) => {
                    const bestMatch =
                        this.findBestPreviousCellMatch(
                            currentCell,
                            previousCells,
                            usedTrackingIds,
                            trackingOptions
                        );

                    if (!bestMatch) {
                        const trackedCell =
                            this.createTrackedCell(
                                currentCell,
                                trackingOptions
                            );

                        trackedCells.push(
                            trackedCell
                        );

                        createdCells.push(
                            trackedCell
                        );

                        usedTrackingIds.add(
                            trackedCell.trackingId
                        );

                        this.emit(
                            CORE_EVENTS.CELL_CREATED,
                            {
                                cell:
                                    deepClone(
                                        trackedCell
                                    )
                            }
                        );

                        return;
                    }

                    const trackedCell =
                        this.updateTrackedCell(
                            bestMatch.previousCell,
                            currentCell,
                            bestMatch.match,
                            trackingOptions
                        );

                    trackedCells.push(
                        trackedCell
                    );

                    updatedCells.push(
                        trackedCell
                    );

                    usedTrackingIds.add(
                        trackedCell.trackingId
                    );

                    this.emit(
                        CORE_EVENTS.CELL_UPDATED,
                        {
                            cell:
                                deepClone(
                                    trackedCell
                                ),

                            match:
                                deepClone(
                                    bestMatch.match
                                )
                        }
                    );
                }
            );

            previousCells.forEach(
                (previousCell) => {
                    const trackingId =
                        previousCell.trackingId ||
                        previousCell.id;

                    if (
                        usedTrackingIds.has(
                            trackingId
                        )
                    ) {
                        return;
                    }

                    const processedCell =
                        this.processUnmatchedPreviousCell(
                            previousCell,
                            Date.now()
                        );

                    if (
                        processedCell.status ===
                        CELL_STATUS.LOST ||
                        processedCell.active ===
                        false
                    ) {
                        lostCells.push(
                            processedCell
                        );

                        this.emit(
                            CORE_EVENTS.CELL_DISSIPATED,
                            {
                                cell:
                                    deepClone(
                                        processedCell
                                    )
                            }
                        );

                        return;
                    }

                    trackedCells.push(
                        processedCell
                    );
                }
            );

            this.cells.clear();

            trackedCells.forEach(
                (cell) => {
                    this.cells.set(
                        cell.trackingId,
                        cell
                    );
                }
            );

            this.state.rainCells =
                deepClone(
                    trackedCells
                );

            this.state.diagnostics
                .trackedCellCount =
                trackedCells.length;

            this.state.diagnostics
                .createdCellCount =
                createdCells.length;

            this.state.diagnostics
                .updatedCellCount =
                updatedCells.length;

            this.state.diagnostics
                .lostCellCount =
                lostCells.length;

            this.emit(
                CORE_EVENTS.CELLS_UPDATED,
                {
                    cellCount:
                        trackedCells.length,

                    createdCount:
                        createdCells.length,

                    updatedCount:
                        updatedCells.length,

                    lostCount:
                        lostCells.length,

                    rainCells:
                        deepClone(
                            trackedCells
                        )
                }
            );

            return {
                generatedAt:
                    Date.now(),

                rainCells:
                    deepClone(
                        trackedCells
                    ),

                createdCells:
                    deepClone(
                        createdCells
                    ),

                updatedCells:
                    deepClone(
                        updatedCells
                    ),

                lostCells:
                    deepClone(
                        lostCells
                    ),

                summary: {
                    inputCellCount:
                        validCurrentCells.length,

                    previousCellCount:
                        previousCells.length,

                    trackedCellCount:
                        trackedCells.length,

                    createdCellCount:
                        createdCells.length,

                    updatedCellCount:
                        updatedCells.length,

                    lostCellCount:
                        lostCells.length
                }
            };
        };

    /* ======================================================================
       SECTION 63
       EXECUTE FUSION AND TRACKING
       ====================================================================== */

    CoreClass.prototype.executeFusionAndTracking =
        function executeFusionAndTracking(
            options = {}
        ) {
            const safeOptions =
                safeObject(options);

            const fusionResults =
                this.buildUnifiedRainCells(
                    safeOptions.fusion ||
                    safeOptions
                );

            this.state.observations =
                deepClone(
                    fusionResults.observations
                );

            this.state.forecasts =
                deepClone(
                    fusionResults.forecasts
                );

            const trackingResults =
                this.trackRainCells(
                    fusionResults.rainCells,
                    safeOptions.tracking
                );

            this.state.diagnostics
                .fusionSummary =
                deepClone(
                    fusionResults.summary
                );

            return {
                generatedAt:
                    Date.now(),

                fusion:
                    deepClone(
                        fusionResults
                    ),

                tracking:
                    deepClone(
                        trackingResults
                    )
            };
        };

    /* ======================================================================
       SECTION 64
       GET TRACKED CELL
       ====================================================================== */

    CoreClass.prototype.getTrackedCell =
        function getTrackedCell(
            trackingId
        ) {
            if (
                typeof trackingId !==
                "string" ||
                !trackingId
            ) {
                return null;
            }

            const directCell =
                this.cells.get(
                    trackingId
                );

            if (directCell) {
                return deepClone(
                    directCell
                );
            }

            const foundCell =
                Array.from(
                    this.cells.values()
                )
                    .find((cell) => {
                        return (
                            cell.id ===
                            trackingId ||
                            cell.trackingId ===
                            trackingId
                        );
                    });

            return foundCell
                ? deepClone(
                    foundCell
                )
                : null;
        };

    /* ======================================================================
       SECTION 65
       GET ACTIVE TRACKED CELLS
       ====================================================================== */

    CoreClass.prototype.getActiveTrackedCells =
        function getActiveTrackedCells(
            filters = {}
        ) {
            const safeFilters =
                safeObject(filters);

            let cells =
                Array.from(
                    this.cells.values()
                )
                    .filter((cell) => {
                        return (
                            cell.status !==
                            CELL_STATUS.LOST &&
                            cell.status !==
                            CELL_STATUS.DISSIPATED &&
                            cell.active !== false
                        );
                    });

            if (
                Number.isFinite(
                    Number(
                        safeFilters.minimumConfidence
                    )
                )
            ) {
                const minimumConfidence =
                    normalizePercentage(
                        safeFilters
                            .minimumConfidence
                    );

                cells =
                    cells.filter(
                        (cell) => {
                            return (
                                normalizePercentage(
                                    cell.confidence
                                ) >=
                                minimumConfidence
                            );
                        }
                    );
            }

            if (
                Number.isFinite(
                    Number(
                        safeFilters.minimumIntensity
                    )
                )
            ) {
                const minimumIntensity =
                    Math.max(
                        0,
                        Number(
                            safeFilters
                                .minimumIntensity
                        )
                    );

                cells =
                    cells.filter(
                        (cell) => {
                            return (
                                getCellIntensity(
                                    cell
                                ) >=
                                minimumIntensity
                            );
                        }
                    );
            }

            return deepClone(
                cells
            );
        };

    /* ======================================================================
       SECTION 66
       CELL MOVEMENT SUMMARY
       ====================================================================== */

    CoreClass.prototype.getCellMovementSummary =
        function getCellMovementSummary(
            trackingId
        ) {
            const cell =
                this.getTrackedCell(
                    trackingId
                );

            if (!cell) {
                return null;
            }

            const history =
                safeArray(
                    cell.history
                );

            const speeds =
                history
                    .map((point) => {
                        return toFiniteNumber(
                            point.speedKmh,
                            NaN
                        );
                    })
                    .filter(
                        Number.isFinite
                    );

            const directions =
                history
                    .map((point) => {
                        return toFiniteNumber(
                            point.directionDegrees,
                            NaN
                        );
                    })
                    .filter(
                        Number.isFinite
                    );

            const totalDistanceKm =
                history.reduce(
                    (
                        total,
                        point,
                        index
                    ) => {
                        if (index === 0) {
                            return total;
                        }

                        const previousPoint =
                            history[
                                index - 1
                            ];

                        return (
                            total +
                            calculateDistanceKm(
                                previousPoint.latitude,
                                previousPoint.longitude,
                                point.latitude,
                                point.longitude
                            )
                        );
                    },
                    0
                );

            return {
                trackingId:
                    cell.trackingId,

                currentSpeedKmh:
                    Math.max(
                        0,
                        toFiniteNumber(
                            cell.speedKmh,
                            0
                        )
                    ),

                averageSpeedKmh:
                    average(
                        speeds
                    ),

                maximumSpeedKmh:
                    speeds.length
                        ? Math.max(
                            ...speeds
                        )
                        : 0,

                currentDirectionDegrees:
                    normalizeBearing(
                        cell.directionDegrees
                    ),

                averageDirectionDegrees:
                    directions.length
                        ? directions.reduce(
                            (
                                sum,
                                direction
                            ) => {
                                return (
                                    sum +
                                    direction
                                );
                            },
                            0
                        ) /
                        directions.length
                        : 0,

                movementStatus:
                    cell.movementStatus,

                accelerationKmh:
                    toFiniteNumber(
                        cell.accelerationKmh,
                        0
                    ),

                directionChangeDegrees:
                    toFiniteNumber(
                        cell.directionChangeDegrees,
                        0
                    ),

                totalDistanceKm,

                historyPointCount:
                    history.length,

                firstDetectedAt:
                    cell.firstDetectedAt,

                lastUpdatedAt:
                    cell.updatedAt,

                ageMs:
                    Math.max(
                        0,
                        Date.now() -
                        normalizeTimestamp(
                            cell.firstDetectedAt
                        )
                    )
            };
        };

    /* ======================================================================
       SECTION 67
       CLEANUP LOST CELLS
       ====================================================================== */

    CoreClass.prototype.cleanupLostCells =
        function cleanupLostCells(
            maximumLostAgeMs =
                6 * 60 * 60 * 1000
        ) {
            const now =
                Date.now();

            const maximumAge =
                Math.max(
                    60 * 1000,
                    toFiniteNumber(
                        maximumLostAgeMs,
                        6 * 60 * 60 * 1000
                    )
                );

            let removedCount = 0;

            this.cells.forEach(
                (cell, trackingId) => {
                    const isLost =
                        cell.status ===
                        CELL_STATUS.LOST ||
                        cell.status ===
                        CELL_STATUS.DISSIPATED ||
                        cell.active === false;

                    if (!isLost) {
                        return;
                    }

                    const referenceTimestamp =
                        normalizeTimestamp(
                            cell.expiredAt ??
                            cell.updatedAt ??
                            cell.timestamp
                        );

                    if (
                        now -
                        referenceTimestamp >=
                        maximumAge
                    ) {
                        this.cells.delete(
                            trackingId
                        );

                        removedCount += 1;
                    }
                }
            );

            this.state.rainCells =
                deepClone(
                    Array.from(
                        this.cells.values()
                    )
                );

            return {
                removedCount,

                remainingCount:
                    this.cells.size,

                cleanedAt:
                    now
            };
        };

    /* ======================================================================
       SECTION 68
       PART 5 EXPORT
       ====================================================================== */

    global.RainArrivalRecoveryCoreV32Part5 = {
        DEFAULT_TRACKING_DISTANCE_KM,
        DEFAULT_TRACKING_TIME_MS,
        DEFAULT_DIRECTION_TOLERANCE_DEGREES,
        DEFAULT_RADIUS_CHANGE_TOLERANCE,
        DEFAULT_INTENSITY_CHANGE_TOLERANCE,
        DEFAULT_MIN_TRACKING_SCORE,
        DEFAULT_STRONG_TRACKING_SCORE,
        DEFAULT_STATIONARY_SPEED_KMH,
        DEFAULT_ACCELERATION_THRESHOLD_KMH,
        DEFAULT_DIRECTION_CHANGE_THRESHOLD,
        DEFAULT_HISTORY_LIMIT,
        TRACKING_MATCH_STATUS,
        calculateRelativeDifference,
        calculateSpeedKmh,
        calculateMovementDirection,
        calculateIntensityTrend,
        calculateRadiusTrend,
        normalizeTrackingHistoryPoint
    };

})(window);

/* ==========================================================================
   RainGuard AI
   Rain Arrival Recovery Core V32

   PART 6
   Storm Path Projection + Target Cities + Initial Rain Arrival ETA
   ========================================================================== */

(function extendRainArrivalRecoveryCoreV32Part6(global) {
    "use strict";

    const CoreClass =
        global.RainArrivalRecoveryCoreV32;

    const Utils =
        global.RainArrivalRecoveryCoreV32Utils;

    const Constants =
        global.RainArrivalRecoveryCoreV32Constants;

    if (
        typeof CoreClass !== "function" ||
        !Utils ||
        !Constants
    ) {
        throw new Error(
            "RainArrivalRecoveryCoreV32 Parts 1 to 5 must be loaded before Part 6."
        );
    }

    const {
        toFiniteNumber,
        clamp,
        normalizePercentage,
        normalizeTimestamp,
        normalizeBearing,
        createId,
        safeArray,
        safeObject,
        deepClone,
        weightedAverage,
        calculateDistanceKm,
        calculateBearingDegrees,
        calculateDestinationPoint,
        calculateAngularDifference,
        calculateDirectionalAlignment
    } = Utils;

    const {
        RAIN_STATUS,
        CELL_STATUS,
        MOVEMENT_STATUS,
        CORE_EVENTS
    } = Constants;

    /* ======================================================================
       SECTION 69
       ETA CONSTANTS
       ====================================================================== */

    const DEFAULT_PATH_STEP_MINUTES =
        15;

    const DEFAULT_PATH_WIDTH_KM =
        45;

    const DEFAULT_MAX_PATH_DISTANCE_KM =
        2500;

    const DEFAULT_MIN_DIRECTION_ALIGNMENT =
        0.42;

    const DEFAULT_MIN_ETA_CONFIDENCE =
        0.20;

    const DEFAULT_CITY_IMPACT_RADIUS_KM =
        18;

    const DEFAULT_WEAK_CELL_SPEED_KMH =
        12;

    const DEFAULT_STATIONARY_ETA_LIMIT_HOURS =
        3;

    const DEFAULT_FORECAST_SUPPORT_RADIUS_KM =
        35;

    const DEFAULT_FORECAST_SUPPORT_TIME_MS =
        3 * 60 * 60 * 1000;

    const ETA_CLASSIFICATION = Object.freeze({
        NOW: "now",
        VERY_SOON: "very_soon",
        SOON: "soon",
        LATER: "later",
        LONG_RANGE: "long_range",
        UNLIKELY: "unlikely",
        UNKNOWN: "unknown"
    });

    /* ======================================================================
       SECTION 70
       ETA HELPERS
       ====================================================================== */

    function hasCoordinates(record) {
        return (
            Number.isFinite(
                Number(
                    record?.latitude
                )
            ) &&
            Number.isFinite(
                Number(
                    record?.longitude
                )
            )
        );
    }

    function getCellSpeedKmh(cell) {
        return Math.max(
            0,
            toFiniteNumber(
                cell?.speedKmh,
                0
            )
        );
    }

    function getCellDirectionDegrees(cell) {
        return normalizeBearing(
            cell?.directionDegrees
        );
    }

    function getCellRadiusKm(cell) {
        return Math.max(
            1,
            toFiniteNumber(
                cell?.radiusKm,
                10
            )
        );
    }

    function getCellIntensity(cell) {
        return Math.max(
            0,
            toFiniteNumber(
                cell?.intensity,
                0
            )
        );
    }

    function calculateEtaClassification(
        etaHours,
        rainingNow
    ) {
        if (rainingNow === true) {
            return ETA_CLASSIFICATION.NOW;
        }

        if (
            !Number.isFinite(
                Number(etaHours)
            )
        ) {
            return ETA_CLASSIFICATION.UNKNOWN;
        }

        if (etaHours <= 1) {
            return ETA_CLASSIFICATION.VERY_SOON;
        }

        if (etaHours <= 6) {
            return ETA_CLASSIFICATION.SOON;
        }

        if (etaHours <= 24) {
            return ETA_CLASSIFICATION.LATER;
        }

        if (etaHours <= 72) {
            return ETA_CLASSIFICATION.LONG_RANGE;
        }

        return ETA_CLASSIFICATION.UNLIKELY;
    }

    function calculateArrivalWindow(
        etaHours,
        confidence,
        speedKmh
    ) {
        if (
            !Number.isFinite(
                Number(etaHours)
            )
        ) {
            return {
                earliestHours: null,
                expectedHours: null,
                latestHours: null,
                uncertaintyHours: null
            };
        }

        const normalizedConfidence =
            normalizePercentage(
                confidence
            );

        const safeSpeed =
            Math.max(
                1,
                toFiniteNumber(
                    speedKmh,
                    1
                )
            );

        const confidenceUncertainty =
            (
                1 -
                normalizedConfidence
            ) *
            Math.max(
                0.5,
                etaHours *
                0.35
            );

        const speedUncertainty =
            safeSpeed < 10
                ? Math.min(
                    4,
                    etaHours *
                    0.30
                )
                : safeSpeed < 25
                    ? Math.min(
                        2.5,
                        etaHours *
                        0.18
                    )
                    : Math.min(
                        1.5,
                        etaHours *
                        0.10
                    );

        const uncertaintyHours =
            Math.max(
                0.25,
                confidenceUncertainty +
                speedUncertainty
            );

        return {
            earliestHours:
                Math.max(
                    0,
                    etaHours -
                    uncertaintyHours
                ),

            expectedHours:
                Math.max(
                    0,
                    etaHours
                ),

            latestHours:
                Math.max(
                    0,
                    etaHours +
                    uncertaintyHours
                ),

            uncertaintyHours
        };
    }

    function calculateArrivalTimestamp(
        etaHours,
        baseTimestamp = Date.now()
    ) {
        if (
            !Number.isFinite(
                Number(etaHours)
            )
        ) {
            return null;
        }

        return (
            normalizeTimestamp(
                baseTimestamp
            ) +
            Math.max(
                0,
                etaHours
            ) *
            60 *
            60 *
            1000
        );
    }

    /* ======================================================================
       SECTION 71
       ETA OPTION NORMALIZATION
       ====================================================================== */

    CoreClass.prototype.normalizeEtaOptions =
        function normalizeEtaOptions(
            options = {}
        ) {
            const safeOptions =
                safeObject(options);

            return {
                maximumEtaHours:
                    clamp(
                        toFiniteNumber(
                            safeOptions.maximumEtaHours,
                            this.options.maxEtaHours
                        ),
                        1,
                        168
                    ),

                pathStepMinutes:
                    clamp(
                        Math.round(
                            toFiniteNumber(
                                safeOptions.pathStepMinutes,
                                DEFAULT_PATH_STEP_MINUTES
                            )
                        ),
                        5,
                        120
                    ),

                pathWidthKm:
                    Math.max(
                        5,
                        toFiniteNumber(
                            safeOptions.pathWidthKm,
                            DEFAULT_PATH_WIDTH_KM
                        )
                    ),

                maximumPathDistanceKm:
                    Math.max(
                        100,
                        toFiniteNumber(
                            safeOptions.maximumPathDistanceKm,
                            DEFAULT_MAX_PATH_DISTANCE_KM
                        )
                    ),

                minimumDirectionAlignment:
                    clamp(
                        toFiniteNumber(
                            safeOptions.minimumDirectionAlignment,
                            DEFAULT_MIN_DIRECTION_ALIGNMENT
                        ),
                        0,
                        1
                    ),

                minimumEtaConfidence:
                    clamp(
                        toFiniteNumber(
                            safeOptions.minimumEtaConfidence,
                            DEFAULT_MIN_ETA_CONFIDENCE
                        ),
                        0,
                        1
                    ),

                cityImpactRadiusKm:
                    Math.max(
                        1,
                        toFiniteNumber(
                            safeOptions.cityImpactRadiusKm,
                            DEFAULT_CITY_IMPACT_RADIUS_KM
                        )
                    ),

                forecastSupportRadiusKm:
                    Math.max(
                        1,
                        toFiniteNumber(
                            safeOptions.forecastSupportRadiusKm,
                            DEFAULT_FORECAST_SUPPORT_RADIUS_KM
                        )
                    ),

                forecastSupportTimeMs:
                    Math.max(
                        15 * 60 * 1000,
                        toFiniteNumber(
                            safeOptions.forecastSupportTimeMs,
                            DEFAULT_FORECAST_SUPPORT_TIME_MS
                        )
                    ),

                includeLowConfidence:
                    safeOptions.includeLowConfidence === true
            };
        };

    /* ======================================================================
       SECTION 72
       PROJECT CELL PATH
       ====================================================================== */

    CoreClass.prototype.projectCellPath =
        function projectCellPath(
            cell,
            options = {}
        ) {
            if (
                !cell ||
                !hasCoordinates(cell)
            ) {
                return [];
            }

            const etaOptions =
                this.normalizeEtaOptions(
                    options
                );

            let speedKmh =
                getCellSpeedKmh(cell);

            if (
                speedKmh <
                this.options.minCellSpeedKmh
            ) {
                speedKmh =
                    DEFAULT_WEAK_CELL_SPEED_KMH;
            }

            speedKmh =
                clamp(
                    speedKmh,
                    1,
                    this.options.maxCellSpeedKmh
                );

            const directionDegrees =
                getCellDirectionDegrees(
                    cell
                );

            const maximumByTimeKm =
                speedKmh *
                etaOptions.maximumEtaHours;

            const maximumDistanceKm =
                Math.min(
                    maximumByTimeKm,
                    etaOptions.maximumPathDistanceKm
                );

            const stepHours =
                etaOptions.pathStepMinutes /
                60;

            const path = [];

            for (
                let elapsedHours = 0;
                elapsedHours <=
                etaOptions.maximumEtaHours;
                elapsedHours += stepHours
            ) {
                const distanceKm =
                    Math.min(
                        elapsedHours *
                        speedKmh,
                        maximumDistanceKm
                    );

                const point =
                    distanceKm <= 0
                        ? {
                            latitude:
                                cell.latitude,

                            longitude:
                                cell.longitude
                        }
                        : calculateDestinationPoint(
                            cell.latitude,
                            cell.longitude,
                            directionDegrees,
                            distanceKm
                        );

                path.push({
                    index:
                        path.length,

                    trackingId:
                        cell.trackingId ||
                        cell.id,

                    elapsedHours,

                    distanceKm,

                    timestamp:
                        calculateArrivalTimestamp(
                            elapsedHours,
                            cell.timestamp ||
                            Date.now()
                        ),

                    latitude:
                        point.latitude,

                    longitude:
                        point.longitude,

                    radiusKm:
                        getCellRadiusKm(
                            cell
                        ) +
                        etaOptions.pathWidthKm,

                    speedKmh,

                    directionDegrees
                });

                if (
                    distanceKm >=
                    maximumDistanceKm
                ) {
                    break;
                }
            }

            return path;
        };

    /* ======================================================================
       SECTION 73
       CALCULATE CITY POSITION RELATIVE TO CELL
       ====================================================================== */

    CoreClass.prototype.calculateLocationPathRelationship =
        function calculateLocationPathRelationship(
            cell,
            location,
            options = {}
        ) {
            if (
                !cell ||
                !location ||
                !hasCoordinates(cell) ||
                !hasCoordinates(location)
            ) {
                return null;
            }

            const etaOptions =
                this.normalizeEtaOptions(
                    options
                );

            const distanceKm =
                calculateDistanceKm(
                    cell.latitude,
                    cell.longitude,
                    location.latitude,
                    location.longitude
                );

            const targetBearing =
                calculateBearingDegrees(
                    cell.latitude,
                    cell.longitude,
                    location.latitude,
                    location.longitude
                );

            const cellDirection =
                getCellDirectionDegrees(
                    cell
                );

            const angularDifference =
                calculateAngularDifference(
                    cellDirection,
                    targetBearing
                );

            const directionalAlignment =
                calculateDirectionalAlignment(
                    cellDirection,
                    targetBearing
                );

            const cellRadiusKm =
                getCellRadiusKm(
                    cell
                );

            const impactRadiusKm =
                cellRadiusKm +
                etaOptions.cityImpactRadiusKm;

            const rainingNow =
                distanceKm <=
                impactRadiusKm &&
                getCellIntensity(
                    cell
                ) >=
                this.options.minRainIntensity;

            const aheadOfCell =
                rainingNow ||
                directionalAlignment >=
                etaOptions.minimumDirectionAlignment;

            const crossTrackDistanceKm =
                distanceKm *
                Math.sin(
                    angularDifference *
                    Math.PI /
                    180
                );

            const alongTrackDistanceKm =
                distanceKm *
                Math.cos(
                    angularDifference *
                    Math.PI /
                    180
                );

            const pathWidthKm =
                etaOptions.pathWidthKm +
                cellRadiusKm +
                etaOptions.cityImpactRadiusKm;

            const insideProjectedCorridor =
                aheadOfCell &&
                Math.abs(
                    crossTrackDistanceKm
                ) <= pathWidthKm &&
                alongTrackDistanceKm >=
                -impactRadiusKm;

            return {
                trackingId:
                    cell.trackingId ||
                    cell.id,

                locationId:
                    location.id,

                distanceKm,

                targetBearing,

                cellDirection,

                angularDifference,

                directionalAlignment,

                crossTrackDistanceKm,

                alongTrackDistanceKm,

                pathWidthKm,

                impactRadiusKm,

                rainingNow,

                aheadOfCell,

                insideProjectedCorridor
            };
        };

    /* ======================================================================
       SECTION 74
       FIND FORECAST SUPPORT FOR LOCATION
       ====================================================================== */

    CoreClass.prototype.findForecastSupportForLocation =
        function findForecastSupportForLocation(
            location,
            expectedArrivalTimestamp,
            options = {}
        ) {
            if (
                !location ||
                !hasCoordinates(location)
            ) {
                return {
                    supported: false,
                    supportScore: 0,
                    matches: []
                };
            }

            const etaOptions =
                this.normalizeEtaOptions(
                    options
                );

            const arrivalTimestamp =
                normalizeTimestamp(
                    expectedArrivalTimestamp
                );

            const matches =
                safeArray(
                    this.state.forecasts
                )
                    .map((forecast) => {
                        if (!hasCoordinates(forecast)) {
                            return null;
                        }

                        const distanceKm =
                            calculateDistanceKm(
                                location.latitude,
                                location.longitude,
                                forecast.latitude,
                                forecast.longitude
                            );

                        const forecastTimestamp =
                            normalizeTimestamp(
                                forecast.forecastTimestamp
                            );

                        const timeDifferenceMs =
                            Math.abs(
                                forecastTimestamp -
                                arrivalTimestamp
                            );

                        if (
                            distanceKm >
                            etaOptions.forecastSupportRadiusKm ||
                            timeDifferenceMs >
                            etaOptions.forecastSupportTimeMs
                        ) {
                            return null;
                        }

                        const distanceScore =
                            clamp(
                                1 -
                                distanceKm /
                                etaOptions.forecastSupportRadiusKm,
                                0,
                                1
                            );

                        const timeScore =
                            clamp(
                                1 -
                                timeDifferenceMs /
                                etaOptions.forecastSupportTimeMs,
                                0,
                                1
                            );

                        const probability =
                            normalizePercentage(
                                forecast.rainProbability
                            );

                        const intensityScore =
                            clamp(
                                toFiniteNumber(
                                    forecast.rainIntensity,
                                    0
                                ) /
                                15,
                                0,
                                1
                            );

                        const confidence =
                            normalizePercentage(
                                forecast.confidence
                            );

                        const supportScore =
                            clamp(
                                distanceScore * 0.20 +
                                timeScore * 0.20 +
                                probability * 0.30 +
                                intensityScore * 0.15 +
                                confidence * 0.15,
                                0,
                                1
                            );

                        return {
                            forecastId:
                                forecast.id,

                            source:
                                forecast.source,

                            forecastTimestamp,

                            distanceKm,

                            timeDifferenceMs,

                            rainProbability:
                                probability,

                            rainIntensity:
                                Math.max(
                                    0,
                                    toFiniteNumber(
                                        forecast.rainIntensity,
                                        0
                                    )
                                ),

                            confidence,

                            supportScore
                        };
                    })
                    .filter(Boolean)
                    .sort((matchA, matchB) => {
                        return (
                            matchB.supportScore -
                            matchA.supportScore
                        );
                    });

            const bestMatches =
                matches.slice(
                    0,
                    5
                );

            const supportScore =
                bestMatches.length
                    ? weightedAverage(
                        bestMatches.map(
                            (match, index) => {
                                return {
                                    score:
                                        match.supportScore,

                                    weight:
                                        1 /
                                        (
                                            index +
                                            1
                                        )
                                };
                            }
                        ),
                        "score",
                        "weight"
                    )
                    : 0;

            return {
                supported:
                    supportScore >= 0.40,

                supportScore:
                    clamp(
                        supportScore,
                        0,
                        1
                    ),

                matches:
                    deepClone(
                        bestMatches
                    )
            };
        };

    /* ======================================================================
       SECTION 75
       CALCULATE ETA FROM ONE CELL TO ONE LOCATION
       ====================================================================== */

    CoreClass.prototype.calculateCellEtaToLocation =
        function calculateCellEtaToLocation(
            cell,
            location,
            options = {}
        ) {
            if (
                !cell ||
                !location ||
                !hasCoordinates(cell) ||
                !hasCoordinates(location)
            ) {
                return null;
            }

            const etaOptions =
                this.normalizeEtaOptions(
                    options
                );

            const relationship =
                this.calculateLocationPathRelationship(
                    cell,
                    location,
                    etaOptions
                );

            if (!relationship) {
                return null;
            }

            const rawSpeedKmh =
                getCellSpeedKmh(
                    cell
                );

            const effectiveSpeedKmh =
                rawSpeedKmh >=
                this.options.minCellSpeedKmh
                    ? rawSpeedKmh
                    : DEFAULT_WEAK_CELL_SPEED_KMH;

            let etaHours = null;

            if (
                relationship.rainingNow
            ) {
                etaHours = 0;
            } else if (
                relationship.insideProjectedCorridor &&
                relationship.alongTrackDistanceKm > 0
            ) {
                etaHours =
                    relationship.alongTrackDistanceKm /
                    Math.max(
                        1,
                        effectiveSpeedKmh
                    );
            } else if (
                cell.movementStatus ===
                MOVEMENT_STATUS.STATIONARY &&
                relationship.distanceKm <=
                relationship.impactRadiusKm *
                1.8
            ) {
                etaHours =
                    DEFAULT_STATIONARY_ETA_LIMIT_HOURS;
            }

            if (
                etaHours === null ||
                etaHours >
                etaOptions.maximumEtaHours
            ) {
                return {
                    id:
                        createId(
                            "eta_prediction"
                        ),

                    trackingId:
                        cell.trackingId ||
                        cell.id,

                    locationId:
                        location.id,

                    locationName:
                        location.name,

                    locationNameAr:
                        location.nameAr,

                    regionId:
                        location.regionId,

                    governorateId:
                        location.governorateId,

                    status:
                        RAIN_STATUS.NO_RAIN,

                    classification:
                        ETA_CLASSIFICATION.UNLIKELY,

                    rainingNow:
                        false,

                    etaHours:
                        null,

                    arrivalTimestamp:
                        null,

                    confidence:
                        0,

                    relationship:
                        deepClone(
                            relationship
                        ),

                    generatedAt:
                        Date.now()
                };
            }

            const arrivalTimestamp =
                calculateArrivalTimestamp(
                    etaHours
                );

            const forecastSupport =
                this.findForecastSupportForLocation(
                    location,
                    arrivalTimestamp,
                    etaOptions
                );

            const cellConfidence =
                normalizePercentage(
                    cell.confidence
                );

            const directionScore =
                relationship
                    .directionalAlignment;

            const corridorScore =
                clamp(
                    1 -
                    Math.abs(
                        relationship
                            .crossTrackDistanceKm
                    ) /
                    Math.max(
                        1,
                        relationship.pathWidthKm
                    ),
                    0,
                    1
                );

            const speedScore =
                rawSpeedKmh >=
                this.options.minCellSpeedKmh
                    ? 1
                    : 0.55;

            const distanceScore =
                clamp(
                    1 -
                    (
                        relationship.distanceKm /
                        Math.max(
                            1,
                            etaOptions
                                .maximumPathDistanceKm
                        )
                    ),
                    0,
                    1
                );

            let confidence =
                clamp(
                    cellConfidence * 0.35 +
                    directionScore * 0.20 +
                    corridorScore * 0.15 +
                    speedScore * 0.10 +
                    distanceScore * 0.05 +
                    forecastSupport
                        .supportScore *
                    0.15,
                    0,
                    1
                );

            if (
                relationship.rainingNow
            ) {
                confidence =
                    clamp(
                        Math.max(
                            confidence,
                            0.75
                        ),
                        0,
                        1
                    );
            }

            const arrivalWindow =
                calculateArrivalWindow(
                    etaHours,
                    confidence,
                    effectiveSpeedKmh
                );

            let status =
                RAIN_STATUS.ARRIVING;

            if (
                relationship.rainingNow
            ) {
                status =
                    RAIN_STATUS.RAINING_NOW;
            } else if (
                confidence <
                etaOptions.minimumEtaConfidence
            ) {
                status =
                    RAIN_STATUS.POSSIBLE;
            }

            const classification =
                calculateEtaClassification(
                    etaHours,
                    relationship.rainingNow
                );

            return {
                id:
                    createId(
                        "eta_prediction"
                    ),

                trackingId:
                    cell.trackingId ||
                    cell.id,

                cellId:
                    cell.id,

                locationId:
                    location.id,

                locationName:
                    location.name,

                locationNameAr:
                    location.nameAr,

                locationNameEn:
                    location.nameEn,

                locationType:
                    location.type,

                region:
                    location.region,

                regionId:
                    location.regionId,

                governorate:
                    location.governorate,

                governorateId:
                    location.governorateId,

                latitude:
                    location.latitude,

                longitude:
                    location.longitude,

                status,

                classification,

                rainingNow:
                    relationship.rainingNow,

                etaHours,

                etaMinutes:
                    Math.round(
                        etaHours *
                        60
                    ),

                arrivalTimestamp,

                arrivalIso:
                    new Date(
                        arrivalTimestamp
                    ).toISOString(),

                arrivalWindow,

                distanceKm:
                    relationship.distanceKm,

                alongTrackDistanceKm:
                    relationship
                        .alongTrackDistanceKm,

                crossTrackDistanceKm:
                    relationship
                        .crossTrackDistanceKm,

                cellSpeedKmh:
                    effectiveSpeedKmh,

                rawCellSpeedKmh:
                    rawSpeedKmh,

                cellDirectionDegrees:
                    getCellDirectionDegrees(
                        cell
                    ),

                targetBearing:
                    relationship.targetBearing,

                directionalAlignment:
                    relationship
                        .directionalAlignment,

                cellIntensity:
                    getCellIntensity(
                        cell
                    ),

                cellRadiusKm:
                    getCellRadiusKm(
                        cell
                    ),

                cellStatus:
                    cell.status,

                movementStatus:
                    cell.movementStatus,

                confidence,

                forecastSupported:
                    forecastSupport.supported,

                forecastSupportScore:
                    forecastSupport
                        .supportScore,

                forecastMatches:
                    forecastSupport.matches,

                relationship:
                    deepClone(
                        relationship
                    ),

                generatedAt:
                    Date.now()
            };
        };

    /* ======================================================================
       SECTION 76
       CALCULATE ALL LOCATIONS FOR ONE CELL
       ====================================================================== */

    CoreClass.prototype.calculateCellArrivalPredictions =
        function calculateCellArrivalPredictions(
            cell,
            locations,
            options = {}
        ) {
            const etaOptions =
                this.normalizeEtaOptions(
                    options
                );

            return safeArray(
                locations
            )
                .filter((location) => {
                    return (
                        location.active !== false &&
                        hasCoordinates(location)
                    );
                })
                .map((location) => {
                    return this
                        .calculateCellEtaToLocation(
                            cell,
                            location,
                            etaOptions
                        );
                })
                .filter(Boolean)
                .filter((prediction) => {
                    if (
                        etaOptions.includeLowConfidence
                    ) {
                        return true;
                    }

                    return (
                        prediction.rainingNow ||
                        prediction.confidence >=
                        etaOptions.minimumEtaConfidence
                    );
                })
                .sort((predictionA, predictionB) => {
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
                        predictionA.etaHours ??
                        Infinity;

                    const etaB =
                        predictionB.etaHours ??
                        Infinity;

                    if (etaA !== etaB) {
                        return etaA - etaB;
                    }

                    return (
                        predictionB.confidence -
                        predictionA.confidence
                    );
                });
        };

    /* ======================================================================
       SECTION 77
       CHOOSE BEST PREDICTION FOR EACH LOCATION
       ====================================================================== */

    CoreClass.prototype.selectBestLocationPredictions =
        function selectBestLocationPredictions(
            predictions
        ) {
            const groupedPredictions =
                new Map();

            safeArray(predictions)
                .forEach((prediction) => {
                    if (
                        !prediction?.locationId
                    ) {
                        return;
                    }

                    if (
                        !groupedPredictions.has(
                            prediction.locationId
                        )
                    ) {
                        groupedPredictions.set(
                            prediction.locationId,
                            []
                        );
                    }

                    groupedPredictions
                        .get(
                            prediction.locationId
                        )
                        .push(
                            prediction
                        );
                });

            const selected = [];

            groupedPredictions.forEach(
                (
                    locationPredictions,
                    locationId
                ) => {
                    const sorted =
                        locationPredictions
                            .slice()
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
                                        predictionA.etaHours ??
                                        Infinity;

                                    const etaB =
                                        predictionB.etaHours ??
                                        Infinity;

                                    const scoreA =
                                        predictionA.confidence *
                                        0.55 +
                                        (
                                            Number.isFinite(
                                                etaA
                                            )
                                                ? 1 /
                                                (
                                                    etaA +
                                                    1
                                                )
                                                : 0
                                        ) *
                                        0.45;

                                    const scoreB =
                                        predictionB.confidence *
                                        0.55 +
                                        (
                                            Number.isFinite(
                                                etaB
                                            )
                                                ? 1 /
                                                (
                                                    etaB +
                                                    1
                                                )
                                                : 0
                                        ) *
                                        0.45;

                                    return (
                                        scoreB -
                                        scoreA
                                    );
                                }
                            );

                    const best =
                        sorted[0];

                    const supportingCells =
                        sorted.slice(
                            1,
                            5
                        );

                    selected.push({
                        ...deepClone(
                            best
                        ),

                        supportingCellCount:
                            supportingCells.length,

                        supportingCells:
                            supportingCells.map(
                                (prediction) => {
                                    return {
                                        trackingId:
                                            prediction
                                                .trackingId,

                                        etaHours:
                                            prediction
                                                .etaHours,

                                        confidence:
                                            prediction
                                                .confidence,

                                        status:
                                            prediction
                                                .status
                                    };
                                }
                            ),

                        alternativePredictionCount:
                            Math.max(
                                0,
                                sorted.length - 1
                            )
                    });
                }
            );

            return selected.sort(
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

                    return (
                        (
                            predictionA.etaHours ??
                            Infinity
                        ) -
                        (
                            predictionB.etaHours ??
                            Infinity
                        )
                    );
                }
            );
        };

    /* ======================================================================
       SECTION 78
       EXECUTE NATIONAL ETA CALCULATION
       ====================================================================== */

    CoreClass.prototype.calculateNationalArrivalPredictions =
        function calculateNationalArrivalPredictions(
            options = {}
        ) {
            const safeOptions =
                safeObject(options);

            const etaOptions =
                this.normalizeEtaOptions(
                    safeOptions.eta ||
                    safeOptions
                );

            const locations =
                safeArray(
                    safeOptions.locations
                ).length
                    ? safeOptions.locations
                    : this.getActiveLocations();

            const cells =
                safeArray(
                    safeOptions.cells
                ).length
                    ? safeOptions.cells
                    : this.getActiveTrackedCells({
                        minimumConfidence:
                            this.options
                                .minConfidence
                    });

            const allPredictions = [];

            cells.forEach((cell) => {
                const cellPredictions =
                    this.calculateCellArrivalPredictions(
                        cell,
                        locations,
                        etaOptions
                    );

                allPredictions.push(
                    ...cellPredictions
                );
            });

            const selectedPredictions =
                this.selectBestLocationPredictions(
                    allPredictions
                );

            this.state.arrivalPredictions =
                deepClone(
                    selectedPredictions
                );

            this.state.cityForecasts =
                deepClone(
                    selectedPredictions.filter(
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

            this.state.diagnostics
                .generatedPredictionCount =
                selectedPredictions.length;

            this.emit(
                CORE_EVENTS.ETA_UPDATED,
                {
                    predictionCount:
                        selectedPredictions.length,

                    activeCellCount:
                        cells.length,

                    locationCount:
                        locations.length,

                    predictions:
                        deepClone(
                            selectedPredictions
                        )
                }
            );

            return {
                generatedAt:
                    Date.now(),

                locationCount:
                    locations.length,

                activeCellCount:
                    cells.length,

                rawPredictionCount:
                    allPredictions.length,

                selectedPredictionCount:
                    selectedPredictions.length,

                predictions:
                    deepClone(
                        selectedPredictions
                    )
            };
        };

    /* ======================================================================
       SECTION 79
       GET LOCATION ARRIVAL PREDICTION
       ====================================================================== */

    CoreClass.prototype.getArrivalPrediction =
        function getArrivalPrediction(
            locationId
        ) {
            if (
                typeof locationId !==
                "string" ||
                !locationId
            ) {
                return null;
            }

            const normalizedId =
                locationId
                    .trim()
                    .toLowerCase()
                    .replace(/\s+/g, "_");

            const prediction =
                safeArray(
                    this.state
                        .arrivalPredictions
                )
                    .find((item) => {
                        return (
                            item.locationId ===
                            normalizedId
                        );
                    });

            return prediction
                ? deepClone(
                    prediction
                )
                : null;
        };

    /* ======================================================================
       SECTION 80
       GET ARRIVALS BY REGION
       ====================================================================== */

    CoreClass.prototype.getArrivalPredictionsByRegion =
        function getArrivalPredictionsByRegion(
            regionId
        ) {
            if (
                typeof regionId !==
                "string" ||
                !regionId
            ) {
                return [];
            }

            const normalizedRegionId =
                regionId
                    .trim()
                    .toLowerCase()
                    .replace(/\s+/g, "_");

            return deepClone(
                safeArray(
                    this.state
                        .arrivalPredictions
                )
                    .filter((prediction) => {
                        return (
                            prediction.regionId ===
                            normalizedRegionId
                        );
                    })
            );
        };

    /* ======================================================================
       SECTION 81
       GET NEAREST ARRIVALS
       ====================================================================== */

    CoreClass.prototype.getNearestRainArrivals =
        function getNearestRainArrivals(
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
                    500
                );

            return deepClone(
                safeArray(
                    this.state
                        .arrivalPredictions
                )
                    .filter((prediction) => {
                        return (
                            prediction.rainingNow ||
                            Number.isFinite(
                                Number(
                                    prediction.etaHours
                                )
                            )
                        );
                    })
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

                            return (
                                (
                                    predictionA
                                        .etaHours ??
                                    Infinity
                                ) -
                                (
                                    predictionB
                                        .etaHours ??
                                    Infinity
                                )
                            );
                        }
                    )
                    .slice(
                        0,
                        safeLimit
                    )
            );
        };

    /* ======================================================================
       SECTION 82
       BUILD CELL PATHS FOR DISPLAY
       ====================================================================== */

    CoreClass.prototype.buildAllCellPaths =
        function buildAllCellPaths(
            options = {}
        ) {
            const cells =
                this.getActiveTrackedCells({
                    minimumConfidence:
                        this.options
                            .minConfidence
                });

            return cells.map((cell) => {
                return {
                    trackingId:
                        cell.trackingId,

                    cell:
                        deepClone(
                            cell
                        ),

                    path:
                        this.projectCellPath(
                            cell,
                            options
                        )
                };
            });
        };

    /* ======================================================================
       SECTION 83
       PART 6 EXPORT
       ====================================================================== */

    global.RainArrivalRecoveryCoreV32Part6 = {
        DEFAULT_PATH_STEP_MINUTES,
        DEFAULT_PATH_WIDTH_KM,
        DEFAULT_MAX_PATH_DISTANCE_KM,
        DEFAULT_MIN_DIRECTION_ALIGNMENT,
        DEFAULT_MIN_ETA_CONFIDENCE,
        DEFAULT_CITY_IMPACT_RADIUS_KM,
        DEFAULT_WEAK_CELL_SPEED_KMH,
        DEFAULT_STATIONARY_ETA_LIMIT_HOURS,
        DEFAULT_FORECAST_SUPPORT_RADIUS_KM,
        DEFAULT_FORECAST_SUPPORT_TIME_MS,
        ETA_CLASSIFICATION,
        calculateEtaClassification,
        calculateArrivalWindow,
        calculateArrivalTimestamp
    };

})(window);

/* ==========================================================================
   RainGuard AI
   Rain Arrival Recovery Core V32

   PART 7
   6 / 12 / 24 / 48 / 72 Hour Horizons
   Region + Governorate + National Rain Arrival Summaries
   ========================================================================== */

(function extendRainArrivalRecoveryCoreV32Part7(global) {
    "use strict";

    const CoreClass =
        global.RainArrivalRecoveryCoreV32;

    const Utils =
        global.RainArrivalRecoveryCoreV32Utils;

    const Constants =
        global.RainArrivalRecoveryCoreV32Constants;

    if (
        typeof CoreClass !== "function" ||
        !Utils ||
        !Constants
    ) {
        throw new Error(
            "RainArrivalRecoveryCoreV32 Parts 1 to 6 must be loaded before Part 7."
        );
    }

    const {
        toFiniteNumber,
        clamp,
        normalizePercentage,
        normalizeTimestamp,
        safeArray,
        safeObject,
        deepClone,
        average
    } = Utils;

    const {
        RAIN_STATUS,
        CORE_EVENTS
    } = Constants;

    /* ======================================================================
       SECTION 84
       HORIZON CONSTANTS
       ====================================================================== */

    const NATIONAL_FORECAST_HORIZONS =
        Object.freeze([
            6,
            12,
            24,
            48,
            72
        ]);

    const HORIZON_KEYS =
        Object.freeze({
            6: "h6",
            12: "h12",
            24: "h24",
            48: "h48",
            72: "h72"
        });

    const HORIZON_LABELS_AR =
        Object.freeze({
            6: "خلال 6 ساعات",
            12: "خلال 12 ساعة",
            24: "خلال 24 ساعة",
            48: "خلال 48 ساعة",
            72: "خلال 72 ساعة"
        });

    const HORIZON_LABELS_EN =
        Object.freeze({
            6: "Within 6 hours",
            12: "Within 12 hours",
            24: "Within 24 hours",
            48: "Within 48 hours",
            72: "Within 72 hours"
        });

    const SUMMARY_RISK_LEVEL =
        Object.freeze({
            NONE: "none",
            LOW: "low",
            MODERATE: "moderate",
            HIGH: "high",
            VERY_HIGH: "very_high",
            EXTREME: "extreme"
        });

    /* ======================================================================
       SECTION 85
       HORIZON HELPERS
       ====================================================================== */

    function normalizeHorizonHours(value) {
        const numericValue =
            Math.max(
                0,
                toFiniteNumber(
                    value,
                    0
                )
            );

        const exactHorizon =
            NATIONAL_FORECAST_HORIZONS
                .find((horizon) => {
                    return (
                        horizon ===
                        numericValue
                    );
                });

        if (exactHorizon) {
            return exactHorizon;
        }

        return NATIONAL_FORECAST_HORIZONS
            .slice()
            .sort((horizonA, horizonB) => {
                return (
                    Math.abs(
                        horizonA -
                        numericValue
                    ) -
                    Math.abs(
                        horizonB -
                        numericValue
                    )
                );
            })[0];
    }

    function getHorizonKey(hours) {
        const normalizedHours =
            normalizeHorizonHours(
                hours
            );

        return (
            HORIZON_KEYS[
                normalizedHours
            ] ||
            `h${normalizedHours}`
        );
    }

    function isPredictionWithinHorizon(
        prediction,
        horizonHours
    ) {
        if (!prediction) {
            return false;
        }

        if (
            prediction.rainingNow === true ||
            prediction.status ===
            RAIN_STATUS.RAINING_NOW
        ) {
            return true;
        }

        const etaHours =
            toFiniteNumber(
                prediction.etaHours,
                NaN
            );

        if (
            !Number.isFinite(
                etaHours
            )
        ) {
            return false;
        }

        return (
            etaHours >= 0 &&
            etaHours <=
            horizonHours
        );
    }

    function getPredictionArrivalTimestamp(
        prediction
    ) {
        if (
            Number.isFinite(
                Number(
                    prediction?.arrivalTimestamp
                )
            )
        ) {
            return Number(
                prediction.arrivalTimestamp
            );
        }

        const etaHours =
            toFiniteNumber(
                prediction?.etaHours,
                NaN
            );

        if (
            !Number.isFinite(
                etaHours
            )
        ) {
            return null;
        }

        return (
            Date.now() +
            etaHours *
            60 *
            60 *
            1000
        );
    }

    function getPredictionIntensity(
        prediction
    ) {
        return Math.max(
            0,
            toFiniteNumber(
                prediction?.cellIntensity ??
                prediction?.rainIntensity ??
                prediction?.intensity,
                0
            )
        );
    }

    function getPredictionConfidence(
        prediction
    ) {
        return normalizePercentage(
            prediction?.confidence
        );
    }

    function getPredictionProbability(
        prediction
    ) {
        return normalizePercentage(
            prediction?.rainProbability ??
            prediction?.probability ??
            prediction?.forecastSupportScore ??
            prediction?.confidence
        );
    }

    function calculatePredictionSeverityScore(
        prediction
    ) {
        const confidence =
            getPredictionConfidence(
                prediction
            );

        const probability =
            getPredictionProbability(
                prediction
            );

        const intensityScore =
            clamp(
                getPredictionIntensity(
                    prediction
                ) /
                30,
                0,
                1
            );

        const etaHours =
            toFiniteNumber(
                prediction?.etaHours,
                72
            );

        const proximityScore =
            prediction?.rainingNow === true
                ? 1
                : clamp(
                    1 -
                    etaHours /
                    72,
                    0,
                    1
                );

        return clamp(
            confidence * 0.32 +
            probability * 0.25 +
            intensityScore * 0.28 +
            proximityScore * 0.15,
            0,
            1
        );
    }

    function classifySummaryRiskLevel(
        riskScore,
        maximumIntensity,
        rainingNowCount
    ) {
        const score =
            clamp(
                toFiniteNumber(
                    riskScore,
                    0
                ),
                0,
                1
            );

        const intensity =
            Math.max(
                0,
                toFiniteNumber(
                    maximumIntensity,
                    0
                )
            );

        const rainingCount =
            Math.max(
                0,
                toFiniteNumber(
                    rainingNowCount,
                    0
                )
            );

        if (
            score >= 0.88 ||
            intensity >= 55 ||
            (
                rainingCount >= 5 &&
                intensity >= 35
            )
        ) {
            return SUMMARY_RISK_LEVEL.EXTREME;
        }

        if (
            score >= 0.72 ||
            intensity >= 35
        ) {
            return SUMMARY_RISK_LEVEL.VERY_HIGH;
        }

        if (
            score >= 0.55 ||
            intensity >= 20
        ) {
            return SUMMARY_RISK_LEVEL.HIGH;
        }

        if (
            score >= 0.36 ||
            intensity >= 10
        ) {
            return SUMMARY_RISK_LEVEL.MODERATE;
        }

        if (
            score > 0 ||
            intensity > 0
        ) {
            return SUMMARY_RISK_LEVEL.LOW;
        }

        return SUMMARY_RISK_LEVEL.NONE;
    }

    function sortPredictionsByArrival(
        predictionA,
        predictionB
    ) {
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
            toFiniteNumber(
                predictionA.etaHours,
                Infinity
            );

        const etaB =
            toFiniteNumber(
                predictionB.etaHours,
                Infinity
            );

        if (etaA !== etaB) {
            return etaA - etaB;
        }

        return (
            getPredictionConfidence(
                predictionB
            ) -
            getPredictionConfidence(
                predictionA
            )
        );
    }

    /* ======================================================================
       SECTION 86
       HORIZON OPTION NORMALIZATION
       ====================================================================== */

    CoreClass.prototype.normalizeHorizonOptions =
        function normalizeHorizonOptions(
            options = {}
        ) {
            const safeOptions =
                safeObject(options);

            const requestedHorizons =
                safeArray(
                    safeOptions.horizons
                )
                    .map(
                        normalizeHorizonHours
                    )
                    .filter(
                        Number.isFinite
                    );

            const horizons =
                Array.from(
                    new Set(
                        requestedHorizons.length
                            ? requestedHorizons
                            : NATIONAL_FORECAST_HORIZONS
                    )
                )
                    .sort(
                        (
                            horizonA,
                            horizonB
                        ) => {
                            return (
                                horizonA -
                                horizonB
                            );
                        }
                    );

            return {
                horizons,

                minimumConfidence:
                    clamp(
                        toFiniteNumber(
                            safeOptions.minimumConfidence,
                            this.options.minConfidence
                        ),
                        0,
                        1
                    ),

                minimumIntensity:
                    Math.max(
                        0,
                        toFiniteNumber(
                            safeOptions.minimumIntensity,
                            this.options.minRainIntensity
                        )
                    ),

                includePossible:
                    safeOptions.includePossible !== false,

                includeNoRainLocations:
                    safeOptions.includeNoRainLocations === true,

                maximumLocationsPerGroup:
                    clamp(
                        Math.round(
                            toFiniteNumber(
                                safeOptions.maximumLocationsPerGroup,
                                500
                            )
                        ),
                        1,
                        5000
                    )
            };
        };

    /* ======================================================================
       SECTION 87
       FILTER PREDICTIONS FOR ONE HORIZON
       ====================================================================== */

    CoreClass.prototype.getPredictionsForHorizon =
        function getPredictionsForHorizon(
            horizonHours,
            options = {}
        ) {
            const horizonOptions =
                this.normalizeHorizonOptions(
                    options
                );

            const normalizedHorizon =
                normalizeHorizonHours(
                    horizonHours
                );

            const predictions =
                safeArray(
                    options.predictions
                ).length
                    ? safeArray(
                        options.predictions
                    )
                    : safeArray(
                        this.state
                            .arrivalPredictions
                    );

            return predictions
                .filter((prediction) => {
                    if (
                        !isPredictionWithinHorizon(
                            prediction,
                            normalizedHorizon
                        )
                    ) {
                        return false;
                    }

                    const confidence =
                        getPredictionConfidence(
                            prediction
                        );

                    const intensity =
                        getPredictionIntensity(
                            prediction
                        );

                    const isActiveRain =
                        prediction.rainingNow ===
                        true ||
                        prediction.status ===
                        RAIN_STATUS.RAINING_NOW;

                    const isPossible =
                        prediction.status ===
                        RAIN_STATUS.POSSIBLE;

                    if (
                        isPossible &&
                        !horizonOptions
                            .includePossible
                    ) {
                        return false;
                    }

                    return (
                        isActiveRain ||
                        confidence >=
                        horizonOptions
                            .minimumConfidence ||
                        intensity >=
                        horizonOptions
                            .minimumIntensity
                    );
                })
                .sort(
                    sortPredictionsByArrival
                );
        };

    /* ======================================================================
       SECTION 88
       BUILD ONE HORIZON SUMMARY
       ====================================================================== */

    CoreClass.prototype.buildHorizonSummary =
        function buildHorizonSummary(
            horizonHours,
            options = {}
        ) {
            const normalizedHorizon =
                normalizeHorizonHours(
                    horizonHours
                );

            const predictions =
                this.getPredictionsForHorizon(
                    normalizedHorizon,
                    options
                );

            const rainingNow =
                predictions.filter(
                    (prediction) => {
                        return (
                            prediction.rainingNow ===
                            true ||
                            prediction.status ===
                            RAIN_STATUS.RAINING_NOW
                        );
                    }
                );

            const arriving =
                predictions.filter(
                    (prediction) => {
                        return (
                            !prediction.rainingNow &&
                            prediction.status ===
                            RAIN_STATUS.ARRIVING
                        );
                    }
                );

            const possible =
                predictions.filter(
                    (prediction) => {
                        return (
                            prediction.status ===
                            RAIN_STATUS.POSSIBLE
                        );
                    }
                );

            const regionIds =
                new Set();

            const governorateIds =
                new Set();

            const trackingIds =
                new Set();

            predictions.forEach(
                (prediction) => {
                    if (
                        prediction.regionId
                    ) {
                        regionIds.add(
                            prediction.regionId
                        );
                    }

                    if (
                        prediction.governorateId
                    ) {
                        governorateIds.add(
                            prediction.governorateId
                        );
                    }

                    if (
                        prediction.trackingId
                    ) {
                        trackingIds.add(
                            prediction.trackingId
                        );
                    }
                }
            );

            const intensities =
                predictions.map(
                    getPredictionIntensity
                );

            const confidences =
                predictions.map(
                    getPredictionConfidence
                );

            const probabilities =
                predictions.map(
                    getPredictionProbability
                );

            const severityScores =
                predictions.map(
                    calculatePredictionSeverityScore
                );

            const maximumIntensity =
                intensities.length
                    ? Math.max(
                        ...intensities
                    )
                    : 0;

            const averageIntensity =
                average(
                    intensities
                );

            const averageConfidence =
                average(
                    confidences
                );

            const averageProbability =
                average(
                    probabilities
                );

            const maximumSeverity =
                severityScores.length
                    ? Math.max(
                        ...severityScores
                    )
                    : 0;

            const averageSeverity =
                average(
                    severityScores
                );

            const coverageScore =
                clamp(
                    predictions.length /
                    Math.max(
                        1,
                        this.locations.size
                    ),
                    0,
                    1
                );

            const riskScore =
                clamp(
                    maximumSeverity * 0.45 +
                    averageSeverity * 0.25 +
                    coverageScore * 0.15 +
                    clamp(
                        maximumIntensity /
                        50,
                        0,
                        1
                    ) *
                    0.15,
                    0,
                    1
                );

            const riskLevel =
                classifySummaryRiskLevel(
                    riskScore,
                    maximumIntensity,
                    rainingNow.length
                );

            const earliestPrediction =
                predictions[0] ||
                null;

            return {
                key:
                    getHorizonKey(
                        normalizedHorizon
                    ),

                horizonHours:
                    normalizedHorizon,

                labelAr:
                    HORIZON_LABELS_AR[
                        normalizedHorizon
                    ],

                labelEn:
                    HORIZON_LABELS_EN[
                        normalizedHorizon
                    ],

                generatedAt:
                    Date.now(),

                startTimestamp:
                    Date.now(),

                endTimestamp:
                    Date.now() +
                    normalizedHorizon *
                    60 *
                    60 *
                    1000,

                predictionCount:
                    predictions.length,

                rainingNowCount:
                    rainingNow.length,

                arrivingCount:
                    arriving.length,

                possibleCount:
                    possible.length,

                affectedRegionCount:
                    regionIds.size,

                affectedGovernorateCount:
                    governorateIds.size,

                contributingCellCount:
                    trackingIds.size,

                earliestLocation:
                    earliestPrediction
                        ? {
                            locationId:
                                earliestPrediction
                                    .locationId,

                            locationName:
                                earliestPrediction
                                    .locationName,

                            locationNameAr:
                                earliestPrediction
                                    .locationNameAr,

                            region:
                                earliestPrediction
                                    .region,

                            governorate:
                                earliestPrediction
                                    .governorate,

                            rainingNow:
                                earliestPrediction
                                    .rainingNow,

                            etaHours:
                                earliestPrediction
                                    .etaHours,

                            etaMinutes:
                                earliestPrediction
                                    .etaMinutes,

                            arrivalTimestamp:
                                getPredictionArrivalTimestamp(
                                    earliestPrediction
                                ),

                            confidence:
                                getPredictionConfidence(
                                    earliestPrediction
                                )
                        }
                        : null,

                maximumIntensity,

                averageIntensity,

                averageConfidence,

                averageProbability,

                riskScore,

                riskLevel,

                locations:
                    deepClone(
                        predictions
                    ),

                rainingNow:
                    deepClone(
                        rainingNow
                    ),

                arriving:
                    deepClone(
                        arriving
                    ),

                possible:
                    deepClone(
                        possible
                    )
            };
        };

    /* ======================================================================
       SECTION 89
       BUILD ALL NATIONAL HORIZONS
       ====================================================================== */

    CoreClass.prototype.buildNationalHorizonForecasts =
        function buildNationalHorizonForecasts(
            options = {}
        ) {
            const horizonOptions =
                this.normalizeHorizonOptions(
                    options
                );

            const horizonList =
                horizonOptions.horizons.map(
                    (horizonHours) => {
                        return this
                            .buildHorizonSummary(
                                horizonHours,
                                {
                                    ...horizonOptions,

                                    predictions:
                                        options.predictions
                                }
                            );
                    }
                );

            const byKey = {};

            horizonList.forEach(
                (horizon) => {
                    byKey[
                        horizon.key
                    ] = horizon;
                }
            );

            this.state.horizonForecasts =
                deepClone(
                    byKey
                );

            this.state.horizonForecastList =
                deepClone(
                    horizonList
                );

            this.emit(
                CORE_EVENTS.FORECAST_UPDATED ||
                CORE_EVENTS.ETA_UPDATED,
                {
                    type:
                        "national_horizons",

                    horizonCount:
                        horizonList.length,

                    horizons:
                        deepClone(
                            horizonList
                        )
                }
            );

            return {
                generatedAt:
                    Date.now(),

                horizonCount:
                    horizonList.length,

                horizons:
                    deepClone(
                        horizonList
                    ),

                byKey:
                    deepClone(
                        byKey
                    )
            };
        };

    /* ======================================================================
       SECTION 90
       GROUP PREDICTIONS
       ====================================================================== */

    CoreClass.prototype.groupArrivalPredictions =
        function groupArrivalPredictions(
            predictions,
            groupKey
        ) {
            const groups =
                new Map();

            safeArray(predictions)
                .forEach((prediction) => {
                    const key =
                        prediction?.[
                            groupKey
                        ] ||
                        "unknown";

                    if (
                        !groups.has(
                            key
                        )
                    ) {
                        groups.set(
                            key,
                            []
                        );
                    }

                    groups
                        .get(key)
                        .push(
                            prediction
                        );
                });

            return groups;
        };

    /* ======================================================================
       SECTION 91
       BUILD GEOGRAPHIC GROUP SUMMARY
       ====================================================================== */

    CoreClass.prototype.buildGeographicGroupSummary =
        function buildGeographicGroupSummary(
            groupId,
            predictions,
            options = {}
        ) {
            const safeOptions =
                safeObject(options);

            const sortedPredictions =
                safeArray(predictions)
                    .slice()
                    .sort(
                        sortPredictionsByArrival
                    );

            const firstPrediction =
                sortedPredictions[0] ||
                null;

            const rainingNow =
                sortedPredictions.filter(
                    (prediction) => {
                        return (
                            prediction.rainingNow ===
                            true ||
                            prediction.status ===
                            RAIN_STATUS.RAINING_NOW
                        );
                    }
                );

            const arriving =
                sortedPredictions.filter(
                    (prediction) => {
                        return (
                            prediction.status ===
                            RAIN_STATUS.ARRIVING
                        );
                    }
                );

            const possible =
                sortedPredictions.filter(
                    (prediction) => {
                        return (
                            prediction.status ===
                            RAIN_STATUS.POSSIBLE
                        );
                    }
                );

            const intensities =
                sortedPredictions.map(
                    getPredictionIntensity
                );

            const confidences =
                sortedPredictions.map(
                    getPredictionConfidence
                );

            const severityScores =
                sortedPredictions.map(
                    calculatePredictionSeverityScore
                );

            const maximumIntensity =
                intensities.length
                    ? Math.max(
                        ...intensities
                    )
                    : 0;

            const averageIntensity =
                average(
                    intensities
                );

            const averageConfidence =
                average(
                    confidences
                );

            const maximumSeverity =
                severityScores.length
                    ? Math.max(
                        ...severityScores
                    )
                    : 0;

            const averageSeverity =
                average(
                    severityScores
                );

            const riskScore =
                clamp(
                    maximumSeverity * 0.58 +
                    averageSeverity * 0.27 +
                    clamp(
                        maximumIntensity /
                        50,
                        0,
                        1
                    ) *
                    0.15,
                    0,
                    1
                );

            const riskLevel =
                classifySummaryRiskLevel(
                    riskScore,
                    maximumIntensity,
                    rainingNow.length
                );

            const arrivalTimestamps =
                sortedPredictions
                    .map(
                        getPredictionArrivalTimestamp
                    )
                    .filter(
                        Number.isFinite
                    );

            const earliestArrivalTimestamp =
                arrivalTimestamps.length
                    ? Math.min(
                        ...arrivalTimestamps
                    )
                    : null;

            const latestArrivalTimestamp =
                arrivalTimestamps.length
                    ? Math.max(
                        ...arrivalTimestamps
                    )
                    : null;

            const trackingIds =
                new Set(
                    sortedPredictions
                        .map(
                            (prediction) => {
                                return (
                                    prediction
                                        .trackingId
                                );
                            }
                        )
                        .filter(Boolean)
                );

            const maximumLocations =
                Math.max(
                    1,
                    toFiniteNumber(
                        safeOptions
                            .maximumLocations,
                        500
                    )
                );

            return {
                id:
                    groupId,

                name:
                    safeOptions.name ||
                    firstPrediction?.[
                        safeOptions.nameKey
                    ] ||
                    groupId,

                nameAr:
                    safeOptions.nameAr ||
                    firstPrediction?.[
                        safeOptions.nameArKey
                    ] ||
                    safeOptions.name ||
                    groupId,

                nameEn:
                    safeOptions.nameEn ||
                    firstPrediction?.[
                        safeOptions.nameEnKey
                    ] ||
                    safeOptions.name ||
                    groupId,

                groupType:
                    safeOptions.groupType ||
                    "geographic",

                generatedAt:
                    Date.now(),

                locationCount:
                    sortedPredictions.length,

                rainingNowCount:
                    rainingNow.length,

                arrivingCount:
                    arriving.length,

                possibleCount:
                    possible.length,

                contributingCellCount:
                    trackingIds.size,

                earliestEtaHours:
                    firstPrediction
                        ? firstPrediction
                            .etaHours
                        : null,

                earliestEtaMinutes:
                    firstPrediction
                        ? firstPrediction
                            .etaMinutes
                        : null,

                earliestArrivalTimestamp,

                latestArrivalTimestamp,

                maximumIntensity,

                averageIntensity,

                averageConfidence,

                riskScore,

                riskLevel,

                topLocation:
                    firstPrediction
                        ? {
                            locationId:
                                firstPrediction
                                    .locationId,

                            locationName:
                                firstPrediction
                                    .locationName,

                            locationNameAr:
                                firstPrediction
                                    .locationNameAr,

                            rainingNow:
                                firstPrediction
                                    .rainingNow,

                            etaHours:
                                firstPrediction
                                    .etaHours,

                            arrivalTimestamp:
                                getPredictionArrivalTimestamp(
                                    firstPrediction
                                ),

                            confidence:
                                getPredictionConfidence(
                                    firstPrediction
                                ),

                            intensity:
                                getPredictionIntensity(
                                    firstPrediction
                                )
                        }
                        : null,

                locations:
                    deepClone(
                        sortedPredictions.slice(
                            0,
                            maximumLocations
                        )
                    )
            };
        };

    /* ======================================================================
       SECTION 92
       BUILD REGION SUMMARIES
       ====================================================================== */

    CoreClass.prototype.buildRegionArrivalSummaries =
        function buildRegionArrivalSummaries(
            options = {}
        ) {
            const safeOptions =
                safeObject(options);

            const predictions =
                safeArray(
                    safeOptions.predictions
                ).length
                    ? safeArray(
                        safeOptions.predictions
                    )
                    : safeArray(
                        this.state
                            .arrivalPredictions
                    );

            const groups =
                this.groupArrivalPredictions(
                    predictions,
                    "regionId"
                );

            const summaries = [];

            groups.forEach(
                (
                    groupPredictions,
                    regionId
                ) => {
                    const first =
                        groupPredictions[0] ||
                        {};

                    summaries.push(
                        this.buildGeographicGroupSummary(
                            regionId,
                            groupPredictions,
                            {
                                groupType:
                                    "region",

                                name:
                                    first.region ||
                                    regionId,

                                nameAr:
                                    first.region ||
                                    regionId,

                                nameEn:
                                    first.region ||
                                    regionId,

                                maximumLocations:
                                    safeOptions
                                        .maximumLocationsPerGroup
                            }
                        )
                    );
                }
            );

            summaries.sort(
                (
                    summaryA,
                    summaryB
                ) => {
                    if (
                        summaryA
                            .rainingNowCount !==
                        summaryB
                            .rainingNowCount
                    ) {
                        return (
                            summaryB
                                .rainingNowCount -
                            summaryA
                                .rainingNowCount
                        );
                    }

                    const etaA =
                        toFiniteNumber(
                            summaryA
                                .earliestEtaHours,
                            Infinity
                        );

                    const etaB =
                        toFiniteNumber(
                            summaryB
                                .earliestEtaHours,
                            Infinity
                        );

                    if (etaA !== etaB) {
                        return etaA - etaB;
                    }

                    return (
                        summaryB.riskScore -
                        summaryA.riskScore
                    );
                }
            );

            this.state.regionSummaries =
                deepClone(
                    summaries
                );

            return summaries;
        };

    /* ======================================================================
       SECTION 93
       BUILD GOVERNORATE SUMMARIES
       ====================================================================== */

    CoreClass.prototype.buildGovernorateArrivalSummaries =
        function buildGovernorateArrivalSummaries(
            options = {}
        ) {
            const safeOptions =
                safeObject(options);

            const predictions =
                safeArray(
                    safeOptions.predictions
                ).length
                    ? safeArray(
                        safeOptions.predictions
                    )
                    : safeArray(
                        this.state
                            .arrivalPredictions
                    );

            const groups =
                this.groupArrivalPredictions(
                    predictions,
                    "governorateId"
                );

            const summaries = [];

            groups.forEach(
                (
                    groupPredictions,
                    governorateId
                ) => {
                    const first =
                        groupPredictions[0] ||
                        {};

                    summaries.push(
                        this.buildGeographicGroupSummary(
                            governorateId,
                            groupPredictions,
                            {
                                groupType:
                                    "governorate",

                                name:
                                    first.governorate ||
                                    governorateId,

                                nameAr:
                                    first.governorate ||
                                    governorateId,

                                nameEn:
                                    first.governorate ||
                                    governorateId,

                                maximumLocations:
                                    safeOptions
                                        .maximumLocationsPerGroup
                            }
                        )
                    );
                }
            );

            summaries.sort(
                (
                    summaryA,
                    summaryB
                ) => {
                    if (
                        summaryA
                            .rainingNowCount !==
                        summaryB
                            .rainingNowCount
                    ) {
                        return (
                            summaryB
                                .rainingNowCount -
                            summaryA
                                .rainingNowCount
                        );
                    }

                    const etaA =
                        toFiniteNumber(
                            summaryA
                                .earliestEtaHours,
                            Infinity
                        );

                    const etaB =
                        toFiniteNumber(
                            summaryB
                                .earliestEtaHours,
                            Infinity
                        );

                    if (etaA !== etaB) {
                        return etaA - etaB;
                    }

                    return (
                        summaryB.riskScore -
                        summaryA.riskScore
                    );
                }
            );

            this.state.governorateSummaries =
                deepClone(
                    summaries
                );

            return summaries;
        };

    /* ======================================================================
       SECTION 94
       BUILD HORIZON SUMMARIES BY REGION
       ====================================================================== */

    CoreClass.prototype.buildRegionHorizonSummaries =
        function buildRegionHorizonSummaries(
            options = {}
        ) {
            const horizonOptions =
                this.normalizeHorizonOptions(
                    options
                );

            const byHorizon = {};

            horizonOptions.horizons
                .forEach((horizonHours) => {
                    const key =
                        getHorizonKey(
                            horizonHours
                        );

                    const predictions =
                        this.getPredictionsForHorizon(
                            horizonHours,
                            options
                        );

                    byHorizon[key] = {
                        horizonHours,

                        labelAr:
                            HORIZON_LABELS_AR[
                                horizonHours
                            ],

                        labelEn:
                            HORIZON_LABELS_EN[
                                horizonHours
                            ],

                        regions:
                            this.buildRegionArrivalSummaries({
                                ...horizonOptions,

                                predictions
                            })
                    };
                });

            this.state.regionHorizonSummaries =
                deepClone(
                    byHorizon
                );

            return byHorizon;
        };

    /* ======================================================================
       SECTION 95
       BUILD HORIZON SUMMARIES BY GOVERNORATE
       ====================================================================== */

    CoreClass.prototype.buildGovernorateHorizonSummaries =
        function buildGovernorateHorizonSummaries(
            options = {}
        ) {
            const horizonOptions =
                this.normalizeHorizonOptions(
                    options
                );

            const byHorizon = {};

            horizonOptions.horizons
                .forEach((horizonHours) => {
                    const key =
                        getHorizonKey(
                            horizonHours
                        );

                    const predictions =
                        this.getPredictionsForHorizon(
                            horizonHours,
                            options
                        );

                    byHorizon[key] = {
                        horizonHours,

                        labelAr:
                            HORIZON_LABELS_AR[
                                horizonHours
                            ],

                        labelEn:
                            HORIZON_LABELS_EN[
                                horizonHours
                            ],

                        governorates:
                            this.buildGovernorateArrivalSummaries({
                                ...horizonOptions,

                                predictions
                            })
                    };
                });

            this.state.governorateHorizonSummaries =
                deepClone(
                    byHorizon
                );

            return byHorizon;
        };

    /* ======================================================================
       SECTION 96
       BUILD COMPLETE NATIONAL ARRIVAL DASHBOARD
       ====================================================================== */

    CoreClass.prototype.buildNationalArrivalDashboard =
        function buildNationalArrivalDashboard(
            options = {}
        ) {
            const horizonOptions =
                this.normalizeHorizonOptions(
                    options
                );

            const horizonForecasts =
                this.buildNationalHorizonForecasts(
                    horizonOptions
                );

            const regionSummaries =
                this.buildRegionArrivalSummaries(
                    horizonOptions
                );

            const governorateSummaries =
                this.buildGovernorateArrivalSummaries(
                    horizonOptions
                );

            const regionHorizons =
                this.buildRegionHorizonSummaries(
                    horizonOptions
                );

            const governorateHorizons =
                this.buildGovernorateHorizonSummaries(
                    horizonOptions
                );

            const nearestArrivals =
                this.getNearestRainArrivals(
                    toFiniteNumber(
                        options
                            .nearestArrivalLimit,
                        50
                    )
                );

            const rainingNow =
                safeArray(
                    this.state
                        .arrivalPredictions
                )
                    .filter(
                        (prediction) => {
                            return (
                                prediction
                                    .rainingNow ===
                                true ||
                                prediction
                                    .status ===
                                RAIN_STATUS
                                    .RAINING_NOW
                            );
                        }
                    )
                    .sort(
                        sortPredictionsByArrival
                    );

            const nationalRiskScore =
                regionSummaries.length
                    ? Math.max(
                        ...regionSummaries.map(
                            (summary) => {
                                return (
                                    summary
                                        .riskScore
                                );
                            }
                        )
                    )
                    : 0;

            const nationalMaximumIntensity =
                regionSummaries.length
                    ? Math.max(
                        ...regionSummaries.map(
                            (summary) => {
                                return (
                                    summary
                                        .maximumIntensity
                                );
                            }
                        )
                    )
                    : 0;

            const nationalRiskLevel =
                classifySummaryRiskLevel(
                    nationalRiskScore,
                    nationalMaximumIntensity,
                    rainingNow.length
                );

            const dashboard = {
                version:
                    this.version,

                generatedAt:
                    Date.now(),

                generatedIso:
                    new Date()
                        .toISOString(),

                horizons:
                    deepClone(
                        horizonForecasts
                            .byKey
                    ),

                horizonList:
                    deepClone(
                        horizonForecasts
                            .horizons
                    ),

                regions:
                    deepClone(
                        regionSummaries
                    ),

                governorates:
                    deepClone(
                        governorateSummaries
                    ),

                regionHorizons:
                    deepClone(
                        regionHorizons
                    ),

                governorateHorizons:
                    deepClone(
                        governorateHorizons
                    ),

                nearestArrivals:
                    deepClone(
                        nearestArrivals
                    ),

                rainingNow:
                    deepClone(
                        rainingNow
                    ),

                summary: {
                    registeredLocationCount:
                        this.locations.size,

                    activeCellCount:
                        this.cells.size,

                    arrivalPredictionCount:
                        safeArray(
                            this.state
                                .arrivalPredictions
                        ).length,

                    rainingNowCount:
                        rainingNow.length,

                    affectedRegionCount:
                        regionSummaries.length,

                    affectedGovernorateCount:
                        governorateSummaries
                            .length,

                    nationalRiskScore,

                    nationalRiskLevel,

                    nationalMaximumIntensity,

                    nearestArrival:
                        nearestArrivals[0] ||
                        null
                }
            };

            this.state.nationalArrivalDashboard =
                deepClone(
                    dashboard
                );

            this.state.diagnostics
                .nationalDashboardGeneratedAt =
                dashboard.generatedAt;

            return dashboard;
        };

    /* ======================================================================
       SECTION 97
       GET HORIZON FORECAST
       ====================================================================== */

    CoreClass.prototype.getHorizonForecast =
        function getHorizonForecast(
            horizonHours
        ) {
            const key =
                getHorizonKey(
                    horizonHours
                );

            const forecast =
                this.state
                    .horizonForecasts?.[
                        key
                    ];

            return forecast
                ? deepClone(
                    forecast
                )
                : null;
        };

    /* ======================================================================
       SECTION 98
       GET 6 / 12 / 24 / 48 / 72 SHORTCUTS
       ====================================================================== */

    CoreClass.prototype.get6HourRainArrivals =
        function get6HourRainArrivals() {
            return this.getHorizonForecast(
                6
            );
        };

    CoreClass.prototype.get12HourRainArrivals =
        function get12HourRainArrivals() {
            return this.getHorizonForecast(
                12
            );
        };

    CoreClass.prototype.get24HourRainArrivals =
        function get24HourRainArrivals() {
            return this.getHorizonForecast(
                24
            );
        };

    CoreClass.prototype.get48HourRainArrivals =
        function get48HourRainArrivals() {
            return this.getHorizonForecast(
                48
            );
        };

    CoreClass.prototype.get72HourRainArrivals =
        function get72HourRainArrivals() {
            return this.getHorizonForecast(
                72
            );
        };

    /* ======================================================================
       SECTION 99
       GET REGION SUMMARY
       ====================================================================== */

    CoreClass.prototype.getRegionArrivalSummary =
        function getRegionArrivalSummary(
            regionId,
            horizonHours = null
        ) {
            if (
                typeof regionId !==
                "string" ||
                !regionId.trim()
            ) {
                return null;
            }

            const normalizedId =
                regionId
                    .trim()
                    .toLowerCase()
                    .replace(
                        /\s+/g,
                        "_"
                    );

            if (
                Number.isFinite(
                    Number(
                        horizonHours
                    )
                )
            ) {
                const key =
                    getHorizonKey(
                        horizonHours
                    );

                const region =
                    safeArray(
                        this.state
                            .regionHorizonSummaries?.[
                                key
                            ]?.regions
                    )
                        .find(
                            (summary) => {
                                return (
                                    summary.id ===
                                    normalizedId
                                );
                            }
                        );

                return region
                    ? deepClone(region)
                    : null;
            }

            const region =
                safeArray(
                    this.state
                        .regionSummaries
                )
                    .find(
                        (summary) => {
                            return (
                                summary.id ===
                                normalizedId
                            );
                        }
                    );

            return region
                ? deepClone(region)
                : null;
        };

    /* ======================================================================
       SECTION 100
       GET GOVERNORATE SUMMARY
       ====================================================================== */

    CoreClass.prototype.getGovernorateArrivalSummary =
        function getGovernorateArrivalSummary(
            governorateId,
            horizonHours = null
        ) {
            if (
                typeof governorateId !==
                "string" ||
                !governorateId.trim()
            ) {
                return null;
            }

            const normalizedId =
                governorateId
                    .trim()
                    .toLowerCase()
                    .replace(
                        /\s+/g,
                        "_"
                    );

            if (
                Number.isFinite(
                    Number(
                        horizonHours
                    )
                )
            ) {
                const key =
                    getHorizonKey(
                        horizonHours
                    );

                const governorate =
                    safeArray(
                        this.state
                            .governorateHorizonSummaries?.[
                                key
                            ]?.governorates
                    )
                        .find(
                            (summary) => {
                                return (
                                    summary.id ===
                                    normalizedId
                                );
                            }
                        );

                return governorate
                    ? deepClone(
                        governorate
                    )
                    : null;
            }

            const governorate =
                safeArray(
                    this.state
                        .governorateSummaries
                )
                    .find(
                        (summary) => {
                            return (
                                summary.id ===
                                normalizedId
                            );
                        }
                    );

            return governorate
                ? deepClone(
                    governorate
                )
                : null;
        };

    /* ======================================================================
       SECTION 101
       GET ALL RAIN-AFFECTED LOCATIONS
       ====================================================================== */

    CoreClass.prototype.getRainAffectedLocations =
        function getRainAffectedLocations(
            horizonHours = 72,
            options = {}
        ) {
            const predictions =
                this.getPredictionsForHorizon(
                    horizonHours,
                    options
                );

            return deepClone(
                predictions.map(
                    (prediction) => {
                        return {
                            locationId:
                                prediction
                                    .locationId,

                            locationName:
                                prediction
                                    .locationName,

                            locationNameAr:
                                prediction
                                    .locationNameAr,

                            locationNameEn:
                                prediction
                                    .locationNameEn,

                            locationType:
                                prediction
                                    .locationType,

                            region:
                                prediction
                                    .region,

                            regionId:
                                prediction
                                    .regionId,

                            governorate:
                                prediction
                                    .governorate,

                            governorateId:
                                prediction
                                    .governorateId,

                            rainingNow:
                                prediction
                                    .rainingNow,

                            status:
                                prediction
                                    .status,

                            classification:
                                prediction
                                    .classification,

                            etaHours:
                                prediction
                                    .etaHours,

                            etaMinutes:
                                prediction
                                    .etaMinutes,

                            arrivalTimestamp:
                                prediction
                                    .arrivalTimestamp,

                            arrivalIso:
                                prediction
                                    .arrivalIso,

                            confidence:
                                prediction
                                    .confidence,

                            intensity:
                                getPredictionIntensity(
                                    prediction
                                ),

                            trackingId:
                                prediction
                                    .trackingId
                        };
                    }
                )
            );
        };

    /* ======================================================================
       SECTION 102
       GET NATIONAL ARRIVAL DASHBOARD
       ====================================================================== */

    CoreClass.prototype.getNationalArrivalDashboard =
        function getNationalArrivalDashboard() {
            const dashboard =
                this.state
                    .nationalArrivalDashboard;

            return dashboard
                ? deepClone(
                    dashboard
                )
                : null;
        };

    /* ======================================================================
       SECTION 103
       EXECUTE COMPLETE HORIZON AGGREGATION
       ====================================================================== */

    CoreClass.prototype.executeHorizonAggregation =
        function executeHorizonAggregation(
            options = {}
        ) {
            const dashboard =
                this.buildNationalArrivalDashboard(
                    options
                );

            this.emit(
                CORE_EVENTS.ETA_UPDATED,
                {
                    type:
                        "horizon_aggregation",

                    generatedAt:
                        dashboard.generatedAt,

                    summary:
                        deepClone(
                            dashboard.summary
                        ),

                    horizons:
                        deepClone(
                            dashboard.horizonList
                        )
                }
            );

            return deepClone(
                dashboard
            );
        };

    /* ======================================================================
       SECTION 104
       PART 7 EXPORT
       ====================================================================== */

    global.RainArrivalRecoveryCoreV32Part7 = {
        NATIONAL_FORECAST_HORIZONS,
        HORIZON_KEYS,
        HORIZON_LABELS_AR,
        HORIZON_LABELS_EN,
        SUMMARY_RISK_LEVEL,
        normalizeHorizonHours,
        getHorizonKey,
        isPredictionWithinHorizon,
        getPredictionArrivalTimestamp,
        getPredictionIntensity,
        getPredictionConfidence,
        getPredictionProbability,
        calculatePredictionSeverityScore,
        classifySummaryRiskLevel,
        sortPredictionsByArrival
    };

})(window);

/* ==========================================================================
   RainGuard AI
   Rain Arrival Recovery Core V32

   PART 8
   Complete Lifecycle + Scheduler + Automatic Processing Cycle
   ========================================================================== */

(function extendRainArrivalRecoveryCoreV32Part8(global) {
    "use strict";

    const CoreClass =
        global.RainArrivalRecoveryCoreV32;

    const Utils =
        global.RainArrivalRecoveryCoreV32Utils;

    const Constants =
        global.RainArrivalRecoveryCoreV32Constants;

    if (
        typeof CoreClass !== "function" ||
        !Utils ||
        !Constants
    ) {
        throw new Error(
            "RainArrivalRecoveryCoreV32 Parts 1 to 7 must be loaded before Part 8."
        );
    }

    const {
        toFiniteNumber,
        clamp,
        normalizeTimestamp,
        safeArray,
        safeObject,
        deepClone,
        sleep
    } = Utils;

    const {
        CORE_EVENTS
    } = Constants;

    /* ======================================================================
       SECTION 105
       LIFECYCLE CONSTANTS
       ====================================================================== */

    const DEFAULT_COLLECTION_INTERVAL_MS =
        5 * 60 * 1000;

    const DEFAULT_INITIAL_DELAY_MS =
        500;

    const DEFAULT_CYCLE_TIMEOUT_MS =
        2 * 60 * 1000;

    const DEFAULT_RECOVERY_DELAY_MS =
        15 * 1000;

    const DEFAULT_MAX_CONSECUTIVE_FAILURES =
        5;

    const DEFAULT_MAINTENANCE_INTERVAL_MS =
        30 * 60 * 1000;

    const DEFAULT_HEARTBEAT_INTERVAL_MS =
        60 * 1000;

    const ENGINE_LIFECYCLE_STATUS =
        Object.freeze({
            IDLE: "idle",
            STARTING: "starting",
            RUNNING: "running",
            COLLECTING: "collecting",
            PROCESSING: "processing",
            STOPPING: "stopping",
            STOPPED: "stopped",
            RECOVERING: "recovering",
            DEGRADED: "degraded",
            FAILED: "failed",
            DESTROYED: "destroyed"
        });

    const CYCLE_STATUS =
        Object.freeze({
            PENDING: "pending",
            RUNNING: "running",
            SUCCESS: "success",
            PARTIAL: "partial",
            FAILED: "failed",
            TIMEOUT: "timeout",
            ABORTED: "aborted",
            SKIPPED: "skipped"
        });

    /* ======================================================================
       SECTION 106
       LIFECYCLE HELPERS
       ====================================================================== */

    function createLifecycleError(
        message,
        code = "LIFECYCLE_ERROR"
    ) {
        const error =
            new Error(message);

        error.code =
            code;

        return error;
    }

    function normalizeLifecycleError(error) {
        return {
            name:
                error?.name ||
                "Error",

            code:
                error?.code ||
                null,

            message:
                error?.message ||
                String(error || "Unknown error"),

            stack:
                error?.stack ||
                null,

            timestamp:
                Date.now()
        };
    }

    function createCycleId() {
        return (
            "rain_cycle_" +
            Date.now() +
            "_" +
            Math.random()
                .toString(36)
                .slice(2, 9)
        );
    }

    function createCycleRecord(
        cycleId,
        trigger
    ) {
        return {
            id:
                cycleId,

            trigger:
                trigger ||
                "automatic",

            status:
                CYCLE_STATUS.PENDING,

            startedAt:
                null,

            completedAt:
                null,

            durationMs:
                0,

            stage:
                null,

            sourceCount:
                0,

            successfulSourceCount:
                0,

            failedSourceCount:
                0,

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

            affectedRegionCount:
                0,

            affectedGovernorateCount:
                0,

            errors: [],

            warnings: [],

            outputs: {}
        };
    }

    function isAbortError(error) {
        return (
            error?.name === "AbortError" ||
            error?.code === "ABORT_ERR" ||
            String(
                error?.message || ""
            )
                .toLowerCase()
                .includes("abort")
        );
    }

    function isTimeoutError(error) {
        return (
            error?.code ===
            "CYCLE_TIMEOUT" ||
            String(
                error?.message || ""
            )
                .toLowerCase()
                .includes("timeout")
        );
    }

    /* ======================================================================
       SECTION 107
       LIFECYCLE OPTION NORMALIZATION
       ====================================================================== */

    CoreClass.prototype.normalizeLifecycleOptions =
        function normalizeLifecycleOptions(
            options = {}
        ) {
            const safeOptions =
                safeObject(options);

            return {
                collectionIntervalMs:
                    Math.max(
                        30 * 1000,
                        toFiniteNumber(
                            safeOptions.collectionIntervalMs,
                            this.options.collectionIntervalMs ||
                            DEFAULT_COLLECTION_INTERVAL_MS
                        )
                    ),

                initialDelayMs:
                    Math.max(
                        0,
                        toFiniteNumber(
                            safeOptions.initialDelayMs,
                            DEFAULT_INITIAL_DELAY_MS
                        )
                    ),

                cycleTimeoutMs:
                    Math.max(
                        15 * 1000,
                        toFiniteNumber(
                            safeOptions.cycleTimeoutMs,
                            DEFAULT_CYCLE_TIMEOUT_MS
                        )
                    ),

                recoveryDelayMs:
                    Math.max(
                        1000,
                        toFiniteNumber(
                            safeOptions.recoveryDelayMs,
                            DEFAULT_RECOVERY_DELAY_MS
                        )
                    ),

                maximumConsecutiveFailures:
                    clamp(
                        Math.round(
                            toFiniteNumber(
                                safeOptions.maximumConsecutiveFailures,
                                DEFAULT_MAX_CONSECUTIVE_FAILURES
                            )
                        ),
                        1,
                        100
                    ),

                maintenanceIntervalMs:
                    Math.max(
                        5 * 60 * 1000,
                        toFiniteNumber(
                            safeOptions.maintenanceIntervalMs,
                            DEFAULT_MAINTENANCE_INTERVAL_MS
                        )
                    ),

                heartbeatIntervalMs:
                    Math.max(
                        15 * 1000,
                        toFiniteNumber(
                            safeOptions.heartbeatIntervalMs,
                            DEFAULT_HEARTBEAT_INTERVAL_MS
                        )
                    ),

                runImmediately:
                    safeOptions.runImmediately !== false,

                autoRecover:
                    safeOptions.autoRecover !== false,

                skipIfRunning:
                    safeOptions.skipIfRunning !== false,

                preservePreviousData:
                    safeOptions.preservePreviousData === true,

                executeMaintenance:
                    safeOptions.executeMaintenance !== false,

                collection:
                    deepClone(
                        safeObject(
                            safeOptions.collection
                        )
                    ),

                fusion:
                    deepClone(
                        safeObject(
                            safeOptions.fusion
                        )
                    ),

                tracking:
                    deepClone(
                        safeObject(
                            safeOptions.tracking
                        )
                    ),

                eta:
                    deepClone(
                        safeObject(
                            safeOptions.eta
                        )
                    ),

                horizons:
                    deepClone(
                        safeObject(
                            safeOptions.horizons
                        )
                    )
            };
        };

    /* ======================================================================
       SECTION 108
       ENSURE LIFECYCLE STATE
       ====================================================================== */

    CoreClass.prototype.ensureLifecycleState =
        function ensureLifecycleState() {
            if (
                !this.state.lifecycle ||
                typeof this.state.lifecycle !==
                "object"
            ) {
                this.state.lifecycle = {
                    status:
                        ENGINE_LIFECYCLE_STATUS.IDLE,

                    startedAt:
                        null,

                    stoppedAt:
                        null,

                    lastCycleStartedAt:
                        null,

                    lastCycleCompletedAt:
                        null,

                    lastSuccessfulCycleAt:
                        null,

                    nextCycleAt:
                        null,

                    totalCycles:
                        0,

                    successfulCycles:
                        0,

                    partialCycles:
                        0,

                    failedCycles:
                        0,

                    skippedCycles:
                        0,

                    consecutiveFailures:
                        0,

                    recoveryCount:
                        0,

                    heartbeatAt:
                        null,

                    lastError:
                        null
                };
            }

            if (
                !safeArray(
                    this.state.cycleHistory
                ).length &&
                !Array.isArray(
                    this.state.cycleHistory
                )
            ) {
                this.state.cycleHistory = [];
            }

            if (
                !this.state.currentCycle
            ) {
                this.state.currentCycle =
                    null;
            }

            if (
                typeof this.isRunning !==
                "boolean"
            ) {
                this.isRunning =
                    false;
            }

            if (
                typeof this.isCycleRunning !==
                "boolean"
            ) {
                this.isCycleRunning =
                    false;
            }

            if (
                typeof this.destroyed !==
                "boolean"
            ) {
                this.destroyed =
                    false;
            }

            return this.state.lifecycle;
        };

    /* ======================================================================
       SECTION 109
       SET ENGINE STATUS
       ====================================================================== */

    CoreClass.prototype.setLifecycleStatus =
        function setLifecycleStatus(
            status,
            metadata = {}
        ) {
            this.ensureLifecycleState();

            const previousStatus =
                this.state.lifecycle.status;

            this.state.lifecycle.status =
                status;

            this.state.lifecycle.statusUpdatedAt =
                Date.now();

            this.state.lifecycle.statusMetadata =
                deepClone(
                    safeObject(metadata)
                );

            this.emit(
                CORE_EVENTS.STATUS_CHANGED ||
                "status_changed",
                {
                    previousStatus,

                    status,

                    metadata:
                        deepClone(
                            safeObject(metadata)
                        ),

                    timestamp:
                        Date.now()
                }
            );

            return status;
        };

    /* ======================================================================
       SECTION 110
       CYCLE TIMEOUT WRAPPER
       ====================================================================== */

    CoreClass.prototype.executeWithCycleTimeout =
        async function executeWithCycleTimeout(
            promise,
            timeoutMs,
            signal = null
        ) {
            let timeoutId = null;

            const timeoutPromise =
                new Promise(
                    (
                        resolve,
                        reject
                    ) => {
                        timeoutId =
                            global.setTimeout(
                                () => {
                                    const error =
                                        createLifecycleError(
                                            `Rain arrival cycle exceeded ${timeoutMs} ms.`,
                                            "CYCLE_TIMEOUT"
                                        );

                                    reject(error);
                                },
                                timeoutMs
                            );
                    }
                );

            const abortPromise =
                signal
                    ? new Promise(
                        (
                            resolve,
                            reject
                        ) => {
                            if (
                                signal.aborted
                            ) {
                                const error =
                                    createLifecycleError(
                                        "Rain arrival cycle aborted.",
                                        "ABORT_ERR"
                                    );

                                error.name =
                                    "AbortError";

                                reject(error);

                                return;
                            }

                            signal.addEventListener(
                                "abort",
                                () => {
                                    const error =
                                        createLifecycleError(
                                            "Rain arrival cycle aborted.",
                                            "ABORT_ERR"
                                        );

                                    error.name =
                                        "AbortError";

                                    reject(error);
                                },
                                {
                                    once: true
                                }
                            );
                        }
                    )
                    : new Promise(
                        () => {}
                    );

            try {
                return await Promise.race([
                    Promise.resolve(
                        promise
                    ),
                    timeoutPromise,
                    abortPromise
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
       SECTION 111
       PREPARE NEW CYCLE
       ====================================================================== */

    CoreClass.prototype.prepareProcessingCycle =
        function prepareProcessingCycle(
            trigger = "automatic"
        ) {
            this.ensureLifecycleState();

            const cycleId =
                createCycleId();

            const cycle =
                createCycleRecord(
                    cycleId,
                    trigger
                );

            cycle.status =
                CYCLE_STATUS.RUNNING;

            cycle.startedAt =
                Date.now();

            this.state.cycleId =
                cycleId;

            this.state.currentCycle =
                cycle;

            this.state.lifecycle
                .lastCycleStartedAt =
                cycle.startedAt;

            this.isCycleRunning =
                true;

            return cycle;
        };

    /* ======================================================================
       SECTION 112
       UPDATE CYCLE STAGE
       ====================================================================== */

    CoreClass.prototype.updateCycleStage =
        function updateCycleStage(
            stage,
            data = {}
        ) {
            const cycle =
                this.state.currentCycle;

            if (!cycle) {
                return null;
            }

            cycle.stage =
                stage;

            cycle.stageUpdatedAt =
                Date.now();

            cycle.outputs[
                stage
            ] = {
                ...safeObject(
                    cycle.outputs[
                        stage
                    ]
                ),

                ...deepClone(
                    safeObject(data)
                ),

                updatedAt:
                    Date.now()
            };

            this.emit(
                CORE_EVENTS.CYCLE_PROGRESS ||
                "cycle_progress",
                {
                    cycleId:
                        cycle.id,

                    stage,

                    data:
                        deepClone(
                            safeObject(data)
                        ),

                    timestamp:
                        Date.now()
                }
            );

            return cycle;
        };

    /* ======================================================================
       SECTION 113
       PROCESS COLLECTION STAGE
       ====================================================================== */

    CoreClass.prototype.executeCollectionStage =
        async function executeCollectionStage(
            lifecycleOptions
        ) {
            this.updateCycleStage(
                "collection"
            );

            this.setLifecycleStatus(
                ENGINE_LIFECYCLE_STATUS.COLLECTING,
                {
                    cycleId:
                        this.state.cycleId
                }
            );

            const collectionResult =
                await this.collectAllSources({
                    ...lifecycleOptions.collection,

                    preservePreviousData:
                        lifecycleOptions
                            .preservePreviousData,

                    signal:
                        this.abortController
                            ?.signal
                });

            const cycle =
                this.state.currentCycle;

            cycle.sourceCount =
                safeArray(
                    collectionResult.executions
                ).length;

            cycle.successfulSourceCount =
                safeArray(
                    collectionResult.executions
                )
                    .filter(
                        (execution) => {
                            return (
                                execution.status ===
                                "success"
                            );
                        }
                    )
                    .length;

            cycle.failedSourceCount =
                cycle.sourceCount -
                cycle.successfulSourceCount;

            cycle.observationCount =
                safeArray(
                    collectionResult.observations
                ).length;

            cycle.forecastCount =
                safeArray(
                    collectionResult.forecasts
                ).length;

            cycle.rainCellCount =
                safeArray(
                    collectionResult.rainCells
                ).length;

            cycle.errors.push(
                ...safeArray(
                    collectionResult.errors
                )
            );

            this.updateCycleStage(
                "collection",
                {
                    sourceCount:
                        cycle.sourceCount,

                    successfulSourceCount:
                        cycle.successfulSourceCount,

                    failedSourceCount:
                        cycle.failedSourceCount,

                    observationCount:
                        cycle.observationCount,

                    forecastCount:
                        cycle.forecastCount,

                    sourceRainCellCount:
                        cycle.rainCellCount
                }
            );

            return collectionResult;
        };

    /* ======================================================================
       SECTION 114
       PROCESS FUSION AND TRACKING STAGE
       ====================================================================== */

    CoreClass.prototype.executeFusionTrackingStage =
        function executeFusionTrackingStage(
            lifecycleOptions,
            collectionResult
        ) {
            this.updateCycleStage(
                "fusion_tracking"
            );

            this.setLifecycleStatus(
                ENGINE_LIFECYCLE_STATUS.PROCESSING,
                {
                    cycleId:
                        this.state.cycleId,

                    stage:
                        "fusion_tracking"
                }
            );

            const fusionTrackingResult =
                this.executeFusionAndTracking({
                    fusion: {
                        ...lifecycleOptions.fusion,

                        observations:
                            collectionResult
                                .observations,

                        forecasts:
                            collectionResult
                                .forecasts,

                        sourceCells:
                            collectionResult
                                .rainCells
                    },

                    tracking:
                        lifecycleOptions
                            .tracking
                });

            const trackedCells =
                safeArray(
                    fusionTrackingResult
                        ?.tracking
                        ?.rainCells
                );

            const cycle =
                this.state.currentCycle;

            cycle.trackedCellCount =
                trackedCells.length;

            this.updateCycleStage(
                "fusion_tracking",
                {
                    unifiedCellCount:
                        safeArray(
                            fusionTrackingResult
                                ?.fusion
                                ?.rainCells
                        ).length,

                    trackedCellCount:
                        trackedCells.length,

                    createdCellCount:
                        toFiniteNumber(
                            fusionTrackingResult
                                ?.tracking
                                ?.summary
                                ?.createdCellCount,
                            0
                        ),

                    updatedCellCount:
                        toFiniteNumber(
                            fusionTrackingResult
                                ?.tracking
                                ?.summary
                                ?.updatedCellCount,
                            0
                        ),

                    lostCellCount:
                        toFiniteNumber(
                            fusionTrackingResult
                                ?.tracking
                                ?.summary
                                ?.lostCellCount,
                            0
                        )
                }
            );

            return fusionTrackingResult;
        };

    /* ======================================================================
       SECTION 115
       PROCESS ETA STAGE
       ====================================================================== */

    CoreClass.prototype.executeEtaStage =
        function executeEtaStage(
            lifecycleOptions
        ) {
            this.updateCycleStage(
                "eta"
            );

            const etaResult =
                this.calculateNationalArrivalPredictions({
                    ...lifecycleOptions.eta,

                    cells:
                        this.getActiveTrackedCells({
                            minimumConfidence:
                                this.options
                                    .minConfidence
                        }),

                    locations:
                        this.getActiveLocations()
                });

            const cycle =
                this.state.currentCycle;

            cycle.predictionCount =
                toFiniteNumber(
                    etaResult
                        .selectedPredictionCount,
                    0
                );

            this.updateCycleStage(
                "eta",
                {
                    predictionCount:
                        cycle.predictionCount,

                    rawPredictionCount:
                        etaResult
                            .rawPredictionCount,

                    activeCellCount:
                        etaResult
                            .activeCellCount,

                    locationCount:
                        etaResult
                            .locationCount
                }
            );

            return etaResult;
        };

    /* ======================================================================
       SECTION 116
       PROCESS HORIZON STAGE
       ====================================================================== */

    CoreClass.prototype.executeHorizonStage =
        function executeHorizonStage(
            lifecycleOptions
        ) {
            this.updateCycleStage(
                "horizons"
            );

            const dashboard =
                this.executeHorizonAggregation({
                    ...lifecycleOptions.horizons,

                    horizons:
                        lifecycleOptions
                            .horizons
                            .horizons ||
                        [
                            6,
                            12,
                            24,
                            48,
                            72
                        ]
                });

            const cycle =
                this.state.currentCycle;

            cycle.affectedRegionCount =
                toFiniteNumber(
                    dashboard
                        ?.summary
                        ?.affectedRegionCount,
                    0
                );

            cycle.affectedGovernorateCount =
                toFiniteNumber(
                    dashboard
                        ?.summary
                        ?.affectedGovernorateCount,
                    0
                );

            this.updateCycleStage(
                "horizons",
                {
                    horizonCount:
                        safeArray(
                            dashboard
                                ?.horizonList
                        ).length,

                    affectedRegionCount:
                        cycle
                            .affectedRegionCount,

                    affectedGovernorateCount:
                        cycle
                            .affectedGovernorateCount,

                    rainingNowCount:
                        toFiniteNumber(
                            dashboard
                                ?.summary
                                ?.rainingNowCount,
                            0
                        ),

                    nationalRiskLevel:
                        dashboard
                            ?.summary
                            ?.nationalRiskLevel ||
                        "none"
                }
            );

            return dashboard;
        };

    /* ======================================================================
       SECTION 117
       EXECUTE ONE COMPLETE CYCLE
       ====================================================================== */

    CoreClass.prototype.runCycle =
        async function runCycle(
            options = {}
        ) {
            this.ensureLifecycleState();

            if (this.destroyed) {
                throw createLifecycleError(
                    "Rain arrival recovery core has been destroyed.",
                    "ENGINE_DESTROYED"
                );
            }

            const lifecycleOptions =
                this.normalizeLifecycleOptions(
                    options
                );

            if (
                this.isCycleRunning &&
                lifecycleOptions.skipIfRunning
            ) {
                this.state.lifecycle
                    .skippedCycles += 1;

                return {
                    status:
                        CYCLE_STATUS.SKIPPED,

                    reason:
                        "cycle_already_running",

                    currentCycleId:
                        this.state.currentCycle
                            ?.id ||
                        null,

                    timestamp:
                        Date.now()
                };
            }

            if (
                this.isCycleRunning &&
                !lifecycleOptions.skipIfRunning
            ) {
                this.abortCurrentCollection(
                    "New cycle requested."
                );
            }

            if (
                typeof AbortController ===
                "function"
            ) {
                this.abortController =
                    new AbortController();
            } else {
                this.abortController =
                    null;
            }

            const trigger =
                options.trigger ||
                "manual";

            const cycle =
                this.prepareProcessingCycle(
                    trigger
                );

            this.emit(
                CORE_EVENTS.CYCLE_STARTED ||
                "cycle_started",
                {
                    cycleId:
                        cycle.id,

                    trigger,

                    startedAt:
                        cycle.startedAt
                }
            );

            try {
                const processingPromise =
                    (async () => {
                        const collectionResult =
                            await this
                                .executeCollectionStage(
                                    lifecycleOptions
                                );

                        if (
                            this.abortController
                                ?.signal
                                ?.aborted
                        ) {
                            throw createLifecycleError(
                                "Cycle aborted after collection.",
                                "ABORT_ERR"
                            );
                        }

                        const fusionTrackingResult =
                            this
                                .executeFusionTrackingStage(
                                    lifecycleOptions,
                                    collectionResult
                                );

                        if (
                            this.abortController
                                ?.signal
                                ?.aborted
                        ) {
                            throw createLifecycleError(
                                "Cycle aborted after tracking.",
                                "ABORT_ERR"
                            );
                        }

                        const etaResult =
                            this.executeEtaStage(
                                lifecycleOptions
                            );

                        const dashboard =
                            this.executeHorizonStage(
                                lifecycleOptions
                            );

                        return {
                            collection:
                                collectionResult,

                            fusionTracking:
                                fusionTrackingResult,

                            eta:
                                etaResult,

                            dashboard
                        };
                    })();

                const outputs =
                    await this.executeWithCycleTimeout(
                        processingPromise,
                        lifecycleOptions
                            .cycleTimeoutMs,
                        this.abortController
                            ?.signal
                    );

                const hasSourceFailures =
                    cycle.failedSourceCount >
                    0;

                const hasSuccessfulSources =
                    cycle.successfulSourceCount >
                    0;

                cycle.status =
                    hasSourceFailures &&
                    hasSuccessfulSources
                        ? CYCLE_STATUS.PARTIAL
                        : CYCLE_STATUS.SUCCESS;

                cycle.completedAt =
                    Date.now();

                cycle.durationMs =
                    cycle.completedAt -
                    cycle.startedAt;

                cycle.stage =
                    "completed";

                cycle.outputs.summary = {
                    sourceCount:
                        cycle.sourceCount,

                    successfulSourceCount:
                        cycle
                            .successfulSourceCount,

                    failedSourceCount:
                        cycle
                            .failedSourceCount,

                    observationCount:
                        cycle
                            .observationCount,

                    forecastCount:
                        cycle
                            .forecastCount,

                    trackedCellCount:
                        cycle
                            .trackedCellCount,

                    predictionCount:
                        cycle
                            .predictionCount,

                    affectedRegionCount:
                        cycle
                            .affectedRegionCount,

                    affectedGovernorateCount:
                        cycle
                            .affectedGovernorateCount
                };

                this.state.lifecycle
                    .totalCycles += 1;

                if (
                    cycle.status ===
                    CYCLE_STATUS.SUCCESS
                ) {
                    this.state.lifecycle
                        .successfulCycles += 1;
                } else {
                    this.state.lifecycle
                        .partialCycles += 1;
                }

                this.state.lifecycle
                    .consecutiveFailures =
                    0;

                this.state.lifecycle
                    .lastSuccessfulCycleAt =
                    cycle.completedAt;

                this.state.lifecycle
                    .lastCycleCompletedAt =
                    cycle.completedAt;

                this.state.lifecycle
                    .lastError =
                    null;

                this.setLifecycleStatus(
                    this.isRunning
                        ? ENGINE_LIFECYCLE_STATUS.RUNNING
                        : ENGINE_LIFECYCLE_STATUS.IDLE,
                    {
                        cycleId:
                            cycle.id,

                        cycleStatus:
                            cycle.status
                    }
                );

                this.emit(
                    CORE_EVENTS.CYCLE_COMPLETED ||
                    "cycle_completed",
                    {
                        cycle:
                            deepClone(
                                cycle
                            ),

                        dashboard:
                            deepClone(
                                outputs.dashboard
                            )
                    }
                );

                return {
                    status:
                        cycle.status,

                    cycle:
                        deepClone(
                            cycle
                        ),

                    outputs:
                        deepClone(
                            outputs
                        )
                };

            } catch (error) {
                const normalizedError =
                    normalizeLifecycleError(
                        error
                    );

                cycle.completedAt =
                    Date.now();

                cycle.durationMs =
                    cycle.completedAt -
                    cycle.startedAt;

                cycle.errors.push(
                    normalizedError
                );

                if (
                    isAbortError(error)
                ) {
                    cycle.status =
                        CYCLE_STATUS.ABORTED;
                } else if (
                    isTimeoutError(error)
                ) {
                    cycle.status =
                        CYCLE_STATUS.TIMEOUT;
                } else {
                    cycle.status =
                        CYCLE_STATUS.FAILED;
                }

                cycle.stage =
                    "failed";

                this.state.lifecycle
                    .totalCycles += 1;

                this.state.lifecycle
                    .failedCycles += 1;

                this.state.lifecycle
                    .consecutiveFailures += 1;

                this.state.lifecycle
                    .lastCycleCompletedAt =
                    cycle.completedAt;

                this.state.lifecycle
                    .lastError =
                    normalizedError;

                this.setLifecycleStatus(
                    ENGINE_LIFECYCLE_STATUS.DEGRADED,
                    {
                        cycleId:
                            cycle.id,

                        cycleStatus:
                            cycle.status,

                        error:
                            normalizedError
                    }
                );

                this.emit(
                    CORE_EVENTS.CYCLE_FAILED ||
                    "cycle_failed",
                    {
                        cycle:
                            deepClone(
                                cycle
                            ),

                        error:
                            deepClone(
                                normalizedError
                            )
                    }
                );

                if (
                    lifecycleOptions.autoRecover &&
                    this.isRunning
                ) {
                    this.scheduleRecovery(
                        lifecycleOptions,
                        normalizedError
                    );
                }

                return {
                    status:
                        cycle.status,

                    cycle:
                        deepClone(
                            cycle
                        ),

                    error:
                        deepClone(
                            normalizedError
                        )
                };

            } finally {
                this.isCycleRunning =
                    false;

                this.state.currentCycle =
                    null;

                this.state.cycleHistory.push(
                    deepClone(
                        cycle
                    )
                );

                if (
                    this.state.cycleHistory
                        .length > 100
                ) {
                    this.state.cycleHistory =
                        this.state.cycleHistory
                            .slice(-100);
                }

                this.abortController =
                    null;
            }
        };

    /* ======================================================================
       SECTION 118
       SCHEDULE NEXT AUTOMATIC CYCLE
       ====================================================================== */

    CoreClass.prototype.scheduleNextCycle =
        function scheduleNextCycle(
            options = {}
        ) {
            const lifecycleOptions =
                this.normalizeLifecycleOptions(
                    options
                );

            if (
                !this.isRunning ||
                this.destroyed
            ) {
                return false;
            }

            if (this.collectionTimer) {
                global.clearTimeout(
                    this.collectionTimer
                );
            }

            const intervalMs =
                lifecycleOptions
                    .collectionIntervalMs;

            this.state.lifecycle
                .nextCycleAt =
                Date.now() +
                intervalMs;

            this.collectionTimer =
                global.setTimeout(
                    async () => {
                        if (
                            !this.isRunning ||
                            this.destroyed
                        ) {
                            return;
                        }

                        await this.runCycle({
                            ...lifecycleOptions,

                            trigger:
                                "automatic"
                        });

                        if (
                            this.isRunning &&
                            !this.destroyed
                        ) {
                            this.scheduleNextCycle(
                                lifecycleOptions
                            );
                        }
                    },
                    intervalMs
                );

            return true;
        };

    /* ======================================================================
       SECTION 119
       RECOVERY SCHEDULER
       ====================================================================== */

    CoreClass.prototype.scheduleRecovery =
        function scheduleRecovery(
            options = {},
            error = null
        ) {
            const lifecycleOptions =
                this.normalizeLifecycleOptions(
                    options
                );

            if (
                !this.isRunning ||
                this.destroyed
            ) {
                return false;
            }

            if (this.recoveryTimer) {
                global.clearTimeout(
                    this.recoveryTimer
                );
            }

            const consecutiveFailures =
                this.state.lifecycle
                    .consecutiveFailures;

            if (
                consecutiveFailures >=
                lifecycleOptions
                    .maximumConsecutiveFailures
            ) {
                this.setLifecycleStatus(
                    ENGINE_LIFECYCLE_STATUS.FAILED,
                    {
                        consecutiveFailures,

                        error:
                            deepClone(
                                error
                            )
                    }
                );

                this.isRunning =
                    false;

                return false;
            }

            const recoveryDelay =
                lifecycleOptions
                    .recoveryDelayMs *
                Math.min(
                    consecutiveFailures + 1,
                    5
                );

            this.state.lifecycle
                .recoveryCount += 1;

            this.setLifecycleStatus(
                ENGINE_LIFECYCLE_STATUS.RECOVERING,
                {
                    recoveryDelay,

                    consecutiveFailures,

                    error:
                        deepClone(
                            error
                        )
                }
            );

            this.recoveryTimer =
                global.setTimeout(
                    async () => {
                        if (
                            !this.isRunning ||
                            this.destroyed
                        ) {
                            return;
                        }

                        const recoveryResult =
                            await this.runCycle({
                                ...lifecycleOptions,

                                trigger:
                                    "recovery"
                            });

                        if (
                            recoveryResult.status ===
                            CYCLE_STATUS.SUCCESS ||
                            recoveryResult.status ===
                            CYCLE_STATUS.PARTIAL
                        ) {
                            this.scheduleNextCycle(
                                lifecycleOptions
                            );
                        }
                    },
                    recoveryDelay
                );

            return true;
        };

    /* ======================================================================
       SECTION 120
       MAINTENANCE LOOP
       ====================================================================== */

    CoreClass.prototype.runMaintenance =
        function runMaintenance() {
            const sourceCleanup =
                this.cleanupSourceData({
                    maximumObservationAgeMs:
                        6 *
                        60 *
                        60 *
                        1000,

                    maximumForecastAgeMs:
                        96 *
                        60 *
                        60 *
                        1000
                });

            const cellCleanup =
                this.cleanupLostCells(
                    6 *
                    60 *
                    60 *
                    1000
                );

            this.state.diagnostics
                .lastMaintenanceAt =
                Date.now();

            this.state.diagnostics
                .lastMaintenanceResult = {
                    sourceCleanup:
                        deepClone(
                            sourceCleanup
                        ),

                    cellCleanup:
                        deepClone(
                            cellCleanup
                        )
                };

            this.emit(
                CORE_EVENTS.MAINTENANCE_COMPLETED ||
                "maintenance_completed",
                {
                    sourceCleanup:
                        deepClone(
                            sourceCleanup
                        ),

                    cellCleanup:
                        deepClone(
                            cellCleanup
                        ),

                    timestamp:
                        Date.now()
                }
            );

            return {
                sourceCleanup,
                cellCleanup,
                completedAt:
                    Date.now()
            };
        };

    CoreClass.prototype.startMaintenanceLoop =
        function startMaintenanceLoop(
            options = {}
        ) {
            const lifecycleOptions =
                this.normalizeLifecycleOptions(
                    options
                );

            if (
                !lifecycleOptions
                    .executeMaintenance
            ) {
                return false;
            }

            if (this.maintenanceTimer) {
                global.clearInterval(
                    this.maintenanceTimer
                );
            }

            this.maintenanceTimer =
                global.setInterval(
                    () => {
                        if (
                            !this.isRunning ||
                            this.destroyed
                        ) {
                            return;
                        }

                        try {
                            this.runMaintenance();
                        } catch (error) {
                            this.logError(
                                "Rain arrival maintenance failed.",
                                error
                            );
                        }
                    },
                    lifecycleOptions
                        .maintenanceIntervalMs
                );

            return true;
        };

    /* ======================================================================
       SECTION 121
       HEARTBEAT LOOP
       ====================================================================== */

    CoreClass.prototype.startHeartbeatLoop =
        function startHeartbeatLoop(
            options = {}
        ) {
            const lifecycleOptions =
                this.normalizeLifecycleOptions(
                    options
                );

            if (this.heartbeatTimer) {
                global.clearInterval(
                    this.heartbeatTimer
                );
            }

            this.heartbeatTimer =
                global.setInterval(
                    () => {
                        if (
                            !this.isRunning ||
                            this.destroyed
                        ) {
                            return;
                        }

                        const heartbeat = {
                            timestamp:
                                Date.now(),

                            status:
                                this.state
                                    .lifecycle
                                    .status,

                            isCycleRunning:
                                this
                                    .isCycleRunning,

                            activeSourceCount:
                                this
                                    .getActiveSourceAdapters()
                                    .length,

                            activeLocationCount:
                                this
                                    .getActiveLocations()
                                    .length,

                            trackedCellCount:
                                this.cells.size,

                            predictionCount:
                                safeArray(
                                    this.state
                                        .arrivalPredictions
                                ).length,

                            consecutiveFailures:
                                this.state
                                    .lifecycle
                                    .consecutiveFailures
                        };

                        this.state.lifecycle
                            .heartbeatAt =
                            heartbeat.timestamp;

                        this.emit(
                            CORE_EVENTS.HEARTBEAT ||
                            "heartbeat",
                            deepClone(
                                heartbeat
                            )
                        );
                    },
                    lifecycleOptions
                        .heartbeatIntervalMs
                );

            return true;
        };

    /* ======================================================================
       SECTION 122
       START ENGINE
       ====================================================================== */

    CoreClass.prototype.start =
        async function start(
            options = {}
        ) {
            this.ensureLifecycleState();

            if (this.destroyed) {
                throw createLifecycleError(
                    "Cannot start a destroyed RainArrivalRecoveryCoreV32 instance.",
                    "ENGINE_DESTROYED"
                );
            }

            if (this.isRunning) {
                return {
                    started: false,

                    reason:
                        "already_running",

                    status:
                        this.state
                            .lifecycle
                            .status,

                    startedAt:
                        this.state
                            .lifecycle
                            .startedAt
                };
            }

            const lifecycleOptions =
                this.normalizeLifecycleOptions(
                    options
                );

            this.lifecycleOptions =
                deepClone(
                    lifecycleOptions
                );

            this.isRunning =
                true;

            this.state.lifecycle
                .startedAt =
                Date.now();

            this.state.lifecycle
                .stoppedAt =
                null;

            this.setLifecycleStatus(
                ENGINE_LIFECYCLE_STATUS.STARTING,
                {
                    runImmediately:
                        lifecycleOptions
                            .runImmediately
                }
            );

            this.startMaintenanceLoop(
                lifecycleOptions
            );

            this.startHeartbeatLoop(
                lifecycleOptions
            );

            this.emit(
                CORE_EVENTS.STARTED ||
                "started",
                {
                    startedAt:
                        this.state
                            .lifecycle
                            .startedAt,

                    options:
                        deepClone(
                            lifecycleOptions
                        )
                }
            );

            if (
                lifecycleOptions
                    .initialDelayMs >
                0
            ) {
                await sleep(
                    lifecycleOptions
                        .initialDelayMs
                );
            }

            let initialCycleResult =
                null;

            if (
                lifecycleOptions
                    .runImmediately &&
                this.isRunning
            ) {
                initialCycleResult =
                    await this.runCycle({
                        ...lifecycleOptions,

                        trigger:
                            "startup"
                    });
            }

            if (
                this.isRunning &&
                !this.recoveryTimer
            ) {
                this.setLifecycleStatus(
                    ENGINE_LIFECYCLE_STATUS.RUNNING,
                    {
                        initialCycleStatus:
                            initialCycleResult
                                ?.status ||
                            null
                    }
                );

                this.scheduleNextCycle(
                    lifecycleOptions
                );
            }

            return {
                started: true,

                status:
                    this.state
                        .lifecycle
                        .status,

                startedAt:
                    this.state
                        .lifecycle
                        .startedAt,

                initialCycle:
                    initialCycleResult
                        ? deepClone(
                            initialCycleResult
                        )
                        : null
            };
        };

    /* ======================================================================
       SECTION 123
       STOP ENGINE
       ====================================================================== */

    CoreClass.prototype.stop =
        async function stop(
            options = {}
        ) {
            this.ensureLifecycleState();

            if (
                !this.isRunning &&
                !this.isCycleRunning
            ) {
                this.setLifecycleStatus(
                    ENGINE_LIFECYCLE_STATUS.STOPPED
                );

                return {
                    stopped: false,

                    reason:
                        "already_stopped",

                    stoppedAt:
                        this.state
                            .lifecycle
                            .stoppedAt
                };
            }

            const safeOptions =
                safeObject(options);

            this.setLifecycleStatus(
                ENGINE_LIFECYCLE_STATUS.STOPPING
            );

            this.isRunning =
                false;

            if (this.collectionTimer) {
                global.clearTimeout(
                    this.collectionTimer
                );

                this.collectionTimer =
                    null;
            }

            if (this.recoveryTimer) {
                global.clearTimeout(
                    this.recoveryTimer
                );

                this.recoveryTimer =
                    null;
            }

            if (this.maintenanceTimer) {
                global.clearInterval(
                    this.maintenanceTimer
                );

                this.maintenanceTimer =
                    null;
            }

            if (this.heartbeatTimer) {
                global.clearInterval(
                    this.heartbeatTimer
                );

                this.heartbeatTimer =
                    null;
            }

            if (
                safeOptions.abortCurrentCycle !==
                false
            ) {
                this.abortCurrentCollection(
                    "Engine stopped."
                );
            }

            this.state.lifecycle
                .stoppedAt =
                Date.now();

            this.state.lifecycle
                .nextCycleAt =
                null;

            this.setLifecycleStatus(
                ENGINE_LIFECYCLE_STATUS.STOPPED
            );

            this.emit(
                CORE_EVENTS.STOPPED ||
                "stopped",
                {
                    stoppedAt:
                        this.state
                            .lifecycle
                            .stoppedAt,

                    abortedCurrentCycle:
                        safeOptions
                            .abortCurrentCycle !==
                        false
                }
            );

            return {
                stopped: true,

                status:
                    ENGINE_LIFECYCLE_STATUS.STOPPED,

                stoppedAt:
                    this.state
                        .lifecycle
                        .stoppedAt
            };
        };

    /* ======================================================================
       SECTION 124
       RESTART ENGINE
       ====================================================================== */

    CoreClass.prototype.restart =
        async function restart(
            options = {}
        ) {
            await this.stop({
                abortCurrentCycle:
                    true
            });

            const restartDelayMs =
                Math.max(
                    0,
                    toFiniteNumber(
                        options.restartDelayMs,
                        1000
                    )
                );

            if (restartDelayMs > 0) {
                await sleep(
                    restartDelayMs
                );
            }

            return this.start(
                options
            );
        };

    /* ======================================================================
       SECTION 125
       FORCE IMMEDIATE REFRESH
       ====================================================================== */

    CoreClass.prototype.refreshNow =
        async function refreshNow(
            options = {}
        ) {
            return this.runCycle({
                ...safeObject(options),

                trigger:
                    "manual_refresh",

                skipIfRunning:
                    options.skipIfRunning !==
                    false
            });
        };

    /* ======================================================================
       SECTION 126
       GET LIFECYCLE STATUS
       ====================================================================== */

    CoreClass.prototype.getLifecycleStatus =
        function getLifecycleStatus() {
            this.ensureLifecycleState();

            return {
                ...deepClone(
                    this.state.lifecycle
                ),

                isRunning:
                    this.isRunning,

                isCycleRunning:
                    this.isCycleRunning,

                destroyed:
                    this.destroyed,

                currentCycle:
                    this.state.currentCycle
                        ? deepClone(
                            this.state
                                .currentCycle
                        )
                        : null,

                activeSourceCount:
                    this
                        .getActiveSourceAdapters()
                        .length,

                registeredLocationCount:
                    this.locations.size,

                trackedCellCount:
                    this.cells.size,

                predictionCount:
                    safeArray(
                        this.state
                            .arrivalPredictions
                    ).length
            };
        };

    /* ======================================================================
       SECTION 127
       GET CYCLE HISTORY
       ====================================================================== */

    CoreClass.prototype.getCycleHistory =
        function getCycleHistory(
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
                    100
                );

            return deepClone(
                safeArray(
                    this.state
                        .cycleHistory
                )
                    .slice(
                        -safeLimit
                    )
                    .reverse()
            );
        };

    /* ======================================================================
       SECTION 128
       GET ENGINE HEALTH
       ====================================================================== */

    CoreClass.prototype.getEngineHealth =
        function getEngineHealth() {
            this.ensureLifecycleState();

            const sourceHealth =
                this.getSourcesHealth();

            const healthySources =
                sourceHealth.filter(
                    (source) => {
                        return (
                            source.status ===
                            "healthy"
                        );
                    }
                ).length;

            const degradedSources =
                sourceHealth.filter(
                    (source) => {
                        return (
                            source.status ===
                            "degraded"
                        );
                    }
                ).length;

            const unhealthySources =
                sourceHealth.filter(
                    (source) => {
                        return (
                            source.status ===
                            "unhealthy"
                        );
                    }
                ).length;

            const lastCycle =
                safeArray(
                    this.state
                        .cycleHistory
                )
                    .slice(-1)[0] ||
                null;

            let healthStatus =
                "healthy";

            if (
                this.state.lifecycle
                    .status ===
                ENGINE_LIFECYCLE_STATUS.FAILED ||
                unhealthySources >
                healthySources
            ) {
                healthStatus =
                    "unhealthy";
            } else if (
                this.state.lifecycle
                    .status ===
                ENGINE_LIFECYCLE_STATUS.DEGRADED ||
                degradedSources > 0 ||
                this.state.lifecycle
                    .consecutiveFailures >
                0
            ) {
                healthStatus =
                    "degraded";
            }

            return {
                status:
                    healthStatus,

                lifecycleStatus:
                    this.state
                        .lifecycle
                        .status,

                isRunning:
                    this.isRunning,

                isCycleRunning:
                    this.isCycleRunning,

                sourceHealth,

                sourceSummary: {
                    total:
                        sourceHealth.length,

                    healthy:
                        healthySources,

                    degraded:
                        degradedSources,

                    unhealthy:
                        unhealthySources
                },

                dataSummary: {
                    observationCount:
                        safeArray(
                            this.state
                                .observations
                        ).length,

                    forecastCount:
                        safeArray(
                            this.state
                                .forecasts
                        ).length,

                    trackedCellCount:
                        this.cells.size,

                    predictionCount:
                        safeArray(
                            this.state
                                .arrivalPredictions
                        ).length
                },

                cycleSummary: {
                    totalCycles:
                        this.state
                            .lifecycle
                            .totalCycles,

                    successfulCycles:
                        this.state
                            .lifecycle
                            .successfulCycles,

                    partialCycles:
                        this.state
                            .lifecycle
                            .partialCycles,

                    failedCycles:
                        this.state
                            .lifecycle
                            .failedCycles,

                    consecutiveFailures:
                        this.state
                            .lifecycle
                            .consecutiveFailures,

                    lastCycle:
                        lastCycle
                            ? deepClone(
                                lastCycle
                            )
                            : null
                },

                checkedAt:
                    Date.now()
            };
        };

    /* ======================================================================
       SECTION 129
       DESTROY ENGINE
       ====================================================================== */

    CoreClass.prototype.destroy =
        async function destroy() {
            if (this.destroyed) {
                return false;
            }

            await this.stop({
                abortCurrentCycle:
                    true
            });

            this.sourceAdapters.clear();

            this.locations.clear();

            this.cells.clear();

            if (
                this.eventBus &&
                typeof this.eventBus.clear ===
                "function"
            ) {
                this.eventBus.clear();
            }

            this.state.observations = [];
            this.state.forecasts = [];
            this.state.rainCells = [];
            this.state.arrivalPredictions = [];
            this.state.cityForecasts = [];
            this.state.horizonForecasts = {};
            this.state.horizonForecastList = [];
            this.state.regionSummaries = [];
            this.state.governorateSummaries = [];

            this.destroyed =
                true;

            this.setLifecycleStatus(
                ENGINE_LIFECYCLE_STATUS.DESTROYED
            );

            return true;
        };

    /* ======================================================================
       SECTION 130
       COMPATIBILITY ALIASES
       ====================================================================== */

    CoreClass.prototype.startEngine =
        CoreClass.prototype.start;

    CoreClass.prototype.stopEngine =
        CoreClass.prototype.stop;

    CoreClass.prototype.restartEngine =
        CoreClass.prototype.restart;

    CoreClass.prototype.runNow =
        CoreClass.prototype.refreshNow;

    CoreClass.prototype.executeCycle =
        CoreClass.prototype.runCycle;

    CoreClass.prototype.getStatus =
        CoreClass.prototype.getLifecycleStatus;

    CoreClass.prototype.getHealth =
        CoreClass.prototype.getEngineHealth;

    /* ======================================================================
       SECTION 131
       PART 8 EXPORT
       ====================================================================== */

    global.RainArrivalRecoveryCoreV32Part8 = {
        DEFAULT_COLLECTION_INTERVAL_MS,
        DEFAULT_INITIAL_DELAY_MS,
        DEFAULT_CYCLE_TIMEOUT_MS,
        DEFAULT_RECOVERY_DELAY_MS,
        DEFAULT_MAX_CONSECUTIVE_FAILURES,
        DEFAULT_MAINTENANCE_INTERVAL_MS,
        DEFAULT_HEARTBEAT_INTERVAL_MS,
        ENGINE_LIFECYCLE_STATUS,
        CYCLE_STATUS,
        createLifecycleError,
        normalizeLifecycleError,
        createCycleId,
        createCycleRecord
    };

})(window);

/* ==========================================================================
   RainGuard AI
   Rain Arrival Recovery Core V32

   PART 9
   Prediction Quality Validation + ETA Correction + Result Reliability Control
   ========================================================================== */

(function extendRainArrivalRecoveryCoreV32Part9(global) {
    "use strict";

    const CoreClass =
        global.RainArrivalRecoveryCoreV32;

    const Utils =
        global.RainArrivalRecoveryCoreV32Utils;

    const Constants =
        global.RainArrivalRecoveryCoreV32Constants;

    if (
        typeof CoreClass !== "function" ||
        !Utils ||
        !Constants
    ) {
        throw new Error(
            "RainArrivalRecoveryCoreV32 Parts 1 to 8 must be loaded before Part 9."
        );
    }

    const {
        toFiniteNumber,
        clamp,
        normalizePercentage,
        normalizeTimestamp,
        normalizeBearing,
        safeArray,
        safeObject,
        deepClone,
        average,
        weightedAverage,
        calculateDistanceKm,
        calculateAngularDifference
    } = Utils;

    const {
        RAIN_STATUS,
        CELL_STATUS,
        MOVEMENT_STATUS,
        CORE_EVENTS
    } = Constants;

    /* ======================================================================
       SECTION 132
       QUALITY CONTROL CONSTANTS
       ====================================================================== */

    const DEFAULT_MIN_VALID_ETA_MINUTES =
        0;

    const DEFAULT_MAX_VALID_ETA_HOURS =
        72;

    const DEFAULT_MAX_REASONABLE_SPEED_KMH =
        140;

    const DEFAULT_MIN_REASONABLE_SPEED_KMH =
        2;

    const DEFAULT_MAX_ETA_DIFFERENCE_HOURS =
        8;

    const DEFAULT_MAX_SOURCE_DISAGREEMENT =
        0.65;

    const DEFAULT_MIN_VALID_CONFIDENCE =
        0.18;

    const DEFAULT_CORRECTION_CONFIDENCE_PENALTY =
        0.08;

    const DEFAULT_REJECTION_CONFIDENCE =
        0.08;

    const DEFAULT_FORECAST_VALIDATION_RADIUS_KM =
        60;

    const DEFAULT_FORECAST_VALIDATION_TIME_MS =
        4 * 60 * 60 * 1000;

    const DEFAULT_STATIONARY_MAX_DISTANCE_KM =
        80;

    const DEFAULT_LOW_SPEED_MAX_ETA_HOURS =
        18;

    const DEFAULT_HISTORY_SPEED_LIMIT =
        8;

    const QUALITY_STATUS = Object.freeze({
        VALID: "valid",
        CORRECTED: "corrected",
        DEGRADED: "degraded",
        REJECTED: "rejected",
        UNVERIFIED: "unverified"
    });

    const QUALITY_ISSUE = Object.freeze({
        INVALID_LOCATION:
            "invalid_location",

        INVALID_CELL:
            "invalid_cell",

        INVALID_ETA:
            "invalid_eta",

        NEGATIVE_ETA:
            "negative_eta",

        ETA_TOO_LONG:
            "eta_too_long",

        INVALID_SPEED:
            "invalid_speed",

        SPEED_TOO_HIGH:
            "speed_too_high",

        SPEED_TOO_LOW:
            "speed_too_low",

        STATIONARY_LONG_RANGE:
            "stationary_long_range",

        DIRECTION_MISMATCH:
            "direction_mismatch",

        FORECAST_DISAGREEMENT:
            "forecast_disagreement",

        SOURCE_DISAGREEMENT:
            "source_disagreement",

        LOW_CONFIDENCE:
            "low_confidence",

        ARRIVAL_TIME_EXPIRED:
            "arrival_time_expired",

        DISTANCE_SPEED_MISMATCH:
            "distance_speed_mismatch",

        CELL_LOST:
            "cell_lost",

        DUPLICATE_PREDICTION:
            "duplicate_prediction",

        NO_SUPPORTING_DATA:
            "no_supporting_data"
    });

    /* ======================================================================
       SECTION 133
       QUALITY HELPERS
       ====================================================================== */

    function hasCoordinates(record) {
        return (
            Number.isFinite(
                Number(
                    record?.latitude
                )
            ) &&
            Number.isFinite(
                Number(
                    record?.longitude
                )
            )
        );
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

        return NaN;
    }

    function getPredictionDistanceKm(
        prediction
    ) {
        return Math.max(
            0,
            toFiniteNumber(
                prediction?.alongTrackDistanceKm ??
                prediction?.distanceKm,
                0
            )
        );
    }

    function getPredictionSpeedKmh(
        prediction
    ) {
        return Math.max(
            0,
            toFiniteNumber(
                prediction?.cellSpeedKmh ??
                prediction?.rawCellSpeedKmh,
                0
            )
        );
    }

    function getPredictionConfidence(
        prediction
    ) {
        return normalizePercentage(
            prediction?.confidence
        );
    }

    function calculateExpectedEtaFromDistance(
        distanceKm,
        speedKmh
    ) {
        const safeDistance =
            Math.max(
                0,
                toFiniteNumber(
                    distanceKm,
                    0
                )
            );

        const safeSpeed =
            Math.max(
                0.1,
                toFiniteNumber(
                    speedKmh,
                    0.1
                )
            );

        return (
            safeDistance /
            safeSpeed
        );
    }

    function calculateRelativeEtaDifference(
        etaA,
        etaB
    ) {
        const first =
            Math.max(
                0,
                toFiniteNumber(
                    etaA,
                    0
                )
            );

        const second =
            Math.max(
                0,
                toFiniteNumber(
                    etaB,
                    0
                )
            );

        return (
            Math.abs(
                first -
                second
            ) /
            Math.max(
                first,
                second,
                0.25
            )
        );
    }

    function createQualityIssue(
        code,
        severity,
        message,
        metadata = {}
    ) {
        return {
            code,

            severity,

            message,

            metadata:
                deepClone(
                    safeObject(
                        metadata
                    )
                ),

            createdAt:
                Date.now()
        };
    }

    function calculateQualityGrade(
        score
    ) {
        const normalizedScore =
            clamp(
                toFiniteNumber(
                    score,
                    0
                ),
                0,
                1
            );

        if (
            normalizedScore >=
            0.90
        ) {
            return "A";
        }

        if (
            normalizedScore >=
            0.78
        ) {
            return "B";
        }

        if (
            normalizedScore >=
            0.62
        ) {
            return "C";
        }

        if (
            normalizedScore >=
            0.45
        ) {
            return "D";
        }

        return "F";
    }

    function selectQualityStatus(
        score,
        corrected,
        rejected
    ) {
        if (rejected) {
            return QUALITY_STATUS.REJECTED;
        }

        if (
            corrected &&
            score >= 0.40
        ) {
            return QUALITY_STATUS.CORRECTED;
        }

        if (
            score < 0.40
        ) {
            return QUALITY_STATUS.DEGRADED;
        }

        if (
            score < 0.60
        ) {
            return QUALITY_STATUS.UNVERIFIED;
        }

        return QUALITY_STATUS.VALID;
    }

    /* ======================================================================
       SECTION 134
       QUALITY OPTION NORMALIZATION
       ====================================================================== */

    CoreClass.prototype.normalizeQualityOptions =
        function normalizeQualityOptions(
            options = {}
        ) {
            const safeOptions =
                safeObject(options);

            return {
                minimumEtaMinutes:
                    Math.max(
                        0,
                        toFiniteNumber(
                            safeOptions.minimumEtaMinutes,
                            DEFAULT_MIN_VALID_ETA_MINUTES
                        )
                    ),

                maximumEtaHours:
                    clamp(
                        toFiniteNumber(
                            safeOptions.maximumEtaHours,
                            this.options.maxEtaHours ||
                            DEFAULT_MAX_VALID_ETA_HOURS
                        ),
                        1,
                        168
                    ),

                maximumReasonableSpeedKmh:
                    Math.max(
                        20,
                        toFiniteNumber(
                            safeOptions.maximumReasonableSpeedKmh,
                            DEFAULT_MAX_REASONABLE_SPEED_KMH
                        )
                    ),

                minimumReasonableSpeedKmh:
                    Math.max(
                        0.1,
                        toFiniteNumber(
                            safeOptions.minimumReasonableSpeedKmh,
                            DEFAULT_MIN_REASONABLE_SPEED_KMH
                        )
                    ),

                maximumEtaDifferenceHours:
                    Math.max(
                        0.5,
                        toFiniteNumber(
                            safeOptions.maximumEtaDifferenceHours,
                            DEFAULT_MAX_ETA_DIFFERENCE_HOURS
                        )
                    ),

                maximumSourceDisagreement:
                    clamp(
                        toFiniteNumber(
                            safeOptions.maximumSourceDisagreement,
                            DEFAULT_MAX_SOURCE_DISAGREEMENT
                        ),
                        0,
                        1
                    ),

                minimumValidConfidence:
                    clamp(
                        toFiniteNumber(
                            safeOptions.minimumValidConfidence,
                            DEFAULT_MIN_VALID_CONFIDENCE
                        ),
                        0,
                        1
                    ),

                correctionConfidencePenalty:
                    clamp(
                        toFiniteNumber(
                            safeOptions.correctionConfidencePenalty,
                            DEFAULT_CORRECTION_CONFIDENCE_PENALTY
                        ),
                        0,
                        0.5
                    ),

                rejectionConfidence:
                    clamp(
                        toFiniteNumber(
                            safeOptions.rejectionConfidence,
                            DEFAULT_REJECTION_CONFIDENCE
                        ),
                        0,
                        1
                    ),

                forecastValidationRadiusKm:
                    Math.max(
                        5,
                        toFiniteNumber(
                            safeOptions.forecastValidationRadiusKm,
                            DEFAULT_FORECAST_VALIDATION_RADIUS_KM
                        )
                    ),

                forecastValidationTimeMs:
                    Math.max(
                        30 * 60 * 1000,
                        toFiniteNumber(
                            safeOptions.forecastValidationTimeMs,
                            DEFAULT_FORECAST_VALIDATION_TIME_MS
                        )
                    ),

                stationaryMaximumDistanceKm:
                    Math.max(
                        5,
                        toFiniteNumber(
                            safeOptions.stationaryMaximumDistanceKm,
                            DEFAULT_STATIONARY_MAX_DISTANCE_KM
                        )
                    ),

                lowSpeedMaximumEtaHours:
                    Math.max(
                        1,
                        toFiniteNumber(
                            safeOptions.lowSpeedMaximumEtaHours,
                            DEFAULT_LOW_SPEED_MAX_ETA_HOURS
                        )
                    ),

                rejectInvalidPredictions:
                    safeOptions.rejectInvalidPredictions !== false,

                applyAutomaticCorrections:
                    safeOptions.applyAutomaticCorrections !== false,

                preserveRejectedPredictions:
                    safeOptions.preserveRejectedPredictions === true
            };
        };

    /* ======================================================================
       SECTION 135
       VALIDATE CELL REFERENCE
       ====================================================================== */

    CoreClass.prototype.validatePredictionCell =
        function validatePredictionCell(
            prediction
        ) {
            const trackingId =
                prediction?.trackingId;

            if (!trackingId) {
                return {
                    valid: false,

                    cell: null,

                    issue:
                        createQualityIssue(
                            QUALITY_ISSUE.INVALID_CELL,
                            "high",
                            "Prediction does not contain a tracking ID."
                        )
                };
            }

            const cell =
                this.getTrackedCell(
                    trackingId
                );

            if (!cell) {
                return {
                    valid: false,

                    cell: null,

                    issue:
                        createQualityIssue(
                            QUALITY_ISSUE.INVALID_CELL,
                            "high",
                            "The tracked rain cell was not found.",
                            {
                                trackingId
                            }
                        )
                };
            }

            if (
                cell.status ===
                CELL_STATUS.LOST ||
                cell.status ===
                CELL_STATUS.DISSIPATED ||
                cell.active === false
            ) {
                return {
                    valid: false,

                    cell,

                    issue:
                        createQualityIssue(
                            QUALITY_ISSUE.CELL_LOST,
                            "high",
                            "The rain cell is no longer active.",
                            {
                                trackingId,

                                status:
                                    cell.status
                            }
                        )
                };
            }

            return {
                valid: true,

                cell,

                issue: null
            };
        };

    /* ======================================================================
       SECTION 136
       VALIDATE LOCATION REFERENCE
       ====================================================================== */

    CoreClass.prototype.validatePredictionLocation =
        function validatePredictionLocation(
            prediction
        ) {
            const locationId =
                prediction?.locationId;

            if (!locationId) {
                return {
                    valid: false,

                    location: null,

                    issue:
                        createQualityIssue(
                            QUALITY_ISSUE.INVALID_LOCATION,
                            "high",
                            "Prediction does not contain a location ID."
                        )
                };
            }

            const location =
                this.getLocation(
                    locationId
                );

            if (!location) {
                return {
                    valid: false,

                    location: null,

                    issue:
                        createQualityIssue(
                            QUALITY_ISSUE.INVALID_LOCATION,
                            "high",
                            "The target location was not found.",
                            {
                                locationId
                            }
                        )
                };
            }

            if (!hasCoordinates(location)) {
                return {
                    valid: false,

                    location,

                    issue:
                        createQualityIssue(
                            QUALITY_ISSUE.INVALID_LOCATION,
                            "high",
                            "The target location has invalid coordinates.",
                            {
                                locationId
                            }
                        )
                };
            }

            return {
                valid: true,

                location,

                issue: null
            };
        };

    /* ======================================================================
       SECTION 137
       VALIDATE ETA VALUE
       ====================================================================== */

    CoreClass.prototype.validatePredictionEta =
        function validatePredictionEta(
            prediction,
            options = {}
        ) {
            const qualityOptions =
                this.normalizeQualityOptions(
                    options
                );

            const issues = [];

            const etaHours =
                getPredictionEtaHours(
                    prediction
                );

            if (
                !Number.isFinite(
                    etaHours
                )
            ) {
                issues.push(
                    createQualityIssue(
                        QUALITY_ISSUE.INVALID_ETA,
                        "high",
                        "ETA value is missing or invalid."
                    )
                );

                return {
                    valid: false,

                    etaHours: null,

                    issues
                };
            }

            if (etaHours < 0) {
                issues.push(
                    createQualityIssue(
                        QUALITY_ISSUE.NEGATIVE_ETA,
                        "high",
                        "ETA value is negative.",
                        {
                            etaHours
                        }
                    )
                );
            }

            if (
                etaHours >
                qualityOptions.maximumEtaHours
            ) {
                issues.push(
                    createQualityIssue(
                        QUALITY_ISSUE.ETA_TOO_LONG,
                        "high",
                        "ETA exceeds the supported forecast horizon.",
                        {
                            etaHours,

                            maximumEtaHours:
                                qualityOptions
                                    .maximumEtaHours
                        }
                    )
                );
            }

            const arrivalTimestamp =
                normalizeTimestamp(
                    prediction
                        .arrivalTimestamp
                );

            if (
                prediction.rainingNow !==
                true &&
                Number.isFinite(
                    arrivalTimestamp
                ) &&
                arrivalTimestamp <
                Date.now() -
                10 * 60 * 1000
            ) {
                issues.push(
                    createQualityIssue(
                        QUALITY_ISSUE.ARRIVAL_TIME_EXPIRED,
                        "high",
                        "Predicted arrival timestamp has already expired.",
                        {
                            arrivalTimestamp
                        }
                    )
                );
            }

            return {
                valid:
                    issues.length === 0,

                etaHours,

                issues
            };
        };

    /* ======================================================================
       SECTION 138
       VALIDATE SPEED AND DISTANCE
       ====================================================================== */

    CoreClass.prototype.validatePredictionMovement =
        function validatePredictionMovement(
            prediction,
            cell,
            location,
            options = {}
        ) {
            const qualityOptions =
                this.normalizeQualityOptions(
                    options
                );

            const issues = [];

            let speedKmh =
                getPredictionSpeedKmh(
                    prediction
                );

            const distanceKm =
                calculateDistanceKm(
                    cell.latitude,
                    cell.longitude,
                    location.latitude,
                    location.longitude
                );

            const etaHours =
                getPredictionEtaHours(
                    prediction
                );

            if (
                !Number.isFinite(
                    speedKmh
                ) ||
                speedKmh < 0
            ) {
                issues.push(
                    createQualityIssue(
                        QUALITY_ISSUE.INVALID_SPEED,
                        "high",
                        "Cell speed is invalid.",
                        {
                            speedKmh
                        }
                    )
                );

                speedKmh = 0;
            }

            if (
                speedKmh >
                qualityOptions
                    .maximumReasonableSpeedKmh
            ) {
                issues.push(
                    createQualityIssue(
                        QUALITY_ISSUE.SPEED_TOO_HIGH,
                        "high",
                        "Cell speed exceeds the reasonable movement limit.",
                        {
                            speedKmh,

                            maximumReasonableSpeedKmh:
                                qualityOptions
                                    .maximumReasonableSpeedKmh
                        }
                    )
                );
            }

            if (
                speedKmh <
                qualityOptions
                    .minimumReasonableSpeedKmh &&
                distanceKm >
                qualityOptions
                    .stationaryMaximumDistanceKm
            ) {
                issues.push(
                    createQualityIssue(
                        QUALITY_ISSUE.SPEED_TOO_LOW,
                        "medium",
                        "Cell speed is too low for the target distance.",
                        {
                            speedKmh,

                            distanceKm
                        }
                    )
                );
            }

            if (
                cell.movementStatus ===
                MOVEMENT_STATUS.STATIONARY &&
                distanceKm >
                qualityOptions
                    .stationaryMaximumDistanceKm
            ) {
                issues.push(
                    createQualityIssue(
                        QUALITY_ISSUE.STATIONARY_LONG_RANGE,
                        "high",
                        "A stationary cell cannot support a long-range ETA.",
                        {
                            distanceKm,

                            maximumDistanceKm:
                                qualityOptions
                                    .stationaryMaximumDistanceKm
                        }
                    )
                );
            }

            const expectedEtaHours =
                speedKmh > 0
                    ? calculateExpectedEtaFromDistance(
                        Math.max(
                            0,
                            toFiniteNumber(
                                prediction
                                    .alongTrackDistanceKm,
                                distanceKm
                            )
                        ),
                        speedKmh
                    )
                    : null;

            if (
                Number.isFinite(
                    etaHours
                ) &&
                Number.isFinite(
                    expectedEtaHours
                )
            ) {
                const etaDifferenceHours =
                    Math.abs(
                        etaHours -
                        expectedEtaHours
                    );

                const relativeDifference =
                    calculateRelativeEtaDifference(
                        etaHours,
                        expectedEtaHours
                    );

                if (
                    etaDifferenceHours >
                    qualityOptions
                        .maximumEtaDifferenceHours &&
                    relativeDifference >
                    0.60
                ) {
                    issues.push(
                        createQualityIssue(
                            QUALITY_ISSUE.DISTANCE_SPEED_MISMATCH,
                            "high",
                            "ETA does not agree with cell speed and distance.",
                            {
                                etaHours,

                                expectedEtaHours,

                                etaDifferenceHours,

                                distanceKm,

                                speedKmh
                            }
                        )
                    );
                }
            }

            return {
                valid:
                    !issues.some(
                        (issue) => {
                            return (
                                issue.severity ===
                                "high"
                            );
                        }
                    ),

                speedKmh,

                distanceKm,

                expectedEtaHours,

                issues
            };
        };

    /* ======================================================================
       SECTION 139
       VALIDATE MOVEMENT DIRECTION
       ====================================================================== */

    CoreClass.prototype.validatePredictionDirection =
        function validatePredictionDirection(
            prediction,
            cell,
            location
        ) {
            const issues = [];

            const cellDirection =
                normalizeBearing(
                    cell.directionDegrees
                );

            const targetBearing =
                Number.isFinite(
                    Number(
                        prediction.targetBearing
                    )
                )
                    ? normalizeBearing(
                        prediction.targetBearing
                    )
                    : Utils.calculateBearingDegrees(
                        cell.latitude,
                        cell.longitude,
                        location.latitude,
                        location.longitude
                    );

            const differenceDegrees =
                calculateAngularDifference(
                    cellDirection,
                    targetBearing
                );

            const alignment =
                clamp(
                    1 -
                    differenceDegrees /
                    180,
                    0,
                    1
                );

            if (
                prediction.rainingNow !==
                true &&
                differenceDegrees >
                95
            ) {
                issues.push(
                    createQualityIssue(
                        QUALITY_ISSUE.DIRECTION_MISMATCH,
                        "high",
                        "Target location is behind the current movement direction.",
                        {
                            cellDirection,

                            targetBearing,

                            differenceDegrees,

                            alignment
                        }
                    )
                );
            } else if (
                differenceDegrees >
                65
            ) {
                issues.push(
                    createQualityIssue(
                        QUALITY_ISSUE.DIRECTION_MISMATCH,
                        "medium",
                        "Target location is near the edge of the projected path.",
                        {
                            cellDirection,

                            targetBearing,

                            differenceDegrees,

                            alignment
                        }
                    )
                );
            }

            return {
                valid:
                    !issues.some(
                        (issue) => {
                            return (
                                issue.severity ===
                                "high"
                            );
                        }
                    ),

                cellDirection,

                targetBearing,

                differenceDegrees,

                alignment,

                issues
            };
        };

    /* ======================================================================
       SECTION 140
       FORECAST CONSISTENCY VALIDATION
       ====================================================================== */

    CoreClass.prototype.validateForecastConsistency =
        function validateForecastConsistency(
            prediction,
            location,
            options = {}
        ) {
            const qualityOptions =
                this.normalizeQualityOptions(
                    options
                );

            const arrivalTimestamp =
                normalizeTimestamp(
                    prediction
                        .arrivalTimestamp
                );

            const supportingForecasts =
                safeArray(
                    this.state.forecasts
                )
                    .map((forecast) => {
                        if (
                            !hasCoordinates(
                                forecast
                            )
                        ) {
                            return null;
                        }

                        const distanceKm =
                            calculateDistanceKm(
                                location.latitude,
                                location.longitude,
                                forecast.latitude,
                                forecast.longitude
                            );

                        const forecastTimestamp =
                            normalizeTimestamp(
                                forecast
                                    .forecastTimestamp
                            );

                        const timeDifferenceMs =
                            Math.abs(
                                forecastTimestamp -
                                arrivalTimestamp
                            );

                        if (
                            distanceKm >
                            qualityOptions
                                .forecastValidationRadiusKm ||
                            timeDifferenceMs >
                            qualityOptions
                                .forecastValidationTimeMs
                        ) {
                            return null;
                        }

                        const probability =
                            normalizePercentage(
                                forecast
                                    .rainProbability
                            );

                        const confidence =
                            normalizePercentage(
                                forecast
                                    .confidence
                            );

                        const intensity =
                            Math.max(
                                0,
                                toFiniteNumber(
                                    forecast
                                        .rainIntensity,
                                    0
                                )
                            );

                        const rainSupport =
                            clamp(
                                probability * 0.50 +
                                confidence * 0.25 +
                                clamp(
                                    intensity /
                                    20,
                                    0,
                                    1
                                ) *
                                0.25,
                                0,
                                1
                            );

                        return {
                            forecastId:
                                forecast.id,

                            source:
                                forecast.source,

                            distanceKm,

                            timeDifferenceMs,

                            probability,

                            confidence,

                            intensity,

                            rainSupport
                        };
                    })
                    .filter(Boolean);

            const supportScore =
                supportingForecasts.length
                    ? weightedAverage(
                        supportingForecasts.map(
                            (forecast) => {
                                return {
                                    value:
                                        forecast
                                            .rainSupport,

                                    weight:
                                        Math.max(
                                            0.1,
                                            1 -
                                            forecast
                                                .distanceKm /
                                            qualityOptions
                                                .forecastValidationRadiusKm
                                        )
                                };
                            }
                        ),
                        "value",
                        "weight"
                    )
                    : 0;

            const issues = [];

            if (
                supportingForecasts.length ===
                0
            ) {
                issues.push(
                    createQualityIssue(
                        QUALITY_ISSUE.NO_SUPPORTING_DATA,
                        "low",
                        "No forecast records support the ETA at the target location."
                    )
                );
            } else if (
                supportScore < 0.20 &&
                prediction.rainingNow !==
                true
            ) {
                issues.push(
                    createQualityIssue(
                        QUALITY_ISSUE.FORECAST_DISAGREEMENT,
                        "medium",
                        "Forecast data provides weak support for the ETA.",
                        {
                            supportScore,

                            forecastCount:
                                supportingForecasts
                                    .length
                        }
                    )
                );
            }

            return {
                valid:
                    supportScore >= 0.20 ||
                    prediction.rainingNow ===
                    true,

                supportScore,

                supportingForecasts,

                issues
            };
        };

    /* ======================================================================
       SECTION 141
       SOURCE AGREEMENT VALIDATION
       ====================================================================== */

    CoreClass.prototype.validateSourceAgreement =
        function validateSourceAgreement(
            prediction,
            options = {}
        ) {
            const qualityOptions =
                this.normalizeQualityOptions(
                    options
                );

            const sourceValues =
                safeArray(
                    prediction
                        .forecastMatches
                )
                    .map((match) => {
                        return {
                            source:
                                match.source ||
                                "unknown",

                            score:
                                clamp(
                                    toFiniteNumber(
                                        match.supportScore,
                                        0
                                    ),
                                    0,
                                    1
                                )
                        };
                    });

            if (
                sourceValues.length <
                2
            ) {
                return {
                    valid: true,

                    agreementScore:
                        sourceValues.length ===
                        1
                            ? sourceValues[0]
                                .score
                            : 0.5,

                    disagreement:
                        0,

                    issues: []
                };
            }

            const scores =
                sourceValues.map(
                    (item) => item.score
                );

            const maximumScore =
                Math.max(
                    ...scores
                );

            const minimumScore =
                Math.min(
                    ...scores
                );

            const disagreement =
                maximumScore -
                minimumScore;

            const agreementScore =
                clamp(
                    1 -
                    disagreement,
                    0,
                    1
                );

            const issues = [];

            if (
                disagreement >
                qualityOptions
                    .maximumSourceDisagreement
            ) {
                issues.push(
                    createQualityIssue(
                        QUALITY_ISSUE.SOURCE_DISAGREEMENT,
                        "medium",
                        "Weather sources strongly disagree about this arrival prediction.",
                        {
                            disagreement,

                            maximumScore,

                            minimumScore,

                            sources:
                                sourceValues
                        }
                    )
                );
            }

            return {
                valid:
                    disagreement <=
                    qualityOptions
                        .maximumSourceDisagreement,

                agreementScore,

                disagreement,

                issues
            };
        };

    /* ======================================================================
       SECTION 142
       CALCULATE PREDICTION QUALITY SCORE
       ====================================================================== */

    CoreClass.prototype.calculatePredictionQualityScore =
        function calculatePredictionQualityScore(
            validation
        ) {
            const safeValidation =
                safeObject(
                    validation
                );

            const confidence =
                normalizePercentage(
                    safeValidation
                        .originalConfidence
                );

            const directionScore =
                clamp(
                    safeValidation
                        .direction
                        ?.alignment,
                    0,
                    1
                );

            const forecastScore =
                clamp(
                    safeValidation
                        .forecast
                        ?.supportScore,
                    0,
                    1
                );

            const agreementScore =
                clamp(
                    safeValidation
                        .sources
                        ?.agreementScore,
                    0,
                    1
                );

            const movementScore =
                safeValidation
                    .movement
                    ?.valid
                    ? 1
                    : 0.35;

            const etaScore =
                safeValidation
                    .eta
                    ?.valid
                    ? 1
                    : 0.25;

            const referenceScore =
                safeValidation
                    .cell
                    ?.valid &&
                safeValidation
                    .location
                    ?.valid
                    ? 1
                    : 0;

            const issuePenalty =
                safeArray(
                    safeValidation.issues
                )
                    .reduce(
                        (
                            penalty,
                            issue
                        ) => {
                            if (
                                issue.severity ===
                                "high"
                            ) {
                                return (
                                    penalty +
                                    0.22
                                );
                            }

                            if (
                                issue.severity ===
                                "medium"
                            ) {
                                return (
                                    penalty +
                                    0.10
                                );
                            }

                            return (
                                penalty +
                                0.03
                            );
                        },
                        0
                    );

            return clamp(
                confidence * 0.24 +
                directionScore * 0.16 +
                forecastScore * 0.17 +
                agreementScore * 0.12 +
                movementScore * 0.13 +
                etaScore * 0.10 +
                referenceScore * 0.08 -
                issuePenalty,
                0,
                1
            );
        };

    /* ======================================================================
       SECTION 143
       CORRECT PREDICTION ETA
       ====================================================================== */

    CoreClass.prototype.correctPredictionEta =
        function correctPredictionEta(
            prediction,
            validation,
            options = {}
        ) {
            const qualityOptions =
                this.normalizeQualityOptions(
                    options
                );

            const corrected =
                deepClone(
                    prediction
                );

            const corrections = [];

            let etaHours =
                getPredictionEtaHours(
                    corrected
                );

            const movement =
                safeValidationValue(
                    validation,
                    "movement"
                );

            if (
                corrected.rainingNow ===
                true
            ) {
                etaHours = 0;

                corrections.push({
                    field:
                        "etaHours",

                    reason:
                        "raining_now",

                    previousValue:
                        prediction.etaHours,

                    newValue:
                        0
                });
            } else if (
                qualityOptions
                    .applyAutomaticCorrections &&
                Number.isFinite(
                    movement.expectedEtaHours
                ) &&
                (
                    !Number.isFinite(
                        etaHours
                    ) ||
                    calculateRelativeEtaDifference(
                        etaHours,
                        movement
                            .expectedEtaHours
                    ) >
                    0.55
                )
            ) {
                const correctedEta =
                    clamp(
                        movement
                            .expectedEtaHours,
                        qualityOptions
                            .minimumEtaMinutes /
                        60,
                        qualityOptions
                            .maximumEtaHours
                    );

                corrections.push({
                    field:
                        "etaHours",

                    reason:
                        "distance_speed_recalculation",

                    previousValue:
                        etaHours,

                    newValue:
                        correctedEta
                });

                etaHours =
                    correctedEta;
            }

            if (
                Number.isFinite(
                    etaHours
                )
            ) {
                etaHours =
                    clamp(
                        etaHours,
                        qualityOptions
                            .minimumEtaMinutes /
                        60,
                        qualityOptions
                            .maximumEtaHours
                    );

                corrected.etaHours =
                    etaHours;

                corrected.etaMinutes =
                    Math.round(
                        etaHours *
                        60
                    );

                corrected.arrivalTimestamp =
                    Date.now() +
                    etaHours *
                    60 *
                    60 *
                    1000;

                corrected.arrivalIso =
                    new Date(
                        corrected
                            .arrivalTimestamp
                    ).toISOString();

                if (
                    corrected
                        .arrivalWindow
                ) {
                    const uncertainty =
                        Math.max(
                            0.25,
                            toFiniteNumber(
                                corrected
                                    .arrivalWindow
                                    .uncertaintyHours,
                                etaHours *
                                0.20
                            )
                        );

                    corrected.arrivalWindow = {
                        earliestHours:
                            Math.max(
                                0,
                                etaHours -
                                uncertainty
                            ),

                        expectedHours:
                            etaHours,

                        latestHours:
                            etaHours +
                            uncertainty,

                        uncertaintyHours:
                            uncertainty
                    };
                }
            }

            const correctionPenalty =
                corrections.length *
                qualityOptions
                    .correctionConfidencePenalty;

            corrected.confidence =
                clamp(
                    getPredictionConfidence(
                        corrected
                    ) -
                    correctionPenalty,
                    0,
                    1
                );

            corrected.corrections =
                corrections;

            corrected.corrected =
                corrections.length > 0;

            corrected.correctedAt =
                corrections.length > 0
                    ? Date.now()
                    : null;

            return corrected;
        };

    function safeValidationValue(
        validation,
        key
    ) {
        return safeObject(
            safeObject(
                validation
            )[key]
        );
    }

    /* ======================================================================
       SECTION 144
       VALIDATE ONE ARRIVAL PREDICTION
       ====================================================================== */

    CoreClass.prototype.validateArrivalPrediction =
        function validateArrivalPrediction(
            prediction,
            options = {}
        ) {
            const qualityOptions =
                this.normalizeQualityOptions(
                    options
                );

            const issues = [];

            const cellValidation =
                this.validatePredictionCell(
                    prediction
                );

            if (
                cellValidation.issue
            ) {
                issues.push(
                    cellValidation.issue
                );
            }

            const locationValidation =
                this.validatePredictionLocation(
                    prediction
                );

            if (
                locationValidation.issue
            ) {
                issues.push(
                    locationValidation.issue
                );
            }

            const etaValidation =
                this.validatePredictionEta(
                    prediction,
                    qualityOptions
                );

            issues.push(
                ...safeArray(
                    etaValidation.issues
                )
            );

            let movementValidation = {
                valid: false,
                issues: []
            };

            let directionValidation = {
                valid: false,
                issues: [],
                alignment: 0
            };

            let forecastValidation = {
                valid: false,
                issues: [],
                supportScore: 0
            };

            if (
                cellValidation.valid &&
                locationValidation.valid
            ) {
                movementValidation =
                    this.validatePredictionMovement(
                        prediction,
                        cellValidation.cell,
                        locationValidation
                            .location,
                        qualityOptions
                    );

                directionValidation =
                    this.validatePredictionDirection(
                        prediction,
                        cellValidation.cell,
                        locationValidation
                            .location
                    );

                forecastValidation =
                    this.validateForecastConsistency(
                        prediction,
                        locationValidation
                            .location,
                        qualityOptions
                    );

                issues.push(
                    ...safeArray(
                        movementValidation
                            .issues
                    ),

                    ...safeArray(
                        directionValidation
                            .issues
                    ),

                    ...safeArray(
                        forecastValidation
                            .issues
                    )
                );
            }

            const sourceValidation =
                this.validateSourceAgreement(
                    prediction,
                    qualityOptions
                );

            issues.push(
                ...safeArray(
                    sourceValidation.issues
                )
            );

            if (
                getPredictionConfidence(
                    prediction
                ) <
                qualityOptions
                    .minimumValidConfidence
            ) {
                issues.push(
                    createQualityIssue(
                        QUALITY_ISSUE.LOW_CONFIDENCE,
                        "medium",
                        "Prediction confidence is below the accepted minimum.",
                        {
                            confidence:
                                getPredictionConfidence(
                                    prediction
                                ),

                            minimumConfidence:
                                qualityOptions
                                    .minimumValidConfidence
                        }
                    )
                );
            }

            const validation = {
                predictionId:
                    prediction.id,

                locationId:
                    prediction.locationId,

                trackingId:
                    prediction.trackingId,

                validatedAt:
                    Date.now(),

                originalConfidence:
                    getPredictionConfidence(
                        prediction
                    ),

                cell:
                    cellValidation,

                location:
                    locationValidation,

                eta:
                    etaValidation,

                movement:
                    movementValidation,

                direction:
                    directionValidation,

                forecast:
                    forecastValidation,

                sources:
                    sourceValidation,

                issues
            };

            const qualityScore =
                this.calculatePredictionQualityScore(
                    validation
                );

            const hasHighSeverityIssue =
                issues.some(
                    (issue) => {
                        return (
                            issue.severity ===
                            "high"
                        );
                    }
                );

            let correctedPrediction =
                this.correctPredictionEta(
                    prediction,
                    validation,
                    qualityOptions
                );

            let rejected =
                false;

            if (
                qualityOptions
                    .rejectInvalidPredictions &&
                (
                    !cellValidation.valid ||
                    !locationValidation.valid ||
                    (
                        hasHighSeverityIssue &&
                        qualityScore <
                        0.35
                    )
                )
            ) {
                rejected =
                    true;

                correctedPrediction.status =
                    RAIN_STATUS.NO_RAIN;

                correctedPrediction.etaHours =
                    null;

                correctedPrediction.etaMinutes =
                    null;

                correctedPrediction.arrivalTimestamp =
                    null;

                correctedPrediction.arrivalIso =
                    null;

                correctedPrediction.confidence =
                    qualityOptions
                        .rejectionConfidence;
            }

            const qualityStatus =
                selectQualityStatus(
                    qualityScore,
                    correctedPrediction
                        .corrected,
                    rejected
                );

            correctedPrediction.quality = {
                status:
                    qualityStatus,

                score:
                    qualityScore,

                grade:
                    calculateQualityGrade(
                        qualityScore
                    ),

                rejected,

                corrected:
                    correctedPrediction
                        .corrected ===
                    true,

                issueCount:
                    issues.length,

                highSeverityIssueCount:
                    issues.filter(
                        (issue) => {
                            return (
                                issue.severity ===
                                "high"
                            );
                        }
                    ).length,

                mediumSeverityIssueCount:
                    issues.filter(
                        (issue) => {
                            return (
                                issue.severity ===
                                "medium"
                            );
                        }
                    ).length,

                lowSeverityIssueCount:
                    issues.filter(
                        (issue) => {
                            return (
                                issue.severity ===
                                "low"
                            );
                        }
                    ).length,

                forecastSupportScore:
                    forecastValidation
                        .supportScore ||
                    0,

                sourceAgreementScore:
                    sourceValidation
                        .agreementScore ||
                    0,

                directionAlignment:
                    directionValidation
                        .alignment ||
                    0,

                validatedAt:
                    validation.validatedAt
            };

            correctedPrediction.qualityIssues =
                deepClone(
                    issues
                );

            return {
                valid:
                    !rejected,

                rejected,

                corrected:
                    correctedPrediction
                        .corrected ===
                    true,

                qualityScore,

                qualityStatus,

                validation:
                    deepClone(
                        validation
                    ),

                prediction:
                    correctedPrediction
            };
        };

    /* ======================================================================
       SECTION 145
       DETECT DUPLICATE PREDICTIONS
       ====================================================================== */

    CoreClass.prototype.areArrivalPredictionsDuplicate =
        function areArrivalPredictionsDuplicate(
            predictionA,
            predictionB
        ) {
            if (
                !predictionA ||
                !predictionB
            ) {
                return false;
            }

            if (
                predictionA.id &&
                predictionB.id &&
                predictionA.id ===
                predictionB.id
            ) {
                return true;
            }

            if (
                predictionA.locationId !==
                predictionB.locationId
            ) {
                return false;
            }

            if (
                predictionA.trackingId !==
                predictionB.trackingId
            ) {
                return false;
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
                !Number.isFinite(
                    etaA
                ) ||
                !Number.isFinite(
                    etaB
                )
            ) {
                return (
                    predictionA.status ===
                    predictionB.status
                );
            }

            return (
                Math.abs(
                    etaA -
                    etaB
                ) <=
                0.5
            );
        };

    /* ======================================================================
       SECTION 146
       SELECT BEST DUPLICATE PREDICTION
       ====================================================================== */

    CoreClass.prototype.selectBestDuplicatePrediction =
        function selectBestDuplicatePrediction(
            predictions
        ) {
            const validPredictions =
                safeArray(
                    predictions
                );

            if (!validPredictions.length) {
                return null;
            }

            return validPredictions
                .slice()
                .sort(
                    (
                        predictionA,
                        predictionB
                    ) => {
                        const qualityA =
                            toFiniteNumber(
                                predictionA
                                    .quality
                                    ?.score,
                                0
                            );

                        const qualityB =
                            toFiniteNumber(
                                predictionB
                                    .quality
                                    ?.score,
                                0
                            );

                        if (
                            qualityA !==
                            qualityB
                        ) {
                            return (
                                qualityB -
                                qualityA
                            );
                        }

                        const confidenceA =
                            getPredictionConfidence(
                                predictionA
                            );

                        const confidenceB =
                            getPredictionConfidence(
                                predictionB
                            );

                        if (
                            confidenceA !==
                            confidenceB
                        ) {
                            return (
                                confidenceB -
                                confidenceA
                            );
                        }

                        return (
                            getPredictionEtaHours(
                                predictionA
                            ) -
                            getPredictionEtaHours(
                                predictionB
                            )
                        );
                    }
                )[0];
        };

    /* ======================================================================
       SECTION 147
       DEDUPLICATE VALIDATED PREDICTIONS
       ====================================================================== */

    CoreClass.prototype.deduplicateArrivalPredictions =
        function deduplicateArrivalPredictions(
            predictions
        ) {
            const remaining =
                safeArray(
                    predictions
                )
                    .slice();

            const deduplicated = [];

            while (
                remaining.length
            ) {
                const seed =
                    remaining.shift();

                const duplicates = [
                    seed
                ];

                for (
                    let index =
                        remaining.length -
                        1;
                    index >= 0;
                    index -= 1
                ) {
                    const candidate =
                        remaining[index];

                    if (
                        this
                            .areArrivalPredictionsDuplicate(
                                seed,
                                candidate
                            )
                    ) {
                        duplicates.push(
                            candidate
                        );

                        remaining.splice(
                            index,
                            1
                        );
                    }
                }

                const selected =
                    this
                        .selectBestDuplicatePrediction(
                            duplicates
                        );

                if (selected) {
                    selected.duplicatePredictionCount =
                        Math.max(
                            0,
                            duplicates.length -
                            1
                        );

                    selected.mergedPredictionIds =
                        duplicates.map(
                            (prediction) => {
                                return (
                                    prediction.id
                                );
                            }
                        );

                    deduplicated.push(
                        selected
                    );
                }
            }

            return deduplicated;
        };

    /* ======================================================================
       SECTION 148
       VALIDATE ALL ARRIVAL PREDICTIONS
       ====================================================================== */

    CoreClass.prototype.validateAllArrivalPredictions =
        function validateAllArrivalPredictions(
            options = {}
        ) {
            const qualityOptions =
                this.normalizeQualityOptions(
                    options
                );

            const predictions =
                safeArray(
                    options.predictions
                ).length
                    ? safeArray(
                        options.predictions
                    )
                    : safeArray(
                        this.state
                            .arrivalPredictions
                    );

            const validated = [];

            const rejected = [];

            const corrected = [];

            const degraded = [];

            predictions.forEach(
                (prediction) => {
                    const result =
                        this
                            .validateArrivalPrediction(
                                prediction,
                                qualityOptions
                            );

                    if (
                        result.rejected
                    ) {
                        rejected.push(
                            result.prediction
                        );

                        if (
                            qualityOptions
                                .preserveRejectedPredictions
                        ) {
                            validated.push(
                                result.prediction
                            );
                        }

                        return;
                    }

                    validated.push(
                        result.prediction
                    );

                    if (
                        result.corrected
                    ) {
                        corrected.push(
                            result.prediction
                        );
                    }

                    if (
                        result.qualityStatus ===
                        QUALITY_STATUS.DEGRADED ||
                        result.qualityStatus ===
                        QUALITY_STATUS.UNVERIFIED
                    ) {
                        degraded.push(
                            result.prediction
                        );
                    }
                }
            );

            const deduplicated =
                this.deduplicateArrivalPredictions(
                    validated
                );

            deduplicated.sort(
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
                        toFiniteNumber(
                            predictionB
                                .quality
                                ?.score,
                            0
                        ) -
                        toFiniteNumber(
                            predictionA
                                .quality
                                ?.score,
                            0
                        )
                    );
                }
            );

            return {
                generatedAt:
                    Date.now(),

                inputPredictionCount:
                    predictions.length,

                validatedPredictionCount:
                    deduplicated.length,

                correctedPredictionCount:
                    corrected.length,

                degradedPredictionCount:
                    degraded.length,

                rejectedPredictionCount:
                    rejected.length,

                duplicateRemovedCount:
                    Math.max(
                        0,
                        validated.length -
                        deduplicated.length
                    ),

                predictions:
                    deepClone(
                        deduplicated
                    ),

                rejectedPredictions:
                    deepClone(
                        rejected
                    ),

                correctedPredictions:
                    deepClone(
                        corrected
                    ),

                degradedPredictions:
                    deepClone(
                        degraded
                    )
            };
        };

    /* ======================================================================
       SECTION 149
       APPLY QUALITY-CONTROLLED PREDICTIONS
       ====================================================================== */

    CoreClass.prototype.applyValidatedArrivalPredictions =
        function applyValidatedArrivalPredictions(
            validationResult
        ) {
            const safeResult =
                safeObject(
                    validationResult
                );

            const predictions =
                safeArray(
                    safeResult.predictions
                );

            this.state.arrivalPredictions =
                deepClone(
                    predictions
                );

            this.state.cityForecasts =
                deepClone(
                    predictions.filter(
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

            this.state.rejectedArrivalPredictions =
                deepClone(
                    safeArray(
                        safeResult
                            .rejectedPredictions
                    )
                );

            this.state.correctedArrivalPredictions =
                deepClone(
                    safeArray(
                        safeResult
                            .correctedPredictions
                    )
                );

            this.state.diagnostics
                .predictionQualitySummary = {
                    inputPredictionCount:
                        toFiniteNumber(
                            safeResult
                                .inputPredictionCount,
                            0
                        ),

                    validatedPredictionCount:
                        predictions.length,

                    correctedPredictionCount:
                        toFiniteNumber(
                            safeResult
                                .correctedPredictionCount,
                            0
                        ),

                    degradedPredictionCount:
                        toFiniteNumber(
                            safeResult
                                .degradedPredictionCount,
                            0
                        ),

                    rejectedPredictionCount:
                        toFiniteNumber(
                            safeResult
                                .rejectedPredictionCount,
                            0
                        ),

                    duplicateRemovedCount:
                        toFiniteNumber(
                            safeResult
                                .duplicateRemovedCount,
                            0
                        ),

                    appliedAt:
                        Date.now()
                };

            this.emit(
                CORE_EVENTS.ETA_UPDATED,
                {
                    type:
                        "prediction_quality_control",

                    summary:
                        deepClone(
                            this.state
                                .diagnostics
                                .predictionQualitySummary
                        ),

                    predictions:
                        deepClone(
                            predictions
                        )
                }
            );

            return {
                applied:
                    true,

                predictionCount:
                    predictions.length,

                summary:
                    deepClone(
                        this.state
                            .diagnostics
                            .predictionQualitySummary
                    )
            };
        };

    /* ======================================================================
       SECTION 150
       EXECUTE QUALITY CONTROL
       ====================================================================== */

    CoreClass.prototype.executePredictionQualityControl =
        function executePredictionQualityControl(
            options = {}
        ) {
            const validationResult =
                this.validateAllArrivalPredictions(
                    options
                );

            const applicationResult =
                this.applyValidatedArrivalPredictions(
                    validationResult
                );

            return {
                generatedAt:
                    Date.now(),

                validation:
                    deepClone(
                        validationResult
                    ),

                application:
                    deepClone(
                        applicationResult
                    )
            };
        };

    /* ======================================================================
       SECTION 151
       BUILD QUALITY SUMMARY
       ====================================================================== */

    CoreClass.prototype.getPredictionQualitySummary =
        function getPredictionQualitySummary() {
            const predictions =
                safeArray(
                    this.state
                        .arrivalPredictions
                );

            const qualityScores =
                predictions
                    .map((prediction) => {
                        return toFiniteNumber(
                            prediction
                                .quality
                                ?.score,
                            NaN
                        );
                    })
                    .filter(
                        Number.isFinite
                    );

            const gradeCounts = {
                A: 0,
                B: 0,
                C: 0,
                D: 0,
                F: 0
            };

            const statusCounts = {
                valid: 0,
                corrected: 0,
                degraded: 0,
                rejected: 0,
                unverified: 0
            };

            predictions.forEach(
                (prediction) => {
                    const grade =
                        prediction
                            .quality
                            ?.grade;

                    const status =
                        prediction
                            .quality
                            ?.status;

                    if (
                        gradeCounts[
                            grade
                        ] !== undefined
                    ) {
                        gradeCounts[
                            grade
                        ] += 1;
                    }

                    if (
                        statusCounts[
                            status
                        ] !== undefined
                    ) {
                        statusCounts[
                            status
                        ] += 1;
                    }
                }
            );

            return {
                generatedAt:
                    Date.now(),

                predictionCount:
                    predictions.length,

                averageQualityScore:
                    average(
                        qualityScores
                    ),

                minimumQualityScore:
                    qualityScores.length
                        ? Math.min(
                            ...qualityScores
                        )
                        : 0,

                maximumQualityScore:
                    qualityScores.length
                        ? Math.max(
                            ...qualityScores
                        )
                        : 0,

                gradeCounts,

                statusCounts,

                rejectedPredictionCount:
                    safeArray(
                        this.state
                            .rejectedArrivalPredictions
                    ).length,

                correctedPredictionCount:
                    safeArray(
                        this.state
                            .correctedArrivalPredictions
                    ).length,

                diagnostics:
                    deepClone(
                        this.state
                            .diagnostics
                            .predictionQualitySummary ||
                        {}
                    )
            };
        };

    /* ======================================================================
       SECTION 152
       GET HIGH-QUALITY PREDICTIONS
       ====================================================================== */

    CoreClass.prototype.getHighQualityPredictions =
        function getHighQualityPredictions(
            minimumScore = 0.70
        ) {
            const safeMinimumScore =
                clamp(
                    toFiniteNumber(
                        minimumScore,
                        0.70
                    ),
                    0,
                    1
                );

            return deepClone(
                safeArray(
                    this.state
                        .arrivalPredictions
                )
                    .filter(
                        (prediction) => {
                            return (
                                toFiniteNumber(
                                    prediction
                                        .quality
                                        ?.score,
                                    0
                                ) >=
                                safeMinimumScore
                            );
                        }
                    )
            );
        };

    /* ======================================================================
       SECTION 153
       GET DEGRADED PREDICTIONS
       ====================================================================== */

    CoreClass.prototype.getDegradedPredictions =
        function getDegradedPredictions() {
            return deepClone(
                safeArray(
                    this.state
                        .arrivalPredictions
                )
                    .filter(
                        (prediction) => {
                            return [
                                QUALITY_STATUS.DEGRADED,
                                QUALITY_STATUS.UNVERIFIED
                            ].includes(
                                prediction
                                    .quality
                                    ?.status
                            );
                        }
                    )
            );
        };

    /* ======================================================================
       SECTION 154
       GET REJECTED PREDICTIONS
       ====================================================================== */

    CoreClass.prototype.getRejectedPredictions =
        function getRejectedPredictions() {
            return deepClone(
                safeArray(
                    this.state
                        .rejectedArrivalPredictions
                )
            );
        };

    /* ======================================================================
       SECTION 155
       QUALITY-CONTROLLED ETA STAGE
       ====================================================================== */

    CoreClass.prototype.executeValidatedEtaStage =
        function executeValidatedEtaStage(
            lifecycleOptions = {}
        ) {
            const safeOptions =
                safeObject(
                    lifecycleOptions
                );

            const etaResult =
                this.calculateNationalArrivalPredictions({
                    ...safeObject(
                        safeOptions.eta
                    ),

                    cells:
                        this.getActiveTrackedCells({
                            minimumConfidence:
                                this.options
                                    .minConfidence
                        }),

                    locations:
                        this.getActiveLocations()
                });

            const qualityResult =
                this.executePredictionQualityControl(
                    safeOptions.quality ||
                    {}
                );

            const finalPredictionCount =
                safeArray(
                    this.state
                        .arrivalPredictions
                ).length;

            if (
                this.state.currentCycle
            ) {
                this.state.currentCycle
                    .predictionCount =
                    finalPredictionCount;

                this.updateCycleStage(
                    "eta_quality_control",
                    {
                        rawPredictionCount:
                            etaResult
                                .rawPredictionCount,

                        initialPredictionCount:
                            etaResult
                                .selectedPredictionCount,

                        finalPredictionCount,

                        correctedPredictionCount:
                            qualityResult
                                .validation
                                .correctedPredictionCount,

                        rejectedPredictionCount:
                            qualityResult
                                .validation
                                .rejectedPredictionCount,

                        duplicateRemovedCount:
                            qualityResult
                                .validation
                                .duplicateRemovedCount
                    }
                );
            }

            return {
                eta:
                    deepClone(
                        etaResult
                    ),

                quality:
                    deepClone(
                        qualityResult
                    ),

                predictions:
                    deepClone(
                        this.state
                            .arrivalPredictions
                    )
            };
        };

    /* ======================================================================
       SECTION 156
       COMPATIBILITY QUALITY ALIASES
       ====================================================================== */

    CoreClass.prototype.validatePredictions =
        CoreClass.prototype
            .validateAllArrivalPredictions;

    CoreClass.prototype.correctPredictions =
        CoreClass.prototype
            .executePredictionQualityControl;

    CoreClass.prototype.getQualitySummary =
        CoreClass.prototype
            .getPredictionQualitySummary;

    /* ======================================================================
       SECTION 157
       PART 9 EXPORT
       ====================================================================== */

    global.RainArrivalRecoveryCoreV32Part9 = {
        DEFAULT_MIN_VALID_ETA_MINUTES,
        DEFAULT_MAX_VALID_ETA_HOURS,
        DEFAULT_MAX_REASONABLE_SPEED_KMH,
        DEFAULT_MIN_REASONABLE_SPEED_KMH,
        DEFAULT_MAX_ETA_DIFFERENCE_HOURS,
        DEFAULT_MAX_SOURCE_DISAGREEMENT,
        DEFAULT_MIN_VALID_CONFIDENCE,
        DEFAULT_CORRECTION_CONFIDENCE_PENALTY,
        DEFAULT_REJECTION_CONFIDENCE,
        DEFAULT_FORECAST_VALIDATION_RADIUS_KM,
        DEFAULT_FORECAST_VALIDATION_TIME_MS,
        DEFAULT_STATIONARY_MAX_DISTANCE_KM,
        DEFAULT_LOW_SPEED_MAX_ETA_HOURS,
        DEFAULT_HISTORY_SPEED_LIMIT,
        QUALITY_STATUS,
        QUALITY_ISSUE,
        getPredictionEtaHours,
        getPredictionDistanceKm,
        getPredictionSpeedKmh,
        getPredictionConfidence,
        calculateExpectedEtaFromDistance,
        calculateRelativeEtaDifference,
        createQualityIssue,
        calculateQualityGrade,
        selectQualityStatus
    };

})(window);
/* ==========================================================================
   RainGuard AI
   Rain Arrival Recovery Core V32

   PART 10
   Frontend Output Adapter + Legacy Compatibility + Public Window API
   ========================================================================== */

(function extendRainArrivalRecoveryCoreV32Part10(global) {
    "use strict";

    const CoreClass =
        global.RainArrivalRecoveryCoreV32;

    const Utils =
        global.RainArrivalRecoveryCoreV32Utils;

    const Constants =
        global.RainArrivalRecoveryCoreV32Constants;

    if (
        typeof CoreClass !== "function" ||
        !Utils ||
        !Constants
    ) {
        throw new Error(
            "RainArrivalRecoveryCoreV32 Parts 1 to 9 must be loaded before Part 10."
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
    } = Utils;

    const {
        RAIN_STATUS,
        CORE_EVENTS
    } = Constants;

    /* ======================================================================
       SECTION 158
       OUTPUT CONSTANTS
       ====================================================================== */

    const OUTPUT_SCHEMA_VERSION =
        "32.10.0";

    const DEFAULT_PUBLIC_RESULT_LIMIT =
        500;

    const DEFAULT_FRONTEND_REFRESH_MS =
        60 * 1000;

    const DEFAULT_RECENT_DATA_AGE_MS =
        20 * 60 * 1000;

    const PUBLIC_RAIN_CATEGORY =
        Object.freeze({
            RAINING_NOW:
                "raining_now",

            ARRIVING_0_1_H:
                "arriving_0_1h",

            ARRIVING_1_6_H:
                "arriving_1_6h",

            ARRIVING_6_12_H:
                "arriving_6_12h",

            ARRIVING_12_24_H:
                "arriving_12_24h",

            ARRIVING_24_48_H:
                "arriving_24_48h",

            ARRIVING_48_72_H:
                "arriving_48_72h",

            POSSIBLE:
                "possible",

            NO_RAIN:
                "no_rain",

            UNKNOWN:
                "unknown"
        });

    const PUBLIC_RISK_LEVEL_AR =
        Object.freeze({
            none:
                "لا توجد خطورة",

            low:
                "منخفضة",

            moderate:
                "متوسطة",

            high:
                "مرتفعة",

            very_high:
                "مرتفعة جدًا",

            extreme:
                "قصوى"
        });

    const PUBLIC_RISK_LEVEL_EN =
        Object.freeze({
            none:
                "None",

            low:
                "Low",

            moderate:
                "Moderate",

            high:
                "High",

            very_high:
                "Very High",

            extreme:
                "Extreme"
        });

    /* ======================================================================
       SECTION 159
       OUTPUT HELPERS
       ====================================================================== */

    function normalizePublicId(value) {
        if (
            typeof value !==
            "string"
        ) {
            return "";
        }

        return value
            .trim()
            .toLowerCase()
            .replace(
                /[\s\-]+/g,
                "_"
            )
            .replace(
                /[^a-z0-9_\u0600-\u06ff]/g,
                ""
            );
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

        return null;
    }

    function getPredictionCategory(
        prediction
    ) {
        if (!prediction) {
            return PUBLIC_RAIN_CATEGORY.UNKNOWN;
        }

        if (
            prediction.rainingNow ===
            true ||
            prediction.status ===
            RAIN_STATUS.RAINING_NOW
        ) {
            return PUBLIC_RAIN_CATEGORY.RAINING_NOW;
        }

        const etaHours =
            getPredictionEtaHours(
                prediction
            );

        if (
            Number.isFinite(
                etaHours
            )
        ) {
            if (etaHours <= 1) {
                return PUBLIC_RAIN_CATEGORY.ARRIVING_0_1_H;
            }

            if (etaHours <= 6) {
                return PUBLIC_RAIN_CATEGORY.ARRIVING_1_6_H;
            }

            if (etaHours <= 12) {
                return PUBLIC_RAIN_CATEGORY.ARRIVING_6_12_H;
            }

            if (etaHours <= 24) {
                return PUBLIC_RAIN_CATEGORY.ARRIVING_12_24_H;
            }

            if (etaHours <= 48) {
                return PUBLIC_RAIN_CATEGORY.ARRIVING_24_48_H;
            }

            if (etaHours <= 72) {
                return PUBLIC_RAIN_CATEGORY.ARRIVING_48_72_H;
            }
        }

        if (
            prediction.status ===
            RAIN_STATUS.POSSIBLE
        ) {
            return PUBLIC_RAIN_CATEGORY.POSSIBLE;
        }

        if (
            prediction.status ===
            RAIN_STATUS.NO_RAIN
        ) {
            return PUBLIC_RAIN_CATEGORY.NO_RAIN;
        }

        return PUBLIC_RAIN_CATEGORY.UNKNOWN;
    }

    function formatEtaArabic(
        etaHours,
        rainingNow = false
    ) {
        if (rainingNow) {
            return "تمطر الآن";
        }

        if (
            !Number.isFinite(
                Number(
                    etaHours
                )
            )
        ) {
            return "وقت الوصول غير مؤكد";
        }

        const totalMinutes =
            Math.max(
                0,
                Math.round(
                    Number(
                        etaHours
                    ) *
                    60
                )
            );

        if (totalMinutes < 60) {
            return `خلال ${totalMinutes} دقيقة`;
        }

        const hours =
            Math.floor(
                totalMinutes /
                60
            );

        const minutes =
            totalMinutes %
            60;

        if (minutes === 0) {
            return `خلال ${hours} ساعة`;
        }

        return (
            `خلال ${hours} ساعة و` +
            `${minutes} دقيقة`
        );
    }

    function formatEtaEnglish(
        etaHours,
        rainingNow = false
    ) {
        if (rainingNow) {
            return "Raining now";
        }

        if (
            !Number.isFinite(
                Number(
                    etaHours
                )
            )
        ) {
            return "Arrival time uncertain";
        }

        const totalMinutes =
            Math.max(
                0,
                Math.round(
                    Number(
                        etaHours
                    ) *
                    60
                )
            );

        if (totalMinutes < 60) {
            return `Within ${totalMinutes} minutes`;
        }

        const hours =
            Math.floor(
                totalMinutes /
                60
            );

        const minutes =
            totalMinutes %
            60;

        if (minutes === 0) {
            return `Within ${hours} hours`;
        }

        return (
            `Within ${hours} hours and ` +
            `${minutes} minutes`
        );
    }

    function getQualityScore(
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

    function getPredictionIntensity(
        prediction
    ) {
        return Math.max(
            0,
            toFiniteNumber(
                prediction?.cellIntensity ??
                prediction?.rainIntensity ??
                prediction?.intensity,
                0
            )
        );
    }

    function getArrivalTimestamp(
        prediction
    ) {
        if (
            Number.isFinite(
                Number(
                    prediction
                        ?.arrivalTimestamp
                )
            )
        ) {
            return Number(
                prediction
                    .arrivalTimestamp
            );
        }

        const etaHours =
            getPredictionEtaHours(
                prediction
            );

        if (
            !Number.isFinite(
                etaHours
            )
        ) {
            return null;
        }

        return (
            Date.now() +
            etaHours *
            60 *
            60 *
            1000
        );
    }

    function isRecentTimestamp(
        timestamp,
        maximumAgeMs =
            DEFAULT_RECENT_DATA_AGE_MS
    ) {
        const normalized =
            normalizeTimestamp(
                timestamp
            );

        return (
            Date.now() -
            normalized <=
            maximumAgeMs
        );
    }

    /* ======================================================================
       SECTION 160
       FRONTEND OPTION NORMALIZATION
       ====================================================================== */

    CoreClass.prototype.normalizeFrontendOptions =
        function normalizeFrontendOptions(
            options = {}
        ) {
            const safeOptions =
                safeObject(options);

            return {
                maximumResults:
                    clamp(
                        Math.round(
                            toFiniteNumber(
                                safeOptions.maximumResults,
                                DEFAULT_PUBLIC_RESULT_LIMIT
                            )
                        ),
                        1,
                        5000
                    ),

                minimumConfidence:
                    clamp(
                        toFiniteNumber(
                            safeOptions.minimumConfidence,
                            0
                        ),
                        0,
                        1
                    ),

                minimumQualityScore:
                    clamp(
                        toFiniteNumber(
                            safeOptions.minimumQualityScore,
                            0
                        ),
                        0,
                        1
                    ),

                includeNoRain:
                    safeOptions.includeNoRain === true,

                includePossible:
                    safeOptions.includePossible !== false,

                includeRejected:
                    safeOptions.includeRejected === true,

                includeRawData:
                    safeOptions.includeRawData === true,

                includeCellHistory:
                    safeOptions.includeCellHistory === true,

                language:
                    safeOptions.language === "en"
                        ? "en"
                        : "ar"
            };
        };

    /* ======================================================================
       SECTION 161
       NORMALIZE ONE PUBLIC LOCATION RESULT
       ====================================================================== */

    CoreClass.prototype.normalizePublicArrivalResult =
        function normalizePublicArrivalResult(
            prediction,
            options = {}
        ) {
            if (!prediction) {
                return null;
            }

            const frontendOptions =
                this.normalizeFrontendOptions(
                    options
                );

            const etaHours =
                getPredictionEtaHours(
                    prediction
                );

            const rainingNow =
                prediction.rainingNow ===
                true ||
                prediction.status ===
                RAIN_STATUS.RAINING_NOW;

            const arrivalTimestamp =
                getArrivalTimestamp(
                    prediction
                );

            const confidence =
                normalizePercentage(
                    prediction.confidence
                );

            const qualityScore =
                getQualityScore(
                    prediction
                );

            const category =
                getPredictionCategory(
                    prediction
                );

            const result = {
                id:
                    prediction.id ||
                    [
                        prediction.locationId,
                        prediction.trackingId,
                        arrivalTimestamp
                    ]
                        .filter(Boolean)
                        .join("_"),

                locationId:
                    normalizePublicId(
                        prediction.locationId
                    ),

                name:
                    prediction.locationName ||
                    prediction.locationNameAr ||
                    prediction.locationNameEn ||
                    prediction.locationId ||
                    "Unknown",

                nameAr:
                    prediction.locationNameAr ||
                    prediction.locationName ||
                    prediction.locationId ||
                    "غير معروف",

                nameEn:
                    prediction.locationNameEn ||
                    prediction.locationName ||
                    prediction.locationId ||
                    "Unknown",

                type:
                    prediction.locationType ||
                    "city",

                region:
                    prediction.region ||
                    null,

                regionId:
                    normalizePublicId(
                        prediction.regionId
                    ),

                governorate:
                    prediction.governorate ||
                    null,

                governorateId:
                    normalizePublicId(
                        prediction.governorateId
                    ),

                latitude:
                    Number.isFinite(
                        Number(
                            prediction.latitude
                        )
                    )
                        ? Number(
                            prediction.latitude
                        )
                        : null,

                longitude:
                    Number.isFinite(
                        Number(
                            prediction.longitude
                        )
                    )
                        ? Number(
                            prediction.longitude
                        )
                        : null,

                category,

                status:
                    prediction.status ||
                    RAIN_STATUS.NO_RAIN,

                classification:
                    prediction.classification ||
                    category,

                rainingNow,

                hasRain:
                    rainingNow ||
                    Number.isFinite(
                        etaHours
                    ),

                etaHours,

                etaMinutes:
                    Number.isFinite(
                        etaHours
                    )
                        ? Math.round(
                            etaHours *
                            60
                        )
                        : null,

                etaTextAr:
                    formatEtaArabic(
                        etaHours,
                        rainingNow
                    ),

                etaTextEn:
                    formatEtaEnglish(
                        etaHours,
                        rainingNow
                    ),

                arrivalTimestamp,

                arrivalIso:
                    Number.isFinite(
                        arrivalTimestamp
                    )
                        ? new Date(
                            arrivalTimestamp
                        ).toISOString()
                        : null,

                arrivalWindow:
                    deepClone(
                        prediction.arrivalWindow ||
                        null
                    ),

                confidence,

                confidencePercent:
                    Math.round(
                        confidence *
                        100
                    ),

                qualityScore,

                qualityPercent:
                    Math.round(
                        qualityScore *
                        100
                    ),

                qualityGrade:
                    prediction
                        .quality
                        ?.grade ||
                    null,

                qualityStatus:
                    prediction
                        .quality
                        ?.status ||
                    null,

                corrected:
                    prediction.corrected ===
                    true,

                intensity:
                    getPredictionIntensity(
                        prediction
                    ),

                probability:
                    normalizePercentage(
                        prediction.rainProbability ??
                        prediction.probability ??
                        prediction.forecastSupportScore ??
                        prediction.confidence
                    ),

                distanceKm:
                    Math.max(
                        0,
                        toFiniteNumber(
                            prediction.distanceKm,
                            0
                        )
                    ),

                alongTrackDistanceKm:
                    toFiniteNumber(
                        prediction
                            .alongTrackDistanceKm,
                        null
                    ),

                crossTrackDistanceKm:
                    toFiniteNumber(
                        prediction
                            .crossTrackDistanceKm,
                        null
                    ),

                trackingId:
                    prediction.trackingId ||
                    null,

                cellId:
                    prediction.cellId ||
                    null,

                cellSpeedKmh:
                    Math.max(
                        0,
                        toFiniteNumber(
                            prediction.cellSpeedKmh,
                            0
                        )
                    ),

                cellDirectionDegrees:
                    toFiniteNumber(
                        prediction
                            .cellDirectionDegrees,
                        null
                    ),

                cellRadiusKm:
                    Math.max(
                        0,
                        toFiniteNumber(
                            prediction.cellRadiusKm,
                            0
                        )
                    ),

                movementStatus:
                    prediction.movementStatus ||
                    null,

                forecastSupported:
                    prediction.forecastSupported ===
                    true,

                forecastSupportScore:
                    normalizePercentage(
                        prediction
                            .forecastSupportScore
                    ),

                generatedAt:
                    prediction.generatedAt ||
                    Date.now(),

                dataFresh:
                    isRecentTimestamp(
                        prediction.generatedAt ||
                        Date.now()
                    )
            };

            if (
                frontendOptions.includeRawData
            ) {
                result.raw =
                    deepClone(
                        prediction
                    );
            }

            return result;
        };

    /* ======================================================================
       SECTION 162
       FILTER PUBLIC RESULTS
       ====================================================================== */

    CoreClass.prototype.filterPublicArrivalResults =
        function filterPublicArrivalResults(
            results,
            options = {}
        ) {
            const frontendOptions =
                this.normalizeFrontendOptions(
                    options
                );

            return safeArray(
                results
            )
                .filter((result) => {
                    if (!result) {
                        return false;
                    }

                    if (
                        result.confidence <
                        frontendOptions
                            .minimumConfidence
                    ) {
                        return false;
                    }

                    if (
                        result.qualityScore <
                        frontendOptions
                            .minimumQualityScore
                    ) {
                        return false;
                    }

                    if (
                        !frontendOptions.includeRejected &&
                        result.qualityStatus ===
                        "rejected"
                    ) {
                        return false;
                    }

                    if (
                        !frontendOptions.includePossible &&
                        result.status ===
                        RAIN_STATUS.POSSIBLE
                    ) {
                        return false;
                    }

                    if (
                        !frontendOptions.includeNoRain &&
                        result.status ===
                        RAIN_STATUS.NO_RAIN
                    ) {
                        return false;
                    }

                    return true;
                })
                .sort(
                    (
                        resultA,
                        resultB
                    ) => {
                        if (
                            resultA.rainingNow &&
                            !resultB.rainingNow
                        ) {
                            return -1;
                        }

                        if (
                            resultB.rainingNow &&
                            !resultA.rainingNow
                        ) {
                            return 1;
                        }

                        const etaA =
                            Number.isFinite(
                                resultA.etaHours
                            )
                                ? resultA.etaHours
                                : Infinity;

                        const etaB =
                            Number.isFinite(
                                resultB.etaHours
                            )
                                ? resultB.etaHours
                                : Infinity;

                        if (etaA !== etaB) {
                            return etaA - etaB;
                        }

                        if (
                            resultA.qualityScore !==
                            resultB.qualityScore
                        ) {
                            return (
                                resultB.qualityScore -
                                resultA.qualityScore
                            );
                        }

                        return (
                            resultB.confidence -
                            resultA.confidence
                        );
                    }
                )
                .slice(
                    0,
                    frontendOptions
                        .maximumResults
                );
        };

    /* ======================================================================
       SECTION 163
       BUILD PUBLIC ARRIVAL LIST
       ====================================================================== */

    CoreClass.prototype.buildPublicArrivalList =
        function buildPublicArrivalList(
            options = {}
        ) {
            const predictions =
                safeArray(
                    options.predictions
                ).length
                    ? safeArray(
                        options.predictions
                    )
                    : safeArray(
                        this.state
                            .arrivalPredictions
                    );

            const normalized =
                predictions
                    .map((prediction) => {
                        return this
                            .normalizePublicArrivalResult(
                                prediction,
                                options
                            );
                    })
                    .filter(Boolean);

            return this
                .filterPublicArrivalResults(
                    normalized,
                    options
                );
        };

    /* ======================================================================
       SECTION 164
       BUILD RAINING-NOW LIST
       ====================================================================== */

    CoreClass.prototype.buildPublicRainingNowList =
        function buildPublicRainingNowList(
            options = {}
        ) {
            return this
                .buildPublicArrivalList({
                    ...safeObject(options),

                    includeNoRain:
                        false
                })
                .filter((result) => {
                    return (
                        result.rainingNow ===
                        true
                    );
                });
        };

    /* ======================================================================
       SECTION 165
       BUILD HORIZON PUBLIC LIST
       ====================================================================== */

    CoreClass.prototype.buildPublicHorizonList =
        function buildPublicHorizonList(
            horizonHours,
            options = {}
        ) {
            const horizon =
                Math.max(
                    1,
                    toFiniteNumber(
                        horizonHours,
                        72
                    )
                );

            return this
                .buildPublicArrivalList(
                    options
                )
                .filter((result) => {
                    return (
                        result.rainingNow ||
                        (
                            Number.isFinite(
                                result.etaHours
                            ) &&
                            result.etaHours <=
                            horizon
                        )
                    );
                });
        };

    /* ======================================================================
       SECTION 166
       BUILD PUBLIC REGION RESULT
       ====================================================================== */

    CoreClass.prototype.normalizePublicRegionSummary =
        function normalizePublicRegionSummary(
            summary
        ) {
            if (!summary) {
                return null;
            }

            const riskLevel =
                summary.riskLevel ||
                "none";

            return {
                id:
                    normalizePublicId(
                        summary.id
                    ),

                name:
                    summary.name ||
                    summary.nameAr ||
                    summary.nameEn ||
                    summary.id,

                nameAr:
                    summary.nameAr ||
                    summary.name ||
                    summary.id,

                nameEn:
                    summary.nameEn ||
                    summary.name ||
                    summary.id,

                locationCount:
                    Math.max(
                        0,
                        toFiniteNumber(
                            summary.locationCount,
                            0
                        )
                    ),

                rainingNowCount:
                    Math.max(
                        0,
                        toFiniteNumber(
                            summary.rainingNowCount,
                            0
                        )
                    ),

                arrivingCount:
                    Math.max(
                        0,
                        toFiniteNumber(
                            summary.arrivingCount,
                            0
                        )
                    ),

                possibleCount:
                    Math.max(
                        0,
                        toFiniteNumber(
                            summary.possibleCount,
                            0
                        )
                    ),

                contributingCellCount:
                    Math.max(
                        0,
                        toFiniteNumber(
                            summary.contributingCellCount,
                            0
                        )
                    ),

                earliestEtaHours:
                    Number.isFinite(
                        Number(
                            summary
                                .earliestEtaHours
                        )
                    )
                        ? Number(
                            summary
                                .earliestEtaHours
                        )
                        : null,

                earliestEtaMinutes:
                    Number.isFinite(
                        Number(
                            summary
                                .earliestEtaMinutes
                        )
                    )
                        ? Number(
                            summary
                                .earliestEtaMinutes
                        )
                        : null,

                earliestArrivalTimestamp:
                    Number.isFinite(
                        Number(
                            summary
                                .earliestArrivalTimestamp
                        )
                    )
                        ? Number(
                            summary
                                .earliestArrivalTimestamp
                        )
                        : null,

                maximumIntensity:
                    Math.max(
                        0,
                        toFiniteNumber(
                            summary.maximumIntensity,
                            0
                        )
                    ),

                averageIntensity:
                    Math.max(
                        0,
                        toFiniteNumber(
                            summary.averageIntensity,
                            0
                        )
                    ),

                averageConfidence:
                    normalizePercentage(
                        summary.averageConfidence
                    ),

                riskScore:
                    clamp(
                        toFiniteNumber(
                            summary.riskScore,
                            0
                        ),
                        0,
                        1
                    ),

                riskLevel,

                riskLabelAr:
                    PUBLIC_RISK_LEVEL_AR[
                        riskLevel
                    ] ||
                    riskLevel,

                riskLabelEn:
                    PUBLIC_RISK_LEVEL_EN[
                        riskLevel
                    ] ||
                    riskLevel,

                topLocation:
                    summary.topLocation
                        ? deepClone(
                            summary.topLocation
                        )
                        : null,

                generatedAt:
                    summary.generatedAt ||
                    Date.now()
            };
        };

    /* ======================================================================
       SECTION 167
       BUILD PUBLIC REGION LIST
       ====================================================================== */

    CoreClass.prototype.buildPublicRegionList =
        function buildPublicRegionList(
            options = {}
        ) {
            const regions =
                safeArray(
                    this.state.regionSummaries
                )
                    .map((summary) => {
                        return this
                            .normalizePublicRegionSummary(
                                summary
                            );
                    })
                    .filter(Boolean)
                    .sort(
                        (
                            regionA,
                            regionB
                        ) => {
                            if (
                                regionA
                                    .rainingNowCount !==
                                regionB
                                    .rainingNowCount
                            ) {
                                return (
                                    regionB
                                        .rainingNowCount -
                                    regionA
                                        .rainingNowCount
                                );
                            }

                            const etaA =
                                Number.isFinite(
                                    regionA
                                        .earliestEtaHours
                                )
                                    ? regionA
                                        .earliestEtaHours
                                    : Infinity;

                            const etaB =
                                Number.isFinite(
                                    regionB
                                        .earliestEtaHours
                                )
                                    ? regionB
                                        .earliestEtaHours
                                    : Infinity;

                            if (etaA !== etaB) {
                                return etaA - etaB;
                            }

                            return (
                                regionB.riskScore -
                                regionA.riskScore
                            );
                        }
                    );

            return deepClone(
                regions
            );
        };

    /* ======================================================================
       SECTION 168
       BUILD PUBLIC GOVERNORATE LIST
       ====================================================================== */

    CoreClass.prototype.buildPublicGovernorateList =
        function buildPublicGovernorateList(
            options = {}
        ) {
            const governorates =
                safeArray(
                    this.state
                        .governorateSummaries
                )
                    .map((summary) => {
                        return this
                            .normalizePublicRegionSummary(
                                summary
                            );
                    })
                    .filter(Boolean)
                    .sort(
                        (
                            itemA,
                            itemB
                        ) => {
                            if (
                                itemA
                                    .rainingNowCount !==
                                itemB
                                    .rainingNowCount
                            ) {
                                return (
                                    itemB
                                        .rainingNowCount -
                                    itemA
                                        .rainingNowCount
                                );
                            }

                            const etaA =
                                Number.isFinite(
                                    itemA
                                        .earliestEtaHours
                                )
                                    ? itemA
                                        .earliestEtaHours
                                    : Infinity;

                            const etaB =
                                Number.isFinite(
                                    itemB
                                        .earliestEtaHours
                                )
                                    ? itemB
                                        .earliestEtaHours
                                    : Infinity;

                            if (etaA !== etaB) {
                                return etaA - etaB;
                            }

                            return (
                                itemB.riskScore -
                                itemA.riskScore
                            );
                        }
                    );

            return deepClone(
                governorates
            );
        };

    /* ======================================================================
       SECTION 169
       BUILD PUBLIC HORIZON OUTPUT
       ====================================================================== */

    CoreClass.prototype.buildPublicHorizons =
        function buildPublicHorizons(
            options = {}
        ) {
            const horizons =
                [
                    6,
                    12,
                    24,
                    48,
                    72
                ];

            const result = {};

            horizons.forEach(
                (hours) => {
                    const key =
                        `h${hours}`;

                    const source =
                        this.getHorizonForecast(
                            hours
                        );

                    const locations =
                        this.buildPublicHorizonList(
                            hours,
                            options
                        );

                    result[key] = {
                        key,

                        hours,

                        labelAr:
                            source?.labelAr ||
                            `خلال ${hours} ساعة`,

                        labelEn:
                            source?.labelEn ||
                            `Within ${hours} hours`,

                        predictionCount:
                            locations.length,

                        rainingNowCount:
                            locations.filter(
                                (location) => {
                                    return (
                                        location
                                            .rainingNow
                                    );
                                }
                            ).length,

                        arrivingCount:
                            locations.filter(
                                (location) => {
                                    return (
                                        !location
                                            .rainingNow &&
                                        Number.isFinite(
                                            location
                                                .etaHours
                                        )
                                    );
                                }
                            ).length,

                        affectedRegionCount:
                            new Set(
                                locations
                                    .map(
                                        (location) => {
                                            return (
                                                location
                                                    .regionId
                                            );
                                        }
                                    )
                                    .filter(Boolean)
                            ).size,

                        affectedGovernorateCount:
                            new Set(
                                locations
                                    .map(
                                        (location) => {
                                            return (
                                                location
                                                    .governorateId
                                            );
                                        }
                                    )
                                    .filter(Boolean)
                            ).size,

                        riskLevel:
                            source?.riskLevel ||
                            "none",

                        riskScore:
                            clamp(
                                toFiniteNumber(
                                    source?.riskScore,
                                    0
                                ),
                                0,
                                1
                            ),

                        maximumIntensity:
                            Math.max(
                                0,
                                toFiniteNumber(
                                    source
                                        ?.maximumIntensity,
                                    0
                                )
                            ),

                        earliestLocation:
                            locations[0] ||
                            null,

                        locations,

                        generatedAt:
                            Date.now()
                    };
                }
            );

            return result;
        };

    /* ======================================================================
       SECTION 170
       BUILD PUBLIC ACTIVE CELL LIST
       ====================================================================== */

    CoreClass.prototype.buildPublicActiveCellList =
        function buildPublicActiveCellList(
            options = {}
        ) {
            const frontendOptions =
                this.normalizeFrontendOptions(
                    options
                );

            return this
                .getActiveTrackedCells({
                    minimumConfidence:
                        frontendOptions
                            .minimumConfidence
                })
                .map((cell) => {
                    const result = {
                        trackingId:
                            cell.trackingId ||
                            cell.id,

                        id:
                            cell.id ||
                            cell.trackingId,

                        latitude:
                            Number(
                                cell.latitude
                            ),

                        longitude:
                            Number(
                                cell.longitude
                            ),

                        timestamp:
                            normalizeTimestamp(
                                cell.timestamp ||
                                cell.updatedAt ||
                                Date.now()
                            ),

                        radiusKm:
                            Math.max(
                                0,
                                toFiniteNumber(
                                    cell.radiusKm,
                                    0
                                )
                            ),

                        areaKm2:
                            Math.max(
                                0,
                                toFiniteNumber(
                                    cell.areaKm2,
                                    0
                                )
                            ),

                        intensity:
                            Math.max(
                                0,
                                toFiniteNumber(
                                    cell.intensity,
                                    0
                                )
                            ),

                        maximumIntensity:
                            Math.max(
                                0,
                                toFiniteNumber(
                                    cell.maximumIntensity ??
                                    cell.maxIntensity,
                                    0
                                )
                            ),

                        confidence:
                            normalizePercentage(
                                cell.confidence
                            ),

                        speedKmh:
                            Math.max(
                                0,
                                toFiniteNumber(
                                    cell.speedKmh,
                                    0
                                )
                            ),

                        directionDegrees:
                            toFiniteNumber(
                                cell.directionDegrees,
                                null
                            ),

                        movementStatus:
                            cell.movementStatus ||
                            null,

                        intensityTrend:
                            cell.intensityTrend ||
                            "stable",

                        radiusTrend:
                            cell.radiusTrend ||
                            "stable",

                        status:
                            cell.status ||
                            "active",

                        sourceCount:
                            Math.max(
                                0,
                                toFiniteNumber(
                                    cell.sourceCount,
                                    safeArray(
                                        cell.sources
                                    ).length
                                )
                            ),

                        sources:
                            deepClone(
                                safeArray(
                                    cell.sources
                                )
                            ),

                        ageMs:
                            Math.max(
                                0,
                                toFiniteNumber(
                                    cell.ageMs,
                                    0
                                )
                            ),

                        firstDetectedAt:
                            cell.firstDetectedAt ||
                            null,

                        updatedAt:
                            cell.updatedAt ||
                            Date.now(),

                        dataFresh:
                            isRecentTimestamp(
                                cell.updatedAt ||
                                cell.timestamp ||
                                Date.now()
                            )
                    };

                    if (
                        frontendOptions
                            .includeCellHistory
                    ) {
                        result.history =
                            deepClone(
                                safeArray(
                                    cell.history
                                )
                            );
                    }

                    return result;
                })
                .sort(
                    (
                        cellA,
                        cellB
                    ) => {
                        if (
                            cellA.intensity !==
                            cellB.intensity
                        ) {
                            return (
                                cellB.intensity -
                                cellA.intensity
                            );
                        }

                        return (
                            cellB.confidence -
                            cellA.confidence
                        );
                    }
                );
        };

    /* ======================================================================
       SECTION 171
       BUILD PUBLIC NATIONAL SUMMARY
       ====================================================================== */

    CoreClass.prototype.buildPublicNationalSummary =
        function buildPublicNationalSummary(
            options = {}
        ) {
            const arrivals =
                this.buildPublicArrivalList(
                    options
                );

            const rainingNow =
                arrivals.filter(
                    (location) => {
                        return (
                            location.rainingNow
                        );
                    }
                );

            const regions =
                this.buildPublicRegionList(
                    options
                );

            const governorates =
                this.buildPublicGovernorateList(
                    options
                );

            const activeCells =
                this.buildPublicActiveCellList(
                    options
                );

            const lifecycle =
                typeof this
                    .getLifecycleStatus ===
                "function"
                    ? this
                        .getLifecycleStatus()
                    : null;

            const health =
                typeof this
                    .getEngineHealth ===
                "function"
                    ? this
                        .getEngineHealth()
                    : null;

            const dashboard =
                this.state
                    .nationalArrivalDashboard ||
                {};

            const nationalRiskLevel =
                dashboard
                    ?.summary
                    ?.nationalRiskLevel ||
                regions[0]
                    ?.riskLevel ||
                "none";

            const nearestArrival =
                arrivals.find(
                    (location) => {
                        return (
                            Number.isFinite(
                                location.etaHours
                            ) &&
                            !location.rainingNow
                        );
                    }
                ) ||
                null;

            return {
                generatedAt:
                    Date.now(),

                generatedIso:
                    new Date()
                        .toISOString(),

                totalRegisteredLocations:
                    this.locations.size,

                totalActiveCells:
                    activeCells.length,

                totalArrivalPredictions:
                    arrivals.length,

                rainingNowCount:
                    rainingNow.length,

                arrivingCount:
                    arrivals.filter(
                        (location) => {
                            return (
                                !location.rainingNow &&
                                Number.isFinite(
                                    location.etaHours
                                )
                            );
                        }
                    ).length,

                affectedRegionCount:
                    regions.length,

                affectedGovernorateCount:
                    governorates.length,

                nationalRiskLevel,

                nationalRiskLabelAr:
                    PUBLIC_RISK_LEVEL_AR[
                        nationalRiskLevel
                    ] ||
                    nationalRiskLevel,

                nationalRiskLabelEn:
                    PUBLIC_RISK_LEVEL_EN[
                        nationalRiskLevel
                    ] ||
                    nationalRiskLevel,

                nationalRiskScore:
                    clamp(
                        toFiniteNumber(
                            dashboard
                                ?.summary
                                ?.nationalRiskScore,
                            regions[0]
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
                            dashboard
                                ?.summary
                                ?.nationalMaximumIntensity,
                            activeCells.length
                                ? Math.max(
                                    ...activeCells.map(
                                        (cell) => {
                                            return (
                                                cell.intensity
                                            );
                                        }
                                    )
                                )
                                : 0
                        )
                    ),

                nearestArrival,

                topRiskRegion:
                    regions[0] ||
                    null,

                topRiskGovernorate:
                    governorates[0] ||
                    null,

                lifecycleStatus:
                    lifecycle?.status ||
                    "unknown",

                engineRunning:
                    lifecycle?.isRunning ===
                    true,

                engineHealth:
                    health?.status ||
                    "unknown",

                dataFresh:
                    arrivals.some(
                        (location) => {
                            return (
                                location.dataFresh
                            );
                        }
                    ) ||
                    activeCells.some(
                        (cell) => {
                            return (
                                cell.dataFresh
                            );
                        }
                    )
            };
        };

    /* ======================================================================
       SECTION 172
       BUILD COMPLETE FRONTEND PAYLOAD
       ====================================================================== */

    CoreClass.prototype.buildFrontendPayload =
        function buildFrontendPayload(
            options = {}
        ) {
            const frontendOptions =
                this.normalizeFrontendOptions(
                    options
                );

            const arrivals =
                this.buildPublicArrivalList(
                    frontendOptions
                );

            const rainingNow =
                arrivals.filter(
                    (location) => {
                        return (
                            location.rainingNow
                        );
                    }
                );

            const activeCells =
                this.buildPublicActiveCellList(
                    frontendOptions
                );

            const regions =
                this.buildPublicRegionList(
                    frontendOptions
                );

            const governorates =
                this.buildPublicGovernorateList(
                    frontendOptions
                );

            const horizons =
                this.buildPublicHorizons(
                    frontendOptions
                );

            const summary =
                this.buildPublicNationalSummary(
                    frontendOptions
                );

            const payload = {
                success:
                    true,

                schema:
                    "RainGuardArrivalFrontendPayload",

                schemaVersion:
                    OUTPUT_SCHEMA_VERSION,

                engineVersion:
                    this.version ||
                    "32",

                generatedAt:
                    Date.now(),

                generatedIso:
                    new Date()
                        .toISOString(),

                language:
                    frontendOptions.language,

                summary,

                rainingNow,

                arrivals,

                nearestArrivals:
                    arrivals
                        .filter(
                            (location) => {
                                return (
                                    location.rainingNow ||
                                    Number.isFinite(
                                        location.etaHours
                                    )
                                );
                            }
                        )
                        .slice(
                            0,
                            50
                        ),

                horizons,

                regions,

                governorates,

                activeCells,

                sourceHealth:
                    typeof this
                        .getSourcesHealth ===
                    "function"
                        ? deepClone(
                            this
                                .getSourcesHealth()
                        )
                        : [],

                engineHealth:
                    typeof this
                        .getEngineHealth ===
                    "function"
                        ? deepClone(
                            this
                                .getEngineHealth()
                        )
                        : null,

                diagnostics:
                    deepClone(
                        this.state
                            .diagnostics ||
                        {}
                    )
            };

            if (
                frontendOptions.includeRawData
            ) {
                payload.raw = {
                    observations:
                        deepClone(
                            safeArray(
                                this.state
                                    .observations
                            )
                        ),

                    forecasts:
                        deepClone(
                            safeArray(
                                this.state
                                    .forecasts
                            )
                        ),

                    trackedCells:
                        deepClone(
                            Array.from(
                                this.cells.values()
                            )
                        ),

                    arrivalPredictions:
                        deepClone(
                            safeArray(
                                this.state
                                    .arrivalPredictions
                            )
                        )
                };
            }

            this.state.frontendPayload =
                deepClone(
                    payload
                );

            this.state.frontendPayloadGeneratedAt =
                payload.generatedAt;

            this.emit(
                CORE_EVENTS.OUTPUT_UPDATED ||
                "output_updated",
                {
                    generatedAt:
                        payload.generatedAt,

                    summary:
                        deepClone(
                            summary
                        ),

                    arrivalCount:
                        arrivals.length,

                    activeCellCount:
                        activeCells.length
                }
            );

            return payload;
        };

    /* ======================================================================
       SECTION 173
       BUILD LEGACY RAIN ARRIVAL RESPONSE
       ====================================================================== */

    CoreClass.prototype.buildLegacyRainArrivalResponse =
        function buildLegacyRainArrivalResponse(
            options = {}
        ) {
            const payload =
                this.buildFrontendPayload(
                    options
                );

            const locations =
                payload.arrivals;

            return {
                ok:
                    true,

                success:
                    true,

                version:
                    "v32",

                timestamp:
                    payload.generatedAt,

                generatedAt:
                    payload.generatedAt,

                rainNow:
                    payload.rainingNow,

                rain_now:
                    payload.rainingNow,

                rainingNow:
                    payload.rainingNow,

                arrivals:
                    locations,

                rainArrivals:
                    locations,

                rain_arrivals:
                    locations,

                cities:
                    locations,

                regions:
                    payload.regions,

                governorates:
                    payload.governorates,

                cells:
                    payload.activeCells,

                rainCells:
                    payload.activeCells,

                rain_cells:
                    payload.activeCells,

                h6:
                    payload.horizons.h6,

                h12:
                    payload.horizons.h12,

                h24:
                    payload.horizons.h24,

                h48:
                    payload.horizons.h48,

                h72:
                    payload.horizons.h72,

                sixHours:
                    payload.horizons.h6,

                twelveHours:
                    payload.horizons.h12,

                twentyFourHours:
                    payload.horizons.h24,

                fortyEightHours:
                    payload.horizons.h48,

                seventyTwoHours:
                    payload.horizons.h72,

                summary:
                    payload.summary,

                health:
                    payload.engineHealth,

                diagnostics:
                    payload.diagnostics
            };
        };

    /* ======================================================================
       SECTION 174
       GET REGION RAIN OUTPUT
       ====================================================================== */

    CoreClass.prototype.getPublicRegionRain =
        function getPublicRegionRain(
            regionId,
            horizonHours = 72,
            options = {}
        ) {
            const normalizedRegionId =
                normalizePublicId(
                    regionId
                );

            const locations =
                this.buildPublicHorizonList(
                    horizonHours,
                    options
                )
                    .filter(
                        (location) => {
                            return (
                                location.regionId ===
                                normalizedRegionId
                            );
                        }
                    );

            const regionSummary =
                this.buildPublicRegionList(
                    options
                )
                    .find(
                        (region) => {
                            return (
                                region.id ===
                                normalizedRegionId
                            );
                        }
                    ) ||
                null;

            return {
                regionId:
                    normalizedRegionId,

                horizonHours,

                generatedAt:
                    Date.now(),

                summary:
                    regionSummary,

                locationCount:
                    locations.length,

                rainingNowCount:
                    locations.filter(
                        (location) => {
                            return (
                                location.rainingNow
                            );
                        }
                    ).length,

                locations
            };
        };

    /* ======================================================================
       SECTION 175
       GET GOVERNORATE RAIN OUTPUT
       ====================================================================== */

    CoreClass.prototype.getPublicGovernorateRain =
        function getPublicGovernorateRain(
            governorateId,
            horizonHours = 72,
            options = {}
        ) {
            const normalizedGovernorateId =
                normalizePublicId(
                    governorateId
                );

            const locations =
                this.buildPublicHorizonList(
                    horizonHours,
                    options
                )
                    .filter(
                        (location) => {
                            return (
                                location
                                    .governorateId ===
                                normalizedGovernorateId
                            );
                        }
                    );

            const summary =
                this.buildPublicGovernorateList(
                    options
                )
                    .find(
                        (governorate) => {
                            return (
                                governorate.id ===
                                normalizedGovernorateId
                            );
                        }
                    ) ||
                null;

            return {
                governorateId:
                    normalizedGovernorateId,

                horizonHours,

                generatedAt:
                    Date.now(),

                summary,

                locationCount:
                    locations.length,

                rainingNowCount:
                    locations.filter(
                        (location) => {
                            return (
                                location.rainingNow
                            );
                        }
                    ).length,

                locations
            };
        };

    /* ======================================================================
       SECTION 176
       GET LOCATION PUBLIC OUTPUT
       ====================================================================== */

    CoreClass.prototype.getPublicLocationRain =
        function getPublicLocationRain(
            locationId,
            options = {}
        ) {
            const normalizedId =
                normalizePublicId(
                    locationId
                );

            const prediction =
                safeArray(
                    this.state
                        .arrivalPredictions
                )
                    .find(
                        (item) => {
                            return (
                                normalizePublicId(
                                    item.locationId
                                ) ===
                                normalizedId
                            );
                        }
                    );

            if (!prediction) {
                const location =
                    typeof this
                        .getLocation ===
                    "function"
                        ? this
                            .getLocation(
                                normalizedId
                            )
                        : null;

                return {
                    locationId:
                        normalizedId,

                    found:
                        Boolean(location),

                    hasPrediction:
                        false,

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

                    location:
                        location
                            ? deepClone(
                                location
                            )
                            : null,

                    generatedAt:
                        Date.now()
                };
            }

            return {
                found:
                    true,

                hasPrediction:
                    true,

                ...this
                    .normalizePublicArrivalResult(
                        prediction,
                        options
                    )
            };
        };

    /* ======================================================================
       SECTION 177
       PUBLISH OUTPUT TO WINDOW
       ====================================================================== */

    CoreClass.prototype.publishFrontendPayload =
        function publishFrontendPayload(
            options = {}
        ) {
            const payload =
                this.buildFrontendPayload(
                    options
                );

            global.RainGuardArrivalDataV32 =
                deepClone(
                    payload
                );

            global.RainGuardNationalRainData =
                global.RainGuardArrivalDataV32;

            global.RainGuardRainArrivalResults =
                global.RainGuardArrivalDataV32;

            global.latestRainArrivalResultsV32 =
                global.RainGuardArrivalDataV32;

            global.dispatchEvent(
                new CustomEvent(
                    "rainguard:arrival-data-updated",
                    {
                        detail:
                            deepClone(
                                payload
                            )
                    }
                )
            );

            return payload;
        };

    /* ======================================================================
       SECTION 178
       AUTOMATIC OUTPUT PUBLISHING
       ====================================================================== */

    CoreClass.prototype.startFrontendPublishing =
        function startFrontendPublishing(
            options = {}
        ) {
            const safeOptions =
                safeObject(options);

            const intervalMs =
                Math.max(
                    15 * 1000,
                    toFiniteNumber(
                        safeOptions.intervalMs,
                        DEFAULT_FRONTEND_REFRESH_MS
                    )
                );

            if (
                this.frontendPublishTimer
            ) {
                global.clearInterval(
                    this.frontendPublishTimer
                );
            }

            this.publishFrontendPayload(
                safeOptions
            );

            this.frontendPublishTimer =
                global.setInterval(
                    () => {
                        if (
                            this.destroyed
                        ) {
                            return;
                        }

                        try {
                            this
                                .publishFrontendPayload(
                                    safeOptions
                                );
                        } catch (error) {
                            if (
                                typeof this
                                    .logError ===
                                "function"
                            ) {
                                this.logError(
                                    "Failed to publish RainGuard frontend payload.",
                                    error
                                );
                            }
                        }
                    },
                    intervalMs
                );

            return {
                started:
                    true,

                intervalMs,

                startedAt:
                    Date.now()
            };
        };

    CoreClass.prototype.stopFrontendPublishing =
        function stopFrontendPublishing() {
            if (
                !this.frontendPublishTimer
            ) {
                return false;
            }

            global.clearInterval(
                this.frontendPublishTimer
            );

            this.frontendPublishTimer =
                null;

            return true;
        };

    /* ======================================================================
       SECTION 179
       EXECUTE FULL PUBLIC OUTPUT PIPELINE
       ====================================================================== */

    CoreClass.prototype.executePublicOutputPipeline =
        function executePublicOutputPipeline(
            options = {}
        ) {
            if (
                options.rebuildDashboard !==
                false
            ) {
                this
                    .executeHorizonAggregation(
                        options.horizons ||
                        {}
                    );
            }

            const payload =
                this.publishFrontendPayload(
                    options.frontend ||
                    options
                );

            const legacy =
                this
                    .buildLegacyRainArrivalResponse(
                        options.frontend ||
                        options
                    );

            global.RainGuardLegacyRainArrivalData =
                deepClone(
                    legacy
                );

            return {
                generatedAt:
                    Date.now(),

                payload:
                    deepClone(
                        payload
                    ),

                legacy:
                    deepClone(
                        legacy
                    )
            };
        };

    /* ======================================================================
       SECTION 180
       GLOBAL PUBLIC API
       ====================================================================== */

    function getDefaultCoreInstance() {
        return (
            global
                .rainArrivalRecoveryCoreV32 ||
            global
                .RainArrivalRecoveryCoreV32Instance ||
            global
                .rainGuardArrivalCore ||
            null
        );
    }

    function requireDefaultCoreInstance() {
        const core =
            getDefaultCoreInstance();

        if (!core) {
            throw new Error(
                "No active RainArrivalRecoveryCoreV32 instance was found."
            );
        }

        return core;
    }

    const PublicApi = {
        getInstance() {
            return getDefaultCoreInstance();
        },

        setInstance(instance) {
            if (
                !(instance instanceof CoreClass)
            ) {
                throw new TypeError(
                    "Instance must be RainArrivalRecoveryCoreV32."
                );
            }

            global
                .rainArrivalRecoveryCoreV32 =
                instance;

            global
                .RainArrivalRecoveryCoreV32Instance =
                instance;

            global
                .rainGuardArrivalCore =
                instance;

            return instance;
        },

        async start(options = {}) {
            return requireDefaultCoreInstance()
                .start(options);
        },

        async stop(options = {}) {
            return requireDefaultCoreInstance()
                .stop(options);
        },

        async restart(options = {}) {
            return requireDefaultCoreInstance()
                .restart(options);
        },

        async refresh(options = {}) {
            const core =
                requireDefaultCoreInstance();

            const cycle =
                await core.refreshNow(
                    options
                );

            const output =
                core
                    .executePublicOutputPipeline(
                        options
                    );

            return {
                cycle,
                output
            };
        },

        getPayload(options = {}) {
            return requireDefaultCoreInstance()
                .buildFrontendPayload(
                    options
                );
        },

        publish(options = {}) {
            return requireDefaultCoreInstance()
                .publishFrontendPayload(
                    options
                );
        },

        getLegacyData(options = {}) {
            return requireDefaultCoreInstance()
                .buildLegacyRainArrivalResponse(
                    options
                );
        },

        getRainingNow(options = {}) {
            return requireDefaultCoreInstance()
                .buildPublicRainingNowList(
                    options
                );
        },

        getArrivals(
            horizonHours = 72,
            options = {}
        ) {
            return requireDefaultCoreInstance()
                .buildPublicHorizonList(
                    horizonHours,
                    options
                );
        },

        get6Hours(options = {}) {
            return this.getArrivals(
                6,
                options
            );
        },

        get12Hours(options = {}) {
            return this.getArrivals(
                12,
                options
            );
        },

        get24Hours(options = {}) {
            return this.getArrivals(
                24,
                options
            );
        },

        get48Hours(options = {}) {
            return this.getArrivals(
                48,
                options
            );
        },

        get72Hours(options = {}) {
            return this.getArrivals(
                72,
                options
            );
        },

        getRegions(options = {}) {
            return requireDefaultCoreInstance()
                .buildPublicRegionList(
                    options
                );
        },

        getGovernorates(options = {}) {
            return requireDefaultCoreInstance()
                .buildPublicGovernorateList(
                    options
                );
        },

        getRegion(
            regionId,
            horizonHours = 72,
            options = {}
        ) {
            return requireDefaultCoreInstance()
                .getPublicRegionRain(
                    regionId,
                    horizonHours,
                    options
                );
        },

        getGovernorate(
            governorateId,
            horizonHours = 72,
            options = {}
        ) {
            return requireDefaultCoreInstance()
                .getPublicGovernorateRain(
                    governorateId,
                    horizonHours,
                    options
                );
        },

        getLocation(
            locationId,
            options = {}
        ) {
            return requireDefaultCoreInstance()
                .getPublicLocationRain(
                    locationId,
                    options
                );
        },

        getCells(options = {}) {
            return requireDefaultCoreInstance()
                .buildPublicActiveCellList(
                    options
                );
        },

        getSummary(options = {}) {
            return requireDefaultCoreInstance()
                .buildPublicNationalSummary(
                    options
                );
        },

        getHealth() {
            return requireDefaultCoreInstance()
                .getEngineHealth();
        },

        getStatus() {
            return requireDefaultCoreInstance()
                .getLifecycleStatus();
        }
    };

    global.RainGuardArrivalAPI =
        PublicApi;

    global.RainArrivalAPI =
        PublicApi;

    global.RainGuardNationalArrivalAPI =
        PublicApi;

    /* ======================================================================
       SECTION 181
       LEGACY GLOBAL FUNCTIONS
       ====================================================================== */

    global.getRainArrivalData =
        function getRainArrivalData(
            options = {}
        ) {
            return PublicApi
                .getPayload(
                    options
                );
        };

    global.getRainArrivalCities =
        function getRainArrivalCities(
            horizonHours = 72,
            options = {}
        ) {
            return PublicApi
                .getArrivals(
                    horizonHours,
                    options
                );
        };

    global.getRainNowCities =
        function getRainNowCities(
            options = {}
        ) {
            return PublicApi
                .getRainingNow(
                    options
                );
        };

    global.getRainArrival6Hours =
        function getRainArrival6Hours(
            options = {}
        ) {
            return PublicApi
                .get6Hours(
                    options
                );
        };

    global.getRainArrival12Hours =
        function getRainArrival12Hours(
            options = {}
        ) {
            return PublicApi
                .get12Hours(
                    options
                );
        };

    global.getRainArrival24Hours =
        function getRainArrival24Hours(
            options = {}
        ) {
            return PublicApi
                .get24Hours(
                    options
                );
        };

    global.getRainArrival48Hours =
        function getRainArrival48Hours(
            options = {}
        ) {
            return PublicApi
                .get48Hours(
                    options
                );
        };

    global.getRainArrival72Hours =
        function getRainArrival72Hours(
            options = {}
        ) {
            return PublicApi
                .get72Hours(
                    options
                );
        };

    global.getSaudiRainRegions =
        function getSaudiRainRegions(
            options = {}
        ) {
            return PublicApi
                .getRegions(
                    options
                );
        };

    global.getSaudiRainGovernorates =
        function getSaudiRainGovernorates(
            options = {}
        ) {
            return PublicApi
                .getGovernorates(
                    options
                );
        };

    global.getSaudiRainLocation =
        function getSaudiRainLocation(
            locationId,
            options = {}
        ) {
            return PublicApi
                .getLocation(
                    locationId,
                    options
                );
        };

    global.refreshRainArrivalData =
        async function refreshRainArrivalData(
            options = {}
        ) {
            return PublicApi
                .refresh(
                    options
                );
        };

    /* ======================================================================
       SECTION 182
       EXTEND START AND STOP FOR FRONTEND PUBLISHING
       ====================================================================== */

    const originalStart =
        CoreClass.prototype.start;

    const originalStop =
        CoreClass.prototype.stop;

    const originalDestroy =
        CoreClass.prototype.destroy;

    CoreClass.prototype.start =
        async function startWithFrontendPublishing(
            options = {}
        ) {
            const result =
                await originalStart.call(
                    this,
                    options
                );

            if (
                options.publishFrontend !==
                false
            ) {
                this
                    .startFrontendPublishing({
                        ...safeObject(
                            options.frontend
                        ),

                        intervalMs:
                            options
                                .frontendRefreshMs ||
                            options
                                .frontend
                                ?.intervalMs ||
                            DEFAULT_FRONTEND_REFRESH_MS
                    });
            }

            return result;
        };

    CoreClass.prototype.stop =
        async function stopWithFrontendPublishing(
            options = {}
        ) {
            this
                .stopFrontendPublishing();

            return originalStop.call(
                this,
                options
            );
        };

    CoreClass.prototype.destroy =
        async function destroyWithFrontendPublishing() {
            this
                .stopFrontendPublishing();

            return originalDestroy.call(
                this
            );
        };

    /* ======================================================================
       SECTION 183
       UPDATE OUTPUT AFTER EACH SUCCESSFUL CYCLE
       ====================================================================== */

    const originalRunCycle =
        CoreClass.prototype.runCycle;

    CoreClass.prototype.runCycle =
        async function runCycleWithPublicOutput(
            options = {}
        ) {
            const result =
                await originalRunCycle.call(
                    this,
                    options
                );

            if (
                result?.status ===
                "success" ||
                result?.status ===
                "partial"
            ) {
                try {
                    this
                        .executePublicOutputPipeline({
                            rebuildDashboard:
                                false,

                            frontend:
                                options.frontend ||
                                {}
                        });
                } catch (error) {
                    if (
                        typeof this
                            .logError ===
                        "function"
                    ) {
                        this.logError(
                            "Failed to build public RainGuard output after cycle.",
                            error
                        );
                    }
                }
            }

            return result;
        };

    /* ======================================================================
       SECTION 184
       CREATE DEFAULT INSTANCE
       ====================================================================== */

    CoreClass.createDefaultInstance =
        function createDefaultInstance(
            options = {}
        ) {
            const existing =
                getDefaultCoreInstance();

            if (
                existing instanceof
                CoreClass
            ) {
                return existing;
            }

            const instance =
                new CoreClass(
                    options
                );

            PublicApi.setInstance(
                instance
            );

            return instance;
        };

    CoreClass.getDefaultInstance =
        function getDefaultInstance() {
            return getDefaultCoreInstance();
        };

    /* ======================================================================
       SECTION 185
       OUTPUT COMPATIBILITY ALIASES
       ====================================================================== */

    CoreClass.prototype.getFrontendPayload =
        CoreClass.prototype
            .buildFrontendPayload;

    CoreClass.prototype.getPublicPayload =
        CoreClass.prototype
            .buildFrontendPayload;

    CoreClass.prototype.exportFrontendData =
        CoreClass.prototype
            .publishFrontendPayload;

    CoreClass.prototype.getAllRainArrivalCities =
        CoreClass.prototype
            .buildPublicArrivalList;

    CoreClass.prototype.getRainingNowCities =
        CoreClass.prototype
            .buildPublicRainingNowList;

    CoreClass.prototype.getSaudiRainRegions =
        CoreClass.prototype
            .buildPublicRegionList;

    CoreClass.prototype.getSaudiRainGovernorates =
        CoreClass.prototype
            .buildPublicGovernorateList;

    CoreClass.prototype.getRainArrivalForLocation =
        CoreClass.prototype
            .getPublicLocationRain;

    /* ======================================================================
       SECTION 186
       PART 10 EXPORT
       ====================================================================== */

    global.RainArrivalRecoveryCoreV32Part10 = {
        OUTPUT_SCHEMA_VERSION,
        DEFAULT_PUBLIC_RESULT_LIMIT,
        DEFAULT_FRONTEND_REFRESH_MS,
        DEFAULT_RECENT_DATA_AGE_MS,
        PUBLIC_RAIN_CATEGORY,
        PUBLIC_RISK_LEVEL_AR,
        PUBLIC_RISK_LEVEL_EN,
        normalizePublicId,
        getPredictionEtaHours,
        getPredictionCategory,
        formatEtaArabic,
        formatEtaEnglish,
        getQualityScore,
        getPredictionIntensity,
        getArrivalTimestamp,
        isRecentTimestamp,
        PublicApi
    };

})(window);

