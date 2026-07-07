window.RG23 = window.RG23 || {};

RG23.RadarEngine = {

    radarLayer: null,

    latestRadar: null,

    async loadRadar(map){

        const rainData =
            await RG23.APIManager.fetchRainViewer();

        if(!rainData) return;

        const radar =
            RG23.APIManager.getLatestRainViewerRadarUrl(
                rainData
            );

        if(!radar) return;

        this.latestRadar = radar;

        if(this.radarLayer){

            map.removeLayer(this.radarLayer);

        }

        this.radarLayer =
            L.tileLayer(
                radar.tileUrl,
                {
                    opacity:.55,
                    attribution:"RainViewer"
                }
            );

        this.radarLayer.addTo(map);

        this.render();

    },

    render(){

        const panel =
            document.getElementById(
                "radarPanel"
            );

        if(!panel) return;

        if(!this.latestRadar){

            panel.innerHTML=`
            <div class="item warning">
            Radar unavailable
            </div>
            `;

            return;

        }

        panel.innerHTML=`

        <div class="item success">

            Live Radar Connected

            <br><br>

            Timestamp

            <br>

            ${this.latestRadar.time}

        </div>

        `;

    }

};
