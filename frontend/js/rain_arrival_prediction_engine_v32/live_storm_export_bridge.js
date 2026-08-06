/*
===========================================================
 RainGuard AI V32
 Phase 38M-14
 Live Storm Export Bridge

 Responsibilities:
 - Discover live V31 storm cells and predicted paths
 - Export normalized entities to a stable global channel
 - Preserve cell/track identity
 - Feed Phase 38M-13 Storm Entity Collector
 - Expose diagnostics and manual refresh commands
===========================================================
*/

(function (global) {
    "use strict";

    const MODULE_NAME =
        "liveStormExportBridge";

    const VERSION =
        "32.38M.14";

    const BUILD =
        "rainguard-v32-phase38m-live-storm-export-bridge";

    const DEFAULT_CONFIG =
        Object.freeze({
            autoStart:
                true,

            refreshIntervalMs:
                3000,

            maximumEntities:
                1000,

            maximumEntityAgeMs:
                8 * 60 * 60 * 1000,

            includePaths:
                true,

            debug:
                true
        });

    function now() {
        return Date.now();
    }

    function isObject(value) {
        return (
            value !== null &&
            typeof value === "object" &&
            !Array.isArray(value)
        );
    }

    function cloneValue(value) {
        if (
            value === null ||
            value === undefined
        ) {
            return value;
        }

        if (
            typeof structuredClone ===
            "function"
        ) {
            try {
                return structuredClone(value);
            } catch (error) {
                // Continue with JSON fallback.
            }
        }

        try {
            return JSON.parse(
                JSON.stringify(value)
            );
        } catch (error) {
            return value;
        }
    }

    function toFiniteNumber(
        value,
        fallback = null
    ) {
        const number =
            Number(value);

        return Number.isFinite(number)
            ? number
            : fallback;
    }

    function normalizeText(value) {
        if (
            value === null ||
            value === undefined
        ) {
            return "";
        }

        return String(value).trim();
    }

    function normalizeTimestamp(value) {
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

    function normalizeCoordinate(value) {
        if (!value) {
            return null;
        }

        if (
            Array.isArray(value) &&
            value.length >= 2
        ) {
            const first =
                toFiniteNumber(
                    value[0],
                    null
                );

            const second =
                toFiniteNumber(
                    value[1],
                    null
                );

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
                    lat:
                        second,

                    lon:
                        first
                }
                : {
                    lat:
                        first,

                    lon:
                        second
                };
        }

        const lat =
            toFiniteNumber(
                value.lat ??
                value.latitude ??
                value.y ??
                value.center?.lat ??
                value.center?.latitude ??
                value.centroid?.lat ??
                value.centroid?.latitude ??
                value.coordinate?.lat ??
                value.coordinate?.latitude,
                null
            );

        const lon =
            toFiniteNumber(
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
                value.coordinate?.longitude,
                null
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

    function collectionToArray(value) {
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
            } catch (error) {
                // Continue.
            }
        }

        if (isObject(value)) {
            return Object.values(value);
        }

        return [];
    }

    function uniqueObjects(items) {
        const seen =
            new Set();

        const result =
            [];

        items.forEach(
            item => {
                if (
                    !item ||
                    (
                        typeof item !==
                        "object" &&
                        typeof item !==
                        "function"
                    )
                ) {
                    return;
                }

                if (
                    seen.has(item)
                ) {
                    return;
                }

                seen.add(item);
                result.push(item);
            }
        );

        return result;
    }

    class LiveStormExportBridge {

        constructor(config = {}) {
            this.version =
                VERSION;

            this.build =
                BUILD;

            this.config = {
                ...DEFAULT_CONFIG,

                ...(isObject(config)
                    ? config
                    : {})
            };

            this.running =
                false;

            this.timer =
                null;

            this.lastResult =
                null;

            this.lastError =
                null;

            this.lastSources =
                [];

            this.statistics = {
                refreshes:
                    0,

                sourcesInspected:
                    0,

                rawEntities:
                    0,

                exportedEntities:
                    0,

                duplicates:
                    0,

                rejected:
                    0,

                failures:
                    0
            };

            this.createdAt =
                now();

            this.updatedAt =
                this.createdAt;
        }

        getSources() {
            const candidates = [
                global.StormCellTrackingEngineV31,
                global.StormTrackingEngineV31,
                global.StormVisualizationEngineV31,
                global.StormPathPredictionEngineV31,
                global.RainGuardStormTrackingV31,
                global.RainGuardStormVisualizationV31,
                global.RainGuardAI
                    ?.V31
                    ?.stormCellTracking,
                global.RainGuardAI
                    ?.V31
                    ?.stormTracking,
                global.RainGuardAI
                    ?.V31
                    ?.stormVisualization,
                global.RainGuardAI
                    ?.V31
                    ?.stormPathPrediction,
                global.RainGuardAI
                    ?.V31,
                global.RainGuardAI
                    ?.stormCellTracking,
                global.RainGuardAI
                    ?.stormTracking,
                global.RainGuardAI
                    ?.stormVisualization,
                global.RainGuardAI
            ];

            try {
                Object.keys(global)
                    .filter(
                        key =>
                            /storm|cell|track|path/i
                                .test(key)
                    )
                    .slice(
                        0,
                        300
                    )
                    .forEach(
                        key => {
                            try {
                                candidates.push(
                                    global[key]
                                );
                            } catch (error) {
                                // Ignore inaccessible globals.
                            }
                        }
                    );
            } catch (error) {
                // Ignore global enumeration failure.
            }

            return uniqueObjects(
                candidates
            );
        }

        readFromSource(source) {
            const collected =
                [];

            const methods = [
                "getActiveCells",
                "getCells",
                "getCurrentCells",
                "getTrackedCells",
                "getStormCells",
                "getActiveTracks",
                "getTracks",
                "getStormTracks",
                "getPredictedPaths",
                "getPaths",
                "getLatestResult",
                "getLatestSnapshot",
                "getSnapshot",
                "getState"
            ];

            methods.forEach(
                methodName => {
                    if (
                        typeof source?.[
                            methodName
                        ] !== "function"
                    ) {
                        return;
                    }

                    try {
                        const result =
                            source[
                                methodName
                            ]();

                        collected.push(
                            ...this.extract(
                                result
                            )
                        );
                    } catch (error) {
                        // Some methods may need parameters.
                    }
                }
            );

            const properties = [
                "activeCells",
                "cells",
                "stormCells",
                "trackedCells",
                "activeTracks",
                "tracks",
                "stormTracks",
                "predictedPaths",
                "paths",
                "stormPaths",
                "candidates",
                "detectedCandidates",
                "latestCells",
                "latestTracks",
                "latestPaths",
                "lastCells",
                "lastTracks",
                "lastPaths",
                "lastResult",
                "latestResult",
                "state",
                "memory",
                "trackStore",
                "cellStore",
                "visualizationState"
            ];

            properties.forEach(
                propertyName => {
                    try {
                        collected.push(
                            ...this.extract(
                                source?.[
                                    propertyName
                                ]
                            )
                        );
                    } catch (error) {
                        // Ignore inaccessible property.
                    }
                }
            );

            return collected;
        }

        extract(value) {
            if (!value) {
                return [];
            }

            const direct =
                collectionToArray(
                    value
                );

            if (
                direct.length > 0 &&
                direct.some(
                    item =>
                        isObject(item)
                )
            ) {
                return direct;
            }

            const keys = [
                "activeCells",
                "cells",
                "stormCells",
                "trackedCells",
                "activeTracks",
                "tracks",
                "stormTracks",
                "predictedPaths",
                "paths",
                "stormPaths",
                "candidates",
                "entities",
                "items",
                "data",
                "result",
                "payload",
                "snapshot",
                "memory"
            ];

            const collected =
                [];

            keys.forEach(
                key => {
                    const nested =
                        collectionToArray(
                            value?.[key]
                        );

                    if (
                        nested.length > 0
                    ) {
                        collected.push(
                            ...nested
                        );
                    }
                }
            );

            return collected;
        }

        normalize(
            entity,
            sourceName,
            index
        ) {
            if (!entity) {
                return null;
            }

            const coordinate =
                normalizeCoordinate(
                    entity.currentCoordinate ??
                    entity.coordinate ??
                    entity.center ??
                    entity.centroid ??
                    entity.location ??
                    entity.position ??
                    entity.start ??
                    entity.end ??
                    entity
                );

            if (!coordinate) {
                return null;
            }

            const observedAt =
                normalizeTimestamp(
                    entity.timestamp ??
                    entity.updatedAt ??
                    entity.lastSeenAt ??
                    entity.observedAt ??
                    entity.createdAt ??
                    entity.time ??
                    entity.frameTimestamp
                );

            if (
                now() -
                observedAt >
                this.config
                    .maximumEntityAgeMs
            ) {
                return null;
            }

            const cellId =
                normalizeText(
                    entity.cellId ??
                    entity.id ??
                    entity.candidateId ??
                    entity.uuid
                );

            const trackId =
                normalizeText(
                    entity.trackId ??
                    entity.canonicalTrackId ??
                    entity.parentTrackId ??
                    cellId
                ) ||
                [
                    "EXPORTED",
                    Math.round(
                        coordinate.lat *
                        10000
                    ),
                    Math.round(
                        coordinate.lon *
                        10000
                    ),
                    index
                ].join("-");

            const point = {
                lat:
                    coordinate.lat,

                lon:
                    coordinate.lon,

                lng:
                    coordinate.lon,

                latitude:
                    coordinate.lat,

                longitude:
                    coordinate.lon,

                timestamp:
                    observedAt,

                intensity:
                    toFiniteNumber(
                        entity.intensity ??
                        entity.reflectivity ??
                        entity.dbz ??
                        entity.severity,
                        null
                    ),

                confidence:
                    toFiniteNumber(
                        entity.confidence ??
                        entity.trackingConfidence ??
                        entity.matchConfidence ??
                        entity.score,
                        0
                    ),

                source:
                    sourceName
            };

            return {
                id:
                    trackId,

                trackId,

                canonicalTrackId:
                    normalizeText(
                        entity
                            .canonicalTrackId
                    ) ||
                    trackId,

                cellId:
                    cellId ||
                    trackId,

                currentCoordinate:
                    point,

                coordinate:
                    point,

                center:
                    point,

                points:
                    Array.isArray(
                        entity.points
                    ) &&
                    entity.points
                        .length > 0
                        ? entity.points
                            .map(
                                item =>
                                    normalizeCoordinate(
                                        item
                                    )
                            )
                            .filter(Boolean)
                            .map(
                                (
                                    item,
                                    pointIndex
                                ) => ({
                                    lat:
                                        item.lat,

                                    lon:
                                        item.lon,

                                    lng:
                                        item.lon,

                                    latitude:
                                        item.lat,

                                    longitude:
                                        item.lon,

                                    timestamp:
                                        normalizeTimestamp(
                                            entity
                                                .points[
                                                pointIndex
                                            ]
                                                ?.timestamp ??
                                            observedAt
                                        )
                                })
                            )
                        : [point],

                timestamp:
                    observedAt,

                observedAt,

                updatedAt:
                    observedAt,

                confidence:
                    point.confidence,

                intensity:
                    point.intensity,

                speedKmh:
                    toFiniteNumber(
                        entity.speedKmh ??
                        entity.speed ??
                        entity.motion
                            ?.speedKmh ??
                        entity.velocity
                            ?.speedKmh,
                        null
                    ),

                bearing:
                    toFiniteNumber(
                        entity.bearing ??
                        entity.direction ??
                        entity.motion
                            ?.bearing ??
                        entity.velocity
                            ?.bearing,
                        null
                    ),

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
                    sourceName,

                active:
                    entity.active !==
                    false,

                status:
                    entity.status ??
                    "ACTIVE",

                rawEntity:
                    cloneValue(entity),

                exportedAt:
                    now()
            };
        }

        buildIdentity(entity) {
            return (
                normalizeText(
                    entity
                        .canonicalTrackId
                ) ||
                normalizeText(
                    entity.trackId
                ) ||
                normalizeText(
                    entity.cellId
                ) ||
                [
                    entity.coordinate
                        ?.lat,
                    entity.coordinate
                        ?.lon,
                    entity.timestamp
                ].join(":")
            );
        }

        refresh() {
            this.statistics
                .refreshes += 1;

            const startedAt =
                now();

            const sources =
                this.getSources();

            this.statistics
                .sourcesInspected +=
                sources.length;

            const sourceReports =
                [];

            const raw =
                [];

            sources.forEach(
                source => {
                    const sourceName =
                        source
                            ?.constructor
                            ?.name ??
                        source?.name ??
                        "anonymous";

                    const entities =
                        this.readFromSource(
                            source
                        );

                    sourceReports.push({
                        sourceName,

                        count:
                            entities.length
                    });

                    entities.forEach(
                        entity => {
                            raw.push({
                                entity,
                                sourceName
                            });
                        }
                    );
                }
            );

            this.statistics
                .rawEntities +=
                raw.length;

            const identities =
                new Set();

            const exported =
                [];

            raw.slice(
                0,
                this.config
                    .maximumEntities
            ).forEach(
                (
                    item,
                    index
                ) => {
                    const normalized =
                        this.normalize(
                            item.entity,
                            item.sourceName,
                            index
                        );

                    if (!normalized) {
                        this.statistics
                            .rejected += 1;

                        return;
                    }

                    const identity =
                        this.buildIdentity(
                            normalized
                        );

                    if (
                        identities.has(
                            identity
                        )
                    ) {
                        this.statistics
                            .duplicates += 1;

                        return;
                    }

                    identities.add(
                        identity
                    );

                    exported.push(
                        normalized
                    );
                }
            );

            this.statistics
                .exportedEntities +=
                exported.length;

            this.lastSources =
                sourceReports;

            global.RainArrivalLiveStormEntities =
                cloneValue(
                    exported
                );

            global.RainGuardAI =
                global.RainGuardAI || {};

            global.RainGuardAI.V32 =
                global.RainGuardAI.V32 || {};

            global.RainGuardAI.V32
                .liveStormEntities =
                cloneValue(
                    exported
                );

            global.RainGuardAI.V32
                .liveStormExportState = {
                    version:
                        this.version,

                    build:
                        this.build,

                    entities:
                        cloneValue(
                            exported
                        ),

                    sourceReports:
                        cloneValue(
                            sourceReports
                        ),

                    updatedAt:
                        now()
                };

            const result = {
                success:
                    true,

                status:
                    exported.length > 0
                        ? "LIVE_STORM_ENTITIES_EXPORTED"
                        : "NO_LIVE_STORM_ENTITIES_EXPORTED",

                version:
                    this.version,

                build:
                    this.build,

                sourceCount:
                    sources.length,

                rawCount:
                    raw.length,

                exportedCount:
                    exported.length,

                entities:
                    cloneValue(
                        exported
                    ),

                sourceReports:
                    cloneValue(
                        sourceReports
                    ),

                startedAt,

                completedAt:
                    now(),

                durationMs:
                    now() -
                    startedAt
            };

            this.lastResult =
                cloneValue(result);

            this.updatedAt =
                now();

            if (
                this.config.debug
            ) {
                console.log(
                    "[RainArrival LiveStormExportBridge] Refresh result:",
                    result
                );
            }

            return result;
        }

        installCollectorAdapter() {
            const collector =
                global
                    .RainArrivalStormEntityCollectorV32;

            if (!collector) {
                return {
                    success:
                        false,

                    reason:
                        "STORM_ENTITY_COLLECTOR_UNAVAILABLE"
                };
            }

            if (
                collector
                    .__liveExportAdapterInstalled
            ) {
                return {
                    success:
                        true,

                    alreadyInstalled:
                        true
                };
            }

            const originalGetRuntimeSources =
                typeof collector
                    .getRuntimeSources ===
                    "function"
                    ? collector
                        .getRuntimeSources
                        .bind(
                            collector
                        )
                    : null;

            collector.getRuntimeSources =
                () => {
                    const sources =
                        originalGetRuntimeSources
                            ? originalGetRuntimeSources()
                            : [];

                    const exportedChannel = {
                        name:
                            "RainArrivalLiveStormEntities",

                        entities:
                            global
                                .RainArrivalLiveStormEntities ??
                            []
                    };

                    return uniqueObjects([
                        exportedChannel,
                        ...sources
                    ]);
                };

            const originalExtract =
                typeof collector.extractEntities ===
                    "function"
                    ? collector
                        .extractEntities
                        .bind(
                            collector
                        )
                    : null;

            collector.extractEntities =
                value => {
                    if (
                        value &&
                        Array.isArray(
                            value.entities
                        )
                    ) {
                        return value.entities;
                    }

                    return originalExtract
                        ? originalExtract(
                            value
                        )
                        : [];
                };

            collector
                .__liveExportAdapterInstalled =
                true;

            collector
                .liveStormExportBridge =
                this;

            return {
                success:
                    true,

                installed:
                    true
            };
        }

        async refreshAndSync() {
            const exportResult =
                this.refresh();

            this.installCollectorAdapter();

            const collector =
                global
                    .RainArrivalStormEntityCollectorV32;

            if (
                !collector ||
                typeof collector
                    .collectAndSync !==
                    "function"
            ) {
                return {
                    success:
                        false,

                    reason:
                        "STORM_ENTITY_COLLECTOR_UNAVAILABLE",

                    exportResult
                };
            }

            const collectionResult =
                await collector
                    .collectAndSync();

            return {
                success:
                    Boolean(
                        collectionResult
                            ?.success
                    ),

                status:
                    "LIVE_EXPORT_AND_SYNC_COMPLETED",

                exportResult,

                collectionResult,

                generatedAt:
                    now()
            };
        }

        start() {
            if (this.running) {
                return {
                    success:
                        true,

                    alreadyRunning:
                        true
                };
            }

            this.running =
                true;

            this.installCollectorAdapter();

            this.refreshAndSync();

            this.timer =
                global.setInterval(
                    () => {
                        this.refreshAndSync();
                    },
                    this.config
                        .refreshIntervalMs
                );

            return {
                success:
                    true,

                running:
                    true,

                intervalMs:
                    this.config
                        .refreshIntervalMs
            };
        }

        stop() {
            if (this.timer) {
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
                    false
            };
        }

        getDiagnostics() {
            return {
                module:
                    MODULE_NAME,

                version:
                    this.version,

                build:
                    this.build,

                installed:
                    true,

                running:
                    this.running,

                exportedCount:
                    Array.isArray(
                        global
                            .RainArrivalLiveStormEntities
                    )
                        ? global
                            .RainArrivalLiveStormEntities
                            .length
                        : 0,

                collectorAvailable:
                    Boolean(
                        global
                            .RainArrivalStormEntityCollectorV32
                    ),

                lastSources:
                    cloneValue(
                        this.lastSources
                    ),

                lastResult:
                    cloneValue(
                        this.lastResult
                    ),

                lastError:
                    cloneValue(
                        this.lastError
                    ),

                statistics:
                    cloneValue(
                        this.statistics
                    ),

                createdAt:
                    this.createdAt,

                updatedAt:
                    this.updatedAt
            };
        }

        diagnose() {
            const diagnostics =
                this.getDiagnostics();

            console.log(
                "[RainArrival LiveStormExportBridge]",
                diagnostics
            );

            return diagnostics;
        }
    }

    const bridge =
        new LiveStormExportBridge();

    global.RainArrivalLiveStormExportBridgeV32 =
        bridge;

    global.RainGuardAI =
        global.RainGuardAI || {};

    global.RainGuardAI.V32 =
        global.RainGuardAI.V32 || {};

    global.RainGuardAI.V32
        .rainArrivalModules =
        global.RainGuardAI.V32
            .rainArrivalModules || {};

    global.RainGuardAI.V32
        .rainArrivalModules
        .liveStormExportBridge =
        bridge;

    global.RainArrivalEngineV32
        ?.register?.(
            MODULE_NAME,
            bridge
        );

    global.RainArrivalOrchestratorV32
        ?.register?.(
            MODULE_NAME,
            bridge
        );

    global.refreshRainArrivalLiveStormEntities =
        () =>
            bridge.refresh();

    global.refreshAndSyncRainArrivalLiveStormEntities =
        () =>
            bridge.refreshAndSync();

    if (
        bridge.config
            .autoStart
    ) {
        bridge.start();
    }

    console.log(
        "[RainGuard AI V32] Live Storm Export Bridge loaded.",
        {
            version:
                VERSION,

            build:
                BUILD
        }
    );

})(
    typeof globalThis !==
        "undefined"
        ? globalThis
        : window
);
