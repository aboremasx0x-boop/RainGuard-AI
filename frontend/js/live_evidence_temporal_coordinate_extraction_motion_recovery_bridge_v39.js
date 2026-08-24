/*
====================================================================
RainGuard AI V39
Phase 39A-15F6N4B1B3B-H3B2C
Live Evidence Temporal Coordinate Extraction & Motion Recovery Bridge
====================================================================

Purpose:
- Discover authoritative live temporal track history.
- Extract identity + coordinates + timestamp.
- Normalize heterogeneous observation shapes.
- Group observations by stable identity.
- Sort observations chronologically.
- Detect real coordinate change.
- Recover temporal motion from consecutive observations.
- Publish canonical motion-ready temporal source.
- Preserve source/provenance metadata.
*/

(function () {
    "use strict";

    const PHASE = "39A-15F6N4B1B3B-H3B2C";
    const VERSION = "39A.15F6N4B1B3B.H3B2C.0";
    const BUILD =
        "rainguard-v39-live-evidence-temporal-coordinate-extraction-motion-recovery-bridge";

    const RESULT_NAME =
        "RainGuardN4B1B3BH3B2CResultV39";

    const CANONICAL_SOURCE_NAME =
        "RainGuardN4B1B3BH3B2CMotionTemporalSourceV39";

    const MOTION_RECORDS_NAME =
        "RainGuardN4B1B3BH3B2CMotionRecordsV39";

    const MEMORY_NAME =
        "RainGuardN4B1B3BH3B2CMotionMemoryV39";

    const SOURCE_PRIORITY = [
        "RainArrivalLiveTrackHistory",
        "RainArrivalTrackHistoryV32",
        "RainGuardPersistentStormObservationHistoryV39",
        "RainGuardPersistentStormTemporalObservationHistoryV39"
    ];

    const EARTH_RADIUS_M = 6371000;

    /* ------------------------------------------------------------- */
    /* Utilities                                                     */
    /* ------------------------------------------------------------- */

    function now() {
        return Date.now();
    }

    function isObject(v) {
        return v !== null && typeof v === "object";
    }

    function finiteNumber(v) {
        if (v === null || v === undefined || v === "") return null;

        const n = Number(v);

        return Number.isFinite(n) ? n : null;
    }

    function firstDefined(obj, keys) {
        if (!obj) return null;

        for (const key of keys) {
            try {
                const value = obj[key];

                if (
                    value !== undefined &&
                    value !== null &&
                    value !== ""
                ) {
                    return value;
                }
            } catch (_) {}
        }

        return null;
    }

    function normalizeTimestamp(value) {
        if (value === null || value === undefined) {
            return null;
        }

        if (value instanceof Date) {
            const n = value.getTime();

            return Number.isFinite(n) ? n : null;
        }

        if (typeof value === "number") {
            if (!Number.isFinite(value)) return null;

            /*
             seconds → milliseconds
            */
            if (value > 1000000000 && value < 100000000000) {
                return value * 1000;
            }

            return value;
        }

        if (typeof value === "string") {
            const trimmed = value.trim();

            if (!trimmed) return null;

            const asNumber = Number(trimmed);

            if (Number.isFinite(asNumber)) {
                return normalizeTimestamp(asNumber);
            }

            const parsed = Date.parse(trimmed);

            return Number.isFinite(parsed) ? parsed : null;
        }

        return null;
    }

    function validCoordinate(lat, lon) {
        return (
            Number.isFinite(lat) &&
            Number.isFinite(lon) &&
            lat >= -90 &&
            lat <= 90 &&
            lon >= -180 &&
            lon <= 180
        );
    }

    function toRadians(deg) {
        return deg * Math.PI / 180;
    }

    function toDegrees(rad) {
        return rad * 180 / Math.PI;
    }

    function haversineMeters(lat1, lon1, lat2, lon2) {
        const φ1 = toRadians(lat1);
        const φ2 = toRadians(lat2);
        const Δφ = toRadians(lat2 - lat1);
        const Δλ = toRadians(lon2 - lon1);

        const a =
            Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) *
                Math.cos(φ2) *
                Math.sin(Δλ / 2) *
                Math.sin(Δλ / 2);

        const c =
            2 *
            Math.atan2(
                Math.sqrt(a),
                Math.sqrt(1 - a)
            );

        return EARTH_RADIUS_M * c;
    }

    function bearingDegrees(lat1, lon1, lat2, lon2) {
        const φ1 = toRadians(lat1);
        const φ2 = toRadians(lat2);
        const λ1 = toRadians(lon1);
        const λ2 = toRadians(lon2);

        const y =
            Math.sin(λ2 - λ1) *
            Math.cos(φ2);

        const x =
            Math.cos(φ1) * Math.sin(φ2) -
            Math.sin(φ1) *
                Math.cos(φ2) *
                Math.cos(λ2 - λ1);

        let bearing =
            toDegrees(Math.atan2(y, x));

        bearing =
            (bearing + 360) % 360;

        return bearing;
    }

    /* ------------------------------------------------------------- */
    /* Identity Extraction                                           */
    /* ------------------------------------------------------------- */

    function extractIdentity(record, fallbackIdentity) {
        const direct =
            firstDefined(record, [
                "identity",
                "identityId",
                "stableIdentity",
                "stableIdentityId",
                "stormIdentity",
                "stormIdentityId",
                "stormId",
                "trackId",
                "entityId",
                "stormEntityId",
                "cellId",
                "id",
                "key",
                "name"
            ]);

        if (direct !== null) {
            return String(direct);
        }

        if (fallbackIdentity !== undefined &&
            fallbackIdentity !== null) {
            return String(fallbackIdentity);
        }

        return null;
    }

    /* ------------------------------------------------------------- */
    /* Coordinate Extraction                                         */
    /* ------------------------------------------------------------- */

    function extractCoordinates(record) {
        if (!record) return null;

        const candidates = [];

        candidates.push({
            lat: firstDefined(record, [
                "lat",
                "latitude",
                "centerLat",
                "centroidLat",
                "stormLat",
                "y"
            ]),
            lon: firstDefined(record, [
                "lon",
                "lng",
                "longitude",
                "centerLon",
                "centerLng",
                "centroidLon",
                "centroidLng",
                "stormLon",
                "stormLng",
                "x"
            ])
        });

        const nestedKeys = [
            "coordinate",
            "coordinates",
            "location",
            "position",
            "center",
            "centroid",
            "currentPosition",
            "currentLocation",
            "geo",
            "geometry"
        ];

        for (const key of nestedKeys) {
            const nested = record[key];

            if (!nested) continue;

            if (Array.isArray(nested)) {
                if (nested.length >= 2) {
                    /*
                     GeoJSON commonly uses [lon, lat]
                    */
                    candidates.push({
                        lat: nested[1],
                        lon: nested[0]
                    });

                    /*
                     fallback [lat, lon]
                    */
                    candidates.push({
                        lat: nested[0],
                        lon: nested[1]
                    });
                }
            } else if (isObject(nested)) {
                candidates.push({
                    lat: firstDefined(nested, [
                        "lat",
                        "latitude",
                        "y"
                    ]),
                    lon: firstDefined(nested, [
                        "lon",
                        "lng",
                        "longitude",
                        "x"
                    ])
                });

                if (
                    nested.coordinates &&
                    Array.isArray(nested.coordinates) &&
                    nested.coordinates.length >= 2
                ) {
                    candidates.push({
                        lat: nested.coordinates[1],
                        lon: nested.coordinates[0]
                    });
                }
            }
        }

        for (const c of candidates) {
            const lat = finiteNumber(c.lat);
            const lon = finiteNumber(c.lon);

            if (validCoordinate(lat, lon)) {
                return { lat, lon };
            }
        }

        return null;
    }

    /* ------------------------------------------------------------- */
    /* Timestamp Extraction                                          */
    /* ------------------------------------------------------------- */

    function extractTimestamp(record) {
        const raw =
            firstDefined(record, [
                "timestamp",
                "time",
                "observedAt",
                "observationTime",
                "capturedAt",
                "detectedAt",
                "generatedAt",
                "createdAt",
                "updatedAt",
                "scanTime",
                "eventTime",
                "cycleTimestamp",
                "ts"
            ]);

        return normalizeTimestamp(raw);
    }

    /* ------------------------------------------------------------- */
    /* Observation Normalization                                     */
    /* ------------------------------------------------------------- */

    function normalizeObservation(
        record,
        fallbackIdentity,
        sourceName,
        sequenceIndex
    ) {
        if (!record) return null;

        let data = record;

        /*
         Some records wrap actual observation.
        */
        const wrappers = [
            "observation",
            "payload",
            "data",
            "value",
            "record",
            "entity",
            "storm",
            "track"
        ];

        for (const wrapper of wrappers) {
            try {
                if (
                    isObject(record[wrapper]) &&
                    !Array.isArray(record[wrapper])
                ) {
                    const wrappedCoordinates =
                        extractCoordinates(record[wrapper]);

                    const wrappedTime =
                        extractTimestamp(record[wrapper]);

                    if (
                        wrappedCoordinates ||
                        wrappedTime
                    ) {
                        data = Object.assign(
                            {},
                            record,
                            record[wrapper]
                        );

                        break;
                    }
                }
            } catch (_) {}
        }

        const identity =
            extractIdentity(data, fallbackIdentity);

        const coordinates =
            extractCoordinates(data);

        const timestamp =
            extractTimestamp(data);

        if (!identity ||
            !coordinates ||
            timestamp === null) {
            return null;
        }

        return {
            identity,
            lat: coordinates.lat,
            lon: coordinates.lon,
            timestamp,

            sourceName,
            sequenceIndex,

            provenance: {
                phase: PHASE,
                sourceName,
                extractedAt: now()
            },

            raw: record
        };
    }

    /* ------------------------------------------------------------- */
    /* Generic Source Flattening                                     */
    /* ------------------------------------------------------------- */

    function flattenSource(source, sourceName) {
        const output = [];
        const seen = new WeakSet();

        let sequenceIndex = 0;

        function visit(value, fallbackIdentity, depth) {
            if (value === null ||
                value === undefined ||
                depth > 8) {
                return;
            }

            if (isObject(value)) {
                if (seen.has(value)) return;

                seen.add(value);
            }

            if (Array.isArray(value)) {
                for (const item of value) {
                    visit(
                        item,
                        fallbackIdentity,
                        depth + 1
                    );
                }

                return;
            }

            if (!isObject(value)) {
                return;
            }

            const normalized =
                normalizeObservation(
                    value,
                    fallbackIdentity,
                    sourceName,
                    sequenceIndex++
                );

            if (normalized) {
                output.push(normalized);
            }

            const entries =
                Object.entries(value);

            for (const [key, child] of entries) {
                if (
                    child === null ||
                    child === undefined
                ) {
                    continue;
                }

                if (
                    key === "raw" ||
                    key === "provenance"
                ) {
                    continue;
                }

                let nextFallback =
                    fallbackIdentity;

                /*
                 Object keys often represent track identity.
                */
                if (
                    Array.isArray(child) &&
                    typeof key === "string"
                ) {
                    nextFallback = key;
                }

                if (
                    isObject(child)
                ) {
                    visit(
                        child,
                        nextFallback,
                        depth + 1
                    );
                }
            }
        }

        visit(source, null, 0);

        return output;
    }

    /* ------------------------------------------------------------- */
    /* Source Discovery                                              */
    /* ------------------------------------------------------------- */

    function discoverSource() {
        const discovered = [];

        for (const name of SOURCE_PRIORITY) {
            try {
                const value = window[name];

                if (!value) continue;

                const observations =
                    flattenSource(value, name);

                discovered.push({
                    name,
                    value,
                    observations,
                    observationCount:
                        observations.length
                });
            } catch (_) {}
        }

        discovered.sort(
            (a, b) =>
                b.observationCount -
                a.observationCount
        );

        /*
         Prefer live history when usable,
         even if another source happens to contain
         more duplicate records.
        */
        const preferred =
            discovered.find(
                x =>
                    x.name ===
                        "RainArrivalLiveTrackHistory" &&
                    x.observationCount > 0
            );

        return {
            selected:
                preferred ||
                discovered[0] ||
                null,
            candidates:
                discovered
        };
    }

    /* ------------------------------------------------------------- */
    /* Deduplication                                                  */
    /* ------------------------------------------------------------- */

    function observationKey(obs) {
        return [
            obs.identity,
            obs.timestamp,
            obs.lat.toFixed(6),
            obs.lon.toFixed(6)
        ].join("|");
    }

    function deduplicateObservations(records) {
        const map = new Map();

        for (const record of records) {
            const key =
                observationKey(record);

            if (!map.has(key)) {
                map.set(key, record);
            }
        }

        return Array.from(map.values());
    }

    /* ------------------------------------------------------------- */
    /* Group by Identity                                              */
    /* ------------------------------------------------------------- */

    function groupByIdentity(records) {
        const groups = new Map();

        for (const record of records) {
            if (!groups.has(record.identity)) {
                groups.set(
                    record.identity,
                    []
                );
            }

            groups
                .get(record.identity)
                .push(record);
        }

        for (const group of groups.values()) {
            group.sort(
                (a, b) =>
                    a.timestamp -
                    b.timestamp
            );
        }

        return groups;
    }

    /* ------------------------------------------------------------- */
    /* Motion Recovery                                                */
    /* ------------------------------------------------------------- */

    function recoverMotionForIdentity(
        identity,
        observations
    ) {
        if (!Array.isArray(observations) ||
            observations.length < 2) {
            return [];
        }

        const motions = [];

        for (
            let i = 1;
            i < observations.length;
            i++
        ) {
            const previous =
                observations[i - 1];

            const current =
                observations[i];

            const dtMs =
                current.timestamp -
                previous.timestamp;

            if (!(dtMs > 0)) {
                continue;
            }

            const changed =
                previous.lat !== current.lat ||
                previous.lon !== current.lon;

            if (!changed) {
                continue;
            }

            const distanceMeters =
                haversineMeters(
                    previous.lat,
                    previous.lon,
                    current.lat,
                    current.lon
                );

            /*
             Ignore numerical noise.
             > 1 meter considered meaningful.
            */
            if (
                !Number.isFinite(distanceMeters) ||
                distanceMeters < 1
            ) {
                continue;
            }

            const dtSeconds =
                dtMs / 1000;

            const speedMps =
                distanceMeters / dtSeconds;

            const speedKmh =
                speedMps * 3.6;

            const bearing =
                bearingDegrees(
                    previous.lat,
                    previous.lon,
                    current.lat,
                    current.lon
                );

            motions.push({
                identity,

                from: {
                    lat: previous.lat,
                    lon: previous.lon,
                    timestamp:
                        previous.timestamp
                },

                to: {
                    lat: current.lat,
                    lon: current.lon,
                    timestamp:
                        current.timestamp
                },

                delta: {
                    lat:
                        current.lat -
                        previous.lat,

                    lon:
                        current.lon -
                        previous.lon,

                    timeMs:
                        dtMs,

                    timeSeconds:
                        dtSeconds
                },

                distanceMeters,

                bearingDegrees:
                    bearing,

                speedMps,

                speedKmh,

                sourceName:
                    current.sourceName,

                previousSourceName:
                    previous.sourceName,

                recoveredAt:
                    now(),

                phase:
                    PHASE
            });
        }

        return motions;
    }

    function recoverAllMotion(groups) {
        const motionRecords = [];

        for (const [identity, observations]
            of groups.entries()) {

            const recovered =
                recoverMotionForIdentity(
                    identity,
                    observations
                );

            motionRecords.push(
                ...recovered
            );
        }

        return motionRecords;
    }

    /* ------------------------------------------------------------- */
    /* Canonical Temporal Source                                      */
    /* ------------------------------------------------------------- */

    function buildCanonicalSource(
        groups,
        motionRecords,
        selectedSource
    ) {
        const identities = [];

        for (const [identity, observations]
            of groups.entries()) {

            const identityMotion =
                motionRecords.filter(
                    m => m.identity === identity
                );

            identities.push({
                identity,

                observationCount:
                    observations.length,

                uniqueCoordinateCount:
                    new Set(
                        observations.map(
                            o =>
                                o.lat.toFixed(6) +
                                "," +
                                o.lon.toFixed(6)
                        )
                    ).size,

                firstTimestamp:
                    observations[0]
                        ?.timestamp || null,

                lastTimestamp:
                    observations[
                        observations.length - 1
                    ]?.timestamp || null,

                movementRecovered:
                    identityMotion.length > 0,

                motionRecordCount:
                    identityMotion.length,

                observations,

                motionRecords:
                    identityMotion
            });
        }

        return {
            phase: PHASE,
            version: VERSION,
            build: BUILD,

            authoritativeSource:
                selectedSource?.name || null,

            generatedAt: now(),

            identityCount:
                identities.length,

            motionIdentityCount:
                identities.filter(
                    x => x.movementRecovered
                ).length,

            motionRecordCount:
                motionRecords.length,

            identities
        };
    }

    /* ------------------------------------------------------------- */
    /* Persistence                                                    */
    /* ------------------------------------------------------------- */

    function persist(result) {
        try {
            localStorage.setItem(
                "RainGuard:39A15F6N4B1B3B:H3B2C:result",
                JSON.stringify({
                    phase:
                        result.phase,
                    version:
                        result.version,
                    status:
                        result.status,
                    generatedAt:
                        result.generatedAt,
                    selectedSourceName:
                        result.selectedSourceName,
                    observationCount:
                        result.observationCount,
                    identityCount:
                        result.identityCount,
                    motionIdentityCount:
                        result.motionIdentityCount,
                    motionRecordCount:
                        result.motionRecordCount
                })
            );

            return true;
        } catch (_) {
            return false;
        }
    }

    /* ------------------------------------------------------------- */
    /* Main Runner                                                    */
    /* ------------------------------------------------------------- */

    async function run(options = {}) {
        const started = now();

        const discovery =
            discoverSource();

        const selected =
            discovery.selected;

        if (!selected) {
            const failure = {
                success: false,

                phase: PHASE,
                version: VERSION,
                build: BUILD,

                status:
                    "NO_AUTHORITATIVE_TEMPORAL_SOURCE_FOUND",

                generatedAt:
                    now(),

                durationMs:
                    now() - started,

                candidateSources:
                    discovery.candidates.map(
                        x => ({
                            name: x.name,
                            observationCount:
                                x.observationCount
                        })
                    )
            };

            window[RESULT_NAME] =
                failure;

            console.warn(
                "[RainGuard H3B2C]",
                failure
            );

            return failure;
        }

        let observations =
            selected.observations;

        const rawObservationCount =
            observations.length;

        observations =
            deduplicateObservations(
                observations
            );

        const deduplicatedObservationCount =
            observations.length;

        const groups =
            groupByIdentity(
                observations
            );

        const motionRecords =
            recoverAllMotion(groups);

        const canonicalSource =
            buildCanonicalSource(
                groups,
                motionRecords,
                selected
            );

        const motionIdentityCount =
            canonicalSource
                .motionIdentityCount;

        let status;

        if (
            observations.length === 0
        ) {
            status =
                "AUTHORITATIVE_SOURCE_FOUND_BUT_NO_VALID_TEMPORAL_COORDINATES";
        } else if (
            groups.size === 0
        ) {
            status =
                "TEMPORAL_COORDINATES_FOUND_BUT_IDENTITY_ALIGNMENT_FAILED";
        } else if (
            motionRecords.length === 0
        ) {
            status =
                "TEMPORAL_COORDINATES_RECOVERED_BUT_NO_COORDINATE_CHANGE_YET";
        } else {
            status =
                "LIVE_TEMPORAL_COORDINATE_MOTION_RECOVERED";
        }

        const maxObservedPointsPerIdentity =
            Math.max(
                0,
                ...Array.from(
                    groups.values()
                ).map(
                    x => x.length
                )
            );

        const maxUniqueCoordinatesPerIdentity =
            Math.max(
                0,
                ...Array.from(
                    groups.values()
                ).map(
                    list =>
                        new Set(
                            list.map(
                                o =>
                                    o.lat.toFixed(6) +
                                    "," +
                                    o.lon.toFixed(6)
                            )
                        ).size
                )
            );

        const result = {
            success:
                motionRecords.length > 0,

            phase: PHASE,
            version: VERSION,
            build: BUILD,

            status,

            generatedAt:
                now(),

            durationMs:
                now() - started,

            selectedSourceName:
                selected.name,

            selectedSourceType:
                Array.isArray(
                    selected.value
                )
                    ? "array"
                    : typeof selected.value,

            candidateSourceCount:
                discovery.candidates.length,

            candidateSources:
                discovery.candidates.map(
                    x => ({
                        name: x.name,
                        observationCount:
                            x.observationCount
                    })
                ),

            rawObservationCount,

            observationCount:
                deduplicatedObservationCount,

            duplicateObservationCount:
                rawObservationCount -
                deduplicatedObservationCount,

            identityCount:
                groups.size,

            multiPointIdentityCount:
                Array.from(
                    groups.values()
                ).filter(
                    x => x.length >= 2
                ).length,

            motionIdentityCount,

            motionRecordCount:
                motionRecords.length,

            maxObservedPointsPerIdentity,

            maxUniqueCoordinatesPerIdentity,

            coordinateChangeGatePassed:
                motionRecords.length > 0,

            motionRecoveryGatePassed:
                motionRecords.length > 0,

            canonicalSourcePublished:
                true,

            persistedToLocalStorage:
                false,

            sample:
                canonicalSource.identities
                    .slice(0, 20),

            motionSample:
                motionRecords.slice(0, 20)
        };

        /*
         Publish canonical runtime objects.
        */

        window[
            CANONICAL_SOURCE_NAME
        ] = canonicalSource;

        window[
            MOTION_RECORDS_NAME
        ] = motionRecords;

        window[
            MEMORY_NAME
        ] = {
            sourceName:
                selected.name,

            observations,

            groups,

            motionRecords,

            generatedAt:
                now()
        };

        window[
            RESULT_NAME
        ] = result;

        /*
         Compatibility aliases for later bridges.
        */

        window
            .RainGuardRecoveredTemporalMotionSourceV39 =
            canonicalSource;

        window
            .RainGuardRecoveredTemporalMotionRecordsV39 =
            motionRecords;

        window
            .RainGuardMotionReadyTemporalSequencesV39 =
            canonicalSource.identities.filter(
                x => x.movementRecovered
            );

        result.persistedToLocalStorage =
            persist(result);

        console.group(
            "[RainGuard Phase " +
                PHASE +
                "]"
        );

        console.log(
            "Live Evidence Temporal Coordinate Extraction & Motion Recovery result:",
            result
        );

        console.table(
            canonicalSource.identities
                .slice(0, 30)
                .map(x => ({
                    identity:
                        x.identity,

                    observations:
                        x.observationCount,

                    coordinates:
                        x.uniqueCoordinateCount,

                    motion:
                        x.movementRecovered,

                    motionRecords:
                        x.motionRecordCount
                }))
        );

        if (motionRecords.length) {
            console.table(
                motionRecords
                    .slice(0, 30)
                    .map(m => ({
                        identity:
                            m.identity,

                        distanceM:
                            Number(
                                m.distanceMeters
                                    .toFixed(2)
                            ),

                        dtSec:
                            Number(
                                m.delta.timeSeconds
                                    .toFixed(1)
                            ),

                        speedKmh:
                            Number(
                                m.speedKmh
                                    .toFixed(2)
                            ),

                        bearing:
                            Number(
                                m.bearingDegrees
                                    .toFixed(1)
                            )
                    }))
            );
        }

        console.groupEnd();

        return result;
    }

    /* ------------------------------------------------------------- */
    /* Diagnostic                                                    */
    /* ------------------------------------------------------------- */

    function diagnose() {
        const discovery =
            discoverSource();

        const report =
            discovery.candidates.map(
                source => {

                    const dedup =
                        deduplicateObservations(
                            source.observations
                        );

                    const groups =
                        groupByIdentity(
                            dedup
                        );

                    const motions =
                        recoverAllMotion(
                            groups
                        );

                    return {
                        source:
                            source.name,

                        rawObservations:
                            source.observations
                                .length,

                        observations:
                            dedup.length,

                        identities:
                            groups.size,

                        multiPointIdentities:
                            Array.from(
                                groups.values()
                            ).filter(
                                x =>
                                    x.length >= 2
                            ).length,

                        motionRecords:
                            motions.length,

                        motionIdentities:
                            new Set(
                                motions.map(
                                    x =>
                                        x.identity
                                )
                            ).size
                    };
                }
            );

        console.table(report);

        return report;
    }

    /* ------------------------------------------------------------- */
    /* Reset                                                         */
    /* ------------------------------------------------------------- */

    function reset() {
        try {
            delete window[
                RESULT_NAME
            ];

            delete window[
                CANONICAL_SOURCE_NAME
            ];

            delete window[
                MOTION_RECORDS_NAME
            ];

            delete window[
                MEMORY_NAME
            ];

            delete window
                .RainGuardRecoveredTemporalMotionSourceV39;

            delete window
                .RainGuardRecoveredTemporalMotionRecordsV39;

            delete window
                .RainGuardMotionReadyTemporalSequencesV39;

            localStorage.removeItem(
                "RainGuard:39A15F6N4B1B3B:H3B2C:result"
            );
        } catch (_) {}

        return true;
    }

    /* ------------------------------------------------------------- */
    /* Public API                                                     */
    /* ------------------------------------------------------------- */

    const API = {
        phase: PHASE,
        version: VERSION,
        build: BUILD,
        run,
        diagnose,
        reset,
        discoverSource
    };

    window
        .RainGuardN4B1B3BH3B2CBridgeV39 =
        API;

    window
        .runRainGuardN4B1B3BH3B2CLiveEvidenceTemporalCoordinateExtractionMotionRecoveryBridge =
        run;

    window
        .diagnoseRainGuardN4B1B3BH3B2CLiveEvidenceTemporalCoordinateExtractionMotionRecoveryBridge =
        diagnose;

    window
        .resetRainGuardN4B1B3BH3B2CLiveEvidenceTemporalCoordinateExtractionMotionRecoveryBridge =
        reset;

    window
        .__RainGuardN4B1B3BH3B2CInstalled =
        true;

})();
