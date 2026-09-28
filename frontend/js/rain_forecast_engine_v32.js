/*
===========================================================
 RainGuard AI V32
 FORECAST-1A — Rain Prediction Engine Core

 File:
 frontend/js/rain_forecast_engine_v32.js

 Purpose:
 - Convert Open-Meteo hourly forecast into operational
   rain forecasts for 6 / 12 / 24 / 48 / 72 hours.
 - Calculate rain probability, accumulated rainfall,
   peak intensity, peak time, rain start/end,
   severity and confidence.
===========================================================
*/

(function initRainForecastEngine(global) {
    "use strict";

    const ENGINE_NAME = "RainForecastEngineV32";
    const VERSION = "FORECAST-1A.1";

    const HORIZONS = Object.freeze([
        6,
        12,
        24,
        48,
        72
    ]);

    function number(value, fallback = 0) {
        const n = Number(value);
        return Number.isFinite(n) ? n : fallback;
    }

    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    function round(value, decimals = 1) {
        const factor = 10 ** decimals;

        return (
            Math.round(
                (number(value) + Number.EPSILON) * factor
            ) / factor
        );
    }

    function sum(values = []) {
        return values.reduce(
            (total, value) =>
                total + number(value),
            0
        );
    }

    function max(values = []) {
        if (!values.length) {
            return 0;
        }

        return Math.max(
            ...values.map(value => number(value))
        );
    }

    function isValidArray(value) {
        return Array.isArray(value) && value.length > 0;
    }

    function parseTime(value) {
        if (!value) {
            return null;
        }

        const date = new Date(value);

        return Number.isNaN(date.getTime())
            ? null
            : date;
    }

    function getCurrentForecastIndex(times = []) {
        if (!isValidArray(times)) {
            return 0;
        }

        const now = Date.now();

        for (
            let index = 0;
            index < times.length;
            index += 1
        ) {
            const date = parseTime(times[index]);

            if (
                date &&
                date.getTime() >= now - 30 * 60 * 1000
            ) {
                return index;
            }
        }

        return 0;
    }

    function getRainSeverity({
        totalRainMm = 0,
        peakRainMmH = 0,
        probability = 0
    } = {}) {
        const total = number(totalRainMm);
        const peak = number(peakRainMmH);
        const prob = number(probability);

        if (
            total >= 50 ||
            peak >= 20
        ) {
            return {
                code: "EXTREME",
                labelAr: "شديدة جدًا",
                labelEn: "Extreme",
                score: 100
            };
        }

        if (
            total >= 30 ||
            peak >= 15
        ) {
            return {
                code: "SEVERE",
                labelAr: "شديدة",
                labelEn: "Severe",
                score: 85
            };
        }

        if (
            total >= 15 ||
            peak >= 7.5
        ) {
            return {
                code: "HEAVY",
                labelAr: "غزيرة",
                labelEn: "Heavy",
                score: 70
            };
        }

        if (
            total >= 5 ||
            peak >= 2.5
        ) {
            return {
                code: "MODERATE",
                labelAr: "متوسطة",
                labelEn: "Moderate",
                score: 50
            };
        }

        if (
            total > 0 ||
            peak > 0 ||
            prob >= 30
        ) {
            return {
                code: "LIGHT",
                labelAr: "خفيفة",
                labelEn: "Light",
                score: 25
            };
        }

        return {
            code: "NONE",
            labelAr: "لا أمطار مؤثرة",
            labelEn: "No significant rain",
            score: 0
        };
    }

    function calculateConfidence({
        sampleCount = 0,
        expectedSamples = 0,
        probability = 0,
        totalRain = 0
    } = {}) {
        if (!expectedSamples) {
            return 0;
        }

        const coverage =
            clamp(
                sampleCount / expectedSamples,
                0,
                1
            );

        /*
         Confidence here measures forecast-data quality
         and internal signal agreement.
         It is NOT a meteorological verification score.
        */

        let confidence =
            coverage * 70;

        if (probability >= 70) {
            confidence += 15;
        } else if (probability >= 40) {
            confidence += 10;
        } else {
            confidence += 5;
        }

        if (totalRain > 0) {
            confidence += 10;
        }

        return Math.round(
            clamp(confidence, 0, 95)
        );
    }

    function analyzeWindow(
        hourly,
        startIndex,
        hours
    ) {
        const times =
            hourly.time || [];

        const probabilities =
            hourly.precipitation_probability || [];

        const precipitation =
            hourly.precipitation || [];

        const rain =
            hourly.rain || [];

        const endIndex =
            Math.min(
                startIndex + hours,
                times.length
            );

        const windowTimes =
            times.slice(
                startIndex,
                endIndex
            );

        const windowProbabilities =
            probabilities.slice(
                startIndex,
                endIndex
            );

        const windowPrecipitation =
            precipitation.slice(
                startIndex,
                endIndex
            );

        const windowRain =
            rain.slice(
                startIndex,
                endIndex
            );

        /*
         Use precipitation as primary accumulated-water
         forecast because it can include rain/showers.
         Fall back to rain if precipitation is unavailable.
        */

        const amountSeries =
            windowPrecipitation.length
                ? windowPrecipitation
                : windowRain;

        const totalRain =
            sum(amountSeries);

        const maximumProbability =
            max(windowProbabilities);

        const peakRain =
            max(amountSeries);

        let peakIndex = -1;

        if (amountSeries.length) {
            peakIndex =
                amountSeries.findIndex(
                    value =>
                        number(value) === peakRain
                );
        }

        const peakTime =
            peakIndex >= 0
                ? windowTimes[peakIndex] || null
                : null;

        const rainyIndexes = [];

        amountSeries.forEach(
            (value, index) => {
                if (number(value) > 0) {
                    rainyIndexes.push(index);
                }
            }
        );

        let rainStart = null;
        let rainEnd = null;

        if (rainyIndexes.length) {
            rainStart =
                windowTimes[
                    rainyIndexes[0]
                ] || null;

            rainEnd =
                windowTimes[
                    rainyIndexes[
                        rainyIndexes.length - 1
                    ]
                ] || null;
        }

        const severity =
            getRainSeverity({
                totalRainMm: totalRain,
                peakRainMmH: peakRain,
                probability:
                    maximumProbability
            });

        const confidence =
            calculateConfidence({
                sampleCount:
                    windowTimes.length,

                expectedSamples:
                    hours,

                probability:
                    maximumProbability,

                totalRain
            });

        return {
            horizonHours:
                hours,

            sampleCount:
                windowTimes.length,

            startTime:
                windowTimes[0] || null,

            endTime:
                windowTimes[
                    windowTimes.length - 1
                ] || null,

            rainProbability:
                round(
                    maximumProbability,
                    0
                ),

            totalRainMm:
                round(
                    totalRain,
                    2
                ),

            peakRainMmH:
                round(
                    peakRain,
                    2
                ),

            peakTime,

            rainStart,

            rainEnd,

            severity,

            confidence,

            status:
                windowTimes.length
                    ? "FORECAST_READY"
                    : "NO_DATA"
        };
    }

    const RainForecastEngine = {

        name:
            ENGINE_NAME,

        version:
            VERSION,

        horizons:
            HORIZONS,

        lastResult:
            null,

        analyzePayload(
            payload = {},
            city = {}
        ) {
            if (
                !payload ||
                typeof payload !== "object"
            ) {
                return this.createFailure(
                    city,
                    "INVALID_PAYLOAD"
                );
            }

            const hourly =
                payload.hourly || {};

            if (
                !isValidArray(hourly.time)
            ) {
                return this.createFailure(
                    city,
                    "HOURLY_FORECAST_MISSING"
                );
            }

            const startIndex =
                getCurrentForecastIndex(
                    hourly.time
                );

            const forecasts = {};

            HORIZONS.forEach(
                hours => {
                    forecasts[
                        `${hours}h`
                    ] =
                        analyzeWindow(
                            hourly,
                            startIndex,
                            hours
                        );
                }
            );

            const result = {
                engine:
                    ENGINE_NAME,

                version:
                    VERSION,

                status:
                    "FORECAST_READY",

                generatedAt:
                    new Date().toISOString(),

                city:
                    city.name ||
                    city.city ||
                    null,

                lat:
                    number(
                        city.lat ??
                        payload.latitude,
                        null
                    ),

                lon:
                    number(
                        city.lon ??
                        payload.longitude,
                        null
                    ),

                timezone:
                    payload.timezone ||
                    "Asia/Riyadh",

                source:
                    "Open-Meteo",

                startIndex,

                horizons:
                    forecasts,

                summary:
                    this.buildSummary(
                        forecasts
                    )
            };

            this.lastResult =
                result;

            this.publish(
                result
            );

            return result;
        },

        analyzeAdapterResult(
            adapterResult = {}
        ) {
            /*
             RG30.OpenMeteoAdapter keeps the original
             Open-Meteo response in adapterResult.raw.
            */

            if (
                !adapterResult ||
                !adapterResult.raw
            ) {
                return this.createFailure(
                    {
                        name:
                            adapterResult?.city,

                        lat:
                            adapterResult?.lat,

                        lon:
                            adapterResult?.lon
                    },
                    "ADAPTER_RAW_FORECAST_MISSING"
                );
            }

            return this.analyzePayload(
                adapterResult.raw,
                {
                    name:
                        adapterResult.city,

                    lat:
                        adapterResult.lat,

                    lon:
                        adapterResult.lon
                }
            );
        },

        async forecastCity(
            city = {}
        ) {
            if (
                !global.RG30 ||
                !global.RG30.OpenMeteoAdapter
            ) {
                return this.createFailure(
                    city,
                    "OPENMETEO_ADAPTER_NOT_AVAILABLE"
                );
            }

            const adapterResult =
                await global.RG30
                    .OpenMeteoAdapter
                    .collect(city);

            if (
                !adapterResult ||
                adapterResult.ok !== true
            ) {
                return this.createFailure(
                    city,
                    adapterResult?.error ||
                    "OPENMETEO_FORECAST_FAILED"
                );
            }

            return this.analyzeAdapterResult(
                adapterResult
            );
        },

        buildSummary(
            forecasts = {}
        ) {
            const h24 =
                forecasts["24h"] || {};

            const h72 =
                forecasts["72h"] || {};

            return {
                next24Hours: {
                    rainProbability:
                        h24.rainProbability || 0,

                    totalRainMm:
                        h24.totalRainMm || 0,

                    peakRainMmH:
                        h24.peakRainMmH || 0,

                    peakTime:
                        h24.peakTime || null,

                    rainStart:
                        h24.rainStart || null,

                    rainEnd:
                        h24.rainEnd || null,

                    severity:
                        h24.severity || null,

                    confidence:
                        h24.confidence || 0
                },

                next72Hours: {
                    rainProbability:
                        h72.rainProbability || 0,

                    totalRainMm:
                        h72.totalRainMm || 0,

                    severity:
                        h72.severity || null
                }
            };
        },

        createFailure(
            city = {},
            reason = "UNKNOWN_ERROR"
        ) {
            const result = {
                engine:
                    ENGINE_NAME,

                version:
                    VERSION,

                status:
                    "FORECAST_UNAVAILABLE",

                generatedAt:
                    new Date().toISOString(),

                city:
                    city?.name ||
                    city?.city ||
                    null,

                lat:
                    city?.lat ?? null,

                lon:
                    city?.lon ?? null,

                source:
                    "Open-Meteo",

                reason,

                horizons: {},

                summary: null
            };

            this.lastResult =
                result;

            return result;
        },

        publish(result) {
            global.dispatchEvent(
                new CustomEvent(
                    "rainguard:rain-forecast-ready",
                    {
                        detail:
                            result
                    }
                )
            );
        },

        getLastResult() {
            return this.lastResult;
        },

        getStatus() {
            return {
                engine:
                    ENGINE_NAME,

                version:
                    VERSION,

                ready:
                    true,

                horizons:
                    [...HORIZONS],

                lastForecast:
                    this.lastResult
                        ?.generatedAt ||
                    null,

                lastStatus:
                    this.lastResult
                        ?.status ||
                    null
            };
        }
    };

    global.RainForecastEngineV32 =
        RainForecastEngine;

    global.RainGuardAI =
        global.RainGuardAI || {};

    global.RainGuardAI.V32 =
        global.RainGuardAI.V32 || {};

    global.RainGuardAI.V32
        .RainForecastEngine =
        RainForecastEngine;

    console.log(
        `[${ENGINE_NAME}] ${VERSION} loaded`
    );

    global.dispatchEvent(
        new CustomEvent(
            "rainguard:rain-forecast-engine-ready",
            {
                detail: {
                    engine:
                        ENGINE_NAME,

                    version:
                        VERSION,

                    horizons:
                        [...HORIZONS]
                }
            }
        )
    );

})(
    typeof window !== "undefined"
        ? window
        : globalThis
);
