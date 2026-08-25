/*
============================================================
RainGuard AI V39
Phase 39A-15F6N4B1B3C1
Cross-Cycle Persistent Temporal Coordinate History Bridge
Bounded Storage & Quota Recovery Guard
============================================================

Purpose
-------
- Add bounded localStorage persistence with automatic compaction.
- Recover automatically from QuotaExceededError without breaking the cycle.
- Persist valid storm coordinates across capture cycles.
- Preserve observations by stable/canonical identity.
- Reject placeholder (0,0) coordinates.
- Avoid duplicate same-time/same-coordinate observations.
- Track coordinate diversity and motion-readiness.
- Publish a canonical temporal-history source for downstream motion recovery.

Target path
-----------
frontend/js/rain_arrival_prediction_engine_v32/
cross_cycle_persistent_temporal_coordinate_history_bridge_39a15f6n4b1b3c.js
*/

(function (global) {
    "use strict";

    const PHASE = "39A-15F6N4B1B3C";
    const VERSION = "39A.15F6N4B1B3C1.0";
    const BUILD = "rainguard-v39-cross-cycle-persistent-temporal-coordinate-history-bridge-bounded-storage-quota-recovery";
    const STORAGE_KEY = "RainGuard:39A15F6N4B1B3C:TemporalCoordinateHistory:v1";
    const MAX_POINTS_PER_IDENTITY = 24;
    const MAX_IDENTITIES = 1200;
    const AUTO_INTERVAL_MS = 15000;

    // Phase 39A-15F6N4B1B3C1 — bounded storage + quota recovery
    const STORAGE_SOFT_LIMIT_BYTES = 3_500_000;
    const STORAGE_TARGET_BYTES = 2_500_000;
    const MIN_POINTS_PER_IDENTITY = 2;
    const QUOTA_RETRY_LIMIT = 3;

    const RESULT_NAME = "RainGuard39A15F6N4B1B3CResultV39";
    const BRIDGE_NAME = "RainGuard39A15F6N4B1B3CBridgeV39";
    const STORE_NAME = "RainGuardN4B1B3CTemporalCoordinateHistoryV39";
    const RUN_NAME = "runRainGuard39A15F6N4B1B3CCrossCyclePersistentTemporalCoordinateHistoryBridge";
    const GET_ALL_NAME = "getRainGuardN4B1B3CTemporalCoordinateHistory";
    const GET_ONE_NAME = "getRainGuardN4B1B3CTemporalCoordinateHistoryForIdentity";
    const CLEAR_NAME = "clearRainGuardN4B1B3CTemporalCoordinateHistory";

    function now() {
        return Date.now();
    }

    function finiteNumber(value) {
        if (value === null || value === undefined || value === "") return null;
        const number = Number(value);
        return Number.isFinite(number) ? number : null;
    }

    function normalizeCoordinate(value) {
        if (!value) return null;

        let lat = null;
        let lon = null;

        if (Array.isArray(value) && value.length >= 2) {
            const a = finiteNumber(value[0]);
            const b = finiteNumber(value[1]);

            if (a === null || b === null) return null;

            // Prefer [lon, lat] only when the first number cannot be latitude.
            if (Math.abs(a) > 90 && Math.abs(b) <= 90) {
                lat = b;
                lon = a;
            } else {
                lat = a;
                lon = b;
            }
        } else if (typeof value === "object") {
            lat = finiteNumber(
                value.latitude ??
                value.lat ??
                value.y ??
                value.currentCoordinate?.latitude ??
                value.currentCoordinate?.lat ??
                value.coordinate?.latitude ??
                value.coordinate?.lat ??
                value.center?.latitude ??
                value.center?.lat
            );

            lon = finiteNumber(
                value.longitude ??
                value.lon ??
                value.lng ??
                value.x ??
                value.currentCoordinate?.longitude ??
                value.currentCoordinate?.lon ??
                value.currentCoordinate?.lng ??
                value.coordinate?.longitude ??
                value.coordinate?.lon ??
                value.coordinate?.lng ??
                value.center?.longitude ??
                value.center?.lon ??
                value.center?.lng
            );
        }

        if (
            lat === null ||
            lon === null ||
            lat < -90 ||
            lat > 90 ||
            lon < -180 ||
            lon > 180 ||
            (lat === 0 && lon === 0)
        ) {
            return null;
        }

        return {
            lat,
            lon,
            lng: lon,
            latitude: lat,
            longitude: lon
        };
    }

    function normalizeIdentity(entity) {
        if (!entity || typeof entity !== "object") return null;

        const raw =
            entity.canonicalTrackId ??
            entity.stableTrackId ??
            entity.trackId ??
            entity.cellId ??
            entity.identity ??
            entity.id ??
            null;

        if (raw === null || raw === undefined) return null;

        const value = String(raw).trim();
        return value || null;
    }

    function normalizeTimestamp(entity) {
        const candidates = [
            entity?.observedAt,
            entity?.timestamp,
            entity?.updatedAt,
            entity?.capturedAt,
            entity?.generatedAt,
            entity?.time,
            entity?.currentCoordinate?.timestamp,
            entity?.coordinate?.timestamp,
            entity?.center?.timestamp
        ];

        for (const candidate of candidates) {
            if (candidate === null || candidate === undefined) continue;

            const numeric = Number(candidate);
            if (Number.isFinite(numeric) && numeric > 0) {
                return numeric < 1e12 ? numeric * 1000 : numeric;
            }

            const parsed = Date.parse(candidate);
            if (Number.isFinite(parsed)) return parsed;
        }

        return now();
    }

    function normalizeSource(entity, fallback) {
        const raw = entity?.source ?? entity?.recordSource ?? fallback ?? "UNKNOWN";
        return String(raw);
    }

    function toEntityArray(value) {
        if (!value) return [];

        if (value instanceof Map) return Array.from(value.values());
        if (value instanceof Set) return Array.from(value.values());
        if (Array.isArray(value)) return value.slice();

        if (typeof value === "object") {
            if (value.entities instanceof Map) return Array.from(value.entities.values());
            if (Array.isArray(value.entities)) return value.entities.slice();
            if (Array.isArray(value.items)) return value.items.slice();
            if (Array.isArray(value.records)) return value.records.slice();
        }

        return [];
    }

    function collectRuntimeSources() {
        const sources = [];

        const add = (name, value) => {
            const rows = toEntityArray(value);
            if (rows.length) sources.push({ name, rows });
        };

        add("RainArrivalStormEntityCollectorV32.entities",
            global.RainArrivalStormEntityCollectorV32?.entities);

        add("RainArrivalLiveStormEntities",
            global.RainArrivalLiveStormEntities);

        add("RainArrivalStableStormEntities",
            global.RainArrivalStableStormEntities);

        add("RainArrivalLiveTrackHistory",
            global.RainArrivalLiveTrackHistory);

        return sources;
    }

    function emptyState() {
        return {
            phase: PHASE,
            version: VERSION,
            build: BUILD,
            createdAt: now(),
            updatedAt: now(),
            cycleCount: 0,
            identities: {}
        };
    }

    function sanitizeState(raw) {
        const state = emptyState();

        if (!raw || typeof raw !== "object") return state;

        state.createdAt = finiteNumber(raw.createdAt) || state.createdAt;
        state.updatedAt = finiteNumber(raw.updatedAt) || state.updatedAt;
        state.cycleCount = Math.max(0, finiteNumber(raw.cycleCount) || 0);

        const identities = raw.identities && typeof raw.identities === "object"
            ? raw.identities
            : {};

        for (const [identity, value] of Object.entries(identities)) {
            if (!value || typeof value !== "object") continue;

            const history = Array.isArray(value.history)
                ? value.history
                    .map((point) => {
                        const coordinate = normalizeCoordinate(point);
                        const timestamp = normalizeTimestamp(point);
                        if (!coordinate) return null;

                        return {
                            ...coordinate,
                            timestamp,
                            observedAt: point.observedAt ?? new Date(timestamp).toISOString(),
                            source: String(point.source ?? "PERSISTED"),
                            cellId: point.cellId ?? null,
                            trackId: point.trackId ?? identity,
                            canonicalTrackId: point.canonicalTrackId ?? identity
                        };
                    })
                    .filter(Boolean)
                : [];

            history.sort((a, b) => a.timestamp - b.timestamp);

            state.identities[identity] = {
                identity,
                firstSeenAt: finiteNumber(value.firstSeenAt) || (history[0]?.timestamp ?? now()),
                lastSeenAt: finiteNumber(value.lastSeenAt) || (history.at(-1)?.timestamp ?? now()),
                sources: Array.isArray(value.sources) ? value.sources.slice(0, 32) : [],
                history: history.slice(-MAX_POINTS_PER_IDENTITY)
            };
        }

        return state;
    }

    function loadState() {
        try {
            const text = global.localStorage?.getItem(STORAGE_KEY);
            if (!text) return emptyState();
            return sanitizeState(JSON.parse(text));
        } catch (error) {
            console.warn("[RainGuard][H3B2C] Failed to load persisted history:", error);
            return emptyState();
        }
    }

    function estimateBytes(value) {
        try {
            return new Blob([JSON.stringify(value)]).size;
        } catch (_) {
            try {
                return JSON.stringify(value).length * 2;
            } catch (_) {
                return Number.MAX_SAFE_INTEGER;
            }
        }
    }

    function compactStateForStorage(state, targetBytes = STORAGE_TARGET_BYTES) {
        const clone = sanitizeState(state);

        const identities = Object.entries(clone.identities)
            .sort((a, b) => (b[1].lastSeenAt || 0) - (a[1].lastSeenAt || 0));

        // First pass: aggressively cap per-identity history while preserving motion utility.
        for (const [, item] of identities) {
            if (!Array.isArray(item.history)) item.history = [];

            // Deduplicate identical timestamp+coordinate records.
            const seen = new Set();
            item.history = item.history
                .sort((a, b) => a.timestamp - b.timestamp)
                .filter((point) => {
                    const key = observationKey(point);
                    if (seen.has(key)) return false;
                    seen.add(key);
                    return true;
                })
                .slice(-MAX_POINTS_PER_IDENTITY);
        }

        // Second pass: remove oldest identities until comfortably below target size.
        while (
            Object.keys(clone.identities).length > 0 &&
            estimateBytes(clone) > targetBytes
        ) {
            const ordered = Object.entries(clone.identities)
                .sort((a, b) => (a[1].lastSeenAt || 0) - (b[1].lastSeenAt || 0));

            let reduced = false;

            // Prefer reducing history first, but never below MIN_POINTS_PER_IDENTITY.
            for (const [identity, item] of ordered) {
                if (item.history.length > MIN_POINTS_PER_IDENTITY) {
                    item.history = item.history.slice(
                        -Math.max(
                            MIN_POINTS_PER_IDENTITY,
                            Math.ceil(item.history.length / 2)
                        )
                    );
                    reduced = true;

                    if (estimateBytes(clone) <= targetBytes) break;
                }
            }

            if (estimateBytes(clone) <= targetBytes) break;

            if (!reduced) {
                // Remove the oldest identity as a last resort.
                const oldest = ordered[0]?.[0];
                if (!oldest) break;
                delete clone.identities[oldest];
            }
        }

        clone.updatedAt = now();
        return clone;
    }

    function isQuotaError(error) {
        return Boolean(
            error &&
            (
                error.name === "QuotaExceededError" ||
                error.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
                error.code === 22 ||
                error.code === 1014
            )
        );
    }

    function saveState(state) {
        const storage = global.localStorage;

        if (!storage) {
            return {
                persisted: false,
                compacted: false,
                quotaRecovered: false,
                storedBytes: 0,
                reason: "LOCAL_STORAGE_UNAVAILABLE"
            };
        }

        let workingState = state;
        let compacted = false;
        let quotaRecovered = false;
        let lastError = null;

        for (let attempt = 0; attempt <= QUOTA_RETRY_LIMIT; attempt += 1) {
            try {
                const bytes = estimateBytes(workingState);

                if (bytes > STORAGE_SOFT_LIMIT_BYTES) {
                    workingState = compactStateForStorage(
                        workingState,
                        STORAGE_TARGET_BYTES
                    );
                    compacted = true;
                }

                const serialized = JSON.stringify(workingState);
                storage.setItem(STORAGE_KEY, serialized);

                // Synchronize in-memory state with what was actually persisted.
                state.createdAt = workingState.createdAt;
                state.updatedAt = workingState.updatedAt;
                state.cycleCount = workingState.cycleCount;
                state.identities = workingState.identities;

                return {
                    persisted: true,
                    compacted,
                    quotaRecovered,
                    storedBytes: estimateBytes(workingState),
                    reason: null
                };
            } catch (error) {
                lastError = error;

                if (!isQuotaError(error)) {
                    console.warn("[RainGuard][H3B2C1] Failed to persist history:", error);
                    return {
                        persisted: false,
                        compacted,
                        quotaRecovered,
                        storedBytes: estimateBytes(workingState),
                        reason: String(error?.message || error)
                    };
                }

                quotaRecovered = true;
                compacted = true;

                // On quota failure, compact harder on every retry.
                const progressivelySmallerTarget = Math.max(
                    700_000,
                    Math.floor(STORAGE_TARGET_BYTES * Math.pow(0.65, attempt + 1))
                );

                workingState = compactStateForStorage(
                    workingState,
                    progressivelySmallerTarget
                );

                try {
                    storage.removeItem(STORAGE_KEY);
                } catch (_) {}
            }
        }

        console.warn(
            "[RainGuard][H3B2C1] Storage quota recovery exhausted:",
            lastError
        );

        return {
            persisted: false,
            compacted,
            quotaRecovered,
            storedBytes: estimateBytes(workingState),
            reason: "QUOTA_RECOVERY_EXHAUSTED"
        };
    }

    function coordinateKey(point) {
        return `${point.lat.toFixed(5)},${point.lon.toFixed(5)}`;
    }

    function observationKey(point) {
        return `${point.timestamp}|${coordinateKey(point)}`;
    }

    function appendObservation(state, entity, sourceName, stats) {
        const identity = normalizeIdentity(entity);
        const coordinate = normalizeCoordinate(entity);

        if (!identity) {
            stats.rejectedNoIdentity += 1;
            return;
        }

        if (!coordinate) {
            stats.rejectedInvalidCoordinate += 1;
            return;
        }

        const timestamp = normalizeTimestamp(entity);
        const source = normalizeSource(entity, sourceName);

        const point = {
            ...coordinate,
            timestamp,
            observedAt: new Date(timestamp).toISOString(),
            source,
            cellId: entity.cellId ?? null,
            trackId: entity.trackId ?? identity,
            canonicalTrackId: entity.canonicalTrackId ?? identity
        };

        let item = state.identities[identity];

        if (!item) {
            item = state.identities[identity] = {
                identity,
                firstSeenAt: timestamp,
                lastSeenAt: timestamp,
                sources: [],
                history: []
            };
            stats.newIdentityCount += 1;
        }

        item.lastSeenAt = Math.max(item.lastSeenAt || 0, timestamp);

        if (!item.sources.includes(source)) {
            item.sources.push(source);
            if (item.sources.length > 32) item.sources.shift();
        }

        const duplicate = item.history.some(
            (existing) => observationKey(existing) === observationKey(point)
        );

        if (duplicate) {
            stats.duplicateObservationCount += 1;
            return;
        }

        const previous = item.history.length ? item.history[item.history.length - 1] : null;

        item.history.push(point);
        item.history.sort((a, b) => a.timestamp - b.timestamp);

        // A later cross-cycle sample with the same coordinate is still useful temporally.
        // Keep it, but only coordinate diversity contributes to motion readiness.
        if (item.history.length > MAX_POINTS_PER_IDENTITY) {
            item.history = item.history.slice(-MAX_POINTS_PER_IDENTITY);
        }

        stats.appendedObservationCount += 1;

        if (previous && coordinateKey(previous) !== coordinateKey(point)) {
            stats.coordinateChangeCount += 1;
        }
    }

    function trimIdentities(state) {
        const entries = Object.entries(state.identities);

        if (entries.length <= MAX_IDENTITIES) return;

        entries
            .sort((a, b) => (b[1].lastSeenAt || 0) - (a[1].lastSeenAt || 0))
            .slice(MAX_IDENTITIES)
            .forEach(([identity]) => {
                delete state.identities[identity];
            });
    }

    function buildPublishedStore(state) {
        const result = {};

        for (const [identity, item] of Object.entries(state.identities)) {
            const history = item.history.slice().sort((a, b) => a.timestamp - b.timestamp);
            const uniqueCoordinates = new Set(history.map(coordinateKey));

            result[identity] = {
                identity,
                canonicalTrackId: identity,
                firstSeenAt: item.firstSeenAt,
                lastSeenAt: item.lastSeenAt,
                sources: item.sources.slice(),
                observationCount: history.length,
                uniqueCoordinateCount: uniqueCoordinates.size,
                motionReady: uniqueCoordinates.size >= 2 && history.length >= 2,
                history
            };
        }

        return result;
    }

    function summarize(published) {
        const values = Object.values(published);
        const uniqueCounts = values.map((item) => item.uniqueCoordinateCount || 0);

        return {
            identityCount: values.length,
            observationCount: values.reduce((sum, item) => sum + item.observationCount, 0),
            maxObservedPointsPerIdentity: values.length
                ? Math.max(...values.map((item) => item.observationCount || 0))
                : 0,
            maxUniqueCoordinatesPerIdentity: uniqueCounts.length
                ? Math.max(...uniqueCounts)
                : 0,
            multiPointIdentityCount: values.filter((item) => item.observationCount >= 2).length,
            multiCoordinateIdentityCount: values.filter((item) => item.uniqueCoordinateCount >= 2).length,
            motionReadyIdentityCount: values.filter((item) => item.motionReady).length
        };
    }

    let state = loadState();
    let timer = null;
    let running = false;

    async function runCycle() {
        if (running) {
            return global[RESULT_NAME] ?? {
                success: false,
                phase: PHASE,
                status: "ALREADY_RUNNING"
            };
        }

        running = true;
        const startedAt = now();

        const stats = {
            inputObservationCount: 0,
            appendedObservationCount: 0,
            duplicateObservationCount: 0,
            rejectedNoIdentity: 0,
            rejectedInvalidCoordinate: 0,
            coordinateChangeCount: 0,
            newIdentityCount: 0
        };

        try {
            const sources = collectRuntimeSources();

            for (const source of sources) {
                stats.inputObservationCount += source.rows.length;

                for (const entity of source.rows) {
                    appendObservation(state, entity, source.name, stats);
                }
            }

            trimIdentities(state);
            state.cycleCount += 1;

            const storageResult = saveState(state);
            const localStoragePersisted = storageResult.persisted;
            const published = buildPublishedStore(state);
            const summary = summarize(published);

            global[STORE_NAME] = published;

            const result = {
                success: true,
                phase: PHASE,
                version: VERSION,
                build: BUILD,
                status:
                    summary.motionReadyIdentityCount > 0
                        ? "PERSISTENT_TEMPORAL_COORDINATE_HISTORY_MOTION_READY"
                        : (
                            localStoragePersisted
                                ? "PERSISTENT_TEMPORAL_COORDINATE_HISTORY_ACCUMULATING"
                                : "PERSISTENT_TEMPORAL_COORDINATE_HISTORY_RUNTIME_ONLY"
                        ),
                generatedAt: now(),
                durationMs: now() - startedAt,
                sourceCount: sources.length,
                sourceNames: sources.map((source) => source.name),
                cycleCount: state.cycleCount,
                localStoragePersisted,
                storageCompacted: storageResult.compacted,
                quotaRecovered: storageResult.quotaRecovered,
                storedBytes: storageResult.storedBytes,
                storagePersistReason: storageResult.reason,
                ...stats,
                ...summary,
                persistentStoreName: STORE_NAME,
                storageKey: STORAGE_KEY
            };

            global[RESULT_NAME] = result;

            console.log(
                "[RainGuard][39A-15F6N4B1B3C] Cross-cycle temporal history result:",
                result
            );

            return result;
        } catch (error) {
            const result = {
                success: false,
                phase: PHASE,
                version: VERSION,
                build: BUILD,
                status: "PERSISTENT_TEMPORAL_COORDINATE_HISTORY_FAILED",
                generatedAt: now(),
                durationMs: now() - startedAt,
                error: String(error?.stack || error?.message || error)
            };

            global[RESULT_NAME] = result;
            console.error("[RainGuard][39A-15F6N4B1B3C]", error);
            return result;
        } finally {
            running = false;
        }
    }

    function getAllHistory() {
        return global[STORE_NAME] || buildPublishedStore(state);
    }

    function getHistoryForIdentity(identity) {
        const key = String(identity ?? "").trim();
        if (!key) return null;
        return getAllHistory()[key] ?? null;
    }

    function clearHistory() {
        state = emptyState();

        try {
            global.localStorage?.removeItem(STORAGE_KEY);
        } catch (_) {}

        global[STORE_NAME] = {};
        global[RESULT_NAME] = {
            success: true,
            phase: PHASE,
            version: VERSION,
            build: BUILD,
            status: "PERSISTENT_TEMPORAL_COORDINATE_HISTORY_CLEARED",
            generatedAt: now()
        };

        return global[RESULT_NAME];
    }

    function start() {
        if (timer) return false;

        runCycle();

        timer = global.setInterval(() => {
            runCycle();
        }, AUTO_INTERVAL_MS);

        return true;
    }

    function stop() {
        if (!timer) return false;
        global.clearInterval(timer);
        timer = null;
        return true;
    }

    global[RUN_NAME] = runCycle;
    global[GET_ALL_NAME] = getAllHistory;
    global[GET_ONE_NAME] = getHistoryForIdentity;
    global[CLEAR_NAME] = clearHistory;

    global[BRIDGE_NAME] = {
        phase: PHASE,
        version: VERSION,
        build: BUILD,
        storageKey: STORAGE_KEY,
        persistentStoreName: STORE_NAME,
        get running() {
            return running;
        },
        get timerActive() {
            return Boolean(timer);
        },
        run: runCycle,
        start,
        stop,
        getAllHistory,
        getHistoryForIdentity,
        clear: clearHistory
    };

    global[STORE_NAME] = buildPublishedStore(state);

    // Start automatically after the current page/runtime has had time to create sources.
    global.setTimeout(() => {
        start();
    }, 1500);

})(window);
