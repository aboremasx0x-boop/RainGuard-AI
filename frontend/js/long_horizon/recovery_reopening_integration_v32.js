/* ==========================================================================
   RainGuard AI
   Long Horizon Forecast Engine V32

   Recovery Reopening Integration V32

   PART 1
   Engine Discovery + Dependency Resolution +
   Integration State + Configuration
   ========================================================================== */

(function initializeRecoveryReopeningIntegrationV32(global) {
    "use strict";

    /* ======================================================================
       SECTION 1
       MODULE METADATA
       ====================================================================== */

    const VERSION =
        "32.1.0";

    const BUILD =
        "V32";

    const MODULE_NAME =
        "RecoveryReopeningIntegrationV32";

    /* ======================================================================
       SECTION 2
       REQUIRED DEPENDENCIES
       ====================================================================== */

    const RecoveryReopeningClass =
        global.RecoveryReopeningV32;

    const RecoveryReopeningConstants =
        global.RecoveryReopeningV32Constants;

    const RecoveryReopeningUtils =
        global.RecoveryReopeningV32Utils;

    const RecoveryReopeningPart2 =
        global.RecoveryReopeningV32Part2;

    const RecoveryReopeningPart3 =
        global.RecoveryReopeningV32Part3;

    const RecoveryReopeningPart4 =
        global.RecoveryReopeningV32Part4;

    const RecoveryReopeningPart5 =
        global.RecoveryReopeningV32Part5;

    if (
        typeof RecoveryReopeningClass !== "function" ||
        !RecoveryReopeningConstants ||
        !RecoveryReopeningUtils ||
        !RecoveryReopeningPart2 ||
        !RecoveryReopeningPart3 ||
        !RecoveryReopeningPart4 ||
        !RecoveryReopeningPart5
    ) {
        throw new Error(
            "RecoveryReopeningIntegrationV32 requires the complete RecoveryReopeningV32 module."
        );
    }

    const {
        REOPENING_STATUS,
        REOPENING_STAGE,
        REOPENING_RESULT,
        REOPENING_EVENT
    } = RecoveryReopeningConstants;

    const {
        now,
        deepClone,
        safeArray,
        safeObject,
        createId
    } = RecoveryReopeningUtils;

    const {
        toFiniteNumber,
        clamp,
        normalizeError
    } = RecoveryReopeningPart2;

    const {
        COMPONENT_TYPE,
        COMPONENT_STATUS,
        STAGE_EXECUTION_STATUS,
        EXECUTION_MODE,
        ROLLBACK_REASON
    } = RecoveryReopeningPart3;

    const {
        INTEGRATION_STATUS,
        MONITORING_DECISION,
        TRIGGER_TYPE,
        SNAPSHOT_TYPE,
        LIFECYCLE_PHASE
    } = RecoveryReopeningPart4;

    const {
        PERSISTENCE_STATUS,
        DIAGNOSTIC_LEVEL
    } = RecoveryReopeningPart5;

    /* ======================================================================
       SECTION 3
       INTEGRATION STATUS
       ====================================================================== */

    const ADAPTER_STATUS =
        Object.freeze({

            IDLE:
                "idle",

            DISCOVERING:
                "discovering",

            READY:
                "ready",

            PARTIAL:
                "partial",

            CONNECTING:
                "connecting",

            CONNECTED:
                "connected",

            RUNNING:
                "running",

            DEGRADED:
                "degraded",

            FAILED:
                "failed",

            DESTROYED:
                "destroyed"

        });

    const DEPENDENCY_STATUS =
        Object.freeze({

            UNKNOWN:
                "unknown",

            AVAILABLE:
                "available",

            UNAVAILABLE:
                "unavailable",

            PARTIAL:
                "partial",

            INVALID:
                "invalid"
        });

    const ENGINE_CATEGORY =
        Object.freeze({

            RECOVERY:
                "recovery",

            CLOSURE:
                "closure",

            MONITORING:
                "monitoring",

            FORECAST:
                "forecast",

            ARRIVAL:
                "arrival",

            SOURCE:
                "source",

            STORAGE:
                "storage",

            AI:
                "ai",

            DASHBOARD:
                "dashboard",

            RADAR:
                "radar",

            LIGHTNING:
                "lightning",

            STORM_TRACKING:
                "storm_tracking",

            PATH_PREDICTION:
                "path_prediction",

            VERIFICATION:
                "verification",

            NOTIFICATION:
                "notification",

            NETWORK:
                "network",

            CUSTOM:
                "custom"
        });

    const DEPENDENCY_PRIORITY =
        Object.freeze({

            OPTIONAL:
                10,

            NORMAL:
                20,

            HIGH:
                30,

            CRITICAL:
                40
        });

    /* ======================================================================
       SECTION 4
       DEFAULT CONFIGURATION
       ====================================================================== */

    const DEFAULT_CONFIGURATION =
        Object.freeze({

            enabled:
                true,

            autoDiscover:
                true,

            autoCreateInstance:
                true,

            autoConnect:
                false,

            autoStart:
                false,

            autoRegisterComponents:
                true,

            autoAttachEvents:
                true,

            autoRestoreState:
                false,

            autoSaveState:
                true,

            exposeGlobalInstance:
                true,

            strictRequiredDependencies:
                true,

            allowPartialDependencies:
                true,

            discoveryTimeoutMs:
                30000,

            connectionTimeoutMs:
                30000,

            startupTimeoutMs:
                120000,

            healthCheckTimeoutMs:
                15000,

            retryCount:
                2,

            retryDelayMs:
                2000,

            namespace:
                "rainguard.recovery.reopening.integration.v32",

            instanceGlobalName:
                "RecoveryReopeningV32Instance",

            integrationGlobalName:
                "RecoveryReopeningIntegrationV32Instance",

            persistenceKey:
                "rainguard_recovery_reopening_integration_v32",

            logEnabled:
                true,

            debug:
                false
        });

    /* ======================================================================
       SECTION 5
       ENGINE DISCOVERY MAP
       ====================================================================== */

    const ENGINE_DISCOVERY_MAP =
        Object.freeze({

            recoveryCore: {

                category:
                    ENGINE_CATEGORY.RECOVERY,

                required:
                    true,

                priority:
                    DEPENDENCY_PRIORITY.CRITICAL,

                globalNames: [
                    "LongHorizonRecoveryCoreV32Instance",
                    "RainArrivalRecoveryCoreV32Instance",
                    "RecoveryCoreV32Instance",
                    "recoveryCoreV32",
                    "longHorizonRecoveryCoreV32"
                ],

                methods: [
                    "startRecovery",
                    "executeRecovery",
                    "recover",
                    "getState",
                    "getStatus"
                ]
            },

            closureEngine: {

                category:
                    ENGINE_CATEGORY.CLOSURE,

                required:
                    false,

                priority:
                    DEPENDENCY_PRIORITY.HIGH,

                globalNames: [
                    "RecoveryClosureV32Instance",
                    "RecoveryClosureEngineV32Instance",
                    "LongHorizonRecoveryClosureV32Instance",
                    "recoveryClosureV32"
                ],

                methods: [
                    "startClosure",
                    "close",
                    "executeClosure",
                    "getState",
                    "getStatus"
                ]
            },

            monitoringEngine: {

                category:
                    ENGINE_CATEGORY.MONITORING,

                required:
                    false,

                priority:
                    DEPENDENCY_PRIORITY.HIGH,

                globalNames: [
                    "PostRecoveryMonitoringV32Instance",
                    "RecoveryMonitoringV32Instance",
                    "LongHorizonMonitoringV32Instance",
                    "monitoringEngineV32"
                ],

                methods: [
                    "start",
                    "monitor",
                    "evaluateStability",
                    "getState",
                    "getStatus"
                ]
            },

            forecastEngine: {

                category:
                    ENGINE_CATEGORY.FORECAST,

                required:
                    true,

                priority:
                    DEPENDENCY_PRIORITY.CRITICAL,

                globalNames: [
                    "LongHorizonForecastEngineV32Instance",
                    "LongHorizonForecastV32Instance",
                    "RainForecastEngineV32Instance",
                    "ForecastEngineV32Instance",
                    "longHorizonForecastEngineV32"
                ],

                methods: [
                    "start",
                    "initialize",
                    "run",
                    "forecast",
                    "getState",
                    "getStatus"
                ]
            },

            arrivalEngine: {

                category:
                    ENGINE_CATEGORY.ARRIVAL,

                required:
                    true,

                priority:
                    DEPENDENCY_PRIORITY.CRITICAL,

                globalNames: [
                    "RainArrivalPredictionEngineV32Instance",
                    "RainArrivalEngineV32Instance",
                    "ArrivalPredictionEngineV32Instance",
                    "rainArrivalPredictionEngineV32"
                ],

                methods: [
                    "start",
                    "initialize",
                    "run",
                    "predict",
                    "getState",
                    "getStatus"
                ]
            },

            sourceEngine: {

                category:
                    ENGINE_CATEGORY.SOURCE,

                required:
                    true,

                priority:
                    DEPENDENCY_PRIORITY.CRITICAL,

                globalNames: [
                    "SourceAdapterV32Instance",
                    "SourceEngineV32Instance",
                    "DataSourceEngineV32Instance",
                    "sourceAdapterV32",
                    "sourceEngineV32"
                ],

                methods: [
                    "start",
                    "initialize",
                    "connect",
                    "refresh",
                    "getState",
                    "getStatus"
                ]
            },

            storageEngine: {

                category:
                    ENGINE_CATEGORY.STORAGE,

                required:
                    true,

                priority:
                    DEPENDENCY_PRIORITY.CRITICAL,

                globalNames: [
                    "StorageOptimizerV32Instance",
                    "StorageOptimizerV31Instance",
                    "LongHorizonStorageV32Instance",
                    "RainGuardStorageV32Instance",
                    "storageOptimizerV32",
                    "storageOptimizerV31"
                ],

                methods: [
                    "initialize",
                    "restore",
                    "save",
                    "load",
                    "getState",
                    "getStatus"
                ]
            },

            aiEngine: {

                category:
                    ENGINE_CATEGORY.AI,

                required:
                    false,

                priority:
                    DEPENDENCY_PRIORITY.NORMAL,

                globalNames: [
                    "NationalAIEngineV32Instance",
                    "LocalAIAdapterV32Instance",
                    "AIBrainV32Instance",
                    "AIEngineV32Instance",
                    "aiEngineV32"
                ],

                methods: [
                    "start",
                    "initialize",
                    "analyze",
                    "predict",
                    "getState",
                    "getStatus"
                ]
            },

            dashboardEngine: {

                category:
                    ENGINE_CATEGORY.DASHBOARD,

                required:
                    false,

                priority:
                    DEPENDENCY_PRIORITY.NORMAL,

                globalNames: [
                    "NationalAIDashboardV32Instance",
                    "NationalAIDashboardV30Instance",
                    "RainGuardDashboardV32Instance",
                    "dashboardV32"
                ],

                methods: [
                    "start",
                    "render",
                    "refresh",
                    "update",
                    "getState",
                    "getStatus"
                ]
            },

            radarEngine: {

                category:
                    ENGINE_CATEGORY.RADAR,

                required:
                    false,

                priority:
                    DEPENDENCY_PRIORITY.HIGH,

                globalNames: [
                    "RainViewerAdapterV32Instance",
                    "RainViewerAdapterV31Instance",
                    "RadarEngineV32Instance",
                    "rainViewerAdapterV32",
                    "rainViewerAdapterV31"
                ],

                methods: [
                    "start",
                    "initialize",
                    "refresh",
                    "fetchRadar",
                    "getState",
                    "getStatus"
                ]
            },

            lightningEngine: {

                category:
                    ENGINE_CATEGORY.LIGHTNING,

                required:
                    false,

                priority:
                    DEPENDENCY_PRIORITY.NORMAL,

                globalNames: [
                    "LightningAdapterV32Instance",
                    "LightningAdapterV31Instance",
                    "LightningEngineV32Instance",
                    "lightningAdapterV32",
                    "lightningAdapterV31"
                ],

                methods: [
                    "start",
                    "initialize",
                    "refresh",
                    "fetchLightning",
                    "getState",
                    "getStatus"
                ]
            },

            stormTrackingEngine: {

                category:
                    ENGINE_CATEGORY.STORM_TRACKING,

                required:
                    false,

                priority:
                    DEPENDENCY_PRIORITY.HIGH,

                globalNames: [
                    "StormCellTrackingEngineV32Instance",
                    "StormCellTrackingEngineV31Instance",
                    "StormTrackingEngineV32Instance",
                    "stormCellTrackingEngineV32",
                    "stormCellTrackingEngineV31"
                ],

                methods: [
                    "start",
                    "initialize",
                    "track",
                    "update",
                    "getState",
                    "getStatus"
                ]
            },

            pathPredictionEngine: {

                category:
                    ENGINE_CATEGORY.PATH_PREDICTION,

                required:
                    false,

                priority:
                    DEPENDENCY_PRIORITY.HIGH,

                globalNames: [
                    "StormPathPredictionEngineV32Instance",
                    "PathPredictionEngineV32Instance",
                    "StormPathEngineV32Instance",
                    "stormPathPredictionEngineV32"
                ],

                methods: [
                    "start",
                    "initialize",
                    "predict",
                    "update",
                    "getState",
                    "getStatus"
                ]
            },

            verificationEngine: {

                category:
                    ENGINE_CATEGORY.VERIFICATION,

                required:
                    false,

                priority:
                    DEPENDENCY_PRIORITY.HIGH,

                globalNames: [
                    "VerificationEngineV32Instance",
                    "VerificationEngineV30Instance",
                    "RainVerificationEngineV32Instance",
                    "verificationEngineV32",
                    "verificationEngineV30"
                ],

                methods: [
                    "start",
                    "verify",
                    "evaluate",
                    "getState",
                    "getStatus"
                ]
            },

            notificationEngine: {

                category:
                    ENGINE_CATEGORY.NOTIFICATION,

                required:
                    false,

                priority:
                    DEPENDENCY_PRIORITY.NORMAL,

                globalNames: [
                    "NotificationEngineV32Instance",
                    "RainAlertNotificationV32Instance",
                    "NationalNotificationEngineV32Instance",
                    "notificationEngineV32"
                ],

                methods: [
                    "start",
                    "send",
                    "notify",
                    "getState",
                    "getStatus"
                ]
            },

            networkEngine: {

                category:
                    ENGINE_CATEGORY.NETWORK,

                required:
                    false,

                priority:
                    DEPENDENCY_PRIORITY.NORMAL,

                globalNames: [
                    "NetworkMonitorV32Instance",
                    "ConnectivityEngineV32Instance",
                    "OfflineEmergencyModeV32Instance",
                    "networkMonitorV32"
                ],

                methods: [
                    "start",
                    "check",
                    "isOnline",
                    "getState",
                    "getStatus"
                ]
            }
        });

    /* ======================================================================
       SECTION 6
       HELPER FUNCTIONS
       ====================================================================== */

    function isObjectLike(
        value
    ) {
        return (
            value !==
            null &&
            (
                typeof value ===
                "object" ||
                typeof value ===
                "function"
            )
        );
    }

    function hasAnyMethod(
        target,
        methods
    ) {
        if (
            !isObjectLike(target)
        ) {
            return false;
        }

        return safeArray(methods)
            .some(
                (methodName) => {
                    return (
                        typeof target[
                            methodName
                        ] ===
                        "function"
                    );
                }
            );
    }

    function resolveGlobalByNames(
    names
) {

    const candidateNames =
        safeArray(
            names
        );

    /*
     * المرحلة الأولى:
     * البحث عن نسخة تشغيل فعلية Object.
     * لا نقبل Class أو Constructor من نوع function.
     */
    for (
        const name of
        candidateNames
    ) {

        const candidate =
            global[name];

        if (
            candidate !==
                null &&
            typeof candidate ===
                "object"
        ) {
            return {
                name,

                value:
                    candidate
            };
        }
    }

    /*
     * لم يتم العثور على Instance فعلي.
     * نتجاهل أي function حتى لا يتم تسجيل
     * Class أو Constructor على أنه محرك جاهز.
     */
    return {
        name:
            null,

        value:
            null
    };

}

    function normalizeDependencyRecord(
        key,
        definition,
        resolved
    ) {
        const target =
            resolved?.value ||
            null;

        const available =
            isObjectLike(
                target
            );

        const valid =
            available &&
            (
                safeArray(
                    definition.methods
                ).length ===
                0 ||
                hasAnyMethod(
                    target,
                    definition.methods
                )
            );

        let status =
            DEPENDENCY_STATUS.UNAVAILABLE;

        if (
            available &&
            valid
        ) {
            status =
                DEPENDENCY_STATUS.AVAILABLE;
        } else if (
            available
        ) {
            status =
                DEPENDENCY_STATUS.PARTIAL;
        }

        return {

            id:
                createId(
                    "dependency"
                ),

            key,

            category:
                definition.category ||
                ENGINE_CATEGORY.CUSTOM,

            required:
                definition.required ===
                true,

            priority:
                toFiniteNumber(
                    definition.priority,
                    DEPENDENCY_PRIORITY.NORMAL
                ),

            status,

            available,

            valid,

            globalName:
                resolved?.name ||
                null,

            candidateNames:
                safeArray(
                    definition.globalNames
                ),

            expectedMethods:
                safeArray(
                    definition.methods
                ),

            discoveredAt:
                now(),

            target
        };
    }

    function sanitizeDependencyRecord(
        record
    ) {
        return {

            id:
                record.id,

            key:
                record.key,

            category:
                record.category,

            required:
                record.required,

            priority:
                record.priority,

            status:
                record.status,

            available:
                record.available,

            valid:
                record.valid,

            globalName:
                record.globalName,

            candidateNames:
                deepClone(
                    record.candidateNames
                ),

            expectedMethods:
                deepClone(
                    record.expectedMethods
                ),

            discoveredAt:
                record.discoveredAt
        };
    }

    function calculateDependencyScore(
        records
    ) {
        const dependencies =
            safeArray(records);

        if (
            dependencies.length ===
            0
        ) {
            return 0;
        }

        let totalWeight =
            0;

        let achievedWeight =
            0;

        dependencies.forEach(
            (record) => {

                const weight =
                    Math.max(
                        1,
                        toFiniteNumber(
                            record.priority,
                            DEPENDENCY_PRIORITY.NORMAL
                        )
                    );

                totalWeight +=
                    weight;

                if (
                    record.status ===
                    DEPENDENCY_STATUS.AVAILABLE
                ) {
                    achievedWeight +=
                        weight;
                } else if (
                    record.status ===
                    DEPENDENCY_STATUS.PARTIAL
                ) {
                    achievedWeight +=
                        weight *
                        0.5;
                }

            }
        );

        return totalWeight >
            0
            ? clamp(
                achievedWeight /
                totalWeight
            )
            : 0;
    }

    /* ======================================================================
       SECTION 7
       EVENT EMITTER
       ====================================================================== */

    class IntegrationEmitter {

        constructor() {
            this.listeners =
                new Map();
        }

        on(
            event,
            listener
        ) {
            if (
                typeof listener !==
                "function"
            ) {
                return () => {};
            }

            if (
                !this.listeners.has(
                    event
                )
            ) {
                this.listeners.set(
                    event,
                    new Set()
                );
            }

            this.listeners
                .get(
                    event
                )
                .add(
                    listener
                );

            return () => {
                this.off(
                    event,
                    listener
                );
            };
        }

        off(
            event,
            listener
        ) {
            const group =
                this.listeners.get(
                    event
                );

            if (!group) {
                return false;
            }

            const removed =
                group.delete(
                    listener
                );

            if (
                group.size ===
                0
            ) {
                this.listeners.delete(
                    event
                );
            }

            return removed;
        }

        emit(
            event,
            payload
        ) {
            const listeners =
                this.listeners.get(
                    event
                );

            if (!listeners) {
                return 0;
            }

            let invoked =
                0;

            for (
                const listener of
                Array.from(
                    listeners
                )
            ) {
                try {
                    listener(
                        payload
                    );

                    invoked +=
                        1;
                } catch (_) {
                    /* ignored */
                }
            }

            return invoked;
        }

        clear() {
            this.listeners.clear();
        }
    }

    /* ======================================================================
       SECTION 8
       MAIN INTEGRATION CLASS
       ====================================================================== */

    class RecoveryReopeningIntegrationV32 {

        constructor(
            options = {}
        ) {
            const safeOptions =
                safeObject(options);

            this.id =
                safeOptions.id ||
                createId(
                    "reopening_integration_adapter"
                );

            this.version =
                VERSION;

            this.build =
                BUILD;

            this.moduleName =
                MODULE_NAME;

            this.configuration = {
                ...DEFAULT_CONFIGURATION,
                ...safeOptions
            };

            this.events =
                new IntegrationEmitter();

            this.reopening =
                safeOptions.reopening ||
                null;

            this.destroyed =
                false;

            this.state =
                this.createInitialState();

            if (
                this.configuration
                    .autoDiscover
            ) {
                this.discoverDependencies();
            }
        }

        /* ==================================================================
           SECTION 9
           INITIAL STATE
           ================================================================== */

        createInitialState() {
            return {

                id:
                    this.id,

                version:
                    this.version,

                build:
                    this.build,

                status:
                    ADAPTER_STATUS.IDLE,

                enabled:
                    this.configuration.enabled !==
                    false,

                createdAt:
                    now(),

                discoveredAt:
                    null,

                connectedAt:
                    null,

                startedAt:
                    null,

                completedAt:
                    null,

                durationMs:
                    0,

                dependencyScore:
                    0,

                dependencyStatus:
                    DEPENDENCY_STATUS.UNKNOWN,

                dependencies:
                    {},

                requiredMissing:
                    [],

                optionalMissing:
                    [],

                invalidDependencies:
                    [],

                discoveryCount:
                    0,

                connectionCount:
                    0,

                startupCount:
                    0,

                retryCount:
                    0,

                errorCount:
                    0,

                lastError:
                    null,

                errors:
                    [],

                warnings:
                    [],

                metadata: {}
            };
        }

        /* ==================================================================
           SECTION 10
           EVENT METHODS
           ================================================================== */

        on(
            event,
            listener
        ) {
            return this.events.on(
                event,
                listener
            );
        }

        off(
            event,
            listener
        ) {
            return this.events.off(
                event,
                listener
            );
        }

        emit(
            event,
            payload = {}
        ) {
            return this.events.emit(
                event,
                {
                    integrationId:
                        this.id,

                    timestamp:
                        now(),

                    ...safeObject(
                        payload
                    )
                }
            );
        }

        /* ==================================================================
           SECTION 11
           LOGGING
           ================================================================== */

        log(
            level,
            message,
            details = null
        ) {
            if (
                this.configuration
                    .logEnabled !==
                true
            ) {
                return;
            }

            const method =
                typeof console?.[level] ===
                "function"
                    ? level
                    : "log";

            console[method](
                `[${MODULE_NAME}] ${message}`,
                details ||
                ""
            );
        }

        /* ==================================================================
           SECTION 12
           CONFIGURATION
           ================================================================== */

        configure(
            options = {}
        ) {
            const safeOptions =
                safeObject(options);

            this.configuration = {
                ...this.configuration,
                ...safeOptions,

                discoveryTimeoutMs:
                    Math.max(
                        1000,
                        toFiniteNumber(
                            safeOptions
                                .discoveryTimeoutMs,
                            this.configuration
                                .discoveryTimeoutMs
                        )
                    ),

                connectionTimeoutMs:
                    Math.max(
                        1000,
                        toFiniteNumber(
                            safeOptions
                                .connectionTimeoutMs,
                            this.configuration
                                .connectionTimeoutMs
                        )
                    ),

                startupTimeoutMs:
                    Math.max(
                        1000,
                        toFiniteNumber(
                            safeOptions
                                .startupTimeoutMs,
                            this.configuration
                                .startupTimeoutMs
                        )
                    ),

                healthCheckTimeoutMs:
                    Math.max(
                        1000,
                        toFiniteNumber(
                            safeOptions
                                .healthCheckTimeoutMs,
                            this.configuration
                                .healthCheckTimeoutMs
                        )
                    ),

                retryCount:
                    Math.max(
                        0,
                        Math.round(
                            toFiniteNumber(
                                safeOptions
                                    .retryCount,
                                this.configuration
                                    .retryCount
                            )
                        )
                    ),

                retryDelayMs:
                    Math.max(
                        0,
                        toFiniteNumber(
                            safeOptions
                                .retryDelayMs,
                            this.configuration
                                .retryDelayMs
                        )
                    )
            };

            this.state.enabled =
                this.configuration
                    .enabled !==
                false;

            return deepClone(
                this.configuration
            );
        }

        /* ==================================================================
           SECTION 13
           DEPENDENCY DISCOVERY
           ================================================================== */

        discoverDependencies() {
            if (
                this.destroyed
            ) {
                throw new Error(
                    "Recovery reopening integration is destroyed."
                );
            }

            this.state.status =
                ADAPTER_STATUS.DISCOVERING;

            this.state.discoveryCount +=
                1;

            this.state.requiredMissing =
                [];

            this.state.optionalMissing =
                [];

            this.state.invalidDependencies =
                [];

            const records = {};

            Object.entries(
                ENGINE_DISCOVERY_MAP
            ).forEach(
                ([
                    key,
                    definition
                ]) => {

                    const resolved =
                        resolveGlobalByNames(
                            definition.globalNames
                        );

                    const record =
                        normalizeDependencyRecord(
                            key,
                            definition,
                            resolved
                        );

                    records[key] =
                        record;

                    if (
                        record.required &&
                        record.status !==
                        DEPENDENCY_STATUS.AVAILABLE
                    ) {
                        this.state
                            .requiredMissing
                            .push(
                                key
                            );
                    } else if (
                        !record.required &&
                        record.status ===
                        DEPENDENCY_STATUS.UNAVAILABLE
                    ) {
                        this.state
                            .optionalMissing
                            .push(
                                key
                            );
                    }

                    if (
                        record.status ===
                        DEPENDENCY_STATUS.PARTIAL ||
                        record.status ===
                        DEPENDENCY_STATUS.INVALID
                    ) {
                        this.state
                            .invalidDependencies
                            .push(
                                key
                            );
                    }

                }
            );

            this.state.dependencies =
                records;

            this.state.dependencyScore =
                calculateDependencyScore(
                    Object.values(
                        records
                    )
                );

            this.state.discoveredAt =
                now();

            if (
                this.state.requiredMissing
                    .length ===
                0 &&
                this.state.invalidDependencies
                    .length ===
                0
            ) {
                this.state.status =
                    ADAPTER_STATUS.READY;

                this.state.dependencyStatus =
                    DEPENDENCY_STATUS.AVAILABLE;
            } else if (
                this.configuration
                    .allowPartialDependencies &&
                this.state.dependencyScore >
                0
            ) {
                this.state.status =
                    ADAPTER_STATUS.PARTIAL;

                this.state.dependencyStatus =
                    DEPENDENCY_STATUS.PARTIAL;
            } else {
                this.state.status =
                    ADAPTER_STATUS.FAILED;

                this.state.dependencyStatus =
                    DEPENDENCY_STATUS.UNAVAILABLE;
            }

            const summary =
                this.getDependencySummary();

            this.emit(
                "dependencies_discovered",
                {
                    summary
                }
            );

            this.log(
                this.state.status ===
                    ADAPTER_STATUS.FAILED
                    ? "error"
                    : "info",
                "Dependency discovery completed.",
                summary
            );

            return summary;
        }

        /* ==================================================================
           SECTION 14
           GET DEPENDENCY
           ================================================================== */

        getDependency(
            key
        ) {
            return (
                this.state.dependencies[
                    key
                ]?.target ||
                null
            );
        }

        hasDependency(
            key
        ) {
            return (
                this.state.dependencies[
                    key
                ]?.status ===
                DEPENDENCY_STATUS.AVAILABLE
            );
        }

        /* ==================================================================
           SECTION 15
           SET DEPENDENCY MANUALLY
           ================================================================== */

        setDependency(
            key,
            target,
            options = {}
        ) {
            const definition =
                ENGINE_DISCOVERY_MAP[
                    key
                ] ||
                {
                    category:
                        ENGINE_CATEGORY.CUSTOM,

                    required:
                        options.required ===
                        true,

                    priority:
                        options.priority ||
                        DEPENDENCY_PRIORITY.NORMAL,

                    globalNames:
                        [],

                    methods:
                        safeArray(
                            options.methods
                        )
                };

            const record =
                normalizeDependencyRecord(
                    key,
                    definition,
                    {
                        name:
                            options.globalName ||
                            "manual",

                        value:
                            target
                    }
                );

            this.state.dependencies[
                key
            ] =
                record;

            return sanitizeDependencyRecord(
                record
            );
        }

        /* ==================================================================
           SECTION 16
           DEPENDENCY SUMMARY
           ================================================================== */

        getDependencySummary() {
            const records =
                Object.values(
                    this.state.dependencies
                );

            return {

                status:
                    this.state
                        .dependencyStatus,

                adapterStatus:
                    this.state.status,

                score:
                    this.state
                        .dependencyScore,

                scorePercentage:
                    Math.round(
                        this.state
                            .dependencyScore *
                        10000
                    ) /
                    100,

                total:
                    records.length,

                available:
                    records.filter(
                        (record) => {
                            return (
                                record.status ===
                                DEPENDENCY_STATUS.AVAILABLE
                            );
                        }
                    ).length,

                partial:
                    records.filter(
                        (record) => {
                            return (
                                record.status ===
                                DEPENDENCY_STATUS.PARTIAL
                            );
                        }
                    ).length,

                unavailable:
                    records.filter(
                        (record) => {
                            return (
                                record.status ===
                                DEPENDENCY_STATUS.UNAVAILABLE
                            );
                        }
                    ).length,

                requiredMissing:
                    deepClone(
                        this.state
                            .requiredMissing
                    ),

                optionalMissing:
                    deepClone(
                        this.state
                            .optionalMissing
                    ),

                invalidDependencies:
                    deepClone(
                        this.state
                            .invalidDependencies
                    ),

                dependencies:
                    records.map(
                        sanitizeDependencyRecord
                    ),

                discoveredAt:
                    this.state
                        .discoveredAt
            };
        }

        /* ==================================================================
           SECTION 17
           REQUIRED DEPENDENCY CHECK
           ================================================================== */

        canConnect() {
            if (
                this.configuration
                    .strictRequiredDependencies
            ) {
                return (
                    this.state
                        .requiredMissing
                        .length ===
                    0
                );
            }

            return (
                this.state
                    .dependencyScore >
                0
            );
        }

        /* ==================================================================
           SECTION 18
           PUBLIC STATE
           ================================================================== */

        getState() {
            return deepClone({

                id:
                    this.id,

                version:
                    this.version,

                build:
                    this.build,

                moduleName:
                    this.moduleName,

                status:
                    this.state.status,

                enabled:
                    this.state.enabled,

                dependencyStatus:
                    this.state
                        .dependencyStatus,

                dependencyScore:
                    this.state
                        .dependencyScore,

                dependencyScorePercentage:
                    Math.round(
                        this.state
                            .dependencyScore *
                        10000
                    ) /
                    100,

                discoveredAt:
                    this.state
                        .discoveredAt,

                connectedAt:
                    this.state
                        .connectedAt,

                startedAt:
                    this.state
                        .startedAt,

                completedAt:
                    this.state
                        .completedAt,

                discoveryCount:
                    this.state
                        .discoveryCount,

                connectionCount:
                    this.state
                        .connectionCount,

                startupCount:
                    this.state
                        .startupCount,

                retryCount:
                    this.state
                        .retryCount,

                errorCount:
                    this.state
                        .errorCount,

                requiredMissing:
                    this.state
                        .requiredMissing,

                optionalMissing:
                    this.state
                        .optionalMissing,

                invalidDependencies:
                    this.state
                        .invalidDependencies,

                lastError:
                    this.state
                        .lastError,

                configuration:
                    this.configuration
            });
        }
    }

    /* ======================================================================
       SECTION 19
       GLOBAL EXPORTS
       ====================================================================== */

    global.RecoveryReopeningIntegrationV32 =
        RecoveryReopeningIntegrationV32;

    global.RecoveryReopeningIntegrationV32Constants = {

        VERSION,

        BUILD,

        MODULE_NAME,

        ADAPTER_STATUS,

        DEPENDENCY_STATUS,

        ENGINE_CATEGORY,

        DEPENDENCY_PRIORITY,

        DEFAULT_CONFIGURATION,

        ENGINE_DISCOVERY_MAP
    };

    global.RecoveryReopeningIntegrationV32Utils = {

        isObjectLike,

        hasAnyMethod,

        resolveGlobalByNames,

        normalizeDependencyRecord,

        sanitizeDependencyRecord,

        calculateDependencyScore
    };

    global.RecoveryReopeningIntegrationV32Part1 = {

        RecoveryReopeningIntegrationV32,

        IntegrationEmitter,

        ADAPTER_STATUS,

        DEPENDENCY_STATUS,

        ENGINE_CATEGORY,

        DEPENDENCY_PRIORITY,

        DEFAULT_CONFIGURATION,

        ENGINE_DISCOVERY_MAP
    };

})(window);

