
/* =========================================================
   RainGuard AI V32
   FORECAST-1J8.0
   Hydrological Data Completion

   Soil moisture: Open-Meteo forecast model
   Land cover: Verified external classification only
   Drainage: Unavailable until engineering data exists

   No synthetic data.
   No modification of flood risk scores.
   ========================================================= */

(function () {
  "use strict";

  const NAME = "HydrologicalDataCompletionV32";
  const VERSION = "FORECAST-1J8.0";

  const SOIL_API =
    "https://api.open-meteo.com/v1/forecast";

  // Leave empty until a verified classification API is ready.
  // It must return an ESA WorldCover class code.
  const LAND_COVER_API = "";

  const WORLD_COVER_CLASSES = {
    10: "Tree cover",
    20: "Shrubland",
    30: "Grassland",
    40: "Cropland",
    50: "Built-up",
    60: "Bare or sparse vegetation",
    70: "Snow and ice",
    80: "Permanent water bodies",
    90: "Herbaceous wetland",
    95: "Mangroves",
    100: "Moss and lichen"
  };

  const validNumber = v =>
    v !== null &&
    v !== undefined &&
    v !== "" &&
    Number.isFinite(Number(v));

  function unavailable(reason) {
    return {
      available: false,
      value: null,
      unit: null,
      source: null,
      quality: null,
      metadata: { reason }
    };
  }

  function coordinates(city) {
    const lat = city?.lat ?? city?.latitude;
    const lon =
      city?.lon ?? city?.lng ?? city?.longitude;

    if (
      !validNumber(lat) ||
      !validNumber(lon) ||
      Number(lat) < -90 ||
      Number(lat) > 90 ||
      Number(lon) < -180 ||
      Number(lon) > 180
    ) {
      throw new Error("INVALID_CITY_COORDINATES");
    }

    return {
      lat: Number(lat),
      lon: Number(lon)
    };
  }

  async function fetchJSON(url) {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      12000
    );

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error("HTTP_" + response.status);
      }

      return await response.json();
    } finally {
      clearTimeout(timeout);
    }
  }

  async function collectSoilMoisture(city) {
    try {
      const { lat, lon } = coordinates(city);

      const url = new URL(SOIL_API);

      url.searchParams.set("latitude", lat);
      url.searchParams.set("longitude", lon);
      url.searchParams.set(
        "hourly",
        "soil_moisture_0_to_1cm"
      );
      url.searchParams.set("forecast_days", "2");
      url.searchParams.set("timezone", "GMT");

      const data = await fetchJSON(url);

      const times = data?.hourly?.time;
      const values =
        data?.hourly?.soil_moisture_0_to_1cm;

      if (
        !Array.isArray(times) ||
        !Array.isArray(values) ||
        times.length !== values.length
      ) {
        return unavailable("SOIL_SERIES_UNAVAILABLE");
      }

      const now = Date.now();
      const candidates = [];

      for (let i = 0; i < times.length; i++) {
        const timestamp = Date.parse(
          times[i] + "Z"
        );

        const value = values[i];

        if (
          Number.isFinite(timestamp) &&
          validNumber(value) &&
          Number(value) >= 0 &&
          Number(value) <= 1
        ) {
          candidates.push({
            timestamp,
            value: Number(value),
            time: times[i]
          });
        }
      }

      if (!candidates.length) {
        return unavailable("NO_VALID_SOIL_VALUES");
      }

      candidates.sort(
        (a, b) =>
          Math.abs(a.timestamp - now) -
          Math.abs(b.timestamp - now)
      );

      const nearest = candidates[0];
      const ageHours =
        Math.abs(nearest.timestamp - now) / 3600000;

      if (ageHours > 3) {
        return unavailable("SOIL_FORECAST_TIME_MISMATCH");
      }

      return {
        available: true,
        value: nearest.value,
        unit: "m3/m3",
        source: "Open-Meteo Forecast API",
        quality: "MODEL_ESTIMATE",
        metadata: {
          depth: "0-1 cm",
          validTimeUTC:
            new Date(nearest.timestamp).toISOString(),
          model: data?.model ?? null,
          modelRun: null,
          dataType: "forecast_model",
          locallyValidated: false
        }
      };

    } catch (error) {
      return unavailable(
        "SOIL_FETCH_FAILED: " +
        String(error?.message ?? error)
      );
    }
  }

  async function collectLandCover(city) {
    if (!LAND_COVER_API) {
      return unavailable(
        "ESA_WORLDCOVER_CLASSIFICATION_API_NOT_CONFIGURED"
      );
    }

    try {
      const { lat, lon } = coordinates(city);
      const url = new URL(LAND_COVER_API);

      url.searchParams.set("lat", lat);
      url.searchParams.set("lon", lon);

      const data = await fetchJSON(url);

      const code = Number(data?.classCode);

      if (
        !data ||
        !Object.prototype.hasOwnProperty.call(
          WORLD_COVER_CLASSES,
          code
        ) ||
        data.dataset !== "ESA_WORLDCOVER_2021_V200"
      ) {
        return unavailable(
          "LAND_COVER_CLASSIFICATION_NOT_VERIFIED"
        );
      }

      return {
        available: true,
        value: code,
        unit: "ESA WorldCover class code",
        source: "ESA WorldCover 2021 v200",
        quality: "SATELLITE_CLASSIFICATION",
        metadata: {
          label: WORLD_COVER_CLASSES[code],
          datasetYear: 2021,
          locallyValidated: false,
          spatialRepresentativeness:
            "Single raster pixel; not a catchment average"
        }
      };

    } catch (error) {
      return unavailable(
        "LAND_COVER_FETCH_FAILED: " +
        String(error?.message ?? error)
      );
    }
  }

  async function collect(city = {}) {
    const [soil, land] = await Promise.all([
      collectSoilMoisture(city),
      collectLandCover(city)
    ]);

    return {
      engine: NAME,
      version: VERSION,
      status:
        soil.available || land.available
          ? "HYDROLOGY_ENRICHMENT_PARTIAL"
          : "HYDROLOGY_ENRICHMENT_UNAVAILABLE",

      generatedAt: new Date().toISOString(),

      evidence: {
        soil_moisture: soil,
        land_cover: land,
        drainage_capacity: unavailable(
          "VERIFIED_ENGINEERING_DRAINAGE_DATA_REQUIRED"
        )
      },

      limitations: {
        syntheticDataAllowed: false,
        floodPredictionConfirmed: false,
        hydrologicalCalibrationComplete: false
      }
    };
  }

  // Extend the existing provider without replacing its
  // terrain, slope or wadi calculations.
  function install() {
    const provider =
      window.HydrologicalDataProviderBridgeV32;

    if (typeof provider?.collect !== "function") {
      return {
        installed: false,
        reason: "BASE_PROVIDER_NOT_READY"
      };
    }

    if (provider.__forecast1j8Installed === true) {
      return {
        installed: true,
        reason: "ALREADY_INSTALLED"
      };
    }

    const originalCollect =
      provider.collect.bind(provider);

    provider.collect = async function (city) {
      const [base, enrichment] =
        await Promise.allSettled([
          originalCollect(city),
          collect(city)
        ]);

      if (base.status !== "fulfilled") {
        throw base.reason;
      }

      const result = base.value;

      if (!result || typeof result !== "object") {
        throw new Error(
          "INVALID_BASE_HYDROLOGY_RESULT"
        );
      }

      const extra =
        enrichment.status === "fulfilled"
          ? enrichment.value
          : null;

      const evidence = {
        ...(result.evidence || {})
      };

      for (const factor of [
        "soil_moisture",
        "land_cover"
      ]) {
        const existing = evidence[factor];
        const incoming = extra?.evidence?.[factor];

        if (
          existing?.available !== true &&
          incoming?.available === true
        ) {
          evidence[factor] = incoming;
        }
      }

      const factors = [
        "terrain",
        "slope",
        "wadi_proximity",
        "drainage_capacity",
        "soil_moisture",
        "land_cover"
      ];

      const availableFactors = factors.filter(
        f =>
          evidence[f]?.available === true &&
          validNumber(evidence[f]?.value)
      );

      const missingFactors = factors.filter(
        f => !availableFactors.includes(f)
      );

      const contextLayer =
        window.HydrologicalContextLayerV32;

      let context = result.context ?? null;

      if (typeof contextLayer?.build === "function") {
        try {
          context = contextLayer.build(city, evidence);
        } catch (error) {
          console.warn(
            "FORECAST-1J8_CONTEXT_BUILD_FAILED",
            error
          );
        }
      }

      const completed = {
        ...result,

        status:
          missingFactors.length === 0
            ? "REAL_HYDROLOGICAL_DATA_COMPLETE"
            : availableFactors.length > 0
              ? "REAL_HYDROLOGICAL_DATA_PARTIAL"
              : "REAL_HYDROLOGICAL_DATA_UNAVAILABLE",

        evidence,
        context,

        completion: {
          version: VERSION,
          availableFactors,
          missingFactors,
          completenessPercent: Math.round(
            100 * availableFactors.length /
            factors.length
          ),
          enrichmentStatus:
            extra?.status ?? "ENRICHMENT_FAILED"
        }
      };

      window.RG32 = window.RG32 || {};
      window.RG32.latestHydrologicalProviderResult =
        completed;

      return completed;
    };

    Object.defineProperty(
      provider,
      "__forecast1j8Installed",
      {
        value: true,
        configurable: false
      }
    );

    return {
      installed: true,
      reason: "PROVIDER_ENRICHMENT_ENABLED"
    };
  }

  const api = Object.freeze({
    name: NAME,
    version: VERSION,
    collect,
    collectSoilMoisture,
    collectLandCover,
    install,
    getStatus: () => ({
      engine: NAME,
      version: VERSION,
      installed:
        window.HydrologicalDataProviderBridgeV32
          ?.__forecast1j8Installed === true,
      soilSource: "Open-Meteo",
      landCoverConfigured: !!LAND_COVER_API,
      drainageConfigured: false,
      confirmedFloodPrediction: false
    })
  });

  window.HydrologicalDataCompletionV32 = api;

  console.log(NAME, VERSION, install());

})();
