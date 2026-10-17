/* RainGuard AI — FORECAST-1J6G12: preliminary spatial flood screening */
(function (global) {
  "use strict";
  const NAME = "FloodRiskHydroSHEDSIntegrationV32";
  const VERSION = "FORECAST-1J6G12.0";
  const H = [6, 12, 24, 48, 72];
  const finite = v => v !== null && v !== undefined && Number.isFinite(Number(v));
  const clamp = v => Math.max(0, Math.min(100, Number(v)));
  const level = s => s >= 75 ? "VERY_HIGH" : s >= 50 ? "HIGH" : s >= 25 ? "MODERATE" : "LOW";
  // A within-grid ordinal indicator, NOT discharge, flood depth, or drainage capacity.
  // log scaling avoids treating raw upstream-cell counts as linear flood probabilities.
  function accumulationIndex(acc) {
    if (!finite(acc) || Number(acc) < 0) return null;
    return clamp(100 * Math.log1p(Number(acc)) / Math.log1p(1000000));
  }
  async function evaluateCity(city, options = {}) {
    const terrain = global.FloodRiskTerrainIntegrationV32;
    const hydro = global.HydroSHEDSFlowAccumulationAdapterV32;
    if (!terrain?.evaluateCity) throw Error("FORECAST_1J6F_NOT_LOADED");
    if (!hydro?.evaluateCity) throw Error("FORECAST_1J6G11_NOT_LOADED");
    const [base, acc] = await Promise.all([
      terrain.evaluateCity(city),
      hydro.evaluateCity(city, { radiusKm: options.radiusKm ?? 3 })
    ]);
    const real = acc?.status === "REAL_DRAINAGE_CONTEXT_READY" &&
      acc?.source?.provider === "HydroSHEDS" &&
      acc?.syntheticData === false && acc?.source?.syntheticData === false &&
      finite(acc?.maxAcc) && Number(acc.maxAcc) >= 0 && acc?.validCells > 0;
    const index = real ? accumulationIndex(acc.maxAcc) : null;
    const horizons = {};
    for (const hours of H) {
      const key = hours + "h";
      const b = base?.horizons?.[key];
      const baseReady = b?.status === "TERRAIN_SPATIAL_FLOOD_RISK_READY" && finite(b?.riskScore);
      const ready = baseReady && real && base?.spatialContext?.terrainAvailable === true &&
        base?.spatialContext?.wadiProximityAvailable === true;
      const score = ready ? Math.round(clamp(Number(b.riskScore) * 0.9 + index * 0.1)) : null;
      horizons[key] = {
        ...(b || { horizonHours: hours }),
        status: ready ? "HYDROSHEDS_SPATIAL_SCREENING_READY" : "INSUFFICIENT_REAL_HYDROLOGICAL_DATA",
        riskScore: score,
        riskLevel: ready ? level(score) : "UNKNOWN",
        evidence: {
          ...(b?.evidence || {}),
          hydroSHEDS: {
            available: real, centerAcc: acc?.centerAcc ?? null,
            maxAcc: real ? Number(acc.maxAcc) : null,
            validCells: acc?.validCells ?? 0,
            strongestCell: real ? acc.strongestCell : null,
            accumulationIndex: index,
            units: "upstream_grid_cell_count",
            source: real ? acc.source : null,
            syntheticData: false
          }
        },
        limitations: {
          ...(b?.limitations || {}), preliminary: true,
          confirmedFloodPrediction: false, locallyCalibrated: false,
          municipalDrainageCapacityAvailable: false,
          missingHydrology: ["municipal_drainage_capacity", "soil_moisture", "land_cover", "local_hydrological_calibration"]
        }
      };
    }
    const ready = Object.values(horizons).filter(h => h.status === "HYDROSHEDS_SPATIAL_SCREENING_READY");
    const highest = ready.length ? ready.reduce((a, b) => b.riskScore > a.riskScore ? b : a) : null;
    const result = {
      engine: NAME, version: VERSION,
      status: ready.length === H.length ? "HYDROSHEDS_SPATIAL_SCREENING_READY" : "INSUFFICIENT_REAL_HYDROLOGICAL_DATA",
      city: base?.city || city?.name || city?.nameAr || null,
      sourceTerrainVersion: base?.version || null,
      sourceHydroSHEDSVersion: acc?.version || null,
      spatialContext: { ...(base?.spatialContext || {}), realHydroSHEDSAvailable: real, hydroSHEDSMaxAcc: real ? acc.maxAcc : null, syntheticData: false },
      methodology: {
        type: "rainfall_wadi_dem_accumulation_preliminary_screening",
        weighting: { priorRainWadiTerrainScore: 0.9, hydroSHEDSAccumulationIndex: 0.1 },
        weightsLocallyValidated: false, confirmedFloodPrediction: false,
        locallyCalibrated: false, municipalDrainageCapacityAvailable: false,
        note: "HydroSHEDS ACC counts upstream cells; it does not measure storm runoff, discharge or urban drainage capacity."
      },
      highestRisk: highest ? { horizonHours: highest.horizonHours, riskScore: highest.riskScore, riskLevel: highest.riskLevel } : null,
      horizons
    };
    global.RG32 = global.RG32 || {};
    global.RG32.latestHydroSHEDSSpatialRisk = result;
    global.dispatchEvent(new CustomEvent("rainguard:hydrosheds-spatial-risk-ready", { detail: result }));
    return result;
  }
  const api = { name: NAME, version: VERSION, horizons: H, evaluateCity, accumulationIndex,
    getStatus: () => ({ version: VERSION, requires1J6F: true, requires1J6G11: true, syntheticDataAllowed: false, confirmedFloodPrediction: false, locallyCalibrated: false }) };
  global.FloodRiskHydroSHEDSIntegrationV32 = api;
  global.RG32 = global.RG32 || {};
  global.RG32.FloodRiskHydroSHEDSIntegration = api;
  console.log(`[RainGuard] ${NAME} ${VERSION} loaded`);
})(window);
