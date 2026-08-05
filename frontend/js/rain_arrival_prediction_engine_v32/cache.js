/*
===========================================================
 RainGuard AI V32
 Phase 38M-6
 Unified Cache Module

 Responsibilities:
 - Historical motion cache
 - Replay cache
 - Reconstruction cache
 - ETA cache
 - Candidate cache
 - Namespace management
 - TTL expiration
 - Automatic cleanup
 - Optional localStorage persistence
 - Runtime diagnostics and statistics
===========================================================
*/

(function (global) {
    "use strict";

    const MODULE_NAME = "cache";
    const VERSION = "32.38M.6";
    const BUILD =
        "rainguard-v32-phase38m-unified-cache";

    const DEFAULT_CONFIG = Object.freeze({
        enabled: true,

        defaultTtlMs:
            6 * 60 * 60 * 1000,

        cleanupIntervalMs:
            5 * 60 * 1000,

        maximumEntries:
            5000,

        maximumEntriesPerNamespace:
            1000,

        persist:
            true,

        storageKey:
            "rainguard_ai_v32_phase38m_cache",

        storageVersion:
            1,

        autoRestore:
            true,

        autoPersist:
            true,

        autoCleanup:
            true,

        persistDebounceMs:
            1000,

        expiredEntryGraceMs:
            0,

        allowedNamespaces: [
            "motion",
            "history",
            "replay",
            "reconstruction",
            "eta",
            "candidate",
            "identity",
            "diagnostics",
            "prediction",
            "tracking",
            "generic"
        ]
    });

    const CACHE_NAMESPACES = Object.freeze({
        MOTION:
            "motion",

        HISTORY:
            "history",

        REPLAY:
            "replay",

        RECONSTRUCTION:
            "reconstruction",

        ETA:
            "eta",

        CANDIDATE:
            "candidate",

        IDENTITY:
            "identity",

        DIAGNOSTICS:
            "diagnostics",

        PREDICTION:
            "prediction",

        TRACKING:
            "tracking",

        GENERIC:
            "generic"
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

    function isFiniteNumber(value) {
        return (
            typeof value === "number" &&
            Number.isFinite(value)
        );
    }

    function toFiniteNumber(
        value,
        fallback = null
    ) {
        const number =
            Number(value);

        return Number.isFinite(number)
            ? number
            : fallback;
    }

    function normalizeText(value) {
        if (
            value === null ||
            value === undefined
        ) {
            return "";
        }

        return String(value).trim();
    }

    function normalizeKey(value) {
        return normalizeText(value);
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
                return structuredClone(
                    value
                );
            } catch (error) {
                // Continue with fallback.
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

    function safeJsonParse(
        value,
        fallback = null
    ) {
        if (
            typeof value !== "string"
        ) {
            return fallback;
        }

        try {
            return JSON.parse(value);
        } catch (error) {
            return fallback;
        }
    }

    function safeJsonStringify(
        value,
        fallback = null
    ) {
        try {
            return JSON.stringify(value);
        } catch (error) {
            return fallback;
        }
    }

    function estimateSizeBytes(value) {
        const serialized =
            safeJsonStringify(
                value,
                ""
            );

        if (
            typeof serialized !==
            "string"
        ) {
            return 0;
        }

        try {
            return new Blob([
                serialized
            ]).size;
        } catch (error) {
            return (
                serialized.length *
                2
            );
        }
    }

    function createEntryId() {
        return [
            "CACHE",
            now(),
            Math.random()
                .toString(36)
                .slice(2, 10)
                .toUpperCase()
        ].join("-");
    }

    class RainArrivalCacheV32 {

        constructor(config = {}) {
            this.version =
                VERSION;

            this.build =
                BUILD;

            this.config = {
                ...DEFAULT_CONFIG,
                ...(isObject(config)
                    ? config
                    : {})
            };

            this.namespaces =
                new Map();

            this.statistics = {
                createdAt:
                    now(),

                reads:
                    0,

                hits:
                    0,

                misses:
                    0,

                writes:
                    0,

                updates:
                    0,

                removals:
                    0,

                expirations:
                    0,

                cleanupRuns:
                    0,

                persistenceWrites:
                    0,

                persistenceReads:
                    0,

                persistenceFailures:
                    0,

                restores:
                    0,

                namespaceCreates:
                    0,

                evictions:
                    0
            };

            this.lastCleanupAt =
                null;

            this.lastPersistAt =
                null;

            this.lastRestoreAt =
                null;

            this.lastError =
                null;

            this.cleanupTimer =
                null;

            this.persistTimer =
                null;

            this.initialized =
                false;

            this.createdAt =
                now();

            this.updatedAt =
                this.createdAt;

            this.ensureDefaultNamespaces();

            if (
                this.config.autoRestore
            ) {
                this.restore();
            }

            if (
                this.config.autoCleanup
            ) {
                this.startAutoCleanup();
            }

            this.initialized =
                true;
        }

        ensureDefaultNamespaces() {
            this.config
                .allowedNamespaces
                .forEach(
                    namespace => {
                        this.ensureNamespace(
                            namespace
                        );
                    }
                );
        }

        normalizeNamespace(
            namespace
        ) {
            const normalized =
                normalizeText(namespace)
                    .toLowerCase();

            if (!normalized) {
                return CACHE_NAMESPACES
                    .GENERIC;
            }

            return normalized;
        }

        ensureNamespace(
            namespace
        ) {
            const normalizedNamespace =
                this.normalizeNamespace(
                    namespace
                );

            if (
                !this.namespaces.has(
                    normalizedNamespace
                )
            ) {
                this.namespaces.set(
                    normalizedNamespace,
                    new Map()
                );

                this.statistics
                    .namespaceCreates += 1;
            }

            return this.namespaces.get(
                normalizedNamespace
            );
        }

        resolveTtl(
            ttlMs
        ) {
            const candidate =
                toFiniteNumber(
                    ttlMs,
                    this.config
                        .defaultTtlMs
                );

            if (
                candidate === null ||
                candidate < 0
            ) {
                return this.config
                    .defaultTtlMs;
            }

            return candidate;
        }

        createEntry({
            namespace,
            key,
            value,
            ttlMs,
            metadata = {}
        }) {
            const createdAt =
                now();

            const resolvedTtl =
                this.resolveTtl(
                    ttlMs
                );

            const expiresAt =
                resolvedTtl === 0
                    ? null
                    : createdAt +
                        resolvedTtl;

            return {
                id:
                    createEntryId(),

                namespace,

                key,

                value:
                    cloneValue(value),

                metadata:
                    isObject(metadata)
                        ? cloneValue(
                            metadata
                        )
                        : {},

                createdAt,

                updatedAt:
                    createdAt,

                lastAccessedAt:
                    createdAt,

                expiresAt,

                ttlMs:
                    resolvedTtl,

                accessCount:
                    0,

                sizeBytes:
                    estimateSizeBytes(
                        value
                    )
            };
        }

        isExpired(
            entry,
            referenceTime = now()
        ) {
            if (
                !entry ||
                entry.expiresAt ===
                    null
            ) {
                return false;
            }

            return (
                referenceTime >
                (
                    entry.expiresAt +
                    this.config
                        .expiredEntryGraceMs
                )
            );
        }

        set(
            namespace,
            key,
            value,
            options = {}
        ) {
            if (
                this.config.enabled !==
                true
            ) {
                return {
                    success: false,
                    reason:
                        "CACHE_DISABLED"
                };
            }

            const normalizedNamespace =
                this.normalizeNamespace(
                    namespace
                );

            const normalizedKey =
                normalizeKey(key);

            if (!normalizedKey) {
                return {
                    success: false,
                    reason:
                        "INVALID_CACHE_KEY"
                };
            }

            const store =
                this.ensureNamespace(
                    normalizedNamespace
                );

            const existing =
                store.get(
                    normalizedKey
                );

            const entry =
                existing
                    ? {
                        ...existing,

                        value:
                            cloneValue(
                                value
                            ),

                        metadata:
                            isObject(
                                options.metadata
                            )
                                ? {
                                    ...existing
                                        .metadata,

                                    ...cloneValue(
                                        options
                                            .metadata
                                    )
                                }
                                : existing
                                    .metadata,

                        updatedAt:
                            now(),

                        expiresAt:
                            this.resolveTtl(
                                options.ttlMs
                            ) === 0
                                ? null
                                : now() +
                                    this.resolveTtl(
                                        options
                                            .ttlMs
                                    ),

                        ttlMs:
                            this.resolveTtl(
                                options.ttlMs
                            ),

                        sizeBytes:
                            estimateSizeBytes(
                                value
                            )
                    }
                    : this.createEntry({
                        namespace:
                            normalizedNamespace,

                        key:
                            normalizedKey,

                        value,

                        ttlMs:
                            options.ttlMs,

                        metadata:
                            options.metadata
                    });

            store.set(
                normalizedKey,
                entry
            );

            if (existing) {
                this.statistics
                    .updates += 1;
            } else {
                this.statistics
                    .writes += 1;
            }

            this.updatedAt =
                now();

            this.enforceNamespaceLimit(
                normalizedNamespace
            );

            this.enforceGlobalLimit();

            if (
                options.persist !==
                    false &&
                this.config
                    .autoPersist
            ) {
                this.schedulePersist();
            }

            return {
                success: true,

                namespace:
                    normalizedNamespace,

                key:
                    normalizedKey,

                created:
                    !existing,

                updated:
                    Boolean(existing),

                expiresAt:
                    entry.expiresAt,

                sizeBytes:
                    entry.sizeBytes
            };
        }

        get(
            namespace,
            key,
            options = {}
        ) {
            const normalizedNamespace =
                this.normalizeNamespace(
                    namespace
                );

            const normalizedKey =
                normalizeKey(key);

            this.statistics.reads += 1;

            const store =
                this.namespaces.get(
                    normalizedNamespace
                );

            if (
                !store ||
                !normalizedKey
            ) {
                this.statistics.misses += 1;

                return (
                    options.returnEntry
                        ? null
                        : options.fallback ??
                            null
                );
            }

            const entry =
                store.get(
                    normalizedKey
                );

            if (!entry) {
                this.statistics.misses += 1;

                return (
                    options.returnEntry
                        ? null
                        : options.fallback ??
                            null
                );
            }

            if (
                this.isExpired(entry)
            ) {
                store.delete(
                    normalizedKey
                );

                this.statistics
                    .expirations += 1;

                this.statistics
                    .misses += 1;

                if (
                    this.config
                        .autoPersist
                ) {
                    this.schedulePersist();
                }

                return (
                    options.returnEntry
                        ? null
                        : options.fallback ??
                            null
                );
            }

            entry.lastAccessedAt =
                now();

            entry.accessCount += 1;

            this.statistics.hits += 1;

            if (
                options.touch === true
            ) {
                this.touch(
                    normalizedNamespace,
                    normalizedKey,
                    options.ttlMs
                );
            }

            return options.returnEntry
                ? cloneValue(entry)
                : cloneValue(
                    entry.value
                );
        }

        has(
            namespace,
            key
        ) {
            return (
                this.get(
                    namespace,
                    key,
                    {
                        returnEntry:
                            true
                    }
                ) !== null
            );
        }

        touch(
            namespace,
            key,
            ttlMs = undefined
        ) {
            const normalizedNamespace =
                this.normalizeNamespace(
                    namespace
                );

            const normalizedKey =
                normalizeKey(key);

            const store =
                this.namespaces.get(
                    normalizedNamespace
                );

            if (!store) {
                return false;
            }

            const entry =
                store.get(
                    normalizedKey
                );

            if (!entry) {
                return false;
            }

            const resolvedTtl =
                this.resolveTtl(
                    ttlMs ??
                    entry.ttlMs
                );

            entry.updatedAt =
                now();

            entry.ttlMs =
                resolvedTtl;

            entry.expiresAt =
                resolvedTtl === 0
                    ? null
                    : now() +
                        resolvedTtl;

            this.updatedAt =
                now();

            if (
                this.config.autoPersist
            ) {
                this.schedulePersist();
            }

            return true;
        }

        remove(
            namespace,
            key,
            options = {}
        ) {
            const normalizedNamespace =
                this.normalizeNamespace(
                    namespace
                );

            const normalizedKey =
                normalizeKey(key);

            const store =
                this.namespaces.get(
                    normalizedNamespace
                );

            if (
                !store ||
                !store.has(
                    normalizedKey
                )
            ) {
                return false;
            }

            store.delete(
                normalizedKey
            );

            this.statistics.removals += 1;

            this.updatedAt =
                now();

            if (
                options.persist !==
                    false &&
                this.config
                    .autoPersist
            ) {
                this.schedulePersist();
            }

            return true;
        }

        clearNamespace(
            namespace,
            options = {}
        ) {
            const normalizedNamespace =
                this.normalizeNamespace(
                    namespace
                );

            const store =
                this.namespaces.get(
                    normalizedNamespace
                );

            if (!store) {
                return {
                    success: false,
                    removedCount: 0
                };
            }

            const removedCount =
                store.size;

            store.clear();

            this.updatedAt =
                now();

            if (
                options.persist !==
                    false &&
                this.config
                    .autoPersist
            ) {
                this.schedulePersist();
            }

            return {
                success: true,
                namespace:
                    normalizedNamespace,
                removedCount
            };
        }

        clear(
            options = {}
        ) {
            let removedCount = 0;

            for (
                const store
                of this.namespaces
                    .values()
            ) {
                removedCount +=
                    store.size;

                store.clear();
            }

            this.updatedAt =
                now();

            if (
                options.persist !==
                    false
            ) {
                this.persist();
            }

            return {
                success: true,
                removedCount
            };
        }

        getNamespaceEntries(
            namespace,
            options = {}
        ) {
            const normalizedNamespace =
                this.normalizeNamespace(
                    namespace
                );

            const store =
                this.namespaces.get(
                    normalizedNamespace
                );

            if (!store) {
                return [];
            }

            const referenceTime =
                now();

            const output = [];

            for (
                const [
                    key,
                    entry
                ] of store
            ) {
                if (
                    this.isExpired(
                        entry,
                        referenceTime
                    )
                ) {
                    continue;
                }

                output.push(
                    options.returnEntries
                        ? cloneValue(entry)
                        : {
                            key,
                            value:
                                cloneValue(
                                    entry.value
                                )
                        }
                );
            }

            return output;
        }

        getAllEntries(
            options = {}
        ) {
            const output = [];

            for (
                const namespace
                of this.namespaces.keys()
            ) {
                const entries =
                    this.getNamespaceEntries(
                        namespace,
                        {
                            returnEntries:
                                true
                        }
                    );

                entries.forEach(
                    entry => {
                        output.push(
                            options.returnEntries
                                ? entry
                                : {
                                    namespace,
                                    key:
                                        entry.key,
                                    value:
                                        cloneValue(
                                            entry.value
                                        )
                                }
                        );
                    }
                );
            }

            return output;
        }

        cleanup(
            referenceTime = now()
        ) {
            this.statistics
                .cleanupRuns += 1;

            const removed = [];

            for (
                const [
                    namespace,
                    store
                ] of this.namespaces
            ) {
                for (
                    const [
                        key,
                        entry
                    ] of store
                ) {
                    if (
                        this.isExpired(
                            entry,
                            referenceTime
                        )
                    ) {
                        store.delete(key);

                        removed.push({
                            namespace,
                            key
                        });

                        this.statistics
                            .expirations += 1;
                    }
                }
            }

            this.lastCleanupAt =
                referenceTime;

            this.updatedAt =
                referenceTime;

            if (
                removed.length > 0 &&
                this.config
                    .autoPersist
            ) {
                this.schedulePersist();
            }

            return {
                success: true,

                removedCount:
                    removed.length,

                removed,

                remainingEntries:
                    this.getEntryCount(),

                cleanedAt:
                    referenceTime
            };
        }

        startAutoCleanup() {
            this.stopAutoCleanup();

            const interval =
                Math.max(
                    10000,
                    toFiniteNumber(
                        this.config
                            .cleanupIntervalMs,
                        300000
                    )
                );

            this.cleanupTimer =
                global.setInterval(
                    () => {
                        try {
                            this.cleanup();
                        } catch (error) {
                            this.setLastError(
                                error,
                                "AUTO_CLEANUP_FAILED"
                            );
                        }
                    },
                    interval
                );

            return true;
        }

        stopAutoCleanup() {
            if (
                this.cleanupTimer !==
                null
            ) {
                global.clearInterval(
                    this.cleanupTimer
                );

                this.cleanupTimer =
                    null;
            }

            return true;
        }

        enforceNamespaceLimit(
            namespace
        ) {
            const store =
                this.namespaces.get(
                    namespace
                );

            if (!store) {
                return;
            }

            const maximum =
                Math.max(
                    1,
                    toFiniteNumber(
                        this.config
                            .maximumEntriesPerNamespace,
                        1000
                    )
                );

            if (
                store.size <= maximum
            ) {
                return;
            }

            const entries =
                Array.from(
                    store.values()
                ).sort(
                    (a, b) =>
                        (
                            a.lastAccessedAt ||
                            a.updatedAt
                        ) -
                        (
                            b.lastAccessedAt ||
                            b.updatedAt
                        )
                );

            const excess =
                store.size -
                maximum;

            entries
                .slice(0, excess)
                .forEach(
                    entry => {
                        store.delete(
                            entry.key
                        );

                        this.statistics
                            .evictions += 1;
                    }
                );
        }

        enforceGlobalLimit() {
            const maximum =
                Math.max(
                    1,
                    toFiniteNumber(
                        this.config
                            .maximumEntries,
                        5000
                    )
                );

            const total =
                this.getEntryCount();

            if (total <= maximum) {
                return;
            }

            const entries =
                this.getAllEntries({
                    returnEntries: true
                }).sort(
                    (a, b) =>
                        (
                            a.lastAccessedAt ||
                            a.updatedAt
                        ) -
                        (
                            b.lastAccessedAt ||
                            b.updatedAt
                        )
                );

            const excess =
                total -
                maximum;

            entries
                .slice(0, excess)
                .forEach(
                    entry => {
                        this.remove(
                            entry.namespace,
                            entry.key,
                            {
                                persist: false
                            }
                        );

                        this.statistics
                            .evictions += 1;
                    }
                );
        }

        getEntryCount() {
            let count = 0;

            for (
                const store
                of this.namespaces
                    .values()
            ) {
                count += store.size;
            }

            return count;
        }

        getNamespaceCounts() {
            const counts = {};

            for (
                const [
                    namespace,
                    store
                ] of this.namespaces
            ) {
                counts[namespace] =
                    store.size;
            }

            return counts;
        }

        getApproximateSizeBytes() {
            let total = 0;

            for (
                const store
                of this.namespaces
                    .values()
            ) {
                for (
                    const entry
                    of store.values()
                ) {
                    total +=
                        entry.sizeBytes ||
                        0;
                }
            }

            return total;
        }

        exportSnapshot() {
            const namespaces = {};

            for (
                const [
                    namespace,
                    store
                ] of this.namespaces
            ) {
                namespaces[namespace] =
                    Array.from(
                        store.entries()
                    ).map(
                        (
                            [
                                key,
                                entry
                            ]
                        ) => ({
                            key,
                            entry:
                                cloneValue(
                                    entry
                                )
                        })
                    );
            }

            return {
                storageVersion:
                    this.config
                        .storageVersion,

                module:
                    MODULE_NAME,

                version:
                    this.version,

                build:
                    this.build,

                exportedAt:
                    now(),

                namespaces,

                statistics:
                    cloneValue(
                        this.statistics
                    )
            };
        }

        importSnapshot(
            snapshot,
            options = {}
        ) {
            if (
                !isObject(snapshot) ||
                !isObject(
                    snapshot.namespaces
                )
            ) {
                return {
                    success: false,
                    reason:
                        "INVALID_CACHE_SNAPSHOT"
                };
            }

            if (
                options.replace === true
            ) {
                this.clear({
                    persist: false
                });
            }

            let imported = 0;
            let skipped = 0;

            for (
                const [
                    namespace,
                    entries
                ] of Object.entries(
                    snapshot.namespaces
                )
            ) {
                if (!Array.isArray(entries)) {
                    continue;
                }

                const store =
                    this.ensureNamespace(
                        namespace
                    );

                entries.forEach(
                    item => {
                        const key =
                            normalizeKey(
                                item?.key
                            );

                        const entry =
                            item?.entry;

                        if (
                            !key ||
                            !isObject(entry)
                        ) {
                            skipped += 1;
                            return;
                        }

                        if (
                            this.isExpired(
                                entry
                            )
                        ) {
                            skipped += 1;
                            return;
                        }

                        store.set(
                            key,
                            {
                                ...cloneValue(
                                    entry
                                ),

                                namespace:
                                    this.normalizeNamespace(
                                        namespace
                                    ),

                                key
                            }
                        );

                        imported += 1;
                    }
                );
            }

            this.statistics
                .restores += 1;

            this.lastRestoreAt =
                now();

            this.updatedAt =
                now();

            this.enforceGlobalLimit();

            return {
                success: true,
                imported,
                skipped,
                entryCount:
                    this.getEntryCount()
            };
        }

        persist() {
            if (
                this.config.persist !==
                    true
            ) {
                return {
                    success: false,
                    reason:
                        "PERSISTENCE_DISABLED"
                };
            }

            if (
                !global.localStorage
            ) {
                return {
                    success: false,
                    reason:
                        "LOCAL_STORAGE_UNAVAILABLE"
                };
            }

            try {
                const snapshot =
                    this.exportSnapshot();

                const serialized =
                    safeJsonStringify(
                        snapshot
                    );

                if (
                    typeof serialized !==
                    "string"
                ) {
                    throw new Error(
                        "Failed to serialize cache snapshot."
                    );
                }

                global.localStorage
                    .setItem(
                        this.config
                            .storageKey,
                        serialized
                    );

                this.statistics
                    .persistenceWrites += 1;

                this.lastPersistAt =
                    now();

                this.lastError =
                    null;

                return {
                    success: true,

                    storageKey:
                        this.config
                            .storageKey,

                    bytes:
                        estimateSizeBytes(
                            serialized
                        ),

                    entryCount:
                        this.getEntryCount(),

                    persistedAt:
                        this.lastPersistAt
                };
            } catch (error) {
                this.statistics
                    .persistenceFailures += 1;

                this.setLastError(
                    error,
                    "CACHE_PERSIST_FAILED"
                );

                return {
                    success: false,

                    reason:
                        "CACHE_PERSIST_FAILED",

                    error:
                        this.lastError
                };
            }
        }

        schedulePersist() {
            if (
                this.config.persist !==
                    true
            ) {
                return false;
            }

            if (
                this.persistTimer !==
                null
            ) {
                global.clearTimeout(
                    this.persistTimer
                );
            }

            this.persistTimer =
                global.setTimeout(
                    () => {
                        this.persistTimer =
                            null;

                        this.persist();
                    },
                    Math.max(
                        0,
                        toFiniteNumber(
                            this.config
                                .persistDebounceMs,
                            1000
                        )
                    )
                );

            return true;
        }

        restore() {
            if (
                this.config.persist !==
                    true
            ) {
                return {
                    success: false,
                    reason:
                        "PERSISTENCE_DISABLED"
                };
            }

            if (
                !global.localStorage
            ) {
                return {
                    success: false,
                    reason:
                        "LOCAL_STORAGE_UNAVAILABLE"
                };
            }

            try {
                const serialized =
                    global.localStorage
                        .getItem(
                            this.config
                                .storageKey
                        );

                this.statistics
                    .persistenceReads += 1;

                if (!serialized) {
                    return {
                        success: true,
                        restored: false,
                        reason:
                            "NO_PERSISTED_CACHE"
                    };
                }

                const snapshot =
                    safeJsonParse(
                        serialized
                    );

                if (!snapshot) {
                    return {
                        success: false,
                        restored: false,
                        reason:
                            "INVALID_PERSISTED_CACHE"
                    };
                }

                const result =
                    this.importSnapshot(
                        snapshot,
                        {
                            replace: true
                        }
                    );

                this.lastRestoreAt =
                    now();

                this.lastError =
                    null;

                return {
                    ...result,
                    restored:
                        result.success,
                    restoredAt:
                        this.lastRestoreAt
                };
            } catch (error) {
                this.statistics
                    .persistenceFailures += 1;

                this.setLastError(
                    error,
                    "CACHE_RESTORE_FAILED"
                );

                return {
                    success: false,
                    restored: false,
                    reason:
                        "CACHE_RESTORE_FAILED",
                    error:
                        this.lastError
                };
            }
        }

        removePersistedCache() {
            if (
                !global.localStorage
            ) {
                return false;
            }

            try {
                global.localStorage
                    .removeItem(
                        this.config
                            .storageKey
                    );

                return true;
            } catch (error) {
                this.setLastError(
                    error,
                    "CACHE_STORAGE_REMOVE_FAILED"
                );

                return false;
            }
        }

        setLastError(
            error,
            code
        ) {
            this.lastError = {
                code:
                    code ||
                    "CACHE_ERROR",

                name:
                    error?.name ||
                    "Error",

                message:
                    error?.message ||
                    String(error),

                stack:
                    error?.stack ||
                    null,

                timestamp:
                    now()
            };

            return this.lastError;
        }

        setMotion(
            trackId,
            value,
            options = {}
        ) {
            return this.set(
                CACHE_NAMESPACES
                    .MOTION,
                trackId,
                value,
                options
            );
        }

        getMotion(
            trackId,
            options = {}
        ) {
            return this.get(
                CACHE_NAMESPACES
                    .MOTION,
                trackId,
                options
            );
        }

        setHistory(
            trackId,
            value,
            options = {}
        ) {
            return this.set(
                CACHE_NAMESPACES
                    .HISTORY,
                trackId,
                value,
                options
            );
        }

        getHistory(
            trackId,
            options = {}
        ) {
            return this.get(
                CACHE_NAMESPACES
                    .HISTORY,
                trackId,
                options
            );
        }

        setReplay(
            trackId,
            value,
            options = {}
        ) {
            return this.set(
                CACHE_NAMESPACES
                    .REPLAY,
                trackId,
                value,
                options
            );
        }

        getReplay(
            trackId,
            options = {}
        ) {
            return this.get(
                CACHE_NAMESPACES
                    .REPLAY,
                trackId,
                options
            );
        }

        setReconstruction(
            trackId,
            value,
            options = {}
        ) {
            return this.set(
                CACHE_NAMESPACES
                    .RECONSTRUCTION,
                trackId,
                value,
                options
            );
        }

        getReconstruction(
            trackId,
            options = {}
        ) {
            return this.get(
                CACHE_NAMESPACES
                    .RECONSTRUCTION,
                trackId,
                options
            );
        }

        setEta(
            trackId,
            value,
            options = {}
        ) {
            return this.set(
                CACHE_NAMESPACES
                    .ETA,
                trackId,
                value,
                options
            );
        }

        getEta(
            trackId,
            options = {}
        ) {
            return this.get(
                CACHE_NAMESPACES
                    .ETA,
                trackId,
                options
            );
        }

        setCandidate(
            trackId,
            value,
            options = {}
        ) {
            return this.set(
                CACHE_NAMESPACES
                    .CANDIDATE,
                trackId,
                value,
                options
            );
        }

        getCandidate(
            trackId,
            options = {}
        ) {
            return this.get(
                CACHE_NAMESPACES
                    .CANDIDATE,
                trackId,
                options
            );
        }

        getDiagnostics() {
            const approximateSizeBytes =
                this.getApproximateSizeBytes();

            const reads =
                this.statistics.reads;

            const hitRate =
                reads > 0
                    ? (
                        this.statistics
                            .hits /
                        reads
                    ) * 100
                    : 0;

            return {
                module:
                    MODULE_NAME,

                version:
                    this.version,

                build:
                    this.build,

                installed:
                    true,

                initialized:
                    this.initialized,

                enabled:
                    this.config.enabled,

                persistenceEnabled:
                    this.config.persist,

                entryCount:
                    this.getEntryCount(),

                namespaceCount:
                    this.namespaces.size,

                namespaceCounts:
                    this.getNamespaceCounts(),

                approximateSizeBytes,

                approximateSizeMb:
                    Number(
                        (
                            approximateSizeBytes /
                            1024 /
                            1024
                        ).toFixed(3)
                    ),

                hitRate:
                    Number(
                        hitRate.toFixed(2)
                    ),

                statistics:
                    cloneValue(
                        this.statistics
                    ),

                lastCleanupAt:
                    this.lastCleanupAt,

                lastPersistAt:
                    this.lastPersistAt,

                lastRestoreAt:
                    this.lastRestoreAt,

                lastError:
                    cloneValue(
                        this.lastError
                    ),

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
                "[RainArrival Cache]",
                diagnostics
            );

            return diagnostics;
        }

        printTable(
            namespace = null
        ) {
            const entries =
                namespace
                    ? this.getNamespaceEntries(
                        namespace,
                        {
                            returnEntries:
                                true
                        }
                    )
                    : this.getAllEntries({
                        returnEntries:
                            true
                    });

            const rows =
                entries.map(
                    entry => ({
                        namespace:
                            entry.namespace,

                        key:
                            entry.key,

                        sizeBytes:
                            entry.sizeBytes,

                        accessCount:
                            entry.accessCount,

                        ttlMs:
                            entry.ttlMs,

                        createdAt:
                            new Date(
                                entry.createdAt
                            ).toISOString(),

                        updatedAt:
                            new Date(
                                entry.updatedAt
                            ).toISOString(),

                        expiresAt:
                            entry.expiresAt
                                ? new Date(
                                    entry.expiresAt
                                ).toISOString()
                                : null
                    })
                );

            console.table(rows);

            return rows;
        }

        destroy() {
            this.stopAutoCleanup();

            if (
                this.persistTimer !==
                null
            ) {
                global.clearTimeout(
                    this.persistTimer
                );

                this.persistTimer =
                    null;
            }

            this.persist();

            return true;
        }
    }

    const api =
        new RainArrivalCacheV32();

    global.RainArrivalCacheV32 =
        api;

    global.RainArrivalCacheClassV32 =
        RainArrivalCacheV32;

    global.RainArrivalCacheNamespacesV32 =
        CACHE_NAMESPACES;

    global.RainGuardAI =
        global.RainGuardAI || {};

    global.RainGuardAI.V32 =
        global.RainGuardAI.V32 || {};

    global.RainGuardAI.V32
        .rainArrivalModules =
        global.RainGuardAI.V32
            .rainArrivalModules || {};

    global.RainGuardAI.V32
        .rainArrivalModules
        .cache =
        api;

    if (
        global.RainArrivalEngineV32 &&
        typeof global
            .RainArrivalEngineV32
            .register === "function"
    ) {
        global.RainArrivalEngineV32
            .register(
                MODULE_NAME,
                api
            );
    }

    if (
        global
            .RainArrivalOrchestratorV32 &&
        typeof global
            .RainArrivalOrchestratorV32
            .register === "function"
    ) {
        global
            .RainArrivalOrchestratorV32
            .register(
                MODULE_NAME,
                api
            );
    }

    console.log(
        "[RainGuard AI V32] Unified Cache loaded.",
        {
            version:
                VERSION,

            build:
                BUILD
        }
    );

})(
    typeof globalThis !==
        "undefined"
        ? globalThis
        : window
);
