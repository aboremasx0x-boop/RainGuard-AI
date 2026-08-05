/*
===========================================================
 RainGuard AI V32
 Phase 38M-9
 Arrival Candidate Engine

 Responsibilities:
 - Build arrival candidates from Track Store
 - Merge Replay and Motion evidence
 - Validate physical usability
 - Score and rank candidates
 - Select the best candidate
 - Publish candidate results to Cache and Runtime
===========================================================
*/

(function (global) {
    "use strict";

    const MODULE_NAME =
        "candidateEngine";

    const VERSION =
        "32.38M.9";

    const BUILD =
        "rainguard-v32-phase38m-arrival-candidate-engine";

    const DEFAULT_CONFIG =
        Object.freeze({
            minimumConfidence: 10,

            preferredConfidence: 60,

            minimumSpeedKmh: 0.2,

            maximumSpeedKmh: 180,

            maximumDistanceKm: 500,

            maximumArrivalMinutes: 720,

            maximumBearingDifference: 120,

            strictBearingDifference: 45,

            balancedBearingDifference: 75,

            guardedBearingDifference: 110,

            minimumSelectionScore: 15,

            preferredSelectionScore: 60,

            candidateTtlMs:
                6 * 60 * 60 * 1000,

            allowStationaryCandidates:
                false,

            allowLowConfidence:
                true,

            publishToRuntime:
                true
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

    function clamp(
        value,
        minimum,
        maximum
    ) {
        const number =
            toFiniteNumber(
                value,
                minimum
            );

        return Math.min(
            maximum,
            Math.max(
                minimum,
                number
            )
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
                return structuredClone(
                    value
                );
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

    function resolveUtils() {
        return (
            global.RainArrivalUtilsV32 ||
            global.RainGuardAI
                ?.V32
                ?.rainArrivalModules
                ?.utils ||
            null
        );
    }

    function normalizeCoordinate(value) {
        const utils =
            resolveUtils();

        if (
            utils &&
            typeof utils
                .normalizeCoordinate ===
                "function"
        ) {
            return utils
                .normalizeCoordinate(
                    value
                );
        }

        if (!value) {
            return null;
        }

        const lat =
            Number(
                value.lat ??
                value.latitude
            );

        const lon =
            Number(
                value.lon ??
                value.lng ??
                value.longitude
            );

        if (
            !Number.isFinite(lat) ||
            !Number.isFinite(lon) ||
            lat < -90 ||
            lat > 90 ||
            lon < -180 ||
            lon > 180
        ) {
            return null;
        }

        return {
            lat,
            lon
        };
    }

    function calculateDistanceKm(
        coordinateA,
        coordinateB
    ) {
        const utils =
            resolveUtils();

        if (
            utils &&
            typeof utils
                .calculateDistanceKm ===
                "function"
        ) {
            return utils
                .calculateDistanceKm(
                    coordinateA,
                    coordinateB
                );
        }

        return null;
    }

    function calculateBearing(
        coordinateA,
        coordinateB
    ) {
        const utils =
            resolveUtils();

        if (
            utils &&
            typeof utils
                .calculateBearing ===
                "function"
        ) {
            return utils
                .calculateBearing(
                    coordinateA,
                    coordinateB
                );
        }

        return null;
    }

    function calculateAngularDifference(
        bearingA,
        bearingB
    ) {
        const utils =
            resolveUtils();

        if (
            utils &&
            typeof utils
                .calculateAngularDifference ===
                "function"
        ) {
            return utils
                .calculateAngularDifference(
                    bearingA,
                    bearingB
                );
        }

        if (
            !isFiniteNumber(bearingA) ||
            !isFiniteNumber(bearingB)
        ) {
            return null;
        }

        return Math.abs(
            (
                (
                    bearingB -
                    bearingA +
                    540
                ) % 360
            ) -
            180
        );
    }

    function calculateArrivalMinutes(
        distanceKm,
        speedKmh
    ) {
        const utils =
            resolveUtils();

        if (
            utils &&
            typeof utils
                .calculateArrivalMinutes ===
                "function"
        ) {
            return utils
                .calculateArrivalMinutes(
                    distanceKm,
                    speedKmh
                );
        }

        if (
            !isFiniteNumber(distanceKm) ||
            !isFiniteNumber(speedKmh) ||
            speedKmh <= 0
        ) {
            return null;
        }

        return (
            distanceKm /
            speedKmh *
            60
        );
    }

    class RainArrivalCandidateEngine {

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

            this.candidates =
                new Map();

            this.rankings =
                [];

            this.selectedCandidate =
                null;

            this.lastResult =
                null;

            this.history =
                [];

            this.statistics = {
                runs:
                    0,

                candidatesBuilt:
                    0,

                candidatesAccepted:
                    0,

                candidatesRejected:
                    0,

                strictSelections:
                    0,

                balancedSelections:
                    0,

                guardedSelections:
                    0,

                noSelection:
                    0
            };

            this.lastError =
                null;

            this.createdAt =
                now();

            this.updatedAt =
                this.createdAt;
        }

        getTrackStore() {
            return (
                global
                    .RainArrivalTrackStoreV32 ||
                global
                    .RainGuardAI
                    ?.V32
                    ?.rainArrivalModules
                    ?.trackStore ||
                null
            );
        }

        getReplayEngine() {
            return (
                global
                    .RainArrivalReplayEngineV32 ||
                global
                    .RainGuardAI
                    ?.V32
                    ?.rainArrivalModules
                    ?.replayEngine ||
                null
            );
        }

        getMotionEngine() {
            return (
                global
                    .RainArrivalMotionEngineV32 ||
                global
                    .RainGuardAI
                    ?.V32
                    ?.rainArrivalModules
                    ?.motionEngine ||
                null
            );
        }

        getCache() {
            return (
                global
                    .RainArrivalCacheV32 ||
                global
                    .RainGuardAI
                    ?.V32
                    ?.rainArrivalModules
                    ?.cache ||
                null
            );
        }

        resolveTargetCoordinate(
            context = {}
        ) {
            return normalizeCoordinate(
                context.targetCoordinate ??
                context.coordinate ??
                context.targetLocation ??
                context.cityCoordinate ??
                global.RainGuardAI
                    ?.V32
                    ?.rainArrivalPrediction
                    ?.targetCoordinate ??
                null
            );
        }

        resolveTrackCoordinate(
            track,
            replay,
            motion
        ) {
            return normalizeCoordinate(
                motion?.currentCoordinate ??
                replay?.currentCoordinate ??
                replay
                    ?.reconstruction
                    ?.currentCoordinate ??
                track?.currentPoint
                    ?.coordinate ??
                track?.currentPoint ??
                track?.points?.[
                    track.points.length - 1
                ] ??
                null
            );
        }

        resolveMotionEvidence(
            trackId,
            track
        ) {
            const replayEngine =
                this.getReplayEngine();

            const motionEngine =
                this.getMotionEngine();

            let replay =
                replayEngine
                    ?.getReplay?.(
                        trackId
                    ) ??
                null;

            if (
                !replay &&
                replayEngine
                    ?.replay
            ) {
                replay =
                    replayEngine.replay(
                        track,
                        {
                            force: false,
                            runMotionEngine:
                                true
                        }
                    );
            }

            let motion =
                motionEngine
                    ?.getMotionState?.(
                        trackId
                    ) ??
                replay?.motionResult ??
                null;

            if (
                !motion &&
                motionEngine
                    ?.analyze
            ) {
                motion =
                    motionEngine.analyze(
                        track
                    );
            }

            return {
                replay,
                motion
            };
        }

        buildCandidate(
            track,
            context = {}
        ) {
            if (!track) {
                return null;
            }

            const trackId =
                normalizeText(
                    track.trackId ??
                    track.canonicalTrackId
                );

            if (!trackId) {
                return null;
            }

            const {
                replay,
                motion
            } =
                this.resolveMotionEvidence(
                    trackId,
                    track
                );

            const targetCoordinate =
                this.resolveTargetCoordinate(
                    context
                );

            const currentCoordinate =
                this.resolveTrackCoordinate(
                    track,
                    replay,
                    motion
                );

            const speedKmh =
                toFiniteNumber(
                    motion?.speedKmh ??
                    motion
                        ?.effectiveSpeedKmh ??
                    replay?.speedKmh ??
                    replay
                        ?.effectiveSpeedKmh ??
                    replay
                        ?.reconstruction
                        ?.speedKmh,
                    null
                );

            const bearing =
                toFiniteNumber(
                    motion?.bearing ??
                    replay?.bearing ??
                    replay
                        ?.reconstruction
                        ?.bearing,
                    null
                );

            const confidence =
                clamp(
                    toFiniteNumber(
                        motion?.confidence ??
                        replay?.confidence ??
                        replay
                            ?.reconstruction
                            ?.confidence ??
                        track.confidence,
                        0
                    ),
                    0,
                    100
                );

            const distanceKm =
                targetCoordinate &&
                currentCoordinate
                    ? calculateDistanceKm(
                        currentCoordinate,
                        targetCoordinate
                    )
                    : null;

            const targetBearing =
                targetCoordinate &&
                currentCoordinate
                    ? calculateBearing(
                        currentCoordinate,
                        targetCoordinate
                    )
                    : null;

            const bearingDifference =
                isFiniteNumber(
                    bearing
                ) &&
                isFiniteNumber(
                    targetBearing
                )
                    ? calculateAngularDifference(
                        bearing,
                        targetBearing
                    )
                    : null;

            const arrivalMinutes =
                isFiniteNumber(
                    distanceKm
                ) &&
                isFiniteNumber(
                    speedKmh
                )
                    ? calculateArrivalMinutes(
                        distanceKm,
                        speedKmh
                    )
                    : null;

            const rejectionReasons =
                [];

            if (!targetCoordinate) {
                rejectionReasons.push(
                    "TARGET_COORDINATE_MISSING"
                );
            }

            if (!currentCoordinate) {
                rejectionReasons.push(
                    "TRACK_COORDINATE_MISSING"
                );
            }

            if (
                !isFiniteNumber(
                    distanceKm
                )
            ) {
                rejectionReasons.push(
                    "DISTANCE_UNAVAILABLE"
                );
            } else if (
                distanceKm >
                this.config
                    .maximumDistanceKm
            ) {
                rejectionReasons.push(
                    "OUT_OF_RANGE"
                );
            }

            if (
                !isFiniteNumber(
                    speedKmh
                )
            ) {
                rejectionReasons.push(
                    "SPEED_UNAVAILABLE"
                );
            } else if (
                speedKmh <
                this.config
                    .minimumSpeedKmh
            ) {
                rejectionReasons.push(
                    "ZERO_OR_LOW_SPEED"
                );
            } else if (
                speedKmh >
                this.config
                    .maximumSpeedKmh
            ) {
                rejectionReasons.push(
                    "SPEED_OUT_OF_RANGE"
                );
            }

            if (
                !isFiniteNumber(
                    bearing
                )
            ) {
                rejectionReasons.push(
                    "BEARING_UNAVAILABLE"
                );
            }

            if (
                isFiniteNumber(
                    bearingDifference
                ) &&
                bearingDifference >
                this.config
                    .maximumBearingDifference
            ) {
                rejectionReasons.push(
                    "MOVING_AWAY"
                );
            }

            if (
                !isFiniteNumber(
                    arrivalMinutes
                )
            ) {
                rejectionReasons.push(
                    "ETA_UNAVAILABLE"
                );
            } else if (
                arrivalMinutes >
                this.config
                    .maximumArrivalMinutes
            ) {
                rejectionReasons.push(
                    "ETA_OUT_OF_RANGE"
                );
            }

            if (
                confidence <
                this.config
                    .minimumConfidence &&
                !this.config
                    .allowLowConfidence
            ) {
                rejectionReasons.push(
                    "LOW_CONFIDENCE"
                );
            }

            const stationary =
                Boolean(
                    motion?.stationary ??
                    replay?.stationary
                );

            if (
                stationary &&
                !this.config
                    .allowStationaryCandidates
            ) {
                rejectionReasons.push(
                    "STATIONARY_TRACK"
                );
            }

            const score =
                this.calculateScore({
                    distanceKm,
                    speedKmh,
                    bearingDifference,
                    arrivalMinutes,
                    confidence,
                    replay,
                    motion
                });

            const selectionMode =
                this.resolveSelectionMode(
                    bearingDifference,
                    confidence,
                    score
                );

            const physicallyUsable =
                rejectionReasons.every(
                    reason =>
                        ![
                            "TARGET_COORDINATE_MISSING",
                            "TRACK_COORDINATE_MISSING",
                            "DISTANCE_UNAVAILABLE",
                            "SPEED_UNAVAILABLE",
                            "ZERO_OR_LOW_SPEED",
                            "SPEED_OUT_OF_RANGE",
                            "BEARING_UNAVAILABLE",
                            "MOVING_AWAY",
                            "ETA_UNAVAILABLE",
                            "ETA_OUT_OF_RANGE",
                            "STATIONARY_TRACK"
                        ].includes(reason)
                );

            const accepted =
                physicallyUsable &&
                score >=
                    this.config
                        .minimumSelectionScore;

            return {
                candidateId:
                    [
                        "CANDIDATE",
                        trackId,
                        now()
                    ].join("-"),

                trackId,

                canonicalTrackId:
                    track.canonicalTrackId ??
                    trackId,

                cellId:
                    track.cellId ??
                    null,

                city:
                    track.city ??
                    context.city ??
                    null,

                region:
                    track.region ??
                    null,

                source:
                    track.source ??
                    null,

                targetCoordinate:
                    cloneValue(
                        targetCoordinate
                    ),

                currentCoordinate:
                    cloneValue(
                        currentCoordinate
                    ),

                distanceKm,

                speedKmh,

                effectiveSpeedKmh:
                    speedKmh,

                motionBearing:
                    bearing,

                targetBearing,

                bearingDifference,

                arrivalMinutes,

                eta:
                    isFiniteNumber(
                        arrivalMinutes
                    )
                        ? new Date(
                            now() +
                            arrivalMinutes *
                            60000
                        ).toISOString()
                        : null,

                confidence,

                score,

                selectionScore:
                    score,

                selectionMode,

                physicallyUsable,

                accepted,

                rejectionReasons,

                replayAvailable:
                    Boolean(replay),

                motionAvailable:
                    Boolean(motion),

                replay:
                    cloneValue(
                        replay
                    ),

                motion:
                    cloneValue(
                        motion
                    ),

                generatedAt:
                    now()
            };
        }

        calculateScore({
            distanceKm,
            speedKmh,
            bearingDifference,
            arrivalMinutes,
            confidence,
            replay,
            motion
        }) {
            let score = 0;

            score +=
                clamp(
                    confidence,
                    0,
                    100
                ) * 0.35;

            if (
                isFiniteNumber(
                    bearingDifference
                )
            ) {
                score +=
                    clamp(
                        100 -
                        (
                            bearingDifference /
                            180
                        ) *
                        100,
                        0,
                        100
                    ) * 0.25;
            }

            if (
                isFiniteNumber(
                    distanceKm
                )
            ) {
                score +=
                    clamp(
                        100 -
                        (
                            distanceKm /
                            this.config
                                .maximumDistanceKm
                        ) *
                        100,
                        0,
                        100
                    ) * 0.15;
            }

            if (
                isFiniteNumber(
                    arrivalMinutes
                )
            ) {
                score +=
                    clamp(
                        100 -
                        (
                            arrivalMinutes /
                            this.config
                                .maximumArrivalMinutes
                        ) *
                        100,
                        0,
                        100
                    ) * 0.15;
            }

            if (
                isFiniteNumber(
                    speedKmh
                )
            ) {
                score +=
                    clamp(
                        speedKmh /
                        80 *
                        100,
                        0,
                        100
                    ) * 0.05;
            }

            if (
                replay?.success
            ) {
                score += 2.5;
            }

            if (
                motion?.success
            ) {
                score += 2.5;
            }

            return Number(
                clamp(
                    score,
                    0,
                    100
                ).toFixed(2)
            );
        }

        resolveSelectionMode(
            bearingDifference,
            confidence,
            score
        ) {
            if (
                isFiniteNumber(
                    bearingDifference
                ) &&
                bearingDifference <=
                    this.config
                        .strictBearingDifference &&
                confidence >= 60 &&
                score >= 60
            ) {
                return "strict";
            }

            if (
                isFiniteNumber(
                    bearingDifference
                ) &&
                bearingDifference <=
                    this.config
                        .balancedBearingDifference &&
                confidence >= 30 &&
                score >= 35
            ) {
                return "balanced";
            }

            if (
                isFiniteNumber(
                    bearingDifference
                ) &&
                bearingDifference <=
                    this.config
                        .guardedBearingDifference &&
                score >=
                    this.config
                        .minimumSelectionScore
            ) {
                return "guarded";
            }

            return "rejected";
        }

        run(context = {}) {
            this.statistics.runs += 1;

            const trackStore =
                this.getTrackStore();

            if (
                !trackStore ||
                typeof trackStore
                    .getAll !==
                    "function"
            ) {
                return this.fail(
                    "TRACK_STORE_UNAVAILABLE"
                );
            }

            const tracks =
                trackStore.getAll();

            const candidates =
                tracks
                    .map(
                        track =>
                            this.buildCandidate(
                                track,
                                context
                            )
                    )
                    .filter(Boolean);

            candidates.sort(
                (a, b) =>
                    b.score -
                    a.score
            );

            this.candidates.clear();

            candidates.forEach(
                candidate => {
                    this.candidates.set(
                        candidate.trackId,
                        cloneValue(
                            candidate
                        )
                    );

                    this.saveCandidate(
                        candidate
                    );
                }
            );

            const accepted =
                candidates.filter(
                    candidate =>
                        candidate.accepted
                );

            const selected =
                accepted[0] ??
                null;

            this.rankings =
                cloneValue(
                    candidates
                );

            this.selectedCandidate =
                cloneValue(
                    selected
                );

            this.statistics
                .candidatesBuilt +=
                candidates.length;

            this.statistics
                .candidatesAccepted +=
                accepted.length;

            this.statistics
                .candidatesRejected +=
                (
                    candidates.length -
                    accepted.length
                );

            if (selected) {
                if (
                    selected.selectionMode ===
                    "strict"
                ) {
                    this.statistics
                        .strictSelections += 1;
                }

                if (
                    selected.selectionMode ===
                    "balanced"
                ) {
                    this.statistics
                        .balancedSelections += 1;
                }

                if (
                    selected.selectionMode ===
                    "guarded"
                ) {
                    this.statistics
                        .guardedSelections += 1;
                }
            } else {
                this.statistics
                    .noSelection += 1;
            }

            const result = {
                success:
                    Boolean(selected),

                status:
                    selected
                        ? (
                            selected
                                .confidence >= 50
                                ? "RAIN_ARRIVAL_AVAILABLE"
                                : "LOW_CONFIDENCE_RAIN_ARRIVAL_AVAILABLE"
                        )
                        : "RAIN_ARRIVAL_UNAVAILABLE",

                reason:
                    selected
                        ? "ARRIVAL_CANDIDATE_SELECTED"
                        : "NO_VALID_ARRIVAL_CANDIDATE",

                version:
                    this.version,

                build:
                    this.build,

                candidateCount:
                    candidates.length,

                acceptedCount:
                    accepted.length,

                rejectedCount:
                    candidates.length -
                    accepted.length,

                selectedCandidate:
                    cloneValue(
                        selected
                    ),

                rankedCandidates:
                    cloneValue(
                        candidates
                    ),

                generatedAt:
                    now()
            };

            this.lastResult =
                cloneValue(result);

            this.updatedAt =
                now();

            this.publishToRuntime(
                result
            );

            this.recordHistory(
                result
            );

            return result;
        }

        saveCandidate(candidate) {
            const cache =
                this.getCache();

            if (
                cache &&
                typeof cache
                    .setCandidate ===
                    "function"
            ) {
                cache.setCandidate(
                    candidate.trackId,
                    cloneValue(
                        candidate
                    ),
                    {
                        ttlMs:
                            this.config
                                .candidateTtlMs,

                        metadata: {
                            module:
                                MODULE_NAME,

                            score:
                                candidate.score,

                            accepted:
                                candidate.accepted
                        }
                    }
                );
            }

            return true;
        }

        getCandidate(trackId) {
            const local =
                this.candidates.get(
                    trackId
                );

            if (local) {
                return cloneValue(
                    local
                );
            }

            const cache =
                this.getCache();

            return (
                cache
                    ?.getCandidate?.(
                        trackId
                    ) ??
                null
            );
        }

        getSelectedCandidate() {
            return cloneValue(
                this.selectedCandidate
            );
        }

        getRankedCandidates() {
            return cloneValue(
                this.rankings
            );
        }

        publishToRuntime(result) {
            if (
                !this.config
                    .publishToRuntime
            ) {
                return false;
            }

            const runtimeEngine =
                global.RainGuardAI
                    ?.V32
                    ?.rainArrivalPrediction;

            if (!runtimeEngine) {
                return false;
            }

            runtimeEngine
                .arrivalCandidates =
                new Map(
                    result
                        .rankedCandidates
                        .map(
                            candidate => [
                                candidate
                                    .trackId,
                                cloneValue(
                                    candidate
                                )
                            ]
                        )
                );

            runtimeEngine
                .selectedArrivalEvidence =
                cloneValue(
                    result
                        .selectedCandidate
                );

            runtimeEngine
                .latestCandidateSelection =
                cloneValue(result);

            if (
                result.selectedCandidate
            ) {
                runtimeEngine
                    .lastArrivalResult = {
                        status:
                            result.status,

                        arrivalMinutes:
                            result
                                .selectedCandidate
                                .arrivalMinutes,

                        eta:
                            result
                                .selectedCandidate
                                .eta,

                        confidence:
                            result
                                .selectedCandidate
                                .confidence,

                        trackId:
                            result
                                .selectedCandidate
                                .trackId,

                        selectionMode:
                            result
                                .selectedCandidate
                                .selectionMode,

                        generatedAt:
                            result
                                .generatedAt
                    };
            }

            return true;
        }

        recordHistory(result) {
            this.history.push({
                ...cloneValue(result),

                recordedAt:
                    now()
            });

            if (
                this.history.length >
                300
            ) {
                this.history.splice(
                    0,
                    this.history.length -
                    300
                );
            }
        }

        fail(reason) {
            const result = {
                success: false,

                status:
                    "RAIN_ARRIVAL_UNAVAILABLE",

                reason,

                version:
                    this.version,

                build:
                    this.build,

                candidateCount:
                    0,

                selectedCandidate:
                    null,

                rankedCandidates:
                    [],

                generatedAt:
                    now()
            };

            this.lastResult =
                cloneValue(result);

            this.recordHistory(
                result
            );

            return result;
        }

        clear() {
            this.candidates.clear();

            this.rankings = [];

            this.selectedCandidate =
                null;

            this.lastResult =
                null;

            this.updatedAt =
                now();

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

                installed:
                    true,

                trackStoreAvailable:
                    Boolean(
                        this.getTrackStore()
                    ),

                replayEngineAvailable:
                    Boolean(
                        this.getReplayEngine()
                    ),

                motionEngineAvailable:
                    Boolean(
                        this.getMotionEngine()
                    ),

                cacheAvailable:
                    Boolean(
                        this.getCache()
                    ),

                candidateCount:
                    this.candidates
                        .size,

                selectedCandidate:
                    cloneValue(
                        this.selectedCandidate
                    ),

                lastResult:
                    cloneValue(
                        this.lastResult
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
                "[RainArrival CandidateEngine]",
                diagnostics
            );

            return diagnostics;
        }

        printTable() {
            const rows =
                this.rankings.map(
                    candidate => ({
                        trackId:
                            candidate.trackId,

                        city:
                            candidate.city,

                        accepted:
                            candidate.accepted,

                        mode:
                            candidate.selectionMode,

                        score:
                            candidate.score,

                        confidence:
                            candidate.confidence,

                        distanceKm:
                            candidate.distanceKm,

                        speedKmh:
                            candidate.speedKmh,

                        bearingDifference:
                            candidate
                                .bearingDifference,

                        arrivalMinutes:
                            candidate
                                .arrivalMinutes,

                        rejectionReasons:
                            candidate
                                .rejectionReasons
                                .join(", ")
                    })
                );

            console.table(rows);

            return rows;
        }
    }

    const api =
        new RainArrivalCandidateEngine();

    global.RainArrivalCandidateEngineV32 =
        api;

    global.RainArrivalCandidateEngineClassV32 =
        RainArrivalCandidateEngine;

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
        .candidateEngine =
        api;

    if (
        global.RainArrivalEngineV32 &&
        typeof global
            .RainArrivalEngineV32
            .register ===
            "function"
    ) {
        global.RainArrivalEngineV32
            .register(
                MODULE_NAME,
                api
            );
    }

    if (
        global
            .RainArrivalOrchestratorV32 &&
        typeof global
            .RainArrivalOrchestratorV32
            .register ===
            "function"
    ) {
        global
            .RainArrivalOrchestratorV32
            .register(
                MODULE_NAME,
                api
            );
    }

    console.log(
        "[RainGuard AI V32] Arrival Candidate Engine loaded.",
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
