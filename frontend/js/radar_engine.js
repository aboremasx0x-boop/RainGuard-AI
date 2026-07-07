window.RG23 = window.RG23 || {};

RG23.RadarEngine = {
    radarLayer: null,
    latestRadar: null,

    async loadRadar(map) {
        const rainData = await RG23.APIManager.fetchRainViewer();

        if (!rainData) {
            this.render(false);
            return;
        }

        const radar = RG23.APIManager.getLatestRainViewerRadarUrl(rainData);

        if (!radar) {
            this.render(false);
            return;
        }

        this.latestRadar = radar;

        if (this.radarLayer && map) {
            map.removeLayer(this.radarLayer);
        }

        this.radarLayer = L.tileLayer(radar.tileUrl, {
            opacity: 0.55,
            attribution: "RainViewer"
        });

        this.radarLayer.addTo(map);

        this.render(true);
    },

    render(ok) {
        const panel = document.getElementById("radarPanel");
        if (!panel) return;

        panel.innerHTML = ok
            ? `<div class="item success">
                    <b>Live Radar Connected</b><br>
                    RainViewer layer active<br>
                    Time: ${this.latestRadar?.time || "--"}
               </div>`
            : `<div class="item warning">
                    <b>Radar unavailable</b><br>
                    Check RainViewer connection.
               </div>`;
    }
};
