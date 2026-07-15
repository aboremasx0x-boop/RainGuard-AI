/* =========================================================
   RainGuard AI V31
   Adaptive Learning Engine

   File:
   frontend/js/adaptive_learning_engine_v31.js

   Purpose:
   - Learn from verification results
   - Adjust source trust gradually
   - Reward accurate sources
   - Penalize conflicting or weak sources
   - Preserve stable operational behavior
   ========================================================= */

"use strict";

window.RG31 =
    window.RG31 || {};

window.RG30 =
    window.RG30 || {};

RG31.AdaptiveLearningEngine = {

    version:
        "31.0.0",

    initialized:
        false,

    learningInProgress:
        false,

    cycleNumber:
        0,

    lastLearningAt:
        null,

    latestLearningReport:
        null,

    sourceProfiles:
        {},

    learningHistory:
        [],

    storageKey:
        "rainguard_v31_adaptive_learning",

    historyStorageKey:
        "rainguard_v31_learning_history",

    config: {

        enabled:
            true,

        automaticLearning:
            true,

        minimumCities:
            2,

        minimumSources:
            2,

        maximumHistory:
            300,

        maximumProfileHistory:
            100,

        /* =================================================
           LEARNING RATE
           ================================================= */

        learningRate: {

            base:
                0.08,

            minimum:
                0.01,

            maximum:
                0.15,

            highConfidence:
                0.10,

            lowConfidence:
                0.04,

            simulation:
                0.02

        },

        /* =================================================
           WEIGHT ADJUSTMENT LIMITS
           ================================================= */

        adjustment: {

            maximumIncreasePerCycle:
                0.025,

            maximumDecreasePerCycle:
                0.035,

            minimumMultiplier:
                0.65,

            maximumMultiplier:
                1.35,

            recoveryRate:
                0.015,

            decayRate:
                0.005

        },

        /* =================================================
           SOURCE PERFORMANCE THRESHOLDS
           ================================================= */

        thresholds: {

            excellentAccuracy:
                85,

            goodAccuracy:
                70,

            acceptableAccuracy:
                55,

            weakAccuracy:
                40,

            strongAgreement:
                80,

            acceptableAgreement:
                60,

            highConflict:
                60,

            minimumDataQuality:
                35,

            minimumConfidence:
                35

        },

        /* =================================================
           LEARNING FACTORS
           ================================================= */

        factors: {

            sourceAccuracy:
                0.30,

            agreement:
                0.20,

            dataQuality:
                0.18,

            confidence:
                0.12,

            reliability:
                0.10,

            freshness:
                0.06,

            conflictPenalty:
                0.04

        },

        /* =================================================
           SOURCE BASELINES
           ================================================= */

        defaultProfiles: {

            official: {

                multiplier:
                    1.00,

                trustScore:
                    95,

                accuracyScore:
                    90

            },

            radar: {

                multiplier:
                    1.00,

                trustScore:
                    90,

                accuracyScore:
                    86

            },

            satellite: {

                multiplier:
                    1.00,

                trustScore:
                    84,

                accuracyScore:
                    80

            },

            lightning: {

                multiplier:
                    1.00,

                trustScore:
                    86,

                accuracyScore:
                    82

            },

            openMeteo: {

                multiplier:
                    1.00,

                trustScore:
                    78,

                accuracyScore:
                    75

            },

            localModel: {

                multiplier:
                    1.00,

                trustScore:
                    72,

                accuracyScore:
                    68

            }

        },

        /* =================================================
           SIMULATION SAFETY
           ================================================= */

        simulation: {

            allowLearning:
                true,

            maximumInfluence:
                0.20,

            maximumMultiplier:
                0.90,

            minimumCyclesBeforeTrust:
                15

        },

        /* =================================================
           CONFLICT PENALTIES
           ================================================= */

        penalties: {

            lowConflict:
                0.02,

            mediumConflict:
                0.05,

            highConflict:
                0.10,

            unavailable:
                0.015,

            stale:
                0.03,

            unusableData:
                0.06,

            repeatedFailure:
                0.08

        },

        /* =================================================
           REWARDS
           ================================================= */

        rewards: {

            excellent:
                0.08,

            good:
                0.05,

            acceptable:
                0.02,

            strongAgreement:
                0.04,

            highDataQuality:
                0.03,

            verifiedDecision:
                0.03

        },

        /* =================================================
           DEBUG
           ================================================= */

        development: {

            enabled:
                true,

            logLearningCycles:
                true,

            logSourceUpdates:
                true,

            exposeDebugState:
                true

        }

    },

    /* =====================================================
       INITIALIZATION
       ===================================================== */

    init() {

        if (
            this.initialized
        ) {

            return;

        }

        this.initialized =
            true;

        this.loadState();

        this.ensureSourceProfiles();

        this.bindEvents();

        this.writeLog(
            "Adaptive Learning Engine V31 initialized."
        );

        window.dispatchEvent(

            new CustomEvent(

                "rg31:adaptive-learning-ready",

                {
                    detail: {

                        version:
                            this.version,

                        sourceProfiles:
                            this.sourceProfiles,

                        timestamp:
                            new Date()
                                .toISOString()

                    }
                }

            )

        );

    },

    /* =====================================================
       EVENT BINDINGS
       ===================================================== */

    bindEvents() {

        window.addEventListener(

            "rg31:verification-completed",

            event => {

                if (
                    this.config
                        .automaticLearning !==
                    true
                ) {

                    return;

                }

                const results =
                    event
                        ?.detail
                        ?.results ||
                    [];

                const summary =
                    event
                        ?.detail
                        ?.summary ||
                    null;

                this.learnFromVerification(
                    results,
                    summary
                );

            }

        );

        window.addEventListener(

            "rg30:verification-completed",

            event => {

                if (
                    this.learningInProgress
                ) {

                    return;

                }

                if (
                    this.config
                        .automaticLearning !==
                    true
                ) {

                    return;

                }

                const results =
                    event
                        ?.detail
                        ?.results ||
                    [];

                const summary =
                    event
                        ?.detail
                        ?.summary ||
                    null;

                this.learnFromVerification(
                    results,
                    summary
                );

            }

        );

        window.addEventListener(

            "rg31:reset-learning",

            () => {

                this.reset();

            }

        );

    },

    /* =====================================================
       DEFAULT SOURCE PROFILES
       ===================================================== */

    ensureSourceProfiles() {

        const defaults =
            this.config
                .defaultProfiles;

        Object.entries(
            defaults
        )
        .forEach(
            (
                [
                    sourceKey,
                    defaultProfile
                ]
            ) => {

                if (
                    !this.sourceProfiles[
                        sourceKey
                    ]
                ) {

                    this.sourceProfiles[
                        sourceKey
                    ] =
                        this.createSourceProfile(

                            sourceKey,

                            defaultProfile

                        );

                }

            }
        );

        this.saveState();

    },

    createSourceProfile(
        sourceKey,
        defaults = {}
    ) {

        return {

            sourceKey,

            multiplier:
                this.safeNumber(
                    defaults.multiplier,
                    1
                ),

            trustScore:
                this.safeNumber(
                    defaults.trustScore,
                    70
                ),

            accuracyScore:
                this.safeNumber(
                    defaults.accuracyScore,
                    70
                ),

            agreementScore:
                70,

            dataQualityScore:
                70,

            confidenceScore:
                70,

            freshnessScore:
                70,

            conflictScore:
                0,

            successCount:
                0,

            failureCount:
                0,

            conflictCount:
                0,

            simulationCount:
                0,

            learningCycles:
                0,

            consecutiveSuccesses:
                0,

            consecutiveFailures:
                0,

            lastAdjustment:
                0,

            lastResult:
                null,

            lastUpdatedAt:
                null,

            history:
                []

        };

    },
      /* =====================================================
       MAIN LEARNING CYCLE
       ===================================================== */

    async learnFromVerification(
        results = [],
        summary = null
    ) {

        if (
            this.config.enabled !==
            true
        ) {

            return null;

        }

        if (
            this.learningInProgress
        ) {

            return this.latestLearningReport;

        }

        if (
            !Array.isArray(
                results
            ) ||
            results.length <
                this.config.minimumCities
        ) {

            this.writeLog(
                "Adaptive learning skipped because verification results are insufficient.",
                "warning"
            );

            return null;

        }

        this.learningInProgress =
            true;

        this.cycleNumber +=
            1;

        this.lastLearningAt =
            new Date()
                .toISOString();

        const startedAt =
            Date.now();

        try {

            this.ensureSourceProfiles();

            const sourceObservations =
                this.collectSourceObservations(
                    results
                );

            const sourceReports =
                {};

            Object.entries(
                sourceObservations
            )
            .forEach(
                (
                    [
                        sourceKey,
                        observations
                    ]
                ) => {

                    if (
                        !Array.isArray(
                            observations
                        ) ||
                        !observations.length
                    ) {

                        return;

                    }

                    const sourceReport =
                        this.analyzeSourcePerformance(

                            sourceKey,

                            observations,

                            summary

                        );

                    const updatedProfile =
                        this.updateSourceProfile(

                            sourceKey,

                            sourceReport

                        );

                    sourceReports[
                        sourceKey
                    ] = {

                        ...sourceReport,

                        profile:
                            updatedProfile

                    };

                }
            );

            this.applyLearningToVerificationEngine(
                sourceReports
            );

            const report = {

                cycleNumber:
                    this.cycleNumber,

                citiesAnalyzed:
                    results.length,

                sourcesAnalyzed:
                    Object.keys(
                        sourceReports
                    )
                    .length,

                nationalConfidence:
                    this.safeNumber(
                        summary
                            ?.nationalConfidence,
                        0
                    ),

                nationalStatus:
                    summary
                        ?.nationalStatus ||
                    "UNKNOWN",

                averageDataQuality:
                    this.safeNumber(
                        summary
                            ?.averageDataQuality,
                        0
                    ),

                sourceReports,

                durationMs:
                    Date.now() -
                    startedAt,

                timestamp:
                    this.lastLearningAt

            };

            this.latestLearningReport =
                report;

            this.learningHistory.unshift(
                report
            );

            if (
                this.learningHistory.length >
                this.config.maximumHistory
            ) {

                this.learningHistory =
                    this.learningHistory.slice(
                        0,
                        this.config.maximumHistory
                    );

            }

            this.saveState();

            this.publishLearningReport(
                report
            );

            this.writeLog(

                `Adaptive learning cycle ${this.cycleNumber} completed for ${Object.keys(sourceReports).length} sources.`

            );

            return report;

        } catch (error) {

            console.error(
                "Adaptive learning cycle failed:",
                error
            );

            this.writeLog(

                `Adaptive learning failed: ${error?.message || String(error)}`,

                "danger"

            );

            window.dispatchEvent(

                new CustomEvent(

                    "rg31:adaptive-learning-failed",

                    {
                        detail: {

                            cycleNumber:
                                this.cycleNumber,

                            error:
                                error?.message ||
                                String(
                                    error
                                ),

                            timestamp:
                                new Date()
                                    .toISOString()

                        }
                    }

                )

            );

            return null;

        } finally {

            this.learningInProgress =
                false;

        }

    },

    /* =====================================================
       COLLECT SOURCE OBSERVATIONS
       ===================================================== */

    collectSourceObservations(
        results = []
    ) {

        const observations =
            {};

        results.forEach(
            result => {

                const sources =
                    result
                        ?.sources ||
                    {};

                Object.entries(
                    sources
                )
                .forEach(
                    (
                        [
                            sourceKey,
                            source
                        ]
                    ) => {

                        if (
                            !observations[
                                sourceKey
                            ]
                        ) {

                            observations[
                                sourceKey
                            ] =
                                [];

                        }

                        observations[
                            sourceKey
                        ]
                        .push(

                            this.buildSourceObservation({

                                sourceKey,

                                source,

                                cityResult:
                                    result

                            })

                        );

                    }
                );

            }
        );

        return observations;

    },

    /* =====================================================
       BUILD SINGLE OBSERVATION
       ===================================================== */

    buildSourceObservation({

        sourceKey,

        source = {},

        cityResult = {}

    }) {

        const contribution =
            cityResult
                ?.sourceContributions
                ?.[sourceKey] ||
            {};

        const quality =
            contribution
                ?.quality ||
            {};

        const conflict =
            cityResult
                ?.conflict ||
            {};

        const sourceSignal =
            this.clamp(

                source.signalScore,

                0,

                100

            );

        const verifiedRisk =
            this.clamp(

                cityResult.verifiedRisk,

                0,

                100

            );

        const rainConsensus =
            this.clamp(

                cityResult.rainConsensus,

                0,

                100

            );

        const referenceSignal =
            this.calculateReferenceSignal(
                cityResult,
                sourceKey
            );

        const deviation =
            Math.abs(

                sourceSignal -
                referenceSignal

            );

        const accuracyScore =
            this.clamp(

                100 -
                deviation,

                0,

                100

            );

        const agreementScore =
            this.calculateObservationAgreement({

                source,

                cityResult,

                sourceKey

            });

        const sourceConflict =
            this.isSourceInConflict(

                sourceKey,

                conflict

            );

        return {

            sourceKey,

            city:
                cityResult.city ||
                "Unknown",

            available:
                source.available ===
                true,

            simulated:
                source.simulated ===
                true,

            status:
                source.status ||
                "UNKNOWN",

            signalScore:
                sourceSignal,

            rainProbability:
                this.clamp(

                    source.rainProbability,

                    0,

                    100

                ),

            confidence:
                this.clamp(

                    source.confidence,

                    0,

                    100

                ),

            reliability:
                this.clamp(

                    source.reliability,

                    0,

                    1

                ) *
                100,

            verifiedRisk,

            rainConsensus,

            referenceSignal:
                Math.round(
                    referenceSignal
                ),

            deviation:
                Math.round(
                    deviation
                ),

            accuracyScore:
                Math.round(
                    accuracyScore
                ),

            agreementScore:
                Math.round(
                    agreementScore
                ),

            dataQualityScore:
                this.clamp(

                    contribution
                        ?.dataQualityScore ??

                    quality.score,

                    0,

                    100

                ),

            freshnessScore:
                this.clamp(

                    quality.freshness ??

                    source.details
                        ?.freshnessScore,

                    0,

                    100

                ),

            contributionScore:
                this.clamp(

                    contribution
                        ?.contribution,

                    0,

                    100

                ),

            effectiveWeight:
                this.clamp(

                    contribution
                        ?.effectiveWeight,

                    0,

                    1

                ),

            sourceConflict,

            conflictLevel:
                conflict.level ||
                "NONE",

            conflictScore:
                this.clamp(

                    conflict.score,

                    0,

                    100

                ),

            cityVerificationStatus:
                cityResult.status ||
                "UNKNOWN",

            finalConfidence:
                this.clamp(

                    cityResult.finalConfidence,

                    0,

                    100

                ),

            decisionAllowed:
                cityResult
                    ?.decisionGate
                    ?.allowed ===
                    true,

            timestamp:
                cityResult.timestamp ||
                new Date()
                    .toISOString()

        };

    },

    /* =====================================================
       REFERENCE SIGNAL
       ===================================================== */

    calculateReferenceSignal(
        cityResult = {},
        excludedSourceKey = ""
    ) {

        const sources =
            cityResult.sources ||
            {};

        const values =
            [];

        Object.entries(
            sources
        )
        .forEach(
            (
                [
                    sourceKey,
                    source
                ]
            ) => {

                if (
                    sourceKey ===
                    excludedSourceKey
                ) {

                    return;

                }

                if (
                    source
                        ?.available !==
                    true
                ) {

                    return;

                }

                const contribution =
                    cityResult
                        ?.sourceContributions
                        ?.[sourceKey] ||
                    {};

                const quality =
                    this.clamp(

                        contribution
                            ?.dataQualityScore,

                        0,

                        100

                    ) /
                    100;

                const reliability =
                    this.clamp(

                        source.reliability,

                        0,

                        1

                    );

                const weight =
                    this.clamp(

                        cityResult
                            ?.dynamicWeights
                            ?.[sourceKey],

                        0,

                        1

                    );

                const effectiveWeight =
                    Math.max(

                        0.01,

                        weight *
                        Math.max(
                            0.25,
                            quality
                        ) *
                        Math.max(
                            0.25,
                            reliability
                        )

                    );

                values.push({

                    signal:
                        this.clamp(

                            source.signalScore,

                            0,

                            100

                        ),

                    weight:
                        effectiveWeight

                });

            }
        );

        if (
            !values.length
        ) {

            return this.clamp(

                cityResult.verifiedRisk,

                0,

                100

            );

        }

        const weightedTotal =
            values.reduce(

                (
                    total,
                    item
                ) =>

                    total +

                    item.signal *
                    item.weight,

                0

            );

        const totalWeight =
            values.reduce(

                (
                    total,
                    item
                ) =>

                    total +
                    item.weight,

                0

            );

        if (
            totalWeight <= 0
        ) {

            return this.clamp(

                cityResult.rainConsensus,

                0,

                100

            );

        }

        const peerSignal =
            weightedTotal /
            totalWeight;

        return this.clamp(

            peerSignal *
                0.60 +

            this.clamp(
                cityResult.rainConsensus,
                0,
                100
            ) *
                0.25 +

            this.clamp(
                cityResult.verifiedRisk,
                0,
                100
            ) *
                0.15,

            0,

            100

        );

    },

    /* =====================================================
       OBSERVATION AGREEMENT
       ===================================================== */

    calculateObservationAgreement({

        source = {},

        cityResult = {},

        sourceKey = ""

    }) {

        const sourceSignal =
            this.clamp(

                source.signalScore,

                0,

                100

            );

        const sourceProbability =
            this.clamp(

                source.rainProbability,

                0,

                100

            );

        const referenceSignal =
            this.calculateReferenceSignal(

                cityResult,

                sourceKey

            );

        const signalAgreement =
            this.clamp(

                100 -
                Math.abs(

                    sourceSignal -
                    referenceSignal

                ),

                0,

                100

            );

        const probabilityAgreement =
            this.clamp(

                100 -
                Math.abs(

                    sourceProbability -

                    this.clamp(
                        cityResult.rainConsensus,
                        0,
                        100
                    )

                ),

                0,

                100

            );

        return this.clamp(

            signalAgreement *
                0.65 +

            probabilityAgreement *
                0.35,

            0,

            100

        );

    },

    /* =====================================================
       SOURCE CONFLICT DETECTION
       ===================================================== */

    isSourceInConflict(
        sourceKey,
        conflict = {}
    ) {

        if (
            conflict.detected !==
            true
        ) {

            return false;

        }

        const pairs =
            Array.isArray(
                conflict.evidencePairs
            )
                ? conflict.evidencePairs
                : [];

        return pairs.some(
            item => {

                return (

                    item.firstSource ===
                        sourceKey ||

                    item.secondSource ===
                        sourceKey

                );

            }
        );

    },

    /* =====================================================
       SOURCE PERFORMANCE ANALYSIS
       ===================================================== */

    analyzeSourcePerformance(
        sourceKey,
        observations = [],
        summary = null
    ) {

        const usableObservations =
            observations.filter(
                observation =>
                    observation.available ===
                    true
            );

        const unavailableCount =
            observations.length -
            usableObservations.length;

        if (
            !usableObservations.length
        ) {

            return {

                sourceKey,

                observations:
                    observations.length,

                usableObservations:
                    0,

                unavailableCount,

                simulatedCount:
                    0,

                averageAccuracy:
                    0,

                averageAgreement:
                    0,

                averageDataQuality:
                    0,

                averageConfidence:
                    0,

                averageReliability:
                    0,

                averageFreshness:
                    0,

                averageConflict:
                    0,

                performanceScore:
                    0,

                reward:
                    0,

                penalty:
                    this.config
                        .penalties
                        .unavailable,

                rawAdjustment:
                    -this.config
                        .penalties
                        .unavailable,

                recommendedAdjustment:
                    -this.config
                        .penalties
                        .unavailable,

                classification:
                    "UNAVAILABLE",

                observationsData:
                    observations

            };

        }

        const average =
            field => {

                const total =
                    usableObservations.reduce(

                        (
                            sum,
                            item
                        ) =>

                            sum +

                            this.safeNumber(
                                item[field],
                                0
                            ),

                        0

                    );

                return total /
                    usableObservations.length;

            };

        const averageAccuracy =
            average(
                "accuracyScore"
            );

        const averageAgreement =
            average(
                "agreementScore"
            );

        const averageDataQuality =
            average(
                "dataQualityScore"
            );

        const averageConfidence =
            average(
                "confidence"
            );

        const averageReliability =
            average(
                "reliability"
            );

        const averageFreshness =
            average(
                "freshnessScore"
            );

        const averageConflict =
            average(
                "conflictScore"
            );

        const simulatedCount =
            usableObservations.filter(
                observation =>
                    observation.simulated ===
                    true
            )
            .length;

        const conflictCount =
            usableObservations.filter(
                observation =>
                    observation.sourceConflict ===
                    true
            )
            .length;

        const verifiedDecisionCount =
            usableObservations.filter(
                observation =>

                    observation
                        .cityVerificationStatus ===
                        "VERIFIED" &&

                    observation
                        .decisionAllowed ===
                        true
            )
            .length;

        const factors =
            this.config.factors;

        let performanceScore =

            averageAccuracy *
                factors.sourceAccuracy +

            averageAgreement *
                factors.agreement +

            averageDataQuality *
                factors.dataQuality +

            averageConfidence *
                factors.confidence +

            averageReliability *
                factors.reliability +

            averageFreshness *
                factors.freshness -

            averageConflict *
                factors.conflictPenalty;

        performanceScore =
            this.clamp(

                performanceScore,

                0,

                100

            );

        const classification =
            this.classifyPerformance(
                performanceScore
            );

        const reward =
            this.calculatePerformanceReward({

                performanceScore,

                averageAgreement,

                averageDataQuality,

                verifiedDecisionCount,

                usableCount:
                    usableObservations.length

            });

        const penalty =
            this.calculatePerformancePenalty({

                unavailableCount,

                conflictCount,

                usableCount:
                    usableObservations.length,

                averageConflict,

                averageDataQuality,

                averageFreshness

            });

        let rawAdjustment =
            reward -
            penalty;

        const simulationRatio =
            simulatedCount /
            Math.max(
                1,
                usableObservations.length
            );

        if (
            simulationRatio > 0
        ) {

            rawAdjustment *=

                1 -

                simulationRatio *
                (
                    1 -
                    this.config
                        .simulation
                        .maximumInfluence
                );

        }

        const learningRate =
            this.determineLearningRate({

                averageConfidence,

                simulationRatio,

                nationalConfidence:
                    this.safeNumber(
                        summary
                            ?.nationalConfidence,
                        0
                    )

            });

        const recommendedAdjustment =
            this.clamp(

                rawAdjustment *
                learningRate,

                -this.config
                    .adjustment
                    .maximumDecreasePerCycle,

                this.config
                    .adjustment
                    .maximumIncreasePerCycle

            );

        return {

            sourceKey,

            observations:
                observations.length,

            usableObservations:
                usableObservations.length,

            unavailableCount,

            simulatedCount,

            simulationRatio:
                Number(
                    (
                        simulationRatio *
                        100
                    )
                    .toFixed(
                        2
                    )
                ),

            conflictCount,

            verifiedDecisionCount,

            averageAccuracy:
                Math.round(
                    averageAccuracy
                ),

            averageAgreement:
                Math.round(
                    averageAgreement
                ),

            averageDataQuality:
                Math.round(
                    averageDataQuality
                ),

            averageConfidence:
                Math.round(
                    averageConfidence
                ),

            averageReliability:
                Math.round(
                    averageReliability
                ),

            averageFreshness:
                Math.round(
                    averageFreshness
                ),

            averageConflict:
                Math.round(
                    averageConflict
                ),

            performanceScore:
                Math.round(
                    performanceScore
                ),

            classification,

            reward:
                Number(
                    reward.toFixed(
                        4
                    )
                ),

            penalty:
                Number(
                    penalty.toFixed(
                        4
                    )
                ),

            rawAdjustment:
                Number(
                    rawAdjustment.toFixed(
                        4
                    )
                ),

            learningRate:
                Number(
                    learningRate.toFixed(
                        4
                    )
                ),

            recommendedAdjustment:
                Number(
                    recommendedAdjustment
                        .toFixed(
                            4
                        )
                ),

            observationsData:
                observations

        };

    },
      /* =====================================================
       PERFORMANCE CLASSIFICATION
       ===================================================== */

    classifyPerformance(
        performanceScore
    ) {

        const value =
            this.clamp(
                performanceScore,
                0,
                100
            );

        const thresholds =
            this.config
                .thresholds;

        if (
            value >=
            thresholds
                .excellentAccuracy
        ) {

            return "EXCELLENT";

        }

        if (
            value >=
            thresholds
                .goodAccuracy
        ) {

            return "GOOD";

        }

        if (
            value >=
            thresholds
                .acceptableAccuracy
        ) {

            return "ACCEPTABLE";

        }

        if (
            value >=
            thresholds
                .weakAccuracy
        ) {

            return "WEAK";

        }

        return "POOR";

    },

    /* =====================================================
       PERFORMANCE REWARD
       ===================================================== */

    calculatePerformanceReward({

        performanceScore = 0,

        averageAgreement = 0,

        averageDataQuality = 0,

        verifiedDecisionCount = 0,

        usableCount = 0

    } = {}) {

        const rewards =
            this.config
                .rewards;

        const thresholds =
            this.config
                .thresholds;

        let reward =
            0;

        if (
            performanceScore >=
            thresholds
                .excellentAccuracy
        ) {

            reward +=
                rewards.excellent;

        } else if (
            performanceScore >=
            thresholds
                .goodAccuracy
        ) {

            reward +=
                rewards.good;

        } else if (
            performanceScore >=
            thresholds
                .acceptableAccuracy
        ) {

            reward +=
                rewards.acceptable;

        }

        if (
            averageAgreement >=
            thresholds
                .strongAgreement
        ) {

            reward +=
                rewards
                    .strongAgreement;

        }

        if (
            averageDataQuality >= 80
        ) {

            reward +=
                rewards
                    .highDataQuality;

        }

        const verifiedRatio =
            verifiedDecisionCount /
            Math.max(
                1,
                usableCount
            );

        if (
            verifiedRatio >= 0.60
        ) {

            reward +=

                rewards
                    .verifiedDecision *

                verifiedRatio;

        }

        return this.clamp(

            reward,

            0,

            0.25

        );

    },

    /* =====================================================
       PERFORMANCE PENALTY
       ===================================================== */

    calculatePerformancePenalty({

        unavailableCount = 0,

        conflictCount = 0,

        usableCount = 0,

        averageConflict = 0,

        averageDataQuality = 0,

        averageFreshness = 0

    } = {}) {

        const penalties =
            this.config
                .penalties;

        let penalty =
            0;

        const totalObservations =

            unavailableCount +

            usableCount;

        const unavailableRatio =
            unavailableCount /
            Math.max(
                1,
                totalObservations
            );

        const conflictRatio =
            conflictCount /
            Math.max(
                1,
                usableCount
            );

        if (
            unavailableRatio > 0
        ) {

            penalty +=

                penalties
                    .unavailable *

                unavailableRatio;

        }

        if (
            conflictRatio > 0
        ) {

            if (
                averageConflict >=
                this.config
                    .thresholds
                    .highConflict
            ) {

                penalty +=

                    penalties
                        .highConflict *

                    conflictRatio;

            } else if (
                averageConflict >= 35
            ) {

                penalty +=

                    penalties
                        .mediumConflict *

                    conflictRatio;

            } else {

                penalty +=

                    penalties
                        .lowConflict *

                    conflictRatio;

            }

        }

        if (
            averageDataQuality <
            this.config
                .thresholds
                .minimumDataQuality
        ) {

            penalty +=
                penalties
                    .unusableData;

        }

        if (
            averageFreshness < 35
        ) {

            penalty +=
                penalties
                    .stale;

        }

        return this.clamp(

            penalty,

            0,

            0.30

        );

    },

    /* =====================================================
       LEARNING RATE
       ===================================================== */

    determineLearningRate({

        averageConfidence = 0,

        simulationRatio = 0,

        nationalConfidence = 0

    } = {}) {

        const settings =
            this.config
                .learningRate;

        let rate =
            settings.base;

        const combinedConfidence =

            this.clamp(
                averageConfidence,
                0,
                100
            ) *
                0.65 +

            this.clamp(
                nationalConfidence,
                0,
                100
            ) *
                0.35;

        if (
            combinedConfidence >= 75
        ) {

            rate =
                settings
                    .highConfidence;

        } else if (
            combinedConfidence < 50
        ) {

            rate =
                settings
                    .lowConfidence;

        }

        if (
            simulationRatio > 0
        ) {

            const simulationRate =
                settings
                    .simulation;

            rate =

                rate *
                    (
                        1 -
                        simulationRatio
                    ) +

                simulationRate *
                    simulationRatio;

        }

        return this.clamp(

            rate,

            settings.minimum,

            settings.maximum

        );

    },

    /* =====================================================
       UPDATE SOURCE PROFILE
       ===================================================== */

    updateSourceProfile(
        sourceKey,
        sourceReport = {}
    ) {

        if (
            !this.sourceProfiles[
                sourceKey
            ]
        ) {

            const defaults =
                this.config
                    .defaultProfiles[
                        sourceKey
                    ] ||
                {};

            this.sourceProfiles[
                sourceKey
            ] =
                this.createSourceProfile(

                    sourceKey,

                    defaults

                );

        }

        const profile =
            this.sourceProfiles[
                sourceKey
            ];

        const previousMultiplier =
            this.safeNumber(
                profile.multiplier,
                1
            );

        const recommendedAdjustment =
            this.safeNumber(

                sourceReport
                    .recommendedAdjustment,

                0

            );

        const boundedAdjustment =
            this.clamp(

                recommendedAdjustment,

                -this.config
                    .adjustment
                    .maximumDecreasePerCycle,

                this.config
                    .adjustment
                    .maximumIncreasePerCycle

            );

        let nextMultiplier =

            previousMultiplier +

            boundedAdjustment;

        nextMultiplier =
            this.applyMultiplierRecovery(

                nextMultiplier,

                sourceReport

            );

        nextMultiplier =
            this.applyMultiplierDecay(

                nextMultiplier,

                sourceReport

            );

        nextMultiplier =
            this.clamp(

                nextMultiplier,

                this.config
                    .adjustment
                    .minimumMultiplier,

                this.config
                    .adjustment
                    .maximumMultiplier

            );

        const simulationRatio =
            this.safeNumber(

                sourceReport
                    .simulationRatio,

                0

            ) /
            100;

        if (
            simulationRatio > 0
        ) {

            const minimumCycles =
                this.config
                    .simulation
                    .minimumCyclesBeforeTrust;

            const futureCycles =
                this.safeNumber(
                    profile.learningCycles,
                    0
                ) +
                1;

            if (
                futureCycles <
                minimumCycles
            ) {

                nextMultiplier =
                    Math.min(

                        nextMultiplier,

                        this.config
                            .simulation
                            .maximumMultiplier

                    );

            }

        }

        const successfulCycle =
            this.isSuccessfulLearningCycle(
                sourceReport
            );

        if (
            successfulCycle
        ) {

            profile.successCount =
                this.safeNumber(
                    profile.successCount,
                    0
                ) +
                1;

            profile.consecutiveSuccesses =
                this.safeNumber(
                    profile.consecutiveSuccesses,
                    0
                ) +
                1;

            profile.consecutiveFailures =
                0;

        } else {

            profile.failureCount =
                this.safeNumber(
                    profile.failureCount,
                    0
                ) +
                1;

            profile.consecutiveFailures =
                this.safeNumber(
                    profile.consecutiveFailures,
                    0
                ) +
                1;

            profile.consecutiveSuccesses =
                0;

        }

        if (
            this.safeNumber(
                sourceReport.conflictCount,
                0
            ) > 0
        ) {

            profile.conflictCount =
                this.safeNumber(
                    profile.conflictCount,
                    0
                ) +
                sourceReport
                    .conflictCount;

        }

        if (
            this.safeNumber(
                sourceReport.simulatedCount,
                0
            ) > 0
        ) {

            profile.simulationCount =
                this.safeNumber(
                    profile.simulationCount,
                    0
                ) +
                sourceReport
                    .simulatedCount;

        }

        profile.learningCycles =
            this.safeNumber(
                profile.learningCycles,
                0
            ) +
            1;

        profile.multiplier =
            Number(
                nextMultiplier
                    .toFixed(
                        4
                    )
            );

        profile.trustScore =
            this.smoothMetric(

                profile.trustScore,

                this.calculateUpdatedTrustScore(
                    sourceReport
                ),

                0.20

            );

        profile.accuracyScore =
            this.smoothMetric(

                profile.accuracyScore,

                sourceReport
                    .averageAccuracy,

                0.25

            );

        profile.agreementScore =
            this.smoothMetric(

                profile.agreementScore,

                sourceReport
                    .averageAgreement,

                0.25

            );

        profile.dataQualityScore =
            this.smoothMetric(

                profile.dataQualityScore,

                sourceReport
                    .averageDataQuality,

                0.20

            );

        profile.confidenceScore =
            this.smoothMetric(

                profile.confidenceScore,

                sourceReport
                    .averageConfidence,

                0.20

            );

        profile.freshnessScore =
            this.smoothMetric(

                profile.freshnessScore,

                sourceReport
                    .averageFreshness,

                0.20

            );

        profile.conflictScore =
            this.smoothMetric(

                profile.conflictScore,

                sourceReport
                    .averageConflict,

                0.20

            );

        profile.lastAdjustment =
            Number(
                boundedAdjustment
                    .toFixed(
                        4
                    )
            );

        profile.lastResult = {

            classification:
                sourceReport
                    .classification,

            performanceScore:
                sourceReport
                    .performanceScore,

            averageAccuracy:
                sourceReport
                    .averageAccuracy,

            averageAgreement:
                sourceReport
                    .averageAgreement,

            averageDataQuality:
                sourceReport
                    .averageDataQuality,

            averageConfidence:
                sourceReport
                    .averageConfidence,

            recommendedAdjustment:
                sourceReport
                    .recommendedAdjustment,

            simulationRatio:
                sourceReport
                    .simulationRatio,

            conflictCount:
                sourceReport
                    .conflictCount,

            timestamp:
                this.lastLearningAt

        };

        profile.lastUpdatedAt =
            this.lastLearningAt;

        profile.history.unshift({

            multiplier:
                profile.multiplier,

            adjustment:
                profile.lastAdjustment,

            performanceScore:
                sourceReport
                    .performanceScore,

            accuracy:
                sourceReport
                    .averageAccuracy,

            agreement:
                sourceReport
                    .averageAgreement,

            dataQuality:
                sourceReport
                    .averageDataQuality,

            confidence:
                sourceReport
                    .averageConfidence,

            conflict:
                sourceReport
                    .averageConflict,

            classification:
                sourceReport
                    .classification,

            timestamp:
                this.lastLearningAt

        });

        if (
            profile.history.length >
            this.config
                .maximumProfileHistory
        ) {

            profile.history =
                profile.history.slice(

                    0,

                    this.config
                        .maximumProfileHistory

                );

        }

        this.sourceProfiles[
            sourceKey
        ] =
            profile;

        if (
            this.config
                .development
                .logSourceUpdates
        ) {

            console.log(

                `[RainGuard V31 Adaptive Learning] ${sourceKey}`,

                {
                    previousMultiplier,

                    adjustment:
                        boundedAdjustment,

                    nextMultiplier:
                        profile.multiplier,

                    performance:
                        sourceReport
                            .performanceScore,

                    classification:
                        sourceReport
                            .classification
                }

            );

        }

        return {

            ...profile,

            history: [
                ...profile.history
            ]

        };

    },

    /* =====================================================
       SUCCESSFUL LEARNING CYCLE
       ===================================================== */

    isSuccessfulLearningCycle(
        sourceReport = {}
    ) {

        return (

            this.safeNumber(
                sourceReport
                    .performanceScore,
                0
            ) >=
            this.config
                .thresholds
                .acceptableAccuracy &&

            this.safeNumber(
                sourceReport
                    .averageDataQuality,
                0
            ) >=
            this.config
                .thresholds
                .minimumDataQuality &&

            this.safeNumber(
                sourceReport
                    .averageConfidence,
                0
            ) >=
            this.config
                .thresholds
                .minimumConfidence

        );

    },

    /* =====================================================
       MULTIPLIER RECOVERY
       ===================================================== */

    applyMultiplierRecovery(
        multiplier,
        sourceReport = {}
    ) {

        let value =
            this.safeNumber(
                multiplier,
                1
            );

        const successful =
            this.isSuccessfulLearningCycle(
                sourceReport
            );

        if (
            successful &&
            value < 1
        ) {

            value +=
                this.config
                    .adjustment
                    .recoveryRate;

        }

        return value;

    },

    /* =====================================================
       MULTIPLIER DECAY
       ===================================================== */

    applyMultiplierDecay(
        multiplier,
        sourceReport = {}
    ) {

        let value =
            this.safeNumber(
                multiplier,
                1
            );

        const performance =
            this.safeNumber(

                sourceReport
                    .performanceScore,

                0

            );

        if (
            performance <
            this.config
                .thresholds
                .weakAccuracy
        ) {

            value -=
                this.config
                    .adjustment
                    .decayRate;

        }

        return value;

    },

    /* =====================================================
       UPDATED TRUST SCORE
       ===================================================== */

    calculateUpdatedTrustScore(
        sourceReport = {}
    ) {

        const accuracy =
            this.safeNumber(
                sourceReport
                    .averageAccuracy,
                0
            );

        const agreement =
            this.safeNumber(
                sourceReport
                    .averageAgreement,
                0
            );

        const quality =
            this.safeNumber(
                sourceReport
                    .averageDataQuality,
                0
            );

        const confidence =
            this.safeNumber(
                sourceReport
                    .averageConfidence,
                0
            );

        const conflict =
            this.safeNumber(
                sourceReport
                    .averageConflict,
                0
            );

        return this.clamp(

            accuracy *
                0.35 +

            agreement *
                0.25 +

            quality *
                0.20 +

            confidence *
                0.15 +

            (
                100 -
                conflict
            ) *
                0.05,

            0,

            100

        );

    },

    /* =====================================================
       SMOOTH METRIC
       ===================================================== */

    smoothMetric(
        previousValue,
        newValue,
        smoothingFactor = 0.20
    ) {

        const previous =
            this.safeNumber(
                previousValue,
                0
            );

        const next =
            this.safeNumber(
                newValue,
                previous
            );

        const factor =
            this.clamp(

                smoothingFactor,

                0,

                1

            );

        return Math.round(

            previous *
                (
                    1 -
                    factor
                ) +

            next *
                factor

        );

    },
      /* =====================================================
       APPLY LEARNING TO VERIFICATION ENGINE
       ===================================================== */

    applyLearningToVerificationEngine(
        sourceReports = {}
    ) {

        const verificationEngine =
            window.RG31
                ?.VerificationEngine ||
            window.RG30
                ?.VerificationEngine;

        if (
            !verificationEngine ||
            !verificationEngine.config
        ) {

            this.writeLog(
                "Verification Engine is unavailable. Learned profiles were saved but not applied.",
                "warning"
            );

            return false;

        }

        const originalBaseWeights =
            verificationEngine
                .config
                .baseSourceWeights ||
            verificationEngine
                .config
                .sourceWeights ||
            {};

        const learnedRawWeights =
            {};

        Object.keys(
            originalBaseWeights
        )
        .forEach(
            sourceKey => {

                const baseWeight =
                    this.safeNumber(

                        originalBaseWeights[
                            sourceKey
                        ],

                        0

                    );

                const profile =
                    this.sourceProfiles[
                        sourceKey
                    ] ||
                    this.createSourceProfile(
                        sourceKey,
                        this.config
                            .defaultProfiles[
                                sourceKey
                            ] ||
                        {}
                    );

                const multiplier =
                    this.getEffectiveSourceMultiplier(

                        sourceKey,

                        profile,

                        sourceReports[
                            sourceKey
                        ]

                    );

                learnedRawWeights[
                    sourceKey
                ] =
                    baseWeight *
                    multiplier;

            }
        );

        const protectedWeights =
            this.applySourceProtectionRules(
                learnedRawWeights,
                sourceReports
            );

        const normalizedWeights =
            this.normalizeLearnedWeights(
                protectedWeights
            );

        verificationEngine
            .config
            .baseSourceWeights = {

                ...normalizedWeights

            };

        verificationEngine
            .config
            .sourceWeights = {

                ...normalizedWeights

            };

        verificationEngine
            .previousDynamicWeights = {

                ...normalizedWeights

            };

        verificationEngine
            .adaptiveLearningState = {

                enabled:
                    true,

                learningCycle:
                    this.cycleNumber,

                updatedAt:
                    this.lastLearningAt,

                weights: {

                    ...normalizedWeights

                },

                profiles:
                    this.getProfilesSnapshot(),

                sourceReports

            };

        window.RG31
            .AdaptiveSourceWeights = {

                ...normalizedWeights

            };

        window.RG30
            .AdaptiveSourceWeights = {

                ...normalizedWeights

            };

        this.publishWeightUpdate({

            rawWeights:
                learnedRawWeights,

            protectedWeights,

            normalizedWeights,

            sourceReports

        });

        if (
            this.config
                .development
                .logLearningCycles
        ) {

            console.table(

                Object.entries(
                    normalizedWeights
                )
                .map(
                    (
                        [
                            sourceKey,
                            weight
                        ]
                    ) => ({

                        source:
                            sourceKey,

                        weight:
                            Number(
                                weight
                                    .toFixed(
                                        4
                                    )
                            ),

                        percent:
                            Number(
                                (
                                    weight *
                                    100
                                )
                                .toFixed(
                                    2
                                )
                            ),

                        multiplier:
                            this.safeNumber(

                                this.sourceProfiles[
                                    sourceKey
                                ]
                                ?.multiplier,

                                1

                            ),

                        trust:
                            this.safeNumber(

                                this.sourceProfiles[
                                    sourceKey
                                ]
                                ?.trustScore,

                                0

                            ),

                        accuracy:
                            this.safeNumber(

                                this.sourceProfiles[
                                    sourceKey
                                ]
                                ?.accuracyScore,

                                0

                            )

                    })
                )

            );

        }

        return true;

    },

    /* =====================================================
       EFFECTIVE SOURCE MULTIPLIER
       ===================================================== */

    getEffectiveSourceMultiplier(
        sourceKey,
        profile = {},
        sourceReport = null
    ) {

        let multiplier =
            this.safeNumber(
                profile.multiplier,
                1
            );

        const trustFactor =
            this.clamp(

                this.safeNumber(
                    profile.trustScore,
                    70
                ) /
                100,

                0.50,

                1.10

            );

        const accuracyFactor =
            this.clamp(

                this.safeNumber(
                    profile.accuracyScore,
                    70
                ) /
                100,

                0.50,

                1.10

            );

        const qualityFactor =
            this.clamp(

                this.safeNumber(
                    profile.dataQualityScore,
                    70
                ) /
                100,

                0.50,

                1.10

            );

        const agreementFactor =
            this.clamp(

                this.safeNumber(
                    profile.agreementScore,
                    70
                ) /
                100,

                0.50,

                1.10

            );

        const conflictPenalty =
            this.clamp(

                this.safeNumber(
                    profile.conflictScore,
                    0
                ) /
                100,

                0,

                1

            );

        const profileQualityMultiplier =

            trustFactor *
                0.30 +

            accuracyFactor *
                0.30 +

            qualityFactor *
                0.20 +

            agreementFactor *
                0.20;

        multiplier *=

            0.65 +

            profileQualityMultiplier *
                0.35;

        multiplier *=

            1 -

            conflictPenalty *
                0.15;

        if (
            sourceReport
        ) {

            const classification =
                String(

                    sourceReport
                        .classification ||
                    ""

                )
                    .trim()
                    .toUpperCase();

            if (
                classification ===
                "EXCELLENT"
            ) {

                multiplier *=
                    1.03;

            } else if (
                classification ===
                "GOOD"
            ) {

                multiplier *=
                    1.015;

            } else if (
                classification ===
                "WEAK"
            ) {

                multiplier *=
                    0.97;

            } else if (
                classification ===
                "POOR" ||
                classification ===
                "UNAVAILABLE"
            ) {

                multiplier *=
                    0.94;

            }

        }

        if (
            sourceKey ===
            "lightning"
        ) {

            multiplier =
                this.applyLightningLearningRules(

                    multiplier,

                    profile,

                    sourceReport

                );

        }

        if (
            sourceKey ===
            "localModel"
        ) {

            multiplier =
                this.applyLocalAILearningRules(

                    multiplier,

                    profile,

                    sourceReport

                );

        }

        if (
            sourceKey ===
            "official"
        ) {

            multiplier =
                this.applyOfficialSourceLearningRules(

                    multiplier,

                    profile,

                    sourceReport

                );

        }

        return this.clamp(

            multiplier,

            this.config
                .adjustment
                .minimumMultiplier,

            this.config
                .adjustment
                .maximumMultiplier

        );

    },

    /* =====================================================
       OFFICIAL SOURCE PROTECTION
       ===================================================== */

    applyOfficialSourceLearningRules(
        multiplier,
        profile = {},
        sourceReport = null
    ) {

        let value =
            this.safeNumber(
                multiplier,
                1
            );

        const minimumOfficialMultiplier =
            0.90;

        const maximumOfficialMultiplier =
            1.20;

        if (
            sourceReport
                ?.classification ===
                "UNAVAILABLE"
        ) {

            value =
                Math.max(
                    value,
                    0.92
                );

        }

        if (
            this.safeNumber(
                profile.trustScore,
                0
            ) >= 90
        ) {

            value =
                Math.max(
                    value,
                    1
                );

        }

        return this.clamp(

            value,

            minimumOfficialMultiplier,

            maximumOfficialMultiplier

        );

    },

    /* =====================================================
       LIGHTNING LEARNING RULES
       ===================================================== */

    applyLightningLearningRules(
        multiplier,
        profile = {},
        sourceReport = null
    ) {

        let value =
            this.safeNumber(
                multiplier,
                1
            );

        const simulationRatio =
            this.safeNumber(

                sourceReport
                    ?.simulationRatio,

                0

            );

        const cycles =
            this.safeNumber(
                profile.learningCycles,
                0
            );

        if (
            simulationRatio > 0 &&
            cycles <
            this.config
                .simulation
                .minimumCyclesBeforeTrust
        ) {

            value =
                Math.min(

                    value,

                    this.config
                        .simulation
                        .maximumMultiplier

                );

        }

        const accuracy =
            this.safeNumber(
                profile.accuracyScore,
                0
            );

        const conflict =
            this.safeNumber(
                profile.conflictScore,
                0
            );

        if (
            accuracy >= 80 &&
            conflict <= 25
        ) {

            value *=
                1.03;

        }

        if (
            conflict >= 60
        ) {

            value *=
                0.92;

        }

        return this.clamp(

            value,

            0.70,

            1.20

        );

    },

    /* =====================================================
       LOCAL AI LEARNING RULES
       ===================================================== */

    applyLocalAILearningRules(
        multiplier,
        profile = {},
        sourceReport = null
    ) {

        let value =
            this.safeNumber(
                multiplier,
                1
            );

        const cycles =
            this.safeNumber(
                profile.learningCycles,
                0
            );

        const accuracy =
            this.safeNumber(
                profile.accuracyScore,
                0
            );

        const agreement =
            this.safeNumber(
                profile.agreementScore,
                0
            );

        if (
            cycles < 10
        ) {

            value =
                Math.min(
                    value,
                    0.95
                );

        }

        if (
            cycles >= 10 &&
            accuracy >= 75 &&
            agreement >= 70
        ) {

            value *=
                1.04;

        }

        if (
            accuracy < 50
        ) {

            value *=
                0.90;

        }

        if (
            sourceReport
                ?.classification ===
                "EXCELLENT"
        ) {

            value *=
                1.02;

        }

        return this.clamp(

            value,

            0.65,

            1.25

        );

    },

    /* =====================================================
       SOURCE PROTECTION RULES
       ===================================================== */

    applySourceProtectionRules(
        weights = {},
        sourceReports = {}
    ) {

        const protectedWeights = {

            ...weights

        };

        const officialWeight =
            this.safeNumber(
                protectedWeights.official,
                0
            );

        const radarWeight =
            this.safeNumber(
                protectedWeights.radar,
                0
            );

        const satelliteWeight =
            this.safeNumber(
                protectedWeights.satellite,
                0
            );

        const lightningWeight =
            this.safeNumber(
                protectedWeights.lightning,
                0
            );

        const openMeteoWeight =
            this.safeNumber(
                protectedWeights.openMeteo,
                0
            );

        const localModelWeight =
            this.safeNumber(
                protectedWeights.localModel,
                0
            );

        protectedWeights.official =
            this.clamp(

                officialWeight,

                0.18,

                0.38

            );

        protectedWeights.radar =
            this.clamp(

                radarWeight,

                0.16,

                0.34

            );

        protectedWeights.satellite =
            this.clamp(

                satelliteWeight,

                0.10,

                0.26

            );

        protectedWeights.lightning =
            this.clamp(

                lightningWeight,

                0.05,

                0.22

            );

        protectedWeights.openMeteo =
            this.clamp(

                openMeteoWeight,

                0.07,

                0.22

            );

        protectedWeights.localModel =
            this.clamp(

                localModelWeight,

                0.04,

                0.20

            );

        const officialUnavailable =

            sourceReports
                ?.official
                ?.classification ===
            "UNAVAILABLE";

        if (
            officialUnavailable
        ) {

            protectedWeights.official =
                Math.max(

                    protectedWeights.official,

                    0.20

                );

        }

        const lightningSimulationRatio =
            this.safeNumber(

                sourceReports
                    ?.lightning
                    ?.simulationRatio,

                0

            );

        if (
            lightningSimulationRatio >= 50
        ) {

            protectedWeights.lightning =
                Math.min(

                    protectedWeights.lightning,

                    0.10

                );

        }

        const localModelCycles =
            this.safeNumber(

                this.sourceProfiles
                    ?.localModel
                    ?.learningCycles,

                0

            );

        if (
            localModelCycles < 10
        ) {

            protectedWeights.localModel =
                Math.min(

                    protectedWeights.localModel,

                    0.10

                );

        }

        return protectedWeights;

    },

    /* =====================================================
       NORMALIZE LEARNED WEIGHTS
       ===================================================== */

    normalizeLearnedWeights(
        weights = {}
    ) {

        const validEntries =
            Object.entries(
                weights
            )
            .filter(
                (
                    [
                        ,
                        value
                    ]
                ) => {

                    return (

                        Number.isFinite(
                            Number(
                                value
                            )
                        ) &&

                        Number(
                            value
                        ) >
                        0

                    );

                }
            );

        const total =
            validEntries.reduce(

                (
                    sum,
                    [
                        ,
                        value
                    ]
                ) =>

                    sum +

                    Number(
                        value
                    ),

                0

            );

        if (
            total <= 0
        ) {

            return {

                official:
                    0.28,

                radar:
                    0.22,

                satellite:
                    0.16,

                lightning:
                    0.12,

                openMeteo:
                    0.14,

                localModel:
                    0.08

            };

        }

        const normalized =
            {};

        validEntries
            .forEach(
                (
                    [
                        sourceKey,
                        value
                    ]
                ) => {

                    normalized[
                        sourceKey
                    ] =
                        Number(

                            (
                                Number(
                                    value
                                ) /
                                total
                            )
                            .toFixed(
                                6
                            )

                        );

                }
            );

        return this.correctNormalizationRemainder(
            normalized
        );

    },

    /* =====================================================
       CORRECT NORMALIZATION REMAINDER
       ===================================================== */

    correctNormalizationRemainder(
        weights = {}
    ) {

        const entries =
            Object.entries(
                weights
            );

        if (
            !entries.length
        ) {

            return {};

        }

        const total =
            entries.reduce(

                (
                    sum,
                    [
                        ,
                        value
                    ]
                ) =>

                    sum +

                    this.safeNumber(
                        value,
                        0
                    ),

                0

            );

        const difference =
            Number(
                (
                    1 -
                    total
                )
                .toFixed(
                    6
                )
            );

        if (
            Math.abs(
                difference
            ) <
            0.000001
        ) {

            return weights;

        }

        const strongestSource =
            entries
                .sort(
                    (
                        first,
                        second
                    ) =>

                        this.safeNumber(
                            second[1],
                            0
                        ) -

                        this.safeNumber(
                            first[1],
                            0
                        )
                )[0][0];

        weights[
            strongestSource
        ] =
            Number(

                (
                    this.safeNumber(
                        weights[
                            strongestSource
                        ],
                        0
                    ) +

                    difference
                )
                .toFixed(
                    6
                )

            );

        return weights;

    },

    /* =====================================================
       PUBLISH WEIGHT UPDATE
       ===================================================== */

    publishWeightUpdate({

        rawWeights = {},

        protectedWeights = {},

        normalizedWeights = {},

        sourceReports = {}

    } = {}) {

        const detail = {

            cycleNumber:
                this.cycleNumber,

            rawWeights,

            protectedWeights,

            normalizedWeights,

            sourceReports,

            profiles:
                this.getProfilesSnapshot(),

            timestamp:
                this.lastLearningAt,

            version:
                this.version

        };

        window.dispatchEvent(

            new CustomEvent(

                "rg31:adaptive-weights-updated",

                {
                    detail
                }

            )

        );

        window.dispatchEvent(

            new CustomEvent(

                "rg30:adaptive-weights-updated",

                {
                    detail
                }

            )

        );

        window.dispatchEvent(

            new CustomEvent(

                "rg31:verification-weight-refresh",

                {
                    detail: {

                        weights:
                            normalizedWeights,

                        cycleNumber:
                            this.cycleNumber,

                        timestamp:
                            this.lastLearningAt

                    }
                }

            )

        );

    },

    /* =====================================================
       PROFILES SNAPSHOT
       ===================================================== */

    getProfilesSnapshot() {

        const snapshot =
            {};

        Object.entries(
            this.sourceProfiles
        )
        .forEach(
            (
                [
                    sourceKey,
                    profile
                ]
            ) => {

                snapshot[
                    sourceKey
                ] = {

                    sourceKey,

                    multiplier:
                        this.safeNumber(
                            profile.multiplier,
                            1
                        ),

                    trustScore:
                        this.safeNumber(
                            profile.trustScore,
                            0
                        ),

                    accuracyScore:
                        this.safeNumber(
                            profile.accuracyScore,
                            0
                        ),

                    agreementScore:
                        this.safeNumber(
                            profile.agreementScore,
                            0
                        ),

                    dataQualityScore:
                        this.safeNumber(
                            profile.dataQualityScore,
                            0
                        ),

                    confidenceScore:
                        this.safeNumber(
                            profile.confidenceScore,
                            0
                        ),

                    freshnessScore:
                        this.safeNumber(
                            profile.freshnessScore,
                            0
                        ),

                    conflictScore:
                        this.safeNumber(
                            profile.conflictScore,
                            0
                        ),

                    learningCycles:
                        this.safeNumber(
                            profile.learningCycles,
                            0
                        ),

                    successCount:
                        this.safeNumber(
                            profile.successCount,
                            0
                        ),

                    failureCount:
                        this.safeNumber(
                            profile.failureCount,
                            0
                        ),

                    lastAdjustment:
                        this.safeNumber(
                            profile.lastAdjustment,
                            0
                        ),

                    lastUpdatedAt:
                        profile.lastUpdatedAt ||
                        null

                };

            }
        );

        return snapshot;

    },
      /* =====================================================
       SAVE STATE
       ===================================================== */

    saveState() {

        try {

            const state = {

                version:
                    this.version,

                cycleNumber:
                    this.cycleNumber,

                lastLearningAt:
                    this.lastLearningAt,

                sourceProfiles:
                    this.sourceProfiles,

                latestLearningReport:
                    this.latestLearningReport,

                savedAt:
                    new Date()
                        .toISOString()

            };

            localStorage.setItem(

                this.storageKey,

                JSON.stringify(
                    state
                )

            );

            localStorage.setItem(

                this.historyStorageKey,

                JSON.stringify(
                    this.learningHistory
                )

            );

            return true;

        } catch (error) {

            console.warn(
                "Adaptive Learning state save failed:",
                error
            );

            return false;

        }

    },

    /* =====================================================
       LOAD STATE
       ===================================================== */

    loadState() {

        try {

            const savedState =
                localStorage.getItem(
                    this.storageKey
                );

            const savedHistory =
                localStorage.getItem(
                    this.historyStorageKey
                );

            if (
                savedState
            ) {

                const parsed =
                    JSON.parse(
                        savedState
                    );

                if (
                    parsed &&
                    typeof parsed ===
                        "object"
                ) {

                    this.cycleNumber =
                        this.safeNumber(
                            parsed.cycleNumber,
                            0
                        );

                    this.lastLearningAt =
                        parsed.lastLearningAt ||
                        null;

                    this.sourceProfiles =
                        parsed.sourceProfiles &&
                        typeof parsed.sourceProfiles ===
                            "object"
                            ? parsed.sourceProfiles
                            : {};

                    this.latestLearningReport =
                        parsed.latestLearningReport ||
                        null;

                }

            }

            if (
                savedHistory
            ) {

                const parsedHistory =
                    JSON.parse(
                        savedHistory
                    );

                this.learningHistory =
                    Array.isArray(
                        parsedHistory
                    )
                        ? parsedHistory.slice(
                            0,
                            this.config.maximumHistory
                        )
                        : [];

            }

            return true;

        } catch (error) {

            console.warn(
                "Adaptive Learning state load failed:",
                error
            );

            this.sourceProfiles =
                {};

            this.learningHistory =
                [];

            return false;

        }

    },

    /* =====================================================
       PUBLISH LEARNING REPORT
       ===================================================== */

    publishLearningReport(
        report
    ) {

        if (
            !report
        ) {

            return;

        }

        window.RG31.latestAdaptiveLearningReport =
            report;

        window.RG30.latestAdaptiveLearningReport =
            report;

        window.RG31.AdaptiveLearningProfiles =
            this.getProfilesSnapshot();

        window.RG30.AdaptiveLearningProfiles =
            this.getProfilesSnapshot();

        window.dispatchEvent(

            new CustomEvent(

                "rg31:adaptive-learning-completed",

                {
                    detail: {

                        report,

                        profiles:
                            this.getProfilesSnapshot(),

                        learnedWeights:
                            this.getLearnedWeights(),

                        timestamp:
                            this.lastLearningAt,

                        version:
                            this.version

                    }
                }

            )

        );

        window.dispatchEvent(

            new CustomEvent(

                "rg30:adaptive-learning-completed",

                {
                    detail: {

                        report,

                        profiles:
                            this.getProfilesSnapshot(),

                        learnedWeights:
                            this.getLearnedWeights(),

                        timestamp:
                            this.lastLearningAt,

                        version:
                            this.version

                    }
                }

            )

        );

        this.renderAdaptiveLearningPanel(
            report
        );

    },

    /* =====================================================
       GET SOURCE PROFILE
       ===================================================== */

    getSourceProfile(
        sourceKey
    ) {

        const key =
            String(
                sourceKey || ""
            )
                .trim();

        if (
            !key
        ) {

            return null;

        }

        const profile =
            this.sourceProfiles[
                key
            ];

        if (
            !profile
        ) {

            return null;

        }

        return {

            ...profile,

            history:
                Array.isArray(
                    profile.history
                )
                    ? [
                        ...profile.history
                    ]
                    : []

        };

    },

    /* =====================================================
       GET LEARNED WEIGHTS
       ===================================================== */

    getLearnedWeights() {

        const verificationEngine =
            window.RG31
                ?.VerificationEngine ||
            window.RG30
                ?.VerificationEngine;

        const engineWeights =
            verificationEngine
                ?.config
                ?.baseSourceWeights;

        if (
            engineWeights &&
            typeof engineWeights ===
                "object"
        ) {

            return {

                ...engineWeights

            };

        }

        const fallbackWeights =
            {};

        const defaultWeights = {

            official:
                0.28,

            radar:
                0.22,

            satellite:
                0.16,

            lightning:
                0.12,

            openMeteo:
                0.14,

            localModel:
                0.08

        };

        Object.entries(
            defaultWeights
        )
        .forEach(
            (
                [
                    sourceKey,
                    baseWeight
                ]
            ) => {

                const multiplier =
                    this.safeNumber(

                        this.sourceProfiles[
                            sourceKey
                        ]
                        ?.multiplier,

                        1

                    );

                fallbackWeights[
                    sourceKey
                ] =
                    baseWeight *
                    multiplier;

            }
        );

        return this.normalizeLearnedWeights(
            fallbackWeights
        );

    },

    /* =====================================================
       LEARNING STATE
       ===================================================== */

    getLearningState() {

        return {

            version:
                this.version,

            initialized:
                this.initialized,

            enabled:
                this.config.enabled,

            automaticLearning:
                this.config
                    .automaticLearning,

            learningInProgress:
                this.learningInProgress,

            cycleNumber:
                this.cycleNumber,

            lastLearningAt:
                this.lastLearningAt,

            sourceCount:
                Object.keys(
                    this.sourceProfiles
                )
                .length,

            historyCount:
                this.learningHistory.length,

            learnedWeights:
                this.getLearnedWeights(),

            profiles:
                this.getProfilesSnapshot(),

            latestLearningReport:
                this.latestLearningReport

        };

    },

    /* =====================================================
       DEBUG SNAPSHOT
       ===================================================== */

    getDebugSnapshot() {

        return {

            engine:
                "AdaptiveLearningEngine",

            version:
                this.version,

            config:
                this.config,

            state:
                this.getLearningState(),

            sourceProfiles:
                this.sourceProfiles,

            learningHistory:
                this.learningHistory,

            latestLearningReport:
                this.latestLearningReport,

            timestamp:
                new Date()
                    .toISOString()

        };

    },

    /* =====================================================
       ADAPTIVE LEARNING PANEL
       ===================================================== */

    renderAdaptiveLearningPanel(
        report =
            this.latestLearningReport
    ) {

        const panel =
            document.getElementById(
                "adaptiveLearningPanel"
            );

        if (
            !panel
        ) {

            return;

        }

        if (
            !report
        ) {

            panel.innerHTML = `

                <div class="item info">

                    ${this.text(

                        "No adaptive learning report is available yet.",

                        "لا يتوفر تقرير للتعلم التكيفي حتى الآن."

                    )}

                </div>

            `;

            return;

        }

        const sourceRows =
            Object.entries(
                report.sourceReports ||
                {}
            )
            .map(
                (
                    [
                        sourceKey,
                        sourceReport
                    ]
                ) => {

                    const profile =
                        sourceReport.profile ||
                        this.sourceProfiles[
                            sourceKey
                        ] ||
                        {};

                    const classification =
                        sourceReport.classification ||
                        "UNKNOWN";

                    const className =
                        this.getPerformanceClass(
                            classification
                        );

                    return `

                        <div class="item ${className}">

                            <h3>

                                ${this.escapeHtml(

                                    this.getSourceLabel(
                                        sourceKey
                                    )

                                )}

                            </h3>

                            <b>

                                ${this.text(
                                    "Performance",
                                    "الأداء"
                                )}:

                            </b>

                            ${this.getPerformanceLabel(
                                classification
                            )}

                            <br>

                            <b>

                                ${this.text(
                                    "Performance Score",
                                    "درجة الأداء"
                                )}:

                            </b>

                            ${this.safeNumber(
                                sourceReport.performanceScore,
                                0
                            )}%

                            <br>

                            <b>

                                ${this.text(
                                    "Accuracy",
                                    "الدقة"
                                )}:

                            </b>

                            ${this.safeNumber(
                                sourceReport.averageAccuracy,
                                0
                            )}%

                            <br>

                            <b>

                                ${this.text(
                                    "Agreement",
                                    "الاتفاق"
                                )}:

                            </b>

                            ${this.safeNumber(
                                sourceReport.averageAgreement,
                                0
                            )}%

                            <br>

                            <b>

                                ${this.text(
                                    "Data Quality",
                                    "جودة البيانات"
                                )}:

                            </b>

                            ${this.safeNumber(
                                sourceReport.averageDataQuality,
                                0
                            )}%

                            <br>

                            <b>

                                ${this.text(
                                    "Confidence",
                                    "الثقة"
                                )}:

                            </b>

                            ${this.safeNumber(
                                sourceReport.averageConfidence,
                                0
                            )}%

                            <br>

                            <b>

                                ${this.text(
                                    "Freshness",
                                    "الحداثة"
                                )}:

                            </b>

                            ${this.safeNumber(
                                sourceReport.averageFreshness,
                                0
                            )}%

                            <br>

                            <b>

                                ${this.text(
                                    "Conflicts",
                                    "التعارضات"
                                )}:

                            </b>

                            ${this.safeNumber(
                                sourceReport.conflictCount,
                                0
                            )}

                            <br>

                            <b>

                                ${this.text(
                                    "Simulation Ratio",
                                    "نسبة المحاكاة"
                                )}:

                            </b>

                            ${this.safeNumber(
                                sourceReport.simulationRatio,
                                0
                            )}%

                            <br><br>

                            <b>

                                ${this.text(
                                    "Adaptive Multiplier",
                                    "معامل التعلم التكيفي"
                                )}:

                            </b>

                            ${Number(
                                this.safeNumber(
                                    profile.multiplier,
                                    1
                                )
                            )
                            .toFixed(
                                4
                            )}

                            <br>

                            <b>

                                ${this.text(
                                    "Last Adjustment",
                                    "آخر تعديل"
                                )}:

                            </b>

                            ${Number(
                                this.safeNumber(
                                    profile.lastAdjustment,
                                    0
                                )
                            )
                            .toFixed(
                                4
                            )}

                            <br>

                            <b>

                                ${this.text(
                                    "Trust Score",
                                    "درجة الثقة بالمصدر"
                                )}:

                            </b>

                            ${this.safeNumber(
                                profile.trustScore,
                                0
                            )}%

                            <br>

                            <b>

                                ${this.text(
                                    "Learning Cycles",
                                    "دورات التعلم"
                                )}:

                            </b>

                            ${this.safeNumber(
                                profile.learningCycles,
                                0
                            )}

                        </div>

                    `;

                }
            )
            .join("");

        const learnedWeights =
            this.getLearnedWeights();

        const weightRows =
            Object.entries(
                learnedWeights
            )
            .sort(
                (
                    first,
                    second
                ) =>
                    second[1] -
                    first[1]
            )
            .map(
                (
                    [
                        sourceKey,
                        weight
                    ]
                ) => `

                    <div class="verification-source-row">

                        <b>

                            ${this.escapeHtml(
                                this.getSourceLabel(
                                    sourceKey
                                )
                            )}:

                        </b>

                        ${Number(
                            this.safeNumber(
                                weight,
                                0
                            ) *
                            100
                        )
                        .toFixed(
                            2
                        )}%

                    </div>

                `
            )
            .join("");

        panel.innerHTML = `

            <div class="item info">

                <h3>

                    ${this.text(

                        "Adaptive Learning Summary V31",

                        "ملخص التعلم التكيفي V31"

                    )}

                </h3>

                <b>

                    ${this.text(
                        "Learning Cycle",
                        "دورة التعلم"
                    )}:

                </b>

                ${this.safeNumber(
                    report.cycleNumber,
                    0
                )}

                <br>

                <b>

                    ${this.text(
                        "Cities Analyzed",
                        "المدن المحللة"
                    )}:

                </b>

                ${this.safeNumber(
                    report.citiesAnalyzed,
                    0
                )}

                <br>

                <b>

                    ${this.text(
                        "Sources Analyzed",
                        "المصادر المحللة"
                    )}:

                </b>

                ${this.safeNumber(
                    report.sourcesAnalyzed,
                    0
                )}

                <br>

                <b>

                    ${this.text(
                        "National Confidence",
                        "الثقة الوطنية"
                    )}:

                </b>

                ${this.safeNumber(
                    report.nationalConfidence,
                    0
                )}%

                <br>

                <b>

                    ${this.text(
                        "Average Data Quality",
                        "متوسط جودة البيانات"
                    )}:

                </b>

                ${this.safeNumber(
                    report.averageDataQuality,
                    0
                )}%

                <br>

                <b>

                    ${this.text(
                        "Duration",
                        "مدة التعلم"
                    )}:

                </b>

                ${this.safeNumber(
                    report.durationMs,
                    0
                )} ms

            </div>

            <div class="item info">

                <h3>

                    ${this.text(
                        "Current Learned Weights",
                        "الأوزان المتعلمة الحالية"
                    )}

                </h3>

                ${weightRows}

            </div>

            ${sourceRows}

        `;

    },

    /* =====================================================
       PERFORMANCE CSS CLASS
       ===================================================== */

    getPerformanceClass(
        classification
    ) {

        const value =
            String(
                classification || ""
            )
                .trim()
                .toUpperCase();

        if (
            value ===
                "EXCELLENT" ||
            value ===
                "GOOD"
        ) {

            return "success";

        }

        if (
            value ===
            "ACCEPTABLE"
        ) {

            return "info";

        }

        if (
            value ===
                "WEAK" ||
            value ===
                "UNAVAILABLE"
        ) {

            return "warning";

        }

        return "danger";

    },

    /* =====================================================
       PERFORMANCE LABEL
       ===================================================== */

    getPerformanceLabel(
        classification
    ) {

        const value =
            String(
                classification ||
                "UNKNOWN"
            )
                .trim()
                .toUpperCase();

        const labels = {

            EXCELLENT: {

                en:
                    "Excellent",

                ar:
                    "ممتاز"

            },

            GOOD: {

                en:
                    "Good",

                ar:
                    "جيد"

            },

            ACCEPTABLE: {

                en:
                    "Acceptable",

                ar:
                    "مقبول"

            },

            WEAK: {

                en:
                    "Weak",

                ar:
                    "ضعيف"

            },

            POOR: {

                en:
                    "Poor",

                ar:
                    "ضعيف جدًا"

            },

            UNAVAILABLE: {

                en:
                    "Unavailable",

                ar:
                    "غير متاح"

            },

            UNKNOWN: {

                en:
                    "Unknown",

                ar:
                    "غير معروف"

            }

        };

        const item =
            labels[value] ||
            labels.UNKNOWN;

        return this.isArabic()
            ? item.ar
            : item.en;

    },

    /* =====================================================
       SOURCE LABEL
       ===================================================== */

    getSourceLabel(
        sourceKey
    ) {

        const labels = {

            official: {

                en:
                    "Official National Source",

                ar:
                    "المصدر الوطني الرسمي"

            },

            radar: {

                en:
                    "Weather Radar",

                ar:
                    "رادار الطقس"

            },

            satellite: {

                en:
                    "Satellite",

                ar:
                    "الأقمار الصناعية"

            },

            lightning: {

                en:
                    "Lightning Detection",

                ar:
                    "رصد البرق"

            },

            openMeteo: {

                en:
                    "Open-Meteo",

                ar:
                    "Open-Meteo"

            },

            localModel: {

                en:
                    "RainGuard Local AI",

                ar:
                    "ذكاء RainGuard المحلي"

            }

        };

        const item =
            labels[
                sourceKey
            ];

        if (
            !item
        ) {

            return String(
                sourceKey || ""
            );

        }

        return this.isArabic()
            ? item.ar
            : item.en;

    },
      /* =====================================================
       LANGUAGE HELPERS
       ===================================================== */

    isArabic() {

        return (

            window.RG31
                ?.I18n
                ?.language ===
                "ar" ||

            window.RG30
                ?.I18n
                ?.language ===
                "ar"

        );

    },

    text(
        english,
        arabic
    ) {

        return this.isArabic()
            ? arabic
            : english;

    },

    /* =====================================================
       NUMERIC HELPERS
       ===================================================== */

    safeNumber(
        value,
        fallback = 0
    ) {

        const number =
            Number(
                value
            );

        return Number.isFinite(
            number
        )
            ? number
            : fallback;

    },

    clamp(
        value,
        min = 0,
        max = 100
    ) {

        const number =
            this.safeNumber(
                value,
                min
            );

        return Math.min(

            max,

            Math.max(
                min,
                number
            )

        );

    },

    /* =====================================================
       HTML SAFETY
       ===================================================== */

    escapeHtml(
        value
    ) {

        return String(
            value ?? ""
        )
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );

    },

    /* =====================================================
       RESET LEARNING
       ===================================================== */

    reset() {

        this.learningInProgress =
            false;

        this.cycleNumber =
            0;

        this.lastLearningAt =
            null;

        this.latestLearningReport =
            null;

        this.sourceProfiles =
            {};

        this.learningHistory =
            [];

        this.ensureSourceProfiles();

        try {

            localStorage.removeItem(
                this.storageKey
            );

            localStorage.removeItem(
                this.historyStorageKey
            );

        } catch (error) {

            console.warn(
                "Adaptive Learning storage reset skipped:",
                error
            );

        }

        const verificationEngine =
            window.RG31
                ?.VerificationEngine ||
            window.RG30
                ?.VerificationEngine;

        if (
            verificationEngine
                ?.config
        ) {

            verificationEngine
                .config
                .baseSourceWeights = {

                    official:
                        0.28,

                    radar:
                        0.22,

                    satellite:
                        0.16,

                    lightning:
                        0.12,

                    openMeteo:
                        0.14,

                    localModel:
                        0.08

                };

            verificationEngine
                .config
                .sourceWeights = {

                    ...verificationEngine
                        .config
                        .baseSourceWeights

                };

            verificationEngine
                .previousDynamicWeights =
                {};

            verificationEngine
                .adaptiveLearningState =
                null;

        }

        window.RG31.AdaptiveSourceWeights =
            null;

        window.RG30.AdaptiveSourceWeights =
            null;

        this.saveState();

        this.renderAdaptiveLearningPanel(
            null
        );

        this.writeLog(
            "Adaptive Learning Engine V31 reset.",
            "warning"
        );

        window.dispatchEvent(

            new CustomEvent(

                "rg31:adaptive-learning-reset",

                {
                    detail: {

                        version:
                            this.version,

                        timestamp:
                            new Date()
                                .toISOString()

                    }
                }

            )

        );

        return true;

    },

    /* =====================================================
       CLEAR HISTORY ONLY
       ===================================================== */

    clearHistory() {

        this.learningHistory =
            [];

        Object.values(
            this.sourceProfiles
        )
        .forEach(
            profile => {

                profile.history =
                    [];

            }
        );

        this.saveState();

        this.writeLog(
            "Adaptive learning history cleared.",
            "warning"
        );

        return true;

    },

    /* =====================================================
       EXPORT LEARNING STATE
       ===================================================== */

    exportState() {

        const payload = {

            version:
                this.version,

            cycleNumber:
                this.cycleNumber,

            lastLearningAt:
                this.lastLearningAt,

            sourceProfiles:
                this.sourceProfiles,

            learningHistory:
                this.learningHistory,

            learnedWeights:
                this.getLearnedWeights(),

            latestLearningReport:
                this.latestLearningReport,

            exportedAt:
                new Date()
                    .toISOString()

        };

        return JSON.stringify(
            payload,
            null,
            2
        );

    },

    /* =====================================================
       DOWNLOAD EXPORTED STATE
       ===================================================== */

    downloadState() {

        try {

            const json =
                this.exportState();

            const blob =
                new Blob(
                    [json],
                    {
                        type:
                            "application/json"
                    }
                );

            const url =
                URL.createObjectURL(
                    blob
                );

            const anchor =
                document.createElement(
                    "a"
                );

            anchor.href =
                url;

            anchor.download =
                `rainguard-v31-adaptive-learning-${Date.now()}.json`;

            document.body
                .appendChild(
                    anchor
                );

            anchor.click();

            anchor.remove();

            URL.revokeObjectURL(
                url
            );

            return true;

        } catch (error) {

            console.error(
                "Adaptive Learning state export failed:",
                error
            );

            return false;

        }

    },

    /* =====================================================
       IMPORT LEARNING STATE
       ===================================================== */

    importState(
        payload
    ) {

        try {

            let parsed =
                payload;

            if (
                typeof payload ===
                "string"
            ) {

                parsed =
                    JSON.parse(
                        payload
                    );

            }

            if (
                !parsed ||
                typeof parsed !==
                    "object"
            ) {

                throw new Error(
                    "INVALID_ADAPTIVE_LEARNING_STATE"
                );

            }

            if (
                parsed.sourceProfiles &&
                typeof parsed.sourceProfiles ===
                    "object"
            ) {

                this.sourceProfiles =
                    parsed.sourceProfiles;

            }

            if (
                Array.isArray(
                    parsed.learningHistory
                )
            ) {

                this.learningHistory =
                    parsed.learningHistory
                        .slice(
                            0,
                            this.config
                                .maximumHistory
                        );

            }

            this.cycleNumber =
                this.safeNumber(
                    parsed.cycleNumber,
                    this.cycleNumber
                );

            this.lastLearningAt =
                parsed.lastLearningAt ||
                this.lastLearningAt;

            this.latestLearningReport =
                parsed.latestLearningReport ||
                this.latestLearningReport;

            this.ensureSourceProfiles();

            this.saveState();

            this.applyLearningToVerificationEngine(
                this.latestLearningReport
                    ?.sourceReports ||
                {}
            );

            this.renderAdaptiveLearningPanel(
                this.latestLearningReport
            );

            this.writeLog(
                "Adaptive Learning state imported successfully."
            );

            window.dispatchEvent(

                new CustomEvent(

                    "rg31:adaptive-learning-state-imported",

                    {
                        detail: {

                            cycleNumber:
                                this.cycleNumber,

                            profiles:
                                this.getProfilesSnapshot(),

                            learnedWeights:
                                this.getLearnedWeights(),

                            timestamp:
                                new Date()
                                    .toISOString()

                        }
                    }

                )

            );

            return true;

        } catch (error) {

            console.error(
                "Adaptive Learning state import failed:",
                error
            );

            this.writeLog(
                `Adaptive learning import failed: ${error?.message || String(error)}`,
                "danger"
            );

            return false;

        }

    },

    /* =====================================================
       MANUAL LEARNING
       ===================================================== */

    async runManualLearning(
        results = null,
        summary = null
    ) {

        const verificationEngine =
            window.RG31
                ?.VerificationEngine ||
            window.RG30
                ?.VerificationEngine;

        const sourceResults =
            Array.isArray(
                results
            )
                ? results
                : verificationEngine
                    ?.latestVerification ||
                [];

        const sourceSummary =
            summary ||
            verificationEngine
                ?.latestNationalSummary ||
            null;

        return this.learnFromVerification(

            sourceResults,

            sourceSummary

        );

    },

    /* =====================================================
       REAPPLY CURRENT PROFILES
       ===================================================== */

    reapplyLearning() {

        return this.applyLearningToVerificationEngine(

            this.latestLearningReport
                ?.sourceReports ||
            {}

        );

    },

    /* =====================================================
       SET AUTOMATIC LEARNING
       ===================================================== */

    setAutomaticLearning(
        enabled
    ) {

        this.config
            .automaticLearning =
            enabled ===
            true;

        this.saveState();

        this.writeLog(

            this.config
                .automaticLearning

                ? "Automatic adaptive learning enabled."

                : "Automatic adaptive learning disabled.",

            this.config
                .automaticLearning
                ? "success"
                : "warning"

        );

        return this.config
            .automaticLearning;

    },

    /* =====================================================
       SET ENGINE ENABLED
       ===================================================== */

    setEnabled(
        enabled
    ) {

        this.config.enabled =
            enabled ===
            true;

        this.saveState();

        return this.config.enabled;

    },

    /* =====================================================
       LOGGING
       ===================================================== */

    writeLog(
        message,
        type = "success"
    ) {

        const prefix =
            "[RainGuard V31 Adaptive Learning]";

        if (
            type ===
            "danger"
        ) {

            console.error(
                prefix,
                message
            );

        } else if (
            type ===
            "warning"
        ) {

            console.warn(
                prefix,
                message
            );

        } else {

            console.log(
                prefix,
                message
            );

        }

        if (
            window.RG23
                ?.Brain
                ?.writeCommander
        ) {

            try {

                window.RG23
                    .Brain
                    .writeCommander(
                        message,
                        type
                    );

            } catch (error) {

                console.warn(
                    "Adaptive Learning commander log skipped:",
                    error
                );

            }

        }

    },

    /* =====================================================
       COMPATIBILITY ALIASES
       ===================================================== */

    registerCompatibilityAliases() {

        window.RG31.AdaptiveLearningEngine =
            this;

        window.RG30.AdaptiveLearningEngine =
            this;

        window.RG31.AdaptiveLearning =
            this;

        window.RG30.AdaptiveLearning =
            this;

        return true;

    },

    /* =====================================================
       DESTROY
       ===================================================== */

    destroy() {

        this.learningInProgress =
            false;

        this.initialized =
            false;

        this.writeLog(
            "Adaptive Learning Engine V31 destroyed.",
            "warning"
        );

        window.dispatchEvent(

            new CustomEvent(

                "rg31:adaptive-learning-destroyed",

                {
                    detail: {

                        version:
                            this.version,

                        timestamp:
                            new Date()
                                .toISOString()

                    }
                }

            )

        );

    }

};

