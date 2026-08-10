/**
 * RainGuard AI
 * Phase 39A-15F1 — Persistent Sequential Observation Repair Bridge
 *
 * File:
 * persistent_sequential_observation_repair_bridge_39a15f1.js
 *
 * Purpose:
 * - Recover sequential observations belonging to the SAME persistent identity.
 * - Read observations from multiple RainGuard persistent/history stores.
 * - Extract nested coordinates safely.
 * - Extract canonical/persistent identity safely.
 * - Sort observations chronologically.
 * - Remove duplicate timestamps/coordinates.
 * - Reject invalid or impossible coordinate records.
 * - Build valid sequential observation pairs.
 * - Publish repaired history for Phase 39A-15F Motion Vector Builder.
 *
 * IMPORTANT:
 * This phase NEVER invents motion.
 * It only produces a sequential pair when two real observations
 * can be proven to belong to the same persistent identity.
 */

(function installRainGuardPersistentSequentialObservationRepairBridge(global) {
    "use strict";

    const PHASE = "39A-15F1";
    const VERSION = "39A.15F1.0";
    const BUILD = "rainguard-v39-persistent-sequential-observation-repair-bridge";

    const CONFIG = Object.freeze({
        minDeltaTimeMs: 5 * 1000,
        maxDeltaTimeMs: 6 * 60 * 60 * 1000,

        // Do not treat tiny floating-point noise as movement.
        minMovementKm: 0.05,

        // Safety limit against accidental jumps / corrupted coordinates.
        maxMovementKm: 500,

        // Maximum physically reasonable storm translation speed.
        maxSpeedKmh: 250,

        // Limit retained observations for one identity.
        maxObservationsPerIdentity: 100,

        // Hard safety limit for source scanning.
        maxSourceRecords: 25000
    });

    const state = {
        phase: PHASE,
        version: VERSION,
        build: BUILD,

        installed: true,
        running: false,
        runInProgress: false,

        runs: 0,
        successfulRuns: 0,
        skippedRuns: 0,
        failures: 0,

        sourceRecords: 0,
        normalizedRecords: 0,
        rejectedRecords: 0,

        identityCount: 0,
        identitiesWithMultiplePoints: 0,

        sequentialPairCount: 0,
        validSequentialPairCount: 0,

        rejectedNoIdentity: 0,
        rejectedNoCoordinate: 0,
        rejectedInvalidCoordinate: 0,
        rejectedNoTimestamp: 0,
        rejectedDuplicate: 0,
        rejectedDeltaTime: 0,
        rejectedNoMovement: 0,
        rejectedJump: 0,
        rejectedSpeed: 0,

        lastRunAt: null,
        lastSuccessAt: null,
        lastError: null,
        lastResult: null
    };

    let RUN_LOCK = false;

    // ------------------------------------------------------------
    // Basic utilities
    // ------------------------------------------------------------

    function isObject(value) {
        return value !== null && typeof value === "object";
    }

    function isFiniteNumber(value) {
        return Number.isFinite(Number(value));
    }

    function asNumber(value) {
        const n = Number(value);
        return Number.isFinite(n) ? n : null;
    }

    function firstDefined(...values) {
        for (const value of values) {
            if (
                value !== undefined &&
                value !== null &&
                value !== ""
            ) {
                return value;
            }
        }

        return null;
    }

    function safeString(value) {
        if (value === undefined || value === null) {
            return null;
        }

        const s = String(value).trim();

        return s.length ? s : null;
    }

    function normalizeTimestamp(value) {
        if (value === undefined || value === null || value === "") {
            return null;
        }

        if (value instanceof Date) {
            const t = value.getTime();
            return Number.isFinite(t) ? t : null;
        }

        if (typeof value === "number") {
            if (!Number.isFinite(value)) return null;

            // Seconds → milliseconds.
            if (value > 1e9 && value < 1e12) {
                return Math.round(value * 1000);
            }

            // Already milliseconds.
            if (value >= 1e12) {
                return Math.round(value);
            }

            return null;
        }

        const numeric = Number(value);

        if (Number.isFinite(numeric)) {
            if (numeric > 1e9 && numeric < 1e12) {
                return Math.round(numeric * 1000);
            }

            if (numeric >= 1e12) {
                return Math.round(numeric);
            }
        }

        const parsed = Date.parse(String(value));

        return Number.isFinite(parsed) ? parsed : null;
    }

    // ------------------------------------------------------------
    // Coordinate extraction
    // ------------------------------------------------------------

    function coordinateCandidate(obj) {
        if (!isObject(obj)) return null;

        const lat = firstDefined(
            obj.lat,
            obj.latitude,
            obj.y
        );

        const lon = firstDefined(
            obj.lon,
            obj.lng,
            obj.longitude,
            obj.x
        );

        if (!isFiniteNumber(lat) || !isFiniteNumber(lon)) {
            return null;
        }

        const latitude = Number(lat);
        const longitude = Number(lon);

        if (
            latitude < -90 ||
            latitude > 90 ||
            longitude < -180 ||
            longitude > 180
        ) {
            return null;
        }

        /*
         * Important:
         * 0,0 is technically valid geographic data, but in our pipeline
         * it has repeatedly represented missing coordinates.
         */
        if (latitude === 0 && longitude === 0) {
            return null;
        }

        return {
            latitude,
            longitude,
            lat: latitude,
            lon: longitude,
            lng: longitude
        };
    }

    function extractCoordinate(record, depth = 0, seen = new Set()) {
        if (!record || depth > 6) {
            return null;
        }

        if (Array.isArray(record)) {
            // Coordinate array [lat, lon]
            if (
                record.length >= 2 &&
                isFiniteNumber(record[0]) &&
                isFiniteNumber(record[1])
            ) {
                const candidate = coordinateCandidate({
                    lat: record[0],
                    lon: record[1]
                });

                if (candidate) return candidate;
            }

            for (const item of record.slice(0, 20)) {
                const found = extractCoordinate(item, depth + 1, seen);
                if (found) return found;
            }

            return null;
        }

        if (!isObject(record)) {
            return null;
        }

        if (seen.has(record)) {
            return null;
        }

        seen.add(record);

        const direct = coordinateCandidate(record);

        if (direct) {
            return direct;
        }

        const preferredKeys = [
            "currentCoordinate",
            "coordinate",
            "coordinates",
            "position",
            "location",
            "point",
            "centroid",
            "center",
            "stormCoordinate",
            "observation",
            "currentObservation",
            "lastObservation",
            "firstObservation",
            "metadata",
            "original",
            "entity",
            "storm",
            "track",
            "data"
        ];

        for (const key of preferredKeys) {
            if (!(key in record)) continue;

            const found = extractCoordinate(
                record[key],
                depth + 1,
                seen
            );

            if (found) return found;
        }

        return null;
    }

    // ------------------------------------------------------------
    // Identity extraction
    // ------------------------------------------------------------

    function extractIdentity(record, fallbackKey = null) {
        if (!isObject(record)) {
            return safeString(fallbackKey);
        }

        const direct = firstDefined(
            record.persistentId,
            record.persistentID,
            record.persistentIdentity,
            record.persistentIdentityId,
            record.identityId,
            record.identityID,
            record.canonicalTrackId,
            record.canonicalTrackID,
            record.canonicalId,
            record.stableTrackId,
            record.stableId,
            record.trackId,
            record.trackID,
            record.cellId,
            record.cellID,
            record.stormId,
            record.stormID
        );

        if (direct !== null) {
            if (isObject(direct)) {
                const nested = firstDefined(
                    direct.id,
                    direct.persistentId,
                    direct.canonicalTrackId,
                    direct.trackId
                );

                if (nested !== null) {
                    return safeString(nested);
                }
            } else {
                return safeString(direct);
            }
        }

        const nestedCandidates = [
            record.identity,
            record.persistent,
            record.track,
            record.storm,
            record.entity,
            record.metadata,
            record.original
        ];

        for (const candidate of nestedCandidates) {
            if (!isObject(candidate)) continue;

            const nested = firstDefined(
                candidate.persistentId,
                candidate.persistentIdentityId,
                candidate.canonicalTrackId,
                candidate.stableTrackId,
                candidate.trackId,
                candidate.cellId,
                candidate.stormId,
                candidate.id
            );

            if (nested !== null) {
                return safeString(nested);
            }
        }

        return safeString(fallbackKey);
    }

    // ------------------------------------------------------------
    // Timestamp extraction
    // ------------------------------------------------------------

    function extractTimestamp(record) {
        if (!isObject(record)) return null;

        const direct = firstDefined(
            record.observedAt,
            record.observationTime,
            record.timestamp,
            record.time,
            record.datetime,
            record.dateTime,
            record.createdAt,
            record.updatedAt,
            record.lastSeenAt,
            record.firstSeenAt
        );

        let timestamp = normalizeTimestamp(direct);

        if (timestamp !== null) {
            return timestamp;
        }

        const nestedCandidates = [
            record.currentCoordinate,
            record.coordinate,
            record.position,
            record.observation,
            record.currentObservation,
            record.lastObservation,
            record.metadata,
            record.original
        ];

        for (const candidate of nestedCandidates) {
            if (!isObject(candidate)) continue;

            timestamp = normalizeTimestamp(
                firstDefined(
                    candidate.observedAt,
                    candidate.timestamp,
                    candidate.time,
                    candidate.datetime,
                    candidate.createdAt,
                    candidate.updatedAt
                )
            );

            if (timestamp !== null) {
                return timestamp;
            }
        }

        return null;
    }

    // ------------------------------------------------------------
    // Source handling
    // ------------------------------------------------------------

    function objectToRecords(value, sourceName) {
        const output = [];

        if (!value) return output;

        if (value instanceof Map) {
            for (const [key, item] of value.entries()) {
                if (Array.isArray(item)) {
                    for (const child of item) {
                        output.push({
                            sourceName,
                            fallbackKey: key,
                            record: child
                        });
                    }
                } else {
                    output.push({
                        sourceName,
                        fallbackKey: key,
                        record: item
                    });
                }
            }

            return output;
        }

        if (value instanceof Set) {
            for (const item of value.values()) {
                output.push({
                    sourceName,
                    fallbackKey: null,
                    record: item
                });
            }

            return output;
        }

        if (Array.isArray(value)) {
            for (const item of value) {
                output.push({
                    sourceName,
                    fallbackKey: null,
                    record: item
                });
            }

            return output;
        }

        if (isObject(value)) {
            /*
             * Stores sometimes expose:
             * { tracks: Map(...) }
             * { history: {...} }
             * { identities: [...] }
             */
            const containers = [
                value.records,
                value.history,
                value.histories,
                value.observations,
                value.points,
                value.identities,
                value.entities,
                value.tracks,
                value.items,
                value.data
            ];

            let extractedContainer = false;

            for (const container of containers) {
                if (!container || container === value) continue;

                if (
                    container instanceof Map ||
                    container instanceof Set ||
                    Array.isArray(container)
                ) {
                    output.push(
                        ...objectToRecords(
                            container,
                            `${sourceName}.container`
                        )
                    );

                    extractedContainer = true;
                }
            }

            /*
             * Plain dictionary:
             * {
             *   identityA: [...],
             *   identityB: [...]
             * }
             */
            if (!extractedContainer) {
                const entries = Object.entries(value);

                if (entries.length <= CONFIG.maxSourceRecords) {
                    for (const [key, item] of entries) {
                        if (typeof item === "function") continue;

                        if (Array.isArray(item)) {
                            for (const child of item) {
                                output.push({
                                    sourceName,
                                    fallbackKey: key,
                                    record: child
                                });
                            }
                        } else if (isObject(item)) {
                            output.push({
                                sourceName,
                                fallbackKey: key,
                                record: item
                            });
                        }
                    }
                }
            }
        }

        return output;
    }

    function discoverSources() {
        const candidates = [
            "RainGuardPersistentIdentityNestedCoordinatesV39",
            "RainGuardPersistentIdentityNestedCoordinateHistoryV39",

            "RainGuardPersistentIdentityMotionHistoryV39",
            "RainGuardPersistentStormIdentitiesV39",

            "RainGuardPersistentStormObservationHistoryV39",
            "RainGuardPersistentStormObservationsV39",

            "RainArrivalLiveTrackHistory",
            "RainArrivalLiveTrackHistoryV32",

            "RainArrivalTrackHistoryV32",

            "RainArrivalTrackStoreV32",
            "RainArrivalStableStormEntities",
            "RainArrivalLiveStormEntities"
        ];

        const reports = [];
        const records = [];

        for (const name of candidates) {
            let value;

            try {
                value = global[name];
            } catch (_) {
                value = null;
            }

            if (!value) continue;

            let extracted = [];

            try {
                extracted = objectToRecords(value, name);
            } catch (error) {
                reports.push({
                    source: name,
                    available: true,
                    error: String(error)
                });

                continue;
            }

            reports.push({
                source: name,
                available: true,
                recordCount: extracted.length
            });

            records.push(...extracted);

            if (records.length >= CONFIG.maxSourceRecords) {
                break;
            }
        }

        return {
            reports,
            records: records.slice(0, CONFIG.maxSourceRecords)
        };
    }

    // ------------------------------------------------------------
    // Normalization
    // ------------------------------------------------------------

    function normalizeObservation(wrapper) {
        const record = wrapper?.record;

        if (!isObject(record)) {
            state.rejectedRecords++;
            return null;
        }

        const identityId = extractIdentity(
            record,
            wrapper.fallbackKey
        );

        if (!identityId) {
            state.rejectedNoIdentity++;
            state.rejectedRecords++;
            return null;
        }

        const coordinate = extractCoordinate(record);

        if (!coordinate) {
            state.rejectedNoCoordinate++;
            state.rejectedRecords++;
            return null;
        }

        if (
            !Number.isFinite(coordinate.latitude) ||
            !Number.isFinite(coordinate.longitude)
        ) {
            state.rejectedInvalidCoordinate++;
            state.rejectedRecords++;
            return null;
        }

        const observedAt = extractTimestamp(record);

        if (!Number.isFinite(observedAt)) {
            state.rejectedNoTimestamp++;
            state.rejectedRecords++;
            return null;
        }

        const source = safeString(
            firstDefined(
                record.source,
                record.sourceName,
                record.provider,
                coordinate.source,
                wrapper.sourceName
            )
        ) || wrapper.sourceName;

        const confidence = asNumber(
            firstDefined(
                record.confidence,
                coordinate.confidence
            )
        );

        const intensity = asNumber(
            firstDefined(
                record.intensity,
                coordinate.intensity
            )
        );

        state.normalizedRecords++;

        return {
            identityId,
            persistentId: identityId,
            canonicalTrackId: identityId,

            latitude: coordinate.latitude,
            longitude: coordinate.longitude,

            lat: coordinate.latitude,
            lon: coordinate.longitude,
            lng: coordinate.longitude,

            observedAt,
            timestamp: observedAt,

            source,
            confidence,
            intensity,

            original: record
        };
    }

    // ------------------------------------------------------------
    // Geospatial calculations
    // ------------------------------------------------------------

    function toRadians(degrees) {
        return degrees * Math.PI / 180;
    }

    function haversineKm(a, b) {
        const R = 6371.0088;

        const lat1 = toRadians(a.latitude);
        const lat2 = toRadians(b.latitude);

        const dLat = toRadians(
            b.latitude - a.latitude
        );

        const dLon = toRadians(
            b.longitude - a.longitude
        );

        const sinLat = Math.sin(dLat / 2);
        const sinLon = Math.sin(dLon / 2);

        const h =
            sinLat * sinLat +
            Math.cos(lat1) *
            Math.cos(lat2) *
            sinLon *
            sinLon;

        const c =
            2 *
            Math.atan2(
                Math.sqrt(h),
                Math.sqrt(1 - h)
            );

        return R * c;
    }

    function bearingDegrees(a, b) {
        const lat1 = toRadians(a.latitude);
        const lat2 = toRadians(b.latitude);

        const dLon = toRadians(
            b.longitude - a.longitude
        );

        const y =
            Math.sin(dLon) *
            Math.cos(lat2);

        const x =
            Math.cos(lat1) *
            Math.sin(lat2) -
            Math.sin(lat1) *
            Math.cos(lat2) *
            Math.cos(dLon);

        const bearing =
            Math.atan2(y, x) *
            180 /
            Math.PI;

        return (bearing + 360) % 360;
    }

    // ------------------------------------------------------------
    // Deduplication
    // ------------------------------------------------------------

    function observationFingerprint(record) {
        return [
            record.identityId,
            record.observedAt,
            record.latitude.toFixed(6),
            record.longitude.toFixed(6)
        ].join("|");
    }

    function deduplicate(records) {
        const seen = new Set();
        const output = [];

        for (const record of records) {
            const key = observationFingerprint(record);

            if (seen.has(key)) {
                state.rejectedDuplicate++;
                continue;
            }

            seen.add(key);
            output.push(record);
        }

        return output;
    }

    // ------------------------------------------------------------
    // Identity grouping
    // ------------------------------------------------------------

    function groupByIdentity(records) {
        const grouped = new Map();

        for (const record of records) {
            if (!grouped.has(record.identityId)) {
                grouped.set(record.identityId, []);
            }

            grouped.get(record.identityId).push(record);
        }

        for (const [identityId, points] of grouped.entries()) {
            points.sort(
                (a, b) =>
                    a.observedAt - b.observedAt
            );

            if (
                points.length >
                CONFIG.maxObservationsPerIdentity
            ) {
                grouped.set(
                    identityId,
                    points.slice(
                        -CONFIG.maxObservationsPerIdentity
                    )
                );
            }
        }

        return grouped;
    }

    // ------------------------------------------------------------
    // Sequential pair validation
    // ------------------------------------------------------------

    function validatePair(previous, current) {
        const deltaTimeMs =
            current.observedAt -
            previous.observedAt;

        if (
            deltaTimeMs < CONFIG.minDeltaTimeMs ||
            deltaTimeMs > CONFIG.maxDeltaTimeMs
        ) {
            state.rejectedDeltaTime++;

            return {
                valid: false,
                reason: "INVALID_DELTA_TIME"
            };
        }

        const distanceKm =
            haversineKm(previous, current);

        if (
            !Number.isFinite(distanceKm) ||
            distanceKm < CONFIG.minMovementKm
        ) {
            state.rejectedNoMovement++;

            return {
                valid: false,
                reason: "NO_MEANINGFUL_MOVEMENT"
            };
        }

        if (distanceKm > CONFIG.maxMovementKm) {
            state.rejectedJump++;

            return {
                valid: false,
                reason: "IMPOSSIBLE_SPATIAL_JUMP"
            };
        }

        const deltaHours =
            deltaTimeMs /
            3600000;

        const speedKmh =
            distanceKm /
            deltaHours;

        if (
            !Number.isFinite(speedKmh) ||
            speedKmh > CONFIG.maxSpeedKmh
        ) {
            state.rejectedSpeed++;

            return {
                valid: false,
                reason: "IMPOSSIBLE_SPEED"
            };
        }

        const bearing =
            bearingDegrees(previous, current);

        return {
            valid: true,
            deltaTimeMs,
            deltaSeconds: deltaTimeMs / 1000,
            deltaMinutes: deltaTimeMs / 60000,
            distanceKm,
            speedKmh,
            bearing
        };
    }

    // ------------------------------------------------------------
    // Sequential history reconstruction
    // ------------------------------------------------------------

    function buildSequentialHistory(grouped) {
        const sequentialPairs = [];
        const repairedHistory = [];
        const identitySummaries = [];

        for (const [identityId, observations] of grouped.entries()) {
            if (!Array.isArray(observations)) {
                continue;
            }

            if (observations.length < 2) {
                continue;
            }

            state.identitiesWithMultiplePoints++;

            const validPairsForIdentity = [];

            for (
                let i = 1;
                i < observations.length;
                i++
            ) {
                const previous =
                    observations[i - 1];

                const current =
                    observations[i];

                state.sequentialPairCount++;

                const validation =
                    validatePair(previous, current);

                if (!validation.valid) {
                    continue;
                }

                const pair = {
                    identityId,
                    persistentId: identityId,
                    canonicalTrackId: identityId,

                    previous,
                    current,

                    from: {
                        latitude: previous.latitude,
                        longitude: previous.longitude,
                        observedAt: previous.observedAt
                    },

                    to: {
                        latitude: current.latitude,
                        longitude: current.longitude,
                        observedAt: current.observedAt
                    },

                    deltaTimeMs:
                        validation.deltaTimeMs,

                    deltaSeconds:
                        validation.deltaSeconds,

                    deltaMinutes:
                        validation.deltaMinutes,

                    distanceKm:
                        validation.distanceKm,

                    speedKmh:
                        validation.speedKmh,

                    bearing:
                        validation.bearing,

                    source:
                        "39A-15F1",

                    status:
                        "VALID_SEQUENTIAL_OBSERVATION_PAIR"
                };

                state.validSequentialPairCount++;

                sequentialPairs.push(pair);
                validPairsForIdentity.push(pair);
            }

            if (validPairsForIdentity.length) {
                repairedHistory.push({
                    identityId,
                    persistentId: identityId,
                    canonicalTrackId: identityId,

                    observationCount:
                        observations.length,

                    pairCount:
                        validPairsForIdentity.length,

                    observations:
                        observations.slice(),

                    sequentialPairs:
                        validPairsForIdentity
                });
            }

            identitySummaries.push({
                identityId,
                observationCount:
                    observations.length,
                validPairCount:
                    validPairsForIdentity.length
            });
        }

        return {
            sequentialPairs,
            repairedHistory,
            identitySummaries
        };
    }

    // ------------------------------------------------------------
    // Publishing
    // ------------------------------------------------------------

    function publish(result) {
        global.RainGuardPersistentSequentialObservationsV39 =
            result.sequentialPairs;

        global.RainGuardPersistentSequentialObservationPairsV39 =
            result.sequentialPairs;

        global.RainGuardPersistentSequentialHistoryV39 =
            result.repairedHistory;

        global.RainGuardPersistentSequentialIdentityHistoryV39 =
            result.repairedHistory;

        global.RainGuardPersistentSequentialObservationRepairStateV39 =
            state;

        /*
         * Compatibility feed for 39A-15F.
         * 15F can consume these on its next run.
         */
        global.RainGuardPersistentMotionInputV39 =
            result.sequentialPairs;

        global.RainGuardPersistentMotionCandidatePairsV39 =
            result.sequentialPairs;

        try {
            global.dispatchEvent(
                new CustomEvent(
                    "rainguard:39a15f1:sequential-observations-ready",
                    {
                        detail: {
                            phase: PHASE,
                            version: VERSION,
                            pairCount:
                                result.sequentialPairs.length,
                            identityCount:
                                result.repairedHistory.length,
                            generatedAt:
                                Date.now()
                        }
                    }
                )
            );
        } catch (_) {
            // Event publishing is optional.
        }
    }

    // ------------------------------------------------------------
    // Reset per-run counters
    // ------------------------------------------------------------

    function resetRunCounters() {
        state.sourceRecords = 0;
        state.normalizedRecords = 0;
        state.rejectedRecords = 0;

        state.identityCount = 0;
        state.identitiesWithMultiplePoints = 0;

        state.sequentialPairCount = 0;
        state.validSequentialPairCount = 0;

        state.rejectedNoIdentity = 0;
        state.rejectedNoCoordinate = 0;
        state.rejectedInvalidCoordinate = 0;
        state.rejectedNoTimestamp = 0;
        state.rejectedDuplicate = 0;
        state.rejectedDeltaTime = 0;
        state.rejectedNoMovement = 0;
        state.rejectedJump = 0;
        state.rejectedSpeed = 0;
    }

    // ------------------------------------------------------------
    // Main engine
    // ------------------------------------------------------------

    async function runRainGuardPersistentSequentialObservationRepairBridge(
        options = {}
    ) {
        if (RUN_LOCK) {
            state.skippedRuns++;

            return {
                success: true,
                phase: PHASE,
                version: VERSION,
                status: "RUN_ALREADY_IN_PROGRESS",
                skipped: true
            };
        }

        RUN_LOCK = true;

        state.running = true;
        state.runInProgress = true;
        state.runs++;
        state.lastRunAt = Date.now();
        state.lastError = null;

        resetRunCounters();

        const startedAt = Date.now();

        try {
            const discovery =
                discoverSources();

            state.sourceRecords =
                discovery.records.length;

            if (!discovery.records.length) {
                const result = {
                    success: true,
                    phase: PHASE,
                    version: VERSION,
                    build: BUILD,

                    status:
                        "NO_PERSISTENT_OBSERVATION_SOURCES_FOUND",

                    sourceRecords: 0,
                    normalizedRecords: 0,
                    identityCount: 0,
                    validSequentialPairCount: 0,

                    sourceReports:
                        discovery.reports,

                    generatedAt:
                        Date.now()
                };

                publish({
                    sequentialPairs: [],
                    repairedHistory: [],
                    identitySummaries: []
                });

                state.lastResult = result;
                state.successfulRuns++;

                return result;
            }

            const normalized = [];

            for (const wrapper of discovery.records) {
                const record =
                    normalizeObservation(wrapper);

                if (record) {
                    normalized.push(record);
                }
            }

            const unique =
                deduplicate(normalized);

            const grouped =
                groupByIdentity(unique);

            state.identityCount =
                grouped.size;

            const repaired =
                buildSequentialHistory(grouped);

            publish(repaired);

            let status;

            if (
                repaired.sequentialPairs.length > 0
            ) {
                status =
                    "PERSISTENT_SEQUENTIAL_OBSERVATIONS_READY";
            } else if (
                state.identitiesWithMultiplePoints > 0
            ) {
                status =
                    "MULTIPLE_POINTS_FOUND_BUT_NO_VALID_MOTION_SEQUENCE";
            } else {
                status =
                    "IDENTITIES_FOUND_BUT_NO_MULTI_POINT_HISTORY";
            }

            const result = {
                success: true,

                phase: PHASE,
                version: VERSION,
                build: BUILD,

                status,

                sourceRecords:
                    state.sourceRecords,

                normalizedRecords:
                    state.normalizedRecords,

                uniqueRecords:
                    unique.length,

                rejectedRecords:
                    state.rejectedRecords,

                identityCount:
                    state.identityCount,

                identitiesWithMultiplePoints:
                    state.identitiesWithMultiplePoints,

                sequentialPairCount:
                    state.sequentialPairCount,

                validSequentialPairCount:
                    state.validSequentialPairCount,

                repairedIdentityCount:
                    repaired.repairedHistory.length,

                rejectionStats: {
                    noIdentity:
                        state.rejectedNoIdentity,

                    noCoordinate:
                        state.rejectedNoCoordinate,

                    invalidCoordinate:
                        state.rejectedInvalidCoordinate,

                    noTimestamp:
                        state.rejectedNoTimestamp,

                    duplicate:
                        state.rejectedDuplicate,

                    invalidDeltaTime:
                        state.rejectedDeltaTime,

                    noMovement:
                        state.rejectedNoMovement,

                    spatialJump:
                        state.rejectedJump,

                    impossibleSpeed:
                        state.rejectedSpeed
                },

                sourceReports:
                    discovery.reports,

                samplePairs:
                    repaired.sequentialPairs.slice(0, 10),

                sampleIdentities:
                    repaired.identitySummaries
                        .filter(
                            item =>
                                item.validPairCount > 0
                        )
                        .slice(0, 10),

                generatedAt:
                    Date.now(),

                durationMs:
                    Date.now() - startedAt
            };

            state.lastResult = result;
            state.lastSuccessAt = Date.now();
            state.successfulRuns++;

            console.log(
                "[RainGuard Phase 39A-15F1] Persistent Sequential Observation Repair result:",
                result
            );

            /*
             * Optional downstream trigger.
             * We only trigger 39A-15F if valid motion pairs exist.
             */
            if (
                repaired.sequentialPairs.length > 0 &&
                options.triggerMotionBuilder !== false &&
                typeof global.runRainGuardPersistentMotionVectorBuilder ===
                    "function"
            ) {
                try {
                    result.downstreamMotionBuilder =
                        await global.runRainGuardPersistentMotionVectorBuilder({
                            source:
                                "39A-15F1",
                            force: true
                        });
                } catch (error) {
                    result.downstreamMotionBuilder = {
                        success: false,
                        error: String(error)
                    };
                }
            }

            return result;

        } catch (error) {
            state.failures++;
            state.lastError =
                String(
                    error?.stack ||
                    error?.message ||
                    error
                );

            const result = {
                success: false,

                phase: PHASE,
                version: VERSION,
                build: BUILD,

                status:
                    "PERSISTENT_SEQUENTIAL_OBSERVATION_REPAIR_FAILED",

                error:
                    state.lastError,

                generatedAt:
                    Date.now(),

                durationMs:
                    Date.now() - startedAt
            };

            state.lastResult = result;

            console.error(
                "[RainGuard Phase 39A-15F1] Failure:",
                error
            );

            return result;

        } finally {
            RUN_LOCK = false;
            state.running = false;
            state.runInProgress = false;
        }
    }

    // ------------------------------------------------------------
    // Diagnostic API
    // ------------------------------------------------------------

    function diagnoseRainGuardPersistentSequentialObservationRepair() {
        const report = {
            phase: PHASE,
            version: VERSION,
            build: BUILD,

            installed: true,

            runnerAvailable:
                typeof global
                    .runRainGuardPersistentSequentialObservationRepairBridge ===
                "function",

            motionBuilderAvailable:
                typeof global
                    .runRainGuardPersistentMotionVectorBuilder ===
                "function",

            sequentialFeedAvailable:
                Array.isArray(
                    global
                        .RainGuardPersistentSequentialObservationsV39
                ),

            sequentialFeedCount:
                Array.isArray(
                    global
                        .RainGuardPersistentSequentialObservationsV39
                )
                    ? global
                        .RainGuardPersistentSequentialObservationsV39
                        .length
                    : 0,

            repairedHistoryCount:
                Array.isArray(
                    global
                        .RainGuardPersistentSequentialHistoryV39
                )
                    ? global
                        .RainGuardPersistentSequentialHistoryV39
                        .length
                    : 0,

            state: {
                ...state
            },

            generatedAt:
                Date.now()
        };

        console.log(
            "[RainGuard Phase 39A-15F1] Diagnostic:",
            report
        );

        return report;
    }

    function getRainGuardPersistentSequentialObservations() {
        return Array.isArray(
            global.RainGuardPersistentSequentialObservationsV39
        )
            ? global.RainGuardPersistentSequentialObservationsV39
            : [];
    }

    function getRainGuardPersistentSequentialHistory() {
        return Array.isArray(
            global.RainGuardPersistentSequentialHistoryV39
        )
            ? global.RainGuardPersistentSequentialHistoryV39
            : [];
    }

    // ------------------------------------------------------------
    // Public API
    // ------------------------------------------------------------

    global.runRainGuardPersistentSequentialObservationRepairBridge =
        runRainGuardPersistentSequentialObservationRepairBridge;

    global.diagnoseRainGuardPersistentSequentialObservationRepair =
        diagnoseRainGuardPersistentSequentialObservationRepair;

    global.getRainGuardPersistentSequentialObservations =
        getRainGuardPersistentSequentialObservations;

    global.getRainGuardPersistentSequentialHistory =
        getRainGuardPersistentSequentialHistory;

    global.RainGuardPersistentSequentialObservationRepairBridgeV39 = {
        phase: PHASE,
        version: VERSION,
        build: BUILD,
        config: CONFIG,
        state,

        run:
            runRainGuardPersistentSequentialObservationRepairBridge,

        diagnose:
            diagnoseRainGuardPersistentSequentialObservationRepair,

        getObservations:
            getRainGuardPersistentSequentialObservations,

        getHistory:
            getRainGuardPersistentSequentialHistory
    };

    console.log(
        "[RainGuard Phase 39A-15F1] Persistent Sequential Observation Repair Bridge installed.",
        {
            phase: PHASE,
            version: VERSION,
            build: BUILD
        }
    );

})(window);
