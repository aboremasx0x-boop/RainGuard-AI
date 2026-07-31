/* ==========================================================
   RainGuard AI V31
   Storm Visualization Engine

   File:
   frontend/js/storm_visualization_engine_v31.js

   Depends on:
   - Leaflet
   - Storm Cell Tracking Engine V31
   - Storm Path Prediction Engine V31

   Purpose:
   - Draw active storm cells
   - Draw historical movement paths
   - Draw 30/60/90/120-minute forecast paths
   - Display direction, speed, intensity and risk
   - Display predicted impacted cities
   - Animate storm movement indicators
   ========================================================== */

"use strict";

window.RG31 =
    window.RG31 || {};

window.RG30 =
    window.RG30 || {};

RG31.StormVisualizationEngine = {

    version:
        "31.0.0",

    initialized:
        false,

    rendering:
        false,

    cycleNumber:
        0,

    lastRenderAt:
        null,

    map:
        null,

    layerGroup:
        null,

    activeCellLayer:
        null,

    historyPathLayer:
        null,

    forecastPathLayer:
        null,

    forecastPointLayer:
        null,

    impactedCityLayer:
        null,

    directionLayer:
        null,

    animationLayer:
        null,

    renderedCells:
        {},

    renderedPaths:
        {},

    animationFrameId:
        null,

    animationStartedAt:
        null,

    latestVisualizationReport:
        null,

    storageKey:
        "rainguard_v31_storm_visualization",

    config: {

        enabled:
            true,

        automaticRendering:
            true,

        mapElementIds: [

            "nationalMap",

            "verificationMap",

            "liveNationalVerificationMap",

            "map"

        ],

        /* ==================================================
           DISPLAY CONTROL
           ================================================== */

        display: {

            showActiveCells:
                true,

            showHistoryPaths:
                true,

            showForecastPaths:
                true,

            showForecastPoints:
                true,

            showImpactedCities:
                true,

            showDirectionArrows:
                true,

            showLabels:
                true,

            showConfidence:
                true,

            showRiskCircles:
                true,

            showCurrentPosition:
                true,

            fitBoundsAutomatically:
                false

        },

        /* ==================================================
           CELL MARKERS
           ================================================== */

        cellMarker: {

            minimumRadius:
                12,

            maximumRadius:
                34,

            baseRadius:
                16,

            pulseEnabled:
                true,

            pulseDurationMs:
                1800,

            fillOpacity:
                0.60,

            borderOpacity:
                1,

            borderWeight:
                3

        },

        /* ==================================================
           HISTORY PATH
           ================================================== */

        historyPath: {

            enabled:
                true,

            maximumPoints:
                20,

            weight:
                3,

            opacity:
                0.60,

            dashArray:
                "5 8"

        },

        /* ==================================================
           FORECAST PATH
           ================================================== */

        forecastPath: {

            enabled:
                true,

            weight:
                5,

            opacity:
                0.85,

            dashArray:
                "10 8",

            animated:
                true,

            animationSpeed:
                1.2

        },

        /* ==================================================
           FORECAST POINTS
           ================================================== */

        forecastPoints: {

            radius: {

                30:
                    8,

                60:
                    10,

                90:
                    12,

                120:
                    14

            },

            opacity: {

                30:
                    0.95,

                60:
                    0.85,

                90:
                    0.75,

                120:
                    0.65

            },

            labels: {

                30:
                    "30m",

                60:
                    "60m",

                90:
                    "90m",

                120:
                    "120m"

            }

        },

        /* ==================================================
           IMPACTED CITIES
           ================================================== */

        impactedCities: {

            maximumDistanceKm:
                120,

            minimumRisk:
                20,

            circleRadiusMeters: {

                DIRECT_HIGH_IMPACT:
                    30000,

                LIKELY_IMPACT:
                    22000,

                POSSIBLE_IMPACT:
                    16000,

                MONITORING:
                    10000

            },

            fillOpacity:
                0.16,

            borderOpacity:
                0.80,

            borderWeight:
                2

        },

        /* ==================================================
           DIRECTION ARROWS
           ================================================== */

        direction: {

            enabled:
                true,

            distanceKm:
                15,

            minimumSpeedKmh:
                5,

            arrowSize:
                22

        },

        /* ==================================================
           ANIMATION
           ================================================== */

        animation: {

            enabled:
                true,

            durationMs:
                6000,

            intervalMs:
                60,

            markerRadius:
                5,

            pathProgressMaximum:
                1

        },

        /* ==================================================
           RISK COLORS
           ================================================== */

        colors: {

            MINIMAL:
                "#22c55e",

            LOW:
                "#38bdf8",

            MODERATE:
                "#facc15",

            HIGH:
                "#fb923c",

            SEVERE:
                "#ef4444",

            UNKNOWN:
                "#94a3b8",

            currentPosition:
                "#ffffff",

            history:
                "#64748b",

            forecast:
                "#a78bfa",

            impactedCity:
                "#f59e0b"

        },

        /* ==================================================
           DEVELOPMENT
           ================================================== */

        development: {

            enabled:
                true,

            logInitialization:
                true,

            logRendering:
                true,

            logMissingMap:
                true,

            exposeDebugState:
                true

        }

    },

    /* ======================================================
       INITIALIZATION
       ====================================================== */

    init() {

        if (
            this.initialized
        ) {

            return true;

        }

        if (
            this.config.enabled !==
            true
        ) {

            return false;

        }

        this.initialized =
            true;

        this.loadState();

        this.bindEvents();

        this.resolveMap();

        this.initializeLayers();

        this.startAnimationLoop();

        this.writeLog(
            "Storm Visualization Engine V31 initialized."
        );

        window.dispatchEvent(

            new CustomEvent(

                "rg31:storm-visualization-ready",

                {

                    detail: {

                        version:
                            this.version,

                        mapAvailable:
                            Boolean(
                                this.map
                            ),

                        timestamp:
                            new Date()
                                .toISOString()

                    }

                }

            )

        );

        return true;

    },

    /* ======================================================
       EVENT BINDINGS
       ====================================================== */

    bindEvents() {

        window.addEventListener(

            "rg31:storm-cell-tracking-completed",

            event => {

                if (
                    this.config
                        .automaticRendering !==
                    true
                ) {

                    return;

                }

                const activeCells =

                    event
                        ?.detail
                        ?.activeCells ||

                    event
                        ?.detail
                        ?.report
                        ?.activeCells ||

                    [];

                const predictions =
                    this.getCurrentPredictions();

                this.renderStormSystem({

                    activeCells,

                    predictions

                });

            }

        );

        window.addEventListener(

            "rg31:storm-path-prediction-completed",

            event => {

                if (
                    this.config
                        .automaticRendering !==
                    true
                ) {

                    return;

                }

                const predictions =

                    event
                        ?.detail
                        ?.predictions ||

                    event
                        ?.detail
                        ?.report
                        ?.predictions ||

                    [];

                const activeCells =
                    this.getCurrentActiveCells();

                this.renderStormSystem({

                    activeCells,

                    predictions

                });

            }

        );

        window.addEventListener(

            "rg31:storm-cells-updated",

            event => {

                if (
                    this.config
                        .automaticRendering !==
                    true
                ) {

                    return;

                }

                this.renderStormSystem({

                    activeCells:
                        event
                            ?.detail
                            ?.activeCells ||
                        [],

                    predictions:
                        this.getCurrentPredictions()

                });

            }

        );

        window.addEventListener(

            "rg31:storm-paths-updated",

            event => {

                if (
                    this.config
                        .automaticRendering !==
                    true
                ) {

                    return;

                }

                this.renderStormSystem({

                    activeCells:
                        this.getCurrentActiveCells(),

                    predictions:
                        event
                            ?.detail
                            ?.predictions ||
                        []

                });

            }

        );

        window.addEventListener(

            "rg31:storm-visualization-refresh",

            () => {

                this.renderCurrentState();

            }

        );

        window.addEventListener(

            "resize",

            () => {

                if (
                    this.map
                        ?.invalidateSize
                ) {

                    window.setTimeout(
                        () =>
                            this.map
                                .invalidateSize(),
                        150
                    );

                }

            }

        );

    },

    /* ======================================================
       RESOLVE LEAFLET MAP
       ====================================================== */

    resolveMap() {

        const mapCandidates = [

            window.nationalVerificationMap,

            window.verificationMap,

            window.nationalMap,

            window.liveMap,

            window.map,

            window.RG31
                ?.Map,

            window.RG30
                ?.Map,

            window.RG23
                ?.Map,

            window.RG23
                ?.Brain
                ?.map

        ];

        for (
            const candidate of
            mapCandidates
        ) {

            if (
                this.isLeafletMap(
                    candidate
                )
            ) {

                this.map =
                    candidate;

                return this.map;

            }

        }

        if (
            typeof window.L ===
                "undefined"
        ) {

            this.writeLog(
                "Leaflet is not available.",
                "warning"
            );

            return null;

        }

        for (
            const elementId of
            this.config.mapElementIds
        ) {

            const element =
                document.getElementById(
                    elementId
                );

            if (
                !element
            ) {

                continue;

            }

            const leafletId =
                element._leaflet_id;

            if (
                leafletId &&
                window.L
                    ?._leaflet_id
            ) {

                continue;

            }

            const discoveredMap =
                this.discoverLeafletMapFromElement(
                    element
                );

            if (
                discoveredMap
            ) {

                this.map =
                    discoveredMap;

                return this.map;

            }

        }

        if (
            this.config
                .development
                .logMissingMap
        ) {

            this.writeLog(
                "Storm visualization is ready, but the Leaflet map was not found.",
                "warning"
            );

        }

        return null;

    },

    /* ======================================================
       CHECK LEAFLET MAP
       ====================================================== */

    isLeafletMap(
        candidate
    ) {

        return Boolean(

            candidate &&

            typeof candidate
                .addLayer ===
                "function" &&

            typeof candidate
                .removeLayer ===
                "function" &&

            typeof candidate
                .getCenter ===
                "function" &&

            typeof candidate
                .latLngToLayerPoint ===
                "function"

        );

    },

    /* ======================================================
       DISCOVER MAP FROM DOM ELEMENT
       ====================================================== */

    discoverLeafletMapFromElement(
        element
    ) {

        if (
            !element
        ) {

            return null;

        }

        const possibleProperties = [

            "_leaflet_map",

            "_map",

            "leafletMap",

            "mapInstance"

        ];

        for (
            const property of
            possibleProperties
        ) {

            const value =
                element[
                    property
                ];

            if (
                this.isLeafletMap(
                    value
                )
            ) {

                return value;

            }

        }

        return null;

    },

    /* ======================================================
       INITIALIZE LAYERS
       ====================================================== */

    initializeLayers() {

        if (
            !this.map ||
            typeof window.L ===
                "undefined"
        ) {

            return false;

        }

        this.removeExistingLayers();

        this.layerGroup =
            window.L
                .layerGroup()
                .addTo(
                    this.map
                );

        this.historyPathLayer =
            window.L
                .layerGroup()
                .addTo(
                    this.layerGroup
                );

        this.forecastPathLayer =
            window.L
                .layerGroup()
                .addTo(
                    this.layerGroup
                );

        this.impactedCityLayer =
            window.L
                .layerGroup()
                .addTo(
                    this.layerGroup
                );

        this.directionLayer =
            window.L
                .layerGroup()
                .addTo(
                    this.layerGroup
                );

        this.activeCellLayer =
            window.L
                .layerGroup()
                .addTo(
                    this.layerGroup
                );

        this.forecastPointLayer =
            window.L
                .layerGroup()
                .addTo(
                    this.layerGroup
                );

        this.animationLayer =
            window.L
                .layerGroup()
                .addTo(
                    this.layerGroup
                );

        return true;

    },

    /* ======================================================
       REMOVE EXISTING LAYERS
       ====================================================== */

    removeExistingLayers() {

        if (
            this.map &&
            this.layerGroup &&
            this.map.hasLayer?.(
                this.layerGroup
            )
        ) {

            this.map.removeLayer(
                this.layerGroup
            );

        }

        this.layerGroup =
            null;

        this.activeCellLayer =
            null;

        this.historyPathLayer =
            null;

        this.forecastPathLayer =
            null;

        this.forecastPointLayer =
            null;

        this.impactedCityLayer =
            null;

        this.directionLayer =
            null;

        this.animationLayer =
            null;

    },

    /* ======================================================
       ENSURE MAP AND LAYERS
       ====================================================== */

    ensureMapReady() {

        if (
            !this.map
        ) {

            this.resolveMap();

        }

        if (
            !this.map
        ) {

            return false;

        }

        if (
            !this.layerGroup
        ) {

            this.initializeLayers();

        }

        return Boolean(
            this.layerGroup
        );

    },

    /* ======================================================
       GET CURRENT ACTIVE CELLS
       ====================================================== */

    getCurrentActiveCells() {

        const tracker =

            window.RG31
                ?.StormCellTrackingEngine ||

            window.RG30
                ?.StormCellTrackingEngine;

        if (
            typeof tracker
                ?.getActiveCells ===
                "function"
        ) {

            return tracker
                .getActiveCells();

        }

        if (
            Array.isArray(
                window.RG31
                    ?.ActiveStormCells
            )
        ) {

            return [
                ...window.RG31
                    .ActiveStormCells
            ];

        }

        return [];

    },

    /* ======================================================
       GET CURRENT PREDICTIONS
       ====================================================== */

    getCurrentPredictions() {

        const predictor =

            window.RG31
                ?.StormPathPredictionEngine ||

            window.RG30
                ?.StormPathPredictionEngine;

        if (
            typeof predictor
                ?.getPredictedPaths ===
                "function"
        ) {

            return predictor
                .getPredictedPaths();

        }

        if (
            Array.isArray(
                window.RG31
                    ?.PredictedStormPaths
            )
        ) {

            return [
                ...window.RG31
                    .PredictedStormPaths
            ];

        }

        return [];

    },

    /* ======================================================
       RENDER CURRENT STATE
       ====================================================== */

    renderCurrentState() {

        return this.renderStormSystem({

            activeCells:
                this.getCurrentActiveCells(),

            predictions:
                this.getCurrentPredictions()

        });

    },
      /* ======================================================
       MAIN RENDERING CYCLE
       ====================================================== */

    async renderStormSystem({

        activeCells = [],

        predictions = []

    } = {}) {

        if (
            this.config.enabled !==
            true
        ) {

            return null;

        }

        if (
            this.rendering
        ) {

            return this.latestVisualizationReport;

        }

        if (
            !this.ensureMapReady()
        ) {

            this.writeLog(
                "Storm visualization skipped because the Leaflet map is unavailable.",
                "warning"
            );

            return null;

        }

        this.rendering =
            true;

        this.cycleNumber +=
            1;

        this.lastRenderAt =
            new Date()
                .toISOString();

        const startedAt =
            Date.now();

        try {

            const normalizedCells =
                Array.isArray(
                    activeCells
                )
                    ? activeCells
                    : [];

            const normalizedPredictions =
                Array.isArray(
                    predictions
                )
                    ? predictions
                    : [];

            this.clearVisualizationLayers();

            this.renderedCells =
                {};

            this.renderedPaths =
                {};

            const cellsById =
                this.createCellLookup(
                    normalizedCells
                );

            const predictionsByCellId =
                this.createPredictionLookup(
                    normalizedPredictions
                );

            const renderedCells =
                [];

            const renderedPaths =
                [];

            const renderedImpactedCities =
                [];

            normalizedCells.forEach(
                cell => {

                    const prediction =
                        predictionsByCellId[
                            cell.cellId
                        ] ||
                        null;

                    const result =
                        this.renderActiveStormCell(

                            cell,

                            prediction

                        );

                    if (
                        result
                    ) {

                        renderedCells.push(
                            result
                        );

                    }

                }
            );

            normalizedPredictions.forEach(
                prediction => {

                    const cell =
                        cellsById[
                            prediction.cellId
                        ] ||
                        null;

                    const pathResult =
                        this.renderPredictedStormPath(

                            prediction,

                            cell

                        );

                    if (
                        pathResult
                    ) {

                        renderedPaths.push(
                            pathResult
                        );

                    }

                    const cityResults =
                        this.renderImpactedCities(

                            prediction,

                            cell

                        );

                    if (
                        Array.isArray(
                            cityResults
                        ) &&
                        cityResults.length
                    ) {

                        renderedImpactedCities.push(
                            ...cityResults
                        );

                    }

                }
            );

            if (
                this.config
                    .display
                    .fitBoundsAutomatically ===
                    true
            ) {

                this.fitVisualizationBounds();

            }

            const report = {

                cycleNumber:
                    this.cycleNumber,

                activeCellsReceived:
                    normalizedCells.length,

                predictionsReceived:
                    normalizedPredictions.length,

                cellsRendered:
                    renderedCells.length,

                pathsRendered:
                    renderedPaths.length,

                impactedCitiesRendered:
                    renderedImpactedCities.length,

                renderedCells,

                renderedPaths,

                renderedImpactedCities,

                mapAvailable:
                    Boolean(
                        this.map
                    ),

                durationMs:
                    Date.now() -
                    startedAt,

                timestamp:
                    this.lastRenderAt

            };

            this.latestVisualizationReport =
                report;

            this.saveState();

            this.publishVisualizationReport(
                report
            );

           window.RG31 = window.RG31 || {};

window.RG31.activeStormCells =
    activeStormCells;

window.RG31.predictedStormPaths =
    predictedStormPaths;

window.RG31.LatestStormPathPrediction = {
    cells: activeStormCells,
    paths: predictedStormPaths,
    generatedAt: Date.now()
};

window.RG31.latestStormTrackingReport = {
    cells: activeStormCells,
    paths: predictedStormPaths
};

            if (
                this.config
                    .development
                    .logRendering
            ) {

                this.writeLog(

                    `Storm visualization cycle ${this.cycleNumber} completed. Cells: ${renderedCells.length}, paths: ${renderedPaths.length}.`

                );

            }

            return report;

        } catch (error) {

            console.error(
                "Storm Visualization rendering failed:",
                error
            );

            this.writeLog(

                `Storm visualization failed: ${error?.message || String(error)}`,

                "danger"

            );

            window.dispatchEvent(

                new CustomEvent(

                    "rg31:storm-visualization-failed",

                    {

                        detail: {

                            cycleNumber:
                                this.cycleNumber,

                            error:
                                error
                                    ?.message ||
                                String(
                                    error
                                ),

                            timestamp:
                                new Date()
                                    .toISOString()

                        }

                    }

                )

            );

            return null;

        } finally {

            this.rendering =
                false;

        }

    },

    /* ======================================================
       CLEAR VISUALIZATION LAYERS
       ====================================================== */

    clearVisualizationLayers() {

        const layers = [

            this.activeCellLayer,

            this.historyPathLayer,

            this.forecastPathLayer,

            this.forecastPointLayer,

            this.impactedCityLayer,

            this.directionLayer,

            this.animationLayer

        ];

        layers.forEach(
            layer => {

                if (
                    layer &&
                    typeof layer.clearLayers ===
                        "function"
                ) {

                    layer.clearLayers();

                }

            }
        );

        this.renderedCells =
            {};

        this.renderedPaths =
            {};

    },

    /* ======================================================
       CREATE CELL LOOKUP
       ====================================================== */

    createCellLookup(
        activeCells = []
    ) {

        const lookup =
            {};

        activeCells.forEach(
            cell => {

                if (
                    !cell ||
                    !cell.cellId
                ) {

                    return;

                }

                lookup[
                    cell.cellId
                ] =
                    cell;

            }
        );

        return lookup;

    },

    /* ======================================================
       CREATE PREDICTION LOOKUP
       ====================================================== */

    createPredictionLookup(
        predictions = []
    ) {

        const lookup =
            {};

        predictions.forEach(
            prediction => {

                if (
                    !prediction ||
                    !prediction.cellId
                ) {

                    return;

                }

                lookup[
                    prediction.cellId
                ] =
                    prediction;

            }
        );

        return lookup;

    },

    /* ======================================================
       FIT VISUALIZATION BOUNDS
       ====================================================== */

    fitVisualizationBounds() {

        if (
            !this.map ||
            typeof window.L ===
                "undefined"
        ) {

            return false;

        }

        const points =
            [];

        Object.values(
            this.renderedCells
        )
        .forEach(
            item => {

                if (
                    Number.isFinite(
                        Number(
                            item.lat
                        )
                    ) &&
                    Number.isFinite(
                        Number(
                            item.lon
                        )
                    )
                ) {

                    points.push(
                        [
                            Number(
                                item.lat
                            ),
                            Number(
                                item.lon
                            )
                        ]
                    );

                }

            }
        );

        Object.values(
            this.renderedPaths
        )
        .forEach(
            item => {

                if (
                    !Array.isArray(
                        item.points
                    )
                ) {

                    return;

                }

                item.points.forEach(
                    point => {

                        if (
                            Number.isFinite(
                                Number(
                                    point.lat
                                )
                            ) &&
                            Number.isFinite(
                                Number(
                                    point.lon
                                )
                            )
                        ) {

                            points.push(
                                [
                                    Number(
                                        point.lat
                                    ),
                                    Number(
                                        point.lon
                                    )
                                ]
                            );

                        }

                    }
                );

            }
        );

        if (
            points.length <
            2
        ) {

            return false;

        }

        const bounds =
            window.L
                .latLngBounds(
                    points
                );

        if (
            bounds.isValid()
        ) {

            this.map.fitBounds(

                bounds,

                {

                    padding:
                        [
                            40,
                            40
                        ],

                    maxZoom:
                        8

                }

            );

            return true;

        }

        return false;

    },

    /* ======================================================
       RENDER SUMMARY PLACEHOLDER
       ====================================================== */

    getVisualizationSummary() {

        return {

            version:
                this.version,

            initialized:
                this.initialized,

            rendering:
                this.rendering,

            cycleNumber:
                this.cycleNumber,

            lastRenderAt:
                this.lastRenderAt,

            mapAvailable:
                Boolean(
                    this.map
                ),

            renderedCellCount:
                Object.keys(
                    this.renderedCells
                )
                .length,

            renderedPathCount:
                Object.keys(
                    this.renderedPaths
                )
                .length,

            latestVisualizationReport:
                this.latestVisualizationReport

        };

    },
      /* ======================================================
       RENDER ACTIVE STORM CELL
       ====================================================== */

    renderActiveStormCell(
        cell = {},
        prediction = null
    ) {

        if (
            this.config
                .display
                .showActiveCells !==
                true
        ) {

            return null;

        }

        if (
            !this.activeCellLayer ||
            typeof window.L ===
                "undefined"
        ) {

            return null;

        }

        const lat =
            this.firstNullableNumber(

                cell.currentLat,

                cell.lat,

                cell.latitude

            );

        const lon =
            this.firstNullableNumber(

                cell.currentLon,

                cell.lon,

                cell.lng,

                cell.longitude

            );

        if (
            lat === null ||
            lon === null
        ) {

            return null;

        }

        const riskLevel =
            this.normalizeStatus(

                cell.riskLevel ||

                this.getRiskLevel(

                    cell.riskScore

                )

            );

        const color =
            this.getRiskColor(
                riskLevel
            );

        const radius =
            this.calculateCellMarkerRadius(
                cell
            );

        let riskCircle =
            null;

        let marker =
            null;

        let directionArrow =
            null;

        if (
            this.config
                .display
                .showRiskCircles ===
                true
        ) {

            riskCircle =
                this.renderCellRiskCircle(

                    cell,

                    {
                        lat,
                        lon,
                        color,
                        radius,
                        riskLevel
                    }

                );

        }

        if (
            this.config
                .display
                .showCurrentPosition ===
                true
        ) {

            marker =
                this.renderCellMarker(

                    cell,

                    prediction,

                    {
                        lat,
                        lon,
                        color,
                        radius,
                        riskLevel
                    }

                );

        }

        if (
            this.config
                .display
                .showDirectionArrows ===
                true
        ) {

            directionArrow =
                this.renderCellDirectionArrow(

                    cell,

                    {
                        lat,
                        lon,
                        color,
                        riskLevel
                    }

                );

        }

        if (
            this.config
                .display
                .showHistoryPaths ===
                true
        ) {

            this.renderCellHistoryPath(
                cell
            );

        }

        const renderedCell = {

            cellId:
                cell.cellId,

            city:
                cell.city ||
                "Unknown",

            lat,

            lon,

            riskScore:
                Math.round(
                    this.clamp(
                        cell.riskScore,
                        0,
                        100
                    )
                ),

            riskLevel,

            intensity:
                Math.round(
                    this.clamp(
                        cell.intensity,
                        0,
                        100
                    )
                ),

            confidence:
                Math.round(
                    this.clamp(
                        cell.confidence,
                        0,
                        100
                    )
                ),

            speedKmh:
                Number(
                    this.safeNumber(
                        cell.speedKmh,
                        0
                    )
                    .toFixed(
                        2
                    )
                ),

            directionLabel:
                cell.directionLabel ||
                "UNKNOWN",

            radius,

            color,

            markerCreated:
                Boolean(
                    marker
                ),

            riskCircleCreated:
                Boolean(
                    riskCircle
                ),

            directionArrowCreated:
                Boolean(
                    directionArrow
                ),

            timestamp:
                this.lastRenderAt

        };

        this.renderedCells[
            cell.cellId
        ] =
            renderedCell;

        return renderedCell;

    },

    /* ======================================================
       RENDER CELL MARKER
       ====================================================== */

    renderCellMarker(
        cell = {},
        prediction = null,
        context = {}
    ) {

        if (
            !this.activeCellLayer ||
            typeof window.L ===
                "undefined"
        ) {

            return null;

        }

        const lat =
            this.firstNullableNumber(
                context.lat
            );

        const lon =
            this.firstNullableNumber(
                context.lon
            );

        if (
            lat === null ||
            lon === null
        ) {

            return null;

        }

        const color =
            context.color ||
            this.getRiskColor(
                context.riskLevel
            );

        const radius =
            this.safeNumber(
                context.radius,
                this.config
                    .cellMarker
                    .baseRadius
            );

        const icon =
            this.createStormCellDivIcon({

                cell,

                color,

                radius

            });

        const marker =
            window.L
                .marker(

                    [
                        lat,
                        lon
                    ],

                    {
                        icon,

                        keyboard:
                            false,

                        riseOnHover:
                            true,

                        riseOffset:
                            500,

                        pane:
                            "markerPane",

                        title:
                            this.buildStormCellTitle(
                                cell
                            )

                    }

                )
                .addTo(
                    this.activeCellLayer
                );

        const popupHtml =
            this.buildStormCellPopup(

                cell,

                prediction

            );

        marker.bindPopup(

            popupHtml,

            {

                maxWidth:
                    360,

                minWidth:
                    260,

                className:
                    "rg31-storm-popup",

                autoPan:
                    true,

                closeButton:
                    true

            }

        );

        if (
            this.config
                .display
                .showLabels ===
                true
        ) {

            const tooltipHtml =
                this.buildStormCellTooltip(
                    cell
                );

            marker.bindTooltip(

                tooltipHtml,

                {

                    permanent:
                        false,

                    direction:
                        "top",

                    offset:
                        [
                            0,
                            -Math.max(
                                8,
                                radius
                            )
                        ],

                    opacity:
                        0.96,

                    className:
                        "rg31-storm-tooltip"

                }

            );

        }

        marker.on(

            "click",

            () => {

                window.dispatchEvent(

                    new CustomEvent(

                        "rg31:storm-cell-selected",

                        {

                            detail: {

                                cellId:
                                    cell.cellId,

                                cell,

                                prediction,

                                timestamp:
                                    new Date()
                                        .toISOString()

                            }

                        }

                    )

                );

            }

        );

        marker.on(

            "mouseover",

            () => {

                const element =
                    marker.getElement?.();

                if (
                    element
                ) {

                    element.classList.add(
                        "rg31-storm-marker-hover"
                    );

                }

            }

        );

        marker.on(

            "mouseout",

            () => {

                const element =
                    marker.getElement?.();

                if (
                    element
                ) {

                    element.classList.remove(
                        "rg31-storm-marker-hover"
                    );

                }

            }

        );

        return marker;

    },

    /* ======================================================
       CREATE STORM CELL DIV ICON
       ====================================================== */

    createStormCellDivIcon({

        cell = {},

        color,

        radius

    } = {}) {

        const safeRadius =
            Math.round(

                this.clamp(

                    radius,

                    this.config
                        .cellMarker
                        .minimumRadius,

                    this.config
                        .cellMarker
                        .maximumRadius

                )

            );

        const diameter =
            safeRadius *
            2;

        const intensity =
            Math.round(
                this.clamp(
                    cell.intensity,
                    0,
                    100
                )
            );

        const risk =
            Math.round(
                this.clamp(
                    cell.riskScore,
                    0,
                    100
                )
            );

        const speed =
            Math.round(
                this.safeNumber(
                    cell.speedKmh,
                    0
                )
            );

        const pulseClass =

            this.config
                .cellMarker
                .pulseEnabled ===
                true

                ? "rg31-storm-pulse"

                : "";

        const simulationClass =

            cell.simulated ===
                true

                ? "rg31-storm-simulated"

                : "";

        const lightningClass =

            this.safeNumber(
                cell.lightningScore,
                0
            ) >= 50

                ? "rg31-storm-lightning-active"

                : "";

        const label =

            this.config
                .display
                .showLabels ===
                true

                ? `
                    <span class="rg31-storm-marker-value">
                        ${risk}
                    </span>
                `

                : "";

        const html = `

            <div
                class="
                    rg31-storm-marker
                    ${pulseClass}
                    ${simulationClass}
                    ${lightningClass}
                "
                style="
                    --rg31-storm-color:${this.escapeHtml(
                        color
                    )};
                    --rg31-storm-size:${diameter}px;
                    --rg31-storm-pulse-duration:${
                        this.config
                            .cellMarker
                            .pulseDurationMs
                    }ms;
                "
                data-cell-id="${this.escapeHtml(
                    cell.cellId ||
                    ""
                )}"
                data-risk="${risk}"
                data-intensity="${intensity}"
                data-speed="${speed}"
            >

                <span class="rg31-storm-marker-core">

                    ${label}

                </span>

                <span class="rg31-storm-marker-ring"></span>

                ${
                    this.safeNumber(
                        cell.lightningScore,
                        0
                    ) >= 50

                        ? `
                            <span class="rg31-storm-lightning-symbol">
                                ⚡
                            </span>
                        `

                        : ""
                }

            </div>

        `;

        return window.L.divIcon({

            html,

            className:
                "rg31-storm-div-icon",

            iconSize:
                [
                    diameter,
                    diameter
                ],

            iconAnchor:
                [
                    safeRadius,
                    safeRadius
                ],

            popupAnchor:
                [
                    0,
                    -safeRadius
                ],

            tooltipAnchor:
                [
                    0,
                    -safeRadius
                ]

        });

    },

    /* ======================================================
       BUILD CELL TITLE
       ====================================================== */

    buildStormCellTitle(
        cell = {}
    ) {

        const city =
            cell.city ||
            this.text(
                "Unknown city",
                "مدينة غير معروفة"
            );

        const risk =
            Math.round(
                this.clamp(
                    cell.riskScore,
                    0,
                    100
                )
            );

        return `${city} — ${risk}%`;

    },

    /* ======================================================
       BUILD CELL TOOLTIP
       ====================================================== */

    buildStormCellTooltip(
        cell = {}
    ) {

        const city =
            this.escapeHtml(

                cell.city ||

                this.text(
                    "Unknown",
                    "غير معروف"
                )

            );

        const risk =
            Math.round(
                this.clamp(
                    cell.riskScore,
                    0,
                    100
                )
            );

        const speed =
            Number(
                this.safeNumber(
                    cell.speedKmh,
                    0
                )
            )
            .toFixed(
                1
            );

        const direction =
            this.getDirectionLabelLocalized(

                cell.directionLabel ||

                "UNKNOWN"

            );

        return `

            <div class="rg31-storm-tooltip-content">

                <b>${city}</b>

                <br>

                ${this.text(
                    "Risk",
                    "الخطر"
                )}: ${risk}%

                <br>

                ${this.text(
                    "Speed",
                    "السرعة"
                )}: ${speed} km/h

                <br>

                ${this.text(
                    "Direction",
                    "الاتجاه"
                )}: ${direction}

            </div>

        `;

    },
      /* ======================================================
       RENDER CELL RISK CIRCLE
       ====================================================== */

    renderCellRiskCircle(
        cell = {},
        context = {}
    ) {

        if (
            !this.activeCellLayer ||
            typeof window.L ===
                "undefined"
        ) {

            return null;

        }

        const lat =
            this.firstNullableNumber(
                context.lat
            );

        const lon =
            this.firstNullableNumber(
                context.lon
            );

        if (
            lat === null ||
            lon === null
        ) {

            return null;

        }

        const color =
            context.color ||
            this.getRiskColor(
                context.riskLevel
            );

        const intensity =
            this.clamp(
                cell.intensity,
                0,
                100
            );

        const riskScore =
            this.clamp(
                cell.riskScore,
                0,
                100
            );

        const confidence =
            this.clamp(
                cell.confidence,
                0,
                100
            );

        const radiusMeters =
            this.calculateCellRiskRadiusMeters({

                intensity,

                riskScore,

                confidence,

                lightningScore:
                    cell.lightningScore

            });

        const circle =
            window.L
                .circle(

                    [
                        lat,
                        lon
                    ],

                    {

                        radius:
                            radiusMeters,

                        color,

                        weight:
                            this.config
                                .cellMarker
                                .borderWeight,

                        opacity:
                            this.config
                                .cellMarker
                                .borderOpacity,

                        fillColor:
                            color,

                        fillOpacity:
                            this.config
                                .cellMarker
                                .fillOpacity *
                            0.32,

                        interactive:
                            false,

                        pane:
                            "overlayPane"

                    }

                )
                .addTo(
                    this.activeCellLayer
                );

        return circle;

    },

    /* ======================================================
       CALCULATE CELL RISK RADIUS
       ====================================================== */

    calculateCellRiskRadiusMeters({

        intensity = 0,

        riskScore = 0,

        confidence = 0,

        lightningScore = 0

    } = {}) {

        const normalizedIntensity =
            this.clamp(
                intensity,
                0,
                100
            );

        const normalizedRisk =
            this.clamp(
                riskScore,
                0,
                100
            );

        const normalizedConfidence =
            this.clamp(
                confidence,
                0,
                100
            );

        const normalizedLightning =
            this.clamp(
                lightningScore,
                0,
                100
            );

        const radiusKm =

            8 +

            normalizedIntensity *
                0.10 +

            normalizedRisk *
                0.08 +

            normalizedConfidence *
                0.03 +

            normalizedLightning *
                0.03;

        return Math.round(

            this.clamp(
                radiusKm,
                8,
                35
            ) *
            1000

        );

    },

    /* ======================================================
       RENDER CELL DIRECTION ARROW
       ====================================================== */

    renderCellDirectionArrow(
        cell = {},
        context = {}
    ) {

        if (
            !this.directionLayer ||
            typeof window.L ===
                "undefined"
        ) {

            return null;

        }

        if (
            this.config
                .direction
                .enabled !==
                true
        ) {

            return null;

        }

        const speedKmh =
            this.safeNumber(
                cell.speedKmh,
                0
            );

        if (
            speedKmh <
            this.config
                .direction
                .minimumSpeedKmh
        ) {

            return null;

        }

        const lat =
            this.firstNullableNumber(
                context.lat
            );

        const lon =
            this.firstNullableNumber(
                context.lon
            );

        const bearing =
            this.firstNullableNumber(

                cell.directionDegrees,

                this.directionLabelToDegrees(
                    cell.directionLabel
                )

            );

        if (
            lat === null ||
            lon === null ||
            bearing === null
        ) {

            return null;

        }

        const color =
            context.color ||
            this.getRiskColor(
                context.riskLevel
            );

        const projected =
            this.projectPosition({

                lat,

                lon,

                bearingDegrees:
                    bearing,

                distanceKm:
                    this.config
                        .direction
                        .distanceKm

            });

        const line =
            window.L
                .polyline(

                    [

                        [
                            lat,
                            lon
                        ],

                        [
                            projected.lat,
                            projected.lon
                        ]

                    ],

                    {

                        color,

                        weight:
                            3,

                        opacity:
                            0.85,

                        dashArray:
                            "8 6",

                        lineCap:
                            "round",

                        lineJoin:
                            "round",

                        interactive:
                            false

                    }

                )
                .addTo(
                    this.directionLayer
                );

        const arrowIcon =
            this.createDirectionArrowIcon({

                color,

                bearing,

                speedKmh,

                directionLabel:
                    cell.directionLabel

            });

        const arrowMarker =
            window.L
                .marker(

                    [
                        projected.lat,
                        projected.lon
                    ],

                    {

                        icon:
                            arrowIcon,

                        interactive:
                            false,

                        keyboard:
                            false,

                        pane:
                            "markerPane"

                    }

                )
                .addTo(
                    this.directionLayer
                );

        return {

            line,

            marker:
                arrowMarker,

            projectedPosition:
                projected

        };

    },

    /* ======================================================
       CREATE DIRECTION ARROW ICON
       ====================================================== */

    createDirectionArrowIcon({

        color,

        bearing = 0,

        speedKmh = 0,

        directionLabel = "UNKNOWN"

    } = {}) {

        const size =
            this.safeNumber(

                this.config
                    .direction
                    .arrowSize,

                22

            );

        const speed =
            Math.round(
                this.safeNumber(
                    speedKmh,
                    0
                )
            );

        const html = `

            <div
                class="rg31-storm-direction-arrow"
                style="
                    --rg31-arrow-color:${this.escapeHtml(
                        color
                    )};
                    --rg31-arrow-rotation:${this.safeNumber(
                        bearing,
                        0
                    )}deg;
                    --rg31-arrow-size:${size}px;
                "
                title="${this.escapeHtml(
                    this.getDirectionLabelLocalized(
                        directionLabel
                    )
                )} — ${speed} km/h"
            >

                <span class="rg31-storm-arrow-symbol">
                    ➤
                </span>

                <span class="rg31-storm-arrow-speed">
                    ${speed}
                </span>

            </div>

        `;

        return window.L.divIcon({

            html,

            className:
                "rg31-storm-direction-div-icon",

            iconSize:
                [
                    size * 2,
                    size * 2
                ],

            iconAnchor:
                [
                    size,
                    size
                ]

        });

    },

    /* ======================================================
       DIRECTION LABEL TO DEGREES
       ====================================================== */

    directionLabelToDegrees(
        directionLabel
    ) {

        const value =
            this.normalizeStatus(
                directionLabel
            );

        const mapping = {

            N:
                0,

            NE:
                45,

            E:
                90,

            SE:
                135,

            S:
                180,

            SW:
                225,

            W:
                270,

            NW:
                315

        };

        return mapping[
            value
        ] ?? null;

    },

    /* ======================================================
       CALCULATE CELL MARKER RADIUS
       ====================================================== */

    calculateCellMarkerRadius(
        cell = {}
    ) {

        const settings =
            this.config
                .cellMarker;

        const intensity =
            this.clamp(
                cell.intensity,
                0,
                100
            );

        const risk =
            this.clamp(
                cell.riskScore,
                0,
                100
            );

        const confidence =
            this.clamp(
                cell.confidence,
                0,
                100
            );

        const lightning =
            this.clamp(
                cell.lightningScore,
                0,
                100
            );

        const score =

            intensity *
                0.42 +

            risk *
                0.34 +

            confidence *
                0.14 +

            lightning *
                0.10;

        const range =

            settings.maximumRadius -

            settings.minimumRadius;

        const radius =

            settings.minimumRadius +

            score /
            100 *
            range;

        return Math.round(

            this.clamp(

                radius,

                settings.minimumRadius,

                settings.maximumRadius

            )

        );

    },

    /* ======================================================
       GET RISK COLOR
       ====================================================== */

    getRiskColor(
        riskLevel
    ) {

        const value =
            this.normalizeStatus(
                riskLevel
            );

        return (

            this.config
                .colors[
                    value
                ] ||

            this.config
                .colors
                .UNKNOWN

        );

    },

    /* ======================================================
       GET RISK LEVEL
       ====================================================== */

    getRiskLevel(
        riskScore
    ) {

        const value =
            this.clamp(
                riskScore,
                0,
                100
            );

        if (
            value >= 80
        ) {

            return "SEVERE";

        }

        if (
            value >= 65
        ) {

            return "HIGH";

        }

        if (
            value >= 45
        ) {

            return "MODERATE";

        }

        if (
            value >= 25
        ) {

            return "LOW";

        }

        return "MINIMAL";

    },

    /* ======================================================
       RENDER CELL HISTORY PATH
       ====================================================== */

    renderCellHistoryPath(
        cell = {}
    ) {

        if (
            !this.historyPathLayer ||
            typeof window.L ===
                "undefined"
        ) {

            return null;

        }

        if (
            this.config
                .historyPath
                .enabled !==
                true
        ) {

            return null;

        }

        const history =
            Array.isArray(
                cell.history
            )
                ? cell.history
                : [];

        if (
            history.length <
            2
        ) {

            return null;

        }

        const orderedHistory =
            [
                ...history
            ]
            .filter(
                point => {

                    return (

                        this.firstNullableNumber(
                            point.lat
                        ) !==
                        null &&

                        this.firstNullableNumber(
                            point.lon,
                            point.lng
                        ) !==
                        null

                    );

                }
            )
            .sort(
                (
                    first,
                    second
                ) => {

                    return (

                        new Date(
                            first.timestamp ||
                            0
                        )
                        .getTime() -

                        new Date(
                            second.timestamp ||
                            0
                        )
                        .getTime()

                    );

                }
            )
            .slice(

                -this.config
                    .historyPath
                    .maximumPoints

            );

        if (
            orderedHistory.length <
            2
        ) {

            return null;

        }

        const points =
            orderedHistory.map(
                point => [

                    this.safeNumber(
                        point.lat,
                        0
                    ),

                    this.safeNumber(
                        point.lon ??
                        point.lng,
                        0
                    )

                ]
            );

        const riskLevel =
            this.normalizeStatus(

                cell.riskLevel ||

                this.getRiskLevel(
                    cell.riskScore
                )

            );

        const color =
            this.getRiskColor(
                riskLevel
            );

        const path =
            window.L
                .polyline(

                    points,

                    {

                        color,

                        weight:
                            this.config
                                .historyPath
                                .weight,

                        opacity:
                            this.config
                                .historyPath
                                .opacity,

                        dashArray:
                            this.config
                                .historyPath
                                .dashArray,

                        lineCap:
                            "round",

                        lineJoin:
                            "round",

                        interactive:
                            false

                    }

                )
                .addTo(
                    this.historyPathLayer
                );

        return path;

    },

    /* ======================================================
       PROJECT POSITION
       ====================================================== */

    projectPosition({

        lat,

        lon,

        bearingDegrees,

        distanceKm

    } = {}) {

        const latitude =
            this.firstNullableNumber(
                lat
            );

        const longitude =
            this.firstNullableNumber(
                lon
            );

        const bearing =
            this.firstNullableNumber(
                bearingDegrees
            );

        const distance =
            Math.max(

                0,

                this.safeNumber(
                    distanceKm,
                    0
                )

            );

        if (
            latitude === null ||
            longitude === null ||
            bearing === null
        ) {

            return {

                lat:
                    latitude,

                lon:
                    longitude

            };

        }

        const earthRadiusKm =
            6371;

        const angularDistance =
            distance /
            earthRadiusKm;

        const toRadians =
            degrees =>
                degrees *
                Math.PI /
                180;

        const toDegrees =
            radians =>
                radians *
                180 /
                Math.PI;

        const latitudeRadians =
            toRadians(
                latitude
            );

        const longitudeRadians =
            toRadians(
                longitude
            );

        const bearingRadians =
            toRadians(
                bearing
            );

        const predictedLatitude =
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

        const predictedLongitude =

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
                    predictedLatitude
                )

            );

        return {

            lat:
                Number(
                    toDegrees(
                        predictedLatitude
                    )
                    .toFixed(
                        6
                    )
                ),

            lon:
                Number(

                    (
                        (
                            toDegrees(
                                predictedLongitude
                            ) +
                            540
                        ) %
                        360 -
                        180
                    )
                    .toFixed(
                        6
                    )

                )

        };

    },
      /* ======================================================
       BUILD STORM CELL POPUP
       ====================================================== */

    buildStormCellPopup(
        cell = {},
        prediction = null
    ) {

        const riskLevel =
            this.normalizeStatus(

                cell.riskLevel ||

                this.getRiskLevel(
                    cell.riskScore
                )

            );

        const city =
            this.escapeHtml(

                cell.city ||

                this.text(
                    "Unknown city",
                    "مدينة غير معروفة"
                )

            );

        const region =
            this.escapeHtml(
                cell.region ||
                ""
            );

        const riskScore =
            Math.round(
                this.clamp(
                    cell.riskScore,
                    0,
                    100
                )
            );

        const intensity =
            Math.round(
                this.clamp(
                    cell.intensity,
                    0,
                    100
                )
            );

        const confidence =
            Math.round(
                this.clamp(
                    cell.confidence,
                    0,
                    100
                )
            );

        const speedKmh =
            Number(
                this.safeNumber(
                    cell.speedKmh,
                    0
                )
            )
            .toFixed(
                1
            );

        const direction =
            this.getDirectionLabelLocalized(

                cell.directionLabel ||
                "UNKNOWN"

            );

        const trend =
            this.getTrendLabel(
                cell.trend ||
                "UNKNOWN"
            );

        const lifecycle =
            this.getLifecycleLabel(
                cell.lifecycleStage ||
                "UNKNOWN"
            );

        const riskLabel =
            this.getRiskLabel(
                riskLevel
            );

        const updatedAt =
            cell.lastSeenAt
                ? new Date(
                    cell.lastSeenAt
                )
                .toLocaleString(
                    this.getLocale()
                )
                : "--";

        const sourceList =
            Array.isArray(
                cell.sourceKeys
            ) &&
            cell.sourceKeys.length
                ? cell.sourceKeys
                    .map(
                        sourceKey =>
                            this.getSourceLabel(
                                sourceKey
                            )
                    )
                    .join(
                        this.isArabic()
                            ? "، "
                            : ", "
                    )
                : this.text(
                    "Unavailable",
                    "غير متاحة"
                );

        const predictionHtml =
            this.buildPredictionPopupSection(
                prediction
            );

        const impactedCitiesHtml =
            this.buildImpactedCitiesPopupSection(
                prediction
            );

        return `

            <div class="rg31-storm-popup-content">

                <div class="rg31-storm-popup-header">

                    <div>

                        <strong>

                            ${this.text(
                                "Storm Cell",
                                "خلية رعدية"
                            )}

                        </strong>

                        <div class="rg31-storm-popup-id">

                            ${this.escapeHtml(
                                cell.cellId ||
                                "--"
                            )}

                        </div>

                    </div>

                    <span
                        class="rg31-storm-risk-badge"
                        style="
                            background:${this.escapeHtml(
                                this.getRiskColor(
                                    riskLevel
                                )
                            )};
                        "
                    >

                        ${riskLabel}

                    </span>

                </div>

                <div class="rg31-storm-popup-location">

                    <b>${city}</b>

                    ${
                        region
                            ? `
                                <span>
                                    ${region}
                                </span>
                            `
                            : ""
                    }

                </div>

                <div class="rg31-storm-popup-grid">

                    ${this.buildPopupMetric({

                        labelEn:
                            "Risk",

                        labelAr:
                            "الخطر",

                        value:
                            `${riskScore}%`

                    })}

                    ${this.buildPopupMetric({

                        labelEn:
                            "Intensity",

                        labelAr:
                            "الشدة",

                        value:
                            `${intensity}%`

                    })}

                    ${this.buildPopupMetric({

                        labelEn:
                            "Confidence",

                        labelAr:
                            "الثقة",

                        value:
                            `${confidence}%`

                    })}

                    ${this.buildPopupMetric({

                        labelEn:
                            "Speed",

                        labelAr:
                            "السرعة",

                        value:
                            `${speedKmh} km/h`

                    })}

                    ${this.buildPopupMetric({

                        labelEn:
                            "Direction",

                        labelAr:
                            "الاتجاه",

                        value:
                            direction

                    })}

                    ${this.buildPopupMetric({

                        labelEn:
                            "Trend",

                        labelAr:
                            "النمو",

                        value:
                            trend

                    })}

                    ${this.buildPopupMetric({

                        labelEn:
                            "Lifecycle",

                        labelAr:
                            "دورة الحياة",

                        value:
                            lifecycle

                    })}

                    ${this.buildPopupMetric({

                        labelEn:
                            "Age",

                        labelAr:
                            "العمر",

                        value:
                            `${Math.round(
                                this.safeNumber(
                                    cell.ageMinutes,
                                    0
                                )
                            )} ${this.text(
                                "min",
                                "دقيقة"
                            )}`

                    })}

                </div>

                <div class="rg31-storm-popup-sources">

                    <b>

                        ${this.text(
                            "Sources",
                            "المصادر"
                        )}:

                    </b>

                    ${this.escapeHtml(
                        sourceList
                    )}

                </div>

                <div class="rg31-storm-popup-source-scores">

                    ${this.buildPopupSourceScore({

                        labelEn:
                            "Radar",

                        labelAr:
                            "الرادار",

                        score:
                            cell.radarScore

                    })}

                    ${this.buildPopupSourceScore({

                        labelEn:
                            "Satellite",

                        labelAr:
                            "الأقمار الصناعية",

                        score:
                            cell.satelliteScore

                    })}

                    ${this.buildPopupSourceScore({

                        labelEn:
                            "Lightning",

                        labelAr:
                            "البرق",

                        score:
                            cell.lightningScore

                    })}

                </div>

                ${predictionHtml}

                ${impactedCitiesHtml}

                ${
                    cell.simulated ===
                    true
                        ? `

                            <div class="rg31-storm-popup-warning">

                                ${this.text(

                                    "This storm cell includes simulated data.",

                                    "تتضمن هذه الخلية بيانات محاكاة."

                                )}

                            </div>

                        `
                        : ""
                }

                <div class="rg31-storm-popup-footer">

                    ${this.text(
                        "Last updated",
                        "آخر تحديث"
                    )}:
                    ${updatedAt}

                </div>

            </div>

        `;

    },

    /* ======================================================
       BUILD POPUP METRIC
       ====================================================== */

    buildPopupMetric({

        labelEn,

        labelAr,

        value

    } = {}) {

        return `

            <div class="rg31-storm-popup-metric">

                <span>

                    ${this.text(
                        labelEn,
                        labelAr
                    )}

                </span>

                <strong>

                    ${this.escapeHtml(
                        value ??
                        "--"
                    )}

                </strong>

            </div>

        `;

    },

    /* ======================================================
       BUILD POPUP SOURCE SCORE
       ====================================================== */

    buildPopupSourceScore({

        labelEn,

        labelAr,

        score = 0

    } = {}) {

        const normalizedScore =
            Math.round(
                this.clamp(
                    score,
                    0,
                    100
                )
            );

        return `

            <div class="rg31-storm-source-score">

                <div class="rg31-storm-source-score-header">

                    <span>

                        ${this.text(
                            labelEn,
                            labelAr
                        )}

                    </span>

                    <b>
                        ${normalizedScore}%
                    </b>

                </div>

                <div class="rg31-storm-source-score-track">

                    <span
                        style="
                            width:${normalizedScore}%;
                        "
                    ></span>

                </div>

            </div>

        `;

    },

    /* ======================================================
       PREDICTION POPUP SECTION
       ====================================================== */

    buildPredictionPopupSection(
        prediction = null
    ) {

        if (
            !prediction ||
            !Array.isArray(
                prediction.forecasts
            ) ||
            !prediction.forecasts.length
        ) {

            return `

                <div class="rg31-storm-popup-section">

                    <h4>

                        ${this.text(
                            "Path Prediction",
                            "توقع المسار"
                        )}

                    </h4>

                    <div class="rg31-storm-popup-empty">

                        ${this.text(

                            "No path forecast is currently available.",

                            "لا يتوفر توقع للمسار حاليًا."

                        )}

                    </div>

                </div>

            `;

        }

        const rows =
            prediction.forecasts
                .map(
                    point => {

                        const minutes =
                            this.safeNumber(
                                point.minutes,
                                0
                            );

                        const risk =
                            Math.round(
                                this.clamp(
                                    point.riskScore,
                                    0,
                                    100
                                )
                            );

                        const intensity =
                            Math.round(
                                this.clamp(
                                    point.intensity,
                                    0,
                                    100
                                )
                            );

                        const confidence =
                            Math.round(
                                this.clamp(
                                    point.confidence,
                                    0,
                                    100
                                )
                            );

                        const nearestCity =
                            this.escapeHtml(
                                point.nearestCity ||
                                "--"
                            );

                        const distance =
                            point.nearestCityDistanceKm !==
                                null &&
                            point.nearestCityDistanceKm !==
                                undefined
                                ? `${Number(
                                    point.nearestCityDistanceKm
                                )
                                .toFixed(
                                    1
                                )} km`
                                : "--";

                        const riskLevel =
                            this.getRiskLevel(
                                risk
                            );

                        const color =
                            this.getRiskColor(
                                riskLevel
                            );

                        return `

                            <div class="rg31-storm-forecast-row">

                                <div class="rg31-storm-forecast-time">

                                    <span
                                        class="rg31-storm-forecast-dot"
                                        style="
                                            background:${this.escapeHtml(
                                                color
                                            )};
                                        "
                                    ></span>

                                    <b>

                                        ${minutes}
                                        ${this.text(
                                            " min",
                                            " دقيقة"
                                        )}

                                    </b>

                                </div>

                                <div class="rg31-storm-forecast-city">

                                    ${nearestCity}

                                    <small>
                                        ${distance}
                                    </small>

                                </div>

                                <div class="rg31-storm-forecast-values">

                                    <span>

                                        ${this.text(
                                            "Risk",
                                            "خطر"
                                        )}
                                        ${risk}%

                                    </span>

                                    <span>

                                        ${this.text(
                                            "Intensity",
                                            "شدة"
                                        )}
                                        ${intensity}%

                                    </span>

                                    <span>

                                        ${this.text(
                                            "Confidence",
                                            "ثقة"
                                        )}
                                        ${confidence}%

                                    </span>

                                </div>

                            </div>

                        `;

                    }
                )
                .join("");

        return `

            <div class="rg31-storm-popup-section">

                <div class="rg31-storm-popup-section-header">

                    <h4>

                        ${this.text(
                            "Path Prediction",
                            "توقع المسار"
                        )}

                    </h4>

                    <span>

                        ${this.text(
                            "Path confidence",
                            "ثقة المسار"
                        )}:
                        ${Math.round(
                            this.clamp(
                                prediction.pathConfidence,
                                0,
                                100
                            )
                        )}%

                    </span>

                </div>

                <div class="rg31-storm-forecast-list">

                    ${rows}

                </div>

                <div class="rg31-storm-popup-path-summary">

                    <span>

                        ${this.text(
                            "Highest predicted risk",
                            "أعلى خطر متوقع"
                        )}:

                        <b>

                            ${Math.round(
                                this.clamp(
                                    prediction.highestPredictedRisk,
                                    0,
                                    100
                                )
                            )}%

                        </b>

                    </span>

                    <span>

                        ${this.text(
                            "At",
                            "بعد"
                        )}:

                        <b>

                            ${prediction.highestRiskMinutes ??
                            "--"}
                            ${this.text(
                                " min",
                                " دقيقة"
                            )}

                        </b>

                    </span>

                </div>

            </div>

        `;

    },

    /* ======================================================
       IMPACTED CITIES POPUP SECTION
       ====================================================== */

    buildImpactedCitiesPopupSection(
        prediction = null
    ) {

        const impactedCities =
            Array.isArray(
                prediction
                    ?.impactedCities
            )
                ? prediction
                    .impactedCities
                : [];

        if (
            !impactedCities.length
        ) {

            return "";

        }

        const rows =
            impactedCities
                .slice(
                    0,
                    6
                )
                .map(
                    city => {

                        const impactLevel =
                            this.normalizeStatus(
                                city.impactLevel ||
                                "MONITORING"
                            );

                        const risk =
                            Math.round(
                                this.clamp(
                                    city.maximumRisk,
                                    0,
                                    100
                                )
                            );

                        const confidence =
                            Math.round(
                                this.clamp(
                                    city.maximumConfidence,
                                    0,
                                    100
                                )
                            );

                        const color =
                            this.getRiskColor(
                                this.getRiskLevel(
                                    risk
                                )
                            );

                        const arrivalMinutes =
                            this.safeNumber(
                                city.firstImpactMinutes,
                                0
                            );

                        const distanceKm =
                            Number(
                                this.safeNumber(
                                    city.minimumDistanceKm,
                                    0
                                )
                            )
                            .toFixed(
                                1
                            );

                        return `

                            <div class="rg31-storm-impact-city-row">

                                <span
                                    class="rg31-storm-impact-city-indicator"
                                    style="
                                        background:${this.escapeHtml(
                                            color
                                        )};
                                    "
                                ></span>

                                <div class="rg31-storm-impact-city-name">

                                    <b>

                                        ${this.escapeHtml(
                                            city.city ||
                                            "--"
                                        )}

                                    </b>

                                    <small>

                                        ${this.getImpactLevelLabel(
                                            impactLevel
                                        )}

                                    </small>

                                </div>

                                <div class="rg31-storm-impact-city-arrival">

                                    <span>

                                        ${this.text(
                                            "Arrival",
                                            "الوصول"
                                        )}

                                    </span>

                                    <b>

                                        ${arrivalMinutes}
                                        ${this.text(
                                            " min",
                                            " دقيقة"
                                        )}

                                    </b>

                                </div>

                                <div class="rg31-storm-impact-city-stats">

                                    <span>
                                        ${distanceKm} km
                                    </span>

                                    <span>
                                        ${risk}%
                                    </span>

                                    <span>
                                        ${confidence}%
                                    </span>

                                </div>

                            </div>

                        `;

                    }
                )
                .join("");

        return `

            <div class="rg31-storm-popup-section">

                <h4>

                    ${this.text(
                        "Expected Impacted Cities",
                        "المدن المتوقع تأثرها"
                    )}

                </h4>

                <div class="rg31-storm-impact-city-list">

                    ${rows}

                </div>

            </div>

        `;

    },

    /* ======================================================
       SOURCE LABEL
       ====================================================== */

    getSourceLabel(
        sourceKey
    ) {

        const value =
            String(
                sourceKey ||
                ""
            )
                .trim();

        const labels = {

            radar: {

                en:
                    "Radar",

                ar:
                    "الرادار"

            },

            satellite: {

                en:
                    "Satellite",

                ar:
                    "الأقمار الصناعية"

            },

            lightning: {

                en:
                    "Lightning",

                ar:
                    "رصد البرق"

            },

            official: {

                en:
                    "Official source",

                ar:
                    "المصدر الرسمي"

            },

            openMeteo: {

                en:
                    "Open-Meteo",

                ar:
                    "Open-Meteo"

            },

            localModel: {

                en:
                    "RainGuard Local AI",

                ar:
                    "ذكاء RainGuard المحلي"

            }

        };

        const item =
            labels[
                value
            ];

        if (
            !item
        ) {

            return value;

        }

        return this.isArabic()
            ? item.ar
            : item.en;

    },

    /* ======================================================
       RISK LABEL
       ====================================================== */

    getRiskLabel(
        riskLevel
    ) {

        const value =
            this.normalizeStatus(
                riskLevel
            );

        const labels = {

            SEVERE: {

                en:
                    "Severe",

                ar:
                    "شديد"

            },

            HIGH: {

                en:
                    "High",

                ar:
                    "مرتفع"

            },

            MODERATE: {

                en:
                    "Moderate",

                ar:
                    "متوسط"

            },

            LOW: {

                en:
                    "Low",

                ar:
                    "منخفض"

            },

            MINIMAL: {

                en:
                    "Minimal",

                ar:
                    "محدود"

            },

            UNKNOWN: {

                en:
                    "Unknown",

                ar:
                    "غير معروف"

            }

        };

        const item =
            labels[
                value
            ] ||
            labels.UNKNOWN;

        return this.isArabic()
            ? item.ar
            : item.en;

    },
      /* ======================================================
       RENDER PREDICTED STORM PATH
       ====================================================== */

    renderPredictedStormPath(
        prediction = {},
        cell = null
    ) {

        if (
            this.config
                .display
                .showForecastPaths !==
                true
        ) {

            return null;

        }

        if (
            !this.forecastPathLayer ||
            !this.forecastPointLayer ||
            typeof window.L ===
                "undefined"
        ) {

            return null;

        }

        const forecasts =
            Array.isArray(
                prediction.forecasts
            )
                ? prediction.forecasts
                : [];

        if (
            !forecasts.length
        ) {

            return null;

        }

        const currentLat =
            this.firstNullableNumber(

                prediction
                    ?.currentPosition
                    ?.lat,

                cell
                    ?.currentLat,

                cell
                    ?.lat

            );

        const currentLon =
            this.firstNullableNumber(

                prediction
                    ?.currentPosition
                    ?.lon,

                cell
                    ?.currentLon,

                cell
                    ?.lon,

                cell
                    ?.lng

            );

        if (
            currentLat === null ||
            currentLon === null
        ) {

            return null;

        }

        const validForecasts =
            forecasts
                .filter(
                    point => {

                        return (

                            this.firstNullableNumber(
                                point.lat
                            ) !==
                                null &&

                            this.firstNullableNumber(
                                point.lon,
                                point.lng
                            ) !==
                                null

                        );

                    }
                )
                .sort(
                    (
                        first,
                        second
                    ) =>

                        this.safeNumber(
                            first.minutes,
                            0
                        ) -

                        this.safeNumber(
                            second.minutes,
                            0
                        )
                );

        if (
            !validForecasts.length
        ) {

            return null;

        }

        const pathPoints =
            [

                {
                    lat:
                        currentLat,

                    lon:
                        currentLon,

                    minutes:
                        0,

                    riskScore:
                        this.safeNumber(
                            prediction.currentRisk,
                            cell?.riskScore
                        ),

                    confidence:
                        this.safeNumber(
                            prediction.currentConfidence,
                            cell?.confidence
                        ),

                    current:
                        true
                },

                ...validForecasts.map(
                    point => ({

                        lat:
                            this.safeNumber(
                                point.lat,
                                0
                            ),

                        lon:
                            this.safeNumber(
                                point.lon ??
                                point.lng,
                                0
                            ),

                        minutes:
                            this.safeNumber(
                                point.minutes,
                                0
                            ),

                        riskScore:
                            this.safeNumber(
                                point.riskScore,
                                0
                            ),

                        confidence:
                            this.safeNumber(
                                point.confidence,
                                0
                            ),

                        intensity:
                            this.safeNumber(
                                point.intensity,
                                0
                            ),

                        nearestCity:
                            point.nearestCity ||
                            null,

                        nearestCityDistanceKm:
                            point
                                .nearestCityDistanceKm ??
                            null,

                        current:
                            false

                    })
                )

            ];

        const pathLine =
            this.renderForecastPathLine({

                prediction,

                cell,

                pathPoints

            });

        const pointMarkers =
            [];

        if (
            this.config
                .display
                .showForecastPoints ===
                true
        ) {

            validForecasts.forEach(
                point => {

                    const marker =
                        this.renderForecastPoint({

                            prediction,

                            cell,

                            point

                        });

                    if (
                        marker
                    ) {

                        pointMarkers.push(
                            marker
                        );

                    }

                }
            );

        }

        const renderedPath = {

            cellId:
                prediction.cellId,

            city:
                prediction.city ||
                cell?.city ||
                "Unknown",

            points:
                pathPoints,

            forecastPointCount:
                pointMarkers.length,

            pathLineCreated:
                Boolean(
                    pathLine
                ),

            pathConfidence:
                Math.round(
                    this.clamp(
                        prediction.pathConfidence,
                        0,
                        100
                    )
                ),

            highestPredictedRisk:
                Math.round(
                    this.clamp(
                        prediction.highestPredictedRisk,
                        0,
                        100
                    )
                ),

            timestamp:
                this.lastRenderAt

        };

        this.renderedPaths[
            prediction.cellId
        ] =
            renderedPath;

        return renderedPath;

    },

    /* ======================================================
       RENDER FORECAST PATH LINE
       ====================================================== */

    renderForecastPathLine({

        prediction = {},

        cell = null,

        pathPoints = []

    } = {}) {

        if (
            !this.forecastPathLayer ||
            typeof window.L ===
                "undefined"
        ) {

            return null;

        }

        if (
            !Array.isArray(
                pathPoints
            ) ||
            pathPoints.length <
                2
        ) {

            return null;

        }

        const coordinates =
            pathPoints
                .map(
                    point => {

                        const lat =
                            this.firstNullableNumber(
                                point.lat
                            );

                        const lon =
                            this.firstNullableNumber(
                                point.lon,
                                point.lng
                            );

                        if (
                            lat === null ||
                            lon === null
                        ) {

                            return null;

                        }

                        return [
                            lat,
                            lon
                        ];

                    }
                )
                .filter(
                    Boolean
                );

        if (
            coordinates.length <
            2
        ) {

            return null;

        }

        const highestRisk =
            this.safeNumber(

                prediction
                    .highestPredictedRisk,

                cell
                    ?.riskScore

            );

        const riskLevel =
            this.getRiskLevel(
                highestRisk
            );

        const color =
            this.getRiskColor(
                riskLevel
            );

        const path =
            window.L
                .polyline(

                    coordinates,

                    {

                        color,

                        weight:
                            this.config
                                .forecastPath
                                .weight,

                        opacity:
                            this.config
                                .forecastPath
                                .opacity,

                        dashArray:
                            this.config
                                .forecastPath
                                .dashArray,

                        lineCap:
                            "round",

                        lineJoin:
                            "round",

                        interactive:
                            true,

                        className:

                            this.config
                                .forecastPath
                                .animated ===
                                true

                                ? "rg31-storm-forecast-path rg31-storm-forecast-path-animated"

                                : "rg31-storm-forecast-path"

                    }

                )
                .addTo(
                    this.forecastPathLayer
                );

        const popup =
            this.buildForecastPathPopup(
                prediction,
                cell
            );

        path.bindPopup(

            popup,

            {

                maxWidth:
                    340,

                minWidth:
                    250,

                className:
                    "rg31-storm-path-popup"

            }

        );

        if (
            this.config
                .forecastPath
                .animated ===
                true
        ) {

            const element =
                path.getElement?.();

            if (
                element
            ) {

                element.style
                    .setProperty(

                        "--rg31-path-speed",

                        `${this.config
                            .forecastPath
                            .animationSpeed}s`

                    );

            }

        }

        return path;

    },

    /* ======================================================
       RENDER FORECAST POINT
       ====================================================== */

    renderForecastPoint({

        prediction = {},

        cell = null,

        point = {}

    } = {}) {

        if (
            !this.forecastPointLayer ||
            typeof window.L ===
                "undefined"
        ) {

            return null;

        }

        const lat =
            this.firstNullableNumber(
                point.lat
            );

        const lon =
            this.firstNullableNumber(
                point.lon,
                point.lng
            );

        if (
            lat === null ||
            lon === null
        ) {

            return null;

        }

        const minutes =
            this.safeNumber(
                point.minutes,
                0
            );

        const riskScore =
            this.clamp(
                point.riskScore,
                0,
                100
            );

        const riskLevel =
            this.getRiskLevel(
                riskScore
            );

        const color =
            this.getRiskColor(
                riskLevel
            );

        const radius =
            this.safeNumber(

                this.config
                    .forecastPoints
                    .radius[
                        minutes
                    ],

                8
            );

        const opacity =
            this.safeNumber(

                this.config
                    .forecastPoints
                    .opacity[
                        minutes
                    ],

                0.75
            );

        const label =
            this.config
                .forecastPoints
                .labels[
                    minutes
                ] ||
            `${minutes}m`;

        const icon =
            this.createForecastPointIcon({

                point,

                color,

                radius,

                opacity,

                label

            });

        const marker =
            window.L
                .marker(

                    [
                        lat,
                        lon
                    ],

                    {

                        icon,

                        riseOnHover:
                            true,

                        riseOffset:
                            450,

                        keyboard:
                            false,

                        title:
                            `${label} — ${Math.round(
                                riskScore
                            )}%`

                    }

                )
                .addTo(
                    this.forecastPointLayer
                );

        marker.bindPopup(

            this.buildForecastPointPopup({

                prediction,

                cell,

                point

            }),

            {

                maxWidth:
                    320,

                minWidth:
                    230,

                className:
                    "rg31-storm-forecast-point-popup"

            }

        );

        marker.bindTooltip(

            `

                <div class="rg31-forecast-tooltip">

                    <b>
                        ${label}
                    </b>

                    <br>

                    ${this.text(
                        "Risk",
                        "الخطر"
                    )}:
                    ${Math.round(
                        riskScore
                    )}%

                    <br>

                    ${this.text(
                        "Confidence",
                        "الثقة"
                    )}:
                    ${Math.round(
                        this.clamp(
                            point.confidence,
                            0,
                            100
                        )
                    )}%

                </div>

            `,

            {

                direction:
                    "top",

                offset:
                    [
                        0,
                        -radius
                    ],

                opacity:
                    0.96,

                className:
                    "rg31-storm-tooltip"

            }

        );

        return marker;

    },

    /* ======================================================
       CREATE FORECAST POINT ICON
       ====================================================== */

    createForecastPointIcon({

        point = {},

        color,

        radius,

        opacity,

        label

    } = {}) {

        const safeRadius =
            Math.max(
                6,
                Math.round(
                    radius
                )
            );

        const diameter =
            safeRadius *
            2;

        const risk =
            Math.round(
                this.clamp(
                    point.riskScore,
                    0,
                    100
                )
            );

        const confidence =
            Math.round(
                this.clamp(
                    point.confidence,
                    0,
                    100
                )
            );

        const html = `

            <div
                class="rg31-forecast-point"
                style="
                    --rg31-point-color:${this.escapeHtml(
                        color
                    )};
                    --rg31-point-size:${diameter}px;
                    --rg31-point-opacity:${opacity};
                "
                data-minutes="${this.safeNumber(
                    point.minutes,
                    0
                )}"
                data-risk="${risk}"
                data-confidence="${confidence}"
            >

                <span class="rg31-forecast-point-core">

                    ${this.escapeHtml(
                        label
                    )}

                </span>

                <span class="rg31-forecast-point-ring"></span>

            </div>

        `;

        return window.L.divIcon({

            html,

            className:
                "rg31-forecast-point-div-icon",

            iconSize:
                [
                    diameter,
                    diameter
                ],

            iconAnchor:
                [
                    safeRadius,
                    safeRadius
                ],

            popupAnchor:
                [
                    0,
                    -safeRadius
                ],

            tooltipAnchor:
                [
                    0,
                    -safeRadius
                ]

        });

    },

    /* ======================================================
       FORECAST PATH POPUP
       ====================================================== */

    buildForecastPathPopup(
        prediction = {},
        cell = null
    ) {

        const city =
            this.escapeHtml(

                prediction.city ||

                cell?.city ||

                this.text(
                    "Unknown",
                    "غير معروف"
                )

            );

        const speed =
            Number(
                this.safeNumber(
                    prediction.speedKmh,
                    cell?.speedKmh
                )
            )
            .toFixed(
                1
            );

        const direction =
            this.getDirectionLabelLocalized(

                prediction
                    .directionLabel ||

                cell
                    ?.directionLabel ||

                "UNKNOWN"

            );

        const confidence =
            Math.round(
                this.clamp(
                    prediction.pathConfidence,
                    0,
                    100
                )
            );

        const highestRisk =
            Math.round(
                this.clamp(
                    prediction.highestPredictedRisk,
                    0,
                    100
                )
            );

        return `

            <div class="rg31-storm-path-popup-content">

                <h3>

                    ${this.text(
                        "Predicted Storm Path",
                        "مسار العاصفة المتوقع"
                    )}

                </h3>

                <b>

                    ${this.text(
                        "Cell",
                        "الخلية"
                    )}:

                </b>

                ${this.escapeHtml(
                    prediction.cellId ||
                    cell?.cellId ||
                    "--"
                )}

                <br>

                <b>

                    ${this.text(
                        "Current City",
                        "المدينة الحالية"
                    )}:

                </b>

                ${city}

                <br>

                <b>

                    ${this.text(
                        "Speed",
                        "السرعة"
                    )}:

                </b>

                ${speed} km/h

                <br>

                <b>

                    ${this.text(
                        "Direction",
                        "الاتجاه"
                    )}:

                </b>

                ${direction}

                <br>

                <b>

                    ${this.text(
                        "Path Confidence",
                        "ثقة المسار"
                    )}:

                </b>

                ${confidence}%

                <br>

                <b>

                    ${this.text(
                        "Highest Predicted Risk",
                        "أعلى خطر متوقع"
                    )}:

                </b>

                ${highestRisk}%

                <br>

                <b>

                    ${this.text(
                        "Forecast Window",
                        "نافذة التنبؤ"
                    )}:

                </b>

                30–120
                ${this.text(
                    " min",
                    " دقيقة"
                )}

            </div>

        `;

    },

    /* ======================================================
       FORECAST POINT POPUP
       ====================================================== */

    buildForecastPointPopup({

        prediction = {},

        cell = null,

        point = {}

    } = {}) {

        const minutes =
            this.safeNumber(
                point.minutes,
                0
            );

        const city =
            this.escapeHtml(

                point.nearestCity ||

                prediction.city ||

                cell?.city ||

                "--"

            );

        const risk =
            Math.round(
                this.clamp(
                    point.riskScore,
                    0,
                    100
                )
            );

        const intensity =
            Math.round(
                this.clamp(
                    point.intensity,
                    0,
                    100
                )
            );

        const confidence =
            Math.round(
                this.clamp(
                    point.confidence,
                    0,
                    100
                )
            );

        const distance =
            point.nearestCityDistanceKm !==
                null &&
            point.nearestCityDistanceKm !==
                undefined

                ? `${Number(
                    point.nearestCityDistanceKm
                )
                .toFixed(
                    1
                )} km`

                : "--";

        return `

            <div class="rg31-storm-forecast-popup-content">

                <h3>

                    ${this.text(
                        "Forecast Point",
                        "نقطة التنبؤ"
                    )}

                    — ${minutes}
                    ${this.text(
                        " min",
                        " دقيقة"
                    )}

                </h3>

                <b>

                    ${this.text(
                        "Nearest City",
                        "أقرب مدينة"
                    )}:

                </b>

                ${city}

                <br>

                <b>

                    ${this.text(
                        "Distance",
                        "المسافة"
                    )}:

                </b>

                ${distance}

                <br>

                <b>

                    ${this.text(
                        "Expected Risk",
                        "الخطر المتوقع"
                    )}:

                </b>

                ${risk}%

                <br>

                <b>

                    ${this.text(
                        "Expected Intensity",
                        "الشدة المتوقعة"
                    )}:

                </b>

                ${intensity}%

                <br>

                <b>

                    ${this.text(
                        "Prediction Confidence",
                        "ثقة التنبؤ"
                    )}:

                </b>

                ${confidence}%

                <br>

                <b>

                    ${this.text(
                        "Expected Position",
                        "الموقع المتوقع"
                    )}:

                </b>

                ${this.safeNumber(
                    point.lat,
                    0
                ).toFixed(4)},
                ${this.safeNumber(
                    point.lon,
                    0
                ).toFixed(4)}

            </div>

        `;

    },
      /* ======================================================
       RENDER IMPACTED CITIES
       ====================================================== */

    renderImpactedCities(
        prediction = {},
        cell = null
    ) {

        if (
            this.config
                .display
                .showImpactedCities !==
                true
        ) {

            return [];

        }

        if (
            !this.impactedCityLayer ||
            typeof window.L ===
                "undefined"
        ) {

            return [];

        }

        const impactedCities =
            Array.isArray(
                prediction.impactedCities
            )
                ? prediction.impactedCities
                : [];

        if (
            !impactedCities.length
        ) {

            return [];

        }

        const renderedCities =
            [];

        impactedCities.forEach(
            cityImpact => {

                const cityData =
                    this.resolveImpactedCityCoordinates(
                        cityImpact
                    );

                if (
                    !cityData
                ) {

                    return;

                }

                const minimumDistanceKm =
                    this.safeNumber(
                        cityImpact.minimumDistanceKm,
                        999
                    );

                const maximumRisk =
                    this.clamp(
                        cityImpact.maximumRisk,
                        0,
                        100
                    );

                if (
                    minimumDistanceKm >
                    this.config
                        .impactedCities
                        .maximumDistanceKm
                ) {

                    return;

                }

                if (
                    maximumRisk <
                    this.config
                        .impactedCities
                        .minimumRisk
                ) {

                    return;

                }

                const impactLevel =
                    this.normalizeStatus(

                        cityImpact.impactLevel ||
                        "MONITORING"

                    );

                const riskLevel =
                    this.getRiskLevel(
                        maximumRisk
                    );

                const color =
                    this.getRiskColor(
                        riskLevel
                    );

                const circle =
                    this.renderImpactedCityCircle({

                        cityImpact,

                        cityData,

                        color,

                        impactLevel

                    });

                const marker =
                    this.renderImpactedCityMarker({

                        prediction,

                        cell,

                        cityImpact,

                        cityData,

                        color,

                        impactLevel

                    });

                const renderedCity = {

                    cellId:
                        prediction.cellId ||
                        cell?.cellId ||
                        null,

                    city:
                        cityImpact.city ||
                        cityData.city ||
                        "Unknown",

                    lat:
                        cityData.lat,

                    lon:
                        cityData.lon,

                    firstImpactMinutes:
                        this.safeNumber(
                            cityImpact.firstImpactMinutes,
                            0
                        ),

                    minimumDistanceKm:
                        Number(
                            minimumDistanceKm
                                .toFixed(
                                    2
                                )
                        ),

                    maximumRisk:
                        Math.round(
                            maximumRisk
                        ),

                    maximumIntensity:
                        Math.round(
                            this.clamp(
                                cityImpact.maximumIntensity,
                                0,
                                100
                            )
                        ),

                    maximumConfidence:
                        Math.round(
                            this.clamp(
                                cityImpact.maximumConfidence,
                                0,
                                100
                            )
                        ),

                    impactLevel,

                    riskLevel,

                    color,

                    circleCreated:
                        Boolean(
                            circle
                        ),

                    markerCreated:
                        Boolean(
                            marker
                        )

                };

                renderedCities.push(
                    renderedCity
                );

            }
        );

        return renderedCities;

    },

    /* ======================================================
       RESOLVE IMPACTED CITY COORDINATES
       ====================================================== */

    resolveImpactedCityCoordinates(
        cityImpact = {}
    ) {

        const directLat =
            this.firstNullableNumber(

                cityImpact.lat,

                cityImpact.latitude,

                cityImpact.coordinates
                    ?.lat

            );

        const directLon =
            this.firstNullableNumber(

                cityImpact.lon,

                cityImpact.lng,

                cityImpact.longitude,

                cityImpact.coordinates
                    ?.lon,

                cityImpact.coordinates
                    ?.lng

            );

        if (
            directLat !== null &&
            directLon !== null
        ) {

            return {

                city:
                    cityImpact.city ||
                    "Unknown",

                cityAr:
                    cityImpact.cityAr ||
                    "",

                lat:
                    directLat,

                lon:
                    directLon

            };

        }

        const cityName =
            String(
                cityImpact.city ||
                ""
            )
                .trim()
                .toLowerCase();

        if (
            !cityName
        ) {

            return null;

        }

        const knownCities =
            this.getKnownCities();

        return knownCities.find(
            city => {

                const englishName =
                    String(
                        city.city ||
                        ""
                    )
                        .trim()
                        .toLowerCase();

                const arabicName =
                    String(
                        city.cityAr ||
                        ""
                    )
                        .trim()
                        .toLowerCase();

                return (

                    cityName ===
                        englishName ||

                    cityName ===
                        arabicName

                );

            }
        ) || null;

    },

    /* ======================================================
       RENDER IMPACTED CITY CIRCLE
       ====================================================== */

    renderImpactedCityCircle({

        cityImpact = {},

        cityData = {},

        color,

        impactLevel

    } = {}) {

        if (
            !this.impactedCityLayer ||
            typeof window.L ===
                "undefined"
        ) {

            return null;

        }

        const lat =
            this.firstNullableNumber(
                cityData.lat
            );

        const lon =
            this.firstNullableNumber(
                cityData.lon
            );

        if (
            lat === null ||
            lon === null
        ) {

            return null;

        }

        const radiusMeters =
            this.safeNumber(

                this.config
                    .impactedCities
                    .circleRadiusMeters[
                        impactLevel
                    ],

                this.config
                    .impactedCities
                    .circleRadiusMeters
                    .MONITORING

            );

        const maximumRisk =
            this.clamp(
                cityImpact.maximumRisk,
                0,
                100
            );

        const fillOpacity =
            this.clamp(

                this.config
                    .impactedCities
                    .fillOpacity +

                maximumRisk /
                1000,

                0.10,

                0.35

            );

        return window.L
            .circle(

                [
                    lat,
                    lon
                ],

                {

                    radius:
                        radiusMeters,

                    color,

                    weight:
                        this.config
                            .impactedCities
                            .borderWeight,

                    opacity:
                        this.config
                            .impactedCities
                            .borderOpacity,

                    fillColor:
                        color,

                    fillOpacity,

                    interactive:
                        false,

                    className:
                        `rg31-impacted-city-circle rg31-impact-${impactLevel.toLowerCase()}`

                }

            )
            .addTo(
                this.impactedCityLayer
            );

    },

    /* ======================================================
       RENDER IMPACTED CITY MARKER
       ====================================================== */

    renderImpactedCityMarker({

        prediction = {},

        cell = null,

        cityImpact = {},

        cityData = {},

        color,

        impactLevel

    } = {}) {

        if (
            !this.impactedCityLayer ||
            typeof window.L ===
                "undefined"
        ) {

            return null;

        }

        const lat =
            this.firstNullableNumber(
                cityData.lat
            );

        const lon =
            this.firstNullableNumber(
                cityData.lon
            );

        if (
            lat === null ||
            lon === null
        ) {

            return null;

        }

        const icon =
            this.createImpactedCityIcon({

                cityImpact,

                color,

                impactLevel

            });

        const marker =
            window.L
                .marker(

                    [
                        lat,
                        lon
                    ],

                    {

                        icon,

                        keyboard:
                            false,

                        riseOnHover:
                            true,

                        riseOffset:
                            350,

                        title:
                            this.buildImpactedCityTitle(
                                cityImpact
                            )

                    }

                )
                .addTo(
                    this.impactedCityLayer
                );

        marker.bindPopup(

            this.buildImpactedCityPopup({

                prediction,

                cell,

                cityImpact,

                cityData,

                color,

                impactLevel

            }),

            {

                maxWidth:
                    330,

                minWidth:
                    240,

                className:
                    "rg31-impacted-city-popup"

            }

        );

        marker.bindTooltip(

            this.buildImpactedCityTooltip(
                cityImpact
            ),

            {

                direction:
                    "top",

                offset:
                    [
                        0,
                        -12
                    ],

                opacity:
                    0.96,

                className:
                    "rg31-storm-tooltip"

            }

        );

        marker.on(

            "click",

            () => {

                window.dispatchEvent(

                    new CustomEvent(

                        "rg31:impacted-city-selected",

                        {

                            detail: {

                                cellId:
                                    prediction.cellId ||
                                    cell?.cellId ||
                                    null,

                                cityImpact,

                                cityData,

                                timestamp:
                                    new Date()
                                        .toISOString()

                            }

                        }

                    )

                );

            }

        );

        return marker;

    },

    /* ======================================================
       CREATE IMPACTED CITY ICON
       ====================================================== */

    createImpactedCityIcon({

        cityImpact = {},

        color,

        impactLevel

    } = {}) {

        const cityName =
            this.escapeHtml(

                cityImpact.city ||

                this.text(
                    "Unknown",
                    "غير معروف"
                )

            );

        const arrivalMinutes =
            Math.round(
                this.safeNumber(
                    cityImpact.firstImpactMinutes,
                    0
                )
            );

        const risk =
            Math.round(
                this.clamp(
                    cityImpact.maximumRisk,
                    0,
                    100
                )
            );

        const impactSymbol =
            this.getImpactSymbol(
                impactLevel
            );

        const html = `

            <div
                class="rg31-impacted-city-marker"
                style="
                    --rg31-impact-color:${this.escapeHtml(
                        color
                    )};
                "
                data-impact-level="${this.escapeHtml(
                    impactLevel
                )}"
                data-risk="${risk}"
                data-arrival="${arrivalMinutes}"
            >

                <span class="rg31-impacted-city-symbol">

                    ${impactSymbol}

                </span>

                <span class="rg31-impacted-city-name">

                    ${cityName}

                </span>

                <span class="rg31-impacted-city-arrival">

                    ${arrivalMinutes}
                    ${this.text(
                        "m",
                        "د"
                    )}

                </span>

            </div>

        `;

        return window.L.divIcon({

            html,

            className:
                "rg31-impacted-city-div-icon",

            iconSize:
                [
                    110,
                    42
                ],

            iconAnchor:
                [
                    55,
                    21
                ],

            popupAnchor:
                [
                    0,
                    -20
                ],

            tooltipAnchor:
                [
                    0,
                    -20
                ]

        });

    },

    /* ======================================================
       IMPACT SYMBOL
       ====================================================== */

    getImpactSymbol(
        impactLevel
    ) {

        const value =
            this.normalizeStatus(
                impactLevel
            );

        const symbols = {

            DIRECT_HIGH_IMPACT:
                "⚠",

            LIKELY_IMPACT:
                "▲",

            POSSIBLE_IMPACT:
                "●",

            MONITORING:
                "○"

        };

        return symbols[
            value
        ] || "○";

    },

    /* ======================================================
       BUILD IMPACTED CITY TITLE
       ====================================================== */

    buildImpactedCityTitle(
        cityImpact = {}
    ) {

        const city =
            cityImpact.city ||
            this.text(
                "Unknown",
                "غير معروف"
            );

        const arrival =
            Math.round(
                this.safeNumber(
                    cityImpact.firstImpactMinutes,
                    0
                )
            );

        const risk =
            Math.round(
                this.clamp(
                    cityImpact.maximumRisk,
                    0,
                    100
                )
            );

        return `${city} — ${arrival} min — ${risk}%`;

    },

    /* ======================================================
       BUILD IMPACTED CITY TOOLTIP
       ====================================================== */

    buildImpactedCityTooltip(
        cityImpact = {}
    ) {

        const city =
            this.escapeHtml(

                cityImpact.city ||

                this.text(
                    "Unknown",
                    "غير معروف"
                )

            );

        const arrival =
            Math.round(
                this.safeNumber(
                    cityImpact.firstImpactMinutes,
                    0
                )
            );

        const risk =
            Math.round(
                this.clamp(
                    cityImpact.maximumRisk,
                    0,
                    100
                )
            );

        const distance =
            Number(
                this.safeNumber(
                    cityImpact.minimumDistanceKm,
                    0
                )
            )
            .toFixed(
                1
            );

        return `

            <div class="rg31-impacted-city-tooltip">

                <b>
                    ${city}
                </b>

                <br>

                ${this.text(
                    "Arrival",
                    "الوصول"
                )}:
                ${arrival}
                ${this.text(
                    " min",
                    " دقيقة"
                )}

                <br>

                ${this.text(
                    "Risk",
                    "الخطر"
                )}:
                ${risk}%

                <br>

                ${this.text(
                    "Distance",
                    "المسافة"
                )}:
                ${distance} km

            </div>

        `;

    },

    /* ======================================================
       BUILD IMPACTED CITY POPUP
       ====================================================== */

    buildImpactedCityPopup({

        prediction = {},

        cell = null,

        cityImpact = {},

        cityData = {},

        color,

        impactLevel

    } = {}) {

        const city =
            this.escapeHtml(

                cityImpact.city ||

                cityData.city ||

                "--"

            );

        const cityAr =
            this.escapeHtml(
                cityData.cityAr ||
                ""
            );

        const arrivalMinutes =
            Math.round(
                this.safeNumber(
                    cityImpact.firstImpactMinutes,
                    0
                )
            );

        const risk =
            Math.round(
                this.clamp(
                    cityImpact.maximumRisk,
                    0,
                    100
                )
            );

        const intensity =
            Math.round(
                this.clamp(
                    cityImpact.maximumIntensity,
                    0,
                    100
                )
            );

        const confidence =
            Math.round(
                this.clamp(
                    cityImpact.maximumConfidence,
                    0,
                    100
                )
            );

        const distanceKm =
            Number(
                this.safeNumber(
                    cityImpact.minimumDistanceKm,
                    0
                )
            )
            .toFixed(
                1
            );

        const riskLevel =
            this.getRiskLevel(
                risk
            );

        const forecastRows =
            this.buildImpactedCityForecastRows(
                cityImpact.forecastPoints
            );

        return `

            <div class="rg31-impacted-city-popup-content">

                <div class="rg31-impacted-city-popup-header">

                    <div>

                        <h3>
                            ${city}
                        </h3>

                        ${
                            cityAr &&
                            cityAr !== city
                                ? `
                                    <small>
                                        ${cityAr}
                                    </small>
                                `
                                : ""
                        }

                    </div>

                    <span
                        class="rg31-impact-badge"
                        style="
                            background:${this.escapeHtml(
                                color
                            )};
                        "
                    >

                        ${this.getImpactLevelLabel(
                            impactLevel
                        )}

                    </span>

                </div>

                <div class="rg31-impacted-city-popup-grid">

                    ${this.buildPopupMetric({

                        labelEn:
                            "Arrival",

                        labelAr:
                            "الوصول",

                        value:
                            `${arrivalMinutes} ${this.text(
                                "min",
                                "دقيقة"
                            )}`

                    })}

                    ${this.buildPopupMetric({

                        labelEn:
                            "Risk",

                        labelAr:
                            "الخطر",

                        value:
                            `${risk}%`

                    })}

                    ${this.buildPopupMetric({

                        labelEn:
                            "Intensity",

                        labelAr:
                            "الشدة",

                        value:
                            `${intensity}%`

                    })}

                    ${this.buildPopupMetric({

                        labelEn:
                            "Confidence",

                        labelAr:
                            "الثقة",

                        value:
                            `${confidence}%`

                    })}

                    ${this.buildPopupMetric({

                        labelEn:
                            "Distance",

                        labelAr:
                            "المسافة",

                        value:
                            `${distanceKm} km`

                    })}

                    ${this.buildPopupMetric({

                        labelEn:
                            "Risk Level",

                        labelAr:
                            "مستوى الخطر",

                        value:
                            this.getRiskLabel(
                                riskLevel
                            )

                    })}

                </div>

                <div class="rg31-impacted-city-source">

                    <b>

                        ${this.text(
                            "Source storm cell",
                            "الخلية الرعدية المصدر"
                        )}:

                    </b>

                    ${this.escapeHtml(

                        prediction.cellId ||

                        cell?.cellId ||

                        "--"

                    )}

                </div>

                ${
                    forecastRows
                        ? `

                            <div class="rg31-impacted-city-forecast-section">

                                <h4>

                                    ${this.text(
                                        "Forecast timeline",
                                        "الخط الزمني للتوقع"
                                    )}

                                </h4>

                                ${forecastRows}

                            </div>

                        `
                        : ""
                }

            </div>

        `;

    },

    /* ======================================================
       BUILD IMPACTED CITY FORECAST ROWS
       ====================================================== */

    buildImpactedCityForecastRows(
        forecastPoints = []
    ) {

        if (
            !Array.isArray(
                forecastPoints
            ) ||
            !forecastPoints.length
        ) {

            return "";

        }

        return forecastPoints
            .sort(
                (
                    first,
                    second
                ) =>

                    this.safeNumber(
                        first.minutes,
                        0
                    ) -

                    this.safeNumber(
                        second.minutes,
                        0
                    )
            )
            .map(
                point => {

                    const minutes =
                        Math.round(
                            this.safeNumber(
                                point.minutes,
                                0
                            )
                        );

                    const risk =
                        Math.round(
                            this.clamp(
                                point.riskScore,
                                0,
                                100
                            )
                        );

                    const intensity =
                        Math.round(
                            this.clamp(
                                point.intensity,
                                0,
                                100
                            )
                        );

                    const confidence =
                        Math.round(
                            this.clamp(
                                point.confidence,
                                0,
                                100
                            )
                        );

                    const distance =
                        Number(
                            this.safeNumber(
                                point.distanceKm,
                                0
                            )
                        )
                        .toFixed(
                            1
                        );

                    return `

                        <div class="rg31-impacted-city-forecast-row">

                            <b>

                                ${minutes}
                                ${this.text(
                                    " min",
                                    " دقيقة"
                                )}

                            </b>

                            <span>

                                ${this.text(
                                    "Risk",
                                    "خطر"
                                )}
                                ${risk}%

                            </span>

                            <span>

                                ${this.text(
                                    "Intensity",
                                    "شدة"
                                )}
                                ${intensity}%

                            </span>

                            <span>

                                ${this.text(
                                    "Confidence",
                                    "ثقة"
                                )}
                                ${confidence}%

                            </span>

                            <span>
                                ${distance} km
                            </span>

                        </div>

                    `;

                }
            )
            .join("");

    },
      /* ======================================================
       START ANIMATION LOOP
       ====================================================== */

    startAnimationLoop() {

        if (
            this.config
                .animation
                .enabled !==
                true
        ) {

            return false;

        }

        if (
            this.animationFrameId
        ) {

            return true;

        }

        this.animationStartedAt =
            performance.now();

        const animate =
            timestamp => {

                if (
                    this.config
                        .animation
                        .enabled !==
                        true
                ) {

                    this.animationFrameId =
                        null;

                    return;

                }

                this.animateForecastPaths(
                    timestamp
                );

                this.animationFrameId =
                    window.requestAnimationFrame(
                        animate
                    );

            };

        this.animationFrameId =
            window.requestAnimationFrame(
                animate
            );

        return true;

    },

    /* ======================================================
       ANIMATE FORECAST PATHS
       ====================================================== */

    animateForecastPaths(
        timestamp
    ) {

        if (
            !this.animationLayer ||
            typeof window.L ===
                "undefined"
        ) {

            return;

        }

        const durationMs =
            Math.max(

                1000,

                this.safeNumber(
                    this.config
                        .animation
                        .durationMs,
                    6000
                )

            );

        const startedAt =
            this.safeNumber(
                this.animationStartedAt,
                timestamp
            );

        const elapsed =
            Math.max(
                0,
                timestamp -
                startedAt
            );

        const rawProgress =
            (
                elapsed %
                durationMs
            ) /
            durationMs;

        const maximumProgress =
            this.clamp(

                this.config
                    .animation
                    .pathProgressMaximum,

                0,

                1

            );

        const progress =
            rawProgress *
            maximumProgress;

        Object.values(
            this.renderedPaths
        )
        .forEach(
            renderedPath => {

                if (
                    !renderedPath ||
                    !Array.isArray(
                        renderedPath.points
                    ) ||
                    renderedPath.points.length <
                        2
                ) {

                    return;

                }

                this.animateStormMarker(

                    renderedPath,

                    progress

                );

            }
        );

    },

    /* ======================================================
       ANIMATE STORM MARKER
       ====================================================== */

    animateStormMarker(
        renderedPath = {},
        progress = 0
    ) {

        if (
            !this.animationLayer ||
            typeof window.L ===
                "undefined"
        ) {

            return null;

        }

        const points =
            Array.isArray(
                renderedPath.points
            )
                ? renderedPath.points
                : [];

        if (
            points.length <
            2
        ) {

            return null;

        }

        const pathPosition =
            this.interpolatePathPosition(

                points,

                this.clamp(
                    progress,
                    0,
                    1
                )

            );

        if (
            !pathPosition
        ) {

            return null;

        }

        const cellId =
            renderedPath.cellId;

        const animationKey =
            `animation-${cellId}`;

        let animationMarker =
            this.renderedPaths[
                cellId
            ]
            ?.animationMarker ||
            null;

        const riskScore =
            this.safeNumber(
                pathPosition.riskScore,
                renderedPath
                    .highestPredictedRisk
            );

        const riskLevel =
            this.getRiskLevel(
                riskScore
            );

        const color =
            this.getRiskColor(
                riskLevel
            );

        if (
            !animationMarker
        ) {

            const icon =
                this.createAnimatedStormIcon({

                    color,

                    cellId,

                    riskScore

                });

            animationMarker =
                window.L
                    .marker(

                        [
                            pathPosition.lat,
                            pathPosition.lon
                        ],

                        {

                            icon,

                            interactive:
                                false,

                            keyboard:
                                false,

                            pane:
                                "markerPane",

                            zIndexOffset:
                                1000

                        }

                    )
                    .addTo(
                        this.animationLayer
                    );

            this.renderedPaths[
                cellId
            ].animationMarker =
                animationMarker;

        } else {

            animationMarker.setLatLng(

                [
                    pathPosition.lat,
                    pathPosition.lon
                ]

            );

            const element =
                animationMarker.getElement?.();

            if (
                element
            ) {

                element.style.setProperty(
                    "--rg31-animation-color",
                    color
                );

                element.dataset.risk =
                    Math.round(
                        riskScore
                    );

            }

        }

        this.renderedPaths[
            cellId
        ][animationKey] = {

            lat:
                pathPosition.lat,

            lon:
                pathPosition.lon,

            progress,

            riskScore:
                Math.round(
                    riskScore
                ),

            timestamp:
                new Date()
                    .toISOString()

        };

        return animationMarker;

    },

    /* ======================================================
       CREATE ANIMATED STORM ICON
       ====================================================== */

    createAnimatedStormIcon({

        color,

        cellId,

        riskScore = 0

    } = {}) {

        const radius =
            Math.max(

                3,

                this.safeNumber(
                    this.config
                        .animation
                        .markerRadius,
                    5
                )

            );

        const diameter =
            radius *
            2;

        const html = `

            <div
                class="rg31-storm-animation-marker"
                style="
                    --rg31-animation-color:${this.escapeHtml(
                        color
                    )};
                    --rg31-animation-size:${diameter}px;
                "
                data-cell-id="${this.escapeHtml(
                    cellId ||
                    ""
                )}"
                data-risk="${Math.round(
                    this.safeNumber(
                        riskScore,
                        0
                    )
                )}"
            >

                <span class="rg31-storm-animation-core"></span>

                <span class="rg31-storm-animation-glow"></span>

            </div>

        `;

        return window.L.divIcon({

            html,

            className:
                "rg31-storm-animation-div-icon",

            iconSize:
                [
                    diameter,
                    diameter
                ],

            iconAnchor:
                [
                    radius,
                    radius
                ]

        });

    },

    /* ======================================================
       INTERPOLATE PATH POSITION
       ====================================================== */

    interpolatePathPosition(
        points = [],
        progress = 0
    ) {

        if (
            !Array.isArray(
                points
            ) ||
            points.length <
                2
        ) {

            return null;

        }

        const validPoints =
            points
                .map(
                    point => {

                        const lat =
                            this.firstNullableNumber(
                                point.lat
                            );

                        const lon =
                            this.firstNullableNumber(
                                point.lon,
                                point.lng
                            );

                        if (
                            lat === null ||
                            lon === null
                        ) {

                            return null;

                        }

                        return {

                            ...point,

                            lat,

                            lon

                        };

                    }
                )
                .filter(
                    Boolean
                );

        if (
            validPoints.length <
            2
        ) {

            return null;

        }

        const distances =
            [];

        let totalDistance =
            0;

        for (
            let index = 0;
            index <
                validPoints.length -
                1;
            index += 1
        ) {

            const first =
                validPoints[
                    index
                ];

            const second =
                validPoints[
                    index +
                    1
                ];

            const distance =
                this.calculateDistanceKm(

                    first.lat,

                    first.lon,

                    second.lat,

                    second.lon

                );

            distances.push(
                distance
            );

            totalDistance +=
                distance;

        }

        if (
            totalDistance <= 0
        ) {

            return {

                ...validPoints[0]

            };

        }

        const targetDistance =
            this.clamp(
                progress,
                0,
                1
            ) *
            totalDistance;

        let accumulatedDistance =
            0;

        for (
            let index = 0;
            index <
                distances.length;
            index += 1
        ) {

            const segmentDistance =
                distances[
                    index
                ];

            const nextAccumulated =
                accumulatedDistance +
                segmentDistance;

            if (
                targetDistance <=
                nextAccumulated
            ) {

                const first =
                    validPoints[
                        index
                    ];

                const second =
                    validPoints[
                        index +
                        1
                    ];

                const localProgress =
                    segmentDistance <= 0
                        ? 0
                        : (
                            targetDistance -
                            accumulatedDistance
                        ) /
                        segmentDistance;

                return this.interpolateBetweenPoints(

                    first,

                    second,

                    localProgress

                );

            }

            accumulatedDistance =
                nextAccumulated;

        }

        return {

            ...validPoints[
                validPoints.length -
                1
            ]

        };

    },

    /* ======================================================
       INTERPOLATE BETWEEN TWO POINTS
       ====================================================== */

    interpolateBetweenPoints(
        first = {},
        second = {},
        progress = 0
    ) {

        const normalizedProgress =
            this.clamp(
                progress,
                0,
                1
            );

        const interpolate =
            (
                startValue,
                endValue,
                fallback = 0
            ) => {

                const start =
                    this.safeNumber(
                        startValue,
                        fallback
                    );

                const end =
                    this.safeNumber(
                        endValue,
                        start
                    );

                return start +
                    (
                        end -
                        start
                    ) *
                    normalizedProgress;

            };

        return {

            lat:
                interpolate(
                    first.lat,
                    second.lat
                ),

            lon:
                interpolate(
                    first.lon,
                    second.lon
                ),

            riskScore:
                interpolate(
                    first.riskScore,
                    second.riskScore
                ),

            confidence:
                interpolate(
                    first.confidence,
                    second.confidence
                ),

            intensity:
                interpolate(
                    first.intensity,
                    second.intensity
                ),

            minutes:
                interpolate(
                    first.minutes,
                    second.minutes
                ),

            progress:
                normalizedProgress

        };

    },

    /* ======================================================
       STOP ANIMATION LOOP
       ====================================================== */

    stopAnimationLoop() {

        if (
            this.animationFrameId
        ) {

            window.cancelAnimationFrame(
                this.animationFrameId
            );

        }

        this.animationFrameId =
            null;

        this.animationStartedAt =
            null;

        if (
            this.animationLayer &&
            typeof this.animationLayer
                .clearLayers ===
                "function"
        ) {

            this.animationLayer
                .clearLayers();

        }

        Object.values(
            this.renderedPaths
        )
        .forEach(
            renderedPath => {

                if (
                    renderedPath
                ) {

                    renderedPath.animationMarker =
                        null;

                }

            }
        );

        return true;

    },

    /* ======================================================
       RESTART ANIMATION LOOP
       ====================================================== */

    restartAnimationLoop() {

        this.stopAnimationLoop();

        if (
            this.config
                .animation
                .enabled ===
                true
        ) {

            return this.startAnimationLoop();

        }

        return false;

    },

    /* ======================================================
       SET ANIMATION ENABLED
       ====================================================== */

    setAnimationEnabled(
        enabled
    ) {

        this.config
            .animation
            .enabled =
            enabled ===
            true;

        if (
            this.config
                .animation
                .enabled
        ) {

            this.restartAnimationLoop();

        } else {

            this.stopAnimationLoop();

        }

        this.saveState();

        return this.config
            .animation
            .enabled;

    },

    /* ======================================================
       SET ANIMATION DURATION
       ====================================================== */

    setAnimationDuration(
        durationMs
    ) {

        const value =
            Math.max(

                1000,

                this.safeNumber(
                    durationMs,
                    this.config
                        .animation
                        .durationMs
                )

            );

        this.config
            .animation
            .durationMs =
            value;

        this.restartAnimationLoop();

        this.saveState();

        return value;

    },
      /* ======================================================
       DISTANCE CALCULATION - HAVERSINE
       ====================================================== */

    calculateDistanceKm(
        lat1,
        lon1,
        lat2,
        lon2
    ) {

        const firstLat =
            this.firstNullableNumber(
                lat1
            );

        const firstLon =
            this.firstNullableNumber(
                lon1
            );

        const secondLat =
            this.firstNullableNumber(
                lat2
            );

        const secondLon =
            this.firstNullableNumber(
                lon2
            );

        if (
            firstLat === null ||
            firstLon === null ||
            secondLat === null ||
            secondLon === null
        ) {

            return 0;

        }

        const earthRadiusKm =
            6371;

        const toRadians =
            degrees =>
                degrees *
                Math.PI /
                180;

        const latitudeDifference =
            toRadians(
                secondLat -
                firstLat
            );

        const longitudeDifference =
            toRadians(
                secondLon -
                firstLon
            );

        const firstLatitudeRadians =
            toRadians(
                firstLat
            );

        const secondLatitudeRadians =
            toRadians(
                secondLat
            );

        const a =

            Math.sin(
                latitudeDifference /
                2
            ) **
            2 +

            Math.cos(
                firstLatitudeRadians
            ) *

            Math.cos(
                secondLatitudeRadians
            ) *

            Math.sin(
                longitudeDifference /
                2
            ) **
            2;

        const c =

            2 *

            Math.atan2(

                Math.sqrt(
                    a
                ),

                Math.sqrt(
                    1 -
                    a
                )

            );

        return earthRadiusKm *
            c;

    },

    /* ======================================================
       SAVE STATE
       ====================================================== */

    saveState() {

    try {

        const report =
            this.latestVisualizationReport &&
            typeof this.latestVisualizationReport === "object"
                ? this.latestVisualizationReport
                : {};

        const cells =
            Array.isArray(report.cells)
                ? report.cells
                : Array.isArray(report.activeCells)
                    ? report.activeCells
                    : [];

        const paths =
            Array.isArray(report.paths)
                ? report.paths
                : Array.isArray(report.predictedPaths)
                    ? report.predictedPaths
                    : [];

        const compactCells =
            cells
                .slice(0, 20)
                .map(cell => ({

                    id:
                        cell.id ??
                        cell.cellId ??
                        null,

                    lat:
                        Number.isFinite(Number(cell.lat))
                            ? Number(cell.lat)
                            : null,

                    lon:
                        Number.isFinite(Number(cell.lon ?? cell.lng))
                            ? Number(cell.lon ?? cell.lng)
                            : null,

                    intensity:
                        Number.isFinite(Number(cell.intensity))
                            ? Number(cell.intensity)
                            : 0,

                    riskLevel:
                        cell.riskLevel ??
                        cell.level ??
                        null,

                    confidence:
                        Number.isFinite(Number(cell.confidence))
                            ? Number(cell.confidence)
                            : 0,

                    updatedAt:
                        cell.updatedAt ??
                        cell.timestamp ??
                        null

                }));

        const compactPaths =
            paths
                .slice(0, 10)
                .map(path => ({

                    id:
                        path.id ??
                        path.pathId ??
                        null,

                    cellId:
                        path.cellId ??
                        null,

                    confidence:
                        Number.isFinite(Number(path.confidence))
                            ? Number(path.confidence)
                            : 0,

                    riskLevel:
                        path.riskLevel ??
                        path.level ??
                        null,

                    pointCount:
                        Array.isArray(path.points)
                            ? path.points.length
                            : 0,

                    updatedAt:
                        path.updatedAt ??
                        path.timestamp ??
                        null

                }));

        const compactReport = {

            timestamp:
                report.timestamp ??
                report.generatedAt ??
                this.lastRenderAt ??
                null,

            city:
                report.city ??
                report.cityName ??
                null,

            cellCount:
                cells.length,

            pathCount:
                paths.length,

            cells:
                compactCells,

            paths:
                compactPaths

        };

        const state = {

            version:
                this.version,

            initialized:
                this.initialized,

            cycleNumber:
                this.cycleNumber,

            lastRenderAt:
                this.lastRenderAt,

            latestVisualizationReport:
                compactReport,

            config: {

                automaticRendering:
                    this.config
                        ?.automaticRendering,

                display:
                    this.config
                        ?.display,

                animation:
                    this.config
                        ?.animation

            },

            savedAt:
                new Date()
                    .toISOString()

        };

        const serializedState =
            JSON.stringify(state);

        const maximumStorageLength =
            750000;

        if (
            serializedState.length >
            maximumStorageLength
        ) {

            state.latestVisualizationReport = {

                timestamp:
                    compactReport.timestamp,

                city:
                    compactReport.city,

                cellCount:
                    compactReport.cellCount,

                pathCount:
                    compactReport.pathCount,

                cells:
                    [],

                paths:
                    []

            };

        }

        localStorage.setItem(

            this.storageKey,

            JSON.stringify(state)

        );

        return true;

    } catch (error) {

        if (
            error?.name === "QuotaExceededError" ||
            error?.code === 22 ||
            error?.code === 1014
        ) {

            try {

                localStorage.removeItem(
                    this.storageKey
                );

                localStorage.setItem(

                    this.storageKey,

                    JSON.stringify({

                        version:
                            this.version,

                        cycleNumber:
                            this.cycleNumber,

                        lastRenderAt:
                            this.lastRenderAt,

                        latestVisualizationReport: {

                            cellCount:
                                Array.isArray(
                                    this.latestVisualizationReport?.cells
                                )
                                    ? this.latestVisualizationReport.cells.length
                                    : 0,

                            pathCount:
                                Array.isArray(
                                    this.latestVisualizationReport?.paths
                                )
                                    ? this.latestVisualizationReport.paths.length
                                    : 0

                        },

                        savedAt:
                            new Date()
                                .toISOString()

                    })

                );

                console.warn(
                    "Storm Visualization storage was compacted after reaching browser quota."
                );

                return true;

            } catch (fallbackError) {

                console.warn(
                    "Storm Visualization compact state save failed:",
                    fallbackError
                );

                return false;

            }

        }

        console.warn(
            "Storm Visualization state save failed:",
            error
        );

        return false;

    }

},

    /* ======================================================
       LOAD STATE
       ====================================================== */

    loadState() {

        try {

            const savedState =
                localStorage.getItem(
                    this.storageKey
                );

            if (
                !savedState
            ) {

                return false;

            }

            const parsed =
                JSON.parse(
                    savedState
                );

            if (
                !parsed ||
                typeof parsed !==
                    "object"
            ) {

                return false;

            }

            this.cycleNumber =
                this.safeNumber(
                    parsed.cycleNumber,
                    0
                );

            this.lastRenderAt =
                parsed.lastRenderAt ||
                null;

            this.latestVisualizationReport =
                parsed.latestVisualizationReport ||
                null;

            if (
                parsed.config &&
                typeof parsed.config ===
                    "object"
            ) {

                if (
                    typeof parsed
                        .config
                        .automaticRendering ===
                        "boolean"
                ) {

                    this.config
                        .automaticRendering =
                        parsed
                            .config
                            .automaticRendering;

                }

                if (
                    parsed
                        .config
                        .display &&
                    typeof parsed
                        .config
                        .display ===
                        "object"
                ) {

                    this.config.display = {

                        ...this.config.display,

                        ...parsed
                            .config
                            .display

                    };

                }

                if (
                    parsed
                        .config
                        .animation &&
                    typeof parsed
                        .config
                        .animation ===
                        "object"
                ) {

                    this.config.animation = {

                        ...this.config.animation,

                        ...parsed
                            .config
                            .animation

                    };

                }

            }

            return true;

        } catch (error) {

            console.warn(
                "Storm Visualization state load failed:",
                error
            );

            return false;

        }

    },

    /* ======================================================
       PUBLISH VISUALIZATION REPORT
       ====================================================== */

    publishVisualizationReport(
        report
    ) {

        if (
            !report
        ) {

            return;

        }

        window.RG31
            .latestStormVisualizationReport =
            report;

        window.RG30
            .latestStormVisualizationReport =
            report;

        window.RG31
            .StormVisualizationState =
            this.getVisualizationState();

        window.RG30
            .StormVisualizationState =
            this.getVisualizationState();

        const detail = {

            report,

            state:
                this.getVisualizationState(),

            renderedCells:
                this.getRenderedCells(),

            renderedPaths:
                this.getRenderedPaths(),

            timestamp:
                this.lastRenderAt,

            version:
                this.version

        };

        window.dispatchEvent(

            new CustomEvent(

                "rg31:storm-visualization-completed",

                {
                    detail
                }

            )

        );

        window.dispatchEvent(

            new CustomEvent(

                "rg30:storm-visualization-completed",

                {
                    detail
                }

            )

        );

        window.dispatchEvent(

            new CustomEvent(

                "rg31:storm-map-updated",

                {

                    detail: {

                        cycleNumber:
                            this.cycleNumber,

                        cellsRendered:
                            report
                                .cellsRendered ||
                            0,

                        pathsRendered:
                            report
                                .pathsRendered ||
                            0,

                        impactedCitiesRendered:
                            report
                                .impactedCitiesRendered ||
                            0,

                        timestamp:
                            this.lastRenderAt

                    }

                }

            )

        );

        this.renderVisualizationStatusPanel(
            report
        );

    },

    /* ======================================================
       GET RENDERED CELLS
       ====================================================== */

    getRenderedCells() {

        return Object.values(
            this.renderedCells
        )
        .map(
            item => ({
                ...item
            })
        );

    },

    /* ======================================================
       GET RENDERED PATHS
       ====================================================== */

    getRenderedPaths() {

        return Object.values(
            this.renderedPaths
        )
        .map(
            item => ({

                ...item,

                points:
                    Array.isArray(
                        item.points
                    )
                        ? item.points.map(
                            point => ({
                                ...point
                            })
                        )
                        : [],

                animationMarker:
                    undefined

            })
        );

    },

    /* ======================================================
       GET VISUALIZATION STATE
       ====================================================== */

    getVisualizationState() {

        return {

            version:
                this.version,

            initialized:
                this.initialized,

            enabled:
                this.config.enabled,

            automaticRendering:
                this.config
                    .automaticRendering,

            rendering:
                this.rendering,

            cycleNumber:
                this.cycleNumber,

            lastRenderAt:
                this.lastRenderAt,

            mapAvailable:
                Boolean(
                    this.map
                ),

            leafletAvailable:
                typeof window.L !==
                    "undefined",

            layersReady:
                Boolean(
                    this.layerGroup
                ),

            animationEnabled:
                this.config
                    .animation
                    .enabled,

            animationRunning:
                Boolean(
                    this.animationFrameId
                ),

            renderedCellCount:
                Object.keys(
                    this.renderedCells
                )
                .length,

            renderedPathCount:
                Object.keys(
                    this.renderedPaths
                )
                .length,

            display: {

                ...this.config
                    .display

            },

            latestVisualizationReport:
                this.latestVisualizationReport

        };

    },

    /* ======================================================
       DEBUG SNAPSHOT
       ====================================================== */

    getDebugSnapshot() {

        return {

            engine:
                "StormVisualizationEngine",

            version:
                this.version,

            config:
                this.config,

            state:
                this.getVisualizationState(),

            map:
                this.map,

            layers: {

                layerGroup:
                    Boolean(
                        this.layerGroup
                    ),

                activeCellLayer:
                    Boolean(
                        this.activeCellLayer
                    ),

                historyPathLayer:
                    Boolean(
                        this.historyPathLayer
                    ),

                forecastPathLayer:
                    Boolean(
                        this.forecastPathLayer
                    ),

                forecastPointLayer:
                    Boolean(
                        this.forecastPointLayer
                    ),

                impactedCityLayer:
                    Boolean(
                        this.impactedCityLayer
                    ),

                directionLayer:
                    Boolean(
                        this.directionLayer
                    ),

                animationLayer:
                    Boolean(
                        this.animationLayer
                    )

            },

            renderedCells:
                this.getRenderedCells(),

            renderedPaths:
                this.getRenderedPaths(),

            latestVisualizationReport:
                this.latestVisualizationReport,

            timestamp:
                new Date()
                    .toISOString()

        };

    },

    /* ======================================================
       RENDER VISUALIZATION STATUS PANEL
       ====================================================== */

    renderVisualizationStatusPanel(
        report =
            this.latestVisualizationReport
    ) {

        const panel =
            document.getElementById(
                "stormVisualizationPanel"
            );

        if (
            !panel
        ) {

            return;

        }

        if (
            !report
        ) {

            panel.innerHTML = `

                <div class="item info">

                    ${this.text(

                        "No storm visualization report is available yet.",

                        "لا يتوفر تقرير لعرض العواصف حتى الآن."

                    )}

                </div>

            `;

            return;

        }

        const mapStatus =
            report.mapAvailable ===
                true
                ? this.text(
                    "Available",
                    "متاحة"
                )
                : this.text(
                    "Unavailable",
                    "غير متاحة"
                );

        const animationStatus =
            this.config
                .animation
                .enabled ===
                true
                ? this.text(
                    "Enabled",
                    "مفعّلة"
                )
                : this.text(
                    "Disabled",
                    "متوقفة"
                );

        panel.innerHTML = `

            <div class="item info">

                <h3>

                    ${this.text(

                        "Storm Visualization Summary V31",

                        "ملخص عرض العواصف V31"

                    )}

                </h3>

                <b>

                    ${this.text(
                        "Visualization Cycle",
                        "دورة العرض"
                    )}:

                </b>

                ${this.safeNumber(
                    report.cycleNumber,
                    0
                )}

                <br>

                <b>

                    ${this.text(
                        "Map",
                        "الخريطة"
                    )}:

                </b>

                ${mapStatus}

                <br>

                <b>

                    ${this.text(
                        "Active Cells Received",
                        "الخلايا النشطة المستلمة"
                    )}:

                </b>

                ${this.safeNumber(
                    report.activeCellsReceived,
                    0
                )}

                <br>

                <b>

                    ${this.text(
                        "Cells Rendered",
                        "الخلايا المرسومة"
                    )}:

                </b>

                ${this.safeNumber(
                    report.cellsRendered,
                    0
                )}

                <br>

                <b>

                    ${this.text(
                        "Predictions Received",
                        "التوقعات المستلمة"
                    )}:

                </b>

                ${this.safeNumber(
                    report.predictionsReceived,
                    0
                )}

                <br>

                <b>

                    ${this.text(
                        "Paths Rendered",
                        "المسارات المرسومة"
                    )}:

                </b>

                ${this.safeNumber(
                    report.pathsRendered,
                    0
                )}

                <br>

                <b>

                    ${this.text(
                        "Impacted Cities Rendered",
                        "المدن المتأثرة المرسومة"
                    )}:

                </b>

                ${this.safeNumber(
                    report.impactedCitiesRendered,
                    0
                )}

                <br>

                <b>

                    ${this.text(
                        "Animation",
                        "الحركة"
                    )}:

                </b>

                ${animationStatus}

                <br>

                <b>

                    ${this.text(
                        "Render Duration",
                        "مدة الرسم"
                    )}:

                </b>

                ${this.safeNumber(
                    report.durationMs,
                    0
                )} ms

                <br>

                <b>

                    ${this.text(
                        "Last Render",
                        "آخر رسم"
                    )}:

                </b>

                ${report.timestamp
                    ? new Date(
                        report.timestamp
                    )
                    .toLocaleString(
                        this.getLocale()
                    )
                    : "--"
                }

            </div>

        `;

    },
      /* ======================================================
       KNOWN CITIES
       ====================================================== */

    getKnownCities() {

        return [

            {
                city: "Riyadh",
                cityAr: "الرياض",
                lat: 24.7136,
                lon: 46.6753
            },

            {
                city: "Jeddah",
                cityAr: "جدة",
                lat: 21.4858,
                lon: 39.1925
            },

            {
                city: "Makkah",
                cityAr: "مكة",
                lat: 21.3891,
                lon: 39.8579
            },

            {
                city: "Taif",
                cityAr: "الطائف",
                lat: 21.2703,
                lon: 40.4158
            },

            {
                city: "Abha",
                cityAr: "أبها",
                lat: 18.2164,
                lon: 42.5053
            },

            {
                city: "Najran",
                cityAr: "نجران",
                lat: 17.5656,
                lon: 44.2289
            },

            {
                city: "Dammam",
                cityAr: "الدمام",
                lat: 26.4207,
                lon: 50.0888
            },

            {
                city: "Madinah",
                cityAr: "المدينة",
                lat: 24.5247,
                lon: 39.5692
            },

            {
                city: "Jazan",
                cityAr: "جازان",
                lat: 16.8892,
                lon: 42.5511
            },

            {
                city: "Tabuk",
                cityAr: "تبوك",
                lat: 28.3838,
                lon: 36.5550
            },

            {
                city: "Hail",
                cityAr: "حائل",
                lat: 27.5114,
                lon: 41.7208
            },

            {
                city: "Buraydah",
                cityAr: "بريدة",
                lat: 26.3592,
                lon: 43.9818
            },

            {
                city: "Al Baha",
                cityAr: "الباحة",
                lat: 20.0129,
                lon: 41.4677
            },

            {
                city: "Khamis Mushait",
                cityAr: "خميس مشيط",
                lat: 18.3064,
                lon: 42.7297
            },

            {
                city: "Yanbu",
                cityAr: "ينبع",
                lat: 24.0895,
                lon: 38.0618
            },

            {
                city: "Al Ahsa",
                cityAr: "الأحساء",
                lat: 25.3830,
                lon: 49.5860
            },

            {
                city: "Hafar Al Batin",
                cityAr: "حفر الباطن",
                lat: 28.4328,
                lon: 45.9708
            },

            {
                city: "Sakaka",
                cityAr: "سكاكا",
                lat: 29.9697,
                lon: 40.2064
            },

            {
                city: "Arar",
                cityAr: "عرعر",
                lat: 30.9753,
                lon: 41.0381
            }

        ];

    },

    /* ======================================================
       DIRECTION LABEL LOCALIZED
       ====================================================== */

    getDirectionLabelLocalized(
        direction
    ) {

        const value =
            this.normalizeStatus(
                direction
            );

        const labels = {

            N: {
                en: "North",
                ar: "شمال"
            },

            NE: {
                en: "North-East",
                ar: "شمال شرقي"
            },

            E: {
                en: "East",
                ar: "شرق"
            },

            SE: {
                en: "South-East",
                ar: "جنوب شرقي"
            },

            S: {
                en: "South",
                ar: "جنوب"
            },

            SW: {
                en: "South-West",
                ar: "جنوب غربي"
            },

            W: {
                en: "West",
                ar: "غرب"
            },

            NW: {
                en: "North-West",
                ar: "شمال غربي"
            },

            STATIONARY: {
                en: "Stationary",
                ar: "ثابتة"
            },

            UNKNOWN: {
                en: "Unknown",
                ar: "غير معروف"
            }

        };

        const item =
            labels[value] ||
            labels.UNKNOWN;

        return this.isArabic()
            ? item.ar
            : item.en;

    },

    /* ======================================================
       TREND LABEL
       ====================================================== */

    getTrendLabel(
        trend
    ) {

        const value =
            this.normalizeStatus(
                trend
            );

        const labels = {

            NEW: {
                en: "New",
                ar: "جديدة"
            },

            RAPIDLY_GROWING: {
                en: "Rapidly Growing",
                ar: "تنمو بسرعة"
            },

            GROWING: {
                en: "Growing",
                ar: "نامية"
            },

            SLIGHTLY_GROWING: {
                en: "Slightly Growing",
                ar: "تنمو تدريجيًا"
            },

            STABLE: {
                en: "Stable",
                ar: "مستقرة"
            },

            SLIGHTLY_WEAKENING: {
                en: "Slightly Weakening",
                ar: "تضعف تدريجيًا"
            },

            WEAKENING: {
                en: "Weakening",
                ar: "تضعف"
            },

            RAPIDLY_WEAKENING: {
                en: "Rapidly Weakening",
                ar: "تضعف بسرعة"
            },

            UNKNOWN: {
                en: "Unknown",
                ar: "غير معروف"
            }

        };

        const item =
            labels[value] ||
            labels.UNKNOWN;

        return this.isArabic()
            ? item.ar
            : item.en;

    },

    /* ======================================================
       LIFECYCLE LABEL
       ====================================================== */

    getLifecycleLabel(
        lifecycle
    ) {

        const value =
            this.normalizeStatus(
                lifecycle
            );

        const labels = {

            NEW: {
                en: "New",
                ar: "جديدة"
            },

            DEVELOPING: {
                en: "Developing",
                ar: "قيد التطور"
            },

            MATURE: {
                en: "Mature",
                ar: "ناضجة"
            },

            LONG_LIVED: {
                en: "Long-Lived",
                ar: "طويلة العمر"
            },

            TEMPORARILY_MISSING: {
                en: "Temporarily Missing",
                ar: "مفقودة مؤقتًا"
            },

            LOST: {
                en: "Lost",
                ar: "مفقودة"
            },

            ARCHIVED: {
                en: "Archived",
                ar: "مؤرشفة"
            },

            UNKNOWN: {
                en: "Unknown",
                ar: "غير معروف"
            }

        };

        const item =
            labels[value] ||
            labels.UNKNOWN;

        return this.isArabic()
            ? item.ar
            : item.en;

    },

    /* ======================================================
       IMPACT LEVEL LABEL
       ====================================================== */

    getImpactLevelLabel(
        impactLevel
    ) {

        const value =
            this.normalizeStatus(
                impactLevel
            );

        const labels = {

            DIRECT_HIGH_IMPACT: {
                en: "Direct High Impact",
                ar: "تأثير مباشر مرتفع"
            },

            LIKELY_IMPACT: {
                en: "Likely Impact",
                ar: "تأثير مرجح"
            },

            POSSIBLE_IMPACT: {
                en: "Possible Impact",
                ar: "تأثير محتمل"
            },

            MONITORING: {
                en: "Monitoring",
                ar: "تحت المراقبة"
            },

            UNKNOWN: {
                en: "Unknown",
                ar: "غير معروف"
            }

        };

        const item =
            labels[value] ||
            labels.UNKNOWN;

        return this.isArabic()
            ? item.ar
            : item.en;

    },

    /* ======================================================
       LANGUAGE HELPERS
       ====================================================== */

    isArabic() {

        return (

            window.RG31
                ?.I18n
                ?.language ===
                "ar" ||

            window.RG30
                ?.I18n
                ?.language ===
                "ar"

        );

    },

    getLocale() {

        return this.isArabic()
            ? "ar-SA"
            : "en-US";

    },

    text(
        english,
        arabic
    ) {

        return this.isArabic()
            ? arabic
            : english;

    },

    /* ======================================================
       NUMERIC HELPERS
       ====================================================== */

    safeNumber(
        value,
        fallback = 0
    ) {

        const number =
            Number(
                value
            );

        return Number.isFinite(
            number
        )
            ? number
            : fallback;

    },

    firstNullableNumber(
        ...values
    ) {

        for (
            const value of values
        ) {

            if (
                value === null ||
                value === undefined ||
                value === ""
            ) {

                continue;

            }

            const number =
                Number(
                    value
                );

            if (
                Number.isFinite(
                    number
                )
            ) {

                return number;

            }

        }

        return null;

    },

    clamp(
        value,
        minimum = 0,
        maximum = 100
    ) {

        const number =
            this.safeNumber(
                value,
                minimum
            );

        return Math.min(

            maximum,

            Math.max(
                minimum,
                number
            )

        );

    },

    /* ======================================================
       STATUS NORMALIZATION
       ====================================================== */

    normalizeStatus(
        value
    ) {

        return String(
            value ??
            ""
        )
            .trim()
            .toUpperCase()
            .replaceAll(
                " ",
                "_"
            )
            .replaceAll(
                "-",
                "_"
            );

    },

    /* ======================================================
       HTML SAFETY
       ====================================================== */

    escapeHtml(
        value
    ) {

        return String(
            value ??
            ""
        )
            .replace(
                /&/g,
                "&amp;"
            )
            .replace(
                /</g,
                "&lt;"
            )
            .replace(
                />/g,
                "&gt;"
            )
            .replace(
                /"/g,
                "&quot;"
            )
            .replace(
                /'/g,
                "&#039;"
            );

    },
      /* ======================================================
       SET AUTOMATIC RENDERING
       ====================================================== */

    setAutomaticRendering(
        enabled
    ) {

        this.config
            .automaticRendering =
            enabled ===
            true;

        this.saveState();

        this.writeLog(

            this.config
                .automaticRendering
                ? "Automatic storm visualization enabled."
                : "Automatic storm visualization disabled.",

            this.config
                .automaticRendering
                ? "success"
                : "warning"

        );

        return this.config
            .automaticRendering;

    },

    /* ======================================================
       SET DISPLAY OPTION
       ====================================================== */

    setDisplayOption(
        optionName,
        enabled
    ) {

        const option =
            String(
                optionName ||
                ""
            )
                .trim();

        if (
            !option ||
            !Object.prototype
                .hasOwnProperty
                .call(
                    this.config.display,
                    option
                )
        ) {

            this.writeLog(
                `Unknown storm visualization display option: ${option}`,
                "warning"
            );

            return false;

        }

        this.config
            .display[
                option
            ] =
            enabled ===
            true;

        this.saveState();

        this.renderCurrentState();

        return this.config
            .display[
                option
            ];

    },

    /* ======================================================
       SHOW ALL LAYERS
       ====================================================== */

    showAllLayers() {

        Object.keys(
            this.config.display
        )
        .forEach(
            key => {

                if (
                    key ===
                    "fitBoundsAutomatically"
                ) {

                    return;

                }

                this.config
                    .display[
                        key
                    ] =
                    true;

            }
        );

        this.saveState();

        this.renderCurrentState();

        return {

            ...this.config.display

        };

    },

    /* ======================================================
       HIDE ALL LAYERS
       ====================================================== */

    hideAllLayers() {

        Object.keys(
            this.config.display
        )
        .forEach(
            key => {

                if (
                    key ===
                    "fitBoundsAutomatically"
                ) {

                    return;

                }

                this.config
                    .display[
                        key
                    ] =
                    false;

            }
        );

        this.clearVisualizationLayers();

        this.saveState();

        return {

            ...this.config.display

        };

    },

    /* ======================================================
       REFRESH MAP
       ====================================================== */

    refreshMap() {

        if (
            !this.map
        ) {

            this.resolveMap();

        }

        if (
            this.map
                ?.invalidateSize
        ) {

            this.map
                .invalidateSize();

        }

        if (
            !this.layerGroup &&
            this.map
        ) {

            this.initializeLayers();

        }

        return this.renderCurrentState();

    },

    /* ======================================================
       ENABLE AUTO FIT
       ====================================================== */

    setAutoFitBounds(
        enabled
    ) {

        this.config
            .display
            .fitBoundsAutomatically =
            enabled ===
            true;

        this.saveState();

        if (
            this.config
                .display
                .fitBoundsAutomatically
        ) {

            this.fitVisualizationBounds();

        }

        return this.config
            .display
            .fitBoundsAutomatically;

    },

    /* ======================================================
       CLEAR MAP LAYERS
       ====================================================== */

    clearMap() {

        this.clearVisualizationLayers();

        this.latestVisualizationReport =
            null;

        window.RG31
            .latestStormVisualizationReport =
            null;

        window.RG30
            .latestStormVisualizationReport =
            null;

        window.RG31
            .StormVisualizationState =
            this.getVisualizationState();

        window.RG30
            .StormVisualizationState =
            this.getVisualizationState();

        this.renderVisualizationStatusPanel(
            null
        );

        this.writeLog(
            "Storm visualization layers cleared.",
            "warning"
        );

        return true;

    },

    /* ======================================================
       RESET ENGINE
       ====================================================== */

    reset() {

        this.stopAnimationLoop();

        this.rendering =
            false;

        this.cycleNumber =
            0;

        this.lastRenderAt =
            null;

        this.latestVisualizationReport =
            null;

        this.renderedCells =
            {};

        this.renderedPaths =
            {};

        this.clearVisualizationLayers();

        try {

            localStorage.removeItem(
                this.storageKey
            );

        } catch (error) {

            console.warn(
                "Storm Visualization storage reset skipped:",
                error
            );

        }

        window.RG31
            .latestStormVisualizationReport =
            null;

        window.RG30
            .latestStormVisualizationReport =
            null;

        window.RG31
            .StormVisualizationState =
            null;

        window.RG30
            .StormVisualizationState =
            null;

        this.renderVisualizationStatusPanel(
            null
        );

        if (
            this.config
                .animation
                .enabled ===
                true
        ) {

            this.startAnimationLoop();

        }

        this.writeLog(
            "Storm Visualization Engine V31 reset.",
            "warning"
        );

        window.dispatchEvent(

            new CustomEvent(

                "rg31:storm-visualization-reset",

                {

                    detail: {

                        version:
                            this.version,

                        timestamp:
                            new Date()
                                .toISOString()

                    }

                }

            )

        );

        return true;

    },

    /* ======================================================
       EXPORT STATE
       ====================================================== */

    exportState() {

        return JSON.stringify(

            {

                version:
                    this.version,

                cycleNumber:
                    this.cycleNumber,

                lastRenderAt:
                    this.lastRenderAt,

                latestVisualizationReport:
                    this.latestVisualizationReport,

                renderedCells:
                    this.getRenderedCells(),

                renderedPaths:
                    this.getRenderedPaths(),

                config: {

                    automaticRendering:
                        this.config
                            .automaticRendering,

                    display: {

                        ...this.config
                            .display

                    },

                    animation: {

                        ...this.config
                            .animation

                    }

                },

                exportedAt:
                    new Date()
                        .toISOString()

            },

            null,

            2

        );

    },

    /* ======================================================
       IMPORT STATE
       ====================================================== */

    importState(
        payload
    ) {

        try {

            const parsed =
                typeof payload ===
                "string"
                    ? JSON.parse(
                        payload
                    )
                    : payload;

            if (
                !parsed ||
                typeof parsed !==
                    "object"
            ) {

                throw new Error(
                    "INVALID_STORM_VISUALIZATION_STATE"
                );

            }

            this.cycleNumber =
                this.safeNumber(
                    parsed.cycleNumber,
                    this.cycleNumber
                );

            this.lastRenderAt =
                parsed.lastRenderAt ||
                this.lastRenderAt;

            this.latestVisualizationReport =
                parsed.latestVisualizationReport ||
                this.latestVisualizationReport;

            if (
                parsed.config &&
                typeof parsed.config ===
                    "object"
            ) {

                if (
                    typeof parsed
                        .config
                        .automaticRendering ===
                        "boolean"
                ) {

                    this.config
                        .automaticRendering =
                        parsed
                            .config
                            .automaticRendering;

                }

                if (
                    parsed
                        .config
                        .display &&
                    typeof parsed
                        .config
                        .display ===
                        "object"
                ) {

                    this.config.display = {

                        ...this.config.display,

                        ...parsed
                            .config
                            .display

                    };

                }

                if (
                    parsed
                        .config
                        .animation &&
                    typeof parsed
                        .config
                        .animation ===
                        "object"
                ) {

                    this.config.animation = {

                        ...this.config.animation,

                        ...parsed
                            .config
                            .animation

                    };

                }

            }

            this.saveState();

            this.restartAnimationLoop();

            this.refreshMap();

            this.writeLog(
                "Storm Visualization state imported successfully."
            );

            window.dispatchEvent(

                new CustomEvent(

                    "rg31:storm-visualization-state-imported",

                    {

                        detail: {

                            state:
                                this.getVisualizationState(),

                            timestamp:
                                new Date()
                                    .toISOString()

                        }

                    }

                )

            );

            return true;

        } catch (error) {

            console.error(
                "Storm Visualization state import failed:",
                error
            );

            this.writeLog(

                `Storm visualization import failed: ${error?.message || String(error)}`,

                "danger"

            );

            return false;

        }

    },

    /* ======================================================
       MANUAL RENDERING
       ====================================================== */

    async runManualRendering(
        activeCells = null,
        predictions = null
    ) {

        const sourceCells =
            Array.isArray(
                activeCells
            )
                ? activeCells
                : this.getCurrentActiveCells();

        const sourcePredictions =
            Array.isArray(
                predictions
            )
                ? predictions
                : this.getCurrentPredictions();

        return this.renderStormSystem({

            activeCells:
                sourceCells,

            predictions:
                sourcePredictions

        });

    },

    /* ======================================================
       SET ENGINE ENABLED
       ====================================================== */

    setEnabled(
        enabled
    ) {

        this.config.enabled =
            enabled ===
            true;

        if (
            this.config.enabled
        ) {

            this.ensureMapReady();

            this.renderCurrentState();

            if (
                this.config
                    .animation
                    .enabled
            ) {

                this.startAnimationLoop();

            }

        } else {

            this.stopAnimationLoop();

            this.clearVisualizationLayers();

        }

        this.saveState();

        return this.config.enabled;

    },

    /* ======================================================
       SET MAP INSTANCE
       ====================================================== */

    setMap(
        mapInstance
    ) {

        if (!this.isLeafletMap(mapInstance)) {

    console.warn(
        "Storm Visualization waiting for Leaflet map..."
    );

    return false;

}
        this.removeExistingLayers();

        this.map =
            mapInstance;

        this.initializeLayers();

        this.renderCurrentState();

        window.dispatchEvent(

            new CustomEvent(

                "rg31:storm-visualization-map-changed",

                {

                    detail: {

                        mapAvailable:
                            true,

                        timestamp:
                            new Date()
                                .toISOString()

                    }

                }

            )

        );

        return true;

    },

    /* ======================================================
       TOGGLE ACTIVE CELLS
       ====================================================== */

    toggleActiveCells(
        enabled
    ) {

        return this.setDisplayOption(
            "showActiveCells",
            enabled
        );

    },

    /* ======================================================
       TOGGLE HISTORY PATHS
       ====================================================== */

    toggleHistoryPaths(
        enabled
    ) {

        return this.setDisplayOption(
            "showHistoryPaths",
            enabled
        );

    },

    /* ======================================================
       TOGGLE FORECAST PATHS
       ====================================================== */

    toggleForecastPaths(
        enabled
    ) {

        return this.setDisplayOption(
            "showForecastPaths",
            enabled
        );

    },

    /* ======================================================
       TOGGLE FORECAST POINTS
       ====================================================== */

    toggleForecastPoints(
        enabled
    ) {

        return this.setDisplayOption(
            "showForecastPoints",
            enabled
        );

    },

    /* ======================================================
       TOGGLE IMPACTED CITIES
       ====================================================== */

    toggleImpactedCities(
        enabled
    ) {

        return this.setDisplayOption(
            "showImpactedCities",
            enabled
        );

    },

    /* ======================================================
       TOGGLE DIRECTION ARROWS
       ====================================================== */

    toggleDirectionArrows(
        enabled
    ) {

        return this.setDisplayOption(
            "showDirectionArrows",
            enabled
        );

    },

    /* ======================================================
       TOGGLE RISK CIRCLES
       ====================================================== */

    toggleRiskCircles(
        enabled
    ) {

        return this.setDisplayOption(
            "showRiskCircles",
            enabled
        );

    },

    /* ======================================================
       TOGGLE LABELS
       ====================================================== */

    toggleLabels(
        enabled
    ) {

        return this.setDisplayOption(
            "showLabels",
            enabled
        );

    },
      /* ======================================================
       LOGGING
       ====================================================== */

    writeLog(
        message,
        type = "success"
    ) {

        const prefix =
            "[RainGuard V31 Storm Visualization]";

        if (
            type ===
            "danger"
        ) {

            console.error(
                prefix,
                message
            );

        } else if (
            type ===
            "warning"
        ) {

            console.warn(
                prefix,
                message
            );

        } else {

            console.log(
                prefix,
                message
            );

        }

        if (
            window.RG23
                ?.Brain
                ?.writeCommander
        ) {

            try {

                window.RG23
                    .Brain
                    .writeCommander(
                        message,
                        type
                    );

            } catch (error) {

                console.warn(
                    "Storm visualization commander log skipped:",
                    error
                );

            }

        } else if (
            window.RG30
                ?.Orchestrator
                ?.writeCommander
        ) {

            try {

                window.RG30
                    .Orchestrator
                    .writeCommander(
                        message,
                        type
                    );

            } catch (error) {

                console.warn(
                    "Storm visualization orchestrator log skipped:",
                    error
                );

            }

        }

    },

    /* ======================================================
       REGISTER COMPATIBILITY ALIASES
       ====================================================== */

    registerCompatibilityAliases() {

        window.RG31.StormVisualizationEngine =
            this;

        window.RG30.StormVisualizationEngine =
            this;

        window.RG31.StormVisualizer =
            this;

        window.RG30.StormVisualizer =
            this;

        window.RG31.StormMapEngine =
            this;

        window.RG30.StormMapEngine =
            this;

        return true;

    },

    /* ======================================================
       DESTROY
       ====================================================== */

    destroy() {

        this.stopAnimationLoop();

        this.clearVisualizationLayers();

        this.removeExistingLayers();

        this.rendering =
            false;

        this.initialized =
            false;

        this.map =
            null;

        this.renderedCells =
            {};

        this.renderedPaths =
            {};

        this.writeLog(
            "Storm Visualization Engine V31 destroyed.",
            "warning"
        );

        window.dispatchEvent(

            new CustomEvent(

                "rg31:storm-visualization-destroyed",

                {

                    detail: {

                        version:
                            this.version,

                        timestamp:
                            new Date()
                                .toISOString()

                    }

                }

            )

        );

        return true;

    }

};

