/*
============================================================
RainGuard AI V39
Phase 39A-15F6N4B1B3C2
IndexedDB Persistent Temporal History Storage Bridge
============================================================

Purpose
-------
- Move large cross-cycle temporal coordinate history away from localStorage.
- Persist full history in IndexedDB.
- Keep only small metadata/status in localStorage.
- Recover existing runtime history from:
    window.RainGuardN4B1B3CTemporalCoordinateHistoryV39
- Provide getAll/getByIdentity/clear/diagnostics APIs.
- Preserve compatibility with Phase 39A-15F6N4B1B3C/C1.

Target path
-----------
frontend/js/rain_arrival_prediction_engine_v32/
indexeddb_persistent_temporal_history_storage_bridge_39a15f6n4b1b3c2.js
*/

(function (global) {
    "use strict";

    const PHASE = "39A-15F6N4B1B3C2";
    const VERSION = "39A.15F6N4B1B3C2.0";
    const BUILD = "rainguard-v39-indexeddb-persistent-temporal-history-storage-bridge";

    const DB_NAME = "RainGuardTemporalHistoryV39";
    const DB_VERSION = 1;

    const STORE_HISTORY = "temporalHistory";
    const STORE_META = "metadata";

    const META_KEY = "RainGuard:39A15F6N4B1B3C2:IndexedDBMeta:v1";

    const SOURCE_STORE_NAME = "RainGuardN4B1B3CTemporalCoordinateHistoryV39";
    const RESULT_NAME = "RainGuard39A15F6N4B1B3C2ResultV39";
    const BRIDGE_NAME = "RainGuard39A15F6N4B1B3C2BridgeV39";

    const RUN_NAME =
        "runRainGuard39A15F6N4B1B3C2IndexedDBPersistentTemporalHistoryStorageBridge";

    const GET_ALL_NAME =
        "getRainGuard39A15F6N4B1B3C2IndexedDBTemporalHistory";

    const GET_ONE_NAME =
        "getRainGuard39A15F6N4B1B3C2IndexedDBTemporalHistoryForIdentity";

    const CLEAR_NAME =
        "clearRainGuard39A15F6N4B1B3C2IndexedDBTemporalHistory";

    const DIAG_NAME =
        "diagnoseRainGuard39A15F6N4B1B3C2IndexedDBTemporalHistory";

    const AUTO_INTERVAL_MS = 20000;
    const MAX_POINTS_PER_IDENTITY = 96;
    const MAX_IDENTITIES_PER_WRITE = 5000;

    let dbPromise = null;
    let timer = null;
    let running = false;

    function now() {
        return Date.now();
    }

    function localMetaWrite(value) {
        try {
            global.localStorage?.setItem(META_KEY, JSON.stringify(value));
            return true;
        } catch (_) {
            return false;
        }
    }

    function openDatabase() {
        if (dbPromise) return dbPromise;

        dbPromise = new Promise((resolve, reject) => {
            if (!("indexedDB" in global)) {
                reject(new Error("INDEXEDDB_UNAVAILABLE"));
                return;
            }

            const request = global.indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                if (!db.objectStoreNames.contains(STORE_HISTORY)) {
                    const store = db.createObjectStore(
                        STORE_HISTORY,
                        { keyPath: "identity" }
                    );

                    store.createIndex(
                        "lastSeenAt",
                        "lastSeenAt",
                        { unique: false }
                    );

                    store.createIndex(
                        "motionReady",
                        "motionReady",
                        { unique: false }
                    );
                }

                if (!db.objectStoreNames.contains(STORE_META)) {
                    db.createObjectStore(
                        STORE_META,
                        { keyPath: "key" }
                    );
                }
            };

            request.onsuccess = () => {
                const db = request.result;

                db.onversionchange = () => {
                    try { db.close(); } catch (_) {}
                    dbPromise = null;
                };

                resolve(db);
            };

            request.onerror = () => {
                reject(request.error || new Error("INDEXEDDB_OPEN_FAILED"));
            };

            request.onblocked = () => {
                console.warn(
                    "[RainGuard][39A-15F6N4B1B3C2] IndexedDB open blocked"
                );
            };
        });

        return dbPromise;
    }

    function normalizeHistoryItem(identity, value) {
        if (!identity || !value || typeof value !== "object") return null;

        const history = Array.isArray(value.history)
            ? value.history
                .filter(Boolean)
                .slice(-MAX_POINTS_PER_IDENTITY)
            : [];

        const uniqueCoordinates = new Set(
            history.map((point) => {
                const lat =
                    Number(point?.latitude ?? point?.lat ?? 0);
                const lon =
                    Number(point?.longitude ?? point?.lon ?? point?.lng ?? 0);

                return `${lat.toFixed(5)},${lon.toFixed(5)}`;
            })
        );

        return {
            identity: String(identity),
            canonicalTrackId:
                value.canonicalTrackId ??
                value.identity ??
                identity,

            firstSeenAt:
                Number(value.firstSeenAt) ||
                Number(history[0]?.timestamp) ||
                now(),

            lastSeenAt:
                Number(value.lastSeenAt) ||
                Number(history.at(-1)?.timestamp) ||
                now(),

            sources: Array.isArray(value.sources)
                ? value.sources.slice(0, 32)
                : [],

            observationCount:
                Number(value.observationCount) ||
                history.length,

            uniqueCoordinateCount:
                Number(value.uniqueCoordinateCount) ||
                uniqueCoordinates.size,

            motionReady:
                Boolean(value.motionReady) ||
                (
                    history.length >= 2 &&
                    uniqueCoordinates.size >= 2
                ),

            history,

            persistedAt: now(),
            phase: PHASE,
            version: VERSION
        };
    }

    function sourceEntries() {
        const source = global[SOURCE_STORE_NAME];

        if (!source) return [];

        if (source instanceof Map) {
            return Array.from(source.entries());
        }

        if (Array.isArray(source)) {
            return source
                .map((value, index) => {
                    const identity =
                        value?.identity ??
                        value?.canonicalTrackId ??
                        value?.trackId ??
                        value?.cellId ??
                        index;

                    return [identity, value];
                });
        }

        if (typeof source === "object") {
            return Object.entries(source);
        }

        return [];
    }

    async function putMany(records) {
        if (!records.length) return 0;

        const db = await openDatabase();

        return new Promise((resolve, reject) => {
            const tx = db.transaction(
                [STORE_HISTORY],
                "readwrite"
            );

            const store = tx.objectStore(STORE_HISTORY);

            let written = 0;

            for (const record of records) {
                store.put(record);
                written += 1;
            }

            tx.oncomplete = () => resolve(written);

            tx.onerror = () =>
                reject(tx.error || new Error("INDEXEDDB_WRITE_FAILED"));

            tx.onabort = () =>
                reject(tx.error || new Error("INDEXEDDB_WRITE_ABORTED"));
        });
    }

    async function putMetadata(meta) {
        const db = await openDatabase();

        return new Promise((resolve, reject) => {
            const tx = db.transaction(
                [STORE_META],
                "readwrite"
            );

            tx.objectStore(STORE_META).put({
                key: "latest",
                ...meta
            });

            tx.oncomplete = () => resolve(true);

            tx.onerror = () =>
                reject(tx.error || new Error("INDEXEDDB_META_WRITE_FAILED"));

            tx.onabort = () =>
                reject(tx.error || new Error("INDEXEDDB_META_WRITE_ABORTED"));
        });
    }

    async function getAllHistory() {
        const db = await openDatabase();

        return new Promise((resolve, reject) => {
            const tx = db.transaction(
                [STORE_HISTORY],
                "readonly"
            );

            const request =
                tx.objectStore(STORE_HISTORY).getAll();

            request.onsuccess = () => resolve(request.result || []);

            request.onerror = () =>
                reject(request.error || new Error("INDEXEDDB_GETALL_FAILED"));
        });
    }

    async function getHistoryForIdentity(identity) {
        const key = String(identity ?? "").trim();

        if (!key) return null;

        const db = await openDatabase();

        return new Promise((resolve, reject) => {
            const tx = db.transaction(
                [STORE_HISTORY],
                "readonly"
            );

            const request =
                tx.objectStore(STORE_HISTORY).get(key);

            request.onsuccess = () =>
                resolve(request.result || null);

            request.onerror = () =>
                reject(request.error || new Error("INDEXEDDB_GET_FAILED"));
        });
    }

    async function countHistory() {
        const db = await openDatabase();

        return new Promise((resolve, reject) => {
            const tx = db.transaction(
                [STORE_HISTORY],
                "readonly"
            );

            const request =
                tx.objectStore(STORE_HISTORY).count();

            request.onsuccess = () =>
                resolve(request.result || 0);

            request.onerror = () =>
                reject(request.error || new Error("INDEXEDDB_COUNT_FAILED"));
        });
    }

    async function clearHistory() {
        const db = await openDatabase();

        return new Promise((resolve, reject) => {
            const tx = db.transaction(
                [STORE_HISTORY, STORE_META],
                "readwrite"
            );

            tx.objectStore(STORE_HISTORY).clear();
            tx.objectStore(STORE_META).clear();

            tx.oncomplete = () => {
                try {
                    global.localStorage?.removeItem(META_KEY);
                } catch (_) {}

                const result = {
                    success: true,
                    phase: PHASE,
                    version: VERSION,
                    build: BUILD,
                    status: "INDEXEDDB_TEMPORAL_HISTORY_CLEARED",
                    generatedAt: now()
                };

                global[RESULT_NAME] = result;
                resolve(result);
            };

            tx.onerror = () =>
                reject(tx.error || new Error("INDEXEDDB_CLEAR_FAILED"));

            tx.onabort = () =>
                reject(tx.error || new Error("INDEXEDDB_CLEAR_ABORTED"));
        });
    }

    async function runCycle() {
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
            const entries = sourceEntries();

            const records = entries
                .slice(0, MAX_IDENTITIES_PER_WRITE)
                .map(([identity, value]) =>
                    normalizeHistoryItem(identity, value)
                )
                .filter(Boolean);

            const written = await putMany(records);
            const persistedIdentityCount = await countHistory();

            const motionReadyIdentityCount =
                records.filter((x) => x.motionReady).length;

            const observationCount =
                records.reduce(
                    (sum, x) =>
                        sum + (x.observationCount || 0),
                    0
                );

            const metadata = {
                phase: PHASE,
                version: VERSION,
                build: BUILD,
                generatedAt: now(),
                sourceStoreName: SOURCE_STORE_NAME,
                sourceIdentityCount: entries.length,
                writtenIdentityCount: written,
                persistedIdentityCount,
                observationCount,
                motionReadyIdentityCount
            };

            await putMetadata(metadata);

            const localMetadataPersisted =
                localMetaWrite({
                    phase: PHASE,
                    version: VERSION,
                    generatedAt: metadata.generatedAt,
                    persistedIdentityCount,
                    observationCount,
                    motionReadyIdentityCount
                });

            const result = {
                success: true,
                phase: PHASE,
                version: VERSION,
                build: BUILD,
                status:
                    motionReadyIdentityCount > 0
                        ? "INDEXEDDB_TEMPORAL_HISTORY_MOTION_READY"
                        : "INDEXEDDB_TEMPORAL_HISTORY_PERSISTED",
                generatedAt: now(),
                durationMs: now() - startedAt,

                indexedDBAvailable: true,
                indexedDBPersisted: true,
                localMetadataPersisted,

                dbName: DB_NAME,
                dbVersion: DB_VERSION,
                historyStore: STORE_HISTORY,
                metadataStore: STORE_META,

                sourceStoreName: SOURCE_STORE_NAME,
                sourceIdentityCount: entries.length,
                writtenIdentityCount: written,
                persistedIdentityCount,
                observationCount,
                motionReadyIdentityCount
            };

            global[RESULT_NAME] = result;

            console.log(
                "[RainGuard][39A-15F6N4B1B3C2] IndexedDB temporal history result:",
                result
            );

            return result;
        } catch (error) {
            const result = {
                success: false,
                phase: PHASE,
                version: VERSION,
                build: BUILD,
                status: "INDEXEDDB_TEMPORAL_HISTORY_FAILED",
                generatedAt: now(),
                durationMs: now() - startedAt,
                indexedDBAvailable:
                    "indexedDB" in global,
                indexedDBPersisted: false,
                error: String(
                    error?.stack ||
                    error?.message ||
                    error
                )
            };

            global[RESULT_NAME] = result;

            console.error(
                "[RainGuard][39A-15F6N4B1B3C2]",
                error
            );

            return result;
        } finally {
            running = false;
        }
    }

    async function diagnose() {
        try {
            const count = await countHistory();
            const sample = (await getAllHistory()).slice(0, 5);

            const result = {
                success: true,
                phase: PHASE,
                version: VERSION,
                build: BUILD,
                indexedDBAvailable:
                    "indexedDB" in global,
                dbName: DB_NAME,
                historyStore: STORE_HISTORY,
                persistedIdentityCount: count,
                sample
            };

            console.log(
                "[RainGuard][39A-15F6N4B1B3C2] Diagnostics:",
                result
            );

            return result;
        } catch (error) {
            const result = {
                success: false,
                phase: PHASE,
                error: String(error?.message || error)
            };

            console.error(
                "[RainGuard][39A-15F6N4B1B3C2] Diagnostics failed:",
                error
            );

            return result;
        }
    }

    function start() {
        if (timer) return false;

        runCycle();

        timer = global.setInterval(
            () => runCycle(),
            AUTO_INTERVAL_MS
        );

        return true;
    }

    function stop() {
        if (!timer) return false;

        global.clearInterval(timer);
        timer = null;

        return true;
    }

    global[RUN_NAME] = runCycle;
    global[GET_ALL_NAME] = getAllHistory;
    global[GET_ONE_NAME] = getHistoryForIdentity;
    global[CLEAR_NAME] = clearHistory;
    global[DIAG_NAME] = diagnose;

    global[BRIDGE_NAME] = {
        phase: PHASE,
        version: VERSION,
        build: BUILD,

        dbName: DB_NAME,
        dbVersion: DB_VERSION,
        historyStore: STORE_HISTORY,
        metadataStore: STORE_META,

        get running() {
            return running;
        },

        get timerActive() {
            return Boolean(timer);
        },

        run: runCycle,
        start,
        stop,

        getAllHistory,
        getHistoryForIdentity,
        clear: clearHistory,
        diagnose
    };

    global.setTimeout(() => {
        start();
    }, 2000);

})(window);
