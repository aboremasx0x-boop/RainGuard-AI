/*
 * RainGuard AI
 * Phase 39A-15F6N4B1B3C7B2
 *
 * IndexedDB -> Runtime Full Identity Rehydration
 * Drain & Completion Bridge
 */

(function (global) {
    "use strict";

    const PHASE = "39A-15F6N4B1B3C7B2";
    const VERSION = "39A.15F6N4B1B3C7B2.0";

    const BUILD =
        "rainguard-v39-indexeddb-runtime-full-identity-rehydration-drain-completion-bridge";

    const C2_NAME =
        "RainGuard39A15F6N4B1B3C2BridgeV39";

    const C6_NAME =
        "RainGuard39A15F6N4B1B3C6BridgeV39";

    const C7A_NAME =
        "RainGuard39A15F6N4B1B3C7ABridgeV39";

    const C7B_NAME =
        "RainGuard39A15F6N4B1B3C7BBridgeV39";

    const C7B1_NAME =
        "RainGuard39A15F6N4B1B3C7B1BridgeV39";

    const BRIDGE_NAME =
        "RainGuard39A15F6N4B1B3C7B2BridgeV39";

    const RUN_NAME =
        "runRainGuard39A15F6N4B1B3C7B2FullIdentityDrain";

    const DIAG_NAME =
        "diagnoseRainGuard39A15F6N4B1B3C7B2FullIdentityDrain";

    const MIN_COVERAGE_PERCENT = 99;

    const BATCH_SIZE = 250;
    const MAX_PASSES = 40;
    const PASS_SETTLE_MS = 120;
    const AUTO_START_DELAY_MS = 1800;

    const STATES = Object.freeze({
        IDLE:
            "IDLE",

        DISCOVERING_SOURCE:
            "DISCOVERING_INDEXEDDB_IDENTITY_SOURCE",

        READING_PERSISTED:
            "READING_PERSISTED_IDENTITIES",

        BUILDING_RUNTIME_INDEX:
            "BUILDING_RUNTIME_IDENTITY_INDEX",

        DRAINING:
            "DRAINING_INDEXEDDB_IDENTITIES_TO_RUNTIME",

        VERIFYING:
            "VERIFYING_RUNTIME_REHYDRATION_COMPLETION",

        COMPLETE:
            "INDEXEDDB_RUNTIME_FULL_IDENTITY_REHYDRATION_COMPLETE",

        PARTIAL:
            "INDEXEDDB_RUNTIME_IDENTITY_REHYDRATION_PARTIAL",

        FAILED:
            "INDEXEDDB_RUNTIME_IDENTITY_REHYDRATION_FAILED"
    });

    let installed = false;
    let running = false;
    let startupCompleted = false;

    let state = STATES.IDLE;

    let passCount = 0;
    let insertedIdentityCount = 0;
    let skippedDuplicateCount = 0;
    let rejectedIdentityCount = 0;

    let lastCoverage = null;
    let lastResult = null;
    let lastError = null;

    let startedAt = null;
    let completedAt = null;

    function now() {
        return Date.now();
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function getBridge(name) {
        const value = global[name];
        return value && typeof value === "object"
            ? value
            : null;
    }

    function getC2() {
        return getBridge(C2_NAME);
    }

    function getC6() {
        return getBridge(C6_NAME);
    }

    function getC7A() {
        return getBridge(C7A_NAME);
    }

    function getC7B() {
        return getBridge(C7B_NAME);
    }

    function getC7B1() {
        return getBridge(C7B1_NAME);
    }

    function normalizeError(error) {
        return {
            name: error?.name || "Error",
            message: error?.message || String(error),
            stack: error?.stack || null
        };
    }

    function toNumber(value, fallback = 0) {
        const n = Number(value);
        return Number.isFinite(n) ? n : fallback;
    }

    function getIdentityKey(item) {
        if (!item || typeof item !== "object") {
            return null;
        }

        return (
            item.identityId ??
            item.identityID ??
            item.stableIdentity ??
            item.stableIdentityId ??
            item.trackIdentity ??
            item.trackIdentityId ??
            item.trackId ??
            item.entityId ??
            item.id ??
            item.key ??
            null
        );
    }

    function getRuntimeStore() {
        const candidates = [
            global.RainGuardN4B1B3CTemporalCoordinateHistoryV39,
            global.RainGuardIntegratedIdentityPersistentRegistryV39,
            global.RainGuardStableTrackIdentityRegistryV39,
            global.RainGuardRuntimeIdentityRegistryV39,
            global.RainGuardIdentityRegistryV39
        ];

        for (const candidate of candidates) {
            if (candidate && typeof candidate === "object") {
                return candidate;
            }
        }

        return null;
    }

    function extractRuntimeEntries(store) {
        if (!store) {
            return [];
        }

        if (Array.isArray(store)) {
            return store;
        }

        if (store instanceof Map) {
            return Array.from(store.values());
        }

        if (store instanceof Set) {
            return Array.from(store.values());
        }

        if (Array.isArray(store.identities)) {
            return store.identities;
        }

        if (Array.isArray(store.records)) {
            return store.records;
        }

        if (Array.isArray(store.items)) {
            return store.items;
        }

        if (store.byIdentity instanceof Map) {
            return Array.from(store.byIdentity.values());
        }

        return Object.values(store).filter(
            value =>
                value &&
                typeof value === "object"
        );
    }

    function buildRuntimeIdentityIndex() {
        state = STATES.BUILDING_RUNTIME_INDEX;

        const store = getRuntimeStore();
        const entries = extractRuntimeEntries(store);

        const index = new Set();

        for (const item of entries) {
            const key = getIdentityKey(item);

            if (key !== null && key !== undefined) {
                index.add(String(key));
            }
        }

        return {
            store,
            entries,
            index
        };
    }

    async function readPersistedIdentities() {
        state = STATES.READING_PERSISTED;

        const c2 = getC2();

        const candidateFns = [
            c2?.getAllTemporalHistory,
            c2?.getAllPersistedTemporalHistory,
            c2?.getAllPersistedIdentities,
            global.getRainGuard39A15F6N4B1B3C2IndexedDBTemporalHistory,
            global.getRainGuard39A15F6N4B1B3C2AllPersistedTemporalHistory
        ].filter(fn => typeof fn === "function");

        for (const fn of candidateFns) {
            try {
                const result = await fn();

                if (Array.isArray(result)) {
                    return result;
                }

                if (Array.isArray(result?.records)) {
                    return result.records;
                }

                if (Array.isArray(result?.items)) {
                    return result.items;
                }

                if (Array.isArray(result?.identities)) {
                    return result.identities;
                }
            } catch (_) {}
        }

        /*
         * Fallback:
         * use IndexedDB directly.
         */

        return await readIndexedDBDirectly();
    }

    function openDatabase(name) {
        return new Promise((resolve, reject) => {
            const request =
                global.indexedDB.open(name);

            request.onsuccess =
                () => resolve(request.result);

            request.onerror =
                () => reject(request.error);
        });
    }

    function readObjectStore(db, storeName) {
        return new Promise((resolve, reject) => {
            const tx =
                db.transaction(
                    storeName,
                    "readonly"
                );

            const store =
                tx.objectStore(storeName);

            const request =
                store.getAll();

            request.onsuccess =
                () => resolve(
                    Array.isArray(request.result)
                        ? request.result
                        : []
                );

            request.onerror =
                () => reject(request.error);
        });
    }

    async function readIndexedDBDirectly() {
        if (!global.indexedDB) {
            throw new Error(
                "IndexedDB is unavailable."
            );
        }

        const dbCandidates = [
            "RainGuardTemporalHistoryV39",
            "RainGuardTemporalHistory",
            "rainguard-v39",
            "RainGuard"
        ];

        const storeCandidates = [
            "temporalHistory",
            "identities",
            "identityHistory",
            "history",
            "records"
        ];

        let best = [];

        for (const dbName of dbCandidates) {
            let db = null;

            try {
                db =
                    await openDatabase(dbName);

                const availableStores =
                    Array.from(
                        db.objectStoreNames || []
                    );

                for (const storeName of storeCandidates) {
                    if (
                        !availableStores.includes(storeName)
                    ) {
                        continue;
                    }

                    try {
                        const records =
                            await readObjectStore(
                                db,
                                storeName
                            );

                        if (
                            records.length >
                            best.length
                        ) {
                            best = records;
                        }
                    } catch (_) {}
                }
            } catch (_) {
            } finally {
                try {
                    db?.close();
                } catch (_) {}
            }
        }

        if (!best.length) {
            throw new Error(
                "No readable persisted identity collection found in IndexedDB."
            );
        }

        return best;
    }

    function pushIntoRuntimeStore(
        runtimeStore,
        item,
        identityKey
    ) {
        if (!runtimeStore) {
            return false;
        }

        if (runtimeStore instanceof Map) {
            runtimeStore.set(
                String(identityKey),
                item
            );

            return true;
        }

        if (Array.isArray(runtimeStore)) {
            runtimeStore.push(item);
            return true;
        }

        if (runtimeStore.byIdentity instanceof Map) {
            runtimeStore.byIdentity.set(
                String(identityKey),
                item
            );

            return true;
        }

        if (Array.isArray(runtimeStore.identities)) {
            runtimeStore.identities.push(item);
            return true;
        }

        if (Array.isArray(runtimeStore.records)) {
            runtimeStore.records.push(item);
            return true;
        }

        /*
         * Generic object fallback.
         */

        runtimeStore[String(identityKey)] =
            item;

        return true;
    }

    async function readCoverage() {
        const c6 = getC6();

        if (
            c6 &&
            typeof c6.getIdentityCoverageReport ===
                "function"
        ) {
            try {
                const report =
                    await c6.getIdentityCoverageReport();

                lastCoverage = report;

                return report;
            } catch (_) {}
        }

        const runtimeInfo =
            buildRuntimeIdentityIndex();

        const persisted =
            await readPersistedIdentities();

        const persistedKeys =
            new Set();

        for (const item of persisted) {
            const key = getIdentityKey(item);

            if (key !== null && key !== undefined) {
                persistedKeys.add(String(key));
            }
        }

        let matched = 0;

        for (const key of persistedKeys) {
            if (runtimeInfo.index.has(key)) {
                matched += 1;
            }
        }

        const persistedCount =
            persistedKeys.size;

        const runtimeCount =
            runtimeInfo.index.size;

        const missing =
            Math.max(
                0,
                persistedCount - matched
            );

        const coveragePercent =
            persistedCount > 0
                ? Number(
                    (
                        matched /
                        persistedCount *
                        100
                    ).toFixed(2)
                )
                : 100;

        lastCoverage = {
            persistedUniqueIdentityCount:
                persistedCount,

            runtimeIdentityCount:
                runtimeCount,

            matchedIdentityCount:
                matched,

            missingInRuntimeCount:
                missing,

            coveragePercent,

            identityCoverageVerified:
                missing === 0 &&
                coveragePercent >=
                    MIN_COVERAGE_PERCENT
        };

        return lastCoverage;
    }

    async function drainPass() {
        passCount += 1;
        state = STATES.DRAINING;

        const persisted =
            await readPersistedIdentities();

        const runtime =
            buildRuntimeIdentityIndex();

        if (!runtime.store) {
            throw new Error(
                "No writable RainGuard runtime identity store discovered."
            );
        }

        let insertedThisPass = 0;

        for (
            let offset = 0;
            offset < persisted.length;
            offset += BATCH_SIZE
        ) {
            const batch =
                persisted.slice(
                    offset,
                    offset + BATCH_SIZE
                );

            for (const item of batch) {
                const key =
                    getIdentityKey(item);

                if (
                    key === null ||
                    key === undefined
                ) {
                    rejectedIdentityCount += 1;
                    continue;
                }

                const normalizedKey =
                    String(key);

                if (
                    runtime.index.has(
                        normalizedKey
                    )
                ) {
                    skippedDuplicateCount += 1;
                    continue;
                }

                const inserted =
                    pushIntoRuntimeStore(
                        runtime.store,
                        item,
                        normalizedKey
                    );

                if (inserted) {
                    runtime.index.add(
                        normalizedKey
                    );

                    insertedIdentityCount += 1;
                    insertedThisPass += 1;
                } else {
                    rejectedIdentityCount += 1;
                }
            }

            /*
             * Yield to UI/event loop.
             */

            await sleep(0);
        }

        return insertedThisPass;
    }

    function coverageComplete(coverage) {
        return Boolean(
            coverage &&
            coverage.persistedUniqueIdentityCount > 0 &&
            coverage.missingInRuntimeCount === 0 &&
            coverage.coveragePercent >=
                MIN_COVERAGE_PERCENT &&
            coverage.identityCoverageVerified ===
                true
        );
    }

    async function releaseDownstream() {
        const c7a = getC7A();
        const c7b = getC7B();
        const c7b1 = getC7B1();

        const results = {};

        if (
            c7a &&
            typeof c7a.run === "function"
        ) {
            try {
                results.c7a =
                    await c7a.run();
            } catch (error) {
                results.c7aError =
                    normalizeError(error);
            }
        }

        if (
            c7b &&
            typeof c7b.run === "function"
        ) {
            try {
                results.c7b =
                    await c7b.run();
            } catch (error) {
                results.c7bError =
                    normalizeError(error);
            }
        }

        if (
            c7b1 &&
            typeof c7b1.run === "function"
        ) {
            try {
                results.c7b1 =
                    await c7b1.run();
            } catch (error) {
                results.c7b1Error =
                    normalizeError(error);
            }
        }

        return results;
    }

    async function run() {
        if (running) {
            return lastResult;
        }

        running = true;
        startedAt = now();
        lastError = null;

        try {
            state =
                STATES.DISCOVERING_SOURCE;

            for (
                let pass = 1;
                pass <= MAX_PASSES;
                pass += 1
            ) {
                let coverage =
                    await readCoverage();

                if (coverageComplete(coverage)) {
                    state = STATES.COMPLETE;
                    break;
                }

                const inserted =
                    await drainPass();

                await sleep(
                    PASS_SETTLE_MS
                );

                state =
                    STATES.VERIFYING;

                coverage =
                    await readCoverage();

                if (coverageComplete(coverage)) {
                    state = STATES.COMPLETE;
                    break;
                }

                /*
                 * Nothing inserted means the chosen runtime store
                 * cannot absorb remaining identities.
                 */

                if (inserted === 0) {
                    state = STATES.PARTIAL;
                    break;
                }
            }

            const coverage =
                await readCoverage();

            const complete =
                coverageComplete(
                    coverage
                );

            let downstream = null;

            if (complete) {
                downstream =
                    await releaseDownstream();
            }

            startupCompleted = true;
            completedAt = now();

            lastResult = {
                success:
                    complete,

                phase:
                    PHASE,

                version:
                    VERSION,

                build:
                    BUILD,

                status:
                    complete
                        ? "INDEXEDDB_RUNTIME_FULL_IDENTITY_REHYDRATION_COMPLETE"
                        : "INDEXEDDB_RUNTIME_IDENTITY_REHYDRATION_PARTIAL",

                state,

                coverage,

                passCount,

                insertedIdentityCount,
                skippedDuplicateCount,
                rejectedIdentityCount,

                downstream,

                startedAt,
                completedAt,

                durationMs:
                    completedAt - startedAt
            };

            return lastResult;

        } catch (error) {
            state =
                STATES.FAILED;

            lastError =
                normalizeError(error);

            lastResult = {
                success: false,

                phase:
                    PHASE,

                version:
                    VERSION,

                build:
                    BUILD,

                status:
                    "INDEXEDDB_RUNTIME_IDENTITY_REHYDRATION_FAILED",

                error:
                    lastError,

                passCount,

                insertedIdentityCount,
                skippedDuplicateCount,
                rejectedIdentityCount
            };

            return lastResult;

        } finally {
            running = false;
        }
    }

    async function diagnose() {
        let coverage = null;

        try {
            coverage =
                await readCoverage();
        } catch (error) {
            coverage = {
                error:
                    normalizeError(error)
            };
        }

        const result = {
            success: true,

            phase:
                PHASE,

            version:
                VERSION,

            build:
                BUILD,

            installed,
            running,
            startupCompleted,

            state,

            passCount,

            insertedIdentityCount,
            skippedDuplicateCount,
            rejectedIdentityCount,

            batchSize:
                BATCH_SIZE,

            maxPasses:
                MAX_PASSES,

            minimumCoveragePercent:
                MIN_COVERAGE_PERCENT,

            coverage,

            c2Available:
                Boolean(getC2()),

            c6Available:
                Boolean(getC6()),

            c7aAvailable:
                Boolean(getC7A()),

            c7bAvailable:
                Boolean(getC7B()),

            c7b1Available:
                Boolean(getC7B1()),

            lastResult,
            lastError
        };

        console.log(
            `[RainGuard][${PHASE}] Diagnostics:`,
            result
        );

        return result;
    }

    function isComplete() {
        return Boolean(
            lastCoverage &&
            coverageComplete(lastCoverage)
        );
    }

    function install() {
        if (installed) {
            return bridge;
        }

        installed = true;

        setTimeout(
            function () {
                run().catch(
                    function (error) {
                        console.error(
                            `[RainGuard][${PHASE}] Auto-start failed:`,
                            error
                        );
                    }
                );
            },
            AUTO_START_DELAY_MS
        );

        console.log(
            `[RainGuard][${PHASE}] Installed`,
            {
                version:
                    VERSION,

                batchSize:
                    BATCH_SIZE,

                maxPasses:
                    MAX_PASSES,

                autoStart:
                    true
            }
        );

        return bridge;
    }

    const bridge = {
        phase:
            PHASE,

        version:
            VERSION,

        build:
            BUILD,

        states:
            STATES,

        run,
        diagnose,
        readCoverage,
        isComplete,
        install,

        get installed() {
            return installed;
        },

        get running() {
            return running;
        },

        get startupCompleted() {
            return startupCompleted;
        },

        get state() {
            return state;
        },

        get passCount() {
            return passCount;
        },

        get insertedIdentityCount() {
            return insertedIdentityCount;
        },

        get skippedDuplicateCount() {
            return skippedDuplicateCount;
        },

        get rejectedIdentityCount() {
            return rejectedIdentityCount;
        },

        get lastCoverage() {
            return lastCoverage;
        },

        get lastResult() {
            return lastResult;
        },

        get lastError() {
            return lastError;
        }
    };

    global[BRIDGE_NAME] =
        bridge;

    global[RUN_NAME] =
        run;

    global[DIAG_NAME] =
        diagnose;

    global.isRainGuard39A15F6N4B1B3C7B2RehydrationComplete =
        isComplete;

    install();

})(window);
