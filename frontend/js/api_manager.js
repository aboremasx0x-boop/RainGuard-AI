window.RG23 = window.RG23 || {};

RG23.APIManager = {

    async fetchJSON(url) {
        try {
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error("HTTP " + response.status);
            }

            return await response.json();

        } catch (error) {
            console.warn("API fetch failed:", url, error);
            return null;
        }
    },

    async fetchOpenMeteo(lat, lon) {
        const url =
            "https://api.open-meteo.com/v1/forecast" +
            `?latitude=${lat}` +
            `&longitude=${lon}` +
            "&current=temperature_2m,relative_humidity_2m,precipitation,rain,weather_code,pressure_msl,wind_speed_10m,wind_direction_10m" +
            "&hourly=precipitation_probability,precipitation,rain,relative_humidity_2m,wind_speed_10m" +
            "&forecast_days=1" +
            "&timezone=auto";

        return await this.fetchJSON(url);
    },

    async fetchRainViewer() {
        const url = "https://api.rainviewer.com/public/weather-maps.json";
        return await this.fetchJSON(url);
    },

    getLatestRainViewerRadarUrl(data) {
        if (!data || !data.radar || !data.radar.past || !data.radar.past.length) {
            return null;
        }

        const latest = data.radar.past[data.radar.past.length - 1].time;

        return {
            time: latest,
            tileUrl: `https://tilecache.rainviewer.com/v2/radar/${latest}/256/{z}/{x}/{y}/2/1_1.png`
        };
    }

};
