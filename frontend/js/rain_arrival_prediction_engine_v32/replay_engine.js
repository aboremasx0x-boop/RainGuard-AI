/*
===========================================================
 RainGuard AI V32
 Phase 38M-7
 Historical Track Replay Engine

 Responsibilities:
 - Read historical tracks from Track Store
 - Restore history from Unified Cache
 - Preserve canonical Track ID
 - Replay track observations
 - Reconstruct speed and bearing
 - Publish replay and reconstruction results
 - Feed Motion Engine and runtime state
===========================================================
*/

(function (global) {
    "use strict";

    const MODULE_NAME =
        "replayEngine";

    const VERSION =
        "32.38M.7";

    const BUILD =
        "rainguard-v32-phase38m-historical-track-replay-engine";

    const DEFAULT_CONFIG =
        Object.freeze({
            minimumPoints: 2,

            maximumPoints: 120,

            minimumSegmentDurationMs:
                30 * 1000,

            maximumSegmentDurationMs:
                6 * 60 * 60 * 1000,

            minimumMovementKm:
                0.03,

            maximumSegmentDistanceKm:
                300,

            minimumValidSpeedKmh:
                0.2,

            maximumValidSpeedKmh:
                180,

            stationaryThresholdKmh:
                1,

            replayTtlMs:
                12 * 60 * 60 * 1000,

            reconstructionTtlMs:
                12 * 60 * 60 * 1000,

            historyTtlMs:
                24 * 60 * 60 * 1000,

            persistReplay:
                true,

            publishToRuntime:
                true,

            runMotionEngine:
                true,

            includeSegments:
                true
        });

    function now() {
        return Date.now();
    }

    function isObject(value) {
        return (
            value !== null &&
            typeof value === "object" &&
            !Array.isArray(value)
        );
    }

    function isFiniteNumber(value) {
        return (
            typeof value === "number" &&
            Number.isFinite(value)
        );
    }

    function toFiniteNumber(
        value,
        fallback = null
    ) {
        const number =
            Number(value);

        return Number.isFinite(number)
            ? number
            : fallback;
    }

    function normalizeText(value) {
        if (
            value === null ||
            value === undefined
        ) {
            return "";
        }

        return String(value).trim();
    }

    function normalizeId(value) {
        return normalizeText(value);
    }

    function normalizeTimestamp(
        value,
        fallback = null
    ) {
        if (isFiniteNumber(value)) {
            return value;
        }

        if (value instanceof Date) {
            const timestamp =
                value.getTime();

            return Number.isFinite(
                timestamp
            )
                ? timestamp
                : fallback;
        }

        if (typeof value === "string") {
            const parsed =
                Date.parse(value);

            return Number.isFinite(
                parsed
            )
                ? parsed
                : fallback;
        }

        return fallback;
    }

    function cloneValue(value) {
        if (
            value === null ||
            value === undefined
        ) {
            return value;
        }

        if (
            typeof structuredClone ===
            "function"
        ) {
            try {
                return structuredClone(
                    value
                );
            } catch (error) {
                // Continue with JSON fallback.
            }
        }

        try {
            return JSON.parse(
                JSON.stringify(value)
            );
        } catch (error) {
            return value;
        }
    }

    function clamp(
        value,
        minimum,
        maximum
    ) {
        const number =
            toFiniteNumber(
                value,
                minimum
            );

        return Math.min(
            maximum,
            Math.max(
                minimum,
                number
            )
        );
    }

    function resolveUtils() {
        return (
            global.RainArrivalUtilsV32 ||
            global.RainGuardAI
                ?.V32
                ?.rainArrivalModules
                ?.utils ||
            null
        );
    }

    function normalizeCoordinate(value) {
        const utils =
            resolveUtils();

        if (
            utils &&
            typeof utils
                .normalizeCoordinate ===
                "function"
        ) {
            return utils
                .normalizeCoordinate(
                    value
                );
        }

        if (!value) {
            return null;
        }

        let lat = null;
        let lon = null;

        if (Array.isArray(value)) {
            lat = Number(value[0]);
            lon = Number(value[1]);
        } else if (isObject(value)) {
            lat = Number(
                value.lat ??
                value.latitude ??
                value.y
            );

            lon = Number(
                value.lon ??
                value.lng ??
                value.longitude ??
                value.x
            );
        }

        if (
            !Number.isFinite(lat) ||
            !Number.isFinite(lon) ||
            lat < -90 ||
            lat > 90 ||
            lon < -180 ||
            lon > 180
        ) {
            return null;
        }

        return {
            lat,
            lon
        };
    }

    function normalizePoint(point) {
        if (!isObject(point)) {
            return null;
        }

        const utils =
            resolveUtils();

        if (
            utils &&
            typeof utils
                .normalizePoint ===
                "function"
        ) {
            return utils
                .normalizePoint(
                    point
                );
        }

        const coordinate =
            normalizeCoordinate(
                point.coordinate ??
                point.position ??
                point.location ??
                {
                    lat:
                        point.lat ??
                        point.latitude,

                    lon:
                        point.lon ??
                        point.lng ??
                        point.longitude
                }
            );

        const timestamp =
            normalizeTimestamp(
                point.timestamp ??
                point.time ??
                point.observedAt ??
                point.createdAt,
                null
            );

        if (
            !coordinate ||
            timestamp === null
        ) {
            return null;
        }

        return {
            ...cloneValue(point),

            timestamp,

            coordinate,

            lat:
                coordinate.lat,

            lon:
                coordinate.lon
        };
    }

    function calculateDistanceKm(
        coordinateA,
        coordinateB
    ) {
        const utils =
            resolveUtils();

        if (
            utils &&
            typeof utils
                .calculateDistanceKm ===
                "function"
        ) {
            return utils
                .calculateDistanceKm(
                    coordinateA,
                    coordinateB
                );
        }

        const first =
            normalizeCoordinate(
                coordinateA
            );

        const second =
            normalizeCoordinate(
                coordinateB
            );

        if (!first || !second) {
            return null;
        }

        const earthRadiusKm =
            6371.0088;

        const degreesToRadians =
            value =>
                value *
                Math.PI /
                180;

        const latitude1 =
            degreesToRadians(
                first.lat
            );

        const latitude2 =
            degreesToRadians(
                second.lat
            );

        const latitudeDifference =
            degreesToRadians(
                second.lat -
                first.lat
            );

        const longitudeDifference =
            degreesToRadians(
                second.lon -
                first.lon
            );

        const haversine =
            Math.sin(
                latitudeDifference / 2
            ) ** 2 +
            Math.cos(latitude1) *
            Math.cos(latitude2) *
            Math.sin(
                longitudeDifference / 2
            ) ** 2;

        const angularDistance =
            2 *
            Math.atan2(
                Math.sqrt(haversine),
                Math.sqrt(
                    1 - haversine
                )
            );

        return (
            earthRadiusKm *
            angularDistance
        );
    }

    function calculateBearing(
        coordinateA,
        coordinateB
    ) {
        const utils =
            resolveUtils();

        if (
            utils &&
            typeof utils
                .calculateBearing ===
                "function"
        ) {
            return utils
                .calculateBearing(
                    coordinateA,
                    coordinateB
                );
        }

        const first =
            normalizeCoordinate(
                coordinateA
            );

        const second =
            normalizeCoordinate(
                coordinateB
            );

        if (!first || !second) {
            return null;
        }

        const toRadians =
            value =>
                value *
                Math.PI /
                180;

        const toDegrees =
            value =>
                value *
                180 /
                Math.PI;

        const latitude1 =
            toRadians(
                first.lat
            );

        const latitude2 =
            toRadians(
                second.lat
            );

        const longitudeDifference =
            toRadians(
                second.lon -
                first.lon
            );

        const y =
            Math.sin(
                longitudeDifference
            ) *
            Math.cos(latitude2);

        const x =
            Math.cos(latitude1) *
            Math.sin(latitude2) -
            Math.sin(latitude1) *
            Math.cos(latitude2) *
            Math.cos(
                longitudeDifference
            );

        const bearing =
            toDegrees(
                Math.atan2(y, x)
            );

        return (
            (
                bearing % 360
            ) +
            360
        ) % 360;
    }

    function calculateSpeedKmh(
        distanceKm,
        durationMs
    ) {
        const utils =
            resolveUtils();

        if (
            utils &&
            typeof utils
                .calculateSpeedKmh ===
                "function"
        ) {
            return utils
                .calculateSpeedKmh(
                    distanceKm,
                    durationMs
                );
        }

        if (
            !isFiniteNumber(
                distanceKm
            ) ||
            !isFiniteNumber(
                durationMs
            ) ||
            durationMs <= 0
        ) {
            return null;
        }

        return (
            distanceKm /
            (
                durationMs /
                3600000
            )
        );
    }

    function calculateMedian(values) {
        const utils =
            resolveUtils();

        if (
            utils &&
            typeof utils
                .calculateMedian ===
                "function"
        ) {
            return utils
                .calculateMedian(
                    values
                );
        }

        const filtered =
            values
                .filter(
                    isFiniteNumber
                )
                .sort(
                    (a, b) =>
                        a - b
                );

        if (
            filtered.length === 0
        ) {
            return null;
        }

        const middle =
            Math.floor(
                filtered.length / 2
            );

        return (
            filtered.length % 2 === 0
                ? (
                    filtered[middle - 1] +
                    filtered[middle]
                ) / 2
                : filtered[middle]
        );
    }

    function calculateAverage(values) {
        const utils =
            resolveUtils();

        if (
            utils &&
            typeof utils
                .calculateAverage ===
                "function"
        ) {
            return utils
                .calculateAverage(
                    values
                );
        }

        const filtered =
            values.filter(
                isFiniteNumber
            );

        if (
            filtered.length === 0
        ) {
            return null;
        }

        return (
            filtered.reduce(
                (
                    total,
                    value
                ) =>
                    total + value,
                0
            ) /
            filtered.length
        );
    }

    function calculateCircularMean(
        bearings,
        weights = []
    ) {
        const utils =
            resolveUtils();

        if (
            utils &&
            typeof utils
                .calculateCircularMean ===
                "function"
        ) {
            return utils
                .calculateCircularMean(
                    bearings,
                    weights
                );
        }

        let x = 0;
        let y = 0;
        let totalWeight = 0;

        bearings.forEach(
            (
                bearing,
                index
            ) => {
                if (
                    !isFiniteNumber(
                        bearing
                    )
                ) {
                    return;
                }

                const weight =
                    isFiniteNumber(
                        weights[index]
                    ) &&
                    weights[index] > 0
                        ? weights[index]
                        : 1;

                const radians =
                    bearing *
                    Math.PI /
                    180;

                x +=
                    Math.cos(radians) *
                    weight;

                y +=
                    Math.sin(radians) *
                    weight;

                totalWeight +=
                    weight;
            }
        );

        if (
            totalWeight === 0
        ) {
            return null;
        }

        const degrees =
            Math.atan2(y, x) *
            180 /
            Math.PI;

        return (
            (
                degrees % 360
            ) +
            360
        ) % 360;
    }

    class RainArrivalReplayEngine {

        constructor(config = {}) {
            this.version =
                VERSION;

            this.build =
                BUILD;

            this.config = {
                ...DEFAULT_CONFIG,

                ...(isObject(config)
                    ? config
                    : {})
            };

            this.replayResults =
                new Map();

            this.reconstructionResults =
                new Map();

            this.history = [];

            this.statistics = {
                runs:
                    0,

                successful:
                    0,

                failed:
                    0,

                cachedHits:
                    0,

                cachedMisses:
                    0,

                tracksProcessed:
                    0,

                segmentsCreated:
                    0,

                invalidSegments:
                    0,

                reconstructionsPublished:
                    0
            };

            this.lastReplay =
                null;

            this.lastError =
                null;

            this.createdAt =
                now();

            this.updatedAt =
                this.createdAt;
        }

        getTrackStore() {
            return (
                global
                    .RainArrivalTrackStoreV32 ||
                global
                    .RainGuardAI
                    ?.V32
                    ?.rainArrivalModules
                    ?.trackStore ||
                global
                    .RainArrivalEngineV32
                    ?.get?.(
                        "trackStore"
                    ) ||
                null
            );
        }

        getCache() {
            return (
                global
                    .RainArrivalCacheV32 ||
                global
                    .RainGuardAI
                    ?.V32
                    ?.rainArrivalModules
                    ?.cache ||
                global
                    .RainArrivalEngineV32
                    ?.get?.(
                        "cache"
                    ) ||
                null
            );
        }

        getMotionEngine() {
            return (
                global
                    .RainArrivalMotionEngineV32 ||
                global
                    .RainGuardAI
                    ?.V32
                    ?.rainArrivalModules
                    ?.motionEngine ||
                global
                    .RainArrivalEngineV32
                    ?.get?.(
                        "motionEngine"
                    ) ||
                null
            );
        }

        resolveCanonicalTrackId(
            trackId
        ) {
            const normalizedId =
                normalizeId(
                    trackId
                );

            if (!normalizedId) {
                return null;
            }

            const trackStore =
                this.getTrackStore();

            if (
                trackStore &&
                typeof trackStore
                    .resolveCanonicalTrackId ===
                    "function"
            ) {
                return (
                    trackStore
                        .resolveCanonicalTrackId(
                            normalizedId
                        ) ||
                    normalizedId
                );
            }

            return normalizedId;
        }

        resolveTrack(trackOrId) {
            if (isObject(trackOrId)) {
                return cloneValue(
                    trackOrId
                );
            }

            const trackStore =
                this.getTrackStore();

            if (
                !trackStore ||
                typeof trackStore.get !==
                    "function"
            ) {
                return null;
            }

            return trackStore.get(
                trackOrId
            );
        }

        resolveHistory(track) {
            if (!track) {
                return [];
            }

            const sourceArrays = [
                track.points,
                track.history,
                track.observations,
                track.positions,
                track.frames,
                track.trajectory
            ];

            const points = [];

            sourceArrays.forEach(
                source => {
                    if (
                        Array.isArray(
                            source
                        )
                    ) {
                        points.push(
                            ...source
                        );
                    }
                }
            );

            const cache =
                this.getCache();

            const trackId =
                track.trackId ??
                track.canonicalTrackId;

            if (
                cache &&
                trackId &&
                typeof cache
                    .getHistory ===
                    "function"
            ) {
                const cachedHistory =
                    cache.getHistory(
                        trackId
                    );

                if (
                    Array.isArray(
                        cachedHistory
                    )
                ) {
                    points.push(
                        ...cachedHistory
                    );
                } else if (
                    Array.isArray(
                        cachedHistory?.points
                    )
                ) {
                    points.push(
                        ...cachedHistory
                            .points
                    );
                }
            }

            const normalized =
                points
                    .map(
                        normalizePoint
                    )
                    .filter(Boolean)
                    .sort(
                        (a, b) =>
                            a.timestamp -
                            b.timestamp
                    );

            const deduplicated = [];

            normalized.forEach(
                point => {
                    const previous =
                        deduplicated[
                            deduplicated
                                .length - 1
                        ];

                    if (
                        previous &&
                        previous.timestamp ===
                            point.timestamp &&
                        previous.lat ===
                            point.lat &&
                        previous.lon ===
                            point.lon
                    ) {
                        return;
                    }

                    deduplicated.push(
                        point
                    );
                }
            );

            return deduplicated.slice(
                -this.config
                    .maximumPoints
            );
        }

        filterHistoryByTime(
            points,
            startTime = null,
            endTime = null
        ) {
            const normalizedStart =
                normalizeTimestamp(
                    startTime,
                    null
                );

            const normalizedEnd =
                normalizeTimestamp(
                    endTime,
                    null
                );

            return points.filter(
                point => {
                    if (
                        normalizedStart !==
                            null &&
                        point.timestamp <
                            normalizedStart
                    ) {
                        return false;
                    }

                    if (
                        normalizedEnd !==
                            null &&
                        point.timestamp >
                            normalizedEnd
                    ) {
                        return false;
                    }

                    return true;
                }
            );
        }

        buildSegments(points) {
            const segments = [];

            for (
                let index = 1;
                index < points.length;
                index += 1
            ) {
                const previous =
                    points[index - 1];

                const current =
                    points[index];

                const durationMs =
                    current.timestamp -
                    previous.timestamp;

                if (
                    durationMs <
                        this.config
                            .minimumSegmentDurationMs ||
                    durationMs >
                        this.config
                            .maximumSegmentDurationMs
                ) {
                    this.statistics
                        .invalidSegments += 1;

                    continue;
                }

                const distanceKm =
                    calculateDistanceKm(
                        previous.coordinate,
                        current.coordinate
                    );

                if (
                    !isFiniteNumber(
                        distanceKm
                    ) ||
                    distanceKm >
                        this.config
                            .maximumSegmentDistanceKm
                ) {
                    this.statistics
                        .invalidSegments += 1;

                    continue;
                }

                const speedKmh =
                    calculateSpeedKmh(
                        distanceKm,
                        durationMs
                    );

                const bearing =
                    calculateBearing(
                        previous.coordinate,
                        current.coordinate
                    );

                const moving =
                    distanceKm >=
                    this.config
                        .minimumMovementKm;

                const validSpeed =
                    moving &&
                    isFiniteNumber(
                        speedKmh
                    ) &&
                    speedKmh >=
                        this.config
                            .minimumValidSpeedKmh &&
                    speedKmh <=
                        this.config
                            .maximumValidSpeedKmh;

                segments.push({
                    segmentIndex:
                        segments.length,

                    fromPointIndex:
                        index - 1,

                    toPointIndex:
                        index,

                    from:
                        cloneValue(
                            previous
                        ),

                    to:
                        cloneValue(
                            current
                        ),

                    startedAt:
                        previous.timestamp,

                    endedAt:
                        current.timestamp,

                    durationMs,

                    durationMinutes:
                        durationMs /
                        60000,

                    distanceKm,

                    speedKmh,

                    bearing,

                    moving,

                    validSpeed
                });
            }

            this.statistics
                .segmentsCreated +=
                segments.length;

            return segments;
        }

        reconstructMotion(
            track,
            points,
            segments
        ) {
            const validSegments =
                segments.filter(
                    segment =>
                        segment.validSpeed
                );

            const stationarySegments =
                segments.filter(
                    segment =>
                        !segment.moving
                );

            const allStationary =
                segments.length > 0 &&
                stationarySegments.length ===
                    segments.length;

            const speedValues =
                validSegments.map(
                    segment =>
                        segment.speedKmh
                );

            const estimatedSpeed =
                allStationary
                    ? 0
                    : calculateMedian([
                        calculateMedian(
                            speedValues
                        ),
                        calculateAverage(
                            speedValues
                        )
                    ]);

            const bearingValues =
                validSegments
                    .map(
                        segment =>
                            segment.bearing
                    )
                    .filter(
                        isFiniteNumber
                    );

            const bearingWeights =
                validSegments.map(
                    (
                        segment,
                        index
                    ) =>
                        (
                            index + 1
                        ) *
                        Math.max(
                            segment.distanceKm,
                            0.01
                        )
                );

            const estimatedBearing =
                allStationary
                    ? null
                    : calculateCircularMean(
                        bearingValues,
                        bearingWeights
                    );

            const confidence =
                this.calculateConfidence({
                    points,
                    segments,
                    validSegments,
                    estimatedSpeed,
                    estimatedBearing,
                    allStationary
                });

            return {
                trackId:
                    track.trackId ??
                    track.canonicalTrackId,

                canonicalTrackId:
                    track.canonicalTrackId ??
                    track.trackId,

                reconstructed:
                    allStationary ||
                    (
                        isFiniteNumber(
                            estimatedSpeed
                        ) &&
                        isFiniteNumber(
                            estimatedBearing
                        )
                    ),

                reason:
                    allStationary
                        ? "HISTORICAL_TRACK_STATIONARY"
                        : (
                            validSegments
                                .length > 0 &&
                            isFiniteNumber(
                                estimatedBearing
                            )
                                ? "HISTORICAL_TRACK_REPLAY"
                                : "NO_VALID_HISTORICAL_MOTION_SEGMENTS"
                        ),

                speedKmh:
                    estimatedSpeed,

                effectiveSpeedKmh:
                    estimatedSpeed,

                bearing:
                    estimatedBearing,

                confidence,

                stationary:
                    allStationary,

                moving:
                    !allStationary &&
                    isFiniteNumber(
                        estimatedSpeed
                    ) &&
                    estimatedSpeed >
                        this.config
                            .stationaryThresholdKmh,

                pointCount:
                    points.length,

                segmentCount:
                    segments.length,

                validSegmentCount:
                    validSegments.length,

                firstObservedAt:
                    points[0]
                        ?.timestamp ??
                    null,

                lastObservedAt:
                    points[
                        points.length - 1
                    ]?.timestamp ??
                    null,

                currentCoordinate:
                    cloneValue(
                        points[
                            points.length - 1
                        ]?.coordinate ??
                        null
                    ),

                generatedAt:
                    now()
            };
        }

        calculateConfidence({
            points,
            segments,
            validSegments,
            estimatedSpeed,
            estimatedBearing,
            allStationary
        }) {
            const pointScore =
                clamp(
                    (
                        points.length /
                        8
                    ) * 35,
                    0,
                    35
                );

            const segmentScore =
                segments.length > 0
                    ? clamp(
                        (
                            validSegments
                                .length /
                            segments.length
                        ) * 35,
                        0,
                        35
                    )
                    : 0;

            const motionScore =
                allStationary
                    ? 20
                    : (
                        isFiniteNumber(
                            estimatedSpeed
                        ) &&
                        isFiniteNumber(
                            estimatedBearing
                        )
                            ? 20
                            : 0
                    );

            const lastPoint =
                points[
                    points.length - 1
                ];

            const ageMinutes =
                lastPoint
                    ? Math.max(
                        0,
                        (
                            now() -
                            lastPoint
                                .timestamp
                        ) /
                        60000
                    )
                    : Infinity;

            const recencyScore =
                clamp(
                    10 -
                    ageMinutes /
                    60,
                    0,
                    10
                );

            return Math.round(
                clamp(
                    pointScore +
                    segmentScore +
                    motionScore +
                    recencyScore,
                    0,
                    100
                )
            );
        }

        replay(
            trackOrId,
            options = {}
        ) {
            this.statistics.runs += 1;

            const track =
                this.resolveTrack(
                    trackOrId
                );

            const requestedTrackId =
                isObject(trackOrId)
                    ? (
                        trackOrId.trackId ??
                        trackOrId
                            .canonicalTrackId
                    )
                    : trackOrId;

            if (!track) {
                return this.fail({
                    reason:
                        "TRACK_NOT_FOUND",

                    trackId:
                        normalizeId(
                            requestedTrackId
                        ) || null
                });
            }

            const canonicalTrackId =
                this.resolveCanonicalTrackId(
                    track.trackId ??
                    track.canonicalTrackId ??
                    requestedTrackId
                );

            track.trackId =
                canonicalTrackId;

            track.canonicalTrackId =
                canonicalTrackId;

            if (
                options.force !== true
            ) {
                const cached =
                    this.getReplay(
                        canonicalTrackId
                    );

                if (cached) {
                    this.statistics
                        .cachedHits += 1;

                    return {
                        ...cached,

                        fromCache:
                            true
                    };
                }

                this.statistics
                    .cachedMisses += 1;
            }

            let points =
                this.resolveHistory(
                    track
                );

            points =
                this.filterHistoryByTime(
                    points,
                    options.startTime,
                    options.endTime
                );

            if (
                points.length <
                this.config.minimumPoints
            ) {
                return this.fail({
                    reason:
                        "INSUFFICIENT_HISTORICAL_POINTS",

                    trackId:
                        canonicalTrackId,

                    pointCount:
                        points.length,

                    requiredPoints:
                        this.config
                            .minimumPoints
                });
            }

            const segments =
                this.buildSegments(
                    points
                );

            if (
                segments.length === 0
            ) {
                return this.fail({
                    reason:
                        "NO_VALID_REPLAY_SEGMENTS",

                    trackId:
                        canonicalTrackId,

                    pointCount:
                        points.length
                });
            }

            const reconstruction =
                this.reconstructMotion(
                    track,
                    points,
                    segments
                );

            const result = {
                success:
                    reconstruction
                        .reconstructed,

                reason:
                    reconstruction.reason,

                version:
                    this.version,

                build:
                    this.build,

                trackId:
                    canonicalTrackId,

                canonicalTrackId,

                aliases:
                    Array.isArray(
                        track.aliases
                    )
                        ? cloneValue(
                            track.aliases
                        )
                        : [],

                identityPreserved:
                    Boolean(
                        canonicalTrackId
                    ),

                cellId:
                    track.cellId ??
                    null,

                entityId:
                    track.entityId ??
                    track.cellId ??
                    null,

                city:
                    track.city ??
                    null,

                region:
                    track.region ??
                    null,

                source:
                    track.source ??
                    null,

                pointCount:
                    points.length,

                segmentCount:
                    segments.length,

                points:
                    cloneValue(
                        points
                    ),

                segments:
                    options
                        .includeSegments ===
                        false
                        ? undefined
                        : cloneValue(
                            segments
                        ),

                reconstruction:
                    cloneValue(
                        reconstruction
                    ),

                speedKmh:
                    reconstruction
                        .speedKmh,

                effectiveSpeedKmh:
                    reconstruction
                        .effectiveSpeedKmh,

                bearing:
                    reconstruction
                        .bearing,

                confidence:
                    reconstruction
                        .confidence,

                stationary:
                    reconstruction
                        .stationary,

                moving:
                    reconstruction
                        .moving,

                currentCoordinate:
                    cloneValue(
                        reconstruction
                            .currentCoordinate
                    ),

                firstObservedAt:
                    reconstruction
                        .firstObservedAt,

                lastObservedAt:
                    reconstruction
                        .lastObservedAt,

                generatedAt:
                    now(),

                fromCache:
                    false
            };

            this.replayResults.set(
                canonicalTrackId,
                cloneValue(result)
            );

            this.reconstructionResults
                .set(
                    canonicalTrackId,
                    cloneValue(
                        reconstruction
                    )
                );

            this.statistics
                .tracksProcessed += 1;

            if (result.success) {
                this.statistics
                    .successful += 1;
            } else {
                this.statistics
                    .failed += 1;
            }

            this.lastReplay =
                cloneValue(result);

            this.updatedAt =
                now();

            this.saveHistory(
                canonicalTrackId,
                points
            );

            this.saveReplay(
                canonicalTrackId,
                result
            );

            this.saveReconstruction(
                canonicalTrackId,
                reconstruction
            );

            this.publishToRuntime(
                result
            );

            if (
                options.runMotionEngine !==
                    false &&
                this.config
                    .runMotionEngine
            ) {
                result.motionResult =
                    this.runMotionEngine(
                        track,
                        points
                    );
            }

            this.recordHistory(
                result
            );

            return result;
        }

        replayBetween(
            trackId,
            startTime,
            endTime,
            options = {}
        ) {
            return this.replay(
                trackId,
                {
                    ...options,

                    startTime,

                    endTime,

                    force:
                        options.force ??
                        true
                }
            );
        }

        replayAll(options = {}) {
            const trackStore =
                this.getTrackStore();

            if (
                !trackStore ||
                typeof trackStore
                    .getAll !==
                    "function"
            ) {
                return {
                    success: false,

                    reason:
                        "TRACK_STORE_UNAVAILABLE",

                    total: 0,

                    results: []
                };
            }

            const tracks =
                trackStore.getAll();

            const results =
                tracks.map(
                    track =>
                        this.replay(
                            track,
                            options
                        )
                );

            return {
                success:
                    results.some(
                        result =>
                            result.success
                    ),

                total:
                    results.length,

                successful:
                    results.filter(
                        result =>
                            result.success
                    ).length,

                failed:
                    results.filter(
                        result =>
                            !result.success
                    ).length,

                results,

                generatedAt:
                    now()
            };
        }

        runMotionEngine(
            track,
            points
        ) {
            const motionEngine =
                this.getMotionEngine();

            if (
                !motionEngine ||
                typeof motionEngine
                    .analyze !==
                    "function"
            ) {
                return null;
            }

            try {
                return motionEngine
                    .analyze(
                        {
                            ...cloneValue(
                                track
                            ),

                            points:
                                cloneValue(
                                    points
                                )
                        }
                    );
            } catch (error) {
                this.setLastError(
                    error,
                    "MOTION_ENGINE_EXECUTION_FAILED"
                );

                return {
                    success: false,

                    reason:
                        "MOTION_ENGINE_EXECUTION_FAILED",

                    error:
                        cloneValue(
                            this.lastError
                        )
                };
            }
        }

        saveHistory(
            trackId,
            points
        ) {
            const cache =
                this.getCache();

            if (
                !cache ||
                typeof cache
                    .setHistory !==
                    "function"
            ) {
                return false;
            }

            cache.setHistory(
                trackId,
                cloneValue(points),
                {
                    ttlMs:
                        this.config
                            .historyTtlMs,

                    metadata: {
                        module:
                            MODULE_NAME,

                        savedAt:
                            now()
                    }
                }
            );

            return true;
        }

        saveReplay(
            trackId,
            replay
        ) {
            const cache =
                this.getCache();

            if (
                cache &&
                typeof cache
                    .setReplay ===
                    "function"
            ) {
                cache.setReplay(
                    trackId,
                    cloneValue(
                        replay
                    ),
                    {
                        ttlMs:
                            this.config
                                .replayTtlMs,

                        metadata: {
                            module:
                                MODULE_NAME,

                            build:
                                BUILD
                        }
                    }
                );
            }

            this.replayResults.set(
                trackId,
                cloneValue(
                    replay
                )
            );

            return true;
        }

        getReplay(trackId) {
            const canonicalTrackId =
                this.resolveCanonicalTrackId(
                    trackId
                );

            if (!canonicalTrackId) {
                return null;
            }

            const localReplay =
                this.replayResults.get(
                    canonicalTrackId
                );

            if (localReplay) {
                return cloneValue(
                    localReplay
                );
            }

            const cache =
                this.getCache();

            if (
                cache &&
                typeof cache
                    .getReplay ===
                    "function"
            ) {
                const cached =
                    cache.getReplay(
                        canonicalTrackId
                    );

                if (cached) {
                    this.replayResults.set(
                        canonicalTrackId,
                        cloneValue(
                            cached
                        )
                    );

                    return cloneValue(
                        cached
                    );
                }
            }

            return null;
        }

        saveReconstruction(
            trackId,
            reconstruction
        ) {
            const cache =
                this.getCache();

            if (
                cache &&
                typeof cache
                    .setReconstruction ===
                    "function"
            ) {
                cache.setReconstruction(
                    trackId,
                    cloneValue(
                        reconstruction
                    ),
                    {
                        ttlMs:
                            this.config
                                .reconstructionTtlMs
                    }
                );
            }

            this.reconstructionResults
                .set(
                    trackId,
                    cloneValue(
                        reconstruction
                    )
                );

            return true;
        }

        getReconstruction(trackId) {
            const canonicalTrackId =
                this.resolveCanonicalTrackId(
                    trackId
                );

            if (!canonicalTrackId) {
                return null;
            }

            const local =
                this.reconstructionResults
                    .get(
                        canonicalTrackId
                    );

            if (local) {
                return cloneValue(
                    local
                );
            }

            const cache =
                this.getCache();

            if (
                cache &&
                typeof cache
                    .getReconstruction ===
                    "function"
            ) {
                return cache
                    .getReconstruction(
                        canonicalTrackId
                    );
            }

            return null;
        }

        getHistory(trackId) {
            const track =
                this.resolveTrack(
                    trackId
                );

            if (track) {
                return this.resolveHistory(
                    track
                );
            }

            const cache =
                this.getCache();

            if (
                cache &&
                typeof cache
                    .getHistory ===
                    "function"
            ) {
                return (
                    cache.getHistory(
                        trackId
                    ) ||
                    []
                );
            }

            return [];
        }

        clearReplay(trackId) {
            const canonicalTrackId =
                this.resolveCanonicalTrackId(
                    trackId
                );

            if (!canonicalTrackId) {
                return false;
            }

            this.replayResults.delete(
                canonicalTrackId
            );

            this.reconstructionResults
                .delete(
                    canonicalTrackId
                );

            const cache =
                this.getCache();

            if (cache) {
                cache.remove?.(
                    "replay",
                    canonicalTrackId
                );

                cache.remove?.(
                    "reconstruction",
                    canonicalTrackId
                );
            }

            return true;
        }

        clear() {
            this.replayResults.clear();

            this.reconstructionResults
                .clear();

            this.history.length = 0;

            this.lastReplay = null;

            this.updatedAt = now();

            return true;
        }

        publishToRuntime(result) {
            if (
                !this.config
                    .publishToRuntime
            ) {
                return false;
            }

            const runtimeEngine =
                global.RainGuardAI
                    ?.V32
                    ?.rainArrivalPrediction;

            if (!runtimeEngine) {
                return false;
            }

            if (
                !(
                    runtimeEngine
                        .phase37ReplayCache
                    instanceof Map
                )
            ) {
                runtimeEngine
                    .phase37ReplayCache =
                    new Map();
            }

            if (
                !(
                    runtimeEngine
                        .phase36MotionReconstructions
                    instanceof Map
                )
            ) {
                runtimeEngine
                    .phase36MotionReconstructions =
                    new Map();
            }

            runtimeEngine
                .phase37ReplayCache
                .set(
                    result.trackId,
                    cloneValue(result)
                );

            runtimeEngine
                .phase36MotionReconstructions
                .set(
                    result.trackId,
                    cloneValue(
                        result.reconstruction
                    )
                );

            runtimeEngine
                .latestHistoricalReplay =
                cloneValue(result);

            runtimeEngine
                .lastMotionResult =
                cloneValue(
                    result.reconstruction
                );

            this.statistics
                .reconstructionsPublished += 1;

            return true;
        }

        recordHistory(result) {
            this.history.push({
                ...cloneValue(result),

                recordedAt:
                    now()
            });

            if (
                this.history.length >
                500
            ) {
                this.history.splice(
                    0,
                    this.history.length -
                    500
                );
            }
        }

        fail(data = {}) {
            const result = {
                success: false,

                version:
                    this.version,

                build:
                    this.build,

                generatedAt:
                    now(),

                ...data
            };

            this.statistics.failed += 1;

            this.lastReplay =
                cloneValue(result);

            this.recordHistory(
                result
            );

            return result;
        }

        setLastError(
            error,
            code
        ) {
            this.lastError = {
                code:
                    code ||
                    "REPLAY_ENGINE_ERROR",

                name:
                    error?.name ||
                    "Error",

                message:
                    error?.message ||
                    String(error),

                stack:
                    error?.stack ||
                    null,

                timestamp:
                    now()
            };

            return this.lastError;
        }

        getDiagnostics() {
            const trackStore =
                this.getTrackStore();

            const cache =
                this.getCache();

            const motionEngine =
                this.getMotionEngine();

            return {
                module:
                    MODULE_NAME,

                version:
                    this.version,

                build:
                    this.build,

                installed:
                    true,

                trackStoreAvailable:
                    Boolean(
                        trackStore
                    ),

                cacheAvailable:
                    Boolean(
                        cache
                    ),

                motionEngineAvailable:
                    Boolean(
                        motionEngine
                    ),

                trackCount:
                    typeof trackStore
                        ?.getAll ===
                        "function"
                        ? trackStore
                            .getAll()
                            .length
                        : 0,

                replayCount:
                    this.replayResults
                        .size,

                reconstructionCount:
                    this
                        .reconstructionResults
                        .size,

                historyCount:
                    this.history.length,

                lastReplay:
                    cloneValue(
                        this.lastReplay
                    ),

                lastError:
                    cloneValue(
                        this.lastError
                    ),

                statistics:
                    cloneValue(
                        this.statistics
                    ),

                config:
                    cloneValue(
                        this.config
                    ),

                createdAt:
                    this.createdAt,

                updatedAt:
                    this.updatedAt
            };
        }

        diagnose() {
            const diagnostics =
                this.getDiagnostics();

            console.log(
                "[RainArrival ReplayEngine]",
                diagnostics
            );

            return diagnostics;
        }

        printTable() {
            const rows =
                Array.from(
                    this.replayResults
                        .values()
                ).map(
                    replay => ({
                        trackId:
                            replay.trackId,

                        canonicalTrackId:
                            replay
                                .canonicalTrackId,

                        success:
                            replay.success,

                        reason:
                            replay.reason,

                        identityPreserved:
                            replay
                                .identityPreserved,

                        points:
                            replay.pointCount,

                        segments:
                            replay.segmentCount,

                        speedKmh:
                            replay.speedKmh,

                        bearing:
                            replay.bearing,

                        confidence:
                            replay.confidence,

                        stationary:
                            replay.stationary,

                        fromCache:
                            replay.fromCache
                    })
                );

            console.table(rows);

            return rows;
        }
    }

    const api =
        new RainArrivalReplayEngine();

    global.RainArrivalReplayEngineV32 =
        api;

    global.RainArrivalReplayEngineClassV32 =
        RainArrivalReplayEngine;

    global.RainGuardAI =
        global.RainGuardAI || {};

    global.RainGuardAI.V32 =
        global.RainGuardAI.V32 || {};

    global.RainGuardAI.V32
        .rainArrivalModules =
        global.RainGuardAI.V32
            .rainArrivalModules || {};

    global.RainGuardAI.V32
        .rainArrivalModules
        .replayEngine =
        api;

    if (
        global.RainArrivalEngineV32 &&
        typeof global
            .RainArrivalEngineV32
            .register ===
            "function"
    ) {
        global.RainArrivalEngineV32
            .register(
                MODULE_NAME,
                api
            );
    }

    if (
        global
            .RainArrivalOrchestratorV32 &&
        typeof global
            .RainArrivalOrchestratorV32
            .register ===
            "function"
    ) {
        global
            .RainArrivalOrchestratorV32
            .register(
                MODULE_NAME,
                api
            );
    }

    console.log(
        "[RainGuard AI V32] Historical Track Replay Engine loaded.",
        {
            version:
                VERSION,

            build:
                BUILD
        }
    );

})(
    typeof globalThis !==
        "undefined"
        ? globalThis
        : window
);
