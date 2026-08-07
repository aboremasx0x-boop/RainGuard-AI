/*
 RainGuard AI V32
 Phase 38M-19A — Loader
 Version: 32.38M.19A
*/

(function (global) {
    "use strict";

    const VERSION = "32.38M.19A";
    const BUILD = "rainguard-v32-phase38m19a-loader";
    const BASE = "./js/rain_arrival_prediction_engine_v32/";
    const CACHE = "3238M19A";

    const MODULES = [
        ["motionPredictionAI", "motion_prediction_ai_engine.js", "RainArrivalMotionPredictionAIV32"],
        ["motionPredictionRepository", "motion_prediction_repository.js", "RainArrivalMotionPredictionRepositoryV32"],
        ["motionPredictionStatistics", "motion_prediction_statistics.js", "RainArrivalMotionPredictionStatisticsV32"],
        ["motionPredictionRenderer", "motion_prediction_renderer.js", "RainArrivalMotionPredictionRendererV32"],
        ["motionPredictionOrchestrator", "motion_prediction_orchestrator.js", "RainArrivalMotionPredictionOrchestratorV32"]
    ];

    const state = {
        version: VERSION,
        build: BUILD,
        status: "IDLE",
        startedAt: null,
        completedAt: null,
        loadedModules: [],
        skippedModules: [],
        failedModules: [],
        currentModule: null,
        ready: false,
        error: null
    };

    function clone(value) {
        try { return structuredClone(value); }
        catch (_) {
            try { return JSON.parse(JSON.stringify(value)); }
            catch (_) { return value; }
        }
    }

    function publish() {
        const snapshot = clone(state);
        global.RainArrivalPhase38M19AState = snapshot;
        global.RainGuardAI = global.RainGuardAI || {};
        global.RainGuardAI.V32 = global.RainGuardAI.V32 || {};
        global.RainGuardAI.V32.phase38M19A = snapshot;
        global.dispatchEvent?.(
            new CustomEvent(
                "rainarrival:phase38m19a-loader-state",
                { detail: snapshot }
            )
        );
        return snapshot;
    }

    function existingScript(file) {
        return Array.from(document.scripts).find(
            script => script.src && script.src.includes(BASE + file)
        ) || null;
    }

    function waitForGlobal(name, timeoutMs = 10000) {
        return new Promise((resolve, reject) => {
            const startedAt = Date.now();

            function check() {
                if (global[name]) {
                    resolve(global[name]);
                    return;
                }

                if (Date.now() - startedAt >= timeoutMs) {
                    reject(new Error("Timed out waiting for global: " + name));
                    return;
                }

                global.setTimeout(check, 50);
            }

            check();
        });
    }

    async function loadModule([name, file, requiredGlobal]) {
        state.currentModule = name;
        publish();

        if (global[requiredGlobal]) {
            state.skippedModules.push({
                name,
                file,
                requiredGlobal,
                reason: "ALREADY_AVAILABLE",
                loadedAt: Date.now()
            });

            return {
                success: true,
                skipped: true,
                name,
                file,
                global: requiredGlobal
            };
        }

        if (existingScript(file)) {
            await waitForGlobal(requiredGlobal);

            state.skippedModules.push({
                name,
                file,
                requiredGlobal,
                reason: "SCRIPT_ALREADY_PRESENT",
                loadedAt: Date.now()
            });

            return {
                success: true,
                skipped: true,
                name,
                file,
                global: requiredGlobal
            };
        }

        await new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src = `${BASE}${file}?v=${CACHE}`;
            script.async = false;
            script.dataset.rainArrivalPhase = "38M-19A";
            script.dataset.rainArrivalModule = name;
            script.onload = resolve;
            script.onerror = () => reject(
                new Error("Failed to load " + file)
            );
            document.head.appendChild(script);
        });

        await waitForGlobal(requiredGlobal);

        state.loadedModules.push({
            name,
            file,
            requiredGlobal,
            loadedAt: Date.now()
        });

        return {
            success: true,
            skipped: false,
            name,
            file,
            global: requiredGlobal
        };
    }

    async function loadAll() {
        if (state.status === "LOADING") {
            return global.RainArrivalPhase38M19ALoader.readyPromise;
        }

        if (state.ready) {
            return {
                success: true,
                status: "PHASE_38M_19A_ALREADY_READY",
                state: publish()
            };
        }

        state.status = "LOADING";
        state.startedAt = Date.now();
        state.completedAt = null;
        state.loadedModules = [];
        state.skippedModules = [];
        state.failedModules = [];
        state.error = null;
        publish();

        const results = [];

        try {
            for (const definition of MODULES) {
                try {
                    results.push(await loadModule(definition));
                    publish();
                } catch (error) {
                    const [name, file, requiredGlobal] = definition;
                    const failure = {
                        name,
                        file,
                        requiredGlobal,
                        message: error?.message ?? String(error),
                        timestamp: Date.now()
                    };

                    state.failedModules.push(failure);
                    state.error = failure;
                    throw error;
                }
            }

            state.status = "READY";
            state.ready = true;
            state.currentModule = null;
            state.completedAt = Date.now();

            const finalState = publish();

            const pipelineResult =
                global.RainArrivalMotionPredictionOrchestratorV32
                    ?.run?.() ?? null;

            const result = {
                success: true,
                status: "PHASE_38M_19A_READY",
                version: VERSION,
                build: BUILD,
                moduleCount: MODULES.length,
                loadedCount: state.loadedModules.length,
                skippedCount: state.skippedModules.length,
                failedCount: state.failedModules.length,
                results: clone(results),
                pipelineResult: clone(pipelineResult),
                state: finalState
            };

            console.log(
                "[RainGuard AI V32] Phase 38M-19A loaded.",
                result
            );

            global.dispatchEvent?.(
                new CustomEvent(
                    "rainarrival:phase38m19a-ready",
                    { detail: clone(result) }
                )
            );

            return result;

        } catch (error) {
            state.status = "FAILED";
            state.ready = false;
            state.currentModule = null;
            state.completedAt = Date.now();
            state.error = {
                name: error?.name ?? "Error",
                message: error?.message ?? String(error),
                stack: error?.stack ?? null,
                timestamp: Date.now()
            };

            publish();

            const result = {
                success: false,
                status: "PHASE_38M_19A_LOAD_FAILED",
                version: VERSION,
                build: BUILD,
                error: clone(state.error),
                state: clone(state)
            };

            console.error(
                "[RainGuard AI V32] Phase 38M-19A load failed.",
                result
            );

            return result;
        }
    }

    function getModules() {
        return MODULES.map(([name, file, requiredGlobal]) => ({
            name,
            file,
            global: requiredGlobal,
            available: Boolean(global[requiredGlobal])
        }));
    }

    function printModules() {
        const modules = getModules();
        console.table(modules);
        return modules;
    }

    const loader = {
        version: VERSION,
        build: BUILD,
        modules: clone(MODULES),
        load: loadAll,
        getState: () => clone(state),
        getModules,
        printModules,
        readyPromise: null
    };

    global.RainArrivalPhase38M19ALoader = loader;
    loader.readyPromise = loadAll();

})(
    typeof globalThis !== "undefined"
        ? globalThis
        : window
);
