/* =========================================================
   RainGuard AI V31
   National Weather Intelligence Verification Engine
   Backward Compatible with V30

   File:
   frontend/js/verification_engine_v30.js

   Features:
   - Multi-Source Verification
   - Data Quality Index
   - Dynamic Source Weighting
   - Source Evidence Contribution
   - Lightning Intelligence
   - Conflict Intelligence
   - Explainable Decision Gate
   - Arabic / English Support
   ========================================================= */

"use strict";

window.RG30 =
    window.RG30 || {};

window.RG31 =
    window.RG31 || {};

RG30.VerificationEngine = {

    version:
        "31.0.0-intelligence-compatible",

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

    latestRenderContext: {

        results:
            [],

        summary:
            null

    },

    previousDynamicWeights:
        {},

    config: {

        /* =================================================
           BASIC VERIFICATION
           ================================================= */

        minimumSources:
            2,

        maximumSources:
            6,

        agreementTolerance: {

            rainProbability:
                18,

            rainAmount:
                4,

            risk:
                15

        },

        /*
         * حدود مؤقتة أثناء تطوير V31.
         * يمكن رفع verified لاحقًا بعد اكتمال
         * Local AI والمصادر الحقيقية.
         */
        thresholds: {

            verified:
                55,

            supported:
                45,

            uncertain:
                30

        },

        conflictAgreementThreshold:
            45,

        officialForecastDifferenceThreshold:
            35,

        lowForecastProbabilityThreshold:
            15,

        /* =================================================
           SOURCE RELIABILITY
           ================================================= */

        defaultReliability: {

            official:
                1.00,

            radar:
                0.92,

            satellite:
                0.86,

            lightning:
                0.90,

            openMeteo:
                0.80,

            localModel:
                0.76

        },

        /* =================================================
           BASE SOURCE WEIGHTS
           ================================================= */

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

        baseSourceWeights: {

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

        /* =================================================
           DYNAMIC SOURCE WEIGHTING
           ================================================= */

        dynamicWeighting: {

            enabled:
                true,

            minimumWeight:
                0.02,

            maximumWeight:
                0.40,

            maximumIncreasePerCycle:
                0.05,

            maximumDecreasePerCycle:
                0.07,

            factors: {

                dataQuality:
                    0.35,

                freshness:
                    0.20,

                reliability:
                    0.20,

                technicalHealth:
                    0.10,

                completeness:
                    0.10,

                spatialRelevance:
                    0.05

            },

            simulationPenalty:
                0.50,

            stalePenalty:
                0.65,

            expiredPenalty:
                0.25,

            unavailableWeight:
                0

        },

        /* =================================================
           DATA QUALITY INDEX
           ================================================= */

        dataQuality: {

            enabled:
                true,

            weights: {

                freshness:
                    0.30,

                completeness:
                    0.20,

                reliability:
                    0.20,

                spatialRelevance:
                    0.15,

                temporalContinuity:
                    0.10,

                technicalHealth:
                    0.05

            },

            thresholds: {

                excellent:
                    90,

                good:
                    75,

                acceptable:
                    55,

                weak:
                    35,

                unusable:
                    0

            },

            minimumUsableScore:
                35,

            exclusionScore:
                20

        },

        /* =================================================
           SOURCE FRESHNESS WINDOWS
           ================================================= */

        freshness: {

            official: {

                freshMinutes:
                    15,

                acceptableMinutes:
                    45,

                staleMinutes:
                    120

            },

            radar: {

                freshMinutes:
                    10,

                acceptableMinutes:
                    30,

                staleMinutes:
                    60

            },

            satellite: {

                freshMinutes:
                    15,

                acceptableMinutes:
                    45,

                staleMinutes:
                    120

            },

            lightning: {

                freshMinutes:
                    5,

                acceptableMinutes:
                    15,

                staleMinutes:
                    30

            },

            openMeteo: {

                freshMinutes:
                    30,

                acceptableMinutes:
                    90,

                staleMinutes:
                    180

            },

            localModel: {

                freshMinutes:
                    10,

                acceptableMinutes:
                    30,

                staleMinutes:
                    60

            }

        },

        /* =================================================
           LIGHTNING INTELLIGENCE V31
           ================================================= */

        lightningIntelligence: {

            enabled:
                true,

            criticalRadiusKm:
                25,

            warningRadiusKm:
                60,

            watchRadiusKm:
                120,

            maximumDetectionRadiusKm:
                250,

            strikeThresholds: {

                extreme:
                    40,

                high:
                    20,

                moderate:
                    8,

                low:
                    1

            },

            densityThresholds: {

                extreme:
                    12,

                high:
                    7,

                moderate:
                    3,

                low:
                    0.5

            },

            activityThresholds: {

                extreme:
                    80,

                high:
                    60,

                moderate:
                    35,

                low:
                    15

            },

            trendScores: {

                RAPIDLY_INCREASING:
                    100,

                RISING:
                    90,

                INCREASING:
                    80,

                ACTIVE:
                    70,

                STABLE:
                    50,

                FALLING:
                    25,

                DECREASING:
                    25,

                NO_ACTIVITY:
                    0,

                UNKNOWN:
                    20

            },

            weightBoostActivityScore:
                65,

            maximumDynamicWeight:
                0.22,

            minimumDynamicWeight:
                0.03,

            simulationMaximumWeight:
                0.06,

            stormThreatThreshold:
                60,

            severeStormThreatThreshold:
                80

        },

        /* =================================================
           SOURCE CONTRIBUTION
           ================================================= */

        contribution: {

            enabled:
                true,

            minimumContribution:
                0,

            maximumContribution:
                100,

            factors: {

                signalScore:
                    0.40,

                confidence:
                    0.20,

                dataQuality:
                    0.20,

                effectiveWeight:
                    0.20

            }

        },

        /* =================================================
           CONFIDENCE ENGINE
           ================================================= */

        confidenceEngine: {

            agreementWeight:
                0.30,

            evidenceWeight:
                0.25,

            coverageWeight:
                0.15,

            reliabilityWeight:
                0.15,

            dataQualityWeight:
                0.15,

            officialBonus:
                6,

            radarBonus:
                4,

            lightningBonus:
                3,

            conflictPenalty:
                8,

            highConflictPenalty:
                15

        },

        /* =================================================
           CONFLICT INTELLIGENCE
           ================================================= */

        conflictIntelligence: {

            enabled:
                true,

            sourceSpreadMedium:
                45,

            sourceSpreadHigh:
                65,

            satelliteRadarDifference:
                45,

            lightningRadarDifference:
                50,

            lightningSatelliteDifference:
                45,

            officialOpenMeteoDifference:
                35,

            minimumLightningThreatForConflict:
                60,

            maximumRadarSignalForLightningConflict:
                20

        },

        /* =================================================
           DECISION GATE V31
           ================================================= */

        decisionGate: {

            verifiedConfidence:
                70,

            supportedConfidence:
                55,

            emergencyRisk:
                75,

            warningRisk:
                55,

            watchRisk:
                35,

            stormThreatEscalation:
                75,

            minimumDataQuality:
                45,

            allowSimulationDecision:
                false

        },

        /* =================================================
           DEVELOPMENT MODE
           ================================================= */

        development: {

            enabled:
                true,

            allowSimulationSources:
                true,

            showContributionDetails:
                true,

            showDynamicWeights:
                true,

            showDataQuality:
                true,

            logWeightChanges:
                true

        }

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

            try {

                return i18n
                    .translateText(
                        message
                    );

            } catch (error) {

                console.warn(
                    "V31 translation skipped:",
                    error
                );

            }

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

            return (
                fallback ||
                String(
                    sourceKey ?? ""
                )
            );

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

            AVAILABLE: {

                en:
                    "AVAILABLE",

                ar:
                    "متاح"

            },

            CONNECTED: {

                en:
                    "CONNECTED",

                ar:
                    "متصل"

            },

            SIMULATION: {

                en:
                    "SIMULATION",

                ar:
                    "محاكاة"

            },

            CACHED: {

                en:
                    "CACHED",

                ar:
                    "من الذاكرة المؤقتة"

            },

            UNAVAILABLE: {

                en:
                    "UNAVAILABLE",

                ar:
                    "غير متاح"

            },

            DISABLED: {

                en:
                    "DISABLED",

                ar:
                    "معطل"

            },

            FAILED: {

                en:
                    "FAILED",

                ar:
                    "فشل"

            },

            TIMEOUT: {

                en:
                    "TIMEOUT",

                ar:
                    "انتهت المهلة"

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
            ] ||
            labels.UNKNOWN;

        return this.isArabic()
            ? item.ar
            : item.en;

    },

    getConflictLevelLabel(
        level
    ) {

        const value =
            String(
                level ?? "NONE"
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

            LOW: {

                en:
                    "LOW",

                ar:
                    "منخفض"

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

            },

            SEVERE: {

                en:
                    "SEVERE",

                ar:
                    "شديد"

            }

        };

        const item =
            labels[
                value
            ] ||
            labels.NONE;

        return this.isArabic()
            ? item.ar
            : item.en;

    },

    getDecisionActionLabel(
        action
    ) {

        const value =
            String(
                action ?? "HOLD"
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

            },

            STORM_ESCALATION: {

                en:
                    "STORM ESCALATION",

                ar:
                    "تصعيد خطر العاصفة"

            },

            LIGHTNING_ALERT: {

                en:
                    "LIGHTNING ALERT",

                ar:
                    "تنبيه برق"

            }

        };

        const item =
            labels[
                value
            ];

        if (!item) {

            return value;

        }

        return this.isArabic()
            ? item.ar
            : item.en;

    },

    getDataQualityLabel(
        level
    ) {

        const value =
            String(
                level ?? "UNUSABLE"
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

            UNUSABLE: {

                en:
                    "Unusable",

                ar:
                    "غير صالح"

            }

        };

        const item =
            labels[
                value
            ] ||
            labels.UNUSABLE;

        return this.isArabic()
            ? item.ar
            : item.en;

    },

    getStormThreatLabel(
        level
    ) {

        const value =
            String(
                level ?? "NONE"
            )
                .trim()
                .toUpperCase();

        const labels = {

            SEVERE: {

                en:
                    "Severe Storm Threat",

                ar:
                    "تهديد عاصفة شديد"

            },

            HIGH: {

                en:
                    "High Storm Threat",

                ar:
                    "تهديد عاصفة مرتفع"

            },

            MODERATE: {

                en:
                    "Moderate Storm Threat",

                ar:
                    "تهديد عاصفة متوسط"

            },

            LOW: {

                en:
                    "Low Storm Threat",

                ar:
                    "تهديد عاصفة منخفض"

            },

            NONE: {

                en:
                    "No Storm Threat",

                ar:
                    "لا يوجد تهديد عاصفي"

            }

        };

        const item =
            labels[
                value
            ] ||
            labels.NONE;

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
                "عدد المصادر النشطة غير كافٍ.",

            "Severe storm threat requires immediate escalation.":
                "يتطلب تهديد العاصفة الشديد تصعيدًا فوريًا.",

            "Lightning activity requires immediate operational attention.":
                "يتطلب نشاط البرق اهتمامًا تشغيليًا فوريًا.",

            "Data quality is below the operational threshold.":
                "جودة البيانات أقل من الحد التشغيلي المطلوب.",

            "Simulation evidence cannot authorize an operational decision.":
                "لا يمكن لبيانات المحاكاة اعتماد قرار تشغيلي."

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

            "Satellite and radar signals differ significantly.":
                "يوجد اختلاف كبير بين إشارات الأقمار الصناعية والرادار.",

            "Lightning activity is high while radar rain signal is low.":
                "نشاط البرق مرتفع بينما إشارة المطر في الرادار منخفضة.",

            "Lightning and satellite signals differ significantly.":
                "يوجد اختلاف كبير بين إشارات البرق والأقمار الصناعية.",

            "Low agreement among available sources.":
                "يوجد اتفاق منخفض بين المصادر المتاحة.",

            "Wide signal spread detected across active sources.":
                "تم رصد تشتت واسع بين إشارات المصادر النشطة.",

            "Lightning threat is high but supporting atmospheric evidence is weak.":
                "تهديد البرق مرتفع لكن الأدلة الجوية الداعمة ضعيفة.",

            "Data quality varies significantly between active sources.":
                "توجد فروق كبيرة في جودة البيانات بين المصادر النشطة."

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

                "RainGuard AI V31 National Weather Intelligence Verification Engine is ready.",

                "محرك RainGuard AI V31 الوطني لذكاء الطقس والتحقق جاهز."

            )

        );

        window.dispatchEvent(

            new CustomEvent(

                "rg31:verification-ready",

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

        window.dispatchEvent(

            new CustomEvent(

                "rg30:verification-ready",

                {
                    detail: {

                        version:
                            this.version,

                        compatibility:
                            "V30",

                        timestamp:
                            new Date()
                                .toISOString()

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
                    cities.length &&
                    !this.cycleInProgress
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
                    cities.length &&
                    !this.cycleInProgress
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

            "rg31:run-verification",

            event => {

                const cities =
                    event
                        ?.detail
                        ?.cities ||
                    window.RG30
                        ?.SourceAdapter
                        ?.toVerificationCities?.() ||
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

                this.refreshRender();

            }

        );

        window.addEventListener(

            "rg31:language-changed",

            () => {

                this.refreshRender();

            }

        );

        window.addEventListener(

            "rg31:source-updated",

            event => {

                const sourceKey =
                    event
                        ?.detail
                        ?.sourceKey;

                if (
                    sourceKey ===
                        "lightning" &&
                    this.config
                        .development
                        .logWeightChanges
                ) {

                    console.log(
                        "V31 Lightning source update received."
                    );

                }

            }

        );

    },

    refreshRender() {

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
                "V31 verification language refresh failed:",
                error
            );

        }

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

                    "Verification cycle skipped because another cycle is active.",

                    "تم تجاوز دورة التحقق لأن دورة أخرى ما زالت نشطة."

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

                    "No city data is available for verification.",

                    "لا تتوفر بيانات مدن لإجراء التحقق."

                );

            this.renderEmptyState(
                message
            );

            this.writeLog(
                message,
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

                    `V31 verification cycle ${this.cycleNumber} started for ${cities.length} cities.`,

                    `بدأت دورة التحقق V31 رقم ${this.cycleNumber} لعدد ${cities.length} مدينة.`

                )

            );

            const preparedCities =
                cities
                    .filter(
                        Boolean
                    )
                    .map(
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

            this.previousDynamicWeights =
                this.calculateNationalAverageWeights(
                    results
                );

            this.writeLog(

                this.text(

                    `V31 verification completed. National confidence: ${this.latestNationalSummary?.nationalConfidence || 0}%.`,

                    `اكتملت عملية التحقق V31. الثقة الوطنية: ${this.latestNationalSummary?.nationalConfidence || 0}%.`

                )

            );

            window.dispatchEvent(

                new CustomEvent(

                    "rg31:verification-cycle-finished",

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

                            version:
                                this.version

                        }
                    }

                )

            );

            return this.latestVerification;

        } catch (error) {

            console.error(
                "V31 verification run failed:",
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

                    "rg31:verification-failed",

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

        const prepared = {

            ...source,

            name:
                source.name ||
                source.city ||
                source.cityName ||
                this.text(
                    "Unknown",
                    "غير معروف"
                ),

            city:
                source.city ||
                source.name ||
                source.cityName ||
                this.text(
                    "Unknown",
                    "غير معروف"
                ),

            cityId:
                source.cityId ??
                source.id ??
                null,

            region:
                source.region ||
                source.area ||
                source.province ||
                "",

            lat:
                this.safeNumber(

                    source.lat ??
                    source.latitude,

                    0

                ),

            lon:
                this.safeNumber(

                    source.lon ??
                    source.lng ??
                    source.longitude,

                    0

                ),

            sourceCoverage:
                this.safeNumber(
                    source.sourceCoverage,
                    0
                ),

            readyForVerification:
                source.readyForVerification ===
                true,

            missingRequiredSources:
                Array.isArray(
                    source.missingRequiredSources
                )
                    ? [
                        ...source
                            .missingRequiredSources
                    ]
                    : [],

            officialData:
                this.prepareOfficialData(
                    officialData,
                    source
                ),

            radarData:
                this.prepareRadarData(
                    radarData,
                    source
                ),

            satelliteData:
                this.prepareSatelliteData(
                    satelliteData,
                    source
                ),

            lightningData:
                this.prepareLightningData(
                    lightningData,
                    source
                ),

            openMeteoData:
                this.prepareOpenMeteoData(
                    openMeteoData,
                    source
                ),

            localModelData:
                this.prepareLocalModelData(
                    localModelData,
                    source
                )

        };

        return prepared;

    },

    /* =====================================================
       OFFICIAL SOURCE PREPARATION
       ===================================================== */

    prepareOfficialData(
        data = {},
        source = {}
    ) {

        const available =

            data.available ===
                true ||

            data.ok ===
                true ||

            [
                "AVAILABLE",
                "ACTIVE",
                "CONNECTED",
                "VERIFIED",
                "SIMULATION",
                "CACHED"
            ]
            .includes(
                this.normalizeStatus(
                    data.status
                )
            );

        const timestamp =

            data.timestamp ||

            data.issuedAt ||

            data.details
                ?.issuedAt ||

            source.officialTimestamp ||

            new Date()
                .toISOString();

        const ageMinutes =
            this.firstNumber(

                data.ageMinutes,

                data.dataAgeMinutes,

                this.calculateAgeMinutes(
                    timestamp
                )

            );

        return {

            available,

            status:
                data.status ||
                (
                    available
                        ? "AVAILABLE"
                        : "PENDING_API"
                ),

            official:
                data.official !==
                false,

            simulated:
                data.simulated ===
                true ||

                this.normalizeStatus(
                    data.status
                ) ===
                "SIMULATION",

            mode:
                data.mode ||
                (
                    data.simulated
                        ? "SIMULATION"
                        : "OFFICIAL"
                ),

            rainProbability:
                this.clamp(

                    this.firstNumber(

                        data.rainProbability,

                        data.probability,

                        data.precipitationProbability,

                        source
                            .officialRainProbability

                    ),

                    0,

                    100

                ),

            rainAmount:
                this.clamp(

                    this.firstNumber(

                        data.rainAmount,

                        data.precipitation,

                        data.rain,

                        source
                            .officialRainAmount

                    ),

                    0,

                    1000

                ),

            warningLevel:

                data.warningLevel ||

                data.level ||

                data.details
                    ?.warningLevel ||

                source
                    .officialWarningLevel ||

                "UNKNOWN",

            confidence:
                this.clamp(

                    this.firstNumber(

                        data.confidence,

                        data.details
                            ?.confidence,

                        available
                            ? 90
                            : 0

                    ),

                    0,

                    100

                ),

            signalScore:
                this.clamp(

                    this.firstNumber(

                        data.signalScore,

                        data.score,

                        0

                    ),

                    0,

                    100

                ),

            reliability:
                this.clamp(

                    this.firstNumber(

                        data.reliability,

                        data.trust,

                        this.config
                            .defaultReliability
                            .official

                    ),

                    0,

                    1

                ),

            timestamp,

            issuedAt:

                data.issuedAt ||

                data.details
                    ?.issuedAt ||

                timestamp,

            ageMinutes,

            dataAgeMinutes:
                ageMinutes,

            historyCount:
                this.firstNumber(

                    data.historyCount,

                    data.details
                        ?.historyCount,

                    0

                ),

            details: {

                ...(data.details || {}),

                warningLevel:

                    data.warningLevel ||

                    data.details
                        ?.warningLevel ||

                    "UNKNOWN",

                issuedAt:

                    data.issuedAt ||

                    data.details
                        ?.issuedAt ||

                    timestamp

            },

            error:
                data.error ||
                null

        };

    },

    /* =====================================================
       RADAR SOURCE PREPARATION
       ===================================================== */

    prepareRadarData(
        data = {},
        source = {}
    ) {

        const intensity =
            this.clamp(

                this.firstNumber(

                    data.intensity,

                    data.rainIntensity,

                    data.details
                        ?.intensity,

                    source.radarIntensity

                ),

                0,

                100

            );

        const rainAmount =
            this.clamp(

                this.firstNumber(

                    data.rainAmount,

                    data.precipitation,

                    data.details
                        ?.rainAmount,

                    source.radarRainAmount

                ),

                0,

                1000

            );

        const rainDetected =

            data.rainDetected ===
                true ||

            data.details
                ?.rainDetected ===
                true ||

            intensity > 0 ||

            rainAmount > 0;

        const available =

            data.available ===
                true ||

            data.ok ===
                true ||

            rainDetected ||

            [
                "AVAILABLE",
                "ACTIVE",
                "CONNECTED",
                "CACHED"
            ]
            .includes(
                this.normalizeStatus(
                    data.status
                )
            );

        const timestamp =

            data.timestamp ||

            data.details
                ?.radarFrameTime ||

            source.radarTimestamp ||

            new Date()
                .toISOString();

        const frameAgeMinutes =
            this.firstNumber(

                data.frameAgeMinutes,

                data.ageMinutes,

                data.details
                    ?.frameAgeMinutes,

                this.calculateAgeMinutes(
                    timestamp
                )

            );

        return {

            available,

            status:
                data.status ||
                (
                    available
                        ? "ACTIVE"
                        : "UNAVAILABLE"
                ),

            official:
                data.official ===
                true,

            simulated:
                data.simulated ===
                true,

            mode:
                data.mode ||
                "RADAR",

            intensity,

            rainDetected,

            rainAmount,

            rainProbability:
                this.clamp(

                    this.firstNumber(

                        data.rainProbability,

                        data.probability,

                        data.signalScore,

                        0

                    ),

                    0,

                    100

                ),

            movementConfidence:
                this.clamp(

                    this.firstNumber(

                        data.movementConfidence,

                        data.details
                            ?.movementConfidence,

                        source
                            .radarMovementConfidence

                    ),

                    0,

                    100

                ),

            confidence:
                this.clamp(

                    this.firstNumber(

                        data.confidence,

                        data.details
                            ?.confidence,

                        available
                            ? 70
                            : 0

                    ),

                    0,

                    100

                ),

            signalScore:
                this.clamp(

                    this.firstNumber(

                        data.signalScore,

                        data.score,

                        intensity

                    ),

                    0,

                    100

                ),

            reliability:
                this.clamp(

                    this.firstNumber(

                        data.reliability,

                        data.trust,

                        this.config
                            .defaultReliability
                            .radar

                    ),

                    0,

                    1

                ),

            frameAgeMinutes,

            ageMinutes:
                frameAgeMinutes,

            dataAgeMinutes:
                frameAgeMinutes,

            timestamp,

            historyCount:
                this.firstNumber(

                    data.historyCount,

                    data.details
                        ?.historyCount,

                    0

                ),

            pointSignalAvailable:

                data.pointSignalAvailable ===
                    true ||

                data.details
                    ?.pointSignalAvailable ===
                    true,

            visualVerificationOnly:

                data.visualVerificationOnly ===
                    true ||

                data.details
                    ?.visualVerificationOnly ===
                    true,

            direction:

                data.direction ||

                data.details
                    ?.direction ||

                "--",

            details: {

                ...(data.details || {}),

                intensity,

                rainDetected,

                rainAmount,

                movementConfidence:
                    this.clamp(

                        this.firstNumber(

                            data.movementConfidence,

                            data.details
                                ?.movementConfidence,

                            source
                                .radarMovementConfidence

                        ),

                        0,

                        100

                    ),

                frameAgeMinutes,

                direction:

                    data.direction ||

                    data.details
                        ?.direction ||

                    "--"

            },

            error:
                data.error ||
                null

        };

    },

    /* =====================================================
       SATELLITE SOURCE PREPARATION
       ===================================================== */

    prepareSatelliteData(
        data = {},
        source = {}
    ) {

        const cloudCover =
            this.clamp(

                this.firstNumber(

                    data.cloudCover,

                    data.details
                        ?.cloudCover,

                    source.cloudCover

                ),

                0,

                100

            );

        const convectionScore =
            this.clamp(

                this.firstNumber(

                    data.convectionScore,

                    data.convectionIndex,

                    data.details
                        ?.convectionScore,

                    data.details
                        ?.convectionIndex,

                    source.convectionScore

                ),

                0,

                100

            );

        const stormCellScore =
            this.clamp(

                this.firstNumber(

                    data.stormCellScore,

                    data.stormCells,

                    data.details
                        ?.stormCellScore,

                    source.stormCellScore

                ),

                0,

                100

            );

        const available =

            data.available ===
                true ||

            data.ok ===
                true ||

            cloudCover > 0 ||

            convectionScore > 0 ||

            [
                "AVAILABLE",
                "ACTIVE",
                "CONNECTED",
                "SIMULATION",
                "CACHED"
            ]
            .includes(
                this.normalizeStatus(
                    data.status
                )
            );

        const timestamp =

            data.timestamp ||

            source.satelliteTimestamp ||

            new Date()
                .toISOString();

        const ageMinutes =
            this.firstNumber(

                data.ageMinutes,

                data.dataAgeMinutes,

                data.details
                    ?.dataAgeMinutes,

                this.calculateAgeMinutes(
                    timestamp
                )

            );

        return {

            available,

            status:
                data.status ||
                (
                    data.simulated
                        ? "SIMULATION"
                        : available
                            ? "ACTIVE"
                            : "UNAVAILABLE"
                ),

            official:
                data.official ===
                true,

            simulated:
                data.simulated ===
                    true ||

                String(
                    data.provider ||
                    ""
                )
                .toLowerCase()
                .includes(
                    "simulation"
                ),

            mode:
                data.mode ||
                (
                    data.simulated
                        ? "SIMULATION"
                        : "SATELLITE"
                ),

            cloudCover,

            convectionScore,

            cloudTemperature:
                this.safeNumber(

                    data.cloudTemperature ??

                    data.details
                        ?.cloudTemperature ??

                    source.cloudTemperature,

                    0

                ),

            stormCellScore,

            stormCells:
                this.safeNumber(

                    data.stormCells ??

                    data.details
                        ?.stormCells,

                    0

                ),

            rainProbability:
                this.clamp(

                    this.firstNumber(

                        data.rainProbability,

                        data.probability,

                        data.signalScore,

                        0

                    ),

                    0,

                    100

                ),

            signalScore:
                this.clamp(

                    this.firstNumber(

                        data.signalScore,

                        data.satelliteRisk,

                        data.score,

                        convectionScore

                    ),

                    0,

                    100

                ),

            confidence:
                this.clamp(

                    this.firstNumber(

                        data.confidence,

                        data.details
                            ?.confidence,

                        available
                            ? 70
                            : 0

                    ),

                    0,

                    100

                ),

            reliability:
                this.clamp(

                    this.firstNumber(

                        data.reliability,

                        data.trust,

                        this.config
                            .defaultReliability
                            .satellite

                    ),

                    0,

                    1

                ),

            ageMinutes,

            dataAgeMinutes:
                ageMinutes,

            timestamp,

            historyCount:
                this.firstNumber(

                    data.historyCount,

                    data.details
                        ?.historyCount,

                    0

                ),

            details: {

                ...(data.details || {}),

                cloudCover,

                convectionScore,

                cloudTemperature:
                    this.safeNumber(

                        data.cloudTemperature ??

                        data.details
                            ?.cloudTemperature ??

                        source.cloudTemperature,

                        0

                    ),

                stormCellScore,

                stormCells:
                    this.safeNumber(

                        data.stormCells ??

                        data.details
                            ?.stormCells,

                        0

                    )

            },

            error:
                data.error ||
                null

        };

    },

    /* =====================================================
       LIGHTNING SOURCE PREPARATION V31
       ===================================================== */

    prepareLightningData(
        data = {},
        source = {}
    ) {

        const strikes =
            Math.max(

                0,

                this.firstNumber(

                    data.strikes,

                    data.details
                        ?.strikes,

                    source.lightningStrikes,

                    0

                )

            );

        const activityScore =
            this.clamp(

                this.firstNumber(

                    data.activityScore,

                    data.details
                        ?.activityScore,

                    data.signalScore,

                    source
                        .lightningActivityScore,

                    0

                ),

                0,

                100

            );

        const nearestStrikeKm =
            this.firstNullableNumber(

                data.nearestStrikeKm,

                data.distanceKm,

                data.details
                    ?.nearestStrikeKm,

                data.details
                    ?.distanceKm,

                source
                    .lightningDistanceKm

            );

        const available =

            data.available ===
                true ||

            data.ok ===
                true ||

            strikes > 0 ||

            activityScore > 0 ||

            [
                "AVAILABLE",
                "ACTIVE",
                "CONNECTED",
                "SIMULATION",
                "CACHED"
            ]
            .includes(
                this.normalizeStatus(
                    data.status
                )
            );

        const timestamp =

            data.timestamp ||

            source.lightningTimestamp ||

            new Date()
                .toISOString();

        const dataAgeMinutes =
            this.firstNumber(

                data.dataAgeMinutes,

                data.ageMinutes,

                data.details
                    ?.dataAgeMinutes,

                this.calculateAgeMinutes(
                    timestamp
                )

            );

        return {

            available,

            status:
                data.status ||
                (
                    data.simulated
                        ? "SIMULATION"
                        : available
                            ? "ACTIVE"
                            : "UNAVAILABLE"
                ),

            official:
                data.official ===
                true,

            simulated:

                data.simulated ===
                    true ||

                this.normalizeStatus(
                    data.mode
                ) ===
                "SIMULATION" ||

                this.normalizeStatus(
                    data.status
                ) ===
                "SIMULATION",

            mode:
                data.mode ||
                (
                    data.simulated
                        ? "SIMULATION"
                        : "LIGHTNING"
                ),

            strikes,

            cloudToGround:
                Math.max(

                    0,

                    this.firstNumber(

                        data.cloudToGround,

                        data.details
                            ?.cloudToGround,

                        source
                            .lightningCloudToGround,

                        0

                    )

                ),

            intraCloud:
                Math.max(

                    0,

                    this.firstNumber(

                        data.intraCloud,

                        data.details
                            ?.intraCloud,

                        source
                            .lightningIntraCloud,

                        0

                    )

                ),

            nearestStrikeKm,

            distanceKm:
                nearestStrikeKm,

            strikeDensity:
                Math.max(

                    0,

                    this.firstNumber(

                        data.strikeDensity,

                        data.details
                            ?.strikeDensity,

                        source
                            .lightningStrikeDensity,

                        0

                    )

                ),

            activityScore,

            trend:

                data.trend ||

                data.details
                    ?.trend ||

                source.lightningTrend ||

                "STABLE",

            riskLevel:

                data.riskLevel ||

                data.details
                    ?.riskLevel ||

                source.lightningRiskLevel ||

                "UNKNOWN",

            warningLevel:

                data.warningLevel ||

                data.details
                    ?.warningLevel ||

                "UNKNOWN",

            rainProbability:
                this.clamp(

                    this.firstNumber(

                        data.rainProbability,

                        source
                            .lightningRainProbability,

                        0

                    ),

                    0,

                    100

                ),

            signalScore:
                this.clamp(

                    this.firstNumber(

                        data.signalScore,

                        data.activityScore,

                        data.details
                            ?.activityScore,

                        0

                    ),

                    0,

                    100

                ),

            confidence:
                this.clamp(

                    this.firstNumber(

                        data.confidence,

                        data.details
                            ?.confidence,

                        source.lightningConfidence,

                        available
                            ? 60
                            : 0

                    ),

                    0,

                    100

                ),

            reliability:
                this.clamp(

                    this.firstNumber(

                        data.reliability,

                        data.trust,

                        data.simulated
                            ? 0.30
                            : this.config
                                .defaultReliability
                                .lightning

                    ),

                    0,

                    1

                ),

            freshnessScore:
                this.clamp(

                    this.firstNumber(

                        data.freshnessScore,

                        data.details
                            ?.freshnessScore,

                        this.calculateLightningFreshnessScore(
                            dataAgeMinutes
                        )

                    ),

                    0,

                    100

                ),

            dataAgeMinutes,

            ageMinutes:
                dataAgeMinutes,

            timestamp,

            observationWindowMinutes:
                this.firstNumber(

                    data.observationWindowMinutes,

                    data.details
                        ?.observationWindowMinutes,

                    15

                ),

            detectionRadiusKm:
                this.firstNumber(

                    data.detectionRadiusKm,

                    data.details
                        ?.detectionRadiusKm,

                    this.config
                        .lightningIntelligence
                        .maximumDetectionRadiusKm

                ),

            historyCount:
                this.firstNumber(

                    data.historyCount,

                    data.details
                        ?.historyCount,

                    0

                ),

            details: {

                ...(data.details || {}),

                strikes,

                cloudToGround:
                    Math.max(

                        0,

                        this.firstNumber(

                            data.cloudToGround,

                            data.details
                                ?.cloudToGround,

                            source
                                .lightningCloudToGround,

                            0

                        )

                    ),

                intraCloud:
                    Math.max(

                        0,

                        this.firstNumber(

                            data.intraCloud,

                            data.details
                                ?.intraCloud,

                            source
                                .lightningIntraCloud,

                            0

                        )

                    ),

                nearestStrikeKm,

                distanceKm:
                    nearestStrikeKm,

                strikeDensity:
                    Math.max(

                        0,

                        this.firstNumber(

                            data.strikeDensity,

                            data.details
                                ?.strikeDensity,

                            source
                                .lightningStrikeDensity,

                            0

                        )

                    ),

                activityScore,

                trend:

                    data.trend ||

                    data.details
                        ?.trend ||

                    source.lightningTrend ||

                    "STABLE",

                riskLevel:

                    data.riskLevel ||

                    data.details
                        ?.riskLevel ||

                    source.lightningRiskLevel ||

                    "UNKNOWN",

                freshnessScore:
                    this.clamp(

                        this.firstNumber(

                            data.freshnessScore,

                            data.details
                                ?.freshnessScore,

                            this.calculateLightningFreshnessScore(
                                dataAgeMinutes
                            )

                        ),

                        0,

                        100

                    ),

                dataAgeMinutes,

                confidence:
                    this.clamp(

                        this.firstNumber(

                            data.confidence,

                            data.details
                                ?.confidence,

                            source.lightningConfidence,

                            available
                                ? 60
                                : 0

                        ),

                        0,

                        100

                    ),

                observationWindowMinutes:
                    this.firstNumber(

                        data.observationWindowMinutes,

                        data.details
                            ?.observationWindowMinutes,

                        15

                    ),

                detectionRadiusKm:
                    this.firstNumber(

                        data.detectionRadiusKm,

                        data.details
                            ?.detectionRadiusKm,

                        this.config
                            .lightningIntelligence
                            .maximumDetectionRadiusKm

                    ),

                simulated:

                    data.simulated ===
                        true ||

                    this.normalizeStatus(
                        data.mode
                    ) ===
                    "SIMULATION"

            },

            error:
                data.error ||
                null

        };

    },

    /* =====================================================
       OPEN-METEO SOURCE PREPARATION
       ===================================================== */

    prepareOpenMeteoData(
        data = {},
        source = {}
    ) {

        const explicitAvailability =
            data.available;

        const rainProbability =
            this.clamp(

                this.firstNumber(

                    data.rainProbability,

                    data.precipitation_probability,

                    data.probability,

                    source.rainProbability,

                    source.probability,

                    0

                ),

                0,

                100

            );

        const rainAmount =
            this.clamp(

                this.firstNumber(

                    data.rainAmount,

                    data.precipitation,

                    data.rain,

                    source.rainAmount,

                    source.rain,

                    0

                ),

                0,

                1000

            );

        const available =

            explicitAvailability ===
                true ||

            data.ok ===
                true ||

            (
                explicitAvailability !==
                    false &&
                [
                    "AVAILABLE",
                    "ACTIVE",
                    "CONNECTED",
                    "CACHED"
                ]
                .includes(
                    this.normalizeStatus(
                        data.status
                    )
                )
            );

        const timestamp =

            data.timestamp ||

            data.updatedAt ||

            source.weatherTimestamp ||

            new Date()
                .toISOString();

        const ageMinutes =
            this.firstNumber(

                data.ageMinutes,

                data.dataAgeMinutes,

                this.calculateAgeMinutes(
                    timestamp
                )

            );

        return {

            available,

            status:
                data.status ||
                (
                    available
                        ? "ACTIVE"
                        : "UNAVAILABLE"
                ),

            official:
                false,

            simulated:
                data.simulated ===
                true,

            mode:
                data.mode ||
                "FORECAST",

            rainProbability,

            rainAmount,

            humidity:
                this.clamp(

                    this.firstNumber(

                        data.humidity,

                        data.relativeHumidity,

                        data.details
                            ?.humidity,

                        source.humidity,

                        0

                    ),

                    0,

                    100

                ),

            cloudCover:
                this.clamp(

                    this.firstNumber(

                        data.cloudCover,

                        data.cloud_cover,

                        data.details
                            ?.cloudCover,

                        source.cloudCover,

                        0

                    ),

                    0,

                    100

                ),

            windSpeed:
                Math.max(

                    0,

                    this.firstNumber(

                        data.windSpeed,

                        data.wind_speed,

                        data.details
                            ?.windSpeed,

                        source.windSpeed,

                        0

                    )

                ),

            pressure:
                Math.max(

                    0,

                    this.firstNumber(

                        data.pressure,

                        data.pressureMsl,

                        data.details
                            ?.pressure,

                        source.pressure,

                        0

                    )

                ),

            signalScore:
                this.clamp(

                    this.firstNumber(

                        data.signalScore,

                        data.score,

                        rainProbability

                    ),

                    0,

                    100

                ),

            confidence:
                this.clamp(

                    this.firstNumber(

                        data.confidence,

                        data.details
                            ?.confidence,

                        available
                            ? 75
                            : 0

                    ),

                    0,

                    100

                ),

            reliability:
                this.clamp(

                    this.firstNumber(

                        data.reliability,

                        data.trust,

                        this.config
                            .defaultReliability
                            .openMeteo

                    ),

                    0,

                    1

                ),

            timestamp,

            ageMinutes,

            dataAgeMinutes:
                ageMinutes,

            historyCount:
                this.firstNumber(

                    data.historyCount,

                    data.details
                        ?.historyCount,

                    0

                ),

            details: {

                ...(data.details || {}),

                humidity:
                    this.clamp(

                        this.firstNumber(

                            data.humidity,

                            data.relativeHumidity,

                            data.details
                                ?.humidity,

                            source.humidity,

                            0

                        ),

                        0,

                        100

                    ),

                cloudCover:
                    this.clamp(

                        this.firstNumber(

                            data.cloudCover,

                            data.cloud_cover,

                            data.details
                                ?.cloudCover,

                            source.cloudCover,

                            0

                        ),

                        0,

                        100

                    ),

                windSpeed:
                    Math.max(

                        0,

                        this.firstNumber(

                            data.windSpeed,

                            data.wind_speed,

                            data.details
                                ?.windSpeed,

                            source.windSpeed,

                            0

                        )

                    ),

                pressure:
                    Math.max(

                        0,

                        this.firstNumber(

                            data.pressure,

                            data.pressureMsl,

                            data.details
                                ?.pressure,

                            source.pressure,

                            0

                        )

                    )

            },

            error:
                data.error ||
                null

        };

    },

    /* =====================================================
       LOCAL AI SOURCE PREPARATION
       ===================================================== */

    prepareLocalModelData(
        data = {},
        source = {}
    ) {

        const explicitAvailability =
            data.available;

        const finalRisk =
            this.clamp(

                this.firstNumber(

                    data.finalRisk,

                    data.details
                        ?.finalRisk,

                    source.finalRisk,

                    source.baseRisk,

                    0

                ),

                0,

                100

            );

        const weatherScore =
            this.clamp(

                this.firstNumber(

                    data.weatherScore,

                    data.details
                        ?.weatherScore,

                    source.weatherScore,

                    finalRisk

                ),

                0,

                100

            );

        const available =

            explicitAvailability ===
                true ||

            data.ok ===
                true ||

            (
                explicitAvailability !==
                    false &&
                (
                    weatherScore > 0 ||
                    finalRisk > 0
                )
            );

        const timestamp =

            data.timestamp ||

            source.aiTimestamp ||

            new Date()
                .toISOString();

        const ageMinutes =
            this.firstNumber(

                data.ageMinutes,

                data.dataAgeMinutes,

                this.calculateAgeMinutes(
                    timestamp
                )

            );

        return {

            available,

            status:
                data.status ||
                (
                    available
                        ? "ACTIVE"
                        : "UNAVAILABLE"
                ),

            official:
                false,

            simulated:
                data.simulated ===
                true,

            mode:
                data.mode ||
                "LOCAL_AI",

            weatherScore,

            floodIndex:
                this.clamp(

                    this.firstNumber(

                        data.floodIndex,

                        data.details
                            ?.floodIndex,

                        source.floodIndex,

                        0

                    ),

                    0,

                    100

                ),

            roadRisk:
                this.clamp(

                    this.firstNumber(

                        data.roadRisk,

                        data.details
                            ?.roadRisk,

                        source.roadRisk,

                        0

                    ),

                    0,

                    100

                ),

            stormRisk:
                this.clamp(

                    this.firstNumber(

                        data.stormRisk,

                        data.details
                            ?.stormRisk,

                        source.stormRisk,

                        0

                    ),

                    0,

                    100

                ),

            rainRisk:
                this.clamp(

                    this.firstNumber(

                        data.rainRisk,

                        data.details
                            ?.rainRisk,

                        source.rainRisk,

                        weatherScore

                    ),

                    0,

                    100

                ),

            finalRisk,

            confidence:
                this.clamp(

                    this.firstNumber(

                        data.confidence,

                        data.aiConfidence,

                        data.details
                            ?.confidence,

                        source.aiConfidence,

                        available
                            ? 65
                            : 0

                    ),

                    0,

                    100

                ),

            signalScore:
                this.clamp(

                    this.firstNumber(

                        data.signalScore,

                        data.score,

                        finalRisk,

                        weatherScore

                    ),

                    0,

                    100

                ),

            rainProbability:
                this.clamp(

                    this.firstNumber(

                        data.rainProbability,

                        data.rainRisk,

                        weatherScore,

                        0

                    ),

                    0,

                    100

                ),

            reliability:
                this.clamp(

                    this.firstNumber(

                        data.reliability,

                        data.trust,

                        this.config
                            .defaultReliability
                            .localModel

                    ),

                    0,

                    1

                ),

            timestamp,

            ageMinutes,

            dataAgeMinutes:
                ageMinutes,

            historyCount:
                this.firstNumber(

                    data.historyCount,

                    data.details
                        ?.historyCount,

                    0

                ),

            explanation:
                Array.isArray(
                    data.explanation
                )
                    ? [
                        ...data.explanation
                    ]
                    : [],

            details: {

                ...(data.details || {}),

                weatherScore,

                floodIndex:
                    this.clamp(

                        this.firstNumber(

                            data.floodIndex,

                            data.details
                                ?.floodIndex,

                            source.floodIndex,

                            0

                        ),

                        0,

                        100

                    ),

                roadRisk:
                    this.clamp(

                        this.firstNumber(

                            data.roadRisk,

                            data.details
                                ?.roadRisk,

                            source.roadRisk,

                            0

                        ),

                        0,

                        100

                    ),

                stormRisk:
                    this.clamp(

                        this.firstNumber(

                            data.stormRisk,

                            data.details
                                ?.stormRisk,

                            source.stormRisk,

                            0

                        ),

                        0,

                        100

                    ),

                rainRisk:
                    this.clamp(

                        this.firstNumber(

                            data.rainRisk,

                            data.details
                                ?.rainRisk,

                            source.rainRisk,

                            weatherScore

                        ),

                        0,

                        100

                    ),

                finalRisk,

                confidence:
                    this.clamp(

                        this.firstNumber(

                            data.confidence,

                            data.aiConfidence,

                            data.details
                                ?.confidence,

                            source.aiConfidence,

                            available
                                ? 65
                                : 0

                        ),

                        0,

                        100

                    )

            },

            error:
                data.error ||
                null

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

        const dynamicContext =
            this.buildDynamicVerificationContext(
                sourceEvidence
            );

        const availableSources =
            dynamicContext
                .availableSources;

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

        const rainAmountConsensus =
            this.calculateRainAmountConsensus(
                sourceEvidence
            );

        const conflict =
            this.detectConflict(

                sourceEvidence,

                agreement,

                dynamicContext

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

        const lightningThreat =
            this.safeNumber(

                sourceEvidence
                    ?.lightning
                    ?.details
                    ?.stormThreat,

                0

            );

        const lightningThreatLevel =

            sourceEvidence
                ?.lightning
                ?.details
                ?.stormThreatLevel ||

            "NONE";

        const decisionGate =
            this.buildDecisionGate({

                finalRisk,

                weightedConfidence,

                verificationStatus,

                activeSourceCount,

                conflict,

                rainConsensus,

                rainAmountConsensus,

                averageDataQuality:
                    dynamicContext
                        .averageDataQuality,

                lightningThreat,

                lightningThreatLevel,

                sourceEvidence,

                dynamicContext

            });

        return {

            city:
                city.name,

            cityId:
                city.cityId,

            region:
                city.region,

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

            rainAmountConsensus:
                Number(
                    this.safeNumber(
                        rainAmountConsensus,
                        0
                    )
                    .toFixed(
                        2
                    )
                ),

            verifiedRisk:
                Math.round(
                    finalRisk
                ),

            lightningThreat:
                Math.round(
                    lightningThreat
                ),

            lightningThreatLevel,

            averageDataQuality:
                Math.round(

                    dynamicContext
                        .averageDataQuality

                ),

            dynamicWeights:
                dynamicContext
                    .weights,

            sourceContributions:
                dynamicContext
                    .contributions,

            conflict,

            status:
                verificationStatus,

            decisionGate,

            sourceCoverage:
                this.calculateSourceCoverage(
                    activeSourceCount
                ),

            sourceSpread:
                this.calculateSourceSpread(
                    sourceEvidence
                ),

            timestamp:
                new Date()
                    .toISOString()

        };

    },

    /* =====================================================
       OFFICIAL SOURCE EVALUATION
       ===================================================== */

    evaluateOfficialSource(
        city
    ) {

        const data =
            city.officialData ||
            {};

        const available =
            data.available ===
            true;

        let signalScore =
            0;

        if (
            available
        ) {

            const probabilityScore =
                this.clamp(
                    data.rainProbability,
                    0,
                    100
                );

            const amountScore =
                this.rainAmountToScore(
                    data.rainAmount
                );

            const warningScore =
                this.warningLevelToScore(
                    data.warningLevel
                );

            signalScore =

                probabilityScore *
                    0.55 +

                amountScore *
                    0.30 +

                warningScore *
                    0.15;

            if (
                data.simulated ===
                true
            ) {

                signalScore *=
                    0.90;

            }

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
                data.reliability ??
                this.config
                    .defaultReliability
                    .official,

            signalScore,

            rainProbability:
                data.rainProbability,

            rainAmount:
                data.rainAmount,

            confidence:
                data.confidence,

            timestamp:
                data.timestamp,

            ageMinutes:
                data.dataAgeMinutes,

            simulated:
                data.simulated ===
                true,

            error:
                data.error,

            status:
                data.status,

            details: {

                ...(data.details || {}),

                warningLevel:
                    data.warningLevel,

                issuedAt:
                    data.issuedAt,

                mode:
                    data.mode,

                official:
                    data.official ===
                    true

            }

        });

    },

    /* =====================================================
       RADAR SOURCE EVALUATION
       ===================================================== */

    evaluateRadarSource(
        city
    ) {

        const data =
            city.radarData ||
            {};

        const available =
            data.available ===
            true;

        let probability =
            0;

        if (
            available
        ) {

            const frameFreshness =
                this.calculateRadarFreshnessScore(
                    data.frameAgeMinutes
                );

            const intensityScore =
                this.clamp(

                    data.intensity *
                    1.8,

                    0,

                    100

                );

            const movementScore =
                this.clamp(

                    data.movementConfidence,

                    0,

                    100

                );

            const detectionBonus =
                data.rainDetected ===
                true
                    ? 15
                    : 0;

            probability =
                this.clamp(

                    intensityScore *
                        0.50 +

                    movementScore *
                        0.20 +

                    frameFreshness *
                        0.20 +

                    detectionBonus,

                    0,

                    100

                );

            if (
                data.visualVerificationOnly ===
                true &&
                data.pointSignalAvailable !==
                true
            ) {

                probability *=
                    0.50;

            }

        }

        const confidence =
            available
                ? this.clamp(

                    data.confidence *
                        0.60 +

                    this.calculateRadarFreshnessScore(
                        data.frameAgeMinutes
                    ) *
                        0.25 +

                    (
                        data.pointSignalAvailable
                            ? 100
                            : 45
                    ) *
                        0.15,

                    0,

                    100

                )
                : 0;

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
                data.reliability ??
                this.config
                    .defaultReliability
                    .radar,

            signalScore:
                probability,

            rainProbability:
                probability,

            rainAmount:
                data.rainAmount ||
                data.intensity,

            confidence,

            timestamp:
                data.timestamp,

            ageMinutes:
                data.frameAgeMinutes,

            simulated:
                data.simulated ===
                true,

            error:
                data.error,

            status:
                data.status,

            details: {

                ...(data.details || {}),

                rainDetected:
                    data.rainDetected,

                intensity:
                    data.intensity,

                movementConfidence:
                    data.movementConfidence,

                frameAgeMinutes:
                    data.frameAgeMinutes,

                pointSignalAvailable:
                    data.pointSignalAvailable,

                visualVerificationOnly:
                    data.visualVerificationOnly,

                direction:
                    data.direction,

                freshnessScore:
                    this.calculateRadarFreshnessScore(
                        data.frameAgeMinutes
                    )

            }

        });

    },

    calculateRadarFreshnessScore(
        ageMinutes
    ) {

        const age =
            this.safeNumber(
                ageMinutes,
                999
            );

        const limits =
            this.config
                .freshness
                .radar;

        if (
            age <=
            limits.freshMinutes
        ) {

            return 100;

        }

        if (
            age <=
            limits.acceptableMinutes
        ) {

            return 80;

        }

        if (
            age <=
            limits.staleMinutes
        ) {

            return 45;

        }

        return 10;

    },

    /* =====================================================
       SATELLITE SOURCE EVALUATION
       ===================================================== */

    evaluateSatelliteSource(
        city
    ) {

        const data =
            city.satelliteData ||
            {};

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

            const cloudScore =
                this.clamp(
                    data.cloudCover,
                    0,
                    100
                );

            const convectionScore =
                this.clamp(
                    data.convectionScore,
                    0,
                    100
                );

            const stormCellScore =
                this.normalizeStormCellScore(
                    data.stormCellScore,
                    data.stormCells
                );

            probability =
                this.clamp(

                    cloudScore *
                        0.30 +

                    convectionScore *
                        0.35 +

                    stormCellScore *
                        0.20 +

                    temperatureScore *
                        0.15,

                    0,

                    100

                );

            if (
                data.simulated ===
                true
            ) {

                probability *=
                    0.80;

            }

        }

        const confidence =
            available
                ? this.clamp(

                    data.confidence *
                        0.60 +

                    this.calculateGenericFreshnessScore(
                        "satellite",
                        data.dataAgeMinutes
                    ) *
                        0.25 +

                    (
                        data.simulated
                            ? 40
                            : 90
                    ) *
                        0.15,

                    0,

                    100

                )
                : 0;

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
                data.simulated
                    ? Math.min(
                        data.reliability,
                        0.50
                    )
                    : data.reliability ??
                        this.config
                            .defaultReliability
                            .satellite,

            signalScore:
                probability,

            rainProbability:
                data.rainProbability > 0
                    ? data.rainProbability
                    : probability,

            rainAmount:
                0,

            confidence,

            timestamp:
                data.timestamp,

            ageMinutes:
                data.dataAgeMinutes,

            simulated:
                data.simulated ===
                true,

            error:
                data.error,

            status:
                data.status,

            details: {

                ...(data.details || {}),

                cloudCover:
                    data.cloudCover,

                convectionScore:
                    data.convectionScore,

                cloudTemperature:
                    data.cloudTemperature,

                stormCellScore:
                    data.stormCellScore,

                stormCells:
                    data.stormCells,

                freshnessScore:
                    this.calculateGenericFreshnessScore(
                        "satellite",
                        data.dataAgeMinutes
                    ),

                simulated:
                    data.simulated ===
                    true,

                mode:
                    data.mode

            }

        });

    },

    normalizeStormCellScore(
        stormCellScore,
        stormCells
    ) {

        const direct =
            this.safeNumber(
                stormCellScore,
                0
            );

        if (
            direct > 0
        ) {

            return this.clamp(
                direct,
                0,
                100
            );

        }

        const count =
            this.safeNumber(
                stormCells,
                0
            );

        if (
            count >= 5
        ) {

            return 100;

        }

        if (
            count >= 3
        ) {

            return 75;

        }

        if (
            count >= 1
        ) {

            return 45;

        }

        return 0;

    },

    calculateGenericFreshnessScore(
        sourceKey,
        ageMinutes
    ) {

        const limits =
            this.config
                .freshness[
                    sourceKey
                ] ||
            this.config
                .freshness
                .official;

        const age =
            this.safeNumber(
                ageMinutes,
                999
            );

        if (
            age <=
            limits.freshMinutes
        ) {

            return 100;

        }

        if (
            age <=
            limits.acceptableMinutes
        ) {

            return 80;

        }

        if (
            age <=
            limits.staleMinutes
        ) {

            return 45;

        }

        return 10;

    },

    /* =====================================================
       SOURCE RESULT FACTORY
       ===================================================== */

    createSourceResult({
        key,
        name,
        available,
        reliability,
        signalScore,
        rainProbability,
        rainAmount,
        confidence = 0,
        timestamp = null,
        ageMinutes = 0,
        simulated = false,
        error = null,
        status,
        details
    }) {

        const normalizedAvailable =
            Boolean(
                available
            );

        const normalizedReliability =
            normalizedAvailable
                ? this.clamp(
                    reliability,
                    0,
                    1
                )
                : 0;

        const normalizedSignal =
            normalizedAvailable
                ? Math.round(

                    this.clamp(
                        signalScore,
                        0,
                        100
                    )

                )
                : 0;

        const normalizedProbability =
            normalizedAvailable
                ? Math.round(

                    this.clamp(
                        rainProbability,
                        0,
                        100
                    )

                )
                : 0;

        const normalizedConfidence =
            normalizedAvailable
                ? Math.round(

                    this.clamp(
                        confidence,
                        0,
                        100
                    )

                )
                : 0;

        const normalizedTimestamp =
            timestamp ||
            new Date()
                .toISOString();

        const normalizedAge =
            this.safeNumber(
                ageMinutes,
                this.calculateAgeMinutes(
                    normalizedTimestamp
                )
            );

        return {

            key,

            sourceKey:
                key,

            name,

            available:
                normalizedAvailable,

            reliability:
                normalizedReliability,

            trust:
                normalizedReliability,

            signalScore:
                normalizedSignal,

            rainProbability:
                normalizedProbability,

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

            confidence:
                normalizedConfidence,

            timestamp:
                normalizedTimestamp,

            ageMinutes:
                normalizedAge,

            dataAgeMinutes:
                normalizedAge,

            simulated:
                simulated ===
                true,

            official:
                key ===
                    "official",

            status:
                status ||
                (
                    normalizedAvailable
                        ? simulated
                            ? "SIMULATION"
                            : "ACTIVE"
                        : "UNAVAILABLE"
                ),

            details: {

                ...(details || {}),

                confidence:
                    normalizedConfidence,

                dataAgeMinutes:
                    normalizedAge,

                simulated:
                    simulated ===
                    true

            },

            error:
                error ||
                null

        };

    },
       /* =====================================================
       LIGHTNING SOURCE EVALUATION V31
       ===================================================== */

    evaluateLightningSource(
        city
    ) {

        const data =
            city.lightningData ||
            {};

        const available =
            data.available ===
            true;

        if (
            !available
        ) {

            return this.createSourceResult({

                key:
                    "lightning",

                name:
                    this.getSourceLabel(
                        "lightning",
                        "Lightning Detection"
                    ),

                available:
                    false,

                reliability:
                    0,

                signalScore:
                    0,

                rainProbability:
                    0,

                rainAmount:
                    0,

                confidence:
                    0,

                timestamp:
                    data.timestamp,

                ageMinutes:
                    data.dataAgeMinutes,

                simulated:
                    data.simulated ===
                    true,

                error:
                    data.error ||
                    "LIGHTNING_UNAVAILABLE",

                status:
                    data.status ||
                    "UNAVAILABLE",

                details: {

                    strikes:
                        0,

                    cloudToGround:
                        0,

                    intraCloud:
                        0,

                    nearestStrikeKm:
                        null,

                    distanceKm:
                        null,

                    strikeDensity:
                        0,

                    activityScore:
                        0,

                    trend:
                        "UNKNOWN",

                    trendScore:
                        0,

                    riskLevel:
                        "UNKNOWN",

                    riskScore:
                        0,

                    stormThreat:
                        0,

                    stormThreatLevel:
                        "NONE",

                    freshnessScore:
                        0,

                    dataAgeMinutes:
                        this.safeNumber(
                            data.dataAgeMinutes,
                            0
                        ),

                    simulated:
                        data.simulated ===
                        true

                }

            });

        }

        const intelligence =
            this.calculateLightningIntelligence(
                data
            );

        const reliability =
            data.simulated ===
            true
                ? Math.min(

                    this.safeNumber(
                        data.reliability,
                        0.30
                    ),

                    0.35

                )
                : this.clamp(

                    this.safeNumber(

                        data.reliability,

                        this.config
                            .defaultReliability
                            .lightning

                    ),

                    0,

                    1

                );

        return this.createSourceResult({

            key:
                "lightning",

            name:
                this.getSourceLabel(
                    "lightning",
                    "Lightning Detection"
                ),

            available:
                true,

            reliability,

            signalScore:
                intelligence.signalScore,

            rainProbability:
                intelligence.rainProbability,

            rainAmount:
                0,

            confidence:
                intelligence.confidence,

            timestamp:
                data.timestamp,

            ageMinutes:
                intelligence.dataAgeMinutes,

            simulated:
                data.simulated ===
                true,

            error:
                data.error ||
                null,

            status:
                data.status ||
                (
                    data.simulated
                        ? "SIMULATION"
                        : "ACTIVE"
                ),

            details: {

                strikes:
                    intelligence.strikes,

                cloudToGround:
                    intelligence.cloudToGround,

                intraCloud:
                    intelligence.intraCloud,

                nearestStrikeKm:
                    intelligence.nearestStrikeKm,

                distanceKm:
                    intelligence.nearestStrikeKm,

                strikeDensity:
                    intelligence.strikeDensity,

                activityScore:
                    intelligence.activityScore,

                trend:
                    intelligence.trend,

                trendScore:
                    intelligence.trendScore,

                strikeScore:
                    intelligence.strikeScore,

                densityScore:
                    intelligence.densityScore,

                distanceScore:
                    intelligence.distanceScore,

                riskLevel:
                    intelligence.riskLevel,

                riskScore:
                    intelligence.riskScore,

                stormThreat:
                    intelligence.stormThreat,

                stormThreatLevel:
                    intelligence.stormThreatLevel,

                freshnessScore:
                    intelligence.freshnessScore,

                dataAgeMinutes:
                    intelligence.dataAgeMinutes,

                confidence:
                    intelligence.confidence,

                observationWindowMinutes:
                    data.observationWindowMinutes,

                detectionRadiusKm:
                    data.detectionRadiusKm,

                simulated:
                    data.simulated ===
                    true,

                mode:
                    data.mode,

                warningLevel:
                    data.warningLevel

            }

        });

    },

    /* =====================================================
       LIGHTNING INTELLIGENCE ENGINE
       ===================================================== */

    calculateLightningIntelligence(
        data = {}
    ) {

        const settings =
            this.config
                .lightningIntelligence;

        const strikes =
            Math.max(

                0,

                this.safeNumber(
                    data.strikes,
                    0
                )

            );

        const cloudToGround =
            this.clamp(

                this.safeNumber(
                    data.cloudToGround,
                    0
                ),

                0,

                strikes

            );

        const intraCloud =
            Math.max(

                0,

                this.safeNumber(

                    data.intraCloud,

                    strikes -
                    cloudToGround

                )

            );

        const nearestStrikeKm =
            this.firstNullableNumber(

                data.nearestStrikeKm,

                data.distanceKm

            );

        const strikeDensity =
            Math.max(

                0,

                this.safeNumber(
                    data.strikeDensity,
                    0
                )

            );

        const activityScore =
            this.clamp(

                this.safeNumber(

                    data.activityScore,

                    data.signalScore

                ),

                0,

                100

            );

        const trend =
            String(
                data.trend ||
                "UNKNOWN"
            )
                .trim()
                .toUpperCase();

        const trendScore =
            this.getLightningTrendScore(
                trend
            );

        const strikeScore =
            this.getLightningStrikeScore(
                strikes
            );

        const densityScore =
            this.getLightningDensityScore(
                strikeDensity
            );

        const distanceScore =
            this.getLightningDistanceScore(
                nearestStrikeKm
            );

        const freshnessScore =
            this.clamp(

                this.safeNumber(

                    data.freshnessScore,

                    this.calculateLightningFreshnessScore(
                        data.dataAgeMinutes
                    )

                ),

                0,

                100

            );

        const cloudToGroundRatio =
            strikes > 0
                ? this.clamp(

                    cloudToGround /
                    strikes *
                    100,

                    0,

                    100

                )
                : 0;

        const riskScore =
            this.clamp(

                strikeScore *
                    0.22 +

                densityScore *
                    0.18 +

                distanceScore *
                    0.22 +

                activityScore *
                    0.20 +

                trendScore *
                    0.10 +

                cloudToGroundRatio *
                    0.08,

                0,

                100

            );

        const riskLevel =
            this.getLightningRiskLevelV31(
                riskScore
            );

        let stormThreat =
            this.clamp(

                riskScore *
                    0.55 +

                activityScore *
                    0.20 +

                trendScore *
                    0.15 +

                freshnessScore *
                    0.10,

                0,

                100

            );

        if (
            nearestStrikeKm !==
                null &&
            nearestStrikeKm <=
                settings.criticalRadiusKm &&
            activityScore >= 60
        ) {

            stormThreat =
                Math.max(
                    stormThreat,
                    80
                );

        }

        if (
            trend ===
            "RAPIDLY_INCREASING"
        ) {

            stormThreat =
                Math.min(
                    100,
                    stormThreat + 10
                );

        }

        if (
            data.simulated ===
            true
        ) {

            stormThreat *=
                0.70;

        }

        const stormThreatLevel =
            this.getStormThreatLevel(
                stormThreat
            );

        const providedConfidence =
            this.safeNumber(
                data.confidence,
                0
            );

        let confidence =

            providedConfidence *
                0.45 +

            freshnessScore *
                0.20 +

            activityScore *
                0.15 +

            distanceScore *
                0.10 +

            densityScore *
                0.10;

        if (
            data.simulated ===
            true
        ) {

            confidence =
                Math.min(
                    confidence,
                    65
                );

        }

        confidence =
            this.clamp(
                confidence,
                0,
                100
            );

        let rainProbability =
            this.safeNumber(
                data.rainProbability,
                0
            );

        if (
            rainProbability <= 0
        ) {

            rainProbability =
                this.clamp(

                    activityScore *
                        0.30 +

                    riskScore *
                        0.30 +

                    densityScore *
                        0.15 +

                    distanceScore *
                        0.15 +

                    trendScore *
                        0.10,

                    0,

                    100

                );

        }

        const signalScore =
            this.clamp(

                riskScore *
                    0.45 +

                stormThreat *
                    0.30 +

                confidence *
                    0.15 +

                freshnessScore *
                    0.10,

                0,

                100

            );

        return {

            strikes:
                Math.round(
                    strikes
                ),

            cloudToGround:
                Math.round(
                    cloudToGround
                ),

            intraCloud:
                Math.round(
                    intraCloud
                ),

            nearestStrikeKm,

            strikeDensity:
                Number(
                    strikeDensity
                        .toFixed(
                            2
                        )
                ),

            activityScore:
                Math.round(
                    activityScore
                ),

            trend,

            trendScore:
                Math.round(
                    trendScore
                ),

            strikeScore:
                Math.round(
                    strikeScore
                ),

            densityScore:
                Math.round(
                    densityScore
                ),

            distanceScore:
                Math.round(
                    distanceScore
                ),

            riskScore:
                Math.round(
                    riskScore
                ),

            riskLevel,

            stormThreat:
                Math.round(
                    stormThreat
                ),

            stormThreatLevel,

            freshnessScore:
                Math.round(
                    freshnessScore
                ),

            dataAgeMinutes:
                this.safeNumber(
                    data.dataAgeMinutes,
                    0
                ),

            confidence:
                Math.round(
                    confidence
                ),

            rainProbability:
                Math.round(
                    rainProbability
                ),

            signalScore:
                Math.round(
                    signalScore
                )

        };

    },

    getLightningStrikeScore(
        strikes
    ) {

        const thresholds =
            this.config
                .lightningIntelligence
                .strikeThresholds;

        const value =
            this.safeNumber(
                strikes,
                0
            );

        if (
            value >=
            thresholds.extreme
        ) {

            return 100;

        }

        if (
            value >=
            thresholds.high
        ) {

            return 80;

        }

        if (
            value >=
            thresholds.moderate
        ) {

            return 55;

        }

        if (
            value >=
            thresholds.low
        ) {

            return 25;

        }

        return 0;

    },

    getLightningDensityScore(
        density
    ) {

        const thresholds =
            this.config
                .lightningIntelligence
                .densityThresholds;

        const value =
            this.safeNumber(
                density,
                0
            );

        if (
            value >=
            thresholds.extreme
        ) {

            return 100;

        }

        if (
            value >=
            thresholds.high
        ) {

            return 80;

        }

        if (
            value >=
            thresholds.moderate
        ) {

            return 55;

        }

        if (
            value >=
            thresholds.low
        ) {

            return 25;

        }

        return 0;

    },

    getLightningDistanceScore(
        distanceKm
    ) {

        if (
            distanceKm ===
                null ||
            distanceKm ===
                undefined
        ) {

            return 0;

        }

        const settings =
            this.config
                .lightningIntelligence;

        const distance =
            this.safeNumber(
                distanceKm,
                999
            );

        if (
            distance <=
            settings.criticalRadiusKm
        ) {

            return 100;

        }

        if (
            distance <=
            settings.warningRadiusKm
        ) {

            return 80;

        }

        if (
            distance <=
            settings.watchRadiusKm
        ) {

            return 55;

        }

        if (
            distance <=
            settings.maximumDetectionRadiusKm
        ) {

            return 25;

        }

        return 0;

    },

    getLightningTrendScore(
        trend
    ) {

        const value =
            String(
                trend ||
                "UNKNOWN"
            )
                .trim()
                .toUpperCase();

        return (

            this.config
                .lightningIntelligence
                .trendScores[
                    value
                ] ??

            20

        );

    },

    calculateLightningFreshnessScore(
        ageMinutes
    ) {

        const age =
            this.safeNumber(
                ageMinutes,
                999
            );

        const limits =
            this.config
                .freshness
                .lightning;

        if (
            age <=
            limits.freshMinutes
        ) {

            return 100;

        }

        if (
            age <=
            limits.acceptableMinutes
        ) {

            return 75;

        }

        if (
            age <=
            limits.staleMinutes
        ) {

            return 40;

        }

        return 10;

    },

    getLightningRiskLevelV31(
        score
    ) {

        const value =
            this.clamp(
                score,
                0,
                100
            );

        if (
            value >= 80
        ) {

            return "EXTREME";

        }

        if (
            value >= 60
        ) {

            return "HIGH";

        }

        if (
            value >= 35
        ) {

            return "MODERATE";

        }

        if (
            value >= 15
        ) {

            return "LOW";

        }

        return "NORMAL";

    },

    getStormThreatLevel(
        score
    ) {

        const value =
            this.clamp(
                score,
                0,
                100
            );

        if (
            value >=
            this.config
                .lightningIntelligence
                .severeStormThreatThreshold
        ) {

            return "SEVERE";

        }

        if (
            value >=
            this.config
                .lightningIntelligence
                .stormThreatThreshold
        ) {

            return "HIGH";

        }

        if (
            value >= 40
        ) {

            return "MODERATE";

        }

        if (
            value >= 15
        ) {

            return "LOW";

        }

        return "NONE";

    },

    /* =====================================================
       OPEN-METEO SOURCE EVALUATION
       ===================================================== */

    evaluateOpenMeteoSource(
        city
    ) {

        const data =
            city.openMeteoData ||
            {};

        const available =
            data.available ===
            true;

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

        const confidence =
            available
                ? this.clamp(

                    data.confidence *
                        0.60 +

                    this.calculateGenericFreshnessScore(
                        "openMeteo",
                        data.dataAgeMinutes
                    ) *
                        0.25 +

                    data.reliability *
                        100 *
                        0.15,

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
                data.reliability ??
                this.config
                    .defaultReliability
                    .openMeteo,

            signalScore,

            rainProbability:
                data.rainProbability,

            rainAmount:
                data.rainAmount,

            confidence,

            timestamp:
                data.timestamp,

            ageMinutes:
                data.dataAgeMinutes,

            simulated:
                data.simulated ===
                true,

            error:
                data.error,

            status:
                data.status,

            details: {

                ...(data.details || {}),

                humidity:
                    data.humidity,

                cloudCover:
                    data.cloudCover,

                windSpeed:
                    data.windSpeed,

                pressure:
                    data.pressure,

                freshnessScore:
                    this.calculateGenericFreshnessScore(
                        "openMeteo",
                        data.dataAgeMinutes
                    ),

                mode:
                    data.mode

            }

        });

    },

    /* =====================================================
       LOCAL AI SOURCE EVALUATION
       ===================================================== */

    evaluateLocalModel(
        city
    ) {

        const data =
            city.localModelData ||
            {};

        const available =
            data.available ===
            true;

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
                : 0.70;

        let signalScore =
            available
                ? this.clamp(

                    (
                        data.weatherScore *
                            0.30 +

                        data.rainRisk *
                            0.20 +

                        data.stormRisk *
                            0.20 +

                        data.floodIndex *
                            0.15 +

                        data.roadRisk *
                            0.05 +

                        data.finalRisk *
                            0.10
                    ) *
                    confidenceFactor,

                    0,

                    100

                )
                : 0;

        if (
            data.simulated ===
            true
        ) {

            signalScore *=
                0.70;

        }

        const confidence =
            available
                ? this.clamp(

                    modelConfidence *
                        0.70 +

                    this.calculateGenericFreshnessScore(
                        "localModel",
                        data.dataAgeMinutes
                    ) *
                        0.20 +

                    data.reliability *
                        100 *
                        0.10,

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
                data.reliability ??
                this.config
                    .defaultReliability
                    .localModel,

            signalScore,

            rainProbability:
                data.rainRisk > 0
                    ? data.rainRisk
                    : data.weatherScore,

            rainAmount:
                0,

            confidence,

            timestamp:
                data.timestamp,

            ageMinutes:
                data.dataAgeMinutes,

            simulated:
                data.simulated ===
                true,

            error:
                data.error,

            status:
                data.status,

            details: {

                ...(data.details || {}),

                weatherScore:
                    data.weatherScore,

                rainRisk:
                    data.rainRisk,

                stormRisk:
                    data.stormRisk,

                floodIndex:
                    data.floodIndex,

                roadRisk:
                    data.roadRisk,

                finalRisk:
                    data.finalRisk,

                confidence:
                    data.confidence,

                explanation:
                    data.explanation,

                freshnessScore:
                    this.calculateGenericFreshnessScore(
                        "localModel",
                        data.dataAgeMinutes
                    ),

                mode:
                    data.mode

            }

        });

    },
       /* =====================================================
       DATA QUALITY INDEX V31
       ===================================================== */

    calculateSourceDataQuality(
        source = {}
    ) {

        if (
            !source ||
            typeof source !==
                "object" ||
            source.available !==
                true
        ) {

            return {

                score:
                    0,

                level:
                    "UNUSABLE",

                freshness:
                    0,

                completeness:
                    0,

                reliability:
                    0,

                spatialRelevance:
                    0,

                temporalContinuity:
                    0,

                technicalHealth:
                    0

            };

        }

        const freshness =
            this.calculateFreshnessFactor(
                source
            );

        const completeness =
            this.calculateCompletenessFactor(
                source
            );

        const reliability =
            this.calculateReliabilityFactor(
                source
            );

        const spatialRelevance =
            this.calculateSpatialRelevanceFactor(
                source
            );

        const temporalContinuity =
            this.calculateTemporalContinuityFactor(
                source
            );

        const technicalHealth =
            this.calculateTechnicalHealthFactor(
                source
            );

        const weights =
            this.config
                .dataQuality
                .weights;

        let score =

            freshness *
                weights.freshness +

            completeness *
                weights.completeness +

            reliability *
                weights.reliability +

            spatialRelevance *
                weights.spatialRelevance +

            temporalContinuity *
                weights.temporalContinuity +

            technicalHealth *
                weights.technicalHealth;

        if (
            source.simulated ===
            true
        ) {

            score *=
                0.75;

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

            level:
                this.getDataQualityLevel(
                    score
                ),

            freshness:
                Math.round(
                    freshness
                ),

            completeness:
                Math.round(
                    completeness
                ),

            reliability:
                Math.round(
                    reliability
                ),

            spatialRelevance:
                Math.round(
                    spatialRelevance
                ),

            temporalContinuity:
                Math.round(
                    temporalContinuity
                ),

            technicalHealth:
                Math.round(
                    technicalHealth
                )

        };

    },

    /* =====================================================
       FRESHNESS FACTOR
       ===================================================== */

    calculateFreshnessFactor(
        source = {}
    ) {

        const sourceKey =
            this.detectSourceKey(
                source
            ) ||
            "official";

        const ageMinutes =
            this.firstNumber(

                source.dataAgeMinutes,

                source.ageMinutes,

                source.details
                    ?.dataAgeMinutes,

                this.calculateAgeMinutes(
                    source.timestamp
                )

            );

        return this.calculateGenericFreshnessScore(

            sourceKey,

            ageMinutes

        );

    },

    /* =====================================================
       COMPLETENESS FACTOR
       ===================================================== */

    calculateCompletenessFactor(
        source = {}
    ) {

        const commonFields = [

            source.signalScore,

            source.rainProbability,

            source.reliability,

            source.confidence,

            source.timestamp,

            source.status,

            source.details

        ];

        const sourceKey =
            this.detectSourceKey(
                source
            );

        const specificFields =
            [];

        if (
            sourceKey ===
            "official"
        ) {

            specificFields.push(

                source.rainAmount,

                source.details
                    ?.warningLevel,

                source.details
                    ?.issuedAt

            );

        } else if (
            sourceKey ===
            "radar"
        ) {

            specificFields.push(

                source.details
                    ?.intensity,

                source.details
                    ?.rainDetected,

                source.details
                    ?.frameAgeMinutes

            );

        } else if (
            sourceKey ===
            "satellite"
        ) {

            specificFields.push(

                source.details
                    ?.cloudCover,

                source.details
                    ?.convectionScore,

                source.details
                    ?.cloudTemperature,

                source.details
                    ?.stormCellScore

            );

        } else if (
            sourceKey ===
            "lightning"
        ) {

            specificFields.push(

                source.details
                    ?.strikes,

                source.details
                    ?.strikeDensity,

                source.details
                    ?.activityScore,

                source.details
                    ?.trend,

                source.details
                    ?.stormThreat

            );

        } else if (
            sourceKey ===
            "openMeteo"
        ) {

            specificFields.push(

                source.details
                    ?.humidity,

                source.details
                    ?.cloudCover,

                source.details
                    ?.windSpeed,

                source.details
                    ?.pressure

            );

        } else if (
            sourceKey ===
            "localModel"
        ) {

            specificFields.push(

                source.details
                    ?.weatherScore,

                source.details
                    ?.rainRisk,

                source.details
                    ?.stormRisk,

                source.details
                    ?.finalRisk

            );

        }

        const fields = [

            ...commonFields,

            ...specificFields

        ];

        const validCount =
            fields.filter(
                value => {

                    if (
                        value === null ||
                        value === undefined ||
                        value === ""
                    ) {

                        return false;

                    }

                    if (
                        typeof value ===
                            "number"
                    ) {

                        return Number.isFinite(
                            value
                        );

                    }

                    return true;

                }
            )
            .length;

        if (
            !fields.length
        ) {

            return 0;

        }

        return this.clamp(

            validCount /
            fields.length *
            100,

            0,

            100

        );

    },

    /* =====================================================
       RELIABILITY FACTOR
       ===================================================== */

    calculateReliabilityFactor(
        source = {}
    ) {

        return this.clamp(

            this.safeNumber(

                source.reliability ??

                source.trust,

                0

            ) *
            100,

            0,

            100

        );

    },

    /* =====================================================
       SPATIAL RELEVANCE FACTOR
       ===================================================== */

    calculateSpatialRelevanceFactor(
        source = {}
    ) {

        const sourceKey =
            this.detectSourceKey(
                source
            );

        if (
            sourceKey ===
            "lightning"
        ) {

            const distance =
                this.firstNullableNumber(

                    source.details
                        ?.nearestStrikeKm,

                    source.details
                        ?.distanceKm

                );

            return this.getLightningDistanceScore(
                distance
            );

        }

        if (
            sourceKey ===
            "radar"
        ) {

            if (
                source.details
                    ?.pointSignalAvailable ===
                true
            ) {

                return 100;

            }

            if (
                source.details
                    ?.visualVerificationOnly ===
                true
            ) {

                return 55;

            }

            return 75;

        }

        if (
            sourceKey ===
            "satellite"
        ) {

            const cloudCover =
                this.safeNumber(

                    source.details
                        ?.cloudCover,

                    0

                );

            const convection =
                this.safeNumber(

                    source.details
                        ?.convectionScore,

                    0

                );

            return this.clamp(

                cloudCover *
                    0.45 +

                convection *
                    0.55,

                20,

                100

            );

        }

        if (
            sourceKey ===
            "official"
        ) {

            return 100;

        }

        if (
            sourceKey ===
            "openMeteo"
        ) {

            return 90;

        }

        if (
            sourceKey ===
            "localModel"
        ) {

            return 85;

        }

        return 70;

    },

    /* =====================================================
       TEMPORAL CONTINUITY FACTOR
       ===================================================== */

    calculateTemporalContinuityFactor(
        source = {}
    ) {

        const historyCount =
            this.firstNumber(

                source.historyCount,

                source.details
                    ?.historyCount,

                0

            );

        if (
            historyCount >= 20
        ) {

            return 100;

        }

        if (
            historyCount >= 12
        ) {

            return 88;

        }

        if (
            historyCount >= 6
        ) {

            return 70;

        }

        if (
            historyCount >= 3
        ) {

            return 55;

        }

        if (
            historyCount >= 1
        ) {

            return 40;

        }

        return 25;

    },

    /* =====================================================
       TECHNICAL HEALTH FACTOR
       ===================================================== */

    calculateTechnicalHealthFactor(
        source = {}
    ) {

        if (
            source.available !==
            true
        ) {

            return 0;

        }

        if (
            source.error
        ) {

            return 25;

        }

        const status =
            this.normalizeStatus(
                source.status
            );

        if (
            status ===
            "FAILED" ||
            status ===
            "TIMEOUT"
        ) {

            return 20;

        }

        if (
            status ===
            "UNAVAILABLE" ||
            status ===
            "DISABLED"
        ) {

            return 0;

        }

        if (
            source.simulated ===
            true ||
            status ===
            "SIMULATION"
        ) {

            return 65;

        }

        if (
            status ===
            "CACHED"
        ) {

            return 80;

        }

        return 100;

    },

    /* =====================================================
       DATA QUALITY LEVEL
       ===================================================== */

    getDataQualityLevel(
        score
    ) {

        const thresholds =
            this.config
                .dataQuality
                .thresholds;

        const value =
            this.clamp(
                score,
                0,
                100
            );

        if (
            value >=
            thresholds.excellent
        ) {

            return "EXCELLENT";

        }

        if (
            value >=
            thresholds.good
        ) {

            return "GOOD";

        }

        if (
            value >=
            thresholds.acceptable
        ) {

            return "ACCEPTABLE";

        }

        if (
            value >=
            thresholds.weak
        ) {

            return "WEAK";

        }

        return "UNUSABLE";

    },

    /* =====================================================
       DYNAMIC SOURCE WEIGHTING V31
       ===================================================== */

    calculateDynamicSourceWeights(
        sources = []
    ) {

        if (
            !Array.isArray(
                sources
            ) ||
            !sources.length
        ) {

            return {};

        }

        const rawWeights =
            {};

        let totalRawWeight =
            0;

        sources.forEach(
            source => {

                const sourceKey =
                    this.detectSourceKey(
                        source
                    );

                if (
                    !sourceKey
                ) {

                    return;

                }

                const rawWeight =
                    this.calculateSingleSourceWeight(

                        source,

                        sourceKey

                    );

                rawWeights[
                    sourceKey
                ] =
                    rawWeight;

                totalRawWeight +=
                    rawWeight;

            }
        );

        return this.normalizeDynamicWeights(

            rawWeights,

            totalRawWeight

        );

    },

    /* =====================================================
       SINGLE SOURCE DYNAMIC WEIGHT
       ===================================================== */

    calculateSingleSourceWeight(
        source,
        sourceKey
    ) {

        if (
            !source ||
            source.available !==
                true
        ) {

            return 0;

        }

        const settings =
            this.config
                .dynamicWeighting;

        const baseWeight =
            this.safeNumber(

                this.config
                    .baseSourceWeights[
                        sourceKey
                    ],

                0.10

            );

        const quality =
            this.calculateSourceDataQuality(
                source
            );

        if (
            quality.score <
            this.config
                .dataQuality
                .exclusionScore
        ) {

            return 0;

        }

        const factors =
            settings.factors;

        let multiplier =

            quality.score /
                100 *
                factors.dataQuality +

            quality.freshness /
                100 *
                factors.freshness +

            quality.reliability /
                100 *
                factors.reliability +

            quality.technicalHealth /
                100 *
                factors.technicalHealth +

            quality.completeness /
                100 *
                factors.completeness +

            quality.spatialRelevance /
                100 *
                factors.spatialRelevance;

        if (
            source.simulated ===
            true
        ) {

            multiplier *=
                settings
                    .simulationPenalty;

        }

        if (
            quality.freshness <= 10
        ) {

            multiplier *=
                settings
                    .expiredPenalty;

        } else if (
            quality.freshness <= 45
        ) {

            multiplier *=
                settings
                    .stalePenalty;

        }

        let calculatedWeight =
            baseWeight *
            multiplier;

        if (
            sourceKey ===
            "lightning"
        ) {

            calculatedWeight =
                this.adjustLightningDynamicWeight(

                    source,

                    calculatedWeight

                );

        }

        const previousWeight =
            this.safeNumber(

                this.previousDynamicWeights[
                    sourceKey
                ],

                0

            );

        if (
            previousWeight > 0
        ) {

            const maximumIncrease =
                previousWeight +
                settings
                    .maximumIncreasePerCycle;

            const maximumDecrease =
                Math.max(

                    0,

                    previousWeight -
                    settings
                        .maximumDecreasePerCycle

                );

            calculatedWeight =
                Math.min(

                    calculatedWeight,

                    maximumIncrease

                );

            calculatedWeight =
                Math.max(

                    calculatedWeight,

                    maximumDecrease

                );

        }

        calculatedWeight =
            this.clamp(

                calculatedWeight,

                settings.minimumWeight,

                settings.maximumWeight

            );

        return Number(

            calculatedWeight
                .toFixed(
                    6
                )

        );

    },

    /* =====================================================
       LIGHTNING WEIGHT ADJUSTMENT
       ===================================================== */

    adjustLightningDynamicWeight(
        source,
        currentWeight
    ) {

        const settings =
            this.config
                .lightningIntelligence;

        let weight =
            this.safeNumber(
                currentWeight,
                0
            );

        const activityScore =
            this.safeNumber(

                source.details
                    ?.activityScore,

                source.signalScore

            );

        const stormThreat =
            this.safeNumber(

                source.details
                    ?.stormThreat,

                0

            );

        const trend =
            String(

                source.details
                    ?.trend ||

                "UNKNOWN"

            )
                .trim()
                .toUpperCase();

        if (
            activityScore >=
            settings
                .weightBoostActivityScore
        ) {

            weight *=
                1.35;

        }

        if (
            stormThreat >=
            settings
                .severeStormThreatThreshold
        ) {

            weight *=
                1.25;

        }

        if (
            trend ===
            "RAPIDLY_INCREASING"
        ) {

            weight *=
                1.20;

        }

        if (
            source.simulated ===
            true
        ) {

            weight =
                Math.min(

                    weight,

                    settings
                        .simulationMaximumWeight

                );

        } else {

            weight =
                this.clamp(

                    weight,

                    settings
                        .minimumDynamicWeight,

                    settings
                        .maximumDynamicWeight

                );

        }

        return weight;

    },

    /* =====================================================
       NORMALIZE DYNAMIC WEIGHTS
       ===================================================== */

    normalizeDynamicWeights(
        weights = {},
        totalWeight = 0
    ) {

        const normalized =
            {};

        const total =
            this.safeNumber(
                totalWeight,
                0
            );

        if (
            total <= 0
        ) {

            return normalized;

        }

        Object.entries(
            weights
        )
        .forEach(
            (
                [
                    key,
                    value
                ]
            ) => {

                normalized[
                    key
                ] =
                    Number(

                        (
                            this.safeNumber(
                                value,
                                0
                            ) /
                            total
                        )
                        .toFixed(
                            6
                        )

                    );

            }
        );

        return normalized;

    },

    /* =====================================================
       SOURCE CONTRIBUTION
       ===================================================== */

    calculateSourceContribution(
        source,
        normalizedWeights = {}
    ) {

        const sourceKey =
            this.detectSourceKey(
                source
            );

        const effectiveWeight =
            this.safeNumber(

                normalizedWeights[
                    sourceKey
                ],

                0

            );

        const quality =
            this.calculateSourceDataQuality(
                source
            );

        const factors =
            this.config
                .contribution
                .factors;

        const contribution =

            this.clamp(
                source.signalScore,
                0,
                100
            ) *
                factors.signalScore +

            this.clamp(
                source.confidence,
                0,
                100
            ) *
                factors.confidence +

            quality.score *
                factors.dataQuality +

            effectiveWeight *
                100 *
                factors.effectiveWeight;

        const influenceScore =

            this.clamp(
                source.signalScore,
                0,
                100
            ) *

            effectiveWeight;

        return {

            sourceKey,

            effectiveWeight:
                Number(
                    effectiveWeight
                        .toFixed(
                            6
                        )
                ),

            effectiveWeightPercent:
                Number(
                    (
                        effectiveWeight *
                        100
                    )
                    .toFixed(
                        2
                    )
                ),

            quality,

            dataQualityScore:
                quality.score,

            dataQualityLevel:
                quality.level,

            contribution:
                Math.round(

                    this.clamp(
                        contribution,
                        0,
                        100
                    )

                ),

            influenceScore:
                Number(

                    influenceScore
                        .toFixed(
                            2
                        )

                ),

            signalScore:
                this.safeNumber(
                    source.signalScore,
                    0
                ),

            confidence:
                this.safeNumber(
                    source.confidence,
                    0
                ),

            reliability:
                this.safeNumber(
                    source.reliability,
                    0
                ),

            simulated:
                source.simulated ===
                true

        };

    },

    /* =====================================================
       CONTRIBUTION MAP
       ===================================================== */

    buildContributionMap(
        sources = []
    ) {

        const dynamicWeights =
            this.calculateDynamicSourceWeights(
                sources
            );

        const contributions =
            {};

        sources.forEach(
            source => {

                const result =
                    this.calculateSourceContribution(

                        source,

                        dynamicWeights

                    );

                if (
                    result.sourceKey
                ) {

                    contributions[
                        result.sourceKey
                    ] =
                        result;

                }

            }
        );

        return {

            weights:
                dynamicWeights,

            contributions

        };

    },

    /* =====================================================
       DYNAMIC VERIFICATION CONTEXT
       ===================================================== */

    buildDynamicVerificationContext(
        sourceEvidence = {}
    ) {

        const availableSources =
            Object.entries(
                sourceEvidence
            )
            .filter(
                (
                    [
                        ,
                        source
                    ]
                ) => {

                    return (
                        source &&
                        source.available ===
                            true
                    );

                }
            )
            .map(
                (
                    [
                        key,
                        source
                    ]
                ) => {

                    return {

                        ...source,

                        key:
                            source.key ||
                            key,

                        sourceKey:
                            source.sourceKey ||
                            key

                    };

                }
            );

        const contributionContext =
            this.buildContributionMap(
                availableSources
            );

        const weights =
            contributionContext
                .weights ||
            {};

        const contributions =
            contributionContext
                .contributions ||
            {};

        let weightedDataQuality =
            0;

        let totalQualityWeight =
            0;

        availableSources.forEach(
            source => {

                const sourceKey =
                    source.key;

                const weight =
                    this.safeNumber(

                        weights[
                            sourceKey
                        ],

                        0

                    );

                const quality =
                    contributions[
                        sourceKey
                    ]
                    ?.quality ||
                    this.calculateSourceDataQuality(
                        source
                    );

                weightedDataQuality +=

                    quality.score *
                    weight;

                totalQualityWeight +=
                    weight;

            }
        );

        const averageDataQuality =
            totalQualityWeight > 0
                ? weightedDataQuality /
                    totalQualityWeight
                : 0;

        return {

            availableSources,

            weights,

            contributions,

            averageDataQuality:
                this.clamp(

                    averageDataQuality,

                    0,

                    100

                )

        };

    },

    /* =====================================================
       NATIONAL AVERAGE WEIGHTS
       ===================================================== */

    calculateNationalAverageWeights(
        results = []
    ) {

        if (
            !Array.isArray(
                results
            ) ||
            !results.length
        ) {

            return {};

        }

        const totals =
            {};

        const counts =
            {};

        results.forEach(
            result => {

                Object.entries(
                    result.dynamicWeights ||
                    {}
                )
                .forEach(
                    (
                        [
                            key,
                            value
                        ]
                    ) => {

                        totals[key] =
                            this.safeNumber(
                                totals[key],
                                0
                            ) +
                            this.safeNumber(
                                value,
                                0
                            );

                        counts[key] =
                            this.safeNumber(
                                counts[key],
                                0
                            ) +
                            1;

                    }
                );

            }
        );

        const averages =
            {};

        Object.keys(
            totals
        )
        .forEach(
            key => {

                averages[key] =
                    Number(

                        (
                            totals[key] /
                            Math.max(
                                1,
                                counts[key]
                            )
                        )
                        .toFixed(
                            6
                        )

                    );

            }
        );

        return averages;

    },
       /* =====================================================
       SOURCE AGREEMENT
       ===================================================== */

    calculateAgreement(
        sourceEvidence = {}
    ) {

        const sources =
            Object.values(
                sourceEvidence
            )
            .filter(
                source =>
                    source &&
                    source.available ===
                        true
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

                        this.safeNumber(
                            first.signalScore,
                            0
                        ) -

                        this.safeNumber(
                            second.signalScore,
                            0
                        )

                    );

                const probabilityDifference =
                    Math.abs(

                        this.safeNumber(
                            first.rainProbability,
                            0
                        ) -

                        this.safeNumber(
                            second.rainProbability,
                            0
                        )

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

                let pairAgreement =

                    signalAgreement *
                        0.60 +

                    probabilityAgreement *
                        0.40;

                const firstQuality =
                    this.calculateSourceDataQuality(
                        first
                    );

                const secondQuality =
                    this.calculateSourceDataQuality(
                        second
                    );

                const pairQuality =
                    (
                        firstQuality.score +
                        secondQuality.score
                    ) /
                    2;

                pairAgreement *=

                    0.70 +

                    pairQuality /
                    100 *
                    0.30;

                if (
                    first.simulated ===
                        true ||
                    second.simulated ===
                        true
                ) {

                    pairAgreement *=
                        0.90;

                }

                totalAgreement +=
                    pairAgreement;

                comparisons +=
                    1;

            }

        }

        if (
            comparisons <= 0
        ) {

            return 0;

        }

        return this.clamp(

            totalAgreement /
            comparisons,

            0,

            100

        );

    },

    /* =====================================================
       DYNAMIC EVIDENCE SCORE
       ===================================================== */

    calculateEvidenceScore(
        sourceEvidence = {}
    ) {

        const context =
            this.buildDynamicVerificationContext(
                sourceEvidence
            );

        if (
            !context
                .availableSources
                .length
        ) {

            return 0;

        }

        let weightedEvidence =
            0;

        let totalWeight =
            0;

        context
            .availableSources
            .forEach(
                source => {

                    const sourceKey =
                        source.key;

                    const dynamicWeight =
                        this.safeNumber(

                            context.weights[
                                sourceKey
                            ],

                            0

                        );

                    const contribution =
                        context
                            .contributions[
                                sourceKey
                            ] ||
                        {};

                    const quality =
                        contribution.quality ||
                        this.calculateSourceDataQuality(
                            source
                        );

                    if (
                        quality.score <
                        this.config
                            .dataQuality
                            .exclusionScore
                    ) {

                        return;

                    }

                    const qualityFactor =
                        quality.score /
                        100;

                    const reliability =
                        this.clamp(

                            source.reliability,

                            0,

                            1

                        );

                    const confidence =
                        this.clamp(

                            source.confidence,

                            0,

                            100

                        );

                    const confidenceFactor =

                        0.60 +

                        confidence /
                        100 *
                        0.40;

                    let effectiveWeight =

                        dynamicWeight *

                        reliability *

                        qualityFactor *

                        confidenceFactor;

                    if (
                        source.simulated ===
                        true
                    ) {

                        effectiveWeight *=
                            this.config
                                .dynamicWeighting
                                .simulationPenalty;

                    }

                    weightedEvidence +=

                        this.clamp(
                            source.signalScore,
                            0,
                            100
                        ) *

                        effectiveWeight;

                    totalWeight +=
                        effectiveWeight;

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

    /* =====================================================
       DYNAMIC RAIN CONSENSUS
       ===================================================== */

    calculateRainConsensus(
        sourceEvidence = {}
    ) {

        const context =
            this.buildDynamicVerificationContext(
                sourceEvidence
            );

        let weightedProbability =
            0;

        let totalWeight =
            0;

        context
            .availableSources
            .forEach(
                source => {

                    const sourceKey =
                        source.key;

                    const dynamicWeight =
                        this.safeNumber(

                            context.weights[
                                sourceKey
                            ],

                            0

                        );

                    const contribution =
                        context
                            .contributions[
                                sourceKey
                            ] ||
                        {};

                    const quality =
                        contribution.quality ||
                        this.calculateSourceDataQuality(
                            source
                        );

                    if (
                        quality.score <
                        this.config
                            .dataQuality
                            .exclusionScore
                    ) {

                        return;

                    }

                    const reliability =
                        this.clamp(

                            source.reliability,

                            0,

                            1

                        );

                    const qualityFactor =
                        quality.score /
                        100;

                    let effectiveWeight =

                        dynamicWeight *

                        reliability *

                        qualityFactor;

                    if (
                        source.simulated ===
                        true
                    ) {

                        effectiveWeight *=
                            0.65;

                    }

                    weightedProbability +=

                        this.clamp(
                            source.rainProbability,
                            0,
                            100
                        ) *

                        effectiveWeight;

                    totalWeight +=
                        effectiveWeight;

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

    /* =====================================================
       DYNAMIC RAIN AMOUNT CONSENSUS
       ===================================================== */

    calculateRainAmountConsensus(
        sourceEvidence = {}
    ) {

        const context =
            this.buildDynamicVerificationContext(
                sourceEvidence
            );

        let weightedAmount =
            0;

        let totalWeight =
            0;

        context
            .availableSources
            .forEach(
                source => {

                    const rainAmount =
                        this.safeNumber(
                            source.rainAmount,
                            0
                        );

                    if (
                        rainAmount <= 0
                    ) {

                        return;

                    }

                    const sourceKey =
                        source.key;

                    const dynamicWeight =
                        this.safeNumber(

                            context.weights[
                                sourceKey
                            ],

                            0

                        );

                    const contribution =
                        context
                            .contributions[
                                sourceKey
                            ] ||
                        {};

                    const quality =
                        contribution.quality ||
                        this.calculateSourceDataQuality(
                            source
                        );

                    if (
                        quality.score <
                        this.config
                            .dataQuality
                            .exclusionScore
                    ) {

                        return;

                    }

                    const reliability =
                        this.clamp(

                            source.reliability,

                            0,

                            1

                        );

                    const qualityFactor =
                        quality.score /
                        100;

                    const effectiveWeight =

                        dynamicWeight *

                        reliability *

                        qualityFactor;

                    weightedAmount +=

                        rainAmount *

                        effectiveWeight;

                    totalWeight +=
                        effectiveWeight;

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

    /* =====================================================
       DYNAMIC WEIGHTED CONFIDENCE
       ===================================================== */

    calculateWeightedConfidence(
        sourceEvidence,
        agreement,
        evidenceScore
    ) {

        const context =
            this.buildDynamicVerificationContext(
                sourceEvidence
            );

        const activeSourceCount =
            context
                .availableSources
                .length;

        const sourceCoverage =
            this.calculateSourceCoverage(
                activeSourceCount
            );

        const averageReliability =
            this.calculateAverageReliability(
                context.availableSources
            );

        const averageDataQuality =
            context.averageDataQuality;

        const settings =
            this.config
                .confidenceEngine;

        let confidence =

            agreement *
                settings.agreementWeight +

            evidenceScore *
                settings.evidenceWeight +

            sourceCoverage *
                settings.coverageWeight +

            averageReliability *
                settings.reliabilityWeight +

            averageDataQuality *
                settings.dataQualityWeight;

        if (
            sourceEvidence
                .official
                ?.available
        ) {

            confidence +=
                settings.officialBonus;

        }

        if (
            sourceEvidence
                .radar
                ?.available
        ) {

            confidence +=
                settings.radarBonus;

        }

        const lightningThreat =
            this.safeNumber(

                sourceEvidence
                    .lightning
                    ?.details
                    ?.stormThreat,

                0

            );

        if (
            sourceEvidence
                .lightning
                ?.available &&
            lightningThreat >=
            this.config
                .lightningIntelligence
                .stormThreatThreshold
        ) {

            confidence +=
                settings.lightningBonus;

        }

        if (
            agreement <
            this.config
                .conflictAgreementThreshold
        ) {

            confidence -=
                settings.conflictPenalty;

        }

        const sourceSpread =
            this.calculateSourceSpread(
                sourceEvidence
            );

        if (
            sourceSpread >=
            this.config
                .conflictIntelligence
                .sourceSpreadHigh
        ) {

            confidence -=
                settings.highConflictPenalty;

        }

        if (
            averageDataQuality <
            this.config
                .decisionGate
                .minimumDataQuality
        ) {

            confidence *=
                0.82;

        }

        const simulatedSourceCount =
            context
                .availableSources
                .filter(
                    source =>
                        source.simulated ===
                        true
                )
                .length;

        if (
            simulatedSourceCount > 0
        ) {

            const simulationRatio =

                simulatedSourceCount /

                Math.max(
                    1,
                    activeSourceCount
                );

            confidence *=

                1 -
                simulationRatio *
                0.12;

        }

        return this.clamp(

            confidence,

            0,

            100

        );

    },

    /* =====================================================
       SOURCE COVERAGE
       ===================================================== */

    calculateSourceCoverage(
        activeSourceCount
    ) {

        const maximumSources =
            this.config
                .maximumSources ||
            6;

        return this.clamp(

            this.safeNumber(
                activeSourceCount,
                0
            ) /
            maximumSources *
            100,

            0,

            100

        );

    },

    /* =====================================================
       AVERAGE RELIABILITY
       ===================================================== */

    calculateAverageReliability(
        availableSources = []
    ) {

        if (
            !Array.isArray(
                availableSources
            ) ||
            !availableSources.length
        ) {

            return 0;

        }

        let weightedReliability =
            0;

        let totalQuality =
            0;

        availableSources
            .forEach(
                source => {

                    const quality =
                        this.calculateSourceDataQuality(
                            source
                        );

                    const qualityFactor =
                        Math.max(

                            0.10,

                            quality.score /
                            100

                        );

                    weightedReliability +=

                        this.clamp(
                            source.reliability,
                            0,
                            1
                        ) *

                        qualityFactor;

                    totalQuality +=
                        qualityFactor;

                }
            );

        if (
            totalQuality <= 0
        ) {

            return 0;

        }

        return this.clamp(

            weightedReliability /
            totalQuality *
            100,

            0,

            100

        );

    },

    /* =====================================================
       SOURCE SPREAD
       ===================================================== */

    calculateSourceSpread(
        sourceEvidence = {}
    ) {

        const availableScores =
            Object.values(
                sourceEvidence
            )
            .filter(
                source =>
                    source &&
                    source.available ===
                        true
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

    /* =====================================================
       EVIDENCE QUALITY
       ===================================================== */

    calculateEvidenceQuality(
        sourceEvidence = {}
    ) {

        const context =
            this.buildDynamicVerificationContext(
                sourceEvidence
            );

        const availableSources =
            context.availableSources;

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

        const dataQuality =
            context.averageDataQuality;

        const freshness =
            this.calculateFreshnessScore(
                sourceEvidence
            );

        return this.clamp(

            reliability *
                0.30 +

            coverage *
                0.20 +

            dataQuality *
                0.35 +

            freshness *
                0.15,

            0,

            100

        );

    },

    /* =====================================================
       GENERAL FRESHNESS SCORE
       ===================================================== */

    calculateFreshnessScore(
        sourceEvidence = {}
    ) {

        const scores =
            [];

        Object.values(
            sourceEvidence
        )
        .forEach(
            source => {

                if (
                    !source ||
                    source.available !==
                        true
                ) {

                    return;

                }

                scores.push(

                    this.calculateFreshnessFactor(
                        source
                    )

                );

            }
        );

        if (
            !scores.length
        ) {

            return 0;

        }

        return this.clamp(

            scores.reduce(
                (
                    total,
                    score
                ) =>
                    total +
                    score,
                0
            ) /
            scores.length,

            0,

            100

        );

    },

    /* =====================================================
       DYNAMIC VERIFIED RISK
       ===================================================== */

    calculateVerifiedRisk(
        city,
        sourceEvidence,
        rainConsensus,
        confidence
    ) {

        const context =
            this.buildDynamicVerificationContext(
                sourceEvidence
            );

        let weightedSourceRisk =
            0;

        let totalSourceWeight =
            0;

        context
            .availableSources
            .forEach(
                source => {

                    const sourceKey =
                        source.key;

                    const dynamicWeight =
                        this.safeNumber(

                            context.weights[
                                sourceKey
                            ],

                            0

                        );

                    const contribution =
                        context
                            .contributions[
                                sourceKey
                            ] ||
                        {};

                    const quality =
                        contribution.quality ||
                        this.calculateSourceDataQuality(
                            source
                        );

                    if (
                        quality.score <
                        this.config
                            .dataQuality
                            .exclusionScore
                    ) {

                        return;

                    }

                    const qualityFactor =
                        quality.score /
                        100;

                    let effectiveWeight =

                        dynamicWeight *

                        qualityFactor;

                    if (
                        source.simulated ===
                        true
                    ) {

                        effectiveWeight *=
                            0.60;

                    }

                    weightedSourceRisk +=

                        this.clamp(
                            source.signalScore,
                            0,
                            100
                        ) *

                        effectiveWeight;

                    totalSourceWeight +=
                        effectiveWeight;

                }
            );

        const sourceRisk =
            totalSourceWeight > 0
                ? weightedSourceRisk /
                    totalSourceWeight
                : 0;

        const localModel =
            city.localModelData ||
            {};

        const floodRisk =
            this.clamp(
                localModel.floodIndex,
                0,
                100
            );

        const roadRisk =
            this.clamp(
                localModel.roadRisk,
                0,
                100
            );

        const stormRisk =
            this.clamp(
                localModel.stormRisk,
                0,
                100
            );

        const lightningThreat =
            this.clamp(

                sourceEvidence
                    .lightning
                    ?.details
                    ?.stormThreat,

                0,

                100

            );

        const satelliteStormScore =
            this.clamp(

                sourceEvidence
                    .satellite
                    ?.details
                    ?.stormCellScore,

                0,

                100

            );

        let verifiedRisk =

            sourceRisk *
                0.45 +

            this.clamp(
                rainConsensus,
                0,
                100
            ) *
                0.20 +

            floodRisk *
                0.10 +

            roadRisk *
                0.05 +

            stormRisk *
                0.05 +

            lightningThreat *
                0.10 +

            satelliteStormScore *
                0.05;

        const confidenceFactor =

            0.65 +

            this.clamp(
                confidence,
                0,
                100
            ) /
            100 *
            0.22 +

            this.clamp(
                context.averageDataQuality,
                0,
                100
            ) /
            100 *
            0.13;

        verifiedRisk *=
            confidenceFactor;

        if (
            lightningThreat >=
            this.config
                .lightningIntelligence
                .severeStormThreatThreshold &&
            sourceEvidence
                .satellite
                ?.signalScore >= 55
        ) {

            verifiedRisk =
                Math.max(
                    verifiedRisk,
                    70
                );

        }

        return this.clamp(

            verifiedRisk,

            0,

            100

        );

    },
       /* =====================================================
       CONFLICT INTELLIGENCE V31
       ===================================================== */

    detectConflict(
        sourceEvidence = {},
        agreement = 0,
        dynamicContext = null
    ) {

        const official =
            sourceEvidence.official ||
            {};

        const radar =
            sourceEvidence.radar ||
            {};

        const satellite =
            sourceEvidence.satellite ||
            {};

        const lightning =
            sourceEvidence.lightning ||
            {};

        const openMeteo =
            sourceEvidence.openMeteo ||
            {};

        const localModel =
            sourceEvidence.localModel ||
            {};

        const settings =
            this.config
                .conflictIntelligence;

        const context =
            dynamicContext ||
            this.buildDynamicVerificationContext(
                sourceEvidence
            );

        const reasons =
            [];

        const evidencePairs =
            [];

        const registerConflict = (
            code,
            reason,
            firstSource,
            secondSource,
            difference,
            severity = "MEDIUM"
        ) => {

            reasons.push(
                reason
            );

            evidencePairs.push({

                code,

                firstSource,

                secondSource,

                difference:
                    Math.round(
                        this.safeNumber(
                            difference,
                            0
                        )
                    ),

                severity

            });

        };

        /* =================================================
           OFFICIAL VS OPEN-METEO
           ================================================= */

        if (
            official.available ===
                true &&
            openMeteo.available ===
                true
        ) {

            const difference =
                Math.abs(

                    this.safeNumber(
                        official.rainProbability,
                        0
                    ) -

                    this.safeNumber(
                        openMeteo.rainProbability,
                        0
                    )

                );

            if (
                difference >
                settings
                    .officialOpenMeteoDifference
            ) {

                registerConflict(

                    "OFFICIAL_OPENMETEO_DIFFERENCE",

                    "Official source and Open-Meteo differ significantly.",

                    "official",

                    "openMeteo",

                    difference,

                    difference >= 60
                        ? "HIGH"
                        : "MEDIUM"

                );

            }

        }

        /* =================================================
           RADAR VS FORECAST
           ================================================= */

        if (
            radar.available ===
                true &&
            radar.details
                ?.rainDetected ===
                true &&
            openMeteo.available ===
                true &&
            this.safeNumber(
                openMeteo.rainProbability,
                0
            ) <
            this.config
                .lowForecastProbabilityThreshold
        ) {

            registerConflict(

                "RADAR_FORECAST_CONFLICT",

                "Radar detects rain while forecast probability is low.",

                "radar",

                "openMeteo",

                Math.abs(

                    this.safeNumber(
                        radar.signalScore,
                        0
                    ) -

                    this.safeNumber(
                        openMeteo.rainProbability,
                        0
                    )

                ),

                "HIGH"

            );

        }

        /* =================================================
           SATELLITE VS RADAR
           ================================================= */

        if (
            satellite.available ===
                true &&
            radar.available ===
                true
        ) {

            const difference =
                Math.abs(

                    this.safeNumber(
                        satellite.signalScore,
                        0
                    ) -

                    this.safeNumber(
                        radar.signalScore,
                        0
                    )

                );

            if (
                difference >
                settings
                    .satelliteRadarDifference
            ) {

                registerConflict(

                    "SATELLITE_RADAR_DIFFERENCE",

                    "Satellite and radar signals differ significantly.",

                    "satellite",

                    "radar",

                    difference,

                    difference >= 65
                        ? "HIGH"
                        : "MEDIUM"

                );

            }

        }

        /* =================================================
           LIGHTNING VS RADAR
           ================================================= */

        const lightningThreat =
            this.safeNumber(

                lightning.details
                    ?.stormThreat,

                lightning.signalScore

            );

        if (
            lightning.available ===
                true &&
            lightningThreat >=
                settings
                    .minimumLightningThreatForConflict &&
            radar.available ===
                true &&
            this.safeNumber(
                radar.signalScore,
                0
            ) <=
            settings
                .maximumRadarSignalForLightningConflict
        ) {

            registerConflict(

                "LIGHTNING_RADAR_CONFLICT",

                "Lightning activity is high while radar rain signal is low.",

                "lightning",

                "radar",

                Math.abs(

                    lightningThreat -

                    this.safeNumber(
                        radar.signalScore,
                        0
                    )

                ),

                lightningThreat >= 80
                    ? "HIGH"
                    : "MEDIUM"

            );

        }

        /* =================================================
           LIGHTNING VS SATELLITE
           ================================================= */

        if (
            lightning.available ===
                true &&
            satellite.available ===
                true
        ) {

            const difference =
                Math.abs(

                    this.safeNumber(
                        lightning.signalScore,
                        0
                    ) -

                    this.safeNumber(
                        satellite.signalScore,
                        0
                    )

                );

            if (
                difference >
                settings
                    .lightningSatelliteDifference
            ) {

                registerConflict(

                    "LIGHTNING_SATELLITE_DIFFERENCE",

                    "Lightning and satellite signals differ significantly.",

                    "lightning",

                    "satellite",

                    difference,

                    difference >= 65
                        ? "HIGH"
                        : "MEDIUM"

                );

            }

        }

        /* =================================================
           HIGH LIGHTNING THREAT WITHOUT SUPPORT
           ================================================= */

        if (
            lightning.available ===
                true &&
            lightningThreat >= 70
        ) {

            const radarSupport =
                radar.available ===
                    true &&
                this.safeNumber(
                    radar.signalScore,
                    0
                ) >= 35;

            const satelliteSupport =
                satellite.available ===
                    true &&
                this.safeNumber(
                    satellite.signalScore,
                    0
                ) >= 40;

            const officialSupport =
                official.available ===
                    true &&
                this.safeNumber(
                    official.signalScore,
                    0
                ) >= 35;

            if (
                !radarSupport &&
                !satelliteSupport &&
                !officialSupport
            ) {

                registerConflict(

                    "LIGHTNING_UNSUPPORTED_THREAT",

                    "Lightning threat is high but supporting atmospheric evidence is weak.",

                    "lightning",

                    "supportingSources",

                    lightningThreat,

                    "HIGH"

                );

            }

        }

        /* =================================================
           LOCAL AI VS SOURCES
           ================================================= */

        if (
            localModel.available ===
                true
        ) {

            const externalSignals =
                [
                    official,
                    radar,
                    satellite,
                    lightning,
                    openMeteo
                ]
                .filter(
                    source =>
                        source.available ===
                        true
                )
                .map(
                    source =>
                        this.safeNumber(
                            source.signalScore,
                            0
                        )
                );

            if (
                externalSignals.length >= 2
            ) {

                const externalAverage =
                    externalSignals.reduce(
                        (
                            total,
                            value
                        ) =>
                            total + value,
                        0
                    ) /
                    externalSignals.length;

                const difference =
                    Math.abs(

                        this.safeNumber(
                            localModel.signalScore,
                            0
                        ) -

                        externalAverage

                    );

                if (
                    difference >= 50
                ) {

                    registerConflict(

                        "LOCAL_AI_EXTERNAL_CONFLICT",

                        "RainGuard local AI differs significantly from external sources.",

                        "localModel",

                        "externalSources",

                        difference,

                        difference >= 70
                            ? "HIGH"
                            : "MEDIUM"

                    );

                }

            }

        }

        /* =================================================
           AGREEMENT CONFLICT
           ================================================= */

        if (
            agreement <
            this.config
                .conflictAgreementThreshold
        ) {

            registerConflict(

                "LOW_SOURCE_AGREEMENT",

                "Low agreement among available sources.",

                "allSources",

                "allSources",

                100 -
                agreement,

                agreement < 25
                    ? "HIGH"
                    : "MEDIUM"

            );

        }

        /* =================================================
           SOURCE SPREAD
           ================================================= */

        const sourceSpread =
            this.calculateSourceSpread(
                sourceEvidence
            );

        if (
            sourceSpread >=
            settings.sourceSpreadHigh
        ) {

            registerConflict(

                "HIGH_SOURCE_SPREAD",

                "Wide signal spread detected across active sources.",

                "highestSignal",

                "lowestSignal",

                sourceSpread,

                "HIGH"

            );

        } else if (
            sourceSpread >=
            settings.sourceSpreadMedium
        ) {

            registerConflict(

                "MEDIUM_SOURCE_SPREAD",

                "Wide signal spread detected across active sources.",

                "highestSignal",

                "lowestSignal",

                sourceSpread,

                "MEDIUM"

            );

        }

        /* =================================================
           DATA QUALITY VARIATION
           ================================================= */

        const qualityScores =
            Object.values(
                context
                    .contributions ||
                {}
            )
            .map(
                contribution =>
                    this.safeNumber(
                        contribution
                            ?.dataQualityScore,
                        0
                    )
            )
            .filter(
                score =>
                    score > 0
            );

        let qualitySpread =
            0;

        if (
            qualityScores.length >= 2
        ) {

            qualitySpread =

                Math.max(
                    ...qualityScores
                ) -

                Math.min(
                    ...qualityScores
                );

            if (
                qualitySpread >= 45
            ) {

                registerConflict(

                    "DATA_QUALITY_VARIATION",

                    "Data quality varies significantly between active sources.",

                    "highestQuality",

                    "lowestQuality",

                    qualitySpread,

                    qualitySpread >= 65
                        ? "HIGH"
                        : "MEDIUM"

                );

            }

        }

        const uniqueReasons =
            [
                ...new Set(
                    reasons
                )
            ];

        const highConflicts =
            evidencePairs.filter(
                item =>
                    item.severity ===
                    "HIGH"
            )
            .length;

        const mediumConflicts =
            evidencePairs.filter(
                item =>
                    item.severity ===
                    "MEDIUM"
            )
            .length;

        let level =
            "NONE";

        if (
            highConflicts >= 2 ||
            uniqueReasons.length >= 4
        ) {

            level =
                "HIGH";

        } else if (
            highConflicts >= 1 ||
            mediumConflicts >= 2
        ) {

            level =
                "MEDIUM";

        } else if (
            uniqueReasons.length >= 1
        ) {

            level =
                "LOW";

        }

        let conflictScore =

            highConflicts *
                30 +

            mediumConflicts *
                15 +

            Math.max(
                0,
                this.config
                    .conflictAgreementThreshold -
                agreement
            ) *

                0.50 +

            sourceSpread *
                0.20 +

            qualitySpread *
                0.10;

        conflictScore =
            this.clamp(
                conflictScore,
                0,
                100
            );

        return {

            detected:
                uniqueReasons.length >
                0,

            level,

            score:
                Math.round(
                    conflictScore
                ),

            reasons:
                uniqueReasons,

            translatedReasons:
                uniqueReasons.map(
                    reason =>
                        this.translateConflictReason(
                            reason
                        )
                ),

            evidencePairs,

            sourceSpread:
                Math.round(
                    sourceSpread
                ),

            qualitySpread:
                Math.round(
                    qualitySpread
                ),

            highConflicts,

            mediumConflicts

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

        const normalizedConfidence =
            this.clamp(
                confidence,
                0,
                100
            );

        if (
            sourceCount <
            this.config
                .minimumSources
        ) {

            return "INSUFFICIENT_DATA";

        }

        if (
            conflict
                ?.detected ===
                true &&
            conflict
                ?.level ===
                "HIGH"
        ) {

            return "CONFLICTED";

        }

        if (
            normalizedConfidence >=
            this.config
                .thresholds
                .verified
        ) {

            return "VERIFIED";

        }

        if (
            normalizedConfidence >=
            this.config
                .thresholds
                .supported
        ) {

            return "SUPPORTED";

        }

        if (
            normalizedConfidence >=
            this.config
                .thresholds
                .uncertain
        ) {

            return "UNCERTAIN";

        }

        return "UNVERIFIED";

    },

    /* =====================================================
       DECISION GATE V31
       ===================================================== */

    buildDecisionGate({

        finalRisk,

        weightedConfidence,

        verificationStatus,

        activeSourceCount,

        conflict,

        rainConsensus,

        rainAmountConsensus = 0,

        averageDataQuality = 0,

        lightningThreat = 0,

        lightningThreatLevel = "NONE",

        sourceEvidence = {},

        dynamicContext = {}

    }) {

        const settings =
            this.config
                .decisionGate;

        const normalizedRisk =
            this.clamp(
                finalRisk,
                0,
                100
            );

        const normalizedConfidence =
            this.clamp(
                weightedConfidence,
                0,
                100
            );

        const normalizedQuality =
            this.clamp(
                averageDataQuality,
                0,
                100
            );

        const normalizedLightningThreat =
            this.clamp(
                lightningThreat,
                0,
                100
            );

        const availableSources =
            dynamicContext
                ?.availableSources ||
            Object.values(
                sourceEvidence
            )
            .filter(
                source =>
                    source.available ===
                    true
            );

        const simulatedSources =
            availableSources.filter(
                source =>
                    source.simulated ===
                    true
            );

        const realSources =
            availableSources.filter(
                source =>
                    source.simulated !==
                    true
            );

        const simulationOnly =

            availableSources.length >
                0 &&

            realSources.length ===
                0;

        let allowed =
            false;

        let action =
            "HOLD";

        let reason =
            "Evidence is not sufficient.";

        let gateLevel =
            "BLOCK";

        let requiresManualReview =
            false;

        let escalation =
            false;

        /* =================================================
           INSUFFICIENT SOURCES
           ================================================= */

        if (
            activeSourceCount <
            this.config
                .minimumSources
        ) {

            action =
                "WAIT_FOR_SOURCES";

            reason =
                "Not enough active sources are available.";

            gateLevel =
                "BLOCK";

        }

        /* =================================================
           DATA QUALITY SAFETY
           ================================================= */

        else if (
            normalizedQuality <
            settings.minimumDataQuality
        ) {

            action =
                "MANUAL_REVIEW";

            reason =
                "Data quality is below the operational threshold.";

            gateLevel =
                "REVIEW";

            requiresManualReview =
                true;

        }

        /* =================================================
           SIMULATION SAFETY
           ================================================= */

        else if (
            simulationOnly &&
            settings
                .allowSimulationDecision !==
                true
        ) {

            action =
                "MANUAL_REVIEW";

            reason =
                "Simulation evidence cannot authorize an operational decision.";

            gateLevel =
                "REVIEW";

            requiresManualReview =
                true;

        }

        /* =================================================
           HIGH CONFLICT SAFETY
           ================================================= */

        else if (
            conflict
                ?.detected ===
                true &&
            conflict
                ?.level ===
                "HIGH"
        ) {

            action =
                "MANUAL_REVIEW";

            reason =
                "Sources conflict and require additional verification.";

            gateLevel =
                "REVIEW";

            requiresManualReview =
                true;

        }

        /* =================================================
           SEVERE STORM ESCALATION
           ================================================= */

        else if (
            normalizedLightningThreat >=
                settings
                    .stormThreatEscalation &&
            (
                lightningThreatLevel ===
                    "SEVERE" ||
                lightningThreatLevel ===
                    "HIGH"
            )
        ) {

            action =
                "STORM_ESCALATION";

            reason =
                "Severe storm threat requires immediate escalation.";

            gateLevel =
                "AUTO";

            allowed =
                true;

            escalation =
                true;

        }

        /* =================================================
           LIGHTNING ALERT
           ================================================= */

        else if (
            normalizedLightningThreat >= 60 &&
            normalizedConfidence >= 55
        ) {

            action =
                "LIGHTNING_ALERT";

            reason =
                "Lightning activity requires immediate operational attention.";

            gateLevel =
                "AUTO";

            allowed =
                true;

        }

        /* =================================================
           VERIFIED DECISION
           ================================================= */

        else if (
            verificationStatus ===
                "VERIFIED" &&
            normalizedConfidence >=
                settings
                    .verifiedConfidence
        ) {

            allowed =
                true;

            gateLevel =
                "AUTO";

            if (
                normalizedRisk >=
                settings
                    .emergencyRisk
            ) {

                action =
                    "EMERGENCY_ESCALATION";

                reason =
                    "High verified risk supported by multiple sources.";

                escalation =
                    true;

            } else if (
                normalizedRisk >=
                settings
                    .warningRisk
            ) {

                action =
                    "OPERATIONAL_WARNING";

                reason =
                    "Verified multi-source risk requires operational readiness.";

            } else if (
                normalizedRisk >=
                settings
                    .watchRisk
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

        }

        /* =================================================
           SUPPORTED DECISION
           ================================================= */

        else if (
            verificationStatus ===
                "SUPPORTED" &&
            normalizedConfidence >=
                settings
                    .supportedConfidence
        ) {

            allowed =
                true;

            gateLevel =
                "AUTO";

            action =

                normalizedRisk >= 45 ||

                rainConsensus >= 50 ||

                normalizedLightningThreat >= 45

                    ? "ENHANCED_WATCH"

                    : "NORMAL_MONITORING";

            reason =
                "Evidence is supported but not fully verified.";

        }

        /* =================================================
           MEDIUM OR LOW CONFLICT
           ================================================= */

        else if (
            conflict
                ?.detected ===
                true
        ) {

            action =
                "MANUAL_REVIEW";

            reason =
                "Sources conflict and require additional verification.";

            gateLevel =
                "REVIEW";

            requiresManualReview =
                true;

        }

        const weightSummary =
            Object.entries(
                dynamicContext
                    ?.weights ||
                {}
            )
            .map(
                (
                    [
                        sourceKey,
                        weight
                    ]
                ) => ({

                    sourceKey,

                    weight:
                        Number(
                            this.safeNumber(
                                weight,
                                0
                            )
                            .toFixed(
                                6
                            )
                        ),

                    percent:
                        Number(
                            (
                                this.safeNumber(
                                    weight,
                                    0
                                ) *
                                100
                            )
                            .toFixed(
                                2
                            )
                        )

                })
            )
            .sort(
                (
                    first,
                    second
                ) =>
                    second.weight -
                    first.weight
            );

        return {

            allowed,

            action,

            actionLabel:
                this.getDecisionActionLabel(
                    action
                ),

            gateLevel,

            reason,

            translatedReason:
                this.translateDecisionReason(
                    reason
                ),

            requiresManualReview,

            escalation,

            finalRisk:
                Math.round(
                    normalizedRisk
                ),

            confidence:
                Math.round(
                    normalizedConfidence
                ),

            dataQuality:
                Math.round(
                    normalizedQuality
                ),

            verificationStatus,

            verificationStatusLabel:
                this.getStatusLabel(
                    verificationStatus
                ),

            activeSourceCount,

            realSourceCount:
                realSources.length,

            simulatedSourceCount:
                simulatedSources.length,

            simulationOnly,

            conflictLevel:
                conflict
                    ?.level ||
                "NONE",

            conflictScore:
                this.safeNumber(
                    conflict
                        ?.score,
                    0
                ),

            rainConsensus:
                Math.round(
                    this.clamp(
                        rainConsensus,
                        0,
                        100
                    )
                ),

            rainAmountConsensus:
                Number(
                    this.safeNumber(
                        rainAmountConsensus,
                        0
                    )
                    .toFixed(
                        2
                    )
                ),

            lightningThreat:
                Math.round(
                    normalizedLightningThreat
                ),

            lightningThreatLevel,

            lightningThreatLabel:
                this.getStormThreatLabel(
                    lightningThreatLevel
                ),

            weightSummary,

            timestamp:
                new Date()
                    .toISOString()

        };

    },

    /* =====================================================
       NATIONAL SUMMARY V31
       ===================================================== */

    buildNationalSummary(
        results = []
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

                averageRainAmount:
                    0,

                averageVerifiedRisk:
                    0,

                averageDataQuality:
                    0,

                averageLightningThreat:
                    0,

                nationalConfidence:
                    0,

                topCity:
                    "--",

                topRisk:
                    0,

                topLightningCity:
                    "--",

                topLightningThreat:
                    0,

                nationalStatus:
                    "NO_DATA",

                nationalStatusLabel:
                    this.getStatusLabel(
                        "NO_DATA"
                    ),

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
                        ) =>

                            sum +

                            this.safeNumber(
                                result?.[
                                    field
                                ],
                                0
                            ),

                        0

                    );

                return Math.round(

                    total /
                    results.length

                );

            };

        const averageDecimal =
            field => {

                const total =
                    results.reduce(

                        (
                            sum,
                            result
                        ) =>

                            sum +

                            this.safeNumber(
                                result?.[
                                    field
                                ],
                                0
                            ),

                        0

                    );

                return Number(

                    (
                        total /
                        results.length
                    )
                    .toFixed(
                        2
                    )

                );

            };

        const sortedByRisk =
            [
                ...results
            ]
            .sort(
                (
                    first,
                    second
                ) =>

                    this.safeNumber(
                        second
                            ?.verifiedRisk,
                        0
                    ) -

                    this.safeNumber(
                        first
                            ?.verifiedRisk,
                        0
                    )
            );

        const sortedByLightning =
            [
                ...results
            ]
            .sort(
                (
                    first,
                    second
                ) =>

                    this.safeNumber(
                        second
                            ?.lightningThreat,
                        0
                    ) -

                    this.safeNumber(
                        first
                            ?.lightningThreat,
                        0
                    )
            );

        const topRiskResult =
            sortedByRisk[0] ||
            null;

        const topLightningResult =
            sortedByLightning[0] ||
            null;

        const verifiedCities =
            results.filter(
                result =>
                    result.status ===
                    "VERIFIED"
            )
            .length;

        const supportedCities =
            results.filter(
                result =>
                    result.status ===
                    "SUPPORTED"
            )
            .length;

        const uncertainCities =
            results.filter(
                result =>
                    result.status ===
                    "UNCERTAIN"
            )
            .length;

        const unverifiedCities =
            results.filter(
                result =>
                    result.status ===
                    "UNVERIFIED"
            )
            .length;

        const conflictedCities =
            results.filter(
                result =>

                    result.status ===
                        "CONFLICTED" ||

                    result.conflict
                        ?.detected ===
                        true
            )
            .length;

        const insufficientDataCities =
            results.filter(
                result =>
                    result.status ===
                    "INSUFFICIENT_DATA"
            )
            .length;

        const emergencyCities =
            results.filter(
                result =>

                    result.decisionGate
                        ?.action ===
                        "EMERGENCY_ESCALATION" ||

                    result.decisionGate
                        ?.action ===
                        "STORM_ESCALATION"
            )
            .length;

        const manualReviewCities =
            results.filter(
                result =>
                    result.decisionGate
                        ?.requiresManualReview ===
                        true
            )
            .length;

        const simulationOnlyCities =
            results.filter(
                result =>
                    result.decisionGate
                        ?.simulationOnly ===
                        true
            )
            .length;

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

        const averageRainAmount =
            averageDecimal(
                "rainAmountConsensus"
            );

        const averageVerifiedRisk =
            average(
                "verifiedRisk"
            );

        const averageDataQuality =
            average(
                "averageDataQuality"
            );

        const averageLightningThreat =
            average(
                "lightningThreat"
            );

        const topRisk =
            this.safeNumber(
                topRiskResult
                    ?.verifiedRisk,
                0
            );

        const topLightningThreat =
            this.safeNumber(
                topLightningResult
                    ?.lightningThreat,
                0
            );

        const conflictRatio =
            results.length > 0
                ? conflictedCities /
                    results.length
                : 0;

        let nationalStatus =
            "NORMAL";

        if (
            emergencyCities > 0 ||
            topRisk >= 75 ||
            topLightningThreat >= 80
        ) {

            nationalStatus =
                "EMERGENCY";

        } else if (
            topRisk >= 55 ||
            topLightningThreat >= 60
        ) {

            nationalStatus =
                "WARNING";

        } else if (
            topRisk >= 35 ||
            topLightningThreat >= 40
        ) {

            nationalStatus =
                "WATCH";

        }

        if (
            conflictRatio >
            0.50
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
            sortedByRisk
                .map(
                    result =>
                        result
                            ?.decisionGate
                )
                .find(
                    gate =>
                        gate
                            ?.escalation ===
                            true
                ) ||

            sortedByRisk
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

            topRiskResult
                ?.decisionGate ||

            null;

        const nationalAverageWeights =
            this.calculateNationalAverageWeights(
                results
            );

        const nationalSourceContributions =
            this.calculateNationalAverageContributions(
                results
            );

        return {

            cities:
                results.length,

            verifiedCities,

            supportedCities,

            uncertainCities,

            unverifiedCities,

            conflictedCities,

            insufficientDataCities,

            emergencyCities,

            manualReviewCities,

            simulationOnlyCities,

            averageAgreement,

            averageEvidenceScore,

            averageRainConsensus,

            averageRainAmount,

            averageVerifiedRisk,

            averageDataQuality,

            averageLightningThreat,

            nationalConfidence,

            topCity:
                topRiskResult
                    ?.city ||
                "--",

            topRisk:
                Math.round(
                    topRisk
                ),

            topLightningCity:
                topLightningResult
                    ?.city ||
                "--",

            topLightningThreat:
                Math.round(
                    topLightningThreat
                ),

            topLightningThreatLevel:
                topLightningResult
                    ?.lightningThreatLevel ||
                "NONE",

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

            nationalAverageWeights,

            nationalSourceContributions,

            cycleNumber:
                this.cycleNumber,

            timestamp:
                this.lastRunAt

        };

    },

    /* =====================================================
       NATIONAL CONTRIBUTION AVERAGES
       ===================================================== */

    calculateNationalAverageContributions(
        results = []
    ) {

        if (
            !Array.isArray(
                results
            ) ||
            !results.length
        ) {

            return {};

        }

        const totals =
            {};

        const counts =
            {};

        results.forEach(
            result => {

                Object.entries(
                    result
                        .sourceContributions ||
                    {}
                )
                .forEach(
                    (
                        [
                            sourceKey,
                            contribution
                        ]
                    ) => {

                        totals[
                            sourceKey
                        ] =
                            this.safeNumber(
                                totals[
                                    sourceKey
                                ],
                                0
                            ) +
                            this.safeNumber(
                                contribution
                                    ?.contribution,
                                0
                            );

                        counts[
                            sourceKey
                        ] =
                            this.safeNumber(
                                counts[
                                    sourceKey
                                ],
                                0
                            ) +
                            1;

                    }
                );

            }
        );

        const averages =
            {};

        Object.keys(
            totals
        )
        .forEach(
            sourceKey => {

                averages[
                    sourceKey
                ] =
                    Math.round(

                        totals[
                            sourceKey
                        ] /

                        Math.max(
                            1,
                            counts[
                                sourceKey
                            ]
                        )

                    );

            }
        );

        return averages;

    },
       /* =====================================================
       RENDERING CONTROLLER V31
       ===================================================== */

    render(
        results = [],
        summary = null
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
       NATIONAL SUMMARY PANEL V31
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
            this.normalizeStatus(

                summary
                    .nationalStatus ||
                "NO_DATA"

            );

        const statusClass =
            this.getNationalStatusClass(
                status
            );

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

        const strongestDecision =
            summary
                .strongestDecision ||
            {};

        const decisionAction =
            strongestDecision
                .action ||
            "HOLD";

        const decisionGateLevel =
            strongestDecision
                .gateLevel ||
            "BLOCK";

        const decisionClass =
            this.getDecisionGateClass(
                decisionGateLevel
            );

        const nationalAverageWeights =
            summary
                .nationalAverageWeights ||
            {};

        const nationalContributions =
            summary
                .nationalSourceContributions ||
            {};

        const weightRows =
            this.renderNationalWeightRows(
                nationalAverageWeights
            );

        const contributionRows =
            this.renderNationalContributionRows(
                nationalContributions
            );

        panel.innerHTML = `

            <div class="item ${statusClass}">

                <h3>

                    ${this.text(

                        "National Weather Intelligence Summary V31",

                        "الملخص الوطني لذكاء الطقس V31"

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

                <br>

                <b>

                    ${this.text(
                        "Emergency Cities",
                        "مدن التصعيد الطارئ"
                    )}:

                </b>

                ${this.safeNumber(
                    summary.emergencyCities
                )}

                <br>

                <b>

                    ${this.text(
                        "Manual Review Cities",
                        "مدن المراجعة اليدوية"
                    )}:

                </b>

                ${this.safeNumber(
                    summary.manualReviewCities
                )}

                <br>

                <b>

                    ${this.text(
                        "Simulation-Only Cities",
                        "مدن تعتمد على المحاكاة فقط"
                    )}:

                </b>

                ${this.safeNumber(
                    summary.simulationOnlyCities
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
                        "Average Rain Amount",
                        "متوسط كمية المطر"
                    )}:

                </b>

                ${this.safeNumber(
                    summary.averageRainAmount
                )} mm

                <br>

                <b>

                    ${this.text(
                        "Average Data Quality",
                        "متوسط جودة البيانات"
                    )}:

                </b>

                ${this.safeNumber(
                    summary.averageDataQuality
                )}%

                <br>

                <b>

                    ${this.text(
                        "Average Lightning Threat",
                        "متوسط تهديد البرق"
                    )}:

                </b>

                ${this.safeNumber(
                    summary.averageLightningThreat
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
                        "Average Verified Risk",
                        "متوسط الخطر المتحقق"
                    )}:

                </b>

                ${this.safeNumber(
                    summary.averageVerifiedRisk
                )}%

                <br><br>

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
                        "Highest Verified Risk",
                        "أعلى خطر متحقق"
                    )}:

                </b>

                ${this.safeNumber(
                    summary.topRisk
                )}%

                <br>

                <b>

                    ${this.text(
                        "Highest Lightning Threat City",
                        "المدينة الأعلى تهديدًا بالبرق"
                    )}:

                </b>

                ${this.escapeHtml(
                    summary.topLightningCity ||
                    "--"
                )}

                <br>

                <b>

                    ${this.text(
                        "Highest Lightning Threat",
                        "أعلى تهديد برق"
                    )}:

                </b>

                ${this.safeNumber(
                    summary.topLightningThreat
                )}%

                <br>

                <b>

                    ${this.text(
                        "Lightning Threat Level",
                        "مستوى تهديد البرق"
                    )}:

                </b>

                ${this.getStormThreatLabel(
                    summary
                        .topLightningThreatLevel ||
                    "NONE"
                )}

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

            <div class="item ${decisionClass}">

                <h3>

                    ${this.text(
                        "National Decision Gate",
                        "بوابة القرار الوطنية"
                    )}

                </h3>

                <b>

                    ${this.text(
                        "Gate Level",
                        "مستوى البوابة"
                    )}:

                </b>

                ${this.getDecisionGateLevelLabel(
                    decisionGateLevel
                )}

                <br>

                <b>

                    ${this.text(
                        "Action",
                        "الإجراء"
                    )}:

                </b>

                ${this.getDecisionActionLabel(
                    decisionAction
                )}

                <br>

                <b>

                    ${this.text(
                        "Decision Allowed",
                        "السماح بالقرار"
                    )}:

                </b>

                ${strongestDecision.allowed ===
                    true
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
                        "Manual Review",
                        "المراجعة اليدوية"
                    )}:

                </b>

                ${strongestDecision
                    .requiresManualReview ===
                    true
                    ? this.text(
                        "REQUIRED",
                        "مطلوبة"
                    )
                    : this.text(
                        "NOT REQUIRED",
                        "غير مطلوبة"
                    )
                }

                <br>

                <b>

                    ${this.text(
                        "Escalation",
                        "التصعيد"
                    )}:

                </b>

                ${strongestDecision
                    .escalation ===
                    true
                    ? this.text(
                        "ACTIVE",
                        "نشط"
                    )
                    : this.text(
                        "NO",
                        "لا"
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

                    this.translateDecisionReason(

                        strongestDecision.reason ||
                        "Evidence is not sufficient."

                    )

                )}

            </div>

            ${
                this.config
                    .development
                    .showDynamicWeights
                    ? `
                        <div class="item info">

                            <h3>

                                ${this.text(
                                    "National Dynamic Source Weights",
                                    "الأوزان الديناميكية الوطنية للمصادر"
                                )}

                            </h3>

                            ${
                                weightRows ||
                                this.text(
                                    "No dynamic weight data is available.",
                                    "لا تتوفر بيانات للأوزان الديناميكية."
                                )
                            }

                        </div>
                    `
                    : ""
            }

            ${
                this.config
                    .development
                    .showContributionDetails
                    ? `
                        <div class="item info">

                            <h3>

                                ${this.text(
                                    "National Source Contributions",
                                    "المساهمات الوطنية للمصادر"
                                )}

                            </h3>

                            ${
                                contributionRows ||
                                this.text(
                                    "No source contribution data is available.",
                                    "لا تتوفر بيانات لمساهمات المصادر."
                                )
                            }

                        </div>
                    `
                    : ""
            }

        `;

    },

    /* =====================================================
       NATIONAL WEIGHT ROWS
       ===================================================== */

    renderNationalWeightRows(
        weights = {}
    ) {

        const entries =
            Object.entries(
                weights
            )
            .filter(
                (
                    [
                        ,
                        value
                    ]
                ) =>
                    Number.isFinite(
                        Number(
                            value
                        )
                    )
            )
            .sort(
                (
                    first,
                    second
                ) =>
                    Number(
                        second[1]
                    ) -
                    Number(
                        first[1]
                    )
            );

        if (
            !entries.length
        ) {

            return "";

        }

        return entries
            .map(
                (
                    [
                        sourceKey,
                        weight
                    ]
                ) => {

                    const percent =
                        Number(
                            (
                                this.safeNumber(
                                    weight,
                                    0
                                ) *
                                100
                            )
                            .toFixed(
                                2
                            )
                        );

                    return `

                        <div class="verification-source-row">

                            <b>

                                ${this.escapeHtml(

                                    this.getSourceLabel(
                                        sourceKey,
                                        sourceKey
                                    )

                                )}:

                            </b>

                            ${percent}%

                        </div>

                    `;

                }
            )
            .join("");

    },

    /* =====================================================
       NATIONAL CONTRIBUTION ROWS
       ===================================================== */

    renderNationalContributionRows(
        contributions = {}
    ) {

        const entries =
            Object.entries(
                contributions
            )
            .filter(
                (
                    [
                        ,
                        value
                    ]
                ) =>
                    Number.isFinite(
                        Number(
                            value
                        )
                    )
            )
            .sort(
                (
                    first,
                    second
                ) =>
                    Number(
                        second[1]
                    ) -
                    Number(
                        first[1]
                    )
            );

        if (
            !entries.length
        ) {

            return "";

        }

        return entries
            .map(
                (
                    [
                        sourceKey,
                        contribution
                    ]
                ) => {

                    return `

                        <div class="verification-source-row">

                            <b>

                                ${this.escapeHtml(

                                    this.getSourceLabel(
                                        sourceKey,
                                        sourceKey
                                    )

                                )}:

                            </b>

                            ${this.safeNumber(
                                contribution,
                                0
                            )}%

                        </div>

                    `;

                }
            )
            .join("");

    },

    /* =====================================================
       DECISION GATE CLASS
       ===================================================== */

    getDecisionGateClass(
        gateLevel
    ) {

        const value =
            this.normalizeStatus(
                gateLevel
            );

        if (
            value ===
            "AUTO"
        ) {

            return "success";

        }

        if (
            value ===
            "REVIEW"
        ) {

            return "warning";

        }

        return "danger";

    },

    getDecisionGateLevelLabel(
        gateLevel
    ) {

        const value =
            this.normalizeStatus(
                gateLevel
            );

        const labels = {

            AUTO: {

                en:
                    "AUTOMATIC",

                ar:
                    "تلقائي"

            },

            REVIEW: {

                en:
                    "MANUAL REVIEW",

                ar:
                    "مراجعة يدوية"

            },

            BLOCK: {

                en:
                    "BLOCKED",

                ar:
                    "محظور"

            }

        };

        const item =
            labels[value] ||
            labels.BLOCK;

        return this.isArabic()
            ? item.ar
            : item.en;

    },
       /* =====================================================
       CITY-BY-CITY VERIFICATION PANEL V31
       ===================================================== */

    renderCitiesPanel(
        results = []
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

                    const firstRisk =
                        this.safeNumber(
                            first
                                ?.verifiedRisk,
                            0
                        );

                    const secondRisk =
                        this.safeNumber(
                            second
                                ?.verifiedRisk,
                            0
                        );

                    if (
                        secondRisk !==
                        firstRisk
                    ) {

                        return (
                            secondRisk -
                            firstRisk
                        );

                    }

                    return (

                        this.safeNumber(
                            second
                                ?.lightningThreat,
                            0
                        ) -

                        this.safeNumber(
                            first
                                ?.lightningThreat,
                            0
                        )

                    );

                }
            );

        panel.innerHTML =
            sortedResults
                .map(
                    result =>
                        this.renderCityVerificationCard(
                            result
                        )
                )
                .join("");

    },

    /* =====================================================
       CITY VERIFICATION CARD V31
       ===================================================== */

    renderCityVerificationCard(
        result = {}
    ) {

        const status =
            this.normalizeStatus(

                result.status ||
                "UNVERIFIED"

            );

        const className =
            this.getVerificationClass(
                status
            );

        const decision =
            result.decisionGate ||
            {};

        const conflict =
            result.conflict ||
            {

                detected:
                    false,

                level:
                    "NONE",

                score:
                    0,

                reasons:
                    [],

                translatedReasons:
                    [],

                sourceSpread:
                    0,

                qualitySpread:
                    0

            };

        const dynamicWeights =
            result.dynamicWeights ||
            {};

        const sourceContributions =
            result.sourceContributions ||
            {};

        const sources =
            result.sources ||
            {};

        const availableSourceNames =
            Object.values(
                sources
            )
            .filter(
                source =>
                    source
                        ?.available ===
                        true
            )
            .map(
                source =>
                    source.name
            )
            .filter(
                Boolean
            )
            .join(
                this.isArabic()
                    ? "، "
                    : ", "
            );

        const unavailableSourceNames =
            Object.values(
                sources
            )
            .filter(
                source =>
                    source
                        ?.available !==
                        true
            )
            .map(
                source =>
                    source.name
            )
            .filter(
                Boolean
            )
            .join(
                this.isArabic()
                    ? "، "
                    : ", "
            );

        const decisionGateLevel =
            decision.gateLevel ||
            "BLOCK";

        const decisionClass =
            this.getDecisionGateClass(
                decisionGateLevel
            );

        const lightningThreatLevel =
            result.lightningThreatLevel ||
            "NONE";

        const lightningThreatClass =
            this.getStormThreatClass(
                lightningThreatLevel
            );

        const lastUpdated =
            new Date(
                result.timestamp ||
                Date.now()
            )
            .toLocaleString(
                this.getLocale()
            );

        const conflictReasons =
            this.renderConflictReasons(
                conflict
            );

        const dynamicWeightRows =
            this.renderCityDynamicWeightRows(
                dynamicWeights,
                sourceContributions
            );

        const contributionRows =
            this.renderCityContributionRows(
                sourceContributions
            );

        const sourceQualityRows =
            this.renderCityDataQualityRows(
                sourceContributions
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

                ${
                    result.region
                        ? `
                            <b>

                                ${this.text(
                                    "Region",
                                    "المنطقة"
                                )}:

                            </b>

                            ${this.escapeHtml(
                                result.region
                            )}

                            <br>
                        `
                        : ""
                }

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
                    result.activeSourceCount,
                    0
                )}

                <br>

                <b>

                    ${this.text(
                        "Source Coverage",
                        "تغطية المصادر"
                    )}:

                </b>

                ${Math.round(

                    this.safeNumber(
                        result.sourceCoverage,
                        0
                    )

                )}%

                <br>

                <b>

                    ${this.text(
                        "Available Sources",
                        "المصادر المتاحة"
                    )}:

                </b>

                ${this.escapeHtml(

                    availableSourceNames ||

                    this.text(
                        "None",
                        "لا يوجد"
                    )

                )}

                ${
                    unavailableSourceNames
                        ? `
                            <br>

                            <b>

                                ${this.text(
                                    "Unavailable Sources",
                                    "المصادر غير المتاحة"
                                )}:

                            </b>

                            ${this.escapeHtml(
                                unavailableSourceNames
                            )}
                        `
                        : ""
                }

                <br><br>

                <b>

                    ${this.text(
                        "Source Agreement",
                        "اتفاق المصادر"
                    )}:

                </b>

                ${this.safeNumber(
                    result.agreement,
                    0
                )}%

                <br>

                <b>

                    ${this.text(
                        "Evidence Score",
                        "درجة الأدلة"
                    )}:

                </b>

                ${this.safeNumber(
                    result.evidenceScore,
                    0
                )}%

                <br>

                <b>

                    ${this.text(
                        "Final Confidence",
                        "الثقة النهائية"
                    )}:

                </b>

                ${this.safeNumber(
                    result.finalConfidence,
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
                    result.averageDataQuality,
                    0
                )}%

                <br>

                <b>

                    ${this.text(
                        "Rain Consensus",
                        "توافق احتمالات المطر"
                    )}:

                </b>

                ${this.safeNumber(
                    result.rainConsensus,
                    0
                )}%

                <br>

                <b>

                    ${this.text(
                        "Rain Amount Consensus",
                        "توافق كمية المطر"
                    )}:

                </b>

                ${this.safeNumber(
                    result.rainAmountConsensus,
                    0
                )} mm

                <br>

                <b>

                    ${this.text(
                        "Verified Risk",
                        "الخطر المتحقق"
                    )}:

                </b>

                ${this.safeNumber(
                    result.verifiedRisk,
                    0
                )}%

                <br>

                <b>

                    ${this.text(
                        "Source Spread",
                        "تشتت إشارات المصادر"
                    )}:

                </b>

                ${this.safeNumber(
                    result.sourceSpread,
                    0
                )}%

            </div>

            <div class="item ${lightningThreatClass}">

                <h3>

                    ${this.text(
                        "Lightning Intelligence",
                        "استخبارات البرق"
                    )}

                </h3>

                <b>

                    ${this.text(
                        "Storm Threat",
                        "تهديد العاصفة"
                    )}:

                </b>

                ${this.safeNumber(
                    result.lightningThreat,
                    0
                )}%

                <br>

                <b>

                    ${this.text(
                        "Storm Threat Level",
                        "مستوى تهديد العاصفة"
                    )}:

                </b>

                ${this.getStormThreatLabel(
                    lightningThreatLevel
                )}

                ${this.renderCityLightningDetails(
                    sources.lightning
                )}

            </div>

            <div class="item ${decisionClass}">

                <h3>

                    ${this.text(
                        "Decision Gate",
                        "بوابة القرار"
                    )}

                </h3>

                <b>

                    ${this.text(
                        "Gate Level",
                        "مستوى البوابة"
                    )}:

                </b>

                ${this.getDecisionGateLevelLabel(
                    decisionGateLevel
                )}

                <br>

                <b>

                    ${this.text(
                        "Action",
                        "الإجراء"
                    )}:

                </b>

                ${this.getDecisionActionLabel(

                    decision.action ||
                    "HOLD"

                )}

                <br>

                <b>

                    ${this.text(
                        "Decision Allowed",
                        "السماح بالقرار"
                    )}:

                </b>

                ${decision.allowed ===
                    true
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
                        "Manual Review",
                        "المراجعة اليدوية"
                    )}:

                </b>

                ${decision.requiresManualReview ===
                    true
                    ? this.text(
                        "REQUIRED",
                        "مطلوبة"
                    )
                    : this.text(
                        "NOT REQUIRED",
                        "غير مطلوبة"
                    )
                }

                <br>

                <b>

                    ${this.text(
                        "Escalation",
                        "التصعيد"
                    )}:

                </b>

                ${decision.escalation ===
                    true
                    ? this.text(
                        "ACTIVE",
                        "نشط"
                    )
                    : this.text(
                        "NO",
                        "لا"
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

                    this.translateDecisionReason(

                        decision.reason ||
                        "Evidence is not sufficient."

                    )

                )}

                <br>

                <b>

                    ${this.text(
                        "Real Sources",
                        "المصادر الحقيقية"
                    )}:

                </b>

                ${this.safeNumber(
                    decision.realSourceCount,
                    0
                )}

                <br>

                <b>

                    ${this.text(
                        "Simulated Sources",
                        "مصادر المحاكاة"
                    )}:

                </b>

                ${this.safeNumber(
                    decision.simulatedSourceCount,
                    0
                )}

                <br>

                <b>

                    ${this.text(
                        "Simulation Only",
                        "محاكاة فقط"
                    )}:

                </b>

                ${decision.simulationOnly ===
                    true
                    ? this.text(
                        "YES",
                        "نعم"
                    )
                    : this.text(
                        "NO",
                        "لا"
                    )
                }

            </div>

            <div class="item ${
                conflict.detected === true
                    ? "warning"
                    : "success"
            }">

                <h3>

                    ${this.text(
                        "Conflict Intelligence",
                        "ذكاء تعارض المصادر"
                    )}

                </h3>

                <b>

                    ${this.text(
                        "Conflict Detected",
                        "تم اكتشاف تعارض"
                    )}:

                </b>

                ${conflict.detected ===
                    true
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
                        "Conflict Score",
                        "درجة التعارض"
                    )}:

                </b>

                ${this.safeNumber(
                    conflict.score,
                    0
                )}%

                <br>

                <b>

                    ${this.text(
                        "Source Spread",
                        "تشتت المصادر"
                    )}:

                </b>

                ${this.safeNumber(
                    conflict.sourceSpread,
                    0
                )}%

                <br>

                <b>

                    ${this.text(
                        "Data Quality Spread",
                        "تشتت جودة البيانات"
                    )}:

                </b>

                ${this.safeNumber(
                    conflict.qualitySpread,
                    0
                )}%

                ${conflictReasons}

            </div>

            ${
                this.config
                    .development
                    .showDynamicWeights
                    ? `
                        <div class="item info">

                            <h3>

                                ${this.text(
                                    "Dynamic Source Weights",
                                    "الأوزان الديناميكية للمصادر"
                                )}

                            </h3>

                            ${
                                dynamicWeightRows ||
                                this.text(
                                    "No dynamic weight data is available.",
                                    "لا تتوفر بيانات للأوزان الديناميكية."
                                )
                            }

                        </div>
                    `
                    : ""
            }

            ${
                this.config
                    .development
                    .showContributionDetails
                    ? `
                        <div class="item info">

                            <h3>

                                ${this.text(
                                    "Source Contributions",
                                    "مساهمات المصادر"
                                )}

                            </h3>

                            ${
                                contributionRows ||
                                this.text(
                                    "No source contribution data is available.",
                                    "لا تتوفر بيانات لمساهمات المصادر."
                                )
                            }

                        </div>
                    `
                    : ""
            }

            ${
                this.config
                    .development
                    .showDataQuality
                    ? `
                        <div class="item info">

                            <h3>

                                ${this.text(
                                    "Source Data Quality",
                                    "جودة بيانات المصادر"
                                )}

                            </h3>

                            ${
                                sourceQualityRows ||
                                this.text(
                                    "No source quality data is available.",
                                    "لا تتوفر بيانات لجودة المصادر."
                                )
                            }

                        </div>
                    `
                    : ""
            }

            <div class="item info">

                <b>

                    ${this.text(
                        "Last Updated",
                        "آخر تحديث"
                    )}:

                </b>

                ${lastUpdated}

            </div>

        `;

    },

    /* =====================================================
       STORM THREAT CLASS
       ===================================================== */

    getStormThreatClass(
        threatLevel
    ) {

        const value =
            this.normalizeStatus(
                threatLevel
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
       /* =====================================================
       CONFLICT REASONS RENDERER
       ===================================================== */

    renderConflictReasons(
        conflict = {}
    ) {

        const reasons =
            Array.isArray(
                conflict.translatedReasons
            )
                ? conflict.translatedReasons
                : Array.isArray(
                    conflict.reasons
                )
                    ? conflict.reasons.map(
                        reason =>
                            this.translateConflictReason(
                                reason
                            )
                    )
                    : [];

        if (
            !reasons.length
        ) {

            return "";

        }

        return `

            <br><br>

            <b>

                ${this.text(
                    "Conflict Reasons",
                    "أسباب التعارض"
                )}:

            </b>

            <ul class="verification-reasons">

                ${
                    reasons
                        .map(
                            reason => `

                                <li>

                                    ${this.escapeHtml(
                                        reason
                                    )}

                                </li>

                            `
                        )
                        .join("")
                }

            </ul>

        `;

    },

    /* =====================================================
       CITY DYNAMIC WEIGHT ROWS
       ===================================================== */

    renderCityDynamicWeightRows(
        weights = {},
        contributions = {}
    ) {

        const entries =
            Object.entries(
                weights
            )
            .filter(
                (
                    [
                        ,
                        value
                    ]
                ) =>
                    Number.isFinite(
                        Number(
                            value
                        )
                    )
            )
            .sort(
                (
                    first,
                    second
                ) =>
                    Number(
                        second[1]
                    ) -
                    Number(
                        first[1]
                    )
            );

        if (
            !entries.length
        ) {

            return "";

        }

        return entries
            .map(
                (
                    [
                        sourceKey,
                        weight
                    ]
                ) => {

                    const percent =
                        Number(
                            (
                                this.safeNumber(
                                    weight,
                                    0
                                ) *
                                100
                            )
                            .toFixed(
                                2
                            )
                        );

                    const contribution =
                        contributions[
                            sourceKey
                        ] ||
                        {};

                    const qualityLevel =
                        contribution
                            .dataQualityLevel ||
                        contribution
                            .quality
                            ?.level ||
                        "UNUSABLE";

                    return `

                        <div class="verification-source-row">

                            <b>

                                ${this.escapeHtml(

                                    this.getSourceLabel(
                                        sourceKey,
                                        sourceKey
                                    )

                                )}:

                            </b>

                            ${percent}%

                            <span class="verification-meta">

                                (${this.getDataQualityLabel(
                                    qualityLevel
                                )})

                            </span>

                        </div>

                    `;

                }
            )
            .join("");

    },

    /* =====================================================
       CITY CONTRIBUTION ROWS
       ===================================================== */

    renderCityContributionRows(
        contributions = {}
    ) {

        const entries =
            Object.entries(
                contributions
            )
            .filter(
                (
                    [
                        ,
                        value
                    ]
                ) =>
                    value &&
                    typeof value ===
                        "object"
            )
            .sort(
                (
                    first,
                    second
                ) =>

                    this.safeNumber(
                        second[1]
                            ?.contribution,
                        0
                    ) -

                    this.safeNumber(
                        first[1]
                            ?.contribution,
                        0
                    )
            );

        if (
            !entries.length
        ) {

            return "";

        }

        return entries
            .map(
                (
                    [
                        sourceKey,
                        contribution
                    ]
                ) => {

                    const contributionScore =
                        this.safeNumber(
                            contribution
                                ?.contribution,
                            0
                        );

                    const influenceScore =
                        this.safeNumber(
                            contribution
                                ?.influenceScore,
                            0
                        );

                    const effectiveWeightPercent =
                        this.safeNumber(

                            contribution
                                ?.effectiveWeightPercent,

                            this.safeNumber(
                                contribution
                                    ?.effectiveWeight,
                                0
                            ) *
                            100

                        );

                    return `

                        <div class="verification-source-row">

                            <b>

                                ${this.escapeHtml(

                                    this.getSourceLabel(
                                        sourceKey,
                                        sourceKey
                                    )

                                )}:

                            </b>

                            ${Math.round(
                                contributionScore
                            )}%

                            <br>

                            <span class="verification-meta">

                                ${this.text(
                                    "Weight",
                                    "الوزن"
                                )}:
                                ${Number(
                                    effectiveWeightPercent
                                )
                                .toFixed(
                                    2
                                )}%

                                &nbsp;|&nbsp;

                                ${this.text(
                                    "Influence",
                                    "التأثير"
                                )}:
                                ${Number(
                                    influenceScore
                                )
                                .toFixed(
                                    2
                                )}

                            </span>

                        </div>

                    `;

                }
            )
            .join("");

    },

    /* =====================================================
       CITY DATA QUALITY ROWS
       ===================================================== */

    renderCityDataQualityRows(
        contributions = {}
    ) {

        const entries =
            Object.entries(
                contributions
            )
            .filter(
                (
                    [
                        ,
                        value
                    ]
                ) =>
                    value &&
                    typeof value ===
                        "object"
            )
            .sort(
                (
                    first,
                    second
                ) =>

                    this.safeNumber(
                        second[1]
                            ?.dataQualityScore,
                        second[1]
                            ?.quality
                            ?.score
                    ) -

                    this.safeNumber(
                        first[1]
                            ?.dataQualityScore,
                        first[1]
                            ?.quality
                            ?.score
                    )
            );

        if (
            !entries.length
        ) {

            return "";

        }

        return entries
            .map(
                (
                    [
                        sourceKey,
                        contribution
                    ]
                ) => {

                    const quality =
                        contribution
                            ?.quality ||
                        {};

                    const score =
                        this.safeNumber(

                            contribution
                                ?.dataQualityScore,

                            quality.score

                        );

                    const level =
                        contribution
                            ?.dataQualityLevel ||
                        quality.level ||
                        "UNUSABLE";

                    return `

                        <div class="verification-source-row">

                            <b>

                                ${this.escapeHtml(

                                    this.getSourceLabel(
                                        sourceKey,
                                        sourceKey
                                    )

                                )}:

                            </b>

                            ${Math.round(
                                score
                            )}%

                            — ${this.getDataQualityLabel(
                                level
                            )}

                            <br>

                            <span class="verification-meta">

                                ${this.text(
                                    "Freshness",
                                    "الحداثة"
                                )}:
                                ${this.safeNumber(
                                    quality.freshness,
                                    0
                                )}%

                                &nbsp;|&nbsp;

                                ${this.text(
                                    "Completeness",
                                    "الاكتمال"
                                )}:
                                ${this.safeNumber(
                                    quality.completeness,
                                    0
                                )}%

                                &nbsp;|&nbsp;

                                ${this.text(
                                    "Reliability",
                                    "الاعتمادية"
                                )}:
                                ${this.safeNumber(
                                    quality.reliability,
                                    0
                                )}%

                                <br>

                                ${this.text(
                                    "Spatial Relevance",
                                    "الملاءمة المكانية"
                                )}:
                                ${this.safeNumber(
                                    quality.spatialRelevance,
                                    0
                                )}%

                                &nbsp;|&nbsp;

                                ${this.text(
                                    "Temporal Continuity",
                                    "الاستمرارية الزمنية"
                                )}:
                                ${this.safeNumber(
                                    quality.temporalContinuity,
                                    0
                                )}%

                                &nbsp;|&nbsp;

                                ${this.text(
                                    "Technical Health",
                                    "السلامة التقنية"
                                )}:
                                ${this.safeNumber(
                                    quality.technicalHealth,
                                    0
                                )}%

                            </span>

                        </div>

                    `;

                }
            )
            .join("");

    },

    /* =====================================================
       CITY LIGHTNING DETAILS
       ===================================================== */

    renderCityLightningDetails(
        source = {}
    ) {

        if (
            !source ||
            source.available !==
                true
        ) {

            return `

                <br><br>

                <span class="verification-meta">

                    ${this.text(
                        "Lightning data is unavailable.",
                        "بيانات البرق غير متاحة."
                    )}

                </span>

            `;

        }

        const details =
            source.details ||
            {};

        const nearestStrikeKm =
            this.firstNullableNumber(

                details.nearestStrikeKm,

                details.distanceKm

            );

        const distanceText =
            nearestStrikeKm ===
                null
                ? this.text(
                    "Unknown",
                    "غير معروف"
                )
                : `${Number(
                    nearestStrikeKm
                )
                .toFixed(
                    1
                )} km`;

        const simulated =
            source.simulated ===
                true ||
            details.simulated ===
                true;

        return `

            <br><br>

            <b>

                ${this.text(
                    "Source Status",
                    "حالة المصدر"
                )}:

            </b>

            ${this.getStatusLabel(
                source.status
            )}

            <br>

            <b>

                ${this.text(
                    "Mode",
                    "الوضع"
                )}:

            </b>

            ${simulated
                ? this.getStatusLabel(
                    "SIMULATION"
                )
                : this.escapeHtml(
                    details.mode ||
                    "LIVE"
                )
            }

            <br>

            <b>

                ${this.text(
                    "Lightning Strikes",
                    "عدد ضربات البرق"
                )}:

            </b>

            ${this.safeNumber(
                details.strikes,
                0
            )}

            <br>

            <b>

                ${this.text(
                    "Cloud-to-Ground",
                    "برق سحاب إلى أرض"
                )}:

            </b>

            ${this.safeNumber(
                details.cloudToGround,
                0
            )}

            <br>

            <b>

                ${this.text(
                    "Intra-Cloud",
                    "برق داخل السحب"
                )}:

            </b>

            ${this.safeNumber(
                details.intraCloud,
                0
            )}

            <br>

            <b>

                ${this.text(
                    "Nearest Strike",
                    "أقرب ضربة"
                )}:

            </b>

            ${distanceText}

            <br>

            <b>

                ${this.text(
                    "Strike Density",
                    "كثافة البرق"
                )}:

            </b>

            ${Number(
                this.safeNumber(
                    details.strikeDensity,
                    0
                )
            )
            .toFixed(
                2
            )}

            <br>

            <b>

                ${this.text(
                    "Activity Score",
                    "درجة النشاط"
                )}:

            </b>

            ${this.safeNumber(
                details.activityScore,
                0
            )}%

            <br>

            <b>

                ${this.text(
                    "Trend",
                    "الاتجاه"
                )}:

            </b>

            ${this.translateLightningTrend(
                details.trend
            )}

            <br>

            <b>

                ${this.text(
                    "Lightning Risk",
                    "خطر البرق"
                )}:

            </b>

            ${this.escapeHtml(
                details.riskLevel ||
                "UNKNOWN"
            )}

            <br>

            <b>

                ${this.text(
                    "Risk Score",
                    "درجة الخطر"
                )}:

            </b>

            ${this.safeNumber(
                details.riskScore,
                0
            )}%

            <br>

            <b>

                ${this.text(
                    "Storm Threat",
                    "تهديد العاصفة"
                )}:

            </b>

            ${this.safeNumber(
                details.stormThreat,
                0
            )}%

            <br>

            <b>

                ${this.text(
                    "Storm Threat Level",
                    "مستوى تهديد العاصفة"
                )}:

            </b>

            ${this.getStormThreatLabel(
                details.stormThreatLevel ||
                "NONE"
            )}

            <br>

            <b>

                ${this.text(
                    "Freshness",
                    "حداثة البيانات"
                )}:

            </b>

            ${this.safeNumber(
                details.freshnessScore,
                0
            )}%

            <br>

            <b>

                ${this.text(
                    "Data Age",
                    "عمر البيانات"
                )}:

            </b>

            ${this.safeNumber(
                details.dataAgeMinutes,
                0
            )}
            ${this.text(
                " min",
                " دقيقة"
            )}

            <br>

            <b>

                ${this.text(
                    "Confidence",
                    "الثقة"
                )}:

            </b>

            ${this.safeNumber(
                source.confidence,
                details.confidence
            )}%

            ${
                simulated
                    ? `

                        <br><br>

                        <span class="verification-warning">

                            ${this.text(

                                "Simulation data is not a live lightning observation.",

                                "بيانات المحاكاة ليست رصدًا حيًا للبرق."

                            )}

                        </span>

                    `
                    : ""
            }

        `;

    },

    /* =====================================================
       LIGHTNING TREND TRANSLATION
       ===================================================== */

    translateLightningTrend(
        trend
    ) {

        const value =
            this.normalizeStatus(
                trend ||
                "UNKNOWN"
            );

        const labels = {

            RAPIDLY_INCREASING: {

                en:
                    "RAPIDLY INCREASING",

                ar:
                    "يتصاعد بسرعة"

            },

            RISING: {

                en:
                    "RISING",

                ar:
                    "متصاعد"

            },

            INCREASING: {

                en:
                    "INCREASING",

                ar:
                    "متزايد"

            },

            ACTIVE: {

                en:
                    "ACTIVE",

                ar:
                    "نشط"

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

            DECREASING: {

                en:
                    "DECREASING",

                ar:
                    "متناقص"

            },

            NO_ACTIVITY: {

                en:
                    "NO ACTIVITY",

                ar:
                    "لا يوجد نشاط"

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
       SOURCE MATRIX V31
       ===================================================== */

    renderSourceMatrix(
        results = []
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
            this.getTopResult(
                results
            );

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

        const dynamicWeights =
            topResult.dynamicWeights ||
            {};

        const contributions =
            topResult.sourceContributions ||
            {};

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

                    return this.renderSourceMatrixCard({

                        sourceKey,

                        source,

                        dynamicWeight:
                            dynamicWeights[
                                sourceKey
                            ],

                        contribution:
                            contributions[
                                sourceKey
                            ]

                    });

                }
            )
            .join("");

        panel.innerHTML = `

            <div class="item info">

                <h3>

                    ${this.text(
                        "Verification Source Matrix V31",
                        "مصفوفة مصادر التحقق V31"
                    )}

                </h3>

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
                        "Verification Status",
                        "حالة التحقق"
                    )}:

                </b>

                ${this.getStatusLabel(
                    topResult.status
                )}

                <br>

                <b>

                    ${this.text(
                        "Active Sources",
                        "المصادر النشطة"
                    )}:

                </b>

                ${this.safeNumber(
                    topResult.activeSourceCount,
                    0
                )}

                <br>

                <b>

                    ${this.text(
                        "Source Coverage",
                        "تغطية المصادر"
                    )}:

                </b>

                ${Math.round(

                    this.safeNumber(
                        topResult.sourceCoverage,
                        0
                    )

                )}%

                <br>

                <b>

                    ${this.text(
                        "Average Data Quality",
                        "متوسط جودة البيانات"
                    )}:

                </b>

                ${this.safeNumber(
                    topResult.averageDataQuality,
                    0
                )}%

                <br>

                <b>

                    ${this.text(
                        "Evidence Score",
                        "درجة الأدلة"
                    )}:

                </b>

                ${this.safeNumber(
                    topResult.evidenceScore,
                    0
                )}%

                <br>

                <b>

                    ${this.text(
                        "Final Confidence",
                        "الثقة النهائية"
                    )}:

                </b>

                ${this.safeNumber(
                    topResult.finalConfidence,
                    0
                )}%

                <br>

                <b>

                    ${this.text(
                        "Verified Risk",
                        "الخطر المتحقق"
                    )}:

                </b>

                ${this.safeNumber(
                    topResult.verifiedRisk,
                    0
                )}%

                <br>

                <b>

                    ${this.text(
                        "Lightning Threat",
                        "تهديد البرق"
                    )}:

                </b>

                ${this.safeNumber(
                    topResult.lightningThreat,
                    0
                )}%

            </div>

            ${sourceCards}

        `;

    },

    /* =====================================================
       SOURCE MATRIX CARD
       ===================================================== */

    renderSourceMatrixCard({

        sourceKey,

        source = {},

        dynamicWeight = 0,

        contribution = {}

    }) {

        const available =
            source.available ===
            true;

        const simulated =
            source.simulated ===
            true;

        const className =
            available
                ? simulated
                    ? "warning"
                    : "success"
                : "warning";

        const quality =
            contribution
                ?.quality ||
            this.calculateSourceDataQuality(
                source
            );

        const effectiveWeight =
            this.safeNumber(

                contribution
                    ?.effectiveWeight,

                dynamicWeight

            );

        const effectiveWeightPercent =
            this.safeNumber(

                contribution
                    ?.effectiveWeightPercent,

                effectiveWeight *
                100

            );

        const contributionScore =
            this.safeNumber(

                contribution
                    ?.contribution,

                0

            );

        const influenceScore =
            this.safeNumber(

                contribution
                    ?.influenceScore,

                source.signalScore *
                effectiveWeight

            );

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
                        "Mode",
                        "الوضع"
                    )}:

                </b>

                ${simulated
                    ? this.getStatusLabel(
                        "SIMULATION"
                    )
                    : this.escapeHtml(

                        source.details
                            ?.mode ||
                        source.mode ||
                        "LIVE"

                    )
                }

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
                        "Confidence",
                        "الثقة"
                    )}:

                </b>

                ${this.safeNumber(
                    source.confidence,
                    0
                )}%

                <br>

                <b>

                    ${this.text(
                        "Signal Score",
                        "درجة الإشارة"
                    )}:

                </b>

                ${this.safeNumber(
                    source.signalScore,
                    0
                )}%

                <br>

                <b>

                    ${this.text(
                        "Rain Probability",
                        "احتمال المطر"
                    )}:

                </b>

                ${this.safeNumber(
                    source.rainProbability,
                    0
                )}%

                <br>

                <b>

                    ${this.text(
                        "Rain Amount",
                        "كمية المطر"
                    )}:

                </b>

                ${this.safeNumber(
                    source.rainAmount,
                    0
                )} mm

                <br><br>

                <b>

                    ${this.text(
                        "Dynamic Weight",
                        "الوزن الديناميكي"
                    )}:

                </b>

                ${Number(
                    effectiveWeightPercent
                )
                .toFixed(
                    2
                )}%

                <br>

                <b>

                    ${this.text(
                        "Evidence Contribution",
                        "مساهمة المصدر في الأدلة"
                    )}:

                </b>

                ${Math.round(
                    contributionScore
                )}%

                <br>

                <b>

                    ${this.text(
                        "Influence Score",
                        "درجة التأثير"
                    )}:

                </b>

                ${Number(
                    influenceScore
                )
                .toFixed(
                    2
                )}

                <br><br>

                <b>

                    ${this.text(
                        "Data Quality Index",
                        "مؤشر جودة البيانات"
                    )}:

                </b>

                ${this.safeNumber(
                    quality.score,
                    0
                )}%

                <br>

                <b>

                    ${this.text(
                        "Data Quality Level",
                        "مستوى جودة البيانات"
                    )}:

                </b>

                ${this.getDataQualityLabel(
                    quality.level
                )}

                <br>

                <b>

                    ${this.text(
                        "Freshness",
                        "الحداثة"
                    )}:

                </b>

                ${this.safeNumber(
                    quality.freshness,
                    0
                )}%

                <br>

                <b>

                    ${this.text(
                        "Completeness",
                        "الاكتمال"
                    )}:

                </b>

                ${this.safeNumber(
                    quality.completeness,
                    0
                )}%

                <br>

                <b>

                    ${this.text(
                        "Spatial Relevance",
                        "الملاءمة المكانية"
                    )}:

                </b>

                ${this.safeNumber(
                    quality.spatialRelevance,
                    0
                )}%

                <br>

                <b>

                    ${this.text(
                        "Temporal Continuity",
                        "الاستمرارية الزمنية"
                    )}:

                </b>

                ${this.safeNumber(
                    quality.temporalContinuity,
                    0
                )}%

                <br>

                <b>

                    ${this.text(
                        "Technical Health",
                        "السلامة التقنية"
                    )}:

                </b>

                ${this.safeNumber(
                    quality.technicalHealth,
                    0
                )}%

                ${this.renderSourceDetails(

                    sourceKey,

                    source.details ||
                    {}

                )}

                ${
                    source.error
                        ? `

                            <br><br>

                            <b>

                                ${this.text(
                                    "Error",
                                    "الخطأ"
                                )}:

                            </b>

                            ${this.escapeHtml(
                                source.error
                            )}

                        `
                        : ""
                }

                ${
                    simulated
                        ? `

                            <br><br>

                            <span class="verification-warning">

                                ${this.text(

                                    "Simulation data is used with reduced operational weight.",

                                    "تُستخدم بيانات المحاكاة بوزن تشغيلي مخفض."

                                )}

                            </span>

                        `
                        : ""
                }

            </div>

        `;

    },

    /* =====================================================
       SOURCE DETAILS V31
       ===================================================== */

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
                value ===
                    null ||
                value ===
                    undefined ||
                value ===
                    ""
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

            pushRow(

                "Official Mode",

                "الوضع الرسمي",

                details.mode ||
                "OFFICIAL"

            );

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
                    details.intensity,
                    0
                )

            );

            pushRow(

                "Movement Confidence",

                "ثقة حركة السحب",

                this.safeNumber(
                    details.movementConfidence,
                    0
                ),

                "%"

            );

            pushRow(

                "Frame Age",

                "عمر إطار الرادار",

                this.safeNumber(
                    details.frameAgeMinutes,
                    0
                ),

                this.text(
                    " min",
                    " دقيقة"
                )

            );

            pushRow(

                "Point Signal Available",

                "توفر إشارة نقطية",

                details.pointSignalAvailable
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

                "Visual Verification Only",

                "تحقق بصري فقط",

                details.visualVerificationOnly
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

                "Direction",

                "الاتجاه",

                details.direction ||
                "--"

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
                    details.cloudCover,
                    0
                ),

                "%"

            );

            pushRow(

                "Convection Score",

                "درجة الحمل الحراري",

                this.safeNumber(
                    details.convectionScore,
                    0
                ),

                "%"

            );

            pushRow(

                "Cloud Temperature",

                "درجة حرارة السحب",

                this.safeNumber(
                    details.cloudTemperature,
                    0
                ),

                " °C"

            );

            pushRow(

                "Storm Cell Score",

                "درجة الخلية العاصفية",

                this.safeNumber(
                    details.stormCellScore,
                    0
                ),

                "%"

            );

            pushRow(

                "Storm Cells",

                "عدد الخلايا العاصفية",

                this.safeNumber(
                    details.stormCells,
                    0
                )

            );

            pushRow(

                "Freshness Score",

                "درجة الحداثة",

                this.safeNumber(
                    details.freshnessScore,
                    0
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
                    details.strikes,
                    0
                )

            );

            pushRow(

                "Cloud-to-Ground",

                "برق سحاب إلى أرض",

                this.safeNumber(
                    details.cloudToGround,
                    0
                )

            );

            pushRow(

                "Intra-Cloud",

                "برق داخل السحب",

                this.safeNumber(
                    details.intraCloud,
                    0
                )

            );

            const nearestStrike =
                this.firstNullableNumber(

                    details.nearestStrikeKm,

                    details.distanceKm

                );

            if (
                nearestStrike !==
                null
            ) {

                pushRow(

                    "Nearest Strike",

                    "أقرب ضربة",

                    Number(
                        nearestStrike
                    )
                    .toFixed(
                        1
                    ),

                    " km"

                );

            }

            pushRow(

                "Strike Density",

                "كثافة البرق",

                Number(

                    this.safeNumber(
                        details.strikeDensity,
                        0
                    )

                )
                .toFixed(
                    2
                )

            );

            pushRow(

                "Activity Score",

                "درجة نشاط البرق",

                this.safeNumber(
                    details.activityScore,
                    0
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

            pushRow(

                "Risk Level",

                "مستوى الخطر",

                details.riskLevel ||
                "UNKNOWN"

            );

            pushRow(

                "Risk Score",

                "درجة الخطر",

                this.safeNumber(
                    details.riskScore,
                    0
                ),

                "%"

            );

            pushRow(

                "Storm Threat",

                "تهديد العاصفة",

                this.safeNumber(
                    details.stormThreat,
                    0
                ),

                "%"

            );

            pushRow(

                "Storm Threat Level",

                "مستوى تهديد العاصفة",

                this.getStormThreatLabel(

                    details.stormThreatLevel ||
                    "NONE"

                )

            );

            pushRow(

                "Data Age",

                "عمر البيانات",

                this.safeNumber(
                    details.dataAgeMinutes,
                    0
                ),

                this.text(
                    " min",
                    " دقيقة"
                )

            );

            pushRow(

                "Freshness Score",

                "درجة الحداثة",

                this.safeNumber(
                    details.freshnessScore,
                    0
                ),

                "%"

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
                    details.humidity,
                    0
                ),

                "%"

            );

            pushRow(

                "Cloud Cover",

                "الغطاء السحابي",

                this.safeNumber(
                    details.cloudCover,
                    0
                ),

                "%"

            );

            pushRow(

                "Wind Speed",

                "سرعة الرياح",

                this.safeNumber(
                    details.windSpeed,
                    0
                ),

                " km/h"

            );

            pushRow(

                "Pressure",

                "الضغط الجوي",

                this.safeNumber(
                    details.pressure,
                    0
                ),

                " hPa"

            );

            pushRow(

                "Freshness Score",

                "درجة الحداثة",

                this.safeNumber(
                    details.freshnessScore,
                    0
                ),

                "%"

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
                    details.weatherScore,
                    0
                ),

                "%"

            );

            pushRow(

                "Rain Risk",

                "خطر المطر",

                this.safeNumber(
                    details.rainRisk,
                    0
                ),

                "%"

            );

            pushRow(

                "Storm Risk",

                "خطر العاصفة",

                this.safeNumber(
                    details.stormRisk,
                    0
                ),

                "%"

            );

            pushRow(

                "Flood Index",

                "مؤشر السيول",

                this.safeNumber(
                    details.floodIndex,
                    0
                ),

                "%"

            );

            pushRow(

                "Road Risk",

                "خطر الطرق",

                this.safeNumber(
                    details.roadRisk,
                    0
                ),

                "%"

            );

            pushRow(

                "Final Risk",

                "الخطر النهائي",

                this.safeNumber(
                    details.finalRisk,
                    0
                ),

                "%"

            );

            pushRow(

                "Model Confidence",

                "ثقة النموذج",

                this.safeNumber(
                    details.confidence,
                    0
                ),

                "%"

            );

            if (
                Array.isArray(
                    details.explanation
                ) &&
                details.explanation.length
            ) {

                pushRow(

                    "AI Explanation",

                    "تفسير الذكاء الاصطناعي",

                    details.explanation
                        .join(
                            this.isArabic()
                                ? "، "
                                : ", "
                        )

                );

            }

        }

        return rows.join("");

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

        const dataQualityTop =
            document.getElementById(
                "verificationDataQualityTop"
            );

        const lightningThreatTop =
            document.getElementById(
                "verificationLightningThreatTop"
            );

        if (
            agreementTop
        ) {

            agreementTop.textContent =
                `${this.safeNumber(
                    summary.averageAgreement,
                    0
                )}%`;

        }

        if (
            evidenceTop
        ) {

            evidenceTop.textContent =
                `${this.safeNumber(
                    summary.averageEvidenceScore,
                    0
                )}%`;

        }

        if (
            confidenceTop
        ) {

            confidenceTop.textContent =
                `${this.safeNumber(
                    summary.nationalConfidence,
                    0
                )}%`;

        }

        if (
            confidence
        ) {

            confidence.textContent =
                `${this.safeNumber(
                    summary.nationalConfidence,
                    0
                )}%`;

        }

        if (
            dataQualityTop
        ) {

            dataQualityTop.textContent =
                `${this.safeNumber(
                    summary.averageDataQuality,
                    0
                )}%`;

        }

        if (
            lightningThreatTop
        ) {

            lightningThreatTop.textContent =
                `${this.safeNumber(
                    summary.averageLightningThreat,
                    0
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

    /* =====================================================
       EMPTY STATE
       ===================================================== */

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

        window.RG30.latestVerification =
            results;

        window.RG30.latestNationalSummary =
            summary;

        window.RG31.latestVerification =
            results;

        window.RG31.latestNationalSummary =
            summary;

        window.dispatchEvent(

            new CustomEvent(

                "rg31:verification-completed",

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

            window.RG29.verificationResults =
                results;

            window.RG29.verificationSummary =
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
                            "V31 National Weather Intelligence Verification",

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

                        averageDataQuality:
                            summary
                                ?.averageDataQuality ||
                            0,

                        averageLightningThreat:
                            summary
                                ?.averageLightningThreat ||
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

                        topLightningCity:
                            summary
                                ?.topLightningCity ||
                            "--",

                        topLightningThreat:
                            summary
                                ?.topLightningThreat ||
                            0,

                        timestamp:
                            this.lastRunAt

                    });

                }

            } catch (error) {

                console.warn(
                    "V31 database cycle save skipped:",
                    error
                );

            }

        }

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

    firstNumber(
        ...values
    ) {

        for (
            const value of values
        ) {

            if (
                value ===
                    null ||
                value ===
                    undefined ||
                value ===
                    ""
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

        return 0;

    },

    firstNullableNumber(
        ...values
    ) {

        for (
            const value of values
        ) {

            if (
                value ===
                    null ||
                value ===
                    undefined ||
                value ===
                    ""
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

    /* =====================================================
       TIME HELPERS
       ===================================================== */

    calculateAgeMinutes(
        timestamp
    ) {

        if (
            !timestamp
        ) {

            return 0;

        }

        const time =
            new Date(
                timestamp
            )
            .getTime();

        if (
            !Number.isFinite(
                time
            )
        ) {

            return 0;

        }

        return Math.max(

            0,

            Math.round(

                (
                    Date.now() -
                    time
                ) /
                60000

            )

        );

    },

    /* =====================================================
       SOURCE KEY DETECTION
       ===================================================== */

    detectSourceKey(
        source = {}
    ) {

        const directKey =
            source.key ||
            source.sourceKey ||
            source.adapterKey ||
            "";

        const normalizedKey =
            String(
                directKey
            )
                .trim();

        if (
            normalizedKey
        ) {

            return normalizedKey;

        }

        const adapterName =
            String(

                source.adapterName ||

                source.adapter ||

                ""

            )
                .trim()
                .toLowerCase();

        const provider =
            String(
                source.provider ||
                ""
            )
                .trim()
                .toLowerCase();

        const name =
            String(
                source.name ||
                ""
            )
                .trim()
                .toLowerCase();

        const combined =
            `${adapterName} ${provider} ${name}`;

        if (
            combined.includes(
                "anwaa"
            ) ||
            combined.includes(
                "official"
            ) ||
            combined.includes(
                "national source"
            )
        ) {

            return "official";

        }

        if (
            combined.includes(
                "rainviewer"
            ) ||
            combined.includes(
                "radar"
            )
        ) {

            return "radar";

        }

        if (
            combined.includes(
                "satellite"
            )
        ) {

            return "satellite";

        }

        if (
            combined.includes(
                "lightning"
            )
        ) {

            return "lightning";

        }

        if (
            combined.includes(
                "openmeteo"
            ) ||
            combined.includes(
                "open-meteo"
            ) ||
            combined.includes(
                "open_meteo"
            )
        ) {

            return "openMeteo";

        }

        if (
            combined.includes(
                "localai"
            ) ||
            combined.includes(
                "local ai"
            ) ||
            combined.includes(
                "local_ai"
            ) ||
            combined.includes(
                "local model"
            )
        ) {

            return "localModel";

        }

        return "";

    },

    /* =====================================================
       WEATHER SCORING HELPERS
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
            this.normalizeStatus(
                level
            );

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

        return this.getLightningTrendScore(
            trend
        );

    },

    /* =====================================================
       STATUS AND CSS HELPERS
       ===================================================== */

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
            )
            .replaceAll(
                "-",
                "_"
            );

    },

    getVerificationClass(
        status
    ) {

        const value =
            this.normalizeStatus(
                status
            );

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
                "SUPPORTED"
        ) {

            return "info";

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
            this.normalizeStatus(
                status
            );

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

        if (
            value ===
            "NO_DATA"
        ) {

            return "info";

        }

        return "success";

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

                const riskDifference =

                    this.safeNumber(
                        second
                            ?.verifiedRisk,
                        0
                    ) -

                    this.safeNumber(
                        first
                            ?.verifiedRisk,
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
                        second
                            ?.lightningThreat,
                        0
                    ) -

                    this.safeNumber(
                        first
                            ?.lightningThreat,
                        0
                    )

                );

            }
        )[0];

    },

    /* =====================================================
       HTML SAFETY
       ===================================================== */

    escapeHtml(
        value
    ) {

        const text =
            String(
                value ?? ""
            );

        if (
            typeof document ===
            "undefined"
        ) {

            return text
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

        }

        const div =
            document.createElement(
                "div"
            );

        div.textContent =
            text;

        return div.innerHTML;

    },

    /* =====================================================
       STATE
       ===================================================== */

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

            previousDynamicWeights: {

                ...this.previousDynamicWeights

            },

            language:
                window.RG30
                    ?.I18n
                    ?.language ||
                "en",

            features: {

                dataQuality:
                    this.config
                        .dataQuality
                        .enabled,

                dynamicWeighting:
                    this.config
                        .dynamicWeighting
                        .enabled,

                lightningIntelligence:
                    this.config
                        .lightningIntelligence
                        .enabled,

                conflictIntelligence:
                    this.config
                        .conflictIntelligence
                        .enabled

            }

        };

    },

    getDebugSnapshot() {

        return {

            engine:
                "VerificationEngine",

            version:
                this.version,

            config:
                this.config,

            state:
                this.getState(),

            latestCities:
                this.latestCities,

            latestVerification:
                this.latestVerification,

            latestNationalSummary:
                this.latestNationalSummary,

            timestamp:
                new Date()
                    .toISOString()

        };

    },

    /* =====================================================
       RESET
       ===================================================== */

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

        this.previousDynamicWeights =
            {};

        window.RG30.latestVerification =
            [];

        window.RG30.latestNationalSummary =
            null;

        window.RG31.latestVerification =
            [];

        window.RG31.latestNationalSummary =
            null;

        this.renderEmptyState(

            this.text(

                "Verification engine has been reset.",

                "تمت إعادة ضبط محرك التحقق."

            )

        );

        this.writeLog(

            this.text(

                "RainGuard V31 Verification Engine reset.",

                "تمت إعادة ضبط محرك التحقق RainGuard V31."

            ),

            "warning"

        );

        window.dispatchEvent(

            new CustomEvent(

                "rg31:verification-reset",

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

    },

    /* =====================================================
       LOGGING
       ===================================================== */

    writeLog(
        message,
        type = "success"
    ) {

        const translatedMessage =
            this.translateMessage(
                message
            );

        const prefix =
            "[RainGuard V31 Verification]";

        if (
            type ===
            "danger"
        ) {

            console.error(
                prefix,
                translatedMessage
            );

        } else if (
            type ===
                "warning"
        ) {

            console.warn(
                prefix,
                translatedMessage
            );

        } else {

            console.log(
                prefix,
                translatedMessage
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

                        translatedMessage,

                        type

                    );

            } catch (error) {

                console.warn(
                    "V31 commander log skipped:",
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
                    "V31 orchestrator log skipped:",
                    error
                );

            }

        }

    },

    /* =====================================================
       COMPATIBILITY
       ===================================================== */

    registerCompatibilityAliases() {

        window.RG30.VerificationEngine =
            this;

        window.RG30.NationalVerificationEngine =
            this;

        window.RG30.MultiSourceVerificationEngine =
            this;

        window.RG30.VerificationEngineV30 =
            this;

        window.RG31.VerificationEngine =
            this;

        window.RG31.NationalWeatherIntelligenceEngine =
            this;

        console.log(
            "RG30/V31 Verification Engine compatibility aliases registered."
        );

    },

    /* =====================================================
       DESTROY
       ===================================================== */

    destroy() {

        this.reset();

        this.initialized =
            false;

        this.writeLog(

            this.text(

                "RainGuard V31 Verification Engine destroyed.",

                "تم إيقاف محرك التحقق RainGuard V31."

            ),

            "warning"

        );

        window.dispatchEvent(

            new CustomEvent(

                "rg31:verification-destroyed",

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
   V31 ALIAS
   ========================================================= */

window.RG31.VerificationEngine =
    window.RG30.VerificationEngine;

/* =========================================================
   AUTO START
   ========================================================= */

(function initializeVerificationEngineV31() {

    const start =
        () => {

            try {

                const engine =
                    window.RG30
                        ?.VerificationEngine;

                if (!engine) {

                    console.error(
                        "RG30/V31 Verification Engine was not found."
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

                            const adapterCities =
                                window.RG30
                                    ?.SourceAdapter
                                    ?.toVerificationCities?.() ||
                                [];

                            const brainCities =
                                window.RG23
                                    ?.Brain
                                    ?.latestCities ||
                                [];

                            const cities =
                                Array.isArray(
                                    adapterCities
                                ) &&
                                adapterCities.length
                                    ? adapterCities
                                    : brainCities;

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
                                "Initial V31 verification run skipped:",
                                error
                            );

                        }

                    },

                    3500

                );

                console.log(

                    "%cRainGuard AI V31 Verification Intelligence Engine Ready",

                    "color:#18e4a0;font-weight:bold;font-size:14px;"

                );

            } catch (error) {

                console.error(
                    "RG30/V31 Verification Engine initialization failed:",
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
                    window.RG30
                        ?.SourceAdapter
                        ?.toVerificationCities?.() ||
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

window.runV31Verification =
    window.runV30Verification;

window.getV30VerificationState =
    function () {

        return window.RG30
            ?.VerificationEngine
            ?.getState();

    };

window.getV31VerificationState =
    window.getV30VerificationState;

window.getV30VerificationResults =
    function () {

        return window.RG30
            ?.VerificationEngine
            ?.latestVerification ||
            [];

    };

window.getV31VerificationResults =
    window.getV30VerificationResults;

window.getV30NationalSummary =
    function () {

        return window.RG30
            ?.VerificationEngine
            ?.latestNationalSummary ||
            null;

    };

window.getV31NationalSummary =
    window.getV30NationalSummary;

window.getV31VerificationDebug =
    function () {

        return window.RG30
            ?.VerificationEngine
            ?.getDebugSnapshot();

    };

window.resetV30Verification =
    function () {

        return window.RG30
            ?.VerificationEngine
            ?.reset();

    };

window.resetV31Verification =
    window.resetV30Verification;

window.destroyV30Verification =
    function () {

        return window.RG30
            ?.VerificationEngine
            ?.destroy();

    };

window.destroyV31Verification =
    window.destroyV30Verification;

/* =========================================================
   CONSOLE READY MESSAGE
   ========================================================= */

console.log(

    "%cRainGuard AI V31 National Weather Intelligence Verification Engine Loaded",

    "color:#18e4a0;font-weight:bold;font-size:14px;"

);
