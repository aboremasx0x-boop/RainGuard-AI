/* =========================================================
   RainGuard AI V30
   Anwaa / National Center for Meteorology Adapter
   File: frontend/js/anwaa_adapter_v30.js

   ملاحظات:
   - هذا الملف لا يفترض وجود API عام ومفتوح لأنواء.
   - يتم الربط الفعلي فقط عند توفير رابط رسمي وتصريح استخدام.
   - عند عدم وجود الربط الرسمي يعيد الحالة PENDING_API بأمان.
   ========================================================= */

window.RG30 = window.RG30 || {};

RG30.AnwaaAdapter = {

    version: "30.0.0",

    initialized: false,

    lastRequestAt: null,
    lastSuccessAt: null,
    lastFailureAt: null,
    lastError: null,

    cache: new Map(),

    config: {

        enabled: true,

        /*
         * ضع رابط API الرسمي هنا عند توفره.
         *
         * مثال شكلي فقط:
         * endpoint:
         * "https://official-api.example.sa/weather"
         *
         * لا تستخدم رابطًا غير معتمد.
         */
        endpoint: "",

        /*
         * نوع الطلب:
         * GET أو POST
         */
        method: "GET",

        /*
         * إذا كان الربط يحتاج مفتاح API،
         * لا تضع المفتاح مباشرة في الواجهة الأمامية.
         * الأفضل تمريره من Backend آمن.
         */
        apiKey: "",

        /*
         * اسم الترويسة التي تحمل المفتاح.
         */
        apiKeyHeader: "X-API-Key",

        /*
         * عند استخدام Backend وسيط:
         * ضع الرابط هنا بدل رابط أنواء المباشر.
         */
        proxyEndpoint: "",

        /*
         * مدة انتهاء الطلب.
         */
        timeoutMs: 12000,

        /*
         * مدة التخزين المؤقت بالدقائق.
         */
        cacheMinutes: 10,

        /*
         * مستوى الثقة الافتراضي للمصدر الرسمي.
         */
        defaultReliability: 0.99,

        /*
         * عند عدم الاتصال الفعلي.
         */
        fallbackStatus: "PENDING_API",

        /*
         * المنطقة الزمنية.
         */
        timezone: "Asia/Riyadh",

        /*
         * السماح بالبيانات التجريبية.
         * يجب أن تبقى false في النسخة الرسمية.
         */
        allowSimulation: true
    },

    /* =====================================================
       INITIALIZATION
       ===================================================== */

    init() {
        if (this.initialized) {
            return;
        }

        this.initialized = true;

        console.log(
            `RG30 Anwaa Adapter ${this.version} initialized.`
        );

        window.dispatchEvent(
            new CustomEvent(
                "rg30:anwaa-adapter-ready",
                {
                    detail: {
                        version: this.version,
                        configured:
                            this.isConfigured(),
                        timestamp:
                            new Date().toISOString()
                    }
                }
            )
        );
    },

    /* =====================================================
       CONFIGURATION
       ===================================================== */

    configure(options = {}) {
        if (
            !options ||
            typeof options !== "object"
        ) {
            return false;
        }

        this.config = {
            ...this.config,
            ...options
        };

        return true;
    },

    isConfigured() {
        return Boolean(
            this.config.enabled &&
            (
                this.config.proxyEndpoint ||
                this.config.endpoint
            )
        );
    },

    getActiveEndpoint() {
        return (
            this.config.proxyEndpoint ||
            this.config.endpoint ||
            ""
        );
    },

    /* =====================================================
       MAIN COLLECTION
       ===================================================== */

    async collect(city = {}) {
        const normalizedCity =
            this.normalizeCity(city);

        if (!this.config.enabled) {
            return this.createUnavailableResult(
                normalizedCity,
                "DISABLED",
                "Anwaa adapter is disabled."
            );
        }

        const cached =
            this.getCachedResult(
                normalizedCity
            );

        if (cached) {
            return {
                ...cached,
                fromCache: true
            };
        }

        if (!this.isConfigured()) {
            if (
                this.config.allowSimulation
            ) {
                return this.createSimulationResult(
                    normalizedCity
                );
            }

            return this.createPendingResult(
                normalizedCity
            );
        }

        this.lastRequestAt =
            new Date().toISOString();

        const startedAt =
            Date.now();

        try {
            const response =
                await this.fetchOfficialData(
                    normalizedCity
                );

            const normalized =
                this.normalizeOfficialResponse(
                    response,
                    normalizedCity
                );

            const result = {
                sourceKey:
                    "official",

                sourceName:
                    "أنواء - المركز الوطني للأرصاد",

                provider:
                    "National Center for Meteorology",

                available:
                    true,

                ok:
                    true,

                official:
                    true,

                status:
                    normalized.status,

                city:
                    normalizedCity.name,

                lat:
                    normalizedCity.lat,

                lon:
                    normalizedCity.lon,

                region:
                    normalizedCity.region,

                timestamp:
                    normalized.timestamp,

                ageMinutes:
                    this.calculateAgeMinutes(
                        normalized.timestamp
                    ),

                reliability:
                    this.config
                        .defaultReliability,

                trust:
                    this.config
                        .defaultReliability,

                rainProbability:
                    normalized.rainProbability,

                rainAmount:
                    normalized.rainAmount,

                signalScore:
                    normalized.signalScore,

                confidence:
                    normalized.confidence,

                warningLevel:
                    normalized.warningLevel,

                weatherCondition:
                    normalized.weatherCondition,

                temperature:
                    normalized.temperature,

                humidity:
                    normalized.humidity,

                windSpeed:
                    normalized.windSpeed,

                windDirection:
                    normalized.windDirection,

                forecastWindows:
                    normalized.forecastWindows,

                warnings:
                    normalized.warnings,

                details: {
                    officialStatus:
                        normalized.status,

                    station:
                        normalized.station,

                    bulletinId:
                        normalized.bulletinId,

                    issuedAt:
                        normalized.issuedAt,

                    validFrom:
                        normalized.validFrom,

                    validTo:
                        normalized.validTo,

                    dataFreshness:
                        this.getFreshnessStatus(
                            normalized.timestamp
                        ),

                    responseTimeMs:
                        Date.now() -
                        startedAt
                },

                raw:
                    response,

                error:
                    null
            };

            this.lastSuccessAt =
                new Date().toISOString();

            this.lastError =
                null;

            this.setCachedResult(
                normalizedCity,
                result
            );

            this.publishSuccess(
                result
            );

            return result;

        } catch (error) {
            this.lastFailureAt =
                new Date().toISOString();

            this.lastError =
                error?.message ||
                String(error);

            console.warn(
                "RG30 Anwaa Adapter request failed:",
                error
            );

            const failure =
                this.createUnavailableResult(
                    normalizedCity,
                    "UNAVAILABLE",
                    this.lastError
                );

            this.publishFailure(
                failure
            );

            return failure;
        }
    },

    /* =====================================================
       OFFICIAL REQUEST
       ===================================================== */

    async fetchOfficialData(city) {
        const endpoint =
            this.getActiveEndpoint();

        if (!endpoint) {
            throw new Error(
                "ANWAA_ENDPOINT_NOT_CONFIGURED"
            );
        }

        const method =
            String(
                this.config.method ||
                "GET"
            ).toUpperCase();

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
            ] = this.config.apiKey;
        }

        let url =
            endpoint;

        const requestOptions = {
            method,
            headers
        };

        if (method === "GET") {
            const separator =
                endpoint.includes("?")
                    ? "&"
                    : "?";

            url =
                endpoint +
                separator +
                new URLSearchParams({
                    lat:
                        String(city.lat),

                    lon:
                        String(city.lon),

                    city:
                        city.name,

                    timezone:
                        this.config.timezone
                }).toString();

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

                    timezone:
                        this.config.timezone
                });
        }

        const response =
            await this.fetchWithTimeout(
                url,
                requestOptions,
                this.config.timeoutMs
            );

        if (!response.ok) {
            throw new Error(
                `ANWAA_HTTP_${response.status}`
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
                "ANWAA_INVALID_CONTENT_TYPE"
            );
        }

        return await response.json();
    },

    /* =====================================================
       RESPONSE NORMALIZATION
       ===================================================== */

    normalizeOfficialResponse(
        payload = {},
        city = {}
    ) {
        const root =
            payload?.data ||
            payload?.result ||
            payload?.forecast ||
            payload ||
            {};

        const current =
            root?.current ||
            root?.now ||
            root?.observation ||
            {};

        const forecast =
            root?.forecast ||
            root?.hourly ||
            root?.daily ||
            {};

        const alerts =
            root?.alerts ||
            root?.warnings ||
            root?.bulletins ||
            [];

        const rainProbability =
            this.firstNumber(
                current.rainProbability,
                current.precipitationProbability,
                current.precipitation_probability,
                root.rainProbability,
                root.precipitationProbability,
                root.precipitation_probability,
                forecast.rainProbability,
                forecast.precipitationProbability
            );

        const rainAmount =
            this.firstNumber(
                current.rainAmount,
                current.precipitation,
                current.rain,
                root.rainAmount,
                root.precipitation,
                root.rain,
                forecast.rainAmount,
                forecast.precipitation
            );

        const humidity =
            this.firstNumber(
                current.humidity,
                current.relativeHumidity,
                current.relative_humidity,
                root.humidity
            );

        const temperature =
            this.firstNumber(
                current.temperature,
                current.temperature_2m,
                root.temperature
            );

        const windSpeed =
            this.firstNumber(
                current.windSpeed,
                current.wind_speed,
                current.wind_speed_10m,
                root.windSpeed
            );

        const windDirection =
            current.windDirection ||
            current.wind_direction ||
            current.wind_direction_10m ||
            root.windDirection ||
            "--";

        const warningLevel =
            this.extractWarningLevel(
                alerts,
                root
            );

        const confidence =
            this.clamp(
                this.firstNumber(
                    root.confidence,
                    current.confidence,
                    95
                ),
                0,
                100
            );

        const signalScore =
            this.calculateSignalScore({
                rainProbability,
                rainAmount,
                warningLevel,
                humidity
            });

        const timestamp =
            root.updatedAt ||
            root.timestamp ||
            root.issueTime ||
            root.issuedAt ||
            current.timestamp ||
            new Date().toISOString();

        return {
            status:
                root.status ||
                "AVAILABLE",

            rainProbability:
                this.clamp(
                    rainProbability,
                    0,
                    100
                ),

            rainAmount:
                this.clamp(
                    rainAmount,
                    0,
                    1000
                ),

            signalScore,

            confidence,

            warningLevel,

            weatherCondition:
                current.condition ||
                current.weatherCondition ||
                root.condition ||
                root.weatherCondition ||
                "UNKNOWN",

            temperature:
                this.safeNumber(
                    temperature,
                    0
                ),

            humidity:
                this.clamp(
                    humidity,
                    0,
                    100
                ),

            windSpeed:
                this.safeNumber(
                    windSpeed,
                    0
                ),

            windDirection,

            timestamp,

            station:
                root.station ||
                root.stationName ||
                current.station ||
                "--",

            bulletinId:
                root.bulletinId ||
                root.warningId ||
                "--",

            issuedAt:
                root.issuedAt ||
                root.issueTime ||
                timestamp,

            validFrom:
                root.validFrom ||
                root.startTime ||
                null,

            validTo:
                root.validTo ||
                root.endTime ||
                null,

            forecastWindows:
                this.extractForecastWindows(
                    root,
                    forecast
                ),

            warnings:
                Array.isArray(alerts)
                    ? alerts
                    : []
        };
    },

    /* =====================================================
       FORECAST WINDOWS
       ===================================================== */

    extractForecastWindows(
        root = {},
        forecast = {}
    ) {
        return {
            h6: {
                probability:
                    this.clamp(
                        this.firstNumber(
                            root.rainProbability6h,
                            root.probability6h,
                            forecast.rainProbability6h,
                            forecast.probability6h
                        ),
                        0,
                        100
                    ),

                rainAmount:
                    this.clamp(
                        this.firstNumber(
                            root.rainAmount6h,
                            forecast.rainAmount6h,
                            forecast.precipitation6h
                        ),
                        0,
                        1000
                    )
            },

            h24: {
                probability:
                    this.clamp(
                        this.firstNumber(
                            root.rainProbability24h,
                            root.probability24h,
                            forecast.rainProbability24h,
                            forecast.probability24h
                        ),
                        0,
                        100
                    ),

                rainAmount:
                    this.clamp(
                        this.firstNumber(
                            root.rainAmount24h,
                            forecast.rainAmount24h,
                            forecast.precipitation24h
                        ),
                        0,
                        1000
                    )
            },

            h72: {
                probability:
                    this.clamp(
                        this.firstNumber(
                            root.rainProbability72h,
                            root.probability72h,
                            forecast.rainProbability72h,
                            forecast.probability72h
                        ),
                        0,
                        100
                    ),

                rainAmount:
                    this.clamp(
                        this.firstNumber(
                            root.rainAmount72h,
                            forecast.rainAmount72h,
                            forecast.precipitation72h
                        ),
                        0,
                        1000
                    )
            }
        };
    },

    /* =====================================================
       WARNING NORMALIZATION
       ===================================================== */

    extractWarningLevel(
        alerts,
        root
    ) {
        const explicitLevel =
            root.warningLevel ||
            root.alertLevel ||
            root.level;

        if (explicitLevel) {
            return this.normalizeWarningLevel(
                explicitLevel
            );
        }

        if (
            !Array.isArray(alerts) ||
            !alerts.length
        ) {
            return "NORMAL";
        }

        const levels =
            alerts.map(alert =>
                this.normalizeWarningLevel(
                    alert?.level ||
                    alert?.severity ||
                    alert?.warningLevel
                )
            );

        const priority = {
            EMERGENCY: 5,
            RED: 5,
            WARNING: 4,
            ORANGE: 4,
            WATCH: 3,
            YELLOW: 3,
            NORMAL: 1,
            GREEN: 1,
            UNKNOWN: 0
        };

        return levels.sort(
            (a, b) =>
                (priority[b] || 0) -
                (priority[a] || 0)
        )[0] || "UNKNOWN";
    },

    normalizeWarningLevel(value) {
        const level =
            String(value || "")
                .trim()
                .toUpperCase();

        const map = {
            SAFE:
                "NORMAL",

            NONE:
                "NORMAL",

            NORMAL:
                "NORMAL",

            GREEN:
                "GREEN",

            WATCH:
                "WATCH",

            ADVISORY:
                "WATCH",

            YELLOW:
                "YELLOW",

            WARNING:
                "WARNING",

            ORANGE:
                "ORANGE",

            EMERGENCY:
                "EMERGENCY",

            RED:
                "RED"
        };

        return map[level] ||
            "UNKNOWN";
    },

    /* =====================================================
       SIGNAL SCORE
       ===================================================== */

    calculateSignalScore({
        rainProbability,
        rainAmount,
        warningLevel,
        humidity
    }) {
        const probabilityScore =
            this.clamp(
                rainProbability,
                0,
                100
            );

        const amountScore =
            this.rainAmountToScore(
                rainAmount
            );

        const warningScore =
            this.warningLevelToScore(
                warningLevel
            );

        const humidityScore =
            this.clamp(
                (
                    this.safeNumber(
                        humidity,
                        0
                    ) - 35
                ) * 1.25,
                0,
                100
            );

        return Math.round(
            probabilityScore * 0.50 +
            amountScore * 0.20 +
            warningScore * 0.20 +
            humidityScore * 0.10
        );
    },

    /* =====================================================
       PENDING / UNAVAILABLE RESULTS
       ===================================================== */

    createPendingResult(city) {
        return {
            sourceKey:
                "official",

            sourceName:
                "أنواء - المركز الوطني للأرصاد",

            provider:
                "National Center for Meteorology",

            available:
                false,

            ok:
                false,

            official:
                true,

            status:
                this.config.fallbackStatus,

            city:
                city.name,

            lat:
                city.lat,

            lon:
                city.lon,

            region:
                city.region,

            timestamp:
                new Date().toISOString(),

            ageMinutes:
                0,

            reliability:
                0,

            trust:
                0,

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

            weatherCondition:
                "UNAVAILABLE",

            temperature:
                0,

            humidity:
                0,

            windSpeed:
                0,

            windDirection:
                "--",

            forecastWindows: {
                h6: {
                    probability: 0,
                    rainAmount: 0
                },

                h24: {
                    probability: 0,
                    rainAmount: 0
                },

                h72: {
                    probability: 0,
                    rainAmount: 0
                }
            },

            warnings:
                [],

            details: {
                officialStatus:
                    this.config
                        .fallbackStatus,

                configured:
                    false,

                note:
                    "Official Anwaa API is not configured."
            },

            raw:
                null,

            error:
                "ANWAA_API_NOT_CONFIGURED"
        };
    },

    createUnavailableResult(
        city,
        status,
        error
    ) {
        return {
            ...this.createPendingResult(
                city
            ),

            status:
                status ||
                "UNAVAILABLE",

            details: {
                officialStatus:
                    status ||
                    "UNAVAILABLE",

                configured:
                    this.isConfigured(),

                lastFailureAt:
                    this.lastFailureAt
            },

            error:
                error ||
                "ANWAA_UNAVAILABLE"
        };
    },

    /* =====================================================
       OPTIONAL SIMULATION
       ===================================================== */

    createSimulationResult(city) {
        const localWeather =
            city.weatherScore ||
            city.finalRisk ||
            city.baseRisk ||
            0;

        const probability =
            this.clamp(
                localWeather,
                0,
                100
            );

        return {
            sourceKey:
                "official",

            sourceName:
                "أنواء - Simulation Only",

            provider:
                "RainGuard Test Layer",

            available:
                true,

            ok:
                true,

            official:
                false,

            simulated:
                true,

            status:
                "SIMULATION",

            city:
                city.name,

            lat:
                city.lat,

            lon:
                city.lon,

            region:
                city.region,

            timestamp:
                new Date().toISOString(),

            ageMinutes:
                0,

            reliability:
                0.25,

            trust:
                0.25,

            rainProbability:
                probability,

            rainAmount:
                0,

            signalScore:
                probability,

            confidence:
                25,

            warningLevel:
                probability >= 70
                    ? "WARNING"
                    : probability >= 40
                        ? "WATCH"
                        : "NORMAL",

            weatherCondition:
                "SIMULATED",

            temperature:
                0,

            humidity:
                0,

            windSpeed:
                0,

            windDirection:
                "--",

            forecastWindows: {
                h6: {
                    probability,
                    rainAmount: 0
                },

                h24: {
                    probability,
                    rainAmount: 0
                },

                h72: {
                    probability,
                    rainAmount: 0
                }
            },

            warnings:
                [],

            details: {
                officialStatus:
                    "SIMULATION",

                configured:
                    false,

                warning:
                    "This is not official meteorological data."
            },

            raw:
                null,

            error:
                null
        };
    },

    /* =====================================================
       CACHE
       ===================================================== */

    getCacheKey(city) {
        return [
            String(city.name)
                .toLowerCase(),

            Number(city.lat)
                .toFixed(4),

            Number(city.lon)
                .toFixed(4)
        ].join(":");
    },

    getCachedResult(city) {
        const key =
            this.getCacheKey(city);

        const item =
            this.cache.get(key);

        if (!item) {
            return null;
        }

        const ageMs =
            Date.now() -
            item.savedAt;

        const maxAgeMs =
            this.config.cacheMinutes *
            60 *
            1000;

        if (ageMs > maxAgeMs) {
            this.cache.delete(key);
            return null;
        }

        return item.result;
    },

    setCachedResult(city, result) {
        const key =
            this.getCacheKey(city);

        this.cache.set(
            key,
            {
                savedAt:
                    Date.now(),

                result
            }
        );
    },

    clearCache() {
        this.cache.clear();
    },

    /* =====================================================
       EVENTS
       ===================================================== */

    publishSuccess(result) {
        window.dispatchEvent(
            new CustomEvent(
                "rg30:anwaa-data-received",
                {
                    detail:
                        result
                }
            )
        );
    },

    publishFailure(result) {
        window.dispatchEvent(
            new CustomEvent(
                "rg30:anwaa-data-failed",
                {
                    detail:
                        result
                }
            )
        );
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

            configured:
                this.isConfigured(),

            enabled:
                this.config.enabled,

            endpointConfigured:
                Boolean(
                    this.getActiveEndpoint()
                ),

            lastRequestAt:
                this.lastRequestAt,

            lastSuccessAt:
                this.lastSuccessAt,

            lastFailureAt:
                this.lastFailureAt,

            lastError:
                this.lastError,

            cacheSize:
                this.cache.size
        };
    },

    /* =====================================================
       HELPERS
       ===================================================== */

    normalizeCity(city = {}) {
        return {
            ...city,

            name:
                city.name ||
                city.city ||
                city.cityName ||
                "Unknown",

            region:
                city.region ||
                city.area ||
                city.name ||
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
            Number(value);

        return Number.isFinite(number)
            ? number
            : fallback;
    },

    firstNumber(...values) {
        for (const value of values) {
            const number =
                Number(value);

            if (
                Number.isFinite(number)
            ) {
                return number;
            }
        }

        return 0;
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
            Math.max(min, number)
        );
    },

    calculateAgeMinutes(timestamp) {
        const time =
            new Date(timestamp)
                .getTime();

        if (
            !Number.isFinite(time)
        ) {
            return 0;
        }

        return Math.max(
            0,
            Math.round(
                (
                    Date.now() - time
                ) /
                60000
            )
        );
    },

    getFreshnessStatus(timestamp) {
        const ageMinutes =
            this.calculateAgeMinutes(
                timestamp
            );

        if (ageMinutes <= 10) {
            return "FRESH";
        }

        if (ageMinutes <= 30) {
            return "ACCEPTABLE";
        }

        if (ageMinutes <= 60) {
            return "STALE";
        }

        return "EXPIRED";
    },

    rainAmountToScore(amount) {
        const value =
            this.safeNumber(
                amount,
                0
            );

        if (value <= 0) {
            return 0;
        }

        if (value < 0.5) {
            return 10;
        }

        if (value < 2) {
            return 25;
        }

        if (value < 5) {
            return 45;
        }

        if (value < 10) {
            return 65;
        }

        if (value < 25) {
            return 82;
        }

        return 100;
    },

    warningLevelToScore(level) {
        const value =
            this.normalizeWarningLevel(
                level
            );

        const scores = {
            UNKNOWN: 0,
            NORMAL: 5,
            GREEN: 5,
            WATCH: 35,
            YELLOW: 40,
            WARNING: 65,
            ORANGE: 70,
            EMERGENCY: 95,
            RED: 100
        };

        return scores[value] ?? 0;
    },

    fetchWithTimeout(
        url,
        options,
        timeoutMs
    ) {
        const controller =
            new AbortController();

        const timeout =
            setTimeout(
                () => {
                    controller.abort();
                },
                timeoutMs
            );

        return fetch(
            url,
            {
                ...options,
                signal:
                    controller.signal
            }
        ).finally(() => {
            clearTimeout(timeout);
        });
    }
};

/* =========================================================
   INITIALIZATION
   ========================================================= */

if (
    document.readyState === "loading"
) {
    document.addEventListener(
        "DOMContentLoaded",
        () => {
            RG30.AnwaaAdapter.init();
        },
        {
            once: true
        }
    );
} else {
    RG30.AnwaaAdapter.init();
}
