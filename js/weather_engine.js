window.RG23 = window.RG23 || {};

RG23.WeatherEngine = {

    async analyze(cities) {

        for (const city of cities) {

            try {

                const data =
                    await RG23.ApiManager.getWeather(city.lat, city.lon);

                let rain = 0;

                if (
                    data &&
                    data.hourly &&
                    data.hourly.precipitation_probability
                ) {

                    const arr =
                        data.hourly.precipitation_probability;

                    rain =
                        Math.max(...arr);

                }

                city.weatherScore = rain;

            } catch {

                city.weatherScore = 0;

            }

        }

        return cities;

    }

};
