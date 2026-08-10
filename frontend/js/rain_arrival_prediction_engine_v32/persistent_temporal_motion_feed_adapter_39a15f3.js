/**
 * RainGuard AI — Phase 39A-15F3.1
 * Persistent Temporal Motion Feed Adapter
 */
(function (global) {
  "use strict";

  const PHASE = "39A-15F3.1";
  const VERSION = "39A.15F3.1.0";
  const BUILD = "rainguard-v39-persistent-temporal-motion-feed-adapter-source-binding";

  const state = {
    installed: true,
    running: false,
    runs: 0,
    lastResult: null,
    lastError: null
  };

  function arr(v) {
    if (!v) return [];
    if (Array.isArray(v)) return v;
    if (v instanceof Map || v instanceof Set) return [...v.values()];
    return [];
  }

  function num(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function ts(v) {
    if (v == null) return null;
    if (v instanceof Date) return v.getTime();
    if (typeof v === "number") return v < 1e12 ? v * 1000 : v;
    if (typeof v === "string") {
      const n = Number(v);
      if (Number.isFinite(n)) return n < 1e12 ? n * 1000 : n;
      const d = Date.parse(v);
      return Number.isFinite(d) ? d : null;
    }
    return null;
  }

  function first(o, keys) {
    if (!o || typeof o !== "object") return undefined;
    for (const k of keys) {
      if (o[k] != null) return o[k];
    }
  }

  function coord(o) {
    if (!o || typeof o !== "object") return null;

    const list = [
      o,
      o.currentCoordinate,
      o.coordinate,
      o.coordinates,
      o.location,
      o.position,
      o.point,
      o.center,
      o.centroid
    ].filter(x => x && typeof x === "object");

    for (const c of list) {
      let lat = num(first(c, ["lat","latitude","y","centerLat","centroidLat"]));
      let lon = num(first(c, ["lon","lng","longitude","x","centerLon","centerLng","centroidLon","centroidLng"]));

      if ((!Number.isFinite(lat) || !Number.isFinite(lon)) &&
          Array.isArray(c.coordinates) && c.coordinates.length >= 2) {
        lon = num(c.coordinates[0]);
        lat = num(c.coordinates[1]);
      }

      if (
        Number.isFinite(lat) && Number.isFinite(lon) &&
        lat >= -90 && lat <= 90 &&
        lon >= -180 && lon <= 180 &&
        !(lat === 0 && lon === 0)
      ) return { lat, lon };
    }

    return null;
  }

  function observedAt(o) {
    if (!o || typeof o !== "object") return null;

    const candidates = [
      first(o, ["observedAt","timestamp","time","capturedAt","createdAt","updatedAt","lastSeenAt"]),
      first(o.currentCoordinate || {}, ["observedAt","timestamp","time","capturedAt"]),
      first(o.coordinate || {}, ["observedAt","timestamp","time","capturedAt"])
    ];

    for (const v of candidates) {
      const t = ts(v);
      if (t != null) return t;
    }
    return null;
  }

  function idOf(o, i) {
    const id = first(o || {}, [
      "persistentId","canonicalTrackId","trackId","identityId",
      "stormId","cellId","entityId","id","key","name"
    ]);
    return id != null ? String(id) : `TEMPORAL-${i}`;
  }

  function getRunnerLastResult(name) {
    const f = global[name];
    return typeof f === "function" && f.lastResult ? f.lastResult : null;
  }

  function locateSource() {
    const resultCandidates = [
      ["RainGuardPersistentTemporalIdentityReconciliationLastResult",
        global.RainGuardPersistentTemporalIdentityReconciliationLastResult],
      ["RainGuardTemporalIdentityReconciliationResult",
        global.RainGuardTemporalIdentityReconciliationResult],
      ["39A15F2.runner.lastResult",
        getRunnerLastResult("runRainGuardPersistentTemporalIdentityReconciliation")],
      ["39A15F2.object.state.lastResult",
        global.RainGuardPersistentTemporalIdentityReconciliationV39?.state?.lastResult]
    ];

    for (const [name, r] of resultCandidates) {
      if (!r || typeof r !== "object") continue;

      if (arr(r.motionReadyIdentities).length)
        return { name: name + ".motionReadyIdentities", data: arr(r.motionReadyIdentities), upstream: r };

      if (arr(r.motionReadySample).length)
        return { name: name + ".motionReadySample", data: arr(r.motionReadySample), upstream: r };

      if (arr(r.identities).length)
        return { name: name + ".identities", data: arr(r.identities), upstream: r };
    }

    const stores = [
      ["RainGuardPersistentTemporalMotionReadyIdentitiesV39", global.RainGuardPersistentTemporalMotionReadyIdentitiesV39],
      ["RainGuardPersistentTemporalIdentitiesV39", global.RainGuardPersistentTemporalIdentitiesV39],
      ["RainGuardPersistentTemporalIdentities", global.RainGuardPersistentTemporalIdentities],
      ["RainGuardTemporalIdentitiesV39", global.RainGuardTemporalIdentitiesV39],
      ["RainGuardTemporalIdentities", global.RainGuardTemporalIdentities],
      ["RainGuardPersistentStormIdentitiesV39", global.RainGuardPersistentStormIdentitiesV39]
    ];

    for (const [name, v] of stores) {
      const a = arr(v);
      if (a.length) return { name, data: a, upstream: null };
    }

    return { name: null, data: [], upstream: null };
  }

  function observationPool(identity) {
    const out = [];
    const keys = [
      "motionReadyPoints","temporalPoints","observations","points",
      "history","records","trackHistory","samples","positions",
      "timeline","sequence"
    ];

    for (const k of keys) out.push(...arr(identity?.[k]));

    for (const parent of ["temporal","motion","metadata","sourceData"]) {
      const n = identity?.[parent];
      if (!n || typeof n !== "object") continue;
      for (const k of keys) out.push(...arr(n[k]));
    }

    if (coord(identity) && observedAt(identity) != null) out.push(identity);
    return out;
  }

  function normalizePoint(o, identityId, sourceName) {
    const c = coord(o);
    const t = observedAt(o);
    if (!c || t == null) return null;

    return {
      identityId,
      trackId: String(first(o, ["trackId","canonicalTrackId","persistentId","cellId","stormId"]) ?? identityId),
      lat: c.lat,
      lon: c.lon,
      latitude: c.lat,
      longitude: c.lon,
      observedAt: t,
      timestamp: t,
      intensity: num(first(o, ["intensity","strength","reflectivity"])),
      confidence: num(first(o, ["confidence","identityConfidence","matchConfidence"])),
      source: String(first(o, ["source","sourceName","provider"]) ?? sourceName),
      original: o
    };
  }

  function distanceKm(a, b) {
    const R = 6371.0088;
    const rad = d => d * Math.PI / 180;
    const dLat = rad(b.lat - a.lat);
    const dLon = rad(b.lon - a.lon);
    const h =
      Math.sin(dLat/2)**2 +
      Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon/2)**2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  function validPair(a, b) {
    if (a.identityId !== b.identityId) return false;
    const dt = b.observedAt - a.observedAt;
    if (!Number.isFinite(dt) || dt < 1000 || dt > 6*60*60*1000) return false;

    const d = distanceKm(a, b);
    return Number.isFinite(d) && d >= 0.01 && d <= 500;
  }

  function buildGroup(identity, index, sourceName) {
    const identityId = idOf(identity, index);
    const points = observationPool(identity)
      .map(x => normalizePoint(x, identityId, sourceName))
      .filter(Boolean)
      .sort((a,b) => a.observedAt - b.observedAt);

    const unique = [];
    const seen = new Set();

    for (const p of points) {
      const k = `${p.observedAt}|${p.lat.toFixed(6)}|${p.lon.toFixed(6)}`;
      if (!seen.has(k)) {
        seen.add(k);
        unique.push(p);
      }
    }

    if (unique.length < 2) {
      return { identityId, accepted: false, reason: "NOT_ENOUGH_VALID_POINTS", points: unique };
    }

    const accepted = [unique[0]];
    for (let i=1; i<unique.length; i++) {
      if (validPair(accepted[accepted.length-1], unique[i])) accepted.push(unique[i]);
    }

    return {
      identityId,
      accepted: accepted.length >= 2,
      reason: accepted.length >= 2 ? "SEQUENTIAL_POINTS_READY" : "NO_VALID_SEQUENTIAL_PAIR",
      points: accepted
    };
  }

  async function run(options = {}) {
    if (state.running) {
      return { success: true, phase: PHASE, status: "RUN_ALREADY_IN_PROGRESS" };
    }

    state.running = true;
    state.runs++;

    try {
      const source = locateSource();
      const groups = source.data.map((x,i) => buildGroup(x, i, source.name || "unknown"));
      const acceptedGroups = groups.filter(g => g.accepted);
      const feed = acceptedGroups.flatMap(g => g.points);

      const result = {
        success: true,
        phase: PHASE,
        version: VERSION,
        build: BUILD,
        status: feed.length
          ? "TEMPORAL_MOTION_FEED_READY"
          : source.data.length
            ? "TEMPORAL_IDENTITIES_FOUND_BUT_NO_VALID_SEQUENTIAL_FEED"
            : "NO_TEMPORAL_IDENTITIES_FOUND",
        source: source.name,
        sourceIdentityCount: source.data.length,
        acceptedIdentityCount: acceptedGroups.length,
        rejectedIdentityCount: groups.length - acceptedGroups.length,
        acceptedPointCount: feed.length,
        feedCount: feed.length,
        upstream: source.upstream ? {
          status: source.upstream.status ?? null,
          identityCount: source.upstream.identityCount ?? null,
          motionReadyCount: source.upstream.motionReadyCount ?? null,
          temporalLinksCreated: source.upstream.temporalLinksCreated ?? null
        } : null,
        sample: feed.slice(0, 10),
        generatedAt: Date.now()
      };

      global.RainGuardPersistentTemporalMotionFeed = feed;
      global.RainGuardPersistentTemporalMotionFeedV39 = feed;
      global.RainGuardPersistentTemporalMotionFeed39A15F3 = feed;
      global.RainGuardPersistentTemporalMotionIdentityGroupsV39 = acceptedGroups;
      global.RainGuardPersistentTemporalMotionFeedLastResult = result;

      state.lastResult = result;
      state.lastError = null;

      run.lastResult = result;

      if (options.log !== false)
        console.log("[RainGuard Phase 39A-15F3.1] Temporal Motion Feed Adapter result:", result);

      return result;
    } catch (e) {
      const result = {
        success: false,
        phase: PHASE,
        version: VERSION,
        build: BUILD,
        status: "TEMPORAL_MOTION_FEED_ADAPTER_ERROR",
        error: e?.message || String(e)
      };
      state.lastError = e;
      state.lastResult = result;
      run.lastResult = result;
      console.error("[RainGuard Phase 39A-15F3.1] Error:", e);
      return result;
    } finally {
      state.running = false;
    }
  }

  function diagnose() {
    const s = locateSource();
    const result = {
      phase: PHASE,
      version: VERSION,
      build: BUILD,
      installed: true,
      source: s.name,
      sourceIdentityCount: s.data.length,
      lastResult: state.lastResult
    };
    console.log("[RainGuard Phase 39A-15F3.1] Diagnostic:", result);
    return result;
  }

  global.RainGuardPersistentTemporalMotionFeedAdapter = {
    phase: PHASE,
    version: VERSION,
    build: BUILD,
    state,
    locateSource,
    run,
    diagnose
  };

  global.runRainGuardPersistentTemporalMotionFeedAdapter = run;
  global.getRainGuardPersistentTemporalMotionFeed = () =>
    Array.isArray(global.RainGuardPersistentTemporalMotionFeedV39)
      ? global.RainGuardPersistentTemporalMotionFeedV39
      : [];
  global.diagnoseRainGuardPersistentTemporalMotionFeedAdapter = diagnose;

  console.log(`[RainGuard Phase ${PHASE}] Persistent Temporal Motion Feed Adapter installed`);
})(window);
