window.RG = window.RG || {};

RG.ExecutiveReport = {

    generate(city,risk,decision){

        const html=`

        <div class="item success">

            <h2>Executive National Report</h2>

            <hr>

            <b>Highest Risk City:</b> ${city}<br>

            <b>Current Risk:</b> ${risk}%<br>

            <b>Decision:</b> ${decision}<br><br>

            RainGuard AI compared:

            <ul>

                <li>Radar</li>

                <li>Rain Forecast</li>

                <li>Population</li>

                <li>Infrastructure</li>

                <li>Historical Memory</li>

                <li>AI Simulation</li>

            </ul>

            Recommended Action:

            <b>${decision}</b>

        </div>

        `;

        const panel=document.getElementById("executiveReportPanel");

        if(panel)

            panel.innerHTML=html;

        RG.Memory.add("Report","Executive report generated");

    }

};
