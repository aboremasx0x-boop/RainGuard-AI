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

                connectedToCore:
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
            this.connectToCore();

            this.state.initialized =
                true;

            this.state.status =
                "ready";

            return this.getState();
        }

        connectToCore() {
            const core =
                this.core ||
                global.RainArrivalRecoveryCoreV32Instance ||
                global.LongHorizonRecoveryCoreV32Instance ||
                null;

            this.core =
                core;

            if (!core) {
                this.state.connectedToCore =
                    false;

                return {
                    success:
                        false,

                    connected:
                        false,

                    reason:
                        "Recovery Core is unavailable."
                };
            }

            if (
                typeof core.setDashboard ===
                "function"
            ) {
                core.setDashboard(
                    this
                );

            } else if (
                typeof core.attachDashboard ===
                "function"
            ) {
                core.attachDashboard(
                    this
                );

            } else {
                core.dashboard =
                    this;
            }

            this.state.connectedToCore =
                core.dashboard === this ||
                core.getDashboard?.() === this;

            return {
                success:
                    this.state.connectedToCore,

                connected:
                    this.state.connectedToCore,

                core
            };
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

            this.state.lastError =
                null;

            this.renderForecastData(
                data
            );

            return {
                success:
                    true,

                updatedAt:
                    this.state.lastUpdatedAt,

                forecastAvailable:
                    Boolean(
                        data
                    )
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

        setLongHorizonForecast(data) {
            this.state.longHorizonForecast =
                data ||
                null;

            return this.updateForecast(
                data
            );
        }

        refresh() {
            try {
                if (!this.core) {
                    this.connectToCore();
                }

                const core =
                    this.core ||
                    global.RainArrivalRecoveryCoreV32Instance ||
                    global.LongHorizonRecoveryCoreV32Instance ||
                    null;

                this.core =
                    core;

                const latestForecast =
                    core?.latestForecast ||
                    core?.state?.latestForecast ||
                    null;

                const forecastData =
                    core?.forecastData ||
                    core?.state?.forecastData ||
                    core?.state?.cityForecasts ||
                    null;

                const longHorizonForecast =
                    core?.longHorizonForecast ||
                    core?.state?.longHorizonForecast ||
                    core?.state?.horizonForecasts ||
                    null;

                this.state.latestForecast =
                    latestForecast;

                this.state.forecastData =
                    forecastData;

                this.state.longHorizonForecast =
                    longHorizonForecast;

                const selectedForecast =
                    longHorizonForecast ||
                    forecastData ||
                    latestForecast ||
                    null;

                this.renderForecastData(
                    selectedForecast
                );

                this.state.status =
                    "ready";

                this.state.lastUpdatedAt =
                    Date.now();

                this.state.lastError =
                    null;

                this.state.connectedToCore =
                    Boolean(
                        core
                    );

                return {
                    success:
                        true,

                    connectedToCore:
                        this.state.connectedToCore,

                    updatedAt:
                        this.state.lastUpdatedAt,

                    forecastAvailable:
                        Boolean(
                            selectedForecast
                        )
                };

            } catch (error) {
                this.state.status =
                    "failed";

                this.state.lastError = {
                    name:
                        error?.name ||
                        "Error",

                    message:
                        error?.message ||
                        String(
                            error
                        )
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
            try {
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

            } catch (error) {
                this.state.lastError = {
                    name:
                        error?.name ||
                        "Error",

                    message:
                        error?.message ||
                        String(
                            error
                        )
                };

                return false;
            }
        }

        getState() {
            return {
                ...this.state
            };
        }

        getStatus() {
            return {
                id:
                    this.id,

                status:
                    this.state.status,

                initialized:
                    this.state.initialized,

                connectedToCore:
                    this.state.connectedToCore,

                lastUpdatedAt:
                    this.state.lastUpdatedAt,

                forecastAvailable:
                    Boolean(
                        this.state.longHorizonForecast ||
                        this.state.forecastData ||
                        this.state.latestForecast
                    ),

                lastError:
                    this.state.lastError
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
        if (
            typeof core.setDashboard ===
            "function"
        ) {
            core.setDashboard(
                global.NationalAIDashboardV32Instance
            );

        } else if (
            typeof core.attachDashboard ===
            "function"
        ) {
            core.attachDashboard(
                global.NationalAIDashboardV32Instance
            );

        } else {
            core.dashboard =
                global.NationalAIDashboardV32Instance;
        }
    }

})(window);
