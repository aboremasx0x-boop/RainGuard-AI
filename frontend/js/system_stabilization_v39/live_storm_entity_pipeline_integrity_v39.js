/*
===============================================================================
 RainGuard AI
 Phase 39A-10 — Live Storm Entity Pipeline Integrity
 File: live_storm_entity_pipeline_integrity_v39.js
 Version: 39A.10.0

 Purpose:
 - Verify integrity of the live-storm pipeline end-to-end.
 - Confirm that live entities can flow through:
     Source Adapter
       -> Storm Entity Collector
       -> StormTrackStore Bridge
       -> Live Storm Export Bridge
       -> Rain Arrival Prediction
 - Detect where entities disappear or become malformed.
 - Preserve existing engines; this phase is diagnostic + protective.
 - Expose one compact integrity report for Console testing.
===============================================================================
*/

(function initializeLiveStormEntityPipelineIntegrityV39(global) {
    "use strict";

    const NAME = "RainGuardLiveStormEntityPipelineIntegrityV39";
    const PHASE = "39A-10";
    const VERSION = "39A.10.0";
    const BUILD = "rainguard-v39-live-storm-entity-pipeline-integrity";

    const CONFIG = Object.freeze({
        autoStart: true,
        scanIntervalMs: 5000,
        maximumSampleSize: 50,
        debug: true
    });

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
            const keys = [
                "entities",
                "stormEntities",
                "liveStormEntities",
                "tracks",
                "stormTracks",
                "activeTracks",
                "cells",
                "stormCells",
                "items",
                "results",
                "result",
                "data",
                "payload",
                "output",
                "candidates",
                "predictions"
            ];

            for (const key of keys) {
                const nested = value?.[key];

                if (Array.isArray(nested)) {
                    return nested;
                }

                if (nested instanceof Map || nested instanceof Set) {
                    return Array.from(nested.values());
                }
            }
        }

        return [];
    }

    function finite(value) {
        const number = Number(value);
        return Number.isFinite(number) ? number : null;
    }

    function resolveSourceAdapter() {
        return (
            global.RainArrivalStormEntitySourceAdapterV32 ||
            global.RainGuardAI?.V32?.rainArrivalModules?.stormEntitySourceAdapter ||
            null
        );
    }

    function resolveCollector() {
        return (
            global.RainArrivalStormEntityCollectorV32 ||
            global.RainGuardAI?.V32?.rainArrivalModules?.stormEntityCollector ||
            null
        );
    }

    function resolveTrackStoreBridge() {
        return (
            global.RainArrivalStormTrackStoreBridgeV32 ||
            global.RainGuardAI?.V32?.rainArrivalModules?.stormTrackStoreBridge ||
            null
        );
    }

    function resolveLiveExportBridge() {
        return (
            global.RainArrivalLiveStormExportBridgeV32 ||
            global.RainGuardAI?.V32?.rainArrivalModules?.liveStormExportBridge ||
            null
        );
    }

    function resolveArrivalEngine() {
        return (
            global.RainArrivalEngineV32 ||
            global.RainGuardAI?.V32?.rainArrivalEngine ||
            null
        );
    }

    function inspectEntity(raw) {
        if (!raw || typeof raw !== "object") {
            return {
                valid: false,
                reason: "NOT_OBJECT",
                entity: raw
            };
        }

        const id =
            raw.id ??
            raw.trackId ??
            raw.cellId ??
            raw.stormId ??
            raw.entityId ??
            raw.uuid ??
            null;

        const latitude = finite(
            raw.latitude ??
            raw.lat ??
            raw.center?.latitude ??
            raw.center?.lat
        );

        const longitude = finite(
            raw.longitude ??
            raw.lon ??
            raw.lng ??
            raw.center?.longitude ??
            raw.center?.lon ??
            raw.center?.lng
        );

        const speed = finite(
            raw.speed ??
            raw.motion?.speed ??
            raw.velocity ??
            raw.motionVector?.speed
        );

        const direction = finite(
            raw.direction ??
            raw.bearing ??
            raw.motion?.direction ??
            raw.motionVector?.direction
        );

        const arrivalMinutes = finite(
            raw.arrivalMinutes ??
            raw.etaMinutes ??
            raw.arrival?.minutes ??
            raw.eta?.minutes
        );

        const hasIdentity = Boolean(id);
        const hasCoordinates =
            latitude !== null &&
            longitude !== null;

        const hasMotion =
            speed !== null ||
            direction !== null ||
            Boolean(raw.motion) ||
            Boolean(raw.motionVector);

        const hasArrival =
            arrivalMinutes !== null;

        return {
            valid:
                hasIdentity ||
                hasCoordinates,

            id:
                id !== null
                    ? String(id)
                    : null,

            latitude,
            longitude,
            speed,
            direction,
            arrivalMinutes,

            hasIdentity,
            hasCoordinates,
            hasMotion,
            hasArrival
        };
    }

    function summarizeEntities(entities) {
        const inspected =
            entities
                .slice(0, CONFIG.maximumSampleSize)
                .map(inspectEntity);

        const valid =
            inspected.filter(x => x.valid);

        const withCoordinates =
            valid.filter(x => x.hasCoordinates);

        const withMotion =
            valid.filter(x => x.hasMotion);

        const withArrival =
            valid.filter(x => x.hasArrival);

        return {
            total:
                entities.length,

            sampled:
                inspected.length,

            valid:
                valid.length,

            invalid:
                inspected.length - valid.length,

            withCoordinates:
                withCoordinates.length,

            withMotion:
                withMotion.length,

            withArrival:
                withArrival.length,

            coordinateCoverage:
                valid.length
                    ? Math.round(
                        (withCoordinates.length / valid.length) * 100
                    )
                    : 0,

            motionCoverage:
                valid.length
                    ? Math.round(
                        (withMotion.length / valid.length) * 100
                    )
                    : 0,

            arrivalCoverage:
                valid.length
                    ? Math.round(
                        (withArrival.length / valid.length) * 100
                    )
                    : 0
        };
    }

    class LiveStormEntityPipelineIntegrityV39 {
        constructor() {
            this.name = NAME;
            this.phase = PHASE;
            this.version = VERSION;
            this.build = BUILD;

            this.timer = null;
            this.running = false;

            this.lastReport = null;
            this.lastError = null;

            this.statistics = {
                scans: 0,
                healthyScans: 0,
                degradedScans: 0,
                failedScans: 0
            };
        }

        log(message, data) {
            if (!CONFIG.debug) return;

            console.log(
                `[RainGuard][${PHASE}][PipelineIntegrity] ${message}`,
                data !== undefined ? data : ""
            );
        }

        getSourceSnapshot(adapter) {
            if (!adapter) return [];

            const methods = [
                "getAll",
                "getEntities",
                "getStormEntities",
                "getLatest",
                "export"
            ];

            for (const method of methods) {
                if (typeof adapter?.[method] !== "function") {
                    continue;
                }

                try {
                    const result = adapter[method]();

                    if (
                        result &&
                        typeof result.then === "function"
                    ) {
                        continue;
                    }

                    const array = toArray(result);

                    if (array.length) {
                        return array;
                    }
                } catch (_) {}
            }

            const props = [
                "entities",
                "stormEntities",
                "lastResult",
                "lastOutput",
                "data",
                "payload"
            ];

            for (const prop of props) {
                const array = toArray(adapter?.[prop]);

                if (array.length) {
                    return array;
                }
            }

            return [];
        }

        getCollectorSnapshot(collector) {
            if (!collector) return [];

            try {
                if (typeof collector.getAll === "function") {
                    return toArray(
                        collector.getAll()
                    );
                }
            } catch (_) {}

            if (collector.entities instanceof Map) {
                return Array.from(
                    collector.entities.values()
                );
            }

            return toArray(
                collector.lastResult?.entities ??
                collector.entities
            );
        }

        getBridgeSnapshot(bridge) {
            if (!bridge) return [];

            try {
                if (typeof bridge.discover === "function") {
                    return toArray(
                        bridge.discover()
                    );
                }
            } catch (_) {}

            return toArray(
                bridge.lastResult ??
                bridge.entities ??
                bridge.tracks
            );
        }

        getExportSnapshot(exportBridge) {
            if (!exportBridge) return [];

            const methods = [
                "getAll",
                "getEntities",
                "getLatest",
                "export"
            ];

            for (const method of methods) {
                if (typeof exportBridge?.[method] !== "function") {
                    continue;
                }

                try {
                    const result =
                        exportBridge[method]();

                    if (
                        result &&
                        typeof result.then === "function"
                    ) {
                        continue;
                    }

                    const array =
                        toArray(result);

                    if (array.length) {
                        return array;
                    }
                } catch (_) {}
            }

            return toArray(
                exportBridge.lastResult ??
                exportBridge.lastOutput ??
                exportBridge.entities ??
                exportBridge.liveStormEntities
            );
        }

        getArrivalSnapshot(engine) {
            if (!engine) {
                return {
                    available: false,
                    arrivalMinutes: null,
                    status: null
                };
            }

            const possibleStates = [
                engine.lastResult,
                engine.lastPrediction,
                engine.state,
                engine.status,
                global.RainGuardAI?.V32?.rainArrivalState
            ];

            let arrivalMinutes = null;
            let status = null;

            for (const item of possibleStates) {
                if (!item || typeof item !== "object") {
                    continue;
                }

                if (arrivalMinutes === null) {
                    arrivalMinutes = finite(
                        item.arrivalMinutes ??
                        item.etaMinutes ??
                        item.arrival?.minutes ??
                        item.eta?.minutes
                    );
                }

                if (!status) {
                    status =
                        item.status ??
                        item.state ??
                        null;
                }
            }

            return {
                available: true,
                arrivalMinutes,
                status
            };
        }

        scan() {
            this.statistics.scans += 1;

            const sourceAdapter =
                resolveSourceAdapter();

            const collector =
                resolveCollector();

            const bridge =
                resolveTrackStoreBridge();

            const exportBridge =
                resolveLiveExportBridge();

            const arrivalEngine =
                resolveArrivalEngine();

            try {
                const sourceEntities =
                    this.getSourceSnapshot(
                        sourceAdapter
                    );

                const collectorEntities =
                    this.getCollectorSnapshot(
                        collector
                    );

                const bridgeEntities =
                    this.getBridgeSnapshot(
                        bridge
                    );

                const exportEntities =
                    this.getExportSnapshot(
                        exportBridge
                    );

                const arrival =
                    this.getArrivalSnapshot(
                        arrivalEngine
                    );

                const sourceSummary =
                    summarizeEntities(
                        sourceEntities
                    );

                const collectorSummary =
                    summarizeEntities(
                        collectorEntities
                    );

                const bridgeSummary =
                    summarizeEntities(
                        bridgeEntities
                    );

                const exportSummary =
                    summarizeEntities(
                        exportEntities
                    );

                const stages = {
                    sourceAdapter: {
                        available:
                            Boolean(sourceAdapter),
                        count:
                            sourceEntities.length,
                        summary:
                            sourceSummary
                    },

                    collector: {
                        available:
                            Boolean(collector),
                        count:
                            collectorEntities.length,
                        summary:
                            collectorSummary
                    },

                    trackStoreBridge: {
                        available:
                            Boolean(bridge),
                        count:
                            bridgeEntities.length,
                        summary:
                            bridgeSummary
                    },

                    liveExportBridge: {
                        available:
                            Boolean(exportBridge),
                        count:
                            exportEntities.length,
                        summary:
                            exportSummary
                    },

                    arrivalEngine: {
                        available:
                            Boolean(arrivalEngine),
                        arrivalMinutes:
                            arrival.arrivalMinutes,
                        status:
                            arrival.status
                    }
                };

                const requiredAvailable =
                    stages.collector.available &&
                    stages.trackStoreBridge.available &&
                    stages.liveExportBridge.available &&
                    stages.arrivalEngine.available;

                const hasAnyEntities =
                    sourceEntities.length > 0 ||
                    collectorEntities.length > 0 ||
                    bridgeEntities.length > 0 ||
                    exportEntities.length > 0;

                const flowBreaks = [];

                if (
                    sourceEntities.length > 0 &&
                    collectorEntities.length === 0
                ) {
                    flowBreaks.push(
                        "SOURCE_TO_COLLECTOR_BREAK"
                    );
                }

                if (
                    collectorEntities.length > 0 &&
                    bridgeEntities.length === 0
                ) {
                    flowBreaks.push(
                        "COLLECTOR_TO_TRACKSTORE_BREAK"
                    );
                }

                if (
                    bridgeEntities.length > 0 &&
                    exportEntities.length === 0
                ) {
                    flowBreaks.push(
                        "TRACKSTORE_TO_EXPORT_BREAK"
                    );
                }

                if (
                    exportEntities.length > 0 &&
                    arrival.arrivalMinutes === null
                ) {
                    flowBreaks.push(
                        "EXPORT_TO_ARRIVAL_ETA_MISSING"
                    );
                }

                let status;

                if (!requiredAvailable) {
                    status =
                        "PIPELINE_COMPONENT_MISSING";

                    this.statistics.failedScans += 1;

                } else if (flowBreaks.length > 0) {
                    status =
                        "PIPELINE_DEGRADED";

                    this.statistics.degradedScans += 1;

                } else if (!hasAnyEntities) {
                    status =
                        "PIPELINE_READY_NO_LIVE_ENTITIES";

                    this.statistics.healthyScans += 1;

                } else {
                    status =
                        "PIPELINE_INTEGRITY_OK";

                    this.statistics.healthyScans += 1;
                }

                const report = {
                    success:
                        status !==
                        "PIPELINE_COMPONENT_MISSING",

                    phase:
                        PHASE,

                    version:
                        VERSION,

                    status,

                    stages,

                    flowBreaks,

                    entityFlow: {
                        source:
                            sourceEntities.length,

                        collector:
                            collectorEntities.length,

                        trackStore:
                            bridgeEntities.length,

                        exported:
                            exportEntities.length,

                        arrivalMinutes:
                            arrival.arrivalMinutes
                    },

                    generatedAt:
                        now()
                };

                this.lastReport =
                    report;

                this.lastError =
                    null;

                return report;

            } catch (error) {
                const normalized =
                    normalizeError(error);

                this.lastError =
                    normalized;

                this.statistics.failedScans += 1;

                const report = {
                    success: false,
                    phase: PHASE,
                    version: VERSION,
                    status:
                        "PIPELINE_INTEGRITY_SCAN_FAILED",
                    error:
                        normalized,
                    generatedAt:
                        now()
                };

                this.lastReport =
                    report;

                return report;
            }
        }

        start() {
            if (this.running) {
                return {
                    success: true,
                    alreadyRunning: true
                };
            }

            this.running = true;

            this.scan();

            this.timer =
                global.setInterval(
                    () => {
                        this.scan();
                    },
                    CONFIG.scanIntervalMs
                );

            return {
                success: true,
                running: true,
                intervalMs:
                    CONFIG.scanIntervalMs
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
                running: false
            };
        }

        diagnose() {
            const report =
                this.scan();

            const diagnostics = {
                phase:
                    PHASE,

                version:
                    VERSION,

                build:
                    BUILD,

                running:
                    this.running,

                lastError:
                    this.lastError,

                statistics:
                    {
                        ...this.statistics
                    },

                report
            };

            console.log(
                "[RainGuard Phase 39A-10] Live Storm Entity Pipeline Integrity",
                diagnostics
            );

            return diagnostics;
        }
    }

    const integrity =
        new LiveStormEntityPipelineIntegrityV39();

    global.RainGuardLiveStormEntityPipelineIntegrityV39 =
        integrity;

    global.RainGuardAI =
        global.RainGuardAI || {};

    global.RainGuardAI.V39 =
        global.RainGuardAI.V39 || {};

    global.RainGuardAI.V39
        .liveStormEntityPipelineIntegrity =
        integrity;

    global.diagnoseRainGuardLiveStormPipeline =
        () =>
            integrity.diagnose();

    global.getRainGuardLiveStormPipelineReport =
        () =>
            integrity.scan();

    console.log(
        `[RainGuard AI] Phase ${PHASE} — Live Storm Entity Pipeline Integrity v${VERSION} READY`
    );

    if (CONFIG.autoStart) {
        integrity.start();
    }

})(
    typeof globalThis !== "undefined"
        ? globalThis
        : window
);
