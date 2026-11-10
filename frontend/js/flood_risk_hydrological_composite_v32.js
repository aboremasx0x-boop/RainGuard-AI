
/*
 RainGuard AI V32
 FORECAST-1J9.0
 Preliminary Rainfall + Hydrology Composite

 IMPORTANT:
 Experimental screening only.
 NOT a confirmed flood forecast.
 NOT locally calibrated.
 Missing factors are never assigned invented values.
*/

(function () {
  "use strict";

  const NAME = "FloodRiskHydrologicalCompositeV32";
  const VERSION = "FORECAST-1J9.0";
  const HORIZONS = [6, 12, 24, 48, 72];

  const finite = v =>
    v !== null &&
    v !== undefined &&
    v !== "" &&
    Number.isFinite(Number(v));

  const clamp = (v, min = 0, max = 100) =>
    Math.max(min, Math.min(max, Number(v)));

  const round = v => Math.round(v * 10) / 10;

  function normalizeFactor(data) {
    if (!data || data.available !== true ||
        !finite(data.value)) {
      return null;
    }

    return Number(data.value);
  }

  function factorScores(factors = {}) {
    const elevation = normalizeFactor(factors.terrain);
    const slope = normalizeFactor(factors.slope);
    const wadi = normalizeFactor(factors.wadi_proximity);
    const moisture = normalizeFactor(factors.soil_moisture);
    const cover = normalizeFactor(factors.land_cover);

    /*
     These are provisional screening transforms,
     not validated Saudi hydrological thresholds.
    */

    return {
      terrain: elevation === null
        ? null
        : round(clamp((100 - elevation) / 100 * 100)),

      slope: slope === null
        ? null
        : round(clamp(slope / 15 * 100)),

      wadi_proximity: wadi === null
        ? null
        : round(clamp((3000 - wadi) / 3000 * 100)),

      soil_moisture: moisture === null
        ? null
        : round(clamp(moisture / 0.45 * 100)),

      land_cover: cover === null
        ? null
        : ({
            10: 25,
            20: 45,
            30: 40,
            40: 55,
            50: 80,
            60: 65,
            70: 30,
            80: 50,
            90: 70,
            95: 35,
            100: 30
          }[cover] ?? null)
    };
  }

  function weightedHydrology(scores) {
    const weights = {
      terrain: 0.10,
      slope: 0.20,
      wadi_proximity: 0.30,
      soil_moisture: 0.20,
      land_cover: 0.20
    };

    let total = 0;
    let weightSum = 0;

    for (const [key, weight] of Object.entries(weights)) {
      const value = scores[key];

      if (finite(value)) {
        total += value * weight;
        weightSum += weight;
      }
    }

    return {
      score: weightSum > 0
        ? round(total / weightSum)
        : null,
      availableWeight: round(weightSum),
      factorScores: scores
    };
  }

  function getHorizon(horizons, hours) {
    if (!horizons) return null;

    if (Array.isArray(horizons)) {
      return horizons.find(h =>
        Number(h?.horizonHours) === hours ||
        h?.period === `${hours}h`
      ) || null;
    }

    return horizons[`${hours}h`] || null;
  }

  function combineHorizon(rain, hydro) {
    const rainScore =
      rain?.status === "PRELIMINARY_RISK_READY" &&
      finite(rain.riskScore)
        ? Number(rain.riskScore)
        : null;

    const hydroScore = hydro.score;

    if (rainScore === null || hydroScore === null) {
      return {
        status: "INSUFFICIENT_COMPOSITE_DATA",
        rainfallScore: rainScore,
        hydrologicalScore: hydroScore,
        compositeScore: null,
        confirmedFloodPrediction: false
      };
    }

    /*
     Provisional 60/40 weighting.
     Must be calibrated against historical events.
    */

    const combined = clamp(
      rainScore * 0.60 +
      hydroScore * 0.40
    );

    return {
      status: "PRELIMINARY_COMPOSITE_READY",
      rainfallScore: round(rainScore),
      hydrologicalScore: hydroScore,
      compositeScore: round(combined),
      confirmedFloodPrediction: false,
      locallyCalibrated: false
    };
  }

  async function evaluateCity(city = {}) {
    const fusion =
      window.FloodRiskHydrologicalFusionV32;

    if (typeof fusion?.evaluateCity !== "function") {
      return {
        engine: NAME,
        version: VERSION,
        status: "HYDROLOGICAL_FUSION_UNAVAILABLE",
        city: city.name || "Unknown"
      };
    }

    const base = await fusion.evaluateCity(city);

    const hydrology = base?.hydrology || {};
    const factors = hydrology.factors || {};

    const scores = factorScores(factors);
    const hydro = weightedHydrology(scores);

    const rainfallHorizons =
      base?.rainfall?.horizons ||
      base?.rainfallResult?.horizons ||
      base?.floodRisk?.horizons ||
      base?.horizons ||
      {};

    const horizons = {};

    for (const hours of HORIZONS) {
      const rain = getHorizon(rainfallHorizons, hours);

      horizons[`${hours}h`] = {
        horizonHours: hours,
        ...combineHorizon(rain, hydro)
      };
    }

    const ready = Object.values(horizons)
      .filter(h =>
        h.status === "PRELIMINARY_COMPOSITE_READY"
      );

    const result = {
      engine: NAME,
      version: VERSION,
      city: city.name || "Unknown",
      status: ready.length
        ? "PRELIMINARY_COMPOSITE_READY"
        : "INSUFFICIENT_COMPOSITE_DATA",
      generatedAt: new Date().toISOString(),
      methodology: {
        type: "experimental_rainfall_hydrology_screening",
        rainfallWeight: 0.60,
        hydrologyWeight: 0.40,
        locallyCalibrated: false,
        confirmedFloodPrediction: false
      },
      hydrology: {
        completenessPercent:
          hydrology.completenessPercent ?? null,
        availableWeight: hydro.availableWeight,
        score: hydro.score,
        factorScores: hydro.factorScores,
        drainageCapacityAvailable:
          factors.drainage_capacity?.available === true
      },
      horizons,
      errors: base?.errors || []
    };

    window.RG32 = window.RG32 || {};
    window.RG32.latestCompositeFloodRisk = result;

    window.dispatchEvent(
      new CustomEvent(
        "rainguard:composite-flood-risk-ready",
        { detail: result }
      )
    );

    return result;
  }

  function getStatus() {
    return {
      engine: NAME,
      version: VERSION,
      ready: true,
      preliminary: true,
      locallyCalibrated: false,
      confirmedFloodPrediction: false
    };
  }

  window[NAME] = {
    name: NAME,
    version: VERSION,
    evaluateCity,
    getStatus
  };

  console.log(NAME, VERSION, "ready");
})();
