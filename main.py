from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import httpx
from typing import List, Optional
from datetime import datetime

app = FastAPI(
    title="RainGuard AI API",
    description="Local rain alert API using live weather data from Open-Meteo.",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"

class HourForecast(BaseModel):
    time: str
    temperature: float
    humidity: float
    dew_point: float
    rain_probability: float
    precipitation_mm: float
    cloud_cover: float
    pressure_hpa: float
    wind_speed: float
    rain_score: int
    alert_level: str
    advice: str

class RainResponse(BaseModel):
    location_name: str
    latitude: float
    longitude: float
    generated_at: str
    current: HourForecast
    best_hour: HourForecast
    next_hours: List[HourForecast]
    source: str
    disclaimer: str

def calculate_rain_score(row: dict) -> int:
    rain_probability = row.get("rain_probability", 0) or 0
    humidity = row.get("humidity", 0) or 0
    cloud_cover = row.get("cloud_cover", 0) or 0
    precipitation = row.get("precipitation_mm", 0) or 0
    dew_point = row.get("dew_point", 0) or 0
    pressure = row.get("pressure_hpa", 1013) or 1013
    wind_speed = row.get("wind_speed", 0) or 0

    score = 0
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

def classify(score: int):
    if score >= 80:
        return "إنذار مطر عالي", "فرصة المطر عالية. تابع التنبيهات الرسمية وتجنب مجاري السيول."
    if score >= 60:
        return "تنبيه متوسط", "توجد مؤشرات جيدة لاحتمال المطر. تابع الرادار والتحديثات."
    if score >= 40:
        return "احتمال ضعيف إلى متوسط", "توجد مؤشرات بسيطة للمطر، لكن لا يوجد إنذار قوي حاليًا."
    return "لا يوجد إنذار", "فرصة المطر ضعيفة في الوقت الحالي."

@app.get("/")
def root():
    return {
        "name": "RainGuard AI API",
        "status": "running",
        "example": "/rain-alert?lat=21.4858&lon=39.1925&name=Jeddah"
    }

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/rain-alert", response_model=RainResponse)
async def rain_alert(
    lat: float = Query(..., description="Latitude"),
    lon: float = Query(..., description="Longitude"),
    name: str = Query("موقع غير محدد", description="Location name"),
    hours: int = Query(12, ge=1, le=24)
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
        data = response.json()

    h = data["hourly"]
    rows = []

    count = min(hours, len(h["time"]))

    for i in range(count):
        raw = {
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

        score = calculate_rain_score(raw)
        level, advice = classify(score)

        rows.append(HourForecast(
            **raw,
            rain_score=score,
            alert_level=level,
            advice=advice
        ))

    best = max(rows, key=lambda x: x.rain_score)

    return RainResponse(
        location_name=name,
        latitude=lat,
        longitude=lon,
        generated_at=datetime.utcnow().isoformat() + "Z",
        current=rows[0],
        best_hour=best,
        next_hours=rows,
        source="Open-Meteo Forecast API",
        disclaimer="هذه قراءة تقديرية وليست بديلًا عن تنبيهات المركز الوطني للأرصاد.",
    )