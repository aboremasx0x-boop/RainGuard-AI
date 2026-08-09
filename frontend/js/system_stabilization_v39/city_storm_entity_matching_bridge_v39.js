/*
===============================================================================
 RainGuard AI
 Phase 39A-13 — City ↔ Storm Entity Matching Bridge
 File: city_storm_entity_matching_bridge_v39.js
 Version: 39A.13.0

 Purpose:
 - Match live storm entities to national cities using real coordinates.
 - Create a stable candidate layer for Phase 39A-11 Arrival ETA Pipeline Bridge.
 - Do NOT invent ETA values.
 - Publish city↔storm matches with distance, bearing and motion alignment.
 - Keep the bridge diagnostic and non-destructive.
===============================================================================
*/

(function initializeCityStormEntityMatchingBridgeV39(global) {
    "use strict";

    const PHASE = "39A-13";
    const VERSION = "39A.13.0";
    const BUILD = "rainguard-v39-city-storm-entity-matching-bridge";

    const CONFIG = Object.freeze({
        autoStart: true,
        refreshIntervalMs: 5000,
        maximumEntitiesPerRun: 500,
        maximumCitiesPerRun: 100,
        maximumMatchDistanceKm: 450,
        maximumDirectionalDifferenceDeg: 110,
        maximumMatchesPerCity: 25,
        debug: true
    });

    const now = () => Date.now();

    function finite(value) {
        const n = Number(value);
        return Number.isFinite(n) ? n : null;
    }

    function normalizeError(error) {
        return {
            name: error?.name || "Error",
            message: error?.message || String(error),
            stack: error?.stack || null,
            timestamp: now()
        };
    }

    function toArray(value) {
        if (!value) return [];

        if (Array.isArray(value)) {
            return value;
        }

        if (value instanceof Map || value instanceof Set) {
            return Array.from(value.values());
        }

        if (typeof value.values === "function") {
            try {
                return Array.from(value.values());
            } catch (_) {}
        }

        if (typeof value === "object") {
            for (const key of [
                "entities",
                "stormEntities",
                "liveStormEntities",
                "tracks",
                "stormTracks",
                "activeTracks",
                "cities",
                "locations",
                "items",
                "results",
                "result",
                "data",
                "payload",
                "output"
            ]) {
                const nested = value[key];

                if (Array.isArray(nested)) {
                    return nested;
                }

                if (
                    nested instanceof Map ||
                    nested instanceof Set
                ) {
                    return Array.from(nested.values());
                }
            }
        }

        return [];
    }

    function extractCoordinates(raw) {
        if (!raw || typeof raw !== "object") {
            return {
                latitude: null,
                longitude: null
            };
        }

        return {
            latitude: finite(
                raw.latitude ??
                raw.lat ??
                raw.center?.latitude ??
                raw.center?.lat ??
                raw.location?.latitude ??
                raw.location?.lat ??
                raw.coordinates?.latitude ??
                raw.coordinates?.lat
            ),

            longitude: finite(
                raw.longitude ??
                raw.lon ??
                raw.lng ??
                raw.center?.longitude ??
                raw.center?.lon ??
                raw.center?.lng ??
                raw.location?.longitude ??
                raw.location?.lon ??
                raw.location?.lng ??
                raw.coordinates?.longitude ??
                raw.coordinates?.lon ??
                raw.coordinates?.lng
            )
        };
    }

    function extractMotion(raw) {
        if (!raw || typeof raw !== "object") {
            return {
                speedKmh: null,
                directionDeg: null
            };
        }

        let speedKmh = finite(
            raw.speedKmh ??
            raw.speed ??
            raw.velocityKmh ??
            raw.motion?.speedKmh ??
            raw.motion?.speed ??
            raw.motionVector?.speedKmh ??
            raw.motionVector?.speed
        );

        const unit = String(
            raw.speedUnit ??
            raw.motion?.speedUnit ??
            raw.motionVector?.speedUnit ??
            ""
        ).toLowerCase();

        if (
            speedKmh !== null &&
            (unit === "m/s" || unit === "mps")
        ) {
            speedKmh *= 3.6;
        }

        let directionDeg = finite(
            raw.directionDeg ??
            raw.direction ??
            raw.bearing ??
            raw.heading ??
            raw.motion?.directionDeg ??
            raw.motion?.direction ??
            raw.motion?.bearing ??
            raw.motionVector?.directionDeg ??
            raw.motionVector?.direction ??
            raw.motionVector?.bearing
        );

        if (directionDeg !== null) {
            directionDeg =
                ((directionDeg % 360) + 360) % 360;
        }

        return {
            speedKmh,
            directionDeg
        };
    }

    function haversineKm(lat1, lon1, lat2, lon2) {
        const toRad = deg => deg * Math.PI / 180;

        const R = 6371;
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);

        const a =
            Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) *
            Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) ** 2;

        const c =
            2 *
            Math.atan2(
                Math.sqrt(a),
                Math.sqrt(1 - a)
            );

        return R * c;
    }

    function bearingDeg(lat1, lon1, lat2, lon2) {
        const toRad = deg => deg * Math.PI / 180;
        const toDeg = rad => rad * 180 / Math.PI;

        const phi1 = toRad(lat1);
        const phi2 = toRad(lat2);
        const dLon = toRad(lon2 - lon1);

        const y =
            Math.sin(dLon) *
            Math.cos(phi2);

        const x =
            Math.cos(phi1) *
            Math.sin(phi2) -
            Math.sin(phi1) *
            Math.cos(phi2) *
            Math.cos(dLon);

        return (
            toDeg(
                Math.atan2(y, x)
            ) +
            360
        ) % 360;
    }

    function angularDifference(a, b) {
        if (a === null || b === null) {
            return null;
        }

        const diff =
            Math.abs(a - b) % 360;

        return Math.min(
            diff,
            360 - diff
        );
    }

    function resolveCityRegistry() {
        return (
            global.RainGuardNationalCityRegistryBridgeV39 ||
            global.RainGuardAI?.V39?.nationalCityRegistryBridge ||
            global.RainGuardAI?.V32?.saudiLocationsRegistry ||
            null
        );
    }

    function resolveCollector() {
        return (
            global.RainArrivalStormEntityCollectorV32 ||
            global.RainGuardAI?.V32?.rainArrivalModules?.stormEntityCollector ||
            null
        );
    }

    function resolveTrackStoreBridge() {
        return (
            global.RainArrivalStormTrackStoreBridgeV32 ||
            global.RainGuardAI?.V32?.rainArrivalModules?.stormTrackStoreBridge ||
            null
        );
    }

    function resolveExportBridge() {
        return (
            global.RainArrivalLiveStormExportBridgeV32 ||
            global.RainGuardAI?.V32?.rainArrivalModules?.liveStormExportBridge ||
            null
        );
    }

    function getCities() {
        const registry =
            resolveCityRegistry();

        if (!registry) {
            return [];
        }

        try {
            if (typeof registry.getAll === "function") {
                const items =
                    toArray(
                        registry.getAll()
                    );

                if (items.length) {
                    return items;
                }
            }
        } catch (_) {}

        try {
            if (typeof registry.getCities === "function") {
                const items =
                    toArray(
                        registry.getCities()
                    );

                if (items.length) {
                    return items;
                }
            }
        } catch (_) {}

        return toArray(
            registry.cities ??
            registry.locations ??
            registry.items
        );
    }

    function getStormEntities() {
        const collector =
            resolveCollector();

        const trackStore =
            resolveTrackStoreBridge();

        const exportBridge =
            resolveExportBridge();

        let items = [];

        if (trackStore) {
            try {
                if (typeof trackStore.discover === "function") {
                    items =
                        toArray(
                            trackStore.discover()
                        );
                }
            } catch (_) {}
        }

        if (!items.length && collector) {
            try {
                if (typeof collector.getAll === "function") {
                    items =
                        toArray(
                            collector.getAll()
                        );
                }
            } catch (_) {}

            if (!items.length) {
                items =
                    toArray(
                        collector.lastResult?.entities
                    );
            }
        }

        if (!items.length && exportBridge) {
            for (const key of [
                "entities",
                "liveStormEntities",
                "lastResult",
                "lastOutput"
            ]) {
                items =
                    toArray(
                        exportBridge[key]
                    );

                if (items.length) {
                    break;
                }
            }
        }

        return items;
    }

    function normalizeCity(raw, index) {
        const coords =
            extractCoordinates(raw);

        if (
            coords.latitude === null ||
            coords.longitude === null
        ) {
            return null;
        }

        return {
            id:
                String(
                    raw.id ??
                    raw.code ??
                    raw.slug ??
                    raw.nameEn ??
                    raw.name ??
                    index
                ),

            name:
                raw.name ??
                raw.nameAr ??
                raw.city ??
                raw.label ??
                raw.nameEn ??
                `City ${index + 1}`,

            nameEn:
                raw.nameEn ??
                raw.englishName ??
                null,

            region:
                raw.region ??
                raw.regionName ??
                null,

            latitude:
                coords.latitude,

            longitude:
                coords.longitude,

            raw
        };
    }

    function normalizeEntity(raw, index) {
        const coords =
            extractCoordinates(raw);

        if (
            coords.latitude === null ||
            coords.longitude === null
        ) {
            return null;
        }

        const motion =
            extractMotion(raw);

        return {
            id:
                String(
                    raw.id ??
                    raw.trackId ??
                    raw.cellId ??
                    raw.stormId ??
                    raw.entityId ??
                    index
                ),

            latitude:
                coords.latitude,

            longitude:
                coords.longitude,

            speedKmh:
                motion.speedKmh,

            directionDeg:
                motion.directionDeg,

            raw
        };
    }

    class CityStormEntityMatchingBridgeV39 {
        constructor() {
            this.phase = PHASE;
            this.version = VERSION;
            this.build = BUILD;

            this.running = false;
            this.timer = null;
            this.lastResult = null;
            this.lastError = null;
            this.matchesByCity = new Map();

            this.statistics = {
                runs: 0,
                successfulRuns: 0,
                emptyRuns: 0,
                failures: 0,
                cityComparisons: 0,
                acceptedMatches: 0,
                rejectedDistance: 0,
                rejectedDirection: 0
            };
        }

        buildMatch(city, entity) {
            const distanceKm =
                haversineKm(
                    entity.latitude,
                    entity.longitude,
                    city.latitude,
                    city.longitude
                );

            if (
                distanceKm >
                CONFIG.maximumMatchDistanceKm
            ) {
                this.statistics.rejectedDistance += 1;
                return null;
            }

            const bearingToCity =
                bearingDeg(
                    entity.latitude,
                    entity.longitude,
                    city.latitude,
                    city.longitude
                );

            const directionDifference =
                angularDifference(
                    entity.directionDeg,
                    bearingToCity
                );

            if (
                directionDifference !== null &&
                directionDifference >
                    CONFIG.maximumDirectionalDifferenceDeg
            ) {
                this.statistics.rejectedDirection += 1;
                return null;
            }

            let score =
                Math.max(
                    0,
                    1 -
                    distanceKm /
                        CONFIG.maximumMatchDistanceKm
                );

            if (
                directionDifference !== null
            ) {
                const directionalScore =
                    Math.max(
                        0,
                        1 -
                        directionDifference /
                            CONFIG.maximumDirectionalDifferenceDeg
                    );

                score =
                    (
                        score * 0.65 +
                        directionalScore * 0.35
                    );
            }

            return {
                cityId:
                    city.id,

                cityName:
                    city.name,

                cityNameEn:
                    city.nameEn,

                cityRegion:
                    city.region,

                cityLatitude:
                    city.latitude,

                cityLongitude:
                    city.longitude,

                stormEntityId:
                    entity.id,

                stormLatitude:
                    entity.latitude,

                stormLongitude:
                    entity.longitude,

                speedKmh:
                    entity.speedKmh,

                stormDirectionDeg:
                    entity.directionDeg,

                bearingToCityDeg:
                    Math.round(
                        bearingToCity
                    ),

                directionDifferenceDeg:
                    directionDifference === null
                        ? null
                        : Math.round(
                            directionDifference
                        ),

                distanceKm:
                    Math.round(
                        distanceKm * 10
                    ) / 10,

                matchScore:
                    Math.round(
                        score * 1000
                    ) / 1000,

                rawStormEntity:
                    entity.raw
            };
        }

        run() {
            this.statistics.runs += 1;

            try {
                const cities =
                    getCities()
                        .map(
                            normalizeCity
                        )
                        .filter(Boolean)
                        .slice(
                            0,
                            CONFIG.maximumCitiesPerRun
                        );

                const entities =
                    getStormEntities()
                        .map(
                            normalizeEntity
                        )
                        .filter(Boolean)
                        .slice(
                            0,
                            CONFIG.maximumEntitiesPerRun
                        );

                const matchesByCity =
                    new Map();

                const flatMatches =
                    [];

                for (const city of cities) {
                    const cityMatches = [];

                    for (const entity of entities) {
                        this.statistics.cityComparisons += 1;

                        const match =
                            this.buildMatch(
                                city,
                                entity
                            );

                        if (!match) {
                            continue;
                        }

                        cityMatches.push(
                            match
                        );

                        flatMatches.push(
                            match
                        );

                        this.statistics.acceptedMatches += 1;
                    }

                    cityMatches.sort(
                        (a, b) => {
                            if (
                                b.matchScore !==
                                a.matchScore
                            ) {
                                return (
                                    b.matchScore -
                                    a.matchScore
                                );
                            }

                            return (
                                a.distanceKm -
                                b.distanceKm
                            );
                        }
                    );

                    matchesByCity.set(
                        city.id,
                        cityMatches.slice(
                            0,
                            CONFIG.maximumMatchesPerCity
                        )
                    );
                }

                flatMatches.sort(
                    (a, b) => {
                        if (
                            b.matchScore !==
                            a.matchScore
                        ) {
                            return (
                                b.matchScore -
                                a.matchScore
                            );
                        }

                        return (
                            a.distanceKm -
                            b.distanceKm
                        );
                    }
                );

                this.matchesByCity =
                    matchesByCity;

                const matchedCities =
                    Array.from(
                        matchesByCity.values()
                    )
                        .filter(
                            items =>
                                items.length > 0
                        )
                        .length;

                const matchedEntityIds =
                    new Set(
                        flatMatches.map(
                            item =>
                                item.stormEntityId
                        )
                    );

                const status =
                    flatMatches.length > 0
                        ? "CITY_STORM_MATCHING_READY"
                        : (
                            cities.length === 0
                                ? "NO_CITIES_AVAILABLE"
                                : (
                                    entities.length === 0
                                        ? "NO_STORM_ENTITIES_AVAILABLE"
                                        : "NO_CITY_STORM_MATCHES"
                                )
                        );

                const result = {
                    success: true,

                    phase:
                        PHASE,

                    version:
                        VERSION,

                    status,

                    cityCount:
                        cities.length,

                    entityCount:
                        entities.length,

                    matchedCities,

                    matchedEntities:
                        matchedEntityIds.size,

                    matchCount:
                        flatMatches.length,

                    bestMatches:
                        flatMatches.slice(
                            0,
                            25
                        ),

                    matchesByCity:
                        Object.fromEntries(
                            Array.from(
                                matchesByCity.entries()
                            )
                        ),

                    generatedAt:
                        now()
                };

                this.lastResult =
                    result;

                this.lastError =
                    null;

                if (
                    flatMatches.length > 0
                ) {
                    this.statistics.successfulRuns += 1;
                } else {
                    this.statistics.emptyRuns += 1;
                }

                this.publish(
                    result
                );

                return result;

            } catch (error) {
                this.statistics.failures += 1;

                this.lastError =
                    normalizeError(
                        error
                    );

                const result = {
                    success: false,

                    phase:
                        PHASE,

                    version:
                        VERSION,

                    status:
                        "CITY_STORM_MATCHING_FAILED",

                    error:
                        this.lastError,

                    generatedAt:
                        now()
                };

                this.lastResult =
                    result;

                return result;
            }
        }

        publish(result) {
            global.RainGuardAI =
                global.RainGuardAI || {};

            global.RainGuardAI.V39 =
                global.RainGuardAI.V39 || {};

            global.RainGuardAI.V32 =
                global.RainGuardAI.V32 || {};

            global.RainGuardAI.V39
                .cityStormEntityMatching =
                result;

            global.RainGuardAI.V32
                .cityStormEntityMatching =
                result;

            global.RainGuardAI.V32
                .rainArrivalCandidates =
                result.bestMatches;

            global.RainGuardCityStormMatchesV39 =
                result.bestMatches;
        }

        getMatchesForCity(cityId) {
            return (
                this.matchesByCity.get(
                    String(cityId)
                ) ||
                []
            );
        }

        getAllMatches() {
            return (
                this.lastResult
                    ?.bestMatches ||
                []
            );
        }

        diagnose() {
            const result = {
                phase:
                    PHASE,

                version:
                    VERSION,

                build:
                    BUILD,

                running:
                    this.running,

                lastError:
                    this.lastError,

                statistics:
                    {
                        ...this.statistics
                    },

                result:
                    this.lastResult
            };

            console.log(
                "[RainGuard Phase 39A-13] City ↔ Storm Entity Matching Bridge",
                result
            );

            return result;
        }

        start() {
            if (this.running) {
                return {
                    success: true,
                    alreadyRunning: true
                };
            }

            this.running = true;

            this.run();

            this.timer =
                global.setInterval(
                    () => {
                        this.run();
                    },
                    CONFIG.refreshIntervalMs
                );

            return {
                success: true,
                running: true,
                intervalMs:
                    CONFIG.refreshIntervalMs
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
    }

    const bridge =
        new CityStormEntityMatchingBridgeV39();

    global.RainGuardCityStormEntityMatchingBridgeV39 =
        bridge;

    global.RainGuardAI =
        global.RainGuardAI || {};

    global.RainGuardAI.V39 =
        global.RainGuardAI.V39 || {};

    global.RainGuardAI.V39
        .cityStormEntityMatchingBridge =
        bridge;

    global.runRainGuardCityStormMatching =
        () =>
            bridge.run();

    global.diagnoseRainGuardCityStormMatching =
        () =>
            bridge.diagnose();

    global.getRainGuardCityStormMatches =
        cityId =>
            bridge.getMatchesForCity(
                cityId
            );

    console.log(
        `[RainGuard AI] Phase ${PHASE} — City ↔ Storm Entity Matching Bridge v${VERSION} READY`
    );

    if (
        CONFIG.autoStart
    ) {
        bridge.start();
    }

})(
    typeof globalThis !== "undefined"
        ? globalThis
        : window
);
