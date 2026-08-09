/*
===============================================================================
 RainGuard AI
 Phase 39A-14 — Matched Storm → Arrival ETA Adapter
 File: matched_storm_arrival_eta_adapter_v39.js
 Version: 39A.14.0

 Purpose:
 - Consume Phase 39A-13 City ↔ Storm matching output.
 - Convert matched candidates into a stable Arrival ETA input contract.
 - Publish candidates for Phase 39A-11 Arrival ETA Pipeline Bridge.
 - Reuse real motion data only.
 - Never invent speed, direction, distance, or ETA values.
 - Expose diagnostics and compatibility globals for Phase 39A-10 integrity.
===============================================================================
*/

(function initializeMatchedStormArrivalEtaAdapterV39(global) {
    "use strict";

    const PHASE = "39A-14";
    const VERSION = "39A.14.0";
    const BUILD = "rainguard-v39-matched-storm-arrival-eta-adapter";

    const CONFIG = Object.freeze({
        autoStart: true,
        refreshIntervalMs: 4000,
        maximumCandidates: 500,
        maximumPerCity: 25,
        minimumSpeedKmh: 1,
        maximumEtaMinutes: 72 * 60,
        debug: true
    });

    const now = () => Date.now();

    function finite(value) {
        const n = Number(value);
        return Number.isFinite(n) ? n : null;
    }

    function normalizeError(error) {
        return {
            name: error?.name || "Error",
            message: error?.message || String(error),
            stack: error?.stack || null,
            timestamp: now()
        };
    }

    function toArray(value) {
        if (!value) return [];

        if (Array.isArray(value)) return value;

        if (value instanceof Map || value instanceof Set) {
            return Array.from(value.values());
        }

        if (typeof value.values === "function") {
            try {
                return Array.from(value.values());
            } catch (_) {}
        }

        if (typeof value === "object") {
            for (const key of [
                "bestMatches",
                "matches",
                "candidates",
                "items",
                "results",
                "result",
                "data",
                "payload",
                "output"
            ]) {
                const nested = value[key];

                if (Array.isArray(nested)) {
                    return nested;
                }

                if (
                    nested instanceof Map ||
                    nested instanceof Set
                ) {
                    return Array.from(nested.values());
                }
            }
        }

        return [];
    }

    function resolveMatchingBridge() {
        return (
            global.RainGuardCityStormEntityMatchingBridgeV39 ||
            global.RainGuardAI?.V39?.cityStormEntityMatchingBridge ||
            null
        );
    }

    function resolveMatchingResult() {
        return (
            global.RainGuardAI?.V39?.cityStormEntityMatching ||
            global.RainGuardAI?.V32?.cityStormEntityMatching ||
            resolveMatchingBridge()?.lastResult ||
            null
        );
    }

    function resolveArrivalEngine() {
        return (
            global.RainArrivalEngineV32 ||
            global.RainGuardAI?.V32?.rainArrivalEngine ||
            null
        );
    }

    function resolveEtaBridge() {
        return (
            global.RainGuardArrivalEtaPipelineBridgeV39 ||
            global.RainGuardAI?.V39?.arrivalEtaPipelineBridge ||
            null
        );
    }

    function extractCandidateSource() {
        const matchingResult =
            resolveMatchingResult();

        let items =
            toArray(
                matchingResult?.bestMatches
            );

        if (!items.length) {
            items =
                toArray(
                    global.RainGuardAI?.V32?.rainArrivalCandidates
                );
        }

        if (!items.length) {
            const bridge =
                resolveMatchingBridge();

            try {
                if (
                    bridge &&
                    typeof bridge.getAllMatches ===
                        "function"
                ) {
                    items =
                        toArray(
                            bridge.getAllMatches()
                        );
                }
            } catch (_) {}
        }

        return items;
    }

    function normalizeMatchedCandidate(raw, index) {
        if (!raw || typeof raw !== "object") {
            return null;
        }

        const distanceKm =
            finite(
                raw.distanceKm
            );

        const speedKmh =
            finite(
                raw.speedKmh ??
                raw.rawStormEntity?.speedKmh ??
                raw.rawStormEntity?.speed ??
                raw.rawStormEntity?.motion?.speedKmh ??
                raw.rawStormEntity?.motion?.speed ??
                raw.rawStormEntity?.motionVector?.speedKmh ??
                raw.rawStormEntity?.motionVector?.speed
            );

        const directionDeg =
            finite(
                raw.stormDirectionDeg ??
                raw.directionDeg ??
                raw.rawStormEntity?.directionDeg ??
                raw.rawStormEntity?.direction ??
                raw.rawStormEntity?.bearing ??
                raw.rawStormEntity?.motion?.directionDeg ??
                raw.rawStormEntity?.motion?.direction ??
                raw.rawStormEntity?.motionVector?.directionDeg ??
                raw.rawStormEntity?.motionVector?.direction
            );

        const cityLatitude =
            finite(
                raw.cityLatitude
            );

        const cityLongitude =
            finite(
                raw.cityLongitude
            );

        const stormLatitude =
            finite(
                raw.stormLatitude
            );

        const stormLongitude =
            finite(
                raw.stormLongitude
            );

        if (
            distanceKm === null ||
            cityLatitude === null ||
            cityLongitude === null ||
            stormLatitude === null ||
            stormLongitude === null
        ) {
            return null;
        }

        return {
            id:
                String(
                    raw.id ??
                    `${raw.cityId ?? "city"}:${raw.stormEntityId ?? index}`
                ),

            city: {
                id:
                    raw.cityId ??
                    null,

                name:
                    raw.cityName ??
                    null,

                nameEn:
                    raw.cityNameEn ??
                    null,

                region:
                    raw.cityRegion ??
                    null,

                latitude:
                    cityLatitude,

                longitude:
                    cityLongitude
            },

            stormEntity: {
                id:
                    raw.stormEntityId ??
                    null,

                latitude:
                    stormLatitude,

                longitude:
                    stormLongitude,

                speedKmh:
                    speedKmh,

                directionDeg:
                    directionDeg,

                raw:
                    raw.rawStormEntity ??
                    null
            },

            distanceKm,

            bearingToCityDeg:
                finite(
                    raw.bearingToCityDeg
                ),

            directionDifferenceDeg:
                finite(
                    raw.directionDifferenceDeg
                ),

            matchScore:
                finite(
                    raw.matchScore
                ),

            source:
                "Phase39A13-CityStormMatching",

            generatedAt:
                now()
        };
    }

    async function tryArrivalEnginePrediction(
        engine,
        candidate
    ) {
        if (!engine) {
            return null;
        }

        const payload = {
            storm:
                candidate.stormEntity.raw ||
                candidate.stormEntity,

            entity:
                candidate.stormEntity.raw ||
                candidate.stormEntity,

            stormEntity:
                candidate.stormEntity.raw ||
                candidate.stormEntity,

            city:
                candidate.city,

            target:
                candidate.city,

            distanceKm:
                candidate.distanceKm,

            matchScore:
                candidate.matchScore
        };

        for (const method of [
            "predictArrival",
            "predictArrivalForTarget",
            "predict",
            "evaluateArrival",
            "calculateArrival",
            "estimateArrival",
            "runPrediction"
        ]) {
            if (
                typeof engine?.[method] !==
                "function"
            ) {
                continue;
            }

            try {
                const result =
                    await Promise.resolve(
                        engine[method](
                            payload
                        )
                    );

                const minutes =
                    finite(
                        result?.arrivalMinutes ??
                        result?.etaMinutes ??
                        result?.minutes ??
                        result?.arrival?.minutes ??
                        result?.eta?.minutes
                    );

                if (
                    minutes !== null &&
                    minutes >= 0
                ) {
                    return {
                        arrivalMinutes:
                            Math.round(
                                minutes
                            ),

                        source:
                            `engine.${method}`,

                        rawResult:
                            result
                    };
                }
            } catch (_) {}
        }

        return null;
    }

    function calculateDeterministicEta(candidate) {
        const speedKmh =
            finite(
                candidate
                    .stormEntity
                    .speedKmh
            );

        if (
            speedKmh === null ||
            speedKmh <
                CONFIG.minimumSpeedKmh
        ) {
            return null;
        }

        const etaMinutes =
            Math.round(
                (
                    candidate.distanceKm /
                    speedKmh
                ) *
                60
            );

        if (
            etaMinutes < 0 ||
            etaMinutes >
                CONFIG.maximumEtaMinutes
        ) {
            return null;
        }

        return {
            arrivalMinutes:
                etaMinutes,

            source:
                "phase39a14-distance-speed",

            speedKmh:
                speedKmh
        };
    }

    class MatchedStormArrivalEtaAdapterV39 {
        constructor() {
            this.phase = PHASE;
            this.version = VERSION;
            this.build = BUILD;

            this.running = false;
            this.runInProgress = false;
            this.timer = null;

            this.lastResult = null;
            this.lastError = null;

            this.statistics = {
                runs: 0,
                skippedRuns: 0,
                sourceCandidates: 0,
                normalizedCandidates: 0,
                engineEtaCandidates: 0,
                deterministicEtaCandidates: 0,
                candidatesWithoutMotion: 0,
                publishedCandidates: 0,
                failures: 0
            };
        }

        async run() {
            if (this.runInProgress) {
                this.statistics.skippedRuns += 1;

                return {
                    success: true,
                    skipped: true,
                    status:
                        "MATCHED_STORM_ETA_ADAPTER_ALREADY_RUNNING"
                };
            }

            this.runInProgress = true;
            this.statistics.runs += 1;

            try {
                const sourceCandidates =
                    extractCandidateSource();

                this.statistics.sourceCandidates +=
                    sourceCandidates.length;

                const normalized =
                    sourceCandidates
                        .map(
                            normalizeMatchedCandidate
                        )
                        .filter(Boolean)
                        .slice(
                            0,
                            CONFIG.maximumCandidates
                        );

                this.statistics.normalizedCandidates +=
                    normalized.length;

                const engine =
                    resolveArrivalEngine();

                const ready =
                    [];

                for (const candidate of normalized) {
                    let eta =
                        await tryArrivalEnginePrediction(
                            engine,
                            candidate
                        );

                    if (eta) {
                        this.statistics.engineEtaCandidates += 1;
                    } else {
                        eta =
                            calculateDeterministicEta(
                                candidate
                            );

                        if (eta) {
                            this.statistics.deterministicEtaCandidates += 1;
                        }
                    }

                    if (!eta) {
                        this.statistics.candidatesWithoutMotion += 1;

                        ready.push({
                            ...candidate,

                            arrivalMinutes:
                                null,

                            etaStatus:
                                "ETA_PENDING_MOTION",

                            etaSource:
                                null
                        });

                        continue;
                    }

                    ready.push({
                        ...candidate,

                        arrivalMinutes:
                            eta.arrivalMinutes,

                        etaStatus:
                            "ETA_READY",

                        etaSource:
                            eta.source,

                        resolvedSpeedKmh:
                            eta.speedKmh ??
                            candidate
                                .stormEntity
                                .speedKmh ??
                            null
                    });
                }

                ready.sort(
                    (a, b) => {
                        const aEta =
                            a.arrivalMinutes === null
                                ? Infinity
                                : a.arrivalMinutes;

                        const bEta =
                            b.arrivalMinutes === null
                                ? Infinity
                                : b.arrivalMinutes;

                        if (aEta !== bEta) {
                            return aEta - bEta;
                        }

                        return (
                            (b.matchScore ?? 0) -
                            (a.matchScore ?? 0)
                        );
                    }
                );

                /*
                 * Keep only the best candidates per city for downstream use.
                 */
                const perCityCount =
                    new Map();

                const published =
                    [];

                for (const item of ready) {
                    const key =
                        String(
                            item.city.id ??
                            item.city.name ??
                            "unknown"
                        );

                    const count =
                        perCityCount.get(
                            key
                        ) || 0;

                    if (
                        count >=
                        CONFIG.maximumPerCity
                    ) {
                        continue;
                    }

                    perCityCount.set(
                        key,
                        count + 1
                    );

                    published.push(
                        item
                    );
                }

                const etaReadyCount =
                    published.filter(
                        item =>
                            item.arrivalMinutes !==
                            null
                    ).length;

                const status =
                    published.length === 0
                        ? "NO_MATCHED_STORM_CANDIDATES"
                        : (
                            etaReadyCount > 0
                                ? "ARRIVAL_ETA_CANDIDATES_READY"
                                : "ARRIVAL_ETA_CANDIDATES_WAITING_FOR_MOTION"
                        );

                const best =
                    published.find(
                        item =>
                            item.arrivalMinutes !==
                            null
                    ) ||
                    null;

                const result = {
                    success: true,

                    phase:
                        PHASE,

                    version:
                        VERSION,

                    status,

                    sourceCount:
                        sourceCandidates.length,

                    normalizedCount:
                        normalized.length,

                    publishedCount:
                        published.length,

                    etaReadyCount,

                    etaPendingCount:
                        published.length -
                        etaReadyCount,

                    arrivalMinutes:
                        best?.arrivalMinutes ??
                        null,

                    best,

                    candidates:
                        published,

                    generatedAt:
                        now()
                };

                this.statistics.publishedCandidates +=
                    published.length;

                this.lastResult =
                    result;

                this.lastError =
                    null;

                this.publish(
                    result
                );

                return result;

            } catch (error) {
                this.statistics.failures += 1;

                this.lastError =
                    normalizeError(
                        error
                    );

                const result = {
                    success: false,

                    phase:
                        PHASE,

                    version:
                        VERSION,

                    status:
                        "MATCHED_STORM_ARRIVAL_ETA_ADAPTER_FAILED",

                    error:
                        this.lastError,

                    generatedAt:
                        now()
                };

                this.lastResult =
                    result;

                return result;

            } finally {
                this.runInProgress =
                    false;
            }
        }

        publish(result) {
            global.RainGuardAI =
                global.RainGuardAI || {};

            global.RainGuardAI.V39 =
                global.RainGuardAI.V39 || {};

            global.RainGuardAI.V32 =
                global.RainGuardAI.V32 || {};

            global.RainGuardAI.V39
                .matchedStormArrivalEtaAdapter =
                result;

            global.RainGuardAI.V32
                .arrivalEtaMatchedCandidates =
                result.candidates;

            /*
             * Stable compatibility aliases for Phase 39A-11 and future
             * integrity checks.
             */
            global.RainGuardAI.V32
                .rainArrivalCandidates =
                result.candidates;

            global.RainGuardAI.V32
                .arrivalEtaCandidates =
                result.candidates;

            global.RainGuardMatchedStormArrivalCandidatesV39 =
                result.candidates;

            global.RainGuardArrivalEtaCandidateFeedV39 =
                {
                    phase:
                        PHASE,

                    version:
                        VERSION,

                    status:
                        result.status,

                    arrivalMinutes:
                        result.arrivalMinutes,

                    best:
                        result.best,

                    candidates:
                        result.candidates,

                    count:
                        result.publishedCount,

                    etaReadyCount:
                        result.etaReadyCount,

                    generatedAt:
                        result.generatedAt
                };

            /*
             * If Phase 39A-11 exposes a mutable state object, publish the
             * candidate feed there as well without forcing it to rerun.
             */
            const etaBridge =
                resolveEtaBridge();

            if (
                etaBridge &&
                typeof etaBridge ===
                    "object"
            ) {
                try {
                    etaBridge.matchedCandidates =
                        result.candidates;

                    etaBridge.candidateFeed =
                        global.RainGuardArrivalEtaCandidateFeedV39;
                } catch (_) {}
            }
        }

        diagnose() {
            const result = {
                phase:
                    PHASE,

                version:
                    VERSION,

                build:
                    BUILD,

                running:
                    this.running,

                runInProgress:
                    this.runInProgress,

                lastError:
                    this.lastError,

                statistics:
                    {
                        ...this.statistics
                    },

                result:
                    this.lastResult
            };

            console.log(
                "[RainGuard Phase 39A-14] Matched Storm → Arrival ETA Adapter",
                result
            );

            return result;
        }

        start() {
            if (this.running) {
                return {
                    success: true,
                    alreadyRunning: true
                };
            }

            this.running = true;

            Promise.resolve(
                this.run()
            ).catch(
                error => {
                    this.lastError =
                        normalizeError(
                            error
                        );
                }
            );

            this.timer =
                global.setInterval(
                    () => {
                        Promise.resolve(
                            this.run()
                        ).catch(
                            error => {
                                this.lastError =
                                    normalizeError(
                                        error
                                    );
                            }
                        );
                    },

                    CONFIG.refreshIntervalMs
                );

            return {
                success: true,
                running: true,
                intervalMs:
                    CONFIG.refreshIntervalMs
            };
        }

        stop() {
            if (this.timer) {
                global.clearInterval(
                    this.timer
                );
            }

            this.timer = null;
            this.running = false;
            this.runInProgress = false;

            return {
                success: true,
                running: false
            };
        }
    }

    const adapter =
        new MatchedStormArrivalEtaAdapterV39();

    global.RainGuardMatchedStormArrivalEtaAdapterV39 =
        adapter;

    global.RainGuardAI =
        global.RainGuardAI || {};

    global.RainGuardAI.V39 =
        global.RainGuardAI.V39 || {};

    global.RainGuardAI.V39
        .matchedStormArrivalEtaAdapterInstance =
        adapter;

    global.runRainGuardMatchedStormArrivalEtaAdapter =
        () =>
            adapter.run();

    global.diagnoseRainGuardMatchedStormArrivalEtaAdapter =
        () =>
            adapter.diagnose();

    global.getRainGuardArrivalEtaCandidateFeed =
        () =>
            global.RainGuardArrivalEtaCandidateFeedV39 ||
            null;

    console.log(
        `[RainGuard AI] Phase ${PHASE} — Matched Storm → Arrival ETA Adapter v${VERSION} READY`
    );

    if (
        CONFIG.autoStart
    ) {
        adapter.start();
    }

})(
    typeof globalThis !== "undefined"
        ? globalThis
        : window
);
