/*
===========================================================
 RainGuard AI V32
 Phase 38M-19C — Adaptive Motion Confidence Statistics
 File: adaptive_motion_confidence_statistics.js
 Version: 32.38M.19C

 Purpose:
 - Analyze confidence records stored in the Phase 38M-19C repository.
 - Produce national, city, grade, quality and component statistics.
 - Detect confidence concentration, weak evidence and unstable cities.
 - Feed Renderer / Orchestrator / Final Arrival Decision layers.
===========================================================
*/

(function (global) {
    "use strict";

    const MODULE_NAME =
        "adaptiveMotionConfidenceStatistics";

    const VERSION =
        "32.38M.19C";

    const BUILD_ID =
        "rainguard-v32-phase38m19c-adaptive-motion-confidence-statistics";

    const DEFAULT_CONFIG =
        Object.freeze({
            autoStart: true,
            analysisIntervalMs: 24000,
            minimumStrongConfidence: 75,
            minimumVeryStrongConfidence: 90,
            minimumEvidenceCoverage: 60,
            cityMinimumSamples: 3,
            maximumCitySummaries: 100,
            debug: true
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
                return structuredClone(
                    value
                );
            } catch (_) {}
        }

        try {
            return JSON.parse(
                JSON.stringify(
                    value
                )
            );
        } catch (_) {
            return value;
        }
    }

    function toArray(value) {
        if (!value) {
            return [];
        }

        if (
            Array.isArray(value)
        ) {
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

        return (
            typeof value ===
            "object"
                ? Object.values(
                    value
                )
                : []
        );
    }

    function toNumber(
        value,
        fallback = null
    ) {
        const number =
            Number(value);

        return Number.isFinite(
            number
        )
            ? number
            : fallback;
    }

    function round(
        value,
        digits = 2
    ) {
        if (
            !Number.isFinite(
                value
            )
        ) {
            return null;
        }

        const factor =
            Math.pow(
                10,
                digits
            );

        return (
            Math.round(
                value *
                factor
            ) /
            factor
        );
    }

    function mean(values) {
        const numbers =
            values
                .map(Number)
                .filter(
                    Number.isFinite
                );

        if (
            !numbers.length
        ) {
            return null;
        }

        return (
            numbers.reduce(
                (
                    total,
                    value
                ) =>
                    total +
                    value,
                0
            ) /
            numbers.length
        );
    }

    function median(values) {
        const numbers =
            values
                .map(Number)
                .filter(
                    Number.isFinite
                )
                .sort(
                    (a, b) =>
                        a - b
                );

        if (
            !numbers.length
        ) {
            return null;
        }

        const middle =
            Math.floor(
                numbers.length /
                2
            );

        if (
            numbers.length %
                2 ===
            0
        ) {
            return (
                numbers[
                    middle - 1
                ] +
                numbers[
                    middle
                ]
            ) / 2;
        }

        return numbers[
            middle
        ];
    }

    function standardDeviation(
        values
    ) {
        const numbers =
            values
                .map(Number)
                .filter(
                    Number.isFinite
                );

        if (
            numbers.length <
            2
        ) {
            return 0;
        }

        const average =
            mean(
                numbers
            );

        const variance =
            numbers.reduce(
                (
                    total,
                    value
                ) =>
                    total +
                    Math.pow(
                        value -
                        average,
                        2
                    ),
                0
            ) /
            numbers.length;

        return Math.sqrt(
            variance
        );
    }

    function percentile(
        values,
        requestedPercentile
    ) {
        const numbers =
            values
                .map(Number)
                .filter(
                    Number.isFinite
                )
                .sort(
                    (a, b) =>
                        a - b
                );

        if (
            !numbers.length
        ) {
            return null;
        }

        if (
            numbers.length ===
            1
        ) {
            return numbers[0];
        }

        const p =
            Math.max(
                0,
                Math.min(
                    100,
                    Number(
                        requestedPercentile
                    ) ||
                    0
                )
            );

        const position =
            (
                p /
                100
            ) *
            (
                numbers.length -
                1
            );

        const lower =
            Math.floor(
                position
            );

        const upper =
            Math.ceil(
                position
            );

        if (
            lower ===
            upper
        ) {
            return numbers[
                lower
            ];
        }

        const weight =
            position -
            lower;

        return (
            numbers[
                lower
            ] *
            (
                1 -
                weight
            ) +
            numbers[
                upper
            ] *
            weight
        );
    }

    function buildNumericSummary(
        values
    ) {
        const numbers =
            values
                .map(Number)
                .filter(
                    Number.isFinite
                );

        if (
            !numbers.length
        ) {
            return {
                count: 0,
                mean: null,
                median: null,
                min: null,
                max: null,
                standardDeviation: null,
                p10: null,
                p25: null,
                p75: null,
                p90: null
            };
        }

        return {
            count:
                numbers.length,

            mean:
                round(
                    mean(
                        numbers
                    ),
                    2
                ),

            median:
                round(
                    median(
                        numbers
                    ),
                    2
                ),

            min:
                round(
                    Math.min(
                        ...numbers
                    ),
                    2
                ),

            max:
                round(
                    Math.max(
                        ...numbers
                    ),
                    2
                ),

            standardDeviation:
                round(
                    standardDeviation(
                        numbers
                    ),
                    2
                ),

            p10:
                round(
                    percentile(
                        numbers,
                        10
                    ),
                    2
                ),

            p25:
                round(
                    percentile(
                        numbers,
                        25
                    ),
                    2
                ),

            p75:
                round(
                    percentile(
                        numbers,
                        75
                    ),
                    2
                ),

            p90:
                round(
                    percentile(
                        numbers,
                        90
                    ),
                    2
                )
        };
    }

    function countBy(
        records,
        resolver
    ) {
        const output =
            {};

        for (
            const record of records
        ) {
            const key =
                String(
                    resolver(
                        record
                    ) ??
                    "UNKNOWN"
                );

            output[key] =
                (
                    output[key] ||
                    0
                ) +
                1;
        }

        return output;
    }

    class AdaptiveMotionConfidenceStatistics {

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

            this.analyzing =
                false;

            this.timer =
                null;

            this.latestResult =
                null;

            this.lastError =
                null;

            this.statistics = {
                analysisRuns: 0,
                successfulRuns: 0,
                failedRuns: 0,
                busySkips: 0,
                analyzedRecords: 0
            };
        }

        resolveRepository() {
            return (
                global
                    .RainArrivalAdaptiveMotionConfidenceRepositoryV32 ??
                null
            );
        }

        resolveRecords() {
            const repository =
                this
                    .resolveRepository();

            if (!repository) {
                return [];
            }

            return toArray(
                repository
                    .getAll?.()
            );
        }

        classifyNationalQuality(
            averageConfidence,
            strongRatio,
            averageEvidenceCoverage
        ) {
            if (
                !Number.isFinite(
                    averageConfidence
                )
            ) {
                return "NO_DATA";
            }

            if (
                averageConfidence >=
                    90 &&
                strongRatio >=
                    80 &&
                averageEvidenceCoverage >=
                    75
            ) {
                return "EXCELLENT";
            }

            if (
                averageConfidence >=
                    75 &&
                strongRatio >=
                    60 &&
                averageEvidenceCoverage >=
                    60
            ) {
                return "GOOD";
            }

            if (
                averageConfidence >=
                    60
            ) {
                return "MODERATE";
            }

            if (
                averageConfidence >=
                    45
            ) {
                return "WEAK";
            }

            return "UNRELIABLE";
        }

        summarizeComponents(
            records
        ) {
            const componentNames = [
                "predictionConfidence",
                "adaptiveLearningQuality",
                "historicalTrackQuality",
                "vectorStability",
                "sourceAgreement",
                "identityStability",
                "approachEvidence"
            ];

            const output =
                {};

            for (
                const componentName of
                componentNames
            ) {
                const values =
                    records
                        .map(
                            record =>
                                toNumber(
                                    record
                                        ?.components
                                        ?.[
                                            componentName
                                        ],
                                    null
                                )
                        )
                        .filter(
                            Number.isFinite
                        );

                output[
                    componentName
                ] =
                    buildNumericSummary(
                        values
                    );
            }

            return output;
        }

        summarizeCities(
            records
        ) {
            const grouped =
                new Map();

            for (
                const record of records
            ) {
                const city =
                    String(
                        record.city ??
                        "GLOBAL"
                    );

                const key =
                    city.toLowerCase();

                if (
                    !grouped.has(
                        key
                    )
                ) {
                    grouped.set(
                        key,
                        {
                            city,
                            records: []
                        }
                    );
                }

                grouped.get(
                    key
                ).records.push(
                    record
                );
            }

            return Array.from(
                grouped.values()
            )
            .map(
                group => {
                    const values =
                        group.records
                            .map(
                                record =>
                                    toNumber(
                                        record.confidence,
                                        null
                                    )
                            )
                            .filter(
                                Number.isFinite
                            );

                    const evidence =
                        group.records
                            .map(
                                record =>
                                    toNumber(
                                        record.evidenceCoverage,
                                        null
                                    )
                            )
                            .filter(
                                Number.isFinite
                            );

                    const acceptedCount =
                        group.records
                            .filter(
                                record =>
                                    record.accepted ===
                                    true
                            )
                            .length;

                    const strongCount =
                        group.records
                            .filter(
                                record =>
                                    Number(
                                        record.confidence ??
                                        0
                                    ) >=
                                    this.config
                                        .minimumStrongConfidence
                            )
                            .length;

                    const averageConfidence =
                        mean(
                            values
                        );

                    const averageEvidenceCoverage =
                        mean(
                            evidence
                        );

                    const acceptedRatio =
                        group.records.length
                            ? (
                                acceptedCount /
                                group.records.length
                            ) *
                            100
                            : 0;

                    const strongRatio =
                        group.records.length
                            ? (
                                strongCount /
                                group.records.length
                            ) *
                            100
                            : 0;

                    let quality =
                        "INSUFFICIENT_DATA";

                    if (
                        group.records
                            .length >=
                        this.config
                            .cityMinimumSamples
                    ) {
                        quality =
                            this
                                .classifyNationalQuality(
                                    averageConfidence,
                                    strongRatio,
                                    averageEvidenceCoverage
                                );
                    }

                    return {
                        city:
                            group.city,

                        sampleCount:
                            group.records
                                .length,

                        acceptedCount,

                        rejectedCount:
                            group.records
                                .length -
                            acceptedCount,

                        acceptedRatio:
                            round(
                                acceptedRatio,
                                2
                            ),

                        strongCount,

                        strongRatio:
                            round(
                                strongRatio,
                                2
                            ),

                        confidence:
                            buildNumericSummary(
                                values
                            ),

                        evidenceCoverage:
                            buildNumericSummary(
                                evidence
                            ),

                        quality,

                        topConfidence:
                            cloneValue(
                                group.records
                                    .slice()
                                    .sort(
                                        (
                                            a,
                                            b
                                        ) =>
                                            Number(
                                                b.confidence ??
                                                0
                                            ) -
                                            Number(
                                                a.confidence ??
                                                0
                                            )
                                    )[0] ??
                                null
                            )
                    };
                }
            )
            .sort(
                (a, b) =>
                    Number(
                        b.confidence
                            ?.mean ??
                        0
                    ) -
                    Number(
                        a.confidence
                            ?.mean ??
                        0
                    )
            )
            .slice(
                0,
                this.config
                    .maximumCitySummaries
            );
        }

        analyze() {
            if (
                this.analyzing
            ) {
                this.statistics
                    .busySkips +=
                    1;

                return {
                    success:
                        false,

                    status:
                        "ADAPTIVE_MOTION_CONFIDENCE_STATISTICS_BUSY",

                    version:
                        this.version,

                    build:
                        this.buildId
                };
            }

            const startedAt =
                now();

            this.analyzing =
                true;

            this.statistics
                .analysisRuns +=
                1;

            try {
                const repository =
                    this
                        .resolveRepository();

                if (
                    !repository
                ) {
                    throw new Error(
                        "Adaptive Motion Confidence Repository is unavailable."
                    );
                }

                if (
                    repository.getCount?.() ===
                        0
                ) {
                    repository
                        .syncFromConfidenceEngine?.();
                }

                const records =
                    this
                        .resolveRecords();

                const confidenceValues =
                    records
                        .map(
                            record =>
                                toNumber(
                                    record.confidence,
                                    null
                                )
                        )
                        .filter(
                            Number.isFinite
                        );

                const evidenceCoverageValues =
                    records
                        .map(
                            record =>
                                toNumber(
                                    record.evidenceCoverage,
                                    null
                                )
                        )
                        .filter(
                            Number.isFinite
                        );

                const accepted =
                    records.filter(
                        record =>
                            record.accepted ===
                            true
                    );

                const rejected =
                    records.filter(
                        record =>
                            record.accepted !==
                            true
                    );

                const strong =
                    records.filter(
                        record =>
                            Number(
                                record.confidence ??
                                0
                            ) >=
                            this.config
                                .minimumStrongConfidence
                    );

                const veryStrong =
                    records.filter(
                        record =>
                            Number(
                                record.confidence ??
                                0
                            ) >=
                            this.config
                                .minimumVeryStrongConfidence
                    );

                const weakEvidence =
                    records.filter(
                        record =>
                            Number(
                                record.evidenceCoverage ??
                                0
                            ) <
                            this.config
                                .minimumEvidenceCoverage
                    );

                const acceptedRatio =
                    records.length
                        ? (
                            accepted.length /
                            records.length
                        ) *
                        100
                        : 0;

                const strongRatio =
                    records.length
                        ? (
                            strong.length /
                            records.length
                        ) *
                        100
                        : 0;

                const veryStrongRatio =
                    records.length
                        ? (
                            veryStrong.length /
                            records.length
                        ) *
                        100
                        : 0;

                const weakEvidenceRatio =
                    records.length
                        ? (
                            weakEvidence.length /
                            records.length
                        ) *
                        100
                        : 0;

                const confidenceSummary =
                    buildNumericSummary(
                        confidenceValues
                    );

                const evidenceCoverageSummary =
                    buildNumericSummary(
                        evidenceCoverageValues
                    );

                const citySummaries =
                    this
                        .summarizeCities(
                            records
                        );

                const componentStatistics =
                    this
                        .summarizeComponents(
                            records
                        );

                const nationalQuality =
                    this
                        .classifyNationalQuality(
                            confidenceSummary.mean,
                            strongRatio,
                            evidenceCoverageSummary.mean
                        );

                const result = {
                    success:
                        true,

                    status:
                        "ADAPTIVE_MOTION_CONFIDENCE_STATISTICS_COMPLETED",

                    version:
                        this.version,

                    build:
                        this.buildId,

                    recordCount:
                        records.length,

                    acceptedCount:
                        accepted.length,

                    rejectedCount:
                        rejected.length,

                    acceptedRatio:
                        round(
                            acceptedRatio,
                            2
                        ),

                    strongCount:
                        strong.length,

                    strongRatio:
                        round(
                            strongRatio,
                            2
                        ),

                    veryStrongCount:
                        veryStrong.length,

                    veryStrongRatio:
                        round(
                            veryStrongRatio,
                            2
                        ),

                    weakEvidenceCount:
                        weakEvidence.length,

                    weakEvidenceRatio:
                        round(
                            weakEvidenceRatio,
                            2
                        ),

                    nationalQuality,

                    confidence:
                        confidenceSummary,

                    evidenceCoverage:
                        evidenceCoverageSummary,

                    gradeDistribution:
                        countBy(
                            records,
                            record =>
                                record.grade
                        ),

                    qualityDistribution:
                        countBy(
                            records,
                            record =>
                                record.quality
                        ),

                    cityCount:
                        citySummaries.length,

                    citySummaries,

                    componentStatistics,

                    bestCity:
                        cloneValue(
                            citySummaries[0] ??
                            null
                        ),

                    weakestCity:
                        cloneValue(
                            citySummaries.length
                                ? citySummaries[
                                    citySummaries.length -
                                    1
                                ]
                                : null
                        ),

                    topConfidence:
                        cloneValue(
                            repository
                                .getTopConfidence?.() ??
                            null
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

                this.statistics
                    .successfulRuns +=
                    1;

                this.statistics
                    .analyzedRecords +=
                    records.length;

                this.publish(
                    result
                );

                if (
                    this.config.debug
                ) {
                    console.log(
                        "[RainArrival AdaptiveMotionConfidenceStatistics] Analysis result:",
                        result
                    );
                }

                return result;

            } catch (error) {
                this.statistics
                    .failedRuns +=
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
                        "ADAPTIVE_MOTION_CONFIDENCE_STATISTICS_FAILED",

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
            global
                .RainArrivalAdaptiveMotionConfidenceStatisticsResult =
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
                .adaptiveMotionConfidenceStatistics =
                cloneValue(
                    result
                );

            global.dispatchEvent?.(
                new CustomEvent(
                    "rainarrival:adaptive-motion-confidence-statistics-completed",
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

                recordCount:
                    result.recordCount,

                acceptedCount:
                    result.acceptedCount,

                acceptedRatio:
                    result.acceptedRatio,

                strongCount:
                    result.strongCount,

                strongRatio:
                    result.strongRatio,

                veryStrongCount:
                    result.veryStrongCount,

                veryStrongRatio:
                    result.veryStrongRatio,

                weakEvidenceCount:
                    result.weakEvidenceCount,

                weakEvidenceRatio:
                    result.weakEvidenceRatio,

                nationalQuality:
                    result.nationalQuality,

                confidence:
                    result.confidence,

                evidenceCoverage:
                    result.evidenceCoverage,

                cityCount:
                    result.cityCount,

                bestCity:
                    result.bestCity,

                weakestCity:
                    result.weakestCity,

                topConfidence:
                    result.topConfidence
            });
        }

        getCitySummary(
            city
        ) {
            const key =
                String(
                    city ??
                    ""
                )
                .toLowerCase();

            return cloneValue(
                this.latestResult
                    ?.citySummaries
                    ?.find(
                        item =>
                            String(
                                item.city
                            )
                            .toLowerCase() ===
                            key
                    ) ??
                null
            );
        }

        getGradeDistribution() {
            return cloneValue(
                this.latestResult
                    ?.gradeDistribution ??
                {}
            );
        }

        getQualityDistribution() {
            return cloneValue(
                this.latestResult
                    ?.qualityDistribution ??
                {}
            );
        }

        getComponentStatistics() {
            return cloneValue(
                this.latestResult
                    ?.componentStatistics ??
                {}
            );
        }

        printSummary() {
            const summary =
                this.getSummary();

            if (!summary) {
                console.table(
                    []
                );

                return null;
            }

            console.table([
                {
                    recordCount:
                        summary.recordCount,

                    acceptedCount:
                        summary.acceptedCount,

                    acceptedRatio:
                        summary.acceptedRatio,

                    strongCount:
                        summary.strongCount,

                    strongRatio:
                        summary.strongRatio,

                    veryStrongCount:
                        summary.veryStrongCount,

                    averageConfidence:
                        summary.confidence
                            ?.mean,

                    medianConfidence:
                        summary.confidence
                            ?.median,

                    confidenceStdDev:
                        summary.confidence
                            ?.standardDeviation,

                    averageEvidenceCoverage:
                        summary.evidenceCoverage
                            ?.mean,

                    nationalQuality:
                        summary.nationalQuality,

                    cityCount:
                        summary.cityCount
                }
            ]);

            return summary;
        }

        printCities(
            limit = 20
        ) {
            const rows =
                (
                    this.latestResult
                        ?.citySummaries ??
                    []
                )
                .slice(
                    0,
                    Math.max(
                        0,
                        Number(
                            limit
                        ) ||
                        0
                    )
                );

            console.table(
                rows.map(
                    item => ({
                        city:
                            item.city,

                        sampleCount:
                            item.sampleCount,

                        acceptedRatio:
                            item.acceptedRatio,

                        strongRatio:
                            item.strongRatio,

                        averageConfidence:
                            item.confidence
                                ?.mean,

                        medianConfidence:
                            item.confidence
                                ?.median,

                        averageEvidenceCoverage:
                            item.evidenceCoverage
                                ?.mean,

                        quality:
                            item.quality
                    })
                )
            );

            return cloneValue(
                rows
            );
        }

        printComponents() {
            const components =
                this
                    .getComponentStatistics();

            const rows =
                Object.entries(
                    components
                )
                .map(
                    (
                        [
                            name,
                            stats
                        ]
                    ) => ({
                        component:
                            name,

                        count:
                            stats.count,

                        mean:
                            stats.mean,

                        median:
                            stats.median,

                        minimum:
                            stats.min,

                        maximum:
                            stats.max,

                        standardDeviation:
                            stats
                                .standardDeviation
                    })
                );

            console.table(
                rows
            );

            return rows;
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

                repositoryAvailable:
                    Boolean(
                        this
                            .resolveRepository()
                    ),

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
                "[RainArrival AdaptiveMotionConfidenceStatistics]",
                diagnostics
            );

            return diagnostics;
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

            this.analyze();

            this.timer =
                global.setInterval(
                    () =>
                        this
                            .analyze(),

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
    }

    const statistics =
        new AdaptiveMotionConfidenceStatistics();

    global
        .RainArrivalAdaptiveMotionConfidenceStatisticsV32 =
        statistics;

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
        .adaptiveMotionConfidenceStatistics =
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

    global
        .analyzeRainArrivalAdaptiveMotionConfidence =
        () =>
            statistics
                .analyze();

    if (
        statistics.config
            .autoStart
    ) {
        statistics.start();
    }

    console.log(
        "[RainGuard AI V32] Adaptive Motion Confidence Statistics loaded.",
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
