/*
===========================================================
 RainGuard AI V32
 Phase 38M-19A — Motion Prediction Renderer
 File: motion_prediction_renderer.js
 Version: 32.38M.19A

 Purpose:
 - Render predicted storm paths and future positions.
 - Build map-ready layers from prediction repository output.
 - Support Leaflet, MapLibre and generic GeoJSON consumers.
 - Publish render layers for the dashboard and future ETA views.
===========================================================
*/

(function (global) {
    "use strict";

    const MODULE_NAME = "motionPredictionRenderer";
    const VERSION = "32.38M.19A";
    const BUILD_ID =
        "rainguard-v32-phase38m19a-motion-prediction-renderer";

    const DEFAULT_CONFIG = Object.freeze({
        autoStart: true,
        updateIntervalMs: 15000,
        maximumTracks: 1500,
        minimumConfidence: 20,
        includeRejected: false,
        includeCurrentPosition: true,
        includePredictedPath: true,
        includeFutureMarkers: true,
        includeConfidenceLabels: true,
        includeSpeedLabels: true,
        lineWeight: 3,
        lineOpacity: 0.85,
        markerRadius: 5,
        horizonOpacityDecay: 0.08,
        debug: true
    });

    const now = () => Date.now();

    function cloneValue(value) {
        if (value === null || value === undefined) return value;

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

    function collectionToArray(value) {
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

    function normalizeCoordinate(value) {
        if (!value || typeof value !== "object") return null;

        const latitude = toFiniteNumber(
            value.latitude ?? value.lat,
            null
        );

        const longitude = toFiniteNumber(
            value.longitude ?? value.lng ?? value.lon,
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

    function confidenceBand(confidence) {
        const value = toFiniteNumber(confidence, 0);

        if (value >= 90) return "VERY_HIGH";
        if (value >= 75) return "HIGH";
        if (value >= 50) return "MODERATE";
        if (value >= 25) return "LOW";
        return "CRITICAL";
    }

    function resolveColorToken(confidence) {
        const band = confidenceBand(confidence);

        const tokens = {
            VERY_HIGH: "#00c853",
            HIGH: "#64dd17",
            MODERATE: "#ffd600",
            LOW: "#ff9100",
            CRITICAL: "#d50000"
        };

        return tokens[band];
    }

    function makeGeoJsonFeature(
        geometry,
        properties
    ) {
        return {
            type: "Feature",
            geometry,
            properties: {
                ...properties
            }
        };
    }

    class MotionPredictionRenderer {
        constructor(config = {}) {
            this.version = VERSION;
            this.buildId = BUILD_ID;

            this.config = {
                ...DEFAULT_CONFIG,
                ...(config || {})
            };

            this.running = false;
            this.rendering = false;
            this.timer = null;

            this.layers = [];
            this.geoJson = {
                type: "FeatureCollection",
                features: []
            };

            this.latestResult = null;
            this.lastError = null;

            this.statistics = {
                renders: 0,
                successfulRenders: 0,
                failedRenders: 0,
                busySkips: 0,
                inputPredictions: 0,
                renderedTracks: 0,
                renderedFeatures: 0
            };
        }

        resolvePredictions() {
            const sources = [
                global.RainArrivalMotionPredictionRepositoryV32
                    ?.getAllPredictions?.(),

                global.RainArrivalMotionPredictionRepository
                    ?.getAllPredictions?.(),

                global.RainArrivalMotionPredictionAIV32
                    ?.getAllPredictions?.(),

                global.RainArrivalMotionPredictionList,

                global.RainArrivalMotionPredictionStore,

                global.RainArrivalMotionPredictions
            ];

            for (const source of sources) {
                const predictions = collectionToArray(source);

                if (predictions.length > 0) {
                    return predictions.slice(
                        0,
                        this.config.maximumTracks
                    );
                }
            }

            return [];
        }

        normalizePrediction(prediction, index) {
            if (!prediction || typeof prediction !== "object") {
                return null;
            }

            const trackId = String(
                prediction.trackId ??
                prediction.stableId ??
                prediction.id ??
                `TRACK-${index}`
            );

            const currentCoordinate = normalizeCoordinate(
                prediction.currentCoordinate ??
                prediction.coordinate ??
                prediction.latestCoordinate
            );

            const futurePoints = collectionToArray(
                prediction.predictions
            )
            .map((item, pointIndex) => {
                const coordinate = normalizeCoordinate(
                    item.coordinate ??
                    item.predictedCoordinate
                );

                if (!coordinate) return null;

                const confidenceRaw = toFiniteNumber(
                    item.confidence,
                    prediction.confidence ?? 0
                );

                const confidence = confidenceRaw <= 1
                    ? confidenceRaw * 100
                    : confidenceRaw;

                return {
                    index: pointIndex,
                    horizonMinutes: toFiniteNumber(
                        item.horizonMinutes,
                        null
                    ),
                    coordinate,
                    confidence: clamp(
                        confidence,
                        0,
                        100
                    ),
                    speedKmh: toFiniteNumber(
                        item.speedKmh,
                        null
                    ),
                    bearing: toFiniteNumber(
                        item.bearing,
                        null
                    ),
                    distanceKm: toFiniteNumber(
                        item.distanceKm,
                        null
                    ),
                    predictedAt:
                        item.predictedAt ??
                        null,
                    predictedAtIso:
                        item.predictedAtIso ??
                        null,
                    accepted:
                        item.accepted !== false
                };
            })
            .filter(Boolean)
            .sort(
                (first, second) =>
                    (
                        first.horizonMinutes ??
                        0
                    ) -
                    (
                        second.horizonMinutes ??
                        0
                    )
            );

            const confidenceRaw = toFiniteNumber(
                prediction.confidence,
                0
            );

            const confidence = confidenceRaw <= 1
                ? confidenceRaw * 100
                : confidenceRaw;

            const accepted =
                prediction.accepted === true ||
                futurePoints.some(
                    point => point.accepted
                );

            return {
                trackId,
                stableId:
                    prediction.stableId ??
                    trackId,
                city:
                    prediction.city ??
                    prediction.targetCity ??
                    null,
                status:
                    prediction.status ??
                    null,
                accepted,
                confidence: clamp(
                    confidence,
                    0,
                    100
                ),
                currentCoordinate,
                futurePoints,
                baseSpeedKmh:
                    toFiniteNumber(
                        prediction.baseMotion
                            ?.speedKmh,
                        null
                    ),
                baseBearing:
                    toFiniteNumber(
                        prediction.baseMotion
                            ?.bearing,
                        null
                    ),
                accelerationKmhPerMinute:
                    toFiniteNumber(
                        prediction.trends
                            ?.accelerationKmhPerMinute,
                        null
                    ),
                turnRateDegPerMinute:
                    toFiniteNumber(
                        prediction.trends
                            ?.turnRateDegPerMinute,
                        null
                    )
            };
        }

        buildTrackLayer(prediction) {
            const pathCoordinates = [];

            if (
                this.config.includeCurrentPosition &&
                prediction.currentCoordinate
            ) {
                pathCoordinates.push(
                    [
                        prediction.currentCoordinate.longitude,
                        prediction.currentCoordinate.latitude
                    ]
                );
            }

            for (const point of prediction.futurePoints) {
                pathCoordinates.push(
                    [
                        point.coordinate.longitude,
                        point.coordinate.latitude
                    ]
                );
            }

            const color = resolveColorToken(
                prediction.confidence
            );

            return {
                trackId: prediction.trackId,
                stableId: prediction.stableId,
                city: prediction.city,
                accepted: prediction.accepted,
                confidence: prediction.confidence,
                confidenceBand:
                    confidenceBand(
                        prediction.confidence
                    ),
                color,
                currentCoordinate:
                    cloneValue(
                        prediction.currentCoordinate
                    ),
                pathCoordinates,
                futurePoints:
                    cloneValue(
                        prediction.futurePoints
                    ),
                baseSpeedKmh:
                    prediction.baseSpeedKmh,
                baseBearing:
                    prediction.baseBearing,
                accelerationKmhPerMinute:
                    prediction.accelerationKmhPerMinute,
                turnRateDegPerMinute:
                    prediction.turnRateDegPerMinute,
                style: {
                    color,
                    weight:
                        this.config.lineWeight,
                    opacity:
                        this.config.lineOpacity,
                    dashArray:
                        prediction.accepted
                            ? null
                            : "6,6"
                }
            };
        }

        buildGeoJsonFeatures(layer) {
            const features = [];

            if (
                this.config.includePredictedPath &&
                layer.pathCoordinates.length >= 2
            ) {
                features.push(
                    makeGeoJsonFeature(
                        {
                            type: "LineString",
                            coordinates:
                                cloneValue(
                                    layer.pathCoordinates
                                )
                        },
                        {
                            featureType:
                                "MOTION_PREDICTION_PATH",
                            trackId:
                                layer.trackId,
                            stableId:
                                layer.stableId,
                            city:
                                layer.city,
                            confidence:
                                layer.confidence,
                            confidenceBand:
                                layer.confidenceBand,
                            accepted:
                                layer.accepted,
                            color:
                                layer.color,
                            baseSpeedKmh:
                                layer.baseSpeedKmh,
                            baseBearing:
                                layer.baseBearing,
                            accelerationKmhPerMinute:
                                layer.accelerationKmhPerMinute,
                            turnRateDegPerMinute:
                                layer.turnRateDegPerMinute
                        }
                    )
                );
            }

            if (
                this.config.includeCurrentPosition &&
                layer.currentCoordinate
            ) {
                features.push(
                    makeGeoJsonFeature(
                        {
                            type: "Point",
                            coordinates: [
                                layer.currentCoordinate.longitude,
                                layer.currentCoordinate.latitude
                            ]
                        },
                        {
                            featureType:
                                "MOTION_PREDICTION_CURRENT_POSITION",
                            trackId:
                                layer.trackId,
                            stableId:
                                layer.stableId,
                            city:
                                layer.city,
                            confidence:
                                layer.confidence,
                            confidenceBand:
                                layer.confidenceBand,
                            accepted:
                                layer.accepted,
                            color:
                                layer.color
                        }
                    )
                );
            }

            if (this.config.includeFutureMarkers) {
                for (const point of layer.futurePoints) {
                    features.push(
                        makeGeoJsonFeature(
                            {
                                type: "Point",
                                coordinates: [
                                    point.coordinate.longitude,
                                    point.coordinate.latitude
                                ]
                            },
                            {
                                featureType:
                                    "MOTION_PREDICTION_FUTURE_POSITION",
                                trackId:
                                    layer.trackId,
                                stableId:
                                    layer.stableId,
                                city:
                                    layer.city,
                                horizonMinutes:
                                    point.horizonMinutes,
                                confidence:
                                    point.confidence,
                                speedKmh:
                                    point.speedKmh,
                                bearing:
                                    point.bearing,
                                distanceKm:
                                    point.distanceKm,
                                accepted:
                                    point.accepted,
                                color:
                                    resolveColorToken(
                                        point.confidence
                                    ),
                                opacity:
                                    clamp(
                                        1 -
                                        (
                                            point.horizonMinutes ??
                                            0
                                        ) /
                                        120 *
                                        this.config
                                            .horizonOpacityDecay *
                                        10,
                                        0.2,
                                        1
                                    )
                            }
                        )
                    );
                }
            }

            return features;
        }

        buildLeafletLayerDefinitions(layer) {
            const definitions = [];

            if (
                this.config.includePredictedPath &&
                layer.pathCoordinates.length >= 2
            ) {
                definitions.push({
                    type: "polyline",
                    trackId: layer.trackId,
                    latlngs:
                        layer.pathCoordinates.map(
                            coordinate => [
                                coordinate[1],
                                coordinate[0]
                            ]
                        ),
                    options: {
                        color:
                            layer.style.color,
                        weight:
                            layer.style.weight,
                        opacity:
                            layer.style.opacity,
                        dashArray:
                            layer.style.dashArray
                    }
                });
            }

            if (
                this.config.includeCurrentPosition &&
                layer.currentCoordinate
            ) {
                definitions.push({
                    type: "circleMarker",
                    trackId: layer.trackId,
                    role: "current",
                    latlng: [
                        layer.currentCoordinate.latitude,
                        layer.currentCoordinate.longitude
                    ],
                    options: {
                        radius:
                            this.config.markerRadius + 1,
                        color:
                            layer.color,
                        fillColor:
                            layer.color,
                        fillOpacity:
                            0.9
                    }
                });
            }

            for (const point of layer.futurePoints) {
                definitions.push({
                    type: "circleMarker",
                    trackId: layer.trackId,
                    role: "future",
                    horizonMinutes:
                        point.horizonMinutes,
                    latlng: [
                        point.coordinate.latitude,
                        point.coordinate.longitude
                    ],
                    options: {
                        radius:
                            this.config.markerRadius,
                        color:
                            resolveColorToken(
                                point.confidence
                            ),
                        fillColor:
                            resolveColorToken(
                                point.confidence
                            ),
                        fillOpacity:
                            clamp(
                                point.confidence /
                                100,
                                0.25,
                                1
                            )
                    },
                    tooltip: {
                        trackId:
                            layer.trackId,
                        city:
                            layer.city,
                        horizonMinutes:
                            point.horizonMinutes,
                        confidence:
                            point.confidence,
                        speedKmh:
                            point.speedKmh,
                        bearing:
                            point.bearing
                    }
                });
            }

            return definitions;
        }

        renderAll() {
            if (this.rendering) {
                this.statistics.busySkips += 1;

                return {
                    success: false,
                    status:
                        "MOTION_PREDICTION_RENDERER_BUSY",
                    version: this.version,
                    build: this.buildId,
                    generatedAt: now()
                };
            }

            const startedAt = now();

            this.rendering = true;
            this.statistics.renders += 1;

            try {
                const sourcePredictions =
                    this.resolvePredictions();

                this.statistics.inputPredictions +=
                    sourcePredictions.length;

                const normalized = sourcePredictions
                    .map(
                        (prediction, index) =>
                            this.normalizePrediction(
                                prediction,
                                index
                            )
                    )
                    .filter(Boolean)
                    .filter(
                        prediction =>
                            (
                                this.config.includeRejected ||
                                prediction.accepted
                            ) &&
                            prediction.confidence >=
                            this.config.minimumConfidence
                    );

                const layers = normalized.map(
                    prediction =>
                        this.buildTrackLayer(
                            prediction
                        )
                );

                const features = [];

                const leafletLayerDefinitions = [];

                for (const layer of layers) {
                    features.push(
                        ...this.buildGeoJsonFeatures(
                            layer
                        )
                    );

                    leafletLayerDefinitions.push(
                        ...this
                            .buildLeafletLayerDefinitions(
                                layer
                            )
                    );
                }

                this.layers = cloneValue(layers);

                this.geoJson = {
                    type: "FeatureCollection",
                    features:
                        cloneValue(
                            features
                        )
                };

                const result = {
                    success: true,
                    status:
                        "MOTION_PREDICTION_RENDER_COMPLETED",
                    version: this.version,
                    build: this.buildId,
                    inputPredictionCount:
                        sourcePredictions.length,
                    renderedTrackCount:
                        layers.length,
                    renderedFeatureCount:
                        features.length,
                    leafletDefinitionCount:
                        leafletLayerDefinitions.length,
                    layers:
                        cloneValue(
                            layers
                        ),
                    geoJson:
                        cloneValue(
                            this.geoJson
                        ),
                    leafletLayerDefinitions:
                        cloneValue(
                            leafletLayerDefinitions
                        ),
                    startedAt,
                    completedAt:
                        now(),
                    durationMs:
                        now() -
                        startedAt
                };

                this.latestResult =
                    cloneValue(
                        result
                    );

                this.statistics.successfulRenders += 1;
                this.statistics.renderedTracks +=
                    layers.length;
                this.statistics.renderedFeatures +=
                    features.length;

                this.publish(result);

                if (this.config.debug) {
                    console.log(
                        "[RainArrival MotionPredictionRenderer] Result:",
                        result
                    );
                }

                return result;

            } catch (error) {
                this.statistics.failedRenders += 1;

                this.lastError = {
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

                const result = {
                    success: false,
                    status:
                        "MOTION_PREDICTION_RENDER_FAILED",
                    version: this.version,
                    build: this.buildId,
                    error:
                        cloneValue(
                            this.lastError
                        ),
                    startedAt,
                    completedAt:
                        now(),
                    durationMs:
                        now() -
                        startedAt
                };

                this.latestResult =
                    cloneValue(
                        result
                    );

                return result;

            } finally {
                this.rendering = false;
            }
        }

        publish(result) {
            global.RainArrivalMotionPredictionRenderLayers =
                cloneValue(
                    this.layers
                );

            global.RainArrivalMotionPredictionGeoJSON =
                cloneValue(
                    this.geoJson
                );

            global.RainArrivalMotionPredictionRenderResult =
                cloneValue(
                    result
                );

            global.RainGuardAI =
                global.RainGuardAI ||
                {};

            global.RainGuardAI.V32 =
                global.RainGuardAI.V32 ||
                {};

            global.RainGuardAI.V32
                .motionPredictionRenderLayers =
                cloneValue(
                    this.layers
                );

            global.RainGuardAI.V32
                .motionPredictionGeoJSON =
                cloneValue(
                    this.geoJson
                );

            global.dispatchEvent?.(
                new CustomEvent(
                    "rainarrival:motion-prediction-render-updated",
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

        renderToLeaflet(map, layerGroup = null) {
            if (
                !map ||
                !global.L
            ) {
                return {
                    success: false,
                    status:
                        "LEAFLET_UNAVAILABLE"
                };
            }

            const result =
                this.latestResult ??
                this.renderAll();

            const definitions =
                result
                    ?.leafletLayerDefinitions ??
                [];

            const targetGroup =
                layerGroup ??
                global.L.layerGroup()
                    .addTo(map);

            targetGroup.clearLayers?.();

            for (const definition of definitions) {
                if (
                    definition.type ===
                    "polyline"
                ) {
                    global.L.polyline(
                        definition.latlngs,
                        definition.options
                    ).addTo(
                        targetGroup
                    );
                }

                if (
                    definition.type ===
                    "circleMarker"
                ) {
                    const marker =
                        global.L.circleMarker(
                            definition.latlng,
                            definition.options
                        ).addTo(
                            targetGroup
                        );

                    if (definition.tooltip) {
                        marker.bindTooltip?.(
                            [
                                definition.tooltip.city ??
                                definition.tooltip.trackId,
                                definition.tooltip.horizonMinutes !==
                                    undefined
                                    ? `${definition.tooltip.horizonMinutes} min`
                                    : null,
                                definition.tooltip.speedKmh !==
                                    null
                                    ? `${definition.tooltip.speedKmh} km/h`
                                    : null,
                                definition.tooltip.confidence !==
                                    null
                                    ? `${definition.tooltip.confidence}%`
                                    : null
                            ]
                            .filter(Boolean)
                            .join(" • ")
                        );
                    }
                }
            }

            return {
                success: true,
                status:
                    "MOTION_PREDICTION_RENDERED_TO_LEAFLET",
                layerGroup:
                    targetGroup,
                layerCount:
                    definitions.length
            };
        }

        renderToMapLibre(map, sourceId = "rainarrival-motion-prediction") {
            if (
                !map ||
                typeof map.addSource !==
                "function"
            ) {
                return {
                    success: false,
                    status:
                        "MAPLIBRE_UNAVAILABLE"
                };
            }

            const result =
                this.latestResult ??
                this.renderAll();

            const geoJson =
                result?.geoJson ??
                this.geoJson;

            if (map.getSource?.(sourceId)) {
                map.getSource(sourceId)
                    .setData(
                        geoJson
                    );
            } else {
                map.addSource(
                    sourceId,
                    {
                        type: "geojson",
                        data: geoJson
                    }
                );
            }

            const lineLayerId =
                `${sourceId}-lines`;

            const pointLayerId =
                `${sourceId}-points`;

            if (!map.getLayer?.(lineLayerId)) {
                map.addLayer({
                    id:
                        lineLayerId,
                    type:
                        "line",
                    source:
                        sourceId,
                    filter: [
                        "==",
                        ["geometry-type"],
                        "LineString"
                    ],
                    paint: {
                        "line-color": [
                            "get",
                            "color"
                        ],
                        "line-width":
                            this.config.lineWeight,
                        "line-opacity":
                            this.config.lineOpacity
                    }
                });
            }

            if (!map.getLayer?.(pointLayerId)) {
                map.addLayer({
                    id:
                        pointLayerId,
                    type:
                        "circle",
                    source:
                        sourceId,
                    filter: [
                        "==",
                        ["geometry-type"],
                        "Point"
                    ],
                    paint: {
                        "circle-color": [
                            "get",
                            "color"
                        ],
                        "circle-radius":
                            this.config.markerRadius,
                        "circle-opacity": [
                            "coalesce",
                            ["get", "opacity"],
                            0.85
                        ]
                    }
                });
            }

            return {
                success: true,
                status:
                    "MOTION_PREDICTION_RENDERED_TO_MAPLIBRE",
                sourceId,
                lineLayerId,
                pointLayerId,
                featureCount:
                    geoJson.features.length
            };
        }

        getLayers() {
            return cloneValue(
                this.layers
            );
        }

        getGeoJSON() {
            return cloneValue(
                this.geoJson
            );
        }

        getTrackLayer(trackId) {
            return cloneValue(
                this.layers.find(
                    layer =>
                        layer.trackId ===
                        String(trackId)
                ) ??
                null
            );
        }

        getLatestResult() {
            return cloneValue(
                this.latestResult
            );
        }

        printTable() {
            const rows = this.layers.map(
                layer => ({
                    trackId:
                        layer.trackId,
                    city:
                        layer.city,
                    accepted:
                        layer.accepted,
                    confidence:
                        layer.confidence,
                    confidenceBand:
                        layer.confidenceBand,
                    futurePoints:
                        layer.futurePoints.length,
                    baseSpeedKmh:
                        layer.baseSpeedKmh,
                    baseBearing:
                        layer.baseBearing,
                    acceleration:
                        layer.accelerationKmhPerMinute,
                    turnRate:
                        layer.turnRateDegPerMinute
                })
            );

            console.table(rows);
            return rows;
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
                rendering:
                    this.rendering,
                layerCount:
                    this.layers.length,
                featureCount:
                    this.geoJson
                        ?.features
                        ?.length ??
                    0,
                latestResult:
                    this.getLatestResult(),
                lastError:
                    cloneValue(
                        this.lastError
                    ),
                statistics:
                    cloneValue(
                        this.statistics
                    ),
                config:
                    cloneValue(
                        this.config
                    )
            };
        }

        diagnose() {
            const diagnostics =
                this.getDiagnostics();

            console.log(
                "[RainArrival MotionPredictionRenderer]",
                diagnostics
            );

            return diagnostics;
        }

        clear() {
            this.layers = [];

            this.geoJson = {
                type:
                    "FeatureCollection",
                features:
                    []
            };

            this.latestResult =
                null;

            this.publish({
                success:
                    true,
                status:
                    "MOTION_PREDICTION_RENDERER_CLEARED",
                generatedAt:
                    now()
            });

            return {
                success:
                    true
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

            this.renderAll();

            this.timer =
                global.setInterval(
                    () =>
                        this.renderAll(),
                    this.config
                        .updateIntervalMs
                );

            return {
                success:
                    true,
                running:
                    true,
                intervalMs:
                    this.config
                        .updateIntervalMs
            };
        }

        stop() {
            if (this.timer) {
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
    }

    const renderer =
        new MotionPredictionRenderer();

    global.RainArrivalMotionPredictionRendererV32 =
        renderer;

    global.RainArrivalMotionPredictionRenderEngineV32 =
        renderer;

    global.RainGuardAI =
        global.RainGuardAI ||
        {};

    global.RainGuardAI.V32 =
        global.RainGuardAI.V32 ||
        {};

    global.RainGuardAI.V32.rainArrivalModules =
        global.RainGuardAI.V32.rainArrivalModules ||
        {};

    global.RainGuardAI.V32
        .rainArrivalModules
        .motionPredictionRenderer =
        renderer;

    global.RainArrivalEngineV32
        ?.register?.(
            MODULE_NAME,
            renderer
        );

    global.RainArrivalOrchestratorV32
        ?.register?.(
            MODULE_NAME,
            renderer
        );

    global.renderRainArrivalMotionPredictions =
        () =>
            renderer.renderAll();

    if (renderer.config.autoStart) {
        renderer.start();
    }

    console.log(
        "[RainGuard AI V32] Motion Prediction Renderer loaded.",
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
