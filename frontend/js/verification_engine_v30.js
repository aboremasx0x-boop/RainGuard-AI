/* =========================================================
   RainGuard AI V30
   National Multi-Source Verification Engine
   Bilingual Arabic / English Edition
   File: frontend/js/verification_engine_v30.js
   ========================================================= */

window.RG30 =
    window.RG30 || {};

RG30.VerificationEngine = {

    version:
        "30.1.0-bilingual",

    initialized:
        false,

    isRunning:
        false,

    cycleInProgress:
        false,

    cycleNumber:
        0,

    lastRunAt:
        null,

    latestCities:
        [],

    latestVerification:
        [],

    latestNationalSummary:
        null,

    latestRenderContext:
        {
            results: [],
            summary: null
        },

    config: {

        minimumSources:
            2,

        agreementTolerance: {

            rainProbability:
                18,

            rainAmount:
                4,

            risk:
                15

        },

        thresholds: {

            verified:
                75,

            supported:
                55,

            uncertain:
                35

        },

        defaultReliability: {

            official:
                1.00,

            radar:
                0.92,

            satellite:
                0.86,

            lightning:
                0.84,

            openMeteo:
                0.80,

            localModel:
                0.76

        },

        sourceWeights: {

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

        },

        maximumSources:
            6,

        conflictAgreementThreshold:
            45,

        officialForecastDifferenceThreshold:
            35,

        lowForecastProbabilityThreshold:
            15
    },

    /* =====================================================
       LANGUAGE HELPERS
       ===================================================== */

    isArabic() {

        return (
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

    translateMessage(
        message
    ) {

        const i18n =
            window.RG30
                ?.I18n;

        if (
            i18n &&
            typeof i18n
                .translateText ===
                "function"
        ) {

            return i18n
                .translateText(
                    message
                );

        }

        return String(
            message ?? ""
        );

    },

    getSourceLabel(
        sourceKey,
        fallback = ""
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
                    "RainGuard Local AI Model",

                ar:
                    "نموذج RainGuard للذكاء الاصطناعي المحلي"
            }

        };

        const item =
            labels[
                sourceKey
            ];

        if (!item) {

            return fallback ||
                sourceKey;

        }

        return this.isArabic()
            ? item.ar
            : item.en;

    },

    getStatusLabel(
        status
    ) {

        const value =
            String(
                status ?? ""
            )
                .trim()
                .toUpperCase();

        const labels = {

            VERIFIED: {
                en:
                    "VERIFIED",

                ar:
                    "متحقق"
            },

            SUPPORTED: {
                en:
                    "SUPPORTED",

                ar:
                    "مدعوم"
            },

            UNCERTAIN: {
                en:
                    "UNCERTAIN",

                ar:
                    "غير مؤكد"
            },

            UNVERIFIED: {
                en:
                    "UNVERIFIED",

                ar:
                    "غير متحقق"
            },

            CONFLICTED: {
                en:
                    "CONFLICTED",

                ar:
                    "متعارض"
            },

            INSUFFICIENT_DATA: {
                en:
                    "INSUFFICIENT DATA",

                ar:
                    "بيانات غير كافية"
            },

            NORMAL: {
                en:
                    "NORMAL",

                ar:
                    "طبيعي"
            },

            WATCH: {
                en:
                    "WATCH",

                ar:
                    "مراقبة"
            },

            WARNING: {
                en:
                    "WARNING",

                ar:
                    "تحذير"
            },

            EMERGENCY: {
                en:
                    "EMERGENCY",

                ar:
                    "طوارئ"
            },

            SOURCE_CONFLICT: {
                en:
                    "SOURCE CONFLICT",

                ar:
                    "تعارض المصادر"
            },

            NO_DATA: {
                en:
                    "NO DATA",

                ar:
                    "لا توجد بيانات"
            },

            ACTIVE: {
                en:
                    "ACTIVE",

                ar:
                    "نشط"
            },

            UNAVAILABLE: {
                en:
                    "UNAVAILABLE",

                ar:
                    "غير متاح"
            },

            PENDING_API: {
                en:
                    "PENDING API",

                ar:
                    "بانتظار الواجهة البرمجية"
            },

            UNKNOWN: {
                en:
                    "UNKNOWN",

                ar:
                    "غير معروف"
            }
        };

        const item =
            labels[
                value
            ];

        if (!item) {

            return String(
                status ?? ""
            );

        }

        return this.isArabic()
            ? item.ar
            : item.en;

    },

    getConflictLevelLabel(
        level
    ) {

        const value =
            String(
                level ?? ""
            )
                .trim()
                .toUpperCase();

        const labels = {

            NONE: {
                en:
                    "NONE",

                ar:
                    "لا يوجد"
            },

            MEDIUM: {
                en:
                    "MEDIUM",

                ar:
                    "متوسط"
            },

            HIGH: {
                en:
                    "HIGH",

                ar:
                    "مرتفع"
            }

        };

        const item =
            labels[
                value
            ];

        if (!item) {

            return String(
                level ?? ""
            );

        }

        return this.isArabic()
            ? item.ar
            : item.en;

    },

    getDecisionActionLabel(
        action
    ) {

        const value =
            String(
                action ?? ""
            )
                .trim()
                .toUpperCase();

        const labels = {

            HOLD: {
                en:
                    "HOLD",

                ar:
                    "تعليق القرار"
            },

            EMERGENCY_ESCALATION: {
                en:
                    "EMERGENCY ESCALATION",

                ar:
                    "تصعيد طارئ"
            },

            OPERATIONAL_WARNING: {
                en:
                    "OPERATIONAL WARNING",

                ar:
                    "تحذير تشغيلي"
            },

            ENHANCED_WATCH: {
                en:
                    "ENHANCED WATCH",

                ar:
                    "مراقبة معززة"
            },

            NORMAL_MONITORING: {
                en:
                    "NORMAL MONITORING",

                ar:
                    "مراقبة طبيعية"
            },

            MANUAL_REVIEW: {
                en:
                    "MANUAL REVIEW",

                ar:
                    "مراجعة يدوية"
            },

            WAIT_FOR_SOURCES: {
                en:
                    "WAIT FOR SOURCES",

                ar:
                    "انتظار المصادر"
            }
        };

        const item =
            labels[
                value
            ];

        if (!item) {

            return String(
                action ?? ""
            );

        }

        return this.isArabic()
            ? item.ar
            : item.en;

    },

    translateDecisionReason(
        reason
    ) {

        const value =
            String(
                reason ?? ""
            )
                .trim();

        if (
            !this.isArabic() ||
            !value
        ) {

            return value;

        }

        const reasons = {

            "Evidence is not sufficient.":
                "الأدلة غير كافية.",

            "High verified risk supported by multiple sources.":
                "يوجد خطر مرتفع متحقق ومدعوم من عدة مصادر.",

            "Verified multi-source risk requires operational readiness.":
                "الخطر المتحقق متعدد المصادر يتطلب رفع الجاهزية التشغيلية.",

            "Moderate verified risk requires increased monitoring.":
                "الخطر المتوسط المتحقق يتطلب زيادة مستوى المراقبة.",

            "Verified evidence indicates low current risk.":
                "تشير الأدلة المتحققة إلى انخفاض الخطر الحالي.",

            "Evidence is supported but not fully verified.":
                "الأدلة مدعومة لكنها لم تصل إلى مستوى التحقق الكامل.",

            "Sources conflict and require additional verification.":
                "يوجد تعارض بين المصادر ويلزم تحقق إضافي.",

            "Not enough active sources are available.":
                "عدد المصادر النشطة غير كافٍ."
        };

        return reasons[
            value
        ] || value;

    },

    translateConflictReason(
        reason
    ) {

        const value =
            String(
                reason ?? ""
            )
                .trim();

        if (
            !this.isArabic() ||
            !value
        ) {

            return value;

        }

        const reasons = {

            "Official source and Open-Meteo differ significantly.":
                "يوجد اختلاف كبير بين المصدر الرسمي وOpen-Meteo.",

            "Radar detects rain while forecast probability is low.":
                "يرصد الرادار أمطارًا بينما احتمال التوقع منخفض.",

            "Low agreement among available sources.":
                "يوجد اتفاق منخفض بين المصادر المتاحة."
        };

        return reasons[
            value
        ] || value;

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

        this.bindEvents();

        this.writeLog(

            this.text(

                "National Multi-Source Verification Engine V30 ready.",

                "محرك V30 الوطني للتحقق متعدد المصادر جاهز."

            )

        );

        window.dispatchEvent(

            new CustomEvent(

                "rg30:verification-ready",

                {
                    detail: {

                        version:
                            this.version,

                        timestamp:
                            new Date()
                                .toISOString(),

                        language:
                            window.RG30
                                ?.I18n
                                ?.language ||
                            "en"

                    }
                }

            )

        );

    },

    /* =====================================================
       EVENTS
       ===================================================== */

    bindEvents() {

        window.addEventListener(

            "rg23:analysis-completed",

            event => {

                const cities =
                    event
                        ?.detail
                        ?.cities ||
                    [];

                if (
                    cities.length
                ) {

                    this.run(
                        cities
                    );

                }

            }

        );

        window.addEventListener(

            "rg29:cognitive-cycle-completed",

            event => {

                const cities =
                    event
                        ?.detail
                        ?.cities ||
                    window.RG23
                        ?.Brain
                        ?.latestCities ||
                    [];

                if (
                    cities.length
                ) {

                    this.run(
                        cities
                    );

                }

            }

        );

        window.addEventListener(

            "rg30:run-verification",

            event => {

                const cities =
                    event
                        ?.detail
                        ?.cities ||
                    window.RG23
                        ?.Brain
                        ?.latestCities ||
                    [];

                this.run(
                    cities
                );

            }

        );

        window.addEventListener(

            "rg30:language-changed",

            () => {

                try {

                    if (
                        this.latestNationalSummary
                    ) {

                        this.render(

                            this.latestVerification,

                            this.latestNationalSummary

                        );

                    }

                } catch (error) {

                    console.warn(
                        "V30 verification language refresh failed:",
                        error
                    );

                }

            }

        );

    },
       /* =====================================================
       MAIN EXECUTION
       ===================================================== */

    async run(
        cities = []
    ) {

        if (
            this.cycleInProgress
        ) {

            this.writeLog(

                this.text(

                    "Verification cycle skipped because another verification cycle is active.",

                    "تم تجاوز دورة التحقق لأن دورة تحقق أخرى ما زالت نشطة."

                ),

                "warning"

            );

            return this.latestVerification;

        }

        if (
            !Array.isArray(
                cities
            ) ||
            !cities.length
        ) {

            const message =
                this.text(

                    "No city data available for verification.",

                    "لا تتوفر بيانات مدن لإجراء التحقق."

                );

            this.renderEmptyState(
                message
            );

            this.writeLog(

                this.text(

                    "Verification skipped: no city data available.",

                    "تم تجاوز التحقق لعدم توفر بيانات المدن."

                ),

                "warning"

            );

            return [];

        }

        this.cycleInProgress =
            true;

        this.isRunning =
            true;

        this.cycleNumber +=
            1;

        this.lastRunAt =
            new Date()
                .toISOString();

        const startedAt =
            Date.now();

        try {

            this.writeLog(

                this.text(

                    `V30 verification cycle ${this.cycleNumber} started for ${cities.length} cities.`,

                    `بدأت دورة التحقق رقم ${this.cycleNumber} في V30 لعدد ${cities.length} مدينة.`

                )

            );

            const preparedCities =
                cities.map(

                    city =>
                        this.prepareCity(
                            city
                        )

                );

            const results =
                preparedCities.map(

                    city =>
                        this.verifyCity(
                            city
                        )

                );

            this.latestCities =
                preparedCities;

            this.latestVerification =
                results;

            this.latestNationalSummary =
                this.buildNationalSummary(
                    results
                );

            this.latestRenderContext = {

                results:
                    this.latestVerification,

                summary:
                    this.latestNationalSummary

            };

            this.render(

                this.latestVerification,

                this.latestNationalSummary

            );

            this.publishResults(

                this.latestVerification,

                this.latestNationalSummary

            );

            this.writeLog(

                this.text(

                    `V30 verification completed. National confidence: ${this.latestNationalSummary?.nationalConfidence || 0}%.`,

                    `اكتملت عملية التحقق في V30. الثقة الوطنية: ${this.latestNationalSummary?.nationalConfidence || 0}%.`

                )

            );

            window.dispatchEvent(

                new CustomEvent(

                    "rg30:verification-cycle-finished",

                    {
                        detail: {

                            cycleNumber:
                                this.cycleNumber,

                            durationMs:
                                Date.now() -
                                startedAt,

                            cities:
                                this.latestCities.length,

                            results:
                                this.latestVerification,

                            summary:
                                this.latestNationalSummary,

                            timestamp:
                                this.lastRunAt

                        }
                    }

                )

            );

            return this.latestVerification;

        } catch (error) {

            console.error(
                "V30 verification run failed:",
                error
            );

            const message =
                this.text(

                    `Verification failed: ${error?.message || String(error)}`,

                    `فشلت عملية التحقق: ${error?.message || String(error)}`

                );

            this.writeLog(
                message,
                "danger"
            );

            this.renderEmptyState(
                message
            );

            window.dispatchEvent(

                new CustomEvent(

                    "rg30:verification-failed",

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

            return [];

        } finally {

            this.cycleInProgress =
                false;

            this.isRunning =
                false;

        }

    },

    /* =====================================================
       CITY PREPARATION
       ===================================================== */

    prepareCity(
        city = {}
    ) {

        const source =
            city &&
            typeof city ===
                "object"
                ? city
                : {};

        const safeNumber =
            value => {

                const number =
                    Number(
                        value
                    );

                return Number.isFinite(
                    number
                )
                    ? number
                    : 0;

            };

        const officialData =
            source.officialData ||
            source.ncmData ||
            source.anwaaData ||
            {};

        const radarData =
            source.radarData ||
            source.radar ||
            {};

        const satelliteData =
            source.satelliteData ||
            source.satellite ||
            {};

        const lightningData =
            source.lightningData ||
            source.lightning ||
            {};

        const openMeteoData =
            source.openMeteoData ||
            source.weather ||
            {};

        const localModelData =
            source.localModelData ||
            source.localAIData ||
            source.aiData ||
            {};

        return {

            ...source,

            name:
                source.name ||
                source.city ||
                source.cityName ||
                this.text(
                    "Unknown",
                    "غير معروف"
                ),

            lat:
                safeNumber(

                    source.lat ??
                    source.latitude

                ),

            lon:
                safeNumber(

                    source.lon ??
                    source.lng ??
                    source.longitude

                ),

            officialData: {

                available:

                    officialData.available ===
                        true ||

                    officialData.status ===
                        "AVAILABLE" ||

                    officialData.status ===
                        "VERIFIED",

                status:

                    officialData.status ||
                    source.officialStatus ||
                    "PENDING_API",

                rainProbability:
                    safeNumber(

                        officialData
                            .rainProbability ??

                        officialData
                            .probability ??

                        source
                            .officialRainProbability

                    ),

                rainAmount:
                    safeNumber(

                        officialData
                            .rainAmount ??

                        officialData
                            .precipitation ??

                        source
                            .officialRainAmount

                    ),

                warningLevel:

                    officialData
                        .warningLevel ||

                    officialData
                        .level ||

                    source
                        .officialWarningLevel ||

                    "UNKNOWN",

                issuedAt:

                    officialData
                        .issuedAt ||

                    officialData
                        .timestamp ||

                    null

            },

            radarData: {

                available:

                    radarData.available ===
                        true ||

                    safeNumber(
                        radarData.intensity
                    ) > 0 ||

                    safeNumber(
                        source.radarIntensity
                    ) > 0,

                intensity:
                    safeNumber(

                        radarData
                            .intensity ??

                        radarData
                            .rainIntensity ??

                        source
                            .radarIntensity

                    ),

                rainDetected:

                    radarData
                        .rainDetected ===
                        true ||

                    safeNumber(
                        radarData.intensity
                    ) > 0,

                movementConfidence:
                    safeNumber(

                        radarData
                            .movementConfidence ??

                        source
                            .radarMovementConfidence

                    ),

                frameAgeMinutes:
                    safeNumber(

                        radarData
                            .frameAgeMinutes ??

                        source
                            .radarFrameAgeMinutes

                    )

            },

            satelliteData: {

                available:

                    satelliteData.available ===
                        true ||

                    safeNumber(
                        satelliteData.cloudCover
                    ) > 0 ||

                    safeNumber(
                        source.cloudCover
                    ) > 0,

                cloudCover:
                    safeNumber(

                        satelliteData
                            .cloudCover ??

                        source
                            .cloudCover

                    ),

                convectionScore:
                    safeNumber(

                        satelliteData
                            .convectionScore ??

                        source
                            .convectionScore

                    ),

                cloudTemperature:
                    safeNumber(

                        satelliteData
                            .cloudTemperature ??

                        source
                            .cloudTemperature

                    ),

                stormCellScore:
                    safeNumber(

                        satelliteData
                            .stormCellScore ??

                        source
                            .stormCellScore

                    )

            },

            lightningData: {

                available:

                    lightningData.available ===
                        true ||

                    safeNumber(
                        lightningData.strikes
                    ) > 0 ||

                    safeNumber(
                        source.lightningStrikes
                    ) > 0,

                strikes:
                    safeNumber(

                        lightningData
                            .strikes ??

                        source
                            .lightningStrikes

                    ),

                distanceKm:
                    safeNumber(

                        lightningData
                            .distanceKm ??

                        source
                            .lightningDistanceKm

                    ),

                activityScore:
                    safeNumber(

                        lightningData
                            .activityScore ??

                        source
                            .lightningActivityScore

                    ),

                trend:
                    lightningData
                        .trend ||
                    source
                        .lightningTrend ||
                    "STABLE"

            },

            openMeteoData: {

                available:

                    openMeteoData.available !==
                    false,

                rainProbability:
                    safeNumber(

                        openMeteoData
                            .rainProbability ??

                        openMeteoData
                            .precipitation_probability ??

                        source
                            .rainProbability ??

                        source
                            .probability

                    ),

                rainAmount:
                    safeNumber(

                        openMeteoData
                            .rainAmount ??

                        openMeteoData
                            .precipitation ??

                        source
                            .rain ??

                        source
                            .rainAmount

                    ),

                humidity:
                    safeNumber(

                        openMeteoData
                            .humidity ??

                        source
                            .humidity

                    ),

                cloudCover:
                    safeNumber(

                        openMeteoData
                            .cloudCover ??

                        source
                            .cloudCover

                    ),

                windSpeed:
                    safeNumber(

                        openMeteoData
                            .windSpeed ??

                        source
                            .windSpeed

                    ),

                pressure:
                    safeNumber(

                        openMeteoData
                            .pressure ??

                        openMeteoData
                            .pressureMsl ??

                        source
                            .pressure

                    )

            },

            localModelData: {

                available:

                    localModelData.available !==
                    false,

                weatherScore:
                    safeNumber(

                        localModelData
                            .weatherScore ??

                        source
                            .weatherScore

                    ),

                floodIndex:
                    safeNumber(

                        localModelData
                            .floodIndex ??

                        source
                            .floodIndex

                    ),

                roadRisk:
                    safeNumber(

                        localModelData
                            .roadRisk ??

                        source
                            .roadRisk

                    ),

                finalRisk:
                    safeNumber(

                        localModelData
                            .finalRisk ??

                        source
                            .finalRisk ??

                        source
                            .baseRisk

                    ),

                confidence:
                    safeNumber(

                        localModelData
                            .confidence ??

                        source
                            .aiConfidence

                    )

            }

        };

    },

    /* =====================================================
       CITY VERIFICATION
       ===================================================== */

    verifyCity(
        city
    ) {

        const sourceEvidence = {

            official:
                this.evaluateOfficialSource(
                    city
                ),

            radar:
                this.evaluateRadarSource(
                    city
                ),

            satellite:
                this.evaluateSatelliteSource(
                    city
                ),

            lightning:
                this.evaluateLightningSource(
                    city
                ),

            openMeteo:
                this.evaluateOpenMeteoSource(
                    city
                ),

            localModel:
                this.evaluateLocalModel(
                    city
                )

        };

        const availableSources =
            Object.values(
                sourceEvidence
            )
                .filter(
                    source =>
                        source.available
                );

        const activeSourceCount =
            availableSources.length;

        const agreement =
            this.calculateAgreement(
                sourceEvidence
            );

        const evidenceScore =
            this.calculateEvidenceScore(
                sourceEvidence
            );

        const weightedConfidence =
            this.calculateWeightedConfidence(

                sourceEvidence,

                agreement,

                evidenceScore

            );

        const rainConsensus =
            this.calculateRainConsensus(
                sourceEvidence
            );

        const conflict =
            this.detectConflict(

                sourceEvidence,

                agreement

            );

        const verificationStatus =
            this.getVerificationStatus(

                weightedConfidence,

                activeSourceCount,

                conflict

            );

        const finalRisk =
            this.calculateVerifiedRisk(

                city,

                sourceEvidence,

                rainConsensus,

                weightedConfidence

            );

        const decisionGate =
            this.buildDecisionGate({

                finalRisk,

                weightedConfidence,

                verificationStatus,

                activeSourceCount,

                conflict,

                rainConsensus

            });

        return {

            city:
                city.name,

            lat:
                city.lat,

            lon:
                city.lon,

            sources:
                sourceEvidence,

            activeSourceCount,

            agreement:
                Math.round(
                    agreement
                ),

            evidenceScore:
                Math.round(
                    evidenceScore
                ),

            finalConfidence:
                Math.round(
                    weightedConfidence
                ),

            rainConsensus:
                Math.round(
                    rainConsensus
                ),

            verifiedRisk:
                Math.round(
                    finalRisk
                ),

            conflict,

            status:
                verificationStatus,

            decisionGate,

            timestamp:
                new Date()
                    .toISOString()

        };

    },
       /* =====================================================
       SOURCE EVALUATION
       ===================================================== */

    evaluateOfficialSource(
        city
    ) {

        const data =
            city.officialData;

        const available =
            data.available ===
            true;

        let signalScore =
            0;

        if (
            available
        ) {

            signalScore +=
                this.clamp(
                    data.rainProbability,
                    0,
                    100
                ) *
                0.55;

            signalScore +=
                this.rainAmountToScore(
                    data.rainAmount
                ) *
                0.30;

            signalScore +=
                this.warningLevelToScore(
                    data.warningLevel
                ) *
                0.15;

        }

        return this.createSourceResult({

            key:
                "official",

            name:
                this.getSourceLabel(
                    "official",
                    "Official National Source"
                ),

            available,

            reliability:
                this.config
                    .defaultReliability
                    .official,

            signalScore,

            rainProbability:
                data.rainProbability,

            rainAmount:
                data.rainAmount,

            status:
                data.status,

            details: {

                warningLevel:
                    data.warningLevel,

                issuedAt:
                    data.issuedAt

            }

        });

    },

    evaluateRadarSource(
        city
    ) {

        const data =
            city.radarData;

        const available =
            data.available ===
            true;

        let probability =
            0;

        if (
            available
        ) {

            const frameFreshness =
                data.frameAgeMinutes > 0
                    ? this.clamp(
                        100 -
                        data.frameAgeMinutes *
                        4,
                        0,
                        100
                    )
                    : 100;

            probability =
                this.clamp(

                    data.intensity *
                    1.8 +

                    data.movementConfidence *
                    0.30 +

                    frameFreshness *
                    0.10 +

                    (
                        data.rainDetected
                            ? 18
                            : 0
                    ),

                    0,
                    100

                );

        }

        return this.createSourceResult({

            key:
                "radar",

            name:
                this.getSourceLabel(
                    "radar",
                    "Weather Radar"
                ),

            available,

            reliability:
                this.config
                    .defaultReliability
                    .radar,

            signalScore:
                probability,

            rainProbability:
                probability,

            rainAmount:
                data.intensity,

            status:
                available
                    ? "ACTIVE"
                    : "UNAVAILABLE",

            details: {

                rainDetected:
                    data.rainDetected,

                intensity:
                    data.intensity,

                movementConfidence:
                    data.movementConfidence,

                frameAgeMinutes:
                    data.frameAgeMinutes

            }

        });

    },

    evaluateSatelliteSource(
        city
    ) {

        const data =
            city.satelliteData;

        const available =
            data.available ===
            true;

        let probability =
            0;

        if (
            available
        ) {

            const temperatureScore =
                this.cloudTemperatureToScore(
                    data.cloudTemperature
                );

            probability =
                this.clamp(

                    data.cloudCover *
                    0.35 +

                    data.convectionScore *
                    0.35 +

                    data.stormCellScore *
                    0.20 +

                    temperatureScore *
                    0.10,

                    0,
                    100

                );

        }

        return this.createSourceResult({

            key:
                "satellite",

            name:
                this.getSourceLabel(
                    "satellite",
                    "Satellite"
                ),

            available,

            reliability:
                this.config
                    .defaultReliability
                    .satellite,

            signalScore:
                probability,

            rainProbability:
                probability,

            rainAmount:
                0,

            status:
                available
                    ? "ACTIVE"
                    : "UNAVAILABLE",

            details: {

                cloudCover:
                    data.cloudCover,

                convectionScore:
                    data.convectionScore,

                cloudTemperature:
                    data.cloudTemperature,

                stormCellScore:
                    data.stormCellScore

            }

        });

    },

    evaluateLightningSource(
        city
    ) {

        const data =
            city.lightningData;

        const available =
            data.available ===
            true;

        let probability =
            0;

        if (
            available
        ) {

            const distanceFactor =
                data.distanceKm > 0
                    ? Math.max(
                        0,
                        100 -
                        data.distanceKm *
                        2
                    )
                    : 0;

            const trendScore =
                this.lightningTrendToScore(
                    data.trend
                );

            probability =
                this.clamp(

                    data.strikes *
                    4 +

                    data.activityScore *
                    0.40 +

                    distanceFactor *
                    0.25 +

                    trendScore *
                    0.15,

                    0,
                    100

                );

        }

        return this.createSourceResult({

            key:
                "lightning",

            name:
                this.getSourceLabel(
                    "lightning",
                    "Lightning Detection"
                ),

            available,

            reliability:
                this.config
                    .defaultReliability
                    .lightning,

            signalScore:
                probability,

            rainProbability:
                probability,

            rainAmount:
                0,

            status:
                available
                    ? "ACTIVE"
                    : "UNAVAILABLE",

            details: {

                strikes:
                    data.strikes,

                distanceKm:
                    data.distanceKm,

                activityScore:
                    data.activityScore,

                trend:
                    data.trend

            }

        });

    },

    evaluateOpenMeteoSource(
        city
    ) {

        const data =
            city.openMeteoData;

        const available =
            data.available !==
            false;

        const humiditySignal =
            this.clamp(

                (
                    data.humidity -
                    35
                ) *
                1.3,

                0,
                100

            );

        const cloudSignal =
            this.clamp(
                data.cloudCover,
                0,
                100
            );

        const amountSignal =
            this.rainAmountToScore(
                data.rainAmount
            );

        const windPenalty =
            this.clamp(

                data.windSpeed >
                    50
                    ? (
                        data.windSpeed -
                        50
                    ) *
                    0.5
                    : 0,

                0,
                15

            );

        const signalScore =
            available
                ? this.clamp(

                    data.rainProbability *
                    0.55 +

                    amountSignal *
                    0.20 +

                    humiditySignal *
                    0.10 +

                    cloudSignal *
                    0.15 -

                    windPenalty,

                    0,
                    100

                )
                : 0;

        return this.createSourceResult({

            key:
                "openMeteo",

            name:
                this.getSourceLabel(
                    "openMeteo",
                    "Open-Meteo"
                ),

            available,

            reliability:
                this.config
                    .defaultReliability
                    .openMeteo,

            signalScore,

            rainProbability:
                data.rainProbability,

            rainAmount:
                data.rainAmount,

            status:
                available
                    ? "ACTIVE"
                    : "UNAVAILABLE",

            details: {

                humidity:
                    data.humidity,

                cloudCover:
                    data.cloudCover,

                windSpeed:
                    data.windSpeed,

                pressure:
                    data.pressure

            }

        });

    },

    evaluateLocalModel(
        city
    ) {

        const data =
            city.localModelData;

        const available =
            data.available !==
            false;

        const modelConfidence =
            this.clamp(
                data.confidence,
                0,
                100
            );

        const confidenceFactor =
            modelConfidence > 0
                ? (
                    0.70 +
                    modelConfidence /
                    100 *
                    0.30
                )
                : 1;

        const signalScore =
            available
                ? this.clamp(

                    (
                        data.weatherScore *
                        0.40 +

                        data.floodIndex *
                        0.25 +

                        data.roadRisk *
                        0.15 +

                        data.finalRisk *
                        0.20
                    ) *
                    confidenceFactor,

                    0,
                    100

                )
                : 0;

        return this.createSourceResult({

            key:
                "localModel",

            name:
                this.getSourceLabel(
                    "localModel",
                    "RainGuard Local AI Model"
                ),

            available,

            reliability:
                this.config
                    .defaultReliability
                    .localModel,

            signalScore,

            rainProbability:
                data.weatherScore,

            rainAmount:
                0,

            status:
                available
                    ? "ACTIVE"
                    : "UNAVAILABLE",

            details: {

                weatherScore:
                    data.weatherScore,

                floodIndex:
                    data.floodIndex,

                roadRisk:
                    data.roadRisk,

                finalRisk:
                    data.finalRisk,

                confidence:
                    data.confidence

            }

        });

    },

    createSourceResult({
        key,
        name,
        available,
        reliability,
        signalScore,
        rainProbability,
        rainAmount,
        status,
        details
    }) {

        const normalizedAvailable =
            Boolean(
                available
            );

        return {

            key,

            name,

            available:
                normalizedAvailable,

            reliability:
                this.clamp(
                    reliability,
                    0,
                    1
                ),

            signalScore:
                Math.round(

                    this.clamp(
                        signalScore,
                        0,
                        100
                    )

                ),

            rainProbability:
                Math.round(

                    this.clamp(
                        rainProbability,
                        0,
                        100
                    )

                ),

            rainAmount:
                Number(

                    this.clamp(
                        rainAmount,
                        0,
                        1000
                    )
                    .toFixed(
                        2
                    )

                ),

            status:
                status ||
                (
                    normalizedAvailable
                        ? "ACTIVE"
                        : "UNAVAILABLE"
                ),

            details:
                details ||
                {}

        };

    },
       /* =====================================================
       AGREEMENT AND EVIDENCE
       ===================================================== */

    calculateAgreement(
        sourceEvidence
    ) {

        const sources =
            Object.values(
                sourceEvidence
            )
                .filter(
                    source =>
                        source.available
                );

        if (
            sources.length <
            2
        ) {

            return 0;

        }

        let comparisons =
            0;

        let totalAgreement =
            0;

        for (
            let firstIndex = 0;
            firstIndex <
            sources.length;
            firstIndex += 1
        ) {

            for (
                let secondIndex =
                    firstIndex + 1;
                secondIndex <
                sources.length;
                secondIndex += 1
            ) {

                const first =
                    sources[
                        firstIndex
                    ];

                const second =
                    sources[
                        secondIndex
                    ];

                const signalDifference =
                    Math.abs(

                        first.signalScore -
                        second.signalScore

                    );

                const probabilityDifference =
                    Math.abs(

                        first.rainProbability -
                        second.rainProbability

                    );

                const signalAgreement =
                    this.clamp(

                        100 -
                        signalDifference,

                        0,
                        100

                    );

                const probabilityAgreement =
                    this.clamp(

                        100 -
                        probabilityDifference,

                        0,
                        100

                    );

                const pairAgreement =
                    signalAgreement *
                    0.60 +

                    probabilityAgreement *
                    0.40;

                totalAgreement +=
                    pairAgreement;

                comparisons +=
                    1;

            }

        }

        return comparisons > 0
            ? this.clamp(

                totalAgreement /
                comparisons,

                0,
                100

            )
            : 0;

    },

    calculateEvidenceScore(
        sourceEvidence
    ) {

        let weightedEvidence =
            0;

        let totalWeight =
            0;

        Object.entries(
            sourceEvidence
        )
            .forEach(
                (
                    [
                        key,
                        source
                    ]
                ) => {

                    if (
                        !source.available
                    ) {

                        return;

                    }

                    const sourceWeight =
                        this.config
                            .sourceWeights[
                                key
                            ] ||
                        0;

                    const reliability =
                        this.clamp(

                            source.reliability,

                            0,
                            1

                        );

                    const evidenceWeight =
                        sourceWeight *
                        reliability;

                    weightedEvidence +=

                        source.signalScore *
                        evidenceWeight;

                    totalWeight +=
                        evidenceWeight;

                }
            );

        if (
            totalWeight <= 0
        ) {

            return 0;

        }

        return this.clamp(

            weightedEvidence /
            totalWeight,

            0,
            100

        );

    },

    calculateWeightedConfidence(
        sourceEvidence,
        agreement,
        evidenceScore
    ) {

        const availableSources =
            Object.values(
                sourceEvidence
            )
                .filter(
                    source =>
                        source.available
                );

        const sourceCoverage =
            this.calculateSourceCoverage(
                availableSources.length
            );

        const averageReliability =
            this.calculateAverageReliability(
                availableSources
            );

        const officialBonus =
            sourceEvidence
                .official
                .available
                ? 8
                : 0;

        const radarBonus =
            sourceEvidence
                .radar
                .available
                ? 4
                : 0;

        const conflictPenalty =
            agreement <
            this.config
                .conflictAgreementThreshold
                ? 6
                : 0;

        const confidence =

            agreement *
            0.35 +

            evidenceScore *
            0.30 +

            sourceCoverage *
            0.15 +

            averageReliability *
            0.20 +

            officialBonus +

            radarBonus -

            conflictPenalty;

        return this.clamp(

            confidence,

            0,
            100

        );

    },

    calculateSourceCoverage(
        activeSourceCount
    ) {

        const maximumSources =
            this.config
                .maximumSources ||
            6;

        return this.clamp(

            activeSourceCount /
            maximumSources *
            100,

            0,
            100

        );

    },

    calculateAverageReliability(
        availableSources
    ) {

        if (
            !Array.isArray(
                availableSources
            ) ||
            !availableSources.length
        ) {

            return 0;

        }

        const total =
            availableSources
                .reduce(
                    (
                        sum,
                        source
                    ) => {

                        return (

                            sum +

                            this.clamp(

                                source.reliability,

                                0,
                                1

                            )

                        );

                    },
                    0
                );

        return this.clamp(

            total /
            availableSources.length *
            100,

            0,
            100

        );

    },

    calculateRainConsensus(
        sourceEvidence
    ) {

        let weightedProbability =
            0;

        let totalWeight =
            0;

        Object.entries(
            sourceEvidence
        )
            .forEach(
                (
                    [
                        key,
                        source
                    ]
                ) => {

                    if (
                        !source.available
                    ) {

                        return;

                    }

                    const sourceWeight =
                        this.config
                            .sourceWeights[
                                key
                            ] ||
                        0;

                    const reliability =
                        this.clamp(

                            source.reliability,

                            0,
                            1

                        );

                    const weight =
                        sourceWeight *
                        reliability;

                    weightedProbability +=

                        source.rainProbability *
                        weight;

                    totalWeight +=
                        weight;

                }
            );

        if (
            totalWeight <= 0
        ) {

            return 0;

        }

        return this.clamp(

            weightedProbability /
            totalWeight,

            0,
            100

        );

    },

    calculateRainAmountConsensus(
        sourceEvidence
    ) {

        let weightedAmount =
            0;

        let totalWeight =
            0;

        Object.entries(
            sourceEvidence
        )
            .forEach(
                (
                    [
                        key,
                        source
                    ]
                ) => {

                    if (
                        !source.available ||
                        source.rainAmount <= 0
                    ) {

                        return;

                    }

                    const sourceWeight =
                        this.config
                            .sourceWeights[
                                key
                            ] ||
                        0;

                    const reliability =
                        this.clamp(

                            source.reliability,

                            0,
                            1

                        );

                    const weight =
                        sourceWeight *
                        reliability;

                    weightedAmount +=

                        source.rainAmount *
                        weight;

                    totalWeight +=
                        weight;

                }
            );

        if (
            totalWeight <= 0
        ) {

            return 0;

        }

        return Number(

            (
                weightedAmount /
                totalWeight
            )
            .toFixed(
                2
            )

        );

    },

    calculateSourceSpread(
        sourceEvidence
    ) {

        const availableScores =
            Object.values(
                sourceEvidence
            )
                .filter(
                    source =>
                        source.available
                )
                .map(
                    source =>
                        this.clamp(
                            source.signalScore,
                            0,
                            100
                        )
                );

        if (
            availableScores.length <
            2
        ) {

            return 0;

        }

        const maximum =
            Math.max(
                ...availableScores
            );

        const minimum =
            Math.min(
                ...availableScores
            );

        return this.clamp(

            maximum -
            minimum,

            0,
            100

        );

    },

    calculateEvidenceQuality(
        sourceEvidence
    ) {

        const availableSources =
            Object.values(
                sourceEvidence
            )
                .filter(
                    source =>
                        source.available
                );

        if (
            !availableSources.length
        ) {

            return 0;

        }

        const reliability =
            this.calculateAverageReliability(
                availableSources
            );

        const coverage =
            this.calculateSourceCoverage(
                availableSources.length
            );

        const freshness =
            this.calculateFreshnessScore(
                sourceEvidence
            );

        return this.clamp(

            reliability *
            0.45 +

            coverage *
            0.35 +

            freshness *
            0.20,

            0,
            100

        );

    },

    calculateFreshnessScore(
        sourceEvidence
    ) {

        const radarAge =
            Number(

                sourceEvidence
                    ?.radar
                    ?.details
                    ?.frameAgeMinutes

            );

        let radarFreshness =
            100;

        if (
            Number.isFinite(
                radarAge
            ) &&
            radarAge > 0
        ) {

            radarFreshness =
                this.clamp(

                    100 -
                    radarAge *
                    4,

                    0,
                    100

                );

        }

        const officialIssuedAt =
            sourceEvidence
                ?.official
                ?.details
                ?.issuedAt;

        let officialFreshness =
            100;

        if (
            officialIssuedAt
        ) {

            const timestamp =
                new Date(
                    officialIssuedAt
                )
                .getTime();

            if (
                Number.isFinite(
                    timestamp
                )
            ) {

                const ageMinutes =
                    (
                        Date.now() -
                        timestamp
                    ) /
                    60000;

                officialFreshness =
                    this.clamp(

                        100 -
                        ageMinutes /
                        3,

                        0,
                        100

                    );

            }

        }

        const scores = [];

        if (
            sourceEvidence
                ?.radar
                ?.available
        ) {

            scores.push(
                radarFreshness
            );

        }

        if (
            sourceEvidence
                ?.official
                ?.available
        ) {

            scores.push(
                officialFreshness
            );

        }

        if (
            !scores.length
        ) {

            return 70;

        }

        return this.clamp(

            scores.reduce(
                (
                    total,
                    score
                ) =>
                    total + score,
                0
            ) /
            scores.length,

            0,
            100

        );

    },
       /* =====================================================
       CONFLICT DETECTION
       ===================================================== */

    detectConflict(
        sourceEvidence,
        agreement
    ) {

        const official =
            sourceEvidence
                .official;

        const radar =
            sourceEvidence
                .radar;

        const openMeteo =
            sourceEvidence
                .openMeteo;

        const satellite =
            sourceEvidence
                .satellite;

        const lightning =
            sourceEvidence
                .lightning;

        const reasons =
            [];

        if (
            official.available &&
            openMeteo.available &&
            Math.abs(

                official.rainProbability -
                openMeteo.rainProbability

            ) >
            this.config
                .officialForecastDifferenceThreshold
        ) {

            reasons.push(
                "Official source and Open-Meteo differ significantly."
            );

        }

        if (
            radar.available &&
            radar.details
                ?.rainDetected ===
                true &&
            openMeteo.available &&
            openMeteo.rainProbability <
            this.config
                .lowForecastProbabilityThreshold
        ) {

            reasons.push(
                "Radar detects rain while forecast probability is low."
            );

        }

        if (
            satellite.available &&
            radar.available
        ) {

            const satelliteRadarDifference =
                Math.abs(

                    satellite.signalScore -
                    radar.signalScore

                );

            if (
                satelliteRadarDifference >
                45
            ) {

                reasons.push(
                    "Satellite and radar signals differ significantly."
                );

            }

        }

        if (
            lightning.available &&
            lightning.signalScore >=
                60 &&
            radar.available &&
            radar.signalScore <
                20
        ) {

            reasons.push(
                "Lightning activity is high while radar rain signal is low."
            );

        }

        if (
            agreement <
            this.config
                .conflictAgreementThreshold
        ) {

            reasons.push(
                "Low agreement among available sources."
            );

        }

        const sourceSpread =
            this.calculateSourceSpread(
                sourceEvidence
            );

        if (
            sourceSpread >=
            65
        ) {

            reasons.push(
                "Wide signal spread detected across active sources."
            );

        }

        const uniqueReasons =
            [
                ...new Set(
                    reasons
                )
            ];

        let level =
            "NONE";

        if (
            uniqueReasons.length >=
            3
        ) {

            level =
                "HIGH";

        } else if (
            uniqueReasons.length >=
            1
        ) {

            level =
                "MEDIUM";

        }

        return {

            detected:
                uniqueReasons.length >
                0,

            level,

            reasons:
                uniqueReasons,

            translatedReasons:
                uniqueReasons.map(
                    reason =>
                        this.translateConflictReason(
                            reason
                        )
                ),

            sourceSpread:
                Math.round(
                    sourceSpread
                )

        };

    },

    /* =====================================================
       VERIFICATION STATUS
       ===================================================== */

    getVerificationStatus(
        confidence,
        sourceCount,
        conflict
    ) {

        if (
            sourceCount <
            this.config
                .minimumSources
        ) {

            return (
                "INSUFFICIENT_DATA"
            );

        }

        if (
            conflict.detected &&
            conflict.level ===
                "HIGH"
        ) {

            return (
                "CONFLICTED"
            );

        }

        if (
            confidence >=
            this.config
                .thresholds
                .verified
        ) {

            return (
                "VERIFIED"
            );

        }

        if (
            confidence >=
            this.config
                .thresholds
                .supported
        ) {

            return (
                "SUPPORTED"
            );

        }

        if (
            confidence >=
            this.config
                .thresholds
                .uncertain
        ) {

            return (
                "UNCERTAIN"
            );

        }

        return (
            "UNVERIFIED"
        );

    },

    /* =====================================================
       VERIFIED RISK
       ===================================================== */

    calculateVerifiedRisk(
        city,
        sourceEvidence,
        rainConsensus,
        confidence
    ) {

        const localRisk =
            this.clamp(

                city
                    .localModelData
                    .finalRisk,

                0,
                100

            );

        const floodRisk =
            this.clamp(

                city
                    .localModelData
                    .floodIndex,

                0,
                100

            );

        const radarRisk =
            this.clamp(

                sourceEvidence
                    .radar
                    .signalScore,

                0,
                100

            );

        const satelliteRisk =
            this.clamp(

                sourceEvidence
                    .satellite
                    .signalScore,

                0,
                100

            );

        const lightningRisk =
            this.clamp(

                sourceEvidence
                    .lightning
                    .signalScore,

                0,
                100

            );

        const officialRisk =
            sourceEvidence
                .official
                .available
                ? this.clamp(

                    sourceEvidence
                        .official
                        .signalScore,

                    0,
                    100

                )
                : this.clamp(

                    rainConsensus,

                    0,
                    100

                );

        const evidenceQuality =
            this.calculateEvidenceQuality(
                sourceEvidence
            );

        const verifiedRisk =

            localRisk *
            0.20 +

            floodRisk *
            0.18 +

            rainConsensus *
            0.22 +

            radarRisk *
            0.15 +

            officialRisk *
            0.12 +

            satelliteRisk *
            0.08 +

            lightningRisk *
            0.05;

        const confidenceFactor =

            0.65 +

            this.clamp(
                confidence,
                0,
                100
            ) /
            100 *
            0.25 +

            this.clamp(
                evidenceQuality,
                0,
                100
            ) /
            100 *
            0.10;

        return this.clamp(

            verifiedRisk *
            confidenceFactor,

            0,
            100

        );

    },

    /* =====================================================
       DECISION GATE
       ===================================================== */

    buildDecisionGate({
        finalRisk,
        weightedConfidence,
        verificationStatus,
        activeSourceCount,
        conflict,
        rainConsensus
    }) {

        let allowed =
            false;

        let action =
            "HOLD";

        let reason =
            "Evidence is not sufficient.";

        if (
            verificationStatus ===
                "VERIFIED" &&
            weightedConfidence >=
                75
        ) {

            allowed =
                true;

            if (
                finalRisk >=
                75
            ) {

                action =
                    "EMERGENCY_ESCALATION";

                reason =
                    "High verified risk supported by multiple sources.";

            } else if (
                finalRisk >=
                55
            ) {

                action =
                    "OPERATIONAL_WARNING";

                reason =
                    "Verified multi-source risk requires operational readiness.";

            } else if (
                finalRisk >=
                35
            ) {

                action =
                    "ENHANCED_WATCH";

                reason =
                    "Moderate verified risk requires increased monitoring.";

            } else {

                action =
                    "NORMAL_MONITORING";

                reason =
                    "Verified evidence indicates low current risk.";

            }

        } else if (
            verificationStatus ===
                "SUPPORTED" &&
            weightedConfidence >=
                55
        ) {

            allowed =
                true;

            action =
                (
                    finalRisk >=
                        45 ||
                    rainConsensus >=
                        50
                )
                    ? "ENHANCED_WATCH"
                    : "NORMAL_MONITORING";

            reason =
                "Evidence is supported but not fully verified.";

        } else if (
            conflict.detected
        ) {

            action =
                "MANUAL_REVIEW";

            reason =
                "Sources conflict and require additional verification.";

        } else if (
            activeSourceCount <
            this.config
                .minimumSources
        ) {

            action =
                "WAIT_FOR_SOURCES";

            reason =
                "Not enough active sources are available.";

        }

        return {

            allowed,

            action,

            actionLabel:
                this.getDecisionActionLabel(
                    action
                ),

            reason,

            translatedReason:
                this.translateDecisionReason(
                    reason
                ),

            finalRisk:
                Math.round(
                    this.clamp(
                        finalRisk,
                        0,
                        100
                    )
                ),

            confidence:
                Math.round(
                    this.clamp(
                        weightedConfidence,
                        0,
                        100
                    )
                ),

            verificationStatus,

            verificationStatusLabel:
                this.getStatusLabel(
                    verificationStatus
                ),

            activeSourceCount,

            conflictLevel:
                conflict
                    ?.level ||
                "NONE",

            rainConsensus:
                Math.round(
                    this.clamp(
                        rainConsensus,
                        0,
                        100
                    )
                )

        };

    },
       /* =====================================================
       NATIONAL SUMMARY
       ===================================================== */

    buildNationalSummary(
        results
    ) {

        if (
            !Array.isArray(
                results
            ) ||
            !results.length
        ) {

            return {

                cities:
                    0,

                verifiedCities:
                    0,

                supportedCities:
                    0,

                uncertainCities:
                    0,

                unverifiedCities:
                    0,

                conflictedCities:
                    0,

                insufficientDataCities:
                    0,

                averageAgreement:
                    0,

                averageEvidenceScore:
                    0,

                averageRainConsensus:
                    0,

                averageVerifiedRisk:
                    0,

                nationalConfidence:
                    0,

                topCity:
                    "--",

                topRisk:
                    0,

                nationalStatus:
                    "NO_DATA",

                cycleNumber:
                    this.cycleNumber,

                timestamp:
                    this.lastRunAt

            };

        }

        const average =
            field => {

                const total =
                    results.reduce(

                        (
                            sum,
                            result
                        ) => {

                            return (

                                sum +

                                this.safeNumber(

                                    result[
                                        field
                                    ],

                                    0

                                )

                            );

                        },

                        0

                    );

                return Math.round(

                    total /
                    results.length

                );

            };

        const sortedResults =
            [
                ...results
            ]
            .sort(

                (
                    first,
                    second
                ) => {

                    return (

                        this.safeNumber(
                            second
                                .verifiedRisk
                        ) -

                        this.safeNumber(
                            first
                                .verifiedRisk
                        )

                    );

                }

            );

        const top =
            sortedResults[0];

        const verifiedCities =
            results.filter(

                result =>
                    result.status ===
                    "VERIFIED"

            ).length;

        const supportedCities =
            results.filter(

                result =>
                    result.status ===
                    "SUPPORTED"

            ).length;

        const uncertainCities =
            results.filter(

                result =>
                    result.status ===
                    "UNCERTAIN"

            ).length;

        const unverifiedCities =
            results.filter(

                result =>
                    result.status ===
                    "UNVERIFIED"

            ).length;

        const conflictedCities =
            results.filter(

                result => {

                    return (

                        result.status ===
                            "CONFLICTED" ||

                        result.conflict
                            ?.detected ===
                            true

                    );

                }

            ).length;

        const insufficientDataCities =
            results.filter(

                result =>
                    result.status ===
                    "INSUFFICIENT_DATA"

            ).length;

        const nationalConfidence =
            average(
                "finalConfidence"
            );

        const averageAgreement =
            average(
                "agreement"
            );

        const averageEvidenceScore =
            average(
                "evidenceScore"
            );

        const averageRainConsensus =
            average(
                "rainConsensus"
            );

        const averageVerifiedRisk =
            average(
                "verifiedRisk"
            );

        const topRisk =
            this.safeNumber(

                top
                    ?.verifiedRisk,

                0

            );

        let nationalStatus =
            "NORMAL";

        if (
            topRisk >=
            75
        ) {

            nationalStatus =
                "EMERGENCY";

        } else if (
            topRisk >=
            55
        ) {

            nationalStatus =
                "WARNING";

        } else if (
            topRisk >=
            35
        ) {

            nationalStatus =
                "WATCH";

        }

        const conflictRatio =
            results.length > 0
                ? (
                    conflictedCities /
                    results.length
                )
                : 0;

        if (
            conflictRatio >
            0.5
        ) {

            nationalStatus =
                "SOURCE_CONFLICT";

        }

        if (
            insufficientDataCities ===
            results.length
        ) {

            nationalStatus =
                "NO_DATA";

        }

        const strongestDecision =
            sortedResults
                .map(
                    result =>
                        result
                            ?.decisionGate
                )
                .find(
                    gate =>
                        gate
                            ?.allowed ===
                            true
                ) ||
            top
                ?.decisionGate ||
            null;

        return {

            cities:
                results.length,

            verifiedCities,

            supportedCities,

            uncertainCities,

            unverifiedCities,

            conflictedCities,

            insufficientDataCities,

            averageAgreement,

            averageEvidenceScore,

            averageRainConsensus,

            averageVerifiedRisk,

            nationalConfidence,

            topCity:
                top
                    ?.city ||
                "--",

            topRisk:
                Math.round(
                    topRisk
                ),

            nationalStatus,

            nationalStatusLabel:
                this.getStatusLabel(
                    nationalStatus
                ),

            strongestDecision,

            conflictRatio:
                Number(

                    (
                        conflictRatio *
                        100
                    )
                    .toFixed(
                        1
                    )

                ),

            cycleNumber:
                this.cycleNumber,

            timestamp:
                this.lastRunAt

        };

    },

    /* =====================================================
       RENDERING CONTROLLER
       ===================================================== */

    render(
        results,
        summary
    ) {

        const safeResults =
            Array.isArray(
                results
            )
                ? results
                : [];

        if (!summary) {

            this.renderEmptyState(

                this.text(

                    "No national verification summary is available.",

                    "لا يتوفر ملخص وطني لنتائج التحقق."

                )

            );

            return;

        }

        this.latestRenderContext = {

            results:
                safeResults,

            summary

        };

        this.renderNationalPanel(
            summary
        );

        this.renderCitiesPanel(
            safeResults
        );

        this.renderSourceMatrix(
            safeResults
        );

        this.renderVerificationKPIs(
            summary
        );

    },

    /* =====================================================
       NATIONAL SUMMARY PANEL
       ===================================================== */

    renderNationalPanel(
        summary
    ) {

        const panel =
            document.getElementById(
                "nationalVerificationSummary"
            );

        if (!panel) {
            return;
        }

        const status =
            String(
                summary
                    .nationalStatus ||
                "NO_DATA"
            )
                .toUpperCase();

        const statusClass =
            status ===
                "EMERGENCY"
                ? "danger"
                : status ===
                    "WARNING"
                    ? "warning"
                    : status ===
                        "SOURCE_CONFLICT"
                        ? "danger"
                        : status ===
                            "WATCH"
                            ? "warning"
                            : "success";

        const generatedAt =
            summary.timestamp
                ? new Date(
                    summary.timestamp
                )
                .toLocaleString(
                    this.getLocale()
                )
                : new Date()
                    .toLocaleString(
                        this.getLocale()
                    );

        panel.innerHTML = `
            <div class="item ${statusClass}">

                <h3>

                    ${this.text(

                        "National Verification Summary V30",

                        "الملخص الوطني للتحقق V30"

                    )}

                </h3>

                <b>

                    ${this.text(
                        "National Status",
                        "الحالة الوطنية"
                    )}:

                </b>

                ${this.getStatusLabel(
                    summary.nationalStatus
                )}

                <br>

                <b>

                    ${this.text(
                        "Cities Analyzed",
                        "المدن التي تم تحليلها"
                    )}:

                </b>

                ${this.safeNumber(
                    summary.cities
                )}

                <br>

                <b>

                    ${this.text(
                        "Verified Cities",
                        "المدن المتحقق منها"
                    )}:

                </b>

                ${this.safeNumber(
                    summary.verifiedCities
                )}

                <br>

                <b>

                    ${this.text(
                        "Supported Cities",
                        "المدن المدعومة"
                    )}:

                </b>

                ${this.safeNumber(
                    summary.supportedCities
                )}

                <br>

                <b>

                    ${this.text(
                        "Uncertain Cities",
                        "المدن غير المؤكدة"
                    )}:

                </b>

                ${this.safeNumber(
                    summary.uncertainCities
                )}

                <br>

                <b>

                    ${this.text(
                        "Conflicted Cities",
                        "المدن ذات التعارض"
                    )}:

                </b>

                ${this.safeNumber(
                    summary.conflictedCities
                )}

                <br>

                <b>

                    ${this.text(
                        "Insufficient Data Cities",
                        "المدن ذات البيانات غير الكافية"
                    )}:

                </b>

                ${this.safeNumber(
                    summary.insufficientDataCities
                )}

                <br><br>

                <b>

                    ${this.text(
                        "Average Agreement",
                        "متوسط اتفاق المصادر"
                    )}:

                </b>

                ${this.safeNumber(
                    summary.averageAgreement
                )}%

                <br>

                <b>

                    ${this.text(
                        "Evidence Score",
                        "درجة الأدلة"
                    )}:

                </b>

                ${this.safeNumber(
                    summary.averageEvidenceScore
                )}%

                <br>

                <b>

                    ${this.text(
                        "Rain Consensus",
                        "توافق احتمالات المطر"
                    )}:

                </b>

                ${this.safeNumber(
                    summary.averageRainConsensus
                )}%

                <br>

                <b>

                    ${this.text(
                        "National Confidence",
                        "الثقة الوطنية"
                    )}:

                </b>

                ${this.safeNumber(
                    summary.nationalConfidence
                )}%

                <br>

                <b>

                    ${this.text(
                        "Highest Risk City",
                        "المدينة الأعلى خطرًا"
                    )}:

                </b>

                ${this.escapeHtml(
                    summary.topCity ||
                    "--"
                )}

                <br>

                <b>

                    ${this.text(
                        "Verified Risk",
                        "الخطر المتحقق"
                    )}:

                </b>

                ${this.safeNumber(
                    summary.topRisk
                )}%

                <br>

                <b>

                    ${this.text(
                        "Conflict Ratio",
                        "نسبة تعارض المصادر"
                    )}:

                </b>

                ${this.safeNumber(
                    summary.conflictRatio
                )}%

                <br>

                <b>

                    ${this.text(
                        "Generated",
                        "تاريخ الإنشاء"
                    )}:

                </b>

                ${generatedAt}

            </div>
        `;

    },
       /* =====================================================
       CITY-BY-CITY PANEL
       ===================================================== */

    renderCitiesPanel(
        results
    ) {

        const panel =
            document.getElementById(
                "multiSourceVerificationPanel"
            );

        if (!panel) {
            return;
        }

        if (
            !Array.isArray(
                results
            ) ||
            !results.length
        ) {

            panel.innerHTML = `
                <div class="empty-state">

                    ${this.text(

                        "No city verification results are available.",

                        "لا تتوفر نتائج تحقق للمدن."

                    )}

                </div>
            `;

            return;

        }

        const sortedResults =
            [
                ...results
            ]
            .sort(

                (
                    first,
                    second
                ) => {

                    return (

                        this.safeNumber(
                            second
                                .verifiedRisk
                        ) -

                        this.safeNumber(
                            first
                                .verifiedRisk
                        )

                    );

                }

            );

        panel.innerHTML =
            sortedResults
                .map(
                    result => {

                        const status =
                            String(
                                result.status ||
                                "UNVERIFIED"
                            )
                                .toUpperCase();

                        const className =
                            status ===
                                "VERIFIED"
                                ? "success"
                                : status ===
                                    "CONFLICTED"
                                    ? "danger"
                                    : status ===
                                        "UNCERTAIN"
                                        ? "warning"
                                        : status ===
                                            "INSUFFICIENT_DATA"
                                            ? "warning"
                                            : "info";

                        const decision =
                            result
                                ?.decisionGate ||
                            {};

                        const decisionAllowed =
                            decision.allowed ===
                            true;

                        const conflict =
                            result
                                ?.conflict ||
                            {
                                detected:
                                    false,

                                level:
                                    "NONE",

                                reasons:
                                    []
                            };

                        const conflictReasons =
                            Array.isArray(
                                conflict
                                    .reasons
                            )
                                ? conflict
                                    .reasons
                                : [];

                        const translatedReasons =
                            conflictReasons
                                .map(
                                    reason =>
                                        this
                                            .translateConflictReason(
                                                reason
                                            )
                                );

                        const sourceNames =
                            Object.values(
                                result.sources ||
                                {}
                            )
                                .filter(
                                    source =>
                                        source.available
                                )
                                .map(
                                    source =>
                                        source.name
                                )
                                .join(
                                    this.isArabic()
                                        ? "، "
                                        : ", "
                                );

                        return `
                            <div class="item ${className}">

                                <h3>

                                    ${this.escapeHtml(
                                        result.city ||
                                        this.text(
                                            "Unknown",
                                            "غير معروف"
                                        )
                                    )}

                                </h3>

                                <b>

                                    ${this.text(
                                        "Verification Status",
                                        "حالة التحقق"
                                    )}:

                                </b>

                                ${this.getStatusLabel(
                                    result.status
                                )}

                                <br>

                                <b>

                                    ${this.text(
                                        "Active Sources",
                                        "المصادر النشطة"
                                    )}:

                                </b>

                                ${this.safeNumber(
                                    result.activeSourceCount
                                )}

                                <br>

                                <b>

                                    ${this.text(
                                        "Available Sources",
                                        "المصادر المتاحة"
                                    )}:

                                </b>

                                ${this.escapeHtml(
                                    sourceNames ||
                                    this.text(
                                        "None",
                                        "لا يوجد"
                                    )
                                )}

                                <br><br>

                                <b>

                                    ${this.text(
                                        "Source Agreement",
                                        "اتفاق المصادر"
                                    )}:

                                </b>

                                ${this.safeNumber(
                                    result.agreement
                                )}%

                                <br>

                                <b>

                                    ${this.text(
                                        "Evidence Score",
                                        "درجة الأدلة"
                                    )}:

                                </b>

                                ${this.safeNumber(
                                    result.evidenceScore
                                )}%

                                <br>

                                <b>

                                    ${this.text(
                                        "Final Confidence",
                                        "الثقة النهائية"
                                    )}:

                                </b>

                                ${this.safeNumber(
                                    result.finalConfidence
                                )}%

                                <br>

                                <b>

                                    ${this.text(
                                        "Rain Consensus",
                                        "توافق احتمالات المطر"
                                    )}:

                                </b>

                                ${this.safeNumber(
                                    result.rainConsensus
                                )}%

                                <br>

                                <b>

                                    ${this.text(
                                        "Verified Risk",
                                        "الخطر المتحقق"
                                    )}:

                                </b>

                                ${this.safeNumber(
                                    result.verifiedRisk
                                )}%

                                <br><br>

                                <b>

                                    ${this.text(
                                        "Conflict Detected",
                                        "تم اكتشاف تعارض"
                                    )}:

                                </b>

                                ${conflict.detected
                                    ? this.text(
                                        "YES",
                                        "نعم"
                                    )
                                    : this.text(
                                        "NO",
                                        "لا"
                                    )
                                }

                                <br>

                                <b>

                                    ${this.text(
                                        "Conflict Level",
                                        "مستوى التعارض"
                                    )}:

                                </b>

                                ${this.getConflictLevelLabel(
                                    conflict.level
                                )}

                                <br>

                                <b>

                                    ${this.text(
                                        "Source Spread",
                                        "تشتت إشارات المصادر"
                                    )}:

                                </b>

                                ${this.safeNumber(
                                    conflict.sourceSpread
                                )}%

                                ${
                                    translatedReasons.length
                                        ? `
                                            <br><br>

                                            <b>

                                                ${this.text(
                                                    "Conflict Reasons",
                                                    "أسباب التعارض"
                                                )}:

                                            </b>

                                            <ul class="verification-reasons">

                                                ${translatedReasons
                                                    .map(
                                                        reason => {

                                                            return `
                                                                <li>
                                                                    ${this.escapeHtml(
                                                                        reason
                                                                    )}
                                                                </li>
                                                            `;

                                                        }
                                                    )
                                                    .join("")
                                                }

                                            </ul>
                                        `
                                        : ""
                                }

                                <br>

                                <b>

                                    ${this.text(
                                        "Decision Gate",
                                        "بوابة القرار"
                                    )}:

                                </b>

                                ${this.getDecisionActionLabel(
                                    decision.action ||
                                    "HOLD"
                                )}

                                <br>

                                <b>

                                    ${this.text(
                                        "Decision",
                                        "القرار"
                                    )}:

                                </b>

                                ${decisionAllowed
                                    ? this.text(
                                        "ALLOWED",
                                        "مسموح"
                                    )
                                    : this.text(
                                        "HELD",
                                        "معلّق"
                                    )
                                }

                                <br>

                                <b>

                                    ${this.text(
                                        "Decision Reason",
                                        "سبب القرار"
                                    )}:

                                </b>

                                ${this.escapeHtml(

                                    this
                                        .translateDecisionReason(

                                            decision.reason ||
                                            "Evidence is not sufficient."

                                        )

                                )}

                                <br>

                                <b>

                                    ${this.text(
                                        "Last Updated",
                                        "آخر تحديث"
                                    )}:

                                </b>

                                ${new Date(
                                    result.timestamp ||
                                    Date.now()
                                )
                                .toLocaleString(
                                    this.getLocale()
                                )}

                            </div>
                        `;

                    }
                )
                .join("");

    },

    /* =====================================================
       SOURCE MATRIX
       ===================================================== */

    renderSourceMatrix(
        results
    ) {

        const panel =
            document.getElementById(
                "verificationSourceMatrix"
            );

        if (!panel) {
            return;
        }

        if (
            !Array.isArray(
                results
            ) ||
            !results.length
        ) {

            panel.innerHTML = `
                <div class="empty-state">

                    ${this.text(

                        "No source matrix is available.",

                        "لا تتوفر مصفوفة للمصادر."

                    )}

                </div>
            `;

            return;

        }

        const topResult =
            [
                ...results
            ]
            .sort(

                (
                    first,
                    second
                ) => {

                    return (

                        this.safeNumber(
                            second
                                .verifiedRisk
                        ) -

                        this.safeNumber(
                            first
                                .verifiedRisk
                        )

                    );

                }

            )[0];

        if (
            !topResult ||
            !topResult.sources
        ) {

            panel.innerHTML = `
                <div class="empty-state">

                    ${this.text(

                        "No source details are available.",

                        "لا تتوفر تفاصيل للمصادر."

                    )}

                </div>
            `;

            return;

        }

        const cityName =
            this.escapeHtml(
                topResult.city ||
                "--"
            );

        const sourceCards =
            Object.entries(
                topResult.sources
            )
                .map(
                    (
                        [
                            sourceKey,
                            source
                        ]
                    ) => {

                        const available =
                            source.available ===
                            true;

                        const className =
                            available
                                ? "success"
                                : "warning";

                        const details =
                            source.details ||
                            {};

                        return `
                            <div class="item ${className}">

                                <h3>

                                    ${this.escapeHtml(

                                        this.getSourceLabel(

                                            sourceKey,

                                            source.name ||
                                            sourceKey

                                        )

                                    )}

                                </h3>

                                <b>

                                    ${this.text(
                                        "Availability",
                                        "التوفر"
                                    )}:

                                </b>

                                ${available
                                    ? this.text(
                                        "AVAILABLE",
                                        "متاح"
                                    )
                                    : this.text(
                                        "UNAVAILABLE",
                                        "غير متاح"
                                    )
                                }

                                <br>

                                <b>

                                    ${this.text(
                                        "Status",
                                        "الحالة"
                                    )}:

                                </b>

                                ${this.getStatusLabel(
                                    source.status
                                )}

                                <br>

                                <b>

                                    ${this.text(
                                        "Reliability",
                                        "الاعتمادية"
                                    )}:

                                </b>

                                ${Math.round(

                                    this.clamp(
                                        source.reliability,
                                        0,
                                        1
                                    ) *
                                    100

                                )}%

                                <br>

                                <b>

                                    ${this.text(
                                        "Signal Score",
                                        "درجة الإشارة"
                                    )}:

                                </b>

                                ${this.safeNumber(
                                    source.signalScore
                                )}%

                                <br>

                                <b>

                                    ${this.text(
                                        "Rain Probability",
                                        "احتمال المطر"
                                    )}:

                                </b>

                                ${this.safeNumber(
                                    source.rainProbability
                                )}%

                                <br>

                                <b>

                                    ${this.text(
                                        "Rain Amount",
                                        "كمية المطر"
                                    )}:

                                </b>

                                ${this.safeNumber(
                                    source.rainAmount
                                )} mm

                                ${this.renderSourceDetails(
                                    sourceKey,
                                    details
                                )}

                            </div>
                        `;

                    }
                )
                .join("");

        panel.innerHTML = `
            <div class="item info">

                <b>

                    ${this.text(
                        "Source Matrix City",
                        "مدينة مصفوفة المصادر"
                    )}:

                </b>

                ${cityName}

                <br>

                <b>

                    ${this.text(
                        "Verified Risk",
                        "الخطر المتحقق"
                    )}:

                </b>

                ${this.safeNumber(
                    topResult.verifiedRisk
                )}%

            </div>

            ${sourceCards}
        `;

    },
       renderSourceDetails(
        sourceKey,
        details = {}
    ) {

        const rows =
            [];

        const pushRow = (
            labelEn,
            labelAr,
            value,
            suffix = ""
        ) => {

            if (
                value === null ||
                value === undefined ||
                value === ""
            ) {
                return;
            }

            rows.push(`
                <br>

                <b>
                    ${this.text(
                        labelEn,
                        labelAr
                    )}:
                </b>

                ${this.escapeHtml(
                    value
                )}${suffix}
            `);

        };

        if (
            sourceKey ===
            "official"
        ) {

            pushRow(
                "Warning Level",
                "مستوى التحذير",
                this.getStatusLabel(
                    details.warningLevel ||
                    "UNKNOWN"
                )
            );

            if (
                details.issuedAt
            ) {

                const issuedAt =
                    new Date(
                        details.issuedAt
                    );

                pushRow(
                    "Issued At",
                    "وقت الإصدار",
                    Number.isNaN(
                        issuedAt.getTime()
                    )
                        ? details.issuedAt
                        : issuedAt
                            .toLocaleString(
                                this.getLocale()
                            )
                );

            }

        }

        if (
            sourceKey ===
            "radar"
        ) {

            pushRow(
                "Rain Detected",
                "تم رصد المطر",
                details.rainDetected
                    ? this.text(
                        "YES",
                        "نعم"
                    )
                    : this.text(
                        "NO",
                        "لا"
                    )
            );

            pushRow(
                "Radar Intensity",
                "شدة الرادار",
                this.safeNumber(
                    details.intensity
                )
            );

            pushRow(
                "Movement Confidence",
                "ثقة حركة السحب",
                this.safeNumber(
                    details.movementConfidence
                ),
                "%"
            );

            pushRow(
                "Frame Age",
                "عمر إطار الرادار",
                this.safeNumber(
                    details.frameAgeMinutes
                ),
                this.text(
                    " min",
                    " دقيقة"
                )
            );

        }

        if (
            sourceKey ===
            "satellite"
        ) {

            pushRow(
                "Cloud Cover",
                "الغطاء السحابي",
                this.safeNumber(
                    details.cloudCover
                ),
                "%"
            );

            pushRow(
                "Convection Score",
                "درجة الحمل الحراري",
                this.safeNumber(
                    details.convectionScore
                ),
                "%"
            );

            pushRow(
                "Cloud Temperature",
                "درجة حرارة السحب",
                this.safeNumber(
                    details.cloudTemperature
                ),
                " °C"
            );

            pushRow(
                "Storm Cell Score",
                "درجة الخلية العاصفية",
                this.safeNumber(
                    details.stormCellScore
                ),
                "%"
            );

        }

        if (
            sourceKey ===
            "lightning"
        ) {

            pushRow(
                "Lightning Strikes",
                "عدد ضربات البرق",
                this.safeNumber(
                    details.strikes
                )
            );

            pushRow(
                "Distance",
                "المسافة",
                this.safeNumber(
                    details.distanceKm
                ),
                " km"
            );

            pushRow(
                "Activity Score",
                "درجة نشاط البرق",
                this.safeNumber(
                    details.activityScore
                ),
                "%"
            );

            pushRow(
                "Trend",
                "الاتجاه",
                this.translateLightningTrend(
                    details.trend
                )
            );

        }

        if (
            sourceKey ===
            "openMeteo"
        ) {

            pushRow(
                "Humidity",
                "الرطوبة",
                this.safeNumber(
                    details.humidity
                ),
                "%"
            );

            pushRow(
                "Cloud Cover",
                "الغطاء السحابي",
                this.safeNumber(
                    details.cloudCover
                ),
                "%"
            );

            pushRow(
                "Wind Speed",
                "سرعة الرياح",
                this.safeNumber(
                    details.windSpeed
                ),
                " km/h"
            );

            pushRow(
                "Pressure",
                "الضغط الجوي",
                this.safeNumber(
                    details.pressure
                ),
                " hPa"
            );

        }

        if (
            sourceKey ===
            "localModel"
        ) {

            pushRow(
                "Weather Score",
                "درجة الطقس",
                this.safeNumber(
                    details.weatherScore
                ),
                "%"
            );

            pushRow(
                "Flood Index",
                "مؤشر السيول",
                this.safeNumber(
                    details.floodIndex
                ),
                "%"
            );

            pushRow(
                "Road Risk",
                "خطر الطرق",
                this.safeNumber(
                    details.roadRisk
                ),
                "%"
            );

            pushRow(
                "Final Risk",
                "الخطر النهائي",
                this.safeNumber(
                    details.finalRisk
                ),
                "%"
            );

            pushRow(
                "Model Confidence",
                "ثقة النموذج",
                this.safeNumber(
                    details.confidence
                ),
                "%"
            );

        }

        return rows.join("");

    },

    translateLightningTrend(
        trend
    ) {

        const value =
            String(
                trend ?? "STABLE"
            )
                .trim()
                .toUpperCase();

        const labels = {

            RISING: {
                en:
                    "RISING",

                ar:
                    "متصاعد"
            },

            STABLE: {
                en:
                    "STABLE",

                ar:
                    "مستقر"
            },

            FALLING: {
                en:
                    "FALLING",

                ar:
                    "متراجع"
            },

            UNKNOWN: {
                en:
                    "UNKNOWN",

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

    /* =====================================================
       VERIFICATION KPI PANEL
       ===================================================== */

    renderVerificationKPIs(
        summary
    ) {

        if (!summary) {
            return;
        }

        const agreementTop =
            document.getElementById(
                "verificationAgreementTop"
            );

        const evidenceTop =
            document.getElementById(
                "verificationEvidenceTop"
            );

        const confidenceTop =
            document.getElementById(
                "verificationConfidenceTop"
            );

        const confidence =
            document.getElementById(
                "verificationConfidence"
            );

        const statusTop =
            document.getElementById(
                "verificationStatusTop"
            );

        const status =
            document.getElementById(
                "verificationStatus"
            );

        if (
            agreementTop
        ) {

            agreementTop.textContent =
                `${this.safeNumber(
                    summary.averageAgreement
                )}%`;

        }

        if (
            evidenceTop
        ) {

            evidenceTop.textContent =
                `${this.safeNumber(
                    summary.averageEvidenceScore
                )}%`;

        }

        if (
            confidenceTop
        ) {

            confidenceTop.textContent =
                `${this.safeNumber(
                    summary.nationalConfidence
                )}%`;

        }

        if (
            confidence
        ) {

            confidence.textContent =
                `${this.safeNumber(
                    summary.nationalConfidence
                )}%`;

        }

        const rawStatus =
            summary.nationalStatus ||
            "NO_DATA";

        if (
            statusTop
        ) {

            statusTop.dataset.stateValue =
                rawStatus;

            statusTop.textContent =
                this.getStatusLabel(
                    rawStatus
                );

        }

        if (
            status
        ) {

            status.dataset.stateValue =
                rawStatus;

            status.textContent =
                this.getStatusLabel(
                    rawStatus
                );

        }

    },

    renderEmptyState(
        message
    ) {

        const panel =
            document.getElementById(
                "multiSourceVerificationPanel"
            );

        const summaryPanel =
            document.getElementById(
                "nationalVerificationSummary"
            );

        const matrixPanel =
            document.getElementById(
                "verificationSourceMatrix"
            );

        const safeMessage =
            this.escapeHtml(
                message
            );

        const html = `
            <div class="item warning">
                ${safeMessage}
            </div>
        `;

        if (
            panel
        ) {

            panel.innerHTML =
                html;

        }

        if (
            summaryPanel
        ) {

            summaryPanel.innerHTML =
                html;

        }

        if (
            matrixPanel
        ) {

            matrixPanel.innerHTML =
                html;

        }

    },

    /* =====================================================
       EVENTS AND DATA SHARING
       ===================================================== */

    publishResults(
        results,
        summary
    ) {

        window.RG30
            .latestVerification =
            results;

        window.RG30
            .latestNationalSummary =
            summary;

        window.dispatchEvent(

            new CustomEvent(

                "rg30:verification-completed",

                {
                    detail: {

                        results,

                        summary,

                        timestamp:
                            this.lastRunAt,

                        cycleNumber:
                            this.cycleNumber,

                        version:
                            this.version

                    }
                }

            )

        );

        if (
            window.RG29
        ) {

            window.RG29
                .verificationResults =
                results;

            window.RG29
                .verificationSummary =
                summary;

        }

        if (
            window.RG23
                ?.NationalDatabase
        ) {

            try {

                const database =
                    window.RG23
                        .NationalDatabase;

                if (
                    typeof database
                        .addCycle ===
                        "function"
                ) {

                    database.addCycle({

                        type:
                            "V30 Multi-Source Verification",

                        cities:
                            results.length,

                        verifiedCities:
                            summary
                                ?.verifiedCities ||
                            0,

                        supportedCities:
                            summary
                                ?.supportedCities ||
                            0,

                        conflictedCities:
                            summary
                                ?.conflictedCities ||
                            0,

                        nationalConfidence:
                            summary
                                ?.nationalConfidence ||
                            0,

                        nationalStatus:
                            summary
                                ?.nationalStatus ||
                            "NO_DATA",

                        topCity:
                            summary
                                ?.topCity ||
                            "--",

                        topRisk:
                            summary
                                ?.topRisk ||
                            0,

                        timestamp:
                            this.lastRunAt

                    });

                }

            } catch (error) {

                console.warn(
                    "V30 database cycle save skipped:",
                    error
                );

            }

        }

    },
       /* =====================================================
       HELPERS
       ===================================================== */

    rainAmountToScore(
        amount
    ) {

        const value =
            this.safeNumber(
                amount,
                0
            );

        if (
            value <= 0
        ) {
            return 0;
        }

        if (
            value < 0.5
        ) {
            return 10;
        }

        if (
            value < 2
        ) {
            return 25;
        }

        if (
            value < 5
        ) {
            return 45;
        }

        if (
            value < 10
        ) {
            return 65;
        }

        if (
            value < 25
        ) {
            return 82;
        }

        return 100;

    },

    warningLevelToScore(
        level
    ) {

        const value =
            String(
                level || ""
            )
                .trim()
                .toUpperCase();

        const map = {

            UNKNOWN:
                0,

            NORMAL:
                5,

            GREEN:
                5,

            WATCH:
                35,

            YELLOW:
                40,

            WARNING:
                65,

            ORANGE:
                70,

            EMERGENCY:
                95,

            RED:
                100

        };

        return map[
            value
        ] ?? 0;

    },

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

    lightningTrendToScore(
        trend
    ) {

        const value =
            String(
                trend || ""
            )
                .trim()
                .toUpperCase();

        const map = {

            RISING:
                100,

            INCREASING:
                100,

            ACTIVE:
                80,

            STABLE:
                50,

            FALLING:
                25,

            DECREASING:
                25,

            UNKNOWN:
                20

        };

        return map[
            value
        ] ?? 20;

    },

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
            Number(
                value
            );

        if (
            !Number.isFinite(
                number
            )
        ) {

            return min;

        }

        return Math.min(

            max,

            Math.max(
                min,
                number
            )

        );

    },

    escapeHtml(
        value
    ) {

        const div =
            document.createElement(
                "div"
            );

        div.textContent =
            String(
                value ?? ""
            );

        return div.innerHTML;

    },

    getVerificationClass(
        status
    ) {

        const value =
            String(
                status || ""
            )
                .trim()
                .toUpperCase();

        if (
            value ===
                "VERIFIED"
        ) {

            return "success";

        }

        if (
            value ===
                "CONFLICTED"
        ) {

            return "danger";

        }

        if (
            value ===
                "UNCERTAIN" ||
            value ===
                "INSUFFICIENT_DATA"
        ) {

            return "warning";

        }

        return "info";

    },

    getNationalStatusClass(
        status
    ) {

        const value =
            String(
                status || ""
            )
                .trim()
                .toUpperCase();

        if (
            value ===
                "EMERGENCY" ||
            value ===
                "SOURCE_CONFLICT"
        ) {

            return "danger";

        }

        if (
            value ===
                "WARNING" ||
            value ===
                "WATCH"
        ) {

            return "warning";

        }

        return "success";

    },

    normalizeStatus(
        status
    ) {

        return String(
            status ?? ""
        )
            .trim()
            .toUpperCase()
            .replaceAll(
                " ",
                "_"
            );

    },

    getSourceCoverage(
        result
    ) {

        const count =
            this.safeNumber(

                result
                    ?.activeSourceCount,

                0

            );

        return this.calculateSourceCoverage(
            count
        );

    },

    getTopResult(
        results = []
    ) {

        if (
            !Array.isArray(
                results
            ) ||
            !results.length
        ) {

            return null;

        }

        return [
            ...results
        ]
            .sort(
                (
                    first,
                    second
                ) => {

                    return (

                        this.safeNumber(
                            second
                                ?.verifiedRisk
                        ) -

                        this.safeNumber(
                            first
                                ?.verifiedRisk
                        )

                    );

                }
            )[0];

    },

    getState() {

        return {

            version:
                this.version,

            initialized:
                this.initialized,

            isRunning:
                this.isRunning,

            cycleInProgress:
                this.cycleInProgress,

            cycleNumber:
                this.cycleNumber,

            lastRunAt:
                this.lastRunAt,

            cityCount:
                this.latestCities.length,

            resultCount:
                this.latestVerification.length,

            latestNationalSummary:
                this.latestNationalSummary,

            language:
                window.RG30
                    ?.I18n
                    ?.language ||
                "en"

        };

    },

    reset() {

        this.isRunning =
            false;

        this.cycleInProgress =
            false;

        this.cycleNumber =
            0;

        this.lastRunAt =
            null;

        this.latestCities =
            [];

        this.latestVerification =
            [];

        this.latestNationalSummary =
            null;

        this.latestRenderContext = {

            results:
                [],

            summary:
                null

        };

        this.renderEmptyState(

            this.text(

                "Verification engine has been reset.",

                "تمت إعادة ضبط محرك التحقق."

            )

        );

        console.log(
            "RG30 Verification Engine reset."
        );

    },

    writeLog(
        message,
        type = "success"
    ) {

        const translatedMessage =
            this.translateMessage(
                message
            );

        console.log(
            `[RainGuard V30 Verification] ${translatedMessage}`
        );

        if (
            window.RG23
                ?.Brain
                ?.writeCommander
        ) {

            try {

                window.RG23
                    .Brain
                    .writeCommander(

                        translatedMessage,

                        type

                    );

            } catch (error) {

                console.warn(
                    "V30 commander log skipped:",
                    error
                );

            }

            return;

        }

        if (
            window.RG30
                ?.Orchestrator
                ?.writeCommander
        ) {

            try {

                window.RG30
                    .Orchestrator
                    .writeCommander(

                        translatedMessage,

                        type

                    );

            } catch (error) {

                console.warn(
                    "V30 orchestrator log skipped:",
                    error
                );

            }

        }

    },

    /* =====================================================
       COMPATIBILITY
       ===================================================== */

    registerCompatibilityAliases() {

        window.RG30
            .VerificationEngine =
            this;

        window.RG30
            .NationalVerificationEngine =
            this;

        window.RG30
            .MultiSourceVerificationEngine =
            this;

        window.RG30
            .VerificationEngineV30 =
            this;

        console.log(
            "RG30 Verification Engine compatibility aliases registered."
        );

    },

    destroy() {

        this.reset();

        this.initialized =
            false;

        console.log(
            "RG30 Verification Engine destroyed."
        );

    }

};
/* =========================================================
   AUTO START
   ========================================================= */

window.addEventListener(

    "load",

    () => {

        try {

            const engine =
                window.RG30
                    ?.VerificationEngine;

            if (!engine) {

                console.error(
                    "RG30 Verification Engine was not found."
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

                        const cities =
                            window.RG23
                                ?.Brain
                                ?.latestCities ||
                            [];

                        if (
                            Array.isArray(
                                cities
                            ) &&
                            cities.length &&
                            !engine
                                .cycleInProgress
                        ) {

                            engine.run(
                                cities
                            );

                        }

                    } catch (error) {

                        console.warn(
                            "Initial V30 verification run skipped:",
                            error
                        );

                    }

                },

                3500

            );

        } catch (error) {

            console.error(
                "RG30 Verification Engine initialization failed:",
                error
            );

        }

    }

);


/* =========================================================
   GLOBAL SHORTCUTS
   ========================================================= */

window.runV30Verification =
    function (
        cities
    ) {

        const sourceCities =
            Array.isArray(
                cities
            )
                ? cities
                : (
                    window.RG23
                        ?.Brain
                        ?.latestCities ||
                    []
                );

        return window.RG30
            ?.VerificationEngine
            ?.run(
                sourceCities
            );

    };


window.getV30VerificationState =
    function () {

        return window.RG30
            ?.VerificationEngine
            ?.getState();

    };


window.getV30VerificationResults =
    function () {

        return window.RG30
            ?.VerificationEngine
            ?.latestVerification ||
            [];

    };


window.getV30NationalSummary =
    function () {

        return window.RG30
            ?.VerificationEngine
            ?.latestNationalSummary ||
            null;

    };


window.resetV30Verification =
    function () {

        return window.RG30
            ?.VerificationEngine
            ?.reset();

    };


window.destroyV30Verification =
    function () {

        return window.RG30
            ?.VerificationEngine
            ?.destroy();

    };


/* =========================================================
   CONSOLE READY MESSAGE
   ========================================================= */

console.log(

    "%cRainGuard AI V30 Verification Engine 30.1.0 Bilingual Ready",

    "color:#18e4a0;font-weight:bold;font-size:14px;"

);
