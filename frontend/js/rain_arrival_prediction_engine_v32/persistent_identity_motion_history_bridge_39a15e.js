/* ============================================================================
 RainGuard AI
 Phase 39A-15E — Persistent Identity Motion History Bridge

 File:
 frontend/js/rain_arrival_prediction_engine_v32/
 persistent_identity_motion_history_bridge_39a15e.js

 Purpose:
 - Read persistent storm identities produced by Phase 39A-15D.
 - Extract sequential observations for each persistent identity.
 - Normalize timestamps and coordinates.
 - Build motion-ready history groups.
 - Publish a compatibility history layer for Phase 39A-15B.
 - Do NOT fabricate motion when valid sequential points do not exist.
============================================================================ */

(function installRainGuardPersistentIdentityMotionHistoryBridge(global) {
    "use strict";

    const PHASE = "39A-15E";
    const VERSION = "39A.15E.0";
    const BUILD = "rainguard-v39-persistent-identity-motion-history-bridge";

    const STATE_KEY = "__rainGuardPersistentIdentityMotionHistoryBridge39A15E";
    const OUTPUT_KEY = "__rainGuardPersistentIdentityMotionHistory39A15E";

    const state = global[STATE_KEY] || {
        phase: PHASE,
        version: VERSION,
        build: BUILD,

        installed: false,
        running: false,
        runInProgress: false,

        runs: 0,
        skippedRuns: 0,

        identitiesScanned: 0,
        identitiesAccepted: 0,

        sourceRecords: 0,
        normalizedRecords: 0,

        groupsBuilt: 0,
        groupsWithMultiplePoints: 0,

        rejectedNoIdentity: 0,
        rejectedNoCoordinates: 0,
        rejectedNoTimestamp: 0,

        lastError: null,
        lastResult: null,

        createdAt: Date.now(),
        updatedAt: Date.now()
    };

    global[STATE_KEY] = state;

    function finiteNumber(value) {
        if (value === null || value === undefined || value === "") {
            return null;
        }

        const n = Number(value);
        return Number.isFinite(n) ? n : null;
    }

    function firstFinite() {
        for (let i = 0; i < arguments.length; i++) {
            const n = finiteNumber(arguments[i]);
            if (n !== null) return n;
        }
        return null;
    }

    function normalizeTimestamp(value) {
        if (value === null || value === undefined || value === "") {
            return null;
        }

        if (typeof value === "number" && Number.isFinite(value)) {
            if (value > 1e12) return value;
            if (value > 1e9) return value * 1000;
        }

        if (typeof value === "string") {
            const numeric = Number(value);

            if (Number.isFinite(numeric)) {
                if (numeric > 1e12) return numeric;
                if (numeric > 1e9) return numeric * 1000;
            }

            const parsed = Date.parse(value);
            if (Number.isFinite(parsed)) return parsed;
        }

        if (value instanceof Date) {
            const t = value.getTime();
            return Number.isFinite(t) ? t : null;
        }

        return null;
    }

    function getLatitude(record) {
        if (!record || typeof record !== "object") return null;

        return firstFinite(
            record.lat,
            record.latitude,
            record.centerLat,
            record.centroidLat,
            record.y,
            record.position && record.position.lat,
            record.position && record.position.latitude,
            record.center && record.center.lat,
            record.centroid && record.centroid.lat,
            record.location && record.location.lat
        );
    }

    function getLongitude(record) {
        if (!record || typeof record !== "object") return null;

        return firstFinite(
            record.lon,
            record.lng,
            record.longitude,
            record.centerLon,
            record.centerLng,
            record.centroidLon,
            record.centroidLng,
            record.x,
            record.position && record.position.lon,
            record.position && record.position.lng,
            record.position && record.position.longitude,
            record.center && record.center.lon,
            record.center && record.center.lng,
            record.centroid && record.centroid.lon,
            record.centroid && record.centroid.lng,
            record.location && record.location.lon,
            record.location && record.location.lng
        );
    }

    function getTimestamp(record) {
        if (!record || typeof record !== "object") return null;

        const candidates = [
            record.timestamp,
            record.time,
            record.ts,
            record.observedAt,
            record.observationTime,
            record.detectedAt,
            record.capturedAt,
            record.generatedAt,
            record.createdAt,
            record.updatedAt,
            record.frameTime,
            record.frameTimestamp,
            record.radarTimestamp,
            record.sourceTimestamp
        ];

        for (const candidate of candidates) {
            const t = normalizeTimestamp(candidate);
            if (t !== null) return t;
        }

        return null;
    }

    function getIdentity(record) {
        if (!record || typeof record !== "object") return null;

        const candidates = [
            record.persistentIdentity,
            record.persistentIdentityId,
            record.persistentStormId,
            record.stableIdentity,
            record.stableIdentityId,
            record.stormIdentity,
            record.identity,
            record.identityId,
            record.trackIdentity,
            record.trackId,
            record.stormId,
            record.entityId,
            record.id
        ];

        for (const candidate of candidates) {
            if (
                candidate !== null &&
                candidate !== undefined &&
                String(candidate).trim() !== ""
            ) {
                return String(candidate);
            }
        }

        return null;
    }

    function pushArray(target, candidate) {
        if (!Array.isArray(candidate)) return;

        for (const item of candidate) {
            if (item && typeof item === "object") {
                target.push(item);
            }
        }
    }

    function collectFromObject(target, obj) {
        if (!obj || typeof obj !== "object") return;

        const arrayKeys = [
            "observations",
            "points",
            "history",
            "records",
            "items",
            "samples",
            "trackHistory",
            "identityHistory",
            "persistentHistory",
            "stormHistory"
        ];

        for (const key of arrayKeys) {
            pushArray(target, obj[key]);
        }

        const mapKeys = [
            "identities",
            "identityMap",
            "persistentIdentities",
            "groups",
            "tracks"
        ];

        for (const key of mapKeys) {
            const map = obj[key];

            if (!map || typeof map !== "object" || Array.isArray(map)) {
                continue;
            }

            for (const [identity, value] of Object.entries(map)) {
                if (Array.isArray(value)) {
                    for (const record of value) {
                        if (record && typeof record === "object") {
                            target.push({
                                ...record,
                                persistentIdentity:
                                    getIdentity(record) || identity
                            });
                        }
                    }
                } else if (value && typeof value === "object") {
                    const nested = [];

                    pushArray(nested, value.observations);
                    pushArray(nested, value.points);
                    pushArray(nested, value.history);
                    pushArray(nested, value.records);

                    for (const record of nested) {
                        target.push({
                            ...record,
                            persistentIdentity:
                                getIdentity(record) || identity
                        });
                    }
                }
            }
        }
    }

    function collectSourceRecords() {
        const records = [];
        const seenObjects = new Set();

        function addObject(obj) {
            if (!obj || typeof obj !== "object") return;
            if (seenObjects.has(obj)) return;

            seenObjects.add(obj);
            collectFromObject(records, obj);
        }

        /*
         * Primary source:
         * Phase 39A-15D persistent identity linker.
         */
        addObject(
            global.__rainGuardPersistentStormIdentityLinker39A15D
        );

        addObject(
            global.__rainGuardPersistentStormIdentityState39A15D
        );

        addObject(
            global.__rainGuardPersistentStormIdentities39A15D
        );

        /*
         * Phase 39A-15C accumulator fallback.
         */
        addObject(
            global.__rainGuardPersistentStormObservationAccumulator39A15C
        );

        addObject(
            global.__rainGuardPersistentStormObservations39A15C
        );

        /*
         * Generic compatibility sources.
         */
        const possibleGlobals = [
            "__rainGuardPersistentStormIdentities",
            "__rainGuardPersistentStormHistory",
            "__rainGuardStormObservationHistory",
            "__rainGuardStableTrackHistory",
            "__rainGuardLiveTrackHistory",
            "__rainGuardTrackHistory"
        ];

        for (const key of possibleGlobals) {
            addObject(global[key]);

            if (Array.isArray(global[key])) {
                pushArray(records, global[key]);
            }
        }

        /*
         * Public getter fallback.
         */
        const getterNames = [
            "getRainGuardPersistentStormIdentities",
            "getRainGuardPersistentStormIdentityHistory",
            "getRainGuardPersistentStormObservations",
            "getRainGuardPersistentStormObservationHistory"
        ];

        for (const getterName of getterNames) {
            try {
                if (typeof global[getterName] === "function") {
                    const result = global[getterName]();

                    if (Array.isArray(result)) {
                        pushArray(records, result);
                    } else {
                        addObject(result);
                    }
                }
            } catch (_) {
                // Non-fatal compatibility probe.
            }
        }

        return records;
    }

    function normalizeRecord(record, index) {
        const identity = getIdentity(record);

        if (!identity) {
            state.rejectedNoIdentity++;
            return null;
        }

        const lat = getLatitude(record);
        const lon = getLongitude(record);

        if (lat === null || lon === null) {
            state.rejectedNoCoordinates++;
            return null;
        }

        const timestamp = getTimestamp(record);

        if (timestamp === null) {
            state.rejectedNoTimestamp++;
            return null;
        }

        return {
            persistentIdentity: identity,
            identity: identity,

            lat: lat,
            lon: lon,
            latitude: lat,
            longitude: lon,

            timestamp: timestamp,
            observedAt: timestamp,

            sourceIndex: index,

            source:
                record.source ||
                record.sourceName ||
                record.provider ||
                record.origin ||
                "persistent-identity",

            intensity: firstFinite(
                record.intensity,
                record.reflectivity,
                record.dbz,
                record.score
            ),

            area: firstFinite(
                record.area,
                record.areaKm2,
                record.size
            ),

            original: record
        };
    }

    function deduplicateAndSort(records) {
        const map = new Map();

        for (const record of records) {
            const key = [
                record.persistentIdentity,
                record.timestamp,
                record.lat.toFixed(5),
                record.lon.toFixed(5)
            ].join("|");

            if (!map.has(key)) {
                map.set(key, record);
            }
        }

        return Array.from(map.values()).sort(
            (a, b) => a.timestamp - b.timestamp
        );
    }

    function buildGroups(records) {
        const groups = new Map();

        for (const record of records) {
            const id = record.persistentIdentity;

            if (!groups.has(id)) {
                groups.set(id, []);
            }

            groups.get(id).push(record);
        }

        const output = [];

        for (const [identity, rawPoints] of groups.entries()) {
            const points = deduplicateAndSort(rawPoints);

            output.push({
                persistentIdentity: identity,
                identity: identity,

                pointCount: points.length,

                firstTimestamp:
                    points.length ? points[0].timestamp : null,

                lastTimestamp:
                    points.length
                        ? points[points.length - 1].timestamp
                        : null,

                durationMs:
                    points.length >= 2
                        ? points[points.length - 1].timestamp -
                          points[0].timestamp
                        : 0,

                points: points,
                history: points,
                observations: points
            });
        }

        output.sort((a, b) => b.pointCount - a.pointCount);

        return output;
    }

    function publishCompatibilityLayer(groups) {
        /*
         * Flatten the persistent groups into a history format that older
         * motion reconstruction stages can inspect.
         */
        const flat = [];

        for (const group of groups) {
            for (let i = 0; i < group.points.length; i++) {
                const point = group.points[i];

                flat.push({
                    ...point,

                    persistentIdentity: group.persistentIdentity,
                    stableIdentity: group.persistentIdentity,
                    stormIdentity: group.persistentIdentity,
                    identity: group.persistentIdentity,

                    sequenceIndex: i,

                    historySource:
                        "PHASE_39A_15E_PERSISTENT_IDENTITY"
                });
            }
        }

        global[OUTPUT_KEY] = {
            phase: PHASE,
            version: VERSION,
            build: BUILD,

            generatedAt: Date.now(),

            groups: groups,
            histories: groups,
            records: flat,
            observations: flat,

            groupCount: groups.length,
            recordCount: flat.length,

            groupsWithMultiplePoints:
                groups.filter(group => group.pointCount >= 2).length
        };

        /*
         * Compatibility aliases.
         * These do not destroy existing arrays. They expose the new history
         * through dedicated names for downstream bridges.
         */
        global.__rainGuardPersistentIdentityMotionHistory =
            global[OUTPUT_KEY];

        global.__rainGuardPersistentMotionHistoryRecords39A15E =
            flat;

        global.__rainGuardPersistentMotionHistoryGroups39A15E =
            groups;

        return global[OUTPUT_KEY];
    }

    function run() {
        if (state.runInProgress) {
            state.skippedRuns++;

            return {
                success: false,
                phase: PHASE,
                version: VERSION,
                status: "RUN_ALREADY_IN_PROGRESS"
            };
        }

        state.runInProgress = true;
        state.running = true;
        state.lastError = null;

        try {
            state.runs++;

            state.identitiesScanned = 0;
            state.identitiesAccepted = 0;

            state.sourceRecords = 0;
            state.normalizedRecords = 0;

            state.groupsBuilt = 0;
            state.groupsWithMultiplePoints = 0;

            state.rejectedNoIdentity = 0;
            state.rejectedNoCoordinates = 0;
            state.rejectedNoTimestamp = 0;

            /*
             * Ask 15D to refresh first if available.
             */
            try {
                if (
                    typeof global.runRainGuardPersistentStormIdentityLinker ===
                    "function"
                ) {
                    global.runRainGuardPersistentStormIdentityLinker();
                }
            } catch (_) {
                // Continue with already persisted state.
            }

            const sourceRecords = collectSourceRecords();

            state.sourceRecords = sourceRecords.length;

            const normalized = [];

            for (let i = 0; i < sourceRecords.length; i++) {
                const record = normalizeRecord(sourceRecords[i], i);

                if (record) {
                    normalized.push(record);
                }
            }

            const cleanRecords = deduplicateAndSort(normalized);

            state.normalizedRecords = cleanRecords.length;

            const groups = buildGroups(cleanRecords);

            state.groupsBuilt = groups.length;
            state.identitiesScanned = groups.length;

            state.groupsWithMultiplePoints =
                groups.filter(group => group.pointCount >= 2).length;

            state.identitiesAccepted =
                state.groupsWithMultiplePoints;

            const published = publishCompatibilityLayer(groups);

            let status;

            if (state.groupsWithMultiplePoints > 0) {
                status =
                    "PERSISTENT_IDENTITY_MOTION_HISTORY_READY";
            } else if (state.groupsBuilt > 0) {
                status =
                    "PERSISTENT_IDENTITIES_FOUND_BUT_NO_SEQUENTIAL_HISTORY";
            } else {
                status =
                    "NO_PERSISTENT_IDENTITY_HISTORY_FOUND";
            }

            const result = {
                success: true,

                phase: PHASE,
                version: VERSION,
                build: BUILD,

                status: status,

                sourceRecords: state.sourceRecords,
                normalizedRecords: state.normalizedRecords,

                groupsBuilt: state.groupsBuilt,
                groupsWithMultiplePoints:
                    state.groupsWithMultiplePoints,

                rejectedNoIdentity:
                    state.rejectedNoIdentity,

                rejectedNoCoordinates:
                    state.rejectedNoCoordinates,

                rejectedNoTimestamp:
                    state.rejectedNoTimestamp,

                outputRecordCount:
                    published.recordCount,

                sampleGroup:
                    groups.find(group => group.pointCount >= 2) ||
                    groups[0] ||
                    null,

                generatedAt: Date.now()
            };

            state.lastResult = result;
            state.updatedAt = Date.now();

            console.log(
                "[RainGuard][39A-15E] Persistent Identity Motion History Bridge result:",
                result
            );

            return result;

        } catch (error) {
            state.lastError =
                error && error.message
                    ? error.message
                    : String(error);

            state.updatedAt = Date.now();

            const result = {
                success: false,

                phase: PHASE,
                version: VERSION,
                build: BUILD,

                status:
                    "PERSISTENT_IDENTITY_MOTION_HISTORY_BRIDGE_FAILED",

                error: state.lastError,

                generatedAt: Date.now()
            };

            state.lastResult = result;

            console.error(
                "[RainGuard][39A-15E] Bridge failed:",
                error
            );

            return result;

        } finally {
            state.runInProgress = false;
            state.running = true;
        }
    }

    function diagnose() {
        return {
            phase: PHASE,
            version: VERSION,
            build: BUILD,

            installed: state.installed,
            running: state.running,
            runInProgress: state.runInProgress,

            accumulatorAvailable:
                !!global.__rainGuardPersistentStormObservationAccumulator39A15C ||
                typeof global.runRainGuardPersistentStormObservationAccumulator ===
                    "function",

            identityLinkerAvailable:
                !!global.__rainGuardPersistentStormIdentityLinker39A15D ||
                typeof global.runRainGuardPersistentStormIdentityLinker ===
                    "function",

            outputAvailable:
                !!global[OUTPUT_KEY],

            groupsBuilt:
                state.groupsBuilt,

            groupsWithMultiplePoints:
                state.groupsWithMultiplePoints,

            sourceRecords:
                state.sourceRecords,

            normalizedRecords:
                state.normalizedRecords,

            lastError:
                state.lastError,

            lastResult:
                state.lastResult,

            statistics: {
                runs: state.runs,
                skippedRuns: state.skippedRuns,

                rejectedNoIdentity:
                    state.rejectedNoIdentity,

                rejectedNoCoordinates:
                    state.rejectedNoCoordinates,

                rejectedNoTimestamp:
                    state.rejectedNoTimestamp
            }
        };
    }

    function getHistory() {
        return global[OUTPUT_KEY] || {
            phase: PHASE,
            version: VERSION,
            groups: [],
            records: [],
            groupCount: 0,
            recordCount: 0,
            groupsWithMultiplePoints: 0
        };
    }

    /*
     * Public API
     */
    global.runRainGuardPersistentIdentityMotionHistoryBridge = run;

    global.diagnoseRainGuardPersistentIdentityMotionHistoryBridge =
        diagnose;

    global.getRainGuardPersistentIdentityMotionHistory =
        getHistory;

    global.getRainGuardPersistentIdentityMotionHistoryGroups =
        function () {
            return getHistory().groups || [];
        };

    global.getRainGuardPersistentIdentityMotionHistoryRecords =
        function () {
            return getHistory().records || [];
        };

    state.installed = true;
    state.running = true;
    state.updatedAt = Date.now();

    console.log(
        "[RainGuard][39A-15E] Persistent Identity Motion History Bridge installed",
        {
            phase: PHASE,
            version: VERSION,
            build: BUILD
        }
    );

})(window);
