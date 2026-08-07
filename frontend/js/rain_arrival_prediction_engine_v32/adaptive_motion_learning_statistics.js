/*
===========================================================
 RainGuard AI V32
 Phase 38M-19B — Adaptive Motion Learning Statistics
 File: adaptive_motion_learning_statistics.js
 Version: 32.38M.19B

 Purpose:
 - Analyze adaptive learning samples and profiles.
 - Measure prediction error, correction strength and learning quality.
 - Produce city/confidence-band summaries.
 - Expose diagnostics for the next adaptive-learning stages.
===========================================================
*/

(function (global) {
    "use strict";

    const MODULE_NAME = "adaptiveMotionLearningStatistics";
    const VERSION = "32.38M.19B";
    const BUILD_ID =
        "rainguard-v32-phase38m19b-adaptive-motion-learning-statistics";

    const DEFAULT_CONFIG = Object.freeze({
        autoStart: true,
        analysisIntervalMs: 20000,
        minimumSamplesForReliableProfile: 3,
        excellentPositionErrorKm: 5,
        goodPositionErrorKm: 15,
        maximumPositionErrorKm: 250,
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

    function median(values) {
        const numbers = values
            .map(Number)
            .filter(Number.isFinite)
            .sort((a, b) => a - b);

        if (numbers.length === 0) return null;

        const middle = Math.floor(numbers.length / 2);

        return numbers.length % 2
            ? numbers[middle]
            : (numbers[middle - 1] + numbers[middle]) / 2;
    }

    function standardDeviation(values) {
        const numbers = values
            .map(Number)
            .filter(Number.isFinite);

        if (numbers.length === 0) return null;

        const average = mean(numbers);

        const variance =
            numbers.reduce(
                (sum, value) =>
                    sum + Math.pow(value - average, 2),
                0
            ) / numbers.length;

        return Math.sqrt(variance);
    }

    function percentile(values, percentileValue) {
        const numbers = values
            .map(Number)
            .filter(Number.isFinite)
            .sort((a, b) => a - b);

        if (numbers.length === 0) return null;

        const index =
            (numbers.length - 1) *
            percentileValue;

        const lower =
            Math.floor(index);

        const upper =
            Math.ceil(index);

        if (lower === upper) {
            return numbers[lower];
        }

        return (
            numbers[lower] +
            (numbers[upper] - numbers[lower]) *
            (index - lower)
        );
    }

    function round(value, decimals = 4) {
        if (!Number.isFinite(value)) return null;

        const factor = Math.pow(10, decimals);
        return Math.round(value * factor) / factor;
    }

    class AdaptiveMotionLearningStatistics {
        constructor(config = {}) {
            this.version = VERSION;
            this.buildId = BUILD_ID;

            this.config = {
                ...DEFAULT_CONFIG,
                ...(config || {})
            };

            this.running = false;
            this.analyzing = false;
            this.timer = null;

            this.latestResult = null;
            this.history = [];
            this.lastError = null;

            this.statistics = {
                analysisRuns: 0,
                successfulRuns: 0,
                failedRuns: 0,
                busySkips: 0
            };
        }

        resolveRepository() {
            return (
                global.RainArrivalAdaptiveMotionLearningRepositoryV32 ??
                null
            );
        }

        resolveSamples() {
            const repository =
                this.resolveRepository();

            const sources = [
                repository?.getAllSamples?.(),
                global.RainArrivalAdaptiveMotionLearningRepositorySamples,
                global.RainArrivalAdaptiveMotionSamples
            ];

            for (const source of sources) {
                const values =
                    collectionToArray(source);

                if (values.length > 0) {
                    return values;
                }
            }

            return [];
        }

        resolveProfiles() {
            const repository =
                this.resolveRepository();

            const sources = [
                repository?.getAllProfiles?.(),
                global.RainArrivalAdaptiveMotionLearningRepositoryProfiles,
                global.RainArrivalAdaptiveMotionProfiles
            ];

            for (const source of sources) {
                const values =
                    collectionToArray(source);

                if (values.length > 0) {
                    return values;
                }
            }

            return [];
        }

        normalizeSample(sample) {
            if (!sample || typeof sample !== "object") {
                return null;
            }

            return {
                ...cloneValue(sample),

                city:
                    String(
                        sample.city ??
                        "GLOBAL"
                    ),

                confidenceBand:
                    String(
                        sample.confidenceBand ??
                        "UNKNOWN"
                    ),

                confidence:
                    toFiniteNumber(
                        sample.confidence,
                        null
                    ),

                positionErrorKm:
                    toFiniteNumber(
                        sample.positionErrorKm,
                        null
                    ),

                speedErrorKmh:
                    toFiniteNumber(
                        sample.speedErrorKmh,
                        null
                    ),

                bearingErrorDegrees:
                    toFiniteNumber(
                        sample.bearingErrorDegrees,
                        null
                    ),

                speedRatio:
                    toFiniteNumber(
                        sample.speedRatio,
                        null
                    )
            };
        }

        summarizeNumbers(values) {
            const numbers = values
                .map(Number)
                .filter(Number.isFinite);

            return {
                count:
                    numbers.length,

                mean:
                    round(
                        mean(numbers),
                        4
                    ),

                median:
                    round(
                        median(numbers),
                        4
                    ),

                standardDeviation:
                    round(
                        standardDeviation(numbers),
                        4
                    ),

                minimum:
                    numbers.length
                        ? round(
                            Math.min(...numbers),
                            4
                        )
                        : null,

                maximum:
                    numbers.length
                        ? round(
                            Math.max(...numbers),
                            4
                        )
                        : null,

                p25:
                    round(
                        percentile(
                            numbers,
                            0.25
                        ),
                        4
                    ),

                p75:
                    round(
                        percentile(
                            numbers,
                            0.75
                        ),
                        4
                    ),

                p90:
                    round(
                        percentile(
                            numbers,
                            0.90
                        ),
                        4
                    )
            };
        }

        classifyQuality(
            positionErrorKm,
            sampleCount
        ) {
            if (
                !Number.isFinite(
                    positionErrorKm
                )
            ) {
                return "NO_DATA";
            }

            if (
                sampleCount <
                this.config
                    .minimumSamplesForReliableProfile
            ) {
                return "INSUFFICIENT_DATA";
            }

            if (
                positionErrorKm <=
                this.config
                    .excellentPositionErrorKm
            ) {
                return "EXCELLENT";
            }

            if (
                positionErrorKm <=
                this.config
                    .goodPositionErrorKm
            ) {
                return "GOOD";
            }

            if (
                positionErrorKm <=
                this.config
                    .maximumPositionErrorKm
            ) {
                return "NEEDS_ADAPTATION";
            }

            return "UNSTABLE";
        }

        buildGroups(samples, keySelector) {
            const groups =
                new Map();

            for (const sample of samples) {
                const key =
                    String(
                        keySelector(sample) ??
                        "UNKNOWN"
                    );

                if (!groups.has(key)) {
                    groups.set(
                        key,
                        []
                    );
                }

                groups
                    .get(key)
                    .push(sample);
            }

            return groups;
        }

        summarizeGroup(
            key,
            samples
        ) {
            const positionErrors =
                samples
                    .map(
                        sample =>
                            sample.positionErrorKm
                    )
                    .filter(
                        Number.isFinite
                    );

            const absoluteSpeedErrors =
                samples
                    .map(
                        sample =>
                            Number.isFinite(
                                sample.speedErrorKmh
                            )
                                ? Math.abs(
                                    sample.speedErrorKmh
                                )
                                : null
                    )
                    .filter(
                        Number.isFinite
                    );

            const absoluteBearingErrors =
                samples
                    .map(
                        sample =>
                            Number.isFinite(
                                sample.bearingErrorDegrees
                            )
                                ? Math.abs(
                                    sample.bearingErrorDegrees
                                )
                                : null
                    )
                    .filter(
                        Number.isFinite
                    );

            const confidences =
                samples
                    .map(
                        sample =>
                            sample.confidence
                    )
                    .filter(
                        Number.isFinite
                    );

            const averagePositionErrorKm =
                mean(positionErrors);

            return {
                key,

                sampleCount:
                    samples.length,

                quality:
                    this.classifyQuality(
                        averagePositionErrorKm,
                        samples.length
                    ),

                averageConfidence:
                    round(
                        mean(confidences),
                        2
                    ),

                positionError:
                    this.summarizeNumbers(
                        positionErrors
                    ),

                absoluteSpeedError:
                    this.summarizeNumbers(
                        absoluteSpeedErrors
                    ),

                absoluteBearingError:
                    this.summarizeNumbers(
                        absoluteBearingErrors
                    )
            };
        }

        summarizeProfiles(profiles) {
            const normalized =
                profiles
                    .filter(
                        profile =>
                            profile &&
                            typeof profile ===
                                "object"
                    );

            return {
                profileCount:
                    normalized.length,

                reliableProfileCount:
                    normalized.filter(
                        profile =>
                            Number(
                                profile.sampleCount ??
                                0
                            ) >=
                            this.config
                                .minimumSamplesForReliableProfile
                    ).length,

                averageSpeedMultiplier:
                    round(
                        mean(
                            normalized.map(
                                profile =>
                                    toFiniteNumber(
                                        profile.speedMultiplier,
                                        null
                                    )
                            )
                        ),
                        6
                    ),

                averageBearingOffsetDegrees:
                    round(
                        mean(
                            normalized.map(
                                profile =>
                                    toFiniteNumber(
                                        profile.bearingOffsetDegrees,
                                        null
                                    )
                            )
                        ),
                        6
                    ),

                averageEtaMultiplier:
                    round(
                        mean(
                            normalized.map(
                                profile =>
                                    toFiniteNumber(
                                        profile.etaMultiplier,
                                        null
                                    )
                            )
                        ),
                        6
                    ),

                averageProfilePositionErrorKm:
                    round(
                        mean(
                            normalized.map(
                                profile =>
                                    toFiniteNumber(
                                        profile.meanPositionErrorKm,
                                        null
                                    )
                            )
                        ),
                        4
                    )
            };
        }

        analyze() {
            if (this.analyzing) {
                this.statistics.busySkips += 1;

                return {
                    success: false,
                    status:
                        "ADAPTIVE_MOTION_LEARNING_STATISTICS_BUSY",
                    version:
                        this.version,
                    build:
                        this.buildId,
                    generatedAt:
                        now()
                };
            }

            const startedAt =
                now();

            this.analyzing =
                true;

            this.statistics.analysisRuns +=
                1;

            try {
                const repository =
                    this.resolveRepository();

                if (
                    repository &&
                    repository.getCount?.() === 0
                ) {
                    repository
                        .syncFromLearningEngine?.();
                }

                const samples =
                    this.resolveSamples()
                        .map(
                            sample =>
                                this.normalizeSample(
                                    sample
                                )
                        )
                        .filter(Boolean);

                const profiles =
                    this.resolveProfiles();

                const cityGroups =
                    this.buildGroups(
                        samples,
                        sample =>
                            sample.city
                    );

                const confidenceGroups =
                    this.buildGroups(
                        samples,
                        sample =>
                            sample.confidenceBand
                    );

                const citySummaries =
                    Array.from(
                        cityGroups.entries()
                    )
                    .map(
                        ([key, group]) =>
                            this.summarizeGroup(
                                key,
                                group
                            )
                    )
                    .sort(
                        (a, b) =>
                            b.sampleCount -
                            a.sampleCount
                    );

                const confidenceBandSummaries =
                    Array.from(
                        confidenceGroups.entries()
                    )
                    .map(
                        ([key, group]) =>
                            this.summarizeGroup(
                                key,
                                group
                            )
                    )
                    .sort(
                        (a, b) =>
                            b.sampleCount -
                            a.sampleCount
                    );

                const positionErrors =
                    samples
                        .map(
                            sample =>
                                sample.positionErrorKm
                        )
                        .filter(
                            Number.isFinite
                        );

                const absoluteSpeedErrors =
                    samples
                        .map(
                            sample =>
                                Number.isFinite(
                                    sample.speedErrorKmh
                                )
                                    ? Math.abs(
                                        sample.speedErrorKmh
                                    )
                                    : null
                        )
                        .filter(
                            Number.isFinite
                        );

                const absoluteBearingErrors =
                    samples
                        .map(
                            sample =>
                                Number.isFinite(
                                    sample.bearingErrorDegrees
                                )
                                    ? Math.abs(
                                        sample.bearingErrorDegrees
                                    )
                                    : null
                        )
                        .filter(
                            Number.isFinite
                        );

                const speedRatios =
                    samples
                        .map(
                            sample =>
                                sample.speedRatio
                        )
                        .filter(
                            Number.isFinite
                        );

                const globalPosition =
                    this.summarizeNumbers(
                        positionErrors
                    );

                const result = {
                    success:
                        true,

                    status:
                        "ADAPTIVE_MOTION_LEARNING_STATISTICS_COMPLETED",

                    version:
                        this.version,

                    build:
                        this.buildId,

                    sampleCount:
                        samples.length,

                    cityCount:
                        cityGroups.size,

                    confidenceBandCount:
                        confidenceGroups.size,

                    globalQuality:
                        this.classifyQuality(
                            globalPosition.mean,
                            samples.length
                        ),

                    globalStatistics: {
                        positionErrorKm:
                            globalPosition,

                        absoluteSpeedErrorKmh:
                            this.summarizeNumbers(
                                absoluteSpeedErrors
                            ),

                        absoluteBearingErrorDegrees:
                            this.summarizeNumbers(
                                absoluteBearingErrors
                            ),

                        speedRatio:
                            this.summarizeNumbers(
                                speedRatios
                            )
                    },

                    profileStatistics:
                        this.summarizeProfiles(
                            profiles
                        ),

                    citySummaries,

                    confidenceBandSummaries,

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

                this.history.unshift(
                    cloneValue(
                        result
                    )
                );

                if (
                    this.history.length >
                    50
                ) {
                    this.history.length =
                        50;
                }

                this.statistics.successfulRuns +=
                    1;

                this.publish(
                    result
                );

                if (
                    this.config.debug
                ) {
                    console.log(
                        "[RainArrival AdaptiveMotionLearningStatistics] Analysis result:",
                        result
                    );
                }

                return result;

            } catch (error) {
                this.statistics.failedRuns +=
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
                        "ADAPTIVE_MOTION_LEARNING_STATISTICS_FAILED",

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

            } finally {
                this.analyzing =
                    false;
            }
        }

        publish(result) {
            global.RainArrivalAdaptiveMotionLearningStatisticsResult =
                cloneValue(
                    result
                );

            global.RainGuardAI =
                global.RainGuardAI ||
                {};

            global.RainGuardAI.V32 =
                global.RainGuardAI.V32 ||
                {};

            global.RainGuardAI.V32
                .adaptiveMotionLearningStatistics =
                cloneValue(
                    result
                );

            global.dispatchEvent?.(
                new CustomEvent(
                    "rainarrival:adaptive-motion-learning-statistics-updated",
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

        getLatestResult() {
            return cloneValue(
                this.latestResult
            );
        }

        getSummary() {
            const result =
                this.latestResult;

            if (!result) {
                return null;
            }

            return cloneValue({
                status:
                    result.status,

                sampleCount:
                    result.sampleCount,

                cityCount:
                    result.cityCount,

                confidenceBandCount:
                    result.confidenceBandCount,

                globalQuality:
                    result.globalQuality,

                meanPositionErrorKm:
                    result
                        .globalStatistics
                        ?.positionErrorKm
                        ?.mean ??
                    null,

                meanAbsoluteSpeedErrorKmh:
                    result
                        .globalStatistics
                        ?.absoluteSpeedErrorKmh
                        ?.mean ??
                    null,

                meanAbsoluteBearingErrorDegrees:
                    result
                        .globalStatistics
                        ?.absoluteBearingErrorDegrees
                        ?.mean ??
                    null,

                profileCount:
                    result
                        .profileStatistics
                        ?.profileCount ??
                    0,

                reliableProfileCount:
                    result
                        .profileStatistics
                        ?.reliableProfileCount ??
                    0
            });
        }

        getCitySummary(city) {
            const cityKey =
                String(
                    city
                ).toLowerCase();

            return cloneValue(
                this.latestResult
                    ?.citySummaries
                    ?.find(
                        summary =>
                            String(
                                summary.key
                            ).toLowerCase() ===
                            cityKey
                    ) ??
                null
            );
        }

        getConfidenceBandSummary(
            confidenceBand
        ) {
            const key =
                String(
                    confidenceBand
                ).toUpperCase();

            return cloneValue(
                this.latestResult
                    ?.confidenceBandSummaries
                    ?.find(
                        summary =>
                            String(
                                summary.key
                            ).toUpperCase() ===
                            key
                    ) ??
                null
            );
        }

        getHistory(limit = 20) {
            return cloneValue(
                this.history.slice(
                    0,
                    Math.max(
                        0,
                        Number(limit) || 0
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

            console.table(
                [summary]
            );

            return summary;
        }

        printCities() {
            const rows =
                this.latestResult
                    ?.citySummaries ??
                [];

            console.table(
                rows.map(
                    summary => ({
                        city:
                            summary.key,

                        sampleCount:
                            summary.sampleCount,

                        quality:
                            summary.quality,

                        averageConfidence:
                            summary.averageConfidence,

                        meanPositionErrorKm:
                            summary
                                .positionError
                                ?.mean,

                        p90PositionErrorKm:
                            summary
                                .positionError
                                ?.p90,

                        meanAbsoluteSpeedErrorKmh:
                            summary
                                .absoluteSpeedError
                                ?.mean,

                        meanAbsoluteBearingErrorDegrees:
                            summary
                                .absoluteBearingError
                                ?.mean
                    })
                )
            );

            return cloneValue(
                rows
            );
        }

        printConfidenceBands() {
            const rows =
                this.latestResult
                    ?.confidenceBandSummaries ??
                [];

            console.table(
                rows.map(
                    summary => ({
                        confidenceBand:
                            summary.key,

                        sampleCount:
                            summary.sampleCount,

                        quality:
                            summary.quality,

                        averageConfidence:
                            summary.averageConfidence,

                        meanPositionErrorKm:
                            summary
                                .positionError
                                ?.mean,

                        meanAbsoluteSpeedErrorKmh:
                            summary
                                .absoluteSpeedError
                                ?.mean,

                        meanAbsoluteBearingErrorDegrees:
                            summary
                                .absoluteBearingError
                                ?.mean
                    })
                )
            );

            return cloneValue(
                rows
            );
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

                analyzing:
                    this.analyzing,

                latestResult:
                    this.getLatestResult(),

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
                "[RainArrival AdaptiveMotionLearningStatistics]",
                diagnostics
            );

            return diagnostics;
        }

        start() {
            if (this.running) {
                return {
                    success:
                        true,

                    alreadyRunning:
                        true
                };
            }

            this.running =
                true;

            this.analyze();

            this.timer =
                global.setInterval(
                    () =>
                        this.analyze(),

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
            if (this.timer) {
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
    }

    const statistics =
        new AdaptiveMotionLearningStatistics();

    global.RainArrivalAdaptiveMotionLearningStatisticsV32 =
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
        .adaptiveMotionLearningStatistics =
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

    global.runRainArrivalAdaptiveMotionLearningStatistics =
        () =>
            statistics.analyze();

    if (
        statistics.config.autoStart
    ) {
        statistics.start();
    }

    console.log(
        "[RainGuard AI V32] Adaptive Motion Learning Statistics loaded.",
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
