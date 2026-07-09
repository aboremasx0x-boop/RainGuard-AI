window.RG26 = window.RG26 || {};

RG26.ForecastVerification = {

    lastVerification: null,

    verify(cityData) {

        if (!cityData) return null;

        const official = cityData.official;
        const meteo = cityData.verification.openMeteo;

        const forecast = {

            city: cityData.city,

            officialSource: official.source,

            officialStatus: official.status,

            official6h: official.rainProbability6h,
            official24h: official.rainProbability24h,
            official72h: official.rainProbability72h,

            openMeteo6h: meteo.rainProbability6h,
            openMeteo24h: meteo.rainProbability24h,
            openMeteo72h: meteo.rainProbability72h

        };

        forecast.agreement6h =
            this.calculateAgreement(
                forecast.official6h,
                forecast.openMeteo6h
            );

        forecast.agreement24h =
            this.calculateAgreement(
                forecast.official24h,
                forecast.openMeteo24h
            );

        forecast.agreement72h =
            this.calculateAgreement(
                forecast.official72h,
                forecast.openMeteo72h
            );

        forecast.finalConfidence =
            this.calculateConfidence(forecast);

        forecast.recommendedProbability =
            this.calculateRecommendedProbability(forecast);

        this.lastVerification = forecast;

        this.render();

        return forecast;
    },

    calculateAgreement(a,b){

        if(a==null || b==null)
            return null;

        const diff=Math.abs(a-b);

        return Math.max(
            0,
            Math.round(
                100-diff
            )
        );

    },

    calculateConfidence(f){

        const arr=[];

        if(f.agreement6h!=null)
            arr.push(f.agreement6h);

        if(f.agreement24h!=null)
            arr.push(f.agreement24h);

        if(f.agreement72h!=null)
            arr.push(f.agreement72h);

        if(!arr.length)
            return 80;

        return Math.round(
            arr.reduce((s,v)=>s+v,0)
            /arr.length
        );

    },

    calculateRecommendedProbability(f){

        if(f.official6h!=null)
            return f.official6h;

        return f.openMeteo6h;

    },

    render(){

        const panel=document.getElementById(
            "forecastVerificationPanel"
        );

        if(!panel || !this.lastVerification)
            return;

        const d=this.lastVerification;

        panel.innerHTML=`

        <div class="item success">

        <b>${d.city}</b>

        <br><br>

        Official Source

        <br>

        ${d.officialSource}

        <br>

        Status

        ${d.officialStatus}

        <br><br>

        Open-Meteo

        <br>

        6h ${d.openMeteo6h ?? "--"}%

        <br>

        24h ${d.openMeteo24h ?? "--"}%

        <br>

        72h ${d.openMeteo72h ?? "--"}%

        <br><br>

        Agreement

        <br>

        6h ${d.agreement6h ?? "--"}%

        <br>

        24h ${d.agreement24h ?? "--"}%

        <br>

        72h ${d.agreement72h ?? "--"}%

        <br><br>

        Final Confidence

        <br>

        <b>${d.finalConfidence}%</b>

        </div>

        `;

    }

};
