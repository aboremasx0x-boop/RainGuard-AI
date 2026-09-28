/* =========================================================
   RainGuard AI V32
   FORECAST-1F — City Forecast Auto Integration
   ========================================================= */

(function () {
    "use strict";

    const NAME = "RainForecastCityIntegrationV32";
    const VERSION = "FORECAST-1F.1";

    let lastCityKey = null;
    let running = false;

    function validCity(city) {
        return Boolean(
            city &&
            city.name &&
            Number.isFinite(Number(city.lat)) &&
            Number.isFinite(Number(city.lon))
        );
    }

    function cityKey(city) {
        return [
            city.name,
            Number(city.lat).toFixed(4),
            Number(city.lon).toFixed(4)
        ].join("|");
    }

    async function update(city, force = false) {
        if (!validCity(city)) {
            console.warn(
                "[FORECAST-1F] Invalid city:",
                city
            );
            return null;
        }

        const key = cityKey(city);

        if (!force && key === lastCityKey) {
            return (
                window.RG32
                    ?.latestRainForecastFusion ||
                null
            );
        }

        if (running) return null;

        const ui =
            window.RainForecastUIV32;

        if (!ui?.showCity) {
            console.warn(
                "[FORECAST-1F] Forecast UI not ready."
            );
            return null;
        }

        running = true;

        try {
            console.log(
                `[FORECAST-1F] Updating forecast: ${city.name}`
            );

            const result =
                await ui.showCity(city);

            lastCityKey = key;

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
                `[FORECAST-1F] Forecast ready: ${city.name}`
            );

            return result;

        } catch (error) {

            console.error(
                "[FORECAST-1F] Update failed:",
                error
            );

            return null;

        } finally {
            running = false;
        }
    }

    /*
     * Accept city changes from different RainGuard modules.
     */
    const EVENTS = [
        "rainguard:city-selected",
        "rainguard:city-changed",
        "rainguard:active-city-changed",
        "rainguard:selected-city-changed"
    ];

    EVENTS.forEach(eventName => {

        window.addEventListener(
            eventName,
            event => {

                const detail =
                    event?.detail || {};

                const city =
                    detail.city ||
                    detail.selectedCity ||
                    detail.activeCity ||
                    detail;

                if (validCity(city)) {
                    update(city);
                }
            }
        );

    });

    /*
     * Public bridge for existing RainGuard code.
     */
    function setCity(city) {
        return update(city, true);
    }

    function getStatus() {
        return {
            engine: NAME,
            version: VERSION,
            ready: true,
            running,
            lastCityKey,
            activeCity:
                window.RG32
                    ?.activeForecastCity ||
                null
        };
    }

    window.RG32 =
        window.RG32 || {};

    const api = {
        name: NAME,
        version: VERSION,
        update,
        setCity,
        getStatus
    };

    window.RainForecastCityIntegrationV32 =
        api;

    window.RG32.RainForecastCityIntegration =
        api;

    console.log(
        `${NAME} ${VERSION} ready.`
    );

})();
