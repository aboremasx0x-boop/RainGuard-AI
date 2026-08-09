/*
===============================================================================
 RainGuard AI
 Phase 39A-15C — Persistent Storm Observation Accumulator
 File: persistent_storm_observation_accumulator_v39.js
 Version: 39A.15C.0

 Purpose:
 - Persist storm observations across radar / tracking cycles.
 - Build true multi-point history per stable storm identity.
 - Feed Phase 39A-15B with repeated observations for the same track/cell.
 - Avoid default/fake motion values.
 - Keep observations bounded by age and per-identity limits.
===============================================================================
*/

(function initPersistentStormObservationAccumulatorV39(global) {
    "use strict";

    const PHASE = "39A-15C";
    const VERSION = "39A.15C.0";
    const BUILD = "rainguard-v39-persistent-storm-observation-accumulator";

    const CONFIG = Object.freeze({
        autoStart: true,
        intervalMs: 5000,

        maxAgeMs: 12 * 60 * 60 * 1000,
        maxObservationsPerIdentity: 24,
        minObservationGapMs: 3000,

        publishHistoryAliases: true,
        trigger15B: true,
        trigger14: true,

        maxCollectorRecords: 5000,
        maxMatchRecords: 5000,
        maxExportRecords: 5000
    });

    const now = () => Date.now();

    function finiteNumber(value) {
        const n = Number(value);
        return Number.isFinite(n) ? n : null;
    }

    function clone(value) {
        if (value == null) return value;

        try {
            return structuredClone(value);
        } catch (_) {
            try {
                return JSON.parse(JSON.stringify(value));
            } catch (_) {
                return value;
            }
        }
    }

    function normalizeTimestamp(value) {
        if (value == null) {
            return null;
        }

        if (
            typeof value === "number" &&
            Number.isFinite(value)
        ) {
            return value < 1e12
                ? value * 1000
                : value;
        }

        const parsed = Date.parse(value);

        return Number.isFinite(parsed)
            ? parsed
            : null;
    }

    function normalizeArray(value) {
        if (!value) {
            return [];
        }

        if (Array.isArray(value)) {
            return value;
        }

        if (value instanceof Map || value instanceof Set) {
            return Array.from(value.values());
        }

        if (typeof value === "object") {
            return [value];
        }

        return [];
    }

    function extractLatitude(record) {
        return finiteNumber(
            record?.latitude ??
            record?.lat ??
            record?.coordinate?.latitude ??
            record?.coordinate?.lat ??
            record?.position?.latitude ??
            record?.position?.lat ??
            record?.center?.latitude ??
            record?.center?.lat
        );
    }

    function extractLongitude(record) {
        return finiteNumber(
            record?.longitude ??
            record?.lon ??
            record?.lng ??
            record?.coordinate?.longitude ??
            record?.coordinate?.lon ??
            record?.coordinate?.lng ??
            record?.position?.longitude ??
            record?.position?.lon ??
            record?.position?.lng ??
            record?.center?.longitude ??
            record?.center?.lon ??
            record?.center?.lng
        );
    }

    function extractTimestamp(record) {
        return normalizeTimestamp(
            record?.timestamp ??
            record?.observedAt ??
            record?.time ??
            record?.ts ??
            record?.capturedAt ??
            record?.createdAt ??
            record?.updatedAt
        ) ?? now();
    }

    function extractTrackId(record) {
        const value =
            record?.trackId ??
            record?.stableTrackId ??
            record?.stormTrackId ??
            record?.entityId ??
            null;

        if (
            value == null ||
            !String(value).trim()
        ) {
            return null;
        }

        return String(value);
    }

    function extractCellId(record) {
        const value =
            record?.cellId ??
            record?.stormCellId ??
            record?.stormId ??
            record?.id ??
            null;

        if (
            value == null ||
            !String(value).trim()
        ) {
            return null;
        }

        return String(value);
    }

    function identityFor(record) {
        const trackId = extractTrackId(record);
        const cellId = extractCellId(record);

        if (trackId) {
            return {
                identity: `track:${trackId}`,
                identityType: "trackId",
                trackId,
                cellId
            };
        }

        if (cellId) {
            return {
                identity: `cell:${cellId}`,
                identityType: "cellId",
                trackId,
                cellId
            };
        }

        return {
            identity: null,
            identityType: null,
            trackId,
            cellId
        };
    }

    function normalizeObservation(record, sourceName) {
        if (
            !record ||
            typeof record !== "object"
        ) {
            return null;
        }

        const latitude = extractLatitude(record);
        const longitude = extractLongitude(record);

        if (
            latitude == null ||
            longitude == null
        ) {
            return null;
        }

        const identityInfo = identityFor(record);

        if (!identityInfo.identity) {
            return null;
        }

        const timestamp = extractTimestamp(record);

        return {
            identity:
                identityInfo.identity,

            identityType:
                identityInfo.identityType,

            trackId:
                identityInfo.trackId,

            cellId:
                identityInfo.cellId,

            latitude,
            longitude,

            coordinate: {
                latitude,
                longitude
            },

            observedAt:
                record?.observedAt ??
                new Date(timestamp).toISOString(),

            timestamp,

            confidence:
                finiteNumber(
                    record?.confidence
                ),

            intensity:
                finiteNumber(
                    record?.intensity
                ),

            source:
                record?.source ??
                sourceName,

            phase:
                PHASE,

            accumulatedAt:
                now()
        };
    }

    function resolveCollector() {
        return (
            global.RainArrivalStormEntityCollectorV32 ||
            global.RainGuardAI
                ?.V32
                ?.rainArrivalModules
                ?.stormEntityCollector ||
            null
        );
    }

    function resolveMatchBridge() {
        return (
            global.RainGuardCityStormEntityMatchingBridgeV39 ||
            global.RainGuardAI
                ?.V39
                ?.cityStormEntityMatchingBridge ||
            null
        );
    }

    function resolveExportBridge() {
        return (
            global.RainArrivalLiveStormExportBridge ||
            global.RainGuardAI
                ?.V32
                ?.rainArrivalModules
                ?.liveStormExportBridge ||
            null
        );
    }

    function collectCollectorEntities() {
        const collector = resolveCollector();

        if (!collector) {
            return [];
        }

        let records = [];

        try {
            if (collector.entities instanceof Map) {
                records.push(
                    ...Array.from(
                        collector.entities.values()
                    )
                );
            }
        } catch (_) {}

        try {
            if (typeof collector.getAll === "function") {
                records.push(
                    ...normalizeArray(
                        collector.getAll()
                    )
                );
            }
        } catch (_) {}

        return records.slice(
            0,
            CONFIG.maxCollectorRecords
        );
    }

    function collectMatchedEntities() {
        const bridge = resolveMatchBridge();

        const result =
            bridge?.lastResult ??
            global.RainGuardAI
                ?.V39
                ?.cityStormEntityMatching ??
            null;

        if (!result) {
            return [];
        }

        const output = [];

        try {
            if (Array.isArray(result.bestMatches)) {
                for (const match of result.bestMatches) {
                    output.push(
                        match?.rawStormEntity ??
                        match?.stormEntity ??
                        match
                    );
                }
            }
        } catch (_) {}

        try {
            if (
                result.matchesByCity &&
                typeof result.matchesByCity === "object"
            ) {
                for (
                    const value
                    of Object.values(
                        result.matchesByCity
                    )
                ) {
                    for (
                        const match
                        of normalizeArray(value)
                    ) {
                        output.push(
                            match?.rawStormEntity ??
                            match?.stormEntity ??
                            match
                        );
                    }
                }
            }
        } catch (_) {}

        return output.slice(
            0,
            CONFIG.maxMatchRecords
        );
    }

    function collectExportedEntities() {
        const candidates = [
            global.RainArrivalLiveStormEntitiesV32,
            global.RainGuardLiveStormEntitiesV39,
            global.RainGuardAI
                ?.V32
                ?.liveStormEntities,
            global.RainGuardAI
                ?.V39
                ?.liveStormEntities
        ];

        for (const candidate of candidates) {
            const arr = normalizeArray(candidate);

            if (arr.length > 0) {
                return arr.slice(
                    0,
                    CONFIG.maxExportRecords
                );
            }
        }

        const exportBridge = resolveExportBridge();

        try {
            if (typeof exportBridge?.getAll === "function") {
                return normalizeArray(
                    exportBridge.getAll()
                ).slice(
                    0,
                    CONFIG.maxExportRecords
                );
            }
        } catch (_) {}

        return [];
    }

    class PersistentStormObservationAccumulatorV39 {
        constructor() {
            this.phase = PHASE;
            this.version = VERSION;
            this.build = BUILD;

            this.running = false;
            this.runInProgress = false;
            this.timer = null;

            this.history = new Map();

            this.lastResult = null;
            this.lastError = null;

            this.statistics = {
                runs: 0,
                skippedRuns: 0,
                recordsScanned: 0,
                observationsAccepted: 0,
                observationsRejected: 0,
                duplicateObservations: 0,
                identitiesCreated: 0,
                identitiesWithMultiplePoints: 0,
                prunedObservations: 0,
                downstream15BTriggers: 0,
                downstream14Triggers: 0,
                failures: 0
            };
        }

        shouldAppend(bucket, observation) {
            if (
                !Array.isArray(bucket) ||
                bucket.length === 0
            ) {
                return true;
            }

            const last =
                bucket[
                    bucket.length - 1
                ];

            if (
                !last ||
                typeof last !== "object"
            ) {
                return true;
            }

            const deltaMs =
                observation.timestamp -
                last.timestamp;

            if (
                Math.abs(deltaMs) <
                CONFIG.minObservationGapMs
            ) {
                const sameLat =
                    Math.abs(
                        observation.latitude -
                        last.latitude
                    ) < 1e-7;

                const sameLon =
                    Math.abs(
                        observation.longitude -
                        last.longitude
                    ) < 1e-7;

                if (
                    sameLat &&
                    sameLon
                ) {
                    return false;
                }
            }

            return true;
        }

        append(observation) {
            if (!observation) {
                this.statistics
                    .observationsRejected += 1;

                return false;
            }

            if (
                !this.history.has(
                    observation.identity
                )
            ) {
                this.history.set(
                    observation.identity,
                    []
                );

                this.statistics
                    .identitiesCreated += 1;
            }

            const bucket =
                this.history.get(
                    observation.identity
                );

            if (
                !this.shouldAppend(
                    bucket,
                    observation
                )
            ) {
                this.statistics
                    .duplicateObservations += 1;

                return false;
            }

            bucket.push(
                observation
            );

            bucket.sort(
                (a, b) =>
                    a.timestamp -
                    b.timestamp
            );

            while (
                bucket.length >
                CONFIG.maxObservationsPerIdentity
            ) {
                bucket.shift();

                this.statistics
                    .prunedObservations += 1;
            }

            this.statistics
                .observationsAccepted += 1;

            return true;
        }

        prune() {
            const cutoff =
                now() -
                CONFIG.maxAgeMs;

            for (
                const [
                    identity,
                    bucket
                ]
                of this.history.entries()
            ) {
                const filtered =
                    bucket.filter(
                        observation =>
                            observation.timestamp >=
                            cutoff
                    );

                this.statistics
                    .prunedObservations +=
                    bucket.length -
                    filtered.length;

                if (
                    filtered.length === 0
                ) {
                    this.history.delete(
                        identity
                    );
                } else {
                    this.history.set(
                        identity,
                        filtered
                    );
                }
            }
        }

        collectCurrentObservations() {
            const sourceReports = [];

            const sources = [
                {
                    name:
                        "collector",

                    records:
                        collectCollectorEntities()
                },
                {
                    name:
                        "matching",

                    records:
                        collectMatchedEntities()
                },
                {
                    name:
                        "export",

                    records:
                        collectExportedEntities()
                }
            ];

            const observations = [];

            for (
                const source
                of sources
            ) {
                let acceptedFromSource = 0;

                for (
                    const record
                    of source.records
                ) {
                    const normalized =
                        normalizeObservation(
                            record,
                            source.name
                        );

                    if (normalized) {
                        observations.push(
                            normalized
                        );

                        acceptedFromSource += 1;
                    }
                }

                sourceReports.push({
                    source:
                        source.name,

                    scanned:
                        source.records.length,

                    normalized:
                        acceptedFromSource
                });
            }

            return {
                observations,
                sourceReports
            };
        }

        publish() {
            const liveHistory = {};
            const trackHistory = {};

            for (
                const [
                    identity,
                    bucket
                ]
                of this.history.entries()
            ) {
                liveHistory[
                    identity
                ] =
                    bucket.map(
                        clone
                    );

                trackHistory[
                    identity
                ] =
                    bucket.map(
                        clone
                    );
            }

            if (
                CONFIG.publishHistoryAliases
            ) {
                global
                    .RainArrivalLiveTrackHistory =
                    liveHistory;

                global
                    .RainArrivalTrackHistoryV32 =
                    trackHistory;
            }

            global
                .RainGuardPersistentStormObservationHistoryV39 =
                liveHistory;

            global.RainGuardAI =
                global.RainGuardAI || {};

            global.RainGuardAI.V39 =
                global.RainGuardAI.V39 || {};

            global
                .RainGuardAI
                .V39
                .persistentStormObservationHistory =
                liveHistory;
        }

        getSummary() {
            let observations = 0;
            let multiPoint = 0;

            for (
                const bucket
                of this.history.values()
            ) {
                observations +=
                    bucket.length;

                if (
                    bucket.length >= 2
                ) {
                    multiPoint += 1;
                }
            }

            return {
                identityCount:
                    this.history.size,

                observationCount:
                    observations,

                identitiesWithMultiplePoints:
                    multiPoint
            };
        }

        async triggerDownstream() {
            const downstream = {};

            if (
                CONFIG.trigger15B &&
                typeof global
                    .runRainGuardCrossHistoryMotionReconstruction ===
                    "function"
            ) {
                this.statistics
                    .downstream15BTriggers += 1;

                try {
                    downstream.phase39A15B =
                        await global
                            .runRainGuardCrossHistoryMotionReconstruction({
                                triggerDownstream:
                                    false
                            });
                } catch (error) {
                    downstream.phase39A15B = {
                        success:
                            false,

                        error:
                            String(
                                error?.message ??
                                error
                            )
                    };
                }
            }

            if (
                CONFIG.trigger14 &&
                typeof global
                    .runRainGuardMatchedStormArrivalEtaAdapter ===
                    "function"
            ) {
                this.statistics
                    .downstream14Triggers += 1;

                try {
                    downstream.phase39A14 =
                        await global
                            .runRainGuardMatchedStormArrivalEtaAdapter();
                } catch (error) {
                    downstream.phase39A14 = {
                        success:
                            false,

                        error:
                            String(
                                error?.message ??
                                error
                            )
                    };
                }
            }

            return downstream;
        }

        async run(
            options = {}
        ) {
            if (
                this.runInProgress
            ) {
                this.statistics
                    .skippedRuns += 1;

                return {
                    success:
                        true,

                    skipped:
                        true,

                    status:
                        "ACCUMULATOR_ALREADY_RUNNING",

                    phase:
                        PHASE,

                    version:
                        VERSION
                };
            }

            this.runInProgress =
                true;

            this.statistics
                .runs += 1;

            try {
                const capture =
                    this.collectCurrentObservations();

                this.statistics
                    .recordsScanned +=
                    capture.observations.length;

                let appendedCount = 0;

                for (
                    const observation
                    of capture.observations
                ) {
                    if (
                        this.append(
                            observation
                        )
                    ) {
                        appendedCount += 1;
                    }
                }

                this.prune();

                this.publish();

                const summary =
                    this.getSummary();

                this.statistics
                    .identitiesWithMultiplePoints =
                    summary
                        .identitiesWithMultiplePoints;

                const status =
                    summary
                        .identitiesWithMultiplePoints >
                    0
                        ? "PERSISTENT_STORM_HISTORY_READY"
                        : (
                            summary.identityCount >
                            0
                                ? "PERSISTENT_STORM_HISTORY_ACCUMULATING"
                                : "NO_STORM_OBSERVATIONS_AVAILABLE"
                        );

                const result = {
                    success:
                        true,

                    phase:
                        PHASE,

                    version:
                        VERSION,

                    build:
                        BUILD,

                    status,

                    appendedCount,

                    identityCount:
                        summary.identityCount,

                    observationCount:
                        summary.observationCount,

                    identitiesWithMultiplePoints:
                        summary
                            .identitiesWithMultiplePoints,

                    sourceReports:
                        capture.sourceReports,

                    generatedAt:
                        now()
                };

                if (
                    options.triggerDownstream !==
                    false
                ) {
                    result.downstream =
                        await this
                            .triggerDownstream();
                }

                this.lastResult =
                    result;

                this.lastError =
                    null;

                return result;

            } catch (error) {
                this.statistics
                    .failures += 1;

                this.lastError = {
                    name:
                        error?.name ??
                        "Error",

                    message:
                        error?.message ??
                        String(error),

                    stack:
                        error?.stack ??
                        null,

                    timestamp:
                        now()
                };

                this.lastResult = {
                    success:
                        false,

                    phase:
                        PHASE,

                    version:
                        VERSION,

                    status:
                        "PERSISTENT_STORM_OBSERVATION_ACCUMULATOR_FAILED",

                    error:
                        this.lastError,

                    generatedAt:
                        now()
                };

                return this.lastResult;

            } finally {
                this.runInProgress =
                    false;
            }
        }

        diagnose() {
            const summary =
                this.getSummary();

            const diagnostics = {
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

                identityCount:
                    summary.identityCount,

                observationCount:
                    summary.observationCount,

                identitiesWithMultiplePoints:
                    summary
                        .identitiesWithMultiplePoints,

                statistics:
                    clone(
                        this.statistics
                    ),

                lastResult:
                    clone(
                        this.lastResult
                    ),

                lastError:
                    clone(
                        this.lastError
                    )
            };

            console.log(
                "[RainGuard Phase 39A-15C] Persistent Storm Observation Accumulator",
                diagnostics
            );

            return diagnostics;
        }

        getAllHistory() {
            const output = {};

            for (
                const [
                    identity,
                    bucket
                ]
                of this.history.entries()
            ) {
                output[
                    identity
                ] =
                    bucket.map(
                        clone
                    );
            }

            return output;
        }

        getHistoryForIdentity(
            identity
        ) {
            return (
                this.history
                    .get(identity) ??
                []
            ).map(
                clone
            );
        }

        clear() {
            this.history.clear();

            this.publish();

            return {
                success:
                    true,

                identityCount:
                    0,

                observationCount:
                    0
            };
        }

        start() {
            if (
                this.running
            ) {
                return {
                    success:
                        true,

                    alreadyRunning:
                        true
                };
            }

            this.running =
                true;

            Promise.resolve(
                this.run()
            ).catch(
                error => {
                    this.lastError = {
                        name:
                            error?.name ??
                            "Error",

                        message:
                            error?.message ??
                            String(error),

                        timestamp:
                            now()
                    };
                }
            );

            this.timer =
                global.setInterval(
                    () => {
                        Promise.resolve(
                            this.run()
                        ).catch(
                            error => {
                                this.lastError = {
                                    name:
                                        error?.name ??
                                        "Error",

                                    message:
                                        error?.message ??
                                        String(error),

                                    timestamp:
                                        now()
                                };
                            }
                        );
                    },

                    CONFIG.intervalMs
                );

            return {
                success:
                    true,

                running:
                    true,

                intervalMs:
                    CONFIG.intervalMs
            };
        }

        stop() {
            if (
                this.timer
            ) {
                global.clearInterval(
                    this.timer
                );
            }

            this.timer =
                null;

            this.running =
                false;

            return {
                success:
                    true,

                running:
                    false
            };
        }
    }

    const accumulator =
        new PersistentStormObservationAccumulatorV39();

    global
        .RainGuardPersistentStormObservationAccumulatorV39 =
        accumulator;

    global.RainGuardAI =
        global.RainGuardAI || {};

    global.RainGuardAI.V39 =
        global.RainGuardAI.V39 || {};

    global
        .RainGuardAI
        .V39
        .persistentStormObservationAccumulator =
        accumulator;

    global
        .runRainGuardPersistentStormObservationAccumulator =
        options =>
            accumulator.run(
                options
            );

    global
        .diagnoseRainGuardPersistentStormObservationAccumulator =
        () =>
            accumulator.diagnose();

    global
        .getRainGuardPersistentStormObservationHistory =
        () =>
            accumulator.getAllHistory();

    global
        .getRainGuardPersistentStormObservationHistoryForIdentity =
        identity =>
            accumulator
                .getHistoryForIdentity(
                    identity
                );

    global
        .clearRainGuardPersistentStormObservationHistory =
        () =>
            accumulator.clear();

    console.log(
        `[RainGuard AI] Phase ${PHASE} — Persistent Storm Observation Accumulator v${VERSION} READY`
    );

    if (
        CONFIG.autoStart
    ) {
        accumulator.start();
    }

})(
    typeof globalThis !==
    "undefined"
        ? globalThis
        : window
);
