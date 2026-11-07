
/* RainGuard AI V30 - Open-Meteo Forecast Adapter
 * Corrected version: 30.0.2
 * File: frontend/js/openmeteo_adapter_v30.js
 * Forecasts are model estimates, not official warnings.
 */

window.RG30 = window.RG30 || {};

RG30.OpenMeteoAdapter = {
  version: "30.0.2",
  initialized: false,

  lastRequestAt: null,
  lastSuccessAt: null,
  lastFailureAt: null,
  lastError: null,

  cache: new Map(),

  config: {
    enabled: true,
    endpoint: "https://api.open-meteo.com/v1/forecast",
    timezone: "Asia/Riyadh",
    timeoutMs: 15000,
    cacheMinutes: 10,
    forecastDays: 4,
    defaultReliability: 0.80,

    hourlyVariables: [
      "temperature_2m",
      "relative_humidity_2m",
      "precipitation_probability",
      "precipitation",
      "rain",
      "cloud_cover",
      "wind_speed_10m",
      "wind_direction_10m",
      "weather_code"
    ],

    currentVariables: [
      "temperature_2m",
      "relative_humidity_2m",
      "precipitation",
      "rain",
      "cloud_cover",
      "wind_speed_10m",
      "wind_direction_10m",
      "weather_code"
    ]
  },

  init() {
    if (this.initialized) return;

    this.initialized = true;

    console.log(
      `RG30 Open-Meteo Adapter ${this.version} initialized.`
    );

    window.dispatchEvent(
      new CustomEvent("rg30:openmeteo-adapter-ready", {
        detail: {
          version: this.version,
          endpoint: this.config.endpoint,
          timestamp: new Date().toISOString()
        }
      })
    );
  },

  configure(options = {}) {
    if (
      !options ||
      typeof options !== "object" ||
      Array.isArray(options)
    ) {
      return false;
    }

    const old = JSON.stringify(this.config);

    this.config = {
      ...this.config,
      ...options
    };

    if (old !== JSON.stringify(this.config)) {
      this.clearCache();
    }

    return true;
  },

  isConfigured() {
    return Boolean(
      this.config.enabled &&
      this.config.endpoint
    );
  },

  async collect(city = {}) {
    const normalizedCity = this.normalizeCity(city);

    if (!this.config.enabled) {
      return this.createUnavailableResult(
        normalizedCity,
        "DISABLED",
        "Open-Meteo adapter is disabled."
      );
    }

    if (!this.isConfigured()) {
      return this.createUnavailableResult(
        normalizedCity,
        "UNAVAILABLE",
        "OPENMETEO_ENDPOINT_NOT_CONFIGURED"
      );
    }

    if (!this.validCoordinates(normalizedCity)) {
      return this.createUnavailableResult(
        normalizedCity,
        "UNAVAILABLE",
        "INVALID_CITY_COORDINATES"
      );
    }

    const cached = this.getCachedResult(normalizedCity);

    if (cached) {
      return {
        ...cached,
        fromCache: true
      };
    }

    this.lastRequestAt = new Date().toISOString();

    const startedAt = Date.now();

    try {
      const payload = await this.fetchForecast(normalizedCity);

      const normalized = this.normalizeForecastResponse(
        payload,
        normalizedCity
      );

      if (!normalized.hasWeatherData) {
        throw new Error("OPENMETEO_NO_VALID_WEATHER_DATA");
      }

      const fetchedAt = new Date().toISOString();

      const result = {
        sourceKey: "openMeteo",
        sourceName: "Open-Meteo",
        provider: "Open-Meteo Forecast API",

        available: true,
        ok: true,
        official: false,
        status: "AVAILABLE",

        city: normalizedCity.name,
        lat: normalizedCity.lat,
        lon: normalizedCity.lon,
        region: normalizedCity.region,

        timestamp: normalized.forecastValidTime,
        forecastValidTime: normalized.forecastValidTime,
        fetchedAt,

        ageMinutes: 0,

        forecastAgeMinutes: this.calculateAgeMinutes(
          normalized.forecastValidTime
        ),

        reliability: this.config.defaultReliability,
        trust: this.config.defaultReliability,

        rainProbability: normalized.rainProbability,
        rainAmount: normalized.rainAmount,

        currentRainProbability:
          normalized.currentRainProbability,

        currentRainAmount:
          normalized.currentRainAmount,

        forecastRainProbability6h:
          normalized.forecastRainProbability6h,

        forecastRainAmount6h:
          normalized.forecastRainAmount6h,

        rainDataAvailable:
          normalized.rainDataAvailable,

        rainDataComplete6h:
          normalized.rainDataComplete6h,

        signalScore: normalized.signalScore,
        confidence: normalized.confidence,

        warningLevel: normalized.warningLevel,
        weatherCondition: normalized.weatherCondition,

        temperature: normalized.temperature,
        humidity: normalized.humidity,
        cloudCover: normalized.cloudCover,
        windSpeed: normalized.windSpeed,
        windDirection: normalized.windDirection,

        forecastWindows: normalized.forecastWindows,

        details: {
          currentWeatherCode: normalized.weatherCode,

          currentWeatherText: this.weatherCodeToText(
            normalized.weatherCode
          ),

          modelLatitude: payload.latitude,
          modelLongitude: payload.longitude,
          elevation: payload.elevation,

          timezone: payload.timezone,
          utcOffsetSeconds: payload.utc_offset_seconds,

          responseTimeMs: Date.now() - startedAt,

          humidity: normalized.humidity,
          cloudCover: normalized.cloudCover,
          windSpeed: normalized.windSpeed,
          windDirection: normalized.windDirection,

          currentTemperature: normalized.temperature,

          hourlySampleCount:
            normalized.hourlySampleCount,

          rainDataAvailable:
            normalized.rainDataAvailable,

          rainDataComplete6h:
            normalized.rainDataComplete6h,

          currentRainAmount:
            normalized.currentRainAmount,

          forecastRainAmount6h:
            normalized.forecastRainAmount6h,

          fetchedAt,

          forecastValidTime:
            normalized.forecastValidTime
        },

        raw: payload,
        error: null
      };

      this.lastSuccessAt = fetchedAt;
      this.lastError = null;

      this.setCachedResult(normalizedCity, result);
      this.publishSuccess(result);

      return result;

    } catch (error) {
      this.lastFailureAt = new Date().toISOString();

      this.lastError =
        error?.message || String(error);

      console.warn(
        "RG30 Open-Meteo Adapter request failed:",
        error
      );

      const failure = this.createUnavailableResult(
        normalizedCity,
        "UNAVAILABLE",
        this.lastError
      );

      this.publishFailure(failure);

      return failure;
    }
  },

  async fetchForecast(city) {
    const params = new URLSearchParams({
      latitude: String(city.lat),
      longitude: String(city.lon),
      timezone: this.config.timezone,

      forecast_days: String(
        this.config.forecastDays
      ),

      current: this.config.currentVariables.join(","),
      hourly: this.config.hourlyVariables.join(",")
    });

    const response = await this.fetchWithTimeout(
      `${this.config.endpoint}?${params}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json"
        }
      },
      this.config.timeoutMs
    );

    if (!response.ok) {
      throw new Error(
        `OPENMETEO_HTTP_${response.status}`
      );
    }

    const contentType =
      response.headers?.get("content-type") || "";

    if (!contentType.toLowerCase().includes("json")) {
      throw new Error(
        "OPENMETEO_INVALID_CONTENT_TYPE"
      );
    }

    const payload = await response.json();

    if (
      !payload ||
      typeof payload !== "object" ||
      payload.error === true
    ) {
      throw new Error(
        payload?.reason || "OPENMETEO_API_ERROR"
      );
    }

    return payload;
  },

  // Convert model-local time to UTC.
  parseModelTime(value, utcOffsetSeconds = 0) {
    if (
      typeof value !== "string" ||
      !value.trim()
    ) {
      return null;
    }

    const s = value.trim();

    if (/[zZ]$|[+-]\d\d:\d\d$/.test(s)) {
      const t = Date.parse(s);

      return Number.isFinite(t)
        ? new Date(t).toISOString()
        : null;
    }

    const match = s.match(
      /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/
    );

    if (!match) return null;

    const [, y, mo, d, h, mi, sec] = match;

    const offset = this.safeNumber(
      utcOffsetSeconds,
      null
    );

    if (
      offset === null ||
      Math.abs(offset) > 86400
    ) {
      return null;
    }

    const wallTime = Date.UTC(
      +y,
      +mo - 1,
      +d,
      +h,
      +mi,
      +(sec || 0)
    );

    const check = new Date(wallTime);

    if (
      check.getUTCFullYear() !== +y ||
      check.getUTCMonth() !== +mo - 1 ||
      check.getUTCDate() !== +d ||
      check.getUTCHours() !== +h ||
      check.getUTCMinutes() !== +mi
    ) {
      return null;
    }

    return new Date(
      wallTime - offset * 1000
    ).toISOString();
  },

  normalizeForecastResponse(payload = {}, city = {}) {
    const current = payload.current || {};
    const hourly = payload.hourly || {};

    const times = Array.isArray(hourly.time)
      ? hourly.time
      : [];

    const offset = this.safeNumber(
      payload.utc_offset_seconds,
      0
    );

    const startIndex = this.findCurrentHourIndex(
      times,
      offset
    );

    const at = key => this.getHourlyValue(
      hourly[key],
      startIndex
    );

    const currentRainProbability =
      at("precipitation_probability");

    const currentRainAmount = this.firstNumber(
      current.precipitation,
      at("precipitation"),
      current.rain,
      at("rain")
    );

    const temperature = this.firstNumber(
      current.temperature_2m,
      at("temperature_2m")
    );

    const humidity = this.firstNumber(
      current.relative_humidity_2m,
      at("relative_humidity_2m")
    );

    const cloudCover = this.firstNumber(
      current.cloud_cover,
      at("cloud_cover")
    );

    const windSpeed = this.firstNumber(
      current.wind_speed_10m,
      at("wind_speed_10m")
    );

    const windDirection = this.firstNumber(
      current.wind_direction_10m,
      at("wind_direction_10m")
    );

    const weatherCode = this.firstNumber(
      current.weather_code,
      at("weather_code")
    );

    const forecastWindows = {
      h6: this.calculateWindow(
        hourly,
        startIndex,
        6
      ),

      h24: this.calculateWindow(
        hourly,
        startIndex,
        24
      ),

      h72: this.calculateWindow(
        hourly,
        startIndex,
        72
      )
    };

    const h6 = forecastWindows.h6;

    // Legacy fields use the six-hour forecast
    // when available, not instantaneous rain.
    const rainProbability = this.firstNumber(
      h6.maxProbability,
      currentRainProbability
    );

    const rainAmount = this.firstNumber(
      h6.rainAmount,
      currentRainAmount
    );

    const rainDataAvailable =
      this.isValidNumber(currentRainAmount) ||
      this.isValidNumber(h6.rainAmount);

    const forecastValidTime =
      this.parseModelTime(current.time, offset) ||
      this.parseModelTime(
        times[startIndex],
        offset
      );

    const hasWeatherData = Boolean(
      forecastValidTime &&
      [
        temperature,
        humidity,
        cloudCover,
        windSpeed,
        weatherCode,
        rainAmount,
        rainProbability
      ].some(v => this.isValidNumber(v))
    );

    const signalScore =
      rainDataAvailable ||
      this.isValidNumber(rainProbability)
        ? this.calculateSignalScore({
            rainProbability,
            rainAmount,
            humidity,
            cloudCover,
            weatherCode
          })
        : null;

    const confidence = this.calculateConfidence({
      rainProbability,
      rainAmount,
      humidity,
      cloudCover,
      sampleCount: times.length,
      validRainSamples: h6.validRainSamples,
      expectedRainSamples: 6
    });

    const warningLevel =
      rainDataAvailable ||
      this.isValidNumber(rainProbability)
        ? this.getWarningLevel({
            rainProbability,
            rainAmount,
            signalScore
          })
        : "UNKNOWN";

    return {
      timestamp: forecastValidTime,
      forecastValidTime,

      rainProbability: this.roundOrNull(
        rainProbability,
        0
      ),

      rainAmount: this.roundOrNull(
        rainAmount,
        2
      ),

      currentRainProbability: this.roundOrNull(
        currentRainProbability,
        0
      ),

      currentRainAmount: this.roundOrNull(
        currentRainAmount,
        2
      ),

      forecastRainProbability6h: this.roundOrNull(
        h6.maxProbability,
        0
      ),

      forecastRainAmount6h: this.roundOrNull(
        h6.rainAmount,
        2
      ),

      rainDataAvailable,

      rainDataComplete6h: h6.rainDataComplete,

      signalScore: this.roundOrNull(
        signalScore,
        0
      ),

      confidence: this.roundOrNull(
        confidence,
        0
      ),

      warningLevel,

      weatherCondition: this.weatherCodeToText(
        weatherCode
      ),

      weatherCode,

      temperature: this.roundOrNull(
        temperature,
        1
      ),

      humidity: this.roundOrNull(
        humidity,
        0
      ),

      cloudCover: this.roundOrNull(
        cloudCover,
        0
      ),

      windSpeed: this.roundOrNull(
        windSpeed,
        1
      ),

      windDirection: this.roundOrNull(
        windDirection,
        0
      ),

      forecastWindows,

      hourlySampleCount: times.length,

      hasWeatherData
    };
  },

  calculateWindow(
    hourly = {},
    startIndex = 0,
    hours = 6
  ) {
    const read = key => this.sliceNumericArray(
      hourly[key],
      startIndex,
      hours
    );

    const probabilities = read(
      "precipitation_probability"
    );

    const precipitation = read("precipitation");
    const rain = read("rain");
    const cloudCover = read("cloud_cover");

    const humidity = read(
      "relative_humidity_2m"
    );

    const windSpeed = read("wind_speed_10m");
    const temperatures = read("temperature_2m");

    // Prefer total precipitation per hour.
    // Fill missing entries with rain values.
    const amounts = Array.from(
      { length: hours },
      (_, i) => this.firstNumber(
        precipitation[i],
        rain[i]
      )
    );

    const validRainSamples = amounts.filter(
      v => this.isValidNumber(v)
    ).length;

    const probabilitySamples = probabilities.filter(
      v => this.isValidNumber(v)
    ).length;

    const rainDataComplete =
      validRainSamples === hours;

    return {
      hours,

      maxProbability: this.roundOrNull(
        this.max(probabilities),
        0
      ),

      averageProbability: this.roundOrNull(
        this.average(probabilities),
        0
      ),

      rainAmount: rainDataComplete
        ? this.roundOrNull(
            this.sum(amounts),
            2
          )
        : null,

      partialRainAmount: validRainSamples
        ? this.roundOrNull(
            this.sum(amounts),
            2
          )
        : null,

      maxHourlyRain: this.roundOrNull(
        this.max(amounts),
        2
      ),

      averageCloudCover: this.roundOrNull(
        this.average(cloudCover),
        0
      ),

      averageHumidity: this.roundOrNull(
        this.average(humidity),
        0
      ),

      maxWindSpeed: this.roundOrNull(
        this.max(windSpeed),
        1
      ),

      minTemperature: this.roundOrNull(
        this.min(temperatures),
        1
      ),

      maxTemperature: this.roundOrNull(
        this.max(temperatures),
        1
      ),

      sampleCount: Math.max(
        validRainSamples,
        probabilitySamples
      ),

      validRainSamples,
      probabilitySamples,
      expectedSamples: hours,
      rainDataComplete,

      probabilityDataComplete:
        probabilitySamples === hours
    };
  },

  findCurrentHourIndex(
    times = [],
    utcOffsetSeconds = 0
  ) {
    if (
      !Array.isArray(times) ||
      !times.length
    ) {
      return 0;
    }

    const now = Date.now();

    let index = 0;
    let difference = Infinity;

    times.forEach((time, i) => {
      const iso = this.parseModelTime(
        time,
        utcOffsetSeconds
      );

      if (!iso) return;

      const d = Math.abs(
        Date.parse(iso) - now
      );

      if (d < difference) {
        difference = d;
        index = i;
      }
    });

    return index;
  },

  getHourlyValue(values, index) {
    return (
      Array.isArray(values) &&
      Number.isInteger(index) &&
      index >= 0
    )
      ? this.safeNumber(
          values[index],
          null
        )
      : null;
  },

  sliceNumericArray(
    values,
    startIndex,
    length
  ) {
    if (!Array.isArray(values)) {
      return [];
    }

    return values
      .slice(
        startIndex,
        startIndex + length
      )
      .map(
        v => this.safeNumber(v, null)
      );
  },

  calculateSignalScore({
    rainProbability,
    rainAmount,
    humidity,
    cloudCover,
    weatherCode
  }) {
    const inputs = [
      [
        rainProbability,
        0.45,
        v => this.clamp(v, 0, 100)
      ],
      [
        rainAmount,
        0.25,
        v => this.rainAmountToScore(v)
      ],
      [
        humidity,
        0.10,
        v => this.clamp(
          (v - 35) * 1.3,
          0,
          100
        )
      ],
      [
        cloudCover,
        0.10,
        v => this.clamp(v, 0, 100)
      ],
      [
        weatherCode,
        0.10,
        v => this.weatherCodeToScore(v)
      ]
    ];

    let score = 0;
    let weight = 0;

    for (const [value, w, transform] of inputs) {
      if (!this.isValidNumber(value)) {
        continue;
      }

      score += transform(value) * w;
      weight += w;
    }

    return weight
      ? this.clamp(
          score / weight,
          0,
          100
        )
      : null;
  },

  calculateConfidence({
    rainProbability,
    rainAmount,
    humidity,
    cloudCover,
    sampleCount,
    validRainSamples,
    expectedRainSamples
  }) {
    const coverageScore = this.clamp(
      this.safeNumber(sampleCount, 0) /
        72 * 100,
      0,
      100
    );

    const completenessScore = [
      rainProbability,
      rainAmount,
      humidity,
      cloudCover
    ].filter(
      v => this.isValidNumber(v)
    ).length / 4 * 100;

    const rainCoverage = expectedRainSamples
      ? this.clamp(
          this.safeNumber(
            validRainSamples,
            0
          ) / expectedRainSamples * 100,
          0,
          100
        )
      : 0;

    return this.clamp(
      this.config.defaultReliability *
        100 * 0.35 +
      coverageScore * 0.20 +
      completenessScore * 0.25 +
      rainCoverage * 0.20,
      0,
      100
    );
  },

  getWarningLevel({
    rainProbability,
    rainAmount,
    signalScore
  }) {
    if (
      ![
        rainProbability,
        rainAmount,
        signalScore
      ].some(
        v => this.isValidNumber(v)
      )
    ) {
      return "UNKNOWN";
    }

    if (
      (signalScore !== null && signalScore >= 80) ||
      (rainAmount !== null && rainAmount >= 25)
    ) {
      return "EMERGENCY";
    }

    if (
      (signalScore !== null && signalScore >= 60) ||
      (rainAmount !== null && rainAmount >= 10)
    ) {
      return "WARNING";
    }

    if (
      (signalScore !== null && signalScore >= 35) ||
      (rainProbability !== null && rainProbability >= 40)
    ) {
      return "WATCH";
    }

    return "NORMAL";
  },

  weatherCodeToText(code) {
    if (!this.isValidNumber(code)) {
      return "UNKNOWN";
    }

    const map = {
      0: "CLEAR_SKY",
      1: "MAINLY_CLEAR",
      2: "PARTLY_CLOUDY",
      3: "OVERCAST",

      45: "FOG",
      48: "RIME_FOG",

      51: "LIGHT_DRIZZLE",
      53: "MODERATE_DRIZZLE",
      55: "DENSE_DRIZZLE",

      56: "LIGHT_FREEZING_DRIZZLE",
      57: "DENSE_FREEZING_DRIZZLE",

      61: "SLIGHT_RAIN",
      63: "MODERATE_RAIN",
      65: "HEAVY_RAIN",

      66: "LIGHT_FREEZING_RAIN",
      67: "HEAVY_FREEZING_RAIN",

      71: "SLIGHT_SNOW",
      73: "MODERATE_SNOW",
      75: "HEAVY_SNOW",

      77: "SNOW_GRAINS",

      80: "SLIGHT_RAIN_SHOWERS",
      81: "MODERATE_RAIN_SHOWERS",
      82: "VIOLENT_RAIN_SHOWERS",

      85: "SLIGHT_SNOW_SHOWERS",
      86: "HEAVY_SNOW_SHOWERS",

      95: "THUNDERSTORM",
      96: "THUNDERSTORM_WITH_HAIL",
      99: "SEVERE_THUNDERSTORM_WITH_HAIL"
    };

    return map[code] || "UNKNOWN";
  },

  weatherCodeToScore(code) {
    if (!this.isValidNumber(code)) {
      return null;
    }

    if ([95, 96, 99].includes(code)) {
      return 100;
    }

    if ([65, 67, 82, 86].includes(code)) {
      return 85;
    }

    if ([63, 66, 75, 81].includes(code)) {
      return 65;
    }

    if ([61, 71, 80, 85].includes(code)) {
      return 45;
    }

    if ([51, 53, 55, 56, 57].includes(code)) {
      return 25;
    }

    if ([45, 48].includes(code)) {
      return 15;
    }

    return 0;
  },

  rainAmountToScore(amount) {
    if (!this.isValidNumber(amount)) {
      return null;
    }

    if (amount <= 0) return 0;
    if (amount < 0.5) return 10;
    if (amount < 2) return 25;
    if (amount < 5) return 45;
    if (amount < 10) return 65;
    if (amount < 25) return 82;

    return 100;
  },

  createUnavailableResult(
    city = {},
    status = "UNAVAILABLE",
    error = "OPENMETEO_UNAVAILABLE"
  ) {
    return {
      sourceKey: "openMeteo",
      sourceName: "Open-Meteo",
      provider: "Open-Meteo Forecast API",

      available: false,
      ok: false,
      official: false,
      status,

      city: city.name,
      lat: city.lat,
      lon: city.lon,
      region: city.region,

      timestamp: null,
      forecastValidTime: null,
      fetchedAt: null,

      ageMinutes: null,
      forecastAgeMinutes: null,

      reliability: 0,
      trust: 0,

      rainProbability: null,
      rainAmount: null,

      currentRainProbability: null,
      currentRainAmount: null,

      forecastRainProbability6h: null,
      forecastRainAmount6h: null,

      rainDataAvailable: false,
      rainDataComplete6h: false,

      signalScore: null,
      confidence: 0,

      warningLevel: "UNKNOWN",
      weatherCondition: "UNAVAILABLE",

      temperature: null,
      humidity: null,
      cloudCover: null,
      windSpeed: null,
      windDirection: null,

      forecastWindows: {
        h6: {},
        h24: {},
        h72: {}
      },

      details: {},
      raw: null,
      error
    };
  },

  getCacheKey(city) {
    return [
      String(city.name).toLowerCase(),
      Number(city.lat).toFixed(4),
      Number(city.lon).toFixed(4),
      this.config.timezone,
      this.config.forecastDays
    ].join(":");
  },

  getCachedResult(city) {
    const key = this.getCacheKey(city);

    const item = this.cache.get(key);

    if (!item) return null;

    const maxAgeMs = this.safeNumber(
      this.config.cacheMinutes,
      0
    ) * 60000;

    if (
      Date.now() - item.savedAt > maxAgeMs ||
      maxAgeMs <= 0
    ) {
      this.cache.delete(key);
      return null;
    }

    return {
      ...item.result,

      ageMinutes: this.calculateAgeMinutes(
        item.result.fetchedAt
      ),

      forecastAgeMinutes: this.calculateAgeMinutes(
        item.result.forecastValidTime
      )
    };
  },

  setCachedResult(city, result) {
    this.cache.set(
      this.getCacheKey(city),
      {
        savedAt: Date.now(),
        result
      }
    );
  },

  clearCache() {
    this.cache.clear();
  },

  publishSuccess(result) {
    window.dispatchEvent(
      new CustomEvent(
        "rg30:openmeteo-data-received",
        {
          detail: result
        }
      )
    );
  },

  publishFailure(result) {
    window.dispatchEvent(
      new CustomEvent(
        "rg30:openmeteo-data-failed",
        {
          detail: result
        }
      )
    );
  },

  getState() {
    return {
      version: this.version,
      initialized: this.initialized,
      configured: this.isConfigured(),
      enabled: this.config.enabled,
      endpoint: this.config.endpoint,

      lastRequestAt: this.lastRequestAt,
      lastSuccessAt: this.lastSuccessAt,
      lastFailureAt: this.lastFailureAt,
      lastError: this.lastError,

      cacheSize: this.cache.size
    };
  },

  normalizeCity(city = {}) {
    return {
      ...city,

      name:
        city.name ||
        city.city ||
        city.cityName ||
        "Unknown",

      region:
        city.region ||
        city.area ||
        city.name ||
        "Unknown",

      lat: this.safeNumber(
        city.lat ?? city.latitude,
        null
      ),

      lon: this.safeNumber(
        city.lon ??
        city.lng ??
        city.longitude,
        null
      )
    };
  },

  validCoordinates(city) {
    return (
      this.isValidNumber(city.lat) &&
      this.isValidNumber(city.lon) &&
      city.lat >= -90 &&
      city.lat <= 90 &&
      city.lon >= -180 &&
      city.lon <= 180
    );
  },

  isValidNumber(value) {
    return (
      value !== null &&
      value !== undefined &&
      value !== "" &&
      (
        typeof value === "number" ||
        typeof value === "string"
      ) &&
      Number.isFinite(Number(value))
    );
  },

  safeNumber(value, fallback = 0) {
    return this.isValidNumber(value)
      ? Number(value)
      : fallback;
  },

  firstNumber(...values) {
    for (const value of values) {
      if (this.isValidNumber(value)) {
        return Number(value);
      }
    }

    return null;
  },

  roundOrNull(value, digits = 0) {
    return this.isValidNumber(value)
      ? Number(
          Number(value).toFixed(digits)
        )
      : null;
  },

  clamp(value, min = 0, max = 100) {
    return this.isValidNumber(value)
      ? Math.min(
          max,
          Math.max(min, Number(value))
        )
      : null;
  },

  average(values = []) {
    const valid = values
      .filter(v => this.isValidNumber(v))
      .map(Number);

    return valid.length
      ? valid.reduce(
          (a, b) => a + b,
          0
        ) / valid.length
      : null;
  },

  sum(values = []) {
    const valid = values
      .filter(v => this.isValidNumber(v))
      .map(Number);

    return valid.length
      ? valid.reduce(
          (a, b) => a + b,
          0
        )
      : null;
  },

  max(values = []) {
    const valid = values
      .filter(v => this.isValidNumber(v))
      .map(Number);

    return valid.length
      ? Math.max(...valid)
      : null;
  },

  min(values = []) {
    const valid = values
      .filter(v => this.isValidNumber(v))
      .map(Number);

    return valid.length
      ? Math.min(...valid)
      : null;
  },

  calculateAgeMinutes(timestamp) {
    if (
      typeof timestamp !== "string" ||
      !timestamp
    ) {
      return null;
    }

    const t = Date.parse(timestamp);

    return Number.isFinite(t)
      ? Math.max(
          0,
          Math.round(
            (Date.now() - t) / 60000
          )
        )
      : null;
  },

  fetchWithTimeout(
    url,
    options = {},
    timeoutMs = 15000
  ) {
    const controller = new AbortController();

    const timeout = setTimeout(
      () => controller.abort(),
      timeoutMs
    );

    return fetch(
      url,
      {
        ...options,
        signal: controller.signal
      }
    ).finally(
      () => clearTimeout(timeout)
    );
  }
};

/* Initialization */

if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    () => RG30.OpenMeteoAdapter.init(),
    { once: true }
  );
} else {
  RG30.OpenMeteoAdapter.init();
}
