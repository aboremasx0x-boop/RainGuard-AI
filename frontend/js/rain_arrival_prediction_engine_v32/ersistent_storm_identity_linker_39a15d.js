/* ============================================================================
 RainGuard AI
 Phase 39A-15D — Persistent Storm Identity Linker
 Version: 39A.15D.0

 Purpose
 -------
 Link storm observations from different radar cycles to one persistent identity.

 IMPORTANT:
 - Does NOT fabricate motion.
 - Does NOT fabricate ETA.
 - Does NOT modify raw source observations.
 - Uses spatial + temporal continuity only.
 - Produces persistent identities for downstream 39A-15C / 39A-15B.
============================================================================ */

(function () {
    "use strict";

    const PHASE = "39A-15D";
    const VERSION = "39A.15D.0";
    const BUILD = "rainguard-v39-persistent-storm-identity-linker";

    /* ------------------------------------------------------------------------
       Configuration
    ------------------------------------------------------------------------ */

    const CONFIG = Object.freeze({

        // Maximum plausible displacement between consecutive observations.
        maxLinkDistanceKm: 120,

        // Maximum time gap between observations.
        maxTimeGapMinutes: 90,

        // Minimum time difference. Prevents same-cycle observations from
        // becoming an artificial motion sequence.
        minTimeGapSeconds: 20,

        // Spatial matching weight.
        distanceWeight: 0.65,

        // Temporal matching weight.
        timeWeight: 0.25,

        // Intensity similarity weight when intensity exists.
        intensityWeight: 0.10,

        // Maximum accepted normalized match score.
        maxMatchScore: 0.72,

        // Prevent unlimited memory growth.
        maxPersistentIdentities: 5000,

        // Maximum observations retained for one persistent identity.
        maxObservationsPerIdentity: 30
    });

    /* ------------------------------------------------------------------------
       Internal State
    ------------------------------------------------------------------------ */

    const state = {
        running: true,
        runInProgress: false,
        sequence: 0,

        persistentIdentities: new Map(),

        statistics: {
            runs: 0,
            observationsScanned: 0,
            observationsAccepted: 0,
            identitiesCreated: 0,
            observationsLinked: 0,
            identitiesWithMultiplePoints: 0,
            rejectedInvalid: 0,
            rejectedTemporal: 0,
            rejectedSpatial: 0
        },

        lastResult: null,
        lastError: null
    };

    /* ------------------------------------------------------------------------
       Utilities
    ------------------------------------------------------------------------ */

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

    function firstValue(...values) {
        for (const value of values) {
            if (
                value !== undefined &&
                value !== null &&
                value !== ""
            ) {
                return value;
            }
        }
        return null;
    }

    function parseTimestamp(value) {
        if (value === undefined || value === null) return null;

        if (typeof value === "number" && Number.isFinite(value)) {
            // Seconds timestamp
            if (value < 1e12) return value * 1000;

            // Milliseconds timestamp
            return value;
        }

        const parsed = Date.parse(value);

        return Number.isFinite(parsed)
            ? parsed
            : null;
    }

    function haversineKm(lat1, lon1, lat2, lon2) {

        const R = 6371;

        const toRad = deg => deg * Math.PI / 180;

        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);

        const a =
            Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) *
            Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) ** 2;

        const c = 2 * Math.atan2(
            Math.sqrt(a),
            Math.sqrt(1 - a)
        );

        return R * c;
    }

    function createPersistentId() {

        state.sequence += 1;

        return [
            "RG-STORM",
            Date.now().toString(36),
            state.sequence.toString(36)
        ].join("-");
    }

    /* ------------------------------------------------------------------------
       Observation Normalization
    ------------------------------------------------------------------------ */

    function normalizeObservation(raw, historyKey) {

        if (!raw || typeof raw !== "object") {
            return null;
        }

        const coordinate =
            raw.coordinate ||
            raw.coordinates ||
            raw.position ||
            raw.location ||
            {};

        const latitude = firstFinite(
            raw.latitude,
            raw.lat,
            coordinate.latitude,
            coordinate.lat
        );

        const longitude = firstFinite(
            raw.longitude,
            raw.lon,
            raw.lng,
            coordinate.longitude,
            coordinate.lon,
            coordinate.lng
        );

        if (
            latitude === null ||
            longitude === null ||
            latitude < -90 ||
            latitude > 90 ||
            longitude < -180 ||
            longitude > 180
        ) {
            return null;
        }

        const timestamp = parseTimestamp(
            firstValue(
                raw.timestamp,
                raw.observedAt,
                raw.observationTime,
                raw.time,
                raw.generatedAt,
                raw.createdAt,
                raw.updatedAt
            )
        );

        if (timestamp === null) {
            return null;
        }

        const intensity = firstFinite(
            raw.intensity,
            raw.dbz,
            raw.reflectivity,
            raw.rainIntensity,
            raw.strength
        );

        return {
            raw,
            historyKey,

            sourceTrackId: firstValue(
                raw.trackId,
                raw.cellId,
                raw.stormId,
                raw.id,
                historyKey
            ),

            latitude,
            longitude,
            timestamp,
            intensity,

            source: firstValue(
                raw.source,
                raw.provider,
                raw.origin
            )
        };
    }

    /* ------------------------------------------------------------------------
       Read Persistent Observation Source
    ------------------------------------------------------------------------ */

    function readObservationHistory() {

        /*
         Primary source created by 39A-15C.
         Fallback sources are intentionally read-only.
        */

        const possibleSources = [
            window.RainGuardPersistentStormObservationHistory,
            window.RainGuardPersistentStormObservations,
            window.RainArrivalPersistentStormHistory,
            window.RainArrivalLiveTrackHistory,
            window.RainArrivalTrackHistoryV32,
            window.RainArrivalTrackHistory
        ];

        for (const source of possibleSources) {

            if (!source) continue;

            if (source instanceof Map) {

                const result = [];

                for (const [key, value] of source.entries()) {

                    if (Array.isArray(value)) {
                        for (const item of value) {
                            result.push({
                                historyKey: key,
                                raw: item
                            });
                        }
                    } else {
                        result.push({
                            historyKey: key,
                            raw: value
                        });
                    }
                }

                if (result.length) {
                    return result;
                }
            }

            if (Array.isArray(source)) {

                if (source.length) {
                    return source.map((raw, index) => ({
                        historyKey: String(index),
                        raw
                    }));
                }
            }

            if (typeof source === "object") {

                const result = [];

                for (const [key, value] of Object.entries(source)) {

                    if (Array.isArray(value)) {

                        for (const item of value) {
                            result.push({
                                historyKey: key,
                                raw: item
                            });
                        }

                    } else if (value && typeof value === "object") {

                        result.push({
                            historyKey: key,
                            raw: value
                        });
                    }
                }

                if (result.length) {
                    return result;
                }
            }
        }

        return [];
    }

    /* ------------------------------------------------------------------------
       Candidate Matching
    ------------------------------------------------------------------------ */

    function calculateMatchScore(observation, identity) {

        if (!identity || !identity.lastObservation) {
            return null;
        }

        const previous = identity.lastObservation;

        const dtMs =
            observation.timestamp -
            previous.timestamp;

        if (dtMs <= 0) {
            return null;
        }

        const dtSeconds = dtMs / 1000;
        const dtMinutes = dtSeconds / 60;

        if (
            dtSeconds < CONFIG.minTimeGapSeconds ||
            dtMinutes > CONFIG.maxTimeGapMinutes
        ) {
            return null;
        }

        const distanceKm = haversineKm(
            previous.latitude,
            previous.longitude,
            observation.latitude,
            observation.longitude
        );

        if (distanceKm > CONFIG.maxLinkDistanceKm) {
            return null;
        }

        const distanceScore =
            distanceKm / CONFIG.maxLinkDistanceKm;

        const timeScore =
            dtMinutes / CONFIG.maxTimeGapMinutes;

        let intensityScore = 0;

        if (
            previous.intensity !== null &&
            observation.intensity !== null
        ) {
            const maxIntensity = Math.max(
                Math.abs(previous.intensity),
                Math.abs(observation.intensity),
                1
            );

            intensityScore =
                Math.abs(
                    observation.intensity -
                    previous.intensity
                ) / maxIntensity;
        }

        const score =
            distanceScore * CONFIG.distanceWeight +
            timeScore * CONFIG.timeWeight +
            intensityScore * CONFIG.intensityWeight;

        return {
            score,
            distanceKm,
            dtSeconds,
            dtMinutes,
            intensityScore
        };
    }

    function findBestIdentity(observation) {

        let best = null;

        for (const identity of state.persistentIdentities.values()) {

            const match =
                calculateMatchScore(
                    observation,
                    identity
                );

            if (!match) continue;

            if (
                !best ||
                match.score < best.match.score
            ) {
                best = {
                    identity,
                    match
                };
            }
        }

        if (
            !best ||
            best.match.score > CONFIG.maxMatchScore
        ) {
            return null;
        }

        return best;
    }

    /* ------------------------------------------------------------------------
       Persistent Identity Creation
    ------------------------------------------------------------------------ */

    function createIdentity(observation) {

        const persistentId =
            createPersistentId();

        const identity = {

            persistentId,

            createdAt: Date.now(),

            firstObservation: observation,

            lastObservation: observation,

            observations: [observation],

            sourceTrackIds: new Set(
                observation.sourceTrackId
                    ? [String(observation.sourceTrackId)]
                    : []
            ),

            observationCount: 1
        };

        state.persistentIdentities.set(
            persistentId,
            identity
        );

        state.statistics.identitiesCreated++;

        return identity;
    }

    /* ------------------------------------------------------------------------
       Append Observation
    ------------------------------------------------------------------------ */

    function appendObservation(identity, observation, match) {

        identity.observations.push({
            ...observation,

            link: {
                score: match.score,
                distanceKm: match.distanceKm,
                dtSeconds: match.dtSeconds,
                dtMinutes: match.dtMinutes
            }
        });

        if (
            identity.observations.length >
            CONFIG.maxObservationsPerIdentity
        ) {
            identity.observations.splice(
                0,
                identity.observations.length -
                CONFIG.maxObservationsPerIdentity
            );
        }

        identity.lastObservation = observation;

        identity.observationCount++;

        if (observation.sourceTrackId) {
            identity.sourceTrackIds.add(
                String(observation.sourceTrackId)
            );
        }

        state.statistics.observationsLinked++;
    }

    /* ------------------------------------------------------------------------
       Prevent Duplicate Processing
    ------------------------------------------------------------------------ */

    const processedObservationKeys = new Set();

    function observationFingerprint(observation) {

        return [
            observation.sourceTrackId || "",
            observation.latitude.toFixed(5),
            observation.longitude.toFixed(5),
            observation.timestamp
        ].join("|");
    }

    /* ------------------------------------------------------------------------
       Memory Maintenance
    ------------------------------------------------------------------------ */

    function pruneIdentities() {

        if (
            state.persistentIdentities.size <=
            CONFIG.maxPersistentIdentities
        ) {
            return;
        }

        const identities =
            Array.from(
                state.persistentIdentities.values()
            );

        identities.sort(
            (a, b) =>
                a.lastObservation.timestamp -
                b.lastObservation.timestamp
        );

        const removeCount =
            identities.length -
            CONFIG.maxPersistentIdentities;

        for (let i = 0; i < removeCount; i++) {
            state.persistentIdentities.delete(
                identities[i].persistentId
            );
        }
    }

    /* ------------------------------------------------------------------------
       Export
    ------------------------------------------------------------------------ */

    function exportPersistentHistory() {

        const output = {};

        for (
            const [persistentId, identity]
            of state.persistentIdentities.entries()
        ) {

            output[persistentId] =
                identity.observations.map(obs => ({

                    persistentStormId:
                        persistentId,

                    trackId:
                        persistentId,

                    originalTrackId:
                        obs.sourceTrackId,

                    latitude:
                        obs.latitude,

                    longitude:
                        obs.longitude,

                    coordinate: {
                        latitude: obs.latitude,
                        longitude: obs.longitude
                    },

                    timestamp:
                        obs.timestamp,

                    observedAt:
                        new Date(
                            obs.timestamp
                        ).toISOString(),

                    intensity:
                        obs.intensity,

                    source:
                        obs.source,

                    identityLink:
                        obs.link || null
                }));
        }

        /*
         Dedicated output.
         We intentionally do NOT overwrite raw history.
        */

        window.RainGuardPersistentStormIdentityHistory =
            output;

        window.RainGuardPersistentStormIdentityMap =
            state.persistentIdentities;

        return output;
    }

    /* ------------------------------------------------------------------------
       Main Runner
    ------------------------------------------------------------------------ */

    async function runPersistentStormIdentityLinker(
        options = {}
    ) {

        if (state.runInProgress) {

            return {
                success: false,
                phase: PHASE,
                version: VERSION,
                status: "RUN_ALREADY_IN_PROGRESS"
            };
        }

        state.runInProgress = true;
        state.statistics.runs++;

        try {

            const source =
                readObservationHistory();

            state.statistics.observationsScanned +=
                source.length;

            const observations = [];

            for (const entry of source) {

                const normalized =
                    normalizeObservation(
                        entry.raw,
                        entry.historyKey
                    );

                if (!normalized) {
                    state.statistics.rejectedInvalid++;
                    continue;
                }

                const fingerprint =
                    observationFingerprint(
                        normalized
                    );

                if (
                    processedObservationKeys.has(
                        fingerprint
                    )
                ) {
                    continue;
                }

                processedObservationKeys.add(
                    fingerprint
                );

                observations.push(
                    normalized
                );
            }

            /*
             Critical:
             process chronologically.
            */

            observations.sort(
                (a, b) =>
                    a.timestamp -
                    b.timestamp
            );

            let createdThisRun = 0;
            let linkedThisRun = 0;

            for (const observation of observations) {

                state.statistics.observationsAccepted++;

                const best =
                    findBestIdentity(
                        observation
                    );

                if (best) {

                    appendObservation(
                        best.identity,
                        observation,
                        best.match
                    );

                    linkedThisRun++;

                } else {

                    createIdentity(
                        observation
                    );

                    createdThisRun++;
                }
            }

            pruneIdentities();

            const exported =
                exportPersistentHistory();

            const identities =
                Array.from(
                    state.persistentIdentities.values()
                );

            const identitiesWithMultiplePoints =
                identities.filter(
                    identity =>
                        identity.observationCount >= 2
                ).length;

            state.statistics.identitiesWithMultiplePoints =
                identitiesWithMultiplePoints;

            const maxObservationCount =
                identities.reduce(
                    (max, identity) =>
                        Math.max(
                            max,
                            identity.observationCount
                        ),
                    0
                );

            const result = {

                success: true,

                phase: PHASE,
                version: VERSION,
                build: BUILD,

                status:
                    identitiesWithMultiplePoints > 0
                        ? "PERSISTENT_STORM_IDENTITIES_LINKED"
                        : "WAITING_FOR_REPEAT_STORM_OBSERVATIONS",

                sourceObservationCount:
                    source.length,

                newObservationCount:
                    observations.length,

                persistentIdentityCount:
                    identities.length,

                identitiesCreatedThisRun:
                    createdThisRun,

                observationsLinkedThisRun:
                    linkedThisRun,

                identitiesWithMultiplePoints,

                maxObservationCount,

                exportedIdentityCount:
                    Object.keys(exported).length,

                statistics: {
                    ...state.statistics
                },

                generatedAt:
                    Date.now()
            };

            state.lastResult = result;
            state.lastError = null;

            if (!options.silent) {
                console.log(
                    "[RainGuard Phase 39A-15D] Persistent Storm Identity Linker result:",
                    result
                );
            }

            return result;

        } catch (error) {

            state.lastError = error;

            const result = {

                success: false,

                phase: PHASE,
                version: VERSION,
                build: BUILD,

                status:
                    "PERSISTENT_IDENTITY_LINKER_FAILED",

                error:
                    error?.message ||
                    String(error),

                generatedAt:
                    Date.now()
            };

            state.lastResult = result;

            console.error(
                "[RainGuard Phase 39A-15D]",
                error
            );

            return result;

        } finally {

            state.runInProgress = false;
        }
    }

    /* ------------------------------------------------------------------------
       Diagnostic
    ------------------------------------------------------------------------ */

    function diagnosePersistentStormIdentityLinker() {

        const identities =
            Array.from(
                state.persistentIdentities.values()
            );

        const multiple =
            identities
                .filter(
                    identity =>
                        identity.observationCount >= 2
                )
                .sort(
                    (a, b) =>
                        b.observationCount -
                        a.observationCount
                );

        const diagnostic = {

            phase: PHASE,
            version: VERSION,
            build: BUILD,

            running:
                state.running,

            runInProgress:
                state.runInProgress,

            persistentIdentityCount:
                identities.length,

            identitiesWithMultiplePoints:
                multiple.length,

            strongestIdentities:
                multiple
                    .slice(0, 10)
                    .map(identity => ({

                        persistentId:
                            identity.persistentId,

                        observationCount:
                            identity.observationCount,

                        sourceTrackIds:
                            Array.from(
                                identity.sourceTrackIds
                            ),

                        firstTimestamp:
                            identity.firstObservation.timestamp,

                        lastTimestamp:
                            identity.lastObservation.timestamp,

                        firstCoordinate: {
                            latitude:
                                identity.firstObservation.latitude,
                            longitude:
                                identity.firstObservation.longitude
                        },

                        lastCoordinate: {
                            latitude:
                                identity.lastObservation.latitude,
                            longitude:
                                identity.lastObservation.longitude
                        }
                    })),

            statistics: {
                ...state.statistics
            },

            lastResult:
                state.lastResult,

            lastError:
                state.lastError
                    ? (
                        state.lastError.message ||
                        String(state.lastError)
                    )
                    : null
        };

        console.log(
            "[RainGuard Phase 39A-15D] Diagnostic:",
            diagnostic
        );

        return diagnostic;
    }

    /* ------------------------------------------------------------------------
       Public API
    ------------------------------------------------------------------------ */

    window.runRainGuardPersistentStormIdentityLinker =
        runPersistentStormIdentityLinker;

    window.diagnoseRainGuardPersistentStormIdentityLinker =
        diagnosePersistentStormIdentityLinker;

    window.getRainGuardPersistentStormIdentityHistory =
        function () {
            return (
                window.RainGuardPersistentStormIdentityHistory ||
                {}
            );
        };

    window.getRainGuardPersistentStormIdentities =
        function () {
            return Array.from(
                state.persistentIdentities.values()
            );
        };

    window.RainGuardPersistentStormIdentityLinkerState =
        state;

    console.log(
        `[RainGuard Phase ${PHASE}] Persistent Storm Identity Linker loaded — ${VERSION}`
    );

})();
