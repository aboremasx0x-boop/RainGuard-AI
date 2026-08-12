/**
 * RainGuard AI
 * Phase 39A-15F6M
 * Persistent Identity Alias Consolidation Bridge
 *
 * Purpose
 * -------
 * Consolidate fragmented storm identities that refer to the same logical entity
 * across cycles/sources by using explicit aliases and conservative spatial/temporal
 * evidence. This bridge is intentionally conservative:
 *
 * - Never fabricates coordinates.
 * - Never fabricates timestamps.
 * - Never merges records only because they are spatially close.
 * - Prefers exact identity/alias evidence before spatial-temporal fallback.
 * - Preserves all source references and original records.
 *
 * Main exported runner
 * --------------------
 *   window.runRainGuardPersistentIdentityAliasConsolidationBridge(options?)
 *
 * Diagnostics
 * -----------
 *   window.diagnoseRainGuardPersistentIdentityAliasConsolidationBridge()
 *
 * Output stores
 * -------------
 *   window.RainGuardPersistentAliasConsolidatedIdentitiesV39
 *   window.RainGuardPersistentAliasConsolidatedObservationsV39
 *   window.RainGuardPersistentIdentityAliasMapV39
 *   window.RainGuardPersistentIdentityAliasConsolidationLastResultV39
 */

