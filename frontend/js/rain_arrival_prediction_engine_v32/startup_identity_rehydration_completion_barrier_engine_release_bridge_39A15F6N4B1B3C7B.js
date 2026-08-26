/*
 * RainGuard AI
 * Phase 39A-15F6N4B1B3C7B
 *
 * Startup Identity Rehydration Completion Barrier
 * & Engine Release Bridge
 *
 * Purpose
 * -------
 * - Ensure startup runtime identity rehydration converges before engines are released.
 * - Trigger C6 when runtime identity coverage is incomplete.
 * - Re-check persisted/runtime convergence across multiple attempts.
 * - Require C7A strict readiness verification before final engine release.
 * - Prevent engine release when runtime identity coverage is incomplete.
 */

(function (global) {
    "use strict";

    const PHASE = "39A-15F6N4B1B3C7B";
    const VERSION = "39A.15F6N4B1B3C7B.0";

    const BUILD =
        "rainguard-v39-startup-identity-rehydration-completion-barrier-engine-release-bridge";

    const C6_NAME =
        "RainGuard39A15F6N4B1B3C6BridgeV39";

    const C7_NAME =
        "RainGuard39A15F6N4B1B3C7BridgeV39";

    const C7A_NAME =
        "RainGuard39A15F6N4B1B3C7ABridgeV39";

    const BRIDGE_NAME =
        "RainGuard39A15F6N4B1B3C7BBridgeV39";

    const RUN_NAME =
        "runRainGuard39A15F6N4B1B3C7BStartupIdentityRehydrationCompletionBarrier";

    const DIAG_NAME =
        "diagnoseRainGuard39A15F6N4B1B3C7BStartupIdentityRehydrationCompletionBarrier";

    const MINIMUM_COVERAGE_PERCENT = 99;

    const MAX_ATTEMPTS = 10;
    const INITIAL_RETRY_DELAY_MS = 1000;
    const MAX_RETRY_DELAY_MS = 5000;
    const POST_C6_SETTLE_MS = 250;

    const AUTO_START_DELAY_MS = 750;

    const READY_EVENT =
        "rainguard:engine-release-ready";

    const BLOCKED_EVENT =
        "rainguard:engine-release-blocked";

    const STATE_EVENT =
        "rainguard:engine-release-state";

    const STATES = Object.freeze({
        IDLE:
            "IDLE",

        WAITING_FOR_INDEXEDDB:
            "WAITING_FOR_INDEXEDDB",

        WAITING_FOR_C6:
            "WAITING_FOR_C6",

        RUNNING_STARTUP_REHYDRATION:
            "RUNNING_STARTUP_REHYDRATION",

        WAITING_FOR_RUNTIME_CONVERGENCE:
            "WAITING_FOR_RUNTIME_CONVERGENCE",

        VERIFYING_REHYDRATION_COMPLETION:
            "VERIFYING_REHYDRATION_COMPLETION",

        WAITING_FOR_STRICT_GATE:
            "WAITING_FOR_STRICT_GATE",

        ENGINE_RELEASE_BLOCKED:
            "ENGINE_RELEASE_BLOCKED",

        ENGINE_RELEASED:
            "ENGINE_RELEASED",

        FAILED:
            "FAILED"
    });

    let installed = false;
    let running = false;
    let startupCompleted = false;

    let currentState = STATES.IDLE;

    let attemptCount = 0;
    let retryCount = 0;
    let c6RunCount = 0;
    let c7aRunCount = 0;

    let engineReleaseReady = false;
    let readinessBarrierPassed = false;
    let rehydrationCompletionVerified = false;
    let strictGateVerified = false;

    let lastCoverage = null;
    let lastResult = null;
    let lastError = null;

    let startedAt = null;
    let completedAt = null;

    let startupPromise = null;
    let startupTimer = null;

    function now() {
        return Date.now();
    }

    function sleep(ms) {
        return new Promise(function (resolve) {
            setTimeout(resolve, ms);
        });
    }

    function toNumber(value, fallback) {
        const n = Number(value);

        return Number.isFinite(n)
            ? n
            : fallback;
    }

    function normalizeError(error) {
        if (!error) {
            return null;
        }

        return {
            name:
                error.name || "Error",

            message:
                error.message || String(error),

            stack:
                error.stack || null
        };
    }

    function getBridge(name) {
        const value = global[name];

        return (
            value &&
            typeof value === "object"
        )
            ? value
            : null;
    }

    function getC6() {
        return getBridge(C6_NAME);
    }

    function getC7() {
        return getBridge(C7_NAME);
    }

    function getC7A() {
        return getBridge(C7A_NAME);
    }

    function indexedDBAvailable() {
        try {
            return Boolean(global.indexedDB);
        } catch (_) {
            return false;
        }
    }

    function calculateRetryDelay(attempt) {
        const delay =
            INITIAL_RETRY_DELAY_MS *
            Math.pow(
                1.5,
                Math.max(0, attempt - 1)
            );

        return Math.min(
            MAX_RETRY_DELAY_MS,
            Math.round(delay)
        );
    }

    function publishState(state, extra) {
        currentState = state;

        const detail = Object.assign(
            {
                phase: PHASE,
                version: VERSION,
                build: BUILD,
                state,
                generatedAt: now(),
                attemptCount,
                retryCount,
                c6RunCount,
                c7aRunCount,
                engineReleaseReady,
                readinessBarrierPassed,
                rehydrationCompletionVerified,
                strictGateVerified
            },
            extra || {}
        );

        try {
            global.dispatchEvent(
                new CustomEvent(
                    STATE_EVENT,
                    {
                        detail
                    }
                )
            );
        } catch (_) {}

        return detail;
    }

    async function readCoverage() {
        const c6 = getC6();

        if (!c6) {
            return {
                persistedUniqueIdentityCount: 0,
                runtimeIdentityCount: 0,
                matchedIdentityCount: 0,
                missingInRuntimeCount: 0,
                coveragePercent: 0,
                identityCoverageVerified: false
            };
        }

        let report = null;

        try {
            if (
                typeof c6.getIdentityCoverageReport ===
                "function"
            ) {
                report =
                    await c6.getIdentityCoverageReport();
            }
        } catch (_) {
            report = null;
        }

        if (!report) {
            report =
                c6.lastCoverageReport ||
                c6.lastResult ||
                {};
        }

        const persisted =
            toNumber(
                report.persistedUniqueIdentityCount ??
                report.persistedIdentityCount ??
                report.persistedRecordCount,
                0
            );

        const runtime =
            toNumber(
                report.runtimeIdentityCount ??
                report.runtimeRehydratedIdentityCount,
                0
            );

        const matched =
            toNumber(
                report.matchedIdentityCount,
                Math.min(
                    persisted,
                    runtime
                )
            );

        const missing =
            toNumber(
                report.missingInRuntimeCount ??
                report.missingRuntimeCount,
                Math.max(
                    0,
                    persisted - matched
                )
            );

        let coveragePercent =
            toNumber(
                report.coveragePercent,
                NaN
            );

        if (!Number.isFinite(coveragePercent)) {
            coveragePercent =
                persisted > 0
                    ? (
                        matched /
                        persisted
                    ) * 100
                    : 100;
        }

        coveragePercent =
            Number(
                Math.max(
                    0,
                    Math.min(
                        100,
                        coveragePercent
                    )
                ).toFixed(2)
            );

        const identityCoverageVerified =
            coveragePercent >=
                MINIMUM_COVERAGE_PERCENT &&
            missing === 0;

        const normalized = {
            persistedUniqueIdentityCount:
                persisted,

            runtimeIdentityCount:
                runtime,

            matchedIdentityCount:
                matched,

            missingInRuntimeCount:
                missing,

            coveragePercent,

            minimumCoveragePercent:
                MINIMUM_COVERAGE_PERCENT,

            identityCoverageVerified
        };

        lastCoverage = normalized;

        return normalized;
    }

    function coverageComplete(coverage) {
        if (
            !coverage ||
            typeof coverage !== "object"
        ) {
            return false;
        }

        return (
            coverage.persistedUniqueIdentityCount > 0 &&
            coverage.runtimeIdentityCount > 0 &&
            coverage.matchedIdentityCount >=
                (
                    coverage.persistedUniqueIdentityCount *
                    MINIMUM_COVERAGE_PERCENT /
                    100
                ) &&
            coverage.missingInRuntimeCount === 0 &&
            coverage.coveragePercent >=
                MINIMUM_COVERAGE_PERCENT &&
            coverage.identityCoverageVerified === true
        );
    }

    function forceBlock(status, extra) {
        engineReleaseReady = false;
        readinessBarrierPassed = false;

        global.RainGuardEngineReleaseReady = false;
        global.RainGuardEngineReleaseReadyAt = null;
        global.RainGuardEngineReleaseReadyResult = null;

        const result = Object.assign(
            {
                success: false,

                phase: PHASE,
                version: VERSION,
                build: BUILD,

                status,

                state:
                    STATES.ENGINE_RELEASE_BLOCKED,

                engineReleaseReady: false,
                readinessBarrierPassed: false,

                rehydrationCompletionVerified,
                strictGateVerified,

                generatedAt: now(),

                coverage: lastCoverage,

                attemptCount,
                retryCount,
                c6RunCount,
                c7aRunCount
            },
            extra || {}
        );

        lastResult = result;

        publishState(
            STATES.ENGINE_RELEASE_BLOCKED,
            result
        );

        try {
            global.dispatchEvent(
                new CustomEvent(
                    BLOCKED_EVENT,
                    {
                        detail: result
                    }
                )
            );
        } catch (_) {}

        return result;
    }

    function releaseEngines(coverage, strictResult) {
        engineReleaseReady = true;
        readinessBarrierPassed = true;
        rehydrationCompletionVerified = true;
        strictGateVerified = true;

        startupCompleted = true;
        completedAt = now();

        const result = {
            success: true,

            phase: PHASE,
            version: VERSION,
            build: BUILD,

            status:
                "ENGINE_RELEASED_AFTER_FULL_RUNTIME_REHYDRATION",

            state:
                STATES.ENGINE_RELEASED,

            generatedAt: now(),

            engineReleaseReady: true,
            readinessBarrierPassed: true,

            rehydrationCompletionVerified: true,
            strictGateVerified: true,

            coverage,

            strictResult,

            attemptCount,
            retryCount,
            c6RunCount,
            c7aRunCount,

            startedAt,
            completedAt,

            durationMs:
                startedAt
                    ? completedAt - startedAt
                    : 0
        };

        global.RainGuardEngineReleaseReady = true;
        global.RainGuardEngineReleaseReadyAt = completedAt;
        global.RainGuardEngineReleaseReadyResult = result;

        lastResult = result;

        publishState(
            STATES.ENGINE_RELEASED,
            result
        );

        try {
            global.dispatchEvent(
                new CustomEvent(
                    READY_EVENT,
                    {
                        detail: result
                    }
                )
            );
        } catch (_) {}

        return result;
    }

    async function runC6() {
        const c6 = getC6();

        if (
            !c6 ||
            typeof c6.run !== "function"
        ) {
            throw new Error(
                "C6 runtime rehydration bridge is unavailable."
            );
        }

        c6RunCount += 1;

        publishState(
            STATES.RUNNING_STARTUP_REHYDRATION
        );

        return await c6.run();
    }

    async function verifyStrictGate() {
        const c7a = getC7A();

        if (
            !c7a ||
            typeof c7a.run !== "function"
        ) {
            return {
                success: false,
                available: false,
                strictReady: false
            };
        }

        c7aRunCount += 1;

        publishState(
            STATES.WAITING_FOR_STRICT_GATE
        );

        let runResult = null;

        try {
            runResult =
                await c7a.run();
        } catch (error) {
            return {
                success: false,
                available: true,
                strictReady: false,
                error:
                    normalizeError(error)
            };
        }

        const strictReady =
            Boolean(
                c7a.strictCoverageVerified === true &&
                c7a.readinessGateOpen === true &&
                c7a.engineRuntimeReady === true
            );

        return {
            success: strictReady,
            available: true,
            strictReady,
            runResult
        };
    }

    async function executeAttempt() {
        attemptCount += 1;

        if (!indexedDBAvailable()) {
            publishState(
                STATES.WAITING_FOR_INDEXEDDB
            );

            return {
                success: false,
                retryable: true,
                status:
                    "ENGINE_RELEASE_BLOCKED_INDEXEDDB_NOT_READY"
            };
        }

        const c6 = getC6();

        if (
            !c6 ||
            typeof c6.run !== "function"
        ) {
            publishState(
                STATES.WAITING_FOR_C6
            );

            return {
                success: false,
                retryable: true,
                status:
                    "ENGINE_RELEASE_BLOCKED_C6_NOT_READY"
            };
        }

        publishState(
            STATES.VERIFYING_REHYDRATION_COMPLETION
        );

        let coverage =
            await readCoverage();

        if (!coverageComplete(coverage)) {
            await runC6();

            await sleep(
                POST_C6_SETTLE_MS
            );

            publishState(
                STATES.WAITING_FOR_RUNTIME_CONVERGENCE
            );

            coverage =
                await readCoverage();
        }

        if (!coverageComplete(coverage)) {
            rehydrationCompletionVerified = false;

            return {
                success: false,
                retryable: true,

                status:
                    "ENGINE_RELEASE_BLOCKED_RUNTIME_REHYDRATION_INCOMPLETE",

                coverage
            };
        }

        rehydrationCompletionVerified = true;

        const strict =
            await verifyStrictGate();

        strictGateVerified =
            strict.strictReady === true;

        if (!strictGateVerified) {
            return {
                success: false,
                retryable: true,

                status:
                    "ENGINE_RELEASE_BLOCKED_STRICT_GATE_NOT_READY",

                coverage,
                strict
            };
        }

        return {
            success: true,
            retryable: false,
            coverage,
            strict
        };
    }

    async function run() {
        if (startupPromise) {
            return startupPromise;
        }

        startupPromise =
            (async function () {
                running = true;

                startedAt =
                    startedAt || now();

                lastError = null;

                engineReleaseReady = false;
                readinessBarrierPassed = false;
                rehydrationCompletionVerified = false;
                strictGateVerified = false;

                global.RainGuardEngineReleaseReady = false;

                try {
                    for (
                        let attempt = 1;
                        attempt <= MAX_ATTEMPTS;
                        attempt += 1
                    ) {
                        let result;

                        try {
                            result =
                                await executeAttempt();
                        } catch (error) {
                            lastError =
                                normalizeError(error);

                            result = {
                                success: false,
                                retryable: true,

                                status:
                                    "ENGINE_RELEASE_ATTEMPT_FAILED",

                                error:
                                    lastError
                            };
                        }

                        if (
                            result &&
                            result.success === true
                        ) {
                            running = false;

                            return releaseEngines(
                                result.coverage,
                                result.strict
                            );
                        }

                        if (
                            attempt >=
                            MAX_ATTEMPTS
                        ) {
                            break;
                        }

                        retryCount += 1;

                        await sleep(
                            calculateRetryDelay(attempt)
                        );
                    }

                    running = false;

                    return forceBlock(
                        "ENGINE_RELEASE_BLOCKED_RUNTIME_REHYDRATION_INCOMPLETE",
                        {
                            error:
                                lastError
                        }
                    );

                } catch (error) {
                    running = false;

                    lastError =
                        normalizeError(error);

                    publishState(
                        STATES.FAILED,
                        {
                            error:
                                lastError
                        }
                    );

                    return forceBlock(
                        "ENGINE_RELEASE_BARRIER_FAILED",
                        {
                            error:
                                lastError
                        }
                    );

                } finally {
                    startupPromise = null;
                }
            })();

        return startupPromise;
    }

    async function diagnose() {
        const coverage =
            await readCoverage();

        const c6 = getC6();
        const c7 = getC7();
        const c7a = getC7A();

        const result = {
            success: true,

            phase: PHASE,
            version: VERSION,
            build: BUILD,

            installed,
            running,
            startupCompleted,

            state:
                currentState,

            indexedDBAvailable:
                indexedDBAvailable(),

            c6Available:
                Boolean(c6),

            c7Available:
                Boolean(c7),

            c7aAvailable:
                Boolean(c7a),

            c7ReadinessGateOpen:
                Boolean(
                    c7?.readinessGateOpen
                ),

            c7EngineRuntimeReady:
                Boolean(
                    c7?.engineRuntimeReady
                ),

            c7aStrictCoverageVerified:
                Boolean(
                    c7a?.strictCoverageVerified
                ),

            c7aReadinessGateOpen:
                Boolean(
                    c7a?.readinessGateOpen
                ),

            c7aEngineRuntimeReady:
                Boolean(
                    c7a?.engineRuntimeReady
                ),

            attemptCount,
            retryCount,
            c6RunCount,
            c7aRunCount,

            coverage,

            rehydrationCompletionVerified,
            strictGateVerified,

            readinessBarrierPassed,
            engineReleaseReady,

            globalEngineReleaseReady:
                global.RainGuardEngineReleaseReady === true,

            startedAt,
            completedAt,

            lastError,
            lastResult,

            status:
                engineReleaseReady
                    ? "ENGINE_RELEASED_AFTER_FULL_RUNTIME_REHYDRATION"
                    : "ENGINE_RELEASE_BLOCKED"
        };

        console.log(
            `[RainGuard][${PHASE}] Diagnostics:`,
            result
        );

        return result;
    }

    function getState() {
        return {
            phase: PHASE,
            version: VERSION,
            build: BUILD,

            installed,
            running,
            startupCompleted,

            state:
                currentState,

            attemptCount,
            retryCount,
            c6RunCount,
            c7aRunCount,

            coverage:
                lastCoverage,

            rehydrationCompletionVerified,
            strictGateVerified,

            readinessBarrierPassed,
            engineReleaseReady,

            lastResult,
            lastError
        };
    }

    function isReady() {
        return Boolean(
            engineReleaseReady &&
            readinessBarrierPassed &&
            rehydrationCompletionVerified &&
            strictGateVerified
        );
    }

    function waitUntilReleased(timeoutMs) {
        const timeout =
            toNumber(
                timeoutMs,
                60000
            );

        if (isReady()) {
            return Promise.resolve(
                lastResult
            );
        }

        return new Promise(
            function (resolve, reject) {
                let done = false;

                let timer = null;

                function cleanup() {
                    global.removeEventListener(
                        READY_EVENT,
                        onReady
                    );

                    if (timer) {
                        clearTimeout(timer);
                    }
                }

                function onReady(event) {
                    if (done) {
                        return;
                    }

                    done = true;

                    cleanup();

                    resolve(
                        event?.detail ||
                        lastResult
                    );
                }

                global.addEventListener(
                    READY_EVENT,
                    onReady,
                    {
                        once: true
                    }
                );

                timer =
                    setTimeout(
                        function () {
                            if (done) {
                                return;
                            }

                            done = true;

                            cleanup();

                            reject(
                                new Error(
                                    "RainGuard engine release timeout."
                                )
                            );
                        },
                        timeout
                    );
            }
        );
    }

    function scheduleAutoStart() {
        if (startupCompleted) {
            return;
        }

        if (startupTimer) {
            return;
        }

        startupTimer =
            setTimeout(
                function () {
                    startupTimer = null;

                    run().catch(
                        function (error) {
                            console.error(
                                `[RainGuard][${PHASE}] Automatic startup failed:`,
                                error
                            );
                        }
                    );
                },
                AUTO_START_DELAY_MS
            );
    }

    function install() {
        if (installed) {
            return bridge;
        }

        installed = true;

        global.RainGuardEngineReleaseReady = false;
        global.RainGuardEngineReleaseReadyAt = null;
        global.RainGuardEngineReleaseReadyResult = null;

        publishState(
            STATES.IDLE,
            {
                autoStart: true
            }
        );

        if (
            document.readyState ===
            "loading"
        ) {
            document.addEventListener(
                "DOMContentLoaded",
                scheduleAutoStart,
                {
                    once: true
                }
            );
        } else {
            scheduleAutoStart();
        }

        global.addEventListener(
            "pageshow",
            function () {
                if (!isReady()) {
                    scheduleAutoStart();
                }
            }
        );

        console.log(
            `[RainGuard][${PHASE}] Installed:`,
            {
                phase: PHASE,
                version: VERSION,
                build: BUILD,
                maxAttempts: MAX_ATTEMPTS,
                minimumCoveragePercent:
                    MINIMUM_COVERAGE_PERCENT
            }
        );

        return bridge;
    }

    const bridge = {
        phase: PHASE,
        version: VERSION,
        build: BUILD,

        states: STATES,

        minimumCoveragePercent:
            MINIMUM_COVERAGE_PERCENT,

        maxAttempts:
            MAX_ATTEMPTS,

        readyEvent:
            READY_EVENT,

        blockedEvent:
            BLOCKED_EVENT,

        stateEvent:
            STATE_EVENT,

        install,
        run,
        diagnose,
        getState,
        readCoverage,
        isReady,
        waitUntilReleased,

        get installed() {
            return installed;
        },

        get running() {
            return running;
        },

        get startupCompleted() {
            return startupCompleted;
        },

        get currentState() {
            return currentState;
        },

        get attemptCount() {
            return attemptCount;
        },

        get retryCount() {
            return retryCount;
        },

        get c6RunCount() {
            return c6RunCount;
        },

        get c7aRunCount() {
            return c7aRunCount;
        },

        get engineReleaseReady() {
            return engineReleaseReady;
        },

        get readinessBarrierPassed() {
            return readinessBarrierPassed;
        },

        get rehydrationCompletionVerified() {
            return rehydrationCompletionVerified;
        },

        get strictGateVerified() {
            return strictGateVerified;
        },

        get lastCoverage() {
            return lastCoverage;
        },

        get lastResult() {
            return lastResult;
        },

        get lastError() {
            return lastError;
        }
    };

    global[BRIDGE_NAME] =
        bridge;

    global[RUN_NAME] =
        run;

    global[DIAG_NAME] =
        diagnose;

    global.isRainGuard39A15F6N4B1B3C7BEngineReleaseReady =
        isReady;

    global.waitForRainGuard39A15F6N4B1B3C7BEngineRelease =
        waitUntilReleased;

    install();

})(window);
