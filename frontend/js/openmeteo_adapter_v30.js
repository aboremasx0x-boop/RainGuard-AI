/* =========================================================
   RainGuard AI V30
   Open-Meteo Forecast Adapter
   File: frontend/js/openmeteo_adapter_v30.js
   ========================================================= */

window.RG30 = window.RG30 || {};

RG30.OpenMeteoAdapter = {

    version: "30.0.0",

    initialized: false,

    lastRequestAt: null,
    lastSuccessAt: null,
    lastFailureAt: null,
    lastError: null,

    cache: new Map(),

    config: {
        enabled: true,

        endpoint:
            "https://api.open-meteo.com/v1/forecast",

        timezone:
            "Asia/Riyadh",

        timeoutMs:
            15000,

        cacheMinutes:
            10,

        forecastDays:
            4,

        defaultReliability:
            0.80,

        hourlyVariables: [
            "temperature_2m",
            "relative_humidity_2m",
            "precipitation_probability",
            "precipitation",
            "rain",
            "cloud_cover",
            "wind_speed_10m",
            "wind_direction_10m",
            "weather_code"
        ],

        currentVariables: [
            "temperature_2m",
            "relative_humidity_2m",
            "precipitation",
            "rain",
            "cloud_cover",
            "wind_speed_10m",
            "wind_direction_10m",
            "weather_code"
        ]
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
            `RG30 Open-Meteo Adapter ${this.version} initialized.`
        );

        window.dispatchEvent(
            new CustomEvent(
                "rg30:openmeteo-adapter-ready",
                {
                    detail: {
                        version:
                            this.version,

                        endpoint:
                            this.config.endpoint,

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
            this.config.endpoint
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
                "Open-Meteo adapter is disabled."
            );
        }

        if (!this.isConfigured()) {
            return this.createUnavailableResult(
                normalizedCity,
                "UNAVAILABLE",
                "OPENMETEO_ENDPOINT_NOT_CONFIGURED"
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

        this.lastRequestAt =
            new Date().toISOString();

        const startedAt =
            Date.now();

        try {
            const payload =
                await this.fetchForecast(
                    normalizedCity
                );

            const normalized =
                this.normalizeForecastResponse(
                    payload,
                    normalizedCity
                );

            const result = {
                sourceKey:
                    "openMeteo",

                sourceName:
                    "Open-Meteo",

                provider:
                    "Open-Meteo Forecast API",

                available:
                    true,

                ok:
                    true,

                official:
                    false,

                status:
                    "AVAILABLE",

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

                cloudCover:
                    normalized.cloudCover,

                windSpeed:
                    normalized.windSpeed,

                windDirection:
                    normalized.windDirection,

                forecastWindows:
                    normalized.forecastWindows,

                details: {
                    currentWeatherCode:
                        normalized.weatherCode,

                    currentWeatherText:
                        this.weatherCodeToText(
                            normalized.weatherCode
                        ),

                    modelLatitude:
                        payload.latitude,

                    modelLongitude:
                        payload.longitude,

                    elevation:
                        payload.elevation,

                    timezone:
                        payload.timezone,

                    utcOffsetSeconds:
                        payload.utc_offset_seconds,

                    responseTimeMs:
                        Date.now() -
                        startedAt,

                    humidity:
                        normalized.humidity,

                    cloudCover:
                        normalized.cloudCover,

                    windSpeed:
                        normalized.windSpeed,

                    windDirection:
                        normalized.windDirection,

                    currentTemperature:
                        normalized.temperature,

                    hourlySampleCount:
                        normalized.hourlySampleCount
                },

                raw:
                    payload,

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
                "RG30 Open-Meteo Adapter request failed:",
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
       API REQUEST
       ===================================================== */

    async fetchForecast(city) {
        const params =
            new URLSearchParams({
                latitude:
                    String(city.lat),

                longitude:
                    String(city.lon),

                timezone:
                    this.config.timezone,

                forecast_days:
                    String(
                        this.config.forecastDays
                    ),

                current:
                    this.config
                        .currentVariables
                        .join(","),

                hourly:
                    this.config
                        .hourlyVariables
                        .join(",")
            });

        const url =
            `${this.config.endpoint}?${params.toString()}`;

        const response =
            await this.fetchWithTimeout(
                url,
                {
                    method:
                        "GET",

                    headers: {
                        Accept:
                            "application/json"
                    }
                },
                this.config.timeoutMs
            );

        if (!response.ok) {
            throw new Error(
                `OPENMETEO_HTTP_${response.status}`
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
                "OPENMETEO_INVALID_CONTENT_TYPE"
            );
        }

        const payload =
            await response.json();

        if (
            payload?.error === true
        ) {
            throw new Error(
                payload.reason ||
                "OPENMETEO_API_ERROR"
            );
        }

        return payload;
    },

    /* =====================================================
       RESPONSE NORMALIZATION
       ===================================================== */

    normalizeForecastResponse(
        payload = {},
        city = {}
    ) {
        const current =
            payload.current || {};

        const hourly =
            payload.hourly || {};

        const times =
            Array.isArray(hourly.time)
                ? hourly.time
                : [];

        const startIndex =
            this.findCurrentHourIndex(
                times
            );

        const currentRainProbability =
            this.getHourlyValue(
                hourly.precipitation_probability,
                startIndex
            );

        const currentRainAmount =
            this.firstNumber(
                current.precipitation,
                current.rain,
                this.getHourlyValue(
                    hourly.precipitation,
                    startIndex
                ),
                this.getHourlyValue(
                    hourly.rain,
                    startIndex
                )
            );

        const temperature =
            this.firstNumber(
                current.temperature_2m,
                this.getHourlyValue(
                    hourly.temperature_2m,
                    startIndex
                )
            );

        const humidity =
            this.firstNumber(
                current.relative_humidity_2m,
                this.getHourlyValue(
                    hourly.relative_humidity_2m,
                    startIndex
                )
            );

        const cloudCover =
            this.firstNumber(
                current.cloud_cover,
                this.getHourlyValue(
                    hourly.cloud_cover,
                    startIndex
                )
            );

        const windSpeed =
            this.firstNumber(
                current.wind_speed_10m,
                this.getHourlyValue(
                    hourly.wind_speed_10m,
                    startIndex
                )
            );

        const windDirection =
            this.firstNumber(
                current.wind_direction_10m,
                this.getHourlyValue(
                    hourly.wind_direction_10m,
                    startIndex
                )
            );

        const weatherCode =
            this.firstNumber(
                current.weather_code,
                this.getHourlyValue(
                    hourly.weather_code,
                    startIndex
                )
            );

        const forecastWindows = {
            h6: this.calculateWindow(
                hourly,
                startIndex,
                6
            ),

            h24: this.calculateWindow(
                hourly,
                startIndex,
                24
            ),

            h72: this.calculateWindow(
                hourly,
                startIndex,
                72
            )
        };

        const rainProbability =
            this.clamp(
                Math.max(
                    currentRainProbability,
                    forecastWindows.h6
                        .maxProbability
                ),
                0,
                100
            );

        const rainAmount =
            this.clamp(
                Math.max(
                    currentRainAmount,
                    forecastWindows.h6
                        .rainAmount
                ),
                0,
                1000
            );

        const signalScore =
            this.calculateSignalScore({
                rainProbability,
                rainAmount,
                humidity,
                cloudCover,
                weatherCode
            });

        const confidence =
            this.calculateConfidence({
                rainProbability,
                rainAmount,
                humidity,
                cloudCover,
                sampleCount:
                    times.length
            });

        const warningLevel =
            this.getWarningLevel({
                rainProbability,
                rainAmount,
                signalScore
            });

        return {
            timestamp:
                current.time ||
                times[startIndex] ||
                new Date().toISOString(),

            rainProbability:
                Math.round(
                    rainProbability
                ),

            rainAmount:
                Number(
                    rainAmount.toFixed(2)
                ),

            signalScore:
                Math.round(
                    signalScore
                ),

            confidence:
                Math.round(
                    confidence
                ),

            warningLevel,

            weatherCondition:
                this.weatherCodeToText(
                    weatherCode
                ),

            weatherCode,

            temperature:
                Number(
                    this.safeNumber(
                        temperature,
                        0
                    ).toFixed(1)
                ),

            humidity:
                Math.round(
                    this.clamp(
                        humidity,
                        0,
                        100
                    )
                ),

            cloudCover:
                Math.round(
                    this.clamp(
                        cloudCover,
                        0,
                        100
                    )
                ),

            windSpeed:
                Number(
                    this.safeNumber(
                        windSpeed,
                        0
                    ).toFixed(1)
                ),

            windDirection:
                Math.round(
                    this.clamp(
                        windDirection,
                        0,
                        360
                    )
                ),

            forecastWindows,

            hourlySampleCount:
                times.length
        };
    },

    /* =====================================================
       FORECAST WINDOWS
       ===================================================== */

    calculateWindow(
        hourly = {},
        startIndex = 0,
        hours = 6
    ) {
        const probabilities =
            this.sliceNumericArray(
                hourly
                    .precipitation_probability,
                startIndex,
                hours
            );

        const precipitation =
            this.sliceNumericArray(
                hourly.precipitation,
                startIndex,
                hours
            );

        const rain =
            this.sliceNumericArray(
                hourly.rain,
                startIndex,
                hours
            );

        const cloudCover =
            this.sliceNumericArray(
                hourly.cloud_cover,
                startIndex,
                hours
            );

        const humidity =
            this.sliceNumericArray(
                hourly
                    .relative_humidity_2m,
                startIndex,
                hours
            );

        const windSpeed =
            this.sliceNumericArray(
                hourly.wind_speed_10m,
                startIndex,
                hours
            );

        const temperatures =
            this.sliceNumericArray(
                hourly.temperature_2m,
                startIndex,
                hours
            );

        const rainAmounts =
            precipitation.length
                ? precipitation
                : rain;

        return {
            hours,

            maxProbability:
                Math.round(
                    this.max(
                        probabilities
                    )
                ),

            averageProbability:
                Math.round(
                    this.average(
                        probabilities
                    )
                ),

            rainAmount:
                Number(
                    this.sum(
                        rainAmounts
                    ).toFixed(2)
                ),

            maxHourlyRain:
                Number(
                    this.max(
                        rainAmounts
                    ).toFixed(2)
                ),

            averageCloudCover:
                Math.round(
                    this.average(
                        cloudCover
                    )
                ),

            averageHumidity:
                Math.round(
                    this.average(
                        humidity
                    )
                ),

            maxWindSpeed:
                Number(
                    this.max(
                        windSpeed
                    ).toFixed(1)
                ),

            minTemperature:
                Number(
                    this.min(
                        temperatures
                    ).toFixed(1)
                ),

            maxTemperature:
                Number(
                    this.max(
                        temperatures
                    ).toFixed(1)
                ),

            sampleCount:
                Math.max(
                    probabilities.length,
                    rainAmounts.length
                )
        };
    },

    findCurrentHourIndex(times = []) {
        if (!Array.isArray(times)) {
            return 0;
        }

        const now =
            Date.now();

        let nearestIndex = 0;
        let nearestDifference =
            Number.POSITIVE_INFINITY;

        times.forEach(
            (time, index) => {
                const timestamp =
                    new Date(time).getTime();

                if (
                    !Number.isFinite(
                        timestamp
                    )
                ) {
                    return;
                }

                const difference =
                    Math.abs(
                        timestamp - now
                    );

                if (
                    difference <
                    nearestDifference
                ) {
                    nearestDifference =
                        difference;

                    nearestIndex =
                        index;
                }
            }
        );

        return nearestIndex;
    },

    getHourlyValue(
        values,
        index
    ) {
        if (
            !Array.isArray(values)
        ) {
            return 0;
        }

        return this.safeNumber(
            values[index],
            0
        );
    },

    sliceNumericArray(
        values,
        startIndex,
        length
    ) {
        if (
            !Array.isArray(values)
        ) {
            return [];
        }

        return values
            .slice(
                startIndex,
                startIndex + length
            )
            .map(value =>
                this.safeNumber(
                    value,
                    0
                )
            );
    },

    /* =====================================================
       SCORES
       ===================================================== */

    calculateSignalScore({
        rainProbability,
        rainAmount,
        humidity,
        cloudCover,
        weatherCode
    }) {
        const amountScore =
            this.rainAmountToScore(
                rainAmount
            );

        const humidityScore =
            this.clamp(
                (
                    this.safeNumber(
                        humidity,
                        0
                    ) - 35
                ) * 1.3,
                0,
                100
            );

        const cloudScore =
            this.clamp(
                cloudCover,
                0,
                100
            );

        const weatherCodeScore =
            this.weatherCodeToScore(
                weatherCode
            );

        return this.clamp(
            rainProbability * 0.45 +
            amountScore * 0.25 +
            humidityScore * 0.10 +
            cloudScore * 0.10 +
            weatherCodeScore * 0.10,
            0,
            100
        );
    },

    calculateConfidence({
        rainProbability,
        rainAmount,
        humidity,
        cloudCover,
        sampleCount
    }) {
        const coverageScore =
            this.clamp(
                sampleCount / 72 * 100,
                0,
                100
            );

        const completenessScore =
            [
                rainProbability,
                rainAmount,
                humidity,
                cloudCover
            ].filter(value =>
                Number.isFinite(
                    Number(value)
                )
            ).length / 4 * 100;

        return this.clamp(
            this.config
                .defaultReliability *
                100 *
                0.45 +
            coverageScore *
                0.30 +
            completenessScore *
                0.25,
            0,
            100
        );
    },

    getWarningLevel({
        rainProbability,
        rainAmount,
        signalScore
    }) {
        if (
            signalScore >= 80 ||
            rainAmount >= 25
        ) {
            return "EMERGENCY";
        }

        if (
            signalScore >= 60 ||
            rainAmount >= 10
        ) {
            return "WARNING";
        }

        if (
            signalScore >= 35 ||
            rainProbability >= 40
        ) {
            return "WATCH";
        }

        return "NORMAL";
    },

    /* =====================================================
       WEATHER CODE
       ===================================================== */

    weatherCodeToText(code) {
        const value =
            Number(code);

        const map = {
            0: "CLEAR_SKY",
            1: "MAINLY_CLEAR",
            2: "PARTLY_CLOUDY",
            3: "OVERCAST",

            45: "FOG",
            48: "RIME_FOG",

            51: "LIGHT_DRIZZLE",
            53: "MODERATE_DRIZZLE",
            55: "DENSE_DRIZZLE",

            56: "LIGHT_FREEZING_DRIZZLE",
            57: "DENSE_FREEZING_DRIZZLE",

            61: "SLIGHT_RAIN",
            63: "MODERATE_RAIN",
            65: "HEAVY_RAIN",

            66: "LIGHT_FREEZING_RAIN",
            67: "HEAVY_FREEZING_RAIN",

            71: "SLIGHT_SNOW",
            73: "MODERATE_SNOW",
            75: "HEAVY_SNOW",

            77: "SNOW_GRAINS",

            80: "SLIGHT_RAIN_SHOWERS",
            81: "MODERATE_RAIN_SHOWERS",
            82: "VIOLENT_RAIN_SHOWERS",

            85: "SLIGHT_SNOW_SHOWERS",
            86: "HEAVY_SNOW_SHOWERS",

            95: "THUNDERSTORM",
            96: "THUNDERSTORM_WITH_HAIL",
            99: "SEVERE_THUNDERSTORM_WITH_HAIL"
        };

        return map[value] ||
            "UNKNOWN";
    },

    weatherCodeToScore(code) {
        const value =
            Number(code);

        if (
            [95, 96, 99]
                .includes(value)
        ) {
            return 100;
        }

        if (
            [65, 67, 82, 86]
                .includes(value)
        ) {
            return 85;
        }

        if (
            [63, 66, 75, 81]
                .includes(value)
        ) {
            return 65;
        }

        if (
            [61, 71, 80, 85]
                .includes(value)
        ) {
            return 45;
        }

        if (
            [51, 53, 55, 56, 57]
                .includes(value)
        ) {
            return 25;
        }

        if (
            [45, 48]
                .includes(value)
        ) {
            return 15;
        }

        return 0;
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

    /* =====================================================
       UNAVAILABLE RESULT
       ===================================================== */

    createUnavailableResult(
        city,
        status,
        error
    ) {
        return {
            sourceKey:
                "openMeteo",

            sourceName:
                "Open-Meteo",

            provider:
                "Open-Meteo Forecast API",

            available:
                false,

            ok:
                false,

            official:
                false,

            status:
                status ||
                "UNAVAILABLE",

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

            cloudCover:
                0,

            windSpeed:
                0,

            windDirection:
                0,

            forecastWindows: {
                h6: {},
                h24: {},
                h72: {}
            },

            details: {},

            raw:
                null,

            error:
                error ||
                "OPENMETEO_UNAVAILABLE"
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

        const maxAgeMs =
            this.config.cacheMinutes *
            60 *
            1000;

        if (
            Date.now() -
            item.savedAt >
            maxAgeMs
        ) {
            this.cache.delete(key);
            return null;
        }

        return item.result;
    },

    setCachedResult(
        city,
        result
    ) {
        this.cache.set(
            this.getCacheKey(city),
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
                "rg30:openmeteo-data-received",
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
                "rg30:openmeteo-data-failed",
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

            endpoint:
                this.config.endpoint,

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

    average(values = []) {
        const valid =
            values.filter(value =>
                Number.isFinite(
                    Number(value)
                )
            );

        if (!valid.length) {
            return 0;
        }

        return valid.reduce(
            (sum, value) =>
                sum +
                Number(value),
            0
        ) / valid.length;
    },

    sum(values = []) {
        return values.reduce(
            (sum, value) =>
                sum +
                this.safeNumber(
                    value,
                    0
                ),
            0
        );
    },

    max(values = []) {
        if (!values.length) {
            return 0;
        }

        return Math.max(
            ...values.map(value =>
                this.safeNumber(
                    value,
                    0
                )
            )
        );
    },

    min(values = []) {
        if (!values.length) {
            return 0;
        }

        return Math.min(
            ...values.map(value =>
                this.safeNumber(
                    value,
                    0
                )
            )
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
            RG30.OpenMeteoAdapter.init();
        },
        {
            once: true
        }
    );
} else {
    RG30.OpenMeteoAdapter.init();
}
