
(function (global) {
"use strict";

const VERSION = "32.38M.18D";
const BUILD = "rainguard-v32-phase38m18d-stable-track-identity";
const CONFIG = {
  autoStart: true,
  intervalMs: 4000,
  maxMatchDistanceKm: 35,
  maxTrackAgeMs: 20 * 60 * 1000,
  maxTracks: 1200,
  debug: true
};

const tracks = new Map();
const sourceMap = new Map();
let seq = 1;
let timer = null;
let running = false;
let latestResult = null;

const now = () => Date.now();
const clone = value => {
  try { return structuredClone(value); }
  catch (_) {
    try { return JSON.parse(JSON.stringify(value)); }
    catch (_) { return value; }
  }
};

function num(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function coord(value) {
  if (!value || typeof value !== "object") return null;
  const latitude = num(value.latitude ?? value.lat ?? value.y);
  const longitude = num(value.longitude ?? value.lon ?? value.lng ?? value.x);
  if (
    latitude === null || longitude === null ||
    latitude < -90 || latitude > 90 ||
    longitude < -180 || longitude > 180
  ) return null;
  return { latitude, longitude };
}

function ts(value) {
  if (value == null) return now();
  if (typeof value === "number") return value < 1e12 ? value * 1000 : value;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : now();
}

function arr(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (value instanceof Map || value instanceof Set) return Array.from(value.values());
  if (typeof value.values === "function") {
    try { return Array.from(value.values()); } catch (_) {}
  }
  return typeof value === "object" ? Object.values(value) : [];
}

function km(a, b) {
  const x = coord(a), y = coord(b);
  if (!x || !y) return null;
  const R = 6371.0088;
  const r = v => v * Math.PI / 180;
  const dLat = r(y.latitude - x.latitude);
  const dLon = r(y.longitude - x.longitude);
  const p1 = r(x.latitude), p2 = r(y.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(p1) * Math.cos(p2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function normalizeEntity(entity) {
  const candidates = [
    entity?.coordinate, entity?.position, entity?.location,
    entity?.centroid, entity?.center, entity?.currentCoordinate,
    entity?.sourceCoordinate, entity?.stormCoordinate, entity
  ];
  let c = null;
  for (const item of candidates) {
    c = coord(item);
    if (c) break;
  }
  if (!c) return null;

  return {
    sourceId: String(
      entity?.sourceTrackId ?? entity?.canonicalTrackId ??
      entity?.trackId ?? entity?.cellId ?? entity?.id ??
      entity?.entityId ?? entity?.uuid ??
      `${c.latitude.toFixed(4)}:${c.longitude.toFixed(4)}`
    ),
    coordinate: c,
    timestamp: ts(
      entity?.timestamp ?? entity?.time ?? entity?.observedAt ??
      entity?.generatedAt ?? entity?.updatedAt ?? entity?.createdAt
    ),
    source: entity?.source ?? entity?.provider ?? "LIVE_RUNTIME",
    intensity: num(entity?.intensity ?? entity?.reflectivity ?? entity?.rainIntensity),
    confidence: num(entity?.confidence),
    raw: clone(entity)
  };
}

function discover() {
  const sources = [
    global.RainArrivalStableStormEntities,
    global.RainArrivalLiveStormEntities,
    global.RainArrivalStormEntities,
    global.RainArrivalDetectedStormCells,
    global.RainArrivalStormCells,
    global.RainGuardAI?.V32?.stormEntities,
    global.RainGuardAI?.V32?.detectedStormCells,
    global.StormTrackingEngineV31?.getActiveCells?.(),
    global.StormCellTrackingV31?.getActiveCells?.(),
    global.stormCellTrackingEngine?.getActiveCells?.(),
    global.stormVisualizationEngine?.getCells?.()
  ];

  const unique = new Map();
  for (const source of sources) {
    for (const raw of arr(source)) {
      const entity = normalizeEntity(raw);
      if (!entity) continue;
      const key = `${entity.sourceId}|${entity.coordinate.latitude.toFixed(5)}|${entity.coordinate.longitude.toFixed(5)}`;
      unique.set(key, entity);
    }
  }
  return Array.from(unique.values());
}

function newId(entity) {
  const source = String(entity.source || "storm")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 12) || "storm";
  return `RST-${source}-${Date.now().toString(36)}-${(seq++).toString(36)}`;
}

function choose(entity, reserved) {
  const direct = sourceMap.get(entity.sourceId);
  if (direct && tracks.has(direct) && !reserved.has(direct)) {
    const track = tracks.get(direct);
    const distance = km(entity.coordinate, track.coordinate);
    const age = entity.timestamp - track.lastSeenAt;
    if (
      distance !== null &&
      distance <= CONFIG.maxMatchDistanceKm &&
      age >= -60000 &&
      age <= CONFIG.maxTrackAgeMs
    ) return { id: direct, method: "SOURCE_ID", distance };
  }

  let best = null;
  for (const [id, track] of tracks.entries()) {
    if (reserved.has(id)) continue;
    const distance = km(entity.coordinate, track.coordinate);
    const age = entity.timestamp - track.lastSeenAt;
    if (
      distance === null ||
      distance > CONFIG.maxMatchDistanceKm ||
      age < -60000 ||
      age > CONFIG.maxTrackAgeMs
    ) continue;

    const score =
      (1 - distance / CONFIG.maxMatchDistanceKm) * 0.75 +
      (1 - Math.max(0, age) / CONFIG.maxTrackAgeMs) * 0.25;

    if (!best || score > best.score) {
      best = { id, method: "SPATIAL_TEMPORAL", distance, score };
    }
  }
  return best;
}

function update(id, entity, match) {
  const previous = tracks.get(id);
  const track = {
    stableId: id,
    trackId: id,
    canonicalTrackId: id,
    sourceTrackId: entity.sourceId,
    coordinate: clone(entity.coordinate),
    latitude: entity.coordinate.latitude,
    longitude: entity.coordinate.longitude,
    timestamp: entity.timestamp,
    observedAt: new Date(entity.timestamp).toISOString(),
    firstSeenAt: previous?.firstSeenAt ?? entity.timestamp,
    lastSeenAt: entity.timestamp,
    updateCount: (previous?.updateCount ?? 0) + 1,
    previousCoordinate: clone(previous?.coordinate ?? null),
    source: entity.source,
    intensity: entity.intensity,
    confidence: entity.confidence,
    matchMethod: match?.method ?? "NEW_TRACK",
    matchDistanceKm: match?.distance ?? 0,
    raw: clone(entity.raw)
  };
  tracks.set(id, track);
  sourceMap.set(entity.sourceId, id);
  return track;
}

function cleanup(referenceTime) {
  for (const [id, track] of tracks.entries()) {
    if (referenceTime - track.lastSeenAt > CONFIG.maxTrackAgeMs) tracks.delete(id);
  }
  for (const [sourceId, id] of sourceMap.entries()) {
    if (!tracks.has(id)) sourceMap.delete(sourceId);
  }
  if (tracks.size > CONFIG.maxTracks) {
    const sorted = Array.from(tracks.values()).sort((a, b) => a.lastSeenAt - b.lastSeenAt);
    for (let i = 0; i < tracks.size - CONFIG.maxTracks; i += 1) {
      tracks.delete(sorted[i].stableId);
    }
  }
}

function publish(active) {
  const output = active.map(track => ({
    ...clone(track.raw),
    stableId: track.stableId,
    trackId: track.stableId,
    canonicalTrackId: track.stableId,
    sourceTrackId: track.sourceTrackId,
    cellId: track.stableId,
    coordinate: clone(track.coordinate),
    currentCoordinate: clone(track.coordinate),
    sourceCoordinate: clone(track.coordinate),
    latitude: track.latitude,
    longitude: track.longitude,
    timestamp: track.timestamp,
    observedAt: track.observedAt,
    stableIdentity: true,
    stableIdentityVersion: VERSION,
    stableIdentityEvidence: {
      updateCount: track.updateCount,
      matchMethod: track.matchMethod,
      matchDistanceKm: track.matchDistanceKm,
      firstSeenAt: track.firstSeenAt,
      lastSeenAt: track.lastSeenAt
    }
  }));

  global.RainArrivalStableStormEntities = clone(output);
  global.RainArrivalLiveStormEntities = clone(output);
  global.RainGuardAI = global.RainGuardAI || {};
  global.RainGuardAI.V32 = global.RainGuardAI.V32 || {};
  global.RainGuardAI.V32.stableStormEntities = clone(output);
  global.RainGuardAI.V32.liveStormEntities = clone(output);
  return output;
}

function reconcile() {
  const startedAt = now();
  const entities = discover();
  cleanup(startedAt);

  const reserved = new Set();
  const active = [];
  let matched = 0;
  let created = 0;

  for (const entity of entities) {
    const match = choose(entity, reserved);
    const id = match?.id ?? newId(entity);
    if (match) matched += 1; else created += 1;
    reserved.add(id);
    active.push(update(id, entity, match));
  }

  const published = publish(active);

  const historyResult =
    global.RainArrivalLiveTrackHistoryCaptureV32?.capture?.() ?? null;

  latestResult = {
    success: true,
    status: "STABLE_TRACK_IDENTITY_RECONCILIATION_COMPLETED",
    version: VERSION,
    build: BUILD,
    discoveredCount: entities.length,
    matchedThisCycle: matched,
    createdThisCycle: created,
    activeTrackCount: active.length,
    stableTrackStoreCount: tracks.size,
    publishedCount: published.length,
    historyResult: clone(historyResult),
    startedAt,
    completedAt: now(),
    durationMs: now() - startedAt
  };

  if (CONFIG.debug) {
    console.log("[RainArrival StableIdentity] Reconciliation result:", latestResult);
  }

  return clone(latestResult);
}

function start() {
  if (running) return { success: true, alreadyRunning: true };
  running = true;
  reconcile();
  timer = global.setInterval(reconcile, CONFIG.intervalMs);
  return { success: true, running: true, intervalMs: CONFIG.intervalMs };
}

function stop() {
  if (timer) global.clearInterval(timer);
  timer = null;
  running = false;
  return { success: true, running: false };
}

const engine = {
  module: "stableTrackIdentity",
  version: VERSION,
  build: BUILD,
  config: CONFIG,
  reconcile,
  start,
  stop,
  getAllTracks: () => clone(Array.from(tracks.values())),
  getTrack: id => clone(tracks.get(String(id)) ?? null),
  getLatestResult: () => clone(latestResult),
  getDiagnostics: () => ({
    module: "stableTrackIdentity",
    version: VERSION,
    build: BUILD,
    installed: true,
    running,
    stableTrackCount: tracks.size,
    sourceIdentityCount: sourceMap.size,
    latestResult: clone(latestResult)
  }),
  diagnose() {
    const result = this.getDiagnostics();
    console.log("[RainArrival StableIdentity]", result);
    return result;
  },
  printTable() {
    const rows = Array.from(tracks.values()).map(track => ({
      stableId: track.stableId,
      sourceTrackId: track.sourceTrackId,
      updateCount: track.updateCount,
      latitude: track.latitude,
      longitude: track.longitude,
      matchMethod: track.matchMethod,
      matchDistanceKm: Number((track.matchDistanceKm || 0).toFixed(3)),
      lastSeenAt: new Date(track.lastSeenAt).toISOString()
    }));
    console.table(rows);
    return rows;
  }
};

global.RainArrivalStableTrackIdentityV32 = engine;
global.RainGuardAI = global.RainGuardAI || {};
global.RainGuardAI.V32 = global.RainGuardAI.V32 || {};
global.RainGuardAI.V32.rainArrivalModules =
  global.RainGuardAI.V32.rainArrivalModules || {};
global.RainGuardAI.V32.rainArrivalModules.stableTrackIdentity = engine;

global.RainArrivalEngineV32?.register?.("stableTrackIdentity", engine);
global.RainArrivalOrchestratorV32?.register?.("stableTrackIdentity", engine);
global.reconcileRainArrivalStableTracks = reconcile;

if (CONFIG.autoStart) start();

console.log("[RainGuard AI V32] Stable Track Identity Engine loaded.", {
  version: VERSION,
  build: BUILD
});

})(typeof globalThis !== "undefined" ? globalThis : window);
