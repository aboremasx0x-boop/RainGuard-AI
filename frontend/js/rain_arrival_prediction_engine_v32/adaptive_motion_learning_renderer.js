/*
===========================================================
 RainGuard AI V32
 Phase 38M-19B — Adaptive Motion Learning Renderer
 File: adaptive_motion_learning_renderer.js
 Version: 32.38M.19B

 Purpose:
 - Render Adaptive Motion Learning statistics in the UI.
 - Show learning quality, profile count, error metrics and city summaries.
 - Work safely even if no dedicated container exists.
===========================================================
*/

(function (global) {
    "use strict";

    const MODULE_NAME = "adaptiveMotionLearningRenderer";
    const VERSION = "32.38M.19B";
    const BUILD_ID =
        "rainguard-v32-phase38m19b-adaptive-motion-learning-renderer";

    const DEFAULT_CONFIG = Object.freeze({
        autoStart: true,
        renderIntervalMs: 20000,
        containerId: "adaptive-motion-learning-panel",
        maximumCities: 8,
        injectStyles: true,
        debug: true
    });

    function cloneValue(value) {
        if (value === null || value === undefined) return value;

        if (typeof structuredClone === "function") {
            try {
                return structuredClone(value);
            } catch (_) {}
        }

        try {
            return JSON.parse(JSON.stringify(value));
        } catch (_) {
            return value;
        }
    }

    function escapeHtml(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function displayNumber(value, digits = 1, suffix = "") {
        const number = Number(value);

        if (!Number.isFinite(number)) {
            return "--";
        }

        return `${number.toFixed(digits)}${suffix}`;
    }

    function qualityLabel(quality) {
        const labels = {
            EXCELLENT: "ممتاز",
            GOOD: "جيد",
            NEEDS_ADAPTATION: "يحتاج تعلماً إضافياً",
            UNSTABLE: "غير مستقر",
            INSUFFICIENT_DATA: "بيانات غير كافية",
            NO_DATA: "لا توجد بيانات"
        };

        return labels[String(quality ?? "").toUpperCase()] ?? quality ?? "--";
    }

    class AdaptiveMotionLearningRenderer {
        constructor(config = {}) {
            this.version = VERSION;
            this.buildId = BUILD_ID;

            this.config = {
                ...DEFAULT_CONFIG,
                ...(config || {})
            };

            this.running = false;
            this.rendering = false;
            this.timer = null;
            this.latestResult = null;
            this.lastError = null;

            this.statistics = {
                renderRuns: 0,
                successfulRuns: 0,
                failedRuns: 0,
                busySkips: 0,
                containerMissingCount: 0
            };
        }

        resolveStatistics() {
            return (
                global.RainArrivalAdaptiveMotionLearningStatisticsV32 ??
                null
            );
        }

        ensureStyles() {
            if (!this.config.injectStyles) return;

            const id = "rainarrival-adaptive-learning-styles";

            if (document.getElementById(id)) return;

            const style = document.createElement("style");
            style.id = id;

            style.textContent = `
                #${this.config.containerId}.rainarrival-adaptive-learning {
                    direction: rtl;
                    font-family: inherit;
                    background: rgba(7, 29, 54, .96);
                    border: 1px solid rgba(54, 151, 255, .38);
                    border-radius: 18px;
                    padding: 16px;
                    color: #eef7ff;
                    box-sizing: border-box;
                }

                #${this.config.containerId} .ral-title {
                    font-size: 20px;
                    font-weight: 800;
                    margin-bottom: 4px;
                }

                #${this.config.containerId} .ral-subtitle {
                    opacity: .72;
                    font-size: 12px;
                    margin-bottom: 14px;
                }

                #${this.config.containerId} .ral-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(135px, 1fr));
                    gap: 10px;
                    margin-bottom: 14px;
                }

                #${this.config.containerId} .ral-card {
                    background: rgba(255,255,255,.055);
                    border: 1px solid rgba(76, 169, 255, .24);
                    border-radius: 14px;
                    padding: 11px;
                }

                #${this.config.containerId} .ral-label {
                    font-size: 11px;
                    opacity: .7;
                    margin-bottom: 5px;
                }

                #${this.config.containerId} .ral-value {
                    font-size: 19px;
                    font-weight: 800;
                }

                #${this.config.containerId} .ral-table-wrap {
                    overflow-x: auto;
                }

                #${this.config.containerId} table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 12px;
                }

                #${this.config.containerId} th,
                #${this.config.containerId} td {
                    border-bottom: 1px solid rgba(255,255,255,.08);
                    padding: 8px 6px;
                    text-align: right;
                    white-space: nowrap;
                }

                #${this.config.containerId} th {
                    opacity: .75;
                    font-weight: 700;
                }

                #${this.config.containerId} .ral-empty {
                    padding: 18px;
                    text-align: center;
                    opacity: .7;
                }
            `;

            document.head.appendChild(style);
        }

        getContainer() {
            return document.getElementById(
                this.config.containerId
            );
        }

        buildHtml(result) {
            if (!result) {
                return `
                    <div class="ral-empty">
                        لا توجد نتائج تعلم تكيفي حتى الآن.
                    </div>
                `;
            }

            const globalStats =
                result.globalStatistics ?? {};

            const positionError =
                globalStats.positionErrorKm ?? {};

            const speedError =
                globalStats.absoluteSpeedErrorKmh ?? {};

            const bearingError =
                globalStats.absoluteBearingErrorDegrees ?? {};

            const profileStats =
                result.profileStatistics ?? {};

            const cities =
                Array.isArray(result.citySummaries)
                    ? result.citySummaries.slice(
                        0,
                        this.config.maximumCities
                    )
                    : [];

            const cityRows =
                cities.length
                    ? cities.map(city => `
                        <tr>
                            <td>${escapeHtml(city.key)}</td>
                            <td>${escapeHtml(qualityLabel(city.quality))}</td>
                            <td>${escapeHtml(city.sampleCount ?? 0)}</td>
                            <td>${escapeHtml(displayNumber(city.positionError?.mean, 2, " km"))}</td>
                            <td>${escapeHtml(displayNumber(city.absoluteSpeedError?.mean, 2, " km/h"))}</td>
                            <td>${escapeHtml(displayNumber(city.absoluteBearingError?.mean, 1, "°"))}</td>
                        </tr>
                    `).join("")
                    : `
                        <tr>
                            <td colspan="6" style="text-align:center;opacity:.7">
                                لا توجد بيانات مدن كافية بعد.
                            </td>
                        </tr>
                    `;

            return `
                <div class="ral-title">
                    التعلم التكيفي لحركة العواصف
                </div>

                <div class="ral-subtitle">
                    Phase 38M-19B — Adaptive Motion Learning
                </div>

                <div class="ral-grid">
                    <div class="ral-card">
                        <div class="ral-label">حالة التعلم</div>
                        <div class="ral-value">${escapeHtml(qualityLabel(result.globalQuality))}</div>
                    </div>

                    <div class="ral-card">
                        <div class="ral-label">عينات التعلم</div>
                        <div class="ral-value">${escapeHtml(result.sampleCount ?? 0)}</div>
                    </div>

                    <div class="ral-card">
                        <div class="ral-label">ملفات التصحيح</div>
                        <div class="ral-value">${escapeHtml(profileStats.profileCount ?? 0)}</div>
                    </div>

                    <div class="ral-card">
                        <div class="ral-label">ملفات موثوقة</div>
                        <div class="ral-value">${escapeHtml(profileStats.reliableProfileCount ?? 0)}</div>
                    </div>

                    <div class="ral-card">
                        <div class="ral-label">متوسط خطأ الموقع</div>
                        <div class="ral-value">${escapeHtml(displayNumber(positionError.mean, 2, " km"))}</div>
                    </div>

                    <div class="ral-card">
                        <div class="ral-label">متوسط خطأ السرعة</div>
                        <div class="ral-value">${escapeHtml(displayNumber(speedError.mean, 2, " km/h"))}</div>
                    </div>

                    <div class="ral-card">
                        <div class="ral-label">متوسط خطأ الاتجاه</div>
                        <div class="ral-value">${escapeHtml(displayNumber(bearingError.mean, 1, "°"))}</div>
                    </div>

                    <div class="ral-card">
                        <div class="ral-label">عدد المدن</div>
                        <div class="ral-value">${escapeHtml(result.cityCount ?? 0)}</div>
                    </div>
                </div>

                <div class="ral-table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>المدينة</th>
                                <th>الجودة</th>
                                <th>العينات</th>
                                <th>خطأ الموقع</th>
                                <th>خطأ السرعة</th>
                                <th>خطأ الاتجاه</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${cityRows}
                        </tbody>
                    </table>
                </div>
            `;
        }

        render() {
            if (this.rendering) {
                this.statistics.busySkips += 1;

                return {
                    success: false,
                    status:
                        "ADAPTIVE_MOTION_LEARNING_RENDERER_BUSY",
                    version:
                        this.version,
                    build:
                        this.buildId
                };
            }

            const startedAt =
                Date.now();

            this.rendering =
                true;

            this.statistics.renderRuns +=
                1;

            try {
                const statistics =
                    this.resolveStatistics();

                if (!statistics) {
                    throw new Error(
                        "Adaptive Motion Learning Statistics module is unavailable."
                    );
                }

                let result =
                    statistics.getLatestResult?.() ??
                    null;

                if (!result) {
                    result =
                        statistics.analyze?.() ??
                        null;
                }

                this.ensureStyles();

                const container =
                    this.getContainer();

                if (!container) {
                    this.statistics.containerMissingCount += 1;

                    const rendererResult = {
                        success: true,
                        status:
                            "ADAPTIVE_MOTION_LEARNING_RENDERER_NO_CONTAINER",
                        version:
                            this.version,
                        build:
                            this.buildId,
                        statisticsStatus:
                            result?.status ?? null,
                        containerId:
                            this.config.containerId,
                        startedAt,
                        completedAt:
                            Date.now(),
                        durationMs:
                            Date.now() - startedAt
                    };

                    this.latestResult =
                        cloneValue(
                            rendererResult
                        );

                    this.publish(
                        rendererResult
                    );

                    return rendererResult;
                }

                container.classList.add(
                    "rainarrival-adaptive-learning"
                );

                container.innerHTML =
                    this.buildHtml(
                        result
                    );

                const rendererResult = {
                    success: true,
                    status:
                        "ADAPTIVE_MOTION_LEARNING_RENDER_COMPLETED",
                    version:
                        this.version,
                    build:
                        this.buildId,
                    containerId:
                        this.config.containerId,
                    statisticsStatus:
                        result?.status ?? null,
                    sampleCount:
                        result?.sampleCount ?? 0,
                    cityCount:
                        result?.cityCount ?? 0,
                    globalQuality:
                        result?.globalQuality ?? null,
                    startedAt,
                    completedAt:
                        Date.now(),
                    durationMs:
                        Date.now() - startedAt
                };

                this.latestResult =
                    cloneValue(
                        rendererResult
                    );

                this.statistics.successfulRuns +=
                    1;

                this.publish(
                    rendererResult
                );

                if (this.config.debug) {
                    console.log(
                        "[RainArrival AdaptiveMotionLearningRenderer] Render result:",
                        rendererResult
                    );
                }

                return rendererResult;

            } catch (error) {
                this.statistics.failedRuns +=
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
                        Date.now()
                };

                const result = {
                    success: false,
                    status:
                        "ADAPTIVE_MOTION_LEARNING_RENDER_FAILED",
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
                        Date.now(),
                    durationMs:
                        Date.now() - startedAt
                };

                this.latestResult =
                    cloneValue(
                        result
                    );

                return result;

            } finally {
                this.rendering =
                    false;
            }
        }

        publish(result) {
            global.RainArrivalAdaptiveMotionLearningRendererResult =
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
                .adaptiveMotionLearningRenderer =
                cloneValue(
                    result
                );

            global.dispatchEvent?.(
                new CustomEvent(
                    "rainarrival:adaptive-motion-learning-rendered",
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
                    this.config.containerId,
                containerAvailable:
                    Boolean(
                        this.getContainer()
                    ),
                latestResult:
                    this.getLatestResult(),
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
                this.getDiagnostics();

            console.log(
                "[RainArrival AdaptiveMotionLearningRenderer]",
                diagnostics
            );

            return diagnostics;
        }

        start() {
            if (this.running) {
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
                        this.render(),
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
            if (this.timer) {
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
        new AdaptiveMotionLearningRenderer();

    global.RainArrivalAdaptiveMotionLearningRendererV32 =
        renderer;

    global.RainGuardAI =
        global.RainGuardAI ||
        {};

    global.RainGuardAI.V32 =
        global.RainGuardAI.V32 ||
        {};

    global.RainGuardAI.V32.rainArrivalModules =
        global.RainGuardAI.V32.rainArrivalModules ||
        {};

    global.RainGuardAI.V32
        .rainArrivalModules
        .adaptiveMotionLearningRenderer =
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

    global.renderRainArrivalAdaptiveMotionLearning =
        () =>
            renderer.render();

    if (
        renderer.config.autoStart
    ) {
        renderer.start();
    }

    console.log(
        "[RainGuard AI V32] Adaptive Motion Learning Renderer loaded.",
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
