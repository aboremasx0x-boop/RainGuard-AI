window.RG26 = window.RG26 || {};

RG26.NationalDataHub = {

    officialSourceName: "أنواء - المركز الوطني للأرصاد",

    async collect(city) {
        const openMeteo = await this.fetchOpenMeteo(city.lat, city.lon);

        return {
            city: city.name,
            lat: city.lat,
            lon: city.lon,
            region: city.region || city.name,

            official: this.getAnwaaPlaceholder(city),

            verification: {
                openMeteo
            },

            collectedAt: new Date().toLocaleTimeString("ar-SA")
        };
    },

    getAnwaaPlaceholder(city) {
        return {
            source: this.officialSourceName,
            status: "PENDING_API",
            rainProbability6h: null,
            rainProbability24h: null,
            rainProbability72h: null,
            warningLevel: "OFFICIAL_API_NOT_CONNECTED",
            note: "يتم اعتماد أنواء كمصدر رسمي عند توفر الربط أو التصريح."
        };
    },

    async fetchOpenMeteo(lat, lon) {
        try {
            const url =
                `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
                `&hourly=precipitation_probability,precipitation,rain,temperature_2m,wind_speed_10m` +
                `&forecast_days=3&timezone=auto`;

            const res = await fetch(url);
            if (!res.ok) throw new Error("Open-Meteo failed");

            const data = await res.json();

            const prob = data.hourly?.precipitation_probability || [];
            const rain = data.hourly?.rain || [];
            const precipitation = data.hourly?.precipitation || [];

            return {
                source: "Open-Meteo",
                rainProbability6h: this.max(prob.slice(0, 6)),
                rainProbability24h: this.max(prob.slice(0, 24)),
                rainProbability72h: this.max(prob.slice(0, 72)),
                expectedRain6h: this.sum(rain.slice(0, 6)),
                expectedRain24h: this.sum(rain.slice(0, 24)),
                expectedRain72h: this.sum(rain.slice(0, 72)),
                expectedPrecipitation72h: this.sum(precipitation.slice(0, 72)),
                status: "CONNECTED"
            };

        } catch (e) {
            console.warn("Open-Meteo unavailable:", e);

            return {
                source: "Open-Meteo",
                status: "UNAVAILABLE",
                rainProbability6h: 0,
                rainProbability24h: 0,
                rainProbability72h: 0,
                expectedRain6h: 0,
                expectedRain24h: 0,
                expectedRain72h: 0
            };
        }
    },

    max(arr) {
        if (!arr || !arr.length) return 0;
        return Math.round(Math.max(...arr.map(v => Number(v || 0))));
    },

    sum(arr) {
        if (!arr || !arr.length) return 0;
        return Number(arr.reduce((s, v) => s + Number(v || 0), 0).toFixed(1));
    },

    async collectForCities(cities) {
        const results = [];

        for (const city of cities) {
            results.push(await this.collect(city));
        }

        this.render(results);

        return results;
    },

    render(results) {
        const panel =
            document.getElementById("nationalDataHubPanel") ||
            document.getElementById("databasePanel");

        if (!panel) return;

        panel.innerHTML = results.slice(0, 6).map(item => `
            <div class="item success">
                <b>${item.city}</b><br>
                Official Source: ${item.official.source}<br>
                Official Status: ${item.official.status}<br>
                Open-Meteo 6h: ${item.verification.openMeteo.rainProbability6h}%<br>
                Open-Meteo 24h: ${item.verification.openMeteo.rainProbability24h}%<br>
                Open-Meteo 72h: ${item.verification.openMeteo.rainProbability72h}%<br>
                <span class="small">Updated: ${item.collectedAt}</span>
            </div>
        `).join("");
    }

};
