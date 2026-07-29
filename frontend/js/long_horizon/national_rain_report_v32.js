/* ==========================================================================
   RainGuard AI V32
   National Rain Status Report Engine

   Generates:
   - National rain status report
   - Rain forecast for 6 / 12 / 24 / 48 / 72 hours
   - Printable HTML
   - Browser PDF export
   - Automatic connection to "إنشاء التقرير" button
   ========================================================================== */

(function initializeNationalRainReportV32(global) {
    "use strict";

    const VERSION =
        "32.2.0";

    const BUILD =
        "V32";

    const MODULE_NAME =
        "NationalRainReportV32";

    /* ======================================================================
       SECTION 1
       BASIC UTILITIES
       ====================================================================== */

    function now() {
        return Date.now();
    }

    function safeArray(value) {
        return Array.isArray(value)
            ? value
            : [];
    }

    function safeObject(value) {
        return (
            value &&
            typeof value ===
                "object" &&
            !Array.isArray(value)
        )
            ? value
            : {};
    }

    function toFiniteNumber(
        value,
        fallback = 0
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
        return Math.min(
            maximum,
            Math.max(
                minimum,
                value
            )
        );
    }

    function escapeHTML(value) {
        return String(
            value ??
            ""
        )
            .replaceAll(
                "&",
                "&amp;"
            )
            .replaceAll(
                "<",
                "&lt;"
            )
            .replaceAll(
                ">",
                "&gt;"
            )
            .replaceAll(
                "\"",
                "&quot;"
            )
            .replaceAll(
                "'",
                "&#039;"
            );
    }

    function formatArabicDate(
        timestamp = now()
    ) {
        try {
            return new Intl.DateTimeFormat(
                "ar-SA",
                {
                    dateStyle:
                        "full",

                    timeStyle:
                        "medium",

                    timeZone:
                        "Asia/Riyadh"
                }
            ).format(
                new Date(
                    timestamp
                )
            );

        } catch (error) {
            return new Date(
                timestamp
            ).toLocaleString(
                "ar-SA"
            );
        }
    }

    function normalizePercentage(
        value
    ) {
        let numeric =
            toFiniteNumber(
                value,
                0
            );

        if (
            numeric >= 0 &&
            numeric <= 1
        ) {
            numeric *=
                100;
        }

        return clamp(
            numeric,
            0,
            100
        );
    }

    function firstDefined(
        ...values
    ) {
        return values.find(
            value =>
                value !==
                    undefined &&
                value !==
                    null
        );
    }

    function firstArray(
        ...values
    ) {
        return values.find(
            value =>
                Array.isArray(
                    value
                ) &&
                value.length >
                    0
        ) || [];
    }

    function normalizeRainValue(
        value
    ) {
        if (
            value &&
            typeof value ===
                "object"
        ) {
            return toFiniteNumber(
                firstDefined(
                    value.amount,
                    value.rain,
                    value.rainfall,
                    value.precipitation,
                    value.total,
                    value.value,
                    0
                ),
                0
            );
        }

        return toFiniteNumber(
            value,
            0
        );
    }

    /* ======================================================================
       SECTION 2
       SAUDI REGIONS
       ====================================================================== */

    const SAUDI_REGIONS =
        Object.freeze([
            {
                id:
                    "riyadh",

                ar:
                    "منطقة الرياض",

                en:
                    "Riyadh"
            },
            {
                id:
                    "makkah",

                ar:
                    "منطقة مكة المكرمة",

                en:
                    "Makkah"
            },
            {
                id:
                    "madinah",

                ar:
                    "منطقة المدينة المنورة",

                en:
                    "Madinah"
            },
            {
                id:
                    "qassim",

                ar:
                    "منطقة القصيم",

                en:
                    "Al-Qassim"
            },
            {
                id:
                    "eastern",

                ar:
                    "المنطقة الشرقية",

                en:
                    "Eastern Province"
            },
            {
                id:
                    "asir",

                ar:
                    "منطقة عسير",

                en:
                    "Asir"
            },
            {
                id:
                    "tabuk",

                ar:
                    "منطقة تبوك",

                en:
                    "Tabuk"
            },
            {
                id:
                    "hail",

                ar:
                    "منطقة حائل",

                en:
                    "Hail"
            },
            {
                id:
                    "northern_borders",

                ar:
                    "منطقة الحدود الشمالية",

                en:
                    "Northern Borders"
            },
            {
                id:
                    "jazan",

                ar:
                    "منطقة جازان",

                en:
                    "Jazan"
            },
            {
                id:
                    "najran",

                ar:
                    "منطقة نجران",

                en:
                    "Najran"
            },
            {
                id:
                    "baha",

                ar:
                    "منطقة الباحة",

                en:
                    "Al-Baha"
            },
            {
                id:
                    "jouf",

                ar:
                    "منطقة الجوف",

                en:
                    "Al-Jouf"
            }
        ]);

    /* ======================================================================
       SECTION 3
       REPORT ENGINE
       ====================================================================== */

    class NationalRainReportV32 {

        constructor(
            options = {}
        ) {
            this.id =
                "national_rain_report_v32_" +
                now();

            this.version =
                VERSION;

            this.build =
                BUILD;

            this.moduleName =
                MODULE_NAME;

            this.options = {
                reportTitle:
                    options.reportTitle ||
                    "التقرير الوطني لحالة الأمطار",

                organizationName:
                    options.organizationName ||
                    "RainGuard AI V30",

                autoBindButton:
                    options.autoBindButton !==
                    false,

                includeAllRegions:
                    options.includeAllRegions !==
                    false,

                openPrintDialog:
                    options.openPrintDialog !==
                    false
            };

            this.state = {
                initialized:
                    false,

                buttonBound:
                    false,

                reportCount:
                    0,

                lastGeneratedAt:
                    null,

                lastReport:
                    null,

                lastError:
                    null
            };
        }

        /* ==================================================================
           SECTION 4
           INITIALIZE
           ================================================================== */

        initialize() {
            this.state.initialized =
                true;

            if (
                this.options
                    .autoBindButton
            ) {
                this.bindReportButton();
            }

            return this.getStatus();
        }

        /* ==================================================================
           SECTION 5
           ENGINE RESOLUTION
           ================================================================== */

        resolveCore() {
            return (
                global
                    .RainArrivalRecoveryCoreV32Instance ||
                global
                    .LongHorizonRecoveryCoreV32Instance ||
                global
                    .RecoveryReopeningV32Instance
                    ?.core ||
                null
            );
        }

        resolveDashboard() {
            return (
                global
                    .NationalAIDashboardV32Instance ||
                this.resolveCore()
                    ?.dashboard ||
                null
            );
        }

        resolveForecastEngine() {
            return (
                global
                    .LongHorizonForecastEngineV32Instance ||
                global
                    .RainArrivalPredictionEngineV32Instance ||
                this.resolveCore()
                    ?.forecastEngine ||
                null
            );
        }

        resolveArrivalEngine() {
            return (
                global
                    .RainArrivalPredictionEngineV32Instance ||
                global
                    .RainArrivalIntegrationV32Instance ||
                this.resolveCore()
                    ?.arrivalEngine ||
                null
            );
        }

        resolveVerificationEngine() {
            return (
                global
                    .VerificationEngineV30Instance ||
                global
                    .VerificationEngineV31Instance ||
                null
            );
        }

        resolveStormTrackingEngine() {
            return (
                global
                    .StormCellTrackingEngineV31Instance ||
                global
                    .StormTrackingEngineV31Instance ||
                null
            );
        }

        resolvePathPredictionEngine() {
            return (
                global
                    .StormPathPredictionEngineV31Instance ||
                global
                    .StormPathPredictionEngineV32Instance ||
                null
            );
        }

        /* ==================================================================
           SECTION 6
           COLLECT RAW DATA
           ================================================================== */

        collectRawData() {
            const core =
                this.resolveCore();

            const dashboard =
                this.resolveDashboard();

            const forecastEngine =
                this.resolveForecastEngine();

            const arrivalEngine =
                this.resolveArrivalEngine();

            const verificationEngine =
                this.resolveVerificationEngine();

            const stormTrackingEngine =
                this.resolveStormTrackingEngine();

            const pathPredictionEngine =
                this.resolvePathPredictionEngine();
           const latestNationalForecast =
    forecastEngine
        ?.getLatestNationalForecast?.() ||
    forecastEngine
        ?.state
        ?.latestNationalForecast ||
    core
        ?.latestNationalForecast ||
    core
        ?.state
        ?.latestNationalForecast ||
    null;

            return {
                core,

                dashboard,

                forecastEngine,

               latestNationalForecast,

                arrivalEngine,

                verificationEngine,

                stormTrackingEngine,

                pathPredictionEngine,

                coreState:
                    core?.getState?.() ||
                    core?.state ||
                    null,

                dashboardState:
                    dashboard?.getState?.() ||
                    dashboard?.state ||
                    null,

                forecastState:
                    forecastEngine?.getState?.() ||
                    forecastEngine?.state ||
                    null,

                arrivalState:
                    arrivalEngine?.getState?.() ||
                    arrivalEngine?.state ||
                    null,

                verificationState:
                    verificationEngine?.getState?.() ||
                    verificationEngine?.state ||
                    null,

                trackingState:
                    stormTrackingEngine?.getState?.() ||
                    stormTrackingEngine?.state ||
                    null,

                pathState:
                    pathPredictionEngine?.getState?.() ||
                    pathPredictionEngine?.state ||
                    null
            };
        }

        /* ==================================================================
           SECTION 7
           EXTRACT NATIONAL SUMMARY
           ================================================================== */

       extractNationalSummary(
    raw
) {
    const coreState =
        safeObject(
            raw.coreState
        );

    const verificationState =
        safeObject(
            raw.verificationState
        );

    const dashboardState =
        safeObject(
            raw.dashboardState
        );

    const latestNationalForecast =
        safeObject(
            raw.latestNationalForecast
        );

    const forecastNationalSummary =
        safeObject(
            latestNationalForecast
                .nationalSummary
        );

    const nationalConfidence =
        normalizePercentage(
            firstDefined(
                forecastNationalSummary
                    .nationalConfidencePercent,

                forecastNationalSummary
                    .nationalConfidence,

                verificationState
                    .nationalConfidence,

                verificationState
                    .confidence,

                coreState
                    .nationalConfidence,

                dashboardState
                    .confidence,

                0
            )
        );

    const nationalStatus =
        firstDefined(
            latestNationalForecast
                .status,

            verificationState
                .nationalStatus,

            verificationState
                .status,

            coreState
                .nationalStatus,

            coreState
                .status,

            "غير محدد"
        );

    const highestRiskCity =
        firstDefined(
            forecastNationalSummary
                .highestRiskCity,

            verificationState
                .highestRiskCity,

            coreState
                .highestRiskCity,

            dashboardState
                .highestRiskCity,

            "غير محدد"
        );

    const highestRisk =
        normalizePercentage(
            firstDefined(
                forecastNationalSummary
                    .highestRiskScorePercent,

                forecastNationalSummary
                    .highestRiskScore,

                verificationState
                    .highestRisk,

                coreState
                    .highestRisk,

                dashboardState
                    .highestRisk,

                0
            )
        );

    return {
        totalCities:
            toFiniteNumber(
                firstDefined(
                    forecastNationalSummary
                        .totalCities,

                    latestNationalForecast
                        .cityForecasts
                        ?.length,

                    0
                ),
                0
            ),

        totalRegions:
            toFiniteNumber(
                firstDefined(
                    forecastNationalSummary
                        .totalRegions,

                    latestNationalForecast
                        .regionForecasts
                        ?.length,

                    0
                ),
                0
            ),

        rainyCities:
            toFiniteNumber(
                forecastNationalSummary
                    .rainyCities,
                0
            ),

        activeArrivalPredictions:
            toFiniteNumber(
                forecastNationalSummary
                    .activeArrivalPredictions,
                0
            ),

        nationalConfidence,

        nationalStatus,

        highestRiskCity:
            typeof highestRiskCity ===
                "object"
                ? firstDefined(
                    highestRiskCity
                        .nameAr,

                    highestRiskCity
                        .name,

                    highestRiskCity
                        .city,

                    "غير محدد"
                )
                : highestRiskCity,

        highestRisk,

        generatedAt:
            firstDefined(
                latestNationalForecast
                    .generatedAt,

                now()
            )
    };
}

        /* ==================================================================
           SECTION 8
           EXTRACT FORECAST COLLECTIONS
           ================================================================== */

        extractForecastCollections(
    raw
) {
    const coreState =
        safeObject(
            raw.coreState
        );

    const forecastState =
        safeObject(
            raw.forecastState
        );

    const arrivalState =
        safeObject(
            raw.arrivalState
        );

    const dashboardState =
        safeObject(
            raw.dashboardState
        );

    const latestNationalForecast =
        safeObject(
            raw.latestNationalForecast
        );

    const forecasts =
        firstArray(
            latestNationalForecast
                .regionForecasts,

            latestNationalForecast
                .cityForecasts,

            forecastState
                .regionForecasts,

            forecastState
                .cityForecasts,

            coreState
                .regionForecasts,

            coreState
                .cityForecasts,

            coreState
                .forecasts,

            coreState
                .predictions,

            forecastState
                .forecasts,

            forecastState
                .predictions,

            arrivalState
                .cityPredictions,

            arrivalState
                .regionPredictions,

            arrivalState
                .predictions,

            dashboardState
                .forecastData,

            dashboardState
                .latestForecast
        );

    const horizonForecasts =
        firstDefined(
            latestNationalForecast
                .horizonForecasts,

            latestNationalForecast
                .longHorizonForecast,

            forecastState
                .horizonForecasts,

            forecastState
                .longHorizonForecast,

            coreState
                .horizonForecasts,

            coreState
                .longHorizonForecast,

            dashboardState
                .longHorizonForecast,

            null
        );

    return {
        forecasts:
            safeArray(
                forecasts
            ),

        cityForecasts:
            safeArray(
                latestNationalForecast
                    .cityForecasts
            ),

        regionForecasts:
            safeArray(
                latestNationalForecast
                    .regionForecasts
            ),

        nationalSummary:
            safeObject(
                latestNationalForecast
                    .nationalSummary
            ),

        horizonForecasts
    };
}

        /* ==================================================================
           SECTION 9
           HORIZON DATA RESOLUTION
           ================================================================== */

        resolveHorizonValue(
            source,
            hours
        ) {
            const safeSource =
                safeObject(
                    source
                );

            const horizons =
                safeObject(
                    firstDefined(
                        safeSource.horizons,
                        safeSource.horizonForecasts,
                        safeSource.forecastHorizons,
                        safeSource.longHorizon,
                        safeSource.longHorizonForecast,
                        {}
                    )
                );

            const hourKey =
                String(hours);

            const hourKeyWithH =
                hourKey + "h";

            const directValue =
                firstDefined(
                    safeSource[
                        "rain" +
                        hourKey
                    ],

                    safeSource[
                        "rain" +
                        hourKeyWithH
                    ],

                    safeSource[
                        "precipitation" +
                        hourKeyWithH
                    ],

                    safeSource[
                        "totalRain" +
                        hourKeyWithH
                    ],

                    safeSource[
                        "forecast" +
                        hourKeyWithH
                    ],

                    safeSource[
                        "horizon" +
                        hourKey
                    ],

                    horizons[
                        hourKey
                    ],

                    horizons[
                        hourKeyWithH
                    ],

                    horizons[
                        "h" +
                        hourKey
                    ],

                    horizons[
                        "hour" +
                        hourKey
                    ]
                );

            return normalizeRainValue(
                directValue
            );
        }

        /* ==================================================================
           SECTION 10
           NORMALIZE REGION ROW
           ================================================================== */

        normalizeRegionRow(
            region,
            source = {}
        ) {
            const safeSource =
                safeObject(
                    source
                );

            const rainNow =
                normalizeRainValue(
                    firstDefined(
                        safeSource.rainNow,
                        safeSource.currentRain,
                        safeSource.rain,
                        safeSource.precipitation,
                        safeSource.rainIntensity,
                        0
                    )
                );

            const rain6 =
                this.resolveHorizonValue(
                    safeSource,
                    6
                );

            const rain12 =
                this.resolveHorizonValue(
                    safeSource,
                    12
                );

            const rain24 =
                this.resolveHorizonValue(
                    safeSource,
                    24
                );

            const rain48 =
                this.resolveHorizonValue(
                    safeSource,
                    48
                );

            const rain72 =
                this.resolveHorizonValue(
                    safeSource,
                    72
                );

            const confidence =
                normalizePercentage(
                    firstDefined(
                        safeSource.confidence,
                        safeSource.score,
                        safeSource.probability,
                        safeSource.rainProbability,
                        0
                    )
                );

            const risk =
                normalizePercentage(
                    firstDefined(
                        safeSource.risk,
                        safeSource.riskScore,
                        safeSource.floodRisk,
                        safeSource.floodRiskScore,
                        0
                    )
                );

            const etaMinutes =
                toFiniteNumber(
                    firstDefined(
                        safeSource.etaMinutes,
                        safeSource.arrivalMinutes,
                        safeSource.minutesToArrival,
                        safeSource.eta,
                        -1
                    ),
                    -1
                );

            const hasFutureRain =
                rain6 >
                    0 ||
                rain12 >
                    0 ||
                rain24 >
                    0 ||
                rain48 >
                    0 ||
                rain72 >
                    0;

            const status =
                firstDefined(
                    safeSource.statusAr,
                    safeSource.weatherStatusAr,
                    safeSource.rainStatusAr,
                    safeSource.status,
                    safeSource.weatherStatus,
                    safeSource.rainStatus,

                    rainNow > 0
                        ? "أمطار حالية"
                        : (
                            etaMinutes >= 0 ||
                            hasFutureRain
                        )
                            ? "أمطار متوقعة"
                            : "لا توجد أمطار مؤثرة"
                );

            return {
                id:
                    region.id,

                region:
                    region.ar,

                regionEn:
                    region.en,

                status,

                rainNow,

                rain6,

                rain12,

                rain24,

                rain48,

                rain72,

                confidence,

                risk,

                etaMinutes,

                arrivalText:
                    this.formatArrivalTime(
                        etaMinutes,
                        rainNow,
                        hasFutureRain
                    ),

                riskLevel:
                    this.getRiskLevel(
                        risk
                    ),

                source:
                    safeSource
            };
        }

        /* ==================================================================
           SECTION 11
           REGION MATCHING
           ================================================================== */

        findRegionForecast(
            region,
            forecasts
        ) {
            const regionTokens =
                [
                    region.id,
                    region.ar,
                    region.en
                ]
                    .map(
                        value =>
                            String(
                                value
                            )
                                .toLowerCase()
                                .trim()
                    );

            return safeArray(
                forecasts
            ).find(
                forecast => {

                    const safeForecast =
                        safeObject(
                            forecast
                        );

                    const candidates =
                        [
                            safeForecast.regionId,
                            safeForecast.region,
                            safeForecast.regionAr,
                            safeForecast.regionName,
                            safeForecast.name,
                            safeForecast.nameAr,
                            safeForecast.city,
                            safeForecast.cityName,
                            safeForecast.location,
                            safeForecast.locationName
                        ]
                            .filter(
                                Boolean
                            )
                            .map(
                                value =>
                                    String(
                                        value
                                    )
                                        .toLowerCase()
                                        .trim()
                            );

                    return candidates.some(
                        candidate =>
                            regionTokens.some(
                                token =>
                                    candidate.includes(
                                        token
                                    ) ||
                                    token.includes(
                                        candidate
                                    )
                            )
                    );
                }
            ) || null;
        }

        /* ==================================================================
           SECTION 12
           BUILD REGION ROWS
           ================================================================== */

        buildRegionRows(
            forecasts
        ) {
            const rows =
                SAUDI_REGIONS.map(
                    region => {

                        const source =
                            this.findRegionForecast(
                                region,
                                forecasts
                            );

                        return this.normalizeRegionRow(
                            region,
                            source ||
                            {}
                        );
                    }
                );

            return rows.sort(
                (
                    first,
                    second
                ) =>
                    second.risk -
                        first.risk ||
                    second.rainNow -
                        first.rainNow ||
                    second.rain6 -
                        first.rain6 ||
                    second.rain12 -
                        first.rain12 ||
                    second.rain24 -
                        first.rain24 ||
                    second.confidence -
                        first.confidence
            );
        }

        /* ==================================================================
           SECTION 13
           FORMAT ARRIVAL
           ================================================================== */

        formatArrivalTime(
            etaMinutes,
            rainNow = 0,
            hasFutureRain = false
        ) {
            if (
                rainNow >
                0
            ) {
                return "الآن";
            }

            if (
                Number.isFinite(
                    etaMinutes
                ) &&
                etaMinutes >=
                    0
            ) {
                if (
                    etaMinutes <
                    60
                ) {
                    return (
                        "خلال " +
                        Math.round(
                            etaMinutes
                        ) +
                        " دقيقة"
                    );
                }

                const hours =
                    etaMinutes /
                    60;

                if (
                    hours <
                    24
                ) {
                    return (
                        "خلال " +
                        hours.toFixed(
                            hours < 10
                                ? 1
                                : 0
                        ) +
                        " ساعة"
                    );
                }

                const days =
                    hours /
                    24;

                return (
                    "خلال " +
                    days.toFixed(
                        1
                    ) +
                    " يوم"
                );
            }

            if (
                hasFutureRain
            ) {
                return "متوقع خلال فترة التقرير";
            }

            return "غير متوقع حاليًا";
        }

        getRiskLevel(
            risk
        ) {
            if (
                risk >=
                80
            ) {
                return "شديد جدًا";
            }

            if (
                risk >=
                60
            ) {
                return "مرتفع";
            }

            if (
                risk >=
                30
            ) {
                return "متوسط";
            }

            if (
                risk >
                0
            ) {
                return "منخفض";
            }

            return "لا يوجد";
        }

        /* ==================================================================
           SECTION 14
           NATIONAL STATISTICS
           ================================================================== */

        calculateStatistics(
            rows,
            summary
        ) {
            const rainyRows =
                rows.filter(
                    row =>
                        row.rainNow >
                        0
                );

            const expectedRows =
                rows.filter(
                    row =>
                        row.rainNow <=
                            0 &&
                        (
                            row.etaMinutes >=
                                0 ||
                            row.rain6 >
                                0 ||
                            row.rain12 >
                                0 ||
                            row.rain24 >
                                0 ||
                            row.rain48 >
                                0 ||
                            row.rain72 >
                                0
                        )
                );

            const highRiskRows =
                rows.filter(
                    row =>
                        row.risk >=
                        60
                );

            const averageConfidence =
                rows.length
                    ? rows.reduce(
                        (
                            total,
                            row
                        ) =>
                            total +
                            row.confidence,
                        0
                    ) /
                    rows.length
                    : 0;

            const highestRainRow =
                [...rows]
                    .sort(
                        (
                            first,
                            second
                        ) =>
                            Math.max(
                                second.rainNow,
                                second.rain6,
                                second.rain12,
                                second.rain24,
                                second.rain48,
                                second.rain72
                            ) -
                            Math.max(
                                first.rainNow,
                                first.rain6,
                                first.rain12,
                                first.rain24,
                                first.rain48,
                                first.rain72
                            )
                    )[0] ||
                null;

            return {
                regionCount:
                    rows.length,

                rainyRegionCount:
                    rainyRows.length,

                expectedRegionCount:
                    expectedRows.length,

                highRiskRegionCount:
                    highRiskRows.length,

                averageConfidence,

                highestRainRegion:
                    highestRainRow
                        ?.region ||
                    "غير محدد",

                highestRainAmount:
                    highestRainRow
                        ? Math.max(
                            highestRainRow
                                .rainNow,
                            highestRainRow
                                .rain6,
                            highestRainRow
                                .rain12,
                            highestRainRow
                                .rain24,
                            highestRainRow
                                .rain48,
                            highestRainRow
                                .rain72
                        )
                        : 0,

                highestRiskCity:
                    summary.highestRiskCity,

                nationalConfidence:
                    summary.nationalConfidence
            };
        }

        /* ==================================================================
           SECTION 15
           EXECUTIVE SUMMARY
           ================================================================== */

        generateExecutiveSummary(
            rows,
            summary,
            statistics
        ) {
            const rainy =
                rows.filter(
                    row =>
                        row.rainNow >
                        0
                );

            const expected =
                rows.filter(
                    row =>
                        row.rainNow <=
                            0 &&
                        (
                            row.etaMinutes >=
                                0 ||
                            row.rain6 >
                                0 ||
                            row.rain12 >
                                0 ||
                            row.rain24 >
                                0 ||
                            row.rain48 >
                                0 ||
                            row.rain72 >
                                0
                        )
                );

            const highestRisk =
                [...rows]
                    .sort(
                        (
                            first,
                            second
                        ) =>
                            second.risk -
                            first.risk
                    )[0] ||
                null;

            const sections =
                [];

            if (
                rainy.length >
                0
            ) {
                sections.push(
                    "تشير البيانات الحالية إلى وجود أمطار في " +
                    rainy.length +
                    " من مناطق المملكة، وتشمل أبرز الحالات: " +
                    rainy
                        .slice(
                            0,
                            4
                        )
                        .map(
                            row =>
                                row.region
                        )
                        .join(
                            "، "
                        ) +
                    "."
                );
            } else {
                sections.push(
                    "لا تُظهر البيانات الحالية أمطارًا مؤثرة مسجلة لحظة إصدار التقرير."
                );
            }

            if (
                expected.length >
                0
            ) {
                const orderedExpected =
                    [...expected]
                        .sort(
                            (
                                first,
                                second
                            ) => {

                                const firstEta =
                                    first.etaMinutes >=
                                        0
                                        ? first.etaMinutes
                                        : Number
                                            .MAX_SAFE_INTEGER;

                                const secondEta =
                                    second.etaMinutes >=
                                        0
                                        ? second.etaMinutes
                                        : Number
                                            .MAX_SAFE_INTEGER;

                                return (
                                    firstEta -
                                    secondEta
                                );
                            }
                        );

                const nearest =
                    orderedExpected[0];

                sections.push(
                    "توجد مؤشرات على أمطار متوقعة في " +
                    expected.length +
                    " منطقة، وأبرزها " +
                    nearest.region +
                    "، ووقت الوصول المسجل: " +
                    nearest.arrivalText +
                    "."
                );
            }

            if (
                highestRisk &&
                highestRisk.risk >
                0
            ) {
                sections.push(
                    "أعلى مستوى خطورة مسجل في " +
                    highestRisk.region +
                    " بنسبة " +
                    Math.round(
                        highestRisk.risk
                    ) +
                    "%، وتصنيف الخطورة " +
                    highestRisk.riskLevel +
                    "."
                );
            }

            sections.push(
                "يعرض التقرير التوقعات التراكمية للأمطار خلال 6 و12 و24 و48 و72 ساعة."
            );

            sections.push(
                "بلغ متوسط الثقة في بيانات التقرير " +
                Math.round(
                    statistics
                        .averageConfidence
                ) +
                "%، بينما بلغت الثقة الوطنية العامة " +
                Math.round(
                    summary
                        .nationalConfidence
                ) +
                "%."
            );

            return sections.join(
                " "
            );
        }

        /* ==================================================================
           SECTION 16
           BUILD REPORT MODEL
           ================================================================== */

        buildReportModel() {
            const raw =
                this.collectRawData();

            const summary =
                this.extractNationalSummary(
                    raw
                );

            const collections =
                this.extractForecastCollections(
                    raw
                );

            const rows =
                this.buildRegionRows(
                    collections.forecasts
                );

            const statistics =
                this.calculateStatistics(
                    rows,
                    summary
                );

            const executiveSummary =
                this.generateExecutiveSummary(
                    rows,
                    summary,
                    statistics
                );

            return {
                id:
                    "national_rain_report_" +
                    now(),

                version:
                    VERSION,

                generatedAt:
                    now(),

                generatedAtText:
                    formatArabicDate(),

                title:
                    this.options
                        .reportTitle,

                organizationName:
                    this.options
                        .organizationName,

                summary,

                statistics,

                executiveSummary,

                rows,

                horizonForecasts:
                    collections
                        .horizonForecasts,

                rawAvailability: {
                    core:
                        Boolean(
                            raw.core
                        ),

                    dashboard:
                        Boolean(
                            raw.dashboard
                        ),

                    forecastEngine:
                        Boolean(
                            raw.forecastEngine
                        ),

                    arrivalEngine:
                        Boolean(
                            raw.arrivalEngine
                        ),

                    verificationEngine:
                        Boolean(
                            raw.verificationEngine
                        ),

                    stormTrackingEngine:
                        Boolean(
                            raw.stormTrackingEngine
                        ),

                    pathPredictionEngine:
                        Boolean(
                            raw.pathPredictionEngine
                        )
                }
            };
        }

        /* ==================================================================
           SECTION 17
           REPORT HTML
           ================================================================== */

        buildReportHTML(
            report
        ) {
            const rowsHTML =
                report.rows
                    .map(
                        (
                            row,
                            index
                        ) => `
                            <tr>
                                <td>
                                    ${index + 1}
                                </td>

                                <td class="region-name">
                                    ${escapeHTML(
                                        row.region
                                    )}
                                </td>

                                <td>
                                    ${escapeHTML(
                                        row.status
                                    )}
                                </td>

                                <td>
                                    ${row.rainNow.toFixed(1)}
                                </td>

                                <td>
                                    ${row.rain6.toFixed(1)}
                                </td>

                                <td>
                                    ${row.rain12.toFixed(1)}
                                </td>

                                <td>
                                    ${row.rain24.toFixed(1)}
                                </td>

                                <td>
                                    ${row.rain48.toFixed(1)}
                                </td>

                                <td>
                                    ${row.rain72.toFixed(1)}
                                </td>

                                <td>
                                    ${escapeHTML(
                                        row.arrivalText
                                    )}
                                </td>

                                <td>
                                    ${Math.round(
                                        row.confidence
                                    )}%
                                </td>

                                <td>
                                    ${Math.round(
                                        row.risk
                                    )}%
                                </td>

                                <td>
                                    ${escapeHTML(
                                        row.riskLevel
                                    )}
                                </td>
                            </tr>
                        `
                    )
                    .join(
                        ""
                    );

            return `
<!DOCTYPE html>
<html lang="ar" dir="rtl">

<head>
    <meta charset="UTF-8">

    <meta
        name="viewport"
        content="width=device-width, initial-scale=1.0"
    >

    <title>
        ${escapeHTML(report.title)}
    </title>

    <style>
        * {
            box-sizing: border-box;
        }

        body {
            margin: 0;
            background: #eef3f8;
            color: #102a43;
            font-family:
                Arial,
                Tahoma,
                sans-serif;
            direction: rtl;
        }

        .report-page {
            width: 297mm;
            min-height: 210mm;
            margin: 20px auto;
            padding: 12mm;
            background: #ffffff;
            box-shadow:
                0 4px 25px
                rgba(0, 0, 0, 0.12);
        }

        .report-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-bottom:
                4px solid
                #1296db;
            padding-bottom: 16px;
            margin-bottom: 18px;
        }

        .brand-block h1 {
            margin: 0;
            font-size: 28px;
            color: #0b3558;
        }

        .brand-block p {
            margin: 7px 0 0;
            color: #54738d;
            font-size: 14px;
        }

        .version-badge {
            display: flex;
            width: 68px;
            height: 68px;
            border-radius: 50%;
            align-items: center;
            justify-content: center;
            color: #ffffff;
            background: #1296db;
            font-size: 22px;
            font-weight: bold;
        }

        .report-meta {
            background: #f5f9fc;
            border: 1px solid #d8e7f1;
            border-radius: 10px;
            padding: 12px 16px;
            margin-bottom: 16px;
            font-size: 13px;
            line-height: 1.8;
        }

        .summary-grid {
            display: grid;
            grid-template-columns:
                repeat(4, 1fr);
            gap: 10px;
            margin-bottom: 18px;
        }

        .summary-card {
            border: 1px solid #d8e7f1;
            border-radius: 10px;
            padding: 12px 10px;
            text-align: center;
            background:
                linear-gradient(
                    180deg,
                    #ffffff,
                    #f4f9fd
                );
        }

        .summary-card .label {
            color: #58748c;
            font-size: 12px;
            margin-bottom: 8px;
        }

        .summary-card .value {
            color: #0c4169;
            font-size: 22px;
            font-weight: bold;
        }

        .section-title {
            margin: 20px 0 10px;
            padding-right: 10px;
            border-right:
                5px solid
                #1296db;
            color: #0b3558;
            font-size: 19px;
        }

        .executive-summary {
            background: #f3f9fd;
            border-right:
                5px solid
                #1296db;
            border-radius: 8px;
            padding: 14px;
            font-size: 14px;
            line-height: 1.9;
            text-align: justify;
        }

        .table-wrapper {
            width: 100%;
            overflow-x: auto;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
            table-layout: fixed;
            font-size: 8.5px;
        }

        thead {
            background: #0d4b78;
            color: #ffffff;
        }

        th,
        td {
            padding: 7px 3px;
            border: 1px solid #ccdce8;
            text-align: center;
            vertical-align: middle;
            overflow-wrap: anywhere;
        }

        th:nth-child(1),
        td:nth-child(1) {
            width: 3%;
        }

        th:nth-child(2),
        td:nth-child(2) {
            width: 11%;
        }

        th:nth-child(3),
        td:nth-child(3) {
            width: 10%;
        }

        th:nth-child(4),
        td:nth-child(4),
        th:nth-child(5),
        td:nth-child(5),
        th:nth-child(6),
        td:nth-child(6),
        th:nth-child(7),
        td:nth-child(7),
        th:nth-child(8),
        td:nth-child(8),
        th:nth-child(9),
        td:nth-child(9) {
            width: 5.5%;
        }

        th:nth-child(10),
        td:nth-child(10) {
            width: 12%;
        }

        th:nth-child(11),
        td:nth-child(11),
        th:nth-child(12),
        td:nth-child(12),
        th:nth-child(13),
        td:nth-child(13) {
            width: 6.5%;
        }

        tbody tr:nth-child(even) {
            background: #f7fafc;
        }

        .region-name {
            font-weight: bold;
            color: #0b3558;
        }

        .availability-grid {
            display: grid;
            grid-template-columns:
                repeat(4, 1fr);
            gap: 7px;
            margin-top: 10px;
        }

        .availability-item {
            padding: 8px;
            border-radius: 7px;
            border: 1px solid #d8e7f1;
            background: #f8fbfd;
            font-size: 11px;
        }

        .available {
            color: #08783e;
            font-weight: bold;
        }

        .unavailable {
            color: #a13b3b;
            font-weight: bold;
        }

        .report-footer {
            margin-top: 20px;
            padding-top: 10px;
            border-top: 1px solid #d8e7f1;
            text-align: center;
            color: #658097;
            font-size: 10px;
            line-height: 1.7;
        }

        .print-controls {
            position: fixed;
            left: 20px;
            top: 20px;
            display: flex;
            gap: 8px;
            z-index: 1000;
        }

        .print-controls button {
            border: 0;
            border-radius: 7px;
            padding: 11px 18px;
            cursor: pointer;
            color: #ffffff;
            font-weight: bold;
            background: #147fc1;
        }

        .print-controls button.secondary {
            background: #516b7e;
        }

        @media print {
            body {
                background: #ffffff;
            }

            .report-page {
                width: auto;
                min-height: auto;
                margin: 0;
                box-shadow: none;
                padding: 5mm;
            }

            .print-controls {
                display: none;
            }

            table {
                page-break-inside: auto;
            }

            tr {
                page-break-inside: avoid;
                page-break-after: auto;
            }

            .section-title {
                page-break-after: avoid;
            }
        }

        @page {
            size: A4 landscape;
            margin: 6mm;
        }
    </style>
</head>

<body>

    <div class="print-controls">

        <button onclick="window.print()">
            طباعة / حفظ PDF
        </button>

        <button
            class="secondary"
            onclick="window.close()"
        >
            إغلاق
        </button>

    </div>

    <main class="report-page">

        <header class="report-header">

            <div class="brand-block">

                <h1>
                    ${escapeHTML(
                        report.title
                    )}
                </h1>

                <p>
                    ${escapeHTML(
                        report.organizationName
                    )}
                    —
                    نظام التنبؤ والتحقق الوطني متعدد المصادر
                </p>

            </div>

            <div class="version-badge">
                V32
            </div>

        </header>

        <section class="report-meta">

            <strong>
                رقم التقرير:
            </strong>

            ${escapeHTML(
                report.id
            )}

            <br>

            <strong>
                تاريخ ووقت الإصدار:
            </strong>

            ${escapeHTML(
                report.generatedAtText
            )}

            <br>

            <strong>
                الحالة الوطنية:
            </strong>

            ${escapeHTML(
                report.summary
                    .nationalStatus
            )}

            <br>

            <strong>
                وحدة كميات المطر:
            </strong>

            ملم

        </section>

        <section class="summary-grid">

            <article class="summary-card">

                <div class="label">
                    الثقة الوطنية
                </div>

                <div class="value">
                    ${Math.round(
                        report.summary
                            .nationalConfidence
                    )}%
                </div>

            </article>

            <article class="summary-card">

                <div class="label">
                    المناطق الممطرة الآن
                </div>

                <div class="value">
                    ${
                        report.statistics
                            .rainyRegionCount
                    }
                </div>

            </article>

            <article class="summary-card">

                <div class="label">
                    مناطق متوقع وصول المطر إليها
                </div>

                <div class="value">
                    ${
                        report.statistics
                            .expectedRegionCount
                    }
                </div>

            </article>

            <article class="summary-card">

                <div class="label">
                    المناطق مرتفعة الخطورة
                </div>

                <div class="value">
                    ${
                        report.statistics
                            .highRiskRegionCount
                    }
                </div>

            </article>

        </section>

        <h2 class="section-title">
            الملخص التنفيذي الوطني
        </h2>

        <section class="executive-summary">
            ${escapeHTML(
                report.executiveSummary
            )}
        </section>

        <h2 class="section-title">
            حالة وتوقعات الأمطار في مناطق المملكة
        </h2>

        <div class="table-wrapper">

            <table>

                <thead>

                    <tr>
                        <th>#</th>

                        <th>
                            المنطقة
                        </th>

                        <th>
                            الحالة
                        </th>

                        <th>
                            المطر الآن
                        </th>

                        <th>
                            6 ساعات
                        </th>

                        <th>
                            12 ساعة
                        </th>

                        <th>
                            24 ساعة
                        </th>

                        <th>
                            48 ساعة
                        </th>

                        <th>
                            72 ساعة
                        </th>

                        <th>
                            وقت الوصول
                        </th>

                        <th>
                            الثقة
                        </th>

                        <th>
                            خطر السيول
                        </th>

                        <th>
                            التصنيف
                        </th>
                    </tr>

                </thead>

                <tbody>
                    ${rowsHTML}
                </tbody>

            </table>

        </div>

        <h2 class="section-title">
            حالة تكامل محركات التقرير
        </h2>

        <section class="availability-grid">

            ${this.buildAvailabilityItem(
                "Recovery Core",
                report.rawAvailability
                    .core
            )}

            ${this.buildAvailabilityItem(
                "Dashboard",
                report.rawAvailability
                    .dashboard
            )}

            ${this.buildAvailabilityItem(
                "Forecast Engine",
                report.rawAvailability
                    .forecastEngine
            )}

            ${this.buildAvailabilityItem(
                "Rain Arrival Engine",
                report.rawAvailability
                    .arrivalEngine
            )}

            ${this.buildAvailabilityItem(
                "Verification Engine",
                report.rawAvailability
                    .verificationEngine
            )}

            ${this.buildAvailabilityItem(
                "Storm Tracking Engine",
                report.rawAvailability
                    .stormTrackingEngine
            )}

            ${this.buildAvailabilityItem(
                "Path Prediction Engine",
                report.rawAvailability
                    .pathPredictionEngine
            )}

        </section>

        <footer class="report-footer">

            هذا التقرير مولد آليًا من منصة
            RainGuard AI V32،
            ويعتمد على البيانات المتاحة وقت الإصدار.

            <br>

            قيم 6 و12 و24 و48 و72 ساعة تمثل
            كميات المطر التراكمية المتاحة لكل أفق زمني.

            <br>

            يُنصح بمراجعة الجهات الرسمية المختصة عند اتخاذ
            القرارات التشغيلية أو قرارات السلامة والطوارئ.

        </footer>

    </main>

</body>

</html>
            `;
        }

        buildAvailabilityItem(
            name,
            available
        ) {
            return `
                <div class="availability-item">

                    <strong>
                        ${escapeHTML(
                            name
                        )}
                    </strong>

                    :

                    <span class="${
                        available
                            ? "available"
                            : "unavailable"
                    }">

                        ${
                            available
                                ? "متصل"
                                : "غير متصل"
                        }

                    </span>

                </div>
            `;
        }

        /* ==================================================================
           SECTION 18
           GENERATE REPORT
           ================================================================== */

        generateReport(
            options = {}
        ) {
            try {
                const report =
                    this.buildReportModel();

                const html =
                    this.buildReportHTML(
                        report
                    );

                const reportWindow =
                    global.open(
                        "",
                        "_blank"
                    );

                if (!reportWindow) {
                    throw new Error(
                        "تعذر فتح نافذة التقرير. يرجى السماح بالنوافذ المنبثقة."
                    );
                }

                reportWindow.document
                    .open();

                reportWindow.document
                    .write(
                        html
                    );

                reportWindow.document
                    .close();

                this.state.reportCount +=
                    1;

                this.state.lastGeneratedAt =
                    now();

                this.state.lastReport =
                    report;

                this.state.lastError =
                    null;

                const shouldPrint =
                    options.print ===
                        true ||
                    (
                        options.print !==
                            false &&
                        this.options
                            .openPrintDialog
                    );

                if (
                    shouldPrint
                ) {
                    reportWindow
                        .addEventListener(
                            "load",
                            () => {
                                global.setTimeout(
                                    () => {
                                        reportWindow
                                            .focus();

                                        reportWindow
                                            .print();
                                    },
                                    700
                                );
                            },
                            {
                                once:
                                    true
                            }
                        );
                }

                global.dispatchEvent(
                    new CustomEvent(
                        "rainguard:national-report-generated",
                        {
                            detail: {
                                reportId:
                                    report.id,

                                generatedAt:
                                    report.generatedAt,

                                report
                            }
                        }
                    )
                );

                return {
                    success:
                        true,

                    report,

                    reportWindow
                };

            } catch (error) {
                this.state.lastError = {
                    name:
                        error?.name ||
                        "Error",

                    message:
                        error?.message ||
                        String(
                            error
                        )
                };

                console.error(
                    "[NationalRainReportV32] Report generation failed.",
                    error
                );

                global.alert(
                    "تعذر إنشاء التقرير:\n" +
                    this.state.lastError
                        .message
                );

                return {
                    success:
                        false,

                    error:
                        this.state.lastError
                };
            }
        }

        /* ==================================================================
           SECTION 19
           BUTTON BINDING
           ================================================================== */

        findReportButton() {
            const directSelectors =
                [
                    "#generate-report",
                    "#generateReport",
                    "#report-button",
                    "#reportButton",
                    "[data-action='generate-report']",
                    "[data-rainguard-report]"
                ];

            for (
                const selector of
                directSelectors
            ) {
                const element =
                    global.document
                        ?.querySelector(
                            selector
                        );

                if (
                    element
                ) {
                    return element;
                }
            }

            const candidates =
                [
                    ...(
                        global.document
                            ?.querySelectorAll(
                                "button, a"
                            ) ||
                        []
                    )
                ];

            return candidates.find(
                element => {

                    const text =
                        String(
                            element
                                .textContent ||
                            ""
                        )
                            .replace(
                                /\s+/g,
                                " "
                            )
                            .trim();

                    return (
                        text.includes(
                            "إنشاء التقرير"
                        ) ||
                        text.includes(
                            "Generate Report"
                        )
                    );
                }
            ) || null;
        }

        bindReportButton() {
            const button =
                this.findReportButton();

            if (
                !button
            ) {
                this.state.buttonBound =
                    false;

                return {
                    success:
                        false,

                    reason:
                        "Report button was not found."
                };
            }

            if (
                button.dataset
                    .nationalRainReportBound ===
                "true"
            ) {
                this.state.buttonBound =
                    true;

                return {
                    success:
                        true,

                    alreadyBound:
                        true,

                    button
                };
            }

            button.addEventListener(
                "click",
                event => {
                    event.preventDefault();

                    event.stopPropagation();

                    this.generateReport({
                        print:
                            true
                    });
                }
            );

            button.dataset
                .nationalRainReportBound =
                "true";

            this.state.buttonBound =
                true;

            return {
                success:
                    true,

                button
            };
        }

        /* ==================================================================
           SECTION 20
           STATUS
           ================================================================== */

        getStatus() {
            return {
                id:
                    this.id,

                version:
                    this.version,

                initialized:
                    this.state
                        .initialized,

                buttonBound:
                    this.state
                        .buttonBound,

                reportCount:
                    this.state
                        .reportCount,

                lastGeneratedAt:
                    this.state
                        .lastGeneratedAt,

                lastError:
                    this.state
                        .lastError
            };
        }
    }

    /* ======================================================================
       SECTION 21
       GLOBAL EXPORT
       ====================================================================== */

    global.NationalRainReportV32 =
        NationalRainReportV32;

    global.NationalRainReportV32Instance =
        new NationalRainReportV32({
            autoBindButton:
                true,

            openPrintDialog:
                true
        });

    function initializeReportWhenReady() {
        const instance =
            global
                .NationalRainReportV32Instance;

        if (
            !instance
        ) {
            return;
        }

        instance.initialize();

        if (
            !instance.state
                .buttonBound
        ) {
            let attempts =
                0;

            const timer =
                global.setInterval(
                    () => {
                        attempts +=
                            1;

                        const result =
                            instance
                                .bindReportButton();

                        if (
                            result.success ||
                            attempts >=
                                30
                        ) {
                            global.clearInterval(
                                timer
                            );
                        }
                    },
                    500
                );
        }
    }

    if (
        global.document &&
        global.document.readyState ===
            "loading"
    ) {
        global.document
            .addEventListener(
                "DOMContentLoaded",
                initializeReportWhenReady,
                {
                    once:
                        true
                }
            );

    } else {
        initializeReportWhenReady();
    }

    /* ======================================================================
       SECTION 22
       GLOBAL SHORTCUT
       ====================================================================== */

    global.generateNationalRainReportV32 =
        function generateNationalRainReportV32(
            options = {}
        ) {
            return global
                .NationalRainReportV32Instance
                .generateReport(
                    options
                );
        };

    console.log(
        "[RainGuard AI V32] National Rain Report Engine ready with 6/12/24/48/72-hour forecasts."
    );

})(window);
