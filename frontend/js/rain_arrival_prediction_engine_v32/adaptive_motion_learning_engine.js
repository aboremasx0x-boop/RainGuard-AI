/*
===========================================================
 RainGuard AI V32
 Phase 38M-19B — Adaptive Motion Learning Engine
 File: adaptive_motion_learning_engine.js
 Version: 32.38M.19B

 Purpose:
 - Compare predicted storm motion with observed track motion.
 - Calculate position, speed, bearing and ETA prediction errors.
 - Learn adaptive correction factors by track, city and confidence band.
 - Publish correction profiles for future motion prediction cycles.
===========================================================
*/

(function (global) {
    "use strict";

    const MODULE_NAME = "adaptiveMotionLearningEngine";
    const VERSION = "32.38M.19B";
    const BUILD_ID =
        "rainguard-v32-phase38m19b-adaptive-motion-learning-engine";

    const DEFAULT_CONFIG = Object.freeze({
        autoStart: true,
        learningIntervalMs: 20000,
        maximumSamples: 5000,
        minimumObservationGapMinutes: 1,
        maximumObservationGapMinutes: 180,
        minimumPredictionConfidence: 10,
        learningRate: 0.18,
        minimumLearningRate: 0.03,
        maximumLearningRate: 0.35,
        correctionClamp: {
            speedMultiplierMinimum: 0.45,
            speedMultiplierMaximum: 1.85,
            bearingOffsetMinimum: -75,
            bearingOffsetMaximum: 75,
            etaMultiplierMinimum: 0.4,
            etaMultiplierMaximum: 2.5
        },
        confidenceBands: [
            { key: "CRITICAL", minimum: 0, maximum: 24.999 },
            { key: "LOW", minimum: 25, maximum: 49.999 },
            { key: "MODERATE", minimum: 50, maximum: 74.999 },
            { key: "HIGH", minimum: 75, maximum: 89.999 },
            { key: "VERY_HIGH", minimum: 90, maximum: 100 }
        ],
        debug: true
    });

    const now = () => Date.now();

    function cloneValue(value) {
        if (value === null || value === undefined) return value;

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

    function toFiniteNumber(value, fallback = null) {
        const number = Number(value);
        return Number.isFinite(number) ? number : fallback;
    }

    function clamp(value, minimum, maximum) {
        return Math.max(minimum, Math.min(maximum, value));
    }

    function normalizeDegrees(value) {
        const number = toFiniteNumber(value, 0);
        return ((number % 360) + 360) % 360;
    }

    function shortestAngularDifference(target, source) {
        let difference =
            normalizeDegrees(target) -
            normalizeDegrees(source);

        if (difference > 180) difference -= 360;
        if (difference < -180) difference += 360;

        return difference;
    }

    function collectionToArray(value) {
        if (!value) return [];
        if (Array.isArray(value)) return value;

        if (value instanceof Map || value instanceof Set) {
            return Array.from(value.values());
        }

        if (typeof value.values === "function") {
            try {
                return Array.from(value.values());
            } catch (_) {}
        }

        return typeof value === "object"
            ? Object.values(value)
            : [];
    }

    function normalizeCoordinate(value) {
        if (!value || typeof value !== "object") return null;

        const latitude = toFiniteNumber(
            value.latitude ?? value.lat,
            null
        );

        const longitude = toFiniteNumber(
            value.longitude ?? value.lng ?? value.lon,
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

    function haversineDistanceKm(first, second) {
        if (!first || !second) return null;

        const earthRadiusKm = 6371;
        const toRadians = degrees => degrees * Math.PI / 180;

        const latitude1 = toRadians(first.latitude);
        const latitude2 = toRadians(second.latitude);
        const latitudeDifference =
            toRadians(second.latitude - first.latitude);
        const longitudeDifference =
            toRadians(second.longitude - first.longitude);

        const a =
            Math.sin(latitudeDifference / 2) ** 2 +
            Math.cos(latitude1) *
            Math.cos(latitude2) *
            Math.sin(longitudeDifference / 2) ** 2;

        return earthRadiusKm * 2 *
            Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    function bearingDegrees(first, second) {
        if (!first || !second) return null;

        const toRadians = degrees => degrees * Math.PI / 180;
        const toDegrees = radians => radians * 180 / Math.PI;

        const latitude1 = toRadians(first.latitude);
        const latitude2 = toRadians(second.latitude);
        const longitudeDifference =
            toRadians(second.longitude - first.longitude);

        const y =
            Math.sin(longitudeDifference) *
            Math.cos(latitude2);

        const x =
            Math.cos(latitude1) *
            Math.sin(latitude2) -
            Math.sin(latitude1) *
            Math.cos(latitude2) *
            Math.cos(longitudeDifference);

        return normalizeDegrees(
            toDegrees(Math.atan2(y, x))
        );
    }

    function mean(values) {
        const numbers = values
            .map(Number)
            .filter(Number.isFinite);

        if (numbers.length === 0) return null;

        return numbers.reduce(
            (sum, value) => sum + value,
            0
        ) / numbers.length;
    }

    function round(value, decimals = 4) {
        if (!Number.isFinite(value)) return null;

        const factor = Math.pow(10, decimals);
        return Math.round(value * factor) / factor;
    }

    function weightedBlend(previous, observed, rate) {
        if (!Number.isFinite(previous)) return observed;
        if (!Number.isFinite(observed)) return previous;

        return previous * (1 - rate) + observed * rate;
    }

    class AdaptiveMotionLearningEngine {
        constructor(config = {}) {
            this.version = VERSION;
            this.buildId = BUILD_ID;

            this.config = {
                ...DEFAULT_CONFIG,
                ...(config || {})
            };

            this.running = false;
            this.learning = false;
            this.timer = null;

            this.samples = [];
            this.profiles = new Map();
            this.latestResult = null;
            this.lastError = null;

            this.statistics = {
                runs: 0,
                successfulRuns: 0,
                failedRuns: 0,
                busySkips: 0,
                samplesBuilt: 0,
                samplesAccepted: 0,
                profilesUpdated: 0
            };
        }

        resolvePredictions() {
            const sources = [
                global.RainArrivalMotionPredictionRepositoryV32
                    ?.getAllPredictions?.(),

                global.RainArrivalMotionPredictionAIV32
                    ?.getAllPredictions?.(),

                global.RainArrivalMotionPredictions
            ];

            for (const source of sources) {
                const values = collectionToArray(source);

                if (values.length > 0) {
                    return values;
                }
            }

            return [];
        }

        resolveTrackHistory() {
            const sources = [
                global.RainArrivalPersistentTrackHistoryV32
                    ?.getAllTracks?.(),

                global.RainArrivalLiveTrackHistoryCaptureV32
                    ?.getAllTracks?.(),

                global.RainArrivalStableTrackIdentityV32
                    ?.getAllTracks?.(),

                global.RainArrivalTrackHistory
            ];

            for (const source of sources) {
                const values = collectionToArray(source);

                if (values.length > 0) {
                    return values;
                }
            }

            return [];
        }

        getConfidenceBand(confidence) {
            const value = toFiniteNumber(confidence, 0);

            return (
                this.config.confidenceBands.find(
                    band =>
                        value >= band.minimum &&
                        value <= band.maximum
                )?.key ??
                "UNKNOWN"
            );
        }

        resolveTrackKey(value) {
            return String(
                value?.stableId ??
                value?.trackId ??
                value?.candidateId ??
                value?.id ??
                ""
            );
        }

        extractHistoryPoints(track) {
            const points = collectionToArray(
                track?.points ??
                track?.history ??
                track?.samples ??
                track?.coordinates
            )
            .map((point, index) => {
                const coordinate = normalizeCoordinate(
                    point.coordinate ??
                    point
                );

                const timestamp = toFiniteNumber(
                    point.timestamp ??
                    point.observedAt ??
                    point.generatedAt ??
                    point.time,
                    null
                );

                if (!coordinate || timestamp === null) {
                    return null;
                }

                return {
                    index,
                    coordinate,
                    timestamp,
                    speedKmh: toFiniteNumber(
                        point.speedKmh ??
                        point.speed,
                        null
                    ),
                    bearing: toFiniteNumber(
                        point.bearing ??
                        point.direction,
                        null
                    )
                };
            })
            .filter(Boolean)
            .sort(
                (first, second) =>
                    first.timestamp -
                    second.timestamp
            );

            return points;
        }

        buildPredictionLookup(predictions) {
            const lookup = new Map();

            for (const prediction of predictions) {
                const keys = [
                    prediction.stableId,
                    prediction.trackId,
                    prediction.candidateId,
                    prediction.id
                ]
                .filter(Boolean)
                .map(String);

                for (const key of keys) {
                    if (!lookup.has(key)) {
                        lookup.set(key, prediction);
                    }
                }
            }

            return lookup;
        }

        findPredictionForTrack(track, lookup) {
            const keys = [
                track?.stableId,
                track?.trackId,
                track?.candidateId,
                track?.id
            ]
            .filter(Boolean)
            .map(String);

            for (const key of keys) {
                if (lookup.has(key)) {
                    return lookup.get(key);
                }
            }

            return null;
        }

        findNearestPredictionPoint(
            prediction,
            targetTimestamp
        ) {
            const futurePoints = collectionToArray(
                prediction?.predictions
            )
            .map(point => {
                const coordinate = normalizeCoordinate(
                    point.coordinate ??
                    point.predictedCoordinate
                );

                const timestamp = toFiniteNumber(
                    point.predictedAt ??
                    point.timestamp ??
                    point.generatedAt,
                    null
                );

                if (!coordinate) return null;

                return {
                    coordinate,
                    timestamp,
                    horizonMinutes: toFiniteNumber(
                        point.horizonMinutes,
                        null
                    ),
                    confidence: toFiniteNumber(
                        point.confidence,
                        prediction?.confidence ?? 0
                    ),
                    speedKmh: toFiniteNumber(
                        point.speedKmh,
                        null
                    ),
                    bearing: toFiniteNumber(
                        point.bearing,
                        null
                    ),
                    etaMinutes: toFiniteNumber(
                        point.etaMinutes ??
                        point.arrivalMinutes,
                        null
                    )
                };
            })
            .filter(Boolean);

            if (futurePoints.length === 0) return null;

            const withTimestamp = futurePoints.filter(
                point => point.timestamp !== null
            );

            if (withTimestamp.length > 0) {
                return withTimestamp
                    .slice()
                    .sort(
                        (first, second) =>
                            Math.abs(
                                first.timestamp -
                                targetTimestamp
                            ) -
                            Math.abs(
                                second.timestamp -
                                targetTimestamp
                            )
                    )[0];
            }

            return futurePoints[0];
        }

        buildSample(track, prediction) {
            const points = this.extractHistoryPoints(track);

            if (points.length < 2 || !prediction) {
                return null;
            }

            const first = points[points.length - 2];
            const last = points[points.length - 1];

            const gapMinutes =
                (last.timestamp - first.timestamp) /
                60000;

            if (
                gapMinutes <
                    this.config.minimumObservationGapMinutes ||
                gapMinutes >
                    this.config.maximumObservationGapMinutes
            ) {
                return null;
            }

            const observedDistanceKm =
                haversineDistanceKm(
                    first.coordinate,
                    last.coordinate
                );

            const observedSpeedKmh =
                observedDistanceKm !== null
                    ? observedDistanceKm /
                      (gapMinutes / 60)
                    : null;

            const observedBearing =
                bearingDegrees(
                    first.coordinate,
                    last.coordinate
                );

            const predictedPoint =
                this.findNearestPredictionPoint(
                    prediction,
                    last.timestamp
                );

            if (!predictedPoint) {
                return null;
            }

            const predictionConfidenceRaw =
                toFiniteNumber(
                    predictedPoint.confidence,
                    prediction.confidence ?? 0
                );

            const predictionConfidence =
                predictionConfidenceRaw <= 1
                    ? predictionConfidenceRaw * 100
                    : predictionConfidenceRaw;

            if (
                predictionConfidence <
                this.config.minimumPredictionConfidence
            ) {
                return null;
            }

            const positionErrorKm =
                haversineDistanceKm(
                    predictedPoint.coordinate,
                    last.coordinate
                );

            const predictedSpeedKmh =
                predictedPoint.speedKmh ??
                toFiniteNumber(
                    prediction.baseMotion?.speedKmh,
                    null
                );

            const predictedBearing =
                predictedPoint.bearing ??
                toFiniteNumber(
                    prediction.baseMotion?.bearing,
                    null
                );

            const speedErrorKmh =
                Number.isFinite(observedSpeedKmh) &&
                Number.isFinite(predictedSpeedKmh)
                    ? observedSpeedKmh -
                      predictedSpeedKmh
                    : null;

            const speedRatio =
                Number.isFinite(observedSpeedKmh) &&
                Number.isFinite(predictedSpeedKmh) &&
                predictedSpeedKmh > 0
                    ? observedSpeedKmh /
                      predictedSpeedKmh
                    : null;

            const bearingErrorDegrees =
                Number.isFinite(observedBearing) &&
                Number.isFinite(predictedBearing)
                    ? shortestAngularDifference(
                        observedBearing,
                        predictedBearing
                    )
                    : null;

            const profileKey = this.buildProfileKey(
                prediction,
                predictionConfidence
            );

            return {
                sampleId:
                    `AML-${this.resolveTrackKey(track)}-${last.timestamp}`,

                profileKey,

                trackId:
                    prediction.trackId ??
                    track.trackId ??
                    null,

                stableId:
                    prediction.stableId ??
                    track.stableId ??
                    null,

                city:
                    prediction.city ??
                    prediction.targetCity ??
                    track.city ??
                    null,

                confidence:
                    round(
                        predictionConfidence,
                        2
                    ),

                confidenceBand:
                    this.getConfidenceBand(
                        predictionConfidence
                    ),

                observedAt:
                    last.timestamp,

                gapMinutes:
                    round(gapMinutes, 3),

                predictedCoordinate:
                    cloneValue(
                        predictedPoint.coordinate
                    ),

                observedCoordinate:
                    cloneValue(
                        last.coordinate
                    ),

                positionErrorKm:
                    round(positionErrorKm, 4),

                predictedSpeedKmh:
                    round(predictedSpeedKmh, 4),

                observedSpeedKmh:
                    round(observedSpeedKmh, 4),

                speedErrorKmh:
                    round(speedErrorKmh, 4),

                speedRatio:
                    round(speedRatio, 6),

                predictedBearing:
                    round(predictedBearing, 4),

                observedBearing:
                    round(observedBearing, 4),

                bearingErrorDegrees:
                    round(bearingErrorDegrees, 4),

                predictedEtaMinutes:
                    predictedPoint.etaMinutes,

                generatedAt:
                    now()
            };
        }

        buildProfileKey(prediction, confidence) {
            const city = String(
                prediction?.city ??
                prediction?.targetCity ??
                "GLOBAL"
            ).toLowerCase();

            const band = this.getConfidenceBand(
                confidence
            );

            return `${city}|${band}`;
        }

        calculateAdaptiveRate(sampleCount) {
            const baseRate =
                this.config.learningRate /
                Math.sqrt(
                    Math.max(
                        1,
                        sampleCount / 10
                    )
                );

            return clamp(
                baseRate,
                this.config.minimumLearningRate,
                this.config.maximumLearningRate
            );
        }

        updateProfile(sample) {
            const previous =
                this.profiles.get(
                    sample.profileKey
                ) ?? {
                    profileKey:
                        sample.profileKey,

                    city:
                        sample.city,

                    confidenceBand:
                        sample.confidenceBand,

                    sampleCount:
                        0,

                    speedMultiplier:
                        1,

                    bearingOffsetDegrees:
                        0,

                    etaMultiplier:
                        1,

                    meanPositionErrorKm:
                        null,

                    meanAbsoluteSpeedErrorKmh:
                        null,

                    meanAbsoluteBearingErrorDegrees:
                        null,

                    updatedAt:
                        null
                };

            const nextCount =
                previous.sampleCount + 1;

            const rate =
                this.calculateAdaptiveRate(
                    nextCount
                );

            const observedSpeedMultiplier =
                Number.isFinite(
                    sample.speedRatio
                )
                    ? clamp(
                        sample.speedRatio,
                        this.config
                            .correctionClamp
                            .speedMultiplierMinimum,
                        this.config
                            .correctionClamp
                            .speedMultiplierMaximum
                    )
                    : previous.speedMultiplier;

            const observedBearingOffset =
                Number.isFinite(
                    sample.bearingErrorDegrees
                )
                    ? clamp(
                        sample.bearingErrorDegrees,
                        this.config
                            .correctionClamp
                            .bearingOffsetMinimum,
                        this.config
                            .correctionClamp
                            .bearingOffsetMaximum
                    )
                    : previous.bearingOffsetDegrees;

            const observedEtaMultiplier =
                Number.isFinite(
                    sample.speedRatio
                ) &&
                sample.speedRatio > 0
                    ? clamp(
                        1 / sample.speedRatio,
                        this.config
                            .correctionClamp
                            .etaMultiplierMinimum,
                        this.config
                            .correctionClamp
                            .etaMultiplierMaximum
                    )
                    : previous.etaMultiplier;

            const profile = {
                ...previous,

                sampleCount:
                    nextCount,

                learningRate:
                    round(rate, 6),

                speedMultiplier:
                    round(
                        weightedBlend(
                            previous.speedMultiplier,
                            observedSpeedMultiplier,
                            rate
                        ),
                        6
                    ),

                bearingOffsetDegrees:
                    round(
                        weightedBlend(
                            previous.bearingOffsetDegrees,
                            observedBearingOffset,
                            rate
                        ),
                        6
                    ),

                etaMultiplier:
                    round(
                        weightedBlend(
                            previous.etaMultiplier,
                            observedEtaMultiplier,
                            rate
                        ),
                        6
                    ),

                meanPositionErrorKm:
                    round(
                        weightedBlend(
                            previous.meanPositionErrorKm,
                            sample.positionErrorKm,
                            rate
                        ),
                        6
                    ),

                meanAbsoluteSpeedErrorKmh:
                    round(
                        weightedBlend(
                            previous.meanAbsoluteSpeedErrorKmh,
                            Number.isFinite(
                                sample.speedErrorKmh
                            )
                                ? Math.abs(
                                    sample.speedErrorKmh
                                )
                                : null,
                            rate
                        ),
                        6
                    ),

                meanAbsoluteBearingErrorDegrees:
                    round(
                        weightedBlend(
                            previous.meanAbsoluteBearingErrorDegrees,
                            Number.isFinite(
                                sample.bearingErrorDegrees
                            )
                                ? Math.abs(
                                    sample.bearingErrorDegrees
                                )
                                : null,
                            rate
                        ),
                        6
                    ),

                updatedAt:
                    now()
            };

            this.profiles.set(
                sample.profileKey,
                profile
            );

            return profile;
        }

        learn() {
            if (this.learning) {
                this.statistics.busySkips += 1;

                return {
                    success: false,
                    status:
                        "ADAPTIVE_MOTION_LEARNING_BUSY",
                    version: this.version,
                    build: this.buildId,
                    generatedAt: now()
                };
            }

            const startedAt = now();

            this.learning = true;
            this.statistics.runs += 1;

            try {
                const predictions =
                    this.resolvePredictions();

                const histories =
                    this.resolveTrackHistory();

                const lookup =
                    this.buildPredictionLookup(
                        predictions
                    );

                const builtSamples = [];

                for (const track of histories) {
                    const prediction =
                        this.findPredictionForTrack(
                            track,
                            lookup
                        );

                    const sample =
                        this.buildSample(
                            track,
                            prediction
                        );

                    if (sample) {
                        builtSamples.push(sample);
                    }
                }

                const existingIds =
                    new Set(
                        this.samples.map(
                            sample =>
                                sample.sampleId
                        )
                    );

                const acceptedSamples =
                    builtSamples.filter(
                        sample =>
                            !existingIds.has(
                                sample.sampleId
                            )
                    );

                const updatedProfiles = [];

                for (const sample of acceptedSamples) {
                    this.samples.unshift(
                        sample
                    );

                    updatedProfiles.push(
                        this.updateProfile(
                            sample
                        )
                    );
                }

                if (
                    this.samples.length >
                    this.config.maximumSamples
                ) {
                    this.samples.length =
                        this.config.maximumSamples;
                }

                this.statistics.samplesBuilt +=
                    builtSamples.length;

                this.statistics.samplesAccepted +=
                    acceptedSamples.length;

                this.statistics.profilesUpdated +=
                    updatedProfiles.length;

                const result = {
                    success: true,
                    status:
                        "ADAPTIVE_MOTION_LEARNING_COMPLETED",
                    version: this.version,
                    build: this.buildId,

                    predictionCount:
                        predictions.length,

                    historyTrackCount:
                        histories.length,

                    builtSampleCount:
                        builtSamples.length,

                    acceptedSampleCount:
                        acceptedSamples.length,

                    totalSampleCount:
                        this.samples.length,

                    profileCount:
                        this.profiles.size,

                    averagePositionErrorKm:
                        round(
                            mean(
                                this.samples.map(
                                    sample =>
                                        sample.positionErrorKm
                                )
                            ),
                            4
                        ),

                    averageAbsoluteSpeedErrorKmh:
                        round(
                            mean(
                                this.samples.map(
                                    sample =>
                                        Number.isFinite(
                                            sample.speedErrorKmh
                                        )
                                            ? Math.abs(
                                                sample.speedErrorKmh
                                            )
                                            : null
                                )
                            ),
                            4
                        ),

                    averageAbsoluteBearingErrorDegrees:
                        round(
                            mean(
                                this.samples.map(
                                    sample =>
                                        Number.isFinite(
                                            sample.bearingErrorDegrees
                                        )
                                            ? Math.abs(
                                                sample.bearingErrorDegrees
                                            )
                                            : null
                                )
                            ),
                            4
                        ),

                    profiles:
                        this.getAllProfiles(),

                    latestSamples:
                        cloneValue(
                            acceptedSamples.slice(
                                0,
                                20
                            )
                        ),

                    startedAt,

                    completedAt:
                        now(),

                    durationMs:
                        now() -
                        startedAt
                };

                this.latestResult =
                    cloneValue(result);

                this.statistics.successfulRuns += 1;

                this.publish(result);

                if (this.config.debug) {
                    console.log(
                        "[RainArrival AdaptiveMotionLearning] Result:",
                        result
                    );
                }

                return result;

            } catch (error) {
                this.statistics.failedRuns += 1;

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
                    success: false,
                    status:
                        "ADAPTIVE_MOTION_LEARNING_FAILED",
                    version: this.version,
                    build: this.buildId,
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
                    cloneValue(result);

                return result;

            } finally {
                this.learning = false;
            }
        }

        publish(result) {
            global.RainArrivalAdaptiveMotionLearningResult =
                cloneValue(result);

            global.RainArrivalAdaptiveMotionProfiles =
                this.getAllProfiles();

            global.RainArrivalAdaptiveMotionSamples =
                this.getSamples();

            global.RainGuardAI =
                global.RainGuardAI ||
                {};

            global.RainGuardAI.V32 =
                global.RainGuardAI.V32 ||
                {};

            global.RainGuardAI.V32
                .adaptiveMotionLearning =
                cloneValue(result);

            global.RainGuardAI.V32
                .adaptiveMotionProfiles =
                this.getAllProfiles();

            global.dispatchEvent?.(
                new CustomEvent(
                    "rainarrival:adaptive-motion-learning-completed",
                    {
                        detail:
                            cloneValue(result)
                    }
                )
            );

            return result;
        }

        getCorrectionProfile(
            city = "GLOBAL",
            confidence = 50
        ) {
            const key =
                `${String(city).toLowerCase()}|` +
                this.getConfidenceBand(
                    confidence
                );

            return cloneValue(
                this.profiles.get(key) ??
                null
            );
        }

        applyCorrection(
            prediction,
            city = null,
            confidence = null
        ) {
            if (!prediction || typeof prediction !== "object") {
                return null;
            }

            const resolvedCity =
                city ??
                prediction.city ??
                prediction.targetCity ??
                "GLOBAL";

            const resolvedConfidence =
                confidence ??
                prediction.confidence ??
                50;

            const profile =
                this.getCorrectionProfile(
                    resolvedCity,
                    resolvedConfidence
                );

            if (!profile) {
                return {
                    ...cloneValue(prediction),
                    adaptiveCorrectionApplied: false
                };
            }

            const corrected =
                cloneValue(prediction);

            if (
                corrected.baseMotion &&
                Number.isFinite(
                    Number(
                        corrected.baseMotion
                            .speedKmh
                    )
                )
            ) {
                corrected.baseMotion.speedKmh =
                    round(
                        corrected.baseMotion.speedKmh *
                        profile.speedMultiplier,
                        4
                    );
            }

            if (
                corrected.baseMotion &&
                Number.isFinite(
                    Number(
                        corrected.baseMotion
                            .bearing
                    )
                )
            ) {
                corrected.baseMotion.bearing =
                    round(
                        normalizeDegrees(
                            corrected.baseMotion.bearing +
                            profile.bearingOffsetDegrees
                        ),
                        4
                    );
            }

            corrected.predictions =
                collectionToArray(
                    corrected.predictions
                ).map(point => {
                    const item =
                        cloneValue(point);

                    if (
                        Number.isFinite(
                            Number(
                                item.speedKmh
                            )
                        )
                    ) {
                        item.speedKmh =
                            round(
                                item.speedKmh *
                                profile.speedMultiplier,
                                4
                            );
                    }

                    if (
                        Number.isFinite(
                            Number(
                                item.bearing
                            )
                        )
                    ) {
                        item.bearing =
                            round(
                                normalizeDegrees(
                                    item.bearing +
                                    profile.bearingOffsetDegrees
                                ),
                                4
                            );
                    }

                    if (
                        Number.isFinite(
                            Number(
                                item.etaMinutes ??
                                item.arrivalMinutes
                            )
                        )
                    ) {
                        const correctedEta =
                            round(
                                Number(
                                    item.etaMinutes ??
                                    item.arrivalMinutes
                                ) *
                                profile.etaMultiplier,
                                2
                            );

                        item.etaMinutes =
                            correctedEta;

                        item.arrivalMinutes =
                            correctedEta;
                    }

                    item.adaptiveCorrectionApplied =
                        true;

                    item.adaptiveProfileKey =
                        profile.profileKey;

                    return item;
                });

            corrected.adaptiveCorrectionApplied =
                true;

            corrected.adaptiveProfileKey =
                profile.profileKey;

            corrected.adaptiveProfile =
                profile;

            return corrected;
        }

        getSamples(limit = this.config.maximumSamples) {
            return cloneValue(
                this.samples.slice(
                    0,
                    Math.max(
                        0,
                        Number(limit) || 0
                    )
                )
            );
        }

        getAllProfiles() {
            return cloneValue(
                Array.from(
                    this.profiles.values()
                )
            );
        }

        getLatestResult() {
            return cloneValue(
                this.latestResult
            );
        }

        printProfiles() {
            const profiles =
                this.getAllProfiles();

            console.table(
                profiles.map(
                    profile => ({
                        profileKey:
                            profile.profileKey,
                        city:
                            profile.city,
                        confidenceBand:
                            profile.confidenceBand,
                        sampleCount:
                            profile.sampleCount,
                        speedMultiplier:
                            profile.speedMultiplier,
                        bearingOffsetDegrees:
                            profile.bearingOffsetDegrees,
                        etaMultiplier:
                            profile.etaMultiplier,
                        meanPositionErrorKm:
                            profile.meanPositionErrorKm
                    })
                )
            );

            return profiles;
        }

        printSamples(limit = 20) {
            const samples =
                this.getSamples(limit);

            console.table(
                samples.map(
                    sample => ({
                        sampleId:
                            sample.sampleId,
                        city:
                            sample.city,
                        confidence:
                            sample.confidence,
                        positionErrorKm:
                            sample.positionErrorKm,
                        speedErrorKmh:
                            sample.speedErrorKmh,
                        bearingErrorDegrees:
                            sample.bearingErrorDegrees,
                        speedRatio:
                            sample.speedRatio
                    })
                )
            );

            return samples;
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

                learning:
                    this.learning,

                sampleCount:
                    this.samples.length,

                profileCount:
                    this.profiles.size,

                latestResult:
                    this.getLatestResult(),

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
                    )
            };
        }

        diagnose() {
            const diagnostics =
                this.getDiagnostics();

            console.log(
                "[RainArrival AdaptiveMotionLearning]",
                diagnostics
            );

            return diagnostics;
        }

        clear() {
            this.samples = [];
            this.profiles.clear();
            this.latestResult = null;
            this.lastError = null;

            return {
                success: true,
                status:
                    "ADAPTIVE_MOTION_LEARNING_CLEARED"
            };
        }

        start() {
            if (this.running) {
                return {
                    success: true,
                    alreadyRunning: true
                };
            }

            this.running = true;
            this.learn();

            this.timer =
                global.setInterval(
                    () =>
                        this.learn(),
                    this.config
                        .learningIntervalMs
                );

            return {
                success: true,
                running: true,
                intervalMs:
                    this.config
                        .learningIntervalMs
            };
        }

        stop() {
            if (this.timer) {
                global.clearInterval(
                    this.timer
                );
            }

            this.timer = null;
            this.running = false;

            return {
                success: true,
                running: false
            };
        }
    }

    const engine =
        new AdaptiveMotionLearningEngine();

    global.RainArrivalAdaptiveMotionLearningV32 =
        engine;

    global.RainArrivalAdaptiveMotionLearningEngineV32 =
        engine;

    global.RainGuardAI =
        global.RainGuardAI ||
        {};

    global.RainGuardAI.V32 =
        global.RainGuardAI.V32 ||
        {};

    global.RainGuardAI.V32.rainArrivalModules =
        global.RainGuardAI.V32.rainArrivalModules ||
        {};

    global.RainGuardAI.V32
        .rainArrivalModules
        .adaptiveMotionLearning =
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

    global.runRainArrivalAdaptiveMotionLearning =
        () =>
            engine.learn();

    if (engine.config.autoStart) {
        engine.start();
    }

    console.log(
        "[RainGuard AI V32] Adaptive Motion Learning Engine loaded.",
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
