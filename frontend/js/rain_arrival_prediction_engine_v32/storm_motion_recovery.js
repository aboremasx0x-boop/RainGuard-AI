/*
===========================================================
 RainGuard AI V32
 Phase 38M-18B — Storm Motion Recovery Engine
 Version: 32.38M.18B

 Purpose:
 - Recover storm speed and bearing from historical coordinates.
 - Determine whether a storm is actually approaching the target.
 - Recalculate distance, approach angle and ETA.
 - Patch recovered evidence into candidates before scoring/decision.
 - Never invent motion when historical evidence is insufficient.
===========================================================
*/

(function (global) {
    "use strict";

    const MODULE_NAME = "stormMotionRecovery";
    const VERSION = "32.38M.18B";
    const BUILD_ID =
        "rainguard-v32-phase38m18b-storm-motion-recovery";

    const DEFAULT_CONFIG = Object.freeze({
        autoStart: true,
        recoveryIntervalMs: 7000,
        maximumCandidates: 500,
        minimumTrackPoints: 2,
        minimumTimeDeltaSeconds: 20,
        maximumTimeDeltaHours: 6,
        minimumMovementKm: 0.15,
        maximumPlausibleSpeedKmh: 180,
        maximumApproachAngleDeg: 85,
        minimumDistanceImprovementKm: 0.10,
        targetReachedDistanceKm: 2,
        debug: true
    });

    const EARTH_RADIUS_KM = 6371.0088;
    const now = () => Date.now();

    function cloneValue(value) {
        if (value === null || value === undefined) {
            return value;
        }

        if (typeof structuredClone === "function") {
            try {
                return structuredClone(value);
            } catch (_) {}
        }

        try {
            return JSON.parse(JSON.stringify(value));
        } catch (_) {
            return value;
        }
    }

    function toFiniteNumber(value, fallback = null) {
        const number = Number(value);
        return Number.isFinite(number) ? number : fallback;
    }

    function clamp(value, minimum, maximum) {
        return Math.max(minimum, Math.min(maximum, value));
    }

    function normalizeLongitudeDelta(value) {
        let delta = value;

        while (delta > 180) {
            delta -= 360;
        }

        while (delta < -180) {
            delta += 360;
        }

        return delta;
    }

    function normalizeBearing(value) {
        const number = toFiniteNumber(value, null);

        if (number === null) {
            return null;
        }

        return ((number % 360) + 360) % 360;
    }

    function angularDifference(first, second) {
        const firstBearing = normalizeBearing(first);
        const secondBearing = normalizeBearing(second);

        if (
            firstBearing === null ||
            secondBearing === null
        ) {
            return null;
        }

        return Math.abs(
            ((firstBearing - secondBearing + 540) % 360) - 180
        );
    }

    function toRadians(value) {
        return value * Math.PI / 180;
    }

    function toDegrees(value) {
        return value * 180 / Math.PI;
    }

    function normalizeCoordinate(value) {
        if (!value || typeof value !== "object") {
            return null;
        }

        const latitude = toFiniteNumber(
            value.latitude ??
            value.lat ??
            value.y,
            null
        );

        const longitude = toFiniteNumber(
            value.longitude ??
            value.lon ??
            value.lng ??
            value.x,
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

    function normalizeTimestamp(value) {
        if (value === null || value === undefined) {
            return null;
        }

        if (typeof value === "number") {
            if (!Number.isFinite(value)) {
                return null;
            }

            return value < 1e12
                ? value * 1000
                : value;
        }

        const parsed = Date.parse(value);
        return Number.isFinite(parsed) ? parsed : null;
    }

    function haversineDistanceKm(first, second) {
        const a = normalizeCoordinate(first);
        const b = normalizeCoordinate(second);

        if (!a || !b) {
            return null;
        }

        const lat1 = toRadians(a.latitude);
        const lat2 = toRadians(b.latitude);
        const deltaLat = toRadians(
            b.latitude - a.latitude
        );
        const deltaLon = toRadians(
            normalizeLongitudeDelta(
                b.longitude - a.longitude
            )
        );

        const sinLat = Math.sin(deltaLat / 2);
        const sinLon = Math.sin(deltaLon / 2);

        const haversine =
            sinLat * sinLat +
            Math.cos(lat1) *
            Math.cos(lat2) *
            sinLon * sinLon;

        return 2 *
            EARTH_RADIUS_KM *
            Math.asin(
                Math.min(
                    1,
                    Math.sqrt(haversine)
                )
            );
    }

    function calculateBearing(first, second) {
        const a = normalizeCoordinate(first);
        const b = normalizeCoordinate(second);

        if (!a || !b) {
            return null;
        }

        const lat1 = toRadians(a.latitude);
        const lat2 = toRadians(b.latitude);
        const deltaLon = toRadians(
            normalizeLongitudeDelta(
                b.longitude - a.longitude
            )
        );

        const y =
            Math.sin(deltaLon) *
            Math.cos(lat2);

        const x =
            Math.cos(lat1) *
            Math.sin(lat2) -
            Math.sin(lat1) *
            Math.cos(lat2) *
            Math.cos(deltaLon);

        return normalizeBearing(
            toDegrees(Math.atan2(y, x))
        );
    }

    function extractPoint(value) {
        if (!value || typeof value !== "object") {
            return null;
        }

        const coordinate =
            normalizeCoordinate(
                value.coordinate ??
                value.position ??
                value.location ??
                value.centroid ??
                value.center ??
                value
            );

        if (!coordinate) {
            return null;
        }

        const timestamp =
            normalizeTimestamp(
                value.timestamp ??
                value.time ??
                value.observedAt ??
                value.generatedAt ??
                value.updatedAt ??
                value.createdAt ??
                value.frameTime
            );

        return {
            coordinate,
            timestamp,
            source: value.source ?? null
        };
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
            return Array.from(value.values());
        }

        if (typeof value.values === "function") {
            try {
                return Array.from(value.values());
            } catch (_) {}
        }

        if (typeof value === "object") {
            return Object.values(value);
        }

        return [];
    }

    class StormMotionRecoveryEngine {
        constructor(config = {}) {
            this.version = VERSION;
            this.buildId = BUILD_ID;

            this.config = {
                ...DEFAULT_CONFIG,
                ...(config || {})
            };

            this.running = false;
            this.timer = null;
            this.latestResult = null;
            this.lastError = null;
            this.recoveredMap = new Map();

            this.statistics = {
                runs: 0,
                candidatesRead: 0,
                recovered: 0,
                insufficientHistory: 0,
                stationary: 0,
                implausibleSpeed: 0,
                approaching: 0,
                notApproaching: 0,
                failures: 0
            };
        }

        getCandidates() {
            const sources = [
                global.RainArrivalCandidateRepositoryV32
                    ?.getAll?.(),
                global.RainArrivalCandidates,
                global.RainArrivalCandidateStore,
                global.RainGuardAI?.V32
                    ?.rainArrivalCandidates
            ];

            for (const source of sources) {
                if (
                    Array.isArray(source) &&
                    source.length > 0
                ) {
                    return source.slice(
                        0,
                        this.config.maximumCandidates
                    );
                }
            }

            return [];
        }

        resolveTargetCoordinate(candidate) {
            const sources = [
                candidate?.targetCoordinate,
                candidate?.targetLocation,
                candidate?.cityCoordinate,
                candidate?.destinationCoordinate,
                candidate?.target,
                global.RainGuardAI?.V32
                    ?.targetCoordinate,
                global.RainArrivalEngineV32
                    ?.targetCoordinate
            ];

            for (const source of sources) {
                const coordinate =
                    normalizeCoordinate(source);

                if (coordinate) {
                    return coordinate;
                }
            }

            return null;
        }

        resolveCurrentCoordinate(candidate) {
            const sources = [
                candidate?.sourceCoordinate,
                candidate?.stormCoordinate,
                candidate?.currentCoordinate,
                candidate?.coordinate,
                candidate?.location,
                candidate?.centroid,
                candidate?.center
            ];

            for (const source of sources) {
                const coordinate =
                    normalizeCoordinate(source);

                if (coordinate) {
                    return coordinate;
                }
            }

            return null;
        }

        extractHistoryFromCandidate(candidate) {
            const sources = [
                candidate?.trackHistory,
                candidate?.history,
                candidate?.positions,
                candidate?.trackPoints,
                candidate?.replayPoints,
                candidate?.observations,
                candidate?.frames,
                candidate?.path
            ];

            const points = [];

            for (const source of sources) {
                for (const item of collectionToArray(source)) {
                    const point = extractPoint(item);

                    if (point) {
                        points.push(point);
                    }
                }
            }

            return points;
        }

        extractHistoryFromStores(candidate) {
            const identifiers = [
                candidate?.canonicalTrackId,
                candidate?.trackId,
                candidate?.cellId,
                candidate?.candidateId
            ].filter(Boolean);

            const stores = [
                global.RainArrivalTrackStoreV32,
                global.RainArrivalTrackStore,
                global.RainArrivalStormTrackStoreV32,
                global.RainArrivalStormTrackStoreBridgeV32,
                global.RainGuardAI?.V32
                    ?.rainArrivalModules
                    ?.trackStore,
                global.RainGuardAI?.V32
                    ?.rainArrivalModules
                    ?.stormTrackStoreBridge
            ].filter(Boolean);

            const results = [];

            for (const store of stores) {
                for (const id of identifiers) {
                    const attempts = [
                        () => store.getHistory?.(id),
                        () => store.getReplay?.(id),
                        () => store.getTrack?.(id),
                        () => store.getById?.(id),
                        () => store.get?.(id)
                    ];

                    for (const attempt of attempts) {
                        try {
                            const value = attempt();

                            if (!value) {
                                continue;
                            }

                            const nestedSources = [
                                value,
                                value.history,
                                value.points,
                                value.positions,
                                value.trackHistory,
                                value.replay
                            ];

                            for (const nested of nestedSources) {
                                for (
                                    const item
                                    of collectionToArray(nested)
                                ) {
                                    const point =
                                        extractPoint(item);

                                    if (point) {
                                        results.push(point);
                                    }
                                }
                            }
                        } catch (_) {}
                    }
                }
            }

            return results;
        }

        normalizeHistory(candidate) {
            const currentCoordinate =
                this.resolveCurrentCoordinate(candidate);

            const currentTimestamp =
                normalizeTimestamp(
                    candidate?.timestamp ??
                    candidate?.observedAt ??
                    candidate?.generatedAt ??
                    candidate?.updatedAt
                ) ?? now();

            const points = [
                ...this.extractHistoryFromCandidate(candidate),
                ...this.extractHistoryFromStores(candidate)
            ];

            if (currentCoordinate) {
                points.push({
                    coordinate: currentCoordinate,
                    timestamp: currentTimestamp,
                    source: "CURRENT_CANDIDATE"
                });
            }

            const unique = new Map();

            for (const point of points) {
                if (
                    !point?.coordinate ||
                    point.timestamp === null
                ) {
                    continue;
                }

                const key = [
                    point.timestamp,
                    point.coordinate.latitude.toFixed(5),
                    point.coordinate.longitude.toFixed(5)
                ].join(":");

                unique.set(key, point);
            }

            return Array.from(unique.values())
                .sort(
                    (first, second) =>
                        first.timestamp - second.timestamp
                );
        }

        recoverCandidate(candidate, index) {
            const targetCoordinate =
                this.resolveTargetCoordinate(candidate);

            const history =
                this.normalizeHistory(candidate);

            const baseResult = {
                candidateId:
                    candidate?.candidateId ??
                    `CANDIDATE-${index}`,

                trackId:
                    candidate?.trackId ??
                    candidate?.canonicalTrackId ??
                    null,

                recovered: false,
                approaching: false,
                speedKmh: null,
                stormBearing: null,
                targetBearing: null,
                approachAngleDeg: null,
                distanceKm: null,
                previousDistanceKm: null,
                distanceImprovementKm: null,
                arrivalMinutes: null,
                evidenceCount: history.length,
                reasons: [],
                generatedAt: now()
            };

            if (!targetCoordinate) {
                baseResult.reasons.push(
                    "TARGET_COORDINATE_UNAVAILABLE"
                );

                return baseResult;
            }

            if (
                history.length <
                this.config.minimumTrackPoints
            ) {
                baseResult.reasons.push(
                    "INSUFFICIENT_TRACK_HISTORY"
                );

                this.statistics.insufficientHistory += 1;

                return baseResult;
            }

            const first = history[history.length - 2];
            const second = history[history.length - 1];

            const deltaSeconds =
                (second.timestamp - first.timestamp) /
                1000;

            if (
                deltaSeconds <
                this.config.minimumTimeDeltaSeconds
            ) {
                baseResult.reasons.push(
                    "TRACK_TIME_DELTA_TOO_SMALL"
                );

                return baseResult;
            }

            if (
                deltaSeconds >
                this.config.maximumTimeDeltaHours * 3600
            ) {
                baseResult.reasons.push(
                    "TRACK_TIME_DELTA_TOO_LARGE"
                );

                return baseResult;
            }

            const movementKm =
                haversineDistanceKm(
                    first.coordinate,
                    second.coordinate
                );

            if (
                movementKm === null ||
                movementKm <
                this.config.minimumMovementKm
            ) {
                baseResult.reasons.push(
                    "INSUFFICIENT_STORM_MOVEMENT"
                );

                this.statistics.stationary += 1;

                return baseResult;
            }

            const speedKmh =
                movementKm /
                (deltaSeconds / 3600);

            if (
                !Number.isFinite(speedKmh) ||
                speedKmh >
                this.config.maximumPlausibleSpeedKmh
            ) {
                baseResult.reasons.push(
                    "IMPLAUSIBLE_RECOVERED_SPEED"
                );

                this.statistics.implausibleSpeed += 1;

                return baseResult;
            }

            const stormBearing =
                calculateBearing(
                    first.coordinate,
                    second.coordinate
                );

            const targetBearing =
                calculateBearing(
                    second.coordinate,
                    targetCoordinate
                );

            const approachAngleDeg =
                angularDifference(
                    stormBearing,
                    targetBearing
                );

            const previousDistanceKm =
                haversineDistanceKm(
                    first.coordinate,
                    targetCoordinate
                );

            const distanceKm =
                haversineDistanceKm(
                    second.coordinate,
                    targetCoordinate
                );

            const distanceImprovementKm =
                (
                    previousDistanceKm !== null &&
                    distanceKm !== null
                )
                    ? previousDistanceKm - distanceKm
                    : null;

            const targetReached =
                distanceKm !== null &&
                distanceKm <=
                    this.config.targetReachedDistanceKm;

            const approaching =
                !targetReached &&
                approachAngleDeg !== null &&
                approachAngleDeg <=
                    this.config.maximumApproachAngleDeg &&
                distanceImprovementKm !== null &&
                distanceImprovementKm >=
                    this.config.minimumDistanceImprovementKm;

            let arrivalMinutes = null;

            if (
                approaching &&
                distanceKm !== null &&
                speedKmh > 0
            ) {
                arrivalMinutes =
                    Math.round(
                        (distanceKm / speedKmh) * 60
                    );
            } else if (targetReached) {
                arrivalMinutes = 0;
            }

            const reasons = [];

            if (targetReached) {
                reasons.push("TARGET_ALREADY_REACHED");
            } else if (approaching) {
                reasons.push(
                    "HISTORICAL_MOTION_CONFIRMS_APPROACH"
                );
            } else {
                if (
                    approachAngleDeg !== null &&
                    approachAngleDeg >
                        this.config
                            .maximumApproachAngleDeg
                ) {
                    reasons.push(
                        "RECOVERED_DIRECTION_NOT_TOWARD_TARGET"
                    );
                }

                if (
                    distanceImprovementKm === null ||
                    distanceImprovementKm <
                        this.config
                            .minimumDistanceImprovementKm
                ) {
                    reasons.push(
                        "DISTANCE_NOT_DECREASING"
                    );
                }
            }

            return {
                ...baseResult,
                recovered: true,
                targetReached,
                approaching,
                speedKmh:
                    Number(speedKmh.toFixed(2)),
                stormBearing:
                    stormBearing === null
                        ? null
                        : Number(stormBearing.toFixed(2)),
                targetBearing:
                    targetBearing === null
                        ? null
                        : Number(targetBearing.toFixed(2)),
                approachAngleDeg:
                    approachAngleDeg === null
                        ? null
                        : Number(
                            approachAngleDeg.toFixed(2)
                        ),
                distanceKm:
                    distanceKm === null
                        ? null
                        : Number(distanceKm.toFixed(2)),
                previousDistanceKm:
                    previousDistanceKm === null
                        ? null
                        : Number(
                            previousDistanceKm.toFixed(2)
                        ),
                distanceImprovementKm:
                    distanceImprovementKm === null
                        ? null
                        : Number(
                            distanceImprovementKm.toFixed(2)
                        ),
                arrivalMinutes,
                movementKm:
                    Number(movementKm.toFixed(3)),
                deltaSeconds:
                    Number(deltaSeconds.toFixed(1)),
                reasons
            };
        }

        patchCandidates(candidates, recoveries) {
            const recoveryMap = new Map();

            for (const recovery of recoveries) {
                recoveryMap.set(
                    recovery.candidateId,
                    recovery
                );
            }

            const patched = candidates.map(
                (candidate, index) => {
                    const candidateId =
                        candidate?.candidateId ??
                        `CANDIDATE-${index}`;

                    const recovery =
                        recoveryMap.get(candidateId);

                    if (!recovery?.recovered) {
                        return cloneValue(candidate);
                    }

                    return {
                        ...cloneValue(candidate),

                        speedKmh:
                            recovery.speedKmh,

                        stormBearing:
                            recovery.stormBearing,

                        targetBearing:
                            recovery.targetBearing,

                        approachAngleDeg:
                            recovery.approachAngleDeg,

                        distanceKm:
                            recovery.distanceKm,

                        arrivalMinutes:
                            recovery.arrivalMinutes,

                        approaching:
                            recovery.approaching,

                        motionRecovered:
                            true,

                        motionRecoveryVersion:
                            this.version,

                        motionRecoveryEvidence:
                            cloneValue(recovery),

                        motionRecoveredAt:
                            now()
                    };
                }
            );

            global.RainArrivalCandidates =
                cloneValue(patched);

            global.RainArrivalCandidateStore =
                cloneValue(patched);

            if (
                global.RainGuardAI?.V32
            ) {
                global.RainGuardAI.V32
                    .rainArrivalCandidates =
                    cloneValue(patched);
            }

            const repository =
                global
                    .RainArrivalCandidateRepositoryV32;

            if (
                repository &&
                typeof repository.sync === "function"
            ) {
                repository.sync(
                    patched,
                    {
                        source:
                            "PHASE_38M_18B_MOTION_RECOVERY"
                    }
                );
            }

            return patched;
        }

        recoverAll() {
            const startedAt = now();
            this.statistics.runs += 1;

            try {
                const candidates =
                    this.getCandidates();

                this.statistics.candidatesRead +=
                    candidates.length;

                const recoveries =
                    candidates.map(
                        (candidate, index) =>
                            this.recoverCandidate(
                                candidate,
                                index
                            )
                    );

                for (const recovery of recoveries) {
                    this.recoveredMap.set(
                        recovery.candidateId,
                        cloneValue(recovery)
                    );

                    if (recovery.recovered) {
                        this.statistics.recovered += 1;
                    }

                    if (recovery.approaching) {
                        this.statistics.approaching += 1;
                    } else {
                        this.statistics.notApproaching += 1;
                    }
                }

                const patchedCandidates =
                    this.patchCandidates(
                        candidates,
                        recoveries
                    );

                const scoring =
                    global
                        .RainArrivalCandidateScoringV32;

                const scoringResult =
                    scoring &&
                    typeof scoring.scoreAll === "function"
                        ? scoring.scoreAll()
                        : null;

                const decision =
                    global
                        .RainArrivalDecisionEngineV32;

                const decisionResult =
                    decision &&
                    typeof decision.evaluate === "function"
                        ? decision.evaluate()
                        : null;

                const result = {
                    success: true,
                    status:
                        "STORM_MOTION_RECOVERY_COMPLETED",
                    version: this.version,
                    build: this.buildId,
                    inputCount:
                        candidates.length,
                    recoveredCount:
                        recoveries.filter(
                            item => item.recovered
                        ).length,
                    approachingCount:
                        recoveries.filter(
                            item => item.approaching
                        ).length,
                    patchedCount:
                        patchedCandidates.length,
                    recoveries:
                        cloneValue(recoveries),
                    scoringResult:
                        cloneValue(scoringResult),
                    decisionResult:
                        cloneValue(decisionResult),
                    startedAt,
                    completedAt: now(),
                    durationMs: now() - startedAt
                };

                this.latestResult =
                    cloneValue(result);

                global.RainArrivalMotionRecoveries =
                    cloneValue(recoveries);

                global.RainGuardAI =
                    global.RainGuardAI || {};

                global.RainGuardAI.V32 =
                    global.RainGuardAI.V32 || {};

                global.RainGuardAI.V32
                    .stormMotionRecoveryResult =
                    cloneValue(result);

                global.dispatchEvent?.(
                    new CustomEvent(
                        "rainarrival:storm-motion-recovered",
                        {
                            detail:
                                cloneValue(result)
                        }
                    )
                );

                if (this.config.debug) {
                    console.log(
                        "[RainArrival MotionRecovery] Recovery result:",
                        result
                    );
                }

                return result;
            } catch (error) {
                this.statistics.failures += 1;

                this.lastError = {
                    name:
                        error?.name ?? "Error",
                    message:
                        error?.message ??
                        String(error),
                    stack:
                        error?.stack ?? null,
                    timestamp: now()
                };

                const result = {
                    success: false,
                    status:
                        "STORM_MOTION_RECOVERY_FAILED",
                    version: this.version,
                    build: this.buildId,
                    error:
                        cloneValue(this.lastError),
                    startedAt,
                    completedAt: now(),
                    durationMs: now() - startedAt
                };

                this.latestResult =
                    cloneValue(result);

                return result;
            }
        }

        getRecovery(candidateId) {
            return cloneValue(
                this.recoveredMap.get(candidateId) ??
                null
            );
        }

        getAllRecoveries() {
            return cloneValue(
                Array.from(
                    this.recoveredMap.values()
                )
            );
        }

        getLatestResult() {
            return cloneValue(
                this.latestResult
            );
        }

        printTable() {
            const rows =
                this.getAllRecoveries().map(
                    item => ({
                        candidateId:
                            item.candidateId,
                        recovered:
                            item.recovered,
                        approaching:
                            item.approaching,
                        speedKmh:
                            item.speedKmh,
                        stormBearing:
                            item.stormBearing,
                        targetBearing:
                            item.targetBearing,
                        approachAngleDeg:
                            item.approachAngleDeg,
                        distanceKm:
                            item.distanceKm,
                        distanceImprovementKm:
                            item.distanceImprovementKm,
                        arrivalMinutes:
                            item.arrivalMinutes,
                        evidenceCount:
                            item.evidenceCount,
                        reasons:
                            item.reasons.join(",")
                    })
                );

            console.table(rows);
            return rows;
        }

        start() {
            if (this.running) {
                return {
                    success: true,
                    alreadyRunning: true
                };
            }

            this.running = true;
            this.recoverAll();

            this.timer = global.setInterval(
                () => this.recoverAll(),
                this.config.recoveryIntervalMs
            );

            return {
                success: true,
                running: true,
                intervalMs:
                    this.config.recoveryIntervalMs
            };
        }

        stop() {
            if (this.timer) {
                global.clearInterval(this.timer);
            }

            this.timer = null;
            this.running = false;

            return {
                success: true,
                running: false
            };
        }

        getDiagnostics() {
            return {
                module: MODULE_NAME,
                version: this.version,
                build: this.buildId,
                installed: true,
                running: this.running,
                candidateRepositoryAvailable:
                    Boolean(
                        global
                            .RainArrivalCandidateRepositoryV32
                    ),
                scoringAvailable:
                    Boolean(
                        global
                            .RainArrivalCandidateScoringV32
                    ),
                decisionAvailable:
                    Boolean(
                        global
                            .RainArrivalDecisionEngineV32
                    ),
                recoveryCount:
                    this.recoveredMap.size,
                latestResult:
                    this.getLatestResult(),
                lastError:
                    cloneValue(this.lastError),
                statistics:
                    cloneValue(this.statistics)
            };
        }

        diagnose() {
            const diagnostics =
                this.getDiagnostics();

            console.log(
                "[RainArrival MotionRecovery]",
                diagnostics
            );

            return diagnostics;
        }
    }

    const engine =
        new StormMotionRecoveryEngine();

    global.RainArrivalStormMotionRecoveryV32 =
        engine;

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
        .stormMotionRecovery =
        engine;

    global.RainArrivalEngineV32
        ?.register?.(
            MODULE_NAME,
            engine
        );

    global.RainArrivalOrchestratorV32
        ?.register?.(
            MODULE_NAME,
            engine
        );

    global.recoverRainArrivalStormMotion =
        () => engine.recoverAll();

    if (engine.config.autoStart) {
        engine.start();
    }

    console.log(
        "[RainGuard AI V32] Storm Motion Recovery Engine loaded.",
        {
            version: VERSION,
            build: BUILD_ID
        }
    );

})(
    typeof globalThis !== "undefined"
        ? globalThis
        : window
);
