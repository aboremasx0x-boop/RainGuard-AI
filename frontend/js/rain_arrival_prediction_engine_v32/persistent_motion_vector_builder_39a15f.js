/**
 * RainGuard AI
 * Phase 39A-15F — Persistent Motion Vector Builder
 * File: persistent_motion_vector_builder_39a15f.js
 *
 * Purpose:
 * - Build motion vectors only from sequential observations that belong to the same persistent storm identity.
 * - Reject zero-distance, invalid-coordinate, invalid-time, and physically implausible jump vectors.
 * - Publish motion vectors for downstream ETA/adaptation phases.
 *
 * Safety principles:
 * - Never invent motion.
 * - Never calculate motion from two different identities.
 * - Never treat repeated coordinates as movement.
 */
(function installRainGuardPersistentMotionVectorBuilder(global) {
    "use strict";

    const PHASE = "39A-15F";
    const VERSION = "39A.15F.0";
    const BUILD = "rainguard-v39-persistent-motion-vector-builder";

    const CONFIG = {
        minDeltaTimeMs: 5 * 1000,              // 5 seconds
        maxDeltaTimeMs: 6 * 60 * 60 * 1000,   // 6 hours
        minDistanceKm: 0.05,                   // 50 m
        maxDistanceKm: 500,
        minSpeedKmh: 0.2,
        maxSpeedKmh: 180,
        maxVectorsPerIdentity: 50,
        autoStart: true,
        autoRunIntervalMs: 30 * 1000
    };

    const state = {
        installed: true,
        running: false,
        runInProgress: false,
        timer: null,
        lastError: null,
        lastResult: null,
        vectors: [],
        vectorsByIdentity: new Map(),
        statistics: {
            runs: 0,
            skippedRuns: 0,
            sourceIdentities: 0,
            observationsScanned: 0,
            candidatePairs: 0,
            vectorCount: 0,
            rejectedInvalidIdentity: 0,
            rejectedInvalidCoordinate: 0,
            rejectedInvalidTime: 0,
            rejectedSameTime: 0,
            rejectedZeroDistance: 0,
            rejectedDistanceJump: 0,
            rejectedSpeed: 0
        }
    };

    function isFiniteNumber(v) {
        return Number.isFinite(Number(v));
    }

    function toNumber(v) {
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
    }

    function validLatLon(lat, lon) {
        return (
            isFiniteNumber(lat) &&
            isFiniteNumber(lon) &&
            Number(lat) >= -90 &&
            Number(lat) <= 90 &&
            Number(lon) >= -180 &&
            Number(lon) <= 180 &&
            !(Number(lat) === 0 && Number(lon) === 0)
        );
    }

    function normalizeTimestamp(v) {
        if (v == null) return null;

        if (typeof v === "number" && Number.isFinite(v)) {
            // Convert seconds to ms if needed.
            return v < 1e12 ? Math.round(v * 1000) : Math.round(v);
        }

        if (typeof v === "string") {
            const n = Number(v);
            if (Number.isFinite(n)) {
                return n < 1e12 ? Math.round(n * 1000) : Math.round(n);
            }

            const t = Date.parse(v);
            return Number.isFinite(t) ? t : null;
        }

        if (v instanceof Date) {
            const t = v.getTime();
            return Number.isFinite(t) ? t : null;
        }

        return null;
    }

    function pickCoordinate(obj) {
        if (!obj || typeof obj !== "object") return null;

        const candidates = [
            obj.currentCoordinate,
            obj.coordinate,
            obj.coordinates,
            obj.position,
            obj.location,
            obj.point,
            obj.centroid,
            obj.center,
            obj
        ];

        for (const c of candidates) {
            if (!c || typeof c !== "object") continue;

            const lat = toNumber(
                c.lat ?? c.latitude ?? c.y ?? c.Latitude ?? c.LAT
            );
            const lon = toNumber(
                c.lon ?? c.lng ?? c.longitude ?? c.x ?? c.Longitude ?? c.LON
            );

            if (validLatLon(lat, lon)) {
                return { lat, lon };
            }
        }

        if (Array.isArray(obj.coordinates) && obj.coordinates.length >= 2) {
            const lon = toNumber(obj.coordinates[0]);
            const lat = toNumber(obj.coordinates[1]);
            if (validLatLon(lat, lon)) {
                return { lat, lon };
            }
        }

        return null;
    }

    function pickTimestamp(obj) {
        if (!obj || typeof obj !== "object") return null;

        const candidates = [
            obj.observedAt,
            obj.observed_at,
            obj.timestamp,
            obj.time,
            obj.ts,
            obj.updatedAt,
            obj.updated_at,
            obj.createdAt,
            obj.created_at,
            obj.lastSeenAt,
            obj.lastObservedAt,
            obj.currentCoordinate && obj.currentCoordinate.timestamp,
            obj.coordinate && obj.coordinate.timestamp
        ];

        for (const value of candidates) {
            const t = normalizeTimestamp(value);
            if (t != null) return t;
        }

        return null;
    }

    function pickIdentityId(obj, fallback) {
        if (!obj || typeof obj !== "object") return fallback || null;

        const id =
            obj.persistentId ??
            obj.persistentID ??
            obj.canonicalTrackId ??
            obj.trackId ??
            obj.trackID ??
            obj.cellId ??
            obj.cellID ??
            obj.id ??
            fallback ??
            null;

        if (id == null) return null;
        const s = String(id).trim();
        return s || null;
    }

    function normalizeObservation(obj, identityId, sourceLabel) {
        if (!obj || typeof obj !== "object") return null;

        const coord = pickCoordinate(obj);
        const timestamp = pickTimestamp(obj);
        const id = pickIdentityId(obj, identityId);

        if (!id) {
            state.statistics.rejectedInvalidIdentity++;
            return null;
        }

        if (!coord) {
            state.statistics.rejectedInvalidCoordinate++;
            return null;
        }

        if (!timestamp) {
            state.statistics.rejectedInvalidTime++;
            return null;
        }

        return {
            persistentId: id,
            trackId: obj.trackId ?? obj.trackID ?? null,
            cellId: obj.cellId ?? obj.cellID ?? null,
            latitude: coord.lat,
            longitude: coord.lon,
            observedAt: timestamp,
            intensity: toNumber(obj.intensity),
            confidence: toNumber(obj.confidence),
            source:
                obj.source ??
                obj.sourceName ??
                sourceLabel ??
                "unknown",
            raw: obj
        };
    }

    function pushAnyObservation(list, candidate, identityId, sourceLabel) {
        if (!candidate) return;

        if (Array.isArray(candidate)) {
            for (const item of candidate) {
                pushAnyObservation(list, item, identityId, sourceLabel);
            }
            return;
        }

        if (candidate instanceof Map) {
            for (const [key, value] of candidate.entries()) {
                pushAnyObservation(list, value, identityId || String(key), sourceLabel);
            }
            return;
        }

        if (candidate instanceof Set) {
            for (const value of candidate.values()) {
                pushAnyObservation(list, value, identityId, sourceLabel);
            }
            return;
        }

        if (candidate && typeof candidate === "object") {
            const normalized = normalizeObservation(candidate, identityId, sourceLabel);
            if (normalized) list.push(normalized);
        }
    }

    function extractFromPersistentIdentity(identity, sourceLabel) {
        const out = [];
        if (!identity || typeof identity !== "object") return out;

        const id = pickIdentityId(identity, null);
        const possibleBuckets = [
            identity.observations,
            identity.history,
            identity.points,
            identity.records,
            identity.timeline,
            identity.positions,
            identity.samples,
            identity.path,
            identity.track,
            identity.motionHistory,
            identity.coordinateHistory
        ];

        for (const bucket of possibleBuckets) {
            pushAnyObservation(out, bucket, id, sourceLabel);
        }

        // Include explicit first/last/current observations if present.
        [
            identity.firstObservation,
            identity.lastObservation,
            identity.currentObservation,
            identity.currentCoordinate,
            identity.coordinate,
            identity
        ].forEach(v => pushAnyObservation(out, v, id, sourceLabel));

        return out;
    }

    function collectSourceIdentities() {
        const sources = [
            ["RainGuardPersistentStormIdentitiesV39", global.RainGuardPersistentStormIdentitiesV39],
            ["RainGuardPersistentStormIdentities", global.RainGuardPersistentStormIdentities],
            ["RainGuardPersistentIdentitiesV39", global.RainGuardPersistentIdentitiesV39],
            ["RainGuardPersistentIdentityHistoryV39", global.RainGuardPersistentIdentityHistoryV39],
            ["RainGuardPersistentIdentityMotionHistoryV39", global.RainGuardPersistentIdentityMotionHistoryV39]
        ];

        const identities = [];

        for (const [sourceName, src] of sources) {
            if (!src) continue;

            if (Array.isArray(src)) {
                for (const item of src) {
                    identities.push({ sourceName, value: item });
                }
            } else if (src instanceof Map) {
                for (const [key, value] of src.entries()) {
                    if (value && typeof value === "object" && !pickIdentityId(value, null)) {
                        value.persistentId = String(key);
                    }
                    identities.push({ sourceName, value });
                }
            } else if (typeof src === "object") {
                for (const [key, value] of Object.entries(src)) {
                    if (!value) continue;

                    if (value && typeof value === "object" && !pickIdentityId(value, null)) {
                        try { value.persistentId = String(key); } catch (_) {}
                    }
                    identities.push({ sourceName, value });
                }
            }
        }

        // Fallback to function result if the linker publishes through a getter.
        const getters = [
            "getRainGuardPersistentStormIdentities",
            "getRainGuardPersistentStormIdentityReport",
            "getRainGuardPersistentIdentityHistory"
        ];

        for (const fnName of getters) {
            const fn = global[fnName];
            if (typeof fn !== "function") continue;

            try {
                const result = fn();
                const value = result && result.identities ? result.identities : result;

                if (Array.isArray(value)) {
                    for (const item of value) identities.push({ sourceName: fnName, value: item });
                } else if (value instanceof Map) {
                    for (const [key, item] of value.entries()) {
                        if (item && typeof item === "object" && !pickIdentityId(item, null)) {
                            item.persistentId = String(key);
                        }
                        identities.push({ sourceName: fnName, value: item });
                    }
                }
            } catch (_) {}
        }

        return identities;
    }

    function collectObservations() {
        const grouped = new Map();
        const identities = collectSourceIdentities();

        state.statistics.sourceIdentities = identities.length;

        for (const item of identities) {
            const records = extractFromPersistentIdentity(item.value, item.sourceName);

            for (const rec of records) {
                if (!grouped.has(rec.persistentId)) {
                    grouped.set(rec.persistentId, []);
                }
                grouped.get(rec.persistentId).push(rec);
                state.statistics.observationsScanned++;
            }
        }

        // Also consume bridge-produced persistent history objects if available.
        const historySources = [
            ["RainGuardPersistentIdentityMotionHistoryV39", global.RainGuardPersistentIdentityMotionHistoryV39],
            ["RainGuardPersistentStormObservationHistoryV39", global.RainGuardPersistentStormObservationHistoryV39],
            ["RainGuardPersistentStormObservationsV39", global.RainGuardPersistentStormObservationsV39]
        ];

        for (const [sourceName, src] of historySources) {
            if (!src) continue;

            const processValue = (key, value) => {
                const list = [];
                pushAnyObservation(list, value, key, sourceName);

                for (const rec of list) {
                    if (!grouped.has(rec.persistentId)) {
                        grouped.set(rec.persistentId, []);
                    }
                    grouped.get(rec.persistentId).push(rec);
                    state.statistics.observationsScanned++;
                }
            };

            if (src instanceof Map) {
                for (const [key, value] of src.entries()) {
                    processValue(String(key), value);
                }
            } else if (Array.isArray(src)) {
                src.forEach(v => processValue(null, v));
            } else if (typeof src === "object") {
                Object.entries(src).forEach(([k, v]) => processValue(k, v));
            }
        }

        return grouped;
    }

    function haversineKm(lat1, lon1, lat2, lon2) {
        const R = 6371.0088;
        const toRad = d => d * Math.PI / 180;

        const p1 = toRad(lat1);
        const p2 = toRad(lat2);
        const dp = toRad(lat2 - lat1);
        const dl = toRad(lon2 - lon1);

        const a =
            Math.sin(dp / 2) * Math.sin(dp / 2) +
            Math.cos(p1) * Math.cos(p2) *
            Math.sin(dl / 2) * Math.sin(dl / 2);

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    function bearingDeg(lat1, lon1, lat2, lon2) {
        const toRad = d => d * Math.PI / 180;
        const toDeg = r => r * 180 / Math.PI;

        const p1 = toRad(lat1);
        const p2 = toRad(lat2);
        const dl = toRad(lon2 - lon1);

        const y = Math.sin(dl) * Math.cos(p2);
        const x =
            Math.cos(p1) * Math.sin(p2) -
            Math.sin(p1) * Math.cos(p2) * Math.cos(dl);

        let brng = toDeg(Math.atan2(y, x));
        brng = (brng + 360) % 360;
        return brng;
    }

    function speedComponents(speedKmh, bearingDegrees) {
        const r = bearingDegrees * Math.PI / 180;
        const eastKmh = Math.sin(r) * speedKmh;
        const northKmh = Math.cos(r) * speedKmh;

        return {
            eastKmh,
            northKmh,
            eastMs: eastKmh / 3.6,
            northMs: northKmh / 3.6
        };
    }

    function buildVector(a, b) {
        if (!a || !b || a.persistentId !== b.persistentId) {
            state.statistics.rejectedInvalidIdentity++;
            return null;
        }

        const dtMs = b.observedAt - a.observedAt;

        if (!Number.isFinite(dtMs)) {
            state.statistics.rejectedInvalidTime++;
            return null;
        }

        if (dtMs === 0) {
            state.statistics.rejectedSameTime++;
            return null;
        }

        if (dtMs < CONFIG.minDeltaTimeMs || dtMs > CONFIG.maxDeltaTimeMs) {
            state.statistics.rejectedInvalidTime++;
            return null;
        }

        const distanceKm = haversineKm(
            a.latitude, a.longitude,
            b.latitude, b.longitude
        );

        if (!Number.isFinite(distanceKm)) {
            state.statistics.rejectedInvalidCoordinate++;
            return null;
        }

        if (distanceKm < CONFIG.minDistanceKm) {
            state.statistics.rejectedZeroDistance++;
            return null;
        }

        if (distanceKm > CONFIG.maxDistanceKm) {
            state.statistics.rejectedDistanceJump++;
            return null;
        }

        const hours = dtMs / 3600000;
        const speedKmh = distanceKm / hours;

        if (
            !Number.isFinite(speedKmh) ||
            speedKmh < CONFIG.minSpeedKmh ||
            speedKmh > CONFIG.maxSpeedKmh
        ) {
            state.statistics.rejectedSpeed++;
            return null;
        }

        const bearing = bearingDeg(
            a.latitude, a.longitude,
            b.latitude, b.longitude
        );

        const components = speedComponents(speedKmh, bearing);

        return {
            persistentId: a.persistentId,
            trackId: b.trackId || a.trackId || null,
            cellId: b.cellId || a.cellId || null,

            from: {
                latitude: a.latitude,
                longitude: a.longitude,
                observedAt: a.observedAt,
                source: a.source
            },

            to: {
                latitude: b.latitude,
                longitude: b.longitude,
                observedAt: b.observedAt,
                source: b.source
            },

            deltaTimeMs: dtMs,
            deltaTimeMinutes: dtMs / 60000,
            distanceKm,
            speedKmh,
            speedMs: speedKmh / 3.6,
            bearingDegrees: bearing,

            eastKmh: components.eastKmh,
            northKmh: components.northKmh,
            eastMs: components.eastMs,
            northMs: components.northMs,

            confidence: (() => {
                const c1 = toNumber(a.confidence);
                const c2 = toNumber(b.confidence);
                if (c1 == null && c2 == null) return null;
                if (c1 == null) return c2;
                if (c2 == null) return c1;
                return (c1 + c2) / 2;
            })(),

            generatedAt: Date.now(),
            phase: PHASE,
            version: VERSION
        };
    }

    function deduplicateObservations(records) {
        const map = new Map();

        for (const r of records) {
            const key = [
                r.persistentId,
                r.latitude.toFixed(5),
                r.longitude.toFixed(5),
                r.observedAt
            ].join("|");

            if (!map.has(key)) map.set(key, r);
        }

        return Array.from(map.values()).sort((a, b) => a.observedAt - b.observedAt);
    }

    function buildVectorsForIdentity(identityId, records) {
        const sorted = deduplicateObservations(records);
        const vectors = [];

        for (let i = 1; i < sorted.length; i++) {
            const prev = sorted[i - 1];
            const curr = sorted[i];

            state.statistics.candidatePairs++;

            const v = buildVector(prev, curr);
            if (v) vectors.push(v);
        }

        if (vectors.length > CONFIG.maxVectorsPerIdentity) {
            return vectors.slice(-CONFIG.maxVectorsPerIdentity);
        }

        return vectors;
    }

    function publish(vectorsByIdentity) {
        const all = [];

        for (const [id, vectors] of vectorsByIdentity.entries()) {
            for (const v of vectors) all.push(v);
        }

        all.sort((a, b) => b.to.observedAt - a.to.observedAt);

        state.vectorsByIdentity = vectorsByIdentity;
        state.vectors = all;
        state.statistics.vectorCount = all.length;

        global.RainGuardPersistentMotionVectorsV39 = all;
        global.RainGuardPersistentMotionVectorsByIdentityV39 = vectorsByIdentity;

        // Compatibility aliases for downstream stages.
        global.RainGuardStormMotionVectorsV39 =
            Array.isArray(global.RainGuardStormMotionVectorsV39)
                ? global.RainGuardStormMotionVectorsV39
                : [];

        global.RainGuardRecoveredPersistentMotionVectorsV39 = all;

        return all;
    }

    async function runRainGuardPersistentMotionVectorBuilder(options = {}) {
        if (state.runInProgress) {
            state.statistics.skippedRuns++;
            return state.lastResult || {
                success: true,
                phase: PHASE,
                version: VERSION,
                status: "RUN_ALREADY_IN_PROGRESS"
            };
        }

        state.runInProgress = true;
        state.statistics.runs++;

        try {
            // Run upstream bridges first when available.
            const upstream = [
                "runRainGuardPersistentStormObservationAccumulator",
                "runRainGuardPersistentStormIdentityLinker",
                "runRainGuardPersistentIdentityNestedCoordinateBridge",
                "runRainGuardPersistentIdentityMotionHistoryBridge"
            ];

            for (const name of upstream) {
                if (typeof global[name] === "function") {
                    try {
                        const r = global[name]({ force: true });
                        if (r && typeof r.then === "function") {
                            await r;
                        }
                    } catch (_) {}
                }
            }

            // Reset per-run counters that should reflect this execution.
            state.statistics.sourceIdentities = 0;
            state.statistics.observationsScanned = 0;
            state.statistics.candidatePairs = 0;
            state.statistics.vectorCount = 0;

            const grouped = collectObservations();
            const vectorsByIdentity = new Map();

            for (const [identityId, records] of grouped.entries()) {
                const vectors = buildVectorsForIdentity(identityId, records);
                if (vectors.length) {
                    vectorsByIdentity.set(identityId, vectors);
                }
            }

            const vectors = publish(vectorsByIdentity);

            let status = "PERSISTENT_MOTION_VECTORS_READY";

            if (!grouped.size) {
                status = "NO_PERSISTENT_IDENTITIES_FOUND";
            } else if (!vectors.length) {
                status = "PERSISTENT_HISTORY_FOUND_BUT_NO_VALID_SEQUENTIAL_MOTION";
            }

            const result = {
                success: true,
                phase: PHASE,
                version: VERSION,
                build: BUILD,
                status,
                sourceIdentityCount: grouped.size,
                vectorIdentityCount: vectorsByIdentity.size,
                vectorCount: vectors.length,
                vectors,
                statistics: { ...state.statistics },
                generatedAt: Date.now()
            };

            state.lastResult = result;
            state.lastError = null;

            if (!options.silent) {
                console.log("[RainGuard Phase 39A-15F] Persistent Motion Vector Builder result:", result);
            }

            return result;

        } catch (error) {
            state.lastError = error;

            const result = {
                success: false,
                phase: PHASE,
                version: VERSION,
                build: BUILD,
                status: "PERSISTENT_MOTION_VECTOR_BUILDER_FAILED",
                error: error && error.message ? error.message : String(error),
                generatedAt: Date.now()
            };

            state.lastResult = result;
            console.error("[RainGuard Phase 39A-15F] Failed:", error);
            return result;

        } finally {
            state.runInProgress = false;
        }
    }

    function getRainGuardPersistentMotionVectors(identityId) {
        if (identityId == null) {
            return state.vectors.slice();
        }

        const key = String(identityId);
        const list = state.vectorsByIdentity.get(key);
        return Array.isArray(list) ? list.slice() : [];
    }

    function getRainGuardPersistentMotionVector(identityId) {
        const list = getRainGuardPersistentMotionVectors(identityId);
        return list.length ? list[list.length - 1] : null;
    }

    function diagnoseRainGuardPersistentMotionVectorBuilder() {
        return {
            phase: PHASE,
            version: VERSION,
            build: BUILD,
            installed: state.installed,
            running: state.running,
            runInProgress: state.runInProgress,
            lastError: state.lastError,
            lastResult: state.lastResult,
            vectorCount: state.vectors.length,
            vectorIdentityCount: state.vectorsByIdentity.size,
            statistics: { ...state.statistics },
            config: { ...CONFIG }
        };
    }

    function stopRainGuardPersistentMotionVectorBuilder() {
        if (state.timer) {
            clearInterval(state.timer);
            state.timer = null;
        }
        state.running = false;

        return {
            success: true,
            phase: PHASE,
            version: VERSION,
            status: "PERSISTENT_MOTION_VECTOR_BUILDER_STOPPED"
        };
    }

    function startRainGuardPersistentMotionVectorBuilder() {
        if (state.running) {
            return {
                success: true,
                phase: PHASE,
                version: VERSION,
                status: "PERSISTENT_MOTION_VECTOR_BUILDER_ALREADY_RUNNING"
            };
        }

        state.running = true;

        runRainGuardPersistentMotionVectorBuilder({ silent: true });

        state.timer = setInterval(() => {
            runRainGuardPersistentMotionVectorBuilder({ silent: true });
        }, CONFIG.autoRunIntervalMs);

        return {
            success: true,
            phase: PHASE,
            version: VERSION,
            status: "PERSISTENT_MOTION_VECTOR_BUILDER_STARTED"
        };
    }

    global.runRainGuardPersistentMotionVectorBuilder =
        runRainGuardPersistentMotionVectorBuilder;

    global.getRainGuardPersistentMotionVectors =
        getRainGuardPersistentMotionVectors;

    global.getRainGuardPersistentMotionVector =
        getRainGuardPersistentMotionVector;

    global.diagnoseRainGuardPersistentMotionVectorBuilder =
        diagnoseRainGuardPersistentMotionVectorBuilder;

    global.startRainGuardPersistentMotionVectorBuilder =
        startRainGuardPersistentMotionVectorBuilder;

    global.stopRainGuardPersistentMotionVectorBuilder =
        stopRainGuardPersistentMotionVectorBuilder;

    global.RainGuardPersistentMotionVectorBuilderV39 = {
        phase: PHASE,
        version: VERSION,
        build: BUILD,
        config: CONFIG,
        state,
        run: runRainGuardPersistentMotionVectorBuilder,
        start: startRainGuardPersistentMotionVectorBuilder,
        stop: stopRainGuardPersistentMotionVectorBuilder,
        getVectors: getRainGuardPersistentMotionVectors,
        getVector: getRainGuardPersistentMotionVector,
        diagnose: diagnoseRainGuardPersistentMotionVectorBuilder
    };

    console.log(
        "[RainGuard Phase 39A-15F] Persistent Motion Vector Builder installed",
        {
            phase: PHASE,
            version: VERSION,
            build: BUILD
        }
    );

    if (CONFIG.autoStart) {
        setTimeout(() => {
            try {
                startRainGuardPersistentMotionVectorBuilder();
            } catch (error) {
                console.error(
                    "[RainGuard Phase 39A-15F] Auto-start failed:",
                    error
                );
            }
        }, 1200);
    }

})(window);
