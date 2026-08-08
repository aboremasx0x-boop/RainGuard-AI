/*
===============================================================================
 RainGuard AI V32
 Storm Entity Collector — Restored Compatible Core
 Version: 32.38M.13-R1
===============================================================================
*/

(function initializeRainArrivalStormEntityCollector(global) {
    "use strict";

    const MODULE_NAME = "stormEntityCollector";
    const VERSION = "32.38M.13-R1";
    const BUILD = "rainguard-v32-phase38m-storm-entity-collector-restored";
    const now = () => Date.now();

    const DEFAULT_CONFIG = {
        autoStart: true,
        collectionIntervalMs: 4000,
        maximumEntities: 5000,
        debug: true
    };

    function cloneValue(value) {
        if (value === null || value === undefined) return value;
        try {
            if (typeof structuredClone === "function") return structuredClone(value);
        } catch (_) {}
        try {
            return JSON.parse(JSON.stringify(value));
        } catch (_) {
            return value;
        }
    }

    function safeArray(value) {
        if (!value) return [];
        if (Array.isArray(value)) return value;
        if (value instanceof Map || value instanceof Set) return Array.from(value.values());
        try {
            if (typeof value.values === "function") return Array.from(value.values());
        } catch (_) {}
        return [];
    }

    function finite(value) {
        const n = Number(value);
        return Number.isFinite(n) ? n : null;
    }

    function normalizeTimestamp(value) {
        const n = finite(value);
        if (n !== null) return n < 1e10 ? n * 1000 : n;
        const parsed = Date.parse(value);
        return Number.isFinite(parsed) ? parsed : now();
    }

    function normalizeEntity(raw, sourceName = "unknown") {
        if (!raw || typeof raw !== "object") return null;

        const id =
            raw.id ?? raw.trackId ?? raw.cellId ?? raw.stormId ??
            raw.entityId ?? raw.uuid ?? null;

        const latitude = finite(
            raw.latitude ?? raw.lat ?? raw.center?.latitude ?? raw.center?.lat
        );

        const longitude = finite(
            raw.longitude ?? raw.lon ?? raw.lng ??
            raw.center?.longitude ?? raw.center?.lon ?? raw.center?.lng
        );

        if (!id && latitude === null && longitude === null && !raw.motion && !raw.path && !raw.predictedPath) {
            return null;
        }

        const timestamp = normalizeTimestamp(
            raw.timestamp ?? raw.updatedAt ?? raw.generatedAt ??
            raw.detectedAt ?? raw.observedAt ?? now()
        );

        return {
            ...cloneValue(raw),
            id: String(id ?? `${sourceName}:${latitude ?? "na"}:${longitude ?? "na"}:${Math.floor(timestamp / 10000)}`),
            source: raw.source ?? sourceName,
            latitude,
            longitude,
            timestamp,
            collectedAt: now()
        };
    }

    class StormEntityCollector {
        constructor(config = {}) {
            this.version = VERSION;
            this.build = BUILD;
            this.config = { ...DEFAULT_CONFIG, ...config };
            this.entities = new Map();
            this.running = false;
            this.timer = null;
            this.syncRunning = false;
            this.lastSourceReport = null;
            this.lastResult = null;
            this.lastError = null;
            this.createdAt = now();
            this.updatedAt = this.createdAt;
            this.statistics = {
                collections: 0,
                discovered: 0,
                stored: 0,
                bridgeSyncs: 0,
                failures: 0,
                emptyCollections: 0
            };
        }

        log(message, data) {
            if (!this.config.debug) return;
            console.log(`[RainArrival StormEntityCollector] ${message}`, data ?? "");
        }

        getBridge() {
            return (
                global.RainArrivalStormTrackStoreBridgeV32 ||
                global.RainGuardAI?.V32?.rainArrivalModules?.stormTrackStoreBridge ||
                null
            );
        }

        collectSources() {
            return [
                ["liveStormExportBridge", global.RainArrivalLiveStormExportBridgeV32],
                ["stormTrackStoreBridge", global.RainArrivalStormTrackStoreBridgeV32],
                ["stormCellTracking", global.RainGuardStormCellTrackingEngineV31 ?? global.RainGuardAI?.V31?.stormCellTrackingEngine],
                ["stormPathPrediction", global.RainGuardStormPathPredictionEngineV31 ?? global.RainGuardAI?.V31?.stormPathPredictionEngine],
                ["rainArrivalEngine", global.RainArrivalEngineV32],
                ["rainGuardV32", global.RainGuardAI?.V32]
            ].filter(([, value]) => Boolean(value));
        }

        extractSourceEntities(value) {
            if (!value) return [];

            const candidates = [];
            const append = (v) => { if (v) candidates.push(v); };

            for (const methodName of [
                "getAll", "getEntities", "getTracks", "getActive",
                "getActiveTracks", "getStorms", "getCells", "getLatest", "export"
            ]) {
                if (typeof value?.[methodName] !== "function") continue;
                try {
                    const result = value[methodName]();
                    if (result && typeof result.then === "function") continue;
                    append(result);
                } catch (_) {}
            }

            const keys = [
                "entities", "stormEntities", "liveStormEntities",
                "tracks", "activeTracks", "stormTracks",
                "cells", "activeCells", "stormCells",
                "items", "results", "predictions", "paths",
                "predictedPaths", "candidates", "data",
                "payload", "output", "lastResult", "lastOutput"
            ];

            for (const key of keys) append(value?.[key]);

            const flattened = [];

            for (const candidate of candidates) {
                if (Array.isArray(candidate)) {
                    flattened.push(...candidate);
                    continue;
                }

                if (candidate instanceof Map || candidate instanceof Set) {
                    flattened.push(...candidate.values());
                    continue;
                }

                if (candidate && typeof candidate === "object") {
                    for (const key of keys) {
                        const nested = candidate[key];
                        if (Array.isArray(nested)) flattened.push(...nested);
                        else if (nested instanceof Map || nested instanceof Set) flattened.push(...nested.values());
                    }
                }
            }

            return flattened;
        }

        collect() {
            const startedAt = now();
            const discovered = [];
            const seen = new Set();
            const sourceReports = [];

            try {
                for (const [sourceName, sourceValue] of this.collectSources()) {
                    let items = [];

                    try {
                        items = this.extractSourceEntities(sourceValue);
                    } catch (error) {
                        sourceReports.push({
                            source: sourceName,
                            success: false,
                            count: 0,
                            error: error?.message ?? String(error)
                        });
                        continue;
                    }

                    for (const raw of safeArray(items)) {
                        const entity = normalizeEntity(raw, sourceName);
                        if (!entity || seen.has(entity.id)) continue;
                        seen.add(entity.id);
                        discovered.push(entity);
                    }

                    sourceReports.push({
                        source: sourceName,
                        success: true,
                        count: safeArray(items).length
                    });
                }

                for (const entity of discovered) this.entities.set(entity.id, entity);

                if (this.entities.size > this.config.maximumEntities) {
                    const kept = Array.from(this.entities.values())
                        .sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0))
                        .slice(0, this.config.maximumEntities);

                    this.entities.clear();
                    for (const entity of kept) this.entities.set(entity.id, entity);
                }

                this.statistics.collections += 1;
                this.statistics.discovered += discovered.length;
                this.statistics.stored = this.entities.size;
                if (!discovered.length) this.statistics.emptyCollections += 1;

                this.updatedAt = now();
                this.lastSourceReport = {
                    generatedAt: this.updatedAt,
                    sources: sourceReports
                };

                const result = {
                    success: true,
                    status: discovered.length ? "STORM_ENTITIES_FOUND" : "NO_STORM_ENTITIES_FOUND",
                    version: VERSION,
                    build: BUILD,
                    sourceCount: sourceReports.length,
                    discoveredCount: discovered.length,
                    storedCount: this.entities.size,
                    entities: discovered,
                    sourceReports,
                    durationMs: now() - startedAt,
                    generatedAt: this.updatedAt
                };

                this.lastResult = cloneValue(result);
                this.lastError = null;
                this.log("Collection result:", result);
                return result;

            } catch (error) {
                const failure = {
                    name: error?.name ?? "Error",
                    message: error?.message ?? String(error),
                    stack: error?.stack ?? null,
                    timestamp: now()
                };

                this.lastError = failure;
                this.statistics.failures += 1;

                const result = {
                    success: false,
                    status: "STORM_ENTITY_COLLECTION_FAILED",
                    version: VERSION,
                    build: BUILD,
                    sourceCount: 0,
                    discoveredCount: 0,
                    storedCount: this.entities.size,
                    entities: [],
                    sourceReports: [],
                    error: failure,
                    generatedAt: now()
                };

                this.lastResult = cloneValue(result);
                console.error("[RainArrival StormEntityCollector] Collection failed.", failure);
                return result;
            }
        }

        installBridgeAdapter() {
            const bridge = this.getBridge();

            if (!bridge) {
                return {
                    success: false,
                    reason: "STORM_TRACKSTORE_BRIDGE_UNAVAILABLE"
                };
            }

            if (bridge.__collectorAdapterInstalled && bridge.stormEntityCollector === this) {
                return {
                    success: true,
                    installed: true,
                    alreadyInstalled: true
                };
            }

            const originalDiscover =
                typeof bridge.discover === "function"
                    ? bridge.discover.bind(bridge)
                    : null;

            bridge.discover = () => {
                const collected = this.collect();
                const entities = Array.isArray(collected?.entities)
                    ? collected.entities
                    : [];

                if (entities.length > 0) return entities;

                if (!originalDiscover) return [];

                try {
                    const fallback = originalDiscover();
                    return Array.isArray(fallback) ? fallback : [];
                } catch (error) {
                    this.lastError = {
                        name: error?.name ?? "Error",
                        message: error?.message ?? String(error),
                        stack: error?.stack ?? null,
                        timestamp: now()
                    };
                    return [];
                }
            };

            bridge.__collectorAdapterInstalled = true;
            bridge.stormEntityCollector = this;

            return {
                success: true,
                installed: true
            };
        }

        async collectAndSync() {
            if (this.syncRunning) {
                return {
                    success: true,
                    skipped: true,
                    status: "COLLECTION_SYNC_ALREADY_RUNNING",
                    generatedAt: now()
                };
            }

            this.syncRunning = true;

            try {
                const collection = this.collect();
                const bridge = this.getBridge();

                if (!bridge || typeof bridge.sync !== "function") {
                    return {
                        success: false,
                        reason: "STORM_TRACKSTORE_BRIDGE_UNAVAILABLE",
                        collection
                    };
                }

                this.installBridgeAdapter();
                const syncResult = await bridge.sync();
                this.statistics.bridgeSyncs += 1;

                return {
                    success: Boolean(syncResult?.success),
                    status: "COLLECTION_AND_SYNC_COMPLETED",
                    collection,
                    syncResult,
                    generatedAt: now()
                };

            } catch (error) {
                this.lastError = {
                    name: error?.name ?? "Error",
                    message: error?.message ?? String(error),
                    stack: error?.stack ?? null,
                    timestamp: now()
                };

                this.statistics.failures += 1;

                return {
                    success: false,
                    status: "COLLECTION_AND_SYNC_FAILED",
                    error: cloneValue(this.lastError),
                    generatedAt: now()
                };

            } finally {
                this.syncRunning = false;
            }
        }

        getAll() {
            return Array.from(this.entities.values()).map(cloneValue);
        }

        clear() {
            this.entities.clear();
            this.statistics.stored = 0;
            return { success: true, storedCount: 0 };
        }

        start() {
            if (this.running && this.timer) {
                return {
                    success: true,
                    alreadyRunning: true,
                    running: true,
                    intervalMs: this.config.collectionIntervalMs
                };
            }

            if (this.timer) {
                try { global.clearInterval(this.timer); } catch (_) {}
                this.timer = null;
            }

            this.running = true;
            this.installBridgeAdapter();

            Promise.resolve(this.collectAndSync()).catch(error => {
                this.lastError = {
                    name: error?.name ?? "Error",
                    message: error?.message ?? String(error),
                    stack: error?.stack ?? null,
                    timestamp: now()
                };
            });

            this.timer = global.setInterval(() => {
                Promise.resolve(this.collectAndSync()).catch(error => {
                    this.lastError = {
                        name: error?.name ?? "Error",
                        message: error?.message ?? String(error),
                        stack: error?.stack ?? null,
                        timestamp: now()
                    };
                });
            }, this.config.collectionIntervalMs);

            return {
                success: true,
                running: true,
                intervalMs: this.config.collectionIntervalMs
            };
        }

        stop() {
            if (this.timer) global.clearInterval(this.timer);
            this.timer = null;
            this.running = false;
            this.syncRunning = false;
            return { success: true, running: false };
        }

        getDiagnostics() {
            return {
                module: MODULE_NAME,
                version: this.version,
                build: this.build,
                installed: true,
                running: this.running,
                syncRunning: this.syncRunning,
                bridgeAvailable: Boolean(this.getBridge()),
                storedCount: this.entities.size,
                sourceReports: cloneValue(this.lastSourceReport),
                lastResult: cloneValue(this.lastResult),
                lastError: cloneValue(this.lastError),
                statistics: cloneValue(this.statistics),
                createdAt: this.createdAt,
                updatedAt: this.updatedAt
            };
        }

        diagnose() {
            const diagnostics = this.getDiagnostics();
            console.log("[RainArrival StormEntityCollector]", diagnostics);
            return diagnostics;
        }
    }

    const collector = new StormEntityCollector();

    global.RainArrivalStormEntityCollectorV32 = collector;

    global.RainGuardAI = global.RainGuardAI || {};
    global.RainGuardAI.V32 = global.RainGuardAI.V32 || {};
    global.RainGuardAI.V32.rainArrivalModules =
        global.RainGuardAI.V32.rainArrivalModules || {};

    global.RainGuardAI.V32.rainArrivalModules.stormEntityCollector = collector;

    global.RainArrivalEngineV32?.register?.(MODULE_NAME, collector);
    global.RainArrivalOrchestratorV32?.register?.(MODULE_NAME, collector);

    global.collectRainArrivalStormEntities = () => collector.collect();
    global.collectAndSyncRainArrivalStormEntities = () => collector.collectAndSync();
    global.diagnoseRainArrivalStormEntityCollector = () => collector.diagnose();

    if (collector.config.autoStart) collector.start();

    console.log("[RainGuard AI V32] Storm Entity Collector loaded.", {
        version: VERSION,
        build: BUILD
    });

})(
    typeof globalThis !== "undefined"
        ? globalThis
        : window
);
