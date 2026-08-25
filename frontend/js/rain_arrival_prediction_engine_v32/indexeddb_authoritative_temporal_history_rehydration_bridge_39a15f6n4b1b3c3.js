/*
============================================================
RainGuard AI V39
Phase 39A-15F6N4B1B3C3
IndexedDB Authoritative Temporal History Rehydration Bridge
============================================================

Purpose
-------
- Read authoritative temporal history from IndexedDB on startup.
- Rehydrate the runtime temporal-history store before downstream motion logic runs.
- Merge safely with any live runtime observations already present.
- Preserve newer runtime observations.
- Avoid duplicate points.
- Publish diagnostics and explicit rehydration result globals.
- Remain compatible with:
    Phase 39A-15F6N4B1B3C / C1
    Phase 39A-15F6N4B1B3C2

Target path
-----------
frontend/js/rain_arrival_prediction_engine_v32/
indexeddb_authoritative_temporal_history_rehydration_bridge_39a15f6n4b1b3c3.js
*/

(function (global) {
    "use strict";

    const PHASE = "39A-15F6N4B1B3C3";
    const VERSION = "39A.15F6N4B1B3C3.0";
    const BUILD = "rainguard-v39-indexeddb-authoritative-temporal-history-rehydration-bridge";

    const SOURCE_BRIDGE =
        "RainGuard39A15F6N4B1B3C2BridgeV39";

    const SOURCE_GET_ALL =
        "getRainGuard39A15F6N4B1B3C2IndexedDBTemporalHistory";

    const TARGET_STORE =
        "RainGuardN4B1B3CTemporalCoordinateHistoryV39";

    const RESULT_NAME =
        "RainGuard39A15F6N4B1B3C3ResultV39";

    const BRIDGE_NAME =
        "RainGuard39A15F6N4B1B3C3BridgeV39";

    const RUN_NAME =
        "runRainGuard39A15F6N4B1B3C3IndexedDBAuthoritativeTemporalHistoryRehydrationBridge";

    const DIAG_NAME =
        "diagnoseRainGuard39A15F6N4B1B3C3IndexedDBAuthoritativeTemporalHistoryRehydration";

    const AUTO_RETRY_MS = 2000;
    const AUTO_RETRY_LIMIT = 8;
    const MAX_POINTS_PER_IDENTITY = 96;

    let running = false;
    let installed = false;
    let retryCount = 0;
    let retryTimer = null;

    function now() {
        return Date.now();
    }

    function normalizeTimestamp(value) {
        if (typeof value === "number" && Number.isFinite(value)) {
            return value;
        }

        const parsed = Date.parse(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }

    function pointKey(point) {
        const lat = Number(
            point?.latitude ??
            point?.lat ??
            point?.coordinate?.latitude ??
            point?.coordinate?.lat ??
            0
        );

        const lon = Number(
            point?.longitude ??
            point?.lon ??
            point?.lng ??
            point?.coordinate?.longitude ??
            point?.coordinate?.lon ??
            point?.coordinate?.lng ??
            0
        );

        const timestamp = normalizeTimestamp(
            point?.timestamp ??
            point?.observedAt ??
            point?.updatedAt ??
            point?.generatedAt ??
            0
        );

        return `${lat.toFixed(5)}|${lon.toFixed(5)}|${timestamp}`;
    }

    function normalizePoint(point) {
        if (!point || typeof point !== "object") return null;

        const latitude = Number(
            point.latitude ??
            point.lat ??
            point.coordinate?.latitude ??
            point.coordinate?.lat
        );

        const longitude = Number(
            point.longitude ??
            point.lon ??
            point.lng ??
            point.coordinate?.longitude ??
            point.coordinate?.lon ??
            point.coordinate?.lng
        );

        if (
            !Number.isFinite(latitude) ||
            !Number.isFinite(longitude)
        ) {
            return null;
        }

        const timestamp = normalizeTimestamp(
            point.timestamp ??
            point.observedAt ??
            point.updatedAt ??
            point.generatedAt ??
            now()
        );

        return {
            ...point,
            latitude,
            longitude,
            lat: latitude,
            lon: longitude,
            timestamp
        };
    }

    function mergeHistory(existingHistory, persistedHistory) {
        const all = [
            ...(Array.isArray(persistedHistory) ? persistedHistory : []),
            ...(Array.isArray(existingHistory) ? existingHistory : [])
        ]
            .map(normalizePoint)
            .filter(Boolean)
            .sort((a, b) => a.timestamp - b.timestamp);

        const seen = new Set();
        const merged = [];

        for (const point of all) {
            const key = pointKey(point);

            if (seen.has(key)) continue;

            seen.add(key);
            merged.push(point);
        }

        return merged.slice(-MAX_POINTS_PER_IDENTITY);
    }

    function ensureRuntimeStore() {
        const current = global[TARGET_STORE];

        if (current instanceof Map) {
            return current;
        }

        const map = new Map();

        if (current && typeof current === "object") {
            for (const [key, value] of Object.entries(current)) {
                map.set(key, value);
            }
        }

        global[TARGET_STORE] = map;
        return map;
    }

    function normalizePersistedRecord(record) {
        if (!record || typeof record !== "object") return null;

        const identity = String(
            record.identity ??
            record.canonicalTrackId ??
            record.trackId ??
            record.cellId ??
            ""
        ).trim();

        if (!identity) return null;

        const history = Array.isArray(record.history)
            ? record.history.map(normalizePoint).filter(Boolean)
            : [];

        const firstSeenAt =
            Number(record.firstSeenAt) ||
            Number(history[0]?.timestamp) ||
            now();

        const lastSeenAt =
            Number(record.lastSeenAt) ||
            Number(history.at(-1)?.timestamp) ||
            firstSeenAt;

        return {
            identity,
            canonicalTrackId:
                record.canonicalTrackId ?? identity,
            firstSeenAt,
            lastSeenAt,
            sources: Array.isArray(record.sources)
                ? record.sources
                : [],
            observationCount:
                Number(record.observationCount) ||
                history.length,
            uniqueCoordinateCount:
                Number(record.uniqueCoordinateCount) ||
                new Set(
                    history.map(
                        p => `${p.latitude.toFixed(5)},${p.longitude.toFixed(5)}`
                    )
                ).size,
            motionReady:
                Boolean(record.motionReady),
            history
        };
    }

    function mergeIdentity(existing, persisted) {
        const mergedHistory = mergeHistory(
            existing?.history,
            persisted?.history
        );

        const uniqueCoordinateCount =
            new Set(
                mergedHistory.map(
                    p => `${p.latitude.toFixed(5)},${p.longitude.toFixed(5)}`
                )
            ).size;

        const firstSeenAt =
            Math.min(
                Number(existing?.firstSeenAt) || Number.MAX_SAFE_INTEGER,
                Number(persisted?.firstSeenAt) || Number.MAX_SAFE_INTEGER,
                Number(mergedHistory[0]?.timestamp) || Number.MAX_SAFE_INTEGER
            );

        const lastSeenAt =
            Math.max(
                Number(existing?.lastSeenAt) || 0,
                Number(persisted?.lastSeenAt) || 0,
                Number(mergedHistory.at(-1)?.timestamp) || 0
            );

        const sources =
            Array.from(
                new Set([
                    ...(Array.isArray(persisted?.sources) ? persisted.sources : []),
                    ...(Array.isArray(existing?.sources) ? existing.sources : [])
                ])
            ).slice(0, 32);

        return {
            ...(persisted || {}),
            ...(existing || {}),

            identity:
                existing?.identity ??
                persisted?.identity,

            canonicalTrackId:
                existing?.canonicalTrackId ??
                persisted?.canonicalTrackId ??
                existing?.identity ??
                persisted?.identity,

            firstSeenAt:
                firstSeenAt === Number.MAX_SAFE_INTEGER
                    ? now()
                    : firstSeenAt,

            lastSeenAt:
                lastSeenAt || now(),

            sources,

            observationCount: mergedHistory.length,

            uniqueCoordinateCount,

            motionReady:
                mergedHistory.length >= 2 &&
                uniqueCoordinateCount >= 2,

            history: mergedHistory,

            rehydratedFromIndexedDB: true,
            rehydratedAt: now(),
            rehydrationPhase: PHASE
        };
    }

    async function getPersistedRecords() {
        if (
            typeof global[SOURCE_GET_ALL] === "function"
        ) {
            return await global[SOURCE_GET_ALL]();
        }

        const bridge = global[SOURCE_BRIDGE];

        if (
            bridge &&
            typeof bridge.getAllHistory === "function"
        ) {
            return await bridge.getAllHistory();
        }

        throw new Error(
            "INDEXEDDB_HISTORY_SOURCE_UNAVAILABLE"
        );
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
            const records = await getPersistedRecords();

            if (!Array.isArray(records)) {
                throw new Error(
                    "INDEXEDDB_HISTORY_SOURCE_INVALID"
                );
            }

            const runtimeStore = ensureRuntimeStore();

            let rehydratedIdentityCount = 0;
            let mergedIdentityCount = 0;
            let restoredObservationCount = 0;
            let motionReadyIdentityCount = 0;
            let skippedIdentityCount = 0;

            for (const raw of records) {
                const persisted =
                    normalizePersistedRecord(raw);

                if (!persisted) {
                    skippedIdentityCount += 1;
                    continue;
                }

                const existing =
                    runtimeStore.get(persisted.identity);

                const merged =
                    mergeIdentity(existing, persisted);

                runtimeStore.set(
                    persisted.identity,
                    merged
                );

                rehydratedIdentityCount += 1;

                if (existing) {
                    mergedIdentityCount += 1;
                }

                restoredObservationCount +=
                    merged.history.length;

                if (merged.motionReady) {
                    motionReadyIdentityCount += 1;
                }
            }

            global[TARGET_STORE] = runtimeStore;

            const result = {
                success: true,
                phase: PHASE,
                version: VERSION,
                build: BUILD,

                status:
                    rehydratedIdentityCount > 0
                        ? "INDEXEDDB_AUTHORITATIVE_TEMPORAL_HISTORY_REHYDRATED"
                        : "INDEXEDDB_AUTHORITATIVE_TEMPORAL_HISTORY_EMPTY",

                generatedAt: now(),
                durationMs: now() - startedAt,

                indexedDBSourceAvailable: true,
                targetStorePublished: true,
                targetStoreName: TARGET_STORE,

                persistedRecordCount: records.length,
                rehydratedIdentityCount,
                mergedIdentityCount,
                skippedIdentityCount,
                restoredObservationCount,
                runtimeIdentityCount: runtimeStore.size,
                motionReadyIdentityCount
            };

            global[RESULT_NAME] = result;

            installed = true;

            console.log(
                "[RainGuard][39A-15F6N4B1B3C3] IndexedDB authoritative temporal history rehydration result:",
                result
            );

            return result;
        } catch (error) {
            const result = {
                success: false,
                phase: PHASE,
                version: VERSION,
                build: BUILD,
                status: "INDEXEDDB_AUTHORITATIVE_TEMPORAL_HISTORY_REHYDRATION_FAILED",
                generatedAt: now(),
                durationMs: now() - startedAt,
                error: String(
                    error?.stack ||
                    error?.message ||
                    error
                )
            };

            global[RESULT_NAME] = result;

            console.warn(
                "[RainGuard][39A-15F6N4B1B3C3]",
                error
            );

            return result;
        } finally {
            running = false;
        }
    }

    async function diagnose() {
        const target = global[TARGET_STORE];

        let runtimeIdentityCount = 0;
        let runtimeMotionReadyIdentityCount = 0;
        let runtimeObservationCount = 0;

        if (target instanceof Map) {
            runtimeIdentityCount = target.size;

            for (const value of target.values()) {
                if (value?.motionReady) {
                    runtimeMotionReadyIdentityCount += 1;
                }

                runtimeObservationCount +=
                    Array.isArray(value?.history)
                        ? value.history.length
                        : 0;
            }
        }

        let persistedIdentityCount = 0;

        try {
            const persisted = await getPersistedRecords();

            persistedIdentityCount =
                Array.isArray(persisted)
                    ? persisted.length
                    : 0;
        } catch (_) {}

        const result = {
            success: true,
            phase: PHASE,
            version: VERSION,
            build: BUILD,

            installed,
            running,

            sourceBridgeAvailable:
                Boolean(global[SOURCE_BRIDGE]),

            sourceGetterAvailable:
                typeof global[SOURCE_GET_ALL] === "function",

            targetStoreAvailable:
                target instanceof Map,

            targetStoreName: TARGET_STORE,

            persistedIdentityCount,
            runtimeIdentityCount,
            runtimeObservationCount,
            runtimeMotionReadyIdentityCount,

            lastResult:
                global[RESULT_NAME] ?? null
        };

        console.log(
            "[RainGuard][39A-15F6N4B1B3C3] Diagnostics:",
            result
        );

        return result;
    }

    function scheduleAutoRehydration() {
        if (retryTimer) return;

        const attempt = async () => {
            retryTimer = null;

            const sourceReady =
                typeof global[SOURCE_GET_ALL] === "function" ||
                Boolean(
                    global[SOURCE_BRIDGE]?.getAllHistory
                );

            if (sourceReady) {
                const result = await run();

                if (result?.success) {
                    return;
                }
            }

            retryCount += 1;

            if (retryCount < AUTO_RETRY_LIMIT) {
                retryTimer =
                    global.setTimeout(
                        attempt,
                        AUTO_RETRY_MS
                    );
            } else {
                console.warn(
                    "[RainGuard][39A-15F6N4B1B3C3] Auto rehydration retry limit reached"
                );
            }
        };

        retryTimer =
            global.setTimeout(
                attempt,
                1500
            );
    }

    global[RUN_NAME] = run;
    global[DIAG_NAME] = diagnose;

    global[BRIDGE_NAME] = {
        phase: PHASE,
        version: VERSION,
        build: BUILD,

        sourceBridgeName: SOURCE_BRIDGE,
        sourceGetterName: SOURCE_GET_ALL,
        targetStoreName: TARGET_STORE,

        get installed() {
            return installed;
        },

        get running() {
            return running;
        },

        get retryCount() {
            return retryCount;
        },

        run,
        diagnose,
        scheduleAutoRehydration
    };

    scheduleAutoRehydration();

})(window);
