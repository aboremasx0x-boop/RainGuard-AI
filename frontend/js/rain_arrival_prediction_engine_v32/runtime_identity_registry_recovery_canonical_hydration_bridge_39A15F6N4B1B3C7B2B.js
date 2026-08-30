/*
 * RainGuard AI
 * Phase 39A-15F6N4B1B3C7B2B
 *
 * Runtime Identity Registry Recovery
 * & Canonical Hydration Bridge
 *
 * Purpose:
 * - Recover/create canonical runtime identity registry.
 * - Bind legacy registry aliases to one authoritative runtime registry.
 * - Hydrate identities from:
 *
 *   RainGuardTemporalHistoryV39
 *      -> temporalHistory
 *
 * - Cursor only.
 * - No getAll().
 * - No await inside cursor.onsuccess.
 * - Prevent duplicate identities.
 * - Re-check C6 identity coverage.
 */

(function (global) {
    "use strict";

    const PHASE =
        "39A-15F6N4B1B3C7B2B";

    const VERSION =
        "39A.15F6N4B1B3C7B2B.0";

    const BUILD =
        "rainguard-v39-runtime-identity-registry-recovery-canonical-hydration-bridge";

    const BRIDGE_NAME =
        "RainGuard39A15F6N4B1B3C7B2BBridgeV39";

    const RUN_NAME =
        "runRainGuard39A15F6N4B1B3C7B2BRuntimeIdentityRecoveryHydration";

    const DIAG_NAME =
        "diagnoseRainGuard39A15F6N4B1B3C7B2BRuntimeIdentityRecoveryHydration";

    /*
     * Confirmed IndexedDB source.
     */
    const DB_NAME =
        "RainGuardTemporalHistoryV39";

    const STORE_NAME =
        "temporalHistory";

    /*
     * Upstream/downstream bridges.
     */
    const C6_NAME =
        "RainGuard39A15F6N4B1B3C6BridgeV39";

    const C7B2A_NAME =
        "RainGuard39A15F6N4B1B3C7B2ABridgeV39";

    const C7A_NAME =
        "RainGuard39A15F6N4B1B3C7ABridgeV39";

    const C7B_NAME =
        "RainGuard39A15F6N4B1B3C7BBridgeV39";

    const C7B1_NAME =
        "RainGuard39A15F6N4B1B3C7B1BridgeV39";

    /*
     * Registry names.
     *
     * One Map instance will become the canonical runtime
     * identity source for compatible legacy aliases.
     */
    const PRIMARY_RUNTIME_REGISTRY_NAME =
        "RainGuardRuntimeIdentityRegistryV39";

    const REGISTRY_ALIASES = [
        "RainGuardRuntimeIdentityRegistryV39",
        "RainGuardIdentityRegistryV39",
        "RainGuardStableTrackIdentityRegistryV39"
    ];

    /*
     * Do NOT overwrite the persistent registry blindly.
     *
     * It may carry its own behavior/state.
     */
    const PERSISTENT_REGISTRY_NAME =
        "RainGuardIntegratedIdentityPersistentRegistryV39";

    const MIN_COVERAGE_PERCENT = 99;

    /*
     * Hard upper safety ceiling.
     */
    const MAX_RECORDS_PER_RUN = 50000;

    const DB_OPEN_TIMEOUT_MS = 10000;
    const CURSOR_IDLE_TIMEOUT_MS = 15000;

    const STATES = Object.freeze({
        IDLE:
            "IDLE",

        CHECKING_UPSTREAM:
            "CHECKING_C7B2A_UPSTREAM",

        DISCOVERING_REGISTRY:
            "DISCOVERING_RUNTIME_IDENTITY_REGISTRY",

        RECOVERING_REGISTRY:
            "RECOVERING_RUNTIME_IDENTITY_REGISTRY",

        REGISTRY_READY:
            "RUNTIME_IDENTITY_REGISTRY_READY",

        OPENING_INDEXEDDB:
            "OPENING_AUTHORITATIVE_INDEXEDDB",

        HYDRATING:
            "CANONICAL_RUNTIME_IDENTITY_HYDRATING",

        VERIFYING:
            "VERIFYING_RUNTIME_IDENTITY_COVERAGE",

        COMPLETE:
            "CANONICAL_RUNTIME_IDENTITY_HYDRATION_COMPLETE",

        PARTIAL:
            "CANONICAL_RUNTIME_IDENTITY_HYDRATION_PARTIAL",

        BLOCKED:
            "CANONICAL_HYDRATION_BLOCKED",

        FAILED:
            "CANONICAL_HYDRATION_FAILED"
    });

    let installed = false;
    let running = false;
    let state = STATES.IDLE;

    let registryRecovered = false;
    let registryReused = false;
    let aliasesBound = 0;

    let selectedRuntimeRegistryName = null;

    let scannedRecordCount = 0;
    let extractedIdentityCount = 0;
    let hydratedIdentityCount = 0;
    let skippedDuplicateCount = 0;
    let rejectedRecordCount = 0;

    let runtimeIdentityCountBefore = 0;
    let runtimeIdentityCountAfter = 0;

    let lastCoverage = null;
    let lastResult = null;
    let lastError = null;

    let startedAt = null;
    let completedAt = null;

    /*
     * -------------------------------------------------------
     * Utilities
     * -------------------------------------------------------
     */

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

    function getC7B2A() {
        return getBridge(C7B2A_NAME);
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
     * -------------------------------------------------------
     * Identity normalization
     * -------------------------------------------------------
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

        return text || null;
    }

    function getIdentityKey(value) {
        if (
            !value ||
            typeof value !== "object"
        ) {
            return null;
        }

        /*
         * canonicalTrackId has priority because direct IndexedDB
         * inspection confirmed records such as:
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

        for (
            const candidate
            of candidates
        ) {
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

        const directKey =
            getIdentityKey(record);

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
     * -------------------------------------------------------
     * Registry support
     * -------------------------------------------------------
     */

    function isUsableRegistry(registry) {
        if (!registry) {
            return false;
        }

        if (registry instanceof Map) {
            return true;
        }

        if (
            registry.byIdentity
            instanceof Map
        ) {
            return true;
        }

        if (
            Array.isArray(
                registry.identities
            )
        ) {
            return true;
        }

        if (
            typeof registry.set
                === "function" ||

            typeof registry.upsert
                === "function" ||

            typeof registry.register
                === "function" ||

            typeof registry.add
                === "function"
        ) {
            return true;
        }

        return false;
    }

    function registrySize(registry) {
        if (!registry) {
            return 0;
        }

        if (registry instanceof Map) {
            return registry.size;
        }

        if (
            registry.byIdentity
            instanceof Map
        ) {
            return registry
                .byIdentity
                .size;
        }

        if (
            Array.isArray(
                registry.identities
            )
        ) {
            return registry
                .identities
                .length;
        }

        if (
            Number.isFinite(
                Number(registry.size)
            )
        ) {
            return Number(
                registry.size
            );
        }

        return 0;
    }

    function buildIdentityIndex(registry) {
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

            return index;
        }

        if (
            registry.byIdentity
            instanceof Map
        ) {
            for (
                const key
                of registry
                    .byIdentity
                    .keys()
            ) {
                const normalized =
                    normalizeIdentityKey(key);

                if (normalized) {
                    index.add(normalized);
                }
            }

            return index;
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

        return index;
    }

    function registryHasIdentity(
        registry,
        key,
        identityIndex
    ) {
        if (!registry || !key) {
            return false;
        }

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

    function insertIntoRegistry(
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
     * -------------------------------------------------------
     * Runtime registry discovery/recovery
     * -------------------------------------------------------
     */

    function discoverExistingRuntimeRegistry() {
        state =
            STATES.DISCOVERING_REGISTRY;

        const candidates = [
            {
                name:
                    PRIMARY_RUNTIME_REGISTRY_NAME,

                value:
                    global[
                        PRIMARY_RUNTIME_REGISTRY_NAME
                    ]
            },

            {
                name:
                    "RainGuardIdentityRegistryV39",

                value:
                    global
                        .RainGuardIdentityRegistryV39
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
                    PERSISTENT_REGISTRY_NAME,

                value:
                    global[
                        PERSISTENT_REGISTRY_NAME
                    ]
            }
        ];

        for (
            const candidate
            of candidates
        ) {
            if (
                isUsableRegistry(
                    candidate.value
                )
            ) {
                selectedRuntimeRegistryName =
                    candidate.name;

                return candidate.value;
            }
        }

        return null;
    }

    function bindRuntimeAliases(
        registry
    ) {
        aliasesBound = 0;

        for (
            const alias
            of REGISTRY_ALIASES
        ) {
            try {
                global[alias] =
                    registry;

                aliasesBound += 1;

            } catch (error) {
                console.warn(
                    `[RainGuard][${PHASE}] Failed to bind runtime registry alias`,
                    {
                        alias,
                        error:
                            normalizeError(error)
                    }
                );
            }
        }

        return aliasesBound;
    }

    function recoverRuntimeRegistry() {
        state =
            STATES.RECOVERING_REGISTRY;

        let registry =
            discoverExistingRuntimeRegistry();

        if (registry) {
            registryReused = true;
            registryRecovered = false;

            /*
             * Bind compatible aliases to the same instance.
             */
            bindRuntimeAliases(
                registry
            );

            state =
                STATES.REGISTRY_READY;

            return registry;
        }

        /*
         * Create the simplest canonical runtime registry:
         * Map<identityKey, identityRecord>
         */
        registry =
            new Map();

        registryRecovered =
            true;

        registryReused =
            false;

        selectedRuntimeRegistryName =
            PRIMARY_RUNTIME_REGISTRY_NAME;

        bindRuntimeAliases(
            registry
        );

        state =
            STATES.REGISTRY_READY;

        console.log(
            `[RainGuard][${PHASE}] Runtime identity registry recovered`,
            {
                primaryRegistry:
                    PRIMARY_RUNTIME_REGISTRY_NAME,

                aliases:
                    REGISTRY_ALIASES,

                registryType:
                    "Map"
            }
        );

        return registry;
    }

    /*
     * -------------------------------------------------------
     * IndexedDB
     * -------------------------------------------------------
     */

    function openDatabase(
        name,
        timeoutMs =
            DB_OPEN_TIMEOUT_MS
    ) {
        return new Promise(
            (resolve, reject) => {

                let settled = false;

                const timeout =
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
                        global.indexedDB.open(
                            name
                        );
                } catch (error) {
                    clearTimeout(timeout);

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

                    clearTimeout(
                        timeout
                    );

                    resolve(
                        request.result
                    );
                };

                request.onerror = () => {
                    if (settled) {
                        return;
                    }

                    settled = true;

                    clearTimeout(
                        timeout
                    );

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

    async function verifyIndexedDBSource() {
        if (!global.indexedDB) {
            throw new Error(
                "IndexedDB unavailable."
            );
        }

        state =
            STATES.OPENING_INDEXEDDB;

        let db = null;

        try {
            db =
                await openDatabase(
                    DB_NAME
                );

            const stores =
                Array.from(
                    db.objectStoreNames ||
                    []
                );

            if (
                !stores.includes(
                    STORE_NAME
                )
            ) {
                throw new Error(
                    `Required IndexedDB store missing: ${STORE_NAME}`
                );
            }

            return {
                database:
                    DB_NAME,

                store:
                    STORE_NAME,

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
     * -------------------------------------------------------
     * Canonical hydration
     * -------------------------------------------------------
     */

    function hydrateFromIndexedDB(
        registry
    ) {
        state =
            STATES.HYDRATING;

        const identityIndex =
            buildIdentityIndex(
                registry
            );

        runtimeIdentityCountBefore =
            identityIndex.size;

        return new Promise(
            (resolve, reject) => {

                let settled = false;
                let db = null;
                let tx = null;

                let openTimeout = null;
                let cursorTimeout = null;

                function clearTimers() {
                    if (openTimeout) {
                        clearTimeout(
                            openTimeout
                        );

                        openTimeout = null;
                    }

                    if (cursorTimeout) {
                        clearTimeout(
                            cursorTimeout
                        );

                        cursorTimeout = null;
                    }
                }

                function safeClose() {
                    try {
                        db?.close();
                    } catch (_) {}
                }

                function finishSuccess() {
                    if (settled) {
                        return;
                    }

                    settled = true;

                    clearTimers();
                    safeClose();

                    runtimeIdentityCountAfter =
                        identityIndex.size;

                    resolve({
                        success: true,

                        scannedRecordCount,
                        extractedIdentityCount,
                        hydratedIdentityCount,
                        skippedDuplicateCount,
                        rejectedRecordCount,

                        runtimeIdentityCountBefore,
                        runtimeIdentityCountAfter
                    });
                }

                function finishFailure(
                    error
                ) {
                    if (settled) {
                        return;
                    }

                    settled = true;

                    clearTimers();

                    try {
                        tx?.abort();
                    } catch (_) {}

                    safeClose();

                    reject(error);
                }

                function resetCursorTimeout() {
                    if (cursorTimeout) {
                        clearTimeout(
                            cursorTimeout
                        );
                    }

                    cursorTimeout =
                        setTimeout(() => {
                            finishFailure(
                                new Error(
                                    `IndexedDB hydration cursor idle timeout after ${CURSOR_IDLE_TIMEOUT_MS} ms`
                                )
                            );
                        }, CURSOR_IDLE_TIMEOUT_MS);
                }

                let openRequest;

                try {
                    openRequest =
                        global
                            .indexedDB
                            .open(
                                DB_NAME
                            );
                } catch (error) {
                    finishFailure(error);
                    return;
                }

                openTimeout =
                    setTimeout(() => {
                        finishFailure(
                            new Error(
                                `IndexedDB hydration source open timeout: ${DB_NAME}`
                            )
                        );
                    }, DB_OPEN_TIMEOUT_MS);

                openRequest.onerror = () => {
                    finishFailure(
                        openRequest.error ||
                        new Error(
                            "IndexedDB hydration open failed."
                        )
                    );
                };

                openRequest.onblocked = () => {
                    console.warn(
                        `[RainGuard][${PHASE}] IndexedDB hydration open blocked`
                    );
                };

                openRequest.onsuccess = () => {
                    if (openTimeout) {
                        clearTimeout(
                            openTimeout
                        );

                        openTimeout = null;
                    }

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

                    let store;

                    try {
                        tx =
                            db.transaction(
                                STORE_NAME,
                                "readonly"
                            );

                        store =
                            tx.objectStore(
                                STORE_NAME
                            );

                    } catch (error) {
                        finishFailure(error);
                        return;
                    }

                    tx.onerror = () => {
                        if (settled) {
                            return;
                        }

                        finishFailure(
                            tx.error ||
                            new Error(
                                "IndexedDB hydration transaction failed."
                            )
                        );
                    };

                    tx.onabort = () => {
                        if (settled) {
                            return;
                        }

                        finishFailure(
                            tx.error ||
                            new Error(
                                "IndexedDB hydration transaction aborted."
                            )
                        );
                    };

                    tx.oncomplete = () => {
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

                    resetCursorTimeout();

                    cursorRequest.onerror =
                        () => {
                            finishFailure(
                                cursorRequest.error ||
                                new Error(
                                    "IndexedDB hydration cursor failed."
                                )
                            );
                        };

                    /*
                     * CRITICAL:
                     *
                     * This callback MUST NOT be async.
                     *
                     * No await.
                     * No sleep.
                     * No Promise scheduling before cursor.continue().
                     */
                    cursorRequest.onsuccess =
                        event => {

                            if (settled) {
                                return;
                            }

                            resetCursorTimeout();

                            const cursor =
                                event
                                    .target
                                    .result;

                            if (!cursor) {
                                /*
                                 * Allow tx.oncomplete to finish.
                                 */
                                if (cursorTimeout) {
                                    clearTimeout(
                                        cursorTimeout
                                    );

                                    cursorTimeout =
                                        null;
                                }

                                return;
                            }

                            if (
                                scannedRecordCount >=
                                MAX_RECORDS_PER_RUN
                            ) {
                                /*
                                 * Stop continuing.
                                 * Readonly tx completes naturally.
                                 */
                                if (cursorTimeout) {
                                    clearTimeout(
                                        cursorTimeout
                                    );

                                    cursorTimeout =
                                        null;
                                }

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
                                    finishFailure(
                                        error
                                    );
                                }

                                return;
                            }

                            extractedIdentityCount += 1;

                            const key =
                                extracted.key;

                            if (
                                registryHasIdentity(
                                    registry,
                                    key,
                                    identityIndex
                                )
                            ) {
                                skippedDuplicateCount += 1;

                                identityIndex.add(
                                    key
                                );

                            } else {
                                let inserted =
                                    false;

                                try {
                                    inserted =
                                        insertIntoRegistry(
                                            registry,
                                            key,
                                            extracted.value
                                        );
                                } catch (_) {
                                    inserted =
                                        false;
                                }

                                if (inserted) {
                                    hydratedIdentityCount += 1;

                                    identityIndex.add(
                                        key
                                    );

                                } else {
                                    rejectedRecordCount += 1;
                                }
                            }

                            runtimeIdentityCountAfter =
                                identityIndex.size;

                            /*
                             * Immediate continuation.
                             */
                            try {
                                cursor.continue();

                            } catch (error) {
                                finishFailure(
                                    error
                                );
                            }
                        };
                };
            }
        );
    }

    /*
     * -------------------------------------------------------
     * Coverage
     * -------------------------------------------------------
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

        if (
            c6 &&
            typeof c6.diagnose
                === "function"
        ) {
            try {
                const result =
                    await c6.diagnose();

                if (
                    result &&
                    result.coverage
                ) {
                    lastCoverage =
                        result.coverage;

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

        const percentage =
            Number(
                coverage.coveragePercent
            );

        const missing =
            Number(
                coverage.missingInRuntimeCount
            );

        return Boolean(
            Number.isFinite(
                percentage
            ) &&

            percentage >=
                MIN_COVERAGE_PERCENT &&

            Number.isFinite(
                missing
            ) &&

            missing === 0 &&

            coverage
                .identityCoverageVerified
                === true
        );
    }

    /*
     * -------------------------------------------------------
     * Upstream verification
     * -------------------------------------------------------
     */

    async function checkUpstream() {
        state =
            STATES.CHECKING_UPSTREAM;

        const c7b2a =
            getC7B2A();

        if (!c7b2a) {
            return {
                available: false,
                ready: false,
                reason:
                    "C7B2A_NOT_AVAILABLE"
            };
        }

        let diagnostic = null;

        if (
            typeof c7b2a.diagnose
            === "function"
        ) {
            try {
                diagnostic =
                    await c7b2a
                        .diagnose();
            } catch (_) {}
        }

        return {
            available: true,
            ready: true,
            diagnostic
        };
    }

    /*
     * -------------------------------------------------------
     * Downstream release
     * -------------------------------------------------------
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
                    normalizeError(error);
            }
        }

        return results;
    }

    /*
     * -------------------------------------------------------
     * Main run
     * -------------------------------------------------------
     */

    async function run() {
        if (running) {
            return (
                lastResult || {
                    success: false,

                    phase:
                        PHASE,

                    version:
                        VERSION,

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

        registryRecovered =
            false;

        registryReused =
            false;

        aliasesBound =
            0;

        scannedRecordCount =
            0;

        extractedIdentityCount =
            0;

        hydratedIdentityCount =
            0;

        skippedDuplicateCount =
            0;

        rejectedRecordCount =
            0;

        runtimeIdentityCountBefore =
            0;

        runtimeIdentityCountAfter =
            0;

        lastError =
            null;

        try {
            /*
             * 1. Check C7B2A.
             */
            const upstream =
                await checkUpstream();

            /*
             * 2. Recover/reuse runtime registry.
             */
            const registry =
                recoverRuntimeRegistry();

            if (!registry) {
                state =
                    STATES.BLOCKED;

                completedAt =
                    now();

                lastResult = {
                    success: false,

                    phase:
                        PHASE,

                    version:
                        VERSION,

                    build:
                        BUILD,

                    status:
                        "RUNTIME_IDENTITY_REGISTRY_RECOVERY_FAILED",

                    state,

                    upstream,

                    startedAt,
                    completedAt,

                    durationMs:
                        completedAt -
                        startedAt
                };

                return lastResult;
            }

            /*
             * 3. Confirm IndexedDB source.
             */
            const source =
                await verifyIndexedDBSource();

            /*
             * 4. Hydrate runtime registry.
             */
            const hydration =
                await hydrateFromIndexedDB(
                    registry
                );

            /*
             * Wait AFTER transaction completion only.
             */
            await sleep(100);

            /*
             * 5. Verify C6 coverage.
             */
            state =
                STATES.VERIFYING;

            const coverage =
                await readCoverage();

            const complete =
                coverageComplete(
                    coverage
                );

            let downstream =
                null;

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

                phase:
                    PHASE,

                version:
                    VERSION,

                build:
                    BUILD,

                status:
                    complete
                        ? "CANONICAL_RUNTIME_IDENTITY_HYDRATION_COMPLETE"
                        : "CANONICAL_RUNTIME_IDENTITY_HYDRATION_PARTIAL",

                state,

                upstream,

                source,

                registryRecovered,
                registryReused,

                selectedRuntimeRegistryName,

                aliasesBound,

                runtimeIdentityCountBefore,
                runtimeIdentityCountAfter,

                scannedRecordCount,
                extractedIdentityCount,
                hydratedIdentityCount,
                skippedDuplicateCount,
                rejectedRecordCount,

                hydration,

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
                normalizeError(
                    error
                );

            lastResult = {
                success: false,

                phase:
                    PHASE,

                version:
                    VERSION,

                build:
                    BUILD,

                status:
                    "CANONICAL_HYDRATION_FAILED",

                state,

                registryRecovered,
                registryReused,

                selectedRuntimeRegistryName,

                aliasesBound,

                runtimeIdentityCountBefore,
                runtimeIdentityCountAfter,

                scannedRecordCount,
                extractedIdentityCount,
                hydratedIdentityCount,
                skippedDuplicateCount,
                rejectedRecordCount,

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
     * -------------------------------------------------------
     * Diagnostics
     * -------------------------------------------------------
     */

    async function diagnose() {
        let coverage = null;

        try {
            coverage =
                await readCoverage();
        } catch (_) {}

        const runtimeRegistry =
            discoverExistingRuntimeRegistry();

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
            state,

            authoritativeDatabase:
                DB_NAME,

            authoritativeStore:
                STORE_NAME,

            registryRecovered,
            registryReused,

            selectedRuntimeRegistryName,

            aliasesBound,

            runtimeRegistryAvailable:
                Boolean(
                    runtimeRegistry
                ),

            runtimeRegistryType:
                runtimeRegistry
                    ? (
                        runtimeRegistry instanceof Map
                            ? "Map"
                            : runtimeRegistry
                                .constructor
                                ?.name ||
                              typeof runtimeRegistry
                    )
                    : null,

            runtimeRegistrySize:
                registrySize(
                    runtimeRegistry
                ),

            scannedRecordCount,
            extractedIdentityCount,
            hydratedIdentityCount,
            skippedDuplicateCount,
            rejectedRecordCount,

            runtimeIdentityCountBefore,
            runtimeIdentityCountAfter,

            maxRecordsPerRun:
                MAX_RECORDS_PER_RUN,

            databaseOpenTimeoutMs:
                DB_OPEN_TIMEOUT_MS,

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

            canonicalTrackIdPriority:
                true,

            c6Available:
                Boolean(
                    getC6()
                ),

            c7b2aAvailable:
                Boolean(
                    getC7B2A()
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

            coverage,

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
     * -------------------------------------------------------
     * Installation
     * -------------------------------------------------------
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

                authoritativeDatabase:
                    DB_NAME,

                authoritativeStore:
                    STORE_NAME,

                runtimeRegistryRecovery:
                    true,

                canonicalHydration:
                    true,

                transactionSafeCursor:
                    true,

                cursorAwaitDisabled:
                    true,

                getAllDisabled:
                    true
            }
        );

        return bridge;
    }

    /*
     * -------------------------------------------------------
     * Public bridge
     * -------------------------------------------------------
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
            DB_NAME,

        authoritativeStore:
            STORE_NAME,

        primaryRuntimeRegistryName:
            PRIMARY_RUNTIME_REGISTRY_NAME,

        registryAliases:
            [...REGISTRY_ALIASES],

        install,
        run,
        diagnose,
        readCoverage,
        isComplete,
        recoverRuntimeRegistry,

        get installed() {
            return installed;
        },

        get running() {
            return running;
        },

        get state() {
            return state;
        },

        get registryRecovered() {
            return registryRecovered;
        },

        get registryReused() {
            return registryReused;
        },

        get aliasesBound() {
            return aliasesBound;
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

        get hydratedIdentityCount() {
            return hydratedIdentityCount;
        },

        get skippedDuplicateCount() {
            return skippedDuplicateCount;
        },

        get rejectedRecordCount() {
            return rejectedRecordCount;
        },

        get runtimeIdentityCountBefore() {
            return runtimeIdentityCountBefore;
        },

        get runtimeIdentityCountAfter() {
            return runtimeIdentityCountAfter;
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

    global[
        BRIDGE_NAME
    ] =
        bridge;

    global[
        RUN_NAME
    ] =
        run;

    global[
        DIAG_NAME
    ] =
        diagnose;

    global
        .isRainGuard39A15F6N4B1B3C7B2BRuntimeIdentityHydrationComplete =
        isComplete;

    install();

})(window);
