/*
=========================================================
RainGuard AI V31
Rain Forecast Regions Engine
Version 31.0
Production Ready
=========================================================
*/

(function () {

"use strict";

if (!window.RG31)
    window.RG31 = {};

class RainForecastRegionsEngine {

    constructor() {

        this.version = "31.0";

        this.initialized = false;

        this.forecastHours = [

            6,
            12,
            24,
            48,
            72

        ];

        this.forecasts = {};

        this.cityForecasts = {};

        this.regionForecasts = {};

        this.topRegions = [];

        this.lastUpdate = null;

        this.updateInterval = 15 * 60 * 1000;

        this.timer = null;

        this.minimumProbability = 15;

        this.minimumRainMM = 0.10;

        this.maxRegions = 100;

        this.supportedSources = [

            "official",
            "openmeteo",
            "anwaa",
            "rainviewer",
            "satellite",
            "lightning",
            "localai"

        ];

    }

    /*
    =====================================================
    INITIALIZE
    =====================================================
    */

    init() {

        if (this.initialized)
            return;

        this.initialized = true;

        this.writeLog(
            "Rain Forecast Regions Engine initialized."
        );

        this.start();

    }

    /*
    =====================================================
    START
    =====================================================
    */

    start() {

        if (this.timer)
            clearInterval(this.timer);

        this.update();

        this.timer = setInterval(

            () => {

                this.update();

            },

            this.updateInterval

        );

    }

    /*
    =====================================================
    STOP
    =====================================================
    */

    stop() {

        if (this.timer) {

            clearInterval(this.timer);

            this.timer = null;

        }

    }

    /*
    =====================================================
    MAIN UPDATE
    =====================================================
    */

    async update() {

        try {

            await this.collectForecasts();

            this.calculateForecasts();

            this.rankRegions();

            this.publish();

            this.lastUpdate =
                new Date().toISOString();

        }

        catch (error) {

            console.error(error);

        }

    }

    /*
    =====================================================
    LOG
    =====================================================
    */

    writeLog(message) {

        console.log(

            "[RainGuard V31 Forecast]",

            message

        );

    }

}

window.RG31.RainForecastRegionsEngine =
    new RainForecastRegionsEngine();

})();
