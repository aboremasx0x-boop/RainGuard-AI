/* ==========================================================
   RainGuard AI V31
   Storm Path Prediction Engine

   File:
   frontend/js/storm_path_prediction_engine_v31.js

   يعتمد على:
   Storm Cell Tracking Engine V31

   ========================================================== */

"use strict";

window.RG31 = window.RG31 || {};
window.RG30 = window.RG30 || {};

RG31.StormPathPredictionEngine = {

    version: "31.0.1",

    initialized: false,

    predictionInProgress: false,

    cycleNumber: 0,

    lastPredictionAt: null,

    latestPredictionReport: null,

    predictedPaths: {},

    storageKey:
        "rainguard_v31_storm_path_prediction",

    config: {

        enabled: true,

        automaticPrediction: true,

        predictionMinutes: [

            30,

            60,

            90,

            120

        ],

        minimumConfidence: 25,

        minimumCellIntensity: 20,

        earthRadiusKm: 6371,

        /* ==========================================
           CONFIDENCE DECAY
        ========================================== */

        confidenceDecay: {

            30: 1.00,

            60: 0.90,

            90: 0.80,

            120: 0.70

        },

        /* ==========================================
           INTENSITY EVOLUTION
        ========================================== */

        intensityModel: {

            RAPIDLY_GROWING: 1.18,

            GROWING: 1.10,

            SLIGHTLY_GROWING: 1.05,

            STABLE: 1.00,

            SLIGHTLY_WEAKENING: 0.95,

            WEAKENING: 0.90,

            RAPIDLY_WEAKENING: 0.82,

            NEW: 1.03

        },

        /* ==========================================
           RISK DECAY
        ========================================== */

        riskModel: {

            30: 1.00,

            60: 0.95,

            90: 0.88,

            120: 0.80

        },

        /* ==========================================
           MOVEMENT
        ========================================== */

        movement: {

            minimumSpeed: 3,

            maximumSpeed: 180,

            stationaryTolerance: 2

        },

        /* ==========================================
           DEBUG
        ========================================== */

        development: {

            enabled: true,

            logPrediction: true,

            exposeDebugState: true

        }

    },

    /* ======================================================
       INITIALIZATION
    ====================================================== */

    init() {

        if (this.initialized)
            return;

        this.initialized = true;

        this.loadState();

        this.bindEvents();

        this.writeLog(
            "Storm Path Prediction Engine initialized."
        );

        window.dispatchEvent(

            new CustomEvent(

                "rg31:path-prediction-ready",

                {

                    detail: {

                        version:
                            this.version,

                        timestamp:
                            new Date().toISOString()

                    }

                }

            )

        );

    },

    /* ======================================================
       EVENTS
    ====================================================== */

    bindEvents() {

        window.addEventListener(

            "rg31:storm-cell-tracking-completed",

            event => {

                if (!this.config.automaticPrediction)
                    return;

                const report =
                    event?.detail?.report ||
                    event?.detail ||
                    {};

                const activeCells =
                    Array.isArray(
                        report.activeCells
                    )
                        ? report.activeCells
                        : Array.isArray(
                            event?.detail?.activeCells
                        )
                            ? event.detail.activeCells
                            : [];

                this.predictStormPaths(
                    activeCells
                );

            }

        );

    },

    /* ======================================================
       MAIN ENTRY
    ====================================================== */

    async predictStormPaths(

        activeCells = []

    ) {

        if (!this.config.enabled)
            return null;

        if (this.predictionInProgress)
            return this.latestPredictionReport;

        this.predictionInProgress = true;

        this.cycleNumber++;

        this.lastPredictionAt =
            new Date().toISOString();

        try {

            const normalizedActiveCells =
                Array.isArray(
                    activeCells
                )
                    ? activeCells
                    : [];

            const paths = [];

            for (

                const cell

                of normalizedActiveCells

            ) {

                const prediction =
                    this.predictSingleCell(

                        cell

                    );

                if (prediction)
                    paths.push(prediction);

            }

            this.predictedPaths = {};

            paths.forEach(

                (
                    path,
                    index
                ) => {

                    const pathKey =
                        String(
                            path?.cellId ||
                            `storm_path_${this.cycleNumber}_${index}`
                        )
                            .trim();

                    this.predictedPaths[
                        pathKey
                    ] = {

                        ...path,

                        cellId:
                            path?.cellId ||
                            pathKey

                    };

                }

            );

            this.latestPredictionReport = {

                cycleNumber:
                    this.cycleNumber,

                activeCellCount:
                    normalizedActiveCells.length,

                predictionCount:
                    paths.length,

                predictions:
                    paths,

                timestamp:
                    this.lastPredictionAt

            };

            this.saveState();

            this.publishPredictionReport(

                this.latestPredictionReport

            );

            this.writeLog(

                `Predicted ${paths.length} storm paths.`

            );

            return this.latestPredictionReport;

        }

        finally {

            this.predictionInProgress = false;

        }

    },
      /* ======================================================
       PREDICT SINGLE CELL
    ====================================================== */

    predictSingleCell(
        cell = {}
    ) {

        if (
            !cell ||
            typeof cell !== "object"
        ) {

            return null;

        }

        const intensity =
            this.clamp(
                cell.intensity,
                0,
                100
            );

        const confidence =
            this.clamp(
                cell.confidence,
                0,
                100
            );

        if (
            intensity <
            this.config
                .minimumCellIntensity
        ) {

            return null;

        }

        if (
            confidence <
            this.config
                .minimumConfidence
        ) {

            return null;

        }

        const currentLat =
            this.firstNullableNumber(
                cell.currentLat,
                cell.lat
            );

        const currentLon =
            this.firstNullableNumber(
                cell.currentLon,
                cell.lon,
                cell.lng
            );

        if (
            currentLat === null ||
            currentLon === null
        ) {

            return null;

        }

        const speedKmh =
            this.normalizePredictionSpeed(
                cell.speedKmh
            );

        const directionDegrees =
            this.normalizePredictionDirection(
                cell.directionDegrees,
                cell.directionLabel
            );

        const trend =
            this.normalizeStatus(
                cell.trend || "STABLE"
            );

        const predictionPoints =
            this.config
                .predictionMinutes
                .map(
                    minutes =>
                        this.predictPoint({

                            cell,

                            minutes,

                            currentLat,

                            currentLon,

                            speedKmh,

                            directionDegrees,

                            trend

                        })
                );

        const impactedCities =
            this.collectPredictedImpactedCities(
                predictionPoints,
                cell
            );

        const pathConfidence =
            this.calculatePathConfidence(
                predictionPoints
            );

        const highestRiskPoint =
            this.getHighestRiskPredictionPoint(
                predictionPoints
            );

        return {

            cellId:
                cell.cellId,

            city:
                cell.city ||
                "Unknown",

            region:
                cell.region ||
                "",

            currentPosition: {

                lat:
                    currentLat,

                lon:
                    currentLon

            },

            currentIntensity:
                Math.round(
                    intensity
                ),

            currentRisk:
                Math.round(
                    this.clamp(
                        cell.riskScore,
                        0,
                        100
                    )
                ),

            currentConfidence:
                Math.round(
                    confidence
                ),

            speedKmh:
                Number(
                    speedKmh
                        .toFixed(
                            2
                        )
                ),

            directionDegrees:
                directionDegrees === null
                    ? null
                    : Number(
                        directionDegrees
                            .toFixed(
                                2
                            )
                    ),

            directionLabel:
                this.getDirectionLabel(
                    directionDegrees,
                    speedKmh
                ),

            trend,

            lifecycleStage:
                cell.lifecycleStage ||
                "UNKNOWN",

            simulated:
                cell.simulated ===
                true,

            forecasts:
                predictionPoints,

            impactedCities,

            pathConfidence:
                Math.round(
                    pathConfidence
                ),

            highestPredictedRisk:
                highestRiskPoint
                    ?.riskScore ||
                0,

            highestRiskMinutes:
                highestRiskPoint
                    ?.minutes ||
                null,

            generatedAt:
                this.lastPredictionAt ||
                new Date()
                    .toISOString()

        };

    },

    /* ======================================================
       PREDICT ONE FUTURE POINT
    ====================================================== */

    predictPoint({

        cell = {},

        minutes = 30,

        currentLat,

        currentLon,

        speedKmh,

        directionDegrees,

        trend

    } = {}) {

        const normalizedMinutes =
            Math.max(
                0,
                this.safeNumber(
                    minutes,
                    0
                )
            );

        const hours =
            normalizedMinutes /
            60;

        const distanceKm =
            speedKmh *
            hours;

        const projectedPosition =
            directionDegrees === null
                ? {

                    lat:
                        currentLat,

                    lon:
                        currentLon

                }
                : this.projectPosition({

                    lat:
                        currentLat,

                    lon:
                        currentLon,

                    bearingDegrees:
                        directionDegrees,

                    distanceKm

                });

        const confidence =
            this.calculatePredictionConfidence({

                cell,

                minutes:
                    normalizedMinutes,

                distanceKm,

                speedKmh

            });

        const intensity =
            this.calculatePredictedIntensity({

                currentIntensity:
                    cell.intensity,

                trend,

                minutes:
                    normalizedMinutes

            });

        const riskScore =
            this.calculatePredictedRisk({

                cell,

                predictedIntensity:
                    intensity,

                predictedConfidence:
                    confidence,

                minutes:
                    normalizedMinutes

            });

        const nearestCity =
            this.findNearestKnownCity(

                projectedPosition.lat,

                projectedPosition.lon

            );

        return {

            minutes:
                normalizedMinutes,

            timestamp:
                new Date(

                    Date.now() +
                    normalizedMinutes *
                    60000

                )
                .toISOString(),

            lat:
                projectedPosition.lat,

            lon:
                projectedPosition.lon,

            distanceKm:
                Number(
                    distanceKm
                        .toFixed(
                            2
                        )
                ),

            speedKmh:
                Number(
                    speedKmh
                        .toFixed(
                            2
                        )
                ),

            directionDegrees:
                directionDegrees === null
                    ? null
                    : Number(
                        directionDegrees
                            .toFixed(
                                2
                            )
                    ),

            directionLabel:
                this.getDirectionLabel(
                    directionDegrees,
                    speedKmh
                ),

            intensity:
                Math.round(
                    intensity
                ),

            confidence:
                Math.round(
                    confidence
                ),

            riskScore:
                Math.round(
                    riskScore
                ),

            riskLevel:
                this.getRiskLevel(
                    riskScore
                ),

            nearestCity:
                nearestCity
                    ?.city ||
                null,

            nearestCityDistanceKm:
                nearestCity
                    ? Number(
                        nearestCity
                            .distanceKm
                            .toFixed(
                                2
                            )
                    )
                    : null,

            simulated:
                cell.simulated ===
                true

        };

    },

    /* ======================================================
       SPEED NORMALIZATION
    ====================================================== */

    normalizePredictionSpeed(
        speedKmh
    ) {

        const speed =
            this.safeNumber(
                speedKmh,
                0
            );

        if (
            speed <=
            this.config
                .movement
                .stationaryTolerance
        ) {

            return 0;

        }

        return this.clamp(

            speed,

            this.config
                .movement
                .minimumSpeed,

            this.config
                .movement
                .maximumSpeed

        );

    },

    /* ======================================================
       DIRECTION NORMALIZATION
    ====================================================== */

    normalizePredictionDirection(
        directionDegrees,
        directionLabel
    ) {

        const direct =
            this.firstNullableNumber(
                directionDegrees
            );

        if (
            direct !== null
        ) {

            return (

                direct +
                360

            ) %
            360;

        }

        const value =
            this.normalizeStatus(
                directionLabel
            );

        const mapping = {

            N:
                0,

            NE:
                45,

            E:
                90,

            SE:
                135,

            S:
                180,

            SW:
                225,

            W:
                270,

            NW:
                315

        };

        return mapping[
            value
        ] ?? null;

    },

    /* ======================================================
       PREDICTION CONFIDENCE
    ====================================================== */

    calculatePredictionConfidence({

        cell = {},

        minutes = 30,

        distanceKm = 0,

        speedKmh = 0

    } = {}) {

        const baseConfidence =
            this.clamp(
                cell.confidence,
                0,
                100
            );

        const decay =
            this.safeNumber(

                this.config
                    .confidenceDecay[
                        minutes
                    ],

                Math.max(
                    0.50,
                    1 -
                    minutes /
                    300
                )

            );

        const trackingBonus =
            this.clamp(

                this.safeNumber(
                    cell.trackingCycles,
                    1
                ) *
                3,

                0,

                15

            );

        const historyBonus =
            this.clamp(

                (
                    Array.isArray(
                        cell.history
                    )
                        ? cell.history.length
                        : 0
                ) *
                1.5,

                0,

                12

            );

        const movementPenalty =
            speedKmh >
            100
                ? 8
                : speedKmh >
                    70
                    ? 5
                    : 0;

        const distancePenalty =
            this.clamp(

                distanceKm /
                10,

                0,

                12

            );

        let confidence =

            (
                baseConfidence +
                trackingBonus +
                historyBonus -
                movementPenalty -
                distancePenalty
            ) *
            decay;

        if (
            cell.simulated ===
            true
        ) {

            confidence *=
                0.75;

        }

        return this.clamp(
            confidence,
            0,
            100
        );

    },

    /* ======================================================
       PREDICTED INTENSITY
    ====================================================== */

    calculatePredictedIntensity({

        currentIntensity = 0,

        trend = "STABLE",

        minutes = 30

    } = {}) {

        const baseIntensity =
            this.clamp(
                currentIntensity,
                0,
                100
            );

        const normalizedTrend =
            this.normalizeStatus(
                trend
            );

        const trendMultiplier =
            this.safeNumber(

                this.config
                    .intensityModel[
                        normalizedTrend
                    ],

                1

            );

        const timeFactor =
            Math.max(
                1,
                minutes /
                30
            );

        const adjustedMultiplier =

            1 +

            (
                trendMultiplier -
                1
            ) *

            timeFactor;

        return this.clamp(

            baseIntensity *
            adjustedMultiplier,

            0,

            100

        );

    },

    /* ======================================================
       PREDICTED RISK
    ====================================================== */

    calculatePredictedRisk({

        cell = {},

        predictedIntensity = 0,

        predictedConfidence = 0,

        minutes = 30

    } = {}) {

        const currentRisk =
            this.clamp(
                cell.riskScore,
                0,
                100
            );

        const lightningScore =
            this.clamp(
                cell.lightningScore,
                0,
                100
            );

        const satelliteScore =
            this.clamp(
                cell.satelliteScore,
                0,
                100
            );

        const radarScore =
            this.clamp(
                cell.radarScore,
                0,
                100
            );

        const riskDecay =
            this.safeNumber(

                this.config
                    .riskModel[
                        minutes
                    ],

                Math.max(
                    0.65,
                    1 -
                    minutes /
                    450
                )

            );

        let risk =

            currentRisk *
                0.35 +

            predictedIntensity *
                0.30 +

            lightningScore *
                0.15 +

            satelliteScore *
                0.10 +

            radarScore *
                0.05 +

            predictedConfidence *
                0.05;

        risk *=
            riskDecay;

        if (
            cell.trend ===
                "RAPIDLY_GROWING" ||
            cell.trend ===
                "GROWING"
        ) {

            risk *=
                1.08;

        }

        if (
            cell.simulated ===
            true
        ) {

            risk =
                Math.min(
                    risk,
                    75
                );

        }

        return this.clamp(
            risk,
            0,
            100
        );

    },

    /* ======================================================
       PATH CONFIDENCE
    ====================================================== */

    calculatePathConfidence(
        points = []
    ) {

        if (
            !Array.isArray(
                points
            ) ||
            !points.length
        ) {

            return 0;

        }

        const total =
            points.reduce(

                (
                    sum,
                    point
                ) =>

                    sum +

                    this.safeNumber(
                        point.confidence,
                        0
                    ),

                0

            );

        return this.clamp(

            total /
            points.length,

            0,

            100

        );

    },

    /* ======================================================
       HIGHEST RISK POINT
    ====================================================== */

    getHighestRiskPredictionPoint(
        points = []
    ) {

        if (
            !Array.isArray(
                points
            ) ||
            !points.length
        ) {

            return null;

        }

        return [
            ...points
        ]
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
        )[0];

    },
      /* ======================================================
       COLLECT IMPACTED CITIES
    ====================================================== */

    collectPredictedImpactedCities(
        predictionPoints = [],
        cell = {}
    ) {

        const impactedCities =
            {};

        predictionPoints.forEach(
            point => {

                if (
                    !point ||
                    !point.nearestCity
                ) {

                    return;

                }

                const cityKey =
                    String(
                        point.nearestCity
                    )
                        .trim()
                        .toLowerCase();

                if (
                    !cityKey
                ) {

                    return;

                }

                if (
                    !impactedCities[
                        cityKey
                    ]
                ) {

                    impactedCities[
                        cityKey
                    ] = {

                        city:
                            point.nearestCity,

                        firstImpactMinutes:
                            point.minutes,

                        minimumDistanceKm:
                            this.safeNumber(
                                point.nearestCityDistanceKm,
                                999
                            ),

                        maximumRisk:
                            this.safeNumber(
                                point.riskScore,
                                0
                            ),

                        maximumIntensity:
                            this.safeNumber(
                                point.intensity,
                                0
                            ),

                        maximumConfidence:
                            this.safeNumber(
                                point.confidence,
                                0
                            ),

                        forecastPoints:
                            []

                    };

                }

                const item =
                    impactedCities[
                        cityKey
                    ];

                item.firstImpactMinutes =
                    Math.min(

                        item.firstImpactMinutes,

                        point.minutes

                    );

                item.minimumDistanceKm =
                    Math.min(

                        item.minimumDistanceKm,

                        this.safeNumber(
                            point.nearestCityDistanceKm,
                            999
                        )

                    );

                item.maximumRisk =
                    Math.max(

                        item.maximumRisk,

                        this.safeNumber(
                            point.riskScore,
                            0
                        )

                    );

                item.maximumIntensity =
                    Math.max(

                        item.maximumIntensity,

                        this.safeNumber(
                            point.intensity,
                            0
                        )

                    );

                item.maximumConfidence =
                    Math.max(

                        item.maximumConfidence,

                        this.safeNumber(
                            point.confidence,
                            0
                        )

                    );

                item.forecastPoints.push({

                    minutes:
                        point.minutes,

                    riskScore:
                        point.riskScore,

                    intensity:
                        point.intensity,

                    confidence:
                        point.confidence,

                    distanceKm:
                        point.nearestCityDistanceKm,

                    lat:
                        point.lat,

                    lon:
                        point.lon

                });

            }
        );

        return Object.values(
            impactedCities
        )
        .map(
            item => {

                return {

                    ...item,

                    minimumDistanceKm:
                        Number(

                            this.safeNumber(
                                item.minimumDistanceKm,
                                0
                            )
                            .toFixed(
                                2
                            )

                        ),

                    maximumRisk:
                        Math.round(
                            item.maximumRisk
                        ),

                    maximumIntensity:
                        Math.round(
                            item.maximumIntensity
                        ),

                    maximumConfidence:
                        Math.round(
                            item.maximumConfidence
                        ),

                    riskLevel:
                        this.getRiskLevel(
                            item.maximumRisk
                        ),

                    impactLevel:
                        this.getCityImpactLevel(
                            item
                        ),

                    sourceCellId:
                        cell.cellId ||
                        null

                };

            }
        )
        .sort(
            (
                first,
                second
            ) => {

                if (
                    first.firstImpactMinutes !==
                    second.firstImpactMinutes
                ) {

                    return (

                        first.firstImpactMinutes -
                        second.firstImpactMinutes

                    );

                }

                return (

                    second.maximumRisk -
                    first.maximumRisk

                );

            }
        );

    },

    /* ======================================================
       CITY IMPACT LEVEL
    ====================================================== */

    getCityImpactLevel(
        cityImpact = {}
    ) {

        const distanceKm =
            this.safeNumber(
                cityImpact.minimumDistanceKm,
                999
            );

        const risk =
            this.safeNumber(
                cityImpact.maximumRisk,
                0
            );

        const confidence =
            this.safeNumber(
                cityImpact.maximumConfidence,
                0
            );

        if (
            distanceKm <= 20 &&
            risk >= 75 &&
            confidence >= 55
        ) {

            return "DIRECT_HIGH_IMPACT";

        }

        if (
            distanceKm <= 40 &&
            risk >= 60
        ) {

            return "LIKELY_IMPACT";

        }

        if (
            distanceKm <= 70 &&
            risk >= 40
        ) {

            return "POSSIBLE_IMPACT";

        }

        return "MONITORING";

    },

    /* ======================================================
       FIND NEAREST KNOWN CITY
    ====================================================== */

    findNearestKnownCity(
        lat,
        lon
    ) {

        const latitude =
            this.firstNullableNumber(
                lat
            );

        const longitude =
            this.firstNullableNumber(
                lon
            );

        if (
            latitude === null ||
            longitude === null
        ) {

            return null;

        }

        const cities =
            this.getKnownCities();

        let nearestCity =
            null;

        cities.forEach(
            city => {

                const distanceKm =
                    this.calculateDistanceKm(

                        latitude,

                        longitude,

                        city.lat,

                        city.lon

                    );

                if (
                    !nearestCity ||
                    distanceKm <
                    nearestCity.distanceKm
                ) {

                    nearestCity = {

                        ...city,

                        distanceKm

                    };

                }

            }
        );

        return nearestCity;

    },

    /* ======================================================
       KNOWN CITIES
    ====================================================== */

    getKnownCities() {

        return [

            {
                city:
                    "Riyadh",

                cityAr:
                    "الرياض",

                lat:
                    24.7136,

                lon:
                    46.6753

            },

            {
                city:
                    "Jeddah",

                cityAr:
                    "جدة",

                lat:
                    21.4858,

                lon:
                    39.1925

            },

            {
                city:
                    "Makkah",

                cityAr:
                    "مكة",

                lat:
                    21.3891,

                lon:
                    39.8579

            },

            {
                city:
                    "Taif",

                cityAr:
                    "الطائف",

                lat:
                    21.2703,

                lon:
                    40.4158

            },

            {
                city:
                    "Abha",

                cityAr:
                    "أبها",

                lat:
                    18.2164,

                lon:
                    42.5053

            },

            {
                city:
                    "Najran",

                cityAr:
                    "نجران",

                lat:
                    17.5656,

                lon:
                    44.2289

            },

            {
                city:
                    "Dammam",

                cityAr:
                    "الدمام",

                lat:
                    26.4207,

                lon:
                    50.0888

            },

            {
                city:
                    "Madinah",

                cityAr:
                    "المدينة",

                lat:
                    24.5247,

                lon:
                    39.5692

            },

            {
                city:
                    "Jazan",

                cityAr:
                    "جازان",

                lat:
                    16.8892,

                lon:
                    42.5511

            },

            {
                city:
                    "Tabuk",

                cityAr:
                    "تبوك",

                lat:
                    28.3838,

                lon:
                    36.5550

            },

            {
                city:
                    "Hail",

                cityAr:
                    "حائل",

                lat:
                    27.5114,

                lon:
                    41.7208

            },

            {
                city:
                    "Buraydah",

                cityAr:
                    "بريدة",

                lat:
                    26.3592,

                lon:
                    43.9818

            },

            {
                city:
                    "Al Baha",

                cityAr:
                    "الباحة",

                lat:
                    20.0129,

                lon:
                    41.4677

            },

            {
                city:
                    "Khamis Mushait",

                cityAr:
                    "خميس مشيط",

                lat:
                    18.3064,

                lon:
                    42.7297

            },

            {
                city:
                    "Yanbu",

                cityAr:
                    "ينبع",

                lat:
                    24.0895,

                lon:
                    38.0618

            },

            {
                city:
                    "Al Ahsa",

                cityAr:
                    "الأحساء",

                lat:
                    25.3830,

                lon:
                    49.5860

            },

            {
                city:
                    "Hafar Al Batin",

                cityAr:
                    "حفر الباطن",

                lat:
                    28.4328,

                lon:
                    45.9708

            },

            {
                city:
                    "Sakaka",

                cityAr:
                    "سكاكا",

                lat:
                    29.9697,

                lon:
                    40.2064

            },

            {
                city:
                    "Arar",

                cityAr:
                    "عرعر",

                lat:
                    30.9753,

                lon:
                    41.0381

            }

        ];

    },

    /* ======================================================
       DISTANCE - HAVERSINE
    ====================================================== */

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

        return this.config
            .earthRadiusKm *
            c;

    },

    /* ======================================================
       PROJECT POSITION
    ====================================================== */

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
            Math.max(

                0,

                this.safeNumber(
                    distanceKm,
                    0
                )

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

        const angularDistance =
            distance /
            this.config
                .earthRadiusKm;

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

        const predictedLatitude =
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

        const predictedLongitude =

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
                    predictedLatitude
                )

            );

        return {

            lat:
                Number(

                    toDegrees(
                        predictedLatitude
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
                                predictedLongitude
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

    /* ======================================================
       DIRECTION LABEL
    ====================================================== */

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
                .movement
                .stationaryTolerance
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

    /* ======================================================
       RISK LEVEL
    ====================================================== */

    getRiskLevel(
        riskScore
    ) {

        const value =
            this.clamp(
                riskScore,
                0,
                100
            );

        if (
            value >= 80
        ) {

            return "SEVERE";

        }

        if (
            value >= 65
        ) {

            return "HIGH";

        }

        if (
            value >= 45
        ) {

            return "MODERATE";

        }

        if (
            value >= 25
        ) {

            return "LOW";

        }

        return "MINIMAL";

    },
      /* ======================================================
       SAVE STATE
    ====================================================== */

    saveState() {

        try {

            const state = {

                version:
                    this.version,

                cycleNumber:
                    this.cycleNumber,

                lastPredictionAt:
                    this.lastPredictionAt,

                latestPredictionReport:
                    this.latestPredictionReport,

                predictedPaths:
                    this.predictedPaths,

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

            return true;

        } catch (error) {

            console.warn(
                "Storm Path Prediction state save failed:",
                error
            );

            return false;

        }

    },

    /* ======================================================
       LOAD STATE
    ====================================================== */

    loadState() {

        try {

            const savedState =
                localStorage.getItem(
                    this.storageKey
                );

            if (
                !savedState
            ) {

                return false;

            }

            const parsed =
                JSON.parse(
                    savedState
                );

            if (
                !parsed ||
                typeof parsed !==
                    "object"
            ) {

                return false;

            }

            this.cycleNumber =
                this.safeNumber(
                    parsed.cycleNumber,
                    0
                );

            this.lastPredictionAt =
                parsed.lastPredictionAt ||
                null;

            this.latestPredictionReport =
                parsed.latestPredictionReport ||
                null;

            this.predictedPaths =
                parsed.predictedPaths &&
                typeof parsed.predictedPaths ===
                    "object"
                    ? parsed.predictedPaths
                    : {};

            return true;

        } catch (error) {

            console.warn(
                "Storm Path Prediction state load failed:",
                error
            );

            this.predictedPaths =
                {};

            this.latestPredictionReport =
                null;

            return false;

        }

    },

    /* ======================================================
       PUBLISH PREDICTION REPORT
    ====================================================== */

    publishPredictionReport(
        report
    ) {

        if (
            !report
        ) {

            return;

        }

        const publishedPredictions =
            this.getPredictedPaths();

        window.RG31.latestStormPathPrediction =
            report;

        window.RG30.latestStormPathPrediction =
            report;

        window.RG31.PredictedStormPaths =
            publishedPredictions;

        window.RG30.PredictedStormPaths =
            publishedPredictions;

        window.RG31.predictedStormPaths =
            publishedPredictions;

        window.RG30.predictedStormPaths =
            publishedPredictions;

        const detail = {

            report,

            predictions:
                publishedPredictions,

            timestamp:
                this.lastPredictionAt,

            version:
                this.version

        };

        window.dispatchEvent(

            new CustomEvent(

                "rg31:storm-path-prediction-completed",

                {
                    detail
                }

            )

        );

        window.dispatchEvent(

            new CustomEvent(

                "rg30:storm-path-prediction-completed",

                {
                    detail
                }

            )

        );

        window.dispatchEvent(

            new CustomEvent(

                "rg31:storm-paths-updated",

                {
                    detail: {

                        predictions:
                            publishedPredictions,

                        cycleNumber:
                            this.cycleNumber,

                        timestamp:
                            this.lastPredictionAt

                    }
                }

            )

        );

        this.renderStormPredictionPanel(
            report
        );

    },

    /* ======================================================
       GET PREDICTED PATHS
    ====================================================== */

    getPredictedPaths() {

        return Object.values(
            this.predictedPaths
        )
        .sort(
            (
                first,
                second
            ) => {

                const riskDifference =

                    this.safeNumber(
                        second.highestPredictedRisk,
                        0
                    ) -

                    this.safeNumber(
                        first.highestPredictedRisk,
                        0
                    );

                if (
                    riskDifference !==
                    0
                ) {

                    return riskDifference;

                }

                return (

                    this.safeNumber(
                        second.pathConfidence,
                        0
                    ) -

                    this.safeNumber(
                        first.pathConfidence,
                        0
                    )

                );

            }
        )
        .map(
            prediction => ({

                ...prediction,

                forecasts:
                    Array.isArray(
                        prediction.forecasts
                    )
                        ? prediction.forecasts.map(
                            point => ({
                                ...point
                            })
                        )
                        : [],

                impactedCities:
                    Array.isArray(
                        prediction.impactedCities
                    )
                        ? prediction.impactedCities.map(
                            city => ({
                                ...city,

                                forecastPoints:
                                    Array.isArray(
                                        city.forecastPoints
                                    )
                                        ? city.forecastPoints.map(
                                            point => ({
                                                ...point
                                            })
                                        )
                                        : []

                            })
                        )
                        : []

            })
        );

    },

    /* ======================================================
       GET PREDICTION BY CELL ID
    ====================================================== */

    getPredictionByCellId(
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

        const prediction =
            this.predictedPaths[
                id
            ];

        if (
            !prediction
        ) {

            return null;

        }

        return {

            ...prediction,

            forecasts:
                Array.isArray(
                    prediction.forecasts
                )
                    ? prediction.forecasts.map(
                        point => ({
                            ...point
                        })
                    )
                    : [],

            impactedCities:
                Array.isArray(
                    prediction.impactedCities
                )
                    ? prediction.impactedCities.map(
                        city => ({
                            ...city,

                            forecastPoints:
                                Array.isArray(
                                    city.forecastPoints
                                )
                                    ? city.forecastPoints.map(
                                        point => ({
                                            ...point
                                        })
                                    )
                                    : []

                        })
                    )
                    : []

        };

    },

    /* ======================================================
       GET PREDICTION STATE
    ====================================================== */

    getPredictionState() {

        return {

            version:
                this.version,

            initialized:
                this.initialized,

            enabled:
                this.config.enabled,

            automaticPrediction:
                this.config
                    .automaticPrediction,

            predictionInProgress:
                this.predictionInProgress,

            cycleNumber:
                this.cycleNumber,

            lastPredictionAt:
                this.lastPredictionAt,

            predictionCount:
                Object.keys(
                    this.predictedPaths
                )
                .length,

            predictions:
                this.getPredictedPaths(),

            latestPredictionReport:
                this.latestPredictionReport

        };

    },

    /* ======================================================
       DEBUG SNAPSHOT
    ====================================================== */

    getDebugSnapshot() {

        return {

            engine:
                "StormPathPredictionEngine",

            version:
                this.version,

            config:
                this.config,

            state:
                this.getPredictionState(),

            predictedPaths:
                this.predictedPaths,

            latestPredictionReport:
                this.latestPredictionReport,

            timestamp:
                new Date()
                    .toISOString()

        };

    },

    /* ======================================================
       STORM PREDICTION PANEL
    ====================================================== */

    renderStormPredictionPanel(
        report =
            this.latestPredictionReport
    ) {

        const panel =
            document.getElementById(
                "stormPathPredictionPanel"
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

                        "No storm path prediction report is available yet.",

                        "لا يتوفر تقرير لتوقع مسارات العواصف حتى الآن."

                    )}

                </div>

            `;

            return;

        }

        const predictions =
            Array.isArray(
                report.predictions
            )
                ? report.predictions
                : this.getPredictedPaths();

        const cards =
            predictions.length
                ? predictions
                    .map(
                        prediction =>
                            this.renderPredictionCard(
                                prediction
                            )
                    )
                    .join("")
                : `

                    <div class="item success">

                        ${this.text(

                            "No storm paths are currently predicted.",

                            "لا توجد مسارات عواصف متوقعة حاليًا."

                        )}

                    </div>

                `;

        panel.innerHTML = `

            <div class="item info">

                <h3>

                    ${this.text(

                        "Storm Path Prediction Summary V31",

                        "ملخص توقع مسارات العواصف V31"

                    )}

                </h3>

                <b>

                    ${this.text(
                        "Prediction Cycle",
                        "دورة التنبؤ"
                    )}:

                </b>

                ${this.safeNumber(
                    report.cycleNumber,
                    0
                )}

                <br>

                <b>

                    ${this.text(
                        "Predicted Paths",
                        "المسارات المتوقعة"
                    )}:

                </b>

                ${this.safeNumber(
                    report.predictionCount,
                    0
                )}

                <br>

                <b>

                    ${this.text(
                        "Generated",
                        "وقت الإنشاء"
                    )}:

                </b>

                ${report.timestamp
                    ? new Date(
                        report.timestamp
                    )
                    .toLocaleString(
                        this.getLocale()
                    )
                    : "--"
                }

            </div>

            ${cards}

        `;

    },

    /* ======================================================
       PREDICTION CARD
    ====================================================== */

    renderPredictionCard(
        prediction = {}
    ) {

        const riskClass =
            this.getRiskClass(
                this.getRiskLevel(
                    prediction.highestPredictedRisk
                )
            );

        const forecastRows =
            this.renderForecastRows(
                prediction.forecasts
            );

        const impactedCities =
            this.renderImpactedCities(
                prediction.impactedCities
            );

        return `

            <div class="item ${riskClass}">

                <h3>

                    ${this.escapeHtml(
                        prediction.cellId ||
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
                    prediction.city ||
                    "--"
                )}

                <br>

                <b>

                    ${this.text(
                        "Current Intensity",
                        "الشدة الحالية"
                    )}:

                </b>

                ${this.safeNumber(
                    prediction.currentIntensity,
                    0
                )}%

                <br>

                <b>

                    ${this.text(
                        "Current Risk",
                        "الخطر الحالي"
                    )}:

                </b>

                ${this.safeNumber(
                    prediction.currentRisk,
                    0
                )}%

                <br>

                <b>

                    ${this.text(
                        "Path Confidence",
                        "ثقة المسار"
                    )}:

                </b>

                ${this.safeNumber(
                    prediction.pathConfidence,
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
                        prediction.speedKmh,
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
                    prediction.directionLabel
                )}

                <br>

                <b>

                    ${this.text(
                        "Trend",
                        "اتجاه النمو"
                    )}:

                </b>

                ${this.getTrendLabel(
                    prediction.trend
                )}

                <br>

                <b>

                    ${this.text(
                        "Highest Predicted Risk",
                        "أعلى خطر متوقع"
                    )}:

                </b>

                ${this.safeNumber(
                    prediction.highestPredictedRisk,
                    0
                )}%

                <br>

                <b>

                    ${this.text(
                        "Highest Risk Time",
                        "وقت أعلى خطر"
                    )}:

                </b>

                ${prediction.highestRiskMinutes !==
                    null &&
                    prediction.highestRiskMinutes !==
                    undefined
                    ? `${prediction.highestRiskMinutes} ${this.text(
                        "minutes",
                        "دقيقة"
                    )}`
                    : "--"
                }

                ${
                    prediction.simulated ===
                    true
                        ? `

                            <br><br>

                            <span class="verification-warning">

                                ${this.text(

                                    "This prediction includes simulated source data.",

                                    "يتضمن هذا التنبؤ بيانات مصدر محاكاة."

                                )}

                            </span>

                        `
                        : ""
                }

            </div>

            <div class="item info">

                <h3>

                    ${this.text(
                        "Forecast Points",
                        "نقاط التنبؤ"
                    )}

                </h3>

                ${forecastRows}

            </div>

            <div class="item info">

                <h3>

                    ${this.text(
                        "Expected Impacted Cities",
                        "المدن المتوقع تأثرها"
                    )}

                </h3>

                ${impactedCities}

            </div>

        `;

    },

    /* ======================================================
       FORECAST ROWS
    ====================================================== */

    renderForecastRows(
        forecasts = []
    ) {

        if (
            !Array.isArray(
                forecasts
            ) ||
            !forecasts.length
        ) {

            return this.text(
                "No forecast points are available.",
                "لا تتوفر نقاط تنبؤ."
            );

        }

        return forecasts
            .map(
                point => `

                    <div class="verification-source-row">

                        <b>

                            ${this.text(
                                "After",
                                "بعد"
                            )}
                            ${this.safeNumber(
                                point.minutes,
                                0
                            )}
                            ${this.text(
                                "minutes",
                                "دقيقة"
                            )}

                        </b>

                        <br>

                        ${this.text(
                            "Position",
                            "الموقع"
                        )}:
                        ${this.safeNumber(
                            point.lat,
                            0
                        ).toFixed(4)},
                        ${this.safeNumber(
                            point.lon,
                            0
                        ).toFixed(4)}

                        <br>

                        ${this.text(
                            "Nearest City",
                            "أقرب مدينة"
                        )}:
                        ${this.escapeHtml(
                            point.nearestCity ||
                            "--"
                        )}

                        <br>

                        ${this.text(
                            "Distance to City",
                            "المسافة إلى المدينة"
                        )}:
                        ${point.nearestCityDistanceKm !==
                            null &&
                            point.nearestCityDistanceKm !==
                            undefined
                            ? `${Number(
                                point.nearestCityDistanceKm
                            ).toFixed(1)} km`
                            : "--"
                        }

                        <br>

                        ${this.text(
                            "Intensity",
                            "الشدة"
                        )}:
                        ${this.safeNumber(
                            point.intensity,
                            0
                        )}%

                        &nbsp;|&nbsp;

                        ${this.text(
                            "Risk",
                            "الخطر"
                        )}:
                        ${this.safeNumber(
                            point.riskScore,
                            0
                        )}%

                        &nbsp;|&nbsp;

                        ${this.text(
                            "Confidence",
                            "الثقة"
                        )}:
                        ${this.safeNumber(
                            point.confidence,
                            0
                        )}%

                    </div>

                `
            )
            .join("");

    },

    /* ======================================================
       IMPACTED CITIES
    ====================================================== */

    renderImpactedCities(
        impactedCities = []
    ) {

        if (
            !Array.isArray(
                impactedCities
            ) ||
            !impactedCities.length
        ) {

            return this.text(
                "No city impact is currently expected.",
                "لا يُتوقع تأثر أي مدينة حاليًا."
            );

        }

        return impactedCities
            .map(
                city => `

                    <div class="verification-source-row">

                        <b>

                            ${this.escapeHtml(
                                city.city ||
                                "--"
                            )}

                        </b>

                        <br>

                        ${this.text(
                            "First Impact",
                            "أول تأثير"
                        )}:
                        ${this.safeNumber(
                            city.firstImpactMinutes,
                            0
                        )}
                        ${this.text(
                            "minutes",
                            "دقيقة"
                        )}

                        <br>

                        ${this.text(
                            "Minimum Distance",
                            "أقل مسافة"
                        )}:
                        ${Number(
                            this.safeNumber(
                                city.minimumDistanceKm,
                                0
                            )
                        )
                        .toFixed(
                            1
                        )} km

                        <br>

                        ${this.text(
                            "Maximum Risk",
                            "أعلى خطر"
                        )}:
                        ${this.safeNumber(
                            city.maximumRisk,
                            0
                        )}%

                        <br>

                        ${this.text(
                            "Impact Level",
                            "مستوى التأثير"
                        )}:
                        ${this.getImpactLevelLabel(
                            city.impactLevel
                        )}

                    </div>

                `
            )
            .join("");

    },
      /* ======================================================
       RISK CLASS
    ====================================================== */

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

    /* ======================================================
       DIRECTION LABEL LOCALIZED
    ====================================================== */

    getDirectionLabelLocalized(
        direction
    ) {

        const value =
            this.normalizeStatus(
                direction
            );

        const labels = {

            N: {
                en: "North",
                ar: "شمال"
            },

            NE: {
                en: "North-East",
                ar: "شمال شرقي"
            },

            E: {
                en: "East",
                ar: "شرق"
            },

            SE: {
                en: "South-East",
                ar: "جنوب شرقي"
            },

            S: {
                en: "South",
                ar: "جنوب"
            },

            SW: {
                en: "South-West",
                ar: "جنوب غربي"
            },

            W: {
                en: "West",
                ar: "غرب"
            },

            NW: {
                en: "North-West",
                ar: "شمال غربي"
            },

            STATIONARY: {
                en: "Stationary",
                ar: "ثابتة"
            },

            UNKNOWN: {
                en: "Unknown",
                ar: "غير معروف"
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

    /* ======================================================
       TREND LABEL
    ====================================================== */

    getTrendLabel(
        trend
    ) {

        const value =
            this.normalizeStatus(
                trend
            );

        const labels = {

            RAPIDLY_GROWING: {
                en: "Rapidly Growing",
                ar: "تنمو بسرعة"
            },

            GROWING: {
                en: "Growing",
                ar: "نامية"
            },

            SLIGHTLY_GROWING: {
                en: "Slightly Growing",
                ar: "تنمو تدريجيًا"
            },

            STABLE: {
                en: "Stable",
                ar: "مستقرة"
            },

            SLIGHTLY_WEAKENING: {
                en: "Slightly Weakening",
                ar: "تضعف تدريجيًا"
            },

            WEAKENING: {
                en: "Weakening",
                ar: "تضعف"
            },

            RAPIDLY_WEAKENING: {
                en: "Rapidly Weakening",
                ar: "تضعف بسرعة"
            },

            NEW: {
                en: "New",
                ar: "جديدة"
            },

            UNKNOWN: {
                en: "Unknown",
                ar: "غير معروف"
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

    /* ======================================================
       IMPACT LEVEL LABEL
    ====================================================== */

    getImpactLevelLabel(
        impactLevel
    ) {

        const value =
            this.normalizeStatus(
                impactLevel
            );

        const labels = {

            DIRECT_HIGH_IMPACT: {
                en: "Direct High Impact",
                ar: "تأثير مباشر مرتفع"
            },

            LIKELY_IMPACT: {
                en: "Likely Impact",
                ar: "تأثير مرجح"
            },

            POSSIBLE_IMPACT: {
                en: "Possible Impact",
                ar: "تأثير محتمل"
            },

            MONITORING: {
                en: "Monitoring",
                ar: "تحت المراقبة"
            },

            UNKNOWN: {
                en: "Unknown",
                ar: "غير معروف"
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

    /* ======================================================
       LANGUAGE HELPERS
    ====================================================== */

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

    /* ======================================================
       NUMERIC HELPERS
    ====================================================== */

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

    /* ======================================================
       STATUS NORMALIZATION
    ====================================================== */

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

    /* ======================================================
       HTML SAFETY
    ====================================================== */

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

    /* ======================================================
       RESET
    ====================================================== */

    reset() {

        this.predictionInProgress =
            false;

        this.cycleNumber =
            0;

        this.lastPredictionAt =
            null;

        this.latestPredictionReport =
            null;

        this.predictedPaths =
            {};

        try {

            localStorage.removeItem(
                this.storageKey
            );

        } catch (error) {

            console.warn(
                "Storm Path Prediction storage reset skipped:",
                error
            );

        }

        window.RG31.latestStormPathPrediction =
            null;

        window.RG30.latestStormPathPrediction =
            null;

        window.RG31.PredictedStormPaths =
            [];

        window.RG30.PredictedStormPaths =
            [];

        window.RG31.predictedStormPaths =
            [];

        window.RG30.predictedStormPaths =
            [];

        this.renderStormPredictionPanel(
            null
        );

        this.writeLog(
            "Storm Path Prediction Engine V31 reset.",
            "warning"
        );

        window.dispatchEvent(

            new CustomEvent(

                "rg31:storm-path-prediction-reset",

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

    /* ======================================================
       EXPORT STATE
    ====================================================== */

    exportState() {

        return JSON.stringify(

            {

                version:
                    this.version,

                cycleNumber:
                    this.cycleNumber,

                lastPredictionAt:
                    this.lastPredictionAt,

                predictedPaths:
                    this.predictedPaths,

                latestPredictionReport:
                    this.latestPredictionReport,

                exportedAt:
                    new Date()
                        .toISOString()

            },

            null,

            2

        );

    },

    /* ======================================================
       IMPORT STATE
    ====================================================== */

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
                    "INVALID_STORM_PATH_PREDICTION_STATE"
                );

            }

            this.cycleNumber =
                this.safeNumber(
                    parsed.cycleNumber,
                    this.cycleNumber
                );

            this.lastPredictionAt =
                parsed.lastPredictionAt ||
                this.lastPredictionAt;

            this.predictedPaths =
                parsed.predictedPaths &&
                typeof parsed.predictedPaths ===
                    "object"
                    ? parsed.predictedPaths
                    : {};

            this.latestPredictionReport =
                parsed.latestPredictionReport ||
                this.latestPredictionReport;

            this.saveState();

            this.renderStormPredictionPanel(
                this.latestPredictionReport
            );

            this.writeLog(
                "Storm Path Prediction state imported successfully."
            );

            window.dispatchEvent(

                new CustomEvent(

                    "rg31:storm-path-prediction-state-imported",

                    {
                        detail: {

                            predictions:
                                this.getPredictedPaths(),

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
                "Storm Path Prediction state import failed:",
                error
            );

            this.writeLog(

                `Storm path import failed: ${error?.message || String(error)}`,

                "danger"

            );

            return false;

        }

    },

    /* ======================================================
       MANUAL PREDICTION
    ====================================================== */

    async runManualPrediction(
        activeCells = null
    ) {

        const tracker =

            window.RG31
                ?.StormCellTrackingEngine ||

            window.RG30
                ?.StormCellTrackingEngine;

        const cells =
            Array.isArray(
                activeCells
            )
                ? activeCells
                : tracker
                    ?.getActiveCells?.() ||
                [];

        return this.predictStormPaths(
            cells
        );

    },

    /* ======================================================
       AUTOMATIC PREDICTION CONTROL
    ====================================================== */

    setAutomaticPrediction(
        enabled
    ) {

        this.config
            .automaticPrediction =
            enabled ===
            true;

        this.saveState();

        this.writeLog(

            this.config
                .automaticPrediction
                ? "Automatic storm path prediction enabled."
                : "Automatic storm path prediction disabled.",

            this.config
                .automaticPrediction
                ? "success"
                : "warning"

        );

        return this.config
            .automaticPrediction;

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

    /* ======================================================
       LOGGING
    ====================================================== */

    writeLog(
        message,
        type = "success"
    ) {

        const prefix =
            "[RainGuard V31 Storm Path Prediction]";

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
                    "Storm prediction commander log skipped:",
                    error
                );

            }

        }

    },

    /* ======================================================
       COMPATIBILITY ALIASES
    ====================================================== */

    registerCompatibilityAliases() {

        window.RG31.StormPathPredictionEngine =
            this;

        window.RG30.StormPathPredictionEngine =
            this;

        window.RG31.StormPathPredictor =
            this;

        window.RG30.StormPathPredictor =
            this;

        const publishedPredictions =
            this.getPredictedPaths();

        window.RG31.PredictedStormPaths =
            publishedPredictions;

        window.RG30.PredictedStormPaths =
            publishedPredictions;

        window.RG31.predictedStormPaths =
            publishedPredictions;

        window.RG30.predictedStormPaths =
            publishedPredictions;

        return true;

    },

    /* ======================================================
       DESTROY
    ====================================================== */

    destroy() {

        this.predictionInProgress =
            false;

        this.initialized =
            false;

        this.writeLog(
            "Storm Path Prediction Engine V31 destroyed.",
            "warning"
        );

        window.dispatchEvent(

            new CustomEvent(

                "rg31:storm-path-prediction-destroyed",

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

window.RG30.StormPathPredictionEngine =
    window.RG31.StormPathPredictionEngine;

window.RG30.StormPathPredictor =
    window.RG31.StormPathPredictionEngine;

/* =========================================================
   GLOBAL SHORTCUTS
   ========================================================= */

window.runStormPathPredictionV31 =
    function (
        activeCells
    ) {

        return window.RG31
            .StormPathPredictionEngine
            .runManualPrediction(
                activeCells
            );

    };

window.getStormPathPredictionStateV31 =
    function () {

        return window.RG31
            .StormPathPredictionEngine
            .getPredictionState();

    };

window.getStormPathPredictionDebugV31 =
    function () {

        return window.RG31
            .StormPathPredictionEngine
            .getDebugSnapshot();

    };

window.getPredictedStormPathsV31 =
    function () {

        return window.RG31
            .StormPathPredictionEngine
            .getPredictedPaths();

    };

window.getStormPathPredictionByCellIdV31 =
    function (
        cellId
    ) {

        return window.RG31
            .StormPathPredictionEngine
            .getPredictionByCellId(
                cellId
            );

    };

window.enableStormPathPredictionV31 =
    function () {

        return window.RG31
            .StormPathPredictionEngine
            .setAutomaticPrediction(
                true
            );

    };

window.disableStormPathPredictionV31 =
    function () {

        return window.RG31
            .StormPathPredictionEngine
            .setAutomaticPrediction(
                false
            );

    };

window.resetStormPathPredictionV31 =
    function () {

        return window.RG31
            .StormPathPredictionEngine
            .reset();

    };

window.exportStormPathPredictionV31 =
    function () {

        return window.RG31
            .StormPathPredictionEngine
            .exportState();

    };

window.importStormPathPredictionV31 =
    function (
        payload
    ) {

        return window.RG31
            .StormPathPredictionEngine
            .importState(
                payload
            );

    };

window.destroyStormPathPredictionV31 =
    function () {

        return window.RG31
            .StormPathPredictionEngine
            .destroy();

    };

/* =========================================================
   AUTO START
   ========================================================= */

(function initializeStormPathPredictionV31() {

    const start =
        () => {

            try {

                const engine =
                    window.RG31
                        ?.StormPathPredictionEngine;

                if (
                    !engine
                ) {

                    console.error(
                        "Storm Path Prediction Engine V31 was not found."
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

                            const tracker =

                                window.RG31
                                    ?.StormCellTrackingEngine ||

                                window.RG30
                                    ?.StormCellTrackingEngine;

                            const activeCells =
                                tracker
                                    ?.getActiveCells?.() ||
                                [];

                            if (
                                Array.isArray(
                                    activeCells
                                ) &&
                                activeCells.length &&
                                engine
                                    .config
                                    .automaticPrediction ===
                                    true &&
                                !engine
                                    .predictionInProgress
                            ) {

                                engine
                                    .predictStormPaths(
                                        activeCells
                                    );

                            }

                        } catch (error) {

                            console.warn(
                                "Initial Storm Path Prediction cycle skipped:",
                                error
                            );

                        }

                    },

                    7500

                );

                console.log(

                    "%cRainGuard AI V31 Storm Path Prediction Engine Ready",

                    "color:#a78bfa;font-weight:bold;font-size:14px;"

                );

            } catch (error) {

                console.error(
                    "Storm Path Prediction Engine V31 initialization failed:",
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

    "%cRainGuard AI V31 Storm Path Prediction Engine Loaded",

    "color:#a78bfa;font-weight:bold;font-size:14px;"

);
