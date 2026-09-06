/*
===============================================================================
 RainGuard AI V32
 Storm Entity Collector — Restored Compatible Core
 Version: 32.38M.13-R1-MEMSAFE-1
===============================================================================
*/

(function initializeRainArrivalStormEntityCollector(global) {
    "use strict";

    const MODULE_NAME = "stormEntityCollector";
    const VERSION = "32.38M.13-R1-MEMSAFE-1";
    const BUILD =
        "rainguard-v32-phase38m-storm-entity-collector-restored-memory-safe";

    const now = () => Date.now();

    const DEFAULT_CONFIG = {
        autoStart: true,

        // Memory-safe collection cadence
        collectionIntervalMs: 10000,

        // Hard in-memory retention ceiling
        maximumEntities: 500,

        // Maximum entities returned by getAll()
        maximumReadEntities: 100,

        debug: true
    };

    function cloneValue(value) {
        if (value === null || value === undefined) {
            return value;
        }

        try {
            if (typeof structuredClone === "function") {
                return structuredClone(value);
            }
        } catch (_) {}

        try {
            return JSON.parse(JSON.stringify(value));
        } catch (_) {
            return value;
        }
    }

    function safeArray(value) {
        if (!value) {
            return [];
        }

        if (Array.isArray(value)) {
            return value;
        }

        if (
            value instanceof Map ||
            value instanceof Set
        ) {
            return Array.from(value.values());
        }

        try {
            if (typeof value.values === "function") {
                return Array.from(value.values());
            }
        } catch (_) {}

        return [];
    }

    function finite(value) {
        const n = Number(value);

        return Number.isFinite(n)
            ? n
            : null;
    }

    function normalizeTimestamp(value) {
        const n = finite(value);

        if (n !== null) {
            return n < 1e10
                ? n * 1000
                : n;
        }

        const parsed = Date.parse(value);

        return Number.isFinite(parsed)
            ? parsed
            : now();
    }

    function normalizeEntity(
        raw,
        sourceName = "unknown"
    ) {
        if (
            !raw ||
            typeof raw !== "object"
        ) {
            return null;
        }

        const id =
            raw.id ??
            raw.trackId ??
            raw.cellId ??
            raw.stormId ??
            raw.entityId ??
            raw.uuid ??
            null;

        const latitude = finite(
            raw.latitude ??
            raw.lat ??
            raw.center?.latitude ??
            raw.center?.lat
        );

        const longitude = finite(
            raw.longitude ??
            raw.lon ??
            raw.lng ??
            raw.center?.longitude ??
            raw.center?.lon ??
            raw.center?.lng
        );

        if (
            !id &&
            latitude === null &&
            longitude === null &&
            !raw.motion &&
            !raw.path &&
            !raw.predictedPath
        ) {
            return null;
        }

        const timestamp =
            normalizeTimestamp(
                raw.timestamp ??
                raw.updatedAt ??
                raw.generatedAt ??
                raw.detectedAt ??
                raw.observedAt ??
                now()
            );

        return {
            ...raw,

            id: String(
                id ??
                `${sourceName}:` +
                `${latitude ?? "na"}:` +
                `${longitude ?? "na"}:` +
                `${Math.floor(timestamp / 10000)}`
            ),

            source:
                raw.source ??
                sourceName,

            latitude,
            longitude,
            timestamp,

            collectedAt: now()
        };
    }

    class StormEntityCollector {
        constructor(config = {}) {
            this.version = VERSION;
            this.build = BUILD;

            this.config = {
                ...DEFAULT_CONFIG,
                ...config
            };

            this.entities = new Map();

            this.running = false;
            this.timer = null;
            this.syncRunning = false;

            this.lastSourceReport = null;
            this.lastResult = null;
            this.lastError = null;

            this.createdAt = now();
            this.updatedAt = this.createdAt;

            this.statistics = {
                collections: 0,
                discovered: 0,
                stored: 0,
                bridgeSyncs: 0,
                failures: 0,
                emptyCollections: 0,

                // Memory safety counters
                trimmedEntities: 0,
                boundedReads: 0
            };
        }

        log(message, data) {
            if (!this.config.debug) {
                return;
            }

            console.log(
                `[RainArrival StormEntityCollector] ${message}`,
                data ?? ""
            );
        }

        getBridge() {
            return (
                global
                    .RainArrivalStormTrackStoreBridgeV32 ||

                global
                    .RainGuardAI
                    ?.V32
                    ?.rainArrivalModules
                    ?.stormTrackStoreBridge ||

                null
            );
        }

        collectSources() {
            return [
                [
                    "liveStormExportBridge",
                    global
                        .RainArrivalLiveStormExportBridgeV32
                ],

                [
                    "stormTrackStoreBridge",
                    global
                        .RainArrivalStormTrackStoreBridgeV32
                ],

                [
                    "stormCellTracking",
                    global
                        .RainGuardStormCellTrackingEngineV31 ??
                    global
                        .RainGuardAI
                        ?.V31
                        ?.stormCellTrackingEngine
                ],

                [
                    "stormPathPrediction",
                    global
                        .RainGuardStormPathPredictionEngineV31 ??
                    global
                        .RainGuardAI
                        ?.V31
                        ?.stormPathPredictionEngine
                ],

                [
                    "rainArrivalEngine",
                    global
                        .RainArrivalEngineV32
                ],

                [
                    "rainGuardV32",
                    global
                        .RainGuardAI
                        ?.V32
                ]
            ].filter(
                ([, value]) =>
                    Boolean(value)
            );
        }

        extractSourceEntities(value) {
            if (!value) {
                return [];
            }

            const candidates = [];

            const append = (v) => {
                if (v) {
                    candidates.push(v);
                }
            };

            for (
                const methodName of [
                    "getAll",
                    "getEntities",
                    "getTracks",
                    "getActive",
                    "getActiveTracks",
                    "getStorms",
                    "getCells",
                    "getLatest",
                    "export"
                ]
            ) {
                if (
                    typeof value?.[methodName] !==
                    "function"
                ) {
                    continue;
                }

                try {
                    /*
                     * Memory-safe preference:
                     * when calling getAll(), request bounded data
                     * if the implementation accepts a limit.
                     */
                    const result =
                        methodName === "getAll"
                            ? value[methodName](
                                this.config
                                    .maximumReadEntities
                            )
                            : value[methodName]();

                    /*
                     * Skip asynchronous sources here.
                     */
                    if (
                        result &&
                        typeof result.then ===
                        "function"
                    ) {
                        continue;
                    }

                    append(result);
                } catch (_) {}
            }

            const keys = [
                "entities",
                "stormEntities",
                "liveStormEntities",

                "tracks",
                "activeTracks",
                "stormTracks",

                "cells",
                "activeCells",
                "stormCells",

                "items",
                "results",
                "predictions",
                "paths",
                "predictedPaths",
                "candidates",

                "data",
                "payload",
                "output",

                "lastResult",
                "lastOutput"
            ];

            for (const key of keys) {
                append(value?.[key]);
            }

            const flattened = [];

            const max =
                this.config
                    .maximumReadEntities;

            for (const candidate of candidates) {
                if (
                    flattened.length >=
                    max
                ) {
                    break;
                }

                if (Array.isArray(candidate)) {
                    const remaining =
                        max -
                        flattened.length;

                    flattened.push(
                        ...candidate.slice(
                            0,
                            remaining
                        )
                    );

                    continue;
                }

                if (
                    candidate instanceof Map ||
                    candidate instanceof Set
                ) {
                    const remaining =
                        max -
                        flattened.length;

                    flattened.push(
                        ...Array.from(
                            candidate.values()
                        ).slice(
                            0,
                            remaining
                        )
                    );

                    continue;
                }

                if (
                    candidate &&
                    typeof candidate ===
                    "object"
                ) {
                    for (const key of keys) {
                        if (
                            flattened.length >=
                            max
                        ) {
                            break;
                        }

                        const nested =
                            candidate[key];

                        if (Array.isArray(nested)) {
                            const remaining =
                                max -
                                flattened.length;

                            flattened.push(
                                ...nested.slice(
                                    0,
                                    remaining
                                )
                            );
                        } else if (
                            nested instanceof Map ||
                            nested instanceof Set
                        ) {
                            const remaining =
                                max -
                                flattened.length;

                            flattened.push(
                                ...Array.from(
                                    nested.values()
                                ).slice(
                                    0,
                                    remaining
                                )
                            );
                        }
                    }
                }
            }

            return flattened;
        }

        collect() {
            const startedAt = now();

            const discovered = [];
            const seen = new Set();
            const sourceReports = [];

            try {
                for (
                    const [
                        sourceName,
                        sourceValue
                    ] of this.collectSources()
                ) {
                    let items = [];

                    try {
                        items =
                            this.extractSourceEntities(
                                sourceValue
                            );
                    } catch (error) {
                        sourceReports.push({
                            source: sourceName,
                            success: false,
                            count: 0,

                            error:
                                error?.message ??
                                String(error)
                        });

                        continue;
                    }

                    const boundedItems =
                        safeArray(items).slice(
                            0,
                            this.config
                                .maximumReadEntities
                        );

                    for (
                        const raw of boundedItems
                    ) {
                        const entity =
                            normalizeEntity(
                                raw,
                                sourceName
                            );

                        if (
                            !entity ||
                            seen.has(entity.id)
                        ) {
                            continue;
                        }

                        seen.add(entity.id);

                        discovered.push(
                            entity
                        );

                        if (
                            discovered.length >=
                            this.config
                                .maximumEntities
                        ) {
                            break;
                        }
                    }

                    sourceReports.push({
                        source:
                            sourceName,

                        success:
                            true,

                        count:
                            boundedItems.length
                    });

                    if (
                        discovered.length >=
                        this.config
                            .maximumEntities
                    ) {
                        break;
                    }
                }

                /*
                 * Store bounded entities.
                 */
                for (const entity of discovered) {
                    this.entities.set(
                        entity.id,
                        entity
                    );
                }

                /*
                 * Memory retention guard.
                 */
                if (
                    this.entities.size >
                    this.config.maximumEntities
                ) {
                    const before =
                        this.entities.size;

                    const kept =
                        Array.from(
                            this.entities.values()
                        )
                        .sort(
                            (a, b) =>
                                (b.timestamp ?? 0) -
                                (a.timestamp ?? 0)
                        )
                        .slice(
                            0,
                            this.config
                                .maximumEntities
                        );

                    this.entities.clear();

                    for (const entity of kept) {
                        this.entities.set(
                            entity.id,
                            entity
                        );
                    }

                    this.statistics
                        .trimmedEntities +=
                        before -
                        this.entities.size;
                }

                this.statistics
                    .collections += 1;

                this.statistics
                    .discovered +=
                    discovered.length;

                this.statistics
                    .stored =
                    this.entities.size;

                if (!discovered.length) {
                    this.statistics
                        .emptyCollections += 1;
                }

                this.updatedAt =
                    now();

                this.lastSourceReport = {
                    generatedAt:
                        this.updatedAt,

                    sources:
                        sourceReports
                };

                /*
                 * IMPORTANT:
                 * only bounded entities are returned.
                 */
                const result = {
                    success: true,

                    status:
                        discovered.length
                            ? "STORM_ENTITIES_FOUND"
                            : "NO_STORM_ENTITIES_FOUND",

                    version:
                        VERSION,

                    build:
                        BUILD,

                    sourceCount:
                        sourceReports.length,

                    discoveredCount:
                        discovered.length,

                    storedCount:
                        this.entities.size,

                    entities:
                        discovered.slice(
                            0,
                            this.config
                                .maximumReadEntities
                        ),

                    sourceReports,

                    durationMs:
                        now() -
                        startedAt,

                    generatedAt:
                        this.updatedAt
                };

                /*
                 * Keep lastResult compact.
                 */
                this.lastResult = {
                    success:
                        result.success,

                    status:
                        result.status,

                    version:
                        result.version,

                    build:
                        result.build,

                    sourceCount:
                        result.sourceCount,

                    discoveredCount:
                        result.discoveredCount,

                    storedCount:
                        result.storedCount,

                    sourceReports:
                        cloneValue(
                            result.sourceReports
                        ),

                    durationMs:
                        result.durationMs,

                    generatedAt:
                        result.generatedAt
                };

                this.lastError =
                    null;

                this.log(
                    "Collection result:",
                    {
                        success:
                            result.success,

                        status:
                            result.status,

                        discoveredCount:
                            result
                                .discoveredCount,

                        storedCount:
                            result
                                .storedCount,

                        sourceCount:
                            result
                                .sourceCount,

                        durationMs:
                            result
                                .durationMs
                    }
                );

                return result;

            } catch (error) {
                const failure = {
                    name:
                        error?.name ??
                        "Error",

                    message:
                        error?.message ??
                        String(error),

                    stack:
                        typeof error?.stack ===
                        "string"
                            ? error.stack.slice(
                                0,
                                3000
                            )
                            : null,

                    timestamp:
                        now()
                };

                this.lastError =
                    failure;

                this.statistics
                    .failures += 1;

                const result = {
                    success: false,

                    status:
                        "STORM_ENTITY_COLLECTION_FAILED",

                    version:
                        VERSION,

                    build:
                        BUILD,

                    sourceCount:
                        0,

                    discoveredCount:
                        0,

                    storedCount:
                        this.entities.size,

                    entities:
                        [],

                    sourceReports:
                        [],

                    error:
                        failure,

                    generatedAt:
                        now()
                };

                this.lastResult = {
                    ...result,
                    entities: []
                };

                console.error(
                    "[RainArrival StormEntityCollector] Collection failed.",
                    failure
                );

                return result;
            }
        }

        installBridgeAdapter() {
            const bridge =
                this.getBridge();

            if (!bridge) {
                return {
                    success: false,

                    reason:
                        "STORM_TRACKSTORE_BRIDGE_UNAVAILABLE"
                };
            }

            if (
                bridge
                    .__collectorAdapterInstalled &&
                bridge
                    .stormEntityCollector ===
                    this
            ) {
                return {
                    success: true,
                    installed: true,
                    alreadyInstalled: true
                };
            }

            const originalDiscover =
                typeof bridge.discover ===
                "function"
                    ? bridge.discover.bind(
                        bridge
                    )
                    : null;

            bridge.discover = () => {
                const collected =
                    this.collect();

                const entities =
                    Array.isArray(
                        collected?.entities
                    )
                        ? collected.entities.slice(
                            0,
                            this.config
                                .maximumReadEntities
                        )
                        : [];

                if (
                    entities.length >
                    0
                ) {
                    return entities;
                }

                if (!originalDiscover) {
                    return [];
                }

                try {
                    const fallback =
                        originalDiscover();

                    return Array.isArray(
                        fallback
                    )
                        ? fallback.slice(
                            0,
                            this.config
                                .maximumReadEntities
                        )
                        : [];
                } catch (error) {
                    this.lastError = {
                        name:
                            error?.name ??
                            "Error",

                        message:
                            error?.message ??
                            String(error),

                        stack:
                            typeof error?.stack ===
                            "string"
                                ? error.stack.slice(
                                    0,
                                    3000
                                )
                                : null,

                        timestamp:
                            now()
                    };

                    return [];
                }
            };

            bridge
                .__collectorAdapterInstalled =
                true;

            bridge
                .stormEntityCollector =
                this;

            return {
                success: true,
                installed: true
            };
        }

        async collectAndSync() {
            if (this.syncRunning) {
                return {
                    success: true,
                    skipped: true,

                    status:
                        "COLLECTION_SYNC_ALREADY_RUNNING",

                    generatedAt:
                        now()
                };
            }

            this.syncRunning =
                true;

            try {
                const collection =
                    this.collect();

                const bridge =
                    this.getBridge();

                if (
                    !bridge ||
                    typeof bridge.sync !==
                    "function"
                ) {
                    return {
                        success: false,

                        reason:
                            "STORM_TRACKSTORE_BRIDGE_UNAVAILABLE",

                        collection
                    };
                }

                this.installBridgeAdapter();

                const syncResult =
                    await Promise.resolve(
                        bridge.sync()
                    );

                this.statistics
                    .bridgeSyncs += 1;

                return {
                    success:
                        Boolean(
                            syncResult?.success
                        ),

                    status:
                        "COLLECTION_AND_SYNC_COMPLETED",

                    collection,

                    syncResult,

                    generatedAt:
                        now()
                };

            } catch (error) {
                this.lastError = {
                    name:
                        error?.name ??
                        "Error",

                    message:
                        error?.message ??
                        String(error),

                    stack:
                        typeof error?.stack ===
                        "string"
                            ? error.stack.slice(
                                0,
                                3000
                            )
                            : null,

                    timestamp:
                        now()
                };

                this.statistics
                    .failures += 1;

                return {
                    success: false,

                    status:
                        "COLLECTION_AND_SYNC_FAILED",

                    error:
                        cloneValue(
                            this.lastError
                        ),

                    generatedAt:
                        now()
                };

            } finally {
                this.syncRunning =
                    false;
            }
        }

        /*
         * MEMORY SAFE getAll()
         *
         * Old behavior:
         * Array.from(this.entities.values()).map(cloneValue)
         *
         * That cloned the complete entity registry.
         */
        getAll(
            limit =
                this.config
                    .maximumReadEntities
        ) {
            const fallback =
                this.config
                    .maximumReadEntities;

            const requested =
                Number(limit);

            const safeLimit =
                Math.max(
                    1,
                    Math.min(
                        Number.isFinite(
                            requested
                        )
                            ? requested
                            : fallback,

                        250
                    )
                );

            const values =
                Array.from(
                    this.entities.values()
                );

            const start =
                Math.max(
                    0,
                    values.length -
                    safeLimit
                );

            const selected =
                values.slice(start);

            this.statistics
                .boundedReads += 1;

            /*
             * Shallow bounded objects only.
             * No structuredClone here.
             */
            return selected.map(
                entity => {
                    if (
                        !entity ||
                        typeof entity !==
                        "object"
                    ) {
                        return entity;
                    }

                    return {
                        ...entity
                    };
                }
            );
        }

        clear() {
            this.entities.clear();

            this.statistics
                .stored =
                0;

            return {
                success: true,
                storedCount: 0
            };
        }

        start() {
            if (
                this.running &&
                this.timer
            ) {
                return {
                    success: true,
                    alreadyRunning: true,
                    running: true,

                    intervalMs:
                        this.config
                            .collectionIntervalMs
                };
            }

            if (this.timer) {
                try {
                    global.clearInterval(
                        this.timer
                    );
                } catch (_) {}

                this.timer =
                    null;
            }

            this.running =
                true;

            this.installBridgeAdapter();

            Promise.resolve()
                .then(() =>
                    this.collectAndSync()
                )
                .catch(error => {
                    this.lastError = {
                        name:
                            error?.name ??
                            "Error",

                        message:
                            error?.message ??
                            String(error),

                        stack:
                            typeof error?.stack ===
                            "string"
                                ? error.stack.slice(
                                    0,
                                    3000
                                )
                                : null,

                        timestamp:
                            now()
                    };
                });

            this.timer =
                global.setInterval(
                    () => {
                        /*
                         * Prevent overlapping collector cycles.
                         */
                        if (
                            this.syncRunning
                        ) {
                            return;
                        }

                        Promise.resolve()
                            .then(() =>
                                this.collectAndSync()
                            )
                            .catch(error => {
                                this.lastError = {
                                    name:
                                        error?.name ??
                                        "Error",

                                    message:
                                        error?.message ??
                                        String(error),

                                    stack:
                                        typeof error?.stack ===
                                        "string"
                                            ? error.stack.slice(
                                                0,
                                                3000
                                            )
                                            : null,

                                    timestamp:
                                        now()
                                };
                            });
                    },

                    this.config
                        .collectionIntervalMs
                );

            return {
                success: true,
                running: true,

                intervalMs:
                    this.config
                        .collectionIntervalMs
            };
        }

        stop() {
            if (this.timer) {
                global.clearInterval(
                    this.timer
                );
            }

            this.timer =
                null;

            this.running =
                false;

            this.syncRunning =
                false;

            return {
                success: true,
                running: false
            };
        }

        releaseMemory() {
            this.lastResult =
                null;

            this.lastSourceReport =
                null;

            this.lastError =
                null;

            /*
             * Keep only newest bounded entities.
             */
            if (
                this.entities.size >
                this.config
                    .maximumReadEntities
            ) {
                const kept =
                    Array.from(
                        this.entities.values()
                    )
                    .sort(
                        (a, b) =>
                            (b.timestamp ?? 0) -
                            (a.timestamp ?? 0)
                    )
                    .slice(
                        0,
                        this.config
                            .maximumReadEntities
                    );

                this.entities.clear();

                for (
                    const entity of kept
                ) {
                    this.entities.set(
                        entity.id,
                        entity
                    );
                }

                this.statistics
                    .stored =
                    this.entities.size;
            }

            return {
                success: true,

                storedCount:
                    this.entities.size,

                releasedAt:
                    now()
            };
        }

        getDiagnostics() {
            return {
                module:
                    MODULE_NAME,

                version:
                    this.version,

                build:
                    this.build,

                installed:
                    true,

                running:
                    this.running,

                syncRunning:
                    this.syncRunning,

                bridgeAvailable:
                    Boolean(
                        this.getBridge()
                    ),

                storedCount:
                    this.entities.size,

                /*
                 * Keep diagnostics compact.
                 */
                sourceReports:
                    cloneValue(
                        this.lastSourceReport
                    ),

                lastResult:
                    cloneValue(
                        this.lastResult
                    ),

                lastError:
                    cloneValue(
                        this.lastError
                    ),

                statistics: {
                    ...this.statistics
                },

                memorySafety: {
                    collectionIntervalMs:
                        this.config
                            .collectionIntervalMs,

                    maximumEntities:
                        this.config
                            .maximumEntities,

                    maximumReadEntities:
                        this.config
                            .maximumReadEntities
                },

                createdAt:
                    this.createdAt,

                updatedAt:
                    this.updatedAt
            };
        }

        diagnose() {
            const diagnostics =
                this.getDiagnostics();

            console.log(
                "[RainArrival StormEntityCollector]",
                diagnostics
            );

            return diagnostics;
        }
    }

    /*
     * Stop an older collector instance first.
     */
    try {
        global
            .RainArrivalStormEntityCollectorV32
            ?.stop?.();
    } catch (_) {}

    const collector =
        new StormEntityCollector();

    global
        .RainArrivalStormEntityCollectorV32 =
        collector;

    global.RainGuardAI =
        global.RainGuardAI || {};

    global.RainGuardAI.V32 =
        global.RainGuardAI.V32 || {};

    global.RainGuardAI.V32
        .rainArrivalModules =
        global.RainGuardAI.V32
            .rainArrivalModules ||
        {};

    global.RainGuardAI.V32
        .rainArrivalModules
        .stormEntityCollector =
        collector;

    global
        .RainArrivalEngineV32
        ?.register?.(
            MODULE_NAME,
            collector
        );

    global
        .RainArrivalOrchestratorV32
        ?.register?.(
            MODULE_NAME,
            collector
        );

    global
        .collectRainArrivalStormEntities =
        () =>
            collector.collect();

    global
        .collectAndSyncRainArrivalStormEntities =
        () =>
            collector.collectAndSync();

    global
        .diagnoseRainArrivalStormEntityCollector =
        () =>
            collector.diagnose();

    global
        .releaseRainArrivalStormEntityCollectorMemory =
        () =>
            collector.releaseMemory();

    if (
        collector.config.autoStart
    ) {
        collector.start();
    }

    console.log(
        "[RainGuard AI V32] Storm Entity Collector MEMORY SAFE loaded.",
        {
            version:
                VERSION,

            build:
                BUILD,

            collectionIntervalMs:
                collector.config
                    .collectionIntervalMs,

            maximumEntities:
                collector.config
                    .maximumEntities,

            maximumReadEntities:
                collector.config
                    .maximumReadEntities
        }
    );

})(
    typeof globalThis !== "undefined"
        ? globalThis
        : window
);
