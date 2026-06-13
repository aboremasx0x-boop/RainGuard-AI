const API_BASE_URL = "https://rainguard-ai.onrender.com";

async function getRainAlert(lat, lon, cityName) {

    try {

        const response = await fetch(
            `${API_BASE_URL}/rain-alert?lat=${lat}&lon=${lon}&name=${cityName}`
        );

        const data = await response.json();

        return data;

    } catch (error) {

        console.error("API Error:", error);

        return {
            error: true,
            message: "فشل الاتصال بالخادم"
        };
    }
}


// ===============================
// Auto Location
// ===============================
async function detectCurrentLocation() {

    if (!navigator.geolocation) {

        alert("المتصفح لا يدعم تحديد الموقع");
        return;
    }

    navigator.geolocation.getCurrentPosition(
        async (position) => {

            const lat = position.coords.latitude;
            const lon = position.coords.longitude;

            document.getElementById("status").innerHTML =
                "جاري تحليل الطقس المحلي...";

            const result = await getRainAlert(lat, lon, "موقعك الحالي");

            renderResult(result);
        },

        (error) => {

            console.error(error);

            alert("تعذر تحديد الموقع");
        }
    );
}


// ===============================
// Render Results
// ===============================
function renderResult(data) {

    const resultDiv = document.getElementById("result");

    if (data.error) {

        resultDiv.innerHTML = `
            <div class="error-box">
                ${data.message}
            </div>
        `;

        return;
    }

    const current = data.current;

    let color = "#2ecc71";

    if (current.rain_score >= 60) {
        color = "#e74c3c";
    } else if (current.rain_score >= 40) {
        color = "#f39c12";
    }

    resultDiv.innerHTML = `
        <div class="weather-card">

            <h2>${data.location_name}</h2>

            <div class="score-circle" style="background:${color}">
                ${current.rain_score}%
            </div>

            <h3>${current.alert_level}</h3>

            <p>${current.advice}</p>

            <div class="weather-grid">

                <div>
                    <strong>🌡 الحرارة</strong>
                    <p>${current.temperature}°C</p>
                </div>

                <div>
                    <strong>💧 الرطوبة</strong>
                    <p>${current.humidity}%</p>
                </div>

                <div>
                    <strong>☁ السحب</strong>
                    <p>${current.cloud_cover}%</p>
                </div>

                <div>
                    <strong>🌧 احتمال المطر</strong>
                    <p>${current.rain_probability}%</p>
                </div>

            </div>

        </div>
    `;
}


// ===============================
// Start App
// ===============================
window.onload = () => {

    detectCurrentLocation();
};
