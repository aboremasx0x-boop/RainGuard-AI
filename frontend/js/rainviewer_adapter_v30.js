/* =========================================================
   RainGuard AI V30
   RainViewer Weather Radar Adapter
   File: frontend/js/rainviewer_adapter_v30.js

   الوظائف:
   - جلب قائمة إطارات RainViewer الرسمية.
   - اختيار أحدث إطار راداري متاح.
   - إنشاء رابط Tile صالح لخرائط Leaflet.
   - إضافة وإزالة طبقة الرادار من الخريطة.
   - تمرير نتيجة موحدة إلى SourceAdapter V30.
   - عدم اختلاق شدة مطر من مجرد وجود طبقة الرادار.
   - استخدام قراءة محلية فقط إذا كانت متاحة في بيانات المدينة.
   ========================================================= */

window.RG30 = window.RG30 || {};

RG30.RainViewerAdapter = {

    version: "30.0.0",

    initialized: false,
    collecting: false,

    lastRequestAt: null,
    lastSuccessAt: null,
    lastFailureAt: null,
    lastError: null,

    lastMetadata: null,
    latestFrame: null,

    radarLayer: null,
    map: null,

    cache: {
        metadata: null,
        savedAt: 0
    },

    config: {
        enabled: true,

        metadataEndpoint:
            "https://api.rainviewer.com/public/weather-maps.json",

        timeoutMs: 12000,

        cacheMinutes: 5,

        defaultReliability: 0.92,

        /*
         * RainViewer palette:
         * 0, 1, 2, 3, 4, 5, 6, 7, 8
         */
        colorScheme: 4,

        /*
         * Tile smoothing:
         * 0 = بدون تنعيم
         * 1 = تنعيم
         */
        smooth: 1,

        /*
         * Snow:
         * 0 = عدم عرض الثلج منفصلًا
         * 1 = عرض الثلج
         */
        snow: 1,

        /*
         * حجم البلاطة:
         * 256 هو الحجم القياسي.
         */
        tileSize: 256,

        /*
         * مستوى التكبير المتاح عادة في واجهة RainViewer.
         */
        maxNativeZoom: 7,

        maxZoom: 18,

        opacity: 0.72,

        zIndex: 450,

        attribution:
            "Radar © RainViewer",

        /*
         * لا نحول لون البلاطة إلى شدة رادارية داخل المتصفح
         * بسبب قيود CORS وعدم ثبات التحويل بين palettes.
         */
        allowPixelSampling: false
    },

    /* =====================================================
       INITIALIZATION
       ===================================================== */

    init() {
        if (this.initialized) {
            return;
        }

        this.initialized = true;

        console.log(
            `RG30 RainViewer Adapter ${this.version} initialized.`
        );

        window.dispatchEvent(
            new CustomEvent(
                "rg30:rainviewer-adapter-ready",
                {
                    detail: {
                        version: this.version,
                        endpoint:
                            this.config.metadataEndpoint,
                        timestamp:
                            new Date().toISOString()
                    }
                }
            )
        );
    },

    /* =====================================================
       CONFIGURATION
       ===================================================== */

    configure(options = {}) {
        if (
            !options ||
            typeof options !== "object"
        ) {
            return false;
        }

        this.config = {
            ...this.config,
            ...options
        };

        return true;
    },

    isConfigured() {
        return Boolean(
            this.config.enabled &&
            this.config.metadataEndpoint
        );
    },

    /* =====================================================
       MAIN COLLECTION
       ===================================================== */

    async collect(city = {}) {
        const normalizedCity =
            this.normalizeCity(city);

        if (!this.config.enabled) {
            return this.createUnavailableResult(
                normalizedCity,
                "DISABLED",
                "RainViewer adapter is disabled."
            );
        }

        if (!this.isConfigured()) {
            return this.createUnavailableResult(
                normalizedCity,
                "UNAVAILABLE",
                "RAINVIEWER_ENDPOINT_NOT_CONFIGURED"
            );
        }

        this.collecting = true;

        const startedAt =
            Date.now();

        this.lastRequestAt =
            new Date().toISOString();

        try {
            const metadata =
                await this.getMetadata();

            const frame =
                this.selectLatestFrame(
                    metadata
                );

            if (!frame) {
                throw new Error(
                    "RAINVIEWER_NO_RADAR_FRAME"
                );
            }

            this.latestFrame =
                frame;

            const host =
                metadata?.host ||
                "https://tilecache.rainviewer.com";

            const tileUrl =
                this.buildTileUrl(
                    host,
                    frame.path
                );

            const localRadar =
                this.extractLocalRadarSignal(
                    normalizedCity
                );

            const frameTimestamp =
                this.frameTimeToISO(
                    frame.time
                );

            const ageMinutes =
                this.calculateAgeMinutes(
                    frameTimestamp
                );

            const freshness =
                this.getFreshnessStatus(
                    ageMinutes
                );

            const availabilityConfidence =
                this.calculateAvailabilityConfidence({
                    ageMinutes,
                    frameCount:
                        this.countRadarFrames(
                            metadata
                        )
                });

            /*
             * ملاحظة مهمة:
             * لا نعتبر وجود الإطار دليلًا على وجود المطر.
             * rainDetected يعتمد فقط على بيانات رادارية محلية
             * موجودة فعلًا في city أو RadarEngine.
             */
            const rainDetected =
                localRadar.rainDetected;

            const intensity =
                localRadar.intensity;

            const movementConfidence =
                localRadar.movementConfidence;

            const rainProbability =
                this.calculateRadarProbability({
                    rainDetected,
                    intensity,
                    movementConfidence
                });

            const signalScore =
                this.calculateSignalScore({
                    rainDetected,
                    intensity,
                    movementConfidence,
                    ageMinutes
                });

            const result = {
                sourceKey:
                    "radar",

                sourceName:
                    "RainViewer Weather Radar",

                provider:
                    "RainViewer",

                available:
                    true,

                ok:
                    true,

                official:
                    false,

                status:
                    "AVAILABLE",

                city:
                    normalizedCity.name,

                lat:
                    normalizedCity.lat,

                lon:
                    normalizedCity.lon,

                region:
                    normalizedCity.region,

                timestamp:
                    frameTimestamp,

                ageMinutes,

                reliability:
                    this.config
                        .defaultReliability,

                trust:
                    this.config
                        .defaultReliability,

                /*
                 * لا يتم إنتاج احتمال مرتفع دون إشارة فعلية.
                 */
                rainProbability,

                /*
                 * RainViewer metadata لا يعيد كمية المطر
                 * عند نقطة محددة، لذلك نستخدم 0 ما لم توفر
                 * المدينة قراءة محلية.
                 */
                rainAmount:
                    localRadar.rainAmount,

                signalScore,

                confidence:
                    Math.round(
                        Math.min(
                            availabilityConfidence,
                            localRadar.confidence > 0
                                ? localRadar.confidence
                                : availabilityConfidence
                        )
                    ),

                warningLevel:
                    this.getWarningLevel({
                        rainDetected,
                        intensity,
                        rainProbability
                    }),

                details: {
                    rainDetected,

                    intensity,

                    movementConfidence,

                    direction:
                        localRadar.direction,

                    sourceOfPointSignal:
                        localRadar.source,

                    pointSignalAvailable:
                        localRadar.available,

                    radarFrameTime:
                        frameTimestamp,

                    radarFrameUnix:
                        this.safeNumber(
                            frame.time,
                            0
                        ),

                    framePath:
                        frame.path,

                    tileUrl,

                    host,

                    freshness,

                    frameAgeMinutes:
                        ageMinutes,

                    pastFrameCount:
                        Array.isArray(
                            metadata?.radar?.past
                        )
                            ? metadata.radar.past.length
                            : 0,

                    nowcastFrameCount:
                        Array.isArray(
                            metadata?.radar?.nowcast
                        )
                            ? metadata.radar.nowcast.length
                            : 0,

                    responseTimeMs:
                        Date.now() -
                        startedAt,

                    visualVerificationOnly:
                        !localRadar.available,

                    note:
                        localRadar.available
                            ? "Point radar signal was supplied by the local RainGuard radar layer."
                            : "RainViewer frame is available for visual verification; no point intensity was inferred from tiles."
                },

                tile: {
                    available:
                        true,

                    url:
                        tileUrl,

                    frameTime:
                        frameTimestamp,

                    opacity:
                        this.config.opacity,

                    attribution:
                        this.config.attribution
                },

                raw: {
                    frame,
                    generated:
                        metadata?.generated ||
                        null
                },

                error:
                    null
            };

            this.lastSuccessAt =
                new Date().toISOString();

            this.lastFailureAt =
                null;

            this.lastError =
                null;

            this.publishSuccess(
                result
            );

            return result;

        } catch (error) {
            this.lastFailureAt =
                new Date().toISOString();

            this.lastError =
                error?.message ||
                String(error);

            console.warn(
                "RG30 RainViewer Adapter request failed:",
                error
            );

            const failure =
                this.createUnavailableResult(
                    normalizedCity,
                    "UNAVAILABLE",
                    this.lastError
                );

            this.publishFailure(
                failure
            );

            return failure;

        } finally {
            this.collecting = false;
        }
    },

    /* =====================================================
       METADATA
       ===================================================== */

    async getMetadata({
        forceRefresh = false
    } = {}) {
        if (
            !forceRefresh &&
            this.isCacheValid()
        ) {
            return this.cache.metadata;
        }

        const response =
            await this.fetchWithTimeout(
                this.config
                    .metadataEndpoint,
                {
                    method:
                        "GET",

                    headers: {
                        Accept:
                            "application/json"
                    },

                    cache:
                        "no-store"
                },
                this.config.timeoutMs
            );

        if (!response.ok) {
            throw new Error(
                `RAINVIEWER_HTTP_${response.status}`
            );
        }

        const contentType =
            response.headers.get(
                "content-type"
            ) || "";

        if (
            !contentType.includes(
                "application/json"
            )
        ) {
            throw new Error(
                "RAINVIEWER_INVALID_CONTENT_TYPE"
            );
        }

        const metadata =
            await response.json();

        if (
            !metadata ||
            typeof metadata !== "object"
        ) {
            throw new Error(
                "RAINVIEWER_INVALID_METADATA"
            );
        }

        if (
            !metadata.radar ||
            !Array.isArray(
                metadata.radar.past
            )
        ) {
            throw new Error(
                "RAINVIEWER_RADAR_DATA_MISSING"
            );
        }

        this.lastMetadata =
            metadata;

        this.cache = {
            metadata,
            savedAt:
                Date.now()
        };

        return metadata;
    },

    isCacheValid() {
        if (
            !this.cache.metadata ||
            !this.cache.savedAt
        ) {
            return false;
        }

        const ageMs =
            Date.now() -
            this.cache.savedAt;

        const maxAgeMs =
            this.config.cacheMinutes *
            60 *
            1000;

        return ageMs <= maxAgeMs;
    },

    clearCache() {
        this.cache = {
            metadata: null,
            savedAt: 0
        };
    },

    countRadarFrames(metadata) {
        const pastCount =
            Array.isArray(
                metadata?.radar?.past
            )
                ? metadata.radar.past.length
                : 0;

        const nowcastCount =
            Array.isArray(
                metadata?.radar?.nowcast
            )
                ? metadata.radar.nowcast.length
                : 0;

        return (
            pastCount +
            nowcastCount
        );
    },

    selectLatestFrame(metadata) {
        const pastFrames =
            Array.isArray(
                metadata?.radar?.past
            )
                ? metadata.radar.past
                : [];

        const nowcastFrames =
            Array.isArray(
                metadata?.radar?.nowcast
            )
                ? metadata.radar.nowcast
                : [];

        /*
         * لأغراض التحقق من الواقع الحالي نفضل آخر إطار
         * مرصود من past، وليس nowcast المتوقع.
         */
        const observedFrames =
            pastFrames
                .filter(frame =>
                    frame &&
                    frame.path
                )
                .sort(
                    (a, b) =>
                        this.safeNumber(
                            a.time,
                            0
                        ) -
                        this.safeNumber(
                            b.time,
                            0
                        )
                );

        if (observedFrames.length) {
            return observedFrames[
                observedFrames.length - 1
            ];
        }

        const forecastFrames =
            nowcastFrames
                .filter(frame =>
                    frame &&
                    frame.path
                )
                .sort(
                    (a, b) =>
                        this.safeNumber(
                            a.time,
                            0
                        ) -
                        this.safeNumber(
                            b.time,
                            0
                        )
                );

        return forecastFrames.length
            ? forecastFrames[
                forecastFrames.length - 1
            ]
            : null;
    },

    getFrames(metadata = this.lastMetadata) {
        const past =
            Array.isArray(
                metadata?.radar?.past
            )
                ? metadata.radar.past
                : [];

        const nowcast =
            Array.isArray(
                metadata?.radar?.nowcast
            )
                ? metadata.radar.nowcast
                : [];

        return {
            past,
            nowcast,
            all: [
                ...past,
                ...nowcast
            ].sort(
                (a, b) =>
                    this.safeNumber(
                        a.time,
                        0
                    ) -
                    this.safeNumber(
                        b.time,
                        0
                    )
            )
        };
    },

    /* =====================================================
       TILE URL
       ===================================================== */

    buildTileUrl(
        host,
        framePath
    ) {
        const safeHost =
            String(
                host ||
                "https://tilecache.rainviewer.com"
            ).replace(
                /\/+$/,
                ""
            );

        const safePath =
            String(
                framePath || ""
            ).startsWith("/")
                ? String(framePath)
                : `/${String(framePath)}`;

        return (
            `${safeHost}` +
            `${safePath}` +
            `/${this.config.tileSize}` +
            `/{z}/{x}/{y}` +
            `/${this.config.colorScheme}` +
            `/${this.config.smooth}` +
            `_${this.config.snow}.png`
        );
    },

    getLatestTileUrl() {
        if (
            !this.lastMetadata ||
            !this.latestFrame
        ) {
            return null;
        }

        return this.buildTileUrl(
            this.lastMetadata.host,
            this.latestFrame.path
        );
    },

    /* =====================================================
       MAP LAYER
       ===================================================== */

    async attachToMap(
        map,
        options = {}
    ) {
        if (!window.L) {
            throw new Error(
                "LEAFLET_NOT_AVAILABLE"
            );
        }

        if (!map) {
            throw new Error(
                "MAP_NOT_AVAILABLE"
            );
        }

        const metadata =
            await this.getMetadata();

        const frame =
            this.selectLatestFrame(
                metadata
            );

        if (!frame) {
            throw new Error(
                "RAINVIEWER_NO_RADAR_FRAME"
            );
        }

        this.latestFrame =
            frame;

        const tileUrl =
            this.buildTileUrl(
                metadata.host,
                frame.path
            );

        this.detachFromMap();

        this.map =
            map;

        this.radarLayer =
            L.tileLayer(
                tileUrl,
                {
                    tileSize:
                        this.config.tileSize,

                    opacity:
                        this.safeNumber(
                            options.opacity,
                            this.config.opacity
                        ),

                    maxNativeZoom:
                        this.config.maxNativeZoom,

                    maxZoom:
                        this.config.maxZoom,

                    zIndex:
                        this.safeNumber(
                            options.zIndex,
                            this.config.zIndex
                        ),

                    attribution:
                        this.config.attribution
                }
            );

        this.radarLayer.addTo(
            map
        );

        window.dispatchEvent(
            new CustomEvent(
                "rg30:rainviewer-layer-attached",
                {
                    detail: {
                        frame,
                        tileUrl,
                        timestamp:
                            new Date().toISOString()
                    }
                }
            )
        );

        return this.radarLayer;
    },

    detachFromMap() {
        if (
            this.map &&
            this.radarLayer
        ) {
            try {
                this.map.removeLayer(
                    this.radarLayer
                );
            } catch (error) {
                console.warn(
                    "RG30 RainViewer layer removal skipped:",
                    error
                );
            }
        }

        this.radarLayer =
            null;

        this.map =
            null;
    },

    async refreshMapLayer(
        map = this.map
    ) {
        if (!map) {
            return null;
        }

        await this.getMetadata({
            forceRefresh: true
        });

        return this.attachToMap(
            map
        );
    },

    setOpacity(value) {
        const opacity =
            this.clamp(
                value,
                0,
                1
            );

        this.config.opacity =
            opacity;

        if (
            this.radarLayer &&
            typeof this.radarLayer
                .setOpacity === "function"
        ) {
            this.radarLayer.setOpacity(
                opacity
            );
        }

        return opacity;
    },

    /* =====================================================
       LOCAL RADAR SIGNAL
       ===================================================== */

    extractLocalRadarSignal(city) {
        const directRadar =
            city.radarData ||
            city.radar ||
            {};

        const engineRadar =
            this.getRadarEngineCityData(
                city
            );

        const source =
            this.hasRadarMeasurements(
                directRadar
            )
                ? directRadar
                : engineRadar;

        const available =
            this.hasRadarMeasurements(
                source
            );

        const intensity =
            this.clamp(
                this.firstNumber(
                    source?.intensity,
                    source?.radarIntensity,
                    source?.rainIntensity,
                    source?.reflectivity,
                    city.radarIntensity
                ),
                0,
                100
            );

        const movementConfidence =
            this.clamp(
                this.firstNumber(
                    source?.movementConfidence,
                    source?.motionConfidence,
                    city.radarMovementConfidence
                ),
                0,
                100
            );

        const rainAmount =
            this.clamp(
                this.firstNumber(
                    source?.rainAmount,
                    source?.precipitation,
                    source?.accumulation,
                    city.radarRainAmount
                ),
                0,
                1000
            );

        const explicitRainDetected =
            source?.rainDetected;

        const rainDetected =
            explicitRainDetected === true ||
            intensity > 5 ||
            rainAmount > 0;

        const confidence =
            this.clamp(
                this.firstNumber(
                    source?.confidence,
                    movementConfidence,
                    available
                        ? 65
                        : 0
                ),
                0,
                100
            );

        return {
            available,

            rainDetected,

            intensity,

            movementConfidence,

            rainAmount,

            direction:
                source?.direction ||
                source?.movementDirection ||
                "--",

            confidence,

            source:
                source === directRadar
                    ? "CITY_RADAR_DATA"
                    : available
                        ? "RG23_RADAR_ENGINE"
                        : "VISUAL_TILE_ONLY"
        };
    },

    getRadarEngineCityData(city) {
        const engine =
            window.RG23?.RadarEngine ||
            window.RG30?.RadarEngine ||
            null;

        if (!engine) {
            return {};
        }

        const normalizedName =
            String(
                city.name || ""
            ).trim()
                .toLowerCase();

        const collections = [
            engine.latestCities,
            engine.results,
            engine.cityResults,
            engine.latestResults,
            engine.radarCities
        ];

        for (
            const collection of collections
        ) {
            if (
                !Array.isArray(
                    collection
                )
            ) {
                continue;
            }

            const match =
                collection.find(item => {
                    const itemName =
                        String(
                            item?.name ||
                            item?.city ||
                            item?.cityName ||
                            ""
                        )
                            .trim()
                            .toLowerCase();

                    return (
                        itemName ===
                        normalizedName
                    );
                });

            if (match) {
                return (
                    match.radarData ||
                    match.radar ||
                    match
                );
            }
        }

        if (
            typeof engine.getCityRadarData ===
            "function"
        ) {
            try {
                return (
                    engine.getCityRadarData(
                        city.name
                    ) || {}
                );
            } catch (error) {
                console.warn(
                    "RG30 RainViewer: getCityRadarData failed.",
                    error
                );
            }
        }

        return {};
    },

    hasRadarMeasurements(data) {
        if (
            !data ||
            typeof data !== "object"
        ) {
            return false;
        }

        return Boolean(
            data.available === true ||
            data.rainDetected === true ||
            this.firstNumber(
                data.intensity,
                data.radarIntensity,
                data.rainIntensity,
                data.reflectivity,
                data.rainAmount,
                data.precipitation
            ) > 0
        );
    },

    /* =====================================================
       SCORES
       ===================================================== */

    calculateRadarProbability({
        rainDetected,
        intensity,
        movementConfidence
    }) {
        if (!rainDetected) {
            return 0;
        }

        return Math.round(
            this.clamp(
                20 +
                intensity * 0.55 +
                movementConfidence * 0.25,
                0,
                100
            )
        );
    },

    calculateSignalScore({
        rainDetected,
        intensity,
        movementConfidence,
        ageMinutes
    }) {
        if (!rainDetected) {
            return 0;
        }

        const freshnessScore =
            this.calculateFreshnessScore(
                ageMinutes
            );

        return Math.round(
            this.clamp(
                intensity * 0.55 +
                movementConfidence * 0.20 +
                freshnessScore * 0.15 +
                10,
                0,
                100
            )
        );
    },

    calculateAvailabilityConfidence({
        ageMinutes,
        frameCount
    }) {
        const freshnessScore =
            this.calculateFreshnessScore(
                ageMinutes
            );

        const coverageScore =
            this.clamp(
                frameCount / 12 * 100,
                0,
                100
            );

        return Math.round(
            this.clamp(
                this.config
                    .defaultReliability *
                    100 *
                    0.50 +
                freshnessScore *
                    0.30 +
                coverageScore *
                    0.20,
                0,
                100
            )
        );
    },

    calculateFreshnessScore(
        ageMinutes
    ) {
        const age =
            this.safeNumber(
                ageMinutes,
                999
            );

        if (age <= 10) {
            return 100;
        }

        if (age <= 20) {
            return 85;
        }

        if (age <= 30) {
            return 70;
        }

        if (age <= 60) {
            return 45;
        }

        if (age <= 120) {
            return 20;
        }

        return 0;
    },

    getFreshnessStatus(
        ageMinutes
    ) {
        const age =
            this.safeNumber(
                ageMinutes,
                999
            );

        if (age <= 10) {
            return "FRESH";
        }

        if (age <= 30) {
            return "ACCEPTABLE";
        }

        if (age <= 60) {
            return "STALE";
        }

        return "EXPIRED";
    },

    getWarningLevel({
        rainDetected,
        intensity,
        rainProbability
    }) {
        if (!rainDetected) {
            return "NORMAL";
        }

        if (
            intensity >= 75 ||
            rainProbability >= 85
        ) {
            return "EMERGENCY";
        }

        if (
            intensity >= 50 ||
            rainProbability >= 65
        ) {
            return "WARNING";
        }

        if (
            intensity >= 20 ||
            rainProbability >= 35
        ) {
            return "WATCH";
        }

        return "NORMAL";
    },

    /* =====================================================
       UNAVAILABLE RESULT
       ===================================================== */

    createUnavailableResult(
        city,
        status,
        error
    ) {
        return {
            sourceKey:
                "radar",

            sourceName:
                "RainViewer Weather Radar",

            provider:
                "RainViewer",

            available:
                false,

            ok:
                false,

            official:
                false,

            status:
                status ||
                "UNAVAILABLE",

            city:
                city.name,

            lat:
                city.lat,

            lon:
                city.lon,

            region:
                city.region,

            timestamp:
                new Date().toISOString(),

            ageMinutes:
                0,

            reliability:
                0,

            trust:
                0,

            rainProbability:
                0,

            rainAmount:
                0,

            signalScore:
                0,

            confidence:
                0,

            warningLevel:
                "UNKNOWN",

            details: {
                rainDetected:
                    false,

                intensity:
                    0,

                movementConfidence:
                    0,

                pointSignalAvailable:
                    false,

                visualVerificationOnly:
                    false
            },

            tile: {
                available:
                    false,

                url:
                    null
            },

            raw:
                null,

            error:
                error ||
                "RAINVIEWER_UNAVAILABLE"
        };
    },

    /* =====================================================
       EVENTS
       ===================================================== */

    publishSuccess(result) {
        window.dispatchEvent(
            new CustomEvent(
                "rg30:rainviewer-data-received",
                {
                    detail:
                        result
                }
            )
        );
    },

    publishFailure(result) {
        window.dispatchEvent(
            new CustomEvent(
                "rg30:rainviewer-data-failed",
                {
                    detail:
                        result
                }
            )
        );
    },

    /* =====================================================
       STATE
       ===================================================== */

    getState() {
        return {
            version:
                this.version,

            initialized:
                this.initialized,

            enabled:
                this.config.enabled,

            configured:
                this.isConfigured(),

            collecting:
                this.collecting,

            lastRequestAt:
                this.lastRequestAt,

            lastSuccessAt:
                this.lastSuccessAt,

            lastFailureAt:
                this.lastFailureAt,

            lastError:
                this.lastError,

            cacheValid:
                this.isCacheValid(),

            latestFrame:
                this.latestFrame,

            radarLayerAttached:
                Boolean(
                    this.radarLayer
                ),

            mapAttached:
                Boolean(
                    this.map
                )
        };
    },

    /* =====================================================
       HELPERS
       ===================================================== */

    normalizeCity(city = {}) {
        return {
            ...city,

            name:
                city.name ||
                city.city ||
                city.cityName ||
                "Unknown",

            region:
                city.region ||
                city.area ||
                city.name ||
                "Unknown",

            lat:
                this.safeNumber(
                    city.lat ??
                    city.latitude,
                    24
                ),

            lon:
                this.safeNumber(
                    city.lon ??
                    city.lng ??
                    city.longitude,
                    45
                )
        };
    },

    safeNumber(
        value,
        fallback = 0
    ) {
        const number =
            Number(value);

        return Number.isFinite(
            number
        )
            ? number
            : fallback;
    },

    firstNumber(...values) {
        for (
            const value of values
        ) {
            const number =
                Number(value);

            if (
                Number.isFinite(
                    number
                )
            ) {
                return number;
            }
        }

        return 0;
    },

    clamp(
        value,
        min = 0,
        max = 100
    ) {
        const number =
            this.safeNumber(
                value,
                min
            );

        return Math.min(
            max,
            Math.max(
                min,
                number
            )
        );
    },

    frameTimeToISO(
        unixTime
    ) {
        const value =
            this.safeNumber(
                unixTime,
                0
            );

        if (!value) {
            return new Date()
                .toISOString();
        }

        return new Date(
            value * 1000
        ).toISOString();
    },

    calculateAgeMinutes(
        timestamp
    ) {
        const time =
            new Date(timestamp)
                .getTime();

        if (
            !Number.isFinite(
                time
            )
        ) {
            return 0;
        }

        return Math.max(
            0,
            Math.round(
                (
                    Date.now() -
                    time
                ) /
                60000
            )
        );
    },

    fetchWithTimeout(
        url,
        options,
        timeoutMs
    ) {
        const controller =
            new AbortController();

        const timeout =
            setTimeout(
                () => {
                    controller.abort();
                },
                timeoutMs
            );

        return fetch(
            url,
            {
                ...options,
                signal:
                    controller.signal
            }
        ).finally(() => {
            clearTimeout(
                timeout
            );
        });
    }
};

/* =========================================================
   INITIALIZATION
   ========================================================= */

if (
    document.readyState === "loading"
) {
    document.addEventListener(
        "DOMContentLoaded",
        () => {
            RG30.RainViewerAdapter.init();
        },
        {
            once: true
        }
    );
} else {
    RG30.RainViewerAdapter.init();
}
