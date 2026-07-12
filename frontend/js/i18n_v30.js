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
