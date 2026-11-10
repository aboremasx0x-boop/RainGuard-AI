
/*
 RainGuard AI V32
 FORECAST-1J9.1

 Preliminary Rainfall + Hydrology Composite

 FIX:
 - Read rainfallRiskScore from fusion horizons.
 - Support legacy riskScore.
 - Validate rainfall horizon status.
 - Preserve missing hydrological factors.
 - Prevent missing values becoming zero.

 IMPORTANT:
 Experimental screening only.
 NOT a confirmed flood forecast.
 NOT locally calibrated.
*/

(function () {
  "use strict";

  const NAME = "FloodRiskHydrologicalCompositeV32";
  const VERSION = "FORECAST-1J9.1";

  const HORIZONS = [6, 12, 24, 48, 72];

  const RAIN_WEIGHT = 0.60;
  const HYDRO_WEIGHT = 0.40;

  const finite = v =>
    v !== null &&
    v !== undefined &&
    v !== "" &&
    typeof v !== "boolean" &&
    Number.isFinite(Number(v));

  const clamp = (v, min = 0, max = 100) =>
    Math.max(min, Math.min(max, Number(v)));

  const round = v =>
    Math.round(v * 10) / 10;

  function normalizeFactor(data) {
    if (
      !data ||
      data.available !== true ||
      !finite(data.value)
    ) {
      return null;
    }

    return Number(data.value);
  }

  function factorScores(factors = {}) {
    const elevation =
      normalizeFactor(factors.terrain);

    const slope =
      normalizeFactor(factors.slope);

    const wadi =
      normalizeFactor(factors.wadi_proximity);

    const moisture =
      normalizeFactor(factors.soil_moisture);

    const cover =
      normalizeFactor(factors.land_cover);

    /*
      Provisional screening transforms.
      These are not locally calibrated thresholds.
    */

    const landCoverScores = {
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
    };

    return {
      terrain:
        elevation === null
          ? null
          : round(
              clamp(100 - elevation)
            ),

      slope:
        slope === null
          ? null
          : round(
              clamp((slope / 15) * 100)
            ),

      wadi_proximity:
        wadi === null
          ? null
          : round(
              clamp(
                ((3000 - wadi) / 3000) * 100
              )
            ),

      soil_moisture:
        moisture === null
          ? null
          : round(
              clamp(
                (moisture / 0.45) * 100
              )
            ),

      land_cover:
        cover === null
          ? null
          : (
              landCoverScores[cover] ?? null
            )
    };
  }

  function weightedHydrology(scores = {}) {
    const weights = {
      terrain: 0.10,
      slope: 0.20,
      wadi_proximity: 0.30,
      soil_moisture: 0.20,
      land_cover: 0.20
    };

    let total = 0;
    let weightSum = 0;

    for (
      const [key, weight]
      of Object.entries(weights)
    ) {
      const value = scores[key];

      if (finite(value)) {
        total += Number(value) * weight;
        weightSum += weight;
      }
    }

    return {
      score:
        weightSum > 0
          ? round(total / weightSum)
          : null,

      availableWeight:
        round(weightSum),

      factorScores: scores
    };
  }

  function getHorizon(horizons, hours) {
    if (!horizons) {
      return null;
    }

    if (Array.isArray(horizons)) {
      return (
        horizons.find(h =>
          Number(h?.horizonHours) === hours ||
          h?.period === `${hours}h` ||
          h?.horizon === `${hours}h`
        ) || null
      );
    }

    return (
      horizons[`${hours}h`] ||
      horizons[hours] ||
      null
    );
  }

  function extractRainfallScore(rain) {
    if (!rain || typeof rain !== "object") {
      return null;
    }

    const allowedStatuses = [
      "PRELIMINARY_RISK_READY",
      "PRELIMINARY_FLOOD_RISK_READY"
    ];

    if (
      !allowedStatuses.includes(rain.status)
    ) {
      return null;
    }

    const value =
      rain.rainfallRiskScore ??
      rain.riskScore ??
      null;

    if (!finite(value)) {
      return null;
    }

    const score = Number(value);

    if (score < 0 || score > 100) {
      return null;
    }

    return score;
  }

  function combineHorizon(rain, hydro) {
    const rainScore =
      extractRainfallScore(rain);

    const hydroScore =
      finite(hydro?.score)
        ? Number(hydro.score)
        : null;

    if (
      rainScore === null ||
      hydroScore === null
    ) {
      return {
        status: "INSUFFICIENT_COMPOSITE_DATA",

        rainfallStatus:
          rain?.status ?? null,

        rainfallScore: rainScore,

        hydrologicalScore: hydroScore,

        compositeScore: null,

        confirmedFloodPrediction: false,

        locallyCalibrated: false
      };
    }

    /*
      Provisional 60/40 weighting.
      Must be calibrated against
      independent historical flood events.
    */

    const combined = clamp(
      rainScore * RAIN_WEIGHT +
      hydroScore * HYDRO_WEIGHT
    );

    return {
      status: "PRELIMINARY_COMPOSITE_READY",

      rainfallStatus:
        rain.status,

      rainfallScore:
        round(rainScore),

      hydrologicalScore:
        round(hydroScore),

      compositeScore:
        round(combined),

      confirmedFloodPrediction: false,

      locallyCalibrated: false
    };
  }

  async function evaluateCity(city = {}) {
    const fusion =
      window.FloodRiskHydrologicalFusionV32;

    if (
      typeof fusion?.evaluateCity !== "function"
    ) {
      return {
        engine: NAME,
        version: VERSION,

        status:
          "HYDROLOGICAL_FUSION_UNAVAILABLE",

        city:
          city.name ||
          city.nameAr ||
          "Unknown",

        horizons: {},

        errors: [
          "HYDROLOGICAL_FUSION_UNAVAILABLE"
        ]
      };
    }

    const base =
      await fusion.evaluateCity(city);

    const hydrology =
      base?.hydrology || {};

    const factors =
      hydrology.factors || {};

    const scores =
      factorScores(factors);

    const hydro =
      weightedHydrology(scores);

    /*
      The current fusion bridge places
      rainfall results in base.horizons.
    */

    const rainfallHorizons =
      base?.rainfall?.horizons ||
      base?.rainfallResult?.horizons ||
      base?.floodRisk?.horizons ||
      base?.horizons ||
      {};

    const missingHydrology = [
      "terrain",
      "slope",
      "wadi_proximity",
      "drainage_capacity",
      "soil_moisture",
      "land_cover"
    ].filter(key =>
      factors[key]?.available !== true
    );

    const horizons = {};

    for (const hours of HORIZONS) {
      const rain =
        getHorizon(
          rainfallHorizons,
          hours
        );

      horizons[`${hours}h`] = {
        horizonHours: hours,

        ...combineHorizon(
          rain,
          hydro
        )
      };
    }

    const ready =
      Object.values(horizons)
        .filter(h =>
          h.status ===
          "PRELIMINARY_COMPOSITE_READY"
        );

    const maxCompositeScore =
      ready.length
        ? Math.max(
            ...ready.map(h =>
              h.compositeScore
            )
          )
        : null;

    const result = {
      engine: NAME,
      version: VERSION,

      city:
        city.name ||
        city.nameAr ||
        "Unknown",

      lat:
        city.lat ?? null,

      lon:
        city.lon ??
        city.lng ??
        null,

      status:
        ready.length
          ? "PRELIMINARY_COMPOSITE_READY"
          : "INSUFFICIENT_COMPOSITE_DATA",

      generatedAt:
        new Date().toISOString(),

      methodology: {
        type:
          "experimental_rainfall_hydrology_screening",

        rainfallWeight:
          RAIN_WEIGHT,

        hydrologyWeight:
          HYDRO_WEIGHT,

        locallyCalibrated: false,

        confirmedFloodPrediction: false,

        note:
          "Experimental screening score, not a confirmed flood prediction."
      },

      hydrology: {
        completenessPercent:
          hydrology.completenessPercent ??
          null,

        availableWeight:
          hydro.availableWeight,

        score:
          hydro.score,

        factorScores:
          hydro.factorScores,

        missingFactors:
          missingHydrology,

        drainageCapacityAvailable:
          factors.drainage_capacity
            ?.available === true
      },

      maxCompositeScore,

      horizons,

      errors:
        base?.errors || []
    };

    window.RG32 =
      window.RG32 || {};

    window.RG32.latestCompositeFloodRisk =
      result;

    window.dispatchEvent(
      new CustomEvent(
        "rainguard:composite-flood-risk-ready",
        {
          detail: result
        }
      )
    );

    return result;
  }

  function getStatus() {
    return {
      engine: NAME,
      version: VERSION,

      ready: true,

      horizons: [...HORIZONS],

      preliminary: true,

      locallyCalibrated: false,

      confirmedFloodPrediction: false
    };
  }

  const api = {
    name: NAME,
    version: VERSION,

    evaluateCity,
    getStatus
  };

  window[NAME] = api;

  window.RG32 =
    window.RG32 || {};

  window.RG32.FloodRiskHydrologicalComposite =
    api;

  console.log(
    NAME,
    VERSION,
    "ready"
  );
})();
