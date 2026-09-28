/* =========================================================
   RainGuard AI V32
   FORECAST-1G — Real City Selection Integration
   ========================================================= */

(function () {
    "use strict";

    const NAME = "RainForecastCityIntegrationV32";
    const VERSION = "FORECAST-1G.1";

    let lastCityKey = null;
    let running = false;
    let pendingCity = null;

    /* =====================================================
       CITY VALIDATION
       ===================================================== */

    function validCity(city) {
        return Boolean(
            city &&
            (city.name || city.city) &&
            Number.isFinite(Number(city.lat)) &&
            Number.isFinite(Number(city.lon))
        );
    }

    /* =====================================================
       NORMALIZE CITY
       ===================================================== */

    function normalizeCity(input) {
        if (!input) return null;

        /*
         * Different RainGuard modules may wrap
         * the selected city differently.
         */
        const raw =
            input.city &&
            typeof input.city === "object"
                ? input.city
                : input.selectedCity &&
                  typeof input.selectedCity === "object"
                    ? input.selectedCity
                    : input.activeCity &&
                      typeof input.activeCity === "object"
                        ? input.activeCity
                        : input.impactedCity &&
                          typeof input.impactedCity === "object"
                            ? input.impactedCity
                            : input;

        const name =
            raw.name ||
            raw.city ||
            raw.cityName ||
            raw.nameAr ||
            raw.label ||
            null;

        const lat =
            raw.lat ??
            raw.latitude ??
            raw.centerLat ??
            raw.coordinates?.lat ??
            null;

        const lon =
            raw.lon ??
            raw.lng ??
            raw.longitude ??
            raw.centerLon ??
            raw.coordinates?.lon ??
            raw.coordinates?.lng ??
            null;

        if (
            !name ||
            !Number.isFinite(Number(lat)) ||
            !Number.isFinite(Number(lon))
        ) {
            return null;
        }

        return {
            name: String(name),
            lat: Number(lat),
            lon: Number(lon),

            region:
                raw.region ||
                raw.regionName ||
                raw.province ||
                null,

            source:
                raw.source ||
                "RainGuard"
        };
    }

    /* =====================================================
       CITY KEY
       ===================================================== */

    function cityKey(city) {
        return [
            city.name,
            Number(city.lat).toFixed(4),
            Number(city.lon).toFixed(4)
        ].join("|");
    }

    /* =====================================================
       UPDATE FORECAST
       ===================================================== */

    async function update(cityInput, force = false) {

        const city =
            normalizeCity(cityInput);

        if (!validCity(city)) {
            console.warn(
                "[FORECAST-1G] Invalid city:",
                cityInput
            );

            return null;
        }

        const key =
            cityKey(city);

        /*
         * Avoid duplicate requests.
         */
        if (!force && key === lastCityKey) {
            return (
                window.RG32
                    ?.latestRainForecastFusion ||
                null
            );
        }

        /*
         * If another forecast request is running,
         * remember the latest requested city.
         */
        if (running) {
            pendingCity = city;

            console.log(
                `[FORECAST-1G] Queued city: ${city.name}`
            );

            return null;
        }

        const ui =
            window.RainForecastUIV32;

        if (!ui?.showCity) {
            console.warn(
                "[FORECAST-1G] Forecast UI not ready."
            );

            return null;
        }

        running = true;

        try {

            console.log(
                `[FORECAST-1G] Updating forecast: ${city.name}`
            );

            const result =
                await ui.showCity(city);

            lastCityKey =
                key;

            window.RG32 =
                window.RG32 || {};

            window.RG32.activeForecastCity =
                city;

            window.dispatchEvent(
                new CustomEvent(
                    "rainguard:forecast-city-updated",
                    {
                        detail: {
                            city,
                            result
                        }
                    }
                )
            );

            console.log(
                `[FORECAST-1G] Forecast ready: ${city.name}`
            );

            return result;

        } catch (error) {

            console.error(
                "[FORECAST-1G] Update failed:",
                error
            );

            return null;

        } finally {

            running = false;

            /*
             * Process the latest city requested
             * while the previous request was running.
             */
            if (pendingCity) {

                const nextCity =
                    pendingCity;

                pendingCity =
                    null;

                if (
                    cityKey(nextCity) !==
                    lastCityKey
                ) {
                    setTimeout(
                        () => update(nextCity),
                        0
                    );
                }
            }
        }
    }

    /* =====================================================
       EVENT HANDLER
       ===================================================== */

    function handleCityEvent(
        event,
        eventName
    ) {

        const detail =
            event?.detail || {};

        const city =
            normalizeCity(detail);

        if (!city) {

            console.warn(
                `[FORECAST-1G] City event received but coordinates were not found: ${eventName}`,
                detail
            );

            return;
        }

        console.log(
            `[FORECAST-1G] City event: ${eventName} -> ${city.name}`
        );

        update(city);
    }

    /* =====================================================
       RAINGUARD CITY EVENTS
       ===================================================== */

    const EVENTS = [

        /*
         * Existing compatibility events.
         */
        "rainguard:city-selected",
        "rainguard:city-changed",
        "rainguard:active-city-changed",
        "rainguard:selected-city-changed",

        /*
         * REAL V31 impacted-city selection event.
         */
        "rg31:impacted-city-selected"
    ];

    EVENTS.forEach(
        eventName => {

            window.addEventListener(
                eventName,
                event =>
                    handleCityEvent(
                        event,
                        eventName
                    )
            );

        }
    );

    /* =====================================================
       PUBLIC API
       ===================================================== */

    function setCity(city) {
        return update(
            city,
            true
        );
    }

    function getStatus() {
        return {
            engine: NAME,
            version: VERSION,

            ready: true,
            running,

            lastCityKey,

            pendingCity,

            activeCity:
                window.RG32
                    ?.activeForecastCity ||
                null,

            subscribedEvents:
                [...EVENTS]
        };
    }

    /* =====================================================
       EXPORT
       ===================================================== */

    window.RG32 =
        window.RG32 || {};

    const api = {
        name: NAME,
        version: VERSION,

        update,
        setCity,
        normalizeCity,
        getStatus
    };

    window.RainForecastCityIntegrationV32 =
        api;

    window.RG32.RainForecastCityIntegration =
        api;

    console.log(
        `${NAME} ${VERSION} ready.`
    );

    console.log(
        "[FORECAST-1G] Listening for:",
        EVENTS
    );

})();
