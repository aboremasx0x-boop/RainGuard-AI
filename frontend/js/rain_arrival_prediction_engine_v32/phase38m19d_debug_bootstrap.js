/*
RainGuard AI V32
Phase 38M-19D — Debug Bootstrap
File: frontend/js/rain_arrival_prediction_engine_v32/phase38m19d_debug_bootstrap.js

Load AFTER index.js and BEFORE rain_arrival_integration_v32.js.
This file observes the existing singleton; it does not create another engine.
*/
(function (global) {
    "use strict";

    const PHASE = "38M-19D";
    const VERSION = "32.38M.19D";

    const CONFIG = Object.freeze({
        pollIntervalMs: 250,
        softStallMs: 5000,
        hardStallMs: 15000,
        maxObservationMs: 45000
    });

    const state = {
        startedAt: Date.now(),
        timer: null,
        previous: new Map(),
        firstSeen: new Map(),
        warned: new Set(),
        finalReport: null
    };

    const now = () => Date.now();

    function getEngine() {
        return global.RainArrivalEngineV32 ||
            global.RainGuardAI?.V32?.rainArrivalModularEngine ||
            global.RainGuardPhase38M ||
            null;
    }

    function getStates(engine) {
        if (engine?.moduleStates instanceof Map) return engine.moduleStates;
        const d = typeof engine?.getDiagnostics === "function"
            ? engine.getDiagnostics()
            : null;
        return d?.moduleStates
            ? new Map(Object.entries(d.moduleStates))
            : new Map();
    }

    function row(name, r) {
        const requiredGlobal = r?.requiredGlobal || null;
        const globalAvailable = requiredGlobal ? Boolean(global[requiredGlobal]) : true;
        const started = Number(r?.startedAt || r?.loadedAt || 0) || now();
        const completed = Number(r?.completedAt || 0) || null;

        return {
            module: name,
            file: r?.file || null,
            status: r?.status || "pending",
            requiredGlobal,
            globalAvailable,
            loaded: Boolean(r?.loaded),
            registered: Boolean(r?.registered),
            available: Boolean(r?.available),
            elapsedMs: completed ? Math.max(0, completed - started) : Math.max(0, now() - started),
            error: r?.error?.message || r?.error || null
        };
    }

    function findBlockingModule(engine) {
        const states = getStates(engine);
        for (const [name, r] of states.entries()) {
            if (r?.status === "failed") return row(name, r);
        }
        for (const [name, r] of states.entries()) {
            if (r?.status === "loading") return row(name, r);
        }
        return null;
    }

    function buildReport(engine) {
        const rows = [];
        for (const [name, r] of getStates(engine).entries()) rows.push(row(name, r));

        return {
            phase: PHASE,
            version: VERSION,
            generatedAt: now(),
            engineFound: Boolean(engine),
            engineName: engine?.name || null,
            engineVersion: engine?.version || null,
            ready: Boolean(engine?.ready),
            loading: Boolean(engine?.loading),
            failed: Boolean(engine?.failed),
            initialized: Boolean(engine?.initialized),
            blockingModule: findBlockingModule(engine),
            lastResult: engine?.lastResult || null,
            lastError: engine?.lastError || null,
            modules: rows
        };
    }

    function printReport(label = "CURRENT REPORT") {
        const engine = getEngine();
        const report = buildReport(engine);
        console.log(`[RainGuard][${PHASE}] ${label}`, report);
        if (report.modules.length) console.table(report.modules);
        return report;
    }

    function observe() {
        const engine = getEngine();

        if (!engine) {
            if (now() - state.startedAt >= CONFIG.maxObservationMs) {
                console.error(`[RainGuard][${PHASE}] Engine not found.`);
                stop("ENGINE_NOT_FOUND");
            }
            return;
        }

        const states = getStates(engine);

        for (const [name, r] of states.entries()) {
            const status = r?.status || "pending";
            const prev = state.previous.get(name);

            if (!state.firstSeen.has(name)) state.firstSeen.set(name, now());

            if (status !== prev) {
                state.previous.set(name, status);

                const data = {
                    file: r?.file || null,
                    requiredGlobal: r?.requiredGlobal || null,
                    globalAvailable: r?.requiredGlobal ? Boolean(global[r.requiredGlobal]) : true
                };

                if (status === "failed") {
                    console.error(`[RainGuard][${PHASE}] ✗ ${name} -> ${status}`, data, r?.error || null);
                } else if (status === "ready" || status === "already-available" || status === "registered") {
                    console.info(`[RainGuard][${PHASE}] ✓ ${name} -> ${status}`, data);
                } else {
                    console.log(`[RainGuard][${PHASE}] … ${name} -> ${status}`, data);
                }
            }

            if (status === "loading") {
                const started = Number(r?.startedAt || 0) || state.firstSeen.get(name);
                const elapsed = now() - started;

                if (elapsed >= CONFIG.softStallMs && !state.warned.has(name + ":soft")) {
                    state.warned.add(name + ":soft");
                    console.warn(`[RainGuard][${PHASE}] Possible stall: ${name} after ${elapsed} ms`, row(name, r));
                }

                if (elapsed >= CONFIG.hardStallMs && !state.warned.has(name + ":hard")) {
                    state.warned.add(name + ":hard");
                    console.error(`[RainGuard][${PHASE}] HARD STALL: ${name} after ${elapsed} ms`, row(name, r));
                }
            }
        }

        if (engine.ready) stop("ENGINE_READY");
        else if (engine.failed) stop("ENGINE_FAILED");
        else if (now() - state.startedAt >= CONFIG.maxObservationMs) stop("OBSERVATION_TIMEOUT");
    }

    function stop(reason = "MANUAL") {
        if (state.timer) {
            global.clearInterval(state.timer);
            state.timer = null;
        }
        state.finalReport = printReport("FINAL REPORT — " + reason);
        return state.finalReport;
    }

    function start() {
        if (state.timer) return true;
        state.startedAt = now();

        console.log(
            `%c[RainGuard AI] Phase ${PHASE} Debug Bootstrap v${VERSION} READY`,
            "font-weight:bold;color:#7c3aed;"
        );

        observe();
        if (!state.finalReport) {
            state.timer = global.setInterval(observe, CONFIG.pollIntervalMs);
        }
        return true;
    }

    function selfTest() {
        const engine = getEngine();
        const result = {
            phase: PHASE,
            passed: Boolean(engine && getStates(engine) instanceof Map),
            engineDetected: Boolean(engine),
            moduleStateCount: getStates(engine).size,
            timestamp: now()
        };

        if (result.passed) {
            console.info(`[RainGuard][${PHASE}] SELF TEST PASSED`, result);
        } else {
            console.error(`[RainGuard][${PHASE}] SELF TEST FAILED`, result);
        }
        return result;
    }

    global.RainGuardPhase38M19DDebug = {
        phase: PHASE,
        version: VERSION,
        state,
        start,
        stop,
        selfTest,
        getEngine,
        getReport: () => buildReport(getEngine()),
        printReport,
        findBlockingModule: () => findBlockingModule(getEngine())
    };

    global.testRainGuardPhase38M19D = selfTest;
    global.printRainGuardPhase38M19D = printReport;
    global.getRainGuardPhase38M19DReport = () => buildReport(getEngine());

    start();

})(typeof globalThis !== "undefined" ? globalThis : window);