/* ==========================================================================
   RainGuard AI
   Long Horizon Forecast Engine V32

   Recovery Reopening Integration V32

   PART 2
   Reopening Instance Creation + Dependency Attachment +
   Connection Lifecycle + Core Integration
   ========================================================================== */

(function extendRecoveryReopeningIntegrationV32Part2(global) {
    "use strict";

    /* ======================================================================
       SECTION 20
       DEPENDENCY RESOLUTION
       ====================================================================== */

    const IntegrationClass =
        global.RecoveryReopeningIntegrationV32;

    const IntegrationConstants =
        global.RecoveryReopeningIntegrationV32Constants;

    const IntegrationUtils =
        global.RecoveryReopeningIntegrationV32Utils;

    const IntegrationPart1 =
        global.RecoveryReopeningIntegrationV32Part1;

    const RecoveryReopeningClass =
        global.RecoveryReopeningV32;

    if (
        typeof IntegrationClass !== "function" ||
        !IntegrationConstants ||
        !IntegrationUtils ||
        !IntegrationPart1 ||
        typeof RecoveryReopeningClass !== "function"
    ) {
        throw new Error(
            "RecoveryReopeningIntegrationV32 Part 1 and RecoveryReopeningV32 must be loaded before Part 2."
        );
    }

    const {
        ADAPTER_STATUS,
        DEPENDENCY_STATUS,
        ENGINE_CATEGORY,
        DEPENDENCY_PRIORITY,
        DEFAULT_CONFIGURATION
    } = IntegrationConstants;

    const {
        isObjectLike,
        hasAnyMethod,
        sanitizeDependencyRecord
    } = IntegrationUtils;

    const RecoveryReopeningUtils =
        global.RecoveryReopeningV32Utils;

    const RecoveryReopeningPart2 =
        global.RecoveryReopeningV32Part2;

    if (
        !RecoveryReopeningUtils ||
        !RecoveryReopeningPart2
    ) {
        throw new Error(
            "RecoveryReopeningV32 utilities are unavailable."
        );
    }

    const {
        now,
        deepClone,
        safeArray,
        safeObject,
        createId
    } = RecoveryReopeningUtils;

    const {
        toFiniteNumber,
        normalizeError,
        withTimeout
    } = RecoveryReopeningPart2;

    /* ======================================================================
       SECTION 21
       CONNECTION CONSTANTS
       ====================================================================== */

    const CONNECTION_STATUS =
        Object.freeze({

            IDLE:
                "idle",

            PREPARING:
                "preparing",

            CREATING_INSTANCE:
                "creating_instance",

            ATTACHING_DEPENDENCIES:
                "attaching_dependencies",

            VALIDATING:
                "validating",

            CONNECTED:
                "connected",

            PARTIAL:
                "partial",

            FAILED:
                "failed",

            DISCONNECTED:
                "disconnected",

            DESTROYED:
                "destroyed"

        });

    const CONNECTION_EVENT =
        Object.freeze({

            INSTANCE_CREATED:
                "instance_created",

            INSTANCE_REUSED:
                "instance_reused",

            DEPENDENCY_ATTACHED:
                "dependency_attached",

            DEPENDENCY_SKIPPED:
                "dependency_skipped",

            CONNECTION_STARTED:
                "connection_started",

            CONNECTION_COMPLETED:
                "connection_completed",

            CONNECTION_FAILED:
                "connection_failed",

            DISCONNECTED:
                "disconnected",

            CORE_EXTENDED:
                "core_extended",

            GLOBAL_EXPOSED:
                "global_exposed"
        });

    const ATTACHMENT_ROLE =
        Object.freeze({

            CORE:
                "core",

            CLOSURE:
                "closure",

            MONITORING:
                "monitoring",

            FORECAST:
                "forecast",

            ARRIVAL:
                "arrival",

            SOURCE:
                "source",

            STORAGE:
                "storage",

            AI:
                "ai",

            DASHBOARD:
                "dashboard",

            RADAR:
                "radar",

            LIGHTNING:
                "lightning",

            STORM_TRACKING:
                "storm_tracking",

            PATH_PREDICTION:
                "path_prediction",

            VERIFICATION:
                "verification",

            NOTIFICATION:
                "notification",

            NETWORK:
                "network",

            CUSTOM:
                "custom"
        });

    /* ======================================================================
       SECTION 22
       DEPENDENCY ATTACHMENT MAP
       ====================================================================== */

    const DEPENDENCY_ATTACHMENT_MAP =
        Object.freeze({

            recoveryCore: {

                role:
                    ATTACHMENT_ROLE.CORE,

                property:
                    "core",

                attachMethods: [
                    "attachCore",
                    "setCore",
                    "attachRecoveryCore"
                ]
            },

            closureEngine: {

                role:
                    ATTACHMENT_ROLE.CLOSURE,

                property:
                    "closure",

                attachMethods: [
                    "attachClosure",
                    "setClosure",
                    "attachClosureEngine"
                ]
            },

            monitoringEngine: {

                role:
                    ATTACHMENT_ROLE.MONITORING,

                property:
                    "monitoring",

                attachMethods: [
                    "attachMonitoring",
                    "setMonitoring",
                    "attachMonitoringEngine"
                ]
            },

            forecastEngine: {

                role:
                    ATTACHMENT_ROLE.FORECAST,

                property:
                    "forecastEngine",

                attachMethods: [
                    "attachForecastEngine",
                    "setForecastEngine",
                    "attachForecast"
                ]
            },

            arrivalEngine: {

                role:
                    ATTACHMENT_ROLE.ARRIVAL,

                property:
                    "arrivalEngine",

                attachMethods: [
                    "attachArrivalEngine",
                    "setArrivalEngine",
                    "attachArrival"
                ]
            },

            sourceEngine: {

                role:
                    ATTACHMENT_ROLE.SOURCE,

                property:
                    "sourceEngine",

                attachMethods: [
                    "attachSourceEngine",
                    "setSourceEngine",
                    "attachSource"
                ]
            },

            storageEngine: {

                role:
                    ATTACHMENT_ROLE.STORAGE,

                property:
                    "storage",

                attachMethods: [
                    "attachStorage",
                    "setStorage",
                    "attachStorageEngine"
                ]
            },

            aiEngine: {

                role:
                    ATTACHMENT_ROLE.AI,

                property:
                    "aiEngine",

                attachMethods: [
                    "attachAIEngine",
                    "setAIEngine",
                    "attachAI"
                ]
            },

            dashboardEngine: {

                role:
                    ATTACHMENT_ROLE.DASHBOARD,

                property:
                    "dashboard",

                attachMethods: [
                    "attachDashboard",
                    "setDashboard",
                    "attachDashboardEngine"
                ]
            },

            radarEngine: {

                role:
                    ATTACHMENT_ROLE.RADAR,

                property:
                    "radarEngine",

                attachMethods: [
                    "attachRadarEngine",
                    "setRadarEngine",
                    "attachRadar"
                ]
            },

            lightningEngine: {

                role:
                    ATTACHMENT_ROLE.LIGHTNING,

                property:
                    "lightningEngine",

                attachMethods: [
                    "attachLightningEngine",
                    "setLightningEngine",
                    "attachLightning"
                ]
            },

            stormTrackingEngine: {

                role:
                    ATTACHMENT_ROLE.STORM_TRACKING,

                property:
                    "stormTrackingEngine",

                attachMethods: [
                    "attachStormTrackingEngine",
                    "setStormTrackingEngine",
                    "attachStormTracking"
                ]
            },

            pathPredictionEngine: {

                role:
                    ATTACHMENT_ROLE.PATH_PREDICTION,

                property:
                    "pathPredictionEngine",

                attachMethods: [
                    "attachPathPredictionEngine",
                    "setPathPredictionEngine",
                    "attachPathPrediction"
                ]
            },

            verificationEngine: {

                role:
                    ATTACHMENT_ROLE.VERIFICATION,

                property:
                    "verificationEngine",

                attachMethods: [
                    "attachVerificationEngine",
                    "setVerificationEngine",
                    "attachVerification"
                ]
            },

            notificationEngine: {

                role:
                    ATTACHMENT_ROLE.NOTIFICATION,

                property:
                    "notificationEngine",

                attachMethods: [
                    "attachNotificationEngine",
                    "setNotificationEngine",
                    "attachNotification"
                ]
            },

            networkEngine: {

                role:
                    ATTACHMENT_ROLE.NETWORK,

                property:
                    "networkEngine",

                attachMethods: [
                    "attachNetworkEngine",
                    "setNetworkEngine",
                    "attachNetwork"
                ]
            }
        });

    /* ======================================================================
       SECTION 23
       CONNECTION HELPERS
       ====================================================================== */

    function invokeFirstAvailable(
        target,
        methodNames,
        ...args
    ) {
        if (
            !isObjectLike(target)
        ) {
            return {
                invoked:
                    false,

                method:
                    null,

                value:
                    undefined
            };
        }

        for (
            const methodName of
            safeArray(methodNames)
        ) {
            if (
                typeof target[
                    methodName
                ] ===
                "function"
            ) {
                return {
                    invoked:
                        true,

                    method:
                        methodName,

                    value:
                        target[
                            methodName
                        ](
                            ...args
                        )
                };
            }
        }

        return {
            invoked:
                false,

            method:
                null,

            value:
                undefined
        };
    }

    async function invokeFirstAvailableAsync(
        target,
        methodNames,
        args = [],
        timeoutMs =
            30000
    ) {
        const invocation =
            invokeFirstAvailable(
                target,
                methodNames,
                ...safeArray(args)
            );

        if (
            invocation.invoked !==
            true
        ) {
            return invocation;
        }

        invocation.value =
            await withTimeout(
                Promise.resolve(
                    invocation.value
                ),
                timeoutMs,
                "Integration method timed out: " +
                invocation.method
            );

        return invocation;
    }

    function isValidReopeningInstance(
        instance
    ) {
        return (
            instance instanceof
                RecoveryReopeningClass ||
            (
                isObjectLike(instance) &&
                typeof instance.startReopening ===
                "function" &&
                typeof instance.getState ===
                "function"
            )
        );
    }

    function sanitizeAttachmentRecord(
        record
    ) {
        return {

            id:
                record.id,

            dependencyKey:
                record.dependencyKey,

            role:
                record.role,

            property:
                record.property,

            globalName:
                record.globalName,

            status:
                record.status,

            attached:
                record.attached,

            method:
                record.method,

            required:
                record.required,

            timestamp:
                record.timestamp,

            error:
                deepClone(
                    record.error
                )
        };
    }

    /* ======================================================================
       SECTION 24
       ENSURE CONNECTION STATE
       ====================================================================== */

    IntegrationClass.prototype.ensureConnectionState =
        function ensureConnectionState() {

            if (
                !this.state.connection
            ) {
                this.state.connection = {

                    id:
                        createId(
                            "reopening_connection"
                        ),

                    status:
                        CONNECTION_STATUS.IDLE,

                    startedAt:
                        null,

                    completedAt:
                        null,

                    durationMs:
                        0,

                    reopeningInstanceCreated:
                        false,

                    reopeningInstanceReused:
                        false,

                    globalInstanceExposed:
                        false,

                    coreExtended:
                        false,

                    attachedDependencyCount:
                        0,

                    skippedDependencyCount:
                        0,

                    failedDependencyCount:
                        0,

                    attachmentRecords:
                        [],

                    errors:
                        [],

                    lastError:
                        null
                };
            }

            const connection =
                this.state.connection;

            connection.attachmentRecords =
                safeArray(
                    connection.attachmentRecords
                );

            connection.errors =
                safeArray(
                    connection.errors
                );

            return connection;
        };

    /* ======================================================================
       SECTION 25
       CREATE OR RESOLVE REOPENING INSTANCE
       ====================================================================== */

    IntegrationClass.prototype.resolveReopeningInstance =
        function resolveReopeningInstance(
            options = {}
        ) {

            const connection =
                this.ensureConnectionState();

            const safeOptions =
                safeObject(options);

            connection.status =
                CONNECTION_STATUS.CREATING_INSTANCE;

            if (
                isValidReopeningInstance(
                    safeOptions.reopening
                )
            ) {
                this.reopening =
                    safeOptions.reopening;

                connection
                    .reopeningInstanceReused =
                    true;

                this.emit(
                    CONNECTION_EVENT.INSTANCE_REUSED,
                    {
                        source:
                            "options"
                    }
                );

                return this.reopening;
            }

            if (
                isValidReopeningInstance(
                    this.reopening
                )
            ) {
                connection
                    .reopeningInstanceReused =
                    true;

                this.emit(
                    CONNECTION_EVENT.INSTANCE_REUSED,
                    {
                        source:
                            "integration"
                    }
                );

                return this.reopening;
            }

            const configuredGlobalName =
                safeOptions.instanceGlobalName ||
                this.configuration
                    .instanceGlobalName;

            const globalCandidates = [
                configuredGlobalName,
                "RecoveryReopeningV32Instance",
                "LongHorizonRecoveryReopeningV32Instance",
                "RainArrivalRecoveryReopeningV32Instance"
            ];

            for (
                const globalName of
                globalCandidates
            ) {
                if (
                    isValidReopeningInstance(
                        global[
                            globalName
                        ]
                    )
                ) {
                    this.reopening =
                        global[
                            globalName
                        ];

                    connection
                        .reopeningInstanceReused =
                        true;

                    this.emit(
                        CONNECTION_EVENT.INSTANCE_REUSED,
                        {
                            source:
                                "global",

                            globalName
                        }
                    );

                    return this.reopening;
                }
            }

            if (
                this.configuration
                    .autoCreateInstance ===
                false &&
                safeOptions.create !==
                true
            ) {
                return null;
            }

            const instanceOptions = {

                autoStart:
                    false,

                createSnapshots:
                    true,

                rollbackOnFailure:
                    true,

                ...safeObject(
                    safeOptions.instanceOptions
                )
            };

            this.reopening =
                new RecoveryReopeningClass(
                    instanceOptions
                );

            connection
                .reopeningInstanceCreated =
                true;

            this.emit(
                CONNECTION_EVENT.INSTANCE_CREATED,
                {
                    reopeningId:
                        this.reopening.id
                }
            );

            return this.reopening;
        };

    /* ======================================================================
       SECTION 26
       EXPOSE REOPENING INSTANCE
       ====================================================================== */

    IntegrationClass.prototype.exposeReopeningInstance =
        function exposeReopeningInstance(
            globalName
        ) {

            const connection =
                this.ensureConnectionState();

            if (
                !isValidReopeningInstance(
                    this.reopening
                )
            ) {
                return {
                    exposed:
                        false,

                    reason:
                        "Reopening instance is unavailable."
                };
            }

            if (
                this.configuration
                    .exposeGlobalInstance ===
                false
            ) {
                return {
                    exposed:
                        false,

                    reason:
                        "Global instance exposure is disabled."
                };
            }

            const resolvedGlobalName =
                globalName ||
                this.configuration
                    .instanceGlobalName ||
                "RecoveryReopeningV32Instance";

            global[
                resolvedGlobalName
            ] =
                this.reopening;

            connection.globalInstanceExposed =
                true;

            this.emit(
                CONNECTION_EVENT.GLOBAL_EXPOSED,
                {
                    globalName:
                        resolvedGlobalName,

                    reopeningId:
                        this.reopening.id
                }
            );

            return {
                exposed:
                    true,

                globalName:
                    resolvedGlobalName,

                reopeningId:
                    this.reopening.id
            };
        };

    /* ======================================================================
       SECTION 27
       ATTACH SINGLE DEPENDENCY
       ====================================================================== */

    IntegrationClass.prototype.attachDependencyToReopening =
        async function attachDependencyToReopening(
            dependencyKey,
            options = {}
        ) {

            const connection =
                this.ensureConnectionState();

            const dependencyRecord =
                this.state.dependencies[
                    dependencyKey
                ];

            const mapping =
                DEPENDENCY_ATTACHMENT_MAP[
                    dependencyKey
                ];

            const attachment = {

                id:
                    createId(
                        "dependency_attachment"
                    ),

                dependencyKey,

                role:
                    mapping?.role ||
                    ATTACHMENT_ROLE.CUSTOM,

                property:
                    mapping?.property ||
                    dependencyKey,

                globalName:
                    dependencyRecord?.globalName ||
                    null,

                required:
                    dependencyRecord?.required ===
                    true,

                status:
                    "pending",

                attached:
                    false,

                method:
                    null,

                timestamp:
                    now(),

                error:
                    null
            };

            connection.attachmentRecords
                .push(
                    attachment
                );

            if (
                !dependencyRecord ||
                dependencyRecord.status ===
                DEPENDENCY_STATUS.UNAVAILABLE ||
                !dependencyRecord.target
            ) {
                attachment.status =
                    "skipped";

                connection.skippedDependencyCount +=
                    1;

                this.emit(
                    CONNECTION_EVENT.DEPENDENCY_SKIPPED,
                    {
                        attachment:
                            sanitizeAttachmentRecord(
                                attachment
                            )
                    }
                );

                return sanitizeAttachmentRecord(
                    attachment
                );
            }

            if (
                !mapping
            ) {
                attachment.status =
                    "skipped";

                connection.skippedDependencyCount +=
                    1;

                return sanitizeAttachmentRecord(
                    attachment
                );
            }

            try {

                const invocation =
                    await invokeFirstAvailableAsync(
                        this.reopening,
                        mapping.attachMethods,
                        [
                            dependencyRecord.target
                        ],
                        toFiniteNumber(
                            options.timeoutMs,
                            this.configuration
                                .connectionTimeoutMs
                        )
                    );

                if (
                    invocation.invoked
                ) {
                    attachment.method =
                        invocation.method;
                } else {
                    this.reopening[
                        mapping.property
                    ] =
                        dependencyRecord.target;

                    attachment.method =
                        "property_assignment";
                }

                attachment.status =
                    "attached";

                attachment.attached =
                    true;

                connection.attachedDependencyCount +=
                    1;

                this.emit(
                    CONNECTION_EVENT.DEPENDENCY_ATTACHED,
                    {
                        attachment:
                            sanitizeAttachmentRecord(
                                attachment
                            )
                    }
                );

                return sanitizeAttachmentRecord(
                    attachment
                );

            } catch (error) {

                const normalized =
                    normalizeError(
                        error
                    );

                attachment.status =
                    "failed";

                attachment.error =
                    normalized;

                connection.failedDependencyCount +=
                    1;

                connection.errors
                    .push({
                        id:
                            createId(
                                "attachment_error"
                            ),

                        dependencyKey,

                        timestamp:
                            now(),

                        error:
                            normalized
                    });

                return sanitizeAttachmentRecord(
                    attachment
                );
            }
        };

    /* ======================================================================
       SECTION 28
       ATTACH ALL DEPENDENCIES
       ====================================================================== */

    IntegrationClass.prototype.attachAllDependencies =
        async function attachAllDependencies(
            options = {}
        ) {

            const connection =
                this.ensureConnectionState();

            connection.status =
                CONNECTION_STATUS
                    .ATTACHING_DEPENDENCIES;

            connection.attachedDependencyCount =
                0;

            connection.skippedDependencyCount =
                0;

            connection.failedDependencyCount =
                0;

            connection.attachmentRecords =
                [];

            const dependencyKeys =
                Object.keys(
                    DEPENDENCY_ATTACHMENT_MAP
                );

            const results = [];

            for (
                const dependencyKey of
                dependencyKeys
            ) {
                const result =
                    await this
                        .attachDependencyToReopening(
                            dependencyKey,
                            options
                        );

                results.push(
                    result
                );
            }

            return {
                total:
                    results.length,

                attached:
                    connection
                        .attachedDependencyCount,

                skipped:
                    connection
                        .skippedDependencyCount,

                failed:
                    connection
                        .failedDependencyCount,

                records:
                    deepClone(
                        results
                    )
            };
        };

    /* ======================================================================
       SECTION 29
       BUILD REOPENING DEPENDENCY RESOLVER
       ====================================================================== */

    IntegrationClass.prototype.installDependencyResolver =
    function installDependencyResolver() {

        if (
            !isValidReopeningInstance(
                this.reopening
            )
        ) {
            return false;
        }

        const integration =
            this;

        this.reopening.resolveReopeningDependencies =
            function resolveReopeningDependencies() {

                const core =
                    integration.getDependency(
                        "recoveryCore"
                    ) ||
                    this.core ||
                    global.LongHorizonRecoveryCoreV32Instance ||
                    global.RainArrivalRecoveryCoreV32Instance ||
                    global.recoveryCoreV32 ||
                    null;

                const closure =
                    integration.getDependency(
                        "closureEngine"
                    ) ||
                    this.recoveryClosure ||
                    this.recoveryClosureV32 ||
                    this.closure ||
                    core?.getRecoveryClosure?.() ||
                    core?.recoveryClosure ||
                    core?.recoveryClosureV32 ||
                    global.RecoveryClosureV32Instance ||
                    global.RainArrivalRecoveryClosureV32Instance ||
                    null;

                const monitoring =
                    integration.getDependency(
                        "monitoringEngine"
                    ) ||
                    this.monitoring ||
                    core?.getPostRecoveryMonitoring?.() ||
                    core?.postRecoveryMonitoring ||
                    global.PostRecoveryMonitoringV32Instance ||
                    null;

                const forecastEngine =
                    integration.getDependency(
                        "forecastEngine"
                    ) ||
                    this.forecastEngine ||
                    core?.getForecastEngine?.() ||
                    core?.forecastEngine ||
                    global.LongHorizonForecastEngineV32Instance ||
                    global.LongHorizonForecastEngineV32 ||
                    null;

                const arrivalEngine =
                    integration.getDependency(
                        "arrivalEngine"
                    ) ||
                    this.arrivalEngine ||
                    core?.getArrivalEngine?.() ||
                    core?.arrivalEngine ||
                    global.RainArrivalPredictionEngineV32Instance ||
                    global.RainArrivalPredictionEngineV32 ||
                    null;

                const sourceEngine =
                    integration.getDependency(
                        "sourceEngine"
                    ) ||
                    this.sourceEngine ||
                    core?.getSourceEngine?.() ||
                    core?.sourceEngine ||
                    global.SourceAdapterV32Instance ||
                    null;

                const storage =
                    integration.getDependency(
                        "storageEngine"
                    ) ||
                    this.storage ||
                    core?.getStorage?.() ||
                    core?.storage ||
                    global.StorageOptimizerV32Instance ||
                    global.localStorage ||
                    null;

                this.core =
                    core;
               if (core) {

    core.forecastEngine =
        forecastEngine;

    core.longHorizonForecastEngine =
        forecastEngine;

    core.longHorizonForecastEngineV32 =
        forecastEngine;

    core.arrivalEngine =
        arrivalEngine;

    core.sourceEngine =
        sourceEngine;

    core.storage =
        storage;

}

                this.closure =
                    closure;

                this.recoveryClosure =
                    closure;

                this.recoveryClosureV32 =
                    closure;

                this.monitoring =
                    monitoring;
               this.forecastEngine =
    forecastEngine;

this.longHorizonForecastEngine =
    forecastEngine;

this.longHorizonForecastEngineV32 =
    forecastEngine;

this.arrivalEngine =
    arrivalEngine;

this.sourceEngine =
    sourceEngine;

this.storage =
    storage;

                return {
                    core,
                    closure,
                    monitoring,
                    forecastEngine,
                    arrivalEngine,
                    sourceEngine,
                    storage,

                    aiEngine:
                        integration.getDependency(
                            "aiEngine"
                        ) ||
                        this.aiEngine ||
                        null,

                    dashboard:
                        integration.getDependency(
                            "dashboardEngine"
                        ) ||
                        this.dashboard ||
                        core?.dashboard ||
                        null,

                    radarEngine:
                        integration.getDependency(
                            "radarEngine"
                        ) ||
                        this.radarEngine ||
                        null,

                    lightningEngine:
                        integration.getDependency(
                            "lightningEngine"
                        ) ||
                        this.lightningEngine ||
                        null,

                    stormTrackingEngine:
                        integration.getDependency(
                            "stormTrackingEngine"
                        ) ||
                        this.stormTrackingEngine ||
                        null,

                    pathPredictionEngine:
                        integration.getDependency(
                            "pathPredictionEngine"
                        ) ||
                        this.pathPredictionEngine ||
                        null,

                    verificationEngine:
                        integration.getDependency(
                            "verificationEngine"
                        ) ||
                        this.verificationEngine ||
                        null,

                    notificationEngine:
                        integration.getDependency(
                            "notificationEngine"
                        ) ||
                        this.notificationEngine ||
                        null,

                    networkEngine:
                        integration.getDependency(
                            "networkEngine"
                        ) ||
                        this.networkEngine ||
                        null
                };

            };

        return true;

    };

    /* ======================================================================
       SECTION 30
       EXTEND RECOVERY CORE
       ====================================================================== */

    IntegrationClass.prototype.extendRecoveryCore =
        function extendRecoveryCore() {

            const connection =
                this.ensureConnectionState();

            const core =
                this.getDependency(
                    "recoveryCore"
                );

            if (
                !core ||
                !isValidReopeningInstance(
                    this.reopening
                )
            ) {
                return {
                    extended:
                        false,

                    reason:
                        "Recovery core or reopening instance is unavailable."
                };
            }

            core.recoveryReopening =
                this.reopening;

            core.recoveryReopeningIntegration =
                this;

            if (
                typeof core.getRecoveryReopening !==
                "function"
            ) {
                core.getRecoveryReopening =
                    function getRecoveryReopening() {
                        return (
                            this.recoveryReopening ||
                            null
                        );
                    };
            }

            if (
                typeof core.getRecoveryReopeningIntegration !==
                "function"
            ) {
                core.getRecoveryReopeningIntegration =
                    function getRecoveryReopeningIntegration() {
                        return (
                            this
                                .recoveryReopeningIntegration ||
                            null
                        );
                    };
            }

            if (
                typeof core.startRecoveryReopening !==
                "function"
            ) {
                core.startRecoveryReopening =
                    function startRecoveryReopening(
                        options
                    ) {
                        return this
                            .recoveryReopening
                            ?.startReopening(
                                options
                            );
                    };
            }

            if (
                typeof core.pauseRecoveryReopening !==
                "function"
            ) {
                core.pauseRecoveryReopening =
                    function pauseRecoveryReopening() {
                        return this
                            .recoveryReopening
                            ?.pauseReopening();
                    };
            }

            if (
                typeof core.resumeRecoveryReopening !==
                "function"
            ) {
                core.resumeRecoveryReopening =
                    function resumeRecoveryReopening() {
                        return this
                            .recoveryReopening
                            ?.resumeReopening();
                    };
            }

            if (
                typeof core.cancelRecoveryReopening !==
                "function"
            ) {
                core.cancelRecoveryReopening =
                    function cancelRecoveryReopening(
                        options
                    ) {
                        return this
                            .recoveryReopening
                            ?.cancelReopening(
                                options
                            );
                    };
            }

            if (
                typeof core.getRecoveryReopeningStatus !==
                "function"
            ) {
                core.getRecoveryReopeningStatus =
                    function getRecoveryReopeningStatus() {
                        return this
                            .recoveryReopening
                            ?.getCompleteReopeningStatus?.() ||
                            this
                                .recoveryReopening
                                ?.getExecutionStatus?.() ||
                            null;
                    };
            }

            connection.coreExtended =
                true;

            this.emit(
                CONNECTION_EVENT.CORE_EXTENDED,
                {
                    reopeningId:
                        this.reopening.id
                }
            );

            return {
                extended:
                    true,

                reopeningId:
                    this.reopening.id
            };
        };

    /* ======================================================================
       SECTION 31
       VALIDATE CONNECTION
       ====================================================================== */

    IntegrationClass.prototype.validateConnection =
        function validateConnection() {

            const connection =
                this.ensureConnectionState();

            connection.status =
                CONNECTION_STATUS.VALIDATING;

            const issues = [];

            if (
                !isValidReopeningInstance(
                    this.reopening
                )
            ) {
                issues.push(
                    "Reopening instance is invalid."
                );
            }

            if (
                this.configuration
                    .strictRequiredDependencies &&
                this.state.requiredMissing
                    .length >
                0
            ) {
                issues.push(
                    "Required dependencies are missing: " +
                    this.state.requiredMissing
                        .join(
                            ", "
                        )
                );
            }

            const failedRequiredAttachments =
                connection.attachmentRecords
                    .filter(
                        (record) => {
                            return (
                                record.required ===
                                true &&
                                record.status ===
                                "failed"
                            );
                        }
                    );

            if (
                failedRequiredAttachments
                    .length >
                0
            ) {
                issues.push(
                    "Required dependency attachments failed."
                );
            }

            const connected =
                issues.length ===
                0;

            return {

                connected,

                partial:
                    connected &&
                    (
                        this.state.optionalMissing
                            .length >
                        0 ||
                        connection.skippedDependencyCount >
                        0
                    ),

                issues,

                reopeningAvailable:
                    isValidReopeningInstance(
                        this.reopening
                    ),

                requiredMissing:
                    deepClone(
                        this.state.requiredMissing
                    ),

                optionalMissing:
                    deepClone(
                        this.state.optionalMissing
                    ),

                attachmentSummary: {
                    attached:
                        connection
                            .attachedDependencyCount,

                    skipped:
                        connection
                            .skippedDependencyCount,

                    failed:
                        connection
                            .failedDependencyCount
                }
            };
        };

    /* ======================================================================
       SECTION 32
       CONNECT
       ====================================================================== */

    IntegrationClass.prototype.connect =
        async function connect(
            options = {}
        ) {

            if (
                this.destroyed
            ) {
                throw new Error(
                    "Recovery reopening integration is destroyed."
                );
            }

            const connection =
                this.ensureConnectionState();

            const safeOptions =
                safeObject(options);

            connection.status =
                CONNECTION_STATUS.PREPARING;

            connection.startedAt =
                now();

            connection.completedAt =
                null;

            connection.lastError =
                null;

            this.state.status =
                ADAPTER_STATUS.CONNECTING;

            this.state.connectionCount +=
                1;

            this.emit(
                CONNECTION_EVENT.CONNECTION_STARTED,
                {
                    attempt:
                        this.state.connectionCount
                }
            );

            try {

                if (
                    safeOptions.rediscover ===
                    true ||
                    Object.keys(
                        this.state.dependencies
                    ).length ===
                    0
                ) {
                    this.discoverDependencies();
                }

                if (
                    !this.canConnect()
                ) {
                    throw new Error(
                        "Required dependencies are unavailable."
                    );
                }

                const reopening =
                    this.resolveReopeningInstance(
                        safeOptions
                    );

                if (
                    !isValidReopeningInstance(
                        reopening
                    )
                ) {
                    throw new Error(
                        "Unable to create or resolve RecoveryReopeningV32 instance."
                    );
                }

                this.installDependencyResolver();

                const attachments =
                    await withTimeout(
                        this.attachAllDependencies(
                            safeOptions
                        ),
                        toFiniteNumber(
                            safeOptions.timeoutMs,
                            this.configuration
                                .connectionTimeoutMs
                        ),
                        "Recovery reopening integration connection timed out."
                    );

                const coreExtension =
                    this.extendRecoveryCore();

                const globalExposure =
                    this.exposeReopeningInstance(
                        safeOptions.instanceGlobalName
                    );

                if (
                    typeof reopening
                        .initializeCompleteReopening ===
                    "function"
                ) {
                    reopening
                        .initializeCompleteReopening({
                            persistence: {
                                autoSave:
                                    this.configuration
                                        .autoSaveState,

                                restoreOnInitialize:
                                    this.configuration
                                        .autoRestoreState
                            },

                            integration: {
                                autoAttach:
                                    false,

                                autoReopen:
                                    false
                            }
                        });
                }

                const validation =
                    this.validateConnection();

                if (
                    !validation.connected
                ) {
                    throw new Error(
                        validation.issues.join(
                            " "
                        )
                    );
                }

                connection.status =
                    validation.partial
                        ? CONNECTION_STATUS.PARTIAL
                        : CONNECTION_STATUS.CONNECTED;

                connection.completedAt =
                    now();

                connection.durationMs =
                    connection.completedAt -
                    connection.startedAt;

                this.state.connectedAt =
                    connection.completedAt;

                this.state.status =
                    validation.partial
                        ? ADAPTER_STATUS.PARTIAL
                        : ADAPTER_STATUS.CONNECTED;

                this.emit(
                    CONNECTION_EVENT.CONNECTION_COMPLETED,
                    {
                        validation,

                        attachments,

                        coreExtension,

                        globalExposure
                    }
                );

                return this.getConnectionStatus();

            } catch (error) {

                const normalized =
                    normalizeError(
                        error
                    );

                connection.status =
                    CONNECTION_STATUS.FAILED;

                connection.lastError =
                    normalized;

                connection.errors
                    .push({
                        id:
                            createId(
                                "connection_error"
                            ),

                        timestamp:
                            now(),

                        error:
                            normalized
                    });

                connection.completedAt =
                    now();

                connection.durationMs =
                    connection.completedAt -
                    connection.startedAt;

                this.state.status =
                    ADAPTER_STATUS.FAILED;

                this.state.errorCount +=
                    1;

                this.state.lastError =
                    normalized;

                this.state.errors
                    .push({
                        id:
                            createId(
                                "integration_error"
                            ),

                        timestamp:
                            now(),

                        phase:
                            "connect",

                        error:
                            normalized
                    });

                this.emit(
                    CONNECTION_EVENT.CONNECTION_FAILED,
                    {
                        error:
                            normalized
                    }
                );

                return this.getConnectionStatus();
            }
        };

    /* ======================================================================
       SECTION 33
       DISCONNECT
       ====================================================================== */

    IntegrationClass.prototype.disconnect =
        function disconnect(
            options = {}
        ) {

            const connection =
                this.ensureConnectionState();

            const safeOptions =
                safeObject(options);

            const core =
                this.getDependency(
                    "recoveryCore"
                );

            if (
                core?.recoveryReopening ===
                this.reopening
            ) {
                delete core
                    .recoveryReopening;
            }

            if (
                core?.recoveryReopeningIntegration ===
                this
            ) {
                delete core
                    .recoveryReopeningIntegration;
            }

            if (
                this.reopening
            ) {
                this.reopening.core =
                    null;

                this.reopening.closure =
                    null;

                this.reopening.monitoring =
                    null;

                this.reopening.forecastEngine =
                    null;

                this.reopening.arrivalEngine =
                    null;

                this.reopening.sourceEngine =
                    null;

                this.reopening.storage =
                    null;
            }

            if (
                safeOptions.removeGlobal ===
                true
            ) {
                const globalName =
                    this.configuration
                        .instanceGlobalName;

                if (
                    global[
                        globalName
                    ] ===
                    this.reopening
                ) {
                    delete global[
                        globalName
                    ];
                }
            }

            connection.status =
                CONNECTION_STATUS.DISCONNECTED;

            connection.completedAt =
                now();

            this.state.status =
                ADAPTER_STATUS.READY;

            this.emit(
                CONNECTION_EVENT.DISCONNECTED,
                {
                    reopeningId:
                        this.reopening?.id ||
                        null
                }
            );

            return this.getConnectionStatus();
        };

    /* ======================================================================
       SECTION 34
       GET CONNECTION STATUS
       ====================================================================== */

    IntegrationClass.prototype.getConnectionStatus =
        function getConnectionStatus() {

            const connection =
                this.ensureConnectionState();

            return deepClone({

                integrationId:
                    this.id,

                adapterStatus:
                    this.state.status,

                connectionId:
                    connection.id,

                status:
                    connection.status,

                connected:
                    [
                        CONNECTION_STATUS.CONNECTED,
                        CONNECTION_STATUS.PARTIAL
                    ].includes(
                        connection.status
                    ),

                partial:
                    connection.status ===
                    CONNECTION_STATUS.PARTIAL,

                reopeningAvailable:
                    isValidReopeningInstance(
                        this.reopening
                    ),

                reopeningId:
                    this.reopening?.id ||
                    null,

                reopeningInstanceCreated:
                    connection
                        .reopeningInstanceCreated,

                reopeningInstanceReused:
                    connection
                        .reopeningInstanceReused,

                globalInstanceExposed:
                    connection
                        .globalInstanceExposed,

                coreExtended:
                    connection.coreExtended,

                attachedDependencyCount:
                    connection
                        .attachedDependencyCount,

                skippedDependencyCount:
                    connection
                        .skippedDependencyCount,

                failedDependencyCount:
                    connection
                        .failedDependencyCount,

                startedAt:
                    connection.startedAt,

                completedAt:
                    connection.completedAt,

                durationMs:
                    connection.durationMs,

                attachmentRecords:
                    connection
                        .attachmentRecords
                        .map(
                            sanitizeAttachmentRecord
                        ),

                lastError:
                    connection.lastError,

                errorCount:
                    connection.errors.length
            });
        };

    /* ======================================================================
       SECTION 35
       GET REOPENING INSTANCE
       ====================================================================== */

    IntegrationClass.prototype.getReopeningInstance =
        function getReopeningInstance() {

            return (
                isValidReopeningInstance(
                    this.reopening
                )
                    ? this.reopening
                    : null
            );
        };

    /* ======================================================================
       SECTION 36
       CONNECTION CHECK
       ====================================================================== */

    IntegrationClass.prototype.isConnected =
        function isConnected() {

            const status =
                this.ensureConnectionState()
                    .status;

            return [
                CONNECTION_STATUS.CONNECTED,
                CONNECTION_STATUS.PARTIAL
            ].includes(
                status
            );
        };

    /* ======================================================================
       SECTION 37
       AUTO-CONNECT INITIALIZATION
       ====================================================================== */

    IntegrationClass.prototype.initializeConnection =
        async function initializeConnection(
            options = {}
        ) {

            const safeOptions =
                safeObject(options);

            if (
                safeOptions.configure
            ) {
                this.configure(
                    safeOptions.configure
                );
            }

            if (
                safeOptions.rediscover !==
                false
            ) {
                this.discoverDependencies();
            }

            if (
                this.configuration.autoConnect ||
                safeOptions.connect ===
                true
            ) {
                return this.connect(
                    safeOptions
                );
            }

            this.resolveReopeningInstance(
                safeOptions
            );

            this.installDependencyResolver();

            return this.getConnectionStatus();
        };

    /* ======================================================================
       SECTION 38
       COMPATIBILITY ALIASES
       ====================================================================== */

    IntegrationClass.prototype.createReopeningInstance =
        IntegrationClass.prototype
            .resolveReopeningInstance;

    IntegrationClass.prototype.attachDependencies =
        IntegrationClass.prototype
            .attachAllDependencies;

    IntegrationClass.prototype.connectReopening =
        IntegrationClass.prototype
            .connect;

    IntegrationClass.prototype.disconnectReopening =
        IntegrationClass.prototype
            .disconnect;

    IntegrationClass.prototype.getConnection =
        IntegrationClass.prototype
            .getConnectionStatus;

    IntegrationClass.prototype.getReopening =
        IntegrationClass.prototype
            .getReopeningInstance;

    IntegrationClass.prototype.initialize =
        IntegrationClass.prototype
            .initializeConnection;

    /* ======================================================================
       SECTION 39
       PART 2 EXPORT
       ====================================================================== */

    global.RecoveryReopeningIntegrationV32Part2 = {

        CONNECTION_STATUS,

        CONNECTION_EVENT,

        ATTACHMENT_ROLE,

        DEPENDENCY_ATTACHMENT_MAP,

        invokeFirstAvailable,

        invokeFirstAvailableAsync,

        isValidReopeningInstance,

        sanitizeAttachmentRecord
    };

})(window);

