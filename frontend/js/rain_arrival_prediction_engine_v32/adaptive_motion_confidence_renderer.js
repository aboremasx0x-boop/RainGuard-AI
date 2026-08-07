/*
===========================================================
 RainGuard AI V32
 Phase 38M-19C — Adaptive Motion Confidence Renderer
 File: adaptive_motion_confidence_renderer.js
 Version: 32.38M.19C

 Purpose:
 - Render Adaptive Motion Confidence statistics.
 - Show national confidence, evidence coverage and city ranking.
 - Work safely if no dedicated HTML container exists.
===========================================================
*/

(function (global) {
    "use strict";

    const MODULE_NAME =
        "adaptiveMotionConfidenceRenderer";

    const VERSION =
        "32.38M.19C";

    const BUILD_ID =
        "rainguard-v32-phase38m19c-adaptive-motion-confidence-renderer";

    const DEFAULT_CONFIG =
        Object.freeze({
            autoStart: true,
            renderIntervalMs: 24000,
            containerId:
                "adaptive-motion-confidence-panel",
            maximumCities: 10,
            maximumComponents: 7,
            injectStyles: true,
            debug: true
        });

    const now =
        () => Date.now();

    function cloneValue(value) {
        if (
            value === null ||
            value === undefined
        ) {
            return value;
        }

        if (
            typeof structuredClone ===
            "function"
        ) {
            try {
                return structuredClone(
                    value
                );
            } catch (_) {}
        }

        try {
            return JSON.parse(
                JSON.stringify(
                    value
                )
            );
        } catch (_) {
            return value;
        }
    }

    function escapeHtml(value) {
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
            '"',
            "&quot;"
        )
        .replaceAll(
            "'",
            "&#039;"
        );
    }

    function displayNumber(
        value,
        digits = 1,
        suffix = ""
    ) {
        const number =
            Number(value);

        if (
            !Number.isFinite(
                number
            )
        ) {
            return "--";
        }

        return (
            number.toFixed(
                digits
            ) +
            suffix
        );
    }

    function qualityArabic(
        quality
    ) {
        const map = {
            EXCELLENT:
                "ممتاز",

            GOOD:
                "جيد",

            MODERATE:
                "متوسط",

            WEAK:
                "ضعيف",

            UNRELIABLE:
                "غير موثوق",

            INSUFFICIENT_DATA:
                "بيانات غير كافية",

            NO_DATA:
                "لا توجد بيانات"
        };

        return (
            map[
                String(
                    quality ??
                    ""
                )
                .toUpperCase()
            ] ??
            quality ??
            "--"
        );
    }

    function componentArabic(
        component
    ) {
        const map = {
            predictionConfidence:
                "ثقة التنبؤ",

            adaptiveLearningQuality:
                "جودة التعلم التكيفي",

            historicalTrackQuality:
                "جودة سجل المسار",

            vectorStability:
                "ثبات متجه الحركة",

            sourceAgreement:
                "توافق المصادر",

            identityStability:
                "ثبات هوية الخلية",

            approachEvidence:
                "دليل الاقتراب"
        };

        return (
            map[
                component
            ] ??
            component
        );
    }

    class AdaptiveMotionConfidenceRenderer {

        constructor(config = {}) {
            this.version =
                VERSION;

            this.buildId =
                BUILD_ID;

            this.config = {
                ...DEFAULT_CONFIG,
                ...(config || {})
            };

            this.running =
                false;

            this.rendering =
                false;

            this.timer =
                null;

            this.latestResult =
                null;

            this.lastError =
                null;

            this.statistics = {
                renderRuns:
                    0,

                successfulRuns:
                    0,

                failedRuns:
                    0,

                busySkips:
                    0,

                containerMissingCount:
                    0
            };
        }

        resolveStatistics() {
            return (
                global
                    .RainArrivalAdaptiveMotionConfidenceStatisticsV32 ??
                null
            );
        }

        getContainer() {
            return (
                document
                    .getElementById(
                        this.config
                            .containerId
                    )
            );
        }

        ensureStyles() {
            if (
                !this.config
                    .injectStyles
            ) {
                return;
            }

            const styleId =
                "rainarrival-adaptive-motion-confidence-styles";

            if (
                document
                    .getElementById(
                        styleId
                    )
            ) {
                return;
            }

            const style =
                document
                    .createElement(
                        "style"
                    );

            style.id =
                styleId;

            style.textContent = `
                #${this.config.containerId}.ramc-panel {
                    direction: rtl;
                    color: #edf7ff;
                    background: rgba(5, 24, 44, .96);
                    border: 1px solid rgba(70, 160, 255, .30);
                    border-radius: 18px;
                    padding: 16px;
                    box-sizing: border-box;
                }

                #${this.config.containerId} .ramc-header {
                    display: flex;
                    justify-content: space-between;
                    gap: 12px;
                    align-items: center;
                    flex-wrap: wrap;
                    margin-bottom: 14px;
                }

                #${this.config.containerId} .ramc-title {
                    font-size: 20px;
                    font-weight: 800;
                }

                #${this.config.containerId} .ramc-subtitle {
                    opacity: .68;
                    font-size: 12px;
                    margin-top: 3px;
                }

                #${this.config.containerId} .ramc-score {
                    font-size: 28px;
                    font-weight: 900;
                    white-space: nowrap;
                }

                #${this.config.containerId} .ramc-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
                    gap: 10px;
                    margin-bottom: 14px;
                }

                #${this.config.containerId} .ramc-card {
                    padding: 11px;
                    border-radius: 14px;
                    background: rgba(255,255,255,.05);
                    border: 1px solid rgba(90,170,255,.18);
                }

                #${this.config.containerId} .ramc-label {
                    font-size: 11px;
                    opacity: .68;
                    margin-bottom: 5px;
                }

                #${this.config.containerId} .ramc-value {
                    font-size: 18px;
                    font-weight: 800;
                }

                #${this.config.containerId} .ramc-section-title {
                    font-size: 14px;
                    font-weight: 800;
                    margin: 14px 0 8px;
                }

                #${this.config.containerId} .ramc-table-wrap {
                    overflow-x: auto;
                }

                #${this.config.containerId} table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 12px;
                }

                #${this.config.containerId} th,
                #${this.config.containerId} td {
                    padding: 8px 6px;
                    text-align: right;
                    border-bottom: 1px solid rgba(255,255,255,.07);
                    white-space: nowrap;
                }

                #${this.config.containerId} th {
                    opacity: .72;
                    font-weight: 700;
                }

                #${this.config.containerId} .ramc-bar {
                    height: 7px;
                    border-radius: 999px;
                    background: rgba(255,255,255,.10);
                    overflow: hidden;
                    margin-top: 6px;
                }

                #${this.config.containerId} .ramc-bar > span {
                    display: block;
                    height: 100%;
                    border-radius: inherit;
                    background: currentColor;
                }

                #${this.config.containerId} .ramc-empty {
                    padding: 20px;
                    text-align: center;
                    opacity: .7;
                }
            `;

            document.head
                .appendChild(
                    style
                );
        }

        buildComponentRows(
            componentStatistics
        ) {
            const entries =
                Object.entries(
                    componentStatistics ??
                    {}
                )
                .slice(
                    0,
                    this.config
                        .maximumComponents
                );

            if (
                !entries.length
            ) {
                return `
                    <tr>
                        <td colspan="5" style="text-align:center;opacity:.7">
                            لا توجد بيانات كافية لمكونات الثقة.
                        </td>
                    </tr>
                `;
            }

            return entries
                .map(
                    (
                        [
                            name,
                            stats
                        ]
                    ) => {
                        const mean =
                            Number(
                                stats?.mean ??
                                0
                            );

                        const safeMean =
                            Number.isFinite(
                                mean
                            )
                                ? Math.max(
                                    0,
                                    Math.min(
                                        100,
                                        mean
                                    )
                                )
                                : 0;

                        return `
                            <tr>
                                <td>${escapeHtml(componentArabic(name))}</td>
                                <td>${escapeHtml(stats?.count ?? 0)}</td>
                                <td>${escapeHtml(displayNumber(stats?.mean, 1, "%"))}</td>
                                <td>${escapeHtml(displayNumber(stats?.median, 1, "%"))}</td>
                                <td style="min-width:120px">
                                    ${escapeHtml(displayNumber(safeMean, 1, "%"))}
                                    <div class="ramc-bar">
                                        <span style="width:${safeMean}%"></span>
                                    </div>
                                </td>
                            </tr>
                        `;
                    }
                )
                .join("");
        }

        buildCityRows(
            citySummaries
        ) {
            const cities =
                Array.isArray(
                    citySummaries
                )
                    ? citySummaries
                        .slice(
                            0,
                            this.config
                                .maximumCities
                        )
                    : [];

            if (
                !cities.length
            ) {
                return `
                    <tr>
                        <td colspan="7" style="text-align:center;opacity:.7">
                            لا توجد بيانات مدن كافية بعد.
                        </td>
                    </tr>
                `;
            }

            return cities
                .map(
                    city => `
                        <tr>
                            <td>${escapeHtml(city.city)}</td>
                            <td>${escapeHtml(city.sampleCount ?? 0)}</td>
                            <td>${escapeHtml(displayNumber(city.confidence?.mean, 1, "%"))}</td>
                            <td>${escapeHtml(displayNumber(city.confidence?.median, 1, "%"))}</td>
                            <td>${escapeHtml(displayNumber(city.acceptedRatio, 1, "%"))}</td>
                            <td>${escapeHtml(displayNumber(city.strongRatio, 1, "%"))}</td>
                            <td>${escapeHtml(qualityArabic(city.quality))}</td>
                        </tr>
                    `
                )
                .join("");
        }

        buildHtml(
            result
        ) {
            if (!result) {
                return `
                    <div class="ramc-empty">
                        لا توجد نتائج Adaptive Motion Confidence حتى الآن.
                    </div>
                `;
            }

            const confidence =
                result.confidence ??
                {};

            const evidence =
                result.evidenceCoverage ??
                {};

            const topConfidence =
                result.topConfidence ??
                null;

            const topScore =
                topConfidence
                    ?.confidence ??
                confidence.mean ??
                null;

            return `
                <div class="ramc-header">
                    <div>
                        <div class="ramc-title">
                            ثقة الحركة التكيفية
                        </div>

                        <div class="ramc-subtitle">
                            Phase 38M-19C — Adaptive Motion Confidence Engine
                        </div>
                    </div>

                    <div class="ramc-score">
                        ${escapeHtml(displayNumber(topScore, 1, "%"))}
                    </div>
                </div>

                <div class="ramc-grid">
                    <div class="ramc-card">
                        <div class="ramc-label">الجودة الوطنية</div>
                        <div class="ramc-value">
                            ${escapeHtml(qualityArabic(result.nationalQuality))}
                        </div>
                    </div>

                    <div class="ramc-card">
                        <div class="ramc-label">متوسط الثقة</div>
                        <div class="ramc-value">
                            ${escapeHtml(displayNumber(confidence.mean, 1, "%"))}
                        </div>
                    </div>

                    <div class="ramc-card">
                        <div class="ramc-label">وسيط الثقة</div>
                        <div class="ramc-value">
                            ${escapeHtml(displayNumber(confidence.median, 1, "%"))}
                        </div>
                    </div>

                    <div class="ramc-card">
                        <div class="ramc-label">تغطية الأدلة</div>
                        <div class="ramc-value">
                            ${escapeHtml(displayNumber(evidence.mean, 1, "%"))}
                        </div>
                    </div>

                    <div class="ramc-card">
                        <div class="ramc-label">التوقعات المقبولة</div>
                        <div class="ramc-value">
                            ${escapeHtml(displayNumber(result.acceptedRatio, 1, "%"))}
                        </div>
                    </div>

                    <div class="ramc-card">
                        <div class="ramc-label">ثقة قوية</div>
                        <div class="ramc-value">
                            ${escapeHtml(displayNumber(result.strongRatio, 1, "%"))}
                        </div>
                    </div>

                    <div class="ramc-card">
                        <div class="ramc-label">ثقة قوية جدًا</div>
                        <div class="ramc-value">
                            ${escapeHtml(displayNumber(result.veryStrongRatio, 1, "%"))}
                        </div>
                    </div>

                    <div class="ramc-card">
                        <div class="ramc-label">أدلة ضعيفة</div>
                        <div class="ramc-value">
                            ${escapeHtml(displayNumber(result.weakEvidenceRatio, 1, "%"))}
                        </div>
                    </div>
                </div>

                <div class="ramc-section-title">
                    ترتيب المدن حسب الثقة
                </div>

                <div class="ramc-table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>المدينة</th>
                                <th>العينات</th>
                                <th>متوسط الثقة</th>
                                <th>الوسيط</th>
                                <th>مقبول</th>
                                <th>قوي</th>
                                <th>الجودة</th>
                            </tr>
                        </thead>

                        <tbody>
                            ${this.buildCityRows(result.citySummaries)}
                        </tbody>
                    </table>
                </div>

                <div class="ramc-section-title">
                    مكونات درجة الثقة
                </div>

                <div class="ramc-table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>المكوّن</th>
                                <th>العدد</th>
                                <th>المتوسط</th>
                                <th>الوسيط</th>
                                <th>القوة</th>
                            </tr>
                        </thead>

                        <tbody>
                            ${this.buildComponentRows(result.componentStatistics)}
                        </tbody>
                    </table>
                </div>
            `;
        }

        render() {
            if (
                this.rendering
            ) {
                this.statistics
                    .busySkips +=
                    1;

                return {
                    success:
                        false,

                    status:
                        "ADAPTIVE_MOTION_CONFIDENCE_RENDERER_BUSY",

                    version:
                        this.version,

                    build:
                        this.buildId
                };
            }

            const startedAt =
                now();

            this.rendering =
                true;

            this.statistics
                .renderRuns +=
                1;

            try {
                const statistics =
                    this
                        .resolveStatistics();

                if (
                    !statistics
                ) {
                    throw new Error(
                        "Adaptive Motion Confidence Statistics is unavailable."
                    );
                }

                let result =
                    statistics
                        .getLatestResult?.() ??
                    null;

                if (
                    !result
                ) {
                    result =
                        statistics
                            .analyze?.() ??
                        null;
                }

                this.ensureStyles();

                const container =
                    this
                        .getContainer();

                if (
                    !container
                ) {
                    this.statistics
                        .containerMissingCount +=
                        1;

                    const renderResult = {
                        success:
                            true,

                        status:
                            "ADAPTIVE_MOTION_CONFIDENCE_RENDERER_NO_CONTAINER",

                        version:
                            this.version,

                        build:
                            this.buildId,

                        containerId:
                            this.config
                                .containerId,

                        statisticsStatus:
                            result?.status ??
                            null,

                        startedAt,

                        completedAt:
                            now(),

                        durationMs:
                            now() -
                            startedAt
                    };

                    this.latestResult =
                        cloneValue(
                            renderResult
                        );

                    this.publish(
                        renderResult
                    );

                    return renderResult;
                }

                container.classList.add(
                    "ramc-panel"
                );

                container.innerHTML =
                    this.buildHtml(
                        result
                    );

                const renderResult = {
                    success:
                        true,

                    status:
                        "ADAPTIVE_MOTION_CONFIDENCE_RENDER_COMPLETED",

                    version:
                        this.version,

                    build:
                        this.buildId,

                    containerId:
                        this.config
                            .containerId,

                    statisticsStatus:
                        result?.status ??
                        null,

                    recordCount:
                        result?.recordCount ??
                        0,

                    nationalQuality:
                        result?.nationalQuality ??
                        null,

                    averageConfidence:
                        result?.confidence
                            ?.mean ??
                        null,

                    topConfidence:
                        result?.topConfidence
                            ?.confidence ??
                        null,

                    cityCount:
                        result?.cityCount ??
                        0,

                    startedAt,

                    completedAt:
                        now(),

                    durationMs:
                        now() -
                        startedAt
                };

                this.latestResult =
                    cloneValue(
                        renderResult
                    );

                this.statistics
                    .successfulRuns +=
                    1;

                this.publish(
                    renderResult
                );

                if (
                    this.config.debug
                ) {
                    console.log(
                        "[RainArrival AdaptiveMotionConfidenceRenderer] Render result:",
                        renderResult
                    );
                }

                return renderResult;

            } catch (error) {
                this.statistics
                    .failedRuns +=
                    1;

                this.lastError = {
                    name:
                        error?.name ??
                        "Error",

                    message:
                        error?.message ??
                        String(error),

                    stack:
                        error?.stack ??
                        null,

                    timestamp:
                        now()
                };

                const renderResult = {
                    success:
                        false,

                    status:
                        "ADAPTIVE_MOTION_CONFIDENCE_RENDER_FAILED",

                    version:
                        this.version,

                    build:
                        this.buildId,

                    error:
                        cloneValue(
                            this.lastError
                        ),

                    startedAt,

                    completedAt:
                        now(),

                    durationMs:
                        now() -
                        startedAt
                };

                this.latestResult =
                    cloneValue(
                        renderResult
                    );

                return renderResult;

            } finally {
                this.rendering =
                    false;
            }
        }

        publish(
            result
        ) {
            global
                .RainArrivalAdaptiveMotionConfidenceRendererResult =
                cloneValue(
                    result
                );

            global.RainGuardAI =
                global.RainGuardAI ||
                {};

            global.RainGuardAI.V32 =
                global.RainGuardAI.V32 ||
                {};

            global.RainGuardAI.V32
                .adaptiveMotionConfidenceRenderer =
                cloneValue(
                    result
                );

            global.dispatchEvent?.(
                new CustomEvent(
                    "rainarrival:adaptive-motion-confidence-rendered",
                    {
                        detail:
                            cloneValue(
                                result
                            )
                    }
                )
            );

            return result;
        }

        getLatestResult() {
            return cloneValue(
                this.latestResult
            );
        }

        getDiagnostics() {
            return {
                module:
                    MODULE_NAME,

                version:
                    this.version,

                build:
                    this.buildId,

                installed:
                    true,

                running:
                    this.running,

                rendering:
                    this.rendering,

                containerId:
                    this.config
                        .containerId,

                containerAvailable:
                    Boolean(
                        this
                            .getContainer()
                    ),

                statisticsAvailable:
                    Boolean(
                        this
                            .resolveStatistics()
                    ),

                latestResult:
                    this
                        .getLatestResult(),

                lastError:
                    cloneValue(
                        this.lastError
                    ),

                statistics:
                    cloneValue(
                        this.statistics
                    ),

                config:
                    cloneValue(
                        this.config
                    )
            };
        }

        diagnose() {
            const diagnostics =
                this
                    .getDiagnostics();

            console.log(
                "[RainArrival AdaptiveMotionConfidenceRenderer]",
                diagnostics
            );

            return diagnostics;
        }

        clear() {
            const container =
                this
                    .getContainer();

            if (
                container
            ) {
                container.innerHTML =
                    `
                        <div class="ramc-empty">
                            Adaptive Motion Confidence cleared.
                        </div>
                    `;
            }

            this.latestResult =
                null;

            return {
                success:
                    true,

                status:
                    "ADAPTIVE_MOTION_CONFIDENCE_RENDERER_CLEARED"
            };
        }

        start() {
            if (
                this.running
            ) {
                return {
                    success:
                        true,

                    alreadyRunning:
                        true
                };
            }

            this.running =
                true;

            this.render();

            this.timer =
                global.setInterval(
                    () =>
                        this
                            .render(),

                    this.config
                        .renderIntervalMs
                );

            return {
                success:
                    true,

                running:
                    true,

                intervalMs:
                    this.config
                        .renderIntervalMs
            };
        }

        stop() {
            if (
                this.timer
            ) {
                global.clearInterval(
                    this.timer
                );
            }

            this.timer =
                null;

            this.running =
                false;

            return {
                success:
                    true,

                running:
                    false
            };
        }
    }

    const renderer =
        new AdaptiveMotionConfidenceRenderer();

    global
        .RainArrivalAdaptiveMotionConfidenceRendererV32 =
        renderer;

    global.RainGuardAI =
        global.RainGuardAI ||
        {};

    global.RainGuardAI.V32 =
        global.RainGuardAI.V32 ||
        {};

    global.RainGuardAI.V32
        .rainArrivalModules =
        global.RainGuardAI.V32
            .rainArrivalModules ||
        {};

    global.RainGuardAI.V32
        .rainArrivalModules
        .adaptiveMotionConfidenceRenderer =
        renderer;

    global.RainArrivalEngineV32
        ?.register?.(
            MODULE_NAME,
            renderer
        );

    global.RainArrivalOrchestratorV32
        ?.register?.(
            MODULE_NAME,
            renderer
        );

    global
        .renderRainArrivalAdaptiveMotionConfidence =
        () =>
            renderer
                .render();

    if (
        renderer.config
            .autoStart
    ) {
        renderer.start();
    }

    console.log(
        "[RainGuard AI V32] Adaptive Motion Confidence Renderer loaded.",
        {
            version:
                VERSION,

            build:
                BUILD_ID
        }
    );

})(
    typeof globalThis !==
        "undefined"
        ? globalThis
        : window
);
