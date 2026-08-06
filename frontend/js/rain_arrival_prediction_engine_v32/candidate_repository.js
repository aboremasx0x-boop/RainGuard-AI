/*
===========================================================
 RainGuard AI V32
 Phase 38M-18
 Candidate Repository + Memory Cache

 Responsibilities:
 - Persist candidates produced by the Final Candidate Builder
 - Keep a stable candidate map and ordered list
 - Mirror candidates to global runtime channels
 - Expose getAll/getTop/getById/clear/refresh/diagnose
 - Listen for candidate build events
 - Synchronize automatically after each build
===========================================================
*/

(function (global) {
    "use strict";

    const MODULE_NAME =
        "candidateRepository";

    const VERSION =
        "32.38M.18";

    const BUILD_ID =
        "rainguard-v32-phase38m-candidate-repository";

    const DEFAULT_CONFIG =
        Object.freeze({
            autoStart:
                true,

            maximumCandidates:
                500,

            retainPreviousWhenEmpty:
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

        return [];
    }

    class CandidateRepository {

        constructor(config = {}) {
            this.version =
                VERSION;

            this.buildId =
                BUILD_ID;

            this.config = {
                ...DEFAULT_CONFIG,
                ...(config || {})
            };

            this.candidateMap =
                new Map();

            this.latestCandidates =
                [];

            this.latestTopCandidate =
                null;

            this.lastSyncResult =
                null;

            this.lastError =
                null;

            this.running =
                false;

            this.listenerInstalled =
                false;

            this.statistics = {
                syncs:
                    0,

                stored:
                    0,

                replaced:
                    0,

                cleared:
                    0,

                emptySyncs:
                    0,

                failures:
                    0
            };

            this._boundCandidateUpdate =
                event => {
                    try {
                        const candidates =
                            event?.detail?.candidates ??
                            event?.detail?.result?.candidates ??
                            event?.detail?.candidateResult?.candidates ??
                            null;

                        this.sync(
                            candidates,
                            {
                                source:
                                    "EVENT"
                            }
                        );
                    } catch (error) {
                        this.captureError(
                            error,
                            "EVENT_SYNC_FAILED"
                        );
                    }
                };
        }

        resolveId(candidate, index) {
            return (
                normalizeText(
                    candidate?.candidateId
                ) ||
                normalizeText(
                    candidate?.canonicalTrackId
                ) ||
                normalizeText(
                    candidate?.trackId
                ) ||
                normalizeText(
                    candidate?.cellId
                ) ||
                `CANDIDATE-${index}`
            );
        }

        getBuilderCandidates() {
            const builder =
                global
                    .RainArrivalFinalCandidateBuilderV32;

            const sources = [
                builder
                    ?.getAll?.(),

                builder
                    ?.candidates,

                builder
                    ?.lastResult
                    ?.candidates,

                global
                    .RainArrivalCandidates,

                global.RainGuardAI
                    ?.V32
                    ?.rainArrivalCandidates,

                global.RainGuardAI
                    ?.V32
                    ?.finalArrivalCandidateState
                    ?.candidates
            ];

            for (
                const source
                of sources
            ) {
                const array =
                    collectionToArray(
                        source
                    );

                if (
                    array.length > 0
                ) {
                    return array;
                }
            }

            return [];
        }

        sync(candidates = null, options = {}) {
            const startedAt =
                now();

            this.statistics
                .syncs += 1;

            const incoming =
                collectionToArray(
                    candidates
                );

            const resolved =
                incoming.length > 0
                    ? incoming
                    : this.getBuilderCandidates();

            if (
                resolved.length === 0
            ) {
                this.statistics
                    .emptySyncs += 1;

                if (
                    !this.config
                        .retainPreviousWhenEmpty
                ) {
                    this.candidateMap
                        .clear();

                    this.latestCandidates =
                        [];

                    this.latestTopCandidate =
                        null;

                    this.publish();
                }

                const result = {
                    success:
                        true,

                    status:
                        "NO_CANDIDATES_TO_STORE",

                    source:
                        options.source ??
                        "AUTO",

                    storedCount:
                        this.latestCandidates
                            .length,

                    startedAt,

                    completedAt:
                        now()
                };

                this.lastSyncResult =
                    cloneValue(result);

                return result;
            }

            const newMap =
                new Map();

            resolved
                .slice(
                    0,
                    this.config
                        .maximumCandidates
                )
                .forEach(
                    (
                        candidate,
                        index
                    ) => {
                        if (!candidate) {
                            return;
                        }

                        const id =
                            this.resolveId(
                                candidate,
                                index
                            );

                        newMap.set(
                            id,
                            {
                                ...cloneValue(
                                    candidate
                                ),

                                repositoryId:
                                    id,

                                repositoryStoredAt:
                                    now()
                            }
                        );
                    }
                );

            this.statistics
                .replaced +=
                this.candidateMap
                    .size;

            this.candidateMap =
                newMap;

            this.latestCandidates =
                Array.from(
                    this.candidateMap
                        .values()
                )
                    .sort(
                        (
                            first,
                            second
                        ) =>
                            Number(
                                second
                                    .candidateScore ??
                                0
                            ) -
                            Number(
                                first
                                    .candidateScore ??
                                0
                            )
                    );

            this.latestTopCandidate =
                this.latestCandidates[0] ??
                null;

            this.statistics
                .stored +=
                this.latestCandidates
                    .length;

            this.publish();

            const result = {
                success:
                    true,

                status:
                    "CANDIDATE_REPOSITORY_SYNCED",

                source:
                    options.source ??
                    "AUTO",

                inputCount:
                    resolved.length,

                storedCount:
                    this.latestCandidates
                        .length,

                topCandidate:
                    cloneValue(
                        this.latestTopCandidate
                    ),

                startedAt,

                completedAt:
                    now(),

                durationMs:
                    now() -
                    startedAt
            };

            this.lastSyncResult =
                cloneValue(result);

            if (
                this.config.debug
            ) {
                console.log(
                    "[RainArrival CandidateRepository] Sync result:",
                    result
                );
            }

            return result;
        }

        publish() {
            const candidates =
                this.getAll();

            global.RainArrivalCandidates =
                candidates;

            global.RainArrivalCandidateStore =
                candidates;

            global.RainArrivalTopCandidate =
                this.getTopCandidate();

            global.RainGuardAI =
                global.RainGuardAI || {};

            global.RainGuardAI.V32 =
                global.RainGuardAI.V32 || {};

            global.RainGuardAI.V32
                .rainArrivalCandidates =
                candidates;

            global.RainGuardAI.V32
                .rainArrivalCandidateRepository =
                {
                    version:
                        this.version,

                    build:
                        this.buildId,

                    count:
                        candidates.length,

                    topCandidate:
                        this.getTopCandidate(),

                    candidates,

                    updatedAt:
                        now()
                };

            return {
                success:
                    true,

                publishedCount:
                    candidates.length
            };
        }

        refresh() {
            const builder =
                global
                    .RainArrivalFinalCandidateBuilderV32;

            let buildResult =
                null;

            if (
                builder &&
                typeof builder.build ===
                    "function"
            ) {
                buildResult =
                    builder.build();
            }

            const syncResult =
                this.sync(
                    buildResult
                        ?.candidates ??
                    null,
                    {
                        source:
                            "REFRESH"
                    }
                );

            return {
                success:
                    Boolean(
                        syncResult
                            ?.success
                    ),

                status:
                    "CANDIDATE_REPOSITORY_REFRESH_COMPLETED",

                buildResult,

                syncResult,

                generatedAt:
                    now()
            };
        }

        getAll() {
            return cloneValue(
                this.latestCandidates
            );
        }

        getTopCandidate() {
            return cloneValue(
                this.latestTopCandidate
            );
        }

        getById(id) {
            return cloneValue(
                this.candidateMap
                    .get(
                        normalizeText(id)
                    ) ??
                null
            );
        }

        getCount() {
            return this.latestCandidates
                .length;
        }

        clear() {
            const previousCount =
                this.latestCandidates
                    .length;

            this.candidateMap
                .clear();

            this.latestCandidates =
                [];

            this.latestTopCandidate =
                null;

            this.statistics
                .cleared +=
                previousCount;

            this.publish();

            return {
                success:
                    true,

                previousCount,

                storedCount:
                    0
            };
        }

        printTable() {
            const rows =
                this.latestCandidates
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

                            targetCity:
                                candidate
                                    .targetCity,

                            distanceKm:
                                candidate
                                    .distanceKm,

                            speedKmh:
                                candidate
                                    .speedKmh,

                            arrivalMinutes:
                                candidate
                                    .arrivalMinutes,

                            score:
                                candidate
                                    .candidateScore,

                            eligibility:
                                candidate
                                    .eligibility
                        })
                    );

            console.table(rows);

            return rows;
        }

        installListener() {
            if (
                this.listenerInstalled
            ) {
                return {
                    success:
                        true,

                    alreadyInstalled:
                        true
                };
            }

            global.addEventListener?.(
                "rainarrival:candidates-updated",
                this
                    ._boundCandidateUpdate
            );

            this.listenerInstalled =
                true;

            return {
                success:
                    true,

                installed:
                    true
            };
        }

        uninstallListener() {
            if (
                this.listenerInstalled
            ) {
                global
                    .removeEventListener?.(
                        "rainarrival:candidates-updated",
                        this
                            ._boundCandidateUpdate
                    );
            }

            this.listenerInstalled =
                false;

            return {
                success:
                    true,

                installed:
                    false
            };
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

            this.installListener();

            this.sync(
                null,
                {
                    source:
                        "START"
                }
            );

            return {
                success:
                    true,

                running:
                    true
            };
        }

        stop() {
            this.running =
                false;

            this.uninstallListener();

            return {
                success:
                    true,

                running:
                    false
            };
        }

        captureError(error, code) {
            this.statistics
                .failures += 1;

            this.lastError = {
                code,

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

            return this.lastError;
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

                listenerInstalled:
                    this.listenerInstalled,

                storedCount:
                    this.getCount(),

                topCandidate:
                    this.getTopCandidate(),

                lastSyncResult:
                    cloneValue(
                        this.lastSyncResult
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
                "[RainArrival CandidateRepository]",
                diagnostics
            );

            return diagnostics;
        }
    }

    const repository =
        new CandidateRepository();

    global.RainArrivalCandidateRepositoryV32 =
        repository;

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
        .candidateRepository =
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

    global.refreshRainArrivalCandidateRepository =
        () =>
            repository.refresh();

    if (
        repository.config
            .autoStart
    ) {
        repository.start();
    }

    console.log(
        "[RainGuard AI V32] Candidate Repository loaded.",
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
