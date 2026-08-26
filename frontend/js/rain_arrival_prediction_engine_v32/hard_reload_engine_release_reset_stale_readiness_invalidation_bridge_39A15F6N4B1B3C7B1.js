/*
 * RainGuard AI
 * Phase 39A-15F6N4B1B3C7B1
 *
 * Hard-Reload Engine Release Reset
 * & Stale Readiness Invalidation Bridge
 *
 * Purpose
 * -------
 * - Force engine-release state CLOSED on every fresh page lifecycle.
 * - Invalidate stale release/readiness values from prior runtime cycles.
 * - Recalculate readiness from CURRENT persisted/runtime coverage only.
 * - Prevent stale C7B lastResult from reopening the engine gate.
 * - Require fresh C7A strict verification before allowing release.
 */

(function (global) {
    "use strict";

    const PHASE = "39A-15F6N4B1B3C7B1";
    const VERSION = "39A.15F6N4B1B3C7B1.0";

    const BUILD =
        "rainguard-v39-hard-reload-engine-release-reset-stale-readiness-invalidation-bridge";

    const C6_NAME =
        "RainGuard39A15F6N4B1B3C6BridgeV39";

    const C7A_NAME =
        "RainGuard39A15F6N4B1B3C7ABridgeV39";

    const C7B_NAME =
        "RainGuard39A15F6N4B1B3C7BBridgeV39";

    const BRIDGE_NAME =
        "RainGuard39A15F6N4B1B3C7B1BridgeV39";

    const MINIMUM_COVERAGE_PERCENT = 99;

    const STATES = Object.freeze({
        INITIALIZING:
            "HARD_RELOAD_RESET_INITIALIZING",

        STALE_STATE_INVALIDATED:
            "STALE_ENGINE_RELEASE_STATE_INVALIDATED",

        WAITING_FOR_REHYDRATION:
            "WAITING_FOR_CURRENT_RUNTIME_REHYDRATION",

        VERIFYING_CURRENT_COVERAGE:
            "VERIFYING_CURRENT_RUNTIME_COVERAGE",

        BLOCKED:
            "ENGINE_RELEASE_BLOCKED_CURRENT_RUNTIME_NOT_READY",

        RELEASED:
            "ENGINE_RELEASED_CURRENT_RUNTIME_VERIFIED",

        FAILED:
            "HARD_RELOAD_RELEASE_RESET_FAILED"
    });

    let installed = false;
    let running = false;

    let currentState =
        STATES.INITIALIZING;

    let resetCount = 0;
    let staleInvalidationCount = 0;
    let verificationCount = 0;

    let currentCoverage = null;

    let currentReleaseReady = false;
    let currentStrictReady = false;

    let lastResult = null;
    let lastError = null;

    let installedAt = null;
    let lastResetAt = null;
    let lastVerifiedAt = null;

    function now() {
        return Date.now();
    }

    function getBridge(name) {
        const value =
            global[name];

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

    function getC7A() {
        return getBridge(C7A_NAME);
    }

    function getC7B() {
        return getBridge(C7B_NAME);
    }

    function toNumber(
        value,
        fallback
    ) {
        const number =
            Number(value);

        return Number.isFinite(number)
            ? number
            : fallback;
    }

    function normalizeError(error) {
        return {
            name:
                error?.name || "Error",

            message:
                error?.message ||
                String(error),

            stack:
                error?.stack || null
        };
    }

    function publishState(
        state,
        detail
    ) {
        currentState =
            state;

        const payload =
            Object.assign(
                {
                    phase: PHASE,
                    version: VERSION,
                    build: BUILD,

                    state,

                    generatedAt:
                        now(),

                    currentReleaseReady,
                    currentStrictReady,

                    resetCount,
                    staleInvalidationCount,
                    verificationCount
                },
                detail || {}
            );

        try {
            global.dispatchEvent(
                new CustomEvent(
                    "rainguard:hard-reload-release-reset-state",
                    {
                        detail:
                            payload
                    }
                )
            );
        } catch (_) {}

        return payload;
    }

    function invalidateGlobalReleaseState() {
        global.RainGuardEngineReleaseReady =
            false;

        global.RainGuardEngineReleaseReadyAt =
            null;

        global.RainGuardEngineReleaseReadyResult =
            null;

        global.RainGuardPreEngineRuntimeReady =
            false;

        global.RainGuardStrictPreEngineRuntimeReady =
            false;

        currentReleaseReady =
            false;

        currentStrictReady =
            false;
    }

    function invalidateC7BRuntimeState() {
        const c7b =
            getC7B();

        if (!c7b) {
            return false;
        }

        /*
         * C7B exposes getters, so we do not attempt direct mutation.
         * Instead, global release state becomes authoritative for
         * this startup cycle until fresh verification succeeds.
         */

        return Boolean(
            c7b.engineReleaseReady === true ||
            c7b.readinessBarrierPassed === true ||
            c7b.lastResult?.success === true
        );
    }

    function resetStaleReadiness() {
        resetCount += 1;
        lastResetAt = now();

        const staleC7B =
            invalidateC7BRuntimeState();

        const staleGlobal =
            Boolean(
                global.RainGuardEngineReleaseReady === true ||
                global.RainGuardPreEngineRuntimeReady === true ||
                global.RainGuardStrictPreEngineRuntimeReady === true
            );

        if (
            staleC7B ||
            staleGlobal
        ) {
            staleInvalidationCount += 1;
        }

        invalidateGlobalReleaseState();

        const result = {
            success: true,

            phase: PHASE,
            version: VERSION,
            build: BUILD,

            status:
                "STALE_ENGINE_RELEASE_STATE_INVALIDATED",

            staleC7BDetected:
                staleC7B,

            staleGlobalDetected:
                staleGlobal,

            engineReleaseReady:
                false,

            strictReady:
                false,

            resetCount,
            staleInvalidationCount,

            generatedAt:
                now()
        };

        lastResult =
            result;

        publishState(
            STATES.STALE_STATE_INVALIDATED,
            result
        );

        return result;
    }

    async function readCurrentCoverage() {
        const c6 =
            getC6();

        if (
            !c6 ||
            typeof c6.getIdentityCoverageReport !==
                "function"
        ) {
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
            report =
                await c6
                    .getIdentityCoverageReport();
        } catch (_) {
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

        if (
            !Number.isFinite(
                coveragePercent
            )
        ) {
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

        currentCoverage = {
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

        return currentCoverage;
    }

    async function verifyCurrentStrictGate() {
        const c7a =
            getC7A();

        if (
            !c7a ||
            typeof c7a.run !==
                "function"
        ) {
            return {
                success: false,
                strictReady: false,
                reason:
                    "C7A_NOT_AVAILABLE"
            };
        }

        let result = null;

        try {
            result =
                await c7a.run();
        } catch (error) {
            return {
                success: false,
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
            success:
                strictReady,

            strictReady,

            result
        };
    }

    function coverageIsCurrentAndComplete(
        coverage
    ) {
        return Boolean(
            coverage &&
            coverage.persistedUniqueIdentityCount > 0 &&
            coverage.runtimeIdentityCount > 0 &&
            coverage.missingInRuntimeCount === 0 &&
            coverage.coveragePercent >=
                MINIMUM_COVERAGE_PERCENT &&
            coverage.identityCoverageVerified ===
                true
        );
    }

    function blockRelease(
        coverage,
        reason
    ) {
        invalidateGlobalReleaseState();

        currentReleaseReady =
            false;

        currentStrictReady =
            false;

        const result = {
            success: false,

            phase: PHASE,
            version: VERSION,
            build: BUILD,

            status:
                reason ||
                "ENGINE_RELEASE_BLOCKED_CURRENT_RUNTIME_NOT_READY",

            coverage,

            currentReleaseReady:
                false,

            currentStrictReady:
                false,

            globalEngineReleaseReady:
                false,

            generatedAt:
                now()
        };

        lastResult =
            result;

        publishState(
            STATES.BLOCKED,
            result
        );

        return result;
    }

    function releaseCurrentCycle(
        coverage,
        strictResult
    ) {
        currentReleaseReady =
            true;

        currentStrictReady =
            true;

        lastVerifiedAt =
            now();

        global.RainGuardEngineReleaseReady =
            true;

        global.RainGuardEngineReleaseReadyAt =
            lastVerifiedAt;

        const result = {
            success: true,

            phase: PHASE,
            version: VERSION,
            build: BUILD,

            status:
                "ENGINE_RELEASED_CURRENT_RUNTIME_VERIFIED",

            coverage,

            strictResult,

            currentReleaseReady:
                true,

            currentStrictReady:
                true,

            globalEngineReleaseReady:
                true,

            generatedAt:
                lastVerifiedAt
        };

        global.RainGuardEngineReleaseReadyResult =
            result;

        lastResult =
            result;

        publishState(
            STATES.RELEASED,
            result
        );

        try {
            global.dispatchEvent(
                new CustomEvent(
                    "rainguard:current-runtime-engine-release-ready",
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
            return lastResult;
        }

        running = true;
        verificationCount += 1;

        try {
            /*
             * Critical rule:
             * every verification begins CLOSED.
             */

            invalidateGlobalReleaseState();

            publishState(
                STATES.VERIFYING_CURRENT_COVERAGE
            );

            const coverage =
                await readCurrentCoverage();

            if (
                !coverageIsCurrentAndComplete(
                    coverage
                )
            ) {
                return blockRelease(
                    coverage,
                    "ENGINE_RELEASE_BLOCKED_CURRENT_RUNTIME_REHYDRATION_INCOMPLETE"
                );
            }

            const strictResult =
                await verifyCurrentStrictGate();

            if (
                strictResult.strictReady !==
                    true
            ) {
                return blockRelease(
                    coverage,
                    "ENGINE_RELEASE_BLOCKED_CURRENT_STRICT_GATE_NOT_READY"
                );
            }

            return releaseCurrentCycle(
                coverage,
                strictResult
            );

        } catch (error) {
            lastError =
                normalizeError(error);

            invalidateGlobalReleaseState();

            publishState(
                STATES.FAILED,
                {
                    error:
                        lastError
                }
            );

            return {
                success: false,

                phase: PHASE,
                version: VERSION,

                status:
                    "HARD_RELOAD_RELEASE_RESET_FAILED",

                error:
                    lastError
            };

        } finally {
            running = false;
        }
    }

    async function diagnose() {
        const coverage =
            await readCurrentCoverage();

        const c7a =
            getC7A();

        const c7b =
            getC7B();

        const result = {
            success: true,

            phase: PHASE,
            version: VERSION,
            build: BUILD,

            installed,
            running,

            currentState,

            resetCount,
            staleInvalidationCount,
            verificationCount,

            coverage,

            c7aAvailable:
                Boolean(c7a),

            c7aStrictReady:
                Boolean(
                    c7a?.strictCoverageVerified &&
                    c7a?.readinessGateOpen &&
                    c7a?.engineRuntimeReady
                ),

            c7bAvailable:
                Boolean(c7b),

            c7bReportedReleaseReady:
                Boolean(
                    c7b?.engineReleaseReady
                ),

            c7bReportedBarrierPassed:
                Boolean(
                    c7b?.readinessBarrierPassed
                ),

            currentReleaseReady,

            currentStrictReady,

            globalEngineReleaseReady:
                global.RainGuardEngineReleaseReady === true,

            installedAt,
            lastResetAt,
            lastVerifiedAt,

            lastError,
            lastResult,

            status:
                currentReleaseReady
                    ? "ENGINE_RELEASED_CURRENT_RUNTIME_VERIFIED"
                    : "ENGINE_RELEASE_BLOCKED_CURRENT_RUNTIME_NOT_READY"
        };

        console.log(
            `[RainGuard][${PHASE}] Diagnostics:`,
            result
        );

        return result;
    }

    function isReady() {
        return Boolean(
            currentReleaseReady &&
            currentStrictReady &&
            global.RainGuardEngineReleaseReady ===
                true
        );
    }

    function install() {
        if (installed) {
            return bridge;
        }

        installed = true;
        installedAt = now();

        /*
         * This is intentionally immediate.
         * It must execute before stale upstream readiness can be trusted.
         */

        resetStaleReadiness();

        /*
         * Verify current lifecycle shortly after other startup
         * rehydration bridges have had an opportunity to run.
         */

        global.setTimeout(
            function () {
                run().catch(
                    function (error) {
                        console.error(
                            `[RainGuard][${PHASE}] Initial verification failed:`,
                            error
                        );
                    }
                );
            },
            1500
        );

        /*
         * BFCache/pageshow protection.
         */

        global.addEventListener(
            "pageshow",
            function (event) {
                if (
                    event?.persisted === true
                ) {
                    resetStaleReadiness();

                    global.setTimeout(
                        function () {
                            run().catch(
                                function () {}
                            );
                        },
                        500
                    );
                }
            }
        );

        /*
         * Hard visibility restoration protection.
         */

        document.addEventListener(
            "visibilitychange",
            function () {
                if (
                    document.visibilityState ===
                    "visible" &&
                    global.RainGuardEngineReleaseReady ===
                        true
                ) {
                    run().catch(
                        function () {}
                    );
                }
            }
        );

        console.log(
            `[RainGuard][${PHASE}] Installed`,
            {
                version:
                    VERSION,

                hardReloadReset:
                    true,

                staleReadinessInvalidation:
                    true,

                minimumCoveragePercent:
                    MINIMUM_COVERAGE_PERCENT
            }
        );

        return bridge;
    }

    const bridge = {
        phase:
            PHASE,

        version:
            VERSION,

        build:
            BUILD,

        states:
            STATES,

        minimumCoveragePercent:
            MINIMUM_COVERAGE_PERCENT,

        install,

        run,

        diagnose,

        resetStaleReadiness,

        readCurrentCoverage,

        isReady,

        get installed() {
            return installed;
        },

        get running() {
            return running;
        },

        get currentState() {
            return currentState;
        },

        get resetCount() {
            return resetCount;
        },

        get staleInvalidationCount() {
            return staleInvalidationCount;
        },

        get verificationCount() {
            return verificationCount;
        },

        get currentCoverage() {
            return currentCoverage;
        },

        get currentReleaseReady() {
            return currentReleaseReady;
        },

        get currentStrictReady() {
            return currentStrictReady;
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

    global.runRainGuard39A15F6N4B1B3C7B1HardReloadEngineReleaseReset =
        run;

    global.diagnoseRainGuard39A15F6N4B1B3C7B1HardReloadEngineReleaseReset =
        diagnose;

    global.isRainGuard39A15F6N4B1B3C7B1CurrentReleaseReady =
        isReady;

    /*
     * Install immediately.
     */

    install();

})(window);
