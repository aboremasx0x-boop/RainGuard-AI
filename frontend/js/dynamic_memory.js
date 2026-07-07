window.RG = window.RG || {};

RG.Memory = {

    memories: [],

    add(type, text) {

        this.memories.unshift({

            time: new Date().toLocaleTimeString("ar-SA"),

            type,

            text

        });

        if (this.memories.length > 100)

            this.memories.pop();

        this.render();

    },

    render() {

        const panel = document.getElementById("memoryPanel");

        if (!panel) return;

        panel.innerHTML = "";

        this.memories.forEach(m => {

            panel.innerHTML += `
            <div class="item purple">
                <b>${m.type}</b><br>
                ${m.text}
                <div class="small">${m.time}</div>
            </div>`;

        });

    }

};
