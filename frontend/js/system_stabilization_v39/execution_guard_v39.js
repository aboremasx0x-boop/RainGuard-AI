/*
===============================================================================
 RainGuard AI
 Phase 39A-4 — Execution Guard

 File:
 frontend/js/system_stabilization_v39/execution_guard_v39.js

 Version:
 39A.4.0

 Purpose:
 - Prevent overlapping engine executions.
 - Prevent duplicate execution requests.
 - Add execution timeout protection.
 - Add cooldown protection.
 - Integrate with Runtime Guard and Loop Guard.
 - Protect the browser Main Thread from repeated heavy tasks.
===============================================================================
*/

(function initializeRainGuardExecutionGuard(global) {
    "use strict";

    const NAME = "RainGuardExecutionGuardV39";
    const PHASE = "39A-4";
    const VERSION = "39A.4.0";
    const BUILD = "rainguard-v39-execution-guard";

    const DEFAULT_CONFIG = Object.freeze({
        enabled: true,

        defaultTimeoutMs: 30000,

        defaultCooldownMs: 1000,

        preventOverlap: true,

        preventDuplicatePayload: true,

        duplicatePayloadWindowMs: 3000,

        useRuntimeGuard: true,

        useLoopGuard: true,

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

    function createPayloadFingerprint(payload) {
        if (
            payload === null ||
            payload === undefined
        ) {
            return "null";
        }

        try {
            return JSON.stringify(payload);
        } catch (_) {
            return String(payload);
        }
    }

    function getRuntimeGuard() {
        return (
            global.RainGuardRuntimeGuardV39 ||
            global.RainGuardAI?.V39?.runtimeGuard ||
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

    function getStateRepository() {
        return (
            global.RainGuardSystemStateRepository ||
            global.RainGuardAI?.V39?.systemStateRepository ||
            null
        );
    }

    class ExecutionGuardV39 {

        constructor(config = {}) {

            this.name = NAME;
            this.phase = PHASE;
            this.version = VERSION;
            this.build = BUILD;

            this.config = {
                ...DEFAULT_CONFIG,
                ...(config || {})
            };

            this.executions = new Map();

            this.statistics = {
                requests: 0,
                accepted: 0,
                completed: 0,
                failed: 0,
                overlapBlocked: 0,
                duplicatePayloadBlocked: 0,
                cooldownBlocked: 0,
                timeoutFailures: 0,
                runtimeGuardBlocks: 0,
                loopGuardBlocks: 0
            };

            this.ready = true;

            this.log(
                "Execution Guard ready."
            );
        }

        log(message, data) {
            if (!this.config.debug) {
                return;
            }

            console.log(
                `[RainGuard][${PHASE}][ExecutionGuard] ${message}`,
                data !== undefined
                    ? data
                    : ""
            );
        }

        warn(message, data) {
            console.warn(
                `[RainGuard][${PHASE}][ExecutionGuard] ${message}`,
                data !== undefined
                    ? data
                    : ""
            );
        }

        error(message, data) {
            console.error(
                `[RainGuard][${PHASE}][ExecutionGuard] ${message}`,
                data !== undefined
                    ? data
                    : ""
            );
        }

        getRecord(name) {
            return (
                this.executions.get(
                    normalizeName(name)
                ) || null
            );
        }

        ensureRecord(name) {
            const executionName =
                normalizeName(name);

            let record =
                this.executions.get(
                    executionName
                );

            if (!record) {

                record = {
                    name:
                        executionName,

                    running:
                        false,

                    startedAt:
                        null,

                    completedAt:
                        null,

                    failedAt:
                        null,

                    durationMs:
                        null,

                    lastPayloadFingerprint:
                        null,

                    lastPayloadAt:
                        null,

                    lastError:
                        null,

                    runCount:
                        0,

                    successCount:
                        0,

                    failureCount:
                        0,

                    blockedCount:
                        0,

                    token:
                        null
                };

                this.executions.set(
                    executionName,
                    record
                );
            }

            return record;
        }

        isRunning(name) {
            return Boolean(
                this.getRecord(name)?.running
            );
        }

        isDuplicatePayload(
            record,
            payload
        ) {

            if (
                !this.config
                    .preventDuplicatePayload
            ) {
                return false;
            }

            const fingerprint =
                createPayloadFingerprint(
                    payload
                );

            if (
                !record.lastPayloadFingerprint ||
                record.lastPayloadFingerprint !==
                    fingerprint
            ) {
                return false;
            }

            if (
                !record.lastPayloadAt
            ) {
                return false;
            }

            const elapsed =
                now() -
                record.lastPayloadAt;

            return (
                elapsed <
                this.config
                    .duplicatePayloadWindowMs
            );
        }

        isCooldownActive(
            record,
            cooldownMs
        ) {

            if (
                !record.completedAt
            ) {
                return false;
            }

            const elapsed =
                now() -
                record.completedAt;

            return elapsed < cooldownMs;
        }

        canExecute(
            name,
            payload = null,
            options = {}
        ) {

            this.statistics
                .requests += 1;

            if (!this.config.enabled) {

                return {
                    allowed: true,
                    reason:
                        "EXECUTION_GUARD_DISABLED"
                };
            }

            const executionName =
                normalizeName(name);

            if (!executionName) {

                return {
                    allowed: false,
                    reason:
                        "INVALID_EXECUTION_NAME"
                };
            }

            const record =
                this.ensureRecord(
                    executionName
                );

            const preventOverlap =
                options.preventOverlap ??
                this.config
                    .preventOverlap;

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
                        "EXECUTION_ALREADY_RUNNING"
                };
            }

            if (
                this.isDuplicatePayload(
                    record,
                    payload
                )
            ) {

                record.blockedCount += 1;

                this.statistics
                    .duplicatePayloadBlocked += 1;

                return {
                    allowed: false,
                    reason:
                        "DUPLICATE_PAYLOAD_BLOCKED"
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
                this.isCooldownActive(
                    record,
                    cooldownMs
                )
            ) {

                record.blockedCount += 1;

                this.statistics
                    .cooldownBlocked += 1;

                return {
                    allowed: false,
                    reason:
                        "EXECUTION_COOLDOWN_ACTIVE",

                    remainingMs:
                        cooldownMs -
                        (
                            now() -
                            record.completedAt
                        )
                };
            }

            return {
                allowed: true,
                reason:
                    "ALLOWED"
            };
        }

        createTimeoutPromise(
            timeoutMs,
            name
        ) {

            return new Promise(
                (_, reject) => {

                    const timer =
                        global.setTimeout(
                            () => {

                                const error =
                                    new Error(
                                        `${name} timed out after ${timeoutMs} ms.`
                                    );

                                error.code =
                                    "EXECUTION_TIMEOUT";

                                reject(error);

                            },
                            timeoutMs
                        );

                    if (
                        timer &&
                        typeof timer.unref ===
                        "function"
                    ) {
                        timer.unref();
                    }
                }
            );
        }

        async runWithTimeout(
            operation,
            timeoutMs,
            name
        ) {

            return Promise.race([
                Promise.resolve()
                    .then(operation),

                this.createTimeoutPromise(
                    timeoutMs,
                    name
                )
            ]);
        }

        async execute(
            name,
            operation,
            payload = null,
            options = {}
        ) {

            if (
                typeof operation !==
                "function"
            ) {

                throw new TypeError(
                    "ExecutionGuard requires an operation function."
                );
            }

            const executionName =
                normalizeName(name);

            const permission =
                this.canExecute(
                    executionName,
                    payload,
                    options
                );

            if (
                !permission.allowed
            ) {

                return {
                    success: false,
                    skipped: true,
                    reason:
                        permission.reason,
                    guard:
                        permission
                };
            }

            const record =
                this.ensureRecord(
                    executionName
                );

            const token =
                `${executionName}_${now()}_${Math.random()
                    .toString(36)
                    .slice(2, 8)}`;

            const payloadFingerprint =
                createPayloadFingerprint(
                    payload
                );

            record.running =
                true;

            record.startedAt =
                now();

            record.completedAt =
                null;

            record.failedAt =
                null;

            record.lastError =
                null;

            record.token =
                token;

            record.runCount += 1;

            record.lastPayloadFingerprint =
                payloadFingerprint;

            record.lastPayloadAt =
                now();

            this.statistics
                .accepted += 1;

            const runtimeGuard =
                getRuntimeGuard();

            const loopGuard =
                getLoopGuard();

            const timeoutMs =
                Number.isFinite(
                    Number(
                        options.timeoutMs
                    )
                )
                    ? Number(
                        options.timeoutMs
                    )
                    : this.config
                        .defaultTimeoutMs;

            try {

                let guardedOperation =
                    async () =>
                        this.runWithTimeout(
                            () =>
                                operation(
                                    payload,
                                    {
                                        name:
                                            executionName,

                                        token,

                                        startedAt:
                                            record.startedAt
                                    }
                                ),
                            timeoutMs,
                            executionName
                        );

                if (
                    this.config.useRuntimeGuard &&
                    options.useRuntimeGuard !== false &&
                    runtimeGuard &&
                    typeof runtimeGuard
                        .runGuarded ===
                    "function"
                ) {

                    const previous =
                        guardedOperation;

                    guardedOperation =
                        async () => {

                            const result =
                                await runtimeGuard
                                    .runGuarded(
                                        `execution:${executionName}`,
                                        previous,
                                        {
                                            cooldownMs: 0,

                                            maximumRuntimeMs:
                                                timeoutMs,

                                            metadata: {
                                                source:
                                                    "ExecutionGuardV39",

                                                execution:
                                                    executionName
                                            }
                                        }
                                    );

                            if (
                                result &&
                                result.skipped
                            ) {

                                this.statistics
                                    .runtimeGuardBlocks += 1;

                                return {
                                    __guardSkipped:
                                        true,

                                    reason:
                                        result.reason
                                };
                            }

                            return result
                                ? result.result
                                : undefined;
                        };
                }

                if (
                    this.config.useLoopGuard &&
                    options.useLoopGuard !== false &&
                    loopGuard &&
                    typeof loopGuard
                        .runGuarded ===
                    "function"
                ) {

                    const previous =
                        guardedOperation;

                    guardedOperation =
                        async () => {

                            const result =
                                await loopGuard
                                    .runGuarded(
                                        executionName,
                                        previous,
                                        {
                                            cooldownMs:
                                                options.cooldownMs ??
                                                this.config
                                                    .defaultCooldownMs,

                                            maximumRuntimeMs:
                                                timeoutMs
                                        }
                                    );

                            if (
                                result &&
                                result.skipped
                            ) {

                                this.statistics
                                    .loopGuardBlocks += 1;

                                return {
                                    __guardSkipped:
                                        true,

                                    reason:
                                        result.reason
                                };
                            }

                            return result
                                ? result.result
                                : undefined;
                        };
                }

                const result =
                    await guardedOperation();

                if (
                    result &&
                    result.__guardSkipped
                ) {

                    record.running =
                        false;

                    record.completedAt =
                        now();

                    record.durationMs =
                        record.completedAt -
                        record.startedAt;

                    record.blockedCount += 1;

                    return {
                        success: false,
                        skipped: true,
                        reason:
                            result.reason
                    };
                }

                record.running =
                    false;

                record.completedAt =
                    now();

                record.durationMs =
                    record.completedAt -
                    record.startedAt;

                record.successCount += 1;

                this.statistics
                    .completed += 1;

                this.executions.set(
                    executionName,
                    record
                );

                this.log(
                    `Execution completed: ${executionName}`,
                    {
                        durationMs:
                            record.durationMs
                    }
                );

                return {
                    success: true,
                    skipped: false,
                    result,
                    durationMs:
                        record.durationMs
                };

            } catch (error) {

                record.running =
                    false;

                record.failedAt =
                    now();

                record.durationMs =
                    record.failedAt -
                    record.startedAt;

                record.failureCount += 1;

                record.lastError =
                    normalizeError(error);

                this.statistics
                    .failed += 1;

                if (
                    error &&
                    error.code ===
                    "EXECUTION_TIMEOUT"
                ) {

                    this.statistics
                        .timeoutFailures += 1;
                }

                this.executions.set(
                    executionName,
                    record
                );

                const repository =
                    getStateRepository();

                if (
                    repository &&
                    typeof repository
                        .addError ===
                    "function"
                ) {

                    try {

                        repository
                            .addError(
                                error,
                                {
                                    execution:
                                        executionName
                                }
                            );

                    } catch (_) {}
                }

                this.error(
                    `Execution failed: ${executionName}`,
                    record.lastError
                );

                throw error;
            }
        }

        forceRelease(name) {

            const executionName =
                normalizeName(name);

            const record =
                this.getRecord(
                    executionName
                );

            if (!record) {
                return false;
            }

            record.running =
                false;

            record.forceReleasedAt =
                now();

            this.executions.set(
                executionName,
                record
            );

            return true;
        }

        forceReleaseAll() {

            let released = 0;

            for (
                const record
                of this.executions.values()
            ) {

                if (
                    record.running
                ) {

                    record.running =
                        false;

                    record.forceReleasedAt =
                        now();

                    released += 1;
                }
            }

            return {
                released
            };
        }

        getDiagnostics() {

            const executions =
                Array.from(
                    this.executions.values()
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

                        durationMs:
                            record.durationMs,

                        startedAt:
                            record.startedAt,

                        completedAt:
                            record.completedAt,

                        failedAt:
                            record.failedAt,

                        lastError:
                            record.lastError
                    })
                );

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

                statistics:
                    clone(
                        this.statistics
                    ),

                runningExecutions:
                    executions.filter(
                        item =>
                            item.running
                    ).length,

                executions
            };
        }

        printDiagnostics() {

            const diagnostics =
                this.getDiagnostics();

            console.log(
                "[RainGuard Phase 39A-4] Execution Guard Diagnostics",
                diagnostics
            );

            if (
                diagnostics
                    .executions
                    .length
            ) {

                console.table(
                    diagnostics.executions
                );
            }

            return diagnostics;
        }

        async selfTest() {

            const testName =
                "__execution_guard_test__";

            const results = {};

            try {

                let active =
                    0;

                let maxActive =
                    0;

                const operation =
                    async () => {

                        active += 1;

                        maxActive =
                            Math.max(
                                active,
                                maxActive
                            );

                        await new Promise(
                            resolve =>
                                global.setTimeout(
                                    resolve,
                                    80
                                )
                        );

                        active -= 1;

                        return true;
                    };

                const firstPromise =
                    this.execute(
                        testName,
                        operation,
                        {
                            value: 1
                        },
                        {
                            useRuntimeGuard:
                                false,

                            useLoopGuard:
                                false,

                            cooldownMs:
                                0
                        }
                    );

                await new Promise(
                    resolve =>
                        global.setTimeout(
                            resolve,
                            10
                        )
                );

                const second =
                    await this.execute(
                        testName,
                        operation,
                        {
                            value: 1
                        },
                        {
                            useRuntimeGuard:
                                false,

                            useLoopGuard:
                                false,

                            cooldownMs:
                                0
                        }
                    );

                const first =
                    await firstPromise;

                results.firstCompleted =
                    first.success === true;

                results.overlapBlocked =
                    (
                        second.skipped === true &&
                        second.reason ===
                            "EXECUTION_ALREADY_RUNNING"
                    );

                results.maxConcurrencyOne =
                    maxActive <= 1;

                this.executions.delete(
                    testName
                );

                results.passed =
                    results.firstCompleted &&
                    results.overlapBlocked &&
                    results.maxConcurrencyOne;

            } catch (error) {

                results.passed =
                    false;

                results.error =
                    normalizeError(error);

                this.executions.delete(
                    testName
                );
            }

            if (
                results.passed
            ) {

                console.log(
                    "%c[RainGuard Phase 39A-4] ExecutionGuard SELF TEST PASSED",
                    "font-weight:bold;color:#16a34a;",
                    results
                );

            } else {

                console.error(
                    "[RainGuard Phase 39A-4] ExecutionGuard SELF TEST FAILED",
                    results
                );
            }

            return results;
        }
    }

    const executionGuard =
        new ExecutionGuardV39();

    global.RainGuardExecutionGuardV39 =
        executionGuard;

    global.RainGuardAI =
        global.RainGuardAI || {};

    global.RainGuardAI.V39 =
        global.RainGuardAI.V39 || {};

    global.RainGuardAI.V39
        .executionGuard =
        executionGuard;

    global.runRainGuardExecutionProtected =
        function (
            name,
            operation,
            payload = null,
            options = {}
        ) {

            return executionGuard
                .execute(
                    name,
                    operation,
                    payload,
                    options
                );
        };

    global.testRainGuardExecutionGuard =
        function () {

            return executionGuard
                .selfTest();
        };

    global.printRainGuardExecutionGuard =
        function () {

            return executionGuard
                .printDiagnostics();
        };

    global.releaseRainGuardExecutionLocks =
        function () {

            return executionGuard
                .forceReleaseAll();
        };

    console.log(
        `%c[RainGuard AI] Phase ${PHASE} — Execution Guard v${VERSION} READY`,
        "font-weight:bold;color:#9333ea;"
    );

})(
    typeof globalThis !==
        "undefined"
        ? globalThis
        : window
);