/* =========================================================
   V30 COMPATIBILITY
   ========================================================= */

window.RG30.AdaptiveLearningEngine =
    window.RG31.AdaptiveLearningEngine;

window.RG30.AdaptiveLearning =
    window.RG31.AdaptiveLearningEngine;

/* =========================================================
   GLOBAL SHORTCUTS
   ========================================================= */

window.runAdaptiveLearningV31 =
    function (
        results,
        summary
    ) {

        return window.RG31
            .AdaptiveLearningEngine
            .runManualLearning(
                results,
                summary
            );

    };

window.getAdaptiveLearningStateV31 =
    function () {

        return window.RG31
            .AdaptiveLearningEngine
            .getLearningState();

    };

window.getAdaptiveLearningDebugV31 =
    function () {

        return window.RG31
            .AdaptiveLearningEngine
            .getDebugSnapshot();

    };

window.getAdaptiveLearningProfilesV31 =
    function () {

        return window.RG31
            .AdaptiveLearningEngine
            .getProfilesSnapshot();

    };

window.getAdaptiveSourceProfileV31 =
    function (
        sourceKey
    ) {

        return window.RG31
            .AdaptiveLearningEngine
            .getSourceProfile(
                sourceKey
            );

    };

window.getLearnedWeightsV31 =
    function () {

        return window.RG31
            .AdaptiveLearningEngine
            .getLearnedWeights();

    };

