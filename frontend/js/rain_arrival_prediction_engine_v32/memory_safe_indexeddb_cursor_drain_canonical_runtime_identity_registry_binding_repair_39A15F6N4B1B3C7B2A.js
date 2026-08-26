/*
 * RainGuard AI
 * Phase 39A-15F6N4B1B3C7B2A
 *
 * Memory-Safe IndexedDB Cursor Drain
 * & Canonical Runtime Identity Registry Binding Repair
 */

(function (global) {
    "use strict";

    const PHASE = "39A-15F6N4B1B3C7B2A";
    const VERSION = "39A.15F6N4B1B3C7B2A.0";
    const BUILD =
        "rainguard-v39-memory-safe-indexeddb-cursor-drain-canonical-runtime-identity-registry-binding-repair";

    const BRIDGE_NAME =
        "RainGuard39A15F6N4B1B3C7B2ABridgeV39";

    const RUN_NAME =
        "runRainGuard39A15F6N4B1B3C7B2AMemorySafeIdentityDrain";

    const DIAG_NAME =
        "diagnoseRainGuard39A15F6N4B1B3C7B2AMemorySafeIdentityDrain";

    const C6_NAME =
        "RainGuard39A15F6N4B1B3C6BridgeV39";

    const C7A_NAME =
        "RainGuard39A15F6N4B1B3C7ABridgeV39";

    const C7B_NAME =
        "RainGuard39A15F6N4B1B3C7BBridgeV39";

    const C7B1_NAME =
        "RainGuard39A15F6N4B1B3C7B1BridgeV39";

    const MIN_COVERAGE_PERCENT = 99;

    const BATCH_SIZE = 100;
    const YIELD_EVERY = 50;
    const MAX_RECORDS_PER_RUN = 50000;

    const STATES = Object.freeze({
        IDLE:
            "IDLE",

        DISCOVERING_INDEXEDDB:
            "DISCOVERING_INDEXEDDB",

        DISCOVERING_RUNTIME_REGISTRY:
            "DISCOVERING_CANONICAL_RUNTIME_IDENTITY_REGISTRY",

        CURSOR_DRAINING:
            "MEMORY_SAFE_CURSOR_DRAINING",

        VERIFYING:
            "VERIFYING_IDENTITY_COVERAGE",

        COMPLETE:
            "MEMORY_SAFE_IDENTITY_REHYDRATION_COMPLETE",

        PARTIAL:
            "MEMORY_SAFE_IDENTITY_REHYDRATION_PARTIAL",

        BLOCKED:
            "CANONICAL_RUNTIME_IDENTITY_REGISTRY_NOT_FOUND",

        FAILED:
            "MEMORY_SAFE_IDENTITY_REHYDRATION_FAILED"
    });

    let installed = false;
    let running = false;
    let state = STATES.IDLE;

    let scannedRecordCount = 0;
    let extractedIdentityCount = 0;
    let insertedIdentityCount = 0;
    let skippedDuplicateCount = 0;
    let rejectedRecordCount = 0;

    let selectedDatabaseName = null;
    let selectedStoreName = null;
    let selectedRuntimeRegistryName = null;

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

    function normalizeError(error) {
        return {
            name: error?.name || "Error",
            message: error?.message || String(error),
            stack: error?.stack || null
        };
    }

    function getBridge(name) {
        const value = global[name];

        return value && typeof value === "object"
            ? value
            : null;
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

    function getIdentityKey(value) {
        if (!value || typeof value !== "object") {
            return null;
        }

        const candidates = [
            value.identityId,
            value.identityID,
            value.identity,
            value.stableIdentity,
            value.stableIdentityId,
            value.trackIdentity,
            value.trackIdentityId,
            value.trackId,
            value.entityId,
            value.entityID,
            value.stormId,
            value.cellId,
            value.id,
            value.key
        ];

        for (const candidate of candidates) {
            if (
                candidate !== null &&
                candidate !== undefined &&
                String(candidate).trim() !== ""
            ) {
                return String(candidate);
            }
        }

        return null;
    }

    function extractCanonicalIdentity(record) {
        if (!record || typeof record !== "object") {
            return null;
        }

        const directKey = getIdentityKey(record);

        if (directKey) {
            return {
                key: directKey,
                value: record
            };
        }

        const nestedCandidates = [
            record.identity,
            record.entity,
            record.track,
            record.storm,
            record.payload,
            record.data,
            record.value,
            record.observation,
            record.metadata
        ];

        for (const candidate of nestedCandidates) {
            const key = getIdentityKey(candidate);

            if (key) {
                return {
                    key,
                    value: candidate
                };
            }
        }

        return null;
    }

    function discoverCanonicalRuntimeRegistry() {
        state = STATES.DISCOVERING_RUNTIME_REGISTRY;

        const candidates = [
            {
                name: "RainGuardIntegratedIdentityPersistentRegistryV39",
                value: global.RainGuardIntegratedIdentityPersistentRegistryV39
            },
            {
                name: "RainGuardStableTrackIdentityRegistryV39",
                value: global.RainGuardStableTrackIdentityRegistryV39
            },
            {
                name: "RainGuardRuntimeIdentityRegistryV39",
                value: global.RainGuardRuntimeIdentityRegistryV39
            },
            {
                name: "RainGuardIdentityRegistryV39",
                value: global.RainGuardIdentityRegistryV39
            }
        ];

        for (const candidate of candidates) {
            const registry = candidate.value;

            if (!registry || typeof registry !== "object") {
                continue;
            }

            if (
                registry instanceof Map ||
                registry.byIdentity instanceof Map ||
                Array.isArray(registry.identities) ||
                typeof registry.set === "function" ||
                typeof registry.upsert === "function" ||
                typeof registry.register === "function" ||
                typeof registry.add === "function"
            ) {
                selectedRuntimeRegistryName =
                    candidate.name;

                return registry;
            }
        }

        return null;
    }

    function runtimeHasIdentity(registry, key) {
        if (!registry) {
            return false;
        }

        if (registry instanceof Map) {
            return registry.has(key);
        }

        if (registry.byIdentity instanceof Map) {
            return registry.byIdentity.has(key);
        }

        if (typeof registry.has === "function") {
            try {
                return registry.has(key);
            } catch (_) {}
        }

        if (typeof registry.get === "function") {
            try {
                return Boolean(registry.get(key));
            } catch (_) {}
        }

        if (Array.isArray(registry.identities)) {
            return registry.identities.some(
                item => getIdentityKey(item) === key
            );
        }

        return false;
    }

    function insertIntoRuntimeRegistry(
        registry,
        key,
        value
    ) {
        if (!registry) {
            return false;
        }

        if (registry instanceof Map) {
            registry.set(key, value);
            return true;
        }

        if (registry.byIdentity instanceof Map) {
            registry.byIdentity.set(key, value);
            return true;
        }

        if (typeof registry.upsert === "function") {
            registry.upsert(value);
            return true;
        }

        if (typeof registry.register === "function") {
            registry.register(value);
            return true;
        }

        if (typeof registry.set === "function") {
            try {
                registry.set(key, value);
                return true;
            } catch (_) {}
        }

        if (typeof registry.add === "function") {
            try {
                registry.add(value);
                return true;
            } catch (_) {}
        }

        if (Array.isArray(registry.identities)) {
            registry.identities.push(value);
            return true;
        }

        return false;
    }

    async function discoverIndexedDBSource() {
        state = STATES.DISCOVERING_INDEXEDDB;

        if (!global.indexedDB) {
            throw new Error("IndexedDB unavailable.");
        }

        const databases =
            typeof global.indexedDB.databases === "function"
                ? await global.indexedDB.databases()
                : [];

        const preferredNames = [
            "RainGuardTemporalHistoryV39",
            "RainGuardTemporalHistory",
            "RainGuardN4B1B3CTemporalHistoryV39",
            "RainGuard"
        ];

        const names = [
            ...new Set([
                ...preferredNames,
                ...databases
                    .map(db => db?.name)
                    .filter(Boolean)
            ])
        ];

        let best = null;

        for (const dbName of names) {
            let db = null;

            try {
                db = await openDatabase(dbName);

                const stores =
                    Array.from(db.objectStoreNames || []);

                for (const storeName of stores) {
                    const score =
                        scoreStoreName(storeName);

                    if (
                        !best ||
                        score > best.score
                    ) {
                        best = {
                            dbName,
                            storeName,
                            score
                        };
                    }
                }
            } catch (_) {
            } finally {
                try {
                    db?.close();
                } catch (_) {}
            }
        }

        if (!best) {
            throw new Error(
                "No IndexedDB source store discovered."
            );
        }

        selectedDatabaseName = best.dbName;
        selectedStoreName = best.storeName;

        return best;
    }

    function scoreStoreName(name) {
        const lower =
            String(name || "").toLowerCase();

        let score = 0;

        if (lower.includes("identity")) score += 100;
        if (lower.includes("track")) score += 50;
        if (lower.includes("temporal")) score += 25;
        if (lower.includes("history")) score += 20;
        if (lower.includes("metadata")) score -= 50;

        return score;
    }

    function openDatabase(name) {
        return new Promise((resolve, reject) => {
            const request =
                global.indexedDB.open(name);

            request.onsuccess =
                () => resolve(request.result);

            request.onerror =
                () => reject(
                    request.error ||
                    new Error("Failed to open IndexedDB.")
                );
        });
    }

    async function cursorDrain(
        dbName,
        storeName,
        runtimeRegistry
    ) {
        state = STATES.CURSOR_DRAINING;

        return new Promise((resolve, reject) => {
            const openRequest =
                global.indexedDB.open(dbName);

            openRequest.onerror = () => {
                reject(
                    openRequest.error ||
                    new Error("IndexedDB open failed.")
                );
            };

            openRequest.onsuccess = () => {
                const db = openRequest.result;

                let tx;
                let store;

                try {
                    tx =
                        db.transaction(
                            storeName,
                            "readonly"
                        );

                    store =
                        tx.objectStore(storeName);
                } catch (error) {
                    try {
                        db.close();
                    } catch (_) {}

                    reject(error);
                    return;
                }

                const cursorRequest =
                    store.openCursor();

                cursorRequest.onerror = () => {
                    try {
                        db.close();
                    } catch (_) {}

                    reject(
                        cursorRequest.error ||
                        new Error("Cursor failed.")
                    );
                };

                cursorRequest.onsuccess = async event => {
                    const cursor =
                        event.target.result;

                    if (!cursor) {
                        try {
                            db.close();
                        } catch (_) {}

                        resolve();
                        return;
                    }

                    if (
                        scannedRecordCount >=
                        MAX_RECORDS_PER_RUN
                    ) {
                        try {
                            db.close();
                        } catch (_) {}

                        resolve();
                        return;
                    }

                    scannedRecordCount += 1;

                    const extracted =
                        extractCanonicalIdentity(
                            cursor.value
                        );

                    if (!extracted) {
                        rejectedRecordCount += 1;
                        cursor.continue();
                        return;
                    }

                    extractedIdentityCount += 1;

                    const key =
                        extracted.key;

                    if (
                        runtimeHasIdentity(
                            runtimeRegistry,
                            key
                        )
                    ) {
                        skippedDuplicateCount += 1;
                    } else {
                        const inserted =
                            insertIntoRuntimeRegistry(
                                runtimeRegistry,
                                key,
                                extracted.value
                            );

                        if (inserted) {
                            insertedIdentityCount += 1;
                        } else {
                            rejectedRecordCount += 1;
                        }
                    }

                    if (
                        scannedRecordCount %
                            YIELD_EVERY ===
                        0
                    ) {
                        await sleep(0);
                    }

                    cursor.continue();
                };
            };
        });
    }

    async function readCoverage() {
        const c6 = getC6();

        if (
            c6 &&
            typeof c6.getIdentityCoverageReport === "function"
        ) {
            try {
                lastCoverage =
                    await c6.getIdentityCoverageReport();

                return lastCoverage;
            } catch (_) {}
        }

        return lastCoverage;
    }

    function coverageComplete(coverage) {
        return Boolean(
            coverage &&
            Number(
                coverage.coveragePercent
            ) >= MIN_COVERAGE_PERCENT &&
            Number(
                coverage.missingInRuntimeCount
            ) === 0 &&
            coverage.identityCoverageVerified === true
        );
    }

    async function releaseDownstream() {
        const results = {};

        const chain = [
            ["c7a", getC7A()],
            ["c7b", getC7B()],
            ["c7b1", getC7B1()]
        ];

        for (const [name, bridge] of chain) {
            if (
                bridge &&
                typeof bridge.run === "function"
            ) {
                try {
                    results[name] =
                        await bridge.run();
                } catch (error) {
                    results[
                        name + "Error"
                    ] =
                        normalizeError(error);
                }
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

        scannedRecordCount = 0;
        extractedIdentityCount = 0;
        insertedIdentityCount = 0;
        skippedDuplicateCount = 0;
        rejectedRecordCount = 0;

        lastError = null;

        try {
            const runtimeRegistry =
                discoverCanonicalRuntimeRegistry();

            if (!runtimeRegistry) {
                state = STATES.BLOCKED;

                lastResult = {
                    success: false,
                    phase: PHASE,
                    version: VERSION,
                    build: BUILD,
                    status:
                        "CANONICAL_RUNTIME_IDENTITY_REGISTRY_NOT_FOUND"
                };

                return lastResult;
            }

            const source =
                await discoverIndexedDBSource();

            await cursorDrain(
                source.dbName,
                source.storeName,
                runtimeRegistry
            );

            state = STATES.VERIFYING;

            await sleep(200);

            const coverage =
                await readCoverage();

            const complete =
                coverageComplete(coverage);

            let downstream = null;

            if (complete) {
                downstream =
                    await releaseDownstream();

                state =
                    STATES.COMPLETE;
            } else {
                state =
                    STATES.PARTIAL;
            }

            completedAt = now();

            lastResult = {
                success: complete,

                phase: PHASE,
                version: VERSION,
                build: BUILD,

                status:
                    complete
                        ? "MEMORY_SAFE_IDENTITY_REHYDRATION_COMPLETE"
                        : "MEMORY_SAFE_IDENTITY_REHYDRATION_PARTIAL",

                state,

                selectedDatabaseName,
                selectedStoreName,
                selectedRuntimeRegistryName,

                scannedRecordCount,
                extractedIdentityCount,
                insertedIdentityCount,
                skippedDuplicateCount,
                rejectedRecordCount,

                coverage,

                downstream,

                startedAt,
                completedAt,
                durationMs:
                    completedAt - startedAt
            };

            return lastResult;

        } catch (error) {
            state = STATES.FAILED;

            lastError =
                normalizeError(error);

            lastResult = {
                success: false,

                phase: PHASE,
                version: VERSION,
                build: BUILD,

                status:
                    "MEMORY_SAFE_IDENTITY_REHYDRATION_FAILED",

                state,

                selectedDatabaseName,
                selectedStoreName,
                selectedRuntimeRegistryName,

                scannedRecordCount,
                extractedIdentityCount,
                insertedIdentityCount,
                skippedDuplicateCount,
                rejectedRecordCount,

                error:
                    lastError
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
        } catch (_) {}

        const result = {
            success: true,

            phase: PHASE,
            version: VERSION,
            build: BUILD,

            installed,
            running,
            state,

            selectedDatabaseName,
            selectedStoreName,
            selectedRuntimeRegistryName,

            scannedRecordCount,
            extractedIdentityCount,
            insertedIdentityCount,
            skippedDuplicateCount,
            rejectedRecordCount,

            batchSize:
                BATCH_SIZE,

            yieldEvery:
                YIELD_EVERY,

            maxRecordsPerRun:
                MAX_RECORDS_PER_RUN,

            minimumCoveragePercent:
                MIN_COVERAGE_PERCENT,

            coverage,

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
        return coverageComplete(
            lastCoverage
        );
    }

    function install() {
        if (installed) {
            return bridge;
        }

        installed = true;

        console.log(
            `[RainGuard][${PHASE}] Installed`,
            {
                version: VERSION,
                memorySafe: true,
                cursorDrain: true,
                getAllDisabled: true
            }
        );

        return bridge;
    }

    const bridge = {
        phase: PHASE,
        version: VERSION,
        build: BUILD,

        states: STATES,

        install,
        run,
        diagnose,
        readCoverage,
        isComplete,

        get installed() {
            return installed;
        },

        get running() {
            return running;
        },

        get state() {
            return state;
        },

        get selectedDatabaseName() {
            return selectedDatabaseName;
        },

        get selectedStoreName() {
            return selectedStoreName;
        },

        get selectedRuntimeRegistryName() {
            return selectedRuntimeRegistryName;
        },

        get scannedRecordCount() {
            return scannedRecordCount;
        },

        get extractedIdentityCount() {
            return extractedIdentityCount;
        },

        get insertedIdentityCount() {
            return insertedIdentityCount;
        },

        get skippedDuplicateCount() {
            return skippedDuplicateCount;
        },

        get rejectedRecordCount() {
            return rejectedRecordCount;
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

    global.isRainGuard39A15F6N4B1B3C7B2AMemorySafeDrainComplete =
        isComplete;

    install();

})(window);
