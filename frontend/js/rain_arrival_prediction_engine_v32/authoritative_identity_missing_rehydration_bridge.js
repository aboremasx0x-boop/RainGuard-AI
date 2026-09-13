/*
===========================================================
 RainGuard AI V32
 Phase 39A-15F6N4B1B3C3-FIX2
 Authoritative Identity Missing Rehydration Bridge
===========================================================
*/

(function initializeMissingIdentityRehydrationBridge(global) {
    "use strict";

    const NAME = "RainGuardAuthoritativeIdentityMissingRehydrationV39";
    const PHASE = "39A-15F6N4B1B3C3-FIX2";
    const VERSION = "39A.15F6N4B1B3C3.FIX2";
    const BUILD =
        "rainguard-v39-authoritative-identity-missing-rehydration-bridge";

    const SOURCE_ID_KEYS = Object.freeze([
        "sourceTrackId",
        "canonicalTrackId",
        "trackId",
        "stableId",
        "id"
    ]);

    const runtimeState = {
        initialized: false,
        running: false,

        scannedPersisted: 0,
        scannedRuntime: 0,

        missingBefore: 0,
        restored: 0,
        skipped: 0,
        failed: 0,

        missingAfter: 0,
        continuity: 0,

        lastRunAt: null,
        lastResult: null,
        lastError: null
    };

    function now() {
        return Date.now();
    }

    function normalizeId(value) {
        if (value === null || value === undefined) return null;

        const text = String(value).trim();

        return text.length ? text : null;
    }

    function getIdentity(record) {
        if (!record || typeof record !== "object") return null;

        for (const key of SOURCE_ID_KEYS) {
            const value = normalizeId(record[key]);

            if (value) {
                return value;
            }
        }

        return null;
    }

    function clone(value) {
        if (value === null || value === undefined) return value;

        if (typeof structuredClone === "function") {
            try {
                return structuredClone(value);
            } catch (_) {}
        }

        try {
            return JSON.parse(JSON.stringify(value));
        } catch (_) {
            return value;
        }
    }

    function arrayFromPossibleStore(value) {
        if (!value) return [];

        if (Array.isArray(value)) {
            return value.filter(Boolean);
        }

        if (value instanceof Map) {
            return Array.from(value.values()).filter(Boolean);
        }

        if (value instanceof Set) {
            return Array.from(value.values()).filter(Boolean);
        }

        if (typeof value === "object") {
            return Object.values(value).filter(
                item => item && typeof item === "object"
            );
        }

        return [];
    }

    function dedupe(records) {
        const output = [];
        const seen = new Set();

        for (const record of records || []) {
            const id = getIdentity(record);

            if (!id || seen.has(id)) continue;

            seen.add(id);
            output.push(record);
        }

        return output;
    }

    function getRuntimeTracks() {
        const candidates = [];

        const push = value => {
            candidates.push(...arrayFromPossibleStore(value));
        };

        /*
         * Current known RainGuard stores.
         */

        push(global.RainArrivalStableTrackIdentityV32?.getAll?.());
        push(global.RainArrivalStableTrackIdentityV32?.tracks);
        push(global.RainArrivalStableTrackIdentityV32?.store);

        push(global.RainArrivalTrackStoreV32?.getAll?.());
        push(global.RainArrivalTrackStoreV32?.tracks);
        push(global.RainArrivalTrackStoreV32?.store);

        push(global.RainGuardAI?.V32?.stableTracks);
        push(global.RainGuardAI?.V32?.tracks);

        return dedupe(candidates);
    }

    async function readIndexedDBStore(dbName, storeName) {
        return new Promise(resolve => {
            try {
                const request = indexedDB.open(dbName);

                request.onerror = () => resolve([]);

                request.onsuccess = () => {
                    const db = request.result;

                    if (!db.objectStoreNames.contains(storeName)) {
                        db.close();
                        resolve([]);
                        return;
                    }

                    try {
                        const transaction =
                            db.transaction(storeName, "readonly");

                        const store =
                            transaction.objectStore(storeName);

                        const getAllRequest = store.getAll();

                        getAllRequest.onsuccess = () => {
                            const rows =
                                Array.isArray(getAllRequest.result)
                                    ? getAllRequest.result
                                    : [];

                            db.close();
                            resolve(rows);
                        };

                        getAllRequest.onerror = () => {
                            db.close();
                            resolve([]);
                        };

                    } catch (_) {
                        db.close();
                        resolve([]);
                    }
                };

            } catch (_) {
                resolve([]);
            }
        });
    }

    async function getPersistedTracks() {
        const candidates = [];

        /*
         * First use already loaded recovery bridge if available.
         */

        const recovery =
            global.RainGuardAuthoritativeIdentityRecoveryC3 ||
            global.RainGuardAuthoritativeIdentityRecoveryV39 ||
            global.RainArrivalAuthoritativeIdentityRecoveryV39;

        if (recovery) {
            const methods = [
                "getPersisted",
                "getAll",
                "readAll",
                "loadAll",
                "recoverAll"
            ];

            for (const method of methods) {
                if (typeof recovery[method] !== "function") continue;

                try {
                    const result =
                        await recovery[method]();

                    candidates.push(
                        ...arrayFromPossibleStore(result)
                    );

                    if (result?.records) {
                        candidates.push(
                            ...arrayFromPossibleStore(result.records)
                        );
                    }

                    if (result?.items) {
                        candidates.push(
                            ...arrayFromPossibleStore(result.items)
                        );
                    }

                } catch (_) {}
            }
        }

        /*
         * Fallback: known IndexedDB databases/stores.
         */

        const databaseCandidates = [
            "RainGuardIdentityRecoveryV39",
            "RainGuardV39",
            "RainGuardAI",
            "RainArrivalV32"
        ];

        const storeCandidates = [
            "authoritativeIdentities",
            "stableTrackIdentities",
            "temporalHistory",
            "tracks"
        ];

        for (const dbName of databaseCandidates) {
            for (const storeName of storeCandidates) {
                try {
                    const rows =
                        await readIndexedDBStore(
                            dbName,
                            storeName
                        );

                    candidates.push(...rows);

                } catch (_) {}
            }
        }

        return dedupe(candidates);
    }

    function buildRuntimeIdentitySet(records) {
        return new Set(
            (records || [])
                .map(getIdentity)
                .filter(Boolean)
        );
    }

    function normalizeRecoveredTrack(record) {
        const copy = clone(record);

        const id = getIdentity(copy);

        if (!id) return null;

        copy.stableId =
            normalizeId(copy.stableId) || id;

        copy.trackId =
            normalizeId(copy.trackId) || id;

        copy.canonicalTrackId =
            normalizeId(copy.canonicalTrackId) || id;

        copy.sourceTrackId =
            normalizeId(copy.sourceTrackId) || id;

        copy.rehydrated = true;
        copy.rehydratedAt = now();
        copy.rehydratedBy = PHASE;

        return copy;
    }

    function injectIntoObjectStore(store, id, record) {
        if (!store || typeof store !== "object") return false;

        try {
            if (store instanceof Map) {
                store.set(id, record);
                return true;
            }

            if (Array.isArray(store)) {
                const exists =
                    store.some(item => getIdentity(item) === id);

                if (!exists) {
                    store.push(record);
                }

                return true;
            }

            store[id] = record;
            return true;

        } catch (_) {
            return false;
        }
    }

    function injectTrack(record) {
        const normalized =
            normalizeRecoveredTrack(record);

        if (!normalized) {
            return {
                success: false,
                reason: "INVALID_IDENTITY"
            };
        }

        const id = getIdentity(normalized);

        let injected = false;

        const stableEngine =
            global.RainArrivalStableTrackIdentityV32;

        /*
         * Prefer official runtime APIs.
         */

        const officialMethods = [
            "register",
            "upsert",
            "set",
            "add",
            "restore",
            "rehydrate"
        ];

        if (stableEngine) {
            for (const method of officialMethods) {
                if (typeof stableEngine[method] !== "function") continue;

                try {
                    const result =
                        stableEngine[method](normalized);

                    if (result !== false) {
                        injected = true;
                        break;
                    }
                } catch (_) {}
            }
        }

        /*
         * Direct store fallback.
         */

        if (!injected && stableEngine) {
            injected =
                injectIntoObjectStore(
                    stableEngine.tracks,
                    id,
                    normalized
                ) ||
                injectIntoObjectStore(
                    stableEngine.store,
                    id,
                    normalized
                ) ||
                injectIntoObjectStore(
                    stableEngine.registry,
                    id,
                    normalized
                );
        }

        /*
         * TrackStore fallback.
         */

        const trackStore =
            global.RainArrivalTrackStoreV32;

        if (!injected && trackStore) {
            for (const method of [
                "upsert",
                "set",
                "add",
                "register"
            ]) {
                if (typeof trackStore[method] !== "function") continue;

                try {
                    const result =
                        trackStore[method](normalized);

                    if (result !== false) {
                        injected = true;
                        break;
                    }
                } catch (_) {}
            }
        }

        if (!injected && trackStore) {
            injected =
                injectIntoObjectStore(
                    trackStore.tracks,
                    id,
                    normalized
                ) ||
                injectIntoObjectStore(
                    trackStore.store,
                    id,
                    normalized
                );
        }

        return {
            success: injected,
            id,
            record: normalized
        };
    }

    async function rehydrate() {
        if (runtimeState.running) {
            return {
                success: false,
                status: "REHYDRATION_ALREADY_RUNNING"
            };
        }

        runtimeState.running = true;

        try {
            const persisted =
                await getPersistedTracks();

            const runtimeBefore =
                getRuntimeTracks();

            runtimeState.scannedPersisted =
                persisted.length;

            runtimeState.scannedRuntime =
                runtimeBefore.length;

            const runtimeIds =
                buildRuntimeIdentitySet(runtimeBefore);

            const missing =
                persisted.filter(record => {
                    const id = getIdentity(record);

                    return id && !runtimeIds.has(id);
                });

            runtimeState.missingBefore =
                missing.length;

            let restored = 0;
            let skipped = 0;
            let failed = 0;

            const restoredIds = [];
            const failedIds = [];

            for (const record of missing) {
                const result =
                    injectTrack(record);

                if (result.success) {
                    restored++;
                    restoredIds.push(result.id);
                } else {
                    failed++;
                    failedIds.push(
                        getIdentity(record)
                    );
                }
            }

            /*
             * Verify actual runtime after injection.
             */

            const runtimeAfter =
                getRuntimeTracks();

            const afterIds =
                buildRuntimeIdentitySet(runtimeAfter);

            let matched = 0;

            for (const record of persisted) {
                const id = getIdentity(record);

                if (id && afterIds.has(id)) {
                    matched++;
                }
            }

            const missingAfter =
                Math.max(
                    0,
                    persisted.length - matched
                );

            const continuity =
                persisted.length
                    ? (matched / persisted.length) * 100
                    : 100;

            runtimeState.restored = restored;
            runtimeState.skipped = skipped;
            runtimeState.failed = failed;
            runtimeState.missingAfter = missingAfter;
            runtimeState.continuity = continuity;
            runtimeState.lastRunAt = now();

            const result = {
                success:
                    missingAfter === 0,

                status:
                    missingAfter === 0
                        ? "AUTHORITATIVE_IDENTITY_REHYDRATION_COMPLETE"
                        : "AUTHORITATIVE_IDENTITY_REHYDRATION_PARTIAL",

                phase: PHASE,
                version: VERSION,
                build: BUILD,

                persistedCount:
                    persisted.length,

                runtimeBefore:
                    runtimeBefore.length,

                missingBefore:
                    missing.length,

                restored,
                failed,

                runtimeAfter:
                    runtimeAfter.length,

                matched,
                missingAfter,

                continuity:
                    `${continuity.toFixed(2)}%`,

                restoredIds:
                    restoredIds.slice(0, 20),

                failedIds:
                    failedIds.slice(0, 20),

                generatedAt: now()
            };

            runtimeState.lastResult =
                clone(result);

            console.log(
                "[RainGuard][C3-FIX2] Rehydration result:",
                result
            );

            return result;

        } catch (error) {

            runtimeState.lastError = {
                name:
                    error?.name || "Error",

                message:
                    error?.message || String(error),

                stack:
                    error?.stack || null,

                timestamp:
                    now()
            };

            const result = {
                success: false,
                status:
                    "AUTHORITATIVE_IDENTITY_REHYDRATION_FAILED",
                phase: PHASE,
                version: VERSION,
                build: BUILD,
                error:
                    clone(runtimeState.lastError),
                generatedAt:
                    now()
            };

            runtimeState.lastResult =
                clone(result);

            console.error(
                "[RainGuard][C3-FIX2] Rehydration failed:",
                result
            );

            return result;

        } finally {
            runtimeState.running = false;
        }
    }

    function diagnose() {
        const result = {
            success: true,
            name: NAME,
            phase: PHASE,
            version: VERSION,
            build: BUILD,

            initialized:
                runtimeState.initialized,

            running:
                runtimeState.running,

            scannedPersisted:
                runtimeState.scannedPersisted,

            scannedRuntime:
                runtimeState.scannedRuntime,

            missingBefore:
                runtimeState.missingBefore,

            restored:
                runtimeState.restored,

            failed:
                runtimeState.failed,

            missingAfter:
                runtimeState.missingAfter,

            continuity:
                `${runtimeState.continuity.toFixed(2)}%`,

            lastRunAt:
                runtimeState.lastRunAt,

            lastResult:
                clone(runtimeState.lastResult),

            lastError:
                clone(runtimeState.lastError)
        };

        console.log(
            "[RainGuard][C3-FIX2] Diagnostics:",
            result
        );

        return result;
    }

    const api = Object.freeze({
        name: NAME,
        phase: PHASE,
        version: VERSION,
        build: BUILD,

        rehydrate,
        run: rehydrate,
        diagnose,

        getState() {
            return clone(runtimeState);
        }
    });

    global.RainGuardAuthoritativeIdentityMissingRehydrationV39 =
        api;

    global.RainGuardAI =
        global.RainGuardAI || {};

    global.RainGuardAI.V32 =
        global.RainGuardAI.V32 || {};

    global.RainGuardAI.V32
        .authoritativeIdentityMissingRehydration =
        api;

    runtimeState.initialized = true;

    console.log(
        "[RainGuard AI V32] C3-FIX2 Missing Identity Rehydration Bridge loaded.",
        {
            phase: PHASE,
            version: VERSION,
            build: BUILD
        }
    );

})(typeof globalThis !== "undefined"
    ? globalThis
    : window);
