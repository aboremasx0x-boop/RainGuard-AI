/* =========================================================
   RainGuard AI V32
   FORECAST-1D — Multi-Source Rain Forecast Fusion

   Priority:
   1) ANWAA / NCM       -> Official source
   2) RainViewer        -> Live radar / nowcast verification
   3) Open-Meteo        -> Numerical forecast

   IMPORTANT:
   - Simulation data is NEVER accepted as official data.
   - Confidence here is source/data agreement, not calibrated
     meteorological forecast accuracy.
   ========================================================= */

(function () {
    "use strict";

    const ENGINE_NAME = "RainForecastFusionV32";
    const VERSION = "FORECAST-1D.1";

    const HORIZONS = [6, 12, 24, 48, 72];

    function num(value, fallback = 0) {
        const n = Number(value);
        return Number.isFinite(n) ? n : fallback;
    }

    function clamp(value, min = 0, max = 100) {
        return Math.min(max, Math.max(min, num(value)));
    }

    function round(value, digits = 1) {
        const p = Math.pow(10, digits);
        return Math.round(num(value) * p) / p;
    }

    function isRealAnwaa(result) {
        if (!result) return false;

        return (
            result.official === true &&
            result.available === true &&
            result.ok !== false &&
            result.status !== "SIMULATION" &&
            result.status !== "PENDING_API" &&
            result.provider === "National Center for Meteorology"
        );
    }

    function isLiveRainViewer(result) {
        return Boolean(
            result &&
            result.available === true &&
            result.status === "AVAILABLE"
        );
    }

    function isOpenMeteoReady(result) {
        return Boolean(
            result &&
            result.status === "FORECAST_READY"
        );
    }

    function getAnwaaWindow(result, hours) {
        if (!result) return null;

        const key = `h${hours}`;
        const win = result.forecastWindows?.[key];

        if (!win) return null;

        return {
            probability: clamp(win.probability),
            rainAmount: Math.max(0, num(win.rainAmount))
        };
    }

    function getOpenMeteoWindow(result, hours) {
        const win = result?.horizons?.[`${hours}h`];

        if (!win) return null;

        return {
            probability: clamp(win.rainProbability),
            rainAmount: Math.max(0, num(win.totalRainMm)),
            peakRainMmH: Math.max(0, num(win.peakRainMmH)),
            peakTime:
                num(win.peakRainMmH) > 0
                    ? win.peakTime
                    : null,
            rainStart: win.rainStart ?? null,
            rainEnd: win.rainEnd ?? null,
            severity: win.severity ?? null
        };
    }

    function radarSignal(result) {
        if (!isLiveRainViewer(result)) {
            return {
                available: false,
                rainDetected: false,
                signalScore: 0,
                rainAmount: 0
            };
        }

        const signal = clamp(result.signalScore);
        const amount = Math.max(
            0,
            num(result.rainAmount)
        );

        return {
            available: true,
            rainDetected:
                signal > 0 ||
                amount > 0 ||
                num(result.rainProbability) > 0,
            signalScore: signal,
            rainAmount: amount,
            timestamp: result.timestamp ?? null
        };
    }

    function calculateAgreement({
        officialUsed,
        openMeteoReady,
        radarAvailable,
        radarDetected,
        probability,
        rainAmount
    }) {
        let score = 0;

        if (officialUsed) score += 45;
        if (openMeteoReady) score += 30;
        if (radarAvailable) score += 15;

        if (
            radarDetected &&
            (probability > 0 || rainAmount > 0)
        ) {
            score += 10;
        }

        return clamp(score);
    }

    async function safeCollect(adapter, city) {
        try {
            if (!adapter?.collect) return null;
            return await adapter.collect(city);
        } catch (error) {
            console.warn(
                "[RainForecastFusionV32] source failed:",
                error
            );
            return null;
        }
    }

    async function forecastCity(city = {}) {
        const anwaaAdapter =
            window.RG30?.AnwaaAdapter;

        const rainViewerAdapter =
            window.RG30?.RainViewerAdapter;

        const openMeteoEngine =
            window.RainForecastEngineV32;

        const [
            anwaa,
            rainViewer,
            openMeteo
        ] = await Promise.all([
            safeCollect(anwaaAdapter, city),
            safeCollect(rainViewerAdapter, city),
            openMeteoEngine?.forecastCity
                ? openMeteoEngine.forecastCity(city)
                : Promise.resolve(null)
        ]);

        const officialAvailable =
            isRealAnwaa(anwaa);

        const radar =
            radarSignal(rainViewer);

        const openMeteoReady =
            isOpenMeteoReady(openMeteo);

        const horizons = {};

        for (const hours of HORIZONS) {
            const officialWindow =
                officialAvailable
                    ? getAnwaaWindow(anwaa, hours)
                    : null;

            const omWindow =
                openMeteoReady
                    ? getOpenMeteoWindow(
                        openMeteo,
                        hours
                    )
                    : null;

            /*
             * Source selection:
             * Official Anwaa forecast wins when the requested
             * horizon exists. Otherwise Open-Meteo is used.
             */
            const base =
                officialWindow || omWindow;

            const probability =
                base?.probability ?? 0;

            const rainAmount =
                base?.rainAmount ?? 0;

            horizons[`${hours}h`] = {
                horizonHours: hours,

                forecastSource:
                    officialWindow
                        ? "ANWAA_NCM"
                        : omWindow
                            ? "OPEN_METEO"
                            : "NO_FORECAST_SOURCE",

                official:
                    Boolean(officialWindow),

                rainProbability:
                    round(probability, 0),

                totalRainMm:
                    round(rainAmount, 1),

                peakRainMmH:
                    round(
                        omWindow?.peakRainMmH ?? 0,
                        1
                    ),

                peakTime:
                    omWindow?.peakTime ?? null,

                rainStart:
                    omWindow?.rainStart ?? null,

                rainEnd:
                    omWindow?.rainEnd ?? null,

                severity:
                    omWindow?.severity ?? null,

                radarAvailable:
                    radar.available,

                radarRainDetected:
                    radar.rainDetected,

                radarSignalScore:
                    radar.signalScore,

                sourceAgreement:
                    calculateAgreement({
                        officialUsed:
                            Boolean(officialWindow),
                        openMeteoReady,
                        radarAvailable:
                            radar.available,
                        radarDetected:
                            radar.rainDetected,
                        probability,
                        rainAmount
                    }),

                status:
                    base
                        ? "FUSION_READY"
                        : "NO_FORECAST_DATA"
            };
        }

        const result = {
            engine: ENGINE_NAME,
            version: VERSION,

            status:
                openMeteoReady ||
                officialAvailable
                    ? "FUSION_READY"
                    : "NO_FORECAST_DATA",

            city: city.name ?? "Unknown",
            lat: city.lat ?? null,
            lon: city.lon ?? null,

            sources: {
                anwaa: {
                    configured:
                        window.RG30
                            ?.AnwaaAdapter
                            ?.isConfigured?.() ??
                        false,

                    available:
                        officialAvailable,

                    status:
                        anwaa?.status ??
                        "NOT_AVAILABLE",

                    official:
                        anwaa?.official === true,

                    simulationRejected:
                        anwaa?.status ===
                        "SIMULATION"
                },

                rainViewer: {
                    available:
                        radar.available,

                    status:
                        rainViewer?.status ??
                        "NOT_AVAILABLE",

                    rainDetected:
                        radar.rainDetected,

                    signalScore:
                        radar.signalScore,

                    timestamp:
                        radar.timestamp ?? null
                },

                openMeteo: {
                    available:
                        openMeteoReady,

                    status:
                        openMeteo?.status ??
                        "NOT_AVAILABLE"
                }
            },

            horizons,

            generatedAt:
                new Date().toISOString()
        };

        window.RG32 =
            window.RG32 || {};

        window.RG32.latestRainForecastFusion =
            result;

        window.dispatchEvent(
            new CustomEvent(
                "rainguard:forecast-fusion-ready",
                { detail: result }
            )
        );

        return result;
    }

    function getStatus() {
        return {
            engine: ENGINE_NAME,
            version: VERSION,
            ready: true,
            horizons: [...HORIZONS],
            priority: [
                "ANWAA_NCM",
                "RAINVIEWER_RADAR",
                "OPEN_METEO"
            ]
        };
    }

    const api = {
        name: ENGINE_NAME,
        version: VERSION,
        horizons: [...HORIZONS],
        forecastCity,
        getStatus
    };

    window.RainForecastFusionV32 = api;

    window.RG32 =
        window.RG32 || {};

    window.RG32.RainForecastFusion =
        api;

    console.log(
        `${ENGINE_NAME} ${VERSION} ready.`
    );

    window.dispatchEvent(
        new CustomEvent(
            "rainguard:forecast-fusion-engine-ready",
            {
                detail: getStatus()
            }
        )
    );

})();
