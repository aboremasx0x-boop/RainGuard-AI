/*
===========================================================
 RainGuard AI V32
 Phase 38M-12B1
 Modular Bootstrap & Sequential Module Loader
===========================================================
*/

(function initializeRainArrivalModularEngine(global) {
    "use strict";

    const ENGINE_NAME = "RainArrivalEngineV32";
    const VERSION = "32.38M.19";
    const BUILD = "rainguard-v32-phase38m-candidate-scoring-loader";

    const MODULE_LOAD_ORDER = Object.freeze([
        { name: "utils", file: "utils.js", requiredGlobal: "RainArrivalUtilsV32" },
        { name: "trackStore", file: "track_store.js", requiredGlobal: "RainArrivalTrackStoreV32" },
        { name: "cache", file: "cache.js", requiredGlobal: "RainArrivalCacheV32" },
        {
            name: "cacheCompatibilityBridge",
            file: "cache_compatibility_bridge.js",
            requiredGlobal: "RainArrivalCacheCompatibilityBridgeV32"
        },
        {
            name: "stormTrackStoreBridge",
            file: "storm_trackstore_bridge.js",
            requiredGlobal: "RainArrivalStormTrackStoreBridgeV32"
        },
        {
            name: "stormEntityCollector",
            file: "storm_entity_collector.js",
            requiredGlobal: "RainArrivalStormEntityCollectorV32"
        },
        {
            name: "liveStormExportBridge",
            file: "live_storm_export_bridge.js",
            requiredGlobal: "RainArrivalLiveStormExportBridgeV32"
        },
        {
            name: "stormEntitySourceAdapter",
            file: "storm_entity_source_adapter.js",
            requiredGlobal: "RainArrivalStormEntitySourceAdapterV32"
        },
        {
            name: "finalArrivalCandidateBuilder",
            file: "final_arrival_candidate_builder.js",
            requiredGlobal: "RainArrivalFinalCandidateBuilderV32"
        },
        {
            name: "candidateRepository",
            file: "candidate_repository.js",
            requiredGlobal: "RainArrivalCandidateRepositoryV32"
        },
        {
            name: "candidateScoring",
            file: "candidate_scoring.js",
            requiredGlobal: "RainArrivalCandidateScoringV32"
        },
        { name: "motionEngine", file: "motion_engine.js", requiredGlobal: "RainArrivalMotionEngineV32" },
        { name: "replayEngine", file: "replay_engine.js", requiredGlobal: "RainArrivalReplayEngineV32" },
        { name: "candidateEngine", file: "candidate_engine.js", requiredGlobal: "RainArrivalCandidateEngineV32" },
        { name: "diagnostics", file: "diagnostics.js", requiredGlobal: "RainArrivalDiagnosticsV32" },
        { name: "orchestrator", file: "orchestrator.js", requiredGlobal: "RainArrivalOrchestratorV32" }
    ]);

    const DEFAULT_CONFIG = Object.freeze({
        autoLoad: true,
        autoInitialize: true,
        continueOnOptionalFailure: false,
        scriptTimeoutMs: 30000,
        cacheVersion: "3238M19",
        debug: true
    });

    const now = () => Date.now();

    function isObject(value) {
        return value !== null && typeof value === "object" && !Array.isArray(value);
    }

    function cloneValue(value) {
        if (value === null || value === undefined) return value;
        if (typeof structuredClone === "function") {
            try { return structuredClone(value); } catch (_) {}
        }
        try { return JSON.parse(JSON.stringify(value)); } catch (_) { return value; }
    }

    function ensureTrailingSlash(value) {
        const text = String(value || "");
        if (!text) return "";
        return text.endsWith("/") ? text : `${text}/`;
    }

    function resolveBasePath() {
        const currentScript = document.currentScript;

        if (currentScript?.src) {
            try {
                const url = new URL(currentScript.src, document.baseURI);
                url.search = "";
                url.hash = "";
                url.pathname = url.pathname.substring(0, url.pathname.lastIndexOf("/") + 1);
                return ensureTrailingSlash(url.href);
            } catch (error) {
                console.warn("[RainArrival Bootstrap] Failed to resolve current script path.", error);
            }
        }

        const matchingScript = Array.from(document.scripts || [])
            .slice()
            .reverse()
            .find(script => String(script.src || "").includes("rain_arrival_prediction_engine_v32/index.js"));

        if (matchingScript?.src) {
            const source = matchingScript.src.split("?")[0].split("#")[0];
            return ensureTrailingSlash(source.substring(0, source.lastIndexOf("/") + 1));
        }

        return ensureTrailingSlash(
            new URL("./rain_arrival_prediction_engine_v32/", document.baseURI).href
        );
    }

    class RainArrivalModularEngine {
        constructor(config = {}) {
            this.name = ENGINE_NAME;
            this.version = VERSION;
            this.build = BUILD;
            this.config = { ...DEFAULT_CONFIG, ...(isObject(config) ? config : {}) };
            this.basePath = resolveBasePath();
            this.modules = {};
            this.moduleStates = new Map();
            this.loadedScripts = new Map();
            this.loadingPromises = new Map();
            this.initialized = false;
            this.loading = false;
            this.ready = false;
            this.failed = false;
            this.startedAt = null;
            this.completedAt = null;
            this.lastError = null;
            this.lastResult = null;
            this.createdAt = now();
            this.updatedAt = this.createdAt;
            this.createReadyPromise();
        }

        createReadyPromise() {
            this.readyPromise = new Promise((resolve, reject) => {
                this.resolveReady = resolve;
                this.rejectReady = reject;
            });
            return this.readyPromise;
        }

        register(name, module) {
            if (!name || !module) return false;
            this.modules[name] = module;
            this.moduleStates.set(name, {
                ...(this.moduleStates.get(name) || {}),
                name,
                status: "registered",
                registered: true,
                available: true,
                registeredAt: now()
            });
            this.updatedAt = now();
            if (this.config.debug) {
                console.log("[RainArrival Bootstrap] Module registered:", name);
            }
            return true;
        }

        unregister(name) {
            if (!Object.prototype.hasOwnProperty.call(this.modules, name)) return false;
            delete this.modules[name];
            this.moduleStates.set(name, {
                ...(this.moduleStates.get(name) || {}),
                status: "unregistered",
                registered: false,
                available: false,
                unregisteredAt: now()
            });
            return true;
        }

        get(name) {
            return this.modules[name] || global.RainGuardAI?.V32?.rainArrivalModules?.[name] || null;
        }

        has(name) {
            return Boolean(this.get(name));
        }

        buildScriptUrl(fileName) {
            const url = new URL(fileName, this.basePath);
            if (this.config.cacheVersion) {
                url.searchParams.set("v", this.config.cacheVersion);
            }
            return url.href;
        }

        isScriptAlreadyPresent(url) {
            const normalized = String(url).split("?")[0].split("#")[0];
            return Array.from(document.scripts || []).some(script => {
                const source = String(script.src || "").split("?")[0].split("#")[0];
                return source === normalized;
            });
        }

        waitForGlobal(globalName, timeoutMs = this.config.scriptTimeoutMs) {
            if (!globalName || global[globalName]) {
                return Promise.resolve(globalName ? global[globalName] : true);
            }

            return new Promise((resolve, reject) => {
                const startedAt = now();
                const timer = global.setInterval(() => {
                    if (global[globalName]) {
                        global.clearInterval(timer);
                        resolve(global[globalName]);
                        return;
                    }
                    if (now() - startedAt >= timeoutMs) {
                        global.clearInterval(timer);
                        reject(new Error(`GLOBAL_NOT_AVAILABLE: ${globalName}`));
                    }
                }, 25);
            });
        }

        loadScript(definition) {
            const { name, file, requiredGlobal } = definition;

            if (requiredGlobal && global[requiredGlobal]) {
                this.register(name, global[requiredGlobal]);
                this.moduleStates.set(name, {
                    name,
                    file,
                    requiredGlobal,
                    status: "already-available",
                    loaded: true,
                    registered: true,
                    available: true,
                    loadedAt: now()
                });
                return Promise.resolve(global[requiredGlobal]);
            }

            const scriptUrl = this.buildScriptUrl(file);
            if (this.loadingPromises.has(scriptUrl)) {
                return this.loadingPromises.get(scriptUrl);
            }

            const promise = new Promise((resolve, reject) => {
                this.moduleStates.set(name, {
                    name,
                    file,
                    requiredGlobal,
                    url: scriptUrl,
                    status: "loading",
                    loaded: false,
                    registered: false,
                    available: false,
                    startedAt: now()
                });

                const complete = async () => {
                    try {
                        const module = requiredGlobal
                            ? await this.waitForGlobal(requiredGlobal)
                            : true;

                        if (module && requiredGlobal) this.register(name, module);
                        this.loadedScripts.set(scriptUrl, true);
                        this.moduleStates.set(name, {
                            name,
                            file,
                            requiredGlobal,
                            url: scriptUrl,
                            status: "ready",
                            loaded: true,
                            registered: Boolean(this.get(name)),
                            available: Boolean(requiredGlobal ? global[requiredGlobal] : true),
                            completedAt: now()
                        });
                        resolve(module);
                    } catch (error) {
                        this.moduleStates.set(name, {
                            name,
                            file,
                            requiredGlobal,
                            url: scriptUrl,
                            status: "failed",
                            loaded: false,
                            registered: false,
                            available: false,
                            error: this.normalizeError(error),
                            completedAt: now()
                        });
                        reject(error);
                    }
                };

                if (this.isScriptAlreadyPresent(scriptUrl)) {
                    complete();
                    return;
                }

                const script = document.createElement("script");
                script.src = scriptUrl;
                script.async = false;
                script.defer = false;
                script.dataset.rainArrivalModule = name;
                script.onload = complete;
                script.onerror = () => {
                    const error = new Error(`MODULE_LOAD_FAILED: ${name} (${file})`);
                    this.moduleStates.set(name, {
                        name,
                        file,
                        requiredGlobal,
                        url: scriptUrl,
                        status: "failed",
                        loaded: false,
                        registered: false,
                        available: false,
                        error: this.normalizeError(error),
                        completedAt: now()
                    });
                    reject(error);
                };
                document.head.appendChild(script);
            });

            this.loadingPromises.set(scriptUrl, promise);
            return promise;
        }

        async loadModules() {
            if (this.loading) return this.readyPromise;
            if (this.ready) return cloneValue(this.lastResult);

            this.loading = true;
            this.startedAt = now();
            const loadedModules = [];
            const failedModules = [];

            try {
                for (const definition of MODULE_LOAD_ORDER) {
                    try {
                        await this.loadScript(definition);
                        loadedModules.push(definition.name);
                    } catch (error) {
                        failedModules.push({
                            name: definition.name,
                            file: definition.file,
                            error: this.normalizeError(error)
                        });
                        if (!this.config.continueOnOptionalFailure) throw error;
                    }
                }

                this.loading = false;
                this.ready = failedModules.length === 0;
                this.failed = failedModules.length > 0;
                this.initialized = this.ready;
                this.completedAt = now();
                this.updatedAt = this.completedAt;
                this.lastResult = {
                    success: this.ready,
                    status: this.ready ? "READY" : "READY_WITH_ERRORS",
                    version: this.version,
                    build: this.build,
                    basePath: this.basePath,
                    loadedModules,
                    failedModules,
                    moduleCount: Object.keys(this.modules).length,
                    startedAt: this.startedAt,
                    completedAt: this.completedAt,
                    durationMs: this.completedAt - this.startedAt
                };

                if (this.ready && this.resolveReady) {
                    this.resolveReady(cloneValue(this.lastResult));
                }

                this.publishCompatibilityApi();
                console.log("[RainGuard AI V32] Modular Rain Arrival Engine ready.", this.lastResult);
                return cloneValue(this.lastResult);
            } catch (error) {
                this.loading = false;
                this.ready = false;
                this.failed = true;
                this.initialized = false;
                this.completedAt = now();
                this.lastError = this.normalizeError(error);
                this.lastResult = {
                    success: false,
                    status: "MODULE_LOADING_FAILED",
                    version: this.version,
                    build: this.build,
                    basePath: this.basePath,
                    loadedModules,
                    failedModules,
                    error: cloneValue(this.lastError),
                    startedAt: this.startedAt,
                    completedAt: this.completedAt,
                    durationMs: this.completedAt - this.startedAt
                };

                if (this.rejectReady) this.rejectReady(error);
                console.error("[RainGuard AI V32] Modular loading failed.", this.lastResult);
                return cloneValue(this.lastResult);
            }
        }

        initialize() {
            if (this.config.autoLoad) return this.loadModules();
            this.initialized = true;
            return Promise.resolve({
                success: true,
                status: "INITIALIZED_WITHOUT_AUTO_LOAD"
            });
        }

        async run(context = {}, options = {}) {
            if (!this.ready) {
                const loadResult = await this.loadModules();
                if (!loadResult.success) {
                    return {
                        success: false,
                        reason: "MODULAR_ENGINE_NOT_READY",
                        loadResult
                    };
                }
            }

            const orchestrator = this.get("orchestrator") || global.RainArrivalOrchestratorV32;
            if (!orchestrator || typeof orchestrator.run !== "function") {
                return {
                    success: false,
                    reason: "ORCHESTRATOR_UNAVAILABLE",
                    generatedAt: now()
                };
            }

            return orchestrator.run(context, options);
        }

        publishCompatibilityApi() {
            global.RainGuardAI = global.RainGuardAI || {};
            global.RainGuardAI.V32 = global.RainGuardAI.V32 || {};
            global.RainGuardAI.V32.rainArrivalModules =
                global.RainGuardAI.V32.rainArrivalModules || {};

            let runtime = global.RainGuardAI.V32.rainArrivalPrediction;
            if (!runtime || typeof runtime !== "object") runtime = {};

            runtime.name = ENGINE_NAME;
            runtime.version = VERSION;
            runtime.build = BUILD;
            runtime.modular = true;
            runtime.ready = this.ready;
            runtime.modules = global.RainGuardAI.V32.rainArrivalModules;
            runtime.run = this.run.bind(this);
            runtime.initialize = this.initialize.bind(this);
            runtime.diagnose = this.diagnose.bind(this);
            runtime.getModule = this.get.bind(this);
            runtime.readyPromise = this.readyPromise;

            global.RainGuardAI.V32.rainArrivalPrediction = runtime;
            global.runRainArrivalModularPipeline = async (context = {}, options = {}) =>
                this.run(context, options);
            global.runCompleteRainArrivalPrediction = async (context = {}, options = {}) =>
                this.run(context, options);

            return runtime;
        }

        normalizeError(error) {
            return {
                name: error?.name || "Error",
                message: error?.message || String(error),
                stack: error?.stack || null,
                timestamp: now()
            };
        }

        getDiagnostics() {
            const moduleStates = {};
            for (const [name, state] of this.moduleStates) {
                moduleStates[name] = cloneValue(state);
            }

            return {
                name: this.name,
                version: this.version,
                build: this.build,
                modular: true,
                initialized: this.initialized,
                loading: this.loading,
                ready: this.ready,
                failed: this.failed,
                basePath: this.basePath,
                registeredModuleCount: Object.keys(this.modules).length,
                registeredModules: Object.keys(this.modules),
                moduleStates,
                lastResult: cloneValue(this.lastResult),
                lastError: cloneValue(this.lastError),
                createdAt: this.createdAt,
                startedAt: this.startedAt,
                completedAt: this.completedAt,
                updatedAt: this.updatedAt
            };
        }

        diagnose() {
            const diagnostics = this.getDiagnostics();
            console.log("[RainArrival Modular Engine]", diagnostics);
            return diagnostics;
        }

        printModules() {
            const rows = MODULE_LOAD_ORDER.map(definition => {
                const state = this.moduleStates.get(definition.name) || {};
                return {
                    module: definition.name,
                    file: definition.file,
                    requiredGlobal: definition.requiredGlobal,
                    status: state.status || "pending",
                    registered: Boolean(this.get(definition.name)),
                    available: Boolean(global[definition.requiredGlobal])
                };
            });

            console.table(rows);
            return rows;
        }
    }

    const engine = new RainArrivalModularEngine();

    global.RainArrivalEngineV32 = engine;
    global.RainGuardPhase38M = engine;
    global.RainGuardAI = global.RainGuardAI || {};
    global.RainGuardAI.V32 = global.RainGuardAI.V32 || {};
    global.RainGuardAI.V32.rainArrivalModules =
        global.RainGuardAI.V32.rainArrivalModules || {};
    global.RainGuardAI.V32.rainArrivalModularEngine = engine;

    engine.publishCompatibilityApi();
    global.RainArrivalEngineReady = engine.readyPromise;

    if (engine.config.autoInitialize) {
        engine.initialize();
    }

    console.log("[RainGuard AI V32] Phase 38M-19 Bootstrap loaded.", {
        version: VERSION,
        build: BUILD,
        basePath: engine.basePath,
        cacheVersion: engine.config.cacheVersion
    });

})(typeof globalThis !== "undefined" ? globalThis : window);
