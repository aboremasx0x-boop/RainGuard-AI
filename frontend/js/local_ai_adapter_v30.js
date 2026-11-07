
/* RainGuard AI V30 — LocalAI Adapter, V30.1.0
 * Bridges V32 forecast fusion and preliminary rainfall-driven flood screening.
 * Does NOT produce an independently trained AI forecast or a confirmed flood warning.
 */
(function (global) {
  'use strict';
  const NAME = 'LocalAIAdapter';
  const VERSION = 'V30.1.0';
  const HORIZONS = [6, 12, 24, 48, 72];
  const state = { attempts: 0, successes: 0, failures: 0, lastResult: null, lastError: null };
  const now = () => new Date().toISOString();
  const finite = v => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));
  const val = v => finite(v) ? Number(v) : null;

  function normalizeCity(city) {
    if (!city || typeof city !== 'object') return null;
    const lat = val(city.lat ?? city.latitude);
    const lon = val(city.lon ?? city.lng ?? city.longitude);
    if (lat === null || lon === null || lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
    return { ...city, name: city.name || city.nameAr || city.city || 'Unknown', lat, lon };
  }

  function failure(city, reason) {
    state.failures++;
    state.lastError = reason;
    const result = { ok: false, available: false, status: 'UNAVAILABLE', error: reason,
      source: 'local_ai', provider: NAME, version: VERSION, timestamp: now(),
      city: city?.name || city?.nameAr || city?.city || null,
      lat: city?.lat ?? null, lon: city?.lon ?? null,
      riskScore: null, riskLevel: 'UNKNOWN', confidence: null,
      horizons: {}, preliminary: true, confirmedFloodPrediction: false };
    state.lastResult = result;
    return result;
  }

  async function collect(city = {}) {
    state.attempts++;
    const c = normalizeCity(city);
    if (!c) return failure(city, 'INVALID_CITY_COORDINATES');

    const fusionEngine = global.RainForecastFusionV32 || global.RG32?.RainForecastFusion;
    const floodEngine = global.FloodRiskEngineV32 || global.RG32?.FloodRiskEngine;

    if (typeof fusionEngine?.forecastCity !== 'function') return failure(c, 'FUSION_ENGINE_NOT_AVAILABLE');
    if (typeof floodEngine?.evaluateFusion !== 'function') return failure(c, 'FLOOD_RISK_ENGINE_NOT_AVAILABLE');

    try {
      // Run fusion once; reuse exactly the same forecast in flood screening.
      const fusion = await fusionEngine.forecastCity(c);
      if (!fusion || fusion.status !== 'FUSION_READY') return failure(c, 'FUSION_FORECAST_UNAVAILABLE');

      const validHorizons = HORIZONS.filter(h => {
        const x = fusion.horizons?.[`${h}h`];
        return x?.status === 'FUSION_READY' &&
          (x.forecastSource === 'ANWAA_NCM' || x.forecastSource === 'OPEN_METEO' || x.forecastSource === 'VISUAL_CROSSING') &&
          finite(x.totalRainMm) && finite(x.peakRainMmH) && finite(x.rainProbability);
      });

      if (!validHorizons.length) return failure(c, 'NO_VALID_FORECAST_HORIZONS');

      // The existing V32 flood engine may score incomplete horizons. Mask them here.
      const safeFusion = { ...fusion, horizons: Object.fromEntries(HORIZONS.map(h => {
        const key = `${h}h`;
        return [key, validHorizons.includes(h) ? fusion.horizons[key] : null];
      })) };

      const flood = floodEngine.evaluateFusion(safeFusion);
      if (!flood || flood.status !== 'PRELIMINARY_FLOOD_RISK_READY')
        return failure(c, 'FLOOD_SCREENING_UNAVAILABLE');

      const horizons = {};
      for (const h of HORIZONS) {
        const key = `${h}h`;
        const risk = flood.horizons?.[key];
        horizons[key] = validHorizons.includes(h) && risk?.status === 'PRELIMINARY_RISK_READY'
          ? { ...risk }
          : { horizonHours: h, status: 'INSUFFICIENT_FORECAST_DATA', riskScore: null,
              riskLevel: 'UNKNOWN', riskLabelAr: 'غير متاح', riskLabelEn: 'Unavailable', evidence: null };
      }

      const ready = Object.values(horizons).filter(x => x.status === 'PRELIMINARY_RISK_READY' && finite(x.riskScore));
      if (!ready.length) return failure(c, 'NO_VALID_RISK_HORIZONS');

      const highest = ready.reduce((a, b) => b.riskScore > a.riskScore ? b : a);

      const result = {
        ok: true, available: true, status: 'AVAILABLE', source: 'local_ai',
        provider: NAME, version: VERSION, timestamp: now(),
        city: c.name, lat: c.lat, lon: c.lon,
        riskScore: highest.riskScore, riskLevel: highest.riskLevel,
        riskLabelAr: highest.riskLabelAr, riskLabelEn: highest.riskLabelEn,
        highestRisk: { horizonHours: highest.horizonHours, riskScore: highest.riskScore,
          riskLevel: highest.riskLevel },
        horizons, forecast: fusion, floodRisk: flood,
        confidence: null, // No validated predictive skill estimate is available.
        preliminary: true, rainfallDrivenOnly: true, confirmedFloodPrediction: false,
        locallyCalibrated: false,
        limitations: ['terrain', 'wadi_proximity', 'drainage_capacity', 'soil_moisture',
          'land_cover', 'local_hydrological_calibration'],
        note: 'Preliminary rainfall-driven screening indicator; not a confirmed flood prediction.'
      };

      state.successes++;
      state.lastError = null;
      state.lastResult = result;
      global.dispatchEvent?.(new CustomEvent('rainguard:local-ai-ready', { detail: result }));
      return result;
    } catch (error) {
      console.error('[LocalAIAdapter] collect failed:', error);
      return failure(c, error?.message || 'LOCAL_AI_EXECUTION_FAILED');
    }
  }

  const api = {
    name: NAME, version: VERSION, initialized: true,
    collect, execute: collect, evaluateCity: collect,
    getLastResult: () => state.lastResult,
    getStatus: () => ({
      name: NAME, version: VERSION,
      ready: typeof (global.RainForecastFusionV32 || global.RG32?.RainForecastFusion)?.forecastCity === 'function' &&
        typeof (global.FloodRiskEngineV32 || global.RG32?.FloodRiskEngine)?.evaluateFusion === 'function',
      attempts: state.attempts, successes: state.successes, failures: state.failures,
      lastError: state.lastError, lastStatus: state.lastResult?.status || null,
      preliminary: true, confirmedFloodPrediction: false
    })
  };

  global.RG30 = global.RG30 || {};
  global.RG30.LocalAIAdapter = api;
  global.LocalAIAdapter = api;
  console.log(`[${NAME}] ${VERSION} registered`);
})(window);
