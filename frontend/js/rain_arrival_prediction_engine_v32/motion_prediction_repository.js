/*
===========================================================
 RainGuard AI V32
 Phase 38M-19A — Motion Prediction Repository
 File: motion_prediction_repository.js
 Version: 32.38M.19A

 Purpose:
 - Store all motion-prediction results.
 - Index by track, stable identity, city, confidence and time.
 - Provide cleanup, import/export and diagnostic APIs.
 - Publish a shared repository for ETA, candidate and decision engines.
===========================================================
*/

(function (global) {
    "use strict";

    const MODULE_NAME = "motionPredictionRepository";
    const VERSION = "32.38M.19A";
    const BUILD_ID = "rainguard-v32-phase38m19a-motion-prediction-repository";

    const DEFAULT_CONFIG = Object.freeze({
        autoStart: true,
        autoSyncIntervalMs: 12000,
        maximumPredictions: 5000,
        maximumAgeMs: 6 * 60 * 60 * 1000,
        minimumAcceptedConfidence: 20,
        keepRejectedPredictions: true,
        debug: true
    });

    const now = () => Date.now();

    function cloneValue(value) {
        if (value === null || value === undefined) return value;

        if (typeof structuredClone === "function") {
            try {
                return structuredClone(value);
            } catch (_) {}
        }

        try {
            return JSON.parse(JSON.stringify(value));
        } catch (_) {
            return value;
        }
    }

    function toFiniteNumber(value, fallback = null) {
        const number = Number(value);
        return Number.isFinite(number) ? number : fallback;
    }

    function parseTimestamp(value) {
        if (value === null || value === undefined) return null;

        const numeric = Number(value);

        if (Number.isFinite(numeric)) {
            if (numeric > 1e12) return numeric;
            if (numeric > 1e9) return numeric * 1000;
        }

        const parsed = Date.parse(value);
        return Number.isFinite(parsed) ? parsed : null;
    }

    function collectionToArray(value) {
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

        return typeof value === "object" ? Object.values(value) : [];
    }

    function normalizePrediction(input, index = 0) {
        if (!input || typeof input !== "object") return null;

        const trackId = String(
            input.trackId ??
            input.stableId ??
            input.id ??
            `PREDICTION-${index}`
        );

        const generatedAt =
            parseTimestamp(
                input.generatedAt ??
                input.completedAt ??
                input.latestTimestamp
            ) ?? now();

        const confidenceRaw = toFiniteNumber(
            input.confidence,
            0
        );

        const confidence = confidenceRaw <= 1
            ? confidenceRaw * 100
            : confidenceRaw;

        const accepted = Boolean(
            input.accepted ??
            (
                confidence >= 20 &&
                Array.isArray(input.predictions) &&
                input.predictions.some(item => item?.accepted !== false)
            )
        );

        return {
            ...cloneValue(input),
            trackId,
            stableId: String(input.stableId ?? trackId),
            city:
                input.city ??
                input.targetCity ??
                input.locationName ??
                null,
            status:
                input.status ??
                (accepted
                    ? "MOTION_PREDICTION_COMPLETED"
                    : "MOTION_PREDICTION_REJECTED"),
            confidence: Math.max(0, Math.min(100, confidence)),
            accepted,
            generatedAt,
            latestTimestamp:
                parseTimestamp(input.latestTimestamp) ??
                generatedAt,
            predictions: Array.isArray(input.predictions)
                ? cloneValue(input.predictions)
                : []
        };
    }

    class MotionPredictionRepository {
        constructor(config = {}) {
            this.version = VERSION;
            this.buildId = BUILD_ID;
            this.config = {
                ...DEFAULT_CONFIG,
                ...(config || {})
            };

            this.running = false;
            this.syncing = false;
            this.timer = null;

            this.store = new Map();
            this.trackIndex = new Map();
            this.stableTrackIndex = new Map();
            this.cityIndex = new Map();
            this.confidenceIndex = new Map();
            this.timestampIndex = [];

            this.latestResult = null;
            this.lastError = null;

            this.statistics = {
                syncRuns: 0,
                successfulSyncRuns: 0,
                failedSyncRuns: 0,
                storedPredictions: 0,
                replacedPredictions: 0,
                removedPredictions: 0,
                cleanupRuns: 0,
                importedPredictions: 0,
                exportedPredictions: 0
            };
        }

        buildKey(prediction) {
            return String(
                prediction.trackId ??
                prediction.stableId ??
                prediction.id
            );
        }

        clearIndexes() {
            this.trackIndex.clear();
            this.stableTrackIndex.clear();
            this.cityIndex.clear();
            this.confidenceIndex.clear();
            this.timestampIndex = [];
        }

        addToSetIndex(index, key, value) {
            if (key === null || key === undefined || key === "") return;

            const normalizedKey = String(key);

            if (!index.has(normalizedKey)) {
                index.set(normalizedKey, new Set());
            }

            index.get(normalizedKey).add(value);
        }

        rebuildIndexes() {
            this.clearIndexes();

            for (const [key, prediction] of this.store.entries()) {
                this.trackIndex.set(prediction.trackId, key);
                this.stableTrackIndex.set(prediction.stableId, key);

                this.addToSetIndex(
                    this.cityIndex,
                    prediction.city ?? "UNKNOWN",
                    key
                );

                const confidenceBand =
                    prediction.confidence >= 90 ? "90-100" :
                    prediction.confidence >= 75 ? "75-89" :
                    prediction.confidence >= 50 ? "50-74" :
                    prediction.confidence >= 25 ? "25-49" :
                    "0-24";

                this.addToSetIndex(
                    this.confidenceIndex,
                    confidenceBand,
                    key
                );

                this.timestampIndex.push({
                    key,
                    generatedAt: prediction.generatedAt
                });
            }

            this.timestampIndex.sort(
                (first, second) =>
                    second.generatedAt -
                    first.generatedAt
            );
        }

        storePrediction(input, options = {}) {
            const prediction = normalizePrediction(
                input,
                this.store.size
            );

            if (!prediction) {
                return {
                    success: false,
                    status: "INVALID_MOTION_PREDICTION"
                };
            }

            if (
                prediction.accepted === false &&
                this.config.keepRejectedPredictions === false
            ) {
                return {
                    success: true,
                    skipped: true,
                    status: "REJECTED_PREDICTION_SKIPPED",
                    trackId: prediction.trackId
                };
            }

            const key = this.buildKey(prediction);
            const exists = this.store.has(key);

            this.store.set(
                key,
                cloneValue(prediction)
            );

            if (exists) {
                this.statistics.replacedPredictions += 1;
            } else {
                this.statistics.storedPredictions += 1;
            }

            if (options.rebuildIndexes !== false) {
                this.rebuildIndexes();
            }

            return {
                success: true,
                status: exists
                    ? "MOTION_PREDICTION_REPLACED"
                    : "MOTION_PREDICTION_STORED",
                key,
                trackId: prediction.trackId,
                accepted: prediction.accepted,
                confidence: prediction.confidence
            };
        }

        storePredictions(inputs, options = {}) {
            const predictions = collectionToArray(inputs);
            const results = [];

            for (let index = 0; index < predictions.length; index += 1) {
                results.push(
                    this.storePrediction(
                        predictions[index],
                        {
                            rebuildIndexes: false
                        }
                    )
                );
            }

            this.enforceCapacity();
            this.rebuildIndexes();

            const result = {
                success: true,
                status: "MOTION_PREDICTIONS_STORED",
                inputCount: predictions.length,
                storedCount: results.filter(
                    item => item.success && item.skipped !== true
                ).length,
                skippedCount: results.filter(
                    item => item.skipped === true
                ).length,
                repositoryCount: this.store.size,
                generatedAt: now()
            };

            if (options.publish !== false) {
                this.publish(result);
            }

            return result;
        }

        resolveSourcePredictions() {
            const sources = [
                global.RainArrivalMotionPredictionAIV32
                    ?.getAllPredictions?.(),
                global.RainArrivalMotionPredictionAIEngineV32
                    ?.getAllPredictions?.(),
                global.RainArrivalMotionPredictionList,
                global.RainArrivalMotionPredictions,
                global.RainGuardAI?.V32?.motionPredictionList,
                global.RainGuardAI?.V32?.motionPredictions
            ];

            for (const source of sources) {
                const predictions = collectionToArray(source);

                if (predictions.length > 0) {
                    return predictions;
                }
            }

            return [];
        }

        syncFromPredictionEngine() {
            if (this.syncing) {
                return {
                    success: false,
                    status: "MOTION_PREDICTION_REPOSITORY_BUSY",
                    generatedAt: now()
                };
            }

            const startedAt = now();
            this.syncing = true;
            this.statistics.syncRuns += 1;

            try {
                const predictions = this.resolveSourcePredictions();

                const storeResult = this.storePredictions(
                    predictions,
                    {
                        publish: false
                    }
                );

                const cleanupResult = this.cleanup({
                    publish: false
                });

                this.statistics.successfulSyncRuns += 1;

                const result = {
                    success: true,
                    status: "MOTION_PREDICTION_REPOSITORY_UPDATED",
                    version: this.version,
                    build: this.buildId,
                    inputCount: predictions.length,
                    predictionCount: this.store.size,
                    acceptedCount: this.getAcceptedPredictions().length,
                    rejectedCount: this.getRejectedPredictions().length,
                    cityCount: this.cityIndex.size,
                    topPredictionConfidence:
                        this.getTopPrediction()?.confidence ?? null,
                    storeResult,
                    cleanupResult,
                    startedAt,
                    completedAt: now(),
                    durationMs: now() - startedAt
                };

                this.latestResult = cloneValue(result);
                this.publish(result);

                if (this.config.debug) {
                    console.log(
                        "[RainArrival MotionPredictionRepository] Sync result:",
                        result
                    );
                }

                return result;
            } catch (error) {
                this.statistics.failedSyncRuns += 1;

                this.lastError = {
                    name: error?.name ?? "Error",
                    message: error?.message ?? String(error),
                    stack: error?.stack ?? null,
                    timestamp: now()
                };

                const result = {
                    success: false,
                    status: "MOTION_PREDICTION_REPOSITORY_FAILED",
                    version: this.version,
                    build: this.buildId,
                    error: cloneValue(this.lastError),
                    startedAt,
                    completedAt: now(),
                    durationMs: now() - startedAt
                };

                this.latestResult = cloneValue(result);
                return result;
            } finally {
                this.syncing = false;
            }
        }

        enforceCapacity() {
            if (this.store.size <= this.config.maximumPredictions) {
                return 0;
            }

            const entries = Array.from(this.store.entries())
                .sort(
                    (first, second) =>
                        second[1].generatedAt -
                        first[1].generatedAt
                );

            const removeCount =
                entries.length -
                this.config.maximumPredictions;

            const keysToRemove = entries
                .slice(-removeCount)
                .map(entry => entry[0]);

            for (const key of keysToRemove) {
                this.store.delete(key);
            }

            this.statistics.removedPredictions += keysToRemove.length;
            return keysToRemove.length;
        }

        cleanup(options = {}) {
            const startedAt = now();
            const cutoff = now() - this.config.maximumAgeMs;
            const keysToRemove = [];

            for (const [key, prediction] of this.store.entries()) {
                if (
                    prediction.generatedAt < cutoff ||
                    !prediction.trackId
                ) {
                    keysToRemove.push(key);
                }
            }

            for (const key of keysToRemove) {
                this.store.delete(key);
            }

            const capacityRemoved = this.enforceCapacity();

            this.statistics.cleanupRuns += 1;
            this.statistics.removedPredictions += keysToRemove.length;

            this.rebuildIndexes();

            const result = {
                success: true,
                status: "MOTION_PREDICTION_REPOSITORY_CLEANED",
                staleRemovedCount: keysToRemove.length,
                capacityRemovedCount: capacityRemoved,
                repositoryCount: this.store.size,
                startedAt,
                completedAt: now(),
                durationMs: now() - startedAt
            };

            if (options.publish !== false) {
                this.publish(result);
            }

            return result;
        }

        getPrediction(trackId) {
            const normalizedTrackId = String(trackId);

            const directKey =
                this.trackIndex.get(normalizedTrackId) ??
                this.stableTrackIndex.get(normalizedTrackId) ??
                normalizedTrackId;

            return cloneValue(
                this.store.get(directKey) ?? null
            );
        }

        getAllPredictions() {
            return cloneValue(
                Array.from(this.store.values())
            );
        }

        getAcceptedPredictions() {
            return this.getAllPredictions().filter(
                prediction =>
                    prediction.accepted === true &&
                    prediction.confidence >=
                    this.config.minimumAcceptedConfidence
            );
        }

        getRejectedPredictions() {
            return this.getAllPredictions().filter(
                prediction =>
                    prediction.accepted !== true ||
                    prediction.confidence <
                    this.config.minimumAcceptedConfidence
            );
        }

        getTopPrediction() {
            return (
                this.getAcceptedPredictions()
                    .sort(
                        (first, second) =>
                            second.confidence -
                            first.confidence
                    )[0] ??
                null
            );
        }

        getPredictionsByCity(city) {
            const normalizedCity = String(city ?? "UNKNOWN");
            const keys = Array.from(
                this.cityIndex.get(normalizedCity) ?? []
            );

            return keys
                .map(key => cloneValue(this.store.get(key)))
                .filter(Boolean)
                .sort(
                    (first, second) =>
                        second.confidence -
                        first.confidence
                );
        }

        getPredictionsByConfidence(minimum, maximum = 100) {
            const minimumValue = toFiniteNumber(minimum, 0);
            const maximumValue = toFiniteNumber(maximum, 100);

            return this.getAllPredictions()
                .filter(
                    prediction =>
                        prediction.confidence >= minimumValue &&
                        prediction.confidence <= maximumValue
                )
                .sort(
                    (first, second) =>
                        second.confidence -
                        first.confidence
                );
        }

        getRecentPredictions(limit = 100) {
            return this.timestampIndex
                .slice(0, Math.max(0, Number(limit) || 0))
                .map(entry => cloneValue(this.store.get(entry.key)))
                .filter(Boolean);
        }

        removePrediction(trackId) {
            const normalizedTrackId = String(trackId);

            const key =
                this.trackIndex.get(normalizedTrackId) ??
                this.stableTrackIndex.get(normalizedTrackId) ??
                normalizedTrackId;

            const existed = this.store.delete(key);

            if (existed) {
                this.statistics.removedPredictions += 1;
                this.rebuildIndexes();
            }

            return {
                success: existed,
                status: existed
                    ? "MOTION_PREDICTION_REMOVED"
                    : "MOTION_PREDICTION_NOT_FOUND",
                trackId: normalizedTrackId
            };
        }

        clear() {
            const removedCount = this.store.size;

            this.store.clear();
            this.clearIndexes();
            this.statistics.removedPredictions += removedCount;

            this.publish({
                success: true,
                status: "MOTION_PREDICTION_REPOSITORY_CLEARED",
                removedCount,
                generatedAt: now()
            });

            return {
                success: true,
                removedCount
            };
        }

        export() {
            const payload = {
                module: MODULE_NAME,
                version: this.version,
                build: this.buildId,
                exportedAt: now(),
                predictionCount: this.store.size,
                predictions: this.getAllPredictions()
            };

            this.statistics.exportedPredictions += this.store.size;
            return cloneValue(payload);
        }

        import(payload, options = {}) {
            const predictions = collectionToArray(
                payload?.predictions ?? payload
            );

            if (options.replace === true) {
                this.store.clear();
            }

            const result = this.storePredictions(
                predictions,
                {
                    publish: false
                }
            );

            this.statistics.importedPredictions += predictions.length;

            const finalResult = {
                success: true,
                status: "MOTION_PREDICTION_REPOSITORY_IMPORTED",
                importedCount: predictions.length,
                repositoryCount: this.store.size,
                replace: options.replace === true,
                result
            };

            this.publish(finalResult);
            return finalResult;
        }

        publish(result) {
            const allPredictions = this.getAllPredictions();
            const acceptedPredictions = allPredictions.filter(
                prediction => prediction.accepted === true
            );

            global.RainArrivalMotionPredictionRepository = this;
            global.RainArrivalMotionPredictionStore =
                Object.fromEntries(
                    allPredictions.map(prediction => [
                        prediction.trackId,
                        cloneValue(prediction)
                    ])
                );

            global.RainArrivalMotionPredictionRepositoryResult =
                cloneValue(result);

            global.RainGuardAI = global.RainGuardAI || {};
            global.RainGuardAI.V32 = global.RainGuardAI.V32 || {};
            global.RainGuardAI.V32.motionPredictionRepository = this;
            global.RainGuardAI.V32.motionPredictionStore =
                cloneValue(global.RainArrivalMotionPredictionStore);
            global.RainGuardAI.V32.acceptedMotionPredictions =
                cloneValue(acceptedPredictions);

            global.dispatchEvent?.(
                new CustomEvent(
                    "rainarrival:motion-prediction-repository-updated",
                    {
                        detail: cloneValue(result)
                    }
                )
            );

            return result;
        }

        getLatestResult() {
            return cloneValue(this.latestResult);
        }

        getCount() {
            return this.store.size;
        }

        printTable() {
            const rows = this.getAllPredictions().map(
                prediction => ({
                    trackId: prediction.trackId,
                    stableId: prediction.stableId,
                    city: prediction.city,
                    status: prediction.status,
                    confidence: prediction.confidence,
                    accepted: prediction.accepted,
                    horizonCount:
                        prediction.predictions?.length ?? 0,
                    generatedAt:
                        new Date(prediction.generatedAt).toISOString()
                })
            );

            console.table(rows);
            return rows;
        }

        getDiagnostics() {
            return {
                module: MODULE_NAME,
                version: this.version,
                build: this.buildId,
                installed: true,
                running: this.running,
                syncing: this.syncing,
                predictionCount: this.store.size,
                acceptedCount: this.getAcceptedPredictions().length,
                rejectedCount: this.getRejectedPredictions().length,
                cityCount: this.cityIndex.size,
                trackIndexCount: this.trackIndex.size,
                stableTrackIndexCount: this.stableTrackIndex.size,
                timestampIndexCount: this.timestampIndex.length,
                latestResult: this.getLatestResult(),
                lastError: cloneValue(this.lastError),
                statistics: cloneValue(this.statistics),
                config: cloneValue(this.config)
            };
        }

        diagnose() {
            const diagnostics = this.getDiagnostics();

            console.log(
                "[RainArrival MotionPredictionRepository]",
                diagnostics
            );

            return diagnostics;
        }

        start() {
            if (this.running) {
                return {
                    success: true,
                    alreadyRunning: true
                };
            }

            this.running = true;
            this.syncFromPredictionEngine();

            this.timer = global.setInterval(
                () => this.syncFromPredictionEngine(),
                this.config.autoSyncIntervalMs
            );

            return {
                success: true,
                running: true,
                intervalMs: this.config.autoSyncIntervalMs
            };
        }

        stop() {
            if (this.timer) {
                global.clearInterval(this.timer);
            }

            this.timer = null;
            this.running = false;

            return {
                success: true,
                running: false
            };
        }
    }

    const repository = new MotionPredictionRepository();

    global.RainArrivalMotionPredictionRepositoryV32 = repository;
    global.RainArrivalMotionPredictionRepository = repository;

    global.RainGuardAI = global.RainGuardAI || {};
    global.RainGuardAI.V32 = global.RainGuardAI.V32 || {};
    global.RainGuardAI.V32.rainArrivalModules =
        global.RainGuardAI.V32.rainArrivalModules || {};

    global.RainGuardAI.V32.rainArrivalModules.motionPredictionRepository =
        repository;

    global.RainArrivalEngineV32?.register?.(
        MODULE_NAME,
        repository
    );

    global.RainArrivalOrchestratorV32?.register?.(
        MODULE_NAME,
        repository
    );

    global.syncRainArrivalMotionPredictionRepository =
        () => repository.syncFromPredictionEngine();

    if (repository.config.autoStart) {
        repository.start();
    }

    console.log(
        "[RainGuard AI V32] Motion Prediction Repository loaded.",
        {
            version: VERSION,
            build: BUILD_ID
        }
    );

})(
    typeof globalThis !== "undefined"
        ? globalThis
        : window
);
