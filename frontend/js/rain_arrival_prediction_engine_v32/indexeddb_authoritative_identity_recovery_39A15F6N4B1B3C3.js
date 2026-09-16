/*
===========================================================
 RainGuard AI V39
 Phase 39A-15F6N4B1B3C3 — C3-FIX5

 Authoritative Identity Recovery
 Cross-Reload Continuity + Guarded Temporal/Spatial Recovery

 FIX5:
 - Preserve FIX4 sourceTrackId-first recovery.
 - Recover when runtime TRACK-* IDs are regenerated after reload.
 - Use bounded temporal + geographic scoring.
 - Reject ambiguous candidates.
 - Do not use generated RST/RG/RainGuard IDs as authoritative anchors.
 - Avoid unbounded runtime/database memory growth.
===========================================================
*/

(function initializeAuthoritativeIdentityRecoveryC3(global) {
    "use strict";

    const PHASE = "39A-15F6N4B1B3C3";
    const VERSION = "39A.15F6N4B1B3C3.FIX5";
    const BUILD =
        "rainguard-v39-authoritative-identity-recovery-cross-reload-fix5";

    const DB_NAME = "RainGuardIdentityRecoveryV39";
    const DB_VERSION = 1;
    const STORE_NAME = "authoritativeIdentities";

    const MAX_RECORDS = 5000;
    const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

    const TEMPORAL_MATCH_WINDOW_MS = 20 * 60 * 1000;
    const TEMPORAL_UNIQUENESS_MARGIN_MS = 30 * 1000;
    const SPATIAL_MATCH_WINDOW_KM = 35;
    const SPATIAL_UNIQUENESS_MARGIN_KM = 1.5;
    const MAX_RECOVERY_INDEX_RECORDS = 5000;
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
        matchedByTemporalSpatial: 0,
        ambiguousTemporalFallbacks: 0,
        rejectedGeneratedIds: 0,
        lastPersistAt: null,
        lastRecoverAt: null,
        lastError: null,
        createdAt: Date.now(),
        updatedAt: Date.now()
    };

    function now() { return Date.now(); }

    function normalizeString(value) {
        if (value === null || value === undefined) return "";
        return String(value).trim().replace(/\s+/g, " ");
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
            try { return structuredClone(value); } catch (_) {}
        }
        try { return JSON.parse(JSON.stringify(value)); }
        catch (_) { return value; }
    }

    function isGeneratedIdentity(value) {
        const text = normalizeString(value);
        if (!text) return false;
        return (
            /^RST-/i.test(text) ||
            /^RG-/i.test(text) ||
            /^RainGuard-/i.test(text)
        );
    }

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

    function parseTime(value) {
        if (value === null || value === undefined || value === "") return null;
        if (typeof value === "number" && Number.isFinite(value)) return value;
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
        return getFirstSeenAt(track) ?? getEmbeddedTrackTimestamp(track) ?? null;
    }

    function haversineKm(lat1, lon1, lat2, lon2) {
        if ([lat1, lon1, lat2, lon2].some(v => !Number.isFinite(v))) return null;
        const toRad = value => value * Math.PI / 180;
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a =
            Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) *
            Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) ** 2;
        return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    function buildTemporalIndex(records = []) {
        const output = [];
        const bounded = Array.isArray(records)
            ? records.slice(-MAX_RECOVERY_INDEX_RECORDS)
            : [];

        for (const record of bounded) {
            if (!record || typeof record !== "object") continue;
            const timestamp = getTemporalAnchor(record);
            if (!Number.isFinite(timestamp)) continue;
            output.push({
                record,
                timestamp,
                source: normalizeLower(record?.source || "unknown"),
                latitude: getLatitude(record),
                longitude: getLongitude(record)
            });
        }

        output.sort((a, b) => a.timestamp - b.timestamp);
        return output;
    }

    function findTemporalFallbackRecord(track, temporalIndex = []) {
        const targetTimestamp = getTemporalAnchor(track);
        if (!Number.isFinite(targetTimestamp)) {
            return { record: null, reason: "TEMPORAL_ANCHOR_UNAVAILABLE" };
        }

        const runtimeSource = getSource(track);
        const targetLat = getLatitude(track);
        const targetLon = getLongitude(track);
        const hasCoordinates =
            Number.isFinite(targetLat) && Number.isFinite(targetLon);

        const candidates = [];

        for (const item of temporalIndex) {
            const delta = Math.abs(item.timestamp - targetTimestamp);
            if (delta > TEMPORAL_MATCH_WINDOW_MS) continue;

            if (
                runtimeSource !== "unknown" &&
                item.source !== "unknown" &&
                runtimeSource !== item.source
            ) continue;

            let distanceKm = null;
            if (
                hasCoordinates &&
                Number.isFinite(item.latitude) &&
                Number.isFinite(item.longitude)
            ) {
                distanceKm = haversineKm(
                    targetLat, targetLon,
                    item.latitude, item.longitude
                );
                if (
                    Number.isFinite(distanceKm) &&
                    distanceKm > SPATIAL_MATCH_WINDOW_KM
                ) continue;
            }

            const timeScore = delta / TEMPORAL_MATCH_WINDOW_MS;
            const spatialScore = Number.isFinite(distanceKm)
                ? distanceKm / SPATIAL_MATCH_WINDOW_KM
                : 0.5;

            candidates.push({
                ...item,
                delta,
                distanceKm,
                score: timeScore + spatialScore
            });
        }

        if (!candidates.length) {
            return { record: null, reason: "TEMPORAL_SPATIAL_CANDIDATE_NOT_FOUND" };
        }

        candidates.sort((a, b) => a.score - b.score);

        const best = candidates[0];
        const second = candidates[1] || null;

        if (second) {
            const timeTooClose =
                Math.abs(second.delta - best.delta) <
                TEMPORAL_UNIQUENESS_MARGIN_MS;

            const bothSpatial =
                Number.isFinite(best.distanceKm) &&
                Number.isFinite(second.distanceKm);

            const spatialTooClose =
                bothSpatial &&
                Math.abs(second.distanceKm - best.distanceKm) <
                SPATIAL_UNIQUENESS_MARGIN_KM;

            const scoreTooClose =
                Math.abs(second.score - best.score) < 0.05;

            if ((timeTooClose && spatialTooClose) || scoreTooClose) {
                return {
                    record: null,
                    reason: "TEMPORAL_SPATIAL_MATCH_AMBIGUOUS",
                    bestDeltaMs: best.delta,
                    secondDeltaMs: second.delta,
                    bestDistanceKm: best.distanceKm,
                    secondDistanceKm: second.distanceKm
                };
            }
        }

        return {
            record: best.record,
            reason: "TEMPORAL_SPATIAL_MATCH_UNAMBIGUOUS",
            deltaMs: best.delta,
            distanceKm: best.distanceKm
        };
    }

    function coordinateBucket(track, precision = 1) {
        const latitude = getLatitude(track);
        const longitude = getLongitude(track);
        if (latitude === null || longitude === null) return "";
        return latitude.toFixed(precision) + ":" + longitude.toFixed(precision);
    }

    function hashString(input) {
        const text = String(input || "");
        let hash = 2166136261;
        for (let i = 0; i < text.length; i += 1) {
            hash ^= text.charCodeAt(i);
            hash = Math.imul(hash, 16777619);
        }
        return (hash >>> 0).toString(36);
    }

    function buildIdentityDescriptor(track) {
        if (!track || typeof track !== "object") {
            return { key: "", method: "INVALID_TRACK", authoritative: false };
        }

        const source = getSource(track);
        const sourceTrackId = getRealSourceTrackId(track);

        if (sourceTrackId) {
            const normalizedSourceTrackId = normalizeLower(sourceTrackId);
            if (source && source !== "unknown") {
                const rawKey = source + "|" + normalizedSourceTrackId;
                return {
                    key: "SRC:" + hashString(rawKey),
                    rawKey,
                    method: "SOURCE_AND_SOURCE_TRACK_ID",
                    authoritative: true,
                    source,
                    sourceTrackId
                };
            }

            return {
                key: "SID:" + hashString(normalizedSourceTrackId),
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
            const timeBucket = Math.floor(firstSeenAt / (30 * 60 * 1000));
            const rawKey = source + "|" + timeBucket + "|" + bucket;
            return {
                key: "STG:" + hashString(rawKey),
                rawKey,
                method: "SOURCE_TIME_GEOGRAPHIC_FALLBACK",
                authoritative: false,
                source,
                sourceTrackId: ""
            };
        }

        if (bucket) {
            const rawKey = source + "|" + bucket;
            return {
                key: "GEO:" + hashString(rawKey),
                rawKey,
                method: "SOURCE_GEOGRAPHIC_FALLBACK",
                authoritative: false,
                source,
                sourceTrackId: ""
            };
        }

        const generatedId = getGeneratedTrackId(track);
        if (generatedId) {
            return {
                key: "GEN:" + hashString(generatedId),
                rawKey: generatedId,
                method: "GENERATED_ID_LAST_RESORT",
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

    function openDatabase() {
        if (!global.indexedDB) {
            state.dbAvailable = false;
            return Promise.resolve(null);
        }
        if (state.db) return Promise.resolve(state.db);

        return new Promise((resolve, reject) => {
            const request = global.indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = event => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    const store = db.createObjectStore(
                        STORE_NAME,
                        { keyPath: "identityKey" }
                    );
                    store.createIndex("updatedAt", "updatedAt", { unique: false });
                    store.createIndex("sourceTrackId", "sourceTrackId", { unique: false });
                }
            };

            request.onsuccess = () => {
                state.db = request.result;
                state.dbAvailable = true;
                state.db.onversionchange = () => {
                    try { state.db.close(); } catch (_) {}
                    state.db = null;
                };
                resolve(state.db);
            };

            request.onerror = () => {
                state.dbAvailable = false;
                reject(request.error || new Error("IDENTITY_RECOVERY_DB_OPEN_FAILED"));
            };
        });
    }

    function transaction(mode = "readonly") {
        if (!state.db) return null;
        return state.db.transaction(STORE_NAME, mode).objectStore(STORE_NAME);
    }

    function getRecord(identityKey) {
        return new Promise(resolve => {
            const store = transaction("readonly");
            if (!store || !identityKey) return resolve(null);
            const request = store.get(identityKey);
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => resolve(null);
        });
    }

    function putRecord(record) {
        return new Promise(resolve => {
            const store = transaction("readwrite");
            if (!store) return resolve(false);
            const request = store.put(record);
            request.onsuccess = () => resolve(true);
            request.onerror = () => resolve(false);
        });
    }

    function getAllRecords() {
        return new Promise(resolve => {
            const store = transaction("readonly");
            if (!store) return resolve([]);
            const request = store.getAll();
            request.onsuccess = () => resolve(
                Array.isArray(request.result) ? request.result : []
            );
            request.onerror = () => resolve([]);
        });
    }

    function deleteRecord(identityKey) {
        return new Promise(resolve => {
            const store = transaction("readwrite");
            if (!store) return resolve(false);
            const request = store.delete(identityKey);
            request.onsuccess = () => resolve(true);
            request.onerror = () => resolve(false);
        });
    }

    async function persistTrack(track) {
        const descriptor = buildIdentityDescriptor(track);
        if (!descriptor.key) {
            return { success: false, reason: "IDENTITY_KEY_UNAVAILABLE" };
        }

        const timestamp = now();
        const existing = await getRecord(descriptor.key);

        const record = {
            identityKey: descriptor.key,
            identityMethod: descriptor.method,
            authoritative: descriptor.authoritative,
            source: descriptor.source || "",
            sourceTrackId: descriptor.sourceTrackId || "",
            stableId: normalizeString(track?.stableId),
            stableTrackId: normalizeString(track?.stableTrackId),
            trackId: normalizeString(track?.trackId),
            canonicalTrackId: normalizeString(track?.canonicalTrackId),
            latitude: getLatitude(track),
            longitude: getLongitude(track),
            coordinate: clone(track?.coordinate),
            firstSeenAt: getFirstSeenAt(track),
            observedAt: track?.observedAt ?? null,
            lastSeenAt: track?.lastSeenAt ?? null,
            intensity: track?.intensity ?? null,
            confidence: track?.confidence ?? null,
            matchMethod: track?.matchMethod ?? null,
            matchDistanceKm: track?.matchDistanceKm ?? null,
            raw: clone(track?.raw),
            createdAt: existing?.createdAt || timestamp,
            updatedAt: timestamp,
            seenCount: (existing?.seenCount || 0) + 1
        };

        const success = await putRecord(record);

        if (success) {
            state.persistedCount += 1;
            state.lastPersistAt = timestamp;
            state.updatedAt = timestamp;
        }

        return {
            success,
            identityKey: descriptor.key,
            identityMethod: descriptor.method,
            authoritative: descriptor.authoritative,
            record
        };
    }

    async function persistTracks(tracks = []) {
        await initialize();
        const list = Array.isArray(tracks) ? tracks : [];
        let persisted = 0;
        let skipped = 0;
        const methods = {};

        for (const track of list) {
            const result = await persistTrack(track);
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
            status: "AUTHORITATIVE_IDENTITIES_PERSISTED",
            phase: PHASE,
            version: VERSION,
            inputCount: list.length,
            persisted,
            skipped,
            methods,
            generatedAt: now()
        };
    }

    function applyRecoveredIdentity(track, record, descriptor) {
        if (!track || !record) return false;

        if (
            record.stableId &&
            (!track.stableId || isGeneratedIdentity(track.stableId))
        ) track.stableId = record.stableId;

        if (
            record.stableTrackId &&
            (!track.stableTrackId || isGeneratedIdentity(track.stableTrackId))
        ) track.stableTrackId = record.stableTrackId;

        /*
         FIX5: canonical TRACK-* values may be regenerated on reload.
         A persisted canonical identity is restored when the recovery
         candidate was independently validated by source or temporal/spatial match.
        */
        if (
            record.canonicalTrackId &&
            (
                !track.canonicalTrackId ||
                isGeneratedIdentity(track.canonicalTrackId) ||
                /^TRACK-/i.test(normalizeString(track.canonicalTrackId))
            )
        ) {
            track.canonicalTrackId = record.canonicalTrackId;
        }

        if (
            !getRealSourceTrackId(track) &&
            record.sourceTrackId &&
            !isGeneratedIdentity(record.sourceTrackId)
        ) {
            track.sourceTrackId = record.sourceTrackId;
        }

        track.identityRecovery = {
            recovered: true,
            identityKey: record.identityKey,
            identityMethod: descriptor.method,
            persistedIdentityMethod: record.identityMethod,
            authoritative: Boolean(record.authoritative),
            recoveredAt: now(),
            version: VERSION
        };

        return true;
    }

    async function recoverTrack(track, options = {}) {
        const descriptor = buildIdentityDescriptor(track);
        if (!descriptor.key) {
            return { recovered: false, reason: "IDENTITY_KEY_UNAVAILABLE" };
        }

        let record = await getRecord(descriptor.key);
        let recoveryMethod = descriptor.method;

        if (!record && descriptor.sourceTrackId) {
            const fallbackKey =
                "SID:" + hashString(normalizeLower(descriptor.sourceTrackId));

            if (fallbackKey !== descriptor.key) {
                record = await getRecord(fallbackKey);
                if (record) recoveryMethod = "SOURCE_TRACK_ID_COMPATIBILITY";
            }
        }

        let temporalResult = null;

        if (!record) {
            let temporalIndex =
                Array.isArray(options.temporalIndex)
                    ? options.temporalIndex
                    : buildTemporalIndex(await getAllRecords());

            temporalResult = findTemporalFallbackRecord(track, temporalIndex);

            if (temporalResult.record) {
                record = temporalResult.record;
                recoveryMethod = Number.isFinite(temporalResult.distanceKm)
                    ? "TRACK_ID_TEMPORAL_SPATIAL_FALLBACK"
                    : "TRACK_ID_TEMPORAL_FALLBACK";
            } else if (
                temporalResult.reason === "TEMPORAL_SPATIAL_MATCH_AMBIGUOUS"
            ) {
                state.ambiguousTemporalFallbacks += 1;
            }
        }

        if (!record) {
            return {
                recovered: false,
                identityKey: descriptor.key,
                identityMethod: descriptor.method,
                reason: temporalResult?.reason || "PERSISTED_IDENTITY_NOT_FOUND"
            };
        }

        const age = now() - Number(record.updatedAt || 0);
        if (Number.isFinite(age) && age > MAX_AGE_MS) {
            return {
                recovered: false,
                identityKey: descriptor.key,
                reason: "PERSISTED_IDENTITY_EXPIRED"
            };
        }

        const applied = applyRecoveredIdentity(
            track,
            record,
            { ...descriptor, method: recoveryMethod }
        );

        if (applied) {
            state.recoveredCount += 1;

            if (
                recoveryMethod === "SOURCE_AND_SOURCE_TRACK_ID" ||
                recoveryMethod === "SOURCE_TRACK_ID" ||
                recoveryMethod === "SOURCE_TRACK_ID_COMPATIBILITY"
            ) state.matchedBySource += 1;
            else if (recoveryMethod === "TRACK_ID_TEMPORAL_SPATIAL_FALLBACK")
                state.matchedByTemporalSpatial += 1;
            else if (recoveryMethod === "TRACK_ID_TEMPORAL_FALLBACK")
                state.matchedByTemporal += 1;
            else state.matchedByFallback += 1;

            state.lastRecoverAt = now();
            state.updatedAt = state.lastRecoverAt;
        }

        return {
            recovered: applied,
            identityKey: record.identityKey,
            identityMethod: recoveryMethod,
            persistedIdentityMethod: record.identityMethod,
            authoritative: Boolean(record.authoritative),
            temporalDeltaMs: temporalResult?.deltaMs ?? null,
            spatialDistanceKm: temporalResult?.distanceKm ?? null,
            record
        };
    }

    async function recoverTracks(tracks = []) {
        await initialize();
        const list = Array.isArray(tracks) ? tracks : [];
        let recovered = 0;
        let missing = 0;
        const temporalIndex = buildTemporalIndex(await getAllRecords());
        const methods = {};
        const sampleRecovered = [];
        const sampleMissing = [];

        for (const track of list) {
            const result = await recoverTrack(track, { temporalIndex });

            if (result.recovered) {
                recovered += 1;
                methods[result.identityMethod] =
                    (methods[result.identityMethod] || 0) + 1;

                if (sampleRecovered.length < 10) {
                    sampleRecovered.push({
                        sourceTrackId: getRealSourceTrackId(track),
                        identityKey: result.identityKey,
                        identityMethod: result.identityMethod,
                        temporalDeltaMs: result.temporalDeltaMs ?? null,
                        spatialDistanceKm: result.spatialDistanceKm ?? null
                    });
                }
            } else {
                missing += 1;
                if (sampleMissing.length < 10) {
                    sampleMissing.push({
                        sourceTrackId: getRealSourceTrackId(track),
                        stableId: track?.stableId || null,
                        trackId: track?.trackId || null,
                        reason: result.reason
                    });
                }
            }
        }

        const coverage = list.length ? (recovered / list.length) * 100 : 0;

        return {
            success: true,
            status: "AUTHORITATIVE_IDENTITY_RECOVERY_COMPLETED",
            phase: PHASE,
            version: VERSION,
            inputCount: list.length,
            recovered,
            missing,
            recoveryRate: Number(coverage.toFixed(2)),
            recoveryRateText: coverage.toFixed(2) + "%",
            methods,
            sampleRecovered,
            sampleMissing,
            generatedAt: now()
        };
    }

    async function pruneDatabase() {
        const records = await getAllRecords();
        if (!records.length) return { removed: 0, remaining: 0 };

        const timestamp = now();
        let removed = 0;

        for (const record of records) {
            const updatedAt = Number(record.updatedAt || 0);
            if (
                updatedAt > 0 &&
                timestamp - updatedAt > MAX_AGE_MS &&
                await deleteRecord(record.identityKey)
            ) removed += 1;
        }

        let currentRecords = records.length - removed;

        if (currentRecords > MAX_RECORDS) {
            const remaining = (await getAllRecords()).sort(
                (a, b) => Number(a.updatedAt || 0) - Number(b.updatedAt || 0)
            );
            const overflow = remaining.length - MAX_RECORDS;

            for (let i = 0; i < overflow; i += 1) {
                if (await deleteRecord(remaining[i].identityKey)) removed += 1;
            }
            currentRecords = Math.max(0, remaining.length - overflow);
        }

        return { removed, remaining: currentRecords };
    }

    function discoverRuntimeTracks() {
        const candidates = [
            global.RainArrivalStableTrackIdentityV32?.getAllTracks?.(),
            global.RainArrivalStableTrackIdentityV32?.getTracks?.(),
            global.RainArrivalTrackStoreV32?.getAll?.(),
            global.RainArrivalTrackStoreV32?.getAllTracks?.(),
            global.RainArrivalStormTrackStoreBridgeV32?.getTracks?.(),
            global.RainArrivalStormEntityCollectorV32?.getEntities?.()
        ];

        for (const candidate of candidates) {
            if (Array.isArray(candidate) && candidate.length) return candidate;
            if (candidate instanceof Map && candidate.size)
                return Array.from(candidate.values()).slice(0, 1000);
        }

        const possible = [
            global.RainArrivalStableTrackIdentityV32?.tracks,
            global.RainArrivalTrackStoreV32?.tracks,
            global.RainGuardAI?.V32?.tracks,
            global.RainGuardAI?.V32?.rainArrivalTracks,
            global.RainArrivalLiveStormEntities
        ];

        for (const candidate of possible) {
            if (Array.isArray(candidate) && candidate.length) return candidate;
            if (candidate instanceof Map && candidate.size)
                return Array.from(candidate.values()).slice(0, 1000);
        }

        return [];
    }

    async function crossReloadTest(previousIds = []) {
        await initialize();

        const runtimeTracks = discoverRuntimeTracks();
        const previous = Array.isArray(previousIds)
            ? previousIds.map(normalizeString).filter(Boolean)
            : [];

        const previousSet = new Set(previous);
        const currentIds = new Set();

        for (const track of runtimeTracks) {
            const values = [
                getRealSourceTrackId(track),
                normalizeString(track?.canonicalTrackId),
                normalizeString(track?.stableTrackId),
                normalizeString(track?.stableId),
                normalizeString(track?.trackId)
            ].filter(Boolean);

            for (const value of values) currentIds.add(value);
        }

        const recoveredIds = [];
        const missingIds = [];

        for (const id of previousSet) {
            if (currentIds.has(id)) recoveredIds.push(id);
            else missingIds.push(id);
        }

        const denominator = previousSet.size;
        const coverage = denominator
            ? (recoveredIds.length / denominator) * 100
            : 0;

        const result = {
            beforeReload: denominator,
            currentRuntime: runtimeTracks.length,
            recovered: recoveredIds.length,
            missing: missingIds.length,
            recoveryRate: Number(coverage.toFixed(2)),
            recoveryRateText: coverage.toFixed(2) + "%",
            sampleRecovered: recoveredIds.slice(0, 10),
            sampleMissing: missingIds.slice(0, 10)
        };

        console.log("=== C3-FIX5 CROSS-RELOAD RECOVERY TEST ===");
        console.table(result);
        return result;
    }

    async function initialize() {
        if (state.initialized) return diagnose(false);

        try {
            await openDatabase();
            state.initialized = true;
            state.updatedAt = now();
            const pruneResult = await pruneDatabase();

            console.log(
                "[RainGuard][39A-15F6N4B1B3C3][C3-FIX5] Initialized.",
                { version: VERSION, build: BUILD, dbAvailable: state.dbAvailable, pruneResult }
            );
            return diagnose(false);
        } catch (error) {
            state.lastError = normalizeError(error);
            state.updatedAt = now();
            console.error(
                "[RainGuard][39A-15F6N4B1B3C3][C3-FIX5] Initialization failed.",
                state.lastError
            );
            return diagnose(false);
        }
    }

    function diagnose(log = true) {
        const diagnostics = {
            success: state.initialized && state.dbAvailable,
            phase: PHASE,
            version: VERSION,
            build: BUILD,
            initialized: state.initialized,
            indexedDBAvailable: Boolean(global.indexedDB),
            dbAvailable: state.dbAvailable,
            dbName: DB_NAME,
            storeName: STORE_NAME,
            identityPriority: [
                "source + sourceTrackId",
                "sourceTrackId",
                "source + firstSeenAt + geographic bucket",
                "source + geographic bucket",
                "guarded temporal + spatial cross-reload fallback",
                "generated identity LAST RESORT"
            ],
            persistedCount: state.persistedCount,
            recoveredCount: state.recoveredCount,
            matchedBySource: state.matchedBySource,
            matchedByFallback: state.matchedByFallback,
            matchedByTemporal: state.matchedByTemporal,
            matchedByTemporalSpatial: state.matchedByTemporalSpatial,
            ambiguousTemporalFallbacks: state.ambiguousTemporalFallbacks,
            temporalFallbackPolicy: {
                enabled: true,
                windowMs: TEMPORAL_MATCH_WINDOW_MS,
                uniquenessMarginMs: TEMPORAL_UNIQUENESS_MARGIN_MS,
                spatialWindowKm: SPATIAL_MATCH_WINDOW_KM,
                spatialUniquenessMarginKm: SPATIAL_UNIQUENESS_MARGIN_KM,
                ambiguousMatchesRejected: true
            },
            rejectedGeneratedIds: state.rejectedGeneratedIds,
            lastPersistAt: state.lastPersistAt,
            lastRecoverAt: state.lastRecoverAt,
            lastError: clone(state.lastError),
            createdAt: state.createdAt,
            updatedAt: state.updatedAt
        };

        if (log) console.log(
            "[RainGuard][39A-15F6N4B1B3C3][C3-FIX5] Diagnostics:",
            diagnostics
        );

        return diagnostics;
    }

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

    global.RainGuardAuthoritativeIdentityRecoveryC3 = api;

    global.RainGuardAI = global.RainGuardAI || {};
    global.RainGuardAI.V39 = global.RainGuardAI.V39 || {};
    global.RainGuardAI.V39.authoritativeIdentityRecoveryC3 = api;

    global.RainArrivalAuthoritativeIdentityRecoveryV39 = api;

    initialize();

    console.log(
        "[RainGuard AI V39] C3-FIX5 Cross-Reload Identity Recovery loaded.",
        { phase: PHASE, version: VERSION, build: BUILD }
    );

})(
    typeof globalThis !== "undefined"
        ? globalThis
        : window
);
