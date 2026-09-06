/*
===========================================================
 RainGuard AI V32
 Storm Tracking -> Modular TrackStore Live Bridge

 Phase 38M-12B-1
 Phase 39A Memory Pressure Guard
 C7B2B2 Storm/ETA Reliability Source Binding Repair

 Version:
 32.38M.12B1-MEMSAFE-2
===========================================================
*/

(function (global) {
    "use strict";

    const VERSION =
        "32.38M.12B1-MEMSAFE-2";

    const BUILD =
        "rainguard-v32-storm-trackstore-live-bridge-memory-safe-v32-source-binding";

    const CONFIG = Object.freeze({
        autoStart: true,

        /*
         * Memory-safe cadence.
         */
        syncIntervalMs: 10000,

        /*
         * Hard maximum entities processed
         * during a single synchronization cycle.
         */
        maximumEntitiesPerSync: 100,

        /*
         * Only a small sample of write results
         * is retained for diagnostics.
         */
        maximumWriteResultsStored: 25,

        /*
         * Reserved limit for track history.
         */
        maximumPointsPerTrack: 60,

        maximumPointAgeMs:
            6 * 60 * 60 * 1000,

        minimumCoordinateDelta:
            0.00001,

        /*
         * Prevent overlapping sync cycles.
         */
        preventConcurrentSync: true,

        /*
         * Never retain full raw source entities.
         */
        preserveRawEntity: false,

        lightweightSnapshots: true,

        debug: true
    });

    const now =
        () => Date.now();


    /*
    =========================================================
     Utilities
    =========================================================
    */

    function isObject(value) {
        return (
            value !== null &&
            typeof value === "object" &&
            !Array.isArray(value)
        );
    }


    function clone(value) {
        if (
            value === null ||
            value === undefined
        ) {
            return value;
        }

        try {
            return typeof structuredClone === "function"
                ? structuredClone(value)
                : JSON.parse(
                    JSON.stringify(value)
                );

        } catch (_) {
            return null;
        }
    }


    function number(
        value,
        fallback = null
    ) {
        const n =
            Number(value);

        return Number.isFinite(n)
            ? n
            : fallback;
    }


    function text(value) {
        return (
            value === null ||
            value === undefined
        )
            ? ""
            : String(value).trim();
    }


    function timestamp(value) {
        if (
            value === null ||
            value === undefined
        ) {
            return now();
        }

        if (
            typeof value === "number" &&
            Number.isFinite(value)
        ) {
            return value < 100000000000
                ? value * 1000
                : value;
        }

        const parsed =
            Date.parse(value);

        return Number.isFinite(parsed)
            ? parsed
            : now();
    }


    function coordinate(value) {
        if (!value) {
            return null;
        }

        /*
         * Array coordinates.
         */
        if (
            Array.isArray(value) &&
            value.length >= 2
        ) {
            const first =
                number(value[0]);

            const second =
                number(value[1]);

            if (
                first === null ||
                second === null
            ) {
                return null;
            }

            const likelyLonLat =
                Math.abs(first) > 90 &&
                Math.abs(second) <= 90;

            return likelyLonLat
                ? {
                    lat: second,
                    lon: first
                }
                : {
                    lat: first,
                    lon: second
                };
        }


        const lat =
            number(
                value.lat ??
                value.latitude ??
                value.y ??
                value.center?.lat ??
                value.center?.latitude ??
                value.centroid?.lat ??
                value.centroid?.latitude ??
                value.coordinate?.lat ??
                value.coordinate?.latitude
            );


        const lon =
            number(
                value.lon ??
                value.lng ??
                value.longitude ??
                value.x ??
                value.center?.lon ??
                value.center?.lng ??
                value.center?.longitude ??
                value.centroid?.lon ??
                value.centroid?.lng ??
                value.centroid?.longitude ??
                value.coordinate?.lon ??
                value.coordinate?.lng ??
                value.coordinate?.longitude
            );


        if (
            lat === null ||
            lon === null ||
            lat < -90 ||
            lat > 90 ||
            lon < -180 ||
            lon > 180
        ) {
            return null;
        }

        return {
            lat,
            lon
        };
    }


    function toArray(value) {
        if (!value) {
            return [];
        }

        if (Array.isArray(value)) {
            return value;
        }

        if (
            value instanceof Map ||
            value instanceof Set
        ) {
            return Array.from(
                value.values()
            );
        }

        if (
            typeof value.values ===
            "function"
        ) {
            try {
                return Array.from(
                    value.values()
                );
            } catch (_) {}
        }

        return isObject(value)
            ? Object.values(value)
            : [];
    }


    /*
     * Small diagnostic-only summary.
     * Never retain the entire raw entity.
     */
    function compactEntityMetadata(
        entity
    ) {
        if (
            !entity ||
            typeof entity !== "object"
        ) {
            return null;
        }

        return {
            id:
                text(
                    entity.trackId ??
                    entity.canonicalTrackId ??
                    entity.cellId ??
                    entity.id ??
                    entity.candidateId
                ) || null,

            source:
                text(
                    entity.source
                ) || null,

            city:
                text(
                    entity.city ??
                    entity.cityName ??
                    entity.targetCity
                ) || null,

            status:
                text(
                    entity.status
                ) || null
        };
    }


    /*
    =========================================================
     Bridge
    =========================================================
    */

    class StormTrackStoreBridge {
        constructor(config = {}) {
            this.version =
                VERSION;

            this.build =
                BUILD;

            this.config = {
                ...CONFIG,
                ...(isObject(config)
                    ? config
                    : {})
            };

            this.running =
                false;

            this.timer =
                null;

            /*
             * Concurrency guards.
             */
            this.syncInProgress =
                false;

            this.activeSyncPromise =
                null;

            this.lastSyncStartedAt =
                null;

            this.lastSyncCompletedAt =
                null;

            /*
             * Keep only source NAME.
             *
             * Do not retain the full source object.
             */
            this.lastSourceName =
                null;

            this.lastSourceIndex =
                null;

            this.lastResult =
                null;

            this.lastError =
                null;

            this.statistics = {
                syncRuns: 0,

                concurrentSyncSkips: 0,

                discovered: 0,

                normalized: 0,

                inserted: 0,

                updated: 0,

                skipped: 0,

                failures: 0,

                memoryGuardDrops: 0,

                v32SourceHits: 0,

                v31FallbackHits: 0,

                emptyDiscoveryRuns: 0
            };
        }


        /*
        =====================================================
         TrackStore
        =====================================================
        */

        getTrackStore() {
            return (
                global
                    .RainArrivalTrackStoreV32 ||

                global
                    .RainGuardAI
                    ?.V32
                    ?.rainArrivalModules
                    ?.trackStore ||

                global
                    .RainArrivalEngineV32
                    ?.get?.(
                        "trackStore"
                    ) ||

                null
            );
        }


        /*
        =====================================================
         Source Discovery
        =====================================================
        */

        getSources() {
            /*
             * IMPORTANT:
             *
             * V32 live sources have priority.
             *
             * Previously this bridge mostly searched V31
             * sources, while the actual live storm entities
             * were already available in:
             *
             * RainArrivalStormEntityCollectorV32
             * RainArrivalLiveStormExportBridgeV32
             */

            const definitions = [
                /*
                 * ------------------------------------------
                 * V32 authoritative/live sources
                 * ------------------------------------------
                 */
                {
                    name:
                        "RainArrivalStormEntityCollectorV32",

                    generation:
                        "V32",

                    value:
                        global
                            .RainArrivalStormEntityCollectorV32
                },

                {
                    name:
                        "RainArrivalLiveStormExportBridgeV32",

                    generation:
                        "V32",

                    value:
                        global
                            .RainArrivalLiveStormExportBridgeV32
                },

                {
                    name:
                        "V32.rainArrivalModules.stormEntityCollector",

                    generation:
                        "V32",

                    value:
                        global
                            .RainGuardAI
                            ?.V32
                            ?.rainArrivalModules
                            ?.stormEntityCollector
                },

                {
                    name:
                        "V32.rainArrivalModules.liveStormExportBridge",

                    generation:
                        "V32",

                    value:
                        global
                            .RainGuardAI
                            ?.V32
                            ?.rainArrivalModules
                            ?.liveStormExportBridge
                },


                /*
                 * ------------------------------------------
                 * V31 fallback sources
                 * ------------------------------------------
                 */
                {
                    name:
                        "StormCellTrackingEngineV31",

                    generation:
                        "V31",

                    value:
                        global
                            .StormCellTrackingEngineV31
                },

                {
                    name:
                        "StormTrackingEngineV31",

                    generation:
                        "V31",

                    value:
                        global
                            .StormTrackingEngineV31
                },

                {
                    name:
                        "RainGuardStormTrackingV31",

                    generation:
                        "V31",

                    value:
                        global
                            .RainGuardStormTrackingV31
                },

                {
                    name:
                        "RainGuardAI.V31.stormCellTracking",

                    generation:
                        "V31",

                    value:
                        global
                            .RainGuardAI
                            ?.V31
                            ?.stormCellTracking
                },

                {
                    name:
                        "RainGuardAI.V31.stormTracking",

                    generation:
                        "V31",

                    value:
                        global
                            .RainGuardAI
                            ?.V31
                            ?.stormTracking
                },

                {
                    name:
                        "RainGuardAI.stormCellTracking",

                    generation:
                        "V31",

                    value:
                        global
                            .RainGuardAI
                            ?.stormCellTracking
                },

                {
                    name:
                        "RainGuardAI.stormTracking",

                    generation:
                        "V31",

                    value:
                        global
                            .RainGuardAI
                            ?.stormTracking
                }
            ];

            return definitions.filter(
                item =>
                    Boolean(item.value)
            );
        }


        /*
        =====================================================
         Entity Extraction
        =====================================================
        */

        extractEntities(value) {
            if (!value) {
                return [];
            }

            /*
             * Direct arrays/maps/sets.
             */
            const direct =
                toArray(value);

            if (
                direct.length &&
                direct.some(
                    isObject
                )
            ) {
                return direct;
            }


            /*
             * Common V32 + V31 containers.
             */
            for (
                const key of [
                    "entities",
                    "stormEntities",
                    "liveStormEntities",
                    "exportedEntities",

                    "activeCells",
                    "cells",
                    "stormCells",
                    "trackedCells",

                    "activeTracks",
                    "tracks",
                    "stormTracks",

                    "candidates",
                    "items",
                    "results",

                    "data",
                    "payload",
                    "output",

                    "result",
                    "lastResult",
                    "lastOutput"
                ]
            ) {
                const items =
                    toArray(
                        value?.[key]
                    );

                if (
                    items.length
                ) {
                    return items;
                }
            }

            return [];
        }


        /*
        =====================================================
         Source Reader
        =====================================================
        */

        readSource(source) {
            if (!source) {
                return [];
            }


            /*
             * V32 APIs FIRST.
             *
             * getAll() is bounded where possible.
             */
            const methods = [
                "getAll",
                "getEntities",
                "getLiveEntities",
                "getExportedEntities",
                "getStormEntities",

                /*
                 * V31 APIs.
                 */
                "getActiveCells",
                "getCells",
                "getActiveTracks",
                "getTracks",
                "getTrackedCells",
                "getCurrentCells",

                "getSnapshot",
                "getState"
            ];


            for (
                const method
                of methods
            ) {
                if (
                    typeof source?.[method] !==
                    "function"
                ) {
                    continue;
                }

                try {
                    let output;

                    /*
                     * Bounded getAll() for the
                     * memory-safe collector.
                     */
                    if (
                        method === "getAll"
                    ) {
                        output =
                            source[method](
                                this.config
                                    .maximumEntitiesPerSync
                            );
                    } else {
                        output =
                            source[method]();
                    }


                    /*
                     * This bridge remains synchronous
                     * at source-discovery level.
                     *
                     * Async source methods are skipped.
                     */
                    if (
                        output &&
                        typeof output.then ===
                        "function"
                    ) {
                        continue;
                    }


                    const entities =
                        this.extractEntities(
                            output
                        );

                    if (
                        entities.length
                    ) {
                        return entities;
                    }

                } catch (error) {
                    this.captureError(
                        error,
                        `SOURCE_METHOD_FAILED:${method}`
                    );
                }
            }


            /*
             * Direct object fallback.
             */
            return this.extractEntities(
                source
            );
        }


        /*
        =====================================================
         Discover
        =====================================================
        */

        discover() {
            const sources =
                this.getSources();


            for (
                let sourceIndex = 0;
                sourceIndex <
                    sources.length;
                sourceIndex++
            ) {
                const definition =
                    sources[
                        sourceIndex
                    ];

                const source =
                    definition.value;


                const entities =
                    this.readSource(
                        source
                    );


                if (
                    entities.length
                ) {
                    this.lastSourceName =
                        definition.name;

                    this.lastSourceIndex =
                        sourceIndex;


                    if (
                        definition.generation ===
                        "V32"
                    ) {
                        this.statistics
                            .v32SourceHits += 1;
                    } else {
                        this.statistics
                            .v31FallbackHits += 1;
                    }


                    const maximum =
                        this.config
                            .maximumEntitiesPerSync;


                    if (
                        entities.length >
                        maximum
                    ) {
                        this.statistics
                            .memoryGuardDrops +=
                            entities.length -
                            maximum;
                    }


                    /*
                     * Hard bounded result.
                     */
                    return entities.slice(
                        0,
                        maximum
                    );
                }
            }


            this.lastSourceName =
                null;

            this.lastSourceIndex =
                null;

            this.statistics
                .emptyDiscoveryRuns += 1;

            return [];
        }


        /*
        =====================================================
         Normalize
        =====================================================
        */

        normalizeEntity(
            entity,
            index
        ) {
            if (
                !entity ||
                typeof entity !==
                "object"
            ) {
                return null;
            }


            const pointCoordinate =
                coordinate(
                    entity
                        ?.currentCoordinate ??

                    entity
                        ?.coordinate ??

                    entity
                        ?.center ??

                    entity
                        ?.centroid ??

                    entity
                        ?.location ??

                    entity
                        ?.position ??

                    entity
                );


            if (!pointCoordinate) {
                return null;
            }


            const pointTimestamp =
                timestamp(
                    entity.timestamp ??
                    entity.updatedAt ??
                    entity.lastSeenAt ??
                    entity.observedAt ??
                    entity.time ??
                    entity.frameTimestamp
                );


            if (
                now() -
                    pointTimestamp >
                this.config
                    .maximumPointAgeMs
            ) {
                return null;
            }


            const trackId =
                text(
                    entity.trackId ??
                    entity.canonicalTrackId ??
                    entity.cellId ??
                    entity.id ??
                    entity.candidateId ??
                    entity.uuid
                ) ||

                (
                    `LIVE-` +
                    `${Math.round(
                        pointCoordinate.lat *
                        10000
                    )}-` +
                    `${Math.round(
                        pointCoordinate.lon *
                        10000
                    )}-` +
                    `${index}`
                );


            const cellId =
                text(
                    entity.cellId ??
                    entity.id ??
                    entity.trackId
                ) ||
                trackId;


            const intensity =
                number(
                    entity.intensity ??
                    entity.reflectivity ??
                    entity.dbz ??
                    entity.score ??
                    entity.severity
                );


            const confidence =
                number(
                    entity.confidence ??
                    entity.trackingConfidence ??
                    entity.matchConfidence ??
                    entity.score
                );


            const currentPoint = {
                lat:
                    pointCoordinate.lat,

                lon:
                    pointCoordinate.lon,

                timestamp:
                    pointTimestamp,

                intensity,

                confidence,

                source:
                    text(
                        entity.source
                    ) ||
                    "storm_tracking"
            };


            const track = {
                trackId,

                canonicalTrackId:
                    text(
                        entity
                            .canonicalTrackId
                    ) ||
                    trackId,

                cellId,

                city:
                    entity.city ??
                    entity.cityName ??
                    entity.targetCity ??
                    null,

                region:
                    entity.region ??
                    entity.regionName ??
                    null,

                source:
                    text(
                        entity.source
                    ) ||
                    "storm_tracking",

                confidence,

                intensity,

                speedKmh:
                    number(
                        entity.speedKmh ??
                        entity.speed ??
                        entity.motion
                            ?.speedKmh ??
                        entity.velocity
                            ?.speedKmh
                    ),

                bearing:
                    number(
                        entity.bearing ??
                        entity.direction ??
                        entity.motion
                            ?.bearing ??
                        entity.velocity
                            ?.bearing
                    ),

                currentPoint,

                /*
                 * Only one point is supplied
                 * to TrackStore during this cycle.
                 */
                points: [
                    currentPoint
                ],

                active:
                    entity.active !==
                    false,

                status:
                    entity.status ??
                    "ACTIVE",

                bridgedAt:
                    now()
            };


            /*
             * Optional compact metadata only.
             */
            if (
                this.config
                    .preserveRawEntity
            ) {
                track.rawSummary =
                    compactEntityMetadata(
                        entity
                    );
            }


            return track;
        }


        /*
        =====================================================
         Existing track
        =====================================================
        */

        existing(
            store,
            trackId
        ) {
            for (
                const method
                of [
                    "get",
                    "getTrack"
                ]
            ) {
                if (
                    typeof store?.[method] !==
                    "function"
                ) {
                    continue;
                }

                try {
                    return store[
                        method
                    ](
                        trackId
                    );
                } catch (_) {}
            }

            return null;
        }


        /*
        =====================================================
         Duplicate detection
        =====================================================
        */

        duplicate(
            existing,
            point
        ) {
            const points =
                Array.isArray(
                    existing?.points
                )
                    ? existing.points
                    : [];


            const last =
                points[
                    points.length - 1
                ] ??
                existing
                    ?.currentPoint ??
                null;


            if (!last) {
                return false;
            }


            const lastCoordinate =
                coordinate(last);


            if (!lastCoordinate) {
                return false;
            }


            const samePosition =
                Math.abs(
                    lastCoordinate.lat -
                    point.lat
                ) <
                this.config
                    .minimumCoordinateDelta &&

                Math.abs(
                    lastCoordinate.lon -
                    point.lon
                ) <
                this.config
                    .minimumCoordinateDelta;


            const lastTime =
                timestamp(
                    last.timestamp ??
                    last.updatedAt
                );


            return (
                samePosition &&
                lastTime ===
                    point.timestamp
            );
        }


        /*
        =====================================================
         Upsert
        =====================================================
        */

        upsert(
            store,
            track
        ) {
            const existing =
                this.existing(
                    store,
                    track.trackId
                );


            if (
                existing &&
                this.duplicate(
                    existing,
                    track.currentPoint
                )
            ) {
                this.statistics
                    .skipped += 1;

                return {
                    success:
                        true,

                    action:
                        "skipped",

                    trackId:
                        track.trackId
                };
            }


            /*
             * Preferred update path.
             */
            if (
                existing &&
                typeof store
                    ?.appendPoint ===
                    "function"
            ) {
                try {
                    const result =
                        store.appendPoint(
                            track.trackId,

                            track.currentPoint,

                            {
                                active:
                                    track.active,

                                status:
                                    track.status,

                                confidence:
                                    track.confidence,

                                intensity:
                                    track.intensity,

                                speedKmh:
                                    track.speedKmh,

                                bearing:
                                    track.bearing,

                                city:
                                    track.city,

                                region:
                                    track.region,

                                source:
                                    track.source
                            }
                        );


                    this.statistics
                        .updated += 1;


                    return {
                        success:
                            result !==
                            false,

                        action:
                            "updated",

                        trackId:
                            track.trackId,

                        method:
                            "appendPoint"
                    };

                } catch (error) {
                    this.captureError(
                        error,
                        "TRACKSTORE_METHOD_FAILED:appendPoint"
                    );
                }
            }


            const attempts =
                existing

                    ? [
                        [
                            "upsertTrack",
                            [track]
                        ],

                        [
                            "setTrack",
                            [
                                track.trackId,
                                track
                            ]
                        ],

                        [
                            "upsert",
                            [
                                track.trackId,
                                track
                            ]
                        ],

                        [
                            "set",
                            [
                                track.trackId,
                                track
                            ]
                        ]
                    ]

                    : [
                        [
                            "addTrack",
                            [track]
                        ],

                        [
                            "add",
                            [track]
                        ],

                        [
                            "upsertTrack",
                            [track]
                        ],

                        [
                            "upsert",
                            [
                                track.trackId,
                                track
                            ]
                        ],

                        [
                            "set",
                            [
                                track.trackId,
                                track
                            ]
                        ]
                    ];


            for (
                const [
                    method,
                    args
                ] of attempts
            ) {
                if (
                    typeof store?.[method] !==
                    "function"
                ) {
                    continue;
                }


                try {
                    const result =
                        store[
                            method
                        ](
                            ...args
                        );


                    const action =
                        existing
                            ? "updated"
                            : "inserted";


                    this.statistics[
                        action
                    ] += 1;


                    return {
                        success:
                            result !== false,

                        action,

                        trackId:
                            track.trackId,

                        method
                    };

                } catch (error) {
                    this.captureError(
                        error,
                        `TRACKSTORE_METHOD_FAILED:${method}`
                    );
                }
            }


            return {
                success:
                    false,

                action:
                    "failed",

                reason:
                    "NO_COMPATIBLE_TRACKSTORE_WRITE_METHOD",

                trackId:
                    track.trackId
            };
        }


        /*
        =====================================================
         Count
        =====================================================
        */

        count(store) {
            if (
                typeof store?.size ===
                "number"
            ) {
                return store.size;
            }


            /*
             * Never use getAll() here.
             */
            if (
                typeof store?.count ===
                "function"
            ) {
                try {
                    return store.count();
                } catch (_) {}
            }

            return null;
        }


        /*
        =====================================================
         Synchronization
        =====================================================
        */

        async syncInternal() {
            this.statistics
                .syncRuns += 1;


            const startedAt =
                now();


            this.lastSyncStartedAt =
                startedAt;


            const store =
                this.getTrackStore();


            if (!store) {
                return this.fail(
                    "TRACK_STORE_UNAVAILABLE",
                    startedAt
                );
            }


            /*
             * ----------------------------------------------
             * Phase 1:
             * V32-first bounded discovery.
             * ----------------------------------------------
             */

            const entities =
                this.discover();


            /*
             * Preserve the real discovery number
             * BEFORE we null array elements later.
             */
            const discoveredThisRun =
                entities.length;


            this.statistics
                .discovered +=
                discoveredThisRun;


            /*
             * ----------------------------------------------
             * Phase 2:
             * normalize bounded entities.
             * ----------------------------------------------
             */

            const normalized =
                [];


            for (
                let index = 0;
                index <
                    discoveredThisRun;
                index++
            ) {
                const track =
                    this.normalizeEntity(
                        entities[
                            index
                        ],
                        index
                    );


                if (track) {
                    normalized.push(
                        track
                    );
                }
            }


            const normalizedThisRun =
                normalized.length;


            this.statistics
                .normalized +=
                normalizedThisRun;


            /*
             * ----------------------------------------------
             * Phase 3:
             * write one-by-one.
             * ----------------------------------------------
             */

            let successfulWrites =
                0;

            let failedWrites =
                0;


            const writeSamples =
                [];


            for (
                let index = 0;
                index <
                    normalizedThisRun;
                index++
            ) {
                const track =
                    normalized[
                        index
                    ];


                const writeResult =
                    this.upsert(
                        store,
                        track
                    );


                if (
                    writeResult
                        ?.success
                ) {
                    successfulWrites +=
                        1;
                } else {
                    failedWrites +=
                        1;
                }


                if (
                    writeSamples.length <
                    this.config
                        .maximumWriteResultsStored
                ) {
                    writeSamples.push(
                        writeResult
                    );
                }


                /*
                 * Release large references quickly.
                 */
                normalized[
                    index
                ] =
                    null;


                if (
                    index <
                    entities.length
                ) {
                    entities[
                        index
                    ] =
                        null;
                }
            }


            const completedAt =
                now();


            this.lastSyncCompletedAt =
                completedAt;


            /*
             * IMPORTANT:
             *
             * Use discoveredThisRun,
             * not entities.length after processing.
             */
            const result = {
                success:
                    discoveredThisRun ===
                    0

                        ? true

                        : successfulWrites >
                            0,


                status:
                    discoveredThisRun ===
                    0

                        ? "NO_LIVE_STORM_ENTITIES"

                        : "TRACKSTORE_SYNC_COMPLETED",


                version:
                    this.version,

                build:
                    this.build,


                discovered:
                    discoveredThisRun,


                normalized:
                    normalizedThisRun,


                normalizedTotal:
                    this.statistics
                        .normalized,


                successfulWrites,

                failedWrites,


                trackCount:
                    this.count(
                        store
                    ),


                writeSamples,


                writeSampleTruncated:
                    (
                        successfulWrites +
                        failedWrites
                    ) >
                    writeSamples.length,


                source:
                    this.lastSourceName,


                sourceIndex:
                    this.lastSourceIndex,


                startedAt,

                completedAt,


                durationMs:
                    completedAt -
                    startedAt
            };


            this.lastResult =
                clone(result);


            this.publish(
                result
            );


            if (
                this.config.debug
            ) {
                console.log(
                    "[RainArrival StormTrackStoreBridge] Sync result:",
                    result
                );
            }


            return result;
        }


        async sync() {
            if (
                this.config
                    .preventConcurrentSync &&

                this
                    .syncInProgress
            ) {
                this.statistics
                    .concurrentSyncSkips +=
                    1;


                return {
                    success:
                        true,

                    status:
                        "SYNC_ALREADY_RUNNING",

                    skipped:
                        true,

                    version:
                        this.version,

                    build:
                        this.build,

                    startedAt:
                        this.lastSyncStartedAt,

                    timestamp:
                        now()
                };
            }


            this.syncInProgress =
                true;


            try {
                this.activeSyncPromise =
                    this.syncInternal();


                return await this
                    .activeSyncPromise;

            } catch (error) {
                this.captureError(
                    error,
                    "SYNC_UNHANDLED_EXCEPTION"
                );


                return this.fail(
                    "SYNC_UNHANDLED_EXCEPTION",

                    this.lastSyncStartedAt ??
                    now()
                );

            } finally {
                this.activeSyncPromise =
                    null;

                this.syncInProgress =
                    false;
            }
        }


        /*
        =====================================================
         Failure
        =====================================================
        */

        fail(
            reason,
            startedAt
        ) {
            this.statistics
                .failures += 1;


            const completedAt =
                now();


            const result = {
                success:
                    false,

                status:
                    "TRACKSTORE_SYNC_FAILED",

                reason,

                version:
                    this.version,

                build:
                    this.build,

                startedAt,

                completedAt,

                durationMs:
                    completedAt -
                    startedAt
            };


            this.lastResult =
                clone(result);


            this.publish(
                result
            );


            return result;
        }


        /*
        =====================================================
         Error capture
        =====================================================
        */

        captureError(
            error,
            code
        ) {
            this.lastError = {
                code,

                name:
                    error?.name ??
                    "Error",

                message:
                    error?.message ??
                    String(error),

                stack:
                    typeof error?.stack ===
                    "string"

                        ? error.stack.slice(
                            0,
                            3000
                        )

                        : null,

                timestamp:
                    now()
            };


            this.statistics
                .failures += 1;


            return this.lastError;
        }


        /*
        =====================================================
         Publish
        =====================================================
        */

        publish(result) {
            global.RainGuardAI =
                global.RainGuardAI ||
                {};


            global.RainGuardAI.V32 =
                global.RainGuardAI.V32 ||
                {};


            global
                .RainGuardAI
                .V32
                .rainArrivalBridgeState =
            {
                version:
                    this.version,

                build:
                    this.build,

                running:
                    this.running,

                syncInProgress:
                    this.syncInProgress,

                lastResult:
                    clone(result),

                statistics: {
                    ...this.statistics
                },

                updatedAt:
                    now()
            };
        }


        /*
        =====================================================
         Lifecycle
        =====================================================
        */

        start() {
            if (
                this.running
            ) {
                return {
                    success:
                        true,

                    alreadyRunning:
                        true
                };
            }


            this.running =
                true;


            /*
             * First async-safe sync.
             */
            Promise
                .resolve()
                .then(
                    () =>
                        this.sync()
                )
                .catch(
                    error => {
                        this.captureError(
                            error,
                            "AUTOSTART_SYNC_FAILED"
                        );
                    }
                );


            this.timer =
                global.setInterval(
                    () => {

                        /*
                         * Prevent overlap.
                         */
                        if (
                            this
                                .syncInProgress
                        ) {
                            this.statistics
                                .concurrentSyncSkips +=
                                1;

                            return;
                        }


                        Promise
                            .resolve()
                            .then(
                                () =>
                                    this.sync()
                            )
                            .catch(
                                error => {
                                    this.captureError(
                                        error,
                                        "INTERVAL_SYNC_FAILED"
                                    );
                                }
                            );

                    },

                    this.config
                        .syncIntervalMs
                );


            return {
                success:
                    true,

                running:
                    true,

                intervalMs:
                    this.config
                        .syncIntervalMs
            };
        }


        stop() {
            if (
                this.timer
            ) {
                global.clearInterval(
                    this.timer
                );
            }


            this.timer =
                null;


            this.running =
                false;


            return {
                success:
                    true,

                running:
                    false,

                syncInProgress:
                    this.syncInProgress
            };
        }


        /*
        =====================================================
         Memory release
        =====================================================
        */

        releaseMemory() {
            this.lastResult =
                null;

            this.lastError =
                null;

            this.lastSourceName =
                null;

            this.lastSourceIndex =
                null;


            return {
                success:
                    true,

                released:
                    true,

                timestamp:
                    now()
            };
        }


        /*
        =====================================================
         Diagnostics
        =====================================================
        */

        getDiagnostics() {
            const store =
                this.getTrackStore();


            return {
                module:
                    "stormTrackStoreBridge",

                version:
                    this.version,

                build:
                    this.build,

                installed:
                    true,

                running:
                    this.running,

                syncInProgress:
                    this.syncInProgress,

                activeSyncPromise:
                    Boolean(
                        this
                            .activeSyncPromise
                    ),

                trackStoreAvailable:
                    Boolean(store),

                sourceAvailable:
                    Boolean(
                        this
                            .lastSourceName
                    ),

                sourceName:
                    this
                        .lastSourceName,

                sourceIndex:
                    this
                        .lastSourceIndex,

                trackCount:
                    this.count(
                        store
                    ),

                lastSyncStartedAt:
                    this
                        .lastSyncStartedAt,

                lastSyncCompletedAt:
                    this
                        .lastSyncCompletedAt,

                lastResult:
                    clone(
                        this
                            .lastResult
                    ),

                lastError:
                    clone(
                        this
                            .lastError
                    ),

                statistics: {
                    ...this.statistics
                },

                memorySafety: {
                    maximumEntitiesPerSync:
                        this.config
                            .maximumEntitiesPerSync,

                    maximumWriteResultsStored:
                        this.config
                            .maximumWriteResultsStored,

                    preserveRawEntity:
                        this.config
                            .preserveRawEntity,

                    preventConcurrentSync:
                        this.config
                            .preventConcurrentSync,

                    syncIntervalMs:
                        this.config
                            .syncIntervalMs
                },

                sourcePriority: [
                    "V32 StormEntityCollector",
                    "V32 LiveStormExportBridge",
                    "V31 fallback"
                ]
            };
        }


        diagnose() {
            const diagnostics =
                this.getDiagnostics();


            console.log(
                "[RainArrival StormTrackStoreBridge]",
                diagnostics
            );


            return diagnostics;
        }
    }


    /*
    =========================================================
     Replace old instance safely
    =========================================================
    */

    try {
        global
            .RainArrivalStormTrackStoreBridgeV32
            ?.stop?.();
    } catch (_) {}


    const bridge =
        new StormTrackStoreBridge();


    global
        .RainArrivalStormTrackStoreBridgeV32 =
        bridge;


    global.RainGuardAI =
        global.RainGuardAI ||
        {};


    global.RainGuardAI.V32 =
        global.RainGuardAI.V32 ||
        {};


    global
        .RainGuardAI
        .V32
        .rainArrivalModules =
        global
            .RainGuardAI
            .V32
            .rainArrivalModules ||
        {};


    global
        .RainGuardAI
        .V32
        .rainArrivalModules
        .stormTrackStoreBridge =
        bridge;


    /*
    =========================================================
     Registration
    =========================================================
    */

    global
        .RainArrivalEngineV32
        ?.register?.(
            "stormTrackStoreBridge",
            bridge
        );


    global
        .RainArrivalOrchestratorV32
        ?.register?.(
            "stormTrackStoreBridge",
            bridge
        );


    /*
    =========================================================
     Global APIs
    =========================================================
    */

    global
        .runRainArrivalStormTrackStoreSync =
        () =>
            bridge.sync();


    global
        .stopRainArrivalStormTrackStoreBridge =
        () =>
            bridge.stop();


    global
        .startRainArrivalStormTrackStoreBridge =
        () =>
            bridge.start();


    global
        .diagnoseRainArrivalStormTrackStoreBridge =
        () =>
            bridge.diagnose();


    global
        .releaseRainArrivalStormTrackStoreBridgeMemory =
        () =>
            bridge.releaseMemory();


    /*
    =========================================================
     Auto start
    =========================================================
    */

    if (
        bridge.config.autoStart
    ) {
        bridge.start();
    }


    console.log(
        "[RainGuard AI V32] Storm Tracking -> TrackStore Bridge MEMSAFE-2 loaded.",
        {
            version:
                VERSION,

            build:
                BUILD,

            syncIntervalMs:
                bridge.config
                    .syncIntervalMs,

            maximumEntitiesPerSync:
                bridge.config
                    .maximumEntitiesPerSync,

            preventConcurrentSync:
                bridge.config
                    .preventConcurrentSync,

            preserveRawEntity:
                bridge.config
                    .preserveRawEntity,

            sourcePriority: [
                "StormEntityCollectorV32",
                "LiveStormExportBridgeV32",
                "V31 fallback"
            ]
        }
    );

})(
    typeof globalThis !== "undefined"
        ? globalThis
        : window
);
