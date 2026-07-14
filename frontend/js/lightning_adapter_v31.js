/* =========================================================
   RainGuard AI V31
   National Lightning Intelligence Adapter
   Bilingual Arabic / English Edition

   File:
   frontend/js/lightning_adapter_v31.js

   Modes:
   - LIVE_API
   - BACKEND_PROXY
   - SIMULATION

   Important:
   Simulation data must never be presented as official or
   live lightning observations.
   ========================================================= */

"use strict";

window.RG31 =
    window.RG31 || {};

window.RG30 =
    window.RG30 || {};

RG31.LightningAdapter = {

    version:
        "31.0.0",

    initialized:
        false,

    collecting:
        false,

    collectionNumber:
        0,

    lastCollection:
        null,

    latestCollection:
        null,

    lastRequestAt:
        null,

    lastSuccessAt:
        null,

    lastFailureAt:
        null,

    lastError:
        null,

    cache:
        new Map(),

    cityHistory:
        new Map(),

    statistics: {

        requests:
            0,

        successes:
            0,

        failures:
            0,

        retries:
            0,

        timeouts:
            0,

        cacheHits:
            0,

        liveRequests:
            0,

        proxyRequests:
            0,

        simulationRequests:
            0,

        totalResponseMs:
            0,

        averageResponseMs:
            0,

        totalStrikesDetected:
            0,

        nearestStrikeKm:
            null,

        highestActivityScore:
            0
    },

    config: {

        enabled:
            true,

        /*
         * LIVE_API
         * BACKEND_PROXY
         * SIMULATION
         */
        mode:
            "SIMULATION",

        provider:
            "RainGuard Lightning Intelligence",

        /*
         * ضع رابط مزود البرق المباشر هنا فقط إذا كان
         * مسموحًا استخدامه من المتصفح.
         */
        liveEndpoint:
            "",

        /*
         * الأفضل استخدام Backend Proxy لحماية المفاتيح.
         */
        proxyEndpoint:
            "",

        method:
            "GET",

        apiKey:
            "",

        apiKeyHeader:
            "X-API-Key",

        timeoutMs:
            15000,

        retryCount:
            2,

        retryDelayMs:
            1200,

        cacheTtlMs:
            3 * 60 * 1000,

        historyLimit:
            24,

        observationWindowMinutes:
            15,

        detectionRadiusKm:
            250,

        criticalRadiusKm:
            25,

        warningRadiusKm:
            60,

        watchRadiusKm:
            120,

        maximumAcceptedAgeMinutes:
            20,

        maximumStrikesPerWindow:
            300,

        defaultReliability:
            0.90,

        simulationReliability:
            0.30,

        allowSimulationFallback:
            true,

        publishEvents:
            true,

        timezone:
            "Asia/Riyadh"
    },

    /* =====================================================
       LANGUAGE
       ===================================================== */

    isArabic() {

        return (
            window.RG30
                ?.I18n
                ?.language ===
                "ar" ||

            window.RG31
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

            window.RG31
                ?.I18n ||

            window.RG30
                ?.I18n;

        if (
            i18n &&
            typeof i18n.translateText ===
                "function"
        ) {

            try {

                return i18n.translateText(
                    message
                );

            } catch (error) {

                console.warn(
                    "RG31 Lightning translation skipped:",
                    error
                );

            }

        }

        return String(
            message ?? ""
        );

    },

    getModeLabel(
        mode =
            this.config.mode
    ) {

        const value =
            String(
                mode || ""
            )
                .trim()
                .toUpperCase();

        const labels = {

            LIVE_API: {

                en:
                    "Live API",

                ar:
                    "واجهة مباشرة"
            },

            BACKEND_PROXY: {

                en:
                    "Backend Proxy",

                ar:
                    "خادم وسيط آمن"
            },

            SIMULATION: {

                en:
                    "Simulation",

                ar:
                    "محاكاة"
            },

            UNKNOWN: {

                en:
                    "Unknown",

                ar:
                    "غير معروف"
            }
        };

        const item =
            labels[value] ||
            labels.UNKNOWN;

        return this.isArabic()
            ? item.ar
            : item.en;

    },

    getTrendLabel(
        trend
    ) {

        const value =
            String(
                trend || "UNKNOWN"
            )
                .trim()
                .toUpperCase();

        const labels = {

            RAPIDLY_INCREASING: {

                en:
                    "Rapidly increasing",

                ar:
                    "يتصاعد بسرعة"
            },

            INCREASING: {

                en:
                    "Increasing",

                ar:
                    "متزايد"
            },

            STABLE: {

                en:
                    "Stable",

                ar:
                    "مستقر"
            },

            DECREASING: {

                en:
                    "Decreasing",

                ar:
                    "متناقص"
            },

            NO_ACTIVITY: {

                en:
                    "No activity",

                ar:
                    "لا يوجد نشاط"
            },

            UNKNOWN: {

                en:
                    "Unknown",

                ar:
                    "غير معروف"
            }
        };

        const item =
            labels[value] ||
            labels.UNKNOWN;

        return this.isArabic()
            ? item.ar
            : item.en;

    },

    getRiskLabel(
        level
    ) {

        const value =
            String(
                level || "UNKNOWN"
            )
                .trim()
                .toUpperCase();

        const labels = {

            EXTREME: {

                en:
                    "Extreme",

                ar:
                    "شديد الخطورة"
            },

            HIGH: {

                en:
                    "High",

                ar:
                    "مرتفع"
            },

            MODERATE: {

                en:
                    "Moderate",

                ar:
                    "متوسط"
            },

            LOW: {

                en:
                    "Low",

                ar:
                    "منخفض"
            },

            NORMAL: {

                en:
                    "Normal",

                ar:
                    "طبيعي"
            },

            UNKNOWN: {

                en:
                    "Unknown",

                ar:
                    "غير معروف"
            }
        };

        const item =
            labels[value] ||
            labels.UNKNOWN;

        return this.isArabic()
            ? item.ar
            : item.en;

    },

    getStatusLabel(
        status
    ) {

        const value =
            String(
                status || "UNKNOWN"
            )
                .trim()
                .toUpperCase();

        const labels = {

            ACTIVE: {

                en:
                    "Active",

                ar:
                    "نشط"
            },

            CONNECTED: {

                en:
                    "Connected",

                ar:
                    "متصل"
            },

            SIMULATION: {

                en:
                    "Simulation",

                ar:
                    "محاكاة"
            },

            CACHED: {

                en:
                    "Cached",

                ar:
                    "من الذاكرة المؤقتة"
            },

            UNAVAILABLE: {

                en:
                    "Unavailable",

                ar:
                    "غير متاح"
            },

            DISABLED: {

                en:
                    "Disabled",

                ar:
                    "معطل"
            },

            FAILED: {

                en:
                    "Failed",

                ar:
                    "فشل"
            },

            TIMEOUT: {

                en:
                    "Timeout",

                ar:
                    "انتهت المهلة"
            },

            UNKNOWN: {

                en:
                    "Unknown",

                ar:
                    "غير معروف"
            }
        };

        const item =
            labels[value] ||
            labels.UNKNOWN;

        return this.isArabic()
            ? item.ar
            : item.en;

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

        this.validateConfiguration();

        this.bindEvents();

        this.writeLog(

            this.text(
                `Lightning Adapter V31 initialized in ${this.config.mode} mode.`,
                `تم تشغيل محول البرق V31 في وضع ${this.getModeLabel()}.`
            )

        );

        if (
            this.config.publishEvents
        ) {

            window.dispatchEvent(

                new CustomEvent(

                    "rg31:lightning-adapter-ready",

                    {
                        detail: {

                            version:
                                this.version,

                            mode:
                                this.config.mode,

                            modeLabel:
                                this.getModeLabel(),

                            provider:
                                this.config.provider,

                            reliability:
                                this.getCurrentReliability(),

                            configured:
                                this.isConfigured(),

                            timestamp:
                                new Date()
                                    .toISOString()

                        }
                    }

                )

            );

        }

    },

    bindEvents() {

        window.addEventListener(

            "rg30:language-changed",

            () => {

                this.refreshPublishedState();

            }

        );

        window.addEventListener(

            "rg31:language-changed",

            () => {

                this.refreshPublishedState();

            }

        );

        window.addEventListener(

            "rg30:clear-source-cache",

            () => {

                this.clearCache();

            }

        );

        window.addEventListener(

            "rg31:clear-source-cache",

            () => {

                this.clearCache();

            }

        );

        window.addEventListener(

            "rg31:lightning-mode-change",

            event => {

                const mode =
                    event?.detail?.mode;

                if (mode) {

                    this.setMode(
                        mode
                    );

                }

            }

        );

    },

    validateConfiguration() {

        const allowedModes = [

            "LIVE_API",

            "BACKEND_PROXY",

            "SIMULATION"

        ];

        const requestedMode =
            String(
                this.config.mode ||
                "SIMULATION"
            )
                .trim()
                .toUpperCase();

        if (
            !allowedModes.includes(
                requestedMode
            )
        ) {

            console.warn(

                `RG31 Lightning: invalid mode "${requestedMode}". Falling back to SIMULATION.`

            );

            this.config.mode =
                "SIMULATION";

        } else {

            this.config.mode =
                requestedMode;

        }

        if (
            this.config.mode ===
                "LIVE_API" &&
            !this.config.liveEndpoint
        ) {

            console.warn(
                "RG31 Lightning: LIVE_API endpoint is missing."
            );

            if (
                this.config
                    .allowSimulationFallback
            ) {

                this.config.mode =
                    "SIMULATION";

            }

        }

        if (
            this.config.mode ===
                "BACKEND_PROXY" &&
            !this.config.proxyEndpoint
        ) {

            console.warn(
                "RG31 Lightning: BACKEND_PROXY endpoint is missing."
            );

            if (
                this.config
                    .allowSimulationFallback
            ) {

                this.config.mode =
                    "SIMULATION";

            }

        }

    },

    configure(
        options = {}
    ) {

        if (
            !options ||
            typeof options !==
                "object"
        ) {

            return false;

        }

        this.config = {

            ...this.config,

            ...options

        };

        this.validateConfiguration();

        this.clearCache();

        return true;

    },

    setMode(
        mode
    ) {

        const requestedMode =
            String(
                mode || ""
            )
                .trim()
                .toUpperCase();

        const allowedModes = [

            "LIVE_API",

            "BACKEND_PROXY",

            "SIMULATION"

        ];

        if (
            !allowedModes.includes(
                requestedMode
            )
        ) {

            throw new Error(
                "LIGHTNING_INVALID_MODE"
            );

        }

        this.config.mode =
            requestedMode;

        this.validateConfiguration();

        this.clearCache();

        this.writeLog(

            this.text(
                `Lightning mode changed to ${this.config.mode}.`,
                `تم تغيير وضع محول البرق إلى ${this.getModeLabel()}.`
            )

        );

        return this.config.mode;

    },

    isConfigured() {

        if (
            !this.config.enabled
        ) {

            return false;

        }

        if (
            this.config.mode ===
                "SIMULATION"
        ) {

            return true;

        }

        if (
            this.config.mode ===
                "LIVE_API"
        ) {

            return Boolean(
                this.config.liveEndpoint
            );

        }

        if (
            this.config.mode ===
                "BACKEND_PROXY"
        ) {

            return Boolean(
                this.config.proxyEndpoint
            );

        }

        return false;

    },

    getCurrentReliability() {

        if (
            this.config.mode ===
                "SIMULATION"
        ) {

            return this.config
                .simulationReliability;

        }

        return this.config
            .defaultReliability;

    },

    getActiveEndpoint() {

        if (
            this.config.mode ===
                "LIVE_API"
        ) {

            return this.config
                .liveEndpoint;

        }

        if (
            this.config.mode ===
                "BACKEND_PROXY"
        ) {

            return this.config
                .proxyEndpoint;

        }

        return "";

    },

    /* =====================================================
       HEALTH
       ===================================================== */

    health() {

        const completed =

            this.statistics.successes +

            this.statistics.failures;

        const successRate =

            completed > 0

                ? Math.round(

                    this.statistics.successes /
                    completed *
                    100

                )

                : 0;

        let healthStatus =
            "UNKNOWN";

        if (
            completed === 0
        ) {

            healthStatus =
                "UNKNOWN";

        } else if (
            successRate >= 95
        ) {

            healthStatus =
                "EXCELLENT";

        } else if (
            successRate >= 80
        ) {

            healthStatus =
                "GOOD";

        } else if (
            successRate >= 60
        ) {

            healthStatus =
                "WARNING";

        } else {

            healthStatus =
                "CRITICAL";

        }

        return {

            adapter:
                "LightningAdapter",

            version:
                this.version,

            initialized:
                this.initialized,

            enabled:
                this.config.enabled,

            configured:
                this.isConfigured(),

            collecting:
                this.collecting,

            mode:
                this.config.mode,

            modeLabel:
                this.getModeLabel(),

            provider:
                this.config.provider,

            reliability:
                this.getCurrentReliability(),

            healthStatus,

            successRate,

            requests:
                this.statistics.requests,

            successes:
                this.statistics.successes,

            failures:
                this.statistics.failures,

            retries:
                this.statistics.retries,

            timeouts:
                this.statistics.timeouts,

            cacheHits:
                this.statistics.cacheHits,

            liveRequests:
                this.statistics.liveRequests,

            proxyRequests:
                this.statistics.proxyRequests,

            simulationRequests:
                this.statistics.simulationRequests,

            averageResponseMs:
                this.statistics.averageResponseMs,

            totalStrikesDetected:
                this.statistics.totalStrikesDetected,

            nearestStrikeKm:
                this.statistics.nearestStrikeKm,

            highestActivityScore:
                this.statistics.highestActivityScore,

            cacheSize:
                this.cache.size,

            monitoredCities:
                this.cityHistory.size,

            lastRequestAt:
                this.lastRequestAt,

            lastSuccessAt:
                this.lastSuccessAt,

            lastFailureAt:
                this.lastFailureAt,

            lastError:
                this.lastError

        };

    },
      /* =====================================================
       CACHE ENGINE
       ===================================================== */

    buildCityKey(
        city
    ) {

        const name =
            String(
                city?.name ||
                city?.city ||
                city?.cityName ||
                "unknown"
            )
                .trim()
                .toLowerCase();

        const lat =
            this.safeNumber(
                city?.lat ??
                city?.latitude,
                0
            )
                .toFixed(
                    4
                );

        const lon =
            this.safeNumber(
                city?.lon ??
                city?.lng ??
                city?.longitude,
                0
            )
                .toFixed(
                    4
                );

        return `${name}:${lat}:${lon}`;

    },

    getCachedResult(
        city
    ) {

        const key =
            this.buildCityKey(
                city
            );

        const cached =
            this.cache.get(
                key
            );

        if (!cached) {

            return null;

        }

        const ageMs =
            Date.now() -
            cached.cachedAt;

        if (
            ageMs >
            this.config.cacheTtlMs
        ) {

            this.cache.delete(
                key
            );

            return null;

        }

        this.statistics.cacheHits +=
            1;

        return {

            ...cached.result,

            cached:
                true,

            cacheAgeMs:
                ageMs,

            cacheAgeMinutes:
                Number(
                    (
                        ageMs /
                        60000
                    )
                        .toFixed(
                            2
                        )
                ),

            status:
                "CACHED"

        };

    },

    setCachedResult(
        city,
        result
    ) {

        if (
            !result ||
            result.available !==
                true
        ) {

            return;

        }

        const key =
            this.buildCityKey(
                city
            );

        this.cache.set(

            key,

            {
                cachedAt:
                    Date.now(),

                result: {
                    ...result,
                    cached:
                        false
                }
            }

        );

    },

    clearCache() {

        this.cache.clear();

        this.statistics.cacheHits =
            0;

        this.writeLog(

            this.text(
                "Lightning cache cleared.",
                "تم مسح ذاكرة البرق المؤقتة."
            )

        );

    },

    pruneCache() {

        const now =
            Date.now();

        for (
            const [
                key,
                item
            ] of this.cache
        ) {

            if (
                now -
                item.cachedAt >
                this.config.cacheTtlMs
            ) {

                this.cache.delete(
                    key
                );

            }

        }

    },

    /* =====================================================
       CITY HISTORY
       ===================================================== */

    getCityHistory(
        city
    ) {

        const key =
            this.buildCityKey(
                city
            );

        return this.cityHistory.get(
            key
        ) || [];

    },

    pushCityHistory(
        city,
        result
    ) {

        const key =
            this.buildCityKey(
                city
            );

        const history =
            this.cityHistory.get(
                key
            ) || [];

        history.push({

            timestamp:
                result.timestamp,

            strikes:
                result.strikes,

            nearestStrikeKm:
                result.nearestStrikeKm,

            strikeDensity:
                result.strikeDensity,

            activityScore:
                result.activityScore,

            confidence:
                result.confidence,

            trend:
                result.trend,

            mode:
                result.mode

        });

        while (
            history.length >
            this.config.historyLimit
        ) {

            history.shift();

        }

        this.cityHistory.set(
            key,
            history
        );

    },

    clearHistory(
        city = null
    ) {

        if (!city) {

            this.cityHistory.clear();

            return;

        }

        const key =
            this.buildCityKey(
                city
            );

        this.cityHistory.delete(
            key
        );

    },

    /* =====================================================
       MAIN COLLECTION
       ===================================================== */

    async collect(
        city = {}
    ) {

        const normalizedCity =
            this.normalizeCity(
                city
            );

        if (
            !this.config.enabled
        ) {

            return this.createUnavailableResult(
                normalizedCity,
                "DISABLED",
                "LIGHTNING_ADAPTER_DISABLED"
            );

        }

        this.pruneCache();

        const cached =
            this.getCachedResult(
                normalizedCity
            );

        if (cached) {

            this.latestCollection =
                cached;

            return cached;

        }

        if (
            !this.isConfigured()
        ) {

            return this.createUnavailableResult(
                normalizedCity,
                "UNAVAILABLE",
                "LIGHTNING_ADAPTER_NOT_CONFIGURED"
            );

        }

        if (
            this.collecting
        ) {

            return this.createUnavailableResult(
                normalizedCity,
                "FAILED",
                "LIGHTNING_COLLECTION_ALREADY_RUNNING"
            );

        }

        this.collecting =
            true;

        this.collectionNumber +=
            1;

        this.statistics.requests +=
            1;

        this.lastRequestAt =
            new Date()
                .toISOString();

        const startedAt =
            Date.now();

        try {

            const rawResult =
                await this.collectWithRetry(
                    normalizedCity
                );

            const normalized =
                this.normalizeLightningResult({

                    city:
                        normalizedCity,

                    rawResult,

                    responseTimeMs:
                        Date.now() -
                        startedAt

                });

            this.statistics.successes +=
                1;

            this.statistics.totalStrikesDetected +=
                normalized.strikes;

            this.statistics.highestActivityScore =
                Math.max(

                    this.statistics.highestActivityScore,

                    normalized.activityScore

                );

            if (
                Number.isFinite(
                    normalized.nearestStrikeKm
                )
            ) {

                if (
                    this.statistics.nearestStrikeKm ===
                        null
                ) {

                    this.statistics.nearestStrikeKm =
                        normalized.nearestStrikeKm;

                } else {

                    this.statistics.nearestStrikeKm =
                        Math.min(

                            this.statistics.nearestStrikeKm,

                            normalized.nearestStrikeKm

                        );

                }

            }

            this.updateAverageResponse(

                normalized.responseTimeMs

            );

            this.lastSuccessAt =
                new Date()
                    .toISOString();

            this.lastFailureAt =
                null;

            this.lastError =
                null;

            this.lastCollection =
                normalized;

            this.latestCollection =
                normalized;

            this.pushCityHistory(

                normalizedCity,

                normalized

            );

            this.setCachedResult(

                normalizedCity,

                normalized

            );

            this.publishSuccess(
                normalized
            );

            return normalized;

        } catch (error) {

            const message =
                error?.message ||
                String(
                    error
                );

            this.statistics.failures +=
                1;

            this.lastFailureAt =
                new Date()
                    .toISOString();

            this.lastError =
                message;

            const failure =
                this.createUnavailableResult(

                    normalizedCity,

                    message.startsWith(
                        "LIGHTNING_TIMEOUT"
                    )
                        ? "TIMEOUT"
                        : "FAILED",

                    message

                );

            this.lastCollection =
                failure;

            this.latestCollection =
                failure;

            this.publishFailure(
                failure
            );

            return failure;

        } finally {

            this.collecting =
                false;

        }

    },

    async execute(
        city = {}
    ) {

        return this.collect(
            city
        );

    },

    /* =====================================================
       RETRY ENGINE
       ===================================================== */

    async collectWithRetry(
        city
    ) {

        let lastError =
            null;

        const totalAttempts =
            this.config.retryCount +
            1;

        for (
            let attempt = 1;
            attempt <=
                totalAttempts;
            attempt += 1
        ) {

            try {

                return await this.withTimeout(

                    this.routeCollection(
                        city
                    ),

                    this.config.timeoutMs

                );

            } catch (error) {

                lastError =
                    error;

                const message =
                    error?.message ||
                    String(
                        error
                    );

                if (
                    message.startsWith(
                        "LIGHTNING_TIMEOUT"
                    )
                ) {

                    this.statistics.timeouts +=
                        1;

                }

                if (
                    attempt <
                    totalAttempts
                ) {

                    this.statistics.retries +=
                        1;

                    this.writeLog(

                        this.text(

                            `Lightning collection retry ${attempt}/${this.config.retryCount}.`,

                            `إعادة محاولة جمع بيانات البرق رقم ${attempt}/${this.config.retryCount}.`

                        ),

                        "warning"

                    );

                    await this.delay(

                        this.config.retryDelayMs *
                        attempt

                    );

                }

            }

        }

        throw (
            lastError ||
            new Error(
                "LIGHTNING_COLLECTION_FAILED"
            )
        );

    },

    /* =====================================================
       COLLECTION ROUTER
       ===================================================== */

    async routeCollection(
        city
    ) {

        if (
            this.config.mode ===
                "LIVE_API"
        ) {

            this.statistics.liveRequests +=
                1;

            return this.collectFromEndpoint(
                city,
                this.config.liveEndpoint
            );

        }

        if (
            this.config.mode ===
                "BACKEND_PROXY"
        ) {

            this.statistics.proxyRequests +=
                1;

            return this.collectFromEndpoint(
                city,
                this.config.proxyEndpoint
            );

        }

        this.statistics.simulationRequests +=
            1;

        return this.createSimulationPayload(
            city
        );

    },

    /* =====================================================
       LIVE / PROXY REQUEST
       ===================================================== */

    async collectFromEndpoint(
        city,
        endpoint
    ) {

        if (!endpoint) {

            throw new Error(
                "LIGHTNING_ENDPOINT_NOT_CONFIGURED"
            );

        }

        const method =
            String(
                this.config.method ||
                "GET"
            )
                .trim()
                .toUpperCase();

        const headers = {

            Accept:
                "application/json",

            "Content-Type":
                "application/json"

        };

        if (
            this.config.apiKey
        ) {

            headers[
                this.config.apiKeyHeader
            ] =
                this.config.apiKey;

        }

        let url =
            endpoint;

        const requestOptions = {

            method,

            headers,

            cache:
                "no-store"

        };

        if (
            method ===
                "GET"
        ) {

            const separator =
                endpoint.includes(
                    "?"
                )
                    ? "&"
                    : "?";

            url =
                endpoint +
                separator +
                new URLSearchParams({

                    lat:
                        String(
                            city.lat
                        ),

                    lon:
                        String(
                            city.lon
                        ),

                    city:
                        city.name,

                    radius_km:
                        String(
                            this.config
                                .detectionRadiusKm
                        ),

                    window_minutes:
                        String(
                            this.config
                                .observationWindowMinutes
                        ),

                    timezone:
                        this.config
                            .timezone

                })
                    .toString();

        } else {

            requestOptions.body =
                JSON.stringify({

                    latitude:
                        city.lat,

                    longitude:
                        city.lon,

                    city:
                        city.name,

                    region:
                        city.region,

                    detectionRadiusKm:
                        this.config
                            .detectionRadiusKm,

                    observationWindowMinutes:
                        this.config
                            .observationWindowMinutes,

                    timezone:
                        this.config
                            .timezone

                });

        }

        const response =
            await fetch(
                url,
                requestOptions
            );

        if (!response.ok) {

            throw new Error(
                `LIGHTNING_HTTP_${response.status}`
            );

        }

        const contentType =
            response.headers.get(
                "content-type"
            ) || "";

        if (
            !contentType.includes(
                "application/json"
            )
        ) {

            throw new Error(
                "LIGHTNING_INVALID_CONTENT_TYPE"
            );

        }

        const payload =
            await response.json();

        if (
            !payload ||
            typeof payload !==
                "object"
        ) {

            throw new Error(
                "LIGHTNING_INVALID_RESPONSE"
            );

        }

        return payload;

    },
      /* =====================================================
       SIMULATION ENGINE
       ===================================================== */

    async createSimulationPayload(
        city
    ) {

        await this.delay(
            180 +
            Math.random() * 420
        );

        const sourceWeather =

            this.safeNumber(
                city.weatherScore ??
                city.finalRisk ??
                city.baseRisk ??
                city.risk ??
                city.rainProbability,
                0
            );

        const stormBias =
            this.clamp(
                sourceWeather,
                0,
                100
            );

        const activityChance =
            Math.random() * 100;

        let strikes =
            0;

        if (
            activityChance <
            stormBias
        ) {

            strikes =
                Math.round(
                    this.random(
                        1,
                        Math.max(
                            4,
                            stormBias * 1.4
                        )
                    )
                );

        }

        strikes =
            Math.min(
                strikes,
                this.config
                    .maximumStrikesPerWindow
            );

        let nearestStrikeKm =
            null;

        if (
            strikes > 0
        ) {

            const minimumDistance =
                stormBias >= 75
                    ? 4
                    : stormBias >= 50
                        ? 10
                        : 25;

            nearestStrikeKm =
                Number(
                    this.random(
                        minimumDistance,
                        this.config
                            .detectionRadiusKm
                    )
                        .toFixed(
                            1
                        )
                );

        }

        const cloudToGround =
            strikes > 0
                ? Math.round(
                    strikes *
                    this.random(
                        0.45,
                        0.75
                    )
                )
                : 0;

        const intraCloud =
            Math.max(
                0,
                strikes -
                cloudToGround
            );

        const strikeDensity =
            this.calculateStrikeDensity({
                strikes,
                radiusKm:
                    this.config
                        .detectionRadiusKm
            });

        const activityScore =
            this.calculateActivityScore({

                strikes,

                nearestStrikeKm,

                strikeDensity,

                cloudToGround,

                observationWindowMinutes:
                    this.config
                        .observationWindowMinutes

            });

        return {

            mode:
                "SIMULATION",

            provider:
                "RainGuard Lightning Simulation",

            simulated:
                true,

            official:
                false,

            city:
                city.name,

            lat:
                city.lat,

            lon:
                city.lon,

            timestamp:
                new Date()
                    .toISOString(),

            observationWindowMinutes:
                this.config
                    .observationWindowMinutes,

            detectionRadiusKm:
                this.config
                    .detectionRadiusKm,

            strikes,

            cloudToGround,

            intraCloud,

            nearestStrikeKm,

            strikeDensity,

            activityScore,

            confidence:
                this.calculateSimulationConfidence({

                    strikes,

                    activityScore,

                    sourceWeather:
                        stormBias

                }),

            sourceWeatherScore:
                stormBias,

            error:
                null

        };

    },

    calculateSimulationConfidence({
        strikes,
        activityScore,
        sourceWeather
    }) {

        const strikeComponent =
            this.clamp(
                strikes * 2.5,
                0,
                100
            );

        const score =

            strikeComponent *
                0.30 +

            this.clamp(
                activityScore,
                0,
                100
            ) *
                0.40 +

            this.clamp(
                sourceWeather,
                0,
                100
            ) *
                0.30;

        return Math.round(
            this.clamp(
                score,
                20,
                65
            )
        );

    },

    /* =====================================================
       RESPONSE NORMALIZATION
       ===================================================== */

    normalizeLightningResult({
        city,
        rawResult,
        responseTimeMs
    }) {

        const payload =
            rawResult &&
            typeof rawResult ===
                "object"
                ? rawResult
                : {};

        const root =

            payload.data ||

            payload.result ||

            payload.lightning ||

            payload;

        const strikes =
            this.extractStrikeCount(
                root
            );

        const cloudToGround =
            this.extractCloudToGroundCount(
                root,
                strikes
            );

        const intraCloud =
            this.extractIntraCloudCount(
                root,
                strikes,
                cloudToGround
            );

        const nearestStrikeKm =
            this.extractNearestStrikeDistance(
                root,
                city
            );

        const observationWindowMinutes =
            this.clamp(

                this.firstNumber(

                    root.observationWindowMinutes,

                    root.windowMinutes,

                    root.window_minutes,

                    payload.observationWindowMinutes,

                    this.config
                        .observationWindowMinutes

                ),

                1,

                180

            );

        const detectionRadiusKm =
            this.clamp(

                this.firstNumber(

                    root.detectionRadiusKm,

                    root.radiusKm,

                    root.radius_km,

                    payload.detectionRadiusKm,

                    this.config
                        .detectionRadiusKm

                ),

                1,

                1000

            );

        const strikeDensity =
            this.firstNumber(

                root.strikeDensity,

                root.density,

                root.strikesPer100Km2,

                root.strikes_per_100km2

            ) ||

            this.calculateStrikeDensity({

                strikes,

                radiusKm:
                    detectionRadiusKm

            });

        const activityScore =
            this.firstNumber(

                root.activityScore,

                root.score,

                root.lightningScore,

                root.signalScore

            ) ||

            this.calculateActivityScore({

                strikes,

                nearestStrikeKm,

                strikeDensity,

                cloudToGround,

                observationWindowMinutes

            });

        const timestamp =
            this.extractTimestamp(
                root
            );

        const dataAgeMinutes =
            this.calculateAgeMinutes(
                timestamp
            );

        const freshnessScore =
            this.calculateFreshnessScore(
                dataAgeMinutes
            );

        const confidence =
            this.clamp(

                this.firstNumber(

                    root.confidence,

                    root.dataConfidence,

                    root.quality,

                    this.calculateConfidence({

                        strikes,

                        nearestStrikeKm,

                        strikeDensity,

                        activityScore,

                        freshnessScore,

                        simulated:
                            payload.simulated ===
                                true ||
                            root.simulated ===
                                true ||
                            this.config.mode ===
                                "SIMULATION"

                    })

                ),

                0,

                100

            );

        const history =
            this.getCityHistory(
                city
            );

        const trend =
            this.detectTrend({

                history,

                currentStrikes:
                    strikes,

                currentActivityScore:
                    activityScore

            });

        const riskLevel =
            this.getLightningRiskLevel({

                strikes,

                nearestStrikeKm,

                activityScore,

                trend

            });

        const warningLevel =
            this.getWarningLevelFromRisk(
                riskLevel
            );

        const rainProbability =
            this.calculateRainProbability({

                strikes,

                nearestStrikeKm,

                activityScore,

                trend

            });

        const signalScore =
            this.calculateSignalScore({

                activityScore,

                confidence,

                freshnessScore,

                riskLevel

            });

        const simulated =

            payload.simulated ===
                true ||

            root.simulated ===
                true ||

            this.config.mode ===
                "SIMULATION";

        const available =
            strikes >= 0 &&
            Number.isFinite(
                activityScore
            );

        return {

            sourceKey:
                "lightning",

            sourceName:
                this.text(
                    "Lightning Detection",
                    "رصد البرق"
                ),

            adapter:
                "LightningAdapter",

            adapterName:
                "LightningAdapter",

            provider:

                root.provider ||

                payload.provider ||

                this.config.provider,

            available,

            ok:
                available,

            official:
                simulated
                    ? false
                    : Boolean(
                        root.official ??
                        payload.official ??
                        false
                    ),

            simulated,

            mode:
                simulated
                    ? "SIMULATION"
                    : this.config.mode,

            status:
                simulated
                    ? "SIMULATION"
                    : available
                        ? "ACTIVE"
                        : "UNAVAILABLE",

            city:
                city.name,

            cityId:
                city.id,

            lat:
                city.lat,

            lon:
                city.lon,

            region:
                city.region,

            timestamp,

            ageMinutes:
                dataAgeMinutes,

            dataAgeMinutes,

            freshnessScore,

            reliability:
                simulated
                    ? this.config
                        .simulationReliability
                    : this.config
                        .defaultReliability,

            trust:
                simulated
                    ? this.config
                        .simulationReliability
                    : this.config
                        .defaultReliability,

            strikes,

            cloudToGround,

            intraCloud,

            nearestStrikeKm,

            distanceKm:
                nearestStrikeKm,

            strikeDensity,

            activityScore,

            trend,

            riskLevel,

            rainProbability,

            rainAmount:
                0,

            signalScore,

            confidence,

            warningLevel,

            responseTimeMs:
                this.safeNumber(
                    responseTimeMs,
                    0
                ),

            observationWindowMinutes,

            detectionRadiusKm,

            cached:
                false,

            details: {

                strikes,

                cloudToGround,

                intraCloud,

                nearestStrikeKm,

                distanceKm:
                    nearestStrikeKm,

                strikeDensity,

                activityScore,

                trend,

                trendLabel:
                    this.getTrendLabel(
                        trend
                    ),

                riskLevel,

                riskLabel:
                    this.getRiskLabel(
                        riskLevel
                    ),

                observationWindowMinutes,

                detectionRadiusKm,

                dataAgeMinutes,

                freshnessScore,

                simulated,

                mode:
                    simulated
                        ? "SIMULATION"
                        : this.config.mode,

                responseTimeMs:
                    this.safeNumber(
                        responseTimeMs,
                        0
                    )

            },

            raw:
                simulated
                    ? null
                    : payload,

            error:
                null

        };

    },

    /* =====================================================
       STRIKE EXTRACTION
       ===================================================== */

    extractStrikeCount(
        root = {}
    ) {

        const direct =
            this.firstNumber(

                root.strikes,

                root.strikeCount,

                root.count,

                root.totalStrikes,

                root.total,

                root.lightningCount

            );

        if (
            direct > 0
        ) {

            return Math.round(
                this.clamp(

                    direct,

                    0,

                    this.config
                        .maximumStrikesPerWindow

                )
            );

        }

        const collections = [

            root.events,

            root.strikeEvents,

            root.lightningEvents,

            root.points,

            root.features

        ];

        for (
            const collection of collections
        ) {

            if (
                Array.isArray(
                    collection
                )
            ) {

                return Math.min(

                    collection.length,

                    this.config
                        .maximumStrikesPerWindow

                );

            }

        }

        return 0;

    },

    extractCloudToGroundCount(
        root = {},
        totalStrikes = 0
    ) {

        const direct =
            this.firstNumber(

                root.cloudToGround,

                root.cloud_to_ground,

                root.cg,

                root.cgCount

            );

        if (
            direct > 0
        ) {

            return Math.round(
                this.clamp(
                    direct,
                    0,
                    totalStrikes
                )
            );

        }

        const events =
            this.getStrikeEvents(
                root
            );

        if (
            events.length
        ) {

            const count =
                events.filter(
                    event => {

                        const type =
                            String(

                                event?.type ||

                                event?.strikeType ||

                                event?.category ||

                                ""

                            )
                                .trim()
                                .toUpperCase();

                        return (

                            type === "CG" ||

                            type === "CLOUD_TO_GROUND" ||

                            type === "GROUND"

                        );

                    }
                )
                .length;

            return Math.min(
                count,
                totalStrikes
            );

        }

        return Math.round(
            totalStrikes * 0.60
        );

    },

    extractIntraCloudCount(
        root = {},
        totalStrikes = 0,
        cloudToGround = 0
    ) {

        const direct =
            this.firstNumber(

                root.intraCloud,

                root.intra_cloud,

                root.ic,

                root.icCount

            );

        if (
            direct > 0
        ) {

            return Math.round(
                this.clamp(
                    direct,
                    0,
                    totalStrikes
                )
            );

        }

        return Math.max(
            0,
            totalStrikes -
            cloudToGround
        );

    },

    getStrikeEvents(
        root = {}
    ) {

        const collections = [

            root.events,

            root.strikeEvents,

            root.lightningEvents,

            root.points,

            root.features

        ];

        for (
            const collection of collections
        ) {

            if (
                Array.isArray(
                    collection
                )
            ) {

                return collection;

            }

        }

        return [];

    },

    /* =====================================================
       NEAREST STRIKE
       ===================================================== */

    extractNearestStrikeDistance(
        root = {},
        city = {}
    ) {

        const direct =
            this.firstNumber(

                root.nearestStrikeKm,

                root.nearestDistanceKm,

                root.distanceKm,

                root.nearest_distance_km

            );

        if (
            direct > 0
        ) {

            return Number(
                this.clamp(

                    direct,

                    0,

                    this.config
                        .detectionRadiusKm

                )
                    .toFixed(
                        1
                    )
            );

        }

        const events =
            this.getStrikeEvents(
                root
            );

        let nearest =
            Infinity;

        for (
            const event of events
        ) {

            const coordinates =
                this.extractEventCoordinates(
                    event
                );

            if (
                !coordinates
            ) {

                continue;

            }

            const distance =
                this.haversineDistanceKm(

                    city.lat,

                    city.lon,

                    coordinates.lat,

                    coordinates.lon

                );

            if (
                Number.isFinite(
                    distance
                )
            ) {

                nearest =
                    Math.min(
                        nearest,
                        distance
                    );

            }

        }

        if (
            Number.isFinite(
                nearest
            )
        ) {

            return Number(
                nearest.toFixed(
                    1
                )
            );

        }

        return null;

    },

    extractEventCoordinates(
        event = {}
    ) {

        const geometry =
            event.geometry ||
            {};

        const coordinates =
            geometry.coordinates;

        if (
            Array.isArray(
                coordinates
            ) &&
            coordinates.length >= 2
        ) {

            const lon =
                Number(
                    coordinates[0]
                );

            const lat =
                Number(
                    coordinates[1]
                );

            if (
                Number.isFinite(
                    lat
                ) &&
                Number.isFinite(
                    lon
                )
            ) {

                return {
                    lat,
                    lon
                };

            }

        }

        const lat =
            this.firstFiniteNumber(

                event.lat,

                event.latitude,

                event.location?.lat,

                event.location?.latitude

            );

        const lon =
            this.firstFiniteNumber(

                event.lon,

                event.lng,

                event.longitude,

                event.location?.lon,

                event.location?.lng,

                event.location?.longitude

            );

        if (
            Number.isFinite(
                lat
            ) &&
            Number.isFinite(
                lon
            )
        ) {

            return {
                lat,
                lon
            };

        }

        return null;

    },

    /* =====================================================
       STRIKE DENSITY
       ===================================================== */

    calculateStrikeDensity({
        strikes,
        radiusKm
    }) {

        const radius =
            Math.max(
                1,
                this.safeNumber(
                    radiusKm,
                    1
                )
            );

        const area =
            Math.PI *
            radius *
            radius;

        const density =
            (
                this.safeNumber(
                    strikes,
                    0
                ) /
                area
            ) *
            10000;

        return Number(
            density.toFixed(
                2
            )
        );

    },

    /* =====================================================
       ACTIVITY SCORE
       ===================================================== */

    calculateActivityScore({
        strikes,
        nearestStrikeKm,
        strikeDensity,
        cloudToGround,
        observationWindowMinutes
    }) {

        const strikeScore =
            this.clamp(

                this.safeNumber(
                    strikes,
                    0
                ) /
                60 *
                100,

                0,

                100

            );

        const densityScore =
            this.clamp(

                this.safeNumber(
                    strikeDensity,
                    0
                ) /
                12 *
                100,

                0,

                100

            );

        const distanceScore =
            this.distanceToScore(
                nearestStrikeKm
            );

        const cgRatio =

            strikes > 0

                ? this.clamp(

                    this.safeNumber(
                        cloudToGround,
                        0
                    ) /
                    strikes *
                    100,

                    0,

                    100

                )

                : 0;

        const timeFactor =
            this.clamp(

                15 /
                Math.max(
                    1,
                    this.safeNumber(
                        observationWindowMinutes,
                        15
                    )
                ) *
                100,

                20,

                100

            );

        return Math.round(

            this.clamp(

                strikeScore *
                    0.30 +

                densityScore *
                    0.25 +

                distanceScore *
                    0.25 +

                cgRatio *
                    0.10 +

                timeFactor *
                    0.10,

                0,

                100

            )

        );

    },

    distanceToScore(
        distanceKm
    ) {

        if (
            distanceKm === null ||
            distanceKm === undefined
        ) {

            return 0;

        }

        const distance =
            this.safeNumber(
                distanceKm,
                999
            );

        if (
            distance <=
            this.config
                .criticalRadiusKm
        ) {

            return 100;

        }

        if (
            distance <=
            this.config
                .warningRadiusKm
        ) {

            return 80;

        }

        if (
            distance <=
            this.config
                .watchRadiusKm
        ) {

            return 55;

        }

        if (
            distance <=
            this.config
                .detectionRadiusKm
        ) {

            return 25;

        }

        return 0;

    },

    /* =====================================================
       TREND DETECTION
       ===================================================== */

    detectTrend({
        history = [],
        currentStrikes,
        currentActivityScore
    }) {

        if (
            !Array.isArray(
                history
            ) ||
            history.length < 2
        ) {

            return currentStrikes > 0
                ? "STABLE"
                : "NO_ACTIVITY";

        }

        const recent =
            history.slice(
                -3
            );

        const previousStrikeAverage =
            recent.reduce(

                (
                    total,
                    item
                ) =>
                    total +
                    this.safeNumber(
                        item.strikes,
                        0
                    ),

                0

            ) /
            recent.length;

        const previousActivityAverage =
            recent.reduce(

                (
                    total,
                    item
                ) =>
                    total +
                    this.safeNumber(
                        item.activityScore,
                        0
                    ),

                0

            ) /
            recent.length;

        const strikeDifference =

            this.safeNumber(
                currentStrikes,
                0
            ) -
            previousStrikeAverage;

        const activityDifference =

            this.safeNumber(
                currentActivityScore,
                0
            ) -
            previousActivityAverage;

        if (
            strikeDifference >= 10 ||
            activityDifference >= 20
        ) {

            return "RAPIDLY_INCREASING";

        }

        if (
            strikeDifference >= 3 ||
            activityDifference >= 8
        ) {

            return "INCREASING";

        }

        if (
            strikeDifference <= -3 ||
            activityDifference <= -8
        ) {

            return "DECREASING";

        }

        if (
            currentStrikes <= 0 &&
            currentActivityScore <= 0
        ) {

            return "NO_ACTIVITY";

        }

        return "STABLE";

    },
      /* =====================================================
       LIGHTNING RISK CLASSIFICATION
       ===================================================== */

    getLightningRiskLevel({
        strikes,
        nearestStrikeKm,
        activityScore,
        trend
    }) {

        const strikeCount =
            this.safeNumber(
                strikes,
                0
            );

        const distance =
            nearestStrikeKm === null ||
            nearestStrikeKm === undefined
                ? Infinity
                : this.safeNumber(
                    nearestStrikeKm,
                    Infinity
                );

        const activity =
            this.clamp(
                activityScore,
                0,
                100
            );

        const normalizedTrend =
            String(
                trend || "UNKNOWN"
            )
                .trim()
                .toUpperCase();

        if (
            distance <=
                this.config.criticalRadiusKm &&
            (
                activity >= 75 ||
                strikeCount >= 20 ||
                normalizedTrend ===
                    "RAPIDLY_INCREASING"
            )
        ) {

            return "EXTREME";

        }

        if (
            distance <=
                this.config.warningRadiusKm &&
            (
                activity >= 55 ||
                strikeCount >= 10 ||
                normalizedTrend ===
                    "INCREASING"
            )
        ) {

            return "HIGH";

        }

        if (
            distance <=
                this.config.watchRadiusKm &&
            (
                activity >= 30 ||
                strikeCount >= 4
            )
        ) {

            return "MODERATE";

        }

        if (
            strikeCount > 0 ||
            activity > 0
        ) {

            return "LOW";

        }

        return "NORMAL";

    },

    /* =====================================================
       WARNING LEVEL
       ===================================================== */

    getWarningLevelFromRisk(
        riskLevel
    ) {

        const value =
            String(
                riskLevel || "UNKNOWN"
            )
                .trim()
                .toUpperCase();

        const map = {

            EXTREME:
                "EMERGENCY",

            HIGH:
                "WARNING",

            MODERATE:
                "WATCH",

            LOW:
                "ADVISORY",

            NORMAL:
                "NORMAL",

            UNKNOWN:
                "UNKNOWN"

        };

        return map[value] ||
            "UNKNOWN";

    },

    /* =====================================================
       RAIN PROBABILITY
       ===================================================== */

    calculateRainProbability({
        strikes,
        nearestStrikeKm,
        activityScore,
        trend
    }) {

        const strikeScore =
            this.clamp(

                this.safeNumber(
                    strikes,
                    0
                ) /
                40 *
                100,

                0,

                100

            );

        const distanceScore =
            this.distanceToScore(
                nearestStrikeKm
            );

        const activity =
            this.clamp(
                activityScore,
                0,
                100
            );

        const trendScore =
            this.trendToScore(
                trend
            );

        return Math.round(

            this.clamp(

                strikeScore *
                    0.25 +

                distanceScore *
                    0.25 +

                activity *
                    0.35 +

                trendScore *
                    0.15,

                0,

                100

            )

        );

    },

    trendToScore(
        trend
    ) {

        const value =
            String(
                trend || "UNKNOWN"
            )
                .trim()
                .toUpperCase();

        const scores = {

            RAPIDLY_INCREASING:
                100,

            INCREASING:
                80,

            STABLE:
                50,

            DECREASING:
                25,

            NO_ACTIVITY:
                0,

            UNKNOWN:
                20

        };

        return scores[value] ?? 20;

    },

    /* =====================================================
       SIGNAL SCORE
       ===================================================== */

    calculateSignalScore({
        activityScore,
        confidence,
        freshnessScore,
        riskLevel
    }) {

        const riskScore =
            this.riskLevelToScore(
                riskLevel
            );

        return Math.round(

            this.clamp(

                this.safeNumber(
                    activityScore,
                    0
                ) *
                    0.40 +

                this.safeNumber(
                    confidence,
                    0
                ) *
                    0.20 +

                this.safeNumber(
                    freshnessScore,
                    0
                ) *
                    0.20 +

                riskScore *
                    0.20,

                0,

                100

            )

        );

    },

    riskLevelToScore(
        riskLevel
    ) {

        const value =
            String(
                riskLevel || "UNKNOWN"
            )
                .trim()
                .toUpperCase();

        const scores = {

            EXTREME:
                100,

            HIGH:
                80,

            MODERATE:
                55,

            LOW:
                25,

            NORMAL:
                5,

            UNKNOWN:
                0

        };

        return scores[value] ?? 0;

    },

    /* =====================================================
       CONFIDENCE ENGINE
       ===================================================== */

    calculateConfidence({
        strikes,
        nearestStrikeKm,
        strikeDensity,
        activityScore,
        freshnessScore,
        simulated = false
    }) {

        const strikeComponent =
            this.clamp(

                this.safeNumber(
                    strikes,
                    0
                ) /
                40 *
                100,

                0,

                100

            );

        const distanceComponent =
            this.distanceToScore(
                nearestStrikeKm
            );

        const densityComponent =
            this.clamp(

                this.safeNumber(
                    strikeDensity,
                    0
                ) /
                10 *
                100,

                0,

                100

            );

        const activityComponent =
            this.clamp(
                activityScore,
                0,
                100
            );

        const freshnessComponent =
            this.clamp(
                freshnessScore,
                0,
                100
            );

        let score =

            strikeComponent *
                0.20 +

            distanceComponent *
                0.20 +

            densityComponent *
                0.15 +

            activityComponent *
                0.25 +

            freshnessComponent *
                0.20;

        if (
            simulated
        ) {

            score =
                Math.min(
                    score,
                    65
                );

        }

        return Math.round(

            this.clamp(
                score,
                simulated
                    ? 20
                    : 0,
                simulated
                    ? 65
                    : 100
            )

        );

    },

    /* =====================================================
       FRESHNESS
       ===================================================== */

    calculateFreshnessScore(
        ageMinutes
    ) {

        const age =
            this.safeNumber(
                ageMinutes,
                999
            );

        if (
            age <= 2
        ) {

            return 100;

        }

        if (
            age <= 5
        ) {

            return 92;

        }

        if (
            age <= 10
        ) {

            return 80;

        }

        if (
            age <= 15
        ) {

            return 65;

        }

        if (
            age <=
            this.config
                .maximumAcceptedAgeMinutes
        ) {

            return 50;

        }

        if (
            age <= 45
        ) {

            return 25;

        }

        return 0;

    },

    getFreshnessStatus(
        ageMinutes
    ) {

        const score =
            this.calculateFreshnessScore(
                ageMinutes
            );

        if (
            score >= 90
        ) {

            return "FRESH";

        }

        if (
            score >= 65
        ) {

            return "ACCEPTABLE";

        }

        if (
            score >= 40
        ) {

            return "STALE";

        }

        return "EXPIRED";

    },

    /* =====================================================
       DATA QUALITY PREPARATION
       ===================================================== */

    buildDataQualityInput(
        result
    ) {

        if (
            !result ||
            typeof result !==
                "object"
        ) {

            return {

                sourceKey:
                    "lightning",

                available:
                    false,

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

        const completeness =
            this.calculateCompleteness(
                result
            );

        const spatialRelevance =
            this.calculateSpatialRelevance({
                nearestStrikeKm:
                    result.nearestStrikeKm,

                detectionRadiusKm:
                    result.detectionRadiusKm
            });

        const history =
            this.getCityHistory(
                result
            );

        const temporalContinuity =
            this.calculateTemporalContinuity(
                history
            );

        const technicalHealth =
            this.calculateTechnicalHealth();

        return {

            sourceKey:
                "lightning",

            available:
                result.available ===
                true,

            simulated:
                result.simulated ===
                true,

            freshness:
                this.clamp(
                    result.freshnessScore,
                    0,
                    100
                ),

            completeness,

            reliability:
                this.clamp(
                    this.safeNumber(
                        result.reliability,
                        0
                    ) *
                    100,
                    0,
                    100
                ),

            spatialRelevance,

            temporalContinuity,

            technicalHealth,

            timestamp:
                result.timestamp,

            city:
                result.city,

            details: {

                strikes:
                    result.strikes,

                nearestStrikeKm:
                    result.nearestStrikeKm,

                strikeDensity:
                    result.strikeDensity,

                activityScore:
                    result.activityScore,

                confidence:
                    result.confidence,

                dataAgeMinutes:
                    result.dataAgeMinutes

            }

        };

    },

    calculateCompleteness(
        result
    ) {

        const fields = [

            result.timestamp,

            result.strikes,

            result.strikeDensity,

            result.activityScore,

            result.confidence,

            result.trend,

            result.riskLevel,

            result.observationWindowMinutes,

            result.detectionRadiusKm

        ];

        const completed =
            fields.filter(
                value => {

                    return (
                        value !== null &&
                        value !== undefined &&
                        value !== ""
                    );

                }
            )
            .length;

        return Math.round(

            completed /
            fields.length *
            100

        );

    },

    calculateSpatialRelevance({
        nearestStrikeKm,
        detectionRadiusKm
    }) {

        if (
            nearestStrikeKm === null ||
            nearestStrikeKm === undefined
        ) {

            return 20;

        }

        const distance =
            Math.max(
                0,
                this.safeNumber(
                    nearestStrikeKm,
                    999
                )
            );

        const radius =
            Math.max(
                1,
                this.safeNumber(
                    detectionRadiusKm,
                    this.config
                        .detectionRadiusKm
                )
            );

        if (
            distance <=
            this.config
                .criticalRadiusKm
        ) {

            return 100;

        }

        if (
            distance <=
            this.config
                .warningRadiusKm
        ) {

            return 85;

        }

        if (
            distance <=
            this.config
                .watchRadiusKm
        ) {

            return 65;

        }

        if (
            distance <= radius
        ) {

            const ratio =
                1 -
                distance /
                radius;

            return Math.round(

                this.clamp(
                    25 +
                    ratio *
                    30,
                    25,
                    55
                )

            );

        }

        return 0;

    },

    calculateTemporalContinuity(
        history = []
    ) {

        if (
            !Array.isArray(
                history
            ) ||
            !history.length
        ) {

            return 20;

        }

        if (
            history.length >=
            this.config.historyLimit *
                0.75
        ) {

            return 100;

        }

        if (
            history.length >= 12
        ) {

            return 85;

        }

        if (
            history.length >= 6
        ) {

            return 65;

        }

        if (
            history.length >= 3
        ) {

            return 45;

        }

        return 30;

    },

    calculateTechnicalHealth() {

        const completed =

            this.statistics.successes +

            this.statistics.failures;

        if (
            completed === 0
        ) {

            return 60;

        }

        const successRate =

            this.statistics.successes /
            completed *
            100;

        const timeoutPenalty =
            Math.min(

                30,

                this.statistics.timeouts *
                3

            );

        return Math.round(

            this.clamp(

                successRate -
                timeoutPenalty,

                0,

                100

            )

        );

    },

    /* =====================================================
       SOURCE CONTRIBUTION PREPARATION
       ===================================================== */

    buildContributionInput(
        result
    ) {

        return {

            sourceKey:
                "lightning",

            available:
                result?.available ===
                true,

            signalScore:
                this.safeNumber(
                    result?.signalScore,
                    0
                ),

            confidence:
                this.safeNumber(
                    result?.confidence,
                    0
                ),

            reliability:
                this.safeNumber(
                    result?.reliability,
                    0
                ),

            freshnessScore:
                this.safeNumber(
                    result?.freshnessScore,
                    0
                ),

            rainProbability:
                this.safeNumber(
                    result?.rainProbability,
                    0
                ),

            riskLevel:
                result?.riskLevel ||
                "UNKNOWN",

            simulated:
                result?.simulated ===
                true,

            dataQualityInput:
                this.buildDataQualityInput(
                    result
                )

        };

    },

    /* =====================================================
       EXPLAINABLE INTELLIGENCE
       ===================================================== */

    buildExplanation(
        result
    ) {

        const reasons =
            [];

        if (
            result.strikes <= 0
        ) {

            reasons.push(

                this.text(

                    "No lightning strikes were detected within the observation radius.",

                    "لم يتم رصد ضربات برق داخل نطاق المراقبة."

                )

            );

        }

        if (
            result.nearestStrikeKm !==
                null &&
            result.nearestStrikeKm <=
                this.config
                    .criticalRadiusKm
        ) {

            reasons.push(

                this.text(

                    `A lightning strike was detected within ${result.nearestStrikeKm} km of the city.`,

                    `تم رصد ضربة برق على بُعد ${result.nearestStrikeKm} كم من المدينة.`

                )

            );

        } else if (
            result.nearestStrikeKm !==
                null &&
            result.nearestStrikeKm <=
                this.config
                    .warningRadiusKm
        ) {

            reasons.push(

                this.text(

                    "Lightning activity is close to the monitored city.",

                    "نشاط البرق قريب من المدينة المراقبة."

                )

            );

        }

        if (
            result.trend ===
                "RAPIDLY_INCREASING"
        ) {

            reasons.push(

                this.text(

                    "Lightning activity is increasing rapidly.",

                    "نشاط البرق يتصاعد بسرعة."

                )

            );

        } else if (
            result.trend ===
                "INCREASING"
        ) {

            reasons.push(

                this.text(

                    "Lightning activity is increasing.",

                    "نشاط البرق في ازدياد."

                )

            );

        } else if (
            result.trend ===
                "DECREASING"
        ) {

            reasons.push(

                this.text(

                    "Lightning activity is decreasing.",

                    "نشاط البرق في تراجع."

                )

            );

        }

        if (
            result.activityScore >= 75
        ) {

            reasons.push(

                this.text(

                    "The lightning activity score is very high.",

                    "مؤشر نشاط البرق مرتفع جدًا."

                )

            );

        } else if (
            result.activityScore >= 50
        ) {

            reasons.push(

                this.text(

                    "The lightning activity score is elevated.",

                    "مؤشر نشاط البرق مرتفع."

                )

            );

        }

        if (
            result.freshnessScore < 50
        ) {

            reasons.push(

                this.text(

                    "Lightning data is older than the preferred operational window.",

                    "بيانات البرق أقدم من النافذة التشغيلية المفضلة."

                )

            );

        }

        if (
            result.simulated
        ) {

            reasons.push(

                this.text(

                    "This result was generated in simulation mode and is not a live observation.",

                    "هذه النتيجة مولدة في وضع المحاكاة وليست رصدًا حيًا."

                )

            );

        }

        if (
            reasons.length === 0
        ) {

            reasons.push(

                this.text(

                    "Lightning activity is within normal operational limits.",

                    "نشاط البرق ضمن الحدود التشغيلية الطبيعية."

                )

            );

        }

        return reasons;

    },
      /* =====================================================
       TIMESTAMP EXTRACTION
       ===================================================== */

    extractTimestamp(
        root = {}
    ) {

        const candidates = [

            root.timestamp,

            root.time,

            root.observedAt,

            root.observationTime,

            root.updatedAt,

            root.generatedAt,

            root.issueTime,

            root.issuedAt,

            root.datetime,

            root.dateTime

        ];

        for (
            const candidate of candidates
        ) {

            if (
                candidate === null ||
                candidate === undefined ||
                candidate === ""
            ) {

                continue;

            }

            if (
                typeof candidate ===
                    "number" ||
                (
                    typeof candidate ===
                        "string" &&
                    /^\d+$/.test(
                        candidate.trim()
                    )
                )
            ) {

                const numeric =
                    Number(
                        candidate
                    );

                if (
                    Number.isFinite(
                        numeric
                    )
                ) {

                    const milliseconds =
                        numeric < 100000000000
                            ? numeric * 1000
                            : numeric;

                    const date =
                        new Date(
                            milliseconds
                        );

                    if (
                        Number.isFinite(
                            date.getTime()
                        )
                    ) {

                        return date.toISOString();

                    }

                }

            }

            const date =
                new Date(
                    candidate
                );

            if (
                Number.isFinite(
                    date.getTime()
                )
            ) {

                return date.toISOString();

            }

        }

        return new Date()
            .toISOString();

    },

    calculateAgeMinutes(
        timestamp
    ) {

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
       HAVERSINE DISTANCE
       ===================================================== */

    haversineDistanceKm(
        lat1,
        lon1,
        lat2,
        lon2
    ) {

        const firstLat =
            this.safeNumber(
                lat1,
                NaN
            );

        const firstLon =
            this.safeNumber(
                lon1,
                NaN
            );

        const secondLat =
            this.safeNumber(
                lat2,
                NaN
            );

        const secondLon =
            this.safeNumber(
                lon2,
                NaN
            );

        if (
            !Number.isFinite(
                firstLat
            ) ||
            !Number.isFinite(
                firstLon
            ) ||
            !Number.isFinite(
                secondLat
            ) ||
            !Number.isFinite(
                secondLon
            )
        ) {

            return Infinity;

        }

        const earthRadiusKm =
            6371;

        const toRadians =
            degrees =>
                degrees *
                Math.PI /
                180;

        const deltaLat =
            toRadians(
                secondLat -
                firstLat
            );

        const deltaLon =
            toRadians(
                secondLon -
                firstLon
            );

        const a =

            Math.sin(
                deltaLat / 2
            ) ** 2 +

            Math.cos(
                toRadians(
                    firstLat
                )
            ) *

            Math.cos(
                toRadians(
                    secondLat
                )
            ) *

            Math.sin(
                deltaLon / 2
            ) ** 2;

        const c =
            2 *
            Math.atan2(

                Math.sqrt(
                    a
                ),

                Math.sqrt(
                    1 - a
                )

            );

        return earthRadiusKm *
            c;

    },

    /* =====================================================
       UNAVAILABLE RESULT
       ===================================================== */

    createUnavailableResult(
        city = {},
        status = "UNAVAILABLE",
        error = "LIGHTNING_UNAVAILABLE"
    ) {

        const normalizedCity =
            this.normalizeCity(
                city
            );

        const simulated =
            this.config.mode ===
            "SIMULATION";

        return {

            sourceKey:
                "lightning",

            sourceName:
                this.text(
                    "Lightning Detection",
                    "رصد البرق"
                ),

            adapter:
                "LightningAdapter",

            adapterName:
                "LightningAdapter",

            provider:
                this.config.provider,

            available:
                false,

            ok:
                false,

            official:
                false,

            simulated,

            mode:
                this.config.mode,

            status:
                status ||
                "UNAVAILABLE",

            city:
                normalizedCity.name,

            cityId:
                normalizedCity.id,

            lat:
                normalizedCity.lat,

            lon:
                normalizedCity.lon,

            region:
                normalizedCity.region,

            timestamp:
                new Date()
                    .toISOString(),

            ageMinutes:
                0,

            dataAgeMinutes:
                0,

            freshnessScore:
                0,

            reliability:
                0,

            trust:
                0,

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

            riskLevel:
                "UNKNOWN",

            rainProbability:
                0,

            rainAmount:
                0,

            signalScore:
                0,

            confidence:
                0,

            warningLevel:
                "UNKNOWN",

            observationWindowMinutes:
                this.config
                    .observationWindowMinutes,

            detectionRadiusKm:
                this.config
                    .detectionRadiusKm,

            responseTimeMs:
                0,

            cached:
                false,

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

                trendLabel:
                    this.getTrendLabel(
                        "UNKNOWN"
                    ),

                riskLevel:
                    "UNKNOWN",

                riskLabel:
                    this.getRiskLabel(
                        "UNKNOWN"
                    ),

                simulated,

                mode:
                    this.config.mode,

                configured:
                    this.isConfigured(),

                dataAgeMinutes:
                    0,

                freshnessScore:
                    0,

                observationWindowMinutes:
                    this.config
                        .observationWindowMinutes,

                detectionRadiusKm:
                    this.config
                        .detectionRadiusKm

            },

            explanation: [

                this.text(

                    "Lightning data is currently unavailable.",

                    "بيانات البرق غير متاحة حاليًا."

                )

            ],

            raw:
                null,

            error:
                error ||
                "LIGHTNING_UNAVAILABLE"

        };

    },

    /* =====================================================
       RESULT ENRICHMENT
       ===================================================== */

    enrichResult(
        result
    ) {

        if (
            !result ||
            typeof result !==
                "object"
        ) {

            return result;

        }

        const explanation =
            this.buildExplanation(
                result
            );

        const dataQualityInput =
            this.buildDataQualityInput(
                result
            );

        const contributionInput =
            this.buildContributionInput(
                result
            );

        return {

            ...result,

            explanation,

            dataQualityInput,

            contributionInput,

            details: {

                ...result.details,

                explanation,

                dataQualityInput,

                contributionInput

            }

        };

    },

    /* =====================================================
       SUCCESS / FAILURE EVENTS
       ===================================================== */

    publishSuccess(
        result
    ) {

        const enriched =
            this.enrichResult(
                result
            );

        this.lastCollection =
            enriched;

        this.latestCollection =
            enriched;

        window.RG31.latestLightning =
            enriched;

        window.RG30.latestLightning =
            enriched;

        if (
            !this.config.publishEvents
        ) {

            return enriched;

        }

        window.dispatchEvent(

            new CustomEvent(

                "rg31:lightning-data-received",

                {
                    detail:
                        enriched
                }

            )

        );

        window.dispatchEvent(

            new CustomEvent(

                "rg30:lightning-data-received",

                {
                    detail:
                        enriched
                }

            )

        );

        window.dispatchEvent(

            new CustomEvent(

                "rg31:source-updated",

                {
                    detail: {

                        sourceKey:
                            "lightning",

                        result:
                            enriched,

                        timestamp:
                            new Date()
                                .toISOString()

                    }
                }

            )

        );

        return enriched;

    },

    publishFailure(
        result
    ) {

        this.lastCollection =
            result;

        this.latestCollection =
            result;

        window.RG31.latestLightning =
            result;

        window.RG30.latestLightning =
            result;

        if (
            !this.config.publishEvents
        ) {

            return result;

        }

        window.dispatchEvent(

            new CustomEvent(

                "rg31:lightning-data-failed",

                {
                    detail:
                        result
                }

            )

        );

        window.dispatchEvent(

            new CustomEvent(

                "rg30:lightning-data-failed",

                {
                    detail:
                        result
                }

            )

        );

        window.dispatchEvent(

            new CustomEvent(

                "rg31:source-updated",

                {
                    detail: {

                        sourceKey:
                            "lightning",

                        result,

                        timestamp:
                            new Date()
                                .toISOString()

                    }
                }

            )

        );

        return result;

    },

    refreshPublishedState() {

        if (
            !this.latestCollection
        ) {

            return;

        }

        const refreshed = {

            ...this.latestCollection,

            sourceName:
                this.text(
                    "Lightning Detection",
                    "رصد البرق"
                ),

            details: {

                ...this.latestCollection
                    .details,

                trendLabel:
                    this.getTrendLabel(
                        this.latestCollection
                            .trend
                    ),

                riskLabel:
                    this.getRiskLabel(
                        this.latestCollection
                            .riskLevel
                    )

            },

            explanation:
                this.buildExplanation(
                    this.latestCollection
                )

        };

        this.latestCollection =
            refreshed;

        this.lastCollection =
            refreshed;

        window.RG31.latestLightning =
            refreshed;

        window.RG30.latestLightning =
            refreshed;

        window.dispatchEvent(

            new CustomEvent(

                "rg31:lightning-state-refreshed",

                {
                    detail:
                        refreshed
                }

            )

        );

    },

    /* =====================================================
       STATISTICS
       ===================================================== */

    updateAverageResponse(
        responseTimeMs
    ) {

        const duration =
            this.safeNumber(
                responseTimeMs,
                0
            );

        if (
            duration < 0
        ) {

            return;

        }

        this.statistics.totalResponseMs +=
            duration;

        const completed =
            Math.max(
                1,
                this.statistics.successes
            );

        this.statistics.averageResponseMs =
            Math.round(

                this.statistics.totalResponseMs /
                completed

            );

    },

    resetStatistics() {

        this.statistics = {

            requests:
                0,

            successes:
                0,

            failures:
                0,

            retries:
                0,

            timeouts:
                0,

            cacheHits:
                0,

            liveRequests:
                0,

            proxyRequests:
                0,

            simulationRequests:
                0,

            totalResponseMs:
                0,

            averageResponseMs:
                0,

            totalStrikesDetected:
                0,

            nearestStrikeKm:
                null,

            highestActivityScore:
                0

        };

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

            enabled:
                this.config.enabled,

            configured:
                this.isConfigured(),

            collecting:
                this.collecting,

            collectionNumber:
                this.collectionNumber,

            mode:
                this.config.mode,

            modeLabel:
                this.getModeLabel(),

            provider:
                this.config.provider,

            reliability:
                this.getCurrentReliability(),

            lastRequestAt:
                this.lastRequestAt,

            lastSuccessAt:
                this.lastSuccessAt,

            lastFailureAt:
                this.lastFailureAt,

            lastError:
                this.lastError,

            cacheSize:
                this.cache.size,

            monitoredCities:
                this.cityHistory.size,

            health:
                this.health(),

            lastCollection:
                this.lastCollection,

            latestCollection:
                this.latestCollection

        };

    },

    /* =====================================================
       EXECUTIVE REPORT
       ===================================================== */

    buildExecutiveReport(
        result =
            this.latestCollection
    ) {

        if (
            !result
        ) {

            return {

                available:
                    false,

                sourceKey:
                    "lightning",

                title:
                    this.text(
                        "Lightning Intelligence",
                        "استخبارات البرق"
                    ),

                status:
                    "WAITING",

                message:
                    this.text(
                        "No lightning collection has been completed.",
                        "لم تكتمل أي عملية جمع لبيانات البرق."
                    )

            };

        }

        return {

            available:
                result.available ===
                true,

            sourceKey:
                "lightning",

            title:
                this.text(
                    "Lightning Intelligence",
                    "استخبارات البرق"
                ),

            city:
                result.city,

            status:
                result.status,

            statusLabel:
                this.getStatusLabel(
                    result.status
                ),

            mode:
                result.mode,

            modeLabel:
                this.getModeLabel(
                    result.mode
                ),

            simulated:
                result.simulated ===
                true,

            strikes:
                this.safeNumber(
                    result.strikes,
                    0
                ),

            cloudToGround:
                this.safeNumber(
                    result.cloudToGround,
                    0
                ),

            intraCloud:
                this.safeNumber(
                    result.intraCloud,
                    0
                ),

            nearestStrikeKm:
                result.nearestStrikeKm,

            strikeDensity:
                this.safeNumber(
                    result.strikeDensity,
                    0
                ),

            activityScore:
                this.safeNumber(
                    result.activityScore,
                    0
                ),

            riskLevel:
                result.riskLevel ||
                "UNKNOWN",

            riskLabel:
                this.getRiskLabel(
                    result.riskLevel
                ),

            trend:
                result.trend ||
                "UNKNOWN",

            trendLabel:
                this.getTrendLabel(
                    result.trend
                ),

            rainProbability:
                this.safeNumber(
                    result.rainProbability,
                    0
                ),

            signalScore:
                this.safeNumber(
                    result.signalScore,
                    0
                ),

            confidence:
                this.safeNumber(
                    result.confidence,
                    0
                ),

            reliability:
                this.safeNumber(
                    result.reliability,
                    0
                ),

            freshnessScore:
                this.safeNumber(
                    result.freshnessScore,
                    0
                ),

            dataAgeMinutes:
                this.safeNumber(
                    result.dataAgeMinutes,
                    0
                ),

            warningLevel:
                result.warningLevel ||
                "UNKNOWN",

            explanation:
                Array.isArray(
                    result.explanation
                )
                    ? result.explanation
                    : this.buildExplanation(
                        result
                    ),

            dataQualityInput:
                result.dataQualityInput ||
                this.buildDataQualityInput(
                    result
                ),

            contributionInput:
                result.contributionInput ||
                this.buildContributionInput(
                    result
                ),

            timestamp:
                result.timestamp,

            error:
                result.error ||
                null

        };

    },

    /* =====================================================
       DEBUG SNAPSHOT
       ===================================================== */

    getDebugSnapshot() {

        return {

            adapter:
                "LightningAdapter",

            version:
                this.version,

            config: {

                ...this.config,

                apiKey:
                    this.config.apiKey
                        ? "***"
                        : ""

            },

            state:
                this.getState(),

            statistics: {

                ...this.statistics

            },

            cacheKeys:
                Array.from(
                    this.cache.keys()
                ),

            historyCities:
                Array.from(
                    this.cityHistory.keys()
                ),

            timestamp:
                new Date()
                    .toISOString()

        };

    },
      /* =====================================================
       HELPERS
       ===================================================== */

    normalizeCity(
        city = {}
    ) {

        return {

            ...city,

            id:
                city.id ??
                city.cityId ??
                null,

            name:
                city.name ||
                city.city ||
                city.cityName ||
                "Unknown",

            region:
                city.region ||
                city.area ||
                city.name ||
                city.city ||
                "Unknown",

            lat:
                this.safeNumber(
                    city.lat ??
                    city.latitude,
                    24
                ),

            lon:
                this.safeNumber(
                    city.lon ??
                    city.lng ??
                    city.longitude,
                    45
                )

        };

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

    firstNumber(
        ...values
    ) {

        for (
            const value of values
        ) {

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

    firstFiniteNumber(
        ...values
    ) {

        for (
            const value of values
        ) {

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

        return NaN;

    },

    clamp(
        value,
        min = 0,
        max = 100
    ) {

        const number =
            this.safeNumber(
                value,
                min
            );

        return Math.min(

            max,

            Math.max(
                min,
                number
            )

        );

    },

    random(
        min,
        max
    ) {

        const safeMin =
            this.safeNumber(
                min,
                0
            );

        const safeMax =
            this.safeNumber(
                max,
                safeMin
            );

        if (
            safeMax <=
            safeMin
        ) {

            return safeMin;

        }

        return (

            Math.random() *
            (
                safeMax -
                safeMin
            )

        ) +
        safeMin;

    },

    delay(
        milliseconds
    ) {

        const safeDelay =
            Math.max(
                0,
                this.safeNumber(
                    milliseconds,
                    0
                )
            );

        return new Promise(

            resolve => {

                window.setTimeout(
                    resolve,
                    safeDelay
                );

            }

        );

    },

    withTimeout(
        promise,
        timeoutMs
    ) {

        const safeTimeout =
            Math.max(
                1,
                this.safeNumber(
                    timeoutMs,
                    this.config.timeoutMs
                )
            );

        let timeoutId =
            null;

        const timeoutPromise =
            new Promise(

                (
                    _,
                    reject
                ) => {

                    timeoutId =
                        window.setTimeout(

                            () => {

                                reject(

                                    new Error(
                                        `LIGHTNING_TIMEOUT_AFTER_${safeTimeout}`
                                    )

                                );

                            },

                            safeTimeout

                        );

                }

            );

        return Promise.race([

            Promise.resolve(
                promise
            ),

            timeoutPromise

        ])
        .finally(
            () => {

                if (
                    timeoutId !==
                    null
                ) {

                    window.clearTimeout(
                        timeoutId
                    );

                }

            }
        );

    },

    escapeHtml(
        value
    ) {

        return String(
            value ?? ""
        )
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

    },

    writeLog(
        message,
        type = "info"
    ) {

        const translated =
            this.translateMessage(
                message
            );

        const prefix =
            "[RG31 Lightning]";

        if (
            type ===
            "error"
        ) {

            console.error(
                prefix,
                translated
            );

        } else if (
            type ===
            "warning"
        ) {

            console.warn(
                prefix,
                translated
            );

        } else {

            console.log(
                prefix,
                translated
            );

        }

        if (
            window.RG23
                ?.Brain
                ?.writeCommander
        ) {

            try {

                window.RG23.Brain
                    .writeCommander(
                        translated,
                        type
                    );

            } catch (error) {

                console.warn(
                    "RG31 Lightning commander logging skipped:",
                    error
                );

            }

        }

    },

    /* =====================================================
       SOURCE ADAPTER COMPATIBILITY
       ===================================================== */

    buildSourceAdapterResult(
        result =
            this.latestCollection
    ) {

        if (
            !result ||
            typeof result !==
                "object"
        ) {

            return this.createUnavailableResult(
                {},
                "UNAVAILABLE",
                "LIGHTNING_RESULT_NOT_AVAILABLE"
            );

        }

        return {

            sourceKey:
                "lightning",

            sourceName:
                this.text(
                    "Lightning Detection",
                    "رصد البرق"
                ),

            adapter:
                "LightningAdapter",

            adapterName:
                "LightningAdapter",

            provider:
                result.provider ||
                this.config.provider,

            available:
                result.available ===
                true,

            ok:
                result.ok ===
                true,

            status:
                result.status ||
                (
                    result.available
                        ? "ACTIVE"
                        : "UNAVAILABLE"
                ),

            official:
                result.official ===
                true,

            simulated:
                result.simulated ===
                true,

            mode:
                result.mode ||
                this.config.mode,

            city:
                result.city,

            cityId:
                result.cityId,

            lat:
                result.lat,

            lon:
                result.lon,

            region:
                result.region,

            timestamp:
                result.timestamp ||
                new Date()
                    .toISOString(),

            ageMinutes:
                this.safeNumber(
                    result.ageMinutes,
                    0
                ),

            reliability:
                this.safeNumber(
                    result.reliability,
                    this.getCurrentReliability()
                ),

            trust:
                this.safeNumber(
                    result.trust,
                    this.getCurrentReliability()
                ),

            rainProbability:
                this.safeNumber(
                    result.rainProbability,
                    0
                ),

            rainAmount:
                0,

            signalScore:
                this.safeNumber(
                    result.signalScore,
                    0
                ),

            confidence:
                this.safeNumber(
                    result.confidence,
                    0
                ),

            warningLevel:
                result.warningLevel ||
                "UNKNOWN",

            details: {

                strikes:
                    this.safeNumber(
                        result.strikes,
                        0
                    ),

                cloudToGround:
                    this.safeNumber(
                        result.cloudToGround,
                        0
                    ),

                intraCloud:
                    this.safeNumber(
                        result.intraCloud,
                        0
                    ),

                nearestStrikeKm:
                    result.nearestStrikeKm,

                distanceKm:
                    result.nearestStrikeKm,

                strikeDensity:
                    this.safeNumber(
                        result.strikeDensity,
                        0
                    ),

                activityScore:
                    this.safeNumber(
                        result.activityScore,
                        0
                    ),

                trend:
                    result.trend ||
                    "UNKNOWN",

                riskLevel:
                    result.riskLevel ||
                    "UNKNOWN",

                freshnessScore:
                    this.safeNumber(
                        result.freshnessScore,
                        0
                    ),

                dataAgeMinutes:
                    this.safeNumber(
                        result.dataAgeMinutes,
                        0
                    ),

                observationWindowMinutes:
                    this.safeNumber(
                        result.observationWindowMinutes,
                        this.config
                            .observationWindowMinutes
                    ),

                detectionRadiusKm:
                    this.safeNumber(
                        result.detectionRadiusKm,
                        this.config
                            .detectionRadiusKm
                    ),

                explanation:
                    Array.isArray(
                        result.explanation
                    )
                        ? result.explanation
                        : this.buildExplanation(
                            result
                        ),

                dataQualityInput:
                    result.dataQualityInput ||
                    this.buildDataQualityInput(
                        result
                    ),

                contributionInput:
                    result.contributionInput ||
                    this.buildContributionInput(
                        result
                    )

            },

            raw:
                result.raw ||
                null,

            error:
                result.error ||
                null

        };

    },

    /* =====================================================
       RESET
       ===================================================== */

    reset() {

        this.collecting =
            false;

        this.collectionNumber =
            0;

        this.lastCollection =
            null;

        this.latestCollection =
            null;

        this.lastRequestAt =
            null;

        this.lastSuccessAt =
            null;

        this.lastFailureAt =
            null;

        this.lastError =
            null;

        this.cache.clear();

        this.cityHistory.clear();

        this.resetStatistics();

        window.RG31.latestLightning =
            null;

        window.RG30.latestLightning =
            null;

        this.writeLog(

            this.text(
                "Lightning Adapter V31 was reset.",
                "تمت إعادة ضبط محول البرق V31."
            ),

            "warning"

        );

        window.dispatchEvent(

            new CustomEvent(

                "rg31:lightning-adapter-reset",

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
       DESTROY
       ===================================================== */

    destroy() {

        this.reset();

        this.initialized =
            false;

        this.writeLog(

            this.text(
                "Lightning Adapter V31 was destroyed.",
                "تم إيقاف محول البرق V31."
            ),

            "warning"

        );

        window.dispatchEvent(

            new CustomEvent(

                "rg31:lightning-adapter-destroyed",

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
   RG30 COMPATIBILITY ALIAS
   يسمح لـ SourceAdapter V30 بالعثور على المحول الجديد
   عبر RG30.LightningAdapter
   ========================================================= */

window.RG30.LightningAdapter =
    window.RG31.LightningAdapter;

/* =========================================================
   GLOBAL SHORTCUTS
   ========================================================= */

window.collectLightningV31 =
    async city => {

        const result =
            await RG31.LightningAdapter
                .collect(
                    city
                );

        return RG31.LightningAdapter
            .buildSourceAdapterResult(
                result
            );

    };

window.executeLightningV31 =
    async city => {

        const result =
            await RG31.LightningAdapter
                .execute(
                    city
                );

        return RG31.LightningAdapter
            .buildSourceAdapterResult(
                result
            );

    };

window.getLightningV31State =
    () =>

        RG31.LightningAdapter
            .getState();

window.getLightningV31Health =
    () =>

        RG31.LightningAdapter
            .health();

window.getLightningV31Report =
    () =>

        RG31.LightningAdapter
            .buildExecutiveReport();

window.getLightningV31Debug =
    () =>

        RG31.LightningAdapter
            .getDebugSnapshot();

window.setLightningV31Mode =
    mode =>

        RG31.LightningAdapter
            .setMode(
                mode
            );

window.clearLightningV31Cache =
    () =>

        RG31.LightningAdapter
            .clearCache();

window.resetLightningV31 =
    () =>

        RG31.LightningAdapter
            .reset();

window.destroyLightningV31 =
    () =>

        RG31.LightningAdapter
            .destroy();

/* =========================================================
   AUTO START
   ========================================================= */

(function initializeLightningV31() {

    const start =
        () => {

            try {

                RG31.LightningAdapter
                    .init();

                console.log(

                    "%cRainGuard AI V31 Lightning Adapter Ready",

                    "color:#f6c344;font-size:14px;font-weight:bold;"

                );

            } catch (error) {

                console.error(
                    "Lightning Adapter V31 initialization failed:",
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
                once: true
            }
        );

    } else {

        start();

    }

})();
