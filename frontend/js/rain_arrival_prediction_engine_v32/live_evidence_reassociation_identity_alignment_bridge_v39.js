/* ============================================================================
 RainGuard AI V39
 Phase 39A-15F6N4B1B3B-H3B2B
 Live Evidence Reassociation & Identity Alignment Bridge

 Purpose:
 - Discover H3B2/H3B2A temporal canonical sources.
 - Discover live storm evidence sources.
 - Normalize identity + coordinates + timestamp.
 - Reassociate live observations with canonical temporal identities.
 - Append only safe observations.
 - Preserve provenance.
 - Publish H3B2B canonical temporal source.
============================================================================ */

(function () {
    "use strict";

    const PHASE = "39A-15F6N4B1B3B-H3B2B";
    const VERSION = "39A.15F6N4B1B3B.H3B2B.0";
    const BUILD =
        "rainguard-v39-live-evidence-reassociation-identity-alignment-bridge";

    const GLOBAL_RESULT =
        "RainGuardN4B1B3BH3B2BResultV39";

    const GLOBAL_SOURCE =
        "RainGuardN4B1B3BH3B2BAlignedTemporalSourceV39";

    const GLOBAL_MEMORY =
        "RainGuardN4B1B3BH3B2BIdentityAlignmentMemoryV39";

    const STORAGE_KEY =
        "RainGuard:39A15F6N4B1B3BH3B2B:identityAlignmentMemory:v1";

    const MAX_IDENTITIES = 2500;
    const MAX_POINTS_PER_IDENTITY = 40;

    // Conservative geographical gate.
    // It is intentionally broad enough for live radar/tracking drift,
    // but prevents unrelated distant cells from being attached.
    const DEFAULT_MATCH_DISTANCE_KM = 90;

    // Timestamp gap for a likely continuation of same identity.
    const DEFAULT_MAX_TIME_GAP_MS = 6 * 60 * 60 * 1000;

    function now() {
        return Date.now();
    }

    function finiteNumber(v) {
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
    }

    function isObject(v) {
        return !!v && typeof v === "object";
    }

    function asArray(v) {
        if (Array.isArray(v)) return v;

        if (v instanceof Map) {
            return Array.from(v.values());
        }

        if (v instanceof Set) {
            return Array.from(v.values());
        }

        if (isObject(v)) {
            if (Array.isArray(v.items)) return v.items;
            if (Array.isArray(v.records)) return v.records;
            if (Array.isArray(v.data)) return v.data;
            if (Array.isArray(v.values)) return v.values;
            if (Array.isArray(v.entities)) return v.entities;
            if (Array.isArray(v.identities)) return v.identities;
            if (Array.isArray(v.observations)) return v.observations;
            if (Array.isArray(v.history)) return v.history;
            if (Array.isArray(v.points)) return v.points;
            if (Array.isArray(v.tracks)) return v.tracks;
        }

        return [];
    }

    function firstDefined(obj, keys) {
        if (!isObject(obj)) return undefined;

        for (const key of keys) {
            if (
                Object.prototype.hasOwnProperty.call(obj, key) &&
                obj[key] !== undefined &&
                obj[key] !== null
            ) {
                return obj[key];
            }
        }

        return undefined;
    }

    function extractIdentity(record) {
        if (!isObject(record)) return null;

        let value = firstDefined(record, [
            "canonicalIdentity",
            "canonicalIdentityId",
            "canonicalId",
            "identityId",
            "identity",
            "stormIdentity",
            "stormIdentityId",
            "stormId",
            "trackId",
            "trackID",
            "entityId",
            "entityID",
            "cellId",
            "cellID",
            "id",
            "key",
            "uid",
            "uuid"
        ]);

        if (isObject(value)) {
            value = firstDefined(value, [
                "canonicalIdentity",
                "canonicalIdentityId",
                "identityId",
                "id",
                "key",
                "uid"
            ]);
        }

        if (
            value === undefined ||
            value === null ||
            value === ""
        ) {
            return null;
        }

        return String(value);
    }

    function extractLatLon(record) {
        if (!isObject(record)) return null;

        let lat = firstDefined(record, [
            "lat",
            "latitude",
            "centerLat",
            "centroidLat",
            "stormLat",
            "cellLat",
            "y"
        ]);

        let lon = firstDefined(record, [
            "lon",
            "lng",
            "longitude",
            "centerLon",
            "centerLng",
            "centroidLon",
            "centroidLng",
            "stormLon",
            "stormLng",
            "cellLon",
            "cellLng",
            "x"
        ]);

        const coordCandidate = firstDefined(record, [
            "coordinate",
            "coordinates",
            "position",
            "location",
            "centroid",
            "center",
            "point"
        ]);

        if (
            (lat === undefined || lon === undefined) &&
            Array.isArray(coordCandidate) &&
            coordCandidate.length >= 2
        ) {
            const a = finiteNumber(coordCandidate[0]);
            const b = finiteNumber(coordCandidate[1]);

            if (
                a !== null &&
                b !== null
            ) {
                // GeoJSON usually [lon, lat]
                if (
                    Math.abs(a) <= 180 &&
                    Math.abs(b) <= 90
                ) {
                    lon = a;
                    lat = b;
                }
            }
        }

        if (
            (lat === undefined || lon === undefined) &&
            isObject(coordCandidate)
        ) {
            lat = lat !== undefined
                ? lat
                : firstDefined(coordCandidate, [
                    "lat",
                    "latitude",
                    "y"
                ]);

            lon = lon !== undefined
                ? lon
                : firstDefined(coordCandidate, [
                    "lon",
                    "lng",
                    "longitude",
                    "x"
                ]);
        }

        lat = finiteNumber(lat);
        lon = finiteNumber(lon);

        if (
            lat === null ||
            lon === null ||
            Math.abs(lat) > 90 ||
            Math.abs(lon) > 180
        ) {
            return null;
        }

        return {
            lat,
            lon
        };
    }

    function normalizeTimestamp(v) {
        if (v === undefined || v === null) return null;

        if (typeof v === "number") {
            if (!Number.isFinite(v)) return null;

            // Seconds -> milliseconds.
            if (v > 1e9 && v < 1e12) {
                return Math.round(v * 1000);
            }

            if (v >= 1e12) {
                return Math.round(v);
            }

            return null;
        }

        if (v instanceof Date) {
            const t = v.getTime();
            return Number.isFinite(t) ? t : null;
        }

        if (typeof v === "string") {
            const numeric = Number(v);

            if (Number.isFinite(numeric)) {
                return normalizeTimestamp(numeric);
            }

            const parsed = Date.parse(v);

            if (Number.isFinite(parsed)) {
                return parsed;
            }
        }

        return null;
    }

    function extractTimestamp(record) {
        if (!isObject(record)) return null;

        return normalizeTimestamp(
            firstDefined(record, [
                "timestamp",
                "time",
                "ts",
                "observedAt",
                "observationTime",
                "capturedAt",
                "captureTime",
                "detectedAt",
                "generatedAt",
                "updatedAt",
                "createdAt",
                "cycleTimestamp",
                "eventTime",
                "datetime",
                "dateTime"
            ])
        );
    }

    function extractCycleId(record) {
        if (!isObject(record)) return null;

        const v = firstDefined(record, [
            "cycleId",
            "cycleID",
            "cycle",
            "scanId",
            "scanID",
            "frameId",
            "frameID",
            "observationCycle",
            "trackingCycle"
        ]);

        if (
            v === undefined ||
            v === null ||
            v === ""
        ) {
            return null;
        }

        return String(v);
    }

    function haversineKm(aLat, aLon, bLat, bLon) {
        const R = 6371;
        const toRad = x => x * Math.PI / 180;

        const dLat = toRad(bLat - aLat);
        const dLon = toRad(bLon - aLon);

        const x =
            Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(aLat)) *
            Math.cos(toRad(bLat)) *
            Math.sin(dLon / 2) ** 2;

        return 2 * R * Math.asin(Math.sqrt(x));
    }

    function pointKey(point) {
        if (!point) return null;

        const lat = finiteNumber(point.lat);
        const lon = finiteNumber(point.lon);
        const ts = normalizeTimestamp(point.timestamp);

        if (
            lat === null ||
            lon === null
        ) {
            return null;
        }

        return [
            lat.toFixed(5),
            lon.toFixed(5),
            ts || "no-ts"
        ].join("|");
    }

    function normalizeObservation(record, provenance) {
        const coordinate = extractLatLon(record);

        if (!coordinate) {
            return null;
        }

        return {
            identity: extractIdentity(record),

            lat: coordinate.lat,
            lon: coordinate.lon,

            timestamp:
                extractTimestamp(record) || now(),

            cycleId:
                extractCycleId(record),

            provenance:
                provenance || "unknown",

            sourceIdentity:
                extractIdentity(record),

            raw:
                record
        };
    }

    function getNestedArrays(root, maxDepth) {
        const results = [];
        const visited = new WeakSet();

        function walk(value, path, depth) {
            if (
                depth > maxDepth ||
                value === null ||
                value === undefined
            ) {
                return;
            }

            if (Array.isArray(value)) {
                results.push({
                    path,
                    value
                });

                return;
            }

            if (!isObject(value)) return;

            if (visited.has(value)) return;
            visited.add(value);

            let entries;

            try {
                entries = Object.entries(value);
            } catch (_) {
                return;
            }

            for (const [key, child] of entries.slice(0, 100)) {
                walk(
                    child,
                    path ? path + "." + key : key,
                    depth + 1
                );
            }
        }

        walk(root, "", 0);

        return results;
    }

    function scoreCanonicalSource(name, value) {
        let score = 0;
        const n = String(name || "").toLowerCase();

        if (n.includes("h3b2")) score += 25;
        if (n.includes("h3b2a")) score += 35;
        if (n.includes("movementready")) score += 45;
        if (n.includes("runtimebound")) score += 40;
        if (n.includes("normalizedcanonical")) score += 35;
        if (n.includes("recoveredtemporal")) score += 20;
        if (n.includes("temporalsource")) score += 25;

        if (Array.isArray(value)) {
            score += Math.min(30, value.length / 10);
        }

        if (isObject(value)) {
            const keys = Object.keys(value)
                .join(" ")
                .toLowerCase();

            if (keys.includes("observation")) score += 15;
            if (keys.includes("identit")) score += 15;
            if (keys.includes("coordinate")) score += 10;
            if (keys.includes("history")) score += 10;
        }

        return score;
    }

    function discoverCanonicalSources() {
        const candidates = [];

        const explicitNames = [
            "RainGuardN4B1B3BH3B2MovementReadyTemporalSourceV39",
            "RainGuardN4B1B3BH3B2RuntimeBoundCanonicalTemporalSourceV39",
            "RainGuardN4B1B3BH3B1NormalizedCanonicalTemporalSourceV39",
            "RainGuardN4B1B3BH3BRecoveredTemporalSourceV39",
            "RainGuardN4B1B3BH3B2AResultV39",
            "h3b2aResult"
        ];

        for (const name of explicitNames) {
            if (window[name] !== undefined) {
                candidates.push({
                    name,
                    value: window[name],
                    score:
                        200 +
                        scoreCanonicalSource(
                            name,
                            window[name]
                        )
                });
            }
        }

        for (const key of Object.keys(window)) {
            if (
                !/H3B|TemporalSource|MovementReady|CanonicalTemporal/i.test(key)
            ) {
                continue;
            }

            let value;

            try {
                value = window[key];
            } catch (_) {
                continue;
            }

            if (!isObject(value)) continue;

            candidates.push({
                name: key,
                value,
                score: scoreCanonicalSource(key, value)
            });
        }

        const dedup = new Map();

        for (const item of candidates) {
            if (
                !dedup.has(item.name) ||
                dedup.get(item.name).score < item.score
            ) {
                dedup.set(item.name, item);
            }
        }

        return Array.from(dedup.values())
            .sort((a, b) => b.score - a.score);
    }

    function scoreLiveSource(name, value) {
        let score = 0;
        const n = String(name || "").toLowerCase();

        if (n.includes("livestorm")) score += 50;
        if (n.includes("live")) score += 20;
        if (n.includes("stable")) score += 20;
        if (n.includes("trackhistory")) score += 25;
        if (n.includes("stormentities")) score += 25;
        if (n.includes("stormcell")) score += 20;
        if (n.includes("candidate")) score += 10;

        if (
            n.includes("temporal") &&
            n.includes("h3b")
        ) {
            score -= 40;
        }

        const arr = asArray(value);
        score += Math.min(30, arr.length / 20);

        return score;
    }

    function discoverLiveSources() {
        const candidates = [];

        const explicitNames = [
            "RainArrivalStableStormEntities",
            "RainArrivalLiveStormEntities",
            "RainArrivalLiveTrackHistory",
            "RainArrivalMatchedStormEntities",
            "RainArrivalCandidates",
            "StormCells",
            "StormEntities"
        ];

        for (const name of explicitNames) {
            if (window[name] !== undefined) {
                candidates.push({
                    name,
                    value: window[name],
                    score:
                        150 +
                        scoreLiveSource(
                            name,
                            window[name]
                        )
                });
            }
        }

        for (const key of Object.keys(window)) {
            if (
                !/LiveStorm|StableStorm|TrackHistory|StormEntit|StormCell|MatchedStorm/i.test(key)
            ) {
                continue;
            }

            let value;

            try {
                value = window[key];
            } catch (_) {
                continue;
            }

            if (
                !Array.isArray(value) &&
                !isObject(value)
            ) {
                continue;
            }

            candidates.push({
                name: key,
                value,
                score: scoreLiveSource(key, value)
            });
        }

        const dedup = new Map();

        for (const item of candidates) {
            if (
                !dedup.has(item.name) ||
                dedup.get(item.name).score < item.score
            ) {
                dedup.set(item.name, item);
            }
        }

        return Array.from(dedup.values())
            .sort((a, b) => b.score - a.score);
    }

    function extractObservationsFromSource(
        sourceName,
        sourceValue,
        maxDepth
    ) {
        const found = [];
        const seen = new Set();

        const arrays = [];

        if (Array.isArray(sourceValue)) {
            arrays.push({
                path: sourceName,
                value: sourceValue
            });
        }

        arrays.push(
            ...getNestedArrays(
                sourceValue,
                maxDepth || 4
            )
        );

        for (const entry of arrays) {
            for (const raw of entry.value.slice(0, 10000)) {
                if (!isObject(raw)) continue;

                const obs = normalizeObservation(
                    raw,
                    sourceName + ":" + entry.path
                );

                if (!obs) continue;

                const key = [
                    obs.identity || "no-id",
                    obs.lat.toFixed(5),
                    obs.lon.toFixed(5),
                    obs.timestamp
                ].join("|");

                if (seen.has(key)) continue;

                seen.add(key);
                found.push(obs);
            }
        }

        return found;
    }

    function groupCanonicalObservations(observations) {
        const identities = new Map();

        for (const obs of observations) {
            const id =
                obs.identity ||
                "canonical:" +
                obs.lat.toFixed(4) +
                ":" +
                obs.lon.toFixed(4);

            if (!identities.has(id)) {
                identities.set(id, {
                    identity: id,
                    observations: [],
                    aliases: new Set()
                });
            }

            const entity = identities.get(id);

            if (obs.sourceIdentity) {
                entity.aliases.add(obs.sourceIdentity);
            }

            entity.observations.push(obs);
        }

        for (const entity of identities.values()) {
            entity.observations.sort(
                (a, b) =>
                    (a.timestamp || 0) -
                    (b.timestamp || 0)
            );

            entity.observations =
                entity.observations.slice(
                    -MAX_POINTS_PER_IDENTITY
                );
        }

        return identities;
    }

    function lastPoint(entity) {
        if (
            !entity ||
            !Array.isArray(entity.observations) ||
            !entity.observations.length
        ) {
            return null;
        }

        return entity.observations[
            entity.observations.length - 1
        ];
    }

    function findIdentityMatch(liveObs, identities) {
        let best = null;

        for (const entity of identities.values()) {
            const lp = lastPoint(entity);

            if (!lp) continue;

            let score = 0;

            const directIdentityMatch =
                liveObs.identity &&
                (
                    liveObs.identity === entity.identity ||
                    entity.aliases.has(liveObs.identity)
                );

            if (directIdentityMatch) {
                score += 1000;
            }

            const distanceKm = haversineKm(
                liveObs.lat,
                liveObs.lon,
                lp.lat,
                lp.lon
            );

            if (
                !directIdentityMatch &&
                distanceKm > DEFAULT_MATCH_DISTANCE_KM
            ) {
                continue;
            }

            score += Math.max(
                0,
                250 -
                distanceKm * 3
            );

            const liveTs = liveObs.timestamp;
            const historyTs = lp.timestamp;

            let timeGapMs = null;

            if (
                liveTs &&
                historyTs
            ) {
                timeGapMs =
                    Math.abs(liveTs - historyTs);

                if (
                    !directIdentityMatch &&
                    timeGapMs >
                        DEFAULT_MAX_TIME_GAP_MS
                ) {
                    continue;
                }

                score += Math.max(
                    0,
                    150 -
                    (
                        timeGapMs /
                        (60 * 1000)
                    )
                );
            }

            if (
                liveObs.cycleId &&
                lp.cycleId &&
                liveObs.cycleId !== lp.cycleId
            ) {
                score += 25;
            }

            if (
                !best ||
                score > best.score
            ) {
                best = {
                    entity,
                    score,
                    distanceKm,
                    timeGapMs,
                    directIdentityMatch
                };
            }
        }

        return best;
    }

    function appendObservation(entity, obs) {
        if (!entity || !obs) return false;

        const incomingKey =
            pointKey(obs);

        if (!incomingKey) return false;

        const existingKeys =
            new Set(
                entity.observations
                    .map(pointKey)
                    .filter(Boolean)
            );

        if (existingKeys.has(incomingKey)) {
            return false;
        }

        entity.observations.push(obs);

        entity.observations.sort(
            (a, b) =>
                (a.timestamp || 0) -
                (b.timestamp || 0)
        );

        if (
            entity.observations.length >
            MAX_POINTS_PER_IDENTITY
        ) {
            entity.observations =
                entity.observations.slice(
                    -MAX_POINTS_PER_IDENTITY
                );
        }

        if (obs.sourceIdentity) {
            entity.aliases.add(obs.sourceIdentity);
        }

        return true;
    }

    function uniqueCoordinateCount(entity) {
        if (
            !entity ||
            !Array.isArray(entity.observations)
        ) {
            return 0;
        }

        return new Set(
            entity.observations.map(
                p =>
                    p.lat.toFixed(4) +
                    "|" +
                    p.lon.toFixed(4)
            )
        ).size;
    }

    function computeMovement(entity) {
        const obs = entity.observations;

        if (
            !Array.isArray(obs) ||
            obs.length < 2
        ) {
            return null;
        }

        for (
            let i = obs.length - 1;
            i > 0;
            i--
        ) {
            const a = obs[i - 1];
            const b = obs[i];

            const distanceKm =
                haversineKm(
                    a.lat,
                    a.lon,
                    b.lat,
                    b.lon
                );

            const dt =
                b.timestamp -
                a.timestamp;

            if (
                distanceKm <= 0 ||
                dt <= 0
            ) {
                continue;
            }

            const hours =
                dt /
                (60 * 60 * 1000);

            return {
                from: {
                    lat: a.lat,
                    lon: a.lon,
                    timestamp: a.timestamp
                },

                to: {
                    lat: b.lat,
                    lon: b.lon,
                    timestamp: b.timestamp
                },

                distanceKm,

                durationMs: dt,

                speedKmH:
                    hours > 0
                        ? distanceKm / hours
                        : null
            };
        }

        return null;
    }

    function serializeIdentity(entity) {
        return {
            identity: entity.identity,

            aliases:
                Array.from(entity.aliases),

            observationCount:
                entity.observations.length,

            uniqueCoordinateCount:
                uniqueCoordinateCount(entity),

            movement:
                computeMovement(entity),

            observations:
                entity.observations.map(p => ({
                    identity:
                        p.identity ||
                        entity.identity,

                    lat: p.lat,
                    lon: p.lon,

                    timestamp:
                        p.timestamp,

                    cycleId:
                        p.cycleId || null,

                    provenance:
                        p.provenance || null,

                    sourceIdentity:
                        p.sourceIdentity || null
                }))
        };
    }

    function saveMemory(source) {
        try {
            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify({
                    savedAt: now(),
                    source
                })
            );

            return true;
        } catch (_) {
            return false;
        }
    }

    function publishAliases(source) {
        window[GLOBAL_SOURCE] = source;

        window.RainGuardH3B2BAlignedTemporalSourceV39 =
            source;

        window.RainGuardLiveEvidenceAlignedTemporalSourceV39 =
            source;

        window.RainGuardAuthoritativeMovementReadyTemporalSourceV39 =
            source;

        window.RainGuardCanonicalIdentityAlignedHistoryV39 =
            source;

        return true;
    }

    async function run() {
        const startedAt = now();

        const result = {
            success: false,
            phase: PHASE,
            version: VERSION,
            build: BUILD,

            status:
                "H3B2B_INITIALIZING",

            generatedAt:
                startedAt
        };

        try {
            const canonicalSources =
                discoverCanonicalSources();

            const liveSources =
                discoverLiveSources();

            result.canonicalCandidateCount =
                canonicalSources.length;

            result.liveSourceCandidateCount =
                liveSources.length;

            result.canonicalCandidateSample =
                canonicalSources
                    .slice(0, 20)
                    .map(x => ({
                        name: x.name,
                        score: x.score,
                        type:
                            Array.isArray(x.value)
                                ? "array"
                                : typeof x.value
                    }));

            result.liveSourceCandidateSample =
                liveSources
                    .slice(0, 20)
                    .map(x => ({
                        name: x.name,
                        score: x.score,
                        type:
                            Array.isArray(x.value)
                                ? "array"
                                : typeof x.value
                    }));

            if (!canonicalSources.length) {
                result.status =
                    "NO_H3B2A_CANONICAL_TEMPORAL_SOURCE_FOUND";

                window[GLOBAL_RESULT] =
                    result;

                return result;
            }

            if (!liveSources.length) {
                result.status =
                    "NO_LIVE_EVIDENCE_SOURCE_FOUND";

                window[GLOBAL_RESULT] =
                    result;

                return result;
            }

            let canonicalObservations = [];

            for (
                const source of
                canonicalSources.slice(0, 15)
            ) {
                canonicalObservations.push(
                    ...extractObservationsFromSource(
                        source.name,
                        source.value,
                        5
                    )
                );
            }

            let liveObservations = [];

            for (
                const source of
                liveSources.slice(0, 20)
            ) {
                liveObservations.push(
                    ...extractObservationsFromSource(
                        source.name,
                        source.value,
                        4
                    )
                );
            }

            result.canonicalObservationCount =
                canonicalObservations.length;

            result.liveObservationCount =
                liveObservations.length;

            if (!canonicalObservations.length) {
                result.status =
                    "CANONICAL_SOURCE_FOUND_BUT_NO_VALID_COORDINATE_OBSERVATIONS";

                window[GLOBAL_RESULT] =
                    result;

                return result;
            }

            if (!liveObservations.length) {
                result.status =
                    "LIVE_SOURCES_FOUND_BUT_NO_VALID_COORDINATE_OBSERVATIONS";

                window[GLOBAL_RESULT] =
                    result;

                return result;
            }

            const identities =
                groupCanonicalObservations(
                    canonicalObservations
                );

            result.identityCountBefore =
                identities.size;

            let matchedLiveEvidenceCount = 0;
            let appendedObservationCount = 0;
            let directIdentityMatchCount = 0;
            let spatialTemporalMatchCount = 0;
            let unmatchedLiveEvidenceCount = 0;

            const alignmentSample = [];

            for (const liveObs of liveObservations) {
                const match =
                    findIdentityMatch(
                        liveObs,
                        identities
                    );

                if (!match) {
                    unmatchedLiveEvidenceCount++;
                    continue;
                }

                matchedLiveEvidenceCount++;

                if (match.directIdentityMatch) {
                    directIdentityMatchCount++;
                } else {
                    spatialTemporalMatchCount++;
                }

                const appended =
                    appendObservation(
                        match.entity,
                        {
                            ...liveObs,

                            identity:
                                match.entity.identity,

                            reassociated: true,

                            reassociationScore:
                                match.score,

                            reassociationDistanceKm:
                                match.distanceKm,

                            reassociationTimeGapMs:
                                match.timeGapMs,

                            reassociationMethod:
                                match.directIdentityMatch
                                    ? "DIRECT_IDENTITY"
                                    : "SPATIAL_TEMPORAL_ALIGNMENT"
                        }
                    );

                if (appended) {
                    appendedObservationCount++;
                }

                if (
                    alignmentSample.length < 50
                ) {
                    alignmentSample.push({
                        canonicalIdentity:
                            match.entity.identity,

                        liveIdentity:
                            liveObs.identity,

                        distanceKm:
                            match.distanceKm,

                        timeGapMs:
                            match.timeGapMs,

                        score:
                            match.score,

                        directIdentityMatch:
                            match.directIdentityMatch,

                        appended
                    });
                }
            }

            const serialized =
                Array.from(
                    identities.values()
                )
                .slice(0, MAX_IDENTITIES)
                .map(serializeIdentity);

            const multiPoint =
                serialized.filter(
                    x =>
                        x.observationCount >= 2
                );

            const coordinateDiverse =
                serialized.filter(
                    x =>
                        x.uniqueCoordinateCount >= 2
                );

            const movementReady =
                serialized.filter(
                    x =>
                        !!x.movement
                );

            const publishedSource = {
                success: true,

                phase: PHASE,
                version: VERSION,
                build: BUILD,

                generatedAt: now(),

                sourceType:
                    "LIVE_EVIDENCE_REASSOCIATED_CANONICAL_TEMPORAL_SOURCE",

                identities:
                    serialized,

                multiPointIdentities:
                    multiPoint,

                coordinateDiverseIdentities:
                    coordinateDiverse,

                movementReadyIdentities:
                    movementReady,

                metadata: {
                    canonicalObservationCount:
                        canonicalObservations.length,

                    liveObservationCount:
                        liveObservations.length,

                    matchedLiveEvidenceCount,

                    appendedObservationCount,

                    directIdentityMatchCount,

                    spatialTemporalMatchCount,

                    unmatchedLiveEvidenceCount
                }
            };

            publishAliases(
                publishedSource
            );

            const persisted =
                saveMemory(
                    publishedSource
                );

            window[GLOBAL_MEMORY] =
                publishedSource;

            result.success = true;

            result.identityCountAfter =
                serialized.length;

            result.matchedLiveEvidenceCount =
                matchedLiveEvidenceCount;

            result.appendedObservationCount =
                appendedObservationCount;

            result.directIdentityMatchCount =
                directIdentityMatchCount;

            result.spatialTemporalMatchCount =
                spatialTemporalMatchCount;

            result.unmatchedLiveEvidenceCount =
                unmatchedLiveEvidenceCount;

            result.multiPointIdentityCount =
                multiPoint.length;

            result.coordinateDiverseIdentityCount =
                coordinateDiverse.length;

            result.movementReadyIdentityCount =
                movementReady.length;

            result.maxObservedPointsPerIdentity =
                serialized.reduce(
                    (max, x) =>
                        Math.max(
                            max,
                            x.observationCount
                        ),
                    0
                );

            result.maxUniqueCoordinatesPerIdentity =
                serialized.reduce(
                    (max, x) =>
                        Math.max(
                            max,
                            x.uniqueCoordinateCount
                        ),
                    0
                );

            result.persistedToLocalStorage =
                persisted;

            result.selectedCanonicalSources =
                canonicalSources
                    .slice(0, 10)
                    .map(x => x.name);

            result.selectedLiveSources =
                liveSources
                    .slice(0, 15)
                    .map(x => x.name);

            result.alignmentSample =
                alignmentSample;

            result.publishedSourceName =
                GLOBAL_SOURCE;

            if (
                movementReady.length > 0
            ) {
                result.status =
                    "LIVE_EVIDENCE_REASSOCIATED_IDENTITY_ALIGNED_MOVEMENT_READY";
            } else if (
                coordinateDiverse.length > 0
            ) {
                result.status =
                    "LIVE_EVIDENCE_REASSOCIATED_COORDINATE_DIVERSITY_RECOVERED";
            } else if (
                multiPoint.length > 0
            ) {
                result.status =
                    "LIVE_EVIDENCE_REASSOCIATED_MULTI_POINT_IDENTITIES_READY";
            } else if (
                matchedLiveEvidenceCount > 0
            ) {
                result.status =
                    "LIVE_EVIDENCE_REASSOCIATED_BUT_TEMPORAL_DIVERSITY_PENDING";
            } else {
                result.status =
                    "CANONICAL_AND_LIVE_SOURCES_READY_BUT_NO_SAFE_IDENTITY_ALIGNMENT";
            }

            result.durationMs =
                now() - startedAt;

            window[GLOBAL_RESULT] =
                result;

            console.log(
                `[RainGuard Phase ${PHASE}] Live Evidence Reassociation result:`
            );

            console.log(result);

            console.table(
                alignmentSample.slice(0, 25)
            );

            console.log(
                `[RainGuard Phase ${PHASE}] Published source:`,
                window[GLOBAL_SOURCE]
            );

            return result;

        } catch (error) {
            result.success = false;

            result.status =
                "H3B2B_RUNTIME_ERROR";

            result.error =
                String(
                    error &&
                    error.stack
                        ? error.stack
                        : error
                );

            result.durationMs =
                now() - startedAt;

            window[GLOBAL_RESULT] =
                result;

            console.error(
                `[RainGuard Phase ${PHASE}]`,
                error
            );

            return result;
        }
    }

    window.runRainGuardN4B1B3BH3B2BLiveEvidenceReassociationIdentityAlignmentBridge =
        run;

    window.diagnoseRainGuardN4B1B3BH3B2BLiveEvidenceReassociationIdentityAlignmentBridge =
        function () {
            const canonical =
                discoverCanonicalSources();

            const live =
                discoverLiveSources();

            const diagnostic = {
                phase: PHASE,

                canonicalSources:
                    canonical
                        .slice(0, 30)
                        .map(x => ({
                            name: x.name,
                            score: x.score,
                            type:
                                Array.isArray(x.value)
                                    ? "array"
                                    : typeof x.value
                        })),

                liveSources:
                    live
                        .slice(0, 30)
                        .map(x => ({
                            name: x.name,
                            score: x.score,
                            type:
                                Array.isArray(x.value)
                                    ? "array"
                                    : typeof x.value
                        }))
            };

            console.table(
                diagnostic.canonicalSources
            );

            console.table(
                diagnostic.liveSources
            );

            return diagnostic;
        };

    window.getRainGuardN4B1B3BH3B2BAlignedTemporalSource =
        function () {
            return window[GLOBAL_SOURCE] || null;
        };

    window.resetRainGuardN4B1B3BH3B2B =
        function () {
            try {
                delete window[GLOBAL_RESULT];
                delete window[GLOBAL_SOURCE];
                delete window[GLOBAL_MEMORY];

                localStorage.removeItem(
                    STORAGE_KEY
                );

                return true;
            } catch (_) {
                return false;
            }
        };

    window.RainGuardN4B1B3BH3B2BBridgeV39 = {
        phase: PHASE,
        version: VERSION,
        build: BUILD,
        run,
        diagnose:
            window.diagnoseRainGuardN4B1B3BH3B2BLiveEvidenceReassociationIdentityAlignmentBridge,
        getSource:
            window.getRainGuardN4B1B3BH3B2BAlignedTemporalSource
    };

    window.__RainGuardN4B1B3BH3B2BInstalled =
        true;

    console.log(
        `[RainGuard Phase ${PHASE}] bridge installed.`
    );

})();
