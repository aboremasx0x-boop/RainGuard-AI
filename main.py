from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import httpx
from datetime import datetime, timedelta

app = FastAPI(
    title="RainGuard AI API",
    description="Local rain alert API using Open-Meteo with cache protection",
    version="4.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"

CACHE = {}
CACHE_MINUTES = 10


def cache_key(lat, lon, hours):
    return f"{round(lat, 4)}:{round(lon, 4)}:{hours}"


def get_cached(key):
    item = CACHE.get(key)
    if not item:
        return None

    if datetime.utcnow() - item["time"] <= timedelta(minutes=CACHE_MINUTES):
        data = item["data"]
        data["cache_status"] = "cached"
        data["message"] = "تم استخدام بيانات محفوظة مؤقتًا لتقليل الضغط على المصدر"
        return data

    return None


def save_cache(key, data):
    CACHE[key] = {
        "time": datetime.utcnow(),
        "data": data
    }


def calculate_rain_score(data):
    score = 0

    humidity = data.get("humidity", 0)
    rain_probability = data.get("rain_probability", 0)
    cloud_cover = data.get("cloud_cover", 0)
    precipitation = data.get("precipitation_mm", 0)
    dew_point = data.get("dew_point", 0)
    pressure = data.get("pressure_hpa", 1013)
    wind_speed = data.get("wind_speed", 0)

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


def calculate_daily_score(day):
    score = 0

    rain_probability = day.get("rain_probability_max", 0)
    precipitation_sum = day.get("precipitation_sum", 0)

    score += rain_probability * 0.75

    if precipitation_sum > 0:
        score += 10

    if precipitation_sum >= 5:
        score += 10

    if precipitation_sum >= 15:
        score += 5

    return min(round(score), 100)


def classify(score):
    if score >= 80:
        return {
            "level": "HIGH RAIN ALERT",
            "advice": "Heavy rain possible. Follow official weather warnings."
        }

    if score >= 60:
        return {
            "level": "MODERATE ALERT",
            "advice": "Rain chance is moderate. Monitor updates."
        }

    if score >= 40:
        return {
            "level": "LOW TO MODERATE",
            "advice": "Weak rain indicators detected."
        }

    return {
        "level": "NO ALERT",
        "advice": "Rain chance is currently low."
    }


@app.get("/")
def root():
    return {
        "name": "RainGuard AI API",
        "status": "running",
        "version": "4.0",
        "cache_minutes": CACHE_MINUTES,
        "example": "/rain-alert?lat=21.4858&lon=39.1925&name=Jeddah"
    }


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "RainGuard AI"
    }


@app.get("/rain-alert")
async def rain_alert(
    lat: float = Query(...),
    lon: float = Query(...),
    name: str = Query("Unknown Location"),
    hours: int = Query(12)
):
    key = cache_key(lat, lon, hours)

    cached = get_cached(key)
    if cached:
        return JSONResponse(
            content=cached,
            media_type="application/json; charset=utf-8"
        )

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
        "daily": ",".join([
            "temperature_2m_max",
            "temperature_2m_min",
            "precipitation_probability_max",
            "precipitation_sum",
            "rain_sum",
            "wind_speed_10m_max"
        ]),
        "forecast_days": 7,
        "timezone": "auto"
    }

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.get(OPEN_METEO_URL, params=params)

            if response.status_code == 429:
                old_cache = CACHE.get(key)
                if old_cache:
                    data = old_cache["data"]
                    data["cache_status"] = "old_cache"
                    data["message"] = "تم استخدام آخر بيانات محفوظة بسبب كثرة الطلبات على المصدر"
                    return JSONResponse(
                        content=data,
                        media_type="application/json; charset=utf-8"
                    )

                return JSONResponse(
                    status_code=429,
                    content={
                        "error": True,
                        "error_type": "too_many_requests",
                        "message": "مصدر الطقس المجاني مشغول مؤقتًا بسبب كثرة الطلبات. حاول بعد دقائق.",
                        "location_name": name,
                        "latitude": lat,
                        "longitude": lon
                    },
                    media_type="application/json; charset=utf-8"
                )

            response.raise_for_status()
            weather = response.json()

    except httpx.HTTPStatusError as e:
        return JSONResponse(
            status_code=502,
            content={
                "error": True,
                "error_type": "weather_source_error",
                "message": f"حدث خطأ من مصدر الطقس: {str(e)}",
                "location_name": name
            },
            media_type="application/json; charset=utf-8"
        )

    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "error": True,
                "error_type": "server_error",
                "message": f"حدث خطأ داخلي: {str(e)}",
                "location_name": name
            },
            media_type="application/json; charset=utf-8"
        )

    h = weather.get("hourly", {})
    next_hours = []

    count = min(hours, len(h.get("time", [])))

    for i in range(count):
        row = {
            "time": h["time"][i],
            "temperature": h["temperature_2m"][i] or 0,
            "humidity": h["relative_humidity_2m"][i] or 0,
            "dew_point": h["dew_point_2m"][i] or 0,
            "rain_probability": h["precipitation_probability"][i] or 0,
            "precipitation_mm": h["precipitation"][i] or 0,
            "cloud_cover": h["cloud_cover"][i] or 0,
            "pressure_hpa": h["pressure_msl"][i] or 1013,
            "wind_speed": h["wind_speed_10m"][i] or 0
        }

        score = calculate_rain_score(row)
        alert = classify(score)

        row["rain_score"] = score
        row["alert_level"] = alert["level"]
        row["advice"] = alert["advice"]

        next_hours.append(row)

    if not next_hours:
        return JSONResponse(
            status_code=502,
            content={
                "error": True,
                "message": "لم تصل بيانات كافية من مصدر الطقس",
                "location_name": name
            },
            media_type="application/json; charset=utf-8"
        )

    best_hour = max(next_hours, key=lambda x: x["rain_score"])

    d = weather.get("daily", {})
    daily_forecast = []

    for i in range(len(d.get("time", []))):
        day = {
            "date": d["time"][i],
            "temperature_max": d["temperature_2m_max"][i] or 0,
            "temperature_min": d["temperature_2m_min"][i] or 0,
            "rain_probability_max": d["precipitation_probability_max"][i] or 0,
            "precipitation_sum": d["precipitation_sum"][i] or 0,
            "rain_sum": d["rain_sum"][i] or 0,
            "wind_speed_max": d["wind_speed_10m_max"][i] or 0
        }

        daily_score = calculate_daily_score(day)
        daily_alert = classify(daily_score)

        day["daily_rain_score"] = daily_score
        day["alert_level"] = daily_alert["level"]
        day["advice"] = daily_alert["advice"]

        daily_forecast.append(day)

    result = {
        "error": False,
        "location_name": name,
        "latitude": lat,
        "longitude": lon,
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "cache_status": "fresh",
        "current": next_hours[0],
        "best_hour": best_hour,
        "next_hours": next_hours,
        "daily_forecast": daily_forecast,
        "source": "Open-Meteo Forecast API",
        "disclaimer": "Experimental local rain prediction system."
    }

    save_cache(key, result)

    return JSONResponse(
        content=result,
        media_type="application/json; charset=utf-8"
    )
