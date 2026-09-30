/* =========================================================
   RainGuard AI V32
   FORECAST-1J1 — Rainfall-Driven Preliminary Flood Risk Engine
   Version: FORECAST-1J1.0

   IMPORTANT:
   This is a preliminary rainfall-driven screening indicator.
   It is NOT a confirmed flood prediction and does not yet include
   terrain, wadis, drainage capacity, soil moisture, land cover,
   or calibrated local hydrology.
   ========================================================= */

(function () {
    "use strict";

    const NAME = "FloodRiskEngineV32";
    const VERSION = "FORECAST-1J1.0";
    const HORIZONS = [6, 12, 24, 48, 72];

    const num = (v, fallback = 0) =>
        Number.isFinite(Number(v)) ? Number(v) : fallback;

    const clamp = (v, min = 0, max = 100) =>
        Math.min(max, Math.max(min, num(v)));

    const round = (v, d = 0) => {
        const p = 10 ** d;
        return Math.round(num(v) * p) / p;
    };

    function classify(score) {
        if (score >= 75) {
            return { code: "VERY_HIGH", labelAr: "مرتفع جدًا", labelEn: "Very High" };
        }
        if (score >= 50) {
            return { code: "HIGH", labelAr: "مرتفع", labelEn: "High" };
        }
        if (score >= 25) {
            return { code: "MODERATE", labelAr: "متوسط", labelEn: "Moderate" };
        }
        return { code: "LOW", labelAr: "منخفض", labelEn: "Low" };
    }

    function rainfallAmountScore(mm) {
        const x = Math.max(0, num(mm));
        if (x >= 50) return 100;
        if (x >= 30) return 80;
        if (x >= 15) return 60;
        if (x >= 5) return 35;
        if (x > 0) return 15;
        return 0;
    }

    function intensityScore(mmPerHour) {
        const x = Math.max(0, num(mmPerHour));
        if (x >= 20) return 100;
        if (x >= 15) return 85;
        if (x >= 7.5) return 65;
        if (x >= 2.5) return 40;
        if (x > 0) return 15;
        return 0;
    }

    function probabilityScore(probability) {
        return clamp(probability);
    }

    function sourceSupportScore(h) {
        let score = clamp(h?.sourceAgreement);
        if (h?.radarRainDetected === true) score = Math.min(100, score + 10);
        return score;
    }

    function analyzeHorizon(h = {}, hours) {
        const totalRainMm = Math.max(0, num(h.totalRainMm));
        const peakRainMmH = Math.max(0, num(h.peakRainMmH));
        const rainProbability = clamp(h.rainProbability);
        const sourceSupport = sourceSupportScore(h);

        const amount = rainfallAmountScore(totalRainMm);
        const intensity = intensityScore(peakRainMmH);
        const probability = probabilityScore(rainProbability);

        /*
          Preliminary rainfall-driven weighting only.
          These weights are engineering screening defaults,
          not locally calibrated hydrological thresholds.
        */
        const score = clamp(
            amount * 0.40 +
            intensity * 0.35 +
            probability * 0.15 +
            sourceSupport * 0.10
        );

        const risk = classify(score);

        const evidence = {
            totalRainMm: round(totalRainMm, 1),
            peakRainMmH: round(peakRainMmH, 1),
            rainProbability: round(rainProbability, 0),
            sourceAgreement: round(clamp(h.sourceAgreement), 0),
            radarAvailable: h.radarAvailable === true,
            radarRainDetected: h.radarRainDetected === true,
            forecastSource: h.forecastSource || "UNKNOWN"
        };

        const missingHydrology = [
            "terrain",
            "wadi_proximity",
            "drainage_capacity",
            "soil_moisture",
            "land_cover",
            "local_hydrological_calibration"
        ];

        return {
            horizonHours: hours,
            status: h.status === "FUSION_READY"
                ? "PRELIMINARY_RISK_READY"
                : "INSUFFICIENT_FORECAST_DATA",
            riskScore: round(score, 0),
            riskLevel: risk.code,
            riskLabelAr: risk.labelAr,
            riskLabelEn: risk.labelEn,
            evidence,
            limitations: {
                preliminary: true,
                rainfallDrivenOnly: true,
                confirmedFloodPrediction: false,
                missingHydrology
            }
        };
    }

    function evaluateFusion(fusionResult = {}) {
        const horizons = {};

        HORIZONS.forEach(hours => {
            const h = fusionResult?.horizons?.[`${hours}h`];
            horizons[`${hours}h`] = h
                ? analyzeHorizon(h, hours)
                : {
                    horizonHours: hours,
                    status: "INSUFFICIENT_FORECAST_DATA",
                    riskScore: null,
                    riskLevel: "UNKNOWN",
                    riskLabelAr: "غير متاح",
                    riskLabelEn: "Unavailable",
                    evidence: null,
                    limitations: {
                        preliminary: true,
                        rainfallDrivenOnly: true,
                        confirmedFloodPrediction: false
                    }
                };
        });

        const ready = Object.values(horizons)
            .filter(x => x.status === "PRELIMINARY_RISK_READY");

        const maxRiskScore = ready.length
            ? Math.max(...ready.map(x => num(x.riskScore)))
            : null;

        const highest = ready.length
            ? ready.reduce((a, b) =>
                num(b.riskScore) > num(a.riskScore) ? b : a
              )
            : null;

        const result = {
            engine: NAME,
            version: VERSION,
            status: ready.length
                ? "PRELIMINARY_FLOOD_RISK_READY"
                : "INSUFFICIENT_FORECAST_DATA",
            city: fusionResult?.city || "Unknown",
            lat: fusionResult?.lat ?? null,
            lon: fusionResult?.lon ?? null,
            generatedAt: new Date().toISOString(),
            sourceFusionVersion: fusionResult?.version || null,
            methodology: {
                type: "rainfall_driven_preliminary_screening",
                confirmedFloodPrediction: false,
                locallyCalibrated: false,
                note:
                    "Risk score is a preliminary rainfall-driven screening indicator, not a confirmed flood forecast."
            },
            highestRisk: highest
                ? {
                    horizonHours: highest.horizonHours,
                    riskScore: highest.riskScore,
                    riskLevel: highest.riskLevel,
                    riskLabelAr: highest.riskLabelAr
                }
                : null,
            maxRiskScore,
            horizons
        };

        window.RG32 = window.RG32 || {};
        window.RG32.latestFloodRisk = result;

        window.dispatchEvent(
            new CustomEvent(
                "rainguard:flood-risk-ready",
                { detail: result }
            )
        );

        return result;
    }

    async function evaluateCity(city = {}) {
        const fusion = window.RainForecastFusionV32;

        if (!fusion?.forecastCity) {
            return {
                engine: NAME,
                version: VERSION,
                status: "FUSION_ENGINE_NOT_AVAILABLE",
                city: city.name || city.nameAr || "Unknown",
                horizons: {}
            };
        }

        const fusionResult = await fusion.forecastCity(city);
        return evaluateFusion(fusionResult);
    }

    function getStatus() {
        return {
            engine: NAME,
            version: VERSION,
            ready: true,
            horizons: [...HORIZONS],
            preliminary: true,
            rainfallDrivenOnly: true,
            confirmedFloodPrediction: false
        };
    }

    const api = {
        name: NAME,
        version: VERSION,
        horizons: [...HORIZONS],
        evaluateFusion,
        evaluateCity,
        getStatus
    };

    window.FloodRiskEngineV32 = api;
    window.RG32 = window.RG32 || {};
    window.RG32.FloodRiskEngine = api;

    console.log(`${NAME} ${VERSION} ready.`);

    window.dispatchEvent(
        new CustomEvent(
            "rainguard:flood-risk-engine-ready",
            { detail: getStatus() }
        )
    );
})();
