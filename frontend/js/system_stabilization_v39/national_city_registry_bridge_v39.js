/*
===============================================================================
 RainGuard AI
 Phase 39A-12B — National City Registry Source Recovery
 File: national_city_registry_bridge_v39.js
 Version: 39A.12B.0

 Replaces:
 Phase 39A-12 — National City Registry Bridge

 Purpose:
 - Recover the real national city source already present in RainGuard.
 - Prefer getNationalCities() because runtime probing confirmed it returns cities.
 - Use getRainArrivalCities() only when it actually contains cities.
 - Expand SaudiLocationsRegistryV32Data region objects into nested city arrays.
 - Preserve compatibility with Phase 39A-11 Arrival ETA Pipeline Bridge.
 - Avoid overwriting the original SaudiLocationsRegistryV32 object.
===============================================================================
*/

(function initializeNationalCityRegistryBridgeV39(global) {
    "use strict";

    const PHASE = "39A-12B";
    const VERSION = "39A.12B.0";
    const BUILD = "rainguard-v39-national-city-registry-source-recovery";

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

        if (Array.isArray(value)) return value;

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
                "cities",
                "locations",
                "items",
                "data",
                "results",
                "result",
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

    function extractLatLon(raw) {
        if (!raw || typeof raw !== "object") {
            return {
                latitude: null,
                longitude: null
            };
        }

        const latitude = finite(
            raw.latitude ??
            raw.lat ??
            raw.location?.latitude ??
            raw.location?.lat ??
            raw.coordinates?.latitude ??
            raw.coordinates?.lat ??
            raw.center?.latitude ??
            raw.center?.lat
        );

        const longitude = finite(
            raw.longitude ??
            raw.lon ??
            raw.lng ??
            raw.location?.longitude ??
            raw.location?.lon ??
            raw.location?.lng ??
            raw.coordinates?.longitude ??
            raw.coordinates?.lon ??
            raw.coordinates?.lng ??
            raw.center?.longitude ??
            raw.center?.lon ??
            raw.center?.lng
        );

        return {
            latitude,
            longitude
        };
    }

    function normalizeCity(raw, index, inheritedRegion = null) {
        if (!raw || typeof raw !== "object") {
            return null;
        }

        const coords =
            extractLatLon(raw);

        if (
            coords.latitude === null ||
            coords.longitude === null
        ) {
            return null;
        }

        const name =
            raw.name ??
            raw.nameAr ??
            raw.city ??
            raw.cityName ??
            raw.label ??
            raw.arabicName ??
            raw.nameEn ??
            raw.englishName ??
            `City ${index + 1}`;

        const id =
            raw.id ??
            raw.code ??
            raw.slug ??
            raw.cityId ??
            raw.locationId ??
            raw.nameEn ??
            raw.name ??
            `${coords.latitude}:${coords.longitude}`;

        return {
            id: String(id),

            name: String(name),

            nameAr:
                raw.nameAr ??
                raw.arabicName ??
                raw.name ??
                null,

            nameEn:
                raw.nameEn ??
                raw.englishName ??
                raw.nameEnglish ??
                null,

            region:
                raw.region ??
                raw.regionName ??
                raw.province ??
                raw.area ??
                inheritedRegion ??
                null,

            latitude:
                coords.latitude,

            longitude:
                coords.longitude,

            sourceRaw:
                raw
        };
    }

    function normalizeCityArray(items, inheritedRegion = null) {
        const result = [];
        const seen = new Set();

        for (
            let i = 0;
            i < items.length;
            i += 1
        ) {
            const city =
                normalizeCity(
                    items[i],
                    i,
                    inheritedRegion
                );

            if (!city) continue;

            const key =
                `${city.id}|${city.latitude.toFixed(5)}|${city.longitude.toFixed(5)}`;

            if (seen.has(key)) {
                continue;
            }

            seen.add(key);
            result.push(city);
        }

        return result;
    }

    async function callGlobalFunction(name) {
        const fn =
            global[name];

        if (
            typeof fn !==
            "function"
        ) {
            return {
                available: false,
                items: [],
                error: null
            };
        }

        try {
            const value =
                await Promise.resolve(
                    fn()
                );

            return {
                available: true,
                items: toArray(value),
                error: null
            };

        } catch (error) {
            return {
                available: true,
                items: [],
                error:
                    normalizeError(error)
            };
        }
    }

    async function inspectRegistryObject(registry) {
        if (!registry) {
            return [];
        }

        const methods = [
            "getAll",
            "getCities",
            "getNationalCities",
            "listCities",
            "list"
        ];

        for (const method of methods) {
            if (
                typeof registry?.[method] !==
                "function"
            ) {
                continue;
            }

            try {
                const value =
                    await Promise.resolve(
                        registry[method]()
                    );

                const items =
                    toArray(value);

                if (
                    items.length > 0
                ) {
                    return items;
                }

            } catch (_) {}
        }

        for (const key of [
            "cities",
            "locations",
            "items",
            "data"
        ]) {
            const items =
                toArray(
                    registry?.[key]
                );

            if (
                items.length > 0
            ) {
                return items;
            }
        }

        return [];
    }

    function expandRegionData(regionData) {
        const regions =
            toArray(regionData);

        const cities =
            [];

        for (const region of regions) {
            if (!region || typeof region !== "object") {
                continue;
            }

            const regionName =
                region.nameAr ??
                region.name ??
                region.nameEn ??
                region.regionName ??
                region.id ??
                null;

            const nestedCandidates = [
                region.cities,
                region.locations,
                region.governorates,
                region.items,
                region.data
            ];

            for (const nested of nestedCandidates) {
                const items =
                    toArray(nested);

                if (!items.length) {
                    continue;
                }

                for (const item of items) {
                    if (
                        item &&
                        typeof item === "object" &&
                        !item.region &&
                        !item.regionName
                    ) {
                        cities.push({
                            ...item,
                            region:
                                regionName
                        });
                    } else {
                        cities.push(
                            item
                        );
                    }
                }
            }
        }

        return cities;
    }

    class NationalCityRegistryBridgeV39 {
        constructor() {
            this.phase = PHASE;
            this.version = VERSION;
            this.build = BUILD;

            this.cities = [];
            this.lastSource = null;
            this.lastError = null;
            this.lastUpdatedAt = null;

            this.sourceReports = [];

            this.statistics = {
                refreshes: 0,
                successfulRefreshes: 0,
                emptyRefreshes: 0,
                failures: 0
            };
        }

        async discover() {
            const reports = [];

            /*
             * PRIORITY 1
             * Runtime probe confirmed getNationalCities() returns real cities.
             */
            const national =
                await callGlobalFunction(
                    "getNationalCities"
                );

            const nationalCities =
                normalizeCityArray(
                    national.items
                );

            reports.push({
                source:
                    "getNationalCities",

                available:
                    national.available,

                rawCount:
                    national.items.length,

                normalizedCount:
                    nationalCities.length,

                error:
                    national.error
            });

            if (
                nationalCities.length > 0
            ) {
                return {
                    source:
                        "getNationalCities",

                    cities:
                        nationalCities,

                    reports
                };
            }

            /*
             * PRIORITY 2
             * Rain Arrival specific list, only if it actually contains cities.
             */
            const rainArrival =
                await callGlobalFunction(
                    "getRainArrivalCities"
                );

            const rainArrivalCities =
                normalizeCityArray(
                    rainArrival.items
                );

            reports.push({
                source:
                    "getRainArrivalCities",

                available:
                    rainArrival.available,

                rawCount:
                    rainArrival.items.length,

                normalizedCount:
                    rainArrivalCities.length,

                error:
                    rainArrival.error
            });

            if (
                rainArrivalCities.length > 0
            ) {
                return {
                    source:
                        "getRainArrivalCities",

                    cities:
                        rainArrivalCities,

                    reports
                };
            }

            /*
             * PRIORITY 3
             * Existing registry instance/object.
             */
            const registryCandidates = [
                [
                    "SaudiLocationsRegistryV32Instance",
                    global.SaudiLocationsRegistryV32Instance
                ],
                [
                    "SaudiLocationsRegistryV32",
                    global.SaudiLocationsRegistryV32
                ]
            ];

            for (
                const [
                    sourceName,
                    registry
                ] of registryCandidates
            ) {
                const raw =
                    await inspectRegistryObject(
                        registry
                    );

                const normalized =
                    normalizeCityArray(
                        raw
                    );

                reports.push({
                    source:
                        sourceName,

                    available:
                        Boolean(registry),

                    rawCount:
                        raw.length,

                    normalizedCount:
                        normalized.length,

                    error:
                        null
                });

                if (
                    normalized.length > 0
                ) {
                    return {
                        source:
                            sourceName,

                        cities:
                            normalized,

                        reports
                    };
                }
            }

            /*
             * PRIORITY 4
             * SaudiLocationsRegistryV32Data is a 13-region array.
             * Expand each region.cities into a flat city list.
             */
            const regionRaw =
                toArray(
                    global.SaudiLocationsRegistryV32Data
                );

            const expanded =
                expandRegionData(
                    regionRaw
                );

            const expandedCities =
                normalizeCityArray(
                    expanded
                );

            reports.push({
                source:
                    "SaudiLocationsRegistryV32Data",

                available:
                    regionRaw.length > 0,

                rawCount:
                    regionRaw.length,

                expandedCount:
                    expanded.length,

                normalizedCount:
                    expandedCities.length,

                error:
                    null
            });

            if (
                expandedCities.length > 0
            ) {
                return {
                    source:
                        "SaudiLocationsRegistryV32Data",

                    cities:
                        expandedCities,

                    reports
                };
            }

            return {
                source: null,
                cities: [],
                reports
            };
        }

        publish() {
            global.RainGuardNationalCityRegistryBridgeV39 =
                this;

            global.RainGuardAI =
                global.RainGuardAI || {};

            global.RainGuardAI.V39 =
                global.RainGuardAI.V39 || {};

            global.RainGuardAI.V32 =
                global.RainGuardAI.V32 || {};

            global.RainGuardAI.V32
                .rainArrivalModules =
                global.RainGuardAI.V32
                    .rainArrivalModules || {};

            global.RainGuardAI.V39
                .nationalCityRegistryBridge =
                this;

            global.RainGuardAI.V32
                .saudiLocationsRegistry =
                this;

            global.RainGuardAI.V32
                .rainArrivalModules
                .saudiLocationsRegistry =
                this;

            /*
             * IMPORTANT:
             * Do NOT overwrite the original SaudiLocationsRegistryV32.
             * Phase 39A-12 did that and could hide the native registry.
             */

            global.RainGuardNationalCitiesV39 =
                this.getAll();
        }

        async refresh() {
            this.statistics.refreshes += 1;

            try {
                const found =
                    await this.discover();

                this.cities =
                    found.cities;

                this.lastSource =
                    found.source;

                this.sourceReports =
                    found.reports;

                this.lastUpdatedAt =
                    now();

                this.lastError =
                    null;

                if (
                    this.cities.length > 0
                ) {
                    this.statistics.successfulRefreshes += 1;
                } else {
                    this.statistics.emptyRefreshes += 1;
                }

                this.publish();

                return {
                    success:
                        this.cities.length > 0,

                    status:
                        this.cities.length > 0
                            ? "NATIONAL_CITY_REGISTRY_READY"
                            : "NATIONAL_CITY_REGISTRY_EMPTY",

                    phase:
                        PHASE,

                    version:
                        VERSION,

                    source:
                        this.lastSource,

                    cityCount:
                        this.cities.length,

                    generatedAt:
                        this.lastUpdatedAt
                };

            } catch (error) {
                this.statistics.failures += 1;

                this.lastError =
                    normalizeError(
                        error
                    );

                return {
                    success: false,

                    status:
                        "NATIONAL_CITY_REGISTRY_FAILED",

                    phase:
                        PHASE,

                    version:
                        VERSION,

                    cityCount:
                        0,

                    error:
                        this.lastError,

                    generatedAt:
                        now()
                };
            }
        }

        getAll() {
            return this.cities.map(
                city => ({
                    ...city
                })
            );
        }

        getCities() {
            return this.getAll();
        }

        getById(id) {
            const wanted =
                String(id);

            return (
                this.cities.find(
                    city =>
                        String(city.id) ===
                        wanted
                ) ||
                null
            );
        }

        getByName(name) {
            const wanted =
                String(name)
                    .trim()
                    .toLowerCase();

            return (
                this.cities.find(
                    city =>
                        String(
                            city.name
                        )
                            .trim()
                            .toLowerCase() ===
                            wanted ||

                        String(
                            city.nameAr ||
                            ""
                        )
                            .trim()
                            .toLowerCase() ===
                            wanted ||

                        String(
                            city.nameEn ||
                            ""
                        )
                            .trim()
                            .toLowerCase() ===
                            wanted
                ) ||
                null
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

                source:
                    this.lastSource,

                cityCount:
                    this.cities.length,

                lastUpdatedAt:
                    this.lastUpdatedAt,

                lastError:
                    this.lastError,

                statistics:
                    {
                        ...this.statistics
                    },

                sourceReports:
                    this.sourceReports,

                sample:
                    this.cities.slice(
                        0,
                        10
                    )
            };

            console.log(
                "[RainGuard Phase 39A-12B] National City Registry Source Recovery",
                result
            );

            return result;
        }
    }

    const registry =
        new NationalCityRegistryBridgeV39();

    global.refreshRainGuardNationalCityRegistry =
        () =>
            registry.refresh();

    global.diagnoseRainGuardNationalCityRegistry =
        () =>
            registry.diagnose();

    global.getRainGuardNationalCities =
        () =>
            registry.getAll();

    Promise.resolve(
        registry.refresh()
    )
        .then(
            result => {
                console.log(
                    `[RainGuard AI] Phase ${PHASE} — National City Registry Source Recovery v${VERSION} READY`,
                    result
                );
            }
        )
        .catch(
            error => {
                console.error(
                    `[RainGuard AI] Phase ${PHASE} initialization failed`,
                    normalizeError(error)
                );
            }
        );

})(
    typeof globalThis !== "undefined"
        ? globalThis
        : window
);
