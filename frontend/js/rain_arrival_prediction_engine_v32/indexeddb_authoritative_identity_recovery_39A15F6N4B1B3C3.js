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
    const VERSION = "39A.15F6N4B1B3C3.FIX11";
    const BUILD =
        "rainguard-v39-authoritative-identity-recovery-cross-reload-rehydration-fix11";

    const DB_NAME = "RainGuardIdentityRecoveryV39";
    const DB_VERSION = 1;
    const STORE_NAME = "authoritativeIdentities";

    const MAX_RECORDS = 5000;
    const MAX_RUNTIME_TRACKS = 1500;
    const MAX_SCAN_RECORDS = 12000;
    const BATCH_SIZE = 250;
    const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

    const TEMPORAL_MATCH_WINDOW_MS = 15 * 60 * 1000;
    const TEMPORAL_UNIQUENESS_MARGIN_MS = 30 * 1000;
    const TRACK_ID_TIMESTAMP_PATTERN = /^TRACK-(\d{10,16})-/i;

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
        matchedByTemporal: 0,
        ambiguousTemporalFallbacks: 0,
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

    function extractTrackIdTimestamp(value) {
        const text = normalizeString(value);
        if (!text) return null;

        const match = text.match(TRACK_ID_TIMESTAMP_PATTERN);
        if (!match) return null;

        const parsed = Number(match[1]);
        if (!Number.isFinite(parsed)) return null;

        return parsed < 1e12 ? parsed * 1000 : parsed;
    }

    function getEmbeddedTrackTimestamp(track) {
        return (
            extractTrackIdTimestamp(track?.canonicalTrackId) ??
            extractTrackIdTimestamp(track?.trackId) ??
            extractTrackIdTimestamp(track?.stableTrackId) ??
            extractTrackIdTimestamp(track?.stableId) ??
            null
        );
    }

    function getTemporalAnchor(track) {
        return (
            getFirstSeenAt(track) ??
            getEmbeddedTrackTimestamp(track) ??
            null
        );
    }

    function buildTemporalIndex(records = []) {
        const output = [];

        for (const record of records) {
            if (!record || typeof record !== "object") continue;

            const timestamp = getTemporalAnchor(record);
            if (!Number.isFinite(timestamp)) continue;

            output.push({
                record,
                timestamp,
                source: normalizeLower(record?.source || "unknown")
            });
        }

        output.sort((a, b) => a.timestamp - b.timestamp);
        return output;
    }

    function findTemporalFallbackRecord(track, temporalIndex = []) {
        const targetTimestamp = getTemporalAnchor(track);

        if (!Number.isFinite(targetTimestamp)) {
            return {
                record: null,
                reason: "TEMPORAL_ANCHOR_UNAVAILABLE"
            };
        }

        const runtimeSource = getSource(track);
        const candidates = [];

        for (const item of temporalIndex) {
            const delta = Math.abs(item.timestamp - targetTimestamp);

            if (delta > TEMPORAL_MATCH_WINDOW_MS) continue;

            if (
                runtimeSource !== "unknown" &&
                item.source !== "unknown" &&
                runtimeSource !== item.source
            ) {
                continue;
            }

            candidates.push({
                ...item,
                delta
            });
        }

        if (!candidates.length) {
            return {
                record: null,
                reason: "TEMPORAL_CANDIDATE_NOT_FOUND"
            };
        }

        candidates.sort((a, b) => a.delta - b.delta);

        const best = candidates[0];
        const second = candidates[1] || null;

        if (
            second &&
            (second.delta - best.delta) <
                TEMPORAL_UNIQUENESS_MARGIN_MS
        ) {
            return {
                record: null,
                reason: "TEMPORAL_MATCH_AMBIGUOUS",
                bestDeltaMs: best.delta,
                secondDeltaMs: second.delta
            };
        }

        return {
            record: best.record,
            reason: "TEMPORAL_MATCH_UNAMBIGUOUS",
            deltaMs: best.delta
        };
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

    function getAllRecords(limit = MAX_SCAN_RECORDS) {
        return new Promise(resolve => {
            const store = transaction("readonly");

            if (!store) {
                resolve([]);
                return;
            }

            const records = [];
            let finished = false;

            const request = store.openCursor();

            request.onsuccess = event => {
                if (finished) return;

                const cursor = event.target.result;

                if (!cursor || records.length >= limit) {
                    finished = true;
                    resolve(records);
                    return;
                }

                records.push(cursor.value);

                /*
                 FIX11:
                 IndexedDB cursors must continue while the transaction is active.
                 FIX10 yielded with setTimeout every 250 records, which allowed the
                 readonly transaction to auto-close. That made scans appear capped
                 at exactly 250 records even after 1500 successful writes.
                */
                try {
                    cursor.continue();
                } catch (_) {
                    if (!finished) {
                        finished = true;
                        resolve(records);
                    }
                }
            };

            request.onerror = () => {
                if (!finished) {
                    finished = true;
                    resolve(records);
                }
            };
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

    async function persistTracks(tracks) {
        await initialize();

        /*
         FIX10:
         - If no explicit collection is supplied, persist the bounded runtime
           collection discovered by C3 itself.
         - Accept Array / Map / Set / iterable inputs.
         - Never silently convert an omitted argument into an empty write.
        */
        let list;

        if (tracks === undefined || tracks === null) {
            list = discoverRuntimeTracks()
                .slice(0, MAX_RUNTIME_TRACKS);
        } else if (Array.isArray(tracks)) {
            list = tracks.slice(0, MAX_RUNTIME_TRACKS);
        } else if (tracks instanceof Map || tracks instanceof Set) {
            list = Array.from(tracks.values())
                .slice(0, MAX_RUNTIME_TRACKS);
        } else if (
            typeof tracks === "object" &&
            typeof tracks.values === "function"
        ) {
            try {
                list = Array.from(tracks.values())
                    .slice(0, MAX_RUNTIME_TRACKS);
            } catch (_) {
                list = [];
            }
        } else {
            list = [];
        }

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
            attempted: list.length,
            persisted,
            skipped,
            methods,
            persistedCountAfter:
                (await getAllRecords(MAX_RECORDS)).length,

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

    async function recoverTrack(
        track,
        options = {}
    ) {
        const descriptor =
            buildIdentityDescriptor(track);

        if (!descriptor.key) {
            return {
                recovered: false,
                reason: "IDENTITY_KEY_UNAVAILABLE"
            };
        }

        let record =
            await getRecord(descriptor.key);

        let recoveryMethod =
            descriptor.method;

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

            if (fallbackKey !== descriptor.key) {
                record =
                    await getRecord(fallbackKey);

                if (record) {
                    recoveryMethod =
                        "SOURCE_TRACK_ID_COMPATIBILITY";
                }
            }
        }

        let temporalResult = null;

        if (!record) {
            let temporalIndex =
                Array.isArray(options.temporalIndex)
                    ? options.temporalIndex
                    : null;

            if (!temporalIndex) {
                temporalIndex =
                    buildTemporalIndex(
                        await getAllRecords()
                    );
            }

            temporalResult =
                findTemporalFallbackRecord(
                    track,
                    temporalIndex
                );

            if (temporalResult.record) {
                record =
                    temporalResult.record;

                recoveryMethod =
                    "TRACK_ID_TEMPORAL_FALLBACK";
            } else if (
                temporalResult.reason ===
                "TEMPORAL_MATCH_AMBIGUOUS"
            ) {
                state.ambiguousTemporalFallbacks += 1;
            }
        }

        if (!record) {
            return {
                recovered: false,
                identityKey: descriptor.key,
                identityMethod: descriptor.method,
                reason:
                    temporalResult?.reason ||
                    "PERSISTED_IDENTITY_NOT_FOUND",
                temporal:
                    temporalResult
                        ? {
                            bestDeltaMs:
                                temporalResult.bestDeltaMs ?? null,
                            secondDeltaMs:
                                temporalResult.secondDeltaMs ?? null
                        }
                        : null
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
                identityKey: descriptor.key,
                reason: "PERSISTED_IDENTITY_EXPIRED"
            };
        }

        const applied =
            applyRecoveredIdentity(
                track,
                record,
                {
                    ...descriptor,
                    method: recoveryMethod
                }
            );

        if (applied) {
            state.recoveredCount += 1;

            if (
                recoveryMethod ===
                    "SOURCE_AND_SOURCE_TRACK_ID" ||
                recoveryMethod ===
                    "SOURCE_TRACK_ID" ||
                recoveryMethod ===
                    "SOURCE_TRACK_ID_COMPATIBILITY"
            ) {
                state.matchedBySource += 1;
            } else if (
                recoveryMethod ===
                "TRACK_ID_TEMPORAL_FALLBACK"
            ) {
                state.matchedByTemporal += 1;
            } else {
                state.matchedByFallback += 1;
            }

            state.lastRecoverAt = now();
            state.updatedAt = state.lastRecoverAt;
        }

        return {
            recovered: applied,
            identityKey: record.identityKey,
            identityMethod: recoveryMethod,
            persistedIdentityMethod:
                record.identityMethod,
            authoritative:
                Boolean(record.authoritative),
            temporalDeltaMs:
                temporalResult?.deltaMs ?? null,
            record
        };
    }

    async function recoverTracks(tracks) {
        await initialize();

        /*
         FIX11:
         Recover the bounded live runtime automatically when the caller does
         not explicitly provide tracks. FIX10 silently recovered an empty list
         when called as recoverTracks().
        */
        let list;

        if (tracks === undefined || tracks === null) {
            list = discoverRuntimeTracks()
                .slice(0, MAX_RUNTIME_TRACKS);
        } else if (Array.isArray(tracks)) {
            list = tracks.slice(0, MAX_RUNTIME_TRACKS);
        } else if (tracks instanceof Map || tracks instanceof Set) {
            list = Array.from(tracks.values())
                .slice(0, MAX_RUNTIME_TRACKS);
        } else if (
            typeof tracks === "object" &&
            typeof tracks.values === "function"
        ) {
            try {
                list = Array.from(tracks.values())
                    .slice(0, MAX_RUNTIME_TRACKS);
            } catch (_) {
                list = [];
            }
        } else {
            list = [];
        }

        let recovered = 0;
        let missing = 0;

        const temporalIndex =
            buildTemporalIndex(
                await getAllRecords()
            );

        const methods = {};
        const sampleRecovered = [];
        const sampleMissing = [];

        for (const track of list) {
            const result =
                await recoverTrack(
                    track,
                    { temporalIndex }
                );

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
            recoveredCount: recovered,
            missing,
            missingCount: missing,
            scannedPersistedCount: temporalIndex.length,
            scanLimited:
                temporalIndex.length >= MAX_SCAN_RECORDS,

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
        const MAX =
            typeof MAX_RUNTIME_TRACKS === "number"
                ? MAX_RUNTIME_TRACKS
                : 1500;

        const sources = [
            global.RainArrivalStormEntitySourceAdapterV32
                ?.capturedEntities,

            global.RainArrivalTrackStoreV32
                ?.tracks,

            global.RainArrivalStormTrackStoreBridgeV32
                ?.tracks,

            global.RainArrivalStormEntitySourceAdapterV32
                ?.entities,

            global.RainArrivalLiveStormEntities,

            global.RainArrivalStormEntitySourceAdapterV32
                ?.store,

            global.RainArrivalStormTrackStoreBridgeV32
                ?.entities,

            global.RainArrivalStormTrackStoreBridgeV32
                ?.store,

            global.RainArrivalTrackStoreV32
                ?.entities,

            global.RainArrivalTrackStoreV32
                ?.store,

            global.RainGuardAI?.V32
                ?.tracks,

            global.RainGuardAI?.V32
                ?.rainArrivalTracks
        ];

        const out = [];
        const seenObjects = new Set();
        const seenIdentityKeys = new Set();

        function valuesOf(source) {
            if (!source) return [];

            if (Array.isArray(source)) {
                return source;
            }

            if (source instanceof Map) {
                return source.values();
            }

            if (source instanceof Set) {
                return source.values();
            }

            if (
                typeof source === "object" &&
                typeof source.values === "function"
            ) {
                try {
                    return source.values();
                } catch (_) {}
            }

            if (typeof source === "object") {
                return Object.values(source);
            }

            return [];
        }

        function identityKey(track) {
            if (!track || typeof track !== "object") {
                return "";
            }

            const source =
                normalizeString(
                    track.source ||
                    track.provider ||
                    track.sourceName
                );

            const sourceTrackId =
                normalizeString(
                    track.sourceTrackId ||
                    track.sourceId ||
                    track.externalTrackId
                );

            const canonicalTrackId =
                normalizeString(
                    track.canonicalTrackId ||
                    track.canonicalId
                );

            const stableId =
                normalizeString(
                    track.stableId ||
                    track.stableTrackId
                );

            const trackId =
                normalizeString(
                    track.trackId ||
                    track.id
                );

            const id =
                sourceTrackId ||
                canonicalTrackId ||
                stableId ||
                trackId;

            return id
                ? `${source || "unknown"}|${id}`
                : "";
        }

        for (const source of sources) {
            const values = valuesOf(source);

            for (const track of values) {
                if (
                    !track ||
                    typeof track !== "object"
                ) {
                    continue;
                }

                if (seenObjects.has(track)) {
                    continue;
                }

                seenObjects.add(track);

                const key = identityKey(track);

                if (
                    key &&
                    seenIdentityKeys.has(key)
                ) {
                    continue;
                }

                if (key) {
                    seenIdentityKeys.add(key);
                }

                out.push(track);

                if (out.length >= MAX) {
                    return out;
                }
            }
        }

        return out;
    }

    /*
    -------------------------------------------------------
    Cross-reload test helper
    -------------------------------------------------------
    */

    const CROSS_RELOAD_KEY = "RG_C3_FIX11_PRE_RELOAD";

    function buildCrossReloadSnapshot() {
        const tracks = discoverRuntimeTracks().slice(0, MAX_RUNTIME_TRACKS);
        const seen = new Set();
        const identities = [];

        for (const track of tracks) {
            const descriptor = buildIdentityDescriptor(track);
            if (!descriptor) continue;

            const sourceTrackId =
                normalizeString(descriptor.sourceTrackId);

            const canonicalTrackId =
                normalizeString(
                    track?.canonicalTrackId ||
                    track?.stableTrackId ||
                    track?.trackId ||
                    track?.id
                );

            const key =
                sourceTrackId ||
                canonicalTrackId ||
                normalizeString(descriptor.key);

            if (!key || seen.has(key)) continue;

            seen.add(key);

            identities.push({
                sourceTrackId,
                canonicalTrackId,
                identityKey:
                    normalizeString(descriptor.key)
            });

            if (identities.length >= MAX_RUNTIME_TRACKS) {
                break;
            }
        }

        return identities;
    }

    async function crossReloadTest() {
        await initialize();

        let previous = null;

        try {
            const raw =
                global.sessionStorage
                    ?.getItem(CROSS_RELOAD_KEY);

            if (raw) {
                previous = JSON.parse(raw);
            }
        } catch (_) {}

        if (
            !previous ||
            !Array.isArray(previous.identities) ||
            !previous.identities.length
        ) {
            const identities =
                buildCrossReloadSnapshot();

            const persistResult =
                await persistTracks(
                    discoverRuntimeTracks()
                        .slice(0, MAX_RUNTIME_TRACKS)
                );

            const snapshot = {
                schema: 1,
                stage: "PRE_RELOAD",
                phase: PHASE,
                version: VERSION,
                build: BUILD,
                time: Date.now(),
                count: identities.length,
                identities
            };

            try {
                global.sessionStorage
                    ?.setItem(
                        CROSS_RELOAD_KEY,
                        JSON.stringify(snapshot)
                    );
            } catch (error) {
                return {
                    success: false,
                    status:
                        "C3_FIX11_PRE_RELOAD_STORAGE_FAILED",
                    phase: PHASE,
                    version: VERSION,
                    error:
                        error?.message ||
                        String(error)
                };
            }

            return {
                success: false,
                readyForReload: true,
                status:
                    "C3_FIX11_PRE_RELOAD_READY",
                phase: PHASE,
                version: VERSION,
                build: BUILD,
                beforeCount:
                    identities.length,
                snapshotKey:
                    CROSS_RELOAD_KEY,
                persistSuccess:
                    Boolean(persistResult?.success)
            };
        }

        const recoveryResult =
            await recoverTracks(
                discoverRuntimeTracks()
                    .slice(0, MAX_RUNTIME_TRACKS)
            );

        const current =
            buildCrossReloadSnapshot();

        const sourceIds = new Set();
        const canonicalIds = new Set();
        const identityKeys = new Set();

        for (const item of current) {
            if (item.sourceTrackId) {
                sourceIds.add(item.sourceTrackId);
            }

            if (item.canonicalTrackId) {
                canonicalIds.add(
                    item.canonicalTrackId
                );
            }

            if (item.identityKey) {
                identityKeys.add(
                    item.identityKey
                );
            }
        }

        let matched = 0;
        const sampleMatched = [];
        const sampleMissing = [];

        for (
            const item of
            previous.identities
                .slice(0, MAX_RUNTIME_TRACKS)
        ) {
            const hit =
                (
                    item.sourceTrackId &&
                    (
                        sourceIds.has(
                            item.sourceTrackId
                        ) ||
                        canonicalIds.has(
                            item.sourceTrackId
                        )
                    )
                ) ||
                (
                    item.canonicalTrackId &&
                    (
                        canonicalIds.has(
                            item.canonicalTrackId
                        ) ||
                        sourceIds.has(
                            item.canonicalTrackId
                        )
                    )
                ) ||
                (
                    item.identityKey &&
                    identityKeys.has(
                        item.identityKey
                    )
                );

            const sample =
                item.sourceTrackId ||
                item.canonicalTrackId ||
                item.identityKey;

            if (hit) {
                matched += 1;

                if (
                    sampleMatched.length < 10
                ) {
                    sampleMatched.push(sample);
                }
            } else if (
                sampleMissing.length < 10
            ) {
                sampleMissing.push(sample);
            }
        }

        const beforeCount =
            Math.min(
                previous.identities.length,
                MAX_RUNTIME_TRACKS
            );

        const missing =
            Math.max(
                0,
                beforeCount - matched
            );

        const continuityPercent =
            beforeCount
                ? Number(
                    (
                        matched /
                        beforeCount *
                        100
                    ).toFixed(2)
                )
                : 0;

        try {
            global.sessionStorage
                ?.removeItem(
                    CROSS_RELOAD_KEY
                );
        } catch (_) {}

        return {
            success: true,
            status:
                "C3_FIX11_POST_RELOAD_COMPLETE",
            phase: PHASE,
            version: VERSION,
            build: BUILD,
            memorySafe: true,

            dbName: DB_NAME,
            storeName: STORE_NAME,

            beforeCount,
            afterCount:
                current.length,

            matched,
            missing,
            continuityPercent,

            recoverySuccess:
                Boolean(
                    recoveryResult?.success
                ),

            recoveredCount:
                recoveryResult?.recovered ??
                recoveryResult?.recoveredCount ??
                0,

            sampleMatched,
            sampleMissing
        };
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
                "[RainGuard][39A-15F6N4B1B3C3][C3-FIX11] Initialized.",
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
                "[RainGuard][39A-15F6N4B1B3C3][C3-FIX11] Initialization failed.",
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

            memorySafe: true,
            dbName: DB_NAME,
            storeName: STORE_NAME,
            maxRuntimeTracks: MAX_RUNTIME_TRACKS,
            maxScanRecords: MAX_SCAN_RECORDS,
            batchSize: BATCH_SIZE,

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
                "guarded TRACK-* temporal fallback",
                "generated identity LAST RESORT"
            ],

            generatedIdentityPolicy:
                "RST/RG/RainGuard IDs rejected as authoritative source anchors",

            persistedCount:
                state.persistedCount,

            sessionPersistedCount:
                state.persistedCount,

            recoveredCount:
                state.recoveredCount,

            matchedBySource:
                state.matchedBySource,

            matchedByFallback:
                state.matchedByFallback,

            matchedByTemporal:
                state.matchedByTemporal,

            ambiguousTemporalFallbacks:
                state.ambiguousTemporalFallbacks,

            temporalFallbackPolicy: {
                enabled: true,
                windowMs:
                    TEMPORAL_MATCH_WINDOW_MS,
                uniquenessMarginMs:
                    TEMPORAL_UNIQUENESS_MARGIN_MS,
                ambiguousMatchesRejected:
                    true
            },

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
                "[RainGuard][39A-15F6N4B1B3C3][C3-FIX11] Diagnostics:",
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

        extractTrackIdTimestamp,
        getEmbeddedTrackTimestamp,
        getTemporalAnchor,
        buildTemporalIndex,
        findTemporalFallbackRecord,
        getAllRecords,

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
        "[RainGuard AI V39] C3-FIX11 IndexedDB Store Compatibility loaded.",
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
