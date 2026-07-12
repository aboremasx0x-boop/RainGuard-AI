/* =========================================================
   RainGuard AI V30
   Arabic / English Internationalization Engine
   File: frontend/js/i18n_v30.js
   ========================================================= */

window.RG30 = window.RG30 || {};

(function (RG30) {
    "use strict";

    const STORAGE_KEY =
        "rainguard_v30_language";

    const DEFAULT_LANGUAGE =
        "en";

    const SUPPORTED_LANGUAGES = [
        "ar",
        "en"
    ];

    const translations = {
        en: {
            appName: "RainGuard AI V30",
            appSubtitle:
                "National Multi-Source Verification Engine",

            languageButton:
                "العربية",

            switchToArabic:
                "Switch to Arabic",

            switchToEnglish:
                "Switch to English",

            verificationCycle:
                "V30 verification cycle",

            startSystem:
                "Start V30",

            stopSystem:
                "Stop",

            refreshData:
                "Refresh Data",

            generateReport:
                "Generate Report",

            systemStatus:
                "System Status",

            verificationPhase:
                "Verification Phase",

            highestVerifiedRisk:
                "Highest Verified Risk",

            highestRiskCity:
                "Highest Risk City",

            verificationConfidence:
                "Verification Confidence",

            nationalStatus:
                "National Status",

            v30Loading:
                "V30 Loading",

            autonomousRunning:
                "Autonomous V30 Running",

            waiting:
                "WAITING",

            normal:
                "NORMAL",

            watch:
                "WATCH",

            warning:
                "WARNING",

            critical:
                "CRITICAL",

            observe:
                "Observe",

            collect:
                "Collect",

            normalize:
                "Normalize",

            verify:
                "Verify",

            compare:
                "Compare",

            conflict:
                "Conflict",

            decide:
                "Decide",

            gate:
                "Gate",

            report:
                "Report",

            learn:
                "Learn",

            executiveCommander:
                "Executive AI Commander",

            executiveCommanderDescription:
                "Live messages from the V30 national verification and source-integration system.",

            waitingInitialization:
                "Waiting for V30 initialization.",

            commanderPlaceholder:
                "Ask V30 National Commander...",

            send:
                "Send",

            nationalVerificationMap:
                "Live National Verification Map",

            nationalVerificationMapDescription:
                "Verified national risk and RainViewer radar visualization for monitored cities.",

            systemHealth:
                "V30 System Health",

            systemHealthDescription:
                "Availability of the base intelligence, verification and source-adapter engines.",

            checkingEngines:
                "Checking V30 engines.",

            sourceAdapterLayer:
                "National Source Adapter Layer V30",

            sourceAdapterDescription:
                "Connection status and coverage for Anwaa, Open-Meteo, RainViewer and future national verification sources.",

            waitingSourceCollection:
                "Waiting for the first national source collection.",

            verificationIndicators:
                "National Verification Indicators",

            verificationIndicatorsDescription:
                "Agreement, evidence quality and final national verification confidence.",

            sourceAgreement:
                "Source Agreement",

            evidenceScore:
                "Evidence Score",

            finalConfidence:
                "Final Confidence",

            verificationStatus:
                "Verification Status",

            waitingFirstVerification:
                "Waiting for the first V30 verification cycle.",

            multiSourceVerification:
                "National Multi-Source Verification Engine V30",

            multiSourceVerificationDescription:
                "City-by-city verification, evidence agreement, conflict detection, verified risk and decision gate.",

            noCityResults:
                "No city verification results yet.",

            sourceMatrix:
                "Verification Source Matrix V30",

            sourceMatrixDescription:
                "Official national source, radar, satellite, lightning, Open-Meteo and RainGuard local AI.",

            waitingSourceComparison:
                "Waiting for source comparison.",

            executiveReport:
                "Real-Time Executive Verification Report",

            executiveReportDescription:
                "Consolidated national verification report generated from V30.",

            waitingFirstReport:
                "Waiting for the first V30 report.",

            footer:
                "RainGuard AI V30 — National Multi-Source Verification Engine",

            topCity:
                "Top City",

            weatherScore:
                "Weather Score",

            floodIndex:
                "Flood Index",

            roadRisk:
                "Road Risk",

            infrastructureCriticality:
                "Infrastructure Criticality",

            finalRisk:
                "Final Risk",

            recommendation:
                "Recommendation",

            emergencyEscalation:
                "Emergency escalation recommended.",

            activeMonitoring:
                "Active monitoring and field readiness recommended.",

            enhancedMonitoring:
                "Enhanced monitoring with radar watch recommended.",

            normalMonitoring:
                "Normal monitoring with radar watch.",

            systemReadyMessage:
                "RainGuard base intelligence brain is ready for V30.",

            startingAnalysis:
                "Starting real-time national analysis...",

            analysisCompleted:
                "Real-time analysis completed.",

            analysisFailed:
                "Base analysis encountered an error. V30 may continue using the latest available data.",

            systemStopped:
                "System cycle stopped.",

            requestReceived:
                "ANI: Request received. Running refresh analysis.",

            radarConnected:
                "RainViewer radar layer connected to the national map.",

            radarUnavailable:
                "RainViewer radar layer is currently unavailable.",

            sourceCollectionCompleted:
                "V30 national source collection and verification completed.",

            integrationFailed:
                "V30 source integration failed. Check browser console."
        },

        ar: {
            appName:
                "RainGuard AI V30",

            appSubtitle:
                "محرك التحقق الوطني متعدد المصادر",

            languageButton:
                "English",

            switchToArabic:
                "التبديل إلى اللغة العربية",

            switchToEnglish:
                "التبديل إلى اللغة الإنجليزية",

            verificationCycle:
                "دورة التحقق في V30",

            startSystem:
                "تشغيل V30",

            stopSystem:
                "إيقاف",

            refreshData:
                "تحديث البيانات",

            generateReport:
                "إنشاء التقرير",

            systemStatus:
                "حالة النظام",

            verificationPhase:
                "مرحلة التحقق",

            highestVerifiedRisk:
                "أعلى خطر متحقق",

            highestRiskCity:
                "المدينة الأعلى خطرًا",

            verificationConfidence:
                "ثقة التحقق",

            nationalStatus:
                "الحالة الوطنية",

            v30Loading:
                "جارٍ تحميل V30",

            autonomousRunning:
                "نظام V30 الذاتي يعمل",

            waiting:
                "بانتظار البيانات",

            normal:
                "طبيعي",

            watch:
                "مراقبة",

            warning:
                "تحذير",

            critical:
                "حرج",

            observe:
                "الرصد",

            collect:
                "الجمع",

            normalize:
                "التوحيد",

            verify:
                "التحقق",

            compare:
                "المقارنة",

            conflict:
                "التعارض",

            decide:
                "القرار",

            gate:
                "بوابة القرار",

            report:
                "التقرير",

            learn:
                "التعلم",

            executiveCommander:
                "القائد التنفيذي للذكاء الاصطناعي",

            executiveCommanderDescription:
                "رسائل مباشرة من نظام V30 الوطني للتحقق وتكامل مصادر البيانات.",

            waitingInitialization:
                "بانتظار تهيئة نظام V30.",

            commanderPlaceholder:
                "اسأل القائد الوطني لنظام V30...",

            send:
                "إرسال",

            nationalVerificationMap:
                "خريطة التحقق الوطنية المباشرة",

            nationalVerificationMapDescription:
                "عرض المخاطر الوطنية المتحققة وطبقة رادار RainViewer للمدن المراقبة.",

            systemHealth:
                "سلامة نظام V30",

            systemHealthDescription:
                "حالة محرك الذكاء الأساسي ومحرك التحقق ومحولات مصادر البيانات.",

            checkingEngines:
                "جارٍ فحص محركات V30.",

            sourceAdapterLayer:
                "طبقة محولات المصادر الوطنية V30",

            sourceAdapterDescription:
                "حالة الاتصال والتغطية لمصادر أنواء وOpen-Meteo وRainViewer والمصادر الوطنية المستقبلية.",

            waitingSourceCollection:
                "بانتظار أول عملية جمع وطنية للمصادر.",
                       verificationIndicators:
                "مؤشرات التحقق الوطنية",

            verificationIndicatorsDescription:
                "نسبة اتفاق المصادر وجودة الأدلة ومستوى الثقة النهائي في التحقق الوطني.",

            sourceAgreement:
                "اتفاق المصادر",

            evidenceScore:
                "درجة الأدلة",

            finalConfidence:
                "الثقة النهائية",

            verificationStatus:
                "حالة التحقق",

            waitingFirstVerification:
                "بانتظار أول دورة تحقق لنظام V30.",

            multiSourceVerification:
                "محرك التحقق الوطني متعدد المصادر V30",

            multiSourceVerificationDescription:
                "التحقق لكل مدينة، وقياس اتفاق الأدلة، واكتشاف التعارض، وحساب الخطر المتحقق، وتطبيق بوابة القرار.",

            noCityResults:
                "لا توجد نتائج تحقق للمدن حتى الآن.",

            sourceMatrix:
                "مصفوفة مصادر التحقق V30",

            sourceMatrixDescription:
                "المصدر الوطني الرسمي والرادار والأقمار الصناعية والبرق وOpen-Meteo والذكاء الاصطناعي المحلي لـ RainGuard.",

            waitingSourceComparison:
                "بانتظار مقارنة مصادر البيانات.",

            executiveReport:
                "تقرير التحقق التنفيذي المباشر",

            executiveReportDescription:
                "تقرير وطني موحد يتم إنشاؤه من نتائج نظام V30.",

            waitingFirstReport:
                "بانتظار أول تقرير لنظام V30.",

            footer:
                "RainGuard AI V30 — محرك التحقق الوطني متعدد المصادر",

            topCity:
                "المدينة الأعلى خطرًا",

            weatherScore:
                "درجة الطقس",

            floodIndex:
                "مؤشر السيول",

            roadRisk:
                "خطر الطرق",

            infrastructureCriticality:
                "حرجية البنية التحتية",

            finalRisk:
                "الخطر النهائي",

            recommendation:
                "التوصية",

            emergencyEscalation:
                "يوصى بالتصعيد إلى حالة الطوارئ.",

            activeMonitoring:
                "يوصى بالمراقبة النشطة ورفع جاهزية الفرق الميدانية.",

            enhancedMonitoring:
                "يوصى بتعزيز المراقبة مع متابعة الرادار.",

            normalMonitoring:
                "استمرار المراقبة الطبيعية مع متابعة الرادار.",

            systemReadyMessage:
                "محرك الذكاء الأساسي لـ RainGuard جاهز للعمل مع V30.",

            startingAnalysis:
                "بدء التحليل الوطني المباشر...",

            analysisCompleted:
                "اكتمل التحليل الوطني المباشر.",

            analysisFailed:
                "حدث خطأ في التحليل الأساسي. يمكن لـ V30 الاستمرار باستخدام أحدث بيانات متاحة.",

            systemStopped:
                "تم إيقاف دورة النظام.",

            requestReceived:
                "استلم الذكاء الوطني الطلب، ويجري الآن تحديث التحليل.",

            radarConnected:
                "تم ربط طبقة رادار RainViewer بالخريطة الوطنية.",

            radarUnavailable:
                "طبقة رادار RainViewer غير متاحة حاليًا.",

            sourceCollectionCompleted:
                "اكتملت عملية جمع المصادر الوطنية والتحقق منها في V30.",

            integrationFailed:
                "فشل تكامل مصادر V30. راجع وحدة تحكم المتصفح."
        }
    };

    const I18n = {

        version:
            "30.1.1",

        language:
            DEFAULT_LANGUAGE,

        initialized:
            false,

        isSupported(language) {

            return SUPPORTED_LANGUAGES.includes(
                language
            );

        },

        getSavedLanguage() {

            try {

                const saved =
                    localStorage.getItem(
                        STORAGE_KEY
                    );

                return this.isSupported(saved)
                    ? saved
                    : DEFAULT_LANGUAGE;

            }

            catch (error) {

                console.warn(
                    "Language storage unavailable.",
                    error
                );

                return DEFAULT_LANGUAGE;

            }

        },

        saveLanguage(language) {

            try {

                localStorage.setItem(
                    STORAGE_KEY,
                    language
                );

            }

            catch (error) {

                console.warn(
                    error
                );

            }

        },

        t(
            key,
            fallback = "",
            variables = {}
        ) {

            const dictionary =
                translations[
                    this.language
                ] ||
                translations[
                    DEFAULT_LANGUAGE
                ];

            let value =
                dictionary[key] ??
                translations[
                    DEFAULT_LANGUAGE
                ][key] ??
                fallback ??
                key;

            Object.entries(
                variables || {}
            ).forEach(
                ([name, replacement]) => {

                    value =
                        String(value)
                        .replaceAll(
                            `{${name}}`,
                            String(
                                replacement
                            )
                        );

                }
            );

            return String(value);

        },

        getDirection() {

            return this.language === "ar"
                ? "rtl"
                : "ltr";

        },

        getLocale() {

            return this.language === "ar"
                ? "ar-SA"
                : "en-US";

        },
               translateStatus(value) {

            const normalized =
                String(value ?? "")
                .trim()
                .toUpperCase();

            const statusKeys = {

                "WAITING":
                    "waiting",

                "NORMAL":
                    "normal",

                "WATCH":
                    "watch",

                "WARNING":
                    "warning",

                "CRITICAL":
                    "critical",

                "AUTONOMOUS V30 RUNNING":
                    "autonomousRunning",

                "V30 LOADING":
                    "v30Loading"

            };

            const key =
                statusKeys[
                    normalized
                ];

            return key
                ? this.t(
                    key,
                    value
                )
                : String(value ?? "");

        },

        translatePhase(value) {

            const key =
                String(value ?? "")
                .trim()
                .toLowerCase();

            return translations.en[key]
                ? this.t(
                    key,
                    value
                )
                : String(value ?? "");

        },

        translateText(text) {

            const value =
                String(text ?? "");

            const exactMessages = {

                "RainGuard base intelligence brain is ready for V30.":
                    "systemReadyMessage",

                "Starting real-time national analysis...":
                    "startingAnalysis",

                "Real-time analysis completed.":
                    "analysisCompleted",

                "Base analysis encountered an error. V30 may continue using the latest available data.":
                    "analysisFailed",

                "System cycle stopped.":
                    "systemStopped",

                "ANI: Request received. Running refresh analysis.":
                    "requestReceived",

                "RainViewer radar layer connected to the national map.":
                    "radarConnected",

                "RainViewer radar layer is currently unavailable.":
                    "radarUnavailable",

                "V30 national source collection and verification completed.":
                    "sourceCollectionCompleted",

                "V30 source integration failed. Check browser console.":
                    "integrationFailed"

            };

            const key =
                exactMessages[
                    value.trim()
                ];

            if (key) {

                return this.t(
                    key,
                    value
                );

            }

            if (
                this.language === "ar"
            ) {

                const dynamicPatterns = [

                    {

                        pattern:
                            /^National confidence:\s*(\d+)%\.?$/i,

                        replacement:
                            "الثقة الوطنية: $1%."

                    },

                    {

                        pattern:
                            /^V30 verification cycle\s*(\d+)\s*started for\s*(\d+)\s*cities\.?$/i,

                        replacement:
                            "بدأت دورة التحقق رقم $1 لعدد $2 مدينة."

                    },

                    {

                        pattern:
                            /^V30 verification cycle\s*(\d+)\s*completed\.?$/i,

                        replacement:
                            "اكتملت دورة التحقق رقم $1."

                    },

                    {

                        pattern:
                            /^V30 source collection started for\s*(\d+)\s*cities\.?$/i,

                        replacement:
                            "بدأ جمع المصادر لعدد $1 مدينة."

                    },

                    {

                        pattern:
                            /^V30 source collection completed\. Coverage:\s*(\d+)%\.?$/i,

                        replacement:
                            "اكتمل جمع المصادر. نسبة التغطية $1%."

                    },

                    {

                        pattern:
                            /^Mission prepared for\s+(.+)$/i,

                        replacement:
                            "تم تجهيز المهمة لمدينة $1"

                    },

                    {

                        pattern:
                            /^Decision:\s*(.+)$/i,

                        replacement:
                            "القرار: $1"

                    }

                ];

                for (
                    const item of dynamicPatterns
                ) {

                    if (
                        item.pattern.test(
                            value.trim()
                        )
                    ) {

                        return value
                            .trim()
                            .replace(
                                item.pattern,
                                item.replacement
                            );

                    }

                }

            }

            return value;

        },

        applyElement(element) {

            if (!element) {
                return;
            }

            if (
                element.dataset.i18n
            ) {

                element.textContent =
                    this.t(
                        element.dataset.i18n,
                        element.textContent
                    );

            }

            if (
                element.dataset.i18nPlaceholder
            ) {

                element.setAttribute(

                    "placeholder",

                    this.t(
                        element.dataset.i18nPlaceholder,
                        element.getAttribute(
                            "placeholder"
                        ) || ""
                    )

                );

            }

            if (
                element.dataset.i18nAriaLabel
            ) {

                const key =

                    element.id ===
                    "languageToggle" &&
                    this.language === "ar"

                        ? "switchToEnglish"

                        : element.dataset.i18nAriaLabel;

                element.setAttribute(

                    "aria-label",

                    this.t(
                        key,
                        element.getAttribute(
                            "aria-label"
                        ) || ""
                    )

                );

            }

        },

        applyStaticTranslations(
            root = document
        ) {

            const selector = [

                "[data-i18n]",

                "[data-i18n-placeholder]",

                "[data-i18n-aria-label]"

            ].join(",");

            const elements = [];

            if (

                root.nodeType ===
                Node.ELEMENT_NODE &&

                root.matches?.(
                    selector
                )

            ) {

                elements.push(root);

            }

            elements.push(

                ...root.querySelectorAll?.(
                    selector
                ) || []

            );

            elements.forEach(

                element =>

                    this.applyElement(
                        element
                    )

            );

        },

        applyDynamicStates() {

            const systemStatus =
                document.getElementById(
                    "systemStatus"
                );

            const phase =
                document.getElementById(
                    "currentPhase"
                );

            const statusTop =
                document.getElementById(
                    "verificationStatusTop"
                );

            const status =
                document.getElementById(
                    "verificationStatus"
                );
                       if (systemStatus) {

                const original =
                    systemStatus.dataset.stateValue ||
                    systemStatus.textContent;

                systemStatus.dataset.stateValue =
                    original;

                systemStatus.textContent =
                    this.translateStatus(
                        original
                    );

            }

            if (phase) {

                const original =
                    phase.dataset.stateValue ||
                    phase.textContent;

                phase.dataset.stateValue =
                    original;

                phase.textContent =
                    this.translatePhase(
                        original
                    );

            }

            [statusTop, status]
                .filter(Boolean)
                .forEach(element => {

                    const original =
                        element.dataset.stateValue ||
                        element.textContent;

                    element.dataset.stateValue =
                        original;

                    element.textContent =
                        this.translateStatus(
                            original
                        );

                });

        },

        updateLanguageButton() {

            const button =
                document.getElementById(
                    "languageToggle"
                );

            if (!button) {
                return;
            }

            button.textContent =
                this.t(
                    "languageButton"
                );

            button.setAttribute(

                "aria-label",

                this.t(

                    this.language === "ar"

                        ? "switchToEnglish"

                        : "switchToArabic"

                )

            );

        },

        applyLanguage() {

            document.documentElement.lang =
                this.language;

            document.documentElement.dir =
                this.getDirection();

            if (document.body) {

                document.body.classList.toggle(
                    "v30-rtl",
                    this.language === "ar"
                );

                document.body.classList.toggle(
                    "v30-ltr",
                    this.language === "en"
                );

            }

            this.applyStaticTranslations(
                document
            );

            this.applyDynamicStates();

            this.updateLanguageButton();

        },

        setLanguage(language) {

            if (
                !this.isSupported(
                    language
                )
            ) {

                console.warn(
                    `Unsupported language: ${language}`
                );

                return;

            }

            this.language =
                language;

            this.saveLanguage(
                language
            );

            this.applyLanguage();

            window.dispatchEvent(

                new CustomEvent(

                    "rg30:language-changed",

                    {

                        detail: {

                            language:
                                this.language,

                            direction:
                                this.getDirection(),

                            locale:
                                this.getLocale()

                        }

                    }

                )

            );

            console.log(
                `RG30 language changed to ${language}.`
            );

        },

        toggleLanguage() {

            this.setLanguage(

                this.language === "ar"

                    ? "en"

                    : "ar"

            );

        },

        bindLanguageButton() {

            const button =
                document.getElementById(
                    "languageToggle"
                );

            if (!button) {

                console.warn(
                    "RG30 I18n: languageToggle button not found."
                );

                return;

            }

            button.addEventListener(

                "click",

                () => {

                    this.toggleLanguage();

                }

            );

        },

        init() {

            if (this.initialized) {
                return;
            }

            this.initialized =
                true;

            this.language =
                this.getSavedLanguage();

            this.bindLanguageButton();

            this.applyLanguage();

            console.log(
                `RG30 I18n ${this.version} initialized. Language: ${this.language}`
            );

        }

    };

    RG30.I18n =
        I18n;

    window.RG30I18n =
        I18n;

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(

            "DOMContentLoaded",

            () => {

                I18n.init();

            },

            {
                once: true
            }

        );

    } else {

        I18n.init();

    }

})(window.RG30);