window.reapplyAdaptiveLearningV31 =
    function () {

        return window.RG31
            .AdaptiveLearningEngine
            .reapplyLearning();

    };

window.enableAdaptiveLearningV31 =
    function () {

        return window.RG31
            .AdaptiveLearningEngine
            .setAutomaticLearning(
                true
            );

    };

window.disableAdaptiveLearningV31 =
    function () {

        return window.RG31
            .AdaptiveLearningEngine
            .setAutomaticLearning(
                false
            );

    };

window.resetAdaptiveLearningV31 =
    function () {

        return window.RG31
            .AdaptiveLearningEngine
            .reset();

    };

window.clearAdaptiveLearningHistoryV31 =
    function () {

        return window.RG31
            .AdaptiveLearningEngine
            .clearHistory();

    };

window.exportAdaptiveLearningV31 =
    function () {

        return window.RG31
            .AdaptiveLearningEngine
            .exportState();

    };

window.downloadAdaptiveLearningV31 =
    function () {

        return window.RG31
            .AdaptiveLearningEngine
            .downloadState();

    };

window.importAdaptiveLearningV31 =
    function (
        payload
    ) {

        return window.RG31
            .AdaptiveLearningEngine
            .importState(
                payload
            );

    };

window.destroyAdaptiveLearningV31 =
    function () {

        return window.RG31
            .AdaptiveLearningEngine
            .destroy();

    };

