/*
===========================================================
 RainGuard AI V32
 Phase 38M-19
 Candidate Scoring & Ranking Engine

 Responsibilities:
 - Read candidates from Candidate Repository
 - Apply deterministic multi-factor scoring
 - Rank all candidates
 - Reject impossible or unsafe candidates
 - Publish ranked candidates and top candidate
 - Expose:
     scoreAll()
     getRanking()
     getTopCandidate()
     getDiagnostics()
     printTable()
===========================================================
*/

(function (global) {
    "use strict";

    const MODULE_NAME =
        "candidateScoring";

    const VERSION =
        "32.38M.19";

    const BUILD_ID =
        "rainguard-v32-phase38m-candidate-scoring-ranking";

    const DEFAULT_CONFIG =
        Object.freeze({
            autoStart:
                true,

            scoreIntervalMs:
                5000,

            maximumCandidates:
                500,

            maximumDistanceKm:
                1200,

            maximumArrivalMinutes:
                1440,

            maximumApproachAngleDeg:
                110,

            minimumAcceptedScore:
                20,

            weights: {
                candidateScore:
                    0.30,

                distance:
                    0.20,

                direction:
                    0.20,

                motion:
                    0.10,

                confidence:
                    0.10,

                intensity:
                    0.10
            },

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

    function normalizeText(value) {
        if (
            value === null ||
            value === undefined
        ) {
            return "";
        }

        return String(value).trim();
    }

    function normalizePercent(value) {
        const number =
            toFiniteNumber(
                value,
                0
            );

        return clamp(
            number <= 1
                ? number * 100
                : number,
            0,
            100
        );
    }

    class CandidateScoringEngine {

        constructor(config = {}) {
            this.version =
                VERSION;

            this.buildId =
                BUILD_ID;

            this.config = {
                ...DEFAULT_CONFIG,
                ...(config || {}),

                weights: {
                    ...DEFAULT_CONFIG.weights,
                    ...(
                        config?.weights ||
                        {}
                    )
                }
            };

            this.ranking =
                [];

            this.topCandidate =
                null;

            this.lastResult =
                null;

            this.lastError =
                null;

            this.running =
                false;

            this.timer =
                null;

            this.statistics = {
                runs:
                    0,

                inputCandidates:
                    0,

                rankedCandidates:
                    0,

                acceptedCandidates:
                    0,

                rejectedCandidates:
                    0,

                failures:
                    0
            };
        }

        getSourceCandidates() {
            const repository =
                global
                    .RainArrivalCandidateRepositoryV32;

            const sources = [
                repository
                    ?.getAll?.(),

                global
                    .RainArrivalCandidates,

                global
                    .RainArrivalCandidateStore,

                global.RainGuardAI
                    ?.V32
                    ?.rainArrivalCandidates
            ];

            for (
                const source
                of sources
            ) {
                if (
                    Array.isArray(source) &&
                    source.length > 0
                ) {
                    return source.slice(
                        0,
                        this.config
                            .maximumCandidates
                    );
                }
            }

            return [];
        }

        scoreCandidate(
            candidate,
            index
        ) {
            const baseCandidateScore =
                clamp(
                    toFiniteNumber(
                        candidate
                            ?.candidateScore,
                        0
                    ),
                    0,
                    100
                );

            const distanceKm =
                toFiniteNumber(
                    candidate
                        ?.distanceKm,
                    null
                );

            const distanceScore =
                distanceKm === null
                    ? 0
                    : clamp(
                        100 -
                        (
                            distanceKm /
                            this.config
                                .maximumDistanceKm
                        ) *
                        100,
                        0,
                        100
                    );

            const approachAngleDeg =
                toFiniteNumber(
                    candidate
                        ?.approachAngleDeg,
                    null
                );

            const directionScore =
                approachAngleDeg === null
                    ? 30
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

            const speedKmh =
                toFiniteNumber(
                    candidate
                        ?.speedKmh,
                    null
                );

            const arrivalMinutes =
                toFiniteNumber(
                    candidate
                        ?.arrivalMinutes,
                    null
                );

            let motionScore =
                10;

            if (
                speedKmh !== null &&
                speedKmh > 0
            ) {
                motionScore =
                    clamp(
                        (
                            speedKmh /
                            80
                        ) *
                        100,
                        10,
                        100
                    );
            }

            if (
                arrivalMinutes !== null
            ) {
                const etaScore =
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
                    );

                motionScore =
                    (
                        motionScore +
                        etaScore
                    ) /
                    2;
            }

            const confidenceScore =
                normalizePercent(
                    candidate
                        ?.confidence
                );

            const intensityScore =
                candidate
                    ?.intensity ===
                    null ||
                candidate
                    ?.intensity ===
                    undefined
                    ? 30
                    : normalizePercent(
                        candidate
                            ?.intensity
                    );

            const weights =
                this.config.weights;

            const weightedScore =
                baseCandidateScore *
                    weights
                        .candidateScore +
                distanceScore *
                    weights
                        .distance +
                directionScore *
                    weights
                        .direction +
                motionScore *
                    weights
                        .motion +
                confidenceScore *
                    weights
                        .confidence +
                intensityScore *
                    weights
                        .intensity;

            const rejectionReasons =
                [];

            if (
                distanceKm !== null &&
                distanceKm >
                    this.config
                        .maximumDistanceKm
            ) {
                rejectionReasons.push(
                    "DISTANCE_EXCEEDS_LIMIT"
                );
            }

            if (
                approachAngleDeg !==
                    null &&
                approachAngleDeg >
                    this.config
                        .maximumApproachAngleDeg
            ) {
                rejectionReasons.push(
                    "NOT_APPROACHING_TARGET"
                );
            }

            if (
                arrivalMinutes !==
                    null &&
                arrivalMinutes >
                    this.config
                        .maximumArrivalMinutes
            ) {
                rejectionReasons.push(
                    "ETA_EXCEEDS_LIMIT"
                );
            }

            if (
                candidate
                    ?.approaching ===
                false
            ) {
                rejectionReasons.push(
                    "APPROACHING_FALSE"
                );
            }

            const finalScore =
                Number(
                    weightedScore
                        .toFixed(2)
                );

            const accepted =
                rejectionReasons.length ===
                    0 &&
                finalScore >=
                    this.config
                        .minimumAcceptedScore;

            return {
                rankingId:
                    normalizeText(
                        candidate
                            ?.candidateId
                    ) ||
                    `RANK-${index}`,

                rank:
                    null,

                accepted,

                finalScore,

                componentScores: {
                    baseCandidateScore,
                    distanceScore:
                        Number(
                            distanceScore
                                .toFixed(2)
                        ),
                    directionScore:
                        Number(
                            directionScore
                                .toFixed(2)
                        ),
                    motionScore:
                        Number(
                            motionScore
                                .toFixed(2)
                        ),
                    confidenceScore:
                        Number(
                            confidenceScore
                                .toFixed(2)
                        ),
                    intensityScore:
                        Number(
                            intensityScore
                                .toFixed(2)
                        )
                },

                rejectionReasons,

                candidate:
                    cloneValue(
                        candidate
                    ),

                generatedAt:
                    now()
            };
        }

        scoreAll() {
            const startedAt =
                now();

            this.statistics
                .runs += 1;

            const candidates =
                this.getSourceCandidates();

            this.statistics
                .inputCandidates +=
                candidates.length;

            const ranking =
                candidates
                    .map(
                        (
                            candidate,
                            index
                        ) =>
                            this.scoreCandidate(
                                candidate,
                                index
                            )
                    )
                    .sort(
                        (
                            first,
                            second
                        ) =>
                            second.finalScore -
                            first.finalScore
                    );

            ranking.forEach(
                (
                    item,
                    index
                ) => {
                    item.rank =
                        index + 1;
                }
            );

            this.ranking =
                ranking;

            this.topCandidate =
                ranking.find(
                    item =>
                        item.accepted
                ) ??
                ranking[0] ??
                null;

            const acceptedCount =
                ranking.filter(
                    item =>
                        item.accepted
                ).length;

            const rejectedCount =
                ranking.length -
                acceptedCount;

            this.statistics
                .rankedCandidates +=
                ranking.length;

            this.statistics
                .acceptedCandidates +=
                acceptedCount;

            this.statistics
                .rejectedCandidates +=
                rejectedCount;

            global.RainArrivalCandidateRanking =
                cloneValue(
                    this.ranking
                );

            global.RainArrivalScoredCandidates =
                cloneValue(
                    this.ranking
                );

            global.RainArrivalTopScoredCandidate =
                cloneValue(
                    this.topCandidate
                );

            global.RainGuardAI =
                global.RainGuardAI || {};

            global.RainGuardAI.V32 =
                global.RainGuardAI.V32 || {};

            global.RainGuardAI.V32
                .rainArrivalCandidateRanking =
                cloneValue(
                    this.ranking
                );

            global.RainGuardAI.V32
                .rainArrivalTopScoredCandidate =
                cloneValue(
                    this.topCandidate
                );

            const result = {
                success:
                    true,

                status:
                    ranking.length > 0
                        ? "CANDIDATES_SCORED_AND_RANKED"
                        : "NO_CANDIDATES_TO_SCORE",

                version:
                    this.version,

                build:
                    this.buildId,

                inputCount:
                    candidates.length,

                rankedCount:
                    ranking.length,

                acceptedCount,

                rejectedCount,

                topCandidate:
                    cloneValue(
                        this.topCandidate
                    ),

                ranking:
                    cloneValue(
                        this.ranking
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
                    "[RainArrival CandidateScoring] Score result:",
                    result
                );
            }

            global.dispatchEvent?.(
                new CustomEvent(
                    "rainarrival:candidate-ranking-updated",
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

        getRanking() {
            return cloneValue(
                this.ranking
            );
        }

        getTopCandidate() {
            return cloneValue(
                this.topCandidate
            );
        }

        printTable() {
            const rows =
                this.ranking.map(
                    item => ({
                        rank:
                            item.rank,

                        accepted:
                            item.accepted,

                        candidateId:
                            item
                                .candidate
                                ?.candidateId,

                        trackId:
                            item
                                .candidate
                                ?.trackId,

                        targetCity:
                            item
                                .candidate
                                ?.targetCity,

                        distanceKm:
                            item
                                .candidate
                                ?.distanceKm,

                        speedKmh:
                            item
                                .candidate
                                ?.speedKmh,

                        arrivalMinutes:
                            item
                                .candidate
                                ?.arrivalMinutes,

                        finalScore:
                            item.finalScore,

                        reasons:
                            item
                                .rejectionReasons
                                .join(",")
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

            this.scoreAll();

            this.timer =
                global.setInterval(
                    () => {
                        this.scoreAll();
                    },
                    this.config
                        .scoreIntervalMs
                );

            return {
                success:
                    true,

                running:
                    true,

                intervalMs:
                    this.config
                        .scoreIntervalMs
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

                inputCount:
                    this
                        .getSourceCandidates()
                        .length,

                rankedCount:
                    this.ranking
                        .length,

                acceptedCount:
                    this.ranking
                        .filter(
                            item =>
                                item.accepted
                        )
                        .length,

                topCandidate:
                    this
                        .getTopCandidate(),

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
                "[RainArrival CandidateScoring]",
                diagnostics
            );

            return diagnostics;
        }
    }

    const engine =
        new CandidateScoringEngine();

    global.RainArrivalCandidateScoringV32 =
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
        .candidateScoring =
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

    global.scoreRainArrivalCandidates =
        () =>
            engine.scoreAll();

    if (
        engine.config
            .autoStart
    ) {
        engine.start();
    }

    console.log(
        "[RainGuard AI V32] Candidate Scoring & Ranking Engine loaded.",
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
