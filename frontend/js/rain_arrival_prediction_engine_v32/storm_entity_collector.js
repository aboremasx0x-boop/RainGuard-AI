/*
===========================================================
 RainGuard AI V32
 Phase 38M-13
 Storm Entity Collector Engine

 Responsibilities:
 - Discover V31 storm tracking and visualization runtimes
 - Collect active storm cells and predicted paths
 - Normalize different legacy object shapes
 - Preserve cell and track identity
 - Feed normalized entities into StormTrackStoreBridge
 - Expose diagnostics and manual collection commands
===========================================================
*/

(function (global) {
    "use strict";

    const MODULE_NAME =
        "stormEntityCollector";

    const VERSION =
        "32.38M.13";

    const BUILD =
        "rainguard-v32-phase38m-storm-entity-collector";

    const DEFAULT_CONFIG =
        Object.freeze({
            autoStart:
                true,

            collectionIntervalMs:
                4000,

            maximumEntities:
                1000,

            maximumEntityAgeMs:
                8 * 60 * 60 * 1000,

            minimumConfidence:
                0,

            includeInactive:
                false,

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

    function toNumber(
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
                toNumber(
                    value[0],
                    null
                );

            const second =
                toNumber(
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
                    latitude:
                        second,

                    longitude:
                        first
                }
                : {
                    latitude:
                        first,

                    longitude:
                        second
                };
        }

        const latitude =
            toNumber(
                value.latitude ??
                value.lat ??
                value.y ??
                value.center?.latitude ??
                value.center?.lat ??
                value.centroid?.latitude ??
                value.centroid?.lat ??
                value.coordinate?.latitude ??
                value.coordinate?.lat,
                null
            );

        const longitude =
            toNumber(
                value.longitude ??
                value.lon ??
                value.lng ??
                value.x ??
                value.center?.longitude ??
                value.center?.lon ??
                value.center?.lng ??
                value.centroid?.longitude ??
                value.centroid?.lon ??
                value.centroid?.lng ??
                value.coordinate?.longitude ??
                value.coordinate?.lon ??
                value.coordinate?.lng,
                null
            );

        if (
            latitude === null ||
            longitude === null ||
            latitude < -90 ||
            latitude > 90 ||
            longitude < -180 ||
            longitude > 180
        ) {
            return null;
        }

        return {
            latitude,
            longitude
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

    class StormEntityCollector {

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

            this.entities =
                new Map();

            this.lastResult =
                null;

            this.lastError =
                null;

            this.lastSourceReport =
                [];

            this.statistics = {
                collections:
                    0,

                sourcesInspected:
                    0,

                rawEntities:
                    0,

                accepted:
                    0,

                rejected:
                    0,

                duplicates:
                    0,

                bridgeSyncs:
                    0,

                failures:
                    0
            };

            this.createdAt =
                now();

            this.updatedAt =
                this.createdAt;
        }

        getBridge() {
            return (
                global
                    .RainArrivalStormTrackStoreBridgeV32 ||
                global.RainGuardAI
                    ?.V32
                    ?.rainArrivalModules
                    ?.stormTrackStoreBridge ||
                null
            );
        }

        getRuntimeSources() {
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

            const windowKeyPatterns = [
                /storm.*track/i,
                /track.*storm/i,
                /storm.*cell/i,
                /storm.*visual/i,
                /storm.*path/i
            ];

            try {
                Object.keys(global)
                    .filter(
                        key =>
                            windowKeyPatterns
                                .some(
                                    pattern =>
                                        pattern.test(
                                            key
                                        )
                                )
                    )
                    .slice(
                        0,
                        200
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
                // Ignore global enumeration failures.
            }

            return uniqueObjects(
                candidates
            );
        }

        inspectSource(source) {
            const result = {
                source,
                sourceName:
                    source?.constructor
                        ?.name ??
                    source?.name ??
                    "anonymous",

                entities:
                    []
            };

            const methods = [
                "getActiveCells",
                "getCells",
                "getActiveTracks",
                "getTracks",
                "getTrackedCells",
                "getCurrentCells",
                "getStormCells",
                "getStormTracks",
                "getPredictedPaths",
                "getPaths",
                "getCandidates",
                "getLatestResult",
                "getLatestSnapshot",
                "getSnapshot",
                "getState",
                "diagnose"
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
                        const value =
                            source[
                                methodName
                            ]();

                        const extracted =
                            this.extractEntities(
                                value
                            );

                        if (
                            extracted.length >
                            0
                        ) {
                            result.entities
                                .push(
                                    ...extracted
                                );
                        }
                    } catch (error) {
                        // Some diagnostic methods may require arguments.
                    }
                }
            );

            const propertyNames = [
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
                "cellStore"
            ];

            propertyNames.forEach(
                propertyName => {
                    try {
                        const extracted =
                            this.extractEntities(
                                source?.[
                                    propertyName
                                ]
                            );

                        if (
                            extracted.length >
                            0
                        ) {
                            result.entities
                                .push(
                                    ...extracted
                                );
                        }
                    } catch (error) {
                        // Ignore inaccessible properties.
                    }
                }
            );

            return result;
        }

        extractEntities(value) {
            if (!value) {
                return [];
            }

            const direct =
                collectionToArray(
                    value
                );

            if (
                direct.length >
                    0 &&
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
                "detectedCandidates",
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
                        nested.length >
                        0
                    ) {
                        collected.push(
                            ...nested
                        );
                    }
                }
            );

            return collected;
        }

        normalizeEntity(
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

            const confidence =
                toNumber(
                    entity.confidence ??
                    entity.trackingConfidence ??
                    entity.matchConfidence ??
                    entity.score ??
                    entity.quality,
                    0
                );

            if (
                confidence <
                this.config
                    .minimumConfidence
            ) {
                return null;
            }

            if (
                !this.config
                    .includeInactive &&
                entity.active === false
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
                    "COLLECTED",
                    Math.round(
                        coordinate
                            .latitude *
                        10000
                    ),
                    Math.round(
                        coordinate
                            .longitude *
                        10000
                    ),
                    index
                ].join("-");

            const point = {
                latitude:
                    coordinate.latitude,

                longitude:
                    coordinate.longitude,

                lat:
                    coordinate.latitude,

                lon:
                    coordinate.longitude,

                lng:
                    coordinate.longitude,

                timestamp:
                    observedAt,

                intensity:
                    toNumber(
                        entity.intensity ??
                        entity.reflectivity ??
                        entity.dbz ??
                        entity.severity,
                        null
                    ),

                confidence,

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
                                    latitude:
                                        item.latitude,

                                    longitude:
                                        item.longitude,

                                    lat:
                                        item.latitude,

                                    lon:
                                        item.longitude,

                                    lng:
                                        item.longitude,

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

                confidence,

                intensity:
                    point.intensity,

                speedKmh:
                    toNumber(
                        entity.speedKmh ??
                        entity.speed ??
                        entity.motion
                            ?.speedKmh ??
                        entity.velocity
                            ?.speedKmh,
                        null
                    ),

                bearing:
                    toNumber(
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

                collectedAt:
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
                        ?.latitude,
                    entity.coordinate
                        ?.longitude,
                    entity.timestamp
                ].join(":")
            );
        }

        collect() {
            this.statistics
                .collections += 1;

            const startedAt =
                now();

            const sources =
                this.getRuntimeSources();

            this.statistics
                .sourcesInspected +=
                sources.length;

            const sourceReports =
                [];

            const rawEntities =
                [];

            sources.forEach(
                source => {
                    const report =
                        this.inspectSource(
                            source
                        );

                    sourceReports.push({
                        sourceName:
                            report.sourceName,

                        count:
                            report.entities
                                .length
                    });

                    report.entities
                        .forEach(
                            entity => {
                                rawEntities.push({
                                    entity,

                                    sourceName:
                                        report
                                            .sourceName
                                });
                            }
                        );
                }
            );

            this.statistics
                .rawEntities +=
                rawEntities.length;

            const accepted =
                [];

            const rejected =
                [];

            const identities =
                new Set();

            rawEntities
                .slice(
                    0,
                    this.config
                        .maximumEntities
                )
                .forEach(
                    (
                        item,
                        index
                    ) => {
                        const normalized =
                            this.normalizeEntity(
                                item.entity,
                                item.sourceName,
                                index
                            );

                        if (!normalized) {
                            rejected.push({
                                index,
                                reason:
                                    "NORMALIZATION_REJECTED"
                            });

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
                                .duplicates +=
                                1;

                            return;
                        }

                        identities.add(
                            identity
                        );

                        accepted.push(
                            normalized
                        );
                    }
                );

            accepted.forEach(
                entity => {
                    this.entities.set(
                        this.buildIdentity(
                            entity
                        ),
                        entity
                    );
                }
            );

            this.statistics.accepted +=
                accepted.length;

            this.statistics.rejected +=
                rejected.length;

            this.lastSourceReport =
                sourceReports;

            const result = {
                success:
                    true,

                status:
                    accepted.length > 0
                        ? "STORM_ENTITIES_COLLECTED"
                        : "NO_STORM_ENTITIES_FOUND",

                version:
                    this.version,

                build:
                    this.build,

                sourceCount:
                    sources.length,

                rawCount:
                    rawEntities.length,

                acceptedCount:
                    accepted.length,

                rejectedCount:
                    rejected.length,

                storedCount:
                    this.entities.size,

                entities:
                    cloneValue(
                        accepted
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

            this.publishRuntime(
                result
            );

            if (
                this.config.debug
            ) {
                console.log(
                    "[RainArrival StormEntityCollector] Collection result:",
                    result
                );
            }

            return result;
        }

        publishRuntime(result) {
            global.RainGuardAI =
                global.RainGuardAI || {};

            global.RainGuardAI.V32 =
                global.RainGuardAI.V32 || {};

            global.RainGuardAI.V32
                .stormEntityCollectorState = {
                    version:
                        this.version,

                    build:
                        this.build,

                    entities:
                        cloneValue(
                            result.entities
                        ),

                    sourceReports:
                        cloneValue(
                            result
                                .sourceReports
                        ),

                    updatedAt:
                        now()
                };

            global.RainGuardAI.V32
                .stormEntities =
                cloneValue(
                    result.entities
                );
        }

        installBridgeAdapter() {
            const bridge =
                this.getBridge();

            if (!bridge) {
                return {
                    success:
                        false,

                    reason:
                        "STORM_TRACKSTORE_BRIDGE_UNAVAILABLE"
                };
            }

            if (
                bridge
                    .__collectorAdapterInstalled
            ) {
                return {
                    success:
                        true,

                    alreadyInstalled:
                        true
                };
            }

            const originalDiscover =
                typeof bridge.discover ===
                    "function"
                    ? bridge.discover
                        .bind(bridge)
                    : null;

            bridge.discover =
                () => {
                    const collected =
                        this.collect();

                    if (
                        collected.entities
                            .length > 0
                    ) {
                        return collected
                            .entities;
                    }

                    return originalDiscover
                        ? originalDiscover()
                        : [];
                };

            bridge
                .__collectorAdapterInstalled =
                true;

            bridge
                .stormEntityCollector =
                this;

            return {
                success:
                    true,

                installed:
                    true
            };
        }

        async collectAndSync() {
            const collection =
                this.collect();

            const bridge =
                this.getBridge();

            if (
                !bridge ||
                typeof bridge.sync !==
                    "function"
            ) {
                return {
                    success:
                        false,

                    reason:
                        "STORM_TRACKSTORE_BRIDGE_UNAVAILABLE",

                    collection
                };
            }

            this.installBridgeAdapter();

            const syncResult =
                await bridge.sync();

            this.statistics
                .bridgeSyncs += 1;

            return {
                success:
                    Boolean(
                        syncResult
                            ?.success
                    ),

                status:
                    "COLLECTION_AND_SYNC_COMPLETED",

                collection,

                syncResult,

                generatedAt:
                    now()
            };
        }

        getAll() {
            return Array.from(
                this.entities
                    .values()
            ).map(
                cloneValue
            );
        }

        clear() {
            this.entities.clear();

            return {
                success:
                    true,

                storedCount:
                    0
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

            this.installBridgeAdapter();

            this.collectAndSync();

            this.timer =
                global.setInterval(
                    () => {
                        this.collectAndSync();
                    },
                    this.config
                        .collectionIntervalMs
                );

            return {
                success:
                    true,

                running:
                    true,

                intervalMs:
                    this.config
                        .collectionIntervalMs
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

                bridgeAvailable:
                    Boolean(
                        this.getBridge()
                    ),

                storedCount:
                    this.entities.size,

                sourceReports:
                    cloneValue(
                        this.lastSourceReport
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
                "[RainArrival StormEntityCollector]",
                diagnostics
            );

            return diagnostics;
        }
    }

    const collector =
        new StormEntityCollector();

    global.RainArrivalStormEntityCollectorV32 =
        collector;

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
        .stormEntityCollector =
        collector;

    global.RainArrivalEngineV32
        ?.register?.(
            MODULE_NAME,
            collector
        );

    global.RainArrivalOrchestratorV32
        ?.register?.(
            MODULE_NAME,
            collector
        );

    global.collectRainArrivalStormEntities =
        () =>
            collector.collect();

    global.collectAndSyncRainArrivalStormEntities =
        () =>
            collector.collectAndSync();

    if (
        collector.config
            .autoStart
    ) {
        collector.start();
    }

    console.log(
        "[RainGuard AI V32] Storm Entity Collector loaded.",
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
