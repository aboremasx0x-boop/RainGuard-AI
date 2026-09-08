/*
============================================================
RainGuard AI V39
Phase 39A-15F6N4B1B3C3
Persistent Stable Identity Cross-Reload Recovery Bridge
============================================================

Target:
frontend/js/rain_arrival_prediction_engine_v32/
indexeddb_authoritative_identity_recovery_39A15F6N4B1B3C3.js

Purpose:
- Preserve Stable Track IDs across browser reloads.
- Reuse the authoritative IndexedDB database from C2.
- Store only a bounded identity mapping in the existing metadata store.
- Restore previous Stable IDs after reload.
- Wrap the public StableTrack API without deep cloning.
- Avoid localStorage heavy payloads.
- Avoid creating another IndexedDB database.
============================================================
*/

(function (global) {
    "use strict";

    const PHASE = "39A-15F6N4B1B3C3";
    const VERSION = "39A.15F6N4B1B3C3.0";
    const BUILD =
        "rainguard-v39-persistent-stable-identity-cross-reload-recovery";

    const C2_BRIDGE_NAME =
        "RainGuard39A15F6N4B1B3C2BridgeV39";

    const STABLE_API_NAME =
        "RainArrivalStableTrackIdentityV32";

    const RESULT_NAME =
        "RainGuard39A15F6N4B1B3C3ResultV39";

    const BRIDGE_NAME =
        "RainGuard39A15F6N4B1B3C3BridgeV39";

    const RUN_NAME =
        "runRainGuard39A15F6N4B1B3C3PersistentIdentityRecovery";

    const DIAG_NAME =
        "diagnoseRainGuard39A15F6N4B1B3C3PersistentIdentityRecovery";

    const META_KEY =
        "stableIdentityRecovery:v1";

    const MAX_MAPPINGS = 5000;

    const START_DELAY_MS = 2500;
    const RETRY_DELAY_MS = 1500;
    const MAX_RETRIES = 12;
    const SAVE_INTERVAL_MS = 15000;

    let running = false;
    let installed = false;
    let recovered = false;

    let retryCount = 0;
    let retryTimer = null;
    let saveTimer = null;

    let dbPromise = null;

    const identityMap = new Map();
    const currentToRecovered = new Map();
    const recoveredToCurrent = new Map();

    let originalGetAllTracks = null;
    let originalGetTrack = null;
    let originalReconcile = null;

    let lastSavedAt = 0;
    let lastRecoveredAt = 0;
    let lastResult = null;

    function now() {
        return Date.now();
    }

    function safeString(value) {
        if (
            value === null ||
            value === undefined
        ) {
            return "";
        }

        return String(value).trim();
    }

    function safeArray(value) {
        return Array.isArray(value)
            ? value
            : [];
    }

    function shallowCopy(value) {
        if (
            !value ||
            typeof value !== "object"
        ) {
            return value;
        }

        if (Array.isArray(value)) {
            return value.slice();
        }

        return { ...value };
    }

    function uniqueStrings(values) {
        return [
            ...new Set(
                safeArray(values)
                    .map(safeString)
                    .filter(Boolean)
            )
        ];
    }

    /*
    ------------------------------------------------------------
    Create a deterministic key for the physical storm identity.
    This key must NOT depend on the generated RST-* ID.
    ------------------------------------------------------------
    */
    function buildIdentityKey(track) {
        if (
            !track ||
            typeof track !== "object"
        ) {
            return "";
        }

        const sourceIds = uniqueStrings([
            ...safeArray(track.sourceIds),
            ...safeArray(track.sources),
            ...safeArray(track.memberIds),
            ...safeArray(track.sourceTrackIds),
            track.sourceTrackId,
            track.cellId,
            track.canonicalTrackId,
            track.externalId,
            track.providerTrackId
        ]);

        if (sourceIds.length) {
            return (
                "sources:" +
                sourceIds
                    .sort()
                    .join("|")
            );
        }

        const source =
            safeString(
                track.source ||
                track.provider ||
                track.sourceName
            );

        const latitude =
            Number(
                track.latitude ??
                track.lat ??
                track.coordinate?.latitude ??
                track.coordinate?.lat
            );

        const longitude =
            Number(
                track.longitude ??
                track.lon ??
                track.lng ??
                track.coordinate?.longitude ??
                track.coordinate?.lon ??
                track.coordinate?.lng
            );

        if (
            source &&
            Number.isFinite(latitude) &&
            Number.isFinite(longitude)
        ) {
            return [
                "geo",
                source.toLowerCase(),
                latitude.toFixed(3),
                longitude.toFixed(3)
            ].join(":");
        }

        const fallback =
            safeString(
                track.canonicalTrackId ||
                track.trackId ||
                track.cellId
            );

        if (
            fallback &&
            !fallback.startsWith("RST-")
        ) {
            return "fallback:" + fallback;
        }

        return "";
    }

    function getRuntimeStableId(track) {
        return safeString(
            track?.stableTrackId ||
            track?.trackId ||
            track?.id
        );
    }

    function getC2Bridge() {
        return global[C2_BRIDGE_NAME] || null;
    }

    function getStableApi() {
        return global[STABLE_API_NAME] || null;
    }

    function getDatabaseConfig() {
        const bridge = getC2Bridge();

        if (!bridge) {
            return null;
        }

        const dbName =
            safeString(bridge.dbName);

        const metadataStore =
            safeString(
                bridge.metadataStore
            );

        if (
            !dbName ||
            !metadataStore
        ) {
            return null;
        }

        return {
            dbName,
            metadataStore
        };
    }

    /*
    ------------------------------------------------------------
    Open EXACTLY the same IndexedDB database as C2.
    No version upgrade.
    No new store.
    ------------------------------------------------------------
    */
    function openDatabase() {
        if (dbPromise) {
            return dbPromise;
        }

        const config =
            getDatabaseConfig();

        if (!config) {
            return Promise.reject(
                new Error(
                    "C2_DATABASE_CONFIG_UNAVAILABLE"
                )
            );
        }

        if (!global.indexedDB) {
            return Promise.reject(
                new Error(
                    "INDEXEDDB_UNAVAILABLE"
                )
            );
        }

        dbPromise =
            new Promise(
                (resolve, reject) => {

                    const request =
                        global.indexedDB.open(
                            config.dbName
                        );

                    request.onsuccess =
                        () => {

                            const db =
                                request.result;

                            if (
                                !db.objectStoreNames
                                    .contains(
                                        config.metadataStore
                                    )
                            ) {
                                try {
                                    db.close();
                                } catch (_) {}

                                reject(
                                    new Error(
                                        "C2_METADATA_STORE_NOT_FOUND"
                                    )
                                );

                                return;
                            }

                            db.onversionchange =
                                () => {
                                    try {
                                        db.close();
                                    } catch (_) {}

                                    dbPromise = null;
                                };

                            resolve(db);
                        };

                    request.onerror =
                        () => {
                            reject(
                                request.error ||
                                new Error(
                                    "INDEXEDDB_OPEN_FAILED"
                                )
                            );
                        };

                    request.onblocked =
                        () => {
                            console.warn(
                                "[RainGuard][39A-15F6N4B1B3C3] IndexedDB open blocked."
                            );
                        };
                }
            );

        return dbPromise;
    }

    async function readPersistedMap() {
        const config =
            getDatabaseConfig();

        const db =
            await openDatabase();

        return new Promise(
            (resolve, reject) => {

                const tx =
                    db.transaction(
                        [
                            config.metadataStore
                        ],
                        "readonly"
                    );

                const store =
                    tx.objectStore(
                        config.metadataStore
                    );

                const request =
                    store.get(META_KEY);

                request.onsuccess =
                    () => {
                        resolve(
                            request.result ||
                            null
                        );
                    };

                request.onerror =
                    () => {
                        reject(
                            request.error ||
                            new Error(
                                "IDENTITY_MAP_READ_FAILED"
                            )
                        );
                    };
            }
        );
    }

    async function writePersistedMap() {
        const config =
            getDatabaseConfig();

        const db =
            await openDatabase();

        const entries =
            Array.from(
                identityMap.entries()
            )
            .slice(-MAX_MAPPINGS)
            .map(
                ([identityKey, stableId]) => ({
                    identityKey,
                    stableId
                })
            );

        const record = {
            key: META_KEY,

            phase: PHASE,
            version: VERSION,
            build: BUILD,

            generatedAt: now(),

            mappingCount:
                entries.length,

            mappings:
                entries
        };

        return new Promise(
            (resolve, reject) => {

                const tx =
                    db.transaction(
                        [
                            config.metadataStore
                        ],
                        "readwrite"
                    );

                tx.objectStore(
                    config.metadataStore
                ).put(record);

                tx.oncomplete =
                    () => {
                        lastSavedAt = now();

                        resolve(
                            entries.length
                        );
                    };

                tx.onerror =
                    () => {
                        reject(
                            tx.error ||
                            new Error(
                                "IDENTITY_MAP_WRITE_FAILED"
                            )
                        );
                    };

                tx.onabort =
                    () => {
                        reject(
                            tx.error ||
                            new Error(
                                "IDENTITY_MAP_WRITE_ABORTED"
                            )
                        );
                    };
            }
        );
    }

    function loadMappingsIntoMemory(record) {
        identityMap.clear();

        const mappings =
            safeArray(
                record?.mappings
            );

        for (
            const item of mappings
        ) {
            const key =
                safeString(
                    item?.identityKey
                );

            const stableId =
                safeString(
                    item?.stableId
                );

            if (
                !key ||
                !stableId
            ) {
                continue;
            }

            identityMap.set(
                key,
                stableId
            );

            if (
                identityMap.size >=
                MAX_MAPPINGS
            ) {
                break;
            }
        }

        return identityMap.size;
    }

    function translateTrack(track) {
        if (
            !track ||
            typeof track !== "object"
        ) {
            return track;
        }

        const runtimeId =
            getRuntimeStableId(track);

        const identityKey =
            buildIdentityKey(track);

        let recoveredId = "";

        if (identityKey) {
            recoveredId =
                safeString(
                    identityMap.get(
                        identityKey
                    )
                );
        }

        /*
        First observation:
        persist current Stable ID as authoritative.
        */
        if (
            identityKey &&
            !recoveredId &&
            runtimeId
        ) {
            recoveredId =
                runtimeId;

            identityMap.set(
                identityKey,
                recoveredId
            );
        }

        if (!recoveredId) {
            recoveredId =
                runtimeId;
        }

        if (
            runtimeId &&
            recoveredId
        ) {
            currentToRecovered.set(
                runtimeId,
                recoveredId
            );

            recoveredToCurrent.set(
                recoveredId,
                runtimeId
            );
        }

        if (
            !recoveredId ||
            recoveredId === runtimeId
        ) {
            return shallowCopy(track);
        }

        /*
        Do not deep clone.
        Only patch public identity fields.
        */
        const output = {
            ...track,
            stableTrackId:
                recoveredId
        };

        if (
            Object.prototype
                .hasOwnProperty
                .call(
                    track,
                    "trackId"
                )
        ) {
            output.trackId =
                recoveredId;
        }

        if (
            Object.prototype
                .hasOwnProperty
                .call(
                    track,
                    "id"
                ) &&
            safeString(track.id)
                .startsWith("RST-")
        ) {
            output.id =
                recoveredId;
        }

        output.runtimeStableTrackId =
            runtimeId;

        output.identityRecovered =
            true;

        output.identityRecoveryPhase =
            PHASE;

        return output;
    }

    function translatedTracks() {
        const api =
            getStableApi();

        if (
            !api ||
            typeof originalGetAllTracks !==
                "function"
        ) {
            return [];
        }

        let tracks = [];

        try {
            tracks =
                originalGetAllTracks.call(
                    api
                );
        } catch (_) {
            tracks = [];
        }

        if (
            !Array.isArray(tracks)
        ) {
            return [];
        }

        currentToRecovered.clear();
        recoveredToCurrent.clear();

        return tracks.map(
            translateTrack
        );
    }

    function installApiWrapper() {
        if (installed) {
            return true;
        }

        const api =
            getStableApi();

        if (!api) {
            return false;
        }

        if (
            typeof api.getAllTracks !==
                "function"
        ) {
            return false;
        }

        originalGetAllTracks =
            api.getAllTracks.bind(api);

        originalGetTrack =
            typeof api.getTrack ===
                "function"
                ? api.getTrack.bind(api)
                : null;

        originalReconcile =
            typeof api.reconcile ===
                "function"
                ? api.reconcile.bind(api)
                : null;

        api.getAllTracks =
            function () {
                return translatedTracks();
            };

        if (originalGetTrack) {
            api.getTrack =
                function (requestedId) {
                    const requested =
                        safeString(
                            requestedId
                        );

                    const runtimeId =
                        recoveredToCurrent.get(
                            requested
                        ) ||
                        requested;

                    const original =
                        originalGetTrack(
                            runtimeId
                        );

                    if (!original) {
                        return null;
                    }

                    return translateTrack(
                        original
                    );
                };
        }

        if (originalReconcile) {
            api.reconcile =
                function (...args) {
                    const result =
                        originalReconcile(
                            ...args
                        );

                    /*
                    Reconcile may be sync or async.
                    */
                    if (
                        result &&
                        typeof result.then ===
                            "function"
                    ) {
                        return result.then(
                            value => {
                                translatedTracks();

                                scheduleSave();

                                return value;
                            }
                        );
                    }

                    translatedTracks();

                    scheduleSave();

                    return result;
                };
        }

        installed = true;

        return true;
    }

    let saveScheduled = false;

    function scheduleSave() {
        if (saveScheduled) {
            return;
        }

        saveScheduled = true;

        global.setTimeout(
            async () => {
                saveScheduled = false;

                try {
                    translatedTracks();

                    await writePersistedMap();
                } catch (error) {
                    console.warn(
                        "[RainGuard][39A-15F6N4B1B3C3] Deferred identity save failed:",
                        error
                    );
                }
            },
            750
        );
    }

    async function recover() {
        const record =
            await readPersistedMap();

        const persistedCount =
            loadMappingsIntoMemory(
                record
            );

        if (!installApiWrapper()) {
            throw new Error(
                "STABLE_TRACK_API_UNAVAILABLE"
            );
        }

        const translated =
            translatedTracks();

        let recoveredCount = 0;
        let unchangedCount = 0;
        let newMappingCount = 0;

        for (
            const track of translated
        ) {
            if (
                track?.identityRecovered
            ) {
                recoveredCount += 1;
            } else {
                unchangedCount += 1;
            }
        }

        newMappingCount =
            Math.max(
                0,
                identityMap.size -
                persistedCount
            );

        await writePersistedMap();

        recovered = true;
        lastRecoveredAt = now();

        return {
            persistedCount,
            runtimeTrackCount:
                translated.length,
            recoveredCount,
            unchangedCount,
            newMappingCount,
            finalMappingCount:
                identityMap.size
        };
    }

    async function run() {
        if (running) {
            return (
                lastResult || {
                    success: false,
                    phase: PHASE,
                    status:
                        "ALREADY_RUNNING"
                }
            );
        }

        running = true;

        const startedAt =
            now();

        try {
            const c2 =
                getC2Bridge();

            const stableApi =
                getStableApi();

            if (!c2) {
                throw new Error(
                    "C2_BRIDGE_NOT_READY"
                );
            }

            if (!stableApi) {
                throw new Error(
                    "STABLE_TRACK_API_NOT_READY"
                );
            }

            const recovery =
                await recover();

            lastResult = {
                success: true,
                phase: PHASE,
                version: VERSION,
                build: BUILD,

                status:
                    recovery.recoveredCount > 0
                        ? "PERSISTENT_STABLE_IDENTITY_RECOVERED"
                        : "PERSISTENT_STABLE_IDENTITY_READY",

                generatedAt: now(),
                durationMs:
                    now() - startedAt,

                installed,
                recovered,

                dbName:
                    c2.dbName,

                metadataStore:
                    c2.metadataStore,

                persistedMappingCount:
                    recovery.persistedCount,

                runtimeTrackCount:
                    recovery.runtimeTrackCount,

                recoveredIdentityCount:
                    recovery.recoveredCount,

                unchangedIdentityCount:
                    recovery.unchangedCount,

                newMappingCount:
                    recovery.newMappingCount,

                finalMappingCount:
                    recovery.finalMappingCount
            };

            global[RESULT_NAME] =
                lastResult;

            console.log(
                "[RainGuard][39A-15F6N4B1B3C3] Persistent identity recovery result:",
                lastResult
            );

            return lastResult;

        } catch (error) {
            lastResult = {
                success: false,
                phase: PHASE,
                version: VERSION,
                build: BUILD,

                status:
                    "PERSISTENT_STABLE_IDENTITY_RECOVERY_FAILED",

                generatedAt: now(),
                durationMs:
                    now() - startedAt,

                installed,
                recovered,

                error:
                    String(
                        error?.stack ||
                        error?.message ||
                        error
                    )
            };

            global[RESULT_NAME] =
                lastResult;

            console.warn(
                "[RainGuard][39A-15F6N4B1B3C3]",
                lastResult
            );

            return lastResult;

        } finally {
            running = false;
        }
    }

    async function diagnose() {
        let persistedRecord = null;

        try {
            persistedRecord =
                await readPersistedMap();
        } catch (_) {}

        let runtimeTracks = [];

        try {
            runtimeTracks =
                installed
                    ? translatedTracks()
                    : (
                        getStableApi()
                            ?.getAllTracks?.() ||
                        []
                    );
        } catch (_) {
            runtimeTracks = [];
        }

        const runtimeIds =
            runtimeTracks
                .map(
                    getRuntimeStableId
                )
                .filter(Boolean);

        const uniqueRuntimeIds =
            new Set(runtimeIds);

        const result = {
            success: true,
            phase: PHASE,
            version: VERSION,
            build: BUILD,

            installed,
            recovered,
            running,

            c2BridgeAvailable:
                Boolean(
                    getC2Bridge()
                ),

            stableApiAvailable:
                Boolean(
                    getStableApi()
                ),

            persistedMappingCount:
                safeArray(
                    persistedRecord?.mappings
                ).length,

            memoryMappingCount:
                identityMap.size,

            runtimeTrackCount:
                runtimeTracks.length,

            runtimeUniqueIdentityCount:
                uniqueRuntimeIds.size,

            duplicateRuntimeIdentityCount:
                Math.max(
                    0,
                    runtimeIds.length -
                    uniqueRuntimeIds.size
                ),

            lastRecoveredAt,
            lastSavedAt,

            latestResult:
                lastResult
        };

        console.log(
            "[RainGuard][39A-15F6N4B1B3C3] Diagnostics:",
            result
        );

        return result;
    }

    function startPeriodicSave() {
        if (saveTimer) {
            return;
        }

        saveTimer =
            global.setInterval(
                () => {
                    scheduleSave();
                },
                SAVE_INTERVAL_MS
            );
    }

    function stop() {
        if (retryTimer) {
            global.clearTimeout(
                retryTimer
            );

            retryTimer = null;
        }

        if (saveTimer) {
            global.clearInterval(
                saveTimer
            );

            saveTimer = null;
        }

        return true;
    }

    function autoStart() {
        run().then(
            result => {

                if (
                    result?.success
                ) {
                    retryCount = 0;

                    startPeriodicSave();

                    return;
                }

                if (
                    retryCount >=
                    MAX_RETRIES
                ) {
                    return;
                }

                retryCount += 1;

                retryTimer =
                    global.setTimeout(
                        autoStart,
                        RETRY_DELAY_MS
                    );
            }
        );
    }

    global[RUN_NAME] =
        run;

    global[DIAG_NAME] =
        diagnose;

    global[BRIDGE_NAME] = {
        phase: PHASE,
        version: VERSION,
        build: BUILD,

        get installed() {
            return installed;
        },

        get recovered() {
            return recovered;
        },

        get running() {
            return running;
        },

        get mappingCount() {
            return identityMap.size;
        },

        run,
        recover,
        diagnose,
        stop,

        getMappings() {
            return Array.from(
                identityMap.entries()
            ).map(
                ([identityKey, stableId]) => ({
                    identityKey,
                    stableId
                })
            );
        },

        getLatestResult() {
            return lastResult;
        }
    };

    global.setTimeout(
        autoStart,
        START_DELAY_MS
    );

})(window);
