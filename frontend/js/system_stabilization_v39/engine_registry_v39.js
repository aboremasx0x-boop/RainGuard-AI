/*
===============================================================================
 RainGuard AI
 Phase 39A-5 — Engine Registry

 File:
 frontend/js/system_stabilization_v39/engine_registry_v39.js

 Version:
 39A.5.0

 Purpose:
 - Central engine discovery and registration.
 - Detect modern + legacy RainGuard engine globals.
 - Normalize engine health/status.
 - Fix "Rain Arrival Engine: disconnected" when engine is actually loaded.
 - Provide one registry for Dashboard, Health Manager, Report, and Phase 40.
===============================================================================
*/

(function initializeRainGuardEngineRegistry(global) {
    "use strict";

    const NAME = "RainGuardEngineRegistryV39";
    const PHASE = "39A-5";
    const VERSION = "39A.5.0";
    const BUILD = "rainguard-v39-engine-registry";

    const DEFAULT_CONFIG = Object.freeze({
        enabled: true,

        autoDiscover: true,

        discoveryIntervalMs: 2000,

        maximumDiscoveryAttempts: 60,

        debug: true
    });

    const now = () => Date.now();

    function normalizeName(value) {
        return String(value || "").trim();
    }

    function clone(value) {
        if (
            value === null ||
            value === undefined
        ) {
            return value;
        }

        try {
            if (
                typeof structuredClone ===
                "function"
            ) {
                return structuredClone(value);
            }
        } catch (_) {}

        try {
            return JSON.parse(
                JSON.stringify(value)
            );
        } catch (_) {
            return value;
        }
    }

    function normalizeError(error) {
        if (!error) {
            return null;
        }

        return {
            name:
                error.name ||
                "Error",

            message:
                error.message ||
                String(error),

            code:
                error.code ||
                null,

            stack:
                error.stack ||
                null,

            timestamp:
                now(),

            timestampIso:
                new Date().toISOString()
        };
    }

    function getStateRepository() {
        return (
            global.RainGuardSystemStateRepository ||
            global.RainGuardAI?.V39
                ?.systemStateRepository ||
            null
        );
    }

    function safeGet(path) {
        try {
            const parts =
                String(path)
                    .split(".")
                    .filter(Boolean);

            let value = global;

            for (const part of parts) {
                if (
                    value === null ||
                    value === undefined
                ) {
                    return null;
                }

                value = value[part];
            }

            return value ?? null;

        } catch (_) {
            return null;
        }
    }

    const ENGINE_DEFINITIONS =
        Object.freeze([
            {
                id:
                    "rain-arrival",

                displayName:
                    "Rain Arrival Engine",

                paths: [
                    "RainArrivalEngineV32",
                    "RainGuardAI.V32.rainArrivalModularEngine",
                    "RainGuardAI.V32.rainArrivalPrediction",
                    "RainGuardPhase38M"
                ]
            },

            {
                id:
                    "storm-tracking",

                displayName:
                    "Storm Tracking Engine",

                paths: [
                    "RainGuardAI.V31.stormCellTracking",
                    "StormCellTrackingEngineV31",
                    "stormCellTrackingEngineV31"
                ]
            },

            {
                id:
                    "storm-path",

                displayName:
                    "Storm Path Prediction Engine",

                paths: [
                    "RainGuardAI.V31.stormPathPrediction",
                    "StormPathPredictionEngineV31",
                    "stormPathPredictionEngineV31"
                ]
            },

            {
                id:
                    "storm-visualization",

                displayName:
                    "Storm Visualization Engine",

                paths: [
                    "RainGuardAI.V31.stormVisualization",
                    "StormVisualizationEngineV31",
                    "stormVisualizationEngineV31"
                ]
            },

            {
                id:
                    "verification",

                displayName:
                    "Verification Engine",

                paths: [
                    "RainGuardAI.V30.verification",
                    "VerificationEngineV30",
                    "verificationEngineV30"
                ]
            },

            {
                id:
                    "forecast",

                displayName:
                    "Forecast Engine",

                paths: [
                    "RainGuardAI.V32.longHorizonForecast",
                    "LongHorizonForecastEngineV32",
                    "longHorizonForecastEngineV32"
                ]
            },

            {
                id:
                    "recovery-core",

                displayName:
                    "Recovery Core",

                paths: [
                    "RainGuardAI.V32.recoveryCore",
                    "RecoveryCoreV32",
                    "recoveryCoreV32"
                ]
            }
        ]);

    class EngineRegistryV39 {

        constructor(config = {}) {

            this.name = NAME;
            this.phase = PHASE;
            this.version = VERSION;
            this.build = BUILD;

            this.config = {
                ...DEFAULT_CONFIG,
                ...(config || {})
            };

            this.engines =
                new Map();

            this.statistics = {
                discoveryRuns: 0,
                discovered: 0,
                registrations: 0,
                updates: 0,
                missing: 0,
                failures: 0
            };

            this.discoveryTimer =
                null;

            this.discoveryAttempts =
                0;

            this.ready =
                true;

            this.log(
                "Engine Registry ready."
            );
        }

        log(message, data) {
            if (!this.config.debug) {
                return;
            }

            console.log(
                `[RainGuard][${PHASE}][EngineRegistry] ${message}`,
                data !== undefined
                    ? data
                    : ""
            );
        }

        warn(message, data) {
            console.warn(
                `[RainGuard][${PHASE}][EngineRegistry] ${message}`,
                data !== undefined
                    ? data
                    : ""
            );
        }

        error(message, data) {
            console.error(
                `[RainGuard][${PHASE}][EngineRegistry] ${message}`,
                data !== undefined
                    ? data
                    : ""
            );
        }

        resolveDefinition(
            definition
        ) {

            for (
                const path
                of definition.paths
            ) {

                const instance =
                    safeGet(path);

                if (instance) {

                    return {
                        found:
                            true,

                        path,

                        instance
                    };
                }
            }

            return {
                found:
                    false,

                path:
                    null,

                instance:
                    null
            };
        }

        detectStatus(
            instance
        ) {

            if (!instance) {

                return {
                    connected:
                        false,

                    ready:
                        false,

                    running:
                        false,

                    failed:
                        false,

                    healthy:
                        false,

                    status:
                        "disconnected"
                };
            }

            const ready =
                Boolean(
                    instance.ready ??
                    instance.initialized ??
                    true
                );

            const running =
                Boolean(
                    instance.running ??
                    instance.loading ??
                    false
                );

            const failed =
                Boolean(
                    instance.failed ??
                    false
                );

            let status =
                "connected";

            if (failed) {
                status =
                    "failed";

            } else if (running) {
                status =
                    "running";

            } else if (ready) {
                status =
                    "ready";
            }

            return {
                connected:
                    true,

                ready,

                running,

                failed,

                healthy:
                    !failed,

                status
            };
        }

        buildRecord(
            definition,
            discovery
        ) {

            const instance =
                discovery.instance;

            const health =
                this.detectStatus(
                    instance
                );

            return {
                id:
                    definition.id,

                displayName:
                    definition.displayName,

                connected:
                    health.connected,

                ready:
                    health.ready,

                running:
                    health.running,

                failed:
                    health.failed,

                healthy:
                    health.healthy,

                status:
                    health.status,

                resolvedPath:
                    discovery.path,

                instanceType:
                    instance
                        ? typeof instance
                        : null,

                version:
                    instance?.version ||
                    null,

                build:
                    instance?.build ||
                    null,

                phase:
                    instance?.phase ||
                    null,

                lastError:
                    instance?.lastError ||
                    null,

                discoveredAt:
                    now(),

                updatedAt:
                    now()
            };
        }

        syncWithStateRepository(
            record
        ) {

            const repository =
                getStateRepository();

            if (!repository) {
                return;
            }

            try {

                if (
                    typeof repository
                        .registerEngine ===
                    "function"
                ) {

                    repository
                        .registerEngine(
                            record.id,
                            {
                                phase:
                                    record.phase,

                                version:
                                    record.version,

                                source:
                                    record.resolvedPath,

                                status:
                                    record.status,

                                ready:
                                    record.ready,

                                running:
                                    record.running,

                                failed:
                                    record.failed,

                                healthy:
                                    record.healthy,

                                metadata: {
                                    displayName:
                                        record.displayName,

                                    connected:
                                        record.connected,

                                    resolvedPath:
                                        record.resolvedPath
                                }
                            }
                        );
                }

            } catch (error) {

                this.warn(
                    "State repository synchronization failed.",
                    normalizeError(
                        error
                    )
                );
            }
        }

        register(
            definition,
            discovery
        ) {

            const record =
                this.buildRecord(
                    definition,
                    discovery
                );

            const existing =
                this.engines.get(
                    definition.id
                );

            if (existing) {

                record.discoveredAt =
                    existing.discoveredAt;

                this.statistics
                    .updates += 1;

            } else {

                this.statistics
                    .registrations += 1;
            }

            this.engines.set(
                definition.id,
                record
            );

            this.syncWithStateRepository(
                record
            );

            return clone(record);
        }

        markMissing(
            definition
        ) {

            const existing =
                this.engines.get(
                    definition.id
                );

            const record = {
                id:
                    definition.id,

                displayName:
                    definition.displayName,

                connected:
                    false,

                ready:
                    false,

                running:
                    false,

                failed:
                    false,

                healthy:
                    false,

                status:
                    "disconnected",

                resolvedPath:
                    null,

                instanceType:
                    null,

                version:
                    existing?.version ||
                    null,

                build:
                    existing?.build ||
                    null,

                phase:
                    existing?.phase ||
                    null,

                lastError:
                    existing?.lastError ||
                    null,

                discoveredAt:
                    existing?.discoveredAt ||
                    null,

                updatedAt:
                    now()
            };

            this.engines.set(
                definition.id,
                record
            );

            this.statistics
                .missing += 1;

            this.syncWithStateRepository(
                record
            );

            return clone(record);
        }

        discoverOne(
            definition
        ) {

            const discovery =
                this.resolveDefinition(
                    definition
                );

            if (
                discovery.found
            ) {

                this.statistics
                    .discovered += 1;

                return this.register(
                    definition,
                    discovery
                );
            }

            return this.markMissing(
                definition
            );
        }

        discoverAll() {

            this.statistics
                .discoveryRuns += 1;

            const results = [];

            for (
                const definition
                of ENGINE_DEFINITIONS
            ) {

                try {

                    results.push(
                        this.discoverOne(
                            definition
                        )
                    );

                } catch (error) {

                    this.statistics
                        .failures += 1;

                    results.push({
                        id:
                            definition.id,

                        displayName:
                            definition
                                .displayName,

                        connected:
                            false,

                        status:
                            "error",

                        error:
                            normalizeError(
                                error
                            )
                    });
                }
            }

            this.discoveryAttempts += 1;

            return results;
        }

        startAutoDiscovery() {

            if (
                this.discoveryTimer
            ) {

                return {
                    started:
                        false,

                    reason:
                        "DISCOVERY_ALREADY_RUNNING"
                };
            }

            this.discoveryTimer =
                global.setInterval(
                    () => {

                        this.discoverAll();

                        if (
                            this.discoveryAttempts >=
                            this.config
                                .maximumDiscoveryAttempts
                        ) {

                            this.stopAutoDiscovery(
                                "MAXIMUM_DISCOVERY_ATTEMPTS"
                            );
                        }

                    },
                    this.config
                        .discoveryIntervalMs
                );

            return {
                started:
                    true
            };
        }

        stopAutoDiscovery(
            reason =
                "MANUAL_STOP"
        ) {

            if (
                this.discoveryTimer
            ) {

                global.clearInterval(
                    this.discoveryTimer
                );

                this.discoveryTimer =
                    null;
            }

            return {
                stopped:
                    true,

                reason
            };
        }

        getEngine(
            id
        ) {

            return clone(
                this.engines.get(
                    normalizeName(id)
                ) ||
                null
            );
        }

        getInstance(
            id
        ) {

            const record =
                this.engines.get(
                    normalizeName(id)
                );

            if (
                !record ||
                !record.resolvedPath
            ) {

                return null;
            }

            return safeGet(
                record.resolvedPath
            );
        }

        getRainArrival() {

            return this.getEngine(
                "rain-arrival"
            );
        }

        getRainArrivalInstance() {

            return this.getInstance(
                "rain-arrival"
            );
        }

        getAll() {

            return Array.from(
                this.engines.values()
            ).map(clone);
        }

        getConnected() {

            return this.getAll()
                .filter(
                    engine =>
                        engine.connected
                );
        }

        getDisconnected() {

            return this.getAll()
                .filter(
                    engine =>
                        !engine.connected
                );
        }

        getHealthSummary() {

            const engines =
                this.getAll();

            return {
                total:
                    engines.length,

                connected:
                    engines.filter(
                        engine =>
                            engine.connected
                    ).length,

                ready:
                    engines.filter(
                        engine =>
                            engine.ready
                    ).length,

                running:
                    engines.filter(
                        engine =>
                            engine.running
                    ).length,

                failed:
                    engines.filter(
                        engine =>
                            engine.failed
                    ).length,

                disconnected:
                    engines.filter(
                        engine =>
                            !engine.connected
                    ).length,

                rainArrival:
                    this.getRainArrival()
            };
        }

        getDiagnostics() {

            return {
                name:
                    NAME,

                phase:
                    PHASE,

                version:
                    VERSION,

                build:
                    BUILD,

                ready:
                    this.ready,

                autoDiscoveryRunning:
                    Boolean(
                        this.discoveryTimer
                    ),

                discoveryAttempts:
                    this.discoveryAttempts,

                statistics:
                    clone(
                        this.statistics
                    ),

                health:
                    this.getHealthSummary(),

                engines:
                    this.getAll()
            };
        }

        printDiagnostics() {

            const diagnostics =
                this.getDiagnostics();

            console.log(
                "[RainGuard Phase 39A-5] Engine Registry Diagnostics",
                diagnostics
            );

            if (
                diagnostics.engines.length
            ) {

                console.table(
                    diagnostics.engines
                );
            }

            return diagnostics;
        }

        selfTest() {

            const results = {};

            try {

                const discovered =
                    this.discoverAll();

                results.discoveryRan =
                    Array.isArray(
                        discovered
                    );

                results.engineCount =
                    discovered.length;

                const rainArrival =
                    this.getRainArrival();

                results.rainArrivalRecordExists =
                    Boolean(
                        rainArrival
                    );

                results.passed =
                    results.discoveryRan &&
                    results.engineCount > 0 &&
                    results
                        .rainArrivalRecordExists;

            } catch (error) {

                results.passed =
                    false;

                results.error =
                    normalizeError(
                        error
                    );
            }

            if (
                results.passed
            ) {

                console.log(
                    "%c[RainGuard Phase 39A-5] EngineRegistry SELF TEST PASSED",
                    "font-weight:bold;color:#16a34a;",
                    results
                );

            } else {

                console.error(
                    "[RainGuard Phase 39A-5] EngineRegistry SELF TEST FAILED",
                    results
                );
            }

            return results;
        }
    }

    const registry =
        new EngineRegistryV39();

    global.RainGuardEngineRegistryV39 =
        registry;

    global.RainGuardAI =
        global.RainGuardAI ||
        {};

    global.RainGuardAI.V39 =
        global.RainGuardAI.V39 ||
        {};

    global.RainGuardAI.V39
        .engineRegistry =
        registry;

    global.getRainGuardEngineRegistry =
        function () {

            return registry;
        };

    global.getRainGuardRainArrivalStatus =
        function () {

            registry.discoverAll();

            return registry
                .getRainArrival();
        };

    global.getRainGuardRainArrivalInstance =
        function () {

            registry.discoverAll();

            return registry
                .getRainArrivalInstance();
        };

    global.printRainGuardEngineRegistry =
        function () {

            registry.discoverAll();

            return registry
                .printDiagnostics();
        };

    global.testRainGuardEngineRegistry =
        function () {

            return registry
                .selfTest();
        };

    console.log(
        `%c[RainGuard AI] Phase ${PHASE} — Engine Registry v${VERSION} READY`,
        "font-weight:bold;color:#059669;"
    );

    /*
     * Run one immediate discovery.
     * This is lightweight and does not execute prediction engines.
     */
    registry.discoverAll();

    /*
     * Start temporary discovery so late-loaded engines are detected.
     */
    if (
        registry.config
            .autoDiscover
    ) {

        registry
            .startAutoDiscovery();
    }

})(
    typeof globalThis !==
        "undefined"
        ? globalThis
        : window
);
