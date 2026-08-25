/*
============================================================
RainGuard AI V39
Phase 39A-15F6N4B1B3C6
IndexedDB Full Runtime Rehydration & Identity Coverage Repair Bridge
============================================================

Purpose
-------
- Read ALL authoritative temporal-history identities from IndexedDB.
- Fully rebuild/repair the authoritative runtime temporal-history store.
- Merge persisted history with any newer live runtime observations.
- Prevent identity loss during startup/reload.
- Prevent duplicate identities and duplicate temporal points.
- Verify persisted -> runtime identity coverage.
- Repair missing runtime identities automatically.
- Preserve IndexedDB as the authoritative persistence layer.
- Work with:
    B1B3C2 IndexedDB Persistence
    B1B3C3 IndexedDB Rehydration
    B1B3C4 Persistence Cutover
    B1B3C5 Cross-Reload Integrity Verification

Target path
-----------
frontend/js/rain_arrival_prediction_engine_v32/
indexeddb_full_runtime_rehydration_identity_coverage_repair_bridge_39A15F6N4B1B3C6.js
*/

(function (global) {
    "use strict";

    /*
    ========================================================
    Phase metadata
    ========================================================
    */

    const PHASE =
        "39A-15F6N4B1B3C6";

    const VERSION =
        "39A.15F6N4B1B3C6.0";

    const BUILD =
        "rainguard-v39-indexeddb-full-runtime-rehydration-identity-coverage-repair-bridge";

    /*
    ========================================================
    Upstream dependencies
    ========================================================
    */

    const C2_BRIDGE =
        "RainGuard39A15F6N4B1B3C2BridgeV39";

    const C2_GET_ALL =
        "getRainGuard39A15F6N4B1B3C2IndexedDBTemporalHistory";

    const C3_BRIDGE =
        "RainGuard39A15F6N4B1B3C3BridgeV39";

    const C4_BRIDGE =
        "RainGuard39A15F6N4B1B3C4BridgeV39";

    const C5_BRIDGE =
        "RainGuard39A15F6N4B1B3C5BridgeV39";

    /*
    ========================================================
    Runtime authoritative target
    ========================================================
    */

    const TARGET_STORE =
        "RainGuardN4B1B3CTemporalCoordinateHistoryV39";

    /*
    ========================================================
    Public globals
    ========================================================
    */

    const RESULT_NAME =
        "RainGuard39A15F6N4B1B3C6ResultV39";

    const BRIDGE_NAME =
        "RainGuard39A15F6N4B1B3C6BridgeV39";

    const RUN_NAME =
        "runRainGuard39A15F6N4B1B3C6IndexedDBFullRuntimeRehydrationIdentityCoverageRepairBridgeV39";

    const DIAG_NAME =
        "diagnoseRainGuard39A15F6N4B1B3C6IndexedDBFullRuntimeRehydrationIdentityCoverageRepair";

    const COVERAGE_NAME =
        "getRainGuard39A15F6N4B1B3C6IdentityCoverageReport";

    const REPAIR_NAME =
        "repairRainGuard39A15F6N4B1B3C6MissingRuntimeIdentities";

    /*
    ========================================================
    Configuration
    ========================================================
    */

    const MAX_POINTS_PER_IDENTITY =
        128;

    const AUTO_START_DELAY_MS =
        4500;

    const AUTO_RETRY_MS =
        2500;

    const AUTO_RETRY_LIMIT =
        20;

    const MIN_ACCEPTABLE_COVERAGE_PERCENT =
        99.0;

    /*
    ========================================================
    Runtime state
    ========================================================
    */

    let installed =
        true;

    let running =
        false;

    let fullRuntimeRehydrationCompleted =
        false;

    let identityCoverageVerified =
        false;

    let autoAttemptCount =
        0;

    let retryCount =
        0;

    let retryTimer =
        null;

    let lastResult =
        null;

    let lastCoverageReport =
        null;

    /*
    ========================================================
    Basic helpers
    ========================================================
    */

    function now() {
        return Date.now();
    }

    function normalizeTimestamp(value) {
        if (
            typeof value === "number" &&
            Number.isFinite(value)
        ) {
            return value;
        }

        const parsed =
            Date.parse(value);

        return Number.isFinite(parsed)
            ? parsed
            : 0;
    }

    function normalizeIdentity(record, fallbackKey = "") {
        return String(
            record?.identity ??
            record?.canonicalTrackId ??
            record?.trackId ??
            record?.cellId ??
            fallbackKey ??
            ""
        ).trim();
    }

    function getLatitude(point) {
        return Number(
            point?.latitude ??
            point?.lat ??
            point?.coordinate?.latitude ??
            point?.coordinate?.lat
        );
    }

    function getLongitude(point) {
        return Number(
            point?.longitude ??
            point?.lon ??
            point?.lng ??
            point?.coordinate?.longitude ??
            point?.coordinate?.lon ??
            point?.coordinate?.lng
        );
    }

    /*
    ========================================================
    Temporal point normalization
    ========================================================
    */

    function normalizePoint(point) {
        if (
            !point ||
            typeof point !== "object"
        ) {
            return null;
        }

        const latitude =
            getLatitude(point);

        const longitude =
            getLongitude(point);

        if (
            !Number.isFinite(latitude) ||
            !Number.isFinite(longitude)
        ) {
            return null;
        }

        const timestamp =
            normalizeTimestamp(
                point.timestamp ??
                point.observedAt ??
                point.updatedAt ??
                point.generatedAt ??
                point.capturedAt ??
                now()
            );

        return {
            ...point,

            latitude,
            longitude,

            lat: latitude,
            lon: longitude,

            coordinate: {
                ...(point.coordinate || {}),
                latitude,
                longitude,
                lat: latitude,
                lon: longitude
            },

            timestamp
        };
    }

    function pointKey(point) {
        const normalized =
            normalizePoint(point);

        if (!normalized) {
            return "";
        }

        return [
            normalized.latitude.toFixed(6),
            normalized.longitude.toFixed(6),
            normalized.timestamp
        ].join("|");
    }

    /*
    ========================================================
    History merge
    ========================================================
    */

    function mergeHistory(
        persistedHistory,
        runtimeHistory
    ) {
        const all = [
            ...(
                Array.isArray(persistedHistory)
                    ? persistedHistory
                    : []
            ),
            ...(
                Array.isArray(runtimeHistory)
                    ? runtimeHistory
                    : []
            )
        ]
            .map(normalizePoint)
            .filter(Boolean)
            .sort(
                (a, b) =>
                    a.timestamp -
                    b.timestamp
            );

        const seen =
            new Set();

        const merged =
            [];

        for (const point of all) {
            const key =
                pointKey(point);

            if (
                !key ||
                seen.has(key)
            ) {
                continue;
            }

            seen.add(key);
            merged.push(point);
        }

        return merged.slice(
            -MAX_POINTS_PER_IDENTITY
        );
    }

    /*
    ========================================================
    Persisted record normalization
    ========================================================
    */

    function normalizePersistedRecord(record) {
        if (
            !record ||
            typeof record !== "object"
        ) {
            return null;
        }

        const identity =
            normalizeIdentity(record);

        if (!identity) {
            return null;
        }

        let history =
            Array.isArray(record.history)
                ? record.history
                : [];

        /*
        Support persisted records that may store one direct
        coordinate instead of a history array.
        */

        if (
            history.length === 0 &&
            (
                Number.isFinite(
                    getLatitude(record)
                ) &&
                Number.isFinite(
                    getLongitude(record)
                )
            )
        ) {
            history = [
                record
            ];
        }

        history =
            history
                .map(normalizePoint)
                .filter(Boolean);

        const uniqueCoordinateCount =
            new Set(
                history.map(
                    (point) =>
                        `${point.latitude.toFixed(6)},${point.longitude.toFixed(6)}`
                )
            ).size;

        const firstSeenAt =
            Number(
                record.firstSeenAt
            ) ||
            Number(
                history[0]?.timestamp
            ) ||
            now();

        const lastSeenAt =
            Number(
                record.lastSeenAt
            ) ||
            Number(
                history.at(-1)?.timestamp
            ) ||
            firstSeenAt;

        return {
            ...record,

            identity,

            canonicalTrackId:
                record.canonicalTrackId ??
                identity,

            trackId:
                record.trackId ??
                record.canonicalTrackId ??
                identity,

            firstSeenAt,
            lastSeenAt,

            observationCount:
                Math.max(
                    Number(
                        record.observationCount
                    ) || 0,
                    history.length
                ),

            uniqueCoordinateCount,

            motionReady:
                history.length >= 2 &&
                uniqueCoordinateCount >= 2,

            history
        };
    }

    /*
    ========================================================
    Runtime store helpers
    ========================================================
    */

    function ensureRuntimeStore() {
        const current =
            global[TARGET_STORE];

        if (
            current instanceof Map
        ) {
            return current;
        }

        const map =
            new Map();

        if (
            current &&
            typeof current === "object"
        ) {
            for (
                const [key, value]
                of Object.entries(current)
            ) {
                map.set(
                    key,
                    value
                );
            }
        }

        global[TARGET_STORE] =
            map;

        return map;
    }

    function getRuntimeStore() {
        return ensureRuntimeStore();
    }

    /*
    ========================================================
    Dependency detection
    ========================================================
    */

    function isC2Ready() {
        return (
            typeof global[
                C2_GET_ALL
            ] === "function" ||

            typeof global[
                C2_BRIDGE
            ]?.getAllHistory ===
                "function"
        );
    }

    function isC3Ready() {
        return Boolean(
            global[
                C3_BRIDGE
            ]
        );
    }

    function isC4Ready() {
        return Boolean(
            global[
                C4_BRIDGE
            ]?.installed
        );
    }

    function dependenciesReady() {
        return (
            isC2Ready() &&
            isC3Ready() &&
            isC4Ready()
        );
    }

    /*
    ========================================================
    IndexedDB authoritative reader
    ========================================================
    */

    async function getPersistedRecords() {
        if (
            typeof global[
                C2_GET_ALL
            ] === "function"
        ) {
            const result =
                await global[
                    C2_GET_ALL
                ]();

            return Array.isArray(result)
                ? result
                : [];
        }

        const bridge =
            global[
                C2_BRIDGE
            ];

        if (
            bridge &&
            typeof bridge
                .getAllHistory ===
                "function"
        ) {
            const result =
                await bridge
                    .getAllHistory();

            return Array.isArray(result)
                ? result
                : [];
        }

        throw new Error(
            "INDEXEDDB_AUTHORITATIVE_SOURCE_UNAVAILABLE"
        );
    }

    /*
    ========================================================
    Runtime record merge
    ========================================================
    */

    function mergeIdentityRecord(
        persisted,
        runtime
    ) {
        const mergedHistory =
            mergeHistory(
                persisted?.history,
                runtime?.history
            );

        const uniqueCoordinateCount =
            new Set(
                mergedHistory.map(
                    (point) =>
                        `${point.latitude.toFixed(6)},${point.longitude.toFixed(6)}`
                )
            ).size;

        const identity =
            normalizeIdentity(
                runtime ??
                persisted
            );

        const firstSeenAt =
            Math.min(
                Number(
                    persisted?.firstSeenAt
                ) ||
                Number.MAX_SAFE_INTEGER,

                Number(
                    runtime?.firstSeenAt
                ) ||
                Number.MAX_SAFE_INTEGER,

                Number(
                    mergedHistory[0]?.timestamp
                ) ||
                Number.MAX_SAFE_INTEGER
            );

        const lastSeenAt =
            Math.max(
                Number(
                    persisted?.lastSeenAt
                ) || 0,

                Number(
                    runtime?.lastSeenAt
                ) || 0,

                Number(
                    mergedHistory.at(-1)?.timestamp
                ) || 0
            );

        const sources =
            Array.from(
                new Set([
                    ...(
                        Array.isArray(
                            persisted?.sources
                        )
                            ? persisted.sources
                            : []
                    ),
                    ...(
                        Array.isArray(
                            runtime?.sources
                        )
                            ? runtime.sources
                            : []
                    )
                ])
            ).slice(
                0,
                64
            );

        return {
            ...(persisted || {}),
            ...(runtime || {}),

            identity,

            canonicalTrackId:
                runtime?.canonicalTrackId ??
                persisted?.canonicalTrackId ??
                identity,

            trackId:
                runtime?.trackId ??
                persisted?.trackId ??
                runtime?.canonicalTrackId ??
                persisted?.canonicalTrackId ??
                identity,

            firstSeenAt:
                firstSeenAt ===
                Number.MAX_SAFE_INTEGER
                    ? now()
                    : firstSeenAt,

            lastSeenAt:
                lastSeenAt ||
                now(),

            sources,

            observationCount:
                mergedHistory.length,

            uniqueCoordinateCount,

            motionReady:
                mergedHistory.length >= 2 &&
                uniqueCoordinateCount >= 2,

            history:
                mergedHistory,

            rehydratedFromIndexedDB:
                true,

            fullRuntimeRehydrated:
                true,

            rehydratedAt:
                now(),

            rehydrationPhase:
                PHASE
        };
    }

    /*
    ========================================================
    Coverage analysis
    ========================================================
    */

    function analyzeCoverage(
        persistedRecords,
        runtimeStore
    ) {
        const persistedIdentitySet =
            new Set();

        const runtimeIdentitySet =
            new Set();

        let persistedInvalidIdentityCount =
            0;

        let persistedDuplicateIdentityCount =
            0;

        let runtimeDuplicateIdentityCount =
            0;

        let runtimeRehydratedIdentityCount =
            0;

        let runtimeMotionReadyIdentityCount =
            0;

        let runtimeObservationCount =
            0;

        const persistedSeen =
            new Set();

        for (
            const raw
            of persistedRecords
        ) {
            const identity =
                normalizeIdentity(raw);

            if (!identity) {
                persistedInvalidIdentityCount +=
                    1;
                continue;
            }

            if (
                persistedSeen.has(
                    identity
                )
            ) {
                persistedDuplicateIdentityCount +=
                    1;
            }

            persistedSeen.add(
                identity
            );

            persistedIdentitySet.add(
                identity
            );
        }

        const runtimeSeen =
            new Set();

        for (
            const [key, value]
            of runtimeStore.entries()
        ) {
            const identity =
                normalizeIdentity(
                    value,
                    key
                );

            if (!identity) {
                continue;
            }

            if (
                runtimeSeen.has(
                    identity
                )
            ) {
                runtimeDuplicateIdentityCount +=
                    1;
            }

            runtimeSeen.add(
                identity
            );

            runtimeIdentitySet.add(
                identity
            );

            if (
                value
                    ?.rehydratedFromIndexedDB ===
                true
            ) {
                runtimeRehydratedIdentityCount +=
                    1;
            }

            if (
                value?.motionReady ===
                true
            ) {
                runtimeMotionReadyIdentityCount +=
                    1;
            }

            runtimeObservationCount +=
                Array.isArray(
                    value?.history
                )
                    ? value.history.length
                    : 0;
        }

        const missingInRuntime =
            [];

        const runtimeOnly =
            [];

        for (
            const identity
            of persistedIdentitySet
        ) {
            if (
                !runtimeIdentitySet.has(
                    identity
                )
            ) {
                missingInRuntime.push(
                    identity
                );
            }
        }

        for (
            const identity
            of runtimeIdentitySet
        ) {
            if (
                !persistedIdentitySet.has(
                    identity
                )
            ) {
                runtimeOnly.push(
                    identity
                );
            }
        }

        const persistedCount =
            persistedIdentitySet.size;

        const matchedCount =
            persistedCount -
            missingInRuntime.length;

        const coveragePercent =
            persistedCount > 0
                ? Number(
                    (
                        matchedCount /
                        persistedCount *
                        100
                    ).toFixed(2)
                )
                : 100;

        return {
            persistedUniqueIdentityCount:
                persistedIdentitySet.size,

            runtimeIdentityCount:
                runtimeIdentitySet.size,

            matchedIdentityCount:
                matchedCount,

            missingInRuntimeCount:
                missingInRuntime.length,

            missingInRuntimeSample:
                missingInRuntime.slice(
                    0,
                    30
                ),

            runtimeOnlyIdentityCount:
                runtimeOnly.length,

            runtimeOnlySample:
                runtimeOnly.slice(
                    0,
                    30
                ),

            persistedInvalidIdentityCount,

            persistedDuplicateIdentityCount,

            runtimeDuplicateIdentityCount,

            runtimeRehydratedIdentityCount,

            runtimeMotionReadyIdentityCount,

            runtimeObservationCount,

            coveragePercent
        };
    }

    /*
    ========================================================
    Repair missing runtime identities
    ========================================================
    */

    async function repairMissingRuntimeIdentities() {
        const persistedRecords =
            await getPersistedRecords();

        const runtimeStore =
            getRuntimeStore();

        let repairedIdentityCount =
            0;

        let mergedIdentityCount =
            0;

        let skippedIdentityCount =
            0;

        for (
            const raw
            of persistedRecords
        ) {
            const persisted =
                normalizePersistedRecord(
                    raw
                );

            if (!persisted) {
                skippedIdentityCount +=
                    1;
                continue;
            }

            const identity =
                persisted.identity;

            const existing =
                runtimeStore.get(
                    identity
                );

            const merged =
                mergeIdentityRecord(
                    persisted,
                    existing
                );

            runtimeStore.set(
                identity,
                merged
            );

            if (existing) {
                mergedIdentityCount +=
                    1;
            } else {
                repairedIdentityCount +=
                    1;
            }
        }

        global[TARGET_STORE] =
            runtimeStore;

        const coverage =
            analyzeCoverage(
                persistedRecords,
                runtimeStore
            );

        return {
            success: true,

            repairedIdentityCount,

            mergedIdentityCount,

            skippedIdentityCount,

            ...coverage
        };
    }

    /*
    ========================================================
    Full runtime rehydration
    ========================================================
    */

    async function run() {
        if (running) {
            return (
                lastResult ??
                global[
                    RESULT_NAME
                ] ??
                {
                    success: false,
                    phase: PHASE,
                    status:
                        "ALREADY_RUNNING"
                }
            );
        }

        running =
            true;

        const startedAt =
            now();

        try {
            if (
                !isC2Ready()
            ) {
                throw new Error(
                    "B1B3C2_INDEXEDDB_SOURCE_NOT_READY"
                );
            }

            const persistedRecords =
                await getPersistedRecords();

            const runtimeStore =
                getRuntimeStore();

            const runtimeIdentityCountBefore =
                runtimeStore.size;

            let persistedRecordCount =
                persistedRecords.length;

            let normalizedPersistedIdentityCount =
                0;

            let repairedIdentityCount =
                0;

            let mergedIdentityCount =
                0;

            let skippedIdentityCount =
                0;

            let restoredObservationCount =
                0;

            /*
            ------------------------------------------------
            Core full rehydration
            ------------------------------------------------
            */

            for (
                const raw
                of persistedRecords
            ) {
                const persisted =
                    normalizePersistedRecord(
                        raw
                    );

                if (!persisted) {
                    skippedIdentityCount +=
                        1;
                    continue;
                }

                normalizedPersistedIdentityCount +=
                    1;

                const identity =
                    persisted.identity;

                const existing =
                    runtimeStore.get(
                        identity
                    );

                const merged =
                    mergeIdentityRecord(
                        persisted,
                        existing
                    );

                runtimeStore.set(
                    identity,
                    merged
                );

                restoredObservationCount +=
                    merged.history.length;

                if (existing) {
                    mergedIdentityCount +=
                        1;
                } else {
                    repairedIdentityCount +=
                        1;
                }
            }

            /*
            ------------------------------------------------
            Publish repaired runtime store
            ------------------------------------------------
            */

            global[TARGET_STORE] =
                runtimeStore;

            /*
            ------------------------------------------------
            First coverage pass
            ------------------------------------------------
            */

            let coverage =
                analyzeCoverage(
                    persistedRecords,
                    runtimeStore
                );

            /*
            ------------------------------------------------
            Final repair pass if anything still missing
            ------------------------------------------------
            */

            let secondPassRepairApplied =
                false;

            if (
                coverage
                    .missingInRuntimeCount >
                0
            ) {
                secondPassRepairApplied =
                    true;

                await repairMissingRuntimeIdentities();

                coverage =
                    analyzeCoverage(
                        persistedRecords,
                        runtimeStore
                    );
            }

            identityCoverageVerified =
                Boolean(
                    coverage
                        .coveragePercent >=
                    MIN_ACCEPTABLE_COVERAGE_PERCENT &&

                    coverage
                        .missingInRuntimeCount ===
                    0 &&

                    coverage
                        .runtimeDuplicateIdentityCount ===
                    0
                );

            fullRuntimeRehydrationCompleted =
                Boolean(
                    persistedRecordCount >
                    0 &&

                    coverage
                        .runtimeIdentityCount >
                    0 &&

                    identityCoverageVerified
                );

            const success =
                fullRuntimeRehydrationCompleted &&
                identityCoverageVerified;

            const status =
                success
                    ? "INDEXEDDB_FULL_RUNTIME_REHYDRATION_COVERAGE_VERIFIED"
                    : "INDEXEDDB_FULL_RUNTIME_REHYDRATION_COVERAGE_PARTIAL";

            const result = {
                success,

                phase:
                    PHASE,

                version:
                    VERSION,

                build:
                    BUILD,

                status,

                generatedAt:
                    now(),

                durationMs:
                    now() -
                    startedAt,

                indexedDBAuthoritative:
                    true,

                c2Available:
                    isC2Ready(),

                c3Available:
                    isC3Ready(),

                c4CutoverActive:
                    isC4Ready(),

                c5Available:
                    Boolean(
                        global[
                            C5_BRIDGE
                        ]
                    ),

                persistedRecordCount,

                normalizedPersistedIdentityCount,

                runtimeIdentityCountBefore,

                runtimeIdentityCountAfter:
                    runtimeStore.size,

                repairedIdentityCount,

                mergedIdentityCount,

                skippedIdentityCount,

                restoredObservationCount,

                secondPassRepairApplied,

                fullRuntimeRehydrationCompleted,

                identityCoverageVerified,

                minimumAcceptableCoveragePercent:
                    MIN_ACCEPTABLE_COVERAGE_PERCENT,

                ...coverage
            };

            lastResult =
                result;

            lastCoverageReport =
                coverage;

            global[
                RESULT_NAME
            ] =
                result;

            console.log(
                `[RainGuard][${PHASE}] Full runtime rehydration/coverage repair result:`,
                result
            );

            return result;

        } catch (error) {
            const result = {
                success:
                    false,

                phase:
                    PHASE,

                version:
                    VERSION,

                build:
                    BUILD,

                status:
                    "INDEXEDDB_FULL_RUNTIME_REHYDRATION_COVERAGE_REPAIR_FAILED",

                generatedAt:
                    now(),

                durationMs:
                    now() -
                    startedAt,

                indexedDBAuthoritative:
                    true,

                error:
                    String(
                        error?.stack ||
                        error?.message ||
                        error
                    )
            };

            lastResult =
                result;

            global[
                RESULT_NAME
            ] =
                result;

            console.error(
                `[RainGuard][${PHASE}]`,
                error
            );

            return result;

        } finally {
            running =
                false;
        }
    }

    /*
    ========================================================
    Coverage report
    ========================================================
    */

    async function getIdentityCoverageReport() {
        const persistedRecords =
            await getPersistedRecords();

        const runtimeStore =
            getRuntimeStore();

        const report =
            analyzeCoverage(
                persistedRecords,
                runtimeStore
            );

        lastCoverageReport =
            report;

        console.log(
            `[RainGuard][${PHASE}] Identity coverage report:`,
            report
        );

        return report;
    }

    /*
    ========================================================
    Diagnostics
    ========================================================
    */

    async function diagnose() {
        let coverage =
            null;

        try {
            coverage =
                await getIdentityCoverageReport();
        } catch (_) {
            coverage =
                null;
        }

        const result = {
            success:
                Boolean(
                    fullRuntimeRehydrationCompleted &&
                    identityCoverageVerified
                ),

            phase:
                PHASE,

            version:
                VERSION,

            build:
                BUILD,

            installed,

            running,

            fullRuntimeRehydrationCompleted,

            identityCoverageVerified,

            autoAttemptCount,

            retryCount,

            dependenciesReady:
                dependenciesReady(),

            c2Available:
                isC2Ready(),

            c3Available:
                isC3Ready(),

            c3AutoRehydrationCompleted:
                Boolean(
                    global[
                        C3_BRIDGE
                    ]?.autoRehydrationCompleted
                ),

            c4CutoverActive:
                isC4Ready(),

            c5Available:
                Boolean(
                    global[
                        C5_BRIDGE
                    ]
                ),

            targetStoreAvailable:
                global[
                    TARGET_STORE
                ] instanceof Map,

            targetStoreName:
                TARGET_STORE,

            runtimeStoreSize:
                global[
                    TARGET_STORE
                ] instanceof Map
                    ? global[
                        TARGET_STORE
                    ].size
                    : 0,

            coverage,

            lastResult:
                lastResult ??
                global[
                    RESULT_NAME
                ] ??
                null
        };

        console.log(
            `[RainGuard][${PHASE}] Diagnostics:`,
            result
        );

        return result;
    }

    /*
    ========================================================
    Auto startup repair
    ========================================================
    */

    function scheduleAutoRepair(
        options = {}
    ) {
        if (
            fullRuntimeRehydrationCompleted &&
            identityCoverageVerified
        ) {
            return false;
        }

        if (
            retryTimer
        ) {
            return false;
        }

        const delayMs =
            Number.isFinite(
                options.delayMs
            )
                ? Math.max(
                    0,
                    options.delayMs
                )
                : AUTO_START_DELAY_MS;

        const reason =
            options.reason ??
            "startup";

        const attempt =
            async () => {

            retryTimer =
                null;

            if (
                fullRuntimeRehydrationCompleted &&
                identityCoverageVerified
            ) {
                return;
            }

            autoAttemptCount +=
                1;

            console.log(
                `[RainGuard][${PHASE}] Auto full-runtime repair attempt`,
                {
                    attempt:
                        autoAttemptCount,

                    retryCount,

                    reason,

                    dependenciesReady:
                        dependenciesReady(),

                    c2Ready:
                        isC2Ready(),

                    c3Ready:
                        isC3Ready(),

                    c4Ready:
                        isC4Ready()
                }
            );

            if (
                !dependenciesReady()
            ) {
                retryCount +=
                    1;

                if (
                    retryCount <
                    AUTO_RETRY_LIMIT
                ) {
                    retryTimer =
                        global.setTimeout(
                            attempt,
                            AUTO_RETRY_MS
                        );
                }

                return;
            }

            const result =
                await run();

            if (
                result?.success ===
                true &&

                result
                    ?.identityCoverageVerified ===
                true &&

                result
                    ?.missingInRuntimeCount ===
                0
            ) {
                console.log(
                    `[RainGuard][${PHASE}] AUTO FULL RUNTIME REHYDRATION COMPLETED`,
                    {
                        persistedUniqueIdentityCount:
                            result
                                .persistedUniqueIdentityCount,

                        runtimeIdentityCount:
                            result
                                .runtimeIdentityCount,

                        runtimeRehydratedIdentityCount:
                            result
                                .runtimeRehydratedIdentityCount,

                        coveragePercent:
                            result
                                .coveragePercent,

                        missingInRuntimeCount:
                            result
                                .missingInRuntimeCount,

                        repairedIdentityCount:
                            result
                                .repairedIdentityCount
                    }
                );

                return;
            }

            retryCount +=
                1;

            if (
                retryCount <
                AUTO_RETRY_LIMIT
            ) {
                retryTimer =
                    global.setTimeout(
                        attempt,
                        AUTO_RETRY_MS
                    );

                return;
            }

            console.warn(
                `[RainGuard][${PHASE}] Auto repair retry limit reached`,
                {
                    retryCount,

                    autoAttemptCount,

                    lastResult
                }
            );
        };

        retryTimer =
            global.setTimeout(
                attempt,
                delayMs
            );

        return true;
    }

    /*
    ========================================================
    Manual restart
    ========================================================
    */

    function restartAutoRepair() {
        if (
            retryTimer
        ) {
            global.clearTimeout(
                retryTimer
            );

            retryTimer =
                null;
        }

        retryCount =
            0;

        autoAttemptCount =
            0;

        fullRuntimeRehydrationCompleted =
            false;

        identityCoverageVerified =
            false;

        return scheduleAutoRepair({
            reason:
                "manual-restart",

            delayMs:
                250
        });
    }

    /*
    ========================================================
    Public exports
    ========================================================
    */

    global[
        RUN_NAME
    ] =
        run;

    global[
        DIAG_NAME
    ] =
        diagnose;

    global[
        COVERAGE_NAME
    ] =
        getIdentityCoverageReport;

    global[
        REPAIR_NAME
    ] =
        repairMissingRuntimeIdentities;

    global[
        BRIDGE_NAME
    ] = {
        phase:
            PHASE,

        version:
            VERSION,

        build:
            BUILD,

        targetStoreName:
            TARGET_STORE,

        minimumAcceptableCoveragePercent:
            MIN_ACCEPTABLE_COVERAGE_PERCENT,

        autoRetryMs:
            AUTO_RETRY_MS,

        autoRetryLimit:
            AUTO_RETRY_LIMIT,

        get installed() {
            return installed;
        },

        get running() {
            return running;
        },

        get fullRuntimeRehydrationCompleted() {
            return fullRuntimeRehydrationCompleted;
        },

        get identityCoverageVerified() {
            return identityCoverageVerified;
        },

        get autoAttemptCount() {
            return autoAttemptCount;
        },

        get retryCount() {
            return retryCount;
        },

        get dependenciesReady() {
            return dependenciesReady();
        },

        get lastResult() {
            return lastResult;
        },

        get lastCoverageReport() {
            return lastCoverageReport;
        },

        run,

        diagnose,

        getIdentityCoverageReport,

        repairMissingRuntimeIdentities,

        scheduleAutoRepair,

        restartAutoRepair
    };

    /*
    ========================================================
    Startup sequence

    C6 intentionally waits until:
      C2 IndexedDB source is ready
      C3 startup rehydration has loaded
      C4 IndexedDB cutover is active

    It then repairs all missing persisted identities.
    ========================================================
    */

    scheduleAutoRepair({
        reason:
            "script-load",

        delayMs:
            AUTO_START_DELAY_MS
    });

    /*
    ========================================================
    DOMContentLoaded fallback
    ========================================================
    */

    if (
        document.readyState ===
        "loading"
    ) {
        document.addEventListener(
            "DOMContentLoaded",

            () => {
                if (
                    !fullRuntimeRehydrationCompleted &&
                    !retryTimer
                ) {
                    scheduleAutoRepair({
                        reason:
                            "dom-content-loaded",

                        delayMs:
                            1200
                    });
                }
            },

            {
                once:
                    true
            }
        );
    }

    /*
    ========================================================
    Window load fallback
    ========================================================
    */

    global.addEventListener(
        "load",

        () => {
            if (
                !fullRuntimeRehydrationCompleted &&
                !retryTimer
            ) {
                scheduleAutoRepair({
                    reason:
                        "window-load",

                    delayMs:
                        1500
                });
            }
        },

        {
            once:
                true
        }
    );

    /*
    ========================================================
    Late dependency recovery
    ========================================================
    */

    global.setTimeout(
        () => {
            if (
                !fullRuntimeRehydrationCompleted &&
                !retryTimer
            ) {
                scheduleAutoRepair({
                    reason:
                        "late-dependency-recovery",

                    delayMs:
                        500
                });
            }
        },

        10000
    );

})(window);