/* ==========================================================================
   RainGuard AI
   Long Horizon Forecast Engine V32

   Recovery Reopening Integration V32

   PART 3
   Service Registration + Source Registration +
   Reopening Components + Health Checks
   ========================================================================== */

(function extendRecoveryReopeningIntegrationV32Part3(global) {
    "use strict";

    /* ======================================================================
       SECTION 40
       DEPENDENCY RESOLUTION
       ====================================================================== */

    const IntegrationClass =
        global.RecoveryReopeningIntegrationV32;

    const IntegrationConstants =
        global.RecoveryReopeningIntegrationV32Constants;

    const IntegrationUtils =
        global.RecoveryReopeningIntegrationV32Utils;

    const IntegrationPart1 =
        global.RecoveryReopeningIntegrationV32Part1;

    const IntegrationPart2 =
        global.RecoveryReopeningIntegrationV32Part2;

    const RecoveryReopeningConstants =
        global.RecoveryReopeningV32Constants;

    const RecoveryReopeningUtils =
        global.RecoveryReopeningV32Utils;

    const RecoveryReopeningPart2 =
        global.RecoveryReopeningV32Part2;

    const RecoveryReopeningPart3 =
        global.RecoveryReopeningV32Part3;

    if (
        typeof IntegrationClass !== "function" ||
        !IntegrationConstants ||
        !IntegrationUtils ||
        !IntegrationPart1 ||
        !IntegrationPart2 ||
        !RecoveryReopeningConstants ||
        !RecoveryReopeningUtils ||
        !RecoveryReopeningPart2 ||
        !RecoveryReopeningPart3
    ) {
        throw new Error(
            "RecoveryReopeningIntegrationV32 Parts 1 and 2 must be loaded before Part 3."
        );
    }

    const {
        ADAPTER_STATUS,
        DEPENDENCY_STATUS,
        ENGINE_CATEGORY
    } = IntegrationConstants;

    const {
        isObjectLike
    } = IntegrationUtils;

    const {
        CONNECTION_STATUS,
        invokeFirstAvailable,
        invokeFirstAvailableAsync,
        isValidReopeningInstance
    } = IntegrationPart2;

    const {
        REOPENING_STAGE,
        REOPENING_RESULT
    } = RecoveryReopeningConstants;

    const {
        now,
        deepClone,
        safeArray,
        safeObject,
        createId
    } = RecoveryReopeningUtils;

    const {
        toFiniteNumber,
        clamp,
        normalizeError,
        withTimeout
    } = RecoveryReopeningPart2;

    const {
        COMPONENT_TYPE,
        COMPONENT_STATUS,
        EXECUTION_MODE
    } = RecoveryReopeningPart3;

    /* ======================================================================
       SECTION 41
       REGISTRATION CONSTANTS
       ====================================================================== */

    const REGISTRATION_STATUS =
        Object.freeze({

            IDLE:
                "idle",

            REGISTERING:
                "registering",

            REGISTERED:
                "registered",

            PARTIAL:
                "partial",

            FAILED:
                "failed",

            CLEARED:
                "cleared"
        });

    const RESOURCE_KIND =
        Object.freeze({

            SERVICE:
                "service",

            SOURCE:
                "source",

            COMPONENT:
                "component",

            HEALTH_CHECK:
                "health_check"
        });

    const RESOURCE_STATUS =
        Object.freeze({

            PENDING:
                "pending",

            REGISTERED:
                "registered",

            SKIPPED:
                "skipped",

            FAILED:
                "failed",

            DUPLICATE:
                "duplicate"
        });

    const HEALTH_STATUS =
        Object.freeze({

            UNKNOWN:
                "unknown",

            HEALTHY:
                "healthy",

            DEGRADED:
                "degraded",

            UNHEALTHY:
                "unhealthy",

            UNAVAILABLE:
                "unavailable",

            TIMEOUT:
                "timeout",

            ERROR:
                "error"
        });

    const SERVICE_ROLE =
        Object.freeze({

            RECOVERY_CORE:
                "recovery_core",

            FORECAST:
                "forecast",

            ARRIVAL:
                "arrival",

            SOURCE:
                "source",

            STORAGE:
                "storage",

            AI:
                "ai",

            DASHBOARD:
                "dashboard",

            RADAR:
                "radar",

            LIGHTNING:
                "lightning",

            STORM_TRACKING:
                "storm_tracking",

            PATH_PREDICTION:
                "path_prediction",

            VERIFICATION:
                "verification",

            NOTIFICATION:
                "notification",

            NETWORK:
                "network",

            MONITORING:
                "monitoring",

            CLOSURE:
                "closure",

            CUSTOM:
                "custom"
        });

    /* ======================================================================
       SECTION 42
       DEFAULT RESOURCE DEFINITIONS
       ====================================================================== */

    const DEFAULT_RESOURCE_DEFINITIONS =
        Object.freeze({

            recoveryCore: {

                kind:
                    RESOURCE_KIND.SERVICE,

                role:
                    SERVICE_ROLE.RECOVERY_CORE,

                required:
                    true,

                stage:
                    REOPENING_STAGE.CORE,

                componentType:
                    COMPONENT_TYPE.CORE,

                order:
                    10,

                startMethods: [
                    "resume",
                    "restart",
                    "start",
                    "initialize",
                    "activate"
                ],

                stopMethods: [
                    "pause",
                    "stop",
                    "suspend",
                    "deactivate"
                ],

                healthMethods: [
                    "healthCheck",
                    "checkHealth",
                    "getHealth",
                    "getStatus",
                    "getState"
                ]
            },

            sourceEngine: {

                kind:
                    RESOURCE_KIND.SOURCE,

                role:
                    SERVICE_ROLE.SOURCE,

                required:
                    true,

                stage:
                    REOPENING_STAGE.DATA,

                componentType:
                    COMPONENT_TYPE.SOURCE,

                order:
                    20,

                startMethods: [
                    "connect",
                    "initialize",
                    "start",
                    "resume",
                    "refresh"
                ],

                stopMethods: [
                    "disconnect",
                    "pause",
                    "stop",
                    "suspend"
                ],

                healthMethods: [
                    "healthCheck",
                    "checkHealth",
                    "getStatus",
                    "getState"
                ]
            },

            storageEngine: {

                kind:
                    RESOURCE_KIND.SERVICE,

                role:
                    SERVICE_ROLE.STORAGE,

                required:
                    true,

                stage:
                    REOPENING_STAGE.DATA,

                componentType:
                    COMPONENT_TYPE.STORAGE,

                order:
                    30,

                startMethods: [
                    "initialize",
                    "restore",
                    "resume",
                    "start",
                    "open"
                ],

                stopMethods: [
                    "flush",
                    "pause",
                    "stop",
                    "close"
                ],

                healthMethods: [
                    "healthCheck",
                    "checkHealth",
                    "getStatus",
                    "getState"
                ]
            },

            radarEngine: {

                kind:
                    RESOURCE_KIND.SOURCE,

                role:
                    SERVICE_ROLE.RADAR,

                required:
                    false,

                stage:
                    REOPENING_STAGE.SOURCES,

                componentType:
                    COMPONENT_TYPE.SOURCE,

                order:
                    40,

                startMethods: [
                    "initialize",
                    "connect",
                    "start",
                    "resume",
                    "refresh",
                    "fetchRadar"
                ],

                stopMethods: [
                    "disconnect",
                    "pause",
                    "stop"
                ],

                healthMethods: [
                    "healthCheck",
                    "checkHealth",
                    "getStatus",
                    "getState"
                ]
            },

            lightningEngine: {

                kind:
                    RESOURCE_KIND.SOURCE,

                role:
                    SERVICE_ROLE.LIGHTNING,

                required:
                    false,

                stage:
                    REOPENING_STAGE.SOURCES,

                componentType:
                    COMPONENT_TYPE.SOURCE,

                order:
                    50,

                startMethods: [
                    "initialize",
                    "connect",
                    "start",
                    "resume",
                    "refresh",
                    "fetchLightning"
                ],

                stopMethods: [
                    "disconnect",
                    "pause",
                    "stop"
                ],

                healthMethods: [
                    "healthCheck",
                    "checkHealth",
                    "getStatus",
                    "getState"
                ]
            },

            forecastEngine: {

                kind:
                    RESOURCE_KIND.SERVICE,

                role:
                    SERVICE_ROLE.FORECAST,

                required:
                    true,

                stage:
                    REOPENING_STAGE.ENGINES,

                componentType:
                    COMPONENT_TYPE.ENGINE,

                order:
                    60,

                startMethods: [
                    "initialize",
                    "start",
                    "resume",
                    "run",
                    "activate"
                ],

                stopMethods: [
                    "pause",
                    "stop",
                    "suspend",
                    "deactivate"
                ],

                healthMethods: [
                    "healthCheck",
                    "checkHealth",
                    "getStatus",
                    "getState"
                ]
            },

            arrivalEngine: {

                kind:
                    RESOURCE_KIND.SERVICE,

                role:
                    SERVICE_ROLE.ARRIVAL,

                required:
                    true,

                stage:
                    REOPENING_STAGE.ENGINES,

                componentType:
                    COMPONENT_TYPE.ENGINE,

                order:
                    70,

                startMethods: [
                    "initialize",
                    "start",
                    "resume",
                    "run",
                    "activate"
                ],

                stopMethods: [
                    "pause",
                    "stop",
                    "suspend",
                    "deactivate"
                ],

                healthMethods: [
                    "healthCheck",
                    "checkHealth",
                    "getStatus",
                    "getState"
                ]
            },

            stormTrackingEngine: {

                kind:
                    RESOURCE_KIND.SERVICE,

                role:
                    SERVICE_ROLE.STORM_TRACKING,

                required:
                    false,

                stage:
                    REOPENING_STAGE.ENGINES,

                componentType:
                    COMPONENT_TYPE.ENGINE,

                order:
                    80,

                startMethods: [
                    "initialize",
                    "start",
                    "resume",
                    "track",
                    "activate"
                ],

                stopMethods: [
                    "pause",
                    "stop",
                    "suspend"
                ],

                healthMethods: [
                    "healthCheck",
                    "checkHealth",
                    "getStatus",
                    "getState"
                ]
            },

            pathPredictionEngine: {

                kind:
                    RESOURCE_KIND.SERVICE,

                role:
                    SERVICE_ROLE.PATH_PREDICTION,

                required:
                    false,

                stage:
                    REOPENING_STAGE.ENGINES,

                componentType:
                    COMPONENT_TYPE.ENGINE,

                order:
                    90,

                startMethods: [
                    "initialize",
                    "start",
                    "resume",
                    "predict",
                    "activate"
                ],

                stopMethods: [
                    "pause",
                    "stop",
                    "suspend"
                ],

                healthMethods: [
                    "healthCheck",
                    "checkHealth",
                    "getStatus",
                    "getState"
                ]
            },

            aiEngine: {

                kind:
                    RESOURCE_KIND.SERVICE,

                role:
                    SERVICE_ROLE.AI,

                required:
                    false,

                stage:
                    REOPENING_STAGE.INTELLIGENCE,

                componentType:
                    COMPONENT_TYPE.AI,

                order:
                    100,

                startMethods: [
                    "initialize",
                    "start",
                    "resume",
                    "activate"
                ],

                stopMethods: [
                    "pause",
                    "stop",
                    "suspend",
                    "deactivate"
                ],

                healthMethods: [
                    "healthCheck",
                    "checkHealth",
                    "getStatus",
                    "getState"
                ]
            },

            verificationEngine: {

                kind:
                    RESOURCE_KIND.SERVICE,

                role:
                    SERVICE_ROLE.VERIFICATION,

                required:
                    false,

                stage:
                    REOPENING_STAGE.VERIFICATION,

                componentType:
                    COMPONENT_TYPE.VERIFICATION,

                order:
                    110,

                startMethods: [
                    "initialize",
                    "start",
                    "resume",
                    "verify",
                    "activate"
                ],

                stopMethods: [
                    "pause",
                    "stop",
                    "suspend"
                ],

                healthMethods: [
                    "healthCheck",
                    "checkHealth",
                    "getStatus",
                    "getState"
                ]
            },

            monitoringEngine: {

                kind:
                    RESOURCE_KIND.SERVICE,

                role:
                    SERVICE_ROLE.MONITORING,

                required:
                    false,

                stage:
                    REOPENING_STAGE.MONITORING,

                componentType:
                    COMPONENT_TYPE.MONITORING,

                order:
                    120,

                startMethods: [
                    "initialize",
                    "start",
                    "resume",
                    "monitor",
                    "activate"
                ],

                stopMethods: [
                    "pause",
                    "stop",
                    "suspend"
                ],

                healthMethods: [
                    "healthCheck",
                    "checkHealth",
                    "getStatus",
                    "getState"
                ]
            },

            notificationEngine: {

                kind:
                    RESOURCE_KIND.SERVICE,

                role:
                    SERVICE_ROLE.NOTIFICATION,

                required:
                    false,

                stage:
                    REOPENING_STAGE.INTERFACES,

                componentType:
                    COMPONENT_TYPE.SERVICE,

                order:
                    130,

                startMethods: [
                    "initialize",
                    "start",
                    "resume",
                    "activate"
                ],

                stopMethods: [
                    "pause",
                    "stop",
                    "suspend"
                ],

                healthMethods: [
                    "healthCheck",
                    "checkHealth",
                    "getStatus",
                    "getState"
                ]
            },

            dashboardEngine: {

                kind:
                    RESOURCE_KIND.SERVICE,

                role:
                    SERVICE_ROLE.DASHBOARD,

                required:
                    false,

                stage:
                    REOPENING_STAGE.INTERFACES,

                componentType:
                    COMPONENT_TYPE.INTERFACE,

                order:
                    140,

                startMethods: [
                    "initialize",
                    "start",
                    "resume",
                    "render",
                    "activate"
                ],

                stopMethods: [
                    "pause",
                    "stop",
                    "suspend",
                    "deactivate"
                ],

                healthMethods: [
                    "healthCheck",
                    "checkHealth",
                    "getStatus",
                    "getState"
                ]
            },

            networkEngine: {

                kind:
                    RESOURCE_KIND.SERVICE,

                role:
                    SERVICE_ROLE.NETWORK,

                required:
                    false,

                stage:
                    REOPENING_STAGE.FINALIZATION,

                componentType:
                    COMPONENT_TYPE.SERVICE,

                order:
                    150,

                startMethods: [
                    "initialize",
                    "start",
                    "resume",
                    "check",
                    "activate"
                ],

                stopMethods: [
                    "pause",
                    "stop",
                    "suspend"
                ],

                healthMethods: [
                    "healthCheck",
                    "checkHealth",
                    "isOnline",
                    "getStatus",
                    "getState"
                ]
            }
        });

    /* ======================================================================
       SECTION 43
       HEALTH HELPERS
       ====================================================================== */

    function normalizeHealthScore(
        value
    ) {
        const number =
            Number(value);

        if (
            !Number.isFinite(
                number
            )
        ) {
            return null;
        }

        if (
            number >
            1 &&
            number <=
            100
        ) {
            return clamp(
                number /
                100
            );
        }

        return clamp(
            number
        );
    }

    function resolveHealthStatus(
    result
) {
    if (
        result ===
        true
    ) {
        return HEALTH_STATUS.HEALTHY;
    }

    if (
        result ===
        false
    ) {
        return HEALTH_STATUS.UNHEALTHY;
    }

    if (
        typeof result ===
        "string"
    ) {
        const rawStatus =
            result
                .trim()
                .toLowerCase();

        if (
            [
                "healthy",
                "ready",
                "running",
                "active",
                "connected",
                "available",
                "online",
                "ok",
                "success",
                "initialized",
                "started"
            ].includes(
                rawStatus
            )
        ) {
            return HEALTH_STATUS.HEALTHY;
        }

        if (
            [
                "degraded",
                "partial",
                "warning",
                "limited"
            ].includes(
                rawStatus
            )
        ) {
            return HEALTH_STATUS.DEGRADED;
        }

        if (
            [
                "failed",
                "error",
                "unhealthy",
                "offline",
                "stopped",
                "unavailable",
                "destroyed"
            ].includes(
                rawStatus
            )
        ) {
            return HEALTH_STATUS.UNHEALTHY;
        }

        return HEALTH_STATUS.UNKNOWN;
    }

    if (
        result === null ||
        typeof result !==
        "object"
    ) {
        return HEALTH_STATUS.UNKNOWN;
    }

    const rawStatus =
        String(
            result.status ||
            result.health ||
            result.state ||
            ""
        )
            .trim()
            .toLowerCase();

    if (
        [
            "healthy",
            "ready",
            "running",
            "active",
            "connected",
            "available",
            "online",
            "ok",
            "success",
            "initialized",
            "started"
        ].includes(
            rawStatus
        )
    ) {
        return HEALTH_STATUS.HEALTHY;
    }

    if (
        [
            "degraded",
            "partial",
            "warning",
            "limited"
        ].includes(
            rawStatus
        )
    ) {
        return HEALTH_STATUS.DEGRADED;
    }

    if (
        [
            "failed",
            "error",
            "unhealthy",
            "offline",
            "stopped",
            "unavailable",
            "destroyed"
        ].includes(
            rawStatus
        )
    ) {
        return HEALTH_STATUS.UNHEALTHY;
    }

    if (
        result.healthy ===
        true ||
        result.ready ===
        true ||
        result.available ===
        true ||
        result.online ===
        true
    ) {
        return HEALTH_STATUS.HEALTHY;
    }

    if (
        result.healthy ===
        false ||
        result.ready ===
        false ||
        result.available ===
        false ||
        result.online ===
        false
    ) {
        return HEALTH_STATUS.UNHEALTHY;
    }

    const score =
        normalizeHealthScore(
            result.healthScore ??
            result.score ??
            result.readinessScore
        );

    if (
        score !==
        null
    ) {
        if (
            score >=
            0.75
        ) {
            return HEALTH_STATUS.HEALTHY;
        }

        if (
            score >=
            0.4
        ) {
            return HEALTH_STATUS.DEGRADED;
        }

        return HEALTH_STATUS.UNHEALTHY;
    }

    return HEALTH_STATUS.UNKNOWN;
}

    function resolveHealthScore(
        result,
        status
    ) {
        if (
            isObjectLike(
                result
            )
        ) {
            const score =
                normalizeHealthScore(
                    result.healthScore ??
                    result.score ??
                    result.readinessScore
                );

            if (
                score !==
                null
            ) {
                return score;
            }
        }

        switch (status) {

            case HEALTH_STATUS.HEALTHY:
                return 1;

            case HEALTH_STATUS.DEGRADED:
                return 0.5;

            case HEALTH_STATUS.UNHEALTHY:
            case HEALTH_STATUS.UNAVAILABLE:
            case HEALTH_STATUS.TIMEOUT:
            case HEALTH_STATUS.ERROR:
                return 0;

            default:
                return 0.25;
        }
    }

    function sanitizeResourceRecord(
        record
    ) {
        return {

            id:
                record.id,

            key:
                record.key,

            kind:
                record.kind,

            role:
                record.role,

            required:
                record.required,

            stage:
                record.stage,

            componentType:
                record.componentType,

            order:
                record.order,

            status:
                record.status,

            registered:
                record.registered,

            registrationMethod:
                record.registrationMethod,

            dependencyAvailable:
                record.dependencyAvailable,

            globalName:
                record.globalName,

            componentId:
                record.componentId,

            serviceId:
                record.serviceId,

            sourceId:
                record.sourceId,

            createdAt:
                record.createdAt,

            error:
                deepClone(
                    record.error
                )
        };
    }

    /* ======================================================================
       SECTION 44
       ENSURE REGISTRATION STATE
       ====================================================================== */

    IntegrationClass.prototype.ensureRegistrationState =
        function ensureRegistrationState() {

            if (
                !this.state.registration
            ) {
                this.state.registration = {

                    id:
                        createId(
                            "resource_registration"
                        ),

                    status:
                        REGISTRATION_STATUS.IDLE,

                    startedAt:
                        null,

                    completedAt:
                        null,

                    durationMs:
                        0,

                    registrationCount:
                        0,

                    registeredCount:
                        0,

                    skippedCount:
                        0,

                    duplicateCount:
                        0,

                    failedCount:
                        0,

                    serviceCount:
                        0,

                    sourceCount:
                        0,

                    componentCount:
                        0,

                    healthCheckCount:
                        0,

                    records:
                        [],

                    services:
                        {},

                    sources:
                        {},

                    components:
                        {},

                    healthChecks:
                        {},

                    errors:
                        [],

                    lastError:
                        null
                };
            }

            const registration =
                this.state.registration;

            registration.records =
                safeArray(
                    registration.records
                );

            registration.errors =
                safeArray(
                    registration.errors
                );

            registration.services =
                safeObject(
                    registration.services
                );

            registration.sources =
                safeObject(
                    registration.sources
                );

            registration.components =
                safeObject(
                    registration.components
                );

            registration.healthChecks =
                safeObject(
                    registration.healthChecks
                );

            return registration;
        };

    /* ======================================================================
       SECTION 45
       RESOURCE DEFINITION RESOLUTION
       ====================================================================== */

    IntegrationClass.prototype.resolveResourceDefinition =
        function resolveResourceDefinition(
            dependencyKey,
            overrides = {}
        ) {

            const base =
                DEFAULT_RESOURCE_DEFINITIONS[
                    dependencyKey
                ] ||
                {
                    kind:
                        RESOURCE_KIND.SERVICE,

                    role:
                        SERVICE_ROLE.CUSTOM,

                    required:
                        false,

                    stage:
                        REOPENING_STAGE.ENGINES,

                    componentType:
                        COMPONENT_TYPE.SERVICE,

                    order:
                        1000,

                    startMethods: [
                        "start",
                        "initialize",
                        "resume",
                        "activate"
                    ],

                    stopMethods: [
                        "stop",
                        "pause",
                        "suspend",
                        "deactivate"
                    ],

                    healthMethods: [
                        "healthCheck",
                        "checkHealth",
                        "getStatus",
                        "getState"
                    ]
                };

            return {

                ...base,

                ...safeObject(
                    overrides
                ),

                startMethods:
                    safeArray(
                        overrides.startMethods ||
                        base.startMethods
                    ),

                stopMethods:
                    safeArray(
                        overrides.stopMethods ||
                        base.stopMethods
                    ),

                healthMethods:
                    safeArray(
                        overrides.healthMethods ||
                        base.healthMethods
                    )
            };
        };

    /* ======================================================================
       SECTION 46
       CREATE HEALTH CHECK
       ====================================================================== */

    IntegrationClass.prototype.createResourceHealthCheck =
        function createResourceHealthCheck(
            dependencyKey,
            definition = {}
        ) {

            const integration =
                this;

            const resolvedDefinition =
                this.resolveResourceDefinition(
                    dependencyKey,
                    definition
                );

            return async function resourceHealthCheck() {

                const startedAt =
                    now();

                const target =
                    integration.getDependency(
                        dependencyKey
                    );

                if (
                    !target
                ) {
                    return {

                        dependencyKey,

                        status:
                            HEALTH_STATUS.UNAVAILABLE,

                        healthy:
                            false,

                        score:
                            0,

                        startedAt,

                        completedAt:
                            now(),

                        durationMs:
                            now() -
                            startedAt,

                        message:
                            "Resource dependency is unavailable."
                    };
                }

                try {

                    const invocation =
                        await invokeFirstAvailableAsync(
                            target,
                            resolvedDefinition
                                .healthMethods,
                            [],
                            integration
                                .configuration
                                .healthCheckTimeoutMs
                        );

                    let rawResult =
                        invocation.value;

                    if (
                        invocation.invoked !==
                        true
                    ) {
                        rawResult = {
                            status:
                                "available",

                            available:
                                true
                        };
                    }

                    const status =
                        resolveHealthStatus(
                            rawResult
                        );

                    const score =
                        resolveHealthScore(
                            rawResult,
                            status
                        );

                    const completedAt =
                        now();

                    return {

                        dependencyKey,

                        status,

                        healthy:
                            status ===
                            HEALTH_STATUS.HEALTHY,

                        degraded:
                            status ===
                            HEALTH_STATUS.DEGRADED,

                        score,

                        method:
                            invocation.method,

                        startedAt,

                        completedAt,

                        durationMs:
                            completedAt -
                            startedAt,

                        raw:
                            deepClone(
                                rawResult
                            )
                    };

                } catch (error) {

                    const completedAt =
                        now();

                    const normalized =
                        normalizeError(
                            error
                        );

                    const timeout =
                        String(
                            normalized.message ||
                            ""
                        )
                            .toLowerCase()
                            .includes(
                                "timed out"
                            );

                    return {

                        dependencyKey,

                        status:
                            timeout
                                ? HEALTH_STATUS.TIMEOUT
                                : HEALTH_STATUS.ERROR,

                        healthy:
                            false,

                        score:
                            0,

                        startedAt,

                        completedAt,

                        durationMs:
                            completedAt -
                            startedAt,

                        error:
                            normalized
                    };
                }
            };
        };

    /* ======================================================================
       SECTION 47
       CREATE COMPONENT HANDLERS
       ====================================================================== */

    IntegrationClass.prototype.createResourceStartHandler =
        function createResourceStartHandler(
            dependencyKey,
            definition = {}
        ) {

            const integration =
                this;

            const resolvedDefinition =
                this.resolveResourceDefinition(
                    dependencyKey,
                    definition
                );

            return async function startResource(
                context = {}
            ) {

                const target =
                    integration.getDependency(
                        dependencyKey
                    );

                if (!target) {

                    if (
                        resolvedDefinition.required
                    ) {
                        throw new Error(
                            "Required reopening resource is unavailable: " +
                            dependencyKey
                        );
                    }

                    return {
                        status:
                            COMPONENT_STATUS.SKIPPED,

                        success:
                            true,

                        skipped:
                            true,

                        reason:
                            "Optional resource is unavailable.",

                        dependencyKey
                    };
                }

                const invocation =
                    await invokeFirstAvailableAsync(
                        target,
                        resolvedDefinition
                            .startMethods,
                        [
                            {
                                reopening:
                                    true,

                                recoveryReopening:
                                    true,

                                integrationId:
                                    integration.id,

                                dependencyKey,

                                context:
                                    safeObject(
                                        context
                                    )
                            }
                        ],
                        integration
                            .configuration
                            .startupTimeoutMs
                    );

                if (
                    invocation.invoked !==
                    true
                ) {
                    return {
                        status:
                            COMPONENT_STATUS.COMPLETED,

                        success:
                            true,

                        dependencyKey,

                        method:
                            "availability_only",

                        message:
                            "Resource is available and does not expose a start method."
                    };
                }

                const result =
                    await Promise.resolve(
                        invocation.value
                    );

                if (
                    result ===
                    false ||
                    result?.success ===
                    false ||
                    result?.status ===
                    "failed"
                ) {
                    throw new Error(
                        result?.message ||
                        "Resource reopening failed: " +
                        dependencyKey
                    );
                }

                return {
                    status:
                        COMPONENT_STATUS.COMPLETED,

                    success:
                        true,

                    dependencyKey,

                    method:
                        invocation.method,

                    result:
                        deepClone(
                            result
                        )
                };
            };
        };

    IntegrationClass.prototype.createResourceRollbackHandler =
        function createResourceRollbackHandler(
            dependencyKey,
            definition = {}
        ) {

            const integration =
                this;

            const resolvedDefinition =
                this.resolveResourceDefinition(
                    dependencyKey,
                    definition
                );

            return async function rollbackResource(
                context = {}
            ) {

                const target =
                    integration.getDependency(
                        dependencyKey
                    );

                if (!target) {
                    return {
                        success:
                            true,

                        skipped:
                            true,

                        dependencyKey
                    };
                }

                const invocation =
                    await invokeFirstAvailableAsync(
                        target,
                        resolvedDefinition
                            .stopMethods,
                        [
                            {
                                rollback:
                                    true,

                                integrationId:
                                    integration.id,

                                dependencyKey,

                                context:
                                    safeObject(
                                        context
                                    )
                            }
                        ],
                        integration
                            .configuration
                            .connectionTimeoutMs
                    );

                return {

                    success:
                        true,

                    dependencyKey,

                    method:
                        invocation.method ||
                        "none",

                    result:
                        deepClone(
                            invocation.value
                        )
                };
            };
        };

    /* ======================================================================
       SECTION 48
       REGISTER SERVICE
       ====================================================================== */

    IntegrationClass.prototype.registerReopeningService =
        function registerReopeningService(
            dependencyKey,
            options = {}
        ) {

            const registration =
                this.ensureRegistrationState();

            const definition =
                this.resolveResourceDefinition(
                    dependencyKey,
                    options
                );

            const target =
                options.target ||
                this.getDependency(
                    dependencyKey
                );

            const existing =
                registration.services[
                    dependencyKey
                ];

            if (
                existing &&
                options.replace !==
                true
            ) {
                registration.duplicateCount +=
                    1;

                return {
                    registered:
                        false,

                    duplicate:
                        true,

                    record:
                        sanitizeResourceRecord(
                            existing
                        )
                };
            }

            const record = {

                id:
                    createId(
                        "reopening_service_registration"
                    ),

                key:
                    dependencyKey,

                kind:
                    RESOURCE_KIND.SERVICE,

                role:
                    definition.role,

                required:
                    definition.required ===
                    true,

                stage:
                    definition.stage,

                componentType:
                    definition.componentType,

                order:
                    definition.order,

                status:
                    RESOURCE_STATUS.PENDING,

                registered:
                    false,

                registrationMethod:
                    null,

                dependencyAvailable:
                    Boolean(target),

                globalName:
                    this.state
                        .dependencies[
                            dependencyKey
                        ]?.globalName ||
                    null,

                componentId:
                    null,

                serviceId:
                    null,

                sourceId:
                    null,

                createdAt:
                    now(),

                error:
                    null
            };

            try {

                if (!target) {

                    record.status =
                        RESOURCE_STATUS.SKIPPED;

                    registration.skippedCount +=
                        1;

                    registration.records.push(
                        record
                    );

                    registration.services[
                        dependencyKey
                    ] =
                        record;

                    return {
                        registered:
                            false,

                        skipped:
                            true,

                        record:
                            sanitizeResourceRecord(
                                record
                            )
                    };
                }

                const service = {

    id:
        createId(
            "reopening_service"
        ),

    key:
        dependencyKey,

    name:
        options.name ||
        dependencyKey,

    role:
        definition.role,

    target,

    required:
        definition.required ===
        true,

    stage:
        definition.stage,

    executor:
        this.createResourceStartHandler(
            dependencyKey,
            definition
        ),

    rollback:
        this.createResourceRollbackHandler(
            dependencyKey,
            definition
        ),

    verifier:
        async () => {

            const result =
                await this.createResourceHealthCheck(
                    dependencyKey,
                    definition
                )();

            return {
                success:
                    result.healthy === true ||
                    result.degraded === true,

                message:
                    result.message ||
                    null,

                details:
                    result
            };
        },

    metadata: {
        category:
            this.state
                .dependencies[
                    dependencyKey
                ]?.category ||
            ENGINE_CATEGORY.CUSTOM,

        globalName:
            record.globalName,

        integrationId:
            this.id,

        ...safeObject(
            options.metadata
        )
    }
};
                const invocation =
                    invokeFirstAvailable(
                        this.reopening,
                        [
                            "registerReopeningService",
                            "registerService"
                        ],
                        service
                    );

                record.serviceId =
                    service.id;

                record.registrationMethod =
                    invocation.invoked
                        ? invocation.method
                        : "integration_registry";

                record.status =
                    RESOURCE_STATUS.REGISTERED;

                record.registered =
                    true;

                registration.services[
                    dependencyKey
                ] = {
                    ...record,
                    service
                };

                registration.records.push(
                    registration.services[
                        dependencyKey
                    ]
                );

                registration.registeredCount +=
                    1;

                registration.serviceCount +=
                    1;

                return {
                    registered:
                        true,

                    service:
                        deepClone({
                            id:
                                service.id,

                            key:
                                service.key,

                            name:
                                service.name,

                            role:
                                service.role,

                            required:
                                service.required,

                            metadata:
                                service.metadata
                        }),

                    record:
                        sanitizeResourceRecord(
                            registration.services[
                                dependencyKey
                            ]
                        )
                };

            } catch (error) {

                record.status =
                    RESOURCE_STATUS.FAILED;

                record.error =
                    normalizeError(
                        error
                    );

                registration.failedCount +=
                    1;

                registration.records.push(
                    record
                );

                registration.services[
                    dependencyKey
                ] =
                    record;

                return {
                    registered:
                        false,

                    error:
                        record.error,

                    record:
                        sanitizeResourceRecord(
                            record
                        )
                };
            }
        };

    /* ======================================================================
       SECTION 49
       REGISTER SOURCE
       ====================================================================== */

    IntegrationClass.prototype.registerReopeningSource =
        function registerReopeningSource(
            dependencyKey,
            options = {}
        ) {

            const registration =
                this.ensureRegistrationState();

            const definition =
                this.resolveResourceDefinition(
                    dependencyKey,
                    {
                        ...safeObject(
                            options
                        ),

                        kind:
                            RESOURCE_KIND.SOURCE
                    }
                );

            const target =
                options.target ||
                this.getDependency(
                    dependencyKey
                );

            const existing =
                registration.sources[
                    dependencyKey
                ];

            if (
                existing &&
                options.replace !==
                true
            ) {
                registration.duplicateCount +=
                    1;

                return {
                    registered:
                        false,

                    duplicate:
                        true,

                    record:
                        sanitizeResourceRecord(
                            existing
                        )
                };
            }

            const record = {

                id:
                    createId(
                        "reopening_source_registration"
                    ),

                key:
                    dependencyKey,

                kind:
                    RESOURCE_KIND.SOURCE,

                role:
                    definition.role,

                required:
                    definition.required ===
                    true,

                stage:
                    definition.stage,

                componentType:
                    definition.componentType,

                order:
                    definition.order,

                status:
                    RESOURCE_STATUS.PENDING,

                registered:
                    false,

                registrationMethod:
                    null,

                dependencyAvailable:
                    Boolean(target),

                globalName:
                    this.state
                        .dependencies[
                            dependencyKey
                        ]?.globalName ||
                    null,

                componentId:
                    null,

                serviceId:
                    null,

                sourceId:
                    null,

                createdAt:
                    now(),

                error:
                    null
            };

            try {

                if (!target) {

                    record.status =
                        RESOURCE_STATUS.SKIPPED;

                    registration.skippedCount +=
                        1;

                    registration.records.push(
                        record
                    );

                    registration.sources[
                        dependencyKey
                    ] =
                        record;

                    return {
                        registered:
                            false,

                        skipped:
                            true,

                        record:
                            sanitizeResourceRecord(
                                record
                            )
                    };
                }

                const source = {

                    id:
                        createId(
                            "reopening_source"
                        ),

                    key:
                        dependencyKey,

                    name:
                        options.name ||
                        dependencyKey,

                    role:
                        definition.role,

                    target,

                    required:
                        definition.required ===
                        true,
                       stage:
        definition.stage,

    executor:
        this.createResourceStartHandler(
            dependencyKey,
            definition
        ),

    rollback:
        this.createResourceRollbackHandler(
            dependencyKey,
            definition
        ),

    verifier:
        async () => {

            const result =
                await this.createResourceHealthCheck(
                    dependencyKey,
                    definition
                )();

            return {
                success:
                    result.healthy === true ||
                    result.degraded === true,

                message:
                    result.message ||
                    null,

                details:
                    result
            };
        },


                    refresh:
                        async (
                            context = {}
                        ) => {

                            const invocation =
                                await invokeFirstAvailableAsync(
                                    target,
                                    [
                                        "refresh",
                                        "update",
                                        "fetch",
                                        "load",
                                        "connect",
                                        "initialize"
                                    ],
                                    [
                                        context
                                    ],
                                    this.configuration
                                        .connectionTimeoutMs
                                );

                            return invocation.value;
                        },

                    metadata: {
                        category:
                            this.state
                                .dependencies[
                                    dependencyKey
                                ]?.category ||
                            ENGINE_CATEGORY.SOURCE,

                        globalName:
                            record.globalName,

                        integrationId:
                            this.id,

                        ...safeObject(
                            options.metadata
                        )
                    }
                };

                const invocation =
                    invokeFirstAvailable(
                        this.reopening,
                        [
                            "registerReopeningSource",
                            "registerSource"
                        ],
                        source
                    );

                record.sourceId =
                    source.id;

                record.registrationMethod =
                    invocation.invoked
                        ? invocation.method
                        : "integration_registry";

                record.status =
                    RESOURCE_STATUS.REGISTERED;

                record.registered =
                    true;

                registration.sources[
                    dependencyKey
                ] = {
                    ...record,
                    source
                };

                registration.records.push(
                    registration.sources[
                        dependencyKey
                    ]
                );

                registration.registeredCount +=
                    1;

                registration.sourceCount +=
                    1;

                return {
                    registered:
                        true,

                    source:
                        deepClone({
                            id:
                                source.id,

                            key:
                                source.key,

                            name:
                                source.name,

                            role:
                                source.role,

                            required:
                                source.required,

                            metadata:
                                source.metadata
                        }),

                    record:
                        sanitizeResourceRecord(
                            registration.sources[
                                dependencyKey
                            ]
                        )
                };

            } catch (error) {

                record.status =
                    RESOURCE_STATUS.FAILED;

                record.error =
                    normalizeError(
                        error
                    );

                registration.failedCount +=
                    1;

                registration.records.push(
                    record
                );

                registration.sources[
                    dependencyKey
                ] =
                    record;

                return {
                    registered:
                        false,

                    error:
                        record.error,

                    record:
                        sanitizeResourceRecord(
                            record
                        )
                };
            }
        };

    /* ======================================================================
       SECTION 50
       REGISTER REOPENING COMPONENT
       ====================================================================== */

    IntegrationClass.prototype.registerResourceComponent =
        function registerResourceComponent(
            dependencyKey,
            options = {}
        ) {

            const registration =
                this.ensureRegistrationState();

            const definition =
                this.resolveResourceDefinition(
                    dependencyKey,
                    options
                );

            const existing =
                registration.components[
                    dependencyKey
                ];

            if (
                existing &&
                options.replace !==
                true
            ) {
                registration.duplicateCount +=
                    1;

                return {
                    registered:
                        false,

                    duplicate:
                        true,

                    record:
                        sanitizeResourceRecord(
                            existing
                        )
                };
            }

            const dependency =
                this.state.dependencies[
                    dependencyKey
                ];

            const record = {

                id:
                    createId(
                        "resource_component_registration"
                    ),

                key:
                    dependencyKey,

                kind:
                    RESOURCE_KIND.COMPONENT,

                role:
                    definition.role,

                required:
                    definition.required ===
                    true,

                stage:
                    definition.stage,

                componentType:
                    definition.componentType,

                order:
                    definition.order,

                status:
                    RESOURCE_STATUS.PENDING,

                registered:
                    false,

                registrationMethod:
                    null,

                dependencyAvailable:
                    Boolean(
                        dependency?.target
                    ),

                globalName:
                    dependency?.globalName ||
                    null,

                componentId:
                    null,

                serviceId:
                    null,

                sourceId:
                    null,

                createdAt:
                    now(),

                error:
                    null
            };

            try {

                if (
                    !dependency?.target &&
                    definition.required !==
                    true
                ) {
                    record.status =
                        RESOURCE_STATUS.SKIPPED;

                    registration.skippedCount +=
                        1;

                    registration.records.push(
                        record
                    );

                    registration.components[
                        dependencyKey
                    ] =
                        record;

                    return {
                        registered:
                            false,

                        skipped:
                            true,

                        record:
                            sanitizeResourceRecord(
                                record
                            )
                    };
                }

                const componentDefinition = {

                    id:
                        options.componentId ||
                        "reopening_component_" +
                        dependencyKey,

                    name:
                        options.name ||
                        dependencyKey,

                    type:
                        definition.componentType,

                    stage:
                        definition.stage,

                    required:
                        definition.required ===
                        true,

                    enabled:
                        options.enabled !==
                        false,

                    priority:
                        toFiniteNumber(
                            options.priority,
                            definition.order
                        ),

                    order:
                        toFiniteNumber(
                            options.order,
                            definition.order
                        ),

                    executionMode:
                        options.executionMode ||
                        EXECUTION_MODE.SEQUENTIAL,

                    dependencies:
                        safeArray(
                            options.dependencies
                        ),

                    maxRetries:
                        Math.max(
                            0,
                            Math.round(
                                toFiniteNumber(
                                    options.maxRetries,
                                    this.configuration
                                        .retryCount
                                )
                            )
                        ),

                    retryDelayMs:
                        Math.max(
                            0,
                            toFiniteNumber(
                                options.retryDelayMs,
                                this.configuration
                                    .retryDelayMs
                            )
                        ),

                    timeoutMs:
                        Math.max(
                            1000,
                            toFiniteNumber(
                                options.timeoutMs,
                                this.configuration
                                    .startupTimeoutMs
                            )
                        ),

                   executor:
                        this.createResourceStartHandler(
                            dependencyKey,
                            definition
                        ),

                    rollback:
                        this.createResourceRollbackHandler(
                            dependencyKey,
                            definition
                        ),

                    healthCheck:
                        this.createResourceHealthCheck(
                            dependencyKey,
                            definition
                        ),

                    metadata: {
                        dependencyKey,

                        role:
                            definition.role,

                        globalName:
                            dependency?.globalName ||
                            null,

                        category:
                            dependency?.category ||
                            ENGINE_CATEGORY.CUSTOM,

                        integrationId:
                            this.id,

                        ...safeObject(
                            options.metadata
                        )
                    }
                };

                const invocation =
                    invokeFirstAvailable(
                        this.reopening,
                        [
                            "registerReopeningComponent",
                            "registerComponent"
                        ],
                        componentDefinition
                    );

                if (
                    invocation.invoked !==
                    true
                ) {
                    throw new Error(
                        "RecoveryReopeningV32 component registration API is unavailable."
                    );
                }

                record.componentId =
                    componentDefinition.id;

                record.registrationMethod =
                    invocation.method;

                record.status =
                    RESOURCE_STATUS.REGISTERED;

                record.registered =
                    true;

                registration.components[
                    dependencyKey
                ] = {
                    ...record,
                    component:
                        componentDefinition
                };

                registration.records.push(
                    registration.components[
                        dependencyKey
                    ]
                );

                registration.registeredCount +=
                    1;

                registration.componentCount +=
                    1;

                return {
                    registered:
                        true,

                    componentId:
                        componentDefinition.id,

                    record:
                        sanitizeResourceRecord(
                            registration.components[
                                dependencyKey
                            ]
                        )
                };

            } catch (error) {

                record.status =
                    RESOURCE_STATUS.FAILED;

                record.error =
                    normalizeError(
                        error
                    );

                registration.failedCount +=
                    1;

                registration.records.push(
                    record
                );

                registration.components[
                    dependencyKey
                ] =
                    record;

                return {
                    registered:
                        false,

                    error:
                        record.error,

                    record:
                        sanitizeResourceRecord(
                            record
                        )
                };
            }
        };

    /* ======================================================================
       SECTION 51
       REGISTER HEALTH CHECK
       ====================================================================== */

    IntegrationClass.prototype.registerResourceHealthCheck =
        function registerResourceHealthCheck(
            dependencyKey,
            options = {}
        ) {

            const registration =
                this.ensureRegistrationState();

            const definition =
                this.resolveResourceDefinition(
                    dependencyKey,
                    options
                );

            const check =
                this.createResourceHealthCheck(
                    dependencyKey,
                    definition
                );

            const id =
                options.id ||
                "health_check_" +
                dependencyKey;

            registration.healthChecks[
                dependencyKey
            ] = {

                id,

                dependencyKey,

                required:
                    definition.required ===
                    true,

                check,

                createdAt:
                    now(),

                lastResult:
                    null,

                lastRunAt:
                    null,

                runCount:
                    0
            };

            registration.healthCheckCount +=
                1;

            return {

                registered:
                    true,

                id,

                dependencyKey,

                required:
                    definition.required ===
                    true
            };
        };

    /* ======================================================================
       SECTION 52
       REGISTER SINGLE RESOURCE
       ====================================================================== */

    IntegrationClass.prototype.registerReopeningResource =
        function registerReopeningResource(
            dependencyKey,
            options = {}
        ) {

            const definition =
                this.resolveResourceDefinition(
                    dependencyKey,
                    options
                );

            const results = {

                dependencyKey,

                service:
                    null,

                source:
                    null,

                component:
                    null,

                healthCheck:
                    null
            };

            if (
                definition.kind ===
                RESOURCE_KIND.SOURCE
            ) {
                results.source =
                    this.registerReopeningSource(
                        dependencyKey,
                        definition
                    );
            } else {
                results.service =
                    this.registerReopeningService(
                        dependencyKey,
                        definition
                    );
            }

            results.component =
                this.registerResourceComponent(
                    dependencyKey,
                    definition
                );

            results.healthCheck =
                this.registerResourceHealthCheck(
                    dependencyKey,
                    definition
                );

            return results;
        };

    /* ======================================================================
       SECTION 53
       REGISTER DEFAULT RESOURCES
       ====================================================================== */

    IntegrationClass.prototype.registerDefaultReopeningResources =
        function registerDefaultReopeningResources(
            options = {}
        ) {

            if (
                !isValidReopeningInstance(
                    this.reopening
                )
            ) {
                throw new Error(
                    "Recovery reopening instance must be connected before resource registration."
                );
            }

            const registration =
                this.ensureRegistrationState();

            const startedAt =
                now();

            registration.status =
                REGISTRATION_STATUS.REGISTERING;

            registration.startedAt =
                startedAt;

            registration.completedAt =
                null;

            registration.lastError =
                null;

            registration.registrationCount +=
                1;

            const safeOptions =
                safeObject(options);

            const excluded =
                new Set(
                    safeArray(
                        safeOptions.exclude
                    )
                );

            const included =
                safeArray(
                    safeOptions.include
                );

            const resourceKeys =
                included.length >
                0
                    ? included
                    : Object.keys(
                        DEFAULT_RESOURCE_DEFINITIONS
                    );

            const results = [];

            try {

                for (
                    const dependencyKey of
                    resourceKeys
                ) {
                    if (
                        excluded.has(
                            dependencyKey
                        )
                    ) {
                        continue;
                    }

                    const overrides =
                        safeObject(
                            safeOptions.resources?.[
                                dependencyKey
                            ]
                        );

                    results.push(
                        this.registerReopeningResource(
                            dependencyKey,
                            overrides
                        )
                    );
                }

                registration.completedAt =
                    now();

                registration.durationMs =
                    registration.completedAt -
                    registration.startedAt;

                if (
                    registration.failedCount >
                    0
                ) {
                    registration.status =
                        registration.registeredCount >
                        0
                            ? REGISTRATION_STATUS.PARTIAL
                            : REGISTRATION_STATUS.FAILED;
                } else if (
                    registration.skippedCount >
                    0
                ) {
                    registration.status =
                        REGISTRATION_STATUS.PARTIAL;
                } else {
                    registration.status =
                        REGISTRATION_STATUS.REGISTERED;
                }

                return {

                    status:
                        registration.status,

                    registered:
                        registration.registeredCount,

                    skipped:
                        registration.skippedCount,

                    failed:
                        registration.failedCount,

                    services:
                        registration.serviceCount,

                    sources:
                        registration.sourceCount,

                    components:
                        registration.componentCount,

                    healthChecks:
                        registration.healthCheckCount,

                    durationMs:
                        registration.durationMs,

                    results:
                        deepClone(
                            results
                        )
                };

            } catch (error) {

                const normalized =
                    normalizeError(
                        error
                    );

                registration.status =
                    REGISTRATION_STATUS.FAILED;

                registration.completedAt =
                    now();

                registration.durationMs =
                    registration.completedAt -
                    registration.startedAt;

                registration.lastError =
                    normalized;

                registration.errors.push({

                    id:
                        createId(
                            "registration_error"
                        ),

                    timestamp:
                        now(),

                    error:
                        normalized
                });

                this.state.errorCount +=
                    1;

                this.state.lastError =
                    normalized;

                return {

                    status:
                        registration.status,

                    registered:
                        registration.registeredCount,

                    skipped:
                        registration.skippedCount,

                    failed:
                        registration.failedCount,

                    error:
                        normalized
                };
            }
        };

    /* ======================================================================
       SECTION 54
       EXECUTE HEALTH CHECK
       ====================================================================== */

    IntegrationClass.prototype.runResourceHealthCheck =
        async function runResourceHealthCheck(
            dependencyKey
        ) {

            const registration =
                this.ensureRegistrationState();

            const record =
                registration.healthChecks[
                    dependencyKey
                ];

            if (
                !record ||
                typeof record.check !==
                "function"
            ) {
                return {

                    dependencyKey,

                    status:
                        HEALTH_STATUS.UNAVAILABLE,

                    healthy:
                        false,

                    score:
                        0,

                    message:
                        "Health check is not registered."
                };
            }

            const result =
                await record.check();

            record.lastResult =
                deepClone(
                    result
                );

            record.lastRunAt =
                now();

            record.runCount +=
                1;

            return deepClone(
                result
            );
        };

    /* ======================================================================
       SECTION 55
       RUN ALL HEALTH CHECKS
       ====================================================================== */

   IntegrationClass.prototype.runAllResourceHealthChecks =
    async function runAllResourceHealthChecks(
        options = {}
    ) {

        const registration =
            this.ensureRegistrationState();

        const safeOptions =
            safeObject(options);

        const keys =
            Object.keys(
                registration.healthChecks
            );

        const results = [];

        const runCheck =
            async (
                dependencyKey
            ) => {

                const checkResult =
                    await this
                        .runResourceHealthCheck(
                            dependencyKey
                        );

                results.push(
                    checkResult
                );
            };

        if (
            safeOptions.parallel !==
            false
        ) {
            await Promise.all(
                keys.map(
                    runCheck
                )
            );
        } else {
            for (
                const key of
                keys
            ) {
                await runCheck(
                    key
                );
            }
        }

        const requiredResults =
            results.filter(
                (result) => {
                    const check =
                        registration
                            .healthChecks[
                                result.dependencyKey
                            ];

                    return (
                        check?.required ===
                        true
                    );
                }
            );

        const optionalResults =
            results.filter(
                (result) => {
                    const check =
                        registration
                            .healthChecks[
                                result.dependencyKey
                            ];

                    return (
                        check?.required !==
                        true
                    );
                }
            );

        const healthy =
            results.filter(
                (result) => {
                    return (
                        result.status ===
                        HEALTH_STATUS.HEALTHY
                    );
                }
            ).length;

        const degraded =
            results.filter(
                (result) => {
                    return (
                        result.status ===
                        HEALTH_STATUS.DEGRADED
                    );
                }
            ).length;

        const unhealthy =
            results.filter(
                (result) => {
                    return [
                        HEALTH_STATUS.UNHEALTHY,
                        HEALTH_STATUS.UNAVAILABLE,
                        HEALTH_STATUS.TIMEOUT,
                        HEALTH_STATUS.ERROR
                    ].includes(
                        result.status
                    );
                }
            ).length;

        const requiredHealthy =
            requiredResults.filter(
                (result) => {
                    return (
                        result.status ===
                        HEALTH_STATUS.HEALTHY
                    );
                }
            ).length;

        const requiredDegraded =
            requiredResults.filter(
                (result) => {
                    return (
                        result.status ===
                        HEALTH_STATUS.DEGRADED
                    );
                }
            ).length;

        const requiredFailures =
            requiredResults.filter(
                (result) => {
                    return [
                        HEALTH_STATUS.UNHEALTHY,
                        HEALTH_STATUS.UNAVAILABLE,
                        HEALTH_STATUS.TIMEOUT,
                        HEALTH_STATUS.ERROR,
                        HEALTH_STATUS.UNKNOWN
                    ].includes(
                        result.status
                    );
                }
            );

        const requiredScore =
            requiredResults.length >
            0
                ? requiredResults.reduce(
                    (
                        total,
                        result
                    ) => {
                        return (
                            total +
                            toFiniteNumber(
                                result.score,
                                0
                            )
                        );
                    },
                    0
                ) /
                requiredResults.length
                : 1;

        let overallStatus =
            HEALTH_STATUS.HEALTHY;

        if (
            requiredFailures.length >
            0
        ) {
            overallStatus =
                HEALTH_STATUS.UNHEALTHY;
        } else if (
            requiredDegraded >
            0
        ) {
            overallStatus =
                HEALTH_STATUS.DEGRADED;
        }

        return {

            status:
                overallStatus,

            healthy:
                requiredFailures.length ===
                0,

            score:
                clamp(
                    requiredScore
                ),

            scorePercentage:
                Math.round(
                    clamp(
                        requiredScore
                    ) *
                    10000
                ) /
                100,

            total:
                results.length,

            healthyCount:
                healthy,

            degradedCount:
                degraded,

            unhealthyCount:
                unhealthy,

            requiredTotal:
                requiredResults.length,

            requiredHealthyCount:
                requiredHealthy,

            requiredDegradedCount:
                requiredDegraded,

            optionalTotal:
                optionalResults.length,

            requiredFailureCount:
                requiredFailures.length,

            requiredFailures:
                deepClone(
                    requiredFailures
                ),

            results:
                deepClone(
                    results
                ),

            completedAt:
                now()
        };
    };

    /* ======================================================================
       SECTION 56
       BUILD COMPONENT DEPENDENCIES
       ====================================================================== */

    IntegrationClass.prototype.installDefaultComponentDependencies =
        function installDefaultComponentDependencies() {

            const registration =
                this.ensureRegistrationState();

            const dependencyChains = {

                sourceEngine:
                    [],

                storageEngine: [
                    "reopening_component_sourceEngine"
                ],

                radarEngine: [
                    "reopening_component_sourceEngine"
                ],

                lightningEngine: [
                    "reopening_component_sourceEngine"
                ],

                forecastEngine: [
                    "reopening_component_sourceEngine",
                    "reopening_component_storageEngine"
                ],

                arrivalEngine: [
                    "reopening_component_forecastEngine"
                ],

                stormTrackingEngine: [
                    "reopening_component_radarEngine"
                ],

                pathPredictionEngine: [
                    "reopening_component_stormTrackingEngine"
                ],

                aiEngine: [
                    "reopening_component_forecastEngine",
                    "reopening_component_arrivalEngine"
                ],

                verificationEngine: [
                    "reopening_component_forecastEngine",
                    "reopening_component_arrivalEngine"
                ],

                monitoringEngine: [
                    "reopening_component_verificationEngine"
                ],

                notificationEngine: [
                    "reopening_component_monitoringEngine"
                ],

                dashboardEngine: [
                    "reopening_component_forecastEngine",
                    "reopening_component_arrivalEngine"
                ],

                networkEngine:
                    []
            };

            let updated =
                0;

            Object.entries(
                dependencyChains
            ).forEach(
                ([
                    dependencyKey,
                    dependencies
                ]) => {

                    const registrationRecord =
                        registration.components[
                            dependencyKey
                        ];

                    const component =
                        registrationRecord
                            ?.component;

                    if (!component) {
                        return;
                    }

                    const availableDependencies =
                        dependencies.filter(
                            (componentId) => {

                                return Object.values(
                                    registration.components
                                ).some(
                                    (record) => {
                                        return (
                                            record.componentId ===
                                            componentId &&
                                            record.registered ===
                                            true
                                        );
                                    }
                                );
                            }
                        );

                    component.dependencies =
                        availableDependencies;

                    updated +=
                        1;
                }
            );

            return {

                updated,

                dependencyChains:
                    deepClone(
                        dependencyChains
                    )
            };
        };

    /* ======================================================================
       SECTION 57
       BUILD REOPENING PLAN AFTER REGISTRATION
       ====================================================================== */

    IntegrationClass.prototype.buildRegisteredReopeningPlan =
        function buildRegisteredReopeningPlan(
            options = {}
        ) {

            if (
                !isValidReopeningInstance(
                    this.reopening
                )
            ) {
                return {
                    built:
                        false,

                    reason:
                        "Reopening instance is unavailable."
                };
            }

            this.installDefaultComponentDependencies();

            const invocation =
                invokeFirstAvailable(
                    this.reopening,
                    [
                        "buildReopeningPlan"
                    ],
                    options
                );

            if (
                invocation.invoked !==
                true
            ) {
                return {
                    built:
                        false,

                    reason:
                        "Reopening plan API is unavailable."
                };
            }

            return {

                built:
                    true,

                method:
                    invocation.method,

                plan:
                    deepClone(
                        invocation.value
                    )
            };
        };

    /* ======================================================================
       SECTION 58
       REGISTER AND PREPARE
       ====================================================================== */

    IntegrationClass.prototype.registerAndPrepareReopening =
        async function registerAndPrepareReopening(
            options = {}
        ) {

            const safeOptions =
                safeObject(options);

            if (
                !this.isConnected()
            ) {
                const connection =
                    await this.connect(
                        safeOptions.connection ||
                        {}
                    );

                if (
                    connection.connected !==
                    true
                ) {
                    return {
                        prepared:
                            false,

                        phase:
                            "connection",

                        connection
                    };
                }
            }

            const registration =
                this.registerDefaultReopeningResources(
                    safeOptions.registration ||
                    {}
                );

            const plan =
                this.buildRegisteredReopeningPlan(
                    safeOptions.plan ||
                    {}
                );

            const health =
                safeOptions.runHealthChecks ===
                false
                    ? null
                    : await this
                        .runAllResourceHealthChecks(
                            safeOptions.health ||
                            {}
                        );

            const prepared =
                registration.status !==
                REGISTRATION_STATUS.FAILED &&
                plan.built ===
                true &&
                (
                    !health ||
                    health.requiredFailureCount ===
                    0
                );

            this.state.status =
                prepared
                    ? ADAPTER_STATUS.CONNECTED
                    : ADAPTER_STATUS.DEGRADED;

            return {

                prepared,

                connection:
                    this.getConnectionStatus(),

                registration,

                plan,

                health,

                completedAt:
                    now()
            };
        };

    /* ======================================================================
       SECTION 59
       GET REGISTRATION STATUS
       ====================================================================== */

    IntegrationClass.prototype.getRegistrationStatus =
        function getRegistrationStatus() {

            const registration =
                this.ensureRegistrationState();

            return deepClone({

                id:
                    registration.id,

                status:
                    registration.status,

                startedAt:
                    registration.startedAt,

                completedAt:
                    registration.completedAt,

                durationMs:
                    registration.durationMs,

                registrationCount:
                    registration.registrationCount,

                registeredCount:
                    registration.registeredCount,

                skippedCount:
                    registration.skippedCount,

                duplicateCount:
                    registration.duplicateCount,

                failedCount:
                    registration.failedCount,

                serviceCount:
                    registration.serviceCount,

                sourceCount:
                    registration.sourceCount,

                componentCount:
                    registration.componentCount,

                healthCheckCount:
                    registration.healthCheckCount,

                records:
                    registration.records
                        .map(
                            sanitizeResourceRecord
                        ),

                lastError:
                    registration.lastError,

                errorCount:
                    registration.errors.length
            });
        };

    /* ======================================================================
       SECTION 60
       CLEAR REGISTRATION
       ====================================================================== */

    IntegrationClass.prototype.clearReopeningRegistrations =
        function clearReopeningRegistrations() {

            const registration =
                this.ensureRegistrationState();

            const cleared = {

                services:
                    Object.keys(
                        registration.services
                    ).length,

                sources:
                    Object.keys(
                        registration.sources
                    ).length,

                components:
                    Object.keys(
                        registration.components
                    ).length,

                healthChecks:
                    Object.keys(
                        registration.healthChecks
                    ).length
            };

            registration.status =
                REGISTRATION_STATUS.CLEARED;

            registration.records =
                [];

            registration.services =
                {};

            registration.sources =
                {};

            registration.components =
                {};

            registration.healthChecks =
                {};

            registration.registeredCount =
                0;

            registration.skippedCount =
                0;

            registration.duplicateCount =
                0;

            registration.failedCount =
                0;

            registration.serviceCount =
                0;

            registration.sourceCount =
                0;

            registration.componentCount =
                0;

            registration.healthCheckCount =
                0;

            return {
                cleared,
                timestamp:
                    now()
            };
        };

    /* ======================================================================
       SECTION 61
       INITIALIZE RESOURCES
       ====================================================================== */

    IntegrationClass.prototype.initializeResources =
        async function initializeResources(
            options = {}
        ) {

            const safeOptions =
                safeObject(options);

            if (
                safeOptions.rediscover ===
                true
            ) {
                this.discoverDependencies();
            }

            if (
                !this.isConnected()
            ) {
                await this.connect(
                    safeOptions.connection ||
                    {}
                );
            }

            if (
                this.configuration
                    .autoRegisterComponents ===
                false &&
                safeOptions.register !==
                true
            ) {
                return {
                    initialized:
                        this.isConnected(),

                    connection:
                        this.getConnectionStatus(),

                    registration:
                        this.getRegistrationStatus()
                };
            }

            const preparation =
                await this
                    .registerAndPrepareReopening(
                        safeOptions
                    );

            return {
                initialized:
                    preparation.prepared,

                ...preparation
            };
        };

    /* ======================================================================
       SECTION 62
       COMPATIBILITY ALIASES
       ====================================================================== */

    IntegrationClass.prototype.registerResources =
        IntegrationClass.prototype
            .registerDefaultReopeningResources;

    IntegrationClass.prototype.registerResource =
        IntegrationClass.prototype
            .registerReopeningResource;

    IntegrationClass.prototype.registerService =
        IntegrationClass.prototype
            .registerReopeningService;

    IntegrationClass.prototype.registerSource =
        IntegrationClass.prototype
            .registerReopeningSource;

    IntegrationClass.prototype.registerComponent =
        IntegrationClass.prototype
            .registerResourceComponent;

    IntegrationClass.prototype.registerHealthCheck =
        IntegrationClass.prototype
            .registerResourceHealthCheck;

    IntegrationClass.prototype.runHealthCheck =
        IntegrationClass.prototype
            .runResourceHealthCheck;

    IntegrationClass.prototype.runHealthChecks =
        IntegrationClass.prototype
            .runAllResourceHealthChecks;

    IntegrationClass.prototype.prepareReopening =
        IntegrationClass.prototype
            .registerAndPrepareReopening;

    IntegrationClass.prototype.getResourcesStatus =
        IntegrationClass.prototype
            .getRegistrationStatus;

    /* ======================================================================
       SECTION 63
       PART 3 EXPORT
       ====================================================================== */

    global.RecoveryReopeningIntegrationV32Part3 = {

        REGISTRATION_STATUS,

        RESOURCE_KIND,

        RESOURCE_STATUS,

        HEALTH_STATUS,

        SERVICE_ROLE,

        DEFAULT_RESOURCE_DEFINITIONS,

        normalizeHealthScore,

        resolveHealthStatus,

        resolveHealthScore,

        sanitizeResourceRecord
    };

})(window);

