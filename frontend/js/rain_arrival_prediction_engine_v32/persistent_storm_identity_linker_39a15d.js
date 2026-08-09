/*
============================================================
RainGuard AI V32 / Phase 39A-15D
Persistent Storm Identity Linker
Version: 39A.15D.0
Build: rainguard-v39-persistent-storm-identity-linker
============================================================

Purpose:
- Read accumulated storm observations from Phase 39A-15C.
- Group observations that belong to the same physical storm.
- Preserve a persistent storm identity across multiple cycles.
- Use location + time + source IDs + track IDs for matching.
- Publish persistent identities for Phase 39A-15B / 39A-15A.
- Avoid modifying legacy RainArrival modules directly.

Expected upstream:
- Persistent Storm Observation Accumulator 39A-15C
- RainArrivalLiveTrackHistory
- RainArrivalTrackHistoryV32

Expected downstream:
- Cross History Motion Reconstruction 39A-15B
- Storm Motion Vector Recovery 39A-15
- Matched Storm -> Arrival ETA Adapter 39A-14
============================================================
*/

(function installPersistentStormIdentityLinker(global) {
    "use strict";

    const MODULE_NAME =
        "PersistentStormIdentityLinker";

    const PHASE =
        "39A-15D";

    const VERSION =
        "39A.15D.0";

    const BUILD =
        "rainguard-v39-persistent-storm-identity-linker";

    const DEFAULT_CONFIG = {
        autoStart: true,

        intervalMs: 15000,

        maxObservationAgeMs:
            6 * 60 * 60 * 1000,

        maximumIdentityAgeMs:
            12 * 60 * 60 * 1000,

        maxSpatialDistanceKm:
            45,

        maxTemporalDistanceMs:
            45 * 60 * 1000,

        strongSpatialDistanceKm:
            18,

        minimumMatchScore:
            45,

        strongMatchScore:
            70,

        idPrefix:
            "RG-STORM",

        maxStoredIdentities:
            5000
    };

    function now() {
        return Date.now();
    }

    function isObject(value) {
        return (
            value !== null &&
            typeof value === "object" &&
            !Array.isArray(value)
        );
    }

    function safeNumber(value) {
        const n =
            Number(value);

        return Number.isFinite(n)
            ? n
            : null;
    }

    function safeString(value) {
        if (
            value === null ||
            value === undefined
        ) {
            return "";
        }

        return String(value)
            .trim();
    }

    function cloneValue(value) {
        try {
            return structuredClone(
                value
            );
        } catch (_) {
            try {
                return JSON.parse(
                    JSON.stringify(
                        value
                    )
                );
            } catch (_) {
                return value;
            }
        }
    }

    function normalizeTimestamp(value) {
        if (
            value === null ||
            value === undefined
        ) {
            return null;
        }

        if (
            typeof value ===
            "number"
        ) {
            if (
                Number.isFinite(
                    value
                )
            ) {
                return value < 1e12
                    ? value * 1000
                    : value;
            }

            return null;
        }

        const direct =
            Number(value);

        if (
            Number.isFinite(
                direct
            )
        ) {
            return direct < 1e12
                ? direct * 1000
                : direct;
        }

        const parsed =
            Date.parse(value);

        return Number.isFinite(
            parsed
        )
            ? parsed
            : null;
    }

    function firstFinite(
        ...values
    ) {
        for (
            const value
            of values
        ) {
            const n =
                safeNumber(value);

            if (
                n !== null
            ) {
                return n;
            }
        }

        return null;
    }

    function firstString(
        ...values
    ) {
        for (
            const value
            of values
        ) {
            const s =
                safeString(value);

            if (s) {
                return s;
            }
        }

        return "";
    }

    function extractLatitude(
        record
    ) {
        if (
            !record ||
            typeof record !==
                "object"
        ) {
            return null;
        }

        return firstFinite(
            record.latitude,
            record.lat,
            record.coordinate
                ?.latitude,
            record.coordinate
                ?.lat,
            record.coordinates
                ?.latitude,
            record.coordinates
                ?.lat,
            record.position
                ?.latitude,
            record.position
                ?.lat,
            record.location
                ?.latitude,
            record.location
                ?.lat,
            Array.isArray(
                record.coordinates
            )
                ? record
                    .coordinates[1]
                : null
        );
    }

    function extractLongitude(
        record
    ) {
        if (
            !record ||
            typeof record !==
                "object"
        ) {
            return null;
        }

        return firstFinite(
            record.longitude,
            record.lon,
            record.lng,
            record.coordinate
                ?.longitude,
            record.coordinate
                ?.lon,
            record.coordinate
                ?.lng,
            record.coordinates
                ?.longitude,
            record.coordinates
                ?.lon,
            record.coordinates
                ?.lng,
            record.position
                ?.longitude,
            record.position
                ?.lon,
            record.position
                ?.lng,
            record.location
                ?.longitude,
            record.location
                ?.lon,
            record.location
                ?.lng,
            Array.isArray(
                record.coordinates
            )
                ? record
                    .coordinates[0]
                : null
        );
    }

    function extractTimestamp(
        record
    ) {
        if (
            !record ||
            typeof record !==
                "object"
        ) {
            return null;
        }

        const candidates = [
            record.observedAt,
            record.timestamp,
            record.time,
            record.generatedAt,
            record.updatedAt,
            record.createdAt,
            record.capturedAt,
            record.detectedAt,
            record.frameTime,
            record.frameTimestamp,
            record.datetime,
            record.dateTime
        ];

        for (
            const value
            of candidates
        ) {
            const timestamp =
                normalizeTimestamp(
                    value
                );

            if (
                timestamp !==
                null
            ) {
                return timestamp;
            }
        }

        return null;
    }

    function extractTrackId(
        record
    ) {
        return firstString(
            record?.trackId,
            record?.trackID,
            record?.stormTrackId,
            record?.stormTrackID,
            record?.cellId,
            record?.cellID,
            record?.stormId,
            record?.stormID,
            record?.entityId,
            record?.entityID,
            record?.id
        );
    }

    function extractSource(
        record
    ) {
        return firstString(
            record?.source,
            record?.sourceName,
            record?.provider,
            record?.adapter,
            record?.origin,
            record?.dataset,
            record?.module
        );
    }

    function haversineKm(
        lat1,
        lon1,
        lat2,
        lon2
    ) {
        if (
            [
                lat1,
                lon1,
                lat2,
                lon2
            ].some(
                value =>
                    !Number
                        .isFinite(
                            value
                        )
            )
        ) {
            return null;
        }

        const R =
            6371;

        const toRad =
            degrees =>
                degrees *
                Math.PI /
                180;

        const dLat =
            toRad(
                lat2 -
                lat1
            );

        const dLon =
            toRad(
                lon2 -
                lon1
            );

        const a =
            Math.sin(
                dLat / 2
            ) ** 2 +
            Math.cos(
                toRad(lat1)
            ) *
            Math.cos(
                toRad(lat2)
            ) *
            Math.sin(
                dLon / 2
            ) ** 2;

        const c =
            2 *
            Math.atan2(
                Math.sqrt(a),
                Math.sqrt(
                    1 - a
                )
            );

        return R * c;
    }

    function flattenRecords(
        value,
        output,
        seen,
        depth
    ) {
        if (
            value === null ||
            value === undefined
        ) {
            return;
        }

        if (
            depth > 5
        ) {
            return;
        }

        if (
            typeof value !==
            "object"
        ) {
            return;
        }

        if (
            seen.has(value)
        ) {
            return;
        }

        seen.add(value);

        if (
            Array.isArray(value)
        ) {
            for (
                const item
                of value
            ) {
                flattenRecords(
                    item,
                    output,
                    seen,
                    depth + 1
                );
            }

            return;
        }

        const lat =
            extractLatitude(
                value
            );

        const lon =
            extractLongitude(
                value
            );

        const trackId =
            extractTrackId(
                value
            );

        const timestamp =
            extractTimestamp(
                value
            );

        if (
            (
                lat !== null &&
                lon !== null
            ) ||
            trackId ||
            timestamp !== null
        ) {
            output.push(value);
        }

        const commonKeys = [
            "history",
            "records",
            "observations",
            "items",
            "entities",
            "tracks",
            "storms",
            "data",
            "result",
            "results",
            "values"
        ];

        for (
            const key
            of commonKeys
        ) {
            if (
                value[key] !==
                undefined
            ) {
                flattenRecords(
                    value[key],
                    output,
                    seen,
                    depth + 1
                );
            }
        }
    }

    function normalizeObservation(
        record,
        sourceLabel
    ) {
        if (
            !record ||
            typeof record !==
                "object"
        ) {
            return null;
        }

        const latitude =
            extractLatitude(
                record
            );

        const longitude =
            extractLongitude(
                record
            );

        const observedAt =
            extractTimestamp(
                record
            ) ||
            now();

        const trackId =
            extractTrackId(
                record
            );

        const source =
            extractSource(
                record
            ) ||
            sourceLabel ||
            "UNKNOWN";

        if (
            latitude === null ||
            longitude === null
        ) {
            return null;
        }

        return {
            trackId:
                trackId ||
                null,

            source,

            latitude,

            longitude,

            observedAt,

            intensity:
                firstFinite(
                    record.intensity,
                    record.reflectivity,
                    record.dbz,
                    record.strength,
                    record.score
                ),

            confidence:
                firstFinite(
                    record.confidence,
                    record.probability,
                    record.certainty
                ),

            original:
                record
        };
    }

    class PersistentStormIdentityLinker {
        constructor(config) {
            this.config = {
                ...DEFAULT_CONFIG,
                ...(config || {})
            };

            this.phase =
                PHASE;

            this.version =
                VERSION;

            this.build =
                BUILD;

            this.running =
                false;

            this.runInProgress =
                false;

            this.timer =
                null;

            this.identityCounter =
                0;

            this.identities =
                new Map();

            this.aliasIndex =
                new Map();

            this.lastResult =
                null;

            this.lastError =
                null;

            this.createdAt =
                now();

            this.updatedAt =
                this.createdAt;

            this.statistics = {
                runs: 0,
                skippedRuns: 0,
                sourceRecords: 0,
                normalizedRecords: 0,
                identitiesCreated: 0,
                identitiesUpdated: 0,
                aliasesLinked: 0,
                rejectedRecords: 0,
                expiredIdentities: 0,
                failures: 0
            };
        }

        createPersistentId() {
            this.identityCounter +=
                1;

            return [
                this.config
                    .idPrefix,
                now()
                    .toString(36),
                this.identityCounter
                    .toString(36)
            ].join("-");
        }

        getAccumulator() {
            return (
                global
                    .RainGuardPersistentStormObservationAccumulatorV39 ||
                global
                    .RainGuardPersistentStormObservationAccumulator ||
                global
                    .PersistentStormObservationAccumulatorV39 ||
                null
            );
        }

        readAccumulatorRecords() {
            const accumulator =
                this.getAccumulator();

            const sources = [];

            if (
                accumulator
            ) {
                const methods = [
                    "getAll",
                    "getObservations",
                    "getHistory",
                    "getRecords",
                    "export"
                ];

                for (
                    const method
                    of methods
                ) {
                    try {
                        if (
                            typeof accumulator[
                                method
                            ] ===
                            "function"
                        ) {
                            const value =
                                accumulator[
                                    method
                                ]();

                            if (
                                value &&
                                typeof value
                                    .then ===
                                    "function"
                            ) {
                                continue;
                            }

                            sources.push({
                                name:
                                    `Accumulator.${method}`,
                                value
                            });
                        }
                    } catch (_) {
                        // ignore individual source failure
                    }
                }

                for (
                    const key
                    of [
                        "observations",
                        "records",
                        "history",
                        "store",
                        "identities"
                    ]
                ) {
                    if (
                        accumulator[
                            key
                        ] !==
                        undefined
                    ) {
                        sources.push({
                            name:
                                `Accumulator.${key}`,
                            value:
                                accumulator[
                                    key
                                ]
                        });
                    }
                }
            }

            const globals = [
                "RainArrivalLiveTrackHistory",
                "RainArrivalTrackHistoryV32",
                "RainArrivalTrackHistoryStoreV32",
                "RainArrivalTrackStoreV32"
            ];

            for (
                const name
                of globals
            ) {
                if (
                    global[name] !==
                    undefined
                ) {
                    sources.push({
                        name,
                        value:
                            global[
                                name
                            ]
                    });
                }
            }

            return sources;
        }

        collectObservations() {
            const sources =
                this.readAccumulatorRecords();

            const rawRecords =
                [];

            const sourceReports =
                [];

            for (
                const source
                of sources
            ) {
                const records =
                    [];

                try {
                    flattenRecords(
                        source.value,
                        records,
                        new WeakSet(),
                        0
                    );
                } catch (_) {
                    // ignored
                }

                sourceReports.push({
                    source:
                        source.name,
                    rawCount:
                        records.length
                });

                for (
                    const record
                    of records
                ) {
                    rawRecords.push({
                        source:
                            source.name,
                        record
                    });
                }
            }

            const cutoff =
                now() -
                this.config
                    .maxObservationAgeMs;

            const dedupe =
                new Map();

            for (
                const item
                of rawRecords
            ) {
                const normalized =
                    normalizeObservation(
                        item.record,
                        item.source
                    );

                if (
                    !normalized
                ) {
                    this.statistics
                        .rejectedRecords +=
                        1;

                    continue;
                }

                if (
                    normalized
                        .observedAt <
                    cutoff
                ) {
                    continue;
                }

                const signature =
                    [
                        normalized
                            .trackId ||
                            "NOID",

                        normalized
                            .latitude
                            .toFixed(4),

                        normalized
                            .longitude
                            .toFixed(4),

                        Math.floor(
                            normalized
                                .observedAt /
                            5000
                        )
                    ].join("|");

                if (
                    !dedupe.has(
                        signature
                    )
                ) {
                    dedupe.set(
                        signature,
                        normalized
                    );
                }
            }

            const observations =
                Array.from(
                    dedupe.values()
                ).sort(
                    (
                        a,
                        b
                    ) =>
                        a.observedAt -
                        b.observedAt
                );

            return {
                sources:
                    sourceReports,

                rawCount:
                    rawRecords.length,

                normalizedCount:
                    observations.length,

                observations
            };
        }

        scoreIdentity(
            identity,
            observation
        ) {
            if (
                !identity ||
                !observation
            ) {
                return {
                    score: 0
                };
            }

            const last =
                identity
                    .lastObservation;

            if (
                !last
            ) {
                return {
                    score: 0
                };
            }

            let score = 0;

            const reasons = [];

            const timeDelta =
                Math.abs(
                    observation
                        .observedAt -
                    last.observedAt
                );

            if (
                timeDelta >
                this.config
                    .maxTemporalDistanceMs
            ) {
                return {
                    score: 0,
                    rejected:
                        "TIME_DISTANCE"
                };
            }

            if (
                observation
                    .trackId &&
                identity.aliases
                    .has(
                        observation
                            .trackId
                    )
            ) {
                score += 65;

                reasons.push(
                    "TRACK_ID_ALIAS"
                );
            }

            const distanceKm =
                haversineKm(
                    last.latitude,
                    last.longitude,
                    observation
                        .latitude,
                    observation
                        .longitude
                );

            if (
                distanceKm !== null
            ) {
                if (
                    distanceKm >
                    this.config
                        .maxSpatialDistanceKm
                ) {
                    return {
                        score: 0,
                        distanceKm,
                        rejected:
                            "SPATIAL_DISTANCE"
                    };
                }

                if (
                    distanceKm <=
                    this.config
                        .strongSpatialDistanceKm
                ) {
                    score += 35;

                    reasons.push(
                        "STRONG_SPATIAL_MATCH"
                    );
                } else {
                    const ratio =
                        1 -
                        (
                            distanceKm -
                            this.config
                                .strongSpatialDistanceKm
                        ) /
                        (
                            this.config
                                .maxSpatialDistanceKm -
                            this.config
                                .strongSpatialDistanceKm
                        );

                    score +=
                        Math.max(
                            5,
                            Math.round(
                                25 *
                                ratio
                            )
                        );

                    reasons.push(
                        "SPATIAL_MATCH"
                    );
                }
            }

            if (
                timeDelta <=
                10 * 60 * 1000
            ) {
                score += 20;

                reasons.push(
                    "STRONG_TEMPORAL_MATCH"
                );
            } else if (
                timeDelta <=
                30 * 60 * 1000
            ) {
                score += 10;

                reasons.push(
                    "TEMPORAL_MATCH"
                );
            }

            if (
                observation
                    .source &&
                identity.sources
                    .has(
                        observation
                            .source
                    )
            ) {
                score += 5;

                reasons.push(
                    "SOURCE_CONTINUITY"
                );
            }

            return {
                score,
                distanceKm,
                timeDelta,
                reasons
            };
        }

        findBestIdentity(
            observation
        ) {
            let best =
                null;

            for (
                const identity
                of this.identities
                    .values()
            ) {
                const result =
                    this.scoreIdentity(
                        identity,
                        observation
                    );

                if (
                    result.score <
                    this.config
                        .minimumMatchScore
                ) {
                    continue;
                }

                if (
                    !best ||
                    result.score >
                    best.score
                ) {
                    best = {
                        identity,
                        ...result
                    };
                }
            }

            return best;
        }

        createIdentity(
            observation
        ) {
            const persistentId =
                this.createPersistentId();

            const aliases =
                new Set();

            if (
                observation.trackId
            ) {
                aliases.add(
                    observation
                        .trackId
                );
            }

            const sources =
                new Set([
                    observation
                        .source
                ]);

            const identity = {
                persistentId,

                aliases,

                sources,

                observationCount:
                    1,

                observations: [
                    cloneValue(
                        observation
                    )
                ],

                firstSeenAt:
                    observation
                        .observedAt,

                lastSeenAt:
                    observation
                        .observedAt,

                firstObservation:
                    cloneValue(
                        observation
                    ),

                lastObservation:
                    cloneValue(
                        observation
                    ),

                confidence:
                    1,

                state:
                    "ACTIVE",

                createdAt:
                    now(),

                updatedAt:
                    now()
            };

            this.identities.set(
                persistentId,
                identity
            );

            if (
                observation.trackId
            ) {
                this.aliasIndex.set(
                    observation
                        .trackId,
                    persistentId
                );
            }

            this.statistics
                .identitiesCreated +=
                1;

            return identity;
        }

        updateIdentity(
            identity,
            observation,
            match
        ) {
            identity
                .observationCount +=
                1;

            identity
                .lastSeenAt =
                observation
                    .observedAt;

            identity
                .lastObservation =
                cloneValue(
                    observation
                );

            identity
                .observations
                .push(
                    cloneValue(
                        observation
                    )
                );

            if (
                identity
                    .observations
                    .length >
                100
            ) {
                identity
                    .observations =
                    identity
                        .observations
                        .slice(-100);
            }

            identity
                .sources
                .add(
                    observation
                        .source
                );

            if (
                observation
                    .trackId &&
                !identity
                    .aliases
                    .has(
                        observation
                            .trackId
                    )
            ) {
                identity
                    .aliases
                    .add(
                        observation
                            .trackId
                    );

                this.aliasIndex
                    .set(
                        observation
                            .trackId,
                        identity
                            .persistentId
                    );

                this.statistics
                    .aliasesLinked +=
                    1;
            }

            identity.confidence =
                Math.min(
                    1,
                    (
                        identity
                            .confidence *
                        0.75
                    ) +
                    (
                        (
                            match
                                ?.score ||
                            50
                        ) /
                        100 *
                        0.25
                    )
                );

            identity.state =
                "ACTIVE";

            identity.updatedAt =
                now();

            this.statistics
                .identitiesUpdated +=
                1;

            return identity;
        }

        resolveObservation(
            observation
        ) {
            if (
                observation
                    .trackId
            ) {
                const persistentId =
                    this.aliasIndex
                        .get(
                            observation
                                .trackId
                        );

                if (
                    persistentId &&
                    this.identities
                        .has(
                            persistentId
                        )
                ) {
                    const identity =
                        this.identities
                            .get(
                                persistentId
                            );

                    return this
                        .updateIdentity(
                            identity,
                            observation,
                            {
                                score:
                                    100,
                                reasons: [
                                    "DIRECT_ALIAS"
                                ]
                            }
                        );
                }
            }

            const match =
                this.findBestIdentity(
                    observation
                );

            if (
                match
            ) {
                return this
                    .updateIdentity(
                        match.identity,
                        observation,
                        match
                    );
            }

            return this
                .createIdentity(
                    observation
                );
        }

        expireOldIdentities() {
            const cutoff =
                now() -
                this.config
                    .maximumIdentityAgeMs;

            let expiredCount =
                0;

            for (
                const [
                    persistentId,
                    identity
                ]
                of this.identities
                    .entries()
            ) {
                if (
                    identity.lastSeenAt <
                    cutoff
                ) {
                    this.identities
                        .delete(
                            persistentId
                        );

                    for (
                        const alias
                        of identity
                            .aliases
                    ) {
                        if (
                            this.aliasIndex
                                .get(
                                    alias
                                ) ===
                            persistentId
                        ) {
                            this.aliasIndex
                                .delete(
                                    alias
                                );
                        }
                    }

                    expiredCount +=
                        1;
                }
            }

            this.statistics
                .expiredIdentities +=
                expiredCount;

            return expiredCount;
        }

        enforceStorageLimit() {
            if (
                this.identities.size <=
                this.config
                    .maxStoredIdentities
            ) {
                return;
            }

            const sorted =
                Array.from(
                    this.identities
                        .values()
                ).sort(
                    (
                        a,
                        b
                    ) =>
                        a.lastSeenAt -
                        b.lastSeenAt
                );

            const removeCount =
                this.identities.size -
                this.config
                    .maxStoredIdentities;

            for (
                let i = 0;
                i < removeCount;
                i += 1
            ) {
                const identity =
                    sorted[i];

                if (
                    !identity
                ) {
                    continue;
                }

                this.identities
                    .delete(
                        identity
                            .persistentId
                    );

                for (
                    const alias
                    of identity
                        .aliases
                ) {
                    this.aliasIndex
                        .delete(
                            alias
                        );
                }
            }
        }

        serializeIdentity(
            identity
        ) {
            return {
                persistentId:
                    identity
                        .persistentId,

                aliases:
                    Array.from(
                        identity
                            .aliases
                    ),

                sources:
                    Array.from(
                        identity
                            .sources
                    ),

                observationCount:
                    identity
                        .observationCount,

                firstSeenAt:
                    identity
                        .firstSeenAt,

                lastSeenAt:
                    identity
                        .lastSeenAt,

                firstObservation:
                    cloneValue(
                        identity
                            .firstObservation
                    ),

                lastObservation:
                    cloneValue(
                        identity
                            .lastObservation
                    ),

                observations:
                    cloneValue(
                        identity
                            .observations
                    ),

                confidence:
                    identity
                        .confidence,

                state:
                    identity
                        .state,

                createdAt:
                    identity
                        .createdAt,

                updatedAt:
                    identity
                        .updatedAt
            };
        }

        publish() {
            const identities =
                Array.from(
                    this.identities
                        .values()
                ).map(
                    identity =>
                        this.serializeIdentity(
                            identity
                        )
                );

            global
                .RainGuardPersistentStormIdentitiesV39 =
                identities;

            global
                .RainGuardPersistentStormIdentityMapV39 =
                Object.fromEntries(
                    identities.map(
                        identity => [
                            identity
                                .persistentId,
                            identity
                        ]
                    )
                );

            return identities;
        }

        async run() {
            if (
                this.runInProgress
            ) {
                this.statistics
                    .skippedRuns +=
                    1;

                return {
                    success:
                        true,

                    phase:
                        PHASE,

                    version:
                        VERSION,

                    status:
                        "RUN_ALREADY_IN_PROGRESS",

                    skipped:
                        true
                };
            }

            this.runInProgress =
                true;

            this.statistics
                .runs +=
                1;

            try {
                const collection =
                    this.collectObservations();

                this.statistics
                    .sourceRecords +=
                    collection
                        .rawCount;

                this.statistics
                    .normalizedRecords +=
                    collection
                        .normalizedCount;

                for (
                    const observation
                    of collection
                        .observations
                ) {
                    this.resolveObservation(
                        observation
                    );
                }

                const expiredCount =
                    this.expireOldIdentities();

                this.enforceStorageLimit();

                const identities =
                    this.publish();

                const multiplePointIdentities =
                    identities.filter(
                        identity =>
                            identity
                                .observationCount >
                            1
                    );

                const status =
                    identities.length ===
                    0
                        ? "NO_PERSISTENT_STORM_IDENTITIES"
                        : multiplePointIdentities
                            .length === 0
                            ? "PERSISTENT_IDENTITIES_ACCUMULATING"
                            : "PERSISTENT_STORM_IDENTITIES_READY";

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

                    sourceRecordCount:
                        collection
                            .rawCount,

                    normalizedRecordCount:
                        collection
                            .normalizedCount,

                    identityCount:
                        identities.length,

                    identitiesWithMultiplePoints:
                        multiplePointIdentities
                            .length,

                    expiredCount,

                    identities,

                    sourceReports:
                        collection
                            .sources,

                    generatedAt:
                        now()
                };

                this.lastResult =
                    result;

                this.lastError =
                    null;

                this.updatedAt =
                    now();

                return result;

            } catch (error) {
                this.statistics
                    .failures +=
                    1;

                this.lastError = {
                    message:
                        error
                            ?.message ||
                        String(error),

                    stack:
                        error
                            ?.stack ||
                        null,

                    at:
                        now()
                };

                const result = {
                    success:
                        false,

                    phase:
                        PHASE,

                    version:
                        VERSION,

                    build:
                        BUILD,

                    status:
                        "PERSISTENT_STORM_IDENTITY_LINKER_FAILED",

                    error:
                        cloneValue(
                            this.lastError
                        ),

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

        getAll() {
            return Array.from(
                this.identities
                    .values()
            ).map(
                identity =>
                    this.serializeIdentity(
                        identity
                    )
            );
        }

        getByPersistentId(
            persistentId
        ) {
            const identity =
                this.identities
                    .get(
                        persistentId
                    );

            return identity
                ? this
                    .serializeIdentity(
                        identity
                    )
                : null;
        }

        resolveAlias(
            alias
        ) {
            const persistentId =
                this.aliasIndex
                    .get(
                        alias
                    );

            return persistentId ||
                null;
        }

        clear() {
            this.identities
                .clear();

            this.aliasIndex
                .clear();

            global
                .RainGuardPersistentStormIdentitiesV39 =
                [];

            global
                .RainGuardPersistentStormIdentityMapV39 =
                {};

            return {
                success:
                    true,

                phase:
                    PHASE,

                status:
                    "PERSISTENT_STORM_IDENTITIES_CLEARED"
            };
        }

        start() {
            if (
                this.running
            ) {
                return {
                    success:
                        true,

                    running:
                        true,

                    alreadyRunning:
                        true
                };
            }

            this.running =
                true;

            this.run();

            this.timer =
                global.setInterval(
                    () => {
                        this.run();
                    },
                    this.config
                        .intervalMs
                );

            return {
                success:
                    true,

                phase:
                    PHASE,

                running:
                    true,

                intervalMs:
                    this.config
                        .intervalMs
            };
        }

        stop() {
            if (
                this.timer
            ) {
                global
                    .clearInterval(
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

                phase:
                    PHASE,

                running:
                    false
            };
        }

        getDiagnostics() {
            const identities =
                this.getAll();

            return {
                phase:
                    PHASE,

                version:
                    VERSION,

                build:
                    BUILD,

                installed:
                    true,

                running:
                    this.running,

                runInProgress:
                    this.runInProgress,

                identityCount:
                    identities.length,

                identitiesWithMultiplePoints:
                    identities.filter(
                        identity =>
                            identity
                                .observationCount >
                            1
                    ).length,

                aliasCount:
                    this.aliasIndex
                        .size,

                accumulatorAvailable:
                    Boolean(
                        this.getAccumulator()
                    ),

                lastResult:
                    cloneValue(
                        this.lastResult
                    ),

                lastError:
                    cloneValue(
                        this.lastError
                    ),

                statistics:
                    cloneValue(
                        this.statistics
                    ),

                createdAt:
                    this.createdAt,

                updatedAt:
                    this.updatedAt
            };
        }

        diagnose() {
            const diagnostics =
                this.getDiagnostics();

            console.log(
                "[RainGuard Phase 39A-15D] Persistent Storm Identity Linker",
                diagnostics
            );

            return diagnostics;
        }
    }

    const linker =
        new PersistentStormIdentityLinker();

    global
        .RainGuardPersistentStormIdentityLinkerV39 =
        linker;

    global
        .RainGuardPersistentStormIdentityLinker39A15D =
        linker;

    global
        .runRainGuardPersistentStormIdentityLinker =
        () =>
            linker.run();

    global
        .diagnoseRainGuardPersistentStormIdentityLinker =
        () =>
            linker.diagnose();

    global
        .getRainGuardPersistentStormIdentities =
        () =>
            linker.getAll();

    global
        .getRainGuardPersistentStormIdentity =
        persistentId =>
            linker.getByPersistentId(
                persistentId
            );

    global
        .resolveRainGuardPersistentStormAlias =
        alias =>
            linker.resolveAlias(
                alias
            );

    global
        .clearRainGuardPersistentStormIdentities =
        () =>
            linker.clear();

    global
        .startRainGuardPersistentStormIdentityLinker =
        () =>
            linker.start();

    global
        .stopRainGuardPersistentStormIdentityLinker =
        () =>
            linker.stop();

    global.RainGuardAI =
        global.RainGuardAI ||
        {};

    global
        .RainGuardAI
        .V39 =
        global
            .RainGuardAI
            .V39 ||
        {};

    global
        .RainGuardAI
        .V39
        .persistentStormIdentityLinker =
        linker;

    if (
        linker.config
            .autoStart
    ) {
        linker.start();
    }

    console.log(
        "[RainGuard AI] Phase 39A-15D — Persistent Storm Identity Linker READY",
        {
            phase:
                PHASE,

            version:
                VERSION,

            build:
                BUILD
        }
    );

})(
    typeof globalThis !==
        "undefined"
        ? globalThis
        : window
);
