/*
===========================================================
 RainGuard AI V32
 Phase 38M-18F — Motion Vector Statistics Engine
 File: motion_vector_statistics.js
 Version: 32.38M.18F

 Responsibilities:
 - Read vectors from Motion Vector Repository.
 - Calculate per-track and national motion statistics.
 - Calculate weighted mean speed and circular mean bearing.
 - Measure speed variation, directional consistency and stability.
 - Estimate motion confidence without inventing movement.
 - Publish summaries for Recovery, ETA, Renderer and Decision engines.
===========================================================
*/

(function (global) {
    "use strict";

    const MODULE_NAME =
        "motionVectorStatistics";

    const VERSION =
        "32.38M.18F";

    const BUILD_ID =
        "rainguard-v32-phase38m18f-motion-vector-statistics";

    const DEFAULT_CONFIG =
        Object.freeze({
            autoStart:
                true,

            analysisIntervalMs:
                6000,

            maximumTracks:
                1500,

            maximumVectorsPerTrack:
                240,

            recentVectorWindow:
                24,

            minimumVectorCountForConfidence:
                2,

            stationarySpeedThresholdKmh:
                1,

            lowSpeedThresholdKmh:
                8,

            highSpeedThresholdKmh:
                80,

            maximumPlausibleSpeedKmh:
                220,

            debug:
                true
        });

    const now =
        () => Date.now();

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
                return structuredClone(value);
            } catch (_) {}
        }

        try {
            return JSON.parse(
                JSON.stringify(value)
            );
        } catch (_) {
            return value;
        }
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

    function clamp(
        value,
        minimum,
        maximum
    ) {
        return Math.max(
            minimum,
            Math.min(
                maximum,
                value
            )
        );
    }

    function toRadians(value) {
        return value *
            Math.PI /
            180;
    }

    function toDegrees(value) {
        return value *
            180 /
            Math.PI;
    }

    function normalizeBearing(value) {
        const number =
            toFiniteNumber(
                value,
                null
            );

        if (number === null) {
            return null;
        }

        return (
            (
                number %
                360
            ) +
            360
        ) %
        360;
    }

    function collectionToArray(value) {
        if (!value) {
            return [];
        }

        if (Array.isArray(value)) {
            return value;
        }

        if (
            value instanceof Map ||
            value instanceof Set
        ) {
            return Array.from(
                value.values()
            );
        }

        if (
            typeof value.values ===
            "function"
        ) {
            try {
                return Array.from(
                    value.values()
                );
            } catch (_) {}
        }

        return typeof value ===
            "object"
            ? Object.values(value)
            : [];
    }

    function arithmeticMean(values) {
        const valid =
            values.filter(
                value =>
                    Number.isFinite(value)
            );

        if (valid.length === 0) {
            return null;
        }

        return valid.reduce(
            (
                sum,
                value
            ) =>
                sum +
                value,
            0
        ) /
        valid.length;
    }

    function weightedMean(
        values,
        weights
    ) {
        let numerator =
            0;

        let denominator =
            0;

        for (
            let index = 0;
            index <
                values.length;
            index += 1
        ) {
            const value =
                values[index];

            const weight =
                weights[index];

            if (
                !Number.isFinite(value) ||
                !Number.isFinite(weight) ||
                weight <= 0
            ) {
                continue;
            }

            numerator +=
                value *
                weight;

            denominator +=
                weight;
        }

        if (denominator === 0) {
            return null;
        }

        return numerator /
            denominator;
    }

    function variance(
        values,
        mean = null
    ) {
        const valid =
            values.filter(
                value =>
                    Number.isFinite(value)
            );

        if (valid.length === 0) {
            return null;
        }

        const resolvedMean =
            mean ??
            arithmeticMean(valid);

        return valid.reduce(
            (
                sum,
                value
            ) =>
                sum +
                (
                    value -
                    resolvedMean
                ) ** 2,
            0
        ) /
        valid.length;
    }

    function standardDeviation(
        values,
        mean = null
    ) {
        const value =
            variance(
                values,
                mean
            );

        return value === null
            ? null
            : Math.sqrt(value);
    }

    function median(values) {
        const valid =
            values
                .filter(
                    value =>
                        Number.isFinite(
                            value
                        )
                )
                .sort(
                    (
                        first,
                        second
                    ) =>
                        first -
                        second
                );

        if (valid.length === 0) {
            return null;
        }

        const middle =
            Math.floor(
                valid.length /
                2
            );

        if (
            valid.length %
            2 ===
            0
        ) {
            return (
                valid[
                    middle -
                    1
                ] +
                valid[middle]
            ) /
            2;
        }

        return valid[middle];
    }

    function percentile(
        values,
        percentileValue
    ) {
        const valid =
            values
                .filter(
                    value =>
                        Number.isFinite(
                            value
                        )
                )
                .sort(
                    (
                        first,
                        second
                    ) =>
                        first -
                        second
                );

        if (valid.length === 0) {
            return null;
        }

        const position =
            clamp(
                percentileValue,
                0,
                1
            ) *
            (
                valid.length -
                1
            );

        const lowerIndex =
            Math.floor(position);

        const upperIndex =
            Math.ceil(position);

        if (
            lowerIndex ===
            upperIndex
        ) {
            return valid[
                lowerIndex
            ];
        }

        const fraction =
            position -
            lowerIndex;

        return (
            valid[lowerIndex] *
            (
                1 -
                fraction
            ) +
            valid[upperIndex] *
            fraction
        );
    }

    function circularStatistics(
        bearings,
        weights = []
    ) {
        let sumSin =
            0;

        let sumCos =
            0;

        let sumWeight =
            0;

        for (
            let index = 0;
            index <
                bearings.length;
            index += 1
        ) {
            const bearing =
                normalizeBearing(
                    bearings[index]
                );

            if (bearing === null) {
                continue;
            }

            const weight =
                Number.isFinite(
                    weights[index]
                ) &&
                weights[index] > 0
                    ? weights[index]
                    : 1;

            const radians =
                toRadians(
                    bearing
                );

            sumSin +=
                Math.sin(radians) *
                weight;

            sumCos +=
                Math.cos(radians) *
                weight;

            sumWeight +=
                weight;
        }

        if (sumWeight === 0) {
            return {
                meanBearing:
                    null,

                resultantLength:
                    0,

                directionalConsistency:
                    0,

                circularVariance:
                    1
            };
        }

        const meanRadians =
            Math.atan2(
                sumSin,
                sumCos
            );

        const resultantLength =
            Math.sqrt(
                sumSin ** 2 +
                sumCos ** 2
            ) /
            sumWeight;

        return {
            meanBearing:
                normalizeBearing(
                    toDegrees(
                        meanRadians
                    )
                ),

            resultantLength,

            directionalConsistency:
                clamp(
                    resultantLength *
                    100,
                    0,
                    100
                ),

            circularVariance:
                1 -
                resultantLength
        };
    }

    class MotionVectorStatisticsEngine {

        constructor(config = {}) {
            this.version =
                VERSION;

            this.buildId =
                BUILD_ID;

            this.config = {
                ...DEFAULT_CONFIG,

                ...(config || {})
            };

            this.running =
                false;

            this.timer =
                null;

            this.trackStatisticsMap =
                new Map();

            this.nationalStatistics =
                null;

            this.latestResult =
                null;

            this.lastError =
                null;

            this.statistics = {
                analyses:
                    0,

                inputTracks:
                    0,

                inputVectors:
                    0,

                analyzedTracks:
                    0,

                movingTracks:
                    0,

                stationaryTracks:
                    0,

                insufficientTracks:
                    0,

                failures:
                    0
            };
        }

        resolveRepositoryTracks() {
            const repository =
                global
                    .RainArrivalMotionVectorRepositoryV32;

            const sources = [
                repository
                    ?.getAllTracks?.(),

                global
                    .RainArrivalMotionVectorRepositoryTracks,

                global
                    .RainGuardAI
                    ?.V32
                    ?.motionVectorRepositoryTracks,

                global
                    .RainArrivalMotionVectorHistoryV32
                    ?.getAllTracks?.(),

                global
                    .RainArrivalMotionVectorTrackList
            ];

            for (
                const source
                of sources
            ) {
                const tracks =
                    collectionToArray(
                        source
                    );

                if (
                    tracks.length >
                    0
                ) {
                    return tracks.slice(
                        0,
                        this.config
                            .maximumTracks
                    );
                }
            }

            const objectSources = [
                repository
                    ?.getAll?.(),

                global
                    .RainArrivalMotionVectorRepository,

                global
                    .RainArrivalMotionVectorHistory
            ];

            for (
                const source
                of objectSources
            ) {
                if (
                    source &&
                    typeof source ===
                        "object"
                ) {
                    return Object.entries(
                        source
                    )
                    .slice(
                        0,
                        this.config
                            .maximumTracks
                    )
                    .map(
                        (
                            [
                                trackId,
                                vectors
                            ]
                        ) => ({
                            trackId,

                            vectors:
                                collectionToArray(
                                    vectors
                                )
                        })
                    );
                }
            }

            return [];
        }

        normalizeVectors(track) {
            const vectors =
                collectionToArray(
                    track?.vectors ??
                    track?.history
                )
                .filter(
                    vector =>
                        vector &&
                        typeof vector ===
                            "object"
                )
                .sort(
                    (
                        first,
                        second
                    ) =>
                        (
                            toFiniteNumber(
                                first.endTimestamp,
                                0
                            )
                        ) -
                        (
                            toFiniteNumber(
                                second.endTimestamp,
                                0
                            )
                        )
                );

            if (
                vectors.length >
                this.config
                    .maximumVectorsPerTrack
            ) {
                return vectors.slice(
                    -
                    this.config
                        .maximumVectorsPerTrack
                );
            }

            return vectors;
        }

        calculateTrackStatistics(
            track,
            index
        ) {
            const trackId =
                String(
                    track?.trackId ??
                    track?.stableId ??
                    `TRACK-${index}`
                );

            const vectors =
                this.normalizeVectors(
                    track
                );

            if (vectors.length === 0) {
                this.statistics
                    .insufficientTracks +=
                    1;

                return {
                    trackId,

                    vectorCount:
                        0,

                    status:
                        "NO_VECTORS",

                    confidence:
                        0,

                    generatedAt:
                        now()
                };
            }

            const recentVectors =
                vectors.slice(
                    -
                    this.config
                        .recentVectorWindow
                );

            const speedValues =
                recentVectors
                    .map(
                        vector =>
                            toFiniteNumber(
                                vector.speedKmh,
                                null
                            )
                    )
                    .filter(
                        value =>
                            value !==
                            null &&
                            value >=
                            0 &&
                            value <=
                            this.config
                                .maximumPlausibleSpeedKmh
                    );

            const movementVectors =
                recentVectors
                    .filter(
                        vector => {
                            const speed =
                                toFiniteNumber(
                                    vector.speedKmh,
                                    0
                                );

                            return (
                                vector.stationary !==
                                    true &&
                                speed >
                                    this.config
                                        .stationarySpeedThresholdKmh &&
                                normalizeBearing(
                                    vector.bearing
                                ) !==
                                    null
                            );
                        }
                    );

            const movingSpeeds =
                movementVectors.map(
                    vector =>
                        toFiniteNumber(
                            vector.speedKmh,
                            0
                        )
                );

            const elapsedWeights =
                movementVectors.map(
                    vector =>
                        Math.max(
                            1,
                            toFiniteNumber(
                                vector.elapsedSeconds,
                                1
                            )
                        )
                );

            const bearings =
                movementVectors.map(
                    vector =>
                        normalizeBearing(
                            vector.bearing
                        )
                );

            const meanSpeed =
                weightedMean(
                    movingSpeeds,
                    elapsedWeights
                ) ??
                arithmeticMean(
                    speedValues
                ) ??
                0;

            const medianSpeed =
                median(
                    movingSpeeds.length >
                        0
                        ? movingSpeeds
                        : speedValues
                ) ??
                0;

            const speedStandardDeviation =
                standardDeviation(
                    movingSpeeds.length >
                        0
                        ? movingSpeeds
                        : speedValues,
                    meanSpeed
                ) ??
                0;

            const speedCoefficientOfVariation =
                meanSpeed >
                0
                    ? (
                        speedStandardDeviation /
                        meanSpeed
                    ) *
                    100
                    : 0;

            const circular =
                circularStatistics(
                    bearings,
                    elapsedWeights
                );

            const stationaryCount =
                recentVectors.filter(
                    vector =>
                        vector.stationary ===
                            true ||
                        toFiniteNumber(
                            vector.speedKmh,
                            0
                        ) <=
                            this.config
                                .stationarySpeedThresholdKmh
                ).length;

            const movingCount =
                recentVectors.length -
                stationaryCount;

            const stationaryRatio =
                recentVectors.length >
                0
                    ? stationaryCount /
                        recentVectors.length
                    : 0;

            const movingRatio =
                1 -
                stationaryRatio;

            const totalDistanceKm =
                recentVectors.reduce(
                    (
                        sum,
                        vector
                    ) =>
                        sum +
                        Math.max(
                            0,
                            toFiniteNumber(
                                vector.distanceKm,
                                0
                            )
                        ),
                    0
                );

            const totalElapsedSeconds =
                recentVectors.reduce(
                    (
                        sum,
                        vector
                    ) =>
                        sum +
                        Math.max(
                            0,
                            toFiniteNumber(
                                vector.elapsedSeconds,
                                0
                            )
                        ),
                    0
                );

            const confidenceValues =
                recentVectors
                    .map(
                        vector =>
                            toFiniteNumber(
                                vector.confidence,
                                null
                            )
                    )
                    .filter(
                        value =>
                            value !==
                            null
                    )
                    .map(
                        value =>
                            value <=
                                1
                                ? value *
                                    100
                                : value
                    );

            const evidenceConfidence =
                arithmeticMean(
                    confidenceValues
                ) ??
                50;

            const countScore =
                clamp(
                    (
                        recentVectors.length /
                        Math.max(
                            1,
                            this.config
                                .minimumVectorCountForConfidence *
                                4
                        )
                    ) *
                    100,
                    0,
                    100
                );

            const directionScore =
                movementVectors.length >
                0
                    ? circular
                        .directionalConsistency
                    : (
                        stationaryRatio >=
                            0.75
                            ? 70
                            : 20
                    );

            const speedStabilityScore =
                meanSpeed >
                0
                    ? clamp(
                        100 -
                        speedCoefficientOfVariation,
                        0,
                        100
                    )
                    : (
                        stationaryRatio >=
                            0.75
                            ? 80
                            : 20
                    );

            const temporalCoverageScore =
                clamp(
                    (
                        totalElapsedSeconds /
                        (
                            30 *
                            60
                        )
                    ) *
                    100,
                    0,
                    100
                );

            const motionConfidence =
                clamp(
                    countScore *
                        0.25 +
                    directionScore *
                        0.30 +
                    speedStabilityScore *
                        0.25 +
                    temporalCoverageScore *
                        0.10 +
                    evidenceConfidence *
                        0.10,
                    0,
                    100
                );

            let motionState =
                "INSUFFICIENT";

            if (
                recentVectors.length <
                this.config
                    .minimumVectorCountForConfidence
            ) {
                motionState =
                    "INSUFFICIENT";
            } else if (
                stationaryRatio >=
                0.75
            ) {
                motionState =
                    "STATIONARY";
            } else if (
                meanSpeed <=
                this.config
                    .lowSpeedThresholdKmh
            ) {
                motionState =
                    "SLOW";
            } else if (
                meanSpeed >=
                this.config
                    .highSpeedThresholdKmh
            ) {
                motionState =
                    "FAST";
            } else {
                motionState =
                    "MOVING";
            }

            const latestVector =
                recentVectors[
                    recentVectors.length -
                    1
                ] ||
                null;

            return {
                trackId,

                status:
                    "MOTION_STATISTICS_READY",

                motionState,

                vectorCount:
                    vectors.length,

                recentVectorCount:
                    recentVectors.length,

                movingVectorCount:
                    movingCount,

                stationaryVectorCount:
                    stationaryCount,

                movingRatio:
                    Number(
                        movingRatio
                            .toFixed(4)
                    ),

                stationaryRatio:
                    Number(
                        stationaryRatio
                            .toFixed(4)
                    ),

                averageSpeedKmh:
                    Number(
                        meanSpeed
                            .toFixed(3)
                    ),

                medianSpeedKmh:
                    Number(
                        medianSpeed
                            .toFixed(3)
                    ),

                minimumSpeedKmh:
                    speedValues.length >
                        0
                        ? Number(
                            Math.min(
                                ...speedValues
                            )
                            .toFixed(3)
                        )
                        : null,

                maximumSpeedKmh:
                    speedValues.length >
                        0
                        ? Number(
                            Math.max(
                                ...speedValues
                            )
                            .toFixed(3)
                        )
                        : null,

                speedStandardDeviation:
                    Number(
                        speedStandardDeviation
                            .toFixed(3)
                    ),

                speedCoefficientOfVariation:
                    Number(
                        speedCoefficientOfVariation
                            .toFixed(2)
                    ),

                averageBearing:
                    circular
                        .meanBearing ===
                        null
                        ? null
                        : Number(
                            circular
                                .meanBearing
                                .toFixed(2)
                        ),

                directionalConsistency:
                    Number(
                        circular
                            .directionalConsistency
                            .toFixed(2)
                    ),

                circularVariance:
                    Number(
                        circular
                            .circularVariance
                            .toFixed(4)
                    ),

                totalDistanceKm:
                    Number(
                        totalDistanceKm
                            .toFixed(3)
                    ),

                totalElapsedSeconds:
                    Number(
                        totalElapsedSeconds
                            .toFixed(2)
                    ),

                totalElapsedMinutes:
                    Number(
                        (
                            totalElapsedSeconds /
                            60
                        )
                        .toFixed(2)
                    ),

                speedP25:
                    percentile(
                        speedValues,
                        0.25
                    ),

                speedP50:
                    percentile(
                        speedValues,
                        0.50
                    ),

                speedP75:
                    percentile(
                        speedValues,
                        0.75
                    ),

                confidence:
                    Number(
                        motionConfidence
                            .toFixed(2)
                    ),

                confidenceComponents: {
                    countScore:
                        Number(
                            countScore
                                .toFixed(2)
                        ),

                    directionScore:
                        Number(
                            directionScore
                                .toFixed(2)
                        ),

                    speedStabilityScore:
                        Number(
                            speedStabilityScore
                                .toFixed(2)
                        ),

                    temporalCoverageScore:
                        Number(
                            temporalCoverageScore
                                .toFixed(2)
                        ),

                    evidenceConfidence:
                        Number(
                            evidenceConfidence
                                .toFixed(2)
                        )
                },

                latestVector:
                    cloneValue(
                        latestVector
                    ),

                firstTimestamp:
                    recentVectors[0]
                        ?.startTimestamp ??
                    null,

                lastTimestamp:
                    latestVector
                        ?.endTimestamp ??
                    null,

                generatedAt:
                    now(),

                generatedAtIso:
                    new Date()
                        .toISOString()
            };
        }

        calculateNationalStatistics(
            trackStatistics
        ) {
            const readyTracks =
                trackStatistics.filter(
                    track =>
                        track.status ===
                        "MOTION_STATISTICS_READY"
                );

            const movingTracks =
                readyTracks.filter(
                    track =>
                        [
                            "MOVING",
                            "SLOW",
                            "FAST"
                        ].includes(
                            track.motionState
                        )
                );

            const stationaryTracks =
                readyTracks.filter(
                    track =>
                        track.motionState ===
                        "STATIONARY"
                );

            const weightedSpeeds =
                movingTracks.map(
                    track =>
                        track
                            .averageSpeedKmh
                );

            const speedWeights =
                movingTracks.map(
                    track =>
                        Math.max(
                            1,
                            track
                                .recentVectorCount
                        )
                );

            const bearings =
                movingTracks.map(
                    track =>
                        track
                            .averageBearing
                );

            const bearingWeights =
                movingTracks.map(
                    track =>
                        Math.max(
                            1,
                            track
                                .confidence
                        )
                );

            const circular =
                circularStatistics(
                    bearings,
                    bearingWeights
                );

            const confidenceValues =
                readyTracks.map(
                    track =>
                        track.confidence
                );

            const vectorCount =
                readyTracks.reduce(
                    (
                        sum,
                        track
                    ) =>
                        sum +
                        track
                            .vectorCount,
                    0
                );

            return {
                status:
                    "NATIONAL_MOTION_STATISTICS_READY",

                trackCount:
                    trackStatistics.length,

                readyTrackCount:
                    readyTracks.length,

                movingTrackCount:
                    movingTracks.length,

                stationaryTrackCount:
                    stationaryTracks.length,

                insufficientTrackCount:
                    trackStatistics.length -
                    readyTracks.length,

                vectorCount,

                averageSpeedKmh:
                    weightedMean(
                        weightedSpeeds,
                        speedWeights
                    ) ??
                    0,

                medianTrackSpeedKmh:
                    median(
                        weightedSpeeds
                    ) ??
                    0,

                averageBearing:
                    circular
                        .meanBearing,

                directionalConsistency:
                    circular
                        .directionalConsistency,

                averageConfidence:
                    arithmeticMean(
                        confidenceValues
                    ) ??
                    0,

                highConfidenceTrackCount:
                    readyTracks.filter(
                        track =>
                            track.confidence >=
                            70
                    ).length,

                generatedAt:
                    now(),

                generatedAtIso:
                    new Date()
                        .toISOString()
            };
        }

        publish(
            trackStatistics,
            nationalStatistics
        ) {
            const objectSnapshot =
                Object.fromEntries(
                    trackStatistics.map(
                        track => [
                            track.trackId,
                            cloneValue(
                                track
                            )
                        ]
                    )
                );

            global.RainArrivalMotionVectorStatistics =
                cloneValue(
                    objectSnapshot
                );

            global.RainArrivalMotionVectorStatisticsList =
                cloneValue(
                    trackStatistics
                );

            global.RainArrivalNationalMotionStatistics =
                cloneValue(
                    nationalStatistics
                );

            global.RainGuardAI =
                global.RainGuardAI ||
                {};

            global.RainGuardAI.V32 =
                global.RainGuardAI.V32 ||
                {};

            global.RainGuardAI.V32
                .motionVectorStatistics =
                cloneValue(
                    objectSnapshot
                );

            global.RainGuardAI.V32
                .motionVectorStatisticsList =
                cloneValue(
                    trackStatistics
                );

            global.RainGuardAI.V32
                .nationalMotionStatistics =
                cloneValue(
                    nationalStatistics
                );

            return {
                objectSnapshot,

                trackStatistics,

                nationalStatistics
            };
        }

        analyzeAll() {
            const startedAt =
                now();

            this.statistics
                .analyses +=
                1;

            try {
                const sourceTracks =
                    this.resolveRepositoryTracks();

                this.statistics
                    .inputTracks +=
                    sourceTracks.length;

                const trackStatistics =
                    [];

                let inputVectorCount =
                    0;

                for (
                    let index = 0;
                    index <
                        sourceTracks.length;
                    index += 1
                ) {
                    const vectors =
                        this.normalizeVectors(
                            sourceTracks[index]
                        );

                    inputVectorCount +=
                        vectors.length;

                    const calculated =
                        this.calculateTrackStatistics(
                            {
                                ...sourceTracks[index],
                                vectors
                            },
                            index
                        );

                    trackStatistics.push(
                        calculated
                    );

                    this.trackStatisticsMap.set(
                        calculated.trackId,
                        cloneValue(
                            calculated
                        )
                    );

                    if (
                        calculated.status ===
                        "MOTION_STATISTICS_READY"
                    ) {
                        this.statistics
                            .analyzedTracks +=
                            1;

                        if (
                            calculated.motionState ===
                            "STATIONARY"
                        ) {
                            this.statistics
                                .stationaryTracks +=
                                1;
                        } else {
                            this.statistics
                                .movingTracks +=
                                1;
                        }
                    }
                }

                this.statistics
                    .inputVectors +=
                    inputVectorCount;

                const nationalStatistics =
                    this.calculateNationalStatistics(
                        trackStatistics
                    );

                this.nationalStatistics =
                    cloneValue(
                        nationalStatistics
                    );

                this.publish(
                    trackStatistics,
                    nationalStatistics
                );

                const result = {
                    success:
                        true,

                    status:
                        "MOTION_VECTOR_STATISTICS_COMPLETED",

                    version:
                        this.version,

                    build:
                        this.buildId,

                    inputTrackCount:
                        sourceTracks.length,

                    inputVectorCount,

                    analyzedTrackCount:
                        trackStatistics
                            .filter(
                                track =>
                                    track.status ===
                                    "MOTION_STATISTICS_READY"
                            )
                            .length,

                    movingTrackCount:
                        nationalStatistics
                            .movingTrackCount,

                    stationaryTrackCount:
                        nationalStatistics
                            .stationaryTrackCount,

                    averageSpeedKmh:
                        Number(
                            nationalStatistics
                                .averageSpeedKmh
                                .toFixed(3)
                        ),

                    averageBearing:
                        nationalStatistics
                            .averageBearing ===
                            null
                            ? null
                            : Number(
                                nationalStatistics
                                    .averageBearing
                                    .toFixed(2)
                            ),

                    directionalConsistency:
                        Number(
                            nationalStatistics
                                .directionalConsistency
                                .toFixed(2)
                        ),

                    averageConfidence:
                        Number(
                            nationalStatistics
                                .averageConfidence
                                .toFixed(2)
                        ),

                    nationalStatistics:
                        cloneValue(
                            nationalStatistics
                        ),

                    startedAt,

                    completedAt:
                        now(),

                    durationMs:
                        now() -
                        startedAt
                };

                this.latestResult =
                    cloneValue(
                        result
                    );

                global.dispatchEvent?.(
                    new CustomEvent(
                        "rainarrival:motion-vector-statistics-updated",
                        {
                            detail:
                                cloneValue(
                                    result
                                )
                        }
                    )
                );

                if (
                    this.config.debug
                ) {
                    console.log(
                        "[RainArrival MotionVectorStatistics] Analysis result:",
                        result
                    );
                }

                return result;

            } catch (error) {
                this.statistics
                    .failures +=
                    1;

                this.lastError = {
                    name:
                        error?.name ??
                        "Error",

                    message:
                        error?.message ??
                        String(error),

                    stack:
                        error?.stack ??
                        null,

                    timestamp:
                        now()
                };

                const result = {
                    success:
                        false,

                    status:
                        "MOTION_VECTOR_STATISTICS_FAILED",

                    version:
                        this.version,

                    build:
                        this.buildId,

                    error:
                        cloneValue(
                            this.lastError
                        ),

                    startedAt,

                    completedAt:
                        now(),

                    durationMs:
                        now() -
                        startedAt
                };

                this.latestResult =
                    cloneValue(
                        result
                    );

                return result;
            }
        }

        getTrackStatistics(trackId) {
            return cloneValue(
                this.trackStatisticsMap
                    .get(
                        String(trackId)
                    ) ||
                null
            );
        }

        getAllTrackStatistics() {
            return cloneValue(
                Array.from(
                    this.trackStatisticsMap
                        .values()
                )
            );
        }

        getNationalStatistics() {
            return cloneValue(
                this.nationalStatistics
            );
        }

        getLatestResult() {
            return cloneValue(
                this.latestResult
            );
        }

        clear() {
            const removedCount =
                this.trackStatisticsMap
                    .size;

            this.trackStatisticsMap
                .clear();

            this.nationalStatistics =
                null;

            this.publish(
                [],
                {
                    status:
                        "NO_MOTION_STATISTICS",

                    trackCount:
                        0,

                    readyTrackCount:
                        0,

                    movingTrackCount:
                        0,

                    stationaryTrackCount:
                        0,

                    insufficientTrackCount:
                        0,

                    vectorCount:
                        0,

                    averageSpeedKmh:
                        0,

                    medianTrackSpeedKmh:
                        0,

                    averageBearing:
                        null,

                    directionalConsistency:
                        0,

                    averageConfidence:
                        0,

                    highConfidenceTrackCount:
                        0,

                    generatedAt:
                        now(),

                    generatedAtIso:
                        new Date()
                            .toISOString()
                }
            );

            return {
                success:
                    true,

                removedCount
            };
        }

        printTable() {
            const rows =
                this.getAllTrackStatistics()
                .map(
                    track => ({
                        trackId:
                            track.trackId,

                        state:
                            track.motionState,

                        vectors:
                            track.vectorCount,

                        moving:
                            track
                                .movingVectorCount,

                        stationary:
                            track
                                .stationaryVectorCount,

                        avgSpeedKmh:
                            track
                                .averageSpeedKmh,

                        avgBearing:
                            track
                                .averageBearing,

                        directionConsistency:
                            track
                                .directionalConsistency,

                        speedVariation:
                            track
                                .speedCoefficientOfVariation,

                        confidence:
                            track
                                .confidence
                    })
                );

            console.table(rows);

            return rows;
        }

        start() {
            if (
                this.running
            ) {
                return {
                    success:
                        true,

                    alreadyRunning:
                        true
                };
            }

            this.running =
                true;

            this.analyzeAll();

            this.timer =
                global.setInterval(
                    () =>
                        this.analyzeAll(),
                    this.config
                        .analysisIntervalMs
                );

            return {
                success:
                    true,

                running:
                    true,

                intervalMs:
                    this.config
                        .analysisIntervalMs
            };
        }

        stop() {
            if (
                this.timer
            ) {
                global.clearInterval(
                    this.timer
                );
            }

            this.timer =
                null;

            this.running =
                false;

            return {
                success:
                    true,

                running:
                    false
            };
        }

        getDiagnostics() {
            return {
                module:
                    MODULE_NAME,

                version:
                    this.version,

                build:
                    this.buildId,

                installed:
                    true,

                running:
                    this.running,

                trackStatisticsCount:
                    this.trackStatisticsMap
                        .size,

                nationalStatistics:
                    this
                        .getNationalStatistics(),

                latestResult:
                    this
                        .getLatestResult(),

                lastError:
                    cloneValue(
                        this.lastError
                    ),

                statistics:
                    cloneValue(
                        this.statistics
                    )
            };
        }

        diagnose() {
            const diagnostics =
                this.getDiagnostics();

            console.log(
                "[RainArrival MotionVectorStatistics]",
                diagnostics
            );

            return diagnostics;
        }
    }

    const engine =
        new MotionVectorStatisticsEngine();

    global.RainArrivalMotionVectorStatisticsV32 =
        engine;

    global.RainGuardAI =
        global.RainGuardAI ||
        {};

    global.RainGuardAI.V32 =
        global.RainGuardAI.V32 ||
        {};

    global.RainGuardAI.V32
        .rainArrivalModules =
        global.RainGuardAI.V32
            .rainArrivalModules ||
        {};

    global.RainGuardAI.V32
        .rainArrivalModules
        .motionVectorStatistics =
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

    global.analyzeRainArrivalMotionVectorStatistics =
        () =>
            engine.analyzeAll();

    if (
        engine.config
            .autoStart
    ) {
        engine.start();
    }

    console.log(
        "[RainGuard AI V32] Motion Vector Statistics Engine loaded.",
        {
            version:
                VERSION,

            build:
                BUILD_ID
        }
    );

})(
    typeof globalThis !==
        "undefined"
        ? globalThis
        : window
);
