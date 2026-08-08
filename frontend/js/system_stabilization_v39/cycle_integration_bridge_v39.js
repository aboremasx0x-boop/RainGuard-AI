/*
===============================================================================
 RainGuard AI
 Phase 39A-7 — Cycle Integration Bridge

 File:
 frontend/js/system_stabilization_v39/cycle_integration_bridge_v39.js

 Version:
 39A.7.0

 Purpose:
 - Bridge Rain Arrival / Final Decision results to a unified national state.
 - Distinguish "no data" from "valid data but no active rain".
 - Provide highest-risk city and confidence for V30 Dashboard.
 - Avoid executing prediction engines; read existing results only.
 - Integrate with Phase 39 Engine Registry and System State Repository.
===============================================================================
*/

(function initializeRainGuardCycleIntegrationBridge(global) {
    "use strict";

    const NAME =
        "RainGuardCycleIntegrationBridgeV39";

    const PHASE =
        "39A-7";

    const VERSION =
        "39A.7.0";

    const BUILD =
        "rainguard-v39-cycle-integration-bridge";

    const DEFAULT_CONFIG =
        Object.freeze({
            enabled: true,

            refreshIntervalMs:
                3000,

            staleAfterMs:
                120000,

            minimumConfidence:
                0,

            debug:
                true,

            autoStart:
                true
        });

    const now =
        () => Date.now();


    function clone(value) {

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


    function normalizeNumber(
        value,
        fallback = null
    ) {

        const number =
            Number(value);

        return Number.isFinite(number)
            ? number
            : fallback;
    }


    function clamp(
        value,
        min,
        max
    ) {

        return Math.min(
            max,
            Math.max(
                min,
                value
            )
        );
    }


    function normalizePercent(
        value
    ) {

        const number =
            normalizeNumber(
                value,
                null
            );

        if (
            number === null
        ) {
            return null;
        }

        if (
            number >= 0 &&
            number <= 1
        ) {

            return clamp(
                number * 100,
                0,
                100
            );
        }

        return clamp(
            number,
            0,
            100
        );
    }


    function normalizeText(
        value
    ) {

        if (
            value === null ||
            value === undefined
        ) {
            return null;
        }

        const text =
            String(value)
                .trim();

        return text ||
            null;
    }


    function getEngineRegistry() {

        return (
            global
                .RainGuardEngineRegistryV39 ||

            global
                .RainGuardAI
                ?.V39
                ?.engineRegistry ||

            null
        );
    }


    function getStateRepository() {

        return (
            global
                .RainGuardSystemStateRepository ||

            global
                .RainGuardAI
                ?.V39
                ?.systemStateRepository ||

            null
        );
    }


    function getTimerManager() {

        return (
            global
                .RainGuardTimerManagerV39 ||

            global
                .RainGuardAI
                ?.V39
                ?.timerManager ||

            null
        );
    }


    function getRainArrivalInstance() {

        const registry =
            getEngineRegistry();

        if (
            registry &&
            typeof registry
                .getRainArrivalInstance ===
            "function"
        ) {

            const instance =
                registry
                    .getRainArrivalInstance();

            if (instance) {
                return instance;
            }
        }


        return (
            global.RainArrivalEngineV32 ||

            global
                .RainGuardAI
                ?.V32
                ?.rainArrivalModularEngine ||

            global
                .RainGuardAI
                ?.V32
                ?.rainArrivalPrediction ||

            null
        );
    }


    function getNestedCandidate(
        object,
        keys
    ) {

        if (
            !object ||
            typeof object !==
            "object"
        ) {
            return null;
        }

        for (
            const key
            of keys
        ) {

            if (
                object[key] !==
                undefined &&
                object[key] !==
                null
            ) {

                return object[key];
            }
        }

        return null;
    }


    function collectCandidateArrays(
        source
    ) {

        if (!source) {
            return [];
        }

        const arrays = [];

        const candidateKeys = [
            "predictions",
            "results",
            "cities",
            "items",
            "forecasts",
            "arrivalPredictions",
            "arrivalResults",
            "outputs",
            "rankedCandidates",
            "candidates"
        ];


        if (
            Array.isArray(source)
        ) {

            arrays.push(source);
        }


        if (
            typeof source ===
            "object"
        ) {

            for (
                const key
                of candidateKeys
            ) {

                if (
                    Array.isArray(
                        source[key]
                    )
                ) {

                    arrays.push(
                        source[key]
                    );
                }
            }


            const envelopeKeys = [
                "result",
                "output",
                "payload",
                "data",
                "decision",
                "summary"
            ];


            for (
                const envelopeKey
                of envelopeKeys
            ) {

                const nested =
                    source[
                        envelopeKey
                    ];

                if (
                    !nested ||
                    typeof nested !==
                    "object"
                ) {
                    continue;
                }


                if (
                    Array.isArray(
                        nested
                    )
                ) {

                    arrays.push(
                        nested
                    );
                }


                for (
                    const key
                    of candidateKeys
                ) {

                    if (
                        Array.isArray(
                            nested[key]
                        )
                    ) {

                        arrays.push(
                            nested[key]
                        );
                    }
                }
            }
        }

        return arrays;
    }


    function normalizeCityRecord(
        raw
    ) {

        if (
            !raw ||
            typeof raw !==
            "object"
        ) {
            return null;
        }


        const cityName =
            normalizeText(
                getNestedCandidate(
                    raw,
                    [
                        "city",
                        "cityName",
                        "name",
                        "locationName",
                        "targetCity",
                        "arabicName",
                        "nameAr"
                    ]
                )
            );


        if (!cityName) {
            return null;
        }


        const risk =
            normalizePercent(
                getNestedCandidate(
                    raw,
                    [
                        "risk",
                        "riskScore",
                        "riskPercent",
                        "danger",
                        "dangerScore",
                        "probability",
                        "rainProbability",
                        "score"
                    ]
                )
            );


        const confidence =
            normalizePercent(
                getNestedCandidate(
                    raw,
                    [
                        "confidence",
                        "confidenceScore",
                        "confidencePercent",
                        "verificationConfidence",
                        "aiConfidence"
                    ]
                )
            );


        const arrivalMinutes =
            normalizeNumber(
                getNestedCandidate(
                    raw,
                    [
                        "arrivalMinutes",
                        "etaMinutes",
                        "minutesToArrival",
                        "rainArrivalMinutes",
                        "eta"
                    ]
                ),
                null
            );


        const rainingValue =
            getNestedCandidate(
                raw,
                [
                    "raining",
                    "isRaining",
                    "rainDetected",
                    "hasRain",
                    "activeRain"
                ]
            );


        const isRaining =
            rainingValue === true ||
            risk > 0 ||
            (
                arrivalMinutes !== null &&
                arrivalMinutes >= 0
            );


        return {
            city:
                cityName,

            region:
                normalizeText(
                    getNestedCandidate(
                        raw,
                        [
                            "region",
                            "regionName",
                            "province",
                            "administrativeRegion"
                        ]
                    )
                ),

            risk:
                risk ?? 0,

            confidence:
                confidence ?? null,

            arrivalMinutes,

            isRaining,

            raw
        };
    }


    function deduplicateCities(
        records
    ) {

        const map =
            new Map();


        for (
            const record
            of records
        ) {

            if (!record) {
                continue;
            }


            const key =
                record.city
                    .toLowerCase();


            const existing =
                map.get(key);


            if (!existing) {

                map.set(
                    key,
                    record
                );

                continue;
            }


            if (
                record.risk >
                existing.risk
            ) {

                map.set(
                    key,
                    record
                );

                continue;
            }


            if (
                record.risk ===
                    existing.risk &&
                (
                    record.confidence ??
                    0
                ) >
                (
                    existing.confidence ??
                    0
                )
            ) {

                map.set(
                    key,
                    record
                );
            }
        }


        return Array.from(
            map.values()
        );
    }


    class CycleIntegrationBridgeV39 {

        constructor(
            config = {}
        ) {

            this.name =
                NAME;

            this.phase =
                PHASE;

            this.version =
                VERSION;

            this.build =
                BUILD;


            this.config = {
                ...DEFAULT_CONFIG,
                ...(config || {})
            };


            this.state = {

                initialized:
                    false,

                running:
                    false,

                connected:
                    false,

                dataAvailable:
                    false,

                activeRain:
                    false,

                status:
                    "WAITING_FOR_DATA",

                highestRiskCity:
                    null,

                highestRisk:
                    null,

                verificationConfidence:
                    null,

                cityCount:
                    0,

                activeRainCityCount:
                    0,

                lastUpdatedAt:
                    null,

                lastSourceTimestamp:
                    null,

                stale:
                    false,

                lastError:
                    null
            };


            this.cityRecords =
                [];

            this.timerName =
                "phase39a7-cycle-integration-refresh";


            this.ready =
                true;


            this.log(
                "Cycle Integration Bridge ready."
            );
        }


        log(
            message,
            data
        ) {

            if (!this.config.debug) {
                return;
            }


            console.log(
                `[RainGuard][${PHASE}][CycleIntegrationBridge] ${message}`,
                data !== undefined
                    ? data
                    : ""
            );
        }


        warn(
            message,
            data
        ) {

            console.warn(
                `[RainGuard][${PHASE}][CycleIntegrationBridge] ${message}`,
                data !== undefined
                    ? data
                    : ""
            );
        }


        error(
            message,
            data
        ) {

            console.error(
                `[RainGuard][${PHASE}][CycleIntegrationBridge] ${message}`,
                data !== undefined
                    ? data
                    : ""
            );
        }


        getSourceCandidates() {

            const engine =
                getRainArrivalInstance();


            if (!engine) {

                return {
                    engine:
                        null,

                    sources:
                        []
                };
            }


            const sources =
                [];


            const directCandidates = [
                engine.lastResult,
                engine.lastOutput,
                engine.lastPrediction,
                engine.lastDecision,
                engine.result,
                engine.output,
                engine.state,
                engine.diagnostics
            ];


            for (
                const source
                of directCandidates
            ) {

                if (
                    source &&
                    typeof source ===
                    "object"
                ) {

                    sources.push(
                        source
                    );
                }
            }


            if (
                typeof engine
                    .getDiagnostics ===
                "function"
            ) {

                try {

                    const diagnostics =
                        engine
                            .getDiagnostics();

                    if (
                        diagnostics
                    ) {

                        sources.push(
                            diagnostics
                        );
                    }

                } catch (_) {}
            }


            return {
                engine,
                sources
            };
        }


        collectCityRecords(
            sources
        ) {

            const records =
                [];


            for (
                const source
                of sources
            ) {

                const arrays =
                    collectCandidateArrays(
                        source
                    );


                for (
                    const array
                    of arrays
                ) {

                    for (
                        const raw
                        of array
                    ) {

                        const normalized =
                            normalizeCityRecord(
                                raw
                            );


                        if (normalized) {

                            records.push(
                                normalized
                            );
                        }
                    }
                }
            }


            return deduplicateCities(
                records
            );
        }


        calculateState(
            cityRecords,
            connected
        ) {

            const timestamp =
                now();


            if (!connected) {

                return {
                    initialized:
                        true,

                    running:
                        false,

                    connected:
                        false,

                    dataAvailable:
                        false,

                    activeRain:
                        false,

                    status:
                        "ENGINE_DISCONNECTED",

                    highestRiskCity:
                        null,

                    highestRisk:
                        null,

                    verificationConfidence:
                        null,

                    cityCount:
                        0,

                    activeRainCityCount:
                        0,

                    lastUpdatedAt:
                        timestamp,

                    lastSourceTimestamp:
                        null,

                    stale:
                        false,

                    lastError:
                        null
                };
            }


            if (
                !Array.isArray(
                    cityRecords
                ) ||
                cityRecords.length === 0
            ) {

                return {
                    initialized:
                        true,

                    running:
                        false,

                    connected:
                        true,

                    dataAvailable:
                        false,

                    activeRain:
                        false,

                    status:
                        "WAITING_FOR_DATA",

                    highestRiskCity:
                        null,

                    highestRisk:
                        null,

                    verificationConfidence:
                        null,

                    cityCount:
                        0,

                    activeRainCityCount:
                        0,

                    lastUpdatedAt:
                        timestamp,

                    lastSourceTimestamp:
                        null,

                    stale:
                        false,

                    lastError:
                        null
                };
            }


            const sorted =
                cityRecords
                    .slice()
                    .sort(
                        (a, b) =>
                            (
                                b.risk ??
                                0
                            ) -
                            (
                                a.risk ??
                                0
                            )
                    );


            const highest =
                sorted[0] ||
                null;


            const activeRainCities =
                sorted.filter(
                    city =>
                        city.isRaining ||
                        (
                            city.risk ??
                            0
                        ) > 0
                );


            const confidenceValues =
                sorted
                    .map(
                        city =>
                            city.confidence
                    )
                    .filter(
                        value =>
                            Number.isFinite(
                                value
                            )
                    );


            let verificationConfidence =
                null;


            if (
                highest &&
                Number.isFinite(
                    highest.confidence
                )
            ) {

                verificationConfidence =
                    highest.confidence;

            } else if (
                confidenceValues.length
            ) {

                verificationConfidence =
                    confidenceValues.reduce(
                        (
                            sum,
                            value
                        ) =>
                            sum +
                            value,
                        0
                    ) /
                    confidenceValues.length;
            }


            const hasActiveRain =
                activeRainCities.length >
                0;


            return {
                initialized:
                    true,

                running:
                    false,

                connected:
                    true,

                dataAvailable:
                    true,

                activeRain:
                    hasActiveRain,

                status:
                    hasActiveRain
                        ? "ACTIVE_RAIN"
                        : "NO_ACTIVE_RAIN",

                highestRiskCity:
                    hasActiveRain
                        ? highest?.city ||
                            null
                        : null,

                highestRisk:
                    hasActiveRain
                        ? highest?.risk ??
                            0
                        : 0,

                verificationConfidence:
                    verificationConfidence,

                cityCount:
                    cityRecords.length,

                activeRainCityCount:
                    activeRainCities.length,

                lastUpdatedAt:
                    timestamp,

                lastSourceTimestamp:
                    timestamp,

                stale:
                    false,

                lastError:
                    null
            };
        }


        publishState() {

            const snapshot =
                this.getNationalState();


            global.RainGuardAI =
                global.RainGuardAI ||
                {};


            global.RainGuardAI.V39 =
                global.RainGuardAI.V39 ||
                {};


            global.RainGuardAI.V39
                .nationalState =
                snapshot;


            global.RainGuardNationalStateV39 =
                snapshot;


            const repository =
                getStateRepository();


            if (
                repository &&
                typeof repository
                    .addEvent ===
                "function"
            ) {

                try {

                    repository
                        .addEvent(
                            "national_state_updated",
                            {
                                status:
                                    snapshot.status,

                                highestRiskCity:
                                    snapshot
                                        .highestRiskCity,

                                highestRisk:
                                    snapshot
                                        .highestRisk,

                                verificationConfidence:
                                    snapshot
                                        .verificationConfidence,

                                cityCount:
                                    snapshot
                                        .cityCount,

                                activeRainCityCount:
                                    snapshot
                                        .activeRainCityCount
                            }
                        );

                } catch (_) {}
            }


            try {

                global.dispatchEvent(
                    new CustomEvent(
                        "rainguard:v39:national-state-updated",
                        {
                            detail:
                                snapshot
                        }
                    )
                );

            } catch (_) {}


            return snapshot;
        }


        refresh() {

            if (
                !this.config.enabled
            ) {

                return this
                    .getNationalState();
            }


            this.state.running =
                true;


            try {

                const {
                    engine,
                    sources
                } =
                    this.getSourceCandidates();


                const connected =
                    Boolean(engine);


                const cityRecords =
                    this.collectCityRecords(
                        sources
                    );


                this.cityRecords =
                    cityRecords;


                this.state =
                    this.calculateState(
                        cityRecords,
                        connected
                    );


                this.state.running =
                    false;


                return this
                    .publishState();


            } catch (error) {

                this.state.running =
                    false;

                this.state.lastError = {
                    name:
                        error.name ||
                        "Error",

                    message:
                        error.message ||
                        String(error),

                    timestamp:
                        now()
                };


                this.state.status =
                    "BRIDGE_ERROR";


                this.error(
                    "National state refresh failed.",
                    this.state.lastError
                );


                return this
                    .publishState();
            }
        }


        getNationalState() {

            const state =
                clone(
                    this.state
                );


            state.cities =
                clone(
                    this.cityRecords
                );


            /*
             * UI-ready Arabic labels.
             */
            state.ui = {

                highestRiskCity:
                    state.status ===
                    "NO_ACTIVE_RAIN"
                        ? "لا توجد مدينة ممطرة"
                        : (
                            state
                                .highestRiskCity ||
                            "--"
                        ),

                highestRisk:
                    Number.isFinite(
                        state.highestRisk
                    )
                        ? `${Math.round(
                            state.highestRisk
                        )}%`
                        : "--",

                verificationConfidence:
                    Number.isFinite(
                        state
                            .verificationConfidence
                    )
                        ? `${Math.round(
                            state
                                .verificationConfidence
                        )}%`
                        : "—",

                nationalStatus:
                    state.status ===
                    "ACTIVE_RAIN"
                        ? "حالات مطر نشطة"
                        : state.status ===
                            "NO_ACTIVE_RAIN"
                            ? "لا توجد حالات مطر نشطة"
                            : state.status ===
                                "ENGINE_DISCONNECTED"
                                ? "محرك Rain Arrival غير متصل"
                                : state.status ===
                                    "WAITING_FOR_DATA"
                                    ? "بانتظار بيانات التحليل"
                                    : "حالة غير معروفة"
            };


            return state;
        }


        start() {

            if (
                this.state.initialized &&
                this.timerStarted
            ) {

                return {
                    started:
                        false,

                    reason:
                        "ALREADY_STARTED"
                };
            }


            this.refresh();


            const timerManager =
                getTimerManager();


            if (
                timerManager &&
                typeof timerManager
                    .registerInterval ===
                "function"
            ) {

                const result =
                    timerManager
                        .registerInterval(
                            this.timerName,
                            () =>
                                this.refresh(),
                            this.config
                                .refreshIntervalMs,
                            {
                                owner:
                                    NAME,

                                preventOverlap:
                                    true,

                                useRuntimeGuard:
                                    true,

                                maximumRuntimeMs:
                                    2000
                            }
                        );


                this.timerStarted =
                    Boolean(
                        result
                            ?.registered
                    );


                return {
                    started:
                        this.timerStarted,

                    via:
                        "TimerManager",

                    result
                };
            }


            /*
             * Safe fallback.
             */
            this.nativeTimer =
                global.setInterval(
                    () =>
                        this.refresh(),
                    this.config
                        .refreshIntervalMs
                );


            this.timerStarted =
                true;


            return {
                started:
                    true,

                via:
                    "native-setInterval"
            };
        }


        stop() {

            const timerManager =
                getTimerManager();


            if (
                timerManager &&
                typeof timerManager
                    .stop ===
                "function"
            ) {

                try {

                    timerManager.stop(
                        this.timerName,
                        "PHASE_39A7_STOP"
                    );

                } catch (_) {}
            }


            if (
                this.nativeTimer
            ) {

                global.clearInterval(
                    this.nativeTimer
                );

                this.nativeTimer =
                    null;
            }


            this.timerStarted =
                false;


            return {
                stopped:
                    true
            };
        }


        getDiagnostics() {

            return {
                name:
                    NAME,

                phase:
                    PHASE,

                version:
                    VERSION,

                build:
                    BUILD,

                ready:
                    this.ready,

                timerStarted:
                    Boolean(
                        this.timerStarted
                    ),

                state:
                    this.getNationalState(),

                cityRecordCount:
                    this.cityRecords.length
            };
        }


        printDiagnostics() {

            const diagnostics =
                this.getDiagnostics();


            console.log(
                "[RainGuard Phase 39A-7] Cycle Integration Bridge Diagnostics",
                diagnostics
            );


            if (
                diagnostics
                    .state
                    .cities
                    .length
            ) {

                console.table(
                    diagnostics
                        .state
                        .cities
                        .map(
                            city => ({
                                city:
                                    city.city,

                                region:
                                    city.region,

                                risk:
                                    city.risk,

                                confidence:
                                    city.confidence,

                                arrivalMinutes:
                                    city.arrivalMinutes,

                                raining:
                                    city.isRaining
                            })
                        )
                );
            }


            return diagnostics;
        }
    }


    const bridge =
        new CycleIntegrationBridgeV39();


    global.RainGuardCycleIntegrationBridgeV39 =
        bridge;


    global.RainGuardAI =
        global.RainGuardAI ||
        {};


    global.RainGuardAI.V39 =
        global.RainGuardAI.V39 ||
        {};


    global.RainGuardAI.V39
        .cycleIntegrationBridge =
        bridge;


    global.getRainGuardNationalState =
        function () {

            return bridge
                .getNationalState();
        };


    global.refreshRainGuardNationalState =
        function () {

            return bridge
                .refresh();
        };


    global.printRainGuardCycleIntegration =
        function () {

            return bridge
                .printDiagnostics();
        };


    console.log(
        `%c[RainGuard AI] Phase ${PHASE} — Cycle Integration Bridge v${VERSION} READY`,
        "font-weight:bold;color:#0f766e;"
    );


    if (
        bridge.config.autoStart
    ) {

        bridge.start();
    }


})(
    typeof globalThis !==
        "undefined"
        ? globalThis
        : window
);
