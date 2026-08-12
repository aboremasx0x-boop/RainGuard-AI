/**
 * RainGuard AI V39
 * Phase 39A-15F6N — Historical Observation -> Persistent Identity Backfill Bridge
 *
 * Goal:
 *   Backfill historical observations from live/history stores into already-reconciled
 *   persistent storm identities without inventing coordinates, timestamps, or motion.
 *
 * Safety principles:
 *   1) Exact identity/alias matches are preferred.
 *   2) Spatial-temporal matching is conservative and bounded.
 *   3) A history observation is assigned to at most one persistent identity.
 *   4) Ambiguous spatial candidates are rejected, never force-merged.
 *   5) No synthetic observations are created.
 *
 * Public API:
 *   window.runRainGuardHistoricalObservationPersistentIdentityBackfillBridge(options?)
 *   window.diagnoseRainGuardHistoricalObservationPersistentIdentityBackfillBridge()
 *
 * Outputs:
 *   window.RainGuardPersistentIdentityBackfilledObservationsV39
 *   window.RainGuardPersistentIdentityBackfillIndexV39
 *   window.RainGuardHistoricalObservationPersistentIdentityBackfillLastResult
 */

(function installRainGuardHistoricalObservationPersistentIdentityBackfillBridge(global) {
  "use strict";

  const PHASE = "39A-15F6N";
  const VERSION = "39A.15F6N.0";
  const BUILD = "rainguard-v39-historical-observation-persistent-identity-backfill-bridge";

  if (global.__RainGuardHistoricalObservationPersistentIdentityBackfillBridgeInstalled) {
    return;
  }
  global.__RainGuardHistoricalObservationPersistentIdentityBackfillBridgeInstalled = true;

  const DEFAULT_CONFIG = Object.freeze({
    maxHistoryRecords: 12000,
    maxPersistentIdentities: 3000,
    maxObservationsPerIdentity: 64,
    maxBackfilledObservationsGlobal: 12000,

    // Conservative fallback matching.
    maxSpatialDistanceKm: 18,
    maxTemporalGapMs: 3 * 60 * 60 * 1000, // 3 hours
    ambiguityDistanceRatio: 0.80,
    requireSameSourceWhenNoAlias: false,

    // Deduplication precision.
    coordinatePrecision: 5,
    timestampBucketMs: 1000,

    // Existing observation preservation.
    preserveExistingObservations: true,
    writeBackToPersistentIdentityStore: false
  });

  const HISTORY_SOURCE_NAMES = Object.freeze([
    "RainArrivalLiveTrackHistory",
    "RainGuardLiveTrackHistory",
    "RainGuardRecoveredLiveTrackHistoryV39",
    "RainGuardCrossCycleObservationPersistenceV39",
    "RainGuardPersistentObservationMemoryV39",
    "RainGuardPersistentIdentityMotionRecordsV39",
    "RainGuardPersistentIdentityTemporalAccumulatorV39",
    "RainGuardReconciledIdentityTemporalRecoveryV39",
    "RainGuardReconciledTemporalFeedV39"
  ]);

  const IDENTITY_SOURCE_NAMES = Object.freeze([
    "RainGuardPersistentStormIdentitiesV39",
    "RainGuardCrossSourcePersistentIdentitiesV39",
    "RainGuardPersistentIdentityAliasConsolidationV39",
    "RainGuardReconciledStormIdentitiesV39",
    "RainGuardPersistentIdentitiesV39"
  ]);

  const now = () => Date.now();

  function isObject(value) {
    return value !== null && typeof value === "object";
  }

  function finiteNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function stringValue(value) {
    if (typeof value !== "string") return "";
    return value.trim();
  }

  function normalizeToken(value) {
    const s = stringValue(value);
    return s ? s.toLowerCase().replace(/\s+/g, " ") : "";
  }

  function validLatLon(lat, lon) {
    return Number.isFinite(lat) && Number.isFinite(lon) &&
      lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180 &&
      !(lat === 0 && lon === 0);
  }

  function getLat(record) {
    if (!isObject(record)) return null;
    const c = isObject(record.coordinate) ? record.coordinate : {};
    return finiteNumber(
      record.latitude ?? record.lat ??
      c.latitude ?? c.lat
    );
  }

  function getLon(record) {
    if (!isObject(record)) return null;
    const c = isObject(record.coordinate) ? record.coordinate : {};
    return finiteNumber(
      record.longitude ?? record.lon ?? record.lng ??
      c.longitude ?? c.lon ?? c.lng
    );
  }

  function getTime(record) {
    if (!isObject(record)) return null;
    const raw =
      record.observedAt ??
      record.timestamp ??
      record.time ??
      record.accumulatedAt ??
      record.createdAt ??
      record.updatedAt ??
      record.generatedAt;

    if (raw == null) return null;
    if (typeof raw === "number" && Number.isFinite(raw)) {
      if (raw > 0 && raw < 1e12) return raw * 1000;
      return raw;
    }
    if (typeof raw === "string") {
      const numeric = Number(raw);
      if (Number.isFinite(numeric)) {
        return numeric > 0 && numeric < 1e12 ? numeric * 1000 : numeric;
      }
      const parsed = Date.parse(raw);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  }

  function cloneSafe(value) {
    if (value == null) return value;
    try {
      if (typeof structuredClone === "function") return structuredClone(value);
    } catch (_) {}
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (_) {
      return value;
    }
  }

  function arrayFromUnknown(value, seen) {
    if (value == null) return [];
    if (!seen) seen = new WeakSet();

    if (Array.isArray(value)) return value.slice();

    if (value instanceof Map) {
      return Array.from(value.values());
    }

    if (value instanceof Set) {
      return Array.from(value.values());
    }

    if (!isObject(value)) return [];

    if (seen.has(value)) return [];
    seen.add(value);

    const preferredKeys = [
      "observations", "records", "history", "items", "entries",
      "entities", "identities", "tracks", "feed", "data",
      "output", "result", "values"
    ];

    for (const key of preferredKeys) {
      if (value[key] != null) {
        const arr = arrayFromUnknown(value[key], seen);
        if (arr.length) return arr;
      }
    }

    // Some stores use dynamic identity keys whose values are arrays.
    const dynamic = [];
    for (const [key, child] of Object.entries(value)) {
      if (key.startsWith("_")) continue;
      if (Array.isArray(child)) {
        for (const item of child) dynamic.push(item);
      } else if (child instanceof Map) {
        for (const item of child.values()) dynamic.push(item);
      }
    }
    if (dynamic.length) return dynamic;

    return [];
  }

  function collectAliases(record) {
    const out = new Set();
    if (!isObject(record)) return out;

    const fields = [
      "persistentId", "canonicalPersistentId", "canonicalIdentity",
      "canonicalIdentityId", "canonicalTrackId", "identity", "identityId",
      "trackId", "cellId", "stormId", "entityId", "id", "name"
    ];

    for (const key of fields) {
      const v = record[key];
      if (typeof v === "string" && v.trim()) out.add(normalizeToken(v));
    }

    const aliasFields = [
      record.aliases,
      record.alias,
      record.identityAliases,
      record.trackAliases,
      record.canonicalAliases
    ];

    for (const value of aliasFields) {
      if (Array.isArray(value) || value instanceof Set) {
        for (const v of value) {
          if (typeof v === "string" && v.trim()) out.add(normalizeToken(v));
        }
      } else if (value instanceof Map) {
        for (const [k, v] of value.entries()) {
          if (typeof k === "string" && k.trim()) out.add(normalizeToken(k));
          if (typeof v === "string" && v.trim()) out.add(normalizeToken(v));
        }
      } else if (isObject(value)) {
        for (const [k, v] of Object.entries(value)) {
          if (k.trim()) out.add(normalizeToken(k));
          if (typeof v === "string" && v.trim()) out.add(normalizeToken(v));
        }
      } else if (typeof value === "string" && value.trim()) {
        out.add(normalizeToken(value));
      }
    }

    return out;
  }

  function bestPersistentId(record, index) {
    const candidates = [
      record && record.persistentId,
      record && record.canonicalPersistentId,
      record && record.canonicalIdentityId,
      record && record.identityId,
      record && record.canonicalTrackId,
      record && record.trackId,
      record && record.cellId,
      record && record.stormId,
      record && record.entityId,
      record && record.id
    ];
    for (const v of candidates) {
      if (typeof v === "string" && v.trim()) return v.trim();
    }
    return `RG-PERSISTENT-${index + 1}`;
  }

  function normalizeObservation(record, sourceName, sourceIndex) {
    if (!isObject(record)) return null;

    const lat = getLat(record);
    const lon = getLon(record);
    const time = getTime(record);

    if (!validLatLon(lat, lon) || !Number.isFinite(time)) {
      return null;
    }

    const aliases = Array.from(collectAliases(record));
    const source =
      stringValue(record.source) ||
      stringValue(record.provider) ||
      stringValue(record.origin) ||
      sourceName ||
      "unknown";

    return {
      identity: stringValue(record.identity),
      persistentId: stringValue(record.persistentId),
      canonicalTrackId: stringValue(record.canonicalTrackId),
      trackId: stringValue(record.trackId),
      cellId: stringValue(record.cellId),
      aliases,
      latitude: lat,
      longitude: lon,
      coordinate: { latitude: lat, longitude: lon },
      observedAt: time,
      timestamp: time,
      confidence: finiteNumber(record.confidence),
      intensity: finiteNumber(record.intensity),
      source,
      sourceName,
      sourceIndex,
      phase: stringValue(record.phase),
      original: record
    };
  }

  function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371.0088;
    const toRad = d => d * Math.PI / 180;
    const p1 = toRad(lat1);
    const p2 = toRad(lat2);
    const dp = toRad(lat2 - lat1);
    const dl = toRad(lon2 - lon1);
    const a =
      Math.sin(dp / 2) ** 2 +
      Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
  }

  function observationKey(obs, config) {
    const lat = Number(obs.latitude).toFixed(config.coordinatePrecision);
    const lon = Number(obs.longitude).toFixed(config.coordinatePrecision);
    const t = Math.floor(obs.observedAt / config.timestampBucketMs) * config.timestampBucketMs;
    return `${normalizeToken(obs.source)}|${lat}|${lon}|${t}`;
  }

  function identityRepresentative(identity) {
    const observations = Array.isArray(identity.observations) ? identity.observations : [];
    const valid = observations
      .map((o, i) => normalizeObservation(o, "identity.existing", i))
      .filter(Boolean)
      .sort((a, b) => a.observedAt - b.observedAt);

    if (valid.length) {
      const last = valid[valid.length - 1];
      return { latitude: last.latitude, longitude: last.longitude, observedAt: last.observedAt };
    }

    const lat = getLat(identity);
    const lon = getLon(identity);
    const time = getTime(identity);

    return validLatLon(lat, lon)
      ? { latitude: lat, longitude: lon, observedAt: Number.isFinite(time) ? time : null }
      : null;
  }

  function chooseIdentitySource() {
    for (const name of IDENTITY_SOURCE_NAMES) {
      const value = global[name];
      const arr = arrayFromUnknown(value);
      if (arr.length) return { name, raw: value, records: arr };
    }
    return { name: null, raw: null, records: [] };
  }

  function collectHistorySources(config) {
    const sources = [];
    let total = 0;

    for (const name of HISTORY_SOURCE_NAMES) {
      const value = global[name];
      const arr = arrayFromUnknown(value);
      if (!arr.length) continue;

      const remaining = Math.max(0, config.maxHistoryRecords - total);
      if (!remaining) break;

      const slice = arr.slice(-remaining);
      sources.push({ name, raw: value, records: slice });
      total += slice.length;
    }

    return sources;
  }

  function normalizeIdentity(record, index, config) {
    const persistentId = bestPersistentId(record, index);
    const aliases = collectAliases(record);
    aliases.add(normalizeToken(persistentId));

    const existing = [];
    if (config.preserveExistingObservations && isObject(record)) {
      const candidates = [
        record.observations,
        record.history,
        record.temporalObservations,
        record.motionHistory,
        record.points,
        record.records
      ];
      for (const candidate of candidates) {
        const arr = arrayFromUnknown(candidate);
        for (let i = 0; i < arr.length; i++) {
          const obs = normalizeObservation(arr[i], "persistent.identity.existing", i);
          if (obs) existing.push(obs);
        }
      }
    }

    return {
      persistentId,
      aliases,
      sourceRecord: record,
      representative: identityRepresentative({
        ...record,
        observations: existing.length ? existing : record.observations
      }),
      observations: existing,
      existingObservationCount: existing.length,
      backfilledObservationCount: 0,
      exactAliasBackfillCount: 0,
      spatialTemporalBackfillCount: 0
    };
  }

  function buildAliasIndex(identities) {
    const map = new Map();
    for (let i = 0; i < identities.length; i++) {
      for (const alias of identities[i].aliases) {
        if (!alias) continue;
        if (!map.has(alias)) map.set(alias, []);
        map.get(alias).push(i);
      }
    }
    return map;
  }

  function exactCandidates(obs, aliasIndex) {
    const aliases = collectAliases(obs.original || obs);
    for (const a of obs.aliases || []) aliases.add(normalizeToken(a));

    const matches = new Set();
    for (const alias of aliases) {
      const indexes = aliasIndex.get(alias);
      if (!indexes) continue;
      for (const idx of indexes) matches.add(idx);
    }
    return Array.from(matches);
  }

  function spatialTemporalCandidates(obs, identities, config) {
    const candidates = [];

    for (let i = 0; i < identities.length; i++) {
      const identity = identities[i];
      const rep = identity.representative;
      if (!rep) continue;

      if (config.requireSameSourceWhenNoAlias) {
        const sources = new Set(identity.observations.map(o => normalizeToken(o.source)));
        if (sources.size && !sources.has(normalizeToken(obs.source))) continue;
      }

      const distanceKm = haversineKm(
        obs.latitude, obs.longitude,
        rep.latitude, rep.longitude
      );
      if (distanceKm > config.maxSpatialDistanceKm) continue;

      let temporalGapMs = null;
      if (Number.isFinite(rep.observedAt)) {
        temporalGapMs = Math.abs(obs.observedAt - rep.observedAt);
        if (temporalGapMs > config.maxTemporalGapMs) continue;
      }

      const timePenalty = temporalGapMs == null
        ? 0.5
        : Math.min(1, temporalGapMs / config.maxTemporalGapMs);

      const distancePenalty = Math.min(1, distanceKm / config.maxSpatialDistanceKm);

      // Lower score is better.
      const score = distancePenalty * 0.70 + timePenalty * 0.30;
      candidates.push({ index: i, distanceKm, temporalGapMs, score });
    }

    candidates.sort((a, b) => a.score - b.score);
    return candidates;
  }

  function safeAssignSpatial(obs, candidates, config) {
    if (!candidates.length) return null;
    if (candidates.length === 1) return candidates[0];

    const first = candidates[0];
    const second = candidates[1];

    // Reject when the best candidate is not clearly better.
    if (first.score >= second.score * config.ambiguityDistanceRatio) {
      return null;
    }
    return first;
  }

  function dedupeAndBound(identity, config) {
    const seen = new Set();
    const kept = [];

    identity.observations
      .sort((a, b) => a.observedAt - b.observedAt)
      .forEach(obs => {
        const key = observationKey(obs, config);
        if (seen.has(key)) return;
        seen.add(key);
        kept.push(obs);
      });

    if (kept.length > config.maxObservationsPerIdentity) {
      identity.observations = kept.slice(-config.maxObservationsPerIdentity);
    } else {
      identity.observations = kept;
    }

    const last = identity.observations[identity.observations.length - 1];
    if (last) {
      identity.representative = {
        latitude: last.latitude,
        longitude: last.longitude,
        observedAt: last.observedAt
      };
    }
  }

  function buildOutputIdentity(identity) {
    const obs = identity.observations.map(o => ({
      identity: o.identity || undefined,
      persistentId: identity.persistentId,
      canonicalTrackId: o.canonicalTrackId || undefined,
      trackId: o.trackId || undefined,
      cellId: o.cellId || undefined,
      aliases: o.aliases && o.aliases.length ? o.aliases.slice() : undefined,
      latitude: o.latitude,
      longitude: o.longitude,
      coordinate: { latitude: o.latitude, longitude: o.longitude },
      observedAt: o.observedAt,
      timestamp: o.observedAt,
      confidence: o.confidence,
      intensity: o.intensity,
      source: o.source,
      sourceName: o.sourceName,
      phase: o.phase
    }));

    const uniqueCoords = new Set(
      obs.map(o => `${o.latitude.toFixed(5)},${o.longitude.toFixed(5)}`)
    );

    return {
      persistentId: identity.persistentId,
      aliases: Array.from(identity.aliases),
      observationCount: obs.length,
      existingObservationCount: identity.existingObservationCount,
      backfilledObservationCount: identity.backfilledObservationCount,
      exactAliasBackfillCount: identity.exactAliasBackfillCount,
      spatialTemporalBackfillCount: identity.spatialTemporalBackfillCount,
      uniqueCoordinateCount: uniqueCoords.size,
      firstSeenAt: obs.length ? obs[0].observedAt : null,
      lastSeenAt: obs.length ? obs[obs.length - 1].observedAt : null,
      observations: obs
    };
  }

  function optionallyWriteBack(identitySource, outputIdentities) {
    const raw = identitySource.raw;
    if (!raw) return 0;

    const byId = new Map(outputIdentities.map(x => [normalizeToken(x.persistentId), x]));
    let writes = 0;

    const records = identitySource.records;
    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      if (!isObject(record)) continue;
      const pid = normalizeToken(bestPersistentId(record, i));
      const updated = byId.get(pid);
      if (!updated) continue;
      try {
        record.observations = cloneSafe(updated.observations);
        record.observationCount = updated.observationCount;
        record.uniqueCoordinateCount = updated.uniqueCoordinateCount;
        record.backfilledAt = now();
        writes++;
      } catch (_) {}
    }
    return writes;
  }

  async function run(options) {
    const startedAt = now();
    const config = Object.assign({}, DEFAULT_CONFIG, isObject(options) ? options : {});

    const result = {
      success: true,
      phase: PHASE,
      version: VERSION,
      build: BUILD,
      status: "INITIALIZING",

      generatedAt: startedAt,
      durationMs: 0,

      persistentIdentitySource: null,
      historySources: [],

      sourceIdentityCount: 0,
      normalizedIdentityCount: 0,
      sourceHistoryRecordCount: 0,
      normalizedHistoryObservationCount: 0,

      exactAliasMatchedCount: 0,
      spatialTemporalMatchedCount: 0,
      ambiguousRejectedCount: 0,
      invalidHistoryRecordCount: 0,
      unmatchedHistoryRecordCount: 0,

      backfilledObservationCount: 0,
      identityCount: 0,
      identitiesWithBackfill: 0,
      multiPointIdentityCount: 0,
      identitiesWithCoordinateChanges: 0,
      maxObservedPointsPerIdentity: 0,
      maxUniqueCoordinatesPerIdentity: 0,

      writeBackCount: 0,
      identitySample: [],
      multiPointSample: []
    };

    try {
      const identitySource = chooseIdentitySource();
      result.persistentIdentitySource = identitySource.name;
      result.sourceIdentityCount = identitySource.records.length;

      if (!identitySource.records.length) {
        result.status = "NO_PERSISTENT_IDENTITIES";
        result.durationMs = now() - startedAt;
        global.RainGuardHistoricalObservationPersistentIdentityBackfillLastResult = result;
        console.warn(`[RainGuard Phase ${PHASE}] No persistent identity source found.`, result);
        return result;
      }

      const identities = identitySource.records
        .slice(0, config.maxPersistentIdentities)
        .map((r, i) => normalizeIdentity(r, i, config));

      result.normalizedIdentityCount = identities.length;

      const aliasIndex = buildAliasIndex(identities);
      const historySources = collectHistorySources(config);

      result.historySources = historySources.map(s => s.name);
      result.sourceHistoryRecordCount = historySources.reduce((n, s) => n + s.records.length, 0);

      const normalizedHistory = [];
      for (const source of historySources) {
        for (let i = 0; i < source.records.length; i++) {
          const obs = normalizeObservation(source.records[i], source.name, i);
          if (!obs) {
            result.invalidHistoryRecordCount++;
            continue;
          }
          normalizedHistory.push(obs);
        }
      }

      normalizedHistory.sort((a, b) => a.observedAt - b.observedAt);
      result.normalizedHistoryObservationCount = normalizedHistory.length;

      if (!normalizedHistory.length) {
        result.status = "PERSISTENT_IDENTITIES_FOUND_BUT_NO_VALID_HISTORY";
        result.identityCount = identities.length;
        result.durationMs = now() - startedAt;
        global.RainGuardHistoricalObservationPersistentIdentityBackfillLastResult = result;
        console.warn(`[RainGuard Phase ${PHASE}] No valid historical observations found.`, result);
        return result;
      }

      let globalBackfill = 0;

      for (const obs of normalizedHistory) {
        if (globalBackfill >= config.maxBackfilledObservationsGlobal) break;

        const exact = exactCandidates(obs, aliasIndex);

        if (exact.length === 1) {
          const identity = identities[exact[0]];
          identity.observations.push(obs);
          identity.backfilledObservationCount++;
          identity.exactAliasBackfillCount++;
          result.exactAliasMatchedCount++;
          globalBackfill++;
          dedupeAndBound(identity, config);
          continue;
        }

        if (exact.length > 1) {
          // Multiple identities share the same alias: ambiguous, do not force.
          result.ambiguousRejectedCount++;
          continue;
        }

        const spatial = spatialTemporalCandidates(obs, identities, config);
        const chosen = safeAssignSpatial(obs, spatial, config);

        if (chosen) {
          const identity = identities[chosen.index];
          identity.observations.push(obs);
          identity.backfilledObservationCount++;
          identity.spatialTemporalBackfillCount++;
          result.spatialTemporalMatchedCount++;
          globalBackfill++;
          dedupeAndBound(identity, config);
        } else if (spatial.length > 1) {
          result.ambiguousRejectedCount++;
        } else {
          result.unmatchedHistoryRecordCount++;
        }
      }

      const outputIdentities = identities.map(buildOutputIdentity);

      result.backfilledObservationCount =
        outputIdentities.reduce((n, x) => n + x.backfilledObservationCount, 0);

      result.identityCount = outputIdentities.length;
      result.identitiesWithBackfill =
        outputIdentities.filter(x => x.backfilledObservationCount > 0).length;
      result.multiPointIdentityCount =
        outputIdentities.filter(x => x.observationCount >= 2).length;
      result.identitiesWithCoordinateChanges =
        outputIdentities.filter(x => x.uniqueCoordinateCount >= 2).length;
      result.maxObservedPointsPerIdentity =
        outputIdentities.reduce((m, x) => Math.max(m, x.observationCount), 0);
      result.maxUniqueCoordinatesPerIdentity =
        outputIdentities.reduce((m, x) => Math.max(m, x.uniqueCoordinateCount), 0);

      result.identitySample = outputIdentities.slice(0, 12);
      result.multiPointSample = outputIdentities
        .filter(x => x.observationCount >= 2)
        .slice(0, 12);

      const backfillIndex = new Map();
      for (const identity of outputIdentities) {
        backfillIndex.set(identity.persistentId, identity);
      }

      global.RainGuardPersistentIdentityBackfilledObservationsV39 = outputIdentities;
      global.RainGuardPersistentIdentityBackfillIndexV39 = backfillIndex;

      if (config.writeBackToPersistentIdentityStore) {
        result.writeBackCount = optionallyWriteBack(identitySource, outputIdentities);
      }

      if (result.identitiesWithCoordinateChanges > 0) {
        result.status = "HISTORICAL_BACKFILL_READY_WITH_TEMPORAL_COORDINATE_CHANGE";
      } else if (result.multiPointIdentityCount > 0) {
        result.status = "HISTORICAL_BACKFILL_READY_MULTI_POINT_IDENTITIES";
      } else if (result.backfilledObservationCount > 0) {
        result.status = "HISTORICAL_BACKFILL_COMPLETED_SINGLE_POINT_ONLY";
      } else {
        result.status = "HISTORY_FOUND_BUT_NO_SAFE_PERSISTENT_IDENTITY_MATCH";
      }

      result.durationMs = now() - startedAt;
      global.RainGuardHistoricalObservationPersistentIdentityBackfillLastResult = result;

      console.log(`[RainGuard Phase ${PHASE}] Historical Observation -> Persistent Identity Backfill result:`);
      console.log(result);
      return result;

    } catch (error) {
      result.success = false;
      result.status = "HISTORICAL_BACKFILL_ERROR";
      result.error = {
        name: error && error.name ? error.name : "Error",
        message: error && error.message ? error.message : String(error)
      };
      result.durationMs = now() - startedAt;
      global.RainGuardHistoricalObservationPersistentIdentityBackfillLastResult = result;
      console.error(`[RainGuard Phase ${PHASE}] Failed:`, error, result);
      return result;
    }
  }

  function diagnose() {
    const identitySource = chooseIdentitySource();
    const historySources = collectHistorySources(DEFAULT_CONFIG);

    const diagnostic = {
      success: true,
      phase: PHASE,
      version: VERSION,
      build: BUILD,
      installed: true,
      persistentIdentitySource: identitySource.name,
      persistentIdentityRecordCount: identitySource.records.length,
      historySources: historySources.map(s => ({
        name: s.name,
        recordCount: s.records.length
      })),
      outputIdentityCount: Array.isArray(global.RainGuardPersistentIdentityBackfilledObservationsV39)
        ? global.RainGuardPersistentIdentityBackfilledObservationsV39.length
        : 0,
      lastResult: global.RainGuardHistoricalObservationPersistentIdentityBackfillLastResult || null
    };

    console.log(`[RainGuard Phase ${PHASE}] Diagnostic:`);
    console.log(diagnostic);
    return diagnostic;
  }

  global.runRainGuardHistoricalObservationPersistentIdentityBackfillBridge = run;
  global.diagnoseRainGuardHistoricalObservationPersistentIdentityBackfillBridge = diagnose;

  global.RainGuardHistoricalObservationPersistentIdentityBackfillBridge = {
    phase: PHASE,
    version: VERSION,
    build: BUILD,
    config: DEFAULT_CONFIG,
    run,
    diagnose
  };

  console.log(
    `[RainGuard Phase ${PHASE}] Historical Observation -> Persistent Identity Backfill Bridge installed.`
  );
})(window);
