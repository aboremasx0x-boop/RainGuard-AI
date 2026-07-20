from pathlib import Path

code = r'''/**
 * RainGuard AI V32
 * Rain Arrival Integration Layer
 *
 * File:
 * frontend/js/rain_arrival_integration_v32.js
 *
 * Responsibilities:
 * - Create and manage a single RainArrivalPredictionEngineV32 instance.
 * - Discover compatible V30/V31 data providers and runtime stores.
 * - Normalize radar, weather, lightning, local-AI, storm-track, and city data.
 * - Execute periodic and event-driven rain-arrival predictions.
 * - Publish normalized results to the UI, map, and other RainGuard modules.
 * - Provide safe fallbacks without interrupting the host page.
 *
 * Browser usage:
 *
 *   <script src="js/rain_arrival_prediction_engine_v32.js?v=3201"></script>
 *   <script src="js/rain_arrival_integration_v32.js?v=3201"></script>
 *
 * Optional automatic startup:
 *
 *   window.RainGuardAI.V32.rainArrivalIntegration.start();
 *
 * @version 32.0.0
 * @license Proprietary
 */

(function rainArrivalIntegrationV32Bootstrap(globalScope) {
    'use strict';

    const GLOBAL = globalScope || (
        typeof globalThis !== 'undefined'
            ? globalThis
            : typeof window !== 'undefined'
                ? window
                : null
    );

    if (!GLOBAL) {
        return;
    }

    const INTEGRATION_NAME = 'RainArrivalIntegrationV32';
    const INTEGRATION_VERSION = '32.0.0';
    const DEFAULT_EVENT_PREFIX = 'rainguard:v32:rain-arrival';

    const DEFAULT_CONFIGURATION = Object.freeze({
        enabled: true,
        autoStart: false,
        autoInitializeEngine: true,
        predictionIntervalMs: 120000,
        minimumPredictionIntervalMs: 15000,
        sourceRefreshIntervalMs: 60000,
        staleSourceThresholdMs: 15 * 60 * 1000,
        maximumObservationAgeMs: 90 * 60 * 1000,
        maximumObservations: 120,
        maximumTrackPoints: 120,
        maximumCities: 100,
        runtimeMode: 'automatic',
        eventPrefix: DEFAULT_EVENT_PREFIX,
        useDocumentEvents: true,
        useWindowEvents: true,
        enableConsoleLogging: true,
        logLevel: 'info',
        publishToMap: true,
        publishToUI: true,
        includeDiagnostics: false,
        requireTargetCoordinate: true,
        predictAllCities: true,
        defaultTargetCityId: null,
        defaultTargetCoordinate: null,
        trustedSourceNames: [
            'rainviewer',
            'radar',
            'openmeteo',
            'anwaa',
            'lightning',
            'local_ai',
            'storm_tracking',
            'storm_path',
            'manual'
        ]
    });

    const LOG_PRIORITIES = Object.freeze({
        trace: 10,
        debug: 20,
        info: 30,
        warn: 40,
        error: 50,
        fatal: 60
    });

    /**
     * Safely convert a value to a finite number.
     *
     * @param {*} value
     * @param {number|null} fallback
     * @returns {number|null}
     */
    function toFiniteNumber(value, fallback = null) {
        const numericValue = Number(value);
        return Number.isFinite(numericValue)
            ? numericValue
            : fallback;
    }

    /**
     * Clamp a number.
     *
     * @param {number} value
     * @param {number} minimum
     * @param {number} maximum
     * @returns {number}
     */
    function clamp(value, minimum, maximum) {
        return Math.max(
            minimum,
            Math.min(maximum, Number(value) || 0)
        );
    }

    /**
     * Return the first non-nullish value.
     *
     * @param  {...any} values
     * @returns {*}
     */
    function firstDefined(...values) {
        return values.find(
            (value) => value !== undefined && value !== null
        );
    }

    /**
     * Produce a defensive plain-object clone.
     *
     * @param {*} value
     * @returns {*}
     */
    function safeClone(value) {
        if (
            value === null ||
            value === undefined ||
            typeof value !== 'object'
        ) {
            return value;
        }

        try {
            if (typeof structuredClone === 'function') {
                return structuredClone(value);
            }
        } catch (error) {
            // Continue to JSON fallback.
        }

        try {
            return JSON.parse(JSON.stringify(value));
        } catch (error) {
            return null;
        }
    }

    /**
     * Resolve a nested property without throwing.
     *
     * @param {Object} root
     * @param {string} path
     * @returns {*}
     */
    function getPath(root, path) {
        if (!root || !path) {
            return undefined;
        }

        return String(path)
            .split('.')
            .reduce(
                (value, key) => (
                    value === null || value === undefined
                        ? undefined
                        : value[key]
                ),
                root
            );
    }

    /**
     * Resolve the first defined nested property.
     *
     * @param {Object} root
     * @param {string[]} paths
     * @returns {*}
     */
    function getFirstPath(root, paths) {
        for (const path of paths) {
            const value = getPath(root, path);

            if (value !== undefined && value !== null) {
                return value;
            }
        }

        return undefined;
    }

    /**
     * Normalize a timestamp to epoch milliseconds.
     *
     * @param {*} value
     * @param {number} fallback
     * @returns {number}
     */
    function normalizeTimestamp(value, fallback = Date.now()) {
        if (value instanceof Date) {
            const dateValue = value.getTime();
            return Number.isFinite(dateValue)
                ? dateValue
                : fallback;
        }

        const numericValue = Number(value);

        if (Number.isFinite(numericValue)) {
            return numericValue < 100000000000
                ? numericValue * 1000
                : numericValue;
        }

        const parsed = Date.parse(String(value || ''));

        return Number.isFinite(parsed)
            ? parsed
            : fallback;
    }

    /**
     * Normalize a coordinate object.
     *
     * @param {*} value
     * @returns {{latitude:number, longitude:number}|null}
     */
    function normalizeCoordinate(value) {
        if (!value) {
            return null;
        }

        if (
            Array.isArray(value) &&
            value.length >= 2
        ) {
            const latitude = toFiniteNumber(value[0]);
            const longitude = toFiniteNumber(value[1]);

            if (
                latitude !== null &&
                longitude !== null &&
                latitude >= -90 &&
                latitude <= 90 &&
                longitude >= -180 &&
                longitude <= 180
            ) {
                return {
                    latitude,
                    longitude
                };
            }
        }

        if (typeof value !== 'object') {
            return null;
        }

        const latitude = toFiniteNumber(
            firstDefined(
                value.latitude,
                value.lat,
                value.y,
                value.center?.latitude,
                value.center?.lat,
                value.coordinates?.[1]
            )
        );

        const longitude = toFiniteNumber(
            firstDefined(
                value.longitude,
                value.lng,
                value.lon,
                value.long,
                value.x,
                value.center?.longitude,
                value.center?.lng,
                value.coordinates?.[0]
            )
        );

        if (
            latitude === null ||
            longitude === null ||
            latitude < -90 ||
            latitude > 90 ||
            longitude < -180 ||
            longitude > 180
        ) {
            return null;
        }

        return {
            latitude,
            longitude
        };
    }

    /**
     * Remove duplicate records using a generated key.
     *
     * @param {Array} records
     * @param {Function} keyBuilder
     * @returns {Array}
     */
    function uniqueBy(records, keyBuilder) {
        const seen = new Set();
        const output = [];

        for (const record of records) {
            const key = keyBuilder(record);

            if (seen.has(key)) {
                continue;
            }

            seen.add(key);
            output.push(record);
        }

        return output;
    }

    /**
     * Rain arrival V32 integration controller.
     */
    class RainArrivalIntegrationV32 {
        /**
         * @param {Object} [options]
         */
        constructor(options = {}) {
            this.configuration = {
                ...DEFAULT_CONFIGURATION,
                ...options
            };

            this.configuration.predictionIntervalMs = Math.max(
                Number(this.configuration.minimumPredictionIntervalMs) ||
                    DEFAULT_CONFIGURATION.minimumPredictionIntervalMs,
                Number(this.configuration.predictionIntervalMs) ||
                    DEFAULT_CONFIGURATION.predictionIntervalMs
            );

            this.state = {
                createdAt: Date.now(),
                initializedAt: null,
                startedAt: null,
                stoppedAt: null,
                initialized: false,
                initializing: false,
                started: false,
                disposed: false,
                predictionRunning: false,
                refreshRunning: false,
                predictionSequence: 0,
                successfulPredictionCount: 0,
                failedPredictionCount: 0,
                sourceRefreshCount: 0,
                lastPredictionAt: null,
                lastPredictionDurationMs: null,
                lastPredictionInput: null,
                lastPredictionResult: null,
                lastError: null,
                activeTarget: null,
                sourceSnapshot: {},
                cityResults: new Map()
            };

            this.engine = null;
            this.adapters = new Map();
            this.subscribers = new Set();
            this.eventUnsubscribers = [];
            this.timers = {
                prediction: null,
                sourceRefresh: null
            };

            this._boundVisibilityHandler =
                this._handleDocumentVisibilityChange.bind(this);

            this._registerBuiltInAdapters();
        }

        /**
         * Write an integration log.
         *
         * @param {string} level
         * @param {string} message
         * @param {Object} [context]
         */
        log(level, message, context = {}) {
            const normalizedLevel = String(level || 'info').toLowerCase();
            const configuredPriority =
                LOG_PRIORITIES[
                    String(this.configuration.logLevel || 'info').toLowerCase()
                ] ?? LOG_PRIORITIES.info;

            if (
                !this.configuration.enableConsoleLogging ||
                (LOG_PRIORITIES[normalizedLevel] ?? LOG_PRIORITIES.info) <
                    configuredPriority
            ) {
                return;
            }

            const record = {
                timestamp: new Date().toISOString(),
                component: INTEGRATION_NAME,
                version: INTEGRATION_VERSION,
                level: normalizedLevel,
                message: String(message || ''),
                context
            };

            if (
                this.engine &&
                typeof this.engine.writeObservabilityLog === 'function'
            ) {
                try {
                    this.engine.writeObservabilityLog(
                        normalizedLevel,
                        message,
                        {
                            component: INTEGRATION_NAME,
                            ...context
                        },
                        this.configuration
                    );
                } catch (error) {
                    // Console fallback below.
                }
            }

            const logger =
                normalizedLevel === 'error' || normalizedLevel === 'fatal'
                    ? console.error
                    : normalizedLevel === 'warn'
                        ? console.warn
                        : normalizedLevel === 'debug' ||
                            normalizedLevel === 'trace'
                            ? console.debug
                            : console.info;

            if (typeof logger === 'function') {
                logger.call(console, `[${INTEGRATION_NAME}]`, record);
            }
        }

        /**
         * Resolve the V32 engine constructor.
         *
         * @returns {Function|null}
         */
        resolveEngineConstructor() {
            const candidates = [
                GLOBAL.RainArrivalPredictionEngineV32,
                GLOBAL.RainGuardAI?.V32?.RainArrivalPredictionEngineV32,
                GLOBAL.RainGuardAI?.V32?.RainArrivalPredictionEngine,
                GLOBAL.RG32?.RainArrivalPredictionEngine
            ];

            return candidates.find(
                (candidate) => typeof candidate === 'function'
            ) || null;
        }

        /**
         * Create or reuse the engine singleton.
         *
         * @returns {Object}
         */
        createEngine() {
            if (this.engine) {
                return this.engine;
            }

            const existingEngine =
                GLOBAL.RainGuardAI?.V32?.rainArrivalEngine ||
                GLOBAL.RG32?.rainArrivalEngine;

            if (
                existingEngine &&
                typeof existingEngine.predictRainArrival === 'function'
            ) {
                this.engine = existingEngine;
                return this.engine;
            }

            const EngineConstructor = this.resolveEngineConstructor();

            if (!EngineConstructor) {
                throw new Error(
                    '[RainGuard AI V32] RainArrivalPredictionEngineV32 is not loaded.'
                );
            }

            this.engine = new EngineConstructor({
                runtimeMode: this.configuration.runtimeMode,
                includeFinalDiagnostics:
                    this.configuration.includeDiagnostics,
                autoInitialize: false
            });

            GLOBAL.RainGuardAI = GLOBAL.RainGuardAI || {};
            GLOBAL.RainGuardAI.V32 = GLOBAL.RainGuardAI.V32 || {};
            GLOBAL.RainGuardAI.V32.rainArrivalEngine = this.engine;

            GLOBAL.RG32 = GLOBAL.RG32 || {};
            GLOBAL.RG32.rainArrivalEngine = this.engine;

            return this.engine;
        }

        /**
         * Initialize the integration and underlying engine.
         *
         * @returns {Promise<Object>}
         */
        async initialize() {
            if (this.state.disposed) {
                throw new Error(
                    '[RainGuard AI V32] Integration has been disposed.'
                );
            }

            if (this.state.initialized) {
                return {
                    initialized: true,
                    reused: true,
                    engine: this.engine
                };
            }

            if (this.state.initializing) {
                return this._initializationPromise;
            }

            this.state.initializing = true;
            const startedAt = Date.now();

            this._initializationPromise = Promise.resolve()
                .then(async () => {
                    const engine = this.createEngine();

                    if (
                        this.configuration.autoInitializeEngine &&
                        typeof engine.initializeRainArrivalEngine === 'function'
                    ) {
                        await engine.initializeRainArrivalEngine({
                            runtimeMode: this.configuration.runtimeMode,
                            includeFinalDiagnostics:
                                this.configuration.includeDiagnostics,
                            enableLegacyCompatibility: true
                        });
                    }

                    this._attachHostEventListeners();
                    await this.refreshSourceSnapshot();

                    this.state.initialized = true;
                    this.state.initializing = false;
                    this.state.initializedAt = Date.now();

                    this.log('info', 'Rain arrival integration initialized.', {
                        durationMs: Date.now() - startedAt,
                        adapterCount: this.adapters.size
                    });

                    this.emit('initialized', {
                        initializedAt: this.state.initializedAt,
                        adapterNames: Array.from(this.adapters.keys())
                    });

                    return {
                        initialized: true,
                        reused: false,
                        durationMs: Date.now() - startedAt,
                        adapterNames: Array.from(this.adapters.keys())
                    };
                })
                .catch((error) => {
                    this.state.initializing = false;
                    this.state.lastError = this.normalizeError(
                        error,
                        'initialize'
                    );

                    this.log('error', 'Integration initialization failed.', {
                        error: this.state.lastError
                    });

                    throw error;
                });

            return this._initializationPromise;
        }

        /**
         * Start periodic source refresh and prediction cycles.
         *
         * @returns {Promise<Object>}
         */
        async start() {
            if (!this.configuration.enabled) {
                return {
                    started: false,
                    reason: 'integration_disabled'
                };
            }

            if (this.state.started) {
                return {
                    started: true,
                    reused: true
                };
            }

            await this.initialize();

            this.state.started = true;
            this.state.startedAt = Date.now();
            this.state.stoppedAt = null;

            this._scheduleSourceRefresh();
            this._schedulePrediction();

            const initialPrediction = await this.runPrediction({
                reason: 'startup'
            });

            this.emit('started', {
                startedAt: this.state.startedAt,
                initialPrediction
            });

            return {
                started: true,
                reused: false,
                initialPrediction
            };
        }

        /**
         * Stop timers without disposing the integration.
         *
         * @returns {Object}
         */
        stop() {
            if (this.timers.prediction) {
                clearInterval(this.timers.prediction);
                this.timers.prediction = null;
            }

            if (this.timers.sourceRefresh) {
                clearInterval(this.timers.sourceRefresh);
                this.timers.sourceRefresh = null;
            }

            this.state.started = false;
            this.state.stoppedAt = Date.now();

            this.emit('stopped', {
                stoppedAt: this.state.stoppedAt
            });

            return {
                stopped: true,
                stoppedAt: this.state.stoppedAt
            };
        }

        /**
         * Dispose integration resources.
         *
         * @param {Object} [options]
         * @returns {Promise<Object>}
         */
        async dispose(options = {}) {
            this.stop();
            this._detachHostEventListeners();

            this.subscribers.clear();
            this.adapters.clear();

            if (
                options.disposeEngine === true &&
                this.engine &&
                typeof this.engine.disposeRainArrivalEngine === 'function'
            ) {
                await this.engine.disposeRainArrivalEngine({
                    flushTelemetryBeforeDispose: true
                });
            }

            this.state.disposed = true;

            return {
                disposed: true,
                disposedAt: Date.now()
            };
        }

        /**
         * Register a custom source adapter.
         *
         * Adapter shape:
         * {
         *   name,
         *   priority,
         *   enabled,
         *   read(integration): Promise<any>|any
         * }
         *
         * @param {string} name
         * @param {Object|Function} adapter
         * @returns {Object}
         */
        registerAdapter(name, adapter) {
            const normalizedName = String(name || '')
                .trim()
                .toLowerCase();

            if (!normalizedName) {
                return {
                    registered: false,
                    reason: 'invalid_adapter_name'
                };
            }

            const normalizedAdapter =
                typeof adapter === 'function'
                    ? {
                        read: adapter
                    }
                    : {
                        ...adapter
                    };

            if (typeof normalizedAdapter.read !== 'function') {
                return {
                    registered: false,
                    reason: 'adapter_read_function_required'
                };
            }

            const record = {
                name: normalizedName,
                priority:
                    toFiniteNumber(normalizedAdapter.priority, 50) ?? 50,
                enabled: normalizedAdapter.enabled !== false,
                read: normalizedAdapter.read,
                normalize:
                    typeof normalizedAdapter.normalize === 'function'
                        ? normalizedAdapter.normalize
                        : null,
                registeredAt: Date.now(),
                lastReadAt: null,
                lastSuccessAt: null,
                lastFailureAt: null,
                lastError: null
            };

            this.adapters.set(normalizedName, record);

            return {
                registered: true,
                adapter: {
                    ...record,
                    read: undefined,
                    normalize: undefined
                }
            };
        }

        /**
         * Enable or disable an adapter.
         *
         * @param {string} name
         * @param {boolean} enabled
         * @returns {Object}
         */
        setAdapterEnabled(name, enabled) {
            const adapter = this.adapters.get(
                String(name || '').toLowerCase()
            );

            if (!adapter) {
                return {
                    updated: false,
                    reason: 'adapter_not_found'
                };
            }

            adapter.enabled = Boolean(enabled);

            return {
                updated: true,
                name: adapter.name,
                enabled: adapter.enabled
            };
        }

        /**
         * Read all registered adapters.
         *
         * @returns {Promise<Object>}
         */
        async refreshSourceSnapshot() {
            if (this.state.refreshRunning) {
                return {
                    refreshed: false,
                    reason: 'refresh_already_running',
                    snapshot: this.state.sourceSnapshot
                };
            }

            this.state.refreshRunning = true;
            const startedAt = Date.now();

            try {
                const adapters = Array.from(this.adapters.values())
                    .filter((adapter) => adapter.enabled)
                    .sort((first, second) => first.priority - second.priority);

                const results = await Promise.all(
                    adapters.map(async (adapter) => {
                        adapter.lastReadAt = Date.now();

                        try {
                            const rawValue = await Promise.resolve(
                                adapter.read(this)
                            );

                            const value = adapter.normalize
                                ? adapter.normalize(rawValue, this)
                                : rawValue;

                            adapter.lastSuccessAt = Date.now();
                            adapter.lastFailureAt = null;
                            adapter.lastError = null;

                            return {
                                name: adapter.name,
                                success: true,
                                value
                            };
                        } catch (error) {
                            adapter.lastFailureAt = Date.now();
                            adapter.lastError = this.normalizeError(
                                error,
                                `adapter:${adapter.name}`
                            );

                            return {
                                name: adapter.name,
                                success: false,
                                error: adapter.lastError,
                                value: null
                            };
                        }
                    })
                );

                const snapshot = {};

                for (const result of results) {
                    snapshot[result.name] = {
                        success: result.success,
                        updatedAt: Date.now(),
                        value: safeClone(result.value),
                        error: result.error || null
                    };
                }

                this.state.sourceSnapshot = snapshot;
                this.state.sourceRefreshCount += 1;

                const successfulCount = results.filter(
                    (result) => result.success
                ).length;

                this.emit('sources-refreshed', {
                    successfulCount,
                    failedCount: results.length - successfulCount,
                    snapshot
                });

                return {
                    refreshed: true,
                    durationMs: Date.now() - startedAt,
                    successfulCount,
                    failedCount: results.length - successfulCount,
                    snapshot
                };
            } finally {
                this.state.refreshRunning = false;
            }
        }

        /**
         * Build one normalized V32 prediction input.
         *
         * @param {Object} [overrides]
         * @returns {Object}
         */
        buildPredictionInput(overrides = {}) {
            const snapshot = this.state.sourceSnapshot || {};

            const cities = this.normalizeCities(
                firstDefined(
                    overrides.cities,
                    snapshot.cities?.value,
                    this.readGlobalCityCollection()
                )
            );

            const target = this.resolveTarget(
                overrides,
                cities
            );

            const stormData = this.resolveStormData(
                overrides,
                snapshot
            );

            const observations = this.normalizeObservations(
                firstDefined(
                    overrides.observations,
                    stormData.observations,
                    snapshot.observations?.value,
                    snapshot.storm_tracking?.value,
                    []
                )
            );

            const projectedTrack = this.normalizeTrackPoints(
                firstDefined(
                    overrides.projectedTrack,
                    stormData.projectedTrack,
                    snapshot.storm_path?.value,
                    []
                )
            );

            const sources = this.buildSourcePayloads(
                overrides,
                snapshot
            );

            const input = {
                targetId:
                    firstDefined(
                        overrides.targetId,
                        target.city?.id,
                        target.city?.name,
                        null
                    ),

                targetCity:
                    target.city || null,

                targetCoordinate:
                    target.coordinate,

                stormCoordinate:
                    firstDefined(
                        normalizeCoordinate(overrides.stormCoordinate),
                        stormData.coordinate,
                        observations.length
                            ? normalizeCoordinate(
                                observations[
                                    observations.length - 1
                                ]
                            )
                            : null,
                        projectedTrack.length
                            ? normalizeCoordinate(projectedTrack[0])
                            : null
                    ),

                observations,

                projectedTrack,

                cities,

                sources,

                timestamp: Date.now(),

                integration: {
                    name: INTEGRATION_NAME,
                    version: INTEGRATION_VERSION,
                    predictionSequence:
                        this.state.predictionSequence + 1,
                    sourceRefreshCount:
                        this.state.sourceRefreshCount
                }
            };

            if (
                this.configuration.requireTargetCoordinate &&
                !input.targetCoordinate
            ) {
                throw new Error(
                    '[RainGuard AI V32] No valid target coordinate is available.'
                );
            }

            return input;
        }

        /**
         * Execute a prediction cycle.
         *
         * @param {Object} [options]
         * @returns {Promise<Object>}
         */
        async runPrediction(options = {}) {
            if (this.state.predictionRunning) {
                return {
                    success: false,
                    skipped: true,
                    reason: 'prediction_already_running'
                };
            }

            await this.initialize();

            this.state.predictionRunning = true;
            const startedAt = Date.now();
            const sequence = this.state.predictionSequence + 1;

            try {
                if (options.refreshSources === true) {
                    await this.refreshSourceSnapshot();
                }

                const input = this.buildPredictionInput(
                    options.input || options
                );

                this.state.predictionSequence = sequence;
                this.state.lastPredictionInput = safeClone(input);

                this.emit('prediction-started', {
                    sequence,
                    reason: options.reason || 'manual',
                    input
                });

                const result = await this.engine.predictRainArrival(
                    input,
                    {
                        runtimeMode:
                            options.runtimeMode ||
                            this.configuration.runtimeMode,
                        includeFinalDiagnostics:
                            this.configuration.includeDiagnostics,
                        correlationId:
                            options.correlationId ||
                            `${INTEGRATION_NAME}_${sequence}_${Date.now()}`
                    }
                );

                const durationMs = Date.now() - startedAt;
                const normalizedResult = this.normalizePredictionResult(
                    result,
                    input,
                    {
                        sequence,
                        durationMs
                    }
                );

                this.state.lastPredictionAt = Date.now();
                this.state.lastPredictionDurationMs = durationMs;
                this.state.lastPredictionResult = safeClone(
                    normalizedResult
                );

                if (normalizedResult.success) {
                    this.state.successfulPredictionCount += 1;
                } else {
                    this.state.failedPredictionCount += 1;
                }

                this._indexCityResults(normalizedResult);
                this.publishPrediction(normalizedResult);

                this.emit('prediction-completed', normalizedResult);

                return normalizedResult;
            } catch (error) {
                const normalizedError = this.normalizeError(
                    error,
                    'runPrediction'
                );

                this.state.failedPredictionCount += 1;
                this.state.lastError = normalizedError;
                this.state.lastPredictionAt = Date.now();
                this.state.lastPredictionDurationMs =
                    Date.now() - startedAt;

                const failure = {
                    success: false,
                    sequence,
                    durationMs: Date.now() - startedAt,
                    error: normalizedError,
                    timestamp: Date.now()
                };

                this.log('error', 'Rain arrival prediction failed.', {
                    sequence,
                    error: normalizedError
                });

                this.emit('prediction-failed', failure);

                return failure;
            } finally {
                this.state.predictionRunning = false;
            }
        }

        /**
         * Run one prediction for every configured city.
         *
         * @param {Object} [options]
         * @returns {Promise<Object>}
         */
        async runAllCityPredictions(options = {}) {
            await this.initialize();

            const cities = this.normalizeCities(
                firstDefined(
                    options.cities,
                    this.state.sourceSnapshot.cities?.value,
                    this.readGlobalCityCollection()
                )
            );

            if (!cities.length) {
                return {
                    success: false,
                    reason: 'no_cities_available',
                    results: []
                };
            }

            const inputs = cities.map((city) => ({
                ...options.input,
                targetId: city.id || city.name,
                targetCity: city,
                targetCoordinate: {
                    latitude: city.latitude,
                    longitude: city.longitude
                },
                cities
            }));

            if (
                typeof this.engine.predictRainArrivalBatch === 'function'
            ) {
                const baseInput = this.buildPredictionInput({
                    ...options.input,
                    cities
                });

                const batchInputs = inputs.map((targetInput) => ({
                    ...baseInput,
                    ...targetInput
                }));

                const batch = await this.engine.predictRainArrivalBatch(
                    batchInputs,
                    {
                        runtimeMode:
                            options.runtimeMode ||
                            this.configuration.runtimeMode,
                        batchConcurrency:
                            options.batchConcurrency || 4
                    }
                );

                const results = batch.results.map((result, index) =>
                    this.normalizePredictionResult(
                        result,
                        batchInputs[index],
                        {
                            sequence:
                                this.state.predictionSequence + index + 1,
                            durationMs: batch.durationMs
                        }
                    )
                );

                results.forEach((result) => {
                    this._indexCityResults(result);
                    this.publishPrediction(result);
                });

                this.state.predictionSequence += results.length;

                return {
                    ...batch,
                    results
                };
            }

            const results = [];

            for (const input of inputs) {
                results.push(
                    await this.runPrediction({
                        ...options,
                        input
                    })
                );
            }

            return {
                success: results.every((result) => result.success),
                results
            };
        }

        /**
         * Normalize a V32 prediction result for host consumers.
         *
         * @param {Object} result
         * @param {Object} input
         * @param {Object} metadata
         * @returns {Object}
         */
        normalizePredictionResult(result, input, metadata = {}) {
            const arrivalMinutes = toFiniteNumber(
                firstDefined(
                    result?.prediction?.arrivalMinutes,
                    result?.arrivalMinutes,
                    result?.etaMinutes,
                    result?.eta,
                    result?.rainArrivalMinutes
                )
            );

            const confidence = clamp(
                firstDefined(
                    result?.prediction?.confidence,
                    result?.confidence,
                    0
                ),
                0,
                100
            );

            const riskScore = clamp(
                firstDefined(
                    result?.operational?.warning?.compositeRiskScore,
                    result?.riskScore,
                    result?.risk,
                    0
                ),
                0,
                100
            );

            const warningLevel = String(
                firstDefined(
                    result?.operational?.warning?.warningLevel,
                    result?.warningLevel,
                    result?.alertLevel,
                    'monitor'
                )
            );

            const targetCity =
                input.targetCity ||
                input.cities.find(
                    (city) =>
                        String(city.id || city.name) ===
                        String(input.targetId)
                ) ||
                null;

            const available =
                result?.prediction?.available ??
                result?.available ??
                arrivalMinutes !== null;

            return {
                success: result?.success !== false,
                available: Boolean(available),
                sequence: metadata.sequence || null,
                durationMs: metadata.durationMs || null,
                timestamp: Date.now(),
                timestampIso: new Date().toISOString(),

                target: {
                    id:
                        input.targetId ||
                        targetCity?.id ||
                        targetCity?.name ||
                        null,
                    name:
                        targetCity?.name ||
                        targetCity?.nameAr ||
                        targetCity?.nameEn ||
                        input.targetId ||
                        null,
                    coordinate: input.targetCoordinate
                },

                arrival: {
                    minutes: arrivalMinutes,
                    estimatedAt:
                        arrivalMinutes !== null
                            ? Date.now() + arrivalMinutes * 60 * 1000
                            : null,
                    estimatedAtIso:
                        arrivalMinutes !== null
                            ? new Date(
                                Date.now() +
                                arrivalMinutes * 60 * 1000
                            ).toISOString()
                            : null
                },

                confidence,

                risk: {
                    score: riskScore,
                    warningLevel,
                    classification:
                        riskScore >= 80
                            ? 'extreme'
                            : riskScore >= 60
                                ? 'high'
                                : riskScore >= 30
                                    ? 'moderate'
                                    : 'low'
                },

                intensity: firstDefined(
                    result?.prediction?.intensity,
                    result?.intensity,
                    result?.expectedIntensity,
                    null
                ),

                affectedCities: firstDefined(
                    result?.impact?.cities,
                    result?.affectedCities,
                    result?.cities,
                    []
                ),

                raw: result,

                integration: {
                    name: INTEGRATION_NAME,
                    version: INTEGRATION_VERSION
                }
            };
        }

        /**
         * Publish a completed result to all supported host consumers.
         *
         * @param {Object} result
         */
        publishPrediction(result) {
            if (this.configuration.publishToUI) {
                this.publishToUI(result);
            }

            if (this.configuration.publishToMap) {
                this.publishToMap(result);
            }

            const callbacks = [
                GLOBAL.onRainArrivalPredictionV32,
                GLOBAL.RainGuardAI?.onRainArrivalPrediction,
                GLOBAL.RainGuardAI?.V32?.onRainArrivalPrediction
            ];

            for (const callback of callbacks) {
                if (typeof callback !== 'function') {
                    continue;
                }

                try {
                    callback(result, this);
                } catch (error) {
                    this.log(
                        'warn',
                        'A host prediction callback failed.',
                        {
                            error: this.normalizeError(
                                error,
                                'publishPrediction'
                            )
                        }
                    );
                }
            }
        }

        /**
         * Publish a result to known UI modules.
         *
         * @param {Object} result
         */
        publishToUI(result) {
            const candidates = [
                GLOBAL.RainArrivalUIV32,
                GLOBAL.RainGuardAI?.V32?.rainArrivalUI,
                GLOBAL.RG32?.rainArrivalUI,
                GLOBAL.NationalAIOS?.rainArrivalUI
            ];

            for (const candidate of candidates) {
                if (!candidate) {
                    continue;
                }

                const method =
                    candidate.renderPrediction ||
                    candidate.updatePrediction ||
                    candidate.updateRainArrival ||
                    candidate.render;

                if (typeof method === 'function') {
                    try {
                        method.call(candidate, result);
                    } catch (error) {
                        this.log('warn', 'UI publication failed.', {
                            error: this.normalizeError(
                                error,
                                'publishToUI'
                            )
                        });
                    }
                }
            }
        }

        /**
         * Publish a result to known map modules.
         *
         * @param {Object} result
         */
        publishToMap(result) {
            const candidates = [
                GLOBAL.RainGuardMapV32,
                GLOBAL.RainGuardAI?.V32?.map,
                GLOBAL.RG32?.map,
                GLOBAL.NationalAIOS?.map,
                GLOBAL.rainGuardMap,
                GLOBAL.mapController
            ];

            for (const candidate of candidates) {
                if (!candidate) {
                    continue;
                }

                const method =
                    candidate.updateRainArrivalPrediction ||
                    candidate.renderRainArrivalPrediction ||
                    candidate.updateArrivalLayer ||
                    candidate.updatePrediction;

                if (typeof method === 'function') {
                    try {
                        method.call(candidate, result);
                    } catch (error) {
                        this.log('warn', 'Map publication failed.', {
                            error: this.normalizeError(
                                error,
                                'publishToMap'
                            )
                        });
                    }
                }
            }
        }

        /**
         * Subscribe to integration events.
         *
         * @param {Function} listener
         * @returns {Function}
         */
        subscribe(listener) {
            if (typeof listener !== 'function') {
                return () => {};
            }

            this.subscribers.add(listener);

            return () => {
                this.subscribers.delete(listener);
            };
        }

        /**
         * Emit integration events to subscribers and DOM.
         *
         * @param {string} type
         * @param {*} detail
         */
        emit(type, detail) {
            const eventName =
                `${this.configuration.eventPrefix}:${type}`;

            const envelope = {
                type,
                eventName,
                timestamp: Date.now(),
                detail
            };

            for (const listener of this.subscribers) {
                try {
                    listener(envelope);
                } catch (error) {
                    // Subscriber errors must not stop event delivery.
                }
            }

            if (
                this.configuration.useDocumentEvents &&
                GLOBAL.document &&
                typeof GLOBAL.document.dispatchEvent === 'function' &&
                typeof GLOBAL.CustomEvent === 'function'
            ) {
                GLOBAL.document.dispatchEvent(
                    new GLOBAL.CustomEvent(eventName, {
                        detail
                    })
                );
            }

            if (
                this.configuration.useWindowEvents &&
                typeof GLOBAL.dispatchEvent === 'function' &&
                typeof GLOBAL.CustomEvent === 'function'
            ) {
                GLOBAL.dispatchEvent(
                    new GLOBAL.CustomEvent(eventName, {
                        detail
                    })
                );
            }
        }

        /**
         * Get the latest normalized result for a city.
         *
         * @param {string} cityIdOrName
         * @returns {Object|null}
         */
        getCityPrediction(cityIdOrName) {
            return this.state.cityResults.get(
                String(cityIdOrName || '').toLowerCase()
            ) || null;
        }

        /**
         * Return complete integration diagnostics.
         *
         * @returns {Object}
         */
        diagnostics() {
            return {
                integration: {
                    name: INTEGRATION_NAME,
                    version: INTEGRATION_VERSION,
                    configuration: {
                        ...this.configuration
                    }
                },

                state: {
                    ...this.state,
                    sourceSnapshot: safeClone(
                        this.state.sourceSnapshot
                    ),
                    cityResults: Array.from(
                        this.state.cityResults.entries()
                    ),
                    lastPredictionInput: safeClone(
                        this.state.lastPredictionInput
                    ),
                    lastPredictionResult: safeClone(
                        this.state.lastPredictionResult
                    )
                },

                adapters: Array.from(
                    this.adapters.values()
                ).map((adapter) => ({
                    name: adapter.name,
                    priority: adapter.priority,
                    enabled: adapter.enabled,
                    registeredAt: adapter.registeredAt,
                    lastReadAt: adapter.lastReadAt,
                    lastSuccessAt: adapter.lastSuccessAt,
                    lastFailureAt: adapter.lastFailureAt,
                    lastError: adapter.lastError
                })),

                engine:
                    this.engine &&
                    typeof this.engine
                        .generateCompleteSystemDiagnostics === 'function'
                        ? this.engine.generateCompleteSystemDiagnostics({
                            includeFinalDiagnostics: false
                        })
                        : null
            };
        }

        /**
         * Update runtime configuration.
         *
         * @param {Object} patch
         * @returns {Object}
         */
        updateConfiguration(patch = {}) {
            const previousPredictionInterval =
                this.configuration.predictionIntervalMs;

            const previousRefreshInterval =
                this.configuration.sourceRefreshIntervalMs;

            this.configuration = {
                ...this.configuration,
                ...patch
            };

            this.configuration.predictionIntervalMs = Math.max(
                Number(this.configuration.minimumPredictionIntervalMs) ||
                    DEFAULT_CONFIGURATION.minimumPredictionIntervalMs,
                Number(this.configuration.predictionIntervalMs) ||
                    DEFAULT_CONFIGURATION.predictionIntervalMs
            );

            if (this.state.started) {
                if (
                    this.configuration.predictionIntervalMs !==
                    previousPredictionInterval
                ) {
                    this._schedulePrediction();
                }

                if (
                    this.configuration.sourceRefreshIntervalMs !==
                    previousRefreshInterval
                ) {
                    this._scheduleSourceRefresh();
                }
            }

            this.emit('configuration-updated', {
                configuration: {
                    ...this.configuration
                }
            });

            return {
                updated: true,
                configuration: {
                    ...this.configuration
                }
            };
        }

        /**
         * Normalize an integration error.
         *
         * @param {*} error
         * @param {string} operation
         * @returns {Object}
         */
        normalizeError(error, operation) {
            return {
                name: error?.name || 'Error',
                message: error?.message || String(error),
                code: error?.code || null,
                operation,
                stack:
                    this.configuration.logLevel === 'debug' ||
                    this.configuration.logLevel === 'trace'
                        ? error?.stack || null
                        : null,
                timestamp: Date.now()
            };
        }

        /**
         * Normalize a city collection.
         *
         * @param {*} value
         * @returns {Array}
         */
        normalizeCities(value) {
            const collection = Array.isArray(value)
                ? value
                : value && typeof value === 'object'
                    ? Object.values(value)
                    : [];

            const normalized = collection
                .slice(0, this.configuration.maximumCities)
                .map((city, index) => {
                    if (!city || typeof city !== 'object') {
                        return null;
                    }

                    const coordinate = normalizeCoordinate(city);

                    if (!coordinate) {
                        return null;
                    }

                    return {
                        ...city,
                        id: String(
                            firstDefined(
                                city.id,
                                city.cityId,
                                city.code,
                                city.slug,
                                city.name,
                                `city_${index}`
                            )
                        ),
                        name: String(
                            firstDefined(
                                city.name,
                                city.nameAr,
                                city.arabicName,
                                city.nameEn,
                                city.englishName,
                                `City ${index + 1}`
                            )
                        ),
                        nameAr: firstDefined(
                            city.nameAr,
                            city.arabicName,
                            city.name
                        ),
                        nameEn: firstDefined(
                            city.nameEn,
                            city.englishName,
                            city.name
                        ),
                        latitude: coordinate.latitude,
                        longitude: coordinate.longitude
                    };
                })
                .filter(Boolean);

            return uniqueBy(
                normalized,
                (city) =>
                    `${city.id}|${city.latitude.toFixed(5)}|${city.longitude.toFixed(5)}`
            );
        }

        /**
         * Normalize historical storm observations.
         *
         * @param {*} value
         * @returns {Array}
         */
        normalizeObservations(value) {
            const collection = Array.isArray(value)
                ? value
                : Array.isArray(value?.observations)
                    ? value.observations
                    : Array.isArray(value?.history)
                        ? value.history
                        : Array.isArray(value?.track)
                            ? value.track
                            : [];

            const minimumTimestamp =
                Date.now() -
                this.configuration.maximumObservationAgeMs;

            return uniqueBy(
                collection
                    .map((observation) => {
                        const coordinate = normalizeCoordinate(observation);

                        if (!coordinate) {
                            return null;
                        }

                        const timestamp = normalizeTimestamp(
                            firstDefined(
                                observation.timestamp,
                                observation.time,
                                observation.detectedAt,
                                observation.updatedAt,
                                observation.createdAt
                            )
                        );

                        if (timestamp < minimumTimestamp) {
                            return null;
                        }

                        return {
                            ...observation,
                            latitude: coordinate.latitude,
                            longitude: coordinate.longitude,
                            timestamp,
                            intensity: toFiniteNumber(
                                firstDefined(
                                    observation.intensity,
                                    observation.rainIntensity,
                                    observation.reflectivity,
                                    observation.dbz,
                                    observation.strength
                                )
                            ),
                            confidence: clamp(
                                firstDefined(
                                    observation.confidence,
                                    observation.quality,
                                    observation.reliability,
                                    70
                                ),
                                0,
                                100
                            ),
                            source: String(
                                firstDefined(
                                    observation.source,
                                    observation.provider,
                                    'storm_tracking'
                                )
                            )
                        };
                    })
                    .filter(Boolean)
                    .sort(
                        (first, second) =>
                            first.timestamp - second.timestamp
                    )
                    .slice(-this.configuration.maximumObservations),
                (observation) =>
                    `${observation.timestamp}|${observation.latitude.toFixed(5)}|${observation.longitude.toFixed(5)}`
            );
        }

        /**
         * Normalize projected storm-track points.
         *
         * @param {*} value
         * @returns {Array}
         */
        normalizeTrackPoints(value) {
            const collection = Array.isArray(value)
                ? value
                : Array.isArray(value?.points)
                    ? value.points
                    : Array.isArray(value?.projectedTrack)
                        ? value.projectedTrack
                        : Array.isArray(value
