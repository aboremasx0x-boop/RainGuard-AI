window.RG = window.RG || {};

RG.TimelineEngine = {

    events: [],

    add(title) {

        this.events.unshift({

            time: new Date().toLocaleTimeString("ar-SA"),

            title

        });

        if(this.events.length>40)

            this.events.pop();

        this.render();

    },

    render() {

        const panel = document.getElementById("timelinePanel");

        if(!panel) return;

        panel.innerHTML="";

        this.events.forEach(e=>{

            panel.innerHTML+=`

            <div class="item">

                <b>${e.title}</b>

                <br>

                ${e.time}

            </div>

            `;

        });

    }

};
