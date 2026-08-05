/*
===========================================================
 RainGuard AI V32
 Phase 38M-5
 Shared Utilities Module

 Responsibilities:
 - Geographic calculations
 - Coordinate normalization
 - Time normalization
 - Numeric helpers
 - Safe cloning
 - Statistical helpers
 - Shared runtime utilities
===========================================================
*/

(function (global) {
    "use strict";

    const MODULE_NAME = "utils";
    const VERSION = "32.38M.5";
    const BUILD = "rainguard-v32-phase38m-utils";

    const EARTH_RADIUS_KM = 6371.0088;

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
        const number = Number(value);

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
            toFiniteNumber(value);

        if (number === null) {
            return minimum;
        }

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

    function normalizeId(value) {
        return normalizeText(value);
    }

    function degreesToRadians(value) {
        return (
            toFiniteNumber(value, 0) *
            Math.PI /
            180
        );
    }

    function radiansToDegrees(value) {
        return (
            toFiniteNumber(value, 0) *
            180 /
            Math.PI
        );
    }

    function normalizeBearing(value) {
        const number =
            toFiniteNumber(value);

        if (number === null) {
            return null;
        }

        return (
            (number % 360) +
            360
        ) % 360;
    }

    function roundNumber(
        value,
        precision = 6
    ) {
        const number =
            toFiniteNumber(value);

        if (number === null) {
            return null;
        }

        const safePrecision =
            clamp(
                Math.floor(
                    toFiniteNumber(
                        precision,
                        6
                    )
                ),
                0,
                12
            );

        const factor =
            Math.pow(
                10,
                safePrecision
            );

        return (
            Math.round(
                number * factor
            ) /
            factor
        );
    }

    function normalizeCoordinate(
        value,
        precision = 6
    ) {
        if (!value) {
            return null;
        }

        let latitude = null;
        let longitude = null;

        if (Array.isArray(value)) {
            latitude =
                Number(value[0]);

            longitude =
                Number(value[1]);
        } else if (isObject(value)) {
            latitude = Number(
                value.lat ??
                value.latitude ??
                value.y
            );

            longitude = Number(
                value.lon ??
                value.lng ??
                value.longitude ??
                value.x
            );
        }

        if (
            !Number.isFinite(latitude) ||
            !Number.isFinite(longitude)
        ) {
            return null;
        }

        if (
            latitude < -90 ||
            latitude > 90 ||
            longitude < -180 ||
            longitude > 180
        ) {
            return null;
        }

        return {
            lat:
                roundNumber(
                    latitude,
                    precision
                ),

            lon:
                roundNumber(
                    longitude,
                    precision
                )
        };
    }

    function normalizeTimestamp(
        value,
        fallback = null
    ) {
        if (isFiniteNumber(value)) {
            return value;
        }

        if (value instanceof Date) {
            const timestamp =
                value.getTime();

            return Number.isFinite(
                timestamp
            )
                ? timestamp
                : fallback;
        }

        if (typeof value === "string") {
            const parsed =
                Date.parse(value);

            return Number.isFinite(
                parsed
            )
                ? parsed
                : fallback;
        }

        return fallback;
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

    function calculateDistanceKm(
        coordinateA,
        coordinateB
    ) {
        const first =
            normalizeCoordinate(
                coordinateA
            );

        const second =
            normalizeCoordinate(
                coordinateB
            );

        if (!first || !second) {
            return null;
        }

        const latitude1 =
            degreesToRadians(
                first.lat
            );

        const latitude2 =
            degreesToRadians(
                second.lat
            );

        const latitudeDifference =
            degreesToRadians(
                second.lat -
                first.lat
            );

        const longitudeDifference =
            degreesToRadians(
                second.lon -
                first.lon
            );

        const haversine =
            Math.sin(
                latitudeDifference / 2
            ) ** 2 +
            Math.cos(latitude1) *
            Math.cos(latitude2) *
            Math.sin(
                longitudeDifference / 2
            ) ** 2;

        const angularDistance =
            2 *
            Math.atan2(
                Math.sqrt(haversine),
                Math.sqrt(
                    1 - haversine
                )
            );

        return (
            EARTH_RADIUS_KM *
            angularDistance
        );
    }

    function calculateBearing(
        coordinateA,
        coordinateB
    ) {
        const first =
            normalizeCoordinate(
                coordinateA
            );

        const second =
            normalizeCoordinate(
                coordinateB
            );

        if (!first || !second) {
            return null;
        }

        const latitude1 =
            degreesToRadians(
                first.lat
            );

        const latitude2 =
            degreesToRadians(
                second.lat
            );

        const longitudeDifference =
            degreesToRadians(
                second.lon -
                first.lon
            );

        const y =
            Math.sin(
                longitudeDifference
            ) *
            Math.cos(latitude2);

        const x =
            Math.cos(latitude1) *
            Math.sin(latitude2) -
            Math.sin(latitude1) *
            Math.cos(latitude2) *
            Math.cos(
                longitudeDifference
            );

        return normalizeBearing(
            radiansToDegrees(
                Math.atan2(y, x)
            )
        );
    }

    function calculateAngularDifference(
        bearingA,
        bearingB
    ) {
        const first =
            normalizeBearing(
                bearingA
            );

        const second =
            normalizeBearing(
                bearingB
            );

        if (
            first === null ||
            second === null
        ) {
            return null;
        }

        return Math.abs(
            (
                (
                    second -
                    first +
                    540
                ) % 360
            ) -
            180
        );
    }

    function projectCoordinate(
        coordinate,
        bearing,
        distanceKm,
        precision = 6
    ) {
        const origin =
            normalizeCoordinate(
                coordinate,
                precision
            );

        const normalizedBearing =
            normalizeBearing(
                bearing
            );

        const normalizedDistance =
            toFiniteNumber(
                distanceKm
            );

        if (
            !origin ||
            normalizedBearing === null ||
            normalizedDistance === null ||
            normalizedDistance < 0
        ) {
            return null;
        }

        const angularDistance =
            normalizedDistance /
            EARTH_RADIUS_KM;

        const bearingRadians =
            degreesToRadians(
                normalizedBearing
            );

        const latitudeRadians =
            degreesToRadians(
                origin.lat
            );

        const longitudeRadians =
            degreesToRadians(
                origin.lon
            );

        const projectedLatitude =
            Math.asin(
                Math.sin(
                    latitudeRadians
                ) *
                Math.cos(
                    angularDistance
                ) +
                Math.cos(
                    latitudeRadians
                ) *
                Math.sin(
                    angularDistance
                ) *
                Math.cos(
                    bearingRadians
                )
            );

        const projectedLongitude =
            longitudeRadians +
            Math.atan2(
                Math.sin(
                    bearingRadians
                ) *
                Math.sin(
                    angularDistance
                ) *
                Math.cos(
                    latitudeRadians
                ),

                Math.cos(
                    angularDistance
                ) -
                Math.sin(
                    latitudeRadians
                ) *
                Math.sin(
                    projectedLatitude
                )
            );

        return normalizeCoordinate(
            {
                lat:
                    radiansToDegrees(
                        projectedLatitude
                    ),

                lon:
                    (
                        (
                            radiansToDegrees(
                                projectedLongitude
                            ) +
                            540
                        ) % 360
                    ) - 180
            },
            precision
        );
    }

    function calculateSpeedKmh(
        distanceKm,
        durationMs
    ) {
        const distance =
            toFiniteNumber(
                distanceKm
            );

        const duration =
            toFiniteNumber(
                durationMs
            );

        if (
            distance === null ||
            duration === null ||
            distance < 0 ||
            duration <= 0
        ) {
            return null;
        }

        return (
            distance /
            (
                duration /
                3600000
            )
        );
    }

    function calculateArrivalMinutes(
        distanceKm,
        speedKmh
    ) {
        const distance =
            toFiniteNumber(
                distanceKm
            );

        const speed =
            toFiniteNumber(
                speedKmh
            );

        if (
            distance === null ||
            speed === null ||
            distance < 0 ||
            speed <= 0
        ) {
            return null;
        }

        return (
            distance /
            speed *
            60
        );
    }

    function calculateAverage(values) {
        const filtered =
            Array.isArray(values)
                ? values
                    .map(value =>
                        toFiniteNumber(
                            value
                        )
                    )
                    .filter(
                        value =>
                            value !== null
                    )
                : [];

        if (
            filtered.length === 0
        ) {
            return null;
        }

        return (
            filtered.reduce(
                (
                    total,
                    value
                ) =>
                    total + value,
                0
            ) /
            filtered.length
        );
    }

    function calculateMedian(values) {
        const filtered =
            Array.isArray(values)
                ? values
                    .map(value =>
                        toFiniteNumber(
                            value
                        )
                    )
                    .filter(
                        value =>
                            value !== null
                    )
                    .sort(
                        (a, b) =>
                            a - b
                    )
                : [];

        if (
            filtered.length === 0
        ) {
            return null;
        }

        const middle =
            Math.floor(
                filtered.length / 2
            );

        if (
            filtered.length % 2 === 0
        ) {
            return (
                filtered[middle - 1] +
                filtered[middle]
            ) / 2;
        }

        return filtered[middle];
    }

    function calculateWeightedAverage(
        entries
    ) {
        if (!Array.isArray(entries)) {
            return null;
        }

        let weightedTotal = 0;
        let totalWeight = 0;

        entries.forEach(entry => {
            if (!isObject(entry)) {
                return;
            }

            const value =
                toFiniteNumber(
                    entry.value
                );

            const weight =
                toFiniteNumber(
                    entry.weight
                );

            if (
                value === null ||
                weight === null ||
                weight <= 0
            ) {
                return;
            }

            weightedTotal +=
                value * weight;

            totalWeight += weight;
        });

        return totalWeight > 0
            ? weightedTotal /
                totalWeight
            : null;
    }

    function calculateCircularMean(
        bearings,
        weights = []
    ) {
        if (!Array.isArray(bearings)) {
            return null;
        }

        let x = 0;
        let y = 0;
        let totalWeight = 0;

        bearings.forEach(
            (
                bearing,
                index
            ) => {
                const normalized =
                    normalizeBearing(
                        bearing
                    );

                if (
                    normalized === null
                ) {
                    return;
                }

                const weightCandidate =
                    toFiniteNumber(
                        weights[index],
                        1
                    );

                const weight =
                    weightCandidate > 0
                        ? weightCandidate
                        : 1;

                const radians =
                    degreesToRadians(
                        normalized
                    );

                x +=
                    Math.cos(radians) *
                    weight;

                y +=
                    Math.sin(radians) *
                    weight;

                totalWeight += weight;
            }
        );

        if (
            totalWeight === 0 ||
            (
                Math.abs(x) <
                    Number.EPSILON &&
                Math.abs(y) <
                    Number.EPSILON
            )
        ) {
            return null;
        }

        return normalizeBearing(
            radiansToDegrees(
                Math.atan2(y, x)
            )
        );
    }

    function normalizePoint(
        point,
        precision = 6
    ) {
        if (!isObject(point)) {
            return null;
        }

        const coordinate =
            normalizeCoordinate(
                point.coordinate ??
                point.position ??
                point.location ??
                {
                    lat:
                        point.lat ??
                        point.latitude,

                    lon:
                        point.lon ??
                        point.lng ??
                        point.longitude
                },
                precision
            );

        const timestamp =
            normalizeTimestamp(
                point.timestamp ??
                point.time ??
                point.observedAt ??
                point.createdAt,
                null
            );

        if (
            !coordinate ||
            timestamp === null
        ) {
            return null;
        }

        return {
            ...cloneValue(point),

            timestamp,

            coordinate,

            lat:
                coordinate.lat,

            lon:
                coordinate.lon
        };
    }

    function sortPointsByTime(points) {
        if (!Array.isArray(points)) {
            return [];
        }

        return points
            .map(point =>
                normalizePoint(point)
            )
            .filter(Boolean)
            .sort(
                (a, b) =>
                    a.timestamp -
                    b.timestamp
            );
    }

    function deduplicatePoints(
        points,
        minimumIntervalMs = 1000
    ) {
        const sorted =
            sortPointsByTime(points);

        const output = [];

        sorted.forEach(point => {
            const previous =
                output[
                    output.length - 1
                ];

            if (!previous) {
                output.push(point);
                return;
            }

            const sameCoordinate =
                previous.lat ===
                    point.lat &&
                previous.lon ===
                    point.lon;

            const closeTimestamp =
                Math.abs(
                    point.timestamp -
                    previous.timestamp
                ) <=
                minimumIntervalMs;

            if (
                sameCoordinate &&
                closeTimestamp
            ) {
                return;
            }

            output.push(point);
        });

        return output;
    }

    function generateId(
        prefix = "RG32"
    ) {
        return [
            normalizeText(prefix) ||
                "RG32",

            now(),

            Math.random()
                .toString(36)
                .slice(2, 10)
                .toUpperCase()
        ].join("-");
    }

    function safeJsonParse(
        value,
        fallback = null
    ) {
        if (
            typeof value !== "string"
        ) {
            return fallback;
        }

        try {
            return JSON.parse(value);
        } catch (error) {
            return fallback;
        }
    }

    function safeJsonStringify(
        value,
        fallback = null
    ) {
        try {
            return JSON.stringify(value);
        } catch (error) {
            return fallback;
        }
    }

    function createResult(
        success,
        data = {}
    ) {
        return {
            success:
                Boolean(success),

            generatedAt:
                now(),

            ...(isObject(data)
                ? data
                : {})
        };
    }

    const api = Object.freeze({
        module:
            MODULE_NAME,

        version:
            VERSION,

        build:
            BUILD,

        EARTH_RADIUS_KM,

        now,
        isObject,
        isFiniteNumber,
        toFiniteNumber,
        clamp,
        normalizeText,
        normalizeId,
        degreesToRadians,
        radiansToDegrees,
        normalizeBearing,
        roundNumber,
        normalizeCoordinate,
        normalizeTimestamp,
        cloneValue,
        calculateDistanceKm,
        calculateBearing,
        calculateAngularDifference,
        projectCoordinate,
        calculateSpeedKmh,
        calculateArrivalMinutes,
        calculateAverage,
        calculateMedian,
        calculateWeightedAverage,
        calculateCircularMean,
        normalizePoint,
        sortPointsByTime,
        deduplicatePoints,
        generateId,
        safeJsonParse,
        safeJsonStringify,
        createResult,

        diagnose() {
            const diagnostics = {
                module:
                    MODULE_NAME,

                version:
                    VERSION,

                build:
                    BUILD,

                installed:
                    true,

                functionCount:
                    Object.keys(api)
                        .filter(
                            key =>
                                typeof api[key] ===
                                "function"
                        )
                        .length
            };

            console.log(
                "[RainArrival Utils]",
                diagnostics
            );

            return diagnostics;
        }
    });

    global.RainArrivalUtilsV32 =
        api;

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
        .utils =
        api;

    if (
        global.RainArrivalEngineV32 &&
        typeof global
            .RainArrivalEngineV32
            .register === "function"
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
            .register === "function"
    ) {
        global
            .RainArrivalOrchestratorV32
            .register(
                MODULE_NAME,
                api
            );
    }

    console.log(
        "[RainGuard AI V32] Shared Utilities loaded.",
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
