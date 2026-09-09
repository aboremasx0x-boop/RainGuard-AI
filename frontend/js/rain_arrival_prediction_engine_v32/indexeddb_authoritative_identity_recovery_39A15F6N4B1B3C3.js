/*
===========================================================
 RainGuard AI V39
 Phase 39A-15F6N4B1B3C3 — C3-FIX1

 Authoritative Identity Recovery
 Source-Track Anchored Cross-Reload Recovery

 Purpose:
 - Recover storm identity after browser reload.
 - Prefer real source identity over generated RST identity.
 - Reject volatile/generated RST-* identifiers as recovery anchors.
 - Use sourceTrackId as primary stable source identity.
 - Provide deterministic geographic/time fallback.
 - Avoid unbounded memory growth.
===========================================================
*/

(function initializeAuthoritativeIdentityRecoveryC3(global) {
    "use strict";

    const PHASE = "39A-15F6N4B1B3C3";
    const VERSION = "39A.15F6N4B1B3C3.FIX1";
    const BUILD =
        "rainguard-v39-authoritative-identity-recovery-source-track-fix1";

    const DB_NAME = "RainGuardIdentityRecoveryV39";
    const DB_VERSION = 1;
    const STORE_NAME = "authoritativeIdentities";

    const MAX_RECORDS = 5000;
    const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

    const SOURCE_ID_FIELDS = Object.freeze([
        "sourceTrackId",
        "sourceId",
        "externalTrackId",
        "providerTrackId"
    ]);

    const GENERATED_ID_FIELDS = Object.freeze([
        "stableId",
        "stableTrackId",
        "trackId",
        "canonicalTrackId",
        "id"
    ]);

    const state = {
        initialized: false,
        dbAvailable: false,
        db: null,

        recoveredCount: 0,
        persistedCount: 0,
        matchedBySource: 0,
        matchedByFallback: 0,
        rejectedGeneratedIds: 0,

        lastPersistAt: null,
        lastRecoverAt: null,
        lastError: null,

        createdAt: Date.now(),
        updatedAt: Date.now()
    };

    function now() {
        return Date.now();
    }

    function normalizeString(value) {
        if (value === null || value === undefined) return "";

        return String(value)
            .trim()
            .replace(/\s+/g, " ");
    }

    function normalizeLower(value) {
        return normalizeString(value).toLowerCase();
    }

    function safeNumber(value) {
        const number = Number(value);
        return Number.isFinite(number) ? number : null;
    }

    function normalizeError(error) {
        return {
            name: error?.name || "Error",
            message: error?.message || String(error),
            stack: error?.stack || null,
            timestamp: now()
        };
    }

    function clone(value) {
        if (value === undefined) return undefined;

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

    /*
    -------------------------------------------------------
    Generated RainGuard identities MUST NOT become the
    authoritative cross-reload source identity.
    -------------------------------------------------------
    */

    function isGeneratedIdentity(value) {
        const text = normalizeString(value);

        if (!text) return false;

        return (
            /^RST-/i.test(text) ||
            /^RG-/i.test(text) ||
            /^RainGuard-/i.test(text)
        );
    }

    /*
    -------------------------------------------------------
    Coordinate extraction
    -------------------------------------------------------
    */

    function getLatitude(track) {
        return (
            safeNumber(track?.latitude) ??
            safeNumber(track?.lat) ??
            safeNumber(track?.coordinate?.latitude) ??
            safeNumber(track?.coordinate?.lat) ??
            safeNumber(track?.coordinate?.[0])
        );
    }

    function getLongitude(track) {
        return (
            safeNumber(track?.longitude) ??
            safeNumber(track?.lon) ??
            safeNumber(track?.lng) ??
            safeNumber(track?.coordinate?.longitude) ??
            safeNumber(track?.coordinate?.lon) ??
            safeNumber(track?.coordinate?.lng) ??
            safeNumber(track?.coordinate?.[1])
        );
    }

    /*
    -------------------------------------------------------
    Source normalization

    Example observed runtime:

      stableId:
        RST-stormentitys-mtu2e2dr-1o

      sourceTrackId:
        Ash Sinan

    Therefore sourceTrackId is preferred.
    -------------------------------------------------------
    */

    function getSource(track) {
        return normalizeLower(
            track?.source ||
            track?.provider ||
            track?.sourceName ||
            track?.origin ||
            "unknown"
        );
    }

    function getRealSourceTrackId(track) {
        for (const field of SOURCE_ID_FIELDS) {
            const candidate = normalizeString(track?.[field]);

            if (!candidate) continue;

            if (isGeneratedIdentity(candidate)) {
                state.rejectedGeneratedIds += 1;
                continue;
            }

            return candidate;
        }

        return "";
    }

    function getGeneratedTrackId(track) {
        for (const field of GENERATED_ID_FIELDS) {
            const candidate = normalizeString(track?.[field]);

            if (candidate) return candidate;
        }

        return "";
    }

    /*
    -------------------------------------------------------
    Time normalization
    -------------------------------------------------------
    */

    function parseTime(value) {
        if (value === null || value === undefined || value === "") {
            return null;
        }

        if (typeof value === "number" && Number.isFinite(value)) {
            return value;
        }

        const parsed = Date.parse(value);

        return Number.isFinite(parsed) ? parsed : null;
    }

    function getFirstSeenAt(track) {
        return (
            parseTime(track?.firstSeenAt) ??
            parseTime(track?.observedAt) ??
            parseTime(track?.timestamp) ??
            parseTime(track?.lastSeenAt) ??
            null
        );
    }

    /*
    -------------------------------------------------------
    Geographic bucket

    We deliberately use coarse coordinates.

    The exact latitude/longitude cannot be the primary
    identity because storm cells move over time.
    -------------------------------------------------------
    */

    function coordinateBucket(track, precision = 1) {
        const latitude = getLatitude(track);
        const longitude = getLongitude(track);

        if (latitude === null || longitude === null) {
            return "";
        }

        return (
            latitude.toFixed(precision) +
            ":" +
            longitude.toFixed(precision)
        );
    }

    /*
    -------------------------------------------------------
    Deterministic hash
    -------------------------------------------------------
    */

    function hashString(input) {
        const text = String(input || "");

        let hash = 2166136261;

        for (let i = 0; i < text.length; i += 1) {
            hash ^= text.charCodeAt(i);

            hash = Math.imul(hash, 16777619);
        }

        return (hash >>> 0).toString(36);
    }

    /*
    -------------------------------------------------------
    Identity strategy

    Priority:

    1. source + sourceTrackId
    2. sourceTrackId
    3. source + firstSeenAt + coarse geographic bucket
    4. source + coarse geographic bucket
    5. generated ID only as LAST diagnostic fallback

    Generated RST-* identity is NEVER treated as an
    authoritative source identity.
    -------------------------------------------------------
    */

    function buildIdentityDescriptor(track) {
        if (!track || typeof track !== "object") {
            return {
                key: "",
                method: "INVALID_TRACK",
                authoritative: false
            };
        }

        const source = getSource(track);
        const sourceTrackId = getRealSourceTrackId(track);

        if (sourceTrackId) {
            const normalizedSourceTrackId =
                normalizeLower(sourceTrackId);

            if (source && source !== "unknown") {
                return {
                    key:
                        "SRC:" +
                        hashString(
                            source +
                            "|" +
                            normalizedSourceTrackId
                        ),

                    rawKey:
                        source +
                        "|" +
                        normalizedSourceTrackId,

                    method: "SOURCE_AND_SOURCE_TRACK_ID",
                    authoritative: true,
                    source,
                    sourceTrackId
                };
            }

            return {
                key:
                    "SID:" +
                    hashString(normalizedSourceTrackId),

                rawKey: normalizedSourceTrackId,

                method: "SOURCE_TRACK_ID",
                authoritative: true,
                source,
                sourceTrackId
            };
        }

        const firstSeenAt = getFirstSeenAt(track);
        const bucket = coordinateBucket(track, 1);

        if (firstSeenAt && bucket) {
            /*
            30-minute time bucket reduces minor timestamp
            variation without using exact runtime timestamps.
            */

            const timeBucket =
                Math.floor(firstSeenAt / (30 * 60 * 1000));

            const rawKey =
                source +
                "|" +
                timeBucket +
                "|" +
                bucket;

            return {
                key:
                    "STG:" +
                    hashString(rawKey),

                rawKey,

                method:
                    "SOURCE_TIME_GEOGRAPHIC_FALLBACK",

                authoritative: false,
                source,
                sourceTrackId: ""
            };
        }

        if (bucket) {
            const rawKey =
                source +
                "|" +
                bucket;

            return {
                key:
                    "GEO:" +
                    hashString(rawKey),

                rawKey,

                method:
                    "SOURCE_GEOGRAPHIC_FALLBACK",

                authoritative: false,
                source,
                sourceTrackId: ""
            };
        }

        const generatedId = getGeneratedTrackId(track);

        if (generatedId) {
            return {
                key:
                    "GEN:" +
                    hashString(generatedId),

                rawKey: generatedId,

                method:
                    "GENERATED_ID_LAST_RESORT",

                authoritative: false,
                source,
                sourceTrackId: ""
            };
        }

        return {
            key: "",
            rawKey: "",
            method: "NO_IDENTITY_AVAILABLE",
            authoritative: false,
            source,
            sourceTrackId: ""
        };
    }

    /*
    -------------------------------------------------------
    IndexedDB
    -------------------------------------------------------
    */

    function openDatabase() {
        if (!global.indexedDB) {
            state.dbAvailable = false;

            return Promise.resolve(null);
        }

        if (state.db) {
            return Promise.resolve(state.db);
        }

        return new Promise((resolve, reject) => {
            const request =
                global.indexedDB.open(
                    DB_NAME,
                    DB_VERSION
                );

            request.onupgradeneeded = event => {
                const db = event.target.result;

                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    const store =
                        db.createObjectStore(
                            STORE_NAME,
                            {
                                keyPath: "identityKey"
                            }
                        );

                    store.createIndex(
                        "updatedAt",
                        "updatedAt",
                        { unique: false }
                    );

                    store.createIndex(
                        "sourceTrackId",
                        "sourceTrackId",
                        { unique: false }
                    );
                }
            };

            request.onsuccess = () => {
                state.db = request.result;
                state.dbAvailable = true;

                state.db.onversionchange = () => {
                    try {
                        state.db.close();
                    } catch (_) {}

                    state.db = null;
                };

                resolve(state.db);
            };

            request.onerror = () => {
                state.dbAvailable = false;

                reject(
                    request.error ||
                    new Error(
                        "IDENTITY_RECOVERY_DB_OPEN_FAILED"
                    )
                );
            };
        });
    }

    function transaction(mode = "readonly") {
        if (!state.db) return null;

        return state.db
            .transaction(STORE_NAME, mode)
            .objectStore(STORE_NAME);
    }

    function getRecord(identityKey) {
        return new Promise(resolve => {
            const store = transaction("readonly");

            if (!store || !identityKey) {
                resolve(null);
                return;
            }

            const request = store.get(identityKey);

            request.onsuccess = () => {
                resolve(request.result || null);
            };

            request.onerror = () => {
                resolve(null);
            };
        });
    }

    function putRecord(record) {
        return new Promise(resolve => {
            const store = transaction("readwrite");

            if (!store) {
                resolve(false);
                return;
            }

            const request = store.put(record);

            request.onsuccess = () => resolve(true);
            request.onerror = () => resolve(false);
        });
    }

    function getAllRecords() {
        return new Promise(resolve => {
            const store = transaction("readonly");

            if (!store) {
                resolve([]);
                return;
            }

            const request = store.getAll();

            request.onsuccess = () => {
                resolve(
                    Array.isArray(request.result)
                        ? request.result
                        : []
                );
            };

            request.onerror = () => resolve([]);
        });
    }

    function deleteRecord(identityKey) {
        return new Promise(resolve => {
            const store = transaction("readwrite");

            if (!store) {
                resolve(false);
                return;
            }

            const request =
                store.delete(identityKey);

            request.onsuccess = () => resolve(true);
            request.onerror = () => resolve(false);
        });
    }

    /*
    -------------------------------------------------------
    Persist
    -------------------------------------------------------
    */

    async function persistTrack(track) {
        const descriptor =
            buildIdentityDescriptor(track);

        if (!descriptor.key) {
            return {
                success: false,
                reason: "IDENTITY_KEY_UNAVAILABLE"
            };
        }

        const timestamp = now();

        const existing =
            await getRecord(descriptor.key);

        const record = {
            identityKey: descriptor.key,

            identityMethod:
                descriptor.method,

            authoritative:
                descriptor.authoritative,

            source:
                descriptor.source || "",

            sourceTrackId:
                descriptor.sourceTrackId || "",

            stableId:
                normalizeString(track?.stableId),

            stableTrackId:
                normalizeString(track?.stableTrackId),

            trackId:
                normalizeString(track?.trackId),

            canonicalTrackId:
                normalizeString(track?.canonicalTrackId),

            latitude:
                getLatitude(track),

            longitude:
                getLongitude(track),

            coordinate:
                clone(track?.coordinate),

            firstSeenAt:
                getFirstSeenAt(track),

            observedAt:
                track?.observedAt ?? null,

            lastSeenAt:
                track?.lastSeenAt ?? null,

            intensity:
                track?.intensity ?? null,

            confidence:
                track?.confidence ?? null,

            matchMethod:
                track?.matchMethod ?? null,

            matchDistanceKm:
                track?.matchDistanceKm ?? null,

            raw:
                clone(track?.raw),

            createdAt:
                existing?.createdAt || timestamp,

            updatedAt:
                timestamp,

            seenCount:
                (existing?.seenCount || 0) + 1
        };

        const success =
            await putRecord(record);

        if (success) {
            state.persistedCount += 1;
            state.lastPersistAt = timestamp;
            state.updatedAt = timestamp;
        }

        return {
            success,
            identityKey: descriptor.key,
            identityMethod: descriptor.method,
            authoritative:
                descriptor.authoritative,
            record
        };
    }

    async function persistTracks(tracks = []) {
        await initialize();

        const list =
            Array.isArray(tracks)
                ? tracks
                : [];

        let persisted = 0;
        let skipped = 0;

        const methods = {};

        for (const track of list) {
            const result =
                await persistTrack(track);

            if (result.success) {
                persisted += 1;

                methods[result.identityMethod] =
                    (methods[result.identityMethod] || 0) + 1;
            } else {
                skipped += 1;
            }
        }

        await pruneDatabase();

        return {
            success: true,
            status:
                "AUTHORITATIVE_IDENTITIES_PERSISTED",

            phase: PHASE,
            version: VERSION,

            inputCount: list.length,
            persisted,
            skipped,
            methods,

            generatedAt: now()
        };
    }

    /*
    -------------------------------------------------------
    Recovery
    -------------------------------------------------------
    */

    function applyRecoveredIdentity(
        track,
        record,
        descriptor
    ) {
        if (!track || !record) return false;

        /*
        Preserve current source observation data.

        Recover only identity continuity fields when
        current values are missing or generated.
        */

        if (
            record.stableId &&
            (
                !track.stableId ||
                isGeneratedIdentity(track.stableId)
            )
        ) {
            track.stableId =
                record.stableId;
        }

        if (
            record.stableTrackId &&
            (
                !track.stableTrackId ||
                isGeneratedIdentity(track.stableTrackId)
            )
        ) {
            track.stableTrackId =
                record.stableTrackId;
        }

        if (
            record.canonicalTrackId &&
            (
                !track.canonicalTrackId ||
                isGeneratedIdentity(track.canonicalTrackId)
            )
        ) {
            track.canonicalTrackId =
                record.canonicalTrackId;
        }

        /*
        Do NOT overwrite sourceTrackId with RST identity.
        */

        if (
            !getRealSourceTrackId(track) &&
            record.sourceTrackId &&
            !isGeneratedIdentity(record.sourceTrackId)
        ) {
            track.sourceTrackId =
                record.sourceTrackId;
        }

        track.identityRecovery = {
            recovered: true,
            identityKey:
                record.identityKey,
            identityMethod:
                descriptor.method,
            persistedIdentityMethod:
                record.identityMethod,
            authoritative:
                Boolean(record.authoritative),
            recoveredAt: now()
        };

        return true;
    }

    async function recoverTrack(track) {
        const descriptor =
            buildIdentityDescriptor(track);

        if (!descriptor.key) {
            return {
                recovered: false,
                reason:
                    "IDENTITY_KEY_UNAVAILABLE"
            };
        }

        let record =
            await getRecord(descriptor.key);

        /*
        If source+sourceTrackId lookup failed,
        try sourceTrackId-only compatibility lookup.
        */

        if (
            !record &&
            descriptor.sourceTrackId
        ) {
            const fallbackKey =
                "SID:" +
                hashString(
                    normalizeLower(
                        descriptor.sourceTrackId
                    )
                );

            if (
                fallbackKey !==
                descriptor.key
            ) {
                record =
                    await getRecord(
                        fallbackKey
                    );
            }
        }

        if (!record) {
            return {
                recovered: false,
                identityKey:
                    descriptor.key,
                identityMethod:
                    descriptor.method,
                reason:
                    "PERSISTED_IDENTITY_NOT_FOUND"
            };
        }

        const age =
            now() -
            Number(record.updatedAt || 0);

        if (
            Number.isFinite(age) &&
            age > MAX_AGE_MS
        ) {
            return {
                recovered: false,
                identityKey:
                    descriptor.key,
                reason:
                    "PERSISTED_IDENTITY_EXPIRED"
            };
        }

        const applied =
            applyRecoveredIdentity(
                track,
                record,
                descriptor
            );

        if (applied) {
            state.recoveredCount += 1;

            if (
                descriptor.method ===
                    "SOURCE_AND_SOURCE_TRACK_ID" ||
                descriptor.method ===
                    "SOURCE_TRACK_ID"
            ) {
                state.matchedBySource += 1;
            } else {
                state.matchedByFallback += 1;
            }

            state.lastRecoverAt = now();
            state.updatedAt =
                state.lastRecoverAt;
        }

        return {
            recovered: applied,
            identityKey:
                record.identityKey,
            identityMethod:
                descriptor.method,
            persistedIdentityMethod:
                record.identityMethod,
            authoritative:
                Boolean(record.authoritative),
            record
        };
    }

    async function recoverTracks(tracks = []) {
        await initialize();

        const list =
            Array.isArray(tracks)
                ? tracks
                : [];

        let recovered = 0;
        let missing = 0;

        const methods = {};
        const sampleRecovered = [];
        const sampleMissing = [];

        for (const track of list) {
            const result =
                await recoverTrack(track);

            if (result.recovered) {
                recovered += 1;

                methods[result.identityMethod] =
                    (methods[result.identityMethod] || 0) + 1;

                if (
                    sampleRecovered.length < 10
                ) {
                    sampleRecovered.push({
                        sourceTrackId:
                            getRealSourceTrackId(track),

                        identityKey:
                            result.identityKey,

                        identityMethod:
                            result.identityMethod
                    });
                }
            } else {
                missing += 1;

                if (
                    sampleMissing.length < 10
                ) {
                    sampleMissing.push({
                        sourceTrackId:
                            getRealSourceTrackId(track),

                        stableId:
                            track?.stableId || null,

                        trackId:
                            track?.trackId || null,

                        reason:
                            result.reason
                    });
                }
            }
        }

        const coverage =
            list.length
                ? (
                    recovered /
                    list.length
                ) * 100
                : 0;

        return {
            success: true,
            status:
                "AUTHORITATIVE_IDENTITY_RECOVERY_COMPLETED",

            phase: PHASE,
            version: VERSION,

            inputCount: list.length,
            recovered,
            missing,

            recoveryRate:
                Number(
                    coverage.toFixed(2)
                ),

            recoveryRateText:
                coverage.toFixed(2) + "%",

            methods,
            sampleRecovered,
            sampleMissing,

            generatedAt: now()
        };
    }

    /*
    -------------------------------------------------------
    Memory protection / pruning
    -------------------------------------------------------
    */

    async function pruneDatabase() {
        const records =
            await getAllRecords();

        if (!records.length) {
            return {
                removed: 0,
                remaining: 0
            };
        }

        const timestamp = now();

        const expired =
            records.filter(record => {
                const updatedAt =
                    Number(record.updatedAt || 0);

                return (
                    updatedAt > 0 &&
                    timestamp - updatedAt >
                        MAX_AGE_MS
                );
            });

        let removed = 0;

        for (const record of expired) {
            if (
                await deleteRecord(
                    record.identityKey
                )
            ) {
                removed += 1;
            }
        }

        let remaining =
            records.length - removed;

        if (remaining > MAX_RECORDS) {
            const currentRecords =
                (await getAllRecords())
                    .sort(
                        (a, b) =>
                            Number(
                                a.updatedAt || 0
                            ) -
                            Number(
                                b.updatedAt || 0
                            )
                    );

            const overflow =
                currentRecords.length -
                MAX_RECORDS;

            for (
                let i = 0;
                i < overflow;
                i += 1
            ) {
                if (
                    await deleteRecord(
                        currentRecords[i]
                            .identityKey
                    )
                ) {
                    removed += 1;
                }
            }

            remaining =
                Math.max(
                    0,
                    currentRecords.length -
                        overflow
                );
        }

        return {
            removed,
            remaining
        };
    }

    /*
    -------------------------------------------------------
    Runtime track discovery
    -------------------------------------------------------
    */

    function discoverRuntimeTracks() {
        const candidates = [
            global.RainArrivalStableTrackIdentityV32
                ?.getAllTracks?.(),

            global.RainArrivalStableTrackIdentityV32
                ?.getTracks?.(),

            global.RainArrivalTrackStoreV32
                ?.getAll?.(),

            global.RainArrivalTrackStoreV32
                ?.getAllTracks?.(),

            global.RainArrivalStormTrackStoreBridgeV32
                ?.getTracks?.(),

            global.RainArrivalStormEntityCollectorV32
                ?.getEntities?.()
        ];

        for (const candidate of candidates) {
            if (
                Array.isArray(candidate) &&
                candidate.length
            ) {
                return candidate;
            }
        }

        /*
        Compatibility with runtime objects where tracks
        are exposed as arrays.
        */

        const possibleArrays = [
            global.RainArrivalStableTrackIdentityV32
                ?.tracks,

            global.RainArrivalTrackStoreV32
                ?.tracks,

            global.RainGuardAI?.V32
                ?.tracks,

            global.RainGuardAI?.V32
                ?.rainArrivalTracks
        ];

        for (const candidate of possibleArrays) {
            if (
                Array.isArray(candidate) &&
                candidate.length
            ) {
                return candidate;
            }
        }

        return [];
    }

    /*
    -------------------------------------------------------
    Cross-reload test helper
    -------------------------------------------------------
    */

    async function crossReloadTest(
        previousIds = []
    ) {
        await initialize();

        const runtimeTracks =
            discoverRuntimeTracks();

        const previous =
            Array.isArray(previousIds)
                ? previousIds
                    .map(normalizeString)
                    .filter(Boolean)
                : [];

        const previousSet =
            new Set(previous);

        let recovered = 0;
        const recoveredIds = [];
        const missingIds = [];

        for (const track of runtimeTracks) {
            const sourceTrackId =
                getRealSourceTrackId(track);

            if (
                sourceTrackId &&
                previousSet.has(
                    sourceTrackId
                )
            ) {
                recovered += 1;
                recoveredIds.push(
                    sourceTrackId
                );
            }
        }

        for (const id of previousSet) {
            if (
                !recoveredIds.includes(id)
            ) {
                missingIds.push(id);
            }
        }

        const denominator =
            previousSet.size;

        const coverage =
            denominator
                ? (
                    recovered /
                    denominator
                ) * 100
                : 0;

        const result = {
            beforeReload:
                denominator,

            currentRuntime:
                runtimeTracks.length,

            recovered,
            missing:
                missingIds.length,

            recoveryRate:
                Number(
                    coverage.toFixed(2)
                ),

            recoveryRateText:
                coverage.toFixed(2) + "%",

            sampleRecovered:
                recoveredIds.slice(0, 10),

            sampleMissing:
                missingIds.slice(0, 10)
        };

        console.log(
            "=== C3-FIX1 CROSS-RELOAD RECOVERY TEST ==="
        );

        console.table(result);
        console.log(result);

        return result;
    }

    /*
    -------------------------------------------------------
    Initialization
    -------------------------------------------------------
    */

    async function initialize() {
        if (state.initialized) {
            return diagnose(false);
        }

        try {
            await openDatabase();

            state.initialized = true;
            state.updatedAt = now();

            const pruneResult =
                await pruneDatabase();

            console.log(
                "[RainGuard][39A-15F6N4B1B3C3][C3-FIX1] Initialized.",
                {
                    version: VERSION,
                    build: BUILD,
                    dbAvailable:
                        state.dbAvailable,
                    pruneResult
                }
            );

            return diagnose(false);
        } catch (error) {
            state.lastError =
                normalizeError(error);

            state.updatedAt = now();

            console.error(
                "[RainGuard][39A-15F6N4B1B3C3][C3-FIX1] Initialization failed.",
                state.lastError
            );

            return diagnose(false);
        }
    }

    /*
    -------------------------------------------------------
    Diagnostics
    -------------------------------------------------------
    */

    function diagnose(log = true) {
        const diagnostics = {
            success:
                state.initialized &&
                state.dbAvailable,

            phase: PHASE,
            version: VERSION,
            build: BUILD,

            initialized:
                state.initialized,

            indexedDBAvailable:
                Boolean(global.indexedDB),

            dbAvailable:
                state.dbAvailable,

            dbName:
                DB_NAME,

            storeName:
                STORE_NAME,

            identityPriority: [
                "source + sourceTrackId",
                "sourceTrackId",
                "source + firstSeenAt + geographic bucket",
                "source + geographic bucket",
                "generated identity LAST RESORT"
            ],

            generatedIdentityPolicy:
                "RST/RG/RainGuard IDs rejected as authoritative source anchors",

            persistedCount:
                state.persistedCount,

            recoveredCount:
                state.recoveredCount,

            matchedBySource:
                state.matchedBySource,

            matchedByFallback:
                state.matchedByFallback,

            rejectedGeneratedIds:
                state.rejectedGeneratedIds,

            lastPersistAt:
                state.lastPersistAt,

            lastRecoverAt:
                state.lastRecoverAt,

            lastError:
                clone(state.lastError),

            createdAt:
                state.createdAt,

            updatedAt:
                state.updatedAt
        };

        if (log) {
            console.log(
                "[RainGuard][39A-15F6N4B1B3C3][C3-FIX1] Diagnostics:",
                diagnostics
            );
        }

        return diagnostics;
    }

    /*
    -------------------------------------------------------
    Public API
    -------------------------------------------------------
    */

    const api = Object.freeze({
        phase: PHASE,
        version: VERSION,
        build: BUILD,

        initialize,

        persistTrack,
        persistTracks,

        recoverTrack,
        recoverTracks,

        buildIdentityDescriptor,
        discoverRuntimeTracks,

        crossReloadTest,

        pruneDatabase,
        diagnose,

        isGeneratedIdentity,
        getRealSourceTrackId
    });

    global.RainGuardAuthoritativeIdentityRecoveryC3 =
        api;

    global.RainGuardAI =
        global.RainGuardAI || {};

    global.RainGuardAI.V39 =
        global.RainGuardAI.V39 || {};

    global.RainGuardAI.V39
        .authoritativeIdentityRecoveryC3 =
        api;

    /*
    Compatibility aliases
    */

    global.RainArrivalAuthoritativeIdentityRecoveryV39 =
        api;

    initialize();

    console.log(
        "[RainGuard AI V39] C3-FIX1 Source-Track Anchored Identity Recovery loaded.",
        {
            phase: PHASE,
            version: VERSION,
            build: BUILD
        }
    );

})(
    typeof globalThis !== "undefined"
        ? globalThis
        : window
);
