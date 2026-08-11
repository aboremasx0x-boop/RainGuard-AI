
/**
 * RainGuard AI
 * Phase 39A-15F6E — Persistent Observation Memory Guard
 * File: persistent_observation_memory_guard_39a15f6e.js
 *
 * Purpose:
 * - Prevent unbounded growth of persistent observation/history structures.
 * - Keep only a bounded number of observations per identity.
 * - Deduplicate repeated observations safely.
 * - Avoid expensive deep-cloning of large objects.
 * - Preserve enough temporal points for downstream motion-vector calculation.
 * - Protect the page from browser out-of-memory conditions.
 *
 * Safety principles:
 * - Never fabricate coordinates or timestamps.
 * - Never mutate original source observations unless explicitly requested.
 * - Never retain unnecessary nested payloads.
 * - Prefer compact normalized records.
 * - Keep bounded global and per-identity memory.
 */

(function installRainGuardPersistentObservationMemoryGuard(global) {
    "use strict";

    const PHASE = "39A-15F6E";
    const VERSION = "39A.15F6E.0";
    const BUILD = "rainguard-v39-persistent-observation-memory-guard";

    const CONFIG = Object.freeze({
        maxPointsPerIdentity: 8,
        minPointsPerIdentity: 2,
        maxIdentities: 1500,
        maxGlobalRecords: 6000,
        staleIdentityMs: 6 * 60 * 60 * 1000,     // 6 hours
        dedupeTimeWindowMs: 1500,                // 1.5 seconds
        coordinatePrecision: 5,
        maxSourceLength: 120,
        maxIdentityLength: 180,
        maintenanceIntervalMs: 45 * 1000,
        autoInstallMaintenance: true,
        keepInvalidRecords: false
    });

    const STATE_KEY = "RainGuardPersistentObservationMemoryGuardV39";

    const now = () => Date.now();

    function finiteNumber(value) {
        const n = Number(value);
        return Number.isFinite(n) ? n : null;
    }

    function firstFinite(...values) {
        for (const value of values) {
            const n = finiteNumber(value);
            if (n !== null) return n;
        }
        return null;
    }

    function firstString(...values) {
        for (const value of values) {
            if (typeof value === "string") {
                const s = value.trim();
                if (s) return s;
            }
        }
        return null;
    }

    function safeString(value, maxLength) {
        if (value === null || value === undefined) return null;
        const s = String(value).trim();
        if (!s) return null;
        return s.slice(0, maxLength);
    }

    function normalizeTimestamp(record) {
        const raw = firstFinite(
            record?.observedAt,
            record?.timestamp,
            record?.time,
            record?.createdAt,
            record?.updatedAt,
            record?.accumulatedAt,
            record?.currentCoordinate?.timestamp,
            record?.coordinate?.timestamp
        );

        if (raw === null) return null;

        // Convert probable seconds to ms.
        return raw < 10_000_000_000 ? Math.round(raw * 1000) : Math.round(raw);
    }

    function normalizeCoordinates(record) {
        const lat = firstFinite(
            record?.latitude,
            record?.lat,
            record?.currentCoordinate?.latitude,
            record?.currentCoordinate?.lat,
            record?.coordinate?.latitude,
            record?.coordinate?.lat
        );

        const lon = firstFinite(
            record?.longitude,
            record?.lon,
            record?.lng,
            record?.currentCoordinate?.longitude,
            record?.currentCoordinate?.lon,
            record?.currentCoordinate?.lng,
            record?.coordinate?.longitude,
            record?.coordinate?.lon,
            record?.coordinate?.lng
        );

        if (lat === null || lon === null) {
            return { lat: null, lon: null, valid: false };
        }

        const valid =
            lat >= -90 && lat <= 90 &&
            lon >= -180 && lon <= 180 &&
            !(lat === 0 && lon === 0);

        return { lat, lon, valid };
    }

    function normalizeIdentity(record) {
        return safeString(
            firstString(
                record?.persistentId,
                record?.identity,
                record?.canonicalTrackId,
                record?.trackId,
                record?.cellId,
                record?.stormId,
                record?.id
            ),
            CONFIG.maxIdentityLength
        );
    }

    function normalizeSource(record) {
        return safeString(
            firstString(
                record?.source,
                record?.sourceName,
                record?.provider,
                record?.phase
            ),
            CONFIG.maxSourceLength
        );
    }

    function compactObservation(record, identityOverride) {
        if (!record || typeof record !== "object") return null;

        const identity = safeString(
            identityOverride || normalizeIdentity(record),
            CONFIG.maxIdentityLength
        );

        const { lat, lon, valid } = normalizeCoordinates(record);
        const timestamp = normalizeTimestamp(record);

        if (!identity) return null;
        if (!valid && !CONFIG.keepInvalidRecords) return null;
        if (timestamp === null) return null;

        const precision = CONFIG.coordinatePrecision;

        return {
            identity,
            trackId: safeString(
                firstString(record.trackId, record.canonicalTrackId, record.cellId),
                CONFIG.maxIdentityLength
            ),
            cellId: safeString(record.cellId, CONFIG.maxIdentityLength),
            lat: valid ? Number(lat.toFixed(precision)) : null,
            lon: valid ? Number(lon.toFixed(precision)) : null,
            timestamp,
            observedAt: timestamp,
            confidence: firstFinite(record.confidence),
            intensity: firstFinite(record.intensity),
            source: normalizeSource(record),
            phase: safeString(record.phase, 40),
            accumulatedAt: now()
        };
    }

    function observationKey(obs) {
        if (!obs) return null;
        return [
            obs.identity || "",
            obs.lat ?? "",
            obs.lon ?? "",
            Math.floor((obs.timestamp || 0) / CONFIG.dedupeTimeWindowMs)
        ].join("|");
    }

    function ensureState() {
        let state = global[STATE_KEY];

        if (!state || typeof state !== "object") {
            state = {
                phase: PHASE,
                version: VERSION,
                build: BUILD,
                installed: true,
                running: false,
                generatedAt: now(),
                updatedAt: now(),
                config: { ...CONFIG },
                identities: new Map(),
                dedupeKeys: new Set(),
                stats: {
                    runs: 0,
                    input: 0,
                    accepted: 0,
                    duplicates: 0,
                    rejected: 0,
                    evictedPoints: 0,
                    evictedIdentities: 0,
                    maintenanceRuns: 0
                },
                lastResult: null,
                timer: null
            };

            global[STATE_KEY] = state;
        }

        if (!(state.identities instanceof Map)) state.identities = new Map();
        if (!(state.dedupeKeys instanceof Set)) state.dedupeKeys = new Set();

        return state;
    }

    function addObservationToState(state, observation) {
        const key = observationKey(observation);

        if (!key) {
            state.stats.rejected += 1;
            return { accepted: false, reason: "INVALID_KEY" };
        }

        if (state.dedupeKeys.has(key)) {
            state.stats.duplicates += 1;
            return { accepted: false, reason: "DUPLICATE" };
        }

        let bucket = state.identities.get(observation.identity);

        if (!bucket) {
            bucket = {
                identity: observation.identity,
                createdAt: now(),
                updatedAt: now(),
                observations: []
            };
            state.identities.set(observation.identity, bucket);
        }

        // Strong duplicate guard independent from dedupe window.
        const exactDuplicate = bucket.observations.some(existing =>
            existing.lat === observation.lat &&
            existing.lon === observation.lon &&
            existing.timestamp === observation.timestamp
        );

        if (exactDuplicate) {
            state.stats.duplicates += 1;
            return { accepted: false, reason: "EXACT_DUPLICATE" };
        }

        bucket.observations.push(observation);
        bucket.observations.sort((a, b) => a.timestamp - b.timestamp);
        bucket.updatedAt = now();

        state.dedupeKeys.add(key);
        state.stats.accepted += 1;

        while (bucket.observations.length > CONFIG.maxPointsPerIdentity) {
            const removed = bucket.observations.shift();
            state.stats.evictedPoints += 1;
            const removedKey = observationKey(removed);
            if (removedKey) state.dedupeKeys.delete(removedKey);
        }

        return { accepted: true, reason: "ACCEPTED" };
    }

    function totalObservationCount(state) {
        let total = 0;
        for (const bucket of state.identities.values()) {
            total += Array.isArray(bucket.observations) ? bucket.observations.length : 0;
        }
        return total;
    }

    function rebuildDedupeKeys(state) {
        const next = new Set();
        for (const bucket of state.identities.values()) {
            for (const obs of bucket.observations || []) {
                const key = observationKey(obs);
                if (key) next.add(key);
            }
        }
        state.dedupeKeys = next;
    }

    function pruneState(state) {
        const startedAt = now();
        const staleBefore = startedAt - CONFIG.staleIdentityMs;

        // Remove stale identities.
        for (const [identity, bucket] of state.identities.entries()) {
            const latestTimestamp = bucket?.observations?.length
                ? bucket.observations[bucket.observations.length - 1].timestamp
                : 0;

            if (
                !bucket ||
                !Array.isArray(bucket.observations) ||
                bucket.observations.length === 0 ||
                latestTimestamp < staleBefore
            ) {
                state.identities.delete(identity);
                state.stats.evictedIdentities += 1;
            }
        }

        // Enforce identity cap by oldest update time.
        if (state.identities.size > CONFIG.maxIdentities) {
            const ordered = [...state.identities.entries()]
                .sort((a, b) => (a[1]?.updatedAt || 0) - (b[1]?.updatedAt || 0));

            const removeCount = state.identities.size - CONFIG.maxIdentities;

            for (let i = 0; i < removeCount; i++) {
                state.identities.delete(ordered[i][0]);
                state.stats.evictedIdentities += 1;
            }
        }

        // Enforce global record cap.
        let total = totalObservationCount(state);

        if (total > CONFIG.maxGlobalRecords) {
            const candidates = [];

            for (const [identity, bucket] of state.identities.entries()) {
                for (const obs of bucket.observations || []) {
                    candidates.push({ identity, timestamp: obs.timestamp });
                }
            }

            candidates.sort((a, b) => a.timestamp - b.timestamp);

            let remainingToRemove = total - CONFIG.maxGlobalRecords;

            for (const candidate of candidates) {
                if (remainingToRemove <= 0) break;

                const bucket = state.identities.get(candidate.identity);
                if (!bucket || bucket.observations.length <= CONFIG.minPointsPerIdentity) {
                    continue;
                }

                bucket.observations.shift();
                bucket.updatedAt = now();
                state.stats.evictedPoints += 1;
                remainingToRemove -= 1;
            }
        }

        rebuildDedupeKeys(state);
        state.stats.maintenanceRuns += 1;
        state.updatedAt = now();

        return {
            success: true,
            phase: PHASE,
            version: VERSION,
            build: BUILD,
            status: "MEMORY_GUARD_MAINTENANCE_COMPLETE",
            identityCount: state.identities.size,
            observationCount: totalObservationCount(state),
            durationMs: now() - startedAt
        };
    }

    function extractArrayFromCandidate(value) {
        if (Array.isArray(value)) return value;

        if (value instanceof Map) {
            const out = [];
            for (const [identity, bucket] of value.entries()) {
                if (Array.isArray(bucket)) {
                    for (const record of bucket) out.push({ ...record, identity: record?.identity || identity });
                } else if (bucket && typeof bucket === "object") {
                    const records =
                        bucket.observations ||
                        bucket.records ||
                        bucket.history ||
                        bucket.points ||
                        [];

                    if (Array.isArray(records)) {
                        for (const record of records) {
                            out.push({ ...record, identity: record?.identity || identity });
                        }
                    }
                }
            }
            return out;
        }

        if (value && typeof value === "object") {
            for (const key of [
                "observations",
                "records",
                "entities",
                "items",
                "history",
                "feed",
                "points",
                "data"
            ]) {
                if (Array.isArray(value[key])) return value[key];
            }
        }

        return [];
    }

    function findBestSource() {
        const candidates = [
            ["RainGuardCrossCycleObservationPersistenceV39", global.RainGuardCrossCycleObservationPersistenceV39],
            ["RainGuardRecoveredLiveTrackHistoryV39", global.RainGuardRecoveredLiveTrackHistoryV39],
            ["RainGuardPersistentIdentityMotionRecordsV39", global.RainGuardPersistentIdentityMotionRecordsV39],
            ["RainGuardPersistentStormIdentitiesV39", global.RainGuardPersistentStormIdentitiesV39],
            ["RainArrivalLiveTrackHistory", global.RainArrivalLiveTrackHistory]
        ];

        for (const [name, value] of candidates) {
            if (value == null) continue;

            const arr = extractArrayFromCandidate(value);

            if (arr.length > 0) {
                return { name, records: arr };
            }

            // Some objects contain identity maps under non-standard keys.
            if (value && typeof value === "object") {
                for (const key of Object.keys(value)) {
                    const nested = value[key];
                    if (nested instanceof Map) {
                        const nestedArr = extractArrayFromCandidate(nested);
                        if (nestedArr.length > 0) {
                            return {
                                name: `${name}.${key}`,
                                records: nestedArr
                            };
                        }
                    }
                }
            }
        }

        return { name: null, records: [] };
    }

    function exportBoundedRecords(state) {
        const out = [];

        for (const bucket of state.identities.values()) {
            for (const obs of bucket.observations || []) {
                out.push({ ...obs });
            }
        }

        out.sort((a, b) => a.timestamp - b.timestamp);
        return out;
    }

    function exportIdentityGroups(state) {
        const out = {};

        for (const [identity, bucket] of state.identities.entries()) {
            out[identity] = (bucket.observations || []).map(obs => ({ ...obs }));
        }

        return out;
    }

    async function runMemoryGuard(options = {}) {
        const state = ensureState();

        if (state.running) {
            return {
                success: true,
                phase: PHASE,
                version: VERSION,
                build: BUILD,
                status: "MEMORY_GUARD_RUN_ALREADY_IN_PROGRESS"
            };
        }

        state.running = true;
        const startedAt = now();

        try {
            const explicitRecords = extractArrayFromCandidate(options.records);
            const source = explicitRecords.length > 0
                ? { name: "options.records", records: explicitRecords }
                : findBestSource();

            let accepted = 0;
            let duplicates = 0;
            let rejected = 0;

            state.stats.runs += 1;
            state.stats.input += source.records.length;

            for (const record of source.records) {
                const observation = compactObservation(record);

                if (!observation) {
                    rejected += 1;
                    state.stats.rejected += 1;
                    continue;
                }

                const result = addObservationToState(state, observation);

                if (result.accepted) accepted += 1;
                else if (result.reason === "DUPLICATE" || result.reason === "EXACT_DUPLICATE") duplicates += 1;
                else rejected += 1;
            }

            const maintenance = pruneState(state);

            const boundedRecords = exportBoundedRecords(state);
            const identityGroups = exportIdentityGroups(state);

            global.RainGuardBoundedPersistentObservationsV39 = boundedRecords;
            global.RainGuardBoundedObservationGroupsV39 = identityGroups;

            const multiPointIdentityCount = [...state.identities.values()]
                .filter(bucket => (bucket.observations || []).length >= 2)
                .length;

            const singlePointIdentityCount = [...state.identities.values()]
                .filter(bucket => (bucket.observations || []).length === 1)
                .length;

            const result = {
                success: true,
                phase: PHASE,
                version: VERSION,
                build: BUILD,
                status:
                    multiPointIdentityCount > 0
                        ? "BOUNDED_OBSERVATION_MEMORY_READY_WITH_MULTI_POINT_IDENTITIES"
                        : "BOUNDED_OBSERVATION_MEMORY_READY_SINGLE_POINT_ONLY",
                source: source.name,
                inputRecordCount: source.records.length,
                acceptedObservationCount: accepted,
                duplicateObservationCount: duplicates,
                rejectedObservationCount: rejected,
                persistedIdentityCount: state.identities.size,
                persistedObservationCount: boundedRecords.length,
                singlePointIdentityCount,
                multiPointIdentityCount,
                evictedPointCount: state.stats.evictedPoints,
                evictedIdentityCount: state.stats.evictedIdentities,
                memoryLimits: {
                    maxPointsPerIdentity: CONFIG.maxPointsPerIdentity,
                    maxIdentities: CONFIG.maxIdentities,
                    maxGlobalRecords: CONFIG.maxGlobalRecords
                },
                maintenance,
                generatedAt: now(),
                durationMs: now() - startedAt,
                sample: boundedRecords.slice(0, 10)
            };

            state.lastResult = result;
            state.updatedAt = now();

            console.log(`[RainGuard Phase ${PHASE}] Persistent Observation Memory Guard result:`);
            console.log(result);

            return result;
        } catch (error) {
            const result = {
                success: false,
                phase: PHASE,
                version: VERSION,
                build: BUILD,
                status: "MEMORY_GUARD_ERROR",
                error: String(error?.message || error),
                generatedAt: now(),
                durationMs: now() - startedAt
            };

            state.lastResult = result;
            console.error(`[RainGuard Phase ${PHASE}]`, error);
            return result;
        } finally {
            state.running = false;
        }
    }

    function diagnoseMemoryGuard() {
        const state = ensureState();

        const groups = [...state.identities.entries()]
            .map(([identity, bucket]) => ({
                identity,
                pointCount: bucket?.observations?.length || 0,
                firstTimestamp: bucket?.observations?.[0]?.timestamp || null,
                lastTimestamp:
                    bucket?.observations?.[bucket.observations.length - 1]?.timestamp || null
            }))
            .sort((a, b) => b.pointCount - a.pointCount);

        const report = {
            success: true,
            phase: PHASE,
            version: VERSION,
            build: BUILD,
            installed: true,
            running: !!state.running,
            identityCount: state.identities.size,
            observationCount: totalObservationCount(state),
            multiPointIdentityCount: groups.filter(x => x.pointCount >= 2).length,
            singlePointIdentityCount: groups.filter(x => x.pointCount === 1).length,
            maxObservedPointsPerIdentity: groups.length ? groups[0].pointCount : 0,
            stats: { ...state.stats },
            config: { ...CONFIG },
            lastResult: state.lastResult,
            sampleGroups: groups.slice(0, 20)
        };

        console.log(`[RainGuard Phase ${PHASE}] Diagnostic:`);
        console.log(report);

        return report;
    }

    function clearMemoryGuard() {
        const state = ensureState();

        state.identities.clear();
        state.dedupeKeys.clear();
        state.updatedAt = now();

        global.RainGuardBoundedPersistentObservationsV39 = [];
        global.RainGuardBoundedObservationGroupsV39 = {};

        const result = {
            success: true,
            phase: PHASE,
            version: VERSION,
            build: BUILD,
            status: "MEMORY_GUARD_CLEARED",
            generatedAt: now()
        };

        state.lastResult = result;
        console.log(`[RainGuard Phase ${PHASE}] Cleared.`);

        return result;
    }

    function startMaintenance() {
        const state = ensureState();

        if (state.timer) return true;

        state.timer = global.setInterval(() => {
            try {
                pruneState(state);
            } catch (error) {
                console.warn(`[RainGuard Phase ${PHASE}] Maintenance warning:`, error);
            }
        }, CONFIG.maintenanceIntervalMs);

        return true;
    }

    function stopMaintenance() {
        const state = ensureState();

        if (state.timer) {
            global.clearInterval(state.timer);
            state.timer = null;
        }

        return true;
    }

    // Public API
    global.runRainGuardPersistentObservationMemoryGuard = runMemoryGuard;
    global.diagnoseRainGuardPersistentObservationMemoryGuard = diagnoseMemoryGuard;
    global.clearRainGuardPersistentObservationMemoryGuard = clearMemoryGuard;
    global.startRainGuardPersistentObservationMemoryGuardMaintenance = startMaintenance;
    global.stopRainGuardPersistentObservationMemoryGuardMaintenance = stopMaintenance;

    // Read-only helpers
    global.getRainGuardBoundedPersistentObservations = function () {
        const state = ensureState();
        return exportBoundedRecords(state);
    };

    global.getRainGuardBoundedObservationGroups = function () {
        const state = ensureState();
        return exportIdentityGroups(state);
    };

    ensureState();

    if (CONFIG.autoInstallMaintenance) {
        startMaintenance();
    }

    console.log(
        `[RainGuard Phase ${PHASE}] Persistent Observation Memory Guard installed`,
        {
            phase: PHASE,
            version: VERSION,
            build: BUILD,
            maxPointsPerIdentity: CONFIG.maxPointsPerIdentity,
            maxIdentities: CONFIG.maxIdentities,
            maxGlobalRecords: CONFIG.maxGlobalRecords
        }
    );

})(window);