/* =========================================================
   V30 COMPATIBILITY
   ========================================================= */

window.RG30.StormVisualizationEngine =
    window.RG31.StormVisualizationEngine;

window.RG30.StormVisualizer =
    window.RG31.StormVisualizationEngine;

window.RG30.StormMapEngine =
    window.RG31.StormVisualizationEngine;

/* =========================================================
   GLOBAL SHORTCUTS — STATE AND DEBUG
   ========================================================= */

window.getStormVisualizationStateV31 =
    function () {

        return window.RG31
            .StormVisualizationEngine
            .getVisualizationState();

    };

window.getStormVisualizationDebugV31 =
    function () {

        return window.RG31
            .StormVisualizationEngine
            .getDebugSnapshot();

    };

window.getRenderedStormCellsV31 =
    function () {

        return window.RG31
            .StormVisualizationEngine
            .getRenderedCells();

    };

window.getRenderedStormPathsV31 =
    function () {

        return window.RG31
            .StormVisualizationEngine
            .getRenderedPaths();

    };

/* =========================================================
   GLOBAL SHORTCUTS — RENDERING
   ========================================================= */

window.runStormVisualizationV31 =
    function (
        activeCells,
        predictions
    ) {

        return window.RG31
            .StormVisualizationEngine
            .runManualRendering(
                activeCells,
                predictions
            );

    };

