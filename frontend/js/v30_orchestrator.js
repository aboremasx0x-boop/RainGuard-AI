/* =========================================================
   RainGuard AI V30
   National Multi-Source Verification Orchestrator
   File: frontend/js/v30_orchestrator.js
   ========================================================= */

window.RG30 = window.RG30 || {};

RG30.Orchestrator = {

    version: "30.0.0",

    started: false,
    running: false,
    cycleInProgress: false,

    intervalId: null,

    config: {
        automaticStart: true,
        firstRunDelay: 4500,
        cycleInterval: 10 * 60 * 1000,
        engineWaitTimeout: 30000
    },

    latestCycle: null,

    requiredEngines: [
        {
            name: "RG23 Brain",
            test: () => Boolean(
                window.RG23?.Brain?.runFullAnalysis
            )
        },
        {
            name: "V30 Verification Engine",
            test: () => Boolean(
                window.RG30?.VerificationEngine?.run
            )
        }
    ],

    /* =====================================================
       INIT
       ===================================================== */

    init() {
        if (this.started) return;

        this.started = true;

        this.bindButtons();
        this.bindPhaseButtons();
        this.bindEvents();

        this.setSystemStatus(
            "V30 Initializing",
            "small"
        );

        this.writeCommander(
            "V30 orchestrator initialized."
        );

        this.waitForEngines()
            .then(() => {
                this.setSystemStatus(
                    "V30 Ready",
                    "small"
                );

                this.writeCommander(
                    "All V30 required engines are ready."
                );

                if (this.config.automaticStart) {
                    setTimeout(() => {
                        this.start();
                    }, this.config.firstRunDelay);
                }
            })
            .catch(error => {
                console.error(
                    "V30 engine initialization failed:",
                    error
                );

                this.setSystemStatus(
                    "V30 Engine Error",
                    "small"
                );

                this.writeCommander(
                    "V30 startup failed: " + error.message,
                    "danger"
                );
            });
    },

    /* =====================================================
       WAIT FOR ENGINES
       ===================================================== */

    waitForEngines() {
        return new Promise((resolve, reject) => {
            const startedAt = Date.now();

            const check = () => {
                const missing = this.requiredEngines.filter(
                    engine => {
                        try {
                            return !engine.test();
                        } catch (error) {
                            return true;
                        }
                    }
                );

                this.renderEngineHealth(missing);

                if (!missing.length) {
                    resolve(true);
                    return;
                }

                if (
                    Date.now() - startedAt >=
                    this.config.engineWaitTimeout
                ) {
                    reject(
                        new Error(
                            "Missing engines: " +
                            missing
                                .map(engine => engine.name)
                                .join(", ")
                        )
                    );

                    return;
                }

                setTimeout(check, 500);
            };

            check();
        });
    },

    /* =====================================================
       START / STOP
       ===================================================== */

    async start() {
        if (this.running) {
            this.writeCommander(
                "V30 is already running."
            );

            return;
        }

        this.running = true;

        this.setSystemStatus(
            "Autonomous V30 Running"
        );

        this.writeCommander(
            "National Multi-Source Verification V30 started."
        );

        await this.runCycle();

        this.intervalId = setInterval(() => {
            this.runCycle();
        }, this.config.cycleInterval);
    },

    stop() {
        this.running = false;

        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }

        this.setSystemStatus(
            "V30 Stopped",
            "small"
        );

        this.setPhase("Stopped");

        this.writeCommander(
            "V30 autonomous verification stopped.",
            "warning"
        );
    },

    /* =====================================================
       MAIN CYCLE
       ===================================================== */

    async runCycle() {
        if (this.cycleInProgress) {
            this.writeCommander(
                "V30 cycle skipped because another cycle is active.",
                "warning"
            );

            return null;
        }

        this.cycleInProgress = true;

        const startedAt = Date.now();

        try {
            this.setPhase("Observe");

            this.writeCommander(
                "V30 cycle started: collecting national evidence."
            );

            await this.runBaseAnalysis();

            const cities =
                window.RG23?.Brain?.latestCities || [];

            if (!Array.isArray(cities) || !cities.length) {
                throw new Error(
                    "The base analysis returned no cities."
                );
            }

            this.setPhase("Verify");

            this.writeCommander(
                `Running multi-source verification for ${cities.length} cities.`
            );

            const results =
                await RG30.VerificationEngine.run(cities);

            const summary =
                RG30.VerificationEngine.latestNationalSummary;

            this.latestCycle = {
                startedAt: new Date(
                    startedAt
                ).toISOString(),

                completedAt: new Date().toISOString(),

                durationMs: Date.now() - startedAt,

                cities: cities.length,

                results,
                summary
            };

            this.setPhase("Decide");

            this.updateNationalKPIs(summary);
            this.renderV30Report(summary, results);

            this.publishCycle(
                this.latestCycle
            );

            this.writeCommander(
                "V30 cycle completed. " +
                `National confidence: ` +
                `${summary?.nationalConfidence || 0}%.`
            );

            return this.latestCycle;

        } catch (error) {
            console.error(
                "V30 autonomous cycle error:",
                error
            );

            this.writeCommander(
                "V30 cycle error: " +
                error.message,
                "danger"
            );

            this.setPhase("Error");

            return null;

        } finally {
            this.cycleInProgress = false;
        }
    },

    async runBaseAnalysis() {
        const brain = window.RG23?.Brain;

        if (!brain?.runFullAnalysis) {
            throw new Error(
                "RG23 Brain is unavailable."
            );
        }

        await brain.runFullAnalysis();

        const cities = brain.latestCities;

        if (!Array.isArray(cities)) {
            brain.latestCities = [];
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
                    event?.detail?.summary;

                const results =
                    event?.detail?.results || [];

                if (summary) {
                    this.updateNationalKPIs(summary);
                    this.renderV30Report(
                        summary,
                        results
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
    },

    publishCycle(cycle) {
        window.RG30.latestCycle = cycle;

        window.dispatchEvent(
            new CustomEvent(
                "rg30:cycle-completed",
                {
                    detail: cycle
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
            startButton.onclick = () => {
                this.start();
            };
        }

        if (stopButton) {
            stopButton.onclick = () => {
                this.stop();
            };
        }

        if (refreshButton) {
            refreshButton.onclick = () => {
                this.runCycle();
            };
        }

        if (reportButton) {
            reportButton.onclick = () => {
                const summary =
                    RG30.VerificationEngine
                        ?.latestNationalSummary;

                const results =
                    RG30.VerificationEngine
                        ?.latestVerification || [];

                this.renderV30Report(
                    summary,
                    results
                );

                this.scrollToElement(
                    "reportPanel"
                );
            };
        }

        if (sendButton && commanderInput) {
            sendButton.onclick = () => {
                this.handleCommanderCommand(
                    commanderInput.value
                );

                commanderInput.value = "";
            };

            commanderInput.addEventListener(
                "keydown",
                event => {
                    if (event.key === "Enter") {
                        sendButton.click();
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

        buttons.forEach(button => {
            button.addEventListener(
                "click",
                () => {
                    const phase =
                        button.dataset.v30Phase;

                    this.handlePhaseRequest(
                        phase
                    );
                }
            );
        });
    },

    handlePhaseRequest(phase) {
        const normalized =
            String(phase || "")
                .trim()
                .toLowerCase();

        if (
            normalized === "observe" ||
            normalized === "verify" ||
            normalized === "decide"
        ) {
            this.runCycle();
            return;
        }

        if (normalized === "report") {
            const summary =
                RG30.VerificationEngine
                    ?.latestNationalSummary;

            const results =
                RG30.VerificationEngine
                    ?.latestVerification || [];

            this.renderV30Report(
                summary,
                results
            );

            return;
        }

        this.writeCommander(
            `Phase ${phase} is connected to the current V30 verification cycle.`
        );
    },

    handleCommanderCommand(command) {
        const text =
            String(command || "").trim();

        if (!text) return;

        this.writeCommander(
            "Commander: " + text,
            "info"
        );

        const lower =
            text.toLowerCase();

        if (
            lower.includes("stop") ||
            lower.includes("إيقاف")
        ) {
            this.stop();
            return;
        }

        if (
            lower.includes("start") ||
            lower.includes("ابدأ") ||
            lower.includes("تشغيل")
        ) {
            this.start();
            return;
        }

        if (
            lower.includes("report") ||
            lower.includes("تقرير")
        ) {
            const summary =
                RG30.VerificationEngine
                    ?.latestNationalSummary;

            const results =
                RG30.VerificationEngine
                    ?.latestVerification || [];

            this.renderV30Report(
                summary,
                results
            );

            return;
        }

        this.writeCommander(
            "V30 received the command and will run a fresh multi-source verification cycle."
        );

        this.runCycle();
    },

    /* =====================================================
       KPIs
       ===================================================== */

    updateNationalKPIs(summary) {
        if (!summary) return;

        this.setText(
            "nationalRisk",
            `${summary.topRisk || 0}%`
        );

        this.setText(
            "topCity",
            summary.topCity || "--"
        );

        this.setText(
            "verificationConfidenceTop",
            `${summary.nationalConfidence || 0}%`
        );

        this.setText(
            "verificationStatusTop",
            summary.nationalStatus || "WAITING"
        );

        this.setText(
            "verificationAgreementTop",
            `${summary.averageAgreement || 0}%`
        );

        this.setText(
            "verificationEvidenceTop",
            `${summary.averageEvidenceScore || 0}%`
        );
    },

    setSystemStatus(text, sizeClass = "") {
        const element =
            document.getElementById(
                "systemStatus"
            );

        if (!element) return;

        element.textContent = text;
        element.className =
            `kpi-value ${sizeClass}`.trim();
    },

    setPhase(phase) {
        this.setText(
            "currentPhase",
            phase
        );

        document
            .querySelectorAll(
                "[data-v30-phase]"
            )
            .forEach(button => {
                button.classList.toggle(
                    "active",
                    button.dataset.v30Phase
                        ?.toLowerCase() ===
                    String(phase)
                        .toLowerCase()
                );
            });
    },

    setText(id, text) {
        const element =
            document.getElementById(id);

        if (element) {
            element.textContent = text;
        }
    },

    /* =====================================================
       REPORT
       ===================================================== */

    renderV30Report(summary, results = []) {
        const panel =
            document.getElementById(
                "reportPanel"
            );

        if (!panel) return;

        if (!summary) {
            panel.innerHTML = `
                <div class="empty-state">
                    No completed V30 verification cycle is available.
                </div>
            `;

            return;
        }

        const topResult =
            [...results].sort(
                (a, b) =>
                    (b.verifiedRisk || 0) -
                    (a.verifiedRisk || 0)
            )[0];

        const action =
            topResult
                ?.decisionGate
                ?.action || "HOLD";

        const reason =
            topResult
                ?.decisionGate
                ?.reason ||
            "No decision reason available.";

        const conflicted =
            summary.conflictedCities || 0;

        panel.innerHTML = `
            <div class="item success">
                <h2>
                    V30 National Multi-Source Verification Report
                </h2>

                <b>Generated:</b>
                ${new Date().toLocaleString("ar-SA")}
                <br>

                <b>National Status:</b>
                ${summary.nationalStatus}
                <br>

                <b>Cities Analyzed:</b>
                ${summary.cities}
                <br>

                <b>Verified Cities:</b>
                ${summary.verifiedCities}
                <br>

                <b>Supported Cities:</b>
                ${summary.supportedCities}
                <br>

                <b>Conflicted Cities:</b>
                ${conflicted}
                <br><br>

                <b>Highest Risk City:</b>
                ${summary.topCity}
                <br>

                <b>Verified Risk:</b>
                ${summary.topRisk}%
                <br>

                <b>Average Source Agreement:</b>
                ${summary.averageAgreement}%
                <br>

                <b>Average Evidence Score:</b>
                ${summary.averageEvidenceScore}%
                <br>

                <b>National Verification Confidence:</b>
                ${summary.nationalConfidence}%
                <br><br>

                <b>Decision Gate:</b>
                ${action}
                <br>

                <b>Decision Reason:</b>
                ${reason}
                <br><br>

                <b>Official Source:</b>
                Anwaa / National Center for Meteorology
                <br>

                <b>Verification Layers:</b>
                Official source, radar, satellite,
                lightning, Open-Meteo and local AI model.
            </div>
        `;
    },

    /* =====================================================
       HEALTH
       ===================================================== */

    renderEngineHealth(missingEngines = []) {
        const panel =
            document.getElementById(
                "v30SystemHealth"
            );

        if (!panel) return;

        const readyCount =
            this.requiredEngines.length -
            missingEngines.length;

        const readiness =
            Math.round(
                readyCount /
                this.requiredEngines.length *
                100
            );

        panel.innerHTML = `
            <div class="item ${
                readiness === 100
                    ? "success"
                    : "warning"
            }">
                <h3>V30 System Readiness</h3>

                <b>Readiness:</b>
                ${readiness}%
                <br>

                <b>Engines Ready:</b>
                ${readyCount}/${this.requiredEngines.length}
                <br>

                <b>Missing Engines:</b>
                ${
                    missingEngines.length
                        ? missingEngines
                            .map(engine => engine.name)
                            .join(", ")
                        : "None"
                }
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

        const safeType =
            ["success", "info", "warning", "danger"]
                .includes(type)
                ? type
                : "info";

        if (panel) {
            panel.innerHTML = `
                <div class="item ${safeType}">
                    <b>
                        ${new Date().toLocaleTimeString("ar-SA")}
                    </b>
                    <br>
                    ${this.escapeHtml(message)}
                </div>
            ` + panel.innerHTML;
        }

        console.log(
            `[RainGuard V30] ${message}`
        );
    },

    escapeHtml(value) {
        const div =
            document.createElement("div");

        div.textContent =
            String(value ?? "");

        return div.innerHTML;
    },

    scrollToElement(id) {
        const element =
            document.getElementById(id);

        if (element) {
            element.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
        }
    }
};

/* =========================================================
   INITIALIZATION
   ========================================================= */

window.addEventListener(
    "load",
    () => {
        RG30.Orchestrator.init();
    }
);
