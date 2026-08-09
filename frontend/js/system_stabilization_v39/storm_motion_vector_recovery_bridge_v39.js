/*
===============================================================================
 RainGuard AI
 Phase 39A-15 — Storm Motion Vector Recovery Bridge
 File: storm_motion_vector_recovery_bridge_v39.js
 Version: 39A.15.0

 Purpose:
 - Recover real storm motion vectors from existing track/history observations.
 - Compute speedKmh and directionDeg only from timestamped coordinates.
 - Attach recovered motion to current storm entities / Phase 39A-13 matches.
 - Feed Phase 39A-14 without inventing motion or ETA values.
===============================================================================
*/

(function initializeStormMotionVectorRecoveryBridgeV39(global) {
    "use strict";

    const PHASE = "39A-15";
    const VERSION = "39A.15.0";
    const BUILD = "rainguard-v39-storm-motion-vector-recovery-bridge";

    const CONFIG = Object.freeze({
        autoStart: true,
        refreshIntervalMs: 5000,
        maxHistoryAgeMs: 6 * 60 * 60 * 1000,
        minTimeDeltaMs: 5000,
        maxTimeDeltaMs: 3 * 60 * 60 * 1000,
        minDistanceKm: 0.05,
        maxPlausibleSpeedKmh: 250,
        maxTracksPerRun: 1000,
        smoothingPairs: 3
    });

    const now = () => Date.now();

    function finite(v) {
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
    }

    function clone(v) {
        if (v == null) return v;
        try {
            return structuredClone(v);
        } catch (_) {
            try {
                return JSON.parse(JSON.stringify(v));
            } catch (_) {
                return v;
            }
        }
    }

    function normalizeError(error) {
        return {
            name: error?.name || "Error",
            message: error?.message || String(error),
            stack: error?.stack || null,
            timestamp: now()
        };
    }

    function toArray(value) {
        if (!value) return [];
        if (Array.isArray(value)) return value;
        if (value instanceof Map || value instanceof Set) {
            return Array.from(value.values());
        }
        if (typeof value.values === "function") {
            try { return Array.from(value.values()); } catch (_) {}
        }
        if (typeof value === "object") {
            for (const key of [
                "history","histories","tracks","trackHistory","trackHistories",
                "observations","points","samples","entities","items","data",
                "results","result","payload","output"
            ]) {
                const nested = value[key];
                if (Array.isArray(nested)) return nested;
                if (nested instanceof Map || nested instanceof Set) {
                    return Array.from(nested.values());
                }
            }
        }
        return [];
    }

    function normalizeTimestamp(value) {
        if (value == null) return null;

        if (typeof value === "number") {
            if (!Number.isFinite(value)) return null;
            return value < 1e12 ? value * 1000 : value;
        }

        const parsed = Date.parse(value);
        return Number.isFinite(parsed) ? parsed : null;
    }

    function extractCoordinates(raw) {
        if (!raw || typeof raw !== "object") {
            return { latitude: null, longitude: null };
        }

        return {
            latitude: finite(
                raw.latitude ?? raw.lat ??
                raw.position?.latitude ?? raw.position?.lat ??
                raw.center?.latitude ?? raw.center?.lat ??
                raw.location?.latitude ?? raw.location?.lat ??
                raw.coordinates?.latitude ?? raw.coordinates?.lat
            ),
            longitude: finite(
                raw.longitude ?? raw.lon ?? raw.lng ??
                raw.position?.longitude ?? raw.position?.lon ?? raw.position?.lng ??
                raw.center?.longitude ?? raw.center?.lon ?? raw.center?.lng ??
                raw.location?.longitude ?? raw.location?.lon ?? raw.location?.lng ??
                raw.coordinates?.longitude ?? raw.coordinates?.lon ?? raw.coordinates?.lng
            )
        };
    }

    function extractTimestamp(raw) {
        if (!raw || typeof raw !== "object") return null;

        return normalizeTimestamp(
            raw.timestamp ??
            raw.time ??
            raw.ts ??
            raw.observedAt ??
            raw.updatedAt ??
            raw.createdAt ??
            raw.capturedAt ??
            raw.detectedAt ??
            raw.frameTime ??
            raw.datetime
        );
    }

    function extractEntityId(raw) {
        if (!raw || typeof raw !== "object") return null;

        const id =
            raw.stormEntityId ??
            raw.entityId ??
            raw.trackId ??
            raw.stableTrackId ??
            raw.cellId ??
            raw.stormId ??
            raw.id ??
            raw.key;

        return id == null ? null : String(id);
    }

    function haversineKm(lat1, lon1, lat2, lon2) {
        const rad = d => d * Math.PI / 180;
        const R = 6371;

        const dLat = rad(lat2 - lat1);
        const dLon = rad(lon2 - lon1);

        const a =
            Math.sin(dLat / 2) ** 2 +
            Math.cos(rad(lat1)) *
            Math.cos(rad(lat2)) *
            Math.sin(dLon / 2) ** 2;

        return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    function bearingDeg(lat1, lon1, lat2, lon2) {
        const rad = d => d * Math.PI / 180;
        const deg = r => r * 180 / Math.PI;

        const p1 = rad(lat1);
        const p2 = rad(lat2);
        const dl = rad(lon2 - lon1);

        const y = Math.sin(dl) * Math.cos(p2);
        const x =
            Math.cos(p1) * Math.sin(p2) -
            Math.sin(p1) * Math.cos(p2) * Math.cos(dl);

        return (deg(Math.atan2(y, x)) + 360) % 360;
    }

    function circularMeanDegrees(values) {
        const valid = values.filter(Number.isFinite);
        if (!valid.length) return null;

        let x = 0;
        let y = 0;

        for (const angle of valid) {
            const r = angle * Math.PI / 180;
            x += Math.cos(r);
            y += Math.sin(r);
        }

        return (Math.atan2(y / valid.length, x / valid.length) * 180 / Math.PI + 360) % 360;
    }

    function normalizePoint(raw, inheritedId = null) {
        const coords = extractCoordinates(raw);
        const timestamp = extractTimestamp(raw);

        if (
            coords.latitude === null ||
            coords.longitude === null ||
            timestamp === null
        ) {
            return null;
        }

        return {
            entityId: extractEntityId(raw) || inheritedId,
            latitude: coords.latitude,
            longitude: coords.longitude,
            timestamp,
            raw
        };
    }

    function collectHistorySources() {
        const candidates = [
            ["RainArrivalLiveTrackHistoryCaptureV32", global.RainArrivalLiveTrackHistoryCaptureV32],
            ["RainArrivalPersistentTrackHistoryV32", global.RainArrivalPersistentTrackHistoryV32],
            ["RainArrivalMotionVectorHistoryV32", global.RainArrivalMotionVectorHistoryV32],
            ["RainArrivalStableTrackIdentityV32", global.RainArrivalStableTrackIdentityV32],
            ["RainGuardAI.V32.liveTrackHistory", global.RainGuardAI?.V32?.liveTrackHistory],
            ["RainGuardAI.V32.trackHistory", global.RainGuardAI?.V32?.trackHistory],
            ["RainGuardAI.V32.motionVectorHistory", global.RainGuardAI?.V32?.motionVectorHistory]
        ];

        return candidates.filter(([, value]) => Boolean(value));
    }

    function extractFromSource(sourceName, source) {
        const records = [];

        const pushArray = (value, inheritedId = null) => {
            const arr = toArray(value);

            for (const item of arr) {
                if (!item || typeof item !== "object") continue;

                const nestedPoints =
                    toArray(
                        item.points ??
                        item.history ??
                        item.observations ??
                        item.samples ??
                        item.positions
                    );

                const itemId = extractEntityId(item) || inheritedId;

                if (nestedPoints.length) {
                    for (const point of nestedPoints) {
                        const normalized = normalizePoint(point, itemId);
                        if (normalized) records.push(normalized);
                    }
                } else {
                    const normalized = normalizePoint(item, inheritedId);
                    if (normalized) records.push(normalized);
                }
            }
        };

        try {
            if (typeof source?.getAll === "function") {
                pushArray(source.getAll());
            }
        } catch (_) {}

        try {
            if (typeof source?.getHistory === "function") {
                pushArray(source.getHistory());
            }
        } catch (_) {}

        try {
            if (typeof source?.getHistories === "function") {
                pushArray(source.getHistories());
            }
        } catch (_) {}

        try {
            if (typeof source?.getTracks === "function") {
                pushArray(source.getTracks());
            }
        } catch (_) {}

        for (const key of [
            "history","histories","tracks","trackHistory","trackHistories",
            "observations","points","samples","items","data","lastResult"
        ]) {
            try {
                pushArray(source?.[key]);
            } catch (_) {}
        }

        return {
            sourceName,
            records
        };
    }

    function groupPoints(records) {
        const groups = new Map();
        const cutoff = now() - CONFIG.maxHistoryAgeMs;

        for (const point of records) {
            if (
                !point.entityId ||
                point.timestamp < cutoff
            ) {
                continue;
            }

            if (!groups.has(point.entityId)) {
                groups.set(point.entityId, []);
            }

            groups.get(point.entityId).push(point);
        }

        for (const points of groups.values()) {
            points.sort((a, b) => a.timestamp - b.timestamp);
        }

        return groups;
    }

    function recoverVector(entityId, points) {
        if (!Array.isArray(points) || points.length < 2) return null;

        const pairs = [];

        for (let i = 1; i < points.length; i += 1) {
            const a = points[i - 1];
            const b = points[i];

            const dtMs = b.timestamp - a.timestamp;

            if (
                dtMs < CONFIG.minTimeDeltaMs ||
                dtMs > CONFIG.maxTimeDeltaMs
            ) {
                continue;
            }

            const distanceKm = haversineKm(
                a.latitude,
                a.longitude,
                b.latitude,
                b.longitude
            );

            if (distanceKm < CONFIG.minDistanceKm) continue;

            const hours = dtMs / 3600000;
            const speedKmh = distanceKm / hours;

            if (
                !Number.isFinite(speedKmh) ||
                speedKmh <= 0 ||
                speedKmh > CONFIG.maxPlausibleSpeedKmh
            ) {
                continue;
            }

            pairs.push({
                from: a,
                to: b,
                distanceKm,
                dtMs,
                speedKmh,
                directionDeg: bearingDeg(
                    a.latitude,
                    a.longitude,
                    b.latitude,
                    b.longitude
                )
            });
        }

        if (!pairs.length) return null;

        const selected =
            pairs.slice(
                Math.max(
                    0,
                    pairs.length - CONFIG.smoothingPairs
                )
            );

        const speedKmh =
            selected.reduce(
                (sum, pair) => sum + pair.speedKmh,
                0
            ) / selected.length;

        const directionDeg =
            circularMeanDegrees(
                selected.map(pair => pair.directionDeg)
            );

        const latest = selected[selected.length - 1];

        return {
            entityId,
            speedKmh: Math.round(speedKmh * 10) / 10,
            directionDeg: Math.round(directionDeg * 10) / 10,
            sampleCount: selected.length,
            totalHistoryPoints: points.length,
            lastObservedAt: latest.to.timestamp,
            lastLatitude: latest.to.latitude,
            lastLongitude: latest.to.longitude,
            lastSegmentDistanceKm:
                Math.round(latest.distanceKm * 100) / 100,
            lastSegmentDurationMs: latest.dtMs,
            source: "track-history-displacement",
            recoveredAt: now()
        };
    }

    function resolveCollector() {
        return (
            global.RainArrivalStormEntityCollectorV32 ||
            global.RainGuardAI?.V32?.rainArrivalModules?.stormEntityCollector ||
            null
        );
    }

    function resolveMatchingBridge() {
        return (
            global.RainGuardCityStormEntityMatchingBridgeV39 ||
            global.RainGuardAI?.V39?.cityStormEntityMatchingBridge ||
            null
        );
    }

    function resolveEtaAdapter() {
        return (
            global.RainGuardMatchedStormArrivalEtaAdapterV39 ||
            global.RainGuardAI?.V39?.matchedStormArrivalEtaAdapterInstance ||
            null
        );
    }

    function applyVectorToRawEntity(raw, vector) {
        if (!raw || typeof raw !== "object" || !vector) return false;

        raw.speedKmh = vector.speedKmh;
        raw.directionDeg = vector.directionDeg;

        raw.motion = {
            ...(raw.motion || {}),
            speedKmh: vector.speedKmh,
            directionDeg: vector.directionDeg,
            source: PHASE,
            recoveredAt: vector.recoveredAt
        };

        raw.motionVector = {
            ...(raw.motionVector || {}),
            speedKmh: vector.speedKmh,
            directionDeg: vector.directionDeg,
            source: PHASE,
            recoveredAt: vector.recoveredAt
        };

        return true;
    }

    class StormMotionVectorRecoveryBridgeV39 {
        constructor() {
            this.phase = PHASE;
            this.version = VERSION;
            this.build = BUILD;

            this.running = false;
            this.runInProgress = false;
            this.timer = null;

            this.vectors = new Map();
            this.lastResult = null;
            this.lastError = null;

            this.statistics = {
                runs: 0,
                skippedRuns: 0,
                sourceRecords: 0,
                groupedTracks: 0,
                recoveredVectors: 0,
                entitiesPatched: 0,
                matchesPatched: 0,
                failures: 0
            };
        }

        collectHistory() {
            const sourceReports = [];
            const allRecords = [];

            for (const [name, source] of collectHistorySources()) {
                const report = extractFromSource(name, source);

                sourceReports.push({
                    source: name,
                    recordCount: report.records.length
                });

                allRecords.push(...report.records);
            }

            return {
                sourceReports,
                records: allRecords
            };
        }

        recover(records) {
            const groups = groupPoints(records);
            const vectors = new Map();

            let processed = 0;

            for (const [entityId, points] of groups.entries()) {
                if (processed >= CONFIG.maxTracksPerRun) break;
                processed += 1;

                const vector = recoverVector(entityId, points);

                if (vector) {
                    vectors.set(entityId, vector);
                }
            }

            return {
                groups,
                vectors
            };
        }

        patchCollector(vectors) {
            const collector = resolveCollector();
            if (!collector) return 0;

            let entities = [];

            try {
                if (typeof collector.getAll === "function") {
                    entities = toArray(collector.getAll());
                }
            } catch (_) {}

            if (!entities.length) {
                entities = toArray(
                    collector.entities ??
                    collector.lastResult?.entities
                );
            }

            let patched = 0;

            for (const raw of entities) {
                const id = extractEntityId(raw);
                const vector = id ? vectors.get(id) : null;

                if (vector && applyVectorToRawEntity(raw, vector)) {
                    patched += 1;
                }
            }

            /*
             * If collector uses a Map internally, patch stored references too.
             */
            if (collector.entities instanceof Map) {
                for (const [key, raw] of collector.entities.entries()) {
                    const id = extractEntityId(raw) || String(key);
                    const vector = vectors.get(id);

                    if (vector && applyVectorToRawEntity(raw, vector)) {
                        patched += 1;
                    }
                }
            }

            return patched;
        }

        patchMatching(vectors) {
            const bridge = resolveMatchingBridge();
            const result =
                bridge?.lastResult ??
                global.RainGuardAI?.V39?.cityStormEntityMatching ??
                null;

            if (!result) return 0;

            const containers = [];

            if (Array.isArray(result.bestMatches)) {
                containers.push(result.bestMatches);
            }

            if (
                result.matchesByCity &&
                typeof result.matchesByCity === "object"
            ) {
                for (const value of Object.values(result.matchesByCity)) {
                    if (Array.isArray(value)) {
                        containers.push(value);
                    }
                }
            }

            let patched = 0;

            for (const items of containers) {
                for (const match of items) {
                    const id =
                        String(
                            match.stormEntityId ??
                            extractEntityId(match.rawStormEntity) ??
                            ""
                        );

                    if (!id) continue;

                    const vector = vectors.get(id);

                    if (!vector) continue;

                    match.speedKmh = vector.speedKmh;
                    match.stormDirectionDeg = vector.directionDeg;
                    match.motionRecoveredBy = PHASE;
                    match.motionRecoveredAt = vector.recoveredAt;

                    applyVectorToRawEntity(
                        match.rawStormEntity,
                        vector
                    );

                    patched += 1;
                }
            }

            return patched;
        }

        publish(vectors, result) {
            const object =
                Object.fromEntries(
                    vectors.entries()
                );

            global.RainGuardStormMotionVectorsV39 = object;

            global.RainGuardAI =
                global.RainGuardAI || {};

            global.RainGuardAI.V39 =
                global.RainGuardAI.V39 || {};

            global.RainGuardAI.V32 =
                global.RainGuardAI.V32 || {};

            global.RainGuardAI.V39.stormMotionVectorRecovery =
                result;

            global.RainGuardAI.V39.stormMotionVectors =
                object;

            global.RainGuardAI.V32.stormMotionVectors =
                object;
        }

        async run(options = {}) {
            if (this.runInProgress) {
                this.statistics.skippedRuns += 1;

                return {
                    success: true,
                    skipped: true,
                    phase: PHASE,
                    status: "MOTION_VECTOR_RECOVERY_ALREADY_RUNNING"
                };
            }

            this.runInProgress = true;
            this.statistics.runs += 1;

            try {
                const history = this.collectHistory();

                this.statistics.sourceRecords +=
                    history.records.length;

                const recovered =
                    this.recover(
                        history.records
                    );

                this.statistics.groupedTracks +=
                    recovered.groups.size;

                this.statistics.recoveredVectors +=
                    recovered.vectors.size;

                this.vectors =
                    recovered.vectors;

                const entitiesPatched =
                    this.patchCollector(
                        recovered.vectors
                    );

                const matchesPatched =
                    this.patchMatching(
                        recovered.vectors
                    );

                this.statistics.entitiesPatched += entitiesPatched;
                this.statistics.matchesPatched += matchesPatched;

                const status =
                    recovered.vectors.size > 0
                        ? "STORM_MOTION_VECTORS_RECOVERED"
                        : (
                            history.records.length > 0
                                ? "TRACK_HISTORY_PRESENT_NO_VALID_MOTION"
                                : "NO_TRACK_HISTORY_AVAILABLE"
                        );

                const result = {
                    success: true,
                    phase: PHASE,
                    version: VERSION,
                    status,

                    historyRecordCount:
                        history.records.length,

                    groupedTrackCount:
                        recovered.groups.size,

                    recoveredVectorCount:
                        recovered.vectors.size,

                    entitiesPatched,
                    matchesPatched,

                    sourceReports:
                        history.sourceReports,

                    sample:
                        Array.from(
                            recovered.vectors.values()
                        ).slice(0, 10),

                    generatedAt:
                        now()
                };

                this.lastResult = result;
                this.lastError = null;

                this.publish(
                    recovered.vectors,
                    result
                );

                /*
                 * Refresh Phase 39A-13 after patching, then Phase 39A-14.
                 * This preserves the correct order:
                 * history → motion → matching → ETA candidates.
                 */
                if (options.refreshDownstream !== false) {
                    const matching = resolveMatchingBridge();

                    if (
                        matching &&
                        typeof matching.run === "function"
                    ) {
                        try {
                            matching.run();
                        } catch (_) {}
                    }

                    /*
                     * Patch again because matching.run() may create new objects.
                     */
                    this.patchMatching(
                        recovered.vectors
                    );

                    const etaAdapter = resolveEtaAdapter();

                    if (
                        etaAdapter &&
                        typeof etaAdapter.run === "function"
                    ) {
                        try {
                            await Promise.resolve(
                                etaAdapter.run()
                            );
                        } catch (_) {}
                    }
                }

                return result;

            } catch (error) {
                this.statistics.failures += 1;

                this.lastError =
                    normalizeError(error);

                const result = {
                    success: false,
                    phase: PHASE,
                    version: VERSION,
                    status: "STORM_MOTION_VECTOR_RECOVERY_FAILED",
                    error: this.lastError,
                    generatedAt: now()
                };

                this.lastResult = result;
                return result;

            } finally {
                this.runInProgress = false;
            }
        }

        getVector(entityId) {
            return clone(
                this.vectors.get(
                    String(entityId)
                ) || null
            );
        }

        getAll() {
            return Array.from(
                this.vectors.values()
            ).map(clone);
        }

        diagnose() {
            const result = {
                phase: PHASE,
                version: VERSION,
                build: BUILD,
                running: this.running,
                runInProgress: this.runInProgress,
                lastError: this.lastError,
                vectorCount: this.vectors.size,
                statistics: { ...this.statistics },
                result: this.lastResult
            };

            console.log(
                "[RainGuard Phase 39A-15] Storm Motion Vector Recovery Bridge",
                result
            );

            return result;
        }

        start() {
            if (this.running) {
                return {
                    success: true,
                    alreadyRunning: true
                };
            }

            this.running = true;

            Promise.resolve(
                this.run()
            ).catch(
                error => {
                    this.lastError =
                        normalizeError(error);
                }
            );

            this.timer =
                global.setInterval(
                    () => {
                        Promise.resolve(
                            this.run()
                        ).catch(
                            error => {
                                this.lastError =
                                    normalizeError(error);
                            }
                        );
                    },
                    CONFIG.refreshIntervalMs
                );

            return {
                success: true,
                running: true,
                intervalMs: CONFIG.refreshIntervalMs
            };
        }

        stop() {
            if (this.timer) {
                global.clearInterval(this.timer);
            }

            this.timer = null;
            this.running = false;

            return {
                success: true,
                running: false
            };
        }
    }

    const bridge =
        new StormMotionVectorRecoveryBridgeV39();

    global.RainGuardStormMotionVectorRecoveryBridgeV39 =
        bridge;

    global.RainGuardAI =
        global.RainGuardAI || {};

    global.RainGuardAI.V39 =
        global.RainGuardAI.V39 || {};

    global.RainGuardAI.V39.stormMotionVectorRecoveryBridge =
        bridge;

    global.runRainGuardStormMotionRecovery =
        options =>
            bridge.run(options);

    global.diagnoseRainGuardStormMotionRecovery =
        () =>
            bridge.diagnose();

    global.getRainGuardStormMotionVector =
        entityId =>
            bridge.getVector(entityId);

    global.getRainGuardStormMotionVectors =
        () =>
            bridge.getAll();

    console.log(
        `[RainGuard AI] Phase ${PHASE} — Storm Motion Vector Recovery Bridge v${VERSION} READY`
    );

    if (CONFIG.autoStart) {
        bridge.start();
    }

})(
    typeof globalThis !== "undefined"
        ? globalThis
        : window
);
