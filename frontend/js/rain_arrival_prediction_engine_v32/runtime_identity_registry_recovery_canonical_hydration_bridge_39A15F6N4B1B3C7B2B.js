/*
 * RainGuard AI
 * Phase 39A-15F6N4B1B3C7B2B1
 *
 * Chunked Minimal-Identity Hydration
 * Transaction Completion Repair
 * Key-Only Cursor Optimization
 * & Memory Pressure Guard
 *
 * Revision:
 * 39A.15F6N4B1B3C7B2B1.1
 *
 * Main repairs:
 * -------------------------------------------------------
 * 1. Prevent false Hydration cursor idle timeout.
 * 2. End every chunk through transaction completion.
 * 3. Never leave a cursor intentionally stopped while
 *    the idle timer remains active.
 * 4. Use openKeyCursor() when IndexedDB keyPath itself
 *    represents canonical identity.
 * 5. Avoid cloning huge temporalHistory values whenever
 *    key-only hydration is possible.
 * 6. Store only minimal runtime identity objects.
 * 7. Preserve safe incremental resume using lastCursorKey.
 * 8. Never use getAll().
 * 9. Never await inside cursor.onsuccess.
 */

(function (global) {
    "use strict";

    /*
     * =======================================================
     * Identity
     * =======================================================
     */

    const PHASE =
        "39A-15F6N4B1B3C7B2B1";

    const VERSION =
        "39A.15F6N4B1B3C7B2B1.1";

    const BUILD =
        "rainguard-v39-chunked-minimal-identity-hydration-transaction-completion-key-only-cursor-memory-guard";

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
     * =======================================================
     * Memory / transaction safety
     * =======================================================
     */

    const CHUNK_SIZE = 250;

    const MAX_IDENTITIES_PER_PASS = 2000;

    const MAX_SCANNED_RECORDS_PER_PASS = 10000;

    const DB_OPEN_TIMEOUT_MS = 10000;

    /*
     * This is still retained as a genuine stall detector.
     *
     * The difference in this revision is:
     * the timer is cancelled as soon as the cursor is
     * intentionally stopped or reaches the end.
     */
    const CURSOR_IDLE_TIMEOUT_MS = 12000;

    /*
     * Yield only AFTER transaction completion.
     */
    const BETWEEN_CHUNK_DELAY_MS = 25;

    const MIN_COVERAGE_PERCENT = 99;


    /*
     * =======================================================
     * Identity-compatible IndexedDB key paths
     * =======================================================
     */

    const IDENTITY_KEY_PATHS =
        new Set([
            "canonicalTrackId",
            "canonicalIdentity",
            "identityId",
            "identityID",
            "identity",
            "stableIdentity",
            "stableIdentityId",
            "trackIdentity",
            "trackIdentityId",
            "trackId",
            "entityId",
            "entityID",
            "stormId",
            "cellId",
            "id",
            "key"
        ]);


    /*
     * =======================================================
     * States
     * =======================================================
     */

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

        STOPPING_CHUNK:
            "HYDRATION_CHUNK_STOP_REQUESTED",

        WAITING_TRANSACTION:
            "WAITING_HYDRATION_TRANSACTION_COMPLETION",

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


    /*
     * =======================================================
     * Runtime state
     * =======================================================
     */

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
     * Diagnostics added in revision .1
     */
    let selectedCursorMode = null;

    let selectedDatabaseName = null;

    let selectedStoreName = null;

    let selectedStoreKeyPath = null;

    let chunkCount = 0;

    let transactionCompletedCount = 0;

    let cursorIdleTimeoutCount = 0;


    /*
     * =======================================================
     * Utilities
     * =======================================================
     */

    function now() {
        return Date.now();
    }


    function sleep(ms) {
        return new Promise(
            resolve =>
                setTimeout(
                    resolve,
                    ms
                )
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
     * =======================================================
     * Runtime registry
     * =======================================================
     */

    function getRuntimeRegistry() {

        state =
            STATES.CHECKING_RUNTIME_REGISTRY;

        const c7b2c =
            getC7B2C();

        /*
         * Preferred source:
         * C7B2C authoritative registry.
         */
        if (
            c7b2c &&
            typeof c7b2c.getRegistry ===
                "function"
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

        /*
         * Fallback global registry.
         */
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
     * =======================================================
     * Identity normalization
     * =======================================================
     */

    function normalizeIdentityKey(value) {

        if (
            value === null ||
            value === undefined
        ) {
            return null;
        }

        /*
         * Arrays / objects should never become accidental
         * "[object Object]" runtime identities.
         */
        if (
            typeof value === "object"
        ) {
            return null;
        }

        const text =
            String(value)
                .trim();

        return text || null;
    }


    /*
     * =======================================================
     * Identity extraction
     * =======================================================
     */

    function getIdentityKey(
        record,
        depth = 0
    ) {

        if (
            !record ||
            typeof record !== "object"
        ) {
            return null;
        }

        /*
         * Recursion guard.
         */
        if (depth > 3) {
            return null;
        }

        const candidates = [

            record.canonicalTrackId,

            record.canonicalIdentity,

            record.identityId,

            record.identityID,

            (
                typeof record.identity !==
                "object"
                    ? record.identity
                    : null
            ),

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


        /*
         * Limited nested search.
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
                    nested,
                    depth + 1
                );

            if (key) {
                return key;
            }
        }

        return null;
    }


    /*
     * =======================================================
     * Minimal runtime record
     * =======================================================
     */

    function createMinimalRuntimeIdentity(
        key,
        sourceRecord = null
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

            minimalRuntimeIdentity:
                true,

            rehydrationPhase:
                PHASE,

            rehydrationVersion:
                VERSION,

            rehydratedAt:
                now(),

            /*
             * Include only two small timestamps when they
             * already exist in sourceRecord.
             *
             * Never copy:
             * history[]
             * observations[]
             * metadata payloads
             * source payloads
             * motion histories
             */
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
     * =======================================================
     * IndexedDB open
     * =======================================================
     */

    function openDatabase() {

        state =
            STATES.OPENING_INDEXEDDB;

        return new Promise(
            (resolve, reject) => {

                let settled =
                    false;

                const timeout =
                    setTimeout(() => {

                        if (settled) {
                            return;
                        }

                        settled =
                            true;

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

                        selectedDatabaseName =
                            request.result?.name ||
                            DB_NAME;

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
     * =======================================================
     * Cursor mode selection
     * =======================================================
     */

    function shouldUseKeyOnlyCursor(
        store
    ) {

        if (!store) {
            return false;
        }

        /*
         * Array keyPath means composite key.
         * Do not infer canonical identity from it.
         */
        if (
            Array.isArray(
                store.keyPath
            )
        ) {
            return false;
        }

        const keyPath =
            typeof store.keyPath ===
                "string"
                ? store.keyPath
                : null;

        selectedStoreKeyPath =
            keyPath;

        /*
         * Key-only mode is used only when the DB schema
         * explicitly identifies the primary key as one
         * of the supported identity fields.
         */
        return Boolean(
            keyPath &&
            IDENTITY_KEY_PATHS.has(
                keyPath
            ) &&
            typeof store.openKeyCursor ===
                "function"
        );
    }


    /*
     * =======================================================
     * One transaction chunk
     * =======================================================
     */

    async function hydrateChunk(
        registry,
        startAfterKey
    ) {

        state =
            STATES.HYDRATING;

        const db =
            await openDatabase();


        return new Promise(
            (resolve, reject) => {

                let settled =
                    false;

                let stopRequested =
                    false;

                let tx =
                    null;

                let idleTimer =
                    null;

                let cursorRequest =
                    null;


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


                /*
                 * -------------------------------------------
                 * Timer
                 * -------------------------------------------
                 */

                function clearIdleTimer() {

                    if (idleTimer) {

                        clearTimeout(
                            idleTimer
                        );

                        idleTimer =
                            null;
                    }
                }


                function resetIdleTimer() {

                    clearIdleTimer();

                    /*
                     * Never arm idle timeout after an
                     * intentional stop request.
                     */
                    if (stopRequested) {
                        return;
                    }

                    idleTimer =
                        setTimeout(() => {

                            cursorIdleTimeoutCount += 1;

                            finishFailure(
                                new Error(
                                    `Hydration cursor idle timeout after ${CURSOR_IDLE_TIMEOUT_MS} ms`
                                )
                            );

                        }, CURSOR_IDLE_TIMEOUT_MS);
                }


                /*
                 * -------------------------------------------
                 * Database cleanup
                 * -------------------------------------------
                 */

                function safeClose() {

                    try {

                        db?.close();

                    } catch (_) {}
                }


                /*
                 * -------------------------------------------
                 * Final result factory
                 * -------------------------------------------
                 */

                function createChunkResult() {

                    return {

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

                        passLimitReached,

                        stopRequested,

                        cursorMode:
                            selectedCursorMode,

                        storeKeyPath:
                            selectedStoreKeyPath
                    };
                }


                /*
                 * -------------------------------------------
                 * Success
                 *
                 * IMPORTANT:
                 * This is called from tx.oncomplete.
                 * -------------------------------------------
                 */

                function finishSuccess() {

                    if (settled) {
                        return;
                    }

                    settled =
                        true;

                    clearIdleTimer();

                    state =
                        STATES.WAITING_TRANSACTION;

                    const result =
                        createChunkResult();

                    safeClose();

                    resolve(result);
                }


                /*
                 * -------------------------------------------
                 * Failure
                 * -------------------------------------------
                 */

                function finishFailure(
                    error
                ) {

                    if (settled) {
                        return;
                    }

                    settled =
                        true;

                    clearIdleTimer();

                    try {

                        tx?.abort();

                    } catch (_) {}

                    safeClose();

                    reject(error);
                }


                /*
                 * -------------------------------------------
                 * Intentional cursor stop
                 * -------------------------------------------
                 */

                function requestStop(
                    reason
                ) {

                    if (stopRequested) {
                        return;
                    }

                    stopRequested =
                        true;

                    state =
                        STATES.STOPPING_CHUNK;

                    clearIdleTimer();

                    console.log(
                        `[RainGuard][${PHASE}] Cursor stop requested`,
                        {
                            reason,

                            chunkScanned,

                            chunkHydrated,

                            hydratedIdentityCount,

                            scannedRecordCount,

                            chunkLastKey
                        }
                    );

                    /*
                     * DO NOT:
                     * cursor.continue()
                     *
                     * The current cursor request will be
                     * allowed to terminate naturally.
                     *
                     * tx.oncomplete will resolve the chunk.
                     */
                }


                /*
                 * -------------------------------------------
                 * Transaction creation
                 * -------------------------------------------
                 */

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

                    selectedStoreName =
                        store.name;

                    selectedStoreKeyPath =
                        store.keyPath;

                } catch (error) {

                    finishFailure(
                        error
                    );

                    return;
                }


                /*
                 * -------------------------------------------
                 * Transaction events
                 * -------------------------------------------
                 */

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

                        transactionCompletedCount += 1;

                        /*
                         * Transaction completion is now the
                         * canonical success boundary.
                         */
                        finishSuccess();
                    };


                /*
                 * -------------------------------------------
                 * Resume range
                 * -------------------------------------------
                 */

                let range =
                    null;

                if (
                    startAfterKey !== null &&
                    startAfterKey !== undefined
                ) {

                    try {

                        range =
                            IDBKeyRange
                                .lowerBound(
                                    startAfterKey,
                                    true
                                );

                    } catch (error) {

                        console.warn(
                            `[RainGuard][${PHASE}] Resume key could not build IDBKeyRange`,
                            {
                                startAfterKey,
                                error:
                                    normalizeError(
                                        error
                                    )
                            }
                        );

                        range =
                            null;
                    }
                }


                /*
                 * -------------------------------------------
                 * Choose cursor mode
                 * -------------------------------------------
                 */

                const keyOnly =
                    shouldUseKeyOnlyCursor(
                        store
                    );


                selectedCursorMode =
                    keyOnly
                        ? "KEY_ONLY_CURSOR"
                        : "VALUE_CURSOR";


                try {

                    cursorRequest =
                        keyOnly

                            ? store.openKeyCursor(
                                range
                            )

                            : store.openCursor(
                                range
                            );

                } catch (error) {

                    finishFailure(
                        error
                    );

                    return;
                }


                /*
                 * -------------------------------------------
                 * Initial stall timer
                 * -------------------------------------------
                 */

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
                 * ===================================================
                 * Cursor loop
                 *
                 * NEVER mark async.
                 * NEVER await.
                 * NEVER sleep.
                 * ===================================================
                 */

                cursorRequest.onsuccess =
                    event => {

                        if (
                            settled ||
                            stopRequested
                        ) {
                            return;
                        }


                        resetIdleTimer();


                        const cursor =
                            event
                                .target
                                .result;


                        /*
                         * -------------------------------------------
                         * Natural end
                         * -------------------------------------------
                         */

                        if (!cursor) {

                            reachedEnd =
                                true;

                            /*
                             * Critical repair:
                             *
                             * Cursor has completed.
                             * Do not leave idleTimer running.
                             */
                            requestStop(
                                "CURSOR_END_REACHED"
                            );

                            return;
                        }


                        /*
                         * -------------------------------------------
                         * Preserve resume key BEFORE processing.
                         * -------------------------------------------
                         */

                        chunkLastKey =
                            cursor.primaryKey !==
                                undefined
                                ? cursor.primaryKey
                                : cursor.key;


                        /*
                         * -------------------------------------------
                         * Pass limit before processing
                         * -------------------------------------------
                         */

                        if (
                            scannedRecordCount >=
                                MAX_SCANNED_RECORDS_PER_PASS ||

                            hydratedIdentityCount >=
                                MAX_IDENTITIES_PER_PASS
                        ) {

                            passLimitReached =
                                true;

                            requestStop(
                                "PASS_LIMIT_REACHED_BEFORE_RECORD"
                            );

                            return;
                        }


                        /*
                         * -------------------------------------------
                         * Chunk limit before processing
                         * -------------------------------------------
                         */

                        if (
                            chunkScanned >=
                                CHUNK_SIZE
                        ) {

                            requestStop(
                                "CHUNK_SIZE_REACHED"
                            );

                            return;
                        }


                        /*
                         * -------------------------------------------
                         * Count record
                         * -------------------------------------------
                         */

                        chunkScanned += 1;

                        scannedRecordCount += 1;


                        /*
                         * -------------------------------------------
                         * Extract identity
                         * -------------------------------------------
                         */

                        let key =
                            null;

                        let sourceRecord =
                            null;


                        if (
                            selectedCursorMode ===
                                "KEY_ONLY_CURSOR"
                        ) {

                            /*
                             * NO cursor.value.
                             *
                             * Prevents structured cloning of
                             * potentially huge temporalHistory
                             * payload.
                             */
                            key =
                                normalizeIdentityKey(
                                    cursor.primaryKey !==
                                        undefined
                                        ? cursor.primaryKey
                                        : cursor.key
                                );

                        } else {

                            /*
                             * Compatibility fallback.
                             */
                            sourceRecord =
                                cursor.value;

                            key =
                                getIdentityKey(
                                    sourceRecord
                                );
                        }


                        /*
                         * -------------------------------------------
                         * Invalid record
                         * -------------------------------------------
                         */

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


                        /*
                         * -------------------------------------------
                         * Extracted identity
                         * -------------------------------------------
                         */

                        chunkExtracted += 1;

                        extractedIdentityCount += 1;


                        /*
                         * -------------------------------------------
                         * Duplicate
                         * -------------------------------------------
                         */

                        if (
                            registry.has(
                                key
                            )
                        ) {

                            chunkDuplicates += 1;

                            skippedDuplicateCount += 1;

                        } else {

                            /*
                             * CRITICAL MEMORY RULE:
                             *
                             * Never:
                             *
                             * registry.set(key, cursor.value)
                             */

                            const minimalRecord =
                                createMinimalRuntimeIdentity(
                                    key,
                                    sourceRecord
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
                         * -------------------------------------------
                         * Limits AFTER processing current record
                         * -------------------------------------------
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


                            requestStop(
                                passLimitReached
                                    ? "PASS_LIMIT_REACHED_AFTER_RECORD"
                                    : "CHUNK_SIZE_REACHED_AFTER_RECORD"
                            );

                            return;
                        }


                        /*
                         * -------------------------------------------
                         * Continue synchronously
                         * -------------------------------------------
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
     * =======================================================
     * Full pass
     * =======================================================
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


            chunkCount += 1;


            lastCursorKey =
                chunk.lastKey;


            reachedEnd =
                Boolean(
                    chunk.reachedEnd
                );


            passLimitReached =
                Boolean(
                    chunk.passLimitReached
                );


            runtimeIdentityCountAfter =
                registry.size;


            console.log(
                `[RainGuard][${PHASE}] Hydration chunk completed`,
                {

                    chunkCount,

                    cursorMode:
                        chunk.cursorMode,

                    storeKeyPath:
                        chunk.storeKeyPath,

                    chunkScanned:
                        chunk.chunkScanned,

                    chunkExtracted:
                        chunk.chunkExtracted,

                    chunkHydrated:
                        chunk.chunkHydrated,

                    chunkDuplicates:
                        chunk.chunkDuplicates,

                    chunkRejected:
                        chunk.chunkRejected,

                    runtimeIdentityCount:
                        registry.size,

                    totalHydratedThisPass:
                        hydratedIdentityCount,

                    totalScannedThisPass:
                        scannedRecordCount,

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
             * Yield only AFTER previous transaction
             * completed and DB connection closed.
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
     * =======================================================
     * Coverage
     * =======================================================
     */

    async function readCoverage() {

        const c6 =
            getC6();


        if (
            c6 &&
            typeof c6
                .getIdentityCoverageReport ===
                "function"
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
            typeof c6.diagnose ===
                "function"
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


    /*
     * =======================================================
     * Coverage verification
     * =======================================================
     */

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
                .identityCoverageVerified ===
                true
        );
    }


    /*
     * =======================================================
     * Main run
     * =======================================================
     */

    async function run() {

        /*
         * Prevent concurrent hydration.
         */
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


        chunkCount =
            0;


        transactionCompletedCount =
            0;


        cursorIdleTimeoutCount =
            0;


        try {

            /*
             * -----------------------------------------------
             * Runtime registry
             * -----------------------------------------------
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
             * First pass after startup starts from DB beginning.
             */
            if (
                passCount === 1
            ) {

                lastCursorKey =
                    null;
            }


            /*
             * -----------------------------------------------
             * Hydration
             * -----------------------------------------------
             */

            const hydration =
                await hydratePass(
                    registry
                );


            /*
             * Previous IndexedDB transaction has already
             * completed before hydrateChunk resolves.
             */
            await sleep(50);


            state =
                STATES.VERIFYING;


            /*
             * -----------------------------------------------
             * Coverage
             * -----------------------------------------------
             */

            const coverage =
                await readCoverage();


            const complete =
                coverageComplete(
                    coverage
                );


            /*
             * -----------------------------------------------
             * Final state
             * -----------------------------------------------
             */

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


            /*
             * IMPORTANT:
             *
             * "success" means the hydration operation itself
             * executed successfully.
             *
             * It no longer means 100% national coverage.
             *
             * National completion is represented separately
             * by hydrationComplete.
             */
            lastResult = {

                success:
                    true,

                hydrationComplete:
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


                chunkCount,


                transactionCompletedCount,


                cursorIdleTimeoutCount,


                selectedCursorMode,


                selectedDatabaseName,


                selectedStoreName,


                selectedStoreKeyPath,


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


                keyOnlyCursorOptimization:
                    selectedCursorMode ===
                        "KEY_ONLY_CURSOR",


                memoryPressureGuard:
                    true,


                transactionCompletionBoundary:
                    true,


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


                error:
                    null,


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

                hydrationComplete:
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

                chunkCount,

                transactionCompletedCount,

                cursorIdleTimeoutCount,

                selectedCursorMode,

                selectedDatabaseName,

                selectedStoreName,

                selectedStoreKeyPath,

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
             * Critical:
             * always release run lock.
             */
            running =
                false;
        }
    }


    /*
     * =======================================================
     * Reset hydration cursor
     * =======================================================
     */

    function resetHydrationCursor() {

        if (running) {

            console.warn(
                `[RainGuard][${PHASE}] Cursor reset refused while hydration is running`
            );

            return false;
        }


        lastCursorKey =
            null;


        passCount =
            0;


        state =
            STATES.IDLE;


        lastResult =
            null;


        lastError =
            null;


        console.log(
            `[RainGuard][${PHASE}] Hydration cursor reset`
        );


        return true;
    }


    /*
     * =======================================================
     * Diagnostics
     * =======================================================
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
                registry instanceof Map,


            runtimeRegistryType:
                registry instanceof Map
                    ? "Map"
                    : null,


            runtimeRegistrySize:
                registry instanceof Map
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


            chunkCount,


            transactionCompletedCount,


            cursorIdleTimeoutCount,


            selectedCursorMode,


            selectedDatabaseName,


            selectedStoreName,


            selectedStoreKeyPath,


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


            transactionCompletionBoundary:
                true,


            cursorAwaitDisabled:
                true,


            getAllDisabled:
                true,


            fullTemporalRecordCopied:
                false,


            minimalRuntimeRecord:
                true,


            keyOnlyCursorOptimization:
                selectedCursorMode ===
                    "KEY_ONLY_CURSOR",


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


    /*
     * =======================================================
     * Completion
     * =======================================================
     */

    function isComplete() {

        return coverageComplete(
            lastCoverage
        );
    }


    /*
     * =======================================================
     * Installation
     * =======================================================
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

                transactionCompletionRepair:
                    true,

                keyOnlyCursorSupport:
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
     * =======================================================
     * Public bridge
     * =======================================================
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


        get selectedCursorMode() {
            return selectedCursorMode;
        },


        get selectedDatabaseName() {
            return selectedDatabaseName;
        },


        get selectedStoreName() {
            return selectedStoreName;
        },


        get selectedStoreKeyPath() {
            return selectedStoreKeyPath;
        },


        get chunkCount() {
            return chunkCount;
        },


        get transactionCompletedCount() {
            return transactionCompletedCount;
        },


        get cursorIdleTimeoutCount() {
            return cursorIdleTimeoutCount;
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


    /*
     * =======================================================
     * Global exposure
     * =======================================================
     */

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


    /*
     * Friendly aliases for easier testing.
     */
    global
        .diagnoseRainGuard39A15F6N4B1B3C7B2B1 =
        diagnose;


    global
        .isRainGuard39A15F6N4B1B3C7B2B1Complete =
        isComplete;


    /*
     * =======================================================
     * Install
     * =======================================================
     */

    install();

})(window);