/* ==========================================================================
   RainGuard AI
   Long Horizon Forecast Engine V32

   Recovery Reopening Integration V32

   PART 4
   Automatic Reopening + Recovery Event Binding +
   Monitoring Lifecycle + Execution Control
   ========================================================================== */

(function extendRecoveryReopeningIntegrationV32Part4(global) {
    "use strict";

    /* ======================================================================
       SECTION 64
       DEPENDENCY RESOLUTION
       ====================================================================== */

    const IntegrationClass =
        global.RecoveryReopeningIntegrationV32;

    const IntegrationConstants =
        global.RecoveryReopeningIntegrationV32Constants;

    const IntegrationPart2 =
        global.RecoveryReopeningIntegrationV32Part2;

    const IntegrationPart3 =
        global.RecoveryReopeningIntegrationV32Part3;

    const RecoveryReopeningConstants =
        global.RecoveryReopeningV32Constants;

    const RecoveryReopeningUtils =
        global.RecoveryReopeningV32Utils;

    const RecoveryReopeningPart2 =
        global.RecoveryReopeningV32Part2;

    const RecoveryReopeningPart4 =
        global.RecoveryReopeningV32Part4;

    if (
        typeof IntegrationClass !== "function" ||
        !IntegrationConstants ||
        !IntegrationPart2 ||
        !IntegrationPart3 ||
        !RecoveryReopeningConstants ||
        !RecoveryReopeningUtils ||
        !RecoveryReopeningPart2 ||
        !RecoveryReopeningPart4
    ) {
        throw new Error(
            "RecoveryReopeningIntegrationV32 Parts 1, 2 and 3 must be loaded before Part 4."
        );
    }

    const {
        ADAPTER_STATUS
    } = IntegrationConstants;

    const {
        CONNECTION_STATUS,
        isValidReopeningInstance
    } = IntegrationPart2;

    const {
        REGISTRATION_STATUS,
        HEALTH_STATUS
    } = IntegrationPart3;

    const {
        REOPENING_STATUS,
        REOPENING_RESULT,
        REOPENING_EVENT
    } = RecoveryReopeningConstants;

    const {
        now,
        deepClone,
        safeArray,
        safeObject,
        createId
    } = RecoveryReopeningUtils;

    const {
        toFiniteNumber,
        clamp,
        normalizeError,
        withTimeout,
        sleep
    } = RecoveryReopeningPart2;

    const {
        MONITORING_DECISION,
        TRIGGER_TYPE,
        LIFECYCLE_PHASE
    } = RecoveryReopeningPart4;

    /* ======================================================================
       SECTION 65
       AUTOMATION CONSTANTS
       ====================================================================== */

    const AUTOMATION_STATUS =
        Object.freeze({

            IDLE:
                "idle",

            INITIALIZING:
                "initializing",

            READY:
                "ready",

            LISTENING:
                "listening",

            PREPARING:
                "preparing",

            VALIDATING:
                "validating",

            REOPENING:
                "reopening",

            MONITORING:
                "monitoring",

            STABLE:
                "stable",

            DEGRADED:
                "degraded",

            PAUSED:
                "paused",

            FAILED:
                "failed",

            STOPPED:
                "stopped",

            DESTROYED:
                "destroyed"
        });

    const EXECUTION_TRIGGER =
        Object.freeze({

            MANUAL:
                "manual",

            RECOVERY_COMPLETED:
                "recovery_completed",

            RECOVERY_STABLE:
                "recovery_stable",

            CLOSURE_COMPLETED:
                "closure_completed",

            MONITORING_DECISION:
                "monitoring_decision",

            RETRY:
                "retry",

            INITIALIZATION:
                "initialization",

            CUSTOM:
                "custom"
        });

    const RECOVERY_EVENT_TYPE =
        Object.freeze({

            STARTED:
                "recovery_started",

            COMPLETED:
                "recovery_completed",

            FAILED:
                "recovery_failed",

            STABLE:
                "recovery_stable",

            DEGRADED:
                "recovery_degraded",

            CLOSED:
                "recovery_closed",

            RESET:
                "recovery_reset"
        });

    const AUTOMATION_EVENT =
        Object.freeze({

            INITIALIZED:
                "automation_initialized",

            EVENTS_ATTACHED:
                "automation_events_attached",

            EVENTS_DETACHED:
                "automation_events_detached",

            TRIGGER_RECEIVED:
                "automation_trigger_received",

            PREPARATION_STARTED:
                "automation_preparation_started",

            PREPARATION_COMPLETED:
                "automation_preparation_completed",

            EXECUTION_STARTED:
                "automation_execution_started",

            EXECUTION_COMPLETED:
                "automation_execution_completed",

            EXECUTION_FAILED:
                "automation_execution_failed",

            MONITORING_STARTED:
                "automation_monitoring_started",

            MONITORING_STOPPED:
                "automation_monitoring_stopped",

            STABILITY_REACHED:
                "automation_stability_reached",

            DEGRADATION_DETECTED:
                "automation_degradation_detected",

            PAUSED:
                "automation_paused",

            RESUMED:
                "automation_resumed",

            STOPPED:
                "automation_stopped"
        });

    const DEFAULT_AUTOMATION_CONFIGURATION =
        Object.freeze({

            enabled:
                true,

            autoPrepare:
                true,

            autoReopenAfterRecovery:
                true,

            autoReopenAfterClosure:
                false,

            autoStartMonitoring:
                true,

            runHealthChecksBeforeReopening:
                true,

            requireHealthyResources:
                true,

            minimumHealthScore:
                0.7,

            requiredStableSamples:
                3,

            monitoringIntervalMs:
                30000,

            monitoringTimeoutMs:
                15000,

            executionTimeoutMs:
                180000,

            preparationTimeoutMs:
                120000,

            triggerCooldownMs:
                60000,

            retryFailedReopening:
                true,

            maxReopeningRetries:
                2,

            reopeningRetryDelayMs:
                5000,

            stopMonitoringWhenStable:
                false,

            rollbackOnDegradation:
                false,

            restartRecoveryOnCriticalFailure:
                false,

            attachWindowEvents:
                true,

            attachCoreEvents:
                true,

            attachClosureEvents:
                true,

            attachMonitoringEvents:
                true
        });

    /* ======================================================================
       SECTION 66
       AUTOMATION HELPERS
       ====================================================================== */

    function normalizeRecoveryEvent(
        event,
        payload = {}
    ) {
        const normalizedEvent =
            String(
                event ||
                ""
            )
                .trim()
                .toLowerCase();

        let type =
            RECOVERY_EVENT_TYPE.RESET;

        if (
            normalizedEvent.includes(
                "complete"
            ) ||
            normalizedEvent.includes(
                "success"
            ) ||
            normalizedEvent.includes(
                "recovered"
            )
        ) {
            type =
                RECOVERY_EVENT_TYPE.COMPLETED;
        } else if (
            normalizedEvent.includes(
                "stable"
            ) ||
            normalizedEvent.includes(
                "ready"
            )
        ) {
            type =
                RECOVERY_EVENT_TYPE.STABLE;
        } else if (
            normalizedEvent.includes(
                "fail"
            ) ||
            normalizedEvent.includes(
                "error"
            )
        ) {
            type =
                RECOVERY_EVENT_TYPE.FAILED;
        } else if (
            normalizedEvent.includes(
                "degrad"
            ) ||
            normalizedEvent.includes(
                "critical"
            )
        ) {
            type =
                RECOVERY_EVENT_TYPE.DEGRADED;
        } else if (
            normalizedEvent.includes(
                "close"
            ) ||
            normalizedEvent.includes(
                "shutdown"
            )
        ) {
            type =
                RECOVERY_EVENT_TYPE.CLOSED;
        } else if (
            normalizedEvent.includes(
                "start"
            ) ||
            normalizedEvent.includes(
                "begin"
            )
        ) {
            type =
                RECOVERY_EVENT_TYPE.STARTED;
        }

        return {

            id:
                createId(
                    "normalized_recovery_event"
                ),

            originalEvent:
                event,

            type,

            payload:
                safeObject(
                    payload
                ),

            timestamp:
                now()
        };
    }

    function resolveUnsubscribe(
        target,
        eventName,
        listener,
        result
    ) {
        if (
            typeof result ===
            "function"
        ) {
            return result;
        }

        if (
            result &&
            typeof result.unsubscribe ===
            "function"
        ) {
            return () => {
                result.unsubscribe();
            };
        }

        if (
            typeof target?.off ===
            "function"
        ) {
            return () => {
                target.off(
                    eventName,
                    listener
                );
            };
        }

        if (
            typeof target?.removeEventListener ===
            "function"
        ) {
            return () => {
                target.removeEventListener(
                    eventName,
                    listener
                );
            };
        }

        return () => {};
    }

    function subscribeToTarget(
        target,
        eventName,
        listener
    ) {
        if (
            !target ||
            typeof listener !==
            "function"
        ) {
            return null;
        }

        if (
            typeof target.on ===
            "function"
        ) {
            const result =
                target.on(
                    eventName,
                    listener
                );

            return resolveUnsubscribe(
                target,
                eventName,
                listener,
                result
            );
        }

        if (
            typeof target.addEventListener ===
            "function"
        ) {
            target.addEventListener(
                eventName,
                listener
            );

            return resolveUnsubscribe(
                target,
                eventName,
                listener
            );
        }

        if (
            typeof target.subscribe ===
            "function"
        ) {
            const result =
                target.subscribe(
                    eventName,
                    listener
                );

            return resolveUnsubscribe(
                target,
                eventName,
                listener,
                result
            );
        }

        return null;
    }

    function isCriticalHealthResult(
        result
    ) {
        if (!result) {
            return false;
        }

        return (
            result.status ===
                HEALTH_STATUS.UNHEALTHY ||
            result.requiredFailureCount >
                0 ||
            result.score <=
                0.25
        );
    }

    /* ======================================================================
       SECTION 67
       ENSURE AUTOMATION STATE
       ====================================================================== */

    IntegrationClass.prototype.ensureAutomationState =
        function ensureAutomationState() {

            if (
                !this.state.automation
            ) {
                this.state.automation = {

                    id:
                        createId(
                            "reopening_automation"
                        ),

                    status:
                        AUTOMATION_STATUS.IDLE,

                    enabled:
                        true,

                    initializedAt:
                        null,

                    startedAt:
                        null,

                    stoppedAt:
                        null,

                    lastTriggerAt:
                        null,

                    lastExecutionAt:
                        null,

                    lastMonitoringAt:
                        null,

                    executionCount:
                        0,

                    successfulExecutionCount:
                        0,

                    failedExecutionCount:
                        0,

                    ignoredTriggerCount:
                        0,

                    monitoringCycleCount:
                        0,

                    stableSampleCount:
                        0,

                    degradedSampleCount:
                        0,

                    criticalSampleCount:
                        0,

                    retryCount:
                        0,

                    running:
                        false,

                    preparing:
                        false,

                    executing:
                        false,

                    monitoring:
                        false,

                    paused:
                        false,

                    monitoringTimer:
                        null,

                    eventSubscriptions:
                        [],

                    triggers:
                        [],

                    executions:
                        [],

                    monitoringHistory:
                        [],

                    errors:
                        [],

                    lastError:
                        null,

                    configuration: {
                        ...DEFAULT_AUTOMATION_CONFIGURATION
                    }
                };
            }

            const automation =
                this.state.automation;

            automation.eventSubscriptions =
                safeArray(
                    automation.eventSubscriptions
                );

            automation.triggers =
                safeArray(
                    automation.triggers
                );

            automation.executions =
                safeArray(
                    automation.executions
                );

            automation.monitoringHistory =
                safeArray(
                    automation.monitoringHistory
                );

            automation.errors =
                safeArray(
                    automation.errors
                );

            return automation;
        };

    /* ======================================================================
       SECTION 68
       CONFIGURE AUTOMATION
       ====================================================================== */

    IntegrationClass.prototype.configureAutomation =
        function configureAutomation(
            options = {}
        ) {

            const automation =
                this.ensureAutomationState();

            const safeOptions =
                safeObject(options);

            automation.configuration = {

                ...automation.configuration,

                ...safeOptions,

                minimumHealthScore:
                    clamp(
                        toFiniteNumber(
                            safeOptions
                                .minimumHealthScore,
                            automation
                                .configuration
                                .minimumHealthScore
                        )
                    ),

                requiredStableSamples:
                    Math.max(
                        1,
                        Math.round(
                            toFiniteNumber(
                                safeOptions
                                    .requiredStableSamples,
                                automation
                                    .configuration
                                    .requiredStableSamples
                            )
                        )
                    ),

                monitoringIntervalMs:
                    Math.max(
                        5000,
                        toFiniteNumber(
                            safeOptions
                                .monitoringIntervalMs,
                            automation
                                .configuration
                                .monitoringIntervalMs
                        )
                    ),

                monitoringTimeoutMs:
                    Math.max(
                        1000,
                        toFiniteNumber(
                            safeOptions
                                .monitoringTimeoutMs,
                            automation
                                .configuration
                                .monitoringTimeoutMs
                        )
                    ),

                executionTimeoutMs:
                    Math.max(
                        1000,
                        toFiniteNumber(
                            safeOptions
                                .executionTimeoutMs,
                            automation
                                .configuration
                                .executionTimeoutMs
                        )
                    ),

                preparationTimeoutMs:
                    Math.max(
                        1000,
                        toFiniteNumber(
                            safeOptions
                                .preparationTimeoutMs,
                            automation
                                .configuration
                                .preparationTimeoutMs
                        )
                    ),

                triggerCooldownMs:
                    Math.max(
                        0,
                        toFiniteNumber(
                            safeOptions
                                .triggerCooldownMs,
                            automation
                                .configuration
                                .triggerCooldownMs
                        )
                    ),

                maxReopeningRetries:
                    Math.max(
                        0,
                        Math.round(
                            toFiniteNumber(
                                safeOptions
                                    .maxReopeningRetries,
                                automation
                                    .configuration
                                    .maxReopeningRetries
                            )
                        )
                    ),

                reopeningRetryDelayMs:
                    Math.max(
                        0,
                        toFiniteNumber(
                            safeOptions
                                .reopeningRetryDelayMs,
                            automation
                                .configuration
                                .reopeningRetryDelayMs
                        )
                    )
            };

            automation.enabled =
                automation.configuration
                    .enabled !==
                false;

            return deepClone(
                automation.configuration
            );
        };

    /* ======================================================================
       SECTION 69
       EVENT SUBSCRIPTION REGISTRATION
       ====================================================================== */

    IntegrationClass.prototype.addAutomationSubscription =
        function addAutomationSubscription(
            source,
            eventName,
            unsubscribe
        ) {

            const automation =
                this.ensureAutomationState();

            const record = {

                id:
                    createId(
                        "automation_subscription"
                    ),

                source,

                eventName,

                unsubscribe:
                    typeof unsubscribe ===
                    "function"
                        ? unsubscribe
                        : () => {},

                createdAt:
                    now()
            };

            automation.eventSubscriptions
                .push(
                    record
                );

            return record.id;
        };

    /* ======================================================================
       SECTION 70
       ATTACH RECOVERY EVENTS
       ====================================================================== */

    IntegrationClass.prototype.attachRecoveryEvents =
        function attachRecoveryEvents() {

            const automation =
                this.ensureAutomationState();

            const configuration =
                automation.configuration;

            this.detachRecoveryEvents();

            const handler =
                async (
                    eventName,
                    payload
                ) => {

                    const normalized =
                        normalizeRecoveryEvent(
                            eventName,
                            payload
                        );

                    await this
                        .handleRecoveryLifecycleEvent(
                            normalized
                        );
                };

            const core =
                this.getDependency(
                    "recoveryCore"
                );

            const closure =
                this.getDependency(
                    "closureEngine"
                );

            const monitoring =
                this.getDependency(
                    "monitoringEngine"
                );

            const coreEvents = [
                "recovery_started",
                "recovery_completed",
                "recovery_success",
                "recovery_failed",
                "recovery_stable",
                "recovery_degraded",
                "completed",
                "stable",
                "failed"
            ];

            if (
                configuration.attachCoreEvents &&
                core
            ) {
                coreEvents.forEach(
                    (eventName) => {

                        const listener =
                            (
                                payload
                            ) => {
                                handler(
                                    eventName,
                                    payload
                                );
                            };

                        const unsubscribe =
                            subscribeToTarget(
                                core,
                                eventName,
                                listener
                            );

                        if (unsubscribe) {
                            this.addAutomationSubscription(
                                "recoveryCore",
                                eventName,
                                unsubscribe
                            );
                        }
                    }
                );
            }

            const closureEvents = [
                "closure_completed",
                "closure_finished",
                "system_closed",
                "completed"
            ];

            if (
                configuration.attachClosureEvents &&
                closure
            ) {
                closureEvents.forEach(
                    (eventName) => {

                        const listener =
                            (
                                payload
                            ) => {
                                handler(
                                    eventName,
                                    payload
                                );
                            };

                        const unsubscribe =
                            subscribeToTarget(
                                closure,
                                eventName,
                                listener
                            );

                        if (unsubscribe) {
                            this.addAutomationSubscription(
                                "closureEngine",
                                eventName,
                                unsubscribe
                            );
                        }
                    }
                );
            }

            const monitoringEvents = [
                "stable",
                "degraded",
                "critical",
                "monitoring_decision",
                "health_changed"
            ];

            if (
                configuration.attachMonitoringEvents &&
                monitoring
            ) {
                monitoringEvents.forEach(
                    (eventName) => {

                        const listener =
                            (
                                payload
                            ) => {
                                handler(
                                    eventName,
                                    payload
                                );
                            };

                        const unsubscribe =
                            subscribeToTarget(
                                monitoring,
                                eventName,
                                listener
                            );

                        if (unsubscribe) {
                            this.addAutomationSubscription(
                                "monitoringEngine",
                                eventName,
                                unsubscribe
                            );
                        }
                    }
                );
            }

            if (
                configuration.attachWindowEvents &&
                typeof global.addEventListener ===
                "function"
            ) {
                const windowEvents = [
                    "rainguard:recovery-completed",
                    "rainguard:recovery-stable",
                    "rainguard:recovery-failed",
                    "rainguard:closure-completed",
                    "rainguard:monitoring-degraded"
                ];

                windowEvents.forEach(
                    (eventName) => {

                        const listener =
                            (
                                event
                            ) => {
                                handler(
                                    eventName,
                                    event?.detail ||
                                    {}
                                );
                            };

                        global.addEventListener(
                            eventName,
                            listener
                        );

                        this.addAutomationSubscription(
                            "window",
                            eventName,
                            () => {
                                global.removeEventListener(
                                    eventName,
                                    listener
                                );
                            }
                        );
                    }
                );
            }

            automation.status =
                AUTOMATION_STATUS.LISTENING;

            this.emit(
                AUTOMATION_EVENT.EVENTS_ATTACHED,
                {
                    subscriptionCount:
                        automation
                            .eventSubscriptions
                            .length
                }
            );

            return {
                attached:
                    automation
                        .eventSubscriptions
                        .length,

                status:
                    automation.status
            };
        };

    /* ======================================================================
       SECTION 71
       DETACH RECOVERY EVENTS
       ====================================================================== */

    IntegrationClass.prototype.detachRecoveryEvents =
        function detachRecoveryEvents() {

            const automation =
                this.ensureAutomationState();

            const subscriptions =
                automation.eventSubscriptions
                    .splice(
                        0
                    );

            let detached =
                0;

            subscriptions.forEach(
                (subscription) => {
                    try {
                        subscription
                            .unsubscribe();

                        detached +=
                            1;
                    } catch (_) {
                        /* ignored */
                    }
                }
            );

            this.emit(
                AUTOMATION_EVENT.EVENTS_DETACHED,
                {
                    detached
                }
            );

            return {
                detached
            };
        };

    /* ======================================================================
       SECTION 72
       HANDLE RECOVERY LIFECYCLE EVENT
       ====================================================================== */

    IntegrationClass.prototype.handleRecoveryLifecycleEvent =
        async function handleRecoveryLifecycleEvent(
            event
        ) {

            const automation =
                this.ensureAutomationState();

            if (
                automation.enabled !==
                true ||
                automation.paused
            ) {
                automation.ignoredTriggerCount +=
                    1;

                return {
                    handled:
                        false,

                    reason:
                        "Automation is disabled or paused."
                };
            }

            const normalized =
                event?.type
                    ? event
                    : normalizeRecoveryEvent(
                        event?.event,
                        event?.payload
                    );

            switch (
                normalized.type
            ) {

                case RECOVERY_EVENT_TYPE.COMPLETED:
                case RECOVERY_EVENT_TYPE.STABLE:

                    if (
                        automation.configuration
                            .autoReopenAfterRecovery !==
                        true
                    ) {
                        return {
                            handled:
                                false,

                            reason:
                                "Automatic reopening after recovery is disabled."
                        };
                    }

                    return this.triggerAutomaticReopening({
                        trigger:
                            normalized.type ===
                            RECOVERY_EVENT_TYPE.STABLE
                                ? EXECUTION_TRIGGER.RECOVERY_STABLE
                                : EXECUTION_TRIGGER.RECOVERY_COMPLETED,

                        payload:
                            normalized.payload
                    });

                case RECOVERY_EVENT_TYPE.CLOSED:

                    if (
                        automation.configuration
                            .autoReopenAfterClosure !==
                        true
                    ) {
                        return {
                            handled:
                                false,

                            reason:
                                "Automatic reopening after closure is disabled."
                        };
                    }

                    return this.triggerAutomaticReopening({
                        trigger:
                            EXECUTION_TRIGGER.CLOSURE_COMPLETED,

                        payload:
                            normalized.payload
                    });

                case RECOVERY_EVENT_TYPE.DEGRADED:

                    return this.handleAutomationDegradation({
                        source:
                            "external_event",

                        event:
                            normalized
                    });

                case RECOVERY_EVENT_TYPE.FAILED:

                    automation.status =
                        AUTOMATION_STATUS.DEGRADED;

                    return {
                        handled:
                            true,

                        action:
                            "wait_for_recovery",

                        event:
                            normalized
                    };

                case RECOVERY_EVENT_TYPE.STARTED:

                    this.stopAutomationMonitoring();

                    automation.status =
                        AUTOMATION_STATUS.LISTENING;

                    return {
                        handled:
                            true,

                        action:
                            "monitoring_stopped"
                    };

                default:
                    return {
                        handled:
                            false,

                        reason:
                            "Unsupported recovery event."
                    };
            }
        };

    /* ======================================================================
       SECTION 73
       TRIGGER COOLDOWN
       ====================================================================== */

    IntegrationClass.prototype.isAutomationTriggerCoolingDown =
        function isAutomationTriggerCoolingDown() {

            const automation =
                this.ensureAutomationState();

            if (
                !automation.lastTriggerAt
            ) {
                return false;
            }

            return (
                now() -
                automation.lastTriggerAt <
                automation
                    .configuration
                    .triggerCooldownMs
            );
        };

    /* ======================================================================
       SECTION 74
       PREPARE AUTOMATIC REOPENING
       ====================================================================== */

    IntegrationClass.prototype.prepareAutomaticReopening =
        async function prepareAutomaticReopening(
            options = {}
        ) {

            const automation =
                this.ensureAutomationState();

            automation.status =
                AUTOMATION_STATUS.PREPARING;

            automation.preparing =
                true;

            this.emit(
                AUTOMATION_EVENT.PREPARATION_STARTED,
                {
                    options:
                        safeObject(
                            options
                        )
                }
            );

            try {

                const preparation =
                    await withTimeout(
                        this.registerAndPrepareReopening({
                            connection:
                                options.connection ||
                                {},

                            registration:
                                options.registration ||
                                {},

                            plan:
                                options.plan ||
                                {},

                            health:
                                options.health ||
                                {},

                            runHealthChecks:
                                automation
                                    .configuration
                                    .runHealthChecksBeforeReopening
                        }),
                        automation
                            .configuration
                            .preparationTimeoutMs,
                        "Automatic reopening preparation timed out."
                    );

                if (
                    preparation.prepared !==
                    true
                ) {
                    throw new Error(
                        "Automatic reopening preparation failed."
                    );
                }

                if (
                    automation.configuration
                        .requireHealthyResources &&
                    preparation.health
                ) {
                    const health =
                        preparation.health;

                    if (
                        health.requiredFailureCount >
                        0 ||
                        health.score <
                        automation
                            .configuration
                            .minimumHealthScore
                    ) {
                        throw new Error(
                            "Resource health is below the required reopening threshold."
                        );
                    }
                }

                automation.preparing =
                    false;

                automation.status =
                    AUTOMATION_STATUS.READY;

                this.emit(
                    AUTOMATION_EVENT.PREPARATION_COMPLETED,
                    {
                        preparation
                    }
                );

                return {
                    prepared:
                        true,

                    preparation
                };

            } catch (error) {

                const normalized =
                    normalizeError(
                        error
                    );

                automation.preparing =
                    false;

                automation.status =
                    AUTOMATION_STATUS.FAILED;

                automation.lastError =
                    normalized;

                automation.errors.push({

                    id:
                        createId(
                            "automation_preparation_error"
                        ),

                    phase:
                        "preparation",

                    timestamp:
                        now(),

                    error:
                        normalized
                });

                return {
                    prepared:
                        false,

                    error:
                        normalized
                };
            }
        };

    /* ======================================================================
       SECTION 75
       EXECUTE AUTOMATIC REOPENING
       ====================================================================== */

    IntegrationClass.prototype.executeAutomaticReopening =
        async function executeAutomaticReopening(
            options = {}
        ) {

            const automation =
                this.ensureAutomationState();

            if (
                automation.executing
            ) {
                return {
                    executed:
                        false,

                    reason:
                        "A reopening execution is already active."
                };
            }

            if (
                !isValidReopeningInstance(
                    this.reopening
                )
            ) {
                return {
                    executed:
                        false,

                    reason:
                        "Recovery reopening instance is unavailable."
                };
            }

            automation.executing =
                true;

            automation.running =
                true;

            automation.status =
                AUTOMATION_STATUS.REOPENING;

            automation.executionCount +=
                1;

            automation.lastExecutionAt =
                now();

            const executionRecord = {

                id:
                    createId(
                        "automatic_reopening_execution"
                    ),

                trigger:
                    options.trigger ||
                    EXECUTION_TRIGGER.MANUAL,

                startedAt:
                    now(),

                completedAt:
                    null,

                durationMs:
                    0,

                status:
                    AUTOMATION_STATUS.REOPENING,

                attempt:
                    options.attempt ||
                    1,

                success:
                    false,

                result:
                    null,

                error:
                    null
            };

            automation.executions.push(
                executionRecord
            );

            this.emit(
                AUTOMATION_EVENT.EXECUTION_STARTED,
                {
                    executionId:
                        executionRecord.id,

                    trigger:
                        executionRecord.trigger,

                    attempt:
                        executionRecord.attempt
                }
            );

            try {

                const result =
                    await withTimeout(
                        this.reopening
                            .startReopening({
                                trigger:
                                    executionRecord
                                        .trigger,

                                automatic:
                                    true,

                                integrationId:
                                    this.id,

                                payload:
                                    safeObject(
                                        options.payload
                                    ),

                                ...safeObject(
                                    options.reopening
                                )
                            }),
                        automation
                            .configuration
                            .executionTimeoutMs,
                        "Automatic reopening execution timed out."
                    );

                const success =
                    result?.success ===
                    true ||
                    result?.completed ===
                    true ||
                    result?.status ===
                    REOPENING_STATUS.COMPLETED ||
                    result?.result ===
                    REOPENING_RESULT.SUCCESS ||
                    this.reopening
                        ?.state
                        ?.status ===
                    REOPENING_STATUS.COMPLETED;

                if (!success) {
                    throw new Error(
                        result?.message ||
                        "Automatic reopening did not complete successfully."
                    );
                }

                executionRecord.completedAt =
                    now();

                executionRecord.durationMs =
                    executionRecord.completedAt -
                    executionRecord.startedAt;

                executionRecord.status =
                    AUTOMATION_STATUS.STABLE;

                executionRecord.success =
                    true;

                executionRecord.result =
                    deepClone(
                        result
                    );

                automation.executing =
                    false;

                automation.successfulExecutionCount +=
                    1;

                automation.status =
                    AUTOMATION_STATUS.MONITORING;

                this.state.status =
                    ADAPTER_STATUS.RUNNING;

                this.emit(
                    AUTOMATION_EVENT.EXECUTION_COMPLETED,
                    {
                        execution:
                            deepClone(
                                executionRecord
                            )
                    }
                );

                if (
                    automation.configuration
                        .autoStartMonitoring
                ) {
                    this.startAutomationMonitoring();
                }

                return {
                    executed:
                        true,

                    success:
                        true,

                    execution:
                        deepClone(
                            executionRecord
                        ),

                    result:
                        deepClone(
                            result
                        )
                };

            } catch (error) {

                const normalized =
                    normalizeError(
                        error
                    );

                executionRecord.completedAt =
                    now();

                executionRecord.durationMs =
                    executionRecord.completedAt -
                    executionRecord.startedAt;

                executionRecord.status =
                    AUTOMATION_STATUS.FAILED;

                executionRecord.error =
                    normalized;

                automation.executing =
                    false;

                automation.running =
                    false;

                automation.failedExecutionCount +=
                    1;

                automation.status =
                    AUTOMATION_STATUS.FAILED;

                automation.lastError =
                    normalized;

                automation.errors.push({

                    id:
                        createId(
                            "automation_execution_error"
                        ),

                    phase:
                        "execution",

                    timestamp:
                        now(),

                    error:
                        normalized
                });

                this.state.status =
                    ADAPTER_STATUS.FAILED;

                this.emit(
                    AUTOMATION_EVENT.EXECUTION_FAILED,
                    {
                        execution:
                            deepClone(
                                executionRecord
                            ),

                        error:
                            normalized
                    }
                );

                return {
                    executed:
                        true,

                    success:
                        false,

                    execution:
                        deepClone(
                            executionRecord
                        ),

                    error:
                        normalized
                };
            }
        };

    /* ======================================================================
       SECTION 76
       TRIGGER AUTOMATIC REOPENING
       ====================================================================== */

    IntegrationClass.prototype.triggerAutomaticReopening =
        async function triggerAutomaticReopening(
            options = {}
        ) {

            const automation =
                this.ensureAutomationState();

            const safeOptions =
                safeObject(options);

            if (
                automation.enabled !==
                true
            ) {
                return {
                    triggered:
                        false,

                    reason:
                        "Automatic reopening is disabled."
                };
            }

            if (
                automation.paused
            ) {
                return {
                    triggered:
                        false,

                    reason:
                        "Automatic reopening is paused."
                };
            }

            if (
                this.isAutomationTriggerCoolingDown() &&
                safeOptions.ignoreCooldown !==
                true
            ) {
                automation.ignoredTriggerCount +=
                    1;

                return {
                    triggered:
                        false,

                    reason:
                        "Automatic reopening trigger is cooling down."
                };
            }

            const triggerRecord = {

                id:
                    createId(
                        "automatic_reopening_trigger"
                    ),

                trigger:
                    safeOptions.trigger ||
                    EXECUTION_TRIGGER.CUSTOM,

                payload:
                    deepClone(
                        safeOptions.payload ||
                        {}
                    ),

                timestamp:
                    now()
            };

            automation.triggers.push(
                triggerRecord
            );

            automation.lastTriggerAt =
                triggerRecord.timestamp;

            this.emit(
                AUTOMATION_EVENT.TRIGGER_RECEIVED,
                {
                    trigger:
                        deepClone(
                            triggerRecord
                        )
                }
            );

            if (
                automation.configuration
                    .autoPrepare !==
                false
            ) {
                const preparation =
                    await this
                        .prepareAutomaticReopening(
                            safeOptions
                        );

                if (
                    preparation.prepared !==
                    true
                ) {
                    return {
                        triggered:
                            true,

                        executed:
                            false,

                        preparation
                    };
                }
            }

            let attempt =
                0;

            let execution =
                null;

            const maximumAttempts =
                automation.configuration
                    .retryFailedReopening
                    ? automation
                        .configuration
                        .maxReopeningRetries +
                        1
                    : 1;

            while (
                attempt <
                maximumAttempts
            ) {
                attempt +=
                    1;

                execution =
                    await this
                        .executeAutomaticReopening({
                            ...safeOptions,

                            attempt,

                            trigger:
                                attempt >
                                1
                                    ? EXECUTION_TRIGGER.RETRY
                                    : triggerRecord.trigger
                        });

                if (
                    execution.success ===
                    true
                ) {
                    break;
                }

                if (
                    attempt <
                    maximumAttempts
                ) {
                    automation.retryCount +=
                        1;

                    await sleep(
                        automation
                            .configuration
                            .reopeningRetryDelayMs
                    );
                }
            }

            return {
                triggered:
                    true,

                trigger:
                    triggerRecord,

                attempts:
                    attempt,

                execution
            };
        };

    /* ======================================================================
       SECTION 77
       AUTOMATION MONITORING CYCLE
       ====================================================================== */

    IntegrationClass.prototype.runAutomationMonitoringCycle =
        async function runAutomationMonitoringCycle() {

            const automation =
                this.ensureAutomationState();

            if (
                automation.monitoring !==
                true ||
                automation.paused
            ) {
                return {
                    evaluated:
                        false,

                    reason:
                        "Automation monitoring is not active."
                };
            }

            const startedAt =
                now();

            automation.monitoringCycleCount +=
                1;

            automation.lastMonitoringAt =
                startedAt;

            try {

                const health =
                    await withTimeout(
                        this.runAllResourceHealthChecks({
                            parallel:
                                true
                        }),
                        automation
                            .configuration
                            .monitoringTimeoutMs,
                        "Automation monitoring cycle timed out."
                    );

                const stable =
                    health.requiredFailureCount ===
                    0 &&
                    health.score >=
                    automation
                        .configuration
                        .minimumHealthScore &&
                    health.status ===
                    HEALTH_STATUS.HEALTHY;

                const degraded =
                    !stable &&
                    !isCriticalHealthResult(
                        health
                    );

                const critical =
                    isCriticalHealthResult(
                        health
                    );

                if (stable) {

                    automation.stableSampleCount +=
                        1;

                    automation.degradedSampleCount =
                        0;

                    automation.criticalSampleCount =
                        0;

                } else if (critical) {

                    automation.criticalSampleCount +=
                        1;

                    automation.degradedSampleCount +=
                        1;

                    automation.stableSampleCount =
                        0;

                } else if (degraded) {

                    automation.degradedSampleCount +=
                        1;

                    automation.stableSampleCount =
                        0;

                    automation.criticalSampleCount =
                        0;
                }

                const record = {

                    id:
                        createId(
                            "automation_monitoring_sample"
                        ),

                    startedAt,

                    completedAt:
                        now(),

                    durationMs:
                        now() -
                        startedAt,

                    stable,

                    degraded,

                    critical,

                    health:
                        deepClone(
                            health
                        ),

                    stableSampleCount:
                        automation.stableSampleCount,

                    degradedSampleCount:
                        automation.degradedSampleCount,

                    criticalSampleCount:
                        automation.criticalSampleCount
                };

                automation.monitoringHistory
                    .push(
                        record
                    );

                if (
                    automation.monitoringHistory
                        .length >
                    200
                ) {
                    automation.monitoringHistory =
                        automation.monitoringHistory
                            .slice(
                                -200
                            );
                }

                if (
                    automation.stableSampleCount >=
                    automation
                        .configuration
                        .requiredStableSamples
                ) {
                    automation.status =
                        AUTOMATION_STATUS.STABLE;

                    this.state.status =
                        ADAPTER_STATUS.RUNNING;

                    this.emit(
                        AUTOMATION_EVENT.STABILITY_REACHED,
                        {
                            record:
                                deepClone(
                                    record
                                )
                        }
                    );

                    if (
                        automation.configuration
                            .stopMonitoringWhenStable
                    ) {
                        this.stopAutomationMonitoring();
                    }
                } else if (
                    degraded ||
                    critical
                ) {
                    automation.status =
                        AUTOMATION_STATUS.DEGRADED;

                    this.state.status =
                        ADAPTER_STATUS.DEGRADED;

                    this.emit(
                        AUTOMATION_EVENT.DEGRADATION_DETECTED,
                        {
                            record:
                                deepClone(
                                    record
                                )
                        }
                    );

                    await this
                        .handleAutomationDegradation({
                            source:
                                "monitoring",

                            record
                        });
                }

                return {
                    evaluated:
                        true,

                    record:
                        deepClone(
                            record
                        )
                };

            } catch (error) {

                const normalized =
                    normalizeError(
                        error
                    );

                automation.status =
                    AUTOMATION_STATUS.DEGRADED;

                automation.lastError =
                    normalized;

                automation.errors.push({

                    id:
                        createId(
                            "automation_monitoring_error"
                        ),

                    phase:
                        "monitoring",

                    timestamp:
                        now(),

                    error:
                        normalized
                });

                return {
                    evaluated:
                        false,

                    error:
                        normalized
                };
            }
        };

    /* ======================================================================
       SECTION 78
       START AUTOMATION MONITORING
       ====================================================================== */

    IntegrationClass.prototype.startAutomationMonitoring =
        function startAutomationMonitoring(
            options = {}
        ) {

            const automation =
                this.ensureAutomationState();

            this.configureAutomation(
                options
            );

            if (
                automation.monitoringTimer
            ) {
                return {
                    started:
                        false,

                    alreadyRunning:
                        true
                };
            }

            automation.monitoring =
                true;

            automation.status =
                AUTOMATION_STATUS.MONITORING;

            automation.stableSampleCount =
                0;

            automation.degradedSampleCount =
                0;

            automation.criticalSampleCount =
                0;

            const runCycle =
                async () => {
                    await this
                        .runAutomationMonitoringCycle();
                };

            runCycle();

            automation.monitoringTimer =
                global.setInterval(
                    runCycle,
                    automation
                        .configuration
                        .monitoringIntervalMs
                );

            this.emit(
                AUTOMATION_EVENT.MONITORING_STARTED,
                {
                    intervalMs:
                        automation
                            .configuration
                            .monitoringIntervalMs
                }
            );

            return {
                started:
                    true,

                intervalMs:
                    automation
                        .configuration
                        .monitoringIntervalMs
            };
        };

    /* ======================================================================
       SECTION 79
       STOP AUTOMATION MONITORING
       ====================================================================== */

    IntegrationClass.prototype.stopAutomationMonitoring =
        function stopAutomationMonitoring() {

            const automation =
                this.ensureAutomationState();

            if (
                automation.monitoringTimer
            ) {
                global.clearInterval(
                    automation.monitoringTimer
                );

                automation.monitoringTimer =
                    null;
            }

            const wasMonitoring =
                automation.monitoring;

            automation.monitoring =
                false;

            if (
                automation.status ===
                AUTOMATION_STATUS.MONITORING
            ) {
                automation.status =
                    AUTOMATION_STATUS.READY;
            }

            this.emit(
                AUTOMATION_EVENT.MONITORING_STOPPED,
                {
                    wasMonitoring
                }
            );

            return {
                stopped:
                    true,

                wasMonitoring
            };
        };

    /* ======================================================================
       SECTION 80
       HANDLE AUTOMATION DEGRADATION
       ====================================================================== */

    IntegrationClass.prototype.handleAutomationDegradation =
        async function handleAutomationDegradation(
            context = {}
        ) {

            const automation =
                this.ensureAutomationState();

            const critical =
                context.record?.critical ===
                    true ||
                context.event?.type ===
                    RECOVERY_EVENT_TYPE.DEGRADED;

            if (
                critical &&
                automation.configuration
                    .rollbackOnDegradation &&
                typeof this.reopening
                    ?.executeRollback ===
                "function"
            ) {
                const rollback =
                    await this.reopening
                        .executeRollback({
                            reason:
                                "automation_degradation",

                            integrationId:
                                this.id,

                            context:
                                safeObject(
                                    context
                                )
                        });

                return {
                    handled:
                        true,

                    action:
                        "rollback",

                    result:
                        deepClone(
                            rollback
                        )
                };
            }

            if (
                critical &&
                automation.configuration
                    .restartRecoveryOnCriticalFailure
            ) {
                const recoveryCore =
                    this.getDependency(
                        "recoveryCore"
                    );

                const method =
                    [
                        "startRecovery",
                        "executeRecovery",
                        "recover",
                        "restartRecovery"
                    ].find(
                        (methodName) => {
                            return (
                                typeof recoveryCore?.[
                                    methodName
                                ] ===
                                "function"
                            );
                        }
                    );

                if (method) {
                    const result =
                        await recoveryCore[
                            method
                        ]({
                            source:
                                "reopening_automation",

                            integrationId:
                                this.id,

                            context:
                                safeObject(
                                    context
                                )
                        });

                    return {
                        handled:
                            true,

                        action:
                            "restart_recovery",

                        method,

                        result:
                            deepClone(
                                result
                            )
                    };
                }
            }

            return {
                handled:
                    true,

                action:
                    "continue_monitoring"
            };
        };

    /* ======================================================================
       SECTION 81
       PAUSE AND RESUME AUTOMATION
       ====================================================================== */

    IntegrationClass.prototype.pauseAutomation =
        function pauseAutomation() {

            const automation =
                this.ensureAutomationState();

            automation.paused =
                true;

            automation.status =
                AUTOMATION_STATUS.PAUSED;

            this.emit(
                AUTOMATION_EVENT.PAUSED
            );

            return {
                paused:
                    true,

                timestamp:
                    now()
            };
        };

    IntegrationClass.prototype.resumeAutomation =
        function resumeAutomation() {

            const automation =
                this.ensureAutomationState();

            automation.paused =
                false;

            automation.status =
                automation.monitoring
                    ? AUTOMATION_STATUS.MONITORING
                    : AUTOMATION_STATUS.LISTENING;

            this.emit(
                AUTOMATION_EVENT.RESUMED
            );

            return {
                resumed:
                    true,

                status:
                    automation.status,

                timestamp:
                    now()
            };
        };

    /* ======================================================================
       SECTION 82
       INITIALIZE AUTOMATION
       ====================================================================== */

    IntegrationClass.prototype.initializeAutomation =
        async function initializeAutomation(
            options = {}
        ) {

            const automation =
                this.ensureAutomationState();

            const safeOptions =
                safeObject(options);

            automation.status =
                AUTOMATION_STATUS.INITIALIZING;

            automation.initializedAt =
                now();

            this.configureAutomation(
                safeOptions.automation ||
                safeOptions
            );

            if (
                safeOptions.connect !==
                false &&
                !this.isConnected()
            ) {
                await this.connect(
                    safeOptions.connection ||
                    {}
                );
            }

            if (
                automation.configuration
                    .autoPrepare &&
                safeOptions.prepare !==
                false
            ) {
                const preparation =
                    await this
                        .prepareAutomaticReopening(
                            safeOptions
                        );

                if (
                    preparation.prepared !==
                    true
                ) {
                    automation.status =
                        AUTOMATION_STATUS.DEGRADED;
                }
            }

            if (
                this.configuration
                    .autoAttachEvents !==
                false &&
                safeOptions.attachEvents !==
                false
            ) {
                this.attachRecoveryEvents();
            }

            automation.status =
                automation.eventSubscriptions
                    .length >
                0
                    ? AUTOMATION_STATUS.LISTENING
                    : AUTOMATION_STATUS.READY;

            this.emit(
                AUTOMATION_EVENT.INITIALIZED,
                {
                    status:
                        automation.status
                }
            );

            return this.getAutomationStatus();
        };

    /* ======================================================================
       SECTION 83
       START AND STOP AUTOMATION
       ====================================================================== */

    IntegrationClass.prototype.startAutomation =
        async function startAutomation(
            options = {}
        ) {

            const automation =
                this.ensureAutomationState();

            automation.running =
                true;

            automation.startedAt =
                now();

            if (
                !automation.initializedAt
            ) {
                await this
                    .initializeAutomation(
                        options
                    );
            }

            if (
                options.triggerImmediately ===
                true
            ) {
                await this
                    .triggerAutomaticReopening({
                        ...safeObject(
                            options
                        ),

                        trigger:
                            EXECUTION_TRIGGER.INITIALIZATION,

                        ignoreCooldown:
                            true
                    });
            }

            return this.getAutomationStatus();
        };

    IntegrationClass.prototype.stopAutomation =
        function stopAutomation(
            options = {}
        ) {

            const automation =
                this.ensureAutomationState();

            this.stopAutomationMonitoring();

            if (
                options.detachEvents !==
                false
            ) {
                this.detachRecoveryEvents();
            }

            automation.running =
                false;

            automation.executing =
                false;

            automation.preparing =
                false;

            automation.stoppedAt =
                now();

            automation.status =
                AUTOMATION_STATUS.STOPPED;

            this.emit(
                AUTOMATION_EVENT.STOPPED
            );

            return this.getAutomationStatus();
        };

    /* ======================================================================
       SECTION 84
       GET AUTOMATION STATUS
       ====================================================================== */

    IntegrationClass.prototype.getAutomationStatus =
        function getAutomationStatus() {

            const automation =
                this.ensureAutomationState();

            return deepClone({

                id:
                    automation.id,

                status:
                    automation.status,

                enabled:
                    automation.enabled,

                running:
                    automation.running,

                preparing:
                    automation.preparing,

                executing:
                    automation.executing,

                monitoring:
                    automation.monitoring,

                paused:
                    automation.paused,

                initializedAt:
                    automation.initializedAt,

                startedAt:
                    automation.startedAt,

                stoppedAt:
                    automation.stoppedAt,

                lastTriggerAt:
                    automation.lastTriggerAt,

                lastExecutionAt:
                    automation.lastExecutionAt,

                lastMonitoringAt:
                    automation.lastMonitoringAt,

                executionCount:
                    automation.executionCount,

                successfulExecutionCount:
                    automation
                        .successfulExecutionCount,

                failedExecutionCount:
                    automation
                        .failedExecutionCount,

                ignoredTriggerCount:
                    automation
                        .ignoredTriggerCount,

                monitoringCycleCount:
                    automation
                        .monitoringCycleCount,

                stableSampleCount:
                    automation
                        .stableSampleCount,

                degradedSampleCount:
                    automation
                        .degradedSampleCount,

                criticalSampleCount:
                    automation
                        .criticalSampleCount,

                retryCount:
                    automation.retryCount,

                subscriptionCount:
                    automation
                        .eventSubscriptions
                        .length,

                triggerCount:
                    automation.triggers.length,

                monitoringHistoryCount:
                    automation
                        .monitoringHistory
                        .length,

                lastError:
                    automation.lastError,

                errorCount:
                    automation.errors.length,

                configuration:
                    automation.configuration
            });
        };

    /* ======================================================================
       SECTION 85
       COMPATIBILITY ALIASES AND EXPORT
       ====================================================================== */

    IntegrationClass.prototype.attachEvents =
        IntegrationClass.prototype
            .attachRecoveryEvents;

    IntegrationClass.prototype.detachEvents =
        IntegrationClass.prototype
            .detachRecoveryEvents;

    IntegrationClass.prototype.triggerReopening =
        IntegrationClass.prototype
            .triggerAutomaticReopening;

    IntegrationClass.prototype.executeReopening =
        IntegrationClass.prototype
            .executeAutomaticReopening;

    IntegrationClass.prototype.startMonitoring =
        IntegrationClass.prototype
            .startAutomationMonitoring;

    IntegrationClass.prototype.stopMonitoring =
        IntegrationClass.prototype
            .stopAutomationMonitoring;

    IntegrationClass.prototype.pause =
        IntegrationClass.prototype
            .pauseAutomation;

    IntegrationClass.prototype.resume =
        IntegrationClass.prototype
            .resumeAutomation;

    IntegrationClass.prototype.start =
        IntegrationClass.prototype
            .startAutomation;

    IntegrationClass.prototype.stop =
        IntegrationClass.prototype
            .stopAutomation;

    global.RecoveryReopeningIntegrationV32Part4 = {

        AUTOMATION_STATUS,

        EXECUTION_TRIGGER,

        RECOVERY_EVENT_TYPE,

        AUTOMATION_EVENT,

        DEFAULT_AUTOMATION_CONFIGURATION,

        normalizeRecoveryEvent,

        resolveUnsubscribe,

        subscribeToTarget,

        isCriticalHealthResult
    };

})(window);

