/*
===========================================================
 RainGuard AI V32
 Phase 38M-17
 Final Arrival Candidate Builder

 Purpose:
 - Read live storm entities produced by Phases 38M-14/15/16.
 - Normalize and deduplicate storm tracks.
 - Resolve the active Rain Arrival target.
 - Measure distance and directional alignment to the target.
 - Build ranked arrival candidates without inventing motion.
 - Publish candidates to:
     window.RainArrivalCandidates
     RainGuardAI.V32.rainArrivalCandidates
===========================================================
*/

(function (global) {
    "use strict";

    const MODULE_NAME =
        "finalArrivalCandidateBuilder";

    const VERSION =
        "32.38M.17";

    const BUILD =
        "rainguard-v32-phase38m-final-arrival-candidate-builder";

    const DEFAULT_CONFIG =
        Object.freeze({
            autoStart:
                true,

            buildIntervalMs:
                4000,

            maximumSourceEntities:
                1500,

            maximumCandidates:
                250,

            maximumCandidateDistanceKm:
                1200,

            minimumSpeedKmh:
                1,

            maximumSpeedKmh:
                220,

            maximumApproachAngleDeg:
                105,

            preferredApproachAngleDeg:
                45,

            minimumConfidence:
                0,

            debug:
                true
        });

    const now =
        () => Date.now();

    function isObject(value) {
        return (
            value !== null &&
            typeof value === "object" &&
            !Array.isArray(value)
        );
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
                // Continue with JSON fallback.
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

    function clamp(
        value,
        minimum,
        maximum
    ) {
        return Math.max(
            minimum,
            Math.min(
                maximum,
                value
            )
        );
    }

    function normalizeDegrees(value) {
        const number =
            toFiniteNumber(
                value,
                null
            );

        if (number === null) {
            return null;
        }

        return (
            (
                number %
                360
            ) +
            360
        ) %
        360;
    }

    function normalizeCoordinate(value) {
        if (!value) {
            return null;
        }

        if (
            Array.isArray(value) &&
            value.length >= 2
        ) {
            const first =
                toFiniteNumber(
                    value[0],
                    null
                );

            const second =
                toFiniteNumber(
                    value[1],
                    null
                );

            if (
                first === null ||
                second === null
            ) {
                return null;
            }

            const likelyLonLat =
                Math.abs(first) > 90 &&
                Math.abs(second) <= 90;

            return likelyLonLat
                ? {
                    latitude:
                        second,

                    longitude:
                        first
                }
                : {
                    latitude:
                        first,

                    longitude:
                        second
                };
        }

        const latitude =
            toFiniteNumber(
                value.latitude ??
                value.lat ??
                value.y ??
                value.center?.latitude ??
                value.center?.lat ??
                value.centroid?.latitude ??
                value.centroid?.lat ??
                value.coordinate?.latitude ??
                value.coordinate?.lat ??
                value.currentCoordinate?.latitude ??
                value.currentCoordinate?.lat,
                null
            );

        const longitude =
            toFiniteNumber(
                value.longitude ??
                value.lon ??
                value.lng ??
                value.x ??
                value.center?.longitude ??
                value.center?.lon ??
                value.center?.lng ??
                value.centroid?.longitude ??
                value.centroid?.lon ??
                value.centroid?.lng ??
                value.coordinate?.longitude ??
                value.coordinate?.lon ??
                value.coordinate?.lng ??
                value.currentCoordinate?.longitude ??
                value.currentCoordinate?.lon ??
                value.currentCoordinate?.lng,
                null
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

        return {
            latitude,
            longitude
        };
    }

    function degToRad(value) {
        return value *
            Math.PI /
            180;
    }

    function radToDeg(value) {
        return value *
            180 /
            Math.PI;
    }

    function haversineKm(
        first,
        second
    ) {
        const earthRadiusKm =
            6371.0088;

        const firstLat =
            degToRad(
                first.latitude
            );

        const secondLat =
            degToRad(
                second.latitude
            );

        const deltaLat =
            degToRad(
                second.latitude -
                first.latitude
            );

        const deltaLon =
            degToRad(
                second.longitude -
                first.longitude
            );

        const a =
            Math.sin(
                deltaLat / 2
            ) ** 2 +
            Math.cos(
                firstLat
            ) *
            Math.cos(
                secondLat
            ) *
            Math.sin(
                deltaLon / 2
            ) ** 2;

        return earthRadiusKm *
            2 *
            Math.atan2(
                Math.sqrt(a),
                Math.sqrt(
                    1 - a
                )
            );
    }

    function bearingBetween(
        first,
        second
    ) {
        const firstLat =
            degToRad(
                first.latitude
            );

        const secondLat =
            degToRad(
                second.latitude
            );

        const deltaLon =
            degToRad(
                second.longitude -
                first.longitude
            );

        const y =
            Math.sin(
                deltaLon
            ) *
            Math.cos(
                secondLat
            );

        const x =
            Math.cos(
                firstLat
            ) *
            Math.sin(
                secondLat
            ) -
            Math.sin(
                firstLat
            ) *
            Math.cos(
                secondLat
            ) *
            Math.cos(
                deltaLon
            );

        return normalizeDegrees(
            radToDeg(
                Math.atan2(
                    y,
                    x
                )
            )
        );
    }

    function angularDifference(
        first,
        second
    ) {
        if (
            first === null ||
            second === null
        ) {
            return null;
        }

        const difference =
            Math.abs(
                normalizeDegrees(first) -
                normalizeDegrees(second)
            );

        return Math.min(
            difference,
            360 - difference
        );
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
            } catch (error) {
                // Continue.
            }
        }

        return [];
    }

    function estimateMotionFromPoints(points) {
        if (
            !Array.isArray(points) ||
            points.length < 2
        ) {
            return {
                speedKmh:
                    null,

                bearing:
                    null,

                method:
                    null
            };
        }

        const normalized =
            points
                .map(
                    point => ({
                        coordinate:
                            normalizeCoordinate(
                                point
                            ),

                        timestamp:
                            toFiniteNumber(
                                point.timestamp ??
                                point.time ??
                                point.observedAt,
                                null
                            )
                    })
                )
                .filter(
                    point =>
                        point.coordinate &&
                        point.timestamp !==
                            null
                )
                .sort(
                    (
                        first,
                        second
                    ) =>
                        first.timestamp -
                        second.timestamp
                );

        if (
            normalized.length < 2
        ) {
            return {
                speedKmh:
                    null,

                bearing:
                    null,

                method:
                    null
            };
        }

        const first =
            normalized[
                normalized.length -
                2
            ];

        const second =
            normalized[
                normalized.length -
                1
            ];

        const elapsedHours =
            (
                second.timestamp -
                first.timestamp
            ) /
            3600000;

        if (
            elapsedHours <= 0
        ) {
            return {
                speedKmh:
                    null,

                bearing:
                    null,

                method:
                    null
            };
        }

        const distanceKm =
            haversineKm(
                first.coordinate,
                second.coordinate
            );

        return {
            speedKmh:
                distanceKm /
                elapsedHours,

            bearing:
                bearingBetween(
                    first.coordinate,
                    second.coordinate
                ),

            method:
                "POINT_HISTORY"
        };
    }

    class FinalArrivalCandidateBuilder {

        constructor(config = {}) {
            this.version =
                VERSION;

            this.build =
                BUILD;

            this.config = {
                ...DEFAULT_CONFIG,

                ...(isObject(config)
                    ? config
                    : {})
            };

            this.running =
                false;

            this.timer =
                null;

            this.lastResult =
                null;

            this.lastError =
                null;

            this.candidates =
                [];

            this.statistics = {
                builds:
                    0,

                sourceEntities:
                    0,

                normalized:
                    0,

                accepted:
                    0,

                rejected:
                    0,

                duplicates:
                    0,

                motionRecovered:
                    0,

                etaEstimated:
                    0,

                failures:
                    0
            };
        }

        getSourceEntities() {
            const sources = [
                global
                    .RainArrivalLiveStormEntities,

                global.RainGuardAI
                    ?.V32
                    ?.liveStormEntities,

                global.RainGuardAI
                    ?.V32
                    ?.stormEntities,

                global.RainGuardAI
                    ?.V31
                    ?.activeStormCells,

                global.RainGuardAI
                    ?.activeStormCells,

                global.RG31
                    ?.ActiveStormCells,

                global.RG31
                    ?.latestStormCells,

                global.StormCells,

                global
                    .RainArrivalStormEntitySourceAdapterV32
                    ?.getAll?.(),

                global
                    .RainArrivalStormEntityCollectorV32
                    ?.getAll?.(),

                global
                    .RainArrivalTrackStoreV32
                    ?.getAll?.()
            ];

            const result =
                [];

            sources.forEach(
                source => {
                    result.push(
                        ...collectionToArray(
                            source
                        )
                    );
                }
            );

            return result.slice(
                0,
                this.config
                    .maximumSourceEntities
            );
        }

        resolveTarget() {
            const engine =
                global.RainGuardAI
                    ?.V32
                    ?.rainArrivalPrediction ??
                global.RainArrivalEngineV32 ??
                null;

            const targetCandidates = [
                engine
                    ?.targetCoordinate,

                engine
                    ?.targetLocation,

                engine
                    ?.selectedLocation,

                engine
                    ?.phase23BTargetContext
                    ?.target,

                engine
                    ?.phase23BTargetContext,

                global.RainGuardAI
                    ?.V32
                    ?.targetCoordinate,

                global.RainGuardAI
                    ?.V32
                    ?.selectedLocation
            ];

            for (
                const target
                of targetCandidates
            ) {
                const coordinate =
                    normalizeCoordinate(
                        target
                    );

                if (coordinate) {
                    return {
                        coordinate,

                        city:
                            target?.city ??
                            target?.name ??
                            engine
                                ?.targetCity
                                ?.city ??
                            engine
                                ?.selectedCity
                                ?.city ??
                            engine
                                ?.selectedCity
                                ?.name ??
                            null,

                        source:
                            "RAIN_ARRIVAL_RUNTIME"
                    };
                }
            }

            return null;
        }

        normalizeEntity(
            entity,
            index
        ) {
            if (!entity) {
                return null;
            }

            const coordinate =
                normalizeCoordinate(
                    entity.currentCoordinate ??
                    entity.coordinate ??
                    entity.center ??
                    entity.centroid ??
                    entity.location ??
                    entity.position ??
                    entity
                );

            if (!coordinate) {
                return null;
            }

            const identity =
                normalizeText(
                    entity.canonicalTrackId ??
                    entity.trackId ??
                    entity.cellId ??
                    entity.id ??
                    entity.candidateId
                ) ||
                [
                    "ARRIVAL-CANDIDATE",
                    Math.round(
                        coordinate
                            .latitude *
                        10000
                    ),
                    Math.round(
                        coordinate
                            .longitude *
                        10000
                    ),
                    index
                ].join("-");

            const recoveredMotion =
                estimateMotionFromPoints(
                    entity.points ??
                    entity.history ??
                    entity.path ??
                    []
                );

            let speedKmh =
                toFiniteNumber(
                    entity.speedKmh ??
                    entity.speed ??
                    entity.motion
                        ?.speedKmh ??
                    entity.velocity
                        ?.speedKmh,
                    null
                );

            let bearing =
                normalizeDegrees(
                    entity.bearing ??
                    entity.direction ??
                    entity.motion
                        ?.bearing ??
                    entity.velocity
                        ?.bearing
                );

            let motionMethod =
                "ENTITY";

            if (
                (
                    speedKmh === null ||
                    speedKmh <
                        this.config
                            .minimumSpeedKmh
                ) &&
                recoveredMotion
                    .speedKmh !==
                    null
            ) {
                speedKmh =
                    recoveredMotion
                        .speedKmh;

                motionMethod =
                    recoveredMotion
                        .method;

                this.statistics
                    .motionRecovered +=
                    1;
            }

            if (
                bearing === null &&
                recoveredMotion
                    .bearing !==
                    null
            ) {
                bearing =
                    recoveredMotion
                        .bearing;

                motionMethod =
                    recoveredMotion
                        .method;
            }

            return {
                identity,

                trackId:
                    normalizeText(
                        entity.trackId
                    ) ||
                    identity,

                canonicalTrackId:
                    normalizeText(
                        entity
                            .canonicalTrackId
                    ) ||
                    identity,

                cellId:
                    normalizeText(
                        entity.cellId
                    ) ||
                    identity,

                coordinate,

                speedKmh,

                bearing,

                motionMethod,

                confidence:
                    toFiniteNumber(
                        entity.confidence ??
                        entity
                            .trackingConfidence ??
                        entity.score,
                        0
                    ),

                intensity:
                    toFiniteNumber(
                        entity.intensity ??
                        entity.reflectivity ??
                        entity.dbz ??
                        entity.severity,
                        null
                    ),

                city:
                    entity.city ??
                    entity.cityName ??
                    null,

                region:
                    entity.region ??
                    entity.regionName ??
                    null,

                source:
                    entity.source ??
                    "LIVE_STORM_ENTITY",

                points:
                    cloneValue(
                        entity.points ??
                        []
                    ),

                rawEntity:
                    cloneValue(entity)
            };
        }

        buildCandidate(
            entity,
            target
        ) {
            const distanceKm =
                haversineKm(
                    entity.coordinate,
                    target.coordinate
                );

            if (
                distanceKm >
                this.config
                    .maximumCandidateDistanceKm
            ) {
                return {
                    accepted:
                        false,

                    reason:
                        "OUT_OF_DISTANCE_RANGE"
                };
            }

            const targetBearing =
                bearingBetween(
                    entity.coordinate,
                    target.coordinate
                );

            const approachAngleDeg =
                angularDifference(
                    entity.bearing,
                    targetBearing
                );

            const validSpeed =
                entity.speedKmh !==
                    null &&
                entity.speedKmh >=
                    this.config
                        .minimumSpeedKmh &&
                entity.speedKmh <=
                    this.config
                        .maximumSpeedKmh;

            const directionKnown =
                approachAngleDeg !==
                null;

            const approaching =
                directionKnown
                    ? approachAngleDeg <=
                        this.config
                            .maximumApproachAngleDeg
                    : null;

            let arrivalMinutes =
                null;

            if (
                validSpeed &&
                approaching ===
                    true
            ) {
                arrivalMinutes =
                    (
                        distanceKm /
                        entity.speedKmh
                    ) *
                    60;

                if (
                    Number.isFinite(
                        arrivalMinutes
                    )
                ) {
                    arrivalMinutes =
                        Math.max(
                            0,
                            arrivalMinutes
                        );

                    this.statistics
                        .etaEstimated +=
                        1;
                } else {
                    arrivalMinutes =
                        null;
                }
            }

            const distanceScore =
                clamp(
                    100 -
                    (
                        distanceKm /
                        this.config
                            .maximumCandidateDistanceKm
                    ) *
                    100,
                    0,
                    100
                );

            const directionScore =
                approachAngleDeg ===
                    null
                    ? 35
                    : clamp(
                        100 -
                        (
                            approachAngleDeg /
                            180
                        ) *
                        100,
                        0,
                        100
                    );

            const speedScore =
                validSpeed
                    ? clamp(
                        (
                            entity.speedKmh /
                            80
                        ) *
                        100,
                        10,
                        100
                    )
                    : 10;

            const confidenceScore =
                clamp(
                    entity.confidence <=
                        1
                        ? entity.confidence *
                            100
                        : entity.confidence,
                    0,
                    100
                );

            const intensityScore =
                entity.intensity ===
                    null
                    ? 30
                    : clamp(
                        entity.intensity,
                        0,
                        100
                    );

            const score =
                distanceScore *
                    0.30 +
                directionScore *
                    0.30 +
                speedScore *
                    0.15 +
                confidenceScore *
                    0.15 +
                intensityScore *
                    0.10;

            const reasons =
                [];

            if (!validSpeed) {
                reasons.push(
                    "NO_VALID_SPEED"
                );
            }

            if (
                approachAngleDeg ===
                null
            ) {
                reasons.push(
                    "NO_VALID_BEARING"
                );
            } else if (
                approaching ===
                false
            ) {
                reasons.push(
                    "NOT_APPROACHING_TARGET"
                );
            }

            if (
                entity.confidence <
                this.config
                    .minimumConfidence
            ) {
                reasons.push(
                    "LOW_CONFIDENCE"
                );
            }

            return {
                accepted:
                    true,

                candidate: {
                    candidateId:
                        `ARRIVAL-${entity.identity}`,

                    trackId:
                        entity.trackId,

                    canonicalTrackId:
                        entity
                            .canonicalTrackId,

                    cellId:
                        entity.cellId,

                    sourceCoordinate:
                        cloneValue(
                            entity.coordinate
                        ),

                    targetCoordinate:
                        cloneValue(
                            target.coordinate
                        ),

                    targetCity:
                        target.city,

                    distanceKm,

                    targetBearing,

                    stormBearing:
                        entity.bearing,

                    approachAngleDeg,

                    approaching,

                    speedKmh:
                        entity.speedKmh,

                    motionMethod:
                        entity.motionMethod,

                    arrivalMinutes,

                    eta:
                        arrivalMinutes ===
                            null
                            ? null
                            : new Date(
                                now() +
                                arrivalMinutes *
                                60000
                            )
                                .toISOString(),

                    confidence:
                        entity.confidence,

                    intensity:
                        entity.intensity,

                    candidateScore:
                        Number(
                            score.toFixed(
                                2
                            )
                        ),

                    eligibility:
                        arrivalMinutes !==
                            null
                            ? "ETA_READY"
                            : "MOTION_INCOMPLETE",

                    rejectionReasons:
                        reasons,

                    source:
                        entity.source,

                    city:
                        entity.city,

                    region:
                        entity.region,

                    generatedAt:
                        now(),

                    rawEntity:
                        entity.rawEntity
                }
            };
        }

        build() {
            this.statistics
                .builds += 1;

            const startedAt =
                now();

            const target =
                this.resolveTarget();

            if (!target) {
                return this.fail(
                    "TARGET_COORDINATE_UNAVAILABLE",
                    startedAt
                );
            }

            const sourceEntities =
                this.getSourceEntities();

            this.statistics
                .sourceEntities +=
                sourceEntities.length;

            const normalized =
                sourceEntities
                    .map(
                        (
                            entity,
                            index
                        ) =>
                            this.normalizeEntity(
                                entity,
                                index
                            )
                    )
                    .filter(Boolean);

            this.statistics
                .normalized +=
                normalized.length;

            const unique =
                new Map();

            normalized.forEach(
                entity => {
                    if (
                        unique.has(
                            entity.identity
                        )
                    ) {
                        this.statistics
                            .duplicates +=
                            1;

                        return;
                    }

                    unique.set(
                        entity.identity,
                        entity
                    );
                }
            );

            const candidates =
                [];

            const rejected =
                [];

            Array.from(
                unique.values()
            ).forEach(
                entity => {
                    const result =
                        this.buildCandidate(
                            entity,
                            target
                        );

                    if (
                        result.accepted
                    ) {
                        candidates.push(
                            result.candidate
                        );
                    } else {
                        rejected.push({
                            identity:
                                entity.identity,

                            reason:
                                result.reason
                        });
                    }
                }
            );

            candidates.sort(
                (
                    first,
                    second
                ) =>
                    second
                        .candidateScore -
                    first
                        .candidateScore
            );

            this.candidates =
                candidates.slice(
                    0,
                    this.config
                        .maximumCandidates
                );

            this.statistics
                .accepted +=
                this.candidates
                    .length;

            this.statistics
                .rejected +=
                rejected.length;

            global.RainArrivalCandidates =
                cloneValue(
                    this.candidates
                );

            global.RainGuardAI =
                global.RainGuardAI || {};

            global.RainGuardAI.V32 =
                global.RainGuardAI.V32 || {};

            global.RainGuardAI.V32
                .rainArrivalCandidates =
                cloneValue(
                    this.candidates
                );

            global.RainGuardAI.V32
                .finalArrivalCandidateState = {
                    version:
                        this.version,

                    build:
                        this.build,

                    target:
                        cloneValue(
                            target
                        ),

                    candidates:
                        cloneValue(
                            this.candidates
                        ),

                    updatedAt:
                        now()
                };

            const etaReadyCount =
                this.candidates
                    .filter(
                        candidate =>
                            candidate
                                .arrivalMinutes !==
                            null
                    )
                    .length;

            const result = {
                success:
                    true,

                status:
                    this.candidates
                        .length > 0
                        ? "ARRIVAL_CANDIDATES_BUILT"
                        : "NO_ARRIVAL_CANDIDATES",

                version:
                    this.version,

                build:
                    this.build,

                target:
                    cloneValue(
                        target
                    ),

                sourceCount:
                    sourceEntities.length,

                normalizedCount:
                    normalized.length,

                candidateCount:
                    this.candidates
                        .length,

                etaReadyCount,

                rejectedCount:
                    rejected.length,

                topCandidate:
                    cloneValue(
                        this.candidates[0] ??
                        null
                    ),

                candidates:
                    cloneValue(
                        this.candidates
                    ),

                startedAt,

                completedAt:
                    now(),

                durationMs:
                    now() -
                    startedAt
            };

            this.lastResult =
                cloneValue(result);

            if (
                this.config.debug
            ) {
                console.log(
                    "[RainArrival FinalArrivalCandidateBuilder] Build result:",
                    result
                );
            }

            global.dispatchEvent?.(
                new CustomEvent(
                    "rainarrival:candidates-updated",
                    {
                        detail:
                            cloneValue(
                                result
                            )
                    }
                )
            );

            return result;
        }

        fail(
            reason,
            startedAt
        ) {
            this.statistics
                .failures += 1;

            const result = {
                success:
                    false,

                status:
                    "ARRIVAL_CANDIDATE_BUILD_FAILED",

                reason,

                version:
                    this.version,

                build:
                    this.build,

                startedAt,

                completedAt:
                    now(),

                durationMs:
                    now() -
                    startedAt
            };

            this.lastResult =
                cloneValue(result);

            return result;
        }

        getAll() {
            return cloneValue(
                this.candidates
            );
        }

        getTopCandidate() {
            return cloneValue(
                this.candidates[0] ??
                null
            );
        }

        printTable() {
            const rows =
                this.candidates
                    .map(
                        (
                            candidate,
                            index
                        ) => ({
                            index,

                            candidateId:
                                candidate
                                    .candidateId,

                            trackId:
                                candidate
                                    .trackId,

                            distanceKm:
                                Number(
                                    candidate
                                        .distanceKm
                                        .toFixed(
                                            2
                                        )
                                ),

                            speedKmh:
                                candidate
                                    .speedKmh,

                            bearing:
                                candidate
                                    .stormBearing,

                            targetBearing:
                                candidate
                                    .targetBearing,

                            approachAngle:
                                candidate
                                    .approachAngleDeg,

                            approaching:
                                candidate
                                    .approaching,

                            arrivalMinutes:
                                candidate
                                    .arrivalMinutes,

                            score:
                                candidate
                                    .candidateScore,

                            eligibility:
                                candidate
                                    .eligibility,

                            reasons:
                                candidate
                                    .rejectionReasons
                                    .join(",")
                        })
                    );

            console.table(rows);
            return rows;
        }

        start() {
            if (this.running) {
                return {
                    success:
                        true,

                    alreadyRunning:
                        true
                };
            }

            this.running =
                true;

            this.build();

            this.timer =
                global.setInterval(
                    () => {
                        this.build();
                    },
                    this.config
                        .buildIntervalMs
                );

            return {
                success:
                    true,

                running:
                    true,

                intervalMs:
                    this.config
                        .buildIntervalMs
            };
        }

        stop() {
            if (this.timer) {
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
                    this.build,

                installed:
                    true,

                running:
                    this.running,

                sourceCount:
                    this.getSourceEntities()
                        .length,

                candidateCount:
                    this.candidates
                        .length,

                etaReadyCount:
                    this.candidates
                        .filter(
                            candidate =>
                                candidate
                                    .arrivalMinutes !==
                                null
                        )
                        .length,

                target:
                    cloneValue(
                        this.resolveTarget()
                    ),

                topCandidate:
                    this.getTopCandidate(),

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
                    )
            };
        }

        diagnose() {
            const diagnostics =
                this.getDiagnostics();

            console.log(
                "[RainArrival FinalArrivalCandidateBuilder]",
                diagnostics
            );

            return diagnostics;
        }
    }

    const builder =
        new FinalArrivalCandidateBuilder();

    global.RainArrivalFinalCandidateBuilderV32 =
        builder;

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
        .finalArrivalCandidateBuilder =
        builder;

    global.RainArrivalEngineV32
        ?.register?.(
            MODULE_NAME,
            builder
        );

    global.RainArrivalOrchestratorV32
        ?.register?.(
            MODULE_NAME,
            builder
        );

    global.buildFinalRainArrivalCandidates =
        () =>
            builder.build();

    if (
        builder.config
            .autoStart
    ) {
        builder.start();
    }

    console.log(
        "[RainGuard AI V32] Final Arrival Candidate Builder loaded.",
        {
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
