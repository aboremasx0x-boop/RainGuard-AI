/*
===============================================================================
 RainGuard AI V32 / Phase 39 Stabilization
 Storm Entity Collector Runtime Hotfix
 Version: 39A8-HF1

 Purpose:
 - Prevent "Cannot read properties of undefined (reading 'length')"
 - Normalize bridge.discover() output to an Array
 - Prevent overlapping collectAndSync() executions
 - Prevent Uncaught (in promise) from scheduled collection
 - Keep the existing StormEntityCollector implementation intact

 IMPORTANT:
 Load this file AFTER:
   storm_entity_collector.js
 and AFTER the Rain Arrival 38M modules are loaded.
===============================================================================
*/

(function installStormEntityCollectorHotfix(global) {
    "use strict";

    const HOTFIX_NAME = "RainGuardStormEntityCollectorHotfixV39";
    const VERSION = "39A8-HF1";
    const BUILD = "rainguard-v39-storm-entity-collector-hotfix";

    const now = () => Date.now();

    function normalizeError(error) {
        return {
            name: error?.name || "Error",
            message: error?.message || String(error),
            stack: error?.stack || null,
            timestamp: now()
        };
    }

    function toArray(value) {
        if (!value) return [];

        if (Array.isArray(value)) {
            return value;
        }

        if (value instanceof Map || value instanceof Set) {
            return Array.from(value.values());
        }

        if (typeof value.values === "function") {
            try {
                return Array.from(value.values());
            } catch (_) {}
        }

        if (typeof value === "object") {
            /*
             * Only unwrap known collection envelopes.
             * Avoid Object.values() on arbitrary diagnostic objects,
             * because StormTrackStoreBridge expects actual entities.
             */
            const keys = [
                "entities",
                "items",
                "tracks",
                "stormTracks",
                "cells",
                "stormCells",
                "activeCells",
                "activeTracks",
                "predictedPaths",
                "paths",
                "candidates",
                "data",
                "result",
                "payload"
            ];

            for (const key of keys) {
                if (Array.isArray(value?.[key])) {
                    return value[key];
                }

                if (value?.[key] instanceof Map || value?.[key] instanceof Set) {
                    return Array.from(value[key].values());
                }
            }
        }

        return [];
    }

    function resolveCollector() {
        return (
            global.RainArrivalStormEntityCollectorV32 ||
            global.RainGuardAI?.V32?.rainArrivalModules?.stormEntityCollector ||
            null
        );
    }

    function resolveBridge(collector) {
        if (collector && typeof collector.getBridge === "function") {
            try {
                const bridge = collector.getBridge();
                if (bridge) return bridge;
            } catch (_) {}
        }

        return (
            global.RainArrivalStormTrackStoreBridgeV32 ||
            global.RainGuardAI?.V32?.rainArrivalModules?.stormTrackStoreBridge ||
            null
        );
    }

    function patchCollector(collector) {
        if (!collector) {
            return {
                success: false,
                reason: "STORM_ENTITY_COLLECTOR_NOT_FOUND"
            };
        }

        if (collector.__rainGuardPhase39HotfixInstalled) {
            return {
                success: true,
                alreadyInstalled: true,
                version: VERSION
            };
        }

        /*
         * 1) Add overlap state used by collectAndSync protection.
         */
        if (typeof collector.syncRunning !== "boolean") {
            collector.syncRunning = false;
        }

        /*
         * 2) Preserve original methods.
         */
        const originalInstallBridgeAdapter =
            typeof collector.installBridgeAdapter === "function"
                ? collector.installBridgeAdapter.bind(collector)
                : null;

        const originalCollect =
            typeof collector.collect === "function"
                ? collector.collect.bind(collector)
                : null;

        const originalStop =
            typeof collector.stop === "function"
                ? collector.stop.bind(collector)
                : null;

        /*
         * 3) Safe Bridge Adapter.
         *
         * The original implementation assumes:
         *     collected.entities.length
         *
         * This hotfix guarantees an array and also guarantees that the
         * fallback bridge.discover() result is an array.
         */
        collector.installBridgeAdapter = function () {
            const bridge = resolveBridge(this);

            if (!bridge) {
                return {
                    success: false,
                    reason: "STORM_TRACKSTORE_BRIDGE_UNAVAILABLE"
                };
            }

            /*
             * If our safe adapter is already installed, do nothing.
             */
            if (bridge.__rainGuardSafeCollectorAdapterInstalled) {
                bridge.stormEntityCollector = this;

                return {
                    success: true,
                    alreadyInstalled: true,
                    safeAdapter: true
                };
            }

            /*
             * If the original collector adapter was previously installed,
             * bridge.discover may already be the collector wrapper.
             * Preserve it only as a final fallback when it is not our wrapper.
             */
            const previousDiscover =
                typeof bridge.discover === "function"
                    ? bridge.discover.bind(bridge)
                    : null;

            const collectorRef = this;

            bridge.discover = function safeStormEntityDiscover() {
                let collected = null;

                try {
                    collected =
                        typeof collectorRef.collect === "function"
                            ? collectorRef.collect()
                            : null;
                } catch (error) {
                    collectorRef.lastError = normalizeError(error);
                }

                const entities = Array.isArray(collected?.entities)
                    ? collected.entities
                    : toArray(collected?.entities);

                if (entities.length > 0) {
                    return entities;
                }

                /*
                 * Try published collector state before invoking legacy fallback.
                 */
                const published =
                    global.RainGuardAI?.V32?.stormEntityCollectorState?.entities ??
                    global.RainGuardAI?.V32?.stormEntities ??
                    null;

                const publishedEntities = toArray(published);

                if (publishedEntities.length > 0) {
                    return publishedEntities;
                }

                /*
                 * Calling a previousDiscover that is itself the old collector
                 * adapter can recurse. Skip known collector wrappers.
                 */
                if (
                    previousDiscover &&
                    !previousDiscover.__rainGuardSafeCollectorDiscover
                ) {
                    try {
                        const fallback = previousDiscover();
                        return toArray(fallback);
                    } catch (error) {
                        collectorRef.lastError = normalizeError(error);
                    }
                }

                return [];
            };

            bridge.discover.__rainGuardSafeCollectorDiscover = true;

            bridge.__collectorAdapterInstalled = true;
            bridge.__rainGuardSafeCollectorAdapterInstalled = true;
            bridge.stormEntityCollector = this;

            return {
                success: true,
                installed: true,
                safeAdapter: true
            };
        };

        /*
         * 4) Safe non-overlapping collectAndSync.
         */
        collector.collectAndSync = async function () {
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
                const collection =
                    typeof this.collect === "function"
                        ? this.collect()
                        : {
                            success: false,
                            entities: []
                        };

                const bridge = resolveBridge(this);

                if (!bridge || typeof bridge.sync !== "function") {
                    return {
                        success: false,
                        reason: "STORM_TRACKSTORE_BRIDGE_UNAVAILABLE",
                        collection,
                        generatedAt: now()
                    };
                }

                this.installBridgeAdapter();

                const syncResult = await bridge.sync();

                if (this.statistics && typeof this.statistics === "object") {
                    this.statistics.bridgeSyncs =
                        Number(this.statistics.bridgeSyncs || 0) + 1;
                }

                this.lastError = null;

                return {
                    success: Boolean(syncResult?.success),
                    status: "COLLECTION_AND_SYNC_COMPLETED",
                    collection,
                    syncResult,
                    generatedAt: now()
                };
            } catch (error) {
                const normalized = normalizeError(error);

                this.lastError = normalized;

                if (this.statistics && typeof this.statistics === "object") {
                    this.statistics.failures =
                        Number(this.statistics.failures || 0) + 1;
                }

                console.error(
                    "[RainArrival StormEntityCollector Hotfix] collectAndSync failed.",
                    normalized
                );

                /*
                 * Return a controlled failure instead of allowing an
                 * unhandled rejected promise to flood DevTools.
                 */
                return {
                    success: false,
                    status: "COLLECTION_AND_SYNC_FAILED",
                    error: normalized,
                    generatedAt: now()
                };
            } finally {
                this.syncRunning = false;
            }
        };

        /*
         * 5) Replace the legacy auto-loop with one timer only.
         * We keep the existing configured interval but prevent duplicate
         * interval creation and catch every scheduled promise.
         */
        collector.start = function () {
            if (this.running && this.timer) {
                return {
                    success: true,
                    alreadyRunning: true,
                    running: true,
                    intervalMs: this.config?.collectionIntervalMs ?? 4000
                };
            }

            /*
             * Clear a stale timer before creating the new one.
             */
            if (this.timer) {
                try {
                    global.clearInterval(this.timer);
                } catch (_) {}
                this.timer = null;
            }

            this.running = true;

            try {
                this.installBridgeAdapter();
            } catch (error) {
                this.lastError = normalizeError(error);
            }

            Promise.resolve(this.collectAndSync())
                .catch(error => {
                    this.lastError = normalizeError(error);

                    console.error(
                        "[RainArrival StormEntityCollector Hotfix] Initial collectAndSync failed.",
                        error
                    );
                });

            const intervalMs =
                Number(this.config?.collectionIntervalMs) > 0
                    ? Number(this.config.collectionIntervalMs)
                    : 4000;

            this.timer = global.setInterval(
                () => {
                    Promise.resolve(this.collectAndSync())
                        .catch(error => {
                            this.lastError = normalizeError(error);

                            console.error(
                                "[RainArrival StormEntityCollector Hotfix] Scheduled collectAndSync failed.",
                                error
                            );
                        });
                },
                intervalMs
            );

            return {
                success: true,
                running: true,
                intervalMs
            };
        };

        /*
         * 6) Safe stop keeps compatibility with the original collector.
         */
        collector.stop = function () {
            if (this.timer) {
                try {
                    global.clearInterval(this.timer);
                } catch (_) {}
            }

            this.timer = null;
            this.running = false;
            this.syncRunning = false;

            return {
                success: true,
                running: false
            };
        };

        collector.__rainGuardPhase39HotfixInstalled = true;
        collector.__rainGuardPhase39HotfixVersion = VERSION;

        /*
         * Reinstall bridge adapter immediately.
         */
        try {
            collector.installBridgeAdapter();
        } catch (error) {
            collector.lastError = normalizeError(error);
        }

        /*
         * Restart only if the collector was already intended to auto-run.
         * This removes the old timer and starts exactly one protected timer.
         */
        const shouldRun =
            collector.running === true ||
            collector.config?.autoStart === true;

        if (originalStop) {
            try {
                originalStop();
            } catch (_) {}
        } else if (collector.timer) {
            try {
                global.clearInterval(collector.timer);
            } catch (_) {}
            collector.timer = null;
        }

        collector.running = false;
        collector.syncRunning = false;

        if (shouldRun) {
            collector.start();
        }

        return {
            success: true,
            installed: true,
            version: VERSION,
            build: BUILD,
            running: collector.running,
            intervalMs: collector.config?.collectionIntervalMs ?? null
        };
    }

    function install() {
        const collector = resolveCollector();

        if (!collector) {
            return {
                success: false,
                reason: "STORM_ENTITY_COLLECTOR_NOT_AVAILABLE"
            };
        }

        return patchCollector(collector);
    }

    global.RainGuardStormEntityCollectorHotfixV39 = {
        name: HOTFIX_NAME,
        version: VERSION,
        build: BUILD,
        install,
        diagnose() {
            const collector = resolveCollector();
            const bridge = resolveBridge(collector);

            const result = {
                installed:
                    Boolean(collector?.__rainGuardPhase39HotfixInstalled),

                version:
                    collector?.__rainGuardPhase39HotfixVersion ?? null,

                collectorAvailable:
                    Boolean(collector),

                bridgeAvailable:
                    Boolean(bridge),

                running:
                    Boolean(collector?.running),

                syncRunning:
                    Boolean(collector?.syncRunning),

                timerActive:
                    Boolean(collector?.timer),

                storedCount:
                    collector?.entities instanceof Map
                        ? collector.entities.size
                        : null,

                lastError:
                    collector?.lastError ?? null,

                bridgeSafeAdapter:
                    Boolean(bridge?.__rainGuardSafeCollectorAdapterInstalled)
            };

            console.log(
                "[RainGuard Phase 39 StormEntityCollector Hotfix]",
                result
            );

            return result;
        }
    };

    global.installRainGuardStormEntityCollectorHotfix =
        () => install();

    global.diagnoseRainGuardStormEntityCollectorHotfix =
        () =>
            global.RainGuardStormEntityCollectorHotfixV39
                .diagnose();

    /*
     * Install immediately if the collector already exists.
     * Otherwise retry for a short bounded period because this file may be
     * loaded just after index.js while modular scripts are still registering.
     */
    const immediate = install();

    if (!immediate.success) {
        let attempts = 0;

        const retryTimer = global.setInterval(
            () => {
                attempts += 1;

                const result = install();

                if (result.success || attempts >= 30) {
                    global.clearInterval(retryTimer);
                }
            },
            500
        );
    }

    console.log(
        `[RainGuard AI] Storm Entity Collector Hotfix ${VERSION} READY`,
        immediate
    );

})(
    typeof globalThis !== "undefined"
        ? globalThis
        : window
);
