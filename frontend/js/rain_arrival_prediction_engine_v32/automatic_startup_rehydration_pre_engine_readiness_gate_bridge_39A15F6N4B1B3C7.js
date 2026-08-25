/*
 * RainGuard AI
 * Phase 39A-15F6N4B1B3C7
 *
 * Automatic Startup Rehydration & Pre-Engine Readiness Gate Bridge
 *
 * Purpose
 * -------
 * 1. Wait for the IndexedDB persistence stack to become available.
 * 2. Wait for C6 Full Runtime Rehydration bridge.
 * 3. Automatically execute C6 after page load/reload.
 * 4. Verify authoritative persisted identity coverage against runtime.
 * 5. Retry when startup ordering leaves runtime partially hydrated.
 * 6. Open a global readiness gate only when runtime coverage is acceptable.
 * 7. Publish readiness events for downstream Motion / Storm / ETA engines.
 *
 * IMPORTANT
 * ---------
 * C7 does NOT replace C2/C3/C4/C5/C6.
 * It orchestrates them and exposes a startup readiness contract.
 */

(function () {
  "use strict";

  const PHASE = "39A-15F6N4B1B3C7";
  const VERSION = "39A.15F6N4B1B3C7.0";

  const BUILD =
    "rainguard-v39-automatic-startup-rehydration-pre-engine-readiness-gate-bridge";

  const MINIMUM_ACCEPTABLE_COVERAGE_PERCENT = 99;

  const MAX_STARTUP_ATTEMPTS = 12;
  const INITIAL_RETRY_DELAY_MS = 750;
  const MAX_RETRY_DELAY_MS = 5000;

  const STARTUP_DELAY_MS = 250;

  const READY_EVENT = "rainguard:pre-engine-runtime-ready";
  const BLOCKED_EVENT = "rainguard:pre-engine-runtime-blocked";
  const STATE_EVENT = "rainguard:pre-engine-readiness-state";

  const C6_BRIDGE_NAME =
    "RainGuard39A15F6N4B1B3C6BridgeV39";

  const GLOBAL_BRIDGE_NAME =
    "RainGuard39A15F6N4B1B3C7BridgeV39";

  const STATES = Object.freeze({
    IDLE: "IDLE",

    WAITING_FOR_INDEXEDDB:
      "WAITING_FOR_INDEXEDDB",

    WAITING_FOR_REHYDRATION:
      "WAITING_FOR_REHYDRATION",

    RUNNING_FULL_RUNTIME_REPAIR:
      "RUNNING_FULL_RUNTIME_REPAIR",

    VERIFYING_IDENTITY_COVERAGE:
      "VERIFYING_IDENTITY_COVERAGE",

    PRE_ENGINE_READINESS_GATE_OPEN:
      "PRE_ENGINE_READINESS_GATE_OPEN",

    PRE_ENGINE_READINESS_GATE_BLOCKED:
      "PRE_ENGINE_READINESS_GATE_BLOCKED",

    FAILED:
      "FAILED"
  });

  let currentState = STATES.IDLE;

  let running = false;
  let installed = false;
  let startupCompleted = false;

  let attemptCount = 0;
  let retryCount = 0;

  let startupPromise = null;
  let retryTimer = null;

  let lastResult = null;
  let lastCoverageReport = null;
  let lastError = null;

  let readinessGateOpen = false;
  let engineRuntimeReady = false;

  let readyPublished = false;

  let startedAt = null;
  let completedAt = null;

  /*
   * ------------------------------------------------------------
   * Utilities
   * ------------------------------------------------------------
   */

  function now() {
    return Date.now();
  }

  function sleep(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  function safeNumber(value, fallback) {
    const number = Number(value);

    if (Number.isFinite(number)) {
      return number;
    }

    return fallback;
  }

  function safeBoolean(value) {
    return value === true;
  }

  function cloneSimple(value) {
    if (value == null) {
      return value;
    }

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
      name:
        typeof error.name === "string"
          ? error.name
          : "Error",

      message:
        typeof error.message === "string"
          ? error.message
          : String(error),

      stack:
        typeof error.stack === "string"
          ? error.stack
          : null
    };
  }

  function calculateRetryDelay(attempt) {
    const multiplier = Math.max(0, attempt - 1);

    const delay =
      INITIAL_RETRY_DELAY_MS *
      Math.pow(1.45, multiplier);

    return Math.min(
      MAX_RETRY_DELAY_MS,
      Math.round(delay)
    );
  }

  /*
   * ------------------------------------------------------------
   * State publication
   * ------------------------------------------------------------
   */

  function publishState(state, extra) {
    currentState = state;

    const detail = Object.assign(
      {
        phase: PHASE,
        version: VERSION,
        build: BUILD,
        state: state,
        generatedAt: now(),
        attemptCount: attemptCount,
        retryCount: retryCount,
        readinessGateOpen: readinessGateOpen,
        engineRuntimeReady: engineRuntimeReady
      },
      extra || {}
    );

    try {
      window.dispatchEvent(
        new CustomEvent(STATE_EVENT, {
          detail: detail
        })
      );
    } catch (_) {
      // Event publication must never break startup.
    }

    return detail;
  }

  /*
   * ------------------------------------------------------------
   * Dependency discovery
   * ------------------------------------------------------------
   */

  function getC6Bridge() {
    const bridge = window[C6_BRIDGE_NAME];

    if (
      bridge &&
      typeof bridge === "object"
    ) {
      return bridge;
    }

    return null;
  }

  function indexedDBAvailable() {
    try {
      return (
        typeof window.indexedDB !== "undefined" &&
        window.indexedDB !== null
      );
    } catch (_) {
      return false;
    }
  }

  function detectC4CutoverActive() {
    /*
     * We deliberately support several detection routes because
     * previous phases may expose their state through bridge objects
     * rather than a single global function.
     */

    const possibleObjects = [
      window.RainGuard39A15F6N4B1B3C4BridgeV39,
      window.RainGuard39A15F6N4B1B3C4IndexedDBAuthoritativeRuntimePersistenceCutoverBridgeV39
    ];

    for (const item of possibleObjects) {
      if (!item || typeof item !== "object") {
        continue;
      }

      if (
        item.c4CutoverActive === true ||
        item.cutoverActive === true ||
        item.indexedDBAuthoritative === true ||
        item.authoritativeStore === "IndexedDB"
      ) {
        return true;
      }

      if (
        item.lastResult &&
        typeof item.lastResult === "object" &&
        (
          item.lastResult.c4CutoverActive === true ||
          item.lastResult.cutoverActive === true ||
          item.lastResult.indexedDBAuthoritative === true ||
          item.lastResult.authoritativeStore === "IndexedDB"
        )
      ) {
        return true;
      }
    }

    /*
     * C6 already verifies whether IndexedDB is authoritative.
     * If C4's exact global name differs, C6 remains the authoritative
     * fallback signal.
     */

    const c6 = getC6Bridge();

    if (c6) {
      if (c6.indexedDBAuthoritative === true) {
        return true;
      }

      if (
        c6.lastResult &&
        c6.lastResult.indexedDBAuthoritative === true
      ) {
        return true;
      }
    }

    return false;
  }

  function dependencyReport() {
    const c6 = getC6Bridge();

    return {
      indexedDBAvailable: indexedDBAvailable(),

      c6Available: !!c6,

      c6RunAvailable:
        !!c6 &&
        typeof c6.run === "function",

      c6DiagnoseAvailable:
        !!c6 &&
        typeof c6.diagnose === "function",

      c6CoverageAvailable:
        !!c6 &&
        typeof c6.getIdentityCoverageReport ===
          "function",

      c4CutoverActive:
        detectC4CutoverActive()
    };
  }

  /*
   * ------------------------------------------------------------
   * Coverage normalization
   * ------------------------------------------------------------
   */

  function extractCoverageCandidate(source) {
    if (!source || typeof source !== "object") {
      return null;
    }

    const candidates = [
      source.coverage,
      source.lastCoverageReport,
      source.identityCoverageReport,
      source.coverageReport,
      source
    ];

    for (const candidate of candidates) {
      if (
        candidate &&
        typeof candidate === "object"
      ) {
        const persisted =
          safeNumber(
            candidate.persistedUniqueIdentityCount,
            safeNumber(
              candidate.persistedIdentityCount,
              safeNumber(
                candidate.persistedRecordCount,
                null
              )
            )
          );

        const runtime =
          safeNumber(
            candidate.runtimeIdentityCount,
            safeNumber(
              candidate.runtimeRehydratedIdentityCount,
              null
            )
          );

        const matched =
          safeNumber(
            candidate.matchedIdentityCount,
            null
          );

        const missing =
          safeNumber(
            candidate.missingInRuntimeCount,
            safeNumber(
              candidate.missingRuntimeCount,
              null
            )
          );

        const coveragePercent =
          safeNumber(
            candidate.coveragePercent,
            null
          );

        if (
          persisted !== null ||
          runtime !== null ||
          matched !== null ||
          missing !== null ||
          coveragePercent !== null
        ) {
          return candidate;
        }
      }
    }

    return null;
  }

  function normalizeCoverage(source) {
    const candidate =
      extractCoverageCandidate(source) || {};

    let persistedUniqueIdentityCount =
      safeNumber(
        candidate.persistedUniqueIdentityCount,
        safeNumber(
          candidate.persistedIdentityCount,
          safeNumber(
            candidate.persistedRecordCount,
            0
          )
        )
      );

    let runtimeIdentityCount =
      safeNumber(
        candidate.runtimeIdentityCount,
        safeNumber(
          candidate.runtimeRehydratedIdentityCount,
          0
        )
      );

    let matchedIdentityCount =
      safeNumber(
        candidate.matchedIdentityCount,
        Math.min(
          persistedUniqueIdentityCount,
          runtimeIdentityCount
        )
      );

    let missingInRuntimeCount =
      safeNumber(
        candidate.missingInRuntimeCount,
        safeNumber(
          candidate.missingRuntimeCount,
          Math.max(
            0,
            persistedUniqueIdentityCount -
              matchedIdentityCount
          )
        )
      );

    let coveragePercent =
      safeNumber(
        candidate.coveragePercent,
        null
      );

    if (coveragePercent === null) {
      if (persistedUniqueIdentityCount <= 0) {
        coveragePercent = 100;
      } else {
        coveragePercent =
          (
            matchedIdentityCount /
            persistedUniqueIdentityCount
          ) * 100;
      }
    }

    coveragePercent =
      Math.max(
        0,
        Math.min(
          100,
          Number(
            coveragePercent.toFixed(2)
          )
        )
      );

    return {
      persistedUniqueIdentityCount:
        persistedUniqueIdentityCount,

      runtimeIdentityCount:
        runtimeIdentityCount,

      matchedIdentityCount:
        matchedIdentityCount,

      missingInRuntimeCount:
        missingInRuntimeCount,

      coveragePercent:
        coveragePercent,

      minimumAcceptableCoveragePercent:
        MINIMUM_ACCEPTABLE_COVERAGE_PERCENT,

      identityCoverageVerified:
        coveragePercent >=
          MINIMUM_ACCEPTABLE_COVERAGE_PERCENT &&
        missingInRuntimeCount === 0
    };
  }

  /*
   * ------------------------------------------------------------
   * C6 execution
   * ------------------------------------------------------------
   */

  async function getCoverageReport() {
    const c6 = getC6Bridge();

    if (!c6) {
      return normalizeCoverage(null);
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
    } catch (error) {
      console.warn(
        "[RainGuard][39A-15F6N4B1B3C7] " +
          "C6 coverage report failed:",
        error
      );
    }

    if (!report) {
      report =
        c6.lastCoverageReport ||
        c6.lastResult ||
        null;
    }

    const normalized =
      normalizeCoverage(report);

    lastCoverageReport = normalized;

    return normalized;
  }

  async function runC6Repair() {
    const c6 = getC6Bridge();

    if (!c6) {
      throw new Error(
        "C6 bridge is not available."
      );
    }

    if (typeof c6.run !== "function") {
      throw new Error(
        "C6 run() is not available."
      );
    }

    publishState(
      STATES.RUNNING_FULL_RUNTIME_REPAIR
    );

    return await c6.run();
  }

  async function diagnoseC6() {
    const c6 = getC6Bridge();

    if (
      !c6 ||
      typeof c6.diagnose !== "function"
    ) {
      return null;
    }

    try {
      return await c6.diagnose();
    } catch (error) {
      console.warn(
        "[RainGuard][39A-15F6N4B1B3C7] " +
          "C6 diagnose failed:",
        error
      );

      return null;
    }
  }

  /*
   * ------------------------------------------------------------
   * Readiness gate
   * ------------------------------------------------------------
   */

  function closeGate(reason) {
    readinessGateOpen = false;
    engineRuntimeReady = false;
    readyPublished = false;

    window.RainGuardPreEngineRuntimeReady = false;

    publishState(
      STATES.PRE_ENGINE_READINESS_GATE_BLOCKED,
      {
        reason:
          reason ||
          "RUNTIME_NOT_READY"
      }
    );
  }

  function openGate(result) {
    readinessGateOpen = true;
    engineRuntimeReady = true;
    startupCompleted = true;
    completedAt = now();

    window.RainGuardPreEngineRuntimeReady = true;

    window.RainGuardPreEngineRuntimeReadyAt =
      completedAt;

    window.RainGuardPreEngineRuntimeReadyResult =
      result;

    publishState(
      STATES.PRE_ENGINE_READINESS_GATE_OPEN,
      {
        result: result
      }
    );

    if (!readyPublished) {
      readyPublished = true;

      try {
        window.dispatchEvent(
          new CustomEvent(READY_EVENT, {
            detail: result
          })
        );
      } catch (_) {
        // Do not break gate opening because of event failure.
      }
    }
  }

  function publishBlocked(result) {
    try {
      window.dispatchEvent(
        new CustomEvent(BLOCKED_EVENT, {
          detail: result
        })
      );
    } catch (_) {
      // No-op
    }
  }

  /*
   * ------------------------------------------------------------
   * Single startup attempt
   * ------------------------------------------------------------
   */

  async function executeAttempt() {
    attemptCount += 1;

    const attemptStartedAt = now();

    const dependencies =
      dependencyReport();

    if (!dependencies.indexedDBAvailable) {
      publishState(
        STATES.WAITING_FOR_INDEXEDDB
      );

      return {
        success: false,
        retryable: true,
        status: "WAITING_FOR_INDEXEDDB",
        dependencies: dependencies
      };
    }

    if (
      !dependencies.c6Available ||
      !dependencies.c6RunAvailable
    ) {
      publishState(
        STATES.WAITING_FOR_REHYDRATION
      );

      return {
        success: false,
        retryable: true,
        status:
          "WAITING_FOR_C6_REHYDRATION_BRIDGE",
        dependencies: dependencies
      };
    }

    /*
     * First inspect the current coverage.
     */

    publishState(
      STATES.VERIFYING_IDENTITY_COVERAGE
    );

    let coverage =
      await getCoverageReport();

    /*
     * IMPORTANT:
     * Even when the current runtime looks complete,
     * execute C6 during initial startup unless C6 already confirms
     * that full rehydration was completed.
     */

    const c6 = getC6Bridge();

    const c6AlreadyCompleted =
      !!c6 &&
      (
        c6.fullRuntimeRehydrationCompleted ===
          true ||
        (
          c6.lastResult &&
          c6.lastResult
            .fullRuntimeRehydrationCompleted ===
            true
        )
      );

    let repairResult = null;

    if (
      !c6AlreadyCompleted ||
      !coverage.identityCoverageVerified
    ) {
      repairResult =
        await runC6Repair();

      /*
       * Give synchronous downstream runtime registries a brief
       * opportunity to settle after C6 restoration.
       */

      await sleep(50);

      publishState(
        STATES.VERIFYING_IDENTITY_COVERAGE
      );

      coverage =
        await getCoverageReport();
    }

    /*
     * C6 diagnose is useful for authoritative state flags.
     */

    const c6Diagnostic =
      await diagnoseC6();

    const c6Now = getC6Bridge();

    const fullRuntimeRehydrationCompleted =
      (
        repairResult &&
        repairResult
          .fullRuntimeRehydrationCompleted ===
          true
      ) ||
      (
        c6Diagnostic &&
        c6Diagnostic
          .fullRuntimeRehydrationCompleted ===
          true
      ) ||
      (
        c6Now &&
        c6Now.fullRuntimeRehydrationCompleted ===
          true
      ) ||
      (
        c6Now &&
        c6Now.lastResult &&
        c6Now.lastResult
          .fullRuntimeRehydrationCompleted ===
          true
      );

    const indexedDBAuthoritative =
      (
        repairResult &&
        repairResult.indexedDBAuthoritative ===
          true
      ) ||
      (
        c6Diagnostic &&
        c6Diagnostic.indexedDBAuthoritative ===
          true
      ) ||
      (
        c6Now &&
        c6Now.indexedDBAuthoritative === true
      ) ||
      detectC4CutoverActive();

    const identityCoverageVerified =
      coverage.identityCoverageVerified ===
        true;

    const gateCanOpen =
      indexedDBAvailable() &&
      fullRuntimeRehydrationCompleted &&
      indexedDBAuthoritative &&
      identityCoverageVerified &&
      coverage.missingInRuntimeCount === 0 &&
      coverage.coveragePercent >=
        MINIMUM_ACCEPTABLE_COVERAGE_PERCENT;

    const result = {
      success: gateCanOpen,

      phase: PHASE,
      version: VERSION,
      build: BUILD,

      status: gateCanOpen
        ? "PRE_ENGINE_READINESS_GATE_OPEN"
        : "PRE_ENGINE_READINESS_GATE_BLOCKED",

      generatedAt: now(),

      attempt: attemptCount,

      durationMs:
        now() - attemptStartedAt,

      indexedDBReady:
        indexedDBAvailable(),

      c6Available:
        !!c6Now,

      c4CutoverActive:
        detectC4CutoverActive(),

      indexedDBAuthoritative:
        indexedDBAuthoritative,

      c6FullRuntimeRehydrationCompleted:
        fullRuntimeRehydrationCompleted,

      identityCoverageVerified:
        identityCoverageVerified,

      coveragePercent:
        coverage.coveragePercent,

      minimumAcceptableCoveragePercent:
        MINIMUM_ACCEPTABLE_COVERAGE_PERCENT,

      persistedUniqueIdentityCount:
        coverage.persistedUniqueIdentityCount,

      runtimeIdentityCount:
        coverage.runtimeIdentityCount,

      matchedIdentityCount:
        coverage.matchedIdentityCount,

      missingInRuntimeCount:
        coverage.missingInRuntimeCount,

      readinessGateOpen:
        gateCanOpen,

      engineRuntimeReady:
        gateCanOpen,

      dependencies:
        dependencyReport(),

      repairResult:
        cloneSimple(repairResult),

      c6Diagnostic:
        cloneSimple(c6Diagnostic)
    };

    lastResult = result;

    if (gateCanOpen) {
      openGate(result);

      return Object.assign(
        {},
        result,
        {
          retryable: false
        }
      );
    }

    closeGate(
      "IDENTITY_COVERAGE_NOT_READY"
    );

    publishBlocked(result);

    return Object.assign(
      {},
      result,
      {
        retryable: true
      }
    );
  }

  /*
   * ------------------------------------------------------------
   * Startup orchestration with retry guard
   * ------------------------------------------------------------
   */

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

        /*
         * Always begin with a closed gate.
         */

        closeGate(
          "STARTUP_REHYDRATION_IN_PROGRESS"
        );

        try {
          for (
            let attempt = 1;
            attempt <= MAX_STARTUP_ATTEMPTS;
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

                phase: PHASE,
                version: VERSION,
                build: BUILD,

                status:
                  "PRE_ENGINE_READINESS_ATTEMPT_FAILED",

                attempt:
                  attemptCount,

                error:
                  lastError,

                generatedAt:
                  now()
              };

              lastResult = result;

              console.warn(
                "[RainGuard][39A-15F6N4B1B3C7] " +
                  "Startup attempt failed:",
                error
              );
            }

            if (
              result &&
              result.success === true &&
              readinessGateOpen === true
            ) {
              running = false;

              return result;
            }

            if (
              attempt >=
              MAX_STARTUP_ATTEMPTS
            ) {
              break;
            }

            retryCount += 1;

            const delay =
              calculateRetryDelay(attempt);

            await sleep(delay);
          }

          running = false;

          readinessGateOpen = false;
          engineRuntimeReady = false;

          window.RainGuardPreEngineRuntimeReady =
            false;

          const failedResult = {
            success: false,

            phase: PHASE,
            version: VERSION,
            build: BUILD,

            status:
              "PRE_ENGINE_READINESS_GATE_BLOCKED",

            generatedAt:
              now(),

            attemptCount:
              attemptCount,

            retryCount:
              retryCount,

            readinessGateOpen:
              false,

            engineRuntimeReady:
              false,

            coverage:
              cloneSimple(
                lastCoverageReport
              ),

            error:
              lastError
          };

          lastResult =
            failedResult;

          publishState(
            STATES.PRE_ENGINE_READINESS_GATE_BLOCKED,
            failedResult
          );

          publishBlocked(
            failedResult
          );

          return failedResult;
        } catch (error) {
          running = false;

          lastError =
            normalizeError(error);

          readinessGateOpen = false;
          engineRuntimeReady = false;

          window.RainGuardPreEngineRuntimeReady =
            false;

          const failedResult = {
            success: false,

            phase: PHASE,
            version: VERSION,
            build: BUILD,

            status:
              "PRE_ENGINE_READINESS_GATE_FAILED",

            generatedAt:
              now(),

            error:
              lastError
          };

          lastResult =
            failedResult;

          publishState(
            STATES.FAILED,
            failedResult
          );

          publishBlocked(
            failedResult
          );

          return failedResult;
        } finally {
          startupPromise = null;
        }
      })();

    return startupPromise;
  }

  /*
   * ------------------------------------------------------------
   * Manual retry
   * ------------------------------------------------------------
   */

  async function retry() {
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }

    startupCompleted = false;
    readinessGateOpen = false;
    engineRuntimeReady = false;
    readyPublished = false;

    window.RainGuardPreEngineRuntimeReady =
      false;

    return await run();
  }

  /*
   * ------------------------------------------------------------
   * Readiness waiter for downstream engines
   * ------------------------------------------------------------
   */

  function waitUntilReady(timeoutMs) {
    const timeout =
      safeNumber(
        timeoutMs,
        30000
      );

    if (
      readinessGateOpen === true &&
      engineRuntimeReady === true
    ) {
      return Promise.resolve(
        lastResult
      );
    }

    return new Promise(function (
      resolve,
      reject
    ) {
      let finished = false;

      let timeoutId = null;

      function cleanup() {
        window.removeEventListener(
          READY_EVENT,
          onReady
        );

        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      }

      function onReady(event) {
        if (finished) {
          return;
        }

        finished = true;
        cleanup();

        resolve(
          event && event.detail
            ? event.detail
            : lastResult
        );
      }

      window.addEventListener(
        READY_EVENT,
        onReady,
        {
          once: true
        }
      );

      timeoutId =
        setTimeout(function () {
          if (finished) {
            return;
          }

          finished = true;
          cleanup();

          reject(
            new Error(
              "RainGuard pre-engine readiness timeout."
            )
          );
        }, timeout);
    });
  }

  /*
   * ------------------------------------------------------------
   * Diagnostics
   * ------------------------------------------------------------
   */

  async function diagnose() {
    const coverage =
      await getCoverageReport();

    const dependencies =
      dependencyReport();

    const result = {
      success: true,

      phase: PHASE,
      version: VERSION,
      build: BUILD,

      installed:
        installed,

      running:
        running,

      startupCompleted:
        startupCompleted,

      state:
        currentState,

      attemptCount:
        attemptCount,

      retryCount:
        retryCount,

      indexedDBReady:
        dependencies.indexedDBAvailable,

      c6Available:
        dependencies.c6Available,

      c6RunAvailable:
        dependencies.c6RunAvailable,

      c6DiagnoseAvailable:
        dependencies.c6DiagnoseAvailable,

      c4CutoverActive:
        dependencies.c4CutoverActive,

      coveragePercent:
        coverage.coveragePercent,

      minimumAcceptableCoveragePercent:
        MINIMUM_ACCEPTABLE_COVERAGE_PERCENT,

      persistedUniqueIdentityCount:
        coverage.persistedUniqueIdentityCount,

      runtimeIdentityCount:
        coverage.runtimeIdentityCount,

      matchedIdentityCount:
        coverage.matchedIdentityCount,

      missingInRuntimeCount:
        coverage.missingInRuntimeCount,

      identityCoverageVerified:
        coverage.identityCoverageVerified,

      readinessGateOpen:
        readinessGateOpen,

      engineRuntimeReady:
        engineRuntimeReady,

      startedAt:
        startedAt,

      completedAt:
        completedAt,

      lastError:
        lastError,

      lastResult:
        cloneSimple(lastResult),

      status:
        readinessGateOpen
          ? "PRE_ENGINE_READINESS_GATE_OPEN"
          : "PRE_ENGINE_READINESS_GATE_BLOCKED"
    };

    console.log(
      "[RainGuard][39A-15F6N4B1B3C7] Diagnostics:",
      result
    );

    return result;
  }

  /*
   * ------------------------------------------------------------
   * Public gate helpers
   * ------------------------------------------------------------
   */

  function isReady() {
    return (
      readinessGateOpen === true &&
      engineRuntimeReady === true
    );
  }

  function getState() {
    return {
      phase: PHASE,
      version: VERSION,
      build: BUILD,

      state:
        currentState,

      running:
        running,

      installed:
        installed,

      startupCompleted:
        startupCompleted,

      attemptCount:
        attemptCount,

      retryCount:
        retryCount,

      readinessGateOpen:
        readinessGateOpen,

      engineRuntimeReady:
        engineRuntimeReady,

      coverage:
        cloneSimple(
          lastCoverageReport
        ),

      lastResult:
        cloneSimple(
          lastResult
        ),

      lastError:
        cloneSimple(
          lastError
        )
    };
  }

  /*
   * ------------------------------------------------------------
   * Install / Auto-start
   * ------------------------------------------------------------
   */

  function scheduleStartup() {
    if (startupCompleted) {
      return;
    }

    if (retryTimer) {
      return;
    }

    retryTimer =
      setTimeout(function () {
        retryTimer = null;

        run().catch(function (error) {
          console.error(
            "[RainGuard][39A-15F6N4B1B3C7] " +
              "Automatic startup failed:",
            error
          );
        });
      }, STARTUP_DELAY_MS);
  }

  function install() {
    if (installed) {
      return bridge;
    }

    installed = true;

    /*
     * Gate must default to CLOSED on every page lifecycle.
     */

    window.RainGuardPreEngineRuntimeReady =
      false;

    window.RainGuardPreEngineRuntimeReadyAt =
      null;

    window.RainGuardPreEngineRuntimeReadyResult =
      null;

    publishState(
      STATES.WAITING_FOR_REHYDRATION,
      {
        reason:
          "C7_INSTALL_STARTUP"
      }
    );

    if (
      document.readyState ===
        "loading"
    ) {
      document.addEventListener(
        "DOMContentLoaded",
        scheduleStartup,
        {
          once: true
        }
      );
    } else {
      scheduleStartup();
    }

    /*
     * pageshow also protects BFCache restore scenarios.
     */

    window.addEventListener(
      "pageshow",
      function () {
        if (!isReady()) {
          scheduleStartup();
        }
      }
    );

    console.log(
      "[RainGuard][39A-15F6N4B1B3C7] Installed:",
      {
        phase: PHASE,
        version: VERSION,
        build: BUILD,
        autoStartup: true,
        minimumAcceptableCoveragePercent:
          MINIMUM_ACCEPTABLE_COVERAGE_PERCENT
      }
    );

    return bridge;
  }

  /*
   * ------------------------------------------------------------
   * Public bridge
   * ------------------------------------------------------------
   */

  const bridge = {
    phase: PHASE,
    version: VERSION,
    build: BUILD,

    states: STATES,

    minimumAcceptableCoveragePercent:
      MINIMUM_ACCEPTABLE_COVERAGE_PERCENT,

    maxStartupAttempts:
      MAX_STARTUP_ATTEMPTS,

    readyEvent:
      READY_EVENT,

    blockedEvent:
      BLOCKED_EVENT,

    stateEvent:
      STATE_EVENT,

    install: install,

    run: run,

    retry: retry,

    diagnose: diagnose,

    getState: getState,

    getCoverageReport:
      getCoverageReport,

    dependencyReport:
      dependencyReport,

    isReady: isReady,

    waitUntilReady:
      waitUntilReady
  };

  Object.defineProperties(
    bridge,
    {
      installed: {
        enumerable: true,
        get: function () {
          return installed;
        }
      },

      running: {
        enumerable: true,
        get: function () {
          return running;
        }
      },

      startupCompleted: {
        enumerable: true,
        get: function () {
          return startupCompleted;
        }
      },

      attemptCount: {
        enumerable: true,
        get: function () {
          return attemptCount;
        }
      },

      retryCount: {
        enumerable: true,
        get: function () {
          return retryCount;
        }
      },

      currentState: {
        enumerable: true,
        get: function () {
          return currentState;
        }
      },

      readinessGateOpen: {
        enumerable: true,
        get: function () {
          return readinessGateOpen;
        }
      },

      engineRuntimeReady: {
        enumerable: true,
        get: function () {
          return engineRuntimeReady;
        }
      },

      lastCoverageReport: {
        enumerable: true,
        get: function () {
          return lastCoverageReport;
        }
      },

      lastResult: {
        enumerable: true,
        get: function () {
          return lastResult;
        }
      },

      lastError: {
        enumerable: true,
        get: function () {
          return lastError;
        }
      }
    }
  );

  window[GLOBAL_BRIDGE_NAME] =
    bridge;

  /*
   * Convenience APIs.
   */

  window.runRainGuard39A15F6N4B1B3C7 =
    run;

  window.diagnoseRainGuard39A15F6N4B1B3C7 =
    diagnose;

  window.waitForRainGuardPreEngineRuntimeReady =
    waitUntilReady;

  window.isRainGuardPreEngineRuntimeReady =
    isReady;

  /*
   * Install immediately.
   * Actual C6 execution waits for DOM startup and dependencies.
   */

  install();
})();
