/*
===========================================================
 RainGuard AI V32
 Phase 38M-20 — Final Arrival Decision Engine
 Version: 32.38M.20
===========================================================
*/

(function (global) {
    "use strict";

    const MODULE_NAME = "finalArrivalDecision";
    const VERSION = "32.38M.20";
    const BUILD_ID =
        "rainguard-v32-phase38m20-final-arrival-decision";

    const DEFAULT_CONFIG = Object.freeze({
        autoStart: true,
        evaluationIntervalMs: 5000,
        confirmedScore: 70,
        probableScore: 50,
        minimumAcceptedScore: 20,
        maximumConfirmedArrivalMinutes: 360,
        maximumProbableArrivalMinutes: 720,
        minimumConfidenceConfirmed: 55,
        minimumConfidenceProbable: 25,
        requireApproachingForConfirmed: true,
        requireEtaForConfirmed: true,
        debug: true
    });

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

    function normalizePercent(value) {
        const number = toFiniteNumber(value, 0);

        return clamp(
            number <= 1 ? number * 100 : number,
            0,
            100
        );
    }

    function normalizeText(value) {
        return value === null || value === undefined
            ? ""
            : String(value).trim();
    }

    class FinalArrivalDecisionEngine {
        constructor(config = {}) {
            this.version = VERSION;
            this.buildId = BUILD_ID;
            this.config = {
                ...DEFAULT_CONFIG,
                ...(config || {})
            };

            this.running = false;
            this.timer = null;
            this.latestDecision = null;
            this.latestResult = null;
            this.lastError = null;

            this.statistics = {
                evaluations: 0,
                confirmed: 0,
                probable: 0,
                unavailable: 0,
                rejected: 0,
                failures: 0
            };
        }

        resolveTopRankedCandidate() {
            const scoring =
                global.RainArrivalCandidateScoringV32;

            const sources = [
                scoring?.getTopCandidate?.(),
                global.RainArrivalTopScoredCandidate,
                global.RainGuardAI?.V32
                    ?.rainArrivalTopScoredCandidate,
                global.RainArrivalCandidateRepositoryV32
                    ?.getTopCandidate?.(),
                global.RainArrivalFinalCandidateBuilderV32
                    ?.getTopCandidate?.()
            ];

            for (const source of sources) {
                if (source) {
                    return cloneValue(source);
                }
            }

            return null;
        }

        normalizeRankedCandidate(value) {
            if (!value) {
                return null;
            }

            const candidate =
                value.candidate &&
                typeof value.candidate === "object"
                    ? value.candidate
                    : value;

            return {
                rankingId:
                    normalizeText(value.rankingId) ||
                    normalizeText(candidate.candidateId) ||
                    null,

                rank:
                    toFiniteNumber(value.rank, 1),

                accepted:
                    value.accepted !== undefined
                        ? Boolean(value.accepted)
                        : true,

                finalScore:
                    toFiniteNumber(
                        value.finalScore ??
                        candidate.candidateScore,
                        0
                    ),

                componentScores:
                    cloneValue(value.componentScores ?? null),

                scoringRejectionReasons:
                    Array.isArray(value.rejectionReasons)
                        ? cloneValue(value.rejectionReasons)
                        : [],

                candidate:
                    cloneValue(candidate)
            };
        }

        evaluateEvidence(ranked) {
            if (!ranked) {
                return {
                    status: "RAIN_ARRIVAL_UNAVAILABLE",
                    decisionLevel: "UNAVAILABLE",
                    accepted: false,
                    confidence: 0,
                    reasons: ["NO_RANKED_CANDIDATE"]
                };
            }

            const candidate = ranked.candidate || {};
            const finalScore = clamp(
                toFiniteNumber(ranked.finalScore, 0),
                0,
                100
            );

            const arrivalMinutes = toFiniteNumber(
                candidate.arrivalMinutes,
                null
            );

            const confidence = normalizePercent(
                candidate.confidence
            );

            const approaching =
                candidate.approaching === true;

            const hasValidEta =
                arrivalMinutes !== null &&
                arrivalMinutes >= 0 &&
                Number.isFinite(arrivalMinutes);

            const reasons = [];

            if (!ranked.accepted) {
                reasons.push("TOP_CANDIDATE_REJECTED");
            }

            if (
                finalScore <
                this.config.minimumAcceptedScore
            ) {
                reasons.push("FINAL_SCORE_BELOW_MINIMUM");
            }

            if (!approaching) {
                reasons.push(
                    "STORM_NOT_CONFIRMED_APPROACHING"
                );
            }

            if (!hasValidEta) {
                reasons.push("ETA_UNAVAILABLE");
            }

            const confirmed =
                ranked.accepted &&
                finalScore >= this.config.confirmedScore &&
                (
                    !this.config
                        .requireApproachingForConfirmed ||
                    approaching
                ) &&
                (
                    !this.config.requireEtaForConfirmed ||
                    hasValidEta
                ) &&
                (
                    arrivalMinutes === null ||
                    arrivalMinutes <=
                        this.config
                            .maximumConfirmedArrivalMinutes
                ) &&
                confidence >=
                    this.config
                        .minimumConfidenceConfirmed;

            if (confirmed) {
                return {
                    status: "RAIN_ARRIVAL_CONFIRMED",
                    decisionLevel: "CONFIRMED",
                    accepted: true,
                    confidence: Math.round(
                        clamp(
                            finalScore * 0.65 +
                            confidence * 0.35,
                            0,
                            100
                        )
                    ),
                    reasons: [
                        "TOP_CANDIDATE_ACCEPTED",
                        "SCORE_CONFIRMED",
                        "APPROACH_CONFIRMED",
                        "ETA_CONFIRMED"
                    ]
                };
            }

            const probable =
                ranked.accepted &&
                finalScore >= this.config.probableScore &&
                (
                    arrivalMinutes === null ||
                    arrivalMinutes <=
                        this.config
                            .maximumProbableArrivalMinutes
                ) &&
                confidence >=
                    this.config
                        .minimumConfidenceProbable;

            if (probable) {
                return {
                    status: "RAIN_ARRIVAL_PROBABLE",
                    decisionLevel: "PROBABLE",
                    accepted: true,
                    confidence: Math.round(
                        clamp(
                            finalScore * 0.75 +
                            confidence * 0.25,
                            0,
                            100
                        )
                    ),
                    reasons: [
                        "TOP_CANDIDATE_ACCEPTED",
                        "PROBABLE_SCORE_THRESHOLD_MET",
                        ...reasons
                    ]
                };
            }

            return {
                status: "RAIN_ARRIVAL_UNAVAILABLE",
                decisionLevel: "UNAVAILABLE",
                accepted: false,
                confidence: Math.round(
                    clamp(finalScore * 0.5, 0, 100)
                ),
                reasons:
                    reasons.length > 0
                        ? reasons
                        : ["DECISION_THRESHOLDS_NOT_MET"]
            };
        }

        evaluate() {
            const startedAt = now();
            this.statistics.evaluations += 1;

            try {
                const ranked =
                    this.normalizeRankedCandidate(
                        this.resolveTopRankedCandidate()
                    );

                const evidence =
                    this.evaluateEvidence(ranked);

                const candidate =
                    ranked?.candidate ?? null;

                const arrivalMinutes =
                    toFiniteNumber(
                        candidate?.arrivalMinutes,
                        null
                    );

                const eta =
                    candidate?.eta ??
                    (
                        arrivalMinutes !== null
                            ? new Date(
                                now() +
                                arrivalMinutes * 60000
                            ).toISOString()
                            : null
                    );

                const decision = {
                    decisionId: [
                        "RAIN-ARRIVAL",
                        evidence.decisionLevel,
                        now()
                    ].join("-"),

                    status: evidence.status,
                    decisionLevel:
                        evidence.decisionLevel,
                    accepted: evidence.accepted,
                    confidence: evidence.confidence,

                    city:
                        candidate?.targetCity ??
                        candidate?.city ??
                        null,

                    targetCity:
                        candidate?.targetCity ?? null,

                    arrivalMinutes,
                    eta,

                    distanceKm:
                        toFiniteNumber(
                            candidate?.distanceKm,
                            null
                        ),

                    speedKmh:
                        toFiniteNumber(
                            candidate?.speedKmh,
                            null
                        ),

                    stormBearing:
                        toFiniteNumber(
                            candidate?.stormBearing,
                            null
                        ),

                    targetBearing:
                        toFiniteNumber(
                            candidate?.targetBearing,
                            null
                        ),

                    approachAngleDeg:
                        toFiniteNumber(
                            candidate?.approachAngleDeg,
                            null
                        ),

                    approaching:
                        candidate?.approaching === true,

                    candidateScore:
                        toFiniteNumber(
                            ranked?.finalScore,
                            0
                        ),

                    candidateId:
                        candidate?.candidateId ??
                        ranked?.rankingId ??
                        null,

                    trackId:
                        candidate?.trackId ?? null,

                    rank:
                        ranked?.rank ?? null,

                    reasons:
                        cloneValue(evidence.reasons),

                    source:
                        "PHASE_38M_20_FINAL_DECISION",

                    candidate:
                        cloneValue(candidate),

                    rankedCandidate:
                        cloneValue(ranked),

                    generatedAt: now(),
                    generatedAtIso:
                        new Date().toISOString()
                };

                this.latestDecision =
                    cloneValue(decision);

                if (
                    decision.status ===
                    "RAIN_ARRIVAL_CONFIRMED"
                ) {
                    this.statistics.confirmed += 1;
                } else if (
                    decision.status ===
                    "RAIN_ARRIVAL_PROBABLE"
                ) {
                    this.statistics.probable += 1;
                } else {
                    this.statistics.unavailable += 1;
                }

                if (!decision.accepted) {
                    this.statistics.rejected += 1;
                }

                this.publish(decision);

                const result = {
                    success: true,
                    status:
                        "FINAL_ARRIVAL_DECISION_COMPLETED",
                    version: this.version,
                    build: this.buildId,
                    decision:
                        cloneValue(decision),
                    startedAt,
                    completedAt: now(),
                    durationMs: now() - startedAt
                };

                this.latestResult =
                    cloneValue(result);

                if (this.config.debug) {
                    console.log(
                        "[RainArrival FinalDecision] Evaluation result:",
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
                        "FINAL_ARRIVAL_DECISION_FAILED",
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

        publish(decision) {
            const exported =
                cloneValue(decision);

            global.RainArrivalFinalDecision =
                exported;

            global.RainArrivalDecision =
                exported;

            global.RainArrivalLatestDecision =
                exported;

            global.RainGuardAI =
                global.RainGuardAI || {};

            global.RainGuardAI.V32 =
                global.RainGuardAI.V32 || {};

            global.RainGuardAI.V32
                .rainArrivalFinalDecision =
                exported;

            global.RainGuardAI.V32
                .latestRainArrivalDecision =
                exported;

            const predictionPayload = {
                status: decision.status,
                city: decision.city,
                arrivalMinutes:
                    decision.arrivalMinutes,
                eta: decision.eta,
                confidence:
                    decision.confidence,
                decisionLevel:
                    decision.decisionLevel,
                candidateId:
                    decision.candidateId,
                trackId:
                    decision.trackId,
                reasons:
                    cloneValue(decision.reasons),
                source: decision.source,
                generatedAt:
                    decision.generatedAt
            };

            global.RainArrivalPrediction =
                cloneValue(predictionPayload);

            global.RainGuardAI.V32
                .rainArrivalPredictionResult =
                cloneValue(predictionPayload);

            global.dispatchEvent?.(
                new CustomEvent(
                    "rainarrival:final-decision-updated",
                    {
                        detail: exported
                    }
                )
            );

            global.dispatchEvent?.(
                new CustomEvent(
                    "rainarrival:prediction-ready",
                    {
                        detail:
                            cloneValue(
                                predictionPayload
                            )
                    }
                )
            );

            return {
                success: true,
                status: decision.status
            };
        }

        getDecision() {
            return cloneValue(
                this.latestDecision
            );
        }

        getLatestResult() {
            return cloneValue(
                this.latestResult
            );
        }

        printDecision() {
            const decision =
                this.getDecision();

            if (!decision) {
                console.table([
                    {
                        status:
                            "NO_DECISION_AVAILABLE"
                    }
                ]);
                return null;
            }

            console.table([
                {
                    status: decision.status,
                    level:
                        decision.decisionLevel,
                    city: decision.city,
                    arrivalMinutes:
                        decision.arrivalMinutes,
                    eta: decision.eta,
                    confidence:
                        decision.confidence,
                    score:
                        decision.candidateScore,
                    rank: decision.rank,
                    candidateId:
                        decision.candidateId,
                    reasons:
                        decision.reasons.join(",")
                }
            ]);

            return decision;
        }

        start() {
            if (this.running) {
                return {
                    success: true,
                    alreadyRunning: true
                };
            }

            this.running = true;
            this.evaluate();

            this.timer = global.setInterval(
                () => this.evaluate(),
                this.config.evaluationIntervalMs
            );

            return {
                success: true,
                running: true,
                intervalMs:
                    this.config
                        .evaluationIntervalMs
            };
        }

        stop() {
            if (this.timer) {
                global.clearInterval(
                    this.timer
                );
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

                scoringAvailable:
                    Boolean(
                        global
                            .RainArrivalCandidateScoringV32
                    ),

                latestDecision:
                    this.getDecision(),

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
                "[RainArrival FinalDecision]",
                diagnostics
            );

            return diagnostics;
        }
    }

    const engine =
        new FinalArrivalDecisionEngine();

    global.RainArrivalDecisionEngineV32 =
        engine;

    global.RainArrivalFinalDecisionEngineV32 =
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
        .finalArrivalDecision =
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

    global.evaluateFinalRainArrivalDecision =
        () => engine.evaluate();

    global.getFinalRainArrivalDecision =
        () => engine.getDecision();

    if (engine.config.autoStart) {
        engine.start();
    }

    console.log(
        "[RainGuard AI V32] Final Arrival Decision Engine loaded.",
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
