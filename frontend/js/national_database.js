window.RG23 = window.RG23 || {};

RG23.NationalDatabase = {

    key: "rainguard_v23_national_database",

    data: {
        cycles: [],
        weather: [],
        radar: [],
        cities: [],
        reports: [],
        memory: []
    },

    load() {
        try {
            const saved = localStorage.getItem(this.key);
            if (saved) {
                this.data = JSON.parse(saved);
            }
        } catch (e) {
            console.warn("Database load failed:", e);
        }

        this.render();

        return this.data;
    },

    save() {
        try {
            localStorage.setItem(this.key, JSON.stringify(this.data));
        } catch (e) {
            console.warn("Database save failed:", e);
        }

        this.render();
    },

    addCycle(cycle) {
        this.data.cycles.unshift({
            time: new Date().toLocaleTimeString("ar-SA"),
            ...cycle
        });

        this.data.cycles = this.data.cycles.slice(0, 50);
        this.save();
    },

    addMemory(type, text) {
        this.data.memory.unshift({
            time: new Date().toLocaleTimeString("ar-SA"),
            type,
            text
        });

        this.data.memory = this.data.memory.slice(0, 100);
        this.save();
    },

    addReport(report) {
        this.data.reports.unshift({
            time: new Date().toLocaleTimeString("ar-SA"),
            ...report
        });

        this.data.reports = this.data.reports.slice(0, 20);
        this.save();
    },

    updateCities(cities) {
        this.data.cities = cities.map(city => ({
            name: city.name,
            weatherScore: city.weatherScore,
            floodIndex: city.floodIndex,
            roadRisk: city.roadRisk,
            responseTime: city.responseTime,
            infrastructureCriticality: city.infrastructureCriticality
        }));

        this.save();
    },

    render() {
        const panel = document.getElementById("databasePanel");
        if (!panel) return;

        panel.innerHTML = `
            <div class="item success">
                <b>Database Active</b><br>
                Cycles: ${this.data.cycles.length}<br>
                Memory: ${this.data.memory.length}<br>
                Reports: ${this.data.reports.length}<br>
                Cities: ${this.data.cities.length}
            </div>
        `;
    }

};

RG23.NationalDatabase.load();
