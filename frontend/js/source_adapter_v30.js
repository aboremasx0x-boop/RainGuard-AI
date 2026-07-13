/* =========================================================
   RainGuard AI V30
   National Source Adapter Layer
   Bilingual Arabic / English Edition
   File: frontend/js/source_adapter_v30.js
   ========================================================= */

window.RG30 =
    window.RG30 || {};

RG30.SourceAdapter = {

    version:
        "30.1.0-bilingual",

    initialized:
        false,

    collecting:
        false,

    collectionNumber:
        0,

    lastCollection:
        null,

    latestCollection:
        null,

    sourceStates:
        {},

    sourceCache:
        new Map(),

    config: {

        timeoutMs:
            15000,

        retryCount:
            2,

        retryDelayMs:
            1200,

        cacheTtlMs:
            5 * 60 * 1000,

        duplicateWindowMs:
            15000,

        maximumConcurrentCities:
            4,

        sources: {

            official: {

                enabled:
                    true,

                required:
                    false,

                priority:
                    1,

                adapterName:
                    "AnwaaAdapter",

                reliability:
                    1.00
            },

            openMeteo: {

                enabled:
                    true,

                required:
                    true,

                priority:
                    2,

                adapterName:
                    "OpenMeteoAdapter",

                reliability:
                    0.80
            },

            radar: {

                enabled:
                    true,

                required:
                    false,

                priority:
                    3,

                adapterName:
                    "RainViewerAdapter",

                reliability:
                    0.92
            },

            satellite: {

                enabled:
                    true,

                required:
                    false,

                priority:
                    4,

                adapterName:
                    "SatelliteAdapter",

                reliability:
                    0.86
            },

            lightning: {

                enabled:
                    true,

                required:
                    false,

                priority:
                    5,

                adapterName:
                    "LightningAdapter",

                reliability:
                    0.84
            },

            localAI: {

                enabled:
                    true,

                required:
                    true,

                priority:
                    6,

                adapterName:
                    "LocalAIAdapter",

                reliability:
                    0.76
            }
        }
    },

    /* =====================================================
       LANGUAGE HELPERS
       ===================================================== */

    isArabic() {

        return (
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

    translateMessage(
        message
    ) {

        const i18n =
            window.RG30
                ?.I18n;

        if (
            i18n &&
            typeof i18n
                .translateText ===
                "function"
        ) {

            return i18n
                .translateText(
                    message
                );

        }

        return String(
            message ?? ""
        );

    },

    getSourceLabel(
        sourceKey
    ) {

        const labels = {

            official: {

                en:
                    "Official National Source",

                ar:
                    "المصدر الوطني الرسمي"
            },

            openMeteo: {

                en:
                    "Open-Meteo",

                ar:
                    "Open-Meteo"
            },

            radar: {

                en:
                    "RainViewer Radar",

                ar:
                    "رادار RainViewer"
            },

            satellite: {

                en:
                    "Satellite",

                ar:
                    "الأقمار الصناعية"
            },

            lightning: {

                en:
                    "Lightning Detection",

                ar:
                    "رصد البرق"
            },

            localAI: {

                en:
                    "RainGuard Local AI",

                ar:
                    "الذكاء الاصطناعي المحلي لـ RainGuard"
            }

        };

        const item =
            labels[
                sourceKey
            ];

        if (!item) {

            return String(
                sourceKey ?? ""
            );

        }

        return this.isArabic()
            ? item.ar
            : item.en;

    },

    getStatusLabel(
        status
    ) {

        const value =
            String(
                status ?? ""
            )
                .trim()
                .toUpperCase();

        const labels = {

            WAITING: {

                en:
                    "WAITING",

                ar:
                    "بانتظار التشغيل"
            },

            CONNECTING: {

                en:
                    "CONNECTING",

                ar:
                    "جارٍ الاتصال"
            },

            CONNECTED: {

                en:
                    "CONNECTED",

                ar:
                    "متصل"
            },

            AVAILABLE: {

                en:
                    "AVAILABLE",

                ar:
                    "متاح"
            },

            ACTIVE: {

                en:
                    "ACTIVE",

                ar:
                    "نشط"
            },

            UNAVAILABLE: {

                en:
                    "UNAVAILABLE",

                ar:
                    "غير متاح"
            },

            FAILED: {

                en:
                    "FAILED",

                ar:
                    "فشل"
            },

            DISABLED: {

                en:
                    "DISABLED",

                ar:
                    "معطل"
            },

            CACHED: {

                en:
                    "CACHED",

                ar:
                    "من الذاكرة المؤقتة"
            },

            TIMEOUT: {

                en:
                    "TIMEOUT",

                ar:
                    "انتهت مهلة الاتصال"
            },

            UNKNOWN: {

                en:
                    "UNKNOWN",

                ar:
                    "غير معروف"
            }
        };

        const item =
            labels[
                value
            ];

        if (!item) {

            return String(
                status ?? ""
            );

        }

        return this.isArabic()
            ? item.ar
            : item.en;

    },

    getErrorLabel(
        error
    ) {

        const value =
            String(
                error ?? ""
            )
                .trim();

        if (!value) {

            return this.text(
                "No error",
                "لا يوجد خطأ"
            );

        }

        const errors = {

            ADAPTER_NOT_AVAILABLE: {

                en:
                    "Adapter is not available.",

                ar:
                    "المحول غير متاح."
            },
           ADAPTER_METHOD_NOT_FOUND: {

    en:
        "Adapter does not expose collect() or execute().",

    ar:
        "المحول لا يحتوي على الدالة collect() أو execute()."

},

            SOURCE_COLLECTION_FAILED: {

                en:
                    "Source collection failed.",

                ar:
                    "فشل جمع بيانات المصدر."
            },

            COLLECTION_ALREADY_RUNNING: {

                en:
                    "Another source collection is already running.",

                ar:
                    "توجد عملية جمع مصادر قيد التشغيل."
            },

            NO_CITIES: {

                en:
                    "No cities were provided.",

                ar:
                    "لم يتم تزويد النظام ببيانات مدن."
            },

            VERIFICATION_ENGINE_UNAVAILABLE: {

                en:
                    "Verification engine is unavailable.",

                ar:
                    "محرك التحقق غير متاح."
            }
        };

        const item =
            errors[
                value
            ];

        if (!item) {

            if (
                value.startsWith(
                    "SOURCE_TIMEOUT_AFTER_"
                )
            ) {

                return this.text(
                    "Source request timed out.",
                    "انتهت مهلة طلب المصدر."
                );

            }

            return value;

        }

        return this.isArabic()
            ? item.ar
            : item.en;

    },

    /* =====================================================
       INITIALIZATION
       ===================================================== */

    init() {

        if (
            this.initialized
        ) {

            return;

        }

        this.initialized =
            true;

        this.initializeSourceStates();

        this.bindEvents();

        console.log(
            `RG30 Source Adapter ${this.version} initialized.`
        );

        window.dispatchEvent(

            new CustomEvent(

                "rg30:source-adapter-ready",

                {
                    detail: {

                        version:
                            this.version,

                        timestamp:
                            new Date()
                                .toISOString(),

                        sources:
                            Object.keys(
                                this.config
                                    .sources
                            ),

                        language:
                            window.RG30
                                ?.I18n
                                ?.language ||
                            "en"

                    }
                }

            )

        );

    },

    bindEvents() {

        window.addEventListener(

            "rg30:language-changed",

            () => {

                try {

                    if (
                        this.latestCollection
                    ) {

                        this.renderStatus(
                            this.latestCollection
                        );

                    }

                } catch (error) {

                    console.warn(
                        "RG30 Source Adapter language refresh failed:",
                        error
                    );

                }

            }

        );

        window.addEventListener(

            "rg30:clear-source-cache",

            () => {

                this.clearCache();

            }

        );

    },

    initializeSourceStates() {

        this.sourceStates =
            {};

        Object.entries(
            this.config.sources
        )
            .forEach(
                (
                    [
                        key,
                        source
                    ]
                ) => {

                    this.sourceStates[
                        key
                    ] = {

                        key,

                        name:
                            this.getSourceLabel(
                                key
                            ),

                        adapterName:
                            source.adapterName,

                        enabled:
                            source.enabled,

                        required:
                            source.required,

                        priority:
                            source.priority,

                        reliability:
                            source.reliability,

                        status:
                            source.enabled
                                ? "WAITING"
                                : "DISABLED",

                        attempts:
                            0,

                        successes:
                            0,

                        failures:
                            0,

                        cacheHits:
                            0,

                        lastSuccessAt:
                            null,

                        lastFailureAt:
                            null,

                        lastError:
                            null,

                        lastDurationMs:
                            null,

                        averageDurationMs:
                            0

                    };

                }
            );

    },
       /* =====================================================
       PUBLIC COLLECTION
       ===================================================== */

    async collectForCities(
        cities = []
    ) {

        if (
            this.collecting
        ) {

            console.warn(
                "RG30 Source Adapter: collection already running."
            );

            return (

                this.lastCollection ||

                {
                    ok:
                        false,

                    skipped:
                        true,

                    reason:
                        "COLLECTION_ALREADY_RUNNING",

                    cities:
                        []
                }

            );

        }

        if (
            !Array.isArray(
                cities
            ) ||
            !cities.length
        ) {

            const failure = {

                ok:
                    false,

                skipped:
                    true,

                reason:
                    "NO_CITIES",

                cities:
                    [],

                timestamp:
                    new Date()
                        .toISOString()

            };

            this.writeCommander(

                this.text(
                    "Source collection skipped because no cities were provided.",
                    "تم تجاوز جمع المصادر لعدم توفير بيانات مدن."
                ),

                "warning"

            );

            return failure;

        }

        this.collecting =
            true;

        this.collectionNumber +=
            1;

        const startedAt =
            Date.now();

        this.writeCommander(

            this.text(

                `V30 source collection started for ${cities.length} cities.`,

                `بدأ جمع مصادر V30 لعدد ${cities.length} مدينة.`

            )

        );

        try {

            const normalizedCities =
                cities
                    .filter(
                        Boolean
                    )
                    .map(
                        (
                            city,
                            index
                        ) => {

                            return this.normalizeCity(
                                city,
                                index
                            );

                        }
                    );

            const results =
                [];

            const batches =
                this.chunkArray(

                    normalizedCities,

                    this.config
                        .maximumConcurrentCities

                );

            for (
                const batch of batches
            ) {

                const batchResults =
                    await Promise.all(

                        batch.map(
                            city =>
                                this.collectForCity(
                                    city
                                )
                        )

                    );

                results.push(
                    ...batchResults
                );

            }

            const summary =
                this.buildCollectionSummary(
                    results
                );

            const collection = {

                ok:
                    true,

                version:
                    this.version,

                collectionNumber:
                    this.collectionNumber,

                timestamp:
                    new Date()
                        .toISOString(),

                durationMs:
                    Date.now() -
                    startedAt,

                requestedCities:
                    normalizedCities.length,

                cities:
                    results,

                summary,

                sourceStates:
                    this.getSourceStates(),

                cache: {

                    size:
                        this.sourceCache.size,

                    ttlMs:
                        this.config
                            .cacheTtlMs

                }

            };

            this.lastCollection =
                collection;

            this.latestCollection =
                collection;

            this.publishCollection(
                collection
            );

            this.renderStatus(
                collection
            );

            this.writeCommander(

                this.text(

                    `V30 source collection completed. Coverage: ${summary.coverage}%.`,

                    `اكتمل جمع مصادر V30. نسبة التغطية: ${summary.coverage}%.`

                )

            );

            return collection;

        } catch (error) {

            console.error(
                "RG30 Source Adapter collection failed:",
                error
            );

            const failure = {

                ok:
                    false,

                version:
                    this.version,

                collectionNumber:
                    this.collectionNumber,

                timestamp:
                    new Date()
                        .toISOString(),

                durationMs:
                    Date.now() -
                    startedAt,

                error:
                    error
                        ?.message ||
                    String(
                        error
                    ),

                cities:
                    [],

                sourceStates:
                    this.getSourceStates()

            };

            this.lastCollection =
                failure;

            this.latestCollection =
                failure;

            this.writeCommander(

                this.text(
                    "V30 source collection failed.",
                    "فشل جمع مصادر V30."
                ),

                "danger"

            );

            window.dispatchEvent(

                new CustomEvent(

                    "rg30:source-collection-failed",

                    {
                        detail:
                            failure
                    }

                )

            );

            return failure;

        } finally {

            this.collecting =
                false;

        }

    },

    async collectForCity(
        city
    ) {

        const sources =
            {};

        const sourceEntries =
            Object.entries(
                this.config.sources
            )
                .filter(
                    (
                        [
                            ,
                            config
                        ]
                    ) => {

                        return config
                            .enabled;

                    }
                )
                .sort(
                    (
                        [
                            ,
                            first
                        ],

                        [
                            ,
                            second
                        ]
                    ) => {

                        return (

                            first.priority -
                            second.priority

                        );

                    }
                );

        const promises =
            sourceEntries.map(

                async (
                    [
                        sourceKey,
                        config
                    ]
                ) => {

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

        settled.forEach(
            item => {

                if (
                    item.status ===
                    "fulfilled"
                ) {

                    sources[
                        item.value
                            .sourceKey
                    ] =
                        item.value
                            .result;

                    return;

                }

                console.warn(
                    "RG30 Source Adapter city source promise rejected:",
                    item.reason
                );

            }
        );

        const availableSourceCount =
            Object.values(
                sources
            )
                .filter(
                    source =>
                        source
                            .available
                )
                .length;

        const requiredSources =
            sourceEntries
                .filter(
                    (
                        [
                            ,
                            config
                        ]
                    ) =>
                        config.required
                )
                .map(
                    (
                        [
                            key
                        ]
                    ) =>
                        key
                );

        const missingRequiredSources =
            requiredSources
                .filter(
                    key =>
                        !sources[
                            key
                        ]
                        ?.available
                );

        const cityCoverage =
            sourceEntries.length
                ? Math.round(

                    availableSourceCount /
                    sourceEntries.length *
                    100

                )
                : 0;

        return {

            city:
                city.name,

            cityId:
                city.id,

            lat:
                city.lat,

            lon:
                city.lon,

            sourceCount:
                sourceEntries.length,

            availableSourceCount,

            coverage:
                cityCoverage,

            requiredSources,

            missingRequiredSources,

            readyForVerification:
                missingRequiredSources
                    .length ===
                0,

            sources,

            collectedAt:
                new Date()
                    .toISOString()

        };

    },

    /* =====================================================
       CACHE
       ===================================================== */

    buildCacheKey(
        sourceKey,
        city
    ) {

        const lat =
            this.safeNumber(
                city?.lat,
                0
            )
            .toFixed(
                4
            );

        const lon =
            this.safeNumber(
                city?.lon,
                0
            )
            .toFixed(
                4
            );

        const cityName =
            String(
                city?.name ||
                city?.city ||
                ""
            )
                .trim()
                .toLowerCase();

        return `${sourceKey}:${cityName}:${lat}:${lon}`;

    },

    getCachedResult(
        sourceKey,
        city
    ) {

        const key =
            this.buildCacheKey(
                sourceKey,
                city
            );

        const cached =
            this.sourceCache.get(
                key
            );

        if (!cached) {

            return null;

        }

        const age =
            Date.now() -
            cached.cachedAt;

        if (
            age >
            this.config
                .cacheTtlMs
        ) {

            this.sourceCache.delete(
                key
            );

            return null;

        }

        return {

            ...cached.result,

            status:
                "CACHED",

            cached:
                true,

            cacheAgeMs:
                age,

            cacheAgeMinutes:
                Number(

                    (
                        age /
                        60000
                    )
                    .toFixed(
                        2
                    )

                )

        };

    },

    setCachedResult(
        sourceKey,
        city,
        result
    ) {

        if (
            !result ||
            result.available !==
                true
        ) {

            return;

        }

        const key =
            this.buildCacheKey(
                sourceKey,
                city
            );

        this.sourceCache.set(
            key,
            {
                cachedAt:
                    Date.now(),

                result:
                    {
                        ...result,

                        cached:
                            false
                    }
            }
        );

    },

    clearCache() {

        this.sourceCache.clear();

        Object.values(
            this.sourceStates
        )
            .forEach(
                state => {

                    state.cacheHits =
                        0;

                }
            );

        this.writeCommander(

            this.text(
                "V30 source cache cleared.",
                "تم مسح ذاكرة مصادر V30 المؤقتة."
            ),

            "info"

        );

    },

    pruneCache() {

        const now =
            Date.now();

        for (
            const [
                key,
                item
            ] of this.sourceCache
        ) {

            if (
                now -
                item.cachedAt >
                this.config
                    .cacheTtlMs
            ) {

                this.sourceCache.delete(
                    key
                );

            }

        }

    },

    chunkArray(
        items,
        size
    ) {

        const safeSize =
            Math.max(
                1,
                this.safeNumber(
                    size,
                    1
                )
            );

        const chunks =
            [];

        for (
            let index = 0;
            index <
            items.length;
            index +=
                safeSize
        ) {

            chunks.push(

                items.slice(
                    index,
                    index +
                    safeSize
                )

            );

        }

        return chunks;

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
            this.sourceStates[
                sourceKey
            ];

        if (!state) {

            return this.createUnavailableResult(

                sourceKey,

                config
                    ?.adapterName ||
                "UNKNOWN_ADAPTER",

                "SOURCE_STATE_NOT_FOUND"

            );

        }

        state.status =
            "CONNECTING";

        state.attempts +=
            1;

        state.lastError =
            null;

        this.pruneCache();

        const cached =
            this.getCachedResult(

                sourceKey,

                city

            );

        if (cached) {

            state.status =
                "CACHED";

            state.cacheHits +=
                1;

            state.lastDurationMs =
                0;

            return cached;

        }

        const adapter =
    this.resolveAdapter(
        config.adapterName
    );

if (!adapter) {

    return this.createUnavailableResult(
        sourceKey,
        config.adapterName,
        "ADAPTER_NOT_AVAILABLE"
    );

}

let executeFunction = null;

if (typeof adapter.execute === "function") {

    executeFunction =
        () => adapter.execute(city);

}
else if (typeof adapter.collect === "function") {

    executeFunction =
        () => adapter.collect(city);

}
else {

    return this.createUnavailableResult(
        sourceKey,
        config.adapterName,
        "ADAPTER_METHOD_NOT_FOUND"
    );

}

const rawResult =
    await this.withTimeout(

        Promise.resolve(
            executeFunction()
        ),

        this.config.timeoutMs

    );

            state.status =
                "UNAVAILABLE";

            state.failures +=
                1;

            state.lastFailureAt =
                new Date()
                    .toISOString();

            state.lastError =
                result.error;

            return result;

        }

        let lastError =
            null;

        const totalAttempts =
            this.config.retryCount +
            1;

        for (
            let attempt = 1;
            attempt <=
            totalAttempts;
            attempt += 1
        ) {

            const startedAt =
                Date.now();

            try {

                const rawResult =
                    await this.withTimeout(

                        Promise.resolve(

                            adapter.collect(
                                city
                            )

                        ),

                        this.config
                            .timeoutMs

                    );

                const durationMs =
                    Date.now() -
                    startedAt;

                const result =
                    this.normalizeSourceResult({

                        sourceKey,

                        adapterName:
                            config.adapterName,

                        city,

                        rawResult,

                        durationMs

                    });

                state.status =
                    result.available
                        ? "CONNECTED"
                        : "UNAVAILABLE";

                state.lastDurationMs =
                    result.durationMs;

                this.updateAverageDuration(

                    state,

                    result.durationMs

                );

                if (
                    result.available
                ) {

                    state.successes +=
                        1;

                    state.lastSuccessAt =
                        new Date()
                            .toISOString();

                    state.lastError =
                        null;

                    this.setCachedResult(

                        sourceKey,

                        city,

                        result

                    );

                } else {

                    state.failures +=
                        1;

                    state.lastFailureAt =
                        new Date()
                            .toISOString();

                    state.lastError =
                        result.error ||
                        "SOURCE_UNAVAILABLE";

                }

                return result;

            } catch (error) {

                lastError =
                    error;

                const message =
                    error
                        ?.message ||
                    String(
                        error
                    );

                state.lastError =
                    message;

                state.lastDurationMs =
                    Date.now() -
                    startedAt;

                this.updateAverageDuration(

                    state,

                    state.lastDurationMs

                );

                const isTimeout =
                    message.startsWith(
                        "SOURCE_TIMEOUT_AFTER_"
                    );

                state.status =
                    isTimeout
                        ? "TIMEOUT"
                        : "FAILED";

                if (
                    attempt <
                    totalAttempts
                ) {

                    this.writeCommander(

                        this.text(

                            `${this.getSourceLabel(
                                sourceKey
                            )} retry ${attempt}/${this.config.retryCount}.`,

                            `إعادة محاولة اتصال ${this.getSourceLabel(
                                sourceKey
                            )} رقم ${attempt}/${this.config.retryCount}.`

                        ),

                        "warning"

                    );

                    await this.delay(

                        this.config
                            .retryDelayMs *
                        attempt

                    );

                }

            }

        }

        state.status =
            "FAILED";

        state.failures +=
            1;

        state.lastFailureAt =
            new Date()
                .toISOString();

        state.lastError =
            lastError
                ?.message ||
            "SOURCE_COLLECTION_FAILED";

        return this.createUnavailableResult(

            sourceKey,

            config.adapterName,

            state.lastError

        );

    },

    resolveAdapter(
        adapterName
    ) {

        if (!adapterName) {
            return null;
        }

        return (

            window.RG30
                ?.[adapterName] ||

            window[
                adapterName
            ] ||

            null

        );

    },

    updateAverageDuration(
        state,
        durationMs
    ) {

        const duration =
            this.safeNumber(
                durationMs,
                0
            );

        if (
            duration <= 0
        ) {

            return;

        }

        const completedAttempts =
            state.successes +
            state.failures;

        if (
            completedAttempts <= 0 ||
            state.averageDurationMs <= 0
        ) {

            state.averageDurationMs =
                Math.round(
                    duration
                );

            return;

        }

        state.averageDurationMs =
            Math.round(

                (
                    state.averageDurationMs *
                    completedAttempts +

                    duration
                ) /

                (
                    completedAttempts +
                    1
                )

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
            typeof rawResult ===
                "object"
                ? rawResult
                : {};

        const available =

            result.available ===
                true ||

            result.status ===
                "CONNECTED" ||

            result.status ===
                "AVAILABLE" ||

            result.status ===
                "ACTIVE" ||

            result.ok ===
                true;

        const configuredReliability =
            this.config
                .sources[
                    sourceKey
                ]
                ?.reliability;

        const reliability =
            this.clamp(

                result.reliability ??

                result.trust ??

                configuredReliability ??

                0.5,

                0,

                1

            );

        const normalized = {

            sourceKey,

            sourceName:
                this.getSourceLabel(
                    sourceKey
                ),

            adapterName,

            city:
                city.name,

            cityId:
                city.id,

            lat:
                city.lat,

            lon:
                city.lon,

            available,

            status:
                result.status ||
                (
                    available
                        ? "AVAILABLE"
                        : "UNAVAILABLE"
                ),

            timestamp:
                result.timestamp ||
                new Date()
                    .toISOString(),

            ageMinutes:
                this.safeNumber(
                    result.ageMinutes,
                    0
                ),

            reliability,

            rainProbability:
                this.clamp(

                    result
                        .rainProbability ??

                    result
                        .probability ??

                    0,

                    0,

                    100

                ),

            rainAmount:
                this.clamp(

                    result
                        .rainAmount ??

                    result
                        .precipitation ??

                    0,

                    0,

                    1000

                ),

            signalScore:
                this.clamp(

                    result
                        .signalScore ??

                    result
                        .score ??

                    0,

                    0,

                    100

                ),

            confidence:
                this.clamp(

                    result
                        .confidence ??

                    0,

                    0,

                    100

                ),

            warningLevel:
                result.warningLevel ||
                result.level ||
                "UNKNOWN",

            details:
                result.details ||
                {},

            raw:
                result.raw ||
                null,

            durationMs:
                this.safeNumber(
                    durationMs,
                    0
                ),

            cached:
                false,

            error:
                result.error ||
                null

        };

        return this.enrichSourceResult(

            sourceKey,

            normalized

        );

    },

    enrichSourceResult(
        sourceKey,
        result
    ) {

        const enriched = {
            ...result
        };

        if (
            sourceKey ===
            "official"
        ) {

            enriched.details = {

                ...enriched.details,

                warningLevel:
                    enriched.details
                        ?.warningLevel ??
                    enriched.warningLevel,

                issuedAt:
                    enriched.details
                        ?.issuedAt ??
                    enriched.timestamp

            };

        }

        if (
            sourceKey ===
            "radar"
        ) {

            enriched.details = {

                ...enriched.details,

                intensity:
                    this.safeNumber(

                        enriched.details
                            ?.intensity ??

                        enriched.rainAmount,

                        0

                    ),

                rainDetected:

                    enriched.details
                        ?.rainDetected ===
                        true ||

                    enriched.signalScore >
                        0 ||

                    enriched.rainAmount >
                        0,

                movementConfidence:
                    this.safeNumber(

                        enriched.details
                            ?.movementConfidence ??

                        enriched.confidence,

                        0

                    ),

                frameAgeMinutes:
                    this.safeNumber(

                        enriched.details
                            ?.frameAgeMinutes ??

                        enriched.ageMinutes,

                        0

                    )

            };

        }

        if (
            sourceKey ===
            "satellite"
        ) {

            enriched.details = {

                ...enriched.details,

                cloudCover:
                    this.safeNumber(

                        enriched.details
                            ?.cloudCover,

                        0

                    ),

                convectionScore:
                    this.safeNumber(

                        enriched.details
                            ?.convectionScore ??

                        enriched.signalScore,

                        0

                    ),

                cloudTemperature:
                    this.safeNumber(

                        enriched.details
                            ?.cloudTemperature,

                        0

                    ),

                stormCellScore:
                    this.safeNumber(

                        enriched.details
                            ?.stormCellScore ??

                        enriched.confidence,

                        0

                    )

            };

        }

        if (
            sourceKey ===
            "lightning"
        ) {

            enriched.details = {

                ...enriched.details,

                strikes:
                    this.safeNumber(

                        enriched.details
                            ?.strikes,

                        0

                    ),

                distanceKm:
                    this.safeNumber(

                        enriched.details
                            ?.distanceKm,

                        0

                    ),

                activityScore:
                    this.safeNumber(

                        enriched.details
                            ?.activityScore ??

                        enriched.signalScore,

                        0

                    ),

                trend:
                    enriched.details
                        ?.trend ||
                    "STABLE"

            };

        }

        if (
            sourceKey ===
            "openMeteo"
        ) {

            enriched.details = {

                ...enriched.details,

                humidity:
                    this.safeNumber(

                        enriched.details
                            ?.humidity,

                        0

                    ),

                cloudCover:
                    this.safeNumber(

                        enriched.details
                            ?.cloudCover,

                        0

                    ),

                windSpeed:
                    this.safeNumber(

                        enriched.details
                            ?.windSpeed,

                        0

                    ),

                pressure:
                    this.safeNumber(

                        enriched.details
                            ?.pressure,

                        0

                    )

            };

        }

        if (
            sourceKey ===
            "localAI"
        ) {

            enriched.details = {

                ...enriched.details,

                weatherScore:
                    this.safeNumber(

                        enriched.details
                            ?.weatherScore ??

                        enriched.signalScore,

                        0

                    ),

                floodIndex:
                    this.safeNumber(

                        enriched.details
                            ?.floodIndex,

                        0

                    ),

                roadRisk:
                    this.safeNumber(

                        enriched.details
                            ?.roadRisk,

                        0

                    ),

                finalRisk:
                    this.safeNumber(

                        enriched.details
                            ?.finalRisk ??

                        enriched.signalScore,

                        0

                    ),

                confidence:
                    this.safeNumber(

                        enriched.details
                            ?.confidence ??

                        enriched.confidence,

                        0

                    )

            };

        }

        return enriched;

    },

    createUnavailableResult(
        sourceKey,
        adapterName,
        error
    ) {

        return {

            sourceKey,

            sourceName:
                this.getSourceLabel(
                    sourceKey
                ),

            adapterName,

            available:
                false,

            status:
                "UNAVAILABLE",

            timestamp:
                new Date()
                    .toISOString(),

            ageMinutes:
                0,

            reliability:
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

            details:
                {},

            raw:
                null,

            durationMs:
                0,

            cached:
                false,

            error:
                error ||
                "SOURCE_COLLECTION_FAILED"

        };

    },
       /* =====================================================
       DATA CONVERSION FOR VERIFICATION ENGINE
       ===================================================== */

    toVerificationCities(
        collection =
            this.latestCollection ||
            this.lastCollection
    ) {

        if (
            !collection?.ok ||
            !Array.isArray(
                collection.cities
            )
        ) {

            return [];

        }

        return collection.cities.map(
            item => {

                const official =
                    item.sources
                        ?.official ||
                    {};

                const radar =
                    item.sources
                        ?.radar ||
                    {};

                const satellite =
                    item.sources
                        ?.satellite ||
                    {};

                const lightning =
                    item.sources
                        ?.lightning ||
                    {};

                const openMeteo =
                    item.sources
                        ?.openMeteo ||
                    {};

                const localAI =
                    item.sources
                        ?.localAI ||
                    {};

                return {

                    name:
                        item.city,

                    city:
                        item.city,

                    cityId:
                        item.cityId,

                    lat:
                        this.safeNumber(
                            item.lat,
                            0
                        ),

                    lon:
                        this.safeNumber(
                            item.lon,
                            0
                        ),

                    sourceCoverage:
                        this.safeNumber(
                            item.coverage,
                            0
                        ),

                    readyForVerification:
                        item
                            .readyForVerification ===
                        true,

                    missingRequiredSources:
                        Array.isArray(
                            item
                                .missingRequiredSources
                        )
                            ? [
                                ...item
                                    .missingRequiredSources
                            ]
                            : [],

                    officialData: {

                        available:
                            official
                                .available ===
                            true,

                        status:
                            official.status ||
                            "PENDING_API",

                        rainProbability:
                            this.safeNumber(

                                official
                                    .rainProbability,

                                0

                            ),

                        rainAmount:
                            this.safeNumber(

                                official
                                    .rainAmount,

                                0

                            ),

                        warningLevel:
                            official
                                .warningLevel ||
                            official
                                .details
                                ?.warningLevel ||
                            "UNKNOWN",

                        issuedAt:
                            official
                                .details
                                ?.issuedAt ||
                            official
                                .timestamp ||
                            null,

                        reliability:
                            this.safeNumber(

                                official
                                    .reliability,

                                0

                            ),

                        confidence:
                            this.safeNumber(

                                official
                                    .confidence,

                                0

                            ),

                        signalScore:
                            this.safeNumber(

                                official
                                    .signalScore,

                                0

                            ),

                        sourceStatus:
                            official
                                .status ||
                            "UNAVAILABLE"
                    },

                    radarData: {

                        available:
                            radar
                                .available ===
                            true,

                        intensity:
                            this.safeNumber(

                                radar
                                    .details
                                    ?.intensity ??

                                radar
                                    .rainAmount,

                                0

                            ),

                        rainDetected:

                            radar
                                .details
                                ?.rainDetected ===
                                true ||

                            radar
                                .signalScore >
                                0 ||

                            radar
                                .rainAmount >
                                0,

                        movementConfidence:
                            this.safeNumber(

                                radar
                                    .details
                                    ?.movementConfidence ??

                                radar
                                    .confidence,

                                0

                            ),

                        frameAgeMinutes:
                            this.safeNumber(

                                radar
                                    .details
                                    ?.frameAgeMinutes ??

                                radar
                                    .ageMinutes,

                                0

                            ),

                        reliability:
                            this.safeNumber(

                                radar
                                    .reliability,

                                0

                            ),

                        confidence:
                            this.safeNumber(

                                radar
                                    .confidence,

                                0

                            ),

                        signalScore:
                            this.safeNumber(

                                radar
                                    .signalScore,

                                0

                            ),

                        sourceStatus:
                            radar
                                .status ||
                            "UNAVAILABLE"
                    },

                    satelliteData: {

                        available:
                            satellite
                                .available ===
                            true,

                        cloudCover:
                            this.safeNumber(

                                satellite
                                    .details
                                    ?.cloudCover,

                                0

                            ),

                        convectionScore:
                            this.safeNumber(

                                satellite
                                    .details
                                    ?.convectionScore ??

                                satellite
                                    .signalScore,

                                0

                            ),

                        cloudTemperature:
                            this.safeNumber(

                                satellite
                                    .details
                                    ?.cloudTemperature,

                                0

                            ),

                        stormCellScore:
                            this.safeNumber(

                                satellite
                                    .details
                                    ?.stormCellScore ??

                                satellite
                                    .confidence,

                                0

                            ),

                        reliability:
                            this.safeNumber(

                                satellite
                                    .reliability,

                                0

                            ),

                        confidence:
                            this.safeNumber(

                                satellite
                                    .confidence,

                                0

                            ),

                        signalScore:
                            this.safeNumber(

                                satellite
                                    .signalScore,

                                0

                            ),

                        sourceStatus:
                            satellite
                                .status ||
                            "UNAVAILABLE"
                    },

                    lightningData: {

                        available:
                            lightning
                                .available ===
                            true,

                        strikes:
                            this.safeNumber(

                                lightning
                                    .details
                                    ?.strikes,

                                0

                            ),

                        distanceKm:
                            this.safeNumber(

                                lightning
                                    .details
                                    ?.distanceKm,

                                0

                            ),

                        activityScore:
                            this.safeNumber(

                                lightning
                                    .details
                                    ?.activityScore ??

                                lightning
                                    .signalScore,

                                0

                            ),

                        trend:
                            lightning
                                .details
                                ?.trend ||
                            "STABLE",

                        reliability:
                            this.safeNumber(

                                lightning
                                    .reliability,

                                0

                            ),

                        confidence:
                            this.safeNumber(

                                lightning
                                    .confidence,

                                0

                            ),

                        signalScore:
                            this.safeNumber(

                                lightning
                                    .signalScore,

                                0

                            ),

                        sourceStatus:
                            lightning
                                .status ||
                            "UNAVAILABLE"
                    },

                    openMeteoData: {

                        available:
                            openMeteo
                                .available ===
                            true,

                        rainProbability:
                            this.safeNumber(

                                openMeteo
                                    .rainProbability,

                                0

                            ),

                        rainAmount:
                            this.safeNumber(

                                openMeteo
                                    .rainAmount,

                                0

                            ),

                        humidity:
                            this.safeNumber(

                                openMeteo
                                    .details
                                    ?.humidity,

                                0

                            ),

                        cloudCover:
                            this.safeNumber(

                                openMeteo
                                    .details
                                    ?.cloudCover,

                                0

                            ),

                        windSpeed:
                            this.safeNumber(

                                openMeteo
                                    .details
                                    ?.windSpeed,

                                0

                            ),

                        pressure:
                            this.safeNumber(

                                openMeteo
                                    .details
                                    ?.pressure,

                                0

                            ),

                        reliability:
                            this.safeNumber(

                                openMeteo
                                    .reliability,

                                0

                            ),

                        confidence:
                            this.safeNumber(

                                openMeteo
                                    .confidence,

                                0

                            ),

                        signalScore:
                            this.safeNumber(

                                openMeteo
                                    .signalScore,

                                0

                            ),

                        sourceStatus:
                            openMeteo
                                .status ||
                            "UNAVAILABLE"
                    },

                    localModelData: {

                        available:
                            localAI
                                .available ===
                            true,

                        weatherScore:
                            this.safeNumber(

                                localAI
                                    .details
                                    ?.weatherScore ??

                                localAI
                                    .signalScore,

                                0

                            ),

                        floodIndex:
                            this.safeNumber(

                                localAI
                                    .details
                                    ?.floodIndex,

                                0

                            ),

                        roadRisk:
                            this.safeNumber(

                                localAI
                                    .details
                                    ?.roadRisk,

                                0

                            ),

                        finalRisk:
                            this.safeNumber(

                                localAI
                                    .details
                                    ?.finalRisk ??

                                localAI
                                    .signalScore,

                                0

                            ),

                        confidence:
                            this.safeNumber(

                                localAI
                                    .details
                                    ?.confidence ??

                                localAI
                                    .confidence,

                                0

                            ),

                        reliability:
                            this.safeNumber(

                                localAI
                                    .reliability,

                                0

                            ),

                        signalScore:
                            this.safeNumber(

                                localAI
                                    .signalScore,

                                0

                            ),

                        sourceStatus:
                            localAI
                                .status ||
                            "UNAVAILABLE"
                    }

                };

            }
        );

    },

    async collectAndVerify(
        cities = []
    ) {

        const collection =
            await this.collectForCities(
                cities
            );

        if (
            !collection?.ok
        ) {

            return {

                ok:
                    false,

                collection,

                verificationCities:
                    [],

                verification:
                    [],

                summary:
                    null,

                reason:
                    collection
                        ?.reason ||
                    "SOURCE_COLLECTION_FAILED"

            };

        }

        const verificationCities =
            this.toVerificationCities(
                collection
            );

        if (
            !verificationCities.length
        ) {

            return {

                ok:
                    false,

                collection,

                verificationCities:
                    [],

                verification:
                    [],

                summary:
                    null,

                reason:
                    "NO_VERIFICATION_CITIES"

            };

        }

        const verificationEngine =
            window.RG30
                ?.VerificationEngine;

        if (
            !verificationEngine ||
            typeof verificationEngine
                .run !==
                "function"
        ) {

            return {

                ok:
                    false,

                collection,

                verificationCities,

                verification:
                    [],

                summary:
                    null,

                reason:
                    "VERIFICATION_ENGINE_UNAVAILABLE"

            };

        }

        if (
            verificationEngine
                .cycleInProgress
        ) {

            this.writeCommander(

                this.text(

                    "Verification engine is already running. Waiting for the current verification cycle.",

                    "محرك التحقق يعمل حاليًا. جارٍ انتظار انتهاء دورة التحقق الحالية."

                ),

                "warning"

            );

            const waitResult =
                await this.waitForCondition(

                    () =>
                        !verificationEngine
                            .cycleInProgress,

                    this.config
                        .timeoutMs

                );

            if (
                !waitResult
            ) {

                return {

                    ok:
                        false,

                    collection,

                    verificationCities,

                    verification:
                        verificationEngine
                            .latestVerification ||
                        [],

                    summary:
                        verificationEngine
                            .latestNationalSummary ||
                        null,

                    reason:
                        "VERIFICATION_ENGINE_BUSY_TIMEOUT"

                };

            }

        }

        const verification =
            await verificationEngine
                .run(
                    verificationCities
                );

        const summary =
            verificationEngine
                .latestNationalSummary ||
            null;

        const result = {

            ok:
                true,

            version:
                this.version,

            timestamp:
                new Date()
                    .toISOString(),

            collection,

            verificationCities,

            verification:
                Array.isArray(
                    verification
                )
                    ? verification
                    : [],

            summary

        };

        window.RG30
            .latestSourceVerification =
            result;

        window.dispatchEvent(

            new CustomEvent(

                "rg30:source-verification-completed",

                {
                    detail:
                        result
                }

            )

        );

        return result;

    },

    waitForCondition(
        condition,
        timeoutMs = 15000,
        intervalMs = 200
    ) {

        return new Promise(
            resolve => {

                const startedAt =
                    Date.now();

                const check =
                    () => {

                        let completed =
                            false;

                        try {

                            completed =
                                Boolean(
                                    condition()
                                );

                        } catch (error) {

                            completed =
                                false;

                        }

                        if (
                            completed
                        ) {

                            resolve(
                                true
                            );

                            return;

                        }

                        if (
                            Date.now() -
                            startedAt >=
                            timeoutMs
                        ) {

                            resolve(
                                false
                            );

                            return;

                        }

                        window.setTimeout(
                            check,
                            intervalMs
                        );

                    };

                check();

            }
        );

    },
       /* =====================================================
       SUMMARY AND SOURCE HEALTH
       ===================================================== */

    buildCollectionSummary(
        cityResults = []
    ) {

        const sourceNames =
            Object.keys(
                this.config.sources
            );

        const sourceSummary =
            {};

        sourceNames.forEach(
            key => {

                sourceSummary[key] = {

                    name:
                        this.getSourceLabel(
                            key
                        ),

                    available:
                        0,

                    unavailable:
                        0,

                    cached:
                        0,

                    averageResponse:
                        0,

                    reliability:
                        this.config.sources[key]
                            .reliability,

                    health:
                        "UNKNOWN"

                };

            }
        );

        cityResults.forEach(
            city => {

                Object.entries(
                    city.sources || {}
                )
                .forEach(
                    (
                        [
                            sourceKey,
                            source
                        ]
                    ) => {

                        if (
                            !sourceSummary[
                                sourceKey
                            ]
                        ) {

                            return;

                        }

                        if (
                            source.available
                        ) {

                            sourceSummary[
                                sourceKey
                            ].available++;

                        } else {

                            sourceSummary[
                                sourceKey
                            ].unavailable++;

                        }

                        if (
                            source.cached
                        ) {

                            sourceSummary[
                                sourceKey
                            ].cached++;

                        }

                        sourceSummary[
                            sourceKey
                        ].averageResponse +=
                            this.safeNumber(
                                source.durationMs,
                                0
                            );

                    }
                );

            }
        );

        sourceNames.forEach(
            key => {

                const summary =
                    sourceSummary[key];

                const total =

                    summary.available +
                    summary.unavailable;

                if (
                    total > 0
                ) {

                    summary.averageResponse =
                        Math.round(

                            summary.averageResponse /
                            total

                        );

                }

                const ratio =
                    total > 0
                        ? summary.available / total
                        : 0;

                if (
                    ratio >= 0.90
                ) {

                    summary.health =
                        "EXCELLENT";

                } else if (
                    ratio >= 0.75
                ) {

                    summary.health =
                        "GOOD";

                } else if (
                    ratio >= 0.50
                ) {

                    summary.health =
                        "WARNING";

                } else {

                    summary.health =
                        "CRITICAL";

                }

            }
        );

        const coverage =

            cityResults.length > 0

                ?

                Math.round(

                    cityResults.reduce(

                        (
                            total,
                            city
                        ) => {

                            return (

                                total +

                                this.safeNumber(
                                    city.coverage,
                                    0
                                )

                            );

                        },

                        0

                    ) /

                    cityResults.length

                )

                :

                0;

        return {

            coverage,

            totalCities:
                cityResults.length,

            sourceSummary,

            rankedSources:
                this.rankSources(),

            timestamp:
                new Date()
                    .toISOString()

        };

    },

    /* =====================================================
       SOURCE HEALTH
       ===================================================== */

    getSourceStates() {

        return Object.values(
            this.sourceStates
        )
        .map(
            state => ({

                ...state,

                health:
                    this.evaluateHealth(
                        state
                    )

            })
        );

    },

    evaluateHealth(
        state
    ) {

        const attempts =
            state.successes +
            state.failures;

        if (
            attempts === 0
        ) {

            return "UNKNOWN";

        }

        const ratio =
            state.successes /
            attempts;

        if (
            ratio >= 0.95
        ) {

            return "EXCELLENT";

        }

        if (
            ratio >= 0.80
        ) {

            return "GOOD";

        }

        if (
            ratio >= 0.60
        ) {

            return "WARNING";

        }

        return "CRITICAL";

    },

    /* =====================================================
       SOURCE RANKING
       ===================================================== */

    rankSources() {

        return Object.values(
            this.sourceStates
        )
        .sort(

            (
                first,
                second
            ) => {

                const firstScore =

                    first.reliability * 100 +

                    first.successes -

                    first.failures;

                const secondScore =

                    second.reliability * 100 +

                    second.successes -

                    second.failures;

                return (
                    secondScore -
                    firstScore
                );

            }

        )
        .map(
            (
                state,
                index
            ) => ({

                rank:
                    index + 1,

                key:
                    state.key,

                name:
                    state.name,

                reliability:
                    state.reliability,

                health:
                    this.evaluateHealth(
                        state
                    )

            })
        );

    },

    /* =====================================================
       MISSING REQUIRED SOURCES
       ===================================================== */

    findMissingRequiredSources(
        city
    ) {

        const missing =
            [];

        Object.entries(
            this.config.sources
        )
        .forEach(

            (
                [
                    key,
                    config
                ]
            ) => {

                if (
                    !config.required
                ) {

                    return;

                }

                if (
                    !city.sources?.[
                        key
                    ]?.available
                ) {

                    missing.push(
                        this.getSourceLabel(
                            key
                        )
                    );

                }

            }

        );

        return missing;

    },

    /* =====================================================
       RESPONSE TIME
       ===================================================== */

    getAverageResponseTime() {

        const states =
            Object.values(
                this.sourceStates
            );

        if (
            !states.length
        ) {

            return 0;

        }

        const total =
            states.reduce(

                (
                    sum,
                    state
                ) => {

                    return (

                        sum +

                        this.safeNumber(

                            state.averageDurationMs,

                            0

                        )

                    );

                },

                0

            );

        return Math.round(

            total /
            states.length

        );

    },
       /* =====================================================
       RENDERING
       ===================================================== */

    renderStatus(
        collection =
            this.latestCollection
    ) {

        const panel =
            document.getElementById(
                "sourceAdapterStatusPanel"
            );

        if (!panel) {
            return;
        }

        if (
            !collection ||
            !collection.sourceStates
        ) {

            panel.innerHTML = `
                <div class="empty-state">

                    ${this.text(
                        "Waiting for source collection...",
                        "بانتظار جمع بيانات المصادر..."
                    )}

                </div>
            `;

            return;
        }

        const states =
            collection.sourceStates;

        let html = "";

        html += `
            <div class="item info">

                <h3>

                    ${this.text(
                        "National Source Adapter Layer",
                        "طبقة محولات المصادر الوطنية"
                    )}

                </h3>

                <b>
                ${this.text(
                    "Collection",
                    "رقم الدورة"
                )}
                :</b>

                ${collection.collectionNumber}

                <br>

                <b>
                ${this.text(
                    "Coverage",
                    "التغطية"
                )}
                :</b>

                ${collection.summary.coverage}%

                <br>

                <b>
                ${this.text(
                    "Cities",
                    "المدن"
                )}
                :</b>

                ${collection.summary.totalCities}

                <br>

                <b>
                ${this.text(
                    "Average Response",
                    "متوسط زمن الاستجابة"
                )}
                :</b>

                ${this.getAverageResponseTime()} ms

            </div>
        `;

        states.forEach(
            state => {

                html +=
                    this.renderSourceCard(
                        state
                    );

            }
        );

        panel.innerHTML =
            html;

    },

    renderSourceCard(
        state
    ) {

        const health =
            this.evaluateHealth(
                state
            );

        let css =
            "info";

        switch (
            health
        ) {

            case "EXCELLENT":
                css =
                    "success";
                break;

            case "GOOD":
                css =
                    "success";
                break;

            case "WARNING":
                css =
                    "warning";
                break;

            case "CRITICAL":
                css =
                    "danger";
                break;

        }

        return `

        <div class="item ${css}">

            <h3>

                ${this.escapeHtml(
                    state.name
                )}

            </h3>

            <b>

            ${this.text(
                "Adapter",
                "المحول"
            )}

            :</b>

            ${state.adapterName}

            <br>

            <b>

            ${this.text(
                "Status",
                "الحالة"
            )}

            :</b>

            ${this.getStatusLabel(
                state.status
            )}

            <br>

            <b>

            ${this.text(
                "Health",
                "الصحة"
            )}

            :</b>

            ${this.getHealthLabel(
                health
            )}

            <br>

            <b>

            ${this.text(
                "Reliability",
                "الاعتمادية"
            )}

            :</b>

            ${Math.round(
                state.reliability *
                100
            )}%

            <br>

            <b>

            ${this.text(
                "Attempts",
                "المحاولات"
            )}

            :</b>

            ${state.attempts}

            <br>

            <b>

            ${this.text(
                "Success",
                "النجاح"
            )}

            :</b>

            ${state.successes}

            <br>

            <b>

            ${this.text(
                "Failures",
                "الإخفاقات"
            )}

            :</b>

            ${state.failures}

            <br>

            <b>

            ${this.text(
                "Cache Hits",
                "استخدام الذاكرة"
            )}

            :</b>

            ${state.cacheHits}

            <br>

            <b>

            ${this.text(
                "Average Response",
                "متوسط الاستجابة"
            )}

            :</b>

            ${state.averageDurationMs} ms

        </div>

        `;

    },

    getHealthLabel(
        health
    ) {

        const labels = {

            EXCELLENT: {

                en:
                    "Excellent",

                ar:
                    "ممتاز"

            },

            GOOD: {

                en:
                    "Good",

                ar:
                    "جيد"

            },

            WARNING: {

                en:
                    "Warning",

                ar:
                    "تحذير"

            },

            CRITICAL: {

                en:
                    "Critical",

                ar:
                    "حرج"

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
                String(
                    health ||
                    "UNKNOWN"
                )
                .toUpperCase()
            ];

        if (!item) {

            return health;

        }

        return this.isArabic()
            ? item.ar
            : item.en;

    },

    refreshUI() {

        if (
            this.latestCollection
        ) {

            this.renderStatus(
                this.latestCollection
            );

        }

    },
       /* =====================================================
       EVENTS
       ===================================================== */

    publishCollection(
        collection
    ) {

        window.RG30 =
            window.RG30 || {};

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

        window.dispatchEvent(

            new CustomEvent(

                "rg30:source-status-updated",

                {
                    detail:
                        this.getSourceStates()
                }

            )

        );

    },

    /* =====================================================
       COMMANDER
       ===================================================== */

    writeCommander(
        message,
        type = "info"
    ) {

        const translated =
            this.translateMessage(
                message
            );

        console.log(
            `[RG30 SourceAdapter] ${translated}`
        );

        if (
            window.RG23
                ?.Brain
                ?.writeCommander
        ) {

            try {

                window.RG23.Brain.writeCommander(
                    translated,
                    type
                );

                return;

            } catch (e) {}

        }

        if (
            window.RG30
                ?.Orchestrator
                ?.writeCommander
        ) {

            try {

                window.RG30.Orchestrator.writeCommander(
                    translated,
                    type
                );

            } catch (e) {}

        }

    },

    /* =====================================================
       HELPERS
       ===================================================== */

    delay(
        ms
    ) {

        return new Promise(
            resolve =>
                setTimeout(
                    resolve,
                    ms
                )
        );

    },

    withTimeout(
        promise,
        timeout
    ) {

        return Promise.race([

            promise,

            new Promise(

                (
                    _,
                    reject
                ) => {

                    setTimeout(

                        () => {

                            reject(

                                new Error(

                                    `SOURCE_TIMEOUT_AFTER_${timeout}`

                                )

                            );

                        },

                        timeout

                    );

                }

            )

        ]);

    },

    normalizeCity(
        city,
        index = 0
    ) {

        return {

            id:
                city.id ??
                index,

            name:
                city.name ||
                city.city ||
                "Unknown",

            lat:
                this.safeNumber(
                    city.lat,
                    city.latitude
                ),

            lon:
                this.safeNumber(
                    city.lon,
                    city.longitude
                ),

            raw:
                city

        };

    },

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

    clamp(
        value,
        min,
        max
    ) {

        return Math.min(

            max,

            Math.max(
                min,
                this.safeNumber(
                    value,
                    min
                )
            )

        );

    },

    escapeHtml(
        text
    ) {

        return String(
            text ?? ""
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

    /* =====================================================
       RESET
       ===================================================== */

    reset() {

        this.collecting =
            false;

        this.collectionNumber =
            0;

        this.lastCollection =
            null;

        this.latestCollection =
            null;

        this.sourceCache.clear();

        this.initializeSourceStates();

        this.writeCommander(

            this.text(

                "Source Adapter has been reset.",

                "تمت إعادة ضبط محولات المصادر."

            ),

            "warning"

        );

    },

    destroy() {

        this.reset();

        this.initialized =
            false;

        console.log(
            "RG30 Source Adapter destroyed."
        );

    }

};

/* =========================================================
   GLOBAL SHORTCUTS
   ========================================================= */

window.collectNationalSources =
    cities =>

        RG30.SourceAdapter.collectForCities(
            cities
        );

window.collectAndVerifyNationalSources =
    cities =>

        RG30.SourceAdapter.collectAndVerify(
            cities
        );

window.getSourceAdapterState =
    () =>

        RG30.SourceAdapter.getSourceStates();

window.clearSourceCache =
    () =>

        RG30.SourceAdapter.clearCache();

window.resetSourceAdapter =
    () =>

        RG30.SourceAdapter.reset();

/* =========================================================
   AUTO START
   ========================================================= */

window.addEventListener(

    "DOMContentLoaded",

    () => {

        try {

            RG30.SourceAdapter.init();

            console.log(

                "%cRainGuard AI V30 Source Adapter Ready",

                "color:#1dd1a1;font-weight:bold;font-size:14px;"

            );

        }

        catch (error) {

            console.error(

                "Source Adapter initialization failed:",

                error

            );

        }

    },

    {
        once: true
    }

);