(function installRainGuardPersistentIdentityAliasConsolidationBridge(global) {
  "use strict";

  const PHASE = "39A-15F6M";
  const VERSION = "39A.15F6M.0";
  const BUILD = "rainguard-v39-persistent-identity-alias-consolidation-bridge";

  const DEFAULT_CONFIG = Object.freeze({
    maxInputRecords: 12000,
    maxIdentities: 3000,
    maxObservationsPerIdentity: 120,
    maxAliasValuesPerIdentity: 64,

    // Conservative fallback match thresholds.
    maxSpatialDistanceKm: 8,
    maxTemporalGapMinutes: 45,

    // Require at least this score to consolidate two identity groups.
    minMergeScore: 85,

    // Exact alias matches receive a large score.
    exactAliasScore: 100,
    exactTrackIdScore: 100,
    exactPersistentIdScore: 100,
    exactCanonicalIdScore: 100,
    exactCellIdScore: 92,

    // Spatial-temporal fallback is intentionally weaker.
    spatialTemporalBaseScore: 70,
    sameSourceBonus: 4,

    // Never use placeholder/zero coordinate as valid motion evidence.
    rejectZeroZeroCoordinate: true,

    debug: false
  });

  const ALIAS_FIELDS = Object.freeze([
    "persistentId",
    "persistentID",
    "canonicalPersistentId",
    "canonicalPersistentID",
    "canonicalTrackId",
    "canonicalTrackID",
    "trackId",
    "trackID",
    "cellId",
    "cellID",
    "stormId",
    "stormID",
    "entityId",
    "entityID",
    "identity",
    "id",
    "alias",
    "aliases"
  ]);

  const SOURCE_CANDIDATES = Object.freeze([
    "RainGuardPersistentStormIdentitiesV39",
    "RainGuardReconciledStormIdentitiesV39",
    "RainGuardPersistentIdentityTemporalAccumulatorV39",
    "RainGuardPersistentIdentityMotionRecordsV39",
    "RainGuardPersistentObservationMemoryV39",
    "RainGuardCrossCycleObservationPersistenceV39",
    "RainGuardRecoveredLiveTrackHistoryV39",
    "RainArrivalLiveTrackHistory"
  ]);

  const state = {
    installed: true,
    running: false,
    lastRun: null,
    lastError: null,
    lastResult: null,
    totals: {
      runs: 0,
      input: 0,
      normalized: 0,
      groups: 0,
      mergedGroups: 0,
      outputIdentities: 0,
      outputObservations: 0
    }
  };

  const now = () => Date.now();

  function isObject(value) {
    return value !== null && typeof value === "object";
  }

  function asArray(value) {
    if (Array.isArray(value)) return value;
    if (value instanceof Map) return Array.from(value.values());
    if (value instanceof Set) return Array.from(value.values());
    if (isObject(value)) return Object.values(value);
    return [];
  }

  function finiteNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function normalizeString(value) {
    if (value === null || value === undefined) return null;
    const s = String(value).trim();
    return s ? s : null;
  }

  function lower(value) {
    const s = normalizeString(value);
    return s ? s.toLowerCase() : null;
  }

  function uniqueStrings(values, limit = 64) {
    const seen = new Set();
    const out = [];

    for (const value of values || []) {
      if (Array.isArray(value)) {
        for (const nested of value) {
          const s = normalizeString(nested);
          if (!s) continue;
          const key = s.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          out.push(s);
          if (out.length >= limit) return out;
        }
        continue;
      }

      const s = normalizeString(value);
      if (!s) continue;
      const key = s.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(s);
      if (out.length >= limit) return out;
    }
    return out;
  }

  function getLatLon(record) {
    if (!isObject(record)) return { lat: null, lon: null };

    const coord = isObject(record.coordinate) ? record.coordinate : null;

    const lat = finiteNumber(
      record.latitude ??
      record.lat ??
      coord?.latitude ??
      coord?.lat
    );

    const lon = finiteNumber(
      record.longitude ??
      record.lon ??
      record.lng ??
      coord?.longitude ??
      coord?.lon ??
      coord?.lng
    );

    return { lat, lon };
  }

  function getTimestamp(record) {
    if (!isObject(record)) return null;

    const candidates = [
      record.observedAt,
      record.timestamp,
      record.time,
      record.ts,
      record.createdAt,
      record.updatedAt,
      record.accumulatedAt,
      record.firstSeenAt,
      record.lastSeenAt
    ];

    for (const value of candidates) {
      if (value === null || value === undefined) continue;

      if (typeof value === "number" && Number.isFinite(value)) {
        // Allow seconds or milliseconds.
        return value < 1e12 ? value * 1000 : value;
      }

      const parsed = Date.parse(value);
      if (Number.isFinite(parsed)) return parsed;
    }

    return null;
  }

  function getSource(record) {
    return normalizeString(
      record?.source ??
      record?.sourceName ??
      record?.provider ??
      record?.origin ??
      record?.phase
    ) || "unknown";
  }

  function collectAliases(record, limit) {
    const aliases = [];

    for (const field of ALIAS_FIELDS) {
      const value = record?.[field];
      if (Array.isArray(value)) {
        aliases.push(...value);
      } else if (value !== null && value !== undefined) {
        aliases.push(value);
      }
    }

    // Nested identity containers seen in earlier RainGuard phases.
    const nested = [
      record?.identityInfo,
      record?.identityData,
      record?.identityMeta,
      record?.metadata,
      record?.original
    ];

    for (const obj of nested) {
      if (!isObject(obj)) continue;
      for (const field of ALIAS_FIELDS) {
        const value = obj[field];
        if (Array.isArray(value)) aliases.push(...value);
        else if (value !== null && value !== undefined) aliases.push(value);
      }
    }

    return uniqueStrings(aliases, limit);
  }

  function choosePrimaryIdentity(record, aliases, index) {
    const preferred = [
      record?.canonicalPersistentId,
      record?.persistentId,
      record?.canonicalTrackId,
      record?.trackId,
      record?.cellId,
      record?.stormId,
      record?.entityId,
      record?.identity,
      record?.id
    ];

    for (const value of preferred) {
      const s = normalizeString(value);
      if (s) return s;
    }

    if (aliases.length) return aliases[0];

    return `RG-ALIAS-UNRESOLVED-${index}`;
  }

  function normalizeRecord(record, index, config) {
    if (!isObject(record)) return null;

    const aliases = collectAliases(record, config.maxAliasValuesPerIdentity);
    const primaryIdentity = choosePrimaryIdentity(record, aliases, index);
    const { lat, lon } = getLatLon(record);
    const timestamp = getTimestamp(record);
    const source = getSource(record);

    const validCoordinate =
      Number.isFinite(lat) &&
      Number.isFinite(lon) &&
      lat >= -90 &&
      lat <= 90 &&
      lon >= -180 &&
      lon <= 180 &&
      !(config.rejectZeroZeroCoordinate && lat === 0 && lon === 0);

    return {
      index,
      primaryIdentity,
      primaryIdentityKey: lower(primaryIdentity),
      aliases,
      aliasKeys: aliases.map(lower).filter(Boolean),
      trackId: normalizeString(record.trackId ?? record.trackID),
      persistentId: normalizeString(record.persistentId ?? record.persistentID),
      canonicalTrackId: normalizeString(record.canonicalTrackId ?? record.canonicalTrackID),
      cellId: normalizeString(record.cellId ?? record.cellID),
      lat,
      lon,
      timestamp,
      source,
      validCoordinate,
      original: record
    };
  }

  function haversineKm(aLat, aLon, bLat, bLon) {
    if (![aLat, aLon, bLat, bLon].every(Number.isFinite)) return Infinity;

    const R = 6371;
    const toRad = deg => deg * Math.PI / 180;
    const dLat = toRad(bLat - aLat);
    const dLon = toRad(bLon - aLon);

    const aa =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(aLat)) *
      Math.cos(toRad(bLat)) *
      Math.sin(dLon / 2) ** 2;

    return 2 * R * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
  }

  class UnionFind {
    constructor(size) {
      this.parent = Array.from({ length: size }, (_, i) => i);
      this.rank = new Array(size).fill(0);
    }

    find(x) {
      let p = x;
      while (this.parent[p] !== p) {
        this.parent[p] = this.parent[this.parent[p]];
        p = this.parent[p];
      }
      return p;
    }

    union(a, b) {
      let ra = this.find(a);
      let rb = this.find(b);
      if (ra === rb) return false;

      if (this.rank[ra] < this.rank[rb]) {
        [ra, rb] = [rb, ra];
      }

      this.parent[rb] = ra;
      if (this.rank[ra] === this.rank[rb]) this.rank[ra]++;
      return true;
    }
  }

  function shareExactAlias(a, b) {
    if (!a.aliasKeys.length || !b.aliasKeys.length) return false;
    const setA = new Set(a.aliasKeys);
    return b.aliasKeys.some(x => setA.has(x));
  }

  function sameNonEmpty(a, b) {
    return !!a && !!b && lower(a) === lower(b);
  }

  function computeMatch(a, b, config) {
    // Highest confidence: explicit identifiers.
    if (sameNonEmpty(a.persistentId, b.persistentId)) {
      return { score: config.exactPersistentIdScore, reason: "EXACT_PERSISTENT_ID" };
    }

    if (sameNonEmpty(a.canonicalTrackId, b.canonicalTrackId)) {
      return { score: config.exactCanonicalIdScore, reason: "EXACT_CANONICAL_TRACK_ID" };
    }

    if (sameNonEmpty(a.trackId, b.trackId)) {
      return { score: config.exactTrackIdScore, reason: "EXACT_TRACK_ID" };
    }

    if (shareExactAlias(a, b)) {
      return { score: config.exactAliasScore, reason: "EXACT_ALIAS" };
    }

    if (sameNonEmpty(a.cellId, b.cellId)) {
      return { score: config.exactCellIdScore, reason: "EXACT_CELL_ID" };
    }

    // Conservative spatial-temporal fallback.
    if (
      a.validCoordinate &&
      b.validCoordinate &&
      Number.isFinite(a.timestamp) &&
      Number.isFinite(b.timestamp)
    ) {
      const distanceKm = haversineKm(a.lat, a.lon, b.lat, b.lon);
      const timeGapMinutes = Math.abs(a.timestamp - b.timestamp) / 60000;

      if (
        distanceKm <= config.maxSpatialDistanceKm &&
        timeGapMinutes <= config.maxTemporalGapMinutes
      ) {
        const spatialScore =
          Math.max(0, 1 - distanceKm / config.maxSpatialDistanceKm) * 12;

        const temporalScore =
          Math.max(0, 1 - timeGapMinutes / config.maxTemporalGapMinutes) * 8;

        const sourceBonus =
          lower(a.source) === lower(b.source) ? config.sameSourceBonus : 0;

        return {
          score: config.spatialTemporalBaseScore + spatialScore + temporalScore + sourceBonus,
          reason: "SPATIAL_TEMPORAL",
          distanceKm,
          timeGapMinutes
        };
      }
    }

    return { score: 0, reason: "NO_MATCH" };
  }

  function discoverInputSource() {
    for (const name of SOURCE_CANDIDATES) {
      const value = global[name];

      if (Array.isArray(value) && value.length) {
        return { name, records: value.slice() };
      }

      if (value instanceof Map && value.size) {
        return { name, records: Array.from(value.values()) };
      }

      if (isObject(value)) {
        // Common shapes from previous phases.
        const candidates = [
          value.records,
          value.observations,
          value.identities,
          value.items,
          value.feed,
          value.data,
          value.history
        ];

        for (const candidate of candidates) {
          const arr = asArray(candidate);
          if (arr.length) return { name, records: arr };
        }

        // Last resort: object values.
        const arr = Object.values(value).filter(isObject);
        if (arr.length) return { name, records: arr };
      }
    }

    return { name: null, records: [] };
  }

  function flattenRecord(record, out, depth = 0) {
    if (!isObject(record) || depth > 3) return;

    const hasIdentitySignal = ALIAS_FIELDS.some(field => record[field] !== undefined);
    const { lat, lon } = getLatLon(record);
    const hasCoordinateSignal = Number.isFinite(lat) || Number.isFinite(lon);
    const hasTimeSignal = getTimestamp(record) !== null;

    if (hasIdentitySignal || hasCoordinateSignal || hasTimeSignal) {
      out.push(record);
    }

    const childArrays = [
      record.observations,
      record.records,
      record.history,
      record.points,
      record.samples,
      record.feed,
      record.items
    ];

    for (const arr of childArrays) {
      if (!Array.isArray(arr)) continue;
      for (const child of arr) flattenRecord(child, out, depth + 1);
    }
  }

  function normalizeInput(rawRecords, config) {
    const flattened = [];

    for (const record of rawRecords.slice(0, config.maxInputRecords)) {
      flattenRecord(record, flattened);
    }

    const source = flattened.length ? flattened : rawRecords;
    const normalized = [];

    for (let i = 0; i < source.length && normalized.length < config.maxInputRecords; i++) {
      const n = normalizeRecord(source[i], i, config);
      if (n) normalized.push(n);
    }

    return normalized;
  }

  function buildCandidateBuckets(records) {
    const byAlias = new Map();
    const byTrack = new Map();
    const byPersistent = new Map();
    const byCanonical = new Map();
    const byCell = new Map();

    function push(map, key, index) {
      const normalizedKey = lower(key);
      if (!normalizedKey) return;
      if (!map.has(normalizedKey)) map.set(normalizedKey, []);
      map.get(normalizedKey).push(index);
    }

    records.forEach((record, index) => {
      for (const alias of record.aliasKeys) push(byAlias, alias, index);
      push(byTrack, record.trackId, index);
      push(byPersistent, record.persistentId, index);
      push(byCanonical, record.canonicalTrackId, index);
      push(byCell, record.cellId, index);
    });

    return { byAlias, byTrack, byPersistent, byCanonical, byCell };
  }

  function unionBucketMatches(uf, map) {
    let merges = 0;

    for (const indices of map.values()) {
      if (indices.length < 2) continue;
      const first = indices[0];
      for (let i = 1; i < indices.length; i++) {
        if (uf.union(first, indices[i])) merges++;
      }
    }

    return merges;
  }

  function mergeExactIdentityEvidence(records, uf, buckets) {
    let merges = 0;
    merges += unionBucketMatches(uf, buckets.byPersistent);
    merges += unionBucketMatches(uf, buckets.byCanonical);
    merges += unionBucketMatches(uf, buckets.byTrack);
    merges += unionBucketMatches(uf, buckets.byAlias);
    merges += unionBucketMatches(uf, buckets.byCell);
    return merges;
  }

  function mergeSpatialTemporalEvidence(records, uf, config) {
    // Bucket by coarse coordinate + time window to avoid O(n^2) explosion.
    const buckets = new Map();
    const latStep = Math.max(config.maxSpatialDistanceKm / 111, 0.01);
    const lonStep = latStep;
    const timeStepMs = config.maxTemporalGapMinutes * 60000;

    function key(latBin, lonBin, timeBin) {
      return `${latBin}|${lonBin}|${timeBin}`;
    }

    records.forEach((r, index) => {
      if (!r.validCoordinate || !Number.isFinite(r.timestamp)) return;

      const latBin = Math.floor(r.lat / latStep);
      const lonBin = Math.floor(r.lon / lonStep);
      const timeBin = Math.floor(r.timestamp / timeStepMs);

      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          for (let dt = -1; dt <= 1; dt++) {
            const k = key(latBin + dy, lonBin + dx, timeBin + dt);
            if (!buckets.has(k)) buckets.set(k, []);
          }
        }
      }

      const ownKey = key(latBin, lonBin, timeBin);
      buckets.get(ownKey).push(index);
    });

    let merges = 0;
    const visitedPairs = new Set();

    for (const indices of buckets.values()) {
      for (let i = 0; i < indices.length; i++) {
        for (let j = i + 1; j < indices.length; j++) {
          const aIndex = indices[i];
          const bIndex = indices[j];

          const low = Math.min(aIndex, bIndex);
          const high = Math.max(aIndex, bIndex);
          const pairKey = `${low}:${high}`;

          if (visitedPairs.has(pairKey)) continue;
          visitedPairs.add(pairKey);

          if (uf.find(aIndex) === uf.find(bIndex)) continue;

          const match = computeMatch(records[aIndex], records[bIndex], config);
          if (match.score >= config.minMergeScore) {
            if (uf.union(aIndex, bIndex)) merges++;
          }
        }
      }
    }

    return merges;
  }

  function makeCanonicalId(group, index) {
    const ranked = [];

    for (const r of group) {
      const candidates = [
        r.persistentId,
        r.canonicalTrackId,
        r.trackId,
        r.cellId,
        r.primaryIdentity
      ];

      for (let priority = 0; priority < candidates.length; priority++) {
        const value = normalizeString(candidates[priority]);
        if (value) ranked.push({ value, priority });
      }
    }

    ranked.sort((a, b) => a.priority - b.priority || a.value.localeCompare(b.value));

    if (ranked.length) return ranked[0].value;
    return `RG-PERSISTENT-CANONICAL-${String(index + 1).padStart(5, "0")}`;
  }

  function buildGroups(records, uf, config) {
    const groups = new Map();

    records.forEach((record, index) => {
      const root = uf.find(index);
      if (!groups.has(root)) groups.set(root, []);
      groups.get(root).push(record);
    });

    const identities = [];
    const observations = [];
    const aliasMap = Object.create(null);

    let groupIndex = 0;

    for (const group of groups.values()) {
      if (identities.length >= config.maxIdentities) break;

      group.sort((a, b) => {
        const ta = Number.isFinite(a.timestamp) ? a.timestamp : Number.MAX_SAFE_INTEGER;
        const tb = Number.isFinite(b.timestamp) ? b.timestamp : Number.MAX_SAFE_INTEGER;
        return ta - tb || a.index - b.index;
      });

      const canonicalIdentity = makeCanonicalId(group, groupIndex++);
      const allAliases = uniqueStrings(
        group.flatMap(r => [
          r.primaryIdentity,
          r.persistentId,
          r.canonicalTrackId,
          r.trackId,
          r.cellId,
          ...r.aliases
        ]),
        config.maxAliasValuesPerIdentity
      );

      for (const alias of allAliases) {
        aliasMap[alias] = canonicalIdentity;
      }

      const bounded = group.slice(-config.maxObservationsPerIdentity);

      const normalizedObservations = bounded.map(r => ({
        canonicalIdentity,
        identity: canonicalIdentity,
        persistentId: canonicalIdentity,
        originalIdentity: r.primaryIdentity,
        trackId: r.trackId,
        canonicalTrackId: r.canonicalTrackId,
        cellId: r.cellId,
        latitude: r.lat,
        longitude: r.lon,
        coordinate:
          r.validCoordinate
            ? { latitude: r.lat, longitude: r.lon }
            : null,
        observedAt: r.timestamp,
        timestamp: r.timestamp,
        source: r.source,
        aliases: r.aliases.slice(),
        phase: PHASE,
        original: r.original
      }));

      const validCoordinates = normalizedObservations.filter(
        o =>
          Number.isFinite(o.latitude) &&
          Number.isFinite(o.longitude) &&
          !(config.rejectZeroZeroCoordinate && o.latitude === 0 && o.longitude === 0)
      );

      const uniqueCoordinates = new Set(
        validCoordinates.map(
          o => `${Number(o.latitude).toFixed(6)},${Number(o.longitude).toFixed(6)}`
        )
      );

      const validTimes = normalizedObservations
        .map(o => o.timestamp)
        .filter(Number.isFinite)
        .sort((a, b) => a - b);

      const identity = {
        canonicalIdentity,
        persistentId: canonicalIdentity,
        aliases: allAliases,
        observationCount: normalizedObservations.length,
        uniqueCoordinateCount: uniqueCoordinates.size,
        firstObservedAt: validTimes.length ? validTimes[0] : null,
        lastObservedAt: validTimes.length ? validTimes[validTimes.length - 1] : null,
        sources: uniqueStrings(normalizedObservations.map(o => o.source), 32),
        multiPoint: normalizedObservations.length >= 2,
        coordinateChange: uniqueCoordinates.size >= 2,
        observations: normalizedObservations,
        phase: PHASE,
        version: VERSION
      };

      identities.push(identity);
      observations.push(...normalizedObservations);
    }

    return { identities, observations, aliasMap };
  }

  function calculateDiagnostics(identities, observations) {
    const multiPoint = identities.filter(x => x.observationCount >= 2);
    const coordinateChanges = identities.filter(x => x.uniqueCoordinateCount >= 2);

    return {
      identityCount: identities.length,
      observationCount: observations.length,
      multiPointIdentityCount: multiPoint.length,
      identitiesWithCoordinateChanges: coordinateChanges.length,
      maxObservedPointsPerIdentity: identities.reduce(
        (m, x) => Math.max(m, x.observationCount || 0),
        0
      ),
      maxUniqueCoordinatesPerIdentity: identities.reduce(
        (m, x) => Math.max(m, x.uniqueCoordinateCount || 0),
        0
      ),
      multiPointSample: multiPoint.slice(0, 10),
      coordinateChangeSample: coordinateChanges.slice(0, 10)
    };
  }

  function installOutputs(result) {
    global.RainGuardPersistentAliasConsolidatedIdentitiesV39 = result.identities;
    global.RainGuardPersistentAliasConsolidatedObservationsV39 = result.observations;
    global.RainGuardPersistentIdentityAliasMapV39 = result.aliasMap;
    global.RainGuardPersistentIdentityAliasConsolidationLastResultV39 = result;

    // Compatibility aliases for downstream phases.
    global.RainGuardCanonicalPersistentIdentitiesV39 = result.identities;
    global.RainGuardCanonicalPersistentObservationsV39 = result.observations;
  }

  async function run(options = {}) {
    if (state.running) {
      return {
        success: false,
        phase: PHASE,
        version: VERSION,
        build: BUILD,
        status: "RUN_ALREADY_IN_PROGRESS"
      };
    }

    state.running = true;
    state.lastError = null;
    const startedAt = now();

    try {
      const config = { ...DEFAULT_CONFIG, ...(isObject(options) ? options : {}) };

      const discovered = discoverInputSource();
      const rawRecords = discovered.records.slice(0, config.maxInputRecords);
      const normalized = normalizeInput(rawRecords, config);

      if (!normalized.length) {
        const emptyResult = {
          success: true,
          phase: PHASE,
          version: VERSION,
          build: BUILD,
          status: "NO_PERSISTENT_IDENTITY_INPUT",
          sourceUsed: discovered.name,
          sourceRecordCount: rawRecords.length,
          normalizedRecordCount: 0,
          identityCount: 0,
          observationCount: 0,
          multiPointIdentityCount: 0,
          identitiesWithCoordinateChanges: 0,
          maxObservedPointsPerIdentity: 0,
          maxUniqueCoordinatesPerIdentity: 0,
          identities: [],
          observations: [],
          aliasMap: {},
          durationMs: now() - startedAt,
          generatedAt: now()
        };

        installOutputs(emptyResult);
        state.lastResult = emptyResult;
        state.lastRun = now();
        state.totals.runs++;
        return emptyResult;
      }

      const uf = new UnionFind(normalized.length);
      const buckets = buildCandidateBuckets(normalized);

      const exactMergeCount = mergeExactIdentityEvidence(
        normalized,
        uf,
        buckets
      );

      const spatialTemporalMergeCount = mergeSpatialTemporalEvidence(
        normalized,
        uf,
        config
      );

      const built = buildGroups(normalized, uf, config);
      const diagnostics = calculateDiagnostics(
        built.identities,
        built.observations
      );

      const mergedGroupCount =
        exactMergeCount + spatialTemporalMergeCount;

      let status = "ALIASES_CONSOLIDATED";

      if (diagnostics.multiPointIdentityCount > 0) {
        status = diagnostics.identitiesWithCoordinateChanges > 0
          ? "MULTI_POINT_IDENTITIES_WITH_COORDINATE_CHANGE_READY"
          : "MULTI_POINT_IDENTITIES_READY_NO_COORDINATE_CHANGE_YET";
      } else if (mergedGroupCount > 0) {
        status = "ALIASES_CONSOLIDATED_BUT_NO_MULTI_POINT_IDENTITY";
      } else {
        status = "IDENTITIES_FOUND_BUT_NO_SAFE_ALIAS_CONSOLIDATION";
      }

      const result = {
        success: true,
        phase: PHASE,
        version: VERSION,
        build: BUILD,
        status,

        sourceUsed: discovered.name,
        sourceRecordCount: rawRecords.length,
        normalizedRecordCount: normalized.length,

        exactMergeCount,
        spatialTemporalMergeCount,
        mergedGroupCount,

        canonicalIdentityCount: built.identities.length,
        canonicalObservationCount: built.observations.length,

        ...diagnostics,

        identities: built.identities,
        observations: built.observations,
        aliasMap: built.aliasMap,

        config,
        durationMs: now() - startedAt,
        generatedAt: now()
      };

      installOutputs(result);

      state.lastResult = result;
      state.lastRun = now();
      state.totals.runs++;
      state.totals.input += rawRecords.length;
      state.totals.normalized += normalized.length;
      state.totals.groups += built.identities.length;
      state.totals.mergedGroups += mergedGroupCount;
      state.totals.outputIdentities += built.identities.length;
      state.totals.outputObservations += built.observations.length;

      console.log(`[RainGuard Phase ${PHASE}] Persistent Identity Alias Consolidation result:`);
      console.log(result);

      if (config.debug) {
        console.table(
          built.identities.slice(0, 50).map(x => ({
            canonicalIdentity: x.canonicalIdentity,
            observations: x.observationCount,
            uniqueCoordinates: x.uniqueCoordinateCount,
            aliases: x.aliases.length,
            sources: x.sources.join(", ")
          }))
        );
      }

      return result;
    } catch (error) {
      state.lastError = error;

      const failed = {
        success: false,
        phase: PHASE,
        version: VERSION,
        build: BUILD,
        status: "ALIAS_CONSOLIDATION_FAILED",
        error: String(error?.message || error),
        stack: error?.stack || null,
        durationMs: now() - startedAt,
        generatedAt: now()
      };

      state.lastResult = failed;
      console.error(`[RainGuard Phase ${PHASE}]`, error);
      return failed;
    } finally {
      state.running = false;
    }
  }

  function diagnose() {
    const result = {
      success: true,
      phase: PHASE,
      version: VERSION,
      build: BUILD,
      installed: true,
      running: state.running,
      lastRun: state.lastRun,
      lastError: state.lastError ? String(state.lastError.message || state.lastError) : null,
      lastResult: state.lastResult,
      totals: { ...state.totals },
      outputStores: {
        identities: Array.isArray(global.RainGuardPersistentAliasConsolidatedIdentitiesV39)
          ? global.RainGuardPersistentAliasConsolidatedIdentitiesV39.length
          : 0,
        observations: Array.isArray(global.RainGuardPersistentAliasConsolidatedObservationsV39)
          ? global.RainGuardPersistentAliasConsolidatedObservationsV39.length
          : 0,
        aliases: isObject(global.RainGuardPersistentIdentityAliasMapV39)
          ? Object.keys(global.RainGuardPersistentIdentityAliasMapV39).length
          : 0
      }
    };

    console.log(`[RainGuard Phase ${PHASE}] Diagnostic:`);
    console.log(result);
    return result;
  }

  global.runRainGuardPersistentIdentityAliasConsolidationBridge = run;
  global.diagnoseRainGuardPersistentIdentityAliasConsolidationBridge = diagnose;

  global.RainGuardPersistentIdentityAliasConsolidationBridgeV39 = {
    phase: PHASE,
    version: VERSION,
    build: BUILD,
    config: DEFAULT_CONFIG,
    state,
    run,
    diagnose
  };

  console.log(
    `[RainGuard Phase ${PHASE}] Persistent Identity Alias Consolidation Bridge installed.`
  );

})(window);
