/**
 * RainGuard AI
 * Phase 39A-15F5 — Temporal Observation Sequence Builder
 *
 * Purpose:
 * - Consume validated storm observations produced by Phase 39A-15F4.
 * - Group observations by persistent storm identity.
 * - Sort observations by timestamp.
 * - Remove exact temporal/spatial duplicates.
 * - Require at least two valid timestamps for a motion-capable sequence.
 * - Reject stationary sequences where coordinates do not change.
 * - Publish clean temporal sequences for Phase 39A-15F / downstream motion-vector logic.
 *
 * Safety:
 * - Never fabricate coordinates.
 * - Never fabricate timestamps.
 * - Never infer motion from a single observation.
 * - Never treat repeated identical coordinates as motion.
 */

(function installRainGuardTemporalObservationSequenceBuilder(global) {
    "use strict";

    const PHASE = "39A-15F5";
    const VERSION = "39A.15F5.0";
    const BUILD = "rainguard-v39-temporal-observation-sequence-builder";

    const CONFIG = Object.freeze({
        minPoints: 2,
        minDeltaMs: 1000,              // minimum temporal separation
        maxDeltaMs: 6 * 60 * 60 * 1000, // six hours
        coordinatePrecision: 6,
        maxSequencePoints: 100,
        maxSequences: 5000
    });

    const STATE = {
        installed: true,
        running: false,
        runInProgress: false,
        lastRunAt: null,
        lastError: null,
        lastResult: null,
        sequences: [],
        sequencesByIdentity: new Map(),
        rejected: [],
        statistics: {
            runs: 0,
            sourceRecords: 0,
            normalizedRecords: 0,
            identityGroups: 0,
            acceptedSequences: 0,
            rejectedSequences: 0,
            duplicateRecords: 0,
            invalidRecords: 0,
            stationarySequences: 0,
            singlePointSequences: 0
        }
    };

    function finiteNumber(value) {
        const n = Number(value);
        return Number.isFinite(n) ? n : null;
    }

    function readId(record) {
        if (!record || typeof record !== "object") return null;
        return (
            record.persistentId ??
            record.canonicalTrackId ??
            record.trackId ??
            record.cellId ??
            record.id ??
            record.identityId ??
            null
        );
    }

    function readLatitude(record) {
        if (!record || typeof record !== "object") return null;
        return finiteNumber(
            record.latitude ??
            record.lat ??
            record.currentCoordinate?.latitude ??
            record.currentCoordinate?.lat ??
            record.coordinate?.latitude ??
            record.coordinate?.lat
        );
    }

    function readLongitude(record) {
        if (!record || typeof record !== "object") return null;
        return finiteNumber(
            record.longitude ??
            record.lon ??
            record.lng ??
            record.currentCoordinate?.longitude ??
            record.currentCoordinate?.lon ??
            record.currentCoordinate?.lng ??
            record.coordinate?.longitude ??
            record.coordinate?.lon ??
            record.coordinate?.lng
        );
    }

    function readTimestamp(record) {
        if (!record || typeof record !== "object") return null;

        const raw =
            record.timestamp ??
            record.observedAt ??
            record.time ??
            record.ts ??
            record.currentCoordinate?.timestamp ??
            record.coordinate?.timestamp ??
            null;

        if (raw == null) return null;

        if (typeof raw === "number" && Number.isFinite(raw)) {
            return raw < 1e12 ? raw * 1000 : raw;
        }

        if (typeof raw === "string") {
            const numeric = Number(raw);
            if (Number.isFinite(numeric)) {
                return numeric < 1e12 ? numeric * 1000 : numeric;
            }

            const parsed = Date.parse(raw);
            return Number.isFinite(parsed) ? parsed : null;
        }

        if (raw instanceof Date) {
            const t = raw.getTime();
            return Number.isFinite(t) ? t : null;
        }

        return null;
    }

    function normalizeRecord(record, index, sourceName) {
        const persistentId = readId(record);
        const latitude = readLatitude(record);
        const longitude = readLongitude(record);
        const timestamp = readTimestamp(record);

        if (
            !persistentId ||
            latitude == null ||
            longitude == null ||
            timestamp == null
        ) {
            return {
                ok: false,
                reason: "INVALID_RECORD",
                index,
                record
            };
        }

        if (
            latitude < -90 || latitude > 90 ||
            longitude < -180 || longitude > 180
        ) {
            return {
                ok: false,
                reason: "INVALID_COORDINATE",
                index,
                record
            };
        }

        return {
            ok: true,
            value: {
                persistentId: String(persistentId),
                canonicalTrackId: String(
                    record.canonicalTrackId ??
                    record.trackId ??
                    record.cellId ??
                    persistentId
                ),
                trackId: String(record.trackId ?? record.canonicalTrackId ?? persistentId),
                cellId: record.cellId ?? null,
                latitude,
                longitude,
                lat: latitude,
                lon: longitude,
                lng: longitude,
                timestamp,
                observedAt: timestamp,
                source: record.source ?? sourceName ?? "unknown",
                sourceIndex: index,
                intensity: record.intensity ?? null,
                confidence: finiteNumber(record.confidence),
                original: record,
                phase: PHASE,
                version: VERSION
            }
        };
    }

    function arrayFromCandidate(value) {
        if (!value) return [];

        if (Array.isArray(value)) return value;

        if (value instanceof Map) {
            const out = [];
            for (const v of value.values()) {
                if (Array.isArray(v)) out.push(...v);
                else if (v && typeof v === "object") out.push(v);
            }
            return out;
        }

        if (value instanceof Set) return [...value];

        if (typeof value === "object") {
            if (Array.isArray(value.records)) return value.records;
            if (Array.isArray(value.observations)) return value.observations;
            if (Array.isArray(value.output)) return value.output;
            if (Array.isArray(value.items)) return value.items;
        }

        return [];
    }

    function discoverSource() {
        const candidates = [
            ["RainGuardStormObservationsV39", global.RainGuardStormObservationsV39],
            ["RainGuardPersistentIdentityMotionRecordsV39", global.RainGuardPersistentIdentityMotionRecordsV39],
            ["RainGuardPersistentStormObservationsV39", global.RainGuardPersistentStormObservationsV39],
            ["RainGuardPersistentIdentityMotionHistoryV39", global.RainGuardPersistentIdentityMotionHistoryV39],
            ["RainGuardPersistentTemporalMotionFeedV39", global.RainGuardPersistentTemporalMotionFeedV39],
            ["RainGuardPersistentStormIdentitiesV39", global.RainGuardPersistentStormIdentitiesV39]
        ];

        for (const [name, value] of candidates) {
            const records = arrayFromCandidate(value);
            if (records.length) return { name, records };
        }

        if (typeof global.getRainGuardStormObservations === "function") {
            try {
                const records = arrayFromCandidate(global.getRainGuardStormObservations());
                if (records.length) return { name: "getRainGuardStormObservations()", records };
            } catch (_) {}
        }

        return { name: null, records: [] };
    }

    function pointKey(point) {
        return [
            point.persistentId,
            Number(point.latitude).toFixed(CONFIG.coordinatePrecision),
            Number(point.longitude).toFixed(CONFIG.coordinatePrecision),
            point.timestamp
        ].join("|");
    }

    function coordinateKey(point) {
        return [
            Number(point.latitude).toFixed(CONFIG.coordinatePrecision),
            Number(point.longitude).toFixed(CONFIG.coordinatePrecision)
        ].join(",");
    }

    function buildGroups(records, sourceName) {
        const groups = new Map();
        const seen = new Set();
        let duplicates = 0;
        let invalid = 0;

        records.forEach((record, index) => {
            const normalized = normalizeRecord(record, index, sourceName);

            if (!normalized.ok) {
                invalid += 1;
                STATE.rejected.push(normalized);
                return;
            }

            const point = normalized.value;
            const key = pointKey(point);

            if (seen.has(key)) {
                duplicates += 1;
                return;
            }
            seen.add(key);

            if (!groups.has(point.persistentId)) {
                groups.set(point.persistentId, []);
            }
            groups.get(point.persistentId).push(point);
        });

        return { groups, duplicates, invalid };
    }

    function buildSequence(identity, points) {
        const sorted = points
            .slice()
            .sort((a, b) => a.timestamp - b.timestamp)
            .slice(-CONFIG.maxSequencePoints);

        const uniqueTimes = new Set(sorted.map(p => p.timestamp));
        const uniqueCoordinates = new Set(sorted.map(coordinateKey));

        if (sorted.length < CONFIG.minPoints || uniqueTimes.size < 2) {
            return {
                accepted: false,
                reason: "INSUFFICIENT_TEMPORAL_POINTS",
                identity,
                points: sorted
            };
        }

        if (uniqueCoordinates.size < 2) {
            return {
                accepted: false,
                reason: "STATIONARY_SEQUENCE",
                identity,
                points: sorted
            };
        }

        const filtered = [sorted[0]];

        for (let i = 1; i < sorted.length; i++) {
            const previous = filtered[filtered.length - 1];
            const current = sorted[i];
            const dt = current.timestamp - previous.timestamp;

            if (dt < CONFIG.minDeltaMs) continue;
            if (dt > CONFIG.maxDeltaMs) {
                filtered.push(current);
                continue;
            }

            if (coordinateKey(previous) === coordinateKey(current)) {
                continue;
            }

            filtered.push(current);
        }

        if (filtered.length < CONFIG.minPoints) {
            return {
                accepted: false,
                reason: "NO_VALID_SEQUENTIAL_MOVEMENT",
                identity,
                points: filtered
            };
        }

        const first = filtered[0];
        const last = filtered[filtered.length - 1];

        return {
            accepted: true,
            sequence: {
                persistentId: identity,
                canonicalTrackId: last.canonicalTrackId ?? first.canonicalTrackId ?? identity,
                trackId: last.trackId ?? first.trackId ?? identity,
                cellId: last.cellId ?? first.cellId ?? null,
                pointCount: filtered.length,
                uniqueTimeCount: new Set(filtered.map(p => p.timestamp)).size,
                uniqueCoordinateCount: new Set(filtered.map(coordinateKey)).size,
                firstTimestamp: first.timestamp,
                lastTimestamp: last.timestamp,
                durationMs: last.timestamp - first.timestamp,
                firstCoordinate: {
                    latitude: first.latitude,
                    longitude: first.longitude
                },
                lastCoordinate: {
                    latitude: last.latitude,
                    longitude: last.longitude
                },
                observations: filtered,
                source: "TemporalObservationSequenceBuilder",
                phase: PHASE,
                version: VERSION,
                build: BUILD
            }
        };
    }

    function publish(sequences) {
        STATE.sequences = sequences;
        STATE.sequencesByIdentity = new Map(
            sequences.map(sequence => [sequence.persistentId, sequence])
        );

        global.RainGuardTemporalObservationSequencesV39 = sequences;
        global.RainGuardTemporalObservationSequencesByIdentityV39 = STATE.sequencesByIdentity;
        global.RainGuardMotionReadyTemporalSequencesV39 = sequences;

        global.dispatchEvent?.(
            new CustomEvent("rainguard:temporal-observation-sequences-ready", {
                detail: {
                    phase: PHASE,
                    version: VERSION,
                    count: sequences.length,
                    sequences
                }
            })
        );
    }

    async function run(options = {}) {
        if (STATE.runInProgress) {
            return {
                success: true,
                phase: PHASE,
                version: VERSION,
                status: "TEMPORAL_SEQUENCE_BUILD_ALREADY_RUNNING",
                sequenceCount: STATE.sequences.length
            };
        }

        STATE.runInProgress = true;
        STATE.running = true;
        STATE.lastError = null;
        STATE.rejected = [];

        try {
            const discovered = options.records
                ? {
                    name: options.sourceName ?? "manual",
                    records: arrayFromCandidate(options.records)
                }
                : discoverSource();

            const records = discovered.records;
            STATE.statistics.runs += 1;
            STATE.statistics.sourceRecords = records.length;

            if (!records.length) {
                const result = {
                    success: true,
                    phase: PHASE,
                    version: VERSION,
                    build: BUILD,
                    status: "NO_STORM_OBSERVATIONS_AVAILABLE",
                    source: discovered.name,
                    sourceRecordCount: 0,
                    identityGroupCount: 0,
                    sequenceCount: 0,
                    sequences: []
                };

                publish([]);
                STATE.lastResult = result;
                STATE.lastRunAt = Date.now();
                return result;
            }

            const grouped = buildGroups(records, discovered.name);
            STATE.statistics.duplicateRecords = grouped.duplicates;
            STATE.statistics.invalidRecords = grouped.invalid;
            STATE.statistics.normalizedRecords =
                [...grouped.groups.values()].reduce((sum, arr) => sum + arr.length, 0);
            STATE.statistics.identityGroups = grouped.groups.size;

            const sequences = [];
            let stationary = 0;
            let singlePoint = 0;
            let rejectedSequences = 0;

            for (const [identity, points] of grouped.groups.entries()) {
                if (sequences.length >= CONFIG.maxSequences) break;

                const built = buildSequence(identity, points);

                if (built.accepted) {
                    sequences.push(built.sequence);
                } else {
                    rejectedSequences += 1;

                    if (built.reason === "STATIONARY_SEQUENCE") stationary += 1;
                    if (built.reason === "INSUFFICIENT_TEMPORAL_POINTS") singlePoint += 1;

                    STATE.rejected.push({
                        identity,
                        reason: built.reason,
                        pointCount: built.points?.length ?? 0
                    });
                }
            }

            STATE.statistics.acceptedSequences = sequences.length;
            STATE.statistics.rejectedSequences = rejectedSequences;
            STATE.statistics.stationarySequences = stationary;
            STATE.statistics.singlePointSequences = singlePoint;

            publish(sequences);

            const result = {
                success: true,
                phase: PHASE,
                version: VERSION,
                build: BUILD,
                status: sequences.length
                    ? "TEMPORAL_OBSERVATION_SEQUENCES_READY"
                    : "OBSERVATIONS_FOUND_BUT_NO_VALID_TEMPORAL_SEQUENCE",
                source: discovered.name,
                sourceRecordCount: records.length,
                normalizedRecordCount: STATE.statistics.normalizedRecords,
                identityGroupCount: grouped.groups.size,
                sequenceCount: sequences.length,
                rejectedSequenceCount: rejectedSequences,
                duplicateRecordCount: grouped.duplicates,
                invalidRecordCount: grouped.invalid,
                stationarySequenceCount: stationary,
                singlePointSequenceCount: singlePoint,
                sequences,
                sample: sequences.slice(0, 5)
            };

            STATE.lastResult = result;
            STATE.lastRunAt = Date.now();

            console.log("[RainGuard Phase 39A-15F5] Temporal Observation Sequence Builder result:", result);
            return result;

        } catch (error) {
            STATE.lastError = error;

            const result = {
                success: false,
                phase: PHASE,
                version: VERSION,
                build: BUILD,
                status: "TEMPORAL_SEQUENCE_BUILD_FAILED",
                error: error?.message ?? String(error)
            };

            STATE.lastResult = result;
            console.error("[RainGuard Phase 39A-15F5] Build failed:", error);
            return result;

        } finally {
            STATE.runInProgress = false;
            STATE.running = false;
        }
    }

    function diagnose() {
        return {
            phase: PHASE,
            version: VERSION,
            build: BUILD,
            installed: STATE.installed,
            running: STATE.running,
            runInProgress: STATE.runInProgress,
            lastRunAt: STATE.lastRunAt,
            lastError: STATE.lastError,
            sequenceCount: STATE.sequences.length,
            rejectedCount: STATE.rejected.length,
            statistics: { ...STATE.statistics },
            sample: STATE.sequences.slice(0, 5),
            lastResult: STATE.lastResult
        };
    }

    function getSequences() {
        return STATE.sequences.slice();
    }

    function getSequenceForIdentity(identity) {
        if (identity == null) return null;
        return STATE.sequencesByIdentity.get(String(identity)) ?? null;
    }

    global.RainGuardTemporalObservationSequenceBuilderV39 = {
        phase: PHASE,
        version: VERSION,
        build: BUILD,
        config: CONFIG,
        state: STATE,
        run,
        diagnose,
        getSequences,
        getSequenceForIdentity
    };

    global.runRainGuardTemporalObservationSequenceBuilder = run;
    global.diagnoseRainGuardTemporalObservationSequenceBuilder = diagnose;
    global.getRainGuardTemporalObservationSequences = getSequences;
    global.getRainGuardTemporalObservationSequenceForIdentity = getSequenceForIdentity;

    console.log(
        "[RainGuard Phase 39A-15F5] Temporal Observation Sequence Builder installed",
        {
            phase: PHASE,
            version: VERSION,
            build: BUILD
        }
    );

})(window);
