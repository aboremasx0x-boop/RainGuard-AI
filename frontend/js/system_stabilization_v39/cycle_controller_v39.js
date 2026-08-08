/*
===============================================================================
 RainGuard AI
 Phase 39A-6 — Cycle Controller / Emergency Loop Stop

 File:
 frontend/js/system_stabilization_v39/cycle_controller_v39.js

 Version:
 39A.6.0

 Purpose:
 - Prevent repeated heavy execution cycles.
 - Prevent overlapping Rain Arrival cycles.
 - Apply global cycle cooldown.
 - Emergency-stop runaway cycles.
 - Integrate with Execution Guard, Loop Guard, Runtime Guard, Timer Manager.
===============================================================================
*/

(function initializeRainGuardCycleController(global) {
    "use strict";

    const NAME = "RainGuardCycleControllerV39";
    const PHASE = "39A-6";
    const VERSION = "39A.6.0";
    const BUILD = "rainguard-v39-cycle-controller";

    const DEFAULT_CONFIG = Object.freeze({
        enabled: true,

        minimumCycleGapMs: 5000,

        maximumCycleRuntimeMs: 30000,

        maximumCyclesPerWindow: 5,

        cycleWindowMs: 30000,

        emergencyBlockMs: 30000,

        preventOverlap: true,

        debug: true
    });

    const PROTECTED_CYCLES = Object.freeze([
        "RainArrival",
        "RainArrivalPrediction",
        "MotionPrediction",
        "MotionPredictionOrchestrator",
        "MotionRecovery",
        "CandidateScoring",
        "FinalArrivalDecision",
        "AdaptiveMotionLearning",
        "AdaptiveMotionConfidence",
        "StormEntityCollector",
        "StormTrackStoreBridge",
        "LiveStormExportBridge"
    ]);

    const now = () => Date.now();

    function normalizeName(value) {
        return String(value || "").trim();
    }

    function clone(value) {
        if (value === null || value === undefined) {
            return value;
        }

        try {
            if (typeof structuredClone === "function") {
                return structuredClone(value);
            }
        } catch (_) {}

        try {
            return JSON.parse(JSON.stringify(value));
        } catch (_) {
            return value;
        }
    }

    function normalizeError(error) {
        if (!error) {
            return null;
        }

        return {
            name: error.name || "Error",
            message: error.message || String(error),
            code: error.code || null,
            stack: error.stack || null,
            timestamp: now(),
            timestampIso: new Date().toISOString()
        };
    }

    function getExecutionGuard() {
        return (
            global.RainGuardExecutionGuardV39 ||
            global.RainGuardAI?.V39?.executionGuard ||
            null
        );
    }

    function getLoopGuard() {
        return (
            global.RainGuardLoopGuardV39 ||
            global.RainGuardAI?.V39?.loopGuard ||
            null
        );
    }

    function getRuntimeGuard() {
        return (
            global.RainGuardRuntimeGuardV39 ||
            global.RainGuardAI?.V39?.runtimeGuard ||
            null
        );
    }

    function getTimerManager() {
        return (
            global.RainGuardTimerManagerV39 ||
            global.RainGuardAI?.V39?.timerManager ||
            null
        );
    }

    class CycleControllerV39 {

        constructor(config = {}) {
            this.name = NAME;
            this.phase = PHASE;
            this.version = VERSION;
            this.build = BUILD;

            this.config = {
                ...DEFAULT_CONFIG,
                ...(config || {})
            };

            this.cycles = new Map();

            this.statistics = {
                requests: 0,
                accepted: 0,
                completed: 0,
                failed: 0,
                overlapBlocked: 0,
                cooldownBlocked: 0,
                burstBlocked: 0,
                emergencyStops: 0,
                forcedReleases: 0
            };

            this.globalEmergencyStop = false;

            this.ready = true;

            this.log("Cycle Controller ready.");
        }

        log(message, data) {
            if (!this.config.debug) {
                return;
            }

            console.log(
                `[RainGuard][${PHASE}][CycleController] ${message}`,
                data !== undefined ? data : ""
            );
        }

        warn(message, data) {
            console.warn(
                `[RainGuard][${PHASE}][CycleController] ${message}`,
                data !== undefined ? data : ""
            );
        }

        error(message, data) {
            console.error(
                `[RainGuard][${PHASE}][CycleController] ${message}`,
                data !== undefined ? data : ""
            );
        }

        ensureRecord(name) {
            const cycleName =
                normalizeName(name);

            let record =
                this.cycles.get(
                    cycleName
                );

            if (!record) {
                record = {
                    name: cycleName,
                    running: false,
                    startedAt: null,
                    completedAt: null,
                    failedAt: null,
                    durationMs: null,
                    lastError: null,
                    recentStarts: [],
                    blockedUntil: null,
                    runCount: 0,
                    successCount: 0,
                    failureCount: 0,
                    blockedCount: 0,
                    token: null
                };

                this.cycles.set(
                    cycleName,
                    record
                );
            }

            return record;
        }

        pruneRecentStarts(record) {
            const threshold =
                now() -
                this.config.cycleWindowMs;

            record.recentStarts =
                record.recentStarts.filter(
                    timestamp =>
                        timestamp >= threshold
                );

            return record.recentStarts;
        }

        isEmergencyBlocked(record) {
            if (!record.blockedUntil) {
                return false;
            }

            if (now() >= record.blockedUntil) {
                record.blockedUntil = null;
                return false;
            }

            return true;
        }

        openEmergencyBlock(
            record,
            reason
        ) {
            record.blockedUntil =
                now() +
                this.config.emergencyBlockMs;

            record.blockedCount += 1;

            this.statistics
                .emergencyStops += 1;

            this.warn(
                `Emergency block opened for ${record.name}`,
                {
                    reason,
                    blockedForMs:
                        this.config.emergencyBlockMs
                }
            );
        }

        canStart(
            name,
            options = {}
        ) {
            this.statistics.requests += 1;

            if (!this.config.enabled) {
                return {
                    allowed: true,
                    reason:
                        "CYCLE_CONTROLLER_DISABLED"
                };
            }

            if (this.globalEmergencyStop) {
                return {
                    allowed: false,
                    reason:
                        "GLOBAL_EMERGENCY_STOP"
                };
            }

            const cycleName =
                normalizeName(name);

            if (!cycleName) {
                return {
                    allowed: false,
                    reason:
                        "INVALID_CYCLE_NAME"
                };
            }

            const record =
                this.ensureRecord(
                    cycleName
                );

            if (
                this.isEmergencyBlocked(
                    record
                )
            ) {
                return {
                    allowed: false,
                    reason:
                        "EMERGENCY_BLOCK_ACTIVE",
                    remainingMs:
                        record.blockedUntil -
                        now()
                };
            }

            const preventOverlap =
                options.preventOverlap ??
                this.config.preventOverlap;

            if (
                preventOverlap &&
                record.running
            ) {
                record.blockedCount += 1;

                this.statistics
                    .overlapBlocked += 1;

                return {
                    allowed: false,
                    reason:
                        "PREVIOUS_CYCLE_STILL_RUNNING"
                };
            }

            const minimumCycleGapMs =
                Number.isFinite(
                    Number(
                        options.minimumCycleGapMs
                    )
                )
                    ? Number(
                        options.minimumCycleGapMs
                    )
                    : this.config
                        .minimumCycleGapMs;

            if (record.completedAt) {
                const elapsed =
                    now() -
                    record.completedAt;

                if (
                    elapsed <
                    minimumCycleGapMs
                ) {
                    record.blockedCount += 1;

                    this.statistics
                        .cooldownBlocked += 1;

                    return {
                        allowed: false,
                        reason:
                            "CYCLE_COOLDOWN_ACTIVE",
                        remainingMs:
                            minimumCycleGapMs -
                            elapsed
                    };
                }
            }

            const recent =
                this.pruneRecentStarts(
                    record
                );

            if (
                recent.length >=
                this.config
                    .maximumCyclesPerWindow
            ) {
                record.blockedCount += 1;

                this.statistics
                    .burstBlocked += 1;

                this.openEmergencyBlock(
                    record,
                    "MAXIMUM_CYCLES_PER_WINDOW"
                );

                return {
                    allowed: false,
                    reason:
                        "CYCLE_BURST_LIMIT_EXCEEDED",
                    count:
                        recent.length
                };
            }

            return {
                allowed: true,
                reason:
                    "ALLOWED"
            };
        }

        start(
            name,
            options = {}
        ) {
            const cycleName =
                normalizeName(name);

            const permission =
                this.canStart(
                    cycleName,
                    options
                );

            if (
                !permission.allowed
            ) {
                return {
                    started: false,
                    ...permission
                };
            }

            const record =
                this.ensureRecord(
                    cycleName
                );

            const timestamp =
                now();

            const token =
                `${cycleName}_${timestamp}_${Math.random()
                    .toString(36)
                    .slice(2, 8)}`;

            record.running = true;
            record.startedAt = timestamp;
            record.failedAt = null;
            record.durationMs = null;
            record.lastError = null;
            record.token = token;

            record.runCount += 1;

            record.recentStarts.push(
                timestamp
            );

            this.pruneRecentStarts(
                record
            );

            this.statistics
                .accepted += 1;

            this.log(
                `Cycle started: ${cycleName}`,
                {
                    token
                }
            );

            return {
                started: true,
                token,
                cycle:
                    cycleName
            };
        }

        complete(
            name,
            token = null
        ) {
            const cycleName =
                normalizeName(name);

            const record =
                this.ensureRecord(
                    cycleName
                );

            if (
                token &&
                record.token !== token
            ) {
                return {
                    completed: false,
                    reason:
                        "TOKEN_MISMATCH"
                };
            }

            const completedAt =
                now();

            record.running = false;
            record.completedAt =
                completedAt;

            record.durationMs =
                record.startedAt
                    ? completedAt -
                        record.startedAt
                    : null;

            record.successCount += 1;

            this.statistics
                .completed += 1;

            return {
                completed: true,
                durationMs:
                    record.durationMs
            };
        }

        fail(
            name,
            token,
            error
        ) {
            const cycleName =
                normalizeName(name);

            const record =
                this.ensureRecord(
                    cycleName
                );

            if (
                token &&
                record.token !== token
            ) {
                return {
                    failed: false,
                    reason:
                        "TOKEN_MISMATCH"
                };
            }

            const failedAt =
                now();

            record.running = false;
            record.failedAt =
                failedAt;

            record.durationMs =
                record.startedAt
                    ? failedAt -
                        record.startedAt
                    : null;

            record.failureCount += 1;

            record.lastError =
                normalizeError(
                    error
                );

            this.statistics
                .failed += 1;

            return {
                failed: true,
                error:
                    clone(
                        record.lastError
                    )
            };
        }

        async runCycle(
            name,
            operation,
            options = {}
        ) {
            if (
                typeof operation !==
                "function"
            ) {
                throw new TypeError(
                    "runCycle requires a function."
                );
            }

            const cycleName =
                normalizeName(name);

            const startResult =
                this.start(
                    cycleName,
                    options
                );

            if (
                !startResult.started
            ) {
                return {
                    success: false,
                    skipped: true,
                    reason:
                        startResult.reason,
                    guard:
                        startResult
                };
            }

            const token =
                startResult.token;

            const executionGuard =
                getExecutionGuard();

            try {
                let result;

                if (
                    executionGuard &&
                    typeof executionGuard
                        .execute ===
                    "function"
                ) {
                    const guardedResult =
                        await executionGuard
                            .execute(
                                `cycle:${cycleName}`,
                                async () =>
                                    operation(),
                                null,
                                {
                                    cooldownMs:
                                        options.minimumCycleGapMs ??
                                        this.config
                                            .minimumCycleGapMs,

                                    timeoutMs:
                                        options.maximumRuntimeMs ??
                                        this.config
                                            .maximumCycleRuntimeMs
                                }
                            );

                    if (
                        guardedResult &&
                        guardedResult.skipped
                    ) {
                        this.complete(
                            cycleName,
                            token
                        );

                        return {
                            success: false,
                            skipped: true,
                            reason:
                                guardedResult.reason
                        };
                    }

                    result =
                        guardedResult
                            ?.result;

                } else {
                    result =
                        await operation();
                }

                this.complete(
                    cycleName,
                    token
                );

                return {
                    success: true,
                    skipped: false,
                    result
                };

            } catch (error) {
                this.fail(
                    cycleName,
                    token,
                    error
                );

                throw error;
            }
        }

        emergencyStop(
            name
        ) {
            const cycleName =
                normalizeName(name);

            const record =
                this.ensureRecord(
                    cycleName
                );

            record.running = false;

            record.blockedUntil =
                now() +
                this.config
                    .emergencyBlockMs;

            record.blockedCount += 1;

            this.statistics
                .emergencyStops += 1;

            return {
                stopped: true,
                blockedUntil:
                    record.blockedUntil
            };
        }

        emergencyStopAll() {
            this.globalEmergencyStop =
                true;

            let stopped = 0;

            for (
                const record
                of this.cycles.values()
            ) {
                if (
                    record.running
                ) {
                    record.running = false;
                    stopped += 1;
                }

                record.blockedUntil =
                    now() +
                    this.config
                        .emergencyBlockMs;
            }

            const timerManager =
                getTimerManager();

            if (
                timerManager &&
                typeof timerManager
                    .stopAll ===
                "function"
            ) {
                try {
                    timerManager.stopAll(
                        "CYCLE_CONTROLLER_EMERGENCY_STOP"
                    );
                } catch (_) {}
            }

            const runtimeGuard =
                getRuntimeGuard();

            if (
                runtimeGuard &&
                typeof runtimeGuard
                    .forceReleaseAll ===
                "function"
            ) {
                try {
                    runtimeGuard
                        .forceReleaseAll();
                } catch (_) {}
            }

            const loopGuard =
                getLoopGuard();

            if (
                loopGuard &&
                typeof loopGuard
                    .releaseAllCircuits ===
                "function"
            ) {
                try {
                    loopGuard
                        .releaseAllCircuits();
                } catch (_) {}
            }

            this.statistics
                .forcedReleases +=
                stopped;

            return {
                stopped,
                globalEmergencyStop:
                    true
            };
        }

        resumeAll() {
            this.globalEmergencyStop =
                false;

            for (
                const record
                of this.cycles.values()
            ) {
                record.blockedUntil =
                    null;

                record.running =
                    false;

                record.recentStarts =
                    [];
            }

            return {
                resumed: true
            };
        }

        getDiagnostics() {
            const cycles =
                Array.from(
                    this.cycles.values()
                ).map(
                    record => ({
                        name:
                            record.name,

                        running:
                            record.running,

                        runCount:
                            record.runCount,

                        successCount:
                            record.successCount,

                        failureCount:
                            record.failureCount,

                        blockedCount:
                            record.blockedCount,

                        recentStarts:
                            this.pruneRecentStarts(
                                record
                            ).length,

                        blockedUntil:
                            record.blockedUntil,

                        durationMs:
                            record.durationMs,

                        lastError:
                            record.lastError
                    })
                );

            return {
                name: NAME,
                phase: PHASE,
                version: VERSION,
                build: BUILD,

                ready:
                    this.ready,

                globalEmergencyStop:
                    this.globalEmergencyStop,

                protectedCycles:
                    PROTECTED_CYCLES.slice(),

                statistics:
                    clone(
                        this.statistics
                    ),

                cycles
            };
        }

        printDiagnostics() {
            const diagnostics =
                this.getDiagnostics();

            console.log(
                "[RainGuard Phase 39A-6] Cycle Controller Diagnostics",
                diagnostics
            );

            if (
                diagnostics.cycles.length
            ) {
                console.table(
                    diagnostics.cycles
                );
            }

            return diagnostics;
        }
    }

    const controller =
        new CycleControllerV39();

    global.RainGuardCycleControllerV39 =
        controller;

    global.RainGuardAI =
        global.RainGuardAI ||
        {};

    global.RainGuardAI.V39 =
        global.RainGuardAI.V39 ||
        {};

    global.RainGuardAI.V39
        .cycleController =
        controller;

    global.runRainGuardCycle =
        function (
            name,
            operation,
            options = {}
        ) {
            return controller
                .runCycle(
                    name,
                    operation,
                    options
                );
        };

    global.stopRainGuardCycle =
        function (name) {
            return controller
                .emergencyStop(name);
        };

    global.stopAllRainGuardCycles =
        function () {
            return controller
                .emergencyStopAll();
        };

    global.resumeRainGuardCycles =
        function () {
            return controller
                .resumeAll();
        };

    global.printRainGuardCycleController =
        function () {
            return controller
                .printDiagnostics();
        };

    console.log(
        `%c[RainGuard AI] Phase ${PHASE} — Cycle Controller v${VERSION} READY`,
        "font-weight:bold;color:#ea580c;"
    );

})(
    typeof globalThis !==
        "undefined"
        ? globalThis
        : window
);