/* =========================================================
   AUTO START
   ========================================================= */

(function initializeAdaptiveLearningV31() {

    const start =
        () => {

            try {

                const engine =
                    window.RG31
                        ?.AdaptiveLearningEngine;

                if (
                    !engine
                ) {

                    console.error(
                        "Adaptive Learning Engine V31 was not found."
                    );

                    return;

                }

                engine
                    .registerCompatibilityAliases();

                engine
                    .init();

                window.setTimeout(

                    () => {

                        try {

                            const verificationEngine =
                                window.RG31
                                    ?.VerificationEngine ||
                                window.RG30
                                    ?.VerificationEngine;

                            const results =
                                verificationEngine
                                    ?.latestVerification ||
                                [];

                            const summary =
                                verificationEngine
                                    ?.latestNationalSummary ||
                                null;

                            if (
                                Array.isArray(
                                    results
                                ) &&
                                results.length >=
                                    engine
                                        .config
                                        .minimumCities &&
                                engine
                                    .config
                                    .automaticLearning ===
                                    true &&
                                !engine
                                    .learningInProgress
                            ) {

                                engine
                                    .learnFromVerification(
                                        results,
                                        summary
                                    );

                            }

                        } catch (error) {

                            console.warn(
                                "Initial Adaptive Learning cycle skipped:",
                                error
                            );

                        }

                    },

                    5500

                );

                console.log(

                    "%cRainGuard AI V31 Adaptive Learning Engine Ready",

                    "color:#66e3ff;font-weight:bold;font-size:14px;"

                );

            } catch (error) {

                console.error(
                    "Adaptive Learning Engine V31 initialization failed:",
                    error
                );

            }

        };

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(

            "DOMContentLoaded",

            start,

            {
                once:
                    true
            }

        );

    } else {

        start();

    }

})();

/* =========================================================
   CONSOLE READY MESSAGE
   ========================================================= */

console.log(

    "%cRainGuard AI V31 Adaptive Learning Engine Loaded",

    "color:#66e3ff;font-weight:bold;font-size:14px;"

);
