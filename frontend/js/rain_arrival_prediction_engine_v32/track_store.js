/*
===========================================================
 RainGuard AI V32
 Phase 38M-2
 Track Store Module

 Responsibilities:
 - Central storm-track storage
 - Track identity preservation
 - Historical point management
 - Alias mapping
 - Safe merge and update
 - Track lookup for Phases 35–38
===========================================================
*/

(function (global) {
    "use strict";

    const MODULE_NAME = "trackStore";
    const VERSION = "32.38M.2";
    const BUILD = "rainguard-v32-phase38m-track-store";

    const DEFAULT_CONFIG = Object.freeze({
        maxTracks: 500,
        maxPointsPerTrack: 120,
        maxAliasesPerTrack: 30,
        staleTrackMs: 6 * 60 * 60 * 1000,
        minimumPointIntervalMs: 1000,
        coordinatePrecision: 6,
        autoCleanup: true
    });

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

    function isFiniteNumber(value) {
        return (
            typeof value === "number" &&
            Number.isFinite(value)
        );
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

    function normalizeId(value) {
        return normalizeText(value);
    }

    function roundCoordinate(value, precision) {
        if (!isFiniteNumber(value)) {
            return null;
        }

        const factor = Math.pow(10, precision);

        return (
            Math.round(value * factor) /
            factor
        );
    }

    function normalizeCoordinate(
        coordinate,
        precision
    ) {
        if (!coordinate) {
            return null;
        }

        let lat = null;
        let lon = null;

        if (Array.isArray(coordinate)) {
            lat = Number(coordinate[0]);
            lon = Number(coordinate[1]);
        } else if (isObject(coordinate)) {
            lat = Number(
                coordinate.lat ??
                coordinate.latitude ??
                coordinate.y
            );

            lon = Number(
                coordinate.lon ??
                coordinate.lng ??
                coordinate.longitude ??
                coordinate.x
            );
        }

        if (
            !Number.isFinite(lat) ||
            !Number.isFinite(lon)
        ) {
            return null;
        }

        if (
            lat < -90 ||
            lat > 90 ||
            lon < -180 ||
            lon > 180
        ) {
            return null;
        }

        return {
            lat: roundCoordinate(
                lat,
                precision
            ),

            lon: roundCoordinate(
                lon,
                precision
            )
        };
    }

    function normalizeTimestamp(value) {
        if (isFiniteNumber(value)) {
            return value;
        }

        if (value instanceof Date) {
            return value.getTime();
        }

        if (typeof value === "string") {
            const parsed = Date.parse(value);

            if (Number.isFinite(parsed)) {
                return parsed;
            }
        }

        return now();
    }

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
            } catch (error) {
                // Continue with fallback.
            }
        }

        try {
            return JSON.parse(
                JSON.stringify(value)
            );
        } catch (error) {
            return value;
        }
    }

    function generateTrackId(prefix = "TRACK") {
        const randomPart =
            Math.random()
                .toString(36)
                .slice(2, 10)
                .toUpperCase();

        return [
            prefix,
            now(),
            randomPart
        ].join("-");
    }

    function normalizePoint(
        point,
        config
    ) {
        if (!isObject(point)) {
            return null;
        }

        const coordinate =
            normalizeCoordinate(
                point.coordinate ??
                point.position ??
                point.location ??
                {
                    lat:
                        point.lat ??
                        point.latitude,

                    lon:
                        point.lon ??
                        point.lng ??
                        point.longitude
                },
                config.coordinatePrecision
            );

        if (!coordinate) {
            return null;
        }

        const timestamp =
            normalizeTimestamp(
                point.timestamp ??
                point.time ??
                point.observedAt ??
                point.createdAt
            );

        const normalized = {
            timestamp,
            coordinate,

            lat:
                coordinate.lat,

            lon:
                coordinate.lon,

            intensity:
                isFiniteNumber(
                    Number(point.intensity)
                )
                    ? Number(point.intensity)
                    : null,

            confidence:
                isFiniteNumber(
                    Number(point.confidence)
                )
                    ? Number(point.confidence)
                    : null,

            speedKmh:
                isFiniteNumber(
                    Number(
                        point.speedKmh ??
                        point.speed
                    )
                )
                    ? Number(
                        point.speedKmh ??
                        point.speed
                    )
                    : null,

            bearing:
                isFiniteNumber(
                    Number(point.bearing)
                )
                    ? Number(point.bearing)
                    : null,

            source:
                normalizeText(
                    point.source ??
                    point.sourceName
                ) || null,

            cellId:
                normalizeId(
                    point.cellId ??
                    point.entityId
                ) || null,

            metadata:
                isObject(point.metadata)
                    ? cloneValue(
                        point.metadata
                    )
                    : {}
        };

        return normalized;
    }

    function createEmptyTrack(
        trackId,
        input = {}
    ) {
        const createdAt =
            normalizeTimestamp(
                input.createdAt
            );

        return {
            trackId,

            canonicalTrackId:
                normalizeId(
                    input.canonicalTrackId
                ) || trackId,

            aliases: new Set(),

            points: [],

            currentPoint: null,

            source:
                normalizeText(
                    input.source
                ) || null,

            cellId:
                normalizeId(
                    input.cellId ??
                    input.entityId
                ) || null,

            city:
                normalizeText(
                    input.city ??
                    input.cityName
                ) || null,

            region:
                normalizeText(
                    input.region ??
                    input.regionName
                ) || null,

            status:
                normalizeText(
                    input.status
                ) || "active",

            createdAt,

            updatedAt:
                normalizeTimestamp(
                    input.updatedAt
                ),

            lastObservedAt:
                normalizeTimestamp(
                    input.lastObservedAt ??
                    input.updatedAt ??
                    input.createdAt
                ),

            confidence:
                isFiniteNumber(
                    Number(input.confidence)
                )
                    ? Number(
                        input.confidence
                    )
                    : null,

            metadata:
                isObject(input.metadata)
                    ? cloneValue(
                        input.metadata
                    )
                    : {}
        };
    }

    class RainArrivalTrackStore {

        constructor(config = {}) {
            this.version = VERSION;
            this.build = BUILD;

            this.config = {
                ...DEFAULT_CONFIG,
                ...(isObject(config)
                    ? config
                    : {})
            };

            this.tracks = new Map();
            this.aliasToCanonical = new Map();

            this.statistics = {
                created: 0,
                updated: 0,
                deleted: 0,
                merged: 0,
                aliasesRegistered: 0,
                pointsAdded: 0,
                duplicatePointsSkipped: 0,
                cleanupRuns: 0,
                staleTracksRemoved: 0
            };

            this.createdAt = now();
            this.updatedAt = this.createdAt;
        }

        resolveCanonicalTrackId(trackId) {
            const normalizedId =
                normalizeId(trackId);

            if (!normalizedId) {
                return null;
            }

            if (
                this.tracks.has(
                    normalizedId
                )
            ) {
                return normalizedId;
            }

            return (
                this.aliasToCanonical.get(
                    normalizedId
                ) ||
                null
            );
        }

        has(trackId) {
            return Boolean(
                this.resolveCanonicalTrackId(
                    trackId
                )
            );
        }

        get(trackId, options = {}) {
            const canonicalTrackId =
                this.resolveCanonicalTrackId(
                    trackId
                );

            if (!canonicalTrackId) {
                return null;
            }

            const track =
                this.tracks.get(
                    canonicalTrackId
                );

            if (!track) {
                return null;
            }

            if (options.raw === true) {
                return track;
            }

            return this.serializeTrack(
                track
            );
        }

        getRaw(trackId) {
            return this.get(
                trackId,
                {
                    raw: true
                }
            );
        }

        getAll(options = {}) {
            const values =
                Array.from(
                    this.tracks.values()
                );

            const filtered =
                options.status
                    ? values.filter(
                        track =>
                            track.status ===
                            options.status
                    )
                    : values;

            const sorted =
                filtered.sort(
                    (a, b) =>
                        b.updatedAt -
                        a.updatedAt
                );

            if (options.raw === true) {
                return sorted;
            }

            return sorted.map(
                track =>
                    this.serializeTrack(
                        track
                    )
            );
        }

        create(input = {}) {
            const requestedTrackId =
                normalizeId(
                    input.trackId ??
                    input.id ??
                    input.cellId ??
                    input.entityId
                );

            const trackId =
                requestedTrackId ||
                generateTrackId();

            const existingCanonicalId =
                this.resolveCanonicalTrackId(
                    trackId
                );

            if (existingCanonicalId) {
                return this.update(
                    existingCanonicalId,
                    input
                );
            }

            const track =
                createEmptyTrack(
                    trackId,
                    input
                );

            this.tracks.set(
                track.trackId,
                track
            );

            this.aliasToCanonical.set(
                track.trackId,
                track.trackId
            );

            this.statistics.created += 1;
            this.updatedAt = now();

            const aliases =
                Array.isArray(input.aliases)
                    ? input.aliases
                    : [];

            aliases.forEach(alias => {
                this.registerAlias(
                    track.trackId,
                    alias
                );
            });

            const points = [];

            if (
                Array.isArray(
                    input.points
                )
            ) {
                points.push(
                    ...input.points
                );
            }

            if (
                input.point ||
                input.coordinate ||
                input.position ||
                isFiniteNumber(
                    Number(input.lat)
                )
            ) {
                points.push(
                    input.point ||
                    input
                );
            }

            points.forEach(point => {
                this.addPoint(
                    track.trackId,
                    point
                );
            });

            this.enforceTrackLimit();

            return this.get(
                track.trackId
            );
        }

        upsert(input = {}) {
            const candidateId =
                normalizeId(
                    input.trackId ??
                    input.canonicalTrackId ??
                    input.id ??
                    input.cellId ??
                    input.entityId
                );

            const canonicalId =
                candidateId
                    ? this.resolveCanonicalTrackId(
                        candidateId
                    )
                    : null;

            if (canonicalId) {
                return this.update(
                    canonicalId,
                    input
                );
            }

            return this.create(input);
        }

        update(
            trackId,
            patch = {}
        ) {
            const track =
                this.getRaw(trackId);

            if (!track) {
                return this.create({
                    ...patch,
                    trackId:
                        normalizeId(
                            patch.trackId
                        ) ||
                        normalizeId(trackId)
                });
            }

            if (
                patch.source !==
                undefined
            ) {
                track.source =
                    normalizeText(
                        patch.source
                    ) || null;
            }

            if (
                patch.cellId !==
                undefined ||
                patch.entityId !==
                undefined
            ) {
                track.cellId =
                    normalizeId(
                        patch.cellId ??
                        patch.entityId
                    ) || null;
            }

            if (
                patch.city !==
                undefined ||
                patch.cityName !==
                undefined
            ) {
                track.city =
                    normalizeText(
                        patch.city ??
                        patch.cityName
                    ) || null;
            }

            if (
                patch.region !==
                undefined ||
                patch.regionName !==
                undefined
            ) {
                track.region =
                    normalizeText(
                        patch.region ??
                        patch.regionName
                    ) || null;
            }

            if (
                patch.status !==
                undefined
            ) {
                track.status =
                    normalizeText(
                        patch.status
                    ) || track.status;
            }

            if (
                patch.confidence !==
                undefined
            ) {
                const confidence =
                    Number(
                        patch.confidence
                    );

                track.confidence =
                    Number.isFinite(
                        confidence
                    )
                        ? confidence
                        : track.confidence;
            }

            if (
                isObject(
                    patch.metadata
                )
            ) {
                track.metadata = {
                    ...track.metadata,
                    ...cloneValue(
                        patch.metadata
                    )
                };
            }

            track.updatedAt = now();

            if (
                patch.lastObservedAt !==
                undefined
            ) {
                track.lastObservedAt =
                    normalizeTimestamp(
                        patch.lastObservedAt
                    );
            }

            if (
                Array.isArray(
                    patch.aliases
                )
            ) {
                patch.aliases.forEach(
                    alias => {
                        this.registerAlias(
                            track.trackId,
                            alias
                        );
                    }
                );
            }

            if (
                Array.isArray(
                    patch.points
                )
            ) {
                patch.points.forEach(
                    point => {
                        this.addPoint(
                            track.trackId,
                            point
                        );
                    }
                );
            }

            if (
                patch.point ||
                patch.coordinate ||
                patch.position
            ) {
                this.addPoint(
                    track.trackId,
                    patch.point ||
                    patch
                );
            }

            this.statistics.updated += 1;
            this.updatedAt = now();

            return this.get(
                track.trackId
            );
        }

        registerAlias(
            trackId,
            alias
        ) {
            const track =
                this.getRaw(trackId);

            const normalizedAlias =
                normalizeId(alias);

            if (
                !track ||
                !normalizedAlias
            ) {
                return false;
            }

            if (
                normalizedAlias ===
                track.trackId
            ) {
                return true;
            }

            const existingCanonical =
                this.aliasToCanonical.get(
                    normalizedAlias
                );

            if (
                existingCanonical &&
                existingCanonical !==
                track.trackId
            ) {
                return false;
            }

            if (
                track.aliases.size >=
                this.config
                    .maxAliasesPerTrack
            ) {
                return false;
            }

            track.aliases.add(
                normalizedAlias
            );

            this.aliasToCanonical.set(
                normalizedAlias,
                track.trackId
            );

            this.statistics
                .aliasesRegistered += 1;

            track.updatedAt = now();
            this.updatedAt = track.updatedAt;

            return true;
        }

        removeAlias(alias) {
            const normalizedAlias =
                normalizeId(alias);

            const canonicalId =
                this.aliasToCanonical.get(
                    normalizedAlias
                );

            if (
                !normalizedAlias ||
                !canonicalId ||
                normalizedAlias ===
                canonicalId
            ) {
                return false;
            }

            const track =
                this.tracks.get(
                    canonicalId
                );

            if (track) {
                track.aliases.delete(
                    normalizedAlias
                );
            }

            this.aliasToCanonical.delete(
                normalizedAlias
            );

            this.updatedAt = now();

            return true;
        }

        addPoint(
            trackId,
            point
        ) {
            const track =
                this.getRaw(trackId);

            if (!track) {
                return null;
            }

            const normalizedPoint =
                normalizePoint(
                    point,
                    this.config
                );

            if (!normalizedPoint) {
                return null;
            }

            const lastPoint =
                track.points.length > 0
                    ? track.points[
                        track.points.length -
                        1
                    ]
                    : null;

            if (
                lastPoint &&
                Math.abs(
                    normalizedPoint.timestamp -
                    lastPoint.timestamp
                ) <
                    this.config
                        .minimumPointIntervalMs &&
                normalizedPoint.lat ===
                    lastPoint.lat &&
                normalizedPoint.lon ===
                    lastPoint.lon
            ) {
                this.statistics
                    .duplicatePointsSkipped += 1;

                return cloneValue(
                    lastPoint
                );
            }

            track.points.push(
                normalizedPoint
            );

            track.points.sort(
                (a, b) =>
                    a.timestamp -
                    b.timestamp
            );

            if (
                track.points.length >
                this.config
                    .maxPointsPerTrack
            ) {
                track.points.splice(
                    0,
                    track.points.length -
                    this.config
                        .maxPointsPerTrack
                );
            }

            track.currentPoint =
                track.points[
                    track.points.length -
                    1
                ];

            track.lastObservedAt =
                Math.max(
                    track.lastObservedAt ||
                    0,
                    normalizedPoint.timestamp
                );

            track.updatedAt = now();

            this.statistics
                .pointsAdded += 1;

            this.updatedAt =
                track.updatedAt;

            return cloneValue(
                normalizedPoint
            );
        }

        mergeTracks(
            primaryTrackId,
            secondaryTrackId
        ) {
            const primary =
                this.getRaw(
                    primaryTrackId
                );

            const secondary =
                this.getRaw(
                    secondaryTrackId
                );

            if (
                !primary ||
                !secondary ||
                primary.trackId ===
                secondary.trackId
            ) {
                return null;
            }

            const mergedPoints = [
                ...primary.points,
                ...secondary.points
            ];

            primary.points = [];

            mergedPoints.forEach(
                point => {
                    this.addPoint(
                        primary.trackId,
                        point
                    );
                }
            );

            this.registerAlias(
                primary.trackId,
                secondary.trackId
            );

            secondary.aliases.forEach(
                alias => {
                    this.registerAlias(
                        primary.trackId,
                        alias
                    );
                }
            );

            primary.metadata = {
                ...secondary.metadata,
                ...primary.metadata,
                mergedTrackIds: [
                    ...new Set([
                        ...(
                            Array.isArray(
                                primary.metadata
                                    .mergedTrackIds
                            )
                                ? primary
                                    .metadata
                                    .mergedTrackIds
                                : []
                        ),
                        secondary.trackId
                    ])
                ]
            };

            primary.updatedAt = now();

            this.delete(
                secondary.trackId,
                {
                    preserveAliases: true
                }
            );

            this.aliasToCanonical.set(
                secondary.trackId,
                primary.trackId
            );

            secondary.aliases.forEach(
                alias => {
                    this.aliasToCanonical.set(
                        alias,
                        primary.trackId
                    );
                }
            );

            this.statistics.merged += 1;

            return this.get(
                primary.trackId
            );
        }

        delete(
            trackId,
            options = {}
        ) {
            const canonicalId =
                this.resolveCanonicalTrackId(
                    trackId
                );

            if (!canonicalId) {
                return false;
            }

            const track =
                this.tracks.get(
                    canonicalId
                );

            if (!track) {
                return false;
            }

            this.tracks.delete(
                canonicalId
            );

            if (
                options.preserveAliases !==
                true
            ) {
                this.aliasToCanonical.delete(
                    canonicalId
                );

                track.aliases.forEach(
                    alias => {
                        this.aliasToCanonical
                            .delete(alias);
                    }
                );
            }

            this.statistics.deleted += 1;
            this.updatedAt = now();

            return true;
        }

        cleanup(
            referenceTime = now()
        ) {
            this.statistics.cleanupRuns += 1;

            const removed = [];

            for (
                const [
                    trackId,
                    track
                ] of this.tracks
            ) {
                const age =
                    referenceTime -
                    (
                        track.lastObservedAt ||
                        track.updatedAt ||
                        track.createdAt
                    );

                if (
                    age >
                    this.config.staleTrackMs
                ) {
                    if (
                        this.delete(trackId)
                    ) {
                        removed.push(
                            trackId
                        );
                    }
                }
            }

            this.statistics
                .staleTracksRemoved +=
                removed.length;

            return {
                removedCount:
                    removed.length,

                removedTrackIds:
                    removed,

                remainingTracks:
                    this.tracks.size
            };
        }

        enforceTrackLimit() {
            if (
                this.tracks.size <=
                this.config.maxTracks
            ) {
                return;
            }

            const sorted =
                Array.from(
                    this.tracks.values()
                ).sort(
                    (a, b) =>
                        (
                            a.lastObservedAt ||
                            a.updatedAt
                        ) -
                        (
                            b.lastObservedAt ||
                            b.updatedAt
                        )
                );

            const excess =
                this.tracks.size -
                this.config.maxTracks;

            sorted
                .slice(0, excess)
                .forEach(track => {
                    this.delete(
                        track.trackId
                    );
                });
        }

        findByCellId(cellId) {
            const normalizedCellId =
                normalizeId(cellId);

            if (!normalizedCellId) {
                return null;
            }

            for (
                const track of
                this.tracks.values()
            ) {
                if (
                    track.cellId ===
                    normalizedCellId
                ) {
                    return this.serializeTrack(
                        track
                    );
                }
            }

            return null;
        }

        findNearestByCoordinate(
            coordinate,
            maxDifference = 0.1
        ) {
            const normalized =
                normalizeCoordinate(
                    coordinate,
                    this.config
                        .coordinatePrecision
                );

            if (!normalized) {
                return null;
            }

            let bestTrack = null;
            let bestDifference =
                Infinity;

            for (
                const track of
                this.tracks.values()
            ) {
                const point =
                    track.currentPoint;

                if (!point) {
                    continue;
                }

                const difference =
                    Math.sqrt(
                        Math.pow(
                            point.lat -
                            normalized.lat,
                            2
                        ) +
                        Math.pow(
                            point.lon -
                            normalized.lon,
                            2
                        )
                    );

                if (
                    difference <
                    bestDifference
                ) {
                    bestDifference =
                        difference;

                    bestTrack = track;
                }
            }

            if (
                !bestTrack ||
                bestDifference >
                maxDifference
            ) {
                return null;
            }

            return {
                track:
                    this.serializeTrack(
                        bestTrack
                    ),

                difference:
                    bestDifference
            };
        }

        serializeTrack(track) {
            if (!track) {
                return null;
            }

            return {
                trackId:
                    track.trackId,

                canonicalTrackId:
                    track.canonicalTrackId,

                aliases:
                    Array.from(
                        track.aliases
                    ),

                points:
                    cloneValue(
                        track.points
                    ),

                currentPoint:
                    cloneValue(
                        track.currentPoint
                    ),

                source:
                    track.source,

                cellId:
                    track.cellId,

                city:
                    track.city,

                region:
                    track.region,

                status:
                    track.status,

                createdAt:
                    track.createdAt,

                updatedAt:
                    track.updatedAt,

                lastObservedAt:
                    track.lastObservedAt,

                confidence:
                    track.confidence,

                metadata:
                    cloneValue(
                        track.metadata
                    )
            };
        }

        exportSnapshot() {
            return {
                version:
                    this.version,

                build:
                    this.build,

                exportedAt:
                    now(),

                config:
                    cloneValue(
                        this.config
                    ),

                statistics:
                    cloneValue(
                        this.statistics
                    ),

                tracks:
                    this.getAll()
            };
        }

        importSnapshot(
            snapshot,
            options = {}
        ) {
            if (
                !isObject(snapshot) ||
                !Array.isArray(
                    snapshot.tracks
                )
            ) {
                return {
                    success: false,
                    reason:
                        "INVALID_SNAPSHOT"
                };
            }

            if (
                options.replace === true
            ) {
                this.clear();
            }

            let imported = 0;
            let failed = 0;

            snapshot.tracks.forEach(
                track => {
                    try {
                        this.upsert(track);
                        imported += 1;
                    } catch (error) {
                        failed += 1;
                    }
                }
            );

            return {
                success:
                    failed === 0,

                imported,
                failed,

                trackCount:
                    this.tracks.size
            };
        }

        clear() {
            this.tracks.clear();
            this.aliasToCanonical.clear();

            this.updatedAt = now();

            return true;
        }

        getDiagnostics() {
            return {
                module:
                    MODULE_NAME,

                version:
                    this.version,

                build:
                    this.build,

                trackCount:
                    this.tracks.size,

                aliasCount:
                    this.aliasToCanonical
                        .size,

                pointCount:
                    Array.from(
                        this.tracks.values()
                    ).reduce(
                        (
                            total,
                            track
                        ) =>
                            total +
                            track.points.length,
                        0
                    ),

                statistics:
                    cloneValue(
                        this.statistics
                    ),

                createdAt:
                    this.createdAt,

                updatedAt:
                    this.updatedAt,

                config:
                    cloneValue(
                        this.config
                    )
            };
        }

        diagnose() {
            const diagnostics =
                this.getDiagnostics();

            console.log(
                "[RainArrival TrackStore]",
                diagnostics
            );

            return diagnostics;
        }

        printTable() {
            const rows =
                this.getAll().map(
                    track => ({
                        trackId:
                            track.trackId,

                        canonicalTrackId:
                            track
                                .canonicalTrackId,

                        aliases:
                            track.aliases.length,

                        points:
                            track.points.length,

                        cellId:
                            track.cellId,

                        city:
                            track.city,

                        status:
                            track.status,

                        source:
                            track.source,

                        updatedAt:
                            new Date(
                                track.updatedAt
                            ).toISOString()
                    })
                );

            console.table(rows);

            return rows;
        }
    }

    const api =
        new RainArrivalTrackStore();

    global.RainArrivalTrackStoreV32 =
        api;

    global.RainArrivalTrackStoreClassV32 =
        RainArrivalTrackStore;

    if (
        global.RainArrivalEngineV32 &&
        typeof global
            .RainArrivalEngineV32
            .register === "function"
    ) {
        global.RainArrivalEngineV32
            .register(
                MODULE_NAME,
                api
            );
    }

    global.RainGuardAI =
        global.RainGuardAI || {};

    global.RainGuardAI.V32 =
        global.RainGuardAI.V32 || {};

    global.RainGuardAI.V32
        .rainArrivalModules =
        global.RainGuardAI.V32
            .rainArrivalModules || {};

    global.RainGuardAI.V32
        .rainArrivalModules
        .trackStore =
        api;

    console.log(
        "[RainGuard AI V32] Track Store Module loaded.",
        {
            version:
                VERSION,

            build:
                BUILD
        }
    );

})(
    typeof globalThis !== "undefined"
        ? globalThis
        : window
);
