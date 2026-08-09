/*
===============================================================================
 RainGuard AI
 Phase 39A-12 — National City Registry Bridge
 File: national_city_registry_bridge_v39.js
 Version: 39A.12.0
===============================================================================
*/
(function (global) {
    "use strict";

    const PHASE = "39A-12";
    const VERSION = "39A.12.0";
    const BUILD = "rainguard-v39-national-city-registry-bridge";
    const now = () => Date.now();

    function finite(v) {
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
    }

    function toArray(v) {
        if (!v) return [];
        if (Array.isArray(v)) return v;
        if (v instanceof Map || v instanceof Set) return Array.from(v.values());

        if (typeof v === "object") {
            for (const k of ["cities","locations","items","data","results","result","payload","output"]) {
                const n = v[k];
                if (Array.isArray(n)) return n;
                if (n instanceof Map || n instanceof Set) return Array.from(n.values());
            }
        }
        return [];
    }

    function normalizeCity(raw, index) {
        if (!raw || typeof raw !== "object") return null;

        const latitude = finite(
            raw.latitude ?? raw.lat ??
            raw.location?.latitude ?? raw.location?.lat ??
            raw.coordinates?.latitude ?? raw.coordinates?.lat
        );

        const longitude = finite(
            raw.longitude ?? raw.lon ?? raw.lng ??
            raw.location?.longitude ?? raw.location?.lon ?? raw.location?.lng ??
            raw.coordinates?.longitude ?? raw.coordinates?.lon ?? raw.coordinates?.lng
        );

        if (latitude === null || longitude === null) return null;

        const name =
            raw.name ?? raw.nameAr ?? raw.city ?? raw.cityName ??
            raw.label ?? raw.arabicName ?? raw.nameEn ??
            `City ${index + 1}`;

        const id =
            raw.id ?? raw.code ?? raw.slug ?? raw.cityId ??
            raw.locationId ?? raw.nameEn ?? raw.name ??
            `${latitude}:${longitude}`;

        return {
            id: String(id),
            name: String(name),
            nameEn: raw.nameEn ?? raw.englishName ?? raw.nameEnglish ?? null,
            region: raw.region ?? raw.regionName ?? raw.province ?? raw.area ?? null,
            latitude,
            longitude,
            sourceRaw: raw
        };
    }

    function uniqueCities(items) {
        const seen = new Set();
        const out = [];

        items.forEach((item, i) => {
            const city = normalizeCity(item, i);
            if (!city) return;

            const key = `${city.id}|${city.latitude.toFixed(5)}|${city.longitude.toFixed(5)}`;
            if (seen.has(key)) return;

            seen.add(key);
            out.push(city);
        });

        return out;
    }

    function callGlobalFunction(name) {
        const fn = global[name];
        if (typeof fn !== "function") return [];

        try {
            const result = fn();
            if (result && typeof result.then === "function") return [];
            return toArray(result);
        } catch (_) {
            return [];
        }
    }

    function inspectRegistry(registry) {
        if (!registry) return [];

        try {
            if (typeof registry.getAll === "function") {
                const a = toArray(registry.getAll());
                if (a.length) return a;
            }
        } catch (_) {}

        try {
            if (typeof registry.getCities === "function") {
                const a = toArray(registry.getCities());
                if (a.length) return a;
            }
        } catch (_) {}

        for (const k of ["cities","locations","items","data"]) {
            const a = toArray(registry[k]);
            if (a.length) return a;
        }

        return [];
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
            this.statistics = {
                refreshes: 0,
                successfulRefreshes: 0,
                emptyRefreshes: 0,
                failures: 0
            };
        }

        discover() {
            const candidates = [
                ["getRainArrivalCities", callGlobalFunction("getRainArrivalCities")],
                ["getNationalCities", callGlobalFunction("getNationalCities")],
                ["SaudiLocationsRegistryV32", inspectRegistry(global.SaudiLocationsRegistryV32)],
                ["SaudiLocationsRegistryV32Instance", inspectRegistry(global.SaudiLocationsRegistryV32Instance)],
                ["SaudiLocationsRegistryV32Data", toArray(global.SaudiLocationsRegistryV32Data)]
            ];

            for (const [source, items] of candidates) {
                const cities = uniqueCities(items);
                if (cities.length) {
                    return { source, cities };
                }
            }

            return { source: null, cities: [] };
        }

        publish() {
            global.RainGuardNationalCityRegistryBridgeV39 = this;

            global.RainGuardAI = global.RainGuardAI || {};
            global.RainGuardAI.V39 = global.RainGuardAI.V39 || {};
            global.RainGuardAI.V32 = global.RainGuardAI.V32 || {};
            global.RainGuardAI.V32.rainArrivalModules =
                global.RainGuardAI.V32.rainArrivalModules || {};

            global.RainGuardAI.V39.nationalCityRegistryBridge = this;
            global.RainGuardAI.V32.saudiLocationsRegistry = this;
            global.RainGuardAI.V32.rainArrivalModules.saudiLocationsRegistry = this;

            // Compatibility for Phase 39A-11 resolver
            global.SaudiLocationsRegistryV32 = this;
        }

        refresh() {
            this.statistics.refreshes += 1;

            try {
                const found = this.discover();

                this.cities = found.cities;
                this.lastSource = found.source;
                this.lastUpdatedAt = now();
                this.lastError = null;

                if (this.cities.length) this.statistics.successfulRefreshes += 1;
                else this.statistics.emptyRefreshes += 1;

                this.publish();

                return {
                    success: this.cities.length > 0,
                    status: this.cities.length
                        ? "NATIONAL_CITY_REGISTRY_READY"
                        : "NATIONAL_CITY_REGISTRY_EMPTY",
                    source: this.lastSource,
                    cityCount: this.cities.length,
                    generatedAt: this.lastUpdatedAt
                };
            } catch (error) {
                this.statistics.failures += 1;
                this.lastError = {
                    name: error?.name || "Error",
                    message: error?.message || String(error),
                    stack: error?.stack || null,
                    timestamp: now()
                };

                return {
                    success: false,
                    status: "NATIONAL_CITY_REGISTRY_FAILED",
                    error: this.lastError,
                    cityCount: 0,
                    generatedAt: now()
                };
            }
        }

        getAll() {
            return this.cities.map(city => ({ ...city }));
        }

        getCities() {
            return this.getAll();
        }

        getById(id) {
            return this.cities.find(city => String(city.id) === String(id)) || null;
        }

        getByName(name) {
            const wanted = String(name).trim().toLowerCase();

            return this.cities.find(city =>
                String(city.name).trim().toLowerCase() === wanted ||
                String(city.nameEn || "").trim().toLowerCase() === wanted
            ) || null;
        }

        diagnose() {
            const result = {
                phase: PHASE,
                version: VERSION,
                build: BUILD,
                source: this.lastSource,
                cityCount: this.cities.length,
                lastUpdatedAt: this.lastUpdatedAt,
                lastError: this.lastError,
                statistics: { ...this.statistics },
                sample: this.cities.slice(0, 10)
            };

            console.log(
                "[RainGuard Phase 39A-12] National City Registry Bridge",
                result
            );

            return result;
        }
    }

    const registry = new NationalCityRegistryBridgeV39();

    global.refreshRainGuardNationalCityRegistry = () => registry.refresh();
    global.diagnoseRainGuardNationalCityRegistry = () => registry.diagnose();
    global.getRainGuardNationalCities = () => registry.getAll();

    const initial = registry.refresh();

    console.log(
        `[RainGuard AI] Phase ${PHASE} — National City Registry Bridge v${VERSION} READY`,
        initial
    );

})(typeof globalThis !== "undefined" ? globalThis : window);
