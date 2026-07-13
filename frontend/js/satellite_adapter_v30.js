/* ===========================================================
   RainGuard AI V30.1
   National Satellite Adapter
   Version : 30.1.0
   =========================================================== */

"use strict";

window.RG30 = window.RG30 || {};

RG30.SatelliteAdapter = {

    version: "30.1.0",

    initialized: false,

    collecting: false,

    lastCollection: null,

    cache: new Map(),

    statistics: {

        requests: 0,

        success: 0,

        failed: 0,

        cacheHits: 0,

        averageResponse: 0

    },

    config: {

        enabled: true,

        timeout: 15000,

        retry: 2,

        cacheMinutes: 10,

        reliability: 0.90,

        provider: "Satellite Simulation Engine"

    },

    language() {

        return window.RG30?.I18n?.language || "en";

    },

    text(en, ar) {

        return this.language() === "ar"

            ? ar

            : en;

    },

    log(message) {

        console.log(

            "[Satellite]",

            message

        );

    },

    init() {

        if (this.initialized) {

            return;

        }

        this.initialized = true;

        this.log(

            this.text(

                "Satellite Adapter initialized.",

                "تم تشغيل محول الأقمار الصناعية."

            )

        );

    },

    health() {

        return {

            adapter: "SatelliteAdapter",

            version: this.version,

            provider: this.config.provider,

            enabled: this.config.enabled,

            reliability: this.config.reliability,

            requests: this.statistics.requests,

            success: this.statistics.success,

            failed: this.statistics.failed,

            cacheHits: this.statistics.cacheHits,

            averageResponse: this.statistics.averageResponse

        };

    },
      /* ===========================================================
       COLLECTION ENGINE
       =========================================================== */

    async collect(city) {

        if (!this.config.enabled) {

            return {

                ok: false,

                source: "satellite",

                reason: "adapter_disabled"

            };

        }

        const cityKey =
            (city.name || city.city || "unknown")
            .toLowerCase();

        const cached =
            this.cache.get(cityKey);

        if (cached) {

            const age =

                Date.now() -

                cached.timestamp;

            if (

                age <

                this.config.cacheMinutes *
                60 *
                1000

            ) {

                this.statistics.cacheHits++;

                return {

                    ...cached.data,

                    cached: true

                };

            }

        }

        this.statistics.requests++;

        const started =
            performance.now();

        try {

            const result =
                await this.withRetry(

                    () =>
                        this.downloadSatellite(
                            city
                        )

                );

            result.cached = false;

            result.responseTime =

                Math.round(

                    performance.now() -
                    started

                );

            this.updateAverage(

                result.responseTime

            );

            this.statistics.success++;

            this.cache.set(

                cityKey,

                {

                    timestamp:
                        Date.now(),

                    data: result

                }

            );

            return result;

        }

        catch (error) {

            this.statistics.failed++;

            return {

                ok: false,

                source: "satellite",

                error:
                    error.message,

                cached: false,

                confidence: 0,

                rainProbability: 0,

                cloudCover: 0

            };

        }

    },

    /* ===========================================================
       DOWNLOAD
       =========================================================== */

    async downloadSatellite(city) {

        await this.delay(

            300 +

            Math.random() * 600

        );

        const cloudCover =

            Math.round(

                15 +

                Math.random() * 80

            );

        const cloudTemp =

            Math.round(

                -70 +

                Math.random() * 50

            );

        const stormCells =

            Math.round(

                Math.random() * 5

            );

        const convection =

            this.calculateConvection(

                cloudCover,

                cloudTemp,

                stormCells

            );

        const rainSignal =

            this.calculateRainSignal(

                cloudCover,

                convection

            );

        return {

            ok: true,

            source: "satellite",

            provider:

                this.config.provider,

            city:

                city.name ||

                city.city,

            latitude:

                city.lat,

            longitude:

                city.lon,

            cloudCover,

            cloudTemperature:

                cloudTemp,

            stormCells,

            convectionIndex:

                convection,

            rainProbability:

                rainSignal,

            confidence:

                Math.round(

                    rainSignal * 0.90

                )

        };

    },

    /* ===========================================================
       RETRY ENGINE
       =========================================================== */

    async withRetry(callback) {

        let lastError;

        for (

            let i = 0;

            i <= this.config.retry;

            i++

        ) {

            try {

                return await Promise.race([

                    callback(),

                    this.timeout()

                ]);

            }

            catch (e) {

                lastError = e;

            }

        }

        throw lastError;

    },

    timeout() {

        return new Promise(

            (

                _,

                reject

            ) =>

                setTimeout(

                    () =>

                        reject(

                            new Error(

                                "Satellite timeout"

                            )

                        ),

                    this.config.timeout

                )

        );

    },

    updateAverage(value) {

        const total =

            this.statistics.success;

        if (total <= 1) {

            this.statistics.averageResponse =
                value;

            return;

        }

        this.statistics.averageResponse =

            Math.round(

                (

                    this.statistics.averageResponse *

                    (total - 1)

                    +

                    value

                )

                / total

            );

    },

    clearCache() {

        this.cache.clear();

    },

    delay(ms) {

        return new Promise(

            resolve =>

                setTimeout(

                    resolve,

                    ms

                )

        );

    },
      /* ===========================================================
       SATELLITE AI ANALYSIS ENGINE
       =========================================================== */

    calculateConvection(
        cloudCover,
        cloudTemperature,
        stormCells
    ) {

        let score = 0;

        /* Cloud Cover */

        if (cloudCover >= 90)
            score += 40;
        else if (cloudCover >= 75)
            score += 30;
        else if (cloudCover >= 60)
            score += 20;
        else if (cloudCover >= 40)
            score += 10;

        /* Cloud Temperature */

        if (cloudTemperature <= -60)
            score += 35;
        else if (cloudTemperature <= -50)
            score += 25;
        else if (cloudTemperature <= -40)
            score += 15;
        else if (cloudTemperature <= -30)
            score += 8;

        /* Storm Cells */

        score += stormCells * 8;

        return Math.min(
            100,
            Math.round(score)
        );

    },

    /* ===========================================================
       CLOUD COVER ANALYSIS
       =========================================================== */

    analyzeCloudCover(
        cloudCover
    ) {

        return {

            value:
                cloudCover,

            level:

                cloudCover >= 90
                    ? "Extreme"

                : cloudCover >= 75
                    ? "Very High"

                : cloudCover >= 60
                    ? "High"

                : cloudCover >= 40
                    ? "Moderate"

                : "Low",

            confidence:

                Math.min(
                    100,
                    cloudCover
                )

        };

    },

    /* ===========================================================
       CLOUD TEMPERATURE
       =========================================================== */

    analyzeCloudTemperature(
        temp
    ) {

        let severity =
            "Low";

        if (temp <= -65)
            severity =
                "Extreme";

        else if (temp <= -55)
            severity =
                "Very High";

        else if (temp <= -45)
            severity =
                "High";

        else if (temp <= -35)
            severity =
                "Moderate";

        return {

            temperature:
                temp,

            severity,

            strongConvection:
                temp <= -50

        };

    },

    /* ===========================================================
       STORM CELL DETECTOR
       =========================================================== */

    detectStormCells(
        count
    ) {

        return {

            detected:
                count > 0,

            count,

            activity:

                count >= 5
                    ? "Extreme"

                : count >= 3
                    ? "High"

                : count >= 1
                    ? "Moderate"

                : "None"

        };

    },

    /* ===========================================================
       RAIN SIGNAL
       =========================================================== */

    calculateRainSignal(
        cloudCover,
        convection
    ) {

        let probability =

            cloudCover * 0.45 +

            convection * 0.55;

        probability = Math.min(
            100,
            Math.round(
                probability
            )
        );

        return probability;

    },

    /* ===========================================================
       NORMALIZATION
       =========================================================== */

    normalizeSatelliteData(
        raw
    ) {

        return {

            source:
                "Satellite",

            provider:
                raw.provider,

            city:
                raw.city,

            confidence:
                raw.confidence,

            rainProbability:
                raw.rainProbability,

            cloudCover:
                raw.cloudCover,

            cloudTemperature:
                raw.cloudTemperature,

            convectionIndex:
                raw.convectionIndex,

            stormCells:
                raw.stormCells,

            timestamp:
                new Date()
                    .toISOString()

        };

    },
      /* ===========================================================
       SATELLITE INTELLIGENCE ENGINE
       =========================================================== */

    analyzeCloudMotion(
        previousFrame,
        currentFrame
    ) {

        if (
            !previousFrame ||
            !currentFrame
        ) {

            return {

                direction:
                    "UNKNOWN",

                speed:
                    0,

                confidence:
                    0

            };

        }

        const dx =

            this.safeNumber(
                currentFrame.lon,
                0
            ) -

            this.safeNumber(
                previousFrame.lon,
                0
            );

        const dy =

            this.safeNumber(
                currentFrame.lat,
                0
            ) -

            this.safeNumber(
                previousFrame.lat,
                0
            );

        const speed =

            Math.sqrt(

                dx * dx +

                dy * dy

            ) * 100;

        let direction =
            "STATIONARY";

        if (
            Math.abs(dx) >
            Math.abs(dy)
        ) {

            direction =
                dx > 0
                    ? "EAST"
                    : "WEST";

        }

        else {

            direction =
                dy > 0
                    ? "NORTH"
                    : "SOUTH";

        }

        return {

            direction,

            speed:
                Math.round(
                    speed
                ),

            confidence:
                Math.min(

                    100,

                    Math.round(
                        speed * 2
                    )

                )

        };

    },

    /* ===========================================================
       STORM GROWTH
       =========================================================== */

    detectStormGrowth(
        previousConvection,
        currentConvection
    ) {

        const difference =

            currentConvection -
            previousConvection;

        let trend =
            "STABLE";

        if (
            difference >= 20
        ) {

            trend =
                "RAPID_GROWTH";

        }

        else if (
            difference >= 8
        ) {

            trend =
                "GROWING";

        }

        else if (
            difference <= -20
        ) {

            trend =
                "WEAKENING";

        }

        return {

            trend,

            difference,

            confidence:

                Math.min(

                    100,

                    Math.abs(
                        difference
                    ) * 4

                )

        };

    },

    /* ===========================================================
       RAIN AREA ESTIMATION
       =========================================================== */

    estimateRainArea(
        cloudCover,
        stormCells
    ) {

        const area =

            (

                cloudCover *
                12

            )

            +

            (

                stormCells *
                85

            );

        return {

            squareKm:

                Math.round(
                    area
                ),

            classification:

                area >= 1200
                    ? "VERY_LARGE"

                : area >= 700
                    ? "LARGE"

                : area >= 350
                    ? "MEDIUM"

                : "LOCAL"

        };

    },

    /* ===========================================================
       SATELLITE RISK SCORE
       =========================================================== */

    calculateSatelliteRisk(

        cloudCover,

        convection,

        stormCells,

        rainProbability

    ) {

        const score =

            cloudCover *
            0.25 +

            convection *
            0.35 +

            stormCells *
            8 +

            rainProbability *
            0.40;

        return Math.min(

            100,

            Math.round(
                score
            )

        );

    },

    /* ===========================================================
       EXPLAINABLE AI
       =========================================================== */

    buildExplanation(
        analysis
    ) {

        const reasons =
            [];

        if (
            analysis.cloudCover >=
            80
        ) {

            reasons.push(

                this.text(

                    "Dense cloud cover detected.",

                    "تم رصد غطاء سحابي كثيف."

                )

            );

        }

        if (
            analysis.convectionIndex >=
            60
        ) {

            reasons.push(

                this.text(

                    "Strong atmospheric convection.",

                    "يوجد حمل حراري قوي."

                )

            );

        }

        if (
            analysis.stormCells >=
            2
        ) {

            reasons.push(

                this.text(

                    "Storm cells detected.",

                    "تم اكتشاف خلايا رعدية."

                )

            );

        }

        if (
            analysis.rainProbability >=
            70
        ) {

            reasons.push(

                this.text(

                    "High probability of rainfall.",

                    "احتمالية الأمطار مرتفعة."

                )

            );

        }

        if (
            reasons.length === 0
        ) {

            reasons.push(

                this.text(

                    "Satellite image does not indicate significant weather development.",

                    "لا تشير صور الأقمار الصناعية إلى تطور جوي مهم."

                )

            );

        }

        return reasons;

    },

    /* ===========================================================
       BUILD ANALYSIS
       =========================================================== */

    buildSatelliteAnalysis(
        raw
    ) {

        const cloud =
            this.analyzeCloudCover(
                raw.cloudCover
            );

        const temp =
            this.analyzeCloudTemperature(
                raw.cloudTemperature
            );

        const cells =
            this.detectStormCells(
                raw.stormCells
            );

        const rainArea =
            this.estimateRainArea(

                raw.cloudCover,

                raw.stormCells

            );

        const risk =
            this.calculateSatelliteRisk(

                raw.cloudCover,

                raw.convectionIndex,

                raw.stormCells,

                raw.rainProbability

            );

        return {

            ...raw,

            cloudAnalysis:
                cloud,

            temperatureAnalysis:
                temp,

            stormAnalysis:
                cells,

            rainArea,

            satelliteRisk:
                risk,

            explanation:
                this.buildExplanation(
                    raw
                )

        };

    },
      /* ===========================================================
       RENDER STATUS
       =========================================================== */

    renderStatus() {

        const panel =
            document.getElementById(
                "sourceAdapterStatusPanel"
            );

        if (!panel) {
            return;
        }

        const health =
            this.health();

        panel.innerHTML += `

        <div class="item info">

            <h3>

                🛰 ${this.text(
                    "Satellite Adapter",
                    "محول الأقمار الصناعية"
                )}

            </h3>

            <b>${this.text(
                "Provider",
                "المصدر"
            )}:</b>

            ${health.provider}

            <br>

            <b>${this.text(
                "Status",
                "الحالة"
            )}:</b>

            ${health.enabled
                ? this.text(
                    "ONLINE",
                    "متصل"
                )
                : this.text(
                    "OFFLINE",
                    "غير متصل"
                )
            }

            <br>

            <b>${this.text(
                "Reliability",
                "الاعتمادية"
            )}:</b>

            ${Math.round(
                health.reliability * 100
            )}%

            <br>

            <b>${this.text(
                "Requests",
                "عدد الطلبات"
            )}:</b>

            ${health.requests}

            <br>

            <b>${this.text(
                "Success",
                "النجاح"
            )}:</b>

            ${health.success}

            <br>

            <b>${this.text(
                "Failed",
                "الفشل"
            )}:</b>

            ${health.failed}

            <br>

            <b>${this.text(
                "Cache Hits",
                "استخدام الذاكرة"
            )}:</b>

            ${health.cacheHits}

            <br>

            <b>${this.text(
                "Average Response",
                "متوسط الاستجابة"
            )}:</b>

            ${health.averageResponse} ms

        </div>

        `;

    },

    /* ===========================================================
       EVENT BUS
       =========================================================== */

    publish(result) {

        this.lastCollection =
            result;

        window.dispatchEvent(

            new CustomEvent(

                "rg30:satellite-updated",

                {

                    detail: result

                }

            )

        );

        window.RG30.latestSatellite =
            result;

    },

    /* ===========================================================
       SOURCE ADAPTER FORMAT
       =========================================================== */

    buildSourceResult(result) {

        return {

            available:
                result.ok,

            status:
                result.ok
                    ? "ACTIVE"
                    : "FAILED",

            reliability:
                this.config.reliability,

            confidence:
                result.confidence,

            signalScore:
                result.satelliteRisk,

            rainProbability:
                result.rainProbability,

            rainAmount:
                0,

            details: {

                cloudCover:
                    result.cloudCover,

                cloudTemperature:
                    result.cloudTemperature,

                convectionScore:
                    result.convectionIndex,

                stormCellScore:
                    result.stormCells,

                explanation:
                    result.explanation,

                rainArea:
                    result.rainArea

            }

        };

    },

    /* ===========================================================
       MAIN PIPELINE
       =========================================================== */

    async execute(city) {

        const raw =
            await this.collect(
                city
            );

        if (!raw.ok) {

            return this.buildSourceResult(
                raw
            );

        }

        const normalized =
            this.normalizeSatelliteData(
                raw
            );

        const analysis =
            this.buildSatelliteAnalysis(
                normalized
            );

        this.publish(
            analysis
        );

        const sourceResult = this.buildSourceResult(analysis);

      sourceResult.adapter = "SatelliteAdapter";
      sourceResult.provider = this.config.provider;
      sourceResult.available = true;
      sourceResult.status = "ACTIVE";

      return sourceResult;

    },

    /* ===========================================================
       AUTO HEALTH UPDATE
       =========================================================== */

    startHealthMonitor() {

        if (this._healthTimer) {

            return;

        }

        this._healthTimer =
            setInterval(

                () => {

                    try {

                        this.renderStatus();

                    }

                    catch (e) {}

                },

                60000

            );

    },

    stopHealthMonitor() {

        if (

            this._healthTimer

        ) {

            clearInterval(

                this._healthTimer

            );

            this._healthTimer =
                null;

        }

    },
      /* ===========================================================
       HELPERS
       =========================================================== */

    safeNumber(
        value,
        fallback = 0
    ) {

        const number =
            Number(value);

        return Number.isFinite(number)
            ? number
            : fallback;

    },

    clamp(
        value,
        min = 0,
        max = 100
    ) {

        return Math.min(

            max,

            Math.max(

                min,

                this.safeNumber(
                    value,
                    min
                )

            )

        );

    },

    escapeHtml(
        text
    ) {

        return String(
            text ?? ""
        )

        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

    },

    random(
        min,
        max
    ) {

        return (

            Math.random() *
            (max - min)

        ) + min;

    },

    /* ===========================================================
       RESET
       =========================================================== */

    reset() {

        this.collecting =
            false;

        this.lastCollection =
            null;

        this.cache.clear();

        this.statistics = {

            requests: 0,

            success: 0,

            failed: 0,

            cacheHits: 0,

            averageResponse: 0

        };

        this.log(

            this.text(

                "Satellite Adapter reset.",

                "تمت إعادة ضبط محول الأقمار الصناعية."

            )

        );

    },

    /* ===========================================================
       DESTROY
       =========================================================== */

    destroy() {

        this.stopHealthMonitor();

        this.reset();

        this.initialized =
            false;

        this.log(

            this.text(

                "Satellite Adapter destroyed.",

                "تم إيقاف محول الأقمار الصناعية."

            )

        );

    }

};

/* ===========================================================
   GLOBAL SHORTCUTS
   =========================================================== */

window.collectSatellite =
    city =>

        RG30
            .SatelliteAdapter
            .execute(city);

window.getSatelliteHealth =
    () =>

        RG30
            .SatelliteAdapter
            .health();

window.resetSatelliteAdapter =
    () =>

        RG30
            .SatelliteAdapter
            .reset();

window.destroySatelliteAdapter =
    () =>

        RG30
            .SatelliteAdapter
            .destroy();

/* ===========================================================
   AUTO START
   =========================================================== */

window.addEventListener(

    "DOMContentLoaded",

    () => {

        try {

            RG30
                .SatelliteAdapter
                .init();

            RG30
                .SatelliteAdapter
                .startHealthMonitor();

            console.log(

                "%cSatellite Adapter V30.1 Ready",

                "color:#00d2ff;font-size:14px;font-weight:bold;"

            );

        }

        catch (error) {

            console.error(

                "Satellite Adapter initialization failed:",

                error

            );

        }

    },

    {

        once: true

    }

);
