/*
===========================================================
 RainGuard AI V32
 Phase 38M-18F — Motion Vector Repository
 File: motion_vector_repository.js
 Version: 32.38M.18F

 Responsibilities:
 - Persist motion vectors built by Motion Vector History Engine.
 - Deduplicate vectors by vectorId.
 - Organize vectors by stable trackId.
 - Maintain latest vector and track summaries.
 - Provide bounded in-memory storage and cleanup.
 - Publish repository state for statistics, renderer and ETA engines.
===========================================================
*/

(function (global) {
    "use strict";

    const MODULE_NAME =
        "motionVectorRepository";

    const VERSION =
        "32.38M.18F";

    const BUILD_ID =
        "rainguard-v32-phase38m18f-motion-vector-repository";

    const DEFAULT_CONFIG =
        Object.freeze({
            autoStart:
                true,

            syncIntervalMs:
                5000,

            maximumTracks:
                1500,

            maximumVectorsPerTrack:
                240,

            maximumVectorAgeMs:
                8 *
                60 *
                60 *
                1000,

            retainEmptyTracks:
                false,

            debug:
                true
        });

    const now =
        () => Date.now();

    function cloneValue(value) {
        if (
            value === null ||
            value === undefined
        ) {
            return value;
        }

        if (
            typeof structuredClone ===
            "function"
        ) {
            try {
                return structuredClone(value);
            } catch (_) {}
        }

        try {
            return JSON.parse(
                JSON.stringify(value)
            );
        } catch (_) {
            return value;
        }
    }

    function toFiniteNumber(
        value,
        fallback = null
    ) {
        const number =
            Number(value);

        return Number.isFinite(number)
            ? number
            : fallback;
    }

    function normalizeText(value) {
        if (
            value === null ||
            value === undefined
        ) {
            return "";
        }

        return String(value).trim();
    }

    function collectionToArray(value) {
        if (!value) {
            return [];
        }

        if (Array.isArray(value)) {
            return value;
        }

        if (
            value instanceof Map ||
            value instanceof Set
        ) {
            return Array.from(
                value.values()
            );
        }

        if (
            typeof value.values ===
            "function"
        ) {
            try {
                return Array.from(
                    value.values()
                );
            } catch (_) {}
        }

        return typeof value ===
            "object"
            ? Object.values(value)
            : [];
    }

    class MotionVectorRepository {

        constructor(config = {}) {
            this.version =
                VERSION;

            this.buildId =
                BUILD_ID;

            this.config = {
                ...DEFAULT_CONFIG,
                ...(config || {})
            };

            this.trackMap =
                new Map();

            this.vectorIndex =
                new Map();

            this.latestVectorMap =
                new Map();

            this.running =
                false;

            this.timer =
                null;

            this.latestResult =
                null;

            this.lastError =
                null;

            this.statistics = {
                syncs:
                    0,

                inputTracks:
                    0,

                inputVectors:
                    0,

                insertedVectors:
                    0,

                updatedVectors:
                    0,

                duplicateVectors:
                    0,

                invalidVectors:
                    0,

                expiredVectors:
                    0,

                removedTracks:
                    0,

                failures:
                    0
            };
        }

        normalizeVector(
            vector,
            fallbackTrackId = null
        ) {
            if (
                !vector ||
                typeof vector !==
                    "object"
            ) {
                this.statistics
                    .invalidVectors +=
                    1;

                return null;
            }

            const trackId =
                normalizeText(
                    vector.trackId ??
                    fallbackTrackId
                );

            if (!trackId) {
                this.statistics
                    .invalidVectors +=
                    1;

                return null;
            }

            const startTimestamp =
                toFiniteNumber(
                    vector.startTimestamp,
                    null
                );

            const endTimestamp =
                toFiniteNumber(
                    vector.endTimestamp,
                    null
                );

            if (
                startTimestamp === null ||
                endTimestamp === null ||
                endTimestamp <
                    startTimestamp
            ) {
                this.statistics
                    .invalidVectors +=
                    1;

                return null;
            }

            const vectorId =
                normalizeText(
                    vector.vectorId
                ) ||
                [
                    trackId,
                    startTimestamp,
                    endTimestamp,
                    toFiniteNumber(
                        vector
                            .endCoordinate
                            ?.latitude,
                        0
                    )
                    .toFixed(6),
                    toFiniteNumber(
                        vector
                            .endCoordinate
                            ?.longitude,
                        0
                    )
                    .toFixed(6)
                ].join("|");

            return {
                ...cloneValue(vector),

                vectorId,

                trackId,

                startTimestamp,

                endTimestamp,

                storedAt:
                    now(),

                repositoryVersion:
                    this.version
            };
        }

        addVector(
            vector,
            fallbackTrackId = null
        ) {
            const normalized =
                this.normalizeVector(
                    vector,
                    fallbackTrackId
                );

            if (!normalized) {
                return {
                    success:
                        false,

                    status:
                        "INVALID_VECTOR"
                };
            }

            const existing =
                this.vectorIndex.get(
                    normalized.vectorId
                );

            if (existing) {
                this.statistics
                    .duplicateVectors +=
                    1;

                const changed =
                    JSON.stringify(existing) !==
                    JSON.stringify(
                        normalized
                    );

                if (changed) {
                    this.vectorIndex.set(
                        normalized.vectorId,
                        normalized
                    );

                    this.statistics
                        .updatedVectors +=
                        1;
                }

                this.rebuildTrack(
                    normalized.trackId
                );

                return {
                    success:
                        true,

                    status:
                        changed
                            ? "VECTOR_UPDATED"
                            : "VECTOR_ALREADY_EXISTS",

                    vector:
                        cloneValue(
                            normalized
                        )
                };
            }

            this.vectorIndex.set(
                normalized.vectorId,
                normalized
            );

            const trackVectors =
                this.trackMap.get(
                    normalized.trackId
                ) || [];

            trackVectors.push(
                normalized
            );

            trackVectors.sort(
                (
                    first,
                    second
                ) =>
                    first.endTimestamp -
                    second.endTimestamp
            );

            if (
                trackVectors.length >
                this.config
                    .maximumVectorsPerTrack
            ) {
                const removed =
                    trackVectors.splice(
                        0,
                        trackVectors.length -
                        this.config
                            .maximumVectorsPerTrack
                    );

                for (
                    const oldVector
                    of removed
                ) {
                    this.vectorIndex
                        .delete(
                            oldVector.vectorId
                        );
                }
            }

            this.trackMap.set(
                normalized.trackId,
                trackVectors
            );

            this.latestVectorMap.set(
                normalized.trackId,
                trackVectors[
                    trackVectors.length -
                    1
                ] || null
            );

            this.statistics
                .insertedVectors +=
                1;

            return {
                success:
                    true,

                status:
                    "VECTOR_INSERTED",

                vector:
                    cloneValue(
                        normalized
                    )
            };
        }

        addVectors(
            vectors,
            fallbackTrackId = null
        ) {
            const results = [];

            for (
                const vector
                of collectionToArray(
                    vectors
                )
            ) {
                results.push(
                    this.addVector(
                        vector,
                        fallbackTrackId
                    )
                );
            }

            return {
                success:
                    true,

                status:
                    "VECTOR_BATCH_PROCESSED",

                inputCount:
                    collectionToArray(
                        vectors
                    ).length,

                insertedCount:
                    results.filter(
                        result =>
                            result.status ===
                            "VECTOR_INSERTED"
                    ).length,

                updatedCount:
                    results.filter(
                        result =>
                            result.status ===
                            "VECTOR_UPDATED"
                    ).length,

                duplicateCount:
                    results.filter(
                        result =>
                            result.status ===
                            "VECTOR_ALREADY_EXISTS"
                    ).length,

                invalidCount:
                    results.filter(
                        result =>
                            result.status ===
                            "INVALID_VECTOR"
                    ).length,

                results
            };
        }

        rebuildTrack(trackId) {
            const vectors =
                Array.from(
                    this.vectorIndex.values()
                )
                .filter(
                    vector =>
                        vector.trackId ===
                        trackId
                )
                .sort(
                    (
                        first,
                        second
                    ) =>
                        first.endTimestamp -
                        second.endTimestamp
                );

            if (
                vectors.length === 0 &&
                !this.config
                    .retainEmptyTracks
            ) {
                this.trackMap.delete(
                    trackId
                );

                this.latestVectorMap
                    .delete(trackId);

                return;
            }

            if (
                vectors.length >
                this.config
                    .maximumVectorsPerTrack
            ) {
                vectors.splice(
                    0,
                    vectors.length -
                    this.config
                        .maximumVectorsPerTrack
                );
            }

            this.trackMap.set(
                trackId,
                vectors
            );

            this.latestVectorMap.set(
                trackId,
                vectors[
                    vectors.length -
                    1
                ] || null
            );
        }

        resolveSourceTracks() {
            const sourceEngine =
                global
                    .RainArrivalMotionVectorHistoryV32;

            const sources = [
                sourceEngine
                    ?.getAllTracks?.(),

                global
                    .RainArrivalMotionVectorTrackList,

                global
                    .RainGuardAI
                    ?.V32
                    ?.motionVectorTrackList
            ];

            for (
                const source
                of sources
            ) {
                const tracks =
                    collectionToArray(
                        source
                    );

                if (
                    tracks.length > 0
                ) {
                    return tracks.slice(
                        0,
                        this.config
                            .maximumTracks
                    );
                }
            }

            const objectSources = [
                sourceEngine
                    ?.getAll?.(),

                global
                    .RainArrivalMotionVectorHistory,

                global
                    .RainGuardAI
                    ?.V32
                    ?.motionVectorHistory
            ];

            for (
                const source
                of objectSources
            ) {
                if (
                    source &&
                    typeof source ===
                        "object"
                ) {
                    return Object.entries(
                        source
                    )
                    .slice(
                        0,
                        this.config
                            .maximumTracks
                    )
                    .map(
                        (
                            [
                                trackId,
                                vectors
                            ]
                        ) => ({
                            trackId,

                            vectors:
                                collectionToArray(
                                    vectors
                                )
                        })
                    );
                }
            }

            return [];
        }

        syncFromHistory() {
            const startedAt =
                now();

            this.statistics
                .syncs += 1;

            try {
                const sourceTracks =
                    this.resolveSourceTracks();

                this.statistics
                    .inputTracks +=
                    sourceTracks.length;

                let inputVectorCount =
                    0;

                let insertedCount =
                    0;

                let updatedCount =
                    0;

                let duplicateCount =
                    0;

                let invalidCount =
                    0;

                for (
                    const track
                    of sourceTracks
                ) {
                    const trackId =
                        normalizeText(
                            track.trackId ??
                            track.stableId
                        );

                    const vectors =
                        collectionToArray(
                            track.vectors ??
                            track.history
                        );

                    inputVectorCount +=
                        vectors.length;

                    const result =
                        this.addVectors(
                            vectors,
                            trackId
                        );

                    insertedCount +=
                        result.insertedCount;

                    updatedCount +=
                        result.updatedCount;

                    duplicateCount +=
                        result.duplicateCount;

                    invalidCount +=
                        result.invalidCount;
                }

                this.statistics
                    .inputVectors +=
                    inputVectorCount;

                this.cleanup(
                    startedAt
                );

                const published =
                    this.publish();

                const result = {
                    success:
                        true,

                    status:
                        "MOTION_VECTOR_REPOSITORY_SYNCED",

                    version:
                        this.version,

                    build:
                        this.buildId,

                    sourceTrackCount:
                        sourceTracks.length,

                    inputVectorCount,

                    insertedCount,

                    updatedCount,

                    duplicateCount,

                    invalidCount,

                    repositoryTrackCount:
                        published
                            .trackList
                            .length,

                    repositoryVectorCount:
                        published
                            .vectorCount,

                    startedAt,

                    completedAt:
                        now(),

                    durationMs:
                        now() -
                        startedAt
                };

                this.latestResult =
                    cloneValue(
                        result
                    );

                global.dispatchEvent?.(
                    new CustomEvent(
                        "rainarrival:motion-vector-repository-synced",
                        {
                            detail:
                                cloneValue(
                                    result
                                )
                        }
                    )
                );

                if (
                    this.config.debug
                ) {
                    console.log(
                        "[RainArrival MotionVectorRepository] Sync result:",
                        result
                    );
                }

                return result;

            } catch (error) {
                this.statistics
                    .failures +=
                    1;

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

                const result = {
                    success:
                        false,

                    status:
                        "MOTION_VECTOR_REPOSITORY_SYNC_FAILED",

                    version:
                        this.version,

                    build:
                        this.buildId,

                    error:
                        cloneValue(
                            this.lastError
                        ),

                    startedAt,

                    completedAt:
                        now(),

                    durationMs:
                        now() -
                        startedAt
                };

                this.latestResult =
                    cloneValue(
                        result
                    );

                return result;
            }
        }

        cleanup(referenceTime = now()) {
            const cutoff =
                referenceTime -
                this.config
                    .maximumVectorAgeMs;

            for (
                const [
                    vectorId,
                    vector
                ]
                of this.vectorIndex
                    .entries()
            ) {
                if (
                    vector.endTimestamp <
                    cutoff
                ) {
                    this.vectorIndex
                        .delete(
                            vectorId
                        );

                    this.statistics
                        .expiredVectors +=
                        1;
                }
            }

            const trackIds =
                new Set([
                    ...this.trackMap.keys(),
                    ...Array.from(
                        this.vectorIndex
                            .values()
                    )
                    .map(
                        vector =>
                            vector.trackId
                    )
                ]);

            for (
                const trackId
                of trackIds
            ) {
                this.rebuildTrack(
                    trackId
                );
            }

            if (
                this.trackMap.size >
                this.config
                    .maximumTracks
            ) {
                const sortedTracks =
                    Array.from(
                        this.trackMap
                            .entries()
                    )
                    .sort(
                        (
                            first,
                            second
                        ) => {
                            const firstTime =
                                first[1][
                                    first[1].length -
                                    1
                                ]?.endTimestamp ??
                                0;

                            const secondTime =
                                second[1][
                                    second[1].length -
                                    1
                                ]?.endTimestamp ??
                                0;

                            return (
                                firstTime -
                                secondTime
                            );
                        }
                    );

                const removeCount =
                    this.trackMap.size -
                    this.config
                        .maximumTracks;

                for (
                    let index = 0;
                    index <
                        removeCount;
                    index += 1
                ) {
                    this.deleteTrack(
                        sortedTracks[
                            index
                        ][0]
                    );

                    this.statistics
                        .removedTracks +=
                        1;
                }
            }
        }

        deleteVector(vectorId) {
            const normalizedId =
                normalizeText(
                    vectorId
                );

            const vector =
                this.vectorIndex.get(
                    normalizedId
                );

            if (!vector) {
                return {
                    success:
                        true,

                    deleted:
                        false
                };
            }

            this.vectorIndex.delete(
                normalizedId
            );

            this.rebuildTrack(
                vector.trackId
            );

            return {
                success:
                    true,

                deleted:
                    true,

                vectorId:
                    normalizedId,

                trackId:
                    vector.trackId
            };
        }

        deleteTrack(trackId) {
            const normalizedTrackId =
                normalizeText(
                    trackId
                );

            const vectors =
                this.trackMap.get(
                    normalizedTrackId
                ) || [];

            for (
                const vector
                of vectors
            ) {
                this.vectorIndex.delete(
                    vector.vectorId
                );
            }

            const deleted =
                this.trackMap.delete(
                    normalizedTrackId
                );

            this.latestVectorMap.delete(
                normalizedTrackId
            );

            return {
                success:
                    true,

                deleted,

                trackId:
                    normalizedTrackId,

                removedVectorCount:
                    vectors.length
            };
        }

        publish() {
            const objectSnapshot =
                {};

            const trackList =
                [];

            let vectorCount =
                0;

            for (
                const [
                    trackId,
                    vectors
                ]
                of this.trackMap
                    .entries()
            ) {
                objectSnapshot[
                    trackId
                ] =
                    cloneValue(
                        vectors
                    );

                vectorCount +=
                    vectors.length;

                trackList.push({
                    trackId,

                    vectorCount:
                        vectors.length,

                    latestVector:
                        cloneValue(
                            this.latestVectorMap
                                .get(trackId) ||
                            null
                        ),

                    vectors:
                        cloneValue(
                            vectors
                        )
                });
            }

            global.RainArrivalMotionVectorRepository =
                cloneValue(
                    objectSnapshot
                );

            global.RainArrivalMotionVectorRepositoryTracks =
                cloneValue(
                    trackList
                );

            global.RainArrivalLatestMotionVectors =
                Object.fromEntries(
                    Array.from(
                        this.latestVectorMap
                            .entries()
                    )
                    .map(
                        (
                            [
                                trackId,
                                vector
                            ]
                        ) => [
                            trackId,
                            cloneValue(
                                vector
                            )
                        ]
                    )
                );

            global.RainGuardAI =
                global.RainGuardAI ||
                {};

            global.RainGuardAI.V32 =
                global.RainGuardAI.V32 ||
                {};

            global.RainGuardAI.V32
                .motionVectorRepository =
                cloneValue(
                    objectSnapshot
                );

            global.RainGuardAI.V32
                .motionVectorRepositoryTracks =
                cloneValue(
                    trackList
                );

            global.RainGuardAI.V32
                .latestMotionVectors =
                cloneValue(
                    global
                        .RainArrivalLatestMotionVectors
                );

            return {
                objectSnapshot,

                trackList,

                vectorCount
            };
        }

        getTrackVectors(trackId) {
            return cloneValue(
                this.trackMap.get(
                    normalizeText(
                        trackId
                    )
                ) || []
            );
        }

        getLatestVector(trackId) {
            return cloneValue(
                this.latestVectorMap
                    .get(
                        normalizeText(
                            trackId
                        )
                    ) ||
                null
            );
        }

        getVector(vectorId) {
            return cloneValue(
                this.vectorIndex
                    .get(
                        normalizeText(
                            vectorId
                        )
                    ) ||
                null
            );
        }

        getAll() {
            const result =
                {};

            for (
                const [
                    trackId,
                    vectors
                ]
                of this.trackMap
                    .entries()
            ) {
                result[trackId] =
                    cloneValue(
                        vectors
                    );
            }

            return result;
        }

        getAllTracks() {
            return Array.from(
                this.trackMap
                    .entries()
            )
            .map(
                (
                    [
                        trackId,
                        vectors
                    ]
                ) => ({
                    trackId,

                    vectorCount:
                        vectors.length,

                    latestVector:
                        cloneValue(
                            this.latestVectorMap
                                .get(trackId) ||
                            null
                        ),

                    vectors:
                        cloneValue(
                            vectors
                        )
                })
            );
        }

        getCount() {
            return this.vectorIndex
                .size;
        }

        getTrackCount() {
            return this.trackMap
                .size;
        }

        clear() {
            const removedVectorCount =
                this.vectorIndex
                    .size;

            const removedTrackCount =
                this.trackMap
                    .size;

            this.trackMap.clear();

            this.vectorIndex.clear();

            this.latestVectorMap.clear();

            this.publish();

            return {
                success:
                    true,

                removedVectorCount,

                removedTrackCount
            };
        }

        printTable() {
            const rows =
                this.getAllTracks()
                .map(
                    track => ({
                        trackId:
                            track.trackId,

                        vectorCount:
                            track.vectorCount,

                        latestSpeedKmh:
                            track
                                .latestVector
                                ?.speedKmh ??
                            null,

                        latestBearing:
                            track
                                .latestVector
                                ?.bearing ??
                            null,

                        stationary:
                            track
                                .latestVector
                                ?.stationary ??
                            null,

                        latestTime:
                            track
                                .latestVector
                                ?.endTimeIso ??
                            null
                    })
                );

            console.table(rows);

            return rows;
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

            this.syncFromHistory();

            this.timer =
                global.setInterval(
                    () =>
                        this.syncFromHistory(),
                    this.config
                        .syncIntervalMs
                );

            return {
                success:
                    true,

                running:
                    true,

                intervalMs:
                    this.config
                        .syncIntervalMs
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

        getDiagnostics() {
            return {
                module:
                    MODULE_NAME,

                version:
                    this.version,

                build:
                    this.buildId,

                installed:
                    true,

                running:
                    this.running,

                trackCount:
                    this.getTrackCount(),

                vectorCount:
                    this.getCount(),

                latestResult:
                    cloneValue(
                        this.latestResult
                    ),

                lastError:
                    cloneValue(
                        this.lastError
                    ),

                statistics:
                    cloneValue(
                        this.statistics
                    )
            };
        }

        diagnose() {
            const diagnostics =
                this.getDiagnostics();

            console.log(
                "[RainArrival MotionVectorRepository]",
                diagnostics
            );

            return diagnostics;
        }
    }

    const repository =
        new MotionVectorRepository();

    global.RainArrivalMotionVectorRepositoryV32 =
        repository;

    global.RainGuardAI =
        global.RainGuardAI ||
        {};

    global.RainGuardAI.V32 =
        global.RainGuardAI.V32 ||
        {};

    global.RainGuardAI.V32
        .rainArrivalModules =
        global.RainGuardAI.V32
            .rainArrivalModules ||
        {};

    global.RainGuardAI.V32
        .rainArrivalModules
        .motionVectorRepository =
        repository;

    global.RainArrivalEngineV32
        ?.register?.(
            MODULE_NAME,
            repository
        );

    global.RainArrivalOrchestratorV32
        ?.register?.(
            MODULE_NAME,
            repository
        );

    global.syncRainArrivalMotionVectorRepository =
        () =>
            repository
                .syncFromHistory();

    if (
        repository.config
            .autoStart
    ) {
        repository.start();
    }

    console.log(
        "[RainGuard AI V32] Motion Vector Repository loaded.",
        {
            version:
                VERSION,

            build:
                BUILD_ID
        }
    );

})(
    typeof globalThis !==
        "undefined"
        ? globalThis
        : window
);
