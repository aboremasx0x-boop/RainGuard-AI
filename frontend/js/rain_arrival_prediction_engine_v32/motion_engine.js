/*
===========================================================
 RainGuard AI V32
 Phase 38M-4
 Storm Motion Engine

 Responsibilities:
 - Read historical points from Track Store
 - Calculate distance and bearing
 - Estimate storm-cell speed
 - Validate motion continuity
 - Predict future coordinates
 - Publish normalized motion results
===========================================================
*/

(function (global) {
    "use strict";

    const MODULE_NAME = "motionEngine";
    const VERSION = "32.38M.4";
    const BUILD =
        "rainguard-v32-phase38m-motion-engine";

    const EARTH_RADIUS_KM = 6371.0088;

    const DEFAULT_CONFIG = Object.freeze({
        minimumPoints: 2,
        preferredPoints: 5,
        maximumPoints: 12,

        minimumTimeDifferenceMs:
            30 * 1000,

        maximumTimeDifferenceMs:
            3 * 60 * 60 * 1000,

        minimumValidSpeedKmh: 0.2,
        maximumValidSpeedKmh: 180,

        stationaryThresholdKmh: 1,
        maximumSegmentDistanceKm: 300,

        minimumConfidence: 0,
        maximumConfidence: 100,

        projectionMinutes: [
            15,
            30,
            60,
            90,
            120
        ]
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
        const number = Number(value);

        return Number.isFinite(number)
            ? number
            : fallback;
    }

    function clamp(
        value,
        minimum,
        maximum
    ) {
        return Math.min(
            maximum,
            Math.max(
                minimum,
                value
            )
        );
    }

    function degreesToRadians(value) {
        return value * Math.PI / 180;
    }

    function radiansToDegrees(value) {
        return value * 180 / Math.PI;
    }

    function normalizeBearing(value) {
        const number =
            toFiniteNumber(value);

        if (number === null) {
            return null;
        }

        return (
            (number % 360) +
            360
        ) % 360;
    }

    function normalizeCoordinate(value) {
        if (!value) {
            return null;
        }

        let lat;
        let lon;

        if (Array.isArray(value)) {
            lat = Number(value[0]);
            lon = Number(value[1]);
        } else {
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

    function normalizeTimestamp(value) {
        if (
            typeof value === "number" &&
            Number.isFinite(value)
        ) {
            return value;
        }

        if (value instanceof Date) {
            return value.getTime();
        }

        if (typeof value === "string") {
            const parsed = Date.parse(value);

            return Number.isFinite(parsed)
                ? parsed
                : null;
        }

        return null;
    }

    function cloneValue(value) {
        if (
            value === undefined ||
            value === null
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
                // Continue to JSON fallback.
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

    function calculateDistanceKm(
        coordinateA,
        coordinateB
    ) {
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

        const lat1 =
            degreesToRadians(
                first.lat
            );

        const lat2 =
            degreesToRadians(
                second.lat
            );

        const deltaLat =
            degreesToRadians(
                second.lat -
                first.lat
            );

        const deltaLon =
            degreesToRadians(
                second.lon -
                first.lon
            );

        const haversine =
            Math.sin(deltaLat / 2) ** 2 +
            Math.cos(lat1) *
            Math.cos(lat2) *
            Math.sin(deltaLon / 2) ** 2;

        const angularDistance =
            2 *
            Math.atan2(
                Math.sqrt(haversine),
                Math.sqrt(
                    1 - haversine
                )
            );

        return (
            EARTH_RADIUS_KM *
            angularDistance
        );
    }

    function calculateBearing(
        coordinateA,
        coordinateB
    ) {
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

        const lat1 =
            degreesToRadians(
                first.lat
            );

        const lat2 =
            degreesToRadians(
                second.lat
            );

        const deltaLon =
            degreesToRadians(
                second.lon -
                first.lon
            );

        const y =
            Math.sin(deltaLon) *
            Math.cos(lat2);

        const x =
            Math.cos(lat1) *
            Math.sin(lat2) -
            Math.sin(lat1) *
            Math.cos(lat2) *
            Math.cos(deltaLon);

        return normalizeBearing(
            radiansToDegrees(
                Math.atan2(y, x)
            )
        );
    }

    function calculateAngularDifference(
        firstBearing,
        secondBearing
    ) {
        const first =
            normalizeBearing(
                firstBearing
            );

        const second =
            normalizeBearing(
                secondBearing
            );

        if (
            first === null ||
            second === null
        ) {
            return null;
        }

        return Math.abs(
            (
                (
                    second -
                    first +
                    540
                ) % 360
            ) -
            180
        );
    }

    function calculateMedian(values) {
        const filtered =
            values
                .filter(
                    isFiniteNumber
                )
                .sort(
                    (a, b) => a - b
                );

        if (filtered.length === 0) {
            return null;
        }

        const middle =
            Math.floor(
                filtered.length / 2
            );

        if (
            filtered.length % 2 === 0
        ) {
            return (
                filtered[middle - 1] +
                filtered[middle]
            ) / 2;
        }

        return filtered[middle];
    }

    function calculateAverage(values) {
        const filtered =
            values.filter(
                isFiniteNumber
            );

        if (filtered.length === 0) {
            return null;
        }

        return (
            filtered.reduce(
                (
                    total,
                    value
                ) => total + value,
                0
            ) /
            filtered.length
        );
    }

    function calculateWeightedAverage(
        entries
    ) {
        let weightedTotal = 0;
        let totalWeight = 0;

        entries.forEach(entry => {
            if (
                !isFiniteNumber(
                    entry.value
                ) ||
                !isFiniteNumber(
                    entry.weight
                ) ||
                entry.weight <= 0
            ) {
                return;
            }

            weightedTotal +=
                entry.value *
                entry.weight;

            totalWeight +=
                entry.weight;
        });

        return totalWeight > 0
            ? weightedTotal /
                totalWeight
            : null;
    }

    function calculateCircularMean(
        bearings,
        weights = []
    ) {
        let x = 0;
        let y = 0;
        let totalWeight = 0;

        bearings.forEach(
            (
                bearing,
                index
            ) => {
                const normalized =
                    normalizeBearing(
                        bearing
                    );

                if (
                    normalized === null
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
                    degreesToRadians(
                        normalized
                    );

                x +=
                    Math.cos(radians) *
                    weight;

                y +=
                    Math.sin(radians) *
                    weight;

                totalWeight += weight;
            }
        );

        if (
            totalWeight === 0 ||
            (
                Math.abs(x) <
                    Number.EPSILON &&
                Math.abs(y) <
                    Number.EPSILON
            )
        ) {
            return null;
        }

        return normalizeBearing(
            radiansToDegrees(
                Math.atan2(y, x)
            )
        );
    }

    function projectCoordinate(
        coordinate,
        bearing,
        distanceKm
    ) {
        const origin =
            normalizeCoordinate(
                coordinate
            );

        const normalizedBearing =
            normalizeBearing(
                bearing
            );

        if (
            !origin ||
            normalizedBearing ===
                null ||
            !isFiniteNumber(
                distanceKm
            ) ||
            distanceKm < 0
        ) {
            return null;
        }

        const angularDistance =
            distanceKm /
            EARTH_RADIUS_KM;

        const bearingRadians =
            degreesToRadians(
                normalizedBearing
            );

        const latitudeRadians =
            degreesToRadians(
                origin.lat
            );

        const longitudeRadians =
            degreesToRadians(
                origin.lon
            );

        const projectedLatitude =
            Math.asin(
                Math.sin(
                    latitudeRadians
                ) *
                Math.cos(
                    angularDistance
                ) +
                Math.cos(
                    latitudeRadians
                ) *
                Math.sin(
                    angularDistance
                ) *
                Math.cos(
                    bearingRadians
                )
            );

        const projectedLongitude =
            longitudeRadians +
            Math.atan2(
                Math.sin(
                    bearingRadians
                ) *
                Math.sin(
                    angularDistance
                ) *
                Math.cos(
                    latitudeRadians
                ),

                Math.cos(
                    angularDistance
                ) -
                Math.sin(
                    latitudeRadians
                ) *
                Math.sin(
                    projectedLatitude
                )
            );

        return {
            lat:
                radiansToDegrees(
                    projectedLatitude
                ),

            lon:
                (
                    (
                        radiansToDegrees(
                            projectedLongitude
                        ) +
                        540
                    ) % 360
                ) - 180
        };
    }

    function normalizePoint(point) {
        if (!isObject(point)) {
            return null;
        }

        const coordinate =
            normalizeCoordinate(
                point.coordinate ??
                point.position ??
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
                point.createdAt
            );

        if (
            !coordinate ||
            timestamp === null
        ) {
            return null;
        }

        return {
            ...cloneValue(point),

            coordinate,

            lat: coordinate.lat,
            lon: coordinate.lon,
            timestamp
        };
    }

    class RainArrivalMotionEngine {

        constructor(config = {}) {
            this.version = VERSION;
            this.build = BUILD;

            this.config = {
                ...DEFAULT_CONFIG,
                ...(isObject(config)
                    ? config
                    : {})
            };

            this.motionStates =
                new Map();

            this.history = [];

            this.statistics = {
                runs: 0,
                successful: 0,
                failed: 0,
                stationary: 0,
                invalidSegments: 0,
                projectionsCreated: 0
            };

            this.createdAt = now();
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

        preparePoints(track) {
            if (
                !track ||
                !Array.isArray(
                    track.points
                )
            ) {
                return [];
            }

            const normalized =
                track.points
                    .map(normalizePoint)
                    .filter(Boolean)
                    .sort(
                        (a, b) =>
                            a.timestamp -
                            b.timestamp
                    );

            const deduplicated = [];

            normalized.forEach(point => {
                const previous =
                    deduplicated[
                        deduplicated.length -
                        1
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
            });

            return deduplicated.slice(
                -this.config
                    .maximumPoints
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
                            .minimumTimeDifferenceMs ||
                    durationMs >
                        this.config
                            .maximumTimeDifferenceMs
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

                const durationHours =
                    durationMs /
                    3600000;

                const speedKmh =
                    durationHours > 0
                        ? distanceKm /
                            durationHours
                        : null;

                const bearing =
                    calculateBearing(
                        previous.coordinate,
                        current.coordinate
                    );

                segments.push({
                    index:
                        segments.length,

                    from:
                        previous.coordinate,

                    to:
                        current.coordinate,

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

                    validSpeed:
                        isFiniteNumber(
                            speedKmh
                        ) &&
                        speedKmh >=
                            this.config
                                .minimumValidSpeedKmh &&
                        speedKmh <=
                            this.config
                                .maximumValidSpeedKmh
                });
            }

            return segments;
        }

        estimateSpeed(segments) {
            const valid =
                segments.filter(
                    segment =>
                        segment.validSpeed
                );

            if (valid.length === 0) {
                const distances =
                    segments.map(
                        segment =>
                            segment.distanceKm
                    );

                const allNearZero =
                    distances.length > 0 &&
                    distances.every(
                        distance =>
                            isFiniteNumber(
                                distance
                            ) &&
                            distance <=
                                0.05
                    );

                return {
                    speedKmh:
                        allNearZero
                            ? 0
                            : null,

                    medianSpeedKmh:
                        null,

                    averageSpeedKmh:
                        null,

                    segmentCount:
                        segments.length,

                    validSegmentCount: 0,

                    mode:
                        allNearZero
                            ? "stationary"
                            : "unavailable"
                };
            }

            const weightedEntries =
                valid.map(
                    (
                        segment,
                        index
                    ) => ({
                        value:
                            segment
                                .speedKmh,

                        weight:
                            index + 1
                    })
                );

            const weightedSpeed =
                calculateWeightedAverage(
                    weightedEntries
                );

            const medianSpeed =
                calculateMedian(
                    valid.map(
                        segment =>
                            segment.speedKmh
                    )
                );

            const averageSpeed =
                calculateAverage(
                    valid.map(
                        segment =>
                            segment.speedKmh
                    )
                );

            const estimatedSpeed =
                calculateMedian([
                    weightedSpeed,
                    medianSpeed,
                    averageSpeed
                ]);

            return {
                speedKmh:
                    estimatedSpeed,

                medianSpeedKmh:
                    medianSpeed,

                averageSpeedKmh:
                    averageSpeed,

                weightedSpeedKmh:
                    weightedSpeed,

                segmentCount:
                    segments.length,

                validSegmentCount:
                    valid.length,

                mode:
                    estimatedSpeed <
                    this.config
                        .stationaryThresholdKmh
                        ? "stationary"
                        : "moving"
            };
        }

        estimateBearing(segments) {
            const valid =
                segments.filter(
                    segment =>
                        segment.validSpeed &&
                        isFiniteNumber(
                            segment.bearing
                        )
                );

            if (valid.length === 0) {
                return {
                    bearing: null,
                    directionStability:
                        null,
                    validBearingCount: 0
                };
            }

            const bearings =
                valid.map(
                    segment =>
                        segment.bearing
                );

            const weights =
                valid.map(
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

            const bearing =
                calculateCircularMean(
                    bearings,
                    weights
                );

            const differences =
                valid
                    .slice(1)
                    .map(
                        (
                            segment,
                            index
                        ) =>
                            calculateAngularDifference(
                                valid[index]
                                    .bearing,
                                segment
                                    .bearing
                            )
                    )
                    .filter(
                        isFiniteNumber
                    );

            const averageDifference =
                calculateAverage(
                    differences
                );

            const directionStability =
                averageDifference === null
                    ? 100
                    : clamp(
                        100 -
                        (
                            averageDifference /
                            180
                        ) *
                        100,
                        0,
                        100
                    );

            return {
                bearing,
                directionStability,
                averageBearingChange:
                    averageDifference,
                validBearingCount:
                    valid.length
            };
        }

        calculateConfidence({
            points,
            segments,
            speedResult,
            bearingResult
        }) {
            const pointScore =
                clamp(
                    (
                        points.length /
                        this.config
                            .preferredPoints
                    ) * 30,
                    0,
                    30
                );

            const segmentScore =
                segments.length > 0
                    ? clamp(
                        (
                            speedResult
                                .validSegmentCount /
                            segments.length
                        ) * 30,
                        0,
                        30
                    )
                    : 0;

            const directionScore =
                isFiniteNumber(
                    bearingResult
                        .directionStability
                )
                    ? (
                        bearingResult
                            .directionStability /
                        100
                    ) * 25
                    : 0;

            const recencyPoint =
                points[
                    points.length - 1
                ];

            const ageMinutes =
                recencyPoint
                    ? Math.max(
                        0,
                        (
                            now() -
                            recencyPoint
                                .timestamp
                        ) /
                        60000
                    )
                    : Infinity;

            const recencyScore =
                clamp(
                    15 -
                    ageMinutes / 12,
                    0,
                    15
                );

            return clamp(
                Math.round(
                    pointScore +
                    segmentScore +
                    directionScore +
                    recencyScore
                ),
                this.config
                    .minimumConfidence,
                this.config
                    .maximumConfidence
            );
        }

        buildProjections({
            currentCoordinate,
            speedKmh,
            bearing
        }) {
            if (
                !currentCoordinate ||
                !isFiniteNumber(
                    speedKmh
                ) ||
                !isFiniteNumber(
                    bearing
                ) ||
                speedKmh <= 0
            ) {
                return [];
            }

            const projections =
                this.config
                    .projectionMinutes
                    .map(minutes => {
                        const distanceKm =
                            speedKmh *
                            (
                                minutes /
                                60
                            );

                        const coordinate =
                            projectCoordinate(
                                currentCoordinate,
                                bearing,
                                distanceKm
                            );

                        if (!coordinate) {
                            return null;
                        }

                        return {
                            minutes,
                            distanceKm,
                            coordinate,
                            lat:
                                coordinate.lat,
                            lon:
                                coordinate.lon,
                            projectedAt:
                                now() +
                                minutes *
                                60000
                        };
                    })
                    .filter(Boolean);

            this.statistics
                .projectionsCreated +=
                projections.length;

            return projections;
        }

        analyze(
            trackOrId,
            options = {}
        ) {
            this.statistics.runs += 1;

            const track =
                this.resolveTrack(
                    trackOrId
                );

            const trackId =
                track?.trackId ??
                track?.canonicalTrackId ??
                (
                    typeof trackOrId ===
                    "string"
                        ? trackOrId
                        : null
                );

            if (!track) {
                const failure = {
                    success: false,
                    reason:
                        "TRACK_NOT_FOUND",
                    trackId,
                    generatedAt: now()
                };

                this.statistics.failed += 1;
                this.recordHistory(
                    failure
                );

                return failure;
            }

            const points =
                this.preparePoints(
                    track
                );

            if (
                points.length <
                this.config.minimumPoints
            ) {
                const failure = {
                    success: false,
                    reason:
                        "INSUFFICIENT_TRACK_POINTS",
                    trackId,
                    pointCount:
                        points.length,
                    requiredPoints:
                        this.config
                            .minimumPoints,
                    generatedAt: now()
                };

                this.statistics.failed += 1;
                this.recordHistory(
                    failure
                );

                return failure;
            }

            const segments =
                this.buildSegments(
                    points
                );

            if (segments.length === 0) {
                const failure = {
                    success: false,
                    reason:
                        "NO_VALID_MOTION_SEGMENTS",
                    trackId,
                    pointCount:
                        points.length,
                    generatedAt: now()
                };

                this.statistics.failed += 1;
                this.recordHistory(
                    failure
                );

                return failure;
            }

            const speedResult =
                this.estimateSpeed(
                    segments
                );

            const bearingResult =
                this.estimateBearing(
                    segments
                );

            const currentPoint =
                points[
                    points.length - 1
                ];

            const confidence =
                this.calculateConfidence({
                    points,
                    segments,
                    speedResult,
                    bearingResult
                });

            const isStationary =
                speedResult.mode ===
                "stationary";

            const validMotion =
                isStationary ||
                (
                    isFiniteNumber(
                        speedResult
                            .speedKmh
                    ) &&
                    isFiniteNumber(
                        bearingResult
                            .bearing
                    )
                );

            const projections =
                validMotion &&
                !isStationary
                    ? this.buildProjections({
                        currentCoordinate:
                            currentPoint
                                .coordinate,

                        speedKmh:
                            speedResult
                                .speedKmh,

                        bearing:
                            bearingResult
                                .bearing
                    })
                    : [];

            const result = {
                success:
                    validMotion,

                reason:
                    validMotion
                        ? (
                            isStationary
                                ? "STATIONARY_CELL"
                                : "VALID_MOTION"
                        )
                        : "MOTION_UNAVAILABLE",

                version:
                    this.version,

                build:
                    this.build,

                trackId,

                cellId:
                    track.cellId ??
                    null,

                city:
                    track.city ??
                    null,

                region:
                    track.region ??
                    null,

                pointCount:
                    points.length,

                segmentCount:
                    segments.length,

                validSegmentCount:
                    speedResult
                        .validSegmentCount,

                speedKmh:
                    speedResult
                        .speedKmh,

                medianSpeedKmh:
                    speedResult
                        .medianSpeedKmh,

                averageSpeedKmh:
                    speedResult
                        .averageSpeedKmh,

                bearing:
                    bearingResult
                        .bearing,

                directionStability:
                    bearingResult
                        .directionStability,

                confidence,

                moving:
                    validMotion &&
                    !isStationary,

                stationary:
                    isStationary,

                currentCoordinate:
                    cloneValue(
                        currentPoint
                            .coordinate
                    ),

                lastObservedAt:
                    currentPoint
                        .timestamp,

                projections,

                segments:
                    options
                        .includeSegments ===
                        false
                        ? undefined
                        : cloneValue(
                            segments
                        ),

                generatedAt:
                    now()
            };

            if (isStationary) {
                this.statistics
                    .stationary += 1;
            }

            if (result.success) {
                this.statistics
                    .successful += 1;
            } else {
                this.statistics
                    .failed += 1;
            }

            this.motionStates.set(
                trackId,
                cloneValue(result)
            );

            this.updatedAt = now();

            this.publishToRuntime(
                result
            );

            this.recordHistory(
                result
            );

            return result;
        }

        analyzeAll(options = {}) {
            const trackStore =
                this.getTrackStore();

            if (
                !trackStore ||
                typeof trackStore.getAll !==
                    "function"
            ) {
                return {
                    success: false,
                    reason:
                        "TRACK_STORE_UNAVAILABLE",
                    results: []
                };
            }

            const tracks =
                trackStore.getAll();

            const results =
                tracks.map(
                    track =>
                        this.analyze(
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
                generatedAt: now()
            };
        }

        publishToRuntime(result) {
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
                        .motionStates
                    instanceof Map
                )
            ) {
                runtimeEngine
                    .motionStates =
                    new Map();
            }

            runtimeEngine
                .motionStates
                .set(
                    result.trackId,
                    cloneValue(result)
                );

            runtimeEngine
                .lastMotionResult =
                cloneValue(result);

            return true;
        }

        recordHistory(result) {
            this.history.push({
                ...cloneValue(result),
                recordedAt: now()
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

        getMotionState(trackId) {
            const state =
                this.motionStates.get(
                    trackId
                );

            return state
                ? cloneValue(state)
                : null;
        }

        getAllMotionStates() {
            return Array.from(
                this.motionStates.values()
            ).map(cloneValue);
        }

        clear() {
            this.motionStates.clear();
            this.history.length = 0;
            this.updatedAt = now();

            return true;
        }

        getDiagnostics() {
            const trackStore =
                this.getTrackStore();

            return {
                module:
                    MODULE_NAME,

                version:
                    this.version,

                build:
                    this.build,

                installed: true,

                trackStoreAvailable:
                    Boolean(
                        trackStore
                    ),

                motionStateCount:
                    this.motionStates
                        .size,

                historyCount:
                    this.history.length,

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
                "[RainArrival MotionEngine]",
                diagnostics
            );

            return diagnostics;
        }

        printTable() {
            const rows =
                this.getAllMotionStates()
                    .map(
                        state => ({
                            trackId:
                                state.trackId,

                            city:
                                state.city,

                            success:
                                state.success,

                            reason:
                                state.reason,

                            speedKmh:
                                state.speedKmh,

                            bearing:
                                state.bearing,

                            confidence:
                                state.confidence,

                            points:
                                state.pointCount,

                            segments:
                                state.segmentCount,

                            projections:
                                state
                                    .projections
                                    ?.length ??
                                0
                        })
                    );

            console.table(rows);

            return rows;
        }
    }

    const api =
        new RainArrivalMotionEngine();

    global.RainArrivalMotionEngineV32 =
        api;

    global.RainArrivalMotionEngineClassV32 =
        RainArrivalMotionEngine;

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
        .motionEngine =
        api;

    if (
        global.RainArrivalEngineV32 &&
        typeof global
            .RainArrivalEngineV32
            .register === "function"
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
            .register === "function"
    ) {
        global
            .RainArrivalOrchestratorV32
            .register(
                MODULE_NAME,
                api
            );
    }

    console.log(
        "[RainGuard AI V32] Motion Engine loaded.",
        {
            version: VERSION,
            build: BUILD
        }
    );

})(
    typeof globalThis !== "undefined"
        ? globalThis
        : window
);
