/*
===========================================================
 RainGuard AI V32
 Phase 38M-12B-1
 Storm Tracking -> Modular TrackStore Live Bridge

 MEMORY SAFE REVISION
 Phase 39A Memory Pressure Guard
===========================================================
*/

(function (global) {
    "use strict";

    const VERSION = "32.38M.12B1-MEMSAFE-1";
    const BUILD =
        "rainguard-v32-phase38m-storm-trackstore-live-bridge-memory-safe";

    const CONFIG = Object.freeze({
        autoStart: true,

        // كان 5000ms
        // نرفعها قليلًا لتقليل الضغط المستمر.
        syncIntervalMs: 10000,

        // كان 500 كيان في كل دورة.
        maximumEntitiesPerSync: 100,

        // أقصى عدد نتائج كتابة نحتفظ بها داخل lastResult.
        maximumWriteResultsStored: 25,

        // أقصى عدد نقاط نحافظ عليها عند الحاجة.
        maximumPointsPerTrack: 60,

        maximumPointAgeMs: 6 * 60 * 60 * 1000,
        minimumCoordinateDelta: 0.00001,

        // منع تداخل sync.
        preventConcurrentSync: true,

        // عدم الاحتفاظ بالكيان الخام الكبير.
        preserveRawEntity: false,

        // عدم عمل structuredClone لأجسام كبيرة بدون داعٍ.
        lightweightSnapshots: true,

        debug: true
    });

    const now = () => Date.now();

    function isObject(value) {
        return (
            value !== null &&
            typeof value === "object" &&
            !Array.isArray(value)
        );
    }

    /*
     * Clone آمن ومحدود.
     *
     * لا نريد structuredClone لكائنات ضخمة أو دورية،
     * لذلك نستخدمه فقط للبيانات الصغيرة التي نملكها نحن.
     */
    function clone(value) {
        if (value === null || value === undefined) {
            return value;
        }

        try {
            return typeof structuredClone === "function"
                ? structuredClone(value)
                : JSON.parse(JSON.stringify(value));
        } catch (_) {
            return null;
        }
    }

    function number(value, fallback = null) {
        const n = Number(value);
        return Number.isFinite(n) ? n : fallback;
    }

    function text(value) {
        return value === null || value === undefined
            ? ""
            : String(value).trim();
    }

    function timestamp(value) {
        if (value === null || value === undefined) {
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

        const parsed = Date.parse(value);

        return Number.isFinite(parsed)
            ? parsed
            : now();
    }

    function coordinate(value) {
        if (!value) {
            return null;
        }

        if (
            Array.isArray(value) &&
            value.length >= 2
        ) {
            const first = number(value[0]);
            const second = number(value[1]);

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

        const lat = number(
            value.lat ??
            value.latitude ??
            value.y ??
            value.center?.lat ??
            value.centroid?.lat ??
            value.coordinate?.lat
        );

        const lon = number(
            value.lon ??
            value.lng ??
            value.longitude ??
            value.x ??
            value.center?.lon ??
            value.center?.lng ??
            value.centroid?.lon ??
            value.centroid?.lng ??
            value.coordinate?.lon ??
            value.coordinate?.lng
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
            return Array.from(value.values());
        }

        if (
            typeof value.values === "function"
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
     * لا نحتفظ بالـraw entity.
     *
     * نأخذ فقط حقولًا صغيرة ومفيدة للتشخيص.
     */
    function compactEntityMetadata(entity) {
        if (!entity || typeof entity !== "object") {
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
                text(entity.source) ||
                null,

            city:
                text(
                    entity.city ??
                    entity.cityName ??
                    entity.targetCity
                ) || null,

            status:
                text(entity.status) ||
                null
        };
    }

    function trimPoints(points, maximum) {
        if (!Array.isArray(points)) {
            return [];
        }

        if (points.length <= maximum) {
            return points;
        }

        return points.slice(
            points.length - maximum
        );
    }

    class StormTrackStoreBridge {
        constructor(config = {}) {
            this.version = VERSION;
            this.build = BUILD;

            this.config = {
                ...CONFIG,
                ...(isObject(config) ? config : {})
            };

            this.running = false;
            this.timer = null;

            /*
             * Memory / concurrency guards
             */
            this.syncInProgress = false;
            this.activeSyncPromise = null;
            this.lastSyncStartedAt = null;
            this.lastSyncCompletedAt = null;

            /*
             * لا نخزن source object نفسه،
             * لأنه قد يمسك Graph ضخم في الذاكرة.
             */
            this.lastSourceName = null;

            this.lastResult = null;
            this.lastError = null;

            this.statistics = {
                syncRuns: 0,
                concurrentSyncSkips: 0,
                discovered: 0,
                normalized: 0,
                inserted: 0,
                updated: 0,
                skipped: 0,
                failures: 0,
                memoryGuardDrops: 0
            };
        }

        getTrackStore() {
            return (
                global.RainArrivalTrackStoreV32 ||
                global.RainGuardAI?.V32
                    ?.rainArrivalModules
                    ?.trackStore ||
                global.RainArrivalEngineV32
                    ?.get?.("trackStore") ||
                null
            );
        }

        getSources() {
            return [
                global.StormCellTrackingEngineV31,
                global.StormTrackingEngineV31,
                global.RainGuardStormTrackingV31,
                global.RainGuardAI?.V31
                    ?.stormCellTracking,
                global.RainGuardAI?.V31
                    ?.stormTracking,
                global.RainGuardAI
                    ?.stormCellTracking,
                global.RainGuardAI
                    ?.stormTracking
            ].filter(Boolean);
        }

        extractEntities(value) {
            if (!value) {
                return [];
            }

            /*
             * IMPORTANT:
             * لا ننسخ المصدر.
             * نأخذ references محدودة فقط
             * ونقصها لاحقًا.
             */
            const direct = toArray(value);

            if (
                direct.length &&
                direct.some(isObject)
            ) {
                return direct;
            }

            for (const key of [
                "activeCells",
                "cells",
                "stormCells",
                "trackedCells",
                "activeTracks",
                "tracks",
                "stormTracks",
                "candidates",
                "entities",
                "items",
                "data",
                "result"
            ]) {
                const items =
                    toArray(value?.[key]);

                if (items.length) {
                    return items;
                }
            }

            return [];
        }

        readSource(source) {
            for (const method of [
                "getActiveCells",
                "getCells",
                "getActiveTracks",
                "getTracks",
                "getTrackedCells",
                "getCurrentCells",
                "getSnapshot",
                "getState"
            ]) {
                if (
                    typeof source?.[method] ===
                    "function"
                ) {
                    try {
                        const output =
                            source[method]();

                        /*
                         * لا ندعم async source هنا
                         * حتى لا تتداخل الدورات.
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

                        if (entities.length) {
                            return entities;
                        }
                    } catch (error) {
                        this.captureError(
                            error,
                            `SOURCE_METHOD_FAILED:${method}`
                        );
                    }
                }
            }

            return this.extractEntities(source);
        }

        discover() {
            const sources =
                this.getSources();

            for (
                let sourceIndex = 0;
                sourceIndex < sources.length;
                sourceIndex++
            ) {
                const source =
                    sources[sourceIndex];

                const entities =
                    this.readSource(source);

                if (entities.length) {
                    this.lastSourceName =
                        source?.constructor?.name ||
                        source?.name ||
                        `source-${sourceIndex}`;

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

                    return entities.slice(
                        0,
                        maximum
                    );
                }
            }

            this.lastSourceName = null;

            return [];
        }

        normalizeEntity(entity, index) {
            if (
                !entity ||
                typeof entity !== "object"
            ) {
                return null;
            }

            const pointCoordinate =
                coordinate(
                    entity.currentCoordinate ??
                    entity.coordinate ??
                    entity.center ??
                    entity.centroid ??
                    entity.location ??
                    entity.position ??
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
                now() - pointTimestamp >
                this.config.maximumPointAgeMs
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
                    `${Math.round(pointCoordinate.lat * 10000)}-` +
                    `${Math.round(pointCoordinate.lon * 10000)}-` +
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
                    text(entity.source) ||
                    "storm_cell_tracking_v31"
            };

            const track = {
                trackId,

                canonicalTrackId:
                    text(
                        entity.canonicalTrackId
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
                    text(entity.source) ||
                    "storm_cell_tracking_v31",

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
                 * دائمًا نقطة واحدة فقط في الكائن القادم.
                 * TrackStore هو المسؤول عن التاريخ.
                 */
                points: [
                    currentPoint
                ],

                active:
                    entity.active !== false,

                status:
                    entity.status ??
                    "ACTIVE",

                bridgedAt:
                    now()
            };

            /*
             * إصلاح مهم:
             * لا نعمل clone(entity).
             */
            if (
                this.config.preserveRawEntity
            ) {
                track.rawSummary =
                    compactEntityMetadata(
                        entity
                    );
            }

            return track;
        }

        existing(store, trackId) {
            for (const method of [
                "get",
                "getTrack"
            ]) {
                if (
                    typeof store?.[method] !==
                    "function"
                ) {
                    continue;
                }

                try {
                    return store[method](
                        trackId
                    );
                } catch (_) {}
            }

            return null;
        }

        duplicate(existing, point) {
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
                existing?.currentPoint ??
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
                lastTime === point.timestamp
            );
        }

        /*
         * نحاول appendPoint أولًا عند وجود Track.
         *
         * هذا يقلل احتمال استبدال كائن Track ضخم
         * في كل دورة.
         */
        upsert(store, track) {
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
                this.statistics.skipped += 1;

                return {
                    success: true,
                    action: "skipped",
                    trackId: track.trackId
                };
            }

            /*
             * إذا كان موجودًا ولدينا appendPoint،
             * نستخدمه أولًا.
             */
            if (
                existing &&
                typeof store?.appendPoint ===
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

                    this.statistics.updated += 1;

                    return {
                        success:
                            result !== false,

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

            /*
             * لا نجرب كل الطرق بلا حدود.
             * نتوقف عند أول طريقة صالحة سواء نجحت
             * أو رمت exception ثم ننتقل للتالية.
             */
            const attempts = existing
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
                        store[method](
                            ...args
                        );

                    const action =
                        existing
                            ? "updated"
                            : "inserted";

                    this.statistics[action] += 1;

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
                success: false,
                action: "failed",
                reason:
                    "NO_COMPATIBLE_TRACKSTORE_WRITE_METHOD",
                trackId:
                    track.trackId
            };
        }

        count(store) {
            if (
                typeof store?.size ===
                "number"
            ) {
                return store.size;
            }

            /*
             * نتجنب getAll() هنا لأنه قد ينسخ
             * TrackStore كاملًا إلى الذاكرة.
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

        async syncInternal() {
            this.statistics.syncRuns += 1;

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
             * المرحلة 1:
             * discover bounded.
             */
            const entities =
                this.discover();

            this.statistics.discovered +=
                entities.length;

            /*
             * المرحلة 2:
             * normalize one-by-one.
             *
             * لا map ضخمة ولا clones.
             */
            const normalized = [];

            for (
                let index = 0;
                index < entities.length;
                index++
            ) {
                const track =
                    this.normalizeEntity(
                        entities[index],
                        index
                    );

                if (track) {
                    normalized.push(track);
                }
            }

            this.statistics.normalized +=
                normalized.length;

            /*
             * المرحلة 3:
             * write one-by-one.
             *
             * لا نحتفظ بكل writes.
             */
            let successfulWrites = 0;
            let failedWrites = 0;

            const writeSamples = [];

            for (
                let index = 0;
                index < normalized.length;
                index++
            ) {
                const track =
                    normalized[index];

                const writeResult =
                    this.upsert(
                        store,
                        track
                    );

                if (
                    writeResult?.success
                ) {
                    successfulWrites += 1;
                } else {
                    failedWrites += 1;
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
                 * نكسر reference بسرعة.
                 */
                normalized[index] = null;
                entities[index] = null;
            }

            const completedAt =
                now();

            this.lastSyncCompletedAt =
                completedAt;

            /*
             * Result صغير فقط.
             */
            const result = {
                success:
                    entities.length === 0
                        ? true
                        : successfulWrites > 0,

                status:
                    entities.length === 0
                        ? "NO_LIVE_STORM_ENTITIES"
                        : "TRACKSTORE_SYNC_COMPLETED",

                version:
                    this.version,

                build:
                    this.build,

                discovered:
                    entities.length,

                normalized:
                    this.statistics.normalized,

                normalizedThisRun:
                    successfulWrites +
                    failedWrites,

                successfulWrites,

                failedWrites,

                trackCount:
                    this.count(store),

                /*
                 * عينة فقط بدل مصفوفة writes كاملة.
                 */
                writeSamples,

                writeSampleTruncated:
                    successfulWrites +
                        failedWrites >
                    writeSamples.length,

                source:
                    this.lastSourceName,

                startedAt,

                completedAt,

                durationMs:
                    completedAt -
                    startedAt
            };

            /*
             * lastResult صغير، فلا حاجة لنسخ Graph ضخم.
             */
            this.lastResult =
                clone(result);

            this.publish(result);

            if (this.config.debug) {
                console.log(
                    "[RainArrival StormTrackStoreBridge] Sync result:",
                    result
                );
            }

            return result;
        }

        async sync() {
            /*
             * أهم Memory Guard:
             * لا نسمح بدورتين متزامنتين.
             */
            if (
                this.config
                    .preventConcurrentSync &&
                this.syncInProgress
            ) {
                this.statistics
                    .concurrentSyncSkips += 1;

                return {
                    success: true,
                    status:
                        "SYNC_ALREADY_RUNNING",
                    skipped: true,
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

            this.syncInProgress = true;

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

        fail(reason, startedAt) {
            this.statistics.failures += 1;

            const completedAt =
                now();

            const result = {
                success: false,

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

            this.publish(result);

            return result;
        }

        captureError(error, code) {
            this.lastError = {
                code,

                name:
                    error?.name ??
                    "Error",

                message:
                    error?.message ??
                    String(error),

                /*
                 * لا نحتفظ بستاك ضخم جدًا.
                 */
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

            this.statistics.failures += 1;

            return this.lastError;
        }

        publish(result) {
            global.RainGuardAI =
                global.RainGuardAI || {};

            global.RainGuardAI.V32 =
                global.RainGuardAI.V32 || {};

            /*
             * لا نخزن source objects ولا writes الكاملة.
             */
            global.RainGuardAI.V32
                .rainArrivalBridgeState = {

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

                statistics:
                    {
                        ...this.statistics
                    },

                updatedAt:
                    now()
            };
        }

        start() {
            if (this.running) {
                return {
                    success: true,
                    alreadyRunning: true
                };
            }

            this.running = true;

            /*
             * لا ننتظر أول sync.
             */
            Promise.resolve()
                .then(() => this.sync())
                .catch(error => {
                    this.captureError(
                        error,
                        "AUTOSTART_SYNC_FAILED"
                    );
                });

            this.timer =
                global.setInterval(
                    () => {
                        /*
                         * لا ندخل sync جديد إذا القديم
                         * لم ينتهِ.
                         */
                        if (
                            this.syncInProgress
                        ) {
                            this.statistics
                                .concurrentSyncSkips +=
                                1;

                            return;
                        }

                        this.sync().catch(
                            error => {
                                this.captureError(
                                    error,
                                    "INTERVAL_SYNC_FAILED"
                                );
                            }
                        );
                    },
                    this.config.syncIntervalMs
                );

            return {
                success: true,
                running: true,
                intervalMs:
                    this.config
                        .syncIntervalMs
            };
        }

        stop() {
            if (this.timer) {
                global.clearInterval(
                    this.timer
                );
            }

            this.timer = null;
            this.running = false;

            return {
                success: true,
                running: false,
                syncInProgress:
                    this.syncInProgress
            };
        }

        /*
         * Memory-safe reset.
         * لا يحذف TrackStore.
         * فقط يزيل References الخاصة بالجسر.
         */
        releaseMemory() {
            this.lastResult = null;
            this.lastError = null;
            this.lastSourceName = null;

            return {
                success: true,
                released: true,
                timestamp: now()
            };
        }

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
                        this.activeSyncPromise
                    ),

                trackStoreAvailable:
                    Boolean(store),

                sourceAvailable:
                    Boolean(
                        this.lastSourceName
                    ),

                sourceName:
                    this.lastSourceName,

                trackCount:
                    this.count(store),

                lastSyncStartedAt:
                    this.lastSyncStartedAt,

                lastSyncCompletedAt:
                    this.lastSyncCompletedAt,

                lastResult:
                    clone(
                        this.lastResult
                    ),

                lastError:
                    clone(
                        this.lastError
                    ),

                statistics:
                    {
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
                }
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
     * إذا كان إصدار قديم يعمل بالفعل،
     * نحاول إيقاف timer القديم قبل استبداله.
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
        global.RainGuardAI || {};

    global.RainGuardAI.V32 =
        global.RainGuardAI.V32 || {};

    global.RainGuardAI.V32
        .rainArrivalModules =
        global.RainGuardAI.V32
            .rainArrivalModules ||
        {};

    global.RainGuardAI.V32
        .rainArrivalModules
        .stormTrackStoreBridge =
        bridge;

    global.RainArrivalEngineV32
        ?.register?.(
            "stormTrackStoreBridge",
            bridge
        );

    global.RainArrivalOrchestratorV32
        ?.register?.(
            "stormTrackStoreBridge",
            bridge
        );

    global.runRainArrivalStormTrackStoreSync =
        () => bridge.sync();

    global.stopRainArrivalStormTrackStoreBridge =
        () => bridge.stop();

    global.startRainArrivalStormTrackStoreBridge =
        () => bridge.start();

    global.diagnoseRainArrivalStormTrackStoreBridge =
        () => bridge.diagnose();

    global.releaseRainArrivalStormTrackStoreBridgeMemory =
        () => bridge.releaseMemory();

    if (bridge.config.autoStart) {
        bridge.start();
    }

    console.log(
        "[RainGuard AI V32] Storm Tracking -> TrackStore Bridge MEMORY SAFE loaded.",
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
                    .preserveRawEntity
        }
    );

})(
    typeof globalThis !== "undefined"
        ? globalThis
        : window
);
