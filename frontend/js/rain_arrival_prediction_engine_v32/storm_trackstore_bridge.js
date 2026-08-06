/*
===========================================================
 RainGuard AI V32
 Phase 38M-12B-1
 Storm Tracking -> Modular TrackStore Live Bridge
===========================================================
*/

(function (global) {
    "use strict";

    const VERSION = "32.38M.12B1";
    const BUILD = "rainguard-v32-phase38m-storm-trackstore-live-bridge";

    const CONFIG = Object.freeze({
        autoStart: true,
        syncIntervalMs: 5000,
        maximumEntitiesPerSync: 500,
        maximumPointAgeMs: 6 * 60 * 60 * 1000,
        minimumCoordinateDelta: 0.00001,
        debug: true
    });

    const now = () => Date.now();

    function isObject(value) {
        return value !== null && typeof value === "object" && !Array.isArray(value);
    }

    function clone(value) {
        if (value === null || value === undefined) return value;
        try {
            return typeof structuredClone === "function"
                ? structuredClone(value)
                : JSON.parse(JSON.stringify(value));
        } catch (_) {
            return value;
        }
    }

    function number(value, fallback = null) {
        const n = Number(value);
        return Number.isFinite(n) ? n : fallback;
    }

    function text(value) {
        return value === null || value === undefined ? "" : String(value).trim();
    }

    function timestamp(value) {
        if (value === null || value === undefined) return now();

        if (typeof value === "number" && Number.isFinite(value)) {
            return value < 100000000000 ? value * 1000 : value;
        }

        const parsed = Date.parse(value);
        return Number.isFinite(parsed) ? parsed : now();
    }

    function coordinate(value) {
        if (!value) return null;

        if (Array.isArray(value) && value.length >= 2) {
            const first = number(value[0]);
            const second = number(value[1]);

            if (first === null || second === null) return null;

            const likelyLonLat = Math.abs(first) > 90 && Math.abs(second) <= 90;

            return likelyLonLat
                ? { lat: second, lon: first }
                : { lat: first, lon: second };
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

        return { lat, lon };
    }

    function toArray(value) {
        if (!value) return [];
        if (Array.isArray(value)) return value;
        if (value instanceof Map || value instanceof Set) return Array.from(value.values());

        if (typeof value.values === "function") {
            try {
                return Array.from(value.values());
            } catch (_) {}
        }

        return isObject(value) ? Object.values(value) : [];
    }

    class StormTrackStoreBridge {
        constructor(config = {}) {
            this.version = VERSION;
            this.build = BUILD;
            this.config = { ...CONFIG, ...(isObject(config) ? config : {}) };

            this.running = false;
            this.timer = null;
            this.lastSource = null;
            this.lastResult = null;
            this.lastError = null;

            this.statistics = {
                syncRuns: 0,
                discovered: 0,
                normalized: 0,
                inserted: 0,
                updated: 0,
                skipped: 0,
                failures: 0
            };
        }

        getTrackStore() {
            return (
                global.RainArrivalTrackStoreV32 ||
                global.RainGuardAI?.V32?.rainArrivalModules?.trackStore ||
                global.RainArrivalEngineV32?.get?.("trackStore") ||
                null
            );
        }

        getSources() {
            return [
                global.StormCellTrackingEngineV31,
                global.StormTrackingEngineV31,
                global.RainGuardStormTrackingV31,
                global.RainGuardAI?.V31?.stormCellTracking,
                global.RainGuardAI?.V31?.stormTracking,
                global.RainGuardAI?.stormCellTracking,
                global.RainGuardAI?.stormTracking
            ].filter(Boolean);
        }

        extractEntities(value) {
            if (!value) return [];

            const direct = toArray(value);
            if (direct.length && direct.some(isObject)) return direct;

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
                const items = toArray(value?.[key]);
                if (items.length) return items;
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
                if (typeof source?.[method] === "function") {
                    try {
                        const entities = this.extractEntities(source[method]());
                        if (entities.length) return entities;
                    } catch (error) {
                        this.captureError(error, `SOURCE_METHOD_FAILED:${method}`);
                    }
                }
            }

            return this.extractEntities(source);
        }

        discover() {
            for (const source of this.getSources()) {
                const entities = this.readSource(source);

                if (entities.length) {
                    this.lastSource = source;
                    return entities.slice(0, this.config.maximumEntitiesPerSync);
                }
            }

            return [];
        }

        normalizeEntity(entity, index) {
            const pointCoordinate = coordinate(
                entity?.currentCoordinate ??
                entity?.coordinate ??
                entity?.center ??
                entity?.centroid ??
                entity?.location ??
                entity?.position ??
                entity
            );

            if (!pointCoordinate) return null;

            const pointTimestamp = timestamp(
                entity.timestamp ??
                entity.updatedAt ??
                entity.lastSeenAt ??
                entity.observedAt ??
                entity.time ??
                entity.frameTimestamp
            );

            if (now() - pointTimestamp > this.config.maximumPointAgeMs) {
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
                `LIVE-${Math.round(pointCoordinate.lat * 10000)}-${Math.round(pointCoordinate.lon * 10000)}-${index}`;

            const cellId =
                text(entity.cellId ?? entity.id ?? entity.trackId) ||
                trackId;

            const intensity = number(
                entity.intensity ??
                entity.reflectivity ??
                entity.dbz ??
                entity.score ??
                entity.severity
            );

            const confidence = number(
                entity.confidence ??
                entity.trackingConfidence ??
                entity.matchConfidence ??
                entity.score
            );

            const currentPoint = {
                lat: pointCoordinate.lat,
                lon: pointCoordinate.lon,
                timestamp: pointTimestamp,
                intensity,
                confidence,
                source: entity.source ?? "storm_cell_tracking_v31"
            };

            return {
                trackId,
                canonicalTrackId: text(entity.canonicalTrackId) || trackId,
                cellId,
                city: entity.city ?? entity.cityName ?? entity.targetCity ?? null,
                region: entity.region ?? entity.regionName ?? null,
                source: entity.source ?? "storm_cell_tracking_v31",
                confidence,
                intensity,
                speedKmh: number(
                    entity.speedKmh ??
                    entity.speed ??
                    entity.motion?.speedKmh ??
                    entity.velocity?.speedKmh
                ),
                bearing: number(
                    entity.bearing ??
                    entity.direction ??
                    entity.motion?.bearing ??
                    entity.velocity?.bearing
                ),
                currentPoint,
                points: [currentPoint],
                active: entity.active !== false,
                status: entity.status ?? "ACTIVE",
                rawEntity: clone(entity),
                bridgedAt: now()
            };
        }

        existing(store, trackId) {
            for (const method of ["get", "getTrack"]) {
                if (typeof store?.[method] === "function") {
                    try {
                        return store[method](trackId);
                    } catch (_) {}
                }
            }

            return null;
        }

        duplicate(existing, point) {
            const points = Array.isArray(existing?.points) ? existing.points : [];
            const last = points[points.length - 1] ?? existing?.currentPoint ?? null;

            if (!last) return false;

            const lastCoordinate = coordinate(last);
            if (!lastCoordinate) return false;

            const samePosition =
                Math.abs(lastCoordinate.lat - point.lat) < this.config.minimumCoordinateDelta &&
                Math.abs(lastCoordinate.lon - point.lon) < this.config.minimumCoordinateDelta;

            return samePosition && timestamp(last.timestamp ?? last.updatedAt) === point.timestamp;
        }

        upsert(store, track) {
            const existing = this.existing(store, track.trackId);

            if (existing && this.duplicate(existing, track.currentPoint)) {
                this.statistics.skipped += 1;
                return { success: true, action: "skipped", trackId: track.trackId };
            }

            const attempts = [
                ["upsert", [track.trackId, track]],
                ["upsertTrack", [track]],
                ["set", [track.trackId, track]],
                ["setTrack", [track.trackId, track]],
                ["add", [track]],
                ["addTrack", [track]],
                ["appendPoint", [track.trackId, track.currentPoint, track]]
            ];

            for (const [method, args] of attempts) {
                if (typeof store?.[method] !== "function") continue;

                try {
                    const result = store[method](...args);
                    const action = existing ? "updated" : "inserted";
                    this.statistics[action] += 1;

                    return {
                        success: result !== false,
                        action,
                        trackId: track.trackId,
                        method
                    };
                } catch (error) {
                    this.captureError(error, `TRACKSTORE_METHOD_FAILED:${method}`);
                }
            }

            return {
                success: false,
                action: "failed",
                reason: "NO_COMPATIBLE_TRACKSTORE_WRITE_METHOD",
                trackId: track.trackId
            };
        }

        count(store) {
            if (typeof store?.size === "number") return store.size;

            if (typeof store?.getAll === "function") {
                try {
                    return store.getAll().length;
                } catch (_) {}
            }

            return null;
        }

        async sync() {
            this.statistics.syncRuns += 1;
            const startedAt = now();
            const store = this.getTrackStore();

            if (!store) {
                return this.fail("TRACK_STORE_UNAVAILABLE", startedAt);
            }

            const entities = this.discover();
            this.statistics.discovered += entities.length;

            const normalized = entities
                .map((entity, index) => this.normalizeEntity(entity, index))
                .filter(Boolean);

            this.statistics.normalized += normalized.length;

            const writes = normalized.map(track => this.upsert(store, track));
            const successfulWrites = writes.filter(item => item.success).length;

            const result = {
                success: entities.length === 0 ? true : successfulWrites > 0,
                status: entities.length === 0
                    ? "NO_LIVE_STORM_ENTITIES"
                    : "TRACKSTORE_SYNC_COMPLETED",
                version: this.version,
                build: this.build,
                discovered: entities.length,
                normalized: normalized.length,
                successfulWrites,
                failedWrites: writes.length - successfulWrites,
                trackCount: this.count(store),
                writes,
                startedAt,
                completedAt: now(),
                durationMs: now() - startedAt
            };

            this.lastResult = clone(result);
            this.publish(result);

            if (this.config.debug) {
                console.log("[RainArrival StormTrackStoreBridge] Sync result:", result);
            }

            return result;
        }

        fail(reason, startedAt) {
            this.statistics.failures += 1;

            const result = {
                success: false,
                status: "TRACKSTORE_SYNC_FAILED",
                reason,
                version: this.version,
                build: this.build,
                startedAt,
                completedAt: now(),
                durationMs: now() - startedAt
            };

            this.lastResult = clone(result);
            this.publish(result);
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

        publish(result) {
            global.RainGuardAI = global.RainGuardAI || {};
            global.RainGuardAI.V32 = global.RainGuardAI.V32 || {};

            global.RainGuardAI.V32.rainArrivalBridgeState = {
                version: this.version,
                build: this.build,
                running: this.running,
                lastResult: clone(result),
                statistics: clone(this.statistics),
                updatedAt: now()
            };
        }

        start() {
            if (this.running) {
                return { success: true, alreadyRunning: true };
            }

            this.running = true;
            this.sync();

            this.timer = global.setInterval(
                () => this.sync(),
                this.config.syncIntervalMs
            );

            return {
                success: true,
                running: true,
                intervalMs: this.config.syncIntervalMs
            };
        }

        stop() {
            if (this.timer) global.clearInterval(this.timer);

            this.timer = null;
            this.running = false;

            return { success: true, running: false };
        }

        getDiagnostics() {
            const store = this.getTrackStore();

            return {
                module: "stormTrackStoreBridge",
                version: this.version,
                build: this.build,
                installed: true,
                running: this.running,
                trackStoreAvailable: Boolean(store),
                sourceAvailable: Boolean(this.lastSource),
                trackCount: this.count(store),
                lastResult: clone(this.lastResult),
                lastError: clone(this.lastError),
                statistics: clone(this.statistics)
            };
        }

        diagnose() {
            const diagnostics = this.getDiagnostics();
            console.log("[RainArrival StormTrackStoreBridge]", diagnostics);
            return diagnostics;
        }
    }

    const bridge = new StormTrackStoreBridge();

    global.RainArrivalStormTrackStoreBridgeV32 = bridge;

    global.RainGuardAI = global.RainGuardAI || {};
    global.RainGuardAI.V32 = global.RainGuardAI.V32 || {};
    global.RainGuardAI.V32.rainArrivalModules =
        global.RainGuardAI.V32.rainArrivalModules || {};

    global.RainGuardAI.V32.rainArrivalModules.stormTrackStoreBridge = bridge;

    global.RainArrivalEngineV32?.register?.(
        "stormTrackStoreBridge",
        bridge
    );

    global.RainArrivalOrchestratorV32?.register?.(
        "stormTrackStoreBridge",
        bridge
    );

    global.runRainArrivalStormTrackStoreSync =
        () => bridge.sync();

    if (bridge.config.autoStart) {
        bridge.start();
    }

    console.log(
        "[RainGuard AI V32] Storm Tracking -> TrackStore Bridge loaded.",
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
