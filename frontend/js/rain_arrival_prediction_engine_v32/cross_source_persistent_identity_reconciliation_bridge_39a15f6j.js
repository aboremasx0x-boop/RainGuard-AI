/**
 * RainGuard AI
 * Phase 39A-15F6J
 * Cross-Source Persistent Identity Reconciliation Bridge
 *
 * Purpose
 * -------
 * Reconcile observations coming from multiple RainGuard sources into stable
 * persistent identities before temporal coordinate-change and motion-vector
 * recovery.
 *
 * Design goals
 * ------------
 * - Reuse an existing persistent identity whenever possible.
 * - Never fabricate coordinates or timestamps.
 * - Prefer exact identity aliases / track IDs before spatial-temporal matching.
 * - Keep ambiguous matches separated.
 * - Preserve source references and original observations.
 * - Produce multi-point identities that can be consumed by 39A-15F6I and 39A-15F6H.
 */

(function installRainGuardCrossSourcePersistentIdentityReconciliationBridge(global) {
  "use strict";

  const PHASE = "39A-15F6J";
  const VERSION = "39A.15F6J.0";
  const BUILD = "rainguard-v39-cross-source-persistent-identity-reconciliation-bridge";

  if (global.runRainGuardCrossSourcePersistentIdentityReconciliationBridge) {
    return;
  }

  const CONFIG = Object.freeze({
    maxInputRecords: 20000,
    maxOutputIdentities: 3000,
    maxPointsPerIdentity: 16,
    maxTimeGapMs: 90 * 60 * 1000,
    preferredTimeGapMs: 20 * 60 * 1000,
    maxSpatialGapKm: 65,
    preferredSpatialGapKm: 18,
    exactCoordinateToleranceDeg: 0.00008,
    minSpatialTemporalScore: 0.56,
    maxCandidateScan: 2500,
    preserveOriginal: true
  });

  const now = () => Date.now();

  const STATE = global.RainGuardCrossSourcePersistentIdentityReconciliationV39 || {
    phase: PHASE,
    version: VERSION,
    build: BUILD,
    installed: true,
    running: false,
    lastRun: null,
    lastError: null,
    identities: new Map(),
    aliases: new Map(),
    stats: {
      runs: 0,
      input: 0,
      accepted: 0,
      rejected: 0,
      exactMatches: 0,
      aliasMatches: 0,
      spatialTemporalMatches: 0,
      createdIdentities: 0,
      multiPointIdentities: 0
    }
  };

  global.RainGuardCrossSourcePersistentIdentityReconciliationV39 = STATE;

  function isObject(v) {
    return v !== null && typeof v === "object";
  }

  function finiteNumber(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function stringOrNull(v) {
    if (v === null || v === undefined) return null;
    const s = String(v).trim();
    return s ? s : null;
  }

  function timestampOf(o) {
    if (!isObject(o)) return null;
    const candidates = [
      o.observedAt, o.timestamp, o.time, o.ts, o.accumulatedAt,
      o.createdAt, o.updatedAt, o.detectedAt, o.generatedAt
    ];
    for (const v of candidates) {
      const n = finiteNumber(v);
      if (n !== null && n > 0) return n;
      if (typeof v === "string") {
        const t = Date.parse(v);
        if (Number.isFinite(t)) return t;
      }
    }
    return null;
  }

  function coordinateOf(o) {
    if (!isObject(o)) return null;

    const nested = isObject(o.coordinate) ? o.coordinate : null;
    const lat = finiteNumber(
      o.latitude ?? o.lat ?? nested?.latitude ?? nested?.lat
    );
    const lon = finiteNumber(
      o.longitude ?? o.lon ?? o.lng ??
      nested?.longitude ?? nested?.lon ?? nested?.lng
    );

    if (lat === null || lon === null) return null;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
    if (lat === 0 && lon === 0) return null;

    return { latitude: lat, longitude: lon };
  }

  function sourceOf(o) {
    return stringOrNull(
      o.source ?? o.sourceName ?? o.provider ?? o.origin ?? o.adapter ??
      o.originalSource ?? o.phase
    ) || "UNKNOWN";
  }

  function normalizeToken(v) {
    const s = stringOrNull(v);
    return s ? s.toLowerCase().replace(/\s+/g, " ").trim() : null;
  }

  function identityTokens(o) {
    if (!isObject(o)) return [];
    const raw = [
      o.persistentId,
      o.canonicalTrackId,
      o.identity,
      o.identityId,
      o.trackId,
      o.cellId,
      o.stormId,
      o.entityId,
      o.id,
      o.name,
      o.city,
      o.cityId
    ];

    if (Array.isArray(o.aliases)) raw.push(...o.aliases);

    const seen = new Set();
    const out = [];
    for (const v of raw) {
      const t = normalizeToken(v);
      if (!t || seen.has(t)) continue;
      seen.add(t);
      out.push(t);
    }
    return out;
  }

  function canonicalLabel(o) {
    const candidates = [
      o.persistentId, o.canonicalTrackId, o.identityId, o.identity,
      o.trackId, o.cellId, o.stormId, o.entityId, o.id
    ];
    for (const c of candidates) {
      const s = stringOrNull(c);
      if (s) return s;
    }
    return null;
  }

  function haversineKm(a, b) {
    if (!a || !b) return Infinity;
    const R = 6371;
    const dLat = (b.latitude - a.latitude) * Math.PI / 180;
    const dLon = (b.longitude - a.longitude) * Math.PI / 180;
    const lat1 = a.latitude * Math.PI / 180;
    const lat2 = b.latitude * Math.PI / 180;
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  function pointKey(p) {
    return `${p.latitude.toFixed(5)},${p.longitude.toFixed(5)}@${p.observedAt}`;
  }

  function observationFrom(raw, index) {
    const coordinate = coordinateOf(raw);
    const observedAt = timestampOf(raw);
    if (!coordinate || !observedAt) return null;

    return {
      index,
      source: sourceOf(raw),
      identityTokens: identityTokens(raw),
      canonicalLabel: canonicalLabel(raw),
      latitude: coordinate.latitude,
      longitude: coordinate.longitude,
      coordinate,
      observedAt,
      confidence: finiteNumber(raw.confidence),
      intensity: finiteNumber(raw.intensity),
      phase: stringOrNull(raw.phase),
      original: CONFIG.preserveOriginal ? raw : undefined
    };
  }

  function addSourceName(target, source) {
    if (!target.sources.includes(source)) target.sources.push(source);
  }

  function createIdentity(obs, serial) {
    const fallback = `RG-XID-${obs.observedAt.toString(36)}-${serial.toString(36)}`;
    const persistentId = obs.canonicalLabel || fallback;

    return {
      persistentId,
      aliases: [...obs.identityTokens],
      sources: [obs.source],
      observations: [],
      observationCount: 0,
      firstSeenAt: obs.observedAt,
      lastSeenAt: obs.observedAt,
      firstCoordinate: { ...obs.coordinate },
      lastCoordinate: { ...obs.coordinate },
      uniqueCoordinateKeys: new Set(),
      createdAt: now(),
      updatedAt: now(),
      matchTypes: []
    };
  }

  function attachObservation(identity, obs, matchType) {
    const key = pointKey(obs);
    if (identity.observations.some(p => pointKey(p) === key && p.source === obs.source)) {
      return false;
    }

    identity.observations.push({
      source: obs.source,
      latitude: obs.latitude,
      longitude: obs.longitude,
      coordinate: { ...obs.coordinate },
      observedAt: obs.observedAt,
      confidence: obs.confidence,
      intensity: obs.intensity,
      phase: obs.phase,
      original: obs.original
    });

    identity.observations.sort((a, b) => a.observedAt - b.observedAt);

    if (identity.observations.length > CONFIG.maxPointsPerIdentity) {
      identity.observations = identity.observations.slice(-CONFIG.maxPointsPerIdentity);
    }

    identity.observationCount = identity.observations.length;
    identity.firstSeenAt = identity.observations[0].observedAt;
    identity.lastSeenAt = identity.observations[identity.observations.length - 1].observedAt;
    identity.firstCoordinate = {
      latitude: identity.observations[0].latitude,
      longitude: identity.observations[0].longitude
    };
    identity.lastCoordinate = {
      latitude: identity.observations[identity.observations.length - 1].latitude,
      longitude: identity.observations[identity.observations.length - 1].longitude
    };

    identity.uniqueCoordinateKeys = new Set(
      identity.observations.map(p => `${p.latitude.toFixed(5)},${p.longitude.toFixed(5)}`)
    );

    for (const token of obs.identityTokens) {
      if (!identity.aliases.includes(token)) identity.aliases.push(token);
    }
    addSourceName(identity, obs.source);

    identity.updatedAt = now();
    identity.matchTypes.push(matchType);
    if (identity.matchTypes.length > 24) identity.matchTypes.shift();
    return true;
  }

  function rebuildAliasIndex(identities) {
    const aliases = new Map();
    for (const identity of identities.values()) {
      aliases.set(normalizeToken(identity.persistentId), identity.persistentId);
      for (const a of identity.aliases || []) {
        const n = normalizeToken(a);
        if (n) aliases.set(n, identity.persistentId);
      }
    }
    return aliases;
  }

  function getExistingIdentitySources() {
    const names = [
      "RainGuardCrossCyclePersistentIdentityMatchesV39",
      "RainGuardPersistentIdentityTemporalAccumulatorV39",
      "RainGuardPersistentObservationMemoryV39",
      "RainGuardRecoveredLiveTrackHistoryV39",
      "RainGuardReconciledIdentitiesV39",
      "RainGuardPersistentStormIdentitiesV39"
    ];

    const out = [];

    for (const name of names) {
      const value = global[name];

      if (value instanceof Map) {
        for (const v of value.values()) {
          if (isObject(v)) out.push(v);
        }
      } else if (Array.isArray(value)) {
        for (const v of value) {
          if (isObject(v)) out.push(v);
        }
      } else if (isObject(value)) {
        if (value.identities instanceof Map) {
          for (const v of value.identities.values()) if (isObject(v)) out.push(v);
        } else if (Array.isArray(value.identities)) {
          out.push(...value.identities.filter(isObject));
        } else if (Array.isArray(value.records)) {
          out.push(...value.records.filter(isObject));
        } else if (Array.isArray(value.observations)) {
          out.push(...value.observations.filter(isObject));
        }
      }
    }

    return out;
  }

  function collectObservationCandidates() {
    const sourceNames = [
      "RainGuardPersistentIdentityMotionRecordsV39",
      "RainGuardPersistentIdentityTemporalAccumulatorV39",
      "RainGuardPersistentObservationMemoryV39",
      "RainGuardRecoveredLiveTrackHistoryV39",
      "RainGuardReconciledIdentitiesV39",
      "RainGuardLiveTrackHistory",
      "RainArrivalLiveTrackHistory",
      "RainGuardLiveStormEntities",
      "RainGuardStormEntitiesV39"
    ];

    const records = [];
    const visited = new Set();

    function pushValue(value, label, depth = 0) {
      if (value == null || depth > 4) return;
      if ((typeof value === "object" || typeof value === "function") && visited.has(value)) return;
      if (typeof value === "object" || typeof value === "function") visited.add(value);

      if (Array.isArray(value)) {
        for (const item of value) pushValue(item, label, depth + 1);
        return;
      }

      if (value instanceof Map) {
        for (const item of value.values()) pushValue(item, label, depth + 1);
        return;
      }

      if (!isObject(value)) return;

      const c = coordinateOf(value);
      const t = timestampOf(value);
      if (c && t) {
        records.push(value);
        if (records.length >= CONFIG.maxInputRecords) return;
      }

      const preferredKeys = [
        "observations", "records", "history", "points", "items",
        "entities", "tracks", "identities", "data", "values"
      ];
      for (const key of preferredKeys) {
        if (records.length >= CONFIG.maxInputRecords) break;
        if (value[key] !== undefined) pushValue(value[key], `${label}.${key}`, depth + 1);
      }
    }

    for (const name of sourceNames) {
      if (records.length >= CONFIG.maxInputRecords) break;
      try {
        pushValue(global[name], name);
      } catch (_) {}
    }

    return records.slice(0, CONFIG.maxInputRecords);
  }

  function seedIdentityMap(existingRecords) {
    const map = new Map();
    let serial = 0;

    for (const raw of existingRecords) {
      if (!isObject(raw)) continue;

      const obsArray = Array.isArray(raw.observations) ? raw.observations :
                       Array.isArray(raw.records) ? raw.records :
                       Array.isArray(raw.points) ? raw.points : [];

      let syntheticSeed = null;
      const pid = canonicalLabel(raw);
      if (pid) {
        const coord = coordinateOf(raw);
        const time = timestampOf(raw);
        if (coord && time) {
          syntheticSeed = observationFrom(raw, serial++);
        } else if (obsArray.length) {
          const first = observationFrom(obsArray[0], serial++);
          if (first) {
            first.canonicalLabel = pid;
            first.identityTokens = Array.from(new Set([
              ...first.identityTokens,
              ...identityTokens(raw),
              normalizeToken(pid)
            ].filter(Boolean)));
            syntheticSeed = first;
          }
        }
      }

      if (!syntheticSeed) continue;

      const identity = createIdentity(syntheticSeed, serial++);
      identity.persistentId = pid || identity.persistentId;

      if (!map.has(identity.persistentId)) {
        map.set(identity.persistentId, identity);
      }
      const target = map.get(identity.persistentId);

      const rawPoints = obsArray.length ? obsArray : [raw];
      for (const p of rawPoints) {
        const obs = observationFrom(p, serial++);
        if (obs) attachObservation(target, obs, "SEED");
      }
    }

    return map;
  }

  function exactAliasMatch(obs, identities, aliasIndex) {
    for (const token of obs.identityTokens) {
      const pid = aliasIndex.get(token);
      if (pid && identities.has(pid)) return identities.get(pid);
    }
    return null;
  }

  function spatialTemporalScore(obs, identity) {
    const latest = identity.observations[identity.observations.length - 1];
    if (!latest) return -1;

    const dt = Math.abs(obs.observedAt - latest.observedAt);
    if (dt > CONFIG.maxTimeGapMs) return -1;

    const distanceKm = haversineKm(obs.coordinate, latest.coordinate);
    if (!Number.isFinite(distanceKm) || distanceKm > CONFIG.maxSpatialGapKm) return -1;

    const timeScore = Math.max(0, 1 - dt / CONFIG.maxTimeGapMs);
    const spatialScore = Math.max(0, 1 - distanceKm / CONFIG.maxSpatialGapKm);

    let sourceBonus = identity.sources.includes(obs.source) ? 0.03 : 0;
    let tokenBonus = 0;
    if (obs.identityTokens.some(t => identity.aliases.includes(t))) tokenBonus = 0.35;

    const score = (0.50 * spatialScore) + (0.42 * timeScore) + sourceBonus + tokenBonus;
    return Math.min(1, score);
  }

  function findSpatialTemporalMatch(obs, identities) {
    let best = null;
    let bestScore = -1;
    let scanned = 0;

    for (const identity of identities.values()) {
      if (++scanned > CONFIG.maxCandidateScan) break;
      const score = spatialTemporalScore(obs, identity);
      if (score > bestScore) {
        bestScore = score;
        best = identity;
      }
    }

    return best && bestScore >= CONFIG.minSpatialTemporalScore
      ? { identity: best, score: bestScore }
      : null;
  }

  function serializeIdentity(identity) {
    return {
      persistentId: identity.persistentId,
      aliases: [...identity.aliases],
      sources: [...identity.sources],
      observationCount: identity.observationCount,
      uniqueCoordinateCount: identity.uniqueCoordinateKeys.size,
      firstSeenAt: identity.firstSeenAt,
      lastSeenAt: identity.lastSeenAt,
      firstCoordinate: identity.firstCoordinate,
      lastCoordinate: identity.lastCoordinate,
      observations: identity.observations.map(p => ({ ...p })),
      createdAt: identity.createdAt,
      updatedAt: identity.updatedAt,
      matchTypes: [...identity.matchTypes]
    };
  }

  function publish(identities, result) {
    const array = [...identities.values()]
      .sort((a, b) => b.lastSeenAt - a.lastSeenAt)
      .slice(0, CONFIG.maxOutputIdentities)
      .map(serializeIdentity);

    global.RainGuardCrossSourcePersistentIdentitiesV39 = array;
    global.RainGuardCrossSourcePersistentIdentityMapV39 =
      new Map(array.map(x => [x.persistentId, x]));

    // Compatibility feeds for downstream phases.
    global.RainGuardPersistentIdentityMotionRecordsV39 = array.flatMap(identity =>
      identity.observations.map(obs => ({
        persistentId: identity.persistentId,
        canonicalTrackId: identity.persistentId,
        identity: identity.persistentId,
        aliases: identity.aliases,
        source: obs.source,
        latitude: obs.latitude,
        longitude: obs.longitude,
        lat: obs.latitude,
        lon: obs.longitude,
        coordinate: obs.coordinate,
        observedAt: obs.observedAt,
        timestamp: obs.observedAt,
        confidence: obs.confidence,
        intensity: obs.intensity,
        phase: PHASE,
        original: obs.original
      }))
    );

    global.RainGuardCrossSourcePersistentIdentityReconciliationLastResultV39 = result;
  }

  async function run(options = {}) {
    if (STATE.running) {
      return {
        success: false,
        phase: PHASE,
        version: VERSION,
        build: BUILD,
        status: "ALREADY_RUNNING"
      };
    }

    STATE.running = true;
    const started = now();

    try {
      const rawCandidates = Array.isArray(options.records)
        ? options.records.slice(0, CONFIG.maxInputRecords)
        : collectObservationCandidates();

      const normalized = [];
      const rejectionCounts = {
        INVALID_RECORD: 0,
        INVALID_COORDINATE_OR_TIME: 0
      };

      for (let i = 0; i < rawCandidates.length; i++) {
        const raw = rawCandidates[i];
        if (!isObject(raw)) {
          rejectionCounts.INVALID_RECORD++;
          continue;
        }
        const obs = observationFrom(raw, i);
        if (!obs) {
          rejectionCounts.INVALID_COORDINATE_OR_TIME++;
          continue;
        }
        normalized.push(obs);
      }

      normalized.sort((a, b) => a.observedAt - b.observedAt);

      const existingSeeds = getExistingIdentitySources();
      const identities = seedIdentityMap(existingSeeds);
      let aliasIndex = rebuildAliasIndex(identities);

      let exactMatched = 0;
      let aliasMatched = 0;
      let spatialTemporalMatched = 0;
      let created = 0;
      let accepted = 0;
      let duplicateObservationCount = 0;
      let serial = identities.size + 1;

      for (const obs of normalized) {
        let identity = null;
        let matchType = null;

        const canonical = obs.canonicalLabel ? normalizeToken(obs.canonicalLabel) : null;
        if (canonical) {
          const pid = aliasIndex.get(canonical);
          if (pid && identities.has(pid)) {
            identity = identities.get(pid);
            matchType = "EXACT_IDENTITY";
            exactMatched++;
          }
        }

        if (!identity) {
          identity = exactAliasMatch(obs, identities, aliasIndex);
          if (identity) {
            matchType = "ALIAS";
            aliasMatched++;
          }
        }

        if (!identity) {
          const candidate = findSpatialTemporalMatch(obs, identities);
          if (candidate) {
            identity = candidate.identity;
            matchType = "SPATIAL_TEMPORAL";
            spatialTemporalMatched++;
          }
        }

        if (!identity) {
          identity = createIdentity(obs, serial++);
          identities.set(identity.persistentId, identity);
          created++;
          matchType = "NEW_IDENTITY";
        }

        if (attachObservation(identity, obs, matchType)) {
          accepted++;
        } else {
          duplicateObservationCount++;
        }

        // Refresh aliases after every accepted observation so later sources can reuse it.
        for (const token of identity.aliases) {
          aliasIndex.set(normalizeToken(token), identity.persistentId);
        }
        aliasIndex.set(normalizeToken(identity.persistentId), identity.persistentId);
      }

      const output = [...identities.values()].filter(x => x.observationCount > 0);
      const multiPoint = output.filter(x => x.observationCount >= 2);
      const coordinateChange = output.filter(x => x.uniqueCoordinateKeys.size >= 2);
      const crossSource = output.filter(x => x.sources.length >= 2);

      const result = {
        success: true,
        phase: PHASE,
        version: VERSION,
        build: BUILD,
        status:
          multiPoint.length > 0
            ? "CROSS_SOURCE_PERSISTENT_IDENTITIES_RECONCILED"
            : "OBSERVATIONS_RECONCILED_BUT_NO_MULTI_POINT_IDENTITY",

        durationMs: now() - started,
        sourceRecordCount: rawCandidates.length,
        normalizedRecordCount: normalized.length,
        rejectedRecordCount:
          rejectionCounts.INVALID_RECORD + rejectionCounts.INVALID_COORDINATE_OR_TIME,
        duplicateObservationCount,
        existingSeedIdentityCount: existingSeeds.length,
        identityCount: output.length,
        createdIdentityCount: created,
        reusedPersistentIdentityCount:
          exactMatched + aliasMatched + spatialTemporalMatched,
        exactIdentityMatchCount: exactMatched,
        aliasMatchCount: aliasMatched,
        spatialTemporalMatchCount: spatialTemporalMatched,
        multiPointIdentityCount: multiPoint.length,
        coordinateChangeIdentityCount: coordinateChange.length,
        crossSourceIdentityCount: crossSource.length,
        maxObservedPointsPerIdentity: output.reduce(
          (m, x) => Math.max(m, x.observationCount), 0
        ),
        maxUniqueCoordinatesPerIdentity: output.reduce(
          (m, x) => Math.max(m, x.uniqueCoordinateKeys.size), 0
        ),
        sample: output.slice(0, 10).map(serializeIdentity),
        multiPointSample: multiPoint.slice(0, 10).map(serializeIdentity),
        rejectionCounts
      };

      STATE.identities = new Map(output.map(x => [x.persistentId, x]));
      STATE.aliases = aliasIndex;
      STATE.lastRun = now();
      STATE.lastError = null;
      STATE.stats.runs++;
      STATE.stats.input += rawCandidates.length;
      STATE.stats.accepted += accepted;
      STATE.stats.rejected += result.rejectedRecordCount;
      STATE.stats.exactMatches += exactMatched;
      STATE.stats.aliasMatches += aliasMatched;
      STATE.stats.spatialTemporalMatches += spatialTemporalMatched;
      STATE.stats.createdIdentities += created;
      STATE.stats.multiPointIdentities += multiPoint.length;

      publish(STATE.identities, result);

      console.log(`[RainGuard Phase ${PHASE}] Cross-Source Persistent Identity Reconciliation result:`);
      console.log(result);

      return result;

    } catch (error) {
      STATE.lastError = error;
      const result = {
        success: false,
        phase: PHASE,
        version: VERSION,
        build: BUILD,
        status: "CROSS_SOURCE_RECONCILIATION_FAILED",
        durationMs: now() - started,
        error: String(error && error.message ? error.message : error)
      };
      console.error(`[RainGuard Phase ${PHASE}]`, error);
      return result;
    } finally {
      STATE.running = false;
    }
  }

  function diagnose() {
    const last = global.RainGuardCrossSourcePersistentIdentityReconciliationLastResultV39 || null;
    return {
      success: true,
      phase: PHASE,
      version: VERSION,
      build: BUILD,
      installed: true,
      running: STATE.running,
      identityCount: STATE.identities instanceof Map ? STATE.identities.size : 0,
      aliasCount: STATE.aliases instanceof Map ? STATE.aliases.size : 0,
      lastRun: STATE.lastRun,
      lastError: STATE.lastError ? String(STATE.lastError) : null,
      lastResult: last,
      config: CONFIG,
      stats: { ...STATE.stats }
    };
  }

  global.runRainGuardCrossSourcePersistentIdentityReconciliationBridge = run;
  global.runRainGuardCrossSourcePersistentIdentityReconciliation = run;
  global.diagnoseRainGuardCrossSourcePersistentIdentityReconciliationBridge = diagnose;
  global.getRainGuardCrossSourcePersistentIdentitiesV39 = function () {
    return Array.isArray(global.RainGuardCrossSourcePersistentIdentitiesV39)
      ? global.RainGuardCrossSourcePersistentIdentitiesV39
      : [];
  };

  console.log(
    `[RainGuard Phase ${PHASE}] installed — ${BUILD} ${VERSION}`
  );

})(window);