window.refreshStormVisualizationV31 =
    function () {

        return window.RG31
            .StormVisualizationEngine
            .refreshMap();

    };

window.clearStormVisualizationV31 =
    function () {

        return window.RG31
            .StormVisualizationEngine
            .clearMap();

    };

window.resetStormVisualizationV31 =
    function () {

        return window.RG31
            .StormVisualizationEngine
            .reset();

    };

/* =========================================================
   GLOBAL SHORTCUTS — ENABLE/DISABLE
   ========================================================= */

window.enableStormVisualizationV31 =
    function () {

        return window.RG31
            .StormVisualizationEngine
            .setEnabled(
                true
            );

    };

window.disableStormVisualizationV31 =
    function () {

        return window.RG31
            .StormVisualizationEngine
            .setEnabled(
                false
            );

    };

window.enableAutomaticStormVisualizationV31 =
    function () {

        return window.RG31
            .StormVisualizationEngine
            .setAutomaticRendering(
                true
            );

    };

window.disableAutomaticStormVisualizationV31 =
    function () {

        return window.RG31
            .StormVisualizationEngine
            .setAutomaticRendering(
                false
            );

    };

/* =========================================================
   GLOBAL SHORTCUTS — LAYERS
   ========================================================= */

window.showAllStormLayersV31 =
    function () {

        return window.RG31
            .StormVisualizationEngine
            .showAllLayers();

    };

