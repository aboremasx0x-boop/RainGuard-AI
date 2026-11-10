
/* =========================================================
   RainGuard AI V32
   FORECAST-1J7.0
   Hydrological Evidence Fusion

   Rainfall + Terrain + Slope + Wadi Proximity

   This is preliminary screening only.
   No confirmed flood prediction.
   No uncalibrated combined risk score.
   ========================================================= */

(function () {
  "use strict";

  const NAME = "FloodRiskHydrologicalFusionV32";
  const VERSION = "FORECAST-1J7.0";

  const FACTORS = [
    "terrain",
    "slope",
    "wadi_proximity",
    "drainage_capacity",
    "soil_moisture",
    "land_cover"
  ];

  const HORIZONS = [6, 12, 24, 48, 72];

  const isFiniteNumber = v =>
    v !== null &&
    v !== undefined &&
    v !== "" &&
    Number.isFinite(Number(v));

  function normalizeCity(city) {
    const lat = city?.lat ?? city?.latitude;
    const lon = city?.lon ?? city?.lng ?? city?.longitude;

    if (
      !isFiniteNumber(lat) ||
      !isFiniteNumber(lon) ||
      Number(lat) < -90 ||
      Number(lat) > 90 ||
      Number(lon) < -180 ||
      Number(lon) > 180
    ) {
      throw new Error("INVALID_CITY_COORDINATES");
    }

    return {
      ...city,
      name:
        city?.name ||
        city?.nameAr ||
        city?.city ||
        "Unknown",
      lat: Number(lat),
      lon: Number(lon)
    };
  }

  function normalizeFactor(raw) {
    const available =
      raw?.available === true &&
      isFiniteNumber(raw?.value);

    return {
      available,
      value: available ? Number(raw.value) : null,
      unit: available ? raw.unit ?? null : null,
      source: available ? raw.source ?? null : null,
      quality: available ? raw.quality ?? null : null,
      metadata: available ? raw.metadata ?? null : null
    };
  }

  function buildHydrology(providerResult) {
    const evidence = providerResult?.evidence ?? {};
    const factors = {};

    for (const factor of FACTORS) {
      factors[factor] = normalizeFactor(
        evidence[factor]
      );
    }

    const availableFactors = FACTORS.filter(
      f => factors[f].available
    );

    const missingFactors = FACTORS.filter(
      f => !factors[f].available
    );

    return {
      status:
        availableFactors.length === FACTORS.length
          ? "HYDROLOGICAL_EVIDENCE_COMPLETE"
          : availableFactors.length > 0
            ? "HYDROLOGICAL_EVIDENCE_PARTIAL"
            : "HYDROLOGICAL_EVIDENCE_UNAVAILABLE",

      providerStatus:
        providerResult?.status ?? "PROVIDER_NO_RESULT",

      availableFactors,
      missingFactors,

      completenessPercent: Math.round(
        100 * availableFactors.length / FACTORS.length
      ),

      factors,
      locallyCalibrated: false
    };
  }

  function normalizeRainfall(rainResult) {
    const horizons = {};

    for (const hours of HORIZONS) {
      const key = `${hours}h`;
      const h = rainResult?.horizons?.[key];

      const valid =
        h?.status === "PRELIMINARY_RISK_READY" &&
        isFiniteNumber(h?.riskScore);

      horizons[key] = {
        status: valid
          ? h.status
          : "INSUFFICIENT_FORECAST_DATA",

        rainfallRiskScore: valid
          ? Number(h.riskScore)
          : null,

        rainfallRiskLevel: valid
          ? h.riskLevel ?? null
          : null,

        rainfallEvidence: h?.evidence ?? null,

        rainfallLimitations:
          h?.limitations ?? null,

        combinedFloodRiskScore: null,
        combinedFloodRiskLevel: null,

        confirmedFloodPrediction: false
      };
    }

    return horizons;
  }

  function makeResult(
    city,
    rainfallResult,
    providerResult,
    errors
  ) {
    const hydrology = buildHydrology(providerResult);
    const horizons = normalizeRainfall(rainfallResult);

    const rainfallReady = Object.values(
      horizons
    ).some(h => h.rainfallRiskScore !== null);

    return {
      engine: NAME,
      version: VERSION,

      status: rainfallReady
        ? hydrology.availableFactors.length > 0
          ? "PRELIMINARY_RAINFALL_WITH_HYDROLOGY_CONTEXT"
          : "PRELIMINARY_RAINFALL_ONLY"
        : "INSUFFICIENT_FORECAST_DATA",

      city: city.name,
      lat: city.lat,
      lon: city.lon,

      generatedAt: new Date().toISOString(),

      sourceVersions: {
        rainfall: rainfallResult?.version ?? null,
        hydrology: providerResult?.version ?? null
      },

      rainfall: {
        status:
          rainfallResult?.status ?? "UNAVAILABLE",

        maxRiskScore:
          rainfallReady &&
          isFiniteNumber(rainfallResult?.maxRiskScore)
            ? Number(rainfallResult.maxRiskScore)
            : null,

        highestRisk: rainfallReady
          ? rainfallResult?.highestRisk ?? null
          : null
      },

      hydrology,
      horizons,

      methodology: {
        type:
          "rainfall_screening_plus_observed_hydrological_context",

        rainfallDrivenOnlyScore: true,
        hydrologyUsedInRiskScore: false,
        locallyCalibrated: false,
        confirmedFloodPrediction: false,

        note:
          "Hydrological evidence is displayed separately. " +
          "Rainfall risk scores are unchanged. " +
          "No combined flood risk score is issued " +
          "without calibration."
      },

      errors
    };
  }

  async function evaluateCity(city = {}) {
    const c = normalizeCity(city);

    const rainEngine =
      window.FloodRiskEngineV32;

    const hydroProvider =
      window.HydrologicalDataProviderBridgeV32;

    const errors = [];

    const [rainSettled, hydroSettled] =
      await Promise.allSettled([

        typeof rainEngine?.evaluateCity === "function"
          ? rainEngine.evaluateCity(c)
          : Promise.reject(
              new Error("RAINFALL_ENGINE_UNAVAILABLE")
            ),

        typeof hydroProvider?.collect === "function"
          ? hydroProvider.collect(c)
          : Promise.reject(
              new Error("HYDROLOGY_PROVIDER_UNAVAILABLE")
            )

      ]);

    const rainfallResult =
      rainSettled.status === "fulfilled"
        ? rainSettled.value
        : null;

    const providerResult =
      hydroSettled.status === "fulfilled"
        ? hydroSettled.value
        : null;

    if (rainSettled.status === "rejected") {
      errors.push({
        component: "rainfall",
        message: String(
          rainSettled.reason?.message ??
          rainSettled.reason
        )
      });
    }

    if (hydroSettled.status === "rejected") {
      errors.push({
        component: "hydrology",
        message: String(
          hydroSettled.reason?.message ??
          hydroSettled.reason
        )
      });
    }

    const result = makeResult(
      c,
      rainfallResult,
      providerResult,
      errors
    );

    window.RG32 = window.RG32 || {};

    window.RG32.latestHydrologicalFusion = result;

    window.dispatchEvent(
      new CustomEvent(
        "rainguard:hydrological-fusion-ready",
        { detail: result }
      )
    );

    return result;
  }

  function getStatus() {
    return {
      engine: NAME,
      version: VERSION,

      ready:
        typeof window.FloodRiskEngineV32
          ?.evaluateCity === "function" &&
        typeof window.HydrologicalDataProviderBridgeV32
          ?.collect === "function",

      horizons: [...HORIZONS],

      hydrologyUsedInRiskScore: false,
      locallyCalibrated: false,
      confirmedFloodPrediction: false
    };
  }

  const api = Object.freeze({
    name: NAME,
    version: VERSION,
    evaluateCity,
    getStatus
  });

  window.FloodRiskHydrologicalFusionV32 = api;

  window.RG32 = window.RG32 || {};
  window.RG32.HydrologicalFusion = api;

  console.log(
    NAME + " " + VERSION +
    " ready (evidence-only; no score modification)."
  );

})();
