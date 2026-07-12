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

        /* =====================================================
           ENGLISH
           ===================================================== */

        en: {
            appName:
                "RainGuard AI V30",

            appSubtitle:
                "National Multi-Source Verification Engine",

            languageButton:
                "العربية",

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

            loading:
                "Loading",

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

            autonomousRunning:
                "Autonomous V30 Running",

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

            readiness:
                "Readiness",

            enginesReady:
                "Engines Ready",

            missingEngines:
                "Missing Engines",

            none:
                "None",

            source:
                "Source",

            status:
                "Status",

            city:
                "City",

            confidence:
                "Confidence",

            risk:
                "Risk",

            agreement:
                "Agreement",

            evidence:
                "Evidence",

            decision:
                "Decision",

            recommendation:
                "Recommendation",

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

            topCity:
                "Top City",

            nationalRisk:
                "National Risk",

            connected:
                "Connected",

            unavailable:
                "Unavailable",

            ready:
                "Ready",

            active:
                "Active",

            inactive:
                "Inactive",

            completed:
                "Completed",

            failed:
                "Failed",

            skipped:
                "Skipped",

            collecting:
                "Collecting",

            verifying:
                "Verifying",

            radar:
                "Radar",

            satellite:
                "Satellite",

            lightning:
                "Lightning",

            localAI:
                "RainGuard Local AI",

            officialSource:
                "Official National Source",

            openMeteo:
                "Open-Meteo",

            rainViewer:
                "RainViewer",

            anwaa:
                "Anwaa",

            mapUnavailable:
                "Map unavailable",

            systemReadyMessage:
                "RainGuard base intelligence brain is ready for V30.",

            sourceCollectionCompleted:
                "V30 national source collection and verification completed.",

            verificationCompleted:
                "V30 verification completed.",

            integrationFailed:
                "V30 source integration failed. Check browser console.",

            radarConnected:
                "RainViewer radar layer connected to the national map.",

            radarUnavailable:
                "RainViewer radar layer is currently unavailable.",

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

            normalMonitoring:
                "Normal monitoring with radar watch.",

            enhancedMonitoring:
                "Enhanced monitoring with radar watch recommended.",

            activeMonitoring:
                "Active monitoring and field readiness recommended.",

            emergencyEscalation:
                "Emergency escalation recommended."
        },

        /* =====================================================
           ARABIC
           ===================================================== */

        ar: {
            appName:
                "RainGuard AI V30",

            appSubtitle:
                "محرك التحقق الوطني متعدد المصادر",

            languageButton:
                "English",

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

            loading:
                "جارٍ التحميل",

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

            autonomousRunning:
                "نظام V30 الذاتي يعمل",

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
                "المصدر الوطني الرسمي والرادار والأقمار الصناعية والبرق وOpen-Meteo والذكاء الاصطناعي المحلي لـRainGuard.",

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

            readiness:
                "الجاهزية",

            enginesReady:
                "المحركات الجاهزة",

            missingEngines:
                "المحركات المفقودة",

            none:
                "لا يوجد",

            source:
                "المصدر",

            status:
                "الحالة",

            city:
                "المدينة",

            confidence:
                "الثقة",

            risk:
                "الخطر",

            agreement:
                "الاتفاق",

            evidence:
                "الأدلة",

            decision:
                "القرار",

            recommendation:
                "التوصية",

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

            topCity:
                "المدينة الأعلى خطرًا",

            nationalRisk:
                "الخطر الوطني",

            connected:
                "متصل",

            unavailable:
                "غير متاح",

            ready:
                "جاهز",

            active:
                "نشط",

            inactive:
                "غير نشط",

            completed:
                "مكتمل",

            failed:
                "فشل",

            skipped:
                "تم التجاوز",

            collecting:
                "جارٍ الجمع",

            verifying:
                "جارٍ التحقق",

            radar:
                "الرادار",

            satellite:
                "الأقمار الصناعية",

            lightning:
                "البرق",

            localAI:
                "الذكاء الاصطناعي المحلي لـRainGuard",

            officialSource:
                "المصدر الوطني الرسمي",

            openMeteo:
                "Open-Meteo",

            rainViewer:
                "RainViewer",

            anwaa:
                "أنواء",

            mapUnavailable:
                "الخريطة غير متاحة",

            systemReadyMessage:
                "محرك الذكاء الأساسي لـRainGuard جاهز للعمل مع V30.",

            sourceCollectionCompleted:
                "اكتملت عملية جمع المصادر الوطنية والتحقق منها في V30.",

            verificationCompleted:
                "اكتملت عملية التحقق في V30.",

            integrationFailed:
                "فشل تكامل مصادر V30. راجع وحدة تحكم المتصفح.",

            radarConnected:
                "تم ربط طبقة رادار RainViewer بالخريطة الوطنية.",

            radarUnavailable:
                "طبقة رادار RainViewer غير متاحة حاليًا.",

            startingAnalysis:
                "بدء التحليل الوطني المباشر...",

            analysisCompleted:
                "اكتمل التحليل الوطني المباشر.",

            analysisFailed:
                "حدث خطأ في التحليل الأساسي. يمكن لـV30 الاستمرار باستخدام أحدث بيانات متاحة.",

            systemStopped:
                "تم إيقاف دورة النظام.",

            requestReceived:
                "استلم الذكاء الوطني الطلب، ويجري الآن تحديث التحليل.",

            normalMonitoring:
                "استمرار المراقبة الطبيعية مع متابعة الرادار.",

            enhancedMonitoring:
                "يوصى بتعزيز المراقبة مع متابعة الرادار.",

            activeMonitoring:
                "يوصى بالمراقبة النشطة ورفع جاهزية الفرق الميدانية.",

            emergencyEscalation:
                "يوصى بالتصعيد إلى حالة الطوارئ."
        }
    };

    const originalTextNodes =
        new WeakMap();

    let observer = null;
    let internalUpdate = false;

    const I18n = {

        version:
            "30.1.0",

        language:
            DEFAULT_LANGUAGE,

        translations,

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

                if (this.isSupported(saved)) {
                    return saved;
                }
            } catch (error) {
                console.warn(
                    "RG30 I18n: language storage unavailable.",
                    error
                );
            }

            return DEFAULT_LANGUAGE;
        },

        saveLanguage(language) {
            try {
                localStorage.setItem(
                    STORAGE_KEY,
                    language
                );
            } catch (error) {
                console.warn(
                    "RG30 I18n: language could not be saved.",
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
                translations[this.language] ||
                translations[DEFAULT_LANGUAGE];

            let text =
                dictionary[key] ??
                translations[DEFAULT_LANGUAGE]?.[key] ??
                fallback ??
                key;

            Object.entries(
                variables || {}
            ).forEach(([name, value]) => {
                text = String(text).replaceAll(
                    `{${name}}`,
                    String(value)
                );
            });

            return String(text);
        },

        translateText(text) {
            const original =
                String(text ?? "");

            if (
                this.language !== "ar" ||
                !original.trim()
            ) {
                return original;
            }

            const trimmed =
                original.trim();

            const englishDictionary =
                translations.en;

            const arabicDictionary =
                translations.ar;

            const key =
                Object.keys(
                    englishDictionary
                ).find(item => {
                    return (
                        englishDictionary[item] ===
                        trimmed
                    );
                });

            if (key && arabicDictionary[key]) {
                return original.replace(
                    trimmed,
                    arabicDictionary[key]
                );
            }

            const patterns = [
                {
                    regex:
                        /^National confidence:\s*(\d+)%\.?$/i,

                    replace:
                        "الثقة الوطنية: $1%."
                },
                {
                    regex:
                        /^V30 verification cycle\s*(\d+)\s*started for\s*(\d+)\s*cities\.?$/i,

                    replace:
                        "بدأت دورة التحقق رقم $1 في V30 لعدد $2 من المدن."
                },
                {
                    regex:
                        /^V30 verification cycle\s*(\d+)\s*completed\.?$/i,

                    replace:
                        "اكتملت دورة التحقق رقم $1 في V30."
                },
                {
                    regex:
                        /^V30 source collection started for\s*(\d+)\s*cities\.?$/i,

                    replace:
                        "بدأ جمع مصادر V30 لعدد $1 من المدن."
                },
                {
                    regex:
                        /^V30 source collection completed\. Coverage:\s*(\d+)%\.?$/i,

                    replace:
                        "اكتمل جمع مصادر V30. نسبة التغطية: $1%."
                },
                {
                    regex:
                        /^Mission prepared for\s+(.+)$/i,

                    replace:
                        "تم إعداد مهمة ميدانية لمدينة $1"
                },
                {
                    regex:
                        /^Decision:\s*(.+)$/i,

                    replace:
                        "القرار: $1"
                },
                {
                    regex:
                        /^Commander:\s*(.+)$/i,

                    replace:
                        "القائد: $1"
                }
            ];

            for (const pattern of patterns) {
                if (
                    pattern.regex.test(trimmed)
                ) {
                    return original.replace(
                        trimmed,
                        trimmed.replace(
                            pattern.regex,
                            pattern.replace
                        )
                    );
                }
            }

            return original;
        },

        setDocumentDirection() {
            const isArabic =
                this.language === "ar";

            document.documentElement.lang =
                this.language;

            document.documentElement.dir =
                isArabic
                    ? "rtl"
                    : "ltr";

            document.body?.classList.toggle(
                "v30-rtl",
                isArabic
            );

            document.body?.classList.toggle(
                "v30-ltr",
                !isArabic
            );
        },

        updateElement(element) {
            if (!element) {
                return;
            }

            const key =
                element.dataset.i18n;

            if (key) {
                element.textContent =
                    this.t(
                        key,
                        element.textContent
                    );
            }

            const htmlKey =
                element.dataset.i18nHtml;

            if (htmlKey) {
                element.innerHTML =
                    this.t(
                        htmlKey,
                        element.innerHTML
                    );
            }

            const placeholderKey =
                element.dataset.i18nPlaceholder;

            if (placeholderKey) {
                element.setAttribute(
                    "placeholder",
                    this.t(
                        placeholderKey,
                        element.getAttribute(
                            "placeholder"
                        ) || ""
                    )
                );
            }

            const titleKey =
                element.dataset.i18nTitle;

            if (titleKey) {
                element.setAttribute(
                    "title",
                    this.t(
                        titleKey,
                        element.getAttribute(
                            "title"
                        ) || ""
                    )
                );
            }

            const ariaKey =
                element.dataset.i18nAriaLabel;

            if (ariaKey) {
                element.setAttribute(
                    "aria-label",
                    this.t(
                        ariaKey,
                        element.getAttribute(
                            "aria-label"
                        ) || ""
                    )
                );
            }
        },

        translateTextNode(node) {
            if (
                !node ||
                node.nodeType !==
                    Node.TEXT_NODE
            ) {
                return;
            }

            const parent =
                node.parentElement;

            if (!parent) {
                return;
            }

            if (
                parent.closest(
                    "script, style, textarea, input, code, pre"
                )
            ) {
                return;
            }

            if (
                parent.hasAttribute(
                    "data-i18n"
                ) ||
                parent.hasAttribute(
                    "data-i18n-html"
                )
            ) {
                return;
            }

            if (
                !originalTextNodes.has(node)
            ) {
                originalTextNodes.set(
                    node,
                    node.nodeValue
                );
            }

            const original =
                originalTextNodes.get(node);

            const translated =
                this.language === "ar"
                    ? this.translateText(original)
                    : original;

            if (
                node.nodeValue !== translated
            ) {
                node.nodeValue =
                    translated;
            }
        },

        translateTree(root = document) {
            if (!root) {
                return;
            }

            const elements = [];

            if (
                root.nodeType ===
                Node.ELEMENT_NODE
            ) {
                elements.push(root);
            }

            if (
                root.querySelectorAll
            ) {
                elements.push(
                    ...root.querySelectorAll(
                        [
                            "[data-i18n]",
                            "[data-i18n-html]",
                            "[data-i18n-placeholder]",
                            "[data-i18n-title]",
                            "[data-i18n-aria-label]"
                        ].join(",")
                    )
                );
            }

            elements.forEach(
                element => {
                    this.updateElement(
                        element
                    );
                }
            );

            const walker =
                document.createTreeWalker(
                    root,
                    NodeFilter.SHOW_TEXT
                );

            let node;

            while (
                (node =
                    walker.nextNode())
            ) {
                this.translateTextNode(
                    node
                );
            }
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
                this.language === "ar"
                    ? "Switch to English"
                    : "التبديل إلى اللغة العربية"
            );
        },

        applyLanguage() {
            internalUpdate = true;

            try {
                this.setDocumentDirection();

                this.translateTree(
                    document.body
                );

                this.updateLanguageButton();

            } finally {
                internalUpdate = false;
            }
        },

        setLanguage(language) {
            if (
                !this.isSupported(
                    language
                )
            ) {
                console.warn(
                    `RG30 I18n: unsupported language ${language}.`
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
                                this.language === "ar"
                                    ? "rtl"
                                    : "ltr"
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
                    "RG30 I18n: #languageToggle was not found."
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

        startObserver() {
            if (observer) {
                observer.disconnect();
            }

            observer =
                new MutationObserver(
                    mutations => {
                        if (internalUpdate) {
                            return;
                        }

                        internalUpdate = true;

                        try {
                            mutations.forEach(
                                mutation => {
                                    mutation.addedNodes
                                        .forEach(
                                            node => {
                                                if (
                                                    node.nodeType ===
                                                    Node.ELEMENT_NODE
                                                ) {
                                                    this.translateTree(
                                                        node
                                                    );
                                                }

                                                if (
                                                    node.nodeType ===
                                                    Node.TEXT_NODE
                                                ) {
                                                    this.translateTextNode(
                                                        node
                                                    );
                                                }
                                            }
                                        );
                                }
                            );
                        } finally {
                            internalUpdate =
                                false;
                        }
                    }
                );

            observer.observe(
                document.body,
                {
                    childList: true,
                    subtree: true
                }
            );
        },

        init() {
            if (this.initialized) {
                return;
            }

            this.initialized = true;

            this.language =
                this.getSavedLanguage();

            this.bindLanguageButton();

            this.applyLanguage();

            this.startObserver();

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