window.hideAllStormLayersV31 =
    function () {

        return window.RG31
            .StormVisualizationEngine
            .hideAllLayers();

    };

window.toggleStormActiveCellsV31 =
    function (
        enabled
    ) {

        return window.RG31
            .StormVisualizationEngine
            .toggleActiveCells(
                enabled
            );

    };

window.toggleStormHistoryPathsV31 =
    function (
        enabled
    ) {

        return window.RG31
            .StormVisualizationEngine
            .toggleHistoryPaths(
                enabled
            );

    };

window.toggleStormForecastPathsV31 =
    function (
        enabled
    ) {

        return window.RG31
            .StormVisualizationEngine
            .toggleForecastPaths(
                enabled
            );

    };

window.toggleStormForecastPointsV31 =
    function (
        enabled
    ) {

        return window.RG31
            .StormVisualizationEngine
            .toggleForecastPoints(
                enabled
            );

    };

window.toggleStormImpactedCitiesV31 =
    function (
        enabled
    ) {

        return window.RG31
            .StormVisualizationEngine
            .toggleImpactedCities(
                enabled
            );

    };

window.toggleStormDirectionArrowsV31 =
    function (
        enabled
    ) {

        return window.RG31
            .StormVisualizationEngine
            .toggleDirectionArrows(
                enabled
            );

    };

