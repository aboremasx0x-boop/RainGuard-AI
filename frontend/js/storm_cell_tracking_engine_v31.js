/* =========================================================
   RainGuard AI V31
   Storm Cell Tracking Engine

   File:
   frontend/js/storm_cell_tracking_engine_v31.js

   Purpose:
   - Detect storm cells from radar, satellite and lightning
   - Track current and previous cell positions
   - Estimate speed and direction
   - Detect growth, weakening and city transitions
   - Preserve tracking history
   ========================================================= */

"use strict";

window.RG31 =
    window.RG31 || {};

window.RG30 =
    window.RG30 || {};

RG31.StormCellTrackingEngine = {

    version:
        "31.0.0",

    initialized:
        false,

    trackingInProgress:
        false,

    cycleNumber:
        0,

    lastTrackingAt:
        null,

    latestTrackingReport:
        null,

    activeCells:
        {},

    archivedCells:
        {},

    cityTransitions:
        [],

    storageKey:
        "rainguard_v31_storm_cell_tracking",

    archiveStorageKey:
        "rainguard_v31_storm_cell_archive",

    transitionStorageKey:
        "rainguard_v31_storm_city_transitions",

    config: {

        enabled:
            true,

        automaticTracking:
            true,

        minimumSources:
            2,

        maximumActiveCells:
            150,

        maximumArchivedCells:
            500,

        maximumTransitions:
            500,

        maximumCellHistory:
            120,

        maximumMissedCycles:
            3,

        minimumTrackingIntervalMs:
            30000,

        /* =================================================
           CELL DETECTION
           ================================================= */

        detection: {

            minimumCompositeScore:
                35,

            minimumRadarScore:
                20,

            minimumSatelliteScore:
                25,

            minimumLightningScore:
                15,

            strongCellThreshold:
                65,

            severeCellThreshold:
                80,

            mergeDistanceKm:
                35,

            duplicateDistanceKm:
                15,

            cityAssociationRadiusKm:
                120

        },

        /* =================================================
           SOURCE WEIGHTS
           ================================================= */

        sourceWeights: {

            radar:
                0.40,

            satellite:
                0.35,

            lightning:
                0.25

        },

        /* =================================================
           TRACK MATCHING
           ================================================= */

        matching: {

            maximumDistanceKm:
                85,

            maximumTimeGapMinutes:
                90,

            distanceWeight:
                0.55,

            intensityWeight:
                0.20,

            directionWeight:
                0.15,

            cityWeight:
                0.10,

            minimumMatchScore:
                40

        },

        /* =================================================
           MOTION
           ================================================= */

        motion: {

            minimumMovementKm:
                1,

            maximumSpeedKmh:
                180,

            stationarySpeedKmh:
                5,

            slowSpeedKmh:
                20,

            moderateSpeedKmh:
                45,

            fastSpeedKmh:
                80

        },

        /* =================================================
           TREND
           ================================================= */

        trend: {

            rapidGrowthDelta:
                20,

            growthDelta:
                8,

            weakeningDelta:
                -8,

            rapidWeakeningDelta:
                -20,

            stableTolerance:
                7

        },

        /* =================================================
           CELL LIFECYCLE
           ================================================= */

        lifecycle: {

            newCellMinutes:
                20,

            matureCellMinutes:
                60,

            longLivedMinutes:
                180,

            archiveAfterMinutes:
                120,

            expireAfterMinutes:
                240

        },

        /* =================================================
           RISK
           ================================================= */

        risk: {

            low:
                25,

            moderate:
                45,

            high:
                65,

            severe:
                80

        },

        /* =================================================
           SIMULATION SAFETY
           ================================================= */

        simulation: {

            allowTracking:
                true,

            maximumConfidence:
                65,

            confidencePenalty:
                0.25,

            maximumRisk:
                75

        },

        /* =================================================
           DEBUG
           ================================================= */

        development: {

            enabled:
                true,

            logCycles:
                true,

            logDetectedCells:
                true,

            logMatches:
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

        this.bindEvents();

        this.writeLog(
            "Storm Cell Tracking Engine V31 initialized."
        );

        window.dispatchEvent(

            new CustomEvent(

                "rg31:storm-cell-tracking-ready",

                {
                    detail: {

                        version:
                            this.version,

                        activeCells:
                            this.getActiveCells(),

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
                        .automaticTracking !==
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

                this.trackFromVerification(
                    results,
                    summary
                );

            }

        );

        window.addEventListener(

            "rg30:verification-completed",

            event => {

                if (
                    this.trackingInProgress
                ) {

                    return;

                }

                if (
                    this.config
                        .automaticTracking !==
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

                this.trackFromVerification(
                    results,
                    summary
                );

            }

        );

        window.addEventListener(

            "rg31:storm-cell-reset",

            () => {

                this.reset();

            }

        );

    },

    /* =====================================================
       CELL TEMPLATE
       ===================================================== */

    createStormCell({

        cellId,

        lat,

        lon,

        city = "Unknown",

        region = "",

        intensity = 0,

        radarScore = 0,

        satelliteScore = 0,

        lightningScore = 0,

        compositeScore = 0,

        confidence = 0,

        riskScore = 0,

        riskLevel = "LOW",

        simulated = false,

        timestamp = null

    } = {}) {

        const createdAt =
            timestamp ||
            new Date()
                .toISOString();

        return {

            cellId:

                cellId ||

                this.generateCellId(),

            currentLat:
                this.safeNumber(
                    lat,
                    0
                ),

            currentLon:
                this.safeNumber(
                    lon,
                    0
                ),

            previousLat:
                null,

            previousLon:
                null,

            city,

            previousCity:
                null,

            region,

            speedKmh:
                0,

            directionDegrees:
                null,

            directionLabel:
                "STATIONARY",

            movementDistanceKm:
                0,

            intensity:
                Math.round(
                    this.clamp(
                        intensity,
                        0,
                        100
                    )
                ),

            previousIntensity:
                null,

            radarScore:
                Math.round(
                    this.clamp(
                        radarScore,
                        0,
                        100
                    )
                ),

            satelliteScore:
                Math.round(
                    this.clamp(
                        satelliteScore,
                        0,
                        100
                    )
                ),

            lightningScore:
                Math.round(
                    this.clamp(
                        lightningScore,
                        0,
                        100
                    )
                ),

            compositeScore:
                Math.round(
                    this.clamp(
                        compositeScore,
                        0,
                        100
                    )
                ),

            confidence:
                Math.round(
                    this.clamp(
                        confidence,
                        0,
                        100
                    )
                ),

            riskScore:
                Math.round(
                    this.clamp(
                        riskScore,
                        0,
                        100
                    )
                ),

            riskLevel,

            trend:
                "NEW",

            lifecycleStage:
                "NEW",

            ageMinutes:
                0,

            firstSeenAt:
                createdAt,

            lastSeenAt:
                createdAt,

            lastUpdatedAt:
                createdAt,

            missedCycles:
                0,

            trackingCycles:
                1,

            simulated:
                simulated ===
                true,

            sourceCount:
                0,

            sourceKeys:
                [],

            nearestCities:
                [],

            cityTransitionCount:
                0,

            history: [

                {

                    lat:
                        this.safeNumber(
                            lat,
                            0
                        ),

                    lon:
                        this.safeNumber(
                            lon,
                            0
                        ),

                    city,

                    intensity:
                        Math.round(
                            this.clamp(
                                intensity,
                                0,
                                100
                            )
                        ),

                    compositeScore:
                        Math.round(
                            this.clamp(
                                compositeScore,
                                0,
                                100
                            )
                        ),

                    confidence:
                        Math.round(
                            this.clamp(
                                confidence,
                                0,
                                100
                            )
                        ),

                    timestamp:
                        createdAt

                }

            ]

        };

    },

    /* =====================================================
       CELL ID
       ===================================================== */

    generateCellId() {

        const now =
            new Date();

        const datePart =

            now
                .toISOString()
                .slice(
                    0,
                    10
                )
                .replaceAll(
                    "-",
                    ""
                );

        const randomPart =
            Math.random()
                .toString(
                    36
                )
                .slice(
                    2,
                    7
                )
                .toUpperCase();

        return `CELL-${datePart}-${randomPart}`;

    },
      /* =====================================================
       MAIN TRACKING CYCLE
       ===================================================== */

    async trackFromVerification(
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
            this.trackingInProgress
        ) {

            return this.latestTrackingReport;

        }

        if (
            !Array.isArray(
                results
            ) ||
            !results.length
        ) {

            this.writeLog(
                "Storm tracking skipped because verification results are unavailable.",
                "warning"
            );

            return null;

        }

        this.trackingInProgress =
            true;

        this.cycleNumber +=
            1;

        this.lastTrackingAt =
            new Date()
                .toISOString();

        const startedAt =
            Date.now();

        try {

            const detectedCandidates =
                this.detectStormCells(
                    results
                );

            const trackingResult =
                this.processDetectedCandidates(
                    detectedCandidates
                );

            this.incrementMissedCycles(
                trackingResult.matchedCellIds
            );

            const archived =
                this.archiveExpiredCells();

            const activeCells =
                this.getActiveCells();

            const report = {

                cycleNumber:
                    this.cycleNumber,

                citiesAnalyzed:
                    results.length,

                candidatesDetected:
                    detectedCandidates.length,

                cellsCreated:
                    trackingResult.createdCells.length,

                cellsUpdated:
                    trackingResult.updatedCells.length,

                cellsMerged:
                    trackingResult.mergedCells.length,

                cellsArchived:
                    archived.length,

                activeCellCount:
                    activeCells.length,

                activeCells,

                createdCells:
                    trackingResult.createdCells,

                updatedCells:
                    trackingResult.updatedCells,

                mergedCells:
                    trackingResult.mergedCells,

                cityTransitions:
                    trackingResult.cityTransitions,

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

                durationMs:
                    Date.now() -
                    startedAt,

                timestamp:
                    this.lastTrackingAt

            };

            this.latestTrackingReport =
                report;

            this.saveState();

            this.publishTrackingReport(
                report
            );

            this.writeLog(

                `Storm tracking cycle ${this.cycleNumber} completed. Active cells: ${activeCells.length}.`

            );

            return report;

        } catch (error) {

            console.error(
                "Storm Cell Tracking cycle failed:",
                error
            );

            this.writeLog(

                `Storm tracking failed: ${error?.message || String(error)}`,

                "danger"

            );

            window.dispatchEvent(

                new CustomEvent(

                    "rg31:storm-cell-tracking-failed",

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

            this.trackingInProgress =
                false;

        }

    },

    /* =====================================================
       DETECT STORM CELLS
       ===================================================== */

    detectStormCells(
        results = []
    ) {

        const candidates =
            [];

        results.forEach(
            result => {

                const candidate =
                    this.buildCellCandidate(
                        result
                    );

                if (
                    !candidate
                ) {

                    return;

                }

                if (
                    this.isCandidateQualified(
                        candidate
                    )
                ) {

                    candidates.push(
                        candidate
                    );

                }

            }
        );

        const mergedCandidates =
            this.mergeDuplicateCandidates(
                candidates
            );

        if (
            this.config
                .development
                .logDetectedCells
        ) {

            console.log(
                "[RainGuard V31 Storm Tracking] Detected candidates:",
                mergedCandidates
            );

        }

        return mergedCandidates;

    },

    /* =====================================================
       BUILD CELL CANDIDATE
       ===================================================== */

    buildCellCandidate(
        cityResult = {}
    ) {

        const sources =
            cityResult.sources ||
            {};

        const radar =
            sources.radar ||
            {};

        const satellite =
            sources.satellite ||
            {};

        const lightning =
            sources.lightning ||
            {};

        const coordinates =
            this.extractCityCoordinates(
                cityResult
            );

        if (
            coordinates.lat ===
                null ||
            coordinates.lon ===
                null
        ) {

            return null;

        }

        const radarScore =
            this.calculateRadarCellScore(
                radar
            );

        const satelliteScore =
            this.calculateSatelliteCellScore(
                satellite
            );

        const lightningScore =
            this.calculateLightningCellScore(
                lightning
            );

        const availableSourceKeys =
            [];

        if (
            radar.available ===
            true
        ) {

            availableSourceKeys.push(
                "radar"
            );

        }

        if (
            satellite.available ===
            true
        ) {

            availableSourceKeys.push(
                "satellite"
            );

        }

        if (
            lightning.available ===
            true
        ) {

            availableSourceKeys.push(
                "lightning"
            );

        }

        const compositeScore =
            this.calculateCompositeCellScore({

                radarScore,

                satelliteScore,

                lightningScore,

                radarAvailable:
                    radar.available ===
                    true,

                satelliteAvailable:
                    satellite.available ===
                    true,

                lightningAvailable:
                    lightning.available ===
                    true

            });

        const intensity =
            this.calculateCellIntensity({

                radarScore,

                satelliteScore,

                lightningScore,

                verifiedRisk:
                    cityResult.verifiedRisk,

                rainConsensus:
                    cityResult.rainConsensus

            });

        const confidence =
            this.calculateCellConfidence({

                cityResult,

                sourceCount:
                    availableSourceKeys.length,

                radar,

                satellite,

                lightning,

                compositeScore

            });

        const riskScore =
            this.calculateCellRisk({

                compositeScore,

                intensity,

                verifiedRisk:
                    cityResult.verifiedRisk,

                lightningThreat:
                    cityResult.lightningThreat,

                confidence

            });

        const simulated =

            radar.simulated ===
                true ||

            satellite.simulated ===
                true ||

            lightning.simulated ===
                true;

        const adjustedConfidence =
            simulated
                ? Math.min(

                    confidence *
                    (
                        1 -
                        this.config
                            .simulation
                            .confidencePenalty
                    ),

                    this.config
                        .simulation
                        .maximumConfidence

                )
                : confidence;

        const adjustedRisk =
            simulated
                ? Math.min(

                    riskScore,

                    this.config
                        .simulation
                        .maximumRisk

                )
                : riskScore;

        return {

            candidateId:
                `CANDIDATE-${this.cycleNumber}-${this.generateShortId()}`,

            city:
                cityResult.city ||
                "Unknown",

            region:
                cityResult.region ||
                "",

            lat:
                coordinates.lat,

            lon:
                coordinates.lon,

            radarScore:
                Math.round(
                    radarScore
                ),

            satelliteScore:
                Math.round(
                    satelliteScore
                ),

            lightningScore:
                Math.round(
                    lightningScore
                ),

            compositeScore:
                Math.round(
                    compositeScore
                ),

            intensity:
                Math.round(
                    intensity
                ),

            confidence:
                Math.round(
                    adjustedConfidence
                ),

            riskScore:
                Math.round(
                    adjustedRisk
                ),

            riskLevel:
                this.getRiskLevel(
                    adjustedRisk
                ),

            sourceCount:
                availableSourceKeys.length,

            sourceKeys:
                availableSourceKeys,

            simulated,

            verificationStatus:
                cityResult.status ||
                "UNKNOWN",

            finalConfidence:
                this.safeNumber(
                    cityResult.finalConfidence,
                    0
                ),

            verifiedRisk:
                this.safeNumber(
                    cityResult.verifiedRisk,
                    0
                ),

            rainConsensus:
                this.safeNumber(
                    cityResult.rainConsensus,
                    0
                ),

            lightningThreat:
                this.safeNumber(
                    cityResult.lightningThreat,
                    0
                ),

            dynamicWeights:
                cityResult.dynamicWeights ||
                {},

            sourceContributions:
                cityResult.sourceContributions ||
                {},

            nearestCities:
                this.extractNearestCities(
                    cityResult
                ),

            timestamp:
                cityResult.timestamp ||
                new Date()
                    .toISOString()

        };

    },

    /* =====================================================
       EXTRACT CITY COORDINATES
       ===================================================== */

    extractCityCoordinates(
        cityResult = {}
    ) {

        const lat =
            this.firstNullableNumber(

                cityResult.lat,

                cityResult.latitude,

                cityResult.coordinates
                    ?.lat,

                cityResult.location
                    ?.lat,

                cityResult.cityData
                    ?.lat,

                cityResult.cityData
                    ?.latitude

            );

        const lon =
            this.firstNullableNumber(

                cityResult.lon,

                cityResult.lng,

                cityResult.longitude,

                cityResult.coordinates
                    ?.lon,

                cityResult.coordinates
                    ?.lng,

                cityResult.location
                    ?.lon,

                cityResult.location
                    ?.lng,

                cityResult.cityData
                    ?.lon,

                cityResult.cityData
                    ?.lng,

                cityResult.cityData
                    ?.longitude

            );

        if (
            lat !==
                null &&
            lon !==
                null
        ) {

            return {

                lat,

                lon

            };

        }

        const knownCity =
            this.getKnownCityCoordinates(
                cityResult.city
            );

        return knownCity || {

            lat:
                null,

            lon:
                null

        };

    },

    /* =====================================================
       KNOWN CITY COORDINATES
       ===================================================== */

    getKnownCityCoordinates(
        cityName
    ) {

        const key =
            String(
                cityName ||
                ""
            )
                .trim()
                .toLowerCase();

        const cities = {

            riyadh: {

                lat:
                    24.7136,

                lon:
                    46.6753

            },

            الرياض: {

                lat:
                    24.7136,

                lon:
                    46.6753

            },

            jeddah: {

                lat:
                    21.4858,

                lon:
                    39.1925

            },

            جدة: {

                lat:
                    21.4858,

                lon:
                    39.1925

            },

            makkah: {

                lat:
                    21.3891,

                lon:
                    39.8579

            },

            mecca: {

                lat:
                    21.3891,

                lon:
                    39.8579

            },

            مكة: {

                lat:
                    21.3891,

                lon:
                    39.8579

            },

            taif: {

                lat:
                    21.2703,

                lon:
                    40.4158

            },

            الطائف: {

                lat:
                    21.2703,

                lon:
                    40.4158

            },

            abha: {

                lat:
                    18.2164,

                lon:
                    42.5053

            },

            أبها: {

                lat:
                    18.2164,

                lon:
                    42.5053

            },

            abha_ar: {

                lat:
                    18.2164,

                lon:
                    42.5053

            },

            najran: {

                lat:
                    17.5656,

                lon:
                    44.2289

            },

            نجران: {

                lat:
                    17.5656,

                lon:
                    44.2289

            },

            dammam: {

                lat:
                    26.4207,

                lon:
                    50.0888

            },

            الدمام: {

                lat:
                    26.4207,

                lon:
                    50.0888

            },

            medina: {

                lat:
                    24.5247,

                lon:
                    39.5692

            },

            madinah: {

                lat:
                    24.5247,

                lon:
                    39.5692

            },

            المدينة: {

                lat:
                    24.5247,

                lon:
                    39.5692

            },

            jazan: {

                lat:
                    16.8892,

                lon:
                    42.5511

            },

            jizan: {

                lat:
                    16.8892,

                lon:
                    42.5511

            },

            جازان: {

                lat:
                    16.8892,

                lon:
                    42.5511

            },

            tabuk: {

                lat:
                    28.3838,

                lon:
                    36.5550

            },

            تبوك: {

                lat:
                    28.3838,

                lon:
                    36.5550

            },

            hail: {

                lat:
                    27.5114,

                lon:
                    41.7208

            },

            حائل: {

                lat:
                    27.5114,

                lon:
                    41.7208

            },

            qassim: {

                lat:
                    26.2078,

                lon:
                    43.4837

            },

            القصيم: {

                lat:
                    26.2078,

                lon:
                    43.4837

            },

            buraydah: {

                lat:
                    26.3592,

                lon:
                    43.9818

            },

            بريدة: {

                lat:
                    26.3592,

                lon:
                    43.9818

            }

        };

        return cities[
            key
        ] || null;

    },

    /* =====================================================
       RADAR CELL SCORE
       ===================================================== */

    calculateRadarCellScore(
        radar = {}
    ) {

        if (
            radar.available !==
            true
        ) {

            return 0;

        }

        const details =
            radar.details ||
            {};

        const signalScore =
            this.clamp(
                radar.signalScore,
                0,
                100
            );

        const intensity =
            this.clamp(
                details.intensity,
                0,
                100
            );

        const rainDetected =
            details.rainDetected ===
            true
                ? 100
                : 0;

        const movementConfidence =
            this.clamp(
                details.movementConfidence,
                0,
                100
            );

        return this.clamp(

            signalScore *
                0.45 +

            intensity *
                0.25 +

            rainDetected *
                0.20 +

            movementConfidence *
                0.10,

            0,

            100

        );

    },

    /* =====================================================
       SATELLITE CELL SCORE
       ===================================================== */

    calculateSatelliteCellScore(
        satellite = {}
    ) {

        if (
            satellite.available !==
            true
        ) {

            return 0;

        }

        const details =
            satellite.details ||
            {};

        const signalScore =
            this.clamp(
                satellite.signalScore,
                0,
                100
            );

        const convectionScore =
            this.clamp(
                details.convectionScore,
                0,
                100
            );

        const stormCellScore =
            this.clamp(
                details.stormCellScore,
                0,
                100
            );

        const cloudTemperatureScore =
            this.cloudTemperatureToScore(
                details.cloudTemperature
            );

        return this.clamp(

            signalScore *
                0.30 +

            convectionScore *
                0.30 +

            stormCellScore *
                0.25 +

            cloudTemperatureScore *
                0.15,

            0,

            100

        );

    },

    /* =====================================================
       LIGHTNING CELL SCORE
       ===================================================== */

    calculateLightningCellScore(
        lightning = {}
    ) {

        if (
            lightning.available !==
            true
        ) {

            return 0;

        }

        const details =
            lightning.details ||
            {};

        const signalScore =
            this.clamp(
                lightning.signalScore,
                0,
                100
            );

        const activityScore =
            this.clamp(
                details.activityScore,
                0,
                100
            );

        const stormThreat =
            this.clamp(
                details.stormThreat,
                0,
                100
            );

        const densityScore =
            this.clamp(

                this.safeNumber(
                    details.strikeDensity,
                    0
                ) *
                10,

                0,

                100

            );

        return this.clamp(

            signalScore *
                0.25 +

            activityScore *
                0.30 +

            stormThreat *
                0.30 +

            densityScore *
                0.15,

            0,

            100

        );

    },

    /* =====================================================
       COMPOSITE CELL SCORE
       ===================================================== */

    calculateCompositeCellScore({

        radarScore = 0,

        satelliteScore = 0,

        lightningScore = 0,

        radarAvailable = false,

        satelliteAvailable = false,

        lightningAvailable = false

    } = {}) {

        const weights =
            this.config
                .sourceWeights;

        let weightedTotal =
            0;

        let totalWeight =
            0;

        if (
            radarAvailable
        ) {

            weightedTotal +=

                radarScore *
                weights.radar;

            totalWeight +=
                weights.radar;

        }

        if (
            satelliteAvailable
        ) {

            weightedTotal +=

                satelliteScore *
                weights.satellite;

            totalWeight +=
                weights.satellite;

        }

        if (
            lightningAvailable
        ) {

            weightedTotal +=

                lightningScore *
                weights.lightning;

            totalWeight +=
                weights.lightning;

        }

        if (
            totalWeight <= 0
        ) {

            return 0;

        }

        return this.clamp(

            weightedTotal /
            totalWeight,

            0,

            100

        );

    },

    /* =====================================================
       CELL INTENSITY
       ===================================================== */

    calculateCellIntensity({

        radarScore = 0,

        satelliteScore = 0,

        lightningScore = 0,

        verifiedRisk = 0,

        rainConsensus = 0

    } = {}) {

        return this.clamp(

            radarScore *
                0.30 +

            satelliteScore *
                0.25 +

            lightningScore *
                0.20 +

            this.clamp(
                verifiedRisk,
                0,
                100
            ) *
                0.15 +

            this.clamp(
                rainConsensus,
                0,
                100
            ) *
                0.10,

            0,

            100

        );

    },

    /* =====================================================
       CELL CONFIDENCE
       ===================================================== */

    calculateCellConfidence({

        cityResult = {},

        sourceCount = 0,

        radar = {},

        satellite = {},

        lightning = {},

        compositeScore = 0

    } = {}) {

        const sourceCoverage =
            this.clamp(

                sourceCount /
                3 *
                100,

                0,

                100

            );

        const sourceConfidenceValues =
            [
                radar,
                satellite,
                lightning
            ]
            .filter(
                source =>
                    source.available ===
                    true
            )
            .map(
                source =>
                    this.clamp(
                        source.confidence,
                        0,
                        100
                    )
            );

        const averageSourceConfidence =
            sourceConfidenceValues.length
                ? sourceConfidenceValues.reduce(
                    (
                        sum,
                        value
                    ) =>
                        sum + value,
                    0
                ) /
                sourceConfidenceValues.length
                : 0;

        return this.clamp(

            this.safeNumber(
                cityResult.finalConfidence,
                0
            ) *
                0.35 +

            sourceCoverage *
                0.20 +

            averageSourceConfidence *
                0.25 +

            compositeScore *
                0.20,

            0,

            100

        );

    },

    /* =====================================================
       CELL RISK
       ===================================================== */

    calculateCellRisk({

        compositeScore = 0,

        intensity = 0,

        verifiedRisk = 0,

        lightningThreat = 0,

        confidence = 0

    } = {}) {

        const baseRisk =

            compositeScore *
                0.30 +

            intensity *
                0.25 +

            this.clamp(
                verifiedRisk,
                0,
                100
            ) *
                0.20 +

            this.clamp(
                lightningThreat,
                0,
                100
            ) *
                0.15 +

            this.clamp(
                confidence,
                0,
                100
            ) *
                0.10;

        return this.clamp(

            baseRisk,

            0,

            100

        );

    },

    /* =====================================================
       CANDIDATE QUALIFICATION
       ===================================================== */

    isCandidateQualified(
        candidate = {}
    ) {

        if (
            candidate.sourceCount <
            this.config
                .minimumSources
        ) {

            return false;

        }

        const thresholds =
            this.config
                .detection;

        if (
            candidate.compositeScore >=
            thresholds
                .minimumCompositeScore
        ) {

            return true;

        }

        if (
            candidate.radarScore >=
                thresholds
                    .minimumRadarScore &&
            candidate.satelliteScore >=
                thresholds
                    .minimumSatelliteScore
        ) {

            return true;

        }

        if (
            candidate.lightningScore >=
                thresholds
                    .minimumLightningScore &&
            candidate.satelliteScore >=
                thresholds
                    .minimumSatelliteScore
        ) {

            return true;

        }

        return false;

    },

    /* =====================================================
       NEAREST CITIES
       ===================================================== */

    extractNearestCities(
        cityResult = {}
    ) {

        if (
            Array.isArray(
                cityResult.nearestCities
            )
        ) {

            return cityResult
                .nearestCities
                .slice(
                    0,
                    10
                );

        }

        return [];

    },

    /* =====================================================
       SHORT ID
       ===================================================== */

    generateShortId() {

        return Math.random()
            .toString(
                36
            )
            .slice(
                2,
                8
            )
            .toUpperCase();

    },
      /* =====================================================
       PROCESS DETECTED CANDIDATES
       ===================================================== */

    processDetectedCandidates(
        candidates = []
    ) {

        const createdCells =
            [];

        const updatedCells =
            [];

        const mergedCells =
            [];

        const cityTransitions =
            [];

        const matchedCellIds =
            new Set();

        candidates.forEach(
            candidate => {

                const match =
                    this.findBestMatchingCell(
                        candidate
                    );

                if (
                    match &&
                    match.cell &&
                    match.score >=
                        this.config
                            .matching
                            .minimumMatchScore
                ) {

                    const updateResult =
                        this.updateExistingCell(

                            match.cell,

                            candidate,

                            match

                        );

                    matchedCellIds.add(
                        updateResult.cell.cellId
                    );

                    updatedCells.push(
                        updateResult.cell
                    );

                    if (
                        updateResult.cityTransition
                    ) {

                        cityTransitions.push(
                            updateResult.cityTransition
                        );

                        this.cityTransitions.unshift(
                            updateResult.cityTransition
                        );

                    }

                    return;

                }

                const newCell =
                    this.createNewTrackedCell(
                        candidate
                    );

                this.activeCells[
                    newCell.cellId
                ] =
                    newCell;

                matchedCellIds.add(
                    newCell.cellId
                );

                createdCells.push(
                    newCell
                );

            }
        );

        this.limitActiveCells();

        return {

            createdCells,

            updatedCells,

            mergedCells,

            cityTransitions,

            matchedCellIds:
                Array.from(
                    matchedCellIds
                )

        };

    },

    /* =====================================================
       FIND BEST MATCHING CELL
       ===================================================== */

    findBestMatchingCell(
        candidate = {}
    ) {

        const activeCells =
            Object.values(
                this.activeCells
            );

        if (
            !activeCells.length
        ) {

            return null;

        }

        let bestMatch =
            null;

        activeCells.forEach(
            cell => {

                if (
                    !this.isCellEligibleForMatching(
                        cell,
                        candidate
                    )
                ) {

                    return;

                }

                const matchScore =
                    this.calculateMatchScore(
                        cell,
                        candidate
                    );

                if (
                    !bestMatch ||
                    matchScore.score >
                        bestMatch.score
                ) {

                    bestMatch = {

                        cell,

                        ...matchScore

                    };

                }

            }
        );

        if (
            this.config
                .development
                .logMatches &&
            bestMatch
        ) {

            console.log(

                "[RainGuard V31 Storm Tracking] Best match:",

                {

                    candidate:
                        candidate.candidateId,

                    cellId:
                        bestMatch.cell.cellId,

                    score:
                        bestMatch.score,

                    distanceKm:
                        bestMatch.distanceKm

                }

            );

        }

        return bestMatch;

    },

    /* =====================================================
       MATCH ELIGIBILITY
       ===================================================== */

    isCellEligibleForMatching(
        cell = {},
        candidate = {}
    ) {

        const timeGapMinutes =
            this.calculateTimeDifferenceMinutes(

                cell.lastSeenAt,

                candidate.timestamp

            );

        if (
            timeGapMinutes >
            this.config
                .matching
                .maximumTimeGapMinutes
        ) {

            return false;

        }

        const distanceKm =
            this.calculateDistanceKm(

                cell.currentLat,

                cell.currentLon,

                candidate.lat,

                candidate.lon

            );

        if (
            distanceKm >
            this.config
                .matching
                .maximumDistanceKm
        ) {

            return false;

        }

        return true;

    },

    /* =====================================================
       MATCH SCORE
       ===================================================== */

    calculateMatchScore(
        cell = {},
        candidate = {}
    ) {

        const settings =
            this.config
                .matching;

        const distanceKm =
            this.calculateDistanceKm(

                cell.currentLat,

                cell.currentLon,

                candidate.lat,

                candidate.lon

            );

        const distanceScore =
            this.clamp(

                100 -
                (
                    distanceKm /
                    settings
                        .maximumDistanceKm
                ) *
                100,

                0,

                100

            );

        const intensityDifference =
            Math.abs(

                this.safeNumber(
                    cell.intensity,
                    0
                ) -

                this.safeNumber(
                    candidate.intensity,
                    0
                )

            );

        const intensityScore =
            this.clamp(

                100 -
                intensityDifference,

                0,

                100

            );

        const directionScore =
            this.calculateDirectionMatchScore(

                cell,

                candidate

            );

        const cityScore =
            this.calculateCityMatchScore(

                cell.city,

                candidate.city

            );

        let score =

            distanceScore *
                settings.distanceWeight +

            intensityScore *
                settings.intensityWeight +

            directionScore *
                settings.directionWeight +

            cityScore *
                settings.cityWeight;

        if (
            cell.simulated ===
                candidate.simulated
        ) {

            score +=
                3;

        }

        score =
            this.clamp(
                score,
                0,
                100
            );

        return {

            score:
                Math.round(
                    score
                ),

            distanceKm:
                Number(
                    distanceKm
                        .toFixed(
                            2
                        )
                ),

            distanceScore:
                Math.round(
                    distanceScore
                ),

            intensityScore:
                Math.round(
                    intensityScore
                ),

            directionScore:
                Math.round(
                    directionScore
                ),

            cityScore:
                Math.round(
                    cityScore
                )

        };

    },

    /* =====================================================
       DIRECTION MATCH SCORE
       ===================================================== */

    calculateDirectionMatchScore(
        cell = {},
        candidate = {}
    ) {

        if (
            cell.directionDegrees ===
                null ||
            cell.directionDegrees ===
                undefined
        ) {

            return 60;

        }

        const expectedPosition =
            this.projectPosition({

                lat:
                    cell.currentLat,

                lon:
                    cell.currentLon,

                bearingDegrees:
                    cell.directionDegrees,

                distanceKm:
                    Math.max(

                        1,

                        this.safeNumber(
                            cell.speedKmh,
                            0
                        ) *
                        this.calculateTimeDifferenceMinutes(
                            cell.lastSeenAt,
                            candidate.timestamp
                        ) /
                        60

                    )

            });

        const expectedDistance =
            this.calculateDistanceKm(

                expectedPosition.lat,

                expectedPosition.lon,

                candidate.lat,

                candidate.lon

            );

        return this.clamp(

            100 -
            expectedDistance *
                2,

            0,

            100

        );

    },

    /* =====================================================
       CITY MATCH SCORE
       ===================================================== */

    calculateCityMatchScore(
        currentCity,
        candidateCity
    ) {

        const first =
            String(
                currentCity ||
                ""
            )
                .trim()
                .toLowerCase();

        const second =
            String(
                candidateCity ||
                ""
            )
                .trim()
                .toLowerCase();

        if (
            !first ||
            !second
        ) {

            return 50;

        }

        if (
            first ===
            second
        ) {

            return 100;

        }

        return 45;

    },

    /* =====================================================
       UPDATE EXISTING CELL
       ===================================================== */

    updateExistingCell(
        cell,
        candidate,
        match = {}
    ) {

        const previousCity =
            cell.city;

        const previousLat =
            cell.currentLat;

        const previousLon =
            cell.currentLon;

        const previousIntensity =
            cell.intensity;

        const timeGapMinutes =
            Math.max(

                1,

                this.calculateTimeDifferenceMinutes(

                    cell.lastSeenAt,

                    candidate.timestamp

                )

            );

        const movementDistanceKm =
            this.calculateDistanceKm(

                previousLat,

                previousLon,

                candidate.lat,

                candidate.lon

            );

        const speedKmh =
            this.calculateSpeedKmh(

                movementDistanceKm,

                timeGapMinutes

            );

        const directionDegrees =
            movementDistanceKm >=
                this.config
                    .motion
                    .minimumMovementKm
                ? this.calculateBearingDegrees(

                    previousLat,

                    previousLon,

                    candidate.lat,

                    candidate.lon

                )
                : cell.directionDegrees;

        const directionLabel =
            this.getDirectionLabel(

                directionDegrees,

                speedKmh

            );

        const intensityTrend =
            this.calculateCellTrend(

                previousIntensity,

                candidate.intensity

            );

        const now =
            candidate.timestamp ||
            new Date()
                .toISOString();

        cell.previousLat =
            previousLat;

        cell.previousLon =
            previousLon;

        cell.previousCity =
            previousCity;

        cell.previousIntensity =
            previousIntensity;

        cell.currentLat =
            candidate.lat;

        cell.currentLon =
            candidate.lon;

        cell.city =
            candidate.city;

        cell.region =
            candidate.region ||
            cell.region;

        cell.speedKmh =
            Number(
                speedKmh
                    .toFixed(
                        2
                    )
            );

        cell.directionDegrees =
            directionDegrees ===
                null
                ? null
                : Number(
                    directionDegrees
                        .toFixed(
                            2
                        )
                );

        cell.directionLabel =
            directionLabel;

        cell.movementDistanceKm =
            Number(
                movementDistanceKm
                    .toFixed(
                        2
                    )
            );

        cell.intensity =
            candidate.intensity;

        cell.radarScore =
            candidate.radarScore;

        cell.satelliteScore =
            candidate.satelliteScore;

        cell.lightningScore =
            candidate.lightningScore;

        cell.compositeScore =
            candidate.compositeScore;

        cell.confidence =
            candidate.confidence;

        cell.riskScore =
            candidate.riskScore;

        cell.riskLevel =
            candidate.riskLevel;

        cell.trend =
            intensityTrend;

        cell.lifecycleStage =
            this.calculateLifecycleStage(
                cell.firstSeenAt,
                now
            );

        cell.ageMinutes =
            this.calculateTimeDifferenceMinutes(
                cell.firstSeenAt,
                now
            );

        cell.lastSeenAt =
            now;

        cell.lastUpdatedAt =
            now;

        cell.missedCycles =
            0;

        cell.trackingCycles =
            this.safeNumber(
                cell.trackingCycles,
                0
            ) +
            1;

        cell.simulated =
            candidate.simulated ===
                true;

        cell.sourceCount =
            candidate.sourceCount;

        cell.sourceKeys =
            [
                ...candidate.sourceKeys
            ];

        cell.nearestCities =
            Array.isArray(
                candidate.nearestCities
            )
                ? [
                    ...candidate.nearestCities
                ]
                : [];

        cell.history.unshift({

            lat:
                candidate.lat,

            lon:
                candidate.lon,

            city:
                candidate.city,

            intensity:
                candidate.intensity,

            compositeScore:
                candidate.compositeScore,

            confidence:
                candidate.confidence,

            riskScore:
                candidate.riskScore,

            speedKmh:
                cell.speedKmh,

            directionDegrees:
                cell.directionDegrees,

            directionLabel:
                cell.directionLabel,

            movementDistanceKm:
                cell.movementDistanceKm,

            timestamp:
                now

        });

        cell.history =
            cell.history.slice(

                0,

                this.config
                    .maximumCellHistory

            );

        let cityTransition =
            null;

        if (
            previousCity &&
            candidate.city &&
            previousCity !==
                candidate.city
        ) {

            cell.cityTransitionCount =
                this.safeNumber(
                    cell.cityTransitionCount,
                    0
                ) +
                1;

            cityTransition =
                this.createCityTransition({

                    cellId:
                        cell.cellId,

                    fromCity:
                        previousCity,

                    toCity:
                        candidate.city,

                    fromLat:
                        previousLat,

                    fromLon:
                        previousLon,

                    toLat:
                        candidate.lat,

                    toLon:
                        candidate.lon,

                    speedKmh:
                        cell.speedKmh,

                    directionDegrees:
                        cell.directionDegrees,

                    directionLabel:
                        cell.directionLabel,

                    intensity:
                        cell.intensity,

                    riskScore:
                        cell.riskScore,

                    timestamp:
                        now

                });

        }

        this.activeCells[
            cell.cellId
        ] =
            cell;

        return {

            cell,

            cityTransition,

            match

        };

    },

    /* =====================================================
       CREATE NEW TRACKED CELL
       ===================================================== */

    createNewTrackedCell(
        candidate = {}
    ) {

        const cell =
            this.createStormCell({

                lat:
                    candidate.lat,

                lon:
                    candidate.lon,

                city:
                    candidate.city,

                region:
                    candidate.region,

                intensity:
                    candidate.intensity,

                radarScore:
                    candidate.radarScore,

                satelliteScore:
                    candidate.satelliteScore,

                lightningScore:
                    candidate.lightningScore,

                compositeScore:
                    candidate.compositeScore,

                confidence:
                    candidate.confidence,

                riskScore:
                    candidate.riskScore,

                riskLevel:
                    candidate.riskLevel,

                simulated:
                    candidate.simulated,

                timestamp:
                    candidate.timestamp

            });

        cell.sourceCount =
            candidate.sourceCount;

        cell.sourceKeys =
            [
                ...candidate.sourceKeys
            ];

        cell.nearestCities =
            Array.isArray(
                candidate.nearestCities
            )
                ? [
                    ...candidate.nearestCities
                ]
                : [];

        cell.verificationStatus =
            candidate.verificationStatus;

        cell.finalConfidence =
            candidate.finalConfidence;

        cell.verifiedRisk =
            candidate.verifiedRisk;

        cell.rainConsensus =
            candidate.rainConsensus;

        cell.lightningThreat =
            candidate.lightningThreat;

        return cell;

    },

    /* =====================================================
       MERGE DUPLICATE CANDIDATES
       ===================================================== */

    mergeDuplicateCandidates(
        candidates = []
    ) {

        if (
            candidates.length <
            2
        ) {

            return candidates;

        }

        const merged =
            [];

        const consumed =
            new Set();

        candidates.forEach(
            (
                candidate,
                index
            ) => {

                if (
                    consumed.has(
                        index
                    )
                ) {

                    return;

                }

                const group =
                    [
                        candidate
                    ];

                consumed.add(
                    index
                );

                candidates.forEach(
                    (
                        other,
                        otherIndex
                    ) => {

                        if (
                            consumed.has(
                                otherIndex
                            ) ||
                            otherIndex ===
                                index
                        ) {

                            return;

                        }

                        const distanceKm =
                            this.calculateDistanceKm(

                                candidate.lat,

                                candidate.lon,

                                other.lat,

                                other.lon

                            );

                        if (
                            distanceKm <=
                            this.config
                                .detection
                                .duplicateDistanceKm
                        ) {

                            group.push(
                                other
                            );

                            consumed.add(
                                otherIndex
                            );

                        }

                    }
                );

                if (
                    group.length ===
                    1
                ) {

                    merged.push(
                        candidate
                    );

                    return;

                }

                merged.push(
                    this.mergeCandidateGroup(
                        group
                    )
                );

            }
        );

        return merged;

    },

    /* =====================================================
       MERGE CANDIDATE GROUP
       ===================================================== */

    mergeCandidateGroup(
        group = []
    ) {

        const strongest =
            [
                ...group
            ]
            .sort(
                (
                    first,
                    second
                ) =>
                    second.compositeScore -
                    first.compositeScore
            )[0];

        const average =
            field =>

                group.reduce(

                    (
                        total,
                        item
                    ) =>
                        total +
                        this.safeNumber(
                            item[field],
                            0
                        ),

                    0

                ) /
                group.length;

        const sourceKeys =
            [
                ...new Set(

                    group.flatMap(
                        item =>
                            item.sourceKeys ||
                            []
                    )

                )
            ];

        return {

            ...strongest,

            lat:
                average(
                    "lat"
                ),

            lon:
                average(
                    "lon"
                ),

            radarScore:
                Math.round(
                    average(
                        "radarScore"
                    )
                ),

            satelliteScore:
                Math.round(
                    average(
                        "satelliteScore"
                    )
                ),

            lightningScore:
                Math.round(
                    average(
                        "lightningScore"
                    )
                ),

            compositeScore:
                Math.round(
                    average(
                        "compositeScore"
                    )
                ),

            intensity:
                Math.round(
                    average(
                        "intensity"
                    )
                ),

            confidence:
                Math.round(
                    average(
                        "confidence"
                    )
                ),

            riskScore:
                Math.round(
                    average(
                        "riskScore"
                    )
                ),

            riskLevel:
                this.getRiskLevel(

                    average(
                        "riskScore"
                    )

                ),

            sourceKeys,

            sourceCount:
                sourceKeys.length,

            simulated:
                group.some(
                    item =>
                        item.simulated ===
                        true
                ),

            mergedCandidateCount:
                group.length,

            mergedCandidateIds:
                group.map(
                    item =>
                        item.candidateId
                )

        };

    },

    /* =====================================================
       CREATE CITY TRANSITION
       ===================================================== */

    createCityTransition({

        cellId,

        fromCity,

        toCity,

        fromLat,

        fromLon,

        toLat,

        toLon,

        speedKmh,

        directionDegrees,

        directionLabel,

        intensity,

        riskScore,

        timestamp

    } = {}) {

        return {

            transitionId:
                `TRANSITION-${Date.now()}-${this.generateShortId()}`,

            cellId,

            fromCity,

            toCity,

            fromLat,

            fromLon,

            toLat,

            toLon,

            distanceKm:
                Number(

                    this.calculateDistanceKm(

                        fromLat,

                        fromLon,

                        toLat,

                        toLon

                    )
                    .toFixed(
                        2
                    )

                ),

            speedKmh,

            directionDegrees,

            directionLabel,

            intensity,

            riskScore,

            riskLevel:
                this.getRiskLevel(
                    riskScore
                ),

            timestamp:
                timestamp ||
                new Date()
                    .toISOString()

        };

    },

    /* =====================================================
       LIMIT ACTIVE CELLS
       ===================================================== */

    limitActiveCells() {

        const entries =
            Object.entries(
                this.activeCells
            );

        if (
            entries.length <=
            this.config
                .maximumActiveCells
        ) {

            return;

        }

        entries
            .sort(
                (
                    first,
                    second
                ) =>

                    new Date(
                        first[1]
                            .lastSeenAt
                    )
                    .getTime() -

                    new Date(
                        second[1]
                            .lastSeenAt
                    )
                    .getTime()
            )
            .slice(
                0,
                entries.length -
                this.config
                    .maximumActiveCells
            )
            .forEach(
                (
                    [
                        cellId
                    ]
                ) => {

                    delete this.activeCells[
                        cellId
                    ];

                }
            );

    },
      /* =====================================================
       DISTANCE CALCULATION - HAVERSINE
       ===================================================== */

    calculateDistanceKm(
        lat1,
        lon1,
        lat2,
        lon2
    ) {

        const firstLat =
            this.firstNullableNumber(
                lat1
            );

        const firstLon =
            this.firstNullableNumber(
                lon1
            );

        const secondLat =
            this.firstNullableNumber(
                lat2
            );

        const secondLon =
            this.firstNullableNumber(
                lon2
            );

        if (
            firstLat === null ||
            firstLon === null ||
            secondLat === null ||
            secondLon === null
        ) {

            return 0;

        }

        const earthRadiusKm =
            6371;

        const toRadians =
            degrees =>
                degrees *
                Math.PI /
                180;

        const latitudeDifference =
            toRadians(
                secondLat -
                firstLat
            );

        const longitudeDifference =
            toRadians(
                secondLon -
                firstLon
            );

        const firstLatitudeRadians =
            toRadians(
                firstLat
            );

        const secondLatitudeRadians =
            toRadians(
                secondLat
            );

        const a =

            Math.sin(
                latitudeDifference /
                2
            ) **
            2 +

            Math.cos(
                firstLatitudeRadians
            ) *

            Math.cos(
                secondLatitudeRadians
            ) *

            Math.sin(
                longitudeDifference /
                2
            ) **
            2;

        const c =

            2 *

            Math.atan2(

                Math.sqrt(
                    a
                ),

                Math.sqrt(
                    1 -
                    a
                )

            );

        return earthRadiusKm *
            c;

    },

    /* =====================================================
       BEARING CALCULATION
       ===================================================== */

    calculateBearingDegrees(
        lat1,
        lon1,
        lat2,
        lon2
    ) {

        const firstLat =
            this.firstNullableNumber(
                lat1
            );

        const firstLon =
            this.firstNullableNumber(
                lon1
            );

        const secondLat =
            this.firstNullableNumber(
                lat2
            );

        const secondLon =
            this.firstNullableNumber(
                lon2
            );

        if (
            firstLat === null ||
            firstLon === null ||
            secondLat === null ||
            secondLon === null
        ) {

            return null;

        }

        const toRadians =
            degrees =>
                degrees *
                Math.PI /
                180;

        const toDegrees =
            radians =>
                radians *
                180 /
                Math.PI;

        const firstLatitude =
            toRadians(
                firstLat
            );

        const secondLatitude =
            toRadians(
                secondLat
            );

        const longitudeDifference =
            toRadians(
                secondLon -
                firstLon
            );

        const y =

            Math.sin(
                longitudeDifference
            ) *

            Math.cos(
                secondLatitude
            );

        const x =

            Math.cos(
                firstLatitude
            ) *

            Math.sin(
                secondLatitude
            ) -

            Math.sin(
                firstLatitude
            ) *

            Math.cos(
                secondLatitude
            ) *

            Math.cos(
                longitudeDifference
            );

        const bearing =
            toDegrees(
                Math.atan2(
                    y,
                    x
                )
            );

        return (

            bearing +
            360

        ) %
        360;

    },

    /* =====================================================
       SPEED CALCULATION
       ===================================================== */

    calculateSpeedKmh(
        distanceKm,
        timeMinutes
    ) {

        const distance =
            Math.max(

                0,

                this.safeNumber(
                    distanceKm,
                    0
                )

            );

        const minutes =
            Math.max(

                1,

                this.safeNumber(
                    timeMinutes,
                    1
                )

            );

        const speed =
            distance /
            (
                minutes /
                60
            );

        return this.clamp(

            speed,

            0,

            this.config
                .motion
                .maximumSpeedKmh

        );

    },

    /* =====================================================
       POSITION PROJECTION
       ===================================================== */

    projectPosition({

        lat,

        lon,

        bearingDegrees,

        distanceKm

    } = {}) {

        const latitude =
            this.firstNullableNumber(
                lat
            );

        const longitude =
            this.firstNullableNumber(
                lon
            );

        const bearing =
            this.firstNullableNumber(
                bearingDegrees
            );

        const distance =
            this.safeNumber(
                distanceKm,
                0
            );

        if (
            latitude === null ||
            longitude === null ||
            bearing === null
        ) {

            return {

                lat:
                    latitude,

                lon:
                    longitude

            };

        }

        const earthRadiusKm =
            6371;

        const angularDistance =
            distance /
            earthRadiusKm;

        const toRadians =
            degrees =>
                degrees *
                Math.PI /
                180;

        const toDegrees =
            radians =>
                radians *
                180 /
                Math.PI;

        const latitudeRadians =
            toRadians(
                latitude
            );

        const longitudeRadians =
            toRadians(
                longitude
            );

        const bearingRadians =
            toRadians(
                bearing
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
                Number(
                    toDegrees(
                        projectedLatitude
                    )
                    .toFixed(
                        6
                    )
                ),

            lon:
                Number(
                    (
                        (
                            toDegrees(
                                projectedLongitude
                            ) +
                            540
                        ) %
                        360 -
                        180
                    )
                    .toFixed(
                        6
                    )
                )

        };

    },

    /* =====================================================
       DIRECTION LABEL
       ===================================================== */

    getDirectionLabel(
        directionDegrees,
        speedKmh = 0
    ) {

        const speed =
            this.safeNumber(
                speedKmh,
                0
            );

        if (
            speed <=
            this.config
                .motion
                .stationarySpeedKmh
        ) {

            return "STATIONARY";

        }

        const direction =
            this.firstNullableNumber(
                directionDegrees
            );

        if (
            direction === null
        ) {

            return "UNKNOWN";

        }

        const labels = [

            "N",

            "NE",

            "E",

            "SE",

            "S",

            "SW",

            "W",

            "NW"

        ];

        const index =
            Math.round(

                direction /
                45

            ) %
            8;

        return labels[
            index
        ];

    },

    /* =====================================================
       SPEED CLASSIFICATION
       ===================================================== */

    getSpeedClass(
        speedKmh
    ) {

        const speed =
            this.safeNumber(
                speedKmh,
                0
            );

        const thresholds =
            this.config
                .motion;

        if (
            speed <=
            thresholds
                .stationarySpeedKmh
        ) {

            return "STATIONARY";

        }

        if (
            speed <=
            thresholds
                .slowSpeedKmh
        ) {

            return "SLOW";

        }

        if (
            speed <=
            thresholds
                .moderateSpeedKmh
        ) {

            return "MODERATE";

        }

        if (
            speed <=
            thresholds
                .fastSpeedKmh
        ) {

            return "FAST";

        }

        return "VERY_FAST";

    },

    /* =====================================================
       CELL TREND
       ===================================================== */

    calculateCellTrend(
        previousIntensity,
        currentIntensity
    ) {

        if (
            previousIntensity ===
                null ||
            previousIntensity ===
                undefined
        ) {

            return "NEW";

        }

        const previous =
            this.safeNumber(
                previousIntensity,
                0
            );

        const current =
            this.safeNumber(
                currentIntensity,
                0
            );

        const difference =
            current -
            previous;

        const thresholds =
            this.config
                .trend;

        if (
            difference >=
            thresholds
                .rapidGrowthDelta
        ) {

            return "RAPIDLY_GROWING";

        }

        if (
            difference >=
            thresholds
                .growthDelta
        ) {

            return "GROWING";

        }

        if (
            difference <=
            thresholds
                .rapidWeakeningDelta
        ) {

            return "RAPIDLY_WEAKENING";

        }

        if (
            difference <=
            thresholds
                .weakeningDelta
        ) {

            return "WEAKENING";

        }

        if (
            Math.abs(
                difference
            ) <=
            thresholds
                .stableTolerance
        ) {

            return "STABLE";

        }

        return difference > 0
            ? "SLIGHTLY_GROWING"
            : "SLIGHTLY_WEAKENING";

    },

    /* =====================================================
       LIFECYCLE STAGE
       ===================================================== */

    calculateLifecycleStage(
        firstSeenAt,
        currentTimestamp = null
    ) {

        const ageMinutes =
            this.calculateTimeDifferenceMinutes(

                firstSeenAt,

                currentTimestamp ||
                new Date()
                    .toISOString()

            );

        const lifecycle =
            this.config
                .lifecycle;

        if (
            ageMinutes <=
            lifecycle
                .newCellMinutes
        ) {

            return "NEW";

        }

        if (
            ageMinutes <=
            lifecycle
                .matureCellMinutes
        ) {

            return "DEVELOPING";

        }

        if (
            ageMinutes <=
            lifecycle
                .longLivedMinutes
        ) {

            return "MATURE";

        }

        return "LONG_LIVED";

    },

    /* =====================================================
       TIME DIFFERENCE
       ===================================================== */

    calculateTimeDifferenceMinutes(
        startTimestamp,
        endTimestamp
    ) {

        if (
            !startTimestamp ||
            !endTimestamp
        ) {

            return 0;

        }

        const start =
            new Date(
                startTimestamp
            )
            .getTime();

        const end =
            new Date(
                endTimestamp
            )
            .getTime();

        if (
            !Number.isFinite(
                start
            ) ||
            !Number.isFinite(
                end
            )
        ) {

            return 0;

        }

        return Math.max(

            0,

            (
                end -
                start
            ) /
            60000

        );

    },

    /* =====================================================
       INCREMENT MISSED CYCLES
       ===================================================== */

    incrementMissedCycles(
        matchedCellIds = []
    ) {

        const matched =
            new Set(
                matchedCellIds
            );

        Object.values(
            this.activeCells
        )
        .forEach(
            cell => {

                if (
                    matched.has(
                        cell.cellId
                    )
                ) {

                    return;

                }

                cell.missedCycles =
                    this.safeNumber(
                        cell.missedCycles,
                        0
                    ) +
                    1;

                cell.lastUpdatedAt =
                    new Date()
                        .toISOString();

                if (
                    cell.missedCycles ===
                    1
                ) {

                    cell.lifecycleStage =
                        "TEMPORARILY_MISSING";

                } else if (
                    cell.missedCycles >=
                    this.config
                        .maximumMissedCycles
                ) {

                    cell.lifecycleStage =
                        "LOST";

                }

            }
        );

    },

    /* =====================================================
       ARCHIVE EXPIRED CELLS
       ===================================================== */

    archiveExpiredCells() {

        const archived =
            [];

        const now =
            new Date()
                .toISOString();

        Object.entries(
            this.activeCells
        )
        .forEach(
            (
                [
                    cellId,
                    cell
                ]
            ) => {

                const minutesSinceSeen =
                    this.calculateTimeDifferenceMinutes(

                        cell.lastSeenAt,

                        now

                    );

                const shouldArchive =

                    cell.missedCycles >=
                        this.config
                            .maximumMissedCycles ||

                    minutesSinceSeen >=
                        this.config
                            .lifecycle
                            .archiveAfterMinutes;

                if (
                    !shouldArchive
                ) {

                    return;

                }

                const archivedCell = {

                    ...cell,

                    archivedAt:
                        now,

                    archiveReason:

                        cell.missedCycles >=
                            this.config
                                .maximumMissedCycles

                            ? "MISSED_CYCLES"

                            : "STALE_CELL",

                    lifecycleStage:
                        "ARCHIVED"

                };

                this.archivedCells[
                    cellId
                ] =
                    archivedCell;

                archived.push(
                    archivedCell
                );

                delete this.activeCells[
                    cellId
                ];

            }
        );

        this.limitArchivedCells();

        return archived;

    },

    /* =====================================================
       LIMIT ARCHIVED CELLS
       ===================================================== */

    limitArchivedCells() {

        const entries =
            Object.entries(
                this.archivedCells
            );

        if (
            entries.length <=
            this.config
                .maximumArchivedCells
        ) {

            return;

        }

        entries
            .sort(
                (
                    first,
                    second
                ) =>

                    new Date(
                        second[1]
                            .archivedAt ||
                        second[1]
                            .lastSeenAt
                    )
                    .getTime() -

                    new Date(
                        first[1]
                            .archivedAt ||
                        first[1]
                            .lastSeenAt
                    )
                    .getTime()
            )
            .slice(
                this.config
                    .maximumArchivedCells
            )
            .forEach(
                (
                    [
                        cellId
                    ]
                ) => {

                    delete this.archivedCells[
                        cellId
                    ];

                }
            );

    },

    /* =====================================================
       LIMIT CITY TRANSITIONS
       ===================================================== */

    limitCityTransitions() {

        if (
            this.cityTransitions.length <=
            this.config
                .maximumTransitions
        ) {

            return;

        }

        this.cityTransitions =
            this.cityTransitions.slice(

                0,

                this.config
                    .maximumTransitions

            );

    },

    /* =====================================================
       RISK LEVEL
       ===================================================== */

    getRiskLevel(
        score
    ) {

        const value =
            this.clamp(
                score,
                0,
                100
            );

        const thresholds =
            this.config
                .risk;

        if (
            value >=
            thresholds.severe
        ) {

            return "SEVERE";

        }

        if (
            value >=
            thresholds.high
        ) {

            return "HIGH";

        }

        if (
            value >=
            thresholds.moderate
        ) {

            return "MODERATE";

        }

        if (
            value >=
            thresholds.low
        ) {

            return "LOW";

        }

        return "MINIMAL";

    },

    /* =====================================================
       CLOUD TEMPERATURE SCORE
       ===================================================== */

    cloudTemperatureToScore(
        temperature
    ) {

        const value =
            Number(
                temperature
            );

        if (
            !Number.isFinite(
                value
            )
        ) {

            return 0;

        }

        if (
            value <= -60
        ) {

            return 100;

        }

        if (
            value <= -50
        ) {

            return 85;

        }

        if (
            value <= -40
        ) {

            return 65;

        }

        if (
            value <= -30
        ) {

            return 45;

        }

        if (
            value <= -20
        ) {

            return 25;

        }

        return 10;

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

                lastTrackingAt:
                    this.lastTrackingAt,

                latestTrackingReport:
                    this.latestTrackingReport,

                activeCells:
                    this.activeCells,

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

                this.archiveStorageKey,

                JSON.stringify(
                    this.archivedCells
                )

            );

            localStorage.setItem(

                this.transitionStorageKey,

                JSON.stringify(
                    this.cityTransitions
                )

            );

            return true;

        } catch (error) {

            console.warn(
                "Storm Cell Tracking state save failed:",
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

            const savedArchive =
                localStorage.getItem(
                    this.archiveStorageKey
                );

            const savedTransitions =
                localStorage.getItem(
                    this.transitionStorageKey
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

                    this.lastTrackingAt =
                        parsed.lastTrackingAt ||
                        null;

                    this.latestTrackingReport =
                        parsed.latestTrackingReport ||
                        null;

                    this.activeCells =
                        parsed.activeCells &&
                        typeof parsed.activeCells ===
                            "object"
                            ? parsed.activeCells
                            : {};

                }

            }

            if (
                savedArchive
            ) {

                const parsedArchive =
                    JSON.parse(
                        savedArchive
                    );

                this.archivedCells =
                    parsedArchive &&
                    typeof parsedArchive ===
                        "object"
                        ? parsedArchive
                        : {};

            }

            if (
                savedTransitions
            ) {

                const parsedTransitions =
                    JSON.parse(
                        savedTransitions
                    );

                this.cityTransitions =
                    Array.isArray(
                        parsedTransitions
                    )
                        ? parsedTransitions.slice(
                            0,
                            this.config.maximumTransitions
                        )
                        : [];

            }

            this.limitActiveCells();

            this.limitArchivedCells();

            this.limitCityTransitions();

            return true;

        } catch (error) {

            console.warn(
                "Storm Cell Tracking state load failed:",
                error
            );

            this.activeCells =
                {};

            this.archivedCells =
                {};

            this.cityTransitions =
                [];

            return false;

        }

    },

    /* =====================================================
       PUBLISH TRACKING REPORT
       ===================================================== */

    publishTrackingReport(
        report
    ) {

        if (
            !report
        ) {

            return;

        }

        window.RG31.latestStormTrackingReport =
            report;

        window.RG30.latestStormTrackingReport =
            report;

        window.RG31.ActiveStormCells =
            this.getActiveCells();

        window.RG30.ActiveStormCells =
            this.getActiveCells();

        const detail = {

            report,

            activeCells:
                this.getActiveCells(),

            archivedCells:
                this.getArchivedCells(),

            transitions:
                this.getCityTransitions(),

            timestamp:
                this.lastTrackingAt,

            version:
                this.version

        };

        window.dispatchEvent(

            new CustomEvent(

                "rg31:storm-cell-tracking-completed",

                {
                    detail
                }

            )

        );

        window.dispatchEvent(

            new CustomEvent(

                "rg30:storm-cell-tracking-completed",

                {
                    detail
                }

            )

        );

        window.dispatchEvent(

            new CustomEvent(

                "rg31:storm-cells-updated",

                {
                    detail: {

                        activeCells:
                            this.getActiveCells(),

                        cycleNumber:
                            this.cycleNumber,

                        timestamp:
                            this.lastTrackingAt

                    }
                }

            )

        );

        if (
            report.cityTransitions &&
            report.cityTransitions.length
        ) {

            window.dispatchEvent(

                new CustomEvent(

                    "rg31:storm-city-transition",

                    {
                        detail: {

                            transitions:
                                report.cityTransitions,

                            timestamp:
                                this.lastTrackingAt

                        }
                    }

                )

            );

        }

        this.renderStormTrackingPanel(
            report
        );

    },

    /* =====================================================
       GET ACTIVE CELLS
       ===================================================== */

    getActiveCells() {

        return Object.values(
            this.activeCells
        )
        .sort(
            (
                first,
                second
            ) =>

                this.safeNumber(
                    second.riskScore,
                    0
                ) -

                this.safeNumber(
                    first.riskScore,
                    0
                )
        )
        .map(
            cell => ({

                ...cell,

                history:
                    Array.isArray(
                        cell.history
                    )
                        ? [
                            ...cell.history
                        ]
                        : []

            })
        );

    },

    /* =====================================================
       GET ARCHIVED CELLS
       ===================================================== */

    getArchivedCells() {

        return Object.values(
            this.archivedCells
        )
        .sort(
            (
                first,
                second
            ) =>

                new Date(
                    second.archivedAt ||
                    second.lastSeenAt ||
                    0
                )
                .getTime() -

                new Date(
                    first.archivedAt ||
                    first.lastSeenAt ||
                    0
                )
                .getTime()
        )
        .map(
            cell => ({

                ...cell,

                history:
                    Array.isArray(
                        cell.history
                    )
                        ? [
                            ...cell.history
                        ]
                        : []

            })
        );

    },

    /* =====================================================
       GET CELL BY ID
       ===================================================== */

    getCellById(
        cellId
    ) {

        const id =
            String(
                cellId ||
                ""
            )
                .trim();

        if (
            !id
        ) {

            return null;

        }

        const cell =

            this.activeCells[
                id
            ] ||

            this.archivedCells[
                id
            ];

        if (
            !cell
        ) {

            return null;

        }

        return {

            ...cell,

            history:
                Array.isArray(
                    cell.history
                )
                    ? [
                        ...cell.history
                    ]
                    : []

        };

    },

    /* =====================================================
       GET CITY TRANSITIONS
       ===================================================== */

    getCityTransitions(
        limit = null
    ) {

        const transitions =
            [
                ...this.cityTransitions
            ];

        if (
            Number.isFinite(
                Number(
                    limit
                )
            )
        ) {

            return transitions.slice(
                0,
                Math.max(
                    0,
                    Number(
                        limit
                    )
                )
            );

        }

        return transitions;

    },

    /* =====================================================
       GET TRACKING STATE
       ===================================================== */

    getTrackingState() {

        return {

            version:
                this.version,

            initialized:
                this.initialized,

            enabled:
                this.config.enabled,

            automaticTracking:
                this.config
                    .automaticTracking,

            trackingInProgress:
                this.trackingInProgress,

            cycleNumber:
                this.cycleNumber,

            lastTrackingAt:
                this.lastTrackingAt,

            activeCellCount:
                Object.keys(
                    this.activeCells
                )
                .length,

            archivedCellCount:
                Object.keys(
                    this.archivedCells
                )
                .length,

            transitionCount:
                this.cityTransitions.length,

            activeCells:
                this.getActiveCells(),

            latestTrackingReport:
                this.latestTrackingReport

        };

    },

    /* =====================================================
       DEBUG SNAPSHOT
       ===================================================== */

    getDebugSnapshot() {

        return {

            engine:
                "StormCellTrackingEngine",

            version:
                this.version,

            config:
                this.config,

            state:
                this.getTrackingState(),

            activeCells:
                this.activeCells,

            archivedCells:
                this.archivedCells,

            cityTransitions:
                this.cityTransitions,

            latestTrackingReport:
                this.latestTrackingReport,

            timestamp:
                new Date()
                    .toISOString()

        };

    },

    /* =====================================================
       STORM TRACKING PANEL
       ===================================================== */

    renderStormTrackingPanel(
        report =
            this.latestTrackingReport
    ) {

        const panel =
            document.getElementById(
                "stormCellTrackingPanel"
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

                        "No storm cell tracking report is available yet.",

                        "لا يتوفر تقرير لتتبع الخلايا الرعدية حتى الآن."

                    )}

                </div>

            `;

            return;

        }

        const activeCells =
            Array.isArray(
                report.activeCells
            )
                ? report.activeCells
                : this.getActiveCells();

        const activeCellsHtml =
            activeCells.length
                ? activeCells
                    .map(
                        cell =>
                            this.renderStormCellCard(
                                cell
                            )
                    )
                    .join("")
                : `

                    <div class="item success">

                        ${this.text(

                            "No active storm cells are currently detected.",

                            "لا توجد خلايا رعدية نشطة مكتشفة حاليًا."

                        )}

                    </div>

                `;

        const transitionsHtml =
            Array.isArray(
                report.cityTransitions
            ) &&
            report.cityTransitions.length
                ? report.cityTransitions
                    .map(
                        transition =>
                            this.renderTransitionCard(
                                transition
                            )
                    )
                    .join("")
                : "";

        panel.innerHTML = `

            <div class="item info">

                <h3>

                    ${this.text(

                        "Storm Cell Tracking Summary V31",

                        "ملخص تتبع الخلايا الرعدية V31"

                    )}

                </h3>

                <b>

                    ${this.text(
                        "Tracking Cycle",
                        "دورة التتبع"
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
                        "Detected Candidates",
                        "المرشحون المكتشفون"
                    )}:

                </b>

                ${this.safeNumber(
                    report.candidatesDetected,
                    0
                )}

                <br>

                <b>

                    ${this.text(
                        "Created Cells",
                        "الخلايا المنشأة"
                    )}:

                </b>

                ${this.safeNumber(
                    report.cellsCreated,
                    0
                )}

                <br>

                <b>

                    ${this.text(
                        "Updated Cells",
                        "الخلايا المحدثة"
                    )}:

                </b>

                ${this.safeNumber(
                    report.cellsUpdated,
                    0
                )}

                <br>

                <b>

                    ${this.text(
                        "Archived Cells",
                        "الخلايا المؤرشفة"
                    )}:

                </b>

                ${this.safeNumber(
                    report.cellsArchived,
                    0
                )}

                <br>

                <b>

                    ${this.text(
                        "Active Cells",
                        "الخلايا النشطة"
                    )}:

                </b>

                ${this.safeNumber(
                    report.activeCellCount,
                    0
                )}

                <br>

                <b>

                    ${this.text(
                        "City Transitions",
                        "الانتقالات بين المدن"
                    )}:

                </b>

                ${Array.isArray(
                    report.cityTransitions
                )
                    ? report.cityTransitions.length
                    : 0
                }

                <br>

                <b>

                    ${this.text(
                        "Duration",
                        "مدة التتبع"
                    )}:

                </b>

                ${this.safeNumber(
                    report.durationMs,
                    0
                )} ms

            </div>

            ${activeCellsHtml}

            ${transitionsHtml}

        `;

    },

    /* =====================================================
       STORM CELL CARD
       ===================================================== */

    renderStormCellCard(
        cell = {}
    ) {

        const className =
            this.getRiskClass(
                cell.riskLevel
            );

        const lastSeen =
            cell.lastSeenAt
                ? new Date(
                    cell.lastSeenAt
                )
                .toLocaleString(
                    this.getLocale()
                )
                : "--";

        return `

            <div class="item ${className}">

                <h3>

                    ${this.escapeHtml(
                        cell.cellId ||
                        "--"
                    )}

                </h3>

                <b>

                    ${this.text(
                        "Current City",
                        "المدينة الحالية"
                    )}:

                </b>

                ${this.escapeHtml(
                    cell.city ||
                    "--"
                )}

                <br>

                <b>

                    ${this.text(
                        "Previous City",
                        "المدينة السابقة"
                    )}:

                </b>

                ${this.escapeHtml(
                    cell.previousCity ||
                    "--"
                )}

                <br>

                <b>

                    ${this.text(
                        "Intensity",
                        "شدة الخلية"
                    )}:

                </b>

                ${this.safeNumber(
                    cell.intensity,
                    0
                )}%

                <br>

                <b>

                    ${this.text(
                        "Composite Score",
                        "الدرجة المركبة"
                    )}:

                </b>

                ${this.safeNumber(
                    cell.compositeScore,
                    0
                )}%

                <br>

                <b>

                    ${this.text(
                        "Risk",
                        "الخطر"
                    )}:

                </b>

                ${this.safeNumber(
                    cell.riskScore,
                    0
                )}%

                — ${this.getRiskLabel(
                    cell.riskLevel
                )}

                <br>

                <b>

                    ${this.text(
                        "Confidence",
                        "الثقة"
                    )}:

                </b>

                ${this.safeNumber(
                    cell.confidence,
                    0
                )}%

                <br>

                <b>

                    ${this.text(
                        "Speed",
                        "السرعة"
                    )}:

                </b>

                ${Number(
                    this.safeNumber(
                        cell.speedKmh,
                        0
                    )
                )
                .toFixed(
                    1
                )} km/h

                <br>

                <b>

                    ${this.text(
                        "Direction",
                        "الاتجاه"
                    )}:

                </b>

                ${this.getDirectionLabelLocalized(
                    cell.directionLabel
                )}

                <br>

                <b>

                    ${this.text(
                        "Trend",
                        "اتجاه النمو"
                    )}:

                </b>

                ${this.getTrendLabel(
                    cell.trend
                )}

                <br>

                <b>

                    ${this.text(
                        "Lifecycle",
                        "مرحلة دورة الحياة"
                    )}:

                </b>

                ${this.getLifecycleLabel(
                    cell.lifecycleStage
                )}

                <br>

                <b>

                    ${this.text(
                        "Age",
                        "عمر الخلية"
                    )}:

                </b>

                ${Math.round(
                    this.safeNumber(
                        cell.ageMinutes,
                        0
                    )
                )}
                ${this.text(
                    " min",
                    " دقيقة"
                )}

                <br>

                <b>

                    ${this.text(
                        "Radar Score",
                        "درجة الرادار"
                    )}:

                </b>

                ${this.safeNumber(
                    cell.radarScore,
                    0
                )}%

                <br>

                <b>

                    ${this.text(
                        "Satellite Score",
                        "درجة الأقمار الصناعية"
                    )}:

                </b>

                ${this.safeNumber(
                    cell.satelliteScore,
                    0
                )}%

                <br>

                <b>

                    ${this.text(
                        "Lightning Score",
                        "درجة البرق"
                    )}:

                </b>

                ${this.safeNumber(
                    cell.lightningScore,
                    0
                )}%

                <br>

                <b>

                    ${this.text(
                        "Tracking Cycles",
                        "دورات التتبع"
                    )}:

                </b>

                ${this.safeNumber(
                    cell.trackingCycles,
                    0
                )}

                <br>

                <b>

                    ${this.text(
                        "Last Seen",
                        "آخر رصد"
                    )}:

                </b>

                ${lastSeen}

                ${
                    cell.simulated ===
                    true
                        ? `

                            <br><br>

                            <span class="verification-warning">

                                ${this.text(

                                    "This tracked cell includes simulated source data.",

                                    "تتضمن هذه الخلية المتتبعة بيانات مصدر محاكاة."

                                )}

                            </span>

                        `
                        : ""
                }

            </div>

        `;

    },

    /* =====================================================
       TRANSITION CARD
       ===================================================== */

    renderTransitionCard(
        transition = {}
    ) {

        return `

            <div class="item warning">

                <h3>

                    ${this.text(
                        "Storm Cell City Transition",
                        "انتقال خلية رعدية بين المدن"
                    )}

                </h3>

                <b>

                    ${this.text(
                        "Cell",
                        "الخلية"
                    )}:

                </b>

                ${this.escapeHtml(
                    transition.cellId ||
                    "--"
                )}

                <br>

                <b>

                    ${this.text(
                        "From",
                        "من"
                    )}:

                </b>

                ${this.escapeHtml(
                    transition.fromCity ||
                    "--"
                )}

                <br>

                <b>

                    ${this.text(
                        "To",
                        "إلى"
                    )}:

                </b>

                ${this.escapeHtml(
                    transition.toCity ||
                    "--"
                )}

                <br>

                <b>

                    ${this.text(
                        "Distance",
                        "المسافة"
                    )}:

                </b>

                ${Number(
                    this.safeNumber(
                        transition.distanceKm,
                        0
                    )
                )
                .toFixed(
                    1
                )} km

                <br>

                <b>

                    ${this.text(
                        "Speed",
                        "السرعة"
                    )}:

                </b>

                ${Number(
                    this.safeNumber(
                        transition.speedKmh,
                        0
                    )
                )
                .toFixed(
                    1
                )} km/h

                <br>

                <b>

                    ${this.text(
                        "Direction",
                        "الاتجاه"
                    )}:

                </b>

                ${this.getDirectionLabelLocalized(
                    transition.directionLabel
                )}

                <br>

                <b>

                    ${this.text(
                        "Risk",
                        "الخطر"
                    )}:

                </b>

                ${this.safeNumber(
                    transition.riskScore,
                    0
                )}%

                — ${this.getRiskLabel(
                    transition.riskLevel
                )}

            </div>

        `;

    },

    /* =====================================================
       LABEL HELPERS
       ===================================================== */

    getRiskClass(
        riskLevel
    ) {

        const value =
            this.normalizeStatus(
                riskLevel
            );

        if (
            value ===
            "SEVERE"
        ) {

            return "danger";

        }

        if (
            value ===
                "HIGH" ||
            value ===
                "MODERATE"
        ) {

            return "warning";

        }

        if (
            value ===
            "LOW"
        ) {

            return "info";

        }

        return "success";

    },

    getRiskLabel(
        riskLevel
    ) {

        const value =
            this.normalizeStatus(
                riskLevel
            );

        const labels = {

            SEVERE: {

                en:
                    "Severe",

                ar:
                    "شديد"

            },

            HIGH: {

                en:
                    "High",

                ar:
                    "مرتفع"

            },

            MODERATE: {

                en:
                    "Moderate",

                ar:
                    "متوسط"

            },

            LOW: {

                en:
                    "Low",

                ar:
                    "منخفض"

            },

            MINIMAL: {

                en:
                    "Minimal",

                ar:
                    "محدود"

            }

        };

        const item =
            labels[
                value
            ] ||
            labels.MINIMAL;

        return this.isArabic()
            ? item.ar
            : item.en;

    },

    getDirectionLabelLocalized(
        direction
    ) {

        const value =
            this.normalizeStatus(
                direction
            );

        const labels = {

            N: {

                en:
                    "North",

                ar:
                    "شمال"

            },

            NE: {

                en:
                    "North-East",

                ar:
                    "شمال شرقي"

            },

            E: {

                en:
                    "East",

                ar:
                    "شرق"

            },

            SE: {

                en:
                    "South-East",

                ar:
                    "جنوب شرقي"

            },

            S: {

                en:
                    "South",

                ar:
                    "جنوب"

            },

            SW: {

                en:
                    "South-West",

                ar:
                    "جنوب غربي"

            },

            W: {

                en:
                    "West",

                ar:
                    "غرب"

            },

            NW: {

                en:
                    "North-West",

                ar:
                    "شمال غربي"

            },

            STATIONARY: {

                en:
                    "Stationary",

                ar:
                    "ثابتة"

            },

            UNKNOWN: {

                en:
                    "Unknown",

                ar:
                    "غير معروف"

            }

        };

        const item =
            labels[
                value
            ] ||
            labels.UNKNOWN;

        return this.isArabic()
            ? item.ar
            : item.en;

    },

    getTrendLabel(
        trend
    ) {

        const value =
            this.normalizeStatus(
                trend
            );

        const labels = {

            NEW: {

                en:
                    "New",

                ar:
                    "جديدة"

            },

            RAPIDLY_GROWING: {

                en:
                    "Rapidly Growing",

                ar:
                    "تنمو بسرعة"

            },

            GROWING: {

                en:
                    "Growing",

                ar:
                    "نامية"

            },

            SLIGHTLY_GROWING: {

                en:
                    "Slightly Growing",

                ar:
                    "تنمو تدريجيًا"

            },

            STABLE: {

                en:
                    "Stable",

                ar:
                    "مستقرة"

            },

            SLIGHTLY_WEAKENING: {

                en:
                    "Slightly Weakening",

                ar:
                    "تضعف تدريجيًا"

            },

            WEAKENING: {

                en:
                    "Weakening",

                ar:
                    "تضعف"

            },

            RAPIDLY_WEAKENING: {

                en:
                    "Rapidly Weakening",

                ar:
                    "تضعف بسرعة"

            }

        };

        const item =
            labels[
                value
            ];

        return item
            ? this.isArabic()
                ? item.ar
                : item.en
            : value;

    },

    getLifecycleLabel(
        stage
    ) {

        const value =
            this.normalizeStatus(
                stage
            );

        const labels = {

            NEW: {

                en:
                    "New",

                ar:
                    "جديدة"

            },

            DEVELOPING: {

                en:
                    "Developing",

                ar:
                    "قيد التطور"

            },

            MATURE: {

                en:
                    "Mature",

                ar:
                    "ناضجة"

            },

            LONG_LIVED: {

                en:
                    "Long-Lived",

                ar:
                    "طويلة العمر"

            },

            TEMPORARILY_MISSING: {

                en:
                    "Temporarily Missing",

                ar:
                    "مفقودة مؤقتًا"

            },

            LOST: {

                en:
                    "Lost",

                ar:
                    "مفقودة"

            },

            ARCHIVED: {

                en:
                    "Archived",

                ar:
                    "مؤرشفة"

            }

        };

        const item =
            labels[
                value
            ];

        return item
            ? this.isArabic()
                ? item.ar
                : item.en
            : value;

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

    getLocale() {

        return this.isArabic()
            ? "ar-SA"
            : "en-US";

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

    firstNullableNumber(
        ...values
    ) {

        for (
            const value of values
        ) {

            if (
                value === null ||
                value === undefined ||
                value === ""
            ) {

                continue;

            }

            const number =
                Number(
                    value
                );

            if (
                Number.isFinite(
                    number
                )
            ) {

                return number;

            }

        }

        return null;

    },

    clamp(
        value,
        minimum = 0,
        maximum = 100
    ) {

        const number =
            this.safeNumber(
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

    },

    /* =====================================================
       STATUS NORMALIZATION
       ===================================================== */

    normalizeStatus(
        value
    ) {

        return String(
            value ??
            ""
        )
            .trim()
            .toUpperCase()
            .replaceAll(
                " ",
                "_"
            )
            .replaceAll(
                "-",
                "_"
            );

    },

    /* =====================================================
       HTML SAFETY
       ===================================================== */

    escapeHtml(
        value
    ) {

        return String(
            value ??
            ""
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
       RESET TRACKING
       ===================================================== */

    reset() {

        this.trackingInProgress =
            false;

        this.cycleNumber =
            0;

        this.lastTrackingAt =
            null;

        this.latestTrackingReport =
            null;

        this.activeCells =
            {};

        this.archivedCells =
            {};

        this.cityTransitions =
            [];

        try {

            localStorage.removeItem(
                this.storageKey
            );

            localStorage.removeItem(
                this.archiveStorageKey
            );

            localStorage.removeItem(
                this.transitionStorageKey
            );

        } catch (error) {

            console.warn(
                "Storm Cell Tracking storage reset skipped:",
                error
            );

        }

        window.RG31.ActiveStormCells =
            [];

        window.RG30.ActiveStormCells =
            [];

        window.RG31.latestStormTrackingReport =
            null;

        window.RG30.latestStormTrackingReport =
            null;

        this.renderStormTrackingPanel(
            null
        );

        this.writeLog(
            "Storm Cell Tracking Engine V31 reset.",
            "warning"
        );

        window.dispatchEvent(

            new CustomEvent(

                "rg31:storm-cell-tracking-reset",

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
       CLEAR ARCHIVE
       ===================================================== */

    clearArchive() {

        this.archivedCells =
            {};

        try {

            localStorage.removeItem(
                this.archiveStorageKey
            );

        } catch (error) {

            console.warn(
                "Storm archive clear skipped:",
                error
            );

        }

        this.saveState();

        this.writeLog(
            "Storm cell archive cleared.",
            "warning"
        );

        return true;

    },

    /* =====================================================
       CLEAR TRANSITIONS
       ===================================================== */

    clearTransitions() {

        this.cityTransitions =
            [];

        try {

            localStorage.removeItem(
                this.transitionStorageKey
            );

        } catch (error) {

            console.warn(
                "Storm transition clear skipped:",
                error
            );

        }

        this.saveState();

        this.writeLog(
            "Storm city transition history cleared.",
            "warning"
        );

        return true;

    },

    /* =====================================================
       EXPORT TRACKING STATE
       ===================================================== */

    exportState() {

        return JSON.stringify(

            {

                version:
                    this.version,

                cycleNumber:
                    this.cycleNumber,

                lastTrackingAt:
                    this.lastTrackingAt,

                activeCells:
                    this.activeCells,

                archivedCells:
                    this.archivedCells,

                cityTransitions:
                    this.cityTransitions,

                latestTrackingReport:
                    this.latestTrackingReport,

                exportedAt:
                    new Date()
                        .toISOString()

            },

            null,

            2

        );

    },

    /* =====================================================
       IMPORT TRACKING STATE
       ===================================================== */

    importState(
        payload
    ) {

        try {

            const parsed =
                typeof payload ===
                "string"
                    ? JSON.parse(
                        payload
                    )
                    : payload;

            if (
                !parsed ||
                typeof parsed !==
                    "object"
            ) {

                throw new Error(
                    "INVALID_STORM_TRACKING_STATE"
                );

            }

            this.cycleNumber =
                this.safeNumber(
                    parsed.cycleNumber,
                    this.cycleNumber
                );

            this.lastTrackingAt =
                parsed.lastTrackingAt ||
                this.lastTrackingAt;

            this.activeCells =
                parsed.activeCells &&
                typeof parsed.activeCells ===
                    "object"
                    ? parsed.activeCells
                    : {};

            this.archivedCells =
                parsed.archivedCells &&
                typeof parsed.archivedCells ===
                    "object"
                    ? parsed.archivedCells
                    : {};

            this.cityTransitions =
                Array.isArray(
                    parsed.cityTransitions
                )
                    ? parsed.cityTransitions.slice(
                        0,
                        this.config
                            .maximumTransitions
                    )
                    : [];

            this.latestTrackingReport =
                parsed.latestTrackingReport ||
                this.latestTrackingReport;

            this.limitActiveCells();

            this.limitArchivedCells();

            this.limitCityTransitions();

            this.saveState();

            this.renderStormTrackingPanel(
                this.latestTrackingReport
            );

            this.writeLog(
                "Storm Cell Tracking state imported successfully."
            );

            window.dispatchEvent(

                new CustomEvent(

                    "rg31:storm-cell-tracking-state-imported",

                    {
                        detail: {

                            activeCells:
                                this.getActiveCells(),

                            archivedCells:
                                this.getArchivedCells(),

                            transitions:
                                this.getCityTransitions(),

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
                "Storm Cell Tracking state import failed:",
                error
            );

            this.writeLog(

                `Storm tracking import failed: ${error?.message || String(error)}`,

                "danger"

            );

            return false;

        }

    },

    /* =====================================================
       MANUAL TRACKING
       ===================================================== */

    async runManualTracking(
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

        return this.trackFromVerification(

            sourceResults,

            sourceSummary

        );

    },

    /* =====================================================
       AUTOMATIC TRACKING CONTROL
       ===================================================== */

    setAutomaticTracking(
        enabled
    ) {

        this.config
            .automaticTracking =
            enabled ===
            true;

        this.saveState();

        this.writeLog(

            this.config
                .automaticTracking
                ? "Automatic storm tracking enabled."
                : "Automatic storm tracking disabled.",

            this.config
                .automaticTracking
                ? "success"
                : "warning"

        );

        return this.config
            .automaticTracking;

    },

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
            "[RainGuard V31 Storm Tracking]";

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
                    "Storm tracking commander log skipped:",
                    error
                );

            }

        }

    },

    /* =====================================================
       COMPATIBILITY ALIASES
       ===================================================== */

    registerCompatibilityAliases() {

        window.RG31.StormCellTrackingEngine =
            this;

        window.RG30.StormCellTrackingEngine =
            this;

        window.RG31.StormTracker =
            this;

        window.RG30.StormTracker =
            this;

        return true;

    },

    /* =====================================================
       DESTROY
       ===================================================== */

    destroy() {

        this.trackingInProgress =
            false;

        this.initialized =
            false;

        this.writeLog(
            "Storm Cell Tracking Engine V31 destroyed.",
            "warning"
        );

        window.dispatchEvent(

            new CustomEvent(

                "rg31:storm-cell-tracking-destroyed",

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

window.RG30.StormCellTrackingEngine =
    window.RG31.StormCellTrackingEngine;

window.RG30.StormTracker =
    window.RG31.StormCellTrackingEngine;

/* =========================================================
   GLOBAL SHORTCUTS
   ========================================================= */

window.runStormCellTrackingV31 =
    function (
        results,
        summary
    ) {

        return window.RG31
            .StormCellTrackingEngine
            .runManualTracking(
                results,
                summary
            );

    };

window.getStormTrackingStateV31 =
    function () {

        return window.RG31
            .StormCellTrackingEngine
            .getTrackingState();

    };

window.getStormTrackingDebugV31 =
    function () {

        return window.RG31
            .StormCellTrackingEngine
            .getDebugSnapshot();

    };

window.getActiveStormCellsV31 =
    function () {

        return window.RG31
            .StormCellTrackingEngine
            .getActiveCells();

    };

window.getArchivedStormCellsV31 =
    function () {

        return window.RG31
            .StormCellTrackingEngine
            .getArchivedCells();

    };

window.getStormCellByIdV31 =
    function (
        cellId
    ) {

        return window.RG31
            .StormCellTrackingEngine
            .getCellById(
                cellId
            );

    };

window.getStormCityTransitionsV31 =
    function (
        limit
    ) {

        return window.RG31
            .StormCellTrackingEngine
            .getCityTransitions(
                limit
            );

    };

window.enableStormTrackingV31 =
    function () {

        return window.RG31
            .StormCellTrackingEngine
            .setAutomaticTracking(
                true
            );

    };

window.disableStormTrackingV31 =
    function () {

        return window.RG31
            .StormCellTrackingEngine
            .setAutomaticTracking(
                false
            );

    };

window.resetStormTrackingV31 =
    function () {

        return window.RG31
            .StormCellTrackingEngine
            .reset();

    };

window.clearStormTrackingArchiveV31 =
    function () {

        return window.RG31
            .StormCellTrackingEngine
            .clearArchive();

    };

window.clearStormTransitionsV31 =
    function () {

        return window.RG31
            .StormCellTrackingEngine
            .clearTransitions();

    };

window.exportStormTrackingV31 =
    function () {

        return window.RG31
            .StormCellTrackingEngine
            .exportState();

    };

window.importStormTrackingV31 =
    function (
        payload
    ) {

        return window.RG31
            .StormCellTrackingEngine
            .importState(
                payload
            );

    };

window.destroyStormTrackingV31 =
    function () {

        return window.RG31
            .StormCellTrackingEngine
            .destroy();

    };

/* =========================================================
   AUTO START
   ========================================================= */

(function initializeStormCellTrackingV31() {

    const start =
        () => {

            try {

                const engine =
                    window.RG31
                        ?.StormCellTrackingEngine;

                if (
                    !engine
                ) {

                    console.error(
                        "Storm Cell Tracking Engine V31 was not found."
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
                                results.length &&
                                engine.config
                                    .automaticTracking ===
                                    true &&
                                !engine
                                    .trackingInProgress
                            ) {

                                engine
                                    .trackFromVerification(
                                        results,
                                        summary
                                    );

                            }

                        } catch (error) {

                            console.warn(
                                "Initial Storm Cell Tracking cycle skipped:",
                                error
                            );

                        }

                    },

                    6500

                );

                console.log(

                    "%cRainGuard AI V31 Storm Cell Tracking Engine Ready",

                    "color:#ffb347;font-weight:bold;font-size:14px;"

                );

            } catch (error) {

                console.error(
                    "Storm Cell Tracking Engine V31 initialization failed:",
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

    "%cRainGuard AI V31 Storm Cell Tracking Engine Loaded",

    "color:#ffb347;font-weight:bold;font-size:14px;"

);
