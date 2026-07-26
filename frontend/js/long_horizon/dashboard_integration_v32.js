(function initializeDashboardIntegrationV32(global) {
    "use strict";

    class NationalAIDashboardV32 {

        constructor(options = {}) {
            this.id =
                "national_ai_dashboard_v32_" +
                Date.now();

            this.core =
                options.core ||
                global.RainArrivalRecoveryCoreV32Instance ||
                global.LongHorizonRecoveryCoreV32Instance ||
                null;

            this.state = {
                status:
                    "idle",

                initialized:
                    false,

                lastUpdatedAt:
                    null,

                latestForecast:
                    null,

                forecastData:
                    null,

                longHorizonForecast:
                    null,

                lastError:
                    null
            };
        }

        initialize() {
            this.state.initialized =
                true;

            this.state.status =
                "ready";

            return this.getState();
        }

        start() {
            return this.refresh();
        }

        resume() {
            return this.refresh();
        }

        updateForecast(data) {
            this.state.latestForecast =
                data ||
                null;

            this.state.lastUpdatedAt =
                Date.now();

            this.state.status =
                "updated";

            this.renderForecastData(
                data
            );

            return {
                success:
                    true,

                updatedAt:
                    this.state.lastUpdatedAt
            };
        }

        setForecastData(data) {
            this.state.forecastData =
                data ||
                null;

            return this.updateForecast(
                data
            );
        }

        refresh() {
            try {
                const core =
                    this.core ||
                    global.RainArrivalRecoveryCoreV32Instance ||
                    global.LongHorizonRecoveryCoreV32Instance ||
                    null;

                this.core =
                    core;

                const latestForecast =
                    core?.latestForecast ||
                    null;

                const forecastData =
                    core?.forecastData ||
                    null;

                const longHorizonForecast =
                    core?.longHorizonForecast ||
                    null;

                this.state.latestForecast =
                    latestForecast;

                this.state.forecastData =
                    forecastData;

                this.state.longHorizonForecast =
                    longHorizonForecast;

                this.renderForecastData(
                    longHorizonForecast ||
                    forecastData ||
                    latestForecast
                );

                this.state.status =
                    "ready";

                this.state.lastUpdatedAt =
                    Date.now();

                this.state.lastError =
                    null;

                return {
                    success:
                        true,

                    updatedAt:
                        this.state.lastUpdatedAt,

                    forecastAvailable:
                        Boolean(
                            longHorizonForecast ||
                            forecastData ||
                            latestForecast
                        )
                };

            } catch (error) {
                this.state.status =
                    "failed";

                this.state.lastError = {
                    name:
                        error.name,

                    message:
                        error.message
                };

                return {
                    success:
                        false,

                    error:
                        this.state.lastError
                };
            }
        }

        render() {
            return this.refresh();
        }

        renderForecastData(data) {
            global.dispatchEvent(
                new CustomEvent(
                    "rainguard:dashboard:forecast-updated",
                    {
                        detail: {
                            dashboardId:
                                this.id,

                            data:
                                data ||
                                null,

                            timestamp:
                                Date.now()
                        }
                    }
                )
            );

            return true;
        }

        getState() {
            return {
                ...this.state
            };
        }
    }

    global.NationalAIDashboardV32 =
        NationalAIDashboardV32;

    global.NationalAIDashboardV32Instance =
        new NationalAIDashboardV32({
            core:
                global.RainArrivalRecoveryCoreV32Instance ||
                global.LongHorizonRecoveryCoreV32Instance ||
                null
        });

    global.NationalAIDashboardV32Instance
        .initialize();

    const core =
        global.RainArrivalRecoveryCoreV32Instance ||
        global.LongHorizonRecoveryCoreV32Instance ||
        null;

    if (core) {
        core.dashboard =
            global.NationalAIDashboardV32Instance;
    }

})(window);