window.toggleStormRiskCirclesV31 =
    function (
        enabled
    ) {

        return window.RG31
            .StormVisualizationEngine
            .toggleRiskCircles(
                enabled
            );

    };

window.toggleStormLabelsV31 =
    function (
        enabled
    ) {

        return window.RG31
            .StormVisualizationEngine
            .toggleLabels(
                enabled
            );

    };

window.setStormVisualizationAutoFitV31 =
    function (
        enabled
    ) {

        return window.RG31
            .StormVisualizationEngine
            .setAutoFitBounds(
                enabled
            );

    };

/* =========================================================
   GLOBAL SHORTCUTS — ANIMATION
   ========================================================= */

window.enableStormAnimationV31 =
    function () {

        return window.RG31
            .StormVisualizationEngine
            .setAnimationEnabled(
                true
            );

    };

window.disableStormAnimationV31 =
    function () {

        return window.RG31
            .StormVisualizationEngine
            .setAnimationEnabled(
                false
            );

    };

window.restartStormAnimationV31 =
    function () {

        return window.RG31
            .StormVisualizationEngine
            .restartAnimationLoop();

    };

window.setStormAnimationDurationV31 =
    function (
        durationMs
    ) {

        return window.RG31
            .StormVisualizationEngine
            .setAnimationDuration(
                durationMs
            );

    };

