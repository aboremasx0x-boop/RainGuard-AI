/*
===============================================================================
 RainGuard AI
 Phase 39A-3 — Loop Guard

 File:
 frontend/js/system_stabilization_v39/loop_guard_v39.js

 Version:
 39A.3.0

 Purpose:
 - Detect rapid repeated engine execution.
 - Prevent re-entry loops.
 - Apply temporary circuit breaker.
 - Protect the main thread from runaway cycles.
 - Integrate with Runtime Guard + Timer Manager.
===============================================================================
*/

(function initializeRainGuardLoopGuard(global) {
    "use strict";

    const NAME = "RainGuardLoopGuardV39";
    const PHASE = "39A-3";
    const VERSION = "39A.3.0";
    const BUILD = "rainguard-v39-loop-guard";

    const DEFAULT_CONFIG = Object.freeze({
        enabled: true,

        observationWindowMs: 5000,

        warningThreshold: 6,

        blockThreshold: 10,

        circuitBreakerMs: 15000,

        maximumConcurrentRuns: 1,

        defaultCooldownMs: 750,

        debug: true
    });

    const PROTECTED_OPERATIONS = Object.freeze([
        "StormEntityCollector",
        "StormTrackStoreBridge",
        "LiveStormExportBridge",
        "AdaptiveMotionLearning",
        "AdaptiveMotionLearningRepository",
        "AdaptiveMotionLearningStatistics",
        "AdaptiveMotionConfidence",
        "AdaptiveMotionConfidenceRepository",
        "AdaptiveMotionConfidenceStatistics",
        "MotionPrediction",
        "MotionPredictionAI",
        "MotionPredictionOrchestrator",
        "MotionVectorRepository",
        "MotionVectorStatistics",
        "FinalArrivalDecision",
        "RainArrival"
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

    function getRuntimeGuard() {
        return (
            global.RainGuardRuntimeGuardV39 ||
            global.RainGuardAI?.V39?.runtimeGuard ||
            null
        );
    }

    function getStateRepository() {
        return (
            global.RainGuardSystemStateRepository ||
            global.RainGuardAI?.V39?.systemStateRepository ||
            null
        );
    }

    class LoopGuardV39 {
        constructor(config = {}) {
            this.name = NAME;
            this.phase = PHASE;
            this.version = VERSION;
            this.build = BUILD;

            this.config = {
                ...DEFAULT_CONFIG,
                ...(config || {})
            };

            this.records = new Map();

            this.statistics = {
                checks: 0,
                accepted: 0,
                blocked: 0,
                warnings: 0,
                circuitBreaks: 0,
                reentryBlocks: 0,
                completed: 0,
                failed: 0
            };

            this.ready = true;

            this.log("Loop Guard ready.");
        }

        log(message, data) {
            if (!this.config.debug) return;

            console.log(
                `[RainGuard][${PHASE}][LoopGuard] ${message}`,
                data !== undefined ? data : ""
            );
        }

        warn(message, data) {
            console.warn(
                `[RainGuard][${PHASE}][LoopGuard] ${message}`,
                data !== undefined ? data : ""
            );
        }

        error(message, data) {
            console.error(
                `[RainGuard][${PHASE}][LoopGuard] ${message}`,
                data !== undefined ? data : ""
            );
        }

        getRecord(name) {
            return (
                this.records.get(
                    normalizeName(name)
                ) || null
            );
        }

        ensureRecord(name) {
            const operationName =
                normalizeName(name);

            let record =
                this.records.get(
                    operationName
                );

            if (!record) {
                record = {
                    name:
                        operationName,

                    running:
                        0,

                    executionTimes:
                        [],

                    lastStartedAt:
                        null,

                    lastCompletedAt:
                        null,

                    lastFailedAt:
                        null,

                    blockedUntil:
                        null,

                    warningCount:
                        0,

                    blockedCount:
                        0,

                    runCount:
                        0,

                    failureCount:
                        0,

                    lastError:
                        null
                };

                this.records.set(
                    operationName,
                    record
                );
            }

            return record;
        }

        pruneExecutionTimes(record) {
            const threshold =
                now() -
                this.config
                    .observationWindowMs;

            record.executionTimes =
                record.executionTimes.filter(
                    timestamp =>
                        timestamp >= threshold
                );

            return record.executionTimes;
        }

        isCircuitOpen(record) {
            if (!record.blockedUntil) {
                return false;
            }

            if (
                now() >=
                record.blockedUntil
            ) {
                record.blockedUntil =
                    null;

                return false;
            }

            return true;
        }

        openCircuit(
            record,
            reason
        ) {
            record.blockedUntil =
                now() +
                this.config
                    .circuitBreakerMs;

            record.blockedCount += 1;

            this.statistics
                .circuitBreaks += 1;

            this.warn(
                `Circuit opened for ${record.name}`,
                {
                    reason,
                    blockedUntil:
                        record.blockedUntil,
                    blockedForMs:
                        this.config
                            .circuitBreakerMs
                }
            );

            const repository =
                getStateRepository();

            if (
                repository &&
                typeof repository
                    .addWarning ===
                "function"
            ) {
                repository.addWarning(
                    "LOOP_GUARD_CIRCUIT_OPEN",
                    {
                        operation:
                            record.name,
                        reason
                    }
                );
            }
        }

        canRun(
            name,
            options = {}
        ) {
            this.statistics.checks += 1;

            if (!this.config.enabled) {
                return {
                    allowed: true,
                    reason:
                        "LOOP_GUARD_DISABLED"
                };
            }

            const operationName =
                normalizeName(name);

            if (!operationName) {
                return {
                    allowed: false,
                    reason:
                        "INVALID_OPERATION_NAME"
                };
            }

            const record =
                this.ensureRecord(
                    operationName
                );

            if (
                this.isCircuitOpen(
                    record
                )
            ) {
                this.statistics.blocked += 1;

                return {
                    allowed: false,
                    reason:
                        "CIRCUIT_BREAKER_ACTIVE",
                    remainingMs:
                        record.blockedUntil -
                        now()
                };
            }

            const maximumConcurrentRuns =
                Number.isFinite(
                    Number(
                        options.maximumConcurrentRuns
                    )
                )
                    ? Number(
                        options.maximumConcurrentRuns
                    )
                    : this.config
                        .maximumConcurrentRuns;

            if (
                record.running >=
                maximumConcurrentRuns
            ) {
                record.blockedCount += 1;

                this.statistics.blocked += 1;
                this.statistics.reentryBlocks += 1;

                return {
                    allowed: false,
                    reason:
                        "REENTRY_BLOCKED",
                    running:
                        record.running
                };
            }

            const recent =
                this.pruneExecutionTimes(
                    record
                );

            if (
                recent.length >=
                this.config
                    .blockThreshold
            ) {
                this.openCircuit(
                    record,
                    "BURST_LIMIT_EXCEEDED"
                );

                this.statistics.blocked += 1;

                return {
                    allowed: false,
                    reason:
                        "BURST_LIMIT_EXCEEDED",
                    count:
                        recent.length,
                    windowMs:
                        this.config
                            .observationWindowMs
                };
            }

            if (
                recent.length >=
                this.config
                    .warningThreshold
            ) {
                record.warningCount += 1;

                this.statistics
                    .warnings += 1;

                this.warn(
                    `High execution frequency detected: ${operationName}`,
                    {
                        executions:
                            recent.length,
                        windowMs:
                            this.config
                                .observationWindowMs
                    }
                );
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
            const operationName =
                normalizeName(name);

            const permission =
                this.canRun(
                    operationName,
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
                    operationName
                );

            const timestamp =
                now();

            record.running += 1;
            record.runCount += 1;
            record.lastStartedAt =
                timestamp;

            record.executionTimes.push(
                timestamp
            );

            this.pruneExecutionTimes(
                record
            );

            this.statistics
                .accepted += 1;

            const token =
                `${operationName}_${timestamp}_${Math.random()
                    .toString(36)
                    .slice(2, 8)}`;

            return {
                started: true,
                token,
                operation:
                    operationName
            };
        }

        complete(
            name
        ) {
            const operationName =
                normalizeName(name);

            const record =
                this.ensureRecord(
                    operationName
                );

            record.running =
                Math.max(
                    0,
                    record.running - 1
                );

            record.lastCompletedAt =
                now();

            this.statistics
                .completed += 1;

            return {
                completed: true,
                running:
                    record.running
            };
        }

        fail(
            name,
            error
        ) {
            const operationName =
                normalizeName(name);

            const record =
                this.ensureRecord(
                    operationName
                );

            record.running =
                Math.max(
                    0,
                    record.running - 1
                );

            record.failureCount += 1;

            record.lastFailedAt =
                now();

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

        async runGuarded(
            name,
            operation,
            options = {}
        ) {
            if (
                typeof operation !==
                "function"
            ) {
                throw new TypeError(
                    "LoopGuard requires a function."
                );
            }

            const startResult =
                this.start(
                    name,
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

            const runtimeGuard =
                getRuntimeGuard();

            try {
                let result;

                if (
                    runtimeGuard &&
                    typeof runtimeGuard
                        .runGuarded ===
                    "function"
                ) {
                    const runtimeResult =
                        await runtimeGuard
                            .runGuarded(
                                `loop:${normalizeName(name)}`,
                                operation,
                                {
                                    cooldownMs:
                                        options.cooldownMs ??
                                        this.config
                                            .defaultCooldownMs,

                                    maximumRuntimeMs:
                                        options.maximumRuntimeMs ??
                                        30000,

                                    metadata: {
                                        source:
                                            "LoopGuardV39",
                                        operation:
                                            normalizeName(name)
                                    }
                                }
                            );

                    if (
                        runtimeResult &&
                        runtimeResult.skipped
                    ) {
                        this.complete(name);

                        return {
                            success: false,
                            skipped: true,
                            reason:
                                runtimeResult.reason,
                            runtimeGuard:
                                runtimeResult
                        };
                    }

                    result =
                        runtimeResult?.result;

                } else {
                    result =
                        await operation();
                }

                this.complete(name);

                return {
                    success: true,
                    skipped: false,
                    result
                };

            } catch (error) {
                this.fail(
                    name,
                    error
                );

                throw error;
            }
        }

        protectObjectMethod(
            object,
            methodName,
            operationName = null,
            options = {}
        ) {
            if (
                !object ||
                typeof object[
                    methodName
                ] !==
                "function"
            ) {
                return {
                    protected: false,
                    reason:
                        "METHOD_NOT_FOUND"
                };
            }

            const original =
                object[methodName];

            if (
                original.__rainGuardLoopProtected
            ) {
                return {
                    protected: false,
                    reason:
                        "ALREADY_PROTECTED"
                };
            }

            const guard =
                this;

            const guardName =
                operationName ||
                `${object.constructor?.name || "Object"}.${methodName}`;

            const wrapped =
                async function (...args) {
                    const result =
                        await guard.runGuarded(
                            guardName,
                            () =>
                                original.apply(
                                    this,
                                    args
                                ),
                            options
                        );

                    if (
                        result &&
                        result.skipped
                    ) {
                        return {
                            success: false,
                            skipped: true,
                            reason:
                                result.reason,
                            protectedBy:
                                "RainGuardLoopGuardV39"
                        };
                    }

                    return result
                        ? result.result
                        : undefined;
                };

            wrapped
                .__rainGuardLoopProtected =
                true;

            wrapped
                .__rainGuardOriginal =
                original;

            object[methodName] =
                wrapped;

            this.log(
                `Method protected: ${guardName}`
            );

            return {
                protected: true,
                operation:
                    guardName
            };
        }

        releaseCircuit(name) {
            const record =
                this.getRecord(name);

            if (!record) {
                return false;
            }

            record.blockedUntil =
                null;

            record.executionTimes =
                [];

            record.running =
                0;

            return true;
        }

        releaseAllCircuits() {
            let released = 0;

            for (
                const record
                of this.records.values()
            ) {
                if (
                    record.blockedUntil
                ) {
                    record.blockedUntil =
                        null;

                    record.executionTimes =
                        [];

                    record.running =
                        0;

                    released += 1;
                }
            }

            return {
                released
            };
        }

        getDiagnostics() {
            const operations =
                Array.from(
                    this.records.values()
                ).map(
                    record => ({
                        name:
                            record.name,

                        running:
                            record.running,

                        recentExecutions:
                            this
                                .pruneExecutionTimes(
                                    record
                                )
                                .length,

                        runCount:
                            record.runCount,

                        warningCount:
                            record.warningCount,

                        blockedCount:
                            record.blockedCount,

                        failureCount:
                            record.failureCount,

                        blockedUntil:
                            record.blockedUntil,

                        lastStartedAt:
                            record.lastStartedAt,

                        lastCompletedAt:
                            record.lastCompletedAt,

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

                protectedOperations:
                    PROTECTED_OPERATIONS.slice(),

                statistics:
                    clone(
                        this.statistics
                    ),

                operations
            };
        }

        printDiagnostics() {
            const diagnostics =
                this.getDiagnostics();

            console.log(
                "[RainGuard Phase 39A-3] Loop Guard Diagnostics",
                diagnostics
            );

            if (
                diagnostics.operations.length
            ) {
                console.table(
                    diagnostics.operations
                );
            }

            return diagnostics;
        }

        async selfTest() {
            const testName =
                "__loop_guard_test__";

            const results = {};

            try {
                const first =
                    this.start(
                        testName
                    );

                results.firstAllowed =
                    first.started === true;

                const second =
                    this.start(
                        testName
                    );

                results.reentryBlocked =
                    (
                        second.started === false &&
                        second.reason ===
                            "REENTRY_BLOCKED"
                    );

                this.complete(
                    testName
                );

                for (
                    let i = 0;
                    i <
                    this.config
                        .blockThreshold;
                    i++
                ) {
                    const result =
                        this.start(
                            testName
                        );

                    if (
                        result.started
                    ) {
                        this.complete(
                            testName
                        );
                    }
                }

                const blocked =
                    this.start(
                        testName
                    );

                results.burstBlocked =
                    (
                        blocked.started === false
                    );

                this.releaseCircuit(
                    testName
                );

                this.records.delete(
                    testName
                );

                results.passed =
                    results.firstAllowed &&
                    results.reentryBlocked &&
                    results.burstBlocked;

            } catch (error) {
                results.passed =
                    false;

                results.error =
                    normalizeError(error);

                this.records.delete(
                    testName
                );
            }

            if (
                results.passed
            ) {
                console.log(
                    "%c[RainGuard Phase 39A-3] LoopGuard SELF TEST PASSED",
                    "font-weight:bold;color:#16a34a;",
                    results
                );

            } else {
                console.error(
                    "[RainGuard Phase 39A-3] LoopGuard SELF TEST FAILED",
                    results
                );
            }

            return results;
        }
    }

    const loopGuard =
        new LoopGuardV39();

    global.RainGuardLoopGuardV39 =
        loopGuard;

    global.RainGuardAI =
        global.RainGuardAI ||
        {};

    global.RainGuardAI.V39 =
        global.RainGuardAI.V39 ||
        {};

    global.RainGuardAI.V39
        .loopGuard =
        loopGuard;

    global.runRainGuardLoopProtected =
        function (
            name,
            operation,
            options = {}
        ) {
            return loopGuard
                .runGuarded(
                    name,
                    operation,
                    options
                );
        };

    global.testRainGuardLoopGuard =
        function () {
            return loopGuard
                .selfTest();
        };

    global.printRainGuardLoopGuard =
        function () {
            return loopGuard
                .printDiagnostics();
        };

    global.releaseRainGuardLoopCircuits =
        function () {
            return loopGuard
                .releaseAllCircuits();
        };

    console.log(
        `%c[RainGuard AI] Phase ${PHASE} — Loop Guard v${VERSION} READY`,
        "font-weight:bold;color:#dc2626;"
    );

})(
    typeof globalThis !==
        "undefined"
        ? globalThis
        : window
);
