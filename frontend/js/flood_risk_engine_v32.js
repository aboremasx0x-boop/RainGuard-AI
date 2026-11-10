
/* =========================================================
   RainGuard AI V32
   FORECAST-1J11.0
   Continuous Rainfall Screening Correction

   Experimental screening only.
   NOT a confirmed flood prediction.
   NOT locally calibrated.

   Compatible with:
   - RainForecastFusionV32
   - FloodRiskHydrologicalFusionV32
   - FloodRiskHydrologicalCompositeV32
   ========================================================= */

(function () {
  "use strict";

  const NAME = "FloodRiskEngineV32";
  const VERSION = "FORECAST-1J11.0";
  const HORIZONS = [6, 12, 24, 48, 72];

  const WEIGHTS = Object.freeze({
    rainfallAmount: 0.50,
    rainfallIntensity: 0.40,
    rainProbability: 0.10
  });

  // Provisional scaling references, not flood thresholds.
  const REFERENCE_RAIN_MM = 50;
  const REFERENCE_INTENSITY_MM_H = 20;

  function finite(v) {
    return (
      v !== null &&
      v !== undefined &&
      v !== "" &&
      Number.isFinite(Number(v))
    );
  }

  function num(v, fallback = 0) {
    return finite(v) ? Number(v) : fallback;
  }

  function clamp(v, min = 0, max = 100) {
    return Math.min(max, Math.max(min, num(v)));
  }

  function round(v, digits = 0) {
    const p = 10 ** digits;
    return Math.round(num(v) * p) / p;
  }

  function classify(score) {
    if (score >= 75) {
      return {
        code: "VERY_HIGH",
        labelAr: "مرتفع جدًا",
        labelEn: "Very High"
      };
    }

    if (score >= 50) {
      return {
        code: "HIGH",
        labelAr: "مرتفع",
        labelEn: "High"
      };
    }

    if (score >= 25) {
      return {
        code: "MODERATE",
        labelAr: "متوسط",
        labelEn: "Moderate"
      };
    }

    return {
      code: "LOW",
      labelAr: "منخفض",
      labelEn: "Low"
    };
  }

  function rainfallAmountScore(mm) {
    return round(
      clamp(
        Math.max(0, num(mm)) /
        REFERENCE_RAIN_MM * 100
      ),
      3
    );
  }

  function intensityScore(mmPerHour) {
    return round(
      clamp(
        Math.max(0, num(mmPerHour)) /
        REFERENCE_INTENSITY_MM_H * 100
      ),
      3
    );
  }

  function probabilityScore(probability) {
    return clamp(probability);
  }

  function sourceSupportScore(h = {}) {
    let score = clamp(h.sourceAgreement);

    if (h.radarRainDetected === true) {
      score = Math.min(100, score + 10);
    }

    return score;
  }

  function missingHydrology() {
    return [
      "terrain",
      "wadi_proximity",
      "drainage_capacity",
      "soil_moisture",
      "land_cover",
      "local_hydrological_calibration"
    ];
  }

  function unavailableHorizon(hours) {
    return {
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
        confirmedFloodPrediction: false,
        locallyCalibrated: false,
        missingHydrology: missingHydrology()
      }
    };
  }

  function analyzeHorizon(h = {}, hours) {
    // Never convert missing rainfall inputs into zero.
    const hasAmount = finite(h.totalRainMm);
    const hasIntensity = finite(h.peakRainMmH);

    if (
      h.status !== "FUSION_READY" ||
      !hasAmount ||
      !hasIntensity
    ) {
      return unavailableHorizon(hours);
    }

    const totalRainMm = Math.max(
      0,
      Number(h.totalRainMm)
    );

    const peakRainMmH = Math.max(
      0,
      Number(h.peakRainMmH)
    );

    const hasProbability = finite(h.rainProbability);

    const rainProbability = hasProbability
      ? clamp(h.rainProbability)
      : null;

    const amount = rainfallAmountScore(totalRainMm);
    const intensity = intensityScore(peakRainMmH);

    const probability = hasProbability
      ? probabilityScore(rainProbability)
      : null;

    // Probability is not a substitute for rainfall.
    const hasRainSignal =
      totalRainMm > 0 ||
      peakRainMmH > 0;

    // If probability is missing, do not invent it.
    // Renormalize only the available weights.
    let weightedTotal =
      amount * WEIGHTS.rainfallAmount +
      intensity * WEIGHTS.rainfallIntensity;

    let availableWeight =
      WEIGHTS.rainfallAmount +
      WEIGHTS.rainfallIntensity;

    if (probability !== null) {
      weightedTotal +=
        probability * WEIGHTS.rainProbability;

      availableWeight +=
        WEIGHTS.rainProbability;
    }

    const score = hasRainSignal
      ? clamp(weightedTotal / availableWeight)
      : 0;

    const risk = classify(score);

    const evidence = {
      totalRainMm: round(totalRainMm, 3),
      peakRainMmH: round(peakRainMmH, 3),
      rainProbability:
        rainProbability === null
          ? null
          : round(rainProbability, 1),

      sourceAgreement: finite(h.sourceAgreement)
        ? round(clamp(h.sourceAgreement), 1)
        : null,

      radarAvailable:
        h.radarAvailable === true,

      radarRainDetected:
        h.radarRainDetected === true,

      forecastSource:
        h.forecastSource || "UNKNOWN",

      rainfallAmountScore: round(amount, 2),
      rainfallIntensityScore: round(intensity, 2),
      rainProbabilityScore:
        probability === null
          ? null
          : round(probability, 2),

      sourceSupportScore:
        finite(h.sourceAgreement)
          ? round(sourceSupportScore(h), 2)
          : null,

      scoringMethod:
        "continuous_rainfall_screening",

      availableScoringWeight:
        round(availableWeight, 2)
    };

    return {
      horizonHours: hours,
      status: "PRELIMINARY_RISK_READY",
      riskScore: round(score, 1),
      riskLevel: risk.code,
      riskLabelAr: risk.labelAr,
      riskLabelEn: risk.labelEn,
      evidence,
      limitations: {
        preliminary: true,
        rainfallDrivenOnly: true,
        confirmedFloodPrediction: false,
        locallyCalibrated: false,
        missingHydrology: missingHydrology()
      }
    };
  }

  function getFusionHorizon(fusionResult, hours) {
    const horizons = fusionResult?.horizons;

    if (!horizons) return null;

    if (Array.isArray(horizons)) {
      return horizons.find(h =>
        Number(h?.horizonHours) === hours ||
        h?.period === `${hours}h`
      ) || null;
    }

    return horizons[`${hours}h`] || null;
  }

  function evaluateFusion(fusionResult = {}) {
    const horizons = {};

    HORIZONS.forEach(hours => {
      const h = getFusionHorizon(
        fusionResult,
        hours
      );

      horizons[`${hours}h`] = h
        ? analyzeHorizon(h, hours)
        : unavailableHorizon(hours);
    });

    const ready = Object.values(horizons)
      .filter(h =>
        h.status === "PRELIMINARY_RISK_READY"
      );

    const highest = ready.length
      ? ready.reduce((a, b) =>
          b.riskScore > a.riskScore ? b : a
        )
      : null;

    const maxRiskScore = highest
      ? highest.riskScore
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

      sourceFusionVersion:
        fusionResult?.version || null,

      methodology: {
        type:
          "continuous_rainfall_preliminary_screening",

        weights: { ...WEIGHTS },

        referenceRainMm:
          REFERENCE_RAIN_MM,

        referenceIntensityMmH:
          REFERENCE_INTENSITY_MM_H,

        sourceAgreementUsedInScore: false,

        confirmedFloodPrediction: false,
        locallyCalibrated: false,

        note:
          "Experimental rainfall screening only. " +
          "Not a confirmed or calibrated flood forecast."
      },

      highestRisk: highest
        ? {
            horizonHours:
              highest.horizonHours,

            riskScore:
              highest.riskScore,

            riskLevel:
              highest.riskLevel,

            riskLabelAr:
              highest.riskLabelAr
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

    if (
      typeof fusion?.forecastCity !== "function"
    ) {
      return {
        engine: NAME,
        version: VERSION,
        status: "FUSION_ENGINE_NOT_AVAILABLE",
        city:
          city.name ||
          city.nameAr ||
          "Unknown",
        horizons: {}
      };
    }

    const fusionResult =
      await fusion.forecastCity(city);

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
      locallyCalibrated: false,
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

  console.log(
    `${NAME} ${VERSION} ready.`
  );

  window.dispatchEvent(
    new CustomEvent(
      "rainguard:flood-risk-engine-ready",
      { detail: getStatus() }
    )
  );
})();