/* =========================================================
   GLOBAL SHORTCUTS — MAP
   ========================================================= */

window.setStormVisualizationMapV31 =
    function (
        mapInstance
    ) {

        return window.RG31
            .StormVisualizationEngine
            .setMap(
                mapInstance
            );

    };

/* =========================================================
   GLOBAL SHORTCUTS — IMPORT / EXPORT
   ========================================================= */

window.exportStormVisualizationV31 =
    function () {

        return window.RG31
            .StormVisualizationEngine
            .exportState();

    };

window.importStormVisualizationV31 =
    function (
        payload
    ) {

        return window.RG31
            .StormVisualizationEngine
            .importState(
                payload
            );

    };

window.destroyStormVisualizationV31 =
    function () {

        return window.RG31
            .StormVisualizationEngine
            .destroy();

    };
/* =========================================================
   AUTO START
   ========================================================= */

(function initializeStormVisualizationV31() {

    const engine =
        window.RG31
            ?.StormVisualizationEngine;

    if (
        !engine
    ) {

        console.error(
            "Storm Visualization Engine V31 was not found."
        );

        return;

    }

    let attempts =
        0;

    const maximumAttempts =
        40;

    const retryDelayMs =
        500;

    const start =
        () => {

            try {

                engine
                    .registerCompatibilityAliases();

                engine
                    .init();

                const mapReady =
                    engine
                        .ensureMapReady();

                if (
                    mapReady
                ) {

                    engine
                        .renderCurrentState();

                    console.log(

                        "%cRainGuard AI V31 Storm Visualization Engine Ready",

                        "color:#f97316;font-weight:bold;font-size:14px;"

                    );

                    return;

                }

                attempts +=
                    1;

                if (
                    attempts >=
                    maximumAttempts
                ) {

                    engine.writeLog(

                        "Storm Visualization Engine initialized, but the Leaflet map was not detected after repeated attempts.",

                        "warning"

                    );

                    console.warn(
                        "Storm Visualization Engine V31 map detection timed out."
                    );

                    return;

                }

                window.setTimeout(

                    start,

                    retryDelayMs

                );

            } catch (error) {

                console.error(
                    "Storm Visualization Engine V31 initialization failed:",
                    error
                );

                attempts +=
                    1;

                if (
                    attempts <
                    maximumAttempts
                ) {

                    window.setTimeout(

                        start,

                        retryDelayMs

                    );

                }

            }

        };

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(

            "DOMContentLoaded",

            () => {

                window.setTimeout(

                    start,

                    500

                );

            },

            {
                once:
                    true
            }

        );

    } else {

        window.setTimeout(

            start,

            500

        );

    }

})();

