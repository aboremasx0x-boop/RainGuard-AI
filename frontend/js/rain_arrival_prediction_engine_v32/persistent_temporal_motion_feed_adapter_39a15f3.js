/**
 * RainGuard AI
 * Phase 39A-15F3
 * Persistent Temporal Motion Feed Adapter
 *
 * Purpose:
 * - Consume motion-ready temporal identities created by Phase 39A-15F2.
 * - Normalize sequential observations into a feed compatible with 39A-15F.
 * - Preserve real coordinates and timestamps only.
 * - Never fabricate motion, coordinates, timestamps, or identities.
 */

(function installRainGuardPersistentTemporalMotionFeedAdapter(global) {
    "use strict";

    const PHASE = "39A-15F3";
    const VERSION = "39A.15F3.0";
    const BUILD = "rainguard-v39-persistent-temporal-motion-feed-adapter";

    const CONFIG = {
        minPoints: 2,
        minDeltaMs: 1000,
        maxDeltaMs: 6 * 60 * 60 * 1000,
        maxPointsPerIdentity: 100,
        coordinatePrecision: 6
    };

    const state = {
        installed: true,
        running: false,
        runInProgress: false,
        runs: 0,
        lastRunAt: null,
        lastResult: null,
        lastError: null,

        sourceIdentityCount: 0,
        acceptedIdentityCount: 0,
        rejectedIdentityCount: 0,
        acceptedPointCount: 0,
        rejectedPointCount: 0,

        feed: []
    };

    function isFiniteNumber(value) {
        return Number.isFinite(Number(value));
    }

    function normalizeNumber(value) {
        if (!isFiniteNumber(value)) {
            return null;
        }

        return Number(value);
    }

    function normalizeTimestamp(value) {
        if (value === null || value === undefined) {
            return null;
        }

        if (typeof value === "number" && Number.isFinite(value)) {
            if (value > 0 && value < 100000000000) {
                return Math.round(value * 1000);
            }

            if (value >= 100000000000) {
                return Math.round(value);
            }
        }

        if (typeof value === "string") {
            const numeric = Number(value);

            if (Number.isFinite(numeric)) {
                return normalizeTimestamp(numeric);
            }

            const parsed = Date.parse(value);

            if (Number.isFinite(parsed)) {
                return parsed;
            }
        }

        return null;
    }

    function firstDefined(object, keys) {
        if (!object || typeof object !== "object") {
            return undefined;
        }

        for (const key of keys) {
            if (
                Object.prototype.hasOwnProperty.call(object, key) &&
                object[key] !== undefined &&
                object[key] !== null
            ) {
                return object[key];
            }
        }

        return undefined;
    }

    function extractCoordinate(record) {
        if (!record || typeof record !== "object") {
            return null;
        }

        const nestedCandidates = [
            record.currentCoordinate,
            record.coordinate,
            record.coordinates,
            record.position,
            record.location,
            record.point,
            record.centroid
        ];

        let latitude = firstDefined(record, [
            "latitude",
            "lat",
            "y"
        ]);

        let longitude = firstDefined(record, [
            "longitude",
            "lon",
            "lng",
            "x"
        ]);

        if (!isFiniteNumber(latitude) || !isFiniteNumber(longitude)) {
            for (const nested of nestedCandidates) {
                if (!nested || typeof nested !== "object") {
                    continue;
                }

                const nestedLat = firstDefined(nested, [
                    "latitude",
                    "lat",
                    "y"
                ]);

                const nestedLon = firstDefined(nested, [
                    "longitude",
                    "lon",
                    "lng",
                    "x"
                ]);

                if (isFiniteNumber(nestedLat) && isFiniteNumber(nestedLon)) {
                    latitude = nestedLat;
                    longitude = nestedLon;
                    break;
                }
            }
        }

        latitude = normalizeNumber(latitude);
        longitude = normalizeNumber(longitude);

        if (latitude === null || longitude === null) {
            return null;
        }

        if (latitude < -90 || latitude > 90) {
            return null;
        }

        if (longitude < -180 || longitude > 180) {
            return null;
        }

        /*
         * Important:
         * Reject artificial zero coordinate.
         */
        if (latitude === 0 && longitude === 0) {
            return null;
        }

        return {
            latitude: Number(latitude.toFixed(CONFIG.coordinatePrecision)),
            longitude: Number(longitude.toFixed(CONFIG.coordinatePrecision))
        };
    }

    function extractTimestamp(record) {
        if (!record || typeof record !== "object") {
            return null;
        }

        const candidates = [
            record.observedAt,
            record.timestamp,
            record.time,
            record.observationTime,
            record.updatedAt,
            record.createdAt,
            record.lastSeenAt,
            record.firstSeenAt
        ];

        if (record.currentCoordinate && typeof record.currentCoordinate === "object") {
            candidates.unshift(
                record.currentCoordinate.observedAt,
                record.currentCoordinate.timestamp,
                record.currentCoordinate.time
            );
        }

        for (const candidate of candidates) {
            const normalized = normalizeTimestamp(candidate);

            if (normalized !== null) {
                return normalized;
            }
        }

        return null;
    }

    function extractIdentityId(identity, fallbackIndex) {
        if (!identity || typeof identity !== "object") {
            return `TEMPORAL-${fallbackIndex}`;
        }

        const value = firstDefined(identity, [
            "persistentId",
            "canonicalTrackId",
            "canonicalId",
            "identityId",
            "trackId",
            "cellId",
            "id"
        ]);

        if (value === undefined || value === null || String(value).trim() === "") {
            return `TEMPORAL-${fallbackIndex}`;
        }

        return String(value);
    }

    function extractObservations(identity) {
        if (!identity || typeof identity !== "object") {
            return [];
        }

        const candidates = [
            identity.motionReadyObservations,
            identity.temporalObservations,
            identity.observations,
            identity.history,
            identity.points,
            identity.records,
            identity.samples,
            identity.timeline,
            identity.motionHistory
        ];

        for (const candidate of candidates) {
            if (Array.isArray(candidate) && candidate.length > 0) {
                return candidate;
            }
        }

        /*
         * Some reconciliation outputs contain first/last observation.
         */
        const pair = [];

        if (identity.firstObservation) {
            pair.push(identity.firstObservation);
        }

        if (identity.lastObservation) {
            pair.push(identity.lastObservation);
        }

        if (pair.length > 0) {
            return pair;
        }

        return [];
    }

    function normalizeObservation(record, identityId, index) {
        const coordinate = extractCoordinate(record);
        const timestamp = extractTimestamp(record);

        if (!coordinate || timestamp === null) {
            return null;
        }

        return {
            identityId,
            trackId: firstDefined(record, [
                "trackId",
                "canonicalTrackId",
                "cellId",
                "id"
            ]) ?? identityId,

            latitude: coordinate.latitude,
            longitude: coordinate.longitude,

            lat: coordinate.latitude,
            lon: coordinate.longitude,
            lng: coordinate.longitude,

            observedAt: timestamp,
            timestamp,

            intensity: normalizeNumber(
                firstDefined(record, [
                    "intensity",
                    "rainIntensity",
                    "reflectivity",
                    "dbz"
                ])
            ),

            confidence: normalizeNumber(
                firstDefined(record, [
                    "confidence",
                    "score",
                    "quality"
                ])
            ),

            source:
                firstDefined(record, [
                    "source",
                    "sourceName",
                    "provider"
                ]) ??
                "Phase39A15F2",

            sequenceIndex: index,

            original: record
        };
    }

    function removeDuplicatePoints(points) {
        const output = [];
        const seen = new Set();

        for (const point of points) {
            const key = [
                point.latitude,
                point.longitude,
                point.timestamp
            ].join("|");

            if (seen.has(key)) {
                continue;
            }

            seen.add(key);
            output.push(point);
        }

        return output;
    }

    function validateSequentialPoints(points) {
        if (!Array.isArray(points) || points.length < CONFIG.minPoints) {
            return [];
        }

        const sorted = [...points].sort(
            (a, b) => a.timestamp - b.timestamp
        );

        const unique = removeDuplicatePoints(sorted);

        const accepted = [];

        for (const point of unique) {
            if (accepted.length === 0) {
                accepted.push(point);
                continue;
            }

            const previous = accepted[accepted.length - 1];

            const deltaMs = point.timestamp - previous.timestamp;

            if (deltaMs < CONFIG.minDeltaMs) {
                continue;
            }

            if (deltaMs > CONFIG.maxDeltaMs) {
                /*
                 * Keep the new point as a possible start of a new sequence,
                 * but don't falsely connect it to the old observation.
                 */
                if (accepted.length < 2) {
                    accepted.length = 0;
                    accepted.push(point);
                }

                continue;
            }

            const sameCoordinate =
                point.latitude === previous.latitude &&
                point.longitude === previous.longitude;

            /*
             * Same coordinate is allowed to remain in source history,
             * but it cannot alone prove motion.
             */
            if (sameCoordinate) {
                continue;
            }

            accepted.push(point);

            if (accepted.length >= CONFIG.maxPointsPerIdentity) {
                break;
            }
        }

        return accepted;
    }

    function locateTemporalIdentitySource() {
        const candidates = [
            {
                name: "RainGuardPersistentTemporalIdentitiesV39",
                value: global.RainGuardPersistentTemporalIdentitiesV39
            },
            {
                name: "RainGuardPersistentTemporalIdentities",
                value: global.RainGuardPersistentTemporalIdentities
            },
            {
                name: "RainGuardTemporalIdentitiesV39",
                value: global.RainGuardTemporalIdentitiesV39
            },
            {
                name: "RainGuardTemporalIdentities",
                value: global.RainGuardTemporalIdentities
            },
            {
                name: "RainGuardPersistentStormIdentitiesV39",
                value: global.RainGuardPersistentStormIdentitiesV39
            }
        ];

        for (const candidate of candidates) {
            if (Array.isArray(candidate.value) && candidate.value.length > 0) {
                return candidate;
            }

            if (
                candidate.value instanceof Map &&
                candidate.value.size > 0
            ) {
                return {
                    name: candidate.name,
                    value: [...candidate.value.values()]
                };
            }
        }

        const reconciliation =
            global.RainGuardPersistentTemporalIdentityReconciliationResult ||
            global.RainGuardPersistentTemporalIdentityReconciliationLastResult ||
            global.RainGuardTemporalIdentityReconciliationResult;

        if (
            reconciliation &&
            Array.isArray(reconciliation.identities) &&
            reconciliation.identities.length > 0
        ) {
            return {
                name: "TemporalIdentityReconciliationResult.identities",
                value: reconciliation.identities
            };
        }

        return {
            name: null,
            value: []
        };
    }

    function publishFeed(feed) {
        global.RainGuardPersistentTemporalMotionFeedV39 = feed;
        global.RainGuardPersistentMotionReadyFeedV39 = feed;
        global.RainGuardTemporalMotionFeedV39 = feed;

        /*
         * Compatibility object for downstream builder.
         */
        global.RainGuardPersistentTemporalMotionFeedBridgeV39 = {
            phase: PHASE,
            version: VERSION,
            build: BUILD,
            generatedAt: Date.now(),
            identityCount: feed.length,
            pointCount: feed.reduce(
                (sum, item) => sum + item.observations.length,
                0
            ),
            identities: feed,
            feed
        };

        return global.RainGuardPersistentTemporalMotionFeedBridgeV39;
    }

    async function run(options = {}) {
        if (state.runInProgress) {
            return {
                success: true,
                phase: PHASE,
                version: VERSION,
                status: "TEMPORAL_MOTION_FEED_RUN_ALREADY_IN_PROGRESS",
                feed: state.feed
            };
        }

        state.runInProgress = true;
        state.running = true;
        state.runs += 1;
        state.lastRunAt = Date.now();
        state.lastError = null;

        try {
            /*
             * If requested, refresh upstream temporal identity reconciliation.
             */
            if (
                options.refreshUpstream !== false &&
                typeof global.runRainGuardPersistentTemporalIdentityReconciliation ===
                    "function"
            ) {
                try {
                    await global.runRainGuardPersistentTemporalIdentityReconciliation({
                        runMotionBuilder: false
                    });
                } catch (error) {
                    console.warn(
                        `[RainGuard Phase ${PHASE}] Upstream refresh warning:`,
                        error
                    );
                }
            }

            const source = locateTemporalIdentitySource();
            const identities = Array.isArray(source.value)
                ? source.value
                : [];

            state.sourceIdentityCount = identities.length;
            state.acceptedIdentityCount = 0;
            state.rejectedIdentityCount = 0;
            state.acceptedPointCount = 0;
            state.rejectedPointCount = 0;

            const feed = [];

            identities.forEach((identity, identityIndex) => {
                const identityId = extractIdentityId(
                    identity,
                    identityIndex
                );

                const rawObservations =
                    extractObservations(identity);

                const normalized = rawObservations
                    .map((record, index) =>
                        normalizeObservation(
                            record,
                            identityId,
                            index
                        )
                    )
                    .filter(Boolean);

                state.rejectedPointCount +=
                    rawObservations.length - normalized.length;

                const sequential =
                    validateSequentialPoints(normalized);

                if (sequential.length < CONFIG.minPoints) {
                    state.rejectedIdentityCount += 1;
                    return;
                }

                state.acceptedIdentityCount += 1;
                state.acceptedPointCount += sequential.length;

                feed.push({
                    identityId,
                    persistentId: identityId,
                    canonicalTrackId: identityId,

                    pointCount: sequential.length,
                    firstTimestamp: sequential[0].timestamp,
                    lastTimestamp:
                        sequential[sequential.length - 1].timestamp,

                    observations: sequential,
                    points: sequential,
                    history: sequential,

                    source:
                        source.name ||
                        "Phase39A15F2",

                    temporalIdentity: identity
                });
            });

            state.feed = feed;

            const published = publishFeed(feed);

            let status;

            if (identities.length === 0) {
                status =
                    "NO_TEMPORAL_IDENTITIES_FOUND";
            } else if (feed.length === 0) {
                status =
                    "TEMPORAL_IDENTITIES_FOUND_BUT_NO_VALID_SEQUENTIAL_FEED";
            } else {
                status =
                    "TEMPORAL_MOTION_FEED_READY";
            }

            const result = {
                success: true,
                phase: PHASE,
                version: VERSION,
                build: BUILD,

                status,

                source: source.name,

                sourceIdentityCount:
                    state.sourceIdentityCount,

                acceptedIdentityCount:
                    state.acceptedIdentityCount,

                rejectedIdentityCount:
                    state.rejectedIdentityCount,

                acceptedPointCount:
                    state.acceptedPointCount,

                rejectedPointCount:
                    state.rejectedPointCount,

                feedCount: feed.length,

                feed,
                published,

                generatedAt: Date.now()
            };

            state.lastResult = result;

            console.log(
                `[RainGuard Phase ${PHASE}] Temporal Motion Feed Adapter result:`,
                result
            );

            return result;
        } catch (error) {
            state.lastError = error;

            const result = {
                success: false,
                phase: PHASE,
                version: VERSION,
                build: BUILD,
                status:
                    "TEMPORAL_MOTION_FEED_ADAPTER_FAILED",
                error:
                    error?.message ||
                    String(error)
            };

            state.lastResult = result;

            console.error(
                `[RainGuard Phase ${PHASE}]`,
                error
            );

            return result;
        } finally {
            state.running = false;
            state.runInProgress = false;
        }
    }

    function diagnose() {
        return {
            phase: PHASE,
            version: VERSION,
            build: BUILD,

            installed: true,
            running: state.running,
            runInProgress: state.runInProgress,

            statistics: {
                runs: state.runs,
                sourceIdentityCount:
                    state.sourceIdentityCount,
                acceptedIdentityCount:
                    state.acceptedIdentityCount,
                rejectedIdentityCount:
                    state.rejectedIdentityCount,
                acceptedPointCount:
                    state.acceptedPointCount,
                rejectedPointCount:
                    state.rejectedPointCount,
                feedCount:
                    state.feed.length
            },

            hasTemporalIdentityRunner:
                typeof global.runRainGuardPersistentTemporalIdentityReconciliation ===
                "function",

            lastError:
                state.lastError,

            lastResult:
                state.lastResult
        };
    }

    global.runRainGuardPersistentTemporalMotionFeedAdapter =
        run;

    global.diagnoseRainGuardPersistentTemporalMotionFeedAdapter =
        diagnose;

    global.getRainGuardPersistentTemporalMotionFeed =
        function () {
            return state.feed;
        };

    global.RainGuardPersistentTemporalMotionFeedAdapterV39 = {
        phase: PHASE,
        version: VERSION,
        build: BUILD,
        config: CONFIG,
        state,
        run,
        diagnose,
        getFeed() {
            return state.feed;
        }
    };

    console.log(
        `[RainGuard Phase ${PHASE}] Persistent Temporal Motion Feed Adapter installed.`,
        {
            phase: PHASE,
            version: VERSION,
            build: BUILD
        }
    );

})(window);
