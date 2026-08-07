/*
===========================================================
 RainGuard AI V32
 Phase 38M-19A — Motion Prediction Statistics
 File: motion_prediction_statistics.js
 Version: 32.38M.19A

 Purpose:
 - Analyze motion-prediction repository results.
 - Calculate confidence, speed, bearing, acceleration and horizon metrics.
 - Group statistics by city, status and confidence band.
 - Publish operational statistics for renderers and decision engines.
===========================================================
*/

(function (global) {
    "use strict";

    const MODULE_NAME = "motionPredictionStatistics";
    const VERSION = "32.38M.19A";
    const BUILD_ID =
        "rainguard-v32-phase38m19a-motion-prediction-statistics";

    const DEFAULT_CONFIG = Object.freeze({
        autoStart: true,
        updateIntervalMs: 15000,
        minimumAcceptedConfidence: 20,
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

    function numericValues(values) {
        return values
            .map(value => Number(value))
            .filter(Number.isFinite);
    }

    function mean(values) {
        const items = numericValues(values);

        if (items.length === 0) return null;

        return items.reduce(
            (sum, value) => sum + value,
            0
        ) / items.length;
    }

    function median(values) {
        const items = numericValues(values)
            .sort((first, second) => first - second);

        if (items.length === 0) return null;

        const middle = Math.floor(items.length / 2);

        if (items.length % 2 === 0) {
            return (
                items[middle - 1] +
                items[middle]
            ) / 2;
        }

        return items[middle];
    }

    function minimum(values) {
        const items = numericValues(values);
        return items.length > 0 ? Math.min(...items) : null;
    }

    function maximum(values) {
        const items = numericValues(values);
        return items.length > 0 ? Math.max(...items) : null;
    }

    function standardDeviation(values) {
        const items = numericValues(values);

        if (items.length === 0) return null;

        const average = mean(items);

        const variance = items.reduce(
            (sum, value) =>
                sum + Math.pow(value - average, 2),
            0
        ) / items.length;

        return Math.sqrt(variance);
    }

    function percentile(values, percentileValue) {
        const items = numericValues(values)
            .sort((first, second) => first - second);

        if (items.length === 0) return null;

        const p = clamp(
            Number(percentileValue) || 0,
            0,
            100
        );

        const position =
            (items.length - 1) * p / 100;

        const lower = Math.floor(position);
        const upper = Math.ceil(position);

        if (lower === upper) {
            return items[lower];
        }

        const weight = position - lower;

        return (
            items[lower] * (1 - weight) +
            items[upper] * weight
        );
    }

    function round(value, decimals = 2) {
        if (!Number.isFinite(value)) return null;

        const factor = Math.pow(10, decimals);

        return Math.round(value * factor) / factor;
    }

    function summarizeNumbers(values) {
        const items = numericValues(values);

        return {
            count: items.length,
            minimum: round(minimum(items)),
            maximum: round(maximum(items)),
            mean: round(mean(items)),
            median: round(median(items)),
            standardDeviation: round(
                standardDeviation(items)
            ),
            percentile25: round(percentile(items, 25)),
            percentile75: round(percentile(items, 75)),
            percentile90: round(percentile(items, 90)),
            percentile95: round(percentile(items, 95))
        };
    }

    class MotionPredictionStatistics {
        constructor(config = {}) {
            this.version = VERSION;
            this.buildId = BUILD_ID;

            this.config = {
                ...DEFAULT_CONFIG,
                ...(config || {})
            };

            this.running = false;
            this.executing = false;
            this.timer = null;

            this.latestStatistics = null;
            this.latestResult = null;
            this.lastError = null;

            this.history = [];
            this.maximumHistoryEntries = 100;

            this.statistics = {
                runs: 0,
                successfulRuns: 0,
                failedRuns: 0,
                busySkips: 0,
                analyzedPredictions: 0
            };
        }

        resolvePredictions() {
            const sources = [
                global.RainArrivalMotionPredictionRepositoryV32
                    ?.getAllPredictions?.(),

                global.RainArrivalMotionPredictionRepository
                    ?.getAllPredictions?.(),

                global.RainArrivalMotionPredictionAIV32
                    ?.getAllPredictions?.(),

                global.RainArrivalMotionPredictionList,

                global.RainArrivalMotionPredictionStore,

                global.RainArrivalMotionPredictions
            ];

            for (const source of sources) {
                const predictions = collectionToArray(source);

                if (predictions.length > 0) {
                    return predictions;
                }
            }

            return [];
        }

        getConfidenceBand(confidence) {
            const value = toFiniteNumber(confidence, 0);

            const band = this.config.confidenceBands.find(
                item =>
                    value >= item.minimum &&
                    value <= item.maximum
            );

            return band?.key ?? "UNKNOWN";
        }

        groupBy(items, selector) {
            const groups = new Map();

            for (const item of items) {
                const key = String(
                    selector(item) ??
                    "UNKNOWN"
                );

                if (!groups.has(key)) {
                    groups.set(key, []);
                }

                groups.get(key).push(item);
            }

            return groups;
        }

        calculateCityStatistics(predictions) {
            const grouped = this.groupBy(
                predictions,
                prediction =>
                    prediction.city ??
                    prediction.targetCity ??
                    "UNKNOWN"
            );

            const result = {};

            for (const [city, items] of grouped.entries()) {
                const accepted = items.filter(
                    item => item.accepted === true
                );

                const confidenceValues = items.map(
                    item => item.confidence
                );

                const speedValues = items.map(
                    item =>
                        item.baseMotion?.speedKmh
                );

                result[city] = {
                    city,
                    totalCount: items.length,
                    acceptedCount: accepted.length,
                    rejectedCount:
                        items.length -
                        accepted.length,
                    acceptanceRate: round(
                        items.length > 0
                            ? accepted.length /
                              items.length *
                              100
                            : 0
                    ),
                    confidence:
                        summarizeNumbers(
                            confidenceValues
                        ),
                    speedKmh:
                        summarizeNumbers(
                            speedValues
                        ),
                    topTrackId:
                        items
                            .slice()
                            .sort(
                                (first, second) =>
                                    (
                                        second.confidence ??
                                        0
                                    ) -
                                    (
                                        first.confidence ??
                                        0
                                    )
                            )[0]
                            ?.trackId ??
                        null
                };
            }

            return result;
        }

        calculateStatusStatistics(predictions) {
            const grouped = this.groupBy(
                predictions,
                prediction =>
                    prediction.status ??
                    "UNKNOWN"
            );

            const result = {};

            for (const [status, items] of grouped.entries()) {
                result[status] = {
                    status,
                    count: items.length,
                    percentage: round(
                        predictions.length > 0
                            ? items.length /
                              predictions.length *
                              100
                            : 0
                    ),
                    averageConfidence: round(
                        mean(
                            items.map(
                                item =>
                                    item.confidence
                            )
                        )
                    )
                };
            }

            return result;
        }

        calculateConfidenceBandStatistics(predictions) {
            const result = {};

            for (const band of this.config.confidenceBands) {
                result[band.key] = {
                    band: band.key,
                    minimum: band.minimum,
                    maximum: band.maximum,
                    count: 0,
                    percentage: 0,
                    acceptedCount: 0,
                    rejectedCount: 0
                };
            }

            for (const prediction of predictions) {
                const key = this.getConfidenceBand(
                    prediction.confidence
                );

                if (!result[key]) {
                    result[key] = {
                        band: key,
                        minimum: null,
                        maximum: null,
                        count: 0,
                        percentage: 0,
                        acceptedCount: 0,
                        rejectedCount: 0
                    };
                }

                result[key].count += 1;

                if (prediction.accepted === true) {
                    result[key].acceptedCount += 1;
                } else {
                    result[key].rejectedCount += 1;
                }
            }

            for (const item of Object.values(result)) {
                item.percentage = round(
                    predictions.length > 0
                        ? item.count /
                          predictions.length *
                          100
                        : 0
                );
            }

            return result;
        }

        calculateHorizonStatistics(predictions) {
            const horizons = new Map();

            for (const prediction of predictions) {
                const items = collectionToArray(
                    prediction.predictions
                );

                for (const item of items) {
                    const horizonMinutes =
                        toFiniteNumber(
                            item.horizonMinutes,
                            null
                        );

                    if (horizonMinutes === null) {
                        continue;
                    }

                    if (!horizons.has(horizonMinutes)) {
                        horizons.set(
                            horizonMinutes,
                            []
                        );
                    }

                    horizons.get(
                        horizonMinutes
                    ).push(item);
                }
            }

            const result = {};

            for (
                const [
                    horizonMinutes,
                    items
                ] of Array.from(
                    horizons.entries()
                ).sort(
                    (first, second) =>
                        first[0] -
                        second[0]
                )
            ) {
                const accepted = items.filter(
                    item =>
                        item.accepted !== false
                );

                result[horizonMinutes] = {
                    horizonMinutes,
                    totalCount: items.length,
                    acceptedCount: accepted.length,
                    rejectedCount:
                        items.length -
                        accepted.length,
                    acceptanceRate: round(
                        items.length > 0
                            ? accepted.length /
                              items.length *
                              100
                            : 0
                    ),
                    confidence:
                        summarizeNumbers(
                            items.map(
                                item =>
                                    item.confidence
                            )
                        ),
                    predictedSpeedKmh:
                        summarizeNumbers(
                            items.map(
                                item =>
                                    item.speedKmh
                            )
                        ),
                    distanceKm:
                        summarizeNumbers(
                            items.map(
                                item =>
                                    item.distanceKm
                            )
                        )
                };
            }

            return result;
        }

        calculateMotionStatistics(predictions) {
            const speedValues = [];
            const bearingValues = [];
            const directionalConsistencyValues = [];
            const accelerationValues = [];
            const turnRateValues = [];
            const vectorCountValues = [];
            const confidenceValues = [];

            for (const prediction of predictions) {
                speedValues.push(
                    prediction.baseMotion?.speedKmh
                );

                bearingValues.push(
                    prediction.baseMotion?.bearing
                );

                directionalConsistencyValues.push(
                    prediction.baseMotion
                        ?.directionalConsistency
                );

                accelerationValues.push(
                    prediction.trends
                        ?.accelerationKmhPerMinute
                );

                turnRateValues.push(
                    prediction.trends
                        ?.turnRateDegPerMinute
                );

                vectorCountValues.push(
                    prediction.vectorCount
                );

                confidenceValues.push(
                    prediction.confidence
                );
            }

            return {
                speedKmh:
                    summarizeNumbers(
                        speedValues
                    ),

                bearingDegrees:
                    summarizeNumbers(
                        bearingValues
                    ),

                directionalConsistency:
                    summarizeNumbers(
                        directionalConsistencyValues
                    ),

                accelerationKmhPerMinute:
                    summarizeNumbers(
                        accelerationValues
                    ),

                absoluteAccelerationKmhPerMinute:
                    summarizeNumbers(
                        accelerationValues.map(
                            value =>
                                Number.isFinite(
                                    Number(value)
                                )
                                    ? Math.abs(
                                        Number(value)
                                    )
                                    : null
                        )
                    ),

                turnRateDegPerMinute:
                    summarizeNumbers(
                        turnRateValues
                    ),

                absoluteTurnRateDegPerMinute:
                    summarizeNumbers(
                        turnRateValues.map(
                            value =>
                                Number.isFinite(
                                    Number(value)
                                )
                                    ? Math.abs(
                                        Number(value)
                                    )
                                    : null
                        )
                    ),

                vectorCount:
                    summarizeNumbers(
                        vectorCountValues
                    ),

                confidence:
                    summarizeNumbers(
                        confidenceValues
                    )
            };
        }

        calculateQualityIndicators(predictions) {
            const totalCount = predictions.length;

            const accepted = predictions.filter(
                prediction =>
                    prediction.accepted === true
            );

            const highConfidence = predictions.filter(
                prediction =>
                    (
                        prediction.confidence ??
                        0
                    ) >= 75
            );

            const multiHorizon = predictions.filter(
                prediction =>
                    (
                        prediction.acceptedPredictionCount ??
                        collectionToArray(
                            prediction.predictions
                        ).filter(
                            item =>
                                item.accepted !==
                                false
                        ).length
                    ) >= 3
            );

            const stableDirection = predictions.filter(
                prediction =>
                    (
                        prediction.baseMotion
                            ?.directionalConsistency ??
                        0
                    ) >= 60
            );

            const movingTracks = predictions.filter(
                prediction =>
                    prediction.baseMotion
                        ?.stationary !== true &&
                    (
                        prediction.baseMotion
                            ?.speedKmh ??
                        0
                    ) > 1
            );

            return {
                acceptanceRate: round(
                    totalCount > 0
                        ? accepted.length /
                          totalCount *
                          100
                        : 0
                ),

                highConfidenceRate: round(
                    totalCount > 0
                        ? highConfidence.length /
                          totalCount *
                          100
                        : 0
                ),

                multiHorizonRate: round(
                    totalCount > 0
                        ? multiHorizon.length /
                          totalCount *
                          100
                        : 0
                ),

                stableDirectionRate: round(
                    totalCount > 0
                        ? stableDirection.length /
                          totalCount *
                          100
                        : 0
                ),

                movingTrackRate: round(
                    totalCount > 0
                        ? movingTracks.length /
                          totalCount *
                          100
                        : 0
                )
            };
        }

        buildStatistics() {
            if (this.executing) {
                this.statistics.busySkips += 1;

                return {
                    success: false,
                    status:
                        "MOTION_PREDICTION_STATISTICS_BUSY",
                    version: this.version,
                    build: this.buildId,
                    generatedAt: now()
                };
            }

            const startedAt = now();

            this.executing = true;
            this.statistics.runs += 1;

            try {
                const predictions =
                    this.resolvePredictions();

                const acceptedPredictions =
                    predictions.filter(
                        prediction =>
                            prediction.accepted ===
                            true &&
                            (
                                prediction.confidence ??
                                0
                            ) >=
                            this.config
                                .minimumAcceptedConfidence
                    );

                const rejectedPredictions =
                    predictions.filter(
                        prediction =>
                            !acceptedPredictions
                                .includes(
                                    prediction
                                )
                    );

                const cityStatistics =
                    this.calculateCityStatistics(
                        predictions
                    );

                const statusStatistics =
                    this.calculateStatusStatistics(
                        predictions
                    );

                const confidenceBandStatistics =
                    this
                        .calculateConfidenceBandStatistics(
                            predictions
                        );

                const horizonStatistics =
                    this.calculateHorizonStatistics(
                        predictions
                    );

                const motionStatistics =
                    this.calculateMotionStatistics(
                        predictions
                    );

                const qualityIndicators =
                    this.calculateQualityIndicators(
                        predictions
                    );

                const topPredictions =
                    predictions
                        .slice()
                        .sort(
                            (first, second) =>
                                (
                                    second.confidence ??
                                    0
                                ) -
                                (
                                    first.confidence ??
                                    0
                                )
                        )
                        .slice(0, 10)
                        .map(
                            prediction => ({
                                trackId:
                                    prediction.trackId,
                                stableId:
                                    prediction.stableId,
                                city:
                                    prediction.city ??
                                    null,
                                confidence:
                                    prediction.confidence ??
                                    0,
                                status:
                                    prediction.status ??
                                    null,
                                accepted:
                                    prediction.accepted ===
                                    true,
                                speedKmh:
                                    prediction.baseMotion
                                        ?.speedKmh ??
                                    null,
                                bearing:
                                    prediction.baseMotion
                                        ?.bearing ??
                                    null,
                                horizonCount:
                                    collectionToArray(
                                        prediction.predictions
                                    ).length
                            })
                        );

                const result = {
                    success: true,
                    status:
                        "MOTION_PREDICTION_STATISTICS_COMPLETED",
                    version: this.version,
                    build: this.buildId,

                    summary: {
                        totalPredictionCount:
                            predictions.length,

                        acceptedPredictionCount:
                            acceptedPredictions.length,

                        rejectedPredictionCount:
                            rejectedPredictions.length,

                        cityCount:
                            Object.keys(
                                cityStatistics
                            ).length,

                        statusCount:
                            Object.keys(
                                statusStatistics
                            ).length,

                        horizonCount:
                            Object.keys(
                                horizonStatistics
                            ).length,

                        averageConfidence:
                            motionStatistics
                                .confidence
                                .mean,

                        maximumConfidence:
                            motionStatistics
                                .confidence
                                .maximum,

                        averageSpeedKmh:
                            motionStatistics
                                .speedKmh
                                .mean,

                        averageAbsoluteAcceleration:
                            motionStatistics
                                .absoluteAccelerationKmhPerMinute
                                .mean,

                        averageAbsoluteTurnRate:
                            motionStatistics
                                .absoluteTurnRateDegPerMinute
                                .mean,

                        acceptanceRate:
                            qualityIndicators
                                .acceptanceRate
                    },

                    motionStatistics,
                    qualityIndicators,
                    cityStatistics,
                    statusStatistics,
                    confidenceBandStatistics,
                    horizonStatistics,
                    topPredictions,

                    startedAt,
                    completedAt: now(),
                    durationMs:
                        now() -
                        startedAt
                };

                this.latestStatistics =
                    cloneValue(result);

                this.latestResult = {
                    success: true,
                    status:
                        "MOTION_PREDICTION_STATISTICS_COMPLETED",
                    version: this.version,
                    build: this.buildId,
                    predictionCount:
                        predictions.length,
                    acceptedCount:
                        acceptedPredictions.length,
                    rejectedCount:
                        rejectedPredictions.length,
                    cityCount:
                        Object.keys(
                            cityStatistics
                        ).length,
                    generatedAt:
                        result.completedAt,
                    durationMs:
                        result.durationMs
                };

                this.history.unshift({
                    generatedAt:
                        result.completedAt,
                    summary:
                        cloneValue(
                            result.summary
                        )
                });

                if (
                    this.history.length >
                    this.maximumHistoryEntries
                ) {
                    this.history.length =
                        this.maximumHistoryEntries;
                }

                this.statistics.successfulRuns += 1;
                this.statistics.analyzedPredictions +=
                    predictions.length;

                this.publish(result);

                if (this.config.debug) {
                    console.log(
                        "[RainArrival MotionPredictionStatistics] Result:",
                        result
                    );
                }

                return cloneValue(result);

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
                        "MOTION_PREDICTION_STATISTICS_FAILED",
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
                this.executing = false;
            }
        }

        publish(result) {
            global.RainArrivalMotionPredictionStatistics =
                cloneValue(result);

            global.RainArrivalMotionPredictionStatisticsResult =
                cloneValue(
                    this.latestResult
                );

            global.RainGuardAI =
                global.RainGuardAI ||
                {};

            global.RainGuardAI.V32 =
                global.RainGuardAI.V32 ||
                {};

            global.RainGuardAI.V32
                .motionPredictionStatistics =
                cloneValue(result);

            global.dispatchEvent?.(
                new CustomEvent(
                    "rainarrival:motion-prediction-statistics-updated",
                    {
                        detail:
                            cloneValue(
                                result
                            )
                    }
                )
            );

            return result;
        }

        getLatestStatistics() {
            return cloneValue(
                this.latestStatistics
            );
        }

        getLatestResult() {
            return cloneValue(
                this.latestResult
            );
        }

        getSummary() {
            return cloneValue(
                this.latestStatistics
                    ?.summary ??
                null
            );
        }

        getCityStatistics(city = null) {
            const statistics =
                this.latestStatistics
                    ?.cityStatistics ??
                {};

            if (
                city === null ||
                city === undefined
            ) {
                return cloneValue(
                    statistics
                );
            }

            return cloneValue(
                statistics[
                    String(city)
                ] ??
                null
            );
        }

        getHorizonStatistics(
            horizonMinutes = null
        ) {
            const statistics =
                this.latestStatistics
                    ?.horizonStatistics ??
                {};

            if (
                horizonMinutes === null ||
                horizonMinutes === undefined
            ) {
                return cloneValue(
                    statistics
                );
            }

            return cloneValue(
                statistics[
                    String(
                        horizonMinutes
                    )
                ] ??
                null
            );
        }

        getTopPredictions(
            limit = 10
        ) {
            return cloneValue(
                (
                    this.latestStatistics
                        ?.topPredictions ??
                    []
                ).slice(
                    0,
                    Math.max(
                        0,
                        Number(limit) ||
                        0
                    )
                )
            );
        }

        getHistory(
            limit = 20
        ) {
            return cloneValue(
                this.history.slice(
                    0,
                    Math.max(
                        0,
                        Number(limit) ||
                        0
                    )
                )
            );
        }

        printSummary() {
            const summary =
                this.getSummary();

            if (!summary) {
                console.table([]);
                return null;
            }

            console.table([
                summary
            ]);

            return summary;
        }

        printCities() {
            const cities =
                Object.values(
                    this.getCityStatistics()
                );

            console.table(
                cities.map(
                    item => ({
                        city:
                            item.city,
                        total:
                            item.totalCount,
                        accepted:
                            item.acceptedCount,
                        rejected:
                            item.rejectedCount,
                        acceptanceRate:
                            item.acceptanceRate,
                        averageConfidence:
                            item.confidence
                                ?.mean,
                        averageSpeedKmh:
                            item.speedKmh
                                ?.mean,
                        topTrackId:
                            item.topTrackId
                    })
                )
            );

            return cities;
        }

        printHorizons() {
            const horizons =
                Object.values(
                    this.getHorizonStatistics()
                );

            console.table(
                horizons.map(
                    item => ({
                        horizonMinutes:
                            item.horizonMinutes,
                        total:
                            item.totalCount,
                        accepted:
                            item.acceptedCount,
                        rejected:
                            item.rejectedCount,
                        acceptanceRate:
                            item.acceptanceRate,
                        averageConfidence:
                            item.confidence
                                ?.mean,
                        averageSpeedKmh:
                            item.predictedSpeedKmh
                                ?.mean,
                        averageDistanceKm:
                            item.distanceKm
                                ?.mean
                    })
                )
            );

            return horizons;
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

                executing:
                    this.executing,

                hasStatistics:
                    Boolean(
                        this.latestStatistics
                    ),

                latestResult:
                    this.getLatestResult(),

                summary:
                    this.getSummary(),

                historyCount:
                    this.history.length,

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
                "[RainArrival MotionPredictionStatistics]",
                diagnostics
            );

            return diagnostics;
        }

        clear() {
            this.latestStatistics = null;
            this.latestResult = null;
            this.lastError = null;
            this.history = [];

            global.RainArrivalMotionPredictionStatistics =
                null;

            global.RainArrivalMotionPredictionStatisticsResult =
                null;

            return {
                success: true,
                status:
                    "MOTION_PREDICTION_STATISTICS_CLEARED"
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
            this.buildStatistics();

            this.timer =
                global.setInterval(
                    () =>
                        this.buildStatistics(),
                    this.config
                        .updateIntervalMs
                );

            return {
                success: true,
                running: true,
                intervalMs:
                    this.config
                        .updateIntervalMs
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

    const statistics =
        new MotionPredictionStatistics();

    global.RainArrivalMotionPredictionStatisticsV32 =
        statistics;

    global.RainArrivalMotionPredictionStatisticsEngineV32 =
        statistics;

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
        .motionPredictionStatistics =
        statistics;

    global.RainArrivalEngineV32
        ?.register?.(
            MODULE_NAME,
            statistics
        );

    global.RainArrivalOrchestratorV32
        ?.register?.(
            MODULE_NAME,
            statistics
        );

    global.runRainArrivalMotionPredictionStatistics =
        () =>
            statistics
                .buildStatistics();

    if (
        statistics.config.autoStart
    ) {
        statistics.start();
    }

    console.log(
        "[RainGuard AI V32] Motion Prediction Statistics loaded.",
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