/* =========================================================
   INITIAL DATA RETRY
   ========================================================= */

(function initializeStormVisualizationDataRetry() {

    let attempts =
        0;

    const maximumAttempts =
        20;

    const retryDelayMs =
        1000;

    const run =
        async () => {

            const engine =
                window.RG31
                    ?.StormVisualizationEngine;

            if (
                !engine ||
                engine.config
                    .automaticRendering !==
                    true
            ) {

                return;

            }

            const activeCells =
                engine
                    .getCurrentActiveCells();

            const predictions =
                engine
                    .getCurrentPredictions();

            if (
                activeCells.length ||
                predictions.length
            ) {

                try {

                    await engine
                        .renderStormSystem({

                            activeCells,

                            predictions

                        });

                } catch (error) {

                    console.warn(
                        "Initial Storm Visualization render skipped:",
                        error
                    );

                }

                return;

            }

            attempts +=
                1;

            if (
                attempts <
                maximumAttempts
            ) {

                window.setTimeout(

                    run,

                    retryDelayMs

                );

            }

        };

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(

            "DOMContentLoaded",

            () => {

                window.setTimeout(

                    run,

                    2500

                );

            },

            {
                once:
                    true
            }

        );

    } else {

        window.setTimeout(

            run,

            2500

        );

    }

})();

