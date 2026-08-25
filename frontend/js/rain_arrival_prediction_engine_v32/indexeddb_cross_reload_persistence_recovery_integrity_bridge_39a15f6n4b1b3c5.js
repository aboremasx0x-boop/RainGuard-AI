/*
============================================================
RainGuard AI V39
Phase 39A-15F6N4B1B3C5
IndexedDB Cross-Reload Persistence & Recovery Integrity Bridge
============================================================

Purpose
-------
- Verify that IndexedDB temporal history survives page reloads.
- Verify that B1B3C3 rehydrates persisted identities back into runtime.
- Compare persisted vs runtime identity coverage after reload.
- Detect missing identities, duplicate identities, empty histories,
  and stale/invalid recovered records.
- Publish an integrity snapshot before reload and compare it after reload.
- Keep IndexedDB authoritative and avoid restoring heavy localStorage history.
- Remain compatible with:
    Phase 39A-15F6N4B1B3C2
    Phase 39A-15F6N4B1B3C3
    Phase 39A-15F6N4B1B3C4

Target path
-----------
frontend/js/rain_arrival_prediction_engine_v32/
indexeddb_cross_reload_persistence_recovery_integrity_bridge_39a15f6n4b1b3c5.js
*/

(function (global) {
    "use strict";

    const PHASE = "39A-15F6N4B1B3C5";
    const VERSION = "39A.15F6N4B1B3C5.0";
    const BUILD =
        "rainguard-v39-indexeddb-cross-reload-persistence-recovery-integrity-bridge";

    const C2_GET_ALL =
        "getRainGuard39A15F6N4B1B3C2IndexedDBTemporalHistory";

    const C2_DIAG =
        "diagnoseRainGuard39A15F6N4B1B3C2IndexedDBTemporalHistory";

    const C3_BRIDGE =
        "RainGuard39A15F6N4B1B3C3BridgeV39";

    const C3_DIAG =
        "diagnoseRainGuard39A15F6N4B1B3C3IndexedDBAuthoritativeTemporalHistoryRehydration";

    const C4_BRIDGE =
        "RainGuard39A15F6N4B1B3C4BridgeV39";

    const RUNTIME_STORE =
        "RainGuardN4B1B3CTemporalCoordinateHistoryV39";

    const RESULT_NAME =
        "RainGuard39A15F6N4B1B3C5ResultV39";

    const BRIDGE_NAME =
        "RainGuard39A15F6N4B1B3C5BridgeV39";

    const RUN_NAME =
        "runRainGuard39A15F6N4B1B3C5IndexedDBCrossReloadPersistenceRecoveryIntegrityBridge";

    const DIAG_NAME =
        "diagnoseRainGuard39A15F6N4B1B3C5IndexedDBCrossReloadPersistenceRecoveryIntegrity";

    const SNAPSHOT_NAME =
        "captureRainGuard39A15F6N4B1B3C5PreReloadIntegritySnapshot";

    const SNAPSHOT_KEY =
        "RainGuard:39A15F6N4B1B3C5:CrossReloadIntegritySnapshot:v1";

    const MAX_SAMPLE = 25;

    let running = false;
    let installed = true;
    let lastSnapshot = null;
    let lastResult = null;

    function now() {
        return Date.now();
    }

    function safeJsonParse(value, fallback = null) {
        try {
            return JSON.parse(value);
        } catch (_) {
            return fallback;
        }
    }

    function normalizeIdentity(record) {
        return String(
            record?.identity ??
            record?.canonicalTrackId ??
            record?.trackId ??
            record?.cellId ??
            ""
        ).trim();
    }

    function getHistoryArray(record) {
        return Array.isArray(record?.history)
            ? record.history
            : [];
    }

    function getRuntimeEntries() {
        const store = global[RUNTIME_STORE];

        if (store instanceof Map) {
            return Array.from(store.entries()).map(
                ([key, value]) => ({
                    key,
                    value
                })
            );
        }

        if (store && typeof store === "object") {
            return Object.entries(store).map(
                ([key, value]) => ({
                    key,
                    value
                })
            );
        }

        return [];
    }

    async function getPersistedRecords() {
        if (typeof global[C2_GET_ALL] !== "function") {
            throw new Error(
                "B1B3C2_INDEXEDDB_GETTER_UNAVAILABLE"
            );
        }

        const records =
            await global[C2_GET_ALL]();

        if (!Array.isArray(records)) {
            throw new Error(
                "B1B3C2_INDEXEDDB_RECORDS_INVALID"
            );
        }

        return records;
    }

    function analyzePersistedRecords(records) {
        const identities = new Set();

        let duplicateIdentityCount = 0;
        let emptyHistoryCount = 0;
        let invalidIdentityCount = 0;
        let totalObservationCount = 0;

        const duplicateSample = [];
        const emptyHistorySample = [];
        const invalidIdentitySample = [];

        for (const record of records) {
            const identity =
                normalizeIdentity(record);

            if (!identity) {
                invalidIdentityCount += 1;

                if (
                    invalidIdentitySample.length <
                    MAX_SAMPLE
                ) {
                    invalidIdentitySample.push(
                        record
                    );
                }

                continue;
            }

            if (identities.has(identity)) {
                duplicateIdentityCount += 1;

                if (
                    duplicateSample.length <
                    MAX_SAMPLE
                ) {
                    duplicateSample.push(
                        identity
                    );
                }
            } else {
                identities.add(identity);
            }

            const history =
                getHistoryArray(record);

            totalObservationCount +=
                history.length;

            if (history.length === 0) {
                emptyHistoryCount += 1;

                if (
                    emptyHistorySample.length <
                    MAX_SAMPLE
                ) {
                    emptyHistorySample.push(
                        identity
                    );
                }
            }
        }

        return {
            identities,
            persistedRecordCount:
                records.length,
            persistedUniqueIdentityCount:
                identities.size,
            persistedDuplicateIdentityCount:
                duplicateIdentityCount,
            persistedEmptyHistoryCount:
                emptyHistoryCount,
            persistedInvalidIdentityCount:
                invalidIdentityCount,
            persistedObservationCount:
                totalObservationCount,
            duplicateSample,
            emptyHistorySample,
            invalidIdentitySample
        };
    }

    function analyzeRuntimeStore(entries) {
        const identities = new Set();

        let duplicateIdentityCount = 0;
        let emptyHistoryCount = 0;
        let totalObservationCount = 0;
        let rehydratedFlagCount = 0;
        let motionReadyIdentityCount = 0;

        const duplicateSample = [];
        const emptyHistorySample = [];

        for (const entry of entries) {
            const identity =
                String(
                    entry?.value?.identity ??
                    entry?.value?.canonicalTrackId ??
                    entry?.key ??
                    ""
                ).trim();

            if (!identity) {
                continue;
            }

            if (identities.has(identity)) {
                duplicateIdentityCount += 1;

                if (
                    duplicateSample.length <
                    MAX_SAMPLE
                ) {
                    duplicateSample.push(
                        identity
                    );
                }
            } else {
                identities.add(identity);
            }

            const history =
                getHistoryArray(
                    entry.value
                );

            totalObservationCount +=
                history.length;

            if (history.length === 0) {
                emptyHistoryCount += 1;

                if (
                    emptyHistorySample.length <
                    MAX_SAMPLE
                ) {
                    emptyHistorySample.push(
                        identity
                    );
                }
            }

            if (
                entry?.value
                    ?.rehydratedFromIndexedDB ===
                true
            ) {
                rehydratedFlagCount += 1;
            }

            if (
                entry?.value?.motionReady ===
                true
            ) {
                motionReadyIdentityCount += 1;
            }
        }

        return {
            identities,
            runtimeIdentityCount:
                identities.size,
            runtimeDuplicateIdentityCount:
                duplicateIdentityCount,
            runtimeEmptyHistoryCount:
                emptyHistoryCount,
            runtimeObservationCount:
                totalObservationCount,
            runtimeRehydratedIdentityCount:
                rehydratedFlagCount,
            runtimeMotionReadyIdentityCount:
                motionReadyIdentityCount,
            duplicateSample,
            emptyHistorySample
        };
    }

    function compareIdentityCoverage(
        persistedSet,
        runtimeSet
    ) {
        const missingInRuntime = [];
        const runtimeOnly = [];

        for (const identity of persistedSet) {
            if (!runtimeSet.has(identity)) {
                missingInRuntime.push(
                    identity
                );
            }
        }

        for (const identity of runtimeSet) {
            if (!persistedSet.has(identity)) {
                runtimeOnly.push(
                    identity
                );
            }
        }

        const coveragePercent =
            persistedSet.size > 0
                ? Number(
                    (
                        (
                            persistedSet.size -
                            missingInRuntime.length
                        ) /
                        persistedSet.size *
                        100
                    ).toFixed(2)
                )
                : 100;

        return {
            coveragePercent,
            missingInRuntimeCount:
                missingInRuntime.length,
            missingInRuntimeSample:
                missingInRuntime.slice(
                    0,
                    MAX_SAMPLE
                ),
            runtimeOnlyIdentityCount:
                runtimeOnly.length,
            runtimeOnlySample:
                runtimeOnly.slice(
                    0,
                    MAX_SAMPLE
                )
        };
    }

    function saveSnapshot(snapshot) {
        try {
            global.localStorage?.setItem(
                SNAPSHOT_KEY,
                JSON.stringify(snapshot)
            );

            return true;
        } catch (error) {
            console.warn(
                `[RainGuard][${PHASE}] Failed to save lightweight reload snapshot`,
                error
            );

            return false;
        }
    }

    function loadSnapshot() {
        try {
            const raw =
                global.localStorage?.getItem(
                    SNAPSHOT_KEY
                );

            return raw
                ? safeJsonParse(
                    raw,
                    null
                )
                : null;
        } catch (_) {
            return null;
        }
    }

    async function capturePreReloadSnapshot() {
        const persisted =
            await getPersistedRecords();

        const persistedAnalysis =
            analyzePersistedRecords(
                persisted
            );

        const runtimeAnalysis =
            analyzeRuntimeStore(
                getRuntimeEntries()
            );

        const snapshot = {
            phase: PHASE,
            version: VERSION,
            capturedAt: now(),

            persistedRecordCount:
                persistedAnalysis
                    .persistedRecordCount,

            persistedUniqueIdentityCount:
                persistedAnalysis
                    .persistedUniqueIdentityCount,

            persistedObservationCount:
                persistedAnalysis
                    .persistedObservationCount,

            runtimeIdentityCount:
                runtimeAnalysis
                    .runtimeIdentityCount,

            runtimeObservationCount:
                runtimeAnalysis
                    .runtimeObservationCount
        };

        snapshot.persisted =
            saveSnapshot(snapshot);

        lastSnapshot =
            snapshot;

        console.log(
            `[RainGuard][${PHASE}] PRE-RELOAD SNAPSHOT CAPTURED`,
            snapshot
        );

        return snapshot;
    }

    async function run() {
        if (running) {
            return lastResult ?? {
                success: false,
                phase: PHASE,
                status: "ALREADY_RUNNING"
            };
        }

        running = true;

        const startedAt =
            now();

        try {
            const persistedRecords =
                await getPersistedRecords();

            const persistedAnalysis =
                analyzePersistedRecords(
                    persistedRecords
                );

            const runtimeAnalysis =
                analyzeRuntimeStore(
                    getRuntimeEntries()
                );

            const coverage =
                compareIdentityCoverage(
                    persistedAnalysis.identities,
                    runtimeAnalysis.identities
                );

            let c2Diagnostic = null;
            let c3Diagnostic = null;

            try {
                if (
                    typeof global[C2_DIAG] ===
                    "function"
                ) {
                    c2Diagnostic =
                        await global[C2_DIAG]();
                }
            } catch (_) {}

            try {
                if (
                    typeof global[C3_DIAG] ===
                    "function"
                ) {
                    c3Diagnostic =
                        await global[C3_DIAG]();
                }
            } catch (_) {}

            const previousSnapshot =
                loadSnapshot();

            const reloadPersistenceVerified =
                Boolean(
                    previousSnapshot &&
                    Number(
                        previousSnapshot
                            .persistedUniqueIdentityCount
                    ) > 0 &&
                    persistedAnalysis
                        .persistedUniqueIdentityCount >
                    0
                );

            const recoveryIntegrityVerified =
                Boolean(
                    persistedAnalysis
                        .persistedUniqueIdentityCount >
                    0 &&
                    runtimeAnalysis
                        .runtimeIdentityCount >
                    0 &&
                    coverage
                        .coveragePercent >=
                    99 &&
                    persistedAnalysis
                        .persistedDuplicateIdentityCount ===
                    0 &&
                    persistedAnalysis
                        .persistedInvalidIdentityCount ===
                    0
                );

            const cutoverActive =
                Boolean(
                    global[C4_BRIDGE]
                        ?.installed
                );

            const c3AutoRehydrated =
                Boolean(
                    global[C3_BRIDGE]
                        ?.autoRehydrationCompleted
                );

            const status =
                reloadPersistenceVerified &&
                recoveryIntegrityVerified &&
                cutoverActive &&
                c3AutoRehydrated
                    ? "INDEXEDDB_CROSS_RELOAD_PERSISTENCE_RECOVERY_INTEGRITY_VERIFIED"
                    : (
                        persistedAnalysis
                            .persistedUniqueIdentityCount ===
                        0
                            ? "INDEXEDDB_CROSS_RELOAD_NO_PERSISTED_HISTORY"
                            : "INDEXEDDB_CROSS_RELOAD_INTEGRITY_PARTIAL"
                    );

            const result = {
                success:
                    status ===
                    "INDEXEDDB_CROSS_RELOAD_PERSISTENCE_RECOVERY_INTEGRITY_VERIFIED",

                phase: PHASE,
                version: VERSION,
                build: BUILD,

                status,

                generatedAt: now(),
                durationMs:
                    now() -
                    startedAt,

                indexedDBAuthoritative:
                    true,

                cutoverActive,

                c3AutoRehydrated,

                reloadPersistenceVerified,

                recoveryIntegrityVerified,

                previousSnapshotAvailable:
                    Boolean(
                        previousSnapshot
                    ),

                previousSnapshot,

                persistedRecordCount:
                    persistedAnalysis
                        .persistedRecordCount,

                persistedUniqueIdentityCount:
                    persistedAnalysis
                        .persistedUniqueIdentityCount,

                persistedObservationCount:
                    persistedAnalysis
                        .persistedObservationCount,

                persistedDuplicateIdentityCount:
                    persistedAnalysis
                        .persistedDuplicateIdentityCount,

                persistedEmptyHistoryCount:
                    persistedAnalysis
                        .persistedEmptyHistoryCount,

                persistedInvalidIdentityCount:
                    persistedAnalysis
                        .persistedInvalidIdentityCount,

                runtimeIdentityCount:
                    runtimeAnalysis
                        .runtimeIdentityCount,

                runtimeObservationCount:
                    runtimeAnalysis
                        .runtimeObservationCount,

                runtimeDuplicateIdentityCount:
                    runtimeAnalysis
                        .runtimeDuplicateIdentityCount,

                runtimeEmptyHistoryCount:
                    runtimeAnalysis
                        .runtimeEmptyHistoryCount,

                runtimeRehydratedIdentityCount:
                    runtimeAnalysis
                        .runtimeRehydratedIdentityCount,

                runtimeMotionReadyIdentityCount:
                    runtimeAnalysis
                        .runtimeMotionReadyIdentityCount,

                coveragePercent:
                    coverage
                        .coveragePercent,

                missingInRuntimeCount:
                    coverage
                        .missingInRuntimeCount,

                missingInRuntimeSample:
                    coverage
                        .missingInRuntimeSample,

                runtimeOnlyIdentityCount:
                    coverage
                        .runtimeOnlyIdentityCount,

                runtimeOnlySample:
                    coverage
                        .runtimeOnlySample,

                c2Diagnostic,
                c3Diagnostic
            };

            lastResult =
                result;

            global[RESULT_NAME] =
                result;

            console.log(
                `[RainGuard][${PHASE}] Cross-reload persistence/recovery integrity result:`,
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
                    "INDEXEDDB_CROSS_RELOAD_PERSISTENCE_RECOVERY_INTEGRITY_FAILED",
                generatedAt: now(),
                durationMs:
                    now() -
                    startedAt,
                error:
                    String(
                        error?.stack ||
                        error?.message ||
                        error
                    )
            };

            lastResult =
                result;

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

    async function diagnose() {
        const result =
            await run();

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

    global[SNAPSHOT_NAME] =
        capturePreReloadSnapshot;

    global[BRIDGE_NAME] = {
        phase: PHASE,
        version: VERSION,
        build: BUILD,

        snapshotKey:
            SNAPSHOT_KEY,

        runtimeStoreName:
            RUNTIME_STORE,

        get installed() {
            return installed;
        },

        get running() {
            return running;
        },

        get lastSnapshot() {
            return lastSnapshot;
        },

        get lastResult() {
            return lastResult;
        },

        capturePreReloadSnapshot,
        run,
        diagnose
    };

    /*
    ========================================================
    Startup integrity probe
    ========================================================
    Wait for B1B3C2/B1B3C3/B1B3C4 startup work to settle, then
    evaluate the current reload/recovery state.
    ========================================================
    */

    global.setTimeout(
        () => {
            run();
        },
        5000
    );

})(window);
