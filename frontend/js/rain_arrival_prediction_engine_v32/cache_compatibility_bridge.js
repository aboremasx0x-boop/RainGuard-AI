/*
===========================================================
 RainGuard AI V32
 Phase 38M-12A
 Cache Compatibility Bridge

 Responsibilities:
 - Resolve the modular cache instance
 - Add missing cache API methods
 - Support replay, motion, candidate and history storage
 - Preserve compatibility with existing cache implementations
 - Expose a safe global Cache alias
===========================================================
*/

(function (global) {
    "use strict";

    const MODULE_NAME =
        "cacheCompatibilityBridge";

    const VERSION =
        "32.38M.12A";

    const BUILD =
        "rainguard-v32-phase38m-cache-compatibility-bridge";

    const DEFAULT_TTL = Object.freeze({
        replay:
            12 * 60 * 60 * 1000,

        motion:
            6 * 60 * 60 * 1000,

        candidate:
            6 * 60 * 60 * 1000,

        history:
            24 * 60 * 60 * 1000,

        reconstruction:
            12 * 60 * 60 * 1000
    });

    function now() {
        return Date.now();
    }

    function isObject(value) {
        return (
            value !== null &&
            typeof value === "object" &&
            !Array.isArray(value)
        );
    }

    function cloneValue(value) {
        if (
            value === null ||
            value === undefined
        ) {
            return value;
        }

        if (
            typeof structuredClone ===
            "function"
        ) {
            try {
                return structuredClone(value);
            } catch (error) {
                // Continue with JSON fallback.
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

    function normalizeKey(value) {
        if (
            value === null ||
            value === undefined
        ) {
            return "";
        }

        return String(value).trim();
    }

    function normalizeTtl(
        value,
        fallback
    ) {
        const number =
            Number(value);

        return (
            Number.isFinite(number) &&
            number > 0
        )
            ? number
            : fallback;
    }

    function createMemoryStore() {
        return {
            replay:
                new Map(),

            motion:
                new Map(),

            candidate:
                new Map(),

            history:
                new Map(),

            reconstruction:
                new Map()
        };
    }

    const memoryStore =
        createMemoryStore();

    function resolveCache() {
        return (
            global.RainArrivalCacheV32 ||
            global.RainGuardAI
                ?.V32
                ?.rainArrivalModules
                ?.cache ||
            global.RainArrivalEngineV32
                ?.get?.("cache") ||
            null
        );
    }

    function buildEntry(
        value,
        options = {},
        defaultTtl
    ) {
        const createdAt =
            now();

        const ttlMs =
            normalizeTtl(
                options.ttlMs,
                defaultTtl
            );

        return {
            value:
                cloneValue(value),

            createdAt,

            updatedAt:
                createdAt,

            expiresAt:
                createdAt + ttlMs,

            ttlMs,

            metadata:
                isObject(options.metadata)
                    ? cloneValue(
                        options.metadata
                    )
                    : {}
        };
    }

    function readEntry(
        store,
        key
    ) {
        const normalizedKey =
            normalizeKey(key);

        if (!normalizedKey) {
            return null;
        }

        const entry =
            store.get(normalizedKey);

        if (!entry) {
            return null;
        }

        if (
            Number.isFinite(
                entry.expiresAt
            ) &&
            entry.expiresAt <= now()
        ) {
            store.delete(
                normalizedKey
            );

            return null;
        }

        return cloneValue(
            entry.value
        );
    }

    function writeEntry(
        store,
        key,
        value,
        options,
        defaultTtl
    ) {
        const normalizedKey =
            normalizeKey(key);

        if (!normalizedKey) {
            return false;
        }

        store.set(
            normalizedKey,
            buildEntry(
                value,
                options,
                defaultTtl
            )
        );

        return true;
    }

    function deleteEntry(
        store,
        key
    ) {
        const normalizedKey =
            normalizeKey(key);

        if (!normalizedKey) {
            return false;
        }

        return store.delete(
            normalizedKey
        );
    }

    function clearExpiredStore(
        store
    ) {
        let removed = 0;

        const currentTime =
            now();

        for (
            const [
                key,
                entry
            ] of store.entries()
        ) {
            if (
                Number.isFinite(
                    entry?.expiresAt
                ) &&
                entry.expiresAt <=
                    currentTime
            ) {
                store.delete(key);
                removed += 1;
            }
        }

        return removed;
    }

    function callExistingMethod(
        cache,
        methodNames,
        args
    ) {
        for (
            const methodName
            of methodNames
        ) {
            if (
                typeof cache?.[
                    methodName
                ] === "function"
            ) {
                try {
                    return {
                        found:
                            true,

                        value:
                            cache[
                                methodName
                            ](...args)
                    };
                } catch (error) {
                    console.warn(
                        `[RainArrival Cache Bridge] Existing method failed: ${methodName}`,
                        error
                    );
                }
            }
        }

        return {
            found:
                false,

            value:
                undefined
        };
    }

    class RainArrivalCacheCompatibilityBridge {

        constructor() {
            this.version =
                VERSION;

            this.build =
                BUILD;

            this.installed =
                false;

            this.cache =
                null;

            this.lastError =
                null;

            this.statistics = {
                reads:
                    0,

                writes:
                    0,

                deletes:
                    0,

                hits:
                    0,

                misses:
                    0,

                fallbackReads:
                    0,

                fallbackWrites:
                    0,

                expiredRemoved:
                    0
            };

            this.createdAt =
                now();

            this.updatedAt =
                this.createdAt;
        }

        install() {
            const cache =
                resolveCache();

            if (!cache) {
                this.lastError = {
                    code:
                        "CACHE_MODULE_UNAVAILABLE",

                    message:
                        "Rain Arrival cache module could not be resolved.",

                    timestamp:
                        now()
                };

                console.error(
                    "[RainArrival Cache Bridge] Cache module unavailable."
                );

                return {
                    success:
                        false,

                    reason:
                        "CACHE_MODULE_UNAVAILABLE",

                    version:
                        this.version,

                    build:
                        this.build
                };
            }

            this.cache =
                cache;

            this.installCoreApi(
                cache
            );

            this.installReplayApi(
                cache
            );

            this.installMotionApi(
                cache
            );

            this.installCandidateApi(
                cache
            );

            this.installHistoryApi(
                cache
            );

            this.installReconstructionApi(
                cache
            );

            this.installMaintenanceApi(
                cache
            );

            cache.version =
                cache.version ||
                VERSION;

            cache.bridgeVersion =
                VERSION;

            cache.bridgeBuild =
                BUILD;

            cache.compatibilityBridgeInstalled =
                true;

            global.Cache =
                cache;

            global.RainArrivalCacheV32 =
                cache;

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
                .cache =
                cache;

            if (
                global.RainArrivalEngineV32 &&
                typeof global
                    .RainArrivalEngineV32
                    .register ===
                    "function"
            ) {
                global.RainArrivalEngineV32
                    .register(
                        "cache",
                        cache
                    );

                global.RainArrivalEngineV32
                    .register(
                        MODULE_NAME,
                        this
                    );
            }

            if (
                global
                    .RainArrivalOrchestratorV32 &&
                typeof global
                    .RainArrivalOrchestratorV32
                    .register ===
                    "function"
            ) {
                global
                    .RainArrivalOrchestratorV32
                    .register(
                        "cache",
                        cache
                    );

                global
                    .RainArrivalOrchestratorV32
                    .register(
                        MODULE_NAME,
                        this
                    );
            }

            this.installed =
                true;

            this.updatedAt =
                now();

            console.log(
                "[RainGuard AI V32] Cache Compatibility Bridge installed.",
                {
                    version:
                        VERSION,

                    build:
                        BUILD,

                    methods:
                        this.getInstalledMethods()
                }
            );

            return {
                success:
                    true,

                installed:
                    true,

                version:
                    this.version,

                build:
                    this.build,

                methods:
                    this.getInstalledMethods()
            };
        }

        installCoreApi(cache) {
            if (
                typeof cache.get !==
                "function"
            ) {
                cache.get =
                    (
                        namespace,
                        key
                    ) => {
                        const store =
                            memoryStore[
                                namespace
                            ];

                        if (!store) {
                            return null;
                        }

                        return readEntry(
                            store,
                            key
                        );
                    };
            }

            if (
                typeof cache.set !==
                "function"
            ) {
                cache.set =
                    (
                        namespace,
                        key,
                        value,
                        options = {}
                    ) => {
                        const store =
                            memoryStore[
                                namespace
                            ];

                        if (!store) {
                            return false;
                        }

                        const ttl =
                            DEFAULT_TTL[
                                namespace
                            ] ||
                            DEFAULT_TTL
                                .candidate;

                        return writeEntry(
                            store,
                            key,
                            value,
                            options,
                            ttl
                        );
                    };
            }

            if (
                typeof cache.remove !==
                "function"
            ) {
                cache.remove =
                    (
                        namespace,
                        key
                    ) => {
                        const store =
                            memoryStore[
                                namespace
                            ];

                        if (!store) {
                            return false;
                        }

                        return deleteEntry(
                            store,
                            key
                        );
                    };
            }
        }

        installReplayApi(cache) {
            if (
                typeof cache.getReplay !==
                "function"
            ) {
                cache.getReplay =
                    trackId => {
                        this.statistics
                            .reads += 1;

                        const existing =
                            callExistingMethod(
                                cache,
                                [
                                    "readReplay",
                                    "loadReplay"
                                ],
                                [trackId]
                            );

                        if (
                            existing.found &&
                            existing.value !==
                                undefined &&
                            existing.value !==
                                null
                        ) {
                            this.statistics
                                .hits += 1;

                            return cloneValue(
                                existing.value
                            );
                        }

                        this.statistics
                            .fallbackReads += 1;

                        const value =
                            readEntry(
                                memoryStore
                                    .replay,
                                trackId
                            );

                        if (value) {
                            this.statistics
                                .hits += 1;
                        } else {
                            this.statistics
                                .misses += 1;
                        }

                        return value;
                    };
            }

            if (
                typeof cache.setReplay !==
                "function"
            ) {
                cache.setReplay =
                    (
                        trackId,
                        replay,
                        options = {}
                    ) => {
                        this.statistics
                            .writes += 1;

                        this.statistics
                            .fallbackWrites += 1;

                        return writeEntry(
                            memoryStore
                                .replay,
                            trackId,
                            replay,
                            options,
                            DEFAULT_TTL
                                .replay
                        );
                    };
            }
        }

        installMotionApi(cache) {
            if (
                typeof cache.getMotion !==
                "function"
            ) {
                cache.getMotion =
                    trackId => {
                        this.statistics
                            .reads += 1;

                        const existing =
                            callExistingMethod(
                                cache,
                                [
                                    "getMotionState",
                                    "readMotion",
                                    "loadMotion"
                                ],
                                [trackId]
                            );

                        if (
                            existing.found &&
                            existing.value !==
                                undefined &&
                            existing.value !==
                                null
                        ) {
                            this.statistics
                                .hits += 1;

                            return cloneValue(
                                existing.value
                            );
                        }

                        this.statistics
                            .fallbackReads += 1;

                        const value =
                            readEntry(
                                memoryStore
                                    .motion,
                                trackId
                            );

                        if (value) {
                            this.statistics
                                .hits += 1;
                        } else {
                            this.statistics
                                .misses += 1;
                        }

                        return value;
                    };
            }

            if (
                typeof cache.setMotion !==
                "function"
            ) {
                cache.setMotion =
                    (
                        trackId,
                        motion,
                        options = {}
                    ) => {
                        this.statistics
                            .writes += 1;

                        this.statistics
                            .fallbackWrites += 1;

                        return writeEntry(
                            memoryStore
                                .motion,
                            trackId,
                            motion,
                            options,
                            DEFAULT_TTL
                                .motion
                        );
                    };
            }
        }

        installCandidateApi(cache) {
            if (
                typeof cache.getCandidate !==
                "function"
            ) {
                cache.getCandidate =
                    trackId => {
                        this.statistics
                            .reads += 1;

                        const existing =
                            callExistingMethod(
                                cache,
                                [
                                    "readCandidate",
                                    "loadCandidate"
                                ],
                                [trackId]
                            );

                        if (
                            existing.found &&
                            existing.value !==
                                undefined &&
                            existing.value !==
                                null
                        ) {
                            this.statistics
                                .hits += 1;

                            return cloneValue(
                                existing.value
                            );
                        }

                        this.statistics
                            .fallbackReads += 1;

                        const value =
                            readEntry(
                                memoryStore
                                    .candidate,
                                trackId
                            );

                        if (value) {
                            this.statistics
                                .hits += 1;
                        } else {
                            this.statistics
                                .misses += 1;
                        }

                        return value;
                    };
            }

            if (
                typeof cache.setCandidate !==
                "function"
            ) {
                cache.setCandidate =
                    (
                        trackId,
                        candidate,
                        options = {}
                    ) => {
                        this.statistics
                            .writes += 1;

                        this.statistics
                            .fallbackWrites += 1;

                        return writeEntry(
                            memoryStore
                                .candidate,
                            trackId,
                            candidate,
                            options,
                            DEFAULT_TTL
                                .candidate
                        );
                    };
            }
        }

        installHistoryApi(cache) {
            if (
                typeof cache.getHistory !==
                "function"
            ) {
                cache.getHistory =
                    trackId => {
                        this.statistics
                            .reads += 1;

                        const existing =
                            callExistingMethod(
                                cache,
                                [
                                    "readHistory",
                                    "loadHistory",
                                    "getTrackHistory"
                                ],
                                [trackId]
                            );

                        if (
                            existing.found &&
                            existing.value !==
                                undefined &&
                            existing.value !==
                                null
                        ) {
                            this.statistics
                                .hits += 1;

                            return cloneValue(
                                existing.value
                            );
                        }

                        this.statistics
                            .fallbackReads += 1;

                        const value =
                            readEntry(
                                memoryStore
                                    .history,
                                trackId
                            );

                        if (value) {
                            this.statistics
                                .hits += 1;
                        } else {
                            this.statistics
                                .misses += 1;
                        }

                        return value;
                    };
            }

            if (
                typeof cache.setHistory !==
                "function"
            ) {
                cache.setHistory =
                    (
                        trackId,
                        history,
                        options = {}
                    ) => {
                        this.statistics
                            .writes += 1;

                        this.statistics
                            .fallbackWrites += 1;

                        return writeEntry(
                            memoryStore
                                .history,
                            trackId,
                            history,
                            options,
                            DEFAULT_TTL
                                .history
                        );
                    };
            }
        }

        installReconstructionApi(
            cache
        ) {
            if (
                typeof cache
                    .getReconstruction !==
                "function"
            ) {
                cache.getReconstruction =
                    trackId => {
                        this.statistics
                            .reads += 1;

                        const existing =
                            callExistingMethod(
                                cache,
                                [
                                    "readReconstruction",
                                    "loadReconstruction"
                                ],
                                [trackId]
                            );

                        if (
                            existing.found &&
                            existing.value !==
                                undefined &&
                            existing.value !==
                                null
                        ) {
                            this.statistics
                                .hits += 1;

                            return cloneValue(
                                existing.value
                            );
                        }

                        this.statistics
                            .fallbackReads += 1;

                        const value =
                            readEntry(
                                memoryStore
                                    .reconstruction,
                                trackId
                            );

                        if (value) {
                            this.statistics
                                .hits += 1;
                        } else {
                            this.statistics
                                .misses += 1;
                        }

                        return value;
                    };
            }

            if (
                typeof cache
                    .setReconstruction !==
                "function"
            ) {
                cache.setReconstruction =
                    (
                        trackId,
                        reconstruction,
                        options = {}
                    ) => {
                        this.statistics
                            .writes += 1;

                        this.statistics
                            .fallbackWrites += 1;

                        return writeEntry(
                            memoryStore
                                .reconstruction,
                            trackId,
                            reconstruction,
                            options,
                            DEFAULT_TTL
                                .reconstruction
                        );
                    };
            }
        }

        installMaintenanceApi(
            cache
        ) {
            if (
                typeof cache
                    .clearExpired !==
                "function"
            ) {
                cache.clearExpired =
                    () => {
                        let removed = 0;

                        Object.values(
                            memoryStore
                        ).forEach(
                            store => {
                                removed +=
                                    clearExpiredStore(
                                        store
                                    );
                            }
                        );

                        this.statistics
                            .expiredRemoved +=
                            removed;

                        return {
                            success:
                                true,

                            removed,

                            timestamp:
                                now()
                        };
                    };
            }

            if (
                typeof cache.clear !==
                "function"
            ) {
                cache.clear =
                    namespace => {
                        if (
                            namespace &&
                            memoryStore[
                                namespace
                            ]
                        ) {
                            memoryStore[
                                namespace
                            ].clear();

                            return true;
                        }

                        Object.values(
                            memoryStore
                        ).forEach(
                            store =>
                                store.clear()
                        );

                        return true;
                    };
            }

            const originalDiagnostics =
                typeof cache
                    .getDiagnostics ===
                    "function"
                    ? cache
                        .getDiagnostics
                        .bind(cache)
                    : null;

            cache.getDiagnostics =
                () => {
                    let original = {};

                    if (
                        originalDiagnostics
                    ) {
                        try {
                            original =
                                originalDiagnostics() ||
                                {};
                        } catch (error) {
                            original = {
                                originalDiagnosticsError:
                                    error?.message ||
                                    String(error)
                            };
                        }
                    }

                    const totalReads =
                        this.statistics.reads;

                    const hitRate =
                        totalReads > 0
                            ? Number(
                                (
                                    this.statistics
                                        .hits /
                                    totalReads *
                                    100
                                ).toFixed(2)
                            )
                            : 0;

                    return {
                        ...original,

                        module:
                            "cache",

                        bridgeInstalled:
                            true,

                        bridgeVersion:
                            VERSION,

                        bridgeBuild:
                            BUILD,

                        available:
                            true,

                        replayCount:
                            memoryStore
                                .replay
                                .size,

                        motionCount:
                            memoryStore
                                .motion
                                .size,

                        candidateCount:
                            memoryStore
                                .candidate
                                .size,

                        historyCount:
                            memoryStore
                                .history
                                .size,

                        reconstructionCount:
                            memoryStore
                                .reconstruction
                                .size,

                        hitRate,

                        statistics:
                            cloneValue(
                                this.statistics
                            ),

                        generatedAt:
                            now()
                    };
                };
        }

        getInstalledMethods() {
            const cache =
                this.cache ||
                resolveCache();

            const methods = [
                "get",
                "set",
                "remove",
                "getReplay",
                "setReplay",
                "getMotion",
                "setMotion",
                "getCandidate",
                "setCandidate",
                "getHistory",
                "setHistory",
                "getReconstruction",
                "setReconstruction",
                "clearExpired",
                "clear",
                "getDiagnostics"
            ];

            return methods.reduce(
                (
                    result,
                    method
                ) => {
                    result[method] =
                        typeof cache?.[
                            method
                        ] ===
                        "function";

                    return result;
                },
                {}
            );
        }

        diagnose() {
            const cache =
                this.cache ||
                resolveCache();

            const diagnostics = {
                module:
                    MODULE_NAME,

                version:
                    this.version,

                build:
                    this.build,

                installed:
                    this.installed,

                cacheAvailable:
                    Boolean(cache),

                methods:
                    this.getInstalledMethods(),

                cacheDiagnostics:
                    cache
                        ?.getDiagnostics?.() ??
                    null,

                statistics:
                    cloneValue(
                        this.statistics
                    ),

                lastError:
                    cloneValue(
                        this.lastError
                    ),

                createdAt:
                    this.createdAt,

                updatedAt:
                    this.updatedAt
            };

            console.log(
                "[RainArrival Cache Compatibility Bridge]",
                diagnostics
            );

            return diagnostics;
        }
    }

    const bridge =
        new RainArrivalCacheCompatibilityBridge();

    global.RainArrivalCacheCompatibilityBridgeV32 =
        bridge;

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
        .cacheCompatibilityBridge =
        bridge;

    const installationResult =
        bridge.install();

    console.log(
        "[RainGuard AI V32] Cache bridge installation result:",
        installationResult
    );

})(
    typeof globalThis !==
        "undefined"
        ? globalThis
        : window
);
