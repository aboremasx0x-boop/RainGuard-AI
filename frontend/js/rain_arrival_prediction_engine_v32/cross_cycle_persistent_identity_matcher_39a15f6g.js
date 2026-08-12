/**
 * RainGuard AI
 * Phase 39A-15F6G — Cross-Cycle Persistent Identity Matcher
 *
 * File: cross_cycle_persistent_identity_matcher_39a15f6g.js
 *
 * Purpose:
 *  - Reuse the same persistent storm identity across consecutive cycles.
 *  - Match observations using explicit aliases + spatial + temporal proximity.
 *  - Preserve real observations only; never fabricate coordinates/timestamps.
 *  - Feed the temporal accumulator with stable multi-point identities.
 */
(function installRainGuardCrossCyclePersistentIdentityMatcher(global) {
  "use strict";

  const PHASE = "39A-15F6G";
  const VERSION = "39A.15F6G.0";
  const BUILD = "rainguard-v39-cross-cycle-persistent-identity-matcher";

  const CONFIG = Object.freeze({
    maxInputRecords: 12000,
    maxIdentityMemory: 2500,
    maxObservationsPerIdentity: 12,
    maxSpatialDistanceKm: 45,
    strongSpatialDistanceKm: 15,
    maxTemporalGapMs: 6 * 60 * 60 * 1000,
    strongTemporalGapMs: 45 * 60 * 1000,
    minTemporalGapMs: 1000,
    minimumMatchScore: 0.62,
    aliasWeight: 0.34,
    spatialWeight: 0.38,
    temporalWeight: 0.23,
    intensityWeight: 0.05,
    coordinatePrecision: 5,
    dedupeWindowMs: 1500
  });

  const now = () => Date.now();
  const isObject = v => v !== null && typeof v === "object";

  function toFiniteNumber(value, fallback = null) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function cleanString(value) {
    if (value === null || value === undefined) return null;
    const s = String(value).trim();
    return s ? s : null;
  }

  function normalizeKey(value) {
    const s = cleanString(value);
    if (!s) return null;
    return s.toLowerCase().replace(/\s+/g, " ").replace(/[_\-–—]+/g, "-").trim();
  }

  function getLatitude(record) {
    if (!isObject(record)) return null;
    const c = isObject(record.coordinate) ? record.coordinate : {};
    for (const v of [record.latitude, record.lat, c.latitude, c.lat]) {
      const n = toFiniteNumber(v);
      if (n !== null && n >= -90 && n <= 90) return n;
    }
    return null;
  }

  function getLongitude(record) {
    if (!isObject(record)) return null;
    const c = isObject(record.coordinate) ? record.coordinate : {};
    for (const v of [record.longitude, record.lon, record.lng, c.longitude, c.lon, c.lng]) {
      const n = toFiniteNumber(v);
      if (n !== null && n >= -180 && n <= 180) return n;
    }
    return null;
  }

  function getTimestamp(record) {
    if (!isObject(record)) return null;
    const candidates = [
      record.timestamp,
      record.observedAt,
      record.observationTime,
      record.time,
      record.accumulatedAt,
      record.updatedAt,
      record.createdAt
    ];
    for (const value of candidates) {
      if (value === null || value === undefined) continue;
      if (typeof value === "number" && Number.isFinite(value)) {
        const n = value < 1e12 ? value * 1000 : value;
        if (n > 0) return Math.trunc(n);
      }
      if (typeof value === "string") {
        const numeric = Number(value);
        if (Number.isFinite(numeric) && numeric > 0) {
          return Math.trunc(numeric < 1e12 ? numeric * 1000 : numeric);
        }
        const parsed = Date.parse(value);
        if (Number.isFinite(parsed)) return parsed;
      }
    }
    return null;
  }

  function getIntensity(record) {
    if (!isObject(record)) return null;
    for (const v of [record.intensity, record.rainIntensity, record.reflectivity, record.dbz, record.score]) {
      const n = toFiniteNumber(v);
      if (n !== null) return n;
    }
    return null;
  }

  function getIdentityCandidates(record) {
    if (!isObject(record)) return [];
    const values = [
      record.persistentId,
      record.identity,
      record.identityId,
      record.canonicalTrackId,
      record.trackId,
      record.cellId,
      record.stormId,
      record.entityId,
      record.id,
      record.cityId,
      record.city,
      record.name
    ];
    if (Array.isArray(record.aliases)) values.push(...record.aliases);
    const seen = new Set();
    const out = [];
    for (const value of values) {
      const k = normalizeKey(value);
      if (!k || seen.has(k)) continue;
      seen.add(k);
      out.push(k);
    }
    return out;
  }

  function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371.0088;
    const toRad = d => d * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
  }

  function normalizeObservation(record, sourceContainer) {
    const latitude = getLatitude(record);
    const longitude = getLongitude(record);
    const timestamp = getTimestamp(record);
    if (latitude === null || longitude === null || timestamp === null) return null;

    const identityCandidates = getIdentityCandidates(record);
    return {
      identity: identityCandidates[0] || null,
      identityCandidates,
      trackId: cleanString(record.trackId) || cleanString(record.canonicalTrackId) || null,
      cellId: cleanString(record.cellId) || null,
      latitude,
      longitude,
      lat: latitude,
      lon: longitude,
      coordinate: { latitude, longitude },
      observedAt: timestamp,
      timestamp,
      intensity: getIntensity(record),
      confidence: toFiniteNumber(record.confidence, null),
      source: cleanString(record.source) || sourceContainer || "unknown",
      sourceContainer: sourceContainer || null,
      phase: cleanString(record.phase) || PHASE,
      original: record
    };
  }

  function observationFingerprint(obs) {
    return [
      obs.identity || "",
      obs.latitude.toFixed(CONFIG.coordinatePrecision),
      obs.longitude.toFixed(CONFIG.coordinatePrecision),
      Math.round(obs.timestamp / CONFIG.dedupeWindowMs)
    ].join("|");
  }

  function collectArraysDeep(root, maxDepth = 4) {
    const arrays = [];
    const seen = new Set();
    function visit(value, depth) {
      if (depth > maxDepth || value === null || value === undefined) return;
      if ((typeof value === "object" || typeof value === "function") && seen.has(value)) return;
      if (typeof value === "object" || typeof value === "function") seen.add(value);
      if (Array.isArray(value)) {
        if (value.length) arrays.push(value);
        return;
      }
      if (value instanceof Map) {
        for (const v of value.values()) visit(v, depth + 1);
        return;
      }
      if (isObject(value)) {
        for (const key of ["observations", "records", "items", "entities", "history", "feed", "data", "sample", "output", "results", "identities"]) {
          if (Object.prototype.hasOwnProperty.call(value, key)) visit(value[key], depth + 1);
        }
      }
    }
    visit(root, 0);
    return arrays;
  }

  function getSourceCandidates() {
    const names = [
      "RainGuardPersistentIdentityTemporalAccumulatorV39",
      "RainGuardPersistentObservationMemoryV39",
      "RainGuardCrossCycleObservationPersistenceV39",
      "RainGuardRecoveredLiveTrackHistoryV39",
      "RainGuardReconciledStormIdentitiesV39",
      "RainGuardPersistentStormIdentitiesV39",
      "RainGuardPersistentIdentityMotionRecordsV39",
      "RainGuardPersistentTemporalMotionFeedV39",
      "RainGuardPersistentTemporalMotionFeed",
      "RainArrivalLiveTrackHistory",
      "RainArrivalTrackStoreV32"
    ];
    const sources = [];
    for (const name of names) {
      if (global[name] !== undefined && global[name] !== null) {
        sources.push({ name, value: global[name] });
      }
    }
    return sources;
  }

  function extractRecords(source) {
    const out = [];
    if (!source) return out;
    const value = source.value;

    if (value instanceof Map) {
      for (const [key, item] of value.entries()) {
        if (Array.isArray(item)) {
          item.forEach(record => isObject(record) && out.push({ sourceName: source.name, key, record }));
        } else if (isObject(item)) {
          const nested = collectArraysDeep(item);
          if (nested.length) {
            nested.forEach(arr => arr.forEach(record => isObject(record) && out.push({ sourceName: source.name, key, record })));
          } else {
            out.push({ sourceName: source.name, key, record: item });
          }
        }
      }
      return out;
    }

    if (isObject(value) && value.tracks instanceof Map) {
      for (const [key, track] of value.tracks.entries()) {
        const nested = collectArraysDeep(track);
        if (nested.length) {
          nested.forEach(arr => arr.forEach(record => isObject(record) && out.push({ sourceName: source.name, key, record })));
        } else if (isObject(track)) {
          out.push({ sourceName: source.name, key, record: track });
        }
      }
    }

    collectArraysDeep(value).forEach(arr => {
      arr.forEach(record => isObject(record) && out.push({ sourceName: source.name, key: null, record }));
    });

    return out;
  }

  function makePersistentId(seed) {
    const s = normalizeKey(seed) || "storm";
    let hash = 2166136261;
    for (let i = 0; i < s.length; i++) {
      hash ^= s.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return "RG-STORM-" + (hash >>> 0).toString(36).toUpperCase();
  }

  function lastObservation(identity) {
    if (!identity || !Array.isArray(identity.observations) || !identity.observations.length) return null;
    return identity.observations.reduce((latest, obs) => {
      if (!latest) return obs;
      return Number(obs.timestamp) > Number(latest.timestamp) ? obs : latest;
    }, null);
  }

  function identityAliasSet(identity) {
    const set = new Set();
    for (const value of [identity.persistentId, identity.canonicalId, identity.trackId, identity.cellId, ...(identity.aliases || [])]) {
      const k = normalizeKey(value);
      if (k) set.add(k);
    }
    for (const obs of identity.observations || []) {
      for (const candidate of obs.identityCandidates || []) {
        const k = normalizeKey(candidate);
        if (k) set.add(k);
      }
    }
    return set;
  }

  function scoreCandidate(obs, identity) {
    const last = lastObservation(identity);
    if (!last) return null;

    const distanceKm = haversineKm(obs.latitude, obs.longitude, last.latitude, last.longitude);
    const deltaMs = Math.abs(obs.timestamp - last.timestamp);
    if (distanceKm > CONFIG.maxSpatialDistanceKm || deltaMs > CONFIG.maxTemporalGapMs) return null;

    const obsAliases = new Set(obs.identityCandidates || []);
    const idAliases = identityAliasSet(identity);
    let aliasScore = 0;
    for (const k of obsAliases) {
      if (idAliases.has(k)) { aliasScore = 1; break; }
    }

    let spatialScore;
    if (distanceKm <= CONFIG.strongSpatialDistanceKm) {
      spatialScore = Math.max(0.85, 1 - (distanceKm / CONFIG.strongSpatialDistanceKm) * 0.15);
    } else {
      const span = CONFIG.maxSpatialDistanceKm - CONFIG.strongSpatialDistanceKm;
      spatialScore = Math.max(0, 0.85 * (1 - (distanceKm - CONFIG.strongSpatialDistanceKm) / span));
    }

    let temporalScore;
    if (deltaMs <= CONFIG.strongTemporalGapMs) temporalScore = 1;
    else {
      const span = CONFIG.maxTemporalGapMs - CONFIG.strongTemporalGapMs;
      temporalScore = Math.max(0, 1 - (deltaMs - CONFIG.strongTemporalGapMs) / span);
    }

    let intensityScore = 0.5;
    if (obs.intensity !== null && last.intensity !== null) {
      const a = Number(obs.intensity), b = Number(last.intensity);
      if (Number.isFinite(a) && Number.isFinite(b)) {
        intensityScore = Math.max(0, 1 - Math.abs(a - b) / Math.max(1, Math.abs(a), Math.abs(b)));
      }
    }

    let score =
      aliasScore * CONFIG.aliasWeight +
      spatialScore * CONFIG.spatialWeight +
      temporalScore * CONFIG.temporalWeight +
      intensityScore * CONFIG.intensityWeight;

    if (aliasScore === 1) score += 0.08;
    score = Math.min(1, score);

    return { identity, score, aliasScore, spatialScore, temporalScore, intensityScore, distanceKm, deltaMs };
  }

  function chooseBestIdentity(obs, memory) {
    let best = null;
    for (const identity of memory.values()) {
      const candidate = scoreCandidate(obs, identity);
      if (!candidate) continue;
      if (!best || candidate.score > best.score) best = candidate;
    }
    return best && best.score >= CONFIG.minimumMatchScore ? best : null;
  }

  function ensureMemory() {
    if (!(global.RainGuardCrossCyclePersistentIdentityMemoryV39 instanceof Map)) {
      global.RainGuardCrossCyclePersistentIdentityMemoryV39 = new Map();
    }
    return global.RainGuardCrossCyclePersistentIdentityMemoryV39;
  }

  function createIdentity(obs) {
    const seed = [
      ...(obs.identityCandidates || []),
      obs.latitude.toFixed(3),
      obs.longitude.toFixed(3),
      Math.floor(obs.timestamp / (30 * 60 * 1000))
    ].join("|");
    const persistentId = makePersistentId(seed);
    return {
      persistentId,
      canonicalId: persistentId,
      aliases: Array.from(new Set(obs.identityCandidates || [])),
      trackId: obs.trackId || null,
      cellId: obs.cellId || null,
      observations: [],
      firstSeenAt: obs.timestamp,
      lastSeenAt: obs.timestamp,
      createdAt: now(),
      updatedAt: now(),
      state: "ACTIVE",
      phase: PHASE,
      version: VERSION
    };
  }

  function addObservation(identity, obs) {
    const fingerprints = new Set((identity.observations || []).map(observationFingerprint));
    const fp = observationFingerprint(obs);
    if (fingerprints.has(fp)) return { added: false, duplicate: true };

    const enriched = {
      ...obs,
      persistentId: identity.persistentId,
      canonicalPersistentId: identity.persistentId,
      matchedPhase: PHASE,
      matchedAt: now()
    };

    identity.observations.push(enriched);
    identity.observations.sort((a, b) => Number(a.timestamp) - Number(b.timestamp));
    if (identity.observations.length > CONFIG.maxObservationsPerIdentity) {
      identity.observations = identity.observations.slice(-CONFIG.maxObservationsPerIdentity);
    }
    for (const alias of obs.identityCandidates || []) {
      if (!identity.aliases.includes(alias)) identity.aliases.push(alias);
    }
    identity.firstSeenAt = Math.min(identity.firstSeenAt || obs.timestamp, obs.timestamp);
    identity.lastSeenAt = Math.max(identity.lastSeenAt || obs.timestamp, obs.timestamp);
    identity.updatedAt = now();
    if (!identity.trackId && obs.trackId) identity.trackId = obs.trackId;
    if (!identity.cellId && obs.cellId) identity.cellId = obs.cellId;
    return { added: true, duplicate: false, observation: enriched };
  }

  function trimMemory(memory) {
    if (memory.size <= CONFIG.maxIdentityMemory) return 0;
    const ordered = [...memory.values()].sort((a, b) => Number(a.lastSeenAt || 0) - Number(b.lastSeenAt || 0));
    const removeCount = memory.size - CONFIG.maxIdentityMemory;
    for (let i = 0; i < removeCount; i++) memory.delete(ordered[i].persistentId);
    return removeCount;
  }

  function publishOutputs(memory) {
    const identities = [...memory.values()].map(id => ({ ...id, observations: [...id.observations] }));
    const records = [];
    for (const identity of identities) {
      for (const obs of identity.observations || []) {
        records.push({ ...obs, persistentId: identity.persistentId, canonicalTrackId: identity.persistentId });
      }
    }
    global.RainGuardCrossCyclePersistentIdentitiesV39 = identities;
    global.RainGuardCrossCycleMatchedObservationRecordsV39 = records;
    global.RainGuardPersistentIdentityTemporalInputV39 = records;
    return { identities, records };
  }

  async function runRainGuardCrossCyclePersistentIdentityMatcher(options = {}) {
    const startedAt = now();
    const memory = ensureMemory();

    try {
      const sources = getSourceCandidates();
      const rawEntries = [];
      for (const source of sources) {
        for (const entry of extractRecords(source)) {
          if (rawEntries.length >= CONFIG.maxInputRecords) break;
          rawEntries.push(entry);
        }
        if (rawEntries.length >= CONFIG.maxInputRecords) break;
      }

      const normalized = [];
      const seen = new Set();
      let invalidObservationCount = 0;
      let duplicateInputCount = 0;

      for (const entry of rawEntries) {
        const obs = normalizeObservation(entry.record, entry.sourceName);
        if (!obs) { invalidObservationCount++; continue; }
        const fp = observationFingerprint(obs);
        if (seen.has(fp)) { duplicateInputCount++; continue; }
        seen.add(fp);
        normalized.push(obs);
      }
      normalized.sort((a, b) => a.timestamp - b.timestamp);

      let matchedIdentityCount = 0;
      let reusedPersistentIdentityCount = 0;
      let newPersistentIdentityCount = 0;
      let persistedObservationCount = 0;
      const matchedSample = [];
      const newIdentitySample = [];

      for (const obs of normalized) {
        const match = chooseBestIdentity(obs, memory);
        if (match) {
          const added = addObservation(match.identity, obs);
          if (added.added) {
            matchedIdentityCount++;
            reusedPersistentIdentityCount++;
            persistedObservationCount++;
            if (matchedSample.length < 20) {
              matchedSample.push({
                persistentId: match.identity.persistentId,
                score: Number(match.score.toFixed(4)),
                distanceKm: Number(match.distanceKm.toFixed(3)),
                deltaMinutes: Number((match.deltaMs / 60000).toFixed(2)),
                trackId: obs.trackId,
                source: obs.source
              });
            }
          }
          continue;
        }

        const identity = createIdentity(obs);
        const added = addObservation(identity, obs);
        if (added.added) {
          memory.set(identity.persistentId, identity);
          newPersistentIdentityCount++;
          persistedObservationCount++;
          if (newIdentitySample.length < 20) {
            newIdentitySample.push({
              persistentId: identity.persistentId,
              trackId: obs.trackId,
              latitude: obs.latitude,
              longitude: obs.longitude,
              timestamp: obs.timestamp
            });
          }
        }
      }

      const evictedIdentityCount = trimMemory(memory);
      let multiPointIdentityCount = 0;
      let singlePointIdentityCount = 0;
      let maxObservedPointsPerIdentity = 0;

      for (const identity of memory.values()) {
        const count = Array.isArray(identity.observations) ? identity.observations.length : 0;
        if (count >= 2) multiPointIdentityCount++;
        else if (count === 1) singlePointIdentityCount++;
        maxObservedPointsPerIdentity = Math.max(maxObservedPointsPerIdentity, count);
      }

      const published = publishOutputs(memory);
      const status = multiPointIdentityCount > 0
        ? "CROSS_CYCLE_PERSISTENT_IDENTITIES_MATCHED"
        : memory.size > 0
          ? "PERSISTENT_IDENTITIES_READY_SINGLE_POINT_ONLY"
          : "NO_VALID_PERSISTENT_IDENTITIES";

      const result = {
        success: true,
        phase: PHASE,
        version: VERSION,
        build: BUILD,
        status,
        generatedAt: now(),
        durationMs: now() - startedAt,
        sourceCount: sources.length,
        sourceRecordCount: rawEntries.length,
        normalizedObservationCount: normalized.length,
        invalidObservationCount,
        duplicateInputCount,
        identityCount: memory.size,
        matchedIdentityCount,
        reusedPersistentIdentityCount,
        newPersistentIdentityCount,
        persistedObservationCount,
        multiPointIdentityCount,
        singlePointIdentityCount,
        maxObservedPointsPerIdentity,
        evictedIdentityCount,
        matchedSample,
        newIdentitySample,
        identitiesSample: published.identities.slice(0, 20)
      };

      global.RainGuardCrossCyclePersistentIdentityMatcherLastResultV39 = result;
      console.log(`[RainGuard Phase ${PHASE}] Cross-Cycle Persistent Identity Matcher result:`, result);
      return result;
    } catch (error) {
      const result = {
        success: false,
        phase: PHASE,
        version: VERSION,
        build: BUILD,
        status: "CROSS_CYCLE_PERSISTENT_IDENTITY_MATCHER_ERROR",
        generatedAt: now(),
        durationMs: now() - startedAt,
        error: error && error.message ? error.message : String(error)
      };
      global.RainGuardCrossCyclePersistentIdentityMatcherLastResultV39 = result;
      console.error(`[RainGuard Phase ${PHASE}] Matcher error:`, error);
      return result;
    }
  }

  function diagnoseRainGuardCrossCyclePersistentIdentityMatcher() {
    const memory = ensureMemory();
    let multiPointIdentityCount = 0;
    let singlePointIdentityCount = 0;
    let maxObservedPointsPerIdentity = 0;
    let totalObservations = 0;
    const sample = [];

    for (const identity of memory.values()) {
      const count = Array.isArray(identity.observations) ? identity.observations.length : 0;
      totalObservations += count;
      if (count >= 2) multiPointIdentityCount++;
      else if (count === 1) singlePointIdentityCount++;
      maxObservedPointsPerIdentity = Math.max(maxObservedPointsPerIdentity, count);
      if (sample.length < 20) {
        sample.push({
          persistentId: identity.persistentId,
          aliases: identity.aliases,
          observationCount: count,
          firstSeenAt: identity.firstSeenAt,
          lastSeenAt: identity.lastSeenAt,
          lastObservation: lastObservation(identity)
        });
      }
    }

    const diagnostic = {
      success: true,
      phase: PHASE,
      version: VERSION,
      build: BUILD,
      installed: true,
      identityCount: memory.size,
      totalObservations,
      multiPointIdentityCount,
      singlePointIdentityCount,
      maxObservedPointsPerIdentity,
      sample,
      lastResult: global.RainGuardCrossCyclePersistentIdentityMatcherLastResultV39 || null
    };
    console.log(`[RainGuard Phase ${PHASE}] Diagnostic:`, diagnostic);
    return diagnostic;
  }

  function resetRainGuardCrossCyclePersistentIdentityMatcher() {
    global.RainGuardCrossCyclePersistentIdentityMemoryV39 = new Map();
    global.RainGuardCrossCyclePersistentIdentitiesV39 = [];
    global.RainGuardCrossCycleMatchedObservationRecordsV39 = [];
    global.RainGuardPersistentIdentityTemporalInputV39 = [];
    global.RainGuardCrossCyclePersistentIdentityMatcherLastResultV39 = null;
    const result = { success: true, phase: PHASE, version: VERSION, status: "RESET_COMPLETE" };
    console.log(`[RainGuard Phase ${PHASE}] Reset complete.`);
    return result;
  }

  global.runRainGuardCrossCyclePersistentIdentityMatcher = runRainGuardCrossCyclePersistentIdentityMatcher;
  global.diagnoseRainGuardCrossCyclePersistentIdentityMatcher = diagnoseRainGuardCrossCyclePersistentIdentityMatcher;
  global.resetRainGuardCrossCyclePersistentIdentityMatcher = resetRainGuardCrossCyclePersistentIdentityMatcher;

  global.RainGuardCrossCyclePersistentIdentityMatcherV39 = {
    phase: PHASE,
    version: VERSION,
    build: BUILD,
    config: CONFIG,
    run: runRainGuardCrossCyclePersistentIdentityMatcher,
    diagnose: diagnoseRainGuardCrossCyclePersistentIdentityMatcher,
    reset: resetRainGuardCrossCyclePersistentIdentityMatcher,
    get memory() { return ensureMemory(); },
    get lastResult() { return global.RainGuardCrossCyclePersistentIdentityMatcherLastResultV39 || null; }
  };

  console.log(`[RainGuard Phase ${PHASE}] ${BUILD} installed.`, {
    phase: PHASE,
    version: VERSION,
    runner: "runRainGuardCrossCyclePersistentIdentityMatcher",
    diagnostic: "diagnoseRainGuardCrossCyclePersistentIdentityMatcher"
  });
})(window);