/* =========================================================
   LANGUAGE CHANGE REFRESH
   ========================================================= */

window.addEventListener(

    "rg31:language-changed",

    () => {

        window.RG31
            ?.StormVisualizationEngine
            ?.renderCurrentState();

    }

);

window.addEventListener(

    "rg30:language-changed",

    () => {

        window.RG31
            ?.StormVisualizationEngine
            ?.renderCurrentState();

    }

);

/* =========================================================
   MAP READY EVENTS
   ========================================================= */

window.addEventListener(

    "rg31:map-ready",

    event => {

        const engine =
            window.RG31
                ?.StormVisualizationEngine;

        const mapInstance =
            event
                ?.detail
                ?.map ||
            event
                ?.detail
                ?.mapInstance ||
            null;

        if (
            engine &&
            mapInstance
        ) {

            engine
                .setMap(
                    mapInstance
                );

        }

    }

);

window.addEventListener(

    "rg30:map-ready",

    event => {

        const engine =
            window.RG31
                ?.StormVisualizationEngine;

        const mapInstance =
            event
                ?.detail
                ?.map ||
            event
                ?.detail
                ?.mapInstance ||
            null;

        if (
            engine &&
            mapInstance
        ) {

            engine
                .setMap(
                    mapInstance
                );

        }

    }

);

/* =========================================================
   VISIBILITY CHANGE
   ========================================================= */

document.addEventListener(

    "visibilitychange",

    () => {

        const engine =
            window.RG31
                ?.StormVisualizationEngine;

        if (
            !engine
        ) {

            return;

        }

        if (
            document.hidden
        ) {

            engine
                .stopAnimationLoop();

        } else if (
            engine.config
                .animation
                .enabled ===
                true
        ) {

            engine
                .restartAnimationLoop();

            engine
                .renderCurrentState();

        }

    }

);

/* =========================================================
   CONSOLE READY MESSAGE
   ========================================================= */

console.log(

    "%cRainGuard AI V31 Storm Visualization Engine Loaded",

    "color:#f97316;font-weight:bold;font-size:14px;"

);
