/*
===============================================================================
 RainGuard AI V32
 Phase 39A — Runtime Stabilization Core

 File:
 frontend/js/system_stabilization_v39/system_state_repository.js

 Version:
 39A.1.0

 Purpose:
 - Central runtime state repository for RainGuard.
 - Track engine health.
 - Track active operations.
 - Track locks.
 - Track timers.
 - Track errors and warnings.
 - Provide a single source of truth for Phase 39.
===============================================================================
*/

(function initializeRainGuardSystemStateRepository(global) {
    "use strict";

    const ENGINE_NAME =
        "RainGuardSystemStateRepository";

    const PHASE =
        "39A";

    const VERSION =
        "39A.1.0";

    const BUILD =
        "rainguard-system-stabilization-state-repository";


    /* =======================================================================
     * Helpers
     * ======================================================================= */

    const now =
        () => Date.now();


    function nowIso() {
        return new Date().toISOString();
    }


    function isObject(value) {
        return (
            value !== null &&
            typeof value === "object" &&
            !Array.isArray(value)
        );
    }


    function cloneValue(value) {

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


    function normalizeName(value) {

        return String(
            value || ""
        )
            .trim();
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
                nowIso()
        };
    }


    /* =======================================================================
     * Repository
     * ======================================================================= */

    class SystemStateRepository {

        constructor() {

            this.name =
                ENGINE_NAME;

            this.phase =
                PHASE;

            this.version =
                VERSION;

            this.build =
                BUILD;


            this.createdAt =
                now();


            this.engines =
                new Map();

            this.operations =
                new Map();

            this.locks =
                new Map();

            this.timers =
                new Map();

            this.errors =
                [];

            this.warnings =
                [];

            this.events =
                [];


            this.statistics = {

                engineRegistrations:
                    0,

                operationStarts:
                    0,

                operationCompletes:
                    0,

                operationFailures:
                    0,

                lockAcquisitions:
                    0,

                lockRejections:
                    0,

                timerRegistrations:
                    0,

                duplicateTimersPrevented:
                    0,

                errors:
                    0,

                warnings:
                    0
            };


            this.configuration = {

                maximumErrors:
                    250,

                maximumWarnings:
                    250,

                maximumEvents:
                    500,

                debug:
                    true
            };


            this.ready =
                true;


            this.log(
                "System State Repository ready."
            );
        }


        /* ===================================================================
         * Logging
         * =================================================================== */

        log(
            message,
            data = undefined
        ) {

            if (
                !this.configuration.debug
            ) {
                return;
            }


            const prefix =
                `[RainGuard][Phase ${PHASE}][StateRepository]`;


            if (
                data !== undefined
            ) {

                console.log(
                    prefix,
                    message,
                    data
                );

            } else {

                console.log(
                    prefix,
                    message
                );
            }
        }


        warn(
            message,
            data = undefined
        ) {

            console.warn(
                `[RainGuard][Phase ${PHASE}][StateRepository]`,
                message,
                data || ""
            );
        }


        error(
            message,
            data = undefined
        ) {

            console.error(
                `[RainGuard][Phase ${PHASE}][StateRepository]`,
                message,
                data || ""
            );
        }


        /* ===================================================================
         * Engine Registry
         * =================================================================== */

        registerEngine(
            name,
            metadata = {}
        ) {

            const engineName =
                normalizeName(name);


            if (!engineName) {

                throw new Error(
                    "ENGINE_NAME_REQUIRED"
                );
            }


            const existing =
                this.engines.get(
                    engineName
                );


            const record = {

                name:
                    engineName,

                phase:
                    metadata.phase ||
                    null,

                version:
                    metadata.version ||
                    null,

                source:
                    metadata.source ||
                    null,

                status:
                    metadata.status ||
                    existing?.status ||
                    "registered",

                ready:
                    Boolean(
                        metadata.ready ??
                        existing?.ready ??
                        false
                    ),

                running:
                    Boolean(
                        metadata.running ??
                        existing?.running ??
                        false
                    ),

                failed:
                    Boolean(
                        metadata.failed ??
                        existing?.failed ??
                        false
                    ),

                healthy:
                    Boolean(
                        metadata.healthy ??
                        existing?.healthy ??
                        true
                    ),

                registeredAt:
                    existing?.registeredAt ||
                    now(),

                updatedAt:
                    now(),

                lastStartedAt:
                    existing?.lastStartedAt ||
                    null,

                lastCompletedAt:
                    existing?.lastCompletedAt ||
                    null,

                lastFailedAt:
                    existing?.lastFailedAt ||
                    null,

                lastError:
                    existing?.lastError ||
                    null,

                runCount:
                    existing?.runCount ||
                    0,

                failureCount:
                    existing?.failureCount ||
                    0,

                metadata: {
                    ...(
                        existing?.metadata ||
                        {}
                    ),

                    ...(
                        isObject(
                            metadata.metadata
                        )
                            ? metadata.metadata
                            : {}
                    )
                }
            };


            this.engines.set(
                engineName,
                record
            );


            if (!existing) {

                this.statistics
                    .engineRegistrations += 1;
            }


            this.addEvent(
                "engine_registered",
                {
                    engine:
                        engineName
                }
            );


            return cloneValue(
                record
            );
        }


        updateEngine(
            name,
            updates = {}
        ) {

            const engineName =
                normalizeName(name);


            if (!engineName) {
                return null;
            }


            const existing =
                this.engines.get(
                    engineName
                );


            if (!existing) {

                return this.registerEngine(
                    engineName,
                    updates
                );
            }


            const record = {

                ...existing,

                ...updates,

                metadata: {
                    ...(
                        existing.metadata ||
                        {}
                    ),

                    ...(
                        isObject(
                            updates.metadata
                        )
                            ? updates.metadata
                            : {}
                    )
                },

                updatedAt:
                    now()
            };


            this.engines.set(
                engineName,
                record
            );


            return cloneValue(
                record
            );
        }


        markEngineReady(
            name
        ) {

            return this.updateEngine(
                name,
                {
                    status:
                        "ready",

                    ready:
                        true,

                    failed:
                        false,

                    healthy:
                        true
                }
            );
        }


        markEngineRunning(
            name
        ) {

            const engineName =
                normalizeName(name);

            const existing =
                this.engines.get(
                    engineName
                ) ||
                this.registerEngine(
                    engineName
                );


            return this.updateEngine(
                engineName,
                {
                    status:
                        "running",

                    ready:
                        true,

                    running:
                        true,

                    failed:
                        false,

                    healthy:
                        true,

                    lastStartedAt:
                        now(),

                    runCount:
                        (
                            existing.runCount ||
                            0
                        ) + 1
                }
            );
        }


        markEngineCompleted(
            name
        ) {

            return this.updateEngine(
                name,
                {
                    status:
                        "ready",

                    running:
                        false,

                    ready:
                        true,

                    failed:
                        false,

                    healthy:
                        true,

                    lastCompletedAt:
                        now()
                }
            );
        }


        markEngineFailed(
            name,
            error
        ) {

            const engineName =
                normalizeName(name);


            const existing =
                this.engines.get(
                    engineName
                ) ||
                {};


            const normalizedError =
                normalizeError(
                    error
                );


            this.addError(
                normalizedError,
                {
                    engine:
                        engineName
                }
            );


            return this.updateEngine(
                engineName,
                {
                    status:
                        "failed",

                    running:
                        false,

                    failed:
                        true,

                    healthy:
                        false,

                    lastFailedAt:
                        now(),

                    lastError:
                        normalizedError,

                    failureCount:
                        (
                            existing.failureCount ||
                            0
                        ) + 1
                }
            );
        }


        getEngine(
            name
        ) {

            return cloneValue(
                this.engines.get(
                    normalizeName(name)
                ) ||
                null
            );
        }


        getEngines() {

            return Array.from(
                this.engines.values()
            ).map(
                cloneValue
            );
        }


        /* ===================================================================
         * Operations
         * =================================================================== */

        startOperation(
            id,
            metadata = {}
        ) {

            const operationId =
                normalizeName(id);


            if (!operationId) {

                throw new Error(
                    "OPERATION_ID_REQUIRED"
                );
            }


            const existing =
                this.operations.get(
                    operationId
                );


            if (
                existing &&
                existing.running
            ) {

                return {
                    accepted:
                        false,

                    reason:
                        "OPERATION_ALREADY_RUNNING",

                    operation:
                        cloneValue(
                            existing
                        )
                };
            }


            const record = {

                id:
                    operationId,

                engine:
                    metadata.engine ||
                    null,

                type:
                    metadata.type ||
                    null,

                running:
                    true,

                startedAt:
                    now(),

                completedAt:
                    null,

                failedAt:
                    null,

                durationMs:
                    null,

                result:
                    null,

                error:
                    null,

                metadata:
                    isObject(
                        metadata.metadata
                    )
                        ? {
                            ...metadata.metadata
                        }
                        : {}
            };


            this.operations.set(
                operationId,
                record
            );


            this.statistics
                .operationStarts += 1;


            this.addEvent(
                "operation_started",
                {
                    operationId
                }
            );


            return {
                accepted:
                    true,

                operation:
                    cloneValue(
                        record
                    )
            };
        }


        completeOperation(
            id,
            result = null
        ) {

            const operationId =
                normalizeName(id);


            const record =
                this.operations.get(
                    operationId
                );


            if (!record) {
                return null;
            }


            const completedAt =
                now();


            const updated = {

                ...record,

                running:
                    false,

                completedAt,

                durationMs:
                    completedAt -
                    record.startedAt,

                result:
                    cloneValue(
                        result
                    )
            };


            this.operations.set(
                operationId,
                updated
            );


            this.statistics
                .operationCompletes += 1;


            return cloneValue(
                updated
            );
        }


        failOperation(
            id,
            error
        ) {

            const operationId =
                normalizeName(id);


            const record =
                this.operations.get(
                    operationId
                );


            if (!record) {
                return null;
            }


            const failedAt =
                now();


            const normalizedError =
                normalizeError(
                    error
                );


            const updated = {

                ...record,

                running:
                    false,

                failedAt,

                durationMs:
                    failedAt -
                    record.startedAt,

                error:
                    normalizedError
            };


            this.operations.set(
                operationId,
                updated
            );


            this.statistics
                .operationFailures += 1;


            this.addError(
                normalizedError,
                {
                    operationId
                }
            );


            return cloneValue(
                updated
            );
        }


        isOperationRunning(
            id
        ) {

            return Boolean(
                this.operations.get(
                    normalizeName(id)
                )?.running
            );
        }


        /* ===================================================================
         * Locks
         * =================================================================== */

        acquireLock(
            name,
            owner = null
        ) {

            const lockName =
                normalizeName(name);


            if (!lockName) {

                throw new Error(
                    "LOCK_NAME_REQUIRED"
                );
            }


            const existing =
                this.locks.get(
                    lockName
                );


            if (
                existing &&
                existing.locked
            ) {

                this.statistics
                    .lockRejections += 1;


                return {

                    acquired:
                        false,

                    reason:
                        "LOCK_ALREADY_HELD",

                    lock:
                        cloneValue(
                            existing
                        )
                };
            }


            const record = {

                name:
                    lockName,

                owner:
                    owner ||
                    null,

                locked:
                    true,

                acquiredAt:
                    now(),

                releasedAt:
                    null
            };


            this.locks.set(
                lockName,
                record
            );


            this.statistics
                .lockAcquisitions += 1;


            return {

                acquired:
                    true,

                lock:
                    cloneValue(
                        record
                    )
            };
        }


        releaseLock(
            name
        ) {

            const lockName =
                normalizeName(name);


            const record =
                this.locks.get(
                    lockName
                );


            if (!record) {
                return false;
            }


            this.locks.set(
                lockName,
                {
                    ...record,

                    locked:
                        false,

                    releasedAt:
                        now()
                }
            );


            return true;
        }


        isLocked(
            name
        ) {

            return Boolean(
                this.locks.get(
                    normalizeName(name)
                )?.locked
            );
        }


        getLocks() {

            return Array.from(
                this.locks.values()
            ).map(
                cloneValue
            );
        }


        /* ===================================================================
         * Timers
         * =================================================================== */

        registerTimer(
            name,
            metadata = {}
        ) {

            const timerName =
                normalizeName(name);


            if (!timerName) {

                throw new Error(
                    "TIMER_NAME_REQUIRED"
                );
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
                    .duplicateTimersPrevented += 1;


                return {

                    registered:
                        false,

                    reason:
                        "DUPLICATE_ACTIVE_TIMER",

                    timer:
                        cloneValue(
                            existing
                        )
                };
            }


            const record = {

                name:
                    timerName,

                type:
                    metadata.type ||
                    "interval",

                intervalMs:
                    metadata.intervalMs ||
                    null,

                owner:
                    metadata.owner ||
                    null,

                active:
                    true,

                registeredAt:
                    now(),

                stoppedAt:
                    null,

                executionCount:
                    0,

                lastExecutedAt:
                    null
            };


            this.timers.set(
                timerName,
                record
            );


            this.statistics
                .timerRegistrations += 1;


            return {

                registered:
                    true,

                timer:
                    cloneValue(
                        record
                    )
            };
        }


        markTimerExecuted(
            name
        ) {

            const timerName =
                normalizeName(name);


            const record =
                this.timers.get(
                    timerName
                );


            if (!record) {
                return null;
            }


            const updated = {

                ...record,

                executionCount:
                    (
                        record.executionCount ||
                        0
                    ) + 1,

                lastExecutedAt:
                    now()
            };


            this.timers.set(
                timerName,
                updated
            );


            return cloneValue(
                updated
            );
        }


        unregisterTimer(
            name
        ) {

            const timerName =
                normalizeName(name);


            const record =
                this.timers.get(
                    timerName
                );


            if (!record) {
                return false;
            }


            this.timers.set(
                timerName,
                {
                    ...record,

                    active:
                        false,

                    stoppedAt:
                        now()
                }
            );


            return true;
        }


        getTimers() {

            return Array.from(
                this.timers.values()
            ).map(
                cloneValue
            );
        }


        /* ===================================================================
         * Errors / Warnings
         * =================================================================== */

        addError(
            error,
            context = {}
        ) {

            const record = {

                error:
                    normalizeError(
                        error
                    ),

                context:
                    isObject(
                        context
                    )
                        ? {
                            ...context
                        }
                        : {},

                timestamp:
                    now(),

                timestampIso:
                    nowIso()
            };


            this.errors.push(
                record
            );


            while (
                this.errors.length >
                this.configuration.maximumErrors
            ) {

                this.errors.shift();
            }


            this.statistics.errors += 1;


            return cloneValue(
                record
            );
        }


        addWarning(
            message,
            context = {}
        ) {

            const record = {

                message:
                    String(message),

                context:
                    isObject(
                        context
                    )
                        ? {
                            ...context
                        }
                        : {},

                timestamp:
                    now(),

                timestampIso:
                    nowIso()
            };


            this.warnings.push(
                record
            );


            while (
                this.warnings.length >
                this.configuration.maximumWarnings
            ) {

                this.warnings.shift();
            }


            this.statistics
                .warnings += 1;


            return cloneValue(
                record
            );
        }


        /* ===================================================================
         * Events
         * =================================================================== */

        addEvent(
            type,
            data = {}
        ) {

            const record = {

                type:
                    normalizeName(type),

                data:
                    cloneValue(
                        data
                    ),

                timestamp:
                    now(),

                timestampIso:
                    nowIso()
            };


            this.events.push(
                record
            );


            while (
                this.events.length >
                this.configuration.maximumEvents
            ) {

                this.events.shift();
            }


            return cloneValue(
                record
            );
        }


        /* ===================================================================
         * Health
         * =================================================================== */

        getHealthSummary() {

            const engines =
                this.getEngines();


            const timers =
                this.getTimers();


            const locks =
                this.getLocks();


            return {

                status:
                    engines.some(
                        engine =>
                            engine.failed
                    )
                        ? "DEGRADED"
                        : "HEALTHY",

                engines: {

                    total:
                        engines.length,

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
                        ).length
                },

                timers: {

                    total:
                        timers.length,

                    active:
                        timers.filter(
                            timer =>
                                timer.active
                        ).length
                },

                locks: {

                    total:
                        locks.length,

                    active:
                        locks.filter(
                            lock =>
                                lock.locked
                        ).length
                },

                errors:
                    this.errors.length,

                warnings:
                    this.warnings.length,

                updatedAt:
                    now(),

                updatedAtIso:
                    nowIso()
            };
        }


        /* ===================================================================
         * Diagnostics
         * =================================================================== */

        getDiagnostics() {

            return {

                engine:
                    ENGINE_NAME,

                phase:
                    PHASE,

                version:
                    VERSION,

                build:
                    BUILD,

                ready:
                    this.ready,

                engines:
                    this.getEngines(),

                operations:
                    Array.from(
                        this.operations.values()
                    ).map(
                        cloneValue
                    ),

                locks:
                    this.getLocks(),

                timers:
                    this.getTimers(),

                statistics:
                    cloneValue(
                        this.statistics
                    ),

                health:
                    this.getHealthSummary(),

                errors:
                    cloneValue(
                        this.errors
                    ),

                warnings:
                    cloneValue(
                        this.warnings
                    )
            };
        }


        printDiagnostics() {

            const diagnostics =
                this.getDiagnostics();


            console.log(
                "[RainGuard Phase 39A] System State Diagnostics",
                diagnostics
            );


            if (
                diagnostics.engines.length
            ) {

                console.table(
                    diagnostics.engines
                );
            }


            if (
                diagnostics.timers.length
            ) {

                console.table(
                    diagnostics.timers
                );
            }


            return diagnostics;
        }


        selfTest() {

            const testEngine =
                "__phase39a_test_engine__";


            const testLock =
                "__phase39a_test_lock__";


            const testTimer =
                "__phase39a_test_timer__";


            const results = {};


            try {

                this.registerEngine(
                    testEngine
                );

                results.engineRegistration =
                    Boolean(
                        this.getEngine(
                            testEngine
                        )
                    );


                const lock =
                    this.acquireLock(
                        testLock,
                        "self_test"
                    );


                results.lockAcquisition =
                    lock.acquired ===
                    true;


                const duplicateLock =
                    this.acquireLock(
                        testLock,
                        "self_test_2"
                    );


                results.lockProtection =
                    duplicateLock.acquired ===
                    false;


                this.releaseLock(
                    testLock
                );


                const timer =
                    this.registerTimer(
                        testTimer,
                        {
                            intervalMs:
                                1000
                        }
                    );


                results.timerRegistration =
                    timer.registered ===
                    true;


                const duplicateTimer =
                    this.registerTimer(
                        testTimer,
                        {
                            intervalMs:
                                1000
                        }
                    );


                results.timerProtection =
                    duplicateTimer.registered ===
                    false;


                this.unregisterTimer(
                    testTimer
                );


                this.engines.delete(
                    testEngine
                );


                this.locks.delete(
                    testLock
                );


                this.timers.delete(
                    testTimer
                );


                results.passed =
                    Object.values(
                        results
                    ).every(
                        Boolean
                    );


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
                    "%c[RainGuard Phase 39A] SystemStateRepository SELF TEST PASSED",
                    "font-weight:bold;color:#16a34a;",
                    results
                );

            } else {

                console.error(
                    "[RainGuard Phase 39A] SystemStateRepository SELF TEST FAILED",
                    results
                );
            }


            return results;
        }
    }


    /* =======================================================================
     * Singleton
     * ======================================================================= */

    const repository =
        new SystemStateRepository();


    global.RainGuardSystemStateRepository =
        repository;


    global.RainGuardAI =
        global.RainGuardAI ||
        {};


    global.RainGuardAI.V39 =
        global.RainGuardAI.V39 ||
        {};


    global.RainGuardAI.V39
        .systemStateRepository =
        repository;


    global.testRainGuardSystemStateRepository =
        function () {

            return repository
                .selfTest();
        };


    global.printRainGuardSystemState =
        function () {

            return repository
                .printDiagnostics();
        };


    console.log(
        `%c[RainGuard AI] Phase ${PHASE} — System State Repository v${VERSION} READY`,
        "font-weight:bold;color:#2563eb;"
    );


})(
    typeof globalThis !==
        "undefined"
        ? globalThis
        : window
);
