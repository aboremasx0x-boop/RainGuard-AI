from pathlib import Path

content = r'''/**
 * RainGuard AI V32
 * Rain Arrival Integration Layer
 *
 * File:
 * frontend/js/rain_arrival_integration_v32.js
 *
 * Purpose:
 * - Create and manage one shared RainArrivalPredictionEngineV32 instance.
 * - Collect data from RainGuard V30/V31 global engines and adapters.
 * - Normalize radar, lightning, weather, storm-track, and city data.
 * - Execute rain-arrival predictions on demand and on a controlled schedule.
 * - Publish prediction results through browser events and a stable public API.
 * - Protect the main page from adapter, source, and prediction failures.
 *
 * Browser usage:
 *
 * <script src="js/rain_arrival_prediction_engine_v32.js?v=3201"></script>
 * <script src="js/rain_arrival_integration_v32.js?v=3201"></script>
 *
 * await window.RainGuardAI.V32.RainArrivalIntegration.initialize();
 * const result =
 *     await window.RainGuardAI.V32.RainArrivalIntegration.predictCity("الطائف");
 */

(function rainArrivalIntegrationV32Bootstrap(root) {
    'use strict';

    const PRODUCT_NAME = 'RainGuard AI';
    const VERSION = 'V32';
    const SEMANTIC_VERSION = '32.0.0';
    const COMPONENT_NAME = 'Rain Arrival Integration';
    const GLOBAL_NAMESPACE = 'RainGuardAI';
    const DEFAULT_UPDATE_INTERVAL_MS = 5 * 60 * 1000;
    const DEFAULT_SOURCE_TIMEOUT_MS = 12 * 1000;
    const DEFAULT_MAX_RESULT_AGE_MS = 15 * 60 * 1000;
    const DEFAULT_HISTORY_LIMIT = 100;
    const DEFAULT_CITY_LIMIT = 100;
    const MIN_UPDATE_INTERVAL_MS = 30 * 1000;
    const MAX_UPDATE_INTERVAL_MS = 60 * 60 * 1000;

    const EVENTS = Object.freeze({
        INITIALIZING: 'rainguard:v32:arrival:initializing',
        READY: 'rainguard:v32:arrival:ready',
        STARTED: 'rainguard:v32:arrival:started',
        STOPPED: 'rainguard:v32:arrival:stopped',
        PREDICTION_STARTED: 'rainguard:v32:arrival:prediction-started',
        PREDICTION_COMPLETED: 'rainguard:v32:arrival:prediction-completed',
        PREDICTION_FAILED: 'rainguard:v32:arrival:prediction-failed',
        CITY_UPDATED: 'rainguard:v32:arrival:city-updated',
        SOURCE_UPDATED: 'rainguard:v32:arrival:source-updated',
        HEALTH_CHANGED: 'rainguard:v32:arrival:health-changed',
        ERROR: 'rainguard:v32:arrival:error'
    });

    const SOURCE_NAMES = Object.freeze([
        'radar',
        'rainviewer',
        'lightning',
        'anwaa',
        'openmeteo',
        'local_ai',
        'storm_tracking',
        'storm_path',
        'verification',
        'adaptive_learning',
        'dynamic_weights'
    ]);

    const DEFAULT_CONFIGURATION = Object.freeze({
        autoInitialize: false,
        autoStart: false,
        updateIntervalMs: DEFAULT_UPDATE_INTERVAL_MS,
        sourceTimeoutMs: DEFAULT_SOURCE_TIMEOUT_MS,
        maximumResultAgeMs: DEFAULT_MAX_RESULT_AGE_MS,
        maximumHistoryEntries: DEFAULT_HISTORY_LIMIT,
        maximumCitiesPerCycle: DEFAULT_CITY_LIMIT,
        runtimeMode: 'automatic',
        continueOnCityFailure: true,
        continueOnSourceFailure: true,
        initializeEngine: true,
        includeDiagnostics: false,
        includeRawSourcePayloads: false,
        useLegacyFallback: true,
        predictionOptions: {},
        sourceOptions: {},
        cityProvider: null,
        targetProvider: null,
        logger: null
    });

    const state = {
        initialized: false,
        initializing: false,
        initializationPromise: null,
        running: false,
        disposed: false,
        engine: null,
        configuration: null,
        intervalHandle: null,
        activeCyclePromise: null,
        cycleSequence: 0,
        predictionSequence: 0,
        lastCycleStartedAt: null,
        lastCycleCompletedAt: null,
        lastSuccessfulCycleAt: null,
        lastError: null,
        sourceSnapshots: new Map(),
        cityResults: new Map(),
        predictionHistory: [],
        adapters: new Map(),
        listeners: new Map(),
        health: {
            status: 'idle',
            score: 100,
            updatedAt: Date.now(),
            sources: {}
        }
    };

    function now() {
        return Date.now();
    }

    function isObject(value) {
        return value !== null &&
            typeof value === 'object' &&
            !Array.isArray(value);
    }

    function toFiniteNumber(value, fallback = null) {
        const numeric = Number(value);
        return Number.isFinite(numeric)
            ? numeric
            : fallback;
    }

    function clamp(value, minimum, maximum) {
        return Math.min(
            maximum,
            Math.max(
                minimum,
                value
            )
        );
    }

    function deepMerge(base, override) {
        const result = {
            ...(isObject(base) ? base : {})
        };

        if (!isObject(override)) {
            return result;
        }

        for (const [key, value] of Object.entries(override)) {
            if (
                isObject(value) &&
                isObject(result[key])
            ) {
                result[key] = deepMerge(
                    result[key],
                    value
                );
            } else {
                result[key] = value;
            }
        }

        return result;
    }

    function cloneSerializable(value) {
        if (typeof structuredClone === 'function') {
            try {
                return structuredClone(value);
            } catch (error) {
                // Fall through to JSON cloning.
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

    function normalizeConfiguration(options = {}) {
        const merged = deepMerge(
            DEFAULT_CONFIGURATION,
            options
        );

        merged.updateIntervalMs = clamp(
            toFiniteNumber(
                merged.updateIntervalMs,
                DEFAULT_UPDATE_INTERVAL_MS
            ),
            MIN_UPDATE_INTERVAL_MS,
            MAX_UPDATE_INTERVAL_MS
        );

        merged.sourceTimeoutMs = Math.max(
            1000,
            toFiniteNumber(
                merged.sourceTimeoutMs,
                DEFAULT_SOURCE_TIMEOUT_MS
            )
        );

        merged.maximumResultAgeMs = Math.max(
            1000,
            toFiniteNumber(
                merged.maximumResultAgeMs,
                DEFAULT_MAX_RESULT_AGE_MS
            )
        );

        merged.maximumHistoryEntries = Math.max(
            1,
            Math.floor(
                toFiniteNumber(
                    merged.maximumHistoryEntries,
                    DEFAULT_HISTORY_LIMIT
                )
            )
        );

        merged.maximumCitiesPerCycle = Math.max(
            1,
            Math.floor(
                toFiniteNumber(
                    merged.maximumCitiesPerCycle,
                    DEFAULT_CITY_LIMIT
                )
            )
        );

        return merged;
    }

    function getLogger() {
        const configured =
            state.configuration?.logger;

        if (
            configured &&
            typeof configured === 'object'
        ) {
            return configured;
        }

        return typeof console !== 'undefined'
            ? console
            : {
                debug() {},
                info() {},
                warn() {},
                error() {}
            };
    }

    function log(level, message, context = null) {
        const logger = getLogger();
        const handler =
            typeof logger[level] === 'function'
                ? logger[level]
                : logger.info;

        try {
            handler.call(
                logger,
                `[${PRODUCT_NAME} ${VERSION}] ${message}`,
                context ?? ''
            );
        } catch (error) {
            // Logging must never interrupt integration execution.
        }
    }

    function normalizeError(error, context = {}) {
        if (error instanceof Error) {
            return {
                name: error.name || 'Error',
                message: error.message || String(error),
                stack: error.stack || null,
                code: error.code || null,
                context,
                timestamp: now()
            };
        }

        return {
            name: 'Error',
            message:
                typeof error === 'string'
                    ? error
                    : JSON.stringify(error),
            stack: null,
            code: null,
            context,
            timestamp: now()
        };
    }

    function createId(prefix) {
        return [
            prefix,
            now().toString(36),
            Math.random()
                .toString(36)
                .slice(2, 10)
        ].join('_');
    }

    function dispatchBrowserEvent(eventName, detail) {
        if (
            !root ||
            typeof root.dispatchEvent !== 'function' ||
            typeof root.CustomEvent !== 'function'
        ) {
            return false;
        }

        try {
            root.dispatchEvent(
                new root.CustomEvent(
                    eventName,
                    {
                        detail
                    }
                )
            );

            return true;
        } catch (error) {
            return false;
        }
    }

    function emit(eventName, detail = {}) {
        const payload = {
            event: eventName,
            component: COMPONENT_NAME,
            version: VERSION,
            timestamp: now(),
            ...detail
        };

        dispatchBrowserEvent(
            eventName,
            payload
        );

        const listeners =
            state.listeners.get(
                eventName
            );

        if (listeners) {
            for (const listener of [...listeners]) {
                try {
                    listener(payload);
                } catch (error) {
                    log(
                        'warn',
                        `Listener failed for event ${eventName}.`,
                        normalizeError(error)
                    );
                }
            }
        }

        return payload;
    }

    function subscribe(eventName, listener) {
        if (typeof listener !== 'function') {
            throw new TypeError(
                'Rain Arrival Integration listener must be a function.'
            );
        }

        if (!state.listeners.has(eventName)) {
            state.listeners.set(
                eventName,
                new Set()
            );
        }

        state.listeners
            .get(eventName)
            .add(listener);

        return function unsubscribe() {
            state.listeners
                .get(eventName)
                ?.delete(listener);
        };
    }

    function withTimeout(executor, timeoutMs, label) {
        return new Promise((resolve, reject) => {
            let settled = false;

            const timer = setTimeout(() => {
                if (settled) {
                    return;
                }

                settled = true;

                reject(
                    new Error(
                        `${label || 'Operation'} timed out after ${timeoutMs} ms.`
                    )
                );
            }, timeoutMs);

            Promise.resolve()
                .then(executor)
                .then((result) => {
                    if (settled) {
                        return;
                    }

                    settled = true;
                    clearTimeout(timer);
                    resolve(result);
                })
                .catch((error) => {
                    if (settled) {
                        return;
                    }

                    settled = true;
                    clearTimeout(timer);
                    reject(error);
                });
        });
    }

    function resolvePath(path, base = root) {
        if (!path) {
            return undefined;
        }

        const segments =
            Array.isArray(path)
                ? path
                : String(path).split('.');

        let current = base;

        for (const segment of segments) {
            if (
                current === null ||
                current === undefined
            ) {
                return undefined;
            }

            current = current[segment];
        }

        return current;
    }

    function firstDefined(paths) {
        for (const path of paths) {
            const value = resolvePath(path);

            if (value !== undefined) {
                return value;
            }
        }

        return undefined;
    }

    function firstFunction(paths) {
        for (const path of paths) {
            const value = resolvePath(path);

            if (typeof value === 'function') {
                return {
                    fn: value,
                    owner: resolvePath(
                        String(path)
                            .split('.')
                            .slice(0, -1)
                    ) || root,
                    path
                };
            }
        }

        return null;
    }

    function normalizeCoordinate(value) {
        if (!value) {
            return null;
        }

        if (Array.isArray(value) && value.length >= 2) {
            const latitude =
                toFiniteNumber(value[0]);
            const longitude =
                toFiniteNumber(value[1]);

            return isValidCoordinate(
                latitude,
                longitude
            )
                ? {
                    latitude,
                    longitude
                }
                : null;
        }

        const latitude =
            toFiniteNumber(
                value.latitude ??
                value.lat ??
                value.y
            );

        const longitude =
            toFiniteNumber(
                value.longitude ??
                value.lon ??
                value.lng ??
                value.x
            );

        return isValidCoordinate(
            latitude,
            longitude
        )
            ? {
                latitude,
                longitude
            }
            : null;
    }

    function isValidCoordinate(latitude, longitude) {
        return Number.isFinite(latitude) &&
            Number.isFinite(longitude) &&
            latitude >= -90 &&
            latitude <= 90 &&
            longitude >= -180 &&
            longitude <= 180;
    }

    function normalizeTimestamp(value) {
        if (value instanceof Date) {
            return value.getTime();
        }

        if (
            typeof value === 'string' &&
            value.trim()
        ) {
            const parsed =
                Date.parse(value);

            if (Number.isFinite(parsed)) {
                return parsed;
            }
        }

        const numeric =
            toFiniteNumber(value);

        if (!Number.isFinite(numeric)) {
            return now();
        }

        return numeric < 10_000_000_000
            ? numeric * 1000
            : numeric;
    }

    function normalizeCity(city, index = 0) {
        if (!city) {
            return null;
        }

        if (typeof city === 'string') {
            return {
                id: city,
                name: city,
                nameAr: city,
                nameEn: city,
                latitude: null,
                longitude: null,
                coordinate: null,
                sourceIndex: index
            };
        }

        const coordinate =
            normalizeCoordinate(
                city.coordinate ??
                city.location ??
                city
            );

        const name =
            String(
                city.name ??
                city.nameAr ??
                city.name_en ??
                city.city ??
                city.label ??
                city.id ??
                `city-${index + 1}`
            );

        const id =
            String(
                city.id ??
                city.code ??
                city.slug ??
                name
            );

        return {
            ...city,
            id,
            name,
            nameAr:
                city.nameAr ??
                city.name_ar ??
                name,
            nameEn:
                city.nameEn ??
                city.name_en ??
                city.englishName ??
                name,
            latitude:
                coordinate?.latitude ??
                null,
            longitude:
                coordinate?.longitude ??
                null,
            coordinate,
            sourceIndex: index
        };
    }

    function normalizeCities(cities) {
        const list =
            Array.isArray(cities)
                ? cities
                : isObject(cities)
                    ? Object.values(cities)
                    : [];

        return list
            .map(normalizeCity)
            .filter(Boolean)
            .filter((city) => city.coordinate)
            .slice(
                0,
                state.configuration
                    ?.maximumCitiesPerCycle ??
                DEFAULT_CITY_LIMIT
            );
    }

    function normalizeObservation(observation, sourceName = 'unknown') {
        if (!observation) {
            return null;
        }

        const coordinate =
            normalizeCoordinate(
                observation.coordinate ??
                observation.position ??
                observation.location ??
                observation
            );

        if (!coordinate) {
            return null;
        }

        return {
            ...observation,
            latitude: coordinate.latitude,
            longitude: coordinate.longitude,
            coordinate,
            timestamp:
                normalizeTimestamp(
                    observation.timestamp ??
                    observation.time ??
                    observation.observedAt ??
                    observation.createdAt
                ),
            source:
                String(
                    observation.source ??
                    sourceName
                ),
            intensity:
                clamp(
                    toFiniteNumber(
                        observation.intensity ??
                        observation.rainIntensity ??
                        observation.reflectivity ??
                        observation.dbz ??
                        observation.strength,
                        0
                    ),
                    0,
                    100
                ),
            confidence:
                clamp(
                    toFiniteNumber(
                        observation.confidence ??
                        observation.reliability ??
                        observation.quality,
                        50
                    ),
                    0,
                    100
                )
        };
    }

    function normalizeObservationList(value, sourceName) {
        const list =
            Array.isArray(value)
                ? value
                : Array.isArray(value?.observations)
                    ? value.observations
                    : Array.isArray(value?.history)
                        ? value.history
                        : Array.isArray(value?.points)
                            ? value.points
                            : [];

        return list
            .map((item) =>
                normalizeObservation(
                    item,
                    sourceName
                )
            )
            .filter(Boolean)
            .sort((first, second) =>
                first.timestamp -
                second.timestamp
            );
    }

    function normalizeStormTrack(value) {
        const candidate =
            value?.projectedTrack ??
            value?.stormPath ??
            value?.path ??
            value?.track ??
            value?.predictions ??
            value;

        const list =
            Array.isArray(candidate)
                ? candidate
                : [];

        return list
            .map((point, index) => {
                const coordinate =
                    normalizeCoordinate(
                        point.coordinate ??
                        point.position ??
                        point.location ??
                        point
                    );

                if (!coordinate) {
                    return null;
                }

                return {
                    ...point,
                    coordinate,
                    latitude:
                        coordinate.latitude,
                    longitude:
                        coordinate.longitude,
                    forecastMinutes:
                        toFiniteNumber(
                            point.forecastMinutes ??
                            point.minutesAhead ??
                            point.leadMinutes ??
                            point.horizonMinutes ??
                            point.etaMinutes,
                            index * 30
                        ),
                    timestamp:
                        normalizeTimestamp(
                            point.timestamp ??
                            (
                                now() +
                                (
                                    toFiniteNumber(
                                        point.forecastMinutes ??
                                        point.minutesAhead ??
                                        point.leadMinutes,
                                        index * 30
                                    ) *
                                    60 * 1000
                                )
                            )
                        ),
                    confidence:
                        clamp(
                            toFiniteNumber(
                                point.confidence,
                                60
                            ),
                            0,
                            100
                        ),
                    intensity:
                        clamp(
                            toFiniteNumber(
                                point.intensity ??
                                point.expectedIntensity ??
                                point.riskScore,
                                0
                            ),
                            0,
                            100
                        )
                };
            })
            .filter(Boolean);
    }

    function normalizeSourceSnapshot(sourceName, rawPayload) {
        const payload =
            rawPayload?.data ??
            rawPayload?.result ??
            rawPayload;

        const observations =
            normalizeObservationList(
                payload,
                sourceName
            );

        const latestObservation =
            observations.length > 0
                ? observations[
                    observations.length - 1
                ]
                : normalizeObservation(
                    payload?.latestObservation ??
                    payload?.current ??
                    payload,
                    sourceName
                );

        const track =
            normalizeStormTrack(
                payload
            );

        const confidence =
            clamp(
                toFiniteNumber(
                    payload?.confidence ??
                    payload?.quality ??
                    payload?.reliability ??
                    rawPayload?.confidence,
                    observations.length > 0 ||
                    latestObservation
                        ? 60
                        : 0
                ),
                0,
                100
            );

        return {
            source: sourceName,
            success:
                rawPayload?.success !== false,
            available:
                Boolean(
                    payload &&
                    (
                        observations.length > 0 ||
                        latestObservation ||
                        track.length > 0 ||
                        Object.keys(
                            isObject(payload)
                                ? payload
                                : {}
                        ).length > 0
                    )
                ),
            confidence,
            observations,
            latestObservation,
            track,
            payload:
                state.configuration
                    ?.includeRawSourcePayloads
                    ? cloneSerializable(payload)
                    : null,
            metadata: {
                collectedAt: now(),
                rawType:
                    Array.isArray(payload)
                        ? 'array'
                        : typeof payload
            }
        };
    }

    function registerAdapter(name, adapter, options = {}) {
        const normalizedName =
            String(name || '')
                .trim()
                .toLowerCase();

        if (!normalizedName) {
            throw new TypeError(
                'Adapter name is required.'
            );
        }

        if (
            typeof adapter !== 'function' &&
            !(
                adapter &&
                typeof adapter.collect === 'function'
            )
        ) {
            throw new TypeError(
                `Adapter "${normalizedName}" must be a function or expose collect().`
            );
        }

        const record = {
            name: normalizedName,
            adapter:
                typeof adapter === 'function'
                    ? {
                        collect: adapter
                    }
                    : adapter,
            enabled:
                options.enabled !== false,
            priority:
                toFiniteNumber(
                    options.priority,
                    50
                ),
            timeoutMs:
                Math.max(
                    1000,
                    toFiniteNumber(
                        options.timeoutMs,
                        state.configuration
                            ?.sourceTimeoutMs ??
                        DEFAULT_SOURCE_TIMEOUT_MS
                    )
                ),
            registeredAt: now(),
            lastAttemptAt: null,
            lastSuccessAt: null,
            lastFailureAt: null,
            successCount: 0,
            failureCount: 0,
            lastError: null
        };

        state.adapters.set(
            normalizedName,
            record
        );

        return cloneSerializable({
            ...record,
            adapter: undefined
        });
    }

    function unregisterAdapter(name) {
        return state.adapters.delete(
            String(name || '')
                .toLowerCase()
        );
    }

    function enableAdapter(name, enabled = true) {
        const record =
            state.adapters.get(
                String(name || '')
                    .toLowerCase()
            );

        if (!record) {
            return false;
        }

        record.enabled =
            enabled !== false;

        return true;
    }

    function createFunctionAdapter(paths, transform = null) {
        return {
            async collect(context) {
                const match =
                    firstFunction(paths);

                if (!match) {
                    return {
                        success: false,
                        available: false,
                        reason:
                            'source_function_not_found',
                        paths
                    };
                }

                const result =
                    await match.fn.call(
                        match.owner,
                        context
                    );

                return transform
                    ? transform(
                        result,
                        context
                    )
                    : result;
            }
        };
    }

    function createValueAdapter(paths) {
        return {
            async collect() {
                const value =
                    firstDefined(paths);

                if (value === undefined) {
                    return {
                        success: false,
                        available: false,
                        reason:
                            'source_value_not_found',
                        paths
                    };
                }

                return value;
            }
        };
    }

    function registerBuiltInAdapters() {
        const definitions = [
            {
                name: 'rainviewer',
                priority: 10,
                adapter: createFunctionAdapter([
                    'RainGuardAI.V31.RainViewerAdapter.getCurrentData',
                    'RainGuardAI.V31.RainViewerAdapter.collect',
                    'RainViewerAdapterV31.getCurrentData',
                    'RainViewerAdapterV31.collect',
                    'rainViewerAdapter.getCurrentData',
                    'rainViewerAdapter.collect',
                    'getRainViewerData'
                ])
            },
            {
                name: 'radar',
                priority: 15,
                adapter: createFunctionAdapter([
                    'RainGuardAI.V31.RadarAdapter.getCurrentData',
                    'RainGuardAI.V31.RadarAdapter.collect',
                    'RadarAdapterV31.getCurrentData',
                    'RadarAdapterV31.collect',
                    'radarAdapter.getCurrentData',
                    'radarAdapter.collect',
                    'getRadarData'
                ])
            },
            {
                name: 'lightning',
                priority: 20,
                adapter: createFunctionAdapter([
                    'RainGuardAI.V31.LightningAdapter.getCurrentData',
                    'RainGuardAI.V31.LightningAdapter.collect',
                    'LightningAdapterV31.getCurrentData',
                    'LightningAdapterV31.collect',
                    'lightningAdapter.getCurrentData',
                    'lightningAdapter.collect',
                    'getLightningData'
                ])
            },
            {
                name: 'anwaa',
                priority: 30,
                adapter: createFunctionAdapter([
                    'RainGuardAI.V30.AnwaaAdapter.getCurrentData',
                    'RainGuardAI.V30.AnwaaAdapter.collect',
                    'AnwaaAdapterV30.getCurrentData',
                    'AnwaaAdapterV30.collect',
                    'anwaaAdapter.getCurrentData',
                    'anwaaAdapter.collect',
                    'getAnwaaData'
                ])
            },
            {
                name: 'openmeteo',
                priority: 35,
                adapter: createFunctionAdapter([
                    'RainGuardAI.V30.OpenMeteoAdapter.getCurrentData',
                    'RainGuardAI.V30.OpenMeteoAdapter.collect',
                    'OpenMeteoAdapterV30.getCurrentData',
                    'OpenMeteoAdapterV30.collect',
                    'openMeteoAdapter.getCurrentData',
                    'openMeteoAdapter.collect',
                    'getOpenMeteoData'
                ])
            },
            {
                name: 'local_ai',
                priority: 40,
                adapter: createFunctionAdapter([
                    'RainGuardAI.V31.LocalAIAdapter.getCurrentData',
                    'RainGuardAI.V31.LocalAIAdapter.collect',
                    'LocalAIAdapterV31.getCurrentData',
                    'LocalAIAdapterV31.collect',
                    'localAIAdapter.getCurrentData',
                    'localAIAdapter.collect',
                    'getLocalAIData'
                ])
            },
            {
                name: 'storm_tracking',
                priority: 5,
                adapter: createFunctionAdapter([
                    'RainGuardAI.V31.StormCellTrackingEngine.getLatestTrack',
                    'RainGuardAI.V31.StormCellTrackingEngine.getCurrentTrack',
                    'StormCellTrackingEngineV31.getLatestTrack',
                    'StormCellTrackingEngineV31.getCurrentTrack',
                    'stormCellTrackingEngineV31.getLatestTrack',
                    'stormCellTrackingEngineV31.getCurrentTrack'
                ])
            },
            {
                name: 'storm_path',
                priority: 6,
                adapter: createFunctionAdapter([
                    'RainGuardAI.V31.StormPathPredictionEngine.getLatestPrediction',
                    'RainGuardAI.V31.StormPathPredictionEngine.predict',
                    'StormPathPredictionEngineV31.getLatestPrediction',
                    'StormPathPredictionEngineV31.predict',
                    'stormPathPredictionEngineV31.getLatestPrediction',
                    'stormPathPredictionEngineV31.predict'
                ])
            },
            {
                name: 'verification',
                priority: 45,
                adapter: createValueAdapter([
                    'RainGuardAI.V30.VerificationEngine.lastResult',
                    'VerificationEngineV30.lastResult',
                    'verificationEngineV30.lastResult',
                    'window.__rgVerificationSnapshot'
                ])
            },
            {
                name: 'adaptive_learning',
                priority: 50,
                adapter: createValueAdapter([
                    'RainGuardAI.V31.AdaptiveLearningEngine.state',
                    'AdaptiveLearningEngineV31.state',
                    'adaptiveLearningEngineV31.state',
                    'window.__rgAdaptiveLearningSnapshot'
                ])
            },
            {
                name: 'dynamic_weights',
                priority: 55,
                adapter: createValueAdapter([
                    'RainGuardAI.V31.DynamicSourceWeighting.weights',
                    'DynamicSourceWeightingV31.weights',
                    'dynamicSourceWeightingV31.weights',
                    'window.__rgSourceWeights'
                ])
            }
        ];

        for (const definition of definitions) {
            if (!state.adapters.has(definition.name)) {
                registerAdapter(
                    definition.name,
                    definition.adapter,
                    {
                        priority:
                            definition.priority
                    }
                );
            }
        }
    }

    async function collectAdapter(record, context) {
        record.lastAttemptAt =
            now();

        try {
            const result =
                await withTimeout(
                    () =>
                        record.adapter.collect({
                            ...context,
                            source:
                                record.name,
                            options:
                                state.configuration
                                    ?.sourceOptions?.[
                                        record.name
                                    ] ??
                                {}
                        }),
                    record.timeoutMs,
                    `Source ${record.name}`
                );

            const snapshot =
                normalizeSourceSnapshot(
                    record.name,
                    result
                );

            record.lastSuccessAt =
                now();
            record.successCount +=
                1;
            record.lastError =
                null;

            state.sourceSnapshots.set(
                record.name,
                snapshot
            );

            emit(
                EVENTS.SOURCE_UPDATED,
                {
                    source:
                        record.name,
                    success: true,
                    snapshot:
                        cloneSerializable(snapshot)
                }
            );

            return snapshot;
        } catch (error) {
            const normalizedError =
                normalizeError(
                    error,
                    {
                        source:
                            record.name
                    }
                );

            record.lastFailureAt =
                now();
            record.failureCount +=
                1;
            record.lastError =
                normalizedError;

            const snapshot = {
                source:
                    record.name,
                success: false,
                available: false,
                confidence: 0,
                observations: [],
                latestObservation: null,
                track: [],
                payload: null,
                error:
                    normalizedError,
                metadata: {
                    collectedAt:
                        now()
                }
            };

            state.sourceSnapshots.set(
                record.name,
                snapshot
            );

            emit(
                EVENTS.SOURCE_UPDATED,
                {
                    source:
                        record.name,
                    success: false,
                    snapshot:
                        cloneSerializable(snapshot)
                }
            );

            if (
                !state.configuration
                    .continueOnSourceFailure
            ) {
                throw error;
            }

            return snapshot;
        }
    }

    async function collectAllSources(context = {}) {
        const adapters =
            [...state.adapters.values()]
                .filter((record) =>
                    record.enabled
                )
                .sort((first, second) =>
                    first.priority -
                    second.priority
                );

        const snapshots =
            await Promise.all(
                adapters.map((record) =>
                    collectAdapter(
                        record,
                        context
                    )
                )
            );

        return Object.fromEntries(
            snapshots.map((snapshot) => [
                snapshot.source,
                snapshot
            ])
        );
    }

    function resolveEngineConstructor() {
        const candidate =
            firstDefined([
                'RainGuardAI.V32.RainArrivalPredictionEngineV32',
                'RainGuardAI.V32.RainArrivalPredictionEngine',
                'RG32.RainArrivalPredictionEngine',
                'RainArrivalPredictionEngineV32',
                'RainArrivalPredictionEngine'
            ]);

        return typeof candidate === 'function'
            ? candidate
            : null;
    }

    function createEngine(options = {}) {
        const EngineConstructor =
            resolveEngineConstructor();

        if (!EngineConstructor) {
            throw new Error(
                'RainArrivalPredictionEngineV32 was not found. Load rain_arrival_prediction_engine_v32.js before the integration file.'
            );
        }

        return new EngineConstructor(
            options
        );
    }

    function setEngine(engine) {
        if (
            !engine ||
            (
                typeof engine.predictRainArrival !== 'function' &&
                typeof engine.predictV32 !== 'function' &&
                typeof engine.run !== 'function'
            )
        ) {
            throw new TypeError(
                'Invalid Rain Arrival Prediction Engine instance.'
            );
        }

        state.engine =
            engine;

        return engine;
    }

    function getEngine() {
        return state.engine;
    }

    async function initialize(options = {}) {
        if (state.disposed) {
            throw new Error(
                'Rain Arrival Integration has been disposed.'
            );
        }

        if (
            state.initialized &&
            !options.forceReinitialize
        ) {
            return getStatus();
        }

        if (
            state.initializing &&
            state.initializationPromise
        ) {
            return state.initializationPromise;
        }

        state.initializing =
            true;

        state.configuration =
            normalizeConfiguration(
                deepMerge(
                    state.configuration ??
                    {},
                    options
                )
            );

        emit(
            EVENTS.INITIALIZING,
            {
                configuration:
                    cloneSerializable(
                        state.configuration
                    )
            }
        );

        state.initializationPromise =
            Promise.resolve()
                .then(async () => {
                    registerBuiltInAdapters();

                    if (!state.engine) {
                        setEngine(
                            createEngine(
                                state.configuration
                                    .predictionOptions
                            )
                        );
                    }

                    if (
                        state.configuration
                            .initializeEngine &&
                        typeof state.engine
                            .initializeRainArrivalEngine ===
                        'function'
                    ) {
                        await state.engine
                            .initializeRainArrivalEngine({
                                ...state.configuration
                                    .predictionOptions,
                                runtimeMode:
                                    state.configuration
                                        .runtimeMode
                            });
                    } else if (
                        state.configuration
                            .initializeEngine &&
                        typeof state.engine
                            .initialize ===
                        'function'
                    ) {
                        await state.engine
                            .initialize(
                                state.configuration
                                    .predictionOptions
                            );
                    }

                    state.initialized =
                        true;
                    state.initializing =
                        false;
                    state.lastError =
                        null;

                    updateHealth();

                    const status =
                        getStatus();

                    emit(
                        EVENTS.READY,
                        {
                            status
                        }
                    );

                    if (
                        state.configuration
                            .autoStart
                    ) {
                        start();
                    }

                    return status;
                })
                .catch((error) => {
                    state.initialized =
                        false;
                    state.initializing =
                        false;
                    state.lastError =
                        normalizeError(
                            error,
                            {
                                operation:
                                    'initialize'
                            }
                        );

                    emit(
                        EVENTS.ERROR,
                        {
                            error:
                                state.lastError
                        }
                    );

                    throw error;
                });

        return state.initializationPromise;
    }

    async function resolveCities(context = {}) {
        const provider =
            state.configuration
                ?.cityProvider;

        if (typeof provider === 'function') {
            const provided =
                await provider(context);

            return normalizeCities(
                provided
            );
        }

        const candidates = [
            firstDefined([
                'RainGuardAI.cities',
                'RainGuardAI.V30.cities',
                'RainGuardAI.V31.cities',
                'RainGuardAI.V32.cities',
                'RG_CITIES',
                'SAUDI_CITIES',
                'citiesData',
                'cityData'
            ]),
            context.cities,
            context.input?.cities
        ];

        for (const candidate of candidates) {
            const cities =
                normalizeCities(
                    candidate
                );

            if (cities.length > 0) {
                return cities;
            }
        }

        return [];
    }

    function findCityByIdentifier(identifier, cities = []) {
        const normalized =
            String(identifier ?? '')
                .trim()
                .toLowerCase();

        return cities.find((city) => {
            const candidates = [
                city.id,
                city.code,
                city.name,
                city.nameAr,
                city.nameEn,
                city.slug
            ];

            return candidates.some((value) =>
                String(value ?? '')
                    .trim()
                    .toLowerCase() ===
                normalized
            );
        }) ?? null;
    }

    function selectBestStormObservation(sources) {
        const candidates = [];

        for (const sourceName of [
            'storm_tracking',
            'storm_path',
            'radar',
            'rainviewer',
            'lightning',
            'local_ai'
        ]) {
            const source =
                sources[sourceName];

            if (
                source?.latestObservation
            ) {
                candidates.push({
                    ...source.latestObservation,
                    sourceConfidence:
                        source.confidence,
                    sourceName
                });
            }

            if (
                Array.isArray(
                    source?.observations
                )
            ) {
                for (const observation of source.observations) {
                    candidates.push({
                        ...observation,
                        sourceConfidence:
                            source.confidence,
                        sourceName
                    });
                }
            }
        }

        return candidates
            .filter((candidate) =>
                candidate.coordinate
            )
            .sort((first, second) => {
                const firstScore =
                    first.timestamp +
                    (
                        first.confidence +
                        first.sourceConfidence
                    ) *
                    1000;

                const secondScore =
                    second.timestamp +
                    (
                        second.confidence +
                        second.sourceConfidence
                    ) *
                    1000;

                return secondScore -
                    firstScore;
            })[0] ?? null;
    }

    function mergeObservations(sources) {
        const observations = [];

        for (const source of Object.values(sources)) {
            if (
                Array.isArray(
                    source?.observations
                )
            ) {
                observations.push(
                    ...source.observations
                );
            }

            if (
                source?.latestObservation &&
                !source.observations?.includes(
                    source.latestObservation
                )
            ) {
                observations.push(
                    source.latestObservation
                );
            }
        }

        const deduplicated =
            new Map();

        for (const observation of observations) {
            if (!observation?.coordinate) {
                continue;
            }

            const key = [
                observation.source,
                Math.round(
                    observation.latitude *
                    10000
                ),
                Math.round(
                    observation.longitude *
                    10000
                ),
                Math.round(
                    observation.timestamp /
                    60000
                )
            ].join(':');

            const existing =
                deduplicated.get(key);

            if (
                !existing ||
                observation.confidence >
                existing.confidence
            ) {
                deduplicated.set(
                    key,
                    observation
                );
            }
        }

        return [...deduplicated.values()]
            .sort((first, second) =>
                first.timestamp -
                second.timestamp
            );
    }

    function selectProjectedTrack(sources) {
        for (const sourceName of [
            'storm_path',
            'storm_tracking',
            'local_ai',
            'radar',
            'rainviewer'
        ]) {
            const track =
                sources[sourceName]
                    ?.track;

            if (
                Array.isArray(track) &&
                track.length > 0
            ) {
                return track;
            }
        }

        return [];
    }

    function buildEngineSources(sources) {
        const output = {};

        for (const sourceName of SOURCE_NAMES) {
            const snapshot =
                sources[sourceName];

            if (!snapshot) {
                continue;
            }

            output[sourceName] = {
                available:
                    snapshot.available,
                success:
                    snapshot.success,
                confidence:
                    snapshot.confidence,
                latestObservation:
                    snapshot.latestObservation,
                observations:
                    snapshot.observations,
                track:
                    snapshot.track,
                ...(snapshot.payload &&
                state.configuration
                    .includeRawSourcePayloads
                    ? {
                        payload:
                            snapshot.payload
                    }
                    : {})
            };
        }

        return output;
    }

    function buildPredictionInput(city, sources, context = {}) {
        const observations =
            mergeObservations(
                sources
            );

        const latestStorm =
            selectBestStormObservation(
                sources
            );

        const projectedTrack =
            selectProjectedTrack(
                sources
            );

        const customTargetProvider =
            state.configuration
                ?.targetProvider;

        const customTarget =
            typeof customTargetProvider === 'function'
                ? customTargetProvider(
                    city,
                    context
                )
                : null;

        const targetCoordinate =
            normalizeCoordinate(
                customTarget ??
                city.coordinate ??
                city
            );

        const stormCoordinate =
            normalizeCoordinate(
                context.stormCoordinate ??
                latestStorm?.coordinate ??
                projectedTrack[0]?.coordinate
            );

        return {
            executionId:
                createId(
                    'arrival'
                ),
            targetId:
                city.id,
            targetName:
                city.name,
            targetCoordinate,
            city,
            cities:
                context.cities ??
                [city],
            stormCoordinate,
            observations,
            projectedTrack,
            sources:
                buildEngineSources(
                    sources
                ),
            sourceWeights:
                sources.dynamic_weights
                    ?.payload ??
                sources.dynamic_weights,
            verification:
                sources.verification
                    ?.payload ??
                sources.verification,
            adaptiveLearning:
                sources.adaptive_learning
                    ?.payload ??
                sources.adaptive_learning,
            timestamp:
                now(),
            metadata: {
                integrationVersion:
                    VERSION,
                cycleId:
                    context.cycleId ??
                    null,
                predictionId:
                    context.predictionId ??
                    null
            }
        };
    }

    async function executeEnginePrediction(input, options = {}) {
        if (!state.engine) {
            throw new Error(
                'Rain Arrival Prediction Engine is not initialized.'
            );
        }

        if (
            typeof state.engine
                .predictRainArrival ===
            'function'
        ) {
            return state.engine
                .predict
