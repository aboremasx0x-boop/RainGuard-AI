/*
 * RainGuard AI
 * Phase 39A-15F6N4B1B3C7B2A
 *
 * Memory-Safe IndexedDB Cursor Drain
 * & Canonical Runtime Identity Registry Binding Repair
 *
 * Transaction-Safe Revision
 */

(function (global) {
    "use strict";

    const PHASE = "39A-15F6N4B1B3C7B2A";
    const VERSION = "39A.15F6N4B1B3C7B2A.1";

    const BUILD =
        "rainguard-v39-memory-safe-indexeddb-cursor-drain-canonical-runtime-identity-registry-binding-repair-transaction-safe";

    const BRIDGE_NAME =
        "RainGuard39A15F6N4B1B3C7B2ABridgeV39";

    const RUN_NAME =
        "runRainGuard39A15F6N4B1B3C7B2AMemorySafeIdentityDrain";

    const DIAG_NAME =
        "diagnoseRainGuard39A15F6N4B1B3C7B2AMemorySafeIdentityDrain";

    /*
     * Confirmed IndexedDB structure.
     *
     * DATABASE:
     * RainGuardTemporalHistoryV39
     *
     * STORES:
     * metadata
     * temporalHistory
     */
    const AUTHORITATIVE_DB_NAME =
        "RainGuardTemporalHistoryV39";

    const AUTHORITATIVE_STORE_NAME =
        "temporalHistory";

    const C6_NAME =
        "RainGuard39A15F6N4B1B3C6BridgeV39";

    const C7A_NAME =
        "RainGuard39A15F6N4B1B3C7ABridgeV39";

    const C7B_NAME =
        "RainGuard39A15F6N4B1B3C7BBridgeV39";

    const C7B1_NAME =
        "RainGuard39A15F6N4B1B3C7B1BridgeV39";

    const MIN_COVERAGE_PERCENT = 99;

    /*
     * Cursor limits.
     */
    const BATCH_SIZE = 100;

    /*
     * IMPORTANT:
     * We no longer yield with await inside cursor.onsuccess.
     *
     * IndexedDB cursor events already execute asynchronously.
     */
    const MAX_RECORDS_PER_RUN = 50000;

    /*
     * Protection against IndexedDB hanging indefinitely.
     */
    const DATABASE_OPEN_TIMEOUT_MS = 10000;
    const CURSOR_IDLE_TIMEOUT_MS = 15000;

    const STATES = Object.freeze({
        IDLE:
            "IDLE",

        DISCOVERING_INDEXEDDB:
            "DISCOVERING_INDEXEDDB",

        DISCOVERING_RUNTIME_REGISTRY:
            "DISCOVERING_CANONICAL_RUNTIME_IDENTITY_REGISTRY",

        INDEXEDDB_SOURCE_READY:
            "INDEXEDDB_AUTHORITATIVE_SOURCE_READY",

        BUILDING_RUNTIME_INDEX:
            "BUILDING_RUNTIME_IDENTITY_INDEX",

        CURSOR_DRAINING:
            "MEMORY_SAFE_TRANSACTION_SAFE_CURSOR_DRAINING",

        VERIFYING:
            "VERIFYING_IDENTITY_COVERAGE",

        COMPLETE:
            "MEMORY_SAFE_IDENTITY_REHYDRATION_COMPLETE",

        PARTIAL:
            "MEMORY_SAFE_IDENTITY_REHYDRATION_PARTIAL",

        BLOCKED:
            "CANONICAL_RUNTIME_IDENTITY_REGISTRY_NOT_FOUND",

        DATABASE_BLOCKED:
            "AUTHORITATIVE_INDEXEDDB_SOURCE_NOT_AVAILABLE",

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

    let runtimeIdentityIndexSize = 0;

    function now() {
        return Date.now();
    }

    function sleep(ms) {
        return new Promise(resolve =>
            setTimeout(resolve, ms)
        );
    }

    function normalizeError(error) {
        return {
            name:
                error?.name ||
                "Error",

            message:
                error?.message ||
                String(error),

            stack:
                error?.stack ||
                null
        };
    }

    function getBridge(name) {
        const value =
            global[name];

        return (
            value &&
            typeof value === "object"
        )
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

    /*
     * ---------------------------------------------------------
     * Identity extraction
     * ---------------------------------------------------------
     */

    function normalizeIdentityKey(value) {
        if (
            value === null ||
            value === undefined
        ) {
            return null;
        }

        const text =
            String(value).trim();

        return text
            ? text
            : null;
    }

    function getIdentityKey(value) {
        if (
            !value ||
            typeof value !== "object"
        ) {
            return null;
        }

        /*
         * canonicalTrackId is intentionally first.
         *
         * Our direct IndexedDB inspection confirmed records such as:
         *
         * canonicalTrackId: "Abha"
         * identity: "Abha"
         */
        const candidates = [
            value.canonicalTrackId,
            value.canonicalIdentity,
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
            const normalized =
                normalizeIdentityKey(candidate);

            if (normalized) {
                return normalized;
            }
        }

        return null;
    }

    function extractCanonicalIdentity(record) {
        if (
            !record ||
            typeof record !== "object"
        ) {
            return null;
        }

        /*
         * Direct canonical identity.
         */
        const directKey =
            getIdentityKey(record);

        if (directKey) {
            return {
                key: directKey,
                value: record
            };
        }

        /*
         * Fallback nested structures.
         */
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

        for (
            const candidate
            of nestedCandidates
        ) {
            if (
                !candidate ||
                typeof candidate !== "object"
            ) {
                continue;
            }

            const key =
                getIdentityKey(candidate);

            if (key) {
                return {
                    key,
                    value: candidate
                };
            }
        }

        return null;
    }

    /*
     * ---------------------------------------------------------
     * Canonical runtime registry discovery
     * ---------------------------------------------------------
     */

    function discoverCanonicalRuntimeRegistry() {
        state =
            STATES.DISCOVERING_RUNTIME_REGISTRY;

        const candidates = [
            {
                name:
                    "RainGuardIntegratedIdentityPersistentRegistryV39",

                value:
                    global
                        .RainGuardIntegratedIdentityPersistentRegistryV39
            },

            {
                name:
                    "RainGuardStableTrackIdentityRegistryV39",

                value:
                    global
                        .RainGuardStableTrackIdentityRegistryV39
            },

            {
                name:
                    "RainGuardRuntimeIdentityRegistryV39",

                value:
                    global
                        .RainGuardRuntimeIdentityRegistryV39
            },

            {
                name:
                    "RainGuardIdentityRegistryV39",

                value:
                    global
                        .RainGuardIdentityRegistryV39
            }
        ];

        for (
            const candidate
            of candidates
        ) {
            const registry =
                candidate.value;

            if (
                !registry ||
                typeof registry !== "object"
            ) {
                continue;
            }

            const supported =
                registry instanceof Map ||

                registry.byIdentity
                    instanceof Map ||

                Array.isArray(
                    registry.identities
                ) ||

                typeof registry.set
                    === "function" ||

                typeof registry.upsert
                    === "function" ||

                typeof registry.register
                    === "function" ||

                typeof registry.add
                    === "function";

            if (!supported) {
                continue;
            }

            selectedRuntimeRegistryName =
                candidate.name;

            return registry;
        }

        selectedRuntimeRegistryName =
            null;

        return null;
    }

    /*
     * ---------------------------------------------------------
     * Runtime identity index
     *
     * Prevents O(N x N) duplicate scans when the registry uses
     * an Array.
     * ---------------------------------------------------------
     */

    function buildRuntimeIdentityIndex(
        registry
    ) {
        state =
            STATES.BUILDING_RUNTIME_INDEX;

        const index =
            new Set();

        if (!registry) {
            return index;
        }

        if (registry instanceof Map) {
            for (
                const key
                of registry.keys()
            ) {
                const normalized =
                    normalizeIdentityKey(key);

                if (normalized) {
                    index.add(normalized);
                }
            }
        }

        if (
            registry.byIdentity
            instanceof Map
        ) {
            for (
                const key
                of registry.byIdentity.keys()
            ) {
                const normalized =
                    normalizeIdentityKey(key);

                if (normalized) {
                    index.add(normalized);
                }
            }
        }

        if (
            Array.isArray(
                registry.identities
            )
        ) {
            for (
                const item
                of registry.identities
            ) {
                const key =
                    getIdentityKey(item);

                if (key) {
                    index.add(key);
                }
            }
        }

        runtimeIdentityIndexSize =
            index.size;

        return index;
    }

    function runtimeHasIdentity(
        registry,
        key,
        identityIndex
    ) {
        if (!registry || !key) {
            return false;
        }

        /*
         * Fast path.
         */
        if (
            identityIndex &&
            identityIndex.has(key)
        ) {
            return true;
        }

        if (registry instanceof Map) {
            return registry.has(key);
        }

        if (
            registry.byIdentity
            instanceof Map
        ) {
            return registry
                .byIdentity
                .has(key);
        }

        if (
            typeof registry.has
            === "function"
        ) {
            try {
                return registry.has(key);
            } catch (_) {}
        }

        if (
            typeof registry.get
            === "function"
        ) {
            try {
                return Boolean(
                    registry.get(key)
                );
            } catch (_) {}
        }

        return false;
    }

    function insertIntoRuntimeRegistry(
        registry,
        key,
        value
    ) {
        if (
            !registry ||
            !key
        ) {
            return false;
        }

        if (registry instanceof Map) {
            registry.set(
                key,
                value
            );

            return true;
        }

        if (
            registry.byIdentity
            instanceof Map
        ) {
            registry
                .byIdentity
                .set(
                    key,
                    value
                );

            return true;
        }

        if (
            typeof registry.upsert
            === "function"
        ) {
            try {
                registry.upsert(value);
                return true;
            } catch (_) {}
        }

        if (
            typeof registry.register
            === "function"
        ) {
            try {
                registry.register(value);
                return true;
            } catch (_) {}
        }

        if (
            typeof registry.set
            === "function"
        ) {
            try {
                registry.set(
                    key,
                    value
                );

                return true;
            } catch (_) {}
        }

        if (
            typeof registry.add
            === "function"
        ) {
            try {
                registry.add(value);
                return true;
            } catch (_) {}
        }

        if (
            Array.isArray(
                registry.identities
            )
        ) {
            try {
                registry
                    .identities
                    .push(value);

                return true;
            } catch (_) {}
        }

        return false;
    }

    /*
     * ---------------------------------------------------------
     * IndexedDB helpers
     * ---------------------------------------------------------
     */

    function openDatabase(
        name,
        timeoutMs =
            DATABASE_OPEN_TIMEOUT_MS
    ) {
        return new Promise(
            (resolve, reject) => {

                let settled = false;

                const timer =
                    setTimeout(() => {
                        if (settled) {
                            return;
                        }

                        settled = true;

                        reject(
                            new Error(
                                `IndexedDB open timeout: ${name}`
                            )
                        );
                    }, timeoutMs);

                let request;

                try {
                    request =
                        global
                            .indexedDB
                            .open(name);
                } catch (error) {
                    clearTimeout(timer);

                    settled = true;

                    reject(error);
                    return;
                }

                request.onsuccess = () => {
                    if (settled) {
                        try {
                            request
                                .result
                                ?.close();
                        } catch (_) {}

                        return;
                    }

                    settled = true;

                    clearTimeout(timer);

                    resolve(
                        request.result
                    );
                };

                request.onerror = () => {
                    if (settled) {
                        return;
                    }

                    settled = true;

                    clearTimeout(timer);

                    reject(
                        request.error ||
                        new Error(
                            `Failed to open IndexedDB: ${name}`
                        )
                    );
                };

                request.onblocked = () => {
                    console.warn(
                        `[RainGuard][${PHASE}] IndexedDB open blocked`,
                        { name }
                    );
                };
            }
        );
    }

    /*
     * ---------------------------------------------------------
     * Authoritative IndexedDB source discovery
     * ---------------------------------------------------------
     */

    async function discoverIndexedDBSource() {
        state =
            STATES.DISCOVERING_INDEXEDDB;

        if (!global.indexedDB) {
            throw new Error(
                "IndexedDB unavailable."
            );
        }

        /*
         * We already verified this DB and store manually.
         *
         * Do not scan/open arbitrary preferred database names.
         * Opening a non-existing database name can create an empty
         * IndexedDB database and pollute discovery.
         */
        let db = null;

        try {
            db =
                await openDatabase(
                    AUTHORITATIVE_DB_NAME
                );

            const stores =
                Array.from(
                    db.objectStoreNames ||
                    []
                );

            if (
                !stores.includes(
                    AUTHORITATIVE_STORE_NAME
                )
            ) {
                throw new Error(
                    `Authoritative store not found: ${AUTHORITATIVE_STORE_NAME}`
                );
            }

            selectedDatabaseName =
                AUTHORITATIVE_DB_NAME;

            selectedStoreName =
                AUTHORITATIVE_STORE_NAME;

            state =
                STATES.INDEXEDDB_SOURCE_READY;

            return {
                dbName:
                    AUTHORITATIVE_DB_NAME,

                storeName:
                    AUTHORITATIVE_STORE_NAME,

                availableStores:
                    stores
            };

        } finally {
            try {
                db?.close();
            } catch (_) {}
        }
    }

    /*
     * ---------------------------------------------------------
     * Transaction-safe cursor drain
     * ---------------------------------------------------------
     *
     * CRITICAL RULE:
     *
     * Never use:
     *
     *     await sleep(...)
     *
     * between:
     *
     *     cursorRequest.onsuccess
     *
     * and:
     *
     *     cursor.continue()
     *
     * Otherwise IndexedDB may auto-commit the transaction and
     * cursor.continue() can stall or throw
     * TransactionInactiveError.
     * ---------------------------------------------------------
     */

    async function cursorDrain(
        dbName,
        storeName,
        runtimeRegistry
    ) {
        state =
            STATES.CURSOR_DRAINING;

        const identityIndex =
            buildRuntimeIdentityIndex(
                runtimeRegistry
            );

        state =
            STATES.CURSOR_DRAINING;

        return new Promise(
            (resolve, reject) => {

                let settled = false;
                let db = null;
                let tx = null;
                let cursorIdleTimer = null;

                function clearCursorTimer() {
                    if (cursorIdleTimer) {
                        clearTimeout(
                            cursorIdleTimer
                        );

                        cursorIdleTimer =
                            null;
                    }
                }

                function safeCloseDatabase() {
                    try {
                        db?.close();
                    } catch (_) {}
                }

                function finishSuccess() {
                    if (settled) {
                        return;
                    }

                    settled = true;

                    clearCursorTimer();
                    safeCloseDatabase();

                    runtimeIdentityIndexSize =
                        identityIndex.size;

                    resolve({
                        success: true,

                        scannedRecordCount,
                        extractedIdentityCount,
                        insertedIdentityCount,
                        skippedDuplicateCount,
                        rejectedRecordCount,

                        runtimeIdentityIndexSize
                    });
                }

                function finishFailure(
                    error
                ) {
                    if (settled) {
                        return;
                    }

                    settled = true;

                    clearCursorTimer();

                    try {
                        tx?.abort();
                    } catch (_) {}

                    safeCloseDatabase();

                    reject(error);
                }

                function resetCursorIdleTimer() {
                    clearCursorTimer();

                    cursorIdleTimer =
                        setTimeout(() => {
                            finishFailure(
                                new Error(
                                    `IndexedDB cursor idle timeout after ${CURSOR_IDLE_TIMEOUT_MS} ms`
                                )
                            );
                        }, CURSOR_IDLE_TIMEOUT_MS);
                }

                let openRequest;

                try {
                    openRequest =
                        global
                            .indexedDB
                            .open(dbName);
                } catch (error) {
                    finishFailure(error);
                    return;
                }

                const openTimer =
                    setTimeout(() => {
                        finishFailure(
                            new Error(
                                `IndexedDB cursor source open timeout: ${dbName}`
                            )
                        );
                    }, DATABASE_OPEN_TIMEOUT_MS);

                openRequest.onerror =
                    () => {
                        clearTimeout(
                            openTimer
                        );

                        finishFailure(
                            openRequest.error ||
                            new Error(
                                "IndexedDB open failed."
                            )
                        );
                    };

                openRequest.onblocked =
                    () => {
                        console.warn(
                            `[RainGuard][${PHASE}] Cursor source open blocked`,
                            {
                                dbName,
                                storeName
                            }
                        );
                    };

                openRequest.onsuccess =
                    () => {
                        clearTimeout(
                            openTimer
                        );

                        if (settled) {
                            try {
                                openRequest
                                    .result
                                    ?.close();
                            } catch (_) {}

                            return;
                        }

                        db =
                            openRequest.result;

                        try {
                            tx =
                                db.transaction(
                                    storeName,
                                    "readonly"
                                );
                        } catch (error) {
                            finishFailure(error);
                            return;
                        }

                        let store;

                        try {
                            store =
                                tx.objectStore(
                                    storeName
                                );
                        } catch (error) {
                            finishFailure(error);
                            return;
                        }

                        tx.onerror =
                            () => {
                                if (settled) {
                                    return;
                                }

                                finishFailure(
                                    tx.error ||
                                    new Error(
                                        "IndexedDB transaction failed."
                                    )
                                );
                            };

                        tx.onabort =
                            () => {
                                if (settled) {
                                    return;
                                }

                                finishFailure(
                                    tx.error ||
                                    new Error(
                                        "IndexedDB transaction aborted."
                                    )
                                );
                            };

                        /*
                         * When cursor naturally stops,
                         * transaction completion is the clean
                         * finalization point.
                         */
                        tx.oncomplete =
                            () => {
                                if (!settled) {
                                    finishSuccess();
                                }
                            };

                        let cursorRequest;

                        try {
                            cursorRequest =
                                store.openCursor();
                        } catch (error) {
                            finishFailure(error);
                            return;
                        }

                        resetCursorIdleTimer();

                        cursorRequest.onerror =
                            () => {
                                finishFailure(
                                    cursorRequest.error ||
                                    new Error(
                                        "IndexedDB cursor failed."
                                    )
                                );
                            };

                        /*
                         * DO NOT make this callback async.
                         */
                        cursorRequest.onsuccess =
                            event => {

                                if (settled) {
                                    return;
                                }

                                resetCursorIdleTimer();

                                const cursor =
                                    event
                                        .target
                                        .result;

                                /*
                                 * End of store.
                                 *
                                 * Do not resolve here.
                                 * Allow tx.oncomplete to finalize.
                                 */
                                if (!cursor) {
                                    clearCursorTimer();
                                    return;
                                }

                                /*
                                 * Controlled safety ceiling.
                                 */
                                if (
                                    scannedRecordCount >=
                                    MAX_RECORDS_PER_RUN
                                ) {
                                    clearCursorTimer();

                                    /*
                                     * Do not cursor.continue().
                                     * The readonly transaction
                                     * will complete naturally.
                                     */
                                    return;
                                }

                                scannedRecordCount += 1;

                                const extracted =
                                    extractCanonicalIdentity(
                                        cursor.value
                                    );

                                if (!extracted) {
                                    rejectedRecordCount += 1;

                                    try {
                                        cursor.continue();
                                    } catch (error) {
                                        finishFailure(error);
                                    }

                                    return;
                                }

                                extractedIdentityCount += 1;

                                const key =
                                    extracted.key;

                                if (
                                    runtimeHasIdentity(
                                        runtimeRegistry,
                                        key,
                                        identityIndex
                                    )
                                ) {
                                    skippedDuplicateCount += 1;

                                    identityIndex.add(key);

                                } else {
                                    let inserted = false;

                                    try {
                                        inserted =
                                            insertIntoRuntimeRegistry(
                                                runtimeRegistry,
                                                key,
                                                extracted.value
                                            );
                                    } catch (_) {
                                        inserted = false;
                                    }

                                    if (inserted) {
                                        insertedIdentityCount += 1;

                                        identityIndex.add(key);

                                    } else {
                                        rejectedRecordCount += 1;
                                    }
                                }

                                runtimeIdentityIndexSize =
                                    identityIndex.size;

                                /*
                                 * CRITICAL:
                                 *
                                 * No await.
                                 * No setTimeout.
                                 * No Promise.
                                 * No sleep.
                                 *
                                 * Continue immediately while the
                                 * transaction remains active.
                                 */
                                try {
                                    cursor.continue();
                                } catch (error) {
                                    finishFailure(error);
                                }
                            };
                    };
            }
        );
    }

    /*
     * ---------------------------------------------------------
     * Coverage
     * ---------------------------------------------------------
     */

    async function readCoverage() {
        const c6 =
            getC6();

        if (
            c6 &&
            typeof c6
                .getIdentityCoverageReport
                === "function"
        ) {
            try {
                lastCoverage =
                    await c6
                        .getIdentityCoverageReport();

                return lastCoverage;
            } catch (_) {}
        }

        /*
         * Some implementations expose the report
         * through diagnose().
         */
        if (
            c6 &&
            typeof c6.diagnose
                === "function"
        ) {
            try {
                const diagnostic =
                    await c6.diagnose();

                if (
                    diagnostic &&
                    diagnostic.coverage
                ) {
                    lastCoverage =
                        diagnostic.coverage;

                    return lastCoverage;
                }
            } catch (_) {}
        }

        return lastCoverage;
    }

    function coverageComplete(
        coverage
    ) {
        if (!coverage) {
            return false;
        }

        const percent =
            Number(
                coverage.coveragePercent
            );

        const missing =
            Number(
                coverage.missingInRuntimeCount
            );

        return Boolean(
            Number.isFinite(percent) &&
            percent >=
                MIN_COVERAGE_PERCENT &&

            Number.isFinite(missing) &&
            missing === 0 &&

            coverage
                .identityCoverageVerified
                === true
        );
    }

    /*
     * ---------------------------------------------------------
     * Downstream release
     * ---------------------------------------------------------
     */

    async function releaseDownstream() {
        const results = {};

        const chain = [
            [
                "c7a",
                getC7A()
            ],
            [
                "c7b",
                getC7B()
            ],
            [
                "c7b1",
                getC7B1()
            ]
        ];

        for (
            const [name, bridge]
            of chain
        ) {
            if (
                !bridge ||
                typeof bridge.run
                    !== "function"
            ) {
                results[name] = {
                    skipped: true,
                    reason:
                        "BRIDGE_NOT_AVAILABLE"
                };

                continue;
            }

            try {
                results[name] =
                    await bridge.run();

            } catch (error) {
                results[
                    `${name}Error`
                ] =
                    normalizeError(
                        error
                    );
            }
        }

        return results;
    }

    /*
     * ---------------------------------------------------------
     * Main run
     * ---------------------------------------------------------
     */

    async function run() {
        if (running) {
            return (
                lastResult || {
                    success: false,
                    phase: PHASE,
                    version: VERSION,
                    status:
                        "ALREADY_RUNNING"
                }
            );
        }

        running = true;

        startedAt =
            now();

        completedAt =
            null;

        scannedRecordCount = 0;
        extractedIdentityCount = 0;
        insertedIdentityCount = 0;
        skippedDuplicateCount = 0;
        rejectedRecordCount = 0;

        runtimeIdentityIndexSize = 0;

        selectedDatabaseName = null;
        selectedStoreName = null;
        selectedRuntimeRegistryName = null;

        lastError = null;

        try {
            /*
             * 1. Runtime registry
             */
            const runtimeRegistry =
                discoverCanonicalRuntimeRegistry();

            if (!runtimeRegistry) {
                state =
                    STATES.BLOCKED;

                completedAt =
                    now();

                lastResult = {
                    success: false,

                    phase: PHASE,
                    version: VERSION,
                    build: BUILD,

                    status:
                        "CANONICAL_RUNTIME_IDENTITY_REGISTRY_NOT_FOUND",

                    state,

                    startedAt,
                    completedAt,

                    durationMs:
                        completedAt -
                        startedAt
                };

                return lastResult;
            }

            /*
             * 2. Authoritative IndexedDB source
             */
            let source;

            try {
                source =
                    await discoverIndexedDBSource();
            } catch (error) {
                state =
                    STATES.DATABASE_BLOCKED;

                completedAt =
                    now();

                lastError =
                    normalizeError(error);

                lastResult = {
                    success: false,

                    phase: PHASE,
                    version: VERSION,
                    build: BUILD,

                    status:
                        "AUTHORITATIVE_INDEXEDDB_SOURCE_NOT_AVAILABLE",

                    state,

                    selectedDatabaseName,
                    selectedStoreName,
                    selectedRuntimeRegistryName,

                    error:
                        lastError,

                    startedAt,
                    completedAt,

                    durationMs:
                        completedAt -
                        startedAt
                };

                return lastResult;
            }

            /*
             * 3. Transaction-safe cursor drain
             */
            const drainResult =
                await cursorDrain(
                    source.dbName,
                    source.storeName,
                    runtimeRegistry
                );

            /*
             * Give synchronous registry side-effects one
             * event-loop turn before coverage verification.
             *
             * This sleep happens AFTER the IndexedDB transaction
             * has completed, not inside the cursor transaction.
             */
            await sleep(100);

            /*
             * 4. Verify
             */
            state =
                STATES.VERIFYING;

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

                state =
                    STATES.COMPLETE;

            } else {
                state =
                    STATES.PARTIAL;
            }

            completedAt =
                now();

            lastResult = {
                success:
                    complete,

                phase: PHASE,
                version: VERSION,
                build: BUILD,

                status:
                    complete
                        ? "MEMORY_SAFE_IDENTITY_REHYDRATION_COMPLETE"
                        : "MEMORY_SAFE_IDENTITY_REHYDRATION_PARTIAL",

                state,

                authoritativeDatabase:
                    AUTHORITATIVE_DB_NAME,

                authoritativeStore:
                    AUTHORITATIVE_STORE_NAME,

                selectedDatabaseName,
                selectedStoreName,
                selectedRuntimeRegistryName,

                scannedRecordCount,
                extractedIdentityCount,
                insertedIdentityCount,
                skippedDuplicateCount,
                rejectedRecordCount,

                runtimeIdentityIndexSize,

                drainResult,

                coverage,

                downstream,

                startedAt,
                completedAt,

                durationMs:
                    completedAt -
                    startedAt
            };

            console.log(
                `[RainGuard][${PHASE}] Run result:`,
                lastResult
            );

            return lastResult;

        } catch (error) {
            state =
                STATES.FAILED;

            completedAt =
                now();

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

                authoritativeDatabase:
                    AUTHORITATIVE_DB_NAME,

                authoritativeStore:
                    AUTHORITATIVE_STORE_NAME,

                selectedDatabaseName,
                selectedStoreName,
                selectedRuntimeRegistryName,

                scannedRecordCount,
                extractedIdentityCount,
                insertedIdentityCount,
                skippedDuplicateCount,
                rejectedRecordCount,

                runtimeIdentityIndexSize,

                error:
                    lastError,

                startedAt,
                completedAt,

                durationMs:
                    completedAt -
                    startedAt
            };

            console.error(
                `[RainGuard][${PHASE}] Run failed:`,
                lastResult
            );

            return lastResult;

        } finally {
            running = false;
        }
    }

    /*
     * ---------------------------------------------------------
     * Diagnostics
     * ---------------------------------------------------------
     */

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

            authoritativeDatabase:
                AUTHORITATIVE_DB_NAME,

            authoritativeStore:
                AUTHORITATIVE_STORE_NAME,

            selectedDatabaseName,
            selectedStoreName,
            selectedRuntimeRegistryName,

            scannedRecordCount,
            extractedIdentityCount,
            insertedIdentityCount,
            skippedDuplicateCount,
            rejectedRecordCount,

            runtimeIdentityIndexSize,

            batchSize:
                BATCH_SIZE,

            maxRecordsPerRun:
                MAX_RECORDS_PER_RUN,

            databaseOpenTimeoutMs:
                DATABASE_OPEN_TIMEOUT_MS,

            cursorIdleTimeoutMs:
                CURSOR_IDLE_TIMEOUT_MS,

            minimumCoveragePercent:
                MIN_COVERAGE_PERCENT,

            transactionSafeCursor:
                true,

            cursorAwaitDisabled:
                true,

            getAllDisabled:
                true,

            authoritativeSourcePinned:
                true,

            coverage,

            c6Available:
                Boolean(
                    getC6()
                ),

            c7aAvailable:
                Boolean(
                    getC7A()
                ),

            c7bAvailable:
                Boolean(
                    getC7B()
                ),

            c7b1Available:
                Boolean(
                    getC7B1()
                ),

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

    /*
     * ---------------------------------------------------------
     * Install
     * ---------------------------------------------------------
     */

    function install() {
        if (installed) {
            return bridge;
        }

        installed = true;

        console.log(
            `[RainGuard][${PHASE}] Installed`,
            {
                version:
                    VERSION,

                build:
                    BUILD,

                memorySafe:
                    true,

                transactionSafe:
                    true,

                cursorDrain:
                    true,

                cursorAwaitDisabled:
                    true,

                getAllDisabled:
                    true,

                authoritativeDatabase:
                    AUTHORITATIVE_DB_NAME,

                authoritativeStore:
                    AUTHORITATIVE_STORE_NAME
            }
        );

        return bridge;
    }

    /*
     * ---------------------------------------------------------
     * Public bridge
     * ---------------------------------------------------------
     */

    const bridge = {
        phase:
            PHASE,

        version:
            VERSION,

        build:
            BUILD,

        states:
            STATES,

        authoritativeDatabase:
            AUTHORITATIVE_DB_NAME,

        authoritativeStore:
            AUTHORITATIVE_STORE_NAME,

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

        get runtimeIdentityIndexSize() {
            return runtimeIdentityIndexSize;
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

    global
        .isRainGuard39A15F6N4B1B3C7B2AMemorySafeDrainComplete =
        isComplete;

    install();

})(window);
