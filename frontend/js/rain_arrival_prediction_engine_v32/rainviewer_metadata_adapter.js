/* ============================================================================
 * RainGuard AI V32
 * Phase 40A — RainViewer AI Integration
 * File: rainviewer_metadata_adapter.js
 * Version: 40A.1.0
 *
 * Purpose:
 *   Reliable RainViewer Weather Maps metadata adapter for RainGuard AI.
 *
 * Responsibilities:
 *   - Fetch RainViewer weather-maps metadata.
 *   - Validate and normalize radar frames.
 *   - Cache metadata to reduce external requests.
 *   - Apply timeout + retry strategy.
 *   - Detect stale / unavailable radar feeds.
 *   - Generate safe radar tile URLs.
 *   - Publish status/events for downstream RainGuard engines.
 *
 * IMPORTANT:
 *   RainViewer public API no longer supplies future nowcast frames.
 *   RainGuard must generate its own motion / ETA / extrapolation from
 *   historical radar frames.
 * ========================================================================== */

(function (global) {
    "use strict";

    const ENGINE_NAME = "RainViewerMetadataAdapter";
    const ENGINE_VERSION = "40A.1.0";
    const PHASE = "40A";

    const DEFAULT_CONFIG = Object.freeze({
        endpoint: "https://api.rainviewer.com/public/weather-maps.json",

        requestTimeoutMs: 10000,

        retryCount: 2,

        retryDelayMs: 1000,

        cacheTtlMs: 60000,

        staleAfterMs: 20 * 60 * 1000,

        minimumFrames: 2,

        tileSize: 256,

        maxZoom: 7,

        colorScheme: 2,

        smooth: 1,

        snow: 1,

        debug: true
    });


    /* ========================================================================
     * Utility helpers
     * ===================================================================== */

    function nowMs() {
        return Date.now();
    }


    function sleep(ms) {
        return new Promise(function (resolve) {
            setTimeout(resolve, ms);
        });
    }


    function safeNumber(value, fallback = null) {
        const n = Number(value);

        return Number.isFinite(n)
            ? n
            : fallback;
    }


    function cloneObject(value) {
        if (value === undefined) {
            return undefined;
        }

        try {
            return JSON.parse(
                JSON.stringify(value)
            );
        } catch (_) {
            return value;
        }
    }


    function normalizeHost(host) {

        if (
            typeof host !== "string" ||
            !host.trim()
        ) {
            return null;
        }

        return host
            .trim()
            .replace(/\/+$/, "");
    }


    function normalizePath(path) {

        if (
            typeof path !== "string" ||
            !path.trim()
        ) {
            return null;
        }

        const clean = path.trim();

        return clean.startsWith("/")
            ? clean
            : "/" + clean;
    }


    function normalizeTimestamp(value) {

        const timestamp = safeNumber(
            value,
            null
        );

        if (
            timestamp === null ||
            timestamp <= 0
        ) {
            return null;
        }

        return Math.floor(timestamp);
    }


    function timestampToISO(timestamp) {

        if (!timestamp) {
            return null;
        }

        try {
            return new Date(
                timestamp * 1000
            ).toISOString();

        } catch (_) {

            return null;
        }
    }


    function isValidLatitude(latitude) {

        return (
            Number.isFinite(latitude) &&
            latitude >= -90 &&
            latitude <= 90
        );
    }


    function isValidLongitude(longitude) {

        return (
            Number.isFinite(longitude) &&
            longitude >= -180 &&
            longitude <= 180
        );
    }


    function dispatchGlobalEvent(
        eventName,
        detail
    ) {

        try {

            if (
                typeof global.dispatchEvent !== "function" ||
                typeof global.CustomEvent !== "function"
            ) {
                return;
            }

            global.dispatchEvent(
                new global.CustomEvent(
                    eventName,
                    {
                        detail
                    }
                )
            );

        } catch (_) {
            // Event system must never break the adapter.
        }
    }


    /* ========================================================================
     * Main Adapter
     * ===================================================================== */

    class RainViewerMetadataAdapter {

        constructor(config = {}) {

            this.name = ENGINE_NAME;

            this.version = ENGINE_VERSION;

            this.phase = PHASE;

            this.config = {
                ...DEFAULT_CONFIG,
                ...config
            };


            this.state = {

                initialized: false,

                loading: false,

                ready: false,

                destroyed: false,

                lastFetchStartedAt: null,

                lastFetchCompletedAt: null,

                lastSuccessAt: null,

                lastFailureAt: null,

                lastError: null,

                requestCount: 0,

                successCount: 0,

                failureCount: 0,

                cacheHitCount: 0,

                radarAvailable: false,

                radarStale: true,

                frameCount: 0,

                latestFrameTime: null,

                oldestFrameTime: null
            };


            this.cache = {

                data: null,

                createdAt: 0,

                expiresAt: 0
            };


            this.activeRequest = null;


            this.log(
                "constructed",
                {
                    version: this.version
                }
            );
        }


        /* ====================================================================
         * Logging
         * ================================================================= */

        log(message, data = undefined) {

            if (!this.config.debug) {
                return;
            }

            const prefix =
                `[RainGuard][Phase ${this.phase}][${this.name}]`;

            if (data !== undefined) {

                console.log(
                    prefix,
                    message,
                    data
                );

            } else {

                console.log(
                    prefix,
                    message
                );
            }
        }


        warn(message, data = undefined) {

            const prefix =
                `[RainGuard][Phase ${this.phase}][${this.name}]`;

            if (data !== undefined) {

                console.warn(
                    prefix,
                    message,
                    data
                );

            } else {

                console.warn(
                    prefix,
                    message
                );
            }
        }


        error(message, data = undefined) {

            const prefix =
                `[RainGuard][Phase ${this.phase}][${this.name}]`;

            if (data !== undefined) {

                console.error(
                    prefix,
                    message,
                    data
                );

            } else {

                console.error(
                    prefix,
                    message
                );
            }
        }


        /* ====================================================================
         * Initialization
         * ================================================================= */

        async initialize(options = {}) {

            if (this.state.destroyed) {

                throw new Error(
                    `${ENGINE_NAME} is destroyed.`
                );
            }


            if (this.state.initialized) {

                return this.getStatus();
            }


            this.state.initialized = true;


            this.log(
                "initializing..."
            );


            dispatchGlobalEvent(
                "rainguard:rainviewer:initializing",
                {
                    engine: ENGINE_NAME,
                    version: ENGINE_VERSION
                }
            );


            if (
                options.fetchImmediately !== false
            ) {

                try {

                    await this.fetchMetadata({
                        force: true
                    });

                } catch (error) {

                    this.warn(
                        "Initial metadata fetch failed.",
                        error
                    );
                }
            }


            this.log(
                "initialized"
            );


            return this.getStatus();
        }


        /* ====================================================================
         * Cache
         * ================================================================= */

        isCacheValid() {

            if (!this.cache.data) {
                return false;
            }

            return nowMs() <
                this.cache.expiresAt;
        }


        clearCache() {

            this.cache.data = null;

            this.cache.createdAt = 0;

            this.cache.expiresAt = 0;


            this.log(
                "cache cleared"
            );
        }


        getCachedMetadata() {

            if (!this.isCacheValid()) {
                return null;
            }


            this.state.cacheHitCount += 1;


            return cloneObject(
                this.cache.data
            );
        }


        setCache(data) {

            const createdAt = nowMs();


            this.cache.data =
                cloneObject(data);

            this.cache.createdAt =
                createdAt;

            this.cache.expiresAt =
                createdAt +
                this.config.cacheTtlMs;
        }


        /* ====================================================================
         * HTTP
         * ================================================================= */

        async fetchWithTimeout(
            url,
            timeoutMs
        ) {

            const controller =
                new AbortController();


            const timeoutId =
                setTimeout(
                    function () {

                        controller.abort();

                    },
                    timeoutMs
                );


            try {

                const response =
                    await fetch(
                        url,
                        {
                            method: "GET",

                            headers: {
                                Accept:
                                    "application/json"
                            },

                            cache: "no-store",

                            signal:
                                controller.signal
                        }
                    );


                if (!response.ok) {

                    throw new Error(
                        `RainViewer HTTP ${response.status}`
                    );
                }


                return await response.json();

            } finally {

                clearTimeout(
                    timeoutId
                );
            }
        }


        async requestMetadata() {

            let lastError = null;


            const maximumAttempts =
                this.config.retryCount + 1;


            for (
                let attempt = 1;
                attempt <= maximumAttempts;
                attempt++
            ) {

                this.state.requestCount += 1;


                try {

                    this.log(
                        `request attempt ${attempt}/${maximumAttempts}`
                    );


                    const raw =
                        await this.fetchWithTimeout(
                            this.config.endpoint,
                            this.config.requestTimeoutMs
                        );


                    return raw;

                } catch (error) {

                    lastError = error;


                    if (
                        attempt >= maximumAttempts
                    ) {
                        break;
                    }


                    const delay =
                        this.config.retryDelayMs *
                        attempt;


                    this.warn(
                        `request failed; retrying in ${delay} ms`,
                        error
                    );


                    await sleep(delay);
                }
            }


            throw (
                lastError ||
                new Error(
                    "RainViewer metadata request failed."
                )
            );
        }


        /* ====================================================================
         * Validation
         * ================================================================= */

        validateRoot(raw) {

            if (
                !raw ||
                typeof raw !== "object"
            ) {

                throw new Error(
                    "RAINVIEWER_INVALID_RESPONSE"
                );
            }


            const host =
                normalizeHost(
                    raw.host
                );


            if (!host) {

                throw new Error(
                    "RAINVIEWER_HOST_MISSING"
                );
            }


            if (
                !raw.radar ||
                typeof raw.radar !== "object"
            ) {

                throw new Error(
                    "RAINVIEWER_RADAR_OBJECT_MISSING"
                );
            }


            if (
                !Array.isArray(
                    raw.radar.past
                )
            ) {

                throw new Error(
                    "RAINVIEWER_RADAR_PAST_MISSING"
                );
            }


            return true;
        }


        normalizeFrame(
            frame,
            host,
            index
        ) {

            if (
                !frame ||
                typeof frame !== "object"
            ) {
                return null;
            }


            const time =
                normalizeTimestamp(
                    frame.time
                );


            const path =
                normalizePath(
                    frame.path
                );


            if (
                !time ||
                !path
            ) {
                return null;
            }


            return {

                id:
                    `rainviewer-${time}`,

                provider:
                    "rainviewer",

                sourceType:
                    "radar",

                sequence:
                    index,

                time,

                timestampMs:
                    time * 1000,

                isoTime:
                    timestampToISO(time),

                path,

                host,

                baseUrl:
                    host + path
            };
        }


        normalizeMetadata(raw) {

            this.validateRoot(raw);


            const host =
                normalizeHost(
                    raw.host
                );


            const frames =
                raw.radar.past
                    .map(
                        (frame, index) =>
                            this.normalizeFrame(
                                frame,
                                host,
                                index
                            )
                    )
                    .filter(Boolean)
                    .sort(
                        (a, b) =>
                            a.time - b.time
                    );


            const uniqueFrames = [];

            const knownTimes =
                new Set();


            for (
                const frame
                of frames
            ) {

                if (
                    knownTimes.has(
                        frame.time
                    )
                ) {
                    continue;
                }


                knownTimes.add(
                    frame.time
                );


                uniqueFrames.push(
                    frame
                );
            }


            const oldestFrame =
                uniqueFrames.length
                    ? uniqueFrames[0]
                    : null;


            const latestFrame =
                uniqueFrames.length
                    ? uniqueFrames[
                        uniqueFrames.length - 1
                    ]
                    : null;


            const generated =
                normalizeTimestamp(
                    raw.generated
                );


            const latestAgeMs =
                latestFrame
                    ? Math.max(
                        0,
                        nowMs() -
                        latestFrame.timestampMs
                    )
                    : null;


            const stale =
                latestAgeMs === null
                    ? true
                    : latestAgeMs >
                        this.config.staleAfterMs;


            const available =
                uniqueFrames.length >=
                this.config.minimumFrames;


            const intervalsMinutes = [];


            for (
                let i = 1;
                i < uniqueFrames.length;
                i++
            ) {

                const deltaSeconds =
                    uniqueFrames[i].time -
                    uniqueFrames[i - 1].time;


                intervalsMinutes.push(
                    deltaSeconds / 60
                );
            }


            const averageIntervalMinutes =
                intervalsMinutes.length
                    ? (
                        intervalsMinutes.reduce(
                            (sum, value) =>
                                sum + value,
                            0
                        ) /
                        intervalsMinutes.length
                    )
                    : null;


            return {

                provider:
                    "rainviewer",

                adapterVersion:
                    ENGINE_VERSION,

                apiVersion:
                    raw.version || null,

                generated,

                generatedISO:
                    timestampToISO(
                        generated
                    ),

                host,

                radar: {

                    available,

                    stale,

                    frameCount:
                        uniqueFrames.length,

                    oldestFrameTime:
                        oldestFrame
                            ? oldestFrame.time
                            : null,

                    oldestFrameISO:
                        oldestFrame
                            ? oldestFrame.isoTime
                            : null,

                    latestFrameTime:
                        latestFrame
                            ? latestFrame.time
                            : null,

                    latestFrameISO:
                        latestFrame
                            ? latestFrame.isoTime
                            : null,

                    latestFrameAgeMs:
                        latestAgeMs,

                    latestFrameAgeMinutes:
                        latestAgeMs !== null
                            ? latestAgeMs /
                                60000
                            : null,

                    averageIntervalMinutes,

                    frames:
                        uniqueFrames
                },

                capabilities: {

                    historicalRadar:
                        true,

                    publicNowcast:
                        false,

                    publicSatellite:
                        false,

                    tileGeneration:
                        true,

                    motionAnalysisInput:
                        uniqueFrames.length >= 2,

                    aiExtrapolationInput:
                        uniqueFrames.length >= 2
                },

                fetchedAt:
                    nowMs(),

                fetchedAtISO:
                    new Date().toISOString()
            };
        }


        /* ====================================================================
         * Fetch Metadata
         * ================================================================= */

        async fetchMetadata(
            options = {}
        ) {

            if (this.state.destroyed) {

                throw new Error(
                    `${ENGINE_NAME} is destroyed.`
                );
            }


            const force =
                options.force === true;


            if (!force) {

                const cached =
                    this.getCachedMetadata();


                if (cached) {

                    this.log(
                        "metadata served from cache"
                    );


                    return cached;
                }
            }


            if (this.activeRequest) {

                this.log(
                    "joining active metadata request"
                );


                return this.activeRequest;
            }


            this.state.loading = true;

            this.state.lastFetchStartedAt =
                nowMs();


            this.activeRequest =
                this.performFetchMetadata();


            try {

                return await this.activeRequest;

            } finally {

                this.activeRequest = null;

                this.state.loading = false;
            }
        }


        async performFetchMetadata() {

            try {

                const raw =
                    await this.requestMetadata();


                const metadata =
                    this.normalizeMetadata(
                        raw
                    );


                this.setCache(
                    metadata
                );


                this.applySuccessState(
                    metadata
                );


                this.log(
                    "metadata ready",
                    {
                        frameCount:
                            metadata.radar.frameCount,

                        latestFrame:
                            metadata.radar.latestFrameISO,

                        stale:
                            metadata.radar.stale,

                        averageIntervalMinutes:
                            metadata.radar.averageIntervalMinutes
                    }
                );


                dispatchGlobalEvent(
                    "rainguard:rainviewer:metadata-ready",
                    cloneObject(
                        metadata
                    )
                );


                return cloneObject(
                    metadata
                );

            } catch (error) {

                this.applyFailureState(
                    error
                );


                this.error(
                    "metadata fetch failed",
                    error
                );


                dispatchGlobalEvent(
                    "rainguard:rainviewer:error",
                    {
                        engine:
                            ENGINE_NAME,

                        version:
                            ENGINE_VERSION,

                        message:
                            error &&
                            error.message
                                ? error.message
                                : String(error),

                        timestamp:
                            nowMs()
                    }
                );


                throw error;
            }
        }


        /* ====================================================================
         * State
         * ================================================================= */

        applySuccessState(
            metadata
        ) {

            const timestamp =
                nowMs();


            this.state.ready =
                metadata.radar.available;

            this.state.radarAvailable =
                metadata.radar.available;

            this.state.radarStale =
                metadata.radar.stale;

            this.state.frameCount =
                metadata.radar.frameCount;

            this.state.latestFrameTime =
                metadata.radar.latestFrameTime;

            this.state.oldestFrameTime =
                metadata.radar.oldestFrameTime;

            this.state.successCount += 1;

            this.state.lastSuccessAt =
                timestamp;

            this.state.lastFetchCompletedAt =
                timestamp;

            this.state.lastError =
                null;
        }


        applyFailureState(
            error
        ) {

            const timestamp =
                nowMs();


            this.state.ready = false;

            this.state.failureCount += 1;

            this.state.lastFailureAt =
                timestamp;

            this.state.lastFetchCompletedAt =
                timestamp;

            this.state.lastError = {

                name:
                    error &&
                    error.name
                        ? error.name
                        : "Error",

                message:
                    error &&
                    error.message
                        ? error.message
                        : String(error),

                timestamp
            };
        }


        /* ====================================================================
         * Frame Access
         * ================================================================= */

        getLatestFrame() {

            if (!this.cache.data) {
                return null;
            }


            const frames =
                this.cache.data.radar.frames;


            if (!frames.length) {
                return null;
            }


            return cloneObject(
                frames[
                    frames.length - 1
                ]
            );
        }


        getOldestFrame() {

            if (!this.cache.data) {
                return null;
            }


            const frames =
                this.cache.data.radar.frames;


            if (!frames.length) {
                return null;
            }


            return cloneObject(
                frames[0]
            );
        }


        getFrames() {

            if (!this.cache.data) {
                return [];
            }


            return cloneObject(
                this.cache.data.radar.frames
            );
        }


        getRecentFrames(
            count = 6
        ) {

            const frames =
                this.getFrames();


            const safeCount =
                Math.max(
                    1,
                    Math.floor(
                        safeNumber(
                            count,
                            6
                        )
                    )
                );


            return frames.slice(
                -safeCount
            );
        }


        /* ====================================================================
         * Radar Tile URL Builder
         * ================================================================= */

        buildTileUrl(
            frame,
            options = {}
        ) {

            if (
                !frame ||
                !frame.host ||
                !frame.path
            ) {

                throw new Error(
                    "RAINVIEWER_INVALID_FRAME"
                );
            }


            const size =
                options.size === 512
                    ? 512
                    : 256;


            const zoom =
                Math.min(
                    this.config.maxZoom,
                    Math.max(
                        0,
                        Math.floor(
                            safeNumber(
                                options.zoom,
                                6
                            )
                        )
                    )
                );


            const color =
                Math.max(
                    0,
                    Math.floor(
                        safeNumber(
                            options.colorScheme,
                            this.config.colorScheme
                        )
                    )
                );


            const smooth =
                options.smooth === 0
                    ? 0
                    : 1;


            const snow =
                options.snow === 0
                    ? 0
                    : 1;


            const base =
                normalizeHost(
                    frame.host
                ) +
                normalizePath(
                    frame.path
                );


            /*
             * Coordinate-centered RainViewer tile.
             */
            if (
                options.latitude !== undefined &&
                options.longitude !== undefined
            ) {

                const latitude =
                    Number(
                        options.latitude
                    );


                const longitude =
                    Number(
                        options.longitude
                    );


                if (
                    !isValidLatitude(
                        latitude
                    ) ||
                    !isValidLongitude(
                        longitude
                    )
                ) {

                    throw new Error(
                        "RAINVIEWER_INVALID_COORDINATES"
                    );
                }


                return (
                    `${base}/` +
                    `${size}/` +
                    `${zoom}/` +
                    `${latitude}/` +
                    `${longitude}/` +
                    `${color}/` +
                    `${smooth}_${snow}.png`
                );
            }


            /*
             * Standard XYZ map tile.
             */
            const x =
                Math.floor(
                    safeNumber(
                        options.x,
                        0
                    )
                );


            const y =
                Math.floor(
                    safeNumber(
                        options.y,
                        0
                    )
                );


            return (
                `${base}/` +
                `${size}/` +
                `${zoom}/` +
                `${x}/` +
                `${y}/` +
                `${color}/` +
                `${smooth}_${snow}.png`
            );
        }


        buildCoordinateTileUrl(
            latitude,
            longitude,
            options = {}
        ) {

            const frame =
                options.frame ||
                this.getLatestFrame();


            if (!frame) {

                throw new Error(
                    "RAINVIEWER_NO_FRAME_AVAILABLE"
                );
            }


            return this.buildTileUrl(
                frame,
                {
                    ...options,

                    latitude,

                    longitude
                }
            );
        }


        /* ====================================================================
         * Health / Status
         * ================================================================= */

        getHealth() {

            let health =
                "UNAVAILABLE";


            if (
                this.state.radarAvailable &&
                !this.state.radarStale
            ) {

                health =
                    "HEALTHY";

            } else if (
                this.state.radarAvailable &&
                this.state.radarStale
            ) {

                health =
                    "STALE";

            } else if (
                this.state.loading
            ) {

                health =
                    "LOADING";
            }


            return {

                provider:
                    "rainviewer",

                health,

                ready:
                    this.state.ready,

                available:
                    this.state.radarAvailable,

                stale:
                    this.state.radarStale,

                frameCount:
                    this.state.frameCount,

                latestFrameTime:
                    this.state.latestFrameTime,

                latestFrameISO:
                    timestampToISO(
                        this.state.latestFrameTime
                    ),

                lastSuccessAt:
                    this.state.lastSuccessAt,

                lastFailureAt:
                    this.state.lastFailureAt
            };
        }


        getStatus() {

            return cloneObject({

                engine:
                    this.name,

                phase:
                    this.phase,

                version:
                    this.version,

                initialized:
                    this.state.initialized,

                ready:
                    this.state.ready,

                loading:
                    this.state.loading,

                destroyed:
                    this.state.destroyed,

                state:
                    this.state,

                cache: {

                    available:
                        Boolean(
                            this.cache.data
                        ),

                    valid:
                        this.isCacheValid(),

                    createdAt:
                        this.cache.createdAt,

                    expiresAt:
                        this.cache.expiresAt
                },

                health:
                    this.getHealth()
            });
        }


        /* ====================================================================
         * Diagnostics
         * ================================================================= */

        async selfTest() {

            const report = {

                engine:
                    ENGINE_NAME,

                version:
                    ENGINE_VERSION,

                phase:
                    PHASE,

                passed:
                    false,

                checks: {},

                metadata: null,

                error: null,

                timestamp:
                    new Date().toISOString()
            };


            try {

                report.checks.instance =
                    true;


                const metadata =
                    await this.fetchMetadata({
                        force: true
                    });


                report.checks.http =
                    Boolean(metadata);


                report.checks.host =
                    Boolean(
                        metadata.host
                    );


                report.checks.radarObject =
                    Boolean(
                        metadata.radar
                    );


                report.checks.frames =
                    metadata.radar.frameCount >=
                    this.config.minimumFrames;


                report.checks.latestFrame =
                    Boolean(
                        metadata.radar.latestFrameTime
                    );


                const latestFrame =
                    this.getLatestFrame();


                report.checks.frameRetrieval =
                    Boolean(
                        latestFrame
                    );


                if (latestFrame) {

                    const tileUrl =
                        this.buildCoordinateTileUrl(
                            21.543333,
                            39.172778,
                            {
                                zoom: 6
                            }
                        );


                    report.checks.tileUrl =
                        typeof tileUrl === "string" &&
                        tileUrl.includes(
                            ".png"
                        );

                } else {

                    report.checks.tileUrl =
                        false;
                }


                report.metadata = {

                    apiVersion:
                        metadata.apiVersion,

                    generatedISO:
                        metadata.generatedISO,

                    frameCount:
                        metadata.radar.frameCount,

                    latestFrameISO:
                        metadata.radar.latestFrameISO,

                    oldestFrameISO:
                        metadata.radar.oldestFrameISO,

                    averageIntervalMinutes:
                        metadata.radar.averageIntervalMinutes,

                    stale:
                        metadata.radar.stale
                };


                report.passed =
                    Object.values(
                        report.checks
                    ).every(Boolean);


            } catch (error) {

                report.error = {

                    name:
                        error.name ||
                        "Error",

                    message:
                        error.message ||
                        String(error)
                };


                report.passed =
                    false;
            }


            if (report.passed) {

                console.log(
                    "%c[RainGuard Phase 40A] RainViewer Metadata Adapter SELF TEST PASSED",
                    "font-weight:bold;color:#16a34a;",
                    report
                );

            } else {

                console.error(
                    "[RainGuard Phase 40A] RainViewer Metadata Adapter SELF TEST FAILED",
                    report
                );
            }


            return report;
        }


        /* ====================================================================
         * Destroy
         * ================================================================= */

        destroy() {

            this.clearCache();


            this.activeRequest =
                null;


            this.state.ready =
                false;

            this.state.loading =
                false;

            this.state.destroyed =
                true;


            this.log(
                "destroyed"
            );


            dispatchGlobalEvent(
                "rainguard:rainviewer:destroyed",
                {
                    engine:
                        ENGINE_NAME,

                    version:
                        ENGINE_VERSION
                }
            );
        }
    }


    /* ========================================================================
     * Global exports
     * ===================================================================== */

    global.RainViewerMetadataAdapter =
        RainViewerMetadataAdapter;


    /*
     * Singleton instance.
     *
     * Later Phase 40 files can safely use:
     *
     * window.rainViewerMetadataAdapter
     */
    if (
        !global.rainViewerMetadataAdapter
    ) {

        global.rainViewerMetadataAdapter =
            new RainViewerMetadataAdapter();
    }


    /*
     * Convenience global function.
     */
    global.getRainViewerMetadata =
        async function (
            options = {}
        ) {

            return global
                .rainViewerMetadataAdapter
                .fetchMetadata(
                    options
                );
        };


    /*
     * Convenience diagnostic function.
     */
    global.testRainViewerMetadataAdapter =
        async function () {

            return global
                .rainViewerMetadataAdapter
                .selfTest();
        };


    console.log(
        `%c[RainGuard AI] Phase ${PHASE} — ${ENGINE_NAME} v${ENGINE_VERSION} READY`,
        "font-weight:bold;color:#0284c7;"
    );


})(window);
