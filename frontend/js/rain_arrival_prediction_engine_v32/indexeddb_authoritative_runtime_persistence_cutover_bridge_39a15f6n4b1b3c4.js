/*
============================================================
RainGuard AI V39
Phase 39A-15F6N4B1B3C4
IndexedDB Authoritative Runtime Persistence Cutover Bridge
============================================================

Purpose
-------
- Make IndexedDB the authoritative persistence layer for temporal history.
- Stop the legacy B1B3C heavy temporal-history payload from being written
  into localStorage and triggering QuotaExceededError.
- Preserve all unrelated localStorage writes.
- Preserve only lightweight cutover metadata in localStorage.
- Trigger/verify B1B3C2 IndexedDB persistence after cutover.
- Remain compatible with:
    Phase 39A-15F6N4B1B3C / C1
    Phase 39A-15F6N4B1B3C2
    Phase 39A-15F6N4B1B3C3

Target path
-----------
frontend/js/rain_arrival_prediction_engine_v32/
indexeddb_authoritative_runtime_persistence_cutover_bridge_39a15f6n4b1b3c4.js
*/

(function (global) {
    "use strict";

    const PHASE = "39A-15F6N4B1B3C4";
    const VERSION = "39A.15F6N4B1B3C4.0";
    const BUILD =
        "rainguard-v39-indexeddb-authoritative-runtime-persistence-cutover-bridge";

    const LEGACY_HEAVY_KEY =
        "RainGuard:39A15F6N4B1B3C:TemporalCoordinateHistory:v1";

    const CUTOVER_META_KEY =
        "RainGuard:39A15F6N4B1B3C4:CutoverMeta:v1";

    const C2_BRIDGE =
        "RainGuard39A15F6N4B1B3C2BridgeV39";

    const C2_RUN =
        "runRainGuard39A15F6N4B1B3C2IndexedDBPersistentTemporalHistoryStorageBridge";

    const C3_BRIDGE =
        "RainGuard39A15F6N4B1B3C3BridgeV39";

    const RESULT_NAME =
        "RainGuard39A15F6N4B1B3C4ResultV39";

    const BRIDGE_NAME =
        "RainGuard39A15F6N4B1B3C4BridgeV39";

    const RUN_NAME =
        "runRainGuard39A15F6N4B1B3C4IndexedDBAuthoritativeRuntimePersistenceCutoverBridge";

    const DIAG_NAME =
        "diagnoseRainGuard39A15F6N4B1B3C4IndexedDBAuthoritativeRuntimePersistenceCutover";

    const INSTALL_NAME =
        "installRainGuard39A15F6N4B1B3C4PersistenceCutover";

    const UNINSTALL_NAME =
        "uninstallRainGuard39A15F6N4B1B3C4PersistenceCutover";

    const VERIFY_INTERVAL_MS = 15000;

    let installed = false;
    let running = false;
    let verifyTimer = null;

    let originalStorageSetItem = null;
    let originalStorageRemoveItem = null;

    let suppressedLegacyWrites = 0;
    let suppressedLegacyBytes = 0;
    let lastSuppressedAt = null;

    let indexedDBSyncCount = 0;
    let indexedDBSyncFailureCount = 0;
    let lastIndexedDBResult = null;

    function now() {
        return Date.now();
    }

    function byteLength(value) {
        try {
            return new Blob([String(value ?? "")]).size;
        } catch (_) {
            return String(value ?? "").length;
        }
    }

    function safeWriteMeta(extra = {}) {
        try {
            const meta = {
                phase: PHASE,
                version: VERSION,
                build: BUILD,
                installed,
                authoritativeStore: "IndexedDB",
                legacyHeavyKeySuppressed: true,
                suppressedLegacyWrites,
                suppressedLegacyBytes,
                indexedDBSyncCount,
                indexedDBSyncFailureCount,
                lastSuppressedAt,
                updatedAt: now(),
                ...extra
            };

            global.localStorage?.setItem(
                CUTOVER_META_KEY,
                JSON.stringify(meta)
            );

            return true;
        } catch (_) {
            return false;
        }
    }

    function isC2Available() {
        return (
            typeof global[C2_RUN] === "function" ||
            typeof global[C2_BRIDGE]?.run === "function"
        );
    }

    async function runC2Persistence() {
        if (!isC2Available()) {
            throw new Error("B1B3C2_INDEXEDDB_PERSISTENCE_UNAVAILABLE");
        }

        let result;

        if (typeof global[C2_RUN] === "function") {
            result = await global[C2_RUN]();
        } else {
            result = await global[C2_BRIDGE].run();
        }

        lastIndexedDBResult = result;

        if (result?.success && result?.indexedDBPersisted === true) {
            indexedDBSyncCount += 1;
        } else {
            indexedDBSyncFailureCount += 1;
        }

        return result;
    }

    function installCutover() {
        if (installed) {
            return {
                success: true,
                phase: PHASE,
                status: "CUTOVER_ALREADY_INSTALLED"
            };
        }

        if (!global.Storage?.prototype) {
            return {
                success: false,
                phase: PHASE,
                status: "STORAGE_PROTOTYPE_UNAVAILABLE"
            };
        }

        originalStorageSetItem =
            originalStorageSetItem ||
            global.Storage.prototype.setItem;

        originalStorageRemoveItem =
            originalStorageRemoveItem ||
            global.Storage.prototype.removeItem;

        if (typeof originalStorageSetItem !== "function") {
            return {
                success: false,
                phase: PHASE,
                status: "ORIGINAL_STORAGE_SETITEM_UNAVAILABLE"
            };
        }

        const guardedSetItem = function (key, value) {
            const normalizedKey = String(key);

            const isLocalStorage =
                (() => {
                    try {
                        return this === global.localStorage;
                    } catch (_) {
                        return false;
                    }
                })();

            if (
                isLocalStorage &&
                normalizedKey === LEGACY_HEAVY_KEY
            ) {
                const bytes = byteLength(value);

                suppressedLegacyWrites += 1;
                suppressedLegacyBytes += bytes;
                lastSuppressedAt = now();

                console.warn(
                    `[RainGuard][${PHASE}] Legacy heavy localStorage write suppressed`,
                    {
                        key: normalizedKey,
                        bytes,
                        suppressedLegacyWrites,
                        authoritativeStore: "IndexedDB"
                    }
                );

                safeWriteMeta({
                    lastSuppressedKey: normalizedKey,
                    lastSuppressedBytes: bytes
                });

                return;
            }

            return originalStorageSetItem.call(
                this,
                key,
                value
            );
        };

        Object.defineProperty(
            guardedSetItem,
            "__rainGuard39A15F6N4B1B3C4Guard",
            {
                value: true,
                configurable: false,
                enumerable: false,
                writable: false
            }
        );

        global.Storage.prototype.setItem =
            guardedSetItem;

        installed = true;

        safeWriteMeta({
            installedAt: now()
        });

        console.log(
            `[RainGuard][${PHASE}] IndexedDB authoritative persistence cutover installed`,
            {
                legacyHeavyKey: LEGACY_HEAVY_KEY,
                authoritativeStore: "IndexedDB"
            }
        );

        return {
            success: true,
            phase: PHASE,
            version: VERSION,
            build: BUILD,
            status: "INDEXEDDB_AUTHORITATIVE_PERSISTENCE_CUTOVER_INSTALLED",
            authoritativeStore: "IndexedDB",
            legacyHeavyKey: LEGACY_HEAVY_KEY
        };
    }

    function uninstallCutover() {
        if (!installed) {
            return {
                success: true,
                phase: PHASE,
                status: "CUTOVER_ALREADY_UNINSTALLED"
            };
        }

        if (
            originalStorageSetItem &&
            global.Storage?.prototype
        ) {
            global.Storage.prototype.setItem =
                originalStorageSetItem;
        }

        installed = false;

        if (verifyTimer) {
            global.clearInterval(verifyTimer);
            verifyTimer = null;
        }

        safeWriteMeta({
            uninstalledAt: now()
        });

        return {
            success: true,
            phase: PHASE,
            version: VERSION,
            status: "INDEXEDDB_AUTHORITATIVE_PERSISTENCE_CUTOVER_UNINSTALLED"
        };
    }

    async function run() {
        if (running) {
            return global[RESULT_NAME] ?? {
                success: false,
                phase: PHASE,
                status: "ALREADY_RUNNING"
            };
        }

        running = true;

        const startedAt = now();

        try {
            const installResult =
                installCutover();

            if (!installResult?.success) {
                throw new Error(
                    installResult?.status ||
                    "CUTOVER_INSTALL_FAILED"
                );
            }

            let c2Result = null;

            try {
                c2Result =
                    await runC2Persistence();
            } catch (error) {
                indexedDBSyncFailureCount += 1;

                console.warn(
                    `[RainGuard][${PHASE}] Initial IndexedDB sync failed`,
                    error
                );
            }

            const c3 =
                global[C3_BRIDGE];

            const result = {
                success: true,
                phase: PHASE,
                version: VERSION,
                build: BUILD,

                status:
                    "INDEXEDDB_AUTHORITATIVE_RUNTIME_PERSISTENCE_CUTOVER_ACTIVE",

                generatedAt: now(),
                durationMs: now() - startedAt,

                installed,
                authoritativeStore: "IndexedDB",

                legacyHeavyKey:
                    LEGACY_HEAVY_KEY,

                legacyHeavyWriteSuppressionActive:
                    installed,

                suppressedLegacyWrites,
                suppressedLegacyBytes,
                lastSuppressedAt,

                indexedDBPersistenceAvailable:
                    isC2Available(),

                indexedDBSyncCount,
                indexedDBSyncFailureCount,

                c2LastResult:
                    c2Result,

                c3Available:
                    Boolean(c3),

                c3AutoRehydrationCompleted:
                    Boolean(
                        c3?.autoRehydrationCompleted
                    ),

                localStorageMetaOnly:
                    true
            };

            global[RESULT_NAME] =
                result;

            safeWriteMeta({
                lastRunAt: result.generatedAt,
                status: result.status
            });

            console.log(
                `[RainGuard][${PHASE}] Runtime persistence cutover result:`,
                result
            );

            return result;

        } catch (error) {
            const result = {
                success: false,
                phase: PHASE,
                version: VERSION,
                build: BUILD,
                status:
                    "INDEXEDDB_AUTHORITATIVE_RUNTIME_PERSISTENCE_CUTOVER_FAILED",
                generatedAt: now(),
                durationMs: now() - startedAt,
                installed,
                error: String(
                    error?.stack ||
                    error?.message ||
                    error
                )
            };

            global[RESULT_NAME] =
                result;

            console.error(
                `[RainGuard][${PHASE}]`,
                error
            );

            return result;

        } finally {
            running = false;
        }
    }

    async function verifyIndexedDBAuthority() {
        let result = null;

        try {
            result =
                await runC2Persistence();
        } catch (error) {
            indexedDBSyncFailureCount += 1;

            console.warn(
                `[RainGuard][${PHASE}] IndexedDB authority verification failed`,
                error
            );
        }

        safeWriteMeta({
            lastVerificationAt: now()
        });

        return result;
    }

    function startVerificationLoop() {
        if (verifyTimer) {
            return false;
        }

        verifyTimer =
            global.setInterval(
                () => {
                    verifyIndexedDBAuthority();
                },
                VERIFY_INTERVAL_MS
            );

        return true;
    }

    function stopVerificationLoop() {
        if (!verifyTimer) {
            return false;
        }

        global.clearInterval(
            verifyTimer
        );

        verifyTimer = null;

        return true;
    }

    async function diagnose() {
        let legacyKeyPresent = false;
        let legacyKeyBytes = 0;

        try {
            const value =
                global.localStorage?.getItem(
                    LEGACY_HEAVY_KEY
                );

            legacyKeyPresent =
                value !== null;

            legacyKeyBytes =
                value !== null
                    ? byteLength(value)
                    : 0;
        } catch (_) {}

        let indexedDBDiagnostic = null;

        try {
            const bridge =
                global[C2_BRIDGE];

            if (
                bridge &&
                typeof bridge.diagnose === "function"
            ) {
                indexedDBDiagnostic =
                    await bridge.diagnose();
            }
        } catch (_) {}

        const c3 =
            global[C3_BRIDGE];

        const result = {
            success: true,

            phase: PHASE,
            version: VERSION,
            build: BUILD,

            installed,
            running,

            authoritativeStore:
                "IndexedDB",

            legacyHeavyKey:
                LEGACY_HEAVY_KEY,

            legacyHeavyWriteSuppressionActive:
                installed,

            legacyKeyPresent,
            legacyKeyBytes,

            suppressedLegacyWrites,
            suppressedLegacyBytes,
            lastSuppressedAt,

            indexedDBPersistenceAvailable:
                isC2Available(),

            indexedDBSyncCount,
            indexedDBSyncFailureCount,

            verificationLoopActive:
                Boolean(verifyTimer),

            indexedDBDiagnostic,

            c3Available:
                Boolean(c3),

            c3AutoRehydrationCompleted:
                Boolean(
                    c3?.autoRehydrationCompleted
                ),

            lastIndexedDBResult,

            lastResult:
                global[RESULT_NAME] ?? null
        };

        console.log(
            `[RainGuard][${PHASE}] Diagnostics:`,
            result
        );

        return result;
    }

    global[RUN_NAME] =
        run;

    global[DIAG_NAME] =
        diagnose;

    global[INSTALL_NAME] =
        installCutover;

    global[UNINSTALL_NAME] =
        uninstallCutover;

    global[BRIDGE_NAME] = {
        phase: PHASE,
        version: VERSION,
        build: BUILD,

        authoritativeStore:
            "IndexedDB",

        legacyHeavyKey:
            LEGACY_HEAVY_KEY,

        cutoverMetaKey:
            CUTOVER_META_KEY,

        verifyIntervalMs:
            VERIFY_INTERVAL_MS,

        get installed() {
            return installed;
        },

        get running() {
            return running;
        },

        get suppressedLegacyWrites() {
            return suppressedLegacyWrites;
        },

        get suppressedLegacyBytes() {
            return suppressedLegacyBytes;
        },

        get indexedDBSyncCount() {
            return indexedDBSyncCount;
        },

        get indexedDBSyncFailureCount() {
            return indexedDBSyncFailureCount;
        },

        get verificationLoopActive() {
            return Boolean(verifyTimer);
        },

        run,
        diagnose,
        installCutover,
        uninstallCutover,
        verifyIndexedDBAuthority,
        startVerificationLoop,
        stopVerificationLoop
    };

    /*
    ========================================================
    Startup cutover
    ========================================================
    Install suppression as early as possible, then allow C2/C3
    to provide persistence + rehydration.
    ========================================================
    */

    installCutover();

    global.setTimeout(
        async () => {
            await run();
            startVerificationLoop();
        },
        1800
    );

})(window);
