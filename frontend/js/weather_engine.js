window.RG23 = window.RG23 || {};

RG23.WeatherEngine = {

    lastResults: [],

    async analyzeCities(cities) {
        const results = [];

        for (const city of cities) {
            const weather = await RG23.APIManager.fetchOpenMeteo(city.lat, city.lon);

            const result = this.analyzeCity(city, weather);

            results.push(result);
        }

        this.lastResults = results;

        this.render(results);

        return results;
    },

    analyzeCity(city, weather) {
        if (!weather || !weather.current) {
            return {
                ...city,
                weatherOk: false,
                weatherScore: city.baseRisk || 10,
                rain: 0,
                precipitation: 0,
                humidity: 0,
                wind: 0,
                temperature: 0,
                pressure: 0,
                source: "fallback"
            };
        }

        const current = weather.current;
        const hourly = weather.hourly || {};

        const rain = Number(current.rain || 0);
        const precipitation = Number(current.precipitation || 0);
        const humidity = Number(current.relative_humidity_2m || 0);
        const wind = Number(current.wind_speed_10m || 0);
        const temperature = Number(current.temperature_2m || 0);
        const pressure = Number(current.pressure_msl || 0);

        const precipProb = Array.isArray(hourly.precipitation_probability)
            ? Math.max(...hourly.precipitation_probability.slice(0, 6).map(Number))
            : 0;

        const sixHourRain = Array.isArray(hourly.rain)
            ? hourly.rain.slice(0, 6).reduce((s, v) => s + Number(v || 0), 0)
            : 0;

        let score = 0;

        score += Math.min(40, rain * 12);
        score += Math.min(30, precipitation * 10);
        score += Math.min(20, precipProb * 0.2);
        score += Math.min(15, sixHourRain * 5);
        score += humidity > 80 ? 8 : 0;
        score += wind > 35 ? 7 : 0;

        score = Math.max(city.baseRisk || 0, Math.min(100, Math.round(score)));

        return {
            ...city,
            weatherOk: true,
            weatherScore: score,
            rain,
            precipitation,
            precipProb,
            sixHourRain,
            humidity,
            wind,
            temperature,
            pressure,
            source: "open-meteo"
        };
    },

    render(results) {
        const panel = document.getElementById("weatherPanel");
        if (!panel) return;

        const sorted = [...results].sort((a, b) => b.weatherScore - a.weatherScore);

        panel.innerHTML = sorted.slice(0, 10).map(city => `
            <div class="item ${city.weatherScore >= 50 ? "danger" : city.weatherScore >= 30 ? "warning" : "success"}">
                <b>${city.name}</b><br>
                Weather Score: ${city.weatherScore}%<br>
                Rain: ${city.rain ?? 0} mm<br>
                Probability: ${city.precipProb ?? 0}%<br>
                Wind: ${city.wind ?? 0} km/h<br>
                <span class="small">Source: ${city.source}</span>
            </div>
        `).join("");
    }

};
