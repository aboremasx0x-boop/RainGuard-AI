/* =========================================================
   RainGuard AI V30
   National Multi-Source Verification Orchestrator
   Bilingual Arabic / English Edition
   File: frontend/js/v30_orchestrator.js
   ========================================================= */

window.RG30 =
    window.RG30 || {};

RG30.Orchestrator = {

    version:
        "30.1.0-bilingual",

    started:
        false,

    running:
        false,

    cycleInProgress:
        false,

    intervalId:
        null,

    latestCycle:
        null,

    latestReportSummary:
        null,

    latestReportResults:
        [],

    config: {

        automaticStart:
            true,

        firstRunDelay:
            4500,

        cycleInterval:
            10 * 60 * 1000,

        engineWaitTimeout:
            30000

    },

    requiredEngines: [

        {
            name:
                "RG23 Brain",

            nameAr:
                "محرك RG23 الأساسي",

            test: () =>
                Boolean(
                    window.RG23
                        ?.Brain
                        ?.runFullAnalysis
                )
        },

        {
            name:
                "V30 Verification Engine",

            nameAr:
                "محرك التحقق V30",

            test: () =>
                Boolean(
                    window.RG30
                        ?.VerificationEngine
                        ?.run
                )
        }

    ],

    /* =====================================================
       LANGUAGE HELPERS
       ===================================================== */

    isArabic() {

        return (
            window.RG30
                ?.I18n
                ?.language === "ar"
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

    translateMessage(message) {

        const i18n =
            window.RG30?.I18n;

        if (
            i18n &&
            typeof i18n.translateText ===
                "function"
        ) {

            return i18n.translateText(
                message
            );

        }

        return String(
            message ?? ""
        );

    },

    getEngineName(engine) {

        return this.isArabic()
            ? (
                engine.nameAr ||
                engine.name
            )
            : engine.name;

    },

    getStatusLabel(status) {

        const value =
            String(
                status ?? ""
            )
                .trim()
                .toUpperCase();

        const labels = {

            WAITING: {
                en: "WAITING",
                ar: "بانتظار البيانات"
            },

            NORMAL: {
                en: "NORMAL",
                ar: "طبيعي"
            },

            WATCH: {
                en: "WATCH",
                ar: "مراقبة"
            },

            WARNING: {
                en: "WARNING",
                ar: "تحذير"
            },

            CRITICAL: {
                en: "CRITICAL",
                ar: "حرج"
            },

            VERIFIED: {
                en: "VERIFIED",
                ar: "متحقق"
            },

            SUPPORTED: {
                en: "SUPPORTED",
                ar: "مدعوم"
            },

            CONFLICTED: {
                en: "CONFLICTED",
                ar: "متعارض"
            }

        };

        const item =
            labels[value];

        if (!item) {

            return String(
                status ?? ""
            );

        }

        return this.isArabic()
            ? item.ar
            : item.en;

    },

    getPhaseLabel(phase) {

        const value =
            String(
                phase ?? ""
            )
                .trim()
                .toLowerCase();

        const phases = {

            observe: {
                en: "Observe",
                ar: "الرصد"
            },

            collect: {
                en: "Collect",
                ar: "الجمع"
            },

            normalize: {
                en: "Normalize",
                ar: "التوحيد"
            },

            verify: {
                en: "Verify",
                ar: "التحقق"
            },

            compare: {
                en: "Compare",
                ar: "المقارنة"
            },

            conflict: {
                en: "Conflict",
                ar: "التعارض"
            },

            decide: {
                en: "Decide",
                ar: "القرار"
            },

            gate: {
                en: "Gate",
                ar: "بوابة القرار"
            },

            report: {
                en: "Report",
                ar: "التقرير"
            },

            learn: {
                en: "Learn",
                ar: "التعلم"
            },

            stopped: {
                en: "Stopped",
                ar: "متوقف"
            },

            error: {
                en: "Error",
                ar: "خطأ"
            }

        };

        const item =
            phases[value];

        if (!item) {

            return String(
                phase ?? ""
            );

        }

        return this.isArabic()
            ? item.ar
            : item.en;

    },

    /* =====================================================
       INITIALIZATION
       ===================================================== */

    init() {

        if (this.started) {
            return;
        }

        this.started =
            true;

        this.bindButtons();

        this.bindPhaseButtons();

        this.bindEvents();

        this.setSystemStatus(

            this.text(
                "V30 Initializing",
                "جارٍ تهيئة V30"
            ),

            "small"

        );

        this.writeCommander(

            this.text(
                "V30 orchestrator initialized.",
                "تمت تهيئة منسق V30."
            )

        );

        this.waitForEngines()

            .then(() => {

                this.setSystemStatus(

                    this.text(
                        "V30 Ready",
                        "نظام V30 جاهز"
                    ),

                    "small"

                );

                this.writeCommander(

                    this.text(
                        "All V30 required engines are ready.",
                        "جميع محركات V30 المطلوبة جاهزة."
                    )

                );

                if (
                    this.config
                        .automaticStart
                ) {

                    window.setTimeout(

                        () => {

                            this.start();

                        },

                        this.config
                            .firstRunDelay

                    );

                }

            })

            .catch(error => {

                console.error(

                    "V30 engine initialization failed:",

                    error

                );

                this.setSystemStatus(

                    this.text(
                        "V30 Engine Error",
                        "خطأ في محركات V30"
                    ),

                    "small"

                );

                this.writeCommander(

                    this.text(

                        `V30 startup failed: ${error.message}`,

                        `فشل تشغيل V30: ${error.message}`

                    ),

                    "danger"

                );

            });

    },

    /* =====================================================
       WAIT FOR ENGINES
       ===================================================== */

    waitForEngines() {

        return new Promise(

            (
                resolve,
                reject
            ) => {

                const startedAt =
                    Date.now();

                const check =
                    () => {

                        const missing =
                            this.requiredEngines
                                .filter(
                                    engine => {

                                        try {

                                            return !engine
                                                .test();

                                        } catch (
                                            error
                                        ) {

                                            return true;

                                        }

                                    }
                                );

                        this.renderEngineHealth(
                            missing
                        );

                        if (
                            !missing.length
                        ) {

                            resolve(
                                true
                            );

                            return;

                        }

                        if (
                            Date.now() -
                            startedAt >=
                            this.config
                                .engineWaitTimeout
                        ) {

                            const names =
                                missing
                                    .map(
                                        engine =>
                                            this.getEngineName(
                                                engine
                                            )
                                    )
                                    .join(
                                        ", "
                                    );

                            reject(

                                new Error(

                                    this.text(

                                        `Missing engines: ${names}`,

                                        `المحركات المفقودة: ${names}`

                                    )

                                )

                            );

                            return;

                        }

                        window.setTimeout(
                            check,
                            500
                        );

                    };

                check();

            }

        );

    },

    /* =====================================================
       START / STOP
       ===================================================== */

    async start() {

        if (
            this.running
        ) {

            this.writeCommander(

                this.text(
                    "V30 is already running.",
                    "نظام V30 يعمل بالفعل."
                ),

                "info"

            );

            return;

        }

        this.running =
            true;

        this.setSystemStatus(

            this.text(
                "Autonomous V30 Running",
                "نظام V30 الذاتي يعمل"
            )

        );

        this.writeCommander(

            this.text(
                "National Multi-Source Verification V30 started.",
                "بدأ تشغيل نظام V30 الوطني للتحقق متعدد المصادر."
            )

        );

        await this.runCycle();

        if (
            this.intervalId
        ) {

            window.clearInterval(
                this.intervalId
            );

        }

        this.intervalId =
            window.setInterval(

                () => {

                    if (
                        this.running
                    ) {

                        this.runCycle();

                    }

                },

                this.config
                    .cycleInterval

            );

    },

    stop() {

        this.running =
            false;

        if (
            this.intervalId
        ) {

            window.clearInterval(
                this.intervalId
            );

            this.intervalId =
                null;

        }

        this.setSystemStatus(

            this.text(
                "V30 Stopped",
                "تم إيقاف V30"
            ),

            "small"

        );

        this.setPhase(
            "Stopped"
        );

        this.writeCommander(

            this.text(
                "V30 autonomous verification stopped.",
                "تم إيقاف التحقق الذاتي في V30."
            ),

            "warning"

        );

    },
       /* =====================================================
       MAIN CYCLE
       ===================================================== */

    async runCycle() {

        if (
            this.cycleInProgress
        ) {

            this.writeCommander(

                this.text(
                    "V30 cycle skipped because another cycle is active.",
                    "تم تجاوز دورة V30 لأن دورة أخرى ما زالت نشطة."
                ),

                "warning"

            );

            return null;

        }

        this.cycleInProgress =
            true;

        const startedAt =
            Date.now();

        try {

            this.setPhase(
                "Observe"
            );

            this.writeCommander(

                this.text(
                    "V30 cycle started: collecting national evidence.",
                    "بدأت دورة V30: جارٍ جمع الأدلة الوطنية."
                )

            );

            await this.runBaseAnalysis();

            const cities =
                window.RG23
                    ?.Brain
                    ?.latestCities ||
                [];

            if (
                !Array.isArray(
                    cities
                ) ||
                !cities.length
            ) {

                throw new Error(

                    this.text(
                        "The base analysis returned no cities.",
                        "لم يُرجع التحليل الأساسي أي مدن."
                    )

                );

            }

            this.setPhase(
                "Verify"
            );

            this.writeCommander(

                this.text(

                    `Running multi-source verification for ${cities.length} cities.`,

                    `جارٍ تشغيل التحقق متعدد المصادر لعدد ${cities.length} مدينة.`

                )

            );

            const verificationEngine =
                window.RG30
                    ?.VerificationEngine;

            if (
                !verificationEngine ||
                typeof verificationEngine.run !==
                    "function"
            ) {

                throw new Error(

                    this.text(
                        "V30 Verification Engine is unavailable.",
                        "محرك التحقق V30 غير متاح."
                    )

                );

            }

            const results =
                await verificationEngine
                    .run(
                        cities
                    );

            const summary =
                verificationEngine
                    .latestNationalSummary;

            this.latestCycle = {

                startedAt:
                    new Date(
                        startedAt
                    )
                    .toISOString(),

                completedAt:
                    new Date()
                    .toISOString(),

                durationMs:
                    Date.now() -
                    startedAt,

                cities:
                    cities.length,

                results:
                    Array.isArray(
                        results
                    )
                        ? results
                        : [],

                summary:
                    summary ||
                    null

            };

            this.latestReportSummary =
                summary ||
                null;

            this.latestReportResults =
                Array.isArray(
                    results
                )
                    ? results
                    : [];

            this.setPhase(
                "Decide"
            );

            this.updateNationalKPIs(
                summary
            );

            this.renderV30Report(
                summary,
                this.latestReportResults
            );

            this.publishCycle(
                this.latestCycle
            );

            this.writeCommander(

                this.text(

                    `V30 cycle completed. National confidence: ${summary?.nationalConfidence || 0}%.`,

                    `اكتملت دورة V30. الثقة الوطنية: ${summary?.nationalConfidence || 0}%.`

                )

            );

            return this.latestCycle;

        } catch (error) {

            console.error(
                "V30 autonomous cycle error:",
                error
            );

            this.writeCommander(

                this.text(

                    `V30 cycle error: ${error.message}`,

                    `خطأ في دورة V30: ${error.message}`

                ),

                "danger"

            );

            this.setPhase(
                "Error"
            );

            return null;

        } finally {

            this.cycleInProgress =
                false;

        }

    },

    async runBaseAnalysis() {

        const brain =
            window.RG23
                ?.Brain;

        if (
            !brain ||
            typeof brain.runFullAnalysis !==
                "function"
        ) {

            throw new Error(

                this.text(
                    "RG23 Brain is unavailable.",
                    "محرك RG23 الأساسي غير متاح."
                )

            );

        }

        await brain
            .runFullAnalysis({

                source:
                    "V30_ORCHESTRATOR"

            });

        const cities =
            brain.latestCities;

        if (
            !Array.isArray(
                cities
            )
        ) {

            brain.latestCities =
                [];

        }

        return brain.latestCities;

    },

    /* =====================================================
       EVENTS
       ===================================================== */

    bindEvents() {

        window.addEventListener(

            "rg30:verification-completed",

            event => {

                const summary =
                    event
                        ?.detail
                        ?.summary;

                const results =
                    event
                        ?.detail
                        ?.results ||
                    [];

                if (summary) {

                    this.latestReportSummary =
                        summary;

                    this.latestReportResults =
                        Array.isArray(
                            results
                        )
                            ? results
                            : [];

                    this.updateNationalKPIs(
                        summary
                    );

                    this.renderV30Report(
                        summary,
                        this.latestReportResults
                    );

                }

            }

        );

        window.addEventListener(

            "rg30:manual-refresh",

            () => {

                this.runCycle();

            }

        );

        window.addEventListener(

            "rg30:language-changed",

            () => {

                try {

                    if (
                        this.latestReportSummary
                    ) {

                        this.updateNationalKPIs(
                            this.latestReportSummary
                        );

                        this.renderV30Report(
                            this.latestReportSummary,
                            this.latestReportResults
                        );

                    }

                    this.renderEngineHealth(
                        this.getMissingEngines()
                    );

                    const currentPhase =
                        document
                            .getElementById(
                                "currentPhase"
                            )
                            ?.dataset
                            ?.rawPhase;

                    if (
                        currentPhase
                    ) {

                        this.setPhase(
                            currentPhase
                        );

                    }

                } catch (error) {

                    console.warn(
                        "V30 language refresh failed:",
                        error
                    );

                }

            }

        );

    },

    getMissingEngines() {

        return this.requiredEngines
            .filter(
                engine => {

                    try {

                        return !engine
                            .test();

                    } catch (error) {

                        return true;

                    }

                }
            );

    },

    publishCycle(cycle) {

        window.RG30
            .latestCycle =
            cycle;

        window.dispatchEvent(

            new CustomEvent(

                "rg30:cycle-completed",

                {
                    detail:
                        cycle
                }

            )

        );

    },

    /* =====================================================
       BUTTONS
       ===================================================== */

    bindButtons() {

        const startButton =
            document.getElementById(
                "startSystem"
            );

        const stopButton =
            document.getElementById(
                "stopSystem"
            );

        const refreshButton =
            document.getElementById(
                "refreshNow"
            );

        const reportButton =
            document.getElementById(
                "generateReport"
            );

        const sendButton =
            document.getElementById(
                "sendCommander"
            );

        const commanderInput =
            document.getElementById(
                "commanderInput"
            );

        if (startButton) {

            startButton.onclick =
                async () => {

                    await this.start();

                };

        }

        if (stopButton) {

            stopButton.onclick =
                () => {

                    this.stop();

                };

        }

        if (refreshButton) {

            refreshButton.onclick =
                async () => {

                    await this.runCycle();

                };

        }

        if (reportButton) {

            reportButton.onclick =
                () => {

                    const summary =
                        this.latestReportSummary ||
                        window.RG30
                            ?.VerificationEngine
                            ?.latestNationalSummary;

                    const results =
                        this.latestReportResults
                            ?.length
                            ? this.latestReportResults
                            : (
                                window.RG30
                                    ?.VerificationEngine
                                    ?.latestVerification ||
                                []
                            );

                    this.renderV30Report(
                        summary,
                        results
                    );

                    this.scrollToElement(
                        "reportPanel"
                    );

                };

        }

        if (
            sendButton &&
            commanderInput
        ) {

            sendButton.onclick =
                async () => {

                    const command =
                        commanderInput
                            .value
                            .trim();

                    if (!command) {
                        return;
                    }

                    commanderInput.value =
                        "";

                    await this
                        .handleCommanderCommand(
                            command
                        );

                };

            commanderInput
                .addEventListener(

                    "keydown",

                    event => {

                        if (
                            event.key ===
                            "Enter"
                        ) {

                            event
                                .preventDefault();

                            sendButton
                                .click();

                        }

                    }

                );

        }

    },
       bindPhaseButtons() {

        const buttons =
            document.querySelectorAll(
                "[data-v30-phase]"
            );

        buttons.forEach(
            button => {

                button.addEventListener(

                    "click",

                    () => {

                        const phase =
                            button
                                .dataset
                                .v30Phase;

                        this.handlePhaseRequest(
                            phase
                        );

                    }

                );

            }
        );

    },

    async handlePhaseRequest(
        phase
    ) {

        const normalized =
            String(
                phase || ""
            )
                .trim()
                .toLowerCase();

        if (
            normalized ===
                "observe" ||
            normalized ===
                "collect" ||
            normalized ===
                "normalize" ||
            normalized ===
                "verify" ||
            normalized ===
                "compare" ||
            normalized ===
                "conflict" ||
            normalized ===
                "decide" ||
            normalized ===
                "gate" ||
            normalized ===
                "learn"
        ) {

            this.writeCommander(

                this.text(

                    `Phase ${phase} requested. Running a fresh V30 verification cycle.`,

                    `تم طلب مرحلة ${this.getPhaseLabel(
                        phase
                    )}. جارٍ تشغيل دورة تحقق جديدة في V30.`

                ),

                "info"

            );

            await this.runCycle();

            return;

        }

        if (
            normalized ===
            "report"
        ) {

            const summary =
                this.latestReportSummary ||
                window.RG30
                    ?.VerificationEngine
                    ?.latestNationalSummary;

            const results =
                this.latestReportResults
                    ?.length
                    ? this.latestReportResults
                    : (
                        window.RG30
                            ?.VerificationEngine
                            ?.latestVerification ||
                        []
                    );

            this.setPhase(
                "Report"
            );

            this.renderV30Report(
                summary,
                results
            );

            this.scrollToElement(
                "reportPanel"
            );

            return;

        }

        this.writeCommander(

            this.text(

                `Phase ${phase} is connected to the current V30 verification cycle.`,

                `المرحلة ${this.getPhaseLabel(
                    phase
                )} مرتبطة بدورة التحقق الحالية في V30.`

            ),

            "info"

        );

    },

    async handleCommanderCommand(
        command
    ) {

        const text =
            String(
                command || ""
            )
                .trim();

        if (!text) {
            return;
        }

        this.writeCommander(
            this.text(
                `Commander: ${text}`,
                `القائد: ${text}`
            ),
            "info"
        );

        const lower =
            text.toLowerCase();

        if (
            lower.includes(
                "stop"
            ) ||
            lower.includes(
                "إيقاف"
            ) ||
            lower.includes(
                "توقف"
            )
        ) {

            this.stop();

            return;

        }

        if (
            lower.includes(
                "start"
            ) ||
            lower.includes(
                "ابدأ"
            ) ||
            lower.includes(
                "تشغيل"
            )
        ) {

            await this.start();

            return;

        }

        if (
            lower.includes(
                "refresh"
            ) ||
            lower.includes(
                "تحديث"
            )
        ) {

            await this.runCycle();

            return;

        }

        if (
            lower.includes(
                "report"
            ) ||
            lower.includes(
                "تقرير"
            )
        ) {

            const summary =
                this.latestReportSummary ||
                window.RG30
                    ?.VerificationEngine
                    ?.latestNationalSummary;

            const results =
                this.latestReportResults
                    ?.length
                    ? this.latestReportResults
                    : (
                        window.RG30
                            ?.VerificationEngine
                            ?.latestVerification ||
                        []
                    );

            this.setPhase(
                "Report"
            );

            this.renderV30Report(
                summary,
                results
            );

            this.scrollToElement(
                "reportPanel"
            );

            return;

        }

        this.writeCommander(

            this.text(

                "V30 received the command and will run a fresh multi-source verification cycle.",

                "استلم نظام V30 الأمر، وسيتم تشغيل دورة تحقق جديدة متعددة المصادر."

            )

        );

        await this.runCycle();

    },

    /* =====================================================
       KPI UPDATES
       ===================================================== */

    updateNationalKPIs(
        summary
    ) {

        if (!summary) {
            return;
        }

        this.setText(
            "nationalRisk",
            `${summary.topRisk || 0}%`
        );

        this.setText(
            "topCity",
            summary.topCity ||
            "--"
        );

        this.setText(
            "verificationConfidenceTop",
            `${summary.nationalConfidence || 0}%`
        );

        this.setStateText(

            "verificationStatusTop",

            summary.nationalStatus ||
            "WAITING",

            "verificationStatus"

        );

        this.setText(
            "verificationAgreementTop",
            `${summary.averageAgreement || 0}%`
        );

        this.setText(
            "verificationEvidenceTop",
            `${summary.averageEvidenceScore || 0}%`
        );

        this.setText(
            "verificationConfidence",
            `${summary.nationalConfidence || 0}%`
        );

        this.setStateText(

            "verificationStatus",

            summary.nationalStatus ||
            "WAITING",

            "verificationStatus"

        );

    },

    setSystemStatus(
        text,
        sizeClass = ""
    ) {

        const element =
            document.getElementById(
                "systemStatus"
            );

        if (!element) {
            return;
        }

        const rawText =
            String(
                text ?? ""
            );

        element.dataset.stateValue =
            rawText;

        element.textContent =
            this.translateSystemStatus(
                rawText
            );

        element.className =
            `kpi-value ${sizeClass}`.trim();

    },

    translateSystemStatus(
        value
    ) {

        const raw =
            String(
                value ?? ""
            )
                .trim();

        const normalized =
            raw.toUpperCase();

        const labels = {

            "V30 INITIALIZING": {
                en:
                    "V30 Initializing",

                ar:
                    "جارٍ تهيئة V30"
            },

            "V30 READY": {
                en:
                    "V30 Ready",

                ar:
                    "نظام V30 جاهز"
            },

            "AUTONOMOUS V30 RUNNING": {
                en:
                    "Autonomous V30 Running",

                ar:
                    "نظام V30 الذاتي يعمل"
            },

            "V30 STOPPED": {
                en:
                    "V30 Stopped",

                ar:
                    "تم إيقاف V30"
            },

            "V30 ENGINE ERROR": {
                en:
                    "V30 Engine Error",

                ar:
                    "خطأ في محركات V30"
            }

        };

        const item =
            labels[
                normalized
            ];

        if (!item) {

            return raw;

        }

        return this.isArabic()
            ? item.ar
            : item.en;

    },

    setPhase(
        phase
    ) {

        const rawPhase =
            String(
                phase ?? ""
            );

        const element =
            document.getElementById(
                "currentPhase"
            );

        if (element) {

            element.dataset.rawPhase =
                rawPhase;

            element.dataset.stateValue =
                rawPhase;

            element.textContent =
                this.getPhaseLabel(
                    rawPhase
                );

        }

        document
            .querySelectorAll(
                "[data-v30-phase]"
            )
            .forEach(
                button => {

                    button.classList.toggle(

                        "active",

                        button
                            .dataset
                            .v30Phase
                            ?.toLowerCase() ===
                        rawPhase
                            .toLowerCase()

                    );

                }
            );

    },

    setText(
        id,
        text
    ) {

        const element =
            document.getElementById(
                id
            );

        if (
            element
        ) {

            element.textContent =
                text;

        }

    },

    setStateText(
        id,
        rawValue,
        stateType = ""
    ) {

        const element =
            document.getElementById(
                id
            );

        if (!element) {
            return;
        }

        const value =
            String(
                rawValue ?? ""
            );

        element.dataset.stateValue =
            value;

        if (
            stateType ===
            "verificationStatus"
        ) {

            element.textContent =
                this.getStatusLabel(
                    value
                );

            return;

        }

        element.textContent =
            value;

    },
       /* =====================================================
       REPORT
       ===================================================== */

    renderV30Report(
        summary,
        results = []
    ) {

        const panel =
            document.getElementById(
                "reportPanel"
            );

        if (!panel) {
            return;
        }

        this.latestReportSummary =
            summary ||
            null;

        this.latestReportResults =
            Array.isArray(
                results
            )
                ? results
                : [];

        if (!summary) {

            panel.innerHTML = `
                <div class="empty-state">

                    ${this.text(

                        "No completed V30 verification cycle is available.",

                        "لا توجد دورة تحقق مكتملة في V30 حتى الآن."

                    )}

                </div>
            `;

            return;

        }

        const sortedResults =
            Array.isArray(
                results
            )
                ? [
                    ...results
                ]
                : [];

        const topResult =
            sortedResults
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

        const action =
            topResult
                ?.decisionGate
                ?.action ||
            "HOLD";

        const reason =
            topResult
                ?.decisionGate
                ?.reason ||
            this.text(

                "No decision reason available.",

                "لا يتوفر سبب للقرار."

            );

        const conflicted =
            this.safeNumber(
                summary
                    .conflictedCities
            );

        const status =
            this.getStatusLabel(

                summary
                    .nationalStatus ||
                "WAITING"

            );

        const generatedAt =
            new Date()
                .toLocaleString(
                    this.getLocale()
                );

        const escapedTopCity =
            this.escapeHtml(

                summary.topCity ||
                "--"

            );

        const escapedReason =
            this.escapeHtml(
                this.translateDecisionReason(
                    reason
                )
            );

        panel.innerHTML = `
            <div class="item success">

                <h2>

                    ${this.text(

                        "V30 National Multi-Source Verification Report",

                        "تقرير V30 الوطني للتحقق متعدد المصادر"

                    )}

                </h2>

                <b>

                    ${this.text(
                        "Generated",
                        "تاريخ الإنشاء"
                    )}:

                </b>

                ${generatedAt}

                <br>

                <b>

                    ${this.text(
                        "National Status",
                        "الحالة الوطنية"
                    )}:

                </b>

                ${status}

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
                        "Conflicted Cities",
                        "المدن ذات التعارض"
                    )}:

                </b>

                ${conflicted}

                <br><br>

                <b>

                    ${this.text(
                        "Highest Risk City",
                        "المدينة الأعلى خطرًا"
                    )}:

                </b>

                ${escapedTopCity}

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
                        "Average Source Agreement",
                        "متوسط اتفاق المصادر"
                    )}:

                </b>

                ${this.safeNumber(
                    summary.averageAgreement
                )}%

                <br>

                <b>

                    ${this.text(
                        "Average Evidence Score",
                        "متوسط درجة الأدلة"
                    )}:

                </b>

                ${this.safeNumber(
                    summary.averageEvidenceScore
                )}%

                <br>

                <b>

                    ${this.text(
                        "National Verification Confidence",
                        "الثقة الوطنية في التحقق"
                    )}:

                </b>

                ${this.safeNumber(
                    summary.nationalConfidence
                )}%

                <br><br>

                <b>

                    ${this.text(
                        "Decision Gate",
                        "بوابة القرار"
                    )}:

                </b>

                ${this.translateDecisionAction(
                    action
                )}

                <br>

                <b>

                    ${this.text(
                        "Decision Reason",
                        "سبب القرار"
                    )}:

                </b>

                ${escapedReason}

                <br><br>

                <b>

                    ${this.text(
                        "Official Source",
                        "المصدر الرسمي"
                    )}:

                </b>

                ${this.text(

                    "Anwaa / National Center for Meteorology",

                    "أنواء / المركز الوطني للأرصاد"

                )}

                <br>

                <b>

                    ${this.text(
                        "Verification Layers",
                        "طبقات التحقق"
                    )}:

                </b>

                ${this.text(

                    "Official source, radar, satellite, lightning, Open-Meteo and local AI model.",

                    "المصدر الرسمي والرادار والأقمار الصناعية والبرق وOpen-Meteo ونموذج الذكاء الاصطناعي المحلي."

                )}

            </div>
        `;

    },

    translateDecisionAction(
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

            MONITOR: {
                en:
                    "MONITOR",

                ar:
                    "مراقبة"
            },

            WATCH: {
                en:
                    "WATCH",

                ar:
                    "متابعة"
            },

            ALERT: {
                en:
                    "ALERT",

                ar:
                    "تنبيه"
            },

            ESCALATE: {
                en:
                    "ESCALATE",

                ar:
                    "تصعيد"
            },

            DISPATCH: {
                en:
                    "DISPATCH",

                ar:
                    "توجيه الفرق"
            },

            VERIFY: {
                en:
                    "VERIFY",

                ar:
                    "طلب تحقق إضافي"
            },

            BLOCK: {
                en:
                    "BLOCK",

                ar:
                    "حجب القرار"
            }

        };

        const item =
            labels[
                value
            ];

        if (!item) {

            return this.escapeHtml(
                action
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

        const exactReasons = {

            "No decision reason available.":
                "لا يتوفر سبب للقرار.",

            "Insufficient evidence.":
                "الأدلة غير كافية.",

            "Low source agreement.":
                "اتفاق المصادر منخفض.",

            "High source conflict.":
                "يوجد تعارض مرتفع بين المصادر.",

            "Verified high risk.":
                "تم التحقق من وجود خطر مرتفع.",

            "Verified critical risk.":
                "تم التحقق من وجود خطر حرج.",

            "Additional verification required.":
                "يلزم إجراء تحقق إضافي.",

            "Evidence supports monitoring.":
                "الأدلة تدعم استمرار المراقبة.",

            "Evidence supports escalation.":
                "الأدلة تدعم التصعيد.",

            "Official source confirmation is missing.":
                "لا يتوفر تأكيد من المصدر الرسمي.",

            "Radar evidence is unavailable.":
                "أدلة الرادار غير متاحة.",

            "Verification confidence is below threshold.":
                "ثقة التحقق أقل من الحد المطلوب."
        };

        if (
            exactReasons[
                value
            ]
        ) {

            return exactReasons[
                value
            ];

        }

        const patterns = [

            {
                pattern:
                    /^Source agreement is (\d+)%\.?$/i,

                replacement:
                    "نسبة اتفاق المصادر هي $1%."
            },

            {
                pattern:
                    /^Verification confidence is (\d+)%\.?$/i,

                replacement:
                    "ثقة التحقق هي $1%."
            },

            {
                pattern:
                    /^Verified risk is (\d+)%\.?$/i,

                replacement:
                    "الخطر المتحقق هو $1%."
            },

            {
                pattern:
                    /^Conflict detected across (\d+) sources?\.?$/i,

                replacement:
                    "تم اكتشاف تعارض بين $1 من المصادر."
            }

        ];

        for (
            const item of patterns
        ) {

            if (
                item.pattern.test(
                    value
                )
            ) {

                return value.replace(
                    item.pattern,
                    item.replacement
                );

            }

        }

        return value;

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
       /* =====================================================
       HEALTH
       ===================================================== */

    renderEngineHealth(
        missingEngines = []
    ) {

        const panel =
            document.getElementById(
                "v30SystemHealth"
            );

        if (!panel) {
            return;
        }

        const totalEngines =
            this.requiredEngines.length;

        const readyCount =
            Math.max(
                0,
                totalEngines -
                missingEngines.length
            );

        const readiness =
            totalEngines > 0
                ? Math.round(
                    (
                        readyCount /
                        totalEngines
                    ) * 100
                )
                : 0;

        const missingNames =
            missingEngines.length
                ? missingEngines
                    .map(
                        engine =>
                            this.getEngineName(
                                engine
                            )
                    )
                    .join(", ")
                : this.text(
                    "None",
                    "لا يوجد"
                );

        panel.innerHTML = `
            <div class="item ${
                readiness === 100
                    ? "success"
                    : "warning"
            }">

                <h3>

                    ${this.text(
                        "V30 System Readiness",
                        "جاهزية نظام V30"
                    )}

                </h3>

                <b>

                    ${this.text(
                        "Readiness",
                        "نسبة الجاهزية"
                    )}:

                </b>

                ${readiness}%

                <br>

                <b>

                    ${this.text(
                        "Engines Ready",
                        "المحركات الجاهزة"
                    )}:

                </b>

                ${readyCount}/${totalEngines}

                <br>

                <b>

                    ${this.text(
                        "Missing Engines",
                        "المحركات المفقودة"
                    )}:

                </b>

                ${this.escapeHtml(
                    missingNames
                )}

            </div>
        `;

    },

    /* =====================================================
       COMMANDER LOG
       ===================================================== */

    writeCommander(
        message,
        type = "success"
    ) {

        const panel =
            document.getElementById(
                "commanderLog"
            );

        const allowedTypes = [
            "success",
            "info",
            "warning",
            "danger",
            "muted"
        ];

        const safeType =
            allowedTypes.includes(
                type
            )
                ? type
                : "info";

        const translatedMessage =
            this.translateMessage(
                message
            );

        const safeMessage =
            this.escapeHtml(
                translatedMessage
            );

        const time =
            new Date()
                .toLocaleTimeString(
                    this.getLocale()
                );

        if (panel) {

            panel.innerHTML = `
                <div class="item ${safeType}">

                    <b>
                        ${time}
                    </b>

                    <br>

                    ${safeMessage}

                </div>
            ` + panel.innerHTML;

            while (
                panel.children.length >
                40
            ) {

                panel.removeChild(
                    panel.lastElementChild
                );

            }

        }

        console.log(
            `[RainGuard V30] ${translatedMessage}`
        );

    },

    escapeHtml(value) {

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

    scrollToElement(id) {

        const element =
            document.getElementById(
                id
            );

        if (!element) {
            return;
        }

        element.scrollIntoView({

            behavior:
                "smooth",

            block:
                "start"

        });

    },

    /* =====================================================
       PUBLIC STATE
       ===================================================== */

    getState() {

        return {

            version:
                this.version,

            started:
                this.started,

            running:
                this.running,

            cycleInProgress:
                this.cycleInProgress,

            automaticStart:
                this.config
                    .automaticStart,

            cycleInterval:
                this.config
                    .cycleInterval,

            latestCycle:
                this.latestCycle,

            language:
                window.RG30
                    ?.I18n
                    ?.language ||
                "en",

            missingEngines:
                this.getMissingEngines()
                    .map(
                        engine =>
                            this.getEngineName(
                                engine
                            )
                    )

        };

    },

    destroy() {

        this.running =
            false;

        this.cycleInProgress =
            false;

        if (
            this.intervalId
        ) {

            window.clearInterval(
                this.intervalId
            );

            this.intervalId =
                null;

        }

        this.started =
            false;

        this.latestCycle =
            null;

        this.latestReportSummary =
            null;

        this.latestReportResults =
            [];

        this.setSystemStatus(

            this.text(
                "V30 Stopped",
                "تم إيقاف V30"
            ),

            "small"

        );

        this.setPhase(
            "Stopped"
        );

        console.log(
            "RG30 Orchestrator destroyed."
        );

    }

};


/* =========================================================
   INITIALIZATION
   ========================================================= */

window.addEventListener(

    "load",

    () => {

        try {

            window.RG30
                ?.Orchestrator
                ?.init();

        } catch (error) {

            console.error(
                "RG30 Orchestrator initialization failed:",
                error
            );

        }

    }

);


/* =========================================================
   GLOBAL SHORTCUTS
   ========================================================= */

window.startV30 =
    function () {

        return window.RG30
            ?.Orchestrator
            ?.start();

    };


window.stopV30 =
    function () {

        return window.RG30
            ?.Orchestrator
            ?.stop();

    };


window.runV30Cycle =
    function () {

        return window.RG30
            ?.Orchestrator
            ?.runCycle();

    };


window.getV30State =
    function () {

        return window.RG30
            ?.Orchestrator
            ?.getState();

    };


console.log(

    "%cRainGuard AI V30 Orchestrator 30.1.0 Bilingual Ready",

    "color:#16c8ff;font-weight:bold;font-size:14px;"

);
