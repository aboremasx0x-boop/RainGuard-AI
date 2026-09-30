/* =========================================================
   RainGuard AI V32
   FORECAST-1J2 — Hydrological Context Layer
   Version: FORECAST-1J2.0

   Purpose:
   - Store and normalize REAL hydrological/spatial evidence for a city.
   - Never invent terrain, wadi, drainage, soil-moisture or land-cover values.
   - Explicitly mark unavailable factors as MISSING.
   - Prepare a safe context object for later Flood Risk Engine integration.

   This layer does NOT itself predict floods.
   ========================================================= */

(function () {
    "use strict";

    const NAME = "HydrologicalContextLayerV32";
    const VERSION = "FORECAST-1J2.0";

    const FACTORS = Object.freeze([
        "terrain",
        "slope",
        "wadi_proximity",
        "drainage_capacity",
        "soil_moisture",
        "land_cover"
    ]);

    const numOrNull = value => {
        if (value === null || value === undefined || value === "") return null;
        const n = Number(value);
        return Number.isFinite(n) ? n : null;
    };

    function normalizeEvidence(input) {
        if (!input || typeof input !== "object") {
            return {
                status: "MISSING",
                available: false,
                value: null,
                unit: null,
                source: null,
                observedAt: null,
                quality: null
            };
        }

        const available =
            input.available === true &&
            input.value !== null &&
            input.value !== undefined;

        return {
            status: available ? "AVAILABLE" : "MISSING",
            available,
            value: available ? input.value : null,
            numericValue: available ? numOrNull(input.value) : null,
            unit: input.unit ?? null,
            source: input.source ?? null,
            observedAt: input.observedAt ?? null,
            quality: input.quality ?? null,
            metadata: input.metadata ?? null
        };
    }

    function build(city = {}, evidence = {}) {
        const factors = {};

        FACTORS.forEach(key => {
            factors[key] = normalizeEvidence(evidence[key]);
        });

        const availableFactors =
            FACTORS.filter(key => factors[key].available);

        const missingFactors =
            FACTORS.filter(key => !factors[key].available);

        const completeness =
            Math.round(
                (availableFactors.length / FACTORS.length) * 100
            );

        const result = {
            layer: NAME,
            version: VERSION,
            status:
                availableFactors.length === 0
                    ? "HYDROLOGICAL_CONTEXT_MISSING"
                    : missingFactors.length === 0
                        ? "HYDROLOGICAL_CONTEXT_COMPLETE"
                        : "HYDROLOGICAL_CONTEXT_PARTIAL",

            city:
                city.name ??
                city.nameAr ??
                city.city ??
                "Unknown",

            lat:
                city.lat ??
                city.latitude ??
                null,

            lon:
                city.lon ??
                city.lng ??
                city.longitude ??
                null,

            generatedAt: new Date().toISOString(),

            dataPolicy: {
                syntheticValuesAllowed: false,
                missingValuesInvented: false,
                evidenceRequired: true,
                note:
                    "Unavailable hydrological factors remain explicitly MISSING."
            },

            completeness: {
                percent: completeness,
                availableCount: availableFactors.length,
                totalCount: FACTORS.length,
                availableFactors,
                missingFactors
            },

            factors
        };

        window.RG32 = window.RG32 || {};
        window.RG32.latestHydrologicalContext = result;

        window.dispatchEvent(
            new CustomEvent(
                "rainguard:hydrological-context-ready",
                { detail: result }
            )
        );

        return result;
    }

    function empty(city = {}) {
        return build(city, {});
    }

    function getStatus() {
        return {
            layer: NAME,
            version: VERSION,
            ready: true,
            factors: [...FACTORS],
            syntheticValuesAllowed: false
        };
    }

    const api = {
        name: NAME,
        version: VERSION,
        factors: [...FACTORS],
        build,
        empty,
        normalizeEvidence,
        getStatus
    };

    window.HydrologicalContextLayerV32 = api;

    window.RG32 = window.RG32 || {};
    window.RG32.HydrologicalContextLayer = api;

    console.log(`${NAME} ${VERSION} ready.`);

    window.dispatchEvent(
        new CustomEvent(
            "rainguard:hydrological-context-layer-ready",
            { detail: getStatus() }
        )
    );
})();
