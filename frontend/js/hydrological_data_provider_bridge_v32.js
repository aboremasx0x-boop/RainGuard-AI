/* =========================================================
   RainGuard AI V32
   FORECAST-1J3 — Real Hydrological Data Provider Bridge
   Version: FORECAST-1J3.0

   Phase 1 real provider:
   - Elevation: Open-Meteo Elevation API / Copernicus DEM GLO-90
   - Slope: derived from nearby REAL elevation samples (not invented)

   Deferred until dedicated real datasets/endpoints are connected:
   - wadi_proximity
   - drainage_capacity
   - soil_moisture
   - land_cover
   ========================================================= */

(function () {
    "use strict";

    const NAME = "HydrologicalDataProviderBridgeV32";
    const VERSION = "FORECAST-1J3.0";
    const ELEVATION_ENDPOINT = "https://api.open-meteo.com/v1/elevation";

    const finite = v => Number.isFinite(Number(v));
    const round = (v, d = 2) => {
        const p = 10 ** d;
        return Math.round(Number(v) * p) / p;
    };

    function coords(city = {}) {
        const lat = Number(city.lat ?? city.latitude);
        const lon = Number(city.lon ?? city.lng ?? city.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
            throw new Error("INVALID_CITY_COORDINATES");
        }
        return { lat, lon };
    }

    function offsets(lat, meters = 500) {
        const dLat = meters / 111320;
        const cos = Math.cos(lat * Math.PI / 180);
        const dLon = meters / (111320 * Math.max(0.1, Math.abs(cos)));
        return { dLat, dLon };
    }

    async function fetchElevations(points) {
        const latitudes = points.map(p => p.lat).join(",");
        const longitudes = points.map(p => p.lon).join(",");
        const url =
            `${ELEVATION_ENDPOINT}?latitude=${encodeURIComponent(latitudes)}` +
            `&longitude=${encodeURIComponent(longitudes)}`;

        const response = await fetch(url, {
            method: "GET",
            headers: { "Accept": "application/json" }
        });

        if (!response.ok) {
            throw new Error(`ELEVATION_HTTP_${response.status}`);
        }

        const data = await response.json();

        if (!Array.isArray(data?.elevation) ||
            data.elevation.length !== points.length ||
            !data.elevation.every(finite)) {
            throw new Error("INVALID_ELEVATION_RESPONSE");
        }

        return data.elevation.map(Number);
    }

    function slopeFromSamples(center, north, south, east, west, sampleMeters) {
        const dzNS = north - south;
        const dzEW = east - west;
        const run = sampleMeters * 2;

        const gradeNS = dzNS / run;
        const gradeEW = dzEW / run;
        const gradient = Math.sqrt(gradeNS ** 2 + gradeEW ** 2);

        return {
            percent: round(gradient * 100, 2),
            degrees: round(Math.atan(gradient) * 180 / Math.PI, 2),
            method: "central_difference_from_real_elevation_samples",
            centerElevationM: round(center, 1)
        };
    }

    async function collect(city = {}) {
        const { lat, lon } = coords(city);
        const sampleMeters = 500;
        const { dLat, dLon } = offsets(lat, sampleMeters);

        const points = [
            { key: "center", lat, lon },
            { key: "north", lat: lat + dLat, lon },
            { key: "south", lat: lat - dLat, lon },
            { key: "east", lat, lon: lon + dLon },
            { key: "west", lat, lon: lon - dLon }
        ];

        let elevations;
        try {
            elevations = await fetchElevations(points);
        } catch (error) {
            const failed = {
                bridge: NAME,
                version: VERSION,
                status: "REAL_PROVIDER_UNAVAILABLE",
                city: city.name ?? city.nameAr ?? city.city ?? "Unknown",
                lat, lon,
                error: String(error?.message || error),
                evidence: {},
                unavailableFactors: [
                    "terrain", "slope", "wadi_proximity",
                    "drainage_capacity", "soil_moisture", "land_cover"
                ],
                generatedAt: new Date().toISOString()
            };
            window.RG32 = window.RG32 || {};
            window.RG32.latestHydrologicalProviderResult = failed;
            return failed;
        }

        const [center, north, south, east, west] = elevations;
        const slope = slopeFromSamples(
            center, north, south, east, west, sampleMeters
        );

        const evidence = {
            terrain: {
                available: true,
                value: round(center, 1),
                unit: "m",
                source: "Open-Meteo Elevation API / Copernicus DEM GLO-90",
                observedAt: null,
                quality: "REAL_EXTERNAL_DATA",
                metadata: {
                    dataset: "Copernicus DEM 2021 GLO-90",
                    nominalResolutionM: 90,
                    endpoint: "Open-Meteo Elevation API"
                }
            },

            slope: {
                available: true,
                value: slope.degrees,
                unit: "degree",
                source: "Derived from Open-Meteo / Copernicus DEM GLO-90 samples",
                observedAt: null,
                quality: "DERIVED_FROM_REAL_EXTERNAL_DATA",
                metadata: {
                    slopePercent: slope.percent,
                    method: slope.method,
                    sampleRadiusM: sampleMeters,
                    sampleCount: 5
                }
            },

            wadi_proximity: {
                available: false,
                value: null,
                source: null
            },

            drainage_capacity: {
                available: false,
                value: null,
                source: null
            },

            soil_moisture: {
                available: false,
                value: null,
                source: null
            },

            land_cover: {
                available: false,
                value: null,
                source: null
            }
        };

        const contextLayer = window.HydrologicalContextLayerV32;
        const context = contextLayer?.build
            ? contextLayer.build(city, evidence)
            : null;

        const result = {
            bridge: NAME,
            version: VERSION,
            status: "REAL_HYDROLOGICAL_DATA_PARTIAL",
            city: city.name ?? city.nameAr ?? city.city ?? "Unknown",
            lat,
            lon,
            generatedAt: new Date().toISOString(),
            provider: {
                name: "Open-Meteo Elevation API",
                dataset: "Copernicus DEM 2021 GLO-90",
                realExternalData: true,
                syntheticData: false
            },
            evidence,
            rawElevationSamples: {
                center: round(center, 1),
                north: round(north, 1),
                south: round(south, 1),
                east: round(east, 1),
                west: round(west, 1)
            },
            context,
            connectedFactors: ["terrain", "slope"],
            pendingRealProviders: [
                "wadi_proximity",
                "drainage_capacity",
                "soil_moisture",
                "land_cover"
            ]
        };

        window.RG32 = window.RG32 || {};
        window.RG32.latestHydrologicalProviderResult = result;

        window.dispatchEvent(
            new CustomEvent(
                "rainguard:hydrological-provider-ready",
                { detail: result }
            )
        );

        return result;
    }

    function getStatus() {
        return {
            bridge: NAME,
            version: VERSION,
            ready: true,
            realProviders: {
                terrain: "Open-Meteo / Copernicus DEM GLO-90",
                slope: "Derived from real DEM samples"
            },
            pendingProviders: [
                "wadi_proximity",
                "drainage_capacity",
                "soil_moisture",
                "land_cover"
            ],
            syntheticDataAllowed: false
        };
    }

    const api = {
        name: NAME,
        version: VERSION,
        collect,
        getStatus
    };

    window.HydrologicalDataProviderBridgeV32 = api;
    window.RG32 = window.RG32 || {};
    window.RG32.HydrologicalDataProviderBridge = api;

    console.log(`${NAME} ${VERSION} ready.`);

    window.dispatchEvent(
        new CustomEvent(
            "rainguard:hydrological-provider-bridge-ready",
            { detail: getStatus() }
        )
    );
})();
