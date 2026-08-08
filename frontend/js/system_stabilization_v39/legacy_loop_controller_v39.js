/*
===============================================================================
 RainGuard AI
 Phase 39A-8 — Legacy Loop Controller

 File:
 frontend/js/system_stabilization_v39/legacy_loop_controller_v39.js

 Version:
 39A.8.1

 Purpose:
 - Contain legacy repetitive engines without rewriting them immediately.
 - Detect known Rain Arrival legacy modules using their real global names.
 - Wrap safe execution methods with cooldown/re-entry protection.
 - Attempt pause/stop when excessive activity is detected.
 - Integrate with Phase 39 Timer/Runtime/Loop protection.
 - Avoid global monkey-patching of setInterval/setTimeout.
===============================================================================
*/

(function initializeRainGuardLegacyLoopController(global) {
    "use strict";

    const NAME = "RainGuardLegacyLoopControllerV39";
    const PHASE = "39A-8";
    const VERSION = "39A.8.1";
    const BUILD = "rainguard-v39-legacy-loop-controller-fix1";

    const CONFIG = Object.freeze({
        enabled: true,
        scanIntervalMs: 2000,
        minimumInvocationGapMs: 1200,
        observationWindowMs: 10000,
        warningThreshold: 8,
        blockThreshold: 15,
        blockDurationMs: 15000,
        maximumRunningMs: 30000,
        autoContain: true,
        autoStart: true,
        debug: true
    });

    const TARGETS = Object.freeze([
        {
            id: "storm-entity-collector",
            displayName: "StormEntityCollector",
            paths: ["RainArrivalStormEntityCollectorV32"]
        },
        {
            id: "storm-trackstore-bridge",
            displayName: "StormTrackStoreBridge",
            paths: ["RainArrivalStormTrackStoreBridgeV32"]
        },
        {
            id: "live-storm-export-bridge",
            displayName: "LiveStormExportBridge",
            paths: ["RainArrivalLiveStormExportBridgeV32"]
        },
        {
            id: "storm-entity-source-adapter",
            displayName: "StormEntitySourceAdapter",
            paths: ["RainArrivalStormEntitySourceAdapterV32"]
        },
        {
            id: "candidate-scoring",
            displayName: "CandidateScoring",
            paths: ["RainArrivalCandidateScoringV32"]
        }
    ]);

    const EXECUTION_METHODS = Object.freeze([
        "run", "execute", "refresh", "sync", "collect", "capture",
        "process", "evaluate", "scan", "update", "runCycle",
        "executeCycle", "score", "rank", "publish"
    ]);

    const STOP_METHODS = Object.freeze([
        "stop", "pause", "shutdown", "disable",
        "stopAutoRefresh", "stopAutoSync",
        "stopMonitoring", "stopLoop"
    ]);

    const now = () => Date.now();

    function normalizeName(value) {
        return String(value || "").trim();
    }

    function clone(value) {
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

    function safeGet(path) {
        try {
            const parts = String(path).split(".").filter(Boolean);
            let current = global;
            for (const part of parts) {
                if (current === null || current === undefined) return null;
                current = current[part];
            }
            return current ?? null;
        } catch (_) {
            return null;
        }
    }

    function getTimerManager() {
        return (
            global.RainGuardTimerManagerV39 ||
            global.RainGuardAI?.V39?.timerManager ||
            null
        );
    }

    class LegacyLoopControllerV39 {
        constructor() {
            this.name = NAME;
            this.phase = PHASE;
            this.version = VERSION;
            this.build = BUILD;
            this.config = { ...CONFIG };
            this.targets = new Map();
            this.scanTimerName = "phase39a8-legacy-loop-scan";
            this.scanTimer = null;
            this.started = false;

            this.statistics = {
                scans: 0,
                discovered: 0,
                wrappedMethods: 0,
                invocationAttempts: 0,
                invocationAccepted: 0,
                invocationBlocked: 0,
                reentryBlocked: 0,
                rateBlocked: 0,
                containmentActions: 0,
                containmentSuccess: 0,
                containmentFailures: 0
            };

            this.ready = true;
            this.log("Legacy Loop Controller ready.");
        }

        log(message, data) {
            if (!this.config.debug) return;
            console.log(
                `[RainGuard][${PHASE}][LegacyLoopController] ${message}`,
                data !== undefined ? data : ""
            );
        }

        warn(message, data) {
            console.warn(
                `[RainGuard][${PHASE}][LegacyLoopController] ${message}`,
                data !== undefined ? data : ""
            );
        }

        error(message, data) {
            console.error(
                `[RainGuard][${PHASE}][LegacyLoopController] ${message}`,
                data !== undefined ? data : ""
            );
        }

        resolveTarget(definition) {
            for (const path of definition.paths) {
                const instance = safeGet(path);
                if (
                    instance &&
                    (typeof instance === "object" || typeof instance === "function")
                ) {
                    return { found: true, path, instance };
                }
            }
            return { found: false, path: null, instance: null };
        }

        ensureTargetRecord(definition, discovery) {
            const existing = this.targets.get(definition.id);

            if (existing) {
                const wasConnected = existing.connected;

                existing.instance = discovery.instance || existing.instance;
                existing.resolvedPath = discovery.path || existing.resolvedPath;
                existing.connected = Boolean(discovery.instance);
                existing.lastSeenAt = now();

                if (!wasConnected && existing.connected) {
                    this.statistics.discovered += 1;
                    if (!existing.discoveredAt) {
                        existing.discoveredAt = now();
                    }
                }

                return existing;
            }

            const record = {
                id: definition.id,
                displayName: definition.displayName,
                instance: discovery.instance,
                resolvedPath: discovery.path,
                connected: Boolean(discovery.instance),
                discoveredAt: discovery.instance ? now() : null,
                lastSeenAt: now(),
                invocationTimes: [],
                lastInvocationAt: null,
                running: false,
                runningSince: null,
                blockedUntil: null,
                blockedCount: 0,
                invocationCount: 0,
                completionCount: 0,
                failureCount: 0,
                contained: false,
                containmentReason: null,
                wrappedMethods: []
            };

            this.targets.set(definition.id, record);

            if (discovery.instance) {
                this.statistics.discovered += 1;
            }

            return record;
        }

        pruneInvocations(record) {
            const threshold = now() - this.config.observationWindowMs;
            record.invocationTimes = record.invocationTimes.filter(
                timestamp => timestamp >= threshold
            );
            return record.invocationTimes;
        }

        isBlocked(record) {
            if (!record.blockedUntil) return false;

            if (now() >= record.blockedUntil) {
                record.blockedUntil = null;
                record.contained = false;
                record.containmentReason = null;
                record.invocationTimes = [];
                return false;
            }

            return true;
        }

        canInvoke(record, methodName) {
            this.statistics.invocationAttempts += 1;

            if (!this.config.enabled) {
                return { allowed: true };
            }

            if (this.isBlocked(record)) {
                this.statistics.invocationBlocked += 1;
                return {
                    allowed: false,
                    reason: "LEGACY_TARGET_TEMPORARILY_BLOCKED"
                };
            }

            if (record.running) {
                this.statistics.invocationBlocked += 1;
                this.statistics.reentryBlocked += 1;
                return {
                    allowed: false,
                    reason: "LEGACY_EXECUTION_ALREADY_RUNNING"
                };
            }

            const current = now();

            if (
                record.lastInvocationAt &&
                (current - record.lastInvocationAt) <
                    this.config.minimumInvocationGapMs
            ) {
                this.statistics.invocationBlocked += 1;
                this.statistics.rateBlocked += 1;
                return {
                    allowed: false,
                    reason: "LEGACY_MINIMUM_INVOCATION_GAP"
                };
            }

            const recent = this.pruneInvocations(record);

            if (recent.length >= this.config.blockThreshold) {
                record.blockedUntil =
                    current + this.config.blockDurationMs;

                record.blockedCount += 1;
                this.statistics.invocationBlocked += 1;
                this.statistics.rateBlocked += 1;

                if (this.config.autoContain) {
                    this.containTarget(
                        record.id,
                        "INVOCATION_BURST_LIMIT"
                    );
                }

                return {
                    allowed: false,
                    reason: "LEGACY_BURST_LIMIT"
                };
            }

            if (recent.length >= this.config.warningThreshold) {
                this.warn(
                    `High legacy invocation rate: ${record.displayName}.${methodName}`,
                    {
                        count: recent.length,
                        windowMs: this.config.observationWindowMs
                    }
                );
            }

            return { allowed: true };
        }

        markStart(record) {
            const timestamp = now();
            record.running = true;
            record.runningSince = timestamp;
            record.lastInvocationAt = timestamp;
            record.invocationCount += 1;
            record.invocationTimes.push(timestamp);
            this.pruneInvocations(record);
            this.statistics.invocationAccepted += 1;
        }

        markComplete(record) {
            record.running = false;
            record.runningSince = null;
            record.completionCount += 1;
        }

        markFailed(record) {
            record.running = false;
            record.runningSince = null;
            record.failureCount += 1;
        }

        wrapMethod(record, methodName) {
            const instance = record.instance;

            if (
                !instance ||
                typeof instance[methodName] !== "function"
            ) {
                return false;
            }

            const original = instance[methodName];

            if (original.__rainGuardLegacyProtected) {
                return false;
            }

            const controller = this;

            const wrapped = function (...args) {
                const permission =
                    controller.canInvoke(record, methodName);

                if (!permission.allowed) {
                    return {
                        success: false,
                        skipped: true,
                        reason: permission.reason,
                        protectedBy: NAME
                    };
                }

                controller.markStart(record);

                try {
                    const result = original.apply(this, args);

                    if (
                        result &&
                        typeof result.then === "function"
                    ) {
                        return Promise.resolve(result)
                            .then(value => {
                                controller.markComplete(record);
                                return value;
                            })
                            .catch(error => {
                                controller.markFailed(record);
                                throw error;
                            });
                    }

                    controller.markComplete(record);
                    return result;

                } catch (error) {
                    controller.markFailed(record);
                    throw error;
                }
            };

            wrapped.__rainGuardLegacyProtected = true;
            wrapped.__rainGuardLegacyOriginal = original;

            instance[methodName] = wrapped;
            record.wrappedMethods.push(methodName);
            this.statistics.wrappedMethods += 1;

            this.log(
                `Protected ${record.displayName}.${methodName}`
            );

            return true;
        }

        protectTarget(record) {
            if (!record || !record.instance) {
                return 0;
            }

            let wrapped = 0;

            for (const methodName of EXECUTION_METHODS) {
                if (record.wrappedMethods.includes(methodName)) {
                    continue;
                }

                if (this.wrapMethod(record, methodName)) {
                    wrapped += 1;
                }
            }

            return wrapped;
        }

        invokeStopMethod(record) {
            if (!record || !record.instance) {
                return {
                    success: false,
                    reason: "INSTANCE_NOT_AVAILABLE"
                };
            }

            for (const methodName of STOP_METHODS) {
                const method = record.instance[methodName];

                if (typeof method !== "function") {
                    continue;
                }

                try {
                    method.call(record.instance);
                    return {
                        success: true,
                        method: methodName
                    };
                } catch (error) {
                    return {
                        success: false,
                        method: methodName,
                        error: String(error?.message || error)
                    };
                }
            }

            return {
                success: false,
                reason: "NO_STOP_METHOD"
            };
        }

        containTarget(
            targetId,
            reason = "MANUAL_CONTAINMENT"
        ) {
            const record = this.targets.get(
                normalizeName(targetId)
            );

            if (!record) {
                return {
                    contained: false,
                    reason: "TARGET_NOT_FOUND"
                };
            }

            this.statistics.containmentActions += 1;

            record.contained = true;
            record.containmentReason = reason;
            record.blockedUntil = Math.max(
                record.blockedUntil || 0,
                now() + this.config.blockDurationMs
            );

            const stopResult = this.invokeStopMethod(record);

            if (stopResult.success) {
                this.statistics.containmentSuccess += 1;
            } else {
                this.statistics.containmentFailures += 1;
            }

            this.warn(
                `Legacy target contained: ${record.displayName}`,
                {
                    reason,
                    stopResult
                }
            );

            return {
                contained: true,
                target: record.displayName,
                reason,
                stopResult,
                blockedUntil: record.blockedUntil
            };
        }

        releaseTarget(targetId) {
            const record = this.targets.get(
                normalizeName(targetId)
            );

            if (!record) return false;

            record.blockedUntil = null;
            record.contained = false;
            record.containmentReason = null;
            record.invocationTimes = [];
            record.running = false;
            record.runningSince = null;

            return true;
        }

        checkStaleRunning(record) {
            if (
                !record.running ||
                !record.runningSince
            ) {
                return;
            }

            const elapsed =
                now() - record.runningSince;

            if (
                elapsed <=
                this.config.maximumRunningMs
            ) {
                return;
            }

            record.running = false;
            record.runningSince = null;

            this.containTarget(
                record.id,
                "MAXIMUM_RUNNING_TIME_EXCEEDED"
            );
        }

        scan() {
            this.statistics.scans += 1;

            const results = [];

            for (const definition of TARGETS) {
                const discovery =
                    this.resolveTarget(definition);

                const record =
                    this.ensureTargetRecord(
                        definition,
                        discovery
                    );

                if (discovery.found) {
                    this.protectTarget(record);
                    this.checkStaleRunning(record);
                }

                results.push({
                    id: record.id,
                    displayName: record.displayName,
                    connected: record.connected,
                    resolvedPath: record.resolvedPath,
                    wrappedMethods:
                        record.wrappedMethods.slice(),
                    invocationCount:
                        record.invocationCount,
                    recentInvocations:
                        this.pruneInvocations(record).length,
                    running: record.running,
                    contained: record.contained,
                    blockedUntil: record.blockedUntil
                });
            }

            return results;
        }

        start() {
            if (this.started) {
                return {
                    started: false,
                    reason: "ALREADY_STARTED"
                };
            }

            this.started = true;
            this.scan();

            const timerManager =
                getTimerManager();

            if (
                timerManager &&
                typeof timerManager.registerInterval ===
                    "function"
            ) {
                const result =
                    timerManager.registerInterval(
                        this.scanTimerName,
                        () => this.scan(),
                        this.config.scanIntervalMs,
                        {
                            owner: NAME,
                            preventOverlap: true,
                            useRuntimeGuard: true,
                            maximumRuntimeMs: 1000
                        }
                    );

                return {
                    started: Boolean(result?.registered),
                    via: "TimerManager",
                    result
                };
            }

            this.scanTimer =
                global.setInterval(
                    () => this.scan(),
                    this.config.scanIntervalMs
                );

            return {
                started: true,
                via: "native-setInterval"
            };
        }

        stop() {
            const timerManager =
                getTimerManager();

            if (
                timerManager &&
                typeof timerManager.stop ===
                    "function"
            ) {
                try {
                    timerManager.stop(
                        this.scanTimerName,
                        "PHASE39A8_STOP"
                    );
                } catch (_) {}
            }

            if (this.scanTimer) {
                global.clearInterval(
                    this.scanTimer
                );

                this.scanTimer = null;
            }

            this.started = false;

            return {
                stopped: true
            };
        }

        containAll() {
            const results = [];

            for (
                const targetId
                of this.targets.keys()
            ) {
                results.push(
                    this.containTarget(
                        targetId,
                        "CONTAIN_ALL"
                    )
                );
            }

            return results;
        }

        releaseAll() {
            let released = 0;

            for (
                const targetId
                of this.targets.keys()
            ) {
                if (
                    this.releaseTarget(
                        targetId
                    )
                ) {
                    released += 1;
                }
            }

            return {
                released
            };
        }

        getDiagnostics() {
            const targets = this.scan();

            return {
                name: NAME,
                phase: PHASE,
                version: VERSION,
                build: BUILD,
                ready: this.ready,
                started: this.started,
                statistics:
                    clone(this.statistics),
                targets
            };
        }

        printDiagnostics() {
            const diagnostics =
                this.getDiagnostics();

            console.log(
                "[RainGuard Phase 39A-8] Legacy Loop Controller Diagnostics",
                diagnostics
            );

            if (
                diagnostics.targets.length
            ) {
                console.table(
                    diagnostics.targets
                );
            }

            return diagnostics;
        }
    }

    const controller =
        new LegacyLoopControllerV39();

    global.RainGuardLegacyLoopControllerV39 =
        controller;

    global.RainGuardAI =
        global.RainGuardAI || {};

    global.RainGuardAI.V39 =
        global.RainGuardAI.V39 || {};

    global.RainGuardAI.V39
        .legacyLoopController =
        controller;

    global.printRainGuardLegacyLoops =
        function () {
            return controller
                .printDiagnostics();
        };

    global.containRainGuardLegacyLoops =
        function () {
            return controller
                .containAll();
        };

    global.releaseRainGuardLegacyLoops =
        function () {
            return controller
                .releaseAll();
        };

    console.log(
        `%c[RainGuard AI] Phase ${PHASE} — Legacy Loop Controller v${VERSION} READY`,
        "font-weight:bold;color:#b91c1c;"
    );

    if (
        controller.config.autoStart
    ) {
        controller.start();
    }

})(
    typeof globalThis !==
        "undefined"
        ? globalThis
        : window
);
