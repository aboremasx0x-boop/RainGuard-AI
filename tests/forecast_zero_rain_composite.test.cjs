// Run from repository root: node tests/forecast_zero_rain_composite.test.cjs
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const source = fs.readFileSync("frontend/js/flood_risk_hydrological_composite_v32.js", "utf8");
const events = [];
const window = {
  RG32: {},
  dispatchEvent(event) { events.push(event.type); },
  FloodRiskHydrologicalFusionV32: {
    async evaluateCity() { return fixture; }
  }
};
const context = vm.createContext({
  window, console,
  CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } }
});
vm.runInContext(source, context);
const factors = {
  terrain: { available: true, value: 11 },
  slope: { available: true, value: 0.23 },
  wadi_proximity: { available: true, value: 1340 },
  drainage_capacity: { available: false, value: null },
  soil_moisture: { available: true, value: 0.124 },
  land_cover: { available: true, value: 50 }
};
let fixture;
function horizon(status, score) { return { status, riskScore: score }; }
async function run(label, rainfall, expected) {
  fixture = {
    hydrology: { factors, completenessPercent: 83 },
    rainfall: { horizons: { "6h": rainfall } }
  };
  const result = await window.FloodRiskHydrologicalCompositeV32.evaluateCity({name:"Jeddah",lat:21.5433,lon:39.1728});
  const h = result.horizons["6h"];
  assert.equal(h.compositeScore, expected, label);
  assert.equal(h.confirmedFloodPrediction, false, label);
  assert.equal(h.locallyCalibrated, false, label);
  assert.equal(result.methodology.scoreIsProbability, false, label);
  assert.deepEqual(Array.from(result.hydrology.missingFactors), ["drainage_capacity"], label);
  return result;
}
(async () => {
  const dry = await run("verified zero rainfall", horizon("PRELIMINARY_RISK_READY", 0), 0);
  assert.equal(dry.sensitivity.byHorizon["6h"].min, 0);
  assert.equal(dry.sensitivity.byHorizon["6h"].max, 0);
  await run("moderate rainfall", horizon("PRELIMINARY_RISK_READY", 35), 39.9);
  await run("missing rainfall", horizon("INSUFFICIENT_FORECAST_DATA", null), null);
  await run("missing rainfall horizon", null, null);
  await run("invalid rainfall score", horizon("PRELIMINARY_RISK_READY", NaN), null);
  assert.ok(events.includes("rainguard:composite-flood-risk-ready"));
  console.log("PASS: zero-rain, wet, missing, invalid, sensitivity, and safety metadata");
})().catch(error => { console.error(error); process.exitCode = 1; });
