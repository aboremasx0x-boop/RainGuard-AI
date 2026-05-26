from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import httpx
from datetime import datetime

app = FastAPI(
    title="RainGuard AI API",
    description="Local rain alert API using live weather data",
    version="2.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"


# =========================
# Rain Score Calculation
# =========================
def calculate_rain_score(data):
    score = 0

    humidity = data["humidity"]
    rain_probability = data["rain_probability"]
    cloud_cover = data["cloud_cover"]
    precipitation = data["precipitation_mm"]
    dew_point = data["dew_point"]
    pressure = data["pressure_hpa"]
    wind_speed = data["wind_speed"]

    score += rain_probability * 0.45
    score += humidity * 0.13
    score += cloud_cover * 0.15

    if precipitation > 0:
        score += 16

    if dew_point >= 18:
        score += 7

    if pressure < 1010:
        score += 4

    if wind_speed >= 15:
        score += 3

    return min(round(score), 100)


# =========================
# Alert Classification
# =========================
def classify(score):

    if score >= 80:
        return {
            "level": "HIGH RAIN ALERT",
            "advice": "Heavy rain possible. Follow weather warnings."
        }

    elif score >= 60:
        return {
            "level": "MODERATE ALERT",
            "advice": "Rain chance is moderate. Monitor updates."
        }

    elif score >= 40:
        return {
            "level": "LOW TO MODERATE",
            "advice": "Weak rain indicators detected."
        }

    else:
        return {
            "level": "NO ALERT",
            "advice": "Rain chance is currently low."
        }


# =========================
# Root Endpoint
# =========================
@app.get("/")
def root():
    return JSONResponse(
        content={
            "name": "RainGuard AI API",
            "status": "running",
            "example": "/rain-alert?lat=21.4858&lon=39.1925&name=Jeddah"
        },
        media_type="application/json; charset=utf-8"
    )


# =========================
# Health Check
# =========================
@app.get("/health")
def health():
    return JSONResponse(
        content={"status": "ok"},
        media_type="application/json; charset=utf-8"
    )


# =========================
# Arabic UTF-8 Test
# =========================
@app.get("/test-ar")
def test_ar():
    return JSONResponse(
        content={
            "message": "لا يوجد إنذار",
            "advice": "فرصة المطر ضعيفة حاليا"
        },
        media_type="application/json; charset=utf-8"
    )


# =========================
# Main Rain Alert Endpoint
# =========================
@app.get("/rain-alert")
async def rain_alert(
    lat: float = Query(...),
    lon: float = Query(...),
    name: str = Query("Unknown Location"),
    hours: int = Query(12)
):

    params = {
        "latitude": lat,
        "longitude": lon,
        "hourly": ",".join([
            "temperature_2m",
            "relative_humidity_2m",
            "dew_point_2m",
            "precipitation_probability",
            "precipitation",
            "cloud_cover",
            "pressure_msl",
            "wind_speed_10m"
        ]),
        "forecast_days": 2,
        "timezone": "auto"
    }

    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.get(OPEN_METEO_URL, params=params)
        response.raise_for_status()
        weather = response.json()

    h = weather["hourly"]

    next_hours = []

    for i in range(min(hours, len(h["time"]))):

        row = {
            "time": h["time"][i],
            "temperature": h["temperature_2m"][i] or 0,
            "humidity": h["relative_humidity_2m"][i] or 0,
            "dew_point": h["dew_point_2m"][i] or 0,
            "rain_probability": h["precipitation_probability"][i] or 0,
            "precipitation_mm": h["precipitation"][i] or 0,
            "cloud_cover": h["cloud_cover"][i] or 0,
            "pressure_hpa": h["pressure_msl"][i] or 1013,
            "wind_speed": h["wind_speed_10m"][i] or 0,
        }

        score = calculate_rain_score(row)

        alert = classify(score)

        row["rain_score"] = score
        row["alert_level"] = alert["level"]
        row["advice"] = alert["advice"]

        next_hours.append(row)

    best_hour = max(next_hours, key=lambda x: x["rain_score"])

    result = {
        "location_name": name,
        "latitude": lat,
        "longitude": lon,
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "current": next_hours[0],
        "best_hour": best_hour,
        "next_hours": next_hours,
        "source": "Open-Meteo Forecast API",
        "disclaimer": "Experimental local rain prediction system."
    }

    return JSONResponse(
        content=result,
        media_type="application/json; charset=utf-8"
    )
