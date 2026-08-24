/*
====================================================================
 RainGuard AI V39

 Phase 39A-15F6N4B1B3B-H3B2D
 Persistent Track Temporal Append & Cross-Cycle History
 Accumulation Bridge
====================================================================

 Purpose:
 - Discover canonical temporal observations from H3B2A/H3B2C.
 - Maintain persistent temporal history per stable identity.
 - Append new observations across runtime cycles.
 - Prevent exact duplicate temporal observations.
 - Preserve chronological ordering.
 - Preserve source provenance.
 - Publish persistent cross-cycle temporal histories.
 - Prepare multi-point identities for motion vector recovery.
====================================================================
*/

(function (global) {
  "use strict";

  const PHASE = "39A-15F6N4B1B3B-H3B2D";
  const VERSION = "39A.15F6N4B1B3B-H3B2D.0";
  const BUILD =
    "rainguard-v39-persistent-track-temporal-append-cross-cycle-history-accumulation-bridge";

  const INSTALL_FLAG =
    "__RainGuardN4B1B3BH3B2DInstalled";

  const RESULT_NAME =
    "RainGuardN4B1B3BH3B2DResultV39";

  const STORE_NAME =
    "RainGuardN4B1B3BH3B2DPersistentTrackHistoryV39";

  const SOURCE_NAME =
    "RainGuardN4B1B3BH3B2DPersistentTemporalSourceV39";

  const STORAGE_KEY =
    "RainGuard:39A15F6N4B1B3B:H3B2D:PersistentTrackHistory:v1";

  if (global[INSTALL_FLAG]) {
    return;
  }

  global[INSTALL_FLAG] = true;

  const state = {
    installed: true,
    running: false,
    runs: 0,
    lastRun: null,
    lastError: null,
    storeLoaded: false
  };


  /* ============================================================
     Helpers
  ============================================================ */

  function isObj(v) {
    return !!v && typeof v === "object";
  }

  function isFn(v) {
    return typeof v === "function";
  }

  function str(v) {
    try {
      return v == null ? "" : String(v);
    } catch (_) {
      return "";
    }
  }

  function norm(v) {
    return str(v)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

  function num(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function now() {
    return Date.now();
  }


  /* ============================================================
     Identity extraction
  ============================================================ */

  function identityOf(rec, fallback) {
    if (!isObj(rec)) {
      return norm(fallback);
    }

    const vals = [
      rec.identity,
      rec.authoritativeIdentity,
      rec.persistentId,
      rec.canonicalPersistentId,
      rec.canonicalIdentity,
      rec.identityKey,
      rec.trackId,
      rec.trackID,
      rec.stableTrackId,
      rec.stormIdentity,
      rec.cellId,
      rec.cellID,
      rec.stormId,
      rec.stormID,
      rec.entityId,
      rec.entityID,
      rec.id
    ];

    for (const v of vals) {
      const x = norm(v);
      if (x) {
        return x;
      }
    }

    return norm(fallback);
  }


  /* ============================================================
     Coordinate extraction
  ============================================================ */

  function coordinateOf(rec) {
    if (!isObj(rec)) {
      return null;
    }

    const candidates = [
      [rec.lat, rec.lon],
      [rec.lat, rec.lng],
      [rec.latitude, rec.longitude],
      [rec.latitude, rec.lon],
      [rec.latitude, rec.lng],

      [rec.coordinate?.lat, rec.coordinate?.lon],
      [rec.coordinate?.lat, rec.coordinate?.lng],
      [rec.coordinate?.latitude, rec.coordinate?.longitude],

      [rec.coordinates?.lat, rec.coordinates?.lon],
      [rec.coordinates?.lat, rec.coordinates?.lng],
      [rec.coordinates?.latitude, rec.coordinates?.longitude],

      [rec.location?.lat, rec.location?.lon],
      [rec.location?.lat, rec.location?.lng],
      [rec.location?.latitude, rec.location?.longitude],

      [rec.position?.lat, rec.position?.lon],
      [rec.position?.lat, rec.position?.lng],

      [rec.center?.lat, rec.center?.lon],
      [rec.center?.lat, rec.center?.lng]
    ];

    for (const pair of candidates) {
      const lat = num(pair[0]);
      const lon = num(pair[1]);

      if (
        lat != null &&
        lon != null &&
        lat >= -90 &&
        lat <= 90 &&
        lon >= -180 &&
        lon <= 180
      ) {
        return { lat, lon };
      }
    }

    if (
      Array.isArray(rec.coordinates) &&
      rec.coordinates.length >= 2
    ) {
      const a = num(rec.coordinates[0]);
      const b = num(rec.coordinates[1]);

      if (
        a != null &&
        b != null
      ) {
        /*
          GeoJSON usually [lon, lat]
        */
        if (
          a >= -180 &&
          a <= 180 &&
          b >= -90 &&
          b <= 90
        ) {
          return {
            lat: b,
            lon: a
          };
        }
      }
    }

    return null;
  }


  /* ============================================================
     Timestamp extraction
  ============================================================ */

  function timestampOf(rec) {
    if (!isObj(rec)) {
      return null;
    }

    const vals = [
      rec.timestamp,
      rec.time,
      rec.observedAt,
      rec.observationTime,
      rec.detectedAt,
      rec.capturedAt,
      rec.generatedAt,
      rec.updatedAt,
      rec.createdAt,
      rec.datetime,
      rec.dateTime,
      rec.ts,
      rec.epoch,
      rec.epochMs
    ];

    for (const v of vals) {
      if (v == null) {
        continue;
      }

      if (typeof v === "number") {
        if (!Number.isFinite(v)) {
          continue;
        }

        if (v > 100000000000) {
          return Math.round(v);
        }

        if (v > 1000000000) {
          return Math.round(v * 1000);
        }
      }

      const parsed = Date.parse(v);

      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }

    return null;
  }


  /* ============================================================
     Observation containers
  ============================================================ */

  function observationsOf(rec) {
    if (!isObj(rec)) {
      return [];
    }

    const keys = [
      "observations",
      "history",
      "temporalSequence",
      "points",
      "records",
      "samples",
      "timeline",
      "track",
      "trackHistory",
      "positions"
    ];

    for (const key of keys) {
      if (Array.isArray(rec[key])) {
        return rec[key].slice();
      }
    }

    return [];
  }


  /* ============================================================
     Observation normalization
  ============================================================ */

  function normalizeObservation(raw, identity, sourceName) {
    if (!isObj(raw)) {
      return null;
    }

    const coordinate = coordinateOf(raw);

    if (!coordinate) {
      return null;
    }

    const timestamp =
      timestampOf(raw) ||
      now();

    return Object.assign({}, raw, {
      identity,
      lat: coordinate.lat,
      lon: coordinate.lon,
      latitude: coordinate.lat,
      longitude: coordinate.lon,
      timestamp,
      observedAt: timestamp,
      __h3b2dSource:
        raw.__h3b2dSource ||
        raw.__publicationSource ||
        raw.sourceName ||
        raw.source ||
        sourceName ||
        "unknown",
      __h3b2dAccumulatedAt: now()
    });
  }


  /* ============================================================
     Exact observation signature
  ============================================================ */

  function observationSignature(obs) {
    if (!isObj(obs)) {
      return "";
    }

    const coord = coordinateOf(obs);

    if (!coord) {
      return "";
    }

    const ts =
      timestampOf(obs) ||
      0;

    /*
      Keep enough precision for weather tracking,
      but suppress floating point noise.
    */
    const lat =
      coord.lat.toFixed(6);

    const lon =
      coord.lon.toFixed(6);

    return [
      lat,
      lon,
      ts
    ].join("|");
  }


  /* ============================================================
     Deduplication
  ============================================================ */

  function dedupeObservations(list) {
    const seen = new Set();
    const out = [];

    for (const obs of list || []) {
      const sig = observationSignature(obs);

      if (!sig) {
        continue;
      }

      if (seen.has(sig)) {
        continue;
      }

      seen.add(sig);
      out.push(obs);
    }

    out.sort((a, b) => {
      return (
        (timestampOf(a) || 0) -
        (timestampOf(b) || 0)
      );
    });

    return out;
  }


  /* ============================================================
     Persistent store
  ============================================================ */

  function ensureStore() {
    if (
      !isObj(global[STORE_NAME]) ||
      Array.isArray(global[STORE_NAME])
    ) {
      global[STORE_NAME] = {};
    }

    return global[STORE_NAME];
  }


  /* ============================================================
     localStorage restore
  ============================================================ */

  function restoreFromLocalStorage() {
    if (state.storeLoaded) {
      return {
        restored: false,
        reason: "ALREADY_LOADED"
      };
    }

    state.storeLoaded = true;

    let raw = null;

    try {
      raw =
        global.localStorage?.getItem(
          STORAGE_KEY
        );
    } catch (_) {}

    if (!raw) {
      return {
        restored: false,
        reason: "NO_LOCAL_STORAGE_HISTORY"
      };
    }

    try {
      const parsed =
        JSON.parse(raw);

      if (!isObj(parsed)) {
        return {
          restored: false,
          reason: "INVALID_LOCAL_STORAGE_HISTORY"
        };
      }

      const store =
        ensureStore();

      let restoredIdentityCount = 0;
      let restoredObservationCount = 0;

      for (
        const [identity, rec]
        of Object.entries(parsed)
      ) {
        if (!isObj(rec)) {
          continue;
        }

        const observations =
          dedupeObservations(
            observationsOf(rec)
          );

        if (!observations.length) {
          continue;
        }

        store[identity] =
          Object.assign({}, rec, {
            identity,
            observations,
            history: observations,
            temporalSequence: observations
          });

        restoredIdentityCount++;
        restoredObservationCount +=
          observations.length;
      }

      return {
        restored: true,
        restoredIdentityCount,
        restoredObservationCount
      };

    } catch (e) {
      return {
        restored: false,
        reason:
          e?.message ||
          String(e)
      };
    }
  }


  /* ============================================================
     localStorage persistence
  ============================================================ */

  function persistToLocalStorage() {
    try {
      global.localStorage?.setItem(
        STORAGE_KEY,
        JSON.stringify(
          ensureStore()
        )
      );

      return true;
    } catch (_) {
      return false;
    }
  }


  /* ============================================================
     Canonical source candidates
  ============================================================ */

  const SOURCE_CANDIDATES = [
    /*
      H3B2C
    */
    "RainGuardN4B1B3BH3B2CMotionTemporalSourceV39",
    "RainGuardN4B1B3BH3B2CResultV39",

    /*
      H3B2B
    */
    "RainGuardN4B1B3BH3B2BAlignedTemporalSourceV39",

    /*
      H3B2A published sources
    */
    "RainGuardN4B1B3BH3B2ARuntimeBoundCanonicalTemporalSourceV39",
    "RainGuardN4B1B3BH3B1PublishedCanonicalTemporalSourceV39",
    "RainGuardN4B1B3BH3B1NormalizedCanonicalTemporalSourceV39",
    "RainGuardN4B1B3BH3B1CanonicalTemporalSourceV39",
    "RainGuardN4B1B3BH3BRecoveredTemporalSourceV39",

    /*
      Older canonical chain
    */
    "RainGuardH2ACanonicalTemporalSourceForH3V39",
    "RainGuardH2RuntimeBoundTemporalSourceV39",
    "RainGuardCrossCycleTemporalAppendOverrideAccumulatorV39",

    /*
      Live history
    */
    "RainGuardPersistentStormObservationHistoryV39",
    "RainArrivalLiveTrackHistory",
    "RainGuardLiveTrackHistoryByIdentityV39",
    "RainGuardRecoveredLiveTrackHistoryV39"
  ];


  /* ============================================================
     Source extraction
  ============================================================ */

  function extractIdentitiesFromSource(
    source,
    sourceName
  ) {
    const out = {};

    function addRecord(
      rec,
      fallbackIdentity
    ) {
      if (!isObj(rec)) {
        return;
      }

      const identity =
        identityOf(
          rec,
          fallbackIdentity
        );

      if (!identity) {
        return;
      }

      let observations =
        observationsOf(rec);

      /*
        Some runtime sources may expose
        a single observation object.
      */
      if (
        !observations.length &&
        coordinateOf(rec)
      ) {
        observations = [rec];
      }

      const normalized = [];

      for (const obs of observations) {
        const n =
          normalizeObservation(
            obs,
            identity,
            sourceName
          );

        if (n) {
          normalized.push(n);
        }
      }

      if (!normalized.length) {
        return;
      }

      if (!out[identity]) {
        out[identity] = {
          identity,
          observations: [],
          sourceNames: []
        };
      }

      out[identity].observations.push(
        ...normalized
      );

      out[identity].sourceNames.push(
        sourceName
      );
    }


    function walk(
      value,
      fallback,
      depth
    ) {
      if (
        depth > 7 ||
        value == null
      ) {
        return;
      }

      if (value instanceof Map) {
        let count = 0;

        for (
          const [key, rec]
          of value.entries()
        ) {
          if (++count > 50000) {
            break;
          }

          addRecord(rec, key);
        }

        return;
      }

      if (Array.isArray(value)) {
        const max =
          Math.min(
            value.length,
            50000
          );

        for (
          let i = 0;
          i < max;
          i++
        ) {
          addRecord(
            value[i],
            `${fallback || sourceName}:${i}`
          );
        }

        return;
      }

      if (!isObj(value)) {
        return;
      }

      if (
        isObj(value.identities)
      ) {
        for (
          const [key, rec]
          of Object.entries(
            value.identities
          )
        ) {
          addRecord(rec, key);
        }

        return;
      }

      /*
        Object keyed directly by identity,
        such as:

        {
          "track:Riyadh": [...],
          "track:Jeddah": [...]
        }
      */
      const entries =
        Object.entries(value);

      let identityLikeCount = 0;

      for (
        const [key, rec]
        of entries.slice(0, 100)
      ) {
        if (
          Array.isArray(rec) ||
          (
            isObj(rec) &&
            (
              identityOf(rec, key) ||
              observationsOf(rec).length ||
              coordinateOf(rec)
            )
          )
        ) {
          identityLikeCount++;
        }
      }

      if (identityLikeCount >= 2) {
        for (
          const [key, rec]
          of entries
        ) {
          if (Array.isArray(rec)) {
            for (const obs of rec) {
              addRecord(
                Object.assign(
                  {},
                  obs,
                  { identity: key }
                ),
                key
              );
            }
          } else {
            addRecord(rec, key);
          }
        }

        return;
      }

      const nestedKeys = [
        "result",
        "lastRun",
        "lastResult",
        "data",
        "state",
        "source",
        "temporalSource",
        "canonicalSource",
        "normalizedSource",
        "publishedSource",
        "persistentHistory",
        "trackHistory",
        "history",
        "tracks",
        "registry"
      ];

      for (const key of nestedKeys) {
        if (value[key] != null) {
          walk(
            value[key],
            key,
            depth + 1
          );
        }
      }
    }

    walk(
      source,
      sourceName,
      0
    );

    for (
      const rec
      of Object.values(out)
    ) {
      rec.observations =
        dedupeObservations(
          rec.observations
        );

      rec.sourceNames =
        [
          ...new Set(
            rec.sourceNames
          )
        ];
    }

    return out;
  }


  /* ============================================================
     Discover runtime sources
  ============================================================ */

  function discoverSources() {
    const found = [];

    for (
      const name
      of SOURCE_CANDIDATES
    ) {
      let value;

      try {
        value =
          global[name];
      } catch (_) {
        continue;
      }

      if (
        value == null ||
        isFn(value)
      ) {
        continue;
      }

      const identities =
        extractIdentitiesFromSource(
          value,
          name
        );

      const identityCount =
        Object.keys(
          identities
        ).length;

      if (!identityCount) {
        continue;
      }

      let observationCount = 0;
      let multiPointIdentityCount = 0;
      let maxObservedPointsPerIdentity = 0;

      for (
        const rec
        of Object.values(identities)
      ) {
        const n =
          rec.observations.length;

        observationCount += n;

        if (n >= 2) {
          multiPointIdentityCount++;
        }

        maxObservedPointsPerIdentity =
          Math.max(
            maxObservedPointsPerIdentity,
            n
          );
      }

      found.push({
        name,
        identities,
        identityCount,
        observationCount,
        multiPointIdentityCount,
        maxObservedPointsPerIdentity
      });
    }

    found.sort(
      (a, b) =>
        b.observationCount -
        a.observationCount
    );

    return found;
  }


  /* ============================================================
     Merge current cycle observations
     into persistent history
  ============================================================ */

  function appendSourcesToPersistentStore(
    sources
  ) {
    const store =
      ensureStore();

    let newIdentityCount = 0;
    let updatedIdentityCount = 0;
    let appendedObservationCount = 0;
    let duplicateObservationCount = 0;
    let inputObservationCount = 0;

    for (const source of sources) {
      for (
        const [identity, rec]
        of Object.entries(
          source.identities
        )
      ) {
        const incoming =
          rec.observations || [];

        inputObservationCount +=
          incoming.length;

        if (!store[identity]) {
          store[identity] = {
            identity,
            observations: [],
            history: [],
            temporalSequence: [],
            sourceNames: [],
            createdAt: now(),
            lastUpdatedAt: now(),
            cycleCount: 0
          };

          newIdentityCount++;
        } else {
          updatedIdentityCount++;
        }

        const existing =
          observationsOf(
            store[identity]
          );

        const signatures =
          new Set(
            existing
              .map(
                observationSignature
              )
              .filter(Boolean)
          );

        const additions = [];

        for (const obs of incoming) {
          const sig =
            observationSignature(obs);

          if (!sig) {
            continue;
          }

          if (
            signatures.has(sig)
          ) {
            duplicateObservationCount++;
            continue;
          }

          signatures.add(sig);
          additions.push(obs);
          appendedObservationCount++;
        }

        const merged =
          dedupeObservations(
            existing.concat(
              additions
            )
          );

        store[identity] =
          Object.assign(
            {},
            store[identity],
            {
              identity,
              observations: merged,
              history: merged,
              temporalSequence: merged,
              sourceNames: [
                ...new Set([
                  ...(
                    store[identity]
                      .sourceNames ||
                    []
                  ),
                  source.name,
                  ...(
                    rec.sourceNames ||
                    []
                  )
                ])
              ],
              lastUpdatedAt: now(),
              cycleCount:
                (
                  Number(
                    store[identity]
                      .cycleCount
                  ) ||
                  0
                ) + 1
            }
          );
      }
    }

    return {
      inputObservationCount,
      newIdentityCount,
      updatedIdentityCount,
      appendedObservationCount,
      duplicateObservationCount
    };
  }


  /* ============================================================
     Store statistics
  ============================================================ */

  function getStoreStats() {
    const store =
      ensureStore();

    let observationCount = 0;
    let multiPointIdentityCount = 0;
    let motionReadyIdentityCount = 0;
    let maxObservedPointsPerIdentity = 0;
    let maxUniqueCoordinatesPerIdentity = 0;

    const sample = [];

    for (
      const [identity, rec]
      of Object.entries(store)
    ) {
      const observations =
        dedupeObservations(
          observationsOf(rec)
        );

      const coordinateSet =
        new Set();

      for (const obs of observations) {
        const coord =
          coordinateOf(obs);

        if (coord) {
          coordinateSet.add(
            `${coord.lat.toFixed(6)}|${coord.lon.toFixed(6)}`
          );
        }
      }

      const observationN =
        observations.length;

      const coordinateN =
        coordinateSet.size;

      observationCount +=
        observationN;

      if (observationN >= 2) {
        multiPointIdentityCount++;
      }

      /*
        Motion-ready requires:
        >= 2 temporal observations
        and >= 2 distinct coordinates.
      */
      if (
        observationN >= 2 &&
        coordinateN >= 2
      ) {
        motionReadyIdentityCount++;
      }

      maxObservedPointsPerIdentity =
        Math.max(
          maxObservedPointsPerIdentity,
          observationN
        );

      maxUniqueCoordinatesPerIdentity =
        Math.max(
          maxUniqueCoordinatesPerIdentity,
          coordinateN
        );

      if (sample.length < 30) {
        sample.push({
          identity,
          observationCount:
            observationN,
          uniqueCoordinateCount:
            coordinateN,
          cycleCount:
            Number(
              rec.cycleCount
            ) || 0,
          motionReady:
            observationN >= 2 &&
            coordinateN >= 2
        });
      }
    }

    return {
      identityCount:
        Object.keys(store).length,
      observationCount,
      multiPointIdentityCount,
      motionReadyIdentityCount,
      maxObservedPointsPerIdentity,
      maxUniqueCoordinatesPerIdentity,
      sample
    };
  }


  /* ============================================================
     Publish canonical persistent source
  ============================================================ */

  function publishPersistentSource(
    stats
  ) {
    const store =
      ensureStore();

    const source = {
      success: true,
      phase: PHASE,
      version: VERSION,
      build: BUILD,

      status:
        stats.motionReadyIdentityCount > 0
          ? "PERSISTENT_CROSS_CYCLE_HISTORY_MOTION_READY"
          : "PERSISTENT_CROSS_CYCLE_HISTORY_ACCUMULATING",

      identities: store,

      identityCount:
        stats.identityCount,

      observationCount:
        stats.observationCount,

      multiPointIdentityCount:
        stats.multiPointIdentityCount,

      motionReadyIdentityCount:
        stats.motionReadyIdentityCount,

      maxObservedPointsPerIdentity:
        stats.maxObservedPointsPerIdentity,

      maxUniqueCoordinatesPerIdentity:
        stats.maxUniqueCoordinatesPerIdentity,

      generatedAt: now()
    };

    global[SOURCE_NAME] =
      source;

    /*
      Additional names for downstream discovery.
    */
    global.RainGuardPersistentCrossCycleTrackHistoryV39 =
      store;

    global.RainGuardPersistentTemporalTrackHistoryV39 =
      store;

    global.RainGuardH3B2DMotionReadyTemporalSourceV39 =
      source;

    return source;
  }


  /* ============================================================
     Main execution
  ============================================================ */

  async function run(options) {
    if (state.running) {
      return {
        success: false,
        phase: PHASE,
        version: VERSION,
        build: BUILD,
        status:
          "H3B2D_ALREADY_RUNNING"
      };
    }

    state.running = true;

    const startedAt =
      now();

    try {
      const opts =
        Object.assign(
          {
            persistLocalStorage: true
          },
          options || {}
        );

      const restore =
        restoreFromLocalStorage();

      const sources =
        discoverSources();

      if (!sources.length) {
        const result = {
          success: false,
          phase: PHASE,
          version: VERSION,
          build: BUILD,

          status:
            "NO_CANONICAL_TEMPORAL_SOURCE_AVAILABLE",

          sourceCount: 0,

          restore,

          generatedAt:
            now(),

          durationMs:
            now() -
            startedAt
        };

        global[RESULT_NAME] =
          result;

        state.lastRun =
          result;

        state.lastError =
          result.status;

        return result;
      }

      const appendResult =
        appendSourcesToPersistentStore(
          sources
        );

      const stats =
        getStoreStats();

      const persistentSource =
        publishPersistentSource(
          stats
        );

      let localStoragePersisted =
        false;

      if (
        opts.persistLocalStorage
      ) {
        localStoragePersisted =
          persistToLocalStorage();
      }

      const result = {
        success: true,

        phase: PHASE,
        version: VERSION,
        build: BUILD,

        status:
          stats.motionReadyIdentityCount > 0
            ? "PERSISTENT_TRACK_HISTORY_ACCUMULATED_MOTION_READY"
            : "PERSISTENT_TRACK_HISTORY_ACCUMULATED_WAITING_FOR_COORDINATE_CHANGE",

        sourceCount:
          sources.length,

        selectedSourceName:
          sources[0].name,

        sourceNames:
          sources.map(
            s => s.name
          ),

        sourceSample:
          sources
            .slice(0, 20)
            .map(s => ({
              name:
                s.name,
              identityCount:
                s.identityCount,
              observationCount:
                s.observationCount,
              multiPointIdentityCount:
                s.multiPointIdentityCount,
              maxObservedPointsPerIdentity:
                s.maxObservedPointsPerIdentity
            })),

        restore,

        inputObservationCount:
          appendResult.inputObservationCount,

        appendedObservationCount:
          appendResult.appendedObservationCount,

        duplicateObservationCount:
          appendResult.duplicateObservationCount,

        newIdentityCount:
          appendResult.newIdentityCount,

        updatedIdentityCount:
          appendResult.updatedIdentityCount,

        identityCount:
          stats.identityCount,

        observationCount:
          stats.observationCount,

        multiPointIdentityCount:
          stats.multiPointIdentityCount,

        motionReadyIdentityCount:
          stats.motionReadyIdentityCount,

        maxObservedPointsPerIdentity:
          stats.maxObservedPointsPerIdentity,

        maxUniqueCoordinatesPerIdentity:
          stats.maxUniqueCoordinatesPerIdentity,

        persistentStorePublished:
          true,

        persistentSourcePublished:
          true,

        persistentStoreName:
          STORE_NAME,

        persistentSourceName:
          SOURCE_NAME,

        localStoragePersisted,

        storageKey:
          STORAGE_KEY,

        sample:
          stats.sample,

        generatedAt:
          now(),

        durationMs:
          now() -
          startedAt
      };

      global[RESULT_NAME] =
        result;

      state.runs++;
      state.lastRun =
        result;
      state.lastError =
        null;

      console.log(
        `[RainGuard Phase ${PHASE}] Persistent Track Temporal Append result:`
      );

      console.log(result);

      if (
        console.table
      ) {
        try {
          console.table(
            result.sample
          );
        } catch (_) {}
      }

      return result;

    } catch (e) {
      const result = {
        success: false,

        phase: PHASE,
        version: VERSION,
        build: BUILD,

        status:
          "H3B2D_HISTORY_ACCUMULATION_FAILED",

        error:
          e?.message ||
          String(e),

        generatedAt:
          now(),

        durationMs:
          now() -
          startedAt
      };

      global[RESULT_NAME] =
        result;

      state.lastRun =
        result;

      state.lastError =
        result.error;

      console.error(
        `[RainGuard Phase ${PHASE}] failed:`,
        e
      );

      return result;

    } finally {
      state.running =
        false;
    }
  }


  /* ============================================================
     Diagnostics
  ============================================================ */

  function diagnose() {
    const sources =
      discoverSources();

    const stats =
      getStoreStats();

    const result = {
      success: true,

      phase: PHASE,
      version: VERSION,
      build: BUILD,

      installed: true,
      running:
        state.running,

      runs:
        state.runs,

      sourceCount:
        sources.length,

      sourceNames:
        sources.map(
          s => s.name
        ),

      persistentStoreExists:
        isObj(
          global[STORE_NAME]
        ),

      persistentSourceExists:
        isObj(
          global[SOURCE_NAME]
        ),

      identityCount:
        stats.identityCount,

      observationCount:
        stats.observationCount,

      multiPointIdentityCount:
        stats.multiPointIdentityCount,

      motionReadyIdentityCount:
        stats.motionReadyIdentityCount,

      maxObservedPointsPerIdentity:
        stats.maxObservedPointsPerIdentity,

      maxUniqueCoordinatesPerIdentity:
        stats.maxUniqueCoordinatesPerIdentity,

      storageKey:
        STORAGE_KEY,

      lastError:
        state.lastError,

      lastRun:
        state.lastRun
    };

    console.log(
      `[RainGuard Phase ${PHASE}] Diagnostic:`,
      result
    );

    return result;
  }


  /* ============================================================
     Public APIs
  ============================================================ */

  global.runRainGuardN4B1B3BH3B2DPersistentTrackTemporalAppendCrossCycleHistoryAccumulationBridge =
    run;

  global.diagnoseRainGuardN4B1B3BH3B2DPersistentTrackTemporalAppendCrossCycleHistoryAccumulationBridge =
    diagnose;

  global.getRainGuardH3B2DPersistentTrackHistory =
    function () {
      return ensureStore();
    };

  global.getRainGuardH3B2DPersistentTrackHistoryForIdentity =
    function (identity) {
      const key =
        norm(identity);

      return (
        ensureStore()[key] ||
        null
      );
    };

  global.clearRainGuardH3B2DPersistentTrackHistory =
    function () {
      global[STORE_NAME] =
        {};

      global[SOURCE_NAME] =
        null;

      try {
        global.localStorage?.removeItem(
          STORAGE_KEY
        );
      } catch (_) {}

      return {
        success: true,
        status:
          "H3B2D_PERSISTENT_HISTORY_CLEARED"
      };
    };


  global.RainGuardN4B1B3BH3B2DBridgeV39 = {
    phase:
      PHASE,

    version:
      VERSION,

    build:
      BUILD,

    run,
    diagnose,

    getHistory:
      global.getRainGuardH3B2DPersistentTrackHistory,

    getHistoryForIdentity:
      global.getRainGuardH3B2DPersistentTrackHistoryForIdentity,

    clear:
      global.clearRainGuardH3B2DPersistentTrackHistory,

    state
  };

})(window);
