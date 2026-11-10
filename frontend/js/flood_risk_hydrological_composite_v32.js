
/*
 RainGuard AI V32
 FORECAST-1J10.0

 Preliminary Rainfall + Hydrology Composite

 IMPORTANT:
 - Experimental screening only.
 - NOT a confirmed flood forecast.
 - NOT a flood probability.
 - NOT locally calibrated.
 - Missing values remain null.
 - Do not use for operational safety decisions.
*/

(function () {
  "use strict";

  const NAME = "FloodRiskHydrologicalCompositeV32";
  const VERSION = "FORECAST-1J10.1";

  const HORIZONS = [6, 12, 24, 48, 72];

  const RAIN_WEIGHT = 0.60;
  const HYDRO_WEIGHT = 0.40;

  // Provisional weights, not locally calibrated.
  const WEIGHTS = Object.freeze({
    terrain: 0.08,
    slope: 0.16,
    wadi_proximity: 0.24,
    drainage_capacity: 0.20,
    soil_moisture: 0.16,
    land_cover: 0.16
  });

  const KEYS = Object.keys(WEIGHTS);

  const finite = v =>
    v !== null &&
    v !== undefined &&
    v !== "" &&
    typeof v !== "boolean" &&
    Number.isFinite(Number(v));

  const round = v =>
    Math.round(v * 10) / 10;

  const clamp = (v, lo = 0, hi = 100) =>
    Math.max(lo, Math.min(hi, v));

  const validScore = v =>
    finite(v) &&
    Number(v) >= 0 &&
    Number(v) <= 100;

  const normalized = obj =>
    obj?.available === true && finite(obj.value)
      ? Number(obj.value)
      : null;

  // -----------------------------------------
  // 1. Calculate hydrological factor scores
  // -----------------------------------------

  function factorScores(factors = {}) {

    const elevation =
      normalized(factors.terrain);

    const slope =
      normalized(factors.slope);

    const wadi =
      normalized(factors.wadi_proximity);

    const moisture =
      normalized(factors.soil_moisture);

    const cover =
      normalized(factors.land_cover);

    const drainage =
      normalized(factors.drainage_capacity);

    const coverMap = {
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

    /*
     These transforms are experimental.

     Drainage capacity must be supplied as
     an explicitly documented risk score
     between 0 and 100.

     Raw capacity in m3/s must not be
     treated as a risk score.
    */

    const drainageIsScore =
      factors.drainage_capacity?.unit ===
        "risk_score_0_100" ||
      factors.drainage_capacity?.valueType ===
        "risk_score_0_100";

    return {

      terrain:
        elevation !== null && elevation >= 0
          ? round(clamp(100 - elevation))
          : null,

      slope:
        slope !== null && slope >= 0
          ? round(clamp(slope / 15 * 100))
          : null,

      wadi_proximity:
        wadi !== null && wadi >= 0
          ? round(
              clamp(
                ((3000 - wadi) / 3000) * 100
              )
            )
          : null,

      drainage_capacity:
        drainageIsScore && validScore(drainage)
          ? round(drainage)
          : null,

      soil_moisture:
        moisture !== null &&
        moisture >= 0 &&
        moisture <= 1
          ? round(
              clamp(
                (moisture / 0.45) * 100
              )
            )
          : null,

      land_cover:
        cover !== null
          ? (coverMap[cover] ?? null)
          : null
    };
  }

  // -----------------------------------------
  // 2. Weighted hydrological calculation
  // -----------------------------------------

  function weightedHydrology(
    scores,
    weights = WEIGHTS
  ) {

    let sum = 0;
    let availableWeight = 0;

    for (const key of KEYS) {

      if (validScore(scores[key])) {

        sum +=
          Number(scores[key]) * weights[key];

        availableWeight += weights[key];
      }
    }

    return {

      score:
        availableWeight > 0
          ? round(sum / availableWeight)
          : null,

      availableWeight:
        round(availableWeight),

      missingWeight:
        round(1 - availableWeight),

      factorScores: scores
    };
  }

  // -----------------------------------------
  // 3. Find forecast horizon
  // -----------------------------------------

  function getHorizon(horizons, hours) {

    if (Array.isArray(horizons)) {

      return horizons.find(h =>
        Number(h?.horizonHours) === hours ||
        h?.period === `${hours}h` ||
        h?.horizon === `${hours}h`
      ) || null;
    }

    return (
      horizons?.[`${hours}h`] ||
      horizons?.[hours] ||
      null
    );
  }

  // -----------------------------------------
  // 4. Extract rainfall score
  // -----------------------------------------

  function rainfallScore(rain) {

    const allowedStatuses = [
      "PRELIMINARY_RISK_READY",
      "PRELIMINARY_FLOOD_RISK_READY"
    ];

    if (!allowedStatuses.includes(rain?.status)) {
      return null;
    }

    const value =
      rain.rainfallRiskScore ??
      rain.riskScore;

    return validScore(value)
      ? Number(value)
      : null;
  }

  // -----------------------------------------
  // 5. Combine rainfall and hydrology
  // -----------------------------------------

  function combineHorizon(
    rain,
    hydro,
    quality
  ) {

    const rainScore =
      rainfallScore(rain);

    const hydroScore =
      hydro.score;

    const available =
      rainScore !== null &&
      hydroScore !== null;

    // Static hydrological susceptibility is not an active rainfall event.
    // A verified zero rainfall score must not produce positive composite risk.
    // Missing rainfall data still yields null, never a fabricated zero.
    const compositeScore = available
      ? (rainScore === 0
          ? 0
          : round(
              clamp(
                rainScore * RAIN_WEIGHT +
                hydroScore * HYDRO_WEIGHT
              )
            ))
      : null;

    return {

      status: available
        ? "PRELIMINARY_COMPOSITE_READY"
        : "INSUFFICIENT_COMPOSITE_DATA",

      rainfallStatus:
        rain?.status ?? null,

      rainfallScore:
        rainScore === null
          ? null
          : round(rainScore),

      hydrologicalScore:
        hydroScore,

      compositeScore,

      dataCompletenessPercent:
        quality.factorCompletenessPercent,

      drainageCapacityAvailable:
        quality.drainageCapacityAvailable,

      qualityStatus:
        quality.status,

      confirmedFloodPrediction: false,

      locallyCalibrated: false
    };
  }

  // -----------------------------------------
  // 6. Sensitivity analysis
  // -----------------------------------------

  function sensitivity(
    scores,
    rainfallScores
  ) {

    /*
     Change each available factor weight
     by -20% and +20%.

     This is not a confidence interval
     and does not validate the model.
    */

    const variants = [];

    for (const key of KEYS) {

      if (!validScore(scores[key])) {
        continue;
      }

      for (const multiplier of [0.8, 1.2]) {

        const weights = {
          ...WEIGHTS,
          [key]: WEIGHTS[key] * multiplier
        };

        const hydro =
          weightedHydrology(scores, weights);

        for (
          const [period, rain]
          of Object.entries(rainfallScores)
        ) {

          if (
            rain === null ||
            hydro.score === null
          ) {
            continue;
          }

          variants.push({

            factor: key,

            multiplier,

            period,

            compositeScore: rain === 0
              ? 0
              : round(
                  clamp(
                    rain * RAIN_WEIGHT +
                    hydro.score * HYDRO_WEIGHT
                  )
                )
          });
        }
      }
    }

    const byHorizon = {};

    for (
      const period of
      HORIZONS.map(h => `${h}h`)
    ) {

      const values = variants
        .filter(v => v.period === period)
        .map(v => v.compositeScore);

      byHorizon[period] = values.length
        ? {
            min: Math.min(...values),
            max: Math.max(...values),
            testedVariants: values.length
          }
        : null;
    }

    return {

      method:
        "one_factor_weight_perturbation_plus_minus_20_percent",

      byHorizon,

      warning:
        "Sensitivity range is NOT a confidence interval or validated forecast uncertainty."
    };
  }

  // -----------------------------------------
  // 7. Main city evaluation
  // -----------------------------------------

  async function evaluateCity(city = {}) {

    const fusion =
      window.FloodRiskHydrologicalFusionV32;

    if (
      typeof fusion?.evaluateCity !== "function"
    ) {

      return {

        engine: NAME,

        version: VERSION,

        city:
          city.name || "Unknown",

        status:
          "HYDROLOGICAL_FUSION_UNAVAILABLE",

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

    const rainfallHorizons =
      base?.rainfall?.horizons ||
      base?.rainfallResult?.horizons ||
      base?.floodRisk?.horizons ||
      base?.horizons ||
      {};

    // Identify unavailable factors.
    const missingFactors =
      KEYS.filter(
        key => !validScore(scores[key])
      );

    // Data completeness is separate
    // from the calculated risk score.
    const factorCompletenessPercent =
      round(
        100 *
        (KEYS.length - missingFactors.length) /
        KEYS.length
      );

    const drainageCapacityAvailable =
      validScore(scores.drainage_capacity);

    const quality = {

      status:
        missingFactors.length
          ? "PARTIAL_HYDROLOGICAL_DATA"
          : "ALL_FACTORS_PRESENT_UNVALIDATED",

      factorCompletenessPercent,

      availableWeight:
        hydro.availableWeight,

      missingWeight:
        hydro.missingWeight,

      missingFactors,

      drainageCapacityAvailable,

      sourceCompletenessPercent:
        finite(hydrology.completenessPercent)
          ? Number(hydrology.completenessPercent)
          : null,

      locallyValidated: false
    };

    const horizons = {};
    const rainfallScores = {};

    for (const hours of HORIZONS) {

      const period = `${hours}h`;

      const rain =
        getHorizon(
          rainfallHorizons,
          hours
        );

      rainfallScores[period] =
        rainfallScore(rain);

      horizons[period] = {

        horizonHours: hours,

        ...combineHorizon(
          rain,
          hydro,
          quality
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
            ...ready.map(
              h => h.compositeScore
            )
          )
        : null;

    // -------------------------------------
    // 8. Final result
    // -------------------------------------

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

        hydrologyFactorWeights: {
          ...WEIGHTS
        },

        scoreIsProbability: false,

        locallyCalibrated: false,

        confirmedFloodPrediction: false,

        historicalValidationStatus:
          "NOT_VALIDATED",

        warning:
          "Do not use as an operational flood warning or probability."
      },

      dataQuality:
        quality,

      hydrology: {

        completenessPercent:
          quality.sourceCompletenessPercent,

        factorCompletenessPercent,

        availableWeight:
          hydro.availableWeight,

        missingWeight:
          hydro.missingWeight,

        score:
          hydro.score,

        factorScores:
          scores,

        missingFactors,

        drainageCapacityAvailable
      },

      maxCompositeScore,

      sensitivity:
        sensitivity(
          scores,
          rainfallScores
        ),

      horizons,

      errors:
        Array.isArray(base?.errors)
          ? base.errors
          : []
    };

    // -------------------------------------
    // 9. Publish result
    // -------------------------------------

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

  // -----------------------------------------
  // 10. Engine status
  // -----------------------------------------

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
