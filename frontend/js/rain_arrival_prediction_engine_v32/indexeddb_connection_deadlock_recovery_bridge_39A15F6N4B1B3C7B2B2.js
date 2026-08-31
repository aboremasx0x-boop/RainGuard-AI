/*
 * RainGuard AI
 * Phase 39A-15F6N4B1B3C7B2B2
 *
 * IndexedDB Connection Deadlock Recovery
 * & Safe Reopen Bridge
 *
 * Goals:
 * -------------------------------------------------------
 * 1. Prevent repeated indexedDB.open() calls per chunk.
 * 2. Reuse one healthy database connection.
 * 3. Handle versionchange by closing stale connections.
 * 4. Detect blocked opens.
 * 5. Recover from stale/failed cached connections.
 * 6. Serialize concurrent open requests.
 * 7. Expose diagnostics for C7B2B1 integration.
 */

(function (global) {
    "use strict";

    const PHASE =
        "39A-15F6N4B1B3C7B2B2";

    const VERSION =
        "39A.15F6N4B1B3C7B2B2.0";

    const BUILD =
        "rainguard-v39-indexeddb-connection-deadlock-recovery-safe-reopen";

    const DB_NAME =
        "RainGuardTemporalHistoryV39";

    const BRIDGE_NAME =
        "RainGuard39A15F6N4B1B3C7B2B2BridgeV39";

    const OPEN_TIMEOUT_MS =
        8000;

    const BLOCKED_TIMEOUT_MS =
        4000;

    let installed =
        false;

    let cachedDb =
        null;

    let openingPromise =
        null;

    let state =
        "IDLE";

    let openAttemptCount =
        0;

    let openSuccessCount =
        0;

    let openFailureCount =
        0;

    let blockedCount =
        0;

    let versionChangeCount =
        0;

    let forcedCloseCount =
        0;

    let lastOpenedAt =
        null;

    let lastClosedAt =
        null;

    let lastError =
        null;

    let lastResult =
        null;


    function now() {
        return Date.now();
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


    function isDbUsable(db) {

        if (!db) {
            return false;
        }

        try {

            /*
             * Accessing objectStoreNames is a lightweight way
             * to confirm the connection object is still alive.
             */
            const names =
                Array.from(
                    db.objectStoreNames
                );

            return Boolean(
                db.name === DB_NAME &&
                names.length >= 0
            );

        } catch (_) {

            return false;
        }
    }


    function closeCachedDb(reason = "manual") {

        if (!cachedDb) {
            return false;
        }

        try {

            cachedDb.close();

        } catch (_) {}

        cachedDb =
            null;

        openingPromise =
            null;

        forcedCloseCount += 1;

        lastClosedAt =
            now();

        state =
            "CLOSED";

        console.warn(
            `[RainGuard][${PHASE}] Cached IndexedDB connection closed`,
            {
                reason,
                forcedCloseCount
            }
        );

        return true;
    }


    function attachConnectionGuards(db) {

        if (!db) {
            return;
        }

        /*
         * If another context upgrades the DB,
         * close this stale connection immediately.
         */
        db.onversionchange =
            event => {

                versionChangeCount += 1;

                console.warn(
                    `[RainGuard][${PHASE}] versionchange detected`,
                    {
                        oldVersion:
                            event?.oldVersion,

                        newVersion:
                            event?.newVersion
                    }
                );

                try {
                    db.close();
                } catch (_) {}

                if (
                    cachedDb === db
                ) {
                    cachedDb =
                        null;
                }

                openingPromise =
                    null;

                lastClosedAt =
                    now();

                state =
                    "VERSIONCHANGE_CLOSED";
            };


        /*
         * Browsers may emit close for abnormal shutdowns.
         */
        db.onclose =
            () => {

                if (
                    cachedDb === db
                ) {
                    cachedDb =
                        null;
                }

                openingPromise =
                    null;

                lastClosedAt =
                    now();

                state =
                    "CONNECTION_CLOSED";

                console.warn(
                    `[RainGuard][${PHASE}] IndexedDB connection closed`
                );
            };
    }


    function openFreshConnection() {

        state =
            "OPENING";

        openAttemptCount += 1;


        return new Promise(
            (resolve, reject) => {

                let settled =
                    false;

                let blocked =
                    false;

                let blockedTimer =
                    null;

                let openTimer =
                    null;

                let request;


                function cleanupTimers() {

                    if (blockedTimer) {
                        clearTimeout(
                            blockedTimer
                        );

                        blockedTimer =
                            null;
                    }

                    if (openTimer) {
                        clearTimeout(
                            openTimer
                        );

                        openTimer =
                            null;
                    }
                }


                function fail(error) {

                    if (settled) {
                        return;
                    }

                    settled =
                        true;

                    cleanupTimers();

                    openFailureCount += 1;

                    lastError =
                        normalizeError(
                            error
                        );

                    state =
                        "OPEN_FAILED";

                    openingPromise =
                        null;

                    reject(error);
                }


                function succeed(db) {

                    if (settled) {

                        try {
                            db?.close();
                        } catch (_) {}

                        return;
                    }

                    settled =
                        true;

                    cleanupTimers();

                    cachedDb =
                        db;

                    attachConnectionGuards(
                        db
                    );

                    openSuccessCount += 1;

                    lastOpenedAt =
                        now();

                    lastError =
                        null;

                    state =
                        "OPEN";

                    resolve(db);
                }


                try {

                    request =
                        global
                            .indexedDB
                            .open(
                                DB_NAME
                            );

                } catch (error) {

                    fail(error);

                    return;
                }


                openTimer =
                    setTimeout(
                        () => {

                            fail(
                                new Error(
                                    `IndexedDB open timeout after ${OPEN_TIMEOUT_MS} ms: ${DB_NAME}`
                                )
                            );

                        },
                        OPEN_TIMEOUT_MS
                    );


                request.onblocked =
                    () => {

                        blocked =
                            true;

                        blockedCount += 1;

                        state =
                            "BLOCKED";

                        console.error(
                            `[RainGuard][${PHASE}] IndexedDB open blocked`,
                            {
                                db:
                                    DB_NAME,

                                blockedCount
                            }
                        );


                        /*
                         * Do not wait forever for another
                         * stale connection to disappear.
                         */
                        blockedTimer =
                            setTimeout(
                                () => {

                                    fail(
                                        new Error(
                                            `IndexedDB open blocked for more than ${BLOCKED_TIMEOUT_MS} ms: ${DB_NAME}`
                                        )
                                    );

                                },
                                BLOCKED_TIMEOUT_MS
                            );
                    };


                request.onerror =
                    () => {

                        fail(
                            request.error ||
                            new Error(
                                `IndexedDB open failed: ${DB_NAME}`
                            )
                        );
                    };


                request.onsuccess =
                    () => {

                        const db =
                            request.result;


                        if (blocked) {

                            console.warn(
                                `[RainGuard][${PHASE}] IndexedDB recovered after blocked open`
                            );
                        }


                        succeed(db);
                    };
            }
        );
    }


    async function getConnection(options = {}) {

        const forceFresh =
            options.forceFresh === true;


        /*
         * Reuse healthy connection.
         */
        if (
            !forceFresh &&
            isDbUsable(
                cachedDb
            )
        ) {

            state =
                "REUSING_CACHED_CONNECTION";

            return cachedDb;
        }


        /*
         * Stale cached DB.
         */
        if (
            cachedDb &&
            !isDbUsable(
                cachedDb
            )
        ) {

            closeCachedDb(
                "STALE_CONNECTION"
            );
        }


        /*
         * Prevent parallel open requests.
         */
        if (
            !forceFresh &&
            openingPromise
        ) {

            state =
                "WAITING_EXISTING_OPEN";

            return openingPromise;
        }


        /*
         * Force fresh means close existing cached DB first.
         */
        if (
            forceFresh &&
            cachedDb
        ) {

            closeCachedDb(
                "FORCE_FRESH"
            );
        }


        openingPromise =
            openFreshConnection();


        try {

            const db =
                await openingPromise;

            return db;

        } finally {

            /*
             * Keep openingPromise only while the request
             * is actively pending.
             */
            openingPromise =
                null;
        }
    }


    function releaseConnection(
        reason = "consumer-release"
    ) {

        return closeCachedDb(
            reason
        );
    }


    async function probe() {

        const startedAt =
            now();

        try {

            const db =
                await getConnection();


            lastResult = {

                success:
                    true,

                phase:
                    PHASE,

                version:
                    VERSION,

                build:
                    BUILD,

                state,

                database:
                    db?.name ||
                    null,

                versionNumber:
                    db?.version ||
                    null,

                stores:
                    db
                        ? Array.from(
                            db.objectStoreNames
                        )
                        : [],

                openAttemptCount,

                openSuccessCount,

                openFailureCount,

                blockedCount,

                versionChangeCount,

                forcedCloseCount,

                lastOpenedAt,

                lastClosedAt,

                durationMs:
                    now() -
                    startedAt,

                error:
                    null
            };


            console.log(
                `[RainGuard][${PHASE}] Probe result`,
                lastResult
            );


            return lastResult;

        } catch (error) {

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

                state,

                database:
                    DB_NAME,

                openAttemptCount,

                openSuccessCount,

                openFailureCount,

                blockedCount,

                versionChangeCount,

                forcedCloseCount,

                lastOpenedAt,

                lastClosedAt,

                durationMs:
                    now() -
                    startedAt,

                error:
                    lastError
            };


            console.error(
                `[RainGuard][${PHASE}] Probe failed`,
                lastResult
            );


            return lastResult;
        }
    }


    function diagnose() {

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

            state,

            cachedConnectionAvailable:
                Boolean(
                    cachedDb
                ),

            cachedConnectionUsable:
                isDbUsable(
                    cachedDb
                ),

            openingPromiseActive:
                Boolean(
                    openingPromise
                ),

            openAttemptCount,

            openSuccessCount,

            openFailureCount,

            blockedCount,

            versionChangeCount,

            forcedCloseCount,

            lastOpenedAt,

            lastClosedAt,

            lastError,

            lastResult
        };


        console.log(
            `[RainGuard][${PHASE}] Diagnostics`,
            result
        );


        return result;
    }


    function install() {

        if (installed) {
            return bridge;
        }


        installed =
            true;

        state =
            "INSTALLED";


        console.log(
            `[RainGuard][${PHASE}] Installed`,
            {
                version:
                    VERSION,

                build:
                    BUILD,

                database:
                    DB_NAME,

                serializedOpen:
                    true,

                connectionReuse:
                    true,

                blockedRecovery:
                    true,

                versionChangeAutoClose:
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

        install,

        getConnection,

        releaseConnection,

        probe,

        diagnose,

        closeCachedDb,


        get installed() {
            return installed;
        },


        get state() {
            return state;
        },


        get cachedDb() {
            return cachedDb;
        },


        get openingPromiseActive() {
            return Boolean(
                openingPromise
            );
        },


        get openAttemptCount() {
            return openAttemptCount;
        },


        get openSuccessCount() {
            return openSuccessCount;
        },


        get openFailureCount() {
            return openFailureCount;
        },


        get blockedCount() {
            return blockedCount;
        },


        get versionChangeCount() {
            return versionChangeCount;
        },


        get forcedCloseCount() {
            return forcedCloseCount;
        },


        get lastError() {
            return lastError;
        },


        get lastResult() {
            return lastResult;
        }
    };


    global[
        BRIDGE_NAME
    ] =
        bridge;


    global
        .getRainGuard39A15F6N4B1B3C7B2B2IndexedDBConnection =
        getConnection;


    global
        .releaseRainGuard39A15F6N4B1B3C7B2B2IndexedDBConnection =
        releaseConnection;


    global
        .probeRainGuard39A15F6N4B1B3C7B2B2IndexedDBConnection =
        probe;


    global
        .diagnoseRainGuard39A15F6N4B1B3C7B2B2IndexedDBConnection =
        diagnose;


    install();

})(window);
