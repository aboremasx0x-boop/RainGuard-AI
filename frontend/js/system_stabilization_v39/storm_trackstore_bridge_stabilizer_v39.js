/*
===============================================================================
 RainGuard AI
 Phase 39A-9 — StormTrackStore Bridge Stabilization
 File: storm_trackstore_bridge_stabilizer_v39.js
 Version: 39A.9.0
===============================================================================
*/
(function (global) {
    "use strict";

    const VERSION = "39A.9.0";
    const now = () => Date.now();

    function errObj(error) {
        return {
            name: error?.name || "Error",
            message: error?.message || String(error),
            stack: error?.stack || null,
            timestamp: now()
        };
    }

    function toArray(value) {
        if (!value) return [];
        if (Array.isArray(value)) return value;
        if (value instanceof Map || value instanceof Set) return Array.from(value.values());

        if (typeof value === "object") {
            for (const key of [
                "entities","items","tracks","stormTracks","activeTracks",
                "cells","stormCells","activeCells","data","result","results",
                "payload","output"
            ]) {
                const nested = value[key];
                if (Array.isArray(nested)) return nested;
                if (nested instanceof Map || nested instanceof Set) {
                    return Array.from(nested.values());
                }
            }
        }

        return [];
    }

    function bridge() {
        return (
            global.RainArrivalStormTrackStoreBridgeV32 ||
            global.RainGuardAI?.V32?.rainArrivalModules?.stormTrackStoreBridge ||
            null
        );
    }

    function collector() {
        return (
            global.RainArrivalStormEntityCollectorV32 ||
            global.RainGuardAI?.V32?.rainArrivalModules?.stormEntityCollector ||
            null
        );
    }

    const state = {
        installed: false,
        syncRunning: false,
        lastSyncAt: null,
        lastDurationMs: null,
        lastError: null,
        stats: {
            syncCalls: 0,
            syncCompleted: 0,
            syncSkipped: 0,
            syncFailures: 0,
            discoverCalls: 0
        }
    };

    function install() {
        const b = bridge();

        if (!b) {
            return {
                success: false,
                reason: "STORM_TRACKSTORE_BRIDGE_NOT_AVAILABLE"
            };
        }

        if (b.__rainGuard39A9Installed) {
            state.installed = true;
            return {
                success: true,
                alreadyInstalled: true,
                version: VERSION
            };
        }

        const originalDiscover =
            typeof b.discover === "function"
                ? b.discover.bind(b)
                : null;

        const originalSync =
            typeof b.sync === "function"
                ? b.sync.bind(b)
                : null;

        b.discover = function () {
            state.stats.discoverCalls += 1;

            const c = collector();

            if (c && typeof c.collect === "function") {
                try {
                    const result = c.collect();
                    const entities = toArray(result?.entities);

                    if (entities.length > 0) {
                        return entities;
                    }
                } catch (error) {
                    state.lastError = errObj(error);
                }
            }

            if (originalDiscover) {
                try {
                    return toArray(originalDiscover());
                } catch (error) {
                    state.lastError = errObj(error);
                }
            }

            return [];
        };

        b.discover.__rainGuard39A9Wrapped = true;

        b.sync = async function (...args) {
            state.stats.syncCalls += 1;

            if (state.syncRunning) {
                state.stats.syncSkipped += 1;

                return {
                    success: true,
                    skipped: true,
                    status: "STORM_TRACKSTORE_SYNC_ALREADY_RUNNING",
                    generatedAt: now()
                };
            }

            state.syncRunning = true;
            const started = now();

            try {
                const entities = b.discover();

                if (!Array.isArray(entities)) {
                    throw new Error("discover() returned non-array");
                }

                if (entities.length === 0) {
                    const empty = {
                        success: true,
                        status: "NO_LIVE_STORM_ENTITIES",
                        discovered: 0,
                        generatedAt: now()
                    };

                    state.stats.syncCompleted += 1;
                    state.lastSyncAt = now();

                    return empty;
                }

                let result;

                if (originalSync) {
                    result = await originalSync(...args);
                } else {
                    result = {
                        success: true,
                        status: "STORM_TRACKSTORE_SYNC_COMPLETED",
                        discovered: entities.length
                    };
                }

                state.stats.syncCompleted += 1;
                state.lastSyncAt = now();
                state.lastError = null;

                if (result && typeof result === "object") {
                    return {
                        success: result.success !== false,
                        ...result,
                        discovered:
                            Number.isFinite(Number(result.discovered))
                                ? Number(result.discovered)
                                : entities.length,
                        generatedAt: result.generatedAt || now()
                    };
                }

                return {
                    success: true,
                    status: "STORM_TRACKSTORE_SYNC_COMPLETED",
                    discovered: entities.length,
                    result,
                    generatedAt: now()
                };

            } catch (error) {
                const normalized = errObj(error);

                state.lastError = normalized;
                state.stats.syncFailures += 1;

                console.error(
                    "[RainGuard Phase 39A-9] StormTrackStoreBridge sync failed.",
                    normalized
                );

                return {
                    success: false,
                    status: "STORM_TRACKSTORE_SYNC_FAILED",
                    error: normalized,
                    generatedAt: now()
                };

            } finally {
                state.lastDurationMs = now() - started;
                state.syncRunning = false;
            }
        };

        b.sync.__rainGuard39A9Wrapped = true;
        b.__rainGuard39A9Installed = true;
        b.__rainGuard39A9Version = VERSION;

        state.installed = true;

        return {
            success: true,
            installed: true,
            version: VERSION
        };
    }

    function diagnose() {
        const b = bridge();
        const c = collector();

        const result = {
            phase: "39A-9",
            version: VERSION,
            installed: Boolean(b?.__rainGuard39A9Installed),
            bridgeAvailable: Boolean(b),
            collectorAvailable: Boolean(c),
            discoverWrapped: Boolean(b?.discover?.__rainGuard39A9Wrapped),
            syncWrapped: Boolean(b?.sync?.__rainGuard39A9Wrapped),
            syncRunning: state.syncRunning,
            lastSyncAt: state.lastSyncAt,
            lastDurationMs: state.lastDurationMs,
            lastError: state.lastError,
            statistics: { ...state.stats }
        };

        console.log(
            "[RainGuard Phase 39A-9] StormTrackStore Bridge Diagnostics",
            result
        );

        return result;
    }

    global.RainGuardStormTrackStoreBridgeStabilizerV39 = {
        version: VERSION,
        install,
        diagnose,
        state
    };

    global.installRainGuardStormTrackStoreBridgeStabilizer = install;
    global.diagnoseRainGuardStormTrackStoreBridge = diagnose;

    const immediate = install();

    if (!immediate.success) {
        let attempts = 0;

        const timer = global.setInterval(() => {
            attempts += 1;

            const result = install();

            if (result.success || attempts >= 40) {
                global.clearInterval(timer);
            }
        }, 500);
    }

    console.log(
        `[RainGuard AI] Phase 39A-9 — StormTrackStore Bridge Stabilization v${VERSION} READY`,
        immediate
    );

})(
    typeof globalThis !== "undefined"
        ? globalThis
        : window
);
