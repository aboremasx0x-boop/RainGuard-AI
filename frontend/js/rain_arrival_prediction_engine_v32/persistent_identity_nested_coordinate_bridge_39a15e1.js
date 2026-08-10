(function (global) {
  "use strict";

  const PHASE = "39A-15E1";
  const VERSION = "39A.15E1.0";
  const BUILD = "rainguard-v39-persistent-identity-nested-coordinate-bridge";

  const state = {
    installed: false,
    running: false,
    runInProgress: false,
    lastError: null,
    lastResult: null,
    updatedAt: null,
    statistics: {
      runs: 0,
      skippedRuns: 0,
      sourceEntities: 0,
      normalizedRecords: 0,
      acceptedRecords: 0,
      rejectedZeroCoordinate: 0,
      rejectedInvalidCoordinate: 0,
      rejectedMissingIdentity: 0,
      rejectedMissingTimestamp: 0,
      persistentIdentitiesUpdated: 0
    }
  };

  function isFiniteNumber(value) {
    return typeof value === "number" && Number.isFinite(value);
  }

  function toNumber(value) {
    if (value === null || value === undefined || value === "") {
      return null;
    }

    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function firstValidNumber(values) {
    for (const value of values) {
      const n = toNumber(value);
      if (n !== null) {
        return n;
      }
    }

    return null;
  }

  function firstValidString(values) {
    for (const value of values) {
      if (
        typeof value === "string" &&
        value.trim().length > 0
      ) {
        return value.trim();
      }
    }

    return null;
  }

  function getNestedCoordinate(entity) {
    if (!entity || typeof entity !== "object") {
      return null;
    }

    const candidateObjects = [
      entity.currentCoordinate,
      entity.coordinate,
      entity.coordinates,
      entity.currentPosition,
      entity.position,
      entity.location,
      entity.centroid,
      entity.center,
      entity.latestCoordinate,
      entity.latestPosition
    ];

    for (const candidate of candidateObjects) {
      if (!candidate || typeof candidate !== "object") {
        continue;
      }

      const lat = firstValidNumber([
        candidate.lat,
        candidate.latitude,
        candidate.y
      ]);

      const lon = firstValidNumber([
        candidate.lon,
        candidate.lng,
        candidate.longitude,
        candidate.x
      ]);

      const timestamp = firstValidNumber([
        candidate.timestamp,
        candidate.observedAt,
        candidate.time,
        candidate.ts,
        entity.updatedAt,
        entity.timestamp,
        entity.observedAt,
        entity.lastObservedAt
      ]);

      if (lat !== null && lon !== null) {
        return {
          lat,
          lon,
          timestamp,
          source:
            firstValidString([
              candidate.source,
              entity.source,
              entity.provider,
              entity.origin
            ]) || "UNKNOWN"
        };
      }
    }

    const directLat = firstValidNumber([
      entity.lat,
      entity.latitude
    ]);

    const directLon = firstValidNumber([
      entity.lon,
      entity.lng,
      entity.longitude
    ]);

    if (directLat !== null && directLon !== null) {
      return {
        lat: directLat,
        lon: directLon,
        timestamp: firstValidNumber([
          entity.timestamp,
          entity.observedAt,
          entity.updatedAt,
          entity.lastObservedAt
        ]),
        source:
          firstValidString([
            entity.source,
            entity.provider,
            entity.origin
          ]) || "UNKNOWN"
      };
    }

    return null;
  }

  function isValidLatitude(lat) {
    return isFiniteNumber(lat) && lat >= -90 && lat <= 90;
  }

  function isValidLongitude(lon) {
    return isFiniteNumber(lon) && lon >= -180 && lon <= 180;
  }

  function isZeroCoordinate(lat, lon) {
    return lat === 0 && lon === 0;
  }

  function resolveIdentity(entity) {
    if (!entity || typeof entity !== "object") {
      return null;
    }

    return firstValidString([
      entity.persistentId,
      entity.canonicalTrackId,
      entity.trackId,
      entity.cellId,
      entity.stormId,
      entity.entityId,
      entity.id
    ]);
  }

  function normalizeEntity(entity, index) {
    const identity = resolveIdentity(entity);

    if (!identity) {
      state.statistics.rejectedMissingIdentity += 1;
      return null;
    }

    const coordinate = getNestedCoordinate(entity);

    if (!coordinate) {
      state.statistics.rejectedInvalidCoordinate += 1;
      return null;
    }

    const { lat, lon, timestamp, source } = coordinate;

    if (!isValidLatitude(lat) || !isValidLongitude(lon)) {
      state.statistics.rejectedInvalidCoordinate += 1;
      return null;
    }

    if (isZeroCoordinate(lat, lon)) {
      state.statistics.rejectedZeroCoordinate += 1;
      return null;
    }

    if (!timestamp) {
      state.statistics.rejectedMissingTimestamp += 1;
      return null;
    }

    return {
      persistentId: identity,
      canonicalTrackId:
        firstValidString([
          entity.canonicalTrackId,
          entity.trackId,
          identity
        ]) || identity,

      trackId:
        firstValidString([
          entity.trackId,
          entity.canonicalTrackId,
          identity
        ]) || identity,

      cellId:
        firstValidString([
          entity.cellId
        ]) || null,

      latitude: lat,
      longitude: lon,
      lat,
      lon,
      lng: lon,

      timestamp,
      observedAt: timestamp,

      source,
      sourceIndex: index,

      intensity:
        firstValidNumber([
          entity.intensity,
          entity.currentCoordinate?.intensity
        ]),

      confidence:
        firstValidNumber([
          entity.confidence,
          entity.currentCoordinate?.confidence
        ]),

      phase: PHASE,
      version: VERSION
    };
  }

  function ensurePersistentStore() {
    if (
      !global.RainGuardPersistentIdentityMotionHistoryV39 ||
      typeof global.RainGuardPersistentIdentityMotionHistoryV39 !== "object"
    ) {
      global.RainGuardPersistentIdentityMotionHistoryV39 = {};
    }

    return global.RainGuardPersistentIdentityMotionHistoryV39;
  }

  function appendRecord(store, record) {
    const key = record.persistentId;

    if (!Array.isArray(store[key])) {
      store[key] = [];
    }

    const bucket = store[key];

    const duplicate = bucket.some((item) => {
      return (
        item &&
        item.timestamp === record.timestamp &&
        item.latitude === record.latitude &&
        item.longitude === record.longitude
      );
    });

    if (duplicate) {
      return false;
    }

    bucket.push(record);

    bucket.sort((a, b) => {
      return Number(a.timestamp || 0) - Number(b.timestamp || 0);
    });

    if (bucket.length > 250) {
      bucket.splice(0, bucket.length - 250);
    }

    return true;
  }

  function exportFlatRecords(store) {
    const records = [];

    for (const [persistentId, bucket] of Object.entries(store)) {
      if (!Array.isArray(bucket)) {
        continue;
      }

      for (const record of bucket) {
        records.push({
          ...record,
          persistentId
        });
      }
    }

    records.sort((a, b) => {
      return Number(a.timestamp || 0) - Number(b.timestamp || 0);
    });

    global.RainGuardPersistentIdentityMotionRecordsV39 = records;

    return records;
  }

  function getSourceEntities() {
    const possibleSources = [
      global.RainArrivalLiveStormEntities,
      global.RainArrivalStableStormEntities,
      global.RainGuardCityStormMatchesV39,
      global.RainGuardMatchedStormArrivalCandidatesV39
    ];

    for (const source of possibleSources) {
      if (Array.isArray(source) && source.length > 0) {
        return source;
      }
    }

    return [];
  }

  async function run(options = {}) {
    if (state.runInProgress) {
      state.statistics.skippedRuns += 1;

      return {
        success: true,
        phase: PHASE,
        version: VERSION,
        status: "RUN_ALREADY_IN_PROGRESS"
      };
    }

    state.runInProgress = true;
    state.running = true;
    state.lastError = null;
    state.statistics.runs += 1;

    try {
      const entities = getSourceEntities();

      state.statistics.sourceEntities = entities.length;

      const store = ensurePersistentStore();

      let accepted = 0;
      let normalized = 0;
      let updatedIdentities = new Set();

      for (let i = 0; i < entities.length; i += 1) {
        const record = normalizeEntity(entities[i], i);

        if (!record) {
          continue;
        }

        normalized += 1;

        if (appendRecord(store, record)) {
          accepted += 1;
          updatedIdentities.add(record.persistentId);
        }
      }

      state.statistics.normalizedRecords += normalized;
      state.statistics.acceptedRecords += accepted;
      state.statistics.persistentIdentitiesUpdated +=
        updatedIdentities.size;

      const flatRecords = exportFlatRecords(store);

      global.RainGuardNestedCoordinateRecordsV39 = flatRecords;

      const result = {
        success: true,
        phase: PHASE,
        version: VERSION,
        build: BUILD,

        status:
          accepted > 0
            ? "PERSISTENT_NESTED_COORDINATES_READY"
            : "NO_NEW_VALID_COORDINATES",

        sourceEntityCount: entities.length,
        normalizedCount: normalized,
        acceptedCount: accepted,
        persistentIdentityCount: Object.keys(store).length,
        persistentRecordsCount: flatRecords.length,

        rejectedZeroCoordinate:
          state.statistics.rejectedZeroCoordinate,

        rejectedInvalidCoordinate:
          state.statistics.rejectedInvalidCoordinate,

        rejectedMissingIdentity:
          state.statistics.rejectedMissingIdentity,

        rejectedMissingTimestamp:
          state.statistics.rejectedMissingTimestamp,

        sample: flatRecords.slice(-5),

        generatedAt: Date.now()
      };

      state.lastResult = result;
      state.updatedAt = Date.now();

      if (options.log !== false) {
        console.log(
          `[RainGuard Phase ${PHASE}] Nested Coordinate Bridge result:`,
          result
        );
      }

      return result;
    } catch (error) {
      state.lastError = error;

      const result = {
        success: false,
        phase: PHASE,
        version: VERSION,
        build: BUILD,
        status: "PERSISTENT_NESTED_COORDINATE_BRIDGE_FAILED",
        error:
          error && error.message
            ? error.message
            : String(error)
      };

      state.lastResult = result;

      console.error(
        `[RainGuard Phase ${PHASE}] Error:`,
        error
      );

      return result;
    } finally {
      state.runInProgress = false;
      state.running = true;
    }
  }

  function diagnose() {
    const store =
      global.RainGuardPersistentIdentityMotionHistoryV39 || {};

    return {
      phase: PHASE,
      version: VERSION,
      build: BUILD,
      installed: state.installed,
      running: state.running,
      runInProgress: state.runInProgress,
      lastError: state.lastError,
      lastResult: state.lastResult,
      statistics: { ...state.statistics },

      liveStormEntities:
        Array.isArray(global.RainArrivalLiveStormEntities)
          ? global.RainArrivalLiveStormEntities.length
          : 0,

      persistentIdentityCount:
        Object.keys(store).length,

      persistentRecordCount:
        Array.isArray(global.RainGuardPersistentIdentityMotionRecordsV39)
          ? global.RainGuardPersistentIdentityMotionRecordsV39.length
          : 0
    };
  }

  global.RainGuardPersistentIdentityNestedCoordinateBridgeV39 = {
    phase: PHASE,
    version: VERSION,
    build: BUILD,
    state,
    run,
    diagnose
  };

  global.runRainGuardPersistentIdentityNestedCoordinateBridge =
    run;

  global.diagnoseRainGuardPersistentIdentityNestedCoordinateBridge =
    diagnose;

  state.installed = true;
  state.running = true;

  console.log(
    `[RainGuard Phase ${PHASE}] Persistent Identity Nested Coordinate Bridge`,
    diagnose()
  );
})(window);
