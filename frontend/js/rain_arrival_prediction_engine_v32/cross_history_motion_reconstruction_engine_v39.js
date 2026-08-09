/*
===============================================================================
 RainGuard AI
 Phase 39A-15B — Cross-History Motion Reconstruction Engine
 File: cross_history_motion_reconstruction_engine_v39.js
 Version: 39A.15B.0

 Purpose:
 - Read real records from RainArrivalLiveTrackHistory / RainArrivalTrackHistoryV32
 - Normalize trackId, cellId, latitude, longitude, observedAt/timestamp
 - Reconstruct motion across history keys instead of relying on bucketLength >= 2
 - Group sequential observations by storm identity
 - Compute distance, bearing, speed and confidence
 - Publish recovered vectors to RainGuardStormMotionVectorsV39
 - Patch current entities / Phase 39A-13 matches when possible
 - Trigger Phase 39A-14 after motion recovery
===============================================================================
*/

(function initCrossHistoryMotionReconstructionEngineV39(global) {
    "use strict";

    const PHASE = "39A-15B";
    const VERSION = "39A.15B.0";
    const BUILD = "rainguard-v39-cross-history-motion-reconstruction-engine";

    const CONFIG = Object.freeze({
        autoStart: true,
        refreshIntervalMs: 5000,

        maxHistoryAgeMs: 8 * 60 * 60 * 1000,
        minDeltaMs: 5000,
        maxDeltaMs: 3 * 60 * 60 * 1000,

        minDistanceKm: 0.03,
        maxPlausibleSpeedKmh: 250,

        minPointsForVector: 2,
        smoothingPairs: 4,

        preferTrackId: true,
        allowCellIdFallback: true,

        patchCollector: true,
        patchMatchingBridge: true,
        triggerEtaAdapter: true,

        maxRecordsPerRun: 10000,
        sampleSize: 10
    });

    const now = () => Date.now();

    function clone(value) {
        if (value == null) return value;

        try {
            return structuredClone(value);
        } catch (_) {
            try {
                return JSON.parse(JSON.stringify(value));
            } catch (_) {
                return value;
            }
        }
    }

    function normalizeError(error) {
        return {
            name: error?.name || "Error",
            message: error?.message || String(error),
            stack: error?.stack || null,
            timestamp: now()
        };
    }

    function finiteNumber(value) {
        const n = Number(value);
        return Number.isFinite(n) ? n : null;
    }

    function normalizeTimestamp(value) {
        if (value == null) {
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

        return Number.isFinite(parsed)
            ? parsed
            : null;
    }

    function normalizeArray(value) {
        if (!value) {
            return [];
        }

        if (Array.isArray(value)) {
            return value;
        }

        if (value instanceof Map || value instanceof Set) {
            return Array.from(value.values());
        }

        if (typeof value === "object") {
            return [value];
        }

        return [];
    }

    function getHistorySources() {
        const sources = [];

        const push = (name, value) => {
            if (value && typeof value === "object") {
                sources.push({
                    name,
                    value
                });
            }
        };

        push(
            "RainArrivalLiveTrackHistory",
            global.RainArrivalLiveTrackHistory
        );

        push(
            "RainArrivalTrackHistoryV32",
            global.RainArrivalTrackHistoryV32
        );

        push(
            "RainArrivalTrackHistoryStoreV32",
            global.RainArrivalTrackHistoryStoreV32
        );

        return sources;
    }

    function extractLat(record) {
        return finiteNumber(
            record?.latitude ??
            record?.lat ??
            record?.coordinate?.latitude ??
            record?.coordinate?.lat ??
            record?.position?.latitude ??
            record?.position?.lat ??
            record?.center?.latitude ??
            record?.center?.lat
        );
    }

    function extractLon(record) {
        return finiteNumber(
            record?.longitude ??
            record?.lon ??
            record?.lng ??
            record?.coordinate?.longitude ??
            record?.coordinate?.lon ??
            record?.coordinate?.lng ??
            record?.position?.longitude ??
            record?.position?.lon ??
            record?.position?.lng ??
            record?.center?.longitude ??
            record?.center?.lon ??
            record?.center?.lng
        );
    }

    function extractTimestamp(record) {
        return normalizeTimestamp(
            record?.timestamp ??
            record?.observedAt ??
            record?.time ??
            record?.ts ??
            record?.capturedAt ??
            record?.createdAt ??
            record?.updatedAt
        );
    }

    function extractTrackId(record, historyKey) {
        const raw =
            record?.trackId ??
            record?.stableTrackId ??
            record?.stormTrackId ??
            record?.entityId ??
            null;

        if (raw != null && String(raw).trim()) {
            return String(raw);
        }

        if (
            typeof historyKey === "string" &&
            historyKey.startsWith("RST-")
        ) {
            return historyKey;
        }

        return null;
    }

    function extractCellId(record) {
        const raw =
            record?.cellId ??
            record?.stormCellId ??
            record?.stormId ??
            null;

        return raw != null && String(raw).trim()
            ? String(raw)
            : null;
    }

    function buildIdentity(record, historyKey) {
        const trackId =
            extractTrackId(
                record,
                historyKey
            );

        const cellId =
            extractCellId(
                record
            );

        if (
            CONFIG.preferTrackId &&
            trackId
        ) {
            return {
                identity: `track:${trackId}`,
                trackId,
                cellId,
                identityType: "trackId"
            };
        }

        if (
            CONFIG.allowCellIdFallback &&
            cellId
        ) {
            return {
                identity: `cell:${cellId}`,
                trackId,
                cellId,
                identityType: "cellId"
            };
        }

        if (trackId) {
            return {
                identity: `track:${trackId}`,
                trackId,
                cellId,
                identityType: "trackId"
            };
        }

        return {
            identity: null,
            trackId,
            cellId,
            identityType: null
        };
    }

    function normalizeRecord(
        record,
        historyKey,
        sourceName,
        bucketIndex
    ) {
        if (
            !record ||
            typeof record !== "object"
        ) {
            return null;
        }

        const latitude =
            extractLat(record);

        const longitude =
            extractLon(record);

        const timestamp =
            extractTimestamp(record);

        const identityInfo =
            buildIdentity(
                record,
                historyKey
            );

        if (
            latitude == null ||
            longitude == null ||
            timestamp == null ||
            !identityInfo.identity
        ) {
            return null;
        }

        return {
            identity:
                identityInfo.identity,

            identityType:
                identityInfo.identityType,

            trackId:
                identityInfo.trackId,

            cellId:
                identityInfo.cellId,

            latitude,
            longitude,
            timestamp,

            observedAt:
                record?.observedAt ?? null,

            confidence:
                finiteNumber(
                    record?.confidence
                ),

            intensity:
                finiteNumber(
                    record?.intensity
                ),

            source:
                record?.source ??
                sourceName,

            historyKey,
            bucketIndex,

            raw:
                record
        };
    }

    function flattenHistoryObject(
        sourceName,
        historyObject
    ) {
        const records = [];

        if (
            !historyObject ||
            typeof historyObject !== "object"
        ) {
            return records;
        }

        const keys =
            Object.keys(historyObject);

        for (
            let i = 0;
            i < keys.length;
            i += 1
        ) {
            if (
                records.length >=
                CONFIG.maxRecordsPerRun
            ) {
                break;
            }

            const historyKey =
                keys[i];

            const bucket =
                normalizeArray(
                    historyObject[
                        historyKey
                    ]
                );

            for (
                let j = 0;
                j < bucket.length;
                j += 1
            ) {
                const normalized =
                    normalizeRecord(
                        bucket[j],
                        historyKey,
                        sourceName,
                        j
                    );

                if (normalized) {
                    records.push(
                        normalized
                    );
                }
            }
        }

        return records;
    }

    function dedupeRecords(records) {
        const seen =
            new Set();

        const output =
            [];

        for (
            const record
            of records
        ) {
            const key = [
                record.identity,
                record.latitude,
                record.longitude,
                record.timestamp
            ].join("|");

            if (
                seen.has(key)
            ) {
                continue;
            }

            seen.add(key);

            output.push(
                record
            );
        }

        return output;
    }

    function groupByIdentity(records) {
        const groups =
            new Map();

        const cutoff =
            now() -
            CONFIG.maxHistoryAgeMs;

        for (
            const record
            of records
        ) {
            if (
                record.timestamp <
                cutoff
            ) {
                continue;
            }

            if (
                !groups.has(
                    record.identity
                )
            ) {
                groups.set(
                    record.identity,
                    []
                );
            }

            groups
                .get(
                    record.identity
                )
                .push(record);
        }

        for (
            const observations
            of groups.values()
        ) {
            observations.sort(
                (a, b) =>
                    a.timestamp -
                    b.timestamp
            );
        }

        return groups;
    }

    function haversineKm(
        lat1,
        lon1,
        lat2,
        lon2
    ) {
        const toRad =
            degree =>
                degree *
                Math.PI /
                180;

        const radiusKm =
            6371;

        const dLat =
            toRad(
                lat2 - lat1
            );

        const dLon =
            toRad(
                lon2 - lon1
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

        return (
            2 *
            radiusKm *
            Math.atan2(
                Math.sqrt(a),
                Math.sqrt(1 - a)
            )
        );
    }

    function bearingDeg(
        lat1,
        lon1,
        lat2,
        lon2
    ) {
        const toRad =
            degree =>
                degree *
                Math.PI /
                180;

        const toDeg =
            radian =>
                radian *
                180 /
                Math.PI;

        const p1 =
            toRad(lat1);

        const p2 =
            toRad(lat2);

        const deltaLon =
            toRad(
                lon2 - lon1
            );

        const y =
            Math.sin(deltaLon) *
            Math.cos(p2);

        const x =
            Math.cos(p1) *
            Math.sin(p2) -
            Math.sin(p1) *
            Math.cos(p2) *
            Math.cos(deltaLon);

        return (
            toDeg(
                Math.atan2(
                    y,
                    x
                )
            ) +
            360
        ) % 360;
    }

    function circularMeanDegrees(
        angles
    ) {
        const valid =
            angles.filter(
                Number.isFinite
            );

        if (
            valid.length === 0
        ) {
            return null;
        }

        let x = 0;
        let y = 0;

        for (
            const angle
            of valid
        ) {
            const rad =
                angle *
                Math.PI /
                180;

            x +=
                Math.cos(rad);

            y +=
                Math.sin(rad);
        }

        return (
            Math.atan2(
                y / valid.length,
                x / valid.length
            ) *
            180 /
            Math.PI +
            360
        ) % 360;
    }

    function computePair(
        previous,
        current
    ) {
        const deltaMs =
            current.timestamp -
            previous.timestamp;

        if (
            deltaMs <
                CONFIG.minDeltaMs ||
            deltaMs >
                CONFIG.maxDeltaMs
        ) {
            return null;
        }

        const distanceKm =
            haversineKm(
                previous.latitude,
                previous.longitude,
                current.latitude,
                current.longitude
            );

        if (
            distanceKm <
                CONFIG.minDistanceKm
        ) {
            return null;
        }

        const hours =
            deltaMs /
            3600000;

        const speedKmh =
            distanceKm /
            hours;

        if (
            !Number.isFinite(
                speedKmh
            ) ||
            speedKmh <= 0 ||
            speedKmh >
                CONFIG.maxPlausibleSpeedKmh
        ) {
            return null;
        }

        const directionDeg =
            bearingDeg(
                previous.latitude,
                previous.longitude,
                current.latitude,
                current.longitude
            );

        return {
            fromTimestamp:
                previous.timestamp,

            toTimestamp:
                current.timestamp,

            fromLatitude:
                previous.latitude,

            fromLongitude:
                previous.longitude,

            toLatitude:
                current.latitude,

            toLongitude:
                current.longitude,

            deltaMs,

            deltaMinutes:
                deltaMs /
                60000,

            distanceKm,

            speedKmh,

            directionDeg
        };
    }

    function reconstructVector(
        identity,
        observations
    ) {
        if (
            !Array.isArray(
                observations
            ) ||
            observations.length <
                CONFIG.minPointsForVector
        ) {
            return null;
        }

        const pairs =
            [];

        for (
            let i = 1;
            i < observations.length;
            i += 1
        ) {
            const pair =
                computePair(
                    observations[
                        i - 1
                    ],
                    observations[i]
                );

            if (pair) {
                pairs.push(pair);
            }
        }

        if (
            pairs.length === 0
        ) {
            return null;
        }

        const selectedPairs =
            pairs.slice(
                Math.max(
                    0,
                    pairs.length -
                        CONFIG.smoothingPairs
                )
            );

        const speedKmh =
            selectedPairs.reduce(
                (sum, pair) =>
                    sum +
                    pair.speedKmh,
                0
            ) /
            selectedPairs.length;

        const directionDeg =
            circularMeanDegrees(
                selectedPairs.map(
                    pair =>
                        pair.directionDeg
                )
            );

        const latestObservation =
            observations[
                observations.length - 1
            ];

        const earliestObservation =
            observations[
                Math.max(
                    0,
                    observations.length -
                        selectedPairs.length -
                        1
                )
            ];

        const trackId =
            latestObservation.trackId ??
            observations.find(
                item =>
                    item.trackId
            )?.trackId ??
            null;

        const cellId =
            latestObservation.cellId ??
            observations.find(
                item =>
                    item.cellId
            )?.cellId ??
            null;

        const avgConfidenceValues =
            observations
                .map(
                    item =>
                        item.confidence
                )
                .filter(
                    Number.isFinite
                );

        const confidence =
            avgConfidenceValues.length
                ? avgConfidenceValues.reduce(
                    (sum, value) =>
                        sum + value,
                    0
                ) /
                avgConfidenceValues.length
                : null;

        return {
            identity,
            identityType:
                latestObservation
                    .identityType,

            trackId,
            cellId,

            speedKmh:
                Math.round(
                    speedKmh * 10
                ) / 10,

            directionDeg:
                Math.round(
                    directionDeg * 10
                ) / 10,

            confidence:
                confidence == null
                    ? null
                    : Math.round(
                        confidence * 1000
                    ) / 1000,

            observationCount:
                observations.length,

            validPairCount:
                pairs.length,

            smoothedPairCount:
                selectedPairs.length,

            firstObservedAt:
                earliestObservation
                    .timestamp,

            lastObservedAt:
                latestObservation
                    .timestamp,

            latitude:
                latestObservation
                    .latitude,

            longitude:
                latestObservation
                    .longitude,

            latestSource:
                latestObservation
                    .source,

            latestHistoryKey:
                latestObservation
                    .historyKey,

            lastSegment:
                clone(
                    selectedPairs[
                        selectedPairs.length -
                        1
                    ]
                ),

            source:
                "cross-history-motion-reconstruction",

            phase:
                PHASE,

            version:
                VERSION,

            recoveredAt:
                now()
        };
    }

    function resolveCollector() {
        return (
            global
                .RainArrivalStormEntityCollectorV32 ||
            global
                .RainGuardAI
                ?.V32
                ?.rainArrivalModules
                ?.stormEntityCollector ||
            null
        );
    }

    function resolveMatchingBridge() {
        return (
            global
                .RainGuardCityStormEntityMatchingBridgeV39 ||
            global
                .RainGuardAI
                ?.V39
                ?.cityStormEntityMatchingBridge ||
            null
        );
    }

    function resolveEtaAdapter() {
        return (
            global
                .RainGuardMatchedStormArrivalEtaAdapterV39 ||
            global
                .RainGuardAI
                ?.V39
                ?.matchedStormArrivalEtaAdapterInstance ||
            null
        );
    }

    function entityIdentityCandidates(
        entity
    ) {
        if (
            !entity ||
            typeof entity !==
                "object"
        ) {
            return [];
        }

        const values = [
            entity.trackId,
            entity.stableTrackId,
            entity.stormTrackId,
            entity.entityId,
            entity.cellId,
            entity.stormCellId,
            entity.stormId,
            entity.id
        ]
            .filter(
                value =>
                    value != null &&
                    String(value)
                        .trim()
            )
            .map(String);

        const candidates =
            [];

        for (
            const value
            of values
        ) {
            candidates.push(
                `track:${value}`
            );

            candidates.push(
                `cell:${value}`
            );
        }

        return [
            ...new Set(
                candidates
            )
        ];
    }

    function findVectorForEntity(
        entity,
        vectorMap
    ) {
        for (
            const candidate
            of entityIdentityCandidates(
                entity
            )
        ) {
            if (
                vectorMap.has(
                    candidate
                )
            ) {
                return vectorMap.get(
                    candidate
                );
            }
        }

        return null;
    }

    function patchMotion(
        target,
        vector
    ) {
        if (
            !target ||
            typeof target !==
                "object" ||
            !vector
        ) {
            return false;
        }

        target.speedKmh =
            vector.speedKmh;

        target.directionDeg =
            vector.directionDeg;

        target.motion = {
            ...(target.motion || {}),

            speedKmh:
                vector.speedKmh,

            directionDeg:
                vector.directionDeg,

            confidence:
                vector.confidence,

            source:
                PHASE,

            recoveredAt:
                vector.recoveredAt
        };

        target.motionVector = {
            ...(target.motionVector || {}),

            speedKmh:
                vector.speedKmh,

            directionDeg:
                vector.directionDeg,

            source:
                PHASE,

            recoveredAt:
                vector.recoveredAt
        };

        target.motionRecoveredBy =
            PHASE;

        target.motionRecoveredAt =
            vector.recoveredAt;

        return true;
    }

    class CrossHistoryMotionReconstructionEngineV39 {
        constructor() {
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

            this.vectorMap =
                new Map();

            this.lastResult =
                null;

            this.lastError =
                null;

            this.statistics = {
                runs: 0,
                skippedRuns: 0,
                rawRecords: 0,
                normalizedRecords: 0,
                dedupedRecords: 0,
                groupedIdentities: 0,
                groupsWithMultiplePoints: 0,
                vectorsRecovered: 0,
                collectorEntitiesPatched: 0,
                matchingRecordsPatched: 0,
                etaTriggers: 0,
                failures: 0
            };
        }

        collect() {
            const sourceReports =
                [];

            let records =
                [];

            for (
                const source
                of getHistorySources()
            ) {
                const flattened =
                    flattenHistoryObject(
                        source.name,
                        source.value
                    );

                sourceReports.push({
                    source:
                        source.name,

                    historyKeyCount:
                        Object.keys(
                            source.value
                        ).length,

                    normalizedRecordCount:
                        flattened.length
                });

                records.push(
                    ...flattened
                );
            }

            const deduped =
                dedupeRecords(
                    records
                );

            return {
                sourceReports,
                records,
                deduped
            };
        }

        reconstruct(records) {
            const groups =
                groupByIdentity(
                    records
                );

            const vectors =
                new Map();

            let groupsWithMultiplePoints =
                0;

            for (
                const [
                    identity,
                    observations
                ]
                of groups.entries()
            ) {
                if (
                    observations.length >=
                    CONFIG.minPointsForVector
                ) {
                    groupsWithMultiplePoints +=
                        1;
                }

                const vector =
                    reconstructVector(
                        identity,
                        observations
                    );

                if (vector) {
                    vectors.set(
                        identity,
                        vector
                    );
                }
            }

            return {
                groups,
                vectors,
                groupsWithMultiplePoints
            };
        }

        patchCollector(
            vectors
        ) {
            if (
                !CONFIG.patchCollector
            ) {
                return 0;
            }

            const collector =
                resolveCollector();

            if (!collector) {
                return 0;
            }

            let patched =
                0;

            const patchEntity =
                entity => {
                    const vector =
                        findVectorForEntity(
                            entity,
                            vectors
                        );

                    if (
                        vector &&
                        patchMotion(
                            entity,
                            vector
                        )
                    ) {
                        patched += 1;
                    }
                };

            try {
                if (
                    collector.entities
                    instanceof Map
                ) {
                    for (
                        const entity
                        of collector
                            .entities
                            .values()
                    ) {
                        patchEntity(
                            entity
                        );
                    }
                }
            } catch (_) {}

            try {
                if (
                    typeof collector.getAll ===
                    "function"
                ) {
                    const all =
                        normalizeArray(
                            collector
                                .getAll()
                        );

                    for (
                        const entity
                        of all
                    ) {
                        patchEntity(
                            entity
                        );
                    }
                }
            } catch (_) {}

            return patched;
        }

        patchMatching(
            vectors
        ) {
            if (
                !CONFIG.patchMatchingBridge
            ) {
                return 0;
            }

            const bridge =
                resolveMatchingBridge();

            const result =
                bridge?.lastResult ??
                global
                    .RainGuardAI
                    ?.V39
                    ?.cityStormEntityMatching ??
                null;

            if (!result) {
                return 0;
            }

            const buckets =
                [];

            if (
                Array.isArray(
                    result.bestMatches
                )
            ) {
                buckets.push(
                    result.bestMatches
                );
            }

            if (
                result.matchesByCity &&
                typeof result.matchesByCity ===
                    "object"
            ) {
                for (
                    const value
                    of Object.values(
                        result.matchesByCity
                    )
                ) {
                    if (
                        Array.isArray(
                            value
                        )
                    ) {
                        buckets.push(
                            value
                        );
                    }
                }
            }

            let patched =
                0;

            for (
                const bucket
                of buckets
            ) {
                for (
                    const match
                    of bucket
                ) {
                    const stormEntity =
                        match
                            .rawStormEntity ??
                        match
                            .stormEntity ??
                        match;

                    const vector =
                        findVectorForEntity(
                            stormEntity,
                            vectors
                        );

                    if (!vector) {
                        continue;
                    }

                    patchMotion(
                        stormEntity,
                        vector
                    );

                    match.speedKmh =
                        vector.speedKmh;

                    match.directionDeg =
                        vector.directionDeg;

                    match.stormDirectionDeg =
                        vector.directionDeg;

                    match.motionConfidence =
                        vector.confidence;

                    match.motionRecoveredBy =
                        PHASE;

                    match.motionRecoveredAt =
                        vector.recoveredAt;

                    patched += 1;
                }
            }

            return patched;
        }

        publish(
            vectors,
            result
        ) {
            const byIdentity =
                Object.fromEntries(
                    vectors.entries()
                );

            const byTrackId =
                {};

            const byCellId =
                {};

            for (
                const vector
                of vectors.values()
            ) {
                if (
                    vector.trackId
                ) {
                    byTrackId[
                        vector.trackId
                    ] =
                        vector;
                }

                if (
                    vector.cellId
                ) {
                    byCellId[
                        vector.cellId
                    ] =
                        vector;
                }
            }

            global
                .RainGuardStormMotionVectorsV39 =
                byIdentity;

            global
                .RainGuardStormMotionVectorsByTrackIdV39 =
                byTrackId;

            global
                .RainGuardStormMotionVectorsByCellIdV39 =
                byCellId;

            global.RainGuardAI =
                global.RainGuardAI ||
                {};

            global.RainGuardAI.V39 =
                global.RainGuardAI.V39 ||
                {};

            global
                .RainGuardAI
                .V39
                .crossHistoryMotionReconstruction =
                result;

            global
                .RainGuardAI
                .V39
                .stormMotionVectors =
                byIdentity;

            global
                .RainGuardAI
                .V39
                .stormMotionVectorsByTrackId =
                byTrackId;

            global
                .RainGuardAI
                .V39
                .stormMotionVectorsByCellId =
                byCellId;
        }

        async triggerDownstream() {
            if (
                !CONFIG.triggerEtaAdapter
            ) {
                return {
                    triggered:
                        false
                };
            }

            const matching =
                resolveMatchingBridge();

            if (
                matching &&
                typeof matching.run ===
                    "function"
            ) {
                try {
                    await Promise.resolve(
                        matching.run()
                    );
                } catch (_) {}
            }

            this.patchMatching(
                this.vectorMap
            );

            const etaAdapter =
                resolveEtaAdapter();

            if (
                etaAdapter &&
                typeof etaAdapter.run ===
                    "function"
            ) {
                this.statistics
                    .etaTriggers +=
                    1;

                try {
                    return {
                        triggered:
                            true,

                        etaResult:
                            await Promise.resolve(
                                etaAdapter.run()
                            )
                    };
                } catch (error) {
                    return {
                        triggered:
                            true,

                        etaError:
                            normalizeError(
                                error
                            )
                    };
                }
            }

            return {
                triggered:
                    false,

                reason:
                    "ETA_ADAPTER_UNAVAILABLE"
            };
        }

        async run(
            options = {}
        ) {
            if (
                this.runInProgress
            ) {
                this.statistics
                    .skippedRuns +=
                    1;

                return {
                    success:
                        true,

                    skipped:
                        true,

                    phase:
                        PHASE,

                    version:
                        VERSION,

                    status:
                        "CROSS_HISTORY_RECONSTRUCTION_ALREADY_RUNNING"
                };
            }

            this.runInProgress =
                true;

            this.statistics
                .runs +=
                1;

            try {
                const collection =
                    this.collect();

                this.statistics
                    .rawRecords +=
                    collection.records
                        .length;

                this.statistics
                    .normalizedRecords +=
                    collection.records
                        .length;

                this.statistics
                    .dedupedRecords +=
                    collection.deduped
                        .length;

                const reconstruction =
                    this.reconstruct(
                        collection.deduped
                    );

                this.vectorMap =
                    reconstruction.vectors;

                this.statistics
                    .groupedIdentities +=
                    reconstruction.groups
                        .size;

                this.statistics
                    .groupsWithMultiplePoints +=
                    reconstruction
                        .groupsWithMultiplePoints;

                this.statistics
                    .vectorsRecovered +=
                    reconstruction.vectors
                        .size;

                const collectorPatched =
                    this.patchCollector(
                        reconstruction.vectors
                    );

                const matchingPatched =
                    this.patchMatching(
                        reconstruction.vectors
                    );

                this.statistics
                    .collectorEntitiesPatched +=
                    collectorPatched;

                this.statistics
                    .matchingRecordsPatched +=
                    matchingPatched;

                const status =
                    reconstruction.vectors.size >
                    0
                        ? "CROSS_HISTORY_MOTION_VECTORS_RECOVERED"
                        : (
                            collection.deduped.length >
                            0
                                ? "HISTORY_FOUND_BUT_NO_VALID_SEQUENTIAL_MOTION"
                                : "NO_USABLE_HISTORY_RECORDS"
                        );

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

                    sourceReports:
                        collection.sourceReports,

                    historyRecordCount:
                        collection.records
                            .length,

                    dedupedRecordCount:
                        collection.deduped
                            .length,

                    groupedIdentityCount:
                        reconstruction.groups
                            .size,

                    groupsWithMultiplePoints:
                        reconstruction
                            .groupsWithMultiplePoints,

                    recoveredVectorCount:
                        reconstruction.vectors
                            .size,

                    collectorEntitiesPatched:
                        collectorPatched,

                    matchingRecordsPatched:
                        matchingPatched,

                    sample:
                        Array.from(
                            reconstruction.vectors
                                .values()
                        ).slice(
                            0,
                            CONFIG.sampleSize
                        ),

                    generatedAt:
                        now()
                };

                this.lastResult =
                    result;

                this.lastError =
                    null;

                this.publish(
                    reconstruction.vectors,
                    result
                );

                if (
                    options.triggerDownstream !==
                    false
                ) {
                    result.downstream =
                        await this
                            .triggerDownstream();
                }

                return result;

            } catch (error) {
                this.statistics
                    .failures +=
                    1;

                this.lastError =
                    normalizeError(
                        error
                    );

                const result = {
                    success:
                        false,

                    phase:
                        PHASE,

                    version:
                        VERSION,

                    status:
                        "CROSS_HISTORY_MOTION_RECONSTRUCTION_FAILED",

                    error:
                        this.lastError,

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
            return Array
                .from(
                    this.vectorMap
                        .values()
                )
                .map(
                    clone
                );
        }

        getByTrackId(
            trackId
        ) {
            const key =
                `track:${String(
                    trackId
                )}`;

            return clone(
                this.vectorMap
                    .get(key) ??
                null
            );
        }

        getByCellId(
            cellId
        ) {
            const key =
                `cell:${String(
                    cellId
                )}`;

            return clone(
                this.vectorMap
                    .get(key) ??
                null
            );
        }

        diagnose() {
            const diagnostics = {
                phase:
                    PHASE,

                version:
                    VERSION,

                build:
                    BUILD,

                running:
                    this.running,

                runInProgress:
                    this.runInProgress,

                vectorCount:
                    this.vectorMap
                        .size,

                statistics:
                    clone(
                        this.statistics
                    ),

                lastResult:
                    clone(
                        this.lastResult
                    ),

                lastError:
                    clone(
                        this.lastError
                    )
            };

            console.log(
                "[RainGuard Phase 39A-15B] Cross-History Motion Reconstruction",
                diagnostics
            );

            return diagnostics;
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

            Promise.resolve(
                this.run()
            ).catch(
                error => {
                    this.lastError =
                        normalizeError(
                            error
                        );
                }
            );

            this.timer =
                global.setInterval(
                    () => {
                        Promise.resolve(
                            this.run()
                        ).catch(
                            error => {
                                this.lastError =
                                    normalizeError(
                                        error
                                    );
                            }
                        );
                    },

                    CONFIG
                        .refreshIntervalMs
                );

            return {
                success:
                    true,

                running:
                    true,

                intervalMs:
                    CONFIG
                        .refreshIntervalMs
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

                running:
                    false
            };
        }
    }

    const engine =
        new CrossHistoryMotionReconstructionEngineV39();

    global
        .RainGuardCrossHistoryMotionReconstructionEngineV39 =
        engine;

    global.RainGuardAI =
        global.RainGuardAI ||
        {};

    global.RainGuardAI.V39 =
        global.RainGuardAI.V39 ||
        {};

    global
        .RainGuardAI
        .V39
        .crossHistoryMotionReconstructionEngine =
        engine;

    global
        .runRainGuardCrossHistoryMotionReconstruction =
        options =>
            engine.run(
                options
            );

    global
        .diagnoseRainGuardCrossHistoryMotionReconstruction =
        () =>
            engine.diagnose();

    global
        .getRainGuardCrossHistoryMotionVectors =
        () =>
            engine.getAll();

    global
        .getRainGuardCrossHistoryMotionByTrackId =
        trackId =>
            engine.getByTrackId(
                trackId
            );

    global
        .getRainGuardCrossHistoryMotionByCellId =
        cellId =>
            engine.getByCellId(
                cellId
            );

    console.log(
        `[RainGuard AI] Phase ${PHASE} — Cross-History Motion Reconstruction Engine v${VERSION} READY`
    );

    if (
        CONFIG.autoStart
    ) {
        engine.start();
    }

})(
    typeof globalThis !==
    "undefined"
        ? globalThis
        : window
);
