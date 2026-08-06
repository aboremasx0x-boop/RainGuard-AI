/*
===========================================================
 RainGuard AI V32
 Phase 38M-18F — Motion Vector History Engine
 File: motion_vector_history.js
 Version: 32.38M.18F
===========================================================
*/

(function (global) {
    "use strict";

    const MODULE_NAME = "motionVectorHistory";
    const VERSION = "32.38M.18F";
    const BUILD_ID =
        "rainguard-v32-phase38m18f-motion-vector-history";

    const DEFAULT_CONFIG = Object.freeze({
        autoStart: true,
        buildIntervalMs: 5000,
        maximumTracks: 1500,
        maximumVectorsPerTrack: 240,
        maximumVectorAgeMs: 8 * 60 * 60 * 1000,
        minimumElapsedSeconds: 1,
        maximumElapsedHours: 6,
        stationaryMovementMeters: 20,
        maximumPlausibleSpeedKmh: 220,
        debug: true
    });

    const EARTH_RADIUS_KM = 6371.0088;
    const now = () => Date.now();

    function cloneValue(value) {
        if (value === null || value === undefined) return value;
        if (typeof structuredClone === "function") {
            try { return structuredClone(value); } catch (_) {}
        }
        try { return JSON.parse(JSON.stringify(value)); }
        catch (_) { return value; }
    }

    function toFiniteNumber(value, fallback = null) {
        const number = Number(value);
        return Number.isFinite(number) ? number : fallback;
    }

    function clamp(value, minimum, maximum) {
        return Math.max(minimum, Math.min(maximum, value));
    }

    function toRadians(value) {
        return value * Math.PI / 180;
    }

    function toDegrees(value) {
        return value * 180 / Math.PI;
    }

    function normalizeBearing(value) {
        const number = toFiniteNumber(value, null);
        if (number === null) return null;
        return ((number % 360) + 360) % 360;
    }

    function normalizeTimestamp(value) {
        if (value === null || value === undefined) return null;
        if (typeof value === "number" && Number.isFinite(value)) {
            return value < 1e12 ? value * 1000 : value;
        }
        const parsed = Date.parse(value);
        return Number.isFinite(parsed) ? parsed : null;
    }

    function normalizeCoordinate(value) {
        if (!value || typeof value !== "object") return null;

        const latitude = toFiniteNumber(
            value.latitude ?? value.lat ?? value.y,
            null
        );

        const longitude = toFiniteNumber(
            value.longitude ?? value.lon ?? value.lng ?? value.x,
            null
        );

        if (
            latitude === null ||
            longitude === null ||
            latitude < -90 ||
            latitude > 90 ||
            longitude < -180 ||
            longitude > 180
        ) {
            return null;
        }

        return { latitude, longitude };
    }

    function collectionToArray(value) {
        if (!value) return [];
        if (Array.isArray(value)) return value;

        if (value instanceof Map || value instanceof Set) {
            return Array.from(value.values());
        }

        if (typeof value.values === "function") {
            try { return Array.from(value.values()); }
            catch (_) {}
        }

        if (typeof value === "object") {
            return Object.values(value);
        }

        return [];
    }

    function haversineDistanceKm(first, second) {
        const a = normalizeCoordinate(first);
        const b = normalizeCoordinate(second);

        if (!a || !b) return null;

        const latitude1 = toRadians(a.latitude);
        const latitude2 = toRadians(b.latitude);
        const deltaLatitude = toRadians(b.latitude - a.latitude);
        const deltaLongitude = toRadians(b.longitude - a.longitude);

        const sinLatitude = Math.sin(deltaLatitude / 2);
        const sinLongitude = Math.sin(deltaLongitude / 2);

        const haversine =
            sinLatitude * sinLatitude +
            Math.cos(latitude1) *
            Math.cos(latitude2) *
            sinLongitude * sinLongitude;

        return (
            2 *
            EARTH_RADIUS_KM *
            Math.asin(
                Math.min(
                    1,
                    Math.sqrt(haversine)
                )
            )
        );
    }

    function calculateBearing(first, second) {
        const a = normalizeCoordinate(first);
        const b = normalizeCoordinate(second);

        if (!a || !b) return null;

        const latitude1 = toRadians(a.latitude);
        const latitude2 = toRadians(b.latitude);
        const deltaLongitude = toRadians(
            b.longitude - a.longitude
        );

        const y =
            Math.sin(deltaLongitude) *
            Math.cos(latitude2);

        const x =
            Math.cos(latitude1) *
            Math.sin(latitude2) -
            Math.sin(latitude1) *
            Math.cos(latitude2) *
            Math.cos(deltaLongitude);

        return normalizeBearing(
            toDegrees(Math.atan2(y, x))
        );
    }

    function normalizePoint(value) {
        if (!value || typeof value !== "object") return null;

        const coordinate = normalizeCoordinate(
            value.coordinate ??
            value.position ??
            value.location ??
            value.center ??
            value.centroid ??
            value
        );

        const timestamp = normalizeTimestamp(
            value.timestamp ??
            value.time ??
            value.observedAt ??
            value.generatedAt ??
            value.updatedAt ??
            value.createdAt
        );

        if (!coordinate || timestamp === null) return null;

        return {
            coordinate,
            timestamp,
            source: value.source ?? null,
            intensity: toFiniteNumber(
                value.intensity ??
                value.reflectivity ??
                value.rainIntensity,
                null
            ),
            confidence: toFiniteNumber(
                value.confidence,
                null
            ),
            pointKind: value.pointKind ?? null,
            rawPoint: cloneValue(value)
        };
    }

    class MotionVectorHistoryEngine {
        constructor(config = {}) {
            this.version = VERSION;
            this.buildId = BUILD_ID;

            this.config = {
                ...DEFAULT_CONFIG,
                ...(config || {})
            };

            this.running = false;
            this.timer = null;
            this.vectorHistoryMap = new Map();
            this.latestResult = null;
            this.lastError = null;

            this.statistics = {
                runs: 0,
                sourceTracks: 0,
                sourcePoints: 0,
                builtVectors: 0,
                stationaryVectors: 0,
                movingVectors: 0,
                rejectedVectors: 0,
                duplicateVectors: 0,
                invalidPoints: 0,
                implausibleSpeed: 0,
                expiredVectors: 0,
                removedTracks: 0,
                failures: 0
            };
        }

        resolveTrackHistories() {
            const sources = [
                global.RainArrivalPersistentTrackHistoryV32
                    ?.getAllTracks?.(),
                global.RainArrivalPersistentTrackList,
                global.RainGuardAI?.V32
                    ?.persistentTrackList,
                global.RainArrivalLiveTrackHistoryCaptureV32
                    ?.getAllTracks?.(),
                global.RainArrivalTrackHistoryStoreV32
                    ?.getAllTracks?.()
            ];

            for (const source of sources) {
                const tracks = collectionToArray(source);

                if (tracks.length > 0) {
                    return tracks.slice(
                        0,
                        this.config.maximumTracks
                    );
                }
            }

            const objectSources = [
                global.RainArrivalPersistentTrackHistory,
                global.RainArrivalLiveTrackHistory,
                global.RainArrivalTrackHistoryV32,
                global.RainGuardAI?.V32
                    ?.persistentTrackHistory
            ];

            for (const source of objectSources) {
                if (source && typeof source === "object") {
                    return Object.entries(source)
                        .slice(
                            0,
                            this.config.maximumTracks
                        )
                        .map(([trackId, points]) => ({
                            trackId,
                            points: collectionToArray(points),
                            history: collectionToArray(points)
                        }));
                }
            }

            return [];
        }

        normalizeTrack(track, index) {
            if (!track || typeof track !== "object") return null;

            const trackId = String(
                track.trackId ??
                track.stableId ??
                track.canonicalTrackId ??
                track.cellId ??
                `TRACK-${index}`
            );

            const pointSources = [
                track.points,
                track.history,
                track.trackHistory,
                track.positions,
                track.observations,
                track.replay
            ];

            const points = [];

            for (const source of pointSources) {
                for (const rawPoint of collectionToArray(source)) {
                    const point = normalizePoint(rawPoint);

                    if (point) {
                        points.push(point);
                    } else {
                        this.statistics.invalidPoints += 1;
                    }
                }
            }

            const uniquePoints = new Map();

            for (const point of points) {
                const key = [
                    point.timestamp,
                    point.coordinate.latitude.toFixed(6),
                    point.coordinate.longitude.toFixed(6)
                ].join(":");

                uniquePoints.set(key, point);
            }

            return {
                trackId,
                points: Array.from(uniquePoints.values())
                    .sort(
                        (first, second) =>
                            first.timestamp - second.timestamp
                    ),
                sourceTrack: cloneValue(track)
            };
        }

        makeVectorId(trackId, startPoint, endPoint) {
            return [
                trackId,
                startPoint.timestamp,
                endPoint.timestamp,
                endPoint.coordinate.latitude.toFixed(6),
                endPoint.coordinate.longitude.toFixed(6)
            ].join("|");
        }

        buildVector(trackId, startPoint, endPoint, index) {
            const elapsedMs =
                endPoint.timestamp - startPoint.timestamp;

            const elapsedSeconds =
                elapsedMs / 1000;

            if (
                elapsedSeconds <
                    this.config.minimumElapsedSeconds ||
                elapsedSeconds >
                    this.config.maximumElapsedHours * 3600
            ) {
                return {
                    accepted: false,
                    reason: "INVALID_TIME_DELTA"
                };
            }

            const distanceKm =
                haversineDistanceKm(
                    startPoint.coordinate,
                    endPoint.coordinate
                );

            if (distanceKm === null) {
                return {
                    accepted: false,
                    reason: "DISTANCE_UNAVAILABLE"
                };
            }

            const distanceMeters = distanceKm * 1000;
            const speedKmh =
                distanceKm /
                (elapsedSeconds / 3600);

            if (
                speedKmh >
                this.config.maximumPlausibleSpeedKmh
            ) {
                this.statistics.implausibleSpeed += 1;

                return {
                    accepted: false,
                    reason: "IMPLAUSIBLE_SPEED"
                };
            }

            const stationary =
                distanceMeters <=
                this.config.stationaryMovementMeters;

            const movementBearing =
                stationary
                    ? null
                    : calculateBearing(
                        startPoint.coordinate,
                        endPoint.coordinate
                    );

            const bearingRadians =
                movementBearing === null
                    ? null
                    : toRadians(movementBearing);

            const velocityEastKmh =
                stationary ||
                bearingRadians === null
                    ? 0
                    : speedKmh *
                        Math.sin(bearingRadians);

            const velocityNorthKmh =
                stationary ||
                bearingRadians === null
                    ? 0
                    : speedKmh *
                        Math.cos(bearingRadians);

            const intensityDelta =
                startPoint.intensity !== null &&
                endPoint.intensity !== null
                    ? endPoint.intensity -
                        startPoint.intensity
                    : null;

            const confidence = clamp(
                (
                    (startPoint.confidence ?? 0) +
                    (endPoint.confidence ?? 0)
                ) / 2,
                0,
                100
            );

            return {
                accepted: true,
                vector: {
                    vectorId: this.makeVectorId(
                        trackId,
                        startPoint,
                        endPoint
                    ),
                    trackId,
                    vectorIndex: index,
                    startCoordinate: cloneValue(
                        startPoint.coordinate
                    ),
                    endCoordinate: cloneValue(
                        endPoint.coordinate
                    ),
                    startTimestamp: startPoint.timestamp,
                    endTimestamp: endPoint.timestamp,
                    startTimeIso: new Date(
                        startPoint.timestamp
                    ).toISOString(),
                    endTimeIso: new Date(
                        endPoint.timestamp
                    ).toISOString(),
                    elapsedMs,
                    elapsedSeconds,
                    elapsedMinutes: elapsedSeconds / 60,
                    distanceKm: Number(
                        distanceKm.toFixed(4)
                    ),
                    distanceMeters: Number(
                        distanceMeters.toFixed(2)
                    ),
                    speedKmh: Number(
                        speedKmh.toFixed(3)
                    ),
                    bearing:
                        movementBearing === null
                            ? null
                            : Number(
                                movementBearing.toFixed(2)
                            ),
                    velocityEastKmh: Number(
                        velocityEastKmh.toFixed(3)
                    ),
                    velocityNorthKmh: Number(
                        velocityNorthKmh.toFixed(3)
                    ),
                    stationary,
                    movementClass:
                        stationary
                            ? "STATIONARY"
                            : "MOVING",
                    startIntensity: startPoint.intensity,
                    endIntensity: endPoint.intensity,
                    intensityDelta,
                    confidence,
                    startPointKind: startPoint.pointKind,
                    endPointKind: endPoint.pointKind,
                    source:
                        endPoint.source ??
                        startPoint.source ??
                        "PERSISTENT_TRACK_HISTORY",
                    generatedAt: now(),
                    generatedAtIso:
                        new Date().toISOString()
                }
            };
        }

        buildTrackVectors(track) {
            const vectors = [];

            if (
                !track ||
                !Array.isArray(track.points) ||
                track.points.length < 2
            ) {
                return vectors;
            }

            for (
                let index = 1;
                index < track.points.length;
                index += 1
            ) {
                const result = this.buildVector(
                    track.trackId,
                    track.points[index - 1],
                    track.points[index],
                    index - 1
                );

                if (result.accepted) {
                    vectors.push(result.vector);
                } else {
                    this.statistics.rejectedVectors += 1;
                }
            }

            return vectors;
        }

        mergeTrackVectors(trackId, vectors) {
            const existing =
                this.vectorHistoryMap.get(trackId) || [];

            const merged = new Map();

            for (const vector of existing) {
                merged.set(vector.vectorId, vector);
            }

            for (const vector of vectors) {
                if (merged.has(vector.vectorId)) {
                    this.statistics.duplicateVectors += 1;
                }

                merged.set(vector.vectorId, vector);
            }

            const ordered =
                Array.from(merged.values())
                    .sort(
                        (first, second) =>
                            first.endTimestamp -
                            second.endTimestamp
                    );

            if (
                ordered.length >
                this.config.maximumVectorsPerTrack
            ) {
                ordered.splice(
                    0,
                    ordered.length -
                    this.config.maximumVectorsPerTrack
                );
            }

            this.vectorHistoryMap.set(trackId, ordered);

            return ordered;
        }

        cleanup(referenceTime) {
            const cutoff =
                referenceTime -
                this.config.maximumVectorAgeMs;

            for (
                const [trackId, vectors]
                of this.vectorHistoryMap.entries()
            ) {
                const filtered =
                    vectors.filter(
                        vector =>
                            vector.endTimestamp >= cutoff
                    );

                this.statistics.expiredVectors +=
                    vectors.length - filtered.length;

                if (filtered.length === 0) {
                    this.vectorHistoryMap.delete(trackId);
                    this.statistics.removedTracks += 1;
                } else {
                    this.vectorHistoryMap.set(
                        trackId,
                        filtered
                    );
                }
            }
        }

        publish() {
            const objectSnapshot = {};
            const trackList = [];

            for (
                const [trackId, vectors]
                of this.vectorHistoryMap.entries()
            ) {
                objectSnapshot[trackId] =
                    cloneValue(vectors);

                trackList.push({
                    trackId,
                    vectorCount: vectors.length,
                    vectors: cloneValue(vectors),
                    latestVector: cloneValue(
                        vectors[vectors.length - 1] || null
                    ),
                    firstVector: cloneValue(
                        vectors[0] || null
                    )
                });
            }

            global.RainArrivalMotionVectorHistory =
                cloneValue(objectSnapshot);

            global.RainArrivalMotionVectorTrackList =
                cloneValue(trackList);

            global.RainGuardAI =
                global.RainGuardAI || {};

            global.RainGuardAI.V32 =
                global.RainGuardAI.V32 || {};

            global.RainGuardAI.V32.motionVectorHistory =
                cloneValue(objectSnapshot);

            global.RainGuardAI.V32.motionVectorTrackList =
                cloneValue(trackList);

            return {
                objectSnapshot,
                trackList
            };
        }

        buildAll() {
            const startedAt = now();
            this.statistics.runs += 1;

            try {
                const sourceTracks =
                    this.resolveTrackHistories();

                this.statistics.sourceTracks +=
                    sourceTracks.length;

                let normalizedTrackCount = 0;
                let sourcePointCount = 0;
                let builtThisCycle = 0;

                for (
                    let index = 0;
                    index < sourceTracks.length;
                    index += 1
                ) {
                    const normalizedTrack =
                        this.normalizeTrack(
                            sourceTracks[index],
                            index
                        );

                    if (!normalizedTrack) continue;

                    normalizedTrackCount += 1;
                    sourcePointCount +=
                        normalizedTrack.points.length;

                    const vectors =
                        this.buildTrackVectors(
                            normalizedTrack
                        );

                    builtThisCycle += vectors.length;

                    for (const vector of vectors) {
                        if (vector.stationary) {
                            this.statistics.stationaryVectors += 1;
                        } else {
                            this.statistics.movingVectors += 1;
                        }
                    }

                    this.mergeTrackVectors(
                        normalizedTrack.trackId,
                        vectors
                    );
                }

                this.statistics.sourcePoints +=
                    sourcePointCount;

                this.statistics.builtVectors +=
                    builtThisCycle;

                this.cleanup(startedAt);

                const published = this.publish();

                const totalVectorCount =
                    published.trackList.reduce(
                        (sum, track) =>
                            sum + track.vectorCount,
                        0
                    );

                const movingVectorCount =
                    published.trackList.reduce(
                        (sum, track) =>
                            sum +
                            track.vectors.filter(
                                vector =>
                                    !vector.stationary
                            ).length,
                        0
                    );

                const stationaryVectorCount =
                    totalVectorCount -
                    movingVectorCount;

                const result = {
                    success: true,
                    status:
                        "MOTION_VECTOR_HISTORY_COMPLETED",
                    version: this.version,
                    build: this.buildId,
                    sourceTrackCount:
                        sourceTracks.length,
                    normalizedTrackCount,
                    sourcePointCount,
                    builtThisCycle,
                    trackCount:
                        published.trackList.length,
                    totalVectorCount,
                    movingVectorCount,
                    stationaryVectorCount,
                    startedAt,
                    completedAt: now(),
                    durationMs: now() - startedAt
                };

                this.latestResult =
                    cloneValue(result);

                global.dispatchEvent?.(
                    new CustomEvent(
                        "rainarrival:motion-vector-history-updated",
                        {
                            detail: cloneValue(result)
                        }
                    )
                );

                if (this.config.debug) {
                    console.log(
                        "[RainArrival MotionVectorHistory] Build result:",
                        result
                    );
                }

                return result;
            } catch (error) {
                this.statistics.failures += 1;

                this.lastError = {
                    name:
                        error?.name ?? "Error",
                    message:
                        error?.message ??
                        String(error),
                    stack:
                        error?.stack ?? null,
                    timestamp: now()
                };

                const result = {
                    success: false,
                    status:
                        "MOTION_VECTOR_HISTORY_FAILED",
                    version: this.version,
                    build: this.buildId,
                    error: cloneValue(this.lastError),
                    startedAt,
                    completedAt: now(),
                    durationMs: now() - startedAt
                };

                this.latestResult =
                    cloneValue(result);

                return result;
            }
        }

        getHistory(trackId) {
            return cloneValue(
                this.vectorHistoryMap.get(
                    String(trackId)
                ) || []
            );
        }

        getLatestVector(trackId) {
            const history =
                this.vectorHistoryMap.get(
                    String(trackId)
                ) || [];

            return cloneValue(
                history[history.length - 1] || null
            );
        }

        getAll() {
            const result = {};

            for (
                const [trackId, vectors]
                of this.vectorHistoryMap.entries()
            ) {
                result[trackId] =
                    cloneValue(vectors);
            }

            return result;
        }

        getAllTracks() {
            return Array.from(
                this.vectorHistoryMap.entries()
            ).map(
                ([trackId, vectors]) => ({
                    trackId,
                    vectorCount: vectors.length,
                    vectors: cloneValue(vectors),
                    latestVector: cloneValue(
                        vectors[vectors.length - 1] || null
                    ),
                    firstVector: cloneValue(
                        vectors[0] || null
                    )
                })
            );
        }

        clear(trackId = null) {
            if (trackId !== null) {
                const deleted =
                    this.vectorHistoryMap.delete(
                        String(trackId)
                    );

                this.publish();

                return {
                    success: true,
                    trackId: String(trackId),
                    deleted
                };
            }

            const removedTrackCount =
                this.vectorHistoryMap.size;

            this.vectorHistoryMap.clear();
            this.publish();

            return {
                success: true,
                removedTrackCount
            };
        }

        printTable() {
            const rows =
                this.getAllTracks().map(
                    track => {
                        const latest =
                            track.latestVector;

                        return {
                            trackId:
                                track.trackId,
                            vectorCount:
                                track.vectorCount,
                            latestSpeedKmh:
                                latest?.speedKmh ?? null,
                            latestBearing:
                                latest?.bearing ?? null,
                            stationary:
                                latest?.stationary ?? null,
                            distanceKm:
                                latest?.distanceKm ?? null,
                            elapsedSeconds:
                                latest?.elapsedSeconds ?? null,
                            latestTime:
                                latest?.endTimeIso ?? null
                        };
                    }
                );

            console.table(rows);
            return rows;
        }

        start() {
            if (this.running) {
                return {
                    success: true,
                    alreadyRunning: true
                };
            }

            this.running = true;
            this.buildAll();

            this.timer = global.setInterval(
                () => this.buildAll(),
                this.config.buildIntervalMs
            );

            return {
                success: true,
                running: true,
                intervalMs:
                    this.config.buildIntervalMs
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

        getDiagnostics() {
            const tracks = this.getAllTracks();

            const totalVectorCount =
                tracks.reduce(
                    (sum, track) =>
                        sum + track.vectorCount,
                    0
                );

            const movingVectorCount =
                tracks.reduce(
                    (sum, track) =>
                        sum +
                        track.vectors.filter(
                            vector =>
                                !vector.stationary
                        ).length,
                    0
                );

            return {
                module: MODULE_NAME,
                version: this.version,
                build: this.buildId,
                installed: true,
                running: this.running,
                trackCount: tracks.length,
                totalVectorCount,
                movingVectorCount,
                stationaryVectorCount:
                    totalVectorCount -
                    movingVectorCount,
                latestResult:
                    cloneValue(this.latestResult),
                lastError:
                    cloneValue(this.lastError),
                statistics:
                    cloneValue(this.statistics)
            };
        }

        diagnose() {
            const diagnostics =
                this.getDiagnostics();

            console.log(
                "[RainArrival MotionVectorHistory]",
                diagnostics
            );

            return diagnostics;
        }
    }

    const engine =
        new MotionVectorHistoryEngine();

    global.RainArrivalMotionVectorHistoryV32 =
        engine;

    global.RainGuardAI =
        global.RainGuardAI || {};

    global.RainGuardAI.V32 =
        global.RainGuardAI.V32 || {};

    global.RainGuardAI.V32.rainArrivalModules =
        global.RainGuardAI.V32
            .rainArrivalModules || {};

    global.RainGuardAI.V32
        .rainArrivalModules
        .motionVectorHistory =
        engine;

    global.RainArrivalEngineV32
        ?.register?.(
            MODULE_NAME,
            engine
        );

    global.RainArrivalOrchestratorV32
        ?.register?.(
            MODULE_NAME,
            engine
        );

    global.buildRainArrivalMotionVectorHistory =
        () => engine.buildAll();

    if (engine.config.autoStart) {
        engine.start();
    }

    console.log(
        "[RainGuard AI V32] Motion Vector History Engine loaded.",
        {
            version: VERSION,
            build: BUILD_ID
        }
    );

})(
    typeof globalThis !== "undefined"
        ? globalThis
        : window
);
