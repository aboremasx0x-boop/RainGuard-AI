/*
 RainGuard AI V32
 Phase 38M-18C — Live Track History Capture Bridge
 Version: 32.38M.18C
*/

(function (global) {
    "use strict";

    const VERSION = "32.38M.18C";
    const BUILD =
        "rainguard-v32-phase38m18c-live-track-history-capture";

    const config = {
        autoStart: true,
        captureIntervalMs: 5000,
        maxPointsPerTrack: 120,
        maxTrackAgeMs: 6 * 60 * 60 * 1000,
        minTimeDeltaMs: 1000,
        minMovementMeters: 20,
        debug: true
    };

    const historyMap = new Map();
    let running = false;
    let timer = null;
    let latestResult = null;
    let lastError = null;

    const statistics = {
        cycles: 0,
        discovered: 0,
        captured: 0,
        duplicates: 0,
        rejected: 0,
        expired: 0,
        failures: 0
    };

    const now = () => Date.now();

    function clone(value) {
        if (value === null || value === undefined) {
            return value;
        }

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

    function number(value, fallback = null) {
        const result = Number(value);
        return Number.isFinite(result) ? result : fallback;
    }

    function coordinate(value) {
        if (!value || typeof value !== "object") {
            return null;
        }

        const latitude = number(
            value.latitude ?? value.lat ?? value.y,
            null
        );

        const longitude = number(
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

        return { latitude, longitude };
    }

    function timestamp(value) {
        if (value === null || value === undefined) {
            return now();
        }

        if (typeof value === "number") {
            return value < 1e12 ? value * 1000 : value;
        }

        const parsed = Date.parse(value);
        return Number.isFinite(parsed) ? parsed : now();
    }

    function array(value) {
        if (!value) return [];
        if (Array.isArray(value)) return value;
        if (value instanceof Map || value instanceof Set) {
            return Array.from(value.values());
        }
        if (typeof value.values === "function") {
            try {
                return Array.from(value.values());
            } catch (_) {}
        }
        return typeof value === "object"
            ? Object.values(value)
            : [];
    }

    function distanceMeters(a, b) {
        const first = coordinate(a);
        const second = coordinate(b);

        if (!first || !second) {
            return null;
        }

        const radius = 6371008.8;
        const toRad = value => value * Math.PI / 180;

        const lat1 = toRad(first.latitude);
        const lat2 = toRad(second.latitude);
        const dLat = toRad(
            second.latitude - first.latitude
        );
        const dLon = toRad(
            second.longitude - first.longitude
        );

        const sinLat = Math.sin(dLat / 2);
        const sinLon = Math.sin(dLon / 2);

        const h =
            sinLat * sinLat +
            Math.cos(lat1) *
            Math.cos(lat2) *
            sinLon * sinLon;

        return 2 *
            radius *
            Math.asin(
                Math.min(1, Math.sqrt(h))
            );
    }

    function normalizeEntity(entity) {
        const coordinateSources = [
            entity?.coordinate,
            entity?.position,
            entity?.location,
            entity?.centroid,
            entity?.center,
            entity?.currentCoordinate,
            entity?.sourceCoordinate,
            entity?.stormCoordinate,
            entity
        ];

        let pointCoordinate = null;

        for (const source of coordinateSources) {
            pointCoordinate = coordinate(source);
            if (pointCoordinate) break;
        }

        if (!pointCoordinate) {
            statistics.rejected += 1;
            return null;
        }

        const trackId = String(
            entity?.canonicalTrackId ??
            entity?.trackId ??
            entity?.cellId ??
            entity?.id ??
            entity?.entityId ??
            entity?.uuid ??
            `${pointCoordinate.latitude.toFixed(4)}:${pointCoordinate.longitude.toFixed(4)}`
        );

        return {
            trackId,
            cellId:
                entity?.cellId ??
                entity?.id ??
                trackId,
            coordinate: pointCoordinate,
            timestamp: timestamp(
                entity?.timestamp ??
                entity?.time ??
                entity?.observedAt ??
                entity?.generatedAt ??
                entity?.updatedAt ??
                entity?.createdAt ??
                entity?.frameTime
            ),
            source:
                entity?.source ??
                entity?.provider ??
                "LIVE_RUNTIME",
            intensity: number(
                entity?.intensity ??
                entity?.reflectivity ??
                entity?.rainIntensity,
                null
            ),
            confidence: number(
                entity?.confidence,
                null
            )
        };
    }

    function discover() {
        const sources = [
            global.RainArrivalLiveStormEntities,
            global.RainArrivalStormEntities,
            global.RainArrivalDetectedStormCells,
            global.RainArrivalStormCells,
            global.RainGuardAI?.V32?.liveStormEntities,
            global.RainGuardAI?.V32?.stormEntities,
            global.RainGuardAI?.V32?.detectedStormCells,
            global.RainGuardAI?.V31?.stormCells,
            global.StormTrackingEngineV31?.getActiveCells?.(),
            global.StormCellTrackingV31?.getActiveCells?.(),
            global.stormCellTrackingEngine?.getActiveCells?.(),
            global.stormVisualizationEngine?.getCells?.()
        ];

        const unique = new Map();

        for (const source of sources) {
            for (const raw of array(source)) {
                const entity = normalizeEntity(raw);
                if (entity) {
                    unique.set(entity.trackId, entity);
                }
            }
        }

        return Array.from(unique.values());
    }

    function append(entity) {
        const history =
            historyMap.get(entity.trackId) || [];

        const point = {
            trackId: entity.trackId,
            cellId: entity.cellId,
            coordinate: clone(entity.coordinate),
            latitude: entity.coordinate.latitude,
            longitude: entity.coordinate.longitude,
            timestamp: entity.timestamp,
            observedAt:
                new Date(entity.timestamp).toISOString(),
            source: entity.source,
            intensity: entity.intensity,
            confidence: entity.confidence
        };

        const previous =
            history[history.length - 1];

        if (previous) {
            const delta =
                point.timestamp - previous.timestamp;

            const moved =
                distanceMeters(
                    previous.coordinate,
                    point.coordinate
                );

            if (
                delta < config.minTimeDeltaMs ||
                (
                    moved !== null &&
                    moved < config.minMovementMeters
                )
            ) {
                statistics.duplicates += 1;
                return false;
            }
        }

        history.push(point);

        if (
            history.length >
            config.maxPointsPerTrack
        ) {
            history.splice(
                0,
                history.length -
                config.maxPointsPerTrack
            );
        }

        historyMap.set(entity.trackId, history);
        statistics.captured += 1;
        return true;
    }

    function cleanup() {
        const cutoff =
            now() - config.maxTrackAgeMs;

        for (const [trackId, history] of historyMap.entries()) {
            const filtered =
                history.filter(
                    point =>
                        point.timestamp >= cutoff
                );

            statistics.expired +=
                history.length - filtered.length;

            if (filtered.length === 0) {
                historyMap.delete(trackId);
            } else {
                historyMap.set(trackId, filtered);
            }
        }
    }

    function publish() {
        const snapshot = {};

        for (const [trackId, history] of historyMap.entries()) {
            snapshot[trackId] = clone(history);
        }

        global.RainArrivalLiveTrackHistory =
            snapshot;

        global.RainArrivalTrackHistoryV32 =
            snapshot;

        global.RainGuardAI =
            global.RainGuardAI || {};

        global.RainGuardAI.V32 =
            global.RainGuardAI.V32 || {};

        global.RainGuardAI.V32.liveTrackHistory =
            snapshot;

        global.RainGuardAI.V32.rainArrivalTrackHistory =
            snapshot;

        return snapshot;
    }

    function capture() {
        const startedAt = now();
        statistics.cycles += 1;

        try {
            const entities = discover();
            statistics.discovered += entities.length;

            let capturedThisCycle = 0;

            for (const entity of entities) {
                if (append(entity)) {
                    capturedThisCycle += 1;
                }
            }

            cleanup();
            const snapshot = publish();

            latestResult = {
                success: true,
                status:
                    "LIVE_TRACK_HISTORY_CAPTURE_COMPLETED",
                version: VERSION,
                build: BUILD,
                discoveredCount: entities.length,
                capturedThisCycle,
                trackCount: historyMap.size,
                totalPointCount:
                    Array.from(historyMap.values())
                        .reduce(
                            (sum, history) =>
                                sum + history.length,
                            0
                        ),
                history: clone(snapshot),
                startedAt,
                completedAt: now(),
                durationMs: now() - startedAt
            };

            global.dispatchEvent?.(
                new CustomEvent(
                    "rainarrival:live-track-history-updated",
                    {
                        detail: clone(latestResult)
                    }
                )
            );

            if (config.debug) {
                console.log(
                    "[RainArrival TrackHistory] Capture result:",
                    latestResult
                );
            }

            return clone(latestResult);
        } catch (error) {
            statistics.failures += 1;

            lastError = {
                name: error?.name ?? "Error",
                message:
                    error?.message ??
                    String(error),
                stack: error?.stack ?? null,
                timestamp: now()
            };

            latestResult = {
                success: false,
                status:
                    "LIVE_TRACK_HISTORY_CAPTURE_FAILED",
                version: VERSION,
                build: BUILD,
                error: clone(lastError)
            };

            return clone(latestResult);
        }
    }

    function getHistory(trackId) {
        return clone(
            historyMap.get(String(trackId)) || []
        );
    }

    function getAllTracks() {
        return Array.from(
            historyMap.entries()
        ).map(
            ([trackId, points]) => ({
                trackId,
                pointCount: points.length,
                points: clone(points),
                latestPoint:
                    clone(
                        points[
                            points.length - 1
                        ] || null
                    )
            })
        );
    }

    function start() {
        if (running) {
            return {
                success: true,
                alreadyRunning: true
            };
        }

        running = true;
        capture();

        timer = global.setInterval(
            capture,
            config.captureIntervalMs
        );

        return {
            success: true,
            running: true,
            intervalMs:
                config.captureIntervalMs
        };
    }

    function stop() {
        if (timer) {
            global.clearInterval(timer);
        }

        timer = null;
        running = false;

        return {
            success: true,
            running: false
        };
    }

    const bridge = {
        module: "liveTrackHistoryCapture",
        version: VERSION,
        build: BUILD,
        config,
        capture,
        start,
        stop,
        getHistory,
        getReplay: getHistory,
        getTrack:
            trackId => ({
                trackId: String(trackId),
                history: getHistory(trackId)
            }),
        getAll:
            () => {
                const result = {};
                for (
                    const [trackId, points]
                    of historyMap.entries()
                ) {
                    result[trackId] =
                        clone(points);
                }
                return result;
            },
        getAllTracks,
        getLatestResult:
            () => clone(latestResult),
        getDiagnostics:
            () => ({
                module:
                    "liveTrackHistoryCapture",
                version: VERSION,
                build: BUILD,
                installed: true,
                running,
                trackCount: historyMap.size,
                totalPointCount:
                    Array.from(historyMap.values())
                        .reduce(
                            (sum, history) =>
                                sum + history.length,
                            0
                        ),
                latestResult:
                    clone(latestResult),
                lastError:
                    clone(lastError),
                statistics:
                    clone(statistics)
            }),
        diagnose() {
            const result =
                this.getDiagnostics();

            console.log(
                "[RainArrival TrackHistory]",
                result
            );

            return result;
        },
        printTable() {
            const rows =
                getAllTracks().map(
                    track => ({
                        trackId:
                            track.trackId,
                        pointCount:
                            track.pointCount,
                        latestTime:
                            track.latestPoint
                                ?.observedAt ?? null,
                        latitude:
                            track.latestPoint
                                ?.latitude ?? null,
                        longitude:
                            track.latestPoint
                                ?.longitude ?? null,
                        source:
                            track.latestPoint
                                ?.source ?? null
                    })
                );

            console.table(rows);
            return rows;
        }
    };

    global.RainArrivalLiveTrackHistoryCaptureV32 =
        bridge;

    global.RainArrivalTrackHistoryStoreV32 =
        bridge;

    global.RainGuardAI =
        global.RainGuardAI || {};

    global.RainGuardAI.V32 =
        global.RainGuardAI.V32 || {};

    global.RainGuardAI.V32.rainArrivalModules =
        global.RainGuardAI.V32
            .rainArrivalModules || {};

    global.RainGuardAI.V32
        .rainArrivalModules
        .liveTrackHistoryCapture =
        bridge;

    global.RainArrivalEngineV32
        ?.register?.(
            "liveTrackHistoryCapture",
            bridge
        );

    global.RainArrivalOrchestratorV32
        ?.register?.(
            "liveTrackHistoryCapture",
            bridge
        );

    global.captureRainArrivalTrackHistory =
        capture;

    if (config.autoStart) {
        start();
    }

    console.log(
        "[RainGuard AI V32] Live Track History Capture Bridge loaded.",
        {
            version: VERSION,
            build: BUILD
        }
    );

})(
    typeof globalThis !== "undefined"
        ? globalThis
        : window
);
