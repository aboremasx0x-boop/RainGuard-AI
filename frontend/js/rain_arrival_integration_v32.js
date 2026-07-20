/**
 * RainGuard AI V32
 * Rain Arrival Integration Engine
 *
 * File:
 * frontend/js/rain_arrival_integration_v32.js
 *
 * Part:
 * 2.1A-1
 *
 * Responsibilities:
 * - Create the global namespace
 * - Define integration metadata
 * - Define default configuration
 * - Create runtime state
 * - Add core utility functions
 *
 * Important:
 * - Do not close the IIFE in this part.
 * - Paste Part 2.1A-2 directly after this code.
 */

(function rainArrivalIntegrationV32Module(globalObject) {
    'use strict';

    if (!globalObject) {
        throw new Error(
            'RainGuard AI V32 requires a valid global object.'
        );
    }

    const PRODUCT_NAME = 'RainGuard AI';
    const MODULE_NAME = 'Rain Arrival Integration Engine';
    const VERSION = 'V32';
    const SEMANTIC_VERSION = '32.0.0';

    const ROOT_NAMESPACE_NAME = 'RainGuardAI';
    const VERSION_NAMESPACE_NAME = 'V32';
    const INTEGRATION_API_NAME = 'rainArrivalIntegration';

    /**
     * Create the RainGuard AI root namespace.
     */
    const RainGuardAI =
        globalObject[ROOT_NAMESPACE_NAME] =
            globalObject[ROOT_NAMESPACE_NAME] || {};

    /**
     * Create the V32 namespace.
     */
    const RainGuardV32 =
        RainGuardAI[VERSION_NAMESPACE_NAME] =
            RainGuardAI[VERSION_NAMESPACE_NAME] || {};

    /**
     * Prevent duplicate loading.
     */
    if (
        RainGuardV32[INTEGRATION_API_NAME] &&
        RainGuardV32[INTEGRATION_API_NAME].metadata &&
        RainGuardV32[INTEGRATION_API_NAME]
            .metadata.semanticVersion === SEMANTIC_VERSION
    ) {
        if (
            globalObject.console &&
            typeof globalObject.console.warn === 'function'
        ) {
            globalObject.console.warn(
                '[RainGuard AI V32] Rain arrival integration already loaded.'
            );
        }

        return;
    }

    /**
     * Default integration configuration.
     *
     * These values may later be overridden using:
     *
     * window.RAIN_GUARD_V32_CONFIG = {
     *     rainArrivalIntegration: {
     *         debug: true
     *     }
     * };
     */
    const DEFAULT_CONFIGURATION = Object.freeze({
        enabled: true,

        autoInitialize: true,
        autoStart: false,

        debug: false,
        strictMode: false,

        integrationIntervalMs: 120000,
        sourceRefreshIntervalMs: 60000,

        initializationTimeoutMs: 20000,
        sourceTimeoutMs: 15000,
        predictionTimeoutMs: 30000,

        maximumCitiesPerCycle: 100,
        maximumStormCellsPerCycle: 250,

        minimumSourceConfidence: 0,
        minimumPredictionConfidence: 0,

        enableV30Compatibility: true,
        enableV31Compatibility: true,
        enableV32NativeMode: true,

        enableRainViewerSource: true,
        enableAnwaaSource: true,
        enableOpenMeteoSource: true,
        enableLightningSource: true,
        enableLocalAISource: true,

        enableStormCellTracking: true,
        enableStormPathPrediction: true,
        enableDynamicSourceWeighting: true,
        enableVerificationEngine: true,

        dispatchDomEvents: true,
        persistLastSuccessfulCycle: true,
        reuseLastSuccessfulData: true,

        storageKey:
            'rainguard_ai_v32_rain_arrival_integration_state',

        engineGlobalNames: [
            'RainArrivalPredictionEngineV32',
            'RainArrivalPredictionEngine'
        ],

        engineNamespacePaths: [
            'RainGuardAI.V32.RainArrivalPredictionEngineV32',
            'RainGuardAI.V32.RainArrivalPredictionEngine',
            'RG32.RainArrivalPredictionEngine'
        ],

        eventNames: {
            initialized:
                'rainguard:v32:rain-arrival:initialized',

            started:
                'rainguard:v32:rain-arrival:started',

            stopped:
                'rainguard:v32:rain-arrival:stopped',

            cycleStarted:
                'rainguard:v32:rain-arrival:cycle-started',

            cycleCompleted:
                'rainguard:v32:rain-arrival:cycle-completed',

            cycleFailed:
                'rainguard:v32:rain-arrival:cycle-failed',

            sourceUpdated:
                'rainguard:v32:rain-arrival:source-updated',

            predictionUpdated:
                'rainguard:v32:rain-arrival:prediction-updated',

            cityUpdated:
                'rainguard:v32:rain-arrival:city-updated',

            mapUpdated:
                'rainguard:v32:rain-arrival:map-updated'
        }
    });

    /**
     * Internal runtime state.
     *
     * This object must not be replaced after initialization.
     */
    const runtimeState = {
        createdAt: Date.now(),

        initialized: false,
        initializing: false,

        initializationPromise: null,
        initializationError: null,
        initializedAt: null,

        running: false,
        startedAt: null,
        stoppedAt: null,

        cycleInProgress: false,
        cyclePromise: null,
        cycleTimer: null,

        cycleCount: 0,
        successfulCycleCount: 0,
        failedCycleCount: 0,

        engine: null,
        engineConstructor: null,
        engineSource: null,

        configuration: null,

        dependencies: {
            v30: {},
            v31: {},
            v32: {}
        },

        sources: new Map(),
        sourceAdapters: new Map(),
        cityProviders: new Map(),
        resultConsumers: new Map(),

        latestSourceData: new Map(),
        latestPredictions: new Map(),

        lastCycleStartedAt: null,
        lastCycleCompletedAt: null,
        lastCycleDurationMs: null,

        lastCycleResult: null,
        lastSuccessfulResult: null,

        lastError: null,

        statistics: {
            sourceRequests: 0,
            sourceSuccesses: 0,
            sourceFailures: 0,

            predictionRequests: 0,
            predictionSuccesses: 0,
            predictionFailures: 0,

            consumerExecutions: 0,
            consumerFailures: 0
        }
    };

    /**
     * Determine whether a value is a plain object.
     *
     * @param {*} value
     * @returns {boolean}
     */
    function isPlainObject(value) {
        if (
            value === null ||
            typeof value !== 'object'
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

    /**
     * Determine whether a value is a finite number.
     *
     * @param {*} value
     * @returns {boolean}
     */
    function isFiniteNumber(value) {
        return (
            typeof value === 'number' &&
            Number.isFinite(value)
        );
    }

    /**
     * Convert a value to a finite number.
     *
     * @param {*} value
     * @param {number} fallback
     * @returns {number}
     */
    function toFiniteNumber(
        value,
        fallback = 0
    ) {
        const numericValue =
            Number(value);

        return Number.isFinite(numericValue)
            ? numericValue
            : fallback;
    }

    /**
     * Clamp a number between minimum and maximum.
     *
     * @param {*} value
     * @param {number} minimum
     * @param {number} maximum
     * @returns {number}
     */
    function clamp(
        value,
        minimum,
        maximum
    ) {
        const numericValue =
            toFiniteNumber(
                value,
                minimum
            );

        return Math.min(
            maximum,
            Math.max(
                minimum,
                numericValue
            )
        );
    }

    /**
     * Create a shallow array copy.
     *
     * @param {*} value
     * @returns {Array}
     */
    function cloneArray(value) {
        return Array.isArray(value)
            ? value.slice()
            : [];
    }

    /**
     * Deep merge plain objects.
     *
     * Arrays are replaced rather than merged.
     *
     * @param {Object} base
     * @param {Object} override
     * @returns {Object}
     */
    function deepMerge(
        base,
        override
    ) {
        if (!isPlainObject(base)) {
            if (isPlainObject(override)) {
                return deepMerge(
                    {},
                    override
                );
            }

            return override;
        }

        const output = {
            ...base
        };

        if (!isPlainObject(override)) {
            return output;
        }

        for (
            const [key, value]
            of Object.entries(override)
        ) {
            if (
                isPlainObject(value) &&
                isPlainObject(output[key])
            ) {
                output[key] =
                    deepMerge(
                        output[key],
                        value
                    );

                continue;
            }

            if (Array.isArray(value)) {
                output[key] =
                    cloneArray(value);

                continue;
            }

            output[key] =
                value;
        }

        return output;
    }

    /**
     * Resolve a nested value from the global object.
     *
     * Example:
     * getByPath('RainGuardAI.V31.LightningAdapter')
     *
     * @param {string} path
     * @returns {*}
     */
    function getByPath(path) {
        if (
            typeof path !== 'string' ||
            !path.trim()
        ) {
            return undefined;
        }

        const keys =
            path
                .split('.')
                .map(
                    (key) =>
                        key.trim()
                )
                .filter(Boolean);

        let currentValue =
            globalObject;

        for (const key of keys) {
            if (
                currentValue === null ||
                currentValue === undefined
            ) {
                return undefined;
            }

            currentValue =
                currentValue[key];
        }

        return currentValue;
    }

    /**
     * Generate a unique runtime identifier.
     *
     * @param {string} prefix
     * @returns {string}
     */
    function createRuntimeId(
        prefix = 'rg32'
    ) {
        const randomPart =
            Math.random()
                .toString(36)
                .slice(2, 10);

        const timestampPart =
            Date.now()
                .toString(36);

        return [
            prefix,
            timestampPart,
            randomPart
        ].join('_');
    }

    /**
     * Return the current ISO timestamp.
     *
     * @returns {string}
     */
    function nowIso() {
        return new Date().toISOString();
    }

    /**
     * Normalize any thrown value into a serializable error object.
     *
     * @param {*} error
     * @param {Object} context
     * @returns {Object}
     */
    function normalizeError(
        error,
        context = {}
    ) {
        const normalized = {
            id:
                createRuntimeId(
                    'error'
                ),

            name:
                error &&
                error.name
                    ? String(error.name)
                    : 'Error',

            message:
                error &&
                error.message
                    ? String(error.message)
                    : String(error),

            code:
                error &&
                error.code
                    ? String(error.code)
                    : null,

            stack:
                error &&
                error.stack
                    ? String(error.stack)
                    : null,

            context:
                isPlainObject(context)
                    ? {
                        ...context
                    }
                    : {},

            timestamp:
                Date.now(),

            timestampIso:
                nowIso()
        };

        return normalized;
    }

    /**
     * Resolve runtime configuration.
     *
     * Priority:
     * 1. Default configuration
     * 2. Global RainGuard configuration
     * 3. Function options
     *
     * @param {Object} options
     * @returns {Object}
     */
    function resolveConfiguration(
        options = {}
    ) {
        const globalConfigurationRoot =
            globalObject
                .RAIN_GUARD_V32_CONFIG;

        const globalConfiguration =
            isPlainObject(
                globalConfigurationRoot
            ) &&
            isPlainObject(
                globalConfigurationRoot
                    .rainArrivalIntegration
            )
                ? globalConfigurationRoot
                    .rainArrivalIntegration
                : {};

        const mergedConfiguration =
            deepMerge(
                deepMerge(
                    DEFAULT_CONFIGURATION,
                    globalConfiguration
                ),
                isPlainObject(options)
                    ? options
                    : {}
            );

        mergedConfiguration
            .integrationIntervalMs =
            Math.max(
                10000,
                toFiniteNumber(
                    mergedConfiguration
                        .integrationIntervalMs,
                    120000
                )
            );

        mergedConfiguration
            .sourceRefreshIntervalMs =
            Math.max(
                5000,
                toFiniteNumber(
                    mergedConfiguration
                        .sourceRefreshIntervalMs,
                    60000
                )
            );

        mergedConfiguration
            .initializationTimeoutMs =
            Math.max(
                1000,
                toFiniteNumber(
                    mergedConfiguration
                        .initializationTimeoutMs,
                    20000
                )
            );

        mergedConfiguration
            .sourceTimeoutMs =
            Math.max(
                1000,
                toFiniteNumber(
                    mergedConfiguration
                        .sourceTimeoutMs,
                    15000
                )
            );

        mergedConfiguration
            .predictionTimeoutMs =
            Math.max(
                1000,
                toFiniteNumber(
                    mergedConfiguration
                        .predictionTimeoutMs,
                    30000
                )
            );

        mergedConfiguration
            .maximumCitiesPerCycle =
            Math.max(
                1,
                Math.floor(
                    toFiniteNumber(
                        mergedConfiguration
                            .maximumCitiesPerCycle,
                        100
                    )
                )
            );

        mergedConfiguration
            .maximumStormCellsPerCycle =
            Math.max(
                1,
                Math.floor(
                    toFiniteNumber(
                        mergedConfiguration
                            .maximumStormCellsPerCycle,
                        250
                    )
                )
            );

        mergedConfiguration
            .minimumSourceConfidence =
            clamp(
                mergedConfiguration
                    .minimumSourceConfidence,
                0,
                100
            );

        mergedConfiguration
            .minimumPredictionConfidence =
            clamp(
                mergedConfiguration
                    .minimumPredictionConfidence,
                0,
                100
            );

        runtimeState.configuration =
            mergedConfiguration;

        return mergedConfiguration;
    }

    /**
     * Return the active configuration.
     *
     * @returns {Object}
     */
    function getConfiguration() {
        if (!runtimeState.configuration) {
            return resolveConfiguration();
        }

        return runtimeState.configuration;
    }

    /**
     * Check whether debug mode is enabled.
     *
     * @returns {boolean}
     */
    function isDebugEnabled() {
        return Boolean(
            getConfiguration().debug
        );
    }

    /**
     * Internal logging helper.
     *
     * @param {'debug'|'info'|'warn'|'error'} level
     * @param {string} message
     * @param {*} data
     */
    function log(
        level,
        message,
        data
    ) {
        const consoleObject =
            globalObject.console;

        if (!consoleObject) {
            return;
        }

        if (
            level === 'debug' &&
            !isDebugEnabled()
        ) {
            return;
        }

        const method =
            typeof consoleObject[level] ===
            'function'
                ? level
                : 'log';

        if (
            data === undefined
        ) {
            consoleObject[method](
                `[RainGuard AI V32] ${message}`
            );

            return;
        }

        consoleObject[method](
            `[RainGuard AI V32] ${message}`,
            data
        );
    }

    /**
     * Create a timeout promise.
     *
     * @param {number} timeoutMs
     * @param {string} operationName
     * @returns {Promise<never>}
     */
    function createTimeoutPromise(
        timeoutMs,
        operationName
    ) {
        return new Promise(
            (_, reject) => {
                const timer =
                    globalObject.setTimeout(
                        () => {
                            const error =
                                new Error(
                                    `${operationName} timed out after ${timeoutMs} ms.`
                                );

                            error.code =
                                'RAIN_ARRIVAL_TIMEOUT';

                            reject(error);
                        },
                        timeoutMs
                    );

                if (
                    timer &&
                    typeof timer.unref ===
                    'function'
                ) {
                    timer.unref();
                }
            }
        );
    }

    /**
     * Execute an asynchronous operation with timeout protection.
     *
     * @param {Function} operation
     * @param {number} timeoutMs
     * @param {string} operationName
     * @returns {Promise<*>}
     */
    async function withTimeout(
        operation,
        timeoutMs,
        operationName
    ) {
        if (
            typeof operation !==
            'function'
        ) {
            throw new TypeError(
                'withTimeout requires an operation function.'
            );
        }

        return Promise.race([
            Promise.resolve().then(
                operation
            ),

            createTimeoutPromise(
                timeoutMs,
                operationName
            )
        ]);
    }

    /**
     * Dispatch an integration event.
     *
     * @param {string} eventName
     * @param {Object} detail
     * @returns {boolean}
     */
    function dispatchIntegrationEvent(
        eventName,
        detail = {}
    ) {
        const configuration =
            getConfiguration();

        if (
            !configuration
                .dispatchDomEvents
        ) {
            return false;
        }

        if (
            typeof globalObject
                .dispatchEvent !==
            'function'
        ) {
            return false;
        }

        if (
            typeof globalObject
                .CustomEvent !==
            'function'
        ) {
            return false;
        }

        if (
            typeof eventName !==
            'string' ||
            !eventName.trim()
        ) {
            return false;
        }

        try {
            const event =
                new globalObject.CustomEvent(
                    eventName,
                    {
                        detail: {
                            ...detail,

                            module:
                                MODULE_NAME,

                            version:
                                VERSION,

                            timestamp:
                                Date.now(),

                            timestampIso:
                                nowIso()
                        }
                    }
                );

            globalObject.dispatchEvent(
                event
            );

            return true;
        } catch (error) {
            log(
                'debug',
                'Failed to dispatch integration event.',
                normalizeError(
                    error,
                    {
                        eventName
                    }
                )
            );

            return false;
        }
    }

    /**
     * Store the latest runtime error.
     *
     * @param {*} error
     * @param {Object} context
     * @returns {Object}
     */
    function setLastError(
        error,
        context = {}
    ) {
        const normalizedError =
            normalizeError(
                error,
                context
            );

        runtimeState.lastError =
            normalizedError;

        return normalizedError;
    }

    /**
     * Clear the latest runtime error.
     */
    function clearLastError() {
        runtimeState.lastError =
            null;
    }

    /**
     * Initial module metadata.
     */
    const MODULE_METADATA = Object.freeze({
        product:
            PRODUCT_NAME,

        module:
            MODULE_NAME,

        version:
            VERSION,

        semanticVersion:
            SEMANTIC_VERSION,

        file:
            'frontend/js/rain_arrival_integration_v32.js',

        currentPart:
            '2.1A-1',

        nextPart:
            '2.1A-2',

        status:
            'in_progress',

        productionReady:
            false,

        moduleClosed:
            false,

        createdAt:
            nowIso()
    });

    /*
     * END OF PART 2.1A-1
     *
     * Paste Part 2.1A-2 directly below this line.
     * Do not add the IIFE closing line yet.
     */

     /**
     * Discover the Rain Arrival Prediction Engine constructor.
     *
     * Search order:
     * 1. RainGuard AI V32 namespace paths
     * 2. Global constructor names
     *
     * @param {Object} options
     * @returns {{
     *     constructor: Function|null,
     *     source: string|null
     * }}
     */
    function findEngineConstructor(
        options = {}
    ) {
        const configuration =
            resolveConfiguration(
                options
            );

        for (
            const path
            of configuration
                .engineNamespacePaths
        ) {
            const candidate =
                getByPath(path);

            if (
                typeof candidate ===
                'function'
            ) {
                return {
                    constructor:
                        candidate,

                    source:
                        path
                };
            }
        }

        for (
            const globalName
            of configuration
                .engineGlobalNames
        ) {
            const candidate =
                globalObject[
                    globalName
                ];

            if (
                typeof candidate ===
                'function'
            ) {
                return {
                    constructor:
                        candidate,

                    source:
                        globalName
                };
            }
        }

        return {
            constructor: null,
            source: null
        };
    }

    /**
     * Detect a dependency using multiple possible paths.
     *
     * @param {string[]} paths
     * @returns {{
     *     value: *,
     *     source: string|null
     * }}
     */
    function detectDependency(
        paths
    ) {
        if (!Array.isArray(paths)) {
            return {
                value: null,
                source: null
            };
        }

        for (const path of paths) {
            const candidate =
                getByPath(path);

            if (
                candidate !==
                undefined &&
                candidate !==
                null
            ) {
                return {
                    value:
                        candidate,

                    source:
                        path
                };
            }
        }

        return {
            value: null,
            source: null
        };
    }

    /**
     * Discover V30 dependencies.
     *
     * @returns {Object}
     */
    function discoverV30Dependencies() {
        const configuration =
            getConfiguration();

        if (
            !configuration
                .enableV30Compatibility
        ) {
            runtimeState.dependencies.v30 =
                {};

            return {};
        }

        const dependencyDefinitions = {
            orchestrator: [
                'RainGuardAI.V30.orchestrator',
                'RainGuardAI.V30.Orchestrator',
                'v30Orchestrator',
                'V30Orchestrator'
            ],

            sourceAdapter: [
                'RainGuardAI.V30.SourceAdapter',
                'RainGuardAI.V30.sourceAdapter',
                'sourceAdapterV30',
                'SourceAdapterV30'
            ],

            verificationEngine: [
                'RainGuardAI.V30.VerificationEngine',
                'RainGuardAI.V30.verificationEngine',
                'verificationEngineV30',
                'VerificationEngineV30'
            ],

            anwaaAdapter: [
                'RainGuardAI.V30.AnwaaAdapter',
                'RainGuardAI.V30.anwaaAdapter',
                'anwaaAdapterV30',
                'AnwaaAdapterV30'
            ],

            openMeteoAdapter: [
                'RainGuardAI.V30.OpenMeteoAdapter',
                'RainGuardAI.V30.openMeteoAdapter',
                'openMeteoAdapterV30',
                'OpenMeteoAdapterV30'
            ],

            rainViewerAdapter: [
                'RainGuardAI.V30.RainViewerAdapter',
                'RainGuardAI.V30.rainViewerAdapter',
                'rainViewerAdapterV30',
                'RainViewerAdapterV30'
            ],

            aiBrain: [
                'RainGuardAI.V30.AIBrain',
                'RainGuardAI.V30.aiBrain',
                'aiBrainV30',
                'AIBrainV30',
                'aiBrainV23'
            ]
        };

        const discovered = {};

        for (
            const [
                dependencyName,
                paths
            ]
            of Object.entries(
                dependencyDefinitions
            )
        ) {
            const result =
                detectDependency(
                    paths
                );

            discovered[
                dependencyName
            ] = {
                available:
                    Boolean(
                        result.value
                    ),

                value:
                    result.value,

                source:
                    result.source
            };
        }

        runtimeState
            .dependencies
            .v30 =
            discovered;

        return discovered;
    }

    /**
     * Discover V31 dependencies.
     *
     * @returns {Object}
     */
    function discoverV31Dependencies() {
        const configuration =
            getConfiguration();

        if (
            !configuration
                .enableV31Compatibility
        ) {
            runtimeState.dependencies.v31 =
                {};

            return {};
        }

        const dependencyDefinitions = {
            stormCellTracking: [
                'RainGuardAI.V31.StormCellTrackingEngine',
                'RainGuardAI.V31.stormCellTrackingEngine',
                'stormCellTrackingEngineV31',
                'StormCellTrackingEngineV31'
            ],

            stormPathPrediction: [
                'RainGuardAI.V31.StormPathPredictionEngine',
                'RainGuardAI.V31.stormPathPredictionEngine',
                'stormPathPredictionEngineV31',
                'StormPathPredictionEngineV31'
            ],

            lightningAdapter: [
                'RainGuardAI.V31.LightningAdapter',
                'RainGuardAI.V31.lightningAdapter',
                'lightningAdapterV31',
                'LightningAdapterV31'
            ],

            localAIAdapter: [
                'RainGuardAI.V31.LocalAIAdapter',
                'RainGuardAI.V31.localAIAdapter',
                'localAIAdapterV31',
                'LocalAIAdapterV31'
            ],

            dynamicSourceWeighting: [
                'RainGuardAI.V31.DynamicSourceWeighting',
                'RainGuardAI.V31.dynamicSourceWeighting',
                'dynamicSourceWeightingV31',
                'DynamicSourceWeightingV31'
            ],

            adaptiveLearning: [
                'RainGuardAI.V31.AdaptiveLearningEngine',
                'RainGuardAI.V31.adaptiveLearningEngine',
                'adaptiveLearningEngineV31',
                'AdaptiveLearningEngineV31'
            ],

            dataQualityIndex: [
                'RainGuardAI.V31.DataQualityIndex',
                'RainGuardAI.V31.dataQualityIndex',
                'dataQualityIndexV31',
                'DataQualityIndexV31'
            ]
        };

        const discovered = {};

        for (
            const [
                dependencyName,
                paths
            ]
            of Object.entries(
                dependencyDefinitions
            )
        ) {
            const result =
                detectDependency(
                    paths
                );

            discovered[
                dependencyName
            ] = {
                available:
                    Boolean(
                        result.value
                    ),

                value:
                    result.value,

                source:
                    result.source
            };
        }

        runtimeState
            .dependencies
            .v31 =
            discovered;

        return discovered;
    }

    /**
     * Discover native V32 dependencies.
     *
     * @returns {Object}
     */
    function discoverV32Dependencies() {
        const engineDiscovery =
            findEngineConstructor();

        const discovered = {
            engineConstructor: {
                available:
                    Boolean(
                        engineDiscovery
                            .constructor
                    ),

                value:
                    engineDiscovery
                        .constructor,

                source:
                    engineDiscovery
                        .source
            },

            engineInstance: {
                available:
                    Boolean(
                        runtimeState.engine
                    ),

                value:
                    runtimeState.engine,

                source:
                    runtimeState
                        .engineSource
            }
        };

        runtimeState
            .dependencies
            .v32 =
            discovered;

        return discovered;
    }

    /**
     * Discover all supported dependencies.
     *
     * @returns {{
     *     v30: Object,
     *     v31: Object,
     *     v32: Object
     * }}
     */
    function discoverDependencies() {
        const dependencies = {
            v30:
                discoverV30Dependencies(),

            v31:
                discoverV31Dependencies(),

            v32:
                discoverV32Dependencies()
        };

        log(
            'debug',
            'Dependencies discovered.',
            dependencies
        );

        return dependencies;
    }

    /**
     * Create the V32 prediction engine singleton.
     *
     * @param {Object} options
     * @returns {Object}
     */
    function createEngineInstance(
        options = {}
    ) {
        if (runtimeState.engine) {
            return runtimeState.engine;
        }

        const discovery =
            findEngineConstructor(
                options
            );

        if (
            !discovery.constructor
        ) {
            const error =
                new Error(
                    'RainArrivalPredictionEngineV32 was not found. Load rain_arrival_prediction_engine_v32.js before rain_arrival_integration_v32.js.'
                );

            error.code =
                'RAIN_ARRIVAL_ENGINE_NOT_FOUND';

            throw error;
        }

        runtimeState
            .engineConstructor =
            discovery.constructor;

        runtimeState
            .engineSource =
            discovery.source;

        const engineOptions =
            isPlainObject(
                options.engineOptions
            )
                ? options.engineOptions
                : {};

        try {
            runtimeState.engine =
                new discovery.constructor(
                    engineOptions
                );
        } catch (constructorError) {
            const error =
                new Error(
                    'Failed to create Rain Arrival Prediction Engine V32 instance.'
                );

            error.code =
                'RAIN_ARRIVAL_ENGINE_CREATION_FAILED';

            error.cause =
                constructorError;

            throw error;
        }

        runtimeState
            .dependencies
            .v32
            .engineConstructor = {
                available:
                    true,

                value:
                    runtimeState
                        .engineConstructor,

                source:
                    runtimeState
                        .engineSource
            };

        runtimeState
            .dependencies
            .v32
            .engineInstance = {
                available:
                    true,

                value:
                    runtimeState.engine,

                source:
                    runtimeState
                        .engineSource
            };

        log(
            'info',
            'Rain arrival prediction engine instance created.',
            {
                source:
                    runtimeState
                        .engineSource
            }
        );

        return runtimeState.engine;
    }

    /**
     * Return the active engine instance.
     *
     * @returns {Object|null}
     */
    function getEngine() {
        return runtimeState.engine;
    }

    /**
     * Initialize the prediction engine instance.
     *
     * Supports different initialization method names
     * for compatibility with previous engine builds.
     *
     * @param {Object} engine
     * @param {Object} options
     * @returns {Promise<*>}
     */
    async function initializeEngineInstance(
        engine,
        options = {}
    ) {
        if (
            !engine ||
            (
                typeof engine !==
                    'object' &&
                typeof engine !==
                    'function'
            )
        ) {
            throw new TypeError(
                'A valid rain arrival engine instance is required.'
            );
        }

        const initializationMethods = [
            'initializeRainArrivalEngine',
            'initializeEngine',
            'initialize',
            'init'
        ];

        for (
            const methodName
            of initializationMethods
        ) {
            if (
                typeof engine[
                    methodName
                ] !== 'function'
            ) {
                continue;
            }

            const initializationOptions = {
                ...options,

                integrationMode:
                    true,

                enableLegacyCompatibility:
                    true,

                enableV30Compatibility:
                    getConfiguration()
                        .enableV30Compatibility,

                enableV31Compatibility:
                    getConfiguration()
                        .enableV31Compatibility
            };

            const result =
                await engine[
                    methodName
                ](
                    initializationOptions
                );

            return {
                initialized:
                    true,

                method:
                    methodName,

                result
            };
        }

        return {
            initialized:
                true,

            skipped:
                true,

            method:
                null,

            reason:
                'engine_has_no_explicit_initializer'
        };
    }

    /**
     * Register a source provider.
     *
     * The provider may be:
     * - A function
     * - An adapter object
     * - An engine object
     *
     * @param {string} name
     * @param {Function|Object} provider
     * @param {Object} options
     * @returns {Object}
     */
    function registerSource(
        name,
        provider,
        options = {}
    ) {
        if (
            typeof name !==
                'string' ||
            !name.trim()
        ) {
            throw new TypeError(
                'Source name must be a non-empty string.'
            );
        }

        if (
            typeof provider !==
                'function' &&
            (
                provider === null ||
                typeof provider !==
                    'object'
            )
        ) {
            throw new TypeError(
                'Source provider must be a function or object.'
            );
        }

        const normalizedName =
            name.trim();

        const sourceRecord = {
            id:
                createRuntimeId(
                    'source'
                ),

            name:
                normalizedName,

            provider,

            enabled:
                options.enabled !==
                false,

            priority:
                toFiniteNumber(
                    options.priority,
                    0
                ),

            weight:
                clamp(
                    options.weight ??
                        1,
                    0,
                    100
                ),

            confidence:
                clamp(
                    options.confidence ??
                        100,
                    0,
                    100
                ),

            timeoutMs:
                options.timeoutMs ===
                    undefined
                    ? null
                    : Math.max(
                        1000,
                        toFiniteNumber(
                            options.timeoutMs,
                            getConfiguration()
                                .sourceTimeoutMs
                        )
                    ),

            sourceType:
                typeof options
                    .sourceType ===
                'string'
                    ? options
                        .sourceType
                    : 'custom',

            version:
                options.version ??
                null,

            metadata:
                isPlainObject(
                    options.metadata
                )
                    ? {
                        ...options
                            .metadata
                    }
                    : {},

            registeredAt:
                Date.now(),

            registeredAtIso:
                nowIso(),

            lastRequestedAt:
                null,

            lastSucceededAt:
                null,

            lastFailedAt:
                null,

            lastError:
                null
        };

        runtimeState.sources.set(
            normalizedName,
            sourceRecord
        );

        log(
            'debug',
            `Source registered: ${normalizedName}`,
            sourceRecord
        );

        return {
            registered:
                true,

            name:
                normalizedName,

            source:
                sourceRecord
        };
    }

    /**
     * Remove a registered source.
     *
     * @param {string} name
     * @returns {boolean}
     */
    function unregisterSource(
        name
    ) {
        if (
            typeof name !==
            'string'
        ) {
            return false;
        }

        const normalizedName =
            name.trim();

        runtimeState
            .latestSourceData
            .delete(
                normalizedName
            );

        runtimeState
            .sourceAdapters
            .delete(
                normalizedName
            );

        return runtimeState
            .sources
            .delete(
                normalizedName
            );
    }

    /**
     * Register a dedicated source adapter.
     *
     * @param {string} name
     * @param {Object|Function} adapter
     * @param {Object} options
     * @returns {Object}
     */
    function registerSourceAdapter(
        name,
        adapter,
        options = {}
    ) {
        if (
            typeof name !==
                'string' ||
            !name.trim()
        ) {
            throw new TypeError(
                'Source adapter name must be a non-empty string.'
            );
        }

        if (
            typeof adapter !==
                'function' &&
            (
                adapter === null ||
                typeof adapter !==
                    'object'
            )
        ) {
            throw new TypeError(
                'Source adapter must be a function or object.'
            );
        }

        const normalizedName =
            name.trim();

        const adapterRecord = {
            id:
                createRuntimeId(
                    'adapter'
                ),

            name:
                normalizedName,

            adapter,

            enabled:
                options.enabled !==
                false,

            sourceType:
                options.sourceType ||
                normalizedName,

            metadata:
                isPlainObject(
                    options.metadata
                )
                    ? {
                        ...options
                            .metadata
                    }
                    : {},

            registeredAt:
                Date.now()
        };

        runtimeState
            .sourceAdapters
            .set(
                normalizedName,
                adapterRecord
            );

        return {
            registered:
                true,

            name:
                normalizedName,

            adapter:
                adapterRecord
        };
    }

    /**
     * Register a city provider.
     *
     * @param {string} name
     * @param {Function} provider
     * @param {Object} options
     * @returns {Object}
     */
    function registerCityProvider(
        name,
        provider,
        options = {}
    ) {
        if (
            typeof name !==
                'string' ||
            !name.trim()
        ) {
            throw new TypeError(
                'City provider name must be a non-empty string.'
            );
        }

        if (
            typeof provider !==
            'function'
        ) {
            throw new TypeError(
                'City provider must be a function.'
            );
        }

        const normalizedName =
            name.trim();

        const providerRecord = {
            id:
                createRuntimeId(
                    'city_provider'
                ),

            name:
                normalizedName,

            provider,

            enabled:
                options.enabled !==
                false,

            priority:
                toFiniteNumber(
                    options.priority,
                    0
                ),

            metadata:
                isPlainObject(
                    options.metadata
                )
                    ? {
                        ...options
                            .metadata
                    }
                    : {},

            registeredAt:
                Date.now()
        };

        runtimeState
            .cityProviders
            .set(
                normalizedName,
                providerRecord
            );

        return {
            registered:
                true,

            name:
                normalizedName,

            provider:
                providerRecord
        };
    }

    /**
     * Register a prediction result consumer.
     *
     * Consumers may update:
     * - City cards
     * - Map layers
     * - Dashboards
     * - Notifications
     * - External storage
     *
     * @param {string} name
     * @param {Function} consumer
     * @param {Object} options
     * @returns {Object}
     */
    function registerResultConsumer(
        name,
        consumer,
        options = {}
    ) {
        if (
            typeof name !==
                'string' ||
            !name.trim()
        ) {
            throw new TypeError(
                'Result consumer name must be a non-empty string.'
            );
        }

        if (
            typeof consumer !==
            'function'
        ) {
            throw new TypeError(
                'Result consumer must be a function.'
            );
        }

        const normalizedName =
            name.trim();

        const consumerRecord = {
            id:
                createRuntimeId(
                    'consumer'
                ),

            name:
                normalizedName,

            consumer,

            enabled:
                options.enabled !==
                false,

            priority:
                toFiniteNumber(
                    options.priority,
                    0
                ),

            consumerType:
                options.consumerType ||
                'custom',

            metadata:
                isPlainObject(
                    options.metadata
                )
                    ? {
                        ...options
                            .metadata
                    }
                    : {},

            registeredAt:
                Date.now()
        };

        runtimeState
            .resultConsumers
            .set(
                normalizedName,
                consumerRecord
            );

        return {
            registered:
                true,

            name:
                normalizedName,

            consumer:
                consumerRecord
        };
    }

    /**
     * Build a serializable dependency summary.
     *
     * @returns {Object}
     */
    function getDependencySummary() {
        const summary = {
            v30: {},
            v31: {},
            v32: {}
        };

        for (
            const version
            of [
                'v30',
                'v31',
                'v32'
            ]
        ) {
            const dependencies =
                runtimeState
                    .dependencies[
                    version
                ] || {};

            for (
                const [
                    name,
                    record
                ]
                of Object.entries(
                    dependencies
                )
            ) {
                summary[
                    version
                ][name] = {
                    available:
                        Boolean(
                            record &&
                            record.available
                        ),

                    source:
                        record &&
                        record.source
                            ? record.source
                            : null
                };
            }
        }

        return summary;
    }

    /**
     * Return the current integration status.
     *
     * @returns {Object}
     */
    function getStatus() {
        return {
            product:
                PRODUCT_NAME,

            module:
                MODULE_NAME,

            version:
                VERSION,

            semanticVersion:
                SEMANTIC_VERSION,

            initialized:
                runtimeState
                    .initialized,

            initializing:
                runtimeState
                    .initializing,

            running:
                runtimeState
                    .running,

            cycleInProgress:
                runtimeState
                    .cycleInProgress,

            engineAvailable:
                Boolean(
                    runtimeState.engine
                ),

            engineSource:
                runtimeState
                    .engineSource,

            initializedAt:
                runtimeState
                    .initializedAt,

            startedAt:
                runtimeState
                    .startedAt,

            stoppedAt:
                runtimeState
                    .stoppedAt,

            cycleCount:
                runtimeState
                    .cycleCount,

            successfulCycleCount:
                runtimeState
                    .successfulCycleCount,

            failedCycleCount:
                runtimeState
                    .failedCycleCount,

            lastCycleStartedAt:
                runtimeState
                    .lastCycleStartedAt,

            lastCycleCompletedAt:
                runtimeState
                    .lastCycleCompletedAt,

            lastCycleDurationMs:
                runtimeState
                    .lastCycleDurationMs,

            registeredSources:
                runtimeState
                    .sources
                    .size,

            registeredAdapters:
                runtimeState
                    .sourceAdapters
                    .size,

            registeredCityProviders:
                runtimeState
                    .cityProviders
                    .size,

            registeredResultConsumers:
                runtimeState
                    .resultConsumers
                    .size,

            latestPredictionCount:
                runtimeState
                    .latestPredictions
                    .size,

            dependencies:
                getDependencySummary(),

            statistics: {
                ...runtimeState
                    .statistics
            },

            lastError:
                runtimeState
                    .lastError
        };
    }

    /**
     * Initialize the complete integration module.
     *
     * @param {Object} options
     * @returns {Promise<Object>}
     */
    async function initialize(
        options = {}
    ) {
        const configuration =
            resolveConfiguration(
                options
            );

        if (
            runtimeState.initialized &&
            !options.force
        ) {
            return {
                initialized:
                    true,

                reused:
                    true,

                engineSource:
                    runtimeState
                        .engineSource,

                dependencies:
                    getDependencySummary()
            };
        }

        if (
            runtimeState.initializing &&
            runtimeState
                .initializationPromise
        ) {
            return runtimeState
                .initializationPromise;
        }

        runtimeState.initializing =
            true;

        runtimeState
            .initializationError =
            null;

        clearLastError();

        runtimeState
            .initializationPromise =
            withTimeout(
                async () => {
                    const engine =
                        createEngineInstance(
                            options
                        );

                    const engineInitialization =
                        await initializeEngineInstance(
                            engine,
                            options
                        );

                    const dependencies =
                        discoverDependencies();

                    runtimeState.initialized =
                        true;

                    runtimeState.initializing =
                        false;

                    runtimeState.initializedAt =
                        Date.now();

                    const result = {
                        initialized:
                            true,

                        reused:
                            false,

                        engineSource:
                            runtimeState
                                .engineSource,

                        engineInitialization,

                        dependencies:
                            getDependencySummary(),

                        configuration,

                        initializedAt:
                            runtimeState
                                .initializedAt,

                        initializedAtIso:
                            new Date(
                                runtimeState
                                    .initializedAt
                            ).toISOString()
                    };

                    dispatchIntegrationEvent(
                        configuration
                            .eventNames
                            .initialized,
                        result
                    );

                    log(
                        'info',
                        'Rain arrival integration initialized.',
                        {
                            engineSource:
                                runtimeState
                                    .engineSource,

                            dependencies:
                                dependencies
                        }
                    );

                    return result;
                },
                configuration
                    .initializationTimeoutMs,
                'Rain arrival integration initialization'
            ).catch(
                (error) => {
                    runtimeState.initialized =
                        false;

                    runtimeState.initializing =
                        false;

                    runtimeState
                        .initializationError =
                        setLastError(
                            error,
                            {
                                phase:
                                    'initialization'
                            }
                        );

                    log(
                        'error',
                        'Rain arrival integration initialization failed.',
                        runtimeState
                            .initializationError
                    );

                    throw error;
                }
            );

        return runtimeState
            .initializationPromise;
    }

    /**
     * Return module metadata.
     *
     * @returns {Object}
     */
    function getMetadata() {
        return {
            ...MODULE_METADATA,

            currentPart:
                '2.1A-2',

            nextPart:
                '2.1B',

            status:
                'part_complete',

            productionReady:
                false,

            moduleClosed:
                true,

            capabilities: [
                'namespace_bootstrap',
                'configuration_resolution',
                'runtime_state_management',
                'v32_engine_discovery',
                'v30_dependency_discovery',
                'v31_dependency_discovery',
                'singleton_engine_creation',
                'safe_initialization',
                'source_registration',
                'adapter_registration',
                'city_provider_registration',
                'result_consumer_registration',
                'dom_event_dispatch',
                'status_reporting'
            ]
        };
    }

    /**
     * Public integration API.
     *
     * Additional methods will be added in later parts.
     */
    const integrationApi = {
        metadata:
            getMetadata(),

        initialize,

        getEngine,
        getStatus,
        getMetadata,
        getConfiguration,

        findEngineConstructor,
        discoverDependencies,
        discoverV30Dependencies,
        discoverV31Dependencies,
        discoverV32Dependencies,

        registerSource,
        unregisterSource,
        registerSourceAdapter,
        registerCityProvider,
        registerResultConsumer,

        _state:
            runtimeState,

        _internals: {
            isPlainObject,
            isFiniteNumber,
            toFiniteNumber,
            clamp,
            cloneArray,
            deepMerge,
            getByPath,
            createRuntimeId,
            nowIso,
            normalizeError,
            resolveConfiguration,
            isDebugEnabled,
            log,
            createTimeoutPromise,
            withTimeout,
            dispatchIntegrationEvent,
            setLastError,
            clearLastError,
            detectDependency,
            createEngineInstance,
            initializeEngineInstance,
            getDependencySummary
        }
    };

    /**
     * Publish the API inside the RainGuard namespace.
     */
    RainGuardV32[
        INTEGRATION_API_NAME
    ] = integrationApi;

    /**
     * Publish a direct global alias for compatibility.
     */
    globalObject
        .RainArrivalIntegrationV32 =
        integrationApi;

    /**
     * Automatic initialization.
     *
     * Initialization occurs after the DOM becomes ready.
     */
    if (
        getConfiguration()
            .autoInitialize &&
        typeof globalObject
            .document !==
        'undefined'
    ) {
        const autoInitialize =
            function autoInitializeIntegration() {
                integrationApi
                    .initialize()
                    .catch(
                        (error) => {
                            log(
                                'error',
                                'Automatic integration initialization failed.',
                                normalizeError(
                                    error,
                                    {
                                        phase:
                                            'auto_initialization'
                                    }
                                )
                            );
                        }
                    );
            };

        if (
            globalObject
                .document
                .readyState ===
            'loading'
        ) {
            globalObject
                .document
                .addEventListener(
                    'DOMContentLoaded',
                    autoInitialize,
                    {
                        once: true
                    }
                );
        } else {
            globalObject
                .setTimeout(
                    autoInitialize,
                    0
                );
        }
    }

    /*
     * END OF PART 2.1A-2
     *
     * Part 2.1A is now complete.
     *
     * The IIFE is closed below so the file remains executable
     * and can be tested before adding Part 2.1B.
     */
})(
    typeof globalThis !==
        'undefined'
        ? globalThis
        : (
            typeof window !==
                'undefined'
                ? window
                : this
        )
);

/**
 * RainGuard AI V32
 * Rain Arrival Integration Engine
 *
 * Part:
 * 2.1B-1
 *
 * Responsibilities:
 * - Reopen the existing integration API
 * - Detect source adapters automatically
 * - Resolve functions and adapter instances
 * - Register built-in V30 and V31 sources
 * - Prepare source execution descriptors
 */

(function rainArrivalIntegrationV32Sources(globalObject) {
    'use strict';

    if (!globalObject) {
        throw new Error(
            'RainGuard AI V32 requires a valid global object.'
        );
    }

    const RainGuardAI =
        globalObject.RainGuardAI;

    if (
        !RainGuardAI ||
        !RainGuardAI.V32 ||
        !RainGuardAI.V32
            .rainArrivalIntegration
    ) {
        throw new Error(
            'Part 2.1A must be loaded before Part 2.1B.'
        );
    }

    const integrationApi =
        RainGuardAI.V32
            .rainArrivalIntegration;

    const runtimeState =
        integrationApi._state;

    const internal =
        integrationApi._internals;

    if (
        !runtimeState ||
        !internal
    ) {
        throw new Error(
            'Rain arrival integration internal state is unavailable.'
        );
    }

    const {
        isPlainObject,
        toFiniteNumber,
        clamp,
        getByPath,
        createRuntimeId,
        nowIso,
        normalizeError,
        getDependencySummary,
        log
    } = internal;

    /**
     * Candidate source method names.
     *
     * Each adapter may use a different public method.
     * The integration engine resolves the first compatible method.
     */
    const SOURCE_METHOD_CANDIDATES =
        Object.freeze({
            rainViewer: [
                'getRadarData',
                'fetchRadarData',
                'getRainViewerData',
                'fetchRainViewerData',
                'getLatestRadarFrame',
                'fetchLatestRadarFrame',
                'getData',
                'fetchData',
                'execute',
                'run'
            ],

            anwaa: [
                'getWeatherData',
                'fetchWeatherData',
                'getAnwaaData',
                'fetchAnwaaData',
                'getObservation',
                'getObservations',
                'getForecast',
                'getData',
                'fetchData',
                'execute',
                'run'
            ],

            openMeteo: [
                'getWeatherData',
                'fetchWeatherData',
                'getOpenMeteoData',
                'fetchOpenMeteoData',
                'getForecast',
                'fetchForecast',
                'getData',
                'fetchData',
                'execute',
                'run'
            ],

            lightning: [
                'getLightningData',
                'fetchLightningData',
                'getStrikes',
                'fetchStrikes',
                'getRecentStrikes',
                'getData',
                'fetchData',
                'execute',
                'run'
            ],

            localAI: [
                'getPrediction',
                'predict',
                'analyze',
                'evaluate',
                'getLocalAIData',
                'fetchLocalAIData',
                'getData',
                'execute',
                'run'
            ],

            stormCellTracking: [
                'getTrackedCells',
                'getActiveCells',
                'trackStormCells',
                'trackCells',
                'analyzeCells',
                'getStormCells',
                'getData',
                'execute',
                'run'
            ],

            stormPathPrediction: [
                'getPredictedPaths',
                'predictStormPaths',
                'predictPath',
                'getStormPaths',
                'calculatePaths',
                'getData',
                'execute',
                'run'
            ],

            verification: [
                'verify',
                'verifyData',
                'verifySources',
                'evaluate',
                'analyze',
                'getData',
                'execute',
                'run'
            ],

            dynamicSourceWeighting: [
                'getWeights',
                'calculateWeights',
                'computeWeights',
                'updateWeights',
                'evaluateSources',
                'getData',
                'execute',
                'run'
            ],

            adaptiveLearning: [
                'getLearningState',
                'analyze',
                'evaluate',
                'learn',
                'update',
                'getData',
                'execute',
                'run'
            ],

            dataQualityIndex: [
                'calculateDataQuality',
                'calculateQuality',
                'getQualityIndex',
                'evaluate',
                'analyze',
                'getData',
                'execute',
                'run'
            ],

            orchestrator: [
                'getLatestData',
                'collectData',
                'getData',
                'executeCycle',
                'execute',
                'run'
            ]
        });

    /**
     * Built-in source descriptors.
     *
     * These descriptors map discovered dependencies
     * to normalized integration source names.
     */
    const BUILT_IN_SOURCE_DEFINITIONS =
        Object.freeze([
            {
                name:
                    'rainviewer',

                version:
                    'V30',

                dependencyVersion:
                    'v30',

                dependencyName:
                    'rainViewerAdapter',

                sourceType:
                    'radar',

                enabledConfigKey:
                    'enableRainViewerSource',

                priority:
                    100,

                weight:
                    1,

                methodGroup:
                    'rainViewer'
            },

            {
                name:
                    'anwaa',

                version:
                    'V30',

                dependencyVersion:
                    'v30',

                dependencyName:
                    'anwaaAdapter',

                sourceType:
                    'official_weather',

                enabledConfigKey:
                    'enableAnwaaSource',

                priority:
                    95,

                weight:
                    1,

                methodGroup:
                    'anwaa'
            },

            {
                name:
                    'openmeteo',

                version:
                    'V30',

                dependencyVersion:
                    'v30',

                dependencyName:
                    'openMeteoAdapter',

                sourceType:
                    'forecast',

                enabledConfigKey:
                    'enableOpenMeteoSource',

                priority:
                    80,

                weight:
                    0.9,

                methodGroup:
                    'openMeteo'
            },

            {
                name:
                    'lightning',

                version:
                    'V31',

                dependencyVersion:
                    'v31',

                dependencyName:
                    'lightningAdapter',

                sourceType:
                    'lightning',

                enabledConfigKey:
                    'enableLightningSource',

                priority:
                    90,

                weight:
                    1,

                methodGroup:
                    'lightning'
            },

            {
                name:
                    'local_ai',

                version:
                    'V31',

                dependencyVersion:
                    'v31',

                dependencyName:
                    'localAIAdapter',

                sourceType:
                    'local_ai',

                enabledConfigKey:
                    'enableLocalAISource',

                priority:
                    85,

                weight:
                    1,

                methodGroup:
                    'localAI'
            },

            {
                name:
                    'storm_cell_tracking',

                version:
                    'V31',

                dependencyVersion:
                    'v31',

                dependencyName:
                    'stormCellTracking',

                sourceType:
                    'storm_cells',

                enabledConfigKey:
                    'enableStormCellTracking',

                priority:
                    100,

                weight:
                    1,

                methodGroup:
                    'stormCellTracking'
            },

            {
                name:
                    'storm_path_prediction',

                version:
                    'V31',

                dependencyVersion:
                    'v31',

                dependencyName:
                    'stormPathPrediction',

                sourceType:
                    'storm_paths',

                enabledConfigKey:
                    'enableStormPathPrediction',

                priority:
                    100,

                weight:
                    1,

                methodGroup:
                    'stormPathPrediction'
            },

            {
                name:
                    'verification_engine',

                version:
                    'V30',

                dependencyVersion:
                    'v30',

                dependencyName:
                    'verificationEngine',

                sourceType:
                    'verification',

                enabledConfigKey:
                    'enableVerificationEngine',

                priority:
                    75,

                weight:
                    1,

                methodGroup:
                    'verification'
            },

            {
                name:
                    'dynamic_source_weighting',

                version:
                    'V31',

                dependencyVersion:
                    'v31',

                dependencyName:
                    'dynamicSourceWeighting',

                sourceType:
                    'source_weighting',

                enabledConfigKey:
                    'enableDynamicSourceWeighting',

                priority:
                    70,

                weight:
                    1,

                methodGroup:
                    'dynamicSourceWeighting'
            },

            {
                name:
                    'adaptive_learning',

                version:
                    'V31',

                dependencyVersion:
                    'v31',

                dependencyName:
                    'adaptiveLearning',

                sourceType:
                    'adaptive_learning',

                enabledConfigKey:
                    null,

                priority:
                    60,

                weight:
                    1,

                methodGroup:
                    'adaptiveLearning'
            },

            {
                name:
                    'data_quality_index',

                version:
                    'V31',

                dependencyVersion:
                    'v31',

                dependencyName:
                    'dataQualityIndex',

                sourceType:
                    'data_quality',

                enabledConfigKey:
                    null,

                priority:
                    65,

                weight:
                    1,

                methodGroup:
                    'dataQualityIndex'
            },

            {
                name:
                    'v30_orchestrator',

                version:
                    'V30',

                dependencyVersion:
                    'v30',

                dependencyName:
                    'orchestrator',

                sourceType:
                    'orchestrator',

                enabledConfigKey:
                    'enableV30Compatibility',

                priority:
                    50,

                weight:
                    1,

                methodGroup:
                    'orchestrator'
            }
        ]);

    /**
     * Determine whether a source definition is enabled.
     *
     * @param {Object} definition
     * @returns {boolean}
     */
    function isBuiltInSourceEnabled(
        definition
    ) {
        const configuration =
            integrationApi
                .getConfiguration();

        if (
            !definition ||
            typeof definition !==
                'object'
        ) {
            return false;
        }

        if (
            !definition
                .enabledConfigKey
        ) {
            return true;
        }

        return Boolean(
            configuration[
                definition
                    .enabledConfigKey
            ]
        );
    }

    /**
     * Resolve a discovered dependency record.
     *
     * @param {Object} definition
     * @returns {Object|null}
     */
    function resolveDependencyRecord(
        definition
    ) {
        if (
            !definition ||
            !definition
                .dependencyVersion ||
            !definition
                .dependencyName
        ) {
            return null;
        }

        const versionDependencies =
            runtimeState
                .dependencies[
                    definition
                        .dependencyVersion
                ];

        if (
            !versionDependencies ||
            typeof versionDependencies !==
                'object'
        ) {
            return null;
        }

        const dependencyRecord =
            versionDependencies[
                definition
                    .dependencyName
            ];

        if (
            !dependencyRecord ||
            !dependencyRecord.available ||
            !dependencyRecord.value
        ) {
            return null;
        }

        return dependencyRecord;
    }

    /**
     * Determine whether a value is a class constructor.
     *
     * @param {*} value
     * @returns {boolean}
     */
    function isClassConstructor(
        value
    ) {
        if (
            typeof value !==
            'function'
        ) {
            return false;
        }

        const source =
            Function.prototype
                .toString
                .call(value);

        return /^class\s/.test(
            source
        );
    }

    /**
     * Attempt to create an adapter instance.
     *
     * The discovered dependency may already be an instance,
     * a class constructor or a factory function.
     *
     * @param {*} dependency
     * @param {Object} options
     * @returns {*}
     */
    function instantiateDependency(
        dependency,
        options = {}
    ) {
        if (
            dependency === null ||
            dependency === undefined
        ) {
            return null;
        }

        if (
            typeof dependency ===
            'object'
        ) {
            return dependency;
        }

        if (
            typeof dependency !==
            'function'
        ) {
            return dependency;
        }

        if (
            isClassConstructor(
                dependency
            )
        ) {
            try {
                return new dependency(
                    options
                );
            } catch (error) {
                log(
                    'debug',
                    'Dependency class instantiation failed.',
                    normalizeError(
                        error,
                        {
                            dependencyName:
                                dependency.name ||
                                null
                        }
                    )
                );

                return dependency;
            }
        }

        const prototypeMethods =
            dependency.prototype &&
            Object.getOwnPropertyNames(
                dependency.prototype
            ).filter(
                (name) =>
                    name !==
                    'constructor'
            );

        if (
            Array.isArray(
                prototypeMethods
            ) &&
            prototypeMethods.length >
                0
        ) {
            try {
                return new dependency(
                    options
                );
            } catch (error) {
                return dependency;
            }
        }

        return dependency;
    }

    /**
     * Resolve the first callable source method.
     *
     * @param {*} adapter
     * @param {string[]} candidateMethods
     * @returns {{
     *     callable: Function|null,
     *     methodName: string|null,
     *     context: * 
     * }}
     */
    function resolveCallableMethod(
        adapter,
        candidateMethods = []
    ) {
        if (
            typeof adapter ===
            'function'
        ) {
            return {
                callable:
                    adapter,

                methodName:
                    '__call__',

                context:
                    null
            };
        }

        if (
            !adapter ||
            typeof adapter !==
                'object'
        ) {
            return {
                callable:
                    null,

                methodName:
                    null,

                context:
                    null
            };
        }

        for (
            const methodName
            of candidateMethods
        ) {
            if (
                typeof adapter[
                    methodName
                ] ===
                'function'
            ) {
                return {
                    callable:
                        adapter[
                            methodName
                        ],

                    methodName,

                    context:
                        adapter
                };
            }
        }

        return {
            callable:
                null,

            methodName:
                null,

            context:
                adapter
        };
    }

    /**
     * Build a normalized execution wrapper.
     *
     * @param {*} adapter
     * @param {string[]} candidateMethods
     * @param {Object} descriptor
     * @returns {Function}
     */
    function createSourceExecutionWrapper(
        adapter,
        candidateMethods,
        descriptor
    ) {
        return async function executeBuiltInSource(
            requestContext = {}
        ) {
            const resolvedMethod =
                resolveCallableMethod(
                    adapter,
                    candidateMethods
                );

            if (
                !resolvedMethod.callable
            ) {
                const error =
                    new Error(
                        `No compatible source method was found for ${descriptor.name}.`
                    );

                error.code =
                    'RAIN_ARRIVAL_SOURCE_METHOD_NOT_FOUND';

                throw error;
            }

            const sourceRequest = {
                ...requestContext,

                source:
                    descriptor.name,

                sourceType:
                    descriptor
                        .sourceType,

                sourceVersion:
                    descriptor.version,

                integrationVersion:
                    'V32',

                requestedAt:
                    Date.now(),

                requestedAtIso:
                    nowIso()
            };

            return resolvedMethod
                .callable
                .call(
                    resolvedMethod.context,
                    sourceRequest
                );
        };
    }

    /**
     * Build a normalized source descriptor.
     *
     * @param {Object} definition
     * @param {Object} dependencyRecord
     * @returns {Object|null}
     */
    function createBuiltInSourceDescriptor(
        definition,
        dependencyRecord
    ) {
        if (
            !definition ||
            !dependencyRecord ||
            !dependencyRecord.value
        ) {
            return null;
        }

        const adapter =
            instantiateDependency(
                dependencyRecord.value,
                {
                    integrationMode:
                        true,

                    integrationVersion:
                        'V32',

                    sourceName:
                        definition.name
                }
            );

        const candidateMethods =
            SOURCE_METHOD_CANDIDATES[
                definition
                    .methodGroup
            ] || [];

        const callable =
            resolveCallableMethod(
                adapter,
                candidateMethods
            );

        if (
            !callable.callable
        ) {
            return {
                id:
                    createRuntimeId(
                        'builtin_source'
                    ),

                name:
                    definition.name,

                available:
                    false,

                reason:
                    'compatible_method_not_found',

                definition,

                dependencyRecord,

                adapter,

                methodName:
                    null,

                execute:
                    null
            };
        }

        return {
            id:
                createRuntimeId(
                    'builtin_source'
                ),

            name:
                definition.name,

            available:
                true,

            version:
                definition.version,

            sourceType:
                definition
                    .sourceType,

            priority:
                toFiniteNumber(
                    definition.priority,
                    0
                ),

            weight:
                clamp(
                    definition.weight,
                    0,
                    100
                ),

            dependencySource:
                dependencyRecord
                    .source,

            definition,

            dependencyRecord,

            adapter,

            methodName:
                callable.methodName,

            execute:
                createSourceExecutionWrapper(
                    adapter,
                    candidateMethods,
                    definition
                ),

            createdAt:
                Date.now(),

            createdAtIso:
                nowIso()
        };
    }

    /**
     * Register one built-in source.
     *
     * @param {Object} definition
     * @param {Object} options
     * @returns {Object}
     */
    function registerBuiltInSource(
        definition,
        options = {}
    ) {
        if (
            !isBuiltInSourceEnabled(
                definition
            )
        ) {
            return {
                registered:
                    false,

                name:
                    definition
                        .name,

                reason:
                    'disabled_by_configuration'
            };
        }

        const dependencyRecord =
            resolveDependencyRecord(
                definition
            );

        if (!dependencyRecord) {
            return {
                registered:
                    false,

                name:
                    definition
                        .name,

                reason:
                    'dependency_unavailable'
            };
        }

        const descriptor =
            createBuiltInSourceDescriptor(
                definition,
                dependencyRecord
            );

        if (
            !descriptor ||
            !descriptor.available ||
            typeof descriptor
                .execute !==
                'function'
        ) {
            return {
                registered:
                    false,

                name:
                    definition
                        .name,

                reason:
                    descriptor &&
                    descriptor.reason
                        ? descriptor.reason
                        : 'source_descriptor_failed',

                descriptor
            };
        }

        integrationApi
            .registerSourceAdapter(
                definition.name,
                descriptor.adapter,
                {
                    enabled:
                        options.enabled !==
                        false,

                    sourceType:
                        definition
                            .sourceType,

                    metadata: {
                        version:
                            definition
                                .version,

                        dependencySource:
                            dependencyRecord
                                .source,

                        methodName:
                            descriptor
                                .methodName,

                        builtIn:
                            true
                    }
                }
            );

        const registration =
            integrationApi
                .registerSource(
                    definition.name,
                    descriptor.execute,
                    {
                        enabled:
                            options.enabled !==
                            false,

                        priority:
                            definition
                                .priority,

                        weight:
                            definition
                                .weight,

                        confidence:
                            options.confidence ??
                            100,

                        sourceType:
                            definition
                                .sourceType,

                        version:
                            definition
                                .version,

                        timeoutMs:
                            options.timeoutMs,

                        metadata: {
                            builtIn:
                                true,

                            dependencyVersion:
                                definition
                                    .dependencyVersion,

                            dependencyName:
                                definition
                                    .dependencyName,

                            dependencySource:
                                dependencyRecord
                                    .source,

                            methodName:
                                descriptor
                                    .methodName
                        }
                    }
                );

        return {
            registered:
                true,

            name:
                definition.name,

            descriptor,

            registration
        };
    }

    /**
     * Register all built-in sources.
     *
     * @param {Object} options
     * @returns {Object}
     */
    function registerBuiltInSources(
        options = {}
    ) {
        integrationApi
            .discoverDependencies();

        const results = [];

        for (
            const definition
            of BUILT_IN_SOURCE_DEFINITIONS
        ) {
            try {
                results.push(
                    registerBuiltInSource(
                        definition,
                        options[
                            definition.name
                        ] || {}
                    )
                );
            } catch (error) {
                results.push({
                    registered:
                        false,

                    name:
                        definition.name,

                    reason:
                        'registration_error',

                    error:
                        normalizeError(
                            error,
                            {
                                source:
                                    definition.name
                            }
                        )
                });
            }
        }

        const registeredCount =
            results.filter(
                (result) =>
                    result.registered
            ).length;

        const unavailableCount =
            results.length -
            registeredCount;

        const summary = {
            registered:
                registeredCount,

            unavailable:
                unavailableCount,

            total:
                results.length,

            results,

            dependencySummary:
                getDependencySummary(),

            completedAt:
                Date.now(),

            completedAtIso:
                nowIso()
        };

        log(
            'info',
            'Built-in source registration completed.',
            {
                registered:
                    registeredCount,

                unavailable:
                    unavailableCount
            }
        );

        return summary;
    }

    /**
     * Return a serializable built-in source status.
     *
     * @returns {Array<Object>}
     */
    function getBuiltInSourceStatus() {
        return BUILT_IN_SOURCE_DEFINITIONS
            .map(
                (definition) => {
                    const sourceRecord =
                        runtimeState
                            .sources
                            .get(
                                definition.name
                            );

                    const adapterRecord =
                        runtimeState
                            .sourceAdapters
                            .get(
                                definition.name
                            );

                    return {
                        name:
                            definition.name,

                        version:
                            definition.version,

                        sourceType:
                            definition
                                .sourceType,

                        enabled:
                            isBuiltInSourceEnabled(
                                definition
                            ),

                        sourceRegistered:
                            Boolean(
                                sourceRecord
                            ),

                        adapterRegistered:
                            Boolean(
                                adapterRecord
                            ),

                        priority:
                            definition
                                .priority,

                        weight:
                            definition
                                .weight,

                        dependencyVersion:
                            definition
                                .dependencyVersion,

                        dependencyName:
                            definition
                                .dependencyName,

                        dependencyAvailable:
                            Boolean(
                                resolveDependencyRecord(
                                    definition
                                )
                            )
                    };
                }
            );
    }

    /**
     * Refresh built-in source registrations.
     *
     * Existing built-in source records are replaced.
     *
     * @param {Object} options
     * @returns {Object}
     */
    function refreshBuiltInSources(
        options = {}
    ) {
        for (
            const definition
            of BUILT_IN_SOURCE_DEFINITIONS
        ) {
            integrationApi
                .unregisterSource(
                    definition.name
                );

            runtimeState
                .sourceAdapters
                .delete(
                    definition.name
                );
        }

        return registerBuiltInSources(
            options
        );
    }

    /**
     * Extend the public integration API.
     */
    integrationApi
        .registerBuiltInSources =
        registerBuiltInSources;

    integrationApi
        .registerBuiltInSource =
        registerBuiltInSource;

    integrationApi
        .refreshBuiltInSources =
        refreshBuiltInSources;

    integrationApi
        .getBuiltInSourceStatus =
        getBuiltInSourceStatus;

    integrationApi
        .createBuiltInSourceDescriptor =
        createBuiltInSourceDescriptor;

    integrationApi
        .metadata = {
            ...integrationApi
                .metadata,

            currentPart:
                '2.1B-1',

            nextPart:
                '2.1B-2',

            status:
                'in_progress',

            moduleClosed:
                true,

            capabilities: [
                ...(
                    Array.isArray(
                        integrationApi
                            .metadata
                            .capabilities
                    )
                        ? integrationApi
                            .metadata
                            .capabilities
                        : []
                ),

                'automatic_source_detection',
                'adapter_instantiation',
                'source_method_resolution',
                'built_in_source_registration',
                'source_registration_refresh',
                'source_status_reporting'
            ]
        };

    integrationApi
        ._internals
        .SOURCE_METHOD_CANDIDATES =
        SOURCE_METHOD_CANDIDATES;

    integrationApi
        ._internals
        .BUILT_IN_SOURCE_DEFINITIONS =
        BUILT_IN_SOURCE_DEFINITIONS;

    integrationApi
        ._internals
        .isBuiltInSourceEnabled =
        isBuiltInSourceEnabled;

    integrationApi
        ._internals
        .resolveDependencyRecord =
        resolveDependencyRecord;

    integrationApi
        ._internals
        .isClassConstructor =
        isClassConstructor;

    integrationApi
        ._internals
        .instantiateDependency =
        instantiateDependency;

    integrationApi
        ._internals
        .resolveCallableMethod =
        resolveCallableMethod;

    integrationApi
        ._internals
        .createSourceExecutionWrapper =
        createSourceExecutionWrapper;

    log(
        'info',
        'Rain arrival integration Part 2.1B-1 loaded.',
        {
            builtInSources:
                BUILT_IN_SOURCE_DEFINITIONS
                    .length
        }
    );
})(
    typeof globalThis !==
        'undefined'
        ? globalThis
        : (
            typeof window !==
                'undefined'
                ? window
                : this
        )
);

/**
 * RainGuard AI V32
 * Rain Arrival Integration Engine
 *
 * Part:
 * 2.1B-2
 *
 * Responsibilities:
 * - Detect city data from global variables
 * - Detect weather and radar datasets
 * - Detect storm cells and storm paths
 * - Normalize city records
 * - Register automatic city providers
 * - Build a unified runtime data snapshot
 */

(function rainArrivalIntegrationV32DataDiscovery(globalObject) {
    'use strict';

    if (
        !globalObject ||
        !globalObject.RainGuardAI ||
        !globalObject.RainGuardAI.V32 ||
        !globalObject.RainGuardAI.V32
            .rainArrivalIntegration
    ) {
        throw new Error(
            'Rain Arrival Integration Part 2.1B-1 must be loaded before Part 2.1B-2.'
        );
    }

    const integrationApi =
        globalObject
            .RainGuardAI
            .V32
            .rainArrivalIntegration;

    const runtimeState =
        integrationApi._state;

    const internal =
        integrationApi._internals;

    const {
        isPlainObject,
        toFiniteNumber,
        clamp,
        getByPath,
        createRuntimeId,
        nowIso,
        normalizeError,
        log
    } = internal;

    /**
     * Candidate global paths containing city data.
     */
    const CITY_DATA_PATHS =
        Object.freeze([
            'RainGuardAI.cities',
            'RainGuardAI.cityData',
            'RainGuardAI.V30.cities',
            'RainGuardAI.V30.cityData',
            'RainGuardAI.V31.cities',
            'RainGuardAI.V31.cityData',
            'RainGuardAI.V32.cities',
            'RainGuardAI.V32.cityData',

            'RG_CITIES',
            'RAIN_GUARD_CITIES',
            'RAIN_GUARD_CITY_DATA',

            'cities',
            'cityData',
            'weatherCities',
            'monitoredCities',
            'saudiCities',
            'CITY_DATA',
            'CITIES_DATA'
        ]);

    /**
     * Candidate global paths containing weather datasets.
     */
    const WEATHER_DATA_PATHS =
        Object.freeze([
            'RainGuardAI.weatherData',
            'RainGuardAI.latestWeatherData',
            'RainGuardAI.V30.weatherData',
            'RainGuardAI.V30.latestWeatherData',
            'RainGuardAI.V31.weatherData',
            'RainGuardAI.V31.latestWeatherData',
            'RainGuardAI.V32.weatherData',
            'RainGuardAI.V32.latestWeatherData',

            'weatherData',
            'latestWeatherData',
            'currentWeatherData',
            'cityWeatherData',
            'weatherByCity',
            'WEATHER_DATA',
            'LATEST_WEATHER_DATA'
        ]);

    /**
     * Candidate global paths containing radar data.
     */
    const RADAR_DATA_PATHS =
        Object.freeze([
            'RainGuardAI.radarData',
            'RainGuardAI.rainViewerData',
            'RainGuardAI.V30.radarData',
            'RainGuardAI.V30.rainViewerData',
            'RainGuardAI.V31.radarData',
            'RainGuardAI.V32.radarData',

            'radarData',
            'rainViewerData',
            'latestRadarData',
            'radarFrames',
            'RADAR_DATA',
            'RAIN_VIEWER_DATA'
        ]);

    /**
     * Candidate global paths containing storm cells.
     */
    const STORM_CELL_PATHS =
        Object.freeze([
            'RainGuardAI.stormCells',
            'RainGuardAI.activeStormCells',
            'RainGuardAI.V31.stormCells',
            'RainGuardAI.V31.activeStormCells',
            'RainGuardAI.V31.trackedStormCells',
            'RainGuardAI.V32.stormCells',
            'RainGuardAI.V32.activeStormCells',

            'stormCells',
            'activeStormCells',
            'trackedStormCells',
            'latestStormCells',
            'STORM_CELLS',
            'ACTIVE_STORM_CELLS'
        ]);

    /**
     * Candidate global paths containing storm paths.
     */
    const STORM_PATH_PATHS =
        Object.freeze([
            'RainGuardAI.stormPaths',
            'RainGuardAI.predictedStormPaths',
            'RainGuardAI.V31.stormPaths',
            'RainGuardAI.V31.predictedStormPaths',
            'RainGuardAI.V32.stormPaths',
            'RainGuardAI.V32.predictedStormPaths',

            'stormPaths',
            'predictedStormPaths',
            'latestStormPaths',
            'STORM_PATHS',
            'PREDICTED_STORM_PATHS'
        ]);

    /**
     * Candidate global paths containing lightning data.
     */
    const LIGHTNING_DATA_PATHS =
        Object.freeze([
            'RainGuardAI.lightningData',
            'RainGuardAI.V31.lightningData',
            'RainGuardAI.V31.latestLightningData',
            'RainGuardAI.V32.lightningData',

            'lightningData',
            'latestLightningData',
            'lightningStrikes',
            'recentLightningStrikes',
            'LIGHTNING_DATA'
        ]);

    /**
     * Candidate global paths containing flood risk data.
     */
    const FLOOD_DATA_PATHS =
        Object.freeze([
            'RainGuardAI.floodRiskData',
            'RainGuardAI.V30.floodRiskData',
            'RainGuardAI.V31.floodRiskData',
            'RainGuardAI.V32.floodRiskData',

            'floodRiskData',
            'floodData',
            'cityFloodRisk',
            'FLOOD_RISK_DATA'
        ]);

    /**
     * City field aliases.
     */
    const CITY_FIELD_ALIASES =
        Object.freeze({
            id: [
                'id',
                'cityId',
                'city_id',
                'code',
                'slug',
                'key'
            ],

            name: [
                'name',
                'city',
                'cityName',
                'city_name',
                'nameEn',
                'englishName',
                'label'
            ],

            nameAr: [
                'nameAr',
                'name_ar',
                'arabicName',
                'arabic_name',
                'cityNameAr',
                'city_name_ar',
                'labelAr'
            ],

            latitude: [
                'latitude',
                'lat',
                'centerLat',
                'center_lat',
                'y'
            ],

            longitude: [
                'longitude',
                'lon',
                'lng',
                'centerLon',
                'centerLng',
                'center_lon',
                'center_lng',
                'x'
            ],

            region: [
                'region',
                'province',
                'area',
                'administrativeRegion',
                'administrative_region'
            ],

            elevation: [
                'elevation',
                'altitude',
                'height'
            ],

            enabled: [
                'enabled',
                'active',
                'monitored',
                'isActive',
                'is_active'
            ]
        });

    /**
     * Find the first existing property from a list.
     *
     * @param {Object} object
     * @param {string[]} aliases
     * @returns {*}
     */
    function getAliasedValue(
        object,
        aliases
    ) {
        if (
            !object ||
            typeof object !==
                'object' ||
            !Array.isArray(aliases)
        ) {
            return undefined;
        }

        for (const alias of aliases) {
            if (
                Object.prototype
                    .hasOwnProperty
                    .call(
                        object,
                        alias
                    ) &&
                object[alias] !==
                    undefined &&
                object[alias] !==
                    null
            ) {
                return object[alias];
            }
        }

        return undefined;
    }

    /**
     * Normalize text values.
     *
     * @param {*} value
     * @param {string} fallback
     * @returns {string}
     */
    function normalizeText(
        value,
        fallback = ''
    ) {
        if (
            value === undefined ||
            value === null
        ) {
            return fallback;
        }

        const normalized =
            String(value).trim();

        return normalized ||
            fallback;
    }

    /**
     * Generate a stable city ID.
     *
     * @param {Object} city
     * @param {number} index
     * @returns {string}
     */
    function generateCityId(
        city,
        index
    ) {
        const explicitId =
            getAliasedValue(
                city,
                CITY_FIELD_ALIASES.id
            );

        if (
            explicitId !== undefined &&
            explicitId !== null &&
            String(explicitId).trim()
        ) {
            return String(
                explicitId
            ).trim();
        }

        const nameAr =
            normalizeText(
                getAliasedValue(
                    city,
                    CITY_FIELD_ALIASES
                        .nameAr
                )
            );

        const name =
            normalizeText(
                getAliasedValue(
                    city,
                    CITY_FIELD_ALIASES
                        .name
                )
            );

        const sourceName =
            nameAr ||
            name ||
            `city_${index + 1}`;

        return sourceName
            .toLowerCase()
            .replace(
                /\s+/g,
                '_'
            )
            .replace(
                /[^\p{L}\p{N}_-]/gu,
                ''
            ) ||
            `city_${index + 1}`;
    }

    /**
     * Normalize a single city object.
     *
     * @param {*} input
     * @param {number} index
     * @param {Object} context
     * @returns {Object|null}
     */
    function normalizeCity(
        input,
        index = 0,
        context = {}
    ) {
        let city = input;

        if (
            typeof input ===
            'string'
        ) {
            city = {
                name:
                    input
            };
        }

        if (
            !city ||
            typeof city !==
                'object'
        ) {
            return null;
        }

        const latitude =
            toFiniteNumber(
                getAliasedValue(
                    city,
                    CITY_FIELD_ALIASES
                        .latitude
                ),
                NaN
            );

        const longitude =
            toFiniteNumber(
                getAliasedValue(
                    city,
                    CITY_FIELD_ALIASES
                        .longitude
                ),
                NaN
            );

        const name =
            normalizeText(
                getAliasedValue(
                    city,
                    CITY_FIELD_ALIASES
                        .name
                )
            );

        const nameAr =
            normalizeText(
                getAliasedValue(
                    city,
                    CITY_FIELD_ALIASES
                        .nameAr
                ),
                name
            );

        const cityId =
            generateCityId(
                city,
                index
            );

        const enabledValue =
            getAliasedValue(
                city,
                CITY_FIELD_ALIASES
                    .enabled
            );

        const normalized = {
            id:
                cityId,

            name:
                name ||
                nameAr ||
                cityId,

            nameAr:
                nameAr ||
                name ||
                cityId,

            latitude:
                Number.isFinite(
                    latitude
                )
                    ? latitude
                    : null,

            longitude:
                Number.isFinite(
                    longitude
                )
                    ? longitude
                    : null,

            region:
                normalizeText(
                    getAliasedValue(
                        city,
                        CITY_FIELD_ALIASES
                            .region
                    ),
                    null
                ),

            elevation:
                Number.isFinite(
                    toFiniteNumber(
                        getAliasedValue(
                            city,
                            CITY_FIELD_ALIASES
                                .elevation
                        ),
                        NaN
                    )
                )
                    ? toFiniteNumber(
                        getAliasedValue(
                            city,
                            CITY_FIELD_ALIASES
                                .elevation
                        ),
                        null
                    )
                    : null,

            enabled:
                enabledValue ===
                    undefined
                    ? true
                    : Boolean(
                        enabledValue
                    ),

            hasCoordinates:
                Number.isFinite(
                    latitude
                ) &&
                Number.isFinite(
                    longitude
                ),

            source:
                context.source ||
                'unknown',

            sourcePath:
                context.sourcePath ||
                null,

            index,

            metadata: {
                original:
                    city
            }
        };

        return normalized;
    }

    /**
     * Convert various city collection shapes into an array.
     *
     * @param {*} value
     * @returns {Array}
     */
    function cityCollectionToArray(
        value
    ) {
        if (Array.isArray(value)) {
            return value;
        }

        if (
            value instanceof Map
        ) {
            return Array.from(
                value.values()
            );
        }

        if (
            isPlainObject(value)
        ) {
            if (
                Array.isArray(
                    value.cities
                )
            ) {
                return value.cities;
            }

            if (
                Array.isArray(
                    value.data
                )
            ) {
                return value.data;
            }

            return Object.entries(
                value
            ).map(
                ([key, record]) => {
                    if (
                        isPlainObject(
                            record
                        )
                    ) {
                        return {
                            id:
                                record.id ||
                                key,

                            ...record
                        };
                    }

                    return {
                        id:
                            key,

                        name:
                            key,

                        value:
                            record
                    };
                }
            );
        }

        return [];
    }

    /**
     * Normalize a city collection.
     *
     * @param {*} value
     * @param {Object} context
     * @returns {Array<Object>}
     */
    function normalizeCityCollection(
        value,
        context = {}
    ) {
        const collection =
            cityCollectionToArray(
                value
            );

        const maximumCities =
            integrationApi
                .getConfiguration()
                .maximumCitiesPerCycle;

        return collection
            .slice(
                0,
                maximumCities
            )
            .map(
                (city, index) =>
                    normalizeCity(
                        city,
                        index,
                        context
                    )
            )
            .filter(Boolean);
    }

    /**
     * Detect the first available value from candidate paths.
     *
     * @param {string[]} paths
     * @returns {{
     *     found: boolean,
     *     value: *,
     *     path: string|null
     * }}
     */
    function detectGlobalDataset(
        paths
    ) {
        if (!Array.isArray(paths)) {
            return {
                found:
                    false,

                value:
                    null,

                path:
                    null
            };
        }

        for (const path of paths) {
            const value =
                getByPath(path);

            if (
                value !== undefined &&
                value !== null
            ) {
                return {
                    found:
                        true,

                    value,

                    path
                };
            }
        }

        return {
            found:
                false,

            value:
                null,

            path:
                null
        };
    }

    /**
     * Detect all available datasets from candidate paths.
     *
     * @param {string[]} paths
     * @returns {Array<Object>}
     */
    function detectAllGlobalDatasets(
        paths
    ) {
        const results = [];

        if (!Array.isArray(paths)) {
            return results;
        }

        for (const path of paths) {
            const value =
                getByPath(path);

            if (
                value === undefined ||
                value === null
            ) {
                continue;
            }

            results.push({
                path,

                value,

                detectedAt:
                    Date.now(),

                detectedAtIso:
                    nowIso()
            });
        }

        return results;
    }

    /**
     * Merge duplicate cities.
     *
     * @param {Array<Object>} cities
     * @returns {Array<Object>}
     */
    function mergeDuplicateCities(
        cities
    ) {
        const merged =
            new Map();

        for (const city of cities) {
            if (!city) {
                continue;
            }

            const key =
                city.id ||
                city.nameAr ||
                city.name;

            if (!merged.has(key)) {
                merged.set(
                    key,
                    city
                );

                continue;
            }

            const existing =
                merged.get(key);

            merged.set(
                key,
                {
                    ...existing,
                    ...city,

                    latitude:
                        city.latitude ??
                        existing.latitude,

                    longitude:
                        city.longitude ??
                        existing.longitude,

                    region:
                        city.region ??
                        existing.region,

                    elevation:
                        city.elevation ??
                        existing.elevation,

                    hasCoordinates:
                        Boolean(
                            city.hasCoordinates ||
                            existing
                                .hasCoordinates
                        ),

                    metadata: {
                        ...existing
                            .metadata,

                        ...city
                            .metadata,

                        merged:
                            true
                    }
                }
            );
        }

        return Array.from(
            merged.values()
        );
    }

    /**
     * Discover city data from all available globals.
     *
     * @returns {Object}
     */
    function discoverGlobalCities() {
        const datasets =
            detectAllGlobalDatasets(
                CITY_DATA_PATHS
            );

        const allCities = [];

        for (const dataset of datasets) {
            const normalizedCities =
                normalizeCityCollection(
                    dataset.value,
                    {
                        source:
                            'global',

                        sourcePath:
                            dataset.path
                    }
                );

            allCities.push(
                ...normalizedCities
            );
        }

        const mergedCities =
            mergeDuplicateCities(
                allCities
            );

        return {
            found:
                mergedCities.length >
                0,

            cities:
                mergedCities,

            count:
                mergedCities.length,

            datasets:
                datasets.map(
                    (dataset) => ({
                        path:
                            dataset.path,

                        type:
                            Array.isArray(
                                dataset.value
                            )
                                ? 'array'
                                : typeof dataset
                                    .value
                    })
                ),

            discoveredAt:
                Date.now(),

            discoveredAtIso:
                nowIso()
        };
    }

    /**
     * Register a global city provider.
     *
     * @param {Object} options
     * @returns {Object}
     */
    function registerGlobalCityProvider(
        options = {}
    ) {
        const providerName =
            options.name ||
            'global_city_provider';

        return integrationApi
            .registerCityProvider(
                providerName,
                async function globalCityProvider() {
                    const discovery =
                        discoverGlobalCities();

                    return {
                        cities:
                            discovery.cities,

                        count:
                            discovery.count,

                        datasets:
                            discovery
                                .datasets,

                        provider:
                            providerName,

                        timestamp:
                            Date.now(),

                        timestampIso:
                            nowIso()
                    };
                },
                {
                    enabled:
                        options.enabled !==
                        false,

                    priority:
                        options.priority ??
                        100,

                    metadata: {
                        builtIn:
                            true,

                        source:
                            'global_variables'
                    }
                }
            );
    }

    /**
     * Extract a city array from a provider result.
     *
     * @param {*} result
     * @param {Object} context
     * @returns {Array<Object>}
     */
    function extractCitiesFromProviderResult(
        result,
        context = {}
    ) {
        if (
            result === undefined ||
            result === null
        ) {
            return [];
        }

        let candidate =
            result;

        if (
            isPlainObject(result)
        ) {
            candidate =
                result.cities ??
                result.cityData ??
                result.data ??
                result.results ??
                result.items ??
                result;
        }

        return normalizeCityCollection(
            candidate,
            context
        );
    }

    /**
     * Execute all registered city providers.
     *
     * @param {Object} requestContext
     * @returns {Promise<Object>}
     */
    async function collectCities(
        requestContext = {}
    ) {
        const providers =
            Array.from(
                runtimeState
                    .cityProviders
                    .values()
            )
                .filter(
                    (provider) =>
                        provider &&
                        provider.enabled &&
                        typeof provider
                            .provider ===
                            'function'
                )
                .sort(
                    (left, right) =>
                        right.priority -
                        left.priority
                );

        const results = [];
        const allCities = [];

        for (const provider of providers) {
            try {
                const value =
                    await Promise.resolve(
                        provider.provider({
                            ...requestContext,

                            provider:
                                provider.name,

                            requestedAt:
                                Date.now(),

                            requestedAtIso:
                                nowIso()
                        })
                    );

                const cities =
                    extractCitiesFromProviderResult(
                        value,
                        {
                            source:
                                'city_provider',

                            sourcePath:
                                provider.name
                        }
                    );

                results.push({
                    provider:
                        provider.name,

                    success:
                        true,

                    count:
                        cities.length
                });

                allCities.push(
                    ...cities
                );
            } catch (error) {
                results.push({
                    provider:
                        provider.name,

                    success:
                        false,

                    count:
                        0,

                    error:
                        normalizeError(
                            error,
                            {
                                provider:
                                    provider.name
                            }
                        )
                });
            }
        }

        if (allCities.length === 0) {
            const globalDiscovery =
                discoverGlobalCities();

            allCities.push(
                ...globalDiscovery.cities
            );

            results.push({
                provider:
                    'global_fallback',

                success:
                    true,

                count:
                    globalDiscovery
                        .count
            });
        }

        const mergedCities =
            mergeDuplicateCities(
                allCities
            )
                .filter(
                    (city) =>
                        city.enabled !==
                        false
                )
                .slice(
                    0,
                    integrationApi
                        .getConfiguration()
                        .maximumCitiesPerCycle
                );

        return {
            cities:
                mergedCities,

            count:
                mergedCities.length,

            providerResults:
                results,

            collectedAt:
                Date.now(),

            collectedAtIso:
                nowIso()
        };
    }

    /**
     * Create a summary describing any dataset.
     *
     * @param {*} value
     * @returns {Object}
     */
    function summarizeDataset(
        value
    ) {
        if (Array.isArray(value)) {
            return {
                type:
                    'array',

                count:
                    value.length
            };
        }

        if (
            value instanceof Map
        ) {
            return {
                type:
                    'map',

                count:
                    value.size
            };
        }

        if (
            isPlainObject(value)
        ) {
            return {
                type:
                    'object',

                count:
                    Object.keys(
                        value
                    ).length
            };
        }

        return {
            type:
                typeof value,

            count:
                value ===
                    undefined ||
                value ===
                    null
                    ? 0
                    : 1
        };
    }

    /**
     * Discover all platform datasets.
     *
     * @returns {Object}
     */
    function discoverPlatformDatasets() {
        const weather =
            detectGlobalDataset(
                WEATHER_DATA_PATHS
            );

        const radar =
            detectGlobalDataset(
                RADAR_DATA_PATHS
            );

        const stormCells =
            detectGlobalDataset(
                STORM_CELL_PATHS
            );

        const stormPaths =
            detectGlobalDataset(
                STORM_PATH_PATHS
            );

        const lightning =
            detectGlobalDataset(
                LIGHTNING_DATA_PATHS
            );

        const flood =
            detectGlobalDataset(
                FLOOD_DATA_PATHS
            );

        return {
            weather: {
                ...weather,

                summary:
                    summarizeDataset(
                        weather.value
                    )
            },

            radar: {
                ...radar,

                summary:
                    summarizeDataset(
                        radar.value
                    )
            },

            stormCells: {
                ...stormCells,

                summary:
                    summarizeDataset(
                        stormCells.value
                    )
            },

            stormPaths: {
                ...stormPaths,

                summary:
                    summarizeDataset(
                        stormPaths.value
                    )
            },

            lightning: {
                ...lightning,

                summary:
                    summarizeDataset(
                        lightning.value
                    )
            },

            flood: {
                ...flood,

                summary:
                    summarizeDataset(
                        flood.value
                    )
            },

            detectedAt:
                Date.now(),

            detectedAtIso:
                nowIso()
        };
    }

    /**
     * Convert any collection to an array.
     *
     * @param {*} value
     * @returns {Array}
     */
    function toCollectionArray(
        value
    ) {
        if (Array.isArray(value)) {
            return value.slice();
        }

        if (
            value instanceof Map
        ) {
            return Array.from(
                value.values()
            );
        }

        if (
            isPlainObject(value)
        ) {
            if (
                Array.isArray(
                    value.data
                )
            ) {
                return value.data
                    .slice();
            }

            if (
                Array.isArray(
                    value.items
                )
            ) {
                return value.items
                    .slice();
            }

            if (
                Array.isArray(
                    value.results
                )
            ) {
                return value.results
                    .slice();
            }

            if (
                Array.isArray(
                    value.cells
                )
            ) {
                return value.cells
                    .slice();
            }

            if (
                Array.isArray(
                    value.paths
                )
            ) {
                return value.paths
                    .slice();
            }

            return Object.values(
                value
            );
        }

        return [];
    }

    /**
     * Build a unified platform snapshot.
     *
     * @param {Object} requestContext
     * @returns {Promise<Object>}
     */
    async function buildPlatformSnapshot(
        requestContext = {}
    ) {
        const cityCollection =
            await collectCities(
                requestContext
            );

        const datasets =
            discoverPlatformDatasets();

        const maximumStormCells =
            integrationApi
                .getConfiguration()
                .maximumStormCellsPerCycle;

        const stormCells =
            toCollectionArray(
                datasets
                    .stormCells
                    .value
            ).slice(
                0,
                maximumStormCells
            );

        const stormPaths =
            toCollectionArray(
                datasets
                    .stormPaths
                    .value
            ).slice(
                0,
                maximumStormCells
            );

        const lightning =
            toCollectionArray(
                datasets
                    .lightning
                    .value
            );

        const snapshot = {
            id:
                createRuntimeId(
                    'platform_snapshot'
                ),

            cities:
                cityCollection.cities,

            cityCount:
                cityCollection.count,

            weatherData:
                datasets
                    .weather
                    .value,

            radarData:
                datasets
                    .radar
                    .value,

            stormCells,

            stormCellCount:
                stormCells.length,

            stormPaths,

            stormPathCount:
                stormPaths.length,

            lightningData:
                datasets
                    .lightning
                    .value,

            lightningCount:
                lightning.length,

            floodRiskData:
                datasets
                    .flood
                    .value,

            datasetSources: {
                weather:
                    datasets
                        .weather
                        .path,

                radar:
                    datasets
                        .radar
                        .path,

                stormCells:
                    datasets
                        .stormCells
                        .path,

                stormPaths:
                    datasets
                        .stormPaths
                        .path,

                lightning:
                    datasets
                        .lightning
                        .path,

                flood:
                    datasets
                        .flood
                        .path
            },

            providerResults:
                cityCollection
                    .providerResults,

            requestContext: {
                cycleId:
                    requestContext
                        .cycleId ||
                    null,

                reason:
                    requestContext
                        .reason ||
                    null
            },

            createdAt:
                Date.now(),

            createdAtIso:
                nowIso()
        };

        runtimeState
            .latestPlatformSnapshot =
            snapshot;

        return snapshot;
    }

    /**
     * Return the latest platform snapshot.
     *
     * @returns {Object|null}
     */
    function getLatestPlatformSnapshot() {
        return runtimeState
            .latestPlatformSnapshot ||
            null;
    }

    /**
     * Automatically register default providers.
     *
     * @param {Object} options
     * @returns {Object}
     */
    function registerAutomaticProviders(
        options = {}
    ) {
        const registrations = [];

        if (
            !runtimeState
                .cityProviders
                .has(
                    'global_city_provider'
                )
        ) {
            try {
                registrations.push(
                    registerGlobalCityProvider(
                        options
                            .globalCityProvider ||
                        {}
                    )
                );
            } catch (error) {
                registrations.push({
                    registered:
                        false,

                    name:
                        'global_city_provider',

                    error:
                        normalizeError(
                            error,
                            {
                                phase:
                                    'automatic_provider_registration'
                            }
                        )
                });
            }
        }

        return {
            registered:
                registrations.filter(
                    (result) =>
                        result.registered
                ).length,

            total:
                registrations.length,

            registrations,

            completedAt:
                Date.now(),

            completedAtIso:
                nowIso()
        };
    }

    /**
     * Return data discovery status.
     *
     * @returns {Object}
     */
    function getDataDiscoveryStatus() {
        const cityDiscovery =
            discoverGlobalCities();

        const platformDatasets =
            discoverPlatformDatasets();

        return {
            cities: {
                found:
                    cityDiscovery.found,

                count:
                    cityDiscovery.count,

                datasets:
                    cityDiscovery.datasets
            },

            datasets: {
                weather:
                    platformDatasets
                        .weather
                        .summary,

                radar:
                    platformDatasets
                        .radar
                        .summary,

                stormCells:
                    platformDatasets
                        .stormCells
                        .summary,

                stormPaths:
                    platformDatasets
                        .stormPaths
                        .summary,

                lightning:
                    platformDatasets
                        .lightning
                        .summary,

                flood:
                    platformDatasets
                        .flood
                        .summary
            },

            paths: {
                weather:
                    platformDatasets
                        .weather
                        .path,

                radar:
                    platformDatasets
                        .radar
                        .path,

                stormCells:
                    platformDatasets
                        .stormCells
                        .path,

                stormPaths:
                    platformDatasets
                        .stormPaths
                        .path,

                lightning:
                    platformDatasets
                        .lightning
                        .path,

                flood:
                    platformDatasets
                        .flood
                        .path
            },

            registeredCityProviders:
                runtimeState
                    .cityProviders
                    .size,

            latestSnapshotAvailable:
                Boolean(
                    runtimeState
                        .latestPlatformSnapshot
                ),

            checkedAt:
                Date.now(),

            checkedAtIso:
                nowIso()
        };
    }

    /**
     * Extend runtime state.
     */
    if (
        !Object.prototype
            .hasOwnProperty
            .call(
                runtimeState,
                'latestPlatformSnapshot'
            )
    ) {
        runtimeState
            .latestPlatformSnapshot =
            null;
    }

    /**
     * Extend the public API.
     */
    integrationApi
        .discoverGlobalCities =
        discoverGlobalCities;

    integrationApi
        .registerGlobalCityProvider =
        registerGlobalCityProvider;

    integrationApi
        .registerAutomaticProviders =
        registerAutomaticProviders;

    integrationApi
        .collectCities =
        collectCities;

    integrationApi
        .discoverPlatformDatasets =
        discoverPlatformDatasets;

    integrationApi
        .buildPlatformSnapshot =
        buildPlatformSnapshot;

    integrationApi
        .getLatestPlatformSnapshot =
        getLatestPlatformSnapshot;

    integrationApi
        .getDataDiscoveryStatus =
        getDataDiscoveryStatus;

    integrationApi
        .metadata = {
            ...integrationApi
                .metadata,

            currentPart:
                '2.1B-2',

            nextPart:
                '2.1C-1',

            status:
                'part_complete',

            productionReady:
                false,

            moduleClosed:
                true,

            capabilities: [
                ...new Set([
                    ...(
                        Array.isArray(
                            integrationApi
                                .metadata
                                .capabilities
                        )
                            ? integrationApi
                                .metadata
                                .capabilities
                            : []
                    ),

                    'global_city_detection',
                    'city_normalization',
                    'duplicate_city_merging',
                    'automatic_city_providers',
                    'weather_dataset_detection',
                    'radar_dataset_detection',
                    'storm_cell_detection',
                    'storm_path_detection',
                    'lightning_dataset_detection',
                    'flood_dataset_detection',
                    'platform_snapshot_creation'
                ])
            ]
        };

    /**
     * Extend internal API.
     */
    Object.assign(
        integrationApi._internals,
        {
            CITY_DATA_PATHS,
            WEATHER_DATA_PATHS,
            RADAR_DATA_PATHS,
            STORM_CELL_PATHS,
            STORM_PATH_PATHS,
            LIGHTNING_DATA_PATHS,
            FLOOD_DATA_PATHS,
            CITY_FIELD_ALIASES,

            getAliasedValue,
            normalizeText,
            generateCityId,
            normalizeCity,
            cityCollectionToArray,
            normalizeCityCollection,
            detectGlobalDataset,
            detectAllGlobalDatasets,
            mergeDuplicateCities,
            extractCitiesFromProviderResult,
            summarizeDataset,
            toCollectionArray
        }
    );

    /**
     * Register automatic providers immediately.
     */
    try {
        registerAutomaticProviders();
    } catch (error) {
        log(
            'debug',
            'Automatic provider registration failed.',
            normalizeError(
                error,
                {
                    part:
                        '2.1B-2'
                }
            )
        );
    }

    log(
        'info',
        'Rain arrival integration Part 2.1B-2 loaded.',
        {
            cityProviders:
                runtimeState
                    .cityProviders
                    .size
        }
    );
})(
    typeof globalThis !==
        'undefined'
        ? globalThis
        : (
            typeof window !==
                'undefined'
                ? window
                : this
        )
);

/**
 * RainGuard AI V32
 * Rain Arrival Integration Engine
 *
 * Part:
 * 2.1C-1
 *
 * Responsibilities:
 * - Execute registered sources safely
 * - Apply timeout protection
 * - Normalize source responses
 * - Track source health and statistics
 * - Collect all active sources
 * - Build a unified source collection result
 */

(function rainArrivalIntegrationV32SourceCollection(globalObject) {
    'use strict';

    if (
        !globalObject ||
        !globalObject.RainGuardAI ||
        !globalObject.RainGuardAI.V32 ||
        !globalObject.RainGuardAI.V32
            .rainArrivalIntegration
    ) {
        throw new Error(
            'Rain Arrival Integration Part 2.1B-2 must be loaded before Part 2.1C-1.'
        );
    }

    const integrationApi =
        globalObject
            .RainGuardAI
            .V32
            .rainArrivalIntegration;

    const runtimeState =
        integrationApi._state;

    const internal =
        integrationApi._internals;

    const {
        isPlainObject,
        toFiniteNumber,
        clamp,
        createRuntimeId,
        nowIso,
        normalizeError,
        withTimeout,
        dispatchIntegrationEvent,
        log
    } = internal;

    /**
     * Source response field aliases.
     */
    const SOURCE_RESPONSE_ALIASES =
        Object.freeze({
            data: [
                'data',
                'result',
                'results',
                'payload',
                'response',
                'value',
                'items'
            ],

            confidence: [
                'confidence',
                'confidenceScore',
                'confidence_score',
                'quality',
                'qualityScore',
                'reliability',
                'score'
            ],

            timestamp: [
                'timestamp',
                'time',
                'createdAt',
                'created_at',
                'updatedAt',
                'updated_at',
                'observedAt',
                'observed_at'
            ],

            success: [
                'success',
                'ok',
                'valid',
                'available'
            ],

            error: [
                'error',
                'message',
                'errorMessage',
                'error_message'
            ]
        });

    /**
     * Read the first available aliased property.
     *
     * @param {Object} object
     * @param {string[]} aliases
     * @returns {*}
     */
    function getFirstAliasedProperty(
        object,
        aliases
    ) {
        if (
            !object ||
            typeof object !==
                'object' ||
            !Array.isArray(aliases)
        ) {
            return undefined;
        }

        for (const alias of aliases) {
            if (
                Object.prototype
                    .hasOwnProperty
                    .call(
                        object,
                        alias
                    ) &&
                object[alias] !==
                    undefined
            ) {
                return object[alias];
            }
        }

        return undefined;
    }

    /**
     * Convert a timestamp-like value to milliseconds.
     *
     * @param {*} value
     * @param {number} fallback
     * @returns {number}
     */
    function normalizeTimestamp(
        value,
        fallback = Date.now()
    ) {
        if (
            typeof value ===
                'number' &&
            Number.isFinite(value)
        ) {
            if (value < 100000000000) {
                return value * 1000;
            }

            return value;
        }

        if (
            typeof value ===
                'string' &&
            value.trim()
        ) {
            const numericValue =
                Number(value);

            if (
                Number.isFinite(
                    numericValue
                )
            ) {
                return normalizeTimestamp(
                    numericValue,
                    fallback
                );
            }

            const parsed =
                Date.parse(value);

            if (
                Number.isFinite(
                    parsed
                )
            ) {
                return parsed;
            }
        }

        if (value instanceof Date) {
            const timestamp =
                value.getTime();

            return Number.isFinite(
                timestamp
            )
                ? timestamp
                : fallback;
        }

        return fallback;
    }

    /**
     * Determine whether a source response represents success.
     *
     * @param {*} response
     * @returns {boolean}
     */
    function resolveResponseSuccess(
        response
    ) {
        if (
            response === undefined ||
            response === null
        ) {
            return false;
        }

        if (
            typeof response !==
            'object'
        ) {
            return true;
        }

        const explicitSuccess =
            getFirstAliasedProperty(
                response,
                SOURCE_RESPONSE_ALIASES
                    .success
            );

        if (
            explicitSuccess !==
            undefined
        ) {
            return Boolean(
                explicitSuccess
            );
        }

        const explicitError =
            getFirstAliasedProperty(
                response,
                SOURCE_RESPONSE_ALIASES
                    .error
            );

        if (
            response.error &&
            response.error !==
                false &&
            response.error !==
                null
        ) {
            return false;
        }

        if (
            response.status &&
            typeof response.status ===
                'string'
        ) {
            const normalizedStatus =
                response.status
                    .trim()
                    .toLowerCase();

            if (
                [
                    'error',
                    'failed',
                    'failure',
                    'unavailable',
                    'invalid'
                ].includes(
                    normalizedStatus
                )
            ) {
                return false;
            }

            if (
                [
                    'success',
                    'ok',
                    'completed',
                    'ready',
                    'available'
                ].includes(
                    normalizedStatus
                )
            ) {
                return true;
            }
        }

        if (
            explicitError &&
            typeof explicitError ===
                'string' &&
            explicitError.trim()
        ) {
            return false;
        }

        return true;
    }

    /**
     * Extract the main data payload.
     *
     * @param {*} response
     * @returns {*}
     */
    function extractSourcePayload(
        response
    ) {
        if (
            response === undefined ||
            response === null
        ) {
            return null;
        }

        if (
            !isPlainObject(response)
        ) {
            return response;
        }

        const payload =
            getFirstAliasedProperty(
                response,
                SOURCE_RESPONSE_ALIASES
                    .data
            );

        return payload !== undefined
            ? payload
            : response;
    }

    /**
     * Estimate response item count.
     *
     * @param {*} payload
     * @returns {number}
     */
    function getPayloadCount(
        payload
    ) {
        if (
            payload === undefined ||
            payload === null
        ) {
            return 0;
        }

        if (Array.isArray(payload)) {
            return payload.length;
        }

        if (payload instanceof Map) {
            return payload.size;
        }

        if (payload instanceof Set) {
            return payload.size;
        }

        if (isPlainObject(payload)) {
            if (
                Array.isArray(
                    payload.items
                )
            ) {
                return payload.items.length;
            }

            if (
                Array.isArray(
                    payload.data
                )
            ) {
                return payload.data.length;
            }

            if (
                Array.isArray(
                    payload.results
                )
            ) {
                return payload
                    .results
                    .length;
            }

            if (
                Array.isArray(
                    payload.cells
                )
            ) {
                return payload.cells.length;
            }

            if (
                Array.isArray(
                    payload.features
                )
            ) {
                return payload
                    .features
                    .length;
            }

            return Object.keys(
                payload
            ).length;
        }

        return 1;
    }

    /**
     * Resolve source confidence.
     *
     * @param {*} response
     * @param {Object} sourceRecord
     * @returns {number}
     */
    function resolveSourceConfidence(
        response,
        sourceRecord
    ) {
        const defaultConfidence =
            clamp(
                sourceRecord &&
                sourceRecord.confidence !==
                    undefined
                    ? sourceRecord
                        .confidence
                    : 100,
                0,
                100
            );

        if (
            !response ||
            typeof response !==
                'object'
        ) {
            return defaultConfidence;
        }

        const value =
            getFirstAliasedProperty(
                response,
                SOURCE_RESPONSE_ALIASES
                    .confidence
            );

        if (
            value === undefined ||
            value === null
        ) {
            return defaultConfidence;
        }

        let confidence =
            toFiniteNumber(
                value,
                defaultConfidence
            );

        if (
            confidence >= 0 &&
            confidence <= 1
        ) {
            confidence *= 100;
        }

        return clamp(
            confidence,
            0,
            100
        );
    }

    /**
     * Normalize source response metadata.
     *
     * @param {*} response
     * @returns {Object}
     */
    function extractSourceMetadata(
        response
    ) {
        if (
            !response ||
            typeof response !==
                'object'
        ) {
            return {};
        }

        const metadata =
            response.metadata ??
            response.meta ??
            response.details ??
            {};

        return isPlainObject(metadata)
            ? {
                ...metadata
            }
            : {};
    }

    /**
     * Normalize a source response.
     *
     * @param {Object} sourceRecord
     * @param {*} response
     * @param {Object} context
     * @returns {Object}
     */
    function normalizeSourceResult(
        sourceRecord,
        response,
        context = {}
    ) {
        const completedAt =
            Date.now();

        const sourceTimestamp =
            response &&
            typeof response ===
                'object'
                ? getFirstAliasedProperty(
                    response,
                    SOURCE_RESPONSE_ALIASES
                        .timestamp
                )
                : null;

        const payload =
            extractSourcePayload(
                response
            );

        const confidence =
            resolveSourceConfidence(
                response,
                sourceRecord
            );

        const success =
            resolveResponseSuccess(
                response
            );

        return {
            id:
                createRuntimeId(
                    'source_result'
                ),

            source:
                sourceRecord.name,

            sourceType:
                sourceRecord
                    .sourceType ||
                'unknown',

            version:
                sourceRecord.version ||
                null,

            success,

            available:
                success &&
                payload !==
                    null &&
                payload !==
                    undefined,

            payload,

            itemCount:
                getPayloadCount(
                    payload
                ),

            confidence,

            weight:
                clamp(
                    sourceRecord.weight ??
                    1,
                    0,
                    100
                ),

            priority:
                toFiniteNumber(
                    sourceRecord.priority,
                    0
                ),

            sourceTimestamp:
                normalizeTimestamp(
                    sourceTimestamp,
                    completedAt
                ),

            sourceTimestampIso:
                new Date(
                    normalizeTimestamp(
                        sourceTimestamp,
                        completedAt
                    )
                ).toISOString(),

            requestedAt:
                context.requestedAt ||
                null,

            completedAt,

            completedAtIso:
                new Date(
                    completedAt
                ).toISOString(),

            durationMs:
                Math.max(
                    0,
                    completedAt -
                    (
                        context
                            .requestedAt ||
                        completedAt
                    )
                ),

            cycleId:
                context.cycleId ||
                null,

            requestId:
                context.requestId ||
                null,

            metadata: {
                ...extractSourceMetadata(
                    response
                ),

                registeredMetadata:
                    sourceRecord.metadata ||
                    {}
            },

            rawResponse:
                response
        };
    }

    /**
     * Build a normalized failed source result.
     *
     * @param {Object} sourceRecord
     * @param {*} error
     * @param {Object} context
     * @returns {Object}
     */
    function createFailedSourceResult(
        sourceRecord,
        error,
        context = {}
    ) {
        const completedAt =
            Date.now();

        const normalizedError =
            normalizeError(
                error,
                {
                    source:
                        sourceRecord.name,

                    cycleId:
                        context.cycleId ||
                        null,

                    requestId:
                        context.requestId ||
                        null
                }
            );

        return {
            id:
                createRuntimeId(
                    'source_failure'
                ),

            source:
                sourceRecord.name,

            sourceType:
                sourceRecord
                    .sourceType ||
                'unknown',

            version:
                sourceRecord.version ||
                null,

            success:
                false,

            available:
                false,

            payload:
                null,

            itemCount:
                0,

            confidence:
                0,

            weight:
                clamp(
                    sourceRecord.weight ??
                    1,
                    0,
                    100
                ),

            priority:
                toFiniteNumber(
                    sourceRecord.priority,
                    0
                ),

            requestedAt:
                context.requestedAt ||
                null,

            completedAt,

            completedAtIso:
                new Date(
                    completedAt
                ).toISOString(),

            durationMs:
                Math.max(
                    0,
                    completedAt -
                    (
                        context
                            .requestedAt ||
                        completedAt
                    )
                ),

            cycleId:
                context.cycleId ||
                null,

            requestId:
                context.requestId ||
                null,

            error:
                normalizedError,

            metadata: {
                registeredMetadata:
                    sourceRecord.metadata ||
                    {}
            }
        };
    }

    /**
     * Resolve a source execution function.
     *
     * @param {Object} sourceRecord
     * @returns {Function|null}
     */
    function resolveSourceExecutor(
        sourceRecord
    ) {
        if (!sourceRecord) {
            return null;
        }

        const provider =
            sourceRecord.provider;

        if (
            typeof provider ===
            'function'
        ) {
            return provider;
        }

        if (
            !provider ||
            typeof provider !==
                'object'
        ) {
            return null;
        }

        const methodNames = [
            'collect',
            'fetch',
            'getData',
            'execute',
            'run',
            'load',
            'refresh',
            'predict',
            'analyze'
        ];

        for (
            const methodName
            of methodNames
        ) {
            if (
                typeof provider[
                    methodName
                ] ===
                'function'
            ) {
                return provider[
                    methodName
                ].bind(
                    provider
                );
            }
        }

        return null;
    }

    /**
     * Update source health fields after success.
     *
     * @param {Object} sourceRecord
     * @param {Object} normalizedResult
     */
    function markSourceSuccess(
        sourceRecord,
        normalizedResult
    ) {
        sourceRecord
            .lastSucceededAt =
            normalizedResult
                .completedAt;

        sourceRecord
            .lastFailedAt =
            sourceRecord
                .lastFailedAt ||
            null;

        sourceRecord.lastError =
            null;

        sourceRecord
            .lastDurationMs =
            normalizedResult
                .durationMs;

        sourceRecord
            .lastConfidence =
            normalizedResult
                .confidence;

        sourceRecord
            .lastItemCount =
            normalizedResult
                .itemCount;

        sourceRecord
            .successCount =
            (
                sourceRecord
                    .successCount ||
                0
            ) + 1;

        sourceRecord
            .consecutiveFailures =
            0;
    }

    /**
     * Update source health fields after failure.
     *
     * @param {Object} sourceRecord
     * @param {Object} failedResult
     */
    function markSourceFailure(
        sourceRecord,
        failedResult
    ) {
        sourceRecord
            .lastFailedAt =
            failedResult
                .completedAt;

        sourceRecord.lastError =
            failedResult.error;

        sourceRecord
            .lastDurationMs =
            failedResult
                .durationMs;

        sourceRecord
            .failureCount =
            (
                sourceRecord
                    .failureCount ||
                0
            ) + 1;

        sourceRecord
            .consecutiveFailures =
            (
                sourceRecord
                    .consecutiveFailures ||
                0
            ) + 1;
    }

    /**
     * Execute one registered source.
     *
     * @param {string|Object} source
     * @param {Object} requestContext
     * @returns {Promise<Object>}
     */
    async function executeSource(
        source,
        requestContext = {}
    ) {
        let sourceRecord =
            source;

        if (
            typeof source ===
            'string'
        ) {
            sourceRecord =
                runtimeState
                    .sources
                    .get(
                        source
                    );
        }

        if (!sourceRecord) {
            const error =
                new Error(
                    `Registered source was not found: ${String(source)}`
                );

            error.code =
                'RAIN_ARRIVAL_SOURCE_NOT_FOUND';

            throw error;
        }

        if (
            sourceRecord.enabled ===
            false
        ) {
            return {
                id:
                    createRuntimeId(
                        'source_skipped'
                    ),

                source:
                    sourceRecord.name,

                sourceType:
                    sourceRecord
                        .sourceType ||
                    'unknown',

                success:
                    false,

                available:
                    false,

                skipped:
                    true,

                reason:
                    'source_disabled',

                payload:
                    null,

                itemCount:
                    0,

                confidence:
                    0,

                completedAt:
                    Date.now(),

                completedAtIso:
                    nowIso()
            };
        }

        const executor =
            resolveSourceExecutor(
                sourceRecord
            );

        if (!executor) {
            const error =
                new Error(
                    `Source executor was not found for ${sourceRecord.name}.`
                );

            error.code =
                'RAIN_ARRIVAL_SOURCE_EXECUTOR_NOT_FOUND';

            throw error;
        }

        const requestId =
            createRuntimeId(
                'source_request'
            );

        const requestedAt =
            Date.now();

        const configuration =
            integrationApi
                .getConfiguration();

        const timeoutMs =
            Math.max(
                1000,
                toFiniteNumber(
                    sourceRecord
                        .timeoutMs,
                    configuration
                        .sourceTimeoutMs
                )
            );

        sourceRecord
            .lastRequestedAt =
            requestedAt;

        sourceRecord
            .requestCount =
            (
                sourceRecord
                    .requestCount ||
                0
            ) + 1;

        runtimeState
            .statistics
            .sourceRequests += 1;

        const executionContext = {
            ...requestContext,

            source:
                sourceRecord.name,

            sourceType:
                sourceRecord
                    .sourceType,

            requestId,

            requestedAt,

            requestedAtIso:
                new Date(
                    requestedAt
                ).toISOString(),

            timeoutMs,

            integrationVersion:
                'V32',

            platformSnapshot:
                requestContext
                    .platformSnapshot ||
                runtimeState
                    .latestPlatformSnapshot ||
                null
        };

        try {
            const response =
                await withTimeout(
                    () =>
                        executor(
                            executionContext
                        ),
                    timeoutMs,
                    `Source ${sourceRecord.name}`
                );

            const normalizedResult =
                normalizeSourceResult(
                    sourceRecord,
                    response,
                    executionContext
                );

            if (
                normalizedResult
                    .confidence <
                configuration
                    .minimumSourceConfidence
            ) {
                normalizedResult
                    .accepted =
                    false;

                normalizedResult
                    .rejectionReason =
                    'confidence_below_minimum';
            } else {
                normalizedResult
                    .accepted =
                    normalizedResult
                        .success;
            }

            runtimeState
                .latestSourceData
                .set(
                    sourceRecord.name,
                    normalizedResult
                );

            if (
                normalizedResult
                    .success
            ) {
                markSourceSuccess(
                    sourceRecord,
                    normalizedResult
                );

                runtimeState
                    .statistics
                    .sourceSuccesses +=
                    1;
            } else {
                const error =
                    new Error(
                        `Source ${sourceRecord.name} returned an unsuccessful response.`
                    );

                error.code =
                    'RAIN_ARRIVAL_SOURCE_UNSUCCESSFUL_RESPONSE';

                const failedResult =
                    createFailedSourceResult(
                        sourceRecord,
                        error,
                        executionContext
                    );

                failedResult
                    .rawResponse =
                    response;

                runtimeState
                    .latestSourceData
                    .set(
                        sourceRecord.name,
                        failedResult
                    );

                markSourceFailure(
                    sourceRecord,
                    failedResult
                );

                runtimeState
                    .statistics
                    .sourceFailures +=
                    1;

                return failedResult;
            }

            dispatchIntegrationEvent(
                configuration
                    .eventNames
                    .sourceUpdated,
                {
                    source:
                        sourceRecord.name,

                    sourceType:
                        sourceRecord
                            .sourceType,

                    success:
                        true,

                    confidence:
                        normalizedResult
                            .confidence,

                    itemCount:
                        normalizedResult
                            .itemCount,

                    durationMs:
                        normalizedResult
                            .durationMs,

                    cycleId:
                        requestContext
                            .cycleId ||
                        null
                }
            );

            return normalizedResult;
        } catch (error) {
            const failedResult =
                createFailedSourceResult(
                    sourceRecord,
                    error,
                    executionContext
                );

            runtimeState
                .latestSourceData
                .set(
                    sourceRecord.name,
                    failedResult
                );

            markSourceFailure(
                sourceRecord,
                failedResult
            );

            runtimeState
                .statistics
                .sourceFailures +=
                1;

            log(
                'debug',
                `Source execution failed: ${sourceRecord.name}`,
                failedResult.error
            );

            dispatchIntegrationEvent(
                configuration
                    .eventNames
                    .sourceUpdated,
                {
                    source:
                        sourceRecord.name,

                    sourceType:
                        sourceRecord
                            .sourceType,

                    success:
                        false,

                    error:
                        failedResult.error,

                    durationMs:
                        failedResult
                            .durationMs,

                    cycleId:
                        requestContext
                            .cycleId ||
                        null
                }
            );

            return failedResult;
        }
    }

    /**
     * Return enabled sources ordered by priority.
     *
     * @param {Object} options
     * @returns {Array<Object>}
     */
    function getExecutableSources(
        options = {}
    ) {
        const includedNames =
            Array.isArray(
                options.include
            )
                ? new Set(
                    options.include
                )
                : null;

        const excludedNames =
            Array.isArray(
                options.exclude
            )
                ? new Set(
                    options.exclude
                )
                : new Set();

        const sourceTypes =
            Array.isArray(
                options.sourceTypes
            )
                ? new Set(
                    options.sourceTypes
                )
                : null;

        return Array.from(
            runtimeState
                .sources
                .values()
        )
            .filter(
                (sourceRecord) => {
                    if (
                        !sourceRecord ||
                        sourceRecord.enabled ===
                            false
                    ) {
                        return false;
                    }

                    if (
                        includedNames &&
                        !includedNames.has(
                            sourceRecord.name
                        )
                    ) {
                        return false;
                    }

                    if (
                        excludedNames.has(
                            sourceRecord.name
                        )
                    ) {
                        return false;
                    }

                    if (
                        sourceTypes &&
                        !sourceTypes.has(
                            sourceRecord
                                .sourceType
                        )
                    ) {
                        return false;
                    }

                    return Boolean(
                        resolveSourceExecutor(
                            sourceRecord
                        )
                    );
                }
            )
            .sort(
                (left, right) => {
                    const priorityDifference =
                        toFiniteNumber(
                            right.priority,
                            0
                        ) -
                        toFiniteNumber(
                            left.priority,
                            0
                        );

                    if (
                        priorityDifference !==
                        0
                    ) {
                        return priorityDifference;
                    }

                    return String(
                        left.name
                    ).localeCompare(
                        String(
                            right.name
                        )
                    );
                }
            );
    }

    /**
     * Execute sources sequentially.
     *
     * @param {Array<Object>} sources
     * @param {Object} requestContext
     * @returns {Promise<Array<Object>>}
     */
    async function executeSourcesSequentially(
        sources,
        requestContext
    ) {
        const results = [];

        for (
            const sourceRecord
            of sources
        ) {
            const result =
                await executeSource(
                    sourceRecord,
                    requestContext
                );

            results.push(
                result
            );
        }

        return results;
    }

    /**
     * Execute sources in parallel.
     *
     * @param {Array<Object>} sources
     * @param {Object} requestContext
     * @returns {Promise<Array<Object>>}
     */
    async function executeSourcesInParallel(
        sources,
        requestContext
    ) {
        return Promise.all(
            sources.map(
                (sourceRecord) =>
                    executeSource(
                        sourceRecord,
                        requestContext
                    )
            )
        );
    }

    /**
     * Build a source collection summary.
     *
     * @param {Array<Object>} results
     * @param {Object} context
     * @returns {Object}
     */
    function summarizeSourceCollection(
        results,
        context = {}
    ) {
        const successfulResults =
            results.filter(
                (result) =>
                    result &&
                    result.success
            );

        const acceptedResults =
            results.filter(
                (result) =>
                    result &&
                    result.accepted
            );

        const failedResults =
            results.filter(
                (result) =>
                    result &&
                    !result.success &&
                    !result.skipped
            );

        const skippedResults =
            results.filter(
                (result) =>
                    result &&
                    result.skipped
            );

        const totalItems =
            successfulResults.reduce(
                (
                    total,
                    result
                ) =>
                    total +
                    toFiniteNumber(
                        result.itemCount,
                        0
                    ),
                0
            );

        const weightedConfidenceParts =
            acceptedResults.map(
                (result) => ({
                    confidence:
                        clamp(
                            result.confidence,
                            0,
                            100
                        ),

                    weight:
                        Math.max(
                            0,
                            toFiniteNumber(
                                result.weight,
                                1
                            )
                        )
                })
            );

        const totalWeight =
            weightedConfidenceParts
                .reduce(
                    (
                        total,
                        item
                    ) =>
                        total +
                        item.weight,
                    0
                );

        const weightedConfidence =
            totalWeight > 0
                ? weightedConfidenceParts
                    .reduce(
                        (
                            total,
                            item
                        ) =>
                            total +
                            (
                                item.confidence *
                                item.weight
                            ),
                        0
                    ) /
                    totalWeight
                : 0;

        return {
            totalSources:
                results.length,

            successfulSources:
                successfulResults
                    .length,

            acceptedSources:
                acceptedResults
                    .length,

            failedSources:
                failedResults.length,

            skippedSources:
                skippedResults.length,

            totalItems,

            weightedConfidence:
                clamp(
                    weightedConfidence,
                    0,
                    100
                ),

            sourceNames:
                results.map(
                    (result) =>
                        result.source
                ),

            successfulSourceNames:
                successfulResults.map(
                    (result) =>
                        result.source
                ),

            failedSourceNames:
                failedResults.map(
                    (result) =>
                        result.source
                ),

            cycleId:
                context.cycleId ||
                null
        };
    }

    /**
     * Convert source results to an object keyed by source name.
     *
     * @param {Array<Object>} results
     * @returns {Object}
     */
    function indexSourceResults(
        results
    ) {
        const indexed = {};

        for (const result of results) {
            if (
                !result ||
                !result.source
            ) {
                continue;
            }

            indexed[
                result.source
            ] = result;
        }

        return indexed;
    }

    /**
     * Collect data from all executable sources.
     *
     * @param {Object} options
     * @returns {Promise<Object>}
     */
    async function collectSources(
        options = {}
    ) {
        const collectionId =
            createRuntimeId(
                'source_collection'
            );

        const startedAt =
            Date.now();

        let platformSnapshot =
            options
                .platformSnapshot ||
            null;

        if (
            !platformSnapshot &&
            typeof integrationApi
                .buildPlatformSnapshot ===
                'function'
        ) {
            try {
                platformSnapshot =
                    await integrationApi
                        .buildPlatformSnapshot({
                            cycleId:
                                options
                                    .cycleId ||
                                null,

                            reason:
                                options.reason ||
                                'source_collection'
                        });
            } catch (error) {
                log(
                    'debug',
                    'Platform snapshot creation failed before source collection.',
                    normalizeError(
                        error,
                        {
                            collectionId
                        }
                    )
                );
            }
        }

        const requestContext = {
            collectionId,

            cycleId:
                options.cycleId ||
                null,

            reason:
                options.reason ||
                'manual',

            cities:
                options.cities ||
                (
                    platformSnapshot &&
                    platformSnapshot
                        .cities
                        ? platformSnapshot
                            .cities
                        : []
                ),

            platformSnapshot,

            forceRefresh:
                Boolean(
                    options.forceRefresh
                ),

            startedAt,

            startedAtIso:
                new Date(
                    startedAt
                ).toISOString()
        };

        const executableSources =
            getExecutableSources(
                options
            );

        const executionMode =
            options.sequential
                ? 'sequential'
                : 'parallel';

        const results =
            executionMode ===
            'sequential'
                ? await executeSourcesSequentially(
                    executableSources,
                    requestContext
                )
                : await executeSourcesInParallel(
                    executableSources,
                    requestContext
                );

        const completedAt =
            Date.now();

        const summary =
            summarizeSourceCollection(
                results,
                requestContext
            );

        const collectionResult = {
            id:
                collectionId,

            success:
                summary
                    .successfulSources >
                0,

            executionMode,

            cycleId:
                requestContext.cycleId,

            reason:
                requestContext.reason,

            results,

            bySource:
                indexSourceResults(
                    results
                ),

            summary,

            platformSnapshot,

            startedAt,

            startedAtIso:
                new Date(
                    startedAt
                ).toISOString(),

            completedAt,

            completedAtIso:
                new Date(
                    completedAt
                ).toISOString(),

            durationMs:
                completedAt -
                startedAt
        };

        runtimeState
            .lastSourceCollection =
            collectionResult;

        runtimeState
            .sourceCollectionCount =
            (
                runtimeState
                    .sourceCollectionCount ||
                0
            ) + 1;

        return collectionResult;
    }

    /**
     * Return the latest result for one source.
     *
     * @param {string} sourceName
     * @returns {Object|null}
     */
    function getLatestSourceResult(
        sourceName
    ) {
        if (
            typeof sourceName !==
                'string'
        ) {
            return null;
        }

        return runtimeState
            .latestSourceData
            .get(
                sourceName.trim()
            ) ||
            null;
    }

    /**
     * Return all latest source results.
     *
     * @returns {Object}
     */
    function getLatestSourceResults() {
        const results = {};

        for (
            const [
                sourceName,
                result
            ]
            of runtimeState
                .latestSourceData
                .entries()
        ) {
            results[
                sourceName
            ] = result;
        }

        return results;
    }

    /**
     * Return source health status.
     *
     * @returns {Array<Object>}
     */
    function getSourceHealth() {
        return Array.from(
            runtimeState
                .sources
                .values()
        )
            .map(
                (sourceRecord) => ({
                    name:
                        sourceRecord.name,

                    sourceType:
                        sourceRecord
                            .sourceType,

                    version:
                        sourceRecord.version,

                    enabled:
                        sourceRecord
                            .enabled !==
                        false,

                    priority:
                        sourceRecord
                            .priority,

                    weight:
                        sourceRecord
                            .weight,

                    confidence:
                        sourceRecord
                            .confidence,

                    requestCount:
                        sourceRecord
                            .requestCount ||
                        0,

                    successCount:
                        sourceRecord
                            .successCount ||
                        0,

                    failureCount:
                        sourceRecord
                            .failureCount ||
                        0,

                    consecutiveFailures:
                        sourceRecord
                            .consecutiveFailures ||
                        0,

                    lastRequestedAt:
                        sourceRecord
                            .lastRequestedAt,

                    lastSucceededAt:
                        sourceRecord
                            .lastSucceededAt,

                    lastFailedAt:
                        sourceRecord
                            .lastFailedAt,

                    lastDurationMs:
                        sourceRecord
                            .lastDurationMs ||
                        null,

                    lastConfidence:
                        sourceRecord
                            .lastConfidence ??
                        null,

                    lastItemCount:
                        sourceRecord
                            .lastItemCount ??
                        null,

                    healthy:
                        (
                            sourceRecord
                                .consecutiveFailures ||
                            0
                        ) < 3,

                    lastError:
                        sourceRecord
                            .lastError ||
                        null
                })
            )
            .sort(
                (left, right) =>
                    toFiniteNumber(
                        right.priority,
                        0
                    ) -
                    toFiniteNumber(
                        left.priority,
                        0
                    )
            );
    }

    /**
     * Extend runtime state.
     */
    if (
        !Object.prototype
            .hasOwnProperty
            .call(
                runtimeState,
                'lastSourceCollection'
            )
    ) {
        runtimeState
            .lastSourceCollection =
            null;
    }

    if (
        !Object.prototype
            .hasOwnProperty
            .call(
                runtimeState,
                'sourceCollectionCount'
            )
    ) {
        runtimeState
            .sourceCollectionCount =
            0;
    }

    /**
     * Extend the public API.
     */
    integrationApi
        .executeSource =
        executeSource;

    integrationApi
        .collectSources =
        collectSources;

    integrationApi
        .getExecutableSources =
        getExecutableSources;

    integrationApi
        .getLatestSourceResult =
        getLatestSourceResult;

    integrationApi
        .getLatestSourceResults =
        getLatestSourceResults;

    integrationApi
        .getSourceHealth =
        getSourceHealth;

    integrationApi
        .metadata = {
            ...integrationApi
                .metadata,

            currentPart:
                '2.1C-1',

            nextPart:
                '2.1C-2',

            status:
                'in_progress',

            productionReady:
                false,

            moduleClosed:
                true,

            capabilities: [
                ...new Set([
                    ...(
                        Array.isArray(
                            integrationApi
                                .metadata
                                .capabilities
                        )
                            ? integrationApi
                                .metadata
                                .capabilities
                            : []
                    ),

                    'safe_source_execution',
                    'source_timeout_protection',
                    'source_response_normalization',
                    'source_confidence_filtering',
                    'parallel_source_collection',
                    'sequential_source_collection',
                    'source_health_tracking',
                    'source_statistics',
                    'latest_source_result_storage'
                ])
            ]
        };

    /**
     * Extend internal API.
     */
    Object.assign(
        integrationApi._internals,
        {
            SOURCE_RESPONSE_ALIASES,
            getFirstAliasedProperty,
            normalizeTimestamp,
            resolveResponseSuccess,
            extractSourcePayload,
            getPayloadCount,
            resolveSourceConfidence,
            extractSourceMetadata,
            normalizeSourceResult,
            createFailedSourceResult,
            resolveSourceExecutor,
            markSourceSuccess,
            markSourceFailure,
            executeSourcesSequentially,
            executeSourcesInParallel,
            summarizeSourceCollection,
            indexSourceResults
        }
    );

    log(
        'info',
        'Rain arrival integration Part 2.1C-1 loaded.',
        {
            registeredSources:
                runtimeState
                    .sources
                    .size
        }
    );
})(
    typeof globalThis !==
        'undefined'
        ? globalThis
        : (
            typeof window !==
                'undefined'
                ? window
                : this
        )
);

/**
 * RainGuard AI V32
 * Rain Arrival Integration Engine
 *
 * Part:
 * 2.1C-2
 *
 * Responsibilities:
 * - Normalize collected source payloads
 * - Extract radar, weather, lightning and storm data
 * - Build unified city weather records
 * - Merge city data from multiple sources
 * - Build prediction-ready unified input
 */

(function rainArrivalIntegrationV32UnifiedData(globalObject) {
    'use strict';

    if (
        !globalObject ||
        !globalObject.RainGuardAI ||
        !globalObject.RainGuardAI.V32 ||
        !globalObject.RainGuardAI.V32
            .rainArrivalIntegration
    ) {
        throw new Error(
            'Rain Arrival Integration Part 2.1C-1 must be loaded before Part 2.1C-2.'
        );
    }

    const integrationApi =
        globalObject
            .RainGuardAI
            .V32
            .rainArrivalIntegration;

    const runtimeState =
        integrationApi._state;

    const internal =
        integrationApi._internals;

    const {
        isPlainObject,
        toFiniteNumber,
        clamp,
        createRuntimeId,
        nowIso,
        normalizeError,
        normalizeTimestamp,
        toCollectionArray,
        normalizeText,
        log
    } = internal;

    /**
     * Weather field aliases.
     */
    const WEATHER_FIELD_ALIASES =
        Object.freeze({
            cityId: [
                'cityId',
                'city_id',
                'id',
                'code',
                'cityCode',
                'city_code'
            ],

            cityName: [
                'city',
                'cityName',
                'city_name',
                'name',
                'location',
                'locationName'
            ],

            cityNameAr: [
                'cityNameAr',
                'city_name_ar',
                'nameAr',
                'name_ar',
                'arabicName'
            ],

            latitude: [
                'latitude',
                'lat',
                'y'
            ],

            longitude: [
                'longitude',
                'lng',
                'lon',
                'x'
            ],

            temperature: [
                'temperature',
                'temperatureC',
                'temperature_c',
                'temp',
                'tempC',
                'currentTemperature'
            ],

            humidity: [
                'humidity',
                'relativeHumidity',
                'relative_humidity',
                'humidityPercent'
            ],

            pressure: [
                'pressure',
                'pressureHpa',
                'pressure_hpa',
                'surfacePressure'
            ],

            windSpeed: [
                'windSpeed',
                'wind_speed',
                'windSpeedKmh',
                'wind_speed_kmh',
                'windspeed'
            ],

            windDirection: [
                'windDirection',
                'wind_direction',
                'windDirectionDeg',
                'wind_direction_deg',
                'windDegree'
            ],

            windGust: [
                'windGust',
                'wind_gust',
                'windGustKmh',
                'gust',
                'gustSpeed'
            ],

            rainNow: [
                'rainNow',
                'rain_now',
                'currentRain',
                'current_rain',
                'precipitation',
                'precipitationNow',
                'rainIntensity',
                'rain_intensity'
            ],

            rain1h: [
                'rain1h',
                'rain_1h',
                'precipitation1h',
                'precipitation_1h',
                'hourlyRain'
            ],

            rain3h: [
                'rain3h',
                'rain_3h',
                'precipitation3h',
                'precipitation_3h'
            ],

            rain6h: [
                'rain6h',
                'rain_6h',
                'precipitation6h',
                'precipitation_6h'
            ],

            rain12h: [
                'rain12h',
                'rain_12h',
                'precipitation12h',
                'precipitation_12h'
            ],

            rain24h: [
                'rain24h',
                'rain_24h',
                'precipitation24h',
                'precipitation_24h',
                'dailyRain'
            ],

            rain72h: [
                'rain72h',
                'rain_72h',
                'precipitation72h',
                'precipitation_72h'
            ],

            rainProbability: [
                'rainProbability',
                'rain_probability',
                'precipitationProbability',
                'precipitation_probability',
                'pop',
                'chanceOfRain'
            ],

            cloudCover: [
                'cloudCover',
                'cloud_cover',
                'clouds',
                'cloudiness'
            ],

            visibility: [
                'visibility',
                'visibilityKm',
                'visibility_km'
            ],

            weatherCode: [
                'weatherCode',
                'weather_code',
                'code',
                'conditionCode'
            ],

            condition: [
                'condition',
                'weatherCondition',
                'weather_condition',
                'description',
                'summary'
            ],

            timestamp: [
                'timestamp',
                'time',
                'observedAt',
                'observed_at',
                'updatedAt',
                'updated_at',
                'date'
            ],

            confidence: [
                'confidence',
                'confidenceScore',
                'confidence_score',
                'quality',
                'reliability'
            ]
        });

    /**
     * Radar field aliases.
     */
    const RADAR_FIELD_ALIASES =
        Object.freeze({
            latitude: [
                'latitude',
                'lat',
                'centerLat',
                'center_lat',
                'y'
            ],

            longitude: [
                'longitude',
                'lng',
                'lon',
                'centerLng',
                'centerLon',
                'x'
            ],

            intensity: [
                'intensity',
                'rainIntensity',
                'rain_intensity',
                'value',
                'reflectivity',
                'dbz',
                'precipitation'
            ],

            velocity: [
                'velocity',
                'speed',
                'movementSpeed',
                'movement_speed'
            ],

            direction: [
                'direction',
                'bearing',
                'movementDirection',
                'movement_direction'
            ],

            radius: [
                'radius',
                'radiusKm',
                'radius_km',
                'size',
                'diameter'
            ],

            timestamp: [
                'timestamp',
                'time',
                'frameTime',
                'frame_time',
                'observedAt'
            ],

            confidence: [
                'confidence',
                'quality',
                'reliability',
                'score'
            ]
        });

    /**
     * Lightning field aliases.
     */
    const LIGHTNING_FIELD_ALIASES =
        Object.freeze({
            latitude: [
                'latitude',
                'lat',
                'y'
            ],

            longitude: [
                'longitude',
                'lng',
                'lon',
                'x'
            ],

            intensity: [
                'intensity',
                'amplitude',
                'power',
                'strength',
                'current'
            ],

            polarity: [
                'polarity',
                'type',
                'strikeType',
                'strike_type'
            ],

            timestamp: [
                'timestamp',
                'time',
                'detectedAt',
                'detected_at',
                'observedAt'
            ],

            distance: [
                'distance',
                'distanceKm',
                'distance_km'
            ]
        });

    /**
     * Storm cell field aliases.
     */
    const STORM_CELL_FIELD_ALIASES =
        Object.freeze({
            id: [
                'id',
                'cellId',
                'cell_id',
                'stormId',
                'storm_id',
                'trackId',
                'track_id'
            ],

            latitude: [
                'latitude',
                'lat',
                'centerLat',
                'center_lat',
                'centroidLat'
            ],

            longitude: [
                'longitude',
                'lng',
                'lon',
                'centerLng',
                'centerLon',
                'centroidLng'
            ],

            intensity: [
                'intensity',
                'strength',
                'severity',
                'rainIntensity',
                'rain_intensity',
                'dbz',
                'reflectivity'
            ],

            speed: [
                'speed',
                'speedKmh',
                'speed_kmh',
                'movementSpeed',
                'movement_speed',
                'velocity'
            ],

            direction: [
                'direction',
                'directionDeg',
                'direction_deg',
                'bearing',
                'movementDirection',
                'movement_direction'
            ],

            radius: [
                'radius',
                'radiusKm',
                'radius_km',
                'size',
                'diameter'
            ],

            area: [
                'area',
                'areaKm2',
                'area_km2'
            ],

            growthRate: [
                'growthRate',
                'growth_rate',
                'intensityChange',
                'intensity_change',
                'trend'
            ],

            risk: [
                'risk',
                'riskLevel',
                'risk_level',
                'severityLevel',
                'severity_level'
            ],

            confidence: [
                'confidence',
                'confidenceScore',
                'confidence_score',
                'quality'
            ],

            timestamp: [
                'timestamp',
                'time',
                'updatedAt',
                'updated_at',
                'observedAt'
            ]
        });

    /**
     * Get the first defined alias value.
     *
     * @param {Object} record
     * @param {string[]} aliases
     * @returns {*}
     */
    function readAlias(
        record,
        aliases
    ) {
        if (
            !record ||
            typeof record !==
                'object' ||
            !Array.isArray(aliases)
        ) {
            return undefined;
        }

        for (const alias of aliases) {
            if (
                Object.prototype
                    .hasOwnProperty
                    .call(
                        record,
                        alias
                    ) &&
                record[alias] !==
                    undefined &&
                record[alias] !==
                    null
            ) {
                return record[alias];
            }
        }

        return undefined;
    }

    /**
     * Normalize percentage values.
     *
     * @param {*} value
     * @param {number|null} fallback
     * @returns {number|null}
     */
    function normalizePercentage(
        value,
        fallback = null
    ) {
        if (
            value === undefined ||
            value === null ||
            value === ''
        ) {
            return fallback;
        }

        let numericValue =
            toFiniteNumber(
                value,
                NaN
            );

        if (
            !Number.isFinite(
                numericValue
            )
        ) {
            return fallback;
        }

        if (
            numericValue >= 0 &&
            numericValue <= 1
        ) {
            numericValue *= 100;
        }

        return clamp(
            numericValue,
            0,
            100
        );
    }

    /**
     * Normalize non-negative numeric values.
     *
     * @param {*} value
     * @param {number|null} fallback
     * @returns {number|null}
     */
    function normalizeNonNegativeNumber(
        value,
        fallback = null
    ) {
        const numericValue =
            toFiniteNumber(
                value,
                NaN
            );

        if (
            !Number.isFinite(
                numericValue
            )
        ) {
            return fallback;
        }

        return Math.max(
            0,
            numericValue
        );
    }

    /**
     * Normalize coordinates.
     *
     * @param {*} latitude
     * @param {*} longitude
     * @returns {{
     *     latitude: number|null,
     *     longitude: number|null,
     *     valid: boolean
     * }}
     */
    function normalizeCoordinates(
        latitude,
        longitude
    ) {
        const normalizedLatitude =
            toFiniteNumber(
                latitude,
                NaN
            );

        const normalizedLongitude =
            toFiniteNumber(
                longitude,
                NaN
            );

        const valid =
            Number.isFinite(
                normalizedLatitude
            ) &&
            Number.isFinite(
                normalizedLongitude
            ) &&
            normalizedLatitude >= -90 &&
            normalizedLatitude <= 90 &&
            normalizedLongitude >= -180 &&
            normalizedLongitude <= 180;

        return {
            latitude:
                valid
                    ? normalizedLatitude
                    : null,

            longitude:
                valid
                    ? normalizedLongitude
                    : null,

            valid
        };
    }

    /**
     * Normalize wind direction to 0–359 degrees.
     *
     * @param {*} value
     * @returns {number|null}
     */
    function normalizeDirection(
        value
    ) {
        const numericValue =
            toFiniteNumber(
                value,
                NaN
            );

        if (
            !Number.isFinite(
                numericValue
            )
        ) {
            return null;
        }

        return (
            (
                numericValue %
                360
            ) +
            360
        ) % 360;
    }

    /**
     * Normalize weather data.
     *
     * @param {*} record
     * @param {Object} context
     * @returns {Object|null}
     */
    function normalizeWeatherRecord(
        record,
        context = {}
    ) {
        if (
            !record ||
            typeof record !==
                'object'
        ) {
            return null;
        }

        const coordinates =
            normalizeCoordinates(
                readAlias(
                    record,
                    WEATHER_FIELD_ALIASES
                        .latitude
                ),
                readAlias(
                    record,
                    WEATHER_FIELD_ALIASES
                        .longitude
                )
            );

        const cityId =
            normalizeText(
                readAlias(
                    record,
                    WEATHER_FIELD_ALIASES
                        .cityId
                ),
                ''
            );

        const cityName =
            normalizeText(
                readAlias(
                    record,
                    WEATHER_FIELD_ALIASES
                        .cityName
                ),
                ''
            );

        const cityNameAr =
            normalizeText(
                readAlias(
                    record,
                    WEATHER_FIELD_ALIASES
                        .cityNameAr
                ),
                cityName
            );

        const timestamp =
            normalizeTimestamp(
                readAlias(
                    record,
                    WEATHER_FIELD_ALIASES
                        .timestamp
                ),
                Date.now()
            );

        return {
            id:
                createRuntimeId(
                    'weather_record'
                ),

            cityId:
                cityId ||
                null,

            cityName:
                cityName ||
                cityNameAr ||
                null,

            cityNameAr:
                cityNameAr ||
                cityName ||
                null,

            latitude:
                coordinates.latitude,

            longitude:
                coordinates.longitude,

            hasCoordinates:
                coordinates.valid,

            temperatureC:
                toFiniteNumber(
                    readAlias(
                        record,
                        WEATHER_FIELD_ALIASES
                            .temperature
                    ),
                    null
                ),

            humidity:
                normalizePercentage(
                    readAlias(
                        record,
                        WEATHER_FIELD_ALIASES
                            .humidity
                    )
                ),

            pressureHpa:
                normalizeNonNegativeNumber(
                    readAlias(
                        record,
                        WEATHER_FIELD_ALIASES
                            .pressure
                    )
                ),

            windSpeedKmh:
                normalizeNonNegativeNumber(
                    readAlias(
                        record,
                        WEATHER_FIELD_ALIASES
                            .windSpeed
                    )
                ),

            windDirectionDeg:
                normalizeDirection(
                    readAlias(
                        record,
                        WEATHER_FIELD_ALIASES
                            .windDirection
                    )
                ),

            windGustKmh:
                normalizeNonNegativeNumber(
                    readAlias(
                        record,
                        WEATHER_FIELD_ALIASES
                            .windGust
                    )
                ),

            rainNow:
                normalizeNonNegativeNumber(
                    readAlias(
                        record,
                        WEATHER_FIELD_ALIASES
                            .rainNow
                    ),
                    0
                ),

            rain1h:
                normalizeNonNegativeNumber(
                    readAlias(
                        record,
                        WEATHER_FIELD_ALIASES
                            .rain1h
                    ),
                    0
                ),

            rain3h:
                normalizeNonNegativeNumber(
                    readAlias(
                        record,
                        WEATHER_FIELD_ALIASES
                            .rain3h
                    ),
                    0
                ),

            rain6h:
                normalizeNonNegativeNumber(
                    readAlias(
                        record,
                        WEATHER_FIELD_ALIASES
                            .rain6h
                    ),
                    0
                ),

            rain12h:
                normalizeNonNegativeNumber(
                    readAlias(
                        record,
                        WEATHER_FIELD_ALIASES
                            .rain12h
                    ),
                    0
                ),

            rain24h:
                normalizeNonNegativeNumber(
                    readAlias(
                        record,
                        WEATHER_FIELD_ALIASES
                            .rain24h
                    ),
                    0
                ),

            rain72h:
                normalizeNonNegativeNumber(
                    readAlias(
                        record,
                        WEATHER_FIELD_ALIASES
                            .rain72h
                    ),
                    0
                ),

            rainProbability:
                normalizePercentage(
                    readAlias(
                        record,
                        WEATHER_FIELD_ALIASES
                            .rainProbability
                    ),
                    0
                ),

            cloudCover:
                normalizePercentage(
                    readAlias(
                        record,
                        WEATHER_FIELD_ALIASES
                            .cloudCover
                    ),
                    0
                ),

            visibilityKm:
                normalizeNonNegativeNumber(
                    readAlias(
                        record,
                        WEATHER_FIELD_ALIASES
                            .visibility
                    )
                ),

            weatherCode:
                readAlias(
                    record,
                    WEATHER_FIELD_ALIASES
                        .weatherCode
                ) ??
                null,

            condition:
                normalizeText(
                    readAlias(
                        record,
                        WEATHER_FIELD_ALIASES
                            .condition
                    ),
                    ''
                ) ||
                null,

            confidence:
                normalizePercentage(
                    readAlias(
                        record,
                        WEATHER_FIELD_ALIASES
                            .confidence
                    ),
                    context.confidence ??
                    100
                ),

            source:
                context.source ||
                'unknown',

            sourceType:
                context.sourceType ||
                'weather',

            timestamp,

            timestampIso:
                new Date(
                    timestamp
                ).toISOString(),

            raw:
                record
        };
    }

    /**
     * Normalize radar point or cell.
     *
     * @param {*} record
     * @param {Object} context
     * @returns {Object|null}
     */
    function normalizeRadarRecord(
        record,
        context = {}
    ) {
        if (
            !record ||
            typeof record !==
                'object'
        ) {
            return null;
        }

        const coordinates =
            normalizeCoordinates(
                readAlias(
                    record,
                    RADAR_FIELD_ALIASES
                        .latitude
                ),
                readAlias(
                    record,
                    RADAR_FIELD_ALIASES
                        .longitude
                )
            );

        if (
            !coordinates.valid
        ) {
            return null;
        }

        const timestamp =
            normalizeTimestamp(
                readAlias(
                    record,
                    RADAR_FIELD_ALIASES
                        .timestamp
                ),
                Date.now()
            );

        return {
            id:
                record.id ||
                record.cellId ||
                createRuntimeId(
                    'radar'
                ),

            latitude:
                coordinates.latitude,

            longitude:
                coordinates.longitude,

            intensity:
                normalizeNonNegativeNumber(
                    readAlias(
                        record,
                        RADAR_FIELD_ALIASES
                            .intensity
                    ),
                    0
                ),

            speedKmh:
                normalizeNonNegativeNumber(
                    readAlias(
                        record,
                        RADAR_FIELD_ALIASES
                            .velocity
                    ),
                    null
                ),

            directionDeg:
                normalizeDirection(
                    readAlias(
                        record,
                        RADAR_FIELD_ALIASES
                            .direction
                    )
                ),

            radiusKm:
                normalizeNonNegativeNumber(
                    readAlias(
                        record,
                        RADAR_FIELD_ALIASES
                            .radius
                    ),
                    null
                ),

            confidence:
                normalizePercentage(
                    readAlias(
                        record,
                        RADAR_FIELD_ALIASES
                            .confidence
                    ),
                    context.confidence ??
                    100
                ),

            source:
                context.source ||
                'radar',

            timestamp,

            timestampIso:
                new Date(
                    timestamp
                ).toISOString(),

            raw:
                record
        };
    }

    /**
     * Normalize lightning strike.
     *
     * @param {*} record
     * @param {Object} context
     * @returns {Object|null}
     */
    function normalizeLightningRecord(
        record,
        context = {}
    ) {
        if (
            !record ||
            typeof record !==
                'object'
        ) {
            return null;
        }

        const coordinates =
            normalizeCoordinates(
                readAlias(
                    record,
                    LIGHTNING_FIELD_ALIASES
                        .latitude
                ),
                readAlias(
                    record,
                    LIGHTNING_FIELD_ALIASES
                        .longitude
                )
            );

        if (
            !coordinates.valid
        ) {
            return null;
        }

        const timestamp =
            normalizeTimestamp(
                readAlias(
                    record,
                    LIGHTNING_FIELD_ALIASES
                        .timestamp
                ),
                Date.now()
            );

        return {
            id:
                record.id ||
                record.strikeId ||
                createRuntimeId(
                    'lightning'
                ),

            latitude:
                coordinates.latitude,

            longitude:
                coordinates.longitude,

            intensity:
                toFiniteNumber(
                    readAlias(
                        record,
                        LIGHTNING_FIELD_ALIASES
                            .intensity
                    ),
                    null
                ),

            polarity:
                normalizeText(
                    readAlias(
                        record,
                        LIGHTNING_FIELD_ALIASES
                            .polarity
                    ),
                    ''
                ) ||
                null,

            distanceKm:
                normalizeNonNegativeNumber(
                    readAlias(
                        record,
                        LIGHTNING_FIELD_ALIASES
                            .distance
                    ),
                    null
                ),

            source:
                context.source ||
                'lightning',

            timestamp,

            timestampIso:
                new Date(
                    timestamp
                ).toISOString(),

            raw:
                record
        };
    }

    /**
     * Normalize storm cell.
     *
     * @param {*} record
     * @param {Object} context
     * @returns {Object|null}
     */
    function normalizeStormCellRecord(
        record,
        context = {}
    ) {
        if (
            !record ||
            typeof record !==
                'object'
        ) {
            return null;
        }

        const coordinates =
            normalizeCoordinates(
                readAlias(
                    record,
                    STORM_CELL_FIELD_ALIASES
                        .latitude
                ),
                readAlias(
                    record,
                    STORM_CELL_FIELD_ALIASES
                        .longitude
                )
            );

        if (
            !coordinates.valid
        ) {
            return null;
        }

        const timestamp =
            normalizeTimestamp(
                readAlias(
                    record,
                    STORM_CELL_FIELD_ALIASES
                        .timestamp
                ),
                Date.now()
            );

        return {
            id:
                normalizeText(
                    readAlias(
                        record,
                        STORM_CELL_FIELD_ALIASES
                            .id
                    ),
                    createRuntimeId(
                        'storm_cell'
                    )
                ),

            latitude:
                coordinates.latitude,

            longitude:
                coordinates.longitude,

            intensity:
                normalizeNonNegativeNumber(
                    readAlias(
                        record,
                        STORM_CELL_FIELD_ALIASES
                            .intensity
                    ),
                    0
                ),

            speedKmh:
                normalizeNonNegativeNumber(
                    readAlias(
                        record,
                        STORM_CELL_FIELD_ALIASES
                            .speed
                    ),
                    0
                ),

            directionDeg:
                normalizeDirection(
                    readAlias(
                        record,
                        STORM_CELL_FIELD_ALIASES
                            .direction
                    )
                ),

            radiusKm:
                normalizeNonNegativeNumber(
                    readAlias(
                        record,
                        STORM_CELL_FIELD_ALIASES
                            .radius
                    ),
                    null
                ),

            areaKm2:
                normalizeNonNegativeNumber(
                    readAlias(
                        record,
                        STORM_CELL_FIELD_ALIASES
                            .area
                    ),
                    null
                ),

            growthRate:
                toFiniteNumber(
                    readAlias(
                        record,
                        STORM_CELL_FIELD_ALIASES
                            .growthRate
                    ),
                    0
                ),

            riskLevel:
                readAlias(
                    record,
                    STORM_CELL_FIELD_ALIASES
                        .risk
                ) ??
                null,

            confidence:
                normalizePercentage(
                    readAlias(
                        record,
                        STORM_CELL_FIELD_ALIASES
                            .confidence
                    ),
                    context.confidence ??
                    100
                ),

            source:
                context.source ||
                'storm_cell',

            timestamp,

            timestampIso:
                new Date(
                    timestamp
                ).toISOString(),

            raw:
                record
        };
    }

    /**
     * Extract a useful array from source payload.
     *
     * @param {*} payload
     * @param {string[]} preferredKeys
     * @returns {Array}
     */
    function extractPayloadArray(
        payload,
        preferredKeys = []
    ) {
        if (Array.isArray(payload)) {
            return payload.slice();
        }

        if (
            payload instanceof Map
        ) {
            return Array.from(
                payload.values()
            );
        }

        if (
            !payload ||
            typeof payload !==
                'object'
        ) {
            return [];
        }

        for (
            const key
            of preferredKeys
        ) {
            if (
                Array.isArray(
                    payload[key]
                )
            ) {
                return payload[
                    key
                ].slice();
            }

            if (
                payload[key] instanceof
                Map
            ) {
                return Array.from(
                    payload[key]
                        .values()
                );
            }
        }

        return toCollectionArray(
            payload
        );
    }

    /**
     * Normalize weather payload.
     *
     * @param {*} payload
     * @param {Object} context
     * @returns {Array<Object>}
     */
    function normalizeWeatherPayload(
        payload,
        context = {}
    ) {
        const records =
            extractPayloadArray(
                payload,
                [
                    'cities',
                    'weather',
                    'weatherData',
                    'observations',
                    'forecasts',
                    'results',
                    'items',
                    'data'
                ]
            );

        if (
            records.length === 0 &&
            isPlainObject(payload)
        ) {
            const singleRecord =
                normalizeWeatherRecord(
                    payload,
                    context
                );

            return singleRecord
                ? [
                    singleRecord
                ]
                : [];
        }

        return records
            .map(
                (record) =>
                    normalizeWeatherRecord(
                        record,
                        context
                    )
            )
            .filter(Boolean);
    }

    /**
     * Normalize radar payload.
     *
     * @param {*} payload
     * @param {Object} context
     * @returns {Array<Object>}
     */
    function normalizeRadarPayload(
        payload,
        context = {}
    ) {
        return extractPayloadArray(
            payload,
            [
                'cells',
                'radarCells',
                'radarPoints',
                'features',
                'frames',
                'precipitation',
                'results',
                'items',
                'data'
            ]
        )
            .map(
                (record) =>
                    normalizeRadarRecord(
                        record,
                        context
                    )
            )
            .filter(Boolean);
    }

    /**
     * Normalize lightning payload.
     *
     * @param {*} payload
     * @param {Object} context
     * @returns {Array<Object>}
     */
    function normalizeLightningPayload(
        payload,
        context = {}
    ) {
        return extractPayloadArray(
            payload,
            [
                'strikes',
                'lightning',
                'lightningStrikes',
                'events',
                'results',
                'items',
                'data'
            ]
        )
            .map(
                (record) =>
                    normalizeLightningRecord(
                        record,
                        context
                    )
            )
            .filter(Boolean);
    }

    /**
     * Normalize storm cell payload.
     *
     * @param {*} payload
     * @param {Object} context
     * @returns {Array<Object>}
     */
    function normalizeStormCellPayload(
        payload,
        context = {}
    ) {
        return extractPayloadArray(
            payload,
            [
                'cells',
                'stormCells',
                'activeCells',
                'trackedCells',
                'results',
                'items',
                'data'
            ]
        )
            .map(
                (record) =>
                    normalizeStormCellRecord(
                        record,
                        context
                    )
            )
            .filter(Boolean);
    }

    /**
     * Calculate distance between two coordinates.
     *
     * @param {number} latitude1
     * @param {number} longitude1
     * @param {number} latitude2
     * @param {number} longitude2
     * @returns {number}
     */
    function calculateDistanceKm(
        latitude1,
        longitude1,
        latitude2,
        longitude2
    ) {
        const earthRadiusKm =
            6371;

        const toRadians =
            (degrees) =>
                degrees *
                Math.PI /
                180;

        const latitudeDelta =
            toRadians(
                latitude2 -
                latitude1
            );

        const longitudeDelta =
            toRadians(
                longitude2 -
                longitude1
            );

        const firstLatitude =
            toRadians(
                latitude1
            );

        const secondLatitude =
            toRadians(
                latitude2
            );

        const a =
            Math.sin(
                latitudeDelta /
                2
            ) ** 2 +
            Math.cos(
                firstLatitude
            ) *
            Math.cos(
                secondLatitude
            ) *
            Math.sin(
                longitudeDelta /
                2
            ) ** 2;

        return earthRadiusKm *
            2 *
            Math.atan2(
                Math.sqrt(a),
                Math.sqrt(
                    1 - a
                )
            );
    }

    /**
     * Normalize a city matching key.
     *
     * @param {*} value
     * @returns {string}
     */
    function normalizeCityKey(
        value
    ) {
        return normalizeText(
            value,
            ''
        )
            .toLowerCase()
            .replace(
                /[\s_-]+/g,
                ''
            )
            .replace(
                /[^\p{L}\p{N}]/gu,
                ''
            );
    }

    /**
     * Find a city corresponding to a weather record.
     *
     * @param {Object} weatherRecord
     * @param {Array<Object>} cities
     * @returns {Object|null}
     */
    function findMatchingCity(
        weatherRecord,
        cities
    ) {
        if (
            !weatherRecord ||
            !Array.isArray(cities)
        ) {
            return null;
        }

        const recordKeys =
            [
                weatherRecord.cityId,
                weatherRecord.cityName,
                weatherRecord.cityNameAr
            ]
                .map(
                    normalizeCityKey
                )
                .filter(Boolean);

        if (
            recordKeys.length > 0
        ) {
            for (const city of cities) {
                const cityKeys =
                    [
                        city.id,
                        city.name,
                        city.nameAr
                    ]
                        .map(
                            normalizeCityKey
                        )
                        .filter(Boolean);

                if (
                    cityKeys.some(
                        (cityKey) =>
                            recordKeys.includes(
                                cityKey
                            )
                    )
                ) {
                    return city;
                }
            }
        }

        if (
            weatherRecord
                .hasCoordinates
        ) {
            let nearestCity =
                null;

            let nearestDistance =
                Number.POSITIVE_INFINITY;

            for (const city of cities) {
                if (
                    !city ||
                    !city.hasCoordinates
                ) {
                    continue;
                }

                const distance =
                    calculateDistanceKm(
                        weatherRecord.latitude,
                        weatherRecord.longitude,
                        city.latitude,
                        city.longitude
                    );

                if (
                    distance <
                    nearestDistance
                ) {
                    nearestDistance =
                        distance;

                    nearestCity =
                        city;
                }
            }

            if (
                nearestDistance <=
                30
            ) {
                return nearestCity;
            }
        }

        return null;
    }

    /**
     * Merge weather records by city.
     *
     * @param {Array<Object>} cities
     * @param {Array<Object>} weatherRecords
     * @returns {Array<Object>}
     */
    function buildUnifiedCityWeather(
        cities,
        weatherRecords
    ) {
        const cityMap =
            new Map();

        for (const city of cities) {
            if (!city) {
                continue;
            }

            cityMap.set(
                city.id,
                {
                    id:
                        city.id,

                    name:
                        city.name,

                    nameAr:
                        city.nameAr,

                    latitude:
                        city.latitude,

                    longitude:
                        city.longitude,

                    region:
                        city.region ||
                        null,

                    elevation:
                        city.elevation ||
                        null,

                    hasCoordinates:
                        Boolean(
                            city
                                .hasCoordinates
                        ),

                    weather:
                        null,

                    weatherSources:
                        [],

                    sourceConfidence:
                        0,

                    sourceCount:
                        0,

                    updatedAt:
                        null
                }
            );
        }

        for (
            const weatherRecord
            of weatherRecords
        ) {
            const matchingCity =
                findMatchingCity(
                    weatherRecord,
                    cities
                );

            const cityId =
                matchingCity
                    ? matchingCity.id
                    : (
                        weatherRecord
                            .cityId ||
                        normalizeCityKey(
                            weatherRecord
                                .cityNameAr ||
                            weatherRecord
                                .cityName
                        ) ||
                        createRuntimeId(
                            'unmatched_city'
                        )
                    );

            if (
                !cityMap.has(
                    cityId
                )
            ) {
                cityMap.set(
                    cityId,
                    {
                        id:
                            cityId,

                        name:
                            weatherRecord
                                .cityName ||
                            weatherRecord
                                .cityNameAr ||
                            cityId,

                        nameAr:
                            weatherRecord
                                .cityNameAr ||
                            weatherRecord
                                .cityName ||
                            cityId,

                        latitude:
                            weatherRecord
                                .latitude,

                        longitude:
                            weatherRecord
                                .longitude,

                        region:
                            null,

                        elevation:
                            null,

                        hasCoordinates:
                            weatherRecord
                                .hasCoordinates,

                        weather:
                            null,

                        weatherSources:
                            [],

                        sourceConfidence:
                            0,

                        sourceCount:
                            0,

                        updatedAt:
                            null
                    }
                );
            }

            const cityRecord =
                cityMap.get(
                    cityId
                );

            cityRecord
                .weatherSources
                .push(
                    weatherRecord
                );

            cityRecord.sourceCount =
                cityRecord
                    .weatherSources
                    .length;

            const sortedSources =
                cityRecord
                    .weatherSources
                    .slice()
                    .sort(
                        (left, right) => {
                            const confidenceDifference =
                                toFiniteNumber(
                                    right.confidence,
                                    0
                                ) -
                                toFiniteNumber(
                                    left.confidence,
                                    0
                                );

                            if (
                                confidenceDifference !==
                                0
                            ) {
                                return confidenceDifference;
                            }

                            return (
                                right.timestamp ||
                                0
                            ) -
                            (
                                left.timestamp ||
                                0
                            );
                        }
                    );

            cityRecord.weather =
                sortedSources[0];

            cityRecord
                .sourceConfidence =
                sortedSources.reduce(
                    (
                        total,
                        item
                    ) =>
                        total +
                        toFiniteNumber(
                            item.confidence,
                            0
                        ),
                    0
                ) /
                sortedSources.length;

            cityRecord.updatedAt =
                Math.max(
                    ...sortedSources.map(
                        (item) =>
                            item.timestamp ||
                            0
                    )
                );
        }

        return Array.from(
            cityMap.values()
        );
    }

    /**
     * Extract and normalize data from collected source results.
     *
     * @param {Object} sourceCollection
     * @returns {Object}
     */
    function normalizeCollectedSources(
        sourceCollection
    ) {
        const weatherRecords = [];
        const radarRecords = [];
        const lightningRecords = [];
        const stormCells = [];
        const stormPaths = [];

        const normalizedSources = {};

        const results =
            sourceCollection &&
            Array.isArray(
                sourceCollection.results
            )
                ? sourceCollection.results
                : [];

        for (const result of results) {
            if (
                !result ||
                !result.success ||
                result.accepted ===
                    false
            ) {
                continue;
            }

            const context = {
                source:
                    result.source,

                sourceType:
                    result.sourceType,

                confidence:
                    result.confidence
            };

            let normalizedPayload =
                null;

            switch (
                result.sourceType
            ) {
                case 'official_weather':
                case 'forecast':
                case 'weather':
                case 'local_ai':
                    normalizedPayload =
                        normalizeWeatherPayload(
                            result.payload,
                            context
                        );

                    weatherRecords.push(
                        ...normalizedPayload
                    );
                    break;

                case 'radar':
                    normalizedPayload =
                        normalizeRadarPayload(
                            result.payload,
                            context
                        );

                    radarRecords.push(
                        ...normalizedPayload
                    );
                    break;

                case 'lightning':
                    normalizedPayload =
                        normalizeLightningPayload(
                            result.payload,
                            context
                        );

                    lightningRecords.push(
                        ...normalizedPayload
                    );
                    break;

                case 'storm_cells':
                    normalizedPayload =
                        normalizeStormCellPayload(
                            result.payload,
                            context
                        );

                    stormCells.push(
                        ...normalizedPayload
                    );
                    break;

                case 'storm_paths':
                    normalizedPayload =
                        extractPayloadArray(
                            result.payload,
                            [
                                'paths',
                                'stormPaths',
                                'predictions',
                                'results',
                                'items',
                                'data'
                            ]
                        );

                    stormPaths.push(
                        ...normalizedPayload
                    );
                    break;

                case 'orchestrator': {
                    const payload =
                        result.payload;

                    const weather =
                        normalizeWeatherPayload(
                            payload &&
                            (
                                payload.weather ||
                                payload.weatherData ||
                                payload.cities
                            ),
                            context
                        );

                    const radar =
                        normalizeRadarPayload(
                            payload &&
                            (
                                payload.radar ||
                                payload.radarData
                            ),
                            context
                        );

                    const lightning =
                        normalizeLightningPayload(
                            payload &&
                            (
                                payload.lightning ||
                                payload.lightningData
                            ),
                            context
                        );

                    const cells =
                        normalizeStormCellPayload(
                            payload &&
                            (
                                payload.stormCells ||
                                payload.cells
                            ),
                            context
                        );

                    weatherRecords.push(
                        ...weather
                    );

                    radarRecords.push(
                        ...radar
                    );

                    lightningRecords.push(
                        ...lightning
                    );

                    stormCells.push(
                        ...cells
                    );

                    normalizedPayload = {
                        weather,
                        radar,
                        lightning,
                        stormCells:
                            cells
                    };
                    break;
                }

                default:
                    normalizedPayload =
                        result.payload;
                    break;
            }

            normalizedSources[
                result.source
            ] = {
                source:
                    result.source,

                sourceType:
                    result.sourceType,

                confidence:
                    result.confidence,

                itemCount:
                    Array.isArray(
                        normalizedPayload
                    )
                        ? normalizedPayload
                            .length
                        : (
                            normalizedPayload
                                ? 1
                                : 0
                        ),

                data:
                    normalizedPayload
            };
        }

        return {
            weatherRecords,
            radarRecords,
            lightningRecords,
            stormCells,
            stormPaths,
            normalizedSources
        };
    }

    /**
     * Merge platform snapshot fallback data.
     *
     * @param {Object} normalizedData
     * @param {Object} platformSnapshot
     * @returns {Object}
     */
    function mergePlatformSnapshotData(
        normalizedData,
        platformSnapshot
    ) {
        if (!platformSnapshot) {
            return normalizedData;
        }

        if (
            normalizedData
                .weatherRecords
                .length === 0 &&
            platformSnapshot
                .weatherData
        ) {
            normalizedData
                .weatherRecords
                .push(
                    ...normalizeWeatherPayload(
                        platformSnapshot
                            .weatherData,
                        {
                            source:
                                'platform_snapshot',

                            sourceType:
                                'weather',

                            confidence:
                                70
                        }
                    )
                );
        }

        if (
            normalizedData
                .radarRecords
                .length === 0 &&
            platformSnapshot
                .radarData
        ) {
            normalizedData
                .radarRecords
                .push(
                    ...normalizeRadarPayload(
                        platformSnapshot
                            .radarData,
                        {
                            source:
                                'platform_snapshot',

                            sourceType:
                                'radar',

                            confidence:
                                70
                        }
                    )
                );
        }

        if (
            normalizedData
                .lightningRecords
                .length === 0 &&
            platformSnapshot
                .lightningData
        ) {
            normalizedData
                .lightningRecords
                .push(
                    ...normalizeLightningPayload(
                        platformSnapshot
                            .lightningData,
                        {
                            source:
                                'platform_snapshot',

                            sourceType:
                                'lightning',

                            confidence:
                                70
                        }
                    )
                );
        }

        if (
            normalizedData
                .stormCells
                .length === 0 &&
            Array.isArray(
                platformSnapshot
                    .stormCells
            )
        ) {
            normalizedData
                .stormCells
                .push(
                    ...normalizeStormCellPayload(
                        platformSnapshot
                            .stormCells,
                        {
                            source:
                                'platform_snapshot',

                            sourceType:
                                'storm_cells',

                            confidence:
                                70
                        }
                    )
                );
        }

        if (
            normalizedData
                .stormPaths
                .length === 0 &&
            Array.isArray(
                platformSnapshot
                    .stormPaths
            )
        ) {
            normalizedData
                .stormPaths
                .push(
                    ...platformSnapshot
                        .stormPaths
                );
        }

        return normalizedData;
    }

    /**
     * Build unified prediction input.
     *
     * @param {Object} sourceCollection
     * @param {Object} options
     * @returns {Object}
     */
    function buildUnifiedPredictionInput(
        sourceCollection,
        options = {}
    ) {
        const startedAt =
            Date.now();

        const platformSnapshot =
            options
                .platformSnapshot ||
            (
                sourceCollection &&
                sourceCollection
                    .platformSnapshot
                    ? sourceCollection
                        .platformSnapshot
                    : runtimeState
                        .latestPlatformSnapshot
            ) ||
            null;

        const normalizedData =
            mergePlatformSnapshotData(
                normalizeCollectedSources(
                    sourceCollection
                ),
                platformSnapshot
            );

        const cities =
            Array.isArray(
                options.cities
            )
                ? options.cities
                : (
                    platformSnapshot &&
                    Array.isArray(
                        platformSnapshot
                            .cities
                    )
                        ? platformSnapshot
                            .cities
                        : []
                );

        const unifiedCities =
            buildUnifiedCityWeather(
                cities,
                normalizedData
                    .weatherRecords
            );

        const input = {
            id:
                createRuntimeId(
                    'prediction_input'
                ),

            cycleId:
                options.cycleId ||
                (
                    sourceCollection &&
                    sourceCollection
                        .cycleId
                ) ||
                null,

            cities:
                unifiedCities,

            cityCount:
                unifiedCities.length,

            weather:
                normalizedData
                    .weatherRecords,

            weatherRecordCount:
                normalizedData
                    .weatherRecords
                    .length,

            radar:
                normalizedData
                    .radarRecords,

            radarRecordCount:
                normalizedData
                    .radarRecords
                    .length,

            lightning:
                normalizedData
                    .lightningRecords,

            lightningRecordCount:
                normalizedData
                    .lightningRecords
                    .length,

            stormCells:
                normalizedData
                    .stormCells,

            stormCellCount:
                normalizedData
                    .stormCells
                    .length,

            stormPaths:
                normalizedData
                    .stormPaths,

            stormPathCount:
                normalizedData
                    .stormPaths
                    .length,

            floodRiskData:
                platformSnapshot
                    ? platformSnapshot
                        .floodRiskData
                    : null,

            sourceCollectionSummary:
                sourceCollection &&
                sourceCollection
                    .summary
                    ? sourceCollection
                        .summary
                    : null,

            normalizedSources:
                normalizedData
                    .normalizedSources,

            sourceCollectionId:
                sourceCollection &&
                sourceCollection.id
                    ? sourceCollection.id
                    : null,

            platformSnapshotId:
                platformSnapshot &&
                platformSnapshot.id
                    ? platformSnapshot.id
                    : null,

            createdAt:
                Date.now(),

            createdAtIso:
                nowIso(),

            buildDurationMs:
                Date.now() -
                startedAt
        };

        runtimeState
            .latestUnifiedPredictionInput =
            input;

        return input;
    }

    /**
     * Collect sources and build prediction input.
     *
     * @param {Object} options
     * @returns {Promise<Object>}
     */
    async function collectUnifiedPredictionInput(
        options = {}
    ) {
        if (
            typeof integrationApi
                .collectSources !==
                'function'
        ) {
            throw new Error(
                'Source collection API is unavailable.'
            );
        }

        const sourceCollection =
            await integrationApi
                .collectSources(
                    options
                );

        const predictionInput =
            buildUnifiedPredictionInput(
                sourceCollection,
                {
                    ...options,

                    platformSnapshot:
                        sourceCollection
                            .platformSnapshot
                }
            );

        return {
            success:
                sourceCollection
                    .success,

            sourceCollection,

            predictionInput,

            createdAt:
                Date.now(),

            createdAtIso:
                nowIso()
        };
    }

    /**
     * Return latest unified prediction input.
     *
     * @returns {Object|null}
     */
    function getLatestUnifiedPredictionInput() {
        return runtimeState
            .latestUnifiedPredictionInput ||
            null;
    }

    /**
     * Return unified input summary.
     *
     * @returns {Object}
     */
    function getUnifiedInputStatus() {
        const input =
            getLatestUnifiedPredictionInput();

        if (!input) {
            return {
                available:
                    false,

                cityCount:
                    0,

                weatherRecordCount:
                    0,

                radarRecordCount:
                    0,

                lightningRecordCount:
                    0,

                stormCellCount:
                    0,

                stormPathCount:
                    0
            };
        }

        return {
            available:
                true,

            id:
                input.id,

            cycleId:
                input.cycleId,

            cityCount:
                input.cityCount,

            weatherRecordCount:
                input
                    .weatherRecordCount,

            radarRecordCount:
                input
                    .radarRecordCount,

            lightningRecordCount:
                input
                    .lightningRecordCount,

            stormCellCount:
                input
                    .stormCellCount,

            stormPathCount:
                input
                    .stormPathCount,

            sourceCollectionId:
                input
                    .sourceCollectionId,

            createdAt:
                input.createdAt,

            createdAtIso:
                input.createdAtIso,

            buildDurationMs:
                input
                    .buildDurationMs
        };
    }

    /**
     * Extend runtime state.
     */
    if (
        !Object.prototype
            .hasOwnProperty
            .call(
                runtimeState,
                'latestUnifiedPredictionInput'
            )
    ) {
        runtimeState
            .latestUnifiedPredictionInput =
            null;
    }

    /**
     * Extend public API.
     */
    integrationApi
        .normalizeWeatherRecord =
        normalizeWeatherRecord;

    integrationApi
        .normalizeRadarRecord =
        normalizeRadarRecord;

    integrationApi
        .normalizeLightningRecord =
        normalizeLightningRecord;

    integrationApi
        .normalizeStormCellRecord =
        normalizeStormCellRecord;

    integrationApi
        .normalizeCollectedSources =
        normalizeCollectedSources;

    integrationApi
        .buildUnifiedPredictionInput =
        buildUnifiedPredictionInput;

    integrationApi
        .collectUnifiedPredictionInput =
        collectUnifiedPredictionInput;

    integrationApi
        .getLatestUnifiedPredictionInput =
        getLatestUnifiedPredictionInput;

    integrationApi
        .getUnifiedInputStatus =
        getUnifiedInputStatus;

    integrationApi
        .metadata = {
            ...integrationApi
                .metadata,

            currentPart:
                '2.1C-2',

            nextPart:
                '2.1D-1',

            status:
                'part_complete',

            productionReady:
                false,

            moduleClosed:
                true,

            capabilities: [
                ...new Set([
                    ...(
                        Array.isArray(
                            integrationApi
                                .metadata
                                .capabilities
                        )
                            ? integrationApi
                                .metadata
                                .capabilities
                            : []
                    ),

                    'weather_record_normalization',
                    'radar_record_normalization',
                    'lightning_record_normalization',
                    'storm_cell_normalization',
                    'city_weather_matching',
                    'multi_source_weather_merging',
                    'platform_snapshot_fallback',
                    'unified_prediction_input',
                    'prediction_input_status'
                ])
            ]
        };

    /**
     * Extend internal API.
     */
    Object.assign(
        integrationApi._internals,
        {
            WEATHER_FIELD_ALIASES,
            RADAR_FIELD_ALIASES,
            LIGHTNING_FIELD_ALIASES,
            STORM_CELL_FIELD_ALIASES,

            readAlias,
            normalizePercentage,
            normalizeNonNegativeNumber,
            normalizeCoordinates,
            normalizeDirection,

            normalizeWeatherPayload,
            normalizeRadarPayload,
            normalizeLightningPayload,
            normalizeStormCellPayload,

            extractPayloadArray,
            calculateDistanceKm,
            normalizeCityKey,
            findMatchingCity,
            buildUnifiedCityWeather,
            mergePlatformSnapshotData
        }
    );

    log(
        'info',
        'Rain arrival integration Part 2.1C-2 loaded.',
        {
            latestInputAvailable:
                Boolean(
                    runtimeState
                        .latestUnifiedPredictionInput
                )
        }
    );
})(
    typeof globalThis !==
        'undefined'
        ? globalThis
        : (
            typeof window !==
                'undefined'
                ? window
                : this
        )
);

/**
 * RainGuard AI V32
 * Rain Arrival Integration Engine
 *
 * Part:
 * 2.1D-1
 *
 * Responsibilities:
 * - Detect compatible prediction methods
 * - Prepare engine prediction payloads
 * - Execute single-city predictions
 * - Execute batch predictions
 * - Normalize prediction results
 * - Track prediction statistics and failures
 */

(function rainArrivalIntegrationV32PredictionExecution(globalObject) {
    'use strict';

    if (
        !globalObject ||
        !globalObject.RainGuardAI ||
        !globalObject.RainGuardAI.V32 ||
        !globalObject.RainGuardAI.V32
            .rainArrivalIntegration
    ) {
        throw new Error(
            'Rain Arrival Integration Part 2.1C-2 must be loaded before Part 2.1D-1.'
        );
    }

    const integrationApi =
        globalObject
            .RainGuardAI
            .V32
            .rainArrivalIntegration;

    const runtimeState =
        integrationApi._state;

    const internal =
        integrationApi._internals;

    const {
        isPlainObject,
        toFiniteNumber,
        clamp,
        createRuntimeId,
        nowIso,
        normalizeError,
        withTimeout,
        normalizeTimestamp,
        normalizePercentage,
        calculateDistanceKm,
        dispatchIntegrationEvent,
        log
    } = internal;

    /**
     * Supported prediction horizons.
     */
    const PREDICTION_HORIZONS_MINUTES =
        Object.freeze([
            30,
            60,
            90,
            120
        ]);

    /**
     * Compatible batch prediction methods.
     */
    const BATCH_PREDICTION_METHODS =
        Object.freeze([
            'predictAllCities',
            'predictCities',
            'predictBatch',
            'runBatchPrediction',
            'generatePredictions',
            'calculatePredictions',
            'executePredictionCycle',
            'executePredictions',
            'predictRainArrival',
            'predict'
        ]);

    /**
     * Compatible single-city prediction methods.
     */
    const SINGLE_CITY_PREDICTION_METHODS =
        Object.freeze([
            'predictCity',
            'predictForCity',
            'predictRainArrivalForCity',
            'calculateCityPrediction',
            'calculateRainArrival',
            'generateCityPrediction',
            'executeCityPrediction',
            'predictArrival',
            'predict'
        ]);

    /**
     * Prediction result aliases.
     */
    const PREDICTION_RESULT_ALIASES =
        Object.freeze({
            cityId: [
                'cityId',
                'city_id',
                'locationId',
                'location_id',
                'id'
            ],

            cityName: [
                'cityName',
                'city_name',
                'city',
                'name',
                'locationName',
                'location_name'
            ],

            cityNameAr: [
                'cityNameAr',
                'city_name_ar',
                'nameAr',
                'name_ar',
                'arabicName'
            ],

            latitude: [
                'latitude',
                'lat',
                'cityLatitude',
                'city_latitude'
            ],

            longitude: [
                'longitude',
                'lng',
                'lon',
                'cityLongitude',
                'city_longitude'
            ],

            arrivalMinutes: [
                'arrivalMinutes',
                'arrival_minutes',
                'etaMinutes',
                'eta_minutes',
                'minutesToArrival',
                'minutes_to_arrival',
                'timeToArrival',
                'time_to_arrival'
            ],

            arrivalTime: [
                'arrivalTime',
                'arrival_time',
                'estimatedArrival',
                'estimated_arrival',
                'eta',
                'expectedAt',
                'expected_at'
            ],

            probability: [
                'probability',
                'rainProbability',
                'rain_probability',
                'arrivalProbability',
                'arrival_probability',
                'chance',
                'score'
            ],

            confidence: [
                'confidence',
                'confidenceScore',
                'confidence_score',
                'predictionConfidence',
                'prediction_confidence',
                'quality'
            ],

            intensity: [
                'intensity',
                'expectedIntensity',
                'expected_intensity',
                'rainIntensity',
                'rain_intensity',
                'precipitationIntensity'
            ],

            riskLevel: [
                'riskLevel',
                'risk_level',
                'risk',
                'severity',
                'alertLevel',
                'alert_level'
            ],

            sourceCellId: [
                'sourceCellId',
                'source_cell_id',
                'stormCellId',
                'storm_cell_id',
                'cellId',
                'cell_id'
            ],

            distanceKm: [
                'distanceKm',
                'distance_km',
                'distance',
                'stormDistance',
                'storm_distance'
            ],

            speedKmh: [
                'speedKmh',
                'speed_kmh',
                'stormSpeed',
                'storm_speed',
                'speed',
                'velocity'
            ],

            directionDeg: [
                'directionDeg',
                'direction_deg',
                'direction',
                'bearing',
                'movementDirection'
            ],

            timestamp: [
                'timestamp',
                'createdAt',
                'created_at',
                'generatedAt',
                'generated_at',
                'updatedAt',
                'updated_at'
            ]
        });

    /**
     * Read the first available alias.
     *
     * @param {Object} object
     * @param {string[]} aliases
     * @returns {*}
     */
    function readPredictionAlias(
        object,
        aliases
    ) {
        if (
            !object ||
            typeof object !==
                'object' ||
            !Array.isArray(aliases)
        ) {
            return undefined;
        }

        for (const alias of aliases) {
            if (
                Object.prototype
                    .hasOwnProperty
                    .call(
                        object,
                        alias
                    ) &&
                object[alias] !==
                    undefined &&
                object[alias] !==
                    null
            ) {
                return object[alias];
            }
        }

        return undefined;
    }

    /**
     * Resolve prediction engine instance.
     *
     * @param {Object} options
     * @returns {Promise<Object>}
     */
    async function resolvePredictionEngine(
        options = {}
    ) {
        let engine =
            integrationApi
                .getEngine();

        if (engine) {
            return engine;
        }

        if (
            !runtimeState.initialized
        ) {
            await integrationApi
                .initialize(
                    options
                );
        }

        engine =
            integrationApi
                .getEngine();

        if (!engine) {
            const error =
                new Error(
                    'Rain arrival prediction engine is unavailable.'
                );

            error.code =
                'RAIN_ARRIVAL_PREDICTION_ENGINE_UNAVAILABLE';

            throw error;
        }

        return engine;
    }

    /**
     * Resolve compatible engine method.
     *
     * @param {Object} engine
     * @param {string[]} methodCandidates
     * @returns {{
     *     method: Function|null,
     *     methodName: string|null
     * }}
     */
    function resolvePredictionMethod(
        engine,
        methodCandidates
    ) {
        if (
            !engine ||
            !Array.isArray(
                methodCandidates
            )
        ) {
            return {
                method:
                    null,

                methodName:
                    null
            };
        }

        for (
            const methodName
            of methodCandidates
        ) {
            if (
                typeof engine[
                    methodName
                ] ===
                'function'
            ) {
                return {
                    method:
                        engine[
                            methodName
                        ].bind(
                            engine
                        ),

                    methodName
                };
            }
        }

        return {
            method:
                null,

            methodName:
                null
        };
    }

    /**
     * Detect prediction capabilities.
     *
     * @param {Object} engine
     * @returns {Object}
     */
    function detectPredictionCapabilities(
        engine
    ) {
        const batch =
            resolvePredictionMethod(
                engine,
                BATCH_PREDICTION_METHODS
            );

        const singleCity =
            resolvePredictionMethod(
                engine,
                SINGLE_CITY_PREDICTION_METHODS
            );

        return {
            batchAvailable:
                Boolean(
                    batch.method
                ),

            batchMethodName:
                batch.methodName,

            singleCityAvailable:
                Boolean(
                    singleCity.method
                ),

            singleCityMethodName:
                singleCity.methodName,

            supportsBatch:
                Boolean(
                    batch.method
                ),

            supportsSingleCity:
                Boolean(
                    singleCity.method
                )
        };
    }

    /**
     * Normalize requested prediction horizons.
     *
     * @param {*} horizons
     * @returns {number[]}
     */
    function normalizePredictionHorizons(
        horizons
    ) {
        if (
            !Array.isArray(
                horizons
            )
        ) {
            return PREDICTION_HORIZONS_MINUTES
                .slice();
        }

        const normalized =
            horizons
                .map(
                    (value) =>
                        Math.round(
                            toFiniteNumber(
                                value,
                                NaN
                            )
                        )
                )
                .filter(
                    (value) =>
                        Number.isFinite(
                            value
                        ) &&
                        value > 0 &&
                        value <= 1440
                );

        return Array.from(
            new Set(
                normalized
            )
        ).sort(
            (left, right) =>
                left - right
        );
    }

    /**
     * Build a single-city prediction payload.
     *
     * @param {Object} city
     * @param {Object} unifiedInput
     * @param {Object} options
     * @returns {Object}
     */
    function buildCityPredictionPayload(
        city,
        unifiedInput,
        options = {}
    ) {
        if (
            !city ||
            typeof city !==
                'object'
        ) {
            throw new TypeError(
                'A valid city record is required.'
            );
        }

        const nearbyStormCells =
            Array.isArray(
                unifiedInput
                    .stormCells
            )
                ? unifiedInput
                    .stormCells
                    .map(
                        (stormCell) => {
                            if (
                                !city
                                    .hasCoordinates ||
                                !Number.isFinite(
                                    stormCell
                                        .latitude
                                ) ||
                                !Number.isFinite(
                                    stormCell
                                        .longitude
                                )
                            ) {
                                return {
                                    ...stormCell,

                                    distanceToCityKm:
                                        null
                                };
                            }

                            return {
                                ...stormCell,

                                distanceToCityKm:
                                    calculateDistanceKm(
                                        city.latitude,
                                        city.longitude,
                                        stormCell
                                            .latitude,
                                        stormCell
                                            .longitude
                                    )
                            };
                        }
                    )
                    .sort(
                        (left, right) => {
                            const leftDistance =
                                left
                                    .distanceToCityKm;

                            const rightDistance =
                                right
                                    .distanceToCityKm;

                            if (
                                leftDistance ===
                                    null
                            ) {
                                return 1;
                            }

                            if (
                                rightDistance ===
                                    null
                            ) {
                                return -1;
                            }

                            return (
                                leftDistance -
                                rightDistance
                            );
                        }
                    )
                    .slice(
                        0,
                        options
                            .maximumNearbyStormCells ??
                        10
                    )
                : [];

        const nearbyLightning =
            Array.isArray(
                unifiedInput
                    .lightning
            )
                ? unifiedInput
                    .lightning
                    .map(
                        (strike) => {
                            if (
                                !city
                                    .hasCoordinates ||
                                !Number.isFinite(
                                    strike.latitude
                                ) ||
                                !Number.isFinite(
                                    strike.longitude
                                )
                            ) {
                                return {
                                    ...strike,

                                    distanceToCityKm:
                                        null
                                };
                            }

                            return {
                                ...strike,

                                distanceToCityKm:
                                    calculateDistanceKm(
                                        city.latitude,
                                        city.longitude,
                                        strike.latitude,
                                        strike.longitude
                                    )
                            };
                        }
                    )
                    .filter(
                        (strike) =>
                            strike
                                .distanceToCityKm ===
                                null ||
                            strike
                                .distanceToCityKm <=
                                (
                                    options
                                        .lightningRadiusKm ??
                                    150
                                )
                    )
                    .slice(
                        0,
                        options
                            .maximumLightningStrikes ??
                        100
                    )
                : [];

        return {
            id:
                createRuntimeId(
                    'city_prediction_request'
                ),

            city: {
                id:
                    city.id,

                name:
                    city.name,

                nameAr:
                    city.nameAr,

                latitude:
                    city.latitude,

                longitude:
                    city.longitude,

                region:
                    city.region ||
                    null,

                elevation:
                    city.elevation ||
                    null,

                hasCoordinates:
                    Boolean(
                        city.hasCoordinates
                    )
            },

            weather:
                city.weather ||
                null,

            weatherSources:
                Array.isArray(
                    city.weatherSources
                )
                    ? city.weatherSources
                    : [],

            stormCells:
                nearbyStormCells,

            stormPaths:
                Array.isArray(
                    unifiedInput
                        .stormPaths
                )
                    ? unifiedInput
                        .stormPaths
                    : [],

            radar:
                Array.isArray(
                    unifiedInput.radar
                )
                    ? unifiedInput.radar
                    : [],

            lightning:
                nearbyLightning,

            floodRiskData:
                unifiedInput
                    .floodRiskData ||
                null,

            horizonsMinutes:
                normalizePredictionHorizons(
                    options
                        .horizonsMinutes
                ),

            integrationContext: {
                cycleId:
                    options.cycleId ||
                    unifiedInput
                        .cycleId ||
                    null,

                unifiedInputId:
                    unifiedInput.id,

                sourceCollectionId:
                    unifiedInput
                        .sourceCollectionId ||
                    null,

                integrationVersion:
                    'V32',

                requestedAt:
                    Date.now(),

                requestedAtIso:
                    nowIso()
            }
        };
    }

    /**
     * Build a batch prediction payload.
     *
     * @param {Object} unifiedInput
     * @param {Object} options
     * @returns {Object}
     */
    function buildBatchPredictionPayload(
        unifiedInput,
        options = {}
    ) {
        return {
            id:
                createRuntimeId(
                    'batch_prediction_request'
                ),

            cycleId:
                options.cycleId ||
                unifiedInput
                    .cycleId ||
                null,

            cities:
                unifiedInput.cities,

            weather:
                unifiedInput.weather,

            radar:
                unifiedInput.radar,

            lightning:
                unifiedInput.lightning,

            stormCells:
                unifiedInput
                    .stormCells,

            stormPaths:
                unifiedInput
                    .stormPaths,

            floodRiskData:
                unifiedInput
                    .floodRiskData,

            horizonsMinutes:
                normalizePredictionHorizons(
                    options
                        .horizonsMinutes
                ),

            sourceSummary:
                unifiedInput
                    .sourceCollectionSummary,

            integrationVersion:
                'V32',

            requestedAt:
                Date.now(),

            requestedAtIso:
                nowIso(),

            options: {
                minimumConfidence:
                    integrationApi
                        .getConfiguration()
                        .minimumPredictionConfidence,

                language:
                    options.language ||
                    'ar',

                includeDiagnostics:
                    options
                        .includeDiagnostics !==
                    false,

                includeSourceDetails:
                    options
                        .includeSourceDetails !==
                    false
            }
        };
    }

    /**
     * Convert a prediction response to array.
     *
     * @param {*} response
     * @returns {Array}
     */
    function predictionResponseToArray(
        response
    ) {
        if (
            response === undefined ||
            response === null
        ) {
            return [];
        }

        if (Array.isArray(response)) {
            return response.slice();
        }

        if (response instanceof Map) {
            return Array.from(
                response.values()
            );
        }

        if (
            typeof response !==
                'object'
        ) {
            return [];
        }

        const candidateKeys = [
            'predictions',
            'results',
            'cities',
            'data',
            'items',
            'forecasts',
            'arrivalPredictions'
        ];

        for (
            const key
            of candidateKeys
        ) {
            if (
                Array.isArray(
                    response[key]
                )
            ) {
                return response[
                    key
                ].slice();
            }

            if (
                response[key] instanceof
                Map
            ) {
                return Array.from(
                    response[key]
                        .values()
                );
            }
        }

        return [
            response
        ];
    }

    /**
     * Normalize arrival time.
     *
     * @param {*} arrivalTime
     * @param {*} arrivalMinutes
     * @param {number} generatedAt
     * @returns {{
     *     arrivalTime: number|null,
     *     arrivalTimeIso: string|null,
     *     arrivalMinutes: number|null
     * }}
     */
    function normalizeArrivalTime(
        arrivalTime,
        arrivalMinutes,
        generatedAt
    ) {
        let normalizedMinutes =
            toFiniteNumber(
                arrivalMinutes,
                NaN
            );

        if (
            Number.isFinite(
                normalizedMinutes
            )
        ) {
            normalizedMinutes =
                Math.max(
                    0,
                    normalizedMinutes
                );
        } else {
            normalizedMinutes =
                null;
        }

        let normalizedArrivalTime =
            null;

        if (
            arrivalTime !==
                undefined &&
            arrivalTime !==
                null
        ) {
            const parsed =
                normalizeTimestamp(
                    arrivalTime,
                    NaN
                );

            if (
                Number.isFinite(
                    parsed
                )
            ) {
                normalizedArrivalTime =
                    parsed;
            }
        }

        if (
            normalizedArrivalTime ===
                null &&
            normalizedMinutes !==
                null
        ) {
            normalizedArrivalTime =
                generatedAt +
                (
                    normalizedMinutes *
                    60 *
                    1000
                );
        }

        if (
            normalizedMinutes ===
                null &&
            normalizedArrivalTime !==
                null
        ) {
            normalizedMinutes =
                Math.max(
                    0,
                    (
                        normalizedArrivalTime -
                        generatedAt
                    ) /
                    60000
                );
        }

        return {
            arrivalTime:
                normalizedArrivalTime,

            arrivalTimeIso:
                normalizedArrivalTime !==
                    null
                    ? new Date(
                        normalizedArrivalTime
                    ).toISOString()
                    : null,

            arrivalMinutes:
                normalizedMinutes
        };
    }

    /**
     * Infer risk level from prediction values.
     *
     * @param {Object} values
     * @returns {string}
     */
    function inferPredictionRiskLevel(
        values
    ) {
        const probability =
            clamp(
                values.probability,
                0,
                100
            );

        const intensity =
            Math.max(
                0,
                toFiniteNumber(
                    values.intensity,
                    0
                )
            );

        const arrivalMinutes =
            toFiniteNumber(
                values.arrivalMinutes,
                Number.POSITIVE_INFINITY
            );

        if (
            probability >= 85 &&
            intensity >= 60 &&
            arrivalMinutes <= 30
        ) {
            return 'extreme';
        }

        if (
            probability >= 70 &&
            intensity >= 40 &&
            arrivalMinutes <= 60
        ) {
            return 'high';
        }

        if (
            probability >= 50 &&
            arrivalMinutes <= 120
        ) {
            return 'moderate';
        }

        if (
            probability >= 25
        ) {
            return 'low';
        }

        return 'minimal';
    }

    /**
     * Normalize prediction result.
     *
     * @param {*} prediction
     * @param {Object|null} city
     * @param {Object} context
     * @returns {Object}
     */
    function normalizePredictionResult(
        prediction,
        city = null,
        context = {}
    ) {
        const rawPrediction =
            isPlainObject(
                prediction
            )
                ? prediction
                : {};

        const generatedAt =
            normalizeTimestamp(
                readPredictionAlias(
                    rawPrediction,
                    PREDICTION_RESULT_ALIASES
                        .timestamp
                ),
                Date.now()
            );

        const arrival =
            normalizeArrivalTime(
                readPredictionAlias(
                    rawPrediction,
                    PREDICTION_RESULT_ALIASES
                        .arrivalTime
                ),
                readPredictionAlias(
                    rawPrediction,
                    PREDICTION_RESULT_ALIASES
                        .arrivalMinutes
                ),
                generatedAt
            );

        const probability =
            normalizePercentage(
                readPredictionAlias(
                    rawPrediction,
                    PREDICTION_RESULT_ALIASES
                        .probability
                ),
                0
            );

        const confidence =
            normalizePercentage(
                readPredictionAlias(
                    rawPrediction,
                    PREDICTION_RESULT_ALIASES
                        .confidence
                ),
                context
                    .defaultConfidence ??
                50
            );

        const intensity =
            Math.max(
                0,
                toFiniteNumber(
                    readPredictionAlias(
                        rawPrediction,
                        PREDICTION_RESULT_ALIASES
                            .intensity
                    ),
                    0
                )
            );

        const cityId =
            readPredictionAlias(
                rawPrediction,
                PREDICTION_RESULT_ALIASES
                    .cityId
            ) ||
            (
                city
                    ? city.id
                    : null
            );

        const cityName =
            readPredictionAlias(
                rawPrediction,
                PREDICTION_RESULT_ALIASES
                    .cityName
            ) ||
            (
                city
                    ? city.name
                    : null
            );

        const cityNameAr =
            readPredictionAlias(
                rawPrediction,
                PREDICTION_RESULT_ALIASES
                    .cityNameAr
            ) ||
            (
                city
                    ? city.nameAr
                    : cityName
            );

        const explicitRiskLevel =
            readPredictionAlias(
                rawPrediction,
                PREDICTION_RESULT_ALIASES
                    .riskLevel
            );

        const result = {
            id:
                rawPrediction.id ||
                createRuntimeId(
                    'rain_arrival_prediction'
                ),

            cityId:
                cityId ||
                null,

            cityName:
                cityName ||
                cityNameAr ||
                null,

            cityNameAr:
                cityNameAr ||
                cityName ||
                null,

            latitude:
                toFiniteNumber(
                    readPredictionAlias(
                        rawPrediction,
                        PREDICTION_RESULT_ALIASES
                            .latitude
                    ),
                    city
                        ? city.latitude
                        : null
                ),

            longitude:
                toFiniteNumber(
                    readPredictionAlias(
                        rawPrediction,
                        PREDICTION_RESULT_ALIASES
                            .longitude
                    ),
                    city
                        ? city.longitude
                        : null
                ),

            arrivalMinutes:
                arrival
                    .arrivalMinutes,

            arrivalTime:
                arrival
                    .arrivalTime,

            arrivalTimeIso:
                arrival
                    .arrivalTimeIso,

            probability:
                probability ??
                0,

            confidence:
                confidence ??
                0,

            intensity,

            riskLevel:
                explicitRiskLevel ||
                inferPredictionRiskLevel({
                    probability:
                        probability ?? 0,

                    intensity,

                    arrivalMinutes:
                        arrival
                            .arrivalMinutes
                }),

            sourceCellId:
                readPredictionAlias(
                    rawPrediction,
                    PREDICTION_RESULT_ALIASES
                        .sourceCellId
                ) ||
                null,

            distanceKm:
                toFiniteNumber(
                    readPredictionAlias(
                        rawPrediction,
                        PREDICTION_RESULT_ALIASES
                            .distanceKm
                    ),
                    null
                ),

            stormSpeedKmh:
                toFiniteNumber(
                    readPredictionAlias(
                        rawPrediction,
                        PREDICTION_RESULT_ALIASES
                            .speedKmh
                    ),
                    null
                ),

            stormDirectionDeg:
                toFiniteNumber(
                    readPredictionAlias(
                        rawPrediction,
                        PREDICTION_RESULT_ALIASES
                            .directionDeg
                    ),
                    null
                ),

            willRain:
                rawPrediction
                    .willRain !==
                    undefined
                    ? Boolean(
                        rawPrediction
                            .willRain
                    )
                    : (
                        (
                            probability ??
                            0
                        ) >= 30 &&
                        arrival
                            .arrivalMinutes !==
                            null
                    ),

            accepted:
                (
                    confidence ??
                    0
                ) >=
                integrationApi
                    .getConfiguration()
                    .minimumPredictionConfidence,

            cycleId:
                context.cycleId ||
                null,

            engineMethod:
                context
                    .engineMethod ||
                null,

            generatedAt,

            generatedAtIso:
                new Date(
                    generatedAt
                ).toISOString(),

            diagnostics:
                rawPrediction
                    .diagnostics ||
                rawPrediction
                    .analysis ||
                null,

            horizons:
                rawPrediction
                    .horizons ||
                rawPrediction
                    .forecastPoints ||
                rawPrediction
                    .predictions ||
                null,

            raw:
                prediction
        };

        return result;
    }

    /**
     * Find matching city for prediction.
     *
     * @param {Object} prediction
     * @param {Array<Object>} cities
     * @param {number} index
     * @returns {Object|null}
     */
    function findPredictionCity(
        prediction,
        cities,
        index = 0
    ) {
        if (!Array.isArray(cities)) {
            return null;
        }

        const cityId =
            readPredictionAlias(
                prediction,
                PREDICTION_RESULT_ALIASES
                    .cityId
            );

        if (cityId !== undefined) {
            const matchedById =
                cities.find(
                    (city) =>
                        String(city.id) ===
                        String(cityId)
                );

            if (matchedById) {
                return matchedById;
            }
        }

        const cityName =
            String(
                readPredictionAlias(
                    prediction,
                    PREDICTION_RESULT_ALIASES
                        .cityName
                ) ||
                ''
            )
                .trim()
                .toLowerCase();

        const cityNameAr =
            String(
                readPredictionAlias(
                    prediction,
                    PREDICTION_RESULT_ALIASES
                        .cityNameAr
                ) ||
                ''
            )
                .trim()
                .toLowerCase();

        if (
            cityName ||
            cityNameAr
        ) {
            const matchedByName =
                cities.find(
                    (city) => {
                        const candidateNames =
                            [
                                city.name,
                                city.nameAr
                            ]
                                .filter(Boolean)
                                .map(
                                    (value) =>
                                        String(value)
                                            .trim()
                                            .toLowerCase()
                                );

                        return (
                            cityName &&
                            candidateNames.includes(
                                cityName
                            )
                        ) ||
                        (
                            cityNameAr &&
                            candidateNames.includes(
                                cityNameAr
                            )
                        );
                    }
                );

            if (matchedByName) {
                return matchedByName;
            }
        }

        return cities[index] ||
            null;
    }

    /**
     * Execute prediction using batch method.
     *
     * @param {Object} engine
     * @param {Object} unifiedInput
     * @param {Object} options
     * @returns {Promise<Object>}
     */
    async function executeBatchPrediction(
        engine,
        unifiedInput,
        options = {}
    ) {
        const resolvedMethod =
            resolvePredictionMethod(
                engine,
                BATCH_PREDICTION_METHODS
            );

        if (
            !resolvedMethod.method
        ) {
            const error =
                new Error(
                    'No compatible batch prediction method was found.'
                );

            error.code =
                'RAIN_ARRIVAL_BATCH_METHOD_NOT_FOUND';

            throw error;
        }

        const payload =
            buildBatchPredictionPayload(
                unifiedInput,
                options
            );

        const timeoutMs =
            Math.max(
                1000,
                toFiniteNumber(
                    options.timeoutMs,
                    integrationApi
                        .getConfiguration()
                        .predictionTimeoutMs
                )
            );

        const response =
            await withTimeout(
                () =>
                    resolvedMethod
                        .method(
                            payload
                        ),
                timeoutMs,
                `Batch prediction using ${resolvedMethod.methodName}`
            );

        const responseArray =
            predictionResponseToArray(
                response
            );

        const predictions =
            responseArray.map(
                (
                    prediction,
                    index
                ) => {
                    const city =
                        findPredictionCity(
                            prediction,
                            unifiedInput
                                .cities,
                            index
                        );

                    return normalizePredictionResult(
                        prediction,
                        city,
                        {
                            cycleId:
                                options
                                    .cycleId ||
                                unifiedInput
                                    .cycleId,

                            engineMethod:
                                resolvedMethod
                                    .methodName,

                            defaultConfidence:
                                unifiedInput
                                    .sourceCollectionSummary
                                    ? unifiedInput
                                        .sourceCollectionSummary
                                        .weightedConfidence
                                    : 50
                        }
                    );
                }
            );

        return {
            mode:
                'batch',

            methodName:
                resolvedMethod
                    .methodName,

            payload,

            rawResponse:
                response,

            predictions
        };
    }

    /**
     * Execute one city prediction.
     *
     * @param {Object} engine
     * @param {Object} city
     * @param {Object} unifiedInput
     * @param {Object} options
     * @returns {Promise<Object>}
     */
    async function executeSingleCityPrediction(
        engine,
        city,
        unifiedInput,
        options = {}
    ) {
        const resolvedMethod =
            resolvePredictionMethod(
                engine,
                SINGLE_CITY_PREDICTION_METHODS
            );

        if (
            !resolvedMethod.method
        ) {
            const error =
                new Error(
                    'No compatible single-city prediction method was found.'
                );

            error.code =
                'RAIN_ARRIVAL_SINGLE_CITY_METHOD_NOT_FOUND';

            throw error;
        }

        const payload =
            buildCityPredictionPayload(
                city,
                unifiedInput,
                options
            );

        const timeoutMs =
            Math.max(
                1000,
                toFiniteNumber(
                    options.timeoutMs,
                    integrationApi
                        .getConfiguration()
                        .predictionTimeoutMs
                )
            );

        const response =
            await withTimeout(
                () =>
                    resolvedMethod
                        .method(
                            payload
                        ),
                timeoutMs,
                `City prediction for ${city.nameAr || city.name}`
            );

        const responseArray =
            predictionResponseToArray(
                response
            );

        const primaryResponse =
            responseArray[0] ||
            response ||
            {};

        return normalizePredictionResult(
            primaryResponse,
            city,
            {
                cycleId:
                    options.cycleId ||
                    unifiedInput
                        .cycleId,

                engineMethod:
                    resolvedMethod
                        .methodName,

                defaultConfidence:
                    unifiedInput
                        .sourceCollectionSummary
                        ? unifiedInput
                            .sourceCollectionSummary
                            .weightedConfidence
                        : 50
            }
        );
    }

    /**
     * Execute predictions city-by-city.
     *
     * @param {Object} engine
     * @param {Object} unifiedInput
     * @param {Object} options
     * @returns {Promise<Object>}
     */
    async function executeSingleCityPredictions(
        engine,
        unifiedInput,
        options = {}
    ) {
        const predictions = [];
        const failures = [];

        const parallel =
            options.parallelCities !==
            false;

        if (parallel) {
            const settled =
                await Promise.allSettled(
                    unifiedInput
                        .cities
                        .map(
                            (city) =>
                                executeSingleCityPrediction(
                                    engine,
                                    city,
                                    unifiedInput,
                                    options
                                )
                        )
                );

            settled.forEach(
                (
                    result,
                    index
                ) => {
                    if (
                        result.status ===
                        'fulfilled'
                    ) {
                        predictions.push(
                            result.value
                        );

                        return;
                    }

                    failures.push({
                        cityId:
                            unifiedInput
                                .cities[
                                index
                            ]
                                ? unifiedInput
                                    .cities[
                                    index
                                ].id
                                : null,

                        error:
                            normalizeError(
                                result.reason,
                                {
                                    phase:
                                        'single_city_prediction'
                                }
                            )
                    });
                }
            );
        } else {
            for (
                const city
                of unifiedInput.cities
            ) {
                try {
                    predictions.push(
                        await executeSingleCityPrediction(
                            engine,
                            city,
                            unifiedInput,
                            options
                        )
                    );
                } catch (error) {
                    failures.push({
                        cityId:
                            city.id,

                        error:
                            normalizeError(
                                error,
                                {
                                    phase:
                                        'single_city_prediction',

                                    cityId:
                                        city.id
                                }
                            )
                    });
                }
            }
        }

        const method =
            resolvePredictionMethod(
                engine,
                SINGLE_CITY_PREDICTION_METHODS
            );

        return {
            mode:
                'single_city',

            methodName:
                method.methodName,

            predictions,

            failures
        };
    }

    /**
     * Store latest prediction results.
     *
     * @param {Array<Object>} predictions
     */
    function storeLatestPredictions(
        predictions
    ) {
        runtimeState
            .latestPredictions
            .clear();

        for (
            const prediction
            of predictions
        ) {
            if (
                !prediction ||
                !prediction.cityId
            ) {
                continue;
            }

            runtimeState
                .latestPredictions
                .set(
                    prediction.cityId,
                    prediction
                );
        }
    }

    /**
     * Build prediction execution summary.
     *
     * @param {Array<Object>} predictions
     * @param {Array<Object>} failures
     * @returns {Object}
     */
    function summarizePredictions(
        predictions,
        failures = []
    ) {
        const accepted =
            predictions.filter(
                (prediction) =>
                    prediction.accepted
            );

        const rainExpected =
            predictions.filter(
                (prediction) =>
                    prediction.willRain
            );

        const immediateRain =
            rainExpected.filter(
                (prediction) =>
                    prediction
                        .arrivalMinutes !==
                        null &&
                    prediction
                        .arrivalMinutes <=
                        30
            );

        const highRisk =
            predictions.filter(
                (prediction) =>
                    [
                        'high',
                        'extreme'
                    ].includes(
                        String(
                            prediction
                                .riskLevel
                        ).toLowerCase()
                    )
            );

        const averageConfidence =
            predictions.length > 0
                ? predictions.reduce(
                    (
                        total,
                        prediction
                    ) =>
                        total +
                        toFiniteNumber(
                            prediction
                                .confidence,
                            0
                        ),
                    0
                ) /
                predictions.length
                : 0;

        return {
            totalPredictions:
                predictions.length,

            acceptedPredictions:
                accepted.length,

            rejectedPredictions:
                predictions.length -
                accepted.length,

            expectedRainCities:
                rainExpected.length,

            immediateRainCities:
                immediateRain.length,

            highRiskCities:
                highRisk.length,

            failedCities:
                failures.length,

            averageConfidence:
                clamp(
                    averageConfidence,
                    0,
                    100
                ),

            rainExpectedCityIds:
                rainExpected.map(
                    (prediction) =>
                        prediction.cityId
                ),

            highRiskCityIds:
                highRisk.map(
                    (prediction) =>
                        prediction.cityId
                )
        };
    }

    /**
     * Execute the prediction engine.
     *
     * @param {Object} unifiedInput
     * @param {Object} options
     * @returns {Promise<Object>}
     */
    async function executePredictions(
        unifiedInput,
        options = {}
    ) {
        if (
            !unifiedInput ||
            !Array.isArray(
                unifiedInput.cities
            )
        ) {
            throw new TypeError(
                'A valid unified prediction input is required.'
            );
        }

        const predictionRunId =
            createRuntimeId(
                'prediction_run'
            );

        const startedAt =
            Date.now();

        runtimeState
            .statistics
            .predictionRequests +=
            1;

        try {
            const engine =
                await resolvePredictionEngine(
                    options
                );

            const capabilities =
                detectPredictionCapabilities(
                    engine
                );

            let executionResult;

            if (
                capabilities
                    .supportsBatch &&
                options.forceSingleCity !==
                    true
            ) {
                try {
                    executionResult =
                        await executeBatchPrediction(
                            engine,
                            unifiedInput,
                            {
                                ...options,

                                cycleId:
                                    options
                                        .cycleId ||
                                    unifiedInput
                                        .cycleId
                            }
                        );
                } catch (batchError) {
                    if (
                        !capabilities
                            .supportsSingleCity ||
                        options
                            .disableBatchFallback ===
                            true
                    ) {
                        throw batchError;
                    }

                    log(
                        'debug',
                        'Batch prediction failed. Falling back to city-by-city execution.',
                        normalizeError(
                            batchError,
                            {
                                predictionRunId
                            }
                        )
                    );

                    executionResult =
                        await executeSingleCityPredictions(
                            engine,
                            unifiedInput,
                            {
                                ...options,

                                cycleId:
                                    options
                                        .cycleId ||
                                    unifiedInput
                                        .cycleId
                            }
                        );

                    executionResult
                        .batchFallbackError =
                        normalizeError(
                            batchError,
                            {
                                predictionRunId
                            }
                        );
                }
            } else if (
                capabilities
                    .supportsSingleCity
            ) {
                executionResult =
                    await executeSingleCityPredictions(
                        engine,
                        unifiedInput,
                        {
                            ...options,

                            cycleId:
                                options
                                    .cycleId ||
                                unifiedInput
                                    .cycleId
                        }
                    );
            } else {
                const error =
                    new Error(
                        'Prediction engine exposes no compatible prediction method.'
                    );

                error.code =
                    'RAIN_ARRIVAL_NO_COMPATIBLE_PREDICTION_METHOD';

                throw error;
            }

            const predictions =
                Array.isArray(
                    executionResult
                        .predictions
                )
                    ? executionResult
                        .predictions
                    : [];

            const failures =
                Array.isArray(
                    executionResult
                        .failures
                )
                    ? executionResult
                        .failures
                    : [];

            storeLatestPredictions(
                predictions
            );

            runtimeState
                .statistics
                .predictionSuccesses +=
                1;

            const completedAt =
                Date.now();

            const result = {
                id:
                    predictionRunId,

                success:
                    predictions.length >
                    0,

                mode:
                    executionResult.mode,

                engineMethod:
                    executionResult
                        .methodName,

                capabilities,

                predictions,

                failures,

                summary:
                    summarizePredictions(
                        predictions,
                        failures
                    ),

                unifiedInputId:
                    unifiedInput.id,

                cycleId:
                    options.cycleId ||
                    unifiedInput
                        .cycleId ||
                    null,

                startedAt,

                startedAtIso:
                    new Date(
                        startedAt
                    ).toISOString(),

                completedAt,

                completedAtIso:
                    new Date(
                        completedAt
                    ).toISOString(),

                durationMs:
                    completedAt -
                    startedAt,

                fallbackError:
                    executionResult
                        .batchFallbackError ||
                    null,

                rawResponse:
                    options
                        .includeRawResponse
                        ? executionResult
                            .rawResponse ||
                            null
                        : null
            };

            runtimeState
                .lastPredictionRun =
                result;

            dispatchIntegrationEvent(
                integrationApi
                    .getConfiguration()
                    .eventNames
                    .predictionUpdated,
                {
                    predictionRunId:
                        result.id,

                    cycleId:
                        result.cycleId,

                    mode:
                        result.mode,

                    engineMethod:
                        result
                            .engineMethod,

                    summary:
                        result.summary,

                    durationMs:
                        result
                            .durationMs
                }
            );

            return result;
        } catch (error) {
            runtimeState
                .statistics
                .predictionFailures +=
                1;

            const completedAt =
                Date.now();

            const normalizedError =
                normalizeError(
                    error,
                    {
                        predictionRunId,

                        cycleId:
                            options
                                .cycleId ||
                            unifiedInput
                                .cycleId ||
                            null
                    }
                );

            const failedResult = {
                id:
                    predictionRunId,

                success:
                    false,

                predictions:
                    [],

                failures: [
                    {
                        error:
                            normalizedError
                    }
                ],

                summary:
                    summarizePredictions(
                        [],
                        [
                            {
                                error:
                                    normalizedError
                            }
                        ]
                    ),

                error:
                    normalizedError,

                unifiedInputId:
                    unifiedInput.id,

                cycleId:
                    options.cycleId ||
                    unifiedInput
                        .cycleId ||
                    null,

                startedAt,

                startedAtIso:
                    new Date(
                        startedAt
                    ).toISOString(),

                completedAt,

                completedAtIso:
                    new Date(
                        completedAt
                    ).toISOString(),

                durationMs:
                    completedAt -
                    startedAt
            };

            runtimeState
                .lastPredictionRun =
                failedResult;

            log(
                'error',
                'Rain arrival prediction execution failed.',
                normalizedError
            );

            throw error;
        }
    }

    /**
     * Collect data and execute predictions.
     *
     * @param {Object} options
     * @returns {Promise<Object>}
     */
    async function collectAndPredict(
        options = {}
    ) {
        if (
            typeof integrationApi
                .collectUnifiedPredictionInput !==
                'function'
        ) {
            throw new Error(
                'Unified prediction input collection is unavailable.'
            );
        }

        const collection =
            await integrationApi
                .collectUnifiedPredictionInput(
                    options
                );

        const predictionRun =
            await executePredictions(
                collection
                    .predictionInput,
                {
                    ...options,

                    cycleId:
                        options.cycleId ||
                        collection
                            .predictionInput
                            .cycleId
                }
            );

        return {
            success:
                predictionRun.success,

            sourceCollection:
                collection
                    .sourceCollection,

            predictionInput:
                collection
                    .predictionInput,

            predictionRun,

            createdAt:
                Date.now(),

            createdAtIso:
                nowIso()
        };
    }

    /**
     * Return latest prediction for one city.
     *
     * @param {string} cityId
     * @returns {Object|null}
     */
    function getLatestPrediction(
        cityId
    ) {
        if (
            typeof cityId !==
                'string' &&
            typeof cityId !==
                'number'
        ) {
            return null;
        }

        return runtimeState
            .latestPredictions
            .get(
                String(cityId)
            ) ||
            runtimeState
                .latestPredictions
                .get(
                    cityId
                ) ||
            null;
    }

    /**
     * Return all latest predictions.
     *
     * @returns {Array<Object>}
     */
    function getLatestPredictions() {
        return Array.from(
            runtimeState
                .latestPredictions
                .values()
        );
    }

    /**
     * Return latest prediction run.
     *
     * @returns {Object|null}
     */
    function getLastPredictionRun() {
        return runtimeState
            .lastPredictionRun ||
            null;
    }

    /**
     * Extend runtime state.
     */
    if (
        !Object.prototype
            .hasOwnProperty
            .call(
                runtimeState,
                'lastPredictionRun'
            )
    ) {
        runtimeState
            .lastPredictionRun =
            null;
    }

    /**
     * Extend public API.
     */
    integrationApi
        .detectPredictionCapabilities =
        detectPredictionCapabilities;

    integrationApi
        .buildCityPredictionPayload =
        buildCityPredictionPayload;

    integrationApi
        .buildBatchPredictionPayload =
        buildBatchPredictionPayload;

    integrationApi
        .executeSingleCityPrediction =
        executeSingleCityPrediction;

    integrationApi
        .executePredictions =
        executePredictions;

    integrationApi
        .collectAndPredict =
        collectAndPredict;

    integrationApi
        .getLatestPrediction =
        getLatestPrediction;

    integrationApi
        .getLatestPredictions =
        getLatestPredictions;

    integrationApi
        .getLastPredictionRun =
        getLastPredictionRun;

    integrationApi
        .metadata = {
            ...integrationApi
                .metadata,

            currentPart:
                '2.1D-1',

            nextPart:
                '2.1D-2',

            status:
                'in_progress',

            productionReady:
                false,

            moduleClosed:
                true,

            capabilities: [
                ...new Set([
                    ...(
                        Array.isArray(
                            integrationApi
                                .metadata
                                .capabilities
                        )
                            ? integrationApi
                                .metadata
                                .capabilities
                            : []
                    ),

                    'prediction_method_discovery',
                    'batch_prediction_execution',
                    'single_city_prediction_execution',
                    'batch_fallback',
                    'prediction_timeout_protection',
                    'prediction_result_normalization',
                    'prediction_risk_inference',
                    'latest_prediction_storage',
                    'prediction_statistics',
                    'collect_and_predict'
                ])
            ]
        };

    /**
     * Extend internal API.
     */
    Object.assign(
        integrationApi._internals,
        {
            PREDICTION_HORIZONS_MINUTES,
            BATCH_PREDICTION_METHODS,
            SINGLE_CITY_PREDICTION_METHODS,
            PREDICTION_RESULT_ALIASES,

            readPredictionAlias,
            resolvePredictionEngine,
            resolvePredictionMethod,
            normalizePredictionHorizons,
            predictionResponseToArray,
            normalizeArrivalTime,
            inferPredictionRiskLevel,
            normalizePredictionResult,
            findPredictionCity,
            executeBatchPrediction,
            executeSingleCityPredictions,
            storeLatestPredictions,
            summarizePredictions
        }
    );

    log(
        'info',
        'Rain arrival integration Part 2.1D-1 loaded.',
        {
            engineAvailable:
                Boolean(
                    integrationApi
                        .getEngine()
                ),

            latestPredictionCount:
                runtimeState
                    .latestPredictions
                    .size
        }
    );
})(
    typeof globalThis !==
        'undefined'
        ? globalThis
        : (
            typeof window !==
                'undefined'
                ? window
                : this
        )
);

/**
 * RainGuard AI V32
 * Rain Arrival Integration Engine
 *
 * Part:
 * 2.1D-2
 *
 * Responsibilities:
 * - Execute complete integration cycles
 * - Prevent overlapping cycles
 * - Schedule automatic prediction cycles
 * - Provide start, stop and restart controls
 * - Manage delayed and immediate execution
 * - Track cycle history and runtime health
 */

(function rainArrivalIntegrationV32CycleScheduler(globalObject) {
    'use strict';

    if (
        !globalObject ||
        !globalObject.RainGuardAI ||
        !globalObject.RainGuardAI.V32 ||
        !globalObject.RainGuardAI.V32
            .rainArrivalIntegration
    ) {
        throw new Error(
            'Rain Arrival Integration Part 2.1D-1 must be loaded before Part 2.1D-2.'
        );
    }

    const integrationApi =
        globalObject
            .RainGuardAI
            .V32
            .rainArrivalIntegration;

    const runtimeState =
        integrationApi._state;

    const internal =
        integrationApi._internals;

    const {
        isPlainObject,
        toFiniteNumber,
        clamp,
        createRuntimeId,
        nowIso,
        normalizeError,
        dispatchIntegrationEvent,
        log
    } = internal;

    /**
     * Maximum retained cycle history.
     */
    const MAXIMUM_CYCLE_HISTORY =
        50;

    /**
     * Cycle execution states.
     */
    const CYCLE_STATES =
        Object.freeze({
            IDLE:
                'idle',

            PREPARING:
                'preparing',

            COLLECTING:
                'collecting',

            PREDICTING:
                'predicting',

            DISTRIBUTING:
                'distributing',

            COMPLETED:
                'completed',

            FAILED:
                'failed',

            SKIPPED:
                'skipped',

            STOPPED:
                'stopped'
        });

    /**
     * Stop reasons.
     */
    const STOP_REASONS =
        Object.freeze({
            MANUAL:
                'manual',

            RESTART:
                'restart',

            ERROR:
                'error',

            DESTROY:
                'destroy',

            PAGE_HIDDEN:
                'page_hidden',

            CONFIGURATION:
                'configuration'
        });

    /**
     * Ensure scheduler state exists.
     */
    function ensureSchedulerState() {
        if (
            !runtimeState.scheduler ||
            typeof runtimeState
                .scheduler !==
                'object'
        ) {
            runtimeState.scheduler = {
                state:
                    CYCLE_STATES.IDLE,

                active:
                    false,

                intervalId:
                    null,

                timeoutId:
                    null,

                nextRunAt:
                    null,

                nextRunAtIso:
                    null,

                lastScheduledAt:
                    null,

                lastScheduledAtIso:
                    null,

                currentCycleId:
                    null,

                currentCyclePromise:
                    null,

                currentCycleController:
                    null,

                lastCycle:
                    null,

                cycleHistory:
                    [],

                consecutiveFailures:
                    0,

                consecutiveSuccesses:
                    0,

                lastStartOptions:
                    {},

                lastStopReason:
                    null,

                lastRestartAt:
                    null,

                lastRestartAtIso:
                    null
            };
        }

        if (
            !Array.isArray(
                runtimeState
                    .scheduler
                    .cycleHistory
            )
        ) {
            runtimeState
                .scheduler
                .cycleHistory =
                [];
        }

        return runtimeState.scheduler;
    }

    /**
     * Update scheduler state.
     *
     * @param {string} state
     * @param {Object} details
     */
    function setSchedulerState(
        state,
        details = {}
    ) {
        const scheduler =
            ensureSchedulerState();

        scheduler.state =
            state;

        scheduler.stateUpdatedAt =
            Date.now();

        scheduler.stateUpdatedAtIso =
            new Date(
                scheduler
                    .stateUpdatedAt
            ).toISOString();

        scheduler.stateDetails =
            isPlainObject(details)
                ? {
                    ...details
                }
                : {};
    }

    /**
     * Resolve integration interval.
     *
     * @param {Object} options
     * @returns {number}
     */
    function resolveCycleIntervalMs(
        options = {}
    ) {
        const configuration =
            integrationApi
                .getConfiguration();

        return Math.max(
            5000,
            toFiniteNumber(
                options.intervalMs,
                configuration
                    .integrationIntervalMs
            )
        );
    }

    /**
     * Resolve initial execution delay.
     *
     * @param {Object} options
     * @returns {number}
     */
    function resolveInitialDelayMs(
        options = {}
    ) {
        if (
            options.immediate ===
            true
        ) {
            return 0;
        }

        if (
            options.initialDelayMs !==
            undefined
        ) {
            return Math.max(
                0,
                toFiniteNumber(
                    options
                        .initialDelayMs,
                    0
                )
            );
        }

        return 0;
    }

    /**
     * Clear active scheduler timers.
     */
    function clearSchedulerTimers() {
        const scheduler =
            ensureSchedulerState();

        if (
            scheduler.intervalId !==
            null
        ) {
            globalObject
                .clearInterval(
                    scheduler
                        .intervalId
                );

            scheduler.intervalId =
                null;
        }

        if (
            scheduler.timeoutId !==
            null
        ) {
            globalObject
                .clearTimeout(
                    scheduler
                        .timeoutId
                );

            scheduler.timeoutId =
                null;
        }

        scheduler.nextRunAt =
            null;

        scheduler.nextRunAtIso =
            null;
    }

    /**
     * Store cycle history item.
     *
     * @param {Object} cycleResult
     */
    function storeCycleHistory(
        cycleResult
    ) {
        const scheduler =
            ensureSchedulerState();

        scheduler
            .cycleHistory
            .unshift(
                cycleResult
            );

        if (
            scheduler
                .cycleHistory
                .length >
            MAXIMUM_CYCLE_HISTORY
        ) {
            scheduler
                .cycleHistory
                .length =
                MAXIMUM_CYCLE_HISTORY;
        }

        scheduler.lastCycle =
            cycleResult;
    }

    /**
     * Return compact cycle result for events.
     *
     * @param {Object} cycleResult
     * @returns {Object}
     */
    function createCycleEventPayload(
        cycleResult
    ) {
        return {
            id:
                cycleResult.id,

            success:
                cycleResult.success,

            state:
                cycleResult.state,

            reason:
                cycleResult.reason,

            startedAt:
                cycleResult.startedAt,

            completedAt:
                cycleResult.completedAt,

            durationMs:
                cycleResult.durationMs,

            predictionSummary:
                cycleResult
                    .predictionRun &&
                cycleResult
                    .predictionRun
                    .summary
                    ? cycleResult
                        .predictionRun
                        .summary
                    : null,

            sourceSummary:
                cycleResult
                    .sourceCollection &&
                cycleResult
                    .sourceCollection
                    .summary
                    ? cycleResult
                        .sourceCollection
                        .summary
                    : null,

            error:
                cycleResult.error ||
                null
        };
    }

    /**
     * Execute result consumers.
     *
     * @param {Object} cycleResult
     * @param {Object} options
     * @returns {Promise<Object>}
     */
    async function distributeCycleResult(
        cycleResult,
        options = {}
    ) {
        const consumers =
            Array.from(
                runtimeState
                    .resultConsumers
                    .values()
            )
                .filter(
                    (consumer) =>
                        consumer &&
                        consumer.enabled !==
                            false &&
                        typeof consumer
                            .consumer ===
                            'function'
                )
                .sort(
                    (left, right) =>
                        toFiniteNumber(
                            right.priority,
                            0
                        ) -
                        toFiniteNumber(
                            left.priority,
                            0
                        )
                );

        if (
            consumers.length === 0
        ) {
            return {
                total:
                    0,

                successful:
                    0,

                failed:
                    0,

                results:
                    []
            };
        }

        const executionContext = {
            cycleId:
                cycleResult.id,

            predictions:
                cycleResult
                    .predictionRun
                    ? cycleResult
                        .predictionRun
                        .predictions
                    : [],

            predictionRun:
                cycleResult
                    .predictionRun ||
                null,

            predictionInput:
                cycleResult
                    .predictionInput ||
                null,

            sourceCollection:
                cycleResult
                    .sourceCollection ||
                null,

            platformSnapshot:
                cycleResult
                    .platformSnapshot ||
                null,

            cycleResult,

            integrationVersion:
                'V32',

            distributedAt:
                Date.now(),

            distributedAtIso:
                nowIso(),

            options
        };

        const settled =
            await Promise.allSettled(
                consumers.map(
                    (consumer) =>
                        Promise.resolve(
                            consumer.consumer({
                                ...executionContext,

                                consumer:
                                    consumer.name,

                                consumerType:
                                    consumer
                                        .consumerType
                            })
                        )
                )
            );

        const results =
            settled.map(
                (
                    result,
                    index
                ) => {
                    const consumer =
                        consumers[index];

                    if (
                        result.status ===
                        'fulfilled'
                    ) {
                        return {
                            consumer:
                                consumer.name,

                            success:
                                true,

                            value:
                                result.value
                        };
                    }

                    return {
                        consumer:
                            consumer.name,

                        success:
                            false,

                        error:
                            normalizeError(
                                result.reason,
                                {
                                    consumer:
                                        consumer.name,

                                    cycleId:
                                        cycleResult.id
                                }
                            )
                    };
                }
            );

        return {
            total:
                results.length,

            successful:
                results.filter(
                    (result) =>
                        result.success
                ).length,

            failed:
                results.filter(
                    (result) =>
                        !result.success
                ).length,

            results
        };
    }

    /**
     * Determine whether the current cycle may start.
     *
     * @param {Object} options
     * @returns {Object}
     */
    function canStartCycle(
        options = {}
    ) {
        const scheduler =
            ensureSchedulerState();

        if (
            runtimeState
                .cycleInProgress ||
            scheduler
                .currentCyclePromise
        ) {
            if (
                options.allowOverlap ===
                true
            ) {
                return {
                    allowed:
                        true,

                    reason:
                        null
                };
            }

            return {
                allowed:
                    false,

                reason:
                    'cycle_already_in_progress'
            };
        }

        if (
            runtimeState.running ===
                false &&
            options.ignoreRunningState !==
                true &&
            options.manual !==
                true
        ) {
            return {
                allowed:
                    false,

                reason:
                    'integration_not_running'
            };
        }

        return {
            allowed:
                true,

            reason:
                null
        };
    }

    /**
     * Create skipped cycle result.
     *
     * @param {string} reason
     * @param {Object} options
     * @returns {Object}
     */
    function createSkippedCycleResult(
        reason,
        options = {}
    ) {
        const timestamp =
            Date.now();

        return {
            id:
                createRuntimeId(
                    'cycle_skipped'
                ),

            success:
                false,

            skipped:
                true,

            state:
                CYCLE_STATES.SKIPPED,

            reason,

            requestedReason:
                options.reason ||
                null,

            startedAt:
                timestamp,

            startedAtIso:
                new Date(
                    timestamp
                ).toISOString(),

            completedAt:
                timestamp,

            completedAtIso:
                new Date(
                    timestamp
                ).toISOString(),

            durationMs:
                0
        };
    }

    /**
     * Execute one complete integration cycle.
     *
     * @param {Object} options
     * @returns {Promise<Object>}
     */
    async function executeCycle(
        options = {}
    ) {
        const scheduler =
            ensureSchedulerState();

        const permission =
            canStartCycle(
                options
            );

        if (!permission.allowed) {
            const skipped =
                createSkippedCycleResult(
                    permission.reason,
                    options
                );

            runtimeState
                .statistics
                .skippedCycles =
                (
                    runtimeState
                        .statistics
                        .skippedCycles ||
                    0
                ) + 1;

            storeCycleHistory(
                skipped
            );

            return skipped;
        }

        const cycleId =
            options.cycleId ||
            createRuntimeId(
                'integration_cycle'
            );

        const startedAt =
            Date.now();

        runtimeState
            .cycleInProgress =
            true;

        runtimeState
            .lastCycleStartedAt =
            startedAt;

        runtimeState
            .cycleCount +=
            1;

        scheduler.currentCycleId =
            cycleId;

        setSchedulerState(
            CYCLE_STATES.PREPARING,
            {
                cycleId,
                reason:
                    options.reason ||
                    'scheduled'
            }
        );

        const cyclePromise =
            (async () => {
                let sourceCollection =
                    null;

                let predictionInput =
                    null;

                let predictionRun =
                    null;

                let distribution =
                    null;

                let platformSnapshot =
                    null;

                try {
                    if (
                        !runtimeState
                            .initialized
                    ) {
                        await integrationApi
                            .initialize(
                                options
                            );
                    }

                    if (
                        typeof integrationApi
                            .registerAutomaticProviders ===
                            'function'
                    ) {
                        integrationApi
                            .registerAutomaticProviders(
                                options
                                    .providers ||
                                {}
                            );
                    }

                    if (
                        typeof integrationApi
                            .registerBuiltInSources ===
                            'function' &&
                        (
                            runtimeState
                                .sources
                                .size === 0 ||
                            options
                                .refreshSources ===
                                true
                        )
                    ) {
                        if (
                            options
                                .refreshSources ===
                                true &&
                            typeof integrationApi
                                .refreshBuiltInSources ===
                                'function'
                        ) {
                            integrationApi
                                .refreshBuiltInSources(
                                    options
                                        .sources ||
                                    {}
                                );
                        } else {
                            integrationApi
                                .registerBuiltInSources(
                                    options
                                        .sources ||
                                    {}
                                );
                        }
                    }

                    setSchedulerState(
                        CYCLE_STATES.COLLECTING,
                        {
                            cycleId
                        }
                    );

                    if (
                        typeof integrationApi
                            .collectUnifiedPredictionInput !==
                            'function'
                    ) {
                        throw new Error(
                            'Unified data collection API is unavailable.'
                        );
                    }

                    const collection =
                        await integrationApi
                            .collectUnifiedPredictionInput({
                                ...options,

                                cycleId,

                                reason:
                                    options.reason ||
                                    'integration_cycle'
                            });

                    sourceCollection =
                        collection
                            .sourceCollection;

                    predictionInput =
                        collection
                            .predictionInput;

                    platformSnapshot =
                        sourceCollection
                            ? sourceCollection
                                .platformSnapshot
                            : null;

                    setSchedulerState(
                        CYCLE_STATES.PREDICTING,
                        {
                            cycleId
                        }
                    );

                    predictionRun =
                        await integrationApi
                            .executePredictions(
                                predictionInput,
                                {
                                    ...options,

                                    cycleId
                                }
                            );

                    const cycleResult = {
                        id:
                            cycleId,

                        success:
                            Boolean(
                                predictionRun &&
                                predictionRun
                                    .success
                            ),

                        state:
                            CYCLE_STATES
                                .COMPLETED,

                        reason:
                            options.reason ||
                            'scheduled',

                        sourceCollection,

                        predictionInput,

                        predictionRun,

                        platformSnapshot,

                        startedAt,

                        startedAtIso:
                            new Date(
                                startedAt
                            ).toISOString(),

                        completedAt:
                            null,

                        completedAtIso:
                            null,

                        durationMs:
                            null,

                        distribution:
                            null
                    };

                    if (
                        options
                            .distributeResults !==
                            false
                    ) {
                        setSchedulerState(
                            CYCLE_STATES.DISTRIBUTING,
                            {
                                cycleId
                            }
                        );

                        distribution =
                            await distributeCycleResult(
                                cycleResult,
                                options
                            );

                        cycleResult
                            .distribution =
                            distribution;
                    }

                    const completedAt =
                        Date.now();

                    cycleResult.completedAt =
                        completedAt;

                    cycleResult.completedAtIso =
                        new Date(
                            completedAt
                        ).toISOString();

                    cycleResult.durationMs =
                        completedAt -
                        startedAt;

                    runtimeState
                        .successfulCycleCount +=
                        1;

                    runtimeState
                        .lastCycleCompletedAt =
                        completedAt;

                    runtimeState
                        .lastCycleDurationMs =
                        cycleResult
                            .durationMs;

                    runtimeState
                        .statistics
                        .successfulCycles =
                        (
                            runtimeState
                                .statistics
                                .successfulCycles ||
                            0
                        ) + 1;

                    scheduler
                        .consecutiveSuccesses +=
                        1;

                    scheduler
                        .consecutiveFailures =
                        0;

                    storeCycleHistory(
                        cycleResult
                    );

                    setSchedulerState(
                        CYCLE_STATES.COMPLETED,
                        {
                            cycleId,

                            durationMs:
                                cycleResult
                                    .durationMs
                        }
                    );

                    dispatchIntegrationEvent(
                        integrationApi
                            .getConfiguration()
                            .eventNames
                            .cycleCompleted,
                        createCycleEventPayload(
                            cycleResult
                        )
                    );

                    return cycleResult;
                } catch (error) {
                    const completedAt =
                        Date.now();

                    const normalizedError =
                        normalizeError(
                            error,
                            {
                                cycleId,

                                reason:
                                    options.reason ||
                                    'scheduled'
                            }
                        );

                    const failedResult = {
                        id:
                            cycleId,

                        success:
                            false,

                        state:
                            CYCLE_STATES.FAILED,

                        reason:
                            options.reason ||
                            'scheduled',

                        sourceCollection,

                        predictionInput,

                        predictionRun,

                        platformSnapshot,

                        distribution,

                        error:
                            normalizedError,

                        startedAt,

                        startedAtIso:
                            new Date(
                                startedAt
                            ).toISOString(),

                        completedAt,

                        completedAtIso:
                            new Date(
                                completedAt
                            ).toISOString(),

                        durationMs:
                            completedAt -
                            startedAt
                    };

                    runtimeState
                        .failedCycleCount +=
                        1;

                    runtimeState
                        .lastCycleCompletedAt =
                        completedAt;

                    runtimeState
                        .lastCycleDurationMs =
                        failedResult
                            .durationMs;

                    runtimeState
                        .statistics
                        .failedCycles =
                        (
                            runtimeState
                                .statistics
                                .failedCycles ||
                            0
                        ) + 1;

                    scheduler
                        .consecutiveFailures +=
                        1;

                    scheduler
                        .consecutiveSuccesses =
                        0;

                    storeCycleHistory(
                        failedResult
                    );

                    setSchedulerState(
                        CYCLE_STATES.FAILED,
                        {
                            cycleId,

                            error:
                                normalizedError
                        }
                    );

                    dispatchIntegrationEvent(
                        integrationApi
                            .getConfiguration()
                            .eventNames
                            .cycleFailed,
                        createCycleEventPayload(
                            failedResult
                        )
                    );

                    log(
                        'error',
                        'Rain arrival integration cycle failed.',
                        normalizedError
                    );

                    if (
                        options
                            .throwOnError ===
                            true
                    ) {
                        throw error;
                    }

                    return failedResult;
                } finally {
                    runtimeState
                        .cycleInProgress =
                        false;

                    scheduler
                        .currentCycleId =
                        null;

                    scheduler
                        .currentCyclePromise =
                        null;

                    if (
                        runtimeState.running &&
                        scheduler.active
                    ) {
                        setSchedulerState(
                            CYCLE_STATES.IDLE,
                            {
                                previousCycleId:
                                    cycleId
                            }
                        );
                    }
                }
            })();

        scheduler.currentCyclePromise =
            cyclePromise;

        return cyclePromise;
    }

    /**
     * Schedule the next one-time cycle.
     *
     * @param {number} delayMs
     * @param {Object} options
     */
    function scheduleNextCycle(
        delayMs,
        options = {}
    ) {
        const scheduler =
            ensureSchedulerState();

        if (
            !scheduler.active ||
            !runtimeState.running
        ) {
            return;
        }

        if (
            scheduler.timeoutId !==
            null
        ) {
            globalObject
                .clearTimeout(
                    scheduler
                        .timeoutId
                );
        }

        const normalizedDelay =
            Math.max(
                0,
                toFiniteNumber(
                    delayMs,
                    0
                )
            );

        scheduler.nextRunAt =
            Date.now() +
            normalizedDelay;

        scheduler.nextRunAtIso =
            new Date(
                scheduler.nextRunAt
            ).toISOString();

        scheduler.lastScheduledAt =
            Date.now();

        scheduler.lastScheduledAtIso =
            new Date(
                scheduler
                    .lastScheduledAt
            ).toISOString();

        scheduler.timeoutId =
            globalObject
                .setTimeout(
                    async () => {
                        scheduler.timeoutId =
                            null;

                        if (
                            !scheduler.active ||
                            !runtimeState.running
                        ) {
                            return;
                        }

                        await executeCycle({
                            ...scheduler
                                .lastStartOptions,

                            ...options,

                            reason:
                                options.reason ||
                                'scheduled'
                        });

                        if (
                            scheduler.active &&
                            runtimeState.running &&
                            options.repeat !==
                                false
                        ) {
                            scheduleNextCycle(
                                resolveCycleIntervalMs(
                                    scheduler
                                        .lastStartOptions
                                ),
                                {
                                    ...options,

                                    reason:
                                        'scheduled',

                                    repeat:
                                        true
                                }
                            );
                        }
                    },
                    normalizedDelay
                );
    }

    /**
     * Start automatic integration execution.
     *
     * @param {Object} options
     * @returns {Promise<Object>}
     */
    async function start(
        options = {}
    ) {
        const scheduler =
            ensureSchedulerState();

        if (
            runtimeState.running &&
            scheduler.active &&
            options.forceRestart !==
                true
        ) {
            return {
                started:
                    false,

                reused:
                    true,

                running:
                    true,

                scheduler:
                    getSchedulerStatus()
            };
        }

        if (
            options.forceRestart ===
            true &&
            runtimeState.running
        ) {
            await stop({
                reason:
                    STOP_REASONS.RESTART,

                waitForCurrentCycle:
                    options
                        .waitForCurrentCycle !==
                    false
            });
        }

        if (
            !runtimeState
                .initialized
        ) {
            await integrationApi
                .initialize(
                    options
                );
        }

        clearSchedulerTimers();

        runtimeState.running =
            true;

        runtimeState.startedAt =
            Date.now();

        runtimeState.stoppedAt =
            null;

        scheduler.active =
            true;

        scheduler.lastStartOptions =
            {
                ...options
            };

        scheduler.lastStopReason =
            null;

        setSchedulerState(
            CYCLE_STATES.IDLE,
            {
                startedAt:
                    runtimeState
                        .startedAt
            }
        );

        const intervalMs =
            resolveCycleIntervalMs(
                options
            );

        const initialDelayMs =
            resolveInitialDelayMs(
                options
            );

        scheduleNextCycle(
            initialDelayMs,
            {
                reason:
                    options.reason ||
                    (
                        initialDelayMs ===
                            0
                            ? 'start'
                            : 'delayed_start'
                    ),

                repeat:
                    options.repeat !==
                    false
            }
        );

        const result = {
            started:
                true,

            reused:
                false,

            running:
                true,

            intervalMs,

            initialDelayMs,

            startedAt:
                runtimeState
                    .startedAt,

            startedAtIso:
                new Date(
                    runtimeState
                        .startedAt
                ).toISOString(),

            nextRunAt:
                scheduler
                    .nextRunAt,

            nextRunAtIso:
                scheduler
                    .nextRunAtIso
        };

        dispatchIntegrationEvent(
            integrationApi
                .getConfiguration()
                .eventNames
                .started,
            result
        );

        log(
            'info',
            'Rain arrival integration scheduler started.',
            result
        );

        return result;
    }

    /**
     * Stop automatic integration execution.
     *
     * @param {Object} options
     * @returns {Promise<Object>}
     */
    async function stop(
        options = {}
    ) {
        const scheduler =
            ensureSchedulerState();

        const reason =
            options.reason ||
            STOP_REASONS.MANUAL;

        scheduler.active =
            false;

        runtimeState.running =
            false;

        runtimeState.stoppedAt =
            Date.now();

        scheduler.lastStopReason =
            reason;

        clearSchedulerTimers();

        if (
            options.waitForCurrentCycle ===
                true &&
            scheduler.currentCyclePromise
        ) {
            try {
                await scheduler
                    .currentCyclePromise;
            } catch (error) {
                log(
                    'debug',
                    'Current cycle failed while stopping.',
                    normalizeError(
                        error,
                        {
                            reason
                        }
                    )
                );
            }
        }

        setSchedulerState(
            CYCLE_STATES.STOPPED,
            {
                reason
            }
        );

        const result = {
            stopped:
                true,

            running:
                false,

            reason,

            stoppedAt:
                runtimeState
                    .stoppedAt,

            stoppedAtIso:
                new Date(
                    runtimeState
                        .stoppedAt
                ).toISOString(),

            currentCycleInProgress:
                Boolean(
                    runtimeState
                        .cycleInProgress
                )
        };

        dispatchIntegrationEvent(
            integrationApi
                .getConfiguration()
                .eventNames
                .stopped,
            result
        );

        log(
            'info',
            'Rain arrival integration scheduler stopped.',
            result
        );

        return result;
    }

    /**
     * Restart automatic execution.
     *
     * @param {Object} options
     * @returns {Promise<Object>}
     */
    async function restart(
        options = {}
    ) {
        const scheduler =
            ensureSchedulerState();

        await stop({
            reason:
                STOP_REASONS.RESTART,

            waitForCurrentCycle:
                options
                    .waitForCurrentCycle !==
                false
        });

        scheduler.lastRestartAt =
            Date.now();

        scheduler.lastRestartAtIso =
            new Date(
                scheduler
                    .lastRestartAt
            ).toISOString();

        return start({
            ...scheduler
                .lastStartOptions,

            ...options,

            forceRestart:
                false
        });
    }

    /**
     * Trigger immediate manual cycle.
     *
     * @param {Object} options
     * @returns {Promise<Object>}
     */
    async function runNow(
        options = {}
    ) {
        return executeCycle({
            ...options,

            manual:
                true,

            ignoreRunningState:
                true,

            reason:
                options.reason ||
                'manual'
        });
    }

    /**
     * Reschedule automatic cycles.
     *
     * @param {number} intervalMs
     * @param {Object} options
     * @returns {Object}
     */
    function reschedule(
        intervalMs,
        options = {}
    ) {
        const scheduler =
            ensureSchedulerState();

        const normalizedInterval =
            Math.max(
                5000,
                toFiniteNumber(
                    intervalMs,
                    resolveCycleIntervalMs()
                )
            );

        scheduler.lastStartOptions = {
            ...scheduler
                .lastStartOptions,

            ...options,

            intervalMs:
                normalizedInterval
        };

        if (
            scheduler.active &&
            runtimeState.running
        ) {
            clearSchedulerTimers();

            scheduleNextCycle(
                options.immediate
                    ? 0
                    : normalizedInterval,
                {
                    reason:
                        'rescheduled',

                    repeat:
                        true
                }
            );
        }

        return {
            rescheduled:
                true,

            intervalMs:
                normalizedInterval,

            active:
                scheduler.active,

            nextRunAt:
                scheduler.nextRunAt,

            nextRunAtIso:
                scheduler.nextRunAtIso
        };
    }

    /**
     * Return scheduler status.
     *
     * @returns {Object}
     */
    function getSchedulerStatus() {
        const scheduler =
            ensureSchedulerState();

        const now =
            Date.now();

        return {
            state:
                scheduler.state,

            active:
                scheduler.active,

            running:
                runtimeState.running,

            initialized:
                runtimeState
                    .initialized,

            cycleInProgress:
                runtimeState
                    .cycleInProgress,

            currentCycleId:
                scheduler
                    .currentCycleId,

            nextRunAt:
                scheduler.nextRunAt,

            nextRunAtIso:
                scheduler
                    .nextRunAtIso,

            millisecondsUntilNextRun:
                scheduler.nextRunAt
                    ? Math.max(
                        0,
                        scheduler
                            .nextRunAt -
                        now
                    )
                    : null,

            intervalMs:
                resolveCycleIntervalMs(
                    scheduler
                        .lastStartOptions
                ),

            lastStopReason:
                scheduler
                    .lastStopReason,

            lastRestartAt:
                scheduler
                    .lastRestartAt,

            lastRestartAtIso:
                scheduler
                    .lastRestartAtIso,

            consecutiveFailures:
                scheduler
                    .consecutiveFailures,

            consecutiveSuccesses:
                scheduler
                    .consecutiveSuccesses,

            cycleHistoryCount:
                scheduler
                    .cycleHistory
                    .length,

            lastCycle:
                scheduler
                    .lastCycle
                    ? {
                        id:
                            scheduler
                                .lastCycle
                                .id,

                        success:
                            scheduler
                                .lastCycle
                                .success,

                        state:
                            scheduler
                                .lastCycle
                                .state,

                        durationMs:
                            scheduler
                                .lastCycle
                                .durationMs,

                        completedAt:
                            scheduler
                                .lastCycle
                                .completedAt
                    }
                    : null
        };
    }

    /**
     * Return retained cycle history.
     *
     * @param {number} limit
     * @returns {Array<Object>}
     */
    function getCycleHistory(
        limit = 10
    ) {
        const scheduler =
            ensureSchedulerState();

        const normalizedLimit =
            clamp(
                Math.round(
                    toFiniteNumber(
                        limit,
                        10
                    )
                ),
                1,
                MAXIMUM_CYCLE_HISTORY
            );

        return scheduler
            .cycleHistory
            .slice(
                0,
                normalizedLimit
            );
    }

    /**
     * Clear retained cycle history.
     *
     * @returns {Object}
     */
    function clearCycleHistory() {
        const scheduler =
            ensureSchedulerState();

        const removed =
            scheduler
                .cycleHistory
                .length;

        scheduler.cycleHistory =
            [];

        scheduler.lastCycle =
            null;

        return {
            cleared:
                true,

            removed
        };
    }

    /**
     * Destroy scheduler resources.
     *
     * @param {Object} options
     * @returns {Promise<Object>}
     */
    async function destroy(
        options = {}
    ) {
        await stop({
            reason:
                STOP_REASONS.DESTROY,

            waitForCurrentCycle:
                options
                    .waitForCurrentCycle ===
                true
        });

        const scheduler =
            ensureSchedulerState();

        scheduler.currentCyclePromise =
            null;

        scheduler.currentCycleController =
            null;

        if (
            options.clearHistory ===
            true
        ) {
            clearCycleHistory();
        }

        return {
            destroyed:
                true,

            running:
                false,

            historyCleared:
                options.clearHistory ===
                true
        };
    }

    /**
     * Automatically pause when the document becomes hidden.
     *
     * Enabled only when configuration requests it.
     */
    function installVisibilityHandler() {
        if (
            typeof globalObject
                .document ===
                'undefined' ||
            runtimeState
                .visibilityHandlerInstalled
        ) {
            return false;
        }

        const handler =
            function handleVisibilityChange() {
                const configuration =
                    integrationApi
                        .getConfiguration();

                if (
                    configuration
                        .pauseWhenDocumentHidden !==
                    true
                ) {
                    return;
                }

                const documentHidden =
                    globalObject
                        .document
                        .hidden;

                if (
                    documentHidden &&
                    runtimeState.running
                ) {
                    runtimeState
                        .resumeAfterVisibility =
                        true;

                    stop({
                        reason:
                            STOP_REASONS
                                .PAGE_HIDDEN,

                        waitForCurrentCycle:
                            false
                    });
                } else if (
                    !documentHidden &&
                    runtimeState
                        .resumeAfterVisibility
                ) {
                    runtimeState
                        .resumeAfterVisibility =
                        false;

                    start({
                        ...ensureSchedulerState()
                            .lastStartOptions,

                        immediate:
                            true
                    });
                }
            };

        globalObject
            .document
            .addEventListener(
                'visibilitychange',
                handler
            );

        runtimeState
            .visibilityHandler =
            handler;

        runtimeState
            .visibilityHandlerInstalled =
            true;

        return true;
    }

    /**
     * Remove document visibility handler.
     */
    function removeVisibilityHandler() {
        if (
            typeof globalObject
                .document ===
                'undefined' ||
            !runtimeState
                .visibilityHandlerInstalled ||
            !runtimeState
                .visibilityHandler
        ) {
            return false;
        }

        globalObject
            .document
            .removeEventListener(
                'visibilitychange',
                runtimeState
                    .visibilityHandler
            );

        runtimeState
            .visibilityHandler =
            null;

        runtimeState
            .visibilityHandlerInstalled =
            false;

        return true;
    }

    /**
     * Extend runtime state.
     */
    ensureSchedulerState();

    if (
        !Object.prototype
            .hasOwnProperty
            .call(
                runtimeState,
                'visibilityHandlerInstalled'
            )
    ) {
        runtimeState
            .visibilityHandlerInstalled =
            false;
    }

    if (
        !Object.prototype
            .hasOwnProperty
            .call(
                runtimeState,
                'resumeAfterVisibility'
            )
    ) {
        runtimeState
            .resumeAfterVisibility =
            false;
    }

    /**
     * Extend public API.
     */
    integrationApi.executeCycle =
        executeCycle;

    integrationApi.runNow =
        runNow;

    integrationApi.start =
        start;

    integrationApi.stop =
        stop;

    integrationApi.restart =
        restart;

    integrationApi.reschedule =
        reschedule;

    integrationApi.destroy =
        destroy;

    integrationApi.distributeCycleResult =
        distributeCycleResult;

    integrationApi.getSchedulerStatus =
        getSchedulerStatus;

    integrationApi.getCycleHistory =
        getCycleHistory;

    integrationApi.clearCycleHistory =
        clearCycleHistory;

    integrationApi.installVisibilityHandler =
        installVisibilityHandler;

    integrationApi.removeVisibilityHandler =
        removeVisibilityHandler;

    integrationApi.metadata = {
        ...integrationApi
            .metadata,

        currentPart:
            '2.1D-2',

        nextPart:
            '2.2A-1',

        status:
            'section_complete',

        productionReady:
            false,

        moduleClosed:
            true,

        capabilities: [
            ...new Set([
                ...(
                    Array.isArray(
                        integrationApi
                            .metadata
                            .capabilities
                    )
                        ? integrationApi
                            .metadata
                            .capabilities
                        : []
                ),

                'full_cycle_execution',
                'overlap_prevention',
                'automatic_cycle_scheduling',
                'start_stop_restart_controls',
                'manual_cycle_execution',
                'dynamic_rescheduling',
                'cycle_result_distribution',
                'cycle_history',
                'scheduler_health_status',
                'visibility_pause_resume',
                'scheduler_resource_cleanup'
            ])
        ]
    };

    /**
     * Extend internal API.
     */
    Object.assign(
        integrationApi._internals,
        {
            MAXIMUM_CYCLE_HISTORY,
            CYCLE_STATES,
            STOP_REASONS,

            ensureSchedulerState,
            setSchedulerState,
            resolveCycleIntervalMs,
            resolveInitialDelayMs,
            clearSchedulerTimers,
            storeCycleHistory,
            createCycleEventPayload,
            canStartCycle,
            createSkippedCycleResult,
            scheduleNextCycle
        }
    );

    /**
     * Install optional page visibility handling.
     */
    installVisibilityHandler();

    log(
        'info',
        'Rain arrival integration Part 2.1D-2 loaded.',
        {
            scheduler:
                getSchedulerStatus(),

            section:
                '2.1 complete'
        }
    );
})(
    typeof globalThis !==
        'undefined'
        ? globalThis
        : (
            typeof window !==
                'undefined'
                ? window
                : this
        )
);

/**
 * RainGuard AI V32
 * Rain Arrival Integration Engine
 *
 * Part:
 * 2.2A-1
 *
 * Responsibilities:
 * - Discover rain arrival UI containers
 * - Register a built-in UI result consumer
 * - Normalize predictions for presentation
 * - Render city arrival cards
 * - Support Arabic and English
 * - Update summary counters
 * - Expose manual UI refresh APIs
 */

(function rainArrivalIntegrationV32UIBridge(globalObject) {
    'use strict';

    if (
        !globalObject ||
        !globalObject.RainGuardAI ||
        !globalObject.RainGuardAI.V32 ||
        !globalObject.RainGuardAI.V32
            .rainArrivalIntegration
    ) {
        throw new Error(
            'Rain Arrival Integration Part 2.1D-2 must be loaded before Part 2.2A-1.'
        );
    }

    const integrationApi =
        globalObject
            .RainGuardAI
            .V32
            .rainArrivalIntegration;

    const runtimeState =
        integrationApi._state;

    const internal =
        integrationApi._internals;

    const {
        toFiniteNumber,
        clamp,
        createRuntimeId,
        nowIso,
        normalizeError,
        log
    } = internal;

    /**
     * Supported UI languages.
     */
    const SUPPORTED_UI_LANGUAGES =
        Object.freeze([
            'ar',
            'en'
        ]);

    /**
     * Candidate selectors for the main cards container.
     */
    const ARRIVAL_CARDS_CONTAINER_SELECTORS =
        Object.freeze([
            '#rain-arrival-cities',
            '#rain-arrival-cards',
            '#rainArrivalCities',
            '#rainArrivalCards',
            '#arrival-cities-container',
            '#arrivalCardsContainer',
            '.rain-arrival-cities',
            '.rain-arrival-cards',
            '[data-rain-arrival-cities]',
            '[data-rain-arrival-cards]'
        ]);

    /**
     * Candidate selectors for summary values.
     */
    const ARRIVAL_SUMMARY_SELECTORS =
        Object.freeze({
            totalCities: [
                '#rain-arrival-total-cities',
                '#arrival-total-cities',
                '[data-rain-arrival-total]'
            ],

            expectedRainCities: [
                '#rain-arrival-expected-cities',
                '#arrival-expected-cities',
                '[data-rain-arrival-expected]'
            ],

            immediateRainCities: [
                '#rain-arrival-immediate-cities',
                '#arrival-immediate-cities',
                '[data-rain-arrival-immediate]'
            ],

            highRiskCities: [
                '#rain-arrival-high-risk-cities',
                '#arrival-high-risk-cities',
                '[data-rain-arrival-high-risk]'
            ],

            averageConfidence: [
                '#rain-arrival-confidence',
                '#arrival-average-confidence',
                '[data-rain-arrival-confidence]'
            ],

            lastUpdated: [
                '#rain-arrival-last-updated',
                '#arrival-last-updated',
                '[data-rain-arrival-updated]'
            ],

            status: [
                '#rain-arrival-status',
                '#arrival-status',
                '[data-rain-arrival-status]'
            ]
        });

    /**
     * UI text dictionary.
     */
    const UI_TEXT =
        Object.freeze({
            ar: {
                title:
                    'توقع وصول المطر',

                noPredictions:
                    'لا توجد توقعات وصول مطر متاحة حاليًا.',

                noRainExpected:
                    'لا توجد مدن متوقع وصول المطر إليها حاليًا.',

                arrival:
                    'الوصول المتوقع',

                arrivingNow:
                    'يصل الآن',

                lessThanMinute:
                    'أقل من دقيقة',

                minutes:
                    'دقيقة',

                hours:
                    'ساعة',

                probability:
                    'احتمال المطر',

                confidence:
                    'الثقة',

                intensity:
                    'الشدة',

                distance:
                    'المسافة',

                speed:
                    'سرعة الخلية',

                direction:
                    'اتجاه الحركة',

                risk:
                    'الخطورة',

                sourceCell:
                    'الخلية المصدرية',

                updated:
                    'آخر تحديث',

                totalCities:
                    'إجمالي المدن',

                expectedRain:
                    'مدن متوقع وصول المطر إليها',

                immediateRain:
                    'وصول خلال 30 دقيقة',

                highRisk:
                    'مدن عالية الخطورة',

                active:
                    'نشط',

                unavailable:
                    'غير متاح',

                minimal:
                    'محدودة',

                low:
                    'منخفضة',

                moderate:
                    'متوسطة',

                high:
                    'عالية',

                extreme:
                    'قصوى',

                unknown:
                    'غير معروف',

                rainExpected:
                    'متوقع وصول المطر',

                noRain:
                    'لا يتوقع وصول المطر',

                rejected:
                    'ثقة غير كافية'
            },

            en: {
                title:
                    'Rain Arrival Forecast',

                noPredictions:
                    'No rain arrival predictions are currently available.',

                noRainExpected:
                    'No cities are currently expected to receive rain.',

                arrival:
                    'Expected arrival',

                arrivingNow:
                    'Arriving now',

                lessThanMinute:
                    'Less than a minute',

                minutes:
                    'min',

                hours:
                    'hr',

                probability:
                    'Rain probability',

                confidence:
                    'Confidence',

                intensity:
                    'Intensity',

                distance:
                    'Distance',

                speed:
                    'Cell speed',

                direction:
                    'Movement direction',

                risk:
                    'Risk',

                sourceCell:
                    'Source cell',

                updated:
                    'Last updated',

                totalCities:
                    'Total cities',

                expectedRain:
                    'Cities expecting rain',

                immediateRain:
                    'Arrival within 30 min',

                highRisk:
                    'High-risk cities',

                active:
                    'Active',

                unavailable:
                    'Unavailable',

                minimal:
                    'Minimal',

                low:
                    'Low',

                moderate:
                    'Moderate',

                high:
                    'High',

                extreme:
                    'Extreme',

                unknown:
                    'Unknown',

                rainExpected:
                    'Rain expected',

                noRain:
                    'No rain expected',

                rejected:
                    'Insufficient confidence'
            }
        });

    /**
     * Risk display order.
     */
    const RISK_PRIORITY =
        Object.freeze({
            extreme:
                5,

            high:
                4,

            moderate:
                3,

            low:
                2,

            minimal:
                1,

            unknown:
                0
        });

    /**
     * Ensure UI runtime state.
     *
     * @returns {Object}
     */
    function ensureUIState() {
        if (
            !runtimeState.ui ||
            typeof runtimeState.ui !==
                'object'
        ) {
            runtimeState.ui = {
                language:
                    null,

                cardsContainer:
                    null,

                discoveredSelectors:
                    {},

                consumerRegistered:
                    false,

                consumerName:
                    'rain_arrival_ui_consumer',

                lastRenderAt:
                    null,

                lastRenderAtIso:
                    null,

                lastPredictionRunId:
                    null,

                lastRenderedPredictions:
                    [],

                renderCount:
                    0,

                renderFailures:
                    0,

                observer:
                    null,

                observerInstalled:
                    false,

                pendingRender:
                    null,

                lastSummary:
                    null
            };
        }

        return runtimeState.ui;
    }

    /**
     * Escape unsafe HTML.
     *
     * @param {*} value
     * @returns {string}
     */
    function escapeHtml(
        value
    ) {
        return String(
            value === undefined ||
            value === null
                ? ''
                : value
        )
            .replace(
                /&/g,
                '&amp;'
            )
            .replace(
                /</g,
                '&lt;'
            )
            .replace(
                />/g,
                '&gt;'
            )
            .replace(
                /"/g,
                '&quot;'
            )
            .replace(
                /'/g,
                '&#039;'
            );
    }

    /**
     * Normalize language.
     *
     * @param {*} language
     * @returns {string}
     */
    function normalizeUILanguage(
        language
    ) {
        const normalized =
            String(
                language ||
                ''
            )
                .trim()
                .toLowerCase()
                .split('-')[0];

        return SUPPORTED_UI_LANGUAGES
            .includes(
                normalized
            )
                ? normalized
                : 'ar';
    }

    /**
     * Detect current UI language.
     *
     * @returns {string}
     */
    function detectUILanguage() {
        const uiState =
            ensureUIState();

        const candidates = [
            uiState.language,

            globalObject
                .RainGuardAI &&
            globalObject
                .RainGuardAI
                .language,

            globalObject
                .RainGuardAI &&
            globalObject
                .RainGuardAI
                .currentLanguage,

            globalObject
                .currentLanguage,

            globalObject
                .lang,

            globalObject
                .document &&
            globalObject
                .document
                .documentElement
                .lang
        ];

        for (
            const candidate
            of candidates
        ) {
            if (
                typeof candidate ===
                    'string' &&
                candidate.trim()
            ) {
                return normalizeUILanguage(
                    candidate
                );
            }
        }

        return 'ar';
    }

    /**
     * Set UI language.
     *
     * @param {string} language
     * @returns {string}
     */
    function setUILanguage(
        language
    ) {
        const uiState =
            ensureUIState();

        uiState.language =
            normalizeUILanguage(
                language
            );

        return uiState.language;
    }

    /**
     * Return language text.
     *
     * @param {string} key
     * @param {string|null} language
     * @returns {string}
     */
    function getUIText(
        key,
        language = null
    ) {
        const selectedLanguage =
            normalizeUILanguage(
                language ||
                detectUILanguage()
            );

        return (
            UI_TEXT[
                selectedLanguage
            ] &&
            UI_TEXT[
                selectedLanguage
            ][key]
        ) ||
        UI_TEXT.ar[key] ||
        key;
    }

    /**
     * Find first matching DOM element.
     *
     * @param {string[]} selectors
     * @returns {Element|null}
     */
    function findFirstElement(
        selectors
    ) {
        if (
            typeof globalObject
                .document ===
                'undefined' ||
            !Array.isArray(
                selectors
            )
        ) {
            return null;
        }

        for (
            const selector
            of selectors
        ) {
            try {
                const element =
                    globalObject
                        .document
                        .querySelector(
                            selector
                        );

                if (element) {
                    return element;
                }
            } catch (error) {
                log(
                    'debug',
                    'Invalid UI selector ignored.',
                    {
                        selector,

                        error:
                            normalizeError(
                                error,
                                {
                                    selector
                                }
                            )
                    }
                );
            }
        }

        return null;
    }

    /**
     * Find all existing elements for selectors.
     *
     * @param {string[]} selectors
     * @returns {Array<Element>}
     */
    function findAllElements(
        selectors
    ) {
        if (
            typeof globalObject
                .document ===
                'undefined' ||
            !Array.isArray(
                selectors
            )
        ) {
            return [];
        }

        const elements =
            new Set();

        for (
            const selector
            of selectors
        ) {
            try {
                globalObject
                    .document
                    .querySelectorAll(
                        selector
                    )
                    .forEach(
                        (element) =>
                            elements.add(
                                element
                            )
                    );
            } catch (error) {
                log(
                    'debug',
                    'Invalid summary selector ignored.',
                    {
                        selector
                    }
                );
            }
        }

        return Array.from(
            elements
        );
    }

    /**
     * Create fallback cards container.
     *
     * @returns {Element|null}
     */
    function createFallbackCardsContainer() {
        if (
            typeof globalObject
                .document ===
                'undefined' ||
            !globalObject
                .document
                .body
        ) {
            return null;
        }

        const section =
            globalObject
                .document
                .createElement(
                    'section'
                );

        section.id =
            'rain-arrival-cities';

        section.className =
            'rain-arrival-cities rain-arrival-cities-v32';

        section.setAttribute(
            'data-rain-arrival-cities',
            'true'
        );

        section.setAttribute(
            'data-generated-by',
            'RainArrivalIntegrationV32'
        );

        globalObject
            .document
            .body
            .appendChild(
                section
            );

        return section;
    }

    /**
     * Discover all UI targets.
     *
     * @param {Object} options
     * @returns {Object}
     */
    function discoverUIElements(
        options = {}
    ) {
        const uiState =
            ensureUIState();

        const customSelectors =
            Array.isArray(
                options
                    .cardsContainerSelectors
            )
                ? options
                    .cardsContainerSelectors
                : [];

        const selectors = [
            ...customSelectors,
            ...ARRIVAL_CARDS_CONTAINER_SELECTORS
        ];

        let cardsContainer =
            findFirstElement(
                selectors
            );

        if (
            !cardsContainer &&
            options.createFallback ===
                true
        ) {
            cardsContainer =
                createFallbackCardsContainer();
        }

        const summaryElements =
            {};

        for (
            const [
                key,
                selectorList
            ]
            of Object.entries(
                ARRIVAL_SUMMARY_SELECTORS
            )
        ) {
            const customSummarySelectors =
                options
                    .summarySelectors &&
                Array.isArray(
                    options
                        .summarySelectors[
                        key
                    ]
                )
                    ? options
                        .summarySelectors[
                        key
                    ]
                    : [];

            summaryElements[key] =
                findAllElements([
                    ...customSummarySelectors,
                    ...selectorList
                ]);
        }

        uiState.cardsContainer =
            cardsContainer;

        uiState.discoveredSelectors = {
            cardsContainerFound:
                Boolean(
                    cardsContainer
                ),

            summary: Object.fromEntries(
                Object.entries(
                    summaryElements
                ).map(
                    ([
                        key,
                        elements
                    ]) => [
                        key,
                        elements.length
                    ]
                )
            )
        };

        uiState.summaryElements =
            summaryElements;

        return {
            cardsContainer,

            summaryElements,

            found:
                Boolean(
                    cardsContainer
                ),

            discoveredAt:
                Date.now(),

            discoveredAtIso:
                nowIso()
        };
    }

    /**
     * Format number.
     *
     * @param {*} value
     * @param {number} decimals
     * @param {string} language
     * @returns {string}
     */
    function formatNumber(
        value,
        decimals = 0,
        language = 'ar'
    ) {
        const numericValue =
            toFiniteNumber(
                value,
                NaN
            );

        if (
            !Number.isFinite(
                numericValue
            )
        ) {
            return '—';
        }

        try {
            return new Intl.NumberFormat(
                language ===
                    'ar'
                    ? 'ar-SA'
                    : 'en-US',
                {
                    minimumFractionDigits:
                        decimals,

                    maximumFractionDigits:
                        decimals
                }
            ).format(
                numericValue
            );
        } catch (error) {
            return numericValue
                .toFixed(
                    decimals
                );
        }
    }

    /**
     * Format date and time.
     *
     * @param {*} timestamp
     * @param {string} language
     * @returns {string}
     */
    function formatDateTime(
        timestamp,
        language = 'ar'
    ) {
        const numericTimestamp =
            toFiniteNumber(
                timestamp,
                NaN
            );

        if (
            !Number.isFinite(
                numericTimestamp
            )
        ) {
            return '—';
        }

        try {
            return new Intl.DateTimeFormat(
                language ===
                    'ar'
                    ? 'ar-SA'
                    : 'en-US',
                {
                    hour:
                        '2-digit',

                    minute:
                        '2-digit',

                    day:
                        '2-digit',

                    month:
                        '2-digit'
                }
            ).format(
                new Date(
                    numericTimestamp
                )
            );
        } catch (error) {
            return new Date(
                numericTimestamp
            ).toLocaleString();
        }
    }

    /**
     * Format arrival duration.
     *
     * @param {*} arrivalMinutes
     * @param {string} language
     * @returns {string}
     */
    function formatArrivalDuration(
        arrivalMinutes,
        language = 'ar'
    ) {
        const minutes =
            toFiniteNumber(
                arrivalMinutes,
                NaN
            );

        if (
            !Number.isFinite(
                minutes
            )
        ) {
            return getUIText(
                'unknown',
                language
            );
        }

        if (minutes <= 0) {
            return getUIText(
                'arrivingNow',
                language
            );
        }

        if (minutes < 1) {
            return getUIText(
                'lessThanMinute',
                language
            );
        }

        if (minutes < 60) {
            return `${formatNumber(
                Math.round(
                    minutes
                ),
                0,
                language
            )} ${getUIText(
                'minutes',
                language
            )}`;
        }

        const hours =
            Math.floor(
                minutes /
                60
            );

        const remainingMinutes =
            Math.round(
                minutes %
                60
            );

        if (
            remainingMinutes === 0
        ) {
            return `${formatNumber(
                hours,
                0,
                language
            )} ${getUIText(
                'hours',
                language
            )}`;
        }

        return `${formatNumber(
            hours,
            0,
            language
        )} ${getUIText(
            'hours',
            language
        )} ${formatNumber(
            remainingMinutes,
            0,
            language
        )} ${getUIText(
            'minutes',
            language
        )}`;
    }

    /**
     * Normalize risk level.
     *
     * @param {*} riskLevel
     * @returns {string}
     */
    function normalizeRiskLevel(
        riskLevel
    ) {
        const normalized =
            String(
                riskLevel ||
                'unknown'
            )
                .trim()
                .toLowerCase();

        return Object.prototype
            .hasOwnProperty
            .call(
                RISK_PRIORITY,
                normalized
            )
                ? normalized
                : 'unknown';
    }

    /**
     * Convert direction degrees to compass direction.
     *
     * @param {*} degrees
     * @param {string} language
     * @returns {string}
     */
    function formatDirection(
        degrees,
        language = 'ar'
    ) {
        const numericDegrees =
            toFiniteNumber(
                degrees,
                NaN
            );

        if (
            !Number.isFinite(
                numericDegrees
            )
        ) {
            return '—';
        }

        const normalized =
            (
                (
                    numericDegrees %
                    360
                ) +
                360
            ) %
            360;

        const directions =
            language ===
                'ar'
                ? [
                    'شمال',
                    'شمال شرقي',
                    'شرق',
                    'جنوب شرقي',
                    'جنوب',
                    'جنوب غربي',
                    'غرب',
                    'شمال غربي'
                ]
                : [
                    'N',
                    'NE',
                    'E',
                    'SE',
                    'S',
                    'SW',
                    'W',
                    'NW'
                ];

        const index =
            Math.round(
                normalized /
                45
            ) %
            8;

        return `${directions[index]} (${formatNumber(
            normalized,
            0,
            language
        )}°)`;
    }

    /**
     * Create UI-ready prediction.
     *
     * @param {Object} prediction
     * @param {string} language
     * @returns {Object}
     */
    function createUIPrediction(
        prediction,
        language
    ) {
        const riskLevel =
            normalizeRiskLevel(
                prediction
                    .riskLevel
            );

        const probability =
            clamp(
                prediction
                    .probability,
                0,
                100
            );

        const confidence =
            clamp(
                prediction
                    .confidence,
                0,
                100
            );

        const accepted =
            prediction
                .accepted !==
            false;

        const willRain =
            Boolean(
                prediction
                    .willRain
            );

        return {
            id:
                prediction.id ||
                createRuntimeId(
                    'ui_prediction'
                ),

            cityId:
                prediction.cityId ||
                null,

            cityName:
                language ===
                    'ar'
                    ? (
                        prediction
                            .cityNameAr ||
                        prediction
                            .cityName ||
                        prediction
                            .cityId ||
                        '—'
                    )
                    : (
                        prediction
                            .cityName ||
                        prediction
                            .cityNameAr ||
                        prediction
                            .cityId ||
                        '—'
                    ),

            secondaryCityName:
                language ===
                    'ar'
                    ? prediction
                        .cityName
                    : prediction
                        .cityNameAr,

            latitude:
                prediction.latitude,

            longitude:
                prediction.longitude,

            arrivalMinutes:
                prediction
                    .arrivalMinutes,

            arrivalText:
                formatArrivalDuration(
                    prediction
                        .arrivalMinutes,
                    language
                ),

            arrivalTime:
                prediction
                    .arrivalTime,

            arrivalTimeText:
                formatDateTime(
                    prediction
                        .arrivalTime,
                    language
                ),

            probability,

            confidence,

            intensity:
                Math.max(
                    0,
                    toFiniteNumber(
                        prediction
                            .intensity,
                        0
                    )
                ),

            distanceKm:
                toFiniteNumber(
                    prediction
                        .distanceKm,
                    null
                ),

            speedKmh:
                toFiniteNumber(
                    prediction
                        .stormSpeedKmh,
                    null
                ),

            directionDeg:
                toFiniteNumber(
                    prediction
                        .stormDirectionDeg,
                    null
                ),

            directionText:
                formatDirection(
                    prediction
                        .stormDirectionDeg,
                    language
                ),

            riskLevel,

            riskText:
                getUIText(
                    riskLevel,
                    language
                ),

            riskPriority:
                RISK_PRIORITY[
                    riskLevel
                ],

            sourceCellId:
                prediction
                    .sourceCellId ||
                null,

            willRain,

            accepted,

            statusText:
                !accepted
                    ? getUIText(
                        'rejected',
                        language
                    )
                    : (
                        willRain
                            ? getUIText(
                                'rainExpected',
                                language
                            )
                            : getUIText(
                                'noRain',
                                language
                            )
                    ),

            generatedAt:
                prediction
                    .generatedAt ||
                Date.now(),

            raw:
                prediction
        };
    }

    /**
     * Sort predictions for display.
     *
     * @param {Array<Object>} predictions
     * @returns {Array<Object>}
     */
    function sortUIPredictions(
        predictions
    ) {
        return predictions
            .slice()
            .sort(
                (left, right) => {
                    if (
                        left.willRain !==
                        right.willRain
                    ) {
                        return left.willRain
                            ? -1
                            : 1;
                    }

                    if (
                        left.accepted !==
                        right.accepted
                    ) {
                        return left.accepted
                            ? -1
                            : 1;
                    }

                    if (
                        left.riskPriority !==
                        right.riskPriority
                    ) {
                        return (
                            right
                                .riskPriority -
                            left
                                .riskPriority
                        );
                    }

                    const leftArrival =
                        Number.isFinite(
                            left
                                .arrivalMinutes
                        )
                            ? left
                                .arrivalMinutes
                            : Number
                                .POSITIVE_INFINITY;

                    const rightArrival =
                        Number.isFinite(
                            right
                                .arrivalMinutes
                        )
                            ? right
                                .arrivalMinutes
                            : Number
                                .POSITIVE_INFINITY;

                    if (
                        leftArrival !==
                        rightArrival
                    ) {
                        return (
                            leftArrival -
                            rightArrival
                        );
                    }

                    return (
                        right.confidence -
                        left.confidence
                    );
                }
            );
    }

    /**
     * Build progress bar HTML.
     *
     * @param {number} value
     * @param {string} className
     * @returns {string}
     */
    function buildProgressBarHtml(
        value,
        className
    ) {
        const normalizedValue =
            clamp(
                value,
                0,
                100
            );

        return `
            <div class="rain-arrival-progress ${escapeHtml(
                className
            )}">
                <div
                    class="rain-arrival-progress__fill"
                    style="width:${normalizedValue}%"
                    aria-valuemin="0"
                    aria-valuemax="100"
                    aria-valuenow="${normalizedValue}"
                ></div>
            </div>
        `;
    }

    /**
     * Build one city card.
     *
     * @param {Object} prediction
     * @param {string} language
     * @returns {string}
     */
    function buildArrivalCardHtml(
        prediction,
        language
    ) {
        const direction =
            language ===
                'ar'
                ? 'rtl'
                : 'ltr';

        const secondaryName =
            prediction
                .secondaryCityName &&
            prediction
                .secondaryCityName !==
                prediction.cityName
                ? `
                    <div class="rain-arrival-card__secondary-name">
                        ${escapeHtml(
                            prediction
                                .secondaryCityName
                        )}
                    </div>
                `
                : '';

        const arrivalSection =
            prediction.willRain
                ? `
                    <div class="rain-arrival-card__arrival">
                        <span class="rain-arrival-card__arrival-label">
                            ${escapeHtml(
                                getUIText(
                                    'arrival',
                                    language
                                )
                            )}
                        </span>

                        <strong class="rain-arrival-card__arrival-value">
                            ${escapeHtml(
                                prediction
                                    .arrivalText
                            )}
                        </strong>

                        <span class="rain-arrival-card__arrival-time">
                            ${escapeHtml(
                                prediction
                                    .arrivalTimeText
                            )}
                        </span>
                    </div>
                `
                : `
                    <div class="rain-arrival-card__arrival rain-arrival-card__arrival--none">
                        <strong>
                            ${escapeHtml(
                                prediction
                                    .statusText
                            )}
                        </strong>
                    </div>
                `;

        const distanceItem =
            prediction.distanceKm !==
                null
                ? `
                    <div class="rain-arrival-card__metric">
                        <span>${escapeHtml(
                            getUIText(
                                'distance',
                                language
                            )
                        )}</span>

                        <strong>
                            ${escapeHtml(
                                formatNumber(
                                    prediction
                                        .distanceKm,
                                    1,
                                    language
                                )
                            )} km
                        </strong>
                    </div>
                `
                : '';

        const speedItem =
            prediction.speedKmh !==
                null
                ? `
                    <div class="rain-arrival-card__metric">
                        <span>${escapeHtml(
                            getUIText(
                                'speed',
                                language
                            )
                        )}</span>

                        <strong>
                            ${escapeHtml(
                                formatNumber(
                                    prediction
                                        .speedKmh,
                                    1,
                                    language
                                )
                            )} km/h
                        </strong>
                    </div>
                `
                : '';

        const directionItem =
            prediction.directionDeg !==
                null
                ? `
                    <div class="rain-arrival-card__metric">
                        <span>${escapeHtml(
                            getUIText(
                                'direction',
                                language
                            )
                        )}</span>

                        <strong>
                            ${escapeHtml(
                                prediction
                                    .directionText
                            )}
                        </strong>
                    </div>
                `
                : '';

        const sourceCellItem =
            prediction.sourceCellId
                ? `
                    <div class="rain-arrival-card__metric">
                        <span>${escapeHtml(
                            getUIText(
                                'sourceCell',
                                language
                            )
                        )}</span>

                        <strong>
                            ${escapeHtml(
                                prediction
                                    .sourceCellId
                            )}
                        </strong>
                    </div>
                `
                : '';

        return `
            <article
                class="
                    rain-arrival-card
                    rain-arrival-card--${escapeHtml(
                        prediction.riskLevel
                    )}
                    ${prediction.willRain
                        ? 'rain-arrival-card--expected'
                        : 'rain-arrival-card--clear'}
                    ${prediction.accepted
                        ? ''
                        : 'rain-arrival-card--rejected'}
                "
                data-city-id="${escapeHtml(
                    prediction.cityId ||
                    ''
                )}"
                data-risk-level="${escapeHtml(
                    prediction.riskLevel
                )}"
                data-rain-expected="${prediction.willRain
                    ? 'true'
                    : 'false'}"
                dir="${direction}"
            >
                <header class="rain-arrival-card__header">
                    <div>
                        <h3 class="rain-arrival-card__city">
                            ${escapeHtml(
                                prediction.cityName
                            )}
                        </h3>

                        ${secondaryName}
                    </div>

                    <span
                        class="
                            rain-arrival-card__risk
                            rain-arrival-card__risk--${escapeHtml(
                                prediction.riskLevel
                            )}
                        "
                    >
                        ${escapeHtml(
                            prediction.riskText
                        )}
                    </span>
                </header>

                ${arrivalSection}

                <div class="rain-arrival-card__scores">
                    <div class="rain-arrival-card__score">
                        <div class="rain-arrival-card__score-header">
                            <span>
                                ${escapeHtml(
                                    getUIText(
                                        'probability',
                                        language
                                    )
                                )}
                            </span>

                            <strong>
                                ${escapeHtml(
                                    formatNumber(
                                        prediction
                                            .probability,
                                        0,
                                        language
                                    )
                                )}%
                            </strong>
                        </div>

                        ${buildProgressBarHtml(
                            prediction.probability,
                            'rain-arrival-progress--probability'
                        )}
                    </div>

                    <div class="rain-arrival-card__score">
                        <div class="rain-arrival-card__score-header">
                            <span>
                                ${escapeHtml(
                                    getUIText(
                                        'confidence',
                                        language
                                    )
                                )}
                            </span>

                            <strong>
                                ${escapeHtml(
                                    formatNumber(
                                        prediction
                                            .confidence,
                                        0,
                                        language
                                    )
                                )}%
                            </strong>
                        </div>

                        ${buildProgressBarHtml(
                            prediction.confidence,
                            'rain-arrival-progress--confidence'
                        )}
                    </div>
                </div>

                <div class="rain-arrival-card__metrics">
                    <div class="rain-arrival-card__metric">
                        <span>
                            ${escapeHtml(
                                getUIText(
                                    'intensity',
                                    language
                                )
                            )}
                        </span>

                        <strong>
                            ${escapeHtml(
                                formatNumber(
                                    prediction
                                        .intensity,
                                    1,
                                    language
                                )
                            )}
                        </strong>
                    </div>

                    ${distanceItem}
                    ${speedItem}
                    ${directionItem}
                    ${sourceCellItem}
                </div>

                <footer class="rain-arrival-card__footer">
                    <span>
                        ${escapeHtml(
                            prediction.statusText
                        )}
                    </span>

                    <span>
                        ${escapeHtml(
                            getUIText(
                                'updated',
                                language
                            )
                        )}:
                        ${escapeHtml(
                            formatDateTime(
                                prediction
                                    .generatedAt,
                                language
                            )
                        )}
                    </span>
                </footer>
            </article>
        `;
    }

    /**
     * Build empty state HTML.
     *
     * @param {string} language
     * @param {string} messageKey
     * @returns {string}
     */
    function buildEmptyStateHtml(
        language,
        messageKey =
            'noPredictions'
    ) {
        return `
            <div
                class="rain-arrival-empty-state"
                dir="${language ===
                    'ar'
                    ? 'rtl'
                    : 'ltr'}"
            >
                <div class="rain-arrival-empty-state__icon">
                    🌧
                </div>

                <div class="rain-arrival-empty-state__text">
                    ${escapeHtml(
                        getUIText(
                            messageKey,
                            language
                        )
                    )}
                </div>
            </div>
        `;
    }

    /**
     * Update a group of summary elements.
     *
     * @param {Array<Element>} elements
     * @param {*} value
     */
    function updateSummaryElements(
        elements,
        value
    ) {
        if (
            !Array.isArray(
                elements
            )
        ) {
            return;
        }

        for (
            const element
            of elements
        ) {
            if (!element) {
                continue;
            }

            element.textContent =
                String(
                    value
                );
        }
    }

    /**
     * Build UI summary.
     *
     * @param {Array<Object>} predictions
     * @returns {Object}
     */
    function buildUISummary(
        predictions
    ) {
        const expectedRain =
            predictions.filter(
                (prediction) =>
                    prediction
                        .willRain &&
                    prediction
                        .accepted
            );

        const immediateRain =
            expectedRain.filter(
                (prediction) =>
                    Number.isFinite(
                        prediction
                            .arrivalMinutes
                    ) &&
                    prediction
                        .arrivalMinutes <=
                        30
            );

        const highRisk =
            predictions.filter(
                (prediction) =>
                    prediction
                        .accepted &&
                    [
                        'high',
                        'extreme'
                    ].includes(
                        prediction
                            .riskLevel
                    )
            );

        const averageConfidence =
            predictions.length > 0
                ? predictions.reduce(
                    (
                        total,
                        prediction
                    ) =>
                        total +
                        prediction
                            .confidence,
                    0
                ) /
                predictions.length
                : 0;

        return {
            totalCities:
                predictions.length,

            expectedRainCities:
                expectedRain.length,

            immediateRainCities:
                immediateRain.length,

            highRiskCities:
                highRisk.length,

            averageConfidence:
                clamp(
                    averageConfidence,
                    0,
                    100
                ),

            generatedAt:
                Date.now(),

            generatedAtIso:
                nowIso()
        };
    }

    /**
     * Update summary UI.
     *
     * @param {Object} summary
     * @param {string} language
     */
    function renderUISummary(
        summary,
        language
    ) {
        const uiState =
            ensureUIState();

        const elements =
            uiState.summaryElements ||
            discoverUIElements()
                .summaryElements;

        updateSummaryElements(
            elements.totalCities,
            formatNumber(
                summary.totalCities,
                0,
                language
            )
        );

        updateSummaryElements(
            elements
                .expectedRainCities,
            formatNumber(
                summary
                    .expectedRainCities,
                0,
                language
            )
        );

        updateSummaryElements(
            elements
                .immediateRainCities,
            formatNumber(
                summary
                    .immediateRainCities,
                0,
                language
            )
        );

        updateSummaryElements(
            elements.highRiskCities,
            formatNumber(
                summary
                    .highRiskCities,
                0,
                language
            )
        );

        updateSummaryElements(
            elements
                .averageConfidence,
            `${formatNumber(
                summary
                    .averageConfidence,
                0,
                language
            )}%`
        );

        updateSummaryElements(
            elements.lastUpdated,
            formatDateTime(
                summary.generatedAt,
                language
            )
        );

        updateSummaryElements(
            elements.status,
            summary.totalCities > 0
                ? getUIText(
                    'active',
                    language
                )
                : getUIText(
                    'unavailable',
                    language
                )
        );

        uiState.lastSummary =
            summary;
    }

    /**
     * Render predictions to UI.
     *
     * @param {Array<Object>} predictions
     * @param {Object} options
     * @returns {Object}
     */
    function renderPredictions(
        predictions,
        options = {}
    ) {
        const uiState =
            ensureUIState();

        const language =
            normalizeUILanguage(
                options.language ||
                detectUILanguage()
            );

        const discovery =
            discoverUIElements({
                ...options,

                createFallback:
                    options.createFallback ===
                    true
            });

        const container =
            options.container ||
            discovery
                .cardsContainer;

        if (!container) {
            const result = {
                rendered:
                    false,

                reason:
                    'cards_container_not_found',

                predictionCount:
                    Array.isArray(
                        predictions
                    )
                        ? predictions.length
                        : 0
            };

            uiState.renderFailures +=
                1;

            return result;
        }

        const normalizedPredictions =
            Array.isArray(
                predictions
            )
                ? predictions
                    .filter(Boolean)
                    .map(
                        (prediction) =>
                            createUIPrediction(
                                prediction,
                                language
                            )
                    )
                : [];

        const filteredPredictions =
            options.showOnlyExpectedRain ===
                true
                ? normalizedPredictions
                    .filter(
                        (prediction) =>
                            prediction.willRain
                    )
                : normalizedPredictions;

        const sortedPredictions =
            sortUIPredictions(
                filteredPredictions
            );

        const limitedPredictions =
            sortedPredictions.slice(
                0,
                Math.max(
                    1,
                    toFiniteNumber(
                        options.maximumCards,
                        100
                    )
                )
            );

        if (
            limitedPredictions.length ===
            0
        ) {
            container.innerHTML =
                buildEmptyStateHtml(
                    language,
                    normalizedPredictions
                        .length > 0
                        ? 'noRainExpected'
                        : 'noPredictions'
                );
        } else {
            container.innerHTML =
                limitedPredictions
                    .map(
                        (prediction) =>
                            buildArrivalCardHtml(
                                prediction,
                                language
                            )
                    )
                    .join('');
        }

        container.setAttribute(
            'data-rain-arrival-rendered',
            'true'
        );

        container.setAttribute(
            'data-language',
            language
        );

        container.setAttribute(
            'data-prediction-count',
            String(
                limitedPredictions.length
            )
        );

        const summary =
            buildUISummary(
                normalizedPredictions
            );

        renderUISummary(
            summary,
            language
        );

        uiState.lastRenderAt =
            Date.now();

        uiState.lastRenderAtIso =
            new Date(
                uiState.lastRenderAt
            ).toISOString();

        uiState.lastRenderedPredictions =
            limitedPredictions;

        uiState.renderCount +=
            1;

        uiState.language =
            language;

        return {
            rendered:
                true,

            language,

            predictionCount:
                limitedPredictions.length,

            totalPredictionCount:
                normalizedPredictions.length,

            containerId:
                container.id ||
                null,

            summary,

            renderedAt:
                uiState.lastRenderAt,

            renderedAtIso:
                uiState.lastRenderAtIso
        };
    }

    /**
     * Extract predictions from consumer payload.
     *
     * @param {Object} payload
     * @returns {Array<Object>}
     */
    function extractConsumerPredictions(
        payload
    ) {
        if (
            !payload ||
            typeof payload !==
                'object'
        ) {
            return [];
        }

        if (
            Array.isArray(
                payload.predictions
            )
        ) {
            return payload.predictions;
        }

        if (
            payload.predictionRun &&
            Array.isArray(
                payload
                    .predictionRun
                    .predictions
            )
        ) {
            return payload
                .predictionRun
                .predictions;
        }

        if (
            payload.cycleResult &&
            payload
                .cycleResult
                .predictionRun &&
            Array.isArray(
                payload
                    .cycleResult
                    .predictionRun
                    .predictions
            )
        ) {
            return payload
                .cycleResult
                .predictionRun
                .predictions;
        }

        return [];
    }

    /**
     * Built-in UI consumer.
     *
     * @param {Object} payload
     * @returns {Object}
     */
    async function rainArrivalUIConsumer(
        payload
    ) {
        const uiState =
            ensureUIState();

        const predictions =
            extractConsumerPredictions(
                payload
            );

        const result =
            renderPredictions(
                predictions,
                {
                    language:
                        payload &&
                        payload.options &&
                        payload
                            .options
                            .language,

                    createFallback:
                        payload &&
                        payload.options &&
                        payload
                            .options
                            .createUIFallback ===
                            true,

                    showOnlyExpectedRain:
                        payload &&
                        payload.options &&
                        payload
                            .options
                            .showOnlyExpectedRain ===
                            true,

                    maximumCards:
                        payload &&
                        payload.options
                            ? payload
                                .options
                                .maximumArrivalCards
                            : undefined
                }
            );

        uiState.lastPredictionRunId =
            payload &&
            payload.predictionRun
                ? payload
                    .predictionRun
                    .id
                : null;

        return {
            consumer:
                uiState.consumerName,

            ...result
        };
    }

    /**
     * Register built-in UI consumer.
     *
     * @param {Object} options
     * @returns {Object}
     */
    function registerUIConsumer(
        options = {}
    ) {
        const uiState =
            ensureUIState();

        if (
            uiState.consumerRegistered &&
            options.force !==
                true
        ) {
            return {
                registered:
                    false,

                reused:
                    true,

                name:
                    uiState.consumerName
            };
        }

        const result =
            integrationApi
                .registerResultConsumer(
                    uiState.consumerName,
                    rainArrivalUIConsumer,
                    {
                        enabled:
                            options.enabled !==
                            false,

                        priority:
                            options.priority ??
                            100,

                        consumerType:
                            'ui',

                        metadata: {
                            builtIn:
                                true,

                            integrationVersion:
                                'V32',

                            target:
                                'rain_arrival_cards'
                        }
                    }
                );

        uiState.consumerRegistered =
            true;

        return {
            registered:
                true,

            reused:
                false,

            name:
                uiState.consumerName,

            result
        };
    }

    /**
     * Render latest predictions.
     *
     * @param {Object} options
     * @returns {Object}
     */
    function renderLatestPredictions(
        options = {}
    ) {
        const predictions =
            typeof integrationApi
                .getLatestPredictions ===
                'function'
                ? integrationApi
                    .getLatestPredictions()
                : [];

        return renderPredictions(
            predictions,
            options
        );
    }

    /**
     * Refresh UI language and rerender.
     *
     * @param {string} language
     * @param {Object} options
     * @returns {Object}
     */
    function refreshUILanguage(
        language,
        options = {}
    ) {
        setUILanguage(
            language
        );

        return renderLatestPredictions({
            ...options,

            language
        });
    }

    /**
     * Return current UI status.
     *
     * @returns {Object}
     */
    function getUIStatus() {
        const uiState =
            ensureUIState();

        return {
            language:
                uiState.language ||
                detectUILanguage(),

            cardsContainerFound:
                Boolean(
                    uiState.cardsContainer
                ),

            consumerRegistered:
                uiState
                    .consumerRegistered,

            consumerName:
                uiState.consumerName,

            lastRenderAt:
                uiState.lastRenderAt,

            lastRenderAtIso:
                uiState.lastRenderAtIso,

            lastPredictionRunId:
                uiState
                    .lastPredictionRunId,

            lastRenderedPredictionCount:
                uiState
                    .lastRenderedPredictions
                    .length,

            renderCount:
                uiState.renderCount,

            renderFailures:
                uiState.renderFailures,

            summary:
                uiState.lastSummary,

            discoveredSelectors:
                uiState
                    .discoveredSelectors
        };
    }

    /**
     * Clear rendered UI.
     *
     * @param {Object} options
     * @returns {Object}
     */
    function clearRenderedPredictions(
        options = {}
    ) {
        const uiState =
            ensureUIState();

        const container =
            options.container ||
            uiState.cardsContainer ||
            discoverUIElements()
                .cardsContainer;

        if (!container) {
            return {
                cleared:
                    false,

                reason:
                    'cards_container_not_found'
            };
        }

        container.innerHTML =
            '';

        container.removeAttribute(
            'data-rain-arrival-rendered'
        );

        container.removeAttribute(
            'data-prediction-count'
        );

        uiState.lastRenderedPredictions =
            [];

        uiState.lastSummary =
            null;

        return {
            cleared:
                true
        };
    }

    /**
     * Install observer for dynamically created containers.
     *
     * @param {Object} options
     * @returns {boolean}
     */
    function installUIObserver(
        options = {}
    ) {
        const uiState =
            ensureUIState();

        if (
            uiState.observerInstalled ||
            typeof globalObject
                .MutationObserver !==
                'function' ||
            typeof globalObject
                .document ===
                'undefined' ||
            !globalObject
                .document
                .documentElement
        ) {
            return false;
        }

        const observer =
            new globalObject
                .MutationObserver(
                    () => {
                        const discovery =
                            discoverUIElements(
                                options
                            );

                        if (
                            discovery
                                .cardsContainer &&
                            !uiState
                                .cardsContainer
                        ) {
                            uiState.cardsContainer =
                                discovery
                                    .cardsContainer;
                        }

                        if (
                            discovery
                                .cardsContainer &&
                            uiState
                                .lastRenderedPredictions
                                .length >
                                0 &&
                            !discovery
                                .cardsContainer
                                .hasAttribute(
                                    'data-rain-arrival-rendered'
                                )
                        ) {
                            renderPredictions(
                                uiState
                                    .lastRenderedPredictions
                                    .map(
                                        (
                                            item
                                        ) =>
                                            item.raw ||
                                            item
                                    ),
                                {
                                    ...options,

                                    language:
                                        uiState
                                            .language
                                }
                            );
                        }
                    }
                );

        observer.observe(
            globalObject
                .document
                .documentElement,
            {
                childList:
                    true,

                subtree:
                    true
            }
        );

        uiState.observer =
            observer;

        uiState.observerInstalled =
            true;

        return true;
    }

    /**
     * Remove UI observer.
     *
     * @returns {boolean}
     */
    function removeUIObserver() {
        const uiState =
            ensureUIState();

        if (
            !uiState.observerInstalled ||
            !uiState.observer
        ) {
            return false;
        }

        uiState.observer
            .disconnect();

        uiState.observer =
            null;

        uiState.observerInstalled =
            false;

        return true;
    }

    /**
     * Extend runtime state.
     */
    ensureUIState();

    /**
     * Extend public API.
     */
    integrationApi
        .discoverUIElements =
        discoverUIElements;

    integrationApi
        .registerUIConsumer =
        registerUIConsumer;

    integrationApi
        .renderPredictions =
        renderPredictions;

    integrationApi
        .renderLatestPredictions =
        renderLatestPredictions;

    integrationApi
        .setUILanguage =
        setUILanguage;

    integrationApi
        .refreshUILanguage =
        refreshUILanguage;

    integrationApi
        .getUIStatus =
        getUIStatus;

    integrationApi
        .clearRenderedPredictions =
        clearRenderedPredictions;

    integrationApi
        .installUIObserver =
        installUIObserver;

    integrationApi
        .removeUIObserver =
        removeUIObserver;

    integrationApi.metadata = {
        ...integrationApi
            .metadata,

        currentPart:
            '2.2A-1',

        nextPart:
            '2.2A-2',

        status:
            'in_progress',

        productionReady:
            false,

        moduleClosed:
            true,

        capabilities: [
            ...new Set([
                ...(
                    Array.isArray(
                        integrationApi
                            .metadata
                            .capabilities
                    )
                        ? integrationApi
                            .metadata
                            .capabilities
                        : []
                ),

                'ui_container_discovery',
                'ui_result_consumer',
                'city_arrival_card_rendering',
                'arrival_summary_rendering',
                'arabic_english_ui',
                'prediction_display_sorting',
                'dynamic_ui_observer',
                'manual_ui_refresh',
                'ui_runtime_status'
            ])
        ]
    };

    /**
     * Extend internal API.
     */
    Object.assign(
        integrationApi._internals,
        {
            SUPPORTED_UI_LANGUAGES,
            ARRIVAL_CARDS_CONTAINER_SELECTORS,
            ARRIVAL_SUMMARY_SELECTORS,
            UI_TEXT,
            RISK_PRIORITY,

            ensureUIState,
            escapeHtml,
            normalizeUILanguage,
            detectUILanguage,
            getUIText,
            findFirstElement,
            findAllElements,
            createFallbackCardsContainer,
            formatNumber,
            formatDateTime,
            formatArrivalDuration,
            normalizeRiskLevel,
            formatDirection,
            createUIPrediction,
            sortUIPredictions,
            buildProgressBarHtml,
            buildArrivalCardHtml,
            buildEmptyStateHtml,
            updateSummaryElements,
            buildUISummary,
            renderUISummary,
            extractConsumerPredictions,
            rainArrivalUIConsumer
        }
    );

    /**
     * Register built-in UI consumer.
     */
    try {
        registerUIConsumer();
    } catch (error) {
        log(
            'debug',
            'Rain arrival UI consumer registration failed.',
            normalizeError(
                error,
                {
                    part:
                        '2.2A-1'
                }
            )
        );
    }

    /**
     * Discover existing UI and watch dynamic UI changes.
     */
    try {
        discoverUIElements();

        installUIObserver();
    } catch (error) {
        log(
            'debug',
            'Rain arrival UI discovery failed.',
            normalizeError(
                error,
                {
                    part:
                        '2.2A-1'
                }
            )
        );
    }

    log(
        'info',
        'Rain arrival integration Part 2.2A-1 loaded.',
        {
            ui:
                getUIStatus()
        }
    );
})(
    typeof globalThis !==
        'undefined'
        ? globalThis
        : (
            typeof window !==
                'undefined'
                ? window
                : this
        )
);

/**
 * RainGuard AI V32
 * Rain Arrival Integration Engine
 *
 * Part:
 * 2.2A-2
 *
 * Responsibilities:
 * - Inject production-ready UI styles
 * - Add interactive card filtering
 * - Add risk and arrival-time filters
 * - Add live arrival countdown updates
 * - Support city selection and map focus
 * - Add keyboard accessibility
 * - Add automatic UI event delegation
 */

(function rainArrivalIntegrationV32UIInteractions(globalObject) {
    'use strict';

    if (
        !globalObject ||
        !globalObject.RainGuardAI ||
        !globalObject.RainGuardAI.V32 ||
        !globalObject.RainGuardAI.V32
            .rainArrivalIntegration
    ) {
        throw new Error(
            'Rain Arrival Integration Part 2.2A-1 must be loaded before Part 2.2A-2.'
        );
    }

    const integrationApi =
        globalObject
            .RainGuardAI
            .V32
            .rainArrivalIntegration;

    const runtimeState =
        integrationApi._state;

    const internal =
        integrationApi._internals;

    const {
        toFiniteNumber,
        clamp,
        nowIso,
        normalizeError,
        normalizeUILanguage,
        detectUILanguage,
        getUIText,
        formatNumber,
        formatDateTime,
        formatArrivalDuration,
        escapeHtml,
        createUIPrediction,
        sortUIPredictions,
        discoverUIElements,
        buildUISummary,
        renderUISummary,
        log
    } = internal;

    /**
     * UI style element ID.
     */
    const UI_STYLE_ELEMENT_ID =
        'rain-arrival-integration-v32-styles';

    /**
     * Default filter configuration.
     */
    const DEFAULT_UI_FILTERS =
        Object.freeze({
            search:
                '',

            rainOnly:
                false,

            acceptedOnly:
                false,

            maximumArrivalMinutes:
                null,

            riskLevels: [
                'minimal',
                'low',
                'moderate',
                'high',
                'extreme',
                'unknown'
            ],

            sortMode:
                'priority'
        });

    /**
     * Supported sort modes.
     */
    const SUPPORTED_SORT_MODES =
        Object.freeze([
            'priority',
            'arrival',
            'confidence',
            'probability',
            'intensity',
            'city'
        ]);

    /**
     * Toolbar selectors.
     */
    const TOOLBAR_SELECTORS =
        Object.freeze([
            '#rain-arrival-toolbar',
            '#rainArrivalToolbar',
            '.rain-arrival-toolbar',
            '[data-rain-arrival-toolbar]'
        ]);

    /**
     * UI event names.
     */
    const UI_EVENT_NAMES =
        Object.freeze({
            citySelected:
                'rainguard:v32:rain-arrival:city-selected',

            filtersChanged:
                'rainguard:v32:rain-arrival:filters-changed',

            countdownUpdated:
                'rainguard:v32:rain-arrival:countdown-updated',

            mapFocusRequested:
                'rainguard:v32:rain-arrival:map-focus-requested'
        });

    /**
     * Ensure extended UI interaction state.
     *
     * @returns {Object}
     */
    function ensureUIInteractionState() {
        if (
            !runtimeState.ui ||
            typeof runtimeState.ui !==
                'object'
        ) {
            runtimeState.ui = {};
        }

        if (
            !runtimeState.ui
                .interactions ||
            typeof runtimeState.ui
                .interactions !==
                'object'
        ) {
            runtimeState.ui.interactions = {
                stylesInstalled:
                    false,

                toolbar:
                    null,

                toolbarCreated:
                    false,

                filters: {
                    ...DEFAULT_UI_FILTERS,

                    riskLevels:
                        DEFAULT_UI_FILTERS
                            .riskLevels
                            .slice()
                },

                eventDelegationInstalled:
                    false,

                eventDelegationContainer:
                    null,

                eventDelegationHandler:
                    null,

                keyboardHandler:
                    null,

                countdownTimerId:
                    null,

                countdownIntervalMs:
                    30000,

                selectedCityId:
                    null,

                lastFocusedCityId:
                    null,

                filterCount:
                    0,

                interactionCount:
                    0,

                countdownUpdateCount:
                    0,

                lastFilterAt:
                    null,

                lastFilterAtIso:
                    null,

                lastInteractionAt:
                    null,

                lastInteractionAtIso:
                    null
            };
        }

        return runtimeState.ui
            .interactions;
    }

    /**
     * Production-ready CSS.
     */
    const RAIN_ARRIVAL_UI_CSS = `
        .rain-arrival-cities,
        .rain-arrival-cards,
        [data-rain-arrival-cities],
        [data-rain-arrival-cards] {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 16px;
            width: 100%;
            box-sizing: border-box;
        }

        .rain-arrival-toolbar {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: 10px;
            width: 100%;
            margin-bottom: 16px;
            padding: 12px;
            border: 1px solid rgba(148, 163, 184, 0.2);
            border-radius: 14px;
            background: rgba(15, 23, 42, 0.65);
            backdrop-filter: blur(14px);
            box-sizing: border-box;
        }

        .rain-arrival-toolbar__group {
            display: flex;
            align-items: center;
            gap: 8px;
            flex-wrap: wrap;
        }

        .rain-arrival-toolbar__group--grow {
            flex: 1 1 220px;
        }

        .rain-arrival-toolbar__input,
        .rain-arrival-toolbar__select,
        .rain-arrival-toolbar__button {
            min-height: 40px;
            border-radius: 10px;
            border: 1px solid rgba(148, 163, 184, 0.28);
            background: rgba(15, 23, 42, 0.88);
            color: #f8fafc;
            font: inherit;
            box-sizing: border-box;
        }

        .rain-arrival-toolbar__input,
        .rain-arrival-toolbar__select {
            padding: 8px 12px;
        }

        .rain-arrival-toolbar__input {
            width: 100%;
            min-width: 180px;
        }

        .rain-arrival-toolbar__button {
            padding: 8px 14px;
            cursor: pointer;
            transition:
                transform 0.2s ease,
                border-color 0.2s ease,
                background-color 0.2s ease;
        }

        .rain-arrival-toolbar__button:hover,
        .rain-arrival-toolbar__button:focus-visible {
            border-color: rgba(56, 189, 248, 0.75);
            background: rgba(14, 116, 144, 0.35);
            outline: none;
        }

        .rain-arrival-toolbar__button:active {
            transform: scale(0.98);
        }

        .rain-arrival-toolbar__button[aria-pressed="true"] {
            border-color: rgba(34, 211, 238, 0.85);
            background: rgba(8, 145, 178, 0.45);
        }

        .rain-arrival-toolbar__count {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 34px;
            min-height: 34px;
            padding: 4px 10px;
            border-radius: 999px;
            background: rgba(14, 165, 233, 0.18);
            color: #bae6fd;
            font-weight: 700;
        }

        .rain-arrival-card {
            position: relative;
            display: flex;
            flex-direction: column;
            gap: 14px;
            min-width: 0;
            padding: 16px;
            overflow: hidden;
            border: 1px solid rgba(148, 163, 184, 0.2);
            border-radius: 18px;
            background:
                linear-gradient(
                    145deg,
                    rgba(15, 23, 42, 0.95),
                    rgba(30, 41, 59, 0.88)
                );
            color: #f8fafc;
            box-shadow:
                0 16px 35px rgba(2, 6, 23, 0.3);
            cursor: pointer;
            transition:
                transform 0.22s ease,
                box-shadow 0.22s ease,
                border-color 0.22s ease,
                opacity 0.22s ease;
            box-sizing: border-box;
        }

        .rain-arrival-card::before {
            content: "";
            position: absolute;
            inset: 0 auto 0 0;
            width: 4px;
            background: rgba(148, 163, 184, 0.65);
        }

        [dir="rtl"] .rain-arrival-card::before,
        .rain-arrival-card[dir="rtl"]::before {
            inset: 0 0 0 auto;
        }

        .rain-arrival-card:hover,
        .rain-arrival-card:focus-visible {
            transform: translateY(-3px);
            border-color: rgba(56, 189, 248, 0.65);
            box-shadow:
                0 20px 45px rgba(2, 6, 23, 0.42);
            outline: none;
        }

        .rain-arrival-card[aria-selected="true"] {
            border-color: rgba(34, 211, 238, 0.95);
            box-shadow:
                0 0 0 2px rgba(34, 211, 238, 0.2),
                0 20px 45px rgba(2, 6, 23, 0.42);
        }

        .rain-arrival-card--minimal::before {
            background: #94a3b8;
        }

        .rain-arrival-card--low::before {
            background: #38bdf8;
        }

        .rain-arrival-card--moderate::before {
            background: #facc15;
        }

        .rain-arrival-card--high::before {
            background: #fb923c;
        }

        .rain-arrival-card--extreme::before {
            background: #ef4444;
        }

        .rain-arrival-card--unknown::before {
            background: #64748b;
        }

        .rain-arrival-card--rejected {
            opacity: 0.68;
        }

        .rain-arrival-card--hidden {
            display: none !important;
        }

        .rain-arrival-card__header,
        .rain-arrival-card__score-header,
        .rain-arrival-card__footer {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
        }

        .rain-arrival-card__city {
            margin: 0;
            color: #f8fafc;
            font-size: 1.08rem;
            line-height: 1.4;
        }

        .rain-arrival-card__secondary-name {
            margin-top: 2px;
            color: #94a3b8;
            font-size: 0.82rem;
        }

        .rain-arrival-card__risk {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-height: 28px;
            padding: 4px 10px;
            border-radius: 999px;
            white-space: nowrap;
            font-size: 0.78rem;
            font-weight: 700;
        }

        .rain-arrival-card__risk--minimal {
            background: rgba(148, 163, 184, 0.15);
            color: #cbd5e1;
        }

        .rain-arrival-card__risk--low {
            background: rgba(56, 189, 248, 0.15);
            color: #7dd3fc;
        }

        .rain-arrival-card__risk--moderate {
            background: rgba(250, 204, 21, 0.15);
            color: #fde047;
        }

        .rain-arrival-card__risk--high {
            background: rgba(251, 146, 60, 0.15);
            color: #fdba74;
        }

        .rain-arrival-card__risk--extreme {
            background: rgba(239, 68, 68, 0.17);
            color: #fca5a5;
        }

        .rain-arrival-card__risk--unknown {
            background: rgba(100, 116, 139, 0.18);
            color: #cbd5e1;
        }

        .rain-arrival-card__arrival {
            display: grid;
            grid-template-columns: 1fr auto;
            align-items: end;
            gap: 4px 10px;
            padding: 12px;
            border-radius: 14px;
            background:
                linear-gradient(
                    135deg,
                    rgba(2, 132, 199, 0.18),
                    rgba(14, 116, 144, 0.1)
                );
        }

        .rain-arrival-card__arrival-label {
            color: #bae6fd;
            font-size: 0.8rem;
        }

        .rain-arrival-card__arrival-value {
            grid-column: 1;
            color: #f0f9ff;
            font-size: 1.3rem;
        }

        .rain-arrival-card__arrival-time {
            grid-column: 2;
            grid-row: 1 / span 2;
            align-self: center;
            color: #cbd5e1;
            font-size: 0.82rem;
        }

        .rain-arrival-card__arrival--none {
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 58px;
            color: #cbd5e1;
        }

        .rain-arrival-card__scores {
            display: grid;
            gap: 10px;
        }

        .rain-arrival-card__score {
            display: grid;
            gap: 6px;
        }

        .rain-arrival-card__score-header {
            color: #cbd5e1;
            font-size: 0.78rem;
        }

        .rain-arrival-card__score-header strong {
            color: #f8fafc;
        }

        .rain-arrival-progress {
            width: 100%;
            height: 7px;
            overflow: hidden;
            border-radius: 999px;
            background: rgba(148, 163, 184, 0.16);
        }

        .rain-arrival-progress__fill {
            height: 100%;
            border-radius: inherit;
            transition: width 0.35s ease;
        }

        .rain-arrival-progress--probability
        .rain-arrival-progress__fill {
            background:
                linear-gradient(
                    90deg,
                    #0284c7,
                    #38bdf8
                );
        }

        .rain-arrival-progress--confidence
        .rain-arrival-progress__fill {
            background:
                linear-gradient(
                    90deg,
                    #059669,
                    #34d399
                );
        }

        .rain-arrival-card__metrics {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8px;
        }

        .rain-arrival-card__metric {
            display: flex;
            flex-direction: column;
            gap: 3px;
            min-width: 0;
            padding: 9px 10px;
            border-radius: 10px;
            background: rgba(15, 23, 42, 0.55);
        }

        .rain-arrival-card__metric span {
            color: #94a3b8;
            font-size: 0.72rem;
        }

        .rain-arrival-card__metric strong {
            overflow: hidden;
            color: #e2e8f0;
            font-size: 0.82rem;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .rain-arrival-card__footer {
            margin-top: auto;
            padding-top: 10px;
            border-top: 1px solid rgba(148, 163, 184, 0.12);
            color: #94a3b8;
            font-size: 0.7rem;
        }

        .rain-arrival-empty-state {
            grid-column: 1 / -1;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 12px;
            min-height: 160px;
            padding: 24px;
            border: 1px dashed rgba(148, 163, 184, 0.35);
            border-radius: 16px;
            background: rgba(15, 23, 42, 0.45);
            color: #cbd5e1;
            box-sizing: border-box;
        }

        .rain-arrival-empty-state__icon {
            font-size: 2rem;
        }

        .rain-arrival-empty-state__text {
            line-height: 1.7;
        }

        .rain-arrival-filter-empty {
            grid-column: 1 / -1;
            display: none;
            align-items: center;
            justify-content: center;
            min-height: 100px;
            padding: 20px;
            border-radius: 14px;
            background: rgba(15, 23, 42, 0.45);
            color: #94a3b8;
        }

        .rain-arrival-filter-empty--visible {
            display: flex;
        }

        @media (max-width: 640px) {
            .rain-arrival-toolbar {
                align-items: stretch;
                flex-direction: column;
            }

            .rain-arrival-toolbar__group {
                width: 100%;
            }

            .rain-arrival-toolbar__input,
            .rain-arrival-toolbar__select,
            .rain-arrival-toolbar__button {
                width: 100%;
            }

            .rain-arrival-card__metrics {
                grid-template-columns: 1fr;
            }

            .rain-arrival-card__footer {
                align-items: flex-start;
                flex-direction: column;
            }
        }

        @media (prefers-reduced-motion: reduce) {
            .rain-arrival-card,
            .rain-arrival-progress__fill,
            .rain-arrival-toolbar__button {
                transition: none !important;
            }
        }
    `;

    /**
     * Install UI styles.
     *
     * @param {Object} options
     * @returns {Object}
     */
    function installUIStyles(
        options = {}
    ) {
        const interactionState =
            ensureUIInteractionState();

        if (
            typeof globalObject
                .document ===
                'undefined'
        ) {
            return {
                installed:
                    false,

                reason:
                    'document_unavailable'
            };
        }

        let styleElement =
            globalObject
                .document
                .getElementById(
                    UI_STYLE_ELEMENT_ID
                );

        if (
            styleElement &&
            options.force !==
                true
        ) {
            interactionState.stylesInstalled =
                true;

            return {
                installed:
                    false,

                reused:
                    true,

                id:
                    UI_STYLE_ELEMENT_ID
            };
        }

        if (!styleElement) {
            styleElement =
                globalObject
                    .document
                    .createElement(
                        'style'
                    );

            styleElement.id =
                UI_STYLE_ELEMENT_ID;

            styleElement.setAttribute(
                'data-rain-arrival-version',
                'V32'
            );

            (
                globalObject
                    .document
                    .head ||
                globalObject
                    .document
                    .documentElement
            ).appendChild(
                styleElement
            );
        }

        styleElement.textContent =
            options.css ||
            RAIN_ARRIVAL_UI_CSS;

        interactionState.stylesInstalled =
            true;

        return {
            installed:
                true,

            reused:
                false,

            id:
                UI_STYLE_ELEMENT_ID
        };
    }

    /**
     * Remove installed UI styles.
     *
     * @returns {boolean}
     */
    function removeUIStyles() {
        const interactionState =
            ensureUIInteractionState();

        if (
            typeof globalObject
                .document ===
                'undefined'
        ) {
            return false;
        }

        const styleElement =
            globalObject
                .document
                .getElementById(
                    UI_STYLE_ELEMENT_ID
                );

        if (!styleElement) {
            interactionState.stylesInstalled =
                false;

            return false;
        }

        styleElement.remove();

        interactionState.stylesInstalled =
            false;

        return true;
    }

    /**
     * Find toolbar.
     *
     * @returns {Element|null}
     */
    function findToolbar() {
        if (
            typeof globalObject
                .document ===
                'undefined'
        ) {
            return null;
        }

        for (
            const selector
            of TOOLBAR_SELECTORS
        ) {
            try {
                const toolbar =
                    globalObject
                        .document
                        .querySelector(
                            selector
                        );

                if (toolbar) {
                    return toolbar;
                }
            } catch (error) {
                log(
                    'debug',
                    'Invalid toolbar selector ignored.',
                    {
                        selector
                    }
                );
            }
        }

        return null;
    }

    /**
     * Build toolbar HTML.
     *
     * @param {string} language
     * @returns {string}
     */
    function buildToolbarHtml(
        language
    ) {
        const isArabic =
            language ===
            'ar';

        return `
            <div
                class="rain-arrival-toolbar"
                id="rain-arrival-toolbar"
                data-rain-arrival-toolbar="true"
                dir="${isArabic
                    ? 'rtl'
                    : 'ltr'}"
            >
                <div class="rain-arrival-toolbar__group rain-arrival-toolbar__group--grow">
                    <input
                        type="search"
                        class="rain-arrival-toolbar__input"
                        data-rain-arrival-search
                        placeholder="${escapeHtml(
                            isArabic
                                ? 'البحث عن مدينة'
                                : 'Search city'
                        )}"
                        aria-label="${escapeHtml(
                            isArabic
                                ? 'البحث عن مدينة'
                                : 'Search city'
                        )}"
                    />
                </div>

                <div class="rain-arrival-toolbar__group">
                    <select
                        class="rain-arrival-toolbar__select"
                        data-rain-arrival-max-time
                        aria-label="${escapeHtml(
                            isArabic
                                ? 'مدة الوصول القصوى'
                                : 'Maximum arrival time'
                        )}"
                    >
                        <option value="">
                            ${escapeHtml(
                                isArabic
                                    ? 'كل أوقات الوصول'
                                    : 'All arrival times'
                            )}
                        </option>

                        <option value="30">
                            ${escapeHtml(
                                isArabic
                                    ? 'خلال 30 دقيقة'
                                    : 'Within 30 minutes'
                            )}
                        </option>

                        <option value="60">
                            ${escapeHtml(
                                isArabic
                                    ? 'خلال ساعة'
                                    : 'Within 1 hour'
                            )}
                        </option>

                        <option value="120">
                            ${escapeHtml(
                                isArabic
                                    ? 'خلال ساعتين'
                                    : 'Within 2 hours'
                            )}
                        </option>

                        <option value="360">
                            ${escapeHtml(
                                isArabic
                                    ? 'خلال 6 ساعات'
                                    : 'Within 6 hours'
                            )}
                        </option>
                    </select>

                    <select
                        class="rain-arrival-toolbar__select"
                        data-rain-arrival-sort
                        aria-label="${escapeHtml(
                            isArabic
                                ? 'ترتيب المدن'
                                : 'Sort cities'
                        )}"
                    >
                        <option value="priority">
                            ${escapeHtml(
                                isArabic
                                    ? 'حسب الأولوية'
                                    : 'By priority'
                            )}
                        </option>

                        <option value="arrival">
                            ${escapeHtml(
                                isArabic
                                    ? 'الأقرب وصولًا'
                                    : 'Nearest arrival'
                            )}
                        </option>

                        <option value="confidence">
                            ${escapeHtml(
                                isArabic
                                    ? 'الأعلى ثقة'
                                    : 'Highest confidence'
                            )}
                        </option>

                        <option value="probability">
                            ${escapeHtml(
                                isArabic
                                    ? 'الأعلى احتمالًا'
                                    : 'Highest probability'
                            )}
                        </option>

                        <option value="intensity">
                            ${escapeHtml(
                                isArabic
                                    ? 'الأعلى شدة'
                                    : 'Highest intensity'
                            )}
                        </option>

                        <option value="city">
                            ${escapeHtml(
                                isArabic
                                    ? 'اسم المدينة'
                                    : 'City name'
                            )}
                        </option>
                    </select>
                </div>

                <div class="rain-arrival-toolbar__group">
                    <button
                        type="button"
                        class="rain-arrival-toolbar__button"
                        data-rain-arrival-rain-only
                        aria-pressed="false"
                    >
                        ${escapeHtml(
                            isArabic
                                ? 'المدن الممطرة فقط'
                                : 'Rain cities only'
                        )}
                    </button>

                    <button
                        type="button"
                        class="rain-arrival-toolbar__button"
                        data-rain-arrival-accepted-only
                        aria-pressed="false"
                    >
                        ${escapeHtml(
                            isArabic
                                ? 'التوقعات الموثوقة'
                                : 'Accepted only'
                        )}
                    </button>

                    <button
                        type="button"
                        class="rain-arrival-toolbar__button"
                        data-rain-arrival-reset
                    >
                        ${escapeHtml(
                            isArabic
                                ? 'إعادة ضبط'
                                : 'Reset'
                        )}
                    </button>

                    <span
                        class="rain-arrival-toolbar__count"
                        data-rain-arrival-visible-count
                        aria-live="polite"
                    >
                        0
                    </span>
                </div>
            </div>
        `;
    }

    /**
     * Create toolbar.
     *
     * @param {Object} options
     * @returns {Object}
     */
    function createToolbar(
        options = {}
    ) {
        const interactionState =
            ensureUIInteractionState();

        if (
            typeof globalObject
                .document ===
                'undefined'
        ) {
            return {
                created:
                    false,

                reason:
                    'document_unavailable'
            };
        }

        let toolbar =
            options.toolbar ||
            findToolbar();

        if (
            toolbar &&
            options.force !==
                true
        ) {
            interactionState.toolbar =
                toolbar;

            return {
                created:
                    false,

                reused:
                    true,

                toolbar
            };
        }

        const discovery =
            discoverUIElements({
                createFallback:
                    options.createFallback ===
                    true
            });

        const cardsContainer =
            options.cardsContainer ||
            discovery.cardsContainer;

        if (!cardsContainer) {
            return {
                created:
                    false,

                reason:
                    'cards_container_not_found'
            };
        }

        if (toolbar) {
            toolbar.remove();
        }

        const language =
            normalizeUILanguage(
                options.language ||
                detectUILanguage()
            );

        const wrapper =
            globalObject
                .document
                .createElement(
                    'div'
                );

        wrapper.innerHTML =
            buildToolbarHtml(
                language
            ).trim();

        toolbar =
            wrapper.firstElementChild;

        cardsContainer
            .parentNode
            .insertBefore(
                toolbar,
                cardsContainer
            );

        interactionState.toolbar =
            toolbar;

        interactionState.toolbarCreated =
            true;

        bindToolbarEvents(
            toolbar
        );

        return {
            created:
                true,

            reused:
                false,

            toolbar
        };
    }

    /**
     * Normalize search text.
     *
     * @param {*} value
     * @returns {string}
     */
    function normalizeSearchText(
        value
    ) {
        return String(
            value ||
            ''
        )
            .trim()
            .toLowerCase()
            .normalize('NFKD')
            .replace(
                /[\u064B-\u065F\u0670]/g,
                ''
            )
            .replace(
                /[إأآ]/g,
                'ا'
            )
            .replace(
                /ة/g,
                'ه'
            )
            .replace(
                /ى/g,
                'ي'
            );
    }

    /**
     * Return active filters.
     *
     * @returns {Object}
     */
    function getUIFilters() {
        const interactionState =
            ensureUIInteractionState();

        return {
            ...interactionState.filters,

            riskLevels:
                interactionState
                    .filters
                    .riskLevels
                    .slice()
        };
    }

    /**
     * Update active filters.
     *
     * @param {Object} filters
     * @param {Object} options
     * @returns {Object}
     */
    function setUIFilters(
        filters = {},
        options = {}
    ) {
        const interactionState =
            ensureUIInteractionState();

        const currentFilters =
            interactionState.filters;

        if (
            filters.search !==
            undefined
        ) {
            currentFilters.search =
                String(
                    filters.search ||
                    ''
                );
        }

        if (
            filters.rainOnly !==
            undefined
        ) {
            currentFilters.rainOnly =
                Boolean(
                    filters.rainOnly
                );
        }

        if (
            filters.acceptedOnly !==
            undefined
        ) {
            currentFilters.acceptedOnly =
                Boolean(
                    filters.acceptedOnly
                );
        }

        if (
            filters.maximumArrivalMinutes !==
            undefined
        ) {
            const numericValue =
                toFiniteNumber(
                    filters
                        .maximumArrivalMinutes,
                    NaN
                );

            currentFilters
                .maximumArrivalMinutes =
                Number.isFinite(
                    numericValue
                ) &&
                numericValue > 0
                    ? numericValue
                    : null;
        }

        if (
            Array.isArray(
                filters.riskLevels
            )
        ) {
            currentFilters.riskLevels =
                filters.riskLevels
                    .map(
                        (value) =>
                            String(value)
                                .trim()
                                .toLowerCase()
                    )
                    .filter(Boolean);
        }

        if (
            filters.sortMode !==
            undefined
        ) {
            const sortMode =
                String(
                    filters.sortMode
                )
                    .trim()
                    .toLowerCase();

            currentFilters.sortMode =
                SUPPORTED_SORT_MODES
                    .includes(
                        sortMode
                    )
                    ? sortMode
                    : 'priority';
        }

        interactionState.lastFilterAt =
            Date.now();

        interactionState.lastFilterAtIso =
            new Date(
                interactionState
                    .lastFilterAt
            ).toISOString();

        interactionState.filterCount +=
            1;

        if (
            options.apply !==
            false
        ) {
            applyUIFilters();
        }

        dispatchUIEvent(
            UI_EVENT_NAMES
                .filtersChanged,
            {
                filters:
                    getUIFilters(),

                timestamp:
                    interactionState
                        .lastFilterAt,

                timestampIso:
                    interactionState
                        .lastFilterAtIso
            }
        );

        return getUIFilters();
    }

    /**
     * Reset active filters.
     *
     * @param {Object} options
     * @returns {Object}
     */
    function resetUIFilters(
        options = {}
    ) {
        const interactionState =
            ensureUIInteractionState();

        interactionState.filters = {
            ...DEFAULT_UI_FILTERS,

            riskLevels:
                DEFAULT_UI_FILTERS
                    .riskLevels
                    .slice()
        };

        syncToolbarWithFilters();

        if (
            options.apply !==
            false
        ) {
            applyUIFilters();
        }

        return getUIFilters();
    }

    /**
     * Test prediction against filters.
     *
     * @param {Object} prediction
     * @param {Object} filters
     * @returns {boolean}
     */
    function predictionMatchesFilters(
        prediction,
        filters
    ) {
        if (
            filters.rainOnly &&
            !prediction.willRain
        ) {
            return false;
        }

        if (
            filters.acceptedOnly &&
            !prediction.accepted
        ) {
            return false;
        }

        if (
            filters
                .maximumArrivalMinutes !==
                null
        ) {
            if (
                !Number.isFinite(
                    prediction
                        .arrivalMinutes
                ) ||
                prediction
                    .arrivalMinutes >
                    filters
                        .maximumArrivalMinutes
            ) {
                return false;
            }
        }

        if (
            Array.isArray(
                filters.riskLevels
            ) &&
            filters
                .riskLevels
                .length > 0 &&
            !filters
                .riskLevels
                .includes(
                    prediction
                        .riskLevel
                )
        ) {
            return false;
        }

        const search =
            normalizeSearchText(
                filters.search
            );

        if (search) {
            const searchableText =
                normalizeSearchText([
                    prediction.cityName,
                    prediction
                        .secondaryCityName,
                    prediction.cityId,
                    prediction.riskText,
                    prediction.statusText
                ]
                    .filter(Boolean)
                    .join(' '));

            if (
                !searchableText.includes(
                    search
                )
            ) {
                return false;
            }
        }

        return true;
    }

    /**
     * Sort UI predictions.
     *
     * @param {Array<Object>} predictions
     * @param {string} sortMode
     * @returns {Array<Object>}
     */
    function sortFilteredPredictions(
        predictions,
        sortMode
    ) {
        const sorted =
            predictions.slice();

        switch (sortMode) {
            case 'arrival':
                return sorted.sort(
                    (left, right) => {
                        const leftValue =
                            Number.isFinite(
                                left
                                    .arrivalMinutes
                            )
                                ? left
                                    .arrivalMinutes
                                : Number
                                    .POSITIVE_INFINITY;

                        const rightValue =
                            Number.isFinite(
                                right
                                    .arrivalMinutes
                            )
                                ? right
                                    .arrivalMinutes
                                : Number
                                    .POSITIVE_INFINITY;

                        return (
                            leftValue -
                            rightValue
                        );
                    }
                );

            case 'confidence':
                return sorted.sort(
                    (left, right) =>
                        right.confidence -
                        left.confidence
                );

            case 'probability':
                return sorted.sort(
                    (left, right) =>
                        right.probability -
                        left.probability
                );

            case 'intensity':
                return sorted.sort(
                    (left, right) =>
                        right.intensity -
                        left.intensity
                );

            case 'city':
                return sorted.sort(
                    (left, right) =>
                        String(
                            left.cityName
                        ).localeCompare(
                            String(
                                right.cityName
                            ),
                            detectUILanguage() ===
                                'ar'
                                ? 'ar'
                                : 'en'
                        )
                );

            case 'priority':
            default:
                return sortUIPredictions(
                    sorted
                );
        }
    }

    /**
     * Get current rendered predictions.
     *
     * @returns {Array<Object>}
     */
    function getRenderedUIPredictions() {
        if (
            !runtimeState.ui ||
            !Array.isArray(
                runtimeState.ui
                    .lastRenderedPredictions
            )
        ) {
            return [];
        }

        return runtimeState.ui
            .lastRenderedPredictions
            .slice();
    }

    /**
     * Apply active filters.
     *
     * @param {Object} options
     * @returns {Object}
     */
    function applyUIFilters(
        options = {}
    ) {
        const interactionState =
            ensureUIInteractionState();

        const discovery =
            discoverUIElements();

        const container =
            options.container ||
            discovery.cardsContainer;

        if (!container) {
            return {
                applied:
                    false,

                reason:
                    'cards_container_not_found'
            };
        }

        const filters =
            getUIFilters();

        const predictions =
            getRenderedUIPredictions();

        const filtered =
            predictions.filter(
                (prediction) =>
                    predictionMatchesFilters(
                        prediction,
                        filters
                    )
            );

        const sorted =
            sortFilteredPredictions(
                filtered,
                filters.sortMode
            );

        const cards =
            Array.from(
                container.querySelectorAll(
                    '.rain-arrival-card[data-city-id]'
                )
            );

        const cardMap =
            new Map(
                cards.map(
                    (card) => [
                        String(
                            card.getAttribute(
                                'data-city-id'
                            ) ||
                            ''
                        ),
                        card
                    ]
                )
            );

        for (
            const card
            of cards
        ) {
            card.classList.add(
                'rain-arrival-card--hidden'
            );
        }

        for (
            const prediction
            of sorted
        ) {
            const card =
                cardMap.get(
                    String(
                        prediction.cityId ||
                        ''
                    )
                );

            if (!card) {
                continue;
            }

            card.classList.remove(
                'rain-arrival-card--hidden'
            );

            container.appendChild(
                card
            );
        }

        updateFilterEmptyState(
            container,
            sorted.length ===
                0
        );

        updateVisibleCount(
            sorted.length
        );

        const summary =
            buildUISummary(
                sorted
            );

        renderUISummary(
            summary,
            detectUILanguage()
        );

        return {
            applied:
                true,

            total:
                predictions.length,

            visible:
                sorted.length,

            hidden:
                predictions.length -
                sorted.length,

            filters,

            summary
        };
    }

    /**
     * Update no-results state.
     *
     * @param {Element} container
     * @param {boolean} visible
     */
    function updateFilterEmptyState(
        container,
        visible
    ) {
        let emptyState =
            container.querySelector(
                '.rain-arrival-filter-empty'
            );

        if (!emptyState) {
            emptyState =
                globalObject
                    .document
                    .createElement(
                        'div'
                    );

            emptyState.className =
                'rain-arrival-filter-empty';

            emptyState.textContent =
                detectUILanguage() ===
                    'ar'
                    ? 'لا توجد نتائج مطابقة للفلاتر الحالية.'
                    : 'No results match the current filters.';

            container.appendChild(
                emptyState
            );
        }

        emptyState.classList.toggle(
            'rain-arrival-filter-empty--visible',
            visible
        );
    }

    /**
     * Update toolbar visible count.
     *
     * @param {number} count
     */
    function updateVisibleCount(
        count
    ) {
        const interactionState =
            ensureUIInteractionState();

        const toolbar =
            interactionState.toolbar ||
            findToolbar();

        if (!toolbar) {
            return;
        }

        const countElement =
            toolbar.querySelector(
                '[data-rain-arrival-visible-count]'
            );

        if (countElement) {
            countElement.textContent =
                formatNumber(
                    count,
                    0,
                    detectUILanguage()
                );
        }
    }

    /**
     * Synchronize toolbar controls.
     */
    function syncToolbarWithFilters() {
        const interactionState =
            ensureUIInteractionState();

        const toolbar =
            interactionState.toolbar ||
            findToolbar();

        if (!toolbar) {
            return;
        }

        const filters =
            interactionState.filters;

        const searchInput =
            toolbar.querySelector(
                '[data-rain-arrival-search]'
            );

        const maxTimeSelect =
            toolbar.querySelector(
                '[data-rain-arrival-max-time]'
            );

        const sortSelect =
            toolbar.querySelector(
                '[data-rain-arrival-sort]'
            );

        const rainOnlyButton =
            toolbar.querySelector(
                '[data-rain-arrival-rain-only]'
            );

        const acceptedOnlyButton =
            toolbar.querySelector(
                '[data-rain-arrival-accepted-only]'
            );

        if (searchInput) {
            searchInput.value =
                filters.search;
        }

        if (maxTimeSelect) {
            maxTimeSelect.value =
                filters
                    .maximumArrivalMinutes ===
                    null
                    ? ''
                    : String(
                        filters
                            .maximumArrivalMinutes
                    );
        }

        if (sortSelect) {
            sortSelect.value =
                filters.sortMode;
        }

        if (rainOnlyButton) {
            rainOnlyButton.setAttribute(
                'aria-pressed',
                filters.rainOnly
                    ? 'true'
                    : 'false'
            );
        }

        if (acceptedOnlyButton) {
            acceptedOnlyButton.setAttribute(
                'aria-pressed',
                filters.acceptedOnly
                    ? 'true'
                    : 'false'
            );
        }
    }

    /**
     * Bind toolbar events.
     *
     * @param {Element} toolbar
     */
    function bindToolbarEvents(
        toolbar
    ) {
        if (!toolbar) {
            return;
        }

        const searchInput =
            toolbar.querySelector(
                '[data-rain-arrival-search]'
            );

        const maxTimeSelect =
            toolbar.querySelector(
                '[data-rain-arrival-max-time]'
            );

        const sortSelect =
            toolbar.querySelector(
                '[data-rain-arrival-sort]'
            );

        const rainOnlyButton =
            toolbar.querySelector(
                '[data-rain-arrival-rain-only]'
            );

        const acceptedOnlyButton =
            toolbar.querySelector(
                '[data-rain-arrival-accepted-only]'
            );

        const resetButton =
            toolbar.querySelector(
                '[data-rain-arrival-reset]'
            );

        if (searchInput) {
            searchInput.addEventListener(
                'input',
                () => {
                    setUIFilters({
                        search:
                            searchInput.value
                    });
                }
            );
        }

        if (maxTimeSelect) {
            maxTimeSelect.addEventListener(
                'change',
                () => {
                    setUIFilters({
                        maximumArrivalMinutes:
                            maxTimeSelect.value
                    });
                }
            );
        }

        if (sortSelect) {
            sortSelect.addEventListener(
                'change',
                () => {
                    setUIFilters({
                        sortMode:
                            sortSelect.value
                    });
                }
            );
        }

        if (rainOnlyButton) {
            rainOnlyButton.addEventListener(
                'click',
                () => {
                    const filters =
                        getUIFilters();

                    setUIFilters({
                        rainOnly:
                            !filters.rainOnly
                    });

                    syncToolbarWithFilters();
                }
            );
        }

        if (acceptedOnlyButton) {
            acceptedOnlyButton.addEventListener(
                'click',
                () => {
                    const filters =
                        getUIFilters();

                    setUIFilters({
                        acceptedOnly:
                            !filters
                                .acceptedOnly
                    });

                    syncToolbarWithFilters();
                }
            );
        }

        if (resetButton) {
            resetButton.addEventListener(
                'click',
                () => {
                    resetUIFilters();
                }
            );
        }

        syncToolbarWithFilters();
    }

    /**
     * Dispatch UI event.
     *
     * @param {string} eventName
     * @param {Object} detail
     * @returns {boolean}
     */
    function dispatchUIEvent(
        eventName,
        detail
    ) {
        if (
            typeof globalObject
                .dispatchEvent !==
                'function' ||
            typeof globalObject
                .CustomEvent !==
                'function'
        ) {
            return false;
        }

        globalObject.dispatchEvent(
            new globalObject.CustomEvent(
                eventName,
                {
                    detail
                }
            )
        );

        return true;
    }

    /**
     * Select one city card.
     *
     * @param {string} cityId
     * @param {Object} options
     * @returns {Object}
     */
    function selectCityCard(
        cityId,
        options = {}
    ) {
        const interactionState =
            ensureUIInteractionState();

        const discovery =
            discoverUIElements();

        const container =
            options.container ||
            discovery.cardsContainer;

        if (!container) {
            return {
                selected:
                    false,

                reason:
                    'cards_container_not_found'
            };
        }

        const cards =
            Array.from(
                container.querySelectorAll(
                    '.rain-arrival-card[data-city-id]'
                )
            );

        let selectedCard =
            null;

        for (const card of cards) {
            const matches =
                String(
                    card.getAttribute(
                        'data-city-id'
                    )
                ) ===
                String(cityId);

            card.setAttribute(
                'aria-selected',
                matches
                    ? 'true'
                    : 'false'
            );

            if (matches) {
                selectedCard =
                    card;
            }
        }

        if (!selectedCard) {
            return {
                selected:
                    false,

                reason:
                    'city_card_not_found',

                cityId
            };
        }

        interactionState.selectedCityId =
            String(cityId);

        interactionState
            .lastInteractionAt =
            Date.now();

        interactionState
            .lastInteractionAtIso =
            new Date(
                interactionState
                    .lastInteractionAt
            ).toISOString();

        interactionState
            .interactionCount +=
            1;

        if (
            options.scrollIntoView ===
                true &&
            typeof selectedCard
                .scrollIntoView ===
                'function'
        ) {
            selectedCard.scrollIntoView({
                behavior:
                    options.scrollBehavior ||
                    'smooth',

                block:
                    'nearest'
            });
        }

        const prediction =
            getRenderedUIPredictions()
                .find(
                    (item) =>
                        String(
                            item.cityId
                        ) ===
                        String(cityId)
                ) ||
            null;

        dispatchUIEvent(
            UI_EVENT_NAMES
                .citySelected,
            {
                cityId:
                    String(cityId),

                prediction,

                selectedAt:
                    interactionState
                        .lastInteractionAt,

                selectedAtIso:
                    interactionState
                        .lastInteractionAtIso
            }
        );

        if (
            options.focusMap !==
            false
        ) {
            requestMapFocus(
                prediction,
                options
            );
        }

        return {
            selected:
                true,

            cityId:
                String(cityId),

            prediction,

            card:
                selectedCard
        };
    }

    /**
     * Discover map controller.
     *
     * @returns {Object|null}
     */
    function discoverMapController() {
        const candidates = [
            globalObject
                .RainGuardMap,

            globalObject
                .rainGuardMap,

            globalObject
                .NationalMap,

            globalObject
                .nationalMap,

            globalObject
                .map,

            globalObject
                .RainGuardAI &&
            globalObject
                .RainGuardAI
                .map,

            globalObject
                .RainGuardAI &&
            globalObject
                .RainGuardAI
                .V32 &&
            globalObject
                .RainGuardAI
                .V32
                .map
        ];

        return candidates.find(
            (candidate) =>
                candidate &&
                typeof candidate ===
                    'object'
        ) ||
        null;
    }

    /**
     * Focus map on prediction city.
     *
     * @param {Object|null} prediction
     * @param {Object} options
     * @returns {Object}
     */
    function requestMapFocus(
        prediction,
        options = {}
    ) {
        if (
            !prediction ||
            !Number.isFinite(
                toFiniteNumber(
                    prediction.latitude,
                    NaN
                )
            ) ||
            !Number.isFinite(
                toFiniteNumber(
                    prediction.longitude,
                    NaN
                )
            )
        ) {
            return {
                focused:
                    false,

                reason:
                    'prediction_coordinates_unavailable'
            };
        }

        const latitude =
            toFiniteNumber(
                prediction.latitude,
                null
            );

        const longitude =
            toFiniteNumber(
                prediction.longitude,
                null
            );

        const zoom =
            toFiniteNumber(
                options.zoom,
                9
            );

        const mapController =
            options.map ||
            discoverMapController();

        let focused =
            false;

        let methodName =
            null;

        if (mapController) {
            const methods = [
                {
                    name:
                        'flyTo',

                    execute:
                        () =>
                            mapController.flyTo(
                                [
                                    latitude,
                                    longitude
                                ],
                                zoom
                            )
                },
                {
                    name:
                        'setView',

                    execute:
                        () =>
                            mapController.setView(
                                [
                                    latitude,
                                    longitude
                                ],
                                zoom
                            )
                },
                {
                    name:
                        'panTo',

                    execute:
                        () =>
                            mapController.panTo(
                                {
                                    lat:
                                        latitude,

                                    lng:
                                        longitude
                                }
                            )
                },
                {
                    name:
                        'focusCity',

                    execute:
                        () =>
                            mapController.focusCity(
                                prediction.cityId,
                                {
                                    latitude,
                                    longitude,
                                    zoom
                                }
                            )
                },
                {
                    name:
                        'focusLocation',

                    execute:
                        () =>
                            mapController.focusLocation({
                                latitude,
                                longitude,
                                zoom,
                                cityId:
                                    prediction.cityId
                            })
                }
            ];

            for (
                const method
                of methods
            ) {
                if (
                    typeof mapController[
                        method.name
                    ] !==
                    'function'
                ) {
                    continue;
                }

                try {
                    method.execute();

                    focused =
                        true;

                    methodName =
                        method.name;

                    break;
                } catch (error) {
                    log(
                        'debug',
                        `Map focus method failed: ${method.name}`,
                        normalizeError(
                            error,
                            {
                                method:
                                    method.name,

                                cityId:
                                    prediction.cityId
                            }
                        )
                    );
                }
            }
        }

        dispatchUIEvent(
            UI_EVENT_NAMES
                .mapFocusRequested,
            {
                focused,

                methodName,

                cityId:
                    prediction.cityId,

                latitude,

                longitude,

                zoom,

                timestamp:
                    Date.now(),

                timestampIso:
                    nowIso()
            }
        );

        return {
            focused,

            methodName,

            cityId:
                prediction.cityId,

            latitude,

            longitude,

            zoom
        };
    }

    /**
     * Resolve card from event target.
     *
     * @param {EventTarget} target
     * @returns {Element|null}
     */
    function resolveEventCard(
        target
    ) {
        if (
            !target ||
            typeof target.closest !==
                'function'
        ) {
            return null;
        }

        return target.closest(
            '.rain-arrival-card[data-city-id]'
        );
    }

    /**
     * Install card event delegation.
     *
     * @param {Object} options
     * @returns {Object}
     */
    function installCardEventDelegation(
        options = {}
    ) {
        const interactionState =
            ensureUIInteractionState();

        const discovery =
            discoverUIElements();

        const container =
            options.container ||
            discovery.cardsContainer;

        if (!container) {
            return {
                installed:
                    false,

                reason:
                    'cards_container_not_found'
            };
        }

        if (
            interactionState
                .eventDelegationInstalled &&
            interactionState
                .eventDelegationContainer ===
                container
        ) {
            return {
                installed:
                    false,

                reused:
                    true
            };
        }

        removeCardEventDelegation();

        const clickHandler =
            (event) => {
                const card =
                    resolveEventCard(
                        event.target
                    );

                if (!card) {
                    return;
                }

                selectCityCard(
                    card.getAttribute(
                        'data-city-id'
                    ),
                    {
                        focusMap:
                            true
                    }
                );
            };

        const keyboardHandler =
            (event) => {
                const card =
                    resolveEventCard(
                        event.target
                    );

                if (!card) {
                    return;
                }

                if (
                    event.key ===
                        'Enter' ||
                    event.key ===
                        ' '
                ) {
                    event.preventDefault();

                    selectCityCard(
                        card.getAttribute(
                            'data-city-id'
                        ),
                        {
                            focusMap:
                                true
                        }
                    );

                    return;
                }

                if (
                    ![
                        'ArrowRight',
                        'ArrowLeft',
                        'ArrowUp',
                        'ArrowDown'
                    ].includes(
                        event.key
                    )
                ) {
                    return;
                }

                const visibleCards =
                    Array.from(
                        container.querySelectorAll(
                            '.rain-arrival-card[data-city-id]:not(.rain-arrival-card--hidden)'
                        )
                    );

                const currentIndex =
                    visibleCards.indexOf(
                        card
                    );

                if (
                    currentIndex < 0 ||
                    visibleCards.length ===
                        0
                ) {
                    return;
                }

                event.preventDefault();

                const isPrevious =
                    event.key ===
                        'ArrowLeft' ||
                    event.key ===
                        'ArrowUp';

                const nextIndex =
                    (
                        currentIndex +
                        (
                            isPrevious
                                ? -1
                                : 1
                        ) +
                        visibleCards.length
                    ) %
                    visibleCards.length;

                visibleCards[
                    nextIndex
                ].focus();
            };

        container.addEventListener(
            'click',
            clickHandler
        );

        container.addEventListener(
            'keydown',
            keyboardHandler
        );

        interactionState
            .eventDelegationInstalled =
            true;

        interactionState
            .eventDelegationContainer =
            container;

        interactionState
            .eventDelegationHandler =
            clickHandler;

        interactionState
            .keyboardHandler =
            keyboardHandler;

        prepareCardAccessibility(
            container
        );

        return {
            installed:
                true,

            reused:
                false
        };
    }

    /**
     * Remove card event delegation.
     *
     * @returns {boolean}
     */
    function removeCardEventDelegation() {
        const interactionState =
            ensureUIInteractionState();

        const container =
            interactionState
                .eventDelegationContainer;

        if (!container) {
            return false;
        }

        if (
            interactionState
                .eventDelegationHandler
        ) {
            container.removeEventListener(
                'click',
                interactionState
                    .eventDelegationHandler
            );
        }

        if (
            interactionState
                .keyboardHandler
        ) {
            container.removeEventListener(
                'keydown',
                interactionState
                    .keyboardHandler
            );
        }

        interactionState
            .eventDelegationInstalled =
            false;

        interactionState
            .eventDelegationContainer =
            null;

        interactionState
            .eventDelegationHandler =
            null;

        interactionState.keyboardHandler =
            null;

        return true;
    }

    /**
     * Prepare cards for keyboard access.
     *
     * @param {Element|null} container
     */
    function prepareCardAccessibility(
        container = null
    ) {
        const resolvedContainer =
            container ||
            discoverUIElements()
                .cardsContainer;

        if (!resolvedContainer) {
            return;
        }

        resolvedContainer
            .querySelectorAll(
                '.rain-arrival-card[data-city-id]'
            )
            .forEach(
                (card) => {
                    if (
                        !card.hasAttribute(
                            'tabindex'
                        )
                    ) {
                        card.setAttribute(
                            'tabindex',
                            '0'
                        );
                    }

                    card.setAttribute(
                        'role',
                        'button'
                    );

                    if (
                        !card.hasAttribute(
                            'aria-selected'
                        )
                    ) {
                        card.setAttribute(
                            'aria-selected',
                            'false'
                        );
                    }

                    const cityName =
                        card.querySelector(
                            '.rain-arrival-card__city'
                        )
                            ?.textContent
                            ?.trim() ||
                        card.getAttribute(
                            'data-city-id'
                        ) ||
                        '';

                    card.setAttribute(
                        'aria-label',
                        detectUILanguage() ===
                            'ar'
                            ? `عرض تفاصيل توقع المطر لمدينة ${cityName}`
                            : `View rain arrival forecast for ${cityName}`
                    );
                }
            );
    }

    /**
     * Recalculate remaining arrival time.
     *
     * @param {Object} prediction
     * @param {number} now
     * @returns {number|null}
     */
    function calculateRemainingArrivalMinutes(
        prediction,
        now
    ) {
        if (
            Number.isFinite(
                toFiniteNumber(
                    prediction.arrivalTime,
                    NaN
                )
            )
        ) {
            return Math.max(
                0,
                (
                    prediction.arrivalTime -
                    now
                ) /
                60000
            );
        }

        if (
            Number.isFinite(
                toFiniteNumber(
                    prediction.arrivalMinutes,
                    NaN
                )
            ) &&
            Number.isFinite(
                toFiniteNumber(
                    prediction.generatedAt,
                    NaN
                )
            )
        ) {
            const elapsedMinutes =
                (
                    now -
                    prediction.generatedAt
                ) /
                60000;

            return Math.max(
                0,
                prediction.arrivalMinutes -
                elapsedMinutes
            );
        }

        return null;
    }

    /**
     * Update live countdown values.
     *
     * @returns {Object}
     */
    function updateArrivalCountdowns() {
        const interactionState =
            ensureUIInteractionState();

        const discovery =
            discoverUIElements();

        const container =
            discovery.cardsContainer;

        if (!container) {
            return {
                updated:
                    false,

                reason:
                    'cards_container_not_found'
            };
        }

        const language =
            detectUILanguage();

        const now =
            Date.now();

        const predictions =
            getRenderedUIPredictions();

        const predictionMap =
            new Map(
                predictions.map(
                    (prediction) => [
                        String(
                            prediction.cityId ||
                            ''
                        ),
                        prediction
                    ]
                )
            );

        let updatedCards =
            0;

        container
            .querySelectorAll(
                '.rain-arrival-card[data-city-id]'
            )
            .forEach(
                (card) => {
                    const cityId =
                        String(
                            card.getAttribute(
                                'data-city-id'
                            ) ||
                            ''
                        );

                    const prediction =
                        predictionMap.get(
                            cityId
                        );

                    if (!prediction) {
                        return;
                    }

                    const remainingMinutes =
                        calculateRemainingArrivalMinutes(
                            prediction,
                            now
                        );

                    const arrivalValue =
                        card.querySelector(
                            '.rain-arrival-card__arrival-value'
                        );

                    const arrivalTime =
                        card.querySelector(
                            '.rain-arrival-card__arrival-time'
                        );

                    const footer =
                        card.querySelector(
                            '.rain-arrival-card__footer span:last-child'
                        );

                    if (
                        arrivalValue &&
                        remainingMinutes !==
                            null
                    ) {
                        arrivalValue.textContent =
                            formatArrivalDuration(
                                remainingMinutes,
                                language
                            );
                    }

                    if (
                        arrivalTime &&
                        prediction.arrivalTime
                    ) {
                        arrivalTime.textContent =
                            formatDateTime(
                                prediction.arrivalTime,
                                language
                            );
                    }

                    if (footer) {
                        footer.textContent =
                            `${getUIText(
                                'updated',
                                language
                            )}: ${formatDateTime(
                                now,
                                language
                            )}`;
                    }

                    updatedCards +=
                        1;
                }
            );

        interactionState
            .countdownUpdateCount +=
            1;

        dispatchUIEvent(
            UI_EVENT_NAMES
                .countdownUpdated,
            {
                updatedCards,

                timestamp:
                    now,

                timestampIso:
                    new Date(
                        now
                    ).toISOString()
            }
        );

        return {
            updated:
                true,

            updatedCards,

            timestamp:
                now,

            timestampIso:
                new Date(
                    now
                ).toISOString()
        };
    }

    /**
     * Start countdown updates.
     *
     * @param {Object} options
     * @returns {Object}
     */
    function startArrivalCountdown(
        options = {}
    ) {
        const interactionState =
            ensureUIInteractionState();

        stopArrivalCountdown();

        const intervalMs =
            Math.max(
                5000,
                toFiniteNumber(
                    options.intervalMs,
                    interactionState
                        .countdownIntervalMs
                )
            );

        interactionState
            .countdownIntervalMs =
            intervalMs;

        updateArrivalCountdowns();

        interactionState
            .countdownTimerId =
            globalObject.setInterval(
                updateArrivalCountdowns,
                intervalMs
            );

        return {
            started:
                true,

            intervalMs
        };
    }

    /**
     * Stop countdown updates.
     *
     * @returns {boolean}
     */
    function stopArrivalCountdown() {
        const interactionState =
            ensureUIInteractionState();

        if (
            interactionState
                .countdownTimerId ===
                null
        ) {
            return false;
        }

        globalObject.clearInterval(
            interactionState
                .countdownTimerId
        );

        interactionState
            .countdownTimerId =
            null;

        return true;
    }

    /**
     * Refresh UI interactions after rendering.
     *
     * @param {Object} options
     * @returns {Object}
     */
    function refreshUIInteractions(
        options = {}
    ) {
        installUIStyles();

        const toolbarResult =
            createToolbar({
                createFallback:
                    options.createFallback ===
                    true,

                language:
                    options.language
            });

        const delegationResult =
            installCardEventDelegation();

        prepareCardAccessibility();

        syncToolbarWithFilters();

        const filterResult =
            applyUIFilters();

        if (
            options.startCountdown !==
            false
        ) {
            startArrivalCountdown({
                intervalMs:
                    options
                        .countdownIntervalMs
            });
        }

        return {
            refreshed:
                true,

            toolbar:
                toolbarResult,

            delegation:
                delegationResult,

            filters:
                filterResult,

            countdownActive:
                ensureUIInteractionState()
                    .countdownTimerId !==
                    null
        };
    }

    /**
     * Return UI interaction status.
     *
     * @returns {Object}
     */
    function getUIInteractionStatus() {
        const interactionState =
            ensureUIInteractionState();

        return {
            stylesInstalled:
                interactionState
                    .stylesInstalled,

            toolbarFound:
                Boolean(
                    interactionState.toolbar ||
                    findToolbar()
                ),

            toolbarCreated:
                interactionState
                    .toolbarCreated,

            eventDelegationInstalled:
                interactionState
                    .eventDelegationInstalled,

            countdownActive:
                interactionState
                    .countdownTimerId !==
                    null,

            countdownIntervalMs:
                interactionState
                    .countdownIntervalMs,

            selectedCityId:
                interactionState
                    .selectedCityId,

            filters:
                getUIFilters(),

            filterCount:
                interactionState
                    .filterCount,

            interactionCount:
                interactionState
                    .interactionCount,

            countdownUpdateCount:
                interactionState
                    .countdownUpdateCount,

            lastFilterAt:
                interactionState
                    .lastFilterAt,

            lastFilterAtIso:
                interactionState
                    .lastFilterAtIso,

            lastInteractionAt:
                interactionState
                    .lastInteractionAt,

            lastInteractionAtIso:
                interactionState
                    .lastInteractionAtIso
        };
    }

    /**
     * Wrap the existing render method.
     *
     * Ensures every new render receives:
     * - styles
     * - toolbar
     * - accessibility
     * - filters
     * - event delegation
     */
    function wrapPredictionRenderer() {
        if (
            integrationApi
                ._uiRendererWrapped ===
                true ||
            typeof integrationApi
                .renderPredictions !==
                'function'
        ) {
            return false;
        }

        const originalRenderer =
            integrationApi
                .renderPredictions
                .bind(
                    integrationApi
                );

        integrationApi
            .renderPredictions =
            function wrappedRenderPredictions(
                predictions,
                options = {}
            ) {
                const result =
                    originalRenderer(
                        predictions,
                        options
                    );

                if (
                    result &&
                    result.rendered
                ) {
                    refreshUIInteractions({
                        language:
                            options.language,

                        createFallback:
                            options
                                .createFallback ===
                                true,

                        countdownIntervalMs:
                            options
                                .countdownIntervalMs,

                        startCountdown:
                            options
                                .startCountdown !==
                                false
                    });
                }

                return result;
            };

        integrationApi
            ._uiRendererWrapped =
            true;

        return true;
    }

    /**
     * Extend runtime state.
     */
    ensureUIInteractionState();

    /**
     * Extend public API.
     */
    integrationApi
        .installUIStyles =
        installUIStyles;

    integrationApi
        .removeUIStyles =
        removeUIStyles;

    integrationApi
        .createArrivalToolbar =
        createToolbar;

    integrationApi
        .getUIFilters =
        getUIFilters;

    integrationApi
        .setUIFilters =
        setUIFilters;

    integrationApi
        .resetUIFilters =
        resetUIFilters;

    integrationApi
        .applyUIFilters =
        applyUIFilters;

    integrationApi
        .selectCityCard =
        selectCityCard;

    integrationApi
        .requestMapFocus =
        requestMapFocus;

    integrationApi
        .installCardEventDelegation =
        installCardEventDelegation;

    integrationApi
        .removeCardEventDelegation =
        removeCardEventDelegation;

    integrationApi
        .prepareCardAccessibility =
        prepareCardAccessibility;

    integrationApi
        .updateArrivalCountdowns =
        updateArrivalCountdowns;

    integrationApi
        .startArrivalCountdown =
        startArrivalCountdown;

    integrationApi
        .stopArrivalCountdown =
        stopArrivalCountdown;

    integrationApi
        .refreshUIInteractions =
        refreshUIInteractions;

    integrationApi
        .getUIInteractionStatus =
        getUIInteractionStatus;

    integrationApi.metadata = {
        ...integrationApi
            .metadata,

        currentPart:
            '2.2A-2',

        nextPart:
            '2.2B-1',

        status:
            'section_complete',

        productionReady:
            false,

        moduleClosed:
            true,

        capabilities: [
            ...new Set([
                ...(
                    Array.isArray(
                        integrationApi
                            .metadata
                            .capabilities
                    )
                        ? integrationApi
                            .metadata
                            .capabilities
                        : []
                ),

                'production_ui_styles',
                'arrival_toolbar',
                'city_search_filter',
                'rain_only_filter',
                'confidence_filter',
                'arrival_time_filter',
                'prediction_sorting',
                'live_arrival_countdown',
                'city_card_selection',
                'map_focus_bridge',
                'keyboard_navigation',
                'accessible_city_cards',
                'ui_event_dispatching'
            ])
        ]
    };

    /**
     * Extend internal API.
     */
    Object.assign(
        integrationApi._internals,
        {
            UI_STYLE_ELEMENT_ID,
            DEFAULT_UI_FILTERS,
            SUPPORTED_SORT_MODES,
            TOOLBAR_SELECTORS,
            UI_EVENT_NAMES,
            RAIN_ARRIVAL_UI_CSS,

            ensureUIInteractionState,
            findToolbar,
            buildToolbarHtml,
            normalizeSearchText,
            predictionMatchesFilters,
            sortFilteredPredictions,
            getRenderedUIPredictions,
            updateFilterEmptyState,
            updateVisibleCount,
            syncToolbarWithFilters,
            bindToolbarEvents,
            dispatchUIEvent,
            discoverMapController,
            resolveEventCard,
            calculateRemainingArrivalMinutes,
            wrapPredictionRenderer
        }
    );

    /**
     * Initialize styles and interaction bridge.
     */
    try {
        installUIStyles();

        wrapPredictionRenderer();

        const discovery =
            discoverUIElements();

        if (discovery.cardsContainer) {
            refreshUIInteractions({
                startCountdown:
                    true
            });
        }
    } catch (error) {
        log(
            'debug',
            'Rain arrival UI interaction initialization failed.',
            normalizeError(
                error,
                {
                    part:
                        '2.2A-2'
                }
            )
        );
    }

    log(
        'info',
        'Rain arrival integration Part 2.2A-2 loaded.',
        {
            uiInteractions:
                getUIInteractionStatus()
        }
    );
})(
    typeof globalThis !==
        'undefined'
        ? globalThis
        : (
            typeof window !==
                'undefined'
                ? window
                : this
        )
);

/**
 * RainGuard AI V32
 * Rain Arrival Integration Engine
 *
 * Part:
 * 2.2B-1
 *
 * Responsibilities:
 * - Discover compatible map instances
 * - Create and update rain arrival markers
 * - Render storm paths and arrival corridors
 * - Synchronize map layers with latest predictions
 * - Support Leaflet-compatible maps
 * - Support generic map adapters
 * - Manage map layer lifecycle
 */

(function rainArrivalIntegrationV32MapVisualization(globalObject) {
    'use strict';

    if (
        !globalObject ||
        !globalObject.RainGuardAI ||
        !globalObject.RainGuardAI.V32 ||
        !globalObject.RainGuardAI.V32
            .rainArrivalIntegration
    ) {
        throw new Error(
            'Rain Arrival Integration Part 2.2A-2 must be loaded before Part 2.2B-1.'
        );
    }

    const integrationApi =
        globalObject
            .RainGuardAI
            .V32
            .rainArrivalIntegration;

    const runtimeState =
        integrationApi._state;

    const internal =
        integrationApi._internals;

    const {
        toFiniteNumber,
        clamp,
        createRuntimeId,
        nowIso,
        normalizeError,
        normalizeUILanguage,
        detectUILanguage,
        getUIText,
        formatNumber,
        formatArrivalDuration,
        formatDateTime,
        escapeHtml,
        normalizeRiskLevel,
        dispatchUIEvent,
        UI_EVENT_NAMES,
        log
    } = internal;

    /**
     * Supported map provider types.
     */
    const MAP_PROVIDER_TYPES =
        Object.freeze({
            LEAFLET:
                'leaflet',

            GENERIC:
                'generic',

            CUSTOM:
                'custom',

            UNKNOWN:
                'unknown'
        });

    /**
     * Map layer names.
     */
    const MAP_LAYER_NAMES =
        Object.freeze({
            ARRIVAL_MARKERS:
                'rain_arrival_markers',

            STORM_CELLS:
                'rain_arrival_storm_cells',

            STORM_PATHS:
                'rain_arrival_storm_paths',

            ARRIVAL_CORRIDORS:
                'rain_arrival_corridors',

            HIGH_RISK_AREAS:
                'rain_arrival_high_risk_areas'
        });

    /**
     * Map event names.
     */
    const MAP_EVENT_NAMES =
        Object.freeze({
            initialized:
                'rainguard:v32:rain-arrival:map-initialized',

            layersUpdated:
                'rainguard:v32:rain-arrival:map-layers-updated',

            markerSelected:
                'rainguard:v32:rain-arrival:map-marker-selected',

            cleared:
                'rainguard:v32:rain-arrival:map-cleared',

            error:
                'rainguard:v32:rain-arrival:map-error'
        });

    /**
     * Default map visualization configuration.
     */
    const DEFAULT_MAP_VISUALIZATION_CONFIG =
        Object.freeze({
            enabled:
                true,

            showArrivalMarkers:
                true,

            showStormCells:
                true,

            showStormPaths:
                true,

            showArrivalCorridors:
                true,

            showOnlyRainExpected:
                true,

            showRejectedPredictions:
                false,

            maximumMarkers:
                100,

            maximumStormCells:
                50,

            maximumStormPaths:
                50,

            markerMinimumConfidence:
                25,

            autoFitBounds:
                false,

            fitBoundsPadding:
                40,

            markerPopup:
                true,

            markerTooltip:
                true,

            animatePaths:
                true,

            highRiskPulse:
                true,

            defaultZoom:
                8,

            corridorWidthKm:
                8,

            layerOpacity:
                0.85
        });

    /**
     * Ensure map visualization state.
     *
     * @returns {Object}
     */
    function ensureMapState() {
        if (
            !runtimeState.mapVisualization ||
            typeof runtimeState
                .mapVisualization !==
                'object'
        ) {
            runtimeState.mapVisualization = {
                initialized:
                    false,

                enabled:
                    true,

                map:
                    null,

                providerType:
                    MAP_PROVIDER_TYPES.UNKNOWN,

                adapter:
                    null,

                configuration: {
                    ...DEFAULT_MAP_VISUALIZATION_CONFIG
                },

                layers:
                    new Map(),

                markers:
                    new Map(),

                stormCellLayers:
                    new Map(),

                stormPathLayers:
                    new Map(),

                corridorLayers:
                    new Map(),

                selectedMarkerId:
                    null,

                lastUpdateAt:
                    null,

                lastUpdateAtIso:
                    null,

                lastPredictionRunId:
                    null,

                lastUnifiedInputId:
                    null,

                updateCount:
                    0,

                failureCount:
                    0,

                lastError:
                    null
            };
        }

        if (
            !(runtimeState
                .mapVisualization
                .layers instanceof Map)
        ) {
            runtimeState
                .mapVisualization
                .layers =
                new Map();
        }

        if (
            !(runtimeState
                .mapVisualization
                .markers instanceof Map)
        ) {
            runtimeState
                .mapVisualization
                .markers =
                new Map();
        }

        if (
            !(runtimeState
                .mapVisualization
                .stormCellLayers instanceof Map)
        ) {
            runtimeState
                .mapVisualization
                .stormCellLayers =
                new Map();
        }

        if (
            !(runtimeState
                .mapVisualization
                .stormPathLayers instanceof Map)
        ) {
            runtimeState
                .mapVisualization
                .stormPathLayers =
                new Map();
        }

        if (
            !(runtimeState
                .mapVisualization
                .corridorLayers instanceof Map)
        ) {
            runtimeState
                .mapVisualization
                .corridorLayers =
                new Map();
        }

        return runtimeState
            .mapVisualization;
    }

    /**
     * Merge map visualization configuration.
     *
     * @param {Object} configuration
     * @returns {Object}
     */
    function configureMapVisualization(
        configuration = {}
    ) {
        const mapState =
            ensureMapState();

        mapState.configuration = {
            ...mapState.configuration,
            ...configuration
        };

        mapState.enabled =
            mapState
                .configuration
                .enabled !==
            false;

        return {
            ...mapState.configuration
        };
    }

    /**
     * Discover map instance.
     *
     * @param {Object} options
     * @returns {Object|null}
     */
    function discoverMapInstance(
        options = {}
    ) {
        const directCandidates = [
            options.map,

            options.mapInstance,

            globalObject
                .RainGuardMap,

            globalObject
                .rainGuardMap,

            globalObject
                .NationalMap,

            globalObject
                .nationalMap,

            globalObject
                .mainMap,

            globalObject
                .map,

            globalObject
                .RainGuardAI &&
            globalObject
                .RainGuardAI
                .map,

            globalObject
                .RainGuardAI &&
            globalObject
                .RainGuardAI
                .V32 &&
            globalObject
                .RainGuardAI
                .V32
                .map
        ];

        for (
            const candidate
            of directCandidates
        ) {
            if (
                candidate &&
                typeof candidate ===
                    'object'
            ) {
                return candidate;
            }
        }

        if (
            typeof globalObject
                .document !==
                'undefined'
        ) {
            const mapElements =
                globalObject
                    .document
                    .querySelectorAll(
                        '[data-map-instance], #map, #rain-map, #national-map'
                    );

            for (
                const element
                of mapElements
            ) {
                const candidates = [
                    element._leaflet_map,
                    element._map,
                    element.map,
                    element.mapInstance
                ];

                const found =
                    candidates.find(
                        (candidate) =>
                            candidate &&
                            typeof candidate ===
                                'object'
                    );

                if (found) {
                    return found;
                }
            }
        }

        return null;
    }

    /**
     * Detect map provider type.
     *
     * @param {Object} map
     * @returns {string}
     */
    function detectMapProviderType(
        map
    ) {
        if (!map) {
            return MAP_PROVIDER_TYPES.UNKNOWN;
        }

        if (
            typeof map.addLayer ===
                'function' &&
            typeof map.removeLayer ===
                'function' &&
            (
                typeof map.setView ===
                    'function' ||
                typeof map.flyTo ===
                    'function'
            )
        ) {
            return MAP_PROVIDER_TYPES.LEAFLET;
        }

        if (
            typeof map.addMarker ===
                'function' ||
            typeof map.addPolyline ===
                'function' ||
            typeof map.addCircle ===
                'function'
        ) {
            return MAP_PROVIDER_TYPES.GENERIC;
        }

        return MAP_PROVIDER_TYPES.CUSTOM;
    }

    /**
     * Resolve Leaflet namespace.
     *
     * @returns {Object|null}
     */
    function resolveLeafletNamespace() {
        return (
            globalObject.L ||
            globalObject.Leaflet ||
            null
        );
    }

    /**
     * Validate coordinates.
     *
     * @param {*} latitude
     * @param {*} longitude
     * @returns {boolean}
     */
    function areValidCoordinates(
        latitude,
        longitude
    ) {
        const lat =
            toFiniteNumber(
                latitude,
                NaN
            );

        const lng =
            toFiniteNumber(
                longitude,
                NaN
            );

        return (
            Number.isFinite(lat) &&
            Number.isFinite(lng) &&
            lat >= -90 &&
            lat <= 90 &&
            lng >= -180 &&
            lng <= 180
        );
    }

    /**
     * Normalize map coordinates.
     *
     * @param {*} latitude
     * @param {*} longitude
     * @returns {Object|null}
     */
    function normalizeMapCoordinates(
        latitude,
        longitude
    ) {
        if (
            !areValidCoordinates(
                latitude,
                longitude
            )
        ) {
            return null;
        }

        return {
            latitude:
                toFiniteNumber(
                    latitude,
                    null
                ),

            longitude:
                toFiniteNumber(
                    longitude,
                    null
                )
        };
    }

    /**
     * Resolve risk visualization values.
     *
     * @param {*} riskLevel
     * @returns {Object}
     */
    function getRiskVisualization(
        riskLevel
    ) {
        const normalizedRisk =
            normalizeRiskLevel(
                riskLevel
            );

        const configurations = {
            minimal: {
                className:
                    'rain-arrival-map-marker--minimal',

                color:
                    '#94a3b8',

                radius:
                    7,

                weight:
                    1
            },

            low: {
                className:
                    'rain-arrival-map-marker--low',

                color:
                    '#38bdf8',

                radius:
                    8,

                weight:
                    2
            },

            moderate: {
                className:
                    'rain-arrival-map-marker--moderate',

                color:
                    '#facc15',

                radius:
                    9,

                weight:
                    2
            },

            high: {
                className:
                    'rain-arrival-map-marker--high',

                color:
                    '#fb923c',

                radius:
                    11,

                weight:
                    3
            },

            extreme: {
                className:
                    'rain-arrival-map-marker--extreme',

                color:
                    '#ef4444',

                radius:
                    13,

                weight:
                    4
            },

            unknown: {
                className:
                    'rain-arrival-map-marker--unknown',

                color:
                    '#64748b',

                radius:
                    7,

                weight:
                    1
            }
        };

        return {
            riskLevel:
                normalizedRisk,

            ...configurations[
                normalizedRisk
            ]
        };
    }

    /**
     * Create marker popup HTML.
     *
     * @param {Object} prediction
     * @param {string} language
     * @returns {string}
     */
    function buildMapPopupHtml(
        prediction,
        language
    ) {
        const cityName =
            language ===
                'ar'
                ? (
                    prediction.cityNameAr ||
                    prediction.cityName ||
                    prediction.cityId ||
                    '—'
                )
                : (
                    prediction.cityName ||
                    prediction.cityNameAr ||
                    prediction.cityId ||
                    '—'
                );

        const riskLevel =
            normalizeRiskLevel(

    /**
 * RainGuard AI V32
 * Rain Arrival Integration Engine
 *
 * Part:
 * 2.2B-1
 *
 * Responsibilities:
 * - Discover compatible map instances
 * - Register rain arrival map consumer
 * - Create and update city prediction markers
 * - Create storm-to-city arrival paths
 * - Normalize map rendering options
 * - Support Leaflet and generic map controllers
 * - Synchronize map layers with prediction cycles
 */

(function rainArrivalIntegrationV32MapBridge(globalObject) {
    'use strict';

    if (
        !globalObject ||
        !globalObject.RainGuardAI ||
        !globalObject.RainGuardAI.V32 ||
        !globalObject.RainGuardAI.V32
            .rainArrivalIntegration
    ) {
        throw new Error(
            'Rain Arrival Integration Part 2.2A-2 must be loaded before Part 2.2B-1.'
        );
    }

    const integrationApi =
        globalObject
            .RainGuardAI
            .V32
            .rainArrivalIntegration;

    const runtimeState =
        integrationApi._state;

    const internal =
        integrationApi._internals;

    const {
        toFiniteNumber,
        clamp,
        createRuntimeId,
        nowIso,
        normalizeError,
        escapeHtml,
        normalizeUILanguage,
        detectUILanguage,
        getUIText,
        formatNumber,
        formatDateTime,
        formatArrivalDuration,
        normalizeRiskLevel,
        dispatchUIEvent,
        log
    } = internal;

    /**
     * Built-in map consumer name.
     */
    const MAP_CONSUMER_NAME =
        'rain_arrival_map_consumer';

    /**
     * Map layer identifiers.
     */
    const MAP_LAYER_IDS =
        Object.freeze({
            markers:
                'rain_arrival_markers_v32',

            paths:
                'rain_arrival_paths_v32',

            stormCells:
                'rain_arrival_storm_cells_v32',

            affectedAreas:
                'rain_arrival_affected_areas_v32'
        });

    /**
     * Supported map adapter types.
     */
    const MAP_ADAPTER_TYPES =
        Object.freeze({
            LEAFLET:
                'leaflet',

            MAPBOX:
                'mapbox',

            GENERIC:
                'generic',

            NONE:
                'none'
        });

    /**
     * Default map rendering options.
     */
    const DEFAULT_MAP_OPTIONS =
        Object.freeze({
            enabled:
                true,

            showMarkers:
                true,

            showPaths:
                true,

            showStormCells:
                true,

            showAffectedAreas:
                false,

            showRejected:
                false,

            showNoRain:
                false,

            fitBounds:
                false,

            animate:
                true,

            markerMinimumConfidence:
                20,

            pathMinimumConfidence:
                30,

            stormCellMinimumConfidence:
                20,

            maximumMarkers:
                100,

            maximumPaths:
                100,

            maximumStormCells:
                100,

            cityMarkerRadius:
                10,

            pathWeight:
                3,

            stormCellOpacity:
                0.2,

            stormCellWeight:
                2,

            affectedAreaOpacity:
                0.08,

            defaultZoom:
                7,

            focusZoom:
                10,

            zIndexOffset:
                800
        });

    /**
     * Risk colors.
     */
    const MAP_RISK_COLORS =
        Object.freeze({
            minimal:
                '#94a3b8',

            low:
                '#38bdf8',

            moderate:
                '#facc15',

            high:
                '#fb923c',

            extreme:
                '#ef4444',

            unknown:
                '#64748b'
        });

    /**
     * Ensure map state.
     *
     * @returns {Object}
     */
    function ensureMapState() {
        if (
            !runtimeState.map ||
            typeof runtimeState.map !==
                'object'
        ) {
            runtimeState.map = {
                adapterType:
                    MAP_ADAPTER_TYPES.NONE,

                mapInstance:
                    null,

                consumerRegistered:
                    false,

                consumerName:
                    MAP_CONSUMER_NAME,

                options: {
                    ...DEFAULT_MAP_OPTIONS
                },

                layers: {
                    markers:
                        null,

                    paths:
                        null,

                    stormCells:
                        null,

                    affectedAreas:
                        null
                },

                markerIndex:
                    new Map(),

                pathIndex:
                    new Map(),

                stormCellIndex:
                    new Map(),

                affectedAreaIndex:
                    new Map(),

                lastRenderAt:
                    null,

                lastRenderAtIso:
                    null,

                lastPredictionRunId:
                    null,

                renderCount:
                    0,

                renderFailures:
                    0,

                renderedMarkerCount:
                    0,

                renderedPathCount:
                    0,

                renderedStormCellCount:
                    0,

                renderedAffectedAreaCount:
                    0,

                lastBounds:
                    null,

                initialized:
                    false
            };
        }

        if (
            !(runtimeState
                .map
                .markerIndex instanceof Map)
        ) {
            runtimeState
                .map
                .markerIndex =
                new Map();
        }

        if (
            !(runtimeState
                .map
                .pathIndex instanceof Map)
        ) {
            runtimeState
                .map
                .pathIndex =
                new Map();
        }

        if (
            !(runtimeState
                .map
                .stormCellIndex instanceof Map)
        ) {
            runtimeState
                .map
                .stormCellIndex =
                new Map();
        }

        if (
            !(runtimeState
                .map
                .affectedAreaIndex instanceof Map)
        ) {
            runtimeState
                .map
                .affectedAreaIndex =
                new Map();
        }

        return runtimeState.map;
    }

    /**
     * Normalize map options.
     *
     * @param {Object} options
     * @returns {Object}
     */
    function normalizeMapOptions(
        options = {}
    ) {
        const mapState =
            ensureMapState();

        const normalized = {
            ...DEFAULT_MAP_OPTIONS,
            ...mapState.options,
            ...options
        };

        normalized.enabled =
            normalized.enabled !==
            false;

        normalized.showMarkers =
            normalized.showMarkers !==
            false;

        normalized.showPaths =
            normalized.showPaths !==
            false;

        normalized.showStormCells =
            normalized.showStormCells !==
            false;

        normalized.showAffectedAreas =
            normalized.showAffectedAreas ===
            true;

        normalized.showRejected =
            normalized.showRejected ===
            true;

        normalized.showNoRain =
            normalized.showNoRain ===
            true;

        normalized.fitBounds =
            normalized.fitBounds ===
            true;

        normalized.animate =
            normalized.animate !==
            false;

        normalized.markerMinimumConfidence =
            clamp(
                toFiniteNumber(
                    normalized
                        .markerMinimumConfidence,
                    DEFAULT_MAP_OPTIONS
                        .markerMinimumConfidence
                ),
                0,
                100
            );

        normalized.pathMinimumConfidence =
            clamp(
                toFiniteNumber(
                    normalized
                        .pathMinimumConfidence,
                    DEFAULT_MAP_OPTIONS
                        .pathMinimumConfidence
                ),
                0,
                100
            );

        normalized.stormCellMinimumConfidence =
            clamp(
                toFiniteNumber(
                    normalized
                        .stormCellMinimumConfidence,
                    DEFAULT_MAP_OPTIONS
                        .stormCellMinimumConfidence
                ),
                0,
                100
            );

        normalized.maximumMarkers =
            Math.max(
                1,
                Math.round(
                    toFiniteNumber(
                        normalized
                            .maximumMarkers,
                        DEFAULT_MAP_OPTIONS
                            .maximumMarkers
                    )
                )
            );

        normalized.maximumPaths =
            Math.max(
                1,
                Math.round(
                    toFiniteNumber(
                        normalized
                            .maximumPaths,
                        DEFAULT_MAP_OPTIONS
                            .maximumPaths
                    )
                )
            );

        normalized.maximumStormCells =
            Math.max(
                1,
                Math.round(
                    toFiniteNumber(
                        normalized
                            .maximumStormCells,
                        DEFAULT_MAP_OPTIONS
                            .maximumStormCells
                    )
                )
            );

        normalized.cityMarkerRadius =
            Math.max(
                4,
                toFiniteNumber(
                    normalized
                        .cityMarkerRadius,
                    DEFAULT_MAP_OPTIONS
                        .cityMarkerRadius
                )
            );

        normalized.pathWeight =
            Math.max(
                1,
                toFiniteNumber(
                    normalized
                        .pathWeight,
                    DEFAULT_MAP_OPTIONS
                        .pathWeight
                )
            );

        normalized.stormCellOpacity =
            clamp(
                toFiniteNumber(
                    normalized
                        .stormCellOpacity,
                    DEFAULT_MAP_OPTIONS
                        .stormCellOpacity
                ),
                0,
                1
            );

        normalized.stormCellWeight =
            Math.max(
                1,
                toFiniteNumber(
                    normalized
                        .stormCellWeight,
                    DEFAULT_MAP_OPTIONS
                        .stormCellWeight
                )
            );

        normalized.affectedAreaOpacity =
            clamp(
                toFiniteNumber(
                    normalized
                        .affectedAreaOpacity,
                    DEFAULT_MAP_OPTIONS
                        .affectedAreaOpacity
                ),
                0,
                1
            );

        normalized.defaultZoom =
            clamp(
                toFiniteNumber(
                    normalized.defaultZoom,
                    DEFAULT_MAP_OPTIONS
                        .defaultZoom
                ),
                1,
                20
            );

        normalized.focusZoom =
            clamp(
                toFiniteNumber(
                    normalized.focusZoom,
                    DEFAULT_MAP_OPTIONS
                        .focusZoom
                ),
                1,
                20
            );

        mapState.options =
            normalized;

        return {
            ...normalized
        };
    }

    /**
     * Discover map instance.
     *
     * @param {Object} options
     * @returns {Object|null}
     */
    function discoverRainArrivalMap(
        options = {}
    ) {
        const candidates = [
            options.map,

            runtimeState
                .map &&
            runtimeState
                .map
                .mapInstance,

            globalObject
                .RainGuardMap,

            globalObject
                .rainGuardMap,

            globalObject
                .NationalWeatherMap,

            globalObject
                .nationalWeatherMap,

            globalObject
                .NationalMap,

            globalObject
                .nationalMap,

            globalObject
                .weatherMap,

            globalObject
                .map,

            globalObject
                .RainGuardAI &&
            globalObject
                .RainGuardAI
                .map,

            globalObject
                .RainGuardAI &&
            globalObject
                .RainGuardAI
                .V32 &&
            globalObject
                .RainGuardAI
                .V32
                .map
        ];

        for (
            const candidate
            of candidates
        ) {
            if (
                candidate &&
                typeof candidate ===
                    'object'
            ) {
                return candidate;
            }
        }

        return null;
    }

    /**
     * Detect map adapter type.
     *
     * @param {Object|null} mapInstance
     * @returns {string}
     */
    function detectMapAdapterType(
        mapInstance
    ) {
        if (!mapInstance) {
            return MAP_ADAPTER_TYPES.NONE;
        }

        if (
            globalObject.L &&
            typeof globalObject
                .L
                .layerGroup ===
                'function' &&
            (
                typeof mapInstance
                    .addLayer ===
                    'function' ||
                typeof mapInstance
                    .getCenter ===
                    'function'
            )
        ) {
            return MAP_ADAPTER_TYPES.LEAFLET;
        }

        if (
            typeof mapInstance
                .addSource ===
                'function' &&
            typeof mapInstance
                .addLayer ===
                'function' &&
            typeof mapInstance
                .getSource ===
                'function'
        ) {
            return MAP_ADAPTER_TYPES.MAPBOX;
        }

        return MAP_ADAPTER_TYPES.GENERIC;
    }

    /**
     * Resolve map coordinates.
     *
     * @param {*} latitude
     * @param {*} longitude
     * @returns {{latitude:number,longitude:number}|null}
     */
    function resolveMapCoordinates(
        latitude,
        longitude
    ) {
        const normalizedLatitude =
            toFiniteNumber(
                latitude,
                NaN
            );

        const normalizedLongitude =
            toFiniteNumber(
                longitude,
                NaN
            );

        if (
            !Number.isFinite(
                normalizedLatitude
            ) ||
            !Number.isFinite(
                normalizedLongitude
            ) ||
            normalizedLatitude < -90 ||
            normalizedLatitude > 90 ||
            normalizedLongitude < -180 ||
            normalizedLongitude > 180
        ) {
            return null;
        }

        return {
            latitude:
                normalizedLatitude,

            longitude:
                normalizedLongitude
        };
    }

    /**
     * Resolve risk color.
     *
     * @param {*} riskLevel
     * @returns {string}
     */
    function resolveMapRiskColor(
        riskLevel
    ) {
        const normalizedRisk =
            normalizeRiskLevel(
                riskLevel
            );

        return MAP_RISK_COLORS[
            normalizedRisk
        ] ||
        MAP_RISK_COLORS.unknown;
    }

    /**
     * Build city marker radius.
     *
     * @param {Object} prediction
     * @param {Object} options
     * @returns {number}
     */
    function calculateCityMarkerRadius(
        prediction,
        options
    ) {
        const probability =
            clamp(
                prediction.probability,
                0,
                100
            );

        const intensity =
            Math.max(
                0,
                toFiniteNumber(
                    prediction.intensity,
                    0
                )
            );

        const baseRadius =
            options.cityMarkerRadius;

        return clamp(
            baseRadius +
            probability /
            20 +
            intensity /
            30,
            baseRadius,
            baseRadius * 2.5
        );
    }

    /**
     * Build marker popup HTML.
     *
     * @param {Object} prediction
     * @param {string} language
     * @returns {string}
     */
    function buildMapPopupHtml(
        prediction,
        language
    ) {
        const cityName =
            language ===
                'ar'
                ? (
                    prediction
                        .cityNameAr ||
                    prediction
                        .cityName ||
                    prediction
                        .cityId ||
                    '—'
                )
                : (
                    prediction
                        .cityName ||
                    prediction
                        .cityNameAr ||
                    prediction
                        .cityId ||
                    '—'
                );

        const riskLevel =
            normalizeRiskLevel(
                prediction.riskLevel
            );

        return `
            <div
                class="rain-arrival-map-popup"
                dir="${language ===
                    'ar'
                    ? 'rtl'
                    : 'ltr'}"
            >
                <strong class="rain-arrival-map-popup__city">
                    ${escapeHtml(
                        cityName
                    )}
                </strong>

                <div class="rain-arrival-map-popup__row">
                    <span>
                        ${escapeHtml(
                            getUIText(
                                'arrival',
                                language
                            )
                        )}
                    </span>

                    <strong>
                        ${escapeHtml(
                            formatArrivalDuration(
                                prediction
                                    .arrivalMinutes,
                                language
                            )
                        )}
                    </strong>
                </div>

                <div class="rain-arrival-map-popup__row">
                    <span>
                        ${escapeHtml(
                            getUIText(
                                'probability',
                                language
                            )
                        )}
                    </span>

                    <strong>
                        ${escapeHtml(
                            formatNumber(
                                prediction
                                    .probability,
                                0,
                                language
                            )
                        )}%
                    </strong>
                </div>

                <div class="rain-arrival-map-popup__row">
                    <span>
                        ${escapeHtml(
                            getUIText(
                                'confidence',
                                language
                            )
                        )}
                    </span>

                    <strong>
                        ${escapeHtml(
                            formatNumber(
                                prediction
                                    .confidence,
                                0,
                                language
                            )
                        )}%
                    </strong>
                </div>

                <div class="rain-arrival-map-popup__row">
                    <span>
                        ${escapeHtml(
                            getUIText(
                                'risk',
                                language
                            )
                        )}
                    </span>

                    <strong>
                        ${escapeHtml(
                            getUIText(
                                riskLevel,
                                language
                            )
                        )}
                    </strong>
                </div>

                <div class="rain-arrival-map-popup__row">
                    <span>
                        ${escapeHtml(
                            getUIText(
                                'updated',
                                language
                            )
                        )}
                    </span>

                    <strong>
                        ${escapeHtml(
                            formatDateTime(
                                prediction
                                    .generatedAt,
                                language
                            )
                        )}
                    </strong>
                </div>
            </div>
        `;
    }

    /**
     * Filter predictions for map.
     *
     * @param {Array<Object>} predictions
     * @param {Object} options
     * @returns {Array<Object>}
     */
    function filterMapPredictions(
        predictions,
        options
    ) {
        return predictions
            .filter(Boolean)
            .filter(
                (prediction) => {
                    if (
                        !resolveMapCoordinates(
                            prediction.latitude,
                            prediction.longitude
                        )
                    ) {
                        return false;
                    }

                    if (
                        prediction.accepted ===
                            false &&
                        !options.showRejected
                    ) {
                        return false;
                    }

                    if (
                        !prediction.willRain &&
                        !options.showNoRain
                    ) {
                        return false;
                    }

                    return (
                        toFiniteNumber(
                            prediction.confidence,
                            0
                        ) >=
                        options
                            .markerMinimumConfidence
                    );
                }
            )
            .sort(
                (left, right) => {
                    const leftArrival =
                        Number.isFinite(
                            toFiniteNumber(
                                left
                                    .arrivalMinutes,
                                NaN
                            )
                        )
                            ? left
                                .arrivalMinutes
                            : Number
                                .POSITIVE_INFINITY;

                    const rightArrival =
                        Number.isFinite(
                            toFiniteNumber(
                                right
                                    .arrivalMinutes,
                                NaN
                            )
                        )
                            ? right
                                .arrivalMinutes
                            : Number
                                .POSITIVE_INFINITY;

                    if (
                        leftArrival !==
                        rightArrival
                    ) {
                        return (
                            leftArrival -
                            rightArrival
                        );
                    }

                    return (
                        toFiniteNumber(
                            right.confidence,
                            0
                        ) -
                        toFiniteNumber(
                            left.confidence,
                            0
                        )
                    );
                }
            )
            .slice(
                0,
                options.maximumMarkers
            );
    }

    /**
     * Ensure Leaflet layer groups.
     *
     * @param {Object} mapInstance
     * @returns {Object}
     */
    function ensureLeafletLayerGroups(
        mapInstance
    ) {
        const mapState =
            ensureMapState();

        if (
            !globalObject.L ||
            typeof globalObject
                .L
                .layerGroup !==
                'function'
        ) {
            throw new Error(
                'Leaflet library is unavailable.'
            );
        }

        const layerKeys = [
            'markers',
            'paths',
            'stormCells',
            'affectedAreas'
        ];

        for (
            const layerKey
            of layerKeys
        ) {
            if (
                mapState.layers[
                    layerKey
                ]
            ) {
                continue;
            }

            const layerGroup =
                globalObject
                    .L
                    .layerGroup();

            if (
                typeof layerGroup
                    .addTo ===
                    'function'
            ) {
                layerGroup.addTo(
                    mapInstance
                );
            } else if (
                typeof mapInstance
                    .addLayer ===
                    'function'
            ) {
                mapInstance.addLayer(
                    layerGroup
                );
            }

            mapState.layers[
                layerKey
            ] =
                layerGroup;
        }

        return mapState.layers;
    }

    /**
     * Clear one Leaflet layer.
     *
     * @param {Object|null} layer
     */
    function clearLeafletLayer(
        layer
    ) {
        if (
            layer &&
            typeof layer
                .clearLayers ===
                'function'
        ) {
            layer.clearLayers();
        }
    }

    /**
     * Create Leaflet city marker.
     *
     * @param {Object} prediction
     * @param {Object} options
     * @param {string} language
     * @returns {Object|null}
     */
    function createLeafletCityMarker(
        prediction,
        options,
        language
    ) {
        const coordinates =
            resolveMapCoordinates(
                prediction.latitude,
                prediction.longitude
            );

        if (
            !coordinates ||
            !globalObject.L
        ) {
            return null;
        }

        const color =
            resolveMapRiskColor(
                prediction.riskLevel
            );

        const radius =
            calculateCityMarkerRadius(
                prediction,
                options
            );

        let marker =
            null;

        if (
            typeof globalObject
                .L
                .circleMarker ===
                'function'
        ) {
            marker =
                globalObject
                    .L
                    .circleMarker(
                        [
                            coordinates
                                .latitude,
                            coordinates
                                .longitude
                        ],
                        {
                            radius,
                            color,
                            weight:
                                2,
                            opacity:
                                0.95,
                            fillColor:
                                color,
                            fillOpacity:
                                prediction.accepted ===
                                    false
                                    ? 0.25
                                    : 0.65,
                            pane:
                                options.markerPane ||
                                undefined
                        }
                    );
        } else if (
            typeof globalObject
                .L
                .marker ===
                'function'
        ) {
            marker =
                globalObject
                    .L
                    .marker(
                        [
                            coordinates
                                .latitude,
                            coordinates
                                .longitude
                        ],
                        {
                            riseOnHover:
                                true,
                            zIndexOffset:
                                options
                                    .zIndexOffset
                        }
                    );
        }

        if (!marker) {
            return null;
        }

        if (
            typeof marker
                .bindPopup ===
                'function'
        ) {
            marker.bindPopup(
                buildMapPopupHtml(
                    prediction,
                    language
                ),
                {
                    maxWidth:
                        320,
                    className:
                        'rain-arrival-map-popup-container'
                }
            );
        }

        if (
            typeof marker
                .on ===
                'function'
        ) {
            marker.on(
                'click',
                () => {
                    if (
                        typeof integrationApi
                            .selectCityCard ===
                            'function'
                    ) {
                        integrationApi
                            .selectCityCard(
                                prediction.cityId,
                                {
                                    focusMap:
                                        false,
                                    scrollIntoView:
                                        true
                                }
                            );
                    }

                    dispatchUIEvent(
                        'rainguard:v32:rain-arrival:map-marker-selected',
                        {
                            cityId:
                                prediction.cityId,

                            prediction,

                            selectedAt:
                                Date.now(),

                            selectedAtIso:
                                nowIso()
                        }
                    );
                }
            );
        }

        marker._rainArrivalPrediction =
            prediction;

        return marker;
    }

    /**
     * Resolve source storm cell.
     *
     * @param {Object} prediction
     * @param {Array<Object>} stormCells
     * @returns {Object|null}
     */
    function resolvePredictionStormCell(
        prediction,
        stormCells
    ) {
        if (
            !Array.isArray(
                stormCells
            ) ||
            stormCells.length ===
                0
        ) {
            return null;
        }

        if (
            prediction.sourceCellId
        ) {
            const matched =
                stormCells.find(
                    (cell) =>
                        String(cell.id) ===
                        String(
                            prediction
                                .sourceCellId
                        )
                );

            if (matched) {
                return matched;
            }
        }

        let nearestCell =
            null;

        let nearestDistance =
            Number
                .POSITIVE_INFINITY;

        const cityCoordinates =
            resolveMapCoordinates(
                prediction.latitude,
                prediction.longitude
            );

        if (!cityCoordinates) {
            return null;
        }

        for (
            const stormCell
            of stormCells
        ) {
            const cellCoordinates =
                resolveMapCoordinates(
                    stormCell.latitude,
                    stormCell.longitude
                );

            if (!cellCoordinates) {
                continue;
            }

            const latitudeDifference =
                cellCoordinates
                    .latitude -
                cityCoordinates
                    .latitude;

            const longitudeDifference =
                cellCoordinates
                    .longitude -
                cityCoordinates
                    .longitude;

            const distance =
                Math.sqrt(
                    latitudeDifference ** 2 +
                    longitudeDifference ** 2
                );

            if (
                distance <
                nearestDistance
            ) {
                nearestDistance =
                    distance;

                nearestCell =
                    stormCell;
            }
        }

        return nearestCell;
    }

    /**
     * Create Leaflet path.
     *
     * @param {Object} prediction
     * @param {Array<Object>} stormCells
     * @param {Object} options
     * @returns {Object|null}
     */
    function createLeafletArrivalPath(
        prediction,
        stormCells,
        options
    ) {
        if (
            !globalObject.L ||
            typeof globalObject
                .L
                .polyline !==
                'function'
        ) {
            return null;
        }

        const cityCoordinates =
            resolveMapCoordinates(
                prediction.latitude,
                prediction.longitude
            );

        const stormCell =
            resolvePredictionStormCell(
                prediction,
                stormCells
            );

        const stormCoordinates =
            stormCell
                ? resolveMapCoordinates(
                    stormCell.latitude,
                    stormCell.longitude
                )
                : null;

        if (
            !cityCoordinates ||
            !stormCoordinates
        ) {
            return null;
        }

        const color =
            resolveMapRiskColor(
                prediction.riskLevel
            );

        const path =
            globalObject
                .L
                .polyline(
                    [
                        [
                            stormCoordinates
                                .latitude,
                            stormCoordinates
                                .longitude
                        ],
                        [
                            cityCoordinates
                                .latitude,
                            cityCoordinates
                                .longitude
                        ]
                    ],
                    {
                        color,
                        weight:
                            options.pathWeight,
                        opacity:
                            0.8,
                        dashArray:
                            options.animate
                                ? '8 10'
                                : null,
                        lineCap:
                            'round',
                        lineJoin:
                            'round'
                    }
                );

        path._rainArrivalPrediction =
            prediction;

        path._rainArrivalStormCell =
            stormCell;

        return path;
    }

    /**
     * Create Leaflet storm cell.
     *
     * @param {Object} stormCell
     * @param {Object} options
     * @param {string} language
     * @returns {Object|null}
     */
    function createLeafletStormCell(
        stormCell,
        options,
        language
    ) {
        if (
            !globalObject.L ||
            typeof globalObject
                .L
                .circle !==
                'function'
        ) {
            return null;
        }

        const coordinates =
            resolveMapCoordinates(
                stormCell.latitude,
                stormCell.longitude
            );

        if (!coordinates) {
            return null;
        }

        const radiusKm =
            Math.max(
                1,
                toFiniteNumber(
                    stormCell.radiusKm,
                    10
                )
            );

        const riskLevel =
            normalizeRiskLevel(
                stormCell.riskLevel
            );

        const color =
            resolveMapRiskColor(
                riskLevel
            );

        const circle =
            globalObject
                .L
                .circle(
                    [
                        coordinates
                            .latitude,
                        coordinates
                            .longitude
                    ],
                    {
                        radius:
                            radiusKm *
                            1000,
                        color,
                        weight:
                            options
                                .stormCellWeight,
                        opacity:
                            0.8,
                        fillColor:
                            color,
                        fillOpacity:
                            options
                                .stormCellOpacity
                    }
                );

        if (
            typeof circle
                .bindPopup ===
                'function'
        ) {
            circle.bindPopup(`
                <div
                    class="rain-arrival-map-popup"
                    dir="${language ===
                        'ar'
                        ? 'rtl'
                        : 'ltr'}"
                >
                    <strong>
                        ${escapeHtml(
                            language ===
                                'ar'
                                ? 'خلية رعدية'
                                : 'Storm Cell'
                        )}
                    </strong>

                    <div class="rain-arrival-map-popup__row">
                        <span>
                            ${escapeHtml(
                                getUIText(
                                    'intensity',
                                    language
                                )
                            )}
                        </span>

                        <strong>
                            ${escapeHtml(
                                formatNumber(
                                    stormCell.intensity,
                                    1,
                                    language
                                )
                            )}
                        </strong>
                    </div>

                    <div class="rain-arrival-map-popup__row">
                        <span>
                            ${escapeHtml(
                                getUIText(
                                    'confidence',
                                    language
                                )
                            )}
                        </span>

                        <strong>
                            ${escapeHtml(
                                formatNumber(
                                    stormCell.confidence,
                                    0,
                                    language
                                )
                            )}%
                        </strong>
                    </div>

                    <div class="rain-arrival-map-popup__row">
                        <span>
                            ${escapeHtml(
                                language ===
                                    'ar'
                                    ? 'نصف القطر'
                                    : 'Radius'
                            )}
                        </span>

                        <strong>
                            ${escapeHtml(
                                formatNumber(
                                    radiusKm,
                                    1,
                                    language
                                )
                            )} km
                        </strong>
                    </div>
                </div>
            `);
        }

        circle._rainArrivalStormCell =
            stormCell;

        return circle;
    }

    /**
     * Render Leaflet map layers.
     *
     * @param {Object} mapInstance
     * @param {Array<Object>} predictions
     * @param {Array<Object>} stormCells
     * @param {Object} options
     * @returns {Object}
     */
    function renderLeafletMapLayers(
        mapInstance,
        predictions,
        stormCells,
        options
    ) {
        const mapState =
            ensureMapState();

        const language =
            normalizeUILanguage(
                options.language ||
                detectUILanguage()
            );

        const layers =
            ensureLeafletLayerGroups(
                mapInstance
            );

        clearLeafletLayer(
            layers.markers
        );

        clearLeafletLayer(
            layers.paths
        );

        clearLeafletLayer(
            layers.stormCells
        );

        clearLeafletLayer(
            layers.affectedAreas
        );

        mapState.markerIndex
            .clear();

        mapState.pathIndex
            .clear();

        mapState.stormCellIndex
            .clear();

        mapState.affectedAreaIndex
            .clear();

        const coordinatesForBounds =
            [];

        let markerCount =
            0;

        let pathCount =
            0;

        let stormCellCount =
            0;

        if (options.showMarkers) {
            for (
                const prediction
                of predictions
                    .slice(
                        0,
                        options.maximumMarkers
                    )
            ) {
                const marker =
                    createLeafletCityMarker(
                        prediction,
                        options,
                        language
                    );

                if (!marker) {
                    continue;
                }

                layers.markers
                    .addLayer(
                        marker
                    );

                mapState.markerIndex
                    .set(
                        String(
                            prediction.cityId ||
                            prediction.id
                        ),
                        marker
                    );

                const coordinates =
                    resolveMapCoordinates(
                        prediction.latitude,
                        prediction.longitude
                    );

                if (coordinates) {
                    coordinatesForBounds
                        .push([
                            coordinates
                                .latitude,
                            coordinates
                                .longitude
                        ]);
                }

                markerCount +=
                    1;
            }
        }

        if (options.showPaths) {
            for (
                const prediction
                of predictions
                    .filter(
                        (item) =>
                            toFiniteNumber(
                                item.confidence,
                                0
                            ) >=
                            options
                                .pathMinimumConfidence
                    )
                    .slice(
                        0,
                        options.maximumPaths
                    )
            ) {
                const path =
                    createLeafletArrivalPath(
                        prediction,
                        stormCells,
                        options
                    );

                if (!path) {
                    continue;
                }

                layers.paths
                    .addLayer(
                        path
                    );

                mapState.pathIndex
                    .set(
                        String(
                            prediction.cityId ||
                            prediction.id
                        ),
                        path
                    );

                pathCount +=
                    1;
            }
        }

        if (options.showStormCells) {
            for (
                const stormCell
                of stormCells
                    .filter(
                        (cell) =>
                            toFiniteNumber(
                                cell.confidence,
                                0
                            ) >=
                            options
                                .stormCellMinimumConfidence
                    )
                    .slice(
                        0,
                        options.maximumStormCells
                    )
            ) {
                const circle =
                    createLeafletStormCell(
                        stormCell,
                        options,
                        language
                    );

                if (!circle) {
                    continue;
                }

                layers.stormCells
                    .addLayer(
                        circle
                    );

                mapState.stormCellIndex
                    .set(
                        String(
                            stormCell.id
                        ),
                        circle
                    );

                const coordinates =
                    resolveMapCoordinates(
                        stormCell.latitude,
                        stormCell.longitude
                    );

                if (coordinates) {
                    coordinatesForBounds
                        .push([
                            coordinates
                                .latitude,
                            coordinates
                                .longitude
                        ]);
                }

                stormCellCount +=
                    1;
            }
        }

        if (
            options.fitBounds &&
            coordinatesForBounds.length >
                0 &&
            globalObject.L &&
            typeof globalObject
                .L
                .latLngBounds ===
                'function' &&
            typeof mapInstance
                .fitBounds ===
                'function'
        ) {
            const bounds =
                globalObject
                    .L
                    .latLngBounds(
                        coordinatesForBounds
                    );

            mapInstance.fitBounds(
                bounds,
                {
                    padding: [
                        40,
                        40
                    ],
                    animate:
                        options.animate,
                    maxZoom:
                        options.focusZoom
                }
            );

            mapState.lastBounds =
                bounds;
        }

        return {
            adapterType:
                MAP_ADAPTER_TYPES
                    .LEAFLET,

            markerCount,

            pathCount,

            stormCellCount,

            affectedAreaCount:
                0
        };
    }

    /**
     * Render using generic map controller.
     *
     * @param {Object} mapInstance
     * @param {Array<Object>} predictions
     * @param {Array<Object>} stormCells
     * @param {Object} options
     * @returns {Promise<Object>}
     */
    async function renderGenericMapLayers(
        mapInstance,
        predictions,
        stormCells,
        options
    ) {
        const payload = {
            id:
                createRuntimeId(
                    'rain_arrival_map_payload'
                ),

            version:
                'V32',

            predictions,

            stormCells,

            options,

            generatedAt:
                Date.now(),

            generatedAtIso:
                nowIso()
        };

        const methods = [
            'renderRainArrival',
            'updateRainArrival',
            'setRainArrivalPredictions',
            'renderArrivalPredictions',
            'updateArrivalPredictions',
            'renderWeatherPredictions',
            'updateWeatherLayers'
        ];

        for (
            const methodName
            of methods
        ) {
            if (
                typeof mapInstance[
                    methodName
                ] !==
                'function'
            ) {
                continue;
            }

            const response =
                await Promise.resolve(
                    mapInstance[
                        methodName
                    ](
                        payload
                    )
                );

            return {
                adapterType:
                    MAP_ADAPTER_TYPES
                        .GENERIC,

                methodName,

                markerCount:
                    predictions.length,

                pathCount:
                    options.showPaths
                        ? predictions.length
                        : 0,

                stormCellCount:
                    options.showStormCells
                        ? stormCells.length
                        : 0,

                affectedAreaCount:
                    0,

                response
            };
        }

        throw new Error(
            'No compatible generic map rendering method was found.'
        );
    }

    /**
     * Initialize map bridge.
     *
     * @param {Object} options
     * @returns {Object}
     */
    function initializeMapBridge(
        options = {}
    ) {
        const mapState =
            ensureMapState();

        const mapInstance =
            discoverRainArrivalMap(
                options
            );

        const adapterType =
            detectMapAdapterType(
                mapInstance
            );

        mapState.mapInstance =
            mapInstance;

        mapState.adapterType =
            adapterType;

        mapState.options =
            normalizeMapOptions(
                options
            );

        mapState.initialized =
            Boolean(
                mapInstance
            );

        return {
            initialized:
                mapState.initialized,

            mapAvailable:
                Boolean(
                    mapInstance
                ),

            adapterType,

            options: {
                ...mapState.options
            }
        };
    }

    /**
     * Render predictions on map.
     *
     * @param {Array<Object>} predictions
     * @param {Object} context
     * @returns {Promise<Object>}
     */
    async function renderPredictionsOnMap(
        predictions,
        context = {}
    ) {
        const mapState =
            ensureMapState();

        const options =
            normalizeMapOptions({
                ...context.options,
                ...context
            });

        if (!options.enabled) {
            return {
                rendered:
                    false,

                reason:
                    'map_rendering_disabled'
            };
        }

        let mapInstance =
            context.map ||
            mapState.mapInstance ||
            discoverRainArrivalMap(
                context
            );

        if (!mapInstance) {
            const initialization =
                initializeMapBridge(
                    context
                );

            if (
                !initialization
                    .mapAvailable
            ) {
                mapState.renderFailures +=
                    1;

                return {
                    rendered:
                        false,

                    reason:
                        'map_instance_not_found'
                };
            }

            mapInstance =
                mapState.mapInstance;
        }

        const adapterType =
            detectMapAdapterType(
                mapInstance
            );

        mapState.adapterType =
            adapterType;

        mapState.mapInstance =
            mapInstance;

        const filteredPredictions =
            filterMapPredictions(
                Array.isArray(
                    predictions
                )
                    ? predictions
                    : [],
                options
            );

        const stormCells =
            Array.isArray(
                context.stormCells
            )
                ? context.stormCells
                : (
                    context.predictionInput &&
                    Array.isArray(
                        context
                            .predictionInput
                            .stormCells
                    )
                        ? context
                            .predictionInput
                            .stormCells
                        : []
                );

        const startedAt =
            Date.now();

        try {
            let renderingResult;

            switch (adapterType) {
                case MAP_ADAPTER_TYPES.LEAFLET:
                    renderingResult =
                        renderLeafletMapLayers(
                            mapInstance,
                            filteredPredictions,
                            stormCells,
                            options
                        );
                    break;

                case MAP_ADAPTER_TYPES.GENERIC:
                case MAP_ADAPTER_TYPES.MAPBOX:
                    renderingResult =
                        await renderGenericMapLayers(
                            mapInstance,
                            filteredPredictions,
                            stormCells,
                            options
                        );
                    break;

                default:
                    throw new Error(
                        'Unsupported or unavailable map adapter.'
                    );
            }

            const completedAt =
                Date.now();

            mapState.lastRenderAt =
                completedAt;

            mapState.lastRenderAtIso =
                new Date(
                    completedAt
                ).toISOString();

            mapState.renderCount +=
                1;

            mapState.renderedMarkerCount =
                renderingResult
                    .markerCount ||
                0;

            mapState.renderedPathCount =
                renderingResult
                    .pathCount ||
                0;

            mapState.renderedStormCellCount =
                renderingResult
                    .stormCellCount ||
                0;

            mapState.renderedAffectedAreaCount =
                renderingResult
                    .affectedAreaCount ||
                0;

            mapState.lastPredictionRunId =
                context.predictionRunId ||
                (
                    context.predictionRun
                        ? context
                            .predictionRun
                            .id
                        : null
                );

            const result = {
                rendered:
                    true,

                adapterType,

                predictionCount:
                    filteredPredictions
                        .length,

                stormCellInputCount:
                    stormCells.length,

                markerCount:
                    mapState
                        .renderedMarkerCount,

                pathCount:
                    mapState
                        .renderedPathCount,

                stormCellCount:
                    mapState
                        .renderedStormCellCount,

                affectedAreaCount:
                    mapState
                        .renderedAffectedAreaCount,

                startedAt,

                completedAt,

                completedAtIso:
                    mapState
                        .lastRenderAtIso,

                durationMs:
                    completedAt -
                    startedAt,

                options
            };

            dispatchUIEvent(
                'rainguard:v32:rain-arrival:map-updated',
                result
            );

            return result;
        } catch (error) {
            mapState.renderFailures +=
                1;

            const normalizedError =
                normalizeError(
                    error,
                    {
                        adapterType,

                        predictionCount:
                            filteredPredictions
                                .length,

                        stormCellCount:
                            stormCells.length
                    }
                );

            log(
                'error',
                'Rain arrival map rendering failed.',
                normalizedError
            );

            return {
                rendered:
                    false,

                adapterType,

                reason:
                    'map_rendering_failed',

                error:
                    normalizedError
            };
        }
    }

    /**
     * Extract map consumer predictions.
     *
     * @param {Object} payload
     * @returns {Array<Object>}
     */
    function extractMapConsumerPredictions(
        payload
    ) {
        if (
            payload &&
            Array.isArray(
                payload.predictions
            )
        ) {
            return payload.predictions;
        }

        if (
            payload &&
            payload.predictionRun &&
            Array.isArray(
                payload
                    .predictionRun
                    .predictions
            )
        ) {
            return payload
                .predictionRun
                .predictions;
        }

        if (
            payload &&
            payload.cycleResult &&
            payload
                .cycleResult
                .predictionRun &&
            Array.isArray(
                payload
                    .cycleResult
                    .predictionRun
                    .predictions
            )
        ) {
            return payload
                .cycleResult
                .predictionRun
                .predictions;
        }

        return [];
    }

    /**
     * Built-in map consumer.
     *
     * @param {Object} payload
     * @returns {Promise<Object>}
     */
    async function rainArrivalMapConsumer(
        payload
    ) {
        const predictions =
            extractMapConsumerPredictions(
                payload
            );

        return renderPredictionsOnMap(
            predictions,
            {
                map:
                    payload &&
                    payload.options
                        ? payload
                            .options
                            .map
                        : null,

                predictionRun:
                    payload
                        ? payload
                            .predictionRun
                        : null,

                predictionRunId:
                    payload &&
                    payload.predictionRun
                        ? payload
                            .predictionRun
                            .id
                        : null,

                predictionInput:
                    payload
                        ? payload
                            .predictionInput
                        : null,

                stormCells:
                    payload &&
                    payload.predictionInput &&
                    Array.isArray(
                        payload
                            .predictionInput
                            .stormCells
                    )
                        ? payload
                            .predictionInput
                            .stormCells
                        : [],

                language:
                    payload &&
                    payload.options
                        ? payload
                            .options
                            .language
                        : null,

                options:
                    payload &&
                    payload.options &&
                    payload
                        .options
                        .mapOptions
                        ? payload
                            .options
                            .mapOptions
                        : {}
            }
        );
    }

    /**
     * Register map consumer.
     *
     * @param {Object} options
     * @returns {Object}
     */
    function registerMapConsumer(
        options = {}
    ) {
        const mapState =
            ensureMapState();

        if (
            mapState.consumerRegistered &&
            options.force !==
                true
        ) {
            return {
                registered:
                    false,

                reused:
                    true,

                name:
                    mapState.consumerName
            };
        }

        const registration =
            integrationApi
                .registerResultConsumer(
                    mapState.consumerName,
                    rainArrivalMapConsumer,
                    {
                        enabled:
                            options.enabled !==
                            false,

                        priority:
                            options.priority ??
                            90,

                        consumerType:
                            'map',

                        metadata: {
                            builtIn:
                                true,

                            integrationVersion:
                                'V32',

                            target:
                                'rain_arrival_map'
                        }
                    }
                );

        mapState.consumerRegistered =
            true;

        return {
            registered:
                true,

            reused:
                false,

            name:
                mapState.consumerName,

            registration
        };
    }

    /**
     * Clear map layers.
     *
     * @returns {Object}
     */
    function clearRainArrivalMap() {
        const mapState =
            ensureMapState();

        if (
            mapState.adapterType ===
                MAP_ADAPTER_TYPES
                    .LEAFLET
        ) {
            clearLeafletLayer(
                mapState.layers.markers
            );

            clearLeafletLayer(
                mapState.layers.paths
            );

            clearLeafletLayer(
                mapState.layers
                    .stormCells
            );

            clearLeafletLayer(
                mapState.layers
                    .affectedAreas
            );
        } else if (
            mapState.mapInstance
        ) {
            const clearMethods = [
                'clearRainArrival',
                'clearArrivalPredictions',
                'removeRainArrivalLayers'
            ];

            for (
                const methodName
                of clearMethods
            ) {
                if (
                    typeof mapState
                        .mapInstance[
                        methodName
                    ] ===
                    'function'
                ) {
                    try {
                        mapState
                            .mapInstance[
                            methodName
                        ]();
                    } catch (error) {
                        log(
                            'debug',
                            `Map clear method failed: ${methodName}`,
                            normalizeError(
                                error
                            )
                        );
                    }

                    break;
                }
            }
        }

        mapState.markerIndex
            .clear();

        mapState.pathIndex
            .clear();

        mapState.stormCellIndex
            .clear();

        mapState.affectedAreaIndex
            .clear();

        mapState.renderedMarkerCount =
            0;

        mapState.renderedPathCount =
            0;

        mapState.renderedStormCellCount =
            0;

        mapState.renderedAffectedAreaCount =
            0;

        return {
            cleared:
                true,

            adapterType:
                mapState.adapterType
        };
    }

    /**
     * Focus map marker by city ID.
     *
     * @param {string} cityId
     * @param {Object} options
     * @returns {Object}
     */
    function focusMapPrediction(
        cityId,
        options = {}
    ) {
        const mapState =
            ensureMapState();

        const marker =
            mapState.markerIndex
                .get(
                    String(cityId)
                );

        if (
            marker &&
            mapState.adapterType ===
                MAP_ADAPTER_TYPES
                    .LEAFLET
        ) {
            const mapInstance =
                mapState.mapInstance;

            if (
                typeof marker
                    .getLatLng ===
                    'function' &&
                mapInstance
            ) {
                const coordinates =
                    marker.getLatLng();

                const zoom =
                    toFiniteNumber(
                        options.zoom,
                        mapState
                            .options
                            .focusZoom
                    );

                if (
                    typeof mapInstance
                        .flyTo ===
                        'function'
                ) {
                    mapInstance.flyTo(
                        coordinates,
                        zoom,
                        {
                            animate:
                                options.animate !==
                                false
                        }
                    );
                } else if (
                    typeof mapInstance
                        .setView ===
                        'function'
                ) {
                    mapInstance.setView(
                        coordinates,
                        zoom
                    );
                }

                if (
                    options.openPopup !==
                        false &&
                    typeof marker
                        .openPopup ===
                        'function'
                ) {
                    marker.openPopup();
                }

                return {
                    focused:
                        true,

                    cityId:
                        String(cityId),

                    adapterType:
                        mapState.adapterType
                };
            }
        }

        const prediction =
            typeof integrationApi
                .getLatestPrediction ===
                'function'
                ? integrationApi
                    .getLatestPrediction(
                        cityId
                    )
                : null;

        if (
            prediction &&
            typeof integrationApi
                .requestMapFocus ===
                'function'
        ) {
            return integrationApi
                .requestMapFocus(
                    prediction,
                    options
                );
        }

        return {
            focused:
                false,

            reason:
                'map_marker_not_found',

            cityId:
                String(cityId)
        };
    }

    /**
     * Render latest predictions on map.
     *
     * @param {Object} options
     * @returns {Promise<Object>}
     */
    async function renderLatestPredictionsOnMap(
        options = {}
    ) {
        const predictions =
            typeof integrationApi
                .getLatestPredictions ===
                'function'
                ? integrationApi
                    .getLatestPredictions()
                : [];

        const latestInput =
            typeof integrationApi
                .getLatestUnifiedPredictionInput ===
                'function'
                ? integrationApi
                    .getLatestUnifiedPredictionInput()
                : null;

        return renderPredictionsOnMap(
            predictions,
            {
                ...options,

                predictionInput:
                    latestInput,

                stormCells:
                    latestInput &&
                    Array.isArray(
                        latestInput
                            .stormCells
                    )
                        ? latestInput
                            .stormCells
                        : []
            }
        );
    }

    /**
     * Update map options.
     *
     * @param {Object} options
     * @param {Object} control
     * @returns {Object}
     */
    function setMapOptions(
        options = {},
        control = {}
    ) {
        const normalized =
            normalizeMapOptions(
                options
            );

        if (
            control.rerender ===
                true
        ) {
            renderLatestPredictionsOnMap(
                normalized
            );
        }

        return normalized;
    }

    /**
     * Return map status.
     *
     * @returns {Object}
     */
    function getMapStatus() {
        const mapState =
            ensureMapState();

        return {
            initialized:
                mapState.initialized,

            mapAvailable:
                Boolean(
                    mapState
                        .mapInstance
                ),

            adapterType:
                mapState.adapterType,

            consumerRegistered:
                mapState
                    .consumerRegistered,

            consumerName:
                mapState.consumerName,

            options: {
                ...mapState.options
            },

            lastRenderAt:
                mapState.lastRenderAt,

            lastRenderAtIso:
                mapState.lastRenderAtIso,

            lastPredictionRunId:
                mapState
                    .lastPredictionRunId,

            renderCount:
                mapState.renderCount,

            renderFailures:
                mapState
                    .renderFailures,

            renderedMarkerCount:
                mapState
                    .renderedMarkerCount,

            renderedPathCount:
                mapState
                    .renderedPathCount,

            renderedStormCellCount:
                mapState
                    .renderedStormCellCount,

            renderedAffectedAreaCount:
                mapState
                    .renderedAffectedAreaCount,

            indexedMarkers:
                mapState
                    .markerIndex
                    .size,

            indexedPaths:
                mapState
                    .pathIndex
                    .size,

            indexedStormCells:
                mapState
                    .stormCellIndex
                    .size
        };
    }

    /**
     * Extend runtime state.
     */
    ensureMapState();

    /**
     * Extend public API.
     */
    integrationApi
        .initializeMapBridge =
        initializeMapBridge;

    integrationApi
        .discoverRainArrivalMap =
        discoverRainArrivalMap;

    integrationApi
        .detectMapAdapterType =
        detectMapAdapterType;

    integrationApi
        .registerMapConsumer =
        registerMapConsumer;

    integrationApi
        .renderPredictionsOnMap =
        renderPredictionsOnMap;

    integrationApi
        .renderLatestPredictionsOnMap =
        renderLatestPredictionsOnMap;

    integrationApi
        .clearRainArrivalMap =
        clearRainArrivalMap;

    integrationApi
        .focusMapPrediction =
        focusMapPrediction;

    integrationApi
        .setMapOptions =
        setMapOptions;

    integrationApi
        .getMapStatus =
        getMapStatus;

    integrationApi.metadata = {
        ...integrationApi
            .metadata,

        currentPart:
            '2.2B-1',

        nextPart:
            '2.2B-2',

        status:
            'in_progress',

        productionReady:
            false,

        moduleClosed:
            true,

        capabilities: [
            ...new Set([
                ...(
                    Array.isArray(
                        integrationApi
                            .metadata
                            .capabilities
                    )
                        ? integrationApi
                            .metadata
                            .capabilities
                        : []
                ),

                'map_instance_discovery',
                'map_adapter_detection',
                'leaflet_arrival_markers',
                'leaflet_arrival_paths',
                'leaflet_storm_cells',
                'generic_map_bridge',
                'map_result_consumer',
                'map_layer_synchronization',
                'map_city_focus',
                'map_popup_rendering',
                'map_runtime_status'
            ])
        ]
    };

    /**
     * Extend internal API.
     */
    Object.assign(
        integrationApi._internals,
        {
            MAP_CONSUMER_NAME,
            MAP_LAYER_IDS,
            MAP_ADAPTER_TYPES,
            DEFAULT_MAP_OPTIONS,
            MAP_RISK_COLORS,

            ensureMapState,
            normalizeMapOptions,
            resolveMapCoordinates,
            resolveMapRiskColor,
            calculateCityMarkerRadius,
            buildMapPopupHtml,
            filterMapPredictions,
            ensureLeafletLayerGroups,
            clearLeafletLayer,
            createLeafletCityMarker,
            resolvePredictionStormCell,
            createLeafletArrivalPath,
            createLeafletStormCell,
            renderLeafletMapLayers,
            renderGenericMapLayers,
            extractMapConsumerPredictions,
            rainArrivalMapConsumer
        }
    );

    /**
     * Initialize and register built-in map integration.
     */
    try {
        initializeMapBridge();

        registerMapConsumer();
    } catch (error) {
        log(
            'debug',
            'Rain arrival map bridge initialization failed.',
            normalizeError(
                error,
                {
                    part:
                        '2.2B-1'
                }
            )
        );
    }

    log(
        'info',
        'Rain arrival integration Part 2.2B-1 loaded.',
        {
            map:
                getMapStatus()
        }
    );
})(
    typeof globalThis !==
        'undefined'
        ? globalThis
        : (
            typeof window !==
                'undefined'
                ? window
                : this
        )
);

/**
 * RainGuard AI V32
 * Rain Arrival Integration Engine
 *
 * Part:
 * 2.2B-2
 *
 * Responsibilities:
 * - Render affected-city zones
 * - Render projected storm paths
 * - Add animated movement indicators
 * - Synchronize map visibility controls
 * - Add map legend
 * - Add layer toggles
 * - Add automatic map refresh
 * - Complete map integration section
 */

(function rainArrivalIntegrationV32AdvancedMapLayers(globalObject) {
    'use strict';

    if (
        !globalObject ||
        !globalObject.RainGuardAI ||
        !globalObject.RainGuardAI.V32 ||
        !globalObject.RainGuardAI.V32
            .rainArrivalIntegration
    ) {
        throw new Error(
            'Rain Arrival Integration Part 2.2B-1 must be loaded before Part 2.2B-2.'
        );
    }

    const integrationApi =
        globalObject
            .RainGuardAI
            .V32
            .rainArrivalIntegration;

    const runtimeState =
        integrationApi._state;

    const internal =
        integrationApi._internals;

    const {
        toFiniteNumber,
        clamp,
        createRuntimeId,
        nowIso,
        normalizeError,
        escapeHtml,
        normalizeUILanguage,
        detectUILanguage,
        getUIText,
        formatNumber,
        formatArrivalDuration,
        normalizeRiskLevel,
        resolveMapCoordinates,
        resolveMapRiskColor,
        ensureMapState,
        normalizeMapOptions,
        discoverRainArrivalMap,
        detectMapAdapterType,
        ensureLeafletLayerGroups,
        clearLeafletLayer,
        filterMapPredictions,
        resolvePredictionStormCell,
        dispatchUIEvent,
        log
    } = internal;

    /**
     * Advanced map style element ID.
     */
    const ADVANCED_MAP_STYLE_ID =
        'rain-arrival-map-v32-advanced-styles';

    /**
     * Advanced layer identifiers.
     */
    const ADVANCED_MAP_LAYER_IDS =
        Object.freeze({
            projectedPaths:
                'rain_arrival_projected_paths_v32',

            movementIndicators:
                'rain_arrival_movement_indicators_v32',

            arrivalZones:
                'rain_arrival_arrival_zones_v32',

            legend:
                'rain_arrival_map_legend_v32',

            controls:
                'rain_arrival_map_controls_v32'
        });

    /**
     * Default advanced map options.
     */
    const DEFAULT_ADVANCED_MAP_OPTIONS =
        Object.freeze({
            showProjectedPaths:
                true,

            showMovementIndicators:
                true,

            showArrivalZones:
                true,

            showMapLegend:
                true,

            showLayerControls:
                true,

            animateProjectedPaths:
                true,

            autoRefreshMap:
                false,

            autoRefreshIntervalMs:
                60000,

            projectedPathWeight:
                4,

            projectedPathOpacity:
                0.8,

            projectedPathDashArray:
                '10 12',

            movementIndicatorRadius:
                5,

            arrivalZoneBaseRadiusKm:
                8,

            arrivalZoneMaximumRadiusKm:
                35,

            arrivalZoneOpacity:
                0.12,

            arrivalZoneBorderOpacity:
                0.55,

            arrivalZoneWeight:
                2,

            maximumProjectedPaths:
                100,

            maximumArrivalZones:
                100,

            pathAnimationDurationSeconds:
                18,

            usePredictionHorizons:
                true,

            horizonMinutes: [
                30,
                60,
                90,
                120
            ]
        });

    /**
     * Advanced map CSS.
     */
    const ADVANCED_MAP_CSS = `
        .rain-arrival-map-legend {
            min-width: 170px;
            padding: 12px;
            border: 1px solid rgba(148, 163, 184, 0.25);
            border-radius: 12px;
            background: rgba(15, 23, 42, 0.9);
            color: #f8fafc;
            box-shadow: 0 12px 28px rgba(2, 6, 23, 0.35);
            backdrop-filter: blur(12px);
            font-family: inherit;
            box-sizing: border-box;
        }

        .rain-arrival-map-legend__title {
            margin-bottom: 8px;
            font-size: 0.85rem;
            font-weight: 800;
        }

        .rain-arrival-map-legend__item {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-top: 6px;
            color: #cbd5e1;
            font-size: 0.74rem;
        }

        .rain-arrival-map-legend__color {
            display: inline-block;
            width: 12px;
            height: 12px;
            flex: 0 0 auto;
            border-radius: 999px;
            box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.08);
        }

        .rain-arrival-map-controls {
            display: grid;
            gap: 8px;
            min-width: 190px;
            padding: 12px;
            border: 1px solid rgba(148, 163, 184, 0.25);
            border-radius: 12px;
            background: rgba(15, 23, 42, 0.9);
            color: #f8fafc;
            box-shadow: 0 12px 28px rgba(2, 6, 23, 0.35);
            backdrop-filter: blur(12px);
            font-family: inherit;
            box-sizing: border-box;
        }

        .rain-arrival-map-controls__title {
            margin-bottom: 2px;
            font-size: 0.84rem;
            font-weight: 800;
        }

        .rain-arrival-map-controls__row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            color: #cbd5e1;
            font-size: 0.74rem;
        }

        .rain-arrival-map-controls__row input {
            width: 16px;
            height: 16px;
            accent-color: #0ea5e9;
            cursor: pointer;
        }

        .rain-arrival-map-popup {
            min-width: 185px;
            color: #0f172a;
            font-family: inherit;
        }

        .rain-arrival-map-popup__city {
            display: block;
            margin-bottom: 8px;
            font-size: 0.95rem;
        }

        .rain-arrival-map-popup__row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            margin-top: 5px;
            font-size: 0.74rem;
        }

        .rain-arrival-map-popup__row span {
            color: #475569;
        }

        .rain-arrival-map-popup__row strong {
            color: #0f172a;
        }

        .rain-arrival-path-animated {
            animation:
                rain-arrival-path-dash
                var(
                    --rain-arrival-path-duration,
                    18s
                )
                linear
                infinite;
        }

        .rain-arrival-movement-indicator {
            filter:
                drop-shadow(
                    0 0 5px
                    rgba(255, 255, 255, 0.75)
                );
        }

        @keyframes rain-arrival-path-dash {
            from {
                stroke-dashoffset: 0;
            }

            to {
                stroke-dashoffset: -220;
            }
        }

        @media (prefers-reduced-motion: reduce) {
            .rain-arrival-path-animated {
                animation: none !important;
            }
        }
    `;

    /**
     * Ensure advanced map state.
     *
     * @returns {Object}
     */
    function ensureAdvancedMapState() {
        const mapState =
            ensureMapState();

        if (
            !mapState.advanced ||
            typeof mapState.advanced !==
                'object'
        ) {
            mapState.advanced = {
                options: {
                    ...DEFAULT_ADVANCED_MAP_OPTIONS,

                    horizonMinutes:
                        DEFAULT_ADVANCED_MAP_OPTIONS
                            .horizonMinutes
                            .slice()
                },

                layers: {
                    projectedPaths:
                        null,

                    movementIndicators:
                        null,

                    arrivalZones:
                        null
                },

                projectedPathIndex:
                    new Map(),

                movementIndicatorIndex:
                    new Map(),

                arrivalZoneIndex:
                    new Map(),

                legendControl:
                    null,

                layerControl:
                    null,

                stylesInstalled:
                    false,

                autoRefreshTimerId:
                    null,

                autoRefreshActive:
                    false,

                lastAdvancedRenderAt:
                    null,

                lastAdvancedRenderAtIso:
                    null,

                renderedProjectedPathCount:
                    0,

                renderedMovementIndicatorCount:
                    0,

                renderedArrivalZoneCount:
                    0,

                renderCount:
                    0,

                renderFailures:
                    0
            };
        }

        if (
            !(mapState
                .advanced
                .projectedPathIndex instanceof Map)
        ) {
            mapState
                .advanced
                .projectedPathIndex =
                new Map();
        }

        if (
            !(mapState
                .advanced
                .movementIndicatorIndex instanceof Map)
        ) {
            mapState
                .advanced
                .movementIndicatorIndex =
                new Map();
        }

        if (
            !(mapState
                .advanced
                .arrivalZoneIndex instanceof Map)
        ) {
            mapState
                .advanced
                .arrivalZoneIndex =
                new Map();
        }

        return mapState.advanced;
    }

    /**
     * Normalize advanced map options.
     *
     * @param {Object} options
     * @returns {Object}
     */
    function normalizeAdvancedMapOptions(
        options = {}
    ) {
        const advancedState =
            ensureAdvancedMapState();

        const normalized = {
            ...DEFAULT_ADVANCED_MAP_OPTIONS,
            ...advancedState.options,
            ...options
        };

        normalized.showProjectedPaths =
            normalized.showProjectedPaths !==
            false;

        normalized.showMovementIndicators =
            normalized.showMovementIndicators !==
            false;

        normalized.showArrivalZones =
            normalized.showArrivalZones !==
            false;

        normalized.showMapLegend =
            normalized.showMapLegend !==
            false;

        normalized.showLayerControls =
            normalized.showLayerControls !==
            false;

        normalized.animateProjectedPaths =
            normalized.animateProjectedPaths !==
            false;

        normalized.autoRefreshMap =
            normalized.autoRefreshMap ===
            true;

        normalized.autoRefreshIntervalMs =
            Math.max(
                10000,
                toFiniteNumber(
                    normalized
                        .autoRefreshIntervalMs,
                    DEFAULT_ADVANCED_MAP_OPTIONS
                        .autoRefreshIntervalMs
                )
            );

        normalized.projectedPathWeight =
            Math.max(
                1,
                toFiniteNumber(
                    normalized
                        .projectedPathWeight,
                    DEFAULT_ADVANCED_MAP_OPTIONS
                        .projectedPathWeight
                )
            );

        normalized.projectedPathOpacity =
            clamp(
                toFiniteNumber(
                    normalized
                        .projectedPathOpacity,
                    DEFAULT_ADVANCED_MAP_OPTIONS
                        .projectedPathOpacity
                ),
                0,
                1
            );

        normalized.movementIndicatorRadius =
            Math.max(
                2,
                toFiniteNumber(
                    normalized
                        .movementIndicatorRadius,
                    DEFAULT_ADVANCED_MAP_OPTIONS
                        .movementIndicatorRadius
                )
            );

        normalized.arrivalZoneBaseRadiusKm =
            Math.max(
                1,
                toFiniteNumber(
                    normalized
                        .arrivalZoneBaseRadiusKm,
                    DEFAULT_ADVANCED_MAP_OPTIONS
                        .arrivalZoneBaseRadiusKm
                )
            );

        normalized.arrivalZoneMaximumRadiusKm =
            Math.max(
                normalized
                    .arrivalZoneBaseRadiusKm,
                toFiniteNumber(
                    normalized
                        .arrivalZoneMaximumRadiusKm,
                    DEFAULT_ADVANCED_MAP_OPTIONS
                        .arrivalZoneMaximumRadiusKm
                )
            );

        normalized.arrivalZoneOpacity =
            clamp(
                toFiniteNumber(
                    normalized
                        .arrivalZoneOpacity,
                    DEFAULT_ADVANCED_MAP_OPTIONS
                        .arrivalZoneOpacity
                ),
                0,
                1
            );

        normalized.arrivalZoneBorderOpacity =
            clamp(
                toFiniteNumber(
                    normalized
                        .arrivalZoneBorderOpacity,
                    DEFAULT_ADVANCED_MAP_OPTIONS
                        .arrivalZoneBorderOpacity
                ),
                0,
                1
            );

        normalized.arrivalZoneWeight =
            Math.max(
                1,
                toFiniteNumber(
                    normalized
                        .arrivalZoneWeight,
                    DEFAULT_ADVANCED_MAP_OPTIONS
                        .arrivalZoneWeight
                )
            );

        normalized.maximumProjectedPaths =
            Math.max(
                1,
                Math.round(
                    toFiniteNumber(
                        normalized
                            .maximumProjectedPaths,
                        DEFAULT_ADVANCED_MAP_OPTIONS
                            .maximumProjectedPaths
                    )
                )
            );

        normalized.maximumArrivalZones =
            Math.max(
                1,
                Math.round(
                    toFiniteNumber(
                        normalized
                            .maximumArrivalZones,
                        DEFAULT_ADVANCED_MAP_OPTIONS
                            .maximumArrivalZones
                    )
                )
            );

        normalized.pathAnimationDurationSeconds =
            Math.max(
                2,
                toFiniteNumber(
                    normalized
                        .pathAnimationDurationSeconds,
                    DEFAULT_ADVANCED_MAP_OPTIONS
                        .pathAnimationDurationSeconds
                )
            );

        normalized.usePredictionHorizons =
            normalized.usePredictionHorizons !==
            false;

        normalized.horizonMinutes =
            Array.from(
                new Set(
                    (
                        Array.isArray(
                            normalized
                                .horizonMinutes
                        )
                            ? normalized
                                .horizonMinutes
                            : DEFAULT_ADVANCED_MAP_OPTIONS
                                .horizonMinutes
                    )
                        .map(
                            (value) =>
                                Math.round(
                                    toFiniteNumber(
                                        value,
                                        NaN
                                    )
                                )
                        )
                        .filter(
                            (value) =>
                                Number.isFinite(
                                    value
                                ) &&
                                value > 0
                        )
                )
            )
                .sort(
                    (left, right) =>
                        left - right
                );

        advancedState.options =
            normalized;

        return {
            ...normalized,

            horizonMinutes:
                normalized
                    .horizonMinutes
                    .slice()
        };
    }

    /**
     * Install advanced map styles.
     *
     * @param {Object} options
     * @returns {Object}
     */
    function installAdvancedMapStyles(
        options = {}
    ) {
        const advancedState =
            ensureAdvancedMapState();

        if (
            typeof globalObject
                .document ===
                'undefined'
        ) {
            return {
                installed:
                    false,

                reason:
                    'document_unavailable'
            };
        }

        let styleElement =
            globalObject
                .document
                .getElementById(
                    ADVANCED_MAP_STYLE_ID
                );

        if (
            styleElement &&
            options.force !==
                true
        ) {
            advancedState.stylesInstalled =
                true;

            return {
                installed:
                    false,

                reused:
                    true
            };
        }

        if (!styleElement) {
            styleElement =
                globalObject
                    .document
                    .createElement(
                        'style'
                    );

            styleElement.id =
                ADVANCED_MAP_STYLE_ID;

            (
                globalObject
                    .document
                    .head ||
                globalObject
                    .document
                    .documentElement
            ).appendChild(
                styleElement
            );
        }

        styleElement.textContent =
            options.css ||
            ADVANCED_MAP_CSS;

        advancedState.stylesInstalled =
            true;

        return {
            installed:
                true,

            reused:
                false
        };
    }

    /**
     * Ensure advanced Leaflet layers.
     *
     * @param {Object} mapInstance
     * @returns {Object}
     */
    function ensureAdvancedLeafletLayers(
        mapInstance
    ) {
        const advancedState =
            ensureAdvancedMapState();

        if (
            !globalObject.L ||
            typeof globalObject
                .L
                .layerGroup !==
                'function'
        ) {
            throw new Error(
                'Leaflet library is unavailable.'
            );
        }

        const layerNames = [
            'projectedPaths',
            'movementIndicators',
            'arrivalZones'
        ];

        for (
            const layerName
            of layerNames
        ) {
            if (
                advancedState.layers[
                    layerName
                ]
            ) {
                continue;
            }

            const layer =
                globalObject
                    .L
                    .layerGroup();

            if (
                typeof layer.addTo ===
                'function'
            ) {
                layer.addTo(
                    mapInstance
                );
            } else if (
                typeof mapInstance
                    .addLayer ===
                    'function'
            ) {
                mapInstance.addLayer(
                    layer
                );
            }

            advancedState.layers[
                layerName
            ] =
                layer;
        }

        return advancedState.layers;
    }

    /**
     * Normalize a projected point.
     *
     * @param {*} point
     * @returns {Object|null}
     */
    function normalizeProjectedPoint(
        point
    ) {
        if (
            !point ||
            typeof point !==
                'object'
        ) {
            return null;
        }

        const coordinates =
            resolveMapCoordinates(
                point.latitude ??
                point.lat,
                point.longitude ??
                point.lng ??
                point.lon
            );

        if (!coordinates) {
            return null;
        }

        return {
            latitude:
                coordinates.latitude,

            longitude:
                coordinates.longitude,

            minutes:
                toFiniteNumber(
                    point.minutes ??
                    point.horizonMinutes ??
                    point.horizon ??
                    point.timeOffsetMinutes,
                    null
                ),

            confidence:
                clamp(
                    toFiniteNumber(
                        point.confidence,
                        50
                    ),
                    0,
                    100
                ),

            intensity:
                Math.max(
                    0,
                    toFiniteNumber(
                        point.intensity,
                        0
                    )
                ),

            riskLevel:
                normalizeRiskLevel(
                    point.riskLevel ??
                    point.risk
                ),

            raw:
                point
        };
    }

    /**
     * Extract projected path points.
     *
     * @param {Object} prediction
     * @param {Object|null} stormCell
     * @param {Object} options
     * @returns {Array<Object>}
     */
    function extractProjectedPathPoints(
        prediction,
        stormCell,
        options
    ) {
        const candidateCollections = [
            prediction.horizons,
            prediction.forecastPoints,
            prediction.projectedPath,
            prediction.path,
            prediction.raw &&
            prediction.raw.horizons,
            prediction.raw &&
            prediction.raw.forecastPoints,
            stormCell &&
            stormCell.projectedPath,
            stormCell &&
            stormCell.forecastPoints,
            stormCell &&
            stormCell.path
        ];

        for (
            const candidate
            of candidateCollections
        ) {
            if (!Array.isArray(candidate)) {
                continue;
            }

            const normalized =
                candidate
                    .map(
                        normalizeProjectedPoint
                    )
                    .filter(Boolean)
                    .sort(
                        (left, right) =>
                            toFiniteNumber(
                                left.minutes,
                                Number
                                    .POSITIVE_INFINITY
                            ) -
                            toFiniteNumber(
                                right.minutes,
                                Number
                                    .POSITIVE_INFINITY
                            )
                    );

            if (
                normalized.length >
                0
            ) {
                return normalized;
            }
        }

        const stormCoordinates =
            stormCell
                ? resolveMapCoordinates(
                    stormCell.latitude,
                    stormCell.longitude
                )
                : null;

        const cityCoordinates =
            resolveMapCoordinates(
                prediction.latitude,
                prediction.longitude
            );

        if (
            !stormCoordinates ||
            !cityCoordinates
        ) {
            return [];
        }

        const arrivalMinutes =
            Math.max(
                1,
                toFiniteNumber(
                    prediction
                        .arrivalMinutes,
                    120
                )
            );

        const selectedHorizons =
            options
                .horizonMinutes
                .filter(
                    (minutes) =>
                        minutes <=
                        arrivalMinutes
                );

        const horizons =
            selectedHorizons.length >
                0
                ? selectedHorizons
                : [
                    arrivalMinutes
                ];

        const points = [
            {
                latitude:
                    stormCoordinates
                        .latitude,

                longitude:
                    stormCoordinates
                        .longitude,

                minutes:
                    0,

                confidence:
                    toFiniteNumber(
                        stormCell.confidence,
                        prediction.confidence
                    ),

                intensity:
                    toFiniteNumber(
                        stormCell.intensity,
                        prediction.intensity
                    ),

                riskLevel:
                    normalizeRiskLevel(
                        stormCell.riskLevel ||
                        prediction.riskLevel
                    )
            }
        ];

        for (
            const horizon
            of horizons
        ) {
            const ratio =
                clamp(
                    horizon /
                    arrivalMinutes,
                    0,
                    1
                );

            points.push({
                latitude:
                    stormCoordinates
                        .latitude +
                    (
                        cityCoordinates
                            .latitude -
                        stormCoordinates
                            .latitude
                    ) *
                    ratio,

                longitude:
                    stormCoordinates
                        .longitude +
                    (
                        cityCoordinates
                            .longitude -
                        stormCoordinates
                            .longitude
                    ) *
                    ratio,

                minutes:
                    horizon,

                confidence:
                    clamp(
                        toFiniteNumber(
                            prediction.confidence,
                            50
                        ) -
                        ratio *
                        10,
                        0,
                        100
                    ),

                intensity:
                    Math.max(
                        0,
                        toFiniteNumber(
                            prediction.intensity,
                            0
                        )
                    ),

                riskLevel:
                    normalizeRiskLevel(
                        prediction.riskLevel
                    )
            });
        }

        if (
            points[
                points.length -
                1
            ].latitude !==
                cityCoordinates.latitude ||
            points[
                points.length -
                1
            ].longitude !==
                cityCoordinates.longitude
        ) {
            points.push({
                latitude:
                    cityCoordinates
                        .latitude,

                longitude:
                    cityCoordinates
                        .longitude,

                minutes:
                    arrivalMinutes,

                confidence:
                    toFiniteNumber(
                        prediction.confidence,
                        50
                    ),

                intensity:
                    toFiniteNumber(
                        prediction.intensity,
                        0
                    ),

                riskLevel:
                    normalizeRiskLevel(
                        prediction.riskLevel
                    )
            });
        }

        return points;
    }

    /**
     * Create projected Leaflet path.
     *
     * @param {Object} prediction
     * @param {Object|null} stormCell
     * @param {Object} options
     * @returns {Object|null}
     */
    function createProjectedLeafletPath(
        prediction,
        stormCell,
        options
    ) {
        if (
            !globalObject.L ||
            typeof globalObject
                .L
                .polyline !==
                'function'
        ) {
            return null;
        }

        const points =
            extractProjectedPathPoints(
                prediction,
                stormCell,
                options
            );

        if (
            points.length <
            2
        ) {
            return null;
        }

        const color =
            resolveMapRiskColor(
                prediction.riskLevel
            );

        const polyline =
            globalObject
                .L
                .polyline(
                    points.map(
                        (point) => [
                            point.latitude,
                            point.longitude
                        ]
                    ),
                    {
                        color,
                        weight:
                            options
                                .projectedPathWeight,
                        opacity:
                            options
                                .projectedPathOpacity,
                        dashArray:
                            options
                                .projectedPathDashArray,
                        lineCap:
                            'round',
                        lineJoin:
                            'round',
                        className:
                            options
                                .animateProjectedPaths
                                ? 'rain-arrival-path-animated'
                                : ''
                    }
                );

        if (
            typeof polyline.on ===
                'function'
        ) {
            polyline.on(
                'add',
                () => {
                    const element =
                        typeof polyline
                            .getElement ===
                            'function'
                            ? polyline
                                .getElement()
                            : null;

                    if (element) {
                        element.style
                            .setProperty(
                                '--rain-arrival-path-duration',
                                `${options.pathAnimationDurationSeconds}s`
                            );
                    }
                }
            );
        }

        polyline._rainArrivalPrediction =
            prediction;

        polyline._rainArrivalProjectedPoints =
            points;

        return polyline;
    }

    /**
     * Create movement indicators.
     *
     * @param {Object} prediction
     * @param {Array<Object>} points
     * @param {Object} options
     * @returns {Array<Object>}
     */
    function createMovementIndicators(
        prediction,
        points,
        options
    ) {
        if (
            !globalObject.L ||
            typeof globalObject
                .L
                .circleMarker !==
                'function'
        ) {
            return [];
        }

        const color =
            resolveMapRiskColor(
                prediction.riskLevel
            );

        return points
            .slice(
                1,
                -1
            )
            .map(
                (point) => {
                    const indicator =
                        globalObject
                            .L
                            .circleMarker(
                                [
                                    point.latitude,
                                    point.longitude
                                ],
                                {
                                    radius:
                                        options
                                            .movementIndicatorRadius,
                                    color,
                                    weight:
                                        1,
                                    opacity:
                                        0.95,
                                    fillColor:
                                        color,
                                    fillOpacity:
                                        0.85,
                                    className:
                                        'rain-arrival-movement-indicator'
                                }
                            );

                    if (
                        typeof indicator
                            .bindTooltip ===
                            'function'
                    ) {
                        const language =
                            detectUILanguage();

                        indicator.bindTooltip(
                            `${formatNumber(
                                point.minutes,
                                0,
                                language
                            )} ${getUIText(
                                'minutes',
                                language
                            )}`,
                            {
                                direction:
                                    'top',
                                opacity:
                                    0.9
                            }
                        );
                    }

                    indicator
                        ._rainArrivalPoint =
                        point;

                    indicator
                        ._rainArrivalPrediction =
                        prediction;

                    return indicator;
                }
            );
    }

    /**
     * Calculate arrival-zone radius.
     *
     * @param {Object} prediction
     * @param {Object} options
     * @returns {number}
     */
    function calculateArrivalZoneRadiusKm(
        prediction,
        options
    ) {
        const confidence =
            clamp(
                toFiniteNumber(
                    prediction.confidence,
                    0
                ),
                0,
                100
            );

        const intensity =
            Math.max(
                0,
                toFiniteNumber(
                    prediction.intensity,
                    0
                )
            );

        const riskLevel =
            normalizeRiskLevel(
                prediction.riskLevel
            );

        const riskMultiplier =
            {
                minimal:
                    0.8,

                low:
                    1,

                moderate:
                    1.3,

                high:
                    1.65,

                extreme:
                    2,

                unknown:
                    1
            }[
                riskLevel
            ];

        const radius =
            (
                options
                    .arrivalZoneBaseRadiusKm +
                confidence /
                12 +
                intensity /
                20
            ) *
            riskMultiplier;

        return clamp(
            radius,
            options
                .arrivalZoneBaseRadiusKm,
            options
                .arrivalZoneMaximumRadiusKm
        );
    }

    /**
     * Create arrival zone.
     *
     * @param {Object} prediction
     * @param {Object} options
     * @returns {Object|null}
     */
    function createLeafletArrivalZone(
        prediction,
        options
    ) {
        if (
            !globalObject.L ||
            typeof globalObject
                .L
                .circle !==
                'function'
        ) {
            return null;
        }

        const coordinates =
            resolveMapCoordinates(
                prediction.latitude,
                prediction.longitude
            );

        if (!coordinates) {
            return null;
        }

        const color =
            resolveMapRiskColor(
                prediction.riskLevel
            );

        const radiusKm =
            calculateArrivalZoneRadiusKm(
                prediction,
                options
            );

        const zone =
            globalObject
                .L
                .circle(
                    [
                        coordinates
                            .latitude,
                        coordinates
                            .longitude
                    ],
                    {
                        radius:
                            radiusKm *
                            1000,
                        color,
                        weight:
                            options
                                .arrivalZoneWeight,
                        opacity:
                            options
                                .arrivalZoneBorderOpacity,
                        fillColor:
                            color,
                        fillOpacity:
                            options
                                .arrivalZoneOpacity
                    }
                );

        if (
            typeof zone
                .bindTooltip ===
                'function'
        ) {
            const language =
                detectUILanguage();

            zone.bindTooltip(
                `${
                    language ===
                        'ar'
                        ? 'نطاق التأثير المتوقع'
                        : 'Expected impact zone'
                }: ${formatNumber(
                    radiusKm,
                    1,
                    language
                )} km`,
                {
                    direction:
                        'center',
                    opacity:
                        0.9
                }
            );
        }

        zone._rainArrivalPrediction =
            prediction;

        zone._rainArrivalRadiusKm =
            radiusKm;

        return zone;
    }

    /**
     * Render advanced Leaflet layers.
     *
     * @param {Object} mapInstance
     * @param {Array<Object>} predictions
     * @param {Array<Object>} stormCells
     * @param {Object} options
     * @returns {Object}
     */
    function renderAdvancedLeafletLayers(
        mapInstance,
        predictions,
        stormCells,
        options
    ) {
        const advancedState =
            ensureAdvancedMapState();

        const layers =
            ensureAdvancedLeafletLayers(
                mapInstance
            );

        clearLeafletLayer(
            layers.projectedPaths
        );

        clearLeafletLayer(
            layers.movementIndicators
        );

        clearLeafletLayer(
            layers.arrivalZones
        );

        advancedState
            .projectedPathIndex
            .clear();

        advancedState
            .movementIndicatorIndex
            .clear();

        advancedState
            .arrivalZoneIndex
            .clear();

        let projectedPathCount =
            0;

        let movementIndicatorCount =
            0;

        let arrivalZoneCount =
            0;

        if (
            options.showProjectedPaths
        ) {
            for (
                const prediction
                of predictions.slice(
                    0,
                    options
                        .maximumProjectedPaths
                )
            ) {
                const stormCell =
                    resolvePredictionStormCell(
                        prediction,
                        stormCells
                    );

                const path =
                    createProjectedLeafletPath(
                        prediction,
                        stormCell,
                        options
                    );

                if (!path) {
                    continue;
                }

                layers.projectedPaths
                    .addLayer(
                        path
                    );

                const predictionKey =
                    String(
                        prediction.cityId ||
                        prediction.id
                    );

                advancedState
                    .projectedPathIndex
                    .set(
                        predictionKey,
                        path
                    );

                projectedPathCount +=
                    1;

                if (
                    options
                        .showMovementIndicators
                ) {
                    const points =
                        path
                            ._rainArrivalProjectedPoints ||
                        [];

                    const indicators =
                        createMovementIndicators(
                            prediction,
                            points,
                            options
                        );

                    for (
                        const indicator
                        of indicators
                    ) {
                        layers
                            .movementIndicators
                            .addLayer(
                                indicator
                            );

                        movementIndicatorCount +=
                            1;
                    }

                    advancedState
                        .movementIndicatorIndex
                        .set(
                            predictionKey,
                            indicators
                        );
                }
            }
        }

        if (
            options.showArrivalZones
        ) {
            for (
                const prediction
                of predictions.slice(
                    0,
                    options
                        .maximumArrivalZones
                )
            ) {
                const zone =
                    createLeafletArrivalZone(
                        prediction,
                        options
                    );

                if (!zone) {
                    continue;
                }

                layers.arrivalZones
                    .addLayer(
                        zone
                    );

                advancedState
                    .arrivalZoneIndex
                    .set(
                        String(
                            prediction.cityId ||
                            prediction.id
                        ),
                        zone
                    );

                arrivalZoneCount +=
                    1;
            }
        }

        advancedState
            .renderedProjectedPathCount =
            projectedPathCount;

        advancedState
            .renderedMovementIndicatorCount =
            movementIndicatorCount;

        advancedState
            .renderedArrivalZoneCount =
            arrivalZoneCount;

        return {
            projectedPathCount,
            movementIndicatorCount,
            arrivalZoneCount
        };
    }

    /**
     * Build map legend HTML.
     *
     * @param {string} language
     * @returns {string}
     */
    function buildMapLegendHtml(
        language
    ) {
        const labels =
            language ===
                'ar'
                ? {
                    title:
                        'مفتاح خطورة وصول المطر',

                    minimal:
                        'محدودة',

                    low:
                        'منخفضة',

                    moderate:
                        'متوسطة',

                    high:
                        'عالية',

                    extreme:
                        'قصوى'
                }
                : {
                    title:
                        'Rain Arrival Risk',

                    minimal:
                        'Minimal',

                    low:
                        'Low',

                    moderate:
                        'Moderate',

                    high:
                        'High',

                    extreme:
                        'Extreme'
                };

        return `
            <div
                class="rain-arrival-map-legend"
                dir="${language ===
                    'ar'
                    ? 'rtl'
                    : 'ltr'}"
            >
                <div class="rain-arrival-map-legend__title">
                    ${escapeHtml(
                        labels.title
                    )}
                </div>

                ${[
                    'minimal',
                    'low',
                    'moderate',
                    'high',
                    'extreme'
                ]
                    .map(
                        (riskLevel) => `
                            <div class="rain-arrival-map-legend__item">
                                <span
                                    class="rain-arrival-map-legend__color"
                                    style="background:${escapeHtml(
                                        resolveMapRiskColor(
                                            riskLevel
                                        )
                                    )}"
                                ></span>

                                <span>
                                    ${escapeHtml(
                                        labels[
                                            riskLevel
                                        ]
                                    )}
                                </span>
                            </div>
                        `
                    )
                    .join('')}
            </div>
        `;
    }

    /**
     * Build map layer controls HTML.
     *
     * @param {string} language
     * @param {Object} options
     * @returns {string}
     */
    function buildMapControlsHtml(
        language,
        options
    ) {
        const labels =
            language ===
                'ar'
                ? {
                    title:
                        'طبقات وصول المطر',

                    markers:
                        'علامات المدن',

                    paths:
                        'مسارات الخلايا',

                    projectedPaths:
                        'المسار المتوقع',

                    indicators:
                        'نقاط الحركة',

                    zones:
                        'نطاقات التأثير',

                    stormCells:
                        'الخلايا الرعدية'
                }
                : {
                    title:
                        'Rain Arrival Layers',

                    markers:
                        'City markers',

                    paths:
                        'Storm paths',

                    projectedPaths:
                        'Projected paths',

                    indicators:
                        'Movement points',

                    zones:
                        'Impact zones',

                    stormCells:
                        'Storm cells'
                };

        const baseOptions =
            ensureMapState()
                .options;

        return `
            <div
                class="rain-arrival-map-controls"
                dir="${language ===
                    'ar'
                    ? 'rtl'
                    : 'ltr'}"
            >
                <div class="rain-arrival-map-controls__title">
                    ${escapeHtml(
                        labels.title
                    )}
                </div>

                ${[
                    {
                        key:
                            'showMarkers',

                        checked:
                            baseOptions
                                .showMarkers,

                        label:
                            labels.markers
                    },
                    {
                        key:
                            'showPaths',

                        checked:
                            baseOptions
                                .showPaths,

                        label:
                            labels.paths
                    },
                    {
                        key:
                            'showProjectedPaths',

                        checked:
                            options
                                .showProjectedPaths,

                        label:
                            labels
                                .projectedPaths
                    },
                    {
                        key:
                            'showMovementIndicators',

                        checked:
                            options
                                .showMovementIndicators,

                        label:
                            labels.indicators
                    },
                    {
                        key:
                            'showArrivalZones',

                        checked:
                            options
                                .showArrivalZones,

                        label:
                            labels.zones
                    },
                    {
                        key:
                            'showStormCells',

                        checked:
                            baseOptions
                                .showStormCells,

                        label:
                            labels.stormCells
                    }
                ]
                    .map(
                        (item) => `
                            <label class="rain-arrival-map-controls__row">
                                <span>
                                    ${escapeHtml(
                                        item.label
                                    )}
                                </span>

                                <input
                                    type="checkbox"
                                    data-rain-arrival-map-layer="${escapeHtml(
                                        item.key
                                    )}"
                                    ${item.checked
                                        ? 'checked'
                                        : ''}
                                />
                            </label>
                        `
                    )
                    .join('')}
            </div>
        `;
    }

    /**
     * Install Leaflet legend.
     *
     * @param {Object} mapInstance
     * @param {Object} options
     * @returns {Object|null}
     */
    function installMapLegend(
        mapInstance,
        options
    ) {
        const advancedState =
            ensureAdvancedMapState();

        if (
            !options.showMapLegend ||
            !globalObject.L ||
            typeof globalObject
                .L
                .control !==
                'function'
        ) {
            return null;
        }

        if (
            advancedState.legendControl &&
            typeof mapInstance
                .removeControl ===
                'function'
        ) {
            try {
                mapInstance.removeControl(
                    advancedState
                        .legendControl
                );
            } catch (error) {
                log(
                    'debug',
                    'Existing map legend removal failed.',
                    normalizeError(
                        error
                    )
                );
            }
        }

        const language =
            normalizeUILanguage(
                options.language ||
                detectUILanguage()
            );

        const control =
            globalObject
                .L
                .control({
                    position:
                        language ===
                            'ar'
                            ? 'bottomright'
                            : 'bottomleft'
                });

        control.onAdd =
            function onAddLegend() {
                const wrapper =
                    globalObject.L
                        .DomUtil
                        .create(
                            'div'
                        );

                wrapper.innerHTML =
                    buildMapLegendHtml(
                        language
                    );

                if (
                    globalObject.L
                        .DomEvent
                ) {
                    globalObject.L
                        .DomEvent
                        .disableClickPropagation(
                            wrapper
                        );

                    globalObject.L
                        .DomEvent
                        .disableScrollPropagation(
                            wrapper
                        );
                }

                return wrapper;
            };

        control.addTo(
            mapInstance
        );

        advancedState.legendControl =
            control;

        return control;
    }

    /**
     * Install Leaflet layer controls.
     *
     * @param {Object} mapInstance
     * @param {Object} options
     * @returns {Object|null}
     */
    function installMapLayerControls(
        mapInstance,
        options
    ) {
        const advancedState =
            ensureAdvancedMapState();

        if (
            !options.showLayerControls ||
            !globalObject.L ||
            typeof globalObject
                .L
                .control !==
                'function'
        ) {
            return null;
        }

        if (
            advancedState.layerControl &&
            typeof mapInstance
                .removeControl ===
                'function'
        ) {
            try {
                mapInstance.removeControl(
                    advancedState
                        .layerControl
                );
            } catch (error) {
                log(
                    'debug',
                    'Existing map controls removal failed.',
                    normalizeError(
                        error
                    )
                );
            }
        }

        const language =
            normalizeUILanguage(
                options.language ||
                detectUILanguage()
            );

        const control =
            globalObject
                .L
                .control({
                    position:
                        language ===
                            'ar'
                            ? 'topright'
                            : 'topleft'
                });

        control.onAdd =
            function onAddControls() {
                const wrapper =
                    globalObject.L
                        .DomUtil
                        .create(
                            'div'
                        );

                wrapper.innerHTML =
                    buildMapControlsHtml(
                        language,
                        options
                    );

                const controls =
                    wrapper.querySelectorAll(
                        '[data-rain-arrival-map-layer]'
                    );

                controls.forEach(
                    (input) => {
                        input.addEventListener(
                            'change',
                            () => {
                                const key =
                                    input.getAttribute(
                                        'data-rain-arrival-map-layer'
                                    );

                                const value =
                                    input.checked;

                                if (
                                    [
                                        'showMarkers',
                                        'showPaths',
                                        'showStormCells'
                                    ].includes(
                                        key
                                    )
                                ) {
                                    if (
                                        typeof integrationApi
                                            .setMapOptions ===
                                            'function'
                                    ) {
                                        integrationApi
                                            .setMapOptions(
                                                {
                                                    [key]:
                                                        value
                                                },
                                                {
                                                    rerender:
                                                        false
                                                }
                                            );
                                    }
                                } else {
                                    normalizeAdvancedMapOptions({
                                        [key]:
                                            value
                                    });
                                }

                                renderLatestAdvancedMapLayers({
                                    refreshBaseMap:
                                        true
                                });

                                dispatchUIEvent(
                                    'rainguard:v32:rain-arrival:map-layer-visibility-changed',
                                    {
                                        layer:
                                            key,

                                        visible:
                                            value,

                                        timestamp:
                                            Date.now(),

                                        timestampIso:
                                            nowIso()
                                    }
                                );
                            }
                        );
                    }
                );

                if (
                    globalObject.L
                        .DomEvent
                ) {
                    globalObject.L
                        .DomEvent
                        .disableClickPropagation(
                            wrapper
                        );

                    globalObject.L
                        .DomEvent
                        .disableScrollPropagation(
                            wrapper
                        );
                }

                return wrapper;
            };

        control.addTo(
            mapInstance
        );

        advancedState.layerControl =
            control;

        return control;
    }

    /**
     * Render advanced map layers.
     *
     * @param {Array<Object>} predictions
     * @param {Object} context
     * @returns {Promise<Object>}
     */
    async function renderAdvancedMapLayers(
        predictions,
        context = {}
    ) {
        const advancedState =
            ensureAdvancedMapState();

        const options =
            normalizeAdvancedMapOptions({
                ...context.options,
                ...context
            });

        const mapState =
            ensureMapState();

        const mapInstance =
            context.map ||
            mapState.mapInstance ||
            discoverRainArrivalMap(
                context
            );

        if (!mapInstance) {
            advancedState.renderFailures +=
                1;

            return {
                rendered:
                    false,

                reason:
                    'map_instance_not_found'
            };
        }

        const adapterType =
            detectMapAdapterType(
                mapInstance
            );

        if (
            adapterType !==
            'leaflet'
        ) {
            const genericMethods = [
                'renderAdvancedRainArrival',
                'updateAdvancedRainArrival',
                'setProjectedRainPaths',
                'updateRainArrivalZones'
            ];

            for (
                const methodName
                of genericMethods
            ) {
                if (
                    typeof mapInstance[
                        methodName
                    ] !==
                    'function'
                ) {
                    continue;
                }

                const response =
                    await Promise.resolve(
                        mapInstance[
                            methodName
                        ]({
                            predictions,

                            stormCells:
                                context
                                    .stormCells ||
                                [],

                            options,

                            generatedAt:
                                Date.now(),

                            generatedAtIso:
                                nowIso()
                        })
                    );

                advancedState
                    .lastAdvancedRenderAt =
                    Date.now();

                advancedState
                    .lastAdvancedRenderAtIso =
                    new Date(
                        advancedState
                            .lastAdvancedRenderAt
                    ).toISOString();

                advancedState.renderCount +=
                    1;

                return {
                    rendered:
                        true,

                    adapterType,

                    methodName,

                    response
                };
            }

            return {
                rendered:
                    false,

                adapterType,

                reason:
                    'advanced_generic_method_not_found'
            };
        }

        installAdvancedMapStyles();

        const mapOptions =
            normalizeMapOptions(
                context.mapOptions ||
                {}
            );

        const filteredPredictions =
            filterMapPredictions(
                Array.isArray(
                    predictions
                )
                    ? predictions
                    : [],
                {
                    ...mapOptions,

                    showRejected:
                        context.showRejected ??
                        mapOptions
                            .showRejected,

                    showNoRain:
                        context.showNoRain ??
                        mapOptions
                            .showNoRain
                }
            );

        const stormCells =
            Array.isArray(
                context.stormCells
            )
                ? context.stormCells
                : (
                    context.predictionInput &&
                    Array.isArray(
                        context
                            .predictionInput
                            .stormCells
                    )
                        ? context
                            .predictionInput
                            .stormCells
                        : []
                );

        try {
            const startedAt =
                Date.now();

            const renderResult =
                renderAdvancedLeafletLayers(
                    mapInstance,
                    filteredPredictions,
                    stormCells,
                    options
                );

            if (
                options.showMapLegend
            ) {
                installMapLegend(
                    mapInstance,
                    options
                );
            }

            if (
                options.showLayerControls
            ) {
                installMapLayerControls(
                    mapInstance,
                    options
                );
            }

            const completedAt =
                Date.now();

            advancedState
                .lastAdvancedRenderAt =
                completedAt;

            advancedState
                .lastAdvancedRenderAtIso =
                new Date(
                    completedAt
                ).toISOString();

            advancedState.renderCount +=
                1;

            const result = {
                rendered:
                    true,

                adapterType,

                predictionCount:
                    filteredPredictions
                        .length,

                stormCellCount:
                    stormCells.length,

                projectedPathCount:
                    renderResult
                        .projectedPathCount,

                movementIndicatorCount:
                    renderResult
                        .movementIndicatorCount,

                arrivalZoneCount:
                    renderResult
                        .arrivalZoneCount,

                startedAt,

                completedAt,

                completedAtIso:
                    new Date(
                        completedAt
                    ).toISOString(),

                durationMs:
                    completedAt -
                    startedAt,

                options
            };

            dispatchUIEvent(
                'rainguard:v32:rain-arrival:advanced-map-updated',
                result
            );

            return result;
        } catch (error) {
            advancedState.renderFailures +=
                1;

            const normalizedError =
                normalizeError(
                    error,
                    {
                        predictionCount:
                            filteredPredictions
                                .length,

                        stormCellCount:
                            stormCells.length
                    }
                );

            log(
                'error',
                'Advanced rain arrival map rendering failed.',
                normalizedError
            );

            return {
                rendered:
                    false,

                reason:
                    'advanced_map_rendering_failed',

                error:
                    normalizedError
            };
        }
    }

    /**
     * Render latest advanced layers.
     *
     * @param {Object} options
     * @returns {Promise<Object>}
     */
    async function renderLatestAdvancedMapLayers(
        options = {}
    ) {
        const predictions =
            typeof integrationApi
                .getLatestPredictions ===
                'function'
                ? integrationApi
                    .getLatestPredictions()
                : [];

        const latestInput =
            typeof integrationApi
                .getLatestUnifiedPredictionInput ===
                'function'
                ? integrationApi
                    .getLatestUnifiedPredictionInput()
                : null;

        if (
            options.refreshBaseMap ===
                true &&
            typeof integrationApi
                .renderLatestPredictionsOnMap ===
                'function'
        ) {
            await integrationApi
                .renderLatestPredictionsOnMap({
                    ...options,

                    fitBounds:
                        false
                });
        }

        return renderAdvancedMapLayers(
            predictions,
            {
                ...options,

                predictionInput:
                    latestInput,

                stormCells:
                    latestInput &&
                    Array.isArray(
                        latestInput
                            .stormCells
                    )
                        ? latestInput
                            .stormCells
                        : []
            }
        );
    }

    /**
     * Clear advanced map layers.
     *
     * @returns {Object}
     */
    function clearAdvancedMapLayers() {
        const advancedState =
            ensureAdvancedMapState();

        clearLeafletLayer(
            advancedState
                .layers
                .projectedPaths
        );

        clearLeafletLayer(
            advancedState
                .layers
                .movementIndicators
        );

        clearLeafletLayer(
            advancedState
                .layers
                .arrivalZones
        );

        advancedState
            .projectedPathIndex
            .clear();

        advancedState
            .movementIndicatorIndex
            .clear();

        advancedState
            .arrivalZoneIndex
            .clear();

        advancedState
            .renderedProjectedPathCount =
            0;

        advancedState
            .renderedMovementIndicatorCount =
            0;

        advancedState
            .renderedArrivalZoneCount =
            0;

        return {
            cleared:
                true
        };
    }

    /**
     * Start automatic map refresh.
     *
     * @param {Object} options
     * @returns {Object}
     */
    function startAdvancedMapAutoRefresh(
        options = {}
    ) {
        const advancedState =
            ensureAdvancedMapState();

        stopAdvancedMapAutoRefresh();

        const normalized =
            normalizeAdvancedMapOptions({
                ...options,

                autoRefreshMap:
                    true
            });

        advancedState
            .autoRefreshTimerId =
            globalObject.setInterval(
                () => {
                    renderLatestAdvancedMapLayers({
                        refreshBaseMap:
                            options
                                .refreshBaseMap !==
                            false
                    });
                },
                normalized
                    .autoRefreshIntervalMs
            );

        advancedState
            .autoRefreshActive =
            true;

        return {
            started:
                true,

            intervalMs:
                normalized
                    .autoRefreshIntervalMs
        };
    }

    /**
     * Stop automatic map refresh.
     *
     * @returns {boolean}
     */
    function stopAdvancedMapAutoRefresh() {
        const advancedState =
            ensureAdvancedMapState();

        if (
            advancedState
                .autoRefreshTimerId ===
                null
        ) {
            advancedState
                .autoRefreshActive =
                false;

            return false;
        }

        globalObject.clearInterval(
            advancedState
                .autoRefreshTimerId
        );

        advancedState
            .autoRefreshTimerId =
            null;

        advancedState
            .autoRefreshActive =
            false;

        return true;
    }

    /**
     * Set advanced map options.
     *
     * @param {Object} options
     * @param {Object} control
     * @returns {Object}
     */
    function setAdvancedMapOptions(
        options = {},
        control = {}
    ) {
        const normalized =
            normalizeAdvancedMapOptions(
                options
            );

        if (
            normalized.autoRefreshMap
        ) {
            startAdvancedMapAutoRefresh(
                normalized
            );
        } else if (
            options.autoRefreshMap ===
                false
        ) {
            stopAdvancedMapAutoRefresh();
        }

        if (
            control.rerender ===
                true
        ) {
            renderLatestAdvancedMapLayers({
                refreshBaseMap:
                    control
                        .refreshBaseMap ===
                        true
            });
        }

        return normalized;
    }

    /**
     * Wrap map rendering API.
     *
     * @returns {boolean}
     */
    function wrapMapRenderer() {
        if (
            integrationApi
                ._advancedMapRendererWrapped ===
                true ||
            typeof integrationApi
                .renderPredictionsOnMap !==
                'function'
        ) {
            return false;
        }

        const originalRenderer =
            integrationApi
                .renderPredictionsOnMap
                .bind(
                    integrationApi
                );

        integrationApi
            .renderPredictionsOnMap =
            async function wrappedMapRenderer(
                predictions,
                context = {}
            ) {
                const baseResult =
                    await originalRenderer(
                        predictions,
                        context
                    );

                let advancedResult =
                    null;

                if (
                    baseResult &&
                    baseResult.rendered &&
                    context
                        .renderAdvancedLayers !==
                        false
                ) {
                    advancedResult =
                        await renderAdvancedMapLayers(
                            predictions,
                            {
                                ...context,

                                stormCells:
                                    context
                                        .stormCells ||
                                    (
                                        context
                                            .predictionInput &&
                                        Array.isArray(
                                            context
                                                .predictionInput
                                                .stormCells
                                        )
                                            ? context
                                                .predictionInput
                                                .stormCells
                                            : []
                                    )
                            }
                        );
                }

                return {
                    ...baseResult,

                    advanced:
                        advancedResult
                };
            };

        integrationApi
            ._advancedMapRendererWrapped =
            true;

        return true;
    }

    /**
     * Return advanced map status.
     *
     * @returns {Object}
     */
    function getAdvancedMapStatus() {
        const advancedState =
            ensureAdvancedMapState();

        return {
            options: {
                ...advancedState.options,

                horizonMinutes:
                    advancedState
                        .options
                        .horizonMinutes
                        .slice()
            },

            stylesInstalled:
                advancedState
                    .stylesInstalled,

            autoRefreshActive:
                advancedState
                    .autoRefreshActive,

            autoRefreshIntervalMs:
                advancedState
                    .options
                    .autoRefreshIntervalMs,

            legendInstalled:
                Boolean(
                    advancedState
                        .legendControl
                ),

            layerControlInstalled:
                Boolean(
                    advancedState
                        .layerControl
                ),

            lastAdvancedRenderAt:
                advancedState
                    .lastAdvancedRenderAt,

            lastAdvancedRenderAtIso:
                advancedState
                    .lastAdvancedRenderAtIso,

            renderCount:
                advancedState
                    .renderCount,

            renderFailures:
                advancedState
                    .renderFailures,

            renderedProjectedPathCount:
                advancedState
                    .renderedProjectedPathCount,

            renderedMovementIndicatorCount:
                advancedState
                    .renderedMovementIndicatorCount,

            renderedArrivalZoneCount:
                advancedState
                    .renderedArrivalZoneCount,

            indexedProjectedPaths:
                advancedState
                    .projectedPathIndex
                    .size,

            indexedMovementIndicators:
                advancedState
                    .movementIndicatorIndex
                    .size,

            indexedArrivalZones:
                advancedState
                    .arrivalZoneIndex
                    .size
        };
    }

    /**
     * Extend runtime state.
     */
    ensureAdvancedMapState();

    /**
     * Extend public API.
     */
    integrationApi
        .installAdvancedMapStyles =
        installAdvancedMapStyles;

    integrationApi
        .normalizeAdvancedMapOptions =
        normalizeAdvancedMapOptions;

    integrationApi
        .renderAdvancedMapLayers =
        renderAdvancedMapLayers;

    integrationApi
        .renderLatestAdvancedMapLayers =
        renderLatestAdvancedMapLayers;

    integrationApi
        .clearAdvancedMapLayers =
        clearAdvancedMapLayers;

    integrationApi
        .startAdvancedMapAutoRefresh =
        startAdvancedMapAutoRefresh;

    integrationApi
        .stopAdvancedMapAutoRefresh =
        stopAdvancedMapAutoRefresh;

    integrationApi
        .setAdvancedMapOptions =
        setAdvancedMapOptions;

    integrationApi
        .getAdvancedMapStatus =
        getAdvancedMapStatus;

    integrationApi.metadata = {
        ...integrationApi
            .metadata,

        currentPart:
            '2.2B-2',

        nextPart:
            '2.2C-1',

        status:
            'section_complete',

        productionReady:
            false,

        moduleClosed:
            true,

        capabilities: [
            ...new Set([
                ...(
                    Array.isArray(
                        integrationApi
                            .metadata
                            .capabilities
                    )
                        ? integrationApi
                            .metadata
                            .capabilities
                        : []
                ),

                'projected_storm_paths',
                'animated_path_rendering',
                'storm_movement_indicators',
                'arrival_impact_zones',
                'map_risk_legend',
                'map_layer_controls',
                'advanced_map_auto_refresh',
                'prediction_horizon_visualization',
                'advanced_map_runtime_status'
            ])
        ]
    };

    /**
     * Extend internal API.
     */
    Object.assign(
        integrationApi._internals,
        {
            ADVANCED_MAP_STYLE_ID,
            ADVANCED_MAP_LAYER_IDS,
            DEFAULT_ADVANCED_MAP_OPTIONS,
            ADVANCED_MAP_CSS,

            ensureAdvancedMapState,
            ensureAdvancedLeafletLayers,
            normalizeProjectedPoint,
            extractProjectedPathPoints,
            createProjectedLeafletPath,
            createMovementIndicators,
            calculateArrivalZoneRadiusKm,
            createLeafletArrivalZone,
            renderAdvancedLeafletLayers,
            buildMapLegendHtml,
            buildMapControlsHtml,
            installMapLegend,
            installMapLayerControls,
            wrapMapRenderer
        }
    );

    /**
     * Initialize advanced map integration.
     */
    try {
        installAdvancedMapStyles();

        wrapMapRenderer();

        const mapInstance =
            discoverRainArrivalMap();

        if (
            mapInstance &&
            detectMapAdapterType(
                mapInstance
            ) ===
                'leaflet'
        ) {
            const options =
                normalizeAdvancedMapOptions();

            ensureAdvancedLeafletLayers(
                mapInstance
            );

            installMapLegend(
                mapInstance,
                options
            );

            installMapLayerControls(
                mapInstance,
                options
            );
        }
    } catch (error) {
        log(
            'debug',
            'Advanced rain arrival map initialization failed.',
            normalizeError(
                error,
                {
                    part:
                        '2.2B-2'
                }
            )
        );
    }

    log(
        'info',
        'Rain arrival integration Part 2.2B-2 loaded.',
        {
            advancedMap:
                getAdvancedMapStatus(),

            section:
                '2.2B complete'
        }
    );
})(
    typeof globalThis !==
        'undefined'
        ? globalThis
        : (
            typeof window !==
                'undefined'
                ? window
                : this
        )
);

/**
 * RainGuard AI V32
 * Rain Arrival Integration Engine
 *
 * Part:
 * 2.2C-1
 *
 * Responsibilities:
 * - Build rain arrival alert decisions
 * - Normalize alert severity and urgency
 * - Prevent duplicate notifications
 * - Apply city-specific cooldowns
 * - Create Arabic and English alert messages
 * - Register notification result consumer
 * - Support browser, in-app and generic notification adapters
 * - Track notification history and delivery status
 */

(function rainArrivalIntegrationV32NotificationBridge(globalObject) {
    'use strict';

    if (
        !globalObject ||
        !globalObject.RainGuardAI ||
        !globalObject.RainGuardAI.V32 ||
        !globalObject.RainGuardAI.V32
            .rainArrivalIntegration
    ) {
        throw new Error(
            'Rain Arrival Integration Part 2.2B-2 must be loaded before Part 2.2C-1.'
        );
    }

    const integrationApi =
        globalObject
            .RainGuardAI
            .V32
            .rainArrivalIntegration;

    const runtimeState =
        integrationApi._state;

    const internal =
        integrationApi._internals;

    const {
        toFiniteNumber,
        clamp,
        createRuntimeId,
        nowIso,
        normalizeError,
        normalizeUILanguage,
        detectUILanguage,
        getUIText,
        formatNumber,
        formatDateTime,
        formatArrivalDuration,
        normalizeRiskLevel,
        dispatchUIEvent,
        log
    } = internal;

    /**
     * Built-in notification consumer name.
     */
    const NOTIFICATION_CONSUMER_NAME =
        'rain_arrival_notification_consumer';

    /**
     * Notification channel types.
     */
    const NOTIFICATION_CHANNELS =
        Object.freeze({
            BROWSER:
                'browser',

            IN_APP:
                'in_app',

            GENERIC:
                'generic',

            EVENT:
                'event'
        });

    /**
     * Alert urgency values.
     */
    const ALERT_URGENCY =
        Object.freeze({
            IMMEDIATE:
                'immediate',

            SOON:
                'soon',

            WATCH:
                'watch',

            ADVISORY:
                'advisory',

            NONE:
                'none'
        });

    /**
     * Default notification configuration.
     */
    const DEFAULT_NOTIFICATION_OPTIONS =
        Object.freeze({
            enabled:
                true,

            browserNotifications:
                true,

            inAppNotifications:
                true,

            genericNotifications:
                true,

            eventNotifications:
                true,

            requestBrowserPermission:
                false,

            minimumConfidence:
                55,

            minimumProbability:
                30,

            maximumArrivalMinutes:
                180,

            immediateArrivalMinutes:
                30,

            soonArrivalMinutes:
                60,

            watchArrivalMinutes:
                120,

            minimumRiskLevel:
                'low',

            cityCooldownMs:
                45 *
                60 *
                1000,

            severeCityCooldownMs:
                20 *
                60 *
                1000,

            globalCooldownMs:
                3000,

            maximumNotificationsPerCycle:
                10,

            maximumHistory:
                200,

            notifyRejectedPredictions:
                false,

            notifyNoRain:
                false,

            notifyOnRiskIncrease:
                true,

            notifyOnEarlierArrival:
                true,

            earlierArrivalThresholdMinutes:
                15,

            notifyOnConfidenceIncrease:
                false,

            confidenceIncreaseThreshold:
                15,

            notificationTagPrefix:
                'rainguard-v32-arrival',

            requireUserInteractionForExtreme:
                true,

            includeCoordinates:
                false,

            includeArrivalClockTime:
                true,

            language:
                null
        });

    /**
     * Risk priority.
     */
    const NOTIFICATION_RISK_PRIORITY =
        Object.freeze({
            unknown:
                0,

            minimal:
                1,

            low:
                2,

            moderate:
                3,

            high:
                4,

            extreme:
                5
        });

    /**
     * Notification text dictionary.
     */
    const NOTIFICATION_TEXT =
        Object.freeze({
            ar: {
                immediateTitle:
                    'تنبيه عاجل: اقتراب المطر',

                soonTitle:
                    'تنبيه وصول المطر',

                watchTitle:
                    'متابعة وصول المطر',

                advisoryTitle:
                    'توقع وصول المطر',

                arrivalNow:
                    'يُتوقع وصول المطر الآن إلى',

                arrivalWithin:
                    'يُتوقع وصول المطر إلى',

                probability:
                    'احتمال المطر',

                confidence:
                    'الثقة',

                risk:
                    'الخطورة',

                intensity:
                    'الشدة',

                expectedAt:
                    'الوقت المتوقع',

                source:
                    'المصدر',

                stormCell:
                    'الخلية الرعدية',

                location:
                    'الموقع',

                immediate:
                    'عاجل',

                soon:
                    'قريب',

                watch:
                    'متابعة',

                advisory:
                    'إرشادي',

                unknownCity:
                    'مدينة غير محددة',

                notificationUnavailable:
                    'الإشعارات غير متاحة',

                permissionDenied:
                    'تم رفض إذن الإشعارات',

                permissionRequired:
                    'يلزم منح إذن الإشعارات',

                rainExpected:
                    'متوقع وصول المطر',

                highRisk:
                    'خطورة عالية',

                extremeRisk:
                    'خطورة قصوى'
            },

            en: {
                immediateTitle:
                    'Urgent Alert: Rain Approaching',

                soonTitle:
                    'Rain Arrival Alert',

                watchTitle:
                    'Rain Arrival Watch',

                advisoryTitle:
                    'Rain Arrival Forecast',

                arrivalNow:
                    'Rain is expected to arrive now in',

                arrivalWithin:
                    'Rain is expected to arrive in',

                probability:
                    'Rain probability',

                confidence:
                    'Confidence',

                risk:
                    'Risk',

                intensity:
                    'Intensity',

                expectedAt:
                    'Expected time',

                source:
                    'Source',

                stormCell:
                    'Storm cell',

                location:
                    'Location',

                immediate:
                    'Immediate',

                soon:
                    'Soon',

                watch:
                    'Watch',

                advisory:
                    'Advisory',

                unknownCity:
                    'Unknown city',

                notificationUnavailable:
                    'Notifications are unavailable',

                permissionDenied:
                    'Notification permission denied',

                permissionRequired:
                    'Notification permission required',

                rainExpected:
                    'Rain expected',

                highRisk:
                    'High risk',

                extremeRisk:
                    'Extreme risk'
            }
        });

    /**
     * Ensure notification state.
     *
     * @returns {Object}
     */
    function ensureNotificationState() {
        if (
            !runtimeState.notifications ||
            typeof runtimeState
                .notifications !==
                'object'
        ) {
            runtimeState.notifications = {
                options: {
                    ...DEFAULT_NOTIFICATION_OPTIONS
                },

                consumerName:
                    NOTIFICATION_CONSUMER_NAME,

                consumerRegistered:
                    false,

                lastGlobalNotificationAt:
                    null,

                cityCooldowns:
                    new Map(),

                latestCityAlerts:
                    new Map(),

                history:
                    [],

                sentCount:
                    0,

                skippedCount:
                    0,

                failedCount:
                    0,

                browserSentCount:
                    0,

                inAppSentCount:
                    0,

                genericSentCount:
                    0,

                eventSentCount:
                    0,

                lastDeliveryAt:
                    null,

                lastDeliveryAtIso:
                    null,

                lastError:
                    null,

                browserPermission:
                    typeof globalObject
                        .Notification !==
                        'undefined'
                        ? globalObject
                            .Notification
                            .permission
                        : 'unsupported'
            };
        }

        if (
            !(runtimeState
                .notifications
                .cityCooldowns instanceof Map)
        ) {
            runtimeState
                .notifications
                .cityCooldowns =
                new Map();
        }

        if (
            !(runtimeState
                .notifications
                .latestCityAlerts instanceof Map)
        ) {
            runtimeState
                .notifications
                .latestCityAlerts =
                new Map();
        }

        if (
            !Array.isArray(
                runtimeState
                    .notifications
                    .history
            )
        ) {
            runtimeState
                .notifications
                .history =
                [];
        }

        return runtimeState.notifications;
    }

    /**
     * Normalize notification options.
     *
     * @param {Object} options
     * @returns {Object}
     */
    function normalizeNotificationOptions(
        options = {}
    ) {
        const notificationState =
            ensureNotificationState();

        const normalized = {
            ...DEFAULT_NOTIFICATION_OPTIONS,
            ...notificationState.options,
            ...options
        };

        normalized.enabled =
            normalized.enabled !==
            false;

        normalized.browserNotifications =
            normalized.browserNotifications !==
            false;

        normalized.inAppNotifications =
            normalized.inAppNotifications !==
            false;

        normalized.genericNotifications =
            normalized.genericNotifications !==
            false;

        normalized.eventNotifications =
            normalized.eventNotifications !==
            false;

        normalized.requestBrowserPermission =
            normalized.requestBrowserPermission ===
            true;

        normalized.minimumConfidence =
            clamp(
                toFiniteNumber(
                    normalized
                        .minimumConfidence,
                    DEFAULT_NOTIFICATION_OPTIONS
                        .minimumConfidence
                ),
                0,
                100
            );

        normalized.minimumProbability =
            clamp(
                toFiniteNumber(
                    normalized
                        .minimumProbability,
                    DEFAULT_NOTIFICATION_OPTIONS
                        .minimumProbability
                ),
                0,
                100
            );

        normalized.maximumArrivalMinutes =
            Math.max(
                1,
                toFiniteNumber(
                    normalized
                        .maximumArrivalMinutes,
                    DEFAULT_NOTIFICATION_OPTIONS
                        .maximumArrivalMinutes
                )
            );

        normalized.immediateArrivalMinutes =
            Math.max(
                0,
                toFiniteNumber(
                    normalized
                        .immediateArrivalMinutes,
                    DEFAULT_NOTIFICATION_OPTIONS
                        .immediateArrivalMinutes
                )
            );

        normalized.soonArrivalMinutes =
            Math.max(
                normalized
                    .immediateArrivalMinutes,
                toFiniteNumber(
                    normalized
                        .soonArrivalMinutes,
                    DEFAULT_NOTIFICATION_OPTIONS
                        .soonArrivalMinutes
                )
            );

        normalized.watchArrivalMinutes =
            Math.max(
                normalized
                    .soonArrivalMinutes,
                toFiniteNumber(
                    normalized
                        .watchArrivalMinutes,
                    DEFAULT_NOTIFICATION_OPTIONS
                        .watchArrivalMinutes
                )
            );

        normalized.minimumRiskLevel =
            normalizeRiskLevel(
                normalized
                    .minimumRiskLevel
            );

        normalized.cityCooldownMs =
            Math.max(
                0,
                toFiniteNumber(
                    normalized
                        .cityCooldownMs,
                    DEFAULT_NOTIFICATION_OPTIONS
                        .cityCooldownMs
                )
            );

        normalized.severeCityCooldownMs =
            Math.max(
                0,
                toFiniteNumber(
                    normalized
                        .severeCityCooldownMs,
                    DEFAULT_NOTIFICATION_OPTIONS
                        .severeCityCooldownMs
                )
            );

        normalized.globalCooldownMs =
            Math.max(
                0,
                toFiniteNumber(
                    normalized
                        .globalCooldownMs,
                    DEFAULT_NOTIFICATION_OPTIONS
                        .globalCooldownMs
                )
            );

        normalized.maximumNotificationsPerCycle =
            Math.max(
                1,
                Math.round(
                    toFiniteNumber(
                        normalized
                            .maximumNotificationsPerCycle,
                        DEFAULT_NOTIFICATION_OPTIONS
                            .maximumNotificationsPerCycle
                    )
                )
            );

        normalized.maximumHistory =
            Math.max(
                10,
                Math.round(
                    toFiniteNumber(
                        normalized
                            .maximumHistory,
                        DEFAULT_NOTIFICATION_OPTIONS
                            .maximumHistory
                    )
                )
            );

        normalized.notifyRejectedPredictions =
            normalized.notifyRejectedPredictions ===
            true;

        normalized.notifyNoRain =
            normalized.notifyNoRain ===
            true;

        normalized.notifyOnRiskIncrease =
            normalized.notifyOnRiskIncrease !==
            false;

        normalized.notifyOnEarlierArrival =
            normalized.notifyOnEarlierArrival !==
            false;

        normalized.earlierArrivalThresholdMinutes =
            Math.max(
                1,
                toFiniteNumber(
                    normalized
                        .earlierArrivalThresholdMinutes,
                    DEFAULT_NOTIFICATION_OPTIONS
                        .earlierArrivalThresholdMinutes
                )
            );

        normalized.notifyOnConfidenceIncrease =
            normalized.notifyOnConfidenceIncrease ===
            true;

        normalized.confidenceIncreaseThreshold =
            Math.max(
                1,
                toFiniteNumber(
                    normalized
                        .confidenceIncreaseThreshold,
                    DEFAULT_NOTIFICATION_OPTIONS
                        .confidenceIncreaseThreshold
                )
            );

        normalized.requireUserInteractionForExtreme =
            normalized
                .requireUserInteractionForExtreme !==
            false;

        normalized.includeCoordinates =
            normalized.includeCoordinates ===
            true;

        normalized.includeArrivalClockTime =
            normalized.includeArrivalClockTime !==
            false;

        normalized.language =
            normalizeUILanguage(
                normalized.language ||
                detectUILanguage()
            );

        notificationState.options =
            normalized;

        return {
            ...normalized
        };
    }

    /**
     * Return translated notification text.
     *
     * @param {string} key
     * @param {string} language
     * @returns {string}
     */
    function getNotificationText(
        key,
        language
    ) {
        const normalizedLanguage =
            normalizeUILanguage(
                language
            );

        return (
            NOTIFICATION_TEXT[
                normalizedLanguage
            ] &&
            NOTIFICATION_TEXT[
                normalizedLanguage
            ][key]
        ) ||
        NOTIFICATION_TEXT.ar[key] ||
        key;
    }

    /**
     * Infer alert urgency.
     *
     * @param {Object} prediction
     * @param {Object} options
     * @returns {string}
     */
    function inferAlertUrgency(
        prediction,
        options
    ) {
        const arrivalMinutes =
            toFiniteNumber(
                prediction
                    .arrivalMinutes,
                Number
                    .POSITIVE_INFINITY
            );

        const riskLevel =
            normalizeRiskLevel(
                prediction.riskLevel
            );

        if (
            riskLevel ===
                'extreme' ||
            arrivalMinutes <=
                options
                    .immediateArrivalMinutes
        ) {
            return ALERT_URGENCY
                .IMMEDIATE;
        }

        if (
            riskLevel ===
                'high' ||
            arrivalMinutes <=
                options
                    .soonArrivalMinutes
        ) {
            return ALERT_URGENCY.SOON;
        }

        if (
            riskLevel ===
                'moderate' ||
            arrivalMinutes <=
                options
                    .watchArrivalMinutes
        ) {
            return ALERT_URGENCY.WATCH;
        }

        if (
            prediction.willRain
        ) {
            return ALERT_URGENCY
                .ADVISORY;
        }

        return ALERT_URGENCY.NONE;
    }

    /**
     * Determine whether prediction passes notification rules.
     *
     * @param {Object} prediction
     * @param {Object} options
     * @returns {{allowed:boolean,reason:string|null}}
     */
    function evaluatePredictionForNotification(
        prediction,
        options
    ) {
        if (!prediction) {
            return {
                allowed:
                    false,

                reason:
                    'prediction_missing'
            };
        }

        if (
            prediction.accepted ===
                false &&
            !options
                .notifyRejectedPredictions
        ) {
            return {
                allowed:
                    false,

                reason:
                    'prediction_rejected'
            };
        }

        if (
            !prediction.willRain &&
            !options.notifyNoRain
        ) {
            return {
                allowed:
                    false,

                reason:
                    'rain_not_expected'
            };
        }

        const confidence =
            toFiniteNumber(
                prediction.confidence,
                0
            );

        if (
            confidence <
            options.minimumConfidence
        ) {
            return {
                allowed:
                    false,

                reason:
                    'confidence_below_threshold'
            };
        }

        const probability =
            toFiniteNumber(
                prediction.probability,
                0
            );

        if (
            probability <
            options.minimumProbability
        ) {
            return {
                allowed:
                    false,

                reason:
                    'probability_below_threshold'
            };
        }

        const arrivalMinutes =
            toFiniteNumber(
                prediction
                    .arrivalMinutes,
                Number
                    .POSITIVE_INFINITY
            );

        if (
            arrivalMinutes >
            options.maximumArrivalMinutes
        ) {
            return {
                allowed:
                    false,

                reason:
                    'arrival_outside_window'
            };
        }

        const riskLevel =
            normalizeRiskLevel(
                prediction.riskLevel
            );

        if (
            NOTIFICATION_RISK_PRIORITY[
                riskLevel
            ] <
            NOTIFICATION_RISK_PRIORITY[
                options.minimumRiskLevel
            ]
        ) {
            return {
                allowed:
                    false,

                reason:
                    'risk_below_threshold'
            };
        }

        return {
            allowed:
                true,

            reason:
                null
        };
    }

    /**
     * Determine whether cooldown allows notification.
     *
     * @param {Object} prediction
     * @param {Object} options
     * @returns {{allowed:boolean,reason:string|null,remainingMs:number}}
     */
    function evaluateNotificationCooldown(
        prediction,
        options
    ) {
        const notificationState =
            ensureNotificationState();

        const now =
            Date.now();

        if (
            notificationState
                .lastGlobalNotificationAt &&
            now -
                notificationState
                    .lastGlobalNotificationAt <
                options.globalCooldownMs
        ) {
            return {
                allowed:
                    false,

                reason:
                    'global_cooldown',

                remainingMs:
                    options
                        .globalCooldownMs -
                    (
                        now -
                        notificationState
                            .lastGlobalNotificationAt
                    )
            };
        }

        const cityKey =
            String(
                prediction.cityId ||
                prediction.cityName ||
                prediction.cityNameAr ||
                'unknown'
            );

        const lastNotification =
            notificationState
                .cityCooldowns
                .get(
                    cityKey
                );

        if (!lastNotification) {
            return {
                allowed:
                    true,

                reason:
                    null,

                remainingMs:
                    0
            };
        }

        const riskLevel =
            normalizeRiskLevel(
                prediction.riskLevel
            );

        const cooldownMs =
            [
                'high',
                'extreme'
            ].includes(
                riskLevel
            )
                ? options
                    .severeCityCooldownMs
                : options
                    .cityCooldownMs;

        const elapsed =
            now -
            lastNotification.sentAt;

        if (
            elapsed >=
            cooldownMs
        ) {
            return {
                allowed:
                    true,

                reason:
                    null,

                remainingMs:
                    0
            };
        }

        const previousPrediction =
            notificationState
                .latestCityAlerts
                .get(
                    cityKey
                );

        if (
            previousPrediction &&
            options
                .notifyOnRiskIncrease &&
            NOTIFICATION_RISK_PRIORITY[
                normalizeRiskLevel(
                    prediction.riskLevel
                )
            ] >
            NOTIFICATION_RISK_PRIORITY[
                normalizeRiskLevel(
                    previousPrediction
                        .riskLevel
                )
            ]
        ) {
            return {
                allowed:
                    true,

                reason:
                    'risk_increased',

                remainingMs:
                    0
            };
        }

        if (
            previousPrediction &&
            options
                .notifyOnEarlierArrival
        ) {
            const previousArrival =
                toFiniteNumber(
                    previousPrediction
                        .arrivalMinutes,
                    Number
                        .POSITIVE_INFINITY
                );

            const currentArrival =
                toFiniteNumber(
                    prediction
                        .arrivalMinutes,
                    Number
                        .POSITIVE_INFINITY
                );

            if (
                previousArrival -
                currentArrival >=
                options
                    .earlierArrivalThresholdMinutes
            ) {
                return {
                    allowed:
                        true,

                    reason:
                        'arrival_became_earlier',

                    remainingMs:
                        0
                };
            }
        }

        if (
            previousPrediction &&
            options
                .notifyOnConfidenceIncrease
        ) {
            const confidenceIncrease =
                toFiniteNumber(
                    prediction.confidence,
                    0
                ) -
                toFiniteNumber(
                    previousPrediction
                        .confidence,
                    0
                );

            if (
                confidenceIncrease >=
                options
                    .confidenceIncreaseThreshold
            ) {
                return {
                    allowed:
                        true,

                    reason:
                        'confidence_increased',

                    remainingMs:
                        0
                };
            }
        }

        return {
            allowed:
                false,

            reason:
                'city_cooldown',

            remainingMs:
                Math.max(
                    0,
                    cooldownMs -
                    elapsed
                )
        };
    }

    /**
     * Build alert title.
     *
     * @param {string} urgency
     * @param {string} language
     * @returns {string}
     */
    function buildAlertTitle(
        urgency,
        language
    ) {
        switch (urgency) {
            case ALERT_URGENCY
                .IMMEDIATE:
                return getNotificationText(
                    'immediateTitle',
                    language
                );

            case ALERT_URGENCY.SOON:
                return getNotificationText(
                    'soonTitle',
                    language
                );

            case ALERT_URGENCY.WATCH:
                return getNotificationText(
                    'watchTitle',
                    language
                );

            case ALERT_URGENCY
                .ADVISORY:
            default:
                return getNotificationText(
                    'advisoryTitle',
                    language
                );
        }
    }

    /**
     * Resolve alert city name.
     *
     * @param {Object} prediction
     * @param {string} language
     * @returns {string}
     */
    function resolveAlertCityName(
        prediction,
        language
    ) {
        if (
            language ===
            'ar'
        ) {
            return (
                prediction.cityNameAr ||
                prediction.cityName ||
                prediction.cityId ||
                getNotificationText(
                    'unknownCity',
                    language
                )
            );
        }

        return (
            prediction.cityName ||
            prediction.cityNameAr ||
            prediction.cityId ||
            getNotificationText(
                'unknownCity',
                language
            )
        );
    }

    /**
     * Build alert body.
     *
     * @param {Object} prediction
     * @param {string} urgency
     * @param {Object} options
     * @returns {string}
     */
    function buildAlertBody(
        prediction,
        urgency,
        options
    ) {
        const language =
            options.language;

        const cityName =
            resolveAlertCityName(
                prediction,
                language
            );

        const arrivalText =
            formatArrivalDuration(
                prediction.arrivalMinutes,
                language
            );

        const riskLevel =
            normalizeRiskLevel(
                prediction.riskLevel
            );

        const firstSentence =
            urgency ===
                ALERT_URGENCY
                    .IMMEDIATE &&
            toFiniteNumber(
                prediction
                    .arrivalMinutes,
                0
            ) <= 0
                ? `${getNotificationText(
                    'arrivalNow',
                    language
                )} ${cityName}.`
                : `${getNotificationText(
                    'arrivalWithin',
                    language
                )} ${cityName} ${language ===
                    'ar'
                    ? 'خلال'
                    : 'within'} ${arrivalText}.`;

        const lines = [
            firstSentence,

            `${getNotificationText(
                'probability',
                language
            )}: ${formatNumber(
                prediction.probability,
                0,
                language
            )}%`,

            `${getNotificationText(
                'confidence',
                language
            )}: ${formatNumber(
                prediction.confidence,
                0,
                language
            )}%`,

            `${getNotificationText(
                'risk',
                language
            )}: ${getUIText(
                riskLevel,
                language
            )}`
        ];

        if (
            toFiniteNumber(
                prediction.intensity,
                0
            ) > 0
        ) {
            lines.push(
                `${getNotificationText(
                    'intensity',
                    language
                )}: ${formatNumber(
                    prediction.intensity,
                    1,
                    language
                )}`
            );
        }

        if (
            options
                .includeArrivalClockTime &&
            prediction.arrivalTime
        ) {
            lines.push(
                `${getNotificationText(
                    'expectedAt',
                    language
                )}: ${formatDateTime(
                    prediction.arrivalTime,
                    language
                )}`
            );
        }

        if (
            prediction.sourceCellId
        ) {
            lines.push(
                `${getNotificationText(
                    'stormCell',
                    language
                )}: ${prediction.sourceCellId}`
            );
        }

        if (
            options.includeCoordinates &&
            Number.isFinite(
                toFiniteNumber(
                    prediction.latitude,
                    NaN
                )
            ) &&
            Number.isFinite(
                toFiniteNumber(
                    prediction.longitude,
                    NaN
                )
            )
        ) {
            lines.push(
                `${getNotificationText(
                    'location',
                    language
                )}: ${formatNumber(
                    prediction.latitude,
                    4,
                    language
                )}, ${formatNumber(
                    prediction.longitude,
                    4,
                    language
                )}`
            );
        }

        return lines.join(
            '\n'
        );
    }

    /**
     * Build notification alert object.
     *
     * @param {Object} prediction
     * @param {Object} options
     * @returns {Object}
     */
    function buildRainArrivalAlert(
        prediction,
        options
    ) {
        const urgency =
            inferAlertUrgency(
                prediction,
                options
            );

        const riskLevel =
            normalizeRiskLevel(
                prediction.riskLevel
            );

        const cityKey =
            String(
                prediction.cityId ||
                prediction.cityName ||
                prediction.cityNameAr ||
                'unknown'
            );

        const title =
            buildAlertTitle(
                urgency,
                options.language
            );

        const body =
            buildAlertBody(
                prediction,
                urgency,
                options
            );

        return {
            id:
                createRuntimeId(
                    'rain_arrival_alert'
                ),

            tag:
                `${options.notificationTagPrefix}-${cityKey}`,

            title,

            body,

            urgency,

            riskLevel,

            cityKey,

            cityId:
                prediction.cityId ||
                null,

            cityName:
                resolveAlertCityName(
                    prediction,
                    options.language
                ),

            predictionId:
                prediction.id ||
                null,

            arrivalMinutes:
                prediction
                    .arrivalMinutes,

            arrivalTime:
                prediction
                    .arrivalTime,

            probability:
                prediction
                    .probability,

            confidence:
                prediction
                    .confidence,

            intensity:
                prediction
                    .intensity,

            sourceCellId:
                prediction
                    .sourceCellId ||
                null,

            latitude:
                prediction
                    .latitude,

            longitude:
                prediction
                    .longitude,

            requireInteraction:
                riskLevel ===
                    'extreme' &&
                options
                    .requireUserInteractionForExtreme,

            silent:
                urgency ===
                ALERT_URGENCY
                    .ADVISORY,

            language:
                options.language,

            prediction,

            createdAt:
                Date.now(),

            createdAtIso:
                nowIso()
        };
    }

    /**
     * Request browser notification permission.
     *
     * @returns {Promise<string>}
     */
    async function requestBrowserNotificationPermission() {
        const notificationState =
            ensureNotificationState();

        if (
            typeof globalObject
                .Notification ===
                'undefined'
        ) {
            notificationState
                .browserPermission =
                'unsupported';

            return 'unsupported';
        }

        if (
            globalObject
                .Notification
                .permission ===
                'granted'
        ) {
            notificationState
                .browserPermission =
                'granted';

            return 'granted';
        }

        if (
            globalObject
                .Notification
                .permission ===
                'denied'
        ) {
            notificationState
                .browserPermission =
                'denied';

            return 'denied';
        }

        try {
            const permission =
                await globalObject
                    .Notification
                    .requestPermission();

            notificationState
                .browserPermission =
                permission;

            return permission;
        } catch (error) {
            notificationState
                .browserPermission =
                'error';

            notificationState
                .lastError =
                normalizeError(
                    error
                );

            return 'error';
        }
    }

    /**
     * Send browser notification.
     *
     * @param {Object} alert
     * @param {Object} options
     * @returns {Promise<Object>}
     */
    async function sendBrowserNotification(
        alert,
        options
    ) {
        const notificationState =
            ensureNotificationState();

        if (
            !options
                .browserNotifications
        ) {
            return {
                channel:
                    NOTIFICATION_CHANNELS
                        .BROWSER,

                sent:
                    false,

                reason:
                    'channel_disabled'
            };
        }

        if (
            typeof globalObject
                .Notification ===
                'undefined'
        ) {
            return {
                channel:
                    NOTIFICATION_CHANNELS
                        .BROWSER,

                sent:
                    false,

                reason:
                    'unsupported'
            };
        }

        let permission =
            globalObject
                .Notification
                .permission;

        if (
            permission ===
                'default' &&
            options
                .requestBrowserPermission
        ) {
            permission =
                await requestBrowserNotificationPermission();
        }

        if (
            permission !==
            'granted'
        ) {
            return {
                channel:
                    NOTIFICATION_CHANNELS
                        .BROWSER,

                sent:
                    false,

                reason:
                    permission ===
                        'denied'
                        ? 'permission_denied'
                        : 'permission_required',

                permission
            };
        }

        try {
            const notification =
                new globalObject
                    .Notification(
                        alert.title,
                        {
                            body:
                                alert.body,

                            tag:
                                alert.tag,

                            renotify:
                                true,

                            silent:
                                alert.silent,

                            requireInteraction:
                                alert
                                    .requireInteraction,

                            data: {
                                alertId:
                                    alert.id,

                                cityId:
                                    alert.cityId,

                                predictionId:
                                    alert
                                        .predictionId,

                                latitude:
                                    alert.latitude,

                                longitude:
                                    alert.longitude,

                                riskLevel:
                                    alert.riskLevel,

                                urgency:
                                    alert.urgency
                            }
                        }
                    );

            notification.onclick =
                function handleNotificationClick() {
                    try {
                        globalObject.focus();
                    } catch (error) {
                        log(
                            'debug',
                            'Window focus failed after notification click.',
                            normalizeError(
                                error
                            )
                        );
                    }

                    if (
                        typeof integrationApi
                            .selectCityCard ===
                            'function' &&
                        alert.cityId
                    ) {
                        integrationApi
                            .selectCityCard(
                                alert.cityId,
                                {
                                    scrollIntoView:
                                        true,

                                    focusMap:
                                        true
                                }
                            );
                    }

                    notification.close();
                };

            notificationState
                .browserSentCount +=
                1;

            return {
                channel:
                    NOTIFICATION_CHANNELS
                        .BROWSER,

                sent:
                    true,

                notification
            };
        } catch (error) {
            return {
                channel:
                    NOTIFICATION_CHANNELS
                        .BROWSER,

                sent:
                    false,

                reason:
                    'browser_notification_failed',

                error:
                    normalizeError(
                        error
                    )
            };
        }
    }

    /**
     * Discover generic notification adapter.
     *
     * @returns {Object|null}
     */
    function discoverNotificationAdapter() {
        const candidates = [
            globalObject
                .RainGuardNotifications,

            globalObject
                .rainGuardNotifications,

            globalObject
                .NotificationManager,

            globalObject
                .notificationManager,

            globalObject
                .AlertManager,

            globalObject
                .alertManager,

            globalObject
                .RainGuardAI &&
            globalObject
                .RainGuardAI
                .notifications,

            globalObject
                .RainGuardAI &&
            globalObject
                .RainGuardAI
                .V32 &&
            globalObject
                .RainGuardAI
                .V32
                .notifications
        ];

        return candidates.find(
            (candidate) =>
                candidate &&
                typeof candidate ===
                    'object'
        ) ||
        null;
    }

    /**
     * Send generic notification.
     *
     * @param {Object} alert
     * @param {Object} options
     * @returns {Promise<Object>}
     */
    async function sendGenericNotification(
        alert,
        options
    ) {
        const notificationState =
            ensureNotificationState();

        if (
            !options.genericNotifications
        ) {
            return {
                channel:
                    NOTIFICATION_CHANNELS
                        .GENERIC,

                sent:
                    false,

                reason:
                    'channel_disabled'
            };
        }

        const adapter =
            discoverNotificationAdapter();

        if (!adapter) {
            return {
                channel:
                    NOTIFICATION_CHANNELS
                        .GENERIC,

                sent:
                    false,

                reason:
                    'adapter_not_found'
            };
        }

        const methods = [
            'notify',
            'send',
            'push',
            'show',
            'createNotification',
            'sendNotification',
            'showNotification',
            'publishAlert'
        ];

        for (
            const methodName
            of methods
        ) {
            if (
                typeof adapter[
                    methodName
                ] !==
                'function'
            ) {
                continue;
            }

            try {
                const response =
                    await Promise.resolve(
                        adapter[
                            methodName
                        ]({
                            id:
                                alert.id,

                            title:
                                alert.title,

                            message:
                                alert.body,

                            body:
                                alert.body,

                            type:
                                alert.riskLevel,

                            severity:
                                alert.riskLevel,

                            urgency:
                                alert.urgency,

                            cityId:
                                alert.cityId,

                            prediction:
                                alert.prediction,

                            data:
                                alert
                        })
                    );

                notificationState
                    .genericSentCount +=
                    1;

                return {
                    channel:
                        NOTIFICATION_CHANNELS
                            .GENERIC,

                    sent:
                        true,

                    methodName,

                    response
                };
            } catch (error) {
                return {
                    channel:
                        NOTIFICATION_CHANNELS
                            .GENERIC,

                    sent:
                        false,

                    methodName,

                    reason:
                        'adapter_delivery_failed',

                    error:
                        normalizeError(
                            error
                        )
                };
            }
        }

        return {
            channel:
                NOTIFICATION_CHANNELS
                    .GENERIC,

            sent:
                false,

            reason:
                'compatible_method_not_found'
        };
    }

    /**
     * Send in-app notification event.
     *
     * @param {Object} alert
     * @param {Object} options
     * @returns {Object}
     */
    function sendInAppNotification(
        alert,
        options
    ) {
        const notificationState =
            ensureNotificationState();

        if (
            !options.inAppNotifications
        ) {
            return {
                channel:
                    NOTIFICATION_CHANNELS
                        .IN_APP,

                sent:
                    false,

                reason:
                    'channel_disabled'
            };
        }

        const dispatched =
            dispatchUIEvent(
                'rainguard:v32:rain-arrival:notification',
                {
                    alert,

                    title:
                        alert.title,

                    message:
                        alert.body,

                    severity:
                        alert.riskLevel,

                    urgency:
                        alert.urgency,

                    timestamp:
                        Date.now(),

                    timestampIso:
                        nowIso()
                }
            );

        if (dispatched) {
            notificationState
                .inAppSentCount +=
                1;
        }

        return {
            channel:
                NOTIFICATION_CHANNELS
                    .IN_APP,

            sent:
                dispatched,

            reason:
                dispatched
                    ? null
                    : 'event_dispatch_unavailable'
        };
    }

    /**
     * Send raw event notification.
     *
     * @param {Object} alert
     * @param {Object} options
     * @returns {Object}
     */
    function sendEventNotification(
        alert,
        options
    ) {
        const notificationState =
            ensureNotificationState();

        if (
            !options.eventNotifications
        ) {
            return {
                channel:
                    NOTIFICATION_CHANNELS
                        .EVENT,

                sent:
                    false,

                reason:
                    'channel_disabled'
            };
        }

        const dispatched =
            dispatchUIEvent(
                'rainguard:v32:rain-arrival:alert-created',
                alert
            );

        if (dispatched) {
            notificationState
                .eventSentCount +=
                1;
        }

        return {
            channel:
                NOTIFICATION_CHANNELS
                    .EVENT,

            sent:
                dispatched,

            reason:
                dispatched
                    ? null
                    : 'event_dispatch_unavailable'
        };
    }

    /**
     * Save notification history.
     *
     * @param {Object} historyItem
     * @param {Object} options
     */
    function storeNotificationHistory(
        historyItem,
        options
    ) {
        const notificationState =
            ensureNotificationState();

        notificationState
            .history
            .unshift(
                historyItem
            );

        if (
            notificationState
                .history
                .length >
            options.maximumHistory
        ) {
            notificationState
                .history
                .length =
                options.maximumHistory;
        }
    }

    /**
     * Send one rain arrival alert.
     *
     * @param {Object} alert
     * @param {Object} options
     * @returns {Promise<Object>}
     */
    async function deliverRainArrivalAlert(
        alert,
        options
    ) {
        const notificationState =
            ensureNotificationState();

        const startedAt =
            Date.now();

        const deliveries =
            await Promise.all([
                sendBrowserNotification(
                    alert,
                    options
                ),

                sendGenericNotification(
                    alert,
                    options
                ),

                Promise.resolve(
                    sendInAppNotification(
                        alert,
                        options
                    )
                ),

                Promise.resolve(
                    sendEventNotification(
                        alert,
                        options
                    )
                )
            ]);

        const successfulDeliveries =
            deliveries.filter(
                (delivery) =>
                    delivery.sent
            );

        const delivered =
            successfulDeliveries.length >
            0;

        const completedAt =
            Date.now();

        const result = {
            id:
                createRuntimeId(
                    'notification_delivery'
                ),

            alertId:
                alert.id,

            delivered,

            successfulChannelCount:
                successfulDeliveries.length,

            failedChannelCount:
                deliveries.length -
                successfulDeliveries.length,

            deliveries,

            alert,

            startedAt,

            startedAtIso:
                new Date(
                    startedAt
                ).toISOString(),

            completedAt,

            completedAtIso:
                new Date(
                    completedAt
                ).toISOString(),

            durationMs:
                completedAt -
                startedAt
        };

        if (delivered) {
            notificationState
                .sentCount +=
                1;

            notificationState
                .lastGlobalNotificationAt =
                completedAt;

            notificationState
                .lastDeliveryAt =
                completedAt;

            notificationState
                .lastDeliveryAtIso =
                result.completedAtIso;

            notificationState
                .cityCooldowns
                .set(
                    alert.cityKey,
                    {
                        sentAt:
                            completedAt,

                        alertId:
                            alert.id,

                        riskLevel:
                            alert.riskLevel,

                        urgency:
                            alert.urgency
                    }
                );

            notificationState
                .latestCityAlerts
                .set(
                    alert.cityKey,
                    {
                        ...alert.prediction
                    }
                );
        } else {
            notificationState
                .failedCount +=
                1;
        }

        storeNotificationHistory(
            result,
            options
        );

        return result;
    }

    /**
     * Sort notification candidates.
     *
     * @param {Array<Object>} candidates
     * @returns {Array<Object>}
     */
    function sortNotificationCandidates(
        candidates
    ) {
        return candidates
            .slice()
            .sort(
                (left, right) => {
                    const urgencyPriority = {
                        immediate:
                            4,

                        soon:
                            3,

                        watch:
                            2,

                        advisory:
                            1,

                        none:
                            0
                    };

                    const urgencyDifference =
                        urgencyPriority[
                            right.urgency
                        ] -
                        urgencyPriority[
                            left.urgency
                        ];

                    if (
                        urgencyDifference !==
                        0
                    ) {
                        return urgencyDifference;
                    }

                    const riskDifference =
                        NOTIFICATION_RISK_PRIORITY[
                            right.riskLevel
                        ] -
                        NOTIFICATION_RISK_PRIORITY[
                            left.riskLevel
                        ];

                    if (
                        riskDifference !==
                        0
                    ) {
                        return riskDifference;
                    }

                    const leftArrival =
                        toFiniteNumber(
                            left
                                .prediction
                                .arrivalMinutes,
                            Number
                                .POSITIVE_INFINITY
                        );

                    const rightArrival =
                        toFiniteNumber(
                            right
                                .prediction
                                .arrivalMinutes,
                            Number
                                .POSITIVE_INFINITY
                        );

                    if (
                        leftArrival !==
                        rightArrival
                    ) {
                        return (
                            leftArrival -
                            rightArrival
                        );
                    }

                    return (
                        toFiniteNumber(
                            right
                                .prediction
                                .confidence,
                            0
                        ) -
                        toFiniteNumber(
                            left
                                .prediction
                                .confidence,
                            0
                        )
                    );
                }
            );
    }

    /**
     * Build notification candidates.
     *
     * @param {Array<Object>} predictions
     * @param {Object} options
     * @returns {Object}
     */
    function buildNotificationCandidates(
        predictions,
        options
    ) {
        const notificationState =
            ensureNotificationState();

        const candidates = [];
        const skipped = [];

        for (
            const prediction
            of predictions
        ) {
            const ruleEvaluation =
                evaluatePredictionForNotification(
                    prediction,
                    options
                );

            if (
                !ruleEvaluation.allowed
            ) {
                skipped.push({
                    prediction,

                    reason:
                        ruleEvaluation
                            .reason
                });

                notificationState
                    .skippedCount +=
                    1;

                continue;
            }

            const cooldownEvaluation =
                evaluateNotificationCooldown(
                    prediction,
                    options
                );

            if (
                !cooldownEvaluation.allowed
            ) {
                skipped.push({
                    prediction,

                    reason:
                        cooldownEvaluation
                            .reason,

                    remainingMs:
                        cooldownEvaluation
                            .remainingMs
                });

                notificationState
                    .skippedCount +=
                    1;

                continue;
            }

            const alert =
                buildRainArrivalAlert(
                    prediction,
                    options
                );

            candidates.push(
                alert
            );
        }

        return {
            candidates:
                sortNotificationCandidates(
                    candidates
                ).slice(
                    0,
                    options
                        .maximumNotificationsPerCycle
                ),

            skipped
        };
    }

    /**
     * Process rain arrival notifications.
     *
     * @param {Array<Object>} predictions
     * @param {Object} context
     * @returns {Promise<Object>}
     */
    async function processRainArrivalNotifications(
        predictions,
        context = {}
    ) {
        const options =
            normalizeNotificationOptions({
                ...context.options,
                ...context
            });

        if (!options.enabled) {
            return {
                processed:
                    false,

                reason:
                    'notifications_disabled'
            };
        }

        const normalizedPredictions =
            Array.isArray(
                predictions
            )
                ? predictions
                    .filter(Boolean)
                : [];

        const startedAt =
            Date.now();

        const candidateResult =
            buildNotificationCandidates(
                normalizedPredictions,
                options
            );

        const deliveries = [];

        for (
            const alert
            of candidateResult
                .candidates
        ) {
            const delivery =
                await deliverRainArrivalAlert(
                    alert,
                    options
                );

            deliveries.push(
                delivery
            );
        }

        const completedAt =
            Date.now();

        const result = {
            processed:
                true,

            predictionCount:
                normalizedPredictions
                    .length,

            candidateCount:
                candidateResult
                    .candidates
                    .length,

            skippedCount:
                candidateResult
                    .skipped
                    .length,

            deliveredCount:
                deliveries.filter(
                    (delivery) =>
                        delivery.delivered
                ).length,

            failedDeliveryCount:
                deliveries.filter(
                    (delivery) =>
                        !delivery.delivered
                ).length,

            alerts:
                candidateResult
                    .candidates,

            skipped:
                candidateResult
                    .skipped,

            deliveries,

            startedAt,

            startedAtIso:
                new Date(
                    startedAt
                ).toISOString(),

            completedAt,

            completedAtIso:
                new Date(
                    completedAt
                ).toISOString(),

            durationMs:
                completedAt -
                startedAt,

            cycleId:
                context.cycleId ||
                null,

            predictionRunId:
                context
                    .predictionRunId ||
                null
        };

        dispatchUIEvent(
            'rainguard:v32:rain-arrival:notification-cycle-completed',
            result
        );

        return result;
    }

    /**
     * Extract predictions from consumer payload.
     *
     * @param {Object} payload
     * @returns {Array<Object>}
     */
    function extractNotificationPredictions(
        payload
    ) {
        if (
            payload &&
            Array.isArray(
                payload.predictions
            )
        ) {
            return payload.predictions;
        }

        if (
            payload &&
            payload.predictionRun &&
            Array.isArray(
                payload
                    .predictionRun
                    .predictions
            )
        ) {
            return payload
                .predictionRun
                .predictions;
        }

        if (
            payload &&
            payload.cycleResult &&
            payload
                .cycleResult
                .predictionRun &&
            Array.isArray(
                payload
                    .cycleResult
                    .predictionRun
                    .predictions
            )
        ) {
            return payload
                .cycleResult
                .predictionRun
                .predictions;
        }

        return [];
    }

    /**
     * Built-in notification consumer.
     *
     * @param {Object} payload
     * @returns {Promise<Object>}
     */
    async function rainArrivalNotificationConsumer(
        payload
    ) {
        const predictions =
            extractNotificationPredictions(
                payload
            );

        return processRainArrivalNotifications(
            predictions,
            {
                cycleId:
                    payload &&
                    payload.cycleId
                        ? payload.cycleId
                        : null,

                predictionRunId:
                    payload &&
                    payload.predictionRun
                        ? payload
                            .predictionRun
                            .id
                        : null,

                options:
                    payload &&
                    payload.options &&
                    payload
                        .options
                        .notificationOptions
                        ? payload
                            .options
                            .notificationOptions
                        : {},

                language:
                    payload &&
                    payload.options
                        ? payload
                            .options
                            .language
                        : null
            }
        );
    }

    /**
     * Register notification consumer.
     *
     * @param {Object} options
     * @returns {Object}
     */
    function registerNotificationConsumer(
        options = {}
    ) {
        const notificationState =
            ensureNotificationState();

        if (
            notificationState
                .consumerRegistered &&
            options.force !==
                true
        ) {
            return {
                registered:
                    false,

                reused:
                    true,

                name:
                    notificationState
                        .consumerName
            };
        }

        const registration =
            integrationApi
                .registerResultConsumer(
                    notificationState
                        .consumerName,
                    rainArrivalNotificationConsumer,
                    {
                        enabled:
                            options.enabled !==
                            false,

                        priority:
                            options.priority ??
                            80,

                        consumerType:
                            'notification',

                        metadata: {
                            builtIn:
                                true,

                            integrationVersion:
                                'V32',

                            target:
                                'rain_arrival_alerts'
                        }
                    }
                );

        notificationState
            .consumerRegistered =
            true;

        return {
            registered:
                true,

            reused:
                false,

            name:
                notificationState
                    .consumerName,

            registration
        };
    }

    /**
     * Send test notification.
     *
     * @param {Object} options
     * @returns {Promise<Object>}
     */
    async function sendTestRainArrivalNotification(
        options = {}
    ) {
        const normalizedOptions =
            normalizeNotificationOptions({
                ...options,

                minimumConfidence:
                    0,

                minimumProbability:
                    0,

                minimumRiskLevel:
                    'minimal'
            });

        const prediction = {
            id:
                createRuntimeId(
                    'test_prediction'
                ),

            cityId:
                options.cityId ||
                'test-city',

            cityName:
                options.cityName ||
                'Jeddah',

            cityNameAr:
                options.cityNameAr ||
                'جدة',

            arrivalMinutes:
                toFiniteNumber(
                    options
                        .arrivalMinutes,
                    25
                ),

            arrivalTime:
                Date.now() +
                toFiniteNumber(
                    options
                        .arrivalMinutes,
                    25
                ) *
                60000,

            probability:
                toFiniteNumber(
                    options.probability,
                    80
                ),

            confidence:
                toFiniteNumber(
                    options.confidence,
                    85
                ),

            intensity:
                toFiniteNumber(
                    options.intensity,
                    45
                ),

            riskLevel:
                options.riskLevel ||
                'high',

            sourceCellId:
                options.sourceCellId ||
                'TEST-CELL-01',

            willRain:
                true,

            accepted:
                true,

            generatedAt:
                Date.now()
        };

        const alert =
            buildRainArrivalAlert(
                prediction,
                normalizedOptions
            );

        return deliverRainArrivalAlert(
            alert,
            normalizedOptions
        );
    }

    /**
     * Set notification options.
     *
     * @param {Object} options
     * @returns {Object}
     */
    function setNotificationOptions(
        options = {}
    ) {
        return normalizeNotificationOptions(
            options
        );
    }

    /**
     * Get notification history.
     *
     * @param {number} limit
     * @returns {Array<Object>}
     */
    function getNotificationHistory(
        limit = 20
    ) {
        const notificationState =
            ensureNotificationState();

        const normalizedLimit =
            Math.max(
                1,
                Math.round(
                    toFiniteNumber(
                        limit,
                        20
                    )
                )
            );

        return notificationState
            .history
            .slice(
                0,
                normalizedLimit
            );
    }

    /**
     * Clear notification history and cooldowns.
     *
     * @param {Object} options
     * @returns {Object}
     */
    function clearNotificationHistory(
        options = {}
    ) {
        const notificationState =
            ensureNotificationState();

        const removedHistory =
            notificationState
                .history
                .length;

        notificationState.history =
            [];

        if (
            options.clearCooldowns !==
            false
        ) {
            notificationState
                .cityCooldowns
                .clear();

            notificationState
                .latestCityAlerts
                .clear();

            notificationState
                .lastGlobalNotificationAt =
                null;
        }

        return {
            cleared:
                true,

            removedHistory,

            cooldownsCleared:
                options.clearCooldowns !==
                false
        };
    }

    /**
     * Clear cooldown for one city.
     *
     * @param {string} cityId
     * @returns {Object}
     */
    function clearCityNotificationCooldown(
        cityId
    ) {
        const notificationState =
            ensureNotificationState();

        const key =
            String(cityId);

        const cooldownRemoved =
            notificationState
                .cityCooldowns
                .delete(
                    key
                );

        const previousAlertRemoved =
            notificationState
                .latestCityAlerts
                .delete(
                    key
                );

        return {
            cleared:
                cooldownRemoved ||
                previousAlertRemoved,

            cityId:
                key
        };
    }

    /**
     * Return notification status.
     *
     * @returns {Object}
     */
    function getNotificationStatus() {
        const notificationState =
            ensureNotificationState();

        return {
            enabled:
                notificationState
                    .options
                    .enabled,

            consumerRegistered:
                notificationState
                    .consumerRegistered,

            consumerName:
                notificationState
                    .consumerName,

            browserSupported:
                typeof globalObject
                    .Notification !==
                    'undefined',

            browserPermission:
                typeof globalObject
                    .Notification !==
                    'undefined'
                    ? globalObject
                        .Notification
                        .permission
                    : 'unsupported',

            options: {
                ...notificationState
                    .options
            },

            sentCount:
                notificationState
                    .sentCount,

            skippedCount:
                notificationState
                    .skippedCount,

            failedCount:
                notificationState
                    .failedCount,

            browserSentCount:
                notificationState
                    .browserSentCount,

            inAppSentCount:
                notificationState
                    .inAppSentCount,

            genericSentCount:
                notificationState
                    .genericSentCount,

            eventSentCount:
                notificationState
                    .eventSentCount,

            activeCityCooldowns:
                notificationState
                    .cityCooldowns
                    .size,

            trackedCityAlerts:
                notificationState
                    .latestCityAlerts
                    .size,

            historyCount:
                notificationState
                    .history
                    .length,

            lastDeliveryAt:
                notificationState
                    .lastDeliveryAt,

            lastDeliveryAtIso:
                notificationState
                    .lastDeliveryAtIso,

            lastError:
                notificationState
                    .lastError
        };
    }

    /**
     * Extend runtime state.
     */
    ensureNotificationState();

    /**
     * Extend public API.
     */
    integrationApi
        .registerNotificationConsumer =
        registerNotificationConsumer;

    integrationApi
        .processRainArrivalNotifications =
        processRainArrivalNotifications;

    integrationApi
        .buildRainArrivalAlert =
        buildRainArrivalAlert;

    integrationApi
        .deliverRainArrivalAlert =
        deliverRainArrivalAlert;

    integrationApi
        .requestBrowserNotificationPermission =
        requestBrowserNotificationPermission;

    integrationApi
        .sendTestRainArrivalNotification =
        sendTestRainArrivalNotification;

    integrationApi
        .setNotificationOptions =
        setNotificationOptions;

    integrationApi
        .getNotificationHistory =
        getNotificationHistory;

    integrationApi
        .clearNotificationHistory =
        clearNotificationHistory;

    integrationApi
        .clearCityNotificationCooldown =
        clearCityNotificationCooldown;

    integrationApi
        .getNotificationStatus =
        getNotificationStatus;

    integrationApi.metadata = {
        ...integrationApi
            .metadata,

        currentPart:
            '2.2C-1',

        nextPart:
            '2.2C-2',

        status:
            'in_progress',

        productionReady:
            false,

        moduleClosed:
            true,

        capabilities: [
            ...new Set([
                ...(
                    Array.isArray(
                        integrationApi
                            .metadata
                            .capabilities
                    )
                        ? integrationApi
                            .metadata
                            .capabilities
                        : []
                ),

                'rain_arrival_alert_decisions',
                'alert_urgency_inference',
                'browser_notifications',
                'in_app_notifications',
                'generic_notification_adapter',
                'notification_event_bridge',
                'city_notification_cooldowns',
                'global_notification_cooldown',
                'risk_increase_notifications',
                'earlier_arrival_notifications',
                'notification_history',
                'notification_delivery_tracking',
                'bilingual_alert_messages'
            ])
        ]
    };

    /**
     * Extend internal API.
     */
    Object.assign(
        integrationApi._internals,
        {
            NOTIFICATION_CONSUMER_NAME,
            NOTIFICATION_CHANNELS,
            ALERT_URGENCY,
            DEFAULT_NOTIFICATION_OPTIONS,
            NOTIFICATION_RISK_PRIORITY,
            NOTIFICATION_TEXT,

            ensureNotificationState,
            normalizeNotificationOptions,
            getNotificationText,
            inferAlertUrgency,
            evaluatePredictionForNotification,
            evaluateNotificationCooldown,
            buildAlertTitle,
            resolveAlertCityName,
            buildAlertBody,
            requestBrowserNotificationPermission,
            sendBrowserNotification,
            discoverNotificationAdapter,
            sendGenericNotification,
            sendInAppNotification,
            sendEventNotification,
            storeNotificationHistory,
            sortNotificationCandidates,
            buildNotificationCandidates,
            extractNotificationPredictions,
            rainArrivalNotificationConsumer
        }
    );

    /**
     * Initialize notification integration.
     */
    try {
        normalizeNotificationOptions();

        registerNotificationConsumer();
    } catch (error) {
        log(
            'debug',
            'Rain arrival notification bridge initialization failed.',
            normalizeError(
                error,
                {
                    part:
                        '2.2C-1'
                }
            )
        );
    }

    log(
        'info',
        'Rain arrival integration Part 2.2C-1 loaded.',
        {
            notifications:
                getNotificationStatus()
        }
    );
})(
    typeof globalThis !==
        'undefined'
        ? globalThis
        : (
            typeof window !==
                'undefined'
                ? window
                : this
        )
);

/**
 * RainGuard AI V32
 * Rain Arrival Integration Engine
 *
 * Part:
 * 2.2C-2
 *
 * Responsibilities:
 * - Render in-app rain arrival notifications
 * - Add notification center and toast lifecycle
 * - Support sound and vibration alerts
 * - Add alert acknowledgement and dismissal
 * - Add alert escalation and expiry handling
 * - Synchronize notification counters
 * - Persist notification state locally
 * - Complete notification integration section
 */

(function rainArrivalIntegrationV32NotificationUI(globalObject) {
    'use strict';

    if (
        !globalObject ||
        !globalObject.RainGuardAI ||
        !globalObject.RainGuardAI.V32 ||
        !globalObject.RainGuardAI.V32
            .rainArrivalIntegration
    ) {
        throw new Error(
            'Rain Arrival Integration Part 2.2C-1 must be loaded before Part 2.2C-2.'
        );
    }

    const integrationApi =
        globalObject
            .RainGuardAI
            .V32
            .rainArrivalIntegration;

    const runtimeState =
        integrationApi._state;

    const internal =
        integrationApi._internals;

    const {
        toFiniteNumber,
        clamp,
        createRuntimeId,
        nowIso,
        normalizeError,
        escapeHtml,
        normalizeUILanguage,
        detectUILanguage,
        getUIText,
        formatNumber,
        formatDateTime,
        formatArrivalDuration,
        normalizeRiskLevel,
        getNotificationText,
        ensureNotificationState,
        normalizeNotificationOptions,
        dispatchUIEvent,
        log
    } = internal;

    /**
     * Notification UI identifiers.
     */
    const NOTIFICATION_UI_IDS =
        Object.freeze({
            style:
                'rain-arrival-notification-v32-styles',

            toastContainer:
                'rain-arrival-toast-container-v32',

            notificationCenter:
                'rain-arrival-notification-center-v32',

            notificationCenterList:
                'rain-arrival-notification-center-list-v32',

            notificationCounter:
                'rain-arrival-notification-counter-v32',

            audioElement:
                'rain-arrival-notification-audio-v32'
        });

    /**
     * Storage key.
     */
    const NOTIFICATION_STORAGE_KEY =
        'rainguard_v32_rain_arrival_notifications';

    /**
     * Default notification UI options.
     */
    const DEFAULT_NOTIFICATION_UI_OPTIONS =
        Object.freeze({
            enabled:
                true,

            showToasts:
                true,

            showNotificationCenter:
                true,

            maximumVisibleToasts:
                4,

            maximumCenterItems:
                100,

            defaultToastDurationMs:
                10000,

            immediateToastDurationMs:
                20000,

            extremeToastPersistent:
                true,

            enableSound:
                true,

            enableVibration:
                true,

            persistNotifications:
                true,

            restoreNotifications:
                true,

            autoRemoveExpired:
                true,

            alertExpiryMs:
                6 *
                60 *
                60 *
                1000,

            acknowledgedExpiryMs:
                24 *
                60 *
                60 *
                1000,

            escalationCheckIntervalMs:
                30000,

            escalationArrivalThresholdMinutes:
                30,

            escalationRiskLevels: [
                'high',
                'extreme'
            ],

            soundVolume:
                0.7,

            toastPosition:
                'top-right',

            language:
                null
        });

    /**
     * Notification lifecycle status.
     */
    const NOTIFICATION_LIFECYCLE_STATUS =
        Object.freeze({
            ACTIVE:
                'active',

            ACKNOWLEDGED:
                'acknowledged',

            DISMISSED:
                'dismissed',

            EXPIRED:
                'expired',

            ESCALATED:
                'escalated'
        });

    /**
     * Notification UI event names.
     */
    const NOTIFICATION_UI_EVENTS =
        Object.freeze({
            received:
                'rainguard:v32:rain-arrival:notification-ui-received',

            displayed:
                'rainguard:v32:rain-arrival:notification-ui-displayed',

            acknowledged:
                'rainguard:v32:rain-arrival:notification-acknowledged',

            dismissed:
                'rainguard:v32:rain-arrival:notification-dismissed',

            expired:
                'rainguard:v32:rain-arrival:notification-expired',

            escalated:
                'rainguard:v32:rain-arrival:notification-escalated',

            restored:
                'rainguard:v32:rain-arrival:notifications-restored'
        });

    /**
     * Notification UI CSS.
     */
    const NOTIFICATION_UI_CSS = `
        .rain-arrival-toast-container {
            position: fixed;
            z-index: 99999;
            display: flex;
            flex-direction: column;
            gap: 12px;
            width: min(390px, calc(100vw - 24px));
            pointer-events: none;
        }

        .rain-arrival-toast-container--top-right {
            top: 18px;
            right: 18px;
        }

        .rain-arrival-toast-container--top-left {
            top: 18px;
            left: 18px;
        }

        .rain-arrival-toast-container--bottom-right {
            right: 18px;
            bottom: 18px;
        }

        .rain-arrival-toast-container--bottom-left {
            bottom: 18px;
            left: 18px;
        }

        .rain-arrival-toast {
            position: relative;
            display: grid;
            grid-template-columns: auto minmax(0, 1fr) auto;
            gap: 12px;
            align-items: start;
            width: 100%;
            padding: 14px;
            overflow: hidden;
            border: 1px solid rgba(148, 163, 184, 0.25);
            border-radius: 16px;
            background:
                linear-gradient(
                    145deg,
                    rgba(15, 23, 42, 0.98),
                    rgba(30, 41, 59, 0.96)
                );
            color: #f8fafc;
            box-shadow:
                0 20px 45px rgba(2, 6, 23, 0.45);
            backdrop-filter: blur(15px);
            pointer-events: auto;
            box-sizing: border-box;
            animation:
                rain-arrival-toast-enter
                0.28s
                ease-out;
        }

        .rain-arrival-toast::before {
            content: "";
            position: absolute;
            inset: 0 auto 0 0;
            width: 5px;
            background: #64748b;
        }

        .rain-arrival-toast[dir="rtl"]::before {
            inset: 0 0 0 auto;
        }

        .rain-arrival-toast--minimal::before {
            background: #94a3b8;
        }

        .rain-arrival-toast--low::before {
            background: #38bdf8;
        }

        .rain-arrival-toast--moderate::before {
            background: #facc15;
        }

        .rain-arrival-toast--high::before {
            background: #fb923c;
        }

        .rain-arrival-toast--extreme::before {
            background: #ef4444;
        }

        .rain-arrival-toast--escalated {
            border-color: rgba(239, 68, 68, 0.72);
            box-shadow:
                0 0 0 2px rgba(239, 68, 68, 0.12),
                0 20px 45px rgba(2, 6, 23, 0.52);
            animation:
                rain-arrival-toast-enter
                0.28s
                ease-out,
                rain-arrival-toast-pulse
                1.8s
                ease-in-out
                infinite;
        }

        .rain-arrival-toast--leaving {
            animation:
                rain-arrival-toast-leave
                0.22s
                ease-in
                forwards;
        }

        .rain-arrival-toast__icon {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 40px;
            height: 40px;
            border-radius: 12px;
            background: rgba(14, 165, 233, 0.15);
            font-size: 1.25rem;
        }

        .rain-arrival-toast--high
        .rain-arrival-toast__icon {
            background: rgba(251, 146, 60, 0.15);
        }

        .rain-arrival-toast--extreme
        .rain-arrival-toast__icon {
            background: rgba(239, 68, 68, 0.18);
        }

        .rain-arrival-toast__content {
            min-width: 0;
        }

        .rain-arrival-toast__title {
            margin: 0;
            color: #f8fafc;
            font-size: 0.93rem;
            line-height: 1.45;
        }

        .rain-arrival-toast__message {
            margin-top: 5px;
            overflow: hidden;
            color: #cbd5e1;
            font-size: 0.78rem;
            line-height: 1.65;
            white-space: pre-line;
        }

        .rain-arrival-toast__meta {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            margin-top: 9px;
        }

        .rain-arrival-toast__badge {
            display: inline-flex;
            align-items: center;
            min-height: 24px;
            padding: 3px 8px;
            border-radius: 999px;
            background: rgba(148, 163, 184, 0.14);
            color: #cbd5e1;
            font-size: 0.68rem;
            font-weight: 700;
        }

        .rain-arrival-toast__actions {
            display: flex;
            flex-wrap: wrap;
            gap: 7px;
            margin-top: 10px;
        }

        .rain-arrival-toast__button,
        .rain-arrival-toast__close {
            border: 1px solid rgba(148, 163, 184, 0.25);
            background: rgba(15, 23, 42, 0.72);
            color: #e2e8f0;
            font: inherit;
            cursor: pointer;
            transition:
                border-color 0.2s ease,
                background-color 0.2s ease,
                transform 0.2s ease;
        }

        .rain-arrival-toast__button {
            min-height: 32px;
            padding: 5px 10px;
            border-radius: 9px;
            font-size: 0.72rem;
        }

        .rain-arrival-toast__close {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 30px;
            height: 30px;
            padding: 0;
            border-radius: 9px;
            font-size: 1rem;
        }

        .rain-arrival-toast__button:hover,
        .rain-arrival-toast__button:focus-visible,
        .rain-arrival-toast__close:hover,
        .rain-arrival-toast__close:focus-visible {
            border-color: rgba(56, 189, 248, 0.72);
            background: rgba(14, 116, 144, 0.28);
            outline: none;
        }

        .rain-arrival-toast__button:active,
        .rain-arrival-toast__close:active {
            transform: scale(0.97);
        }

        .rain-arrival-notification-center {
            position: fixed;
            z-index: 99998;
            top: 0;
            right: 0;
            display: flex;
            flex-direction: column;
            width: min(440px, 100vw);
            height: 100vh;
            border-left: 1px solid rgba(148, 163, 184, 0.22);
            background: rgba(15, 23, 42, 0.98);
            color: #f8fafc;
            box-shadow:
                -20px 0 45px rgba(2, 6, 23, 0.42);
            backdrop-filter: blur(16px);
            transform: translateX(105%);
            transition: transform 0.28s ease;
            box-sizing: border-box;
        }

        .rain-arrival-notification-center[dir="rtl"] {
            right: auto;
            left: 0;
            border-right: 1px solid rgba(148, 163, 184, 0.22);
            border-left: 0;
            box-shadow:
                20px 0 45px rgba(2, 6, 23, 0.42);
            transform: translateX(-105%);
        }

        .rain-arrival-notification-center--open,
        .rain-arrival-notification-center--open[dir="rtl"] {
            transform: translateX(0);
        }

        .rain-arrival-notification-center__header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            min-height: 68px;
            padding: 14px 16px;
            border-bottom: 1px solid rgba(148, 163, 184, 0.16);
        }

        .rain-arrival-notification-center__title {
            margin: 0;
            font-size: 1rem;
        }

        .rain-arrival-notification-center__header-actions {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .rain-arrival-notification-center__button {
            min-height: 34px;
            padding: 6px 10px;
            border: 1px solid rgba(148, 163, 184, 0.24);
            border-radius: 9px;
            background: rgba(30, 41, 59, 0.78);
            color: #e2e8f0;
            font: inherit;
            font-size: 0.72rem;
            cursor: pointer;
        }

        .rain-arrival-notification-center__button:hover,
        .rain-arrival-notification-center__button:focus-visible {
            border-color: rgba(56, 189, 248, 0.72);
            outline: none;
        }

        .rain-arrival-notification-center__list {
            display: flex;
            flex: 1 1 auto;
            flex-direction: column;
            gap: 10px;
            overflow-y: auto;
            padding: 14px;
        }

        .rain-arrival-notification-center__empty {
            display: flex;
            flex: 1 1 auto;
            align-items: center;
            justify-content: center;
            min-height: 180px;
            padding: 24px;
            color: #94a3b8;
            text-align: center;
            line-height: 1.7;
        }

        .rain-arrival-notification-item {
            display: grid;
            gap: 8px;
            padding: 12px;
            border: 1px solid rgba(148, 163, 184, 0.18);
            border-radius: 13px;
            background: rgba(30, 41, 59, 0.62);
        }

        .rain-arrival-notification-item--acknowledged {
            opacity: 0.72;
        }

        .rain-arrival-notification-item--expired {
            opacity: 0.48;
        }

        .rain-arrival-notification-item__header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 10px;
        }

        .rain-arrival-notification-item__title {
            margin: 0;
            font-size: 0.86rem;
            line-height: 1.5;
        }

        .rain-arrival-notification-item__time {
            flex: 0 0 auto;
            color: #94a3b8;
            font-size: 0.67rem;
        }

        .rain-arrival-notification-item__message {
            overflow: hidden;
            color: #cbd5e1;
            font-size: 0.74rem;
            line-height: 1.6;
            white-space: pre-line;
        }

        .rain-arrival-notification-item__footer {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
        }

        .rain-arrival-notification-counter {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 22px;
            height: 22px;
            padding: 0 6px;
            border-radius: 999px;
            background: #ef4444;
            color: #ffffff;
            font-size: 0.68rem;
            font-weight: 800;
        }

        .rain-arrival-notification-counter--empty {
            display: none;
        }

        @keyframes rain-arrival-toast-enter {
            from {
                opacity: 0;
                transform: translateY(-10px) scale(0.98);
            }

            to {
                opacity: 1;
                transform: translateY(0) scale(1);
            }
        }

        @keyframes rain-arrival-toast-leave {
            from {
                opacity: 1;
                transform: translateX(0);
            }

            to {
                opacity: 0;
                transform: translateX(24px);
            }
        }

        @keyframes rain-arrival-toast-pulse {
            0%,
            100% {
                box-shadow:
                    0 0 0 0 rgba(239, 68, 68, 0.2),
                    0 20px 45px rgba(2, 6, 23, 0.52);
            }

            50% {
                box-shadow:
                    0 0 0 8px rgba(239, 68, 68, 0),
                    0 20px 45px rgba(2, 6, 23, 0.52);
            }
        }

        @media (max-width: 640px) {
            .rain-arrival-toast-container {
                top: 10px;
                right: 10px;
                left: 10px;
                width: auto;
            }

            .rain-arrival-toast-container--bottom-right,
            .rain-arrival-toast-container--bottom-left {
                top: auto;
                bottom: 10px;
            }

            .rain-arrival-toast {
                grid-template-columns: auto minmax(0, 1fr);
            }

            .rain-arrival-toast__close {
                position: absolute;
                top: 8px;
                right: 8px;
            }

            .rain-arrival-toast[dir="rtl"]
            .rain-arrival-toast__close {
                right: auto;
                left: 8px;
            }
        }

        @media (prefers-reduced-motion: reduce) {
            .rain-arrival-toast,
            .rain-arrival-toast--escalated,
            .rain-arrival-toast--leaving,
            .rain-arrival-notification-center {
                animation: none !important;
                transition: none !important;
            }
        }
    `;

    /**
     * Ensure notification UI state.
     *
     * @returns {Object}
     */
    function ensureNotificationUIState() {
        const notificationState =
            ensureNotificationState();

        if (
            !notificationState.ui ||
            typeof notificationState.ui !==
                'object'
        ) {
            notificationState.ui = {
                options: {
                    ...DEFAULT_NOTIFICATION_UI_OPTIONS,

                    escalationRiskLevels:
                        DEFAULT_NOTIFICATION_UI_OPTIONS
                            .escalationRiskLevels
                            .slice()
                },

                stylesInstalled:
                    false,

                initialized:
                    false,

                listenerInstalled:
                    false,

                eventHandler:
                    null,

                toastContainer:
                    null,

                notificationCenter:
                    null,

                notificationCenterList:
                    null,

                activeToasts:
                    new Map(),

                notifications:
                    new Map(),

                toastTimers:
                    new Map(),

                expiryTimerId:
                    null,

                escalationTimerId:
                    null,

                centerOpen:
                    false,

                soundEnabled:
                    true,

                vibrationEnabled:
                    true,

                receivedCount:
                    0,

                displayedCount:
                    0,

                acknowledgedCount:
                    0,

                dismissedCount:
                    0,

                expiredCount:
                    0,

                escalatedCount:
                    0,

                restoredCount:
                    0,

                lastReceivedAt:
                    null,

                lastReceivedAtIso:
                    null,

                lastEscalationAt:
                    null,

                lastEscalationAtIso:
                    null
            };
        }

        if (
            !(notificationState
                .ui
                .activeToasts instanceof Map)
        ) {
            notificationState
                .ui
                .activeToasts =
                new Map();
        }

        if (
            !(notificationState
                .ui
                .notifications instanceof Map)
        ) {
            notificationState
                .ui
                .notifications =
                new Map();
        }

        if (
            !(notificationState
                .ui
                .toastTimers instanceof Map)
        ) {
            notificationState
                .ui
                .toastTimers =
                new Map();
        }

        return notificationState.ui;
    }

    /**
     * Normalize notification UI options.
     *
     * @param {Object} options
     * @returns {Object}
     */
    function normalizeNotificationUIOptions(
        options = {}
    ) {
        const uiState =
            ensureNotificationUIState();

        const normalized = {
            ...DEFAULT_NOTIFICATION_UI_OPTIONS,
            ...uiState.options,
            ...options
        };

        normalized.enabled =
            normalized.enabled !==
            false;

        normalized.showToasts =
            normalized.showToasts !==
            false;

        normalized.showNotificationCenter =
            normalized.showNotificationCenter !==
            false;

        normalized.maximumVisibleToasts =
            Math.max(
                1,
                Math.round(
                    toFiniteNumber(
                        normalized
                            .maximumVisibleToasts,
                        DEFAULT_NOTIFICATION_UI_OPTIONS
                            .maximumVisibleToasts
                    )
                )
            );

        normalized.maximumCenterItems =
            Math.max(
                10,
                Math.round(
                    toFiniteNumber(
                        normalized
                            .maximumCenterItems,
                        DEFAULT_NOTIFICATION_UI_OPTIONS
                            .maximumCenterItems
                    )
                )
            );

        normalized.defaultToastDurationMs =
            Math.max(
                1000,
                toFiniteNumber(
                    normalized
                        .defaultToastDurationMs,
                    DEFAULT_NOTIFICATION_UI_OPTIONS
                        .defaultToastDurationMs
                )
            );

        normalized.immediateToastDurationMs =
            Math.max(
                normalized
                    .defaultToastDurationMs,
                toFiniteNumber(
                    normalized
                        .immediateToastDurationMs,
                    DEFAULT_NOTIFICATION_UI_OPTIONS
                        .immediateToastDurationMs
                )
            );

        normalized.extremeToastPersistent =
            normalized
                .extremeToastPersistent !==
            false;

        normalized.enableSound =
            normalized.enableSound !==
            false;

        normalized.enableVibration =
            normalized.enableVibration !==
            false;

        normalized.persistNotifications =
            normalized
                .persistNotifications !==
            false;

        normalized.restoreNotifications =
            normalized
                .restoreNotifications !==
            false;

        normalized.autoRemoveExpired =
            normalized
                .autoRemoveExpired !==
            false;

        normalized.alertExpiryMs =
            Math.max(
                60000,
                toFiniteNumber(
                    normalized
                        .alertExpiryMs,
                    DEFAULT_NOTIFICATION_UI_OPTIONS
                        .alertExpiryMs
                )
            );

        normalized.acknowledgedExpiryMs =
            Math.max(
                normalized.alertExpiryMs,
                toFiniteNumber(
                    normalized
                        .acknowledgedExpiryMs,
                    DEFAULT_NOTIFICATION_UI_OPTIONS
                        .acknowledgedExpiryMs
                )
            );

        normalized.escalationCheckIntervalMs =
            Math.max(
                10000,
                toFiniteNumber(
                    normalized
                        .escalationCheckIntervalMs,
                    DEFAULT_NOTIFICATION_UI_OPTIONS
                        .escalationCheckIntervalMs
                )
            );

        normalized.escalationArrivalThresholdMinutes =
            Math.max(
                1,
                toFiniteNumber(
                    normalized
                        .escalationArrivalThresholdMinutes,
                    DEFAULT_NOTIFICATION_UI_OPTIONS
                        .escalationArrivalThresholdMinutes
                )
            );

        normalized.escalationRiskLevels =
            Array.from(
                new Set(
                    (
                        Array.isArray(
                            normalized
                                .escalationRiskLevels
                        )
                            ? normalized
                                .escalationRiskLevels
                            : DEFAULT_NOTIFICATION_UI_OPTIONS
                                .escalationRiskLevels
                    )
                        .map(
                            normalizeRiskLevel
                        )
                )
            );

        normalized.soundVolume =
            clamp(
                toFiniteNumber(
                    normalized.soundVolume,
                    DEFAULT_NOTIFICATION_UI_OPTIONS
                        .soundVolume
                ),
                0,
                1
            );

        normalized.toastPosition =
            [
                'top-right',
                'top-left',
                'bottom-right',
                'bottom-left'
            ].includes(
                normalized.toastPosition
            )
                ? normalized.toastPosition
                : 'top-right';

        normalized.language =
            normalizeUILanguage(
                normalized.language ||
                detectUILanguage()
            );

        uiState.options =
            normalized;

        uiState.soundEnabled =
            normalized.enableSound;

        uiState.vibrationEnabled =
            normalized.enableVibration;

        return {
            ...normalized,

            escalationRiskLevels:
                normalized
                    .escalationRiskLevels
                    .slice()
        };
    }

    /**
     * Install notification UI styles.
     *
     * @param {Object} options
     * @returns {Object}
     */
    function installNotificationUIStyles(
        options = {}
    ) {
        const uiState =
            ensureNotificationUIState();

        if (
            typeof globalObject
                .document ===
                'undefined'
        ) {
            return {
                installed:
                    false,

                reason:
                    'document_unavailable'
            };
        }

        let styleElement =
            globalObject
                .document
                .getElementById(
                    NOTIFICATION_UI_IDS.style
                );

        if (
            styleElement &&
            options.force !==
                true
        ) {
            uiState.stylesInstalled =
                true;

            return {
                installed:
                    false,

                reused:
                    true
            };
        }

        if (!styleElement) {
            styleElement =
                globalObject
                    .document
                    .createElement(
                        'style'
                    );

            styleElement.id =
                NOTIFICATION_UI_IDS.style;

            (
                globalObject
                    .document
                    .head ||
                globalObject
                    .document
                    .documentElement
            ).appendChild(
                styleElement
            );
        }

        styleElement.textContent =
            options.css ||
            NOTIFICATION_UI_CSS;

        uiState.stylesInstalled =
            true;

        return {
            installed:
                true,

            reused:
                false
        };
    }

    /**
     * Create toast container.
     *
     * @param {Object} options
     * @returns {Element|null}
     */
    function ensureToastContainer(
        options = {}
    ) {
        const uiState =
            ensureNotificationUIState();

        if (
            typeof globalObject
                .document ===
                'undefined' ||
            !globalObject
                .document
                .body
        ) {
            return null;
        }

        let container =
            globalObject
                .document
                .getElementById(
                    NOTIFICATION_UI_IDS
                        .toastContainer
                );

        if (!container) {
            container =
                globalObject
                    .document
                    .createElement(
                        'div'
                    );

            container.id =
                NOTIFICATION_UI_IDS
                    .toastContainer;

            container.setAttribute(
                'aria-live',
                'assertive'
            );

            container.setAttribute(
                'aria-relevant',
                'additions'
            );

            globalObject
                .document
                .body
                .appendChild(
                    container
                );
        }

        const normalizedOptions =
            normalizeNotificationUIOptions(
                options
            );

        container.className =
            `rain-arrival-toast-container rain-arrival-toast-container--${normalizedOptions.toastPosition}`;

        uiState.toastContainer =
            container;

        return container;
    }

    /**
     * Create notification center.
     *
     * @param {Object} options
     * @returns {Element|null}
     */
    function ensureNotificationCenter(
        options = {}
    ) {
        const uiState =
            ensureNotificationUIState();

        if (
            typeof globalObject
                .document ===
                'undefined' ||
            !globalObject
                .document
                .body
        ) {
            return null;
        }

        let center =
            globalObject
                .document
                .getElementById(
                    NOTIFICATION_UI_IDS
                        .notificationCenter
                );

        const language =
            normalizeUILanguage(
                options.language ||
                uiState.options.language ||
                detectUILanguage()
            );

        if (!center) {
            center =
                globalObject
                    .document
                    .createElement(
                        'aside'
                    );

            center.id =
                NOTIFICATION_UI_IDS
                    .notificationCenter;

            center.className =
                'rain-arrival-notification-center';

            center.setAttribute(
                'aria-hidden',
                'true'
            );

            center.setAttribute(
                'role',
                'dialog'
            );

            globalObject
                .document
                .body
                .appendChild(
                    center
                );
        }

        center.dir =
            language ===
                'ar'
                ? 'rtl'
                : 'ltr';

        center.innerHTML = `
            <header class="rain-arrival-notification-center__header">
                <h2 class="rain-arrival-notification-center__title">
                    ${escapeHtml(
                        language ===
                            'ar'
                            ? 'مركز تنبيهات وصول المطر'
                            : 'Rain Arrival Notification Center'
                    )}
                </h2>

                <div class="rain-arrival-notification-center__header-actions">
                    <button
                        type="button"
                        class="rain-arrival-notification-center__button"
                        data-rain-arrival-acknowledge-all
                    >
                        ${escapeHtml(
                            language ===
                                'ar'
                                ? 'تأكيد الكل'
                                : 'Acknowledge all'
                        )}
                    </button>

                    <button
                        type="button"
                        class="rain-arrival-notification-center__button"
                        data-rain-arrival-clear-notifications
                    >
                        ${escapeHtml(
                            language ===
                                'ar'
                                ? 'مسح'
                                : 'Clear'
                        )}
                    </button>

                    <button
                        type="button"
                        class="rain-arrival-notification-center__button"
                        data-rain-arrival-close-center
                    >
                        ${escapeHtml(
                            language ===
                                'ar'
                                ? 'إغلاق'
                                : 'Close'
                        )}
                    </button>
                </div>
            </header>

            <div
                id="${NOTIFICATION_UI_IDS.notificationCenterList}"
                class="rain-arrival-notification-center__list"
            ></div>
        `;

        uiState.notificationCenter =
            center;

        uiState.notificationCenterList =
            center.querySelector(
                `#${NOTIFICATION_UI_IDS.notificationCenterList}`
            );

        bindNotificationCenterEvents(
            center
        );

        renderNotificationCenter();

        return center;
    }

    /**
     * Create notification model.
     *
     * @param {Object} alert
     * @returns {Object}
     */
    function createNotificationModel(
        alert
    ) {
        const now =
            Date.now();

        return {
            id:
                alert.id ||
                createRuntimeId(
                    'notification_ui'
                ),

            alertId:
                alert.id ||
                null,

            title:
                alert.title ||
                '',

            body:
                alert.body ||
                '',

            cityId:
                alert.cityId ||
                null,

            cityName:
                alert.cityName ||
                null,

            riskLevel:
                normalizeRiskLevel(
                    alert.riskLevel
                ),

            urgency:
                alert.urgency ||
                'advisory',

            probability:
                toFiniteNumber(
                    alert.probability,
                    null
                ),

            confidence:
                toFiniteNumber(
                    alert.confidence,
                    null
                ),

            arrivalMinutes:
                toFiniteNumber(
                    alert.arrivalMinutes,
                    null
                ),

            arrivalTime:
                toFiniteNumber(
                    alert.arrivalTime,
                    null
                ),

            latitude:
                toFiniteNumber(
                    alert.latitude,
                    null
                ),

            longitude:
                toFiniteNumber(
                    alert.longitude,
                    null
                ),

            sourceCellId:
                alert.sourceCellId ||
                null,

            prediction:
                alert.prediction ||
                null,

            status:
                NOTIFICATION_LIFECYCLE_STATUS
                    .ACTIVE,

            acknowledged:
                false,

            dismissed:
                false,

            escalated:
                false,

            createdAt:
                toFiniteNumber(
                    alert.createdAt,
                    now
                ),

            createdAtIso:
                alert.createdAtIso ||
                new Date(
                    toFiniteNumber(
                        alert.createdAt,
                        now
                    )
                ).toISOString(),

            updatedAt:
                now,

            updatedAtIso:
                new Date(
                    now
                ).toISOString(),

            acknowledgedAt:
                null,

            dismissedAt:
                null,

            expiredAt:
                null,

            escalatedAt:
                null
        };
    }

    /**
     * Build notification icon.
     *
     * @param {Object} notification
     * @returns {string}
     */
    function resolveNotificationIcon(
        notification
    ) {
        if (
            notification.riskLevel ===
            'extreme'
        ) {
            return '⛈️';
        }

        if (
            notification.riskLevel ===
                'high' ||
            notification.urgency ===
                'immediate'
        ) {
            return '🌩️';
        }

        if (
            notification.riskLevel ===
            'moderate'
        ) {
            return '🌧️';
        }

        return '🌦️';
    }

    /**
     * Build toast HTML.
     *
     * @param {Object} notification
     * @param {string} language
     * @returns {string}
     */
    function buildToastHtml(
        notification,
        language
    ) {
        const riskText =
            getUIText(
                notification.riskLevel,
                language
            );

        const arrivalText =
            notification.arrivalMinutes !==
                null
                ? formatArrivalDuration(
                    notification.arrivalMinutes,
                    language
                )
                : null;

        return `
            <article
                class="
                    rain-arrival-toast
                    rain-arrival-toast--${escapeHtml(
                        notification.riskLevel
                    )}
                    ${notification.escalated
                        ? 'rain-arrival-toast--escalated'
                        : ''}
                "
                data-rain-arrival-notification-id="${escapeHtml(
                    notification.id
                )}"
                dir="${language ===
                    'ar'
                    ? 'rtl'
                    : 'ltr'}"
                role="alert"
            >
                <div class="rain-arrival-toast__icon">
                    ${escapeHtml(
                        resolveNotificationIcon(
                            notification
                        )
                    )}
                </div>

                <div class="rain-arrival-toast__content">
                    <h3 class="rain-arrival-toast__title">
                        ${escapeHtml(
                            notification.title
                        )}
                    </h3>

                    <div class="rain-arrival-toast__message">
                        ${escapeHtml(
                            notification.body
                        )}
                    </div>

                    <div class="rain-arrival-toast__meta">
                        <span class="rain-arrival-toast__badge">
                            ${escapeHtml(
                                riskText
                            )}
                        </span>

                        ${arrivalText
                            ? `
                                <span class="rain-arrival-toast__badge">
                                    ${escapeHtml(
                                        arrivalText
                                    )}
                                </span>
                            `
                            : ''}

                        ${notification.confidence !==
                            null
                            ? `
                                <span class="rain-arrival-toast__badge">
                                    ${escapeHtml(
                                        getUIText(
                                            'confidence',
                                            language
                                        )
                                    )}: ${escapeHtml(
                                        formatNumber(
                                            notification.confidence,
                                            0,
                                            language
                                        )
                                    )}%
                                </span>
                            `
                            : ''}
                    </div>

                    <div class="rain-arrival-toast__actions">
                        <button
                            type="button"
                            class="rain-arrival-toast__button"
                            data-rain-arrival-open-city
                        >
                            ${escapeHtml(
                                language ===
                                    'ar'
                                    ? 'عرض المدينة'
                                    : 'View city'
                            )}
                        </button>

                        <button
                            type="button"
                            class="rain-arrival-toast__button"
                            data-rain-arrival-acknowledge
                        >
                            ${escapeHtml(
                                language ===
                                    'ar'
                                    ? 'تم الاطلاع'
                                    : 'Acknowledge'
                            )}
                        </button>
                    </div>
                </div>

                <button
                    type="button"
                    class="rain-arrival-toast__close"
                    data-rain-arrival-dismiss
                    aria-label="${escapeHtml(
                        language ===
                            'ar'
                            ? 'إغلاق التنبيه'
                            : 'Dismiss alert'
                    )}"
                >
                    ×
                </button>
            </article>
        `;
    }

    /**
     * Build notification center item HTML.
     *
     * @param {Object} notification
     * @param {string} language
     * @returns {string}
     */
    function buildNotificationCenterItemHtml(
        notification,
        language
    ) {
        return `
            <article
                class="
                    rain-arrival-notification-item
                    rain-arrival-notification-item--${escapeHtml(
                        notification.riskLevel
                    )}
                    ${notification.acknowledged
                        ? 'rain-arrival-notification-item--acknowledged'
                        : ''}
                    ${notification.status ===
                        NOTIFICATION_LIFECYCLE_STATUS
                            .EXPIRED
                        ? 'rain-arrival-notification-item--expired'
                        : ''}
                "
                data-rain-arrival-notification-id="${escapeHtml(
                    notification.id
                )}"
            >
                <header class="rain-arrival-notification-item__header">
                    <h3 class="rain-arrival-notification-item__title">
                        ${escapeHtml(
                            notification.title
                        )}
                    </h3>

                    <span class="rain-arrival-notification-item__time">
                        ${escapeHtml(
                            formatDateTime(
                                notification.createdAt,
                                language
                            )
                        )}
                    </span>
                </header>

                <div class="rain-arrival-notification-item__message">
                    ${escapeHtml(
                        notification.body
                    )}
                </div>

                <footer class="rain-arrival-notification-item__footer">
                    <div class="rain-arrival-toast__meta">
                        <span class="rain-arrival-toast__badge">
                            ${escapeHtml(
                                getUIText(
                                    notification.riskLevel,
                                    language
                                )
                            )}
                        </span>

                        <span class="rain-arrival-toast__badge">
                            ${escapeHtml(
                                notification.status
                            )}
                        </span>
                    </div>

                    <div class="rain-arrival-toast__actions">
                        ${notification.cityId
                            ? `
                                <button
                                    type="button"
                                    class="rain-arrival-toast__button"
                                    data-rain-arrival-open-city
                                >
                                    ${escapeHtml(
                                        language ===
                                            'ar'
                                            ? 'عرض'
                                            : 'View'
                                    )}
                                </button>
                            `
                            : ''}

                        ${!notification.acknowledged
                            ? `
                                <button
                                    type="button"
                                    class="rain-arrival-toast__button"
                                    data-rain-arrival-acknowledge
                                >
                                    ${escapeHtml(
                                        language ===
                                            'ar'
                                            ? 'تأكيد'
                                            : 'Acknowledge'
                                    )}
                                </button>
                            `
                            : ''}

                        <button
                            type="button"
                            class="rain-arrival-toast__button"
                            data-rain-arrival-dismiss
                        >
                            ${escapeHtml(
                                language ===
                                    'ar'
                                    ? 'حذف'
                                    : 'Remove'
                            )}
                        </button>
                    </div>
                </footer>
            </article>
        `;
    }

    /**
     * Resolve toast duration.
     *
     * @param {Object} notification
     * @param {Object} options
     * @returns {number|null}
     */
    function resolveToastDuration(
        notification,
        options
    ) {
        if (
            notification.riskLevel ===
                'extreme' &&
            options
                .extremeToastPersistent
        ) {
            return null;
        }

        if (
            notification.urgency ===
                'immediate' ||
            notification.riskLevel ===
                'high'
        ) {
            return options
                .immediateToastDurationMs;
        }

        return options
            .defaultToastDurationMs;
    }

    /**
     * Enforce maximum visible toasts.
     *
     * @param {Object} options
     */
    function enforceToastLimit(
        options
    ) {
        const uiState =
            ensureNotificationUIState();

        const toastEntries =
            Array.from(
                uiState
                    .activeToasts
                    .entries()
            );

        while (
            toastEntries.length >
            options.maximumVisibleToasts
        ) {
            const [
                notificationId
            ] =
                toastEntries.shift();

            removeToast(
                notificationId,
                {
                    updateNotification:
                        false
                }
            );
        }
    }

    /**
     * Display toast.
     *
     * @param {Object} notification
     * @param {Object} options
     * @returns {Object}
     */
    function displayNotificationToast(
        notification,
        options = {}
    ) {
        const uiState =
            ensureNotificationUIState();

        const normalizedOptions =
            normalizeNotificationUIOptions(
                options
            );

        if (
            !normalizedOptions.enabled ||
            !normalizedOptions.showToasts
        ) {
            return {
                displayed:
                    false,

                reason:
                    'toasts_disabled'
            };
        }

        const container =
            ensureToastContainer(
                normalizedOptions
            );

        if (!container) {
            return {
                displayed:
                    false,

                reason:
                    'toast_container_unavailable'
            };
        }

        removeToast(
            notification.id,
            {
                updateNotification:
                    false,
                animate:
                    false
            }
        );

        const wrapper =
            globalObject
                .document
                .createElement(
                    'div'
                );

        wrapper.innerHTML =
            buildToastHtml(
                notification,
                normalizedOptions.language
            ).trim();

        const toast =
            wrapper.firstElementChild;

        bindNotificationElementEvents(
            toast,
            notification.id
        );

        container.prepend(
            toast
        );

        uiState.activeToasts
            .set(
                notification.id,
                toast
            );

        uiState.displayedCount +=
            1;

        const duration =
            resolveToastDuration(
                notification,
                normalizedOptions
            );

        if (
            duration !==
            null
        ) {
            const timerId =
                globalObject.setTimeout(
                    () => {
                        removeToast(
                            notification.id,
                            {
                                updateNotification:
                                    false
                            }
                        );
                    },
                    duration
                );

            uiState.toastTimers
                .set(
                    notification.id,
                    timerId
                );
        }

        enforceToastLimit(
            normalizedOptions
        );

        dispatchUIEvent(
            NOTIFICATION_UI_EVENTS
                .displayed,
            {
                notification,

                displayedAt:
                    Date.now(),

                displayedAtIso:
                    nowIso()
            }
        );

        return {
            displayed:
                true,

            notificationId:
                notification.id,

            persistent:
                duration ===
                null,

            durationMs:
                duration
        };
    }

    /**
     * Remove toast.
     *
     * @param {string} notificationId
     * @param {Object} options
     * @returns {boolean}
     */
    function removeToast(
        notificationId,
        options = {}
    ) {
        const uiState =
            ensureNotificationUIState();

        const id =
            String(
                notificationId
            );

        const toast =
            uiState
                .activeToasts
                .get(
                    id
                );

        const timerId =
            uiState
                .toastTimers
                .get(
                    id
                );

        if (
            timerId !==
            undefined
        ) {
            globalObject.clearTimeout(
                timerId
            );

            uiState.toastTimers
                .delete(
                    id
                );
        }

        if (!toast) {
            return false;
        }

        const removeElement =
            () => {
                if (
                    toast.parentNode
                ) {
                    toast.parentNode
                        .removeChild(
                            toast
                        );
                }

                uiState.activeToasts
                    .delete(
                        id
                    );
            };

        if (
            options.animate !==
            false
        ) {
            toast.classList.add(
                'rain-arrival-toast--leaving'
            );

            globalObject.setTimeout(
                removeElement,
                220
            );
        } else {
            removeElement();
        }

        if (
            options.updateNotification ===
            true
        ) {
            dismissNotification(
                id,
                {
                    removeToast:
                        false
                }
            );
        }

        return true;
    }

    /**
     * Bind notification element events.
     *
     * @param {Element} element
     * @param {string} notificationId
     */
    function bindNotificationElementEvents(
        element,
        notificationId
    ) {
        if (!element) {
            return;
        }

        const openCityButton =
            element.querySelector(
                '[data-rain-arrival-open-city]'
            );

        const acknowledgeButton =
            element.querySelector(
                '[data-rain-arrival-acknowledge]'
            );

        const dismissButton =
            element.querySelector(
                '[data-rain-arrival-dismiss]'
            );

        if (openCityButton) {
            openCityButton.addEventListener(
                'click',
                () => {
                    openNotificationCity(
                        notificationId
                    );
                }
            );
        }

        if (acknowledgeButton) {
            acknowledgeButton.addEventListener(
                'click',
                () => {
                    acknowledgeNotification(
                        notificationId
                    );
                }
            );
        }

        if (dismissButton) {
            dismissButton.addEventListener(
                'click',
                () => {
                    dismissNotification(
                        notificationId
                    );
                }
            );
        }
    }

    /**
     * Receive in-app notification.
     *
     * @param {Object} alert
     * @param {Object} options
     * @returns {Object}
     */
    function receiveNotificationUI(
        alert,
        options = {}
    ) {
        const uiState =
            ensureNotificationUIState();

        const normalizedOptions =
            normalizeNotificationUIOptions(
                options
            );

        if (
            !normalizedOptions.enabled ||
            !alert
        ) {
            return {
                received:
                    false,

                reason:
                    'notification_ui_disabled_or_alert_missing'
            };
        }

        const notification =
            createNotificationModel(
                alert
            );

        uiState.notifications
            .set(
                notification.id,
                notification
            );

        uiState.receivedCount +=
            1;

        uiState.lastReceivedAt =
            Date.now();

        uiState.lastReceivedAtIso =
            new Date(
                uiState.lastReceivedAt
            ).toISOString();

        if (
            normalizedOptions.showToasts
        ) {
            displayNotificationToast(
                notification,
                normalizedOptions
            );
        }

        if (
            normalizedOptions.showNotificationCenter
        ) {
            renderNotificationCenter();
        }

        triggerNotificationFeedback(
            notification,
            normalizedOptions
        );

        persistNotificationUIState();

        updateNotificationCounters();

        dispatchUIEvent(
            NOTIFICATION_UI_EVENTS
                .received,
            {
                notification,

                receivedAt:
                    uiState.lastReceivedAt,

                receivedAtIso:
                    uiState.lastReceivedAtIso
            }
        );

        return {
            received:
                true,

            notification
        };
    }

    /**
     * Handle notification event.
     *
     * @param {CustomEvent} event
     */
    function handleNotificationUIEvent(
        event
    ) {
        const detail =
            event &&
            event.detail
                ? event.detail
                : {};

        const alert =
            detail.alert ||
            detail;

        receiveNotificationUI(
            alert
        );
    }

    /**
     * Install notification event listener.
     *
     * @returns {boolean}
     */
    function installNotificationUIListener() {
        const uiState =
            ensureNotificationUIState();

        if (
            uiState.listenerInstalled ||
            typeof globalObject
                .addEventListener !==
                'function'
        ) {
            return false;
        }

        const handler =
            handleNotificationUIEvent;

        globalObject.addEventListener(
            'rainguard:v32:rain-arrival:notification',
            handler
        );

        uiState.eventHandler =
            handler;

        uiState.listenerInstalled =
            true;

        return true;
    }

    /**
     * Remove notification event listener.
     *
     * @returns {boolean}
     */
    function removeNotificationUIListener() {
        const uiState =
            ensureNotificationUIState();

        if (
            !uiState.listenerInstalled ||
            !uiState.eventHandler ||
            typeof globalObject
                .removeEventListener !==
                'function'
        ) {
            return false;
        }

        globalObject.removeEventListener(
            'rainguard:v32:rain-arrival:notification',
            uiState.eventHandler
        );

        uiState.eventHandler =
            null;

        uiState.listenerInstalled =
            false;

        return true;
    }

    /**
     * Open notification city.
     *
     * @param {string} notificationId
     * @returns {Object}
     */
    function openNotificationCity(
        notificationId
    ) {
        const uiState =
            ensureNotificationUIState();

        const notification =
            uiState.notifications
                .get(
                    String(
                        notificationId
                    )
                );

        if (!notification) {
            return {
                opened:
                    false,

                reason:
                    'notification_not_found'
            };
        }

        if (
            notification.cityId &&
            typeof integrationApi
                .selectCityCard ===
                'function'
        ) {
            integrationApi
                .selectCityCard(
                    notification.cityId,
                    {
                        scrollIntoView:
                            true,

                        focusMap:
                            true
                    }
                );
        } else if (
            notification.prediction &&
            typeof integrationApi
                .requestMapFocus ===
                'function'
        ) {
            integrationApi
                .requestMapFocus(
                    notification.prediction
                );
        }

        return {
            opened:
                true,

            cityId:
                notification.cityId
        };
    }

    /**
     * Acknowledge notification.
     *
     * @param {string} notificationId
     * @param {Object} options
     * @returns {Object}
     */
    function acknowledgeNotification(
        notificationId,
        options = {}
    ) {
        const uiState =
            ensureNotificationUIState();

        const id =
            String(
                notificationId
            );

        const notification =
            uiState.notifications
                .get(
                    id
                );

        if (!notification) {
            return {
                acknowledged:
                    false,

                reason:
                    'notification_not_found'
            };
        }

        const now =
            Date.now();

        notification.acknowledged =
            true;

        notification.status =
            NOTIFICATION_LIFECYCLE_STATUS
                .ACKNOWLEDGED;

        notification.acknowledgedAt =
            now;

        notification.updatedAt =
            now;

        notification.updatedAtIso =
            new Date(
                now
            ).toISOString();

        uiState.acknowledgedCount +=
            1;

        if (
            options.removeToast !==
            false
        ) {
            removeToast(
                id,
                {
                    updateNotification:
                        false
                }
            );
        }

        renderNotificationCenter();

        persistNotificationUIState();

        updateNotificationCounters();

        dispatchUIEvent(
            NOTIFICATION_UI_EVENTS
                .acknowledged,
            {
                notificationId:
                    id,

                notification,

                acknowledgedAt:
                    now,

                acknowledgedAtIso:
                    notification
                        .updatedAtIso
            }
        );

        return {
            acknowledged:
                true,

            notification
        };
    }

    /**
     * Dismiss notification.
     *
     * @param {string} notificationId
     * @param {Object} options
     * @returns {Object}
     */
    function dismissNotification(
        notificationId,
        options = {}
    ) {
        const uiState =
            ensureNotificationUIState();

        const id =
            String(
                notificationId
            );

        const notification =
            uiState.notifications
                .get(
                    id
                );

        if (!notification) {
            return {
                dismissed:
                    false,

                reason:
                    'notification_not_found'
            };
        }

        const now =
            Date.now();

        notification.dismissed =
            true;

        notification.status =
            NOTIFICATION_LIFECYCLE_STATUS
                .DISMISSED;

        notification.dismissedAt =
            now;

        notification.updatedAt =
            now;

        notification.updatedAtIso =
            new Date(
                now
            ).toISOString();

        uiState.dismissedCount +=
            1;

        if (
            options.removeToast !==
            false
        ) {
            removeToast(
                id,
                {
                    updateNotification:
                        false
                }
            );
        }

        if (
            options.removeFromCenter !==
            false
        ) {
            uiState.notifications
                .delete(
                    id
                );
        }

        renderNotificationCenter();

        persistNotificationUIState();

        updateNotificationCounters();

        dispatchUIEvent(
            NOTIFICATION_UI_EVENTS
                .dismissed,
            {
                notificationId:
                    id,

                notification,

                dismissedAt:
                    now,

                dismissedAtIso:
                    notification
                        .updatedAtIso
            }
        );

        return {
            dismissed:
                true,

            notification
        };
    }

    /**
     * Acknowledge all notifications.
     *
     * @returns {Object}
     */
    function acknowledgeAllNotifications() {
        const uiState =
            ensureNotificationUIState();

        let acknowledgedCount =
            0;

        for (
            const notification
            of uiState
                .notifications
                .values()
        ) {
            if (
                notification
                    .acknowledged
            ) {
                continue;
            }

            acknowledgeNotification(
                notification.id,
                {
                    removeToast:
                        true
                }
            );

            acknowledgedCount +=
                1;
        }

        return {
            acknowledged:
                true,

            acknowledgedCount
        };
    }

    /**
     * Clear all UI notifications.
     *
     * @param {Object} options
     * @returns {Object}
     */
    function clearNotificationUI(
        options = {}
    ) {
        const uiState =
            ensureNotificationUIState();

        const removedCount =
            uiState.notifications
                .size;

        for (
            const notificationId
            of Array.from(
                uiState
                    .activeToasts
                    .keys()
            )
        ) {
            removeToast(
                notificationId,
                {
                    updateNotification:
                        false,
                    animate:
                        false
                }
            );
        }

        uiState.notifications
            .clear();

        if (
            options.clearDeliveryHistory ===
                true &&
            typeof integrationApi
                .clearNotificationHistory ===
                'function'
        ) {
            integrationApi
                .clearNotificationHistory({
                    clearCooldowns:
                        options
                            .clearCooldowns !==
                        false
                });
        }

        renderNotificationCenter();

        persistNotificationUIState();

        updateNotificationCounters();

        return {
            cleared:
                true,

            removedCount
        };
    }

    /**
     * Render notification center.
     *
     * @returns {Object}
     */
    function renderNotificationCenter() {
        const uiState =
            ensureNotificationUIState();

        const options =
            normalizeNotificationUIOptions();

        if (
            !options.showNotificationCenter
        ) {
            return {
                rendered:
                    false,

                reason:
                    'notification_center_disabled'
            };
        }

        const center =
            uiState.notificationCenter ||
            ensureNotificationCenter(
                options
            );

        const list =
            uiState.notificationCenterList;

        if (
            !center ||
            !list
        ) {
            return {
                rendered:
                    false,

                reason:
                    'notification_center_unavailable'
            };
        }

        const notifications =
            Array.from(
                uiState.notifications
                    .values()
            )
                .sort(
                    (left, right) =>
                        right.createdAt -
                        left.createdAt
                )
                .slice(
                    0,
                    options
                        .maximumCenterItems
                );

        if (
            notifications.length ===
            0
        ) {
            list.innerHTML = `
                <div class="rain-arrival-notification-center__empty">
                    ${escapeHtml(
                        options.language ===
                            'ar'
                            ? 'لا توجد تنبيهات وصول مطر حاليًا.'
                            : 'No rain arrival notifications are currently available.'
                    )}
                </div>
            `;
        } else {
            list.innerHTML =
                notifications
                    .map(
                        (notification) =>
                            buildNotificationCenterItemHtml(
                                notification,
                                options.language
                            )
                    )
                    .join('');

            list
                .querySelectorAll(
                    '[data-rain-arrival-notification-id]'
                )
                .forEach(
                    (element) => {
                        bindNotificationElementEvents(
                            element,
                            element.getAttribute(
                                'data-rain-arrival-notification-id'
                            )
                        );
                    }
                );
        }

        return {
            rendered:
                true,

            notificationCount:
                notifications.length
        };
    }

    /**
     * Bind notification center events.
     *
     * @param {Element} center
     */
    function bindNotificationCenterEvents(
        center
    ) {
        if (!center) {
            return;
        }

        const closeButton =
            center.querySelector(
                '[data-rain-arrival-close-center]'
            );

        const acknowledgeAllButton =
            center.querySelector(
                '[data-rain-arrival-acknowledge-all]'
            );

        const clearButton =
            center.querySelector(
                '[data-rain-arrival-clear-notifications]'
            );

        if (closeButton) {
            closeButton.addEventListener(
                'click',
                closeNotificationCenter
            );
        }

        if (acknowledgeAllButton) {
            acknowledgeAllButton.addEventListener(
                'click',
                acknowledgeAllNotifications
            );
        }

        if (clearButton) {
            clearButton.addEventListener(
                'click',
                () => {
                    clearNotificationUI();
                }
            );
        }
    }

    /**
     * Open notification center.
     *
     * @returns {Object}
     */
    function openNotificationCenter() {
        const uiState =
            ensureNotificationUIState();

        const center =
            uiState.notificationCenter ||
            ensureNotificationCenter();

        if (!center) {
            return {
                opened:
                    false,

                reason:
                    'notification_center_unavailable'
            };
        }

        center.classList.add(
            'rain-arrival-notification-center--open'
        );

        center.setAttribute(
            'aria-hidden',
            'false'
        );

        uiState.centerOpen =
            true;

        renderNotificationCenter();

        return {
            opened:
                true
        };
    }

    /**
     * Close notification center.
     *
     * @returns {Object}
     */
    function closeNotificationCenter() {
        const uiState =
            ensureNotificationUIState();

        const center =
            uiState.notificationCenter;

        if (!center) {
            return {
                closed:
                    false,

                reason:
                    'notification_center_unavailable'
            };
        }

        center.classList.remove(
            'rain-arrival-notification-center--open'
        );

        center.setAttribute(
            'aria-hidden',
            'true'
        );

        uiState.centerOpen =
            false;

        return {
            closed:
                true
        };
    }

    /**
     * Toggle notification center.
     *
     * @returns {Object}
     */
    function toggleNotificationCenter() {
        const uiState =
            ensureNotificationUIState();

        return uiState.centerOpen
            ? closeNotificationCenter()
            : openNotificationCenter();
    }

    /**
     * Trigger sound and vibration.
     *
     * @param {Object} notification
     * @param {Object} options
     * @returns {Object}
     */
    function triggerNotificationFeedback(
        notification,
        options
    ) {
        const uiState =
            ensureNotificationUIState();

        let soundTriggered =
            false;

        let vibrationTriggered =
            false;

        if (
            options.enableSound &&
            uiState.soundEnabled
        ) {
            soundTriggered =
                playNotificationSound(
                    notification,
                    options
                );
        }

        if (
            options.enableVibration &&
            uiState.vibrationEnabled
        ) {
            vibrationTriggered =
                vibrateNotification(
                    notification
                );
        }

        return {
            soundTriggered,
            vibrationTriggered
        };
    }

    /**
     * Play generated notification sound.
     *
     * @param {Object} notification
     * @param {Object} options
     * @returns {boolean}
     */
    function playNotificationSound(
        notification,
        options
    ) {
        const AudioContextClass =
            globalObject.AudioContext ||
            globalObject
                .webkitAudioContext;

        if (
            typeof AudioContextClass !==
            'function'
        ) {
            return false;
        }

        try {
            const audioContext =
                new AudioContextClass();

            const oscillator =
                audioContext
                    .createOscillator();

            const gain =
                audioContext
                    .createGain();

            const now =
                audioContext
                    .currentTime;

            const frequency =
                notification.riskLevel ===
                    'extreme'
                    ? 880
                    : (
                        notification.riskLevel ===
                            'high'
                            ? 660
                            : 520
                    );

            oscillator.type =
                notification.riskLevel ===
                    'extreme'
                    ? 'sawtooth'
                    : 'sine';

            oscillator.frequency
                .setValueAtTime(
                    frequency,
                    now
                );

            oscillator.frequency
                .exponentialRampToValueAtTime(
                    Math.max(
                        220,
                        frequency *
                        0.65
                    ),
                    now +
                    0.45
                );

            gain.gain
                .setValueAtTime(
                    0,
                    now
                );

            gain.gain
                .linearRampToValueAtTime(
                    options.soundVolume *
                    0.22,
                    now +
                    0.03
                );

            gain.gain
                .exponentialRampToValueAtTime(
                    0.001,
                    now +
                    0.55
                );

            oscillator.connect(
                gain
            );

            gain.connect(
                audioContext
                    .destination
            );

            oscillator.start(
                now
            );

            oscillator.stop(
                now +
                0.58
            );

            oscillator.onended =
                () => {
                    audioContext.close();
                };

            return true;
        } catch (error) {
            log(
                'debug',
                'Notification sound playback failed.',
                normalizeError(
                    error
                )
            );

            return false;
        }
    }

    /**
     * Trigger vibration.
     *
     * @param {Object} notification
     * @returns {boolean}
     */
    function vibrateNotification(
        notification
    ) {
        if (
            !globalObject.navigator ||
            typeof globalObject
                .navigator
                .vibrate !==
                'function'
        ) {
            return false;
        }

        const pattern =
            notification.riskLevel ===
                'extreme'
                ? [
                    300,
                    120,
                    300,
                    120,
                    500
                ]
                : (
                    notification.riskLevel ===
                        'high'
                        ? [
                            220,
                            100,
                            220
                        ]
                        : [
                            140
                        ]
                );

        try {
            return globalObject
                .navigator
                .vibrate(
                    pattern
                );
        } catch (error) {
            return false;
        }
    }

    /**
     * Update external notification counters.
     *
     * @returns {Object}
     */
    function updateNotificationCounters() {
        const uiState =
            ensureNotificationUIState();

        const activeCount =
            Array.from(
                uiState.notifications
                    .values()
            )
                .filter(
                    (notification) =>
                        !notification
                            .acknowledged &&
                        notification.status !==
                            NOTIFICATION_LIFECYCLE_STATUS
                                .EXPIRED
                )
                .length;

        if (
            typeof globalObject
                .document !==
                'undefined'
        ) {
            const selectors = [
                `#${NOTIFICATION_UI_IDS.notificationCounter}`,
                '[data-rain-arrival-notification-count]',
                '.rain-arrival-notification-count'
            ];

            const elements =
                new Set();

            for (
                const selector
                of selectors
            ) {
                try {
                    globalObject
                        .document
                        .querySelectorAll(
                            selector
                        )
                        .forEach(
                            (element) =>
                                elements.add(
                                    element
                                )
                        );
                } catch (error) {
                    log(
                        'debug',
                        'Notification counter selector failed.',
                        {
                            selector
                        }
                    );
                }
            }

            for (
                const element
                of elements
            ) {
                element.textContent =
                    String(
                        activeCount
                    );

                element.classList.toggle(
                    'rain-arrival-notification-counter--empty',
                    activeCount ===
                        0
                );

                element.setAttribute(
                    'data-count',
                    String(
                        activeCount
                    )
                );
            }
        }

        return {
            activeCount,

            totalCount:
                uiState.notifications
                    .size
        };
    }

    /**
     * Persist notification UI state.
     *
     * @returns {Object}
     */
    function persistNotificationUIState() {
        const uiState =
            ensureNotificationUIState();

        const options =
            normalizeNotificationUIOptions();

        if (
            !options.persistNotifications ||
            !globalObject
                .localStorage
        ) {
            return {
                persisted:
                    false,

                reason:
                    'persistence_disabled_or_unavailable'
            };
        }

        try {
            const notifications =
                Array.from(
                    uiState.notifications
                        .values()
                )
                    .slice(
                        0,
                        options
                            .maximumCenterItems
                    )
                    .map(
                        (notification) => ({
                            ...notification,

                            prediction:
                                notification.prediction
                                    ? {
                                        ...notification
                                            .prediction
                                    }
                                    : null
                        })
                    );

            const payload = {
                version:
                    'V32',

                savedAt:
                    Date.now(),

                savedAtIso:
                    nowIso(),

                notifications
            };

            globalObject
                .localStorage
                .setItem(
                    NOTIFICATION_STORAGE_KEY,
                    JSON.stringify(
                        payload
                    )
                );

            return {
                persisted:
                    true,

                count:
                    notifications.length
            };
        } catch (error) {
            return {
                persisted:
                    false,

                reason:
                    'storage_write_failed',

                error:
                    normalizeError(
                        error
                    )
            };
        }
    }

    /**
     * Restore notification UI state.
     *
     * @returns {Object}
     */
    function restoreNotificationUIState() {
        const uiState =
            ensureNotificationUIState();

        const options =
            normalizeNotificationUIOptions();

        if (
            !options.restoreNotifications ||
            !globalObject
                .localStorage
        ) {
            return {
                restored:
                    false,

                reason:
                    'restore_disabled_or_unavailable'
            };
        }

        try {
            const raw =
                globalObject
                    .localStorage
                    .getItem(
                        NOTIFICATION_STORAGE_KEY
                    );

            if (!raw) {
                return {
                    restored:
                        true,

                    count:
                        0
                };
            }

            const parsed =
                JSON.parse(
                    raw
                );

            const notifications =
                Array.isArray(
                    parsed.notifications
                )
                    ? parsed.notifications
                    : [];

            let restoredCount =
                0;

            for (
                const notification
                of notifications
            ) {
                if (
                    !notification ||
                    !notification.id
                ) {
                    continue;
                }

                uiState.notifications
                    .set(
                        String(
                            notification.id
                        ),
                        {
                            ...notification,

                            riskLevel:
                                normalizeRiskLevel(
                                    notification
                                        .riskLevel
                                )
                        }
                    );

                restoredCount +=
                    1;
            }

            uiState.restoredCount +=
                restoredCount;

            renderNotificationCenter();

            updateNotificationCounters();

            dispatchUIEvent(
                NOTIFICATION_UI_EVENTS
                    .restored,
                {
                    restoredCount,

                    restoredAt:
                        Date.now(),

                    restoredAtIso:
                        nowIso()
                }
            );

            return {
                restored:
                    true,

                count:
                    restoredCount
            };
        } catch (error) {
            return {
                restored:
                    false,

                reason:
                    'storage_read_failed',

                error:
                    normalizeError(
                        error
                    )
            };
        }
    }

    /**
     * Remove expired notifications.
     *
     * @returns {Object}
     */
    function processExpiredNotifications() {
        const uiState =
            ensureNotificationUIState();

        const options =
            normalizeNotificationUIOptions();

        const now =
            Date.now();

        let expiredCount =
            0;

        let removedCount =
            0;

        for (
            const [
                id,
                notification
            ]
            of uiState.notifications
        ) {
            if (
                notification.status ===
                    NOTIFICATION_LIFECYCLE_STATUS
                        .DISMISSED
            ) {
                continue;
            }

            const expiryMs =
                notification.acknowledged
                    ? options
                        .acknowledgedExpiryMs
                    : options
                        .alertExpiryMs;

            if (
                now -
                notification.createdAt <
                expiryMs
            ) {
                continue;
            }

            notification.status =
                NOTIFICATION_LIFECYCLE_STATUS
                    .EXPIRED;

            notification.expiredAt =
                now;

            notification.updatedAt =
                now;

            notification.updatedAtIso =
                new Date(
                    now
                ).toISOString();

            expiredCount +=
                1;

            uiState.expiredCount +=
                1;

            removeToast(
                id,
                {
                    updateNotification:
                        false
                }
            );

            dispatchUIEvent(
                NOTIFICATION_UI_EVENTS
                    .expired,
                {
                    notificationId:
                        id,

                    notification,

                    expiredAt:
                        now,

                    expiredAtIso:
                        notification
                            .updatedAtIso
                }
            );

            if (
                options.autoRemoveExpired
            ) {
                uiState.notifications
                    .delete(
                        id
                    );

                removedCount +=
                    1;
            }
        }

        if (
            expiredCount >
            0
        ) {
            renderNotificationCenter();

            persistNotificationUIState();

            updateNotificationCounters();
        }

        return {
            processed:
                true,

            expiredCount,

            removedCount
        };
    }

    /**
     * Calculate live remaining arrival.
     *
     * @param {Object} notification
     * @returns {number|null}
     */
    function calculateNotificationRemainingMinutes(
        notification
    ) {
        const now =
            Date.now();

        if (
            Number.isFinite(
                notification.arrivalTime
            )
        ) {
            return Math.max(
                0,
                (
                    notification
                        .arrivalTime -
                    now
                ) /
                60000
            );
        }

        if (
            Number.isFinite(
                notification.arrivalMinutes
            )
        ) {
            const elapsedMinutes =
                (
                    now -
                    notification.createdAt
                ) /
                60000;

            return Math.max(
                0,
                notification
                    .arrivalMinutes -
                elapsedMinutes
            );
        }

        return null;
    }

    /**
     * Process notification escalation.
     *
     * @returns {Object}
     */
    function processNotificationEscalations() {
        const uiState =
            ensureNotificationUIState();

        const options =
            normalizeNotificationUIOptions();

        const now =
            Date.now();

        let escalatedCount =
            0;

        for (
            const notification
            of uiState.notifications
                .values()
        ) {
            if (
                notification.acknowledged ||
                notification.dismissed ||
                notification.status ===
                    NOTIFICATION_LIFECYCLE_STATUS
                        .EXPIRED ||
                notification.escalated
            ) {
                continue;
            }

            const remainingMinutes =
                calculateNotificationRemainingMinutes(
                    notification
                );

            const riskEligible =
                options
                    .escalationRiskLevels
                    .includes(
                        notification
                            .riskLevel
                    );

            const arrivalEligible =
                remainingMinutes !==
                    null &&
                remainingMinutes <=
                    options
                        .escalationArrivalThresholdMinutes;

            if (
                !riskEligible &&
                !arrivalEligible
            ) {
                continue;
            }

            notification.escalated =
                true;

            notification.status =
                NOTIFICATION_LIFECYCLE_STATUS
                    .ESCALATED;

            notification.escalatedAt =
                now;

            notification.updatedAt =
                now;

            notification.updatedAtIso =
                new Date(
                    now
                ).toISOString();

            notification.arrivalMinutes =
                remainingMinutes;

            uiState.escalatedCount +=
                1;

            escalatedCount +=
                1;

            uiState.lastEscalationAt =
                now;

            uiState.lastEscalationAtIso =
                notification
                    .updatedAtIso;

            displayNotificationToast(
                notification,
                {
                    ...options,

                    extremeToastPersistent:
                        true
                }
            );

            triggerNotificationFeedback(
                notification,
                options
            );

            dispatchUIEvent(
                NOTIFICATION_UI_EVENTS
                    .escalated,
                {
                    notification,

                    escalatedAt:
                        now,

                    escalatedAtIso:
                        notification
                            .updatedAtIso,

                    remainingMinutes
                }
            );
        }

        if (
            escalatedCount >
            0
        ) {
            renderNotificationCenter();

            persistNotificationUIState();

            updateNotificationCounters();
        }

        return {
            processed:
                true,

            escalatedCount
        };
    }

    /**
     * Start notification lifecycle engine.
     *
     * @param {Object} options
     * @returns {Object}
     */
    function startNotificationLifecycle(
        options = {}
    ) {
        const uiState =
            ensureNotificationUIState();

        const normalizedOptions =
            normalizeNotificationUIOptions(
                options
            );

        stopNotificationLifecycle();

        const lifecycleTick =
            () => {
                processExpiredNotifications();

                processNotificationEscalations();
            };

        lifecycleTick();

        uiState.expiryTimerId =
            globalObject.setInterval(
                processExpiredNotifications,
                Math.max(
                    30000,
                    normalizedOptions
                        .escalationCheckIntervalMs
                )
            );

        uiState.escalationTimerId =
            globalObject.setInterval(
                processNotificationEscalations,
                normalizedOptions
                    .escalationCheckIntervalMs
            );

        return {
            started:
                true,

            escalationCheckIntervalMs:
                normalizedOptions
                    .escalationCheckIntervalMs
        };
    }

    /**
     * Stop notification lifecycle engine.
     *
     * @returns {boolean}
     */
    function stopNotificationLifecycle() {
        const uiState =
            ensureNotificationUIState();

        let stopped =
            false;

        if (
            uiState.expiryTimerId !==
            null
        ) {
            globalObject.clearInterval(
                uiState.expiryTimerId
            );

            uiState.expiryTimerId =
                null;

            stopped =
                true;
        }

        if (
            uiState.escalationTimerId !==
            null
        ) {
            globalObject.clearInterval(
                uiState.escalationTimerId
            );

            uiState.escalationTimerId =
                null;

            stopped =
                true;
        }

        return stopped;
    }

    /**
     * Enable or disable sound.
     *
     * @param {boolean} enabled
     * @returns {boolean}
     */
    function setNotificationSoundEnabled(
        enabled
    ) {
        const uiState =
            ensureNotificationUIState();

        uiState.soundEnabled =
            Boolean(
                enabled
            );

        uiState.options.enableSound =
            uiState.soundEnabled;

        return uiState.soundEnabled;
    }

    /**
     * Enable or disable vibration.
     *
     * @param {boolean} enabled
     * @returns {boolean}
     */
    function setNotificationVibrationEnabled(
        enabled
    ) {
        const uiState =
            ensureNotificationUIState();

        uiState.vibrationEnabled =
            Boolean(
                enabled
            );

        uiState.options.enableVibration =
            uiState.vibrationEnabled;

        return uiState
            .vibrationEnabled;
    }

    /**
     * Return notification UI list.
     *
     * @param {Object} options
     * @returns {Array<Object>}
     */
    function getNotificationUIItems(
        options = {}
    ) {
        const uiState =
            ensureNotificationUIState();

        let notifications =
            Array.from(
                uiState.notifications
                    .values()
            );

        if (
            options.activeOnly ===
                true
        ) {
            notifications =
                notifications.filter(
                    (notification) =>
                        !notification
                            .acknowledged &&
                        notification.status !==
                            NOTIFICATION_LIFECYCLE_STATUS
                                .EXPIRED
                );
        }

        return notifications
            .sort(
                (left, right) =>
                    right.createdAt -
                    left.createdAt
            )
            .slice(
                0,
                Math.max(
                    1,
                    toFiniteNumber(
                        options.limit,
                        100
                    )
                )
            );
    }

    /**
     * Return notification UI status.
     *
     * @returns {Object}
     */
    function getNotificationUIStatus() {
        const uiState =
            ensureNotificationUIState();

        return {
            initialized:
                uiState.initialized,

            enabled:
                uiState.options.enabled,

            stylesInstalled:
                uiState.stylesInstalled,

            listenerInstalled:
                uiState.listenerInstalled,

            toastContainerFound:
                Boolean(
                    uiState.toastContainer
                ),

            notificationCenterFound:
                Boolean(
                    uiState.notificationCenter
                ),

            notificationCenterOpen:
                uiState.centerOpen,

            lifecycleActive:
                uiState.expiryTimerId !==
                    null ||
                uiState.escalationTimerId !==
                    null,

            soundEnabled:
                uiState.soundEnabled,

            vibrationEnabled:
                uiState.vibrationEnabled,

            notificationCount:
                uiState.notifications
                    .size,

            activeToastCount:
                uiState.activeToasts
                    .size,

            receivedCount:
                uiState.receivedCount,

            displayedCount:
                uiState.displayedCount,

            acknowledgedCount:
                uiState.acknowledgedCount,

            dismissedCount:
                uiState.dismissedCount,

            expiredCount:
                uiState.expiredCount,

            escalatedCount:
                uiState.escalatedCount,

            restoredCount:
                uiState.restoredCount,

            lastReceivedAt:
                uiState.lastReceivedAt,

            lastReceivedAtIso:
                uiState.lastReceivedAtIso,

            lastEscalationAt:
                uiState.lastEscalationAt,

            lastEscalationAtIso:
                uiState.lastEscalationAtIso,

            options: {
                ...uiState.options,

                escalationRiskLevels:
                    uiState
                        .options
                        .escalationRiskLevels
                        .slice()
            }
        };
    }

    /**
     * Initialize notification UI.
     *
     * @param {Object} options
     * @returns {Object}
     */
    function initializeNotificationUI(
        options = {}
    ) {
        const uiState =
            ensureNotificationUIState();

        const normalizedOptions =
            normalizeNotificationUIOptions(
                options
            );

        installNotificationUIStyles();

        ensureToastContainer(
            normalizedOptions
        );

        if (
            normalizedOptions
                .showNotificationCenter
        ) {
            ensureNotificationCenter(
                normalizedOptions
            );
        }

        installNotificationUIListener();

        if (
            normalizedOptions
                .restoreNotifications
        ) {
            restoreNotificationUIState();
        }

        startNotificationLifecycle(
            normalizedOptions
        );

        updateNotificationCounters();

        uiState.initialized =
            true;

        return {
            initialized:
                true,

            options:
                normalizedOptions,

            status:
                getNotificationUIStatus()
        };
    }

    /**
     * Destroy notification UI.
     *
     * @param {Object} options
     * @returns {Object}
     */
    function destroyNotificationUI(
        options = {}
    ) {
        const uiState =
            ensureNotificationUIState();

        stopNotificationLifecycle();

        removeNotificationUIListener();

        for (
            const notificationId
            of Array.from(
                uiState.activeToasts
                    .keys()
            )
        ) {
            removeToast(
                notificationId,
                {
                    updateNotification:
                        false,
                    animate:
                        false
                }
            );
        }

        if (
            options.removeElements !==
            false
        ) {
            if (
                uiState.toastContainer &&
                uiState.toastContainer
                    .parentNode
            ) {
                uiState.toastContainer
                    .parentNode
                    .removeChild(
                        uiState.toastContainer
                    );
            }

            if (
                uiState.notificationCenter &&
                uiState.notificationCenter
                    .parentNode
            ) {
                uiState.notificationCenter
                    .parentNode
                    .removeChild(
                        uiState.notificationCenter
                    );
            }

            uiState.toastContainer =
                null;

            uiState.notificationCenter =
                null;

            uiState.notificationCenterList =
                null;
        }

        uiState.initialized =
            false;

        return {
            destroyed:
                true
        };
    }

    /**
     * Extend runtime state.
     */
    ensureNotificationUIState();

    /**
     * Extend public API.
     */
    integrationApi
        .initializeNotificationUI =
        initializeNotificationUI;

    integrationApi
        .destroyNotificationUI =
        destroyNotificationUI;

    integrationApi
        .receiveNotificationUI =
        receiveNotificationUI;

    integrationApi
        .displayNotificationToast =
        displayNotificationToast;

    integrationApi
        .removeNotificationToast =
        removeToast;

    integrationApi
        .openNotificationCenter =
        openNotificationCenter;

    integrationApi
        .closeNotificationCenter =
        closeNotificationCenter;

    integrationApi
        .toggleNotificationCenter =
        toggleNotificationCenter;

    integrationApi
        .renderNotificationCenter =
        renderNotificationCenter;

    integrationApi
        .acknowledgeNotification =
        acknowledgeNotification;

    integrationApi
        .acknowledgeAllNotifications =
        acknowledgeAllNotifications;

    integrationApi
        .dismissNotification =
        dismissNotification;

    integrationApi
        .clearNotificationUI =
        clearNotificationUI;

    integrationApi
        .openNotificationCity =
        openNotificationCity;

    integrationApi
        .setNotificationSoundEnabled =
        setNotificationSoundEnabled;

    integrationApi
        .setNotificationVibrationEnabled =
        setNotificationVibrationEnabled;

    integrationApi
        .startNotificationLifecycle =
        startNotificationLifecycle;

    integrationApi
        .stopNotificationLifecycle =
        stopNotificationLifecycle;

    integrationApi
        .processExpiredNotifications =
        processExpiredNotifications;

    integrationApi
        .processNotificationEscalations =
        processNotificationEscalations;

    integrationApi
        .persistNotificationUIState =
        persistNotificationUIState;

    integrationApi
        .restoreNotificationUIState =
        restoreNotificationUIState;

    integrationApi
        .getNotificationUIItems =
        getNotificationUIItems;

    integrationApi
        .getNotificationUIStatus =
        getNotificationUIStatus;

    integrationApi
        .setNotificationUIOptions =
        normalizeNotificationUIOptions;

    integrationApi.metadata = {
        ...integrationApi
            .metadata,

        currentPart:
            '2.2C-2',

        nextPart:
            '2.2D-1',

        status:
            'section_complete',

        productionReady:
            false,

        moduleClosed:
            true,

        capabilities: [
            ...new Set([
                ...(
                    Array.isArray(
                        integrationApi
                            .metadata
                            .capabilities
                    )
                        ? integrationApi
                            .metadata
                            .capabilities
                        : []
                ),

                'in_app_notification_toasts',
                'notification_center',
                'notification_acknowledgement',
                'notification_dismissal',
                'notification_lifecycle',
                'notification_expiry',
                'notification_escalation',
                'notification_sound',
                'notification_vibration',
                'notification_local_persistence',
                'notification_state_restore',
                'notification_counters',
                'notification_city_navigation'
            ])
        ]
    };

    /**
     * Extend internal API.
     */
    Object.assign(
        integrationApi._internals,
        {
            NOTIFICATION_UI_IDS,
            NOTIFICATION_STORAGE_KEY,
            DEFAULT_NOTIFICATION_UI_OPTIONS,
            NOTIFICATION_LIFECYCLE_STATUS,
            NOTIFICATION_UI_EVENTS,
            NOTIFICATION_UI_CSS,

            ensureNotificationUIState,
            normalizeNotificationUIOptions,
            installNotificationUIStyles,
            ensureToastContainer,
            ensureNotificationCenter,
            createNotificationModel,
            resolveNotificationIcon,
            buildToastHtml,
            buildNotificationCenterItemHtml,
            resolveToastDuration,
            enforceToastLimit,
            bindNotificationElementEvents,
            handleNotificationUIEvent,
            installNotificationUIListener,
            removeNotificationUIListener,
            bindNotificationCenterEvents,
            triggerNotificationFeedback,
            playNotificationSound,
            vibrateNotification,
            updateNotificationCounters,
            calculateNotificationRemainingMinutes
        }
    );

    /**
     * Initialize notification UI integration.
     */
    try {
        initializeNotificationUI();
    } catch (error) {
        log(
            'debug',
            'Rain arrival notification UI initialization failed.',
            normalizeError(
                error,
                {
                    part:
                        '2.2C-2'
                }
            )
        );
    }

    log(
        'info',
        'Rain arrival integration Part 2.2C-2 loaded.',
        {
            notificationUI:
                getNotificationUIStatus(),

            section:
                '2.2C complete'
        }
    );
})(
    typeof globalThis !==
        'undefined'
        ? globalThis
        : (
            typeof window !==
                'undefined'
                ? window
                : this
        )
);

/**
 * RainGuard AI V32
 * Rain Arrival Integration Engine
 *
 * Part:
 * 2.2D-1A
 *
 * Responsibilities:
 * - Discover dashboard elements
 * - Create dashboard runtime state
 * - Normalize dashboard options
 * - Prepare dashboard synchronization layer
 */

(function rainArrivalIntegrationV32DashboardBridge(globalObject) {
    'use strict';

    if (
        !globalObject ||
        !globalObject.RainGuardAI ||
        !globalObject.RainGuardAI.V32 ||
        !globalObject.RainGuardAI.V32
            .rainArrivalIntegration
    ) {
        throw new Error(
            'Rain Arrival Integration Part 2.2C-2 must be loaded before Part 2.2D-1A.'
        );
    }

    const integrationApi =
        globalObject
            .RainGuardAI
            .V32
            .rainArrivalIntegration;

    const runtimeState =
        integrationApi._state;

    const internal =
        integrationApi._internals;

    const {
        toFiniteNumber,
        clamp,
        normalizeUILanguage,
        detectUILanguage,
        normalizeError,
        log
    } = internal;

    const DEFAULT_DASHBOARD_OPTIONS =
        Object.freeze({
            enabled:
                true,

            autoDiscover:
                true,

            autoRender:
                true,

            language:
                null,

            maximumCities:
                10,

            highlightCriticalCity:
                true,

            updateSummary:
                true,

            updateCounters:
                true,

            updateRiskPanel:
                true,

            updateArrivalPanel:
                true
        });

    const DASHBOARD_SELECTORS =
        Object.freeze({
            root: [
                '[data-rain-arrival-dashboard]',
                '#rain-arrival-dashboard',
                '.rain-arrival-dashboard'
            ],

            totalCities: [
                '[data-rain-arrival-total-cities]',
                '#rain-arrival-total-cities'
            ],

            rainCities: [
                '[data-rain-arrival-rain-cities]',
                '#rain-arrival-rain-cities'
            ],

            criticalCities: [
                '[data-rain-arrival-critical-cities]',
                '#rain-arrival-critical-cities'
            ],

            nearestArrival: [
                '[data-rain-arrival-nearest]',
                '#rain-arrival-nearest'
            ],

            highestRisk: [
                '[data-rain-arrival-highest-risk]',
                '#rain-arrival-highest-risk'
            ],

            averageConfidence: [
                '[data-rain-arrival-average-confidence]',
                '#rain-arrival-average-confidence'
            ],

            summary: [
                '[data-rain-arrival-dashboard-summary]',
                '#rain-arrival-dashboard-summary'
            ],

            cityList: [
                '[data-rain-arrival-dashboard-cities]',
                '#rain-arrival-dashboard-cities'
            ]
        });

    function ensureDashboardState() {
        if (
            !runtimeState.dashboard ||
            typeof runtimeState.dashboard !==
                'object'
        ) {
            runtimeState.dashboard = {
                options: {
                    ...DEFAULT_DASHBOARD_OPTIONS
                },

                elements: {},

                discovered:
                    false,

                renderCount:
                    0,

                renderFailures:
                    0,

                lastRenderAt:
                    null,

                lastRenderAtIso:
                    null,

                lastSummary:
                    null
            };
        }

        return runtimeState.dashboard;
    }

    function normalizeDashboardOptions(
        options = {}
    ) {
        const dashboardState =
            ensureDashboardState();

        const normalized = {
            ...DEFAULT_DASHBOARD_OPTIONS,
            ...dashboardState.options,
            ...options
        };

        normalized.enabled =
            normalized.enabled !==
            false;

        normalized.autoDiscover =
            normalized.autoDiscover !==
            false;

        normalized.autoRender =
            normalized.autoRender !==
            false;

        normalized.highlightCriticalCity =
            normalized.highlightCriticalCity !==
            false;

        normalized.updateSummary =
            normalized.updateSummary !==
            false;

        normalized.updateCounters =
            normalized.updateCounters !==
            false;

        normalized.updateRiskPanel =
            normalized.updateRiskPanel !==
            false;

        normalized.updateArrivalPanel =
            normalized.updateArrivalPanel !==
            false;

        normalized.maximumCities =
            Math.max(
                1,
                Math.round(
                    toFiniteNumber(
                        normalized.maximumCities,
                        DEFAULT_DASHBOARD_OPTIONS
                            .maximumCities
                    )
                )
            );

        normalized.language =
            normalizeUILanguage(
                normalized.language ||
                detectUILanguage()
            );

        dashboardState.options =
            normalized;

        return {
            ...normalized
        };
    }

    function findFirstDashboardElement(
        selectors
    ) {
        if (
            typeof globalObject.document ===
                'undefined' ||
            !Array.isArray(selectors)
        ) {
            return null;
        }

        for (
            const selector
            of selectors
        ) {
            try {
                const element =
                    globalObject.document
                        .querySelector(
                            selector
                        );

                if (element) {
                    return element;
                }
            } catch (error) {
                log(
                    'debug',
                    'Dashboard selector failed.',
                    {
                        selector,

                        error:
                            normalizeError(
                                error
                            )
                    }
                );
            }
        }

        return null;
    }

    function discoverDashboardElements(
        options = {}
    ) {
        const dashboardState =
            ensureDashboardState();

        const normalizedOptions =
            normalizeDashboardOptions(
                options
            );

        if (
            !normalizedOptions.enabled ||
            typeof globalObject.document ===
                'undefined'
        ) {
            return {
                discovered:
                    false,

                reason:
                    'dashboard_disabled_or_document_unavailable'
            };
        }

        const discoveredElements = {};

        for (
            const [
                key,
                selectors
            ]
            of Object.entries(
                DASHBOARD_SELECTORS
            )
        ) {
            discoveredElements[
                key
            ] =
                findFirstDashboardElement(
                    selectors
                );
        }

        dashboardState.elements =
            discoveredElements;

        dashboardState.discovered =
            Object.values(
                discoveredElements
            ).some(Boolean);

        return {
            discovered:
                dashboardState.discovered,

            elements:
                Object.fromEntries(
                    Object.entries(
                        discoveredElements
                    ).map(
                        ([
                            key,
                            element
                        ]) => [
                            key,
                            Boolean(
                                element
                            )
                        ]
                    )
                )
        };
    }

    function getDashboardElements() {
        const dashboardState =
            ensureDashboardState();

        return {
            ...dashboardState.elements
        };
    }

    function setDashboardOptions(
        options = {}
    ) {
        return normalizeDashboardOptions(
            options
        );
    }

    function getDashboardStatus() {
        const dashboardState =
            ensureDashboardState();

        return {
            enabled:
                dashboardState.options
                    .enabled,

            discovered:
                dashboardState.discovered,

            renderCount:
                dashboardState.renderCount,

            renderFailures:
                dashboardState.renderFailures,

            lastRenderAt:
                dashboardState.lastRenderAt,

            lastRenderAtIso:
                dashboardState.lastRenderAtIso,

            lastSummary:
                dashboardState.lastSummary,

            elements:
                Object.fromEntries(
                    Object.entries(
                        dashboardState.elements
                    ).map(
                        ([
                            key,
                            element
                        ]) => [
                            key,
                            Boolean(
                                element
                            )
                        ]
                    )
                ),

            options: {
                ...dashboardState.options
            }
        };
    }

    ensureDashboardState();

    integrationApi
        .discoverDashboardElements =
        discoverDashboardElements;

    integrationApi
        .getDashboardElements =
        getDashboardElements;

    integrationApi
        .setDashboardOptions =
        setDashboardOptions;

    integrationApi
        .getDashboardStatus =
        getDashboardStatus;

    integrationApi.metadata = {
        ...integrationApi.metadata,

        currentPart:
            '2.2D-1A',

        nextPart:
            '2.2D-1B',

        status:
            'in_progress',

        productionReady:
            false,

        moduleClosed:
            true,

        capabilities: [
            ...new Set([
                ...(
                    Array.isArray(
                        integrationApi
                            .metadata
                            .capabilities
                    )
                        ? integrationApi
                            .metadata
                            .capabilities
                        : []
                ),

                'dashboard_element_discovery',
                'dashboard_runtime_state',
                'dashboard_option_normalization',
                'dashboard_status_tracking'
            ])
        ]
    };

    Object.assign(
        integrationApi._internals,
        {
            DEFAULT_DASHBOARD_OPTIONS,
            DASHBOARD_SELECTORS,
            ensureDashboardState,
            normalizeDashboardOptions,
            findFirstDashboardElement
        }
    );

    try {
        normalizeDashboardOptions();

        discoverDashboardElements();
    } catch (error) {
        log(
            'debug',
            'Rain arrival dashboard bridge initialization failed.',
            normalizeError(
                error,
                {
                    part:
                        '2.2D-1A'
                }
            )
        );
    }

    log(
        'info',
        'Rain arrival integration Part 2.2D-1A loaded.',
        {
            dashboard:
                getDashboardStatus()
        }
    );
})(
    typeof globalThis !==
        'undefined'
        ? globalThis
        : (
            typeof window !==
                'undefined'
                ? window
                : this
        )
);

/**
 * RainGuard AI V32
 * Rain Arrival Integration Engine
 *
 * Part:
 * 2.2D-1B
 *
 * Responsibilities:
 * - Build dashboard summary
 * - Normalize dashboard predictions
 * - Calculate dashboard counters
 * - Identify nearest arrival
 * - Identify highest-risk city
 */

(function rainArrivalIntegrationV32DashboardSummary(globalObject) {
    'use strict';

    if (
        !globalObject ||
        !globalObject.RainGuardAI ||
        !globalObject.RainGuardAI.V32 ||
        !globalObject.RainGuardAI.V32
            .rainArrivalIntegration
    ) {
        throw new Error(
            'Rain Arrival Integration Part 2.2D-1A must be loaded before Part 2.2D-1B.'
        );
    }

    const integrationApi =
        globalObject
            .RainGuardAI
            .V32
            .rainArrivalIntegration;

    const internal =
        integrationApi._internals;

    const {
        toFiniteNumber,
        clamp,
        normalizeRiskLevel,
        ensureDashboardState,
        normalizeDashboardOptions,
        log
    } = internal;

    const DASHBOARD_RISK_PRIORITY =
        Object.freeze({
            unknown:
                0,

            minimal:
                1,

            low:
                2,

            moderate:
                3,

            high:
                4,

            extreme:
                5
        });

    function normalizeDashboardPrediction(
        prediction
    ) {
        if (
            !prediction ||
            typeof prediction !==
                'object'
        ) {
            return null;
        }

        const cityId =
            prediction.cityId ||
            prediction.id ||
            prediction.cityCode ||
            null;

        const cityName =
            prediction.cityName ||
            prediction.name ||
            prediction.cityNameEn ||
            cityId ||
            '';

        const cityNameAr =
            prediction.cityNameAr ||
            prediction.nameAr ||
            prediction.arabicName ||
            cityName;

        const arrivalMinutes =
            toFiniteNumber(
                prediction.arrivalMinutes ??
                prediction.etaMinutes ??
                prediction.minutesToArrival,
                null
            );

        const confidence =
            clamp(
                toFiniteNumber(
                    prediction.confidence,
                    0
                ),
                0,
                100
            );

        const probability =
            clamp(
                toFiniteNumber(
                    prediction.probability ??
                    prediction.rainProbability,
                    0
                ),
                0,
                100
            );

        const riskLevel =
            normalizeRiskLevel(
                prediction.riskLevel ??
                prediction.risk
            );

        const willRain =
            prediction.willRain ===
                true ||
            probability >=
                30;

        return {
            id:
                prediction.id ||
                cityId,

            cityId,

            cityName,

            cityNameAr,

            arrivalMinutes,

            arrivalTime:
                prediction.arrivalTime ||
                prediction.expectedAt ||
                null,

            confidence,

            probability,

            intensity:
                Math.max(
                    0,
                    toFiniteNumber(
                        prediction.intensity,
                        0
                    )
                ),

            riskLevel,

            willRain,

            accepted:
                prediction.accepted !==
                false,

            latitude:
                toFiniteNumber(
                    prediction.latitude ??
                    prediction.lat,
                    null
                ),

            longitude:
                toFiniteNumber(
                    prediction.longitude ??
                    prediction.lng ??
                    prediction.lon,
                    null
                ),

            raw:
                prediction
        };
    }

    function normalizeDashboardPredictions(
        predictions
    ) {
        if (
            !Array.isArray(
                predictions
            )
        ) {
            return [];
        }

        return predictions
            .map(
                normalizeDashboardPrediction
            )
            .filter(Boolean);
    }

    function findNearestArrivalPrediction(
        predictions
    ) {
        return predictions
            .filter(
                (prediction) =>
                    prediction.willRain &&
                    prediction.accepted &&
                    Number.isFinite(
                        prediction
                            .arrivalMinutes
                    )
            )
            .sort(
                (left, right) =>
                    left.arrivalMinutes -
                    right.arrivalMinutes
            )[0] ||
            null;
    }

    function findHighestRiskPrediction(
        predictions
    ) {
        return predictions
            .filter(
                (prediction) =>
                    prediction.accepted
            )
            .sort(
                (left, right) => {
                    const riskDifference =
                        DASHBOARD_RISK_PRIORITY[
                            right.riskLevel
                        ] -
                        DASHBOARD_RISK_PRIORITY[
                            left.riskLevel
                        ];

                    if (
                        riskDifference !==
                        0
                    ) {
                        return riskDifference;
                    }

                    const probabilityDifference =
                        right.probability -
                        left.probability;

                    if (
                        probabilityDifference !==
                        0
                    ) {
                        return probabilityDifference;
                    }

                    return (
                        right.confidence -
                        left.confidence
                    );
                }
            )[0] ||
            null;
    }

    function calculateAverageConfidence(
        predictions
    ) {
        const validPredictions =
            predictions.filter(
                (prediction) =>
                    prediction.accepted &&
                    Number.isFinite(
                        prediction.confidence
                    )
            );

        if (
            validPredictions.length ===
            0
        ) {
            return 0;
        }

        const total =
            validPredictions.reduce(
                (
                    sum,
                    prediction
                ) =>
                    sum +
                    prediction.confidence,
                0
            );

        return clamp(
            total /
            validPredictions.length,
            0,
            100
        );
    }

    function buildDashboardSummary(
        predictions,
        options = {}
    ) {
        const dashboardState =
            ensureDashboardState();

        const normalizedOptions =
            normalizeDashboardOptions(
                options
            );

        const normalizedPredictions =
            normalizeDashboardPredictions(
                predictions
            );

        const acceptedPredictions =
            normalizedPredictions.filter(
                (prediction) =>
                    prediction.accepted
            );

        const rainPredictions =
            acceptedPredictions.filter(
                (prediction) =>
                    prediction.willRain
            );

        const criticalPredictions =
            rainPredictions.filter(
                (prediction) =>
                    [
                        'high',
                        'extreme'
                    ].includes(
                        prediction.riskLevel
                    )
            );

        const nearestArrival =
            findNearestArrivalPrediction(
                rainPredictions
            );

        const highestRisk =
            findHighestRiskPrediction(
                acceptedPredictions
            );

        const averageConfidence =
            calculateAverageConfidence(
                acceptedPredictions
            );

        const summary = {
            totalCities:
                acceptedPredictions.length,

            rainCities:
                rainPredictions.length,

            criticalCities:
                criticalPredictions.length,

            noRainCities:
                Math.max(
                    0,
                    acceptedPredictions.length -
                    rainPredictions.length
                ),

            rejectedCities:
                normalizedPredictions.length -
                acceptedPredictions.length,

            averageConfidence,

            nearestArrival,

            highestRisk,

            criticalPredictions:
                criticalPredictions
                    .slice(
                        0,
                        normalizedOptions
                            .maximumCities
                    ),

            rainPredictions:
                rainPredictions
                    .slice()
                    .sort(
                        (left, right) =>
                            toFiniteNumber(
                                left.arrivalMinutes,
                                Number
                                    .POSITIVE_INFINITY
                            ) -
                            toFiniteNumber(
                                right.arrivalMinutes,
                                Number
                                    .POSITIVE_INFINITY
                            )
                    )
                    .slice(
                        0,
                        normalizedOptions
                            .maximumCities
                    ),

            generatedAt:
                Date.now(),

            generatedAtIso:
                new Date()
                    .toISOString(),

            language:
                normalizedOptions
                    .language
        };

        dashboardState.lastSummary =
            summary;

        return summary;
    }

    integrationApi
        .normalizeDashboardPrediction =
        normalizeDashboardPrediction;

    integrationApi
        .normalizeDashboardPredictions =
        normalizeDashboardPredictions;

    integrationApi
        .findNearestArrivalPrediction =
        findNearestArrivalPrediction;

    integrationApi
        .findHighestRiskPrediction =
        findHighestRiskPrediction;

    integrationApi
        .calculateAverageDashboardConfidence =
        calculateAverageConfidence;

    integrationApi
        .buildDashboardSummary =
        buildDashboardSummary;

    integrationApi.metadata = {
        ...integrationApi.metadata,

        currentPart:
            '2.2D-1B',

        nextPart:
            '2.2D-1C',

        status:
            'in_progress',

        productionReady:
            false,

        moduleClosed:
            true,

        capabilities: [
            ...new Set([
                ...(
                    Array.isArray(
                        integrationApi
                            .metadata
                            .capabilities
                    )
                        ? integrationApi
                            .metadata
                            .capabilities
                        : []
                ),

                'dashboard_prediction_normalization',
                'dashboard_summary_builder',
                'nearest_arrival_detection',
                'highest_risk_city_detection',
                'average_confidence_calculation',
                'critical_city_counting'
            ])
        ]
    };

    Object.assign(
        integrationApi._internals,
        {
            DASHBOARD_RISK_PRIORITY,
            normalizeDashboardPrediction,
            normalizeDashboardPredictions,
            findNearestArrivalPrediction,
            findHighestRiskPrediction,
            calculateAverageConfidence
        }
    );

    try {
        buildDashboardSummary([]);
    } catch (error) {
        log(
            'debug',
            'Dashboard summary initialization failed.',
            {
                part:
                    '2.2D-1B',

                error:
                    error &&
                    error.message
                        ? error.message
                        : String(
                            error
                        )
            }
        );
    }

    log(
        'info',
        'Rain arrival integration Part 2.2D-1B loaded.'
    );
})(
    typeof globalThis !==
        'undefined'
        ? globalThis
        : (
            typeof window !==
                'undefined'
                ? window
                : this
        )
);

/**
 * RainGuard AI V32
 * Rain Arrival Integration Engine
 *
 * Part:
 * 2.2D-1C
 *
 * Responsibilities:
 * - Render dashboard counters
 * - Render nearest arrival
 * - Render highest-risk city
 * - Render average confidence
 */

(function rainArrivalIntegrationV32DashboardRender(globalObject) {
    'use strict';

    if (
        !globalObject ||
        !globalObject.RainGuardAI ||
        !globalObject.RainGuardAI.V32 ||
        !globalObject.RainGuardAI.V32
            .rainArrivalIntegration
    ) {
        throw new Error(
            'Rain Arrival Integration Part 2.2D-1B must be loaded before Part 2.2D-1C.'
        );
    }

    const integrationApi =
        globalObject
            .RainGuardAI
            .V32
            .rainArrivalIntegration;

    const internal =
        integrationApi._internals;

    const runtimeState =
        integrationApi._state;

    const {
        escapeHtml,
        formatNumber,
        formatArrivalDuration,
        getUIText,
        ensureDashboardState,
        normalizeDashboardOptions,
        log
    } = internal;

    function setDashboardElementText(
        element,
        value
    ) {
        if (!element) {
            return false;
        }

        element.textContent =
            value ===
                null ||
            value ===
                undefined
                ? ''
                : String(
                    value
                );

        return true;
    }

    function resolveDashboardCityName(
        prediction,
        language
    ) {
        if (!prediction) {
            return '';
        }

        return language ===
            'ar'
            ? (
                prediction.cityNameAr ||
                prediction.cityName ||
                prediction.cityId ||
                ''
            )
            : (
                prediction.cityName ||
                prediction.cityNameAr ||
                prediction.cityId ||
                ''
            );
    }

    function renderDashboardCounters(
        summary,
        options
    ) {
        const dashboardState =
            ensureDashboardState();

        const elements =
            dashboardState.elements;

        if (
            !options.updateCounters
        ) {
            return;
        }

        setDashboardElementText(
            elements.totalCities,
            formatNumber(
                summary.totalCities,
                0,
                options.language
            )
        );

        setDashboardElementText(
            elements.rainCities,
            formatNumber(
                summary.rainCities,
                0,
                options.language
            )
        );

        setDashboardElementText(
            elements.criticalCities,
            formatNumber(
                summary.criticalCities,
                0,
                options.language
            )
        );
    }

    function renderNearestArrival(
        summary,
        options
    ) {
        const dashboardState =
            ensureDashboardState();

        const element =
            dashboardState
                .elements
                .nearestArrival;

        if (
            !element ||
            !options.updateArrivalPanel
        ) {
            return;
        }

        const prediction =
            summary.nearestArrival;

        if (!prediction) {
            element.textContent =
                options.language ===
                    'ar'
                    ? 'لا يوجد وصول متوقع'
                    : 'No expected arrival';

            return;
        }

        const cityName =
            resolveDashboardCityName(
                prediction,
                options.language
            );

        const arrivalText =
            formatArrivalDuration(
                prediction.arrivalMinutes,
                options.language
            );

        element.innerHTML = `
            <strong>${escapeHtml(
                cityName
            )}</strong>
            <span>${escapeHtml(
                arrivalText
            )}</span>
        `;

        element.setAttribute(
            'data-city-id',
            prediction.cityId ||
            ''
        );

        element.setAttribute(
            'data-arrival-minutes',
            String(
                prediction.arrivalMinutes
            )
        );
    }

    function renderHighestRisk(
        summary,
        options
    ) {
        const dashboardState =
            ensureDashboardState();

        const element =
            dashboardState
                .elements
                .highestRisk;

        if (
            !element ||
            !options.updateRiskPanel
        ) {
            return;
        }

        const prediction =
            summary.highestRisk;

        if (!prediction) {
            element.textContent =
                options.language ===
                    'ar'
                    ? 'لا توجد خطورة'
                    : 'No risk detected';

            return;
        }

        const cityName =
            resolveDashboardCityName(
                prediction,
                options.language
            );

        const riskText =
            getUIText(
                prediction.riskLevel,
                options.language
            );

        element.innerHTML = `
            <strong>${escapeHtml(
                cityName
            )}</strong>
            <span>${escapeHtml(
                riskText
            )}</span>
        `;

        element.setAttribute(
            'data-risk-level',
            prediction.riskLevel
        );

        element.setAttribute(
            'data-city-id',
            prediction.cityId ||
            ''
        );
    }

    function renderAverageConfidence(
        summary,
        options
    ) {
        const dashboardState =
            ensureDashboardState();

        const element =
            dashboardState
                .elements
                .averageConfidence;

        if (!element) {
            return;
        }

        const value =
            formatNumber(
                summary.averageConfidence,
                0,
                options.language
            );

        element.textContent =
            `${value}%`;

        element.setAttribute(
            'data-confidence',
            String(
                summary.averageConfidence
            )
        );
    }

    function renderDashboardMetrics(
        summary,
        options = {}
    ) {
        const dashboardState =
            ensureDashboardState();

        const normalizedOptions =
            normalizeDashboardOptions(
                options
            );

        if (
            !normalizedOptions.enabled
        ) {
            return {
                rendered:
                    false,

                reason:
                    'dashboard_disabled'
            };
        }

        renderDashboardCounters(
            summary,
            normalizedOptions
        );

        renderNearestArrival(
            summary,
            normalizedOptions
        );

        renderHighestRisk(
            summary,
            normalizedOptions
        );

        renderAverageConfidence(
            summary,
            normalizedOptions
        );

        dashboardState.renderCount +=
            1;

        dashboardState.lastRenderAt =
            Date.now();

        dashboardState.lastRenderAtIso =
            new Date(
                dashboardState.lastRenderAt
            ).toISOString();

        return {
            rendered:
                true,

            renderCount:
                dashboardState.renderCount,

            renderedAt:
                dashboardState.lastRenderAt,

            renderedAtIso:
                dashboardState.lastRenderAtIso
        };
    }

    integrationApi
        .renderDashboardCounters =
        renderDashboardCounters;

    integrationApi
        .renderNearestArrival =
        renderNearestArrival;

    integrationApi
        .renderHighestRisk =
        renderHighestRisk;

    integrationApi
        .renderAverageConfidence =
        renderAverageConfidence;

    integrationApi
        .renderDashboardMetrics =
        renderDashboardMetrics;

    integrationApi.metadata = {
        ...integrationApi.metadata,

        currentPart:
            '2.2D-1C',

        nextPart:
            '2.2D-1D',

        status:
            'in_progress',

        productionReady:
            false,

        moduleClosed:
            true,

        capabilities: [
            ...new Set([
                ...(
                    Array.isArray(
                        integrationApi
                            .metadata
                            .capabilities
                    )
                        ? integrationApi
                            .metadata
                            .capabilities
                        : []
                ),

                'dashboard_counter_rendering',
                'nearest_arrival_rendering',
                'highest_risk_rendering',
                'average_confidence_rendering'
            ])
        ]
    };

    Object.assign(
        integrationApi._internals,
        {
            setDashboardElementText,
            resolveDashboardCityName,
            renderDashboardCounters,
            renderNearestArrival,
            renderHighestRisk,
            renderAverageConfidence
        }
    );

    log(
        'info',
        'Rain arrival integration Part 2.2D-1C loaded.'
    );
})(
    typeof globalThis !==
        'undefined'
        ? globalThis
        : (
            typeof window !==
                'undefined'
                ? window
                : this
        )
);

/**
 * RainGuard AI V32
 * Rain Arrival Integration Engine
 *
 * Part:
 * 2.2D-1D
 *
 * Responsibilities:
 * - Render dashboard summary text
 * - Render dashboard city list
 * - Synchronize dashboard from predictions
 * - Complete dashboard bridge section
 */

(function rainArrivalIntegrationV32DashboardSync(globalObject) {
    'use strict';

    if (
        !globalObject ||
        !globalObject.RainGuardAI ||
        !globalObject.RainGuardAI.V32 ||
        !globalObject.RainGuardAI.V32
            .rainArrivalIntegration
    ) {
        throw new Error(
            'Rain Arrival Integration Part 2.2D-1C must be loaded before Part 2.2D-1D.'
        );
    }

    const integrationApi =
        globalObject
            .RainGuardAI
            .V32
            .rainArrivalIntegration;

    const internal =
        integrationApi._internals;

    const {
        escapeHtml,
        formatNumber,
        formatArrivalDuration,
        getUIText,
        ensureDashboardState,
        normalizeDashboardOptions,
        resolveDashboardCityName,
        log
    } = internal;

    function buildDashboardSummaryText(
        summary,
        language
    ) {
        if (
            summary.totalCities ===
            0
        ) {
            return language ===
                'ar'
                ? 'لا توجد بيانات متاحة حاليًا.'
                : 'No data is currently available.';
        }

        const totalCities =
            formatNumber(
                summary.totalCities,
                0,
                language
            );

        const rainCities =
            formatNumber(
                summary.rainCities,
                0,
                language
            );

        const criticalCities =
            formatNumber(
                summary.criticalCities,
                0,
                language
            );

        if (
            language ===
            'ar'
        ) {
            return `تم تحليل ${totalCities} مدينة، مع توقع وصول المطر إلى ${rainCities} مدينة، منها ${criticalCities} مدن ذات خطورة مرتفعة.`;
        }

        return `${totalCities} cities analyzed, with rain expected in ${rainCities} cities, including ${criticalCities} high-risk cities.`;
    }

    function renderDashboardSummary(
        summary,
        options
    ) {
        const dashboardState =
            ensureDashboardState();

        const element =
            dashboardState
                .elements
                .summary;

        if (
            !element ||
            !options.updateSummary
        ) {
            return false;
        }

        const text =
            buildDashboardSummaryText(
                summary,
                options.language
            );

        element.textContent =
            text;

        element.setAttribute(
            'data-total-cities',
            String(
                summary.totalCities
            )
        );

        element.setAttribute(
            'data-rain-cities',
            String(
                summary.rainCities
            )
        );

        element.setAttribute(
            'data-critical-cities',
            String(
                summary.criticalCities
            )
        );

        return true;
    }

    function buildDashboardCityItemHtml(
        prediction,
        language
    ) {
        const cityName =
            resolveDashboardCityName(
                prediction,
                language
            );

        const riskText =
            getUIText(
                prediction.riskLevel,
                language
            );

        const arrivalText =
            Number.isFinite(
                prediction.arrivalMinutes
            )
                ? formatArrivalDuration(
                    prediction.arrivalMinutes,
                    language
                )
                : (
                    language ===
                        'ar'
                        ? 'غير محدد'
                        : 'Unknown'
                );

        const probability =
            formatNumber(
                prediction.probability,
                0,
                language
            );

        return `
            <button
                type="button"
                class="rain-arrival-dashboard-city"
                data-rain-arrival-dashboard-city-id="${escapeHtml(
                    prediction.cityId ||
                    ''
                )}"
                data-risk-level="${escapeHtml(
                    prediction.riskLevel
                )}"
            >
                <span class="rain-arrival-dashboard-city__name">
                    ${escapeHtml(
                        cityName
                    )}
                </span>

                <span class="rain-arrival-dashboard-city__arrival">
                    ${escapeHtml(
                        arrivalText
                    )}
                </span>

                <span class="rain-arrival-dashboard-city__risk">
                    ${escapeHtml(
                        riskText
                    )}
                </span>

                <span class="rain-arrival-dashboard-city__probability">
                    ${escapeHtml(
                        probability
                    )}%
                </span>
            </button>
        `;
    }

    function bindDashboardCityEvents(
        container
    ) {
        if (!container) {
            return;
        }

        container
            .querySelectorAll(
                '[data-rain-arrival-dashboard-city-id]'
            )
            .forEach(
                (element) => {
                    element.addEventListener(
                        'click',
                        () => {
                            const cityId =
                                element.getAttribute(
                                    'data-rain-arrival-dashboard-city-id'
                                );

                            if (
                                cityId &&
                                typeof integrationApi
                                    .selectCityCard ===
                                    'function'
                            ) {
                                integrationApi
                                    .selectCityCard(
                                        cityId,
                                        {
                                            scrollIntoView:
                                                true,

                                            focusMap:
                                                true
                                        }
                                    );
                            }
                        }
                    );
                }
            );
    }

    function renderDashboardCityList(
        summary,
        options
    ) {
        const dashboardState =
            ensureDashboardState();

        const container =
            dashboardState
                .elements
                .cityList;

        if (!container) {
            return {
                rendered:
                    false,

                reason:
                    'city_list_element_missing'
            };
        }

        const predictions =
            summary.rainPredictions ||
            [];

        if (
            predictions.length ===
            0
        ) {
            container.innerHTML = `
                <div class="rain-arrival-dashboard-city-list__empty">
                    ${escapeHtml(
                        options.language ===
                            'ar'
                            ? 'لا توجد مدن متأثرة حاليًا.'
                            : 'No affected cities are currently available.'
                    )}
                </div>
            `;

            return {
                rendered:
                    true,

                cityCount:
                    0
            };
        }

        container.innerHTML =
            predictions
                .map(
                    (prediction) =>
                        buildDashboardCityItemHtml(
                            prediction,
                            options.language
                        )
                )
                .join('');

        bindDashboardCityEvents(
            container
        );

        return {
            rendered:
                true,

            cityCount:
                predictions.length
        };
    }

    function synchronizeDashboard(
        predictions,
        options = {}
    ) {
        const dashboardState =
            ensureDashboardState();

        const normalizedOptions =
            normalizeDashboardOptions(
                options
            );

        if (
            !normalizedOptions.enabled
        ) {
            return {
                synchronized:
                    false,

                reason:
                    'dashboard_disabled'
            };
        }

        if (
            normalizedOptions.autoDiscover &&
            (
                !dashboardState.discovered ||
                !dashboardState.elements
            )
        ) {
            integrationApi
                .discoverDashboardElements(
                    normalizedOptions
                );
        }

        try {
            const summary =
                integrationApi
                    .buildDashboardSummary(
                        predictions,
                        normalizedOptions
                    );

            const metricsResult =
                integrationApi
                    .renderDashboardMetrics(
                        summary,
                        normalizedOptions
                    );

            const summaryRendered =
                renderDashboardSummary(
                    summary,
                    normalizedOptions
                );

            const cityListResult =
                renderDashboardCityList(
                    summary,
                    normalizedOptions
                );

            dashboardState.lastSummary =
                summary;

            return {
                synchronized:
                    true,

                summary,

                metrics:
                    metricsResult,

                summaryRendered,

                cityList:
                    cityListResult
            };
        } catch (error) {
            dashboardState.renderFailures +=
                1;

            log(
                'error',
                'Dashboard synchronization failed.',
                {
                    error:
                        error &&
                        error.message
                            ? error.message
                            : String(
                                error
                            )
                }
            );

            return {
                synchronized:
                    false,

                reason:
                    'dashboard_render_failed',

                error:
                    error &&
                    error.message
                        ? error.message
                        : String(
                            error
                        )
            };
        }
    }

    function refreshDashboard(
        options = {}
    ) {
        let predictions = [];

        if (
            typeof integrationApi
                .getLatestPredictions ===
                'function'
        ) {
            predictions =
                integrationApi
                    .getLatestPredictions() ||
                [];
        } else if (
            Array.isArray(
                integrationApi
                    ._state
                    .latestPredictions
            )
        ) {
            predictions =
                integrationApi
                    ._state
                    .latestPredictions;
        }

        return synchronizeDashboard(
            predictions,
            options
        );
    }

    integrationApi
        .buildDashboardSummaryText =
        buildDashboardSummaryText;

    integrationApi
        .renderDashboardSummary =
        renderDashboardSummary;

    integrationApi
        .renderDashboardCityList =
        renderDashboardCityList;

    integrationApi
        .synchronizeDashboard =
        synchronizeDashboard;

    integrationApi
        .refreshDashboard =
        refreshDashboard;

    integrationApi.metadata = {
        ...integrationApi.metadata,

        currentPart:
            '2.2D-1D',

        nextPart:
            '2.2D-2A',

        status:
            'section_complete',

        productionReady:
            false,

        moduleClosed:
            true,

        capabilities: [
            ...new Set([
                ...(
                    Array.isArray(
                        integrationApi
                            .metadata
                            .capabilities
                    )
                        ? integrationApi
                            .metadata
                            .capabilities
                        : []
                ),

                'dashboard_summary_rendering',
                'dashboard_city_list_rendering',
                'dashboard_city_navigation',
                'dashboard_prediction_synchronization',
                'dashboard_manual_refresh'
            ])
        ]
    };

    Object.assign(
        integrationApi._internals,
        {
            buildDashboardSummaryText,
            buildDashboardCityItemHtml,
            bindDashboardCityEvents,
            renderDashboardSummary,
            renderDashboardCityList
        }
    );

    try {
        if (
            ensureDashboardState()
                .options
                .autoRender
        ) {
            refreshDashboard();
        }
    } catch (error) {
        log(
            'debug',
            'Initial dashboard refresh failed.',
            {
                part:
                    '2.2D-1D',

                error:
                    error &&
                    error.message
                        ? error.message
                        : String(
                            error
                        )
            }
        );
    }

    log(
        'info',
        'Rain arrival integration Part 2.2D-1D loaded.'
    );
})(
    typeof globalThis !==
        'undefined'
        ? globalThis
        : (
            typeof window !==
                'undefined'
                ? window
                : this
        )
);

/**
 * RainGuard AI V32
 * Rain Arrival Integration Engine
 *
 * Part:
 * 2.2D-2A
 *
 * Responsibilities:
 * - Install dashboard event bridge
 * - Synchronize dashboard on prediction updates
 * - Synchronize dashboard on language changes
 * - Prevent duplicate event listeners
 */

(function rainArrivalIntegrationV32DashboardEvents(globalObject) {
    'use strict';

    if (
        !globalObject ||
        !globalObject.RainGuardAI ||
        !globalObject.RainGuardAI.V32 ||
        !globalObject.RainGuardAI.V32
            .rainArrivalIntegration
    ) {
        throw new Error(
            'Rain Arrival Integration Part 2.2D-1D must be loaded before Part 2.2D-2A.'
        );
    }

    const integrationApi =
        globalObject
            .RainGuardAI
            .V32
            .rainArrivalIntegration;

    const runtimeState =
        integrationApi._state;

    const internal =
        integrationApi._internals;

    const {
        ensureDashboardState,
        normalizeDashboardOptions,
        normalizeError,
        log
    } = internal;

    const DASHBOARD_EVENT_NAMES =
        Object.freeze({
            predictionsUpdated:
                'rainguard:rain-arrival:predictions-updated',

            predictionReady:
                'rainguard:rain-arrival:prediction-ready',

            cityUpdated:
                'rainguard:rain-arrival:city-updated',

            languageChanged:
                'rainguard:language-changed',

            dashboardRefresh:
                'rainguard:rain-arrival:dashboard-refresh'
        });

    function ensureDashboardEventState() {
        const dashboardState =
            ensureDashboardState();

        if (
            !dashboardState.events ||
            typeof dashboardState.events !==
                'object'
        ) {
            dashboardState.events = {
                installed:
                    false,

                listeners:
                    [],

                receivedEvents:
                    0,

                failedEvents:
                    0,

                lastEventName:
                    null,

                lastEventAt:
                    null
            };
        }

        return dashboardState.events;
    }

    function extractPredictionsFromEvent(
        event
    ) {
        const detail =
            event &&
            event.detail &&
            typeof event.detail ===
                'object'
                ? event.detail
                : {};

        if (
            Array.isArray(
                detail.predictions
            )
        ) {
            return detail.predictions;
        }

        if (
            Array.isArray(
                detail.results
            )
        ) {
            return detail.results;
        }

        if (
            Array.isArray(
                detail.cities
            )
        ) {
            return detail.cities;
        }

        if (
            detail.prediction &&
            typeof detail.prediction ===
                'object'
        ) {
            return [
                detail.prediction
            ];
        }

        return null;
    }

    function resolveDashboardPredictions(
        event
    ) {
        const eventPredictions =
            extractPredictionsFromEvent(
                event
            );

        if (
            Array.isArray(
                eventPredictions
            )
        ) {
            return eventPredictions;
        }

        if (
            typeof integrationApi
                .getLatestPredictions ===
                'function'
        ) {
            const predictions =
                integrationApi
                    .getLatestPredictions();

            if (
                Array.isArray(
                    predictions
                )
            ) {
                return predictions;
            }
        }

        if (
            Array.isArray(
                runtimeState.latestPredictions
            )
        ) {
            return runtimeState
                .latestPredictions;
        }

        return [];
    }

    function handleDashboardEvent(
        event
    ) {
        const eventState =
            ensureDashboardEventState();

        eventState.receivedEvents +=
            1;

        eventState.lastEventName =
            event &&
            event.type
                ? event.type
                : 'unknown';

        eventState.lastEventAt =
            Date.now();

        try {
            const predictions =
                resolveDashboardPredictions(
                    event
                );

            return integrationApi
                .synchronizeDashboard(
                    predictions
                );
        } catch (error) {
            eventState.failedEvents +=
                1;

            log(
                'error',
                'Dashboard event synchronization failed.',
                {
                    eventName:
                        eventState
                            .lastEventName,

                    error:
                        normalizeError(
                            error
                        )
                }
            );

            return {
                synchronized:
                    false,

                reason:
                    'dashboard_event_failed'
            };
        }
    }

    function handleDashboardLanguageChange(
        event
    ) {
        const detail =
            event &&
            event.detail &&
            typeof event.detail ===
                'object'
                ? event.detail
                : {};

        normalizeDashboardOptions({
            language:
                detail.language ||
                detail.lang ||
                null
        });

        return handleDashboardEvent(
            event
        );
    }

    function registerDashboardListener(
        target,
        eventName,
        handler
    ) {
        const eventState =
            ensureDashboardEventState();

        if (
            !target ||
            typeof target.addEventListener !==
                'function'
        ) {
            return false;
        }

        target.addEventListener(
            eventName,
            handler
        );

        eventState.listeners.push({
            target,
            eventName,
            handler
        });

        return true;
    }

    function installDashboardEventBridge() {
        const eventState =
            ensureDashboardEventState();

        if (
            eventState.installed
        ) {
            return {
                installed:
                    true,

                reused:
                    true,

                listenerCount:
                    eventState
                        .listeners
                        .length
            };
        }

        const documentTarget =
            typeof globalObject.document !==
                'undefined'
                ? globalObject.document
                : null;

        const windowTarget =
            typeof globalObject.addEventListener ===
                'function'
                ? globalObject
                : null;

        registerDashboardListener(
            documentTarget,
            DASHBOARD_EVENT_NAMES
                .predictionsUpdated,
            handleDashboardEvent
        );

        registerDashboardListener(
            documentTarget,
            DASHBOARD_EVENT_NAMES
                .predictionReady,
            handleDashboardEvent
        );

        registerDashboardListener(
            documentTarget,
            DASHBOARD_EVENT_NAMES
                .cityUpdated,
            handleDashboardEvent
        );

        registerDashboardListener(
            documentTarget,
            DASHBOARD_EVENT_NAMES
                .dashboardRefresh,
            handleDashboardEvent
        );

        registerDashboardListener(
            documentTarget,
            DASHBOARD_EVENT_NAMES
                .languageChanged,
            handleDashboardLanguageChange
        );

        registerDashboardListener(
            windowTarget,
            DASHBOARD_EVENT_NAMES
                .predictionsUpdated,
            handleDashboardEvent
        );

        registerDashboardListener(
            windowTarget,
            DASHBOARD_EVENT_NAMES
                .languageChanged,
            handleDashboardLanguageChange
        );

        eventState.installed =
            eventState.listeners.length >
            0;

        return {
            installed:
                eventState.installed,

            reused:
                false,

            listenerCount:
                eventState
                    .listeners
                    .length
        };
    }

    function removeDashboardEventBridge() {
        const eventState =
            ensureDashboardEventState();

        for (
            const listener
            of eventState.listeners
        ) {
            try {
                listener.target
                    .removeEventListener(
                        listener.eventName,
                        listener.handler
                    );
            } catch (error) {
                log(
                    'debug',
                    'Dashboard event listener removal failed.',
                    {
                        eventName:
                            listener.eventName,

                        error:
                            normalizeError(
                                error
                            )
                    }
                );
            }
        }

        const removedCount =
            eventState.listeners.length;

        eventState.listeners =
            [];

        eventState.installed =
            false;

        return {
            removed:
                true,

            removedCount
        };
    }

    function getDashboardEventStatus() {
        const eventState =
            ensureDashboardEventState();

        return {
            installed:
                eventState.installed,

            listenerCount:
                eventState
                    .listeners
                    .length,

            receivedEvents:
                eventState
                    .receivedEvents,

            failedEvents:
                eventState
                    .failedEvents,

            lastEventName:
                eventState
                    .lastEventName,

            lastEventAt:
                eventState
                    .lastEventAt
        };
    }

    integrationApi
        .installDashboardEventBridge =
        installDashboardEventBridge;

    integrationApi
        .removeDashboardEventBridge =
        removeDashboardEventBridge;

    integrationApi
        .handleDashboardEvent =
        handleDashboardEvent;

    integrationApi
        .getDashboardEventStatus =
        getDashboardEventStatus;

    integrationApi.metadata = {
        ...integrationApi.metadata,

        currentPart:
            '2.2D-2A',

        nextPart:
            '2.2D-2B',

        status:
            'in_progress',

        productionReady:
            false,

        moduleClosed:
            true,

        capabilities: [
            ...new Set([
                ...(
                    Array.isArray(
                        integrationApi
                            .metadata
                            .capabilities
                    )
                        ? integrationApi
                            .metadata
                            .capabilities
                        : []
                ),

                'dashboard_event_bridge',
                'dashboard_prediction_event_sync',
                'dashboard_language_event_sync',
                'dashboard_listener_lifecycle'
            ])
        ]
    };

    Object.assign(
        integrationApi._internals,
        {
            DASHBOARD_EVENT_NAMES,
            ensureDashboardEventState,
            extractPredictionsFromEvent,
            resolveDashboardPredictions,
            handleDashboardLanguageChange,
            registerDashboardListener
        }
    );

    try {
        installDashboardEventBridge();
    } catch (error) {
        log(
            'debug',
            'Dashboard event bridge initialization failed.',
            {
                part:
                    '2.2D-2A',

                error:
                    normalizeError(
                        error
                    )
            }
        );
    }

    log(
        'info',
        'Rain arrival integration Part 2.2D-2A loaded.'
    );
})(
    typeof globalThis !==
        'undefined'
        ? globalThis
        : (
            typeof window !==
                'undefined'
                ? window
                : this
        )
);

/**
 * RainGuard AI V32
 * Rain Arrival Integration Engine
 *
 * Part:
 * 2.2D-2B
 *
 * Responsibilities:
 * - Auto refresh scheduler
 * - Visibility handling
 * - Online / Offline synchronization
 * - Refresh throttling
 */

(function rainArrivalIntegrationV32DashboardScheduler(globalObject) {
    'use strict';

    if (
        !globalObject ||
        !globalObject.RainGuardAI ||
        !globalObject.RainGuardAI.V32 ||
        !globalObject.RainGuardAI.V32
            .rainArrivalIntegration
    ) {
        throw new Error(
            'Rain Arrival Integration Part 2.2D-2A must be loaded first.'
        );
    }

    const integrationApi =
        globalObject
            .RainGuardAI
            .V32
            .rainArrivalIntegration;

    const runtimeState =
        integrationApi._state;

    const internal =
        integrationApi._internals;

    const {
        ensureDashboardState,
        normalizeError,
        log
    } = internal;

    const DEFAULT_REFRESH_INTERVAL =
        60000;

    const DEFAULT_MIN_REFRESH_DELAY =
        5000;

    function ensureSchedulerState() {
        const dashboard =
            ensureDashboardState();

        if (!dashboard.scheduler) {
            dashboard.scheduler = {
                timer: null,
                interval:
                    DEFAULT_REFRESH_INTERVAL,
                enabled: true,
                lastRefresh: 0,
                refreshCount: 0
            };
        }

        return dashboard.scheduler;
    }

    function canRefreshNow() {
        const scheduler =
            ensureSchedulerState();

        return (
            Date.now() -
            scheduler.lastRefresh
        ) >=
        DEFAULT_MIN_REFRESH_DELAY;
    }

    function executeRefresh(reason) {
        const scheduler =
            ensureSchedulerState();

        if (!scheduler.enabled) {
            return false;
        }

        if (!canRefreshNow()) {
            return false;
        }

        scheduler.lastRefresh =
            Date.now();

        scheduler.refreshCount++;

        try {
            integrationApi.refreshDashboard({
                reason
            });

            return true;
        } catch (error) {
            log(
                'error',
                'Dashboard refresh failed.',
                {
                    reason,
                    error:
                        normalizeError(
                            error
                        )
                }
            );

            return false;
        }
    }

    function startDashboardScheduler(
        interval =
            DEFAULT_REFRESH_INTERVAL
    ) {
        const scheduler =
            ensureSchedulerState();

        stopDashboardScheduler();

        scheduler.interval =
            interval;

        scheduler.timer =
            globalObject.setInterval(
                () => {
                    executeRefresh(
                        'timer'
                    );
                },
                scheduler.interval
            );

        return true;
    }

    function stopDashboardScheduler() {
        const scheduler =
            ensureSchedulerState();

        if (
            scheduler.timer
        ) {
            clearInterval(
                scheduler.timer
            );

            scheduler.timer =
                null;
        }

        return true;
    }

    function handleVisibilityChange() {
        if (
            typeof document ===
            'undefined'
        ) {
            return;
        }

        if (
            document.visibilityState ===
            'visible'
        ) {
            executeRefresh(
                'visibility'
            );
        }
    }

    function handleConnectionRestore() {
        executeRefresh(
            'online'
        );
    }

    function installSchedulerEvents() {

        if (
            typeof document !==
            'undefined'
        ) {
            document.addEventListener(
                'visibilitychange',
                handleVisibilityChange
            );
        }

        globalObject.addEventListener(
            'online',
            handleConnectionRestore
        );

        return true;
    }

    function getSchedulerStatus() {

        const scheduler =
            ensureSchedulerState();

        return {
            enabled:
                scheduler.enabled,

            interval:
                scheduler.interval,

            refreshCount:
                scheduler.refreshCount,

            lastRefresh:
                scheduler.lastRefresh,

            running:
                Boolean(
                    scheduler.timer
                )
        };
    }

    integrationApi.startDashboardScheduler =
        startDashboardScheduler;

    integrationApi.stopDashboardScheduler =
        stopDashboardScheduler;

    integrationApi.getDashboardSchedulerStatus =
        getSchedulerStatus;

    integrationApi.executeDashboardRefresh =
        executeRefresh;

    integrationApi.metadata = {
        ...integrationApi.metadata,

        currentPart:
            '2.2D-2B',

        nextPart:
            '2.2E-1A',

        status:
            'section_complete',

        productionReady:
            false,

        moduleClosed:
            true
    };

    installSchedulerEvents();

    startDashboardScheduler();

    log(
        'info',
        'Rain arrival integration Part 2.2D-2B loaded.'
    );

})(
    typeof globalThis !==
    'undefined'
        ? globalThis
        : window
);

