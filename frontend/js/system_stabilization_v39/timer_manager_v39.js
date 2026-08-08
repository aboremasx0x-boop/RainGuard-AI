/*
===============================================================================
 RainGuard AI
 Phase 39A-2 — Timer Manager

 File:
 frontend/js/system_stabilization_v39/timer_manager_v39.js

 Version:
 39A.2.0

 Purpose:
 - Centralize timers used by RainGuard.
 - Prevent duplicate setInterval / setTimeout jobs.
 - Prevent overlapping executions for the same timer.
 - Support cooldown and runtime protection through Runtime Guard.
 - Provide diagnostics and safe shutdown.
===============================================================================
*/

(function initializeRainGuardTimerManager(global) {
    "use strict";

    const NAME = "RainGuardTimerManagerV39";
    const PHASE = "39A-2";
    const VERSION = "39A.2.0";
    const BUILD = "rainguard-v39-timer-manager";

    const DEFAULT_CONFIG = Object.freeze({
        enabled: true,

        minimumIntervalMs: 250,

        preventDuplicateNames: true,

        preventOverlap: true,

        useRuntimeGuard: true,

        defaultMaximumRuntimeMs: 30000,

        maximumExecutionsPerTimer: 1000000,

        debug: true
    });

    const now = () => Date.now();

    function normalizeName(value) {
        return String(
            value || ""
        ).trim();
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
                return structuredClone(
                    value
                );
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

    function getRuntimeGuard() {
        return (
            global.RainGuardRuntimeGuardV39 ||
            global.RainGuardAI?.V39
                ?.runtimeGuard ||
            null
        );
    }

    class TimerManagerV39 {

        constructor(config = {}) {

            this.name = NAME;
            this.phase = PHASE;
            this.version = VERSION;
            this.build = BUILD;

            this.config = {
                ...DEFAULT_CONFIG,
                ...(config || {})
            };

            this.timers = new Map();

            this.statistics = {
                registrations: 0,
                duplicateRegistrationsBlocked: 0,
                executions: 0,
                skippedExecutions: 0,
                overlappingExecutionsBlocked: 0,
                completedExecutions: 0,
                failedExecutions: 0,
                stops: 0,
                restarts: 0
            };

            this.ready = true;

            this.log(
                "Timer Manager ready."
            );
        }

        log(message, data) {

            if (!this.config.debug) {
                return;
            }

            console.log(
                `[RainGuard][${PHASE}][TimerManager] ${message}`,
                data !== undefined
                    ? data
                    : ""
            );
        }

        warn(message, data) {

            console.warn(
                `[RainGuard][${PHASE}][TimerManager] ${message}`,
                data !== undefined
                    ? data
                    : ""
            );
        }

        error(message, data) {

            console.error(
                `[RainGuard][${PHASE}][TimerManager] ${message}`,
                data !== undefined
                    ? data
                    : ""
            );
        }

        normalizeInterval(intervalMs) {

            const value =
                Number(
                    intervalMs
                );

            if (
                !Number.isFinite(value)
            ) {
                return this.config
                    .minimumIntervalMs;
            }

            return Math.max(
                this.config
                    .minimumIntervalMs,
                Math.floor(value)
            );
        }

        has(name) {

            return this.timers.has(
                normalizeName(name)
            );
        }

        get(name) {

            const record =
                this.timers.get(
                    normalizeName(name)
                );

            return record
                ? clone(record)
                : null;
        }

        isActive(name) {

            return Boolean(
                this.timers.get(
                    normalizeName(name)
                )?.active
            );
        }

        registerInStateRepository(
            name,
            record
        ) {

            const repository =
                getStateRepository();

            if (
                !repository ||
                typeof repository
                    .registerTimer !==
                "function"
            ) {
                return null;
            }

            try {

                return repository
                    .registerTimer(
                        name,
                        {
                            type:
                                record.type,

                            intervalMs:
                                record.intervalMs,

                            owner:
                                record.owner
                        }
                    );

            } catch (error) {

                this.warn(
                    "State repository timer registration failed.",
                    normalizeError(error)
                );

                return null;
            }
        }

        markTimerExecutedInRepository(
            name
        ) {

            const repository =
                getStateRepository();

            if (
                !repository ||
                typeof repository
                    .markTimerExecuted !==
                "function"
            ) {
                return;
            }

            try {

                repository
                    .markTimerExecuted(
                        name
                    );

            } catch (_) {}
        }

        unregisterFromStateRepository(
            name
        ) {

            const repository =
                getStateRepository();

            if (
                !repository ||
                typeof repository
                    .unregisterTimer !==
                "function"
            ) {
                return;
            }

            try {

                repository
                    .unregisterTimer(
                        name
                    );

            } catch (_) {}
        }

        canRegister(name) {

            const timerName =
                normalizeName(name);

            if (!timerName) {

                return {
                    allowed: false,
                    reason:
                        "INVALID_TIMER_NAME"
                };
            }

            if (
                !this.config
                    .preventDuplicateNames
            ) {

                return {
                    allowed: true,
                    reason:
                        "DUPLICATE_PROTECTION_DISABLED"
                };
            }

            const existing =
                this.timers.get(
                    timerName
                );

            if (
                existing &&
                existing.active
            ) {

                this.statistics
                    .duplicateRegistrationsBlocked += 1;

                return {
                    allowed: false,

                    reason:
                        "DUPLICATE_ACTIVE_TIMER",

                    timer:
                        clone(existing)
                };
            }

            return {
                allowed: true,
                reason:
                    "ALLOWED"
            };
        }

        buildRecord(
            name,
            callback,
            options = {}
        ) {

            const timerName =
                normalizeName(name);

            const type =
                options.type ===
                "timeout"
                    ? "timeout"
                    : "interval";

            const intervalMs =
                this.normalizeInterval(
                    options.intervalMs ??
                    options.delayMs ??
                    1000
                );

            return {
                name:
                    timerName,

                type,

                callback,

                intervalMs,

                owner:
                    options.owner ||
                    null,

                active:
                    true,

                running:
                    false,

                createdAt:
                    now(),

                startedAt:
                    null,

                stoppedAt:
                    null,

                lastExecutionStartedAt:
                    null,

                lastExecutionCompletedAt:
                    null,

                lastExecutionDurationMs:
                    null,

                executionCount:
                    0,

                skippedCount:
                    0,

                failureCount:
                    0,

                maximumRuntimeMs:
                    Number.isFinite(
                        Number(
                            options.maximumRuntimeMs
                        )
                    )
                        ? Number(
                            options.maximumRuntimeMs
                        )
                        : this.config
                            .defaultMaximumRuntimeMs,

                preventOverlap:
                    options.preventOverlap ??
                    this.config
                        .preventOverlap,

                useRuntimeGuard:
                    options.useRuntimeGuard ??
                    this.config
                        .useRuntimeGuard,

                metadata:
                    clone(
                        options.metadata ||
                        {}
                    ),

                handle:
                    null,

                lastError:
                    null
            };
        }

        async executeTimer(
            name
        ) {

            const timerName =
                normalizeName(name);

            const record =
                this.timers.get(
                    timerName
                );

            if (
                !record ||
                !record.active
            ) {

                return {
                    executed: false,
                    reason:
                        "TIMER_INACTIVE"
                };
            }

            if (
                record.executionCount >=
                this.config
                    .maximumExecutionsPerTimer
            ) {

                this.warn(
                    `Maximum timer execution count reached: ${timerName}`
                );

                this.stop(
                    timerName,
                    "MAXIMUM_EXECUTION_COUNT_REACHED"
                );

                return {
                    executed: false,
                    reason:
                        "MAXIMUM_EXECUTION_COUNT_REACHED"
                };
            }

            if (
                record.preventOverlap &&
                record.running
            ) {

                record.skippedCount += 1;

                this.statistics
                    .skippedExecutions += 1;

                this.statistics
                    .overlappingExecutionsBlocked += 1;

                this.timers.set(
                    timerName,
                    record
                );

                return {
                    executed: false,
                    skipped: true,
                    reason:
                        "PREVIOUS_TIMER_EXECUTION_STILL_RUNNING"
                };
            }

            const runtimeGuard =
                getRuntimeGuard();

            if (
                record.useRuntimeGuard &&
                runtimeGuard &&
                typeof runtimeGuard
                    .runGuarded ===
                "function"
            ) {

                const guardName =
                    `timer:${timerName}`;

                const result =
                    await runtimeGuard
                        .runGuarded(
                            guardName,
                            async () => {

                                return this
                                    .executeCallback(
                                        timerName
                                    );
                            },
                            {
                                cooldownMs: 0,

                                maximumRuntimeMs:
                                    record
                                        .maximumRuntimeMs,

                                metadata: {
                                    timer:
                                        timerName,

                                    owner:
                                        record.owner
                                }
                            }
                        );

                if (
                    result &&
                    result.skipped
                ) {

                    const latest =
                        this.timers.get(
                            timerName
                        );

                    if (latest) {

                        latest.skippedCount += 1;

                        this.timers.set(
                            timerName,
                            latest
                        );
                    }

                    this.statistics
                        .skippedExecutions += 1;
                }

                return result;
            }

            return this.executeCallback(
                timerName
            );
        }

        async executeCallback(
            name
        ) {

            const timerName =
                normalizeName(name);

            const record =
                this.timers.get(
                    timerName
                );

            if (
                !record ||
                !record.active
            ) {

                return {
                    executed: false,
                    reason:
                        "TIMER_NOT_AVAILABLE"
                };
            }

            record.running = true;

            record.startedAt =
                record.startedAt ||
                now();

            record.lastExecutionStartedAt =
                now();

            record.executionCount += 1;

            this.statistics
                .executions += 1;

            this.timers.set(
                timerName,
                record
            );

            this.markTimerExecutedInRepository(
                timerName
            );

            try {

                const result =
                    await Promise.resolve(
                        record.callback({
                            name:
                                timerName,

                            executionCount:
                                record
                                    .executionCount,

                            timestamp:
                                now()
                        })
                    );

                const completedAt =
                    now();

                record.running =
                    false;

                record
                    .lastExecutionCompletedAt =
                    completedAt;

                record
                    .lastExecutionDurationMs =
                    completedAt -
                    record
                        .lastExecutionStartedAt;

                record.lastError =
                    null;

                this.statistics
                    .completedExecutions += 1;

                this.timers.set(
                    timerName,
                    record
                );

                if (
                    record.type ===
                    "timeout"
                ) {

                    this.stop(
                        timerName,
                        "TIMEOUT_COMPLETED"
                    );
                }

                return {
                    executed: true,

                    success: true,

                    result,

                    durationMs:
                        record
                            .lastExecutionDurationMs
                };

            } catch (error) {

                const failedAt =
                    now();

                record.running =
                    false;

                record
                    .lastExecutionCompletedAt =
                    failedAt;

                record
                    .lastExecutionDurationMs =
                    failedAt -
                    record
                        .lastExecutionStartedAt;

                record.failureCount += 1;

                record.lastError =
                    normalizeError(error);

                this.statistics
                    .failedExecutions += 1;

                this.timers.set(
                    timerName,
                    record
                );

                this.error(
                    `Timer execution failed: ${timerName}`,
                    record.lastError
                );

                if (
                    record.type ===
                    "timeout"
                ) {

                    this.stop(
                        timerName,
                        "TIMEOUT_FAILED"
                    );
                }

                return {
                    executed: true,

                    success: false,

                    error:
                        record.lastError
                };
            }
        }

        registerInterval(
            name,
            callback,
            intervalMs,
            options = {}
        ) {

            return this.register(
                name,
                callback,
                {
                    ...options,

                    type:
                        "interval",

                    intervalMs
                }
            );
        }

        registerTimeout(
            name,
            callback,
            delayMs,
            options = {}
        ) {

            return this.register(
                name,
                callback,
                {
                    ...options,

                    type:
                        "timeout",

                    delayMs
                }
            );
        }

        register(
            name,
            callback,
            options = {}
        ) {

            if (
                typeof callback !==
                "function"
            ) {

                throw new TypeError(
                    "Timer callback must be a function."
                );
            }

            const timerName =
                normalizeName(name);

            const permission =
                this.canRegister(
                    timerName
                );

            if (
                !permission.allowed
            ) {

                return {
                    registered: false,
                    ...permission
                };
            }

            const record =
                this.buildRecord(
                    timerName,
                    callback,
                    options
                );

            const execute =
                () => {

                    this.executeTimer(
                        timerName
                    ).catch(
                        error => {

                            this.error(
                                `Unhandled timer error: ${timerName}`,
                                normalizeError(
                                    error
                                )
                            );
                        }
                    );
                };

            if (
                record.type ===
                "timeout"
            ) {

                record.handle =
                    global.setTimeout(
                        execute,
                        record.intervalMs
                    );

            } else {

                record.handle =
                    global.setInterval(
                        execute,
                        record.intervalMs
                    );
            }

            this.timers.set(
                timerName,
                record
            );

            this.statistics
                .registrations += 1;

            this.registerInStateRepository(
                timerName,
                record
            );

            this.log(
                `Timer registered: ${timerName}`,
                {
                    type:
                        record.type,

                    intervalMs:
                        record.intervalMs,

                    owner:
                        record.owner
                }
            );

            return {
                registered: true,

                name:
                    timerName,

                timer:
                    clone(record)
            };
        }

        stop(
            name,
            reason = "MANUAL_STOP"
        ) {

            const timerName =
                normalizeName(name);

            const record =
                this.timers.get(
                    timerName
                );

            if (!record) {

                return {
                    stopped: false,
                    reason:
                        "TIMER_NOT_FOUND"
                };
            }

            if (
                record.handle !==
                null
            ) {

                if (
                    record.type ===
                    "timeout"
                ) {

                    global.clearTimeout(
                        record.handle
                    );

                } else {

                    global.clearInterval(
                        record.handle
                    );
                }
            }

            record.active =
                false;

            record.running =
                false;

            record.stoppedAt =
                now();

            record.stopReason =
                reason;

            record.handle =
                null;

            this.timers.set(
                timerName,
                record
            );

            this.statistics
                .stops += 1;

            this.unregisterFromStateRepository(
                timerName
            );

            this.log(
                `Timer stopped: ${timerName}`,
                {
                    reason
                }
            );

            return {
                stopped: true,

                timer:
                    clone(record)
            };
        }

        stopAll(
            reason =
                "SYSTEM_STOP_ALL"
        ) {

            let stopped = 0;

            for (
                const [
                    name,
                    record
                ]
                of this.timers
            ) {

                if (
                    record.active
                ) {

                    const result =
                        this.stop(
                            name,
                            reason
                        );

                    if (
                        result.stopped
                    ) {
                        stopped += 1;
                    }
                }
            }

            return {
                stopped
            };
        }

        remove(name) {

            const timerName =
                normalizeName(name);

            if (
                this.isActive(
                    timerName
                )
            ) {

                this.stop(
                    timerName,
                    "REMOVE"
                );
            }

            return this.timers.delete(
                timerName
            );
        }

        restart(
            name,
            options = {}
        ) {

            const timerName =
                normalizeName(name);

            const existing =
                this.timers.get(
                    timerName
                );

            if (!existing) {

                return {
                    restarted: false,
                    reason:
                        "TIMER_NOT_FOUND"
                };
            }

            const callback =
                existing.callback;

            const intervalMs =
                options.intervalMs ??
                existing.intervalMs;

            const timerOptions = {
                type:
                    existing.type,

                owner:
                    existing.owner,

                preventOverlap:
                    existing
                        .preventOverlap,

                useRuntimeGuard:
                    existing
                        .useRuntimeGuard,

                maximumRuntimeMs:
                    existing
                        .maximumRuntimeMs,

                metadata:
                    existing.metadata,

                ...options
            };

            this.stop(
                timerName,
                "RESTART"
            );

            this.timers.delete(
                timerName
            );

            this.statistics
                .restarts += 1;

            const registration =
                this.register(
                    timerName,
                    callback,
                    existing.type ===
                    "timeout"
                        ? {
                            ...timerOptions,

                            delayMs:
                                intervalMs
                        }
                        : {
                            ...timerOptions,

                            intervalMs
                        }
                );

            return {
                restarted:
                    Boolean(
                        registration
                            .registered
                    ),

                registration
            };
        }

        getActiveTimers() {

            return Array.from(
                this.timers.values()
            )
                .filter(
                    timer =>
                        timer.active
                )
                .map(clone);
        }

        getDiagnostics() {

            const timers =
                Array.from(
                    this.timers.values()
                )
                    .map(
                        timer => ({
                            name:
                                timer.name,

                            type:
                                timer.type,

                            intervalMs:
                                timer.intervalMs,

                            owner:
                                timer.owner,

                            active:
                                timer.active,

                            running:
                                timer.running,

                            executionCount:
                                timer.executionCount,

                            skippedCount:
                                timer.skippedCount,

                            failureCount:
                                timer.failureCount,

                            lastExecutionDurationMs:
                                timer
                                    .lastExecutionDurationMs,

                            lastError:
                                timer.lastError
                        })
                    );

            return {
                name: NAME,
                phase: PHASE,
                version: VERSION,
                build: BUILD,

                ready:
                    this.ready,

                totalTimers:
                    timers.length,

                activeTimers:
                    timers.filter(
                        timer =>
                            timer.active
                    ).length,

                runningTimers:
                    timers.filter(
                        timer =>
                            timer.running
                    ).length,

                statistics:
                    clone(
                        this.statistics
                    ),

                timers
            };
        }

        printDiagnostics() {

            const diagnostics =
                this.getDiagnostics();

            console.log(
                "[RainGuard Phase 39A-2] Timer Manager Diagnostics",
                diagnostics
            );

            if (
                diagnostics
                    .timers
                    .length
            ) {

                console.table(
                    diagnostics.timers
                );
            }

            return diagnostics;
        }

        async selfTest() {

            const testTimer =
                "__timer_manager_test__";

            let concurrentExecutions =
                0;

            let maximumConcurrent =
                0;

            let executionCount =
                0;

            const results = {};

            try {

                const first =
                    this.registerInterval(
                        testTimer,
                        async () => {

                            concurrentExecutions += 1;

                            maximumConcurrent =
                                Math.max(
                                    maximumConcurrent,
                                    concurrentExecutions
                                );

                            executionCount += 1;

                            await new Promise(
                                resolve =>
                                    global.setTimeout(
                                        resolve,
                                        70
                                    )
                            );

                            concurrentExecutions -= 1;
                        },
                        30,
                        {
                            preventOverlap:
                                true,

                            useRuntimeGuard:
                                false
                        }
                    );

                results.registration =
                    first.registered ===
                    true;

                const duplicate =
                    this.registerInterval(
                        testTimer,
                        () => {},
                        30
                    );

                results.duplicateBlocked =
                    (
                        duplicate.registered ===
                        false &&
                        duplicate.reason ===
                            "DUPLICATE_ACTIVE_TIMER"
                    );

                await new Promise(
                    resolve =>
                        global.setTimeout(
                            resolve,
                            220
                        )
                );

                const diagnostics =
                    this.get(
                        testTimer
                    );

                results.executed =
                    executionCount > 0;

                results.overlapProtected =
                    maximumConcurrent <= 1;

                results.skipsRecorded =
                    (
                        diagnostics &&
                        diagnostics
                            .skippedCount > 0
                    );

                this.stop(
                    testTimer,
                    "SELF_TEST_COMPLETE"
                );

                this.remove(
                    testTimer
                );

                results.passed =
                    results.registration &&
                    results.duplicateBlocked &&
                    results.executed &&
                    results.overlapProtected &&
                    results.skipsRecorded;

            } catch (error) {

                results.passed =
                    false;

                results.error =
                    normalizeError(error);

                try {

                    this.stop(
                        testTimer,
                        "SELF_TEST_ERROR"
                    );

                    this.remove(
                        testTimer
                    );

                } catch (_) {}
            }

            if (
                results.passed
            ) {

                console.log(
                    "%c[RainGuard Phase 39A-2] TimerManager SELF TEST PASSED",
                    "font-weight:bold;color:#16a34a;",
                    results
                );

            } else {

                console.error(
                    "[RainGuard Phase 39A-2] TimerManager SELF TEST FAILED",
                    results
                );
            }

            return results;
        }
    }

    const timerManager =
        new TimerManagerV39();

    global.RainGuardTimerManagerV39 =
        timerManager;

    global.RainGuardAI =
        global.RainGuardAI ||
        {};

    global.RainGuardAI.V39 =
        global.RainGuardAI.V39 ||
        {};

    global.RainGuardAI.V39
        .timerManager =
        timerManager;

    global.registerRainGuardInterval =
        function (
            name,
            callback,
            intervalMs,
            options = {}
        ) {

            return timerManager
                .registerInterval(
                    name,
                    callback,
                    intervalMs,
                    options
                );
        };

    global.registerRainGuardTimeout =
        function (
            name,
            callback,
            delayMs,
            options = {}
        ) {

            return timerManager
                .registerTimeout(
                    name,
                    callback,
                    delayMs,
                    options
                );
        };

    global.stopRainGuardTimer =
        function (
            name
        ) {

            return timerManager
                .stop(name);
        };

    global.stopAllRainGuardTimers =
        function () {

            return timerManager
                .stopAll();
        };

    global.testRainGuardTimerManager =
        function () {

            return timerManager
                .selfTest();
        };

    global.printRainGuardTimerManager =
        function () {

            return timerManager
                .printDiagnostics();
        };

    console.log(
        `%c[RainGuard AI] Phase ${PHASE} — Timer Manager v${VERSION} READY`,
        "font-weight:bold;color:#0891b2;"
    );

})(
    typeof globalThis !==
        "undefined"
        ? globalThis
        : window
);
