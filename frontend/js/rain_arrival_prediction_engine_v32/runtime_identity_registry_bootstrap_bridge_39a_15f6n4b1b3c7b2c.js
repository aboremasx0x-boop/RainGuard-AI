/*
 * RainGuard AI
 * Phase 39A-15F6N4B1B3C7B2C
 *
 * Runtime Identity Registry Bootstrap
 * & Authoritative Container Bridge
 *
 * Purpose:
 * - Create one authoritative runtime identity registry.
 * - Reuse it if already present.
 * - Prevent duplicate runtime registry creation.
 * - Expose stable access APIs for C7B2B and later bridges.
 * - Bind compatible runtime aliases to the same Map instance.
 * - Do NOT hydrate IndexedDB here.
 *
 * IndexedDB hydration remains the responsibility of C7B2B.
 */

(function (global) {
    "use strict";

    const PHASE =
        "39A-15F6N4B1B3C7B2C";

    const VERSION =
        "39A.15F6N4B1B3C7B2C.0";

    const BUILD =
        "rainguard-v39-runtime-identity-registry-bootstrap-authoritative-container-bridge";

    const BRIDGE_NAME =
        "RainGuard39A15F6N4B1B3C7B2CBridgeV39";

    const RUN_NAME =
        "runRainGuard39A15F6N4B1B3C7B2CRuntimeIdentityRegistryBootstrap";

    const DIAG_NAME =
        "diagnoseRainGuard39A15F6N4B1B3C7B2C";

    const GET_REGISTRY_NAME =
        "getRainGuard39A15F6N4B1B3C7B2CRuntimeIdentityRegistry";

    const IS_COMPLETE_NAME =
        "isRainGuard39A15F6N4B1B3C7B2CComplete";

    /*
     * Authoritative registry name.
     */
    const PRIMARY_REGISTRY_NAME =
        "RainGuardRuntimeIdentityRegistryV39";

    /*
     * These aliases must reference the SAME Map instance.
     *
     * Do not include the persistent IndexedDB-oriented registry
     * as an alias because it may have separate semantics.
     */
    const RUNTIME_ALIASES = Object.freeze([
        "RainGuardRuntimeIdentityRegistryV39",
        "RainGuardIdentityRegistryV39",
        "RainGuardStableTrackIdentityRegistryV39"
    ]);

    /*
     * Upstream / downstream.
     */
    const C7B2A_NAME =
        "RainGuard39A15F6N4B1B3C7B2ABridgeV39";

    const C7B2B_NAME =
        "RainGuard39A15F6N4B1B3C7B2BBridgeV39";

    const C6_NAME =
        "RainGuard39A15F6N4B1B3C6BridgeV39";

    const STATES = Object.freeze({
        IDLE:
            "IDLE",

        DISCOVERING:
            "DISCOVERING_RUNTIME_IDENTITY_REGISTRY",

        REUSING:
            "REUSING_EXISTING_RUNTIME_IDENTITY_REGISTRY",

        CREATING:
            "CREATING_AUTHORITATIVE_RUNTIME_IDENTITY_REGISTRY",

        BINDING:
            "BINDING_RUNTIME_IDENTITY_REGISTRY_ALIASES",

        READY:
            "AUTHORITATIVE_RUNTIME_IDENTITY_REGISTRY_READY",

        FAILED:
            "AUTHORITATIVE_RUNTIME_IDENTITY_REGISTRY_BOOTSTRAP_FAILED"
    });

    let installed = false;
    let running = false;
    let state = STATES.IDLE;

    let registry = null;

    let registryCreated = false;
    let registryReused = false;

    let aliasesBound = 0;

    let selectedRegistryName = null;
    let selectedRegistryType = null;

    let startedAt = null;
    let completedAt = null;

    let lastResult = null;
    let lastError = null;

    /*
     * -------------------------------------------------------
     * Utilities
     * -------------------------------------------------------
     */

    function now() {
        return Date.now();
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

    function getC7B2A() {
        return getBridge(
            C7B2A_NAME
        );
    }

    function getC7B2B() {
        return getBridge(
            C7B2B_NAME
        );
    }

    function getC6() {
        return getBridge(
            C6_NAME
        );
    }

    /*
     * -------------------------------------------------------
     * Registry detection
     * -------------------------------------------------------
     */

    function isUsableRegistry(
        candidate
    ) {
        if (!candidate) {
            return false;
        }

        /*
         * Preferred runtime representation.
         */
        if (
            candidate
            instanceof Map
        ) {
            return true;
        }

        /*
         * Compatibility with registry wrappers.
         */
        if (
            candidate.byIdentity
            instanceof Map
        ) {
            return true;
        }

        /*
         * Avoid treating arbitrary objects as registries
         * merely because they contain many fields.
         */
        if (
            typeof candidate.set
                === "function" &&
            typeof candidate.get
                === "function"
        ) {
            return true;
        }

        return false;
    }

    function registryType(
        candidate
    ) {
        if (!candidate) {
            return null;
        }

        if (
            candidate
            instanceof Map
        ) {
            return "Map";
        }

        if (
            candidate.byIdentity
            instanceof Map
        ) {
            return "MapWrapper";
        }

        return (
            candidate
                .constructor
                ?.name ||
            typeof candidate
        );
    }

    function registrySize(
        candidate
    ) {
        if (!candidate) {
            return 0;
        }

        if (
            candidate
            instanceof Map
        ) {
            return candidate.size;
        }

        if (
            candidate.byIdentity
            instanceof Map
        ) {
            return candidate
                .byIdentity
                .size;
        }

        try {
            if (
                Number.isFinite(
                    Number(
                        candidate.size
                    )
                )
            ) {
                return Number(
                    candidate.size
                );
            }
        } catch (_) {}

        return 0;
    }

    /*
     * -------------------------------------------------------
     * Existing registry discovery
     * -------------------------------------------------------
     */

    function discoverExistingRegistry() {
        state =
            STATES.DISCOVERING;

        /*
         * First check our previously retained reference.
         */
        if (
            isUsableRegistry(
                registry
            )
        ) {
            selectedRegistryName =
                PRIMARY_REGISTRY_NAME;

            selectedRegistryType =
                registryType(
                    registry
                );

            return registry;
        }

        /*
         * Check all supported runtime aliases.
         */
        for (
            const name
            of RUNTIME_ALIASES
        ) {
            let candidate = null;

            try {
                candidate =
                    global[name];
            } catch (_) {
                candidate = null;
            }

            if (
                isUsableRegistry(
                    candidate
                )
            ) {
                selectedRegistryName =
                    name;

                selectedRegistryType =
                    registryType(
                        candidate
                    );

                return candidate;
            }
        }

        return null;
    }

    /*
     * -------------------------------------------------------
     * Alias binding
     * -------------------------------------------------------
     */

    function bindAliases(
        targetRegistry
    ) {
        state =
            STATES.BINDING;

        aliasesBound = 0;

        for (
            const alias
            of RUNTIME_ALIASES
        ) {
            try {
                global[alias] =
                    targetRegistry;

                aliasesBound += 1;

            } catch (error) {
                console.warn(
                    `[RainGuard][${PHASE}] Failed to bind registry alias`,
                    {
                        alias,

                        error:
                            normalizeError(
                                error
                            )
                    }
                );
            }
        }

        return aliasesBound;
    }

    /*
     * -------------------------------------------------------
     * Bootstrap
     * -------------------------------------------------------
     */

    function bootstrapRegistry() {
        /*
         * Existing registry wins.
         */
        const existing =
            discoverExistingRegistry();

        if (existing) {
            state =
                STATES.REUSING;

            registry =
                existing;

            registryCreated =
                false;

            registryReused =
                true;

            selectedRegistryType =
                registryType(
                    registry
                );

            bindAliases(
                registry
            );

            state =
                STATES.READY;

            return registry;
        }

        /*
         * No usable runtime registry found.
         *
         * Create a single authoritative Map.
         */
        state =
            STATES.CREATING;

        registry =
            new Map();

        registryCreated =
            true;

        registryReused =
            false;

        selectedRegistryName =
            PRIMARY_REGISTRY_NAME;

        selectedRegistryType =
            "Map";

        bindAliases(
            registry
        );

        state =
            STATES.READY;

        console.log(
            `[RainGuard][${PHASE}] Authoritative runtime identity registry created`,
            {
                registryName:
                    PRIMARY_REGISTRY_NAME,

                registryType:
                    "Map",

                aliasesBound,

                aliases:
                    [...RUNTIME_ALIASES]
            }
        );

        return registry;
    }

    /*
     * -------------------------------------------------------
     * Public accessor
     * -------------------------------------------------------
     */

    function getRegistry() {
        if (
            isUsableRegistry(
                registry
            )
        ) {
            return registry;
        }

        const existing =
            discoverExistingRegistry();

        if (existing) {
            registry =
                existing;

            bindAliases(
                registry
            );

            state =
                STATES.READY;

            return registry;
        }

        return bootstrapRegistry();
    }

    /*
     * -------------------------------------------------------
     * Main run
     * -------------------------------------------------------
     */

    async function run() {
        if (running) {
            return (
                lastResult || {
                    success: false,

                    phase:
                        PHASE,

                    version:
                        VERSION,

                    status:
                        "ALREADY_RUNNING"
                }
            );
        }

        running = true;

        startedAt =
            now();

        completedAt =
            null;

        lastError =
            null;

        try {
            const runtimeRegistry =
                getRegistry();

            if (
                !isUsableRegistry(
                    runtimeRegistry
                )
            ) {
                throw new Error(
                    "Authoritative runtime identity registry bootstrap returned unusable registry."
                );
            }

            /*
             * Ensure all aliases still point to exactly
             * the same instance.
             */
            bindAliases(
                runtimeRegistry
            );

            const aliasIntegrity =
                RUNTIME_ALIASES
                    .every(
                        alias =>
                            global[alias] ===
                            runtimeRegistry
                    );

            if (!aliasIntegrity) {
                throw new Error(
                    "Runtime registry alias integrity verification failed."
                );
            }

            state =
                STATES.READY;

            completedAt =
                now();

            lastResult = {
                success:
                    true,

                phase:
                    PHASE,

                version:
                    VERSION,

                build:
                    BUILD,

                status:
                    "AUTHORITATIVE_RUNTIME_IDENTITY_REGISTRY_READY",

                state,

                registryCreated,
                registryReused,

                selectedRegistryName,
                selectedRegistryType,

                registrySize:
                    registrySize(
                        runtimeRegistry
                    ),

                aliasesBound,

                aliasIntegrity,

                aliases:
                    [...RUNTIME_ALIASES],

                c6Available:
                    Boolean(
                        getC6()
                    ),

                c7b2aAvailable:
                    Boolean(
                        getC7B2A()
                    ),

                c7b2bAvailable:
                    Boolean(
                        getC7B2B()
                    ),

                startedAt,
                completedAt,

                durationMs:
                    completedAt -
                    startedAt
            };

            console.log(
                `[RainGuard][${PHASE}] Run result:`,
                lastResult
            );

            return lastResult;

        } catch (error) {
            state =
                STATES.FAILED;

            completedAt =
                now();

            lastError =
                normalizeError(
                    error
                );

            lastResult = {
                success:
                    false,

                phase:
                    PHASE,

                version:
                    VERSION,

                build:
                    BUILD,

                status:
                    "AUTHORITATIVE_RUNTIME_IDENTITY_REGISTRY_BOOTSTRAP_FAILED",

                state,

                registryCreated,
                registryReused,

                selectedRegistryName,
                selectedRegistryType,

                registrySize:
                    registrySize(
                        registry
                    ),

                aliasesBound,

                error:
                    lastError,

                startedAt,
                completedAt,

                durationMs:
                    completedAt -
                    startedAt
            };

            console.error(
                `[RainGuard][${PHASE}] Run failed:`,
                lastResult
            );

            return lastResult;

        } finally {
            running = false;
        }
    }

    /*
     * -------------------------------------------------------
     * Diagnostics
     * -------------------------------------------------------
     */

    async function diagnose() {
        const runtimeRegistry =
            discoverExistingRegistry();

        let aliasIntegrity =
            false;

        if (runtimeRegistry) {
            try {
                aliasIntegrity =
                    RUNTIME_ALIASES
                        .every(
                            alias =>
                                global[alias] ===
                                runtimeRegistry
                        );
            } catch (_) {
                aliasIntegrity =
                    false;
            }
        }

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
            state,

            primaryRegistryName:
                PRIMARY_REGISTRY_NAME,

            selectedRegistryName,
            selectedRegistryType,

            runtimeRegistryAvailable:
                Boolean(
                    runtimeRegistry
                ),

            runtimeRegistryType:
                registryType(
                    runtimeRegistry
                ),

            runtimeRegistrySize:
                registrySize(
                    runtimeRegistry
                ),

            registryCreated,
            registryReused,

            aliasesBound,

            aliases:
                [...RUNTIME_ALIASES],

            aliasIntegrity,

            authoritative:
                Boolean(
                    runtimeRegistry &&
                    global[
                        PRIMARY_REGISTRY_NAME
                    ] ===
                    runtimeRegistry
                ),

            c6Available:
                Boolean(
                    getC6()
                ),

            c7b2aAvailable:
                Boolean(
                    getC7B2A()
                ),

            c7b2bAvailable:
                Boolean(
                    getC7B2B()
                ),

            lastResult,
            lastError
        };

        console.log(
            `[RainGuard][${PHASE}] Diagnostics:`,
            result
        );

        return result;
    }

    /*
     * -------------------------------------------------------
     * Readiness
     * -------------------------------------------------------
     */

    function isComplete() {
        const runtimeRegistry =
            discoverExistingRegistry();

        if (!runtimeRegistry) {
            return false;
        }

        const primaryBound =
            global[
                PRIMARY_REGISTRY_NAME
            ] ===
            runtimeRegistry;

        const allAliasesBound =
            RUNTIME_ALIASES
                .every(
                    alias =>
                        global[alias] ===
                        runtimeRegistry
                );

        return Boolean(
            primaryBound &&
            allAliasesBound
        );
    }

    /*
     * -------------------------------------------------------
     * Installation
     * -------------------------------------------------------
     */

    function install() {
        if (installed) {
            return bridge;
        }

        installed = true;

        /*
         * Bootstrap immediately at load.
         *
         * This is intentionally lightweight:
         * it creates/reuses an empty Map only.
         *
         * No IndexedDB scan occurs here.
         */
        try {
            bootstrapRegistry();
        } catch (error) {
            lastError =
                normalizeError(
                    error
                );

            state =
                STATES.FAILED;

            console.error(
                `[RainGuard][${PHASE}] Install bootstrap failed`,
                lastError
            );
        }

        console.log(
            `[RainGuard][${PHASE}] Installed`,
            {
                version:
                    VERSION,

                build:
                    BUILD,

                primaryRegistryName:
                    PRIMARY_REGISTRY_NAME,

                aliases:
                    [...RUNTIME_ALIASES],

                runtimeRegistryBootstrap:
                    true,

                indexedDBHydration:
                    false,

                hydrationDelegatedTo:
                    "C7B2B"
            }
        );

        return bridge;
    }

    /*
     * -------------------------------------------------------
     * Public bridge
     * -------------------------------------------------------
     */

    const bridge = {
        phase:
            PHASE,

        version:
            VERSION,

        build:
            BUILD,

        states:
            STATES,

        primaryRegistryName:
            PRIMARY_REGISTRY_NAME,

        aliases:
            [...RUNTIME_ALIASES],

        install,
        run,
        diagnose,
        getRegistry,
        isComplete,
        bootstrapRegistry,

        get installed() {
            return installed;
        },

        get running() {
            return running;
        },

        get state() {
            return state;
        },

        get registryCreated() {
            return registryCreated;
        },

        get registryReused() {
            return registryReused;
        },

        get aliasesBound() {
            return aliasesBound;
        },

        get selectedRegistryName() {
            return selectedRegistryName;
        },

        get selectedRegistryType() {
            return selectedRegistryType;
        },

        get runtimeRegistry() {
            return registry;
        },

        get runtimeRegistrySize() {
            return registrySize(
                registry
            );
        },

        get lastResult() {
            return lastResult;
        },

        get lastError() {
            return lastError;
        }
    };

    /*
     * -------------------------------------------------------
     * Global exposure
     * -------------------------------------------------------
     */

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

    global[
        GET_REGISTRY_NAME
    ] =
        getRegistry;

    global[
        IS_COMPLETE_NAME
    ] =
        isComplete;

    install();

})(window);
