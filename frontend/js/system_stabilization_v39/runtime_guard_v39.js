/*
===============================================================================
 RainGuard AI
 Phase 39A-1 — Runtime Guard

 File:
 frontend/js/system_stabilization_v39/runtime_guard_v39.js

 Version:
 39A.1.0

 Purpose:
 - Prevent re-entry loops.
 - Prevent overlapping engine cycles.
 - Add cooldown protection.
 - Detect excessive repeated execution.
 - Protect the browser main thread from runaway engine activity.
===============================================================================
*/

(function initializeRainGuardRuntimeGuard(global) {
    "use strict";

    const NAME = "RainGuardRuntimeGuardV39";
    const PHASE = "39A-1";
    const VERSION = "39A.1.0";
    const BUILD = "rainguard-v39-runtime-guard";

    const DEFAULT_CONFIG = Object.freeze({
        enabled: true,
        defaultCooldownMs: 1000,
        defaultMaximumRuntimeMs: 30000,
        burstWindowMs: 5000,
        maximumExecutionsPerBurst: 10,
        automaticStaleLockRelease: true,
        debug: true
    });

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

    class RuntimeGuardV39 {
        constructor(config = {}) {
            this.name = NAME;
            this.phase = PHASE;
            this.version = VERSION;
            this.build = BUILD;

            this.config = {
                ...DEFAULT_CONFIG,
                ...(config || {})
            };

            this.operations = new Map();
            this.history = new Map();

            this.statistics = {
                executionAttempts: 0,
                executionsAccepted: 0,
                executionsCompleted: 0,
                executionsFailed: 0,
                reentryBlocks: 0,
                cooldownBlocks: 0,
                burstBlocks: 0,
                staleLocksReleased: 0
            };

            this.ready = true;

            this.log("Runtime Guard ready.");
        }

        log(message, data) {
            if (!this.config.debug) return;

            console.log(
                `[RainGuard][${PHASE}][RuntimeGuard] ${message}`,
                data !== undefined ? data : ""
            );
        }

        warn(message, data) {
            console.warn(
                `[RainGuard][${PHASE}][RuntimeGuard] ${message}`,
                data !== undefined ? data : ""
            );
        }

        error(message, data) {
            console.error(
                `[RainGuard][${PHASE}][RuntimeGuard] ${message}`,
                data !== undefined ? data : ""
            );
        }

        getOperation(name) {
            return (
                this.operations.get(
                    normalizeName(name)
                ) || null
            );
        }

        isRunning(name) {
            return Boolean(
                this.getOperation(name)?.running
            );
        }

        clearStaleLockIfNeeded(
            name,
            maximumRuntimeMs
        ) {
            const operation =
                this.getOperation(name);

            if (
                !operation ||
                !operation.running
            ) {
                return false;
            }

            const maxRuntime =
                Number.isFinite(
                    Number(maximumRuntimeMs)
                )
                    ? Number(maximumRuntimeMs)
                    : this.config
                        .defaultMaximumRuntimeMs;

            const elapsed =
                now() -
                operation.startedAt;

            if (
                elapsed <
                maxRuntime
            ) {
                return false;
            }

            if (
                !this.config
                    .automaticStaleLockRelease
            ) {
                return false;
            }

            this.operations.set(
                normalizeName(name),
                {
                    ...operation,
                    running: false,
                    staleReleased: true,
                    staleReleasedAt: now()
                }
            );

            this.statistics
                .staleLocksReleased += 1;

            this.warn(
                `Stale runtime lock released: ${name}`,
                {
                    elapsed,
                    maximumRuntimeMs:
                        maxRuntime
                }
            );

            return true;
        }

        getRecentExecutionTimes(name) {
            const operationName =
                normalizeName(name);

            const history =
                this.history.get(
                    operationName
                ) || [];

            const threshold =
                now() -
                this.config
                    .burstWindowMs;

            const filtered =
                history.filter(
                    timestamp =>
                        timestamp >= threshold
                );

            this.history.set(
                operationName,
                filtered
            );

            return filtered;
        }

        isBurstLimitExceeded(name) {
            const recent =
                this.getRecentExecutionTimes(
                    name
                );

            return (
                recent.length >=
                this.config
                    .maximumExecutionsPerBurst
            );
        }

        recordExecutionAttempt(name) {
            const operationName =
                normalizeName(name);

            const history =
                this.getRecentExecutionTimes(
                    operationName
                );

            history.push(now());

            this.history.set(
                operationName,
                history
            );
        }

        canStart(
            name,
            options = {}
        ) {
            this.statistics
                .executionAttempts += 1;

            if (!this.config.enabled) {
                return {
                    allowed: true,
                    reason: "GUARD_DISABLED"
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

            const maximumRuntimeMs =
                options.maximumRuntimeMs ??
                this.config
                    .defaultMaximumRuntimeMs;

            this.clearStaleLockIfNeeded(
                operationName,
                maximumRuntimeMs
            );

            const existing =
                this.getOperation(
                    operationName
                );

            if (
                existing &&
                existing.running
            ) {
                this.statistics
                    .reentryBlocks += 1;

                return {
                    allowed: false,
                    reason:
                        "PREVIOUS_CYCLE_STILL_RUNNING",
                    operation:
                        clone(existing)
                };
            }

            const cooldownMs =
                Number.isFinite(
                    Number(
                        options.cooldownMs
                    )
                )
                    ? Number(
                        options.cooldownMs
                    )
                    : this.config
                        .defaultCooldownMs;

            if (
                existing &&
                existing.completedAt
            ) {
                const sinceCompletion =
                    now() -
                    existing.completedAt;

                if (
                    sinceCompletion <
                    cooldownMs
                ) {
                    this.statistics
                        .cooldownBlocks += 1;

                    return {
                        allowed: false,
                        reason:
                            "COOLDOWN_ACTIVE",
                        remainingMs:
                            cooldownMs -
                            sinceCompletion
                    };
                }
            }

            if (
                this.isBurstLimitExceeded(
                    operationName
                )
            ) {
                this.statistics
                    .burstBlocks += 1;

                return {
                    allowed: false,
                    reason:
                        "BURST_LIMIT_EXCEEDED",
                    windowMs:
                        this.config
                            .burstWindowMs,
                    maximumExecutions:
                        this.config
                            .maximumExecutionsPerBurst
                };
            }

            return {
                allowed: true,
                reason: "ALLOWED"
            };
        }

        start(
            name,
            options = {}
        ) {
            const operationName =
                normalizeName(name);

            const permission =
                this.canStart(
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

            this.recordExecutionAttempt(
                operationName
            );

            const token =
                `${operationName}_${now()}_${Math.random()
                    .toString(36)
                    .slice(2, 8)}`;

            const record = {
                name:
                    operationName,
                token,
                running: true,
                startedAt: now(),
                completedAt: null,
                failedAt: null,
                durationMs: null,
                cooldownMs:
                    options.cooldownMs ??
                    this.config
                        .defaultCooldownMs,
                maximumRuntimeMs:
                    options.maximumRuntimeMs ??
                    this.config
                        .defaultMaximumRuntimeMs,
                metadata:
                    clone(
                        options.metadata ||
                        {}
                    ),
                lastError: null,
                staleReleased: false
            };

            this.operations.set(
                operationName,
                record
            );

            this.statistics
                .executionsAccepted += 1;

            this.log(
                `Started: ${operationName}`,
                {
                    token
                }
            );

            return {
                started: true,
                token,
                operation:
                    clone(record)
            };
        }

        complete(
            name,
            token = null,
            result = null
        ) {
            const operationName =
                normalizeName(name);

            const existing =
                this.getOperation(
                    operationName
                );

            if (!existing) {
                return {
                    completed: false,
                    reason:
                        "OPERATION_NOT_FOUND"
                };
            }

            if (
                token &&
                existing.token !== token
            ) {
                return {
                    completed: false,
                    reason:
                        "TOKEN_MISMATCH"
                };
            }

            const completedAt =
                now();

            const record = {
                ...existing,
                running: false,
                completedAt,
                durationMs:
                    completedAt -
                    existing.startedAt,
                result:
                    clone(result)
            };

            this.operations.set(
                operationName,
                record
            );

            this.statistics
                .executionsCompleted += 1;

            this.log(
                `Completed: ${operationName}`,
                {
                    durationMs:
                        record.durationMs
                }
            );

            return {
                completed: true,
                operation:
                    clone(record)
            };
        }

        fail(
            name,
            token = null,
            error = null
        ) {
            const operationName =
                normalizeName(name);

            const existing =
                this.getOperation(
                    operationName
                );

            if (!existing) {
                return {
                    failed: false,
                    reason:
                        "OPERATION_NOT_FOUND"
                };
            }

            if (
                token &&
                existing.token !== token
            ) {
                return {
                    failed: false,
                    reason:
                        "TOKEN_MISMATCH"
                };
            }

            const failedAt =
                now();

            const record = {
                ...existing,
                running: false,
                failedAt,
                durationMs:
                    failedAt -
                    existing.startedAt,
                lastError:
                    normalizeError(error)
            };

            this.operations.set(
                operationName,
                record
            );

            this.statistics
                .executionsFailed += 1;

            this.error(
                `Failed: ${operationName}`,
                record.lastError
            );

            return {
                failed: true,
                operation:
                    clone(record)
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
                    "runGuarded requires a function."
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

            const token =
                startResult.token;

            try {
                const result =
                    await operation();

                this.complete(
                    name,
                    token,
                    result
                );

                return {
                    success: true,
                    skipped: false,
                    result
                };

            } catch (error) {
                this.fail(
                    name,
                    token,
                    error
                );

                throw error;
            }
        }

        forceRelease(name) {
            const operationName =
                normalizeName(name);

            const existing =
                this.getOperation(
                    operationName
                );

            if (!existing) {
                return false;
            }

            this.operations.set(
                operationName,
                {
                    ...existing,
                    running: false,
                    forceReleasedAt: now()
                }
            );

            this.warn(
                `Force released: ${operationName}`
            );

            return true;
        }

        forceReleaseAll() {
            let released = 0;

            for (
                const [
                    name,
                    operation
                ]
                of this.operations
            ) {
                if (
                    operation.running
                ) {
                    this.forceRelease(name);
                    released += 1;
                }
            }

            return {
                released
            };
        }

        getDiagnostics() {
            return {
                name: NAME,
                phase: PHASE,
                version: VERSION,
                build: BUILD,
                ready: this.ready,
                configuration:
                    clone(this.config),
                statistics:
                    clone(
                        this.statistics
                    ),
                runningOperations:
                    Array.from(
                        this.operations.values()
                    )
                        .filter(
                            operation =>
                                operation.running
                        )
                        .map(clone),
                operations:
                    Array.from(
                        this.operations.values()
                    ).map(clone)
            };
        }

        printDiagnostics() {
            const diagnostics =
                this.getDiagnostics();

            console.log(
                "[RainGuard Phase 39A-1] Runtime Guard Diagnostics",
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
                "__runtime_guard_test__";

            const results = {};

            try {
                const first =
                    this.start(
                        testName,
                        {
                            cooldownMs:
                                100
                        }
                    );

                results.firstStart =
                    first.started === true;

                const second =
                    this.start(testName);

                results.reentryBlocked =
                    (
                        second.started === false &&
                        second.reason ===
                            "PREVIOUS_CYCLE_STILL_RUNNING"
                    );

                this.complete(
                    testName,
                    first.token
                );

                const third =
                    this.start(
                        testName,
                        {
                            cooldownMs:
                                100
                        }
                    );

                results.cooldownBlocked =
                    (
                        third.started === false &&
                        third.reason ===
                            "COOLDOWN_ACTIVE"
                    );

                await new Promise(
                    resolve =>
                        setTimeout(
                            resolve,
                            120
                        )
                );

                const fourth =
                    this.start(
                        testName,
                        {
                            cooldownMs:
                                100
                        }
                    );

                results.restartAllowed =
                    fourth.started === true;

                if (
                    fourth.started
                ) {
                    this.complete(
                        testName,
                        fourth.token
                    );
                }

                this.operations.delete(
                    testName
                );

                this.history.delete(
                    testName
                );

                results.passed =
                    results.firstStart &&
                    results.reentryBlocked &&
                    results.cooldownBlocked &&
                    results.restartAllowed;

            } catch (error) {
                results.passed = false;
                results.error =
                    normalizeError(error);
            }

            if (
                results.passed
            ) {
                console.log(
                    "%c[RainGuard Phase 39A-1] RuntimeGuard SELF TEST PASSED",
                    "font-weight:bold;color:#16a34a;",
                    results
                );

            } else {
                console.error(
                    "[RainGuard Phase 39A-1] RuntimeGuard SELF TEST FAILED",
                    results
                );
            }

            return results;
        }
    }

    const runtimeGuard =
        new RuntimeGuardV39();

    global.RainGuardRuntimeGuardV39 =
        runtimeGuard;

    global.RainGuardAI =
        global.RainGuardAI || {};

    global.RainGuardAI.V39 =
        global.RainGuardAI.V39 || {};

    global.RainGuardAI.V39
        .runtimeGuard =
        runtimeGuard;

    global.runRainGuardProtected =
        function (
            name,
            operation,
            options = {}
        ) {
            return runtimeGuard
                .runGuarded(
                    name,
                    operation,
                    options
                );
        };

    global.testRainGuardRuntimeGuard =
        function () {
            return runtimeGuard
                .selfTest();
        };

    global.printRainGuardRuntimeGuard =
        function () {
            return runtimeGuard
                .printDiagnostics();
        };

    global.releaseRainGuardRuntimeLocks =
        function () {
            return runtimeGuard
                .forceReleaseAll();
        };

    console.log(
        `%c[RainGuard AI] Phase ${PHASE} — Runtime Guard v${VERSION} READY`,
        "font-weight:bold;color:#7c3aed;"
    );

})(
    typeof globalThis !==
        "undefined"
        ? globalThis
        : window
);
