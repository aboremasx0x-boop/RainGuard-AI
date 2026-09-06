/*
===========================================================
 RainGuard AI V32
 Phase 38M-15
 Storm Entity Source Adapter

 Purpose:
 - Capture live V31 storm cells even when they are held inside
   private or irregular runtime objects.
 - Inspect known globals and nested runtime stores.
 - Observe CustomEvent payloads that contain cells/tracks/paths.
 - Publish normalized entities to RainArrivalLiveStormEntities.
 - Trigger the existing Phase 38M-14 -> 13 -> 12B pipeline.

 Notes:
 - This adapter does not fabricate storm entities.
 - It exports only objects that contain a valid coordinate.
===========================================================
*/

(function (global) {
    "use strict";

    const MODULE_NAME = "stormEntitySourceAdapter";
    const VERSION = "32.38M.15";
    const BUILD = "rainguard-v32-phase38m-storm-entity-source-adapter";

    const DEFAULT_CONFIG = Object.freeze({
        autoStart: true,
        scanIntervalMs: 3000,
        syncAfterCapture: true,
        maximumDepth: 5,
        maximumNodesPerScan: 5000,
        maximumEntities: 1000,
        maximumEntityAgeMs: 12 * 60 * 60 * 1000,
        minimumCaptureIntervalMs: 700,
        debug: true
    });

    const ENTITY_KEYS = Object.freeze([
        "activeCells",
        "cells",
        "stormCells",
        "trackedCells",
        "detectedCells",
        "activeTracks",
        "tracks",
        "stormTracks",
        "predictedPaths",
        "paths",
        "stormPaths",
        "candidates",
        "detectedCandidates",
        "entities",
        "items"
    ]);

    const ROOT_KEYS = Object.freeze([
        "RainGuardAI",
        "StormCellTrackingEngineV31",
        "StormTrackingEngineV31",
        "StormVisualizationEngineV31",
        "StormPathPredictionEngineV31",
        "RainGuardStormTrackingV31",
        "RainGuardStormVisualizationV31",
        "RainArrivalLiveStormEntities"
    ]);

    const now = () => Date.now();

    function isObject(value) {
        return value !== null && typeof value === "object";
    }

    function cloneValue(value) {
    if (
        value === null ||
        value === undefined
    ) {
        return value;
    }

    /*
     * Primitive values are already safe.
     */
    if (
        typeof value !== "object"
    ) {
        return value;
    }

    /*
     * Arrays:
     * keep only a bounded shallow copy.
     */
    if (Array.isArray(value)) {
        const MAX_ITEMS = 100;

        return value
            .slice(0, MAX_ITEMS)
            .map(item => {
                if (
                    item === null ||
                    item === undefined ||
                    typeof item !== "object"
                ) {
                    return item;
                }

                return compactClone(item);
            });
    }

    /*
     * Objects:
     * do NOT structuredClone the complete graph.
     */
    return compactClone(value);
}


function compactClone(source) {
    if (
        source === null ||
        source === undefined
    ) {
        return source;
    }

    if (
        typeof source !== "object"
    ) {
        return source;
    }

    const MAX_KEYS = 50;
    const MAX_ARRAY_ITEMS = 50;

    const result = {};

    let keys;

    try {
        keys = Object.keys(source)
            .slice(0, MAX_KEYS);
    } catch (_) {
        return null;
    }

    for (const key of keys) {
        let item;

        try {
            item = source[key];
        } catch (_) {
            continue;
        }

        if (
            item === null ||
            item === undefined
        ) {
            result[key] = item;
            continue;
        }

        const type =
            typeof item;

        if (
            type === "string" ||
            type === "number" ||
            type === "boolean"
        ) {
            result[key] = item;
            continue;
        }

        if (
            type === "bigint"
        ) {
            result[key] =
                item.toString();
            continue;
        }

        if (
            type === "function" ||
            type === "symbol"
        ) {
            continue;
        }

        if (
            Array.isArray(item)
        ) {
            result[key] =
                item
                    .slice(
                        0,
                        MAX_ARRAY_ITEMS
                    )
                    .map(entry => {
                        if (
                            entry === null ||
                            entry === undefined ||
                            typeof entry !== "object"
                        ) {
                            return entry;
                        }

                        /*
                         * One lightweight level only.
                         */
                        const small = {};

                        let entryKeys;

                        try {
                            entryKeys =
                                Object.keys(entry)
                                    .slice(0, 20);
                        } catch (_) {
                            return null;
                        }

                        for (
                            const entryKey
                            of entryKeys
                        ) {
                            let entryValue;

                            try {
                                entryValue =
                                    entry[entryKey];
                            } catch (_) {
                                continue;
                            }

                            if (
                                entryValue === null ||
                                entryValue === undefined ||
                                typeof entryValue === "string" ||
                                typeof entryValue === "number" ||
                                typeof entryValue === "boolean"
                            ) {
                                small[entryKey] =
                                    entryValue;
                            }
                        }

                        return small;
                    });

            continue;
        }

        /*
         * Nested objects:
         * one bounded shallow level only.
         */
        if (
            type === "object"
        ) {
            const nested = {};

            let nestedKeys;

            try {
                nestedKeys =
                    Object.keys(item)
                        .slice(0, 20);
            } catch (_) {
                result[key] = null;
                continue;
            }

            for (
                const nestedKey
                of nestedKeys
            ) {
                let nestedValue;

                try {
                    nestedValue =
                        item[nestedKey];
                } catch (_) {
                    continue;
                }

                if (
                    nestedValue === null ||
                    nestedValue === undefined ||
                    typeof nestedValue === "string" ||
                    typeof nestedValue === "number" ||
                    typeof nestedValue === "boolean"
                ) {
                    nested[nestedKey] =
                        nestedValue;
                }
            }

            result[key] =
                nested;
        }
    }

    return result;
}

    function toFiniteNumber(value, fallback = null) {
        const number = Number(value);
        return Number.isFinite(number) ? number : fallback;
    }

    function normalizeText(value) {
        return value === null || value === undefined
            ? ""
            : String(value).trim();
    }

    function normalizeTimestamp(value) {
        if (value === null || value === undefined) return now();

        if (typeof value === "number" && Number.isFinite(value)) {
            return value < 100000000000 ? value * 1000 : value;
        }

        const parsed = Date.parse(value);
        return Number.isFinite(parsed) ? parsed : now();
    }

    function normalizeCoordinate(value) {
        if (!value) return null;

        if (Array.isArray(value) && value.length >= 2) {
            const first = toFiniteNumber(value[0]);
            const second = toFiniteNumber(value[1]);

            if (first === null || second === null) return null;

            const likelyLonLat = Math.abs(first) > 90 && Math.abs(second) <= 90;

            const coordinate = likelyLonLat
                ? { lat: second, lon: first }
                : { lat: first, lon: second };

            if (coordinate.lat === 0 && coordinate.lon === 0) {
                return null;
            }

            return coordinate;
        }

        const lat = toFiniteNumber(
            value.lat ??
            value.latitude ??
            value.y ??
            value.center?.lat ??
            value.center?.latitude ??
            value.centroid?.lat ??
            value.centroid?.latitude ??
            value.coordinate?.lat ??
            value.coordinate?.latitude ??
            value.position?.lat ??
            value.position?.latitude
        );

        const lon = toFiniteNumber(
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
            value.coordinate?.longitude ??
            value.position?.lon ??
            value.position?.lng ??
            value.position?.longitude
        );

        if (
            lat === null ||
            lon === null ||
            lat < -90 ||
            lat > 90 ||
            lon < -180 ||
            lon > 180 ||
            (lat === 0 && lon === 0)
        ) {
            return null;
        }

        return { lat, lon };
    }

    function resolveEntityCoordinate(entity) {
        if (!entity) return null;

        const candidates = [
            entity.currentCoordinate,
            entity.coordinate,
            entity.center,
            entity.centroid,
            entity.location,
            entity.position,
            entity.start,
            entity.end,
            entity
        ];

        for (const candidate of candidates) {
            const coordinate = normalizeCoordinate(candidate);
            if (coordinate) return coordinate;
        }

        return null;
    }

    function collectionToArray(value) {
        if (!value) return [];
        if (Array.isArray(value)) return value;

        if (value instanceof Map || value instanceof Set) {
            return Array.from(value.values());
        }

        if (typeof value.values === "function") {
            try {
                return Array.from(value.values());
            } catch (_) {}
        }

        return [];
    }

    function looksLikeEntity(value) {
        if (!isObject(value)) return false;

        const hasIdentity =
            value.id !== undefined ||
            value.cellId !== undefined ||
            value.trackId !== undefined ||
            value.candidateId !== undefined;

        const hasCoordinate = Boolean(
            resolveEntityCoordinate(value)
        );

        return hasCoordinate && (
            hasIdentity ||
            value.intensity !== undefined ||
            value.reflectivity !== undefined ||
            value.dbz !== undefined ||
            value.confidence !== undefined ||
            value.points !== undefined ||
            value.path !== undefined
        );
    }

    class StormEntitySourceAdapter {
        constructor(config = {}) {
            this.version = VERSION;
            this.build = BUILD;
            this.config = {
                ...DEFAULT_CONFIG,
                ...(isObject(config) ? config : {})
            };

            this.running = false;
            this.timer = null;
            this.eventHookInstalled = false;
            this.originalDispatchEvent = null;
            this.lastCaptureAt = 0;
            this.lastResult = null;
            this.lastError = null;
            this.capturedEntities = new Map();

            this.statistics = {
                scans: 0,
                nodesVisited: 0,
                eventPayloadsInspected: 0,
                rawCandidates: 0,
                accepted: 0,
                rejected: 0,
                duplicates: 0,
                publications: 0,
                syncRequests: 0,
                failures: 0
            };
        }

        normalizeEntity(entity, source, index) {
            const coordinate = resolveEntityCoordinate(entity);

            if (!coordinate) return null;

            const observedAt = normalizeTimestamp(
                entity.timestamp ??
                entity.updatedAt ??
                entity.lastSeenAt ??
                entity.observedAt ??
                entity.createdAt ??
                entity.time ??
                entity.frameTimestamp
            );

            if (now() - observedAt > this.config.maximumEntityAgeMs) {
                return null;
            }

            const cellId = normalizeText(
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
                `SOURCE-${Math.round(coordinate.lat * 10000)}-${Math.round(coordinate.lon * 10000)}-${index}`;

            const point = {
                lat: coordinate.lat,
                lon: coordinate.lon,
                lng: coordinate.lon,
                latitude: coordinate.lat,
                longitude: coordinate.lon,
                timestamp: observedAt,
                intensity: toFiniteNumber(
                    entity.intensity ??
                    entity.reflectivity ??
                    entity.dbz ??
                    entity.severity,
                    null
                ),
                confidence: toFiniteNumber(
                    entity.confidence ??
                    entity.trackingConfidence ??
                    entity.matchConfidence ??
                    entity.score,
                    0
                ),
                source
            };

            const rawPoints =
                Array.isArray(entity.points) ? entity.points :
                Array.isArray(entity.path) ? entity.path :
                Array.isArray(entity.history) ? entity.history :
                [];

            const points = rawPoints
                .map((item, pointIndex) => {
                    const itemCoordinate = resolveEntityCoordinate(item);
                    if (!itemCoordinate) return null;

                    return {
                        lat: itemCoordinate.lat,
                        lon: itemCoordinate.lon,
                        lng: itemCoordinate.lon,
                        latitude: itemCoordinate.lat,
                        longitude: itemCoordinate.lon,
                        timestamp: normalizeTimestamp(
                            item.timestamp ??
                            item.time ??
                            observedAt + pointIndex
                        )
                    };
                })
                .filter(Boolean);

            if (points.length === 0) {
                points.push(point);
            }

            return {
                id: trackId,
                trackId,
                canonicalTrackId:
                    normalizeText(entity.canonicalTrackId) || trackId,
                cellId: cellId || trackId,

                // Phase 39A-15F6N4B1B3B-H3B2D coordinate recovery.
                lat: coordinate.lat,
                lon: coordinate.lon,
                lng: coordinate.lon,
                latitude: coordinate.lat,
                longitude: coordinate.lon,

                currentCoordinate: point,
                coordinate: point,
                center: point,
                points,
                timestamp: observedAt,
                observedAt,
                updatedAt: observedAt,
                confidence: point.confidence,
                intensity: point.intensity,
                speedKmh: toFiniteNumber(
                    entity.speedKmh ??
                    entity.speed ??
                    entity.motion?.speedKmh ??
                    entity.velocity?.speedKmh,
                    null
                ),
                bearing: toFiniteNumber(
                    entity.bearing ??
                    entity.direction ??
                    entity.motion?.bearing ??
                    entity.velocity?.bearing,
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
                source,
                active: entity.active !== false,
                status: entity.status ?? "ACTIVE",
                rawEntity: cloneValue(entity),
                capturedAt: now()
            };
        }

        buildIdentity(entity) {
            return (
                normalizeText(entity.canonicalTrackId) ||
                normalizeText(entity.trackId) ||
                normalizeText(entity.cellId) ||
                `${entity.coordinate?.lat}:${entity.coordinate?.lon}:${entity.timestamp}`
            );
        }

        collectFromValue(rootValue, sourceName) {
            const found = [];
            const visited = new WeakSet();
            const queue = [{ value: rootValue, depth: 0, path: sourceName }];
            let visitedCount = 0;

            while (
                queue.length > 0 &&
                visitedCount < this.config.maximumNodesPerScan
            ) {
                const current = queue.shift();
                const value = current.value;

                if (!isObject(value)) continue;
                if (visited.has(value)) continue;

                visited.add(value);
                visitedCount += 1;

                if (looksLikeEntity(value)) {
                    found.push({
                        entity: value,
                        source: current.path
                    });
                }

                const directCollection = collectionToArray(value);
                if (directCollection.length > 0) {
                    directCollection.forEach((item, index) => {
                        if (looksLikeEntity(item)) {
                            found.push({
                                entity: item,
                                source: `${current.path}[${index}]`
                            });
                        } else if (
                            isObject(item) &&
                            current.depth < this.config.maximumDepth
                        ) {
                            queue.push({
                                value: item,
                                depth: current.depth + 1,
                                path: `${current.path}[${index}]`
                            });
                        }
                    });
                }

                if (current.depth >= this.config.maximumDepth) continue;

                for (const key of ENTITY_KEYS) {
                    try {
                        const nested = value[key];

                        if (isObject(nested)) {
                            queue.push({
                                value: nested,
                                depth: current.depth + 1,
                                path: `${current.path}.${key}`
                            });
                        }
                    } catch (_) {}
                }

                let keys = [];
                try {
                    keys = Object.keys(value).slice(0, 200);
                } catch (_) {
                    keys = [];
                }

                for (const key of keys) {
                    if (
                        key === "window" ||
                        key === "self" ||
                        key === "globalThis" ||
                        key === "document" ||
                        key === "parent" ||
                        key === "top"
                    ) {
                        continue;
                    }

                    try {
                        const nested = value[key];

                        if (
                            isObject(nested) &&
                            !visited.has(nested)
                        ) {
                            queue.push({
                                value: nested,
                                depth: current.depth + 1,
                                path: `${current.path}.${key}`
                            });
                        }
                    } catch (_) {}
                }
            }

            this.statistics.nodesVisited += visitedCount;
            return found;
        }

        getRootSources() {
            const roots = [];

            for (const key of ROOT_KEYS) {
                try {
                    const value = global[key];
                    if (isObject(value)) {
                        roots.push({
                            name: `window.${key}`,
                            value
                        });
                    }
                } catch (_) {}
            }

            try {
                Object.keys(global)
                    .filter(key =>
                        /storm|cell|track|radar|visual|path/i.test(key)
                    )
                    .slice(0, 300)
                    .forEach(key => {
                        try {
                            const value = global[key];
                            if (isObject(value)) {
                                roots.push({
                                    name: `window.${key}`,
                                    value
                                });
                            }
                        } catch (_) {}
                    });
            } catch (_) {}

            const seen = new Set();
            return roots.filter(item => {
                if (seen.has(item.value)) return false;
                seen.add(item.value);
                return true;
            });
        }

        scan() {
            this.statistics.scans += 1;
            const startedAt = now();
            const rawCandidates = [];

            for (const root of this.getRootSources()) {
                rawCandidates.push(
                    ...this.collectFromValue(root.value, root.name)
                );

                if (rawCandidates.length >= this.config.maximumEntities * 4) {
                    break;
                }
            }

            this.statistics.rawCandidates += rawCandidates.length;

            const accepted = [];
            const identities = new Set();

            rawCandidates
                .slice(0, this.config.maximumEntities * 4)
                .forEach((candidate, index) => {
                    const normalized = this.normalizeEntity(
                        candidate.entity,
                        candidate.source,
                        index
                    );

                    if (!normalized) {
                        this.statistics.rejected += 1;
                        return;
                    }

                    const identity = this.buildIdentity(normalized);

                    if (identities.has(identity)) {
                        this.statistics.duplicates += 1;
                        return;
                    }

                    identities.add(identity);
                    accepted.push(normalized);
                });

            accepted
                .slice(0, this.config.maximumEntities)
                .forEach(entity => {
                    this.capturedEntities.set(
                        this.buildIdentity(entity),
                        entity
                    );
                });

            this.statistics.accepted += accepted.length;

            const result = {
                success: true,
                status:
                    accepted.length > 0
                        ? "SOURCE_ENTITIES_CAPTURED"
                        : "NO_SOURCE_ENTITIES_CAPTURED",
                version: this.version,
                build: this.build,
                rawCount: rawCandidates.length,
                acceptedCount: accepted.length,
                storedCount: this.capturedEntities.size,
                entities: this.getAll(),
                startedAt,
                completedAt: now(),
                durationMs: now() - startedAt
            };

            this.lastResult = cloneValue(result);
            return result;
        }

        captureEventPayload(event) {
            if (!event) return;

            const type = normalizeText(event.type);
            const detail = event.detail;

            if (!detail || !isObject(detail)) return;

            const likelyStormEvent =
                /storm|cell|track|radar|path|visual/i.test(type) ||
                ENTITY_KEYS.some(key => detail[key] !== undefined);

            if (!likelyStormEvent) return;

            this.statistics.eventPayloadsInspected += 1;

            const candidates = this.collectFromValue(
                detail,
                `event:${type || "custom"}`
            );

            candidates.forEach((candidate, index) => {
                const normalized = this.normalizeEntity(
                    candidate.entity,
                    candidate.source,
                    index
                );

                if (!normalized) return;

                this.capturedEntities.set(
                    this.buildIdentity(normalized),
                    normalized
                );
            });
        }

        installEventHook() {
            if (this.eventHookInstalled) {
                return {
                    success: true,
                    alreadyInstalled: true
                };
            }

            const prototype = global.EventTarget?.prototype;

            if (!prototype || typeof prototype.dispatchEvent !== "function") {
                return {
                    success: false,
                    reason: "EVENT_TARGET_UNAVAILABLE"
                };
            }

            this.originalDispatchEvent = prototype.dispatchEvent;

            const adapter = this;

            prototype.dispatchEvent = function patchedDispatchEvent(event) {
                try {
                    adapter.captureEventPayload(event);
                } catch (error) {
                    adapter.captureError(
                        error,
                        "EVENT_CAPTURE_FAILED"
                    );
                }

                return adapter.originalDispatchEvent.call(this, event);
            };

            this.eventHookInstalled = true;

            return {
                success: true,
                installed: true
            };
        }

        uninstallEventHook() {
            if (
                this.eventHookInstalled &&
                this.originalDispatchEvent &&
                global.EventTarget?.prototype
            ) {
                global.EventTarget.prototype.dispatchEvent =
                    this.originalDispatchEvent;
            }

            this.eventHookInstalled = false;
            this.originalDispatchEvent = null;

            return {
                success: true,
                installed: false
            };
        }

        getAll() {
            return Array.from(this.capturedEntities.values())
                .slice(-this.config.maximumEntities)
                .map(cloneValue);
        }

        publish() {
            const entities = this.getAll();

            const existing = Array.isArray(global.RainArrivalLiveStormEntities)
                ? global.RainArrivalLiveStormEntities
                : [];

            const merged = new Map();

            [...existing, ...entities].forEach(entity => {
                if (!entity) return;

                const normalized =
                    looksLikeEntity(entity)
                        ? this.normalizeEntity(entity, entity.source ?? "existing", 0)
                        : entity;

                if (!normalized) return;

                merged.set(
                    this.buildIdentity(normalized),
                    normalized
                );
            });

            global.RainArrivalLiveStormEntities =
                Array.from(merged.values())
                    .slice(-this.config.maximumEntities);

            global.RainGuardAI = global.RainGuardAI || {};
            global.RainGuardAI.V32 = global.RainGuardAI.V32 || {};

            global.RainGuardAI.V32.stormEntitySourceAdapterState = {
                version: this.version,
                build: this.build,
                entities: cloneValue(global.RainArrivalLiveStormEntities),
                updatedAt: now()
            };

            this.statistics.publications += 1;

            return {
                success: true,
                publishedCount: global.RainArrivalLiveStormEntities.length,
                generatedAt: now()
            };
        }

        async scanPublishAndSync() {
            const currentTime = now();

            if (
                currentTime - this.lastCaptureAt <
                this.config.minimumCaptureIntervalMs
            ) {
                return {
                    success: true,
                    status: "CAPTURE_THROTTLED",
                    generatedAt: currentTime
                };
            }

            this.lastCaptureAt = currentTime;

            const scanResult = this.scan();
            const publishResult = this.publish();

            let downstreamResult = null;

            if (this.config.syncAfterCapture) {
                const exportBridge =
                    global.RainArrivalLiveStormExportBridgeV32;

                if (
                    exportBridge &&
                    typeof exportBridge.refreshAndSync === "function"
                ) {
                    downstreamResult =
                        await exportBridge.refreshAndSync();

                    this.statistics.syncRequests += 1;
                } else {
                    const collector =
                        global.RainArrivalStormEntityCollectorV32;

                    if (
                        collector &&
                        typeof collector.collectAndSync === "function"
                    ) {
                        downstreamResult =
                            await collector.collectAndSync();

                        this.statistics.syncRequests += 1;
                    }
                }
            }

            const result = {
                success: true,
                status: "SOURCE_CAPTURE_PIPELINE_COMPLETED",
                scanResult,
                publishResult,
                downstreamResult,
                trackCount:
                    typeof global.RainArrivalTrackStoreV32?.getAll === "function"
                        ? global.RainArrivalTrackStoreV32.getAll().length
                        : null,
                generatedAt: now()
            };

            this.lastResult = cloneValue(result);

            if (this.config.debug) {
                console.log(
                    "[RainArrival StormEntitySourceAdapter] Pipeline result:",
                    result
                );
            }

            return result;
        }

        captureError(error, code) {
            this.lastError = {
                code,
                name: error?.name ?? "Error",
                message: error?.message ?? String(error),
                stack: error?.stack ?? null,
                timestamp: now()
            };

            this.statistics.failures += 1;
            return this.lastError;
        }

        clear() {
            this.capturedEntities.clear();

            return {
                success: true,
                storedCount: 0
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
            this.installEventHook();
            this.scanPublishAndSync();

            this.timer = global.setInterval(
                () => {
                    this.scanPublishAndSync();
                },
                this.config.scanIntervalMs
            );

            return {
                success: true,
                running: true,
                intervalMs: this.config.scanIntervalMs
            };
        }

        stop() {
            if (this.timer) {
                global.clearInterval(this.timer);
            }

            this.timer = null;
            this.running = false;

            return {
                success: true,
                running: false
            };
        }

        getDiagnostics() {
            return {
                module: MODULE_NAME,
                version: this.version,
                build: this.build,
                installed: true,
                running: this.running,
                eventHookInstalled: this.eventHookInstalled,
                storedCount: this.capturedEntities.size,
                liveExportCount:
                    Array.isArray(global.RainArrivalLiveStormEntities)
                        ? global.RainArrivalLiveStormEntities.length
                        : 0,
                trackCount:
                    typeof global.RainArrivalTrackStoreV32?.getAll === "function"
                        ? global.RainArrivalTrackStoreV32.getAll().length
                        : null,
                lastResult: cloneValue(this.lastResult),
                lastError: cloneValue(this.lastError),
                statistics: cloneValue(this.statistics)
            };
        }

        diagnose() {
            const diagnostics = this.getDiagnostics();

            console.log(
                "[RainArrival StormEntitySourceAdapter]",
                diagnostics
            );

            return diagnostics;
        }
    }

    const adapter = new StormEntitySourceAdapter();

    global.RainArrivalStormEntitySourceAdapterV32 = adapter;

    global.RainGuardAI = global.RainGuardAI || {};
    global.RainGuardAI.V32 = global.RainGuardAI.V32 || {};
    global.RainGuardAI.V32.rainArrivalModules =
        global.RainGuardAI.V32.rainArrivalModules || {};

    global.RainGuardAI.V32.rainArrivalModules.stormEntitySourceAdapter =
        adapter;

    global.RainArrivalEngineV32?.register?.(
        MODULE_NAME,
        adapter
    );

    global.RainArrivalOrchestratorV32?.register?.(
        MODULE_NAME,
        adapter
    );

    global.captureRainArrivalStormEntities =
        () => adapter.scanPublishAndSync();

    global.inspectRainArrivalStormEntitySources =
        () => adapter.scan();

    if (adapter.config.autoStart) {
        adapter.start();
    }

    console.log(
        "[RainGuard AI V32] Storm Entity Source Adapter loaded.",
        {
            version: VERSION,
            build: BUILD
        }
    );

})(
    typeof globalThis !== "undefined"
        ? globalThis
        : window
);
