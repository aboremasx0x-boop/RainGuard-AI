window.RG23 = window.RG23 || {};

RG23.ApiManager = {

    async getWeather(lat, lon) {

        try {

            const url =
                `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=precipitation_probability,temperature_2m&forecast_days=1`;

            const r = await fetch(url);

            return await r.json();

        } catch (e) {

            console.error(e);

            return null;

        }

    }

};
