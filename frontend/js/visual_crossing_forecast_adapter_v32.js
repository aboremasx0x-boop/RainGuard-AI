/*
===========================================================
 RainGuard AI V32
 VISUALCROSSING-1C — Visual Crossing Forecast Adapter
 Version: VISUALCROSSING-1C.0

 Purpose:
 - Call RainGuard secure backend proxy (never expose API key).
 - Convert Visual Crossing hourly data to the same operational
   6 / 12 / 24 / 48 / 72 hour forecast shape used by RainGuard.
 - Keep Visual Crossing independent until fusion stage 1D.
===========================================================
*/

(function initVisualCrossingAdapter(global) {
    "use strict";

    const NAME = "VisualCrossingForecastAdapterV32";
    const VERSION = "VISUALCROSSING-1C.0";
    const HORIZONS = Object.freeze([6, 12, 24, 48, 72]);

    const DEFAULT_API_BASE =
        "https://rainguard-ai.onrender.com";

    function num(value, fallback = 0) {
        const n = Number(value);
        return Number.isFinite(n) ? n : fallback;
    }

    function clamp(value, min = 0, max = 100) {
        return Math.min(max, Math.max(min, num(value)));
    }

    function round(value, digits = 1) {
        const p = 10 ** digits;
        return Math.round((num(value) + Number.EPSILON) * p) / p;
    }

    function validCoordinate(value, min, max) {
        const n = Number(value);
        return Number.isFinite(n) && n >= min && n <= max;
    }

    function getCityCoordinates(city = {}) {
        const lat = city.lat ?? city.latitude;
        const lon = city.lon ?? city.lng ?? city.longitude;

        if (
            !validCoordinate(lat, -90, 90) ||
            !validCoordinate(lon, -180, 180)
        ) {
            return null;
        }

        return {
            lat: Number(lat),
            lon: Number(lon)
        };
    }

    function getCityName(city = {}) {
        return (
            city.name ||
            city.nameAr ||
            city.city ||
            city.cityName ||
            null
        );
    }

    function normalizeHour(day = {}, hour = {}) {
        const datetime =
            hour.datetime ||
            null;

        const datetimeEpoch =
            num(hour.datetimeEpoch, 0);

        let isoTime = null;

        if (datetimeEpoch > 0) {
            isoTime =
                new Date(datetimeEpoch * 1000)
                    .toISOString();
        } else if (day.datetime && datetime) {
            const parsed =
                new Date(`${day.datetime}T${datetime}`);

            if (!Number.isNaN(parsed.getTime())) {
                isoTime = parsed.toISOString();
            }
        }

        return {
            time: isoTime,
            epoch: datetimeEpoch,
            probability: clamp(hour.precipprob),
            precipitation: Math.max(0, num(hour.precip)),
            precipType: Array.isArray(hour.preciptype)
                ? [...hour.preciptype]
                : [],
            temp: num(hour.temp, null),
            humidity: num(hour.humidity, null),
            windSpeed: num(hour.windspeed, null),
            conditions: hour.conditions || null,
            icon: hour.icon || null
        };
    }

    function flattenHours(days = []) {
        if (!Array.isArray(days)) {
            return [];
        }

        const hours = [];

        days.forEach(day => {
            if (!Array.isArray(day?.hours)) {
                return;
            }

            day.hours.forEach(hour => {
                hours.push(
                    normalizeHour(day, hour)
                );
            });
        });

        return hours
            .filter(hour => hour.time || hour.epoch)
            .sort((a, b) => {
                const av =
                    a.epoch ||
                    Date.parse(a.time) / 1000 ||
                    0;

                const bv =
                    b.epoch ||
                    Date.parse(b.time) / 1000 ||
                    0;

                return av - bv;
            });
    }

    function currentStartIndex(hours = []) {
        if (!hours.length) {
            return 0;
        }

        const nowSeconds = Date.now() / 1000;

        for (let i = 0; i < hours.length; i += 1) {
            const epoch =
                hours[i].epoch ||
                Date.parse(hours[i].time) / 1000;

            if (
                Number.isFinite(epoch) &&
                epoch >= nowSeconds - 30 * 60
            ) {
                return i;
            }
        }

        return 0;
    }

    function severity({
        totalRainMm = 0,
        peakRainMmH = 0,
        probability = 0
    } = {}) {
        const total = num(totalRainMm);
        const peak = num(peakRainMmH);
        const prob = num(probability);

        if (total >= 50 || peak >= 20) {
            return {
                code: "EXTREME",
                labelAr: "شديدة جدًا",
                labelEn: "Extreme",
                score: 100
            };
        }

        if (total >= 30 || peak >= 15) {
            return {
                code: "SEVERE",
                labelAr: "شديدة",
                labelEn: "Severe",
                score: 85
            };
        }

        if (total >= 15 || peak >= 7.5) {
            return {
                code: "HEAVY",
                labelAr: "غزيرة",
                labelEn: "Heavy",
                score: 70
            };
        }

        if (total >= 5 || peak >= 2.5) {
            return {
                code: "MODERATE",
                labelAr: "متوسطة",
                labelEn: "Moderate",
                score: 50
            };
        }

        if (total > 0 || peak > 0 || prob >= 30) {
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

    function confidence({
        sampleCount = 0,
        expectedSamples = 0,
        probability = 0,
        totalRain = 0
    } = {}) {
        if (!expectedSamples) {
            return 0;
        }

        const coverage =
            Math.min(
                1,
                Math.max(
                    0,
                    num(sampleCount) /
                    num(expectedSamples, 1)
                )
            );

        let score = coverage * 70;

        if (probability >= 70) {
            score += 15;
        } else if (probability >= 40) {
            score += 10;
        } else {
            score += 5;
        }

        if (totalRain > 0) {
            score += 10;
        }

        /*
         This is data coverage / internal signal confidence,
         not verified meteorological forecast accuracy.
        */
        return Math.round(
            Math.min(95, Math.max(0, score))
        );
    }

    function analyzeWindow(hours, startIndex, horizonHours) {
        const slice =
            hours.slice(
                startIndex,
                startIndex + horizonHours
            );

        if (!slice.length) {
            return {
                horizonHours,
                sampleCount: 0,
                status: "NO_DATA"
            };
        }

        const probabilities =
            slice.map(hour => hour.probability);

        const amounts =
            slice.map(hour => hour.precipitation);

        const maximumProbability =
            Math.max(0, ...probabilities);

        const totalRain =
            amounts.reduce(
                (sum, value) =>
                    sum + Math.max(0, num(value)),
                0
            );

        const peakRain =
            Math.max(0, ...amounts);

        const peakIndex =
            amounts.findIndex(
                value =>
                    num(value) === peakRain
            );

        const rainyIndexes = [];

        amounts.forEach((value, index) => {
            if (num(value) > 0) {
                rainyIndexes.push(index);
            }
        });

        const rainStart =
            rainyIndexes.length
                ? slice[rainyIndexes[0]]?.time || null
                : null;

        const rainEnd =
            rainyIndexes.length
                ? slice[
                    rainyIndexes[
                        rainyIndexes.length - 1
                    ]
                ]?.time || null
                : null;

        const resultSeverity =
            severity({
                totalRainMm: totalRain,
                peakRainMmH: peakRain,
                probability: maximumProbability
            });

        return {
            horizonHours,
            sampleCount: slice.length,
            startTime: slice[0]?.time || null,
            endTime:
                slice[slice.length - 1]?.time || null,
            rainProbability:
                round(maximumProbability, 0),
            totalRainMm:
                round(totalRain, 2),
            peakRainMmH:
                round(peakRain, 2),
            peakTime:
                peakIndex >= 0
                    ? slice[peakIndex]?.time || null
                    : null,
            rainStart,
            rainEnd,
            severity: resultSeverity,
            confidence:
                confidence({
                    sampleCount: slice.length,
                    expectedSamples: horizonHours,
                    probability: maximumProbability,
                    totalRain
                }),
            status: "FORECAST_READY"
        };
    }

    const Adapter = {
        name: NAME,
        version: VERSION,
        horizons: HORIZONS,
        apiBase: DEFAULT_API_BASE,
        lastResult: null,

        setApiBase(value) {
            const next =
                String(value || "")
                    .trim()
                    .replace(/\/+$/, "");

            if (next) {
                this.apiBase = next;
            }

            return this.apiBase;
        },

        async collect(city = {}) {
            const coordinates =
                getCityCoordinates(city);

            if (!coordinates) {
                return this.failure(
                    city,
                    "INVALID_CITY_COORDINATES"
                );
            }

            const url =
                `${this.apiBase}` +
                `/api/weather/visual-crossing` +
                `?lat=${encodeURIComponent(coordinates.lat)}` +
                `&lon=${encodeURIComponent(coordinates.lon)}`;

            try {
                const response =
                    await fetch(
                        url,
                        {
                            method: "GET",
                            headers: {
                                "Accept": "application/json"
                            },
                            cache: "no-store"
                        }
                    );

                let payload = null;

                try {
                    payload = await response.json();
                } catch (error) {
                    return this.failure(
                        city,
                        "INVALID_BACKEND_JSON",
                        {
                            httpStatus:
                                response.status
                        }
                    );
                }

                if (
                    !response.ok ||
                    payload?.success !== true
                ) {
                    return this.failure(
                        city,
                        payload?.error ||
                        "VISUAL_CROSSING_BACKEND_ERROR",
                        {
                            httpStatus:
                                response.status,
                            upstreamStatus:
                                payload?.upstream_status ??
                                null
                        }
                    );
                }

                return this.analyzePayload(
                    payload,
                    city
                );

            } catch (error) {
                return this.failure(
                    city,
                    "VISUAL_CROSSING_FETCH_FAILED",
                    {
                        detail:
                            error?.message ||
                            String(error)
                    }
                );
            }
        },

        analyzePayload(payload = {}, city = {}) {
            const hours =
                flattenHours(
                    payload.days || []
                );

            if (!hours.length) {
                return this.failure(
                    city,
                    "VISUAL_CROSSING_HOURLY_MISSING"
                );
            }

            const startIndex =
                currentStartIndex(hours);

            const forecasts = {};

            HORIZONS.forEach(horizon => {
                forecasts[`${horizon}h`] =
                    analyzeWindow(
                        hours,
                        startIndex,
                        horizon
                    );
            });

            const result = {
                ok: true,
                adapter: NAME,
                version: VERSION,
                status: "FORECAST_READY",
                generatedAt:
                    new Date().toISOString(),
                provider: "Visual Crossing",
                source: "visual_crossing",
                city: getCityName(city),
                lat:
                    num(
                        city.lat ??
                        city.latitude ??
                        payload.latitude,
                        null
                    ),
                lon:
                    num(
                        city.lon ??
                        city.lng ??
                        city.longitude ??
                        payload.longitude,
                        null
                    ),
                timezone:
                    payload.timezone ||
                    "Asia/Riyadh",
                resolvedAddress:
                    payload.resolvedAddress ||
                    null,
                startIndex,
                hourlySampleCount:
                    hours.length,
                currentConditions:
                    payload.currentConditions ||
                    null,
                horizons: forecasts,
                raw: payload
            };

            this.lastResult = result;

            global.dispatchEvent(
                new CustomEvent(
                    "rainguard:visual-crossing-forecast-ready",
                    {
                        detail: result
                    }
                )
            );

            return result;
        },

        failure(city = {}, reason, extra = {}) {
            const result = {
                ok: false,
                adapter: NAME,
                version: VERSION,
                status: "FORECAST_UNAVAILABLE",
                generatedAt:
                    new Date().toISOString(),
                provider: "Visual Crossing",
                source: "visual_crossing",
                city: getCityName(city),
                lat:
                    city.lat ??
                    city.latitude ??
                    null,
                lon:
                    city.lon ??
                    city.lng ??
                    city.longitude ??
                    null,
                reason:
                    reason ||
                    "UNKNOWN_ERROR",
                horizons: {},
                ...extra
            };

            this.lastResult = result;
            return result;
        },

        getStatus() {
            return {
                adapter: NAME,
                version: VERSION,
                ready: true,
                apiBase: this.apiBase,
                horizons: [...HORIZONS],
                lastStatus:
                    this.lastResult?.status ||
                    null,
                lastForecast:
                    this.lastResult?.generatedAt ||
                    null
            };
        }
    };

    global.VisualCrossingForecastAdapterV32 =
        Adapter;

    global.RG32 =
        global.RG32 || {};

    global.RG32.VisualCrossingAdapter =
        Adapter;

    console.log(
        `[${NAME}] ${VERSION} loaded`
    );

    global.dispatchEvent(
        new CustomEvent(
            "rainguard:visual-crossing-adapter-ready",
            {
                detail: {
                    adapter: NAME,
                    version: VERSION,
                    horizons: [...HORIZONS]
                }
            }
        )
    );

})(
    typeof window !== "undefined"
        ? window
        : globalThis
);
