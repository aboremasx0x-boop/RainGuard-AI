/*
RainGuard AI — Phase 39A-11
Arrival ETA Pipeline Bridge
Version 39A.11.0
*/
(function (global) {
  "use strict";

  const VERSION = "39A.11.0";
  const now = () => Date.now();

  const toArray = (v) => {
    if (!v) return [];
    if (Array.isArray(v)) return v;
    if (v instanceof Map || v instanceof Set) return Array.from(v.values());
    if (typeof v === "object") {
      for (const k of ["entities","stormEntities","liveStormEntities","tracks","stormTracks","items","results","result","data","payload","output"]) {
        const n = v[k];
        if (Array.isArray(n)) return n;
        if (n instanceof Map || n instanceof Set) return Array.from(n.values());
      }
    }
    return [];
  };

  const finite = (v) => Number.isFinite(Number(v)) ? Number(v) : null;

  function resolveCollector() {
    return global.RainArrivalStormEntityCollectorV32 ||
      global.RainGuardAI?.V32?.rainArrivalModules?.stormEntityCollector || null;
  }

  function resolveExportBridge() {
    return global.RainArrivalLiveStormExportBridgeV32 ||
      global.RainGuardAI?.V32?.rainArrivalModules?.liveStormExportBridge || null;
  }

  function resolveArrivalEngine() {
    return global.RainArrivalEngineV32 ||
      global.RainGuardAI?.V32?.rainArrivalEngine || null;
  }

  function resolveCities() {
    const candidates = [
      global.RainGuardSaudiLocationsRegistryV32,
      global.SaudiLocationsRegistryV32,
      global.RainGuardAI?.V32?.saudiLocationsRegistry
    ];
    for (const r of candidates) {
      if (!r) continue;
      try {
        if (typeof r.getAll === "function") {
          const a = toArray(r.getAll());
          if (a.length) return a;
        }
      } catch (_) {}
      for (const k of ["locations","cities","items","data"]) {
        const a = toArray(r[k]);
        if (a.length) return a;
      }
    }
    return [];
  }

  function getEntities() {
    const exp = resolveExportBridge();
    const col = resolveCollector();
    let arr = [];

    if (exp) {
      for (const k of ["entities","liveStormEntities","lastResult","lastOutput"]) {
        arr = toArray(exp[k]);
        if (arr.length) break;
      }
    }

    if (!arr.length && col) {
      try {
        if (typeof col.getAll === "function") arr = toArray(col.getAll());
      } catch (_) {}
      if (!arr.length) arr = toArray(col.lastResult?.entities);
    }

    return arr.slice(0, 250);
  }

  function coord(obj) {
    return {
      lat: finite(obj?.latitude ?? obj?.lat ?? obj?.center?.lat ?? obj?.center?.latitude),
      lon: finite(obj?.longitude ?? obj?.lon ?? obj?.lng ?? obj?.center?.lon ?? obj?.center?.lng ?? obj?.center?.longitude)
    };
  }

  function motion(obj) {
    let speed = finite(obj?.speedKmh ?? obj?.speed ?? obj?.motion?.speedKmh ?? obj?.motion?.speed ?? obj?.motionVector?.speed);
    let dir = finite(obj?.directionDeg ?? obj?.direction ?? obj?.bearing ?? obj?.motion?.direction ?? obj?.motionVector?.direction);
    const unit = String(obj?.speedUnit ?? obj?.motion?.speedUnit ?? "").toLowerCase();
    if (speed !== null && (unit === "m/s" || unit === "mps")) speed *= 3.6;
    if (dir !== null) dir = ((dir % 360) + 360) % 360;
    return { speed, dir };
  }

  function haversineKm(aLat, aLon, bLat, bLon) {
    const r = 6371, rad = d => d * Math.PI / 180;
    const dLat = rad(bLat - aLat), dLon = rad(bLon - aLon);
    const x = Math.sin(dLat/2)**2 + Math.cos(rad(aLat))*Math.cos(rad(bLat))*Math.sin(dLon/2)**2;
    return 2 * r * Math.atan2(Math.sqrt(x), Math.sqrt(1-x));
  }

  function bearing(aLat, aLon, bLat, bLon) {
    const r = d => d * Math.PI / 180, d = x => x * 180 / Math.PI;
    const p1 = r(aLat), p2 = r(bLat), dl = r(bLon - aLon);
    const y = Math.sin(dl) * Math.cos(p2);
    const x = Math.cos(p1)*Math.sin(p2) - Math.sin(p1)*Math.cos(p2)*Math.cos(dl);
    return (d(Math.atan2(y, x)) + 360) % 360;
  }

  function diff(a,b) {
    const x = Math.abs(a-b)%360;
    return Math.min(x, 360-x);
  }

  async function tryEngine(engine, entity, city) {
    if (!engine) return null;
    const payload = { stormEntity: entity, entity, city, target: city };
    for (const m of ["predictArrival","predictArrivalForTarget","predict","evaluateArrival","calculateArrival","estimateArrival","runPrediction"]) {
      if (typeof engine[m] !== "function") continue;
      try {
        const r = await Promise.resolve(engine[m](payload));
        const minutes = finite(r?.arrivalMinutes ?? r?.etaMinutes ?? r?.minutes ?? r?.arrival?.minutes ?? r?.eta?.minutes);
        if (minutes !== null && minutes >= 0) {
          return { arrivalMinutes: Math.round(minutes), source: `engine.${m}` };
        }
      } catch (_) {}
    }
    return null;
  }

  function fallback(entity, city) {
    const ec = coord(entity), cc = coord(city);
    if ([ec.lat,ec.lon,cc.lat,cc.lon].some(v => v === null)) return null;

    const m = motion(entity);
    if (m.speed === null || m.speed < 5) return null;

    const brg = bearing(ec.lat, ec.lon, cc.lat, cc.lon);
    if (m.dir !== null && diff(m.dir, brg) > 100) return null;

    const km = haversineKm(ec.lat, ec.lon, cc.lat, cc.lon);
    const mins = Math.round((km / m.speed) * 60);
    if (mins < 0 || mins > 4320) return null;

    return {
      arrivalMinutes: mins,
      source: "phase39a11-geometric-fallback",
      distanceKm: Math.round(km*10)/10,
      speedKmh: Math.round(m.speed*10)/10
    };
  }

  const state = {
    running: false,
    runInProgress: false,
    timer: null,
    lastResult: null,
    lastError: null,
    stats: { runs:0, skipped:0, etaPublished:0, failures:0 }
  };

  async function run({force=false} = {}) {
    if (state.runInProgress) {
      state.stats.skipped++;
      return {success:true, skipped:true, status:"ARRIVAL_ETA_BRIDGE_ALREADY_RUNNING"};
    }

    state.runInProgress = true;

    try {
      const entities = getEntities();
      const cities = resolveCities().slice(0, 100);
      const engine = resolveArrivalEngine();
      const predictions = [];

      state.stats.runs++;

      for (const city of cities) {
        const cc = coord(city);
        if (cc.lat === null || cc.lon === null) continue;

        let best = null;

        for (const entity of entities) {
          let p = await tryEngine(engine, entity, city);
          if (!p) p = fallback(entity, city);
          if (!p) continue;

          const candidate = {
            city: city.name ?? city.nameAr ?? city.nameEn ?? city.city ?? "Unknown",
            cityId: city.id ?? city.code ?? null,
            stormEntityId: entity.id ?? entity.trackId ?? entity.cellId ?? null,
            arrivalMinutes: p.arrivalMinutes,
            source: p.source,
            distanceKm: p.distanceKm ?? null,
            speedKmh: p.speedKmh ?? null
          };

          if (!best || candidate.arrivalMinutes < best.arrivalMinutes) best = candidate;
        }

        if (best) predictions.push(best);
      }

      predictions.sort((a,b) => a.arrivalMinutes - b.arrivalMinutes);
      const best = predictions[0] ?? null;

      const result = {
        success: true,
        phase: "39A-11",
        version: VERSION,
        status: best ? "ARRIVAL_ETA_AVAILABLE" :
                !entities.length ? "NO_LIVE_STORM_ENTITIES" :
                !cities.length ? "NO_CITY_REGISTRY_AVAILABLE" :
                "ARRIVAL_ETA_UNAVAILABLE",
        entityCount: entities.length,
        cityCount: cities.length,
        predictionCount: predictions.length,
        arrivalMinutes: best?.arrivalMinutes ?? null,
        best,
        predictions,
        generatedAt: now()
      };

      state.lastResult = result;
      state.lastError = null;
      if (best) state.stats.etaPublished++;

      global.RainGuardAI = global.RainGuardAI || {};
      global.RainGuardAI.V32 = global.RainGuardAI.V32 || {};
      global.RainGuardAI.V32.rainArrivalState = global.RainGuardAI.V32.rainArrivalState || {};
      global.RainGuardAI.V32.rainArrivalState.arrivalMinutes = result.arrivalMinutes;
      global.RainGuardAI.V32.rainArrivalState.etaMinutes = result.arrivalMinutes;
      global.RainGuardAI.V32.rainArrivalState.status = result.status;

      return result;

    } catch (error) {
      state.stats.failures++;
      state.lastError = {
        name: error?.name || "Error",
        message: error?.message || String(error),
        stack: error?.stack || null
      };
      return {
        success:false,
        phase:"39A-11",
        version:VERSION,
        status:"ARRIVAL_ETA_BRIDGE_FAILED",
        error:state.lastError,
        arrivalMinutes:null,
        generatedAt:now()
      };
    } finally {
      state.runInProgress = false;
    }
  }

  function diagnose() {
    const result = {
      phase:"39A-11",
      version:VERSION,
      running:state.running,
      runInProgress:state.runInProgress,
      lastError:state.lastError,
      statistics:{...state.stats},
      result:state.lastResult
    };
    console.log("[RainGuard Phase 39A-11] Arrival ETA Pipeline Bridge", result);
    return result;
  }

  function start() {
    if (state.running) return {success:true, alreadyRunning:true};
    state.running = true;
    run({force:true});
    state.timer = global.setInterval(() => run(), 5000);
    return {success:true, running:true, intervalMs:5000};
  }

  function stop() {
    if (state.timer) global.clearInterval(state.timer);
    state.timer = null;
    state.running = false;
    return {success:true, running:false};
  }

  global.RainGuardArrivalEtaPipelineBridgeV39 = {version:VERSION, run, diagnose, start, stop, state};
  global.runRainGuardArrivalEtaBridge = (options) => run(options || {});
  global.diagnoseRainGuardArrivalEtaBridge = diagnose;

  console.log(`[RainGuard AI] Phase 39A-11 — Arrival ETA Pipeline Bridge v${VERSION} READY`);
  start();

})(typeof globalThis !== "undefined" ? globalThis : window);