/* ==========================================================================
   RainGuard AI
   Long Horizon Forecast Engine V32

   Recovery Reopening Integration V32

   PART 5
   Diagnostics + Persistence + Global Bootstrap +
   Final Lifecycle + Completion Export
   ========================================================================== */

(function extendRecoveryReopeningIntegrationV32Part5(global) {
    "use strict";

    /* ======================================================================
       SECTION 86
       DEPENDENCY RESOLUTION
       ====================================================================== */

    const IntegrationClass =
        global.RecoveryReopeningIntegrationV32;

    const IntegrationConstants =
        global.RecoveryReopeningIntegrationV32Constants;

    const IntegrationPart2 =
        global.RecoveryReopeningIntegrationV32Part2;

    const IntegrationPart3 =
        global.RecoveryReopeningIntegrationV32Part3;

    const IntegrationPart4 =
        global.RecoveryReopeningIntegrationV32Part4;

    const RecoveryReopeningUtils =
        global.RecoveryReopeningV32Utils;

    const RecoveryReopeningPart2 =
        global.RecoveryReopeningV32Part2;

    if (
        typeof IntegrationClass !== "function" ||
        !IntegrationConstants ||
        !IntegrationPart2 ||
        !IntegrationPart3 ||
        !IntegrationPart4 ||
        !RecoveryReopeningUtils ||
        !RecoveryReopeningPart2
    ) {
        throw new Error(
            "RecoveryReopeningIntegrationV32 Parts 1, 2, 3 and 4 must be loaded before Part 5."
        );
    }

    const {
        VERSION,
        BUILD,
        MODULE_NAME,
        ADAPTER_STATUS,
        DEPENDENCY_STATUS
    } = IntegrationConstants;

    const {
        CONNECTION_STATUS,
        isValidReopeningInstance
    } = IntegrationPart2;

    const {
        REGISTRATION_STATUS,
        HEALTH_STATUS
    } = IntegrationPart3;

    const {
        AUTOMATION_STATUS,
        EXECUTION_TRIGGER
    } = IntegrationPart4;

    const {
        now,
        deepClone,
        safeArray,
        safeObject,
        createId
    } = RecoveryReopeningUtils;

    const {
        toFiniteNumber,
        clamp,
        normalizeError
    } = RecoveryReopeningPart2;

    /* ======================================================================
       SECTION 87
       FINAL CONSTANTS
       ====================================================================== */

    const INTEGRATION_DIAGNOSTIC_LEVEL =
        Object.freeze({

            INFO:
                "info",

            WARNING:
                "warning",

            ERROR:
                "error",

            CRITICAL:
                "critical"
        });

    const INTEGRATION_HEALTH_STATUS =
        Object.freeze({

            UNKNOWN:
                "unknown",

            HEALTHY:
                "healthy",

            DEGRADED:
                "degraded",

            UNHEALTHY:
                "unhealthy",

            FAILED:
                "failed",

            DESTROYED:
                "destroyed"
        });

    const STORAGE_STATUS =
        Object.freeze({

            IDLE:
                "idle",

            SAVING:
                "saving",

            SAVED:
                "saved",

            LOADING:
                "loading",

            LOADED:
                "loaded",

            CLEARED:
                "cleared",

            UNAVAILABLE:
                "unavailable",

            FAILED:
                "failed"
        });

    const BOOTSTRAP_STATUS =
        Object.freeze({

            IDLE:
                "idle",

            STARTING:
                "starting",

            DISCOVERING:
                "discovering",

            CONNECTING:
                "connecting",

            REGISTERING:
                "registering",

            INITIALIZING:
                "initializing",

            READY:
                "ready",

            DEGRADED:
                "degraded",

            FAILED:
                "failed",

            DESTROYED:
                "destroyed"
        });

    const DEFAULT_FINAL_CONFIGURATION =
        Object.freeze({

            autoBootstrap:
                true,

            bootstrapOnDOMContentLoaded:
                true,

            bootstrapDelayMs:
                0,

            initializeAutomation:
                true,

            startAutomation:
                false,

            triggerReopeningImmediately:
                false,

            restoreIntegrationState:
                false,

            saveIntegrationState:
                true,

            persistDiagnostics:
                false,

            exposeShortcuts:
                true,

            exposeDebugAPI:
                true,

            runFinalHealthCheck:
                true,

            destroyReopeningInstance:
                false,

            removeGlobalInstanceOnDestroy:
                false,

            maximumDiagnosticHistory:
                200
        });

    /* ======================================================================
       SECTION 88
       REPORT HELPERS
       ====================================================================== */

    function formatPercentage(
        value
    ) {
        return (
            Math.round(
                clamp(
                    toFiniteNumber(
                        value,
                        0
                    )
                ) *
                10000
            ) /
            100
        );
    }

    function sanitizeError(
        error
    ) {
        if (!error) {
            return null;
        }

        const normalized =
            normalizeError(
                error
            );

        return {

            name:
                normalized.name ||
                "Error",

            message:
                normalized.message ||
                "Unknown error",

            stack:
                normalized.stack ||
                null
        };
    }

    function removeRuntimeValues(
        value,
        seen =
            new WeakSet()
    ) {
        if (
            value ===
            null ||
            value ===
            undefined
        ) {
            return value;
        }

        if (
            typeof value ===
            "function"
        ) {
            return undefined;
        }

        if (
            typeof value !==
            "object"
        ) {
            return value;
        }

        if (
            seen.has(
                value
            )
        ) {
            return "[Circular]";
        }

        seen.add(
            value
        );

        if (
            Array.isArray(
                value
            )
        ) {
            return value
                .map(
                    (item) => {
                        return removeRuntimeValues(
                            item,
                            seen
                        );
                    }
                )
                .filter(
                    (item) => {
                        return (
                            item !==
                            undefined
                        );
                    }
                );
        }

        const result = {};

        Object.entries(
            value
        ).forEach(
            ([
                key,
                item
            ]) => {

                if (
                    [
                        "target",
                        "service",
                        "source",
                        "component",
                        "check",
                        "unsubscribe",
                        "monitoringTimer",
                        "events",
                        "listeners",
                        "reopening"
                    ].includes(
                        key
                    )
                ) {
                    return;
                }

                const cleaned =
                    removeRuntimeValues(
                        item,
                        seen
                    );

                if (
                    cleaned !==
                    undefined
                ) {
                    result[key] =
                        cleaned;
                }
            }
        );

        return result;
    }

    function safeSerialize(
        value
    ) {
        return JSON.stringify(
            removeRuntimeValues(
                value
            )
        );
    }

    /* ======================================================================
       SECTION 89
       ENSURE FINAL STATE
       ====================================================================== */

    IntegrationClass.prototype.ensureFinalState =
        function ensureFinalState() {

            if (
                !this.state.final
            ) {
                this.state.final = {

                    id:
                        createId(
                            "integration_final_state"
                        ),

                    bootstrapStatus:
                        BOOTSTRAP_STATUS.IDLE,

                    healthStatus:
                        INTEGRATION_HEALTH_STATUS.UNKNOWN,

                    storageStatus:
                        STORAGE_STATUS.IDLE,

                    createdAt:
                        now(),

                    bootstrapStartedAt:
                        null,

                    bootstrapCompletedAt:
                        null,

                    bootstrapDurationMs:
                        0,

                    lastHealthCheckAt:
                        null,

                    lastSavedAt:
                        null,

                    lastLoadedAt:
                        null,

                    lastClearedAt:
                        null,

                    destroyedAt:
                        null,

                    bootstrapCount:
                        0,

                    diagnosticCount:
                        0,

                    saveCount:
                        0,

                    loadCount:
                        0,

                    errorCount:
                        0,

                    diagnostics:
                        [],

                    bootstrapHistory:
                        [],

                    errors:
                        [],

                    lastDiagnostic:
                        null,

                    lastHealth:
                        null,

                    lastError:
                        null,

                    configuration: {
                        ...DEFAULT_FINAL_CONFIGURATION
                    }
                };
            }

            const finalState =
                this.state.final;

            finalState.diagnostics =
                safeArray(
                    finalState.diagnostics
                );

            finalState.bootstrapHistory =
                safeArray(
                    finalState.bootstrapHistory
                );

            finalState.errors =
                safeArray(
                    finalState.errors
                );

            return finalState;
        };

    /* ======================================================================
       SECTION 90
       CONFIGURE FINAL LIFECYCLE
       ====================================================================== */

    IntegrationClass.prototype.configureFinalLifecycle =
        function configureFinalLifecycle(
            options = {}
        ) {

            const finalState =
                this.ensureFinalState();

            const safeOptions =
                safeObject(options);

            finalState.configuration = {

                ...finalState.configuration,

                ...safeOptions,

                bootstrapDelayMs:
                    Math.max(
                        0,
                        toFiniteNumber(
                            safeOptions
                                .bootstrapDelayMs,
                            finalState
                                .configuration
                                .bootstrapDelayMs
                        )
                    ),

                maximumDiagnosticHistory:
                    Math.max(
                        10,
                        Math.round(
                            toFiniteNumber(
                                safeOptions
                                    .maximumDiagnosticHistory,
                                finalState
                                    .configuration
                                    .maximumDiagnosticHistory
                            )
                        )
                    )
            };

            return deepClone(
                finalState.configuration
            );
        };

    /* ======================================================================
       SECTION 91
       CREATE DIAGNOSTIC ENTRY
       ====================================================================== */

    IntegrationClass.prototype.addIntegrationDiagnostic =
        function addIntegrationDiagnostic(
            level,
            code,
            message,
            details = {}
        ) {

            const finalState =
                this.ensureFinalState();

            const record = {

                id:
                    createId(
                        "integration_diagnostic"
                    ),

                level:
                    level ||
                    INTEGRATION_DIAGNOSTIC_LEVEL.INFO,

                code:
                    code ||
                    "GENERAL",

                message:
                    message ||
                    "",

                details:
                    removeRuntimeValues(
                        safeObject(
                            details
                        )
                    ),

                timestamp:
                    now()
            };

            finalState.diagnostics
                .push(
                    record
                );

            finalState.diagnosticCount +=
                1;

            finalState.lastDiagnostic =
                record;

            const maximum =
                finalState
                    .configuration
                    .maximumDiagnosticHistory;

            if (
                finalState.diagnostics
                    .length >
                maximum
            ) {
                finalState.diagnostics =
                    finalState.diagnostics
                        .slice(
                            -maximum
                        );
            }

            return deepClone(
                record
            );
        };

    /* ======================================================================
       SECTION 92
       BUILD INTEGRATION HEALTH REPORT
       ====================================================================== */

    IntegrationClass.prototype.buildIntegrationHealthReport =
        function buildIntegrationHealthReport(
            options = {}
        ) {

            const finalState =
                this.ensureFinalState();

            const dependency =
                this.getDependencySummary();

            const connection =
                this.getConnectionStatus();

            const registration =
                this.getRegistrationStatus();

            const automation =
                this.getAutomationStatus();

            const reopening =
                isValidReopeningInstance(
                    this.reopening
                )
                    ? (
                        this.reopening
                            .getCompleteReopeningStatus?.() ||
                        this.reopening
                            .getExecutionStatus?.() ||
                        this.reopening
                            .getState?.() ||
                        null
                    )
                    : null;

            const issues = [];

            let score =
                1;

            if (
                dependency.requiredMissing
                    .length >
                0
            ) {
                score -=
                    0.35;

                issues.push({
                    level:
                        INTEGRATION_DIAGNOSTIC_LEVEL.CRITICAL,

                    code:
                        "REQUIRED_DEPENDENCIES_MISSING",

                    message:
                        "Required integration dependencies are missing.",

                    details: {
                        dependencies:
                            dependency.requiredMissing
                    }
                });
            }

            if (
                dependency.invalidDependencies
                    .length >
                0
            ) {
                score -=
                    0.15;

                issues.push({
                    level:
                        INTEGRATION_DIAGNOSTIC_LEVEL.ERROR,

                    code:
                        "INVALID_DEPENDENCIES",

                    message:
                        "Some integration dependencies are incomplete or invalid.",

                    details: {
                        dependencies:
                            dependency.invalidDependencies
                    }
                });
            }

            if (
                connection.connected !==
                true
            ) {
                score -=
                    0.2;

                issues.push({
                    level:
                        INTEGRATION_DIAGNOSTIC_LEVEL.ERROR,

                    code:
                        "INTEGRATION_NOT_CONNECTED",

                    message:
                        "Recovery reopening integration is not connected."
                });
            }

            if (
                connection.failedDependencyCount >
                0
            ) {
                score -=
                    0.1;

                issues.push({
                    level:
                        INTEGRATION_DIAGNOSTIC_LEVEL.ERROR,

                    code:
                        "ATTACHMENT_FAILURES",

                    message:
                        "One or more dependencies failed during attachment.",

                    details: {
                        failed:
                            connection
                                .failedDependencyCount
                    }
                });
            }

            if (
                registration.status ===
                REGISTRATION_STATUS.FAILED
            ) {
                score -=
                    0.2;

                issues.push({
                    level:
                        INTEGRATION_DIAGNOSTIC_LEVEL.ERROR,

                    code:
                        "REGISTRATION_FAILED",

                    message:
                        "Resource registration failed."
                });
            } else if (
                registration.status ===
                REGISTRATION_STATUS.PARTIAL
            ) {
                score -=
                    0.08;

                issues.push({
                    level:
                        INTEGRATION_DIAGNOSTIC_LEVEL.WARNING,

                    code:
                        "REGISTRATION_PARTIAL",

                    message:
                        "Resource registration completed partially."
                });
            }

            if (
                automation.status ===
                AUTOMATION_STATUS.FAILED
            ) {
                score -=
                    0.2;

                issues.push({
                    level:
                        INTEGRATION_DIAGNOSTIC_LEVEL.ERROR,

                    code:
                        "AUTOMATION_FAILED",

                    message:
                        "Automatic reopening lifecycle failed."
                });
            } else if (
                automation.status ===
                AUTOMATION_STATUS.DEGRADED
            ) {
                score -=
                    0.1;

                issues.push({
                    level:
                        INTEGRATION_DIAGNOSTIC_LEVEL.WARNING,

                    code:
                        "AUTOMATION_DEGRADED",

                    message:
                        "Automatic reopening lifecycle is degraded."
                });
            }

            if (
                !isValidReopeningInstance(
                    this.reopening
                )
            ) {
                score -=
                    0.25;

                issues.push({
                    level:
                        INTEGRATION_DIAGNOSTIC_LEVEL.CRITICAL,

                    code:
                        "REOPENING_INSTANCE_UNAVAILABLE",

                    message:
                        "RecoveryReopeningV32 instance is unavailable."
                });
            }

            score =
                clamp(
                    score
                );

            let status =
                INTEGRATION_HEALTH_STATUS.HEALTHY;

            if (
                this.destroyed
            ) {
                status =
                    INTEGRATION_HEALTH_STATUS.DESTROYED;
            } else if (
                score <=
                0.2
            ) {
                status =
                    INTEGRATION_HEALTH_STATUS.FAILED;
            } else if (
                score <
                0.6
            ) {
                status =
                    INTEGRATION_HEALTH_STATUS.UNHEALTHY;
            } else if (
                score <
                0.9
            ) {
                status =
                    INTEGRATION_HEALTH_STATUS.DEGRADED;
            }

            const report = {

                integrationId:
                    this.id,

                module:
                    MODULE_NAME,

                version:
                    VERSION,

                build:
                    BUILD,

                status,

                score,

                scorePercentage:
                    formatPercentage(
                        score
                    ),

                healthy:
                    status ===
                    INTEGRATION_HEALTH_STATUS.HEALTHY,

                dependency,

                connection,

                registration,

                automation,

                reopening:
                    removeRuntimeValues(
                        reopening
                    ),

                issueCount:
                    issues.length,

                issues,

                checkedAt:
                    now(),

                options:
                    removeRuntimeValues(
                        safeObject(
                            options
                        )
                    )
            };

            finalState.healthStatus =
                status;

            finalState.lastHealthCheckAt =
                report.checkedAt;

            finalState.lastHealth =
                report;

            issues.forEach(
                (issue) => {
                    this.addIntegrationDiagnostic(
                        issue.level,
                        issue.code,
                        issue.message,
                        issue.details
                    );
                }
            );

            return deepClone(
                report
            );
        };

    /* ======================================================================
       SECTION 93
       RUN COMPLETE DIAGNOSTICS
       ====================================================================== */

    IntegrationClass.prototype.runCompleteIntegrationDiagnostics =
        async function runCompleteIntegrationDiagnostics(
            options = {}
        ) {

            const safeOptions =
                safeObject(options);

            const report =
                this.buildIntegrationHealthReport(
                    safeOptions
                );

            let resourceHealth =
                null;

            if (
                safeOptions.runResourceHealthChecks !==
                false &&
                this.getRegistrationStatus()
                    .healthCheckCount >
                0
            ) {
                try {
                    resourceHealth =
                        await this
                            .runAllResourceHealthChecks({
                                parallel:
                                    true
                            });
                } catch (error) {
                    resourceHealth = {

                        status:
                            HEALTH_STATUS.ERROR,

                        healthy:
                            false,

                        score:
                            0,

                        error:
                            sanitizeError(
                                error
                            )
                    };
                }
            }

            const finalScore =
                resourceHealth
                    ? clamp(
                        (
                            report.score +
                            toFiniteNumber(
                                resourceHealth.score,
                                0
                            )
                        ) /
                        2
                    )
                    : report.score;

            const complete = {

                ...report,

                score:
                    finalScore,

                scorePercentage:
                    formatPercentage(
                        finalScore
                    ),

                resourceHealth:
                    removeRuntimeValues(
                        resourceHealth
                    ),

                completedAt:
                    now()
            };

            return deepClone(
                complete
            );
        };

    /* ======================================================================
       SECTION 94
       PERSISTENCE STORAGE RESOLUTION
       ====================================================================== */

    IntegrationClass.prototype.resolveIntegrationStorage =
        function resolveIntegrationStorage() {

            try {
                if (
                    global.localStorage &&
                    typeof global.localStorage
                        .getItem ===
                    "function"
                ) {
                    return global.localStorage;
                }
            } catch (_) {
                /* ignored */
            }

            try {
                if (
                    global.sessionStorage &&
                    typeof global.sessionStorage
                        .getItem ===
                    "function"
                ) {
                    return global.sessionStorage;
                }
            } catch (_) {
                /* ignored */
            }

            return null;
        };

    /* ======================================================================
       SECTION 95
       BUILD PERSISTENCE PAYLOAD
       ====================================================================== */

    IntegrationClass.prototype.buildIntegrationPersistencePayload =
        function buildIntegrationPersistencePayload() {

            const finalState =
                this.ensureFinalState();

            return {

                schema:
                    "rainguard.recovery.reopening.integration.v32",

                version:
                    VERSION,

                build:
                    BUILD,

                integrationId:
                    this.id,

                savedAt:
                    now(),

                configuration:
                    removeRuntimeValues(
                        this.configuration
                    ),

                automationConfiguration:
                    removeRuntimeValues(
                        this
                            .ensureAutomationState()
                            .configuration
                    ),

                finalConfiguration:
                    removeRuntimeValues(
                        finalState
                            .configuration
                    ),

                state: {
                    status:
                        this.state.status,

                    enabled:
                        this.state.enabled,

                    dependencyScore:
                        this.state
                            .dependencyScore,

                    dependencyStatus:
                        this.state
                            .dependencyStatus,

                    discoveredAt:
                        this.state
                            .discoveredAt,

                    connectedAt:
                        this.state
                            .connectedAt
                },

                health:
                    removeRuntimeValues(
                        finalState.lastHealth
                    ),

                diagnostics:
                    finalState.configuration
                        .persistDiagnostics
                        ? removeRuntimeValues(
                            finalState.diagnostics
                        )
                        : []
            };
        };

    /* ======================================================================
       SECTION 96
       SAVE INTEGRATION STATE
       ====================================================================== */

    IntegrationClass.prototype.saveIntegrationState =
        function saveIntegrationState(
            options = {}
        ) {

            const finalState =
                this.ensureFinalState();

            const safeOptions =
                safeObject(options);

            const storage =
                safeOptions.storage ||
                this.resolveIntegrationStorage();

            const key =
                safeOptions.key ||
                this.configuration
                    .persistenceKey ||
                "rainguard_recovery_reopening_integration_v32";

            if (!storage) {
                finalState.storageStatus =
                    STORAGE_STATUS.UNAVAILABLE;

                return {
                    saved:
                        false,

                    status:
                        finalState.storageStatus,

                    reason:
                        "Browser storage is unavailable."
                };
            }

            finalState.storageStatus =
                STORAGE_STATUS.SAVING;

            try {

                const payload =
                    this.buildIntegrationPersistencePayload();

                storage.setItem(
                    key,
                    safeSerialize(
                        payload
                    )
                );

                finalState.storageStatus =
                    STORAGE_STATUS.SAVED;

                finalState.lastSavedAt =
                    now();

                finalState.saveCount +=
                    1;

                return {

                    saved:
                        true,

                    status:
                        finalState.storageStatus,

                    key,

                    savedAt:
                        finalState.lastSavedAt
                };

            } catch (error) {

                const normalized =
                    normalizeError(
                        error
                    );

                finalState.storageStatus =
                    STORAGE_STATUS.FAILED;

                finalState.lastError =
                    normalized;

                finalState.errorCount +=
                    1;

                finalState.errors.push({

                    id:
                        createId(
                            "integration_save_error"
                        ),

                    phase:
                        "save",

                    timestamp:
                        now(),

                    error:
                        normalized
                });

                return {

                    saved:
                        false,

                    status:
                        finalState.storageStatus,

                    error:
                        sanitizeError(
                            normalized
                        )
                };
            }
        };

    /* ======================================================================
       SECTION 97
       LOAD INTEGRATION STATE
       ====================================================================== */

    IntegrationClass.prototype.loadIntegrationState =
        function loadIntegrationState(
            options = {}
        ) {

            const finalState =
                this.ensureFinalState();

            const safeOptions =
                safeObject(options);

            const storage =
                safeOptions.storage ||
                this.resolveIntegrationStorage();

            const key =
                safeOptions.key ||
                this.configuration
                    .persistenceKey ||
                "rainguard_recovery_reopening_integration_v32";

            if (!storage) {
                finalState.storageStatus =
                    STORAGE_STATUS.UNAVAILABLE;

                return {
                    loaded:
                        false,

                    status:
                        finalState.storageStatus
                };
            }

            finalState.storageStatus =
                STORAGE_STATUS.LOADING;

            try {

                const raw =
                    storage.getItem(
                        key
                    );

                if (!raw) {
                    finalState.storageStatus =
                        STORAGE_STATUS.IDLE;

                    return {
                        loaded:
                            false,

                        status:
                            finalState.storageStatus,

                        reason:
                            "No persisted integration state was found."
                    };
                }

                const payload =
                    JSON.parse(
                        raw
                    );

                if (
                    payload.configuration
                ) {
                    this.configure(
                        payload.configuration
                    );
                }

                if (
                    payload.automationConfiguration
                ) {
                    this.configureAutomation(
                        payload
                            .automationConfiguration
                    );
                }

                if (
                    payload.finalConfiguration
                ) {
                    this.configureFinalLifecycle(
                        payload.finalConfiguration
                    );
                }

                if (
                    Array.isArray(
                        payload.diagnostics
                    )
                ) {
                    finalState.diagnostics =
                        payload.diagnostics
                            .slice(
                                -finalState
                                    .configuration
                                    .maximumDiagnosticHistory
                            );
                }

                finalState.storageStatus =
                    STORAGE_STATUS.LOADED;

                finalState.lastLoadedAt =
                    now();

                finalState.loadCount +=
                    1;

                return {

                    loaded:
                        true,

                    status:
                        finalState.storageStatus,

                    key,

                    loadedAt:
                        finalState.lastLoadedAt,

                    savedAt:
                        payload.savedAt ||
                        null,

                    version:
                        payload.version ||
                        null
                };

            } catch (error) {

                const normalized =
                    normalizeError(
                        error
                    );

                finalState.storageStatus =
                    STORAGE_STATUS.FAILED;

                finalState.lastError =
                    normalized;

                finalState.errorCount +=
                    1;

                finalState.errors.push({

                    id:
                        createId(
                            "integration_load_error"
                        ),

                    phase:
                        "load",

                    timestamp:
                        now(),

                    error:
                        normalized
                });

                return {

                    loaded:
                        false,

                    status:
                        finalState.storageStatus,

                    error:
                        sanitizeError(
                            normalized
                        )
                };
            }
        };

    /* ======================================================================
       SECTION 98
       CLEAR PERSISTED STATE
       ====================================================================== */

    IntegrationClass.prototype.clearPersistedIntegrationState =
        function clearPersistedIntegrationState(
            options = {}
        ) {

            const finalState =
                this.ensureFinalState();

            const safeOptions =
                safeObject(options);

            const storage =
                safeOptions.storage ||
                this.resolveIntegrationStorage();

            const key =
                safeOptions.key ||
                this.configuration
                    .persistenceKey ||
                "rainguard_recovery_reopening_integration_v32";

            if (!storage) {
                return {
                    cleared:
                        false,

                    status:
                        STORAGE_STATUS.UNAVAILABLE
                };
            }

            try {

                storage.removeItem(
                    key
                );

                finalState.storageStatus =
                    STORAGE_STATUS.CLEARED;

                finalState.lastClearedAt =
                    now();

                return {

                    cleared:
                        true,

                    status:
                        finalState.storageStatus,

                    key,

                    clearedAt:
                        finalState.lastClearedAt
                };

            } catch (error) {

                return {

                    cleared:
                        false,

                    status:
                        STORAGE_STATUS.FAILED,

                    error:
                        sanitizeError(
                            error
                        )
                };
            }
        };

    /* ======================================================================
       SECTION 99
       BUILD COMPLETE STATUS
       ====================================================================== */

    IntegrationClass.prototype.getCompleteIntegrationStatus =
        function getCompleteIntegrationStatus() {

            const finalState =
                this.ensureFinalState();

            return deepClone({

                module:
                    MODULE_NAME,

                version:
                    VERSION,

                build:
                    BUILD,

                integrationId:
                    this.id,

                adapter:
                    this.getState(),

                dependency:
                    this.getDependencySummary(),

                connection:
                    this.getConnectionStatus(),

                registration:
                    this.getRegistrationStatus(),

                automation:
                    this.getAutomationStatus(),

                final: {

                    bootstrapStatus:
                        finalState
                            .bootstrapStatus,

                    healthStatus:
                        finalState
                            .healthStatus,

                    storageStatus:
                        finalState
                            .storageStatus,

                    bootstrapStartedAt:
                        finalState
                            .bootstrapStartedAt,

                    bootstrapCompletedAt:
                        finalState
                            .bootstrapCompletedAt,

                    bootstrapDurationMs:
                        finalState
                            .bootstrapDurationMs,

                    lastHealthCheckAt:
                        finalState
                            .lastHealthCheckAt,

                    lastSavedAt:
                        finalState
                            .lastSavedAt,

                    lastLoadedAt:
                        finalState
                            .lastLoadedAt,

                    destroyedAt:
                        finalState
                            .destroyedAt,

                    bootstrapCount:
                        finalState
                            .bootstrapCount,

                    diagnosticCount:
                        finalState
                            .diagnosticCount,

                    saveCount:
                        finalState
                            .saveCount,

                    loadCount:
                        finalState
                            .loadCount,

                    errorCount:
                        finalState
                            .errorCount,

                    lastDiagnostic:
                        finalState
                            .lastDiagnostic,

                    lastHealth:
                        finalState
                            .lastHealth,

                    lastError:
                        finalState
                            .lastError,

                    configuration:
                        finalState
                            .configuration
                },

                reopening:
                    isValidReopeningInstance(
                        this.reopening
                    )
                        ? removeRuntimeValues(
                            this.reopening
                                .getCompleteReopeningStatus?.() ||
                            this.reopening
                                .getState?.() ||
                            null
                        )
                        : null,

                destroyed:
                    this.destroyed ===
                    true,

                timestamp:
                    now()
            });
        };

    /* ======================================================================
       SECTION 100
       BOOTSTRAP INTEGRATION
       ====================================================================== */

    IntegrationClass.prototype.bootstrapIntegration =
        async function bootstrapIntegration(
            options = {}
        ) {

            if (
                this.destroyed
            ) {
                return {
                    bootstrapped:
                        false,

                    status:
                        BOOTSTRAP_STATUS.DESTROYED,

                    reason:
                        "Integration instance is destroyed."
                };
            }

            const finalState =
                this.ensureFinalState();

            const safeOptions =
                safeObject(options);

            this.configureFinalLifecycle(
                safeOptions.final ||
                safeOptions.lifecycle ||
                {}
            );

            const record = {

                id:
                    createId(
                        "integration_bootstrap"
                    ),

                startedAt:
                    now(),

                completedAt:
                    null,

                durationMs:
                    0,

                status:
                    BOOTSTRAP_STATUS.STARTING,

                success:
                    false,

                phases:
                    {},

                error:
                    null
            };

            finalState.bootstrapHistory
                .push(
                    record
                );

            finalState.bootstrapCount +=
                1;

            finalState.bootstrapStartedAt =
                record.startedAt;

            finalState.bootstrapCompletedAt =
                null;

            finalState.bootstrapStatus =
                BOOTSTRAP_STATUS.STARTING;

            try {

                if (
                    finalState.configuration
                        .restoreIntegrationState ||
                    safeOptions.restoreState ===
                    true
                ) {
                    record.phases.restore =
                        this.loadIntegrationState(
                            safeOptions.persistence ||
                            {}
                        );
                }

                finalState.bootstrapStatus =
                    BOOTSTRAP_STATUS.DISCOVERING;

                record.status =
                    BOOTSTRAP_STATUS.DISCOVERING;

                record.phases.discovery =
                    this.discoverDependencies();

                finalState.bootstrapStatus =
                    BOOTSTRAP_STATUS.CONNECTING;

                record.status =
                    BOOTSTRAP_STATUS.CONNECTING;

                record.phases.connection =
                    await this.connect(
                        safeOptions.connection ||
                        {}
                    );

                if (
                    record.phases.connection
                        .connected !==
                    true
                ) {
                    throw new Error(
                        "Recovery reopening integration connection failed."
                    );
                }

                finalState.bootstrapStatus =
                    BOOTSTRAP_STATUS.REGISTERING;

                record.status =
                    BOOTSTRAP_STATUS.REGISTERING;

                record.phases.resources =
                    await this.initializeResources({
                        ...safeObject(
                            safeOptions.resources
                        ),

                        connection:
                            safeOptions.connection ||
                            {},

                        registration:
                            safeOptions.registration ||
                            {},

                        plan:
                            safeOptions.plan ||
                            {},

                        health:
                            safeOptions.health ||
                            {}
                    });

                if (
                    record.phases.resources
                        .initialized !==
                    true
                ) {
                    this.addIntegrationDiagnostic(
                        INTEGRATION_DIAGNOSTIC_LEVEL.WARNING,
                        "RESOURCE_INITIALIZATION_PARTIAL",
                        "Integration resources were not initialized completely.",
                        record.phases.resources
                    );
                }

                finalState.bootstrapStatus =
                    BOOTSTRAP_STATUS.INITIALIZING;

                record.status =
                    BOOTSTRAP_STATUS.INITIALIZING;

                if (
                    finalState.configuration
                        .initializeAutomation &&
                    safeOptions.initializeAutomation !==
                    false
                ) {
                    record.phases.automation =
                        await this
                            .initializeAutomation({
                                ...safeObject(
                                    safeOptions.automation
                                ),

                                connect:
                                    false,

                                prepare:
                                    false
                            });
                }

                if (
                    finalState.configuration
                        .startAutomation ||
                    safeOptions.startAutomation ===
                    true
                ) {
                    record.phases.start =
                        await this
                            .startAutomation({
                                ...safeObject(
                                    safeOptions.automation
                                ),

                                triggerImmediately:
                                    finalState
                                        .configuration
                                        .triggerReopeningImmediately ||
                                    safeOptions
                                        .triggerImmediately ===
                                        true
                            });
                }

                if (
                    finalState.configuration
                        .runFinalHealthCheck
                ) {
                    record.phases.health =
                        await this
                            .runCompleteIntegrationDiagnostics({
                                runResourceHealthChecks:
                                    true
                            });
                }

                const degraded =
                    record.phases.health &&
                    record.phases.health.status !==
                    INTEGRATION_HEALTH_STATUS.HEALTHY;

                finalState.bootstrapStatus =
                    degraded
                        ? BOOTSTRAP_STATUS.DEGRADED
                        : BOOTSTRAP_STATUS.READY;

                record.status =
                    finalState.bootstrapStatus;

                record.success =
                    true;

                record.completedAt =
                    now();

                record.durationMs =
                    record.completedAt -
                    record.startedAt;

                finalState.bootstrapCompletedAt =
                    record.completedAt;

                finalState.bootstrapDurationMs =
                    record.durationMs;

                this.state.completedAt =
                    record.completedAt;

                this.state.durationMs =
                    record.durationMs;

                if (
                    finalState.configuration
                        .saveIntegrationState
                ) {
                    record.phases.persistence =
                        this.saveIntegrationState(
                            safeOptions.persistence ||
                            {}
                        );
                }

                return {

                    bootstrapped:
                        true,

                    status:
                        record.status,

                    record:
                        deepClone(
                            removeRuntimeValues(
                                record
                            )
                        ),

                    integration:
                        this.getCompleteIntegrationStatus()
                };

            } catch (error) {

                const normalized =
                    normalizeError(
                        error
                    );

                record.success =
                    false;

                record.status =
                    BOOTSTRAP_STATUS.FAILED;

                record.completedAt =
                    now();

                record.durationMs =
                    record.completedAt -
                    record.startedAt;

                record.error =
                    normalized;

                finalState.bootstrapStatus =
                    BOOTSTRAP_STATUS.FAILED;

                finalState.bootstrapCompletedAt =
                    record.completedAt;

                finalState.bootstrapDurationMs =
                    record.durationMs;

                finalState.errorCount +=
                    1;

                finalState.lastError =
                    normalized;

                finalState.errors.push({

                    id:
                        createId(
                            "bootstrap_error"
                        ),

                    phase:
                        "bootstrap",

                    timestamp:
                        now(),

                    error:
                        normalized
                });

                this.state.status =
                    ADAPTER_STATUS.FAILED;

                this.addIntegrationDiagnostic(
                    INTEGRATION_DIAGNOSTIC_LEVEL.CRITICAL,
                    "BOOTSTRAP_FAILED",
                    "Recovery reopening integration bootstrap failed.",
                    {
                        error:
                            sanitizeError(
                                normalized
                            )
                    }
                );

                return {

                    bootstrapped:
                        false,

                    status:
                        BOOTSTRAP_STATUS.FAILED,

                    error:
                        sanitizeError(
                            normalized
                        ),

                    record:
                        deepClone(
                            removeRuntimeValues(
                                record
                            )
                        )
                };
            }
        };

    /* ======================================================================
       SECTION 101
       MANUAL COMPLETE REOPENING
       ====================================================================== */

    IntegrationClass.prototype.runCompleteReopening =
        async function runCompleteReopening(
            options = {}
        ) {

            const safeOptions =
                safeObject(options);

            if (
                this.ensureFinalState()
                    .bootstrapStatus !==
                BOOTSTRAP_STATUS.READY &&
                this.ensureFinalState()
                    .bootstrapStatus !==
                BOOTSTRAP_STATUS.DEGRADED
            ) {
                const bootstrap =
                    await this
                        .bootstrapIntegration({
                            ...safeOptions,

                            startAutomation:
                                false,

                            triggerImmediately:
                                false
                        });

                if (
                    bootstrap.bootstrapped !==
                    true
                ) {
                    return {

                        executed:
                            false,

                        phase:
                            "bootstrap",

                        bootstrap
                    };
                }
            }

            return this
                .triggerAutomaticReopening({

                    ...safeOptions,

                    trigger:
                        safeOptions.trigger ||
                        EXECUTION_TRIGGER.MANUAL,

                    ignoreCooldown:
                        safeOptions.ignoreCooldown !==
                        false
                });
        };

    /* ======================================================================
       SECTION 102
       INSTALL GLOBAL SHORTCUTS
       ====================================================================== */

    IntegrationClass.prototype.installGlobalShortcuts =
        function installGlobalShortcuts() {

            const finalState =
                this.ensureFinalState();

            if (
                finalState.configuration
                    .exposeShortcuts !==
                true
            ) {
                return {
                    installed:
                        false,

                    reason:
                        "Global shortcuts are disabled."
                };
            }

            const integration =
                this;

            global.getRecoveryReopeningIntegrationV32 =
                function getRecoveryReopeningIntegrationV32() {
                    return integration;
                };

            global.getRecoveryReopeningV32 =
                function getRecoveryReopeningV32() {
                    return (
                        integration
                            .getReopeningInstance() ||
                        null
                    );
                };

            global.getRecoveryReopeningIntegrationStatusV32 =
                function getRecoveryReopeningIntegrationStatusV32() {
                    return integration
                        .getCompleteIntegrationStatus();
                };

            global.bootstrapRecoveryReopeningIntegrationV32 =
                function bootstrapRecoveryReopeningIntegrationV32(
                    options
                ) {
                    return integration
                        .bootstrapIntegration(
                            options
                        );
                };

            global.startRecoveryReopeningV32 =
                function startRecoveryReopeningV32(
                    options
                ) {
                    return integration
                        .runCompleteReopening(
                            options
                        );
                };

            global.pauseRecoveryReopeningAutomationV32 =
                function pauseRecoveryReopeningAutomationV32() {
                    return integration
                        .pauseAutomation();
                };

            global.resumeRecoveryReopeningAutomationV32 =
                function resumeRecoveryReopeningAutomationV32() {
                    return integration
                        .resumeAutomation();
                };

            global.stopRecoveryReopeningAutomationV32 =
                function stopRecoveryReopeningAutomationV32() {
                    return integration
                        .stopAutomation();
                };

            global.runRecoveryReopeningDiagnosticsV32 =
                function runRecoveryReopeningDiagnosticsV32(
                    options
                ) {
                    return integration
                        .runCompleteIntegrationDiagnostics(
                            options
                        );
                };

            global.saveRecoveryReopeningIntegrationStateV32 =
                function saveRecoveryReopeningIntegrationStateV32(
                    options
                ) {
                    return integration
                        .saveIntegrationState(
                            options
                        );
                };

            global.clearRecoveryReopeningIntegrationStateV32 =
                function clearRecoveryReopeningIntegrationStateV32(
                    options
                ) {
                    return integration
                        .clearPersistedIntegrationState(
                            options
                        );
                };

            return {

                installed:
                    true,

                shortcuts: [
                    "getRecoveryReopeningIntegrationV32",
                    "getRecoveryReopeningV32",
                    "getRecoveryReopeningIntegrationStatusV32",
                    "bootstrapRecoveryReopeningIntegrationV32",
                    "startRecoveryReopeningV32",
                    "pauseRecoveryReopeningAutomationV32",
                    "resumeRecoveryReopeningAutomationV32",
                    "stopRecoveryReopeningAutomationV32",
                    "runRecoveryReopeningDiagnosticsV32",
                    "saveRecoveryReopeningIntegrationStateV32",
                    "clearRecoveryReopeningIntegrationStateV32"
                ]
            };
        };

    /* ======================================================================
       SECTION 103
       REMOVE GLOBAL SHORTCUTS
       ====================================================================== */

    IntegrationClass.prototype.removeGlobalShortcuts =
        function removeGlobalShortcuts() {

            const names = [
                "getRecoveryReopeningIntegrationV32",
                "getRecoveryReopeningV32",
                "getRecoveryReopeningIntegrationStatusV32",
                "bootstrapRecoveryReopeningIntegrationV32",
                "startRecoveryReopeningV32",
                "pauseRecoveryReopeningAutomationV32",
                "resumeRecoveryReopeningAutomationV32",
                "stopRecoveryReopeningAutomationV32",
                "runRecoveryReopeningDiagnosticsV32",
                "saveRecoveryReopeningIntegrationStateV32",
                "clearRecoveryReopeningIntegrationStateV32"
            ];

            let removed =
                0;

            names.forEach(
                (name) => {
                    if (
                        Object.prototype
                            .hasOwnProperty
                            .call(
                                global,
                                name
                            )
                    ) {
                        try {
                            delete global[
                                name
                            ];

                            removed +=
                                1;
                        } catch (_) {
                            global[name] =
                                undefined;
                        }
                    }
                }
            );

            return {
                removed
            };
        };

    /* ======================================================================
       SECTION 104
       EXTEND RECOVERY CORE WITH FINAL API
       ====================================================================== */

    IntegrationClass.prototype.extendRecoveryCoreFinalAPI =
        function extendRecoveryCoreFinalAPI() {

            const core =
                this.getDependency(
                    "recoveryCore"
                );

            if (!core) {
                return {
                    extended:
                        false,

                    reason:
                        "Recovery core is unavailable."
                };
            }

            const integration =
                this;

            core.bootstrapRecoveryReopening =
                function bootstrapRecoveryReopening(
                    options
                ) {
                    return integration
                        .bootstrapIntegration(
                            options
                        );
                };

            core.runCompleteRecoveryReopening =
                function runCompleteRecoveryReopening(
                    options
                ) {
                    return integration
                        .runCompleteReopening(
                            options
                        );
                };

            core.getCompleteRecoveryReopeningStatus =
                function getCompleteRecoveryReopeningStatus() {
                    return integration
                        .getCompleteIntegrationStatus();
                };

            core.runRecoveryReopeningDiagnostics =
                function runRecoveryReopeningDiagnostics(
                    options
                ) {
                    return integration
                        .runCompleteIntegrationDiagnostics(
                            options
                        );
                };

            core.saveRecoveryReopeningIntegrationState =
                function saveRecoveryReopeningIntegrationState(
                    options
                ) {
                    return integration
                        .saveIntegrationState(
                            options
                        );
                };

            core.destroyRecoveryReopeningIntegration =
                function destroyRecoveryReopeningIntegration(
                    options
                ) {
                    return integration
                        .destroyIntegration(
                            options
                        );
                };

            return {
                extended:
                    true
            };
        };

    /* ======================================================================
       SECTION 105
       DESTROY INTEGRATION
       ====================================================================== */

    IntegrationClass.prototype.destroyIntegration =
        async function destroyIntegration(
            options = {}
        ) {

            if (
                this.destroyed
            ) {
                return {
                    destroyed:
                        true,

                    alreadyDestroyed:
                        true
                };
            }

            const finalState =
                this.ensureFinalState();

            const safeOptions =
                safeObject(options);

            try {

                this.stopAutomation({
                    detachEvents:
                        true
                });

                if (
                    finalState.configuration
                        .saveIntegrationState &&
                    safeOptions.saveState !==
                    false
                ) {
                    this.saveIntegrationState(
                        safeOptions.persistence ||
                        {}
                    );
                }

                this.disconnect({
                    removeGlobal:
                        safeOptions.removeReopeningGlobal ===
                        true ||
                        finalState
                            .configuration
                            .removeGlobalInstanceOnDestroy
                });

                this.clearReopeningRegistrations();

                this.removeGlobalShortcuts();

                if (
                    (
                        safeOptions.destroyReopening ===
                        true ||
                        finalState
                            .configuration
                            .destroyReopeningInstance
                    ) &&
                    this.reopening
                ) {
                    const destroyMethod =
                        [
                            "destroy",
                            "dispose",
                            "shutdown"
                        ].find(
                            (methodName) => {
                                return (
                                    typeof this.reopening?.[
                                        methodName
                                    ] ===
                                    "function"
                                );
                            }
                        );

                    if (destroyMethod) {
                        await Promise.resolve(
                            this.reopening[
                                destroyMethod
                            ]()
                        );
                    }
                }

                this.events?.clear?.();

                this.reopening =
                    null;

                this.destroyed =
                    true;

                this.state.status =
                    ADAPTER_STATUS.DESTROYED;

                finalState.bootstrapStatus =
                    BOOTSTRAP_STATUS.DESTROYED;

                finalState.healthStatus =
                    INTEGRATION_HEALTH_STATUS.DESTROYED;

                finalState.destroyedAt =
                    now();

                const integrationGlobalName =
                    this.configuration
                        .integrationGlobalName;

                if (
                    integrationGlobalName &&
                    global[
                        integrationGlobalName
                    ] ===
                    this
                ) {
                    delete global[
                        integrationGlobalName
                    ];
                }

                return {

                    destroyed:
                        true,

                    destroyedAt:
                        finalState.destroyedAt
                };

            } catch (error) {

                const normalized =
                    normalizeError(
                        error
                    );

                finalState.lastError =
                    normalized;

                finalState.errorCount +=
                    1;

                return {

                    destroyed:
                        false,

                    error:
                        sanitizeError(
                            normalized
                        )
                };
            }
        };

    /* ======================================================================
       SECTION 106
       COMPATIBILITY ALIASES
       ====================================================================== */

    IntegrationClass.prototype.bootstrap =
        IntegrationClass.prototype
            .bootstrapIntegration;

    IntegrationClass.prototype.runComplete =
        IntegrationClass.prototype
            .runCompleteReopening;

    IntegrationClass.prototype.runDiagnostics =
        IntegrationClass.prototype
            .runCompleteIntegrationDiagnostics;

    IntegrationClass.prototype.getCompleteStatus =
        IntegrationClass.prototype
            .getCompleteIntegrationStatus;

    IntegrationClass.prototype.saveState =
        IntegrationClass.prototype
            .saveIntegrationState;

    IntegrationClass.prototype.loadState =
        IntegrationClass.prototype
            .loadIntegrationState;

    IntegrationClass.prototype.clearState =
        IntegrationClass.prototype
            .clearPersistedIntegrationState;

    IntegrationClass.prototype.destroy =
        IntegrationClass.prototype
            .destroyIntegration;

    /* ======================================================================
       SECTION 107
       GLOBAL INSTANCE CREATION
       ====================================================================== */

    function resolveOrCreateGlobalIntegrationInstance(
        options = {}
    ) {
        const safeOptions =
            safeObject(options);

        const globalName =
            safeOptions.integrationGlobalName ||
            "RecoveryReopeningIntegrationV32Instance";

        const existing =
            global[
                globalName
            ];

        if (
            existing instanceof
            IntegrationClass
        ) {
            return existing;
        }

        const instance =
            new IntegrationClass({
                ...safeOptions,

                integrationGlobalName:
                    globalName,

                autoConnect:
                    false,

                autoStart:
                    false
            });

        global[
            globalName
        ] =
            instance;

        return instance;
    }

    /* ======================================================================
       SECTION 108
       AUTOMATIC BOOTSTRAP
       ====================================================================== */

    function scheduleAutomaticIntegrationBootstrap(
        instance,
        options = {}
    ) {
        if (
            !(instance instanceof IntegrationClass)
        ) {
            return {
                scheduled:
                    false,

                reason:
                    "Invalid integration instance."
            };
        }

        const finalState =
            instance.ensureFinalState();

        instance.configureFinalLifecycle(
            options
        );

        instance.installGlobalShortcuts();

        instance.extendRecoveryCoreFinalAPI();

        if (
            finalState.configuration
                .autoBootstrap !==
            true
        ) {
            return {
                scheduled:
                    false,

                reason:
                    "Automatic bootstrap is disabled."
            };
        }

        const execute =
            () => {

                const delay =
                    finalState
                        .configuration
                        .bootstrapDelayMs;

                global.setTimeout(
                    () => {
                        instance
                            .bootstrapIntegration()
                            .catch(
                                (error) => {
                                    instance
                                        .addIntegrationDiagnostic(
                                            INTEGRATION_DIAGNOSTIC_LEVEL
                                                .CRITICAL,

                                            "AUTO_BOOTSTRAP_ERROR",

                                            "Automatic integration bootstrap failed.",

                                            {
                                                error:
                                                    sanitizeError(
                                                        error
                                                    )
                                            }
                                        );
                                }
                            );
                    },
                    delay
                );
            };

        if (
            finalState.configuration
                .bootstrapOnDOMContentLoaded &&
            global.document &&
            global.document.readyState ===
            "loading"
        ) {
            global.document
                .addEventListener(
                    "DOMContentLoaded",
                    execute,
                    {
                        once:
                            true
                    }
                );

            return {
                scheduled:
                    true,

                mode:
                    "DOMContentLoaded"
            };
        }

        execute();

        return {
            scheduled:
                true,

            mode:
                "immediate"
        };
    }

    /* ======================================================================
       SECTION 109
       FINAL GLOBAL EXPORTS
       ====================================================================== */

   global.RecoveryReopeningIntegrationV32 =
    IntegrationClass;
   global.RecoveryReopeningIntegrationV32Part5 = {

        INTEGRATION_DIAGNOSTIC_LEVEL,

        INTEGRATION_HEALTH_STATUS,

        STORAGE_STATUS,

        BOOTSTRAP_STATUS,

        DEFAULT_FINAL_CONFIGURATION,

        formatPercentage,

        sanitizeError,

        removeRuntimeValues,

        safeSerialize,

        resolveOrCreateGlobalIntegrationInstance,

        scheduleAutomaticIntegrationBootstrap
    };

    global.createRecoveryReopeningIntegrationV32 =
        function createRecoveryReopeningIntegrationV32(
            options
        ) {
            return new IntegrationClass(
                options
            );
        };

    global.initializeRecoveryReopeningIntegrationV32 =
        function initializeRecoveryReopeningIntegrationV32(
            options = {}
        ) {

            const instance =
                resolveOrCreateGlobalIntegrationInstance(
                    options
                );

            instance.configureFinalLifecycle(
                options.final ||
                {}
            );

            instance.installGlobalShortcuts();

            instance.extendRecoveryCoreFinalAPI();

            return instance;
        };

    /* ======================================================================
       SECTION 110
       DEFAULT GLOBAL INSTANCE
       ====================================================================== */

    const defaultIntegrationInstance =
        resolveOrCreateGlobalIntegrationInstance();

    defaultIntegrationInstance
        .ensureFinalState();

    defaultIntegrationInstance
        .installGlobalShortcuts();

    defaultIntegrationInstance
        .extendRecoveryCoreFinalAPI();

    scheduleAutomaticIntegrationBootstrap(
        defaultIntegrationInstance
    );

    /* ======================================================================
       SECTION 111
       COMPLETION FLAGS
       ====================================================================== */

    global.RecoveryReopeningIntegrationV32Completed =
        true;

    global.RecoveryReopeningIntegrationV32Version =
        VERSION;

    global.RecoveryReopeningIntegrationV32Build =
        BUILD;

    global.RecoveryReopeningIntegrationV32Ready =
        true;

})(window);

