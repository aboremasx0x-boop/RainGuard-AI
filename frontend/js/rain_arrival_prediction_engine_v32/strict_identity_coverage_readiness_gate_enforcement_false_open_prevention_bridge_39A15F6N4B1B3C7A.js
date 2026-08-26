/*
 * RainGuard AI
 * Phase 39A-15F6N4B1B3C7A
 *
 * Strict Identity Coverage Readiness Gate Enforcement
 * & False-Open Prevention Bridge
 *
 * Purpose
 * -------
 * - Enforce strict identity coverage before pre-engine readiness is allowed.
 * - Detect and close false-open states created by upstream startup logic.
 * - Require:
 *      indexedDBReady === true
 *      C6 available
 *      C6 full runtime rehydration completed
 *      identityCoverageVerified === true
 *      missingInRuntimeCount === 0
 *      coveragePercent >= minimum threshold
 * - Override stale/incorrect ready flags.
 * - Publish BLOCKED/OPEN events.
 * - Re-check gate integrity continuously at safe intervals.
 */

(function (global) {
    "use strict";

    const PHASE = "39A-15F6N4B1B3C7A";
    const VERSION = "39A.15F6N4B1B3C7A.0";

    const BUILD =
        "rainguard-v39-strict-identity-coverage-readiness-gate-enforcement-false-open-prevention-bridge";

    const C6_BRIDGE_NAME =
        "RainGuard39A15F6N4B1B3C6BridgeV39";

    const C7_BRIDGE_NAME =
        "RainGuard39A15F6N4B1B3C7BridgeV39";

    const BRIDGE_NAME =
        "RainGuard39A15F6N4B1B3C7ABridgeV39";

    const RUN_NAME =
        "runRainGuard39A15F6N4B1B3C7AStrictIdentityCoverageReadinessGateEnforcement";

    const DIAG_NAME =
        "diagnoseRainGuard39A15F6N4B1B3C7AStrictIdentityCoverageReadinessGateEnforcement";

    const MINIMUM_COVERAGE_PERCENT = 99;

    const RECHECK_INTERVAL_MS = 3000;

    const READY_EVENT =
        "rainguard:strict-pre-engine-runtime-ready";

    const BLOCKED_EVENT =
        "rainguard:strict-pre-engine-runtime-blocked";

    const STATE_EVENT =
        "rainguard:strict-pre-engine-readiness-state";

    const STATES = Object.freeze({
        IDLE: "IDLE",

        CHECKING:
            "STRICT_IDENTITY_COVERAGE_CHECKING",

        OPEN:
            "PRE_ENGINE_READINESS_GATE_OPEN_STRICT",

        BLOCKED_COVERAGE:
            "PRE_ENGINE_READINESS_GATE_BLOCKED_IDENTITY_COVERAGE",

        BLOCKED_MISSING_IDENTITIES:
            "PRE_ENGINE_READINESS_GATE_BLOCKED_MISSING_RUNTIME_IDENTITIES",

        BLOCKED_C6:
            "PRE_ENGINE_READINESS_GATE_BLOCKED_C6_NOT_READY",

        BLOCKED_INDEXEDDB:
            "PRE_ENGINE_READINESS_GATE_BLOCKED_INDEXEDDB_NOT_READY",

        FAILED:
            "STRICT_READINESS_GATE_VALIDATION_FAILED"
    });

    let installed = true;
    let running = false;

    let currentState = STATES.IDLE;

    let readinessGateOpen = false;
    let engineRuntimeReady = false;

    let strictCoverageVerified = false;

    let checkCount = 0;
    let falseOpenPreventedCount = 0;
    let forcedCloseCount = 0;

    let lastResult = null;
    let lastError = null;
    let lastCoverage = null;

    let monitorTimer = null;

    function now() {
        return Date.now();
    }

    function toNumber(value, fallback = 0) {
        const num = Number(value);

        return Number.isFinite(num)
            ? num
            : fallback;
    }

    function normalizeError(error) {
        return {
            name:
                error?.name ||
                "Error",

            message:
                error?.message ||
                String(error),

            stack:
                error?.stack ||
                null
        };
    }

    function getC6() {
        const bridge =
            global[C6_BRIDGE_NAME];

        return (
            bridge &&
            typeof bridge === "object"
        )
            ? bridge
            : null;
    }

    function getC7() {
        const bridge =
            global[C7_BRIDGE_NAME];

        return (
            bridge &&
            typeof bridge === "object"
        )
            ? bridge
            : null;
    }

    function indexedDBReady() {
        try {
            return Boolean(
                global.indexedDB
            );
        } catch (_) {
            return false;
        }
    }

    async function readCoverage() {
        const c6 =
            getC6();

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

        if (
            typeof c6.getIdentityCoverageReport ===
            "function"
        ) {
            try {
                report =
                    await c6
                        .getIdentityCoverageReport();
            } catch (_) {
                report = null;
            }
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
                    persisted -
                    matched
                )
            );

        let coverage =
            report.coveragePercent;

        if (
            !Number.isFinite(
                Number(coverage)
            )
        ) {
            coverage =
                persisted > 0
                    ? (
                        matched /
                        persisted
                    ) * 100
                    : 100;
        }

        coverage =
            Number(
                Math.max(
                    0,
                    Math.min(
                        100,
                        Number(coverage)
                    )
                ).toFixed(2)
            );

        const verified =
            coverage >=
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

            coveragePercent:
                coverage,

            minimumCoveragePercent:
                MINIMUM_COVERAGE_PERCENT,

            identityCoverageVerified:
                verified
        };

        lastCoverage =
            normalized;

        return normalized;
    }

    function publishState(
        state,
        detail = {}
    ) {
        currentState =
            state;

        const payload = {
            phase:
                PHASE,

            version:
                VERSION,

            build:
                BUILD,

            state,

            readinessGateOpen,

            engineRuntimeReady,

            generatedAt:
                now(),

            ...detail
        };

        try {
            global.dispatchEvent(
                new CustomEvent(
                    STATE_EVENT,
                    {
                        detail:
                            payload
                    }
                )
            );
        } catch (_) {}

        return payload;
    }

    function forceCloseGate(
        reason,
        coverage
    ) {
        const c7 =
            getC7();

        const upstreamWasOpen =
            Boolean(
                c7?.readinessGateOpen ===
                    true ||
                c7?.engineRuntimeReady ===
                    true ||
                global
                    .RainGuardPreEngineRuntimeReady ===
                    true
            );

        if (upstreamWasOpen) {
            falseOpenPreventedCount +=
                1;
        }

        forcedCloseCount +=
            1;

        readinessGateOpen =
            false;

        engineRuntimeReady =
            false;

        strictCoverageVerified =
            false;

        global
            .RainGuardPreEngineRuntimeReady =
            false;

        global
            .RainGuardStrictPreEngineRuntimeReady =
            false;

        global
            .RainGuardStrictPreEngineRuntimeReadyAt =
            null;

        global
            .RainGuardStrictPreEngineRuntimeReadyResult =
            null;

        const result = {
            success:
                false,

            phase:
                PHASE,

            version:
                VERSION,

            build:
                BUILD,

            status:
                reason,

            readinessGateOpen:
                false,

            engineRuntimeReady:
                false,

            strictCoverageVerified:
                false,

            falseOpenPrevented:
                upstreamWasOpen,

            falseOpenPreventedCount,

            forcedCloseCount,

            coverage,

            generatedAt:
                now()
        };

        lastResult =
            result;

        publishState(
            reason,
            result
        );

        try {
            global.dispatchEvent(
                new CustomEvent(
                    BLOCKED_EVENT,
                    {
                        detail:
                            result
                    }
                )
            );
        } catch (_) {}

        return result;
    }

    function openStrictGate(
        coverage
    ) {
        readinessGateOpen =
            true;

        engineRuntimeReady =
            true;

        strictCoverageVerified =
            true;

        global
            .RainGuardPreEngineRuntimeReady =
            true;

        global
            .RainGuardStrictPreEngineRuntimeReady =
            true;

        global
            .RainGuardStrictPreEngineRuntimeReadyAt =
            now();

        const result = {
            success:
                true,

            phase:
                PHASE,

            version:
                VERSION,

            build:
                BUILD,

            status:
                STATES.OPEN,

            readinessGateOpen:
                true,

            engineRuntimeReady:
                true,

            strictCoverageVerified:
                true,

            coverage,

            generatedAt:
                now(),

            falseOpenPreventedCount,

            forcedCloseCount
        };

        global
            .RainGuardStrictPreEngineRuntimeReadyResult =
            result;

        lastResult =
            result;

        publishState(
            STATES.OPEN,
            result
        );

        try {
            global.dispatchEvent(
                new CustomEvent(
                    READY_EVENT,
                    {
                        detail:
                            result
                    }
                )
            );
        } catch (_) {}

        return result;
    }

    async function run() {
        if (running) {
            return (
                lastResult ||
                {
                    success:
                        false,

                    status:
                        "STRICT_GATE_ALREADY_RUNNING"
                }
            );
        }

        running =
            true;

        checkCount +=
            1;

        publishState(
            STATES.CHECKING
        );

        try {
            if (
                !indexedDBReady()
            ) {
                return forceCloseGate(
                    STATES.BLOCKED_INDEXEDDB,
                    null
                );
            }

            const c6 =
                getC6();

            if (!c6) {
                return forceCloseGate(
                    STATES.BLOCKED_C6,
                    null
                );
            }

            const coverage =
                await readCoverage();

            const c6Completed =
                Boolean(
                    c6
                        .fullRuntimeRehydrationCompleted ===
                        true ||
                    c6
                        .lastResult
                        ?.fullRuntimeRehydrationCompleted ===
                        true
                );

            if (!c6Completed) {
                return forceCloseGate(
                    STATES.BLOCKED_C6,
                    coverage
                );
            }

            if (
                coverage
                    .missingInRuntimeCount >
                0
            ) {
                return forceCloseGate(
                    STATES
                        .BLOCKED_MISSING_IDENTITIES,
                    coverage
                );
            }

            if (
                coverage
                    .coveragePercent <
                    MINIMUM_COVERAGE_PERCENT ||
                coverage
                    .identityCoverageVerified !==
                    true
            ) {
                return forceCloseGate(
                    STATES
                        .BLOCKED_COVERAGE,
                    coverage
                );
            }

            return openStrictGate(
                coverage
            );

        } catch (error) {
            lastError =
                normalizeError(
                    error
                );

            return forceCloseGate(
                STATES.FAILED,
                lastCoverage
            );

        } finally {
            running =
                false;
        }
    }

    async function diagnose() {
        const coverage =
            await readCoverage();

        const c6 =
            getC6();

        const c7 =
            getC7();

        const result = {
            success:
                true,

            phase:
                PHASE,

            version:
                VERSION,

            build:
                BUILD,

            installed,

            running,

            currentState,

            checkCount,

            indexedDBReady:
                indexedDBReady(),

            c6Available:
                Boolean(c6),

            c6FullRuntimeRehydrationCompleted:
                Boolean(
                    c6
                        ?.fullRuntimeRehydrationCompleted ===
                        true ||
                    c6
                        ?.lastResult
                        ?.fullRuntimeRehydrationCompleted ===
                        true
                ),

            c7Available:
                Boolean(c7),

            c7ReadinessGateOpen:
                Boolean(
                    c7
                        ?.readinessGateOpen
                ),

            c7EngineRuntimeReady:
                Boolean(
                    c7
                        ?.engineRuntimeReady
                ),

            upstreamGlobalReady:
                Boolean(
                    global
                        .RainGuardPreEngineRuntimeReady
                ),

            readinessGateOpen,

            engineRuntimeReady,

            strictCoverageVerified,

            falseOpenPreventedCount,

            forcedCloseCount,

            coverage,

            lastError,

            lastResult,

            status:
                currentState
        };

        console.log(
            `[RainGuard][${PHASE}] Diagnostics:`,
            result
        );

        return result;
    }

    function startMonitor() {
        if (monitorTimer) {
            return;
        }

        monitorTimer =
            global.setInterval(
                async function () {
                    try {
                        await run();
                    } catch (_) {}
                },
                RECHECK_INTERVAL_MS
            );
    }

    function stopMonitor() {
        if (!monitorTimer) {
            return;
        }

        global.clearInterval(
            monitorTimer
        );

        monitorTimer =
            null;
    }

    function isReady() {
        return Boolean(
            readinessGateOpen &&
            engineRuntimeReady &&
            strictCoverageVerified
        );
    }

    const bridge = {
        phase:
            PHASE,

        version:
            VERSION,

        build:
            BUILD,

        minimumCoveragePercent:
            MINIMUM_COVERAGE_PERCENT,

        states:
            STATES,

        run,

        diagnose,

        readCoverage,

        isReady,

        startMonitor,

        stopMonitor,

        get installed() {
            return installed;
        },

        get running() {
            return running;
        },

        get currentState() {
            return currentState;
        },

        get readinessGateOpen() {
            return readinessGateOpen;
        },

        get engineRuntimeReady() {
            return engineRuntimeReady;
        },

        get strictCoverageVerified() {
            return strictCoverageVerified;
        },

        get falseOpenPreventedCount() {
            return falseOpenPreventedCount;
        },

        get forcedCloseCount() {
            return forcedCloseCount;
        },

        get checkCount() {
            return checkCount;
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

    global[
        BRIDGE_NAME
    ] =
        bridge;

    global[
        RUN_NAME
    ] =
        run;

    global[
        DIAG_NAME
    ] =
        diagnose;

    global
        .isRainGuard39A15F6N4B1B3C7AStrictReady =
        isReady;

    /*
     * Default strict state:
     * CLOSED until proven ready.
     */

    global
        .RainGuardStrictPreEngineRuntimeReady =
        false;

    /*
     * First validation.
     */

    global.setTimeout(
        function () {
            run()
                .catch(
                    function (error) {
                        console.error(
                            `[RainGuard][${PHASE}] Initial strict-gate validation failed:`,
                            error
                        );
                    }
                );
        },
        500
    );

    /*
     * Continuous False-Open Guard.
     */

    startMonitor();

    console.log(
        `[RainGuard][${PHASE}] Installed`,
        {
            version:
                VERSION,

            minimumCoveragePercent:
                MINIMUM_COVERAGE_PERCENT,

            falseOpenPrevention:
                true,

            monitorIntervalMs:
                RECHECK_INTERVAL_MS
        }
    );

})(window);
