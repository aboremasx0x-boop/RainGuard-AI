/*
 * RainGuard AI
 * Phase 39A-15F6N4B1B3C7B2B1
 *
 * Chunked Minimal-Identity Hydration
 * & Memory Pressure Guard
 *
 * Fix for browser Out Of Memory during full-runtime rehydration.
 *
 * Strategy:
 * - Use the authoritative runtime registry created by C7B2C.
 * - Read IndexedDB temporalHistory incrementally.
 * - Never load full dataset into memory.
 * - Never use getAll().
 * - Never await inside cursor.onsuccess.
 * - Store only minimal canonical runtime identity records.
 * - Hydrate at most MAX_IDENTITIES_PER_PASS per run.
 * - Continue from last IndexedDB cursor key on next run.
 */

(function (global) {
    "use strict";

    const PHASE =
        "39A-15F6N4B1B3C7B2B1";

    const VERSION =
        "39A.15F6N4B1B3C7B2B1.0";

    const BUILD =
        "rainguard-v39-chunked-minimal-identity-hydration-memory-pressure-guard";

    const BRIDGE_NAME =
        "RainGuard39A15F6N4B1B3C7B2BBridgeV39";

    const RUN_NAME =
        "runRainGuard39A15F6N4B1B3C7B2BRuntimeIdentityRecoveryHydration";

    const DIAG_NAME =
        "diagnoseRainGuard39A15F6N4B1B3C7B2BRuntimeIdentityRecoveryHydration";

    const DB_NAME =
        "RainGuardTemporalHistoryV39";

    const STORE_NAME =
        "temporalHistory";

    const C6_NAME =
        "RainGuard39A15F6N4B1B3C6BridgeV39";

    const C7B2A_NAME =
        "RainGuard39A15F6N4B1B3C7B2ABridgeV39";

    const C7B2C_NAME =
        "RainGuard39A15F6N4B1B3C7B2CBridgeV39";

    const PRIMARY_RUNTIME_REGISTRY_NAME =
        "RainGuardRuntimeIdentityRegistryV39";

    /*
     * Memory safety.
     *
     * A single pass will never attempt to hydrate tens of thousands
     * of complete temporal history records.
     */
    const CHUNK_SIZE = 250;

    const MAX_IDENTITIES_PER_PASS = 2000;

    /*
     * Maximum number of IndexedDB records inspected in a single pass.
     *
     * This can be larger than MAX_IDENTITIES_PER_PASS because many
     * temporal records may belong to identities already present.
     */
    const MAX_SCANNED_RECORDS_PER_PASS = 10000;

    const DB_OPEN_TIMEOUT_MS = 10000;

    const CURSOR_IDLE_TIMEOUT_MS = 12000;

    /*
     * Yield only BETWEEN IndexedDB transactions.
     *
     * Never yield inside cursor.onsuccess.
     */
    const BETWEEN_CHUNK_DELAY_MS = 25;

    const MIN_COVERAGE_PERCENT = 99;

    const STATES = Object.freeze({
        IDLE:
            "IDLE",

        CHECKING_RUNTIME_REGISTRY:
            "CHECKING_RUNTIME_IDENTITY_REGISTRY",

        REGISTRY_READY:
            "AUTHORITATIVE_RUNTIME_IDENTITY_REGISTRY_READY",

        OPENING_INDEXEDDB:
            "OPENING_AUTHORITATIVE_INDEXEDDB",

        HYDRATING:
            "CHUNKED_MINIMAL_IDENTITY_HYDRATING",

        PASS_LIMIT_REACHED:
            "HYDRATION_PASS_LIMIT_REACHED",

        VERIFYING:
            "VERIFYING_RUNTIME_IDENTITY_COVERAGE",

        COMPLETE:
            "CANONICAL_RUNTIME_IDENTITY_HYDRATION_COMPLETE",

        PARTIAL:
            "CANONICAL_RUNTIME_IDENTITY_HYDRATION_PARTIAL",

        FAILED:
            "CHUNKED_MINIMAL_IDENTITY_HYDRATION_FAILED"
    });

    let installed = false;
    let running = false;

    let state =
        STATES.IDLE;

    let passCount = 0;

    let scannedRecordCount = 0;
    let extractedIdentityCount = 0;
    let hydratedIdentityCount = 0;
    let skippedDuplicateCount = 0;
    let rejectedRecordCount = 0;

    let runtimeIdentityCountBefore = 0;
    let runtimeIdentityCountAfter = 0;

    let lastCursorKey = null;

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
        return getBridge(
            C6_NAME
        );
    }

    function getC7B2A() {
        return getBridge(
            C7B2A_NAME
        );
    }

    function getC7B2C() {
        return getBridge(
            C7B2C_NAME
        );
    }

    /*
     * -------------------------------------------------------
     * Runtime registry
     * -------------------------------------------------------
     */

    function getRuntimeRegistry() {
        state =
            STATES.CHECKING_RUNTIME_REGISTRY;

        const c7b2c =
            getC7B2C();

        if (
            c7b2c &&
            typeof c7b2c.getRegistry
                === "function"
        ) {
            try {
                const registry =
                    c7b2c.getRegistry();

                if (
                    registry instanceof Map
                ) {
                    state =
                        STATES.REGISTRY_READY;

                    return registry;
                }
            } catch (_) {}
        }

        const registry =
            global[
                PRIMARY_RUNTIME_REGISTRY_NAME
            ];

        if (
            registry instanceof Map
        ) {
            state =
                STATES.REGISTRY_READY;

            return registry;
        }

        return null;
    }

    /*
     * -------------------------------------------------------
     * Identity extraction
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

    function getIdentityKey(record) {
        if (
            !record ||
            typeof record !== "object"
        ) {
            return null;
        }

        const candidates = [
            record.canonicalTrackId,
            record.canonicalIdentity,
            record.identityId,
            record.identityID,
            record.identity,
            record.stableIdentity,
            record.stableIdentityId,
            record.trackIdentity,
            record.trackIdentityId,
            record.trackId,
            record.entityId,
            record.entityID,
            record.stormId,
            record.cellId,
            record.id,
            record.key
        ];

        for (
            const candidate
            of candidates
        ) {
            const normalized =
                normalizeIdentityKey(
                    candidate
                );

            if (normalized) {
                return normalized;
            }
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
            const nested
            of nestedCandidates
        ) {
            if (
                !nested ||
                typeof nested !== "object"
            ) {
                continue;
            }

            const key =
                getIdentityKey(
                    nested
                );

            if (key) {
                return key;
            }
        }

        return null;
    }

    /*
     * -------------------------------------------------------
     * Minimal runtime identity record
     * -------------------------------------------------------
     *
     * CRITICAL MEMORY FIX:
     *
     * Do NOT store:
     * - history[]
     * - observations[]
     * - large metadata
     * - source payloads
     * - motion history
     * - raw temporal records
     *
     * Runtime only requires canonical identity presence.
     * -------------------------------------------------------
     */

    function createMinimalRuntimeIdentity(
        key,
        sourceRecord
    ) {
        return {
            canonicalTrackId:
                key,

            identity:
                key,

            stableIdentity:
                key,

            rehydrated:
                true,

            rehydrationPhase:
                PHASE,

            rehydratedAt:
                now(),

            firstSeenAt:
                sourceRecord?.firstSeenAt ||
                sourceRecord?.firstSeen ||
                null,

            lastSeenAt:
                sourceRecord?.lastSeenAt ||
                sourceRecord?.lastSeen ||
                null
        };
    }

    /*
     * -------------------------------------------------------
     * IndexedDB open
     * -------------------------------------------------------
     */

    function openDatabase() {
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
                                `IndexedDB open timeout: ${DB_NAME}`
                            )
                        );

                    }, DB_OPEN_TIMEOUT_MS);

                let request;

                try {
                    request =
                        global
                            .indexedDB
                            .open(
                                DB_NAME
                            );

                } catch (error) {
                    clearTimeout(
                        timeout
                    );

                    settled =
                        true;

                    reject(error);

                    return;
                }

                request.onsuccess =
                    () => {

                        if (settled) {
                            try {
                                request
                                    .result
                                    ?.close();
                            } catch (_) {}

                            return;
                        }

                        settled =
                            true;

                        clearTimeout(
                            timeout
                        );

                        resolve(
                            request.result
                        );
                    };

                request.onerror =
                    () => {

                        if (settled) {
                            return;
                        }

                        settled =
                            true;

                        clearTimeout(
                            timeout
                        );

                        reject(
                            request.error ||
                            new Error(
                                "IndexedDB open failed."
                            )
                        );
                    };

                request.onblocked =
                    () => {

                        console.warn(
                            `[RainGuard][${PHASE}] IndexedDB open blocked`
                        );
                    };
            }
        );
    }

    /*
     * -------------------------------------------------------
     * One transaction chunk
     * -------------------------------------------------------
     */

    async function hydrateChunk(
        registry,
        startAfterKey
    ) {
        state =
            STATES.HYDRATING;

        let db =
            await openDatabase();

        return new Promise(
            (resolve, reject) => {

                let settled = false;

                let tx = null;
                let idleTimer = null;

                let chunkScanned = 0;
                let chunkHydrated = 0;
                let chunkExtracted = 0;
                let chunkDuplicates = 0;
                let chunkRejected = 0;

                let chunkLastKey =
                    startAfterKey;

                let reachedEnd =
                    false;

                let passLimitReached =
                    false;

                function clearIdleTimer() {
                    if (idleTimer) {
                        clearTimeout(
                            idleTimer
                        );

                        idleTimer = null;
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

                    clearIdleTimer();
                    safeClose();

                    resolve({
                        success:
                            true,

                        chunkScanned,
                        chunkExtracted,
                        chunkHydrated,
                        chunkDuplicates,
                        chunkRejected,

                        lastKey:
                            chunkLastKey,

                        reachedEnd,

                        passLimitReached
                    });
                }

                function finishFailure(
                    error
                ) {
                    if (settled) {
                        return;
                    }

                    settled = true;

                    clearIdleTimer();

                    try {
                        tx?.abort();
                    } catch (_) {}

                    safeClose();

                    reject(error);
                }

                function resetIdleTimer() {
                    clearIdleTimer();

                    idleTimer =
                        setTimeout(() => {

                            finishFailure(
                                new Error(
                                    `Hydration cursor idle timeout after ${CURSOR_IDLE_TIMEOUT_MS} ms`
                                )
                            );

                        }, CURSOR_IDLE_TIMEOUT_MS);
                }

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
                    finishFailure(
                        error
                    );

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
                                "Hydration transaction failed."
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
                                "Hydration transaction aborted."
                            )
                        );
                    };

                tx.oncomplete =
                    () => {

                        if (!settled) {
                            finishSuccess();
                        }
                    };

                let range =
                    null;

                /*
                 * Resume AFTER the previous IndexedDB cursor key.
                 */
                if (
                    startAfterKey !== null &&
                    startAfterKey !== undefined
                ) {
                    try {
                        range =
                            IDBKeyRange.lowerBound(
                                startAfterKey,
                                true
                            );

                    } catch (_) {
                        range =
                            null;
                    }
                }

                let cursorRequest;

                try {
                    cursorRequest =
                        store.openCursor(
                            range
                        );

                } catch (error) {
                    finishFailure(
                        error
                    );

                    return;
                }

                resetIdleTimer();

                cursorRequest.onerror =
                    () => {

                        finishFailure(
                            cursorRequest.error ||
                            new Error(
                                "Hydration cursor failed."
                            )
                        );
                    };

                /*
                 * IMPORTANT:
                 * Never mark this callback async.
                 */
                cursorRequest.onsuccess =
                    event => {

                        if (settled) {
                            return;
                        }

                        resetIdleTimer();

                        const cursor =
                            event
                                .target
                                .result;

                        if (!cursor) {
                            reachedEnd =
                                true;

                            clearIdleTimer();

                            return;
                        }

                        chunkLastKey =
                            cursor.key;

                        /*
                         * Global safety limits.
                         */
                        if (
                            scannedRecordCount >=
                            MAX_SCANNED_RECORDS_PER_PASS ||
                            hydratedIdentityCount >=
                            MAX_IDENTITIES_PER_PASS
                        ) {
                            passLimitReached =
                                true;

                            clearIdleTimer();

                            /*
                             * Do not cursor.continue().
                             * Let transaction finish.
                             */

                            return;
                        }

                        /*
                         * Chunk limit.
                         */
                        if (
                            chunkScanned >=
                            CHUNK_SIZE
                        ) {
                            clearIdleTimer();

                            return;
                        }

                        chunkScanned += 1;
                        scannedRecordCount += 1;

                        const record =
                            cursor.value;

                        const key =
                            getIdentityKey(
                                record
                            );

                        if (!key) {
                            chunkRejected += 1;
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

                        chunkExtracted += 1;
                        extractedIdentityCount += 1;

                        if (
                            registry.has(
                                key
                            )
                        ) {
                            chunkDuplicates += 1;
                            skippedDuplicateCount += 1;

                        } else {
                            /*
                             * CRITICAL MEMORY FIX:
                             *
                             * Never registry.set(key, record).
                             */
                            const minimalRecord =
                                createMinimalRuntimeIdentity(
                                    key,
                                    record
                                );

                            registry.set(
                                key,
                                minimalRecord
                            );

                            chunkHydrated += 1;
                            hydratedIdentityCount += 1;
                        }

                        runtimeIdentityCountAfter =
                            registry.size;

                        /*
                         * Check limits again after insertion.
                         */
                        if (
                            chunkScanned >=
                            CHUNK_SIZE ||
                            hydratedIdentityCount >=
                            MAX_IDENTITIES_PER_PASS ||
                            scannedRecordCount >=
                            MAX_SCANNED_RECORDS_PER_PASS
                        ) {
                            if (
                                hydratedIdentityCount >=
                                    MAX_IDENTITIES_PER_PASS ||
                                scannedRecordCount >=
                                    MAX_SCANNED_RECORDS_PER_PASS
                            ) {
                                passLimitReached =
                                    true;
                            }

                            clearIdleTimer();

                            return;
                        }

                        /*
                         * Continue synchronously.
                         *
                         * No await.
                         * No sleep.
                         * No Promise.
                         */
                        try {
                            cursor.continue();

                        } catch (error) {
                            finishFailure(
                                error
                            );
                        }
                    };
            }
        );
    }

    /*
     * -------------------------------------------------------
     * Full pass
     * -------------------------------------------------------
     */

    async function hydratePass(
        registry
    ) {
        runtimeIdentityCountBefore =
            registry.size;

        runtimeIdentityCountAfter =
            registry.size;

        let reachedEnd =
            false;

        let passLimitReached =
            false;

        while (
            !reachedEnd &&
            !passLimitReached
        ) {
            const chunk =
                await hydrateChunk(
                    registry,
                    lastCursorKey
                );

            lastCursorKey =
                chunk.lastKey;

            reachedEnd =
                chunk.reachedEnd;

            passLimitReached =
                chunk.passLimitReached;

            runtimeIdentityCountAfter =
                registry.size;

            console.log(
                `[RainGuard][${PHASE}] Hydration chunk`,
                {
                    chunkScanned:
                        chunk.chunkScanned,

                    chunkHydrated:
                        chunk.chunkHydrated,

                    runtimeIdentityCount:
                        registry.size,

                    totalHydratedThisPass:
                        hydratedIdentityCount,

                    lastCursorKey,

                    reachedEnd,
                    passLimitReached
                }
            );

            if (
                reachedEnd ||
                passLimitReached
            ) {
                break;
            }

            /*
             * Safe yield BETWEEN transactions only.
             */
            await sleep(
                BETWEEN_CHUNK_DELAY_MS
            );
        }

        return {
            reachedEnd,
            passLimitReached
        };
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
            Number.isFinite(
                percent
            ) &&

            percent >=
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
     * Main run
     * -------------------------------------------------------
     */

    async function run() {
        if (running) {
            return {
                success:
                    false,

                phase:
                    PHASE,

                version:
                    VERSION,

                status:
                    "ALREADY_RUNNING",

                state
            };
        }

        running =
            true;

        passCount += 1;

        startedAt =
            now();

        completedAt =
            null;

        lastError =
            null;

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

        try {
            /*
             * Registry from C7B2C.
             */
            const registry =
                getRuntimeRegistry();

            if (
                !(registry instanceof Map)
            ) {
                throw new Error(
                    "Authoritative runtime identity Map unavailable."
                );
            }

            runtimeIdentityCountBefore =
                registry.size;

            runtimeIdentityCountAfter =
                registry.size;

            /*
             * If this is the first pass after page startup,
             * begin from start of IndexedDB.
             */
            if (
                passCount === 1
            ) {
                lastCursorKey =
                    null;
            }

            const hydration =
                await hydratePass(
                    registry
                );

            /*
             * Yield only after all current IndexedDB transactions
             * are closed.
             */
            await sleep(50);

            state =
                STATES.VERIFYING;

            const coverage =
                await readCoverage();

            const complete =
                coverageComplete(
                    coverage
                );

            if (complete) {
                state =
                    STATES.COMPLETE;

            } else if (
                hydration
                    .passLimitReached
            ) {
                state =
                    STATES.PASS_LIMIT_REACHED;

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
                        : hydration.passLimitReached
                            ? "HYDRATION_PASS_LIMIT_REACHED"
                            : "CANONICAL_RUNTIME_IDENTITY_HYDRATION_PARTIAL",

                state,

                passCount,

                chunkSize:
                    CHUNK_SIZE,

                maxIdentitiesPerPass:
                    MAX_IDENTITIES_PER_PASS,

                maxScannedRecordsPerPass:
                    MAX_SCANNED_RECORDS_PER_PASS,

                minimalRuntimeRecord:
                    true,

                fullTemporalRecordCopied:
                    false,

                runtimeIdentityCountBefore,
                runtimeIdentityCountAfter,

                scannedRecordCount,
                extractedIdentityCount,
                hydratedIdentityCount,
                skippedDuplicateCount,
                rejectedRecordCount,

                lastCursorKey,

                reachedEnd:
                    hydration.reachedEnd,

                passLimitReached:
                    hydration.passLimitReached,

                coverage,

                startedAt,
                completedAt,

                durationMs:
                    completedAt -
                    startedAt
            };

            console.log(
                `[RainGuard][${PHASE}] Run result`,
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
                success:
                    false,

                phase:
                    PHASE,

                version:
                    VERSION,

                build:
                    BUILD,

                status:
                    "CHUNKED_MINIMAL_IDENTITY_HYDRATION_FAILED",

                state,

                passCount,

                runtimeIdentityCountBefore,
                runtimeIdentityCountAfter,

                scannedRecordCount,
                extractedIdentityCount,
                hydratedIdentityCount,
                skippedDuplicateCount,
                rejectedRecordCount,

                lastCursorKey,

                error:
                    lastError,

                startedAt,
                completedAt,

                durationMs:
                    completedAt -
                    startedAt
            };

            console.error(
                `[RainGuard][${PHASE}] Run failed`,
                lastResult
            );

            return lastResult;

        } finally {
            /*
             * Always release the run lock.
             */
            running =
                false;
        }
    }

    /*
     * -------------------------------------------------------
     * Reset cursor
     * -------------------------------------------------------
     */

    function resetHydrationCursor() {
        if (running) {
            return false;
        }

        lastCursorKey =
            null;

        passCount =
            0;

        state =
            STATES.IDLE;

        console.log(
            `[RainGuard][${PHASE}] Hydration cursor reset`
        );

        return true;
    }

    /*
     * -------------------------------------------------------
     * Diagnostics
     * -------------------------------------------------------
     */

    async function diagnose() {
        const registry =
            getRuntimeRegistry();

        let coverage =
            null;

        try {
            coverage =
                await readCoverage();
        } catch (_) {}

        const result = {
            success:
                true,

            phase:
                PHASE,

            version:
                VERSION,

            build:
                BUILD,

            installed,
            running,
            state,

            passCount,

            runtimeRegistryAvailable:
                registry
                    instanceof Map,

            runtimeRegistryType:
                registry
                    instanceof Map
                        ? "Map"
                        : null,

            runtimeRegistrySize:
                registry
                    instanceof Map
                        ? registry.size
                        : 0,

            runtimeIdentityCountBefore,
            runtimeIdentityCountAfter,

            scannedRecordCount,
            extractedIdentityCount,
            hydratedIdentityCount,
            skippedDuplicateCount,
            rejectedRecordCount,

            lastCursorKey,

            chunkSize:
                CHUNK_SIZE,

            maxIdentitiesPerPass:
                MAX_IDENTITIES_PER_PASS,

            maxScannedRecordsPerPass:
                MAX_SCANNED_RECORDS_PER_PASS,

            betweenChunkDelayMs:
                BETWEEN_CHUNK_DELAY_MS,

            transactionSafeCursor:
                true,

            cursorAwaitDisabled:
                true,

            getAllDisabled:
                true,

            fullTemporalRecordCopied:
                false,

            minimalRuntimeRecord:
                true,

            memoryPressureGuard:
                true,

            c6Available:
                Boolean(
                    getC6()
                ),

            c7b2aAvailable:
                Boolean(
                    getC7B2A()
                ),

            c7b2cAvailable:
                Boolean(
                    getC7B2C()
                ),

            coverage,

            lastResult,
            lastError
        };

        console.log(
            `[RainGuard][${PHASE}] Diagnostics`,
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
     * Install
     * -------------------------------------------------------
     */

    function install() {
        if (installed) {
            return bridge;
        }

        installed =
            true;

        console.log(
            `[RainGuard][${PHASE}] Installed`,
            {
                version:
                    VERSION,

                build:
                    BUILD,

                chunkSize:
                    CHUNK_SIZE,

                maxIdentitiesPerPass:
                    MAX_IDENTITIES_PER_PASS,

                maxScannedRecordsPerPass:
                    MAX_SCANNED_RECORDS_PER_PASS,

                minimalRuntimeRecord:
                    true,

                memoryPressureGuard:
                    true,

                getAllDisabled:
                    true,

                cursorAwaitDisabled:
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

        install,
        run,
        diagnose,
        readCoverage,
        isComplete,
        resetHydrationCursor,

        get installed() {
            return installed;
        },

        get running() {
            return running;
        },

        get state() {
            return state;
        },

        get passCount() {
            return passCount;
        },

        get lastCursorKey() {
            return lastCursorKey;
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
        .resetRainGuard39A15F6N4B1B3C7B2BHydrationCursor =
        resetHydrationCursor;

    global
        .isRainGuard39A15F6N4B1B3C7B2BRuntimeIdentityHydrationComplete =
        isComplete;

    install();

})(window);
