/* =========================================================
   RainGuard AI V30
   National Source Adapter Layer
   File: frontend/js/source_adapter_v30.js
   ========================================================= */

window.RG30 = window.RG30 || {};

RG30.SourceAdapter = {

    version: "30.0.0",

    initialized: false,
    collecting: false,

    lastCollection: null,
    sourceStates: {},

    config: {
        timeoutMs: 15000,
        retryCount: 2,
        retryDelayMs: 1200,

        sources: {
            official: {
                enabled: true,
                required: false,
                priority: 1,
                adapterName: "AnwaaAdapter"
            },

            openMeteo: {
                enabled: true,
                required: true,
                priority: 2,
                adapterName: "OpenMeteoAdapter"
            },

            radar: {
                enabled: true,
                required: false,
                priority: 3,
                adapterName: "RainViewerAdapter"
            },

            satellite: {
                enabled: true,
                required: false,
                priority: 4,
                adapterName: "SatelliteAdapter"
            },

            lightning: {
                enabled: true,
                required: false,
                priority: 5,
                adapterName: "LightningAdapter"
            },

            localAI: {
                enabled: true,
                required: true,
                priority: 6,
                adapterName: "LocalAIAdapter"
            }
        }
    },

    /* =====================================================
       INITIALIZATION
       ===================================================== */

    init() {
        if (this.initialized) {
            return;
        }

        this.initialized = true;

        this.initializeSourceStates();

        console.log(
            `RG30 Source Adapter ${this.version} initialized.`
        );

        window.dispatchEvent(
            new CustomEvent(
                "rg30:source-adapter-ready",
                {
                    detail: {
                        version: this.version,
                        timestamp: new Date().toISOString()
                    }
                }
            )
        );
    },

    initializeSourceStates() {
        Object.entries(
            this.config.sources
        ).forEach(([key, source]) => {

            this.sourceStates[key] = {
                key,
                adapterName: source.adapterName,
                enabled: source.enabled,
                required: source.required,

                status: source.enabled
                    ? "WAITING"
                    : "DISABLED",

                attempts: 0,
                successes: 0,
                failures: 0,

                lastSuccessAt: null,
                lastFailureAt: null,
                lastError: null,
                lastDurationMs: null
            };
        });
    },

    /* =====================================================
       PUBLIC COLLECTION
       ===================================================== */

    async collectForCities(cities = []) {
        if (this.collecting) {
            console.warn(
                "RG30 Source Adapter: collection already running."
            );

            return (
                this.lastCollection || {
                    ok: false,
                    skipped: true,
                    reason: "COLLECTION_ALREADY_RUNNING",
                    cities: []
                }
            );
        }

        if (
            !Array.isArray(cities) ||
            !cities.length
        ) {
            return {
                ok: false,
                skipped: true,
                reason: "NO_CITIES",
                cities: []
            };
        }

        this.collecting = true;

        const startedAt = Date.now();

        this.writeCommander(
            `V30 source collection started for ${cities.length} cities.`
        );

        try {
            const normalizedCities =
                cities.map((city, index) =>
                    this.normalizeCity(city, index)
                );

            const results = [];

            for (const city of normalizedCities) {
                const result =
                    await this.collectForCity(city);

                results.push(result);
            }

            const summary =
                this.buildCollectionSummary(results);

            this.lastCollection = {
                ok: true,
                version: this.version,

                timestamp:
                    new Date().toISOString(),

                durationMs:
                    Date.now() - startedAt,

                cities:
                    results,

                summary,

                sourceStates:
                    this.getSourceStates()
            };

            this.publishCollection(
                this.lastCollection
            );

            this.renderStatus(
                this.lastCollection
            );

            this.writeCommander(
                `V30 source collection completed. Coverage: ${summary.coverage}%.`
            );

            return this.lastCollection;

        } catch (error) {
            console.error(
                "RG30 Source Adapter collection failed:",
                error
            );

            const failure = {
                ok: false,
                timestamp:
                    new Date().toISOString(),

                durationMs:
                    Date.now() - startedAt,

                error:
                    error?.message ||
                    String(error),

                cities: []
            };

            this.lastCollection = failure;

            this.writeCommander(
                "V30 source collection failed.",
                "danger"
            );

            return failure;

        } finally {
            this.collecting = false;
        }
    },

    async collectForCity(city) {
        const sources = {};

        const sourceEntries =
            Object.entries(
                this.config.sources
            )
            .filter(
                ([, config]) =>
                    config.enabled
            )
            .sort(
                ([, a], [, b]) =>
                    a.priority - b.priority
            );

        const promises =
            sourceEntries.map(
                async ([sourceKey, config]) => {

                    const result =
                        await this.collectFromSource(
                            sourceKey,
                            config,
                            city
                        );

                    return {
                        sourceKey,
                        result
                    };
                }
            );

        const settled =
            await Promise.allSettled(
                promises
            );

        settled.forEach(item => {
            if (
                item.status === "fulfilled"
            ) {
                sources[
                    item.value.sourceKey
                ] = item.value.result;
            }
        });

        return {
            city: city.name,
            lat: city.lat,
            lon: city.lon,

            sourceCount:
                Object.keys(sources).length,

            availableSourceCount:
                Object.values(sources)
                    .filter(
                        source =>
                            source.available
                    ).length,

            sources,

            collectedAt:
                new Date().toISOString()
        };
    },

    /* =====================================================
       SOURCE EXECUTION
       ===================================================== */

    async collectFromSource(
        sourceKey,
        config,
        city
    ) {
        const state =
            this.sourceStates[sourceKey];

        state.status = "CONNECTING";
        state.attempts += 1;
        state.lastError = null;

        const adapter =
            this.resolveAdapter(
                config.adapterName
            );

        if (
            !adapter ||
            typeof adapter.collect !== "function"
        ) {
            const result =
                this.createUnavailableResult(
                    sourceKey,
                    config.adapterName,
                    "ADAPTER_NOT_AVAILABLE"
                );

            state.status = "UNAVAILABLE";
            state.failures += 1;
            state.lastFailureAt =
                new Date().toISOString();
            state.lastError =
                result.error;

            return result;
        }

        let lastError = null;

        for (
            let attempt = 1;
            attempt <=
                this.config.retryCount + 1;
            attempt++
        ) {
            const startedAt = Date.now();

            try {
                const rawResult =
                    await this.withTimeout(
                        Promise.resolve(
                            adapter.collect(city)
                        ),
                        this.config.timeoutMs
                    );

                const result =
                    this.normalizeSourceResult({
                        sourceKey,
                        adapterName:
                            config.adapterName,
                        city,
                        rawResult,
                        durationMs:
                            Date.now() - startedAt
                    });

                state.status =
                    result.available
                        ? "CONNECTED"
                        : "UNAVAILABLE";

                state.lastDurationMs =
                    result.durationMs;

                if (result.available) {
                    state.successes += 1;
                    state.lastSuccessAt =
                        new Date().toISOString();
                } else {
                    state.failures += 1;
                    state.lastFailureAt =
                        new Date().toISOString();
                }

                return result;

            } catch (error) {
                lastError = error;

                state.lastError =
                    error?.message ||
                    String(error);

                if (
                    attempt <=
                    this.config.retryCount
                ) {
                    await this.delay(
                        this.config.retryDelayMs
                    );
                }
            }
        }

        state.status = "FAILED";
        state.failures += 1;
        state.lastFailureAt =
            new Date().toISOString();

        return this.createUnavailableResult(
            sourceKey,
            config.adapterName,
            lastError?.message ||
            "SOURCE_COLLECTION_FAILED"
        );
    },

    resolveAdapter(adapterName) {
        return (
            window.RG30?.[adapterName] ||
            window[adapterName] ||
            null
        );
    },

    normalizeSourceResult({
        sourceKey,
        adapterName,
        city,
        rawResult,
        durationMs
    }) {
        const result =
            rawResult &&
            typeof rawResult === "object"
                ? rawResult
                : {};

        return {
            sourceKey,
            adapterName,

            city:
                city.name,

            available:
                result.available === true ||
                result.status === "CONNECTED" ||
                result.status === "AVAILABLE" ||
                result.ok === true,

            status:
                result.status ||
                (
                    result.available
                        ? "AVAILABLE"
                        : "UNAVAILABLE"
                ),

            timestamp:
                result.timestamp ||
                new Date().toISOString(),

            ageMinutes:
                this.safeNumber(
                    result.ageMinutes,
                    0
                ),

            reliability:
                this.clamp(
                    result.reliability ??
                    result.trust ??
                    0.5,
                    0,
                    1
                ),

            rainProbability:
                this.clamp(
                    result.rainProbability ??
                    result.probability ??
                    0,
                    0,
                    100
                ),

            rainAmount:
                this.clamp(
                    result.rainAmount ??
                    result.precipitation ??
                    0,
                    0,
                    1000
                ),

            signalScore:
                this.clamp(
                    result.signalScore ??
                    result.score ??
                    0,
                    0,
                    100
                ),

            confidence:
                this.clamp(
                    result.confidence ??
                    0,
                    0,
                    100
                ),

            warningLevel:
                result.warningLevel ||
                result.level ||
                "UNKNOWN",

            details:
                result.details || {},

            raw:
                result.raw || null,

            durationMs:
                this.safeNumber(
                    durationMs,
                    0
                ),

            error:
                result.error || null
        };
    },

    createUnavailableResult(
        sourceKey,
        adapterName,
        error
    ) {
        return {
            sourceKey,
            adapterName,

            available: false,
            status: "UNAVAILABLE",

            timestamp:
                new Date().toISOString(),

            ageMinutes: 0,
            reliability: 0,

            rainProbability: 0,
            rainAmount: 0,
            signalScore: 0,
            confidence: 0,

            warningLevel: "UNKNOWN",

            details: {},
            raw: null,

            durationMs: 0,
            error
        };
    },

    /* =====================================================
       DATA CONVERSION FOR VERIFICATION ENGINE
       ===================================================== */

    toVerificationCities(
        collection =
            this.lastCollection
    ) {
        if (
            !collection?.ok ||
            !Array.isArray(collection.cities)
        ) {
            return [];
        }

        return collection.cities.map(item => {
            const official =
                item.sources.official || {};

            const radar =
                item.sources.radar || {};

            const satellite =
                item.sources.satellite || {};

            const lightning =
                item.sources.lightning || {};

            const openMeteo =
                item.sources.openMeteo || {};

            const localAI =
                item.sources.localAI || {};

            return {
                name: item.city,
                lat: item.lat,
                lon: item.lon,

                officialData: {
                    available:
                        Boolean(
                            official.available
                        ),

                    status:
                        official.status ||
                        "PENDING_API",

                    rainProbability:
                        official.rainProbability || 0,

                    rainAmount:
                        official.rainAmount || 0,

                    warningLevel:
                        official.warningLevel ||
                        "UNKNOWN"
                },

                radarData: {
                    available:
                        Boolean(
                            radar.available
                        ),

                    intensity:
                        this.safeNumber(
                            radar.details?.intensity ??
                            radar.rainAmount,
                            0
                        ),

                    rainDetected:
                        Boolean(
                            radar.details?.rainDetected
                        ),

                    movementConfidence:
                        this.safeNumber(
                            radar.details
                                ?.movementConfidence,
                            0
                        )
                },

                satelliteData: {
                    available:
                        Boolean(
                            satellite.available
                        ),

                    cloudCover:
                        this.safeNumber(
                            satellite.details
                                ?.cloudCover,
                            0
                        ),

                    convectionScore:
                        this.safeNumber(
                            satellite.details
                                ?.convectionScore,
                            satellite.signalScore || 0
                        ),

                    cloudTemperature:
                        this.safeNumber(
                            satellite.details
                                ?.cloudTemperature,
                            0
                        )
                },

                lightningData: {
                    available:
                        Boolean(
                            lightning.available
                        ),

                    strikes:
                        this.safeNumber(
                            lightning.details
                                ?.strikes,
                            0
                        ),

                    distanceKm:
                        this.safeNumber(
                            lightning.details
                                ?.distanceKm,
                            0
                        ),

                    activityScore:
                        this.safeNumber(
                            lightning.details
                                ?.activityScore,
                            lightning.signalScore || 0
                        )
                },

                openMeteoData: {
                    available:
                        Boolean(
                            openMeteo.available
                        ),

                    rainProbability:
                        openMeteo.rainProbability ||
                        0,

                    rainAmount:
                        openMeteo.rainAmount ||
                        0,

                    humidity:
                        this.safeNumber(
                            openMeteo.details?.humidity,
                            0
                        ),

                    cloudCover:
                        this.safeNumber(
                            openMeteo.details
                                ?.cloudCover,
                            0
                        ),

                    windSpeed:
                        this.safeNumber(
                            openMeteo.details
                                ?.windSpeed,
                            0
                        )
                },

                weatherScore:
                    this.safeNumber(
                        localAI.details
                            ?.weatherScore,
                        localAI.signalScore || 0
                    ),

                floodIndex:
                    this.safeNumber(
                        localAI.details
                            ?.floodIndex,
                        0
                    ),

                roadRisk:
                    this.safeNumber(
                        localAI.details
                            ?.roadRisk,
                        0
                    ),

                finalRisk:
                    this.safeNumber(
                        localAI.details
                            ?.finalRisk,
                        localAI.signalScore || 0
                    )
            };
        });
    },

    async collectAndVerify(cities = []) {
        const collection =
            await this.collectForCities(
                cities
            );

        if (!collection?.ok) {
            return {
                ok: false,
                collection,
                verification: []
            };
        }

        const verificationCities =
            this.toVerificationCities(
                collection
            );

        if (
            !window.RG30
                ?.VerificationEngine
                ?.run
        ) {
            return {
                ok: false,
                collection,
                verificationCities,
                verification: [],
                reason:
                    "VERIFICATION_ENGINE_UNAVAILABLE"
            };
        }

        const verification =
            await RG30.VerificationEngine.run(
                verificationCities
            );

        return {
            ok: true,
            collection,
            verificationCities,
            verification,

            summary:
                RG30.VerificationEngine
                    .latestNationalSummary
        };
    },

    /* =====================================================
       SUMMARY
       ===================================================== */

    buildCollectionSummary(results) {
        const totalCities =
            results.length;

        const totalPossibleSources =
            totalCities *
            Object.values(
                this.config.sources
            )
            .filter(
                source =>
                    source.enabled
            ).length;

        const totalAvailableSources =
            results.reduce(
                (sum, city) =>
                    sum +
                    city.availableSourceCount,
                0
            );

        const coverage =
            totalPossibleSources
                ? Math.round(
                    totalAvailableSources /
                    totalPossibleSources *
                    100
                )
                : 0;

        const cityCoverage =
            results.map(city => ({
                city: city.city,

                available:
                    city.availableSourceCount,

                total:
                    city.sourceCount,

                coverage:
                    city.sourceCount
                        ? Math.round(
                            city.availableSourceCount /
                            city.sourceCount *
                            100
                        )
                        : 0
            }));

        return {
            cities:
                totalCities,

            totalPossibleSources,
            totalAvailableSources,
            coverage,

            cityCoverage,

            timestamp:
                new Date().toISOString()
        };
    },

    /* =====================================================
       STATE
       ===================================================== */

    getSourceStates() {
        return JSON.parse(
            JSON.stringify(
                this.sourceStates
            )
        );
    },

    getState() {
        return {
            version:
                this.version,

            initialized:
                this.initialized,

            collecting:
                this.collecting,

            lastCollection:
                this.lastCollection,

            sourceStates:
                this.getSourceStates()
        };
    },

    setSourceEnabled(
        sourceKey,
        enabled
    ) {
        const source =
            this.config.sources[
                sourceKey
            ];

        if (!source) {
            return false;
        }

        source.enabled =
            Boolean(enabled);

        if (
            this.sourceStates[
                sourceKey
            ]
        ) {
            this.sourceStates[
                sourceKey
            ].enabled =
                Boolean(enabled);

            this.sourceStates[
                sourceKey
            ].status =
                enabled
                    ? "WAITING"
                    : "DISABLED";
        }

        return true;
    },

    /* =====================================================
       EVENTS
       ===================================================== */

    publishCollection(collection) {
        window.RG30.latestSourceCollection =
            collection;

        window.dispatchEvent(
            new CustomEvent(
                "rg30:sources-collected",
                {
                    detail:
                        collection
                }
            )
        );
    },

    /* =====================================================
       RENDERING
       ===================================================== */

    renderStatus(collection) {
        const panel =
            document.getElementById(
                "sourceAdapterStatusPanel"
            );

        if (!panel) {
            return;
        }

        const summary =
            collection?.summary;

        if (!summary) {
            panel.innerHTML = `
                <div class="item warning">
                    No source collection result is available.
                </div>
            `;

            return;
        }

        const sourceItems =
            Object.values(
                collection.sourceStates || {}
            ).map(state => {

                const className =
                    state.status === "CONNECTED"
                        ? "success"
                        : state.status === "FAILED"
                            ? "danger"
                            : "warning";

                return `
                    <div class="item ${className}">
                        <b>
                            ${this.escapeHTML(
                                state.key
                            )}
                        </b>
                        <br>

                        Status:
                        ${this.escapeHTML(
                            state.status
                        )}
                        <br>

                        Attempts:
                        ${state.attempts}
                        <br>

                        Successes:
                        ${state.successes}
                        <br>

                        Failures:
                        ${state.failures}
                    </div>
                `;
            }).join("");

        panel.innerHTML = `
            <div class="item success">
                <h3>
                    National Source Adapter V30
                </h3>

                Cities:
                ${summary.cities}
                <br>

                Source Coverage:
                ${summary.coverage}%
                <br>

                Available Sources:
                ${summary.totalAvailableSources}
                /
                ${summary.totalPossibleSources}
            </div>

            ${sourceItems}
        `;
    },

    /* =====================================================
       HELPERS
       ===================================================== */

    normalizeCity(city, index = 0) {
        const source =
            city &&
            typeof city === "object"
                ? city
                : {};

        return {
            ...source,

            id:
                source.id ??
                source.code ??
                `city-${index + 1}`,

            name:
                source.name ??
                source.city ??
                source.cityName ??
                `City ${index + 1}`,

            lat:
                this.safeNumber(
                    source.lat ??
                    source.latitude,
                    24
                ),

            lon:
                this.safeNumber(
                    source.lon ??
                    source.lng ??
                    source.longitude,
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

        return Number.isFinite(number)
            ? number
            : fallback;
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
            Math.max(min, number)
        );
    },

    withTimeout(
        promise,
        timeoutMs
    ) {
        return Promise.race([
            promise,

            new Promise(
                (_, reject) => {
                    setTimeout(
                        () => {
                            reject(
                                new Error(
                                    `SOURCE_TIMEOUT_AFTER_${timeoutMs}_MS`
                                )
                            );
                        },
                        timeoutMs
                    );
                }
            )
        ]);
    },

    delay(ms) {
        return new Promise(
            resolve =>
                setTimeout(
                    resolve,
                    ms
                )
        );
    },

    escapeHTML(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    },

    writeCommander(
        message,
        type = "success"
    ) {
        console.log(
            `[RG30 Source Adapter] ${message}`
        );

        if (
            window.RG23
                ?.Brain
                ?.writeCommander
        ) {
            RG23.Brain.writeCommander(
                message,
                type
            );
        }
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
            RG30.SourceAdapter.init();
        },
        {
            once: true
        }
    );
} else {
    RG30.SourceAdapter.init();
}
